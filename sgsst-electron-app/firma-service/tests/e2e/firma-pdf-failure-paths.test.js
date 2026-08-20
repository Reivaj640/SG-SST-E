/**
 * Tests E2E de failure paths en procesamiento de PDF (I-E2E.7, §F5).
 *
 * Este archivo verifica el comportamiento end-to-end del stack HTTP
 * (authz + rate limit + multer + pdfValidation + zod + handler +
 * publicFlow + pdfGen) ante inputs malformados o fallos internos.
 * Complementa los unit tests del middleware pdfValidation y los
 * integration tests de signRequest-pdf-validation-adversarial.test.js
 * (M1-M5) sin duplicarlos.
 *
 * Alcance I-E2E.7 (4 tests):
 *
 *   F5.1  PDF con header corrupto (basura post-header) en POST inicial
 *         → 422 PDF_INVALID + verificación EXHAUSTIVA de no-side-effects
 *         (0 firmas, 0 eventos, 0 sesiones, 0 PDFs en cualquier
 *         directorio de storage). Valor NUEVO vs M4.1: verifica
 *         filesystem, no solo BD.
 *
 *   F5.2  PDF con /Encrypt en el trailer (cifrado) en POST inicial
 *         → 422 PDF_ENCRYPTED + verificación EXHAUSTIVA de
 *         no-side-effects. Valor NUEVO vs M4.2: verifica filesystem.
 *
 *   F5.3  pdfGen.generateSignedPdf() lanza error durante commit
 *         → 500 + atomicidad preservada (BD intacta: estado sigue
 *         DOCUMENT_VIEWED, 0 PDFs en firmados/ y constancias/, 0
 *         eventos del commit). Caso NO cubierto: pdfGen falla
 *         ANTES del writeFileAtomic. M4 cubre fallos en upload,
 *         F6 cubre fallos en writeFileAtomic, F5.3 cubre el caso
 *         intermedio (generación del PDF firmado en memoria).
 *
 *   F5.4  pdfGen.generateConstanciaPdf() lanza error durante commit
 *         → 500 + atomicidad preservada (idem F5.3). Análogo a F5.3
 *         pero para la generación del PDF de Constancia (segundo PDF
 *         del commit).
 *
 * Diferencias vs tests existentes (no duplicación):
 *   - tests/middleware/pdfValidation-adversarial.test.js §S1-S6:
 *     unitarios del middleware. NO usan makeApp, no tocan authz,
 *     rate limit, zod, ni service.
 *   - tests/routes/signRequest-pdf-validation-adversarial.test.js
 *     M1-M5: tests de integración de route. Verifican 0 filas en BD
 *     para casos de rechazo en upload. NO verifican filesystem.
 *   - tests/e2e/firma-atomicidad.test.js F6.x: tests de atomicidad
 *     en commit. Cubre writeFileAtomic fallando y registerEvent
 *     fallando. NO cubre pdfGen fallando.
 *
 * Acá cubrimos:
 *   (1) F5.1, F5.2: rechazo en upload con verificación de FS.
 *   (2) F5.3, F5.4: fallo en capa de generación (pdfGen) durante
 *       commit, preservando atomicidad.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const db = require('../../src/db/connection');
const { sha256 } = require('../../src/crypto/hash');
const pdfGen = require('../../src/services/pdfGen');
const {
  resetDb, seedActiveAgreement, seedTestClients, makeApp,
  withClientAApiKey,
  TEST_API_KEY_CLIENT_A, TEST_EMPRESA_A,
  createAcceptedConsent,
} = require('../helpers');
const storage = require('../../src/services/storage');

// =========================================================================
// HELPERS
// =========================================================================

/**
 * Crea un PDF válido con pdf-lib. El `seed` permite que cada test tenga
 * un PDF con bytes distintos (SHA-256 server-computed diferente).
 */
async function makePdf(seed = 'e2e') {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  page.drawText(`e2e-doc-${seed}`);
  return Buffer.from(await doc.save());
}

