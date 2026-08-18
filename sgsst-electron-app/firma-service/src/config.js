/**
 * Configuración central del Servicio de Firma.
 * Lee variables de entorno y valida al inicio.
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function required(key, fallback) {
  const v = process.env[key];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Variable de entorno requerida: ${key}`);
  }
  return v;
}

function int(key, fallback) {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Variable ${key} debe ser entero`);
  return n;
}

function bool(key, fallback) {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return v === 'true' || v === '1';
}

const config = {
  env: required('NODE_ENV', 'development'),
  port: int('PORT', 3001),
  publicUrl: required('PUBLIC_URL', 'http://localhost:3001'),

  db: {
    path: required('DB_PATH', './data/firma.sqlite'),
  },

  auth: {
    internalApiKey: required('INTERNAL_API_KEY'),
  },

  smtp: {
    host: required('SMTP_HOST'),
    port: int('SMTP_PORT', 587),
    secure: bool('SMTP_SECURE', false),
    user: required('SMTP_USER'),
    pass: required('SMTP_PASS'),
    fromName: required('SMTP_FROM_NAME', 'K+AIR'),
    fromEmail: required('SMTP_FROM_EMAIL'),
  },

  ttl: {
    otpSeconds: int('OTP_TTL_SECONDS', 600),
    otpMaxAttempts: int('OTP_MAX_ATTEMPTS', 5),
    tokenHoursRemote: int('TOKEN_TTL_HOURS_REMOTE', 72),
    tokenHoursPresencial: int('TOKEN_TTL_HOURS_PRESENCIAL', 24),
  },

  rateLimit: {
    perMinute: int('RATE_LIMIT_PER_MINUTE', 60),
    otpPerHour: int('RATE_LIMIT_OTP_PER_HOUR', 10),
    commitPerMinute: int('RATE_LIMIT_COMMIT_PER_MINUTE', 3),
  },

  email: {
    retryDelaysMin: required('EMAIL_RETRY_DELAYS_MIN', '5,30,120')
      .split(',').map(s => parseInt(s.trim(), 10)).filter(n => !Number.isNaN(n)),
    retryMaxAttempts: int('EMAIL_RETRY_MAX_ATTEMPTS', 3),
  },

  storage: {
    pdfPath: required('PDF_STORAGE_PATH', './storage/pdfs'),
  },
};

// Advertencia si INTERNAL_API_KEY es el valor por defecto
if (config.env === 'production' &&
    config.auth.internalApiKey.startsWith('cambiar-')) {
  throw new Error('INTERNAL_API_KEY debe cambiarse en producción');
}

module.exports = config;
