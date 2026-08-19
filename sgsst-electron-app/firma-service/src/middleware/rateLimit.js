/**
 * Middleware: rate limiting.
 *
 * Implementa 5 limiters diferenciados usando express-rate-limit v7.x.
 *
 * | Limiter            | Ventana | Max | Key                                       | Aplica a                                       |
 * |--------------------|---------|-----|-------------------------------------------|------------------------------------------------|
 * | globalLimiter      | 1 min   | 60  | req.ip                                    | Todas las rutas excepto /health y /internal/*  |
 * | otpLimiter         | 1 hora  | 10  | req.ip + ':' + req.params.token           | POST /api/sign/:token/verify-otp               |
 * | commitLimiter      | 1 min   | 3   | req.ip + ':' + req.params.token           | POST /api/sign/:token/commit                   |
 * | signRequestLimiter | 1 min   | 30  | req.ip                                    | POST /internal/sign-requests (defensa adicional)|
 * | internalCapa1      | 1 hora  | 720 | req.id_empresa                            | /internal/* (por empresa, autoritativa)        |
 * | internalCapa2      | 1 hora  | 240 | req.id_empresa + X-Client-Instance-Id      | /internal/* (por empresa + instance, opcional) |
 * | internalCapa3      | 1 hora  | 480 | req.ip                                    | /internal/* (fallback, legacy mode)            |
 * | (Capa 4 anomalía)  | 24h     | 10  | req.id_empresa + set de instance ids      | /internal/* (heurística en memoria)            |
 *
 * I-008 (C-20 v5): el `internalServerLimiter` ENCADENA las 4 capas de
 * rate limit para /internal/*. Se aplica dentro de cada router vía
 * `requireEmpresaScopeAndLimit()`, NO a nivel de server.js. Razones:
 *   - El rate limit necesita `req.id_empresa` (seteado por authz).
 *   - El rate limit necesita `X-Client-Instance-Id` opcional.
 *   - Si se aplicara antes de authz, no podría usar id_empresa.
 *
 * Razón del keyGenerator IP+token en otp y commit:
 *   Sin esto, un atacante con un solo OTP podría intentar validarlo contra
 *   miles de sign requests distintos. Con IP+token, cada (IP,token) tiene
 *   su propio cubo, y el atacante queda limitado a 10/h y 3/min respectivamente
 *   por combinación.
 *
 * HALLAZGO CONOCIDO (CORREGIDO, P1-6):
 *   server.js usa `config.trustProxy` (default 'loopback'), configurable
 *   vía env TRUST_PROXY. NO usa 'true' (bypass de X-Forwarded-For).
 *
 * Ver SECURITY.md §4 (rate limiting público) y §9 (rate limiting interno).
 */
'use strict';

const { rateLimit } = require('express-rate-limit');
const config = require('../config');
const { AppError } = require('./errors');

// =============================================================================
// I-008 (C-20 v5): configuración del rate limit interno vía env vars
// =============================================================================
// Los límites de las 4 capas son HARDCODED en producción (no se pueden cambiar
// sin un deploy). Para tests y ajustes puntuales, se aceptan env vars leídas
// al cargar este módulo (process.env es estático en producción; en tests debe
// setearse ANTES del primer require).
//
// NO se usa config.js porque añadir nuevas claves ahí es un cambio más invasivo
// y este módulo ya tiene un acoplamiento ligero con config (solo para los
// limiters públicos). Las 4 capas internas se mantienen self-contained.
function _envInt(key, fallback) {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < 1) {
    // En lugar de tirar, usamos el fallback. Esto evita un crash del servicio
    // por un env var mal seteado. Se loguea una sola vez al cargar el módulo.
    return fallback;
  }
  return n;
}

const _INTERNAL_EMPRESA_LIMIT = _envInt('RATE_LIMIT_INTERNAL_EMPRESA_PER_HOUR', 720);
const _INTERNAL_INSTANCE_LIMIT = _envInt('RATE_LIMIT_INTERNAL_EMPRESA_INSTANCE_PER_HOUR', 240);
const _INTERNAL_IP_LIMIT = _envInt('RATE_LIMIT_INTERNAL_IP_PER_HOUR', 480);

