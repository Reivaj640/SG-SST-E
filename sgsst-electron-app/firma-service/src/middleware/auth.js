/**
 * Middleware: autenticación por API key (interna y administrativa).
 *
 * Hay DOS credenciales independientes, con dos middlewares separados:
 *  - internalApiAuth()  → header X-Internal-API-Key  → config.auth.internalApiKey
 *    Usado por K+AIR para operaciones de negocio (crear sign request, etc).
 *  - adminApiAuth()      → header X-Admin-API-Key    → config.auth.adminApiKey
 *    Usado SOLO por un operador humano para publicar/gestionar versiones
 *    del Acuerdo de uso. K+AIR NO debe tener esta key.
 *
 * Ambos middlewares:
 *  - Compara con constantTimeEqual (no ==).
 *  - Si falla, retorna 401 INVALID_API_KEY (mismo código, no distinguen
 *    "falta header" vs "key incorrecta" para no filtrar información).
 *  - Si pasa, setean req.internalAuth=true / req.adminAuth=true.
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

/**
 * Autenticación administrativa (X-Admin-API-Key).
 *
 * - Endpoint: /internal/admin/* (operación humana, no expuesta a K+AIR).
 * - Header: X-Admin-API-Key.
 * - Config: config.auth.adminApiKey (validada en src/config.js para que
 *   en producción NO empiece con "cambiar-").
 * - Si pasa, req.adminAuth = true.
 */
function adminApiAuth() {
  return function (req, res, next) {
    const provided = req.get('X-Admin-API-Key');
    if (typeof provided !== 'string' || provided.length === 0) {
      return next(new AppError(401, 'INVALID_API_KEY',
        'Falta el header X-Admin-API-Key'));
    }
    if (!constantTimeEqual(provided, config.auth.adminApiKey)) {
      return next(new AppError(401, 'INVALID_API_KEY',
        'API key administrativa inválida'));
    }
    req.adminAuth = true;
    next();
  };
}

module.exports = { internalApiAuth, adminApiAuth };
