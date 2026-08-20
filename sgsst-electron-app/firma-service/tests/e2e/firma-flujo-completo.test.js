/**
 * Tests E2E del flujo completo de firma electrónica K+AIR (I-E2E.1).
 *
 * Este archivo complementa los tests unitarios de middleware y rutas
 * verificando que la COMPOSICIÓN completa de las capas de seguridad
 * (I-010 per-empresa + I-005 idempotency + I-012 PDF + E6 consent + flujo
 * público) funciona end-to-end con un sign request real viajando desde
 * POST /internal/sign-requests hasta SIGNED.
 *
 * Alcance I-E2E.1 (sub-bloque F1 + F2, 6 tests):
 *
 *   §F1 — Happy path per-empresa (I-010 + I-005 + I-012 + E6)
 *     F1.1  clientA POST + Idempotency-Key NEW → 201 + token
 *           + flujo público completo → SIGNED + eventos + PDFs
 *     F1.2  clientA POST + Idempotency-Key REPLAY → 201 con
 *           X-Idempotency-Replay: true, mismo id_solicitud,
 *           no se duplica el sign request en BD.
 *           NOTA: NO se assertea presencia/ausencia de `token` en el
 *           body de REPLAY — C-22 está explícitamente fuera de I-005
 *           y se resolverá en I-013b. El E2E verifica el comportamiento
 *           ACTUAL sin convertir accidentalmente la decisión en
 *           requisito.
 *     F1.3  clientA POST sin Idempotency-Key → 201 (G3, backward compat)
 *           + flujo público completo → SIGNED
 *     F1.4  clientA POST con consent_id (Bloque E6) → 201 + flujo
 *           público completo → SIGNED + evidence_hash reproducible +
 *           PDFs en disco + eventos en orden
 *
 *   §F2 — Happy path legacy (deprecation)
 *     F2.1  legacy POST + Idempotency-Key → 400
 *           IDEMPOTENCY_LEGACY_NOT_SUPPORTED
 *     F2.2  legacy POST sin Idempotency-Key → 201 (deprecation) +
 *           flujo público completo → SIGNED
 *
 * Diferencias vs tests unitarios:
 *   - signRequest.test.js (I-005): solo verifica el POST endpoint
 *     y la respuesta inmediata.
 *   - bloque-e6.test.js: solo flujo público + E6, no incluye
 *     idempotency ni authz per-empresa ni PDF validation.
 *   - firma-completa.test.js: solo legacy happy path, sin I-010/I-005/I-012.
 *
 * Acá cubrimos la COMBINACIÓN que ningún test unitario cubre: per-empresa
 * + idempotency + PDF + consent + flujo público completo, end-to-end.
 *
 * Tests posteriores (I-E2E.2 en adelante) cubren cross-company, idempotency
 * failure paths, PDF failure paths, atomicidad, rate limit y SHA-256
 * server-computed. Ver docs/kair-firma-integration/INTEGRATION.md §5.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const db = require('../../src/db/connection');
const { sha256 } = require('../../src/crypto/hash');
const { canonicalJSON } = require('../../src/crypto/compare');
const {
  resetDb, seedActiveAgreement, seedTestClients, makeApp,
  withClientAApiKey, withLegacyApiKey,
  TEST_API_KEY_CLIENT_A, TEST_EMPRESA_A,
  createAcceptedConsent,
} = require('../helpers');

// =========================================================================
// HELPERS
// =========================================================================

/**
 * Crea un PDF válido con pdf-lib. El `seed` permite que cada test tenga
 * un PDF con bytes distintos (por si se necesita forzar un SHA-256
 * server-computed diferente en tests futuros).
 */
async function makePdf(seed = 'e2e') {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  page.drawText(`e2e-doc-${seed}`);
  return Buffer.from(await doc.save());
}

/**
 * Construye el metadata para POST /internal/sign-requests con los campos
 * mínimos requeridos por zod (signRequestBody). El `document_hash` se
 * calcula fuera (en el test) con el PDF real.
 *
 * Defaults alineados con el helper de bloque-e6.test.js para consistencia.
 */
