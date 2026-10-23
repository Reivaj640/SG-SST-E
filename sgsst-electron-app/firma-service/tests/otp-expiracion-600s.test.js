/**
 * M1 · EL OTP EXPIRA A LOS 600 SEGUNDOS (3.4(e) de la v1.0 VIGENTE)
 * ==============================================================
 *
 * El 3.4(e) del Acuerdo de uso que HOY está publicado y aceptando gente dice:
 *
 *   "un código OTP de un solo uso, que expira a los seiscientos (600)
 *    segundos contados desde su envío y admite un máximo de cinco (5)
 *    intentos de verificación"
 *
 * El código no lo cumplía: `verifyOtp` comparaba el código sin mirar la
 * fecha de envío. Solo `resendOtp` miraba la expiración, y únicamente para
 * decidir si dejaba reenviar. Un código de hace dos horas seguía valiendo.
 *
 * Estos tests comprueban:
 *
 *   1. Un OTP vencido se rechaza con 410 OTP_EXPIRADO (no con un 410
 *      genérico de "enlace vencido": el enlace sigue vivo).
 *   2. Un OTP vigente se acepta (no se rompió el flujo normal).
 *   3. El fallback: si la fila no tiene fecha de envío (heredada), NO se
 *      aplica la rama de expiración.
 *   4. El rejection NO consume un intento de los cinco.
 *   5. Tras el rejection, el Trabajador puede pedir un código nuevo y firmar.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../src/db/connection');
const publicFlow = require('../src/services/publicFlow');
const mailer = require('../src/services/mailer');
const {
  resetDb, seedActiveAgreement, makeApp,
  createSignRequestWithIdentificacion, createAcceptedConsent,
  assertJsonError,
} = require('./helpers');

const CORREO = 'trabajador@example.com';
const CEDULA = '1234567890';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envejece el OTP de la firma: lo deja con la fecha de envío de hace
 * `segundos` segundos.
 */
function envejecerOtp(signRequestId, segundos = 700) {
  const past = new Date(Date.now() - segundos * 1000).toISOString();
  db.prepare(
    'UPDATE gh_firmas_electronicas SET fecha_otp_enviado = ? WHERE id = ?'
  ).run(past, signRequestId);
}

/**
 * Deja la firma SIN fecha de envío (como una fila heredada de antes de que
 * existiera la columna).
 */
function sinFechaOtp(signRequestId) {
  db.prepare(
    'UPDATE gh_firmas_electronicas SET fecha_otp_enviado = NULL WHERE id = ?'
  ).run(signRequestId);
}

/**
 * Crea la solicitud, la identifica (queda en OTP_SENT) y devuelve el OTP
 * real que salió en el correo.
 */
async function firmaConOtp() {
  const consent = await createAcceptedConsent({ correo: CORREO });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    metadata: JSON.stringify({ correo: CORREO }),
    consent_id: consent.consent_id,
  });
  const app = makeApp();
  const r = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: CEDULA });
  assert.equal(r.status, 200, `identify falló: ${JSON.stringify(r.body)}`);
  return { app, token, signRequest, otp: r.body.devOtp };
}

test.beforeEach(() => {
  resetDb();
  seedActiveAgreement();
  publicFlow.clearResendOtpRateLimit();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. El OTP vencido se rechaza
// ─────────────────────────────────────────────────────────────────────────────

test('M1 · un OTP vencido se rechaza con 410 OTP_EXPIRADO', async () => {
  const { app, token, signRequest, otp } = await firmaConOtp();
  envejecerOtp(signRequest.id);

  const res = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp });

  assert.equal(res.status, 410);
  const err = assertJsonError(res, 'OTP_EXPIRADO');
  assert.equal(err.details.se_puede_reenviar, true,
    'la respuesta dice que hay salida: pedir un código nuevo');
  assert.equal(err.details.ttl_seconds, 600,
    'el TTL es el de los 600 segundos que promete el 3.4(e)');
});