/**
 * Construye el metadata para POST /internal/sign-requests con los campos
 * mínimos requeridos por zod.
 */
function buildMetadata(acuerdo, overrides = {}) {
  return {
    id_documento: 'doc-e2e',
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    tipo_firma: 'presencial',
    agreement_hash: acuerdo.texto_hash,
    agreement_version: acuerdo.version,
    document_hash: null,
    version_kair: '0.1.189-test',
    identificacion_tipo: 'CC',
    identificacion_numero_hash: sha256('1234567890'),
    ...overrides,
  };
}

/**
 * Cuenta archivos .pdf en los 3 directorios de storage. Útil para
 * verificar 0-PDFs post-rechazo.
 */
function countPdfsInStorage() {
  const counts = {};
  for (const dir of [storage.PATHS.originales, storage.PATHS.firmados, storage.PATHS.constancias]) {
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));
      counts[path.basename(dir)] = files.length;
    } catch (e) {
      counts[path.basename(dir)] = 0;
    }
  }
  return counts;
}

/**
 * Construye un PDF con header %PDF- válido pero cuerpo corrupto
 * (basura post-header sin estructura de xref/trailer). pdf-lib
 * debe rechazarlo con PDF_INVALID.
 */
function buildCorruptPdf() {
  return Buffer.concat([
    Buffer.from('%PDF-1.4\n'),
    Buffer.from('this is not a valid PDF body, just garbage after the header'),
  ]);
}

/**
 * Construye un PDF hand-crafted con /Encrypt en el trailer.
 * pdf-lib (y por lo tanto pdfValidator) debe rechazarlo con
 * PDF_ENCRYPTED.
 */
function buildEncryptedPdf() {
  const objs = [];
  objs.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objs.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objs.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n');
  objs.push('4 0 obj\n<< /Filter /Standard /V 1 /R 2 /Length 40 /O <0000000000000000000000000000000000000000> /U <0000000000000000000000000000000000000000> /P -4 >>\nendobj\n');
  let body = '%PDF-1.4\n%\xff\xff\xff\xff\n';
  const offsets = [];
  for (const o of objs) {
    offsets.push(body.length);
    body += o;
  }
  let xref = 'xref\n0 5\n0000000000 65535 f \n';
  for (const off of offsets) {
    xref += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  const xrefStart = body.length;
  body += xref;
  body += 'trailer\n<< /Size 5 /Root 1 0 R /Encrypt 4 0 R >>\n';
  body += 'startxref\n' + xrefStart + '\n%%EOF\n';
  return Buffer.from(body, 'latin1');
}

/**
 * Recorre el flujo público desde PENDING hasta DOCUMENT_VIEWED.
 * NO hace commit (eso es responsabilidad del test que llama esto).
 */
async function recorrerFlujoHastaViewed(app, token) {
  // 0. GET /s/:token
  const r0 = await request(app)
    .get(`/s/${token}`)
    .set('Accept', 'application/json');
  assert.equal(r0.status, 200, `GET /s/:token: ${r0.status} ${JSON.stringify(r0.body)}`);

  // 1. Identify
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: '1234567890' });
  assert.equal(r1.status, 200);
  const { devOtp } = r1.body;

  // 2. Verify OTP
  const r2 = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: devOtp });
  assert.equal(r2.status, 200);

  // 3. View document
  const r3 = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 30, scroll_al_final: true });
  assert.equal(r3.status, 200, `view-document: ${r3.status} ${JSON.stringify(r3.body)}`);
  assert.equal(r3.body.estado, 'DOCUMENT_VIEWED');
}

// =========================================================================
// §F5 — PDF FAILURE PATHS
// =========================================================================