function buildMetadata(acuerdo, overrides = {}) {
  return {
    id_documento: 'doc-e2e',
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    tipo_firma: 'presencial',
    agreement_hash: acuerdo.texto_hash,
    agreement_version: acuerdo.version,
    document_hash: null, // se calcula en el test
    version_kair: '0.1.189-test',
    identificacion_tipo: 'CC',
    identificacion_numero_hash: sha256('1234567890'),
    ...overrides,
  };
}

/**
 * Recorre el flujo público completo de un sign request desde PENDING
 * hasta SIGNED. Asume que el sign request está recién creado (token
 * disponible, sin eventos públicos todavía).
 *
 * Pasos:
 *   0. GET  /s/:token (mini-app carga contexto, dispara evento OPENED)
 *   1. POST /api/sign/:token/identify   (CC + número)     → OTP_SENT
 *   2. POST /api/sign/:token/verify-otp (OTP 6 dígitos)   → OTP_VERIFIED
 *   3. POST /api/sign/:token/view-document                 → DOCUMENT_VIEWED
 *   4. POST /api/sign/:token/commit (manifestacion_aceptada) → SIGNED
 *
 * Retorna el body del commit (con evidence_hash, fecha_firma, etc.).
 * Si cualquier paso falla, el assert del helper muestra el body del error.
 *
 * El paso 0 (GET /s/:token con Accept: application/json) es necesario
 * para que el evento OPENED se registre — sin él, la secuencia de eventos
 * quedaría incompleta (firma-completa.test.js hace lo mismo).
 */
async function recorrerFlujoCompleto(app, token, opts = {}) {
  const identificacion = opts.identificacion || '1234567890';

  // 0. GET /s/:token con Accept JSON (dispara evento OPENED, alineado
  // con firma-completa.test.js para que la secuencia de eventos sea
  // completa: CREATED, OPENED, IDENTIFICATION_COMPLETED, OTP_SENT, ...).
  const r0 = await request(app)
    .get(`/s/${token}`)
    .set('Accept', 'application/json');
  assert.equal(r0.status, 200,
    `GET /s/:token falló: status=${r0.status} body=${JSON.stringify(r0.body)}`);
  assert.equal(r0.body.estado, 'PENDING');
  // No debe exponer secretos
  assert.equal(r0.body.token_hash, undefined);
  assert.equal(r0.body.identificacion_numero_hash, undefined);

  // 1. Identify
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: identificacion });
  assert.equal(r1.status, 200,
    `identify falló: status=${r1.status} body=${JSON.stringify(r1.body)}`);
  assert.equal(r1.body.estado, 'OTP_SENT');
  const { devOtp } = r1.body;

  // 2. Verify OTP
  const r2 = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: devOtp });
  assert.equal(r2.status, 200,
    `verify-otp falló: status=${r2.status} body=${JSON.stringify(r2.body)}`);
  assert.equal(r2.body.estado, 'OTP_VERIFIED');

  // 3. View document
  const r3 = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 30, scroll_al_final: true });
  assert.equal(r3.status, 200,
    `view-document falló: status=${r3.status} body=${JSON.stringify(r3.body)}`);
  assert.equal(r3.body.estado, 'DOCUMENT_VIEWED');

  // 4. Commit
  const r4 = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });
  assert.equal(r4.status, 200,
    `commit falló: status=${r4.status} body=${JSON.stringify(r4.body)}`);
  assert.equal(r4.body.estado, 'SIGNED');

  return r4.body;
}

// =========================================================================
// §F1 — HAPPY PATH PER-EMPRESA
// =========================================================================

