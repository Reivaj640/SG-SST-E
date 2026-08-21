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

const crypto = require('crypto');
const db = require('../db/connection');
const config = require('../config');
const { sha256 } = require('../crypto/hash');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');

const CACHE_TTL_MS = 30 * 1000; // 30 segundos (ver I-010 design §4.2)

/**
 * Genera una API key nueva con el formato `kair_<env>_<base64url(32 bytes)>`.
 *
 * - `kair_test_` cuando NODE_ENV != 'production'.
 * - `kair_live_` cuando NODE_ENV === 'production'.
 * - Cuerpo: 32 bytes random codificados en base64url (43 chars, sin padding).
 * - Total: 10 (prefijo) + 43 (cuerpo) = 53 chars.
 * - Entropía: 256 bits (2^256 valores posibles).
 *
 * @returns {string}
 */
function _generateApiKey() {
  const env = config.env === 'production' ? 'live' : 'test';
  const random = crypto.randomBytes(32).toString('base64url');
  return `kair_${env}_${random}`;
}

/**
 * Helper: retorna los primeros 8 chars hex del hash.
 * Retorna '' si el hash no es string de 64 hex chars.
 */
function hashPrefix(api_key_hash) {
  if (typeof api_key_hash !== 'string' || !/^[0-9a-f]{64}$/.test(api_key_hash)) {
    return '';
  }
  return api_key_hash.slice(0, 8);
}

/**
 * Busca un cliente por id_empresa + estado activo (revoked_at IS NULL).
 * Retorna el cliente o null.
 *
 * Esta función SOLO mira la BD (no usa cache). Es interna al service;
 * los handlers per-company usan listClients() (que SÍ filtra y pagina).
 *
 * @param {string} id_empresa
 * @returns {object|null}
 */
function getActiveClientByEmpresa(id_empresa) {
  if (typeof id_empresa !== 'string' || id_empresa.length === 0) return null;
  return db.prepare(`
    SELECT api_key_hash, id_empresa, allowed_operations, description, created_at, revoked_at
    FROM gh_internal_clients
    WHERE id_empresa = ? AND revoked_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `).get(id_empresa) || null;
}

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

/**
 * Crea un per-company client. Genera la API key, hashea con SHA-256,
 * verifica que la empresa NO tenga ya un cliente ACTIVO (409 si lo tiene),
 * e inserta en BD. Retorna el cliente con la api_key en plaintext.
 *
 * Decisiones:
 *  - DR-1: el caller es el BRIDGE de K+AIR (no renderer, no operador humano).
 *  - DR-5: prefijo `kair_live_/kair_test_` elegido según config.env.
 *  - DR-6.A: el bridge envía description ya formateado; aquí se persiste tal cual.
 *  - DR-6.B: el bridge SIEMPRE envía los 5 ops; aquí se acepta lo que llega
 *    (el schema zod ya valida enum).
 *  - DR-6.C: si la empresa ya tiene cliente ACTIVO → 409 CLIENT_EXISTS_FOR_EMPRESA.
 *    Si solo tiene historial de revocados, se crea el nuevo (soft-delete).
 *
 * @param {object} opts
 * @param {string} opts.id_empresa - 1-64 chars (validado por zod antes)
 * @param {string[]} opts.allowed_operations - 1-10 items del enum (validado por zod)
 * @param {string} [opts.description=null]
 * @param {string} [opts.precomputedKey=null] - SOLO para tests (test hook)
 * @returns {object}
 *   { id_empresa, api_key, api_key_hash, api_key_hash_prefix,
 *     allowed_operations (array), description, created_at, is_active: true }
 * @throws AppError 409 si la empresa ya tiene cliente activo
 */
