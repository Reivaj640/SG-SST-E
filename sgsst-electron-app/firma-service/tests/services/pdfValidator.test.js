/**
 * Tests del servicio pdfValidator (I-012.1).
 *
 * Verifica COMPORTAMIENTO (no implementacion):
 *
 *   §1 Happy path: PDFs validos retornan { sha256, pageCount, metadata }
 *   §2 PDF_INVALID: buffers no parseables (header, garbage, truncado, vacio)
 *   §3 PDF_ENCRYPTED: PDF con /Encrypt en trailer
 *   §4 PDF_TOO_LARGE: buffer > config.pdf.maxBytes (boundary: == pasa)
 *   §5 PDF_TOO_MANY_PAGES: pageCount > config.pdf.maxPages (boundary)
 *   §6 PDF_PARSE_TIMEOUT: parseo excede config.pdf.parseTimeoutMs
 *   §7 Hash determinismo + formato: 64 hex lowercase, determinista
 *   §8 Defense in depth: null/undefined/string (no Buffer)
 *   §9 PII en logs: logger NO emite bytes del PDF ni Title/Author
 *   §10 PII en errors: error.details NO incluye Title del metadata
 *
 * Decisiones validadas:
 *  - El service es async (pdf-lib es async).
 *  - PDF encriptado se detecta con pdfDoc.isEncrypted tras load con
 *    { ignoreEncryption: true } (pdf-lib 1.17.1 no soporta desencriptar).
 *  - SHA-256 usa el modulo src/crypto/hash.js (NO re-implementado).
 *  - El servicio NO conoce HTTP: solo lanza errores tipados.
 *  - El servicio NO loguea bytes del PDF ni metadata Title/Author.
 *
 * Scope: este test NO usa BD ni HTTP. Es pura logica de validacion.
 * Se ejecuta manualmente con:
 *   node --test --require ./tests/setup.js tests/services/pdfValidator.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const pdfValidator = require('../../src/services/pdfValidator');
const config = require('../../src/config');
const logger = require('../../src/utils/logger');

// =====================================================================
// Helpers
// =====================================================================

/**
 * Construye un PDF de 1 pagina, en blanco. Devuelve Buffer.
 */