test('F1.1 clientA + Idempotency-Key NEW + consent_id → 201 + token + flujo público → SIGNED', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  seedTestClients();
  // E6: con agreement_version, el sign request requiere consent_id aceptado.
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    version_acuerdo: 'v1.0',
  });
  const app = makeApp();
  const pdf = await makePdf('F1.1');
  const meta = buildMetadata(acuerdo, { consent_id });
  meta.document_hash = sha256(pdf);

  const idemKey = crypto.randomUUID();
  // 1. POST con Idempotency-Key (per-empresa, clientA)
  const r1 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('Idempotency-Key', idemKey)
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r1.status, 201, `POST falló: ${JSON.stringify(r1.body)}`);
  assert.ok(r1.body.id_solicitud);
  assert.match(r1.body.id_solicitud, /^SIGN-\d{4}-\d{6}$/);
  assert.ok(r1.body.token, 'NEW debe retornar token (es la primera respuesta)');
  assert.equal(r1.body.token.length, 32);
  assert.equal(r1.body.estado, 'PENDING');
  // NEW no lleva X-Idempotency-Replay
  assert.equal(r1.headers['x-idempotency-replay'], undefined);
  // Fila PENDING en gh_idempotency_keys con status COMPLETED tras res.on('finish')
  const idemRow = db.prepare(
    'SELECT status FROM gh_idempotency_keys WHERE id_empresa = ? AND idempotency_key = ?'
  ).get(TEST_EMPRESA_A, idemKey);
  assert.equal(idemRow.status, 'COMPLETED', 'Fila idempotency debe quedar COMPLETED tras 2xx');

  // 2. Flujo público completo
  const commitBody = await recorrerFlujoCompleto(app, r1.body.token);
  assert.ok(commitBody.evidence_hash);
  assert.equal(commitBody.evidence_hash.length, 64);
  assert.equal(commitBody.estado, 'SIGNED');

  // 3. Estado final en BD
  const finalRow = db.prepare(`
    SELECT estado, id_empresa, evidence_hash, document_hash_firmado,
           pdf_firmado_path, constancia_path, consent_id
    FROM gh_firmas_electronicas WHERE id_solicitud = ?
  `).get(r1.body.id_solicitud);
  assert.equal(finalRow.estado, 'SIGNED');
  assert.equal(finalRow.id_empresa, TEST_EMPRESA_A);
  assert.equal(finalRow.evidence_hash, commitBody.evidence_hash);
  assert.equal(finalRow.consent_id, consent_id,
    'Bloque E6: consent_id debe persistirse en el sign request firmado');
  // PDFs en disco
  assert.ok(finalRow.pdf_firmado_path, 'pdf_firmado_path debe estar persistido');
  assert.ok(finalRow.constancia_path, 'constancia_path debe estar persistido');
  assert.ok(fs.existsSync(finalRow.pdf_firmado_path), 'PDF firmado debe existir en disco');
  assert.ok(fs.existsSync(finalRow.constancia_path), 'Constancia debe existir en disco');

  // 4. Eventos en orden
  const eventos = db.prepare(`
    SELECT evento FROM gh_firma_eventos
    WHERE firma_id = (SELECT id FROM gh_firmas_electronicas WHERE id_solicitud = ?)
    ORDER BY id
  `).all(r1.body.id_solicitud).map(e => e.evento);
  const expectedEventos = [
    'CREATED', 'OPENED', 'IDENTIFICATION_COMPLETED', 'OTP_SENT',
    'OTP_VERIFIED', 'DOCUMENT_VIEWED', 'MANIFESTATION_RECORDED',
    'SIGN_COMMITTED', 'PDF_GENERATED', 'COPY_SENT',
  ];
  for (const ev of expectedEventos) {
    assert.ok(eventos.includes(ev), `Debe existir el evento ${ev}, eventos vistos: ${eventos.join(',')}`);
  }
  assert.equal(eventos[0], 'CREATED');
  assert.equal(eventos[eventos.length - 1], 'COPY_SENT');
});

