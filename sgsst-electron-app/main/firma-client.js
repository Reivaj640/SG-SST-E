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

  return {
    createSignRequest: createSignRequest,
    getSignRequest: getSignRequest,
    listSignRequests: listSignRequests,
    getSignRequestDocument: getSignRequestDocument,
    getSignRequestConstancia: getSignRequestConstancia,
    getSignRequestLink: getSignRequestLink,
    createConsent: createConsent,
    verifyConsentOtp: verifyConsentOtp,
    getActiveAgreement: getActiveAgreement,
    // Expose for tests
    _internals: { _buildHeaders: _buildHeaders, _mapBackendError: _mapBackendError, baseUrl: baseUrl }
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
