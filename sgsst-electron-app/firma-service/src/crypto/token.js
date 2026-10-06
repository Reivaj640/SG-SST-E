/**
 * Generación de tokens para SIGN_REQUEST.
 *
 * - Token aleatorio >= 32 caracteres alfanuméricos (base64url).
 * - Se retorna en texto plano SOLO en la respuesta de creación.
 * - En BD se almacena únicamente token_hash = SHA-256(token).
 *
 * Ver ARCHITECTURE.md §12.1 y DATA_MODEL.md §1.7.
 */
'use strict';

const crypto = require('crypto');
const { sha256 } = require('./hash');

const TOKEN_BYTES = 24; // -> 32 chars base64url

/**
 * Genera un token aleatorio criptográficamente seguro.
 * Retorna string base64url de 32 chars.
 */
function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * Calcula el hash de un token (SHA-256 en hex).
 * Esto es lo que se almacena en BD.
 */
function hashToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('hashToken: token requerido');
  }
  return sha256(token);
}

/**
 * Genera el id de solicitud con formato SIGN-YYYY-NNNNNN.
 * NNNNNN es un contador por año.
 *
 * NOTA: el contador real debe ser una secuencia en BD. Aquí se
 * usa crypto.randomBytes(3) por simplicidad; el caller puede
 * sobrescribir. Para producción, usar una secuencia atómica.
 */
function generateIdSolicitud(year, counter) {
  const y = year || new Date().getFullYear();
  if (typeof counter === 'number') {
    return `SIGN-${y}-${String(counter).padStart(6, '0')}`;
  }
  // Fallback: número aleatorio de 6 dígitos (NO usar en producción)
  const n = parseInt(crypto.randomBytes(3).toString('hex'), 16) % 1000000;
  return `SIGN-${y}-${String(n).padStart(6, '0')}`;
}

module.exports = {
  generateToken,
  hashToken,
  generateIdSolicitud,
  TOKEN_BYTES,
};
