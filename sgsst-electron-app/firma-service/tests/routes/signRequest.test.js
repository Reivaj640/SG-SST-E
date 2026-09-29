/**
 * Tests del endpoint POST /internal/sign-requests + GET /:id + GET lista.
 *
 * Cubre:
 * - POST /internal/sign-requests
 *   - PDF válido → 201 + token + url_publica
 *   - Token NUNCA en BD (solo token_hash)
 *   - document_hash se valida
 *   - PDF inválido (no magic bytes) → 400
 *   - Falta archivo → 400
 *   - Body inválido → 400
 *   - API key incorrecta → 401
 *   - Evento CREATED registrado
 *
 * - GET /internal/sign-requests/:id
 *   - Por id_solicitud → 200
 *   - Por id interno → 200
 *   - Inexistente → 404
 *
 * - GET /internal/sign-requests
 *   - Lista vacía → 200 con total=0
 *   - Lista con filtros → 200
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const { sha256 } = require('../../src/crypto/hash');
const config = require('../../src/config');
const db = require('../../src/db/connection');
const {
  resetDb, seedActiveAgreement, makeApp, TEST_API_KEY, TEST_API_KEY_CLIENT_A,
  TEST_EMPRESA_A, seedTestClients,
} = require('../helpers');
const storage = require('../../src/services/storage');

const HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };

// Crea un PDF mínimo válido (estructuralmente correcto, pasa pdfValidation de I-012.2)
async function makePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([300, 200]);
  return Buffer.from(await doc.save());
}

function sha256Hex(buffer) {
  return sha256(buffer);
}

/**
 * Construye metadata con el hash y la versión del Acuerdo sembrado.
 * Cada test que crea un sign request debe llamar antes a seedActiveAgreement()
 * para que esta función tenga un Acuerdo del cual tomar agreement_hash/agreement_version.
 */
function buildMetadata(acuerdo, overrides = {}) {
  return {
    id_documento: 'doc-001',
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    tipo_firma: 'presencial',
    agreement_hash: acuerdo.texto_hash,
    agreement_version: acuerdo.version,
    document_hash: null, // se calcula
    version_kair: '0.1.189',
    ...overrides,
  };
}

// =================================================================
// POST /internal/sign-requests
// =================================================================

test('POST /internal/sign-requests: PDF válido → 201 + token + url', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  assert.equal(res.status, 201);
  assert.ok(res.body.id_solicitud);
  assert.match(res.body.id_solicitud, /^SIGN-\d{4}-\d{6}$/);
  assert.ok(res.body.id_interno);
  assert.equal(res.body.estado, 'PENDING');
  assert.equal(res.body.tipo_firma, 'presencial');
  assert.equal(res.body.document_hash_original, meta.document_hash);
  assert.equal(res.body.agreement_hash, meta.agreement_hash);
  assert.ok(res.body.token);
  assert.equal(res.body.token.length, 32);
  // Validar contra config.publicUrl (no hardcoded) para que el test sea
  // robusto a diferentes entornos (3001, 3737, prod, etc.).
  assert.equal(res.body.url_publica, `${config.publicUrl}/s/${res.body.token}`);
  assert.equal(res.body.qr_payload, res.body.url_publica);
  assert.ok(res.body.fecha_creacion);
  assert.ok(res.body.fecha_expiracion);
});

test('POST /internal/sign-requests: token NO se almacena en plano en BD', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  const token = res.body.token;

  // Verificar que el token_hash en BD es SHA-256(token), no el token
  const row = db.prepare('SELECT token_hash FROM gh_firmas_electronicas WHERE id = ?').get(res.body.id_interno);
  const expected_hash = sha256(token);
  assert.equal(row.token_hash, expected_hash);
  assert.notEqual(row.token_hash, token, 'Token NO debe quedar en plano en BD');
});

test('POST /internal/sign-requests: PDF guardado en storage', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  const row = db.prepare('SELECT pdf_original_path FROM gh_firmas_electronicas WHERE id = ?').get(res.body.id_interno);
  assert.ok(row.pdf_original_path);
  assert.ok(storage.exists(row.pdf_original_path), 'PDF debe existir en storage');

  // El contenido guardado debe coincidir
  const contenido = storage.readPdf(row.pdf_original_path);
  assert.ok(contenido.slice(0, 5).equals(Buffer.from('%PDF-')));
});

