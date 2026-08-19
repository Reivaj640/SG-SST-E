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
const { PDFDocument } = require('pdf-lib');
const db = require('../../src/db/connection');
const { resetDb, makeApp, seedActiveAgreement, createSignRequestWithIdentificacion, createAcceptedConsent } = require('../helpers');
const mailer = require('../../src/services/mailer');

/**
 * Crea un PDF válido con pdf-lib para tests.
 * Antes creaba texto plano con magic bytes, pero pdf-lib
 * necesita un PDF estructuralmente correcto.
 */
async function makeValidPdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([300, 200]);
  page.drawText('Documento de prueba');
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

test('GET /s/:token: token válido → 200 con contexto público', async () => {
  resetDb();
  const { token } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  const res = await request(app).get(`/s/${token}`).set('Accept', 'application/json');
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'PENDING');
  assert.ok(res.body.id_solicitud);
  assert.equal(res.body.tipo_firma, 'presencial');
  assert.equal(res.body.identificacion_tipo, 'CC');
});

test('GET /s/:token: respuesta NO incluye secretos', async () => {
  resetDb();
  const { token } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  const res = await request(app).get(`/s/${token}`).set('Accept', 'application/json');

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
  const res = await request(app).get('/s/token_inexistente_1234567890ab').set('Accept', 'application/json');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'TOKEN_NOT_FOUND');
});

test('GET /s/:token: token expirado → 410 + estado EXPIRED', async () => {
  resetDb();
  const { token, signRequest } = await createSignRequestWithIdentificacion();

  // Forzar expiración modificando fecha_expiracion
  db.prepare(`
    UPDATE gh_firmas_electronicas
    SET fecha_expiracion = '2020-01-01T00:00:00.000000Z'
    WHERE id = ?
  `).run(signRequest.id);

  const app = makeApp();
  const res = await request(app).get(`/s/${token}`).set('Accept', 'application/json');
  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'TOKEN_EXPIRED');

  // El estado debe haberse actualizado a EXPIRED
  const row = db.prepare('SELECT estado FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.equal(row.estado, 'EXPIRED');
});

test('GET /s/:token: estado SIGNED → 410', async () => {
  resetDb();
  const { token, signRequest } = await createSignRequestWithIdentificacion();
  db.prepare(`UPDATE gh_firmas_electronicas SET estado = 'SIGNED' WHERE id = ?`).run(signRequest.id);

  const app = makeApp();
  const res = await request(app).get(`/s/${token}`).set('Accept', 'application/json');
  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'TOKEN_ALREADY_USED');
});

test('GET /s/:token: primer acceso registra evento OPENED y setea estado=OPENED (E8.1)', async () => {
  resetDb();
  const { token, signRequest } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  await request(app).get(`/s/${token}`).set('Accept', 'application/json');

  const eventos = db.prepare(`
    SELECT evento FROM gh_firma_eventos
    WHERE firma_id = ? ORDER BY id
  `).all(signRequest.id);
  // El primer evento es CREATED (del signRequestService.create)
  // El segundo debe ser OPENED
  assert.equal(eventos[eventos.length - 1].evento, 'OPENED');

  // E8.1 (fix bug): antes del fix, fecha_apertura se seteaba pero
  // estado quedaba en 'PENDING' (el estado OPENED del CHECK era zombie).
  // Ahora ambos se setean atómicamente en el mismo UPDATE.
  const row = db.prepare(`
    SELECT estado, fecha_apertura FROM gh_firmas_electronicas WHERE id = ?
  `).get(signRequest.id);
  assert.equal(row.estado, 'OPENED',
    'estado debe ser OPENED después del primer acceso (E8.1)');
  assert.ok(row.fecha_apertura, 'fecha_apertura debe estar poblada');
});

