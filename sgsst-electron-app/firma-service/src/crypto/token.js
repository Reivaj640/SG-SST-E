/**
 * Generación de tokens para SIGN_REQUEST.
 *
 * - Token aleatorio >= 32 caracteres alfanuméricos (base64url).
 * - Se retorna en texto plano SOLO en la respuesta de creación.
 * - En BD se almacena únicamente el hash del token.
 *
 * ALGORITMO
 * ---------
 * El hash almacenado es HMAC-SHA256 con clave derivada por HKDF de la llave
 * maestra del servicio (`TOKEN_ENCRYPTION_KEY`). El numeral 3.6(e) del
 * Acuerdo de uso exige que el token de acceso se conserve "únicamente en
 * forma de huella digital con sal"; el HMAC con clave externa cumple eso y
 * además impide que quien lea la base de datos pueda recomputar el token.
 *
 * Antes se usaba SHA-256 pelado. Ese caso no era explotable (el token tiene
 * 192 bits de entropía), pero incumplía la letra del 3.6(e). Las filas
 * heredadas siguen verificando con SHA-256: la búsqueda prueba las dos
 * huellas (ver `getByTokenHash` en services/signRequest.js).
 *
 * Ver ARCHITECTURE.md §12.1, DATA_MODEL.md §1.7 y el Capítulo III del
 * Acuerdo de uso (3.6(e)).
 */
'use strict';

const crypto = require('crypto');
const { sha256 } = require('./hash');
const { hmacHex, hmacV1Hex, listKeyVersions } = require('./hmac');

const TOKEN_BYTES = 24; // -> 32 chars base64url
const PROPOSITO_TOKEN = 'token';

/**
 * Propósito de la LÁPIDA de supresión (migración 024).
 *
 * Deriva una llave DISTINTA de la del token. La lápida guarda
 * HMAC(este propósito, token_hash): un hash de un hash, con otra llave. No
 * sirve para autenticarse ni para resolver la fila: solo permite que el
 * sistema responda "esta firma se suprimió por vencimiento del plazo" cuando
 * alguien abre un enlace que ya no existe.
 */
const PROPOSITO_TUMBA = 'tombstone-purga';

/**
 * Calcula la marca de lápida de un hash de token.
 *
 * @param {string} tokenHash - el hash que la fila tenía (NO el token)
 * @returns {string} 64 chars hex
 */
function hashTokenTombstone(tokenHash) {
  if (typeof tokenHash !== 'string' || tokenHash.length === 0) {
    throw new Error('hashTokenTombstone: hash de token requerido');
  }
  return hmacHex(PROPOSITO_TUMBA, tokenHash);
}

/**
 * Todas las marcas de lápida con las que puede estar registrado un token.
 *
 * Es el espejo de `tokenHashCandidates`: por cada hash con el que la fila
 * pudo haber guardado el token, se deriva la marca de lápida con su propio
 * propósito. Así, una fila vieja (SHA-256 pelado) y una nueva (HMAC) se
 * localizan igual.
 *
 * @param {string} token
 * @returns {string[]} lista de marcas candidatas
 */
function tokenTombstoneCandidates(token) {
  return tokenHashCandidates(token).map(hashTokenTombstone);
}

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
 *
 * HEREDADO: se conserva solo para verificar tokens de filas anteriores al
 * cambio a HMAC. Para todo lo nuevo, usar `hashTokenHmac`.
 */
function hashToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('hashToken: token requerido');
  }
  return sha256(token);
}

/**
 * Calcula el hash de un token con HMAC-SHA256 y clave derivada de la llave
 * maestra. Es lo que se almacena en BD para las solicitudes nuevas.
 *
 * El ámbito es GLOBAL: el token es la credencial con la que se resuelve la
 * solicitud, así que cuando se busca todavía no se sabe de qué empresa es.
 *
 * @param {string} token
 * @returns {string} 64 chars hex
 */
function hashTokenHmac(token) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('hashTokenHmac: token requerido');
  }
  return hmacHex(PROPOSITO_TOKEN, token);
}

/**
 * TODOS los hashes con los que puede estar guardado un token, para que
 * una fila nunca quede sin poder resolverse.
 *
 * Se prueban las versiones del anillo de llaves (una fila puede haberse
 * calculado con una anterior), el formato v1 (la primera implementación del
 * HMAC, sin versión de llave) y el SHA-256 pelado (las filas anteriores al
 * cambio a HMAC).
 *
 * @param {string} token
 * @returns {string[]} lista de hashes candidatos
 */
function tokenHashCandidates(token) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('tokenHashCandidates: token requerido');
  }
  const lista = [];
  for (const version of listKeyVersions()) {
    lista.push(hmacHex(PROPOSITO_TOKEN, token, undefined, version));
  }
  lista.push(hmacV1Hex(PROPOSITO_TOKEN, token));
  lista.push(sha256(token));
  return lista;
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
  hashTokenHmac,
  tokenHashCandidates,
  hashTokenTombstone,
  tokenTombstoneCandidates,
  generateIdSolicitud,
  TOKEN_BYTES,
  PROPOSITO_TOKEN,
  PROPOSITO_TUMBA,
};
