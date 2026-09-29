/**
 * Tests del middleware pdfValidation (I-012.2).
 *
 * Verifica el ADAPTER HTTP de services/pdfValidator.js (I-012.1).
 * El service ya tiene su propio test file (services/pdfValidator.test.js);
 * este archivo se enfoca en:
 *   - Mapeo de errores tipados del service a HTTP 422.
 *   - Defensa en profundidad cuando multer no populo req.file (400 PDF_REQUIRED).
 *   - req.pdfValidation expuesto correctamente al handler.
 *   - Log disciplinado: solo sha256_prefix (8 chars), NO bytes, NO metadata PII.
 *   - Errores NO tipados pasan al errorHandler central sin transformacion.
 *   - PII safety: response body de error NO contiene los bytes del PDF.
 *
 * Plan de tests:
 *   §1 PDF_REQUIRED (3 tests) — sin archivo / buffer undefined / buffer vacio
 *   §2 Happy path (3 tests)    — 1 pagina, 3 paginas, log disciplinado
 *   §3 PDF_INVALID (2 tests)   — basura, random bytes
 *   §4 PDF_ENCRYPTED (1 test)  — /Encrypt en trailer
 *   §5 Otros PDF_* (3 tests)   — TOO_LARGE, TOO_MANY_PAGES, PARSE_TIMEOUT
 *   §6 Edge cases (2 tests)    — error no tipado pasa; PII safety en error
 *
 * Total: 14 tests.
 *
 * Se ejecuta manualmente con:
 *   node --test --require ./tests/setup.js --test-concurrency=1 \
 *     tests/middleware/pdfValidation.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');
const multer = require('multer');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const pdfValidation = require('../../src/middleware/pdfValidation');
const config = require('../../src/config');

// =====================================================================
// Helpers
// =====================================================================

/**
 * Construye un PDF de 1 pagina valido (parseable por pdf-lib). Buffer.
 */
async function buildSimplePdf() {
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 200]);
  return Buffer.from(await pdf.save());
}

/**
 * Construye un PDF de N paginas con algo de texto. Buffer.
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
 * Construye un PDF con /Encrypt en el trailer (mismo truco que usa
 * services/pdfValidator.test.js).
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

/**
 * Captura stdout+stderr mientras corre fn. El logger de la app escribe
 * a stdout (info) y stderr (warn/error). Devuelve el texto combinado.
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
 * Ejecuta el middleware contra un req/res sintetico. Retorna una promesa
 * que se resuelve con `{ nextCalled, nextArg, req, res }` cuando next()
 * se invoca (con o sin argumento). El middleware es async, asi que
 * esperamos el tick de microtasks.
 *
 * @param {object|null} file — si no es null, se asigna a req.file
 * @param {object} [opts]
 * @param {boolean} [opts.omitBuffer] — no setea req.file.buffer (simula bug)
 * @param {boolean} [opts.emptyBuffer] — buffer es Buffer.alloc(0)
 * @param {string} [opts.requestId] — id de request (def: 'test-req-id')
 */
function runMiddleware(file, opts = {}) {
  return new Promise((resolve) => {
    const req = {
      id: opts.requestId || 'test-req-id',
    };
    if (file !== null) {
      req.file = { ...file };
      if (opts.omitBuffer) delete req.file.buffer;
      if (opts.emptyBuffer) req.file.buffer = Buffer.alloc(0);
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
          // El middleware olvido llamar next() — no deberia pasar.
          resolve({ nextCalled: false, nextArg: undefined, req, res });
        }
      })
      .catch((e) => {
        // Una excepcion no manejada (bug del middleware) cae aca.
        resolve({ nextCalled: true, nextArg: e, req, res });
      });
  });
}

/**
 * Construye un mini servidor HTTP con un solo endpoint POST que corre
 * upload.single('documento') + pdfValidation() + un handler final
 * que responde 200. Util para los tests que quieren un req.file real
 * (sin parsear multipart a mano).
 */
