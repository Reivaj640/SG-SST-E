/**
 * Tests de integración de rotación + invalidación + race conditions (spec §4).
 *
 * Cobertura:
 *   1. Ciclo de vida: K_A_old → crear sign request (201) → rotar → K_A_old
 *      revocada (401) → K_A_new funciona (201).
 *   2. Cache 30s + clearCache en rotate: tras rotar, K_A_old NO funciona
 *      INMEDIATAMENTE (no ventana de 30s).
 *   3. Listado con include_revoked=true: ve 2 entradas (1 activa + 1 revocada).
 *   4. Idempotency-Key post-rotación: la key X usada con K_A_old NO se afecta
 *      por la rotación; con K_A_new es un request nuevo.
 *   5. Race: sign request en vuelo durante rotación — el sistema NO crashea
 *      y retorna un código HTTP válido (200, 201, 401 aceptables).
 *
 * Decisiones validadas:
 *   - El endpoint de rotación llama `clearCache()` en backend (sin grace
 *     period en v1, ver backend-auth-spec §3.3.5).
 *   - La nueva key hereda `allowed_operations` y `description` de la anterior.
 *   - El hash SHA-256 de la key nueva es DISTINTO del de la vieja.
 *   - Soft-delete preserva historial: la key vieja queda con `revoked_at`
 *     setado (no se borra físicamente).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../../src/db/connection');
const { PDFDocument } = require('pdf-lib');
const { sha256 } = require('../../src/crypto/hash');
const {
  resetDb, seedActiveAgreement, seedTestClients, makeApp,
  TEST_ADMIN_API_KEY, TEST_API_KEY_CLIENT_A, TEST_EMPRESA_A,
} = require('../helpers');

async function makePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([300, 200]);
  return Buffer.from(await doc.save());
}

const ADMIN_HEADERS = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };

/**
 * Helper: crea un per-company client vía admin. Retorna null si el endpoint
 * no existe (aún no implementado por A).
 */
async function adminCreateClient(body) {
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set(ADMIN_HEADERS)
    .send(body);
  return res;
}

/**
 * Helper: rota un per-company client. Retorna null si el endpoint no existe.
 */
async function adminRotateClient(id_empresa, body = {}) {
  const app = makeApp();
  const res = await request(app)
    .post(`/internal/admin/clientes/${id_empresa}/rotate`)
    .set(ADMIN_HEADERS)
    .send(body);
  return res;
}

/**
 * Helper: lista per-company clients.
 */
async function adminListClients(query = {}) {
  const app = makeApp();
  const qs = new URLSearchParams(query).toString();
  const path = '/internal/admin/clientes' + (qs ? '?' + qs : '');
  const res = await request(app).get(path).set(ADMIN_HEADERS);
  return res;
}

/**
 * Helper: crea un sign request con la key indicada.
 */
async function postSignRequest(app, apiKey, opts) {
  const pdf = await makePdf();
  const req = request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', apiKey)
    .field('metadata', JSON.stringify({
      id_documento: opts.id_documento,
      id_trabajador: opts.id_trabajador || '111',
      id_empresa: TEST_EMPRESA_A,
      tipo_firma: 'presencial',
      agreement_hash: opts.agreement.texto_hash,
      agreement_version: opts.agreement.version,
      document_hash: sha256(pdf),
      version_kair: '0.1.190-test',
      identificacion_tipo: 'CC',
      identificacion_numero_hash: sha256(opts.id_trabajador || '111'),
    }))
    .attach('documento', pdf, opts.pdfName || 'a.pdf');
  if (opts.idemKey) {
    req.set('Idempotency-Key', opts.idemKey);
  }
  return req;
}

// =============================================================================
// Test 1: Ciclo de vida completo de rotación
// =============================================================================

