/**
 * Middleware: validate the uploaded PDF structurally.
 *
 * This middleware is the HTTP-layer adapter for services/pdfValidator.js
 * (I-012.1). It assumes multer has already populated `req.file` with
 * a `Buffer` (i.e. `multer.memoryStorage()`).
 *
 * It runs AFTER multer and BEFORE the route handler. On success it
 * stashes the validator result on `req.pdfValidation` (sha256, pageCount,
 * metadata) for the handler to consume. On failure it translates the
 * validator's typed errors to AppError so the central errorHandler
 * returns the correct HTTP status to the client.
 *
 * ----------------------------------------
 * Error mapping (I-012.2 contract):
 * ----------------------------------------
 *   - PDF_REQUIRED (no file)        -> 400 (malformed request)
 *   - PDF_INVALID                  -> 422 (document not parseable)
 *   - PDF_ENCRYPTED                -> 422
 *   - PDF_TOO_LARGE                -> 422
 *   - PDF_TOO_MANY_PAGES           -> 422
 *   - PDF_PARSE_TIMEOUT            -> 422
 *   - PDF_METADATA_TOO_LARGE       -> 422
 *
 *   The 6 PDF_* codes are domain errors from the validator. They
 *   represent a well-formed HTTP request whose document is unprocessable.
 *   PDF_REQUIRED is the only one mapped to 400: the request itself is
 *   malformed (no file where one is required). The existing
 *   middleware/upload.js also returns 400 for missing file, but with
 *   code INVALID_REQUEST_BODY. This middleware's PDF_REQUIRED is the
 *   more specific code that I-012.2 introduces; in the route chain it
 *   is unreachable for the "no file" case because upload.js fires first.
 *   The 400 PDF_REQUIRED path is kept here as defense in depth (unit
 *   tests call the middleware directly without multer, and future
 *   routes that bypass upload.js would still get the right code).
 *
 * ----------------------------------------
 * What this middleware does NOT do:
 * ----------------------------------------
 *   - It does NOT sandbox, scan, or render the PDF. It does not run
 *     the bytes, does not look for malware or JavaScript embeds, and
 *     does not validate visual content. That is the validator's job,
 *     and the validator is itself a structural parser — not a security
 *     control. A "PDF_VALID" result means only that the bytes parse
 *     correctly as a PDF, with sane metadata, and are not encrypted.
 *     See services/pdfValidator.js for the full disclaimer.
 *   - It does NOT log PDF bytes, metadata Title/Author/Subject, or
 *     the full SHA-256. Only an 8-char sha256 prefix, the page count,
 *     the size in bytes, and the request id. This is consistent with
 *     the PII discipline in services/pdfValidator.js.
 *   - It does NOT call res.json() / res.status() / res.send(). It only
 *     calls next(). The central errorHandler formats the response.
 *
 * ----------------------------------------
 * Why async (even though validate() could be sync):
 * ----------------------------------------
 *   validate() is currently async (pdf-lib is async). Wrapping the
 *   middleware as `async` keeps the API future-proof if the validator
 *   becomes truly async (e.g. streamed parsing). The `next()` call
 *   itself is sync — the `await` is on the validator.
 */
'use strict';

const pdfValidator = require('../services/pdfValidator');
const { AppError } = require('./errors');
const logger = require('../utils/logger');

/**
 * Returns the pdfValidation middleware.
 *
 * @returns {Function} Express middleware (req, res, next)
 */
function pdfValidation() {
  return async function (req, _res, next) {
    try {
      // 1. Defense in depth: si multer no proceso un archivo (e.g. test
      //    que invoca el middleware directo, o ruta futura que lo use
      //    sin uploadPdf), devolvemos 400 PDF_REQUIRED explicito.
      //    Tambien si el buffer es vacio (0 bytes): es lo mismo que no
      //    haber enviado archivo. El validator tambien rechaza buffers
      //    vacios (reason: empty) con 422 PDF_INVALID, pero conceptualmente
      //    un buffer vacio es "no envie nada", asi que lo cortamos aca
      //    con 400 PDF_REQUIRED que es mas preciso.
      if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
        return next(new AppError(
          400,
          'PDF_REQUIRED',
          'Falta el archivo PDF (campo "documento") en el multipart/form-data',
          { reason: 'no_file' }
        ));
      }

      // 2. Validar estructura. validate() es async; lanza errores tipados.
      const result = await pdfValidator.validate(req.file.buffer);

      // 3. Exponer el resultado al handler (especialmente sha256).
      req.pdfValidation = {
        sha256: result.sha256,
        pageCount: result.pageCount,
        metadata: result.metadata,
      };

      // 4. Log seguro: solo prefijos, nunca bytes ni metadata PII.
      //    El sha256 completo NO se loguea (defense in depth: si el log
      //    se filtra, no expone el fingerprint del documento firmado).
      logger.info('pdfValidation OK', {
        request_id: req.id,
        sha256_prefix: result.sha256.slice(0, 8),
        page_count: result.pageCount,
        size_bytes: req.file.buffer.length,
      });

      return next();
    } catch (err) {
      // 5. Mapear errores tipados del validator a AppError(422, ...).
      //    Otros errores (e.g. AppError ya construido, bug del programador)
      //    pasan al errorHandler central sin transformacion.
      if (err && typeof err.code === 'string' && /^PDF_/.test(err.code)) {
        return next(new AppError(422, err.code, err.message, err.details || {}));
      }
      return next(err);
    }
  };
}

module.exports = pdfValidation;
