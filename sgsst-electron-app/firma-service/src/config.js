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

// Resuelve paths relativos al directorio del Servicio (firma-service/),
// no al CWD. Esto evita que la BD se cree en paths incorrectos cuando
// el CWD cambia (ej. cuando se ejecuta desde otro directorio o vía npm).
const SERVICE_ROOT = path.resolve(__dirname, '..');
function resolvePath(p) {
  if (path.isAbsolute(p)) return p;
  return path.resolve(SERVICE_ROOT, p);
}

const config = {
  env: required('NODE_ENV', 'development'),
  port: int('PORT', 3001),
  publicUrl: required('PUBLIC_URL', 'http://localhost:3001'),

  // P1-6: trust proxy para Express. Por seguridad NO usar 'true' (bypass de
  // X-Forwarded-For). Default seguro 'loopback' (solo 127.0.0.1, ::1).
  // En producción detrás de nginx/cloudflare, setear TRUST_PROXY=<ip-proxy>
  // o TRUST_PROXY=1 (último hop).
  // Ver src/middleware/rateLimit.js (líneas 19-25) y SECURITY.md.
  trustProxy: process.env.TRUST_PROXY || 'loopback',

  db: {
    path: resolvePath(required('DB_PATH', './data/firma.sqlite')),
  },

  auth: {
    internalApiKey: required('INTERNAL_API_KEY'),
    // adminApiKey: independiente de internalApiKey. K+AIR NO debe tener
    // esta key. Se usa solo para /internal/admin/* (publicar/gestionar
    // versiones del Acuerdo de uso, operación humana).
    adminApiKey: required('ADMIN_API_KEY'),
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
    signRequestPerMinute: int('RATE_LIMIT_SIGN_REQUEST_PER_MINUTE', 30),
    resendOtpPerHour: int('RATE_LIMIT_RESEND_OTP_PER_HOUR', 5),
  },

  email: {
    retryDelaysMin: required('EMAIL_RETRY_DELAYS_MIN', '5,30,120')
      .split(',').map(s => parseInt(s.trim(), 10)).filter(n => !Number.isNaN(n)),
    retryMaxAttempts: int('EMAIL_RETRY_MAX_ATTEMPTS', 3),
  },

  storage: {
    pdfPath: resolvePath(required('PDF_STORAGE_PATH', './storage/pdfs')),
  },

  // I-012.1: limites para validacion estructural de PDFs subidos por K+AIR
  // al endpoint POST /v1/internal/sign-requests. Es un parser estructural,
  // NO un sandbox/AV: un PDF "valido" solo significa "parsea como PDF".
  pdf: {
    maxBytes: int('PDF_MAX_BYTES', 52428800),            // 50 MB
    maxPages: int('PDF_MAX_PAGES', 200),
    parseTimeoutMs: int('PDF_PARSE_TIMEOUT_MS', 5000),
    maxMetadataBytes: int('PDF_MAX_METADATA_BYTES', 1048576),  // 1 MB
  },
};

// Advertencia si INTERNAL_API_KEY es el valor por defecto
if (config.env === 'production' &&
    config.auth.internalApiKey.startsWith('cambiar-')) {
  throw new Error('INTERNAL_API_KEY debe cambiarse en producción');
}

// Advertencia si ADMIN_API_KEY es el valor por defecto
if (config.env === 'production' &&
    config.auth.adminApiKey.startsWith('cambiar-')) {
  throw new Error('ADMIN_API_KEY debe cambiarse en producción');
}

module.exports = config;