async function buildSimplePdf() {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

/**
 * Construye un PDF de N paginas (con un poco de texto por pagina para
 * que tenga tamano real). Devuelve Buffer.
 */
async function buildNPagePdf(n, opts = {}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < n; i++) {
    const page = pdf.addPage([612, 792]);
    page.drawText(`Page ${i + 1} of ${n}`, {
      x: 50,
      y: 750,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
  }
  if (opts.title) pdf.setTitle(opts.title);
  if (opts.author) pdf.setAuthor(opts.author);
  if (opts.subject) pdf.setSubject(opts.subject);
  if (opts.keywords) pdf.setKeywords(opts.keywords);
  if (opts.producer) pdf.setProducer(opts.producer);
  if (opts.creator) pdf.setCreator(opts.creator);
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

/**
 * Construye un PDF con /Encrypt en el trailer. NO esta realmente
 * encriptado (no se podria desencriptar con pdf-lib de todas formas),
 * pero tiene el marker en el trailer que pdf-lib detecta.
 *
 * Truco: construimos un PDF minimo valido a mano con cross-reference
 * clasico (no xref stream) y le agregamos /Encrypt 4 0 R en el trailer.
 * El objeto 4 es un dict con /Filter /Standard (el filter real que
 * usan los PDFs encriptados). NO es funcionalmente un PDF encriptado,
 * pero activa pdfDoc.isEncrypted=true.
 */
function buildPdfWithEncryptMarker() {
  const objs = [];
  objs.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objs.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objs.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n');
  // Encrypt stub: pdf-lib detecta /Encrypt en el trailer y setea
  // isEncrypted=true. No necesitamos un Encrypt dict funcional.
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
 * Construye un PDF con N paginas y suficiente contenido en cada una
 * para que el parseo tome algunos ms. Se usa en el test de timeout
 * (donde bajamos parseTimeoutMs a 1ms).
 *
 * Trade-off: buildModeratelyComplexPdf(100) toma ~500ms en construir
 * (por el embed de fuente + 100 paginas). Es lento pero determinista.
 * El test 6.1 corre una vez; el resto de los tests usan PDFs simples.
 */
async function buildModeratelyComplexPdf(n) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < n; i++) {
    const page = pdf.addPage([612, 792]);
    for (let j = 0; j < 30; j++) {
      page.drawText(
        `Line ${i}-${j} sample text for parsing work `.repeat(10),
        { x: 50, y: 700 - j * 14, size: 10, font, color: rgb(0, 0, 0) }
      );
    }
  }
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

/**
 * Captura stdout y stderr durante la ejecucion de una funcion. Devuelve
 * el texto completo escrito a ambos streams. Usado en §9 (PII en logs).
 */
function captureStdStreams(fn) {
  let out = '';
  let err = '';
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk) => { out += chunk; return true; };
  process.stderr.write = (chunk) => { err += chunk; return true; };
  try {
    fn();
  } finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
  }
  return { out, err, combined: out + err };
}

/**
 * Wrapper async para captureStdStreams. Espera la promesa y captura
 * tambien logs asincronos (logger es sync, asi que normalmente ya
 * estan escritos al momento de catch, pero esto es defensivo).
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

// =====================================================================
// §1: Happy path (4 tests)
// =====================================================================

test('§1.1: PDF de 1 pagina valido → retorna sha256 (64 hex), pageCount=1, metadata', async () => {
  const buf = await buildSimplePdf();
  const result = await pdfValidator.validate(buf);
  assert.equal(result.pageCount, 1);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.sha256.length, 64);
  assert.ok(typeof result.metadata === 'object' && result.metadata !== null);
});

test('§1.2: PDF de 3 paginas valido → pageCount=3, sha256 determinista', async () => {
  const buf = await buildNPagePdf(3);
  const r1 = await pdfValidator.validate(buf);
  const r2 = await pdfValidator.validate(buf);
  assert.equal(r1.pageCount, 3);
  assert.equal(r2.pageCount, 3);
  assert.equal(r1.sha256, r2.sha256, 'mismo buffer → mismo sha256');
});

test('§1.3: PDF con /Info metadata → metadata tiene Title/Author/etc.', async () => {
  const buf = await buildNPagePdf(1, {
    title: 'Contrato laboral',
    author: 'Juan Pérez',
    subject: 'Documento firmado',
    keywords: ['kair', 'firma', '2026'],
  });
  const result = await pdfValidator.validate(buf);
  assert.equal(result.pageCount, 1);
  assert.equal(result.metadata.Title, 'Contrato laboral');
  assert.equal(result.metadata.Author, 'Juan Pérez');
  assert.equal(result.metadata.Subject, 'Documento firmado');
  // pdf-lib devuelve keywords como string separado por espacios.
  assert.ok(typeof result.metadata.Keywords === 'string' && result.metadata.Keywords.length > 0);
});

test('§1.4: PDF sin /Info → metadata es {} (objeto vacio, no undefined)', async () => {
  const buf = await buildSimplePdf();
  const result = await pdfValidator.validate(buf);
  assert.deepEqual(result.metadata, {});
  assert.ok(result.metadata !== null && result.metadata !== undefined);
});

// =====================================================================
// §2: PDF_INVALID (4 tests)
// =====================================================================

test('§2.1: buffer = "not a pdf" → throws PdfInvalidError code=PDF_INVALID', async () => {
  await assert.rejects(
    () => pdfValidator.validate(Buffer.from('not a pdf')),
    (err) => err instanceof pdfValidator.PdfInvalidError
      && err.code === 'PDF_INVALID'
  );
});

test('§2.2: buffer = bytes random → throws PdfInvalidError', async () => {
  const random = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd, 0x80, 0x81]);
  await assert.rejects(
    () => pdfValidator.validate(random),
    (err) => err instanceof pdfValidator.PdfInvalidError
      && err.code === 'PDF_INVALID'
  );
});

test('§2.3: buffer con header %PDF-1.7 pero truncado mid-stream → throws PdfInvalidError', async () => {
  // Construimos un PDF real y lo truncamos a la mitad. pdf-lib no
  // podra parsearlo (xref corrupto).
  const full = await buildSimplePdf();
  const truncated = full.slice(0, Math.floor(full.length / 2));
  await assert.rejects(
    () => pdfValidator.validate(truncated),
    (err) => err instanceof pdfValidator.PdfInvalidError
      && err.code === 'PDF_INVALID'
  );
});

test('§2.4: buffer vacio → throws PdfInvalidError (reason: empty)', async () => {
  await assert.rejects(
    () => pdfValidator.validate(Buffer.alloc(0)),
    (err) => err instanceof pdfValidator.PdfInvalidError
      && err.code === 'PDF_INVALID'
      && err.details.reason === 'empty'
  );
});

// =====================================================================
// §3: PDF_ENCRYPTED (2 tests)
// =====================================================================

test('§3.1: PDF con /Encrypt en trailer → throws PdfEncryptedError code=PDF_ENCRYPTED', async () => {
  const encBuf = buildPdfWithEncryptMarker();
  await assert.rejects(
    () => pdfValidator.validate(encBuf),
    (err) => err instanceof pdfValidator.PdfEncryptedError
      && err.code === 'PDF_ENCRYPTED'
  );
});

test('§3.2: error de PDF_ENCRYPTED incluye reason util en details', async () => {
  const encBuf = buildPdfWithEncryptMarker();
  try {
    await pdfValidator.validate(encBuf);
    assert.fail('debio haber lanzado PdfEncryptedError');
  } catch (err) {
    assert.equal(err.code, 'PDF_ENCRYPTED');
    assert.equal(err.details.reason, 'encrypted_pdf_not_supported');
    assert.ok(typeof err.details.buffer_size === 'number',
      'details debe incluir buffer_size');
  }
});

// =====================================================================
// §4: PDF_TOO_LARGE (2 tests)
// =====================================================================

test('§4.1: buffer > config.pdf.maxBytes → throws PdfTooLargeError con actual_size y max_size', async () => {
  // Construimos un buffer arbitrario que excede el limite. No necesita
  // ser un PDF valido: el check de tamano ocurre ANTES del parseo.
  const oversized = Buffer.alloc(config.pdf.maxBytes + 1, 0x41); // 'A' bytes
  await assert.rejects(
    () => pdfValidator.validate(oversized),
    (err) => err instanceof pdfValidator.PdfTooLargeError
      && err.code === 'PDF_TOO_LARGE'
      && err.details.actual_size === config.pdf.maxBytes + 1
      && err.details.max_size === config.pdf.maxBytes
  );
});

test('§4.2: buffer = exactamente maxBytes (boundary) → no falla por tamano', async () => {
  // No podemos construir un PDF valido de 50MB para probar el boundary
  // extremo (tarda mucho). Lo que verificamos es que el codigo de error
  // NO es PDF_TOO_LARGE: si la boundary falla, sera por otro motivo
  // (header invalido si el buffer es de 'A's). Aqui usamos un buffer
  // del tamano exacto con un header invalido: debe fallar por header,
  // no por tamano.
  const atLimit = Buffer.alloc(config.pdf.maxBytes, 0x41);
  // Prefix con %PDF- para que pase el magic check.
  Buffer.from('%PDF-', 'latin1').copy(atLimit, 0);
  let thrown = null;
  try {
    await pdfValidator.validate(atLimit);
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown, 'debe lanzar algun error');
  assert.notEqual(thrown.code, 'PDF_TOO_LARGE',
    'en la boundary el codigo NO debe ser PDF_TOO_LARGE');
  // Sera PDF_INVALID (header check pasa pero parseo falla) — eso esta OK.
});

// =====================================================================
// §5: PDF_TOO_MANY_PAGES (2 tests)
// =====================================================================

test('§5.1: PDF con 201 paginas (default max=200) → throws PdfTooManyPagesError', async () => {
  // 201 paginas con un poco de texto cada una. ~6 MB. Tarda ~1s.
  // Override el max temporalmente para que el test corra rapido.
  const origMax = config.pdf.maxPages;
  config.pdf.maxPages = 3; // bajamos el limite a 3 para no construir 201 paginas reales
  try {
    const buf = await buildNPagePdf(5); // 5 paginas > 3
    await assert.rejects(
      () => pdfValidator.validate(buf),
      (err) => err instanceof pdfValidator.PdfTooManyPagesError
        && err.code === 'PDF_TOO_MANY_PAGES'
        && err.details.actual_pages === 5
        && err.details.max_pages === 3
    );
  } finally {
    config.pdf.maxPages = origMax;
  }
});

test('§5.2: PDF con maxPages paginas (boundary) → pasa', async () => {
  const origMax = config.pdf.maxPages;
  config.pdf.maxPages = 3;
  try {
    const buf = await buildNPagePdf(3); // exactamente 3
    const result = await pdfValidator.validate(buf);
    assert.equal(result.pageCount, 3);
  } finally {
    config.pdf.maxPages = origMax;
  }
});

// =====================================================================
// §6: PDF_PARSE_TIMEOUT (2 tests)
// =====================================================================

test('§6.1: timeout de 1ms sobre PDF moderadamente complejo → throws PdfParseTimeoutError', async () => {
  // PDF de 100 paginas con ~30 lineas de texto por pagina. Tamano ~100KB.
  // Parsearlo toma ~5-7ms en hardware moderno. Con timeout de 1ms
  // forzamos el rechazo.
  //
  // Si el test se vuelve flaky en CI muy rapido, ajustar a 100 paginas
  // con mas contenido (rebuild completo toma ~500ms — un test aislado).
  const buf = await buildModeratelyComplexPdf(100);
  assert.ok(buf.length > 50000, `PDF de complejidad moderada debe ser > 50KB (fue ${buf.length})`);

  const origTimeout = config.pdf.parseTimeoutMs;
  config.pdf.parseTimeoutMs = 1;
  try {
    await assert.rejects(
      () => pdfValidator.validate(buf),
      (err) => err instanceof pdfValidator.PdfParseTimeoutError
        && err.code === 'PDF_PARSE_TIMEOUT'
        && err.details.timeout_ms === 1
    );
  } finally {
    config.pdf.parseTimeoutMs = origTimeout;
  }
});

test('§6.2: el rechazo ocurre dentro del timeout (no hang)', async () => {
  // Verifica que validate() SIEMPRE rechaza, no se queda colgado.
  // Usamos un PDF simple y un timeout de 50ms (suficientemente grande
  // para que el parseo normal pueda completar, pero el PDF se construye
  // en background para forzar el timeout).
  const buf = await buildSimplePdf();

  const origTimeout = config.pdf.parseTimeoutMs;
  // Forzamos el timeout: parchamos PDFDocument.load para que devuelva
  // una promesa que nunca resuelve. Esto simula un parseo colgado.
  const origLoad = PDFDocument.load;
  PDFDocument.load = () => new Promise(() => {}); // never resolves

  config.pdf.parseTimeoutMs = 50; // 50ms es mas que suficiente para que el timeout dispare
  try {
    const t0 = Date.now();
    let thrown = null;
    try {
      await pdfValidator.validate(buf);
    } catch (e) {
      thrown = e;
    }
    const elapsed = Date.now() - t0;
    assert.ok(thrown, 'debe haber lanzado un error');
    assert.equal(thrown.code, 'PDF_PARSE_TIMEOUT');
    // Margen generoso: 50ms timeout + overhead de event loop. 200ms
    // es mas que suficiente para detectar un hang (que seria >5s).
    assert.ok(elapsed < 200, `el rechazo debe ocurrir en <200ms (fue ${elapsed}ms)`);
  } finally {
    PDFDocument.load = origLoad;
    config.pdf.parseTimeoutMs = origTimeout;
  }
});

// =====================================================================
// §7: Hash determinismo + formato (3 tests)
// =====================================================================

test('§7.1: mismo buffer → mismo sha256 (validate 2 veces)', async () => {
  const buf = await buildSimplePdf();
  const r1 = await pdfValidator.validate(buf);
  const r2 = await pdfValidator.validate(buf);
  assert.equal(r1.sha256, r2.sha256);
});

test('§7.2: buffer diferente → sha256 diferente', async () => {
  const buf1 = await buildSimplePdf();
  const buf2 = await buildNPagePdf(2);
  const r1 = await pdfValidator.validate(buf1);
  const r2 = await pdfValidator.validate(buf2);
  assert.notEqual(r1.sha256, r2.sha256);
});

test('§7.3: sha256 es exactamente 64 chars de lowercase hex', async () => {
  const buf = await buildSimplePdf();
  const result = await pdfValidator.validate(buf);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.sha256.length, 64);
  // Verificamos que NO tiene uppercase (caso comun de bug con .digest('hex') vs .digest()).
  assert.equal(result.sha256, result.sha256.toLowerCase());
});

// =====================================================================
// §8: Defense in depth (3 tests)
// =====================================================================

test('§8.1: buffer = null → throws PdfInvalidError reason=not_a_buffer', async () => {
  await assert.rejects(
    () => pdfValidator.validate(null),
    (err) => err instanceof pdfValidator.PdfInvalidError
      && err.code === 'PDF_INVALID'
      && err.details.reason === 'not_a_buffer'
  );
});

test('§8.2: buffer = undefined → throws PdfInvalidError', async () => {
  await assert.rejects(
    () => pdfValidator.validate(undefined),
    (err) => err instanceof pdfValidator.PdfInvalidError
      && err.code === 'PDF_INVALID'
      && err.details.reason === 'not_a_buffer'
  );
});

test('§8.3: buffer = "string" (no Buffer) → throws PdfInvalidError', async () => {
  await assert.rejects(
    () => pdfValidator.validate('a string that is not a buffer'),
    (err) => err instanceof pdfValidator.PdfInvalidError
      && err.code === 'PDF_INVALID'
      && err.details.reason === 'not_a_buffer'
  );
});

// =====================================================================
// §9: PII en logs (2 tests)
// =====================================================================

test('§9.1: rechazo de PDF no emite bytes del PDF ni Title/Author en logs', async () => {
  // Construimos un PDF con metadata sensible.
  const buf = await buildNPagePdf(1, {
    title: 'PII-TITLE-MUST-NOT-APPEAR-79123456',
    author: 'PII-AUTHOR-MUST-NOT-APPEAR-juan@example.com',
  });
  // El PDF es valido estructuralmente; forzamos un rechazo
  // cambiando maxPages a 0 para que dispare PDF_TOO_MANY_PAGES.
  const origMax = config.pdf.maxPages;
  config.pdf.maxPages = 0;
  try {
    const captured = await captureStdStreamsAsync(async () => {
      try {
        await pdfValidator.validate(buf);
      } catch (_) { /* ignore */ }
    });
    // El PDF no debe aparecer completo en los logs.
    assert.ok(!captured.combined.includes('PII-TITLE-MUST-NOT-APPEAR'),
      'log NO debe contener el Title');
    assert.ok(!captured.combined.includes('PII-AUTHOR-MUST-NOT-APPEAR'),
      'log NO debe contener el Author');
    // Tampoco el email ni la cedula embebida (defensa por valor).
    assert.ok(!captured.combined.includes('juan@example.com'),
      'log NO debe contener el email del Author');
    assert.ok(!captured.combined.includes('79123456'),
      'log NO debe contener la cedula del Title');
  } finally {
    config.pdf.maxPages = origMax;
  }
});