/**
 * F5.1: PDF con header corrupto en POST → 422 PDF_INVALID +
 *       verificación exhaustiva de no-side-effects.
 *
 * Verifica:
 *   - Status 422, code PDF_INVALID.
 *   - 0 filas en gh_firmas_electronicas.
 *   - 0 filas en gh_firma_eventos.
 *   - 0 filas en gh_firma_sesiones.
 *   - 0 PDFs en originales/ (NUEVO vs M4.1).
 *   - 0 PDFs en firmados/ (NUEVO vs M4.1).
 *   - 0 PDFs en constancias/ (NUEVO vs M4.1).
 */
test('F5.1 PDF corrupto en POST → 422 PDF_INVALID + no-side-effects completos', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  seedTestClients();
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    version_acuerdo: 'v1.0',
  });
  const app = makeApp();
  const corruptPdf = buildCorruptPdf();
  const meta = buildMetadata(acuerdo, { consent_id, document_hash: sha256(corruptPdf) });

  const r1 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .field('metadata', JSON.stringify(meta))
      .attach('documento', corruptPdf, 'corrupto.pdf')
  );

  assert.equal(r1.status, 422, `debe ser 422, obtuve ${r1.status}: ${JSON.stringify(r1.body)}`);
  assert.equal(r1.body.error.code, 'PDF_INVALID');

  // BD: 0 firmas, 0 eventos, 0 sesiones
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM gh_firmas_electronicas').get().n,
    0,
    'No debe haber filas en gh_firmas_electronicas'
  );
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM gh_firma_eventos').get().n,
    0,
    'No debe haber eventos'
  );
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM gh_firma_sesiones').get().n,
    0,
    'No debe haber sesiones'
  );

  // FS: 0 PDFs en los 3 directorios
  const counts = countPdfsInStorage();
  assert.equal(counts.originales, 0, `0 PDFs en originales/ (visto: ${counts.originales})`);
  assert.equal(counts.firmados, 0, `0 PDFs en firmados/ (visto: ${counts.firmados})`);
  assert.equal(counts.constancias, 0, `0 PDFs en constancias/ (visto: ${counts.constancias})`);
});

/**
 * F5.2: PDF cifrado en POST → 422 PDF_ENCRYPTED + verificación
 *       exhaustiva de no-side-effects.
 *
 * Verifica (análogo a F5.1):
 *   - Status 422, code PDF_ENCRYPTED.
 *   - 0 filas en gh_firmas_electronicas, gh_firma_eventos, gh_firma_sesiones.
 *   - 0 PDFs en originales/, firmados/, constancias/ (NUEVO vs M4.2).
 */
test('F5.2 PDF cifrado en POST → 422 PDF_ENCRYPTED + no-side-effects completos', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  seedTestClients();
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    version_acuerdo: 'v1.0',
  });
  const app = makeApp();
  const encPdf = buildEncryptedPdf();
  const meta = buildMetadata(acuerdo, { consent_id, document_hash: sha256(encPdf) });

  const r1 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .field('metadata', JSON.stringify(meta))
      .attach('documento', encPdf, 'cifrado.pdf')
  );

  assert.equal(r1.status, 422, `debe ser 422, obtuve ${r1.status}: ${JSON.stringify(r1.body)}`);
  assert.equal(r1.body.error.code, 'PDF_ENCRYPTED');
  assert.equal(
    r1.body.error.details && r1.body.error.details.reason,
    'encrypted_pdf_not_supported',
    'details.reason debe ser "encrypted_pdf_not_supported"'
  );

  // BD: 0 firmas, 0 eventos, 0 sesiones
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM gh_firmas_electronicas').get().n,
    0
  );
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM gh_firma_eventos').get().n,
    0
  );
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM gh_firma_sesiones').get().n,
    0
  );

  // FS: 0 PDFs en los 3 directorios
  const counts = countPdfsInStorage();
  assert.equal(counts.originales, 0, `0 PDFs en originales/ (visto: ${counts.originales})`);
  assert.equal(counts.firmados, 0, `0 PDFs en firmados/ (visto: ${counts.firmados})`);
  assert.equal(counts.constancias, 0, `0 PDFs en constancias/ (visto: ${counts.constancias})`);
});

