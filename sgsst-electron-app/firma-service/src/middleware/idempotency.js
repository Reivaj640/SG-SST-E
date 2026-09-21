/**
 * Middleware: requireIdempotencyKey (I-003.3, capa HTTP sobre I-003.2).
 *
 * Este middleware NO reemplaza al handler: lo envuelve. La capa de dominio
 * (idempotency.js) sigue siendo la fuente de verdad de la fila, de la
 * máquina de estados, y del fingerprint. Este archivo es SOLO la traducción
 * HTTP ↔ dominio:
 *
 *   1. Lee el header `Idempotency-Key` (case-insensitive, Express normaliza).
 *   2. Si NO viene → `next()` inmediatamente (compat G3: clientes sin el
 *      header siguen funcionando como antes).
 *   3. Si viene → llama a `idempotency.getOrCreate(...)` y, según el
 *      resultado, hace una de tres cosas:
 *
 *        - `isReplay: true` → NO ejecuta el handler. Devuelve la respuesta
 *          cacheada (`response_status` + `response_body`) con el header
 *          `X-Idempotency-Replay: true`. Esta es la semántica de replay
 *          (G9): idempotente, mismo resultado siempre.
 *
 *        - `isNew: true` o `isRetry: true` → adjunta `req.idempotency` y
 *          `res.idempotency` para que el handler decida si quiere marcar
 *          TERMINAL explícitamente (G8 refinado). Hookea `res.on('finish')`
 *          para llamar a `markComplete` (2xx), `markFailed` (4xx default),
 *          `markTerminal` (4xx con opt-in), o NO hacer nada (5xx / uncaught).
 *          Llama a `next()` para que el handler corra.
 *
 *   4. Mapea los errores tipados del service a `AppError` para que el
 *      `errorHandler` central los serialice con el formato estándar.
 *
 * Mapeo de errores (HTTP):
 *
 *   IdempotencyKeyInvalid        → AppError(400, 'IDEMPOTENCY_KEY_INVALID', ...)
 *   IdempotencyKeyConflict       → AppError(409, 'IDEMPOTENCY_KEY_CONFLICT', ...)
 *   IdempotencyKeyInProgress     → AppError(409, 'IDEMPOTENCY_KEY_IN_PROGRESS', ...)
 *                                   + `Retry-After: <seconds>` header
 *   IdempotencyKeyTerminal       → AppError(409, 'IDEMPOTENCY_KEY_TERMINAL', ...)
 *   Otro IdempotencyError        → AppError(400, <code>, ...) (defensivo;
 *                                   no debería pasar con uso correcto, pero
 *                                   no leakeamos el error crudo al cliente).
 *
 * Regla "no blanket FAILED" (G8 refinado, decisión crítica):
 *
 *   En 5xx o cuando el handler tira una excepción no manejada, el middleware
 *   NO llama a `markFailed`. La fila queda PENDING. La recuperación se hace
 *   por el in-flight timeout de 5 minutos: la próxima request que llegue
 *   con la misma key verá el PENDING viejo (>5min) y será tratada como
 *   crash → retry limpio.
 *
 *   ¿Por qué? Porque un 5xx puede ser transitorio (DB hiccup, red, etc.) y
 *   marcar FAILED impediría un replay exitoso cuando el problema se
 *   resuelva. La fila PENDING con timeout es el mecanismo de recuperación
 *   correcto.
 *
 *   Por contraste, en 4xx el handler tiene la opción explícita de llamar a
 *   `res.idempotency.terminal(body, status)` ANTES de responder, lo que
 *   indica que el error es de negocio (no transitorio) y que el retry debe
 *   ser bloqueado. Si no se hace ese opt-in, el default es FAILED (retry
 *   permitido, response NO cacheada).
 *
 * Scope por id_empresa (G4):
 *
 *   `req.id_empresa` DEBE estar seteado por la authz (requireEmpresaScope,
 *   I-010) ANTES de llegar a este middleware. Si por algún bug no lo
 *   está, fallamos CERRADO con 500 INTERNAL_ERROR (defense in depth): es
 *   un bug interno, no un error del cliente. No queremos aceptar una key
 *   sin scope definido porque eso violaría la garantía de aislamiento
 *   por empresa.
 *
 * PII en logs:
 *
 *   Este middleware NO loguea el body del request. Solo loguea:
 *   - `idempotency_key` (primeros 8 chars)
 *   - `id_empresa` (ya está en SENSITIVE_KEYS del logger → redactado)
 *   - `state` (PENDING → COMPLETED|FAILED|TERMINAL)
 *   - `status_code` (HTTP status)
 *   - `request_id` (para correlación con el errorHandler)
 *
 * Composición típica (ver I-005 / routes/signRequest.js):
 *
 *   app.post(
 *     '/v1/internal/sign-requests',
 *     requestId(),
 *     requireEmpresaScopeAndLimit({ ... }),
 *     requireIdempotencyKey({ extractMetadata: req => req.body }),
 *     validate(schema),
 *     handler,
 *   );
 *
 * Tests: tests/middleware/idempotency.test.js (16 secciones, ~30-35 tests).
 */