function createPerCompanyClient({
  id_empresa,
  allowed_operations,
  description = null,
  precomputedKey = null,
}) {
  if (typeof id_empresa !== 'string' || id_empresa.length === 0) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'id_empresa es requerido');
  }
  if (!Array.isArray(allowed_operations) || allowed_operations.length === 0) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'allowed_operations debe ser array no vacío');
  }
  if (description !== null && typeof description !== 'string') {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'description debe ser string o null');
  }

  // 1. Generar api_key (o usar precomputedKey para tests deterministas).
  const apiKey = precomputedKey || _generateApiKey();
  const api_key_hash = hashApiKey(apiKey);

  // 2. Verificar que NO exista ya un cliente ACTIVO para esta empresa.
  //    Si solo hay revocados (historial), se permite crear uno nuevo.
  const existingActive = getActiveClientByEmpresa(id_empresa);
  if (existingActive) {
    throw new AppError(
      409,
      'CLIENT_EXISTS_FOR_EMPRESA',
      `Ya existe un cliente activo para la empresa ${id_empresa}`,
      {
        id_empresa,
        existing_hash_prefix: hashPrefix(existingActive.api_key_hash),
        created_at: existingActive.created_at,
        hint: 'Use POST /internal/admin/clientes/:id/rotate to rotate the existing key',
      },
    );
  }

  // 3. Serializar allowed_operations a CSV.
  const opsCsv = serializeAllowedOperations(allowed_operations);

  // 4. INSERT.
  db.prepare(`
    INSERT INTO gh_internal_clients (api_key_hash, id_empresa, allowed_operations, description)
    VALUES (?, ?, ?, ?)
  `).run(api_key_hash, id_empresa, opsCsv, description);

  // 5. Recuperar fila creada (para tener created_at consistente).
  const created = getByHash(api_key_hash);

  logger.info('Per-company client creado', {
    id_empresa,
    api_key_hash_prefix: hashPrefix(api_key_hash),
    allowed_operations: opsCsv,
    description: description ? description.slice(0, 50) : null,
  });

  return {
    id_empresa,
    api_key: apiKey,
    api_key_hash,
    api_key_hash_prefix: hashPrefix(api_key_hash),
    allowed_operations: parseAllowedOperations(opsCsv),
    description,
    created_at: created.created_at,
    is_active: true,
  };
}

/**
 * Lista per-company clients con filtros opcionales.
 *
 * @param {object} opts
 * @param {string} [opts.id_empresa=null] - filtro exacto (1-64 chars)
 * @param {boolean} [opts.include_revoked=false]
 * @param {number} [opts.limit=100] - 1-200
 * @param {number} [opts.offset=0] - >=0
 * @returns {object} { total, items }
 *
 * NUNCA expone `api_key_hash` completo en items — solo `api_key_hash_prefix`.
 */
