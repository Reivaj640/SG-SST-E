/**
 * Middleware: rate limiting por IP.
 *
 * Implementa 4 limiters diferenciados usando express-rate-limit v7.x.
 *
 * | Limiter          | Ventana | Max | Key                              | Aplica a                                       |
 * |------------------|---------|-----|----------------------------------|------------------------------------------------|
 * | globalLimiter    | 1 min   | 60  | req.ip                           | Todas las rutas excepto /health                |
 * | otpLimiter       | 1 hora  | 10  | req.ip + ':' + req.params.token  | POST /api/sign/:token/verify-otp               |
 * | commitLimiter    | 1 min   | 3   | req.ip + ':' + req.params.token  | POST /api/sign/:token/commit                   |
 * | signRequestLimiter| 1 min   | 30  | req.ip                           | POST /internal/sign-requests                   |
 *
 * Razón del keyGenerator IP+token en otp y commit:
 *   Sin esto, un atacante con un solo OTP podría intentar validarlo contra
 *   miles de sign requests distintos. Con IP+token, cada (IP,token) tiene
 *   su propio cubo, y el atacante queda limitado a 10/h y 3/min respectivamente
 *   por combinación.
 *
 * HALLAZGO CONOCIDO (CORREGIDO en este commit, P1-6):
 *   server.js ANTES definía `app.set('trust proxy', true)`. Esto hacía que
 *   Express confiara en el header X-Forwarded-For para determinar req.ip,
 *   lo cual PERMITE a un atacante bypasear el rate limit falsificando
 *   X-Forwarded-For con una IP aleatoria en cada request. La librería
 *   express-rate-limit v7 emitía una advertencia visible en logs.
 *   Ahora server.js usa `config.trustProxy` (default 'loopback'),
 *   configurable vía env TRUST_PROXY.
 *
 * Ver SECURITY.md §4 (rate limiting) y express-rate-limit v7 docs.
 */
'use strict';

const { rateLimit } = require('express-rate-limit');
const config = require('../config');
const { AppError } = require('./errors');

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

// -----------------------------------------------------------------------------
// Global: 60 req/min por IP. Aplica a todo excepto /health.
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
    // No tiene sentido rate limitearlo.
    return req.path === '/health' || req.path === '/';
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
// -----------------------------------------------------------------------------
const signRequestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.rateLimit.signRequestPerMinute,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKey,
  handler: makeHandler('sign-request'),
});

module.exports = {
  globalLimiter,
  otpLimiter,
  commitLimiter,
  signRequestLimiter,
  // Exportados para tests
  _ipKey: ipKey,
  _ipAndTokenKey: ipAndTokenKey,
  _makeHandler: makeHandler,
};