test('M1 · el OTP vencido NO consume uno de los cinco intentos', async () => {
  const { app, token, signRequest, otp } = await firmaConOtp();
  envejecerOtp(signRequest.id);

  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp })
    .expect(410);

  const fila = db.prepare(
    'SELECT otp_intentos FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.equal(fila.otp_intentos, 0,
    'un código vencido no es un intento fallido: no debe gastar el límite');
});

test('M1 · la respuesta NO dice que el enlace venció', async () => {
  const { app, token, signRequest, otp } = await firmaConOtp();
  envejecerOtp(signRequest.id);

  const res = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp });

  // Un 410 sin código discernible en la mini-app se muestra como "Este
  // enlace ha expirado", lo que es FALSO: el enlace sigue vivo, lo que venció
  // es el código. Por eso el código de error tiene que ser OTP_EXPIRADO.
  const err = assertJsonError(res, 'OTP_EXPIRADO');
  assert.notEqual(err.code, undefined);
  assert.equal(err.code, 'OTP_EXPIRADO');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. El flujo normal no se rompió
// ─────────────────────────────────────────────────────────────────────────────

test('M1 · un OTP vigente se acepta (el flujo normal sigue igual)', async () => {
  const { app, token, otp } = await firmaConOtp();

  const res = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp });

  assert.equal(res.status, 200, `verify-otp falló: ${JSON.stringify(res.body)}`);
  assert.equal(res.body.estado, 'OTP_VERIFIED');
});

test('M1 · un OTP vigente pero incorrecto sigue dando OTP_INVALID', async () => {
  const { app, token } = await firmaConOtp();

  const res = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: '000000' });

  assert.equal(res.status, 422);
  assertJsonError(res, 'OTP_INVALID');
});

test('M1 · un OTP que vence juste antes del TTL todavía se acepta', async () => {
  const { app, token, signRequest, otp } = await firmaConOtp();
  // 500 segundos: dentro de los 600 que promete el texto.
  envejecerOtp(signRequest.id, 500);

  const res = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp });

  assert.equal(res.status, 200, `verify-otp falló: ${JSON.stringify(res.body)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. El fallback para filas heredadas
// ─────────────────────────────────────────────────────────────────────────────

test('M1 · una fila sin fecha de envío NO se bloquea (fallback seguro)', async () => {
  const { app, token, signRequest, otp } = await firmaConOtp();
  sinFechaOtp(signRequest.id);

  const res = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp });

  assert.equal(res.status, 200,
    'sin fecha de envío no se puede calcular la expiración: no se bloquea');
  assert.equal(res.body.estado, 'OTP_VERIFIED');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. La salida: pedir un código nuevo y firmar
// ─────────────────────────────────────────────────────────────────────────────

test('M1 · tras el vencimiento, se puede pedir un código nuevo y firmar', async () => {
  const { app, token, signRequest, otp } = await firmaConOtp();
  envejecerOtp(signRequest.id);

  // 1. El código viejo ya no sirve.
  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp })
    .expect(410);

  // 2. El Trabajador pide uno nuevo.
  const resend = await request(app)
    .post(`/api/sign/${token}/resend-otp`)
    .send({});
  assert.equal(resend.status, 200, `resend falló: ${JSON.stringify(resend.body)}`);

  // El reenvío no devuelve el código en la respuesta (el correo simulado sí
  // lo guarda): se toma del buzón de dev, que es lo que hace el test del
  // reenvío que ya existía.
  const inbox = mailer.getDevInbox();
  assert.ok(inbox.length > 0, 'tiene que haber un correo con el código nuevo');
  const nuevoOtp = inbox[inbox.length - 1].otp;

  // 3. Con el código nuevo, la firma sigue adelante.
  const verify = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: nuevoOtp });
  assert.equal(verify.status, 200, `verify falló: ${JSON.stringify(verify.body)}`);
  assert.equal(verify.body.estado, 'OTP_VERIFIED');
});