'use strict';

const idempotency = require('../services/idempotency');
const { AppError } = require('./errors');
const logger = require('../utils/logger');

// =============================================================================
// Constantes internas
// =============================================================================

const DEFAULT_KEY_HEADER = 'Idempotency-Key';

// =============================================================================
// _mapServiceError: traduce errores del service a AppError HTTP
// =============================================================================
//
// Esta función es la frontera de la traducción HTTP. Cualquier error nuevo
// que se agregue al service DEBE ser manejado acá explícitamente (o caer
// al default `OTHER_IDEMPOTENCY_ERROR` → 400 con el code del service).
//
// Importante: solo se traduce `err.code` (string) a `error.code` (string
// en la respuesta). NO se loguea el body del request (PII). Se loguea
// `err.message` porque el logger redacta automáticamente PII embebida.
//
// @param {Error} err - Error tipado del service (subclase de IdempotencyError)
// @returns {AppError} mapeado al HTTP status correcto
function _mapServiceError(err) {
  // Orden importa: las subclases son chequeadas antes que la base.
  if (err instanceof idempotency.IdempotencyKeyInvalid) {
    return new AppError(
      400,
      'IDEMPOTENCY_KEY_INVALID',
      err.message,
      err.details
    );
  }
  if (err instanceof idempotency.IdempotencyKeyInProgress) {
    return new AppError(
      409,
      'IDEMPOTENCY_KEY_IN_PROGRESS',
      err.message,
      err.details
    );
  }
  if (err instanceof idempotency.IdempotencyKeyTerminal) {
    return new AppError(
      409,
      'IDEMPOTENCY_KEY_TERMINAL',
      err.message,
      err.details
    );
  }
  if (err instanceof idempotency.IdempotencyKeyConflict) {
    return new AppError(
      409,
      'IDEMPOTENCY_KEY_CONFLICT',
      err.message,
      err.details
    );
  }
  if (err instanceof idempotency.IdempotencyError) {
    // Defensivo: si el service agrega un code nuevo (ej. IDEMPOTENCY_KEY_NOT_FOUND,
    // INVALID_REQUEST), no leakeamos el error crudo al cliente pero preservamos
    // el code para diagnóstico.
    return new AppError(
      400,
      err.code || 'IDEMPOTENCY_ERROR',
      err.message,
      err.details
    );
  }
  // Error NO esperado del service. Pasarlo tal cual al errorHandler central;
  // se logueará como 500 INTERNAL_ERROR.
  return err;
}

// =============================================================================
// requireIdempotencyKey: factory principal
// =============================================================================

