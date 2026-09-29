/**
 * Tests del endpoint POST /internal/sign-requests/:id/notify-remote
 * (I-103.A1.5.1: enviar invitación al firmante).
 *
 * Cubre la capa HTTP completa: auth, validación zod, cross-company,
 * estado terminal, sign request legacy, error de mailer. La lógica
 * de negocio pura (recuperación de token, redacción de correo, evento)
 * se prueba en tests/services/signRequest-notify-remote.test.js.
 *
 * Casos cubiertos:
 *  - 200 OK: sign request válido + correo válido → envía + devuelve messageId
 *  - 200 OK: en dev, el correo se guarda en _devInbox con tipo='invite'
 *  - 200 OK: cross-company (B con key de A) NO debe filtrar — pero acá
 *            testeamos con key legacy que tiene id_empresa=null, así que
 *            se permite el acceso (deprecation). El test cross-company
 *            estricto se hace con seedTestClients() más abajo.
 *  - 400 INVALID_REQUEST_BODY: body sin `correo`
 *  - 400 INVALID_REQUEST_BODY: `correo` no es email
 *  - 400 INVALID_REQUEST_BODY: id no es SIGN-YYYY-NNNNNN ni entero positivo
 *  - 404 NOT_FOUND: sign request no existe
 *  - 404 NOT_FOUND: cross-company silent (A pide id de B con key de A)
 *  - 410 INVITE_NOT_AVAILABLE: sign request en estado SIGNED
 *  - 410 INVITE_NOT_AVAILABLE: sign request en estado REJECTED
 *  - 410 INVITE_NOT_AVAILABLE: sign request en estado EXPIRED
 *  - 410 INVITE_NOT_AVAILABLE: sign request legacy sin metadata (pre-I-013b)
 *  - 401 INVALID_API_KEY: API key incorrecta
 *  - 502 INVITE_EMAIL_FAILED: mailer lanza (SMTP caído)
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
  TEST_API_KEY, TEST_API_KEY_CLIENT_A, TEST_API_KEY_CLIENT_B,
  TEST_EMPRESA_A, TEST_EMPRESA_B,
  createSignRequestWithIdentificacion,
} = require('../helpers');
const signRequestService = require('../../src/services/signRequest');
const mailer = require('../../src/services/mailer');
const db = require('../../src/db/connection');

const HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };

async function makePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([300, 200]);
  return Buffer.from(await doc.save());
}

/**
 * Helper: crea un sign request via service (bypass HTTP), retorna el wrapper
 * {signRequest, token, url_publica} que retorna el service.
 *
 * createSignRequestWithIdentificacion() ya llama seedActiveAgreement() si no
 * hay Acuerdo activo, así que NO lo llamamos acá (idempotencia: 2do
 * seedActiveAgreement lanza ACUERDO_VERSION_EXISTS).
 */
async function createSr(id_empresa = '900123456') {
  const result = await createSignRequestWithIdentificacion({ id_empresa });
  return result;
}

/**
 * Helper: forzar el estado de un sign request (para tests de estado terminal).
 */
function forceState(id_interno, estado) {
  db.prepare('UPDATE gh_firmas_electronicas SET estado = ? WHERE id = ?')
    .run(estado, id_interno);
}

// =====================================================================
// 200 OK
// =====================================================================

test('POST /notify-remote: happy path → 200 + messageId + sent_at', async () => {
  resetDb();
  const { signRequest } = await createSr();
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/notify-remote`)
    .set(HEADERS)
    .send({ correo: 'juan.perez@example.com' });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.id_solicitud, signRequest.id_solicitud);
  assert.ok(res.body.messageId);
  assert.ok(res.body.sent_at);

  // El correo debe estar en _devInbox con tipo='invite'
  const inbox = mailer.getDevInbox();
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].tipo, 'invite');
  assert.equal(inbox[0].to, 'juan.perez@example.com');
  assert.equal(inbox[0].id_solicitud, signRequest.id_solicitud);
  assert.ok(inbox[0].url_publica.includes('/s/'));

  // El evento INVITE_SENT debe estar persistido
  const evt = db.prepare(`
    SELECT evento, metadata FROM gh_firma_eventos
    WHERE firma_id = ? AND evento = 'INVITE_SENT'
  `).get(signRequest.id);
  assert.ok(evt, 'Debe existir evento INVITE_SENT');
  const meta = JSON.parse(evt.metadata);
  // El correo se enmascara en la metadata persistida
  // 'juan.perez' = 10 chars; 2 visibles, 8 stars
  assert.equal(meta.correo_destino_enmascarado, 'ju********@example.com');
});

test('POST /notify-remote: por id interno (entero) también funciona', async () => {
  resetDb();
  const { signRequest } = await createSr();
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id}/notify-remote`)
    .set(HEADERS)
    .send({ correo: 'user@example.com' });

  assert.equal(res.status, 200);
  assert.equal(res.body.id_solicitud, signRequest.id_solicitud);
});

