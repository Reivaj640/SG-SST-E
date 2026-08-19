/**
 * Middleware: autorización per-empresa (D-13, I-010).
 *
 * Capa de AUTORIZACIÓN (separada de la autenticación):
 *
 *   AUTENTICACIÓN (¿quién eres?): API key → cliente interno (id_empresa, allowed_operations)
 *   AUTORIZACIÓN  (¿qué empresa representas?): req.id_empresa
 *                (¿puedes ejecutar esta operación?): check req.clientOperations
 *                (¿la empresa del body coincide?): checkIdEmpresa: true
 *
 * Comportamiento:
 *
 *   1. Lee `X-Internal-API-Key`.
 *   2. Llama `getActiveClientByApiKey` (cache 30s, ver internalClient.js).
 *   3. Si no existe cliente → 401 INVALID_API_KEY.
 *   4. Si authSource === 'legacy' (fallback a config.auth.internalApiKey):
 *      - req.authSource = 'legacy'
 *      - req.id_empresa = null
 *      - req.clientOperations = ['legacy']
 *      - Permite la operación (deprecation period; ver I-010 design §3)
 *      - Log de deprecation warning
 *   5. Si cliente normal:
 *      - req.authSource = 'client'
 *      - req.id_empresa = client.id_empresa
 *      - req.clientOperations = array de strings (parseado de CSV)
 *      - Si la operación solicitada NO está en clientOperations → 403 FORBIDDEN
 *   6. Si `checkIdEmpresa: true` y authSource === 'client':
 *      - Compara body.id_empresa (o query.id_empresa o params.id_empresa)
 *        con req.id_empresa
 *      - Si mismatch → 403 EMPRESA_MISMATCH
 *      - En legacy mode: PERMITE (deprecation; el legacy key es pre-I-010
 *        y no tiene empresa fija). El route handler hace el check post-lookup
 *        si lo necesita.
 *
 * **IMPORTANTE**:
 *  - Este middleware REEMPLAZA `internalApiAuth()` en las rutas que necesitan
 *    scope per-empresa. NO se usan ambos (sería redundante y rompería tests
 *    con claves que NO son la legacy).
 *  - Para rutas que NO necesitan per-company authz (ej. health, admin
 *    endpoints con X-Admin-API-Key), se sigue usando `internalApiAuth()` o
 *    `adminApiAuth()`.
 *  - `req.id_empresa` SIEMPRE viene de la identidad autenticada, NUNCA del
 *    body/query. Los handlers deben usar req.id_empresa como fuente
 *    autoritativa.
 *
 * Composición con rate limit (I-008, C-20 v5):
 *  - `_runAuthz` es el helper interno: corre la lógica de authz y entrega
 *    el resultado vía callback (err). NO toca rate limit.
 *  - `requireEmpresaScope({...})` es el wrapper que SOLO hace authz y luego
 *    next(). Comportamiento idéntico al pre-I-008.
 *  - `requireEmpresaScopeAndLimit({...})` es la COMPOSICIÓN: corre authz
 *    y, si pasa, encadena los 4 limiters del rate limit interno. Los
 *    limiters LEEN `req.id_empresa` (seteado por authz) — NO re-resuelven
 *    la API key. Esto evita que authz y rate limit "vean" empresas
 *    distintas si el cache de internalClient diverge.
 *
 * Ver docs/kair-firma-integration/I-010-design.md, SECURITY.md §8, §9.
 */
'use strict';

const internalClientService = require('../services/internalClient');
const { AppError } = require('./errors');
const logger = require('../utils/logger');
const { internalServerLimiter } = require('./rateLimit');

/**
 * Parsea el CSV de allowed_operations en un array.
 * Re-exporta del service para mantener la lógica en un solo lugar.
 */
function _parseOps(csv) {
  return internalClientService.parseAllowedOperations(csv);
}

/**
 * Lee el id_empresa de la request, en orden de prioridad:
 *  1. body.id_empresa (POST/PUT/PATCH)
 *  2. query.id_empresa (GET con ?id_empresa=)
 *  3. params.id_empresa (ruta /:id_empresa/...)
 *  4. null (no hay)
 */