test('POST /internal/sign-requests: evento CREATED registrado', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  const eventos = db.prepare(`
    SELECT evento, id_actor, metadata
    FROM gh_firma_eventos
    WHERE firma_id = ?
    ORDER BY id
  `).all(res.body.id_interno);

  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].evento, 'CREATED');
  assert.equal(eventos[0].id_actor, 'rh:system');
  const meta_evento = JSON.parse(eventos[0].metadata);
  assert.equal(meta_evento.id_documento, meta.id_documento);
});

test('POST /internal/sign-requests: estado inicial PENDING + sesión creada', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  const row = db.prepare('SELECT estado, sesion_id FROM gh_firmas_electronicas WHERE id = ?').get(res.body.id_interno);
  assert.equal(row.estado, 'PENDING');
  assert.ok(row.sesion_id);

  const sesion = db.prepare('SELECT estado_sesion FROM gh_firma_sesiones WHERE firma_id = ?').get(res.body.id_interno);
  assert.equal(sesion.estado_sesion, 'PENDING');
});

test('POST /internal/sign-requests: client document_hash se ignora; server usa el calculado (I-012.2)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const serverSha = sha256Hex(pdf); // SHA-256 server-computed del PDF real
  // El cliente envía un hash INCORRECTO. Pre-I-012.2 esto causaba 422
  // DOCUMENT_HASH_MISMATCH. Post-I-012.2: el hash del cliente se IGNORA
  // (mejora de seguridad: el cliente no puede mentir sobre el hash para
  // evadir el control de idempotencia). El server usa el suyo, calculado
  // por el middleware pdfValidation() sobre el buffer real.
  const meta = buildMetadata(acuerdo, { document_hash: 'f'.repeat(64) });

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  // El servidor IGNORA el hash del cliente y calcula el suyo. Request con
  // PDF válido + hash incorrecto debe succeed (cliente no controla el hash).
  assert.equal(res.status, 201);
  // El hash persistido es el del servidor, NO el del cliente.
  assert.equal(res.body.document_hash_original, serverSha,
    'el hash persistido debe ser el server-computed, no el del cliente');
  assert.notEqual(res.body.document_hash_original, 'f'.repeat(64),
    'el hash del cliente no debe terminar persistido');
  // El hash del cliente NO debe aparecer en la response body
  // (solo se exponen campos PII-safe del sign request).
  const bodyStr = JSON.stringify(res.body);
  assert.ok(!bodyStr.includes('f'.repeat(64)),
    'el hash del cliente no debe aparecer en la response body');
});

test('POST /internal/sign-requests: PDF no parseable → 422 PDF_INVALID (I-012.2)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  // Buffer random: no magic bytes, no estructura PDF. El server hace
  // parsing estructural con pdf-lib (vía middleware pdfValidation()) y
  // rechaza con 422 PDF_INVALID. Pre-I-012.2 esto devolvía 400
  // INVALID_REQUEST_BODY por una validación manual de magic bytes
  // dentro del route handler.
  const pdf = Buffer.from('NO ES UN PDF');
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'fake.pdf');

  // pdfValidation() middleware rechaza con 422 PDF_INVALID.
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'PDF_INVALID');
  // El route handler NUNCA corrió (signRequest.create() no se invocó):
  // no se persiste ninguna fila en BD.
  const row = db.prepare('SELECT COUNT(*) AS n FROM gh_firmas_electronicas').get();
  assert.equal(row.n, 0, 'no debe haber filas creadas en la BD cuando el PDF es inválido');
});

test('POST /internal/sign-requests: sin archivo → 400', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = 'a'.repeat(64);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta));
  // No attach

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /internal/sign-requests: body inválido (sin agreement_hash) → 400', async () => {
  resetDb();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = { id_documento: 'd', id_trabajador: 't', id_empresa: 'e', tipo_firma: 'presencial' };
  // Falta agreement_hash, document_hash, version_kair

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /internal/sign-requests: API key incorrecta → 401', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', 'wrong-key')
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('POST /internal/sign-requests: tipo_firma=remoto tiene TTL 72h', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo, { tipo_firma: 'remoto' });
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 201);
  const fecha_creacion = new Date(res.body.fecha_creacion);
  const fecha_expiracion = new Date(res.body.fecha_expiracion);
  const horas = (fecha_expiracion - fecha_creacion) / 3600000;
  assert.equal(horas, 72);
});

