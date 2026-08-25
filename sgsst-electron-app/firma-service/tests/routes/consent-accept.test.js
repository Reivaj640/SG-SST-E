/**
 * Tests del Bloque E6.5: POST /api/sign/:token/consent/accept
 *
 * Cubre:
 * - Happy path: sign request en OTP_VERIFIED con consentimiento pending
 * - Happy path: sign request en DOCUMENT_VIEWED
 * - Idempotencia (1ª vs 2ª llamada) — evento único en gh_firma_eventos
 * - Idempotencia con consentimiento ya aceptado (vía verifyOtp)
 * - Estados tempranos (PENDING, OTP_SENT) → 409 CONSENT_ACCEPT_TOO_EARLY
 * - Estado terminal (REJECTED) → 410 TOKEN_ALREADY_USED
 * - Sign request sin consent_id (legacy) → 409 CONSENT_REQUIRED
 * - Consent version_mismatch → 409 CONSENT_VERSION_MISMATCH
 * - Consent worker_mismatch → 409 CONSENT_WORKER_MISMATCH
 * - Consent company_mismatch → 409 CONSENT_COMPANY_MISMATCH
 * - Consent en estado LOCKED → 409 CONSENT_LOCKED
 * - Consent con estado inconsistente → 409 CONSENT_INCONSISTENT_STATE
 * - Consent inexistente → 404 CONSENT_NOT_FOUND
 * - Token inválido → 404 TOKEN_NOT_FOUND
 *
 * Decisiones validadas:
 * - Lista INEQUÍVOCA de estados permitidos: [OTP_VERIFIED, DOCUMENT_VIEWED]
 * - WHERE clause en UPDATE: `manifestacion_aceptada = 0 AND estado = 'OTP_PENDING'`
 * - Cross-validate (trabajador, empresa, version) ANTES del UPDATE
 * - Evento CONSENT_ACCEPTED se registra SOLO en la 1ª aceptación
 *   (idempotente: true → sin evento nuevo)
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const db = require('../../src/db/connection');
const { hashToken } = require('../../src/crypto/token');
const {
  resetDb, makeApp, seedActiveAgreement,
  createSignRequestWithIdentificacion, createPendingConsent, createAcceptedConsent,
  TEST_API_KEY,
} = require('../helpers');

const HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };

/**
 * Recorre el flujo público hasta un estado deseado.
 *
 * @param {string} token
 * @param {string} identificacion_numero
 * @param {'OTP_VERIFIED' | 'DOCUMENT_VIEWED'} targetEstado
 */
async function recorrerFlujo(token, identificacion_numero, targetEstado) {
  const app = makeApp();

  // 1. identify
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: identificacion_numero });
  if (r1.status !== 200) {
    throw new Error(`identify: status=${r1.status} body=${JSON.stringify(r1.body)}`);
  }

  // 2. verify-otp
  const r2 = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });
  if (r2.status !== 200) {
    throw new Error(`verify-otp: status=${r2.status} body=${JSON.stringify(r2.body)}`);
  }
  if (targetEstado === 'OTP_VERIFIED') return;

  // 3. view-document
  const r3 = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 30, scroll_al_final: true });
  if (r3.status !== 200) {
    throw new Error(`view-document: status=${r3.status} body=${JSON.stringify(r3.body)}`);
  }
}

/**
 * Crea un sign request + consentimiento pending, todo listo para probar
 * POST /api/sign/:token/consent/accept desde un estado dado.
 *
 * Por defecto deja el sign request en OTP_VERIFIED.
 */
async function setupOtpVerified({
  id_trabajador = '1234567890',
  id_empresa = '900123456',
  identificacion_numero = '1234567890',
} = {}) {
  const { consent_id } = await createPendingConsent({
    id_trabajador, id_empresa,
  });
  const { token } = await createSignRequestWithIdentificacion({
    id_trabajador, id_empresa,
    identificacion_numero,
    consent_id,
  });
  await recorrerFlujo(token, identificacion_numero, 'OTP_VERIFIED');
  return { token, consent_id };
}

async function setupDocumentViewed(opts = {}) {
  const identificacion_numero = opts.identificacion_numero || '1234567890';
  const { token, consent_id } = await setupOtpVerified({ ...opts, identificacion_numero });
  await recorrerFlujo(token, identificacion_numero, 'DOCUMENT_VIEWED');
  return { token, consent_id };
}

// =========================================================================
// Happy path
// =========================================================================

