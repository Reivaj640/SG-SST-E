/**
 * Tests E2E de atomicidad en composición (I-E2E.5, §F6).
 *
 * Este archivo complementa los tests unitarios del service (E9.2) y del
 * middleware (idempotency) verificando la garantía de atomicidad del
 * commit() en publicFlow.js sobre el endpoint REAL con `makeApp()` y
 * el stack HTTP completo.
 *
 * Alcance I-E2E.5 (3 tests ajustados per F6 audit):
 *
 *   F6.1  fallo de commit por CONSENT_NOT_ACCEPTED (E6 caso 3) → atomicidad
 *         preservada. NO duplica los 6 casos de bloque-e6.test.js; añade
 *         las 3 assertions atómicas NUEVAS que NO están en bloque-e6:
 *         (a) disco: 0 PDFs en firmados/ y constancias/.
 *         (b) eventos: pre-existentes presentes, del commit NO.
 *         (c) campos BD: estado=DOCUMENT_VIEWED, evidence_hash/document_hash_firmado/
 *             pdf_firmado_path/constancia_path/id_constancia/fecha_firma todos null.
 *
 *   F6.2  fallo en writeFileAtomic() (1 test, 2 sub-cases):
 *         a) primer write falla → atomicidad BD↔FS preservada.
 *         b) primer write OK, segundo falla → cleanup del primer write
 *            (línea 466) → atomicidad BD↔FS preservada.
 *
 *   F6.3  fallo de INSERT de evento SIGN_COMMITTED dentro de la tx →
 *         rollback atómico: todos los campos persisten juntos o ninguno.
 *         Monkey-patch selectivo de signRequestService.registerEvent.
 *
 * Diferencias vs tests existentes:
 *   - tests/services/signRequest.test.js (E9.2): unit tests de
 *     signRequestService.create() con monkey-patch de db.prepare.
 *     Cubre el flujo de creación (PDF huérfano cleanup). NO cubre
 *     el commit.
 *   - tests/e2e/bloque-e6.test.js: 6 tests del flujo público + E6
 *     consent. Asserta row.estado === 'DOCUMENT_VIEWED' para
 *     fallos de commit, pero NO asserta disco/eventos/campos
 *     específicos de atomicidad.
 *
 * Acá cubrimos la COMPOSICIÓN con `makeApp()` y el stack HTTP
 * completo (authz, rate limit, multer, pdfValidation, idempotency,
 * handler, public flow). Los 3 tests verifican que la garantía de
 * atomicidad se mantiene end-to-end, no solo a nivel de service.
 */
'use strict';

// Ensure test env before any requires (dotenv may set production from .env)
if (process.env.NODE_ENV !== 'test') process.env.NODE_ENV = 'test';
delete require.cache[require.resolve('../../src/config')];

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const db = require('../../src/db/connection');
const { sha256 } = require('../../src/crypto/hash');
const { canonicalJSON } = require('../../src/crypto/compare');
const signRequestService = require('../../src/services/signRequest');
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
 * Recorre el flujo público desde PENDING hasta DOCUMENT_VIEWED.
 * NO hace commit (eso es responsabilidad del test que llama esto).
 */
async function recorrerFlujoHastaViewed(app, token) {
  // GET /s/:token (dispara evento OPENED)
  const r0 = await request(app)
    .get(`/s/${token}`)
    .set('Accept', 'application/json');
  assert.equal(r0.status, 200, `GET /s/:token: ${r0.status} ${JSON.stringify(r0.body)}`);

  // identify
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: '1234567890' });
  assert.equal(r1.status, 200);
  const { devOtp } = r1.body;

  // verify-otp
  const r2 = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: devOtp });
  assert.equal(r2.status, 200);

  // view-document
  const r3 = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 30, scroll_al_final: true });
  assert.equal(r3.status, 200, `view-document: ${r3.status} ${JSON.stringify(r3.body)}`);
  assert.equal(r3.body.estado, 'DOCUMENT_VIEWED');
}

