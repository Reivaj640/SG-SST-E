/**
 * Servicio de Clientes Internos (per-company authz, D-13, I-010).
 *
 * Maneja el ciclo de vida de los clientes internos (K+AIR) en la tabla
 * `gh_internal_clients`. Cada cliente tiene:
 *  - Una API key (≥32 chars, alta entropía). El servicio SOLO conoce el hash.
 *  - Una empresa (`id_empresa`) a la que está atado.
 *  - Un set de operaciones permitidas (`allowed_operations` CSV).
 *  - Estado de revocación (`revoked_at`).
 *
 * Decisiones de diseño (ver docs/kair-firma-integration/I-010-design.md):
 *
 *   1. **SHA-256 para el hash** (no bcrypt/argon2). Las API keys son strings
 *      ≥32 chars con alta entropía, NO contraseñas humanas. SHA-256 es
 *      suficiente y rápido. Ver SECURITY.md §8.
 *
 *   2. **Cache en memoria 30s** (Map por API key). Trade-off: hasta 30s de
 *      ventana entre revoke y aplicación. Aceptable para v1. Si se requiere
 *      revocación inmediata, se puede bajar el TTL o usar un invalidation
 *      event-based.
 *
 *   3. **Legacy fallback**: cuando llega una API key que NO está en BD pero
 *      coincide con `config.auth.internalApiKey` (la "API key global" pre-I-010),
 *      se retorna un cliente "legacy" con `id_empresa=null` y
 *      `clientOperations=['legacy']`. Esto es para 1 release de deprecation.
 *      Ver ajuste #1 en el design doc.
 *
 *   4. **No se cachea null en `getActiveClientByApiKey`** para clientes
 *      revocados/inexistentes: cacheamos `null` brevemente para no martillar
 *      la BD con keys inválidas (anti-flood). TTL = mismo 30s.
 *
 * IMPORTANTE: este service NUNCA loguea la API key en plaintext.
 * Solo se loguea el hash (8 primeros chars como fingerprint).
 */
'use strict';

const db = require('../db/connection');
const config = require('../config');
const { sha256 } = require('../crypto/hash');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');

const CACHE_TTL_MS = 30 * 1000; // 30 segundos (ver I-010 design §4.2)

/**
 * Cache in-memory: API key plaintext (string) → { value, expiresAt }.
 * value puede ser:
 *   - client object (encontrado y activo)
 *   - null (no encontrado, o revocado — evitamos martillar la BD)
 * El cache es POR PROCESO. En deployments con múltiples instancias del
 * Servicio, cada instancia tiene su propio cache.
 */
const _cache = new Map();

/**
 * Hashea una API key con SHA-256. Retorna hex lowercase (64 chars).
 *
 * Función pública para que el middleware/tests puedan hashear sin
 * duplicar la implementación.
 */
function hashApiKey(apiKey) {
  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    throw new AppError(400, 'INVALID_API_KEY', 'API key vacía');
  }
  return sha256(apiKey);
}

/**
 * Parsea la columna `allowed_operations` (CSV) en un array de strings.
 * Vacía → []. Ignora tokens vacíos tras split (",," o "," al final).
 */
function parseAllowedOperations(csv) {
  if (typeof csv !== 'string' || csv.length === 0) return [];
  return csv.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Serializa el array de ops de vuelta a CSV. Inverso de parseAllowedOperations.
 */
function serializeAllowedOperations(ops) {
  if (!Array.isArray(ops)) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'allowed_operations debe ser array de strings');
  }
  return ops.map(s => String(s).trim()).filter(s => s.length > 0).join(',');
}

/**
 * Lee del cache. Retorna `undefined` si no hay hit o si expiró.
 */
function _cacheGet(apiKey) {
  const entry = _cache.get(apiKey);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    _cache.delete(apiKey);
    return undefined;
  }
  return entry.value;
}

function _cacheSet(apiKey, value) {
  _cache.set(apiKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 ** Limpia el cache. Usado por:
 **  - Tests (resetDb borra la BD pero el cache queda stale)
 **  - Posible hook futuro de revocación inmediata (event-based)
 */
function clearCache() {
  _cache.clear();
}

/**
 * Crea un nuevo cliente interno.
 *
 * @param {object} opts
 * @param {string} opts.id_empresa
 * @param {string[]|string} opts.allowed_operations - Array o CSV
 * @param {string} [opts.description=null]
 * @param {string} opts.apiKey - API key en plaintext (se hashea internamente)
 * @returns {object} El cliente creado (con `api_key_hash`, sin `apiKey`)
 * @throws AppError 400 si la API key es vacía o ya existe
 */
function createClient({ id_empresa, allowed_operations, description = null, apiKey }) {
  if (typeof id_empresa !== 'string' || id_empresa.length === 0) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'id_empresa es requerido');
  }
  if (!apiKey || typeof apiKey !== 'string') {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'apiKey es requerido');
  }
  const ops = Array.isArray(allowed_operations)
    ? serializeAllowedOperations(allowed_operations)
    : (typeof allowed_operations === 'string' ? allowed_operations : '');
  if (ops.length === 0) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'allowed_operations no puede estar vacío');
  }
  if (description !== null && typeof description !== 'string') {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'description debe ser string o null');
  }

  const api_key_hash = hashApiKey(apiKey);

  // Verificar unicidad por hash (PK). Si ya existe, 409.
  const existing = db.prepare(
    'SELECT api_key_hash FROM gh_internal_clients WHERE api_key_hash = ?'
  ).get(api_key_hash);
  if (existing) {
    throw new AppError(409, 'CLIENT_ALREADY_EXISTS', 'Ya existe un cliente con esa API key');
  }

  db.prepare(`
    INSERT INTO gh_internal_clients (api_key_hash, id_empresa, allowed_operations, description)
    VALUES (?, ?, ?, ?)
  `).run(api_key_hash, id_empresa, ops, description);

  const created = getByHash(api_key_hash);
  logger.info('Cliente interno creado', {
    id_empresa,
    allowed_operations: ops,
    api_key_hash_prefix: api_key_hash.slice(0, 8),
    description: description ? description.slice(0, 50) : null,
  });
  return created;
}

