/**
 * Tests de cross-company authz (I-010, D-13).
 *
 * Verifica que un cliente autenticado con la key de la empresa A:
 *  - PUEDE acceder a sign requests/consents de la empresa A.
 *  - NO PUEDE acceder a sign requests/consents de la empresa B.
 *
 * Endpoints cubiertos (6 × 2 direcciones = 12 tests):
 *  1. POST /internal/sign-requests            (A→A OK, A→B 403 EMPRESA_MISMATCH)
 *  2. GET  /internal/sign-requests/:id        (A→A OK, A→B 404 silent)
 *  3. GET  /internal/sign-requests            (A→A lista propia, A→B query IGNORED)
 *  4. GET  /internal/sign-requests/:id/eventos (A→A OK, A→B 404 silent)
 *  5. POST /internal/consentimientos          (A→A OK, A→B 403 EMPRESA_MISMATCH)
 *  6. POST /internal/consentimientos/:id/verify-otp (A→A OK, A→B 404 silent)
 *
 * Decisiones validadas:
 *  - `req.id_empresa` SIEMPRE viene de la identidad autenticada, nunca del
 *    body/query. Un cliente A NO puede inyectar id_empresa=B en body o query
 *    para acceder a recursos de B.
 *  - GET /:id y GET eventos: 404 (no 403) para no filtrar existencia.
 *  - GET lista: el query `?id_empresa=B` es IGNORADO en client mode y se
 *    fuerza `req.id_empresa`.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  resetDb, seedActiveAgreement, seedTestClients, makeApp,
  withClientAApiKey, withClientBApiKey, withLegacyApiKey,
  TEST_API_KEY_CLIENT_A, TEST_API_KEY_CLIENT_B,
  TEST_EMPRESA_A, TEST_EMPRESA_B,
  createSignRequestWithIdentificacion, createAcceptedConsent,
} = require('../helpers');
const { PDFDocument } = require('pdf-lib');
const { sha256 } = require('../../src/crypto/hash');

async function makePdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  page.drawText('Documento de prueba');
  return Buffer.from(await doc.save());
}

/**
 * Helper: crea un sign request para la empresa indicada usando el service
 * directamente (bypass HTTP para que el test no dependa de la lógica de auth
 * que estamos testeando). El sign request queda con id_empresa de su empresa.
 *
 * Retorna el signRequest (con id_solicitud, id_interno, etc.), NO el wrapper
 * `{signRequest, token, url_publica}` que retorna el service.
 */
async function createSignRequestForEmpresa(id_empresa) {
  const result = await createSignRequestWithIdentificacion({
    id_empresa,
    id_documento: `doc-${id_empresa}`,
    id_trabajador: '1234567890',
  });
  return result.signRequest;
}

// =================================================================
// 1. POST /internal/sign-requests
// =================================================================

test('I-010 cross-company: POST create A→A (id_empresa matches auth) → 201', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const pdf = await makePdf();
  const res = await request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .field('metadata', JSON.stringify({
      id_documento: 'doc-A',
      id_trabajador: '1234567890',
      id_empresa: TEST_EMPRESA_A,  // matches client A's id_empresa
      tipo_firma: 'presencial',
      agreement_hash: acuerdo.texto_hash,
      agreement_version: acuerdo.version,
      document_hash: sha256(pdf),
      version_kair: '0.1.189-test',
      identificacion_tipo: 'CC',
      identificacion_numero_hash: sha256('1234567890'),
    }))
    .attach('documento', pdf, 'test.pdf');
  assert.equal(res.status, 201);
  assert.ok(res.body.id_solicitud);
  assert.equal(res.body.id_solicitud.startsWith('SIGN-'), true);
});

test('I-010 cross-company: POST create A→B (id_empresa mismatch con auth) → 403 EMPRESA_MISMATCH', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const pdf = await makePdf();
  const res = await request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .field('metadata', JSON.stringify({
      id_documento: 'doc-ataque',
      id_trabajador: '1234567890',
      id_empresa: TEST_EMPRESA_B,  // ← B con key de A → cross-company
      tipo_firma: 'presencial',
      agreement_hash: acuerdo.texto_hash,
      agreement_version: acuerdo.version,
      document_hash: sha256(pdf),
      version_kair: '0.1.189-test',
      identificacion_tipo: 'CC',
      identificacion_numero_hash: sha256('1234567890'),
    }))
    .attach('documento', pdf, 'test.pdf');
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'EMPRESA_MISMATCH');
  assert.equal(res.body.error.details.auth_id_empresa, TEST_EMPRESA_A);
  assert.equal(res.body.error.details.requested_id_empresa, TEST_EMPRESA_B);
});

// =================================================================
// 2. GET /internal/sign-requests/:id
// =================================================================