test('GET /s/:token: segundo acceso NO registra otro OPENED', async () => {
  resetDb();
  const { token, signRequest } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  await request(app).get(`/s/${token}`).set('Accept', 'application/json');
  await request(app).get(`/s/${token}`).set('Accept', 'application/json');

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
  const { token } = await createSignRequestWithIdentificacion({
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
  const { token } = await createSignRequestWithIdentificacion({
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
  const { token } = await createSignRequestWithIdentificacion();
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
  const { token } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'INVALID', numero_documento: '123' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /api/sign/:token/identify: registra eventos IDENTIFICATION_COMPLETED y OTP_SENT', async () => {
  resetDb();
  const { token, signRequest } = await createSignRequestWithIdentificacion({
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
  const { token } = await createSignRequestWithIdentificacion();
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
  const { token } = await createSignRequestWithIdentificacion();
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
  const { token } = await createSignRequestWithIdentificacion();
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
  const { token } = await createSignRequestWithIdentificacion();
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
  const { token } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  // NO hace identify antes
  const r = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: '123456' });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'INVALID_STATE_TRANSITION');
});

// =========================================================================
// POST /api/sign/:token/view-document
// GET  /api/sign/:token/document.pdf
// =========================================================================

test('POST /view-document: scroll al final → 200 DOCUMENT_VIEWED', async () => {
  resetDb();
  const { token } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  // identify + verify-otp
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });

  // view-document
  const r2 = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 47, scroll_al_final: true });

  assert.equal(r2.status, 200);
  assert.equal(r2.body.estado, 'DOCUMENT_VIEWED');
  assert.equal(r2.body.ok, true);
});

test('POST /view-document: sin scroll_al_final → 422', async () => {
  resetDb();
  const { token } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });

  const r2 = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ scroll_al_final: false });
  assert.equal(r2.status, 422);
});

test('POST /view-document: sin OTP verificado → 409', async () => {
  resetDb();
  const { token } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  const r = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ scroll_al_final: true });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'INVALID_STATE_TRANSITION');
});

test('POST /view-document: registra evento DOCUMENT_VIEWED', async () => {
  resetDb();
  const { token, signRequest } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });
  await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 60, scroll_al_final: true });

  const eventos = db.prepare(`
    SELECT evento, metadata FROM gh_firma_eventos
    WHERE firma_id = ? ORDER BY id
  `).all(signRequest.id);

  const docViewedEvent = eventos.find(e => e.evento === 'DOCUMENT_VIEWED');
  assert.ok(docViewedEvent);
  const meta = JSON.parse(docViewedEvent.metadata);
  assert.equal(meta.segundos_en_pagina, 60);
});

test('GET /document.pdf: con OTP verificado → 200 con PDF', async () => {
  resetDb();
  const { token } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });

  const r = await request(app).get(`/api/sign/${token}/document.pdf`);
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /application\/pdf/);
  assert.ok(r.body);
  assert.ok(r.body.slice(0, 5).equals(Buffer.from('%PDF-')));
});

test('GET /document.pdf: sin OTP verificado → 409', async () => {
  resetDb();
  const { token } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  const r = await request(app).get(`/api/sign/${token}/document.pdf`);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'INVALID_STATE_TRANSITION');
});

// =========================================================================
// POST /api/sign/:token/commit
// POST /api/sign/:token/reject
// =========================================================================

test('POST /commit: firma válida → 200 SIGNED + evidencia', async () => {
  resetDb();
  // Bloque E6: con agreement_version, el sign request requiere consent_id
  // vinculado a un consentimiento ACEPTADO.
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    version_acuerdo: 'v1.0',
  });
  const { token, signRequest } = await createSignRequestWithIdentificacion({ consent_id });
  console.log('DEBUG: signRequest.id =', signRequest.id, 'token =', token);
  const app = makeApp();
  // identify + verify-otp + view-document
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });
  await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ scroll_al_final: true });

  // commit
  const r2 = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });

  console.log('DEBUG: r2.status =', r2.status, 'r2.body =', r2.body);

  assert.equal(r2.status, 200);
  assert.equal(r2.body.ok, true);
  assert.equal(r2.body.estado, 'SIGNED');
  assert.ok(r2.body.evidence_hash);
  assert.equal(r2.body.evidence_hash.length, 64);
  assert.ok(r2.body.document_hash_firmado);
  assert.equal(r2.body.document_hash_firmado.length, 64);
  assert.ok(r2.body.fecha_firma);
  assert.ok(r2.body.pdf_firmado_url);
  assert.ok(r2.body.constancia_url);

  // El estado en BD debe ser SIGNED
  const row = db.prepare('SELECT estado, document_hash_firmado, evidence_hash, pdf_firmado_path, constancia_path FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  console.log('DEBUG: row =', row);
  assert.equal(row.estado, 'SIGNED');
  assert.equal(row.document_hash_firmado, r2.body.document_hash_firmado);
  assert.equal(row.evidence_hash, r2.body.evidence_hash);

  // El PDF firmado y la constancia deben existir en storage
  const storage = require('../../src/services/storage');
  assert.ok(row.pdf_firmado_path);
  assert.ok(storage.exists(row.pdf_firmado_path));
  assert.ok(row.constancia_path);
  assert.ok(storage.exists(row.constancia_path));
});