/**
 * F6.2 helper: patchea `fs.openSync` para que lance un error en la N-ésima
 * llamada CUYO PATH incluya 'firmados' o 'constancias' (los paths objetivo
 * de writeFileAtomic en publicFlow.js).
 *
 * ¿Por qué filtrar por path? Porque `fs.openSync` también es llamado
 * internamente por `fs.readFileSync` (usado en storage.readPdf para
 * leer el PDF original). Sin el filtro, el patch dispara en storage.js:77
 * (readFileSync → openSync) ANTES de llegar a writeFileAtomic, y el
 * error escapa del flujo antes del try/catch de writeFileAtomic.
 *
 * Con el filtro:
 *   - Sub-case (a): n=1 → throw on 1ª call a firmados/constancias
 *     (el primer writeFileAtomic falla).
 *   - Sub-case (b): n=2 → throw on 2ª call a firmados/constancias
 *     (primer writeFileAtomic OK, segundo falla).
 *
 * Restaurar siempre con `.dispose()` (usar try/finally).
 *
 * @param {number} n - Número de llamada en que debe lanzar (1-based).
 * @param {Error} error - Error a lanzar.
 * @returns {{dispose: function, getCallCount: function}}
 */
function patchFsOpenSyncToThrowOnCall(n, error) {
  const orig = fs.openSync;
  let callCount = 0;
  fs.openSync = function patched(...args) {
    const filepath = args[0];
    // Solo contar/throw en paths objetivo (firmados/ o constancias/)
    const isTarget = typeof filepath === 'string' &&
      (filepath.includes('firmados') || filepath.includes('constancias'));
    if (!isTarget) {
      return orig.apply(this, args);
    }
    callCount++;
    if (callCount === n) {
      throw error;
    }
    return orig.apply(this, args);
  };
  return {
    dispose() { fs.openSync = orig; },
    getCallCount: () => callCount,
  };
}

/**
 * F6.3 helper: patchea signRequestService.registerEvent para que lance
 * `error` cuando se llama con `evento` igual a `targetEvento`. Otros
 * eventos pasan normalmente.
 */
function patchRegisterEventToThrowOn(targetEvento, error) {
  const orig = signRequestService.registerEvent;
  let matchingCalls = 0;
  signRequestService.registerEvent = function patched(firmaId, evento, metadata, actor, ip, userAgent) {
    if (evento === targetEvento) {
      matchingCalls++;
      throw error;
    }
    return orig.call(this, firmaId, evento, metadata, actor, ip, userAgent);
  };
  return {
    dispose() { signRequestService.registerEvent = orig; },
    getMatchingCalls: () => matchingCalls,
  };
}

// =========================================================================
// §F6 — ATOMICIDAD E2E
// =========================================================================

/**
 * F6.1: atomicidad ante fallo de commit por validación de consentimiento.
 *
 * Setup: crear sign request con consent_id, llevar a DOCUMENT_VIEWED,
 * luego MUTAR el consent a manifestacion_aceptada=0 (simula un escenario
 * donde el consent se revoca entre view y commit, o donde K+AIR
 * envía un sign_request con un consent que después se invalida).
 *
 * Provoca: validateForCommit en publicFlow.js:368 lanza
 * CONSENT_NOT_ACCEPTED antes de que se genere id_constancia, se
 * escriban PDFs, o se abra la tx.
 *
 * Verifica: 3 assertions atómicas NUEVAS que NO están en bloque-e6:
 *   (a) disco: 0 PDFs en firmados/ y constancias/ para este id_solicitud.
 *   (b) eventos: pre-existentes (CREATED, OPENED, IDENTIFICATION_COMPLETED,
 *       OTP_SENT, OTP_VERIFIED, DOCUMENT_VIEWED) presentes; del commit
 *       (MANIFESTATION_RECORDED, SIGN_COMMITTED, PDF_GENERATED,
 *       COPY_SENT, COPY_FAILED) NO existen.
 *   (c) campos BD: estado='DOCUMENT_VIEWED', evidence_hash null,
 *       document_hash_firmado null, pdf_firmado_path null,
 *       constancia_path null, id_constancia null, fecha_firma null.
 */