/**
 * Busca un cliente por su hash. Retorna el objeto completo o null.
 * NO chequea revocación (eso es getActiveClientByApiKey).
 */
function getByHash(api_key_hash) {
  if (typeof api_key_hash !== 'string' || api_key_hash.length === 0) return null;
  return db.prepare(`
    SELECT api_key_hash, id_empresa, allowed_operations, description, created_at, revoked_at
    FROM gh_internal_clients
    WHERE api_key_hash = ?
  `).get(api_key_hash) || null;
}

/**
 * Busca un cliente activo (no revocado) por API key (plaintext).
 *
 * - Cache 30s en memoria (key = apiKey plaintext, value = client o null).
 * - hashea internamente con SHA-256.
 * - Si la key está revocada, retorna null (no la retorna como cliente activo).
 * - Si la key no existe, retorna null.
 *
 * @param {string} apiKey - API key en plaintext (del header X-Internal-API-Key)
 * @returns {object|null} El cliente activo o null
 */
function getActiveClientByApiKey(apiKey) {
  if (typeof apiKey !== 'string' || apiKey.length === 0) return null;

  // 1. Cache lookup
  const cached = _cacheGet(apiKey);
  if (cached !== undefined) return cached;

  // 2. DB lookup
  const api_key_hash = hashApiKey(apiKey);
  const row = db.prepare(`
    SELECT api_key_hash, id_empresa, allowed_operations, description, created_at, revoked_at
    FROM gh_internal_clients
    WHERE api_key_hash = ? AND revoked_at IS NULL
  `).get(api_key_hash);

  // 3. Cachear resultado (incluso null) por 30s
  _cacheSet(apiKey, row || null);
  return row || null;
}

/**
 * Revoca un cliente por su hash. Soft-delete: setea `revoked_at = now`.
 * Invalida el cache para esa API key (si el caller la tiene).
 *
 * @param {string} api_key_hash - El hash (NO el plaintext)
 * @returns {boolean} true si se revocó, false si no existía o ya estaba revocado
 */
function revokeClient(api_key_hash) {
  if (typeof api_key_hash !== 'string' || api_key_hash.length === 0) return false;
  const result = db.prepare(`
    UPDATE gh_internal_clients
    SET revoked_at = datetime('now')
    WHERE api_key_hash = ? AND revoked_at IS NULL
  `).run(api_key_hash);
  if (result.changes > 0) {
    // Invalidar cache: como el cache es por plaintext apiKey y nosotros
    // solo tenemos el hash, lo más simple es limpiarlo entero.
    // (El cache es chico: típicamente decenas de entradas.)
    _cache.clear();
    logger.info('Cliente interno revocado', {
      api_key_hash_prefix: api_key_hash.slice(0, 8),
    });
  }
  return result.changes > 0;
}

/**
 * Lista todos los clientes activos (no revocados). Para admin/operador humano.
 */
function listActiveClients() {
  return db.prepare(`
    SELECT api_key_hash, id_empresa, allowed_operations, description, created_at, revoked_at
    FROM gh_internal_clients
    WHERE revoked_at IS NULL
    ORDER BY created_at ASC
  `).all();
}

/**
 * Helper de fallback LEGACY. Verifica si la API key coincide con
 * `config.auth.internalApiKey` (la API key global pre-I-010).
 *
 * Si coincide, retorna un objeto shape-compatible con getActiveClientByApiKey
 * PERO con señales claras de que es legacy:
 *   - api_key_hash: derivado del hash de la legacy key (para logging)
 *   - id_empresa: null  (NO '*' — ver ajuste #1 del design doc)
 *   - allowed_operations: 'legacy' (marca especial)
 *   - description: 'LEGACY: pre-I-010 key'
 *   - created_at: null
 *   - revoked_at: null
 *   - legacy: true (campo extra para que el middleware sepa el modo)
 *
 * Si NO coincide, retorna null (y el middleware responde 401).
 *
 * IMPORTANTE: este helper SOLO se usa durante el período de deprecation
 * (1 release). Después se elimina y todos los clientes deben estar en BD.
 */
function lookupLegacyClient(apiKey) {
  if (typeof apiKey !== 'string' || apiKey.length === 0) return null;
  // Comparación timing-safe: NO usar === porque filtra información por timing.
  const { constantTimeEqual } = require('../crypto/compare');
  if (!constantTimeEqual(apiKey, config.auth.internalApiKey)) return null;
  return {
    api_key_hash: hashApiKey(apiKey),  // para logging
    id_empresa: null,
    allowed_operations: 'legacy',
    description: 'LEGACY: pre-I-010 key (deprecation period)',
    created_at: null,
    revoked_at: null,
    legacy: true,
  };
}

module.exports = {
  hashApiKey,
  parseAllowedOperations,
  serializeAllowedOperations,
  getByHash,
  getActiveClientByApiKey,
  createClient,
  revokeClient,
  listActiveClients,
  lookupLegacyClient,
  // Exposed for tests
  clearCache,
  CACHE_TTL_MS,
};
