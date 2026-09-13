/**
 * Tests de integración del flujo admin de per-company clients (I-010 + D-13).
 *
 * Subagente A: estos tests NO son unit tests de los endpoints individuales
 * (eso está en tests/routes/admin-clientes.test.js, también de A). Son
 * **integración end-to-end del flujo completo**:
 *
 *   1. POST /admin/clientes (crea per-company client)
 *   2. POST /admin/clientes/:id/rotate (rota la key)
 *   3. POST /admin/clientes/:id (DR-6.C, segunda vez con misma empresa → 409)
 *   4. POST /internal/sign-requests con la key creada vía admin (flujo completo)
 *   5. Cross-company: key de A NO crea sign request de B
 *   6. GET /admin/clientes (lista activos y revocados, sin api_key en plaintext)
 *   7. POST /admin/clientes con `displayName` (DR-6.A) y sin allowed_operations
 *      (DR-6.B) — el bridge hace el mapeo
 *
 * Decisiones validadas (DR-6, binding):
 *   - DR-6.A: el body recibido por el backend tiene `description` formateado
 *     como `K+AIR empresa ${displayName} - ${config.env}` (cuando el bridge
 *     construye el body — en este test, lo construimos nosotros mismos para
 *     validar que el backend ACEPTA el formato esperado).
 *   - DR-6.B: el body tiene los 5 valores del enum I-010.
 *   - DR-6.C: el backend retorna 409 CLIENT_EXISTS_FOR_EMPRESA (con detalles)
 *     cuando la empresa YA tiene un cliente activo.
 *
 * Sobre el prefijo de keys generadas por admin:
 *   - El backend genera keys con formato `kair_(live|test)_<43 chars base64url>`
 *   - En estos tests, el prefijo esperado es `kair_test_` (NODE_ENV=test).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const { sha256 } = require('../../src/crypto/hash');
const {
  resetDb, seedActiveAgreement, makeApp,
  withAdminApiKey,
  TEST_ADMIN_API_KEY, TEST_API_KEY_CLIENT_A,
  TEST_EMPRESA_A, TEST_EMPRESA_B,
} = require('../helpers');

const ADMIN_HEADERS = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };

const ALL_OPS = [
  'sign_request:create',
  'sign_request:read',
  'consent:create',
  'consent:verify',
  'audit:read',
];

async function makePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([300, 200]);
  return Buffer.from(await doc.save());
}

// =============================================================================
// 1. POST /admin/clientes — Crear per-company client
// =============================================================================

test('admin flow: POST /admin/clientes crea per-company client para empresa A', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(ADMIN_HEADERS)
    .send({
      id_empresa: TEST_EMPRESA_A,
      allowed_operations: ALL_OPS,
      description: 'K+AIR empresa 900123456 - production',
    });
  assert.equal(res.status, 201, JSON.stringify(res.body).slice(0, 500));
  // El response DEBE incluir el plaintext SOLO esta vez.
  assert.ok(typeof res.body.api_key === 'string' && res.body.api_key.length >= 32,
    'api_key en plaintext debe estar presente y ≥32 chars');
  // El prefijo en test es kair_test_
  assert.match(res.body.api_key, /^kair_test_[A-Za-z0-9_-]{43}$/,
    `api_key debe tener formato kair_test_<43 chars base64url> (recibido: ${res.body.api_key.slice(0, 20)}...)`);
  assert.equal(res.body.id_empresa, TEST_EMPRESA_A);
  assert.deepEqual(res.body.allowed_operations, ALL_OPS);
  assert.ok(res.body.api_key_hash_prefix && res.body.api_key_hash_prefix.length === 8,
    'api_key_hash_prefix debe tener 8 chars hex');
});

test('admin flow: POST /admin/clientes con X-Internal-API-Key (no admin) → 401', async () => {
  resetDb();
  const app = makeApp();
  // X-Internal-API-Key es per-company, no admin. NO debe funcionar.
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({
      id_empresa: TEST_EMPRESA_A,
      allowed_operations: ALL_OPS,
    });
  assert.equal(res.status, 401, JSON.stringify(res.body).slice(0, 300));
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('admin flow: POST /admin/clientes sin admin key → 401', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .send({
      id_empresa: TEST_EMPRESA_A,
      allowed_operations: ALL_OPS,
    });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('admin flow: POST /admin/clientes con allowed_operations inválido → 400', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(ADMIN_HEADERS)
    .send({
      id_empresa: TEST_EMPRESA_A,
      allowed_operations: ['op_fuera_del_enum', 'otra_invalida'],
    });
  assert.equal(res.status, 400);
  // A's schema rechaza con INVALID_REQUEST_BODY + details.issues.
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
  assert.ok(res.body.error.details && res.body.error.details.issues,
    'debe incluir details.issues con el error de zod');
});

test('admin flow: POST /admin/clientes con id_empresa faltante → 400', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(ADMIN_HEADERS)
    .send({
      allowed_operations: ALL_OPS,
    });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

// =============================================================================
// 2. POST /admin/clientes/:id/rotate — Rotar
// =============================================================================

test('admin flow: POST /admin/clientes/:id/rotate genera nueva key y revoca la anterior', async () => {
  resetDb();
  const app = makeApp();

  // 1) Crear cliente A
  const c1 = await request(app)
    .post('/internal/admin/clientes')
    .set(ADMIN_HEADERS)
    .send({
      id_empresa: TEST_EMPRESA_A,
      allowed_operations: ALL_OPS,
      description: 'original',
    });
  assert.equal(c1.status, 201);
  const oldKey = c1.body.api_key;
  const oldHashPrefix = c1.body.api_key_hash_prefix;

  // 2) Rotar
  const r1 = await request(app)
    .post(`/internal/admin/clientes/${TEST_EMPRESA_A}/rotate`)
    .set(ADMIN_HEADERS)
    .send({ motivo: 'test rotation', actor: 'qa' });
  assert.equal(r1.status, 200, JSON.stringify(r1.body).slice(0, 500));
  assert.ok(typeof r1.body.new_api_key === 'string' && r1.body.new_api_key.length >= 32);
  assert.match(r1.body.new_api_key, /^kair_test_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(r1.body.new_api_key, oldKey, 'la nueva key debe ser distinta');
  assert.equal(r1.body.old_api_key_hash_prefix, oldHashPrefix, 'old hash prefix debe matchear');
  assert.equal(r1.body.id_empresa, TEST_EMPRESA_A);
});

test('admin flow: POST /admin/clientes/:id/rotate para empresa sin cliente activo → 404 CLIENT_NOT_FOUND', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes/900-INEXISTENTE/rotate')
    .set(ADMIN_HEADERS)
    .send({ motivo: 'test' });
  assert.equal(res.status, 404, JSON.stringify(res.body).slice(0, 300));
  assert.equal(res.body.error.code, 'CLIENT_NOT_FOUND');
});

// =============================================================================
// 3. POST /admin/clientes con misma id_empresa dos veces → 409 (DR-6.C)
// =============================================================================

test('admin flow (DR-6.C): POST /admin/clientes con misma id_empresa dos veces → 409 CLIENT_EXISTS_FOR_EMPRESA', async () => {
  resetDb();
  const app = makeApp();

  // 1) Crear el primer cliente
  const first = await request(app)
    .post('/internal/admin/clientes')
    .set(ADMIN_HEADERS)
    .send({
      id_empresa: TEST_EMPRESA_A,
      allowed_operations: ALL_OPS,
      description: 'primer intento',
    });
  assert.equal(first.status, 201);

  // 2) Intentar crear otro con la misma id_empresa
  const second = await request(app)
    .post('/internal/admin/clientes')
    .set(ADMIN_HEADERS)
    .send({
      id_empresa: TEST_EMPRESA_A,
      allowed_operations: ALL_OPS,
      description: 'segundo intento (debe fallar)',
    });
  assert.equal(second.status, 409, JSON.stringify(second.body).slice(0, 500));
  assert.equal(second.body.error.code, 'CLIENT_EXISTS_FOR_EMPRESA');
  assert.equal(second.body.error.details.id_empresa, TEST_EMPRESA_A);
  // Debe incluir el existing_hash_prefix
  assert.ok(second.body.error.details.existing_hash_prefix,
    'details debe incluir existing_hash_prefix');
  assert.match(second.body.error.details.existing_hash_prefix, /^[0-9a-f]{8}$/,
    'existing_hash_prefix debe ser hex de 8 chars');
});

// =============================================================================
// 4. Flujo end-to-end: crear cliente → usarlo para sign request
// =============================================================================

test('admin flow end-to-end: crear cliente A vía admin → sign request con su key', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();

  // 1) Crear cliente A vía admin
  const admin = await request(app)
    .post('/internal/admin/clientes')
    .set(ADMIN_HEADERS)
    .send({
      id_empresa: TEST_EMPRESA_A,
      allowed_operations: ALL_OPS,
      description: 'K+AIR empresa A',
    });
  assert.equal(admin.status, 201);
  const apiKey = admin.body.api_key;

  // 2) Sign request con la key recién creada
  const pdf = await makePdf();
  const signRes = await request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', apiKey)
    .set('Idempotency-Key', '00000000-0000-4000-8000-000000000001')
    .field('metadata', JSON.stringify({
      id_documento: 'doc-flow-A',
      id_trabajador: '111',
      id_empresa: TEST_EMPRESA_A,
      tipo_firma: 'presencial',
      agreement_hash: acuerdo.texto_hash,
      agreement_version: acuerdo.version,
      document_hash: sha256(pdf),
      version_kair: '0.1.190-test',
      identificacion_tipo: 'CC',
      identificacion_numero_hash: sha256('111'),
    }))
    .attach('documento', pdf, 'a.pdf');
  assert.equal(signRes.status, 201, JSON.stringify(signRes.body).slice(0, 500));
  // El sign response retorna id_solicitud, id_interno, etc. NO incluye
  // id_empresa en el body (el cliente ya lo sabe por metadata). El contrato
  // documentado está en src/routes/signRequest.js:169-184. Si en el futuro
  // se agrega id_empresa al response, este assert puede re-activarse.
  assert.ok(signRes.body.id_solicitud, 'response debe incluir id_solicitud');
});

test('admin flow end-to-end: cross-company — key de A NO crea sign request de B → 403', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();

  // 1) Crear cliente A vía admin
  const admin = await request(app)
    .post('/internal/admin/clientes')
    .set(ADMIN_HEADERS)
    .send({
      id_empresa: TEST_EMPRESA_A,
      allowed_operations: ALL_OPS,
      description: 'K+AIR empresa A',
    });
  assert.equal(admin.status, 201);
  const apiKey = admin.body.api_key;

  // 2) Intentar crear sign request de B con key de A
  const pdf = await makePdf();
  const res = await request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', apiKey)
    .set('Idempotency-Key', '00000000-0000-4000-8000-000000000002')
    .field('metadata', JSON.stringify({
      id_documento: 'doc-cross',
      id_trabajador: '111',
      id_empresa: TEST_EMPRESA_B,  // ← B con key de A
      tipo_firma: 'presencial',
      agreement_hash: acuerdo.texto_hash,
      agreement_version: acuerdo.version,
      document_hash: sha256(pdf),
      version_kair: '0.1.190-test',
      identificacion_tipo: 'CC',
      identificacion_numero_hash: sha256('111'),
    }))
    .attach('documento', pdf, 'a.pdf');
  assert.equal(res.status, 403, JSON.stringify(res.body).slice(0, 500));
  assert.equal(res.body.error.code, 'EMPRESA_MISMATCH');
});

// =============================================================================
// 5. GET /admin/clientes — Listar
// =============================================================================

test('admin flow: GET /admin/clientes lista activos (sin api_key en plaintext)', async () => {
  resetDb();
  const app = makeApp();

  // 1) Crear 2 clientes
  const c1 = await request(app)
    .post('/internal/admin/clientes')
    .set(ADMIN_HEADERS)
    .send({
      id_empresa: TEST_EMPRESA_A,
      allowed_operations: ALL_OPS,
      description: 'A',
    });
  assert.equal(c1.status, 201);
  const c2 = await request(app)
    .post('/internal/admin/clientes')
    .set(ADMIN_HEADERS)
    .send({
      id_empresa: TEST_EMPRESA_B,
      allowed_operations: ALL_OPS,
      description: 'B',
    });
  assert.equal(c2.status, 201);

  // 2) Listar
  const list = await request(app)
    .get('/internal/admin/clientes')
    .set(ADMIN_HEADERS);
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body.items), 'response debe tener items array');
  assert.equal(list.body.items.length, 2, 'debe haber 2 clientes activos');

  // 3) Verificar shape: NO api_key, NO api_key_hash completo
  for (const item of list.body.items) {
    assert.ok(!('api_key' in item), `item NO debe tener api_key (item: ${item.id_empresa})`);
    assert.ok(!('api_key_hash' in item), `item NO debe tener api_key_hash completo`);
    assert.ok(item.api_key_hash_prefix && item.api_key_hash_prefix.length === 8,
      `item debe tener api_key_hash_prefix (8 chars hex) — item: ${JSON.stringify(item).slice(0, 200)}`);
    assert.equal(item.is_active, true);
  }
  // Items están ordenados DESC por created_at (más reciente primero)
  const ids = list.body.items.map(it => it.id_empresa).sort();
  assert.deepEqual(ids, [TEST_EMPRESA_A, TEST_EMPRESA_B].sort());
});

test('admin flow: GET /admin/clientes?id_empresa=X&include_revoked=true ve revocados', async () => {
  resetDb();
  const app = makeApp();

  // 1) Crear A, luego rotar (la rotación marca la vieja como revocada)
  const c1 = await request(app)
    .post('/internal/admin/clientes')
    .set(ADMIN_HEADERS)
    .send({
      id_empresa: TEST_EMPRESA_A,
      allowed_operations: ALL_OPS,
      description: 'A original',
    });
  assert.equal(c1.status, 201);
  const rot = await request(app)
    .post(`/internal/admin/clientes/${TEST_EMPRESA_A}/rotate`)
    .set(ADMIN_HEADERS)
    .send({ motivo: 'test' });
  assert.equal(rot.status, 200);

  // 2) Listar con include_revoked=true filtrado por A
  const list = await request(app)
    .get(`/internal/admin/clientes?id_empresa=${TEST_EMPRESA_A}&include_revoked=true`)
    .set(ADMIN_HEADERS);
  assert.equal(list.status, 200);
  // 2 entries: la activa (nueva) + la revocada (vieja)
  const aItems = list.body.items.filter(it => it.id_empresa === TEST_EMPRESA_A);
  assert.equal(aItems.length, 2, `debe haber 2 items para A (1 activo + 1 revocado), hay ${aItems.length}`);
  const activos = aItems.filter(it => it.is_active === true);
  const revocados = aItems.filter(it => it.is_active === false);
  assert.equal(activos.length, 1);
  assert.equal(revocados.length, 1);
});

// =============================================================================
// 6. DR-6.A — description formateado por el bridge
// =============================================================================

test('admin flow (DR-6.A): el body con description "K+AIR empresa X - production" es aceptado', async () => {
  resetDb();
  const app = makeApp();
  // El bridge mapea displayName→description. Acá probamos que el backend
  // ACEPTA el formato esperado y lo persiste tal cual (no lo construye).
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(ADMIN_HEADERS)
    .send({
      id_empresa: '900555555',
      allowed_operations: ALL_OPS,
      description: 'K+AIR empresa EMPRESA_NUEVA - test',  // formato del bridge
    });
  assert.equal(res.status, 201, JSON.stringify(res.body).slice(0, 500));
  // El backend debe persistir el description tal cual (no lo construye).
  assert.equal(res.body.description, 'K+AIR empresa EMPRESA_NUEVA - test');
});

// =============================================================================
// 7. DR-6.B — allowed_operations con los 5 valores
// =============================================================================

test('admin flow (DR-6.B): body con los 5 valores de allowed_operations es aceptado', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(ADMIN_HEADERS)
    .send({
      id_empresa: '900666666',
      allowed_operations: ALL_OPS,  // exactamente los 5
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.allowed_operations.length, 5);
  assert.deepEqual(res.body.allowed_operations.sort(), [...ALL_OPS].sort());
});