function makeMiniServer(extraHandlers = []) {
  const upload = multer({ storage: multer.memoryStorage() });
  const app = express();
  app.use(express.json());
  // Multer parsea el multipart; pdfValidation corre despues.
  app.post('/upload',
    upload.single('documento'),
    pdfValidation(),
    (req, res) => {
      // Exponer lo que el middleware puso en req para asserts.
      res.json({
        ok: true,
        sha256: req.pdfValidation && req.pdfValidation.sha256,
        pageCount: req.pdfValidation && req.pdfValidation.pageCount,
        size: req.file && req.file.buffer && req.file.buffer.length,
      });
    },
    ...extraHandlers
  );
  // Captura errores de AppError (mismo patron que el errorHandler central).
  // Lo anadimos local para no contaminar el globalErrorHandler de la app real.
  app.use((err, req, res, next) => {
    if (err && typeof err.statusCode === 'number') {
      return res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'boom' } });
  });
  return app;
}

function postUpload(app, fieldName, buffer, filename) {
  return new Promise((resolve, reject) => {
    const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
    const boundary = '----test' + Math.random().toString(16).slice(2);
    const parts = [];
    parts.push(`--${boundary}\r\n`);
    parts.push(`Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n`);
    parts.push('Content-Type: application/pdf\r\n\r\n');
    const head = Buffer.from(parts.join(''), 'utf8');
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const body = Buffer.concat([head, data, tail]);

    // Usar el puerto que el server.listen() retorno.
    const server = app.listen(0);
    server.on('error', reject);
    const port = server.address().port;

    const req = http.request({
      method: 'POST',
      hostname: '127.0.0.1',
      port,
      path: '/upload',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      let chunks = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(chunks); } catch (_) { parsed = chunks; }
        server.close();
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', (err) => {
      server.close();
      reject(err);
    });
    req.write(body);
    req.end();
  });
}

// =====================================================================
// §1: PDF_REQUIRED (3 tests)
// =====================================================================

test('§1.1: req.file undefined → next con AppError 400 PDF_REQUIRED', async () => {
  const r = await runMiddleware(null);
  assert.equal(r.nextCalled, true);
  const err = r.nextArg;
  assert.ok(err && typeof err.statusCode === 'number', 'debe ser AppError-like');
  assert.equal(err.statusCode, 400);
  assert.equal(err.code, 'PDF_REQUIRED');
  assert.equal(err.details && err.details.reason, 'no_file');
});

test('§1.2: req.file existe pero sin buffer → next con AppError 400 PDF_REQUIRED', async () => {
  const r = await runMiddleware(
    { originalname: 'x.pdf', mimetype: 'application/pdf', size: 0 },
    { omitBuffer: true }
  );
  assert.equal(r.nextArg && r.nextArg.statusCode, 400);
  assert.equal(r.nextArg.code, 'PDF_REQUIRED');
  assert.equal(r.nextArg.details.reason, 'no_file');
});

test('§1.3: req.file.buffer es Buffer vacio (0 bytes) → next con AppError 400 PDF_REQUIRED', async () => {
  const r = await runMiddleware(
    { originalname: 'x.pdf', mimetype: 'application/pdf', size: 0 },
    { emptyBuffer: true }
  );
  assert.equal(r.nextArg && r.nextArg.statusCode, 400);
  assert.equal(r.nextArg.code, 'PDF_REQUIRED');
  assert.equal(r.nextArg.details.reason, 'no_file');
});

// =====================================================================
// §2: Happy path (3 tests)
// =====================================================================

test('§2.1: PDF de 1 pagina valido → next() sin arg, req.pdfValidation tiene sha256/pageCount/metadata', async () => {
  const buf = await buildSimplePdf();
  const r = await runMiddleware({ originalname: 'a.pdf', buffer: buf });
  // next() llamado sin error
  assert.equal(r.nextCalled, true);
  assert.equal(r.nextArg, undefined, 'next debe ser llamado sin error');
  // req.pdfValidation tiene la forma esperada
  assert.ok(r.req.pdfValidation, 'req.pdfValidation debe existir');
  assert.match(r.req.pdfValidation.sha256, /^[0-9a-f]{64}$/);
  assert.equal(r.req.pdfValidation.pageCount, 1);
  assert.ok(typeof r.req.pdfValidation.metadata === 'object' && r.req.pdfValidation.metadata !== null);
});

test('§2.2: PDF de 3 paginas valido → req.pdfValidation.pageCount === 3', async () => {
  const buf = await buildNPagePdf(3);
  const r = await runMiddleware({ originalname: 'b.pdf', buffer: buf });
  assert.equal(r.nextArg, undefined);
  assert.equal(r.req.pdfValidation.pageCount, 3);
});

