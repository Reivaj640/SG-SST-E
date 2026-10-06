/**
 * Logger JSON estructurado.
 *
 * - Formato: una línea JSON por log.
 * - Redacción automática de campos sensibles (PII):
 *   - Por nombre de clave (SENSITIVE_KEYS)
 *   - Por valor (regex de cédulas colombianas, correos, celulares)
 * - Niveles: debug, info, warn, error.
 *
 * P1-5 (2026-08-19): se amplió SENSITIVE_KEYS con `id_trabajador`,
 * `id_documento`, `id_empresa`, `motivo`, `motivo_rechazo`, etc.
 * Se agregó redacción por valor (regex) para capturar PII embebida en
 * strings de campos no listados.
 *
 * Ver docs/firma-electronica/SECURITY.md §3 (PII en logs).
 */
'use strict';

const config = require('../config');

// Campos cuyo VALOR (no nombre) se redacta completamente.
const SENSITIVE_KEYS = new Set([
  'token', 'otp', 'password', 'api_key', 'internal_api_key',
  'correo', 'email', 'cedula', 'documento', 'numero_documento',
  'correo_verificacion', 'correo_destino',
  'authorization', 'x-internal-api-key',
  // P1-5: campos PII que no deben aparecer en logs.
  'id_trabajador',     // ES la cédula por convención del proyecto.
  'id_documento',      // puede ser cédula u otro ID personal.
  'id_empresa',        // NIT (dato empresarial, pero PII bajo Ley 1581).
  'motivo', 'motivo_rechazo', 'motivo_revocacion', 'motivo_texto',
]);

// Patrones regex para redactar PII embebida en strings (cualquier campo).
// Aplican al VALOR, no al nombre. Defensivos contra:
//   - PII que el dev agregó en un campo nuevo sin actualizar SENSITIVE_KEYS.
//   - PII en `error.message` de librerías externas (nodemailer, etc.).
//
// ORDEN IMPORTANTE: de más específico a más general.
//   - Celular (10 dígitos empieza con 3) PRIMERO: si fuera después, la cédula
//     lo capturaría como [CEDULA] (10 dígitos matchean también).
//   - Cédula AL FINAL: captura todo lo demás.
const PII_PATTERNS = [
  // Email: cualquier cosa @ algo . algo.
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, mask: '[EMAIL]' },
  // Celular colombiano: 3XXXXXXXXX (10 dígitos, empieza con 3).
  { regex: /\b3\d{9}\b/g, mask: '[CELULAR]' },
  // Cédula colombiana: 6-10 dígitos, word boundary.
  // (Va al final porque es el más general; si va antes, captura el celular también.)
  { regex: /\b\d{6,10}\b/g, mask: '[CEDULA]' },
];

function redactValue(value) {
  if (typeof value !== 'string') return value;
  let result = value;
  for (const { regex, mask } of PII_PATTERNS) {
    result = result.replace(regex, mask);
  }
  return result;
}

function redact(key, value) {
  if (SENSITIVE_KEYS.has(String(key).toLowerCase())) {
    return '[REDACTED]';
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const out = {};
    for (const k of Object.keys(value)) {
      out[k] = redact(k, value[k]);
    }
    return out;
  }
  // PII por valor (cédula, email, celular embebidos en strings).
  return redactValue(value);
}

function log(level, message, meta) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    env: config.env,
    ...redact('meta', meta || {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

module.exports = {
  debug: (msg, meta) => log('debug', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  // Exportados para tests.
  _redact: redact,
  _redactValue: redactValue,
  _SENSITIVE_KEYS: SENSITIVE_KEYS,
  _PII_PATTERNS: PII_PATTERNS,
};