test('F6.1 commit con consent inválido (E6 caso 3) → atomicidad preservada', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  seedTestClients();
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    version_acuerdo: 'v1.0',
  });
  const app = makeApp();
  const pdf = await makePdf('F6.1');
  const meta = buildMetadata(acuerdo, { consent_id });
  meta.document_hash = sha256(pdf);

  // 1. Crear sign request y llevar a DOCUMENT_VIEWED
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

  // 2. Mutar el consent a manifestacion_aceptada=0 (simula revocación
  //    entre view y commit; bloque-e6.test.js hace lo mismo para
  //    provocar el 409).
  db.prepare(
    'UPDATE gh_consentimientos_firma SET manifestacion_aceptada = 0 WHERE id = ?'
  ).run(consent_id);

  // 3. POST commit → debe fallar con CONSENT_NOT_ACCEPTED
  const rCommit = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });
  assert.equal(rCommit.status, 409);
  assert.equal(rCommit.body.error.code, 'CONSENT_NOT_ACCEPTED');

  // 4. (c) Campos BD: estado sigue DOCUMENT_VIEWED, todos los campos
  //    del commit son null.
  const finalRow = db.prepare(`
    SELECT estado, evidence_hash, document_hash_firmado, pdf_firmado_path,
           constancia_path, id_constancia, fecha_firma
    FROM gh_firmas_electronicas WHERE id_solicitud = ?
  `).get(idSolicitud);
  assert.equal(finalRow.estado, 'DOCUMENT_VIEWED',
    'Estado debe seguir DOCUMENT_VIEWED (no avanzó a SIGNED)');
  assert.equal(finalRow.evidence_hash, null,
    'evidence_hash debe ser null (la tx no se abrió)');
  assert.equal(finalRow.document_hash_firmado, null,
    'document_hash_firmado debe ser null');
  assert.equal(finalRow.pdf_firmado_path, null,
    'pdf_firmado_path debe ser null (no se escribió el PDF firmado)');
  assert.equal(finalRow.constancia_path, null,
    'constancia_path debe ser null (no se escribió la constancia)');
  assert.equal(finalRow.id_constancia, null,
    'id_constancia debe ser null (no se generó)');
  assert.equal(finalRow.fecha_firma, null,
    'fecha_firma debe ser null');

  // 5. (a) Disco: 0 PDFs en firmados/ y constancias/ para este id_solicitud.
  const pdfFirmadoPath = path.join(storage.PATHS.firmados, `${idSolicitud}.pdf`);
  const constanciaPath = path.join(storage.PATHS.constancias, `${idSolicitud}-constancia.pdf`);
  assert.equal(fs.existsSync(pdfFirmadoPath), false,
    `No debe existir ${pdfFirmadoPath} (atomicidad BD↔FS)`);
  assert.equal(fs.existsSync(constanciaPath), false,
    `No debe existir ${constanciaPath} (atomicidad BD↔FS)`);

  // 6. (b) Eventos: pre-existentes presentes, del commit NO.
  const eventos = db.prepare(`
    SELECT evento FROM gh_firma_eventos
    WHERE firma_id = (SELECT id FROM gh_firmas_electronicas WHERE id_solicitud = ?)
    ORDER BY id
  `).all(idSolicitud).map(e => e.evento);

  const eventosEsperadosPresentes = [
    'CREATED', 'OPENED', 'IDENTIFICATION_COMPLETED', 'OTP_SENT',
    'OTP_VERIFIED', 'DOCUMENT_VIEWED',
  ];
  const eventosNoEsperados = [
    'MANIFESTATION_RECORDED', 'SIGN_COMMITTED', 'PDF_GENERATED',
    'COPY_SENT', 'COPY_FAILED',
  ];
  for (const ev of eventosEsperadosPresentes) {
    assert.ok(eventos.includes(ev),
      `Debe existir el evento pre-existente ${ev}, eventos vistos: ${eventos.join(',')}`);
  }
  for (const ev of eventosNoEsperados) {
    assert.ok(!eventos.includes(ev),
      `NO debe existir el evento del commit ${ev}, eventos vistos: ${eventos.join(',')}`);
  }
});

/**
 * F6.2: atomicidad ante fallo de writeFileAtomic (escritura de PDFs).
 *
 * 1 test con 2 sub-cases (mismo sign request, 2 commits fallidos):
 *   a) Primer write falla: patch fs.openSync to throw on every call.
 *      Esperado: STORAGE_WRITE_FAILED, BD intacta, 0 PDFs.
 *   b) Primer write OK, segundo falla: patch fs.openSync to throw on
 *      2nd call only. Esperado: STORAGE_WRITE_FAILED, BD intacta, 0 PDFs
 *      (cleanup del primer write en línea 466).
 */