function _extractRequestedEmpresa(req) {
  const bodyEmpresa = req.body && req.body.id_empresa;
  if (typeof bodyEmpresa === 'string' && bodyEmpresa.length > 0) return bodyEmpresa;
  const queryEmpresa = req.query && req.query.id_empresa;
  if (typeof queryEmpresa === 'string' && queryEmpresa.length > 0) return queryEmpresa;
  const paramsEmpresa = req.params && req.params.id_empresa;
  if (typeof paramsEmpresa === 'string' && paramsEmpresa.length > 0) return paramsEmpresa;
  return null;
}

/**
 * Helper interno: corre la lógica de authz (authn + per-company + ops check)
 * y notifica el resultado vía callback (err). NO toca next() ni rate limit.
 *
 * I-008: la firma es `(req, opts, cb)` en lugar de `(req, res, next)` para
 * que pueda ser reutilizada por `requireEmpresaScope` (sin rate limit) y
 * `requireEmpresaScopeAndLimit` (con rate limit), sin tener que duplicar
 * la lógica. La compatibilidad semántica con `requireEmpresaScope` pre-I-008
 * se preserva exactamente.
 *
 * @param {object} req      - Request de Express.
 * @param {object} opts     - { allowedOperations, checkIdEmpresa }.
 * @param {function} cb     - (err) => void. err es null o un AppError.
 */
function _runAuthz(req, opts, cb) {
  const { allowedOperations = [], checkIdEmpresa = false } = opts || {};

  // 1. Leer header
  const provided = req.get('X-Internal-API-Key');
  if (typeof provided !== 'string' || provided.length === 0) {
    return cb(new AppError(401, 'INVALID_API_KEY',
      'Falta el header X-Internal-API-Key'));
  }

  // 2. Buscar cliente activo (cache 30s)
  const client = internalClientService.getActiveClientByApiKey(provided);

  if (client) {
    // 3a. Cliente normal
    const ops = _parseOps(client.allowed_operations);

    // 3a-i. Verificar operación permitida (solo si se especificaron ops)
    if (Array.isArray(allowedOperations) && allowedOperations.length > 0) {
      const hasPermission = allowedOperations.some(op => ops.includes(op));
      if (!hasPermission) {
        return cb(new AppError(403, 'FORBIDDEN',
          'Operación no permitida para este cliente',
          {
            required_operations: allowedOperations,
            client_operations: ops,
            id_empresa: client.id_empresa,
          }));
      }
    }

    // 3a-ii. Setear req.auth context
    req.authSource = 'client';
    req.id_empresa = client.id_empresa;
    req.clientOperations = ops;
    // Hash fingerprint (8 chars) para logging/auditoría
    req.api_key_hash_prefix = client.api_key_hash.slice(0, 8);
  } else {
    // 3b. Intentar fallback legacy
    const legacy = internalClientService.lookupLegacyClient(provided);
    if (!legacy) {
      return cb(new AppError(401, 'INVALID_API_KEY',
        'API key inválida o revocada'));
    }

    // 3b-i. Setear req.auth context legacy
    // En legacy mode, la operación y el id_empresa check son PERMISIVOS
    // durante el período de deprecation. Esto preserva la compatibilidad
    // con K+AIR mientras migra a claves per-empresa. El route handler
    // puede hacer su propio check post-lookup si lo necesita (ver
    // signRequest.js GET /:id, internal-audit.js GET eventos).
    req.authSource = 'legacy';
    req.id_empresa = null;  // ← NO '*' (ver ajuste #1 del design doc)
    req.clientOperations = ['legacy'];
    req.api_key_hash_prefix = legacy.api_key_hash.slice(0, 8);

    // 3b-ii. Log de deprecation warning (1 release, después se elimina)
    logger.warn('DEPRECATION: cliente legacy accedió endpoint protegido por requireEmpresaScope', {
      request_id: req.id,
      method: req.method,
      path: req.path,
      allowed_operations: allowedOperations,
      checkIdEmpresa,
    });
  }

  // 4. Check id_empresa del body/query/params (solo en client mode)
  if (checkIdEmpresa && req.authSource === 'client' && req.id_empresa) {
    const requested = _extractRequestedEmpresa(req);
    if (requested !== null && requested !== req.id_empresa) {
      return cb(new AppError(403, 'EMPRESA_MISMATCH',
        'El id_empresa de la solicitud no coincide con la identidad autenticada',
        {
          auth_id_empresa: req.id_empresa,
          requested_id_empresa: requested,
        }));
    }
  }
  // En legacy mode: NO se chequea (deprecation period).
  // Si el route handler necesita check post-lookup (ej. GET /:id),
  // lo hace con req.authSource === 'legacy' como señal.

  cb(null);
}

