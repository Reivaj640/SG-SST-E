/**
 * Servicio de Validacion Estructural de PDF (I-012.1).
 *
 * Es el primer sub-bloque de la iniciativa I-012 (PDF Security). Su unica
 * responsabilidad es validar la ESTRUCTURA de los PDFs que K+AIR sube al
 * endpoint POST /v1/internal/sign-requests, y producir un fingerprint
 * SHA-256 del binario + metadatos parseados. El resultado lo consume
 * I-012.2 (wire-up HTTP) y luego el flujo existente signRequest.create()
 * (cuyo contrato -incluido pdf_sha256 como parte del fingerprint de
 * I-003- NO cambia).
 *
 * ============================================================
 * QUE ES Y QUE NO ES ESTE SERVICIO (leer antes de extender)
 * ============================================================
 *
 * ESTE SERVICIO ES:
 *   - Un parser estructural de PDF: lee el header %PDF-1.x, camina la
 *     tabla cross-reference, detecta entradas /Encrypt, cuenta paginas
 *     y extrae el diccionario /Info (Title, Author, etc.).
 *   - Un calculador de hash: SHA-256 del buffer completo.
 *   - Un validador de limites: tamano, paginas, tamano de metadata y
 *     tiempo de parseo.
 *
 * ESTE SERVICIO NO ES:
 *   - Un sandbox ni un antivirus. NO ejecuta el PDF ni lo renderiza.
 *   - Un escaner de malware. Un PDF "valido" estructuralmente puede
 *     contener JavaScript malicioso, exploits de reader bugs, imagenes
 *     con payloads, o cualquier otro contenido hostil.
 *   - Una garantia de seguridad. NO debe usarse como unico control
 *     antes de aceptar un documento. La capa HTTP / K+AIR / el
 *     lector del firmante son los responsables de la seguridad del
 *     contenido.
 *
 * Esto se reitera en el JSDoc de validate() y en el contrato de
 * errores. La nomenclatura "validator" puede sugerir una proteccion
 * que este servicio NO ofrece. Cualquier consumidor (I-012.2, otras
 * rutas, documentacion) debe entender esta limitacion.
 *
 * ============================================================
 * DECISIONES DE DISENO
 * ============================================================
 *
 * 1. **Capa pura, sin HTTP.** Este service NO conoce Express, no
 *    llama next(), no usa res.status(). Lanza errores tipados con
 *    `code` y `details`. I-012.2 mapea el codigo a HTTP 422.
 *    Mismo patron que services/idempotency.js (I-003.2).
 *
 * 2. **PDFs encriptados.** pdf-lib (v1.17.1) NO soporta desencriptar
 *    PDFs. Si pasamos un PDF encriptado a PDFDocument.load(), lanza
 *    EncryptedPDFError. Para producir nuestro propio error tipado,
 *    cargamos con { ignoreEncryption: true } y luego consultamos
 *    pdfDoc.isEncrypted. Esto nos permite rechazarlo con
 *    PDF_ENCRYPTED en vez del error generico de pdf-lib.
 *
 * 3. **Timeout via Promise.race.** pdf-lib es asincrono; envolvemos
 *    la promesa con un setTimeout que rechaza primero. Si el timeout
 *    se dispara, NO esperamos a que load() termine: lanzamos
 *    PdfParseTimeoutError inmediatamente. La promesa perdedora del
 *    race sigue corriendo hasta que termine (o el proceso muera),
 *    pero la respuesta de nuestro servicio ya se decidio. Esto es
 *    aceptable porque el PDF no sera aceptado de todas formas.
 *
 * 4. **Limite de metadata.** El /Info dictionary puede contener
 *    strings arbitrariamente grandes (ataques de "metadata bomb").
 *    Sumamos el byte length de cada string value y rechazamos si
 *    supera config.pdf.maxMetadataBytes. NO incluimos los bytes
 *    en el error (PII risk).
 *
 * 5. **PII / logging.** NUNCA logueamos los bytes del PDF, ni el
 *    Title/Author/Subject del /Info dictionary. Solo el codigo de
 *    error, tamano y page count (cuando se conoce). El sistema de
 *    redaccion del logger (utils/logger.js) tambien ayuda, pero
 *    nuestra disciplina es: pasar solo datos no-PII al logger.
 *
 * 6. **SHA-256.** Usamos sha256() de src/crypto/hash.js (mismo
 *    modulo que idempotency). Esto garantiza el mismo formato hex
 *    lowercase de 64 chars que ya consume signRequest.create() y
 *    el fingerprint de I-003. NO re-implementamos el hash.
 */
