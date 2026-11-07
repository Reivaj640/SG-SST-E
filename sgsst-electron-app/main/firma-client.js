// =====================================================================
// 📦101 (2026-08-20) — Cliente HTTP firma-service v1 para K+AIR (I-101)
//
// Capa de transporte: encapsula TODAS las llamadas HTTP al firma-service.
// - Sin dependencias de Electron en runtime (testable con node:test).
// - Headers obligatorios: X-Internal-API-Key, X-Client-Instance-Id,
//   X-Request-Id (siempre) + Idempotency-Key (solo POST sign-requests).
// - Manejo uniforme de errores: mapea status HTTP → { success, error }.
// - Retry con backoff en 429 (respeta Retry-After / RateLimit IETF draft-7).
// - Timeout por request (30s default, 60s para upload).
//
// D-9 = NO: URLs SIN prefijo /v1/. Sigo el spec de
// docs/gestion-humana/firma-electronica/API.md (sección 6 — endpoints
// internos K+AIR).
//
// Plan: docs/kair-firma-integration/READY-TO-IMPLEMENT.md §D (I-101).
// Spec: docs/gestion-humana/firma-electronica/API.md.
// =====================================================================
'use strict';

const { randomUUID } = require('crypto');

const MOD = 'FIRMA-CLIENT';
const DEFAULT_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 60_000;
const MAX_RETRIES_429 = 2;

// ---------- Helpers de error ----------
function _err(code, message, extra) {
  var e = { code: code, message: message };
  if (extra) Object.assign(e, extra);
  return e;
}

function _ok(data) {
  return { success: true, data: data };
}

function _fail(code, message, extra) {
  return { success: false, error: _err(code, message, extra) };
}

// Mapea error del backend (shape API.md §2) → shape interno del cliente.
function _mapBackendError(httpStatus, body) {
  var appCode = (body && body.error && body.error.code) || null;
  var appMessage = (body && body.error && body.error.message) || null;
  var appDetails = (body && body.error && body.error.details) || null;
  var requestId = (body && body.error && body.error.request_id) || null;

  // 404: distinguir "endpoint no implementado en backend" de "recurso no existe".
  // Heurística: si el body NO tiene shape de AppError (no tiene `error.code`),
  // probablemente Express devolvió 404 sin pasar por el handler central.
  var code = appCode || _httpToCode(httpStatus);
  var message = appMessage || _httpToMessage(httpStatus);
  var extra = { httpStatus: httpStatus };
  if (appDetails) extra.details = appDetails;
  if (requestId) extra.requestId = requestId;

  // Si es 404 sin AppError, marcar como endpoint no disponible
  // (común cuando I-008/I-103/I-104/I-013b aún no están en Track A).
  if (httpStatus === 404 && !appCode) {
    code = 'ENDPOINT_NOT_AVAILABLE';
    message = 'Endpoint pendiente implementación backend (I-008/I-103/I-104/I-013b). HTTP 404 sin shape AppError.';
  }

  return _fail(code, message, extra);
}

function _httpToCode(httpStatus) {
  switch (httpStatus) {
    case 400: return 'INVALID_REQUEST_BODY';
    case 401: return 'INVALID_API_KEY';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 410: return 'GONE';
    case 413: return 'PAYLOAD_TOO_LARGE';
    case 422: return 'UNPROCESSABLE';
    case 429: return 'RATE_LIMIT_EXCEEDED';
    case 500: return 'INTERNAL_ERROR';
    case 503: return 'SERVICE_UNAVAILABLE';
    default:
      if (httpStatus >= 400 && httpStatus < 500) return 'CLIENT_ERROR';
      if (httpStatus >= 500) return 'SERVER_ERROR';
      return 'UNKNOWN_ERROR';
  }
}

function _httpToMessage(httpStatus) {
  var map = {
    400: 'Solicitud malformada',
    401: 'API key inválida o ausente',
    403: 'Operación no permitida',
    404: 'Recurso no encontrado',
    409: 'Conflicto de estado',
    410: 'Recurso ya no disponible',
    413: 'Payload demasiado grande',
    422: 'Entidad no procesable',
    429: 'Demasiadas solicitudes',
    500: 'Error interno del servidor',
    503: 'Servicio no disponible'
  };
  return map[httpStatus] || ('HTTP ' + httpStatus);
}

// ---------- Sleep helper (testeable) ----------
function _sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// ---------- Headers builder ----------
function _buildHeaders(apiKey, clientInstanceId, opts) {
  opts = opts || {};
  var headers = {
    'X-Internal-API-Key': apiKey,
    'X-Client-Instance-Id': clientInstanceId,
    'X-Request-Id': randomUUID(),
    'User-Agent': 'K+AIR-Desktop/' + (opts.appVersion || 'dev')
  };
  if (opts.idempotencyKey) {
    headers['Idempotency-Key'] = opts.idempotencyKey;
  }
  if (opts.accept) {
    headers['Accept'] = opts.accept;
  } else {
    headers['Accept'] = 'application/json';
  }
  return headers;
}

// ---------- Retry backoff para 429 ----------
function _getRetryAfterMs(response) {
  // RFC 7231: Retry-After en segundos (o HTTP-date).
  // El header IETF draft-7 `RateLimit-Reset` también se respeta.
  var retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    var n = parseInt(retryAfter, 10);
    if (!isNaN(n) && n >= 0) return n * 1000;
  }
  var reset = response.headers.get('RateLimit-Reset');
  if (reset) {
    var delta = parseInt(reset, 10);
    if (!isNaN(delta) && delta >= 0) return delta * 1000;
  }
  return null;
}