// =================================================================
// POST /internal/sign-requests — I-005 Idempotency-Key (I-003.3)
// =================================================================
//
// Estos tests verifican el CABLEADO de requireIdempotencyKey en el route
// (no la lógica del middleware, que ya está cubierta en
// tests/middleware/idempotency.test.js). Los casos cubiertos:
//
// 1. Sin header → backward compat (G3): el middleware hace next() sin tocar
//    BD. Verificamos que el flujo normal sigue funcionando idéntico.
// 2. Misma key + mismo body → 2º request tiene X-Idempotency-Replay: true
//    y body idéntico al 1º (REPLAY, G9).
// 3. Misma key + distinto PDF → 409 IDEMPOTENCY_KEY_CONFLICT (fingerprint
//    cambia porque pdf_sha256 es server-computed y difiere).
// 4. Misma key + mismo body en IN_PROGRESS (insertado manualmente) → 409
//    IDEMPOTENCY_KEY_IN_PROGRESS con header Retry-After.
// 5. Header inválido (no UUID v4) → 400 IDEMPOTENCY_KEY_INVALID.
//
// C-22 (REPLAY sin token) queda explícitamente fuera de I-005 — I-013b.
//
// IMPORTANTE: tests 2-5 usan seedTestClients() + TEST_API_KEY_CLIENT_A.
// requireIdempotencyKey requiere req.id_empresa no vacío (defense in
// depth, §12 del middleware). En legacy mode (TEST_API_KEY) id_empresa es
// null → 500. Idempotency-Key solo está soportado para clientes per-empresa.

function withClientAApiKeyHeaders() {
  return { 'X-Internal-API-Key': TEST_API_KEY_CLIENT_A };
}

// Crea un PDF único con un texto distinto en la página (para que el
// SHA-256 server-computed difiera entre PDFs). El helper global makePdf()
// genera PDFs estructuralmente idénticos → mismo hash.
async function makeUniquePdf(seed) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  page.drawText(`unique-pdf-${seed}`);
  return Buffer.from(await doc.save());
}

test('POST I-005: sin Idempotency-Key → backward compat (G3, 201 normal)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  // Sin set('Idempotency-Key', ...) — el middleware hace next() sin tocar BD.
  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  assert.equal(res.status, 201);
  assert.ok(res.body.id_solicitud);
  assert.ok(res.body.token);
  // Sin header, NO debe haber X-Idempotency-Replay.
  assert.equal(res.headers['x-idempotency-replay'], undefined);
});

test('POST I-005: misma key + mismo body → 2º request es REPLAY (G9)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  // I-010: idempotency requiere req.id_empresa no vacío (defense in depth).
  // En legacy mode, id_empresa es null → 500. Usamos clientA (per-empresa).
  seedTestClients();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo, { id_empresa: TEST_EMPRESA_A });
  meta.document_hash = sha256Hex(pdf);

  const idemKey = crypto.randomUUID();
  const headers = { ...withClientAApiKeyHeaders(), 'Idempotency-Key': idemKey };

  // 1º request: crea la fila PENDING y completa a COMPLETED via res.on('finish').
  const res1 = await request(app)
    .post('/internal/sign-requests')
    .set(headers)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');
  assert.equal(res1.status, 201);
  const idSolicitud1 = res1.body.id_solicitud;

  // 2º request: misma key + mismo body (mismo PDF) → REPLAY.
  // El response body es IDÉNTICO al 1º (mismo id_solicitud, mismo token).
  // El header X-Idempotency-Replay: true está presente.
  const res2 = await request(app)
    .post('/internal/sign-requests')
    .set(headers)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');
  assert.equal(res2.status, 201);
  assert.equal(res2.headers['x-idempotency-replay'], 'true');
  assert.equal(res2.body.id_solicitud, idSolicitud1);
  assert.equal(res2.body.token, res1.body.token);

  // Solo se creó UN sign request en BD (REPLAY no duplica).
  const count = db.prepare('SELECT COUNT(*) AS n FROM gh_firmas_electronicas').get().n;
  assert.equal(count, 1);
});