test('§2.3: log incluye request_id, sha256_prefix (8 chars), page_count, size_bytes — NO full sha256, NO metadata', async () => {
  const buf = await buildSimplePdf();
  const captured = await captureStdStreamsAsync(async () => {
    await runMiddleware(
      { originalname: 'logtest.pdf', buffer: buf },
      { requestId: 'req-capture-test-001' }
    );
  });
  const text = captured.combined;
  // 1. request_id presente
  assert.ok(text.includes('req-capture-test-001'),
    'log debe incluir el request_id');
  // 2. sha256_prefix (8 chars) presente: el prefijo se imprime como string en JSON,
  //    asi que verificamos que aparece. Tomamos el sha256 real para derivarlo.
  const { sha256 } = require('../../src/crypto/hash');
  const fullHash = sha256(buf);
  const prefix = fullHash.slice(0, 8);
  assert.ok(text.includes(`"sha256_prefix":"${prefix}"`),
    `log debe incluir sha256_prefix="${prefix}"`);
  // 3. page_count presente
  assert.ok(text.includes('"page_count":1'),
    'log debe incluir page_count:1');
  // 4. size_bytes presente
  assert.ok(text.includes(`"size_bytes":${buf.length}`),
    `log debe incluir size_bytes:${buf.length}`);
  // 5. NO incluye el sha256 completo (defense in depth)
  assert.ok(!text.includes(fullHash),
    'log NO debe incluir el sha256 completo (PII defense)');
  // 6. NO incluye "metadata" key (PII defense: Title/Author/Subject/Keywords)
  //    La string "metadata" podria aparecer en otras cosas; verificamos que
  //    NO esta la entrada JSON "metadata":{ o "metadata":"keys"
  assert.ok(!/"metadata":\s*["{]/.test(text),
    'log NO debe incluir el objeto metadata del PDF');
});

// =====================================================================
// §3: PDF_INVALID → 422 (2 tests)
// =====================================================================

test('§3.1: buffer = "not a pdf" → next con AppError 422 PDF_INVALID', async () => {
  const r = await runMiddleware({ originalname: 'x.pdf', buffer: Buffer.from('not a pdf') });
  assert.equal(r.nextArg && r.nextArg.statusCode, 422);
  assert.equal(r.nextArg.code, 'PDF_INVALID');
  assert.ok(typeof r.nextArg.message === 'string' && r.nextArg.message.length > 0);
  assert.ok(r.nextArg.details && typeof r.nextArg.details === 'object');
});

test('§3.2: buffer = random bytes (no header %PDF-) → next con AppError 422 PDF_INVALID', async () => {
  const r = await runMiddleware({
    originalname: 'r.pdf',
    buffer: Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd, 0x80, 0x81, 0x90, 0xa0]),
  });
  assert.equal(r.nextArg && r.nextArg.statusCode, 422);
  assert.equal(r.nextArg.code, 'PDF_INVALID');
});

// =====================================================================
// §4: PDF_ENCRYPTED → 422 (1 test)
// =====================================================================

test('§4.1: PDF con /Encrypt en trailer → next con AppError 422 PDF_ENCRYPTED', async () => {
  const encBuf = buildPdfWithEncryptMarker();
  const r = await runMiddleware({ originalname: 'enc.pdf', buffer: encBuf });
  assert.equal(r.nextArg && r.nextArg.statusCode, 422);
  assert.equal(r.nextArg.code, 'PDF_ENCRYPTED');
  assert.equal(r.nextArg.details && r.nextArg.details.reason, 'encrypted_pdf_not_supported');
});

// =====================================================================
// §5: Otros PDF_* → 422 (3 tests)
// =====================================================================

test('§5.1: buffer > config.pdf.maxBytes → next con AppError 422 PDF_TOO_LARGE', async () => {
  const oversized = Buffer.alloc(config.pdf.maxBytes + 1, 0x41);
  const r = await runMiddleware({ originalname: 'big.pdf', buffer: oversized });
  assert.equal(r.nextArg && r.nextArg.statusCode, 422);
  assert.equal(r.nextArg.code, 'PDF_TOO_LARGE');
  assert.equal(r.nextArg.details.actual_size, config.pdf.maxBytes + 1);
  assert.equal(r.nextArg.details.max_size, config.pdf.maxBytes);
});

