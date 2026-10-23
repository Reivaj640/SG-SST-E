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
  // Interfaz de escucha. Default loopback a proposito: sin esto, app.listen()
  // sin host cae en 0.0.0.0 y el servicio queda alcanzable desde toda la red
  // local (celulares, portatiles, Smart TV). El tunel de Cloudflare se conecta
  // a 127.0.0.1, asi que loopback no estorba. Poner HOST=0.0.0.0 solo si el
  // despliegue lo exige a proposito y hay firewall delante.
  host: process.env.HOST || '127.0.0.1',
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

  // Canal de incidentes de seguridad de K+AIR (Gesstiar S.A.S.).
  //
  // El 5.1(c) del Acuerdo de uso obliga al Firmante a "avisar de inmediato a
  // la Empresa y a K+AIR" cualquier situación que comprometa la seguridad de
  // sus datos de creación de la firma (el OTP y el enlace de firma).
  //
  // La mini-app muestra los canales de la EMPRESA (canal_pqrs,
  // canal_incidentes), que son datos del cliente. Sin este canal de K+AIR el
  // deber del 5.1(c) no sería cumplible: el Firmante no tendría a quién
  // avisarle. Por eso va en la configuración y no enterrado en el código.
  //
  // El valor por defecto es el mismo que publica el Anexo de Encargo de
  // Tratamiento de Datos Personales (§9, datos de contacto del Encargado).
  canalIncidentes: required('FIRMA_CANAL_INCIDENCIAS', 'adminkair@gmail.com'),

  // Canal de PROTECCIÓN DE DATOS de K+AIR (el 10.7(b) del Acuerdo).
  //
  // Es DISTINTO del canal de incidentes (el 5.1(c)): uno es para avisar que
  // se comprometieron los datos de creación de la firma; el otro es para
  // ejercer los derechos del Titular. Un solo canal con dos nombres es un
  // punto ciego con otro nombre.
  //
  // K+AIR es el Encargado: NO resuelve las solicitudes (eso es de la
  // Empresa, que es la Responsable), pero las recibe, las registra, las
  // trasmite y da constancia. Ver el 10.7(b) y el 2.2.2.25.4.4.
  //
  // ⚠️ Antes de publicar la v1.1, este buzón tiene que existir y estar
  // monitoreado: es la dirección que el Titular va a usar.
  canalProteccionDatos: required('FIRMA_CANAL_PROTECCION_DATOS', 'privacidad.kair@gmail.com'),

  // El plazo de trasmisión a la Empresa, en días HÁBILES. Lo define la
  // política, no el código: si el abogado pone otro número, se cambia acá.
  //
  // El 2 días hábiles es por simetría con el art. 15.1 de la Ley 1581
  // (traslado a quien corresponda: dos días hábiles).
  plazoTramiteDias: int('FIRMA_PLAZO_TRAMITE_DIAS', 2),

  // El plazo de ENTREGA de la copia permanente (el 8.5), en días HÁBILES.
  //
  // Son DOS relojes distintos y no se deben mezclar:
  //
  //   - plazoTramiteDias (2)  = cuándo K+AIR trasmite la solicitud a la
  //     Empresa. Es un deber del Encargado (10.7(b)).
  //   - plazoCopiaDias (5)    = cuándo la EMPRESA debe entregar la copia
  //     permanente. Es un deber de la Responsable (8.5).
  //
  // El 8.5 (texto final aprobado por el abogado): "La Empresa la entrega por
  // el medio autorizado, sin costo, dentro de los cinco (5) días hábiles
  // siguientes."
  //
  // Lo define la política, no el código: si el abogado pone otro número, se
  // cambia la variable de entorno, no el código.
  plazoCopiaDias: int('FIRMA_PLAZO_COPIA_DIAS', 5),

  // D-2: el OTP (dato de creación de la firma) tiene que ir a un medio
  // PERSONAL del Trabajador, no a un buzón que la Empresa pueda leer.
  //
  // **APAGADO por defecto.** Se enciende cuando exista la 9A (la firma en
  // papel): sin esa salida, exigir un medio personal sería una barrera de
  // acceso al empleo (el 2.2.1.1.11). Mientras esté apagado, los casos en
  // los que el OTP cae en un buzón corporativo quedan en el log como WARN
  // (código OTP_MEDIO_CORPORATIVO): de ahí sale el número del inventario.
  exigirMedioPersonalOtp:
    process.env.FIRMA_EXIGIR_MEDIO_PERSONAL_OTP === 'true',
  // (fin de la configuracion de canales y plazos)

  rateLimit: {
    perMinute: int('RATE_LIMIT_PER_MINUTE', 60),
    otpPerHour: int('RATE_LIMIT_OTP_PER_HOUR', 10),
    commitPerMinute: int('RATE_LIMIT_COMMIT_PER_MINUTE', 3),
    signRequestPerMinute: int('RATE_LIMIT_SIGN_REQUEST_PER_MINUTE', 30),
    resendOtpPerHour: int('RATE_LIMIT_RESEND_OTP_PER_HOUR', 5),
  },

  // D-03: la Empresa tiene que estar HABILITADA para pedir firmas.
  //
  // El 1.4 del Acuerdo dice que la relación Empresa-K+AIR se rige por el
  // Anexo de Encargo (art. 25 del Decreto 1377 / 2.2.2.25.5.2), y el 8.6
  // obliga a la Empresa a comunicar el plazo de conservación ANTES de pedir
  // la firma. Sin Anexo firmado ni plazo declarado, esas dos promesas no
  // se pueden cumplir: por eso la creación de la solicitud se bloquea con
  // un 409 que dice qué falta y dónde se resuelve.
  //
  // EL BLOQUEO ES INCONDICIONAL (decisión B.3 del abogado, 23-oct-2026).
  //
  // Antes existía la bandera `FIRMA_EXIGIR_HABILITACION_EMPRESA`: con ella en
  // 'false', la firma pasaba y solo quedaba un WARN. Se RETIRÓ porque era
  // exactamente lo que el abogado no quiere: "La excepción debe ser un flag
  // auditable, no un if silencioso". Un interruptor de entorno no deja rastro
  // de quién lo apagó ni de a quién dejó firmar sin Anexo.
  //
  // La única salida del bloqueo es la EXCEPCIÓN auditable
  // (src/services/excepcionHabilitacion.js): autorización escrita, alcance de
  // firmas, ruta en papel operativa, plazo cierto (máximo 30 días) y bitácora
  // inmutable. Para usarla: POST /internal/admin/excepciones-habilitacion.
  //
  // OJO: el bloqueo solo aplica a las empresas REGISTRADAS en
  // `gh_firma_empresas`. Una empresa que no está dada de alta es otro
  // problema (identificación incompleta) y se atiende aparte.

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