test('POST I-005: misma key + distinto PDF → 409 IDEMPOTENCY_KEY_CONFLICT', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const pdf1 = await makeUniquePdf('v1');
  const pdf2 = await makeUniquePdf('v2');
  assert.notEqual(sha256Hex(pdf1), sha256Hex(pdf2), 'sanity: PDFs distintos → hashes distintos');
  const meta1 = buildMetadata(acuerdo, { id_empresa: TEST_EMPRESA_A });
  meta1.document_hash = sha256Hex(pdf1);
  const meta2 = buildMetadata(acuerdo, { id_empresa: TEST_EMPRESA_A });
  meta2.document_hash = sha256Hex(pdf2);

  const idemKey = crypto.randomUUID();
  const headers = { ...withClientAApiKeyHeaders(), 'Idempotency-Key': idemKey };

  // 1º request: pdf1.
  const res1 = await request(app)
    .post('/internal/sign-requests')
    .set(headers)
    .field('metadata', JSON.stringify(meta1))
    .attach('documento', pdf1, 'contrato-v1.pdf');
  assert.equal(res1.status, 201);

  // 2º request: misma key, distinto PDF → fingerprint difiere (pdf_sha256
  // server-computed) → CONFLICT.
  const res2 = await request(app)
    .post('/internal/sign-requests')
    .set(headers)
    .field('metadata', JSON.stringify(meta2))
    .attach('documento', pdf2, 'contrato-v2.pdf');
  assert.equal(res2.status, 409);
  assert.equal(res2.body.error.code, 'IDEMPOTENCY_KEY_CONFLICT');
});

test('POST I-005: misma key con fila PENDING pre-existente → 409 IN_PROGRESS con Retry-After', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo, { id_empresa: TEST_EMPRESA_A });
  meta.document_hash = sha256Hex(pdf);

  const idemKey = crypto.randomUUID();
  const headers = { ...withClientAApiKeyHeaders(), 'Idempotency-Key': idemKey };

  // Insertar manualmente una fila PENDING con la misma key para simular
  // el estado de in-progress (otra request en curso). El service la
  // detectará por la PK compuesta (id_empresa, idempotency_key) y retornará
  // IdempotencyKeyInProgress, que el middleware mapea a 409 con Retry-After.
  const fingerprint = sha256Hex(JSON.stringify({ test: 'pre-existing' }));
  db.prepare(`
    INSERT INTO gh_idempotency_keys
      (id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, 'PENDING', strftime('%Y-%m-%dT%H:%M:%fZ','now'),
            strftime('%Y-%m-%dT%H:%M:%fZ','now', '+24 hours'))
  `).run(TEST_EMPRESA_A, idemKey, fingerprint, sha256Hex(pdf));

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(headers)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_IN_PROGRESS');
  // El middleware setea el header Retry-After (>= 1s).
  const retryAfter = parseInt(res.headers['retry-after'], 10);
  assert.ok(retryAfter >= 1, `Retry-After debe ser >= 1, obtuve ${retryAfter}`);
});

test('POST I-005: Idempotency-Key inválido (no UUID v4) → 400 IDEMPOTENCY_KEY_INVALID', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo, { id_empresa: TEST_EMPRESA_A });
  meta.document_hash = sha256Hex(pdf);

  // Header con valor que NO es UUID v4 → 400 con code IDEMPOTENCY_KEY_INVALID.
  const headers = { ...withClientAApiKeyHeaders(), 'Idempotency-Key': 'not-a-uuid-at-all' };
  const res = await request(app)
    .post('/internal/sign-requests')
    .set(headers)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_INVALID');
});

test('POST I-005: legacy mode (TEST_API_KEY) + Idempotency-Key → 400 IDEMPOTENCY_LEGACY_NOT_SUPPORTED (no 500)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  // I-010: legacy mode usa TEST_API_KEY (deprecation). En legacy, id_empresa
  // es null por diseño. requireIdempotencyKey (I-003.3) requiere
  // req.id_empresa no vacío → sin el check de I-005, devolvería 500
  // INTERNAL_ERROR. Con I-005, devolvemos 400 explícito
  // IDEMPOTENCY_LEGACY_NOT_SUPPORTED para que K+AIR sepa que debe migrar
  // a per-empresa key para usar idempotencia.
  const headers = { ...HEADERS, 'Idempotency-Key': crypto.randomUUID() };
  const res = await request(app)
    .post('/internal/sign-requests')
    .set(headers)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_LEGACY_NOT_SUPPORTED');
  assert.match(res.body.error.message, /legacy/i);
});

// =================================================================
// GET /internal/sign-requests/:id
// =================================================================

test('GET /internal/sign-requests/:id por id_solicitud → 200', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const r1 = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  const r2 = await request(app).get(`/internal/sign-requests/${r1.body.id_solicitud}`).set(HEADERS);
  assert.equal(r2.status, 200);
  assert.equal(r2.body.id_solicitud, r1.body.id_solicitud);
  assert.equal(r2.body.estado, 'PENDING');
});

test('GET /internal/sign-requests/:id por id interno → 200', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const r1 = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  const r2 = await request(app).get(`/internal/sign-requests/${r1.body.id_interno}`).set(HEADERS);
  assert.equal(r2.status, 200);
});

