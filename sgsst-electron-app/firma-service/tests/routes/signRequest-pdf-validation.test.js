/**
 * Tests de integracion: POST /internal/sign-requests con pdfValidation (I-012.2).
 *
 * Cubre la ruta completa (multer -> pdfValidation -> handler -> service ->
 * BD) y verifica que el wiring del middleware funcione end-to-end.
 *
 * Plan:
 *   §1 Happy path (2 tests)
 *      - PDF valido → 201, response con document_hash_original server-computed
 *      - Hash en BD es el server-computed (no el que el cliente envio)
 *   §2 Invalid PDF rejected (2 tests)
 *      - PDF truncado → 422 PDF_INVALID
 *      - PDF encriptado → 422 PDF_ENCRYPTED
 *   §3 No file rejected (1 test)
 *      - POST sin campo documento → 400 (ver nota sobre upload.js)
 *   §4 Client hash NOT trusted (2 tests)
 *      - Cliente miente en document_hash → persiste el server-computed
 *      - Cliente omite document_hash → SKIP (schema lo requiere)
 *   §5 Error mapping preserva details (2 tests)
 *      - PDF_TOO_LARGE → details: { actual_size, max_size }
 *      - PDF_TOO_MANY_PAGES → details: { page_count, max_pages }
 *
 * Total: 9 tests (1 skipped por schema zod).
 *
 * DIFERENCIA con tests/routes/signRequest.test.js: este archivo usa
 * SIEMPRE PDFs construidos con pdf-lib (PDFDocument.create + addPage) que
 * son estructuralmente validos y parsean correctamente. Los tests del
 * baseline usan un PDF hand-crafted que pdf-lib NO puede parsear; eso
 * esta documentado como un finding de I-012.2 (ver report).
 *
 * Se ejecuta con:
 *   node --test --require ./tests/setup.js --test-concurrency=1 \
 *     tests/routes/signRequest-pdf-validation.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const { sha256 } = require('../../src/crypto/hash');
const config = require('../../src/config');
const db = require('../../src/db/connection');
const {
  resetDb, seedActiveAgreement, makeApp, TEST_API_KEY,
} = require('../helpers');

const HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };

// =====================================================================
// Helpers
// =====================================================================

/**
 * PDF simple pero estructuralmente valido (parseable por pdf-lib).
 * Necesario porque el middleware pdfValidation ahora exige parsing real.
 */
async function makeValidPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);
  page.drawText('Documento de prueba', {
    x: 72, y: 720, size: 14, font, color: rgb(0, 0, 0),
  });
  return Buffer.from(await pdf.save());
}

/**
 * PDF con N paginas estructuralmente valido. Sirve para tests que
 * necesiten forzar limites (e.g. maxPages).
 */
async function makeValidPdfNPages(n) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < n; i++) {
    const page = pdf.addPage([612, 792]);
    page.drawText(`Page ${i + 1} of ${n}`, {
      x: 50, y: 750, size: 12, font, color: rgb(0, 0, 0),
    });
  }
  return Buffer.from(await pdf.save());
}

/**
 * Construye metadata con el hash y la version del Acuerdo sembrado.
 */
function buildMetadata(acuerdo, overrides = {}) {
  return {
    id_documento: 'doc-i012-2',
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    tipo_firma: 'presencial',
    agreement_hash: acuerdo.texto_hash,
    agreement_version: acuerdo.version,
    document_hash: null,  // se calcula per-test
    version_kair: '0.1.189',
    ...overrides,
  };
}

/**
 * PDF con /Encrypt en el trailer (mismo truco que el resto del repo).
 */
function buildPdfWithEncryptMarker() {
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

// =====================================================================
// §1: Happy path (2 tests)
// =====================================================================

test('§1.1: POST con PDF valido → 201, response incluye document_hash_original server-computed', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makeValidPdf();
  const serverHash = sha256(pdf);

  const meta = buildMetadata(acuerdo, { document_hash: serverHash });
  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  assert.equal(res.status, 201);
  // El response debe incluir el hash server-computed.
  assert.equal(res.body.document_hash_original, serverHash);
  assert.match(res.body.document_hash_original, /^[0-9a-f]{64}$/);
  // Y NO el que el cliente invento (en este caso coinciden, asi que
  // verificamos el formato y la presencia).
  assert.ok(res.body.id_solicitud);
  assert.equal(res.body.estado, 'PENDING');
});