test('§9.2: log de rechazo incluye code, size y page_count, pero NO el PDF', async () => {
  const buf = await buildNPagePdf(1, { title: 'should-not-appear' });
  const origMax = config.pdf.maxPages;
  config.pdf.maxPages = 0;
  try {
    const captured = await captureStdStreamsAsync(async () => {
      try {
        await pdfValidator.validate(buf);
      } catch (_) { /* ignore */ }
    });
    // Verificamos que el log SI contiene los campos clave.
    assert.match(captured.combined, /PDF_TOO_MANY_PAGES/);
    assert.match(captured.combined, /buffer_size/);
    assert.match(captured.combined, /page_count/);
    // Y que NO contiene el titulo del PDF.
    assert.ok(!captured.combined.includes('should-not-appear'),
      'log NO debe contener el titulo del PDF');
  } finally {
    config.pdf.maxPages = origMax;
  }
});

// =====================================================================
// §10: PII en errors (1 test)
// =====================================================================

test('§10.1: error.details NO incluye el Title del metadata (PII safety)', async () => {
  // Construimos un PDF con PII en el Title.
  const sensitiveTitle = 'Juan Pérez - CC 79123456 - Contrato';
  const buf = await buildNPagePdf(1, { title: sensitiveTitle });
  // Forzamos un rechazo via PDF_TOO_MANY_PAGES para inspeccionar el error.
  const origMax = config.pdf.maxPages;
  config.pdf.maxPages = 0;
  try {
    let thrown = null;
    try {
      await pdfValidator.validate(buf);
    } catch (e) {
      thrown = e;
    }
    assert.ok(thrown, 'debe haber lanzado un error');
    // El error completo serializado NO debe contener el Title.
    const errStr = JSON.stringify(thrown);
    assert.ok(!errStr.includes('Juan Pérez'),
      `error serializado NO debe contener el nombre (Title): ${errStr.slice(0, 300)}`);
    assert.ok(!errStr.includes('79123456'),
      `error serializado NO debe contener la cedula: ${errStr.slice(0, 300)}`);
    // Y details tampoco (es la unica fuente de PII potencial).
    if (thrown.details) {
      const detailsStr = JSON.stringify(thrown.details);
      assert.ok(!detailsStr.includes('Juan Pérez'));
      assert.ok(!detailsStr.includes('79123456'));
    }
  } finally {
    config.pdf.maxPages = origMax;
  }
});
