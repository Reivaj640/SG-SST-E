/**
 * Servicio de Idempotencia (I-003, D-1 Fase 1.1).
 *
 * Capa de persistencia y lógica de dominio para el endpoint
 * POST /v1/internal/sign-requests. Permite que K+AIR envíe un header
 * "Idempotency-Key" y el firma-service garantice:
 *
 *   - Misma (id_empresa, idempotency_key) + mismo fingerprint → mismo resultado (REPLAY)
 *   - Misma (id_empresa, idempotency_key) + fingerprint distinto → 409 IDEMPOTENCY_KEY_CONFLICT
 *   - In-flight (PENDING) → 409 IDEMPOTENCY_KEY_IN_PROGRESS
 *   - TERMINAL → bloquea retry incluso con mismo fingerprint (G8 refinado)
 *
 * Decisiones de diseño (ver docs/kair-firma-integration/I-003-design.md):
 *
 *   1. **Scope por empresa (G4)**: PK compuesta (id_empresa, idempotency_key).
 *      La misma string-key puede existir en distintas empresas sin conflicto.
 *
 *   2. **Fingerprint = SHA-256 de canonical JSON** de { ...metadata, pdf_sha256 }.
 *      Canonicalización: keys alfabéticas recursivas, sin espacios, arrays en orden.
 *      Si el cliente cambia el PDF manteniendo el metadata → fingerprint cambia
 *      → 409 CONFLICT (decisión G6 refinado).
 *
 *   3. **PDF NO se almacena** (G6): solo el sha256. El PDF binario es grande
 *      (~MB) y se almacena aparte vía storage. La tabla solo tiene metadata
 *      de idempotencia.
 *
 *   4. **TTL 24h, lazy cleanup**: la fila expira 24h después de created_at.
 *      La limpieza es LAZY (se ejecuta en cada getOrCreate y vía cleanup()
 *      explícito). NO hay timer/cron.
 *
 *   5. **In-flight timeout 5min (G7)**: una fila PENDING con created_at más
 *      viejo que 5min se interpreta como "el proceso crasheó o se olvidó
 *      de cerrar la key". getOrCreate la trata como expirada y permite
 *      retry limpio.
 *
 *   6. **status whitelist (G8 refinado)**: PENDING | COMPLETED | FAILED | TERMINAL.
 *      - PENDING: in-flight.
 *      - COMPLETED: éxito 2xx, response cacheada, REPLAY permitido.
 *      - FAILED: error 5xx recuperable, retry permitido (response NO se popula).
 *      - TERMINAL: rechazo deliberado de negocio, retry BLOQUEADO incluso con
 *        mismo fingerprint. La clasificación TERMINAL es decisión explícita
 *        del handler (I-003.3), no automática.
 *
 *   7. **ISO 8601 estricto para expires_at y comparaciones**:
 *      - expires_at se almacena en formato 'YYYY-MM-DDTHH:MM:SS.mmmZ'.
 *      - created_at se almacena en formato 'YYYY-MM-DD HH:MM:SS' (default del schema).
 *      - Para comparar expires_at < now usamos `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
 *        (NUNCA `datetime('now')` para expirar, porque ' ' < 'T' lexicográfico
 *        haría fallar la comparación).
 *      - Para comparar created_at < now-5min convertimos created_at a ISO
 *        con `strftime('%Y-%m-%dT%H:%M:%fZ', created_at) < strftime(... '-300 seconds')`.
 *
 *   8. **Errores específicos (I-003.3 los mapea a HTTP)**: este service
 *      NO conoce HTTP. Solo lanza errores con `code` y `details` para que
 *      el middleware decida el status code.
 */
'use strict';

const db = require('../db/connection');
const { sha256 } = require('../crypto/hash');
const logger = require('../utils/logger');

// =====================================================================
// Constantes
// =====================================================================

/**
 * Regex UUID v4 según G2.
 *   - 8-4-4-4-12 hex chars.
 *   - Tercera sección empieza con 1-5 (versión: 1-5; aceptamos 1-5 por
 *     flexibilidad pero el cliente DEBE usar v4 en producción).
 *   - Cuarta sección empieza con 8/9/a/b (variant RFC 4122).
 *   - Case-insensitive.
 */
