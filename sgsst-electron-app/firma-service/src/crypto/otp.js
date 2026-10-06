/**
 * Generación y validación de OTPs.
 *
 * - OTP numérico de 6 dígitos.
 * - Generado con crypto.randomInt (criptográficamente seguro).
 * - Almacenado como SHA-256(sal + otp), NUNCA en plano.
 * - TTL configurable (default 600s = 10 min).
 * - Máximo de intentos configurable (default 5).
 *
 * Ver ARCHITECTURE.md §11.2 y SECURITY.md §S.1.
 */
'use strict';

const crypto = require('crypto');
const { sha256, generateSalt, hashWithSalt } = require('./hash');
const { constantTimeEqual } = require('./compare');

const OTP_LENGTH = 6;
const OTP_MIN = 0;
const OTP_MAX = 999999;

/**
 * Genera un OTP numérico de 6 dígitos.
 * Retorna string de exactamente 6 chars (con padding de ceros).
 */
function generateOTP() {
  const n = crypto.randomInt(OTP_MIN, OTP_MAX + 1);
  return String(n).padStart(OTP_LENGTH, '0');
}

/**
 * Hashea un OTP con una sal aleatoria.
 * Retorna { hash, salt } para guardar en BD.
 */
function hashOTP(otp) {
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    throw new Error('hashOTP: OTP debe ser string de 6 dígitos');
  }
  const salt = generateSalt();
  const hash = hashWithSalt(otp, salt);
  return { hash, salt };
}

/**
 * Verifica un OTP contra un hash + sal almacenados.
 * Usa constantTimeEqual para evitar timing attacks.
 *
 * Retorna { valid, attempts } donde:
 * - valid: true si el OTP coincide
 * - attempts: nuevo contador (incrementado)
 */
function verifyOTP(providedOTP, storedHash, storedSalt, currentAttempts) {
  // Validar formato
  if (typeof providedOTP !== 'string' || !/^\d{6}$/.test(providedOTP)) {
    return { valid: false, attempts: currentAttempts + 1 };
  }
  if (typeof storedHash !== 'string' || typeof storedSalt !== 'string') {
    return { valid: false, attempts: currentAttempts + 1 };
  }

  // Calcular hash del OTP proporcionado
  const computedHash = hashWithSalt(providedOTP, storedSalt);

  // Comparación en tiempo constante
  const valid = constantTimeEqual(computedHash, storedHash);

  return {
    valid,
    attempts: currentAttempts + 1,
  };
}

/**
 * Verifica si los intentos excedieron el máximo.
 */
function isLocked(attempts, maxAttempts) {
  return attempts >= maxAttempts;
}

/**
 * Verifica si el OTP expiró.
 *
 * Acepta tanto formato ISO 8601 (e.g. "2026-08-26T13:42:14.486Z") como
 * formato SQLite "YYYY-MM-DD HH:MM:SS" (e.g. "2026-08-26 12:42:14").
 *
 * NOTA sobre el formato SQLite: SQLite NO almacena timezone, y el driver
 * better-sqlite3 retorna los TEXT columns TAL CUAL están en la BD. Si la
 * BD tiene "2026-08-26 12:42:14" (formato SQLite), `Date.parse` lo
 * interpreta como hora LOCAL (no UTC), lo que produce un bug sutil cuando
 * el servidor está en una zona horaria distinta de UTC. Para evitarlo,
 * normalizamos el formato SQLite a ISO 8601 con timezone UTC antes de
 * hacer `Date.parse`.
 *
 * Si el string ya parece ISO 8601 (contiene 'T' o termina en 'Z' o tiene
 * un offset ±HH:MM), lo dejamos pasar tal cual.
 */
function isExpired(sentAt, ttlSeconds, now) {
  if (!sentAt) return true;
  let normalized = sentAt;
  if (typeof sentAt === 'string' &&
      !sentAt.includes('T') &&  // no es ISO 8601 con T
      !sentAt.endsWith('Z') &&   // no es UTC explícito
      !/[+-]\d{2}:?\d{2}$/.test(sentAt)) {  // no tiene offset
    // Formato SQLite "YYYY-MM-DD HH:MM:SS" → interpretamos como UTC
    // (es la convención del proyecto: BD almacena UTC, generado con
    // `datetime('now')` que es UTC en SQLite). Lo convertimos a ISO 8601
    // con Z para que `Date.parse` lo trate como UTC.
    normalized = sentAt.replace(' ', 'T') + 'Z';
  }
  const nowMs = (now || Date.now());
  const sentMs = typeof normalized === 'string' ? Date.parse(normalized) : normalized;
  if (Number.isNaN(sentMs)) return true;
  return (nowMs - sentMs) > (ttlSeconds * 1000);
}

module.exports = {
  generateOTP,
  hashOTP,
  verifyOTP,
  isLocked,
  isExpired,
  OTP_LENGTH,
};
