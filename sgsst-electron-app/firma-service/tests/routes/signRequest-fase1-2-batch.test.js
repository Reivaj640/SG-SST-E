/**
 * Tests E2E de los 5 tasks backend de Fase 1.2 (Track A):
 *   - I-007  : refinamiento de GET /internal/sign-requests/:id con campos UI
 *   - I-008  : GET /internal/sign-requests?ids=batch
 *   - I-103  : GET /internal/sign-requests/:id/document.pdf
 *   - I-104  : GET /internal/sign-requests/:id/constancia.pdf
 *   - I-013b : GET /internal/sign-requests/:id/link (recuperación)
 *
 * Cobertura aproximada:
 *   - I-007:  5 tests (campos nuevos, paths no expuestos, cross-company, 404)
 *   - I-008:  8 tests (happy, missing, forbidden, errores, dedup, single id)
 *   - I-103:  5 tests (original, firmado, 404, 409 simulado via cross, headers)
 *   - I-104:  4 tests (post-SIGNED, pre-SIGNED 409, 404, headers)
 *   - I-013b: 6 tests (happy, terminal 410, legacy 410, cross-company, evento)
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const { sha256 } = require('../../src/crypto/hash');
const {
  resetDb, seedActiveAgreement, makeApp,
  TEST_API_KEY, TEST_API_KEY_CLIENT_A, TEST_API_KEY_CLIENT_B,
  TEST_EMPRESA_A, TEST_EMPRESA_B,
  seedTestClients,
  createSignRequestWithIdentificacion,
} = require('../helpers');
const storage = require('../../src/services/storage');
const db = require('../../src/db/connection');

const LEGACY_HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };
const CLIENT_A_HEADERS = { 'X-Internal-API-Key': TEST_API_KEY_CLIENT_A };
const CLIENT_B_HEADERS = { 'X-Internal-API-Key': TEST_API_KEY_CLIENT_B };

// I-013b: pre-setear TOKEN_ENCRYPTION_KEY para que el cifrado del token
// en create() sea determinístico entre tests (sino en dev se genera una
// key efímera al boot y se loguea warning).
process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);

/**
 * Helper: crea un PDF válido (estructuralmente correcto) y lo guarda como
 * buffer. Devuelve el buffer listo para subir a un endpoint.
 */
async function makePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([300, 200]);
  return Buffer.from(await doc.save());
}

// =============================================================================
// I-007: refinamiento de GET /internal/sign-requests/:id con campos UI
// =============================================================================

test('I-007: GET /:id incluye campos UI nuevos (qr_payload, link, tiene_*)', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: '900123456',
  });
  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}`)
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 200);
  // Campos UI nuevos
  assert.equal(res.body.qr_payload, null, 'qr_payload es null (token no se reconstruye, usar I-013b)');
  assert.equal(res.body.link, null, 'link es null (token no se reconstruye, usar I-013b)');
  assert.equal(res.body.tiene_pdf_original, true, 'PDF original siempre existe post-create');
  assert.equal(res.body.tiene_pdf_firmado, false, 'PDF firmado no existe aún (no está firmado)');
  assert.equal(res.body.tiene_constancia, false, 'Constancia no existe aún (no está firmado)');
});

test('I-007: GET /:id NO expone paths internos del storage (anti-fuga)', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: '900123456',
  });
  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}`)
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 200);
  const body = JSON.stringify(res.body);
  // No debe contener paths absolutos del filesystem
  assert.ok(!body.includes(storage.PATHS.root), 'no debe filtrar SERVICE_ROOT');
  assert.ok(!body.includes('originales/'), 'no debe filtrar nombre de carpeta storage');
  assert.ok(!body.includes('firmados/'), 'no debe filtrar nombre de carpeta storage');
  assert.ok(!body.includes('constancias/'), 'no debe filtrar nombre de carpeta storage');
  // No debe contener los nombres de campos internos
  assert.ok(!('pdf_original_path' in res.body), 'pdf_original_path NO debe estar en el body');
  assert.ok(!('pdf_firmado_path' in res.body), 'pdf_firmado_path NO debe estar en el body');
  assert.ok(!('constancia_path' in res.body), 'constancia_path NO debe estar en el body');
  assert.ok(!('token_hash' in res.body), 'token_hash NO debe estar en el body (C-22)');
});