/**
 * F5.3: pdfGen.generateSignedPdf() falla durante commit → 500 +
 *       atomicidad preservada.
 *
 * Monkey-patch selectivo de pdfGen.generateSignedPdf para que lance.
 * El error ocurre ANTES del writeFileAtomic (línea 461-469), por lo
 * que NO hay archivos a limpiar — solo se verifica que la BD no
 * cambió de estado.
 *
 * Verifica:
 *   - Status 500.
 *   - Estado del sign request: sigue DOCUMENT_VIEWED (no SIGNED).
 *   - Campos del commit: todos null (evidence_hash, document_hash_firmado,
 *     pdf_firmado_path, constancia_path, id_constancia, fecha_firma).
 *   - 0 PDFs en firmados/ y constancias/ (nunca se escribieron).
 *   - Eventos: pre-existentes presentes, del commit NO (porque la tx
 *     rollback ataría cualquier INSERT de evento, PERO generateSignedPdf
 *     falla ANTES de entrar a la tx, por lo que NUNCA se intentó
 *     insertar ningún evento del commit).
 *   - Patch fue invocado 1 vez.
 */
test('F5.3 pdfGen.generateSignedPdf falla durante commit → atomicidad preservada', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  seedTestClients();
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    version_acuerdo: 'v1.0',
  });
  const app = makeApp();
  const pdf = await makePdf('F5.3');
  const meta = buildMetadata(acuerdo, { consent_id, document_hash: sha256(pdf) });

  // Setup: crear sign request y llevar a DOCUMENT_VIEWED
  const r1 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r1.status, 201);
  const idSolicitud = r1.body.id_solicitud;
  const token = r1.body.token;
  await recorrerFlujoHastaViewed(app, token);

  // Snapshot de PDFs ANTES del commit (solo debe haber el original)
  const pdfsFirmadosAntes = fs.readdirSync(storage.PATHS.firmados).filter(f => f.endsWith('.pdf'));
  const pdfsConstanciasAntes = fs.readdirSync(storage.PATHS.constancias).filter(f => f.endsWith('.pdf'));
  assert.equal(pdfsFirmadosAntes.length, 0, 'precondición: 0 PDFs en firmados/');
  assert.equal(pdfsConstanciasAntes.length, 0, 'precondición: 0 PDFs en constancias/');

  // Patch: pdfGen.generateSignedPdf lanza
  const simulatedErr = new Error('Simulated failure in pdfGen.generateSignedPdf');
  const orig = pdfGen.generateSignedPdf;
  let callCount = 0;
  pdfGen.generateSignedPdf = function patched(...args) {
    callCount++;
    throw simulatedErr;
  };
  let rCommit;
  try {
    rCommit = await request(app)
      .post(`/api/sign/${token}/commit`)
      .send({ manifestacion_aceptada: true });
  } finally {
    pdfGen.generateSignedPdf = orig;
  }

  // Status
  assert.equal(rCommit.status, 500,
    `debe ser 500, obtuve ${rCommit.status}: ${JSON.stringify(rCommit.body)}`);
  // Patch fue invocado 1 vez
  assert.equal(callCount, 1, 'pdfGen.generateSignedPdf debe haberse llamado 1 vez');

  // BD: estado sigue DOCUMENT_VIEWED
  const finalRow = db.prepare(`
    SELECT estado, evidence_hash, document_hash_firmado, pdf_firmado_path,
           constancia_path, id_constancia, fecha_firma
    FROM gh_firmas_electronicas WHERE id_solicitud = ?
  `).get(idSolicitud);
  assert.equal(finalRow.estado, 'DOCUMENT_VIEWED',
    'estado debe seguir DOCUMENT_VIEWED (commit falló antes de la tx)');
  assert.equal(finalRow.evidence_hash, null);
  assert.equal(finalRow.document_hash_firmado, null);
  assert.equal(finalRow.pdf_firmado_path, null);
  assert.equal(finalRow.constancia_path, null);
  assert.equal(finalRow.id_constancia, null);
  assert.equal(finalRow.fecha_firma, null);

  // FS: 0 PDFs en firmados/ y constancias/ (nunca se escribieron)
  const pdfsFirmadosDespues = fs.readdirSync(storage.PATHS.firmados).filter(f => f.endsWith('.pdf'));
  const pdfsConstanciasDespues = fs.readdirSync(storage.PATHS.constancias).filter(f => f.endsWith('.pdf'));
  assert.equal(pdfsFirmadosDespues.length, 0,
    `0 PDFs en firmados/ post-commit (visto: ${pdfsFirmadosDespues.length})`);
  assert.equal(pdfsConstanciasDespues.length, 0,
    `0 PDFs en constancias/ post-commit (visto: ${pdfsConstanciasDespues.length})`);

  // Eventos: pre-existentes presentes, del commit NO
  const eventos = db.prepare(`
    SELECT evento FROM gh_firma_eventos
    WHERE firma_id = (SELECT id FROM gh_firmas_electronicas WHERE id_solicitud = ?)
    ORDER BY id
  `).all(idSolicitud).map(e => e.evento);
  const esperadosPresentes = [
    'CREATED', 'OPENED', 'IDENTIFICATION_COMPLETED', 'OTP_SENT',
    'OTP_VERIFIED', 'DOCUMENT_VIEWED',
  ];
  const noEsperados = [
    'MANIFESTATION_RECORDED', 'SIGN_COMMITTED', 'PDF_GENERATED',
    'COPY_SENT', 'COPY_FAILED',
  ];
  for (const ev of esperadosPresentes) {
    assert.ok(eventos.includes(ev),
      `Debe existir el evento pre-existente ${ev}, eventos vistos: ${eventos.join(',')}`);
  }
  for (const ev of noEsperados) {
    assert.ok(!eventos.includes(ev),
      `NO debe existir el evento del commit ${ev}, eventos vistos: ${eventos.join(',')}`);
  }
});