test('POST /notify-remote: con context opcional → 200 + context en evento', async () => {
  resetDb();
  const { signRequest } = await createSr();
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/notify-remote`)
    .set(HEADERS)
    .send({
      correo: 'user@example.com',
      context: { via: 'kair-documentos-ui', button: 'enviar-correo' },
    });

  assert.equal(res.status, 200);

  const evt = db.prepare(`
    SELECT metadata FROM gh_firma_eventos
    WHERE firma_id = ? AND evento = 'INVITE_SENT'
  `).get(signRequest.id);
  const meta = JSON.parse(evt.metadata);
  assert.deepEqual(meta.context, {
    via: 'kair-documentos-ui',
    button: 'enviar-correo',
  });
});

// =====================================================================
// 400 INVALID_REQUEST_BODY
// =====================================================================

test('POST /notify-remote: body sin correo → 400 INVALID_REQUEST_BODY', async () => {
  resetDb();
  const { signRequest } = await createSr();
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/notify-remote`)
    .set(HEADERS)
    .send({});

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
  assert.ok(res.body.error.details.issues);
  // No se debe haber enviado correo
  assert.equal(mailer.getDevInbox().length, 0);
});

test('POST /notify-remote: correo no es email → 400 INVALID_REQUEST_BODY', async () => {
  resetDb();
  const { signRequest } = await createSr();
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/notify-remote`)
    .set(HEADERS)
    .send({ correo: 'not-an-email' });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /notify-remote: id con formato inválido → 400 INVALID_REQUEST_BODY', async () => {
  resetDb();
  const app = makeApp();

  const res = await request(app)
    .post('/internal/sign-requests/abc-not-an-id/notify-remote')
    .set(HEADERS)
    .send({ correo: 'user@example.com' });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /notify-remote: id vacío (404 del router) → 404', async () => {
  resetDb();
  const app = makeApp();

  const res = await request(app)
    .post('/internal/sign-requests//notify-remote')
    .set(HEADERS)
    .send({ correo: 'user@example.com' });

  // Express devuelve 404 cuando la ruta no matchea (path con doble / colapsa)
  assert.equal(res.status, 404);
});

// =====================================================================
// 404 NOT_FOUND
// =====================================================================

test('POST /notify-remote: sign request no existe → 404', async () => {
  resetDb();
  const app = makeApp();

  const res = await request(app)
    .post('/internal/sign-requests/SIGN-2099-999999/notify-remote')
    .set(HEADERS)
    .send({ correo: 'user@example.com' });

  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
  assert.equal(mailer.getDevInbox().length, 0);
});

// =====================================================================
// 410 INVITE_NOT_AVAILABLE
// =====================================================================

test('POST /notify-remote: estado SIGNED → 410 INVITE_NOT_AVAILABLE', async () => {
  resetDb();
  const { signRequest } = await createSr();
  forceState(signRequest.id, 'SIGNED');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/notify-remote`)
    .set(HEADERS)
    .send({ correo: 'user@example.com' });

  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'INVITE_NOT_AVAILABLE');
  assert.equal(res.body.error.details.reason, 'terminal_state');
  assert.equal(res.body.error.details.current_state, 'SIGNED');
  assert.equal(mailer.getDevInbox().length, 0);
});

test('POST /notify-remote: estado REJECTED → 410 INVITE_NOT_AVAILABLE', async () => {
  resetDb();
  const { signRequest } = await createSr();
  forceState(signRequest.id, 'REJECTED');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/notify-remote`)
    .set(HEADERS)
    .send({ correo: 'user@example.com' });

  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'INVITE_NOT_AVAILABLE');
});

test('POST /notify-remote: estado EXPIRED → 410 INVITE_NOT_AVAILABLE', async () => {
  resetDb();
  const { signRequest } = await createSr();
  forceState(signRequest.id, 'EXPIRED');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/notify-remote`)
    .set(HEADERS)
    .send({ correo: 'user@example.com' });

  assert.equal(res.status, 410);
  assert.equal(res.body.error.details.current_state, 'EXPIRED');
});