test('GET /internal/sign-requests/:id inexistente → 404', async () => {
  resetDb();
  const app = makeApp();
  const r = await request(app).get('/internal/sign-requests/SIGN-2026-999999').set(HEADERS);
  assert.equal(r.status, 404);
});

// =================================================================
// GET /internal/sign-requests
// =================================================================

test('GET /internal/sign-requests lista vacía → 200 total=0', async () => {
  resetDb();
  const app = makeApp();
  const r = await request(app).get('/internal/sign-requests').set(HEADERS);
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 0);
  assert.equal(r.body.items.length, 0);
});

test('GET /internal/sign-requests lista con filtros', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  // Crear 2 solicitudes
  for (let i = 0; i < 2; i++) {
    const pdf = await makePdf();
    const meta = buildMetadata(acuerdo, {
      id_documento: `doc-${i}`,
      document_hash: sha256Hex(pdf),
    });
    await request(app)
      .post('/internal/sign-requests')
      .set(HEADERS)
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, `x${i}.pdf`);
  }

  // Listar todas
  const r1 = await request(app).get('/internal/sign-requests').set(HEADERS);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.total, 2);
  assert.equal(r1.body.items.length, 2);

  // Filtrar por id_documento
  const r2 = await request(app).get('/internal/sign-requests?id_documento=doc-0').set(HEADERS);
  assert.equal(r2.status, 200);
  assert.equal(r2.body.total, 1);
  assert.equal(r2.body.items[0].id_documento, 'doc-0');
});

// =================================================================
// Bloque A — agreement_version obligatorio
// =================================================================

test('POST /internal/sign-requests: sin agreement_version → 400 (zod)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  // Construir metadata SIN agreement_version
  const meta = buildMetadata(acuerdo);
  delete meta.agreement_version;
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
  assert.ok(res.body.error.details.issues.some(i => i.path.includes('agreement_version')),
    'El issue debe mencionar agreement_version');
});

test('POST /internal/sign-requests: agreement_version inexistente → 422 ACUERDO_INVALIDO', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo, { agreement_version: 'v999.0' });
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'ACUERDO_INVALIDO');
  assert.equal(res.body.error.details.reason, 'version_not_found');
  assert.equal(res.body.error.details.agreement_version, 'v999.0');
});

test('POST /internal/sign-requests: agreement_version inactiva → 422 ACUERDO_INVALIDO', async () => {
  resetDb();
  const acuerdoV1 = seedActiveAgreement({ version: 'v1.0', texto: 'texto v1' });
  // Crear v2.0 y marcarla activa (auto-desactiva v1.0)
  const agreementService = require('../../src/services/agreement');
  agreementService.createVersion({ version: 'v2.0', texto: 'texto v2', activa: true });
  const app = makeApp();
  const pdf = await makePdf();
  // Intentar firmar con v1.0 (que ya no es activa)
  const meta = buildMetadata(acuerdoV1); // acuerdoV1 es v1.0
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'ACUERDO_INVALIDO');
  assert.equal(res.body.error.details.reason, 'inactive');
  assert.equal(res.body.error.details.agreement_version, 'v1.0');
  assert.equal(res.body.error.details.active_version, 'v2.0');
});

test('POST /internal/sign-requests: agreement_hash ≠ texto_hash → 422 ACUERDO_INVALIDO', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  // Hash falso (correcto formato, valor incorrecto)
  const meta = buildMetadata(acuerdo, { agreement_hash: 'f'.repeat(64) });
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'ACUERDO_INVALIDO');
  assert.equal(res.body.error.details.reason, 'hash_mismatch');
  assert.equal(res.body.error.details.agreement_version, acuerdo.version);
});

test('POST /internal/sign-requests: sin Acuerdo activo → 422 ACUERDO_INVALIDO', async () => {
  resetDb();
  // NO sembrar Acuerdo
  const app = makeApp();
  const pdf = await makePdf();
  const meta = {
    id_documento: 'd',
    id_trabajador: 't',
    id_empresa: 'e',
    tipo_firma: 'presencial',
    agreement_version: 'v1.0',
    agreement_hash: 'a'.repeat(64),
    document_hash: sha256Hex(pdf),
    version_kair: '0.1.189',
  };

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'ACUERDO_INVALIDO');
  assert.equal(res.body.error.details.reason, 'version_not_found');
});

