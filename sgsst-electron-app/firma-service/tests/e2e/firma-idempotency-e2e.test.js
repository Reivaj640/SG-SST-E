/**
 * Tests E2E del comportamiento de idempotency en composición (I-E2E.3, §F4).
 *
 * Este archivo complementa los tests unitarios del middleware y del service
 * verificando que la COMPOSICIÓN completa (I-010 per-empresa + I-005
 * idempotency + I-012 PDF + E6 consent + flujo público) interactúa
 * correctamente con la capa de idempotency usando `makeApp()` y el
 * stack HTTP real.
 *
 * Alcance I-E2E.3 (5 tests):
 *
 *   F4.1  clientA POST con Idempotency-Key NEW + flujo público completo
 *         → SIGNED. Verifica que la fila gh_idempotency_keys queda
 *         COMPLETED con response_body cacheado, y que el flujo público
 *         no se rompe por la capa de idempotency.
 *   F4.2  clientA POST 1 (NEW) + flujo público hasta DOCUMENT_VIEWED +
 *         POST 2 (REPLAY) con misma key + mismo fingerprint → 201 con
 *         X-Idempotency-Replay: true, mismo id_solicitud, sin crear
 *         sign request duplicado, y el commit final funciona con el
 *         token original.
 *   F4.3  clientA POST 1 (NEW con pdf1) + POST 2 con mismo key pero
 *         pdf2 (distinto SHA-256) → 409 IDEMPOTENCY_KEY_CONFLICT, sin
 *         crear nuevo sign request, response details con info del
 *         fingerprint.
 *   F4.4  PENDING pre-existente con misma key → 409
 *         IDEMPOTENCY_KEY_IN_PROGRESS + header Retry-After, sin crear
 *         nuevo sign request, fila PENDING preservada.
 *   F4.5  EXPIRED (>24h TTL) con misma key + mismo fingerprint →
 *         201 NEW (no REPLAY), X-Idempotency-Replay ausente, nuevo
 *         sign request en BD. Coverage NUEVO: I-005 no cubre TTL.
 *
 * Diferencias vs tests existentes:
 *   - tests/middleware/idempotency.test.js (16 secciones, 30+ tests):
 *     unit tests del middleware en aislamiento, con mini-app propia.
 *     Cubre NEW, REPLAY, CONFLICT, IN_PROGRESS, TERMINAL, INVALID,
 *     EXPIRED (§13), lifecycle 2xx/4xx/5xx, defense in depth, scope
 *     por id_empresa. NO cubre composición con authz, PDF validation,
 *     ni flujo público.
 *   - tests/services/idempotency.test.js: unit tests del service en
 *     aislamiento.
 *   - tests/routes/signRequest.test.js (I-005 section, 6 tests):
 *     HTTP-level con `makeApp()`, sin flujo público. Cubre sin-header
 *     (G3), REPLAY, CONFLICT, IN_PROGRESS, INVALID, LEGACY_NOT_SUPPORTED.
 *     NO cubre composición con flujo público ni EXPIRED.
 *
 * Acá cubrimos la COMPOSICIÓN:
 *   - NEW + flujo público completo (F4.1): verifica que la fila
 *     COMPLETED persiste y el flujo llega a SIGNED.
 *   - REPLAY a través del flujo público (F4.2): verifica que el
 *     REPLAY no interrumpe el flujo (el commit con el token original
 *     sigue funcionando).
 *   - EXPIRED end-to-end (F4.5): I-005 no lo cubre, y el contrato
 *     define que EXPIRED → NEW (no REPLAY). Caso de relevancia
 *     operativa: K+AIR reintenta después de 24h, NO debe recibir
 *     respuesta cacheada vieja.
 *
 * Tests posteriores (I-E2E.4 en adelante) cubren rate limit, atomicidad,
 * SHA-256 server-computed y PDF failures. Ver
 * docs/kair-firma-integration/INTEGRATION.md §5.
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
  withClientAApiKey,
  TEST_API_KEY_CLIENT_A, TEST_EMPRESA_A,
  createAcceptedConsent,
} = require('../helpers');

// =========================================================================
// HELPERS (locales; evito tocar tests/helpers.js para no contaminar la suite)
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
 * mínimos requeridos por zod (signRequestBody) + I-002 (tipo_identificacion).
 * El `document_hash` se calcula fuera (en el test) con el PDF real.
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
 * Recorre el flujo público completo desde PENDING hasta SIGNED.
 * Mismo helper que firma-flujo-completo.test.js, copiado acá para que
 * el archivo sea self-contained (no dependemos del helper de I-E2E.1
 * que podría evolucionar independientemente).
 */
