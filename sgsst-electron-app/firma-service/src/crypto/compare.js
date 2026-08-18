/**
 * Comparación segura (timing-safe) y helpers de canonización JSON.
 *
 * - constantTimeEqual: comparación que NO filtra información por timing.
 * - canonicalJSON: JSON canónico para que evidence_hash sea verificable
 *   por terceros (claves ordenadas alfabéticamente, sin espacios).
 *
 * Ver SECURITY.md §4.4 (ataque de timing al hash de OTP) y
 * DATA_MODEL.md §1.5.
 */
'use strict';

const crypto = require('crypto');

/**
 * Comparación en tiempo constante para strings de igual longitud.
 *
 * - Si los strings tienen diferente longitud, retorna false inmediatamente
 *   (esto sí filtra el largo, pero es información pública por el formato
 *   fijo de SHA-256 hex = 64 chars).
 * - Si tienen igual longitud, usa crypto.timingSafeEqual.
 *
 * IMPORTANTE: NO usar === para comparar hashes de OTP o tokens.
 */
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * JSON canónico:
 * - Claves ordenadas alfabéticamente en cada nivel.
 * - Sin espacios superfluos.
 * - null explícito.
 * - Encoding UTF-8.
 *
 * Se usa para calcular evidence_hash sobre metadata de la firma,
 * de modo que cualquier tercera parte pueda recalcular el hash
 * y verificar la integridad.
 */
function canonicalJSON(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJSON).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k =>
    JSON.stringify(k) + ':' + canonicalJSON(value[k])
  ).join(',') + '}';
}

module.exports = {
  constantTimeEqual,
  canonicalJSON,
};