/**
 * Crea el middleware `requireIdempotencyKey`.
 *
 * Comportamiento:
 *   1. Lee `Idempotency-Key` del header. Si NO está → `next()` sin tocar BD.
 *   2. Si está → llama a `idempotency.getOrCreate(...)` con
 *      `idempotency_key`, `id_empresa` (de `req.id_empresa`), `metadata`
 *      (extraído vía `extractMetadata`) y `pdf_sha256` (extraído vía
 *      `extractPdfSha256`).
 *   3. Según el resultado:
 *      - `isReplay: true` → escribe la respuesta cacheada + `X-Idempotency-Replay: true`.
 *      - `isNew: true` / `isRetry: true` → adjunta `req.idempotency` y
 *        `res.idempotency`, hookea `res.on('finish')` para marcar el estado
 *        final, llama a `next()`.
 *      - `isExpired: true` (TTL 24h) → se comporta como `isNew` (fila
 *        nueva, sin cache). Esto es la rama de recuperación por TTL.
 *   4. Errores del service → `next(err)` con `_mapServiceError(err)`.
 *
 * @param {object} [options]
 * @param {function(req): object} [options.extractMetadata]
 *        Función que extrae el metadata del request. Default: `req.body || {}`.
 *        Se llama ANTES de `next()` (durante la fase de check). Si el body
 *        aún no fue parseado (express.json no se montó), `req.body` es
 *        `undefined` → usamos `{}` como fallback.
 * @param {function(req): string} [options.extractPdfSha256]
 *        Función que extrae el SHA-256 del PDF. Default: `req.body?.pdf_sha256`.
 *        Si retorna `undefined` o string vacío, el service tirará
 *        `IdempotencyError(INVALID_REQUEST)` → 400.
 * @param {string} [options.keyHeader='Idempotency-Key']
 *        Nombre del header a leer. Default canónico de Stripe/RFC. Express
 *        normaliza el header a minúsculas en `req.get(...)`.
 * @returns {function} middleware Express `(req, res, next) => void`
 */