async function recorrerFlujoCompleto(app, token) {
  // 0. GET /s/:token (dispara evento OPENED)
  const r0 = await request(app)
    .get(`/s/${token}`)
    .set('Accept', 'application/json');
  assert.equal(r0.status, 200, `GET /s/:token falló: ${r0.status} ${JSON.stringify(r0.body)}`);
  assert.equal(r0.body.estado, 'PENDING');

  // 1. Identify
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: '1234567890' });
  assert.equal(r1.status, 200, `identify: ${r1.status} ${JSON.stringify(r1.body)}`);
  const { devOtp } = r1.body;

  // 2. Verify OTP
  const r2 = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: devOtp });
  assert.equal(r2.status, 200, `verify-otp: ${r2.status} ${JSON.stringify(r2.body)}`);

  // 3. View document
  const r3 = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 30, scroll_al_final: true });
  assert.equal(r3.status, 200, `view-document: ${r3.status} ${JSON.stringify(r3.body)}`);

  // 4. Commit
  const r4 = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });
  assert.equal(r4.status, 200, `commit: ${r4.status} ${JSON.stringify(r4.body)}`);
  assert.equal(r4.body.estado, 'SIGNED');

  return r4.body;
}

// =========================================================================
// §F4 — IDEMPOTENCY E2E
// =========================================================================

/**
 * F4.1: NEW con Idempotency-Key + flujo público completo → SIGNED.
 *
 * Verifica la composición:
 *   - POST con Idempotency-Key K1 → 201 con token T1, sin X-Idempotency-Replay.
 *   - La fila gh_idempotency_keys se inserta, queda COMPLETED con
 *     response_status=201, response_body con el JSON cacheado.
 *   - El flujo público (5 pasos) corre sin interrupciones.
 *   - El sign request llega a SIGNED.
 *   - La fila COMPLETED persiste después del commit (no se borra).
 *
 * Coverage NO duplicado con I-005 (signRequest.test.js §I-005):
 *   I-005 cubre el POST en aislamiento. Acá cubrimos POST + flujo
 *   público + persistencia del estado de la fila.
 */
test('F4.1 clientA + Idempotency-Key NEW + full public flow → SIGNED + COMPLETED', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  seedTestClients();
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    version_acuerdo: 'v1.0',
  });
  const app = makeApp();
  const pdf = await makePdf('F4.1');
  const meta = buildMetadata(acuerdo, { consent_id });
  meta.document_hash = sha256(pdf);

  const idemKey = crypto.randomUUID();

  // 1. POST NEW
  const r1 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('Idempotency-Key', idemKey)
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r1.status, 201, `POST falló: ${JSON.stringify(r1.body)}`);
  assert.ok(r1.body.token, 'NEW debe retornar token (primera respuesta)');
  assert.equal(r1.headers['x-idempotency-replay'], undefined);
  const idSolicitud1 = r1.body.id_solicitud;

  // 2. Fila en BD con status COMPLETED + response cacheado
  const idemRow = db.prepare(`
    SELECT status, response_status, response_body, request_fingerprint
    FROM gh_idempotency_keys
    WHERE id_empresa = ? AND idempotency_key = ?
  `).get(TEST_EMPRESA_A, idemKey);
  assert.ok(idemRow, 'Fila gh_idempotency_keys debe existir tras el POST');
  assert.equal(idemRow.status, 'COMPLETED',
    'Tras 2xx, la fila debe quedar COMPLETED (no PENDING)');
  assert.equal(idemRow.response_status, 201,
    'response_status debe estar cacheado para REPLAY');
  assert.ok(idemRow.response_body, 'response_body debe estar cacheado');
  assert.ok(idemRow.request_fingerprint,
    'request_fingerprint debe estar calculado y persistido');
  const cachedBody = JSON.parse(idemRow.response_body);
  assert.equal(cachedBody.id_solicitud, idSolicitud1,
    'El body cacheado debe corresponder al sign request creado');

  // 3. Flujo público completo
  const commitBody = await recorrerFlujoCompleto(app, r1.body.token);
  assert.equal(commitBody.estado, 'SIGNED');

  // 4. La fila COMPLETED persiste después del commit
  const idemRowAfter = db.prepare(
    'SELECT status FROM gh_idempotency_keys WHERE id_empresa = ? AND idempotency_key = ?'
  ).get(TEST_EMPRESA_A, idemKey);
  assert.equal(idemRowAfter.status, 'COMPLETED',
    'Fila debe seguir COMPLETED tras el commit, no se borra');

  // 5. El sign request final está en BD con estado SIGNED
  const finalRow = db.prepare(
    'SELECT estado, consent_id FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(idSolicitud1);
  assert.equal(finalRow.estado, 'SIGNED');
  assert.equal(finalRow.consent_id, consent_id);
});