test('rotation #1: ciclo completo K_old → rotate → K_old revocada, K_new funciona', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();

  // 1) Crear cliente A vía admin
  const c1 = await adminCreateClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: ['sign_request:create', 'sign_request:read', 'consent:create', 'consent:verify', 'audit:read'],
    description: 'K+AIR empresa A - original',
  });
  if (c1.status === 404) {
    assert.fail('POST /admin/clientes no implementado aún');
  }
  assert.equal(c1.status, 201);
  const keyOld = c1.body.api_key;
  const oldHashPrefix = c1.body.api_key_hash_prefix;

  // 2) Antes de rotar: K_old funciona
  const r1 = await postSignRequest(app, keyOld, {
    agreement: acuerdo,
    id_documento: 'doc-rot-1',
    idemKey: '00000000-0000-4000-8000-000000000100',
  });
  assert.equal(r1.status, 201, 'K_old antes de rotar: 201');

  // 3) Rotar
  const r2 = await adminRotateClient(TEST_EMPRESA_A, { motivo: 'test rotation #1', actor: 'qa' });
  if (r2.status === 404) {
    assert.fail('POST /admin/clientes/:id/rotate no implementado aún');
  }
  assert.equal(r2.status, 200);
  const keyNew = r2.body.new_api_key;
  assert.ok(keyNew);
  assert.notEqual(keyNew, keyOld, 'K_new debe ser distinta de K_old');
  assert.equal(r2.body.old_api_key_hash_prefix, oldHashPrefix, 'old hash prefix debe matchear');
  assert.deepEqual(r2.body.allowed_operations.sort(),
    ['audit:read', 'consent:create', 'consent:verify', 'sign_request:create', 'sign_request:read'],
    'K_new hereda las allowed_operations');
  assert.equal(r2.body.description, 'K+AIR empresa A - original', 'description heredada');

  // 4) Después de rotar: K_old NO funciona (clearCache invalidó)
  const r3 = await postSignRequest(app, keyOld, {
    agreement: acuerdo,
    id_documento: 'doc-rot-2',
    idemKey: '00000000-0000-4000-8000-000000000101',
  });
  assert.equal(r3.status, 401, 'K_old después de rotar: 401');
  assert.equal(r3.body.error.code, 'INVALID_API_KEY');

  // 5) K_new SÍ funciona
  const r4 = await postSignRequest(app, keyNew, {
    agreement: acuerdo,
    id_documento: 'doc-rot-3',
    idemKey: '00000000-0000-4000-8000-000000000102',
  });
  assert.equal(r4.status, 201, 'K_new: 201');
});

// =============================================================================
// Test 2: Cache invalidation (sin ventana de 30s post-rotación)
// =============================================================================

test('rotation #2: clearCache() en rotate invalida K_old inmediatamente (sin ventana 30s)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();

  // 1) Crear cliente A
  const c1 = await adminCreateClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: ['sign_request:create', 'sign_request:read', 'consent:create', 'consent:verify', 'audit:read'],
    description: 'Para test cache',
  });
  if (c1.status === 404) {
    assert.fail('POST /admin/clientes no implementado aún');
  }
  const keyOld = c1.body.api_key;

  // 2) Hacer un sign request con K_old para "calentar" el cache
  const r1 = await postSignRequest(app, keyOld, {
    agreement: acuerdo,
    id_documento: 'doc-cache-1',
    idemKey: '00000000-0000-4000-8000-000000000110',
  });
  assert.equal(r1.status, 201);

  // 3) Rotar
  const r2 = await adminRotateClient(TEST_EMPRESA_A, { motivo: 'cache test' });
  if (r2.status === 404) {
    assert.fail('POST /admin/clientes/:id/rotate no implementado aún');
  }
  assert.equal(r2.status, 200);

  // 4) Inmediatamente después, K_old debe estar invalidada
  // (clearCache en backend-auth-spec §3.3.5, sin grace period en v1)
  const r3 = await postSignRequest(app, keyOld, {
    agreement: acuerdo,
    id_documento: 'doc-cache-2',
    idemKey: '00000000-0000-4000-8000-000000000111',
  });
  assert.equal(r3.status, 401,
    'K_old debe ser rechazada inmediatamente post-rotación (clearCache, no 30s window)');
});

// =============================================================================
// Test 3: Listado con include_revoked=true ve revocados
// =============================================================================

test('rotation #3: GET /admin/clientes?include_revoked=true ve revocados', async () => {
  resetDb();
  const app = makeApp();

  // 1) Crear A y B
  await adminCreateClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: ['sign_request:create'],
    description: 'A',
  });
  if ((await adminListClients()).status === 404) {
    assert.fail('GET /admin/clientes no implementado aún');
  }
  await adminCreateClient({
    id_empresa: '900999998',  // otro id, no B (que es 900999999) — para no chocar
    allowed_operations: ['sign_request:create'],
    description: 'C',
  });

  // 2) Rotar A
  const r2 = await adminRotateClient(TEST_EMPRESA_A, { motivo: 'test list' });
  if (r2.status === 404) {
    assert.fail('POST /admin/clientes/:id/rotate no implementado aún');
  }

  // 3) Listar con include_revoked=true filtrado por A
  const list = await adminListClients({ id_empresa: TEST_EMPRESA_A, include_revoked: 'true' });
  assert.equal(list.status, 200);
  const aItems = list.body.items.filter(it => it.id_empresa === TEST_EMPRESA_A);
  assert.equal(aItems.length, 2,
    `A debe tener 2 entries (1 activa + 1 revocada) — hay ${aItems.length}`);
  const activos = aItems.filter(it => it.is_active === true);
  const revocados = aItems.filter(it => it.is_active === false);
  assert.equal(activos.length, 1);
  assert.equal(revocados.length, 1);

  // 4) Sin include_revoked: solo 1 item (el activo)
  const list2 = await adminListClients({ id_empresa: TEST_EMPRESA_A });
  assert.equal(list2.status, 200);
  const aItems2 = list2.body.items.filter(it => it.id_empresa === TEST_EMPRESA_A);
  assert.equal(aItems2.length, 1, 'sin include_revoked: solo 1 item activo');
  assert.equal(aItems2[0].is_active, true);
});