function requireIdempotencyKey(options = {}) {
  const {
    extractMetadata = (req) => (req.body && typeof req.body === 'object' ? req.body : {}),
    extractPdfSha256 = (req) => (req.body && typeof req.body === 'object' ? req.body.pdf_sha256 : undefined),
    keyHeader = DEFAULT_KEY_HEADER,
  } = options;

  return function idempotencyMiddleware(req, res, next) {
    // -------------------------------------------------------------------
    // Paso 1: leer el header. Si no viene, NO hacemos nada (G3).
    // -------------------------------------------------------------------
    // Express normaliza los headers a lowercase. `req.get('Idempotency-Key')`
    // funciona igual que `req.get('idempotency-key')`.
    //
    // Distinguimos "header ausente" (undefined → next() sin tocar BD, G3)
    // de "header presente pero vacío" ('' → 400 IDEMPOTENCY_KEY_INVALID).
    // Un cliente que manda `Idempotency-Key:` con valor vacío está
    // intentando usar idempotencia con key inválida — NO es lo mismo que
    // no mandar el header.
    const idempotencyKey = req.get(keyHeader);
    if (idempotencyKey === undefined || idempotencyKey === null) {
      return next();
    }

    // -------------------------------------------------------------------
    // I-005: legacy mode (INTERNAL_API_KEY deprecation, I-010) no soporta
    // Idempotency-Key. La razón: requireIdempotencyKey requiere
    // req.id_empresa no vacío (defense in depth del Paso 2 más abajo), y
    // en legacy mode id_empresa es null por diseño. Sin este check
    // explícito, el cliente legacy recibiría 500 INTERNAL_ERROR (que parece
    // un fallo del servidor). Mejor documentar la incompatibilidad con
    // un 400 explícito para que K+AIR sepa que debe migrar a per-empresa
    // key para usar idempotencia.
    //
    // Este check NO afecta a clientes per-empresa (authSource='client'):
    // el flujo normal continúa con el Paso 2.
    //
    // Preserva backward compat (G3): legacy + SIN header → next() (sin
    // tocar BD), comportamiento histórico intacto.
    // -------------------------------------------------------------------
    if (req.authSource === 'legacy') {
      logger.info('Idempotency middleware: legacy mode no soporta Idempotency-Key', {
        request_id: req.id,
        idempotency_key_prefix: idempotencyKey.slice(0, 8),
        authSource: 'legacy',
      });
      return next(new AppError(
        400,
        'IDEMPOTENCY_LEGACY_NOT_SUPPORTED',
        'Idempotency-Key no soportado en legacy mode. K+AIR debe migrar a per-empresa key (I-010) para usar idempotencia.',
        { reason: 'legacy_mode_unsupported' }
      ));
    }

    // -------------------------------------------------------------------
    // Paso 2: verificar req.id_empresa. Defense in depth.
    // -------------------------------------------------------------------
    // requireEmpresaScope (I-010) DEBE haber corrido antes. Si no, es un
    // bug de composición de middlewares. Fallamos CERRADO con 500 — esto
    // es defensa en profundidad, no un error del cliente.
    const idEmpresa = req.id_empresa;
    if (typeof idEmpresa !== 'string' || idEmpresa.length === 0) {
      logger.error('requireIdempotencyKey: req.id_empresa missing (authz no corrió?)', {
        request_id: req.id,
        path: req.path,
        method: req.method,
      });
      return next(new AppError(
        500,
        'INTERNAL_ERROR',
        'Error interno: id_empresa no resuelto por la capa de autorización',
        { reason: 'id_empresa_missing' }
      ));
    }

    // -------------------------------------------------------------------
    // Paso 3: extraer metadata y pdf_sha256 ANTES de llamar al service.
    // -------------------------------------------------------------------
    // Estos extractors pueden fallar silenciosamente (body no parseado) →
    // usamos defaults seguros (metadata = {}, pdf_sha256 = undefined).
    let metadata;
    try {
      metadata = extractMetadata(req);
    } catch (_extractErr) {
      // Si el extractor tira algo, tratar como metadata vacío.
      // NO dejamos que un extractor roto bloquee la request entera —
      // el service manejará pdf_sha256 missing con INVALID_REQUEST.
      metadata = {};
    }
    if (metadata === null || metadata === undefined) metadata = {};

    let pdfSha256;
    try {
      pdfSha256 = extractPdfSha256(req);
    } catch (_extractErr) {
      pdfSha256 = undefined;
    }

    // -------------------------------------------------------------------
    // Paso 4: llamar al service.
    // -------------------------------------------------------------------
    let result;
    try {
      result = idempotency.getOrCreate({
        id_empresa: idEmpresa,
        idempotency_key: idempotencyKey,
        metadata,
        pdf_sha256: pdfSha256,
      });
    } catch (err) {
      // Mapear el error del service a AppError HTTP.
      const mapped = _mapServiceError(err);

      // Caso especial: IN_PROGRESS necesita el header Retry-After.
      // Lo seteamos en la response ANTES de pasar al errorHandler central.
      if (err instanceof idempotency.IdempotencyKeyInProgress) {
        const retryAfter = (err.details && typeof err.details.retry_after === 'number')
          ? err.details.retry_after
          : 1;
        // Math.max(1, ...) porque el cliente asume >= 1s.
        res.set('Retry-After', String(Math.max(1, Math.floor(retryAfter))));
      }

      logger.info('Idempotency middleware: error del service', {
        request_id: req.id,
        idempotency_key_prefix: idempotencyKey.slice(0, 8),
        code: err.code,
        // NO logueamos metadata ni pdf_sha256 (PII / fingerprint leak).
      });

      return next(mapped);
    }

    // -------------------------------------------------------------------
    // Paso 5: actuar según el resultado de getOrCreate.
    // -------------------------------------------------------------------

    // 5a. REPLAY: servir respuesta cacheada, NO ejecutar handler.
    if (result.isReplay) {
      const cachedBody = _parseResponseBody(result.row.response_body);
      res.set('X-Idempotency-Replay', 'true');
      logger.info('Idempotency REPLAY (no se ejecuta el handler)', {
        request_id: req.id,
        idempotency_key_prefix: idempotencyKey.slice(0, 8),
        response_status: result.row.response_status,
      });
      return res.status(result.row.response_status).json(cachedBody);
    }

    // 5b. NEW / RETRY / EXPIRED-as-new: ejecutar handler, capturar el resultado.
    // - isNew: primera vez con esta key. La fila PENDING está recién creada.
    // - isRetry: el request anterior falló (FAILED), se reintenta con mismo fingerprint.
    // - isExpired: TTL 24h o in-flight timeout (>5min) → fila nueva limpia.
    //   (El service retorna isExpired: true + wasNewlyCreated: true; desde
    //   el punto de vista del middleware, esto es equivalente a un NEW.)
    if (result.isNew || result.isRetry || result.isExpired) {
      _attachIdempotencyContext(req, res, {
        id_empresa: idEmpresa,
        idempotency_key: idempotencyKey,
        fingerprint: result.fingerprint,
        state: 'pending',
      });

      // Hook del lifecycle: cuando la response sale, decidimos el estado
      // final de la fila (COMPLETED / FAILED / TERMINAL / nada).
      _hookResponseFinish(req, res, {
        id_empresa: idEmpresa,
        idempotency_key: idempotencyKey,
      });

      logger.info('Idempotency middleware: handler ejecutará', {
        request_id: req.id,
        idempotency_key_prefix: idempotencyKey.slice(0, 8),
        state: 'pending',
        is_retry: !!result.isRetry,
        is_expired: !!result.isExpired,
      });

      return next();
    }

    // 5c. Resultado inesperado: el service nunca retorna otra cosa que
    // isNew/isReplay/isRetry/isExpired. Si llegamos acá, es un bug del
    // service o un cambio retrocompatible que no actualizamos. Log + 500.
    logger.error('requireIdempotencyKey: resultado inesperado del service', {
      request_id: req.id,
      idempotency_key_prefix: idempotencyKey.slice(0, 8),
      result_keys: Object.keys(result),
    });
    return next(new AppError(
      500,
      'INTERNAL_ERROR',
      'Error interno: resultado inesperado del servicio de idempotencia',
      { reason: 'unexpected_getorcreate_result' }
    ));
  };
}