/**
 * Handler uniforme: lanza un AppError 429 con código RATE_LIMIT_EXCEEDED.
 * Pasa por el errorHandler central, que ya serializa el JSON con
 * request_id, code, message, details.
 *
 * NO se usa el handler por defecto de express-rate-limit (que escribe
 * res.status(429).json({...}) directamente) para mantener el contrato
 * de error consistente con el resto del servicio.
 */
function makeHandler(limiterName) {
  return function (req, res, next, optionsUsed) {
    // express-rate-limit pasa el `next` de Express como 3er argumento
    // (compatible con RateLimitExceededEventHandler).
    return next(new AppError(
      429,
      'RATE_LIMIT_EXCEEDED',
      `Demasiadas solicitudes. Intenta de nuevo más tarde.`,
      {
        limiter: limiterName,
        limit: optionsUsed.limit,
        window_ms: optionsUsed.windowMs,
      }
    ));
  };
}

/**
 * keyGenerator por defecto: usa req.ip tal como lo resuelve Express.
 * (NOTA: con `trust proxy = true`, req.ip refleja la última IP en
 * X-Forwarded-For. Ver hallazgo P1-6 fuera de scope.)
 */
function ipKey(req /* , res */) {
  return req.ip || 'unknown';
}

/**
 * keyGenerator que combina IP y token (params).
 * Se usa para OTP y commit: evita que un atacante con un solo OTP
 * (o un solo commit) lo pruebe contra miles de sign requests.
 */
function ipAndTokenKey(req /* , res */) {
  const ip = req.ip || 'unknown';
  const token = (req.params && typeof req.params.token === 'string')
    ? req.params.token
    : 'no-token';
  return `${ip}:${token}`;
}

// =============================================================================
// Limiters PÚBLICOS (existen desde I-006 / E9.1, sin cambios funcionales)
// =============================================================================

// -----------------------------------------------------------------------------
// Global: 60 req/min por IP. Aplica a todo excepto /health y /internal/*.
// -----------------------------------------------------------------------------
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.rateLimit.perMinute,
  standardHeaders: 'draft-7',   // RateLimit-* (IETF draft-7)
  legacyHeaders: false,         // Sin X-RateLimit-* (deprecated)
  keyGenerator: ipKey,
  handler: makeHandler('global'),
  skip: (req) => {
    // /health es llamado por monitoring externo (frecuencia alta).
    // /internal/* se rate-limitea con internalServerLimiter (4 capas)
    // que corre DENTRO de cada router, después de authz.
    //   - Cubre '/internal/...' (rutas internas con subpath)
    //   - Cubre '/internal' (sin trailing slash, mount point raíz)
    return req.path === '/health' || req.path === '/'
        || req.path.startsWith('/internal/')
        || req.path === '/internal';
  },
});

// -----------------------------------------------------------------------------
// OTP: 10 req/h por IP+token. Anti-fuerza-bruta de OTP.
// -----------------------------------------------------------------------------
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.rateLimit.otpPerHour,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipAndTokenKey,
  handler: makeHandler('otp'),
});

// -----------------------------------------------------------------------------
// Commit: 3 req/min por IP+token. Anti-spam de commits.
// -----------------------------------------------------------------------------
const commitLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.rateLimit.commitPerMinute,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipAndTokenKey,
  handler: makeHandler('commit'),
});

// -----------------------------------------------------------------------------
// Sign Request: 30 req/min por IP. Anti-abuso de creación.
// Se mantiene como defensa adicional (decisión #8 del user). NO se elimina
// en I-008. Aplica ADEMÁS de internalServerLimiter (capa 3 también es IP,
// pero con límite más generoso 480/h para tráfico legítimo).
// -----------------------------------------------------------------------------
const signRequestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.rateLimit.signRequestPerMinute,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKey,
  handler: makeHandler('sign-request'),
});