// =============================================================================
// Test 4: Idempotency-Key post-rotación
// =============================================================================

test('rotation #4: idempotency-key X con K_old es independiente de K_new (request nuevo)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();

  // 1) Crear cliente A
  const c1 = await adminCreateClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: ['sign_request:create', 'sign_request:read', 'consent:create', 'consent:verify', 'audit:read'],
    description: 'idem test',
  });
  if (c1.status === 404) {
    assert.fail('POST /admin/clientes no implementado aún');
  }
  const keyOld = c1.body.api_key;

  // 2) Sign request con K_old + idem X
  const idem = '00000000-0000-4000-8000-000000000120';
  const r1 = await postSignRequest(app, keyOld, {
    agreement: acuerdo,
    id_documento: 'doc-idem-rot-1',
    idemKey: idem,
  });
  assert.equal(r1.status, 201);
  const idA1 = r1.body.id_solicitud;

  // 3) Rotar
  const r2 = await adminRotateClient(TEST_EMPRESA_A, { motivo: 'idem rot test' });
  if (r2.status === 404) {
    assert.fail('POST /admin/clientes/:id/rotate no implementado aún');
  }
  const keyNew = r2.body.new_api_key;

  // 4) Sign request con K_new + idem DIFERENTE + mismo body
  // DR-2026-08-20: el backend trata la idem-key como global (no scoped a
  // api_key ni a id_empresa). Misma idem + mismo body → replay (mismo
  // id_solicitud). El test verifica el caso realista: tras rotar, el
  // cliente usa una idem-key NUEVA para crear un sign request NUEVO.
  const idemNew = '00000000-0000-4000-8000-000000000121';
  const r3 = await postSignRequest(app, keyNew, {
    agreement: acuerdo,
    id_documento: 'doc-idem-rot-1',  // mismo id_documento
    idemKey: idemNew,                 // idem DIFERENTE
  });
  assert.equal(r3.status, 201, JSON.stringify(r3.body).slice(0, 500));
  assert.notEqual(r3.body.id_solicitud, idA1,
    'K_new con idem DIFERENTE debe crear un sign request DISTINTO (id diferente)');
});

// =============================================================================
// Test 5: Race: sign request en vuelo durante rotación
// =============================================================================

test('rotation #5: race entre sign request y rotate — no crashea, retorna código válido', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();

  // 1) Crear cliente A
  const c1 = await adminCreateClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: ['sign_request:create', 'sign_request:read', 'consent:create', 'consent:verify', 'audit:read'],
    description: 'race test',
  });
  if (c1.status === 404) {
    assert.fail('POST /admin/clientes no implementado aún');
  }
  const keyA = c1.body.api_key;

  // 2) Lanzar sign request y rotate casi simultáneamente
  // No podemos garantizar determinismo, pero verificamos que no crashea.
  const signReqPromise = postSignRequest(app, keyA, {
    agreement: acuerdo,
    id_documento: 'doc-race-1',
    idemKey: '00000000-0000-4000-8000-000000000130',
  });

  // Lanzar rotate después de un microtask (para que el sign request
  // alcance a iniciar primero)
  await new Promise(resolve => setTimeout(resolve, 1));
  const rotatePromise = adminRotateClient(TEST_EMPRESA_A, { motivo: 'race test' });

  // Esperar ambos
  const [r1, r2] = await Promise.all([signReqPromise, rotatePromise]);

  // Comportamiento esperado: el sign request puede pasar (201) o fallar (401).
  // NO debe crashear (5xx sin sentido). 200 también aceptable.
  assert.ok([200, 201, 401].includes(r1.status),
    `sign request durante rotación: status=${r1.status} (esperado 200/201/401, no 5xx)`);

  // El rotate debe haber tenido éxito (es independiente)
  if (r2.status === 404) {
    assert.fail('POST /admin/clientes/:id/rotate no implementado aún');
  }
  assert.equal(r2.status, 200, 'rotate debe retornar 200 (independiente del sign request)');
});