// =============================================================================
// _attachIdempotencyContext
// =============================================================================
//
// Adjunta dos objetos que el handler puede inspeccionar:
//
//   - `req.idempotency` (read-only-ish, metadata de la request):
//       { id_empresa, idempotency_key, fingerprint, state }
//
//   - `res.idempotency` (control de lifecycle):
//       {
//         terminal(body, statusCode) → marca que la response 4xx debe
//           guardarse como TERMINAL (bloquea retry, G8 refinado). El
//           handler DEBE llamar a esta función ANTES de `res.json(...)`.
//       }
//
// El handler PUEDE inspeccionar `req.idempotency.state` (siempre 'pending'
// en este momento; el state final lo decide el lifecycle hook en finish).
//
// Importante: el handler NO debe mutar `req.idempotency` ni `res.idempotency`
// salvo vía `res.idempotency.terminal(...)`. Si lo hace, la garantía de
// consistencia con la fila de BD se pierde.
function _attachIdempotencyContext(req, res, ctx) {
  req.idempotency = Object.freeze({
    id_empresa: ctx.id_empresa,
    idempotency_key: ctx.idempotency_key,
    fingerprint: ctx.fingerprint,
    state: ctx.state,
  });

  let terminalSet = false;
  res.idempotency = {
    /**
     * Opt-in: marca que la response 4xx actual es TERMINAL (decisión de
     * negocio, no transitoria). Debe llamarse ANTES de `res.json(...)`.
     *
     * Si el handler llama a esta función, el lifecycle hook (en 'finish')
     * usará markTerminal (con body cacheado) en lugar de markFailed.
     *
     * Si el handler NO llama a esta función, el default es markFailed
     * (retry permitido, sin cache de body).
     *
     * @param {object} body - el body que se va a enviar (o uno nuevo)
     * @param {number} statusCode - HTTP status code del response
     */
    terminal: function (body, statusCode) {
      if (terminalSet) return; // idempotente: la segunda llamada no-op
      terminalSet = true;
      res.idempotency._terminalBody = body;
      res.idempotency._terminalStatus = statusCode;
    },
    // Flags internos (no documentados para el handler):
    _terminalSet: () => terminalSet,
  };
}

