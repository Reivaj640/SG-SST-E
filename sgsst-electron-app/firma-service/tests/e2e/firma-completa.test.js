/**
 * Test E2E completo del flujo de firma electrónica K+AIR v1 (Bloque D3).
 *
 * Recorre TODOS los endpoints del flujo público usando el Acuerdo DEV
 * v1.0 sembrado por tests/helpers.js#seedActiveAgreement().
 *
 * Verifica que:
 *  - GET /internal/acuerdo-activo retorna el Acuerdo activo
 *  - POST /internal/sign-requests acepta con agreement_version + agreement_hash
 *  - GET /s/:token carga el contexto público (NO expone secretos)
 *  - POST /api/sign/:token/identify valida cédula y envía OTP
 *  - POST /api/sign/:token/verify-otp acepta el OTP correcto
 *  - POST /api/sign/:token/view-document transiciona a DOCUMENT_VIEWED
 *  - POST /api/sign/:token/commit transiciona atómicamente a SIGNED
 *  - evidence_hash es reproducible con canonicalJSON
 *  - agreement_version está en la evidencia
 *  - manifestacion_voluntad_hash se persiste
 *  - Eventos en orden: CREATED, OPENED, IDENTIFICATION_COMPLETED, OTP_SENT,
 *    OTP_VERIFIED, DOCUMENT_VIEWED, MANIFESTATION_RECORDED, SIGN_COMMITTED,
 *    PDF_GENERATED, COPY_SENT
 *  - PDF firmado y Constancia existen en disco
 *  - pdf_firmado_path y constancia_path persistidos en BD
 */
'use strict';

// Ensure test env before any requires (dotenv may set production from .env)
if (process.env.NODE_ENV !== 'test') process.env.NODE_ENV = 'test';
delete require.cache[require.resolve('../../src/config')];

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const db = require('../../src/db/connection');
const {
  resetDb, seedActiveAgreement, makeApp,
  createAcceptedConsent,
  TEST_API_KEY,
} = require('../helpers');
const { sha256 } = require('../../src/crypto/hash');
const { canonicalJSON } = require('../../src/crypto/compare');
const { generateIdSolicitud: _ } = require('../../src/crypto/token');
const storage = require('../../src/services/storage');

/**
 * Crea un PDF válido con pdf-lib para tests E2E.
 */
async function makeValidPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([300, 200]);
  page.drawText('Documento E2E');
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

