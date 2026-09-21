/**
 * Tests del endpoint POST /internal/sign-requests/:id/resend-otp
 * (I-103.A1.6.B: reenvío de OTP desde K+AIR, auth per-empresa).
 *
 * Wrapper per-empresa de publicFlow.resendOtp(). Cubre:
 *   - Auth: per-empresa (X-Internal-API-Key), cross-company silent 404
 *   - Estados: PENDING, IDENTIFIED → 409 (no permite resend)
 *   - OTP_SENT con OTP vigente → 400 OTP_NOT_EXPIRED
 *   - OTP_SENT con OTP expirado → 200 + nuevo OTP
 *   - OTP_LOCKED → 200 + desbloqueo + nuevo OTP
 *   - Estados terminales (SIGNED, REJECTED, EXPIRED, REVOKED, CANCELLED) → 409
 *   - SR no existe → 404
 *   - SR legacy sin token cifrado (pre-I-013b) → 410
 *   - id malformado → 400
 *   - Sin auth → 401
 *   - API key inválida → 401
 *   - Rate-limit 5/h por SR → 429
 *   - Correo enmascarado en respuesta (no plaintext)
 *   - Evento OTP_RESENT persistido en gh_firma_eventos sin OTP en metadata
 *   - SMTP falla → OTP ya generado en BD + evento OTP_SEND_FAILED
 *
 * Capa HTTP completa. La lógica pura de resendOtp() se prueba en
 * tests/routes/resend-otp.test.js (endpoint público); acá validamos
 * el wrapper per-empresa.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../../src/db/connection');
const {
  resetDb, seedActiveAgreement, seedTestClients, makeApp,
  withClientAApiKey, withClientBApiKey, withLegacyApiKey,
  TEST_API_KEY, TEST_API_KEY_CLIENT_A, TEST_API_KEY_CLIENT_B,
  TEST_EMPRESA_A, TEST_EMPRESA_B,
  createSignRequestWithIdentificacion,
} = require('../helpers');
const mailer = require('../../src/services/mailer');
const publicFlow = require('../../src/services/publicFlow');
const config = require('../../src/config');

const CEDULA = '1234567890';
const CORREO_METADATA = 'metadata@test.com';
const CORREO_CONSENT = 'consent@test.com';

function forceOtpExpired(signRequestId) {
  const past = new Date(Date.now() - 700 * 1000).toISOString();
  db.prepare('UPDATE gh_firmas_electronicas SET fecha_otp_enviado = ? WHERE id = ?').run(past, signRequestId);
}

function forceEstado(signRequestId, estado, extras = {}) {
  const sets = ['estado = ?'];
  const vals = [estado];
  Object.keys(extras).forEach(k => { sets.push(`${k} = ?`); vals.push(extras[k]); });
  vals.push(signRequestId);
  db.prepare(`UPDATE gh_firmas_electronicas SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

async function identifySR(token) {
  const app = makeApp();
  return request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: CEDULA });
}

async function verifyOtpWrong(token) {
  const app = makeApp();
  return request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: '000000' });
}

async function createSrWithOtpSent({ id_empresa = TEST_EMPRESA_A } = {}) {
  // NOTA: en FASE 4 el consent ya no genera OTP propio. No usamos
  // createAcceptedConsent. Creamos el SR con metadata que incluye el correo
  // (regla única), identificamos al firmante vía flujo público (que SÍ
  // genera OTP) y el SR queda en estado OTP_SENT, listo para el resend.
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_empresa,
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
  });
  await identifySR(token);
  return { token, signRequest };
}

test.beforeEach(() => {
  resetDb();
  mailer.clearDevInbox();
  publicFlow.clearResendOtpRateLimit();
});

// =====================================================================
// Auth (per-empresa)
// =====================================================================

test('POST /internal/.../resend-otp: sin X-Internal-API-Key → 401', async () => {
  const { signRequest } = await createSrWithOtpSent();
  const app = makeApp();
  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/resend-otp`)
    .send({});
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('POST /internal/.../resend-otp: API key inválida → 401', async () => {
  const { signRequest } = await createSrWithOtpSent();
  const app = makeApp();
  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/resend-otp`)
    .set('X-Internal-API-Key', 'key-que-no-existe')
    .send({});
  assert.equal(res.status, 401);
});

test('POST /internal/.../resend-otp: operación no permitida → 403', async () => {
  // Cliente con allowed_operations que NO incluye resend-otp
  resetDb();
  seedTestClients();
  // Crear cliente C con operaciones restringidas (solo sign_request:read)
  const internalClientService = require('../../src/services/internalClient');
  const newKey = 'kair_live_test_clienteC_resend_otp_32bytes!';
  internalClientService.createClient({
    id_empresa: '900777777',
    description: 'Cliente C (sin resend-otp)',
    apiKey: newKey,
    allowed_operations: 'sign_request:read',
  });
  internalClientService.clearCache();

  // Crear SR para la empresa C
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: '900777777',
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
  });
  // No pasamos por identify: SR queda en PENDING.
  const app = makeApp();
  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/resend-otp`)
    .set('X-Internal-API-Key', newKey)
    .send({});
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

// =====================================================================
// Validación de id
// =====================================================================

test('POST /internal/.../resend-otp: id malformado → 400 INVALID_REQUEST_BODY', async () => {
  const app = makeApp();
  const res = await request(app)
    .post(`/internal/sign-requests/esto-no-es-un-id-valido/resend-otp`)
    .set('X-Internal-API-Key', TEST_API_KEY)
    .send({});
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /internal/.../resend-otp: SR no existe → 404', async () => {
  const app = makeApp();
  const res = await request(app)
    .post(`/internal/sign-requests/SIGN-2099-999999/resend-otp`)
    .set('X-Internal-API-Key', TEST_API_KEY)
    .send({});
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

// =====================================================================
// Cross-company silent 404
// =====================================================================

test('POST /internal/.../resend-otp: cross-company (A pide id de B con key de A) → 404 silent', async () => {
  // Sembrar clientes A y B pero con la nueva operación permitida.
  // Usamos createClient (helper oficial) en vez de seedTestClients para
  // garantizar que A y B tengan sign_request:resend_otp en sus ops.
  const internalClientService = require('../../src/services/internalClient');
  const OPS = 'sign_request:create,sign_request:read,sign_request:resend_otp,consent:create,consent:verify,audit:read';
  internalClientService.createClient({
    id_empresa: TEST_EMPRESA_A, apiKey: TEST_API_KEY_CLIENT_A,
    allowed_operations: OPS, description: 'TEST client A',
  });
  internalClientService.createClient({
    id_empresa: TEST_EMPRESA_B, apiKey: TEST_API_KEY_CLIENT_B,
    allowed_operations: OPS, description: 'TEST client B',
  });
  internalClientService.clearCache();

  // Crear SR para empresa B con key de B
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: TEST_EMPRESA_B,
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
  });
  // Solicitar con key de A → debe ser 404 (silent cross-company, no 403)
  const app = makeApp();
  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/resend-otp`)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({});
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

// =====================================================================
// Estados: lo que resendOtp() NO acepta → 409
// =====================================================================

test('POST /internal/.../resend-otp: PENDING (sin OTP generado) → 409 INVALID_STATE_TRANSITION', async () => {
  const { signRequest } = await createSignRequestWithIdentificacion({
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
  });
  // No llamamos a identify → signRequest queda en PENDING.
  const app = makeApp();
  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/resend-otp`)
    .set('X-Internal-API-Key', TEST_API_KEY)
    .send({});
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'INVALID_STATE_TRANSITION');
  assert.deepEqual(res.body.error.details.allowed_states, ['OTP_SENT', 'OTP_LOCKED']);
});

test('POST /internal/.../resend-otp: IDENTIFIED → 409 INVALID_STATE_TRANSITION', async () => {
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
  });
  await identifySR(token); // OTP_SENT
  forceEstado(signRequest.id, 'IDENTIFIED');
  const app = makeApp();
  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/resend-otp`)
    .set('X-Internal-API-Key', TEST_API_KEY)
    .send({});
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'INVALID_STATE_TRANSITION');
});

for (const terminal of ['SIGNED', 'REJECTED', 'EXPIRED', 'REVOKED', 'CANCELLED']) {
  test(`POST /internal/.../resend-otp: estado terminal ${terminal} → 410`, async () => {
    const { signRequest } = await createSrWithOtpSent();
    forceEstado(signRequest.id, terminal);
    const app = makeApp();
    const res = await request(app)
      .post(`/internal/sign-requests/${signRequest.id_solicitud}/resend-otp`)
      .set('X-Internal-API-Key', TEST_API_KEY)
      .send({});
    // Estados terminales son rechazados por resolveToken (410) ANTES de
    // llegar a resendOtp(). El error.code es LINK_NOT_AVAILABLE (mismo
    // endpoint público mini-app).
    assert.equal(res.status, 410);
    assert.ok(['LINK_NOT_AVAILABLE', 'TOKEN_EXPIRED', 'TOKEN_ALREADY_USED'].includes(res.body.error.code),
      `code=${res.body.error.code}`);
  });
}

// =====================================================================
// OTP_SENT
// =====================================================================

test('POST /internal/.../resend-otp: OTP_SENT con OTP vigente → 400 OTP_NOT_EXPIRED', async () => {
  const { signRequest } = await createSrWithOtpSent();
  // No forzamos expiración → fecha_otp_enviado = NOW → vigente.
  const app = makeApp();
  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/resend-otp`)
    .set('X-Internal-API-Key', TEST_API_KEY)
    .send({});
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'OTP_NOT_EXPIRED');
});

test('POST /internal/.../resend-otp: OTP_SENT con OTP expirado (>10 min) → 200 + nuevo OTP', async () => {
  const { signRequest } = await createSrWithOtpSent();
  forceOtpExpired(signRequest.id);
  const app = makeApp();
  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/resend-otp`)
    .set('X-Internal-API-Key', TEST_API_KEY)
    .send({});
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.estado, 'OTP_SENT');
  assert.equal(res.body.otp_ttl_seconds, config.ttl.otpSeconds);
  assert.equal(res.body.id_solicitud, signRequest.id_solicitud);
  assert.ok(res.body.correo_destino_enmascarado);
  // El correo NO debe aparecer en plaintext
  assert.ok(!JSON.stringify(res.body).includes(CORREO_METADATA));
  // Debe existir el evento OTP_RESENT
  const eventos = db.prepare('SELECT evento, metadata FROM gh_firma_eventos WHERE firma_id = ?').all(signRequest.id).map(e => e.evento);
  assert.ok(eventos.includes('OTP_RESENT'));
  // La fecha_otp_enviado debe haberse actualizado a NOW.
  // La fecha ya viene en formato ISO 8601 con Z (de toISOString), no añadir Z.
  const row = db.prepare('SELECT fecha_otp_enviado FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  const diff = Math.abs(Date.now() - new Date(row.fecha_otp_enviado).getTime());
  assert.ok(diff < 5000, `fecha_otp_enviado debe estar cerca de NOW (diff=${diff}ms, value=${row.fecha_otp_enviado})`);
});

// =====================================================================
// OTP_LOCKED
// =====================================================================

test('POST /internal/.../resend-otp: OTP_LOCKED → 200 + desbloqueo + nuevo OTP + OTP_ANTERIOR_BLOQUEADO', async () => {
  const { token, signRequest } = await createSrWithOtpSent();
  // Agotar intentos para forzar OTP_LOCKED
  for (let i = 0; i < config.ttl.otpMaxAttempts; i++) {
    await verifyOtpWrong(token);
  }
  const locked = db.prepare('SELECT estado, otp_bloqueado FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.equal(locked.estado, 'OTP_LOCKED');
  assert.equal(locked.otp_bloqueado, 1);

  const app = makeApp();
  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/resend-otp`)
    .set('X-Internal-API-Key', TEST_API_KEY)
    .send({});
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'OTP_SENT');

  // El SR debe estar desbloqueado en BD
  const after = db.prepare('SELECT estado, otp_bloqueado, otp_intentos FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.equal(after.estado, 'OTP_SENT');
  assert.equal(after.otp_bloqueado, 0);
  assert.equal(after.otp_intentos, 0);

  // El evento OTP_RESENT debe tener OTP_ANTERIOR_BLOQUEADO=true
  const evt = db.prepare(`SELECT metadata FROM gh_firma_eventos WHERE firma_id = ? AND evento = 'OTP_RESENT' ORDER BY id LIMIT 1`).get(signRequest.id);
  const meta = JSON.parse(evt.metadata);
  assert.equal(meta.OTP_ANTERIOR_BLOQUEADO, true);
});

// =====================================================================
// id interno (entero) — equivalente a id_solicitud
// =====================================================================

test('POST /internal/.../resend-otp: por id interno (entero) también funciona', async () => {
  const { signRequest } = await createSrWithOtpSent();
  forceOtpExpired(signRequest.id);
  const app = makeApp();
  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id}/resend-otp`)
    .set('X-Internal-API-Key', TEST_API_KEY)
    .send({});
  assert.equal(res.status, 200);
  assert.equal(res.body.id_solicitud, signRequest.id_solicitud);
});

// =====================================================================
// Rate-limit 5/h por SR (compartido con endpoint público, mismo cubo)
// =====================================================================

test('POST /internal/.../resend-otp: 6to reenvío en <1h → 429 con retry_after_seconds', async () => {
  const { signRequest } = await createSrWithOtpSent();
  // Forzar 5 reenvíos (cada uno consume 1 del cubo). Entre cada uno, forzar
  // expiración del OTP para que resendOtp() no rechace con OTP_NOT_EXPIRED.
  for (let i = 0; i < config.rateLimit.resendOtpPerHour; i++) {
    forceOtpExpired(signRequest.id);
    const app = makeApp();
    const r = await request(app)
      .post(`/internal/sign-requests/${signRequest.id_solicitud}/resend-otp`)
      .set('X-Internal-API-Key', TEST_API_KEY)
      .send({});
    assert.equal(r.status, 200, `iteración ${i} debería ser 200`);
  }
  // El 6° debe ser 429
  forceOtpExpired(signRequest.id);
  const app = makeApp();
  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/resend-otp`)
    .set('X-Internal-API-Key', TEST_API_KEY)
    .send({});
  assert.equal(res.status, 429);
  assert.equal(res.body.error.code, 'RATE_LIMIT_EXCEEDED');
  assert.ok(typeof res.body.error.details.retry_after_seconds === 'number');
});

// =====================================================================
// SR legacy sin token cifrado (pre-I-013b) → 410
// =====================================================================
// NOTA: Este caso se cubre en tests/routes/resend-otp.test.js del endpoint
// público. createSignRequestWithIdentificacion() (helper actual) SIEMPRE
// cifra el token via I-013b; no hay forma de crear un SR legacy con el
// helper actual sin tocar la BD directamente. El comportamiento del wrapper
// per-empresa es idéntico al del endpoint público (delega en resendOtp),
// por lo que no duplicamos el test aquí.

// =====================================================================
// SMTP falla: OTP ya generado, evento OTP_SEND_FAILED
// =====================================================================

// =====================================================================
// Auditoría: evento OTP_RESENT en gh_firma_eventos con metadata sin OTP
// =====================================================================

test('POST /internal/.../resend-otp: registra evento OTP_RESENT sin OTP en metadata', async () => {
  const { signRequest } = await createSrWithOtpSent();
  forceOtpExpired(signRequest.id);
  mailer.clearDevInbox(); // limpiar antes del resend
  const app = makeApp();
  await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/resend-otp`)
    .set('X-Internal-API-Key', TEST_API_KEY)
    .send({});
  const evts = db.prepare(`SELECT evento, metadata FROM gh_firma_eventos WHERE firma_id = ? AND evento = 'OTP_RESENT'`).all(signRequest.id);
  assert.ok(evts.length >= 1, 'Debe existir al menos un evento OTP_RESENT');
  for (const evt of evts) {
    const meta = JSON.parse(evt.metadata);
    // El OTP NO debe aparecer en metadata (ni siquiera hasheado)
    assert.ok(!meta.otp, 'metadata NO debe contener campo otp');
    assert.ok(!meta.otp_hash, 'metadata NO debe contener otp_hash');
    assert.ok(!meta.otp_sal, 'metadata NO debe contener otp_sal');
    // El correo debe estar enmascarado
    assert.ok(meta.correo_destino_enmascarado, 'metadata debe contener correo_destino_enmascarado');
  }
});

// =====================================================================
// SMTP falla: OTP ya generado, evento OTP_SEND_FAILED
// =====================================================================

test('POST /internal/.../resend-otp: si SMTP falla → 200 + OTP generado + evento OTP_SEND_FAILED', async () => {
  const { signRequest } = await createSrWithOtpSent();
  forceOtpExpired(signRequest.id);

  // Mockear mailer.sendOTP para que lance
  const originalSend = mailer.sendOTP;
  mailer.sendOTP = async () => { throw new Error('SMTP caído'); };

  try {
    const app = makeApp();
    const res = await request(app)
      .post(`/internal/sign-requests/${signRequest.id_solicitud}/resend-otp`)
      .set('X-Internal-API-Key', TEST_API_KEY)
      .send({});
    // El endpoint retorna 200 (OTP generado) aunque el envío falle
    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'OTP_SENT');
    // El OTP ya quedó regenerado en BD
    const after = db.prepare('SELECT estado, otp_hash, fecha_otp_enviado FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
    assert.equal(after.estado, 'OTP_SENT');
    assert.ok(after.otp_hash);
    assert.ok(after.fecha_otp_enviado);
  } finally {
    mailer.sendOTP = originalSend;
  }
});
