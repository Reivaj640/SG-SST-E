/**
 * Funciones de hash criptográficas.
 *
 * - SHA-256 en hex (para document_hash, evidence_hash, agreement_hash).
 * - SHA-256 con sal (para otp_hash, correo_hash, cedula_hash).
 * - Generación de sal aleatoria.
 *
 * Ver DATA_MODEL.md §1.7.
 */
'use strict';

const crypto = require('crypto');

const SHA256_HEX_LENGTH = 64;
const SALT_LENGTH = 32; // bytes; produce string hex de 64 chars

/**
 * SHA-256 de un Buffer o string. Retorna hex lowercase.
 */
function sha256(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Genera una sal aleatoria criptográficamente segura.
 * Retorna string hex de 64 chars.
 */
function generateSalt() {
  return crypto.randomBytes(SALT_LENGTH).toString('hex');
}

/**
 * Hash con sal: SHA-256(salt + value). Hex lowercase.
 *
 * Usado para:
 * - otp_hash (con sal aleatorio por OTP)
 * - correo_hash (con sal aleatorio por correo)
 * - cedula_hash (con sal aleatorio por cedula, opcional)
 */
function hashWithSalt(value, salt) {
  if (typeof salt !== 'string' || salt.length === 0) {
    throw new Error('hashWithSalt: salt es requerido');
  }
  return sha256(salt + String(value));
}

module.exports = {
  sha256,
  generateSalt,
  hashWithSalt,
  SHA256_HEX_LENGTH,
  SALT_LENGTH,
};