const IDEMPOTENCY_KEY_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Máximo 255 chars (alineado con HTTP header size limits). */
const MAX_KEY_LENGTH = 255;

/** TTL de la fila: 24h (ver INTEGRATION §1 decisión #1). */
const TTL_HOURS = 24;

/** In-flight timeout: 5 min. PENDING más viejo que esto se trata como crash. */
const PENDING_TIMEOUT_SECONDS = 300;

/** Whitelist de status (G8 refinado). */
const VALID_STATUSES = new Set(['PENDING', 'COMPLETED', 'FAILED', 'TERMINAL']);

/**
 * SQL fragment: "now" en formato ISO 8601 estricto.
 * USAR EN QUERIES DE COMPARACIÓN (no en almacenamiento si la columna usa
 * otro formato).
 */
const IDEMPOTENCY_SQL_NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/**
 * SQL fragment: "now + 24h" en formato ISO 8601 estricto.
 * USAR COMO DEFAULT DE expires_at EN INSERT.
 */
const IDEMPOTENCY_SQL_NEW_EXPIRES = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+${TTL_HOURS} hours')`;

/**
 * SQL fragment: "now - 5min" en formato ISO 8601 estricto.
 * USAR EN COMPARACIONES CON created_at (convirtiendo created_at a ISO).
 */
const IDEMPOTENCY_SQL_PENDING_TIMEOUT = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${PENDING_TIMEOUT_SECONDS} seconds')`;

// =====================================================================
// Clases de error
// =====================================================================
//
// Este service NO conoce HTTP. Solo lanza errores tipados con `code` y
// `details`. El middleware en I-003.3 mapea el `code` a status code HTTP.
// Esto mantiene la separación de capas (I-003.2: dominio; I-003.3: HTTP).

/**
 * Base para todos los errores de idempotencia.
 * El middleware en I-003.3 inspecciona `code` para mapear a HTTP.
 */
class IdempotencyError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'IdempotencyError';
    this.code = code;
    this.details = details;
  }
}

/** idem-key malformada, vacía, demasiado larga, o no es UUID v4. → HTTP 400. */
class IdempotencyKeyInvalid extends IdempotencyError {
  constructor(message, details) {
    super('IDEMPOTENCY_KEY_INVALID', message, details);
    this.name = 'IdempotencyKeyInvalid';
  }
}

/** Misma (id_empresa, key) con fingerprint distinto. → HTTP 409. */
class IdempotencyKeyConflict extends IdempotencyError {
  constructor(message, details) {
    super('IDEMPOTENCY_KEY_CONFLICT', message, details);
    this.name = 'IdempotencyKeyConflict';
  }
}

/** Misma (id_empresa, key) PENDING y dentro del in-flight timeout. → HTTP 409. */
class IdempotencyKeyInProgress extends IdempotencyError {
  constructor(message, details) {
    super('IDEMPOTENCY_KEY_IN_PROGRESS', message, details);
    this.name = 'IdempotencyKeyInProgress';
  }
}

/** Misma (id_empresa, key) marcada TERMINAL. Retry bloqueado. → HTTP 409. */
class IdempotencyKeyTerminal extends IdempotencyError {
  constructor(message, details) {
    super('IDEMPOTENCY_KEY_TERMINAL', message, details);
    this.name = 'IdempotencyKeyTerminal';
  }
}

// =====================================================================
// validateKey
// =====================================================================

/**
 * Valida que `idempotency_key` sea un string no vacío, ≤255 chars, y
 * matchee el regex UUID v4 (G2).
 *
 * @param {string} idempotency_key
 * @throws {IdempotencyKeyInvalid} si la key es inválida (con `reason` en details)
 */
