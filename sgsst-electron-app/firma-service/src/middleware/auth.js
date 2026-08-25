/**
 * Middleware: autenticación administrativa por API key.
 *
 * Usado SOLO por un operador humano para publicar/gestionar versiones
 * del Acuerdo de uso y para administrar clientes per-empresa. K+AIR NO
 * debe tener esta key.
 *
 * - Header: X-Admin-API-Key.
 * - Config: config.auth.adminApiKey (validada en src/config.js para que
 *   en producción NO empiece con "cambiar-").
 * - Compara con constantTimeEqual (no ==).
 * - Si falla, retorna 401 INVALID_API_KEY (no distingue "falta header"
 *   vs "key incorrecta" para no filtrar información).
 * - Si pasa, req.adminAuth = true.
 *
 * Para autenticación de negocio (K+AIR → firma-service) usar
 * requireEmpresaScope / requireEmpresaScopeAndLimit (ver middleware/authz.js).
 * Esas middlewares aceptan tanto las API keys per-empresa (en
 * gh_internal_clients) como la legacy key con período de deprecation
 * (validada por internalClient.lookupLegacyClient).
 *
 * Ver API.md §6 y SECURITY.md §3.2.
 */
'use strict';

const config = require('../config');
const { constantTimeEqual } = require('../crypto/compare');
const { AppError } = require('./errors');

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

module.exports = { adminApiAuth };