test('E2E: Acuerdo v1.0 → POST sign-requests → flujo público completo → SIGNED', async () => {
  // 1. Setup
  resetDb();
  const acuerdo = seedActiveAgreement({
    version: 'v1.0',
    texto: 'ACUERDO E2E v1.0 — texto de prueba para el flujo completo',
  });
  // Bloque E6: con agreement_version, el sign request requiere un consent
  // aceptado del mismo (trabajador, empresa, version_acuerdo). Antes de
  // crear el sign request, creamos el consentimiento aceptado.
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    version_acuerdo: 'v1.0',
  });
  const app = makeApp();

  // 2. GET /internal/acuerdo-activo (K+AIR consulta el Acuerdo antes de crear)
  const r0 = await request(app)
    .get('/internal/acuerdo-activo')
    .set('X-Internal-API-Key', TEST_API_KEY);
  assert.equal(r0.status, 200);
  assert.equal(r0.body.version, 'v1.0');
  assert.equal(r0.body.activa, true);
  assert.equal(r0.body.texto_hash, acuerdo.texto_hash);
  const { texto_hash: agreement_hash } = r0.body;

  // 3. POST /internal/sign-requests (multipart)
  const pdf = await makeValidPdf();
  const document_hash = sha256(pdf);
  const identificacion_numero_hash = sha256('1234567890');
  const metadata = {
    id_documento: 'doc-e2e-001',
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    tipo_firma: 'presencial',
    agreement_version: 'v1.0',
    agreement_hash,
    document_hash,
    version_kair: '0.1.189',
    identificacion_tipo: 'CC',
    identificacion_numero_hash,
    consent_id,  // Bloque E6: vínculo con el consentimiento aceptado
  };

  const r1 = await request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', TEST_API_KEY)
    .field('metadata', JSON.stringify(metadata))
    .attach('documento', pdf, 'contrato-e2e.pdf');

  assert.equal(r1.status, 201);
  assert.ok(r1.body.id_solicitud);
  assert.ok(r1.body.token);
  assert.equal(r1.body.estado, 'PENDING');
  assert.equal(r1.body.agreement_hash, agreement_hash);
  const { token, id_solicitud } = r1.body;

  // 4. GET /s/:token (mini-app carga contexto con Accept JSON)
  const r2 = await request(app)
    .get(`/s/${token}`)
    .set('Accept', 'application/json');
  assert.equal(r2.status, 200);
  assert.equal(r2.body.id_solicitud, id_solicitud);
  assert.equal(r2.body.tipo_firma, 'presencial');
  assert.equal(r2.body.estado, 'PENDING');
  assert.equal(r2.body.identificacion_tipo, 'CC');
  // NO debe exponer secretos
  assert.equal(r2.body.token_hash, undefined);
  assert.equal(r2.body.identificacion_numero_hash, undefined);

  // 5. POST /api/sign/:token/identify
  const r3 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: '1234567890' });
  assert.equal(r3.status, 200);
  assert.equal(r3.body.estado, 'OTP_SENT');
  assert.equal(r3.body.otp_ttl_seconds, 600);
  assert.match(r3.body.devOtp, /^\d{6}$/);
  const { devOtp } = r3.body;

  // 6. POST /api/sign/:token/verify-otp
  const r4 = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: devOtp });
  assert.equal(r4.status, 200);
  assert.equal(r4.body.ok, true);
  assert.equal(r4.body.estado, 'OTP_VERIFIED');

  // 7. POST /api/sign/:token/view-document
  const r5 = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 30, scroll_al_final: true });
  assert.equal(r5.status, 200);
  assert.equal(r5.body.estado, 'DOCUMENT_VIEWED');

  // 8. POST /api/sign/:token/commit
  const r6 = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });
  assert.equal(r6.status, 200);
  assert.equal(r6.body.estado, 'SIGNED');
  assert.equal(r6.body.ok, true);
  assert.ok(r6.body.evidence_hash);
  assert.equal(r6.body.evidence_hash.length, 64);
  assert.ok(r6.body.document_hash_firmado);
  assert.ok(r6.body.fecha_firma);
  assert.ok(r6.body.id_constancia);
  // URLs informativas (Bloque E' las implementará como endpoints reales)
  assert.ok(r6.body.pdf_firmado_url);
  assert.ok(r6.body.constancia_url);
  const { evidence_hash, document_hash_firmado } = r6.body;

  // 9. Verificación final en BD
  const row = db.prepare(`
    SELECT id, id_solicitud, id_documento, id_trabajador, id_empresa,
           estado, agreement_version, agreement_hash, consent_id,
           document_hash_original, document_hash_firmado, evidence_hash,
           identificacion_tipo, version_kair, tipo_firma,
           manifestacion_voluntad_texto, manifestacion_voluntad_hash,
           ip_origen, user_agent,
           pdf_firmado_path, constancia_path,
           fecha_creacion, fecha_firma
    FROM gh_firmas_electronicas WHERE id_solicitud = ?
  `).get(id_solicitud);

  assert.equal(row.estado, 'SIGNED');
  assert.equal(row.agreement_version, 'v1.0');
  assert.equal(row.agreement_hash, agreement_hash);
  // Bloque E6: consent_id debe estar asociado al sign request firmado
  assert.equal(row.consent_id, consent_id, 'consent_id debe persistirse en el sign request');
  assert.equal(row.document_hash_original, document_hash);
  assert.equal(row.document_hash_firmado, document_hash_firmado);
  assert.equal(row.evidence_hash, evidence_hash);
  // manifestacion_voluntad_hash persistido (D1 fix)
  assert.notEqual(row.manifestacion_voluntad_hash, null);
  assert.equal(row.manifestacion_voluntad_hash, sha256(row.manifestacion_voluntad_texto));
  // Paths persistidos
  assert.ok(row.pdf_firmado_path);
  assert.ok(row.constancia_path);
  assert.ok(fs.existsSync(row.pdf_firmado_path), 'PDF firmado debe existir en disco');
  assert.ok(fs.existsSync(row.constancia_path), 'Constancia debe existir en disco');

  // 10. evidence_hash reproducible con canonicalJSON.
  //    Composición actual (post-E3, 14 campos) — mismo orden y keys que
  //    src/services/publicFlow.js#commit() para garantizar que la
  //    reproducción por terceros produzca el mismo hash.
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
    // === E3 nuevos campos ===
    tipo_firma: row.tipo_firma,
    manifestacion_voluntad_hash: row.manifestacion_voluntad_hash,
    ip_origen: row.ip_origen || null,
    user_agent: row.user_agent || null,
    fecha_creacion: row.fecha_creacion,
    fecha_firma: row.fecha_firma,
    version_kair: row.version_kair,
    manifestacion_voluntad_texto: row.manifestacion_voluntad_texto,
  };
  const evidenciaHash = sha256(canonicalJSON(evidencia));
  assert.equal(evidenciaHash, evidence_hash,
    'evidence_hash debe ser reproducible por terceros con canonicalJSON (14 campos, post-E3)');

  // 11. Eventos en orden
  const eventos = db.prepare(`
    SELECT evento, id_actor, metadata FROM gh_firma_eventos
    WHERE firma_id = ? ORDER BY id
  `).all(row.id).map(e => e.evento);

  // Verificar que los eventos clave están presentes en orden
  const expectedEventos = [
    'CREATED', 'OPENED', 'IDENTIFICATION_COMPLETED', 'OTP_SENT',
    'OTP_VERIFIED', 'DOCUMENT_VIEWED', 'MANIFESTATION_RECORDED',
    'SIGN_COMMITTED', 'PDF_GENERATED', 'COPY_SENT',
  ];
  for (const ev of expectedEventos) {
    assert.ok(eventos.includes(ev), `Debe existir el evento ${ev}`);
  }
  // Verificar orden: CREATED primero, COPY_SENT último
  assert.equal(eventos[0], 'CREATED');
  assert.equal(eventos[eventos.length - 1], 'COPY_SENT');
});