test('§1.2: persisted hash en BD es el server-computed (no el del cliente)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makeValidPdf();
  const serverHash = sha256(pdf);

  // El cliente envia el hash CORRECTO. El server debe usar el server-computed,
  // que en este caso coincide. Lo verificamos en BD.
  const meta = buildMetadata(acuerdo, { document_hash: serverHash });
  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'c.pdf');

  assert.equal(res.status, 201);
  const row = db.prepare(
    'SELECT document_hash_original FROM gh_firmas_electronicas WHERE id = ?'
  ).get(res.body.id_interno);
  assert.equal(row.document_hash_original, serverHash);
});

// =====================================================================
// §2: Invalid PDF rejected (2 tests)
// =====================================================================

test('§2.1: POST con PDF truncado (header %PDF- pero resto corrupto) → 422 PDF_INVALID', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  // PDF valido cortado a la mitad → pdf-lib no puede parsearlo.
  const full = await makeValidPdf();
  const truncated = full.slice(0, Math.floor(full.length / 2));
  const meta = buildMetadata(acuerdo, { document_hash: sha256(truncated) });

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', truncated, 'truncado.pdf');

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'PDF_INVALID');
  // Ninguna fila en BD.
  const n = db.prepare('SELECT COUNT(*) AS n FROM gh_firmas_electronicas').get().n;
  assert.equal(n, 0);
});

test('§2.2: POST con PDF encriptado (marker /Encrypt) → 422 PDF_ENCRYPTED', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const encBuf = buildPdfWithEncryptMarker();
  const meta = buildMetadata(acuerdo, { document_hash: sha256(encBuf) });

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', encBuf, 'enc.pdf');

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'PDF_ENCRYPTED');
  assert.equal(res.body.error.details && res.body.error.details.reason,
    'encrypted_pdf_not_supported');
  const n = db.prepare('SELECT COUNT(*) AS n FROM gh_firmas_electronicas').get().n;
  assert.equal(n, 0);
});

// =====================================================================
// §3: No file rejected (1 test)
// =====================================================================

test('§3.1: POST sin campo "documento" → 400', async () => {
  // El middleware upload.js corre ANTES de pdfValidation y ya devuelve
  // 400 INVALID_REQUEST_BODY para "no file". I-012.2 no cambia ese
  // comportamiento (upload.js esta fuera de scope); el middleware
  // pdfValidation es unreachable en este caso. La especificacion pedia
  // 400 PDF_REQUIRED, pero eso seria cierto solo si upload.js no
  // estuviera — la realidad de la cadena es 400 INVALID_REQUEST_BODY.
  // Ver I-012.2 report: finding "upload.js gana antes que pdfValidation".
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const meta = buildMetadata(acuerdo, { document_hash: 'a'.repeat(64) });

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta));
  // sin .attach('documento', ...)

  assert.equal(res.status, 400);
  // Aceptamos cualquiera de los dos codes como 400: INVALID_REQUEST_BODY
  // (actual, viene de upload.js) o PDF_REQUIRED (ideal, si upload.js
  // se reordenara). Hoy es INVALID_REQUEST_BODY.
  assert.ok(
    res.body.error.code === 'INVALID_REQUEST_BODY' ||
    res.body.error.code === 'PDF_REQUIRED',
    `expected 400 INVALID_REQUEST_BODY or PDF_REQUIRED, got ${res.body.error.code}`
  );
});

// =====================================================================
// §4: Client hash is NOT trusted (2 tests; 1 skip por schema zod)
// =====================================================================