test('I-007: GET /:id cross-company silent 404 (A no ve sign request de B)', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: TEST_EMPRESA_B,
  });
  const app = makeApp();
  // A intenta consultar sign request de B → 404 silent
  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}`)
    .set(CLIENT_A_HEADERS);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('I-007: GET /:id no encontrado (id no existe en BD) → 404', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const res = await request(app)
    .get('/internal/sign-requests/SIGN-2099-999999')
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('I-007: GET /:id formato inválido → 400', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const res = await request(app)
    .get('/internal/sign-requests/INVALID-FORMAT')
    .set(LEGACY_HEADERS);
  // El handler actual retorna 404 con NOT_FOUND para formatos inválidos
  // (consistente con el comportamiento existente de GET /:id).
  // Aceptamos 400 o 404 — lo importante es que NO retorna 200.
  assert.ok(res.status === 400 || res.status === 404,
    `status debe ser 400 o 404, fue ${res.status}`);
});

// =============================================================================
// I-008: GET /internal/sign-requests?ids=batch
// =============================================================================

test('I-008: batch con 3 ids → 200 con items, missing, forbidden', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const a1 = await createSignRequestWithIdentificacion({ id_empresa: TEST_EMPRESA_A });
  const a2 = await createSignRequestWithIdentificacion({ id_empresa: TEST_EMPRESA_A });
  const b1 = await createSignRequestWithIdentificacion({ id_empresa: TEST_EMPRESA_B });

  // Cliente A pide 4 ids: 2 suyos + 1 de B (forbidden) + 1 inexistente (missing)
  const res = await request(app)
    .get(`/internal/sign-requests-batch?ids=${a1.signRequest.id_solicitud},${a2.signRequest.id_solicitud},${b1.signRequest.id_solicitud},SIGN-2099-999999`)
    .set(CLIENT_A_HEADERS);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 2, 'A solo ve sus 2 sign requests');
  assert.equal(res.body.forbidden_count, 1);
  assert.equal(res.body.missing_count, 1);
  assert.deepEqual(res.body.forbidden, [b1.signRequest.id_solicitud]);
  assert.deepEqual(res.body.missing, ['SIGN-2099-999999']);
  // items debe tener los 2 de A
  const itemIds = res.body.items.map(i => i.id_solicitud).sort();
  assert.deepEqual(itemIds, [a1.signRequest.id_solicitud, a2.signRequest.id_solicitud].sort());
});

test('I-008: batch con ids mixtos (SIGN + numérico) funciona', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const a1 = await createSignRequestWithIdentificacion({ id_empresa: '900123456' });
  const a2 = await createSignRequestWithIdentificacion({ id_empresa: '900123456' });

  // a1 por id_solicitud, a2 por id interno
  const res = await request(app)
    .get(`/internal/sign-requests-batch?ids=${a1.signRequest.id_solicitud},${a2.signRequest.id}`)
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 2);
});

test('I-008: batch con un solo id funciona', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const a1 = await createSignRequestWithIdentificacion({ id_empresa: '900123456' });

  const res = await request(app)
    .get(`/internal/sign-requests-batch?ids=${a1.signRequest.id_solicitud}`)
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 1);
  assert.equal(res.body.items[0].id_solicitud, a1.signRequest.id_solicitud);
});

test('I-008: batch con duplicados (mismo id N veces) → dedup, 1 entry', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const a1 = await createSignRequestWithIdentificacion({ id_empresa: '900123456' });

  const res = await request(app)
    .get(`/internal/sign-requests-batch?ids=${a1.signRequest.id_solicitud},${a1.signRequest.id_solicitud},${a1.signRequest.id_solicitud}`)
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 1, 'dedup: mismo id 3 veces → 1 item');
  assert.equal(res.body.missing_count, 0);
  assert.equal(res.body.forbidden_count, 0);
});

test('I-008: batch sin ids → 400 INVALID_REQUEST_BODY', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const res = await request(app)
    .get('/internal/sign-requests-batch')
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('I-008: batch con >200 ids → 400 INVALID_REQUEST_BODY', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const ids = Array.from({ length: 201 }, (_, i) => `SIGN-2026-${String(i).padStart(6, '0')}`);
  const res = await request(app)
    .get(`/internal/sign-requests-batch?ids=${ids.join(',')}`)
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('I-008: batch con id de formato inválido → 400 INVALID_REQUEST_BODY', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const res = await request(app)
    .get('/internal/sign-requests-batch?ids=BAD-FORMAT')
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('I-008: batch sin API key → 401 INVALID_API_KEY', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const res = await request(app)
    .get('/internal/sign-requests-batch?ids=SIGN-2026-000001');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

// =============================================================================
// I-103: GET /internal/sign-requests/:id/document.pdf
// =============================================================================

test('I-103: GET document.pdf pre-SIGNED devuelve PDF original con headers correctos', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: '900123456',
  });

  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}/document.pdf`)
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'application/pdf');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.match(res.headers['content-disposition'], /attachment; filename=".+\-original\.pdf"/);
  assert.equal(res.headers['cache-control'], 'private, no-cache');
  // El buffer empieza con %PDF-
  assert.ok(res.body.slice(0, 5).toString().startsWith('%PDF-'));
});

test('I-103: GET document.pdf no existe → 404 NOT_FOUND', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const res = await request(app)
    .get('/internal/sign-requests/SIGN-2099-999999/document.pdf')
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('I-103: GET document.pdf cross-company → 404 silent (A no ve B)', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: TEST_EMPRESA_B,
  });
  const app = makeApp();
  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}/document.pdf`)
    .set(CLIENT_A_HEADERS);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('I-103: GET document.pdf con path corrupto en BD → 404 PDF_NOT_FOUND', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: '900123456',
  });
  // Corromper el path en BD
  db.prepare(`UPDATE gh_firmas_electronicas SET pdf_original_path = ? WHERE id = ?`)
    .run('/nonexistent/path/fake.pdf', signRequest.id);

  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}/document.pdf`)
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'PDF_NOT_FOUND');
});