test('POST /commit: sin manifestacion_aceptada → 400', async () => {
  resetDb();
  // Bloque E6: con agreement_version, requiere consent_id
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    version_acuerdo: 'v1.0',
  });
  const { token } = await createSignRequestWithIdentificacion({ consent_id });
  const app = makeApp();
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });
  await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ scroll_al_final: true });

  const r2 = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: false });
  // Zod rechaza con 400 (literal value: expected true)
  assert.equal(r2.status, 400);
  assert.equal(r2.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /commit: sin view-document → 409', async () => {
  resetDb();
  // Bloque E6: con agreement_version, requiere consent_id
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    version_acuerdo: 'v1.0',
  });
  const { token } = await createSignRequestWithIdentificacion({ consent_id });
  const app = makeApp();
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });
  // NO view-document

  const r2 = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });
  assert.equal(r2.status, 409);
  assert.equal(r2.body.error.code, 'INVALID_STATE_TRANSITION');
});

test('POST /commit: registra eventos MANIFESTATION_RECORDED, SIGN_COMMITTED, PDF_GENERATED, COPY_SENT', async () => {
  resetDb();
  // Bloque E6: con agreement_version, requiere consent_id
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    version_acuerdo: 'v1.0',
  });
  const { token, signRequest } = await createSignRequestWithIdentificacion({ consent_id });
  const app = makeApp();
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });
  await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ scroll_al_final: true });
  await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });

  const eventos = db.prepare(`
    SELECT evento FROM gh_firma_eventos
    WHERE firma_id = ? ORDER BY id
  `).all(signRequest.id).map(e => e.evento);

  assert.ok(eventos.includes('MANIFESTATION_RECORDED'));
  assert.ok(eventos.includes('SIGN_COMMITTED'));
  assert.ok(eventos.includes('PDF_GENERATED'));
  assert.ok(eventos.includes('COPY_SENT'));
});

test('POST /commit: evidence_hash verificable (canonicalJSON)', async () => {
  resetDb();
  // Bloque E6: con agreement_version, requiere consent_id
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    version_acuerdo: 'v1.0',
  });
  const { token, signRequest } = await createSignRequestWithIdentificacion({ consent_id });
  const app = makeApp();
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });
  await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ scroll_al_final: true });
  const r2 = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });

  // Reproducir la evidencia y recalcular hash
  // (D1 fix: agreement_version; E3 fix: tipo_firma, manifestacion_voluntad_hash, ip_origen, user_agent)
  const { canonicalJSON } = require('../../src/crypto/compare');
  const { sha256 } = require('../../src/crypto/hash');
  const row = db.prepare(`
    SELECT id_solicitud, id_documento, id_trabajador, id_empresa,
           document_hash_original, document_hash_firmado,
           agreement_hash, agreement_version, identificacion_tipo,
           tipo_firma, manifestacion_voluntad_texto, ip_origen, user_agent,
           fecha_creacion, fecha_firma, version_kair
    FROM gh_firmas_electronicas WHERE id = ?
  `).get(signRequest.id);

  // E3: manifestacion_voluntad_hash se calcula desde el texto (mismo método que commit)
  const mvt = row.manifestacion_voluntad_texto;
  const mvh = sha256(mvt);

  const evidencia = {
    id_solicitud: row.id_solicitud,
    id_documento: row.id_documento,
    id_trabajador: row.id_trabajador,
    id_empresa: row.id_empresa,
    document_hash_original: row.document_hash_original,
    document_hash_firmado: row.document_hash_firmado,
    agreement_hash: row.agreement_hash,
    agreement_version: row.agreement_version,  // ← D1 fix
    identificacion_tipo: row.identificacion_tipo,
    tipo_firma: row.tipo_firma, // ← E3
    manifestacion_voluntad_hash: mvh, // ← E3
    ip_origen: row.ip_origen || null, // ← E3 (puede ser null en test sin HTTP)
    user_agent: row.user_agent || null, // ← E3 (puede ser null en test sin HTTP)
    fecha_creacion: row.fecha_creacion,
    fecha_firma: row.fecha_firma,
    version_kair: row.version_kair,
    manifestacion_voluntad_texto: mvt,
  };
  const evidenciaHash = sha256(canonicalJSON(evidencia));

  assert.equal(evidenciaHash, r2.body.evidence_hash,
    'evidence_hash debe ser reproducible por terceros con JSON canónico');
});