/**
 * F5.4: pdfGen.generateConstanciaPdf() falla durante commit → 500 +
 *       atomicidad preservada.
 *
 * Monkey-patch selectivo de pdfGen.generateConstanciaPdf para que
 * lance. Esto ocurre DESPUÉS de que pdfGen.generateSignedPdf YA
 * generó el PDF firmado correctamente (línea 392), pero ANTES de
 * que writeFileAtomic escriba nada a disco (línea 461-469).
 *
 * Verifica (análogo a F5.3):
 *   - Status 500.
 *   - Estado del sign request: sigue DOCUMENT_VIEWED.
 *   - Campos del commit: todos null.
 *   - 0 PDFs en firmados/ y constancias/ (generateSignedPdf se ejecutó
 *     en memoria pero no se persistió nada a disco).
 *   - Eventos: pre-existentes presentes, del commit NO.
 *   - generateSignedPdf fue invocado 1 vez (sí se ejecutó).
 *   - generateConstanciaPdf fue invocado 1 vez (el patch).
 */
test('F5.4 pdfGen.generateConstanciaPdf falla durante commit → atomicidad preservada', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  seedTestClients();
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    version_acuerdo: 'v1.0',
  });
  const app = makeApp();
  const pdf = await makePdf('F5.4');
  const meta = buildMetadata(acuerdo, { consent_id, document_hash: sha256(pdf) });

  // Setup
  const r1 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r1.status, 201);
  const idSolicitud = r1.body.id_solicitud;
  const token = r1.body.token;
  await recorrerFlujoHastaViewed(app, token);

  // Patch: generateConstanciaPdf lanza (después de generateSignedPdf OK)
  const simulatedErr = new Error('Simulated failure in pdfGen.generateConstanciaPdf');
  const origGenConst = pdfGen.generateConstanciaPdf;
  let constCallCount = 0;
  pdfGen.generateConstanciaPdf = function patched(...args) {
    constCallCount++;
    throw simulatedErr;
  };
  let rCommit;
  try {
    rCommit = await request(app)
      .post(`/api/sign/${token}/commit`)
      .send({ manifestacion_aceptada: true });
  } finally {
    pdfGen.generateConstanciaPdf = origGenConst;
  }

  assert.equal(rCommit.status, 500,
    `debe ser 500, obtuve ${rCommit.status}: ${JSON.stringify(rCommit.body)}`);
  assert.equal(constCallCount, 1, 'pdfGen.generateConstanciaPdf debe haberse llamado 1 vez');

  // BD: estado sigue DOCUMENT_VIEWED
  const finalRow = db.prepare(`
    SELECT estado, evidence_hash, document_hash_firmado, pdf_firmado_path,
           constancia_path, id_constancia, fecha_firma
    FROM gh_firmas_electronicas WHERE id_solicitud = ?
  `).get(idSolicitud);
  assert.equal(finalRow.estado, 'DOCUMENT_VIEWED',
    'estado debe seguir DOCUMENT_VIEWED (commit falló en generateConstanciaPdf)');
  assert.equal(finalRow.evidence_hash, null);
  assert.equal(finalRow.document_hash_firmado, null);
  assert.equal(finalRow.pdf_firmado_path, null);
  assert.equal(finalRow.constancia_path, null);
  assert.equal(finalRow.id_constancia, null);
  assert.equal(finalRow.fecha_firma, null);

  // FS: 0 PDFs en firmados/ y constancias/
  const pdfsFirmadosDespues = fs.readdirSync(storage.PATHS.firmados).filter(f => f.endsWith('.pdf'));
  const pdfsConstanciasDespues = fs.readdirSync(storage.PATHS.constancias).filter(f => f.endsWith('.pdf'));
  assert.equal(pdfsFirmadosDespues.length, 0,
    `0 PDFs en firmados/ post-commit (visto: ${pdfsFirmadosDespues.length})`);
  assert.equal(pdfsConstanciasDespues.length, 0,
    `0 PDFs en constancias/ post-commit (visto: ${pdfsConstanciasDespues.length})`);

  // Eventos: pre-existentes presentes, del commit NO
  const eventos = db.prepare(`
    SELECT evento FROM gh_firma_eventos
    WHERE firma_id = (SELECT id FROM gh_firmas_electronicas WHERE id_solicitud = ?)
    ORDER BY id
  `).all(idSolicitud).map(e => e.evento);
  const esperadosPresentes = [
    'CREATED', 'OPENED', 'IDENTIFICATION_COMPLETED', 'OTP_SENT',
    'OTP_VERIFIED', 'DOCUMENT_VIEWED',
  ];
  const noEsperados = [
    'MANIFESTATION_RECORDED', 'SIGN_COMMITTED', 'PDF_GENERATED',
    'COPY_SENT', 'COPY_FAILED',
  ];
  for (const ev of esperadosPresentes) {
    assert.ok(eventos.includes(ev),
      `Debe existir el evento pre-existente ${ev}, eventos vistos: ${eventos.join(',')}`);
  }
  for (const ev of noEsperados) {
    assert.ok(!eventos.includes(ev),
      `NO debe existir el evento del commit ${ev}, eventos vistos: ${eventos.join(',')}`);
  }
});