test('F6.2 commit con writeFileAtomic fallando → atomicidad BD↔FS preservada (2 sub-cases)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  seedTestClients();
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    version_acuerdo: 'v1.0',
  });
  const app = makeApp();
  const pdf = await makePdf('F6.2');
  const meta = buildMetadata(acuerdo, { consent_id });
  meta.document_hash = sha256(pdf);

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

  const pdfFirmadoPath = path.join(storage.PATHS.firmados, `${idSolicitud}.pdf`);
  const constanciaPath = path.join(storage.PATHS.constancias, `${idSolicitud}-constancia.pdf`);

  // === Sub-case (a): primer write falla ===
  {
    const diskFullErr = new Error('Simulated disk full');
    diskFullErr.code = 'ENOSPC';
    const patch = patchFsOpenSyncToThrowOnCall(1, diskFullErr);
    let resA;
    try {
      resA = await request(app)
        .post(`/api/sign/${token}/commit`)
        .send({ manifestacion_aceptada: true });
    } finally {
      patch.dispose();
    }
    assert.equal(resA.status, 500, `Sub-case (a) debe ser 500, obtuve ${resA.status}`);
    assert.equal(resA.body.error.code, 'STORAGE_WRITE_FAILED');
    assert.equal(patch.getCallCount(), 1,
      'Sub-case (a): patch debe haberse llamado exactamente 1 vez (primer write falló)');

    // BD intacta
    const rowA = db.prepare(
      'SELECT estado, pdf_firmado_path, constancia_path FROM gh_firmas_electronicas WHERE id_solicitud = ?'
    ).get(idSolicitud);
    assert.equal(rowA.estado, 'DOCUMENT_VIEWED',
      'Sub-case (a): estado debe seguir DOCUMENT_VIEWED');
    assert.equal(rowA.pdf_firmado_path, null);
    assert.equal(rowA.constancia_path, null);
    // Disco: 0 PDFs
    assert.equal(fs.existsSync(pdfFirmadoPath), false,
      'Sub-case (a): no debe existir PDF firmado (primer write falló)');
    assert.equal(fs.existsSync(constanciaPath), false);
  }

  // === Sub-case (b): primer write OK, segundo falla ===
  {
    const diskFullErr = new Error('Simulated disk full on 2nd write');
    diskFullErr.code = 'ENOSPC';
    const patch = patchFsOpenSyncToThrowOnCall(2, diskFullErr);
    let resB;
    try {
      resB = await request(app)
        .post(`/api/sign/${token}/commit`)
        .send({ manifestacion_aceptada: true });
    } finally {
      patch.dispose();
    }
    assert.equal(resB.status, 500, `Sub-case (b) debe ser 500, obtuve ${resB.status}`);
    assert.equal(resB.body.error.code, 'STORAGE_WRITE_FAILED');
    assert.equal(patch.getCallCount(), 2,
      'Sub-case (b): patch debe haberse llamado exactamente 2 veces (1er OK, 2do falló)');

    // BD intacta
    const rowB = db.prepare(
      'SELECT estado, pdf_firmado_path, constancia_path FROM gh_firmas_electronicas WHERE id_solicitud = ?'
    ).get(idSolicitud);
    assert.equal(rowB.estado, 'DOCUMENT_VIEWED',
      'Sub-case (b): estado debe seguir DOCUMENT_VIEWED');
    assert.equal(rowB.pdf_firmado_path, null);
    assert.equal(rowB.constancia_path, null);
    // Disco: cleanup del primer write (línea 466). 0 PDFs.
    assert.equal(fs.existsSync(pdfFirmadoPath), false,
      'Sub-case (b): PDF firmado fue escrito y luego borrado por cleanup (línea 466)');
    assert.equal(fs.existsSync(constanciaPath), false,
      'Sub-case (b): constancia nunca se escribió (segundo write falló antes)');
  }

  // Estado final después de los 2 sub-cases: sign request sigue
  // DOCUMENT_VIEWED, 0 PDFs en firmados/ y constancias/.
  const finalRow = db.prepare(
    'SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(idSolicitud);
  assert.equal(finalRow.estado, 'DOCUMENT_VIEWED',
    'Después de los 2 sub-cases, el estado debe seguir DOCUMENT_VIEWED');
});

/**
 * F6.3: atomicidad ante fallo de INSERT de evento dentro de la tx.
 *
 * Monkey-patch selectivo de signRequestService.registerEvent para
 * que lance cuando evento === 'SIGN_COMMITTED'. La tx de better-sqlite3
 * rollbackea automáticamente; el catch en línea 511-516 borra los
 * PDFs que writeFileAtomic ya había escrito.
 *
 * Verifica:
 *   - Estado del sign request: sigue DOCUMENT_VIEWED (tx rollback).
 *   - Campos del commit: todos null.
 *   - Disco: 0 PDFs (cleanup borró los del writeFileAtomic exitoso).
 *   - Eventos: pre-existentes presentes, del commit NO (rollback).
 *   - Patch fue invocado 1 vez (solo SIGN_COMMITTED falla; los otros
 *     eventos del commit se insertaron ANTES).
 */