test('POST /commit: manifestacion_voluntad_hash se persiste (D1 fix)', async () => {
  resetDb();
  // Bloque E6: con agreement_version, requiere consent_id
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    version_acuerdo: 'v1.0',
  });
  const { token, signRequest } = await createSignRequestWithIdentificacion({ consent_id });
  const app = makeApp();
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });
  await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ scroll_al_final: true });
  await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });

  // Verificar que la columna se popula (antes era siempre NULL)
  const row = db.prepare(`
    SELECT manifestacion_voluntad_texto, manifestacion_voluntad_hash
    FROM gh_firmas_electronicas WHERE id = ?
  `).get(signRequest.id);

  const { sha256 } = require('../../src/crypto/hash');
  assert.notEqual(row.manifestacion_voluntad_hash, null,
    'manifestacion_voluntad_hash NO debe ser NULL después del commit');
  assert.equal(row.manifestacion_voluntad_hash, sha256(row.manifestacion_voluntad_texto),
    'manifestacion_voluntad_hash debe ser SHA-256 del texto');
  assert.equal(row.manifestacion_voluntad_hash.length, 64);
  assert.match(row.manifestacion_voluntad_hash, /^[0-9a-f]{64}$/);
});

// =================================================================
// Bloque D2 — Re-validar Acuerdo en view y commit
// =================================================================

test('POST /view-document: Acuerdo desactivado → 409 AGREEMENT_VERSION_NO_LONGER_ACTIVE', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0', texto: 'texto v1' });
  const { token } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  // identify + verify-otp (para llegar a view-document)
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });

  // Desactivar v1.0 publicando v2.0 como activa
  const agreementService = require('../../src/services/agreement');
  agreementService.createVersion({ version: 'v2.0', texto: 'texto v2', activa: true });

  // view-document debe ser rechazado con 409
  const r2 = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ scroll_al_final: true });
  assert.equal(r2.status, 409);
  assert.equal(r2.body.error.code, 'AGREEMENT_VERSION_NO_LONGER_ACTIVE');
  assert.equal(r2.body.error.details.sign_request_version, 'v1.0');
  assert.equal(r2.body.error.details.active_version, 'v2.0');
});

test('POST /commit: Acuerdo desactivado → 409 AGREEMENT_VERSION_NO_LONGER_ACTIVE', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0', texto: 'texto v1' });
  const { token } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });
  // llegar a DOCUMENT_VIEWED
  await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ scroll_al_final: true });

  // Desactivar v1.0
  const agreementService = require('../../src/services/agreement');
  agreementService.createVersion({ version: 'v2.0', texto: 'texto v2', activa: true });

  // commit debe ser rechazado con 409
  const r2 = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });
  assert.equal(r2.status, 409);
  assert.equal(r2.body.error.code, 'AGREEMENT_VERSION_NO_LONGER_ACTIVE');
  assert.equal(r2.body.error.details.sign_request_version, 'v1.0');
  assert.equal(r2.body.error.details.active_version, 'v2.0');
});

test('POST /commit: sign request legacy (agreement_version=NULL) pasa el helper sin error (D2)', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0', texto: 'texto v1' });
  const { token, signRequest } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });
  await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ scroll_al_final: true });

  // Simular sign request legacy: poner agreement_version=NULL directamente
  db.prepare('UPDATE gh_firmas_electronicas SET agreement_version = NULL WHERE id = ?')
    .run(signRequest.id);

  // commit debe proceder (helper skip para legacy)
  const r2 = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });
  assert.equal(r2.status, 200);
  assert.equal(r2.body.estado, 'SIGNED');
});