function listClients({
  id_empresa = null,
  include_revoked = false,
  limit = 100,
  offset = 0,
} = {}) {
  // Validación defensiva (los handlers zod ya validan, pero si llaman directo...)
  if (limit < 1 || limit > 200) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'limit debe estar entre 1 y 200');
  }
  if (offset < 0) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'offset debe ser >= 0');
  }

  // Construir WHERE dinámicamente.
  const where = [];
  const params = [];
  if (id_empresa) {
    where.push('id_empresa = ?');
    params.push(id_empresa);
  }
  if (!include_revoked) {
    where.push('revoked_at IS NULL');
  }
  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  // Total count.
  const totalRow = db.prepare(
    `SELECT COUNT(*) AS total FROM gh_internal_clients ${whereSql}`
  ).get(...params);
  const total = totalRow.total;

  // Items paginados, ordenados por created_at DESC (más reciente primero).
  const rows = db.prepare(`
    SELECT api_key_hash, id_empresa, allowed_operations, description, created_at, revoked_at
    FROM gh_internal_clients
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // Proyectar a shape público (NUNCA hash completo).
  const items = rows.map(r => ({
    id_empresa: r.id_empresa,
    api_key_hash_prefix: hashPrefix(r.api_key_hash),
    allowed_operations: parseAllowedOperations(r.allowed_operations),
    description: r.description,
    created_at: r.created_at,
    revoked_at: r.revoked_at,
    is_active: r.revoked_at === null,
  }));

  return { total, items };
}

/**
 * Revoca el cliente ACTIVO de una empresa y crea uno nuevo con la misma
 * configuración (allowed_operations + description) pero api_key nueva.
 *
 * Decisiones:
 *  - DR-4: rotación con corte inmediato (sin grace period en V1).
 *  - La TX debe ser atómica: viejo revocado + nuevo insertado juntos.
 *  - El cache se limpia tras la rotación para que la key vieja deje de
 *    funcionar inmediatamente.
 *
 * @param {string} id_empresa
 * @param {object} [opts]
 * @param {string} [opts.motivo='Rotación programada'] - solo para logs/response
 * @param {string} [opts.actor='admin'] - solo para logs/response
 * @param {string} [opts.precomputedKey=null] - SOLO para tests
 * @returns {object}
 *   { id_empresa, old_api_key_hash_prefix, api_key, api_key_hash,
 *     api_key_hash_prefix, allowed_operations (array), description,
 *     rotated_at, motivo, actor }
 * @throws AppError 404 si la empresa no tiene cliente activo
 */
function rotateClientByEmpresa(id_empresa, opts = {}) {
  if (typeof id_empresa !== 'string' || id_empresa.length === 0) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'id_empresa es requerido');
  }

  const motivo = (opts && opts.motivo) || 'Rotación programada';
  const actor = (opts && opts.actor) || 'admin';
  const precomputedKey = (opts && opts.precomputedKey) || null;

  // 1. Buscar cliente activo.
  const old = getActiveClientByEmpresa(id_empresa);
  if (!old) {
    // Distinguir "no hay nunca" vs "solo revocados" para hint útil.
    const anyRevoked = db.prepare(
      'SELECT COUNT(*) AS n FROM gh_internal_clients WHERE id_empresa = ?'
    ).get(id_empresa);
    const hint = anyRevoked.n > 0
      ? 'Use POST /internal/admin/clientes to create a new client for this empresa'
      : 'Use POST /internal/admin/clientes to create a new client for this empresa';
    throw new AppError(
      404,
      'CLIENT_NOT_FOUND',
      `No hay cliente activo para la empresa ${id_empresa}`,
      { id_empresa, hint },
    );
  }

  const old_hash = old.api_key_hash;
  const old_allowed_ops = old.allowed_operations; // CSV
  const old_description = old.description;

  // 2. Generar nueva api_key.
  const newApiKey = precomputedKey || _generateApiKey();
  const new_hash = hashApiKey(newApiKey);

  // 3. TX: revocar viejo + insertar nuevo.
  const tx = db.transaction(() => {
    // 3a. Revocar el viejo.
    db.prepare(`
      UPDATE gh_internal_clients
      SET revoked_at = datetime('now')
      WHERE api_key_hash = ? AND revoked_at IS NULL
    `).run(old_hash);

    // 3b. Insertar el nuevo (mismas allowed_operations y description).
    db.prepare(`
      INSERT INTO gh_internal_clients (api_key_hash, id_empresa, allowed_operations, description)
      VALUES (?, ?, ?, ?)
    `).run(new_hash, id_empresa, old_allowed_ops, old_description);
  });
  tx();

  // 4. Limpiar cache (la key vieja ya no es válida).
  _cache.clear();

  // 5. Recuperar fila nueva (para tener rotated_at consistente).
  const newRow = getByHash(new_hash);

  logger.info('Per-company client rotado', {
    id_empresa,
    old_api_key_hash_prefix: hashPrefix(old_hash),
    new_api_key_hash_prefix: hashPrefix(new_hash),
    motivo,
    actor,
  });

  return {
    id_empresa,
    old_api_key_hash_prefix: hashPrefix(old_hash),
    api_key: newApiKey,
    api_key_hash: new_hash,
    api_key_hash_prefix: hashPrefix(new_hash),
    allowed_operations: parseAllowedOperations(newRow.allowed_operations),
    description: newRow.description,
    rotated_at: newRow.created_at,
    motivo,
    actor,
  };
}

/**
 * Revoca el cliente ACTIVO de una empresa (sin crear uno nuevo).
 *
 * En V1 NO hay endpoint DELETE (DR-4: V2). Esta función es helper interno
 * para `revokeClientByEmpresa` y para tests.
 *
 * @param {string} id_empresa
 * @param {object} [opts]
 * @param {string} [opts.motivo='Revocación manual']
 * @param {string} [opts.actor='admin']
 * @returns {object} { id_empresa, api_key_hash_prefix, revoked_at, motivo, actor }
 * @throws AppError 404 si la empresa no tiene cliente activo
 */
function revokeClientByEmpresa(id_empresa, opts = {}) {
  if (typeof id_empresa !== 'string' || id_empresa.length === 0) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'id_empresa es requerido');
  }
  const motivo = (opts && opts.motivo) || 'Revocación manual';
  const actor = (opts && opts.actor) || 'admin';

  const old = getActiveClientByEmpresa(id_empresa);
  if (!old) {
    throw new AppError(
      404,
      'CLIENT_NOT_FOUND',
      `No hay cliente activo para la empresa ${id_empresa}`,
      { id_empresa, hint: 'No hay nada que revocar' },
    );
  }

  // Revocar (TX para consistency, aunque es 1 sola op).
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE gh_internal_clients
      SET revoked_at = datetime('now')
      WHERE api_key_hash = ? AND revoked_at IS NULL
    `).run(old.api_key_hash);
  });
  tx();

  // Limpiar cache.
  _cache.clear();

  logger.info('Per-company client revocado', {
    id_empresa,
    api_key_hash_prefix: hashPrefix(old.api_key_hash),
    motivo,
    actor,
  });

  return {
    id_empresa,
    api_key_hash_prefix: hashPrefix(old.api_key_hash),
    revoked_at: new Date().toISOString(),
    motivo,
    actor,
  };
}

module.exports = {
  hashApiKey,
  hashPrefix,
  parseAllowedOperations,
  serializeAllowedOperations,
  getByHash,
  getActiveClientByApiKey,
  getActiveClientByEmpresa,
  createClient,
  createPerCompanyClient,
  revokeClient,
  revokeClientByEmpresa,
  rotateClientByEmpresa,
  listActiveClients,
  listClients,
  lookupLegacyClient,
  // Exposed for tests
  clearCache,
  CACHE_TTL_MS,
  // Exposed for tests
  _generateApiKey,
};