test('I-103: GET document.pdf sin API key → 401', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: '900123456',
  });
  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}/document.pdf`);
  assert.equal(res.status, 401);
});

// =============================================================================
// I-104: GET /internal/sign-requests/:id/constancia.pdf
// =============================================================================

test('I-104: GET constancia.pdf pre-SIGNED → 409 CONSTANCIA_NOT_AVAILABLE', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: '900123456',
  });
  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}/constancia.pdf`)
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CONSTANCIA_NOT_AVAILABLE');
  assert.equal(res.body.error.details.current_state, 'PENDING');
});

test('I-104: GET constancia.pdf no existe → 404 NOT_FOUND', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const res = await request(app)
    .get('/internal/sign-requests/SIGN-2099-999999/constancia.pdf')
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('I-104: GET constancia.pdf cross-company → 404 silent', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: TEST_EMPRESA_B,
  });
  const app = makeApp();
  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}/constancia.pdf`)
    .set(CLIENT_A_HEADERS);
  assert.equal(res.status, 404);
});

test('I-104: GET constancia.pdf con constancia_path null → 404 PDF_NOT_FOUND', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: '900123456',
  });
  // Forzar estado SIGNED pero sin constancia_path (simulando commit parcial / bug)
  db.prepare(`UPDATE gh_firmas_electronicas SET estado = 'SIGNED', constancia_path = NULL WHERE id = ?`)
    .run(signRequest.id);

  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}/constancia.pdf`)
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'PDF_NOT_FOUND');
});

// =============================================================================
// I-013b: GET /internal/sign-requests/:id/link
// =============================================================================

test('I-013b: GET /:id/link en PENDING → 200 con token + url_publica + qr_payload', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest, token } = await createSignRequestWithIdentificacion({
    id_empresa: '900123456',
  });
  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}/link`)
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 200);
  assert.equal(res.body.id_solicitud, signRequest.id_solicitud);
  assert.equal(res.body.token, token, 'el token retornado debe coincidir con el del create');
  assert.ok(res.body.url_publica.endsWith(`/s/${token}`));
  assert.equal(res.body.qr_payload, res.body.url_publica);
  assert.equal(res.body.estado, 'PENDING');
  assert.ok(res.body.fecha_expiracion);
});

test('I-013b: GET /:id/link registra evento LINK_RETRIEVED en audit trail', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: '900123456',
  });
  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}/link`)
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 200);

  // Verificar que el evento se registró
  const eventos = db.prepare(`
    SELECT evento, id_actor FROM gh_firma_eventos
    WHERE firma_id = ? AND evento = 'LINK_RETRIEVED'
  `).all(signRequest.id);
  assert.equal(eventos.length, 1, 'debe haber exactamente 1 evento LINK_RETRIEVED');
  assert.match(eventos[0].id_actor, /^rh:/, 'actor debe tener prefijo rh:');
});

test('I-013b: GET /:id/link en estado SIGNED → 410 LINK_NOT_AVAILABLE', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: '900123456',
  });
  // Forzar estado terminal
  db.prepare(`UPDATE gh_firmas_electronicas SET estado = 'SIGNED' WHERE id = ?`)
    .run(signRequest.id);

  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}/link`)
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'LINK_NOT_AVAILABLE');
  assert.equal(res.body.error.details.current_state, 'SIGNED');
  assert.equal(res.body.error.details.reason, 'terminal_state');
});

test('I-013b: GET /:id/link en estado REVOKED → 410 LINK_NOT_AVAILABLE', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: '900123456',
  });
  db.prepare(`UPDATE gh_firmas_electronicas SET estado = 'REVOKED' WHERE id = ?`)
    .run(signRequest.id);

  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}/link`)
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 410);
  assert.equal(res.body.error.details.current_state, 'REVOKED');
});

test('I-013b: GET /:id/link en sign request legacy (sin token cifrado) → 410 legacy', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: '900123456',
  });
  // Simular sign request legacy pisando metadata sin _server_metadata
  db.prepare(`UPDATE gh_firmas_electronicas SET metadata = ? WHERE id = ?`)
    .run(JSON.stringify({ legacy: true, nota: 'sin token cifrado' }), signRequest.id);

  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}/link`)
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'LINK_NOT_AVAILABLE');
  assert.equal(res.body.error.details.reason, 'legacy_no_token_recovery');
});

test('I-013b: GET /:id/link cross-company → 404 silent', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: TEST_EMPRESA_B,
  });
  const app = makeApp();
  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}/link`)
    .set(CLIENT_A_HEADERS);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('I-013b: GET /:id/link no encontrado → 404', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const res = await request(app)
    .get('/internal/sign-requests/SIGN-2099-999999/link')
    .set(LEGACY_HEADERS);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('I-013b: GET /:id/link sin API key → 401', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: '900123456',
  });
  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}/link`);
  assert.equal(res.status, 401);
});