// =============================================================================
// Limiters INTERNOS (I-008, C-20 v5) — 4 capas para /internal/*
// =============================================================================
//
// Diseñados para correr DENTRO de cada router, después de requireEmpresaScope.
// El encadenamiento de las 4 capas está en `internalServerLimiter` más abajo.
//
// Decisiones (aprobadas por el user):
//   Capa 1: 720/h por id_empresa (autoritativa) — SIEMPRE aplica si hay empresa
//   Capa 2: 240/h por id_empresa + X-Client-Instance-Id — SKIP si no hay header
//   Capa 3: 480/h por IP (fallback) — SIEMPRE aplica
//   Capa 4: anomalía > 10 X-Client-Instance-Id distintos / 24h (heurística)
//
// X-Client-Instance-Id es OPCIONAL. Si falta, capas 2 y 4 no aplican.
//
// Legacy mode (authSource === 'legacy', req.id_empresa === null): cae a IP
// fallback en las 3 capas basadas en id_empresa. La capa 4 también se salta
// (no hay id_empresa para trackear).
//
// req.id_empresa es la FUENTE AUTORITATIVA del id_empresa. Si por alguna
// razón no está seteado en una ruta que NO es legacy, los keyGenerators
// usan 'legacy-ip:<ip>' como fallback defensivo (no debería pasar porque
// _runAuthz SIEMPRE setea id_empresa o marca authSource=legacy).

// -----------------------------------------------------------------------------
// Capa 1: 720/h por id_empresa
// -----------------------------------------------------------------------------
const internalCapa1 = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: _INTERNAL_EMPRESA_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.id_empresa) return `empresa:${req.id_empresa}`;
    // Legacy mode: cae a IP fallback (decisión #6 del user)
    return `legacy-ip:${ipKey(req)}`;
  },
  handler: makeHandler('internal-capa1'),
});

// -----------------------------------------------------------------------------
// Capa 2: 240/h por id_empresa + X-Client-Instance-Id (opcional)
// -----------------------------------------------------------------------------
function _getInstanceId(req) {
  const v = req.get('X-Client-Instance-Id');
  return (typeof v === 'string' && v.length > 0 && v.length <= 128) ? v : null;
}

const internalCapa2 = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: _INTERNAL_INSTANCE_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const instance = _getInstanceId(req);
    if (req.id_empresa && instance) {
      return `empresa:${req.id_empresa}:instance:${instance}`;
    }
    // Legacy / sin instance: cae a IP (no se SKIP aquí, lo hace la opción `skip`).
    return `legacy-ip:${ipKey(req)}`;
  },
  // X-Client-Instance-Id es opcional → si falta, esta capa no se cuenta.
  // En legacy mode también se SKIP (decisión #6).
  skip: (req) => !(req.id_empresa && _getInstanceId(req)),
  handler: makeHandler('internal-capa2'),
});

// -----------------------------------------------------------------------------
// Capa 3: 480/h por IP (fallback)
// -----------------------------------------------------------------------------
const internalCapa3 = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: _INTERNAL_IP_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKey,
  handler: makeHandler('internal-capa3'),
});

// =============================================================================
// Capa 4: heurística de anomalía (en memoria)
// =============================================================================
//
// Mantiene, por id_empresa, el set de X-Client-Instance-Id vistos en las
// últimas 24h. Si una empresa tiene > 10 instance ids distintos → 429.
//
// HEURÍSTICA, no prueba de ataque:
//   - Una empresa grande con muchos dispositivos legítimos (sucursales,
//     puntos de venta, etc.) podría ser flagged.
//   - En v1 el bloqueo es aceptable. En v2 podría ser solo alerta.
//
// En memoria (se pierde en restart del servicio). Aceptable para v1.
// Ver SECURITY.md §9 para discusión completa.
//
// API expuesta (para tests):
//   - _instanceTracker         → Map<id_empresa, Map<instanceId, lastSeenMs>>
//   - _recordInstanceSeen      → actualiza + cleanup lazy de > 24h
//   - _checkAnomaly            → retorna true si > 10 instances distintas
//   - _clearInstanceTracker    → reset (para tests)
//   - INSTANCE_ANOMALY_LIMIT   → 10 (constante configurable)
//   - INSTANCE_ANOMALY_WINDOW_MS → 24h

const INSTANCE_ANOMALY_LIMIT = _envInt('RATE_LIMIT_INTERNAL_ANOMALY_MAX_INSTANCES', 10);
const INSTANCE_ANOMALY_WINDOW_MS = _envInt('RATE_LIMIT_INTERNAL_ANOMALY_WINDOW_MS', 24 * 60 * 60 * 1000);

