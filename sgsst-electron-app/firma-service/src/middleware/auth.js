/**
 * Middleware: autenticación de API interna por X-Internal-API-Key.
 *
 * - Aplica a todos los endpoints /internal/*.
 * - Compara el header con config.auth.internalApiKey usando
 *   constantTimeEqual (no ==).
 * - Si falla, retorna 401 INVALID_API_KEY.
 * - Si pasa, setea req.internalAuth = true.
 *
 * Ver API.md §6 y SECURITY.md §3.2.
 */
'use strict';

const config = require('../config');
const { constantTimeEqual } = require('../crypto/compare');
const { AppError } = require('./errors');

function internalApiAuth() {
  return function (req, res, next) {
    const provided = req.get('X-Internal-API-Key');
    if (typeof provided !== 'string' || provided.length === 0) {
      return next(new AppError(401, 'INVALID_API_KEY',
        'Falta el header X-Internal-API-Key'));
    }
    if (!constantTimeEqual(provided, config.auth.internalApiKey)) {
      return next(new AppError(401, 'INVALID_API_KEY',
        'API key inválida'));
    }
    req.internalAuth = true;
    next();
  };
}

module.exports = { internalApiAuth };