test('POST /internal/sign-requests: persiste agreement_version en BD', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 201);
  const row = db.prepare('SELECT agreement_version, agreement_hash FROM gh_firmas_electronicas WHERE id = ?').get(res.body.id_interno);
  assert.equal(row.agreement_version, acuerdo.version);
  assert.equal(row.agreement_hash, acuerdo.texto_hash);
});

test('POST /internal/sign-requests: evento CREATED incluye agreement_version en metadata', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  const eventos = db.prepare(`
    SELECT evento, metadata FROM gh_firma_eventos
    WHERE firma_id = ? ORDER BY id
  `).all(res.body.id_interno);
  assert.equal(eventos.length, 1);
  const metaEvento = JSON.parse(eventos[0].metadata);
  assert.equal(metaEvento.agreement_version, acuerdo.version);
});

test('POST /internal/sign-requests: Acuerdo vencido (fecha_vigencia_fin < now) → 422', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  // Forzar Acuerdo vencido (ayer)
  const ayer = new Date(Date.now() - 86400000).toISOString();
  db.prepare('UPDATE gh_firma_acuerdo_versiones SET fecha_vigencia_fin = ?')
    .run(ayer);
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'ACUERDO_INVALIDO');
  // El servicio detecta que NO hay activa vigente → reason no_active_version
  assert.equal(res.body.error.details.reason, 'no_active_version');
});

// =================================================================
// I-002 end-to-end: tipo_identificacion se propaga del body al service
// a la BD y a las responses (POST 201 + GET /:id).
//
// Cierra el gap detectado por Agentes B/C/E: el route POST no propagaba
// `tipo_identificacion` desde `meta` validado por zod al service, por lo
// que el valor llegaba como `undefined` → `null` en BD silencioso.
//
// Con este fix, el flujo end-to-end es:
//   Zod valida el campo → ✅
//   Route lo lee de meta y lo pasa al service → ✅ (este fix)
//   Service valida + INSERT → ✅
//   Service retorna el valor en getById → ✅
//   POST 201 response incluye el valor → ✅ (este fix)
//   GET /:id response incluye el valor → ✅ (este fix)
// =================================================================

test('I-002 e2e: POST con tipo_identificacion=CONTRATO → 201 + persiste + GET /:id retorna', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);
  meta.tipo_identificacion = 'CONTRATO';

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  assert.equal(res.status, 201);
  // 1. La respuesta POST confirma el valor persistido
  assert.equal(res.body.tipo_identificacion, 'CONTRATO',
    'POST 201 debe incluir tipo_identificacion en la respuesta');

  // 2. La fila en BD tiene la columna poblada (no quedó undefined → null)
  const fila = db.prepare(
    "SELECT tipo_identificacion FROM gh_firmas_electronicas WHERE id_solicitud = ?"
  ).get(res.body.id_solicitud);
  assert.equal(fila.tipo_identificacion, 'CONTRATO',
    'la fila en BD debe tener tipo_identificacion=CONTRATO (gap B/C/E cerrado)');

  // 3. GET /:id retorna el valor para que el cliente lo lea
  const get = await request(app)
    .get(`/internal/sign-requests/${res.body.id_solicitud}`)
    .set(HEADERS);
  assert.equal(get.status, 200);
  assert.equal(get.body.tipo_identificacion, 'CONTRATO',
    'GET /:id debe incluir tipo_identificacion en la respuesta');
});

test('I-002 e2e: POST sin tipo_identificacion → 201 + null (backward compat legacy pre-007)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);
  // tipo_identificacion NO se envía (sign request legacy pre-007)

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'doc.pdf');

  assert.equal(res.status, 201);
  assert.equal(res.body.tipo_identificacion, null,
    'POST 201 debe incluir tipo_identificacion=null cuando no se envía');

  const fila = db.prepare(
    "SELECT tipo_identificacion FROM gh_firmas_electronicas WHERE id_solicitud = ?"
  ).get(res.body.id_solicitud);
  assert.equal(fila.tipo_identificacion, null,
    'BD debe tener tipo_identificacion=null para sign requests legacy');
});

test('I-002 e2e: POST con tipo_identificacion inválido → 400 INVALID_REQUEST_BODY (zod)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);
  meta.tipo_identificacion = 'NO_ES_VALIDO';  // no está en TIPOS_IDENTIFICACION

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'doc.pdf');

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
  // No se crea fila en BD
  const fila = db.prepare("SELECT COUNT(*) AS n FROM gh_firmas_electronicas").get();
  assert.equal(fila.n, 0, 'ningún sign request debe haberse creado');
});