/**
 * Crea el middleware de autorización per-empresa (SOLO authz, sin rate limit).
 *
 * Comportamiento pre-I-008, preservado íntegro. Ver _runAuthz para la
 * semántica detallada.
 *
 * @param {object} [opts]
 * @param {string[]} [opts.allowedOperations=[]] - Lista de operaciones permitidas.
 * @param {boolean} [opts.checkIdEmpresa=false] - Si true, valida body/query/params.
 * @returns {Function} Middleware Express.
 */
function requireEmpresaScope({ allowedOperations = [], checkIdEmpresa = false } = {}) {
  return function (req, res, next) {
    _runAuthz(req, { allowedOperations, checkIdEmpresa }, (err) => {
      if (err) return next(err);
      next();
    });
  };
}

/**
 * Crea el middleware COMPUESTO: authz per-empresa + rate limit interno
 * (4 capas de I-008 / C-20 v5).
 *
 * Composición:
 *   1. Corre _runAuthz (misma lógica que requireEmpresaScope).
 *      - Si authz falla (401, 403, EMPRESA_MISMATCH) → corta acá, NO consume rate limit.
 *   2. Si authz pasa, encadena las 4 capas de rate limit:
 *      - Capa 4 (anomalía): si una empresa tiene > 10 X-Client-Instance-Id
 *        distintos en 24h, se bloquea con 429 RATE_LIMIT_EXCEEDED.
 *      - Capa 1 (id_empresa): 720/h por id_empresa (autoritativa).
 *      - Capa 2 (instance): 240/h por id_empresa + X-Client-Instance-Id.
 *        Si X-Client-Instance-Id no viene, se SKIP.
 *      - Capa 3 (IP): 480/h por IP (fallback / legacy).
 *
 * **Decisión clave**: el rate limit LEE `req.id_empresa` (seteado por
 * _runAuthz), NO re-resuelve la API key. Esto evita divergencia entre
 * authz y rate limit si el cache de internalClient diverge.
 *
 * **Falla cerrado**: si por alguna razón `req.id_empresa` no está seteado
 * (bug en authz) en una ruta que NO es legacy, el rate limit rechaza la
 * request en lugar de hacer fallback a IP. Esto es defensa en profundidad
 * (no debería pasar porque _runAuthz SIEMPRE setea `req.id_empresa` o
 * marca `req.authSource = 'legacy'`).
 *
 * @param {object} [opts]
 * @param {string[]} [opts.allowedOperations=[]]
 * @param {boolean} [opts.checkIdEmpresa=false]
 * @param {object} [opts.rateLimit]
 * @param {boolean} [opts.rateLimit.enabled=true] - Si false, NO se aplica
 *        el rate limit (útil para tests de authz puro). El authz corre igual.
 * @returns {Function} Middleware Express.
 */
function requireEmpresaScopeAndLimit({ allowedOperations = [], checkIdEmpresa = false, rateLimit = {} } = {}) {
  const rateLimitEnabled = rateLimit.enabled !== false;
  return function (req, res, next) {
    _runAuthz(req, { allowedOperations, checkIdEmpresa }, (err) => {
      if (err) return next(err);
      if (!rateLimitEnabled) {
        return next();
      }
      // Delega al internalServerLimiter que usa req.id_empresa, req.get('X-Client-Instance-Id'), req.ip
      internalServerLimiter(req, res, next);
    });
  };
}

module.exports = { requireEmpresaScope, requireEmpresaScopeAndLimit };