function validateKey(idempotency_key) {
  if (typeof idempotency_key !== 'string') {
    throw new IdempotencyKeyInvalid(
      'idempotency_key debe ser un string',
      { reason: 'not_a_string', received_type: typeof idempotency_key }
    );
  }
  if (idempotency_key.length === 0) {
    throw new IdempotencyKeyInvalid(
      'idempotency_key no puede estar vacío',
      { reason: 'empty' }
    );
  }
  if (idempotency_key.length > MAX_KEY_LENGTH) {
    throw new IdempotencyKeyInvalid(
      `idempotency_key excede el máximo de ${MAX_KEY_LENGTH} chars (recibido: ${idempotency_key.length})`,
      { reason: 'too_long', length: idempotency_key.length, max: MAX_KEY_LENGTH }
    );
  }
  if (!IDEMPOTENCY_KEY_REGEX.test(idempotency_key)) {
    throw new IdempotencyKeyInvalid(
      'idempotency_key no es un UUID v4 válido',
      { reason: 'not_uuid_v4' }
    );
  }
}

// =====================================================================
// canonicalJson
// =====================================================================

/**
 * Serializa `value` a JSON canónico:
 *   - Keys de objetos ordenadas alfabéticamente (recursivo, en cada nivel).
 *   - Arrays preservan orden (no se reordenan).
 *   - Sin espacios.
 *   - Tipos preservados: string, number, bool, null.
 *   - null → 'null'.
 *
 * Usado para que el fingerprint sea independiente del orden de las keys
 * en el metadata. Importante: el cliente puede serializar `{"a":1,"b":2}`
 * o `{"b":2,"a":1}` y el fingerprint será el mismo.
 *
 * @param {*} value
 * @returns {string} JSON canónico
 */
function canonicalJson(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const parts = keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(value[k]));
    return '{' + parts.join(',') + '}';
  }
  // string, number, boolean — JSON.stringify maneja todos
  return JSON.stringify(value);
}

// =====================================================================
// computeFingerprint
// =====================================================================

/**
 * Computa el fingerprint SHA-256 del request.
 *
 *   fingerprint = SHA-256(canonical_json({ ...metadata, pdf_sha256 }))
 *
 * El fingerprint es determinista: mismo metadata + mismo pdf → mismo
 * fingerprint, independientemente del orden de las keys o espacios.
 *
 * @param {object} opts
 * @param {object} opts.metadata - metadata arbitrario (puede ser null/undefined → {})
 * @param {string} opts.pdf_sha256 - SHA-256 hex (64 chars) del PDF binario
 * @returns {string} fingerprint SHA-256 hex (64 chars)
 * @throws {IdempotencyError} code 'INVALID_REQUEST' si pdf_sha256 es inválido
 */