// ---------- Fetch con AbortController (timeout) ----------
async function _fetchWithTimeout(url, fetchOpts, timeoutMs) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
  fetchOpts.signal = controller.signal;
  try {
    return await fetch(url, fetchOpts);
  } catch (e) {
    if (e && e.name === 'AbortError') {
      var err = new Error('Request timeout after ' + timeoutMs + 'ms');
      err.code = 'TIMEOUT';
      throw err;
    }
    var netErr = new Error('Network error: ' + (e && e.message ? e.message : 'unknown'));
    netErr.code = 'NETWORK_ERROR';
    throw netErr;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Core request (con retry en 429) ----------
async function _request(method, url, headers, body, timeoutMs) {
  var fetchOpts = {
    method: method,
    headers: headers,
    body: body
  };
  if (body === undefined || body === null) {
    delete fetchOpts.body;
  }

  var attempt = 0;
  var lastResponse = null;
  while (attempt <= MAX_RETRIES_429) {
    var response = await _fetchWithTimeout(url, fetchOpts, timeoutMs);
    lastResponse = response;
    if (response.status !== 429) {
      return response;
    }
    // 429 → backoff
    if (attempt >= MAX_RETRIES_429) {
      // Agotamos reintentos; devolver el 429.
      return response;
    }
    var backoffMs = _getRetryAfterMs(response);
    if (backoffMs === null) {
      backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s
    }
    await _sleep(backoffMs);
    attempt++;
  }
  return lastResponse;
}

// ---------- Parsing de respuesta ----------
async function _parseResponse(response, expectedContentType) {
  var status = response.status;
  var ct = (response.headers.get('content-type') || '').toLowerCase();

  // PDF binario
  if (expectedContentType === 'application/pdf' || ct.indexOf('application/pdf') === 0) {
    if (status >= 200 && status < 300) {
      var buffer = Buffer.from(await response.arrayBuffer());
      return _ok({
        base64: buffer.toString('base64'),
        contentType: 'application/pdf',
        contentLength: buffer.length,
        documentHash: response.headers.get('X-Document-Hash') || undefined,
        evidenceHash: response.headers.get('X-Evidence-Hash') || undefined
      });
    }
    // Error: leer como JSON
    try {
      var errBody = await response.json();
      return _mapBackendError(status, errBody);
    } catch (e) {
      return _mapBackendError(status, { error: { code: _httpToCode(status), message: _httpToMessage(status) } });
    }
  }

  // JSON
  var body = null;
  try {
    body = await response.json();
  } catch (e) {
    body = null;
  }

  if (status >= 200 && status < 300) {
    return _ok(body || {});
  }
  return _mapBackendError(status, body);
}

// =====================================================================
//  FirmaClient class
// =====================================================================

/**
 * Crea un cliente HTTP para firma-service.
 *
 * @param {object} opts
 * @param {string} opts.baseUrl          - URL base del firma-service (sin trailing slash).
 * @param {string} opts.apiKey           - API key (X-Internal-API-Key).
 * @param {string} opts.clientInstanceId - UUID v4 (X-Client-Instance-Id).
 * @param {string} [opts.adminApiKey]    - Admin key (X-Admin-API-Key). Si está presente,
 *                                          habilita los endpoints admin (firma:empresa:create,
 *                                          rotate, revoke, list-firma-remote). Si NO está
 *                                          presente, los métodos admin lanzan
 *                                          `ADMIN_TOKEN_REQUIRED` sin hacer HTTP.
 * @param {string} [opts.appVersion]     - Versión de K+AIR (User-Agent).
 * @param {function} [opts._fetch]       - DEPRECADO. Override de fetch para tests. Usar
 *                                          en lugar de mockear globalThis.fetch.
 * @param {function} [opts._sleep]       - DEPRECADO. Override de sleep para tests.
 */
function createFirmaClient(opts) {
  opts = opts || {};
  if (!opts.baseUrl || typeof opts.baseUrl !== 'string') {
    throw new Error('createFirmaClient: baseUrl required');
  }
  if (!opts.apiKey || typeof opts.apiKey !== 'string') {
    throw new Error('createFirmaClient: apiKey required');
  }
  if (!opts.clientInstanceId || typeof opts.clientInstanceId !== 'string') {
    throw new Error('createFirmaClient: clientInstanceId required');
  }
  // Normalizar: quitar trailing slash
  var baseUrl = opts.baseUrl.replace(/\/+$/, '');
  var apiKey = opts.apiKey;
  var clientInstanceId = opts.clientInstanceId;
  var appVersion = opts.appVersion || 'dev';
  // adminApiKey es OPCIONAL. Si no se pasa, los métodos admin lanzan
  // ADMIN_TOKEN_REQUIRED sin hacer HTTP. Si se pasa, se usa como
  // X-Admin-API-Key en los endpoints admin (DR-2: independiente de apiKey).
  var adminApiKey = (opts.adminApiKey && typeof opts.adminApiKey === 'string')
    ? opts.adminApiKey
    : null;

  // Override de fetch y sleep para tests (sustituye a mockear globalThis).
  // Mantenerlo opcional: si no se pasa, se usa el fetch global de Node 20+.
  var _fetch = opts._fetch || globalThis.fetch;
  var _customSleep = opts._sleep;

  function _doRequest(method, path, body, extraHeaders, timeoutMs) {
    timeoutMs = timeoutMs || DEFAULT_TIMEOUT_MS;
    var url = baseUrl + path;
    // Mezclar appVersion del closure en extraHeaders para que _buildHeaders lo vea
    var merged = Object.assign({ appVersion: appVersion }, extraHeaders || {});
    var headers = _buildHeaders(apiKey, clientInstanceId, merged);
    headers['Content-Type'] = 'application/json; charset=utf-8';
    var bodyStr = body === undefined || body === null ? undefined : JSON.stringify(body);
    return _doRequestRaw(method, url, headers, bodyStr, timeoutMs);
  }

  // _doRequestRaw retorna un "Result" (no un Response) que SIEMPRE resuelve
  // (nunca rechaza). El Result es { _isResponse: true, response } en éxito,
  // o { _isResponse: false, error } en error. Esto permite que _parseResult
  // mapee errores de red/timeout a { success: false, error: ... } sin
  // propagar excepciones.
  function _doRequestRaw(method, url, headers, body, timeoutMs) {
    function _oneFetch(fetchUrl, fetchOpts) {
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
      fetchOpts.signal = controller.signal;
      var p = _fetch(fetchUrl, fetchOpts);
      return p.then(
        function (response) {
          clearTimeout(timer);
          return response;
        },
        function (e) {
          clearTimeout(timer);
          if (e && e.name === 'AbortError') {
            var te = new Error('Request timeout after ' + timeoutMs + 'ms');
            te.code = 'TIMEOUT';
            throw te;
          }
          var ne = new Error('Network error: ' + (e && e.message ? e.message : 'unknown'));
          ne.code = 'NETWORK_ERROR';
          throw ne;
        }
      );
    }
    function _doSleep(ms) {
      if (_customSleep) return _customSleep(ms);
      return _sleep(ms);
    }
    return (async function () {
      var attempt = 0;
      while (attempt <= MAX_RETRIES_429) {
        var fetchOpts = { method: method, headers: headers };
        if (body !== undefined && body !== null) {
          fetchOpts.body = body;
        }
        try {
          var response = await _oneFetch(url, fetchOpts);
          if (response.status !== 429) {
            return { _isResponse: true, response: response };
          }
          if (attempt >= MAX_RETRIES_429) {
            return { _isResponse: true, response: response };
          }
          var backoffMs = _getRetryAfterMs(response);
          if (backoffMs === null) {
            backoffMs = Math.pow(2, attempt) * 1000;
          }
          await _doSleep(backoffMs);
          attempt++;
        } catch (e) {
          return { _isResponse: false, error: e };
        }
      }
      // No debería llegar acá, pero por si acaso
      return { _isResponse: false, error: new Error('Max retries exceeded') };
    })();
  }

  // Parsea un Result (de _doRequestRaw) → { success, data|error }
  async function _parseResult(result, expectedContentType) {
    if (!result || !result._isResponse) {
      var e = (result && result.error) || new Error('Unknown error');
      if (e.code === 'NETWORK_ERROR') return _fail('NETWORK_ERROR', e.message);
      if (e.code === 'TIMEOUT') return _fail('TIMEOUT', e.message);
      return _fail('INTERNAL', e.message);
    }
    return _parseResponse(result.response, expectedContentType);
  }

  // ============================================================
  //  Endpoints públicos
  // ============================================================

  /**
   * POST /internal/sign-requests (multipart).
   * @param {object} args
   * @param {object} args.metadata  - { id_documento, id_trabajador, id_empresa, tipo_firma, agreement_hash, ttl_horas?, metadata? }
   * @param {Buffer|string} args.pdfBuffer - Bytes del PDF (Buffer o base64 string).
   * @param {string} [args.pdfName] - Nombre del archivo PDF (default 'documento.pdf').
   * @returns {Promise<{success,data}|{success:false,error}>}
   */
  function createSignRequest(args) {
    args = args || {};
    if (!args.metadata) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'metadata requerida'));
    }
    var pdfBuffer;
    if (Buffer.isBuffer(args.pdfBuffer)) {
      pdfBuffer = args.pdfBuffer;
    } else if (typeof args.pdfBuffer === 'string') {
      // base64
      try {
        pdfBuffer = Buffer.from(args.pdfBuffer, 'base64');
      } catch (e) {
        return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'pdfBase64 inválido'));
      }
    } else {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'pdfBuffer/pdfBase64 requerido'));
    }
    var pdfName = args.pdfName || 'documento.pdf';

    var boundary = '----KAIRFormBoundary' + randomUUID().replace(/-/g, '');
    var idemKey = randomUUID();
    var url = baseUrl + '/internal/sign-requests';
    var headers = _buildHeaders(apiKey, clientInstanceId, {
      idempotencyKey: idemKey,
      accept: 'application/json',
      appVersion: appVersion
    });
    // multipart/form-data manual (Buffer concat) — sin deps externas
    var metaJson = JSON.stringify(args.metadata);
    var headMeta = Buffer.from(
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="metadata"\r\n' +
      'Content-Type: application/json\r\n\r\n'
    );
    var tailMeta = Buffer.from('\r\n');
    var headPdf = Buffer.from(
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="documento"; filename="' + pdfName + '"\r\n' +
      'Content-Type: application/pdf\r\n\r\n'
    );
    var tailPdf = Buffer.from('\r\n');
    var closing = Buffer.from('--' + boundary + '--\r\n');
    var body = Buffer.concat([headMeta, Buffer.from(metaJson), tailMeta, headPdf, pdfBuffer, tailPdf, closing]);
    headers['Content-Type'] = 'multipart/form-data; boundary=' + boundary;
    headers['Content-Length'] = String(body.length);
    // Reemplazar Accept=application/json (el default) explícitamente
    return _doRequestRaw('POST', url, headers, body, UPLOAD_TIMEOUT_MS)
      .then(function (r) { return _parseResult(r, 'application/json'); });
  }

  /**
   * GET /internal/sign-requests/:id
   * @param {string} id
   */
  function getSignRequest(id) {
    if (!id) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id requerido'));
    }
    return _doRequest('GET', '/internal/sign-requests/' + encodeURIComponent(id), null, null)
      .then(function (r) { return _parseResult(r, 'application/json'); });
  }

  /**
   * GET /internal/sign-requests-batch?ids=a,b,c
   * El backend implementó I-008 como ruta separada (no como query param
   * sobre GET /sign-requests) porque el shape de respuesta es distinto
   * (missing[]/forbidden[] vs paginado). Ver Track A SPEC §1.4 decisión 4.
   * @param {string[]} ids
   */
  function listSignRequests(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'ids[] requerido'));
    }
    var qs = ids.map(function (i) { return encodeURIComponent(i); }).join(',');
    return _doRequest('GET', '/internal/sign-requests-batch?ids=' + qs, null, null)
      .then(function (r) { return _parseResult(r, 'application/json'); });
  }

  /**
   * GET /internal/sign-requests/:id/document.pdf
   * (puede NO existir hasta I-103 backend)
   * @param {string} id
   */
  function getSignRequestDocument(id) {
    if (!id) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id requerido'));
    }
    var headers = _buildHeaders(apiKey, clientInstanceId, {
      accept: 'application/pdf',
      appVersion: appVersion
    });
    var url = baseUrl + '/internal/sign-requests/' + encodeURIComponent(id) + '/document.pdf';
    return _doRequestRaw('GET', url, headers, undefined, DEFAULT_TIMEOUT_MS)
      .then(function (r) { return _parseResult(r, 'application/pdf'); });
  }

  /**
   * GET /internal/sign-requests/:id/constancia.pdf
   * (puede NO existir hasta I-104 backend)
   * @param {string} id
   */
  function getSignRequestConstancia(id) {
    if (!id) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id requerido'));
    }
    var headers = _buildHeaders(apiKey, clientInstanceId, {
      accept: 'application/pdf',
      appVersion: appVersion
    });
    var url = baseUrl + '/internal/sign-requests/' + encodeURIComponent(id) + '/constancia.pdf';
    return _doRequestRaw('GET', url, headers, undefined, DEFAULT_TIMEOUT_MS)
      .then(function (r) { return _parseResult(r, 'application/pdf'); });
  }

  /**
   * GET /internal/expedientes/:idTrabajador/constancia-consolidada.pdf
   * Constancia GENERAL del expediente: todas las solicitudes de firma del
   * trabajador (firmadas y pendientes), generada al vuelo por el backend.
   * @param {string} idTrabajador - cédula del trabajador (identificador del expediente)
   */
  function getExpedienteConstanciaConsolidada(idTrabajador, opts) {
    if (!idTrabajador) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'idTrabajador requerido'));
    }
    var headers = _buildHeaders(apiKey, clientInstanceId, {
      accept: 'application/pdf',
      appVersion: appVersion
    });
    var url = baseUrl + '/internal/expedientes/' + encodeURIComponent(idTrabajador) + '/constancia-consolidada.pdf';
    // Títulos reales de documentos (viven en K+AIR; firma-service solo
    // conoce el id interno). Query param JSON, tolerado por el backend.
    if (opts && opts.titulos) {
      try {
        url += '?titulos=' + encodeURIComponent(JSON.stringify(opts.titulos));
      } catch (e) { /* noop — cosmético */ }
    }
    return _doRequestRaw('GET', url, headers, undefined, DEFAULT_TIMEOUT_MS)
      .then(function (r) { return _parseResult(r, 'application/pdf'); });
  }

  /**
   * GET /internal/sign-requests/:id/link (C-22 recovery)
   * (puede NO existir hasta I-013b backend)
   * @param {string} id
   */
  function getSignRequestLink(id) {
    if (!id) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id requerido'));
    }
    return _doRequest('GET', '/internal/sign-requests/' + encodeURIComponent(id) + '/link', null, null)
      .then(function (r) { return _parseResult(r, 'application/json'); });
  }

  /**
   * I-103.A1.5.2 · POST /internal/sign-requests/:id/notify-remote
   *
   * Envía (o re-envía) la invitación al firmante por correo. Es el "primer
   * contacto" con el firmante después de que K+AIR creó el sign request.
   *
   * Status codes (mapeados por el backend en routes/signRequest.js):
   *   - 200: invitación enviada → retorna {ok, id_solicitud, messageId, sent_at, evento_id}
   *   - 400: body inválido (sin correo, formato inválido) → INVALID_REQUEST_BODY
   *   - 404: sign request no existe O cross-company (silent) → NOT_FOUND
   *   - 410: estado terminal (SIGNED/REJECTED/REVOKED/EXPIRED/CANCELLED) o legacy
   *          sin token cifrado → INVITE_NOT_AVAILABLE
   *   - 502: SMTP caído → INVITE_EMAIL_FAILED
   *
   * Auth: X-Internal-API-Key (per-empresa). El bridge se encarga de resolver
   * la empresa activa y delegar al cliente per-empresa correspondiente.
   *
   * @param {string} id - id_solicitud (SIGN-YYYY-NNNNNN) o id interno (entero positivo)
   * @param {object} args
   * @param {string} args.correo - correo destino del firmante
   * @param {object} [args.context] - metadata libre para auditoría
   * @returns {Promise<{success,data}|{success:false,error}>}
   */
  function notifySignRequestRemote(id, args) {
    if (!id) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id requerido'));
    }
    if (!args || typeof args !== 'object') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'correo y context requeridos (object)'));
    }
    if (typeof args.correo !== 'string' || args.correo.length === 0) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'correo requerido (string)'));
    }
    // Validación de formato: liviana. El backend (zod) hace la validación
    // estricta con .email(). Acá solo evitamos 400 triviales por typo.
    if (!args.correo.includes('@')) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'correo inválido (sin @)'));
    }
    var body = { correo: args.correo };
    if (args.context && typeof args.context === 'object') {
      body.context = args.context;
    }
    return _doRequest(
      'POST',
      '/internal/sign-requests/' + encodeURIComponent(id) + '/notify-remote',
      body,
      null
    ).then(function (r) { return _parseResult(r, 'application/json'); });
  }

  /**
   * POST /internal/sign-requests/:id/resend-otp
   * Wrapper per-empresa de publicFlow.resendOtp() (I-103.A1.6.B).
   * Permite a K+AIR reenviar el OTP al firmante desde el panel de Firma
   * Electrónica sin tener el token URL del firmante.
   *
   * El backend resuelve el token server-side vía getTokenForRecovery (I-013b,
   * mismo mecanismo que /link) y delega a publicFlow.resendOtp() que
   * gestiona estado, rate-limit, OTP_NOT_EXPIRED, generación atómica y
   * envío por mailer. Este wrapper es un espejo per-empresa del endpoint
   * público /api/sign/:token/resend-otp (mini-app).
   *
   * Auth: X-Internal-API-Key (per-empresa). El bridge se encarga de resolver
   * la empresa activa y delegar al cliente per-empresa correspondiente.
   *
   * @param {string} id - id_solicitud (SIGN-YYYY-NNNNNN) o id interno (entero positivo)
   * @param {object} [args] - { companyName, context? }
   * @returns {Promise<{success,data}|{success:false,error}>}
   */
  function resendSignRequestOtp(id, args) {
    if (!id) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id requerido'));
    }
    var body = {};
    if (args && args.context && typeof args.context === 'object') {
      body.context = args.context;
    }
    return _doRequest(
      'POST',
      '/internal/sign-requests/' + encodeURIComponent(id) + '/resend-otp',
      body,
      null
    ).then(function (r) { return _parseResult(r, 'application/json'); });
  }

  /**
   * GET /internal/sign-requests/:id/eventos
   * Línea de tiempo de auditoría del sign request (CREATED, INVITE_SENT,
   * IDENTIFIED, OTP_VERIFIED, SIGNED, REJECTED, etc.).
   * Requiere la operación audit:read (los clientes per-empresa la traen).
   * El backend ya redacta secretos de metadata (no expone OTPs).
   *
   * @param {string} id - id_solicitud (SIGN-YYYY-NNNNNN) o id interno
   * @returns {Promise<{success,data:{id_solicitud,total,eventos[]}}|{success:false,error}>}
   */
  function getSignRequestEvents(id) {
    if (!id) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id requerido'));
    }
    return _doRequest(
      'GET',
      '/internal/sign-requests/' + encodeURIComponent(id) + '/eventos',
      null,
      null
    ).then(function (r) { return _parseResult(r, 'application/json'); });
  }

  /**
   * POST /internal/consentimientos
   * @param {object} payload { id_trabajador, id_empresa, version_acuerdo, correo_verificacion, kair_version }
   */
  function createConsent(payload) {
    if (!payload || typeof payload !== 'object') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'payload requerido'));
    }
    return _doRequest('POST', '/internal/consentimientos', payload, null)
      .then(function (r) { return _parseResult(r, 'application/json'); });
  }

  /**
   * POST /internal/consentimientos/:id/verify-otp
   * @param {string} consentId
   * @param {string} otp
   */
  function verifyConsentOtp(consentId, otp) {
    if (!consentId) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'consentId requerido'));
    }
    if (!otp) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'otp requerido'));
    }
    return _doRequest('POST', '/internal/consentimientos/' + encodeURIComponent(consentId) + '/verify-otp', { otp: otp }, null)
      .then(function (r) { return _parseResult(r, 'application/json'); });
  }

  /**
   * GET /internal/acuerdo-activo
   */
  function getActiveAgreement() {
    return _doRequest('GET', '/internal/acuerdo-activo', null, null)
      .then(function (r) { return _parseResult(r, 'application/json'); });
  }

  // ============================================================
  //  Endpoints ADMIN (per-company clients) — DR-1..6
  //  Usa `X-Admin-API-Key` (NO `X-Internal-API-Key`) — DR-2.
  //  Si adminApiKey no está configurado en el factory, los métodos
  //  retornan `ADMIN_TOKEN_REQUIRED` sin hacer HTTP (DR-2).
  // ============================================================

  /**
   * Construye headers para endpoints admin (X-Admin-API-Key en lugar de
   * X-Internal-API-Key). Lanza si adminApiKey no está configurado.
   *
   * @param {object} [extraOpts]
   * @returns {object} headers
   */
  function _buildAdminHeaders(extraOpts) {
    if (!adminApiKey) {
      throw new Error('adminApiKey required for admin endpoints (configure via opts.adminApiKey)');
    }
    var headers = _buildHeaders(adminApiKey, clientInstanceId, extraOpts);
    // _buildHeaders pone 'X-Internal-API-Key' por default. Para admin,
    // lo reemplazamos por 'X-Admin-API-Key' (DR-2: header distinto).
    delete headers['X-Internal-API-Key'];
    headers['X-Admin-API-Key'] = adminApiKey;
    return headers;
  }

  /**
   * Helper: helper interno para métodos admin. Construye el path, headers
   * y body, y delega a _doRequestRaw + _parseResult. Si adminApiKey falta,
   * retorna ADMIN_TOKEN_REQUIRED sin hacer HTTP.
   *
   * @param {string} method
   * @param {string} path
   * @param {object} [body]
   * @param {object} [extraHeaders] - headers adicionales (p.ej. X-Admin-Motivo).
   *   Las tres rutas que lo exigen (anular, verificar-representante y
   *   contrafirmar) lo mandan: sin el, el service responde 400
   *   MOTIVO_REQUERIDO y el acto NO se registra.
   * @returns {Promise<{success,data}|{success:false,error}>}
   */
  function _adminRequest(method, path, body, extraHeaders) {
    if (!adminApiKey) {
      return Promise.resolve(_fail(
        'ADMIN_TOKEN_REQUIRED',
        'adminApiKey no configurado. Configure via firma:config:set-admin-key.',
        { remediationHint: 'firma:config:set-admin-key' }
      ));
    }
    var headers;
    try {
      headers = _buildAdminHeaders({ appVersion: appVersion });
    } catch (e) {
      return Promise.resolve(_fail('ADMIN_TOKEN_REQUIRED', e.message));
    }
    headers['Content-Type'] = 'application/json; charset=utf-8';
    if (extraHeaders && typeof extraHeaders === 'object') {
      Object.keys(extraHeaders).forEach(function (k) {
        var v = extraHeaders[k];
        if (v !== undefined && v !== null && v !== '') headers[k] = v;
      });
    }
    var bodyStr = (body === undefined || body === null) ? undefined : JSON.stringify(body);
    var url = baseUrl + path;
    return _doRequestRaw(method, url, headers, bodyStr, DEFAULT_TIMEOUT_MS)
      .then(function (r) { return _parseResult(r, 'application/json'); });
  }

  /**
   * POST /internal/admin/clientes (DR-1, DR-3)
   *
   * Crea un per-company client. Retorna la api_key en plaintext (UNA sola
   * vez). El bridge es responsable de NO propagar el plaintext al renderer.
   *
   * @param {object} args
   * @param {string} args.id_empresa       - 1-64 chars (NIT, EXT-XXX, etc.)
   * @param {string[]} args.allowed_operations - 1-10 items del enum I-010
   * @param {string} [args.description]   - 1-200 chars (opcional)
   * @returns {Promise<{success,data}|{success:false,error}>}
   *   data: { id_empresa, api_key, api_key_hash_prefix, allowed_operations,
   *           description, created_at, message }
   *   errors: ADMIN_TOKEN_REQUIRED, INVALID_REQUEST_BODY, INVALID_API_KEY,
   *           CLIENT_EXISTS_FOR_EMPRESA (409)
   */
  function adminCreateClient(args) {
    args = args || {};
    if (!args.id_empresa || typeof args.id_empresa !== 'string') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id_empresa requerido (string, 1-64 chars)'));
    }
    if (!Array.isArray(args.allowed_operations) || args.allowed_operations.length === 0) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'allowed_operations requerido (array, 1-10 items)'));
    }
    var body = {
      id_empresa: args.id_empresa,
      allowed_operations: args.allowed_operations
    };
    if (args.description !== undefined && args.description !== null) {
      body.description = args.description;
    }
    return _adminRequest('POST', '/internal/admin/clientes', body);
  }

  /**
   * GET /internal/admin/clientes (DR-1, DR-2)
   *
   * Lista per-company clients con filtros opcionales. NUNCA expone el
   * api_key_hash completo en el response (solo `api_key_hash_prefix` 8 chars).
   *
   * @param {object} [args]
   * @param {string} [args.id_empresa]       - filtro exacto (1-64 chars)
   * @param {boolean} [args.include_revoked] - default false
   * @param {number} [args.limit]            - 1-200, default 100
   * @param {number} [args.offset]           - >=0, default 0
   * @returns {Promise<{success,data}|{success:false,error}>}
   *   data: { total, limit, offset, items: [{id_empresa, api_key_hash_prefix,
   *           allowed_operations, description, created_at, revoked_at, is_active}] }
   */
  function adminListClients(args) {
    args = args || {};
    var params = [];
    if (args.id_empresa) params.push('id_empresa=' + encodeURIComponent(args.id_empresa));
    if (args.include_revoked === true) params.push('include_revoked=true');
    if (typeof args.limit === 'number' && args.limit > 0) {
      params.push('limit=' + encodeURIComponent(String(args.limit)));
    }
    if (typeof args.offset === 'number' && args.offset >= 0) {
      params.push('offset=' + encodeURIComponent(String(args.offset)));
    }
    var path = '/internal/admin/clientes' + (params.length > 0 ? '?' + params.join('&') : '');
    return _adminRequest('GET', path, null);
  }

  /**
   * GET /internal/admin/clientes/:id (DR-1, DR-2)
   *
   * Devuelve el cliente ACTIVO de la empresa `:id`. Si no hay activo y
   * `include_revoked=true`, devuelve todos (historial). Si no hay ninguno,
   * el backend retorna 404 CLIENT_NOT_FOUND.
   *
   * @param {string} id_empresa
   * @param {object} [opts]
   * @param {boolean} [opts.include_revoked]
   * @returns {Promise<{success,data}|{success:false,error}>}
   */
  function adminGetClient(id_empresa, opts) {
    if (!id_empresa || typeof id_empresa !== 'string') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id_empresa requerido (string)'));
    }
    opts = opts || {};
    var path = '/internal/admin/clientes/' + encodeURIComponent(id_empresa);
    if (opts.include_revoked === true) {
      path += '?include_revoked=true';
    }
    return _adminRequest('GET', path, null);
  }

  /**
   * GET /internal/admin/empresas/:id_empresa
   *
   * Lee la identificación completa de una empresa (la que se le muestra al
   * firmante). Es un endpoint admin distinto del de clientes: `clientes` es
   * la credencial de la empresa; `empresas` es su identidad legal.
   *
   * @param {string} id_empresa
   * @returns {Promise<{success,data}|{success:false,error}>}
   *   data: fila de gh_firma_empresas + huella_snapshot
   *   errors: EMPRESA_NOT_FOUND (404), ADMIN_TOKEN_REQUIRED
   */
  function adminGetEmpresa(id_empresa) {
    if (!id_empresa || typeof id_empresa !== 'string') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id_empresa requerido (string)'));
    }
    var path = '/internal/admin/empresas/' + encodeURIComponent(id_empresa);
    return _adminRequest('GET', path, null);
  }

  /**
   * PUT /internal/admin/empresas/:id_empresa
   *
   * Actualiza la identificación de una empresa. OJO: el service NO hace
   * merge. El body debe incluir TODOS los campos editables (incluido
   * `razon_social`) y `plazo_retencion_dias`; si falta uno, se guarda null.
   * El bridge arma ese body con `buildEmpresaUpdate()` después de un GET.
   *
   * @param {string} id_empresa
   * @param {object} body - body completo de updateEmpresaBody
   * @returns {Promise<{success,data}|{success:false,error}>}
   *   errors: EMPRESA_NOT_FOUND (404), INVALID_REQUEST_BODY, ADMIN_TOKEN_REQUIRED
   */
  function adminUpdateEmpresa(id_empresa, body) {
    if (!id_empresa || typeof id_empresa !== 'string') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id_empresa requerido (string)'));
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'body requerido (objeto)'));
    }
    var path = '/internal/admin/empresas/' + encodeURIComponent(id_empresa);
    return _adminRequest('PUT', path, body);
  }

  /**
   * POST /internal/admin/empresas
   *
   * Da de alta la identificación de una empresa. NO se usa todavía en el
   * flujo automático de Configuración: la empresa debe existir antes y tener
   * el Anexo de Encargo firmado. Se expone para operaciones administrativas
   * explícitas y para tests del contrato.
   *
   * @param {object} body - { id_empresa, razon_social, ... }
   * @returns {Promise<{success,data}|{success:false,error}>}
   *   errors: EMPRESA_ALREADY_EXISTS (409), INVALID_REQUEST_BODY, ADMIN_TOKEN_REQUIRED
   */
  function adminCreateEmpresa(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'body requerido (objeto)'));
    }
    if (!body.id_empresa || typeof body.id_empresa !== 'string') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id_empresa requerido (string)'));
    }
    if (!body.razon_social || typeof body.razon_social !== 'string') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'razon_social requerido (string)'));
    }
    return _adminRequest('POST', '/internal/admin/empresas', body);
  }

  // ===================================================================
  //  LOS ANEXOS · el flujo del operador (panel de la app de escritorio)
  // ===================================================================
  //
  //  El Anexo de Encargo (fase 1: la Empresa se suscribe) y el Anexo de
  //  Nube se suscriben por el MISMO camino: el operador abre la suscripción
  //  desde la app, el SERVICE manda el correo de invitación con el enlace,
  //  y la Empresa se suscribe en la pantalla web del servicio.
  //
  //  La contrafirma (fase 2 del Encargo) es el ACTO DE K+AIR: por eso
  //  vive en el lado admin y nunca en el lado de la Empresa.

  /**
   * GET /internal/empresa/anexos
   *
   * El estado del Anexo de Encargo y del Anexo de Nube de la Empresa
   * AUTENTICADA (la API key de esa Empresa, no la del operador).
   *
   * El service toma la Empresa de la identidad autenticada: esta llamada no
   * puede pedir los datos de otra empresa, ni siquiera por parámetro.
   *
   * @returns {Promise<{success,data}|{success:false,error}>}
   *   data: { id_empresa, anexo_encargo: { estado, suscrito_at, suscrito_version,
   *           suscrito_hash, firmado_at }, anexo_nube: { firmado, fecha, version,
   *           hash }, habilitacion: { ok, registrada, pendientes[], mensaje } }
   */
  function getEmpresaAnexos() {
    // `_doRequest` devuelve el Result crudo ({_isResponse, response}); el
    // parseo (y el mapeo de errores a `{success, error}`) lo hace
    // `_parseResult`, igual que en `getActiveAgreement`.
    return _doRequest('GET', '/internal/empresa/anexos', null, null)
      .then(function (r) { return _parseResult(r, 'application/json'); });
  }

  /**
   * GET /internal/admin/empresas
   *
   * El listado de Empresas con su estado de Anexos (`tiene_anexo`,
   * `tiene_anexo_suscrito` y `faltan_requeridos`). Es lo que pinta la tabla
   * del panel de operador.
   *
   * @returns {Promise<{success,data}|{success:false,error}>}
   *   data: { items: [{ id_empresa, razon_social, nit, tiene_anexo,
   *           tiene_anexo_suscrito, faltan_requeridos[], ... }] }
   */
  function adminListEmpresas() {
    return _adminRequest('GET', '/internal/admin/empresas', null);
  }

  /**
   * GET /internal/admin/empresas/:id_empresa/anexos
   *
   * El detalle de las suscripciones de los dos anexos de esa Empresa, con su
   * rastro de eventos. Es lo que permite al operador saber en que paso va
   * el flujo (sin necesidad de abrir la base).
   *
   * @param {string} id_empresa
   * @returns {Promise<{success,data}|{success:false,error}>}
   *   data: { id_empresa, anexo_encargo: { suscripcion, eventos[] },
   *           anexo_nube: { suscripcion, eventos[] } }
   */
  function adminGetEmpresaAnexos(id_empresa) {
    if (!id_empresa || typeof id_empresa !== 'string') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id_empresa requerido (string)'));
    }
    var path = '/internal/admin/empresas/' + encodeURIComponent(id_empresa) + '/anexos';
    return _adminRequest('GET', path, null);
  }

  /**
   * POST /internal/admin/empresas/:id_empresa/anexo-encargo/suscripcion
   *
   * Abre la suscripción del Anexo de Encargo. El SERVICE manda el correo de
   * invitación con el enlace de un solo uso (el código de verificación sale
   * aparte, a `canal_codigo`, que tiene que ser OTRO buzón).
   *
   * El enlace sale EN CLARO en la respuesta y no se puede recuperar despues
   * (la base solo guarda su HMAC): si el operador lo pierde, hay que anular
   * la suscripción y abrir otra.
   *
   * @param {string} id_empresa
   * @param {object} datos - { correo_firmante, canal_codigo,
   *   canal_codigo_confirmacion, nombre_firmante?, cargo_firmante?,
   *   datos_empresa? }
   * @returns {Promise<{success,data}|{success:false,error}>}
   *   data: { token, url, expira_en, version, hash, correo_firmante, datos_empresa }
   *   errors: EMPRESA_NOT_FOUND (404), INVALID_REQUEST_BODY, ANEXO_ENCARGO_NO_DISPONIBLE (503),
   *           ENVIO_FALLIDO (502)
   */
  function adminCrearSuscripcionAnexoEncargo(id_empresa, datos) {
    if (!id_empresa || typeof id_empresa !== 'string') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id_empresa requerido (string)'));
    }
    datos = datos || {};
    if (!datos.correo_firmante || typeof datos.correo_firmante !== 'string') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'correo_firmante requerido (string)'));
    }
    if (!datos.canal_codigo || typeof datos.canal_codigo !== 'string') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY',
        'canal_codigo requerido: el codigo no puede salir al mismo buzon del enlace'));
    }
    if (String(datos.canal_codigo).toLowerCase() === String(datos.correo_firmante).toLowerCase()) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY',
        'canal_codigo tiene que ser un buzon DISTINTO de correo_firmante: el enlace y el codigo no van al mismo canal'));
    }
    var body = {
      correo_firmante: datos.correo_firmante,
      canal_codigo: datos.canal_codigo,
      canal_codigo_confirmacion: datos.canal_codigo_confirmacion
    };
    if (datos.nombre_firmante) body.nombre_firmante = datos.nombre_firmante;
    if (datos.cargo_firmante) body.cargo_firmante = datos.cargo_firmante;
    if (datos.datos_empresa && typeof datos.datos_empresa === 'object') {
      body.datos_empresa = datos.datos_empresa;
    }
    var path = '/internal/admin/empresas/' + encodeURIComponent(id_empresa)
      + '/anexo-encargo/suscripcion';
    return _adminRequest('POST', path, body);
  }

  /**
   * POST /internal/admin/empresas/:id_empresa/anexo-nube/suscripcion
   *
   * Abre la suscripción del Anexo de Nube. A diferencia del Encargo, NO pide
   * `canal_codigo`: el Anexo de Nube no tiene fase de contrafirma.
   *
   * @param {string} id_empresa
   * @param {object} datos - { correo_firmante, nombre_firmante?, cargo_firmante? }
   * @returns {Promise<{success,data}|{success:false,error}>}
   *   data: { token, url, expira_en, version, hash, correo_firmante }
   */
  function adminCrearSuscripcionAnexoNube(id_empresa, datos) {
    if (!id_empresa || typeof id_empresa !== 'string') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id_empresa requerido (string)'));
    }
    datos = datos || {};
    if (!datos.correo_firmante || typeof datos.correo_firmante !== 'string') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'correo_firmante requerido (string)'));
    }
    var body = { correo_firmante: datos.correo_firmante };
    if (datos.nombre_firmante) body.nombre_firmante = datos.nombre_firmante;
    if (datos.cargo_firmante) body.cargo_firmante = datos.cargo_firmante;
    var path = '/internal/admin/empresas/' + encodeURIComponent(id_empresa)
      + '/anexo-nube/suscripcion';
    return _adminRequest('POST', path, body);
  }

  /**
   * POST /internal/admin/empresas/:id_empresa/anexo-encargo/suscripcion/:id/anular
   *
   * Da de baja una suscripción que todavía no se firmó. EXIGE `X-Admin-Motivo`:
   * sin el, el service responde 400 MOTIVO_REQUERIDO.
   *
   * @param {string} id_empresa
   * @param {number} id_suscripcion
   * @param {string} motivo
   * @returns {Promise<{success,data}|{success:false,error}>}
   *   errors: MOTIVO_REQUERIDO (400), SUSCRIPCION_NO_ENCONTRADA (404),
   *           YA_SUSCRITO (409)
   */
  function adminAnularSuscripcionAnexoEncargo(id_empresa, id_suscripcion, motivo) {
    var pre = _preAnexo(id_empresa, id_suscripcion, motivo);
    if (pre) return Promise.resolve(pre);
    var path = '/internal/admin/empresas/' + encodeURIComponent(id_empresa)
      + '/anexo-encargo/suscripcion/' + encodeURIComponent(String(id_suscripcion))
      + '/anular';
    return _adminRequest('POST', path, null, { 'X-Admin-Motivo': motivo });
  }

  /**
   * POST /internal/admin/empresas/:id_empresa/anexo-nube/suscripcion/:id/anular
   *
   * Da de baja la suscripción del Anexo de Nube. EXIGE `X-Admin-Motivo`.
   *
   * @param {string} id_empresa
   * @param {number} id_suscripcion
   * @param {string} motivo
   * @returns {Promise<{success,data}|{success:false,error}>}
   */
  function adminAnularSuscripcionAnexoNube(id_empresa, id_suscripcion, motivo) {
    var pre = _preAnexo(id_empresa, id_suscripcion, motivo);
    if (pre) return Promise.resolve(pre);
    var path = '/internal/admin/empresas/' + encodeURIComponent(id_empresa)
      + '/anexo-nube/suscripcion/' + encodeURIComponent(String(id_suscripcion))
      + '/anular';
    return _adminRequest('POST', path, null, { 'X-Admin-Motivo': motivo });
  }

  /**
   * POST .../anexo-encargo/suscripcion/:id/verificar-representante
   *
   * Registra la verificación DOCUMENTAL de quien firmó por la Empresa. Es un
   * requisito del abogado y una precondición de la contrafirma: sin ella el
   * service responde 409 REPRESENTANTE_NO_VERIFICADO.
   *
   * EXIGE `X-Admin-Motivo`.
   *
   * @param {string} id_empresa
   * @param {number} id_suscripcion
   * @param {object} datos - { tipo_documento, referencia, nota? }
   * @param {string} motivo
   * @returns {Promise<{success,data}|{success:false,error}>}
   *   errors: SUSCRIPCION_NO_FIRMADA (409), MOTIVO_REQUERIDO (400)
   */
  function adminVerificarRepresentante(id_empresa, id_suscripcion, datos, motivo) {
    var pre = _preAnexo(id_empresa, id_suscripcion, motivo);
    if (pre) return Promise.resolve(pre);
    datos = datos || {};
    if (!datos.tipo_documento) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'tipo_documento requerido'));
    }
    if (!datos.referencia) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'referencia requerido'));
    }
    var body = { tipo_documento: datos.tipo_documento, referencia: datos.referencia };
    if (datos.nota) body.nota = datos.nota;
    var path = '/internal/admin/empresas/' + encodeURIComponent(id_empresa)
      + '/anexo-encargo/suscripcion/' + encodeURIComponent(String(id_suscripcion))
      + '/verificar-representante';
    return _adminRequest('POST', path, body, { 'X-Admin-Motivo': motivo });
  }

  /**
   * POST .../anexo-encargo/contrafirmar/codigo
   *
   * Pide el código de contrafirma. El código sale al buzón de protección de
   * datos de K+AIR (NO al de la Empresa) y el service lo enmascara en la
   * respuesta. NO lleva `X-Admin-Motivo`: pedir el código no es contrafirmar.
   *
   * @param {string} id_empresa
   * @param {number} id_suscripcion
   * @returns {Promise<{success,data}|{success:false,error}>}
   *   data: { expira_en_segundos, canal }
   *   errors: REPRESENTANTE_NO_VERIFICADO (409), SUSCRIPCION_NO_FIRMADA (409),
   *           YA_CONTRAFIRMADO (409)
   */
  function adminPedirCodigoContrafirma(id_empresa, id_suscripcion) {
    if (!id_empresa || typeof id_empresa !== 'string') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id_empresa requerido (string)'));
    }
    if (!id_suscripcion) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id_suscripcion requerido'));
    }
    var path = '/internal/admin/empresas/' + encodeURIComponent(id_empresa)
      + '/anexo-encargo/contrafirmar/codigo';
    return _adminRequest('POST', path, { id_suscripcion: id_suscripcion });
  }

  /**
   * POST .../anexo-encargo/contrafirmar
   *
   * El SEGUNDO ACTO: K+AIR contrafirma el Anexo de Encargo. Con esto la
   * Empresa queda habilitada para firmar los documentos de sus trabajadores
   * (es lo que escribe `anexo_encargo_firmado_at`, la fecha de ejecución).
   *
   * EXIGE `X-Admin-Motivo`.
   *
   * @param {string} id_empresa
   * @param {number} id_suscripcion
   * @param {string} otp - los 6 digitos
   * @param {string} motivo
   * @returns {Promise<{success,data}|{success:false,error}>}
   *   errors: OTP_INVALIDO (400), REPRESENTANTE_NO_VERIFICADO (409),
   *           MOTIVO_REQUERIDO (400)
   */
  function adminContrafirmar(id_empresa, id_suscripcion, otp, motivo) {
    var pre = _preAnexo(id_empresa, id_suscripcion, motivo);
    if (pre) return Promise.resolve(pre);
    if (!otp || !/^\d{6}$/.test(String(otp))) {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'el codigo son 6 digitos'));
    }
    var path = '/internal/admin/empresas/' + encodeURIComponent(id_empresa)
      + '/anexo-encargo/contrafirmar';
    var body = { id_suscripcion: id_suscripcion, otp: String(otp), acepta: true };
    return _adminRequest('POST', path, body, { 'X-Admin-Motivo': motivo });
  }

  /**
   * Valida lo que las rutas de anexos exigen antes de gastar un HTTP: la
   * empresa, la suscripción y el MOTIVO (que va en `X-Admin-Motivo` y sin el
   * el service responde 400 MOTIVO_REQUERIDO y el acto no se registra).
   *
   * @returns {object|null} un error `_fail(...)` o null si todo esta bien.
   */
  function _preAnexo(id_empresa, id_suscripcion, motivo) {
    if (!id_empresa || typeof id_empresa !== 'string') {
      return _fail('INVALID_REQUEST_BODY', 'id_empresa requerido (string)');
    }
    if (!id_suscripcion) {
      return _fail('INVALID_REQUEST_BODY', 'id_suscripcion requerido');
    }
    if (!motivo || typeof motivo !== 'string' || !motivo.trim()) {
      return _fail('MOTIVO_REQUERIDO',
        'este acto exige un motivo: va en X-Admin-Motivo y queda en el rastro');
    }
    return null;
  }

  /**
   * POST /internal/admin/clientes/:id/rotate (DR-1, DR-4, DR-6.D)
   *
   * Rota la API key del cliente activo de la empresa `:id`. La key vieja
   * se marca como revocada. Retorna la NUEVA api_key en plaintext (UNA vez).
   *
   * @param {string} id_empresa
   * @param {object} [args]
   * @param {string} [args.motivo] - default 'Rotación programada'
   * @param {string} [args.actor]  - default 'admin'
   * @returns {Promise<{success,data}|{success:false,error}>}
   *   data: { id_empresa, old_api_key_hash_prefix, new_api_key,
   *           new_api_key_hash_prefix, allowed_operations, description,
   *           rotated_at, motivo, actor, message }
   *   errors: CLIENT_NOT_FOUND (404), INVALID_REQUEST_BODY
   */
  function adminRotateClient(id_empresa, args) {
    if (!id_empresa || typeof id_empresa !== 'string') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id_empresa requerido (string)'));
    }
    var body = {};
    if (args && typeof args === 'object') {
      if (typeof args.motivo === 'string') body.motivo = args.motivo;
      if (typeof args.actor === 'string') body.actor = args.actor;
    }
    var path = '/internal/admin/clientes/' + encodeURIComponent(id_empresa) + '/rotate';
    return _adminRequest('POST', path, body);
  }

  /**
   * Revoca el cliente activo de una empresa vía backend.
   *
   * En V1, "revocar" se hace así: borrar la key en `secrets.enc` local +
   * opcionalmente rotar en backend (la rotación SÍ marca la key vieja como
   * revocada). El endpoint `DELETE /internal/admin/clientes/:id` queda
   * para V2 (DR-4).
   *
   * Esta función NO está expuesta como IPC del bridge (DR-4: V1 = borrar
   * local + opcionalmente rotar). Se exporta solo para que el bridge pueda
   * coordinar la rotación al revocar.
   *
   * @param {string} id_empresa
   * @returns {Promise<{success,data}|{success:false,error}>}
   */
  function adminRevokeClient(id_empresa) {
    // V1: revocar = rotar (DR-4). La rotación marca la key vieja como
    // revocada. NO hay endpoint DELETE en V1.
    if (!id_empresa || typeof id_empresa !== 'string') {
      return Promise.resolve(_fail('INVALID_REQUEST_BODY', 'id_empresa requerido (string)'));
    }
    return adminRotateClient(id_empresa, {
      motivo: 'Revocación manual (V1: usa rotate para marcar como revocada)',
      actor: 'admin'
    });
  }

  return {
    createSignRequest: createSignRequest,
    getSignRequest: getSignRequest,
    listSignRequests: listSignRequests,
    getSignRequestDocument: getSignRequestDocument,
    getSignRequestConstancia: getSignRequestConstancia,
    getExpedienteConstanciaConsolidada: getExpedienteConstanciaConsolidada,
    getSignRequestLink: getSignRequestLink,
    notifySignRequestRemote: notifySignRequestRemote,  // I-103.A1.5.2
    resendSignRequestOtp: resendSignRequestOtp,  // I-103.A1.6.B
    getSignRequestEvents: getSignRequestEvents,  // Trazabilidad (audit:read)
    createConsent: createConsent,
    verifyConsentOtp: verifyConsentOtp,
    getActiveAgreement: getActiveAgreement,
    // Admin endpoints (per-company clients) — DR-1..6
    adminCreateClient: adminCreateClient,
    adminListClients: adminListClients,
    adminGetClient: adminGetClient,
    // Identidad legal de la empresa (no confundir con el cliente/credencial).
    adminCreateEmpresa: adminCreateEmpresa,
    adminGetEmpresa: adminGetEmpresa,
    adminUpdateEmpresa: adminUpdateEmpresa,
    adminRotateClient: adminRotateClient,
    adminRevokeClient: adminRevokeClient,
    // Los anexos: el flujo del operador (admin key) y el estado que ve el
    // cliente (la key de la Empresa).
    getEmpresaAnexos: getEmpresaAnexos,
    adminListEmpresas: adminListEmpresas,
    adminGetEmpresaAnexos: adminGetEmpresaAnexos,
    adminCrearSuscripcionAnexoEncargo: adminCrearSuscripcionAnexoEncargo,
    adminCrearSuscripcionAnexoNube: adminCrearSuscripcionAnexoNube,
    adminAnularSuscripcionAnexoEncargo: adminAnularSuscripcionAnexoEncargo,
    adminAnularSuscripcionAnexoNube: adminAnularSuscripcionAnexoNube,
    adminVerificarRepresentante: adminVerificarRepresentante,
    adminPedirCodigoContrafirma: adminPedirCodigoContrafirma,
    adminContrafirmar: adminContrafirmar,
    // Expose for tests
    _internals: {
      _buildHeaders: _buildHeaders,
      _buildAdminHeaders: _buildAdminHeaders,
      _mapBackendError: _mapBackendError,
      baseUrl: baseUrl
    }
  };
}

// =====================================================================
//  client_instance_id generator (persiste en secrets.enc via el bridge)
// =====================================================================

/**
 * Genera un UUID v4 fresh. Separado del factory para testeo y reuse.
 */
function generateClientInstanceId() {
  return randomUUID();
}

module.exports = {
  createFirmaClient: createFirmaClient,
  generateClientInstanceId: generateClientInstanceId,
  // Exportar helpers internos SOLO para tests
  _internals: {
    _mapBackendError: _mapBackendError,
    _httpToCode: _httpToCode,
    _httpToMessage: _httpToMessage,
    _getRetryAfterMs: _getRetryAfterMs,
    DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
    UPLOAD_TIMEOUT_MS: UPLOAD_TIMEOUT_MS,
    MAX_RETRIES_429: MAX_RETRIES_429
  }
};