test('POST /consent/accept: sign request en OTP_VERIFIED + consent pending → 200', async () => {
  resetDb();
  const { token, consent_id } = await setupOtpVerified();

  const app = makeApp();
  const res = await request(app).post(`/api/sign/${token}/consent/accept`);

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.idempotente, false);
  assert.equal(res.body.consent_id, consent_id);
  assert.equal(res.body.manifestacion_aceptada, true);
  assert.equal(res.body.estado, 'ACCEPTED');
  assert.equal(res.body.version_acuerdo, 'v1.0');
  assert.ok(res.body.fecha_aceptacion, 'fecha_aceptacion debe estar poblada');

  // Verificar en BD
  const row = db.prepare(
    'SELECT manifestacion_aceptada, estado FROM gh_consentimientos_firma WHERE id = ?'
  ).get(consent_id);
  assert.equal(row.manifestacion_aceptada, 1);
  assert.equal(row.estado, 'ACCEPTED');
});

test('POST /consent/accept: sign request en DOCUMENT_VIEWED → 200 (también permitido)', async () => {
  resetDb();
  const { token, consent_id } = await setupDocumentViewed();

  const app = makeApp();
  const res = await request(app).post(`/api/sign/${token}/consent/accept`);

  assert.equal(res.status, 200);
  assert.equal(res.body.idempotente, false);
  assert.equal(res.body.manifestacion_aceptada, true);
});

test('POST /consent/accept: registra evento CONSENT_ACCEPTED con metadata completa', async () => {
  resetDb();
  const { token, consent_id } = await setupOtpVerified();

  const app = makeApp();
  await request(app).post(`/api/sign/${token}/consent/accept`);

  // Buscar el evento
  const eventos = db.prepare(`
    SELECT evento, metadata, id_actor FROM gh_firma_eventos
    WHERE evento = 'CONSENT_ACCEPTED'
  `).all();

  assert.equal(eventos.length, 1, 'debe haber exactamente UN evento CONSENT_ACCEPTED');
  const ev = eventos[0];
  assert.equal(ev.id_actor, 'trabajador');

  const meta = JSON.parse(ev.metadata);
  assert.equal(meta.id_consentimiento, consent_id);
  assert.equal(meta.version_acuerdo, 'v1.0');
  assert.ok(meta.hash_texto_acuerdo, 'hash_texto_acuerdo debe estar presente');
  assert.equal(meta.idempotente, false);
  assert.ok(meta.id_solicitud, 'id_solicitud debe estar presente');
});

// =========================================================================
// Idempotencia
// =========================================================================

test('POST /consent/accept: 2ª llamada → 200 idempotente:true + sin nuevo evento', async () => {
  resetDb();
  const { token, consent_id } = await setupOtpVerified();

  const app = makeApp();
  // 1ª llamada
  const r1 = await request(app).post(`/api/sign/${token}/consent/accept`);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.idempotente, false);

  // 2ª llamada
  const r2 = await request(app).post(`/api/sign/${token}/consent/accept`);
  assert.equal(r2.status, 200);
  assert.equal(r2.body.idempotente, true, '2ª llamada debe ser idempotente');
  assert.equal(r2.body.manifestacion_aceptada, true);
  assert.equal(r2.body.consent_id, consent_id);

  // Solo UN evento CONSENT_ACCEPTED
  const eventos = db.prepare(
    "SELECT id FROM gh_firma_eventos WHERE evento = 'CONSENT_ACCEPTED'"
  ).all();
  assert.equal(eventos.length, 1, 'debe haber UN solo evento CONSENT_ACCEPTED (idempotente)');
});

test('POST /consent/accept: idempotente cuando consent ya estaba aceptado vía verifyOtp', async () => {
  resetDb();
  // Crear consent ya aceptado (vía /internal/consentimientos/verify-otp)
  const { consent_id } = await createAcceptedConsent();
  // Sign request con ese consent_id, llevado a OTP_VERIFIED
  const { token } = await createSignRequestWithIdentificacion({
    consent_id,
  });
  await recorrerFlujo(token, '1234567890', 'OTP_VERIFIED');

  const app = makeApp();
  const res = await request(app).post(`/api/sign/${token}/consent/accept`);

  assert.equal(res.status, 200);
  assert.equal(res.body.idempotente, true, 'consent ya aceptado debe ser idempotente');
  assert.equal(res.body.manifestacion_aceptada, true);
  assert.equal(res.body.estado, 'ACCEPTED');

  // No se debe crear un nuevo evento (el evento que importa es verifyOtp,
  // no CONSENT_ACCEPTED — la aceptación ya fue registrada por el flujo OTP).
  const eventos = db.prepare(
    "SELECT id FROM gh_firma_eventos WHERE evento = 'CONSENT_ACCEPTED'"
  ).all();
  assert.equal(eventos.length, 0,
    'no se debe crear evento CONSENT_ACCEPTED si el consent ya estaba aceptado');
});

