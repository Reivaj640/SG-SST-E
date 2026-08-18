/**
 * Tests del flujo público (sub-bloque 1: token + identify).
 *
 * Cubre:
 * - GET /s/:token
 *   - token válido → 200 con contexto público
 *   - token inexistente → 404
 *   - token expirado → 410
 *   - estado terminal → 410
 *   - respuesta NO incluye token_hash, paths internos, etc.
 *   - registra evento OPENED la primera vez
 *
 * - POST /api/sign/:token/identify
 *   - cédula correcta → 200 + OTP
 *   - cédula incorrecta → 422 IDENTIFICATION_FAILED
 *   - tipo de doc incorrecto → 422
 *   - token inválido → 404/410
 *   - cuerpo inválido → 400
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../../src/db/connection');
const { resetDb, makeApp, createSignRequestWithIdentificacion } = require('../helpers');
const mailer = require('../../src/services/mailer');

test('GET /s/:token: token válido → 200 con contexto público', async () => {
  resetDb();
  const { token } = createSignRequestWithIdentificacion();
  const app = makeApp();
  const res = await request(app).get(`/s/${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'PENDING');
  assert.ok(res.body.id_solicitud);
  assert.equal(res.body.tipo_firma, 'presencial');
  assert.equal(res.body.identificacion_tipo, 'CC');
});

test('GET /s/:token: respuesta NO incluye secretos', async () => {
  resetDb();
  const { token } = createSignRequestWithIdentificacion();
  const app = makeApp();
  const res = await request(app).get(`/s/${token}`);

  // Verificar que NO se exponen campos sensibles
  assert.equal(res.body.token_hash, undefined, 'NO debe exponer token_hash');
  assert.equal(res.body.identificacion_numero_hash, undefined, 'NO debe exponer hash de cédula');
  assert.equal(res.body.pdf_original_path, undefined, 'NO debe exponer path del PDF');
  assert.equal(res.body.ip_origen, undefined, 'NO debe exponer IP');
  assert.equal(res.body.agreement_hash, undefined, 'NO debe exponer agreement_hash (es interno)');
});

test('GET /s/:token: token inexistente → 404', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app).get('/s/token_inexistente_1234567890ab');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'TOKEN_NOT_FOUND');
});

test('GET /s/:token: token expirado → 410 + estado EXPIRED', async () => {
  resetDb();
  const { token, signRequest } = createSignRequestWithIdentificacion();

  // Forzar expiración modificando fecha_expiracion
  db.prepare(`
    UPDATE gh_firmas_electronicas
    SET fecha_expiracion = '2020-01-01T00:00:00.000000Z'
    WHERE id = ?
  `).run(signRequest.id);

  const app = makeApp();
  const res = await request(app).get(`/s/${token}`);
  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'TOKEN_EXPIRED');

  // El estado debe haberse actualizado a EXPIRED
  const row = db.prepare('SELECT estado FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.equal(row.estado, 'EXPIRED');
});

test('GET /s/:token: estado SIGNED → 410', async () => {
  resetDb();
  const { token, signRequest } = createSignRequestWithIdentificacion();
  db.prepare(`UPDATE gh_firmas_electronicas SET estado = 'SIGNED' WHERE id = ?`).run(signRequest.id);

  const app = makeApp();
  const res = await request(app).get(`/s/${token}`);
  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'TOKEN_ALREADY_USED');
});

test('GET /s/:token: primer acceso registra evento OPENED', async () => {
  resetDb();
  const { token, signRequest } = createSignRequestWithIdentificacion();
  const app = makeApp();
  await request(app).get(`/s/${token}`);

  const eventos = db.prepare(`
    SELECT evento FROM gh_firma_eventos
    WHERE firma_id = ? ORDER BY id
  `).all(signRequest.id);
  // El primer evento es CREATED (del signRequestService.create)
  // El segundo debe ser OPENED
  assert.equal(eventos[eventos.length - 1].evento, 'OPENED');

  // fecha_apertura debe estar populada
  const row = db.prepare('SELECT fecha_apertura FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.ok(row.fecha_apertura);
});

test('GET /s/:token: segundo acceso NO registra otro OPENED', async () => {
  resetDb();
  const { token, signRequest } = createSignRequestWithIdentificacion();
  const app = makeApp();
  await request(app).get(`/s/${token}`);
  await request(app).get(`/s/${token}`);

  const eventos = db.prepare(`
    SELECT evento FROM gh_firma_eventos
    WHERE firma_id = ? AND evento = 'OPENED'
  `).all(signRequest.id);
  assert.equal(eventos.length, 1, 'Solo debe haber UN evento OPENED');
});

// =========================================================================
// POST /api/sign/:token/identify
// =========================================================================

test('POST /api/sign/:token/identify: cédula correcta → 200 + OTP_SENT', async () => {
  resetDb();
  const { token } = createSignRequestWithIdentificacion({
    identificacion_numero: '1234567890',
  });
  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });

  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'OTP_SENT');
  assert.equal(res.body.otp_ttl_seconds, 600);
  assert.match(res.body.correo_destino_enmascarado, /@/);
  assert.match(res.body.devOtp, /^\d{6}$/);

  // El OTP debe estar en el mailer dev
  const inbox = mailer.getDevInbox();
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].otp, res.body.devOtp);
});

test('POST /api/sign/:token/identify: cédula incorrecta → 422', async () => {
  resetDb();
  const { token } = createSignRequestWithIdentificacion({
    identificacion_numero: '1234567890',
  });
  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '9999999999' });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'IDENTIFICATION_FAILED');
});

test('POST /api/sign/:token/identify: tipo de doc incorrecto → 422', async () => {
  resetDb();
  const { token } = createSignRequestWithIdentificacion();
  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CE', numero_documento: '1234567890' });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'IDENTIFICATION_FAILED');
  assert.equal(res.body.error.details.expected, 'CC');
});

test('POST /api/sign/:token/identify: token inválido → 404', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/api/sign/token_invalido_xxxxxxxxxxxxxx/identify')
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  assert.equal(res.status, 404);
});

test('POST /api/sign/:token/identify: body inválido → 400', async () => {
  resetDb();
  const { token } = createSignRequestWithIdentificacion();
  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'INVALID', numero_documento: '123' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /api/sign/:token/identify: registra eventos IDENTIFICATION_COMPLETED y OTP_SENT', async () => {
  resetDb();
  const { token, signRequest } = createSignRequestWithIdentificacion({
    identificacion_numero: '1234567890',
  });
  const app = makeApp();
  await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });

  const eventos = db.prepare(`
    SELECT evento FROM gh_firma_eventos
    WHERE firma_id = ? ORDER BY id
  `).all(signRequest.id).map(e => e.evento);

  // Debe haber: CREATED, OPENED, IDENTIFICATION_COMPLETED, OTP_SENT
  assert.ok(eventos.includes('IDENTIFICATION_COMPLETED'));
  assert.ok(eventos.includes('OTP_SENT'));
});

// =========================================================================
// POST /api/sign/:token/verify-otp
// =========================================================================

test('POST /api/sign/:token/verify-otp: OTP correcto → 200', async () => {
  resetDb();
  const { token } = createSignRequestWithIdentificacion();
  const app = makeApp();
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  const otp = r1.body.devOtp;

  const r2 = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp });

  assert.equal(r2.status, 200);
  assert.equal(r2.body.ok, true);
  assert.equal(r2.body.estado, 'OTP_VERIFIED');
});

test('POST /api/sign/:token/verify-otp: OTP incorrecto → 422 + attempts', async () => {
  resetDb();
  const { token } = createSignRequestWithIdentificacion();
  const app = makeApp();
  await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });

  const r = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: '000000' });

  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, 'OTP_INVALID');
  assert.equal(r.body.error.details.attempts, 1);
  assert.equal(r.body.error.details.max_attempts, 5);
});

test('POST /api/sign/:token/verify-otp: 5 intentos → OTP_LOCKED', async () => {
  resetDb();
  const { token } = createSignRequestWithIdentificacion();
  const app = makeApp();
  await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });

  for (let i = 0; i < 5; i++) {
    const r = await request(app)
      .post(`/api/sign/${token}/verify-otp`)
      .send({ otp: '000000' });
    if (i < 4) {
      assert.equal(r.status, 422);
      assert.equal(r.body.error.code, 'OTP_INVALID');
    } else {
      assert.equal(r.status, 422);
      assert.equal(r.body.error.code, 'OTP_LOCKED');
    }
  }

  // 6to intento: ya bloqueado
  const r6 = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: '000000' });
  assert.equal(r6.status, 422);
  assert.equal(r6.body.error.code, 'OTP_LOCKED');
});

test('POST /api/sign/:token/verify-otp: formato inválido → 400', async () => {
  resetDb();
  const { token } = createSignRequestWithIdentificacion();
  const app = makeApp();
  await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });

  const r = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: 'abc' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /api/sign/:token/verify-otp: token inválido → 404', async () => {
  resetDb();
  const app = makeApp();
  const r = await request(app)
    .post('/api/sign/token_inexistente/verify-otp')
    .send({ otp: '123456' });
  assert.equal(r.status, 404);
});

test('POST /api/sign/:token/verify-otp: sin identify previo → 409', async () => {
  resetDb();
  const { token } = createSignRequestWithIdentificacion();
  const app = makeApp();
  // NO hace identify antes
  const r = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: '123456' });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'INVALID_STATE_TRANSITION');
});
