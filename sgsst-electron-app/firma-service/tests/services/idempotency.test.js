/**
 * Tests del service de idempotencia (I-003, D-1 Fase 1.1).
 *
 * Verifica COMPORTAMIENTO (no implementación):
 *
 *   1. validateKey: UUID v4, longitudes, formato
 *   2. canonicalJson: orden de keys, anidamiento, arrays
 *   3. computeFingerprint: determinismo, canonización
 *   4. getOrCreate: caso nuevo, REPLAY, CONFLICT, IN_PROGRESS, TERMINAL, TTL, in-flight timeout
 *   5. markComplete, markFailed, markTerminal: actualizan correctamente
 *   6. cleanup: borra solo las expiradas
 *   7. lookupByKey: retorna fila o null
 *   8. UNIQUE constraint: enforced at DB level
 *   9. PDF binary NO se almacena
 *
 * Decisiones validadas:
 *  - La función es sync (better-sqlite3 es sync).
 *  - El formato ISO 8601 estricto para expires_at (con T y Z) y la
 *    comparación lexicográfica contra `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`.
 *  - El scope por id_empresa: la misma key en distinta empresa NO colisiona.
 *  - TERMINAL bloquea retry incluso con mismo fingerprint (G8 refinado).
 *  - PENDING con in-flight timeout (5min) se trata como crash y permite retry.
 *
 * NOTA: La tabla `gh_idempotency_keys` no está en TABLES de helpers.js
 * (esa lista es estable y solo incluye las que NO se limpian en cada test
 * para no romper el schema registry). Por eso limpiamos manualmente.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../../src/db/connection');
const { resetDb } = require('../helpers');
const idempotency = require('../../src/services/idempotency');
const { sha256 } = require('../../src/crypto/hash');

// =====================================================================
// Constantes de test
// =====================================================================

const TEST_EMPRESA_A = '900123456';
const TEST_EMPRESA_B = '900999999';

// UUID v4 válido (random de ejemplo, formato correcto)
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

// Hash SHA-256 hex (64 chars) válido para tests
const VALID_PDF_SHA256 = 'a'.repeat(64);
const VALID_PDF_SHA256_B = 'b'.repeat(64);
const VALID_PDF_SHA256_C = 'c'.repeat(64);

const VALID_METADATA = {
  id_trabajador: '1234567890',
  id_documento: 'doc-001',
  tipo_firma: 'presencial',
};

function beforeEach() {
  resetDb();
  // Limpieza explícita de gh_idempotency_keys (no está en TABLES de helpers).
  db.prepare('DELETE FROM gh_idempotency_keys').run();
}

// =====================================================================
// 1. validateKey
// =====================================================================

test('I-003.2: validateKey acepta UUID v4 válido', () => {
  beforeEach();
  assert.doesNotThrow(() => idempotency.validateKey(VALID_UUID));
  // case-insensitive: el regex acepta mayúsculas también
  const upperUuid = '550E8400-E29B-41D4-A716-446655440000';
  assert.doesNotThrow(() => idempotency.validateKey(upperUuid));
  // acepta v1-v5 (el regex es [1-5] en posición de versión)
  const v1Uuid = '550e8400-e29b-11d4-a716-446655440000';
  assert.doesNotThrow(() => idempotency.validateKey(v1Uuid));
});

test('I-003.2: validateKey rechaza UUID sin guiones', () => {
  beforeEach();
  assert.throws(
    () => idempotency.validateKey('550e8400e29b41d4a716446655440000'),
    (err) => err instanceof idempotency.IdempotencyKeyInvalid && err.details.reason === 'not_uuid_v4'
  );
});

test('I-003.2: validateKey rechaza string vacío', () => {
  beforeEach();
  assert.throws(
    () => idempotency.validateKey(''),
    (err) => err instanceof idempotency.IdempotencyKeyInvalid && err.details.reason === 'empty'
  );
});

test('I-003.2: validateKey rechaza string > 255 chars', () => {
  beforeEach();
  const tooLong = 'a'.repeat(256);
  assert.throws(
    () => idempotency.validateKey(tooLong),
    (err) => err instanceof idempotency.IdempotencyKeyInvalid &&
            err.details.reason === 'too_long' &&
            err.details.length === 256
  );
});

test('I-003.2: validateKey rechaza UUID con versión 6 (fuera de [1-5])', () => {
  beforeEach();
  // 13 en hex = versión 6 → el regex [1-5] lo rechaza
  const v6Uuid = '550e8400-e29b-61d4-a716-446655440000';
  assert.throws(
    () => idempotency.validateKey(v6Uuid),
    (err) => err instanceof idempotency.IdempotencyKeyInvalid && err.details.reason === 'not_uuid_v4'
  );
});

test('I-003.2: validateKey rechaza null/undefined/non-string', () => {
  beforeEach();
  for (const bad of [null, undefined, 123, {}, [], true]) {
    assert.throws(
      () => idempotency.validateKey(bad),
      (err) => err instanceof idempotency.IdempotencyKeyInvalid,
      `debe rechazar valor: ${JSON.stringify(bad)}`
    );
  }
});

// =====================================================================
// 2. canonicalJson
// =====================================================================

test('I-003.2: canonicalJson ordena keys alfabéticamente (objetos simples)', () => {
  beforeEach();
  const a = idempotency.canonicalJson({ a: 1, b: 2 });
  const b = idempotency.canonicalJson({ b: 2, a: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":1,"b":2}');
});

test('I-003.2: canonicalJson ordena keys recursivamente (nested objects)', () => {
  beforeEach();
  const a = idempotency.canonicalJson({ z: { y: 1, x: 2 }, a: 'first' });
  const b = idempotency.canonicalJson({ a: 'first', z: { x: 2, y: 1 } });
  assert.equal(a, b);
  assert.equal(a, '{"a":"first","z":{"x":2,"y":1}}');
});

test('I-003.2: canonicalJson preserva orden de arrays (NO los reordena)', () => {
  beforeEach();
  const a = idempotency.canonicalJson([3, 1, 2]);
  const b = idempotency.canonicalJson([2, 3, 1]);
  assert.notEqual(a, b);
  assert.equal(a, '[3,1,2]');
  assert.equal(b, '[2,3,1]');
});

test('I-003.2: canonicalJson no usa espacios', () => {
  beforeEach();
  const out = idempotency.canonicalJson({ a: 1, b: [1, 2], c: { x: 'y' } });
  assert.equal(out, '{"a":1,"b":[1,2],"c":{"x":"y"}}');
  assert.ok(!out.includes(' '), 'no debe haber espacios');
});

test('I-003.2: canonicalJson maneja null, number, bool, string', () => {
  beforeEach();
  assert.equal(idempotency.canonicalJson(null), 'null');
  assert.equal(idempotency.canonicalJson(true), 'true');
  assert.equal(idempotency.canonicalJson(false), 'false');
  assert.equal(idempotency.canonicalJson(42), '42');
  assert.equal(idempotency.canonicalJson('hola'), '"hola"');
});

// =====================================================================
// 3. computeFingerprint
// =====================================================================

test('I-003.2: computeFingerprint es determinista (mismo input → mismo output)', () => {
  beforeEach();
  const f1 = idempotency.computeFingerprint({ metadata: VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  const f2 = idempotency.computeFingerprint({ metadata: VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(f1, f2);
  assert.equal(f1.length, 64);
  assert.equal(f1, sha256(idempotency.canonicalJson({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 })));
});

test('I-003.2: computeFingerprint cambia con metadata distinto', () => {
  beforeEach();
  const f1 = idempotency.computeFingerprint({ metadata: { a: 1 }, pdf_sha256: VALID_PDF_SHA256 });
  const f2 = idempotency.computeFingerprint({ metadata: { a: 2 }, pdf_sha256: VALID_PDF_SHA256 });
  assert.notEqual(f1, f2);
});

test('I-003.2: computeFingerprint cambia con pdf_sha256 distinto', () => {
  beforeEach();
  const f1 = idempotency.computeFingerprint({ metadata: VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  const f2 = idempotency.computeFingerprint({ metadata: VALID_METADATA, pdf_sha256: VALID_PDF_SHA256_B });
  assert.notEqual(f1, f2);
});

test('I-003.2: computeFingerprint es independiente del orden de keys (canonización)', () => {
  beforeEach();
  const metaA = { a: 1, b: 2, c: 3 };
  const metaB = { c: 3, a: 1, b: 2 };
  const f1 = idempotency.computeFingerprint({ metadata: metaA, pdf_sha256: VALID_PDF_SHA256 });
  const f2 = idempotency.computeFingerprint({ metadata: metaB, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(f1, f2, 'el orden de keys no debe afectar el fingerprint');
});

test('I-003.2: computeFingerprint normaliza mayúsculas de pdf_sha256 (case-insensitive)', () => {
  beforeEach();
  const upper = VALID_PDF_SHA256.toUpperCase();
  const f1 = idempotency.computeFingerprint({ metadata: {}, pdf_sha256: VALID_PDF_SHA256 });
  const f2 = idempotency.computeFingerprint({ metadata: {}, pdf_sha256: upper });
  assert.equal(f1, f2, 'mayúsculas/minúsculas de pdf_sha256 no deben cambiar el fingerprint');
});

test('I-003.2: computeFingerprint rechaza pdf_sha256 inválido', () => {
  beforeEach();
  assert.throws(
    () => idempotency.computeFingerprint({ metadata: {}, pdf_sha256: '' }),
    (err) => err.code === 'INVALID_REQUEST' && err.details.reason === 'pdf_sha256_missing'
  );
  assert.throws(
    () => idempotency.computeFingerprint({ metadata: {}, pdf_sha256: 'abc' }),
    (err) => err.code === 'INVALID_REQUEST' && err.details.reason === 'pdf_sha256_not_hex'
  );
  assert.throws(
    () => idempotency.computeFingerprint({ metadata: {}, pdf_sha256: null }),
    (err) => err.code === 'INVALID_REQUEST'
  );
});

// =====================================================================
// 4. getOrCreate: caso nuevo
// =====================================================================

test('I-003.2: getOrCreate con key nueva crea fila PENDING y retorna isNew=true', () => {
  beforeEach();
  const result = idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  });
  assert.equal(result.isNew, true);
  assert.ok(result.row, 'debe retornar la fila');
  assert.ok(result.fingerprint);
  assert.equal(result.fingerprint.length, 64);

  // Verificar contenido de la fila
  assert.equal(result.row.status, 'PENDING');
  assert.equal(result.row.response_status, null);
  assert.equal(result.row.response_body, null);
  assert.equal(result.row.completed_at, null);
  assert.equal(result.row.id_empresa, TEST_EMPRESA_A);
  assert.equal(result.row.idempotency_key, VALID_UUID);
  assert.equal(result.row.pdf_sha256, VALID_PDF_SHA256);

  // expires_at debe estar aproximadamente 24h en el futuro
  // (formato ISO 8601 estricto, lexicographic funciona con `now`)
  const expiresAt = new Date(result.row.expires_at);
  const now = new Date();
  const hoursAhead = (expiresAt - now) / (1000 * 60 * 60);
  assert.ok(hoursAhead > 23.9 && hoursAhead < 24.1,
    `expires_at debe estar ~24h en el futuro, está ${hoursAhead}h`);
});

// =====================================================================
// 5. getOrCreate: REPLAY idéntico (G9)
// =====================================================================

test('I-003.2: getOrCreate con misma key+metadata+pdf después de COMPLETED retorna isReplay=true', () => {
  beforeEach();
  const params = {
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  };
  // 1. Crear PENDING
  const first = idempotency.getOrCreate(params);
  assert.equal(first.isNew, true);

  // 2. Marcar como COMPLETED con response cacheada
  idempotency.markComplete({
    ...params,
    response_status: 201,
    response_body: { id: 'sign-001', status: 'pending_signature' },
  });

  // 3. Llamar getOrCreate con mismos params → REPLAY
  const replay = idempotency.getOrCreate(params);
  assert.equal(replay.isReplay, true);
  assert.equal(replay.fingerprint, first.fingerprint);
  assert.equal(replay.row.status, 'COMPLETED');
  assert.equal(replay.row.response_status, 201);
  // response_body fue serializado a string en BD
  assert.equal(typeof replay.row.response_body, 'string');
  const parsed = JSON.parse(replay.row.response_body);
  assert.equal(parsed.id, 'sign-001');
});

// =====================================================================
// 6. getOrCreate: CONFLICT con fingerprint distinto (G6)
// =====================================================================

test('I-003.2: getOrCreate con misma key pero metadata distinto (después de COMPLETED) → CONFLICT', () => {
  beforeEach();
  const paramsA = {
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: { id_trabajador: '111' },
    pdf_sha256: VALID_PDF_SHA256,
  };
  // 1. Crear y completar con metadata A
  idempotency.getOrCreate(paramsA);
  idempotency.markComplete({
    ...paramsA,
    response_status: 201,
    response_body: { ok: true },
  });

  // 2. Llamar getOrCreate con MISMA key pero metadata B
  const paramsB = {
    ...paramsA,
    metadata: { id_trabajador: '222' },  // distinto
  };
  assert.throws(
    () => idempotency.getOrCreate(paramsB),
    (err) => err instanceof idempotency.IdempotencyKeyConflict &&
            err.code === 'IDEMPOTENCY_KEY_CONFLICT' &&
            err.details.existing_status === 'COMPLETED'
  );
});

// =====================================================================
// 7. getOrCreate: IN_PROGRESS
// =====================================================================

test('I-003.2: getOrCreate con key PENDING dentro del in-flight timeout → IN_PROGRESS', () => {
  beforeEach();
  const params = {
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  };
  // 1. Crear PENDING
  idempotency.getOrCreate(params);

  // 2. Llamar getOrCreate de nuevo → IN_PROGRESS
  assert.throws(
    () => idempotency.getOrCreate(params),
    (err) => {
      return err instanceof idempotency.IdempotencyKeyInProgress &&
             err.code === 'IDEMPOTENCY_KEY_IN_PROGRESS' &&
             typeof err.details.created_at === 'string' &&
             typeof err.details.retry_after === 'number' &&
             err.details.retry_after > 0 &&
             err.details.retry_after <= 300;  // hasta 5min
    }
  );
});

// =====================================================================
// 8. getOrCreate: TERMINAL bloquea retry
// =====================================================================

test('I-003.2: getOrCreate con key TERMINAL (incluso mismo fingerprint) → IdempotencyKeyTerminal', () => {
  beforeEach();
  const params = {
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  };
  // 1. Crear PENDING → COMPLETED → TERMINAL
  idempotency.getOrCreate(params);
  idempotency.markComplete({
    ...params,
    response_status: 201,
    response_body: { id: 'x' },
  });
  idempotency.markTerminal({
    ...params,
    response_status: 422,
    response_body: { error: 'documento_rechazado' },
  });

  // 2. Llamar getOrCreate con MISMO fingerprint → TERMINAL bloquea
  assert.throws(
    () => idempotency.getOrCreate(params),
    (err) => err instanceof idempotency.IdempotencyKeyTerminal &&
            err.code === 'IDEMPOTENCY_KEY_TERMINAL' &&
            err.details.response_status === 422
  );
});

test('I-003.2: getOrCreate con key TERMINAL y fingerprint distinto → CONFLICT (defense in depth)', () => {
  beforeEach();
  const paramsA = {
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  };
  idempotency.getOrCreate(paramsA);
  idempotency.markComplete({ ...paramsA, response_status: 201, response_body: {} });
  idempotency.markTerminal({ ...paramsA, response_status: 422, response_body: {} });

  const paramsB = { ...paramsA, metadata: { other: 'data' } };  // fingerprint cambia
  assert.throws(
    () => idempotency.getOrCreate(paramsB),
    (err) => err instanceof idempotency.IdempotencyKeyConflict &&
            err.code === 'IDEMPOTENCY_KEY_CONFLICT' &&
            err.details.existing_status === 'TERMINAL'
  );
});

// =====================================================================
// 9. getOrCreate: TTL expiry (24h)
// =====================================================================

test('I-003.2: getOrCreate con fila expirada (TTL 24h) crea nueva fila, retorna isExpired=true', () => {
  beforeEach();
  const params = {
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  };
  // 1. Crear fila PENDING
  const first = idempotency.getOrCreate(params);
  assert.equal(first.isNew, true);

  // 2. Forzar expiración: actualizar expires_at al pasado
  db.prepare(`
    UPDATE gh_idempotency_keys
    SET expires_at = '2000-01-01T00:00:00.000Z'
    WHERE id_empresa = ? AND idempotency_key = ?
  `).run(TEST_EMPRESA_A, VALID_UUID);

  // 3. Llamar getOrCreate → debe crear nueva fila, retornar isExpired
  const second = idempotency.getOrCreate(params);
  assert.equal(second.isExpired, true);
  assert.equal(second.wasNewlyCreated, true);
  assert.ok(second.row);
  assert.equal(second.row.status, 'PENDING');
  // El nuevo expires_at debe estar en el futuro (no en 2000)
  const expiresAt = new Date(second.row.expires_at);
  const now = new Date();
  assert.ok(expiresAt > now, 'el nuevo expires_at debe estar en el futuro');
});

// =====================================================================
// 10. getOrCreate: in-flight timeout (5 min)
// =====================================================================

test('I-003.2: getOrCreate con PENDING > 5min trata como crash y reemplaza (G7)', () => {
  beforeEach();
  const params = {
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  };
  // 1. Crear PENDING
  idempotency.getOrCreate(params);

  // 2. Forzar created_at a 6 min atrás (simula crash)
  db.prepare(`
    UPDATE gh_idempotency_keys
    SET created_at = datetime('now', '-6 minutes')
    WHERE id_empresa = ? AND idempotency_key = ?
  `).run(TEST_EMPRESA_A, VALID_UUID);

  // 3. Llamar getOrCreate → debe reemplazar como expirada
  const result = idempotency.getOrCreate(params);
  assert.equal(result.isExpired, true);
  assert.equal(result.wasNewlyCreated, true);
  assert.equal(result.row.status, 'PENDING');
});

test('I-003.2: getOrCreate con PENDING < 5min NO reemplaza (in-flight activo)', () => {
  beforeEach();
  const params = {
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  };
  // 1. Crear PENDING
  idempotency.getOrCreate(params);

  // 2. Forzar created_at a 1 min atrás (dentro del timeout)
  db.prepare(`
    UPDATE gh_idempotency_keys
    SET created_at = datetime('now', '-1 minute')
    WHERE id_empresa = ? AND idempotency_key = ?
  `).run(TEST_EMPRESA_A, VALID_UUID);

  // 3. Llamar getOrCreate → debe lanzar IN_PROGRESS, no reemplazar
  assert.throws(
    () => idempotency.getOrCreate(params),
    (err) => err instanceof idempotency.IdempotencyKeyInProgress
  );
});

// =====================================================================
// 11. getOrCreate: scope por id_empresa (G4)
// =====================================================================

test('I-003.2: misma idempotency_key en distintas empresas NO colisiona (G4)', () => {
  beforeEach();
  const paramsA = {
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  };
  const paramsB = {
    id_empresa: TEST_EMPRESA_B,
    idempotency_key: VALID_UUID,  // MISMO string
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  };

  // Empresa A crea
  const resultA = idempotency.getOrCreate(paramsA);
  assert.equal(resultA.isNew, true);

  // Empresa B crea con MISMO key
  const resultB = idempotency.getOrCreate(paramsB);
  assert.equal(resultB.isNew, true, 'empresa B debe poder crear la misma key sin conflicto');

  // Ambas filas existen
  const count = db.prepare('SELECT COUNT(*) AS c FROM gh_idempotency_keys').get().c;
  assert.equal(count, 2, 'deben existir 2 filas (1 por empresa)');
});

// =====================================================================
// 12. markComplete
// =====================================================================

test('I-003.2: markComplete actualiza fila: status=COMPLETED, response_status, response_body (JSON), completed_at', () => {
  beforeEach();
  const params = {
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  };
  idempotency.getOrCreate(params);

  const updated = idempotency.markComplete({
    ...params,
    response_status: 201,
    response_body: { id: 'sign-001', nested: { ok: true } },
  });
  assert.equal(updated.status, 'COMPLETED');
  assert.equal(updated.response_status, 201);
  assert.equal(typeof updated.response_body, 'string');
  // JSON parseable
  const parsed = JSON.parse(updated.response_body);
  assert.equal(parsed.id, 'sign-001');
  assert.equal(parsed.nested.ok, true);
  assert.ok(updated.completed_at, 'completed_at debe estar poblado');
});

test('I-003.2: markComplete lanza IDEMPOTENCY_KEY_NOT_FOUND si la fila no existe', () => {
  beforeEach();
  assert.throws(
    () => idempotency.markComplete({
      id_empresa: TEST_EMPRESA_A,
      idempotency_key: VALID_UUID,
      response_status: 201,
      response_body: {},
    }),
    (err) => err.code === 'IDEMPOTENCY_KEY_NOT_FOUND'
  );
});

// =====================================================================
// 13. markFailed NO popula response_status/body
// =====================================================================

test('I-003.2: markFailed setea status=FAILED, response_status=null, response_body=null, completed_at', () => {
  beforeEach();
  const params = {
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  };
  idempotency.getOrCreate(params);

  const updated = idempotency.markFailed(params);
  assert.equal(updated.status, 'FAILED');
  assert.equal(updated.response_status, null);
  assert.equal(updated.response_body, null);
  assert.ok(updated.completed_at, 'completed_at debe estar poblado');
});

test('I-003.2: después de markFailed, getOrCreate con mismo fingerprint permite retry (isRetry=true)', () => {
  beforeEach();
  const params = {
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  };
  idempotency.getOrCreate(params);
  idempotency.markFailed(params);

  // Retry con mismo fingerprint → isRetry=true (retry permitido)
  const retry = idempotency.getOrCreate(params);
  assert.equal(retry.isRetry, true);
  assert.equal(retry.row.status, 'FAILED');
});

// =====================================================================
// 14. markTerminal
// =====================================================================

test('I-003.2: markTerminal popula response_status, response_body (JSON) y setea status=TERMINAL', () => {
  beforeEach();
  const params = {
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  };
  idempotency.getOrCreate(params);

  const updated = idempotency.markTerminal({
    ...params,
    response_status: 400,
    response_body: { error: 'documento_rechazado', motivo: 'X' },
  });
  assert.equal(updated.status, 'TERMINAL');
  assert.equal(updated.response_status, 400);
  assert.equal(typeof updated.response_body, 'string');
  const parsed = JSON.parse(updated.response_body);
  assert.equal(parsed.error, 'documento_rechazado');
  assert.equal(parsed.motivo, 'X');
  assert.ok(updated.completed_at);
});

// =====================================================================
// 15. cleanup
// =====================================================================

test('I-003.2: cleanup() borra SOLO filas con expires_at < now (formato ISO)', () => {
  beforeEach();
  // Insertar 3 filas: 2 vigentes + 1 expirada (modificada manualmente)
  for (let i = 0; i < 3; i++) {
    db.prepare(`
      INSERT INTO gh_idempotency_keys
        (id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status,
         created_at, expires_at)
      VALUES (?, ?, ?, ?, 'PENDING',
              strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
              strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+24 hours'))
    `).run(TEST_EMPRESA_A, `00000000-0000-4000-8000-00000000000${i}`, 'fp' + i, 'pdf' + i);
  }
  // Expirar la tercera fila
  db.prepare(`
    UPDATE gh_idempotency_keys
    SET expires_at = '2000-01-01T00:00:00.000Z'
    WHERE idempotency_key = '00000000-0000-4000-8000-000000000002'
  `).run();

  const before = db.prepare('SELECT COUNT(*) AS c FROM gh_idempotency_keys').get().c;
  assert.equal(before, 3);

  const deleted = idempotency.cleanup();
  assert.equal(deleted, 1, 'cleanup debe borrar 1 fila');

  const after = db.prepare('SELECT COUNT(*) AS c FROM gh_idempotency_keys').get().c;
  assert.equal(after, 2, 'deben quedar 2 filas vigentes');

  // La fila con key 002 (expirada) NO debe existir
  const expired = db.prepare(
    "SELECT idempotency_key FROM gh_idempotency_keys WHERE idempotency_key = '00000000-0000-4000-8000-000000000002'"
  ).get();
  assert.equal(expired, undefined, 'la fila expirada debe haber sido borrada');
});

// =====================================================================
// 16. UNIQUE constraint enforced at DB level
// =====================================================================

test('I-003.2: UNIQUE constraint impide INSERT duplicado (race protection)', () => {
  beforeEach();
  // 1. Crear fila vía getOrCreate
  const first = idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  });
  assert.equal(first.isNew, true);

  // 2. Intentar INSERT manual con mismo (id_empresa, key) y fingerprint distinto
  //    Debe fallar con UNIQUE/PRIMARY KEY constraint
  let uniqueFailed = false;
  try {
    db.prepare(`
      INSERT INTO gh_idempotency_keys
        (id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status)
      VALUES (?, ?, 'different-fp', 'different-pdf', 'PENDING')
    `).run(TEST_EMPRESA_A, VALID_UUID);
  } catch (e) {
    uniqueFailed = /UNIQUE constraint failed|PRIMARY KEY constraint failed/i.test(e.message);
  }
  assert.ok(uniqueFailed, 'el segundo INSERT debe fallar por UNIQUE constraint');

  // 3. Verificar que getOrCreate con mismos params NO crashea (la fila
  //    existente es PENDING, así que debe lanzar in-progress)
  assert.throws(
    () => idempotency.getOrCreate({
      id_empresa: TEST_EMPRESA_A,
      idempotency_key: VALID_UUID,
      metadata: VALID_METADATA,
      pdf_sha256: VALID_PDF_SHA256,
    }),
    (err) => err instanceof idempotency.IdempotencyKeyInProgress
  );
});

// =====================================================================
// 17. lookupByKey
// =====================================================================

test('I-003.2: lookupByKey retorna fila si existe', () => {
  beforeEach();
  idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  });
  const row = idempotency.lookupByKey({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.ok(row);
  assert.equal(row.idempotency_key, VALID_UUID);
  assert.equal(row.status, 'PENDING');
});

test('I-003.2: lookupByKey retorna null si la key no existe', () => {
  beforeEach();
  const row = idempotency.lookupByKey({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.equal(row, null);
});

test('I-003.2: lookupByKey retorna null si id_empresa no coincide (scope)', () => {
  beforeEach();
  // Empresa A crea la key
  idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,
  });
  // Empresa B busca la misma key
  const row = idempotency.lookupByKey({ id_empresa: TEST_EMPRESA_B, idempotency_key: VALID_UUID });
  assert.equal(row, null, 'empresa B no debe ver la key de empresa A');
});

// =====================================================================
// 18. PDF binary NO se almacena
// =====================================================================

test('I-003.2: solo se almacena pdf_sha256, NO el PDF binario', () => {
  beforeEach();
  // getOrCreate SOLO acepta pdf_sha256 (string de 64 chars), no el PDF.
  // Verificamos que la fila solo tiene el hash, no el contenido.
  const result = idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    metadata: VALID_METADATA,
    pdf_sha256: VALID_PDF_SHA256,  // solo el hash, NO el PDF
  });

  // 1. La fila tiene pdf_sha256 (64 chars hex)
  assert.equal(result.row.pdf_sha256, VALID_PDF_SHA256);
  assert.equal(result.row.pdf_sha256.length, 64);

  // 2. NO hay columna relacionada con PDF binario
  const pdfRelatedCols = Object.keys(result.row).filter(k =>
    k.includes('content') || k.includes('binary') || k.includes('pdf_data') || k.includes('pdf_buffer')
  );
  assert.equal(pdfRelatedCols.length, 0,
    `no debe haber columnas con contenido PDF binario, encontré: ${pdfRelatedCols.join(', ')}`);

  // 3. El tamaño de la fila es ~chico (solo el hash, no MB de PDF)
  //    (no podemos medir el "tamaño" exacto de la fila en SQLite, pero
  //     podemos confirmar que response_body es null — si el PDF estuviera
  //     allí, pesaría MB.)
  assert.equal(result.row.response_body, null);
});