test('POST /reject: rechazo válido → 200 REJECTED', async () => {
  resetDb();
  const { token, signRequest } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });

  const r2 = await request(app)
    .post(`/api/sign/${token}/reject`)
    .send({ motivo: 'No estoy de acuerdo con la cláusula de exclusividad' });

  assert.equal(r2.status, 200);
  assert.equal(r2.body.estado, 'REJECTED');

  const row = db.prepare('SELECT estado, motivo_rechazo FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.equal(row.estado, 'REJECTED');
  assert.equal(row.motivo_rechazo, 'No estoy de acuerdo con la cláusula de exclusividad');
});

test('POST /reject: rechazo sin motivo → 200 (motivo opcional)', async () => {
  resetDb();
  const { token } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  const r = await request(app)
    .post(`/api/sign/${token}/reject`)
    .send({});
  assert.equal(r.status, 200);
  assert.equal(r.body.estado, 'REJECTED');
});

test('POST /reject: después de firmado → 409', async () => {
  resetDb();
  // Bloque E6: con agreement_version, requiere consent_id
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    version_acuerdo: 'v1.0',
  });
  const { token } = await createSignRequestWithIdentificacion({ consent_id });
  const app = makeApp();
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_documento: 'CC', numero_documento: '1234567890' });
  await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });
  await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ scroll_al_final: true });
  await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });

  // Intentar rechazar después de firmado
  const r2 = await request(app)
    .post(`/api/sign/${token}/reject`)
    .send({ motivo: 'cambio de opinión' });
  assert.equal(r2.status, 409);
  assert.equal(r2.body.error.code, 'INVALID_STATE_TRANSITION');
});

// =========================================================================
// GET /s/:token — bifurcación por Accept (HTML vs JSON)
// Mini-app estática servida bajo /s
// =========================================================================

test('GET /s/:token: con Accept text/html → sirve la mini-app HTML (no JSON)', async () => {
  resetDb();
  const { token } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  const res = await request(app)
    .get(`/s/${token}`)
    .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
  assert.equal(res.status, 200);
  // Content-type debe ser HTML, no JSON
  assert.match(res.headers['content-type'], /text\/html/);
  // Debe contener el HTML de la mini-app
  assert.ok(res.text.indexOf('K+AIR') !== -1, 'Debe contener el header de la mini-app');
  assert.ok(res.text.indexOf('Firma electrónica') !== -1, 'Debe contener el título');
  // No debe contener el JSON con secretos
  assert.equal(res.body.token_hash, undefined);
  assert.equal(res.body.identificacion_numero_hash, undefined);
});

test('GET /s/:token: con Accept text/html → NO registra evento OPENED (bifurcación temprana)', async () => {
  resetDb();
  const { token, signRequest } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  await request(app)
    .get(`/s/${token}`)
    .set('Accept', 'text/html');

  const eventos = db.prepare(`
    SELECT evento FROM gh_firma_eventos
    WHERE firma_id = ? AND evento = 'OPENED'
  `).all(signRequest.id);
  assert.equal(eventos.length, 0,
    'Pedir HTML no debe registrar OPENED (eso ocurre cuando el JS pide JSON)');
});

test('GET /s/:token: con Accept text/html para token inválido → 404 HTML', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .get('/s/token_inexistente_1234567890ab')
    .set('Accept', 'text/html');
  // Token inválido: el handler bifurca a HTML antes de evaluar, pero el
  // handler solo bifurca si el handler se ejecuta (es decir, no se intercepta
  // antes por el static). El static no captura porque /s/TOKEN no es un
  // archivo. Entonces el handler se ejecuta, bifurca a HTML, y sirve el index.
  // El error 404/410 solo se devuelve con Accept JSON.
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
});

test('GET /s/app.js (static) → 200 con JS', async () => {
  const app = makeApp();
  const res = await request(app).get('/s/app.js');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /application\/javascript/);
  // Debe contener código de la mini-app
  assert.ok(res.text.indexOf('apiFetch') !== -1, 'Debe contener la función apiFetch');
});

test('GET /s/styles.css (static) → 200 con CSS', async () => {
  const app = makeApp();
  const res = await request(app).get('/s/styles.css');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/css/);
  // Debe contener selectores de la mini-app
  assert.ok(res.text.indexOf('--color-primary') !== -1, 'Debe contener la variable CSS del tema');
});

test('GET /s/index.html (static) → 200 con HTML', async () => {
  const app = makeApp();
  const res = await request(app).get('/s/index.html');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.ok(res.text.indexOf('screen-identify') !== -1, 'Debe contener la pantalla identify');
});