'use strict';

const config = require('../config');
const { sha256 } = require('../crypto/hash');
const { PDFDocument } = require('pdf-lib');
const logger = require('../utils/logger');

// =====================================================================
// Constantes
// =====================================================================

/** Prefijo del header magico de un PDF (ISO 32000-1 §7.5.2). */
const PDF_MAGIC_PREFIX = Buffer.from('%PDF-', 'latin1');

/**
 * Timeout de safety net. El real viene de config.pdf.parseTimeoutMs.
 * Si el config falla en cargar (caso patologico), caemos aqui en vez
 * de nunca resolver. NO deberia ejecutarse en produccion.
 */
const FALLBACK_PARSE_TIMEOUT_MS = 30000;

// =====================================================================
// Clases de error
// =====================================================================
//
// Este service NO conoce HTTP. Lanza errores con `code` y `details`
// para que I-012.2 los mapee a status code HTTP (todos 422 por
// decision de diseno, salvo casos de bug del cliente que seran 400).
// Patron identico a services/idempotency.js (I-003.2).

/**
 * Base para todos los errores del pdfValidator.
 * `code` es el string que I-012.2 mapea a HTTP.
 * `details` es un objeto con contexto sin PII (sin bytes del PDF,
 * sin Title/Author del /Info).
 */
class PdfValidatorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PdfValidatorError';
    this.code = code;
    this.details = details;
  }
}

/** Buffer no parseable como PDF (header invalido, truncado, basura). */
class PdfInvalidError extends PdfValidatorError {
  constructor(message, details) {
    super('PDF_INVALID', message, details);
    this.name = 'PdfInvalidError';
  }
}

/** PDF tiene entrada /Encrypt en el trailer (no se puede desencriptar). */
class PdfEncryptedError extends PdfValidatorError {
  constructor(message, details) {
    super('PDF_ENCRYPTED', message, details);
    this.name = 'PdfEncryptedError';
  }
}

/** Buffer.length > config.pdf.maxBytes. */
class PdfTooLargeError extends PdfValidatorError {
  constructor(message, details) {
    super('PDF_TOO_LARGE', message, details);
    this.name = 'PdfTooLargeError';
  }
}

/** pageCount > config.pdf.maxPages. */
class PdfTooManyPagesError extends PdfValidatorError {
  constructor(message, details) {
    super('PDF_TOO_MANY_PAGES', message, details);
    this.name = 'PdfTooManyPagesError';
  }
}

/** parseo excedio config.pdf.parseTimeoutMs. */
class PdfParseTimeoutError extends PdfValidatorError {
  constructor(message, details) {
    super('PDF_PARSE_TIMEOUT', message, details);
    this.name = 'PdfParseTimeoutError';
  }
}

/** Suma de bytes del /Info dictionary > config.pdf.maxMetadataBytes. */
class PdfMetadataTooLargeError extends PdfValidatorError {
  constructor(message, details) {
    super('PDF_METADATA_TOO_LARGE', message, details);
    this.name = 'PdfMetadataTooLargeError';
  }
}

// =====================================================================
// Helpers internos
// =====================================================================

/**
 * Verifica que el buffer no exceda el limite. Antes de hacer cualquier
 * parseo, porque es O(1) y filtra ataques de tamano obvios.
 *
 * @param {Buffer} buffer
 * @throws {PdfTooLargeError} si buffer.length > maxBytes
 */
function _checkSize(buffer, maxBytes) {
  if (buffer.length > maxBytes) {
    throw new PdfTooLargeError(
      `PDF excede el tamano maximo de ${maxBytes} bytes`,
      { actual_size: buffer.length, max_size: maxBytes }
    );
  }
}

/**
 * Verifica el header magico %PDF- antes de pasar a pdf-lib.
 * Esto evita que pdf-lib gaste CPU parseando un buffer que claramente
 * no es un PDF (ataque de "troll": 50 MB de zeros, p.ej.).
 *
 * @param {Buffer} buffer
 * @throws {PdfInvalidError} si el header no comienza con %PDF-
 */
function _checkMagic(buffer) {
  if (buffer.length < PDF_MAGIC_PREFIX.length) {
    throw new PdfInvalidError(
      'Buffer demasiado pequeno para ser un PDF',
      { reason: 'too_short', actual_size: buffer.length }
    );
  }
  if (buffer.slice(0, PDF_MAGIC_PREFIX.length).toString('latin1') !== '%PDF-') {
    throw new PdfInvalidError(
      'Header magico invalido (no comienza con %PDF-)',
      { reason: 'bad_magic', actual_size: buffer.length }
    );
  }
}