test('§4.1: cliente envia document_hash INCORRECTO en metadata → 201 pero hash persistido es server-computed', async () => {
  // El cliente miente sobre el hash. Esto podria usarse para bypassear
  // el control de idempotencia o para pretender que un PDF distinto al
  // real se esta firmando. El server DEBE ignorar meta.document_hash y
  // calcular el SHA-256 real a partir de los bytes recibidos.
  //
  // El truco: el service signRequest.create() exige que document_hash
  // coincida con el calculado. Si pasaramos meta.document_hash tal cual,
  // el service lanzaria 422 DOCUMENT_HASH_MISMATCH ANTES de persistir.
  // Por eso I-012.2 cambia la linea para pasarle req.pdfValidation.sha256
  // (que SI coincide con el calculado del buffer real): asi el check
  // pasa y la fila persistida tiene el hash REAL del PDF.
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makeValidPdf();
  const realHash = sha256(pdf);
  const fakeHash = 'f'.repeat(64); // hash mentiroso

  const meta = buildMetadata(acuerdo, { document_hash: fakeHash });
  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'mentira.pdf');

  // La respuesta es 201 (sign request creado).
  assert.equal(res.status, 201);
  // El hash que el server reporta es el REAL, no el que el cliente mintio.
  assert.equal(res.body.document_hash_original, realHash,
    'el hash en response debe ser el server-computed, NO el del cliente');
  // Y la fila en BD tiene el hash real.
  const row = db.prepare(
    'SELECT document_hash_original FROM gh_firmas_electronicas WHERE id = ?'
  ).get(res.body.id_interno);
  assert.equal(row.document_hash_original, realHash);
  assert.notEqual(row.document_hash_original, fakeHash);
});

test('§4.2: cliente omite document_hash del metadata → SKIP (zod schema lo requiere)', async (t) => {
  // El schema zod en src/schemas/index.js declara document_hash como
  // requerido (z.string().regex(/^[0-9a-f]{64}$/)). Sin ese campo, zod
  // rechaza el body con 400 INVALID_REQUEST_BODY y el handler nunca
  // llega a la linea de document_hash. No hay forma de probar la
  // omision como flujo valido sin cambiar el schema — lo cual esta
  // fuera de scope de I-012.2.
  //
  // Por eso este test se SKIP explicito. El test es valido
  // conceptualmente (queremos verificar que el server computa el hash
  // incluso si el cliente no lo envia), pero el constraint esta en
  // el schema, no en la ruta.
  t.skip('zod schema requiere document_hash; no se puede omitir sin cambiar el schema (fuera de scope)');
});

// =====================================================================
// §5: Error mapping preserva details (2 tests)
// =====================================================================

test('§5.1: PDF > maxBytes → 422 PDF_TOO_LARGE con details { actual_size, max_size }', async () => {
  // Bajar el max temporalmente a un valor pequeno (100 bytes). El PDF
  // valido generado por makeValidPdf() mide ~1.5KB, asi que excede
  // facilmente. No necesitamos construir un PDF de 50MB.
  const origMax = config.pdf.maxBytes;
  config.pdf.maxBytes = 100;
  try {
    resetDb();
    const acuerdo = seedActiveAgreement();
    const app = makeApp();
    const buf = await makeValidPdf();
    assert.ok(buf.length > 100, `PDF debe ser > 100 bytes (es ${buf.length})`);
    const meta = buildMetadata(acuerdo, { document_hash: sha256(buf) });

    const res = await request(app)
      .post('/internal/sign-requests')
      .set(HEADERS)
      .field('metadata', JSON.stringify(meta))
      .attach('documento', buf, 'big.pdf');

    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'PDF_TOO_LARGE');
    assert.equal(res.body.error.details.actual_size, buf.length);
    assert.equal(res.body.error.details.max_size, 100);
  } finally {
    config.pdf.maxBytes = origMax;
  }
});

test('§5.2: PDF con mas paginas que maxPages → 422 PDF_TOO_MANY_PAGES con details { page_count, max_pages }', async () => {
  // Bajar maxPages para que el test sea rapido.
  const origMax = config.pdf.maxPages;
  config.pdf.maxPages = 2;
  try {
    resetDb();
    const acuerdo = seedActiveAgreement();
    const app = makeApp();
    const pdf = await makeValidPdfNPages(5);
    const meta = buildMetadata(acuerdo, { document_hash: sha256(pdf) });

    const res = await request(app)
      .post('/internal/sign-requests')
      .set(HEADERS)
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'many.pdf');

    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'PDF_TOO_MANY_PAGES');
    assert.equal(res.body.error.details.actual_pages, 5);
    assert.equal(res.body.error.details.max_pages, 2);
  } finally {
    config.pdf.maxPages = origMax;
  }
});