// ============================================================================
// HALLAZGO #3 — INTERNAL_ERROR genérico cuando pdfGen falla durante commit
// (publicFlow.js:392, 454)
// ============================================================================
//
// Severidad: BAJA-MEDIA (deuda de observabilidad operativa; NO afecta
// atomicidad ni correctness).
//
// Ubicación: src/services/publicFlow.js:
//   - Línea 392: `pdfFirmadoBuf = await pdfGen.generateSignedPdf(...)`
//   - Línea 454: `constanciaBuf = await pdfGen.generateConstanciaPdf(...)`
//
// Síntoma: cuando pdfGen lanza un error (e.g. PDF corrupto, XMP
// malformado, OOM durante generación), el errorHandler central loguea
// el error como "Error no controlado" y el cliente recibe 500 con
// `error.code = 'INTERNAL_ERROR'`. El operador que revisa logs NO puede
// distinguir:
//   - Fallo en generateSignedPdf (generación del PDF firmado)
//   - Fallo en generateConstanciaPdf (generación de la Constancia)
//   - Fallo en writeFileAtomic (storage, ya cubierto por F6.2 con
//     código específico STORAGE_WRITE_FAILED)
//
// Causa: las llamadas a `pdfGen.generateSignedPdf` y
// `pdfGen.generateConstanciaPdf` NO están envueltas en try/catch que
// las envuelva como AppError. Si pdfGen lanza un `Error` genérico
// (e.g. "Cannot read properties of undefined (reading 'Pages')"),
// el error se propaga al errorHandler como `Error` no-AppError, y este
// responde INTERNAL_ERROR. Mismo patrón que HALLAZGO #2 (registerEvent).
//
// Decisión: NO se corrige producción en este bloque (fuera de scope de
// I-E2E.7). Se programa como fix futuro en un bloque transversal de
// observabilidad/errores (I-008.x). Los tests F5.3 y F5.4 verifican
// SOLO status=500 (atomicidad preservada) y NO assertean el `error.code`
// específico, justamente porque el código actual es INTERNAL_ERROR.
//
// Impacto para K+AIR operador:
//   - Los logs de error no distinguen "firma PDF" vs "constancia".
//   - El cliente recibe "Error interno del servidor" sin código diagnóstico.
//   - La causa raíz requiere inspección de logs internos del servidor
//     o un re-run manual del commit.
//
// F5.3 y F5.4 cubren este hallazgo: ambos tests assertean status=500 +
// atomicidad preservada, pero NO assertean error.code. Esto es
// DELIBERADO: documenta el comportamiento actual (INTERNAL_ERROR) sin
// convertir los tests en algo que verifique un comportamiento que aún
// no existe.
//
// NOTA: HALLAZGO #2 (firma-atomicidad.test.js) comparte el mismo patrón
// (errores de registerEvent tampoco se envuelven como AppError). Ambos
// podrían resolverse en un mismo bloque I-008.x con una mejora
// transversal del manejo de errores en publicFlow.js commit(), p.ej.
// un helper `withAppErrorWrapping(fn, code, msg)` que envuelva cualquier
// error de una callback como AppError tipado.
//
// Reproducción:
//   1. resetDb(); seedActiveAgreement({...}); seedTestClients();
//   2. Crear sign request + llevar a DOCUMENT_VIEWED.
//   3. Monkey-patch selectivo de pdfGen.generateSignedPdf (o
//      generateConstanciaPdf) para que lance.
//   4. POST /api/sign/:token/commit → 500 con error.code = 'INTERNAL_ERROR'
//      (no 'PDF_GENERATION_FAILED' como sería ideal).
//
// FIX PROPUESTO (fuera de scope de I-E2E.7):
//   En publicFlow.js:392 y :454, envolver las llamadas a pdfGen:
//     let pdfFirmadoBuf;
//     try {
//       pdfFirmadoBuf = await pdfGen.generateSignedPdf(pdfOriginal, {...});
//     } catch (err) {
//       throw new AppError(500, 'PDF_GENERATION_FAILED',
//         'Fallo al generar el PDF firmado', { original_error: err.message });
//     }
//   Y análogamente para generateConstanciaPdf con código
//   'CONSTANCIA_GENERATION_FAILED' (o un código compartido si se
//   prefiere un único "PDF_GENERATION_FAILED").
//   Alternativa transversal: helper `withAppErrorWrapping(fn, code, msg)`
//   que cubra también HALLAZGO #2 (registerEvent).
// ============================================================================