// =============================================================================
// _hookResponseFinish
// =============================================================================
//
// Se engancha a `res.on('finish', ...)` para decidir el estado final de la
// fila cuando la response sale al cliente. La decisión se basa en:
//
//   1. `res.statusCode` (2xx / 4xx / 5xx).
//   2. Si el handler llamó a `res.idempotency.terminal(body, status)` (opt-in).
//   3. Si el handler tiró una excepción (uncaught → 'close' fires too).
//
// Importante: el hook corre DESPUÉS de que la response ya se envió al
// cliente. Por eso envolvemos las llamadas a mark* en try/catch y logueamos
// en warn si fallan — NO queremos que un error en la limpieza de BD
// enmascare la response que ya salió.
//
// Reglas:
//
//   2xx (200-299)          → markComplete(status, body)
//   4xx (400-499) + opt-in → markTerminal(status, body)
//   4xx (400-499) sin opt  → markFailed() (no body)
//   5xx (500-599)          → NO mark. La fila queda PENDING.
//                            El in-flight timeout (5 min) recupera.
//   Uncaught (throw)       → NO mark. Igual que 5xx.
//
// El body se captura interceptando `res.json(...)` (ver `_wrapJsonCapture`).
// Si el handler NO llama a `res.json(...)` (caso raro: `res.send(string)`,
// `res.end()` sin body), `_capturedBody` queda `undefined` y usamos `null`.
//
// ¿Por qué NO marcar FAILED en 5xx? Ver el docstring del archivo
// ("Regla no blanket FAILED").
function _hookResponseFinish(req, res, ctx) {
  const captured = _wrapJsonCapture(res);
  // Marcamos la fila cuando la response termina (exitosa o no).
  res.on('finish', () => {
    _onResponseFinish(req, res, ctx, captured);
  });
  // Si el handler TIRA una excepción no manejada, Express llamará al
  // errorHandler que serializará un 500. Eventualmente 'finish' también
  // dispara (Express hace `res.end()` después del error handler). Pero
  // por si el error corta el pipeline y 'finish' NO dispara, también
  // escuchamos 'close' (que siempre dispara, exitosa o no).
  res.on('close', () => {
    // Solo actuar si 'finish' no disparó ya (Express usualmente emite
    // finish antes de close, pero por las dudas).
    if (!res.writableFinished) {
      _onResponseFinish(req, res, ctx, captured);
    }
  });
}

// =============================================================================
// _wrapJsonCapture
// =============================================================================
//
// Reemplaza `res.json(body)` por una versión que también guarda `body` en
// una variable accesible desde el lifecycle hook. Devuelve un getter
// `getBody()` que retorna el body capturado (o `null` si nunca se llamó
// a `res.json(...)`).
//
// ¿Por qué interceptar `res.json`? Porque el handler típicamente hace:
//
//     res.status(201).json({ id: '...' });
//
// y queremos ese body para el mark* final.
//
// Compatible con `res.status(n).json(body)`: nuestro wrapper guarda body
// Y llama al `res.json` original (que ya respeta el status code seteado
// por el handler).
function _wrapJsonCapture(res) {
  let captured = undefined;
  const originalJson = res.json.bind(res);
  res.json = function jsonCapture(body) {
    captured = body;
    return originalJson(body);
  };
  return {
    getBody: () => captured,
  };
}