// =========================================================================
// Estados prematuros
// =========================================================================

test('POST /consent/accept: estado PENDING (sin identify) → 409 CONSENT_ACCEPT_TOO_EARLY', async () => {
  resetDb();
  const { consent_id } = await createPendingConsent();
  const { token } = await createSignRequestWithIdentificacion({ consent_id });
  // No llamamos identify → sign request queda en PENDING

  const app = makeApp();
  const res = await request(app).post(`/api/sign/${token}/consent/accept`);

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CONSENT_ACCEPT_TOO_EARLY');
  assert.equal(res.body.error.details.current_state, 'PENDING');
  assert.deepEqual(res.body.error.details.required_states, ['OTP_VERIFIED', 'DOCUMENT_VIEWED']);
  assert.ok(res.body.error.details.id_solicitud, 'id_solicitud debe estar en details');

  // El consent NO debe haberse aceptado
  const row = db.prepare(
    'SELECT manifestacion_aceptada, estado FROM gh_consentimientos_firma WHERE id = ?'
  ).get(consent_id);
  assert.equal(row.manifestacion_aceptada, 0, 'consent NO debe aceptarse prematuramente');
  assert.equal(row.estado, 'OTP_PENDING');
});

test('POST /consent/accept: estado OTP_SENT (post-identify, pre-verify-otp) → 409', async () => {
  resetDb();
  const { consent_id } = await createPendingConsent();
  const { token } = await createSignRequestWithIdentificacion({ consent_id });

  const app = makeApp();
  // Solo identify (transiciona a OTP_SENT)
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: '1234567890' });
  assert.equal(r1.status, 200);

  // Intentar accept
  const res = await request(app).post(`/api/sign/${token}/consent/accept`);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CONSENT_ACCEPT_TOO_EARLY');
  assert.equal(res.body.error.details.current_state, 'OTP_SENT');
});

test('POST /consent/accept: estado REJECTED (terminal) → 410 TOKEN_ALREADY_USED', async () => {
  resetDb();
  const { token, consent_id } = await setupOtpVerified();

  const app = makeApp();
  // Rechazar el sign request
  const rReject = await request(app)
    .post(`/api/sign/${token}/reject`)
    .send({ motivo: 'test' });
  assert.equal(rReject.status, 200);

  // Intentar accept
  const res = await request(app).post(`/api/sign/${token}/consent/accept`);
  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'TOKEN_ALREADY_USED');
});

// =========================================================================
// Sin consent_id (legacy sin Acuerdo)
// =========================================================================

test('POST /consent/accept: sign request sin consent_id (legacy) → 409 CONSENT_REQUIRED', async () => {
  resetDb();
  // Crear sign request legacy (agreement_version=NULL implica sin consent)
  // Lo creamos vía la API sin consent_id y luego forzamos agreement_version=NULL
  // directamente en BD (la API no permite crearlo sin agreement_version).
  const { token, signRequest } = await createSignRequestWithIdentificacion();
  db.prepare(
    'UPDATE gh_firmas_electronicas SET agreement_version = NULL, consent_id = NULL WHERE id = ?'
  ).run(signRequest.id);

  // El sign request debe pasar por identify+verify-otp para llegar a OTP_VERIFIED
  await recorrerFlujo(token, '1234567890', 'OTP_VERIFIED');

  const app = makeApp();
  const res = await request(app).post(`/api/sign/${token}/consent/accept`);

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CONSENT_REQUIRED');
});

// =========================================================================
// Validaciones cruzadas
// =========================================================================

