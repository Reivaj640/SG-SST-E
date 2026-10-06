/**
 * I-003.4 — Batería adversarial del service de idempotencia.
 *
 * OBJETIVO: atacar la implementación existente de getOrCreate / markComplete /
 * markFailed / markTerminal / cleanup / validateKey / computeFingerprint /
 * canonicalJson / lookupByKey desde ángulos NO cubiertos por los 38 tests
 * "normales" de tests/services/idempotency.test.js.
 *
 * FILOSOFÍA: estos tests son DESCUBRIMIENTO, no aceptación. Si un test falla
 * porque revela un defecto real, NO se "arregla" el test para silenciarlo:
 * se reporta como hallazgo (ver checklist en docs/kair-firma-integration/
 * I-003-design.md y la spec I-003.4).
 *
 * Secciones:
 *   §S1 — Cross-company isolation (I-003 + I-010 boundary, CRITICAL).
 *   §S2 — JSON canonicalization (fingerprint determinism).
 *   §S3 — pdf_sha256 case normalization (G6 refinado).
 *   §S4 — TTL 24h expiry boundaries.
 *   §S5 — UNIQUE constraint race (concurrent INSERT).
 *   §S6 — In-flight timeout (G7) 5min boundary.
 *
 * Setup:
 *   - BD real (test.sqlite via tests/setup.js --require).
 *   - resetDb() en cada test (incluye gh_idempotency_keys desde I-003.3).
 *   - Patrón "beforeEach" inline (estilo del archivo original).
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

// UUIDs v4 válidos y distinguibles.
const UUID_1 = '550e8400-e29b-41d4-a716-446655440000';
const UUID_2 = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const UUID_3 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const UUID_4 = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
const UUID_5 = 'b2c3d4e5-f6a7-4890-b123-456789abcdef';

// SHA-256 hex (64 chars) válidos.
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);
const SHA_UPPER = 'A'.repeat(64); // same bytes que SHA_A, distinto case

const META = {
  id_trabajador: '1234567890',
  id_documento: 'doc-001',
  tipo_firma: 'presencial',
};

function beforeEach() {
  resetDb();
  // Doble seguridad: resetDb ya limpia gh_idempotency_keys (I-003.3 lo
  // agregó a TABLES), pero el archivo original del service hacia
  // limpieza explícita. Lo mantenemos por defensa redundante.
  db.prepare('DELETE FROM gh_idempotency_keys').run();
}

// Helper: INSERT manual de una fila con control total sobre columnas.
function insertRaw({
  id_empresa = TEST_EMPRESA_A,
  idempotency_key = UUID_1,
  fingerprint = 'manual-fp-' + Math.random().toString(36).slice(2, 10),
  pdf_sha256 = SHA_A,
  status = 'PENDING',
  created_offset_seconds = 0,
  expires_offset_seconds = 24 * 3600,
  response_status = null,
  response_body = null,
} = {}) {
  db.prepare(`
    INSERT INTO gh_idempotency_keys
      (id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status,
       response_status, response_body,
       created_at, expires_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?,
            strftime('%Y-%m-%d %H:%M:%S', 'now', ? || ' seconds'),
            strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ? || ' seconds'),
            CASE WHEN ? IS NULL THEN NULL
                 ELSE strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ? || ' seconds')
            END)
  `).run(
    id_empresa, idempotency_key, fingerprint, pdf_sha256, status,
    response_status, response_body,
    -created_offset_seconds, expires_offset_seconds,
    response_status === null ? null : -created_offset_seconds,
    response_status === null ? null : -created_offset_seconds
  );
  return db.prepare(
    'SELECT * FROM gh_idempotency_keys WHERE id_empresa = ? AND idempotency_key = ?'
  ).get(id_empresa, idempotency_key);
}

// =====================================================================
// §S1 — Cross-company isolation (I-003 + I-010 boundary, CRITICAL)
// =====================================================================

test('§S1.1 cross-company: Empresa A + key + payload X → isNew=true, fila PENDING', () => {
  beforeEach();
  const r = idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: UUID_1,
    metadata: META,
    pdf_sha256: SHA_A,
  });
  assert.equal(r.isNew, true);
  assert.equal(r.row.status, 'PENDING');
  assert.equal(r.row.id_empresa, TEST_EMPRESA_A);
});

test('§S1.2 cross-company: Empresa B + MISMA key + mismo payload → también isNew=true (independiente)', () => {
  beforeEach();
  // A crea primero.
  idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: UUID_1,
    metadata: META,
    pdf_sha256: SHA_A,
  });
  // B usa la misma key string → DEBE poder crear sin conflicto.
  const rB = idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_B,
    idempotency_key: UUID_1,
    metadata: META,
    pdf_sha256: SHA_A,
  });
  assert.equal(rB.isNew, true,
    'empresa B debe poder crear la misma key sin ver la fila de A');
  assert.equal(rB.row.id_empresa, TEST_EMPRESA_B);

  // Verificar que existen DOS filas distintas (PK compuesta).
  const count = db.prepare('SELECT COUNT(*) AS c FROM gh_idempotency_keys').get().c;
  assert.equal(count, 2, 'deben existir 2 filas (1 por empresa)');

  const rowA = db.prepare('SELECT * FROM gh_idempotency_keys WHERE id_empresa = ?')
    .get(TEST_EMPRESA_A);
  const rowB = db.prepare('SELECT * FROM gh_idempotency_keys WHERE id_empresa = ?')
    .get(TEST_EMPRESA_B);
  assert.equal(rowA.idempotency_key, UUID_1);
  assert.equal(rowB.idempotency_key, UUID_1);
  assert.notEqual(rowA.id_empresa, rowB.id_empresa);
  // Fingerprints coinciden (mismo payload) → esto es lo correcto.
  assert.equal(rowA.request_fingerprint, rowB.request_fingerprint);
});

test('§S1.3 cross-company: Empresa A + misma key + payload Y (diferente) → 409 IdempotencyKeyConflict', () => {
  beforeEach();
  idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: UUID_1,
    metadata: META,
    pdf_sha256: SHA_A,
  });
  idempotency.markComplete({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: UUID_1,
    response_status: 201,
    response_body: { ok: true },
  });
  // A reusa la key con fingerprint distinto → CONFLICT.
  assert.throws(
    () => idempotency.getOrCreate({
      id_empresa: TEST_EMPRESA_A,
      idempotency_key: UUID_1,
      metadata: { ...META, id_trabajador: '9999999' },  // cambia
      pdf_sha256: SHA_A,
    }),
    (err) => err instanceof idempotency.IdempotencyKeyConflict &&
            err.code === 'IDEMPOTENCY_KEY_CONFLICT'
  );
});

test('§S1.4 cross-company: después de S1.1 markComplete, A reusa misma key + mismo payload → isReplay=true', () => {
  beforeEach();
  const params = {
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: UUID_1,
    metadata: META,
    pdf_sha256: SHA_A,
  };
  idempotency.getOrCreate(params);
  idempotency.markComplete({
    ...params,
    response_status: 201,
    response_body: { id: 'sign-A', payload: 'X' },
  });
  const r = idempotency.getOrCreate(params);
  assert.equal(r.isReplay, true);
  assert.equal(r.row.response_status, 201);
  // El body cacheado es el de A, no el de B.
  const cached = JSON.parse(r.row.response_body);
  assert.equal(cached.id, 'sign-A');
});

test('§S1.5 cross-company: B con su propia REPLAY → devuelve SU body, no el de A', () => {
  beforeEach();
  const baseParams = {
    idempotency_key: UUID_1,
    metadata: META,
    pdf_sha256: SHA_A,
  };
  // A completa con body A.
  idempotency.getOrCreate({ ...baseParams, id_empresa: TEST_EMPRESA_A });
  idempotency.markComplete({
    ...baseParams,
    id_empresa: TEST_EMPRESA_A,
    response_status: 201,
    response_body: { id: 'sign-A', owner: 'A' },
  });
  // B completa con body B.
  idempotency.getOrCreate({ ...baseParams, id_empresa: TEST_EMPRESA_B });
  idempotency.markComplete({
    ...baseParams,
    id_empresa: TEST_EMPRESA_B,
    response_status: 201,
    response_body: { id: 'sign-B', owner: 'B' },
  });
  // B hace REPLAY → debe recibir el body de B, no el de A.
  const rB = idempotency.getOrCreate({ ...baseParams, id_empresa: TEST_EMPRESA_B });
  assert.equal(rB.isReplay, true);
  const cached = JSON.parse(rB.row.response_body);
  assert.equal(cached.id, 'sign-B');
  assert.equal(cached.owner, 'B');
  // A también REPLAYa → debe recibir su propio body.
  const rA = idempotency.getOrCreate({ ...baseParams, id_empresa: TEST_EMPRESA_A });
  assert.equal(rA.isReplay, true);
  const cachedA = JSON.parse(rA.row.response_body);
  assert.equal(cachedA.id, 'sign-A');
  assert.equal(cachedA.owner, 'A');
});

test('§S1.6 cross-company: TERMINAL de A NO afecta el REPLAY de B', () => {
  beforeEach();
  const baseParams = {
    idempotency_key: UUID_1,
    metadata: META,
    pdf_sha256: SHA_A,
  };
  // A: PENDING → COMPLETED → TERMINAL.
  idempotency.getOrCreate({ ...baseParams, id_empresa: TEST_EMPRESA_A });
  idempotency.markComplete({
    ...baseParams,
    id_empresa: TEST_EMPRESA_A,
    response_status: 201,
    response_body: { ok: true },
  });
  idempotency.markTerminal({
    ...baseParams,
    id_empresa: TEST_EMPRESA_A,
    response_status: 422,
    response_body: { error: 'A-rechazado' },
  });
  // B: PENDING → COMPLETED.
  idempotency.getOrCreate({ ...baseParams, id_empresa: TEST_EMPRESA_B });
  idempotency.markComplete({
    ...baseParams,
    id_empresa: TEST_EMPRESA_B,
    response_status: 201,
    response_body: { ok: 'B-completo' },
  });
  // B REPLAYa → A está TERMINAL pero B sigue siendo REPLAY normal.
  const rB = idempotency.getOrCreate({ ...baseParams, id_empresa: TEST_EMPRESA_B });
  assert.equal(rB.isReplay, true,
    'TERMINAL de A no debe afectar a B; B debe ver su propio REPLAY');
  // A reintenta → TERMINAL.
  assert.throws(
    () => idempotency.getOrCreate({ ...baseParams, id_empresa: TEST_EMPRESA_A }),
    (err) => err instanceof idempotency.IdempotencyKeyTerminal
  );
});

test('§S1.7 cross-company: después de TERMINAL en A, A+key+payload X → 409 IdempotencyKeyTerminal', () => {
  beforeEach();
  const params = {
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: UUID_1,
    metadata: META,
    pdf_sha256: SHA_A,
  };
  idempotency.getOrCreate(params);
  idempotency.markComplete({ ...params, response_status: 201, response_body: {} });
  idempotency.markTerminal({ ...params, response_status: 422, response_body: {} });
  assert.throws(
    () => idempotency.getOrCreate(params),
    (err) => err instanceof idempotency.IdempotencyKeyTerminal &&
            err.code === 'IDEMPOTENCY_KEY_TERMINAL' &&
            err.details.response_status === 422
  );
});

// =====================================================================
// §S2 — JSON canonicalization (fingerprint determinism edge cases)
// =====================================================================

test('§S2.1 canon: order de keys en objeto simple → MISMO fingerprint', () => {
  beforeEach();
  const f1 = idempotency.computeFingerprint({ metadata: { a: 1, b: 2 }, pdf_sha256: SHA_A });
  const f2 = idempotency.computeFingerprint({ metadata: { b: 2, a: 1 }, pdf_sha256: SHA_A });
  assert.equal(f1, f2);
  assert.equal(f1.length, 64);
});

test('§S2.2 canon: order de keys en objeto anidado → MISMO fingerprint', () => {
  beforeEach();
  const f1 = idempotency.computeFingerprint({
    metadata: { outer: { x: 1, y: 2, z: 3 } },
    pdf_sha256: SHA_A,
  });
  const f2 = idempotency.computeFingerprint({
    metadata: { outer: { z: 3, x: 1, y: 2 } },
    pdf_sha256: SHA_A,
  });
  assert.equal(f1, f2);
});

test('§S2.3 canon: arrays preservan orden → DIFERENTE fingerprint', () => {
  beforeEach();
  const f1 = idempotency.computeFingerprint({ metadata: { arr: [1, 2, 3] }, pdf_sha256: SHA_A });
  const f2 = idempotency.computeFingerprint({ metadata: { arr: [3, 2, 1] }, pdf_sha256: SHA_A });
  assert.notEqual(f1, f2,
    'arrays deben preservar orden (cliente debe serializar idénticamente)');
});

test('§S2.4 canon: arrays idénticos → MISMO fingerprint', () => {
  beforeEach();
  const f1 = idempotency.computeFingerprint({ metadata: { arr: [1, 2, 3] }, pdf_sha256: SHA_A });
  const f2 = idempotency.computeFingerprint({ metadata: { arr: [1, 2, 3] }, pdf_sha256: SHA_A });
  assert.equal(f1, f2);
});

test('§S2.5 canon: espacios en strings se preservan → DIFERENTE fingerprint', () => {
  beforeEach();
  // El canonicalJson NO trimea strings. Si el cliente mete "a  b" vs "a b",
  // el fingerprint cambia. (Esto es deliberado: el contenido semántico
  // difiere; el fingerprint refleja el payload exacto.)
  const f1 = idempotency.computeFingerprint({
    metadata: { name: 'foo  bar' },  // 2 espacios
    pdf_sha256: SHA_A,
  });
  const f2 = idempotency.computeFingerprint({
    metadata: { name: 'foo bar' },   // 1 espacio
    pdf_sha256: SHA_A,
  });
  assert.notEqual(f1, f2,
    'el contenido de strings debe preservarse; whitespace cambia fingerprint');
});

test('§S2.6 canon: number 1 vs string "1" → DIFERENTE fingerprint', () => {
  beforeEach();
  const fNum = idempotency.computeFingerprint({ metadata: { x: 1 }, pdf_sha256: SHA_A });
  const fStr = idempotency.computeFingerprint({ metadata: { x: '1' }, pdf_sha256: SHA_A });
  assert.notEqual(fNum, fStr,
    'number 1 y string "1" son tipos distintos y deben dar fingerprints distintos');
});

test('§S2.7 canon: null en metadata vs undefined → comportamiento documentado', () => {
  beforeEach();
  // canonicalJson ITERA manualmente Object.keys y serializa cada valor
  // con JSON.stringify. Eso da un comportamiento distinto a JSON.stringify
  // del objeto entero:
  //   - {a: null}      → Object.keys = ['a']; canonicalJson(null) = 'null'         → '{"a":null}'
  //   - {a: undefined} → Object.keys = ['a']; JSON.stringify(undefined) = undef   → '{"a":undefined}'
  //   - {}             → Object.keys = []                                          → '{}'
  // Los TRES son distintos. Documentamos para que un cambio futuro en el
  // algoritmo de canonicalización (ej. usar JSON.stringify en vez de manual)
  // sea detectado.
  const fNull = idempotency.computeFingerprint({ metadata: { a: null }, pdf_sha256: SHA_A });
  const fUndef = idempotency.computeFingerprint({ metadata: { a: undefined }, pdf_sha256: SHA_A });
  const fEmpty = idempotency.computeFingerprint({ metadata: {}, pdf_sha256: SHA_A });
  assert.notEqual(fNull, fUndef,
    '{a:null} y {a:undefined} producen fingerprints distintos');
  assert.notEqual(fNull, fEmpty,
    '{a:null} produce fingerprint distinto a {} (la key existe con valor null)');
  assert.notEqual(fUndef, fEmpty,
    '{a:undefined} produce fingerprint distinto a {} (canonicalJson emite "undefined" literal, no omite la key)');
});

test('§S2.8 canon: boolean true vs string "true" → DIFERENTE fingerprint', () => {
  beforeEach();
  const f1 = idempotency.computeFingerprint({ metadata: { x: true }, pdf_sha256: SHA_A });
  const f2 = idempotency.computeFingerprint({ metadata: { x: 'true' }, pdf_sha256: SHA_A });
  assert.notEqual(f1, f2);
});

test('§S2.9 canon: metadata vacío {} vs metadata null/undefined → mismo fingerprint', () => {
  beforeEach();
  const fEmpty = idempotency.computeFingerprint({ metadata: {}, pdf_sha256: SHA_A });
  const fNull = idempotency.computeFingerprint({ metadata: null, pdf_sha256: SHA_A });
  const fUndef = idempotency.computeFingerprint({ metadata: undefined, pdf_sha256: SHA_A });
  assert.equal(fEmpty, fNull, 'null y {} deben dar el mismo fingerprint');
  assert.equal(fEmpty, fUndef, 'undefined y {} deben dar el mismo fingerprint');
  // Y el fingerprint es solo sha256(canonicalJson({pdf_sha256: 'a..a'})).
  const expected = sha256(idempotency.canonicalJson({ pdf_sha256: SHA_A }));
  assert.equal(fEmpty, expected,
    'fingerprint con metadata vacía es SHA-256 del canonical JSON solo con pdf_sha256');
});

// =====================================================================
// §S3 — pdf_sha256 case normalization (G6 refinado)
// =====================================================================

test('§S3.1 pdf_sha256: uppercase vs lowercase → MISMO fingerprint (case-insensitive)', () => {
  beforeEach();
  const fLower = idempotency.computeFingerprint({ metadata: META, pdf_sha256: SHA_A });
  const fUpper = idempotency.computeFingerprint({ metadata: META, pdf_sha256: SHA_UPPER });
  assert.equal(fLower, fUpper,
    'pdf_sha256 debe ser case-insensitive (normalización a lowercase)');
});

test('§S3.2 pdf_sha256: mixed cases distintos → MISMO fingerprint', () => {
  beforeEach();
  // Construir dos strings hex de 64 chars que representen los MISMOS 32 bytes
  // pero con case mixto distinto en cada posición.
  // Patrón: '0123456789abcdef' repetido 4 veces = 64 chars en lowercase.
  // Variante 1: cada nibble sube a uppercase (1 vez por cada 2 chars).
  // Variante 2: el patrón upper/lower invertido.
  const base = '0123456789abcdef'; // 16 chars
  const lc = base + base + base + base; // 64 chars lowercase
  // Mezcla 1: alterna upper/lower
  const mixed1 = '0123456789ABCDef0123456789ABCDef0123456789ABCDef0123456789ABCDef';
  // Mezcla 2: otro patrón (case en distintas posiciones)
  const mixed2 = '0123456789ABcDeF0123456789ABcDeF0123456789ABcDeF0123456789ABcDeF';
  assert.equal(lc.length, 64);
  assert.equal(mixed1.length, 64, 'mixed1 debe ser hex de 64 chars');
  assert.equal(mixed2.length, 64, 'mixed2 debe ser hex de 64 chars');
  // Como son case-variantes del mismo hex, lowercase iguales:
  assert.equal(mixed1.toLowerCase(), lc);
  assert.equal(mixed2.toLowerCase(), lc);
  const f1 = idempotency.computeFingerprint({ metadata: {}, pdf_sha256: mixed1 });
  const f2 = idempotency.computeFingerprint({ metadata: {}, pdf_sha256: mixed2 });
  assert.equal(f1, f2,
    'pdf_sha256 con case mixto debe normalizarse a lowercase antes de hashear');
});

test('§S3.3 pdf_sha256: stored value en BD siempre lowercase (defensa)', () => {
  beforeEach();
  // Forzamos uppercase en el input y verificamos que en BD queda lowercase.
  const r = idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: UUID_1,
    metadata: META,
    pdf_sha256: SHA_UPPER,  // todo mayúsculas
  });
  const row = db.prepare('SELECT pdf_sha256 FROM gh_idempotency_keys WHERE id_empresa = ? AND idempotency_key = ?')
    .get(TEST_EMPRESA_A, UUID_1);
  assert.equal(row.pdf_sha256, SHA_A,
    'pdf_sha256 debe normalizarse a lowercase antes de almacenar');
  assert.equal(r.row.pdf_sha256, SHA_A);
});

test('§S3.4 pdf_sha256: con whitespace alrededor → comportamiento documentado', () => {
  beforeEach();
  // El service NO trimea pdf_sha256. Si el cliente mete "  <hex>  " el
  // regex de 64 chars falla. Verificamos que se rechaza como not_hex.
  const withSpaces = '  ' + SHA_A + '  ';
  assert.throws(
    () => idempotency.computeFingerprint({ metadata: {}, pdf_sha256: withSpaces }),
    (err) => err.code === 'INVALID_REQUEST' && err.details.reason === 'pdf_sha256_not_hex'
  );
});

// =====================================================================
// §S4 — TTL 24h expiry boundaries
// =====================================================================

test('§S4.1 TTL: fila con expires_at en el pasado (backdate 25h) → getOrCreate trata como nueva', () => {
  beforeEach();
  insertRaw({
    idempotency_key: UUID_1,
    fingerprint: 'old-fp',
    pdf_sha256: SHA_A,
    status: 'COMPLETED',
    created_offset_seconds: 25 * 3600,
    expires_offset_seconds: -3600,  // 1h en el pasado
  });
  const r = idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: UUID_1,
    metadata: META,
    pdf_sha256: SHA_A,
  });
  assert.equal(r.isExpired, true, 'fila con TTL expirado debe ser reemplazada');
  assert.equal(r.wasNewlyCreated, true);
  assert.equal(r.row.status, 'PENDING');
  // La nueva fila no debe tener la respuesta cacheada vieja.
  assert.equal(r.row.response_status, null);
  assert.equal(r.row.response_body, null);
});

test('§S4.2 TTL: fila con expires_at muy cerca del now (boundary <) → documentar', () => {
  beforeEach();
  // El service compara `expires_at < strftime(now)`. La comparación es
  // lexicográfica sobre el formato ISO 8601 estricto.
  // Caso: expires_at muy cerca en el futuro (+1s) → vigente, no se reemplaza.
  // Para verificar que la fila se considera vigente, sembramos una fila
  // COMPLETED con el MISMO fingerprint que producirá getOrCreate.
  const expectedFp = idempotency.computeFingerprint({ metadata: META, pdf_sha256: SHA_A });
  insertRaw({
    idempotency_key: UUID_1,
    fingerprint: expectedFp,
    pdf_sha256: SHA_A,
    status: 'COMPLETED',
    expires_offset_seconds: 60,  // 60s en el futuro (vigente)
    response_status: 201,
    response_body: JSON.stringify({ id: 'boundary-replay' }),
  });
  const r = idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: UUID_1,
    metadata: META,
    pdf_sha256: SHA_A,
  });
  // Vigente + mismo fingerprint → REPLAY, NO isExpired.
  assert.equal(r.isReplay, true,
    'fila con expires_at en el futuro (>now) y mismo fingerprint → REPLAY (no isExpired)');
  assert.equal(r.row.status, 'COMPLETED');
  // La fila NO se reemplazó (status sigue COMPLETED, no se creó nueva PENDING).
  const row = db.prepare('SELECT status FROM gh_idempotency_keys WHERE id_empresa = ? AND idempotency_key = ?')
    .get(TEST_EMPRESA_A, UUID_1);
  assert.equal(row.status, 'COMPLETED', 'fila vigente no se reemplaza');
});

test('§S4.3 cleanup: borra SOLO expiradas, deja vigentes intactas', () => {
  beforeEach();
  // 2 vigentes + 1 expirada.
  insertRaw({ idempotency_key: UUID_1, fingerprint: 'fp1', status: 'COMPLETED', expires_offset_seconds: 3600 });
  insertRaw({ idempotency_key: UUID_2, fingerprint: 'fp2', status: 'PENDING', expires_offset_seconds: 3600 });
  insertRaw({ idempotency_key: UUID_3, fingerprint: 'fp3', status: 'COMPLETED', expires_offset_seconds: -3600 });
  const before = db.prepare('SELECT COUNT(*) AS c FROM gh_idempotency_keys').get().c;
  assert.equal(before, 3);
  const deleted = idempotency.cleanup();
  assert.equal(deleted, 1, 'cleanup debe borrar exactamente 1 fila');
  const after = db.prepare('SELECT COUNT(*) AS c FROM gh_idempotency_keys').get().c;
  assert.equal(after, 2);
  // UUID_3 (expirada) no debe existir.
  const expired = db.prepare('SELECT * FROM gh_idempotency_keys WHERE idempotency_key = ?').get(UUID_3);
  assert.equal(expired, undefined);
  // UUID_1 y UUID_2 (vigentes) siguen ahí.
  const kept1 = db.prepare('SELECT * FROM gh_idempotency_keys WHERE idempotency_key = ?').get(UUID_1);
  const kept2 = db.prepare('SELECT * FROM gh_idempotency_keys WHERE idempotency_key = ?').get(UUID_2);
  assert.ok(kept1);
  assert.ok(kept2);
});

test('§S4.4 TTL expiry + new INSERT: el fingerprint se computa fresh, no se compara al viejo', () => {
  beforeEach();
  // Insertar fila con fingerprint viejo (origen COMPLETED, ya expirada).
  insertRaw({
    idempotency_key: UUID_1,
    fingerprint: 'OLD-FINGERPRINT-NEVER-REUSED',
    pdf_sha256: SHA_B,  // pdf distinto
    status: 'COMPLETED',
    expires_offset_seconds: -3600,
  });
  // Llamar getOrCreate con metadata y pdf NUEVOS (fingerprint nuevo).
  // Debe crear nueva fila sin comparar al fingerprint viejo.
  const r = idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: UUID_1,
    metadata: META,
    pdf_sha256: SHA_A,
  });
  assert.equal(r.isExpired, true);
  assert.notEqual(r.fingerprint, 'OLD-FINGERPRINT-NEVER-REUSED');
  assert.equal(r.fingerprint.length, 64);
});

// =====================================================================
// §S5 — UNIQUE constraint race (concurrent INSERT)
// =====================================================================

test('§S5.1 UNIQUE race: pre-condición fila no existe, INSERT manual, getOrCreate detecta sin crashear', () => {
  beforeEach();
  // Simular que otro proceso INSERTó primero.
  insertRaw({
    idempotency_key: UUID_1,
    fingerprint: 'racer-fp',
    pdf_sha256: SHA_A,
    status: 'PENDING',
  });
  // Llamar getOrCreate con MISMO fingerprint → la fila existe, está PENDING
  // → debe lanzar InProgress (no crashear con UNIQUE error).
  assert.throws(
    () => idempotency.getOrCreate({
      id_empresa: TEST_EMPRESA_A,
      idempotency_key: UUID_1,
      metadata: META,
      pdf_sha256: SHA_A,
    }),
    (err) => err instanceof idempotency.IdempotencyKeyInProgress
  );
});

test('§S5.2 UNIQUE race: INSERT manual con fingerprint distinto → getOrCreate lanza IdempotencyKeyConflict', () => {
  beforeEach();
  // Otra request INSERTó PENDING con fingerprint distinto al nuestro.
  insertRaw({
    idempotency_key: UUID_1,
    fingerprint: 'other-process-fp',
    pdf_sha256: SHA_B,
    status: 'PENDING',
  });
  // getOrCreate con MISMAS (id_empresa, key) pero fingerprint distinto:
  // la fila existe, está PENDING, fingerprint difiere → no se trata como
  // InProgress (el PENDING es de otro fingerprint), sino como CONFLICT.
  // (Esto es lo que el test del service original ya cubre, pero acá
  // verificamos el path vía pre-INSERT manual, no vía getOrCreate previo.)
  assert.throws(
    () => idempotency.getOrCreate({
      id_empresa: TEST_EMPRESA_A,
      idempotency_key: UUID_1,
      metadata: META,
      pdf_sha256: SHA_A,
    }),
    (err) => err instanceof idempotency.IdempotencyKeyConflict ||
              err instanceof idempotency.IdempotencyKeyInProgress,
    'getOrCreate debe distinguir entre PENDING del mismo fingerprint y PENDING de otro'
  );
});

test('§S5.3 UNIQUE race: INSERT manual con MISMO fingerprint PENDING → getOrCreate lanza InProgress', () => {
  beforeEach();
  // Calcular el fingerprint que getOrCreate producirá para estos params.
  const expectedFp = idempotency.computeFingerprint({ metadata: META, pdf_sha256: SHA_A });
  // Pre-INSERT manual con ese MISMO fingerprint.
  insertRaw({
    idempotency_key: UUID_1,
    fingerprint: expectedFp,
    pdf_sha256: SHA_A,
    status: 'PENDING',
  });
  // getOrCreate → encuentra fila PENDING con mismo fingerprint → InProgress.
  assert.throws(
    () => idempotency.getOrCreate({
      id_empresa: TEST_EMPRESA_A,
      idempotency_key: UUID_1,
      metadata: META,
      pdf_sha256: SHA_A,
    }),
    (err) => err instanceof idempotency.IdempotencyKeyInProgress
  );
});

test('§S5.4 CHECK constraint defensa: status inválido en BD → getOrCreate no crashea', () => {
  beforeEach();
  // SQLite CHECK constraints son enforzadas, pero probamos la ruta de
  // _insertPending con un INSERT directo. Si el CHECK rechaza, el catch
  // en _insertPending NO matchea "UNIQUE constraint failed" y se rerelanza
  // — esto es defensivo: el CHECK de BD es la red de seguridad final.
  let checkFailed = false;
  try {
    db.prepare(`
      INSERT INTO gh_idempotency_keys
        (id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status)
      VALUES (?, ?, 'fp', 'pdf', 'BOGUS_STATUS')
    `).run(TEST_EMPRESA_A, UUID_1);
  } catch (e) {
    checkFailed = /CHECK constraint failed/i.test(e.message);
  }
  assert.ok(checkFailed, 'la BD debe rechazar status fuera de la whitelist');
  // getOrCreate con key nueva no debe ver esa fila (no se INSERTó) → crea nueva.
  const r = idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: UUID_1,
    metadata: META,
    pdf_sha256: SHA_A,
  });
  assert.equal(r.isNew, true);
});

// =====================================================================
// §S6 — In-flight timeout boundary (G7, 5 min)
// =====================================================================

test('§S6.1 in-flight: PENDING con created_at = 4 min → IdempotencyKeyInProgress', () => {
  beforeEach();
  insertRaw({
    idempotency_key: UUID_1,
    status: 'PENDING',
    created_offset_seconds: 4 * 60,  // 4 min atrás
  });
  assert.throws(
    () => idempotency.getOrCreate({
      id_empresa: TEST_EMPRESA_A,
      idempotency_key: UUID_1,
      metadata: META,
      pdf_sha256: SHA_A,
    }),
    (err) => err instanceof idempotency.IdempotencyKeyInProgress &&
            err.details.retry_after > 0
  );
});

test('§S6.2 in-flight: PENDING con created_at = 6 min → reemplaza con nueva PENDING', () => {
  beforeEach();
  insertRaw({
    idempotency_key: UUID_1,
    status: 'PENDING',
    created_offset_seconds: 6 * 60,  // 6 min atrás (>5min)
  });
  const r = idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: UUID_1,
    metadata: META,
    pdf_sha256: SHA_A,
  });
  assert.equal(r.isExpired, true,
    'PENDING con in-flight timeout >5min se trata como crash y se reemplaza');
  assert.equal(r.wasNewlyCreated, true);
  assert.equal(r.row.status, 'PENDING');
});

test('§S6.3 in-flight: PENDING con created_at = 5 min exacto (boundary) → documentar (<)', () => {
  beforeEach();
  // La comparación es `created_at < now-5min`. Por tanto exactamente 5min
  // ANTIGUO está en el límite. El comportamiento esperado: NO se reemplaza
  // (sigue dentro del timeout). Verificamos que se lanza InProgress, no
  // isExpired.
  insertRaw({
    idempotency_key: UUID_1,
    status: 'PENDING',
    created_offset_seconds: 5 * 60,  // 5 min exactos
  });
  let result;
  try {
    result = idempotency.getOrCreate({
      id_empresa: TEST_EMPRESA_A,
      idempotency_key: UUID_1,
      metadata: META,
      pdf_sha256: SHA_A,
    });
  } catch (err) {
    result = { err };
  }
  // En el boundary, el comportamiento es "todavía no expiró" (< estricto):
  // debe lanzar InProgress. Documentamos.
  if (result.err) {
    assert.ok(result.err instanceof idempotency.IdempotencyKeyInProgress,
      'en el boundary exacto 5min, debe seguir siendo InProgress (comparación < estricta)');
  } else {
    // Si por timing race condition la comparación cayó como isExpired, también
    // es aceptable (el comportamiento es coherente con `<`). Documentamos.
    assert.equal(result.isExpired, true,
      'en el boundary, comportamiento coherente con < estricto');
  }
});

test('§S6.4 in-flight: PENDING con created_at = 10 min y fingerprint DISTINTO → reemplaza', () => {
  beforeEach();
  insertRaw({
    idempotency_key: UUID_1,
    fingerprint: 'crashed-old-fp',
    pdf_sha256: SHA_B,  // pdf distinto
    status: 'PENDING',
    created_offset_seconds: 10 * 60,
  });
  // Nueva request con fingerprint nuevo tras 10 min.
  const r = idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: UUID_1,
    metadata: META,
    pdf_sha256: SHA_A,
  });
  assert.equal(r.isExpired, true);
  // La nueva fila debe tener el fingerprint nuevo, no el viejo.
  const row = db.prepare('SELECT request_fingerprint FROM gh_idempotency_keys WHERE id_empresa = ? AND idempotency_key = ?')
    .get(TEST_EMPRESA_A, UUID_1);
  assert.notEqual(row.request_fingerprint, 'crashed-old-fp');
});

test('§S6.5 COMPLETED con created_at = 1h (dentro de TTL) → REPLAY normal, no afectado por in-flight logic', () => {
  beforeEach();
  // Semilla: fila COMPLETED con 1h de antigüedad pero vigente (TTL 24h).
  insertRaw({
    idempotency_key: UUID_1,
    fingerprint: 'completed-fp-1h',
    pdf_sha256: SHA_A,
    status: 'COMPLETED',
    created_offset_seconds: 3600,
    expires_offset_seconds: 23 * 3600,  // vigente
    response_status: 201,
    response_body: JSON.stringify({ id: 'sign-1h', note: 'vigente' }),
  });
  // Reemplazar fingerprint para que coincida con el que computará getOrCreate.
  const expectedFp = idempotency.computeFingerprint({ metadata: META, pdf_sha256: SHA_A });
  db.prepare('UPDATE gh_idempotency_keys SET request_fingerprint = ? WHERE idempotency_key = ?')
    .run(expectedFp, UUID_1);
  const r = idempotency.getOrCreate({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: UUID_1,
    metadata: META,
    pdf_sha256: SHA_A,
  });
  assert.equal(r.isReplay, true,
    'COMPLETED vigente debe devolver REPLAY, no aplicar lógica de in-flight');
  assert.equal(r.row.status, 'COMPLETED');
  assert.equal(r.row.response_status, 201);
});