function computeFingerprint({ metadata, pdf_sha256 }) {
  if (typeof pdf_sha256 !== 'string' || pdf_sha256.length === 0) {
    throw new IdempotencyError(
      'INVALID_REQUEST',
      'pdf_sha256 es requerido y debe ser string no vacío',
      { reason: 'pdf_sha256_missing' }
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(pdf_sha256)) {
    throw new IdempotencyError(
      'INVALID_REQUEST',
      'pdf_sha256 debe ser hex SHA-256 de 64 chars',
      { reason: 'pdf_sha256_not_hex', length: pdf_sha256.length }
    );
  }
  const meta = (metadata === null || metadata === undefined) ? {} : metadata;
  // Normalizar pdf_sha256 a lowercase para que el fingerprint no dependa
  // de mayúsculas/minúsculas del hash del PDF.
  const fingerprintInput = canonicalJson({
    ...meta,
    pdf_sha256: pdf_sha256.toLowerCase(),
  });
  return sha256(fingerprintInput);
}

// =====================================================================
// lookupByKey
// =====================================================================

/**
 * Busca una fila por (id_empresa, idempotency_key). Retorna la fila completa
 * o null si no existe.
 *
 * NO valida la key (eso lo hace validateKey / getOrCreate). Esta función
 * es utilitaria para lookup directo.
 *
 * @param {object} opts
 * @param {string} opts.id_empresa
 * @param {string} opts.idempotency_key
 * @returns {object|null} Fila con todas las columnas, o null
 */
function lookupByKey({ id_empresa, idempotency_key }) {
  if (typeof id_empresa !== 'string' || id_empresa.length === 0) return null;
  if (typeof idempotency_key !== 'string' || idempotency_key.length === 0) return null;
  return db.prepare(`
    SELECT id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status,
           response_status, response_body, created_at, expires_at, completed_at
    FROM gh_idempotency_keys
    WHERE id_empresa = ? AND idempotency_key = ?
  `).get(id_empresa, idempotency_key) || null;
}

// =====================================================================
// _insertPending (helper interno)
// =====================================================================

/**
 * Inserta una nueva fila PENDING. Helper privado de getOrCreate.
 *
 * Maneja la race condition: si dos procesos llaman a getOrCreate
 * simultáneamente, ambos pueden pasar el SELECT sin ver la fila del otro,
 * pero el segundo INSERT fallará por PK compuesta (UNIQUE). En ese caso,
 * re-leemos y propagamos el error apropiado (in-progress o conflict).
 *
 * @param {object} args
 * @param {string} args.id_empresa
 * @param {string} args.idempotency_key
 * @param {string} args.fingerprint
 * @param {string} args.pdfSha - pdf_sha256 normalizado a lowercase
 * @param {boolean} args.wasExpired - true si se reemplazó una fila expirada
 * @returns {{ isNew?: boolean, isExpired?: boolean, wasNewlyCreated?: boolean, row: object, fingerprint: string }}
 */
function _insertPending({ id_empresa, idempotency_key, fingerprint, pdfSha, wasExpired = false }) {
  try {
    db.prepare(`
      INSERT INTO gh_idempotency_keys
        (id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, 'PENDING', ${IDEMPOTENCY_SQL_NOW}, ${IDEMPOTENCY_SQL_NEW_EXPIRES})
    `).run(id_empresa, idempotency_key, fingerprint, pdfSha);
  } catch (e) {
    // Race: UNIQUE constraint (PK compuesta) o PRIMARY KEY constraint.
    // Re-SELECT y propagar el error apropiado.
    if (!/UNIQUE constraint failed|PRIMARY KEY constraint failed/i.test(e.message)) {
      throw e;
    }
    const raced = lookupByKey({ id_empresa, idempotency_key });
    if (!raced) {
      // No debería pasar — si la UNIQUE falló, la fila debería existir.
      // Pero si pasa, propagamos el error original.
      throw e;
    }
    if (raced.status === 'PENDING') {
      throw new IdempotencyKeyInProgress(
        'Ya hay una operación en curso con esta idempotency_key (race detectada)',
        { created_at: raced.created_at, retry_after: PENDING_TIMEOUT_SECONDS }
      );
    }
    if (raced.status === 'TERMINAL') {
      throw new IdempotencyKeyTerminal(
        'La idempotency_key fue marcada como TERMINAL (race detectada)',
        { existing_status: 'TERMINAL' }
      );
    }
    // COMPLETED o FAILED → conflict (otra request usó la misma key).
    throw new IdempotencyKeyConflict(
      'La idempotency_key ya existe con otro estado (race detectada)',
      { existing_status: raced.status }
    );
  }
  const row = lookupByKey({ id_empresa, idempotency_key });
  logger.info('Idempotency key creada (PENDING)', {
    idempotency_key_prefix: idempotency_key.slice(0, 8),
    fingerprint_prefix: fingerprint.slice(0, 8),
    replaced_expired: wasExpired,
  });
  if (wasExpired) {
    return { isExpired: true, wasNewlyCreated: true, row, fingerprint };
  }
  return { isNew: true, row, fingerprint };
}

// =====================================================================
// getOrCreate
// =====================================================================

/**
 * Función principal. Lógica de decisión:
 *
 *   1. validateKey (UUID v4, no vacía, ≤255).
 *   2. computeFingerprint (canonical JSON + SHA-256).
 *   3. SELECT fila existente por (id_empresa, idempotency_key).
 *   4. Si no existe → INSERT PENDING nueva. Retorna { isNew: true, row, fingerprint }.
 *   5. Si existe y expires_at < now (TTL 24h expirado) → DELETE + INSERT nueva.
 *      Retorna { isExpired: true, wasNewlyCreated: true, row, fingerprint }.
 *   6. Si existe y status='PENDING':
 *      a. Si created_at < now-5min (in-flight timeout) → DELETE + INSERT nueva.
 *         Retorna { isExpired: true, wasNewlyCreated: true, row, fingerprint }.
 *      b. Else → throw IdempotencyKeyInProgress con created_at y retry_after.
 *   7. Si status='COMPLETED' o 'FAILED':
 *      a. Si fingerprint === actual:
 *         - COMPLETED → { isReplay: true, row, fingerprint }.
 *         - FAILED → { isRetry: true, row, fingerprint } (retry permitido).
 *      b. Si fingerprint !== actual → throw IdempotencyKeyConflict.
 *   8. Si status='TERMINAL':
 *      a. Si fingerprint === actual → throw IdempotencyKeyTerminal
 *         (G8 refinado: TERMINAL bloquea retry incluso con mismo fingerprint).
 *      b. Si fingerprint !== actual → throw IdempotencyKeyConflict
 *         (defense in depth: TERMINAL bloquea cualquier retry).
 *
 * @param {object} opts
 * @param {string} opts.id_empresa
 * @param {string} opts.idempotency_key - UUID v4 (validado por validateKey)
 * @param {object} [opts.metadata] - metadata arbitrario del request
 * @param {string} opts.pdf_sha256 - SHA-256 hex (64 chars) del PDF
 * @returns {object} Resultado: { isNew, isExpired, isReplay, isRetry, row, fingerprint }
 * @throws {IdempotencyKeyInvalid} si la key no es UUID v4
 * @throws {IdempotencyError} si pdf_sha256 o id_empresa son inválidos
 * @throws {IdempotencyKeyInProgress} si la key está PENDING dentro del timeout
 * @throws {IdempotencyKeyConflict} si la key existe con fingerprint distinto
 * @throws {IdempotencyKeyTerminal} si la key está TERMINAL
 */
function getOrCreate({ id_empresa, idempotency_key, metadata, pdf_sha256 }) {
  // 1. Validar id_empresa
  if (typeof id_empresa !== 'string' || id_empresa.length === 0) {
    throw new IdempotencyError(
      'INVALID_REQUEST',
      'id_empresa es requerido',
      { reason: 'id_empresa_missing' }
    );
  }
  // 2. Validar idempotency_key
  validateKey(idempotency_key);
  // 3. Computar fingerprint
  const fingerprint = computeFingerprint({ metadata, pdf_sha256 });
  const pdfSha = pdf_sha256.toLowerCase();

  // 4. SELECT fila existente con flags de expiry precomputados.
  //    Esto evita 2-3 round-trips a SQLite (lookupByKey + query expiry +
  //    query elapsed). Las flags `is_ttl_expired` e `is_inflight_expired`
  //    se evalúan en SQL (formato consistente, lexicographic funciona).
  const existing = db.prepare(`
    SELECT
      id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status,
      response_status, response_body, created_at, expires_at, completed_at,
      (expires_at < ${IDEMPOTENCY_SQL_NOW}) AS is_ttl_expired,
      (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) < ${IDEMPOTENCY_SQL_PENDING_TIMEOUT}) AS is_inflight_expired,
      CAST((julianday('now') - julianday(created_at)) * 86400 AS INTEGER) AS elapsed_seconds
    FROM gh_idempotency_keys
    WHERE id_empresa = ? AND idempotency_key = ?
  `).get(id_empresa, idempotency_key);

  // 5. No existe → INSERT nueva PENDING
  if (!existing) {
    return _insertPending({ id_empresa, idempotency_key, fingerprint, pdfSha, wasExpired: false });
  }

  // 6. TTL expirado (>24h) → reemplazar
  if (existing.is_ttl_expired) {
    db.prepare(
      'DELETE FROM gh_idempotency_keys WHERE id_empresa = ? AND idempotency_key = ?'
    ).run(id_empresa, idempotency_key);
    logger.info('Idempotency key expirada por TTL, reemplazada', {
      idempotency_key_prefix: idempotency_key.slice(0, 8),
      old_expires_at: existing.expires_at,
    });
    return _insertPending({ id_empresa, idempotency_key, fingerprint, pdfSha, wasExpired: true });
  }

  // 7. PENDING — verificar in-flight timeout (G7)
  if (existing.status === 'PENDING') {
    if (existing.is_inflight_expired) {
      // El proceso anterior crasheó o se olvidó de cerrar la key.
      // Interpretamos como expirada y permitimos retry limpio.
      db.prepare(
        'DELETE FROM gh_idempotency_keys WHERE id_empresa = ? AND idempotency_key = ?'
      ).run(id_empresa, idempotency_key);
      logger.info('Idempotency key PENDING con in-flight timeout, reemplazada (crash detectado)', {
        idempotency_key_prefix: idempotency_key.slice(0, 8),
        elapsed_seconds: existing.elapsed_seconds,
      });
      return _insertPending({ id_empresa, idempotency_key, fingerprint, pdfSha, wasExpired: true });
    }
    // In-flight activo: rechazar con 409 IN_PROGRESS.
    const retryAfter = Math.max(1, PENDING_TIMEOUT_SECONDS - (existing.elapsed_seconds || 0));
    throw new IdempotencyKeyInProgress(
      'Ya hay una operación en curso con esta idempotency_key',
      {
        created_at: existing.created_at,
        retry_after: retryAfter,
      }
    );
  }

  // 8. COMPLETED o FAILED — comparar fingerprint
  if (existing.status === 'COMPLETED' || existing.status === 'FAILED') {
    if (existing.request_fingerprint === fingerprint) {
      if (existing.status === 'COMPLETED') {
        // REPLAY: devolver la respuesta cacheada.
        return { isReplay: true, row: existing, fingerprint };
      }
      // FAILED: retry permitido (response NO se popula en FAILED).
      return { isRetry: true, row: existing, fingerprint };
    }
    // Misma key, fingerprint distinto → CONFLICT.
    throw new IdempotencyKeyConflict(
      'La idempotency_key ya fue usada con un fingerprint distinto',
      {
        existing_status: existing.status,
        existing_fingerprint_prefix: existing.request_fingerprint.slice(0, 8),
      }
    );
  }

  // 9. TERMINAL — bloquea retry incluso con mismo fingerprint (G8 refinado).
  if (existing.status === 'TERMINAL') {
    if (existing.request_fingerprint === fingerprint) {
      throw new IdempotencyKeyTerminal(
        'La idempotency_key fue marcada como TERMINAL — retry bloqueado',
        {
          existing_status: 'TERMINAL',
          response_status: existing.response_status,
        }
      );
    }
    // TERMINAL con fingerprint distinto: defense in depth, conflict.
    throw new IdempotencyKeyConflict(
      'La idempotency_key ya fue usada con un fingerprint distinto y está marcada TERMINAL',
      { existing_status: 'TERMINAL' }
    );
  }

  // Status inesperado (no debería pasar dado el CHECK constraint, pero
  // defense in depth).
  throw new IdempotencyError(
    'UNEXPECTED_STATUS',
    `Status inesperado en gh_idempotency_keys: ${existing.status}`,
    { status: existing.status }
  );
}

// =====================================================================
// markComplete
// =====================================================================

/**
 * Marca una fila como COMPLETED y cachea la respuesta para REPLAY.
 *
 * Idempotency: si la fila ya está COMPLETED con misma response, se sobreescribe
 * (no es estrictamente idempotente, pero en la práctica getOrCreate maneja
 * la concurrencia vía UNIQUE constraint). El handler DEBE llamar a
 * markComplete SOLO después de un getOrCreate exitoso con isNew=true.
 *
 * @param {object} opts
 * @param {string} opts.id_empresa
 * @param {string} opts.idempotency_key
 * @param {number} opts.response_status - HTTP status code (integer 200-599)
 * @param {object} opts.response_body - body JSON-serializable
 * @returns {object} fila actualizada
 * @throws {IdempotencyError} code 'INVALID_REQUEST' si args inválidos
 * @throws {IdempotencyError} code 'IDEMPOTENCY_KEY_NOT_FOUND' si no existe la fila
 */
function markComplete({ id_empresa, idempotency_key, response_status, response_body }) {
  if (typeof id_empresa !== 'string' || id_empresa.length === 0) {
    throw new IdempotencyError('INVALID_REQUEST', 'id_empresa es requerido', { reason: 'id_empresa_missing' });
  }
  if (typeof idempotency_key !== 'string' || idempotency_key.length === 0) {
    throw new IdempotencyError('INVALID_REQUEST', 'idempotency_key es requerido', { reason: 'idempotency_key_missing' });
  }
  if (typeof response_status !== 'number' || !Number.isInteger(response_status)) {
    throw new IdempotencyError(
      'INVALID_REQUEST',
      'response_status debe ser un integer (HTTP status code)',
      { reason: 'response_status_invalid', received_type: typeof response_status }
    );
  }
  const bodyStr = response_body === null || response_body === undefined
    ? null
    : JSON.stringify(response_body);
  const result = db.prepare(`
    UPDATE gh_idempotency_keys
    SET status = 'COMPLETED',
        response_status = ?,
        response_body = ?,
        completed_at = ${IDEMPOTENCY_SQL_NOW}
    WHERE id_empresa = ? AND idempotency_key = ?
  `).run(response_status, bodyStr, id_empresa, idempotency_key);
  if (result.changes === 0) {
    throw new IdempotencyError(
      'IDEMPOTENCY_KEY_NOT_FOUND',
      'No existe una fila para (id_empresa, idempotency_key)',
      { id_empresa, idempotency_key_prefix: idempotency_key.slice(0, 8) }
    );
  }
  logger.info('Idempotency key marcada como COMPLETED', {
    idempotency_key_prefix: idempotency_key.slice(0, 8),
    response_status,
  });
  return lookupByKey({ id_empresa, idempotency_key });
}

// =====================================================================
// markFailed
// =====================================================================

/**
 * Marca una fila como FAILED. NO popula response_status ni response_body
 * (G8 refinado: FAILED se reintenta limpio, sin cache de error).
 *
 * @param {object} opts
 * @param {string} opts.id_empresa
 * @param {string} opts.idempotency_key
 * @returns {object} fila actualizada
 * @throws {IdempotencyError} code 'INVALID_REQUEST' si args inválidos
 * @throws {IdempotencyError} code 'IDEMPOTENCY_KEY_NOT_FOUND' si no existe la fila
 */
function markFailed({ id_empresa, idempotency_key }) {
  if (typeof id_empresa !== 'string' || id_empresa.length === 0) {
    throw new IdempotencyError('INVALID_REQUEST', 'id_empresa es requerido', { reason: 'id_empresa_missing' });
  }
  if (typeof idempotency_key !== 'string' || idempotency_key.length === 0) {
    throw new IdempotencyError('INVALID_REQUEST', 'idempotency_key es requerido', { reason: 'idempotency_key_missing' });
  }
  const result = db.prepare(`
    UPDATE gh_idempotency_keys
    SET status = 'FAILED',
        response_status = NULL,
        response_body = NULL,
        completed_at = ${IDEMPOTENCY_SQL_NOW}
    WHERE id_empresa = ? AND idempotency_key = ?
  `).run(id_empresa, idempotency_key);
  if (result.changes === 0) {
    throw new IdempotencyError(
      'IDEMPOTENCY_KEY_NOT_FOUND',
      'No existe una fila para (id_empresa, idempotency_key)',
      { id_empresa, idempotency_key_prefix: idempotency_key.slice(0, 8) }
    );
  }
  logger.warn('Idempotency key marcada como FAILED', {
    idempotency_key_prefix: idempotency_key.slice(0, 8),
  });
  return lookupByKey({ id_empresa, idempotency_key });
}

// =====================================================================
// markTerminal
// =====================================================================

/**
 * Marca una fila como TERMINAL. A diferencia de FAILED, TERMINAL bloquea
 * retry (G8 refinado). Se popula response_status y response_body para que
 * el middleware pueda devolver la misma respuesta en retry bloqueado.
 *
 * @param {object} opts
 * @param {string} opts.id_empresa
 * @param {string} opts.idempotency_key
 * @param {number} opts.response_status - HTTP status code (integer, típicamente 4xx)
 * @param {object} opts.response_body - body JSON-serializable
 * @returns {object} fila actualizada
 * @throws {IdempotencyError} code 'INVALID_REQUEST' si args inválidos
 * @throws {IdempotencyError} code 'IDEMPOTENCY_KEY_NOT_FOUND' si no existe la fila
 */
function markTerminal({ id_empresa, idempotency_key, response_status, response_body }) {
  if (typeof id_empresa !== 'string' || id_empresa.length === 0) {
    throw new IdempotencyError('INVALID_REQUEST', 'id_empresa es requerido', { reason: 'id_empresa_missing' });
  }
  if (typeof idempotency_key !== 'string' || idempotency_key.length === 0) {
    throw new IdempotencyError('INVALID_REQUEST', 'idempotency_key es requerido', { reason: 'idempotency_key_missing' });
  }
  if (typeof response_status !== 'number' || !Number.isInteger(response_status)) {
    throw new IdempotencyError(
      'INVALID_REQUEST',
      'response_status debe ser un integer (HTTP status code)',
      { reason: 'response_status_invalid', received_type: typeof response_status }
    );
  }
  const bodyStr = response_body === null || response_body === undefined
    ? null
    : JSON.stringify(response_body);
  const result = db.prepare(`
    UPDATE gh_idempotency_keys
    SET status = 'TERMINAL',
        response_status = ?,
        response_body = ?,
        completed_at = ${IDEMPOTENCY_SQL_NOW}
    WHERE id_empresa = ? AND idempotency_key = ?
  `).run(response_status, bodyStr, id_empresa, idempotency_key);
  if (result.changes === 0) {
    throw new IdempotencyError(
      'IDEMPOTENCY_KEY_NOT_FOUND',
      'No existe una fila para (id_empresa, idempotency_key)',
      { id_empresa, idempotency_key_prefix: idempotency_key.slice(0, 8) }
    );
  }
  logger.warn('Idempotency key marcada como TERMINAL (retry bloqueado)', {
    idempotency_key_prefix: idempotency_key.slice(0, 8),
    response_status,
  });
  return lookupByKey({ id_empresa, idempotency_key });
}

// =====================================================================
// cleanup
// =====================================================================

/**
 * Borra filas expiradas (expires_at < now). Retorna el número de filas borradas.
 *
 * La limpieza es LAZY: se ejecuta en cada getOrCreate (no en background).
 * Esta función es para limpieza explícita (ej. cron, admin endpoint).
 *
 * IMPORTANTE: usar `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` para el "now"
 * (NUNCA `datetime('now')`), porque expires_at está en formato ISO 8601
 * estricto con 'T' y la comparación lexicográfica fallaría con formato
 * 'YYYY-MM-DD HH:MM:SS' (espacio < 'T').
 *
 * @returns {number} filas eliminadas
 */
function cleanup() {
  const result = db.prepare(`
    DELETE FROM gh_idempotency_keys WHERE expires_at < ${IDEMPOTENCY_SQL_NOW}
  `).run();
  if (result.changes > 0) {
    logger.info('Idempotency cleanup', { deleted: result.changes });
  }
  return result.changes;
}

// =====================================================================
// Exports
// =====================================================================

module.exports = {
  // Clases de error (I-003.3 las importa para mapear a HTTP)
  IdempotencyError,
  IdempotencyKeyInvalid,
  IdempotencyKeyConflict,
  IdempotencyKeyInProgress,
  IdempotencyKeyTerminal,

  // Constantes (exportadas para tests y para I-003.3 si las necesita)
  IDEMPOTENCY_KEY_REGEX,
  MAX_KEY_LENGTH,
  TTL_HOURS,
  PENDING_TIMEOUT_SECONDS,
  IDEMPOTENCY_SQL_NOW,
  IDEMPOTENCY_SQL_PENDING_TIMEOUT,
  VALID_STATUSES,

  // Funciones principales
  validateKey,
  canonicalJson,
  computeFingerprint,
  getOrCreate,
  markComplete,
  markFailed,
  markTerminal,
  cleanup,
  lookupByKey,
};