/**
 * F4.2: REPLAY después de que el flujo público empezó.
 *
 * Verifica que el REPLAY:
 *   - Retorna 201 con el mismo id_solicitud que el NEW original.
 *   - Lleva X-Idempotency-Replay: true.
 *   - NO crea un nuevo sign request en BD (sin duplicación).
 *   - NO interrumpe el flujo público: el commit con el token
 *     original (que vino del NEW) sigue funcionando hasta SIGNED.
 *
 * Coverage NO duplicado con I-005: I-005 cubre REPLAY en aislamiento
 * (sin flujo público). Acá verificamos que el REPLAY no rompe el flujo
 * en curso.
 */
test('F4.2 clientA + Idempotency-Key REPLAY after public flow started → state preserved', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  seedTestClients();
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    version_acuerdo: 'v1.0',
  });
  const app = makeApp();
  const pdf = await makePdf('F4.2');
  const meta = buildMetadata(acuerdo, { consent_id });
  meta.document_hash = sha256(pdf);

  const idemKey = crypto.randomUUID();

  // 1. POST 1: NEW
  const r1 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('Idempotency-Key', idemKey)
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r1.status, 201);
  const idSolicitud1 = r1.body.id_solicitud;
  const token1 = r1.body.token;

  // 2. Flujo público hasta DOCUMENT_VIEWED (sin commit aún)
  const r0 = await request(app)
    .get(`/s/${token1}`)
    .set('Accept', 'application/json');
  assert.equal(r0.status, 200);
  const rIdentify = await request(app)
    .post(`/api/sign/${token1}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: '1234567890' });
  assert.equal(rIdentify.status, 200);
  const rOtp = await request(app)
    .post(`/api/sign/${token1}/verify-otp`)
    .send({ otp: rIdentify.body.devOtp });
  assert.equal(rOtp.status, 200);
  const rView = await request(app)
    .post(`/api/sign/${token1}/view-document`)
    .send({ segundos_en_pagina: 30, scroll_al_final: true });
  assert.equal(rView.status, 200);
  assert.equal(rView.body.estado, 'DOCUMENT_VIEWED');

  // 3. POST 2: REPLAY con misma key + mismo PDF + mismo metadata
  const r2 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('Idempotency-Key', idemKey)
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r2.status, 201, `REPLAY falló: ${JSON.stringify(r2.body)}`);
  assert.equal(r2.headers['x-idempotency-replay'], 'true',
    'REPLAY debe llevar X-Idempotency-Replay: true');
  assert.equal(r2.body.id_solicitud, idSolicitud1,
    'REPLAY debe retornar el mismo id_solicitud');
  assert.equal(r2.body.token, token1,
    'REPLAY debe retornar el mismo token (mismo sign request)');

  // 4. NO se duplicó el sign request
  const signRequestCount = db.prepare(
    'SELECT COUNT(*) AS n FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(idSolicitud1).n;
  assert.equal(signRequestCount, 1,
    'Solo debe haber 1 sign request (REPLAY no duplica)');

  // 5. El commit con el token original funciona (estado preservado)
  const rCommit = await request(app)
    .post(`/api/sign/${token1}/commit`)
    .send({ manifestacion_aceptada: true });
  assert.equal(rCommit.status, 200,
    `commit falló tras REPLAY: ${rCommit.status} ${JSON.stringify(rCommit.body)}`);
  assert.equal(rCommit.body.estado, 'SIGNED');

  // 6. La fila sigue COMPLETED (el REPLAY no la reseteó)
  const idemRow = db.prepare(
    'SELECT status FROM gh_idempotency_keys WHERE id_empresa = ? AND idempotency_key = ?'
  ).get(TEST_EMPRESA_A, idemKey);
  assert.equal(idemRow.status, 'COMPLETED');
});

/**
 * F4.3: CONFLICT — mismo key + distinto PDF → 409.
 *
 * Verifica que cuando el cliente cambia el PDF manteniendo la misma key,
 * el fingerprint (que incluye pdf_sha256 server-computed) cambia, y el
 * servicio rechaza con 409 IDEMPOTENCY_KEY_CONFLICT.
 *
 * Coverage NO duplicado con I-005: I-005 cubre CONFLICT en aislamiento.
 * Acá verificamos que el PDF es rechazado ANTES de crear un sign request
 * (i.e., el body 409 no contiene token/url_publica).
 */
test('F4.3 clientA + same key + different PDF → 409 IDEMPOTENCY_KEY_CONFLICT', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const pdf1 = await makePdf('F4.3-v1');
  const pdf2 = await makePdf('F4.3-v2');
  // Sanity: SHA-256 distintos
  assert.notEqual(sha256(pdf1), sha256(pdf2),
    'sanity: PDFs distintos deben tener SHA-256 distintos');

  const idemKey = crypto.randomUUID();
  const meta1 = buildMetadata(acuerdo);
  meta1.document_hash = sha256(pdf1);

  // 1. POST 1: NEW con pdf1
  const r1 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('Idempotency-Key', idemKey)
      .field('metadata', JSON.stringify(meta1))
      .attach('documento', pdf1, 'v1.pdf')
  );
  assert.equal(r1.status, 201);
  const idSolicitud1 = r1.body.id_solicitud;

  // 2. POST 2: misma key, pero pdf2 (fingerprint diferente)
  const meta2 = buildMetadata(acuerdo);
  meta2.document_hash = sha256(pdf2);
  const r2 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('Idempotency-Key', idemKey)
      .field('metadata', JSON.stringify(meta2))
      .attach('documento', pdf2, 'v2.pdf')
  );
  assert.equal(r2.status, 409,
    'CONFLICT debe ser 409 (no 422, no 500)');
  assert.equal(r2.body.error.code, 'IDEMPOTENCY_KEY_CONFLICT');
  // El body 409 NO debe contener token ni url_publica (no se creó sign request)
  assert.equal(r2.body.token, undefined,
    'CONFLICT no debe retornar token (no se creó sign request)');
  assert.equal(r2.body.url_publica, undefined);

  // 3. Solo existe el sign request original (del POST 1)
  const signRequestCount = db.prepare(
    'SELECT COUNT(*) AS n FROM gh_firmas_electronicas'
  ).get().n;
  assert.equal(signRequestCount, 1,
    'CONFLICT no debe crear nuevo sign request');
  const finalRow = db.prepare(
    'SELECT id_solicitud FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(idSolicitud1);
  assert.ok(finalRow, 'El sign request original debe seguir existiendo');
});

/**
 * F4.4: IN_PROGRESS — PENDING pre-existente con misma key → 409 + Retry-After.
 *
 * Verifica el caso "otra request está en curso": una fila PENDING con
 * la misma key bloquea la nueva request con 409 IDEMPOTENCY_KEY_IN_PROGRESS
 * + header Retry-After.
 *
 * Coverage NO duplicado con I-005: I-005 cubre IN_PROGRESS en aislamiento.
 * Acá verificamos que el estado de la fila PENDING NO se altera
 * (sigue PENDING, mismo created_at).
 */
test('F4.4 clientA + same key with PENDING pre-existente → 409 IDEMPOTENCY_KEY_IN_PROGRESS + Retry-After', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const pdf = await makePdf('F4.4');
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256(pdf);

  const idemKey = crypto.randomUUID();
  const pdfSha256 = sha256(pdf);

  // 1. Insertar manualmente una fila PENDING con la misma key
  //    Patrón: el service la detectará por la PK compuesta y retornará
  //    IdempotencyKeyInProgress, que el middleware mapea a 409 con Retry-After.
  //    El fingerprint no es relevante (la fila es PENDING, no se compara).
  const seedFingerprint = sha256(JSON.stringify({ test: 'pre-existing' }));
  const insertResult = db.prepare(`
    INSERT INTO gh_idempotency_keys
      (id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, 'PENDING', strftime('%Y-%m-%dT%H:%M:%fZ','now'),
            strftime('%Y-%m-%dT%H:%M:%fZ','now', '+24 hours'))
  `).run(TEST_EMPRESA_A, idemKey, seedFingerprint, pdfSha256);
  assert.equal(insertResult.changes, 1, 'Fila PENDING debe insertarse');

  // 2. POST con la misma key → debe ser IN_PROGRESS
  const r1 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('Idempotency-Key', idemKey)
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r1.status, 409,
    'IN_PROGRESS debe ser 409 (no 500)');
  assert.equal(r1.body.error.code, 'IDEMPOTENCY_KEY_IN_PROGRESS');
  // Header Retry-After presente y >= 1
  const retryAfter = parseInt(r1.headers['retry-after'], 10);
  assert.ok(retryAfter >= 1, `Retry-After debe ser >= 1, obtuve ${retryAfter}`);

  // 3. NO se creó un nuevo sign request
  const signRequestCount = db.prepare(
    'SELECT COUNT(*) AS n FROM gh_firmas_electronicas'
  ).get().n;
  assert.equal(signRequestCount, 0,
    'IN_PROGRESS no debe crear sign request');

  // 4. La fila PENDING sigue en BD sin alteración
  const idemRow = db.prepare(`
    SELECT status, request_fingerprint
    FROM gh_idempotency_keys
    WHERE id_empresa = ? AND idempotency_key = ?
  `).get(TEST_EMPRESA_A, idemKey);
  assert.equal(idemRow.status, 'PENDING',
    'Fila PENDING no debe alterarse por la request rechazada');
  assert.equal(idemRow.request_fingerprint, seedFingerprint,
    'Fingerprint de la fila PENDING no debe alterarse');
});

/**
 * F4.5: EXPIRED (>24h TTL) con misma key + mismo fingerprint → 201 NEW.
 *
 * Verifica que cuando una fila COMPLETED/FAILED/TERMINAL con la misma
 * key ha expirado (TTL 24h pasado), una nueva request con la misma
 * key + mismo fingerprint NO se trata como REPLAY sino como NEW:
 *   - Status 201 (no 200, no 409).
 *   - X-Idempotency-Replay ausente.
 *   - Se crea un nuevo sign request (nuevo id_solicitud, nuevo token).
 *   - La fila antigua se reemplaza (el service hace DELETE + INSERT).
 *
 * Coverage NUEVO: I-005 no cubre EXPIRED. Caso operativamente importante:
 * K+AIR reintenta después de 24h, NO debe recibir la respuesta cacheada
 * vieja (eso sería un bug serio: el sign request original podría estar
 * firmado hace días).
 */
test('F4.5 clientA + same key expired (>24h) + same fingerprint → 201 NEW (not REPLAY)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const pdf = await makePdf('F4.5');
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256(pdf);

  const idemKey = crypto.randomUUID();
  const pdfSha256 = sha256(pdf);

  // 1. Calcular el fingerprint que el server va a computar
  //    (mismo algoritmo: canonicalJSON({...meta, pdf_sha256: lowercase}))
  const expectedFingerprint = sha256(canonicalJSON({
    ...meta,
    pdf_sha256: pdfSha256.toLowerCase(),
  }));

  // 2. Insertar manualmente una fila COMPLETED EXPIRED con la misma
  //    key + mismo fingerprint + expires_at < now.
  //    El "response_body" viejo es un JSON cualquiera (simula respuesta
  //    cacheada de hace > 24h). Si el server retornara esto, sería un bug
  //    grave: K+AIR recibiría info de un sign request firmado hace días.
  const oldResponseBody = JSON.stringify({
    id_solicitud: 'SIGN-2020-OLD',
    token: 'old-token-should-NOT-be-returned',
    url_publica: 'http://old.example/s/old',
    estado: 'SIGNED',
  });

  db.prepare(`
    INSERT INTO gh_idempotency_keys
      (id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status,
       created_at, expires_at, response_status, response_body, completed_at)
    VALUES (?, ?, ?, ?, 'COMPLETED',
            strftime('%Y-%m-%dT%H:%M:%fZ','now', '-25 hours'),
            strftime('%Y-%m-%dT%H:%M:%fZ','now', '-1 hours'),
            201, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now', '-25 hours'))
  `).run(
    TEST_EMPRESA_A,
    idemKey,
    expectedFingerprint,
    pdfSha256,
    oldResponseBody
  );

  // 3. POST con la misma key + mismo fingerprint → debe ser NEW (no REPLAY)
  const r1 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('Idempotency-Key', idemKey)
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r1.status, 201,
    'EXPIRED debe ser 201 (NEW, no 200 con REPLAY de respuesta vieja)');
  assert.equal(r1.headers['x-idempotency-replay'], undefined,
    'EXPIRED no debe llevar X-Idempotency-Replay: true (NO es REPLAY)');
  // El token NO debe ser el viejo cacheado
  assert.notEqual(r1.body.token, 'old-token-should-NOT-be-returned',
    'Token de EXPIRED no debe ser el cacheado de hace 24h+');
  assert.ok(r1.body.token, 'EXPIRED debe retornar token NUEVO');
  // El id_solicitud NO debe ser el viejo cacheado
  assert.notEqual(r1.body.id_solicitud, 'SIGN-2020-OLD',
    'id_solicitud de EXPIRED no debe ser el cacheado viejo');
  assert.match(r1.body.id_solicitud, /^SIGN-\d{4}-\d{6}$/);

  // 4. La fila vieja fue reemplazada: ahora hay 1 fila en BD con la
  //    nueva response_body (no la vieja) y status COMPLETED.
  const idemRows = db.prepare(`
    SELECT status, response_status, response_body, request_fingerprint
    FROM gh_idempotency_keys
    WHERE id_empresa = ? AND idempotency_key = ?
  `).all(TEST_EMPRESA_A, idemKey);
  assert.equal(idemRows.length, 1,
    'Debe haber exactamente 1 fila (la vieja fue eliminada, la nueva insertada)');
  assert.equal(idemRows[0].status, 'COMPLETED');
  assert.equal(idemRows[0].response_status, 201);
  const newCachedBody = JSON.parse(idemRows[0].response_body);
  assert.equal(newCachedBody.id_solicitud, r1.body.id_solicitud,
    'response_body cacheado debe ser el del sign request NUEVO');
  assert.notEqual(newCachedBody.id_solicitud, 'SIGN-2020-OLD');
  // El fingerprint sigue siendo el mismo (la nueva fila se inserta con
  // el fingerprint del request actual, que es el mismo que el viejo)
  assert.equal(idemRows[0].request_fingerprint, expectedFingerprint);

  // 5. Se creó un nuevo sign request (no se reusó el viejo)
  const signRequestCount = db.prepare(
    'SELECT COUNT(*) AS n FROM gh_firmas_electronicas'
  ).get().n;
  assert.equal(signRequestCount, 1,
    'Debe haber 1 sign request nuevo (EXPIRED crea uno nuevo, no reusa el viejo)');
  const signRequestRow = db.prepare(
    'SELECT id_solicitud FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(r1.body.id_solicitud);
  assert.ok(signRequestRow, 'El sign request nuevo debe existir en BD');
});
