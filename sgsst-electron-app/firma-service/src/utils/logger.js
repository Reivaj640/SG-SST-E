/**
 * Logger JSON estructurado.
 *
 * - Formato: una línea JSON por log.
 * - Redacción automática de campos sensibles (token, otp, password, etc.).
 * - Niveles: debug, info, warn, error.
 * - NO se loguean: tokens, OTPs, cédulas, correos (sin redacción).
 */
'use strict';

const config = require('../config');

const SENSITIVE_KEYS = new Set([
  'token', 'otp', 'password', 'api_key', 'internal_api_key',
  'correo', 'email', 'cedula', 'documento', 'numero_documento',
  'correo_verificacion', 'correo_destino',
  'authorization', 'x-internal-api-key',
]);

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
  return value;
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
};