/** @type {Map<string, Map<string, number>>} */
const _instanceTracker = new Map();

/**
 * Registra una observación de (id_empresa, instanceId) y limpia entradas
 * de > 24h (cleanup lazy). Si id_empresa o instanceId faltan, no hace nada.
 *
 * @param {string|null|undefined} id_empresa
 * @param {string|null|undefined} instanceId
 * @param {number} [now] - Timestamp actual (ms). Para tests/mock de tiempo.
 */
function _recordInstanceSeen(id_empresa, instanceId, now = Date.now()) {
  if (!id_empresa || !instanceId) return;
  let instances = _instanceTracker.get(id_empresa);
  if (!instances) {
    instances = new Map();
    _instanceTracker.set(id_empresa, instances);
  }
  instances.set(instanceId, now);
  // Cleanup lazy: eliminar entradas > 24h. Esto evita que el Map crezca
  // indefinidamente. La frecuencia de cleanup es proporcional a la
  // frecuencia de requests (suficiente para v1).
  for (const [key, ts] of instances) {
    if (now - ts > INSTANCE_ANOMALY_WINDOW_MS) {
      instances.delete(key);
    }
  }
}

/**
 * Registra la observación y retorna true si la cantidad de instances
 * distintas (en la ventana de 24h) supera el límite.
 *
 * @param {string|null|undefined} id_empresa
 * @param {string|null|undefined} instanceId
 * @param {number} [now] - Timestamp actual (ms). Para tests/mock de tiempo.
 * @returns {boolean} true si anomalía (debe bloquearse).
 */
function _checkAnomaly(id_empresa, instanceId, now = Date.now()) {
  if (!id_empresa || !instanceId) return false;
  _recordInstanceSeen(id_empresa, instanceId, now);
  const instances = _instanceTracker.get(id_empresa);
  return !!(instances && instances.size > INSTANCE_ANOMALY_LIMIT);
}

/**
 * Limpia el tracker en memoria. Usado por tests.
 */
function _clearInstanceTracker() {
  _instanceTracker.clear();
}

/**
 * Middleware: encadena las 4 capas de rate limit interno (I-008, C-20 v5).
 *
 * Pre-condición: debe correr DESPUÉS de `requireEmpresaScope` (que setea
 * `req.id_empresa` y `req.authSource`).
 *
 * Post-condición: si pasa todas las capas, llama next() sin error.
 * Si alguna capa falla, llama next(err) con un AppError 429.
 *
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function internalServerLimiter(req, res, next) {
  // Capa 4 primero (anomalía). Es la única capa que NO usa express-rate-limit
  // (es una heurística en memoria). Si se dispara, bloquea ANTES de
  // consumir tokens de las otras capas.
  const instance = _getInstanceId(req);
  if (_checkAnomaly(req.id_empresa, instance)) {
    return next(new AppError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Demasiadas solicitudes. Intenta de nuevo más tarde.',
      {
        limiter: 'anomaly',
        limit: INSTANCE_ANOMALY_LIMIT,
        window_ms: INSTANCE_ANOMALY_WINDOW_MS,
      }
    ));
  }

  // Capas 1, 2, 3 encadenadas. Cada una es un middleware de express-rate-limit
  // que, si excede, llama next(err con AppError 429). El encadenamiento
  // secuencial es importante: si la capa 1 falla, no consumimos tokens
  // de las siguientes.
  internalCapa1(req, res, (err1) => {
    if (err1) return next(err1);
    internalCapa2(req, res, (err2) => {
      if (err2) return next(err2);
      internalCapa3(req, res, next);
    });
  });
}

module.exports = {
  globalLimiter,
  otpLimiter,
  commitLimiter,
  signRequestLimiter,
  internalServerLimiter,
  // Exportados para tests
  _ipKey: ipKey,
  _ipAndTokenKey: ipAndTokenKey,
  _makeHandler: makeHandler,
  _getInstanceId,
  _recordInstanceSeen,
  _checkAnomaly,
  _clearInstanceTracker,
  _instanceTracker,
  INSTANCE_ANOMALY_LIMIT,
  INSTANCE_ANOMALY_WINDOW_MS,
};