test('F6.3 commit con evento SIGN_COMMITTED fallando → tx rollback atómico', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  seedTestClients();
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    version_acuerdo: 'v1.0',
  });
  const app = makeApp();
  const pdf = await makePdf('F6.3');
  const meta = buildMetadata(acuerdo, { consent_id });
  meta.document_hash = sha256(pdf);

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

  const pdfFirmadoPath = path.join(storage.PATHS.firmados, `${idSolicitud}.pdf`);
  const constanciaPath = path.join(storage.PATHS.constancias, `${idSolicitud}-constancia.pdf`);

  // Patch selectivo: registerEvent lanza en evento='SIGN_COMMITTED'.
  // Los otros eventos del commit (MANIFESTATION_RECORDED, PDF_GENERATED)
  // se insertan ANTES de SIGN_COMMITTED en la tx (publicFlow.js:499-507),
  // por lo que se insertan OK y luego el rollback los borra.
  const simulatedErr = new Error('Simulated failure on SIGN_COMMITTED event insert');
  const patch = patchRegisterEventToThrowOn('SIGN_COMMITTED', simulatedErr);
  let res;
  try {
    res = await request(app)
      .post(`/api/sign/${token}/commit`)
      .send({ manifestacion_aceptada: true });
  } finally {
    patch.dispose();
  }
  assert.equal(res.status, 500, `Debe ser 500, obtuve ${res.status} ${JSON.stringify(res.body)}`);
  // I-008.4: el error específico ahora es EVENT_REGISTRATION_FAILED (cierra
  // HALLAZGO #2 con I-008.3). Antes era INTERNAL_ERROR genérico.
  assert.equal(res.body.error.code, 'EVENT_REGISTRATION_FAILED');
  assert.equal(patch.getMatchingCalls(), 1,
    'El patch debe haberse llamado exactamente 1 vez (SIGN_COMMITTED)');

  // Estado del sign request: sigue DOCUMENT_VIEWED (tx rollback).
  const finalRow = db.prepare(`
    SELECT estado, evidence_hash, document_hash_firmado, pdf_firmado_path,
           constancia_path, id_constancia, fecha_firma
    FROM gh_firmas_electronicas WHERE id_solicitud = ?
  `).get(idSolicitud);
  assert.equal(finalRow.estado, 'DOCUMENT_VIEWED',
    'Estado debe seguir DOCUMENT_VIEWED (tx rollback)');
  assert.equal(finalRow.evidence_hash, null);
  assert.equal(finalRow.document_hash_firmado, null);
  assert.equal(finalRow.id_constancia, null);
  assert.equal(finalRow.fecha_firma, null);
  assert.equal(finalRow.pdf_firmado_path, null,
    'pdf_firmado_path debe ser null (los campos se persisten en la tx)');
  assert.equal(finalRow.constancia_path, null);

  // Disco: 0 PDFs (writeFileAtomic fue exitoso para ambos, pero el catch
  // en línea 513-514 borró ambos).
  assert.equal(fs.existsSync(pdfFirmadoPath), false,
    'PDF firmado fue escrito y luego borrado por catch (línea 513)');
  assert.equal(fs.existsSync(constanciaPath), false,
    'Constancia fue escrita y luego borrada por catch (línea 514)');

  // Eventos: pre-existentes presentes; del commit NO (rollback).
  const eventos = db.prepare(`
    SELECT evento FROM gh_firma_eventos
    WHERE firma_id = (SELECT id FROM gh_firmas_electronicas WHERE id_solicitud = ?)
    ORDER BY id
  `).all(idSolicitud).map(e => e.evento);

  // Eventos pre-existentes del flujo público deben estar todos presentes
  const eventosEsperadosPresentes = [
    'CREATED', 'OPENED', 'IDENTIFICATION_COMPLETED', 'OTP_SENT',
    'OTP_VERIFIED', 'DOCUMENT_VIEWED',
  ];
  // Eventos del commit NO deben estar (rollback)
  const eventosNoEsperados = [
    'MANIFESTATION_RECORDED', 'SIGN_COMMITTED', 'PDF_GENERATED',
    'COPY_SENT', 'COPY_FAILED',
  ];
  for (const ev of eventosEsperadosPresentes) {
    assert.ok(eventos.includes(ev),
      `Debe existir el evento pre-existente ${ev}, eventos vistos: ${eventos.join(',')}`);
  }
  for (const ev of eventosNoEsperados) {
    assert.ok(!eventos.includes(ev),
      `NO debe existir el evento del commit ${ev} (rollback), eventos vistos: ${eventos.join(',')}`);
  }
});