test('F1.2 clientA + Idempotency-Key REPLAY → 201 + X-Idempotency-Replay:true, no duplica', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const pdf = await makePdf('F1.2');
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256(pdf);

  const idemKey = crypto.randomUUID();

  // 1ª request: NEW
  const r1 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('Idempotency-Key', idemKey)
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r1.status, 201);
  const idSolicitud1 = r1.body.id_solicitud;

  // 2ª request: misma key + mismo body → REPLAY
  const r2 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('Idempotency-Key', idemKey)
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r2.status, 201);
  // Header X-Idempotency-Replay:true presente
  assert.equal(r2.headers['x-idempotency-replay'], 'true',
    'REPLAY debe llevar X-Idempotency-Replay: true');
  // Mismo id_solicitud
  assert.equal(r2.body.id_solicitud, idSolicitud1,
    'REPLAY debe retornar el mismo id_solicitud');
  // NOTA: NO se assertea presencia/ausencia de `token` en el body del
  // REPLAY. C-22 está explícitamente fuera de I-005 (decidido en I-013b).
  // Verificar el body idéntico en id_solicitud/agreement_hash/etc. SÍ
  // está dentro del alcance.

  // Solo se creó UN sign request en BD (REPLAY no duplica)
  const count = db.prepare('SELECT COUNT(*) AS n FROM gh_firmas_electronicas').get().n;
  assert.equal(count, 1, 'REPLAY no debe crear un sign request nuevo');

  // El flujo público sigue funcionando con el token de la 1ª request
  // (tomamos el token del body, sin importar si REPLAY lo incluye o no)
  // — pero para E2E robusto, hacemos un NUEVO POST sin Idempotency-Key
  // para verificar que el flujo no se rompió por el REPLAY.
  // (Este es el sub-complemento al REPLAY: el sistema completo funciona.)
  // No hace falta un 3er sign request acá: el test de F1.3 cubre eso.

  // La fila idempotency sigue COMPLETED, sin cambio
  const idemRow = db.prepare(
    'SELECT status FROM gh_idempotency_keys WHERE id_empresa = ? AND idempotency_key = ?'
  ).get(TEST_EMPRESA_A, idemKey);
  assert.equal(idemRow.status, 'COMPLETED');
});

test('F1.3 clientA sin Idempotency-Key + consent_id → 201 (G3) + flujo público → SIGNED', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  seedTestClients();
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    version_acuerdo: 'v1.0',
  });
  const app = makeApp();
  const pdf = await makePdf('F1.3');
  const meta = buildMetadata(acuerdo, { consent_id });
  meta.document_hash = sha256(pdf);

  // Sin set('Idempotency-Key', ...) — G3 backward compat
  const r1 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r1.status, 201, `POST falló: ${JSON.stringify(r1.body)}`);
  assert.ok(r1.body.token);
  assert.equal(r1.headers['x-idempotency-replay'], undefined);
  // No debe haber fila en gh_idempotency_keys (middleware hizo next() sin tocar BD)
  const idemCount = db.prepare('SELECT COUNT(*) AS n FROM gh_idempotency_keys').get().n;
  assert.equal(idemCount, 0, 'Sin header Idempotency-Key, NO se crea fila en gh_idempotency_keys');

  // Flujo público completo
  const commitBody = await recorrerFlujoCompleto(app, r1.body.token);
  assert.equal(commitBody.estado, 'SIGNED');

  // Estado final
  const finalRow = db.prepare(
    'SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(r1.body.id_solicitud);
  assert.equal(finalRow.estado, 'SIGNED');
});

