/**
 * Tests del router admin-clientes (D-13, I-010, AUD-04, DR-1 a DR-6).
 *
 * Cubre los 4 endpoints:
 *  - POST /internal/admin/clientes              (crear)
 *  - GET  /internal/admin/clientes              (listar)
 *  - GET  /internal/admin/clientes/:id          (por id_empresa)
 *  - POST /internal/admin/clientes/:id/rotate   (rotar)
 *
 * Acceptance criteria (spec §3 + AC del orquestador):
 *  1. Auth con X-Admin-API-Key (sin / incorrecto / X-Internal-API-Key → 401)
 *  2. Body malformado → 400 INVALID_REQUEST_BODY con details.issues
 *  3. allowed_operations fuera del enum → 400
 *  4. POST retorna api_key plaintext UNA vez; GET NUNCA expone hash completo
 *  5. id_empresa ya activo → 409 CLIENT_EXISTS_FOR_EMPRESA
 *  6. Rotación es atómica (TX) y limpia cache de getActiveClientByApiKey
 *  7. NUNCA se loguea plaintext de la api_key
 *  8. Logger redacta id_empresa (PII Ley 1581)
 *  9. Tests pasan 30+ en este archivo
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../../src/db/connection');
const {
  resetDb, makeApp, withAdminApiKey, TEST_ADMIN_API_KEY,
  TEST_API_KEY, TEST_API_KEY_CLIENT_A, TEST_EMPRESA_A,
} = require('../helpers');
const internalClient = require('../../src/services/internalClient');
const { sha256 } = require('../../src/crypto/hash');

const HEADERS = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };

const ALL_OPS = [
  'sign_request:create',
  'sign_request:read',
  'consent:create',
  'consent:verify',
  'audit:read',
];

const VALID_BODY = {
  id_empresa: '900123456',
  allowed_operations: ALL_OPS,
  description: 'K+AIR empresa 900123456 - test',
};

// ============================================================================
// 1. AUTH (4 tests)
// ============================================================================

test('POST /clientes: sin X-Admin-API-Key → 401', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .send(VALID_BODY);
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('POST /clientes: X-Admin-API-Key incorrecto → 401', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set('X-Admin-API-Key', 'wrong-admin-key-xxxxxxxxxx')
    .send(VALID_BODY);
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('POST /clientes: X-Internal-API-Key NO funciona → 401', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set('X-Internal-API-Key', TEST_ADMIN_API_KEY) // mismo valor, header equivocado
    .send(VALID_BODY);
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('POST /clientes: X-Admin-API-Key correcto → 201', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send(VALID_BODY);
  assert.equal(res.status, 201);
  assert.ok(res.body.api_key, 'debe retornar api_key plaintext');
  assert.equal(res.body.id_empresa, VALID_BODY.id_empresa);
});

// ============================================================================
// 2. Validación de body (POST) — ~6 tests
// ============================================================================

test('POST /clientes: sin id_empresa → 400 INVALID_REQUEST_BODY', async () => {
  resetDb();
  const app = makeApp();
  const { id_empresa, ...sinId } = VALID_BODY;
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send(sinId);
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
  assert.ok(Array.isArray(res.body.error.details.issues));
  assert.ok(res.body.error.details.issues.some(i => i.path === 'id_empresa'));
});

test('POST /clientes: id_empresa > 64 chars → 400', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send({ ...VALID_BODY, id_empresa: 'x'.repeat(65) });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /clientes: allowed_operations vacío → 400', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send({ ...VALID_BODY, allowed_operations: [] });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
  assert.ok(res.body.error.details.issues.some(i => i.path === 'allowed_operations'));
});

test('POST /clientes: allowed_operations con valor fuera del enum → 400', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send({ ...VALID_BODY, allowed_operations: ['sign_request:create', 'admin:delete'] });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
  assert.ok(
    res.body.error.details.issues.some(i => i.path.startsWith('allowed_operations')),
    'debe marcar el path del item inválido',
  );
});

test('POST /clientes: description > 200 chars → 400', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send({ ...VALID_BODY, description: 'd'.repeat(201) });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /clientes: campo extra no listado → 400 (strict)', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send({ ...VALID_BODY, hack: 'injection' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

// ============================================================================
// 3. Lógica de POST — ~6 tests
// ============================================================================

test('POST /clientes: 201 con datos mínimos → response incluye api_key plaintext', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send({ id_empresa: '900777777', allowed_operations: ['sign_request:create'] });
  assert.equal(res.status, 201);
  // api_key plaintext presente
  assert.ok(res.body.api_key);
  // Formato: kair_test_<43 base64url> (NODE_ENV=test). Prefijo `kair_test_` = 10 chars.
  assert.match(res.body.api_key, /^kair_test_[A-Za-z0-9_-]{43}$/);
  // Hash prefix es 8 chars hex
  assert.match(res.body.api_key_hash_prefix, /^[0-9a-f]{8}$/);
  // Hash completo NO se expone
  assert.equal(res.body.api_key_hash, undefined,
    'NO debe retornar api_key_hash completo');
  // created_at presente
  assert.ok(res.body.created_at);
  // message de recordatorio
  assert.match(res.body.message, /Guárdala AHORA/);
});

test('POST /clientes: api_key se persiste solo como hash SHA-256', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send(VALID_BODY);
  const apiKey = res.body.api_key;
  // Verificar en BD
  const row = db.prepare(
    'SELECT api_key_hash FROM gh_internal_clients WHERE id_empresa = ?'
  ).get(VALID_BODY.id_empresa);
  assert.ok(row);
  assert.equal(row.api_key_hash, sha256(apiKey),
    'hash en BD debe ser SHA-256(api_key)');
  assert.notEqual(row.api_key_hash, apiKey,
    'hash NO debe ser el plaintext');
});

test('POST /clientes: 409 al crear duplicado activo para mismo id_empresa', async () => {
  resetDb();
  const app = makeApp();
  // Crear el primero
  const r1 = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send(VALID_BODY);
  assert.equal(r1.status, 201);

  // Intentar crear el segundo con mismo id_empresa
  const r2 = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send(VALID_BODY);
  assert.equal(r2.status, 409);
  assert.equal(r2.body.error.code, 'CLIENT_EXISTS_FOR_EMPRESA');
  assert.equal(r2.body.error.details.id_empresa, VALID_BODY.id_empresa);
  assert.match(r2.body.error.details.existing_hash_prefix, /^[0-9a-f]{8}$/);
  assert.ok(r2.body.error.details.created_at);
});

test('POST /clientes: 201 al crear para id_empresa que solo tiene revocados (historial)', async () => {
  resetDb();
  const app = makeApp();
  // Crear uno
  const r1 = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send(VALID_BODY);
  assert.equal(r1.status, 201);
  // Revocarlo vía BD directa
  db.prepare(`UPDATE gh_internal_clients SET revoked_at = datetime('now') WHERE id_empresa = ?`)
    .run(VALID_BODY.id_empresa);
  // Crear otro
  const r2 = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send(VALID_BODY);
  assert.equal(r2.status, 201, 're-crear debe ser OK si solo hay revocados');
  assert.ok(r2.body.api_key);
});

test('POST /clientes: 201 con description opcional', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send({ ...VALID_BODY, description: 'K+AIR empresa X - produccion' });
  assert.equal(res.status, 201);
  assert.equal(res.body.description, 'K+AIR empresa X - produccion');
  // Persistido tal cual (DR-6.A)
  const row = db.prepare(
    'SELECT description FROM gh_internal_clients WHERE id_empresa = ?'
  ).get(VALID_BODY.id_empresa);
  assert.equal(row.description, 'K+AIR empresa X - produccion');
});

test('POST /clientes: 201 con allowed_operations completo (5 items)', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send(VALID_BODY);
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.allowed_operations, ALL_OPS);
  // Persistido como CSV
  const row = db.prepare(
    'SELECT allowed_operations FROM gh_internal_clients WHERE id_empresa = ?'
  ).get(VALID_BODY.id_empresa);
  assert.equal(row.allowed_operations, ALL_OPS.join(','));
});

// ============================================================================
// 4. Validación de query (GET) — ~4 tests
// ============================================================================

test('GET /clientes: sin query params → 200 con default limit/offset', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .get('/internal/admin/clientes')
    .set(HEADERS);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 0);
  assert.deepEqual(res.body.items, []);
  assert.equal(res.body.limit, 100);
  assert.equal(res.body.offset, 0);
});

test('GET /clientes: include_revoked=foo → 400 (zod strict)', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .get('/internal/admin/clientes?include_revoked=foo')
    .set(HEADERS);
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('GET /clientes: limit > 200 → 400', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .get('/internal/admin/clientes?limit=201')
    .set(HEADERS);
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('GET /clientes: id_empresa > 64 chars → 400', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .get('/internal/admin/clientes?id_empresa=' + 'x'.repeat(65))
    .set(HEADERS);
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

// ============================================================================
// 5. Lógica de GET (listar) — ~4 tests
// ============================================================================

test('GET /clientes: lista con 3 clientes → total=3 + items=3', async () => {
  resetDb();
  const app = makeApp();
  // Sembrar 3 clientes vía service
  for (const id of ['900111111', '900222222', '900333333']) {
    internalClient.createClient({
      id_empresa: id,
      allowed_operations: 'sign_request:create',
      apiKey: `kair_test_seed_${id}_32chars_a`,
    });
  }
  const res = await request(app)
    .get('/internal/admin/clientes')
    .set(HEADERS);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 3);
  assert.equal(res.body.items.length, 3);
});

test('GET /clientes: response NUNCA expone el hash completo (solo prefix)', async () => {
  resetDb();
  const app = makeApp();
  internalClient.createClient({
    id_empresa: '900111111',
    allowed_operations: 'sign_request:create',
    apiKey: 'kair_test_seed_hash_check_32_chars_ok',
  });
  const res = await request(app)
    .get('/internal/admin/clientes')
    .set(HEADERS);
  const item = res.body.items[0];
  assert.ok(item.api_key_hash_prefix, 'debe incluir prefix');
  assert.equal(item.api_key_hash_prefix.length, 8);
  assert.equal(item.api_key_hash, undefined,
    'NO debe incluir api_key_hash completo');
  // El response NO debe contener strings de 64 chars hex
  const bodyStr = JSON.stringify(res.body);
  assert.ok(!/[0-9a-f]{64}/.test(bodyStr),
    'el body no debe contener un hash SHA-256 completo de 64 chars');
});

test('GET /clientes: filtro id_empresa exacto', async () => {
  resetDb();
  const app = makeApp();
  for (const id of ['900111111', '900222222', '900333333']) {
    internalClient.createClient({
      id_empresa: id,
      allowed_operations: 'sign_request:create',
      apiKey: `kair_test_seed_${id}_32chars_a`,
    });
  }
  const res = await request(app)
    .get('/internal/admin/clientes?id_empresa=900222222')
    .set(HEADERS);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 1);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].id_empresa, '900222222');
});

test('GET /clientes: include_revoked=true incluye revocados', async () => {
  resetDb();
  const app = makeApp();
  // 1 activo, 1 revocado
  const c1 = internalClient.createClient({
    id_empresa: '900111111',
    allowed_operations: 'sign_request:create',
    apiKey: 'kair_test_seed_a_32chars_padding_ok',
  });
  internalClient.createClient({
    id_empresa: '900222222',
    allowed_operations: 'sign_request:create',
    apiKey: 'kair_test_seed_b_32chars_padding_ok',
  });
  internalClient.revokeClient(c1.api_key_hash);
  // Default: solo activos
  const sinRevocados = await request(app)
    .get('/internal/admin/clientes')
    .set(HEADERS);
  assert.equal(sinRevocados.body.total, 1);
  // Con include_revoked=true
  const conRevocados = await request(app)
    .get('/internal/admin/clientes?include_revoked=true')
    .set(HEADERS);
  assert.equal(conRevocados.body.total, 2);
  const revocados = conRevocados.body.items.filter(i => !i.is_active);
  assert.equal(revocados.length, 1);
  assert.equal(revocados[0].id_empresa, '900111111');
});

// ============================================================================
// 6. GET /:id — ~3 tests
// ============================================================================

test('GET /clientes/:id: cliente activo → 200 con datos (sin hash completo)', async () => {
  resetDb();
  const app = makeApp();
  internalClient.createClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: ALL_OPS.join(','),
    apiKey: TEST_API_KEY_CLIENT_A,
  });
  const res = await request(app)
    .get(`/internal/admin/clientes/${TEST_EMPRESA_A}`)
    .set(HEADERS);
  assert.equal(res.status, 200);
  assert.equal(res.body.id_empresa, TEST_EMPRESA_A);
  assert.equal(res.body.is_active, true);
  assert.match(res.body.api_key_hash_prefix, /^[0-9a-f]{8}$/);
  // NO hash completo
  assert.equal(res.body.api_key_hash, undefined);
  const bodyStr = JSON.stringify(res.body);
  assert.ok(!/[0-9a-f]{64}/.test(bodyStr));
});

test('GET /clientes/:id: cliente no existe → 404 CLIENT_NOT_FOUND', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .get('/internal/admin/clientes/900000000')
    .set(HEADERS);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'CLIENT_NOT_FOUND');
  assert.match(res.body.error.details.hint, /POST/);
});

test('GET /clientes/:id: solo historial de revocados → 404 con hint de rotate', async () => {
  resetDb();
  const app = makeApp();
  const c = internalClient.createClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: 'sign_request:create',
    apiKey: 'kair_test_only_history_32chars_padding',
  });
  internalClient.revokeClient(c.api_key_hash);
  const res = await request(app)
    .get(`/internal/admin/clientes/${TEST_EMPRESA_A}`)
    .set(HEADERS);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'CLIENT_NOT_FOUND');
  assert.match(res.body.error.details.hint, /rotate/);
});

// ============================================================================
// 7. POST /:id/rotate — ~6 tests
// ============================================================================

test('POST /clientes/:id/rotate: rota → 200 con new_api_key', async () => {
  resetDb();
  const app = makeApp();
  internalClient.createClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: ALL_OPS.join(','),
    apiKey: TEST_API_KEY_CLIENT_A,
  });
  const res = await request(app)
    .post(`/internal/admin/clientes/${TEST_EMPRESA_A}/rotate`)
    .set(HEADERS)
    .send({});
  assert.equal(res.status, 200);
  assert.ok(res.body.new_api_key, 'debe retornar new_api_key');
  // 10 (prefijo kair_test_) + 43 (base64url de 32 bytes) = 53 chars
  assert.equal(res.body.new_api_key.length, 53);
  assert.match(res.body.new_api_key, /^kair_test_[A-Za-z0-9_-]{43}$/);
  assert.match(res.body.old_api_key_hash_prefix, /^[0-9a-f]{8}$/);
  assert.match(res.body.new_api_key_hash_prefix, /^[0-9a-f]{8}$/);
  // allowed_operations heredadas
  assert.deepEqual(res.body.allowed_operations, ALL_OPS);
  // Defaults
  assert.equal(res.body.motivo, 'Rotación programada');
  assert.equal(res.body.actor, 'admin');
});

test('POST /clientes/:id/rotate: 404 si no hay cliente activo', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes/900000000/rotate')
    .set(HEADERS)
    .send({});
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'CLIENT_NOT_FOUND');
  assert.equal(res.body.error.details.id_empresa, '900000000');
});

test('POST /clientes/:id/rotate: cliente viejo queda revoked_at setado', async () => {
  resetDb();
  const app = makeApp();
  const c = internalClient.createClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: 'sign_request:create',
    apiKey: 'kair_test_old_key_32chars_padding_ok',
  });
  await request(app)
    .post(`/internal/admin/clientes/${TEST_EMPRESA_A}/rotate`)
    .set(HEADERS)
    .send({});
  const oldRow = db.prepare(
    'SELECT revoked_at FROM gh_internal_clients WHERE api_key_hash = ?'
  ).get(c.api_key_hash);
  assert.ok(oldRow.revoked_at, 'el cliente viejo debe estar revocado');
});

test('POST /clientes/:id/rotate: new key funciona, old key NO (cache invalidado)', async () => {
  resetDb();
  const app = makeApp();
  internalClient.createClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: 'sign_request:create',
    apiKey: TEST_API_KEY_CLIENT_A,
  });
  // Forzar que la key vieja quede en el cache
  const beforeRotate = internalClient.getActiveClientByApiKey(TEST_API_KEY_CLIENT_A);
  assert.ok(beforeRotate, 'old key debe estar activa antes de rotar');

  const r = await request(app)
    .post(`/internal/admin/clientes/${TEST_EMPRESA_A}/rotate`)
    .set(HEADERS)
    .send({});
  const newKey = r.body.new_api_key;

  // Old key ya NO debe funcionar
  const afterOld = internalClient.getActiveClientByApiKey(TEST_API_KEY_CLIENT_A);
  assert.equal(afterOld, null, 'old key debe retornar null tras rotación');

  // New key SÍ debe funcionar
  const afterNew = internalClient.getActiveClientByApiKey(newKey);
  assert.ok(afterNew, 'new key debe estar activa');
  assert.equal(afterNew.id_empresa, TEST_EMPRESA_A);
});

test('POST /clientes/:id/rotate: body con motivo/actor custom → eco en response', async () => {
  resetDb();
  const app = makeApp();
  internalClient.createClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: 'sign_request:create',
    apiKey: 'kair_test_custom_body_32chars_padding_ok',
  });
  const res = await request(app)
    .post(`/internal/admin/clientes/${TEST_EMPRESA_A}/rotate`)
    .set(HEADERS)
    .send({ motivo: 'Rotación trimestral', actor: 'ops@tempoactiva.com' });
  assert.equal(res.status, 200);
  assert.equal(res.body.motivo, 'Rotación trimestral');
  assert.equal(res.body.actor, 'ops@tempoactiva.com');
});

test('POST /clientes/:id/rotate: body con campo extra → 400 (strict)', async () => {
  resetDb();
  const app = makeApp();
  internalClient.createClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: 'sign_request:create',
    apiKey: 'kair_test_extra_field_32chars_padding_ok',
  });
  const res = await request(app)
    .post(`/internal/admin/clientes/${TEST_EMPRESA_A}/rotate`)
    .set(HEADERS)
    .send({ motivo: 'X', allowed_operations: ['sign_request:create'] });
  // allowed_operations no es válido en rotación → rejected por .strict()
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

// ============================================================================
// 8. Cross-cutting — ~5 tests
// ============================================================================

test('Cross: id_empresa con caracteres Unicode (emojis) se acepta', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send({ id_empresa: '🎉Empresa-Test_2026', allowed_operations: ['sign_request:create'] });
  assert.equal(res.status, 201);
  assert.equal(res.body.id_empresa, '🎉Empresa-Test_2026');
});

test('Cross: 2 POST seguidos en rápida sucesión → 1 OK, 1 409 (no race)', async () => {
  resetDb();
  const app = makeApp();
  const [r1, r2] = await Promise.all([
    request(app).post('/internal/admin/clientes').set(HEADERS).send(VALID_BODY),
    request(app).post('/internal/admin/clientes').set(HEADERS).send(VALID_BODY),
  ]);
  const statuses = [r1.status, r2.status].sort();
  assert.deepEqual(statuses, [201, 409],
    'uno debe ser 201 y el otro 409, sin race condition (SQLite serializa)');
});

test('Cross: format de la key es kair_test_<43 base64url> en test env', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send(VALID_BODY);
  assert.equal(res.status, 201);
  // crypto.randomBytes(32).toString('base64url') produce 43 chars (sin padding).
  // Prefijo `kair_test_` = 10 chars. Total: 10 + 43 = 53 chars.
  assert.equal(res.body.api_key.length, 53);
  assert.match(res.body.api_key, /^kair_test_[A-Za-z0-9_-]{43}$/);
});

test('Cross: dos clientes distintos generan keys distintas', async () => {
  resetDb();
  const app = makeApp();
  const r1 = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send({ id_empresa: '900111111', allowed_operations: ['sign_request:create'] });
  const r2 = await request(app)
    .post('/internal/admin/clientes')
    .set(HEADERS)
    .send({ id_empresa: '900222222', allowed_operations: ['sign_request:create'] });
  assert.notEqual(r1.body.api_key, r2.body.api_key,
    'cada cliente debe tener api_key única');
});

test('Cross: rotación preserva description', async () => {
  resetDb();
  const app = makeApp();
  const description = 'K+AIR empresa X - produccion (mantener tras rotar)';
  internalClient.createClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: 'sign_request:create',
    description,
    apiKey: 'kair_test_preserve_desc_32chars_padding',
  });
  const res = await request(app)
    .post(`/internal/admin/clientes/${TEST_EMPRESA_A}/rotate`)
    .set(HEADERS)
    .send({});
  assert.equal(res.status, 200);
  assert.equal(res.body.description, description,
    'description debe heredarse al rotar');
});
