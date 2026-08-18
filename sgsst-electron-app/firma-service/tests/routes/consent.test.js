/**
 * Tests del flujo de Consentimiento del Acuerdo.
 *
 * Cubre:
 * - POST /internal/consentimientos
 *   - trabajador válido → 201, OTP generado, OTP NO en BD, hash/salt sí
 *   - sin Acuerdo activo → 404 ACUERDO_NOT_FOUND
 *   - body inválido → 400 INVALID_REQUEST_BODY
 *   - ya aceptado → 200 con already_accepted: true
 *   - ya pending → 409 CONSENT_PENDING
 *
 * - POST /internal/consentimientos/:id/verify-otp
 *   - OTP correcto → 200, manifestacion_aceptada=true
 *   - OTP incorrecto → 422 OTP_INVALID con attempts
 *   - demasiados intentos → 422 OTP_LOCKED
 *   - ya aceptado → 409 ALREADY_ACCEPTED
 *   - inexistente → 404 CONSENT_NOT_FOUND
 *   - OTP no se puede reusar
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../../src/db/connection');
const {
  resetDb, seedActiveAgreement, makeApp, withApiKey, TEST_API_KEY,
} = require('../helpers');
const mailer = require('../../src/services/mailer');

const HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };

// =========================================================================
// POST /internal/consentimientos
// =========================================================================

test('POST /internal/consentimientos: válido → 201 + OTP en mailer dev', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0', texto: 'Acuerdo de prueba v1' });
  const app = makeApp();
  const res = await request(app)
    .post('/internal/consentimientos')
    .set(HEADERS)
    .send({
      id_trabajador: '1234567890',
      id_empresa: '900123456',
      version_acuerdo: 'v1.0',
      correo_verificacion: 'juan@example.com',
      kair_version: '0.1.189',
    });
  assert.equal(res.status, 201);
  assert.ok(res.body.consent_id);
  assert.equal(res.body.version_acuerdo, 'v1.0');
  assert.equal(res.body.estado, 'OTP_PENDING');
  assert.equal(res.body.otp_ttl_seconds, 600);
  assert.equal(res.body.correo_destino_enmascarado, 'juan@example.com');
  // En dev, el OTP se devuelve para tests
  assert.match(res.body.devOtp, /^\d{6}$/);

  // Verificar que el OTP NO está en la BD en plano
  const row = db.prepare('SELECT otp_hash, otp_sal FROM gh_consentimientos_firma WHERE id = ?').get(res.body.consent_id);
  assert.ok(row.otp_hash);
  assert.ok(row.otp_sal);
  assert.equal(row.otp_hash.length, 64);
  assert.notEqual(row.otp_hash, res.body.devOtp, 'OTP NO debe quedar en plano en BD');

  // Verificar que el mailer capturó el OTP
  const inbox = mailer.getDevInbox();
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].otp, res.body.devOtp);
  assert.equal(inbox[0].to, 'juan@example.com');
});

test('POST /internal/consentimientos: sin Acuerdo activo → 404', async () => {
  resetDb();
  // No seed
  const app = makeApp();
  const res = await request(app)
    .post('/internal/consentimientos')
    .set(HEADERS)
    .send({
      id_trabajador: '123',
      id_empresa: '456',
      version_acuerdo: 'v1.0',
      correo_verificacion: 'j@e.com',
      kair_version: '0.1.189',
    });
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'ACUERDO_NOT_FOUND');
});

test('POST /internal/consentimientos: body inválido → 400', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/consentimientos')
    .set(HEADERS)
    .send({
      id_trabajador: '',  // inválido
      id_empresa: '456',
      version_acuerdo: 'v1.0',
      correo_verificacion: 'no-es-email',
      kair_version: '0.1.189',
    });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
  assert.ok(res.body.error.details.issues);
});

test('POST /internal/consentimientos: ya aceptado → 200 already_accepted', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const body = {
    id_trabajador: '111', id_empresa: '222', version_acuerdo: 'v1.0',
    correo_verificacion: 'a@b.com', kair_version: '0.1.189',
  };
  // Primero crear
  const r1 = await request(app).post('/internal/consentimientos').set(HEADERS).send(body);
  assert.equal(r1.status, 201);
  // Aceptar
  await request(app)
    .post(`/internal/consentimientos/${r1.body.consent_id}/verify-otp`)
    .set(HEADERS)
    .send({ otp: r1.body.devOtp, kair_version: '0.1.189' });
  // Segundo intento
  const r2 = await request(app).post('/internal/consentimientos').set(HEADERS).send(body);
  assert.equal(r2.status, 200);
  assert.equal(r2.body.already_accepted, true);
  assert.equal(r2.body.manifestacion_aceptada, true);
});

test('POST /internal/consentimientos: ya pending → 409', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const body = {
    id_trabajador: '111', id_empresa: '222', version_acuerdo: 'v1.0',
    correo_verificacion: 'a@b.com', kair_version: '0.1.189',
  };
  const r1 = await request(app).post('/internal/consentimientos').set(HEADERS).send(body);
  assert.equal(r1.status, 201);
  const r2 = await request(app).post('/internal/consentimientos').set(HEADERS).send(body);
  assert.equal(r2.status, 409);
  assert.equal(r2.body.error.code, 'CONSENT_PENDING');
});

// =========================================================================
// POST /internal/consentimientos/:id/verify-otp
// =========================================================================

test('POST verify-otp: OTP correcto → 200, manifestacion_aceptada=true', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const r1 = await request(app).post('/internal/consentimientos').set(HEADERS).send({
    id_trabajador: '111', id_empresa: '222', version_acuerdo: 'v1.0',
    correo_verificacion: 'a@b.com', kair_version: '0.1.189',
  });
  const consentId = r1.body.consent_id;
  const otp = r1.body.devOtp;

  const r2 = await request(app)
    .post(`/internal/consentimientos/${consentId}/verify-otp`)
    .set(HEADERS)
    .send({ otp, kair_version: '0.1.189' });

  assert.equal(r2.status, 200);
  assert.equal(r2.body.ok, true);
  assert.equal(r2.body.manifestacion_aceptada, true);
  assert.equal(r2.body.estado, 'ACCEPTED');
  assert.ok(r2.body.fecha_aceptacion);
});

test('POST verify-otp: OTP incorrecto → 422 OTP_INVALID + attempts=1', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const r1 = await request(app).post('/internal/consentimientos').set(HEADERS).send({
    id_trabajador: '111', id_empresa: '222', version_acuerdo: 'v1.0',
    correo_verificacion: 'a@b.com', kair_version: '0.1.189',
  });

  const r2 = await request(app)
    .post(`/internal/consentimientos/${r1.body.consent_id}/verify-otp`)
    .set(HEADERS)
    .send({ otp: '000000' });

  assert.equal(r2.status, 422);
  assert.equal(r2.body.error.code, 'OTP_INVALID');
  assert.equal(r2.body.error.details.attempts, 1);
  assert.equal(r2.body.error.details.max_attempts, 5);
});

test('POST verify-otp: muchos intentos → 422 OTP_LOCKED', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const r1 = await request(app).post('/internal/consentimientos').set(HEADERS).send({
    id_trabajador: '111', id_empresa: '222', version_acuerdo: 'v1.0',
    correo_verificacion: 'a@b.com', kair_version: '0.1.189',
  });
  const consentId = r1.body.consent_id;

  // 5 intentos incorrectos
  for (let i = 0; i < 5; i++) {
    const r = await request(app)
      .post(`/internal/consentimientos/${consentId}/verify-otp`)
      .set(HEADERS)
      .send({ otp: '000000' });
    if (i < 4) {
      assert.equal(r.status, 422);
      assert.equal(r.body.error.code, 'OTP_INVALID');
    } else {
      // 5to intento → bloqueado
      assert.equal(r.status, 422);
      assert.equal(r.body.error.code, 'OTP_LOCKED');
    }
  }

  // 6to intento: ya está bloqueado
  const r6 = await request(app)
    .post(`/internal/consentimientos/${consentId}/verify-otp`)
    .set(HEADERS)
    .send({ otp: '000000' });
  assert.equal(r6.status, 422);
  assert.equal(r6.body.error.code, 'OTP_LOCKED');
});

test('POST verify-otp: ya aceptado → 409 ALREADY_ACCEPTED', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const r1 = await request(app).post('/internal/consentimientos').set(HEADERS).send({
    id_trabajador: '111', id_empresa: '222', version_acuerdo: 'v1.0',
    correo_verificacion: 'a@b.com', kair_version: '0.1.189',
  });
  const consentId = r1.body.consent_id;
  const otp = r1.body.devOtp;

  // Aceptar
  await request(app)
    .post(`/internal/consentimientos/${consentId}/verify-otp`)
    .set(HEADERS)
    .send({ otp });
  // Segundo intento con el mismo OTP
  const r2 = await request(app)
    .post(`/internal/consentimientos/${consentId}/verify-otp`)
    .set(HEADERS)
    .send({ otp });
  assert.equal(r2.status, 409);
  assert.equal(r2.body.error.code, 'ALREADY_ACCEPTED');
});

test('POST verify-otp: OTP no se puede reusar después de aceptar', async () => {
  // Caso crítico: aunque el atacante capture el OTP antes, no debe
  // poder reusarlo después de la aceptación legítima.
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const r1 = await request(app).post('/internal/consentimientos').set(HEADERS).send({
    id_trabajador: '111', id_empresa: '222', version_acuerdo: 'v1.0',
    correo_verificacion: 'a@b.com', kair_version: '0.1.189',
  });
  const consentId = r1.body.consent_id;
  const otp = r1.body.devOtp;

  // Aceptación legítima
  const r2 = await request(app)
    .post(`/internal/consentimientos/${consentId}/verify-otp`)
    .set(HEADERS)
    .send({ otp });
  assert.equal(r2.status, 200);
  assert.equal(r2.body.manifestacion_aceptada, true);

  // Intento de reuso
  const r3 = await request(app)
    .post(`/internal/consentimientos/${consentId}/verify-otp`)
    .set(HEADERS)
    .send({ otp });
  assert.equal(r3.status, 409);
  assert.equal(r3.body.error.code, 'ALREADY_ACCEPTED');

  // El estado sigue siendo ACCEPTED (no se revierte)
  const row = db.prepare('SELECT estado, manifestacion_aceptada FROM gh_consentimientos_firma WHERE id = ?').get(consentId);
  assert.equal(row.estado, 'ACCEPTED');
  assert.equal(row.manifestacion_aceptada, 1);
});

test('POST verify-otp: consent inexistente → 404', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/consentimientos/99999/verify-otp')
    .set(HEADERS)
    .send({ otp: '123456' });
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'CONSENT_NOT_FOUND');
});

test('POST verify-otp: id inválido (no entero) → 400', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/consentimientos/abc/verify-otp')
    .set(HEADERS)
    .send({ otp: '123456' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST verify-otp: OTP con formato inválido → 400', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const r1 = await request(app).post('/internal/consentimientos').set(HEADERS).send({
    id_trabajador: '111', id_empresa: '222', version_acuerdo: 'v1.0',
    correo_verificacion: 'a@b.com', kair_version: '0.1.189',
  });
  const r2 = await request(app)
    .post(`/internal/consentimientos/${r1.body.consent_id}/verify-otp`)
    .set(HEADERS)
    .send({ otp: '12345' });  // 5 dígitos
  assert.equal(r2.status, 400);
  assert.equal(r2.body.error.code, 'INVALID_REQUEST_BODY');
});