test('POST /consent/accept: consent de otro version_acuerdo → 409 CONSENT_VERSION_MISMATCH', async () => {
  resetDb();
  // Sembrar Acuerdo v1.0 activo
  seedActiveAgreement({ version: 'v1.0' });
  // Crear consent con version v1.1 (NO activa)
  // Pero como agreementService.createVersion requiere activa=1, no podemos
  // crear otra activa. En su lugar, creamos un consent con version_acuerdo
  // que NO coincida con la del sign request (v1.0).
  // Truco: el consent puede tener version 'v1.0' pero el sign request también,
  // así que vamos a forzar directamente via DB.
  const { consent_id } = await createPendingConsent({ version_acuerdo: 'v1.0' });
  // Forzar que el consent tenga otra version_acuerdo
  db.prepare(
    'UPDATE gh_consentimientos_firma SET version_acuerdo = ? WHERE id = ?'
  ).run('v2.0', consent_id);

  // Crear sign request con v1.0 (el Acuerdo activo)
  const { token } = await createSignRequestWithIdentificacion({ consent_id });
  await recorrerFlujo(token, '1234567890', 'OTP_VERIFIED');

  const app = makeApp();
  const res = await request(app).post(`/api/sign/${token}/consent/accept`);

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CONSENT_VERSION_MISMATCH');
});

test('POST /consent/accept: consent de otro trabajador → 409 CONSENT_WORKER_MISMATCH', async () => {
  resetDb();
  const { consent_id } = await createPendingConsent({ id_trabajador: '9999999999' });
  const { token } = await createSignRequestWithIdentificacion({
    consent_id, id_trabajador: '1234567890',
  });
  await recorrerFlujo(token, '1234567890', 'OTP_VERIFIED');

  const app = makeApp();
  const res = await request(app).post(`/api/sign/${token}/consent/accept`);

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CONSENT_WORKER_MISMATCH');
});

test('POST /consent/accept: consent de otra empresa → 409 CONSENT_COMPANY_MISMATCH', async () => {
  resetDb();
  const { consent_id } = await createPendingConsent({ id_empresa: '900999999' });
  const { token } = await createSignRequestWithIdentificacion({
    consent_id, id_empresa: '900123456',
  });
  await recorrerFlujo(token, '1234567890', 'OTP_VERIFIED');

  const app = makeApp();
  const res = await request(app).post(`/api/sign/${token}/consent/accept`);

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CONSENT_COMPANY_MISMATCH');
});

// =========================================================================
// Estados del consentimiento
// =========================================================================

test('POST /consent/accept: consent en estado LOCKED → 409 CONSENT_LOCKED', async () => {
  resetDb();
  // Setup completo con token
  const { token, consent_id } = await setupOtpVerified();

  // Forzar estado LOCKED
  db.prepare(
    'UPDATE gh_consentimientos_firma SET estado = ? WHERE id = ?'
  ).run('OTP_LOCKED', consent_id);

  const app = makeApp();
  const res = await request(app).post(`/api/sign/${token}/consent/accept`);

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CONSENT_LOCKED');

  // El estado del consent NO debe cambiarse
  const row = db.prepare(
    'SELECT manifestacion_aceptada, estado FROM gh_consentimientos_firma WHERE id = ?'
  ).get(consent_id);
  assert.equal(row.manifestacion_aceptada, 0);
  assert.equal(row.estado, 'OTP_LOCKED');
});

test('POST /consent/accept: consent con estado inconsistente → 409 CONSENT_INCONSISTENT_STATE', async () => {
  resetDb();
  const { token, consent_id } = await setupOtpVerified();

  // Forzar estado inconsistente: manifestacion_aceptada=1 pero estado=OTP_PENDING
  // (NO corregimos silenciosamente, debe rechazarse con error específico)
  db.prepare(`
    UPDATE gh_consentimientos_firma
    SET manifestacion_aceptada = 1, estado = 'OTP_PENDING'
    WHERE id = ?
  `).run(consent_id);

  const app = makeApp();
  const res = await request(app).post(`/api/sign/${token}/consent/accept`);

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CONSENT_INCONSISTENT_STATE');
  assert.equal(res.body.error.details.manifestacion_aceptada, 1);
  assert.equal(res.body.error.details.estado, 'OTP_PENDING');
});

test('POST /consent/accept: signRequest.consent_id apunta a consent inexistente → 404', async () => {
  resetDb();
  const { token } = await createSignRequestWithIdentificacion({
    consent_id: 999999,  // No existe
  });
  await recorrerFlujo(token, '1234567890', 'OTP_VERIFIED');

  const app = makeApp();
  const res = await request(app).post(`/api/sign/${token}/consent/accept`);

  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'CONSENT_NOT_FOUND');
});

// =========================================================================
// Errores de transporte
// =========================================================================

test('POST /consent/accept: token inválido → 404 TOKEN_NOT_FOUND', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app).post('/api/sign/token_invalido_xxxxxxxxxxxxxx/consent/accept');

  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'TOKEN_NOT_FOUND');
});