// =============================================================================
// _onResponseFinish: lógica de decisión del estado final
// =============================================================================
//
// Llamado desde el hook de 'finish'/'close'. Decide qué `mark*` llamar.
//
// Notas de robustez:
//   - Si 'finish' y 'close' ambos disparan, solo el primero actúa (idempotente).
//   - Si el mark* tira, NO propagamos (la response ya salió al cliente).
function _onResponseFinish(req, res, ctx, captured) {
  // Idempotencia del hook: si ya procesamos esta response, no hacer nada.
  if (res._idempotencyMarked) return;
  res._idempotencyMarked = true;

  const statusCode = res.statusCode;
  const body = captured.getBody();

  // 5xx o sin status: no marcar (regla "no blanket FAILED").
  if (statusCode >= 500) {
    logger.warn('Idempotency: 5xx/uncaught, fila queda PENDING (in-flight timeout recuperará)', {
      request_id: req.id,
      idempotency_key_prefix: ctx.idempotency_key.slice(0, 8),
      status: statusCode,
    });
    return;
  }

  // 2xx: COMPLETED, con body cacheado.
  if (statusCode >= 200 && statusCode < 300) {
    try {
      idempotency.markComplete({
        id_empresa: ctx.id_empresa,
        idempotency_key: ctx.idempotency_key,
        response_status: statusCode,
        response_body: body === undefined ? null : body,
      });
    } catch (markErr) {
      logger.error('Idempotency: markComplete falló (response ya salió)', {
        request_id: req.id,
        idempotency_key_prefix: ctx.idempotency_key.slice(0, 8),
        error: markErr.message,
        code: markErr.code,
      });
    }
    return;
  }

  // 3xx: no esperado en endpoints de firma. Lo tratamos como "no marcar"
  // (no es error, pero no es 2xx). Log defensivo.
  if (statusCode >= 300 && statusCode < 400) {
    logger.warn('Idempotency: 3xx inesperado, fila queda PENDING', {
      request_id: req.id,
      idempotency_key_prefix: ctx.idempotency_key.slice(0, 8),
      status: statusCode,
    });
    return;
  }

  // 4xx: TERMINAL si opt-in, si no FAILED.
  if (statusCode >= 400 && statusCode < 500) {
    if (res.idempotency && res.idempotency._terminalSet && res.idempotency._terminalSet()) {
      // Opt-in: TERMINAL. Usamos el body explícito (que puede diferir del
      // body que se va a enviar — el handler decide qué guardar).
      const terminalBody = res.idempotency._terminalBody !== undefined
        ? res.idempotency._terminalBody
        : body;
      const terminalStatus = typeof res.idempotency._terminalStatus === 'number'
        ? res.idempotency._terminalStatus
        : statusCode;
      try {
        idempotency.markTerminal({
          id_empresa: ctx.id_empresa,
          idempotency_key: ctx.idempotency_key,
          response_status: terminalStatus,
          response_body: terminalBody === undefined ? null : terminalBody,
        });
      } catch (markErr) {
        logger.error('Idempotency: markTerminal falló (response ya salió)', {
          request_id: req.id,
          idempotency_key_prefix: ctx.idempotency_key.slice(0, 8),
          error: markErr.message,
          code: markErr.code,
        });
      }
    } else {
      // Default: FAILED. Retry permitido, sin cache de body.
      try {
        idempotency.markFailed({
          id_empresa: ctx.id_empresa,
          idempotency_key: ctx.idempotency_key,
        });
      } catch (markErr) {
        logger.error('Idempotency: markFailed falló (response ya salió)', {
          request_id: req.id,
          idempotency_key_prefix: ctx.idempotency_key.slice(0, 8),
          error: markErr.message,
          code: markErr.code,
        });
      }
    }
    return;
  }

  // Status fuera de rango (1xx raro, etc.). Defensivo: no marcar.
  logger.warn('Idempotency: status fuera de rango, fila queda PENDING', {
    request_id: req.id,
    idempotency_key_prefix: ctx.idempotency_key.slice(0, 8),
    status: statusCode,
  });
}

// =============================================================================
// _parseResponseBody
// =============================================================================
//
// El service guarda `response_body` como JSON string. Para REPLAY tenemos
// que parsearlo de vuelta a objeto. Si por algún motivo el JSON está
// corrupto (no debería pasar, fue escrito por `JSON.stringify` en
// markComplete/markTerminal), caemos a un fallback seguro.
//
// @param {string|null|undefined} raw
// @returns {object|null}
function _parseResponseBody(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch (_parseErr) {
    logger.error('Idempotency: response_body corrupto en BD (no se puede parsear)', {
      body_length: raw.length,
    });
    return null;
  }
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  requireIdempotencyKey,
  // Exportados para tests / debugging.
  _parseResponseBody,
  _mapServiceError,
};