test('POST /notify-remote: sign request legacy (sin metadata cifrado) → 410', async () => {
  resetDb();
  const { signRequest } = await createSr();
  // Vaciar metadata directamente en BD para simular legacy pre-I-013b
  db.prepare('UPDATE gh_firmas_electronicas SET metadata = NULL WHERE id = ?')
    .run(signRequest.id);
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/notify-remote`)
    .set(HEADERS)
    .send({ correo: 'user@example.com' });

  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'INVITE_NOT_AVAILABLE');
  assert.equal(res.body.error.details.reason, 'legacy_no_token_recovery');
});

test('POST /notify-remote: estado intermedio (OPENED, OTP_SENT) → 200 OK', async () => {
  resetDb();
  const { signRequest } = await createSr();
  forceState(signRequest.id, 'OPENED');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/notify-remote`)
    .set(HEADERS)
    .send({ correo: 'user@example.com' });

  // OPENED no es terminal → se permite re-enviar invitación
  assert.equal(res.status, 200);
  assert.equal(mailer.getDevInbox().length, 1);
});

// =====================================================================
// 401 INVALID_API_KEY
// =====================================================================

test('POST /notify-remote: API key incorrecta → 401', async () => {
  resetDb();
  const { signRequest } = await createSr();
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/notify-remote`)
    .set('X-Internal-API-Key', 'wrong-key')
    .send({ correo: 'user@example.com' });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
  assert.equal(mailer.getDevInbox().length, 0);
});

// =====================================================================
// 502 INVITE_EMAIL_FAILED
// =====================================================================

test('POST /notify-remote: mailer lanza → 502 INVITE_EMAIL_FAILED', async () => {
  resetDb();
  const { signRequest } = await createSr();
  const app = makeApp();

  // Monkey-patch mailer.sendInvite
  const origSend = mailer.sendInvite;
  mailer.sendInvite = async function () {
    const e = new Error('connect ECONNREFUSED 127.0.0.1:587');
    e.code = 'ECONNREFUSED';
    throw e;
  };

  try {
    const res = await request(app)
      .post(`/internal/sign-requests/${signRequest.id_solicitud}/notify-remote`)
      .set(HEADERS)
      .send({ correo: 'user@example.com' });

    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'INVITE_EMAIL_FAILED');
    assert.equal(res.body.error.details.reason, 'smtp_failure');
  } finally {
    mailer.sendInvite = origSend;
  }
});

// =====================================================================
// Cross-company (I-010, D-13): client mode silent 404
// =====================================================================

test('I-010 cross-company: A pide id de B con key de A → 404 silent (NO 403)', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();

  // Crear sign request para EMPRESA B
  const { signRequest: srB } = await createSr(TEST_EMPRESA_B);
  const app = makeApp();

  // Cliente A intenta notificar sign request de B
  const res = await request(app)
    .post(`/internal/sign-requests/${srB.id_solicitud}/notify-remote`)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({ correo: 'user@example.com' });

  // Cross-company → 404 silent (no revelar existencia)
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
  // NO se debe haber enviado correo
  assert.equal(mailer.getDevInbox().length, 0);
});

test('I-010: cliente A notifica SU PROPIO sign request → 200', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();

  const { signRequest: srA } = await createSr(TEST_EMPRESA_A);
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${srA.id_solicitud}/notify-remote`)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({ correo: 'user-a@example.com' });

  assert.equal(res.status, 200);
  assert.equal(mailer.getDevInbox().length, 1);
  assert.equal(mailer.getDevInbox()[0].to, 'user-a@example.com');
});

test('I-010: cliente B notifica SU PROPIO sign request → 200', async () => {
  resetDb();
  seedActiveAgreement();
  seedTestClients();

  const { signRequest: srB } = await createSr(TEST_EMPRESA_B);
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${srB.id_solicitud}/notify-remote`)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_B)
    .send({ correo: 'user-b@example.com' });

  assert.equal(res.status, 200);
  assert.equal(mailer.getDevInbox().length, 1);
});
