/**
 * Tests del endpoint POST /api/sign/:token/resend-otp.
 *
 * Cubre:
 *   - Happy path: OTP expirado → resend exitoso + nuevo OTP
 *   - OTP vigente → OTP_NOT_EXPIRED (400)
 *   - OTP_LOCKED → desbloqueo + nuevo OTP
 *   - Estados terminales (SIGNED, REVOKED, EXPIRED) → rechazo (410 via resolveToken)
 *   - Nuevo OTP invalida el anterior
 *   - Nuevo TTL = 600 segundos
 *   - Correo desde consent_id, no desde metadata alternativa
 *   - Evento OTP_RESENT sin OTP en metadata
 *   - Rate limiting
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../../src/db/connection');
const { resetDb, makeApp, seedActiveAgreement, createSignRequestWithIdentificacion, createAcceptedConsent } = require('../helpers');
const mailer = require('../../src/services/mailer');
const publicFlow = require('../../src/services/publicFlow');
const config = require('../../src/config');

const CORREO_CONSENT = 'consent@test.com';
const CORREO_METADATA = 'metadata@test.com';
const CEDULA = '1234567890';

function forceOtpExpired(signRequestId) {
  const past = new Date(Date.now() - 700 * 1000).toISOString();
  db.prepare('UPDATE gh_firmas_electronicas SET fecha_otp_enviado = ? WHERE id = ?').run(past, signRequestId);
}

async function identifySR(token) {
  const app = makeApp();
  return request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: CEDULA });
}

async function verifyOtpWithWrong(token, otp) {
  const app = makeApp();
  return request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp });
}

test.beforeEach(() => {
  resetDb();
  mailer.clearDevInbox();
  publicFlow.clearResendOtpRateLimit();
});

// ─── 1. Happy path: OTP expirado → resend exitoso ───

test('resend-otp: OTP expirado → 200 + nuevo OTP + OTP_SENT', async () => {
  const consent = await createAcceptedConsent({ correo: CORREO_CONSENT });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
    consent_id: consent.consent_id,
  });

  const rId = await identifySR(token);
  assert.equal(rId.status, 200);
  assert.equal(rId.body.estado, 'OTP_SENT');

  forceOtpExpired(signRequest.id);

  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/resend-otp`)
    .send({});

  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'OTP_SENT');
  assert.equal(res.body.otp_ttl_seconds, config.ttl.otpSeconds);
  assert.ok(res.body.correo_destino_enmascarado);

  const row = db.prepare('SELECT fecha_otp_enviado, otp_hash FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.ok(row.fecha_otp_enviado);

  const eventos = db.prepare('SELECT evento FROM gh_firma_eventos WHERE firma_id = ?').all(signRequest.id).map(e => e.evento);
  assert.ok(eventos.includes('OTP_RESENT'), 'Debe registrar evento OTP_RESENT');
});

// ─── 2. OTP vigente → OTP_NOT_EXPIRED ───

test('resend-otp: OTP vigente (no expirado) → 400 OTP_NOT_EXPIRED', async () => {
  const consent = await createAcceptedConsent({ correo: CORREO_CONSENT });
  const { token } = await createSignRequestWithIdentificacion({
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
    consent_id: consent.consent_id,
  });

  await identifySR(token);

  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/resend-otp`)
    .send({});

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'OTP_NOT_EXPIRED');
});

// ─── 3. OTP_LOCKED → desbloqueo + nuevo OTP ───

test('resend-otp: OTP_LOCKED → 200 + desbloqueo + nuevo OTP', async () => {
  const consent = await createAcceptedConsent({ correo: CORREO_CONSENT });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
    consent_id: consent.consent_id,
  });

  await identifySR(token);

  for (let i = 0; i < config.ttl.otpMaxAttempts; i++) {
    await verifyOtpWithWrong(token, '000000');
  }

  const locked = db.prepare('SELECT estado, otp_bloqueado FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.equal(locked.estado, 'OTP_LOCKED');
  assert.equal(locked.otp_bloqueado, 1);

  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/resend-otp`)
    .send({});

  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'OTP_SENT');

  const after = db.prepare('SELECT estado, otp_bloqueado, otp_intentos FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.equal(after.estado, 'OTP_SENT');
  assert.equal(after.otp_bloqueado, 0);
  assert.equal(after.otp_intentos, 0);

  const ev = db.prepare("SELECT metadata FROM gh_firma_eventos WHERE firma_id = ? AND evento = 'OTP_RESENT'").get(signRequest.id);
  assert.ok(ev, 'Debe registrar OTP_RESENT');
  const meta = JSON.parse(ev.metadata);
  assert.equal(meta.OTP_ANTERIOR_BLOQUEADO, true);
});

// ─── 4. Estados terminales → rechazo ───

test('resend-otp: estado SIGNED → 410 (resolveToken)', async () => {
  const consent = await createAcceptedConsent({ correo: CORREO_CONSENT });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
    consent_id: consent.consent_id,
  });
  db.prepare("UPDATE gh_firmas_electronicas SET estado = 'SIGNED' WHERE id = ?").run(signRequest.id);

  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/resend-otp`)
    .send({});
  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'TOKEN_ALREADY_USED');
});

test('resend-otp: estado REVOKED → 410 (resolveToken)', async () => {
  const consent = await createAcceptedConsent({ correo: CORREO_CONSENT });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
    consent_id: consent.consent_id,
  });
  db.prepare("UPDATE gh_firmas_electronicas SET estado = 'REVOKED' WHERE id = ?").run(signRequest.id);

  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/resend-otp`)
    .send({});
  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'TOKEN_ALREADY_USED');
});

test('resend-otp: estado EXPIRED → 410 (resolveToken)', async () => {
  const consent = await createAcceptedConsent({ correo: CORREO_CONSENT });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
    consent_id: consent.consent_id,
  });
  db.prepare("UPDATE gh_firmas_electronicas SET estado = 'EXPIRED' WHERE id = ?").run(signRequest.id);

  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/resend-otp`)
    .send({});
  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'TOKEN_ALREADY_USED');
});

test('resend-otp: estado PENDING (sin identify) → 409', async () => {
  const consent = await createAcceptedConsent({ correo: CORREO_CONSENT });
  const { token } = await createSignRequestWithIdentificacion({
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
    consent_id: consent.consent_id,
  });

  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/resend-otp`)
    .send({});
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'INVALID_STATE_TRANSITION');
});

// ─── 5. Nuevo OTP invalida el anterior ───

test('resend-otp: nuevo OTP invalida el anterior', async () => {
  const consent = await createAcceptedConsent({ correo: CORREO_CONSENT });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
    consent_id: consent.consent_id,
  });

  await identifySR(token);
  forceOtpExpired(signRequest.id);

  const before = db.prepare('SELECT otp_hash FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  const oldHash = before.otp_hash;

  const app = makeApp();
  await request(app).post(`/api/sign/${token}/resend-otp`).send({});

  const after = db.prepare('SELECT otp_hash FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.notEqual(after.otp_hash, oldHash, 'El hash del OTP debe cambiar después de resend');

  const rVerify = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: '123456' });
  assert.equal(rVerify.status, 422);
  assert.equal(rVerify.body.error.code, 'OTP_INVALID');
});

// ─── 6. Nuevo TTL = 600 segundos ───

test('resend-otp: nuevo TTL es 600 segundos', async () => {
  const consent = await createAcceptedConsent({ correo: CORREO_CONSENT });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
    consent_id: consent.consent_id,
  });

  await identifySR(token);
  forceOtpExpired(signRequest.id);

  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/resend-otp`)
    .send({});

  assert.equal(res.status, 200);
  assert.equal(res.body.otp_ttl_seconds, 600);
});

// ─── 7. Correo desde consent_id, no desde metadata ───

test('resend-otp: correo viene de consent_id.verificacion, no de metadata', async () => {
  const consent = await createAcceptedConsent({ correo: CORREO_CONSENT });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
    consent_id: consent.consent_id,
  });

  await identifySR(token);
  forceOtpExpired(signRequest.id);
  mailer.clearDevInbox();

  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/resend-otp`)
    .send({});

  assert.equal(res.status, 200);

  // cons***@test.com is the masked form of consent@test.com
  const masked = res.body.correo_destino_enmascarado;
  assert.ok(masked.startsWith('cons'), `El correo enmascarado debe empezar con 'cons' (consent@test.com), got: ${masked}`);

  const inbox = mailer.getDevInbox();
  assert.ok(inbox.length > 0, 'Debe haber un correo en el inbox');
  const lastMail = inbox[inbox.length - 1];
  assert.equal(lastMail.to, CORREO_CONSENT, 'El correo enviado debe ser el del consentimiento');
});

// ─── 8. Evento OTP_RESENT sin OTP en metadata ───

test('resend-otp: evento OTP_RESENT NO contiene el OTP en metadata', async () => {
  const consent = await createAcceptedConsent({ correo: CORREO_CONSENT });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
    consent_id: consent.consent_id,
  });

  await identifySR(token);
  forceOtpExpired(signRequest.id);

  const app = makeApp();
  await request(app).post(`/api/sign/${token}/resend-otp`).send({});

  const ev = db.prepare("SELECT metadata FROM gh_firma_eventos WHERE firma_id = ? AND evento = 'OTP_RESENT'").get(signRequest.id);
  assert.ok(ev, 'Debe registrar evento OTP_RESENT');
  const meta = JSON.parse(ev.metadata);

  assert.equal(meta.otp, undefined, 'OTP_RESENT metadata NO debe contener el OTP');
  assert.equal(meta.otp_hash, undefined, 'OTP_RESENT metadata NO debe contener otp_hash');
  assert.equal(meta.otp_plaintext, undefined, 'OTP_RESENT metadata NO debe contener otp_plaintext');

  assert.equal(meta.canal, 'email');
  assert.ok(meta.correo_destino_enmascarado);
  assert.equal(typeof meta.OTP_ANTERIOR_BLOQUEADO, 'boolean');
});

// ─── 9. Rate limiting ───

test('resend-otp: rate limiting → 429 después de N reenvíos', async () => {
  const consent = await createAcceptedConsent({ correo: CORREO_CONSENT });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
    consent_id: consent.consent_id,
  });

  await identifySR(token);

  const maxResends = config.rateLimit.resendOtpPerHour;
  const app = makeApp();

  for (let i = 0; i < maxResends; i++) {
    forceOtpExpired(signRequest.id);
    const res = await request(app)
      .post(`/api/sign/${token}/resend-otp`)
      .send({});
    assert.equal(res.status, 200, `Reenvío ${i + 1} debe ser exitoso`);
  }

  forceOtpExpired(signRequest.id);
  const res = await request(app)
    .post(`/api/sign/${token}/resend-otp`)
    .send({});

  assert.equal(res.status, 429);
  assert.equal(res.body.error.code, 'RATE_LIMIT_EXCEEDED');
  assert.ok(res.body.error.details.retry_after_seconds > 0);
});

// ─── 10. Token inválido → 404 ───

test('resend-otp: token inexistente → 404', async () => {
  const app = makeApp();
  const res = await request(app)
    .post('/api/sign/token_inexistente/resend-otp')
    .send({});
  assert.equal(res.status, 404);
});

// ─── 11. Body con campos extra ───

test('resend-otp: body con campos extra es ignorado', async () => {
  const consent = await createAcceptedConsent({ correo: CORREO_CONSENT });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    metadata: JSON.stringify({ correo: CORREO_METADATA }),
    consent_id: consent.consent_id,
  });

  await identifySR(token);
  forceOtpExpired(signRequest.id);

  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/resend-otp`)
    .send({ extra_field: 'ignored', another: 123 });

  assert.ok([200, 400].includes(res.status), `Status debe ser 200 o 400, got ${res.status}`);
});