/**
 * Suma el byte length de todos los string values de un objeto metadata.
 * Defensivo contra "metadata bomb" (Title/Author gigante).
 *
 * Solo cuenta strings. Si el value es objeto/array (raro pero posible
 * en PDFs malformados), lo ignora para no meternos en recursion
 * arbitraria.
 *
 * @param {object} metadataObj - objeto con valores string
 * @returns {number} tamano total en bytes
 */
function _metadataSizeBytes(metadataObj) {
  if (!metadataObj || typeof metadataObj !== 'object') return 0;
  let total = 0;
  for (const v of Object.values(metadataObj)) {
    if (typeof v === 'string') {
      total += Buffer.byteLength(v, 'utf8');
    } else if (Array.isArray(v)) {
      // Keywords suele ser array de strings. pdf-lib lo devuelve como
      // string con espacios al hacer getKeywords(); si viene array
      // (caso raro), lo manejamos aqui.
      for (const item of v) {
        if (typeof item === 'string') total += Buffer.byteLength(item, 'utf8');
      }
    }
  }
  return total;
}

/**
 * Lee el /Info dictionary del PDF y devuelve un objeto plano con los
 * campos standard. Solo incluye campos con valor string no vacio.
 *
 * Por diseno NO devolvemos Producer/Creator si no se pidieron (estan
 * siempre en PDFs generados por pdf-lib, "ruido" sin valor para el
 * negocio). Si I-012.2 los necesita, agregar a INFO_KEYS.
 *
 * NUNCA incluir el valor en errores o logs. Esto es PII.
 *
 * @param {PDFDocument} pdfDoc
 * @returns {object} metadata con keys: Title, Author, Subject, Keywords
 */
function _extractMetadata(pdfDoc) {
  const out = {};
  // getKeywords() de pdf-lib devuelve string con espacios, o undefined.
  if (typeof pdfDoc.getTitle === 'function') {
    const v = pdfDoc.getTitle();
    if (typeof v === 'string' && v.length > 0) out.Title = v;
  }
  if (typeof pdfDoc.getAuthor === 'function') {
    const v = pdfDoc.getAuthor();
    if (typeof v === 'string' && v.length > 0) out.Author = v;
  }
  if (typeof pdfDoc.getSubject === 'function') {
    const v = pdfDoc.getSubject();
    if (typeof v === 'string' && v.length > 0) out.Subject = v;
  }
  if (typeof pdfDoc.getKeywords === 'function') {
    const v = pdfDoc.getKeywords();
    if (typeof v === 'string' && v.length > 0) out.Keywords = v;
  }
  return out;
}

/**
 * Carga el PDF con timeout via Promise.race. Si el timeout se
 * dispara, rechaza con PdfParseTimeoutError. La promesa perdedora
 * del race sigue viva hasta que termine (pdf-lib cierra handles al
 * terminar), pero no bloqueamos al caller.
 *
 * pdf-lib no soporta desencriptar, asi que cargamos SIEMPRE con
 * { ignoreEncryption: true } y luego decidimos segun pdfDoc.isEncrypted.
 * Esto nos da control sobre el error (PdfEncryptedError) en vez del
 * error generico EncryptedPDFError de pdf-lib.
 *
 * @param {Buffer} buffer
 * @param {number} timeoutMs
 * @returns {Promise<PDFDocument>}
 * @throws {PdfParseTimeoutError} si el parseo excede timeoutMs
 * @throws {PdfInvalidError} si el parseo falla (header, xref, etc.)
 */