// ============================================================================
// HALLAZGO #2 — INTERNAL_ERROR genérico cuando registerEvent() falla dentro
// de la tx de commit (publicFlow.js:511-516)
// ============================================================================
//
// Severidad: BAJA-MEDIA (deuda de observabilidad operativa; NO afecta
// atomicidad ni correctness).
//
// Ubicación: src/services/publicFlow.js líneas 511-516 (catch del bloque
// `db.transaction(() => { ... })` en commit()).
//
// Síntoma: cuando registerEvent() lanza un error dentro de la tx de
// commit, el errorHandler central loguea el error como "Error no
// controlado" y el cliente recibe 500 con `error.code = 'INTERNAL_ERROR'`.
// El operador que revisa logs NO puede distinguir:
//   - Fallo del INSERT en gh_firma_eventos (BD)
//   - Fallo de foreign key (signRequest.id no existe)
//   - Constraint violation (e.g. CHECK de evento enum)
//
// Causa: el catch en publicFlow.js:511-516 hace cleanup de archivos
// (`fs.unlinkSync`) y re-lanza el error original (`throw err`),
// preservando el `Error` genérico. El errorHandler central solo
// distingue `AppError` (envolvente) de `Error` (genérico → INTERNAL_ERROR).
// registerEvent no envuelve sus errores como AppError; por lo tanto
// cualquier falla interna se propaga como Error genérico.
//
// Decisión: NO se corrige producción en este bloque (fuera de scope de
// I-E2E.5). Se programa como fix futuro en un bloque transversal de
// observabilidad/errores (I-008.x). El test F6.3 verifica SOLO status=500
// (atomicidad preservada) y NO assertea el `error.code` específico,
// justamente porque el código actual es INTERNAL_ERROR.
//
// Impacto para K+AIR operador:
//   - Los logs de error no distinguen la causa específica.
//   - El cliente recibe "Error interno del servidor" sin código diagnóstico.
//   - La auditoría forense (F6.3) tiene que correlacionar con logs
//     internos del servidor para entender qué falló.
//
// F6.3 cubre este hallazgo: el test F6.3 assertea status=500 + atomicidad
// preservada (BD rollback, FS cleanup), pero NO assertea error.code. Esto
// es DELIBERADO: documenta el comportamiento actual (INTERNAL_ERROR) sin
// convertir el test en algo que verifique un comportamiento que aún no
// existe.
//
// NOTA: HALLAZGO #3 (firma-pdf-failure-paths.test.js) comparte el mismo
// patrón (errores de pdfGen tampoco se envuelven como AppError). Ambos
// podrían resolverse en un mismo bloque I-008.x con una mejora transversal
// del manejo de errores en publicFlow.js commit().
//
// Reproducción:
//   1. resetDb(); seedActiveAgreement({...}); seedTestClients();
//   2. Crear sign request + llevar a DOCUMENT_VIEWED.
//   3. Monkey-patch selectivo de signRequestService.registerEvent para
//      que lance cuando evento === 'SIGN_COMMITTED'.
//   4. POST /api/sign/:token/commit → 500 con error.code = 'INTERNAL_ERROR'
//      (no 'EVENT_REGISTRATION_FAILED' como sería ideal).
//
// FIX PROPUESTO (fuera de scope de I-E2E.5):
//   En publicFlow.js:511-516, envolver el `throw err` con un check:
//     if (err instanceof AppError) throw err;
//     throw new AppError(500, 'EVENT_REGISTRATION_FAILED',
//       'Fallo al registrar evento de auditoría en la tx de commit',
//       { original_error: err.message });
//   Alternativa transversal: helper `withAppErrorWrapping(fn, code, msg)`
//   que envuelva cualquier error de una callback como AppError tipado.
//   Esta segunda opción cubre HALLAZGO #3 (pdfGen) en el mismo helper.
// ============================================================================