test('§5.2: PDF con mas paginas que el maximo → next con AppError 422 PDF_TOO_MANY_PAGES', async () => {
  // Bajamos maxPages para que el test sea rapido (no construir 201 paginas).
  const origMax = config.pdf.maxPages;
  config.pdf.maxPages = 3;
  try {
    const buf = await buildNPagePdf(5);
    const r = await runMiddleware({ originalname: 'many.pdf', buffer: buf });
    assert.equal(r.nextArg && r.nextArg.statusCode, 422);
    assert.equal(r.nextArg.code, 'PDF_TOO_MANY_PAGES');
    assert.equal(r.nextArg.details.actual_pages, 5);
    assert.equal(r.nextArg.details.max_pages, 3);
  } finally {
    config.pdf.maxPages = origMax;
  }
});

test('§5.3: parse timeout (1ms sobre PDF real) → next con AppError 422 PDF_PARSE_TIMEOUT', async () => {
  // Bajamos el timeout a 1ms para forzar el rechazo de parseo. Un PDF
  // pequeño y simple es suficiente: la latencia de pdf-lib.load + event
  // loop scheduling > 1ms garantizada en cualquier hardware.
  const origTimeout = config.pdf.parseTimeoutMs;
  config.pdf.parseTimeoutMs = 1;
  try {
    const buf = await buildNPagePdf(50);  // ~50 paginas con texto
    const r = await runMiddleware({ originalname: 'slow.pdf', buffer: buf });
    assert.equal(r.nextArg && r.nextArg.statusCode, 422);
    assert.equal(r.nextArg.code, 'PDF_PARSE_TIMEOUT');
    assert.equal(r.nextArg.details.timeout_ms, 1);
  } finally {
    config.pdf.parseTimeoutMs = origTimeout;
  }
});

// =====================================================================
// §6: Edge cases (2 tests)
// =====================================================================

test('§6.1: error NO tipado (e.g. Error generico del validator) pasa al errorHandler, NO se mapea a 422', async () => {
  // Simulamos que el validator lanza un Error sin code (bug de programacion).
  // El middleware NO debe traducirlo a 422 — debe pasarlo tal cual para que
  // el errorHandler central devuelva 500 INTERNAL_ERROR.
  //
  // Truco: parchear pdfValidator.validate para que lance un Error puro.
  const pdfValidator = require('../../src/services/pdfValidator');
  const origValidate = pdfValidator.validate;
  pdfValidator.validate = () => {
    const e = new Error('boom from validator');
    // explícitamente sin .code
    throw e;
  };
  try {
    const buf = await buildSimplePdf();
    const r = await runMiddleware({ originalname: 'x.pdf', buffer: buf });
    assert.equal(r.nextArg && r.nextArg.message, 'boom from validator',
      'debe pasar el error original al next()');
    // El errorHandler central decidiria que hacer. Aqui solo verificamos
    // que el middleware NO lo envolvio en AppError(422, ...).
    assert.ok(!r.nextArg.statusCode,
      'el error NO debe tener statusCode (no es AppError)');
    assert.ok(!r.nextArg.code || !/^PDF_/.test(r.nextArg.code),
      'el error NO debe tener code PDF_*');
  } finally {
    pdfValidator.validate = origValidate;
  }
});

test('§6.2: PDF invalido → response body NO contiene los bytes del PDF (PII safety)', async () => {
  // Verificamos la ruta real (multer + middleware + errorHandler) para
  // asegurarnos de que el body HTTP al cliente NO incluye los bytes del PDF.
  const app = makeMiniServer();
  // PDF invalido: solo magic + basura. Incluimos un patron UNICO en el
  // cuerpo para buscarlo en la response y confirmar que NO aparece.
  const secretMarker = 'PII-MARKER-DO-NOT-LEAK-7a3f9c';
  const badBuf = Buffer.concat([
    Buffer.from('%PDF-1.4\n'),
    Buffer.from(secretMarker),
    Buffer.from('\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'),
  ]);
  const r = await postUpload(app, 'documento', badBuf, 'bad.pdf');
  // Esperamos 422 PDF_INVALID (mapeo por middleware).
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, 'PDF_INVALID');
  // El marker NO debe aparecer en el body de la respuesta.
  const body = JSON.stringify(r.body);
  assert.ok(!body.includes(secretMarker),
    'response body NO debe contener el marker del PDF (PII safety)');
  // El buffer raw tampoco debe aparecer.
  assert.ok(!body.includes(badBuf.toString('utf8')),
    'response body NO debe contener el body completo del PDF');
});