function _loadWithTimeout(buffer, timeoutMs) {
  const effectiveTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : FALLBACK_PARSE_TIMEOUT_MS;

  // Sentinel para distinguir timeout de un rechazo natural de pdf-lib.
  // Usamos un timeout reject; si la carrera gana el timeout, marcamos
  // el sentinel y rechazamos con PdfParseTimeoutError.
  let timedOut = false;
  const timeoutPromise = new Promise((_, reject) => {
    const t = setTimeout(() => {
      timedOut = true;
      reject(new PdfParseTimeoutError(
        `PDF excedio el timeout de parseo de ${effectiveTimeout}ms`,
        { timeout_ms: effectiveTimeout, buffer_size: buffer.length }
      ));
    }, effectiveTimeout);
    // Si load() gana, no necesitamos mantener el timer vivo.
    // (Promise.race ya lo descarta, pero cleanup explicito es
    // buena practica y libera el handle del event loop.)
    // NOTA: no podemos acceder al .resolve del load() desde aca sin
    // cambiar la firma; confiamos en que el GC libere cuando
    // timeoutPromise pierda la carrera.
    if (typeof t.unref === 'function') t.unref();
  });

  const loadPromise = PDFDocument.load(buffer, { ignoreEncryption: true })
    .catch((err) => {
      // Si el error es de encriptacion, lo manejamos en validate()
      // (aqui solo lo propagamos). Si el timeout ya gano, descartamos
      // este error para no enmascarar el timeout.
      if (timedOut) {
        // Forzamos un throw para que la promesa perdedora se rechaze,
        // pero NO propagamos al caller (Promise.race ya decidio).
        throw err;
      }
      // Re-lanzar como PdfInvalidError para que el caller tenga
      // un solo tipo de error por "no parseable". Preservamos el
      // mensaje original en details para debug.
      throw new PdfInvalidError(
        `No se pudo parsear el PDF: ${err.message}`,
        { reason: 'parse_error', original_error: String(err.name || 'Error') }
      );
    });

  return Promise.race([loadPromise, timeoutPromise]);
}

// =====================================================================
// validate
// =====================================================================

/**
 * Valida la estructura de un PDF y devuelve un resultado canonico.
 *
 * ----------------------------------------
 * LO QUE HACE:
 * ----------------------------------------
 *  1. Verifica que `buffer` sea un Buffer (no string, no null, no
 *     undefined). Lanza PdfInvalidError si no.
 *  2. Verifica que buffer.length <= config.pdf.maxBytes. Lanza
 *     PdfTooLargeError si no.
 *  3. Verifica que el header magico sea %PDF-. Lanza PdfInvalidError
 *     si no (defensa contra "troll" sin header).
 *  4. Calcula SHA-256 del buffer.
 *  5. Carga el PDF con pdf-lib + timeout de config.pdf.parseTimeoutMs.
 *     - Si timeout: PdfParseTimeoutError.
 *     - Si parseo falla: PdfInvalidError.
 *     - Si PDF encriptado (pdfDoc.isEncrypted): PdfEncryptedError.
 *  6. Verifica pageCount <= config.pdf.maxPages.
 *     Lanza PdfTooManyPagesError si no.
 *  7. Verifica que la suma de bytes del /Info dictionary no exceda
 *     config.pdf.maxMetadataBytes. Lanza PdfMetadataTooLargeError si no.
 *  8. Devuelve { sha256, pageCount, metadata } (metadata es {} si
 *     el PDF no tiene /Info).
 *
 * ----------------------------------------
 * LO QUE NO HACE (importante):
 * ----------------------------------------
 *  - NO sandboxa el PDF. NO lo ejecuta. NO lo renderiza.
 *  - NO escanea por malware, exploits, o JavaScript embebido.
 *  - NO garantiza que el contenido sea seguro de abrir en un reader.
 *  - NO valida el contenido visual (firmas visibles, QR, etc.).
 *
 *  Un "PDF valido" devuelto por este servicio solo significa
 *  "los bytes parsean correctamente como PDF, tienen metadata
 *  razonable y no estan encriptados". La seguridad del contenido
 *  es responsabilidad de otras capas (K+AIR, visor del firmante,
 *  Antivirus perimetral, etc.).
 *
 * ----------------------------------------
 * Por que el codigo de error no es HTTP:
 * ----------------------------------------
 *  Este service es una capa de dominio. Lanza PdfValidatorError con
 *  un `code` (string) que I-012.2 mapea a HTTP 422 en la frontera.
 *  Mantener HTTP fuera de aqui permite reusar el service desde otros
 *  callers (CLI de validacion, otros endpoints, scripts de auditoria).
 *
 * @param {Buffer} buffer - bytes del PDF
 * @returns {Promise<{sha256: string, pageCount: number, metadata: object}>}
 *   - sha256: hex lowercase de 64 chars
 *   - pageCount: entero >= 1
 *   - metadata: { Title?, Author?, Subject?, Keywords? } (puede ser {})
 * @throws {PdfInvalidError} code PDF_INVALID
 * @throws {PdfEncryptedError} code PDF_ENCRYPTED
 * @throws {PdfTooLargeError} code PDF_TOO_LARGE
 * @throws {PdfTooManyPagesError} code PDF_TOO_MANY_PAGES
 * @throws {PdfParseTimeoutError} code PDF_PARSE_TIMEOUT
 * @throws {PdfMetadataTooLargeError} code PDF_METADATA_TOO_LARGE
 */
