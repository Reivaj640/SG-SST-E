/**
 * Middleware: upload de PDF con multer.
 *
 * - Límite de tamaño: 10 MB.
 * - Solo acepta application/pdf.
 * - Guarda en memoria (no en disco) para que el service decida.
 *
 * Ver API.md §6.1 (POST /internal/sign-requests).
 */
'use strict';

const multer = require('multer');
const signRequestService = require('../services/signRequest');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: signRequestService.MAX_PDF_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      const err = new Error('Tipo de archivo no permitido. Solo se acepta application/pdf');
      err.code = 'INVALID_FILE_TYPE';
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

/**
 * Middleware para un solo archivo en el campo 'documento'.
 */
function uploadPdf() {
  const handler = upload.single('documento');
  return function (req, res, next) {
    handler(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new (require('./errors').AppError)(413, 'INVALID_REQUEST_BODY',
            `PDF demasiado grande (máximo ${signRequestService.MAX_PDF_SIZE} bytes)`));
        }
        if (err.code === 'INVALID_FILE_TYPE') {
          return next(new (require('./errors').AppError)(400, 'INVALID_REQUEST_BODY',
            err.message));
        }
        // I-012.3: multer rechaza múltiples archivos con LIMIT_UNEXPECTED_FILE.
        // Lo mapeamos a 400 (request malformado) en vez del 500 que produce
        // el errorHandler central cuando recibe un MulterError no-AppError.
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(new (require('./errors').AppError)(400, 'INVALID_REQUEST_BODY',
            'Solo se acepta un archivo en el campo "documento"'));
        }
        return next(err);
      }
      if (!req.file) {
        return next(new (require('./errors').AppError)(400, 'INVALID_REQUEST_BODY',
          'Falta el archivo PDF en el campo "documento"'));
      }
      next();
    });
  };
}

module.exports = { uploadPdf };