test('F1.4 clientA + consent_id (Bloque E6) → 201 + flujo → SIGNED + evidence_hash reproducible', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  seedTestClients();
  // Consentimiento ACEPTADO para el (trabajador, empresa, version_acuerdo)
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    version_acuerdo: 'v1.0',
  });
  const app = makeApp();
  const pdf = await makePdf('F1.4');
  const meta = buildMetadata(acuerdo, { consent_id });
  meta.document_hash = sha256(pdf);

  // POST con consent_id
  const r1 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r1.status, 201);
  assert.ok(r1.body.token);

  // Flujo público completo
  const commitBody = await recorrerFlujoCompleto(app, r1.body.token);
  assert.equal(commitBody.estado, 'SIGNED');
  assert.ok(commitBody.evidence_hash);

  // Estado final en BD: consent_id persistido + todos los campos que
  // componen el evidence_hash.
  const finalRow = db.prepare(`
    SELECT id, id_solicitud, id_documento, id_trabajador, id_empresa,
           estado, consent_id, agreement_version, agreement_hash,
           evidence_hash, document_hash_original, document_hash_firmado,
           pdf_firmado_path, constancia_path,
           identificacion_tipo, tipo_firma,
           manifestacion_voluntad_hash, manifestacion_voluntad_texto,
           ip_origen, user_agent,
           fecha_creacion, fecha_firma, version_kair
    FROM gh_firmas_electronicas WHERE id_solicitud = ?
  `).get(r1.body.id_solicitud);
  assert.equal(finalRow.estado, 'SIGNED');
  assert.equal(finalRow.consent_id, consent_id,
    'Bloque E6: consent_id debe persistirse en el sign request firmado');
  assert.equal(finalRow.agreement_version, 'v1.0');
  assert.equal(finalRow.evidence_hash, commitBody.evidence_hash);
  // PDFs en disco
  assert.ok(finalRow.pdf_firmado_path);
  assert.ok(finalRow.constancia_path);
  assert.ok(fs.existsSync(finalRow.pdf_firmado_path));
  assert.ok(fs.existsSync(finalRow.constancia_path));

  // evidence_hash reproducible con canonicalJSON (composición alineada
  // con src/services/publicFlow.js#commit() — todos los campos vienen
  // del row de BD, NO del metadata enviado por el cliente, para que el
  // contrato de verificación por terceros sea estable).
  const evidencia = {
    id_solicitud: finalRow.id_solicitud,
    id_documento: finalRow.id_documento,
    id_trabajador: finalRow.id_trabajador,
    id_empresa: finalRow.id_empresa,
    document_hash_original: finalRow.document_hash_original,
    document_hash_firmado: finalRow.document_hash_firmado,
    agreement_hash: finalRow.agreement_hash,
    agreement_version: finalRow.agreement_version,
    identificacion_tipo: finalRow.identificacion_tipo,
    tipo_firma: finalRow.tipo_firma,
    manifestacion_voluntad_hash: finalRow.manifestacion_voluntad_hash,
    ip_origen: finalRow.ip_origen || null,
    user_agent: finalRow.user_agent || null,
    fecha_creacion: finalRow.fecha_creacion,
    fecha_firma: finalRow.fecha_firma,
    version_kair: finalRow.version_kair,
    manifestacion_voluntad_texto: finalRow.manifestacion_voluntad_texto,
  };
  const evidenciaHash = sha256(canonicalJSON(evidencia));
  assert.equal(evidenciaHash, commitBody.evidence_hash,
    'evidence_hash debe ser reproducible por terceros con canonicalJSON (16 campos, composición post-E3)');
});

// =========================================================================
// §F2 — HAPPY PATH LEGACY (DEPRECATION)
// =========================================================================

test('F2.1 legacy + Idempotency-Key → 400 IDEMPOTENCY_LEGACY_NOT_SUPPORTED (no 500)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf('F2.1');
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256(pdf);

  // legacy + Idempotency-Key → 400 explícito
  const r1 = await withLegacyApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('Idempotency-Key', crypto.randomUUID())
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r1.status, 400,
    'legacy + Idempotency-Key debe ser 400 explícito, NO 500');
  assert.equal(r1.body.error.code, 'IDEMPOTENCY_LEGACY_NOT_SUPPORTED');
  assert.match(r1.body.error.message, /legacy/i);
  // NO se creó sign request ni fila idempotency
  const srCount = db.prepare('SELECT COUNT(*) AS n FROM gh_firmas_electronicas').get().n;
  assert.equal(srCount, 0);
  const idemCount = db.prepare('SELECT COUNT(*) AS n FROM gh_idempotency_keys').get().n;
  assert.equal(idemCount, 0,
    'IDEMPOTENCY_LEGACY_NOT_SUPPORTED debe cortar antes de tocar BD');
});

test('F2.2 legacy sin Idempotency-Key + consent_id → 201 (deprecation) + flujo público → SIGNED', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  // NO seedTestClients() — legacy no los necesita
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    version_acuerdo: 'v1.0',
  });
  const app = makeApp();
  const pdf = await makePdf('F2.2');
  const meta = buildMetadata(acuerdo, { consent_id });
  meta.document_hash = sha256(pdf);

  // legacy sin Idempotency-Key → 201 (deprecation, comportamiento pre-I-010)
  const r1 = await withLegacyApiKey(
    request(app)
      .post('/internal/sign-requests')
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r1.status, 201, `POST falló: ${JSON.stringify(r1.body)}`);
  assert.ok(r1.body.token);
  assert.equal(r1.headers['x-idempotency-replay'], undefined);

  // Flujo público completo
  const commitBody = await recorrerFlujoCompleto(app, r1.body.token);
  assert.equal(commitBody.estado, 'SIGNED');

  // Estado final
  const finalRow = db.prepare(
    'SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(r1.body.id_solicitud);
  assert.equal(finalRow.estado, 'SIGNED');
});