async function validate(buffer) {
  // 1. Defense in depth: tipo de input.
  if (!Buffer.isBuffer(buffer)) {
    throw new PdfInvalidError(
      'Input debe ser un Buffer (no string, no null, no objeto)',
      { reason: 'not_a_buffer', received_type: buffer === null ? 'null' : typeof buffer }
    );
  }

  // Buffer vacio: header check fallara, pero lo cortamos aca con
  // un reason explicito (util para debug y para el cliente K+AIR).
  if (buffer.length === 0) {
    throw new PdfInvalidError(
      'Buffer vacio no es un PDF valido',
      { reason: 'empty', actual_size: 0 }
    );
  }

  // 2. Limite de tamano. Antes de cualquier parseo.
  _checkSize(buffer, config.pdf.maxBytes);

  // 3. Magic byte check. Filtro barato antes de pdf-lib.
  _checkMagic(buffer);

  // 4. SHA-256 del buffer completo. SIEMPRE se calcula (es el
  // fingerprint que la capa I-003 necesita aunque el PDF falle
  // otros checks). Pero: si fallamos magic check, no llegamos aca.
  const hash = sha256(buffer);

  // 5. Parseo con timeout. Si el PDF esta encriptado, pdf-lib lo
  // carga igual (ignoreEncryption:true) y pdfDoc.isEncrypted=true.
  let pdfDoc;
  try {
    pdfDoc = await _loadWithTimeout(buffer, config.pdf.parseTimeoutMs);
  } catch (err) {
    // _loadWithTimeout ya envuelve parse errors como PdfInvalidError
    // y timeout como PdfParseTimeoutError. Solo re-lanzamos.
    // El log NO incluye el buffer (PII) ni el mensaje de pdf-lib
    // completo (puede contener paths de archivos embebidos).
    logger.warn('PDF validation: parseo fallido', {
      code: err.code || 'UNKNOWN',
      buffer_size: buffer.length,
      reason: err.details && err.details.reason ? err.details.reason : null,
    });
    throw err;
  }

  // 6. Encriptado: pdfDoc.isEncrypted lo expone pdf-lib 1.17.1.
  if (pdfDoc.isEncrypted) {
    logger.warn('PDF validation: PDF encriptado rechazado', {
      code: 'PDF_ENCRYPTED',
      buffer_size: buffer.length,
    });
    throw new PdfEncryptedError(
      'PDF encriptado no soportado (no se puede desencriptar)',
      { reason: 'encrypted_pdf_not_supported', buffer_size: buffer.length }
    );
  }

  // 7. Page count. getPageCount() puede throw si el catalog no
  // tiene /Pages; en ese caso lo tratamos como PdfInvalidError.
  let pageCount;
  try {
    pageCount = pdfDoc.getPageCount();
  } catch (err) {
    throw new PdfInvalidError(
      `No se pudo contar paginas del PDF: ${err.message}`,
      { reason: 'page_count_error' }
    );
  }

  if (pageCount > config.pdf.maxPages) {
    logger.warn('PDF validation: demasiadas paginas', {
      code: 'PDF_TOO_MANY_PAGES',
      buffer_size: buffer.length,
      page_count: pageCount,
    });
    throw new PdfTooManyPagesError(
      `PDF tiene ${pageCount} paginas, maximo permitido: ${config.pdf.maxPages}`,
      { actual_pages: pageCount, max_pages: config.pdf.maxPages }
    );
  }

  // 8. Metadata size check (defensa contra metadata bomb).
  const metadata = _extractMetadata(pdfDoc);
  const metaSize = _metadataSizeBytes(metadata);
  if (metaSize > config.pdf.maxMetadataBytes) {
    logger.warn('PDF validation: metadata demasiado grande', {
      code: 'PDF_METADATA_TOO_LARGE',
      buffer_size: buffer.length,
      metadata_size: metaSize,
    });
    throw new PdfMetadataTooLargeError(
      `Metadata del PDF excede ${config.pdf.maxMetadataBytes} bytes (total: ${metaSize})`,
      { actual_size: metaSize, max_size: config.pdf.maxMetadataBytes }
    );
  }

  return {
    sha256: hash,
    pageCount,
    metadata,
  };
}

// =====================================================================
// Exports
// =====================================================================

module.exports = {
  validate,
  // Clases de error (para que I-012.2 las importe y mapee a HTTP).
  PdfValidatorError,
  PdfInvalidError,
  PdfEncryptedError,
  PdfTooLargeError,
  PdfTooManyPagesError,
  PdfParseTimeoutError,
  PdfMetadataTooLargeError,
};
