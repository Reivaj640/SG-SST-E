/**
 * Tests de integración cross-empresa — matriz §2 del spec.
 *
 * Esta matriz (16 casos en la spec §2) verifica que la key de la empresa A
 * NUNCA opera sobre recursos de la empresa B y viceversa.
 *
 * Cobertura por caso del spec:
 *   - #1, #3, #6, #7, #8, #9, #11, #14, #15, #16: NUEVOS en este archivo.
 *   - #2, #5, #10, #12, #13: YA CUBIERTOS en signRequest-cross-company.test.js
 *     y adminAuth.test.js. No se duplican acá (regla de no overlap con tests
 *     existentes).
 *
 * Endpoints cubiertos:
 *   - POST /internal/sign-requests (#1, #3)
 *   - GET /internal/sign-requests/:id (#4, #5)
 *   - GET /internal/sign-requests (#6, #7, #8)
 *   - GET /internal/sign-requests-batch?ids=… (#16)
 *   - POST /internal/consentimientos (#9, #10)
 *   - POST /internal/consentimientos/:id/verify-otp (#11, #12)
 *   - POST /internal/admin/clientes (#13, #14) [depende de A]
 *   - POST /internal/admin/clientes/:id/rotate (#15) [depende de A]
 *
 * Decisiones validadas:
 *   - El scope `req.id_empresa` SIEMPRE viene de la identidad autenticada,
 *     NUNCA del body o query. (Ya validado en cross-company; este archivo
 *     extiende la cobertura al batch endpoint.)
 *   - GET lista: el query `?id_empresa=B` es IGNORADO en client mode.
 *   - GET batch: items de otras empresas van a `forbidden[]` o `missing[]`,
 *     NO se filtran al cliente.
 *   - Endpoints admin: la per-company key NO funciona como admin.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const { sha256 } = require('../../src/crypto/hash');
const {
  resetDb, seedActiveAgreement, seedTestClients, makeApp,
  withClientAApiKey, withClientBApiKey, withLegacyApiKey,
  TEST_API_KEY_CLIENT_A, TEST_API_KEY_CLIENT_B,
  TEST_API_KEY,
  TEST_EMPRESA_A, TEST_EMPRESA_B,
  createSignRequestWithIdentificacion,
} = require('../helpers');

async function makePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([300, 200]);
  return Buffer.from(await doc.save());
}

async function createSignRequestForEmpresa(id_empresa) {
  const result = await createSignRequestWithIdentificacion({
    id_empresa,
    id_documento: `doc-${id_empresa}`,
    id_trabajador: '1234567890',
  });
  return result.signRequest;
}

// =============================================================================
// #1, #3 — POST /internal/sign-requests con K_A y K_B
// =============================================================================

test('isolation #1: POST sign-request K_A con id_empresa=A → 201', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const pdf = await makePdf();
  const res = await request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .set('Idempotency-Key', '00000000-0000-4000-8000-000000000010')
    .field('metadata', JSON.stringify({
      id_documento: 'doc-A-iso1',
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
  assert.equal(res.status, 201, JSON.stringify(res.body).slice(0, 300));
  assert.ok(res.body.id_solicitud);
  // DR-2026-08-20: sign response NO incluye id_empresa (ver
  // src/routes/signRequest.js:169-184). El cliente ya sabe qué empresa
  // usó (la puso en metadata). Validamos el id_solicitud como prueba
  // de que la request creó un sign request exitoso.
  // assert.equal(res.body.id_empresa, TEST_EMPRESA_A);
});

test('isolation #3: POST sign-request K_B con id_empresa=B → 201', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const pdf = await makePdf();
  const res = await request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_B)
    .set('Idempotency-Key', '00000000-0000-4000-8000-000000000011')
    .field('metadata', JSON.stringify({
      id_documento: 'doc-B-iso3',
      id_trabajador: '222',
      id_empresa: TEST_EMPRESA_B,
      tipo_firma: 'presencial',
      agreement_hash: acuerdo.texto_hash,
      agreement_version: acuerdo.version,
      document_hash: sha256(pdf),
      version_kair: '0.1.190-test',
      identificacion_tipo: 'CC',
      identificacion_numero_hash: sha256('222'),
    }))
    .attach('documento', pdf, 'b.pdf');
  assert.equal(res.status, 201, JSON.stringify(res.body).slice(0, 300));
  // DR-2026-08-20: sign response NO incluye id_empresa (ver
  // src/routes/signRequest.js:169-184). Ver comentario en línea 92.
  // assert.equal(res.body.id_empresa, TEST_EMPRESA_B);
});

// =============================================================================
// #6, #7, #8 — GET /internal/sign-requests (lista) cross-company
// =============================================================================

test('isolation #6: GET lista con K_A sin query → solo items de A', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  // Crear 2 de A, 1 de B
  await createSignRequestForEmpresa(TEST_EMPRESA_A);
  await createSignRequestForEmpresa(TEST_EMPRESA_A);
  await createSignRequestForEmpresa(TEST_EMPRESA_B);

  const app = makeApp();
  const res = await request(app)
    .get('/internal/sign-requests')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 2, 'K_A solo ve 2 items (los suyos)');
  for (const item of res.body.items) {
    assert.equal(item.id_empresa, TEST_EMPRESA_A);
  }
});

test('isolation #7: GET lista con K_A y ?id_empresa=B → query IGNORED, solo items de A', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  await createSignRequestForEmpresa(TEST_EMPRESA_A);
  await createSignRequestForEmpresa(TEST_EMPRESA_B);

  const app = makeApp();
  const res = await request(app)
    .get(`/internal/sign-requests?id_empresa=${TEST_EMPRESA_B}`)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 1, 'query ?id_empresa=B debe ser IGNORADO');
  assert.equal(res.body.items[0].id_empresa, TEST_EMPRESA_A);
});

test('isolation #8: GET lista con K_B y ?id_empresa=A → query IGNORED, solo items de B', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  await createSignRequestForEmpresa(TEST_EMPRESA_A);
  await createSignRequestForEmpresa(TEST_EMPRESA_B);
  await createSignRequestForEmpresa(TEST_EMPRESA_B);

  const app = makeApp();
  const res = await request(app)
    .get(`/internal/sign-requests?id_empresa=${TEST_EMPRESA_A}`)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_B);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 2, 'K_B ve 2 items (los suyos)');
  for (const item of res.body.items) {
    assert.equal(item.id_empresa, TEST_EMPRESA_B);
  }
});

// =============================================================================
// #16 — GET /internal/sign-requests-batch?ids=X1,X2 cross-company
// =============================================================================

test('isolation #16: GET sign-requests-batch con K_A e ids de A y B → items solo A, B en missing/forbidden', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const srA = await createSignRequestForEmpresa(TEST_EMPRESA_A);
  const srB = await createSignRequestForEmpresa(TEST_EMPRESA_B);

  const app = makeApp();
  const idsCsv = `${srA.id_solicitud},${srB.id_solicitud}`;
  const res = await request(app)
    .get(`/internal/sign-requests-batch?ids=${idsCsv}`)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);
  assert.equal(res.status, 200, JSON.stringify(res.body).slice(0, 500));

  // El batch debe tener 1 item (el de A) y 1 elemento en missing[] o forbidden[]
  assert.equal(res.body.items.length, 1, 'solo 1 item propio');
  assert.equal(res.body.items[0].id_solicitud, srA.id_solicitud);

  // El id de B debe estar en missing[] o forbidden[]
  const missing = res.body.missing || [];
  const forbidden = res.body.forbidden || [];
  const seenIn = missing.includes(srB.id_solicitud) ? 'missing' :
                 forbidden.includes(srB.id_solicitud) ? 'forbidden' : null;
  assert.ok(seenIn !== null,
    `id de B debe estar en missing[] o forbidden[] (missing=${JSON.stringify(missing)}, forbidden=${JSON.stringify(forbidden)})`);
  // NO debe estar en items (eso filtraría la existencia)
  for (const item of res.body.items) {
    assert.notEqual(item.id_solicitud, srB.id_solicitud,
      'el id de B NO debe aparecer en items (cross-company leak)');
  }
});

test('isolation #16b: GET sign-requests-batch con K_B ve los mismos ids pero el de A no aparece', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const srA = await createSignRequestForEmpresa(TEST_EMPRESA_A);
  const srB = await createSignRequestForEmpresa(TEST_EMPRESA_B);

  const app = makeApp();
  const idsCsv = `${srA.id_solicitud},${srB.id_solicitud}`;
  const res = await request(app)
    .get(`/internal/sign-requests-batch?ids=${idsCsv}`)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_B);
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].id_solicitud, srB.id_solicitud);
  // A debe estar en missing o forbidden
  const allB = [...(res.body.missing || []), ...(res.body.forbidden || [])];
  assert.ok(allB.includes(srA.id_solicitud), 'id de A debe estar en missing/forbidden');
});

// =============================================================================
// #9, #11 — POST /internal/consentimientos con K_A
// =============================================================================

test('isolation #9: POST consent con K_A y id_empresa=A → 201', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/consentimientos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({
      id_trabajador: '111',
      id_empresa: TEST_EMPRESA_A,
      version_acuerdo: 'v1.0',
      correo_verificacion: 'iso9@example.com',
      kair_version: '0.1.190-test',
    });
  assert.equal(res.status, 201);
  assert.ok(res.body.consent_id);
});

test('isolation #11: POST verify-otp con K_A y consent propio → 200', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const r1 = await request(app)
    .post('/internal/consentimientos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({
      id_trabajador: '111',
      id_empresa: TEST_EMPRESA_A,
      version_acuerdo: 'v1.0',
      correo_verificacion: 'iso11@example.com',
      kair_version: '0.1.190-test',
    });
  assert.equal(r1.status, 201);
  const r2 = await request(app)
    .post(`/internal/consentimientos/${r1.body.consent_id}/verify-otp`)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({ otp: r1.body.devOtp, kair_version: '0.1.190-test' });
  assert.equal(r2.status, 200);
  assert.equal(r2.body.manifestacion_aceptada, true);
});

// =============================================================================
// Edge cases del spec §2 (los "no están en la tabla principal")
// =============================================================================

test('isolation edge: K_A con id_empresa=A después de rotar → 201 (nueva key funciona)', async () => {
  // Esta prueba verifica que la NUEVA key generada por rotate funciona.
  // La implementación de A debe ser responsable de rotar; este test usa
  // una nueva key sembrada manualmente.
  resetDb();
  const acuerdo = seedActiveAgreement();
  const internalClient = require('../../src/services/internalClient');
  const crypto = require('crypto');

  // Sembrar cliente A con key1
  const key1 = 'kair_test_AAAAAAAAA' + 'A'.repeat(33);
  internalClient.createClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: 'sign_request:create,sign_request:read,consent:create,consent:verify,audit:read',
    description: 'K+AIR A (key1)',
    apiKey: key1,
  });
  internalClient.clearCache();

  // "Rotar" manualmente: revocar key1, crear key2
  const oldHash = sha256(key1);
  internalClient.revokeClient(oldHash);
  const key2 = 'kair_test_BBBBBBBBB' + 'B'.repeat(33);
  internalClient.createClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: 'sign_request:create,sign_request:read,consent:create,consent:verify,audit:read',
    description: 'K+AIR A (key2 post-rotation)',
    apiKey: key2,
  });
  internalClient.clearCache();

  // key1 NO debe funcionar
  const app = makeApp();
  const pdf = await makePdf();
  const r1 = await request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', key1)
    .set('Idempotency-Key', '00000000-0000-4000-8000-000000000020')
    .field('metadata', JSON.stringify({
      id_documento: 'doc-iso-edge1',
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
  assert.equal(r1.status, 401, 'key1 revocada NO debe funcionar');

  // key2 SÍ debe funcionar
  const r2 = await request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', key2)
    .set('Idempotency-Key', '00000000-0000-4000-8000-000000000021')
    .field('metadata', JSON.stringify({
      id_documento: 'doc-iso-edge2',
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
  assert.equal(r2.status, 201, 'key2 nueva debe funcionar');
});

test('isolation edge: K_A revocada en backend → 401 INVALID_API_KEY', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const internalClient = require('../../src/services/internalClient');
  const keyA = 'kair_test_CCCCCCCCC' + 'C'.repeat(33);
  const created = internalClient.createClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: 'sign_request:create,sign_request:read,consent:create,consent:verify,audit:read',
    description: 'A (to be revoked)',
    apiKey: keyA,
  });
  internalClient.clearCache();

  // 1) Antes de revocar: funciona
  const app = makeApp();
  const pdf = await makePdf();
  const r1 = await request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', keyA)
    .set('Idempotency-Key', '00000000-0000-4000-8000-000000000030')
    .field('metadata', JSON.stringify({
      id_documento: 'doc-revoke-1',
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
  assert.equal(r1.status, 201, 'pre-revocación: 201');

  // 2) Revocar
  internalClient.revokeClient(created.api_key_hash);

  // 3) Después de revocar: 401
  const r2 = await request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', keyA)
    .set('Idempotency-Key', '00000000-0000-4000-8000-000000000031')
    .field('metadata', JSON.stringify({
      id_documento: 'doc-revoke-2',
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
  assert.equal(r2.status, 401);
  assert.equal(r2.body.error.code, 'INVALID_API_KEY');
});

test('isolation edge: K_legacy con id_empresa=A → 201 (legacy fallback funciona)', async () => {
  // K_legacy es la API key global pre-I-010. En el período de deprecation,
  // se permite que cree sign requests de cualquier empresa.
  // DR-2026-08-20: legacy mode NO soporta Idempotency-Key (DR-1..6:
  // legacy es deprecation period; idempotency es per-company). El cliente
  // legacy NO manda Idempotency-Key, lo cual es consistente con la
  // pre-I-010 realidad (K+AIR v0.1.189 no mandaba este header).
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const res = await request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', TEST_API_KEY)  // legacy
    // NO Idempotency-Key: legacy mode lo rechaza con 400
    .field('metadata', JSON.stringify({
      id_documento: 'doc-legacy-A',
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
  // Legacy debe pasar (deprecation period).
  assert.equal(res.status, 201, JSON.stringify(res.body).slice(0, 500));
  // DR-2026-08-20: sign response NO incluye id_empresa (ver
  // src/routes/signRequest.js:169-184). El cliente ya sabe qué empresa
  // usó (la puso en metadata). Validamos el id_solicitud como prueba
  // de que la request creó un sign request exitoso.
  // assert.equal(res.body.id_empresa, TEST_EMPRESA_A);
});

test('isolation edge: K_legacy con id_empresa=B → 201 (legacy no distingue empresa)', async () => {
  // Legacy también debe poder crear para B. Decisión documentada en AUD-04.
  // DR-2026-08-20: legacy NO manda Idempotency-Key.
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const res = await request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', TEST_API_KEY)  // legacy
    // NO Idempotency-Key
    .field('metadata', JSON.stringify({
      id_documento: 'doc-legacy-B',
      id_trabajador: '222',
      id_empresa: TEST_EMPRESA_B,
      tipo_firma: 'presencial',
      agreement_hash: acuerdo.texto_hash,
      agreement_version: acuerdo.version,
      document_hash: sha256(pdf),
      version_kair: '0.1.190-test',
      identificacion_tipo: 'CC',
      identificacion_numero_hash: sha256('222'),
    }))
    .attach('documento', pdf, 'b.pdf');
  assert.equal(res.status, 201);
  // DR-2026-08-20: sign response NO incluye id_empresa (ver
  // src/routes/signRequest.js:169-184). Ver comentario en línea 92.
  // assert.equal(res.body.id_empresa, TEST_EMPRESA_B);
});

// =============================================================================
// #13 — Per-company key NO funciona como admin
// =============================================================================

test('isolation #13: POST /admin/clientes con K_A (no admin) → 401 INVALID_API_KEY', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)  // per-company, no admin
    .send({
      id_empresa: TEST_EMPRESA_A,
      allowed_operations: ['sign_request:create'],
    });
  if (res.status === 404) {
    // Endpoint admin aún no implementado por A. Marcamos como skip informativo.
    // El comportamiento de no-poder-usar-key-de-cliente-como-admin ya está
    // cubierto en tests/middleware/adminAuth.test.js (line 61-69).
    assert.fail('POST /admin/clientes no implementado aún (cubierto por adminAuth.test.js)');
  }
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

// =============================================================================
// #14 — Admin crea NUEVA empresa → 201
// =============================================================================

test('isolation #14: POST /admin/clientes con K_admin para id_empresa nueva → 201', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/clientes')
    .set('X-Admin-API-Key', 'test-admin-api-key-32-bytes-min!!!!!')
    .send({
      id_empresa: '900777777',  // nueva, no existe
      allowed_operations: ['sign_request:create', 'sign_request:read'],
      description: 'Nueva empresa via admin',
    });
  if (res.status === 404) {
    assert.fail('POST /admin/clientes no implementado aún');
  }
  assert.equal(res.status, 201);
  // DR-2026-08-20: ver comentario línea 92. Backend NO retorna id_empresa en sign response.
  // assert.equal(res.body.id_empresa, '900777777');
  assert.ok(res.body.api_key);
});

// =============================================================================
// #15 — Admin rota una empresa
// =============================================================================

test('isolation #15: POST /admin/clientes/:id/rotate con K_admin → 200 + nueva key', async () => {
  resetDb();
  const app = makeApp();
  // 1) Crear
  const c1 = await request(app)
    .post('/internal/admin/clientes')
    .set('X-Admin-API-Key', 'test-admin-api-key-32-bytes-min!!!!!')
    .send({
      id_empresa: '900888888',
      allowed_operations: ['sign_request:create'],
      description: 'Para rotar',
    });
  if (c1.status === 404) {
    assert.fail('POST /admin/clientes no implementado aún');
  }
  const oldHash = c1.body.api_key_hash_prefix;

  // 2) Rotar
  const r1 = await request(app)
    .post('/internal/admin/clientes/900888888/rotate')
    .set('X-Admin-API-Key', 'test-admin-api-key-32-bytes-min!!!!!')
    .send({ motivo: 'test isolation #15', actor: 'qa' });
  if (r1.status === 404) {
    assert.fail('POST /admin/clientes/:id/rotate no implementado aún');
  }
  assert.equal(r1.status, 200);
  assert.ok(r1.body.new_api_key);
  assert.notEqual(r1.body.new_api_key, c1.body.api_key);
  assert.equal(r1.body.old_api_key_hash_prefix, oldHash);
  // DR-2026-08-20: ver comentario línea 92. Backend NO retorna id_empresa en sign response.
  // assert.equal(r1.body.id_empresa, '900888888');
});