test('I-010 cross-company: GET /:id A→A (consulta su propio sign request) → 200', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const sr = await createSignRequestForEmpresa(TEST_EMPRESA_A);
  const app = makeApp();
  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}`)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);
  assert.equal(res.status, 200);
  assert.equal(res.body.id_solicitud, sr.id_solicitud);
  assert.equal(res.body.id_empresa, TEST_EMPRESA_A);
});

test('I-010 cross-company: GET /:id A→B (consulta sign request de B) → 404 silent', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  // Crear un sign request de la empresa B con key de B
  const srB = await createSignRequestForEmpresa(TEST_EMPRESA_B);
  const app = makeApp();
  // Consultar con key de A: debe retornar 404 (NO 403, para no filtrar existencia)
  const res = await request(app)
    .get(`/internal/sign-requests/${srB.id_solicitud}`)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

// =================================================================
// 3. GET /internal/sign-requests (lista)
// =================================================================

test('I-010 cross-company: GET lista A→A (ve solo sus propios sign requests)', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  await createSignRequestForEmpresa(TEST_EMPRESA_A);
  await createSignRequestForEmpresa(TEST_EMPRESA_A);
  await createSignRequestForEmpresa(TEST_EMPRESA_B);  // ← B (no debería ver A)

  const app = makeApp();
  const res = await request(app)
    .get('/internal/sign-requests')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 2, 'A solo debe ver sus 2 sign requests, no los de B');
  for (const item of res.body.items) {
    assert.equal(item.id_empresa, TEST_EMPRESA_A,
      `todos los items deben ser de la empresa A (vino: ${item.id_empresa})`);
  }
});

test('I-010 cross-company: GET lista A→B con ?id_empresa=B → query IGNORED, ve solo A', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  await createSignRequestForEmpresa(TEST_EMPRESA_A);
  await createSignRequestForEmpresa(TEST_EMPRESA_B);  // ← existe

  const app = makeApp();
  // Intentar inyectar ?id_empresa=B con key de A. Debe ser IGNORADO.
  const res = await request(app)
    .get('/internal/sign-requests?id_empresa=' + TEST_EMPRESA_B)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 1, 'el query ?id_empresa=B debe ser IGNORADO, solo ve los de A');
  assert.equal(res.body.items[0].id_empresa, TEST_EMPRESA_A);
});

// =================================================================
// 4. GET /internal/sign-requests/:id/eventos
// =================================================================

test('I-010 cross-company: GET eventos A→A (consulta eventos propios) → 200', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const sr = await createSignRequestForEmpresa(TEST_EMPRESA_A);
  const app = makeApp();
  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);
  assert.equal(res.status, 200);
  assert.equal(res.body.id_solicitud, sr.id_solicitud);
  assert.ok(res.body.eventos.length >= 1, 'debe tener al menos el evento CREATED');
});

test('I-010 cross-company: GET eventos A→B (consulta eventos de B) → 404 silent', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const srB = await createSignRequestForEmpresa(TEST_EMPRESA_B);
  const app = makeApp();
  const res = await request(app)
    .get(`/internal/sign-requests/${srB.id_solicitud}/eventos`)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

// =================================================================
// 5. POST /internal/consentimientos
// =================================================================

test('I-010 cross-company: POST consent create A→A (id_empresa matches auth) → 201', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/consentimientos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({
      id_trabajador: '1234567890',
      id_empresa: TEST_EMPRESA_A,  // matches client A
      version_acuerdo: 'v1.0',
      correo_verificacion: 'trabajadorA@example.com',
      kair_version: '0.1.189-test',
    });
  assert.equal(res.status, 201);
  assert.ok(res.body.consent_id);
});

test('I-010 cross-company: POST consent create A→B (id_empresa mismatch) → 403 EMPRESA_MISMATCH', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/consentimientos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({
      id_trabajador: '1234567890',
      id_empresa: TEST_EMPRESA_B,  // ← B con key de A
      version_acuerdo: 'v1.0',
      correo_verificacion: 'trabajadorB@example.com',
      kair_version: '0.1.189-test',
    });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'EMPRESA_MISMATCH');
  assert.equal(res.body.error.details.auth_id_empresa, TEST_EMPRESA_A);
  assert.equal(res.body.error.details.requested_id_empresa, TEST_EMPRESA_B);
});

// =================================================================
// 6. POST /internal/consentimientos/:id/verify-otp
// =================================================================

test('I-010 cross-company: POST verify-otp A→A (su propio consent) → 200', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  // Crear consent de A
  const r1 = await request(app)
    .post('/internal/consentimientos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({
      id_trabajador: '111',
      id_empresa: TEST_EMPRESA_A,
      version_acuerdo: 'v1.0',
      correo_verificacion: 'aa@example.com',
      kair_version: '0.1.189-test',
    });
  assert.equal(r1.status, 201);
  // Verificar OTP con key de A → 200
  const r2 = await request(app)
    .post(`/internal/consentimientos/${r1.body.consent_id}/verify-otp`)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({ otp: r1.body.devOtp, kair_version: '0.1.189-test' });
  assert.equal(r2.status, 200);
  assert.equal(r2.body.manifestacion_aceptada, true);
});

test('I-010 cross-company: POST verify-otp A→B (consulta OTP de consent de B) → 404 silent', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  // Crear consent de B con key de B
  const r1 = await request(app)
    .post('/internal/consentimientos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_B)
    .send({
      id_trabajador: '222',
      id_empresa: TEST_EMPRESA_B,
      version_acuerdo: 'v1.0',
      correo_verificacion: 'bb@example.com',
      kair_version: '0.1.189-test',
    });
  assert.equal(r1.status, 201);
  // Intentar verificar el OTP del consent de B con key de A → 404 silent
  const r2 = await request(app)
    .post(`/internal/consentimientos/${r1.body.consent_id}/verify-otp`)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({ otp: r1.body.devOtp, kair_version: '0.1.189-test' });
  assert.equal(r2.status, 404,
    'A no debe poder verificar OTP del consent de B (404 silent)');
  assert.equal(r2.body.error.code, 'NOT_FOUND');
});
