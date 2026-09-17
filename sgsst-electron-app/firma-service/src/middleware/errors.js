/**
 * Middleware: manejador de errores central.
 *
 * - Captura errores thrown o next(err).
 * - Devuelve JSON con el formato estándar de error.
 * - Loguea el error completo server-side; al cliente solo lo seguro.
 */
'use strict';

const logger = require('../utils/logger');

class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
}

function errorHandler() {
  // eslint-disable-next-line no-unused-vars
  return function (err, req, res, next) {
    const requestId = req.id || 'unknown';

    // AppError: error de aplicación conocido
    if (err instanceof AppError) {
      logger.warn('Error de aplicación', {
        request_id: requestId,
        code: err.code,
        status: err.statusCode,
        message: err.message,
        details: err.details,
      });
      return res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
          request_id: requestId,
        },
      });
    }

    // Error inesperado
    logger.error('Error no controlado', {
      request_id: requestId,
      error: err.message,
      stack: err.stack,
    });
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor',
        request_id: requestId,
      },
    });
  };
}

module.exports = { AppError, errorHandler };
