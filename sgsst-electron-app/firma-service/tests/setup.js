/**
 * Setup global de tests — se ejecuta ANTES de cualquier test.
 *
 * Se carga con --require ./tests/setup.js (definido en package.json).
 *
 * Responsabilidades:
 *   1. Forzar NODE_ENV=test.
 *   2. Forzar DB_PATH a data/test.sqlite (NUNCA a firma.sqlite).
 *   3. Forzar PDF_STORAGE_PATH a storage-test/pdfs.
 *   4. Lanzar error si por algun motivo la ruta resuelve a la BD de produccion.
 *
 * IMPORTANTE: DB_PATH se asigna SIEMPRE (incondicionalmente) para
 * garantizar que tests NUNCA corran contra la BD de produccion.
 * El guard `if (!process.env.DB_PATH)` era la causa del bug: si
 * DB_PATH ya estaba seteado (via .env, shell, o npm config), el
 * guard lo respetaba y los tests corrian contra firma.sqlite.
 */
'use strict';

const path = require('path');
const fs = require('fs');

const SERVICE_ROOT = path.resolve(__dirname, '..');

// Rutas criticas — SIEMPRE las mismas para tests
const DEV_DB_PATH = path.resolve(SERVICE_ROOT, 'data', 'firma.sqlite');
const TEST_DB_PATH = path.resolve(SERVICE_ROOT, 'data', 'test.sqlite');
const TEST_PDF_PATH = path.resolve(SERVICE_ROOT, 'storage-test', 'pdfs');

// 1. Forzar NODE_ENV=test (SIEMPRE, sin condicion)
process.env.NODE_ENV = 'test';

// 2. Forzar DB_PATH a la BD de tests (SIEMPRE, sin condicion).
//    NUNCA usar `if (!process.env.DB_PATH)` — si DB_PATH ya viene
//    seteado de .env o del shell, el guard lo respetaba y los tests
//    corrían contra firma.sqlite (producción). Esto causó la pérdida
//    de datos de SIGN-2026-037663.
process.env.DB_PATH = TEST_DB_PATH;
process.env.PDF_STORAGE_PATH = TEST_PDF_PATH;

// 2b. API keys para tests (Bloque A: internal, Bloque B: admin).
//     tests/helpers.js los reescribirá con valores específicos, pero
//     necesitamos que estén seteados ANTES de que config.js los lea
//     en su `required()`.
if (!process.env.INTERNAL_API_KEY) {
  process.env.INTERNAL_API_KEY = 'test-setup-internal-key';
}
if (!process.env.ADMIN_API_KEY) {
  process.env.ADMIN_API_KEY = 'test-setup-admin-key';
}
// 2c. SMTP placeholders (no se usan en tests, pero config.js los requiere).
if (!process.env.SMTP_HOST) {
  process.env.SMTP_HOST = 'localhost';
}
if (!process.env.SMTP_USER) {
  process.env.SMTP_USER = 'test@example.com';
}
if (!process.env.SMTP_PASS) {
  process.env.SMTP_PASS = 'test-pass';
}
if (!process.env.SMTP_FROM_EMAIL) {
  process.env.SMTP_FROM_EMAIL = 'no-reply@example.com';
}
// 2d. Llave maestra de la capa cripto.
//
// TODO el servicio deriva sus claves (HMAC de identificación, de OTP, de
// token, de seudónimo del trabajador) con HKDF desde esta variable. En
// tests tiene que ser FIJA: si cambia entre procesos, los seudónimos ya
// calculados dejan de coincidir y las búsquedas por id_trabajador — que es
// la llave de unión del sistema — fallarían de forma confusa.
//
// En producción la variable es obligatoria y NO se puede rotar sin invalidar
// los tokens cifrados y los seudónimos calculados.
if (!process.env.TOKEN_ENCRYPTION_KEY) {
  process.env.TOKEN_ENCRYPTION_KEY = '4a1f0c9d8e7b6a5f4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0';
}

// 3. BARRERA POST-ASIGNACION: verificar que DB_PATH realmente resuelve
//    a la BD de tests y NUNCA a la de produccion.
const resolvedDbPath = path.resolve(SERVICE_ROOT, process.env.DB_PATH);
if (resolvedDbPath !== TEST_DB_PATH) {
  throw new Error(
    '[TEST SAFETY] DB_PATH does not resolve to the test database.\n' +
    '  Expected:  ' + TEST_DB_PATH + '\n' +
    '  Resolved:  ' + resolvedDbPath + '\n' +
    '  This should never happen. Check setup.js or env configuration.'
  );
}
if (resolvedDbPath === DEV_DB_PATH) {
  throw new Error(
    '[TEST SAFETY] Tests cannot run against the production database.\n' +
    '  DB_PATH resolves to: ' + resolvedDbPath + '\n' +
    '  Production DB is at:  ' + DEV_DB_PATH + '\n' +
    '  This is a safety violation. Tests MUST use data/test.sqlite.'
  );
}

// 4. Crear directorios necesarios (no existen en el repo todavia)
fs.mkdirSync(path.dirname(process.env.DB_PATH), { recursive: true });
fs.mkdirSync(path.join(process.env.PDF_STORAGE_PATH, 'originales'), { recursive: true });
fs.mkdirSync(path.join(process.env.PDF_STORAGE_PATH, 'firmados'), { recursive: true });
fs.mkdirSync(path.join(process.env.PDF_STORAGE_PATH, 'constancias'), { recursive: true });

// 5. Aplicar migraciones en la BD de tests (idempotente).
//    Como dotenv NO sobrescribe variables existentes, los requires
//    que importemos a continuacion (config.js, connection.js, migrate.js)
//    veran las env vars de tests que acabamos de setear.
try {
  const { migrate } = require('../src/db/migrate');
  migrate();
} catch (e) {
  throw new Error(
    '[TEST SAFETY] No se pudieron aplicar las migraciones en la BD de tests.\n' +
    '  DB: ' + process.env.DB_PATH + '\n' +
    '  Error: ' + e.message
  );
}

// 6. Log informativo (solo si hay stderr; no afecta tests)
if (process.env.KAIR_TEST_VERBOSE === '1') {
  process.stderr.write(
    '[tests/setup] DB: ' + process.env.DB_PATH + '\n' +
    '[tests/setup] Storage: ' + process.env.PDF_STORAGE_PATH + '\n' +
    '[tests/setup] BD de tests inicializada con esquema.\n'
  );
}

// =============================================================================
// 7. EL ARNÉS HABLA EL IDIOMA DE LOS PROGRAMAS
// =============================================================================
//
// La superficie pública (`/s/*`, `/api/sign/*`) sirve el error como PÁGINA
// HTML cuando el cliente no pide JSON. Es lo correcto para el firmante que
// reabre el enlace en el navegador, y es una trampa para cualquier otro
// cliente: `curl` y `fetch` mandan `Accept: */*` por defecto, y se llevarían
// una página donde esperaban un sobre JSON.
//
// Por eso las pruebas, que son programas, declaran que quieren JSON: sin
// esto, una prueba que afirma `res.body.error.code` no está probando el
// contrato que ve el integrador, está probando que un objeto vacío no tiene
// la propiedad — y falla por el motivo equivocado.
//
// 47 pruebas fallaban exactamente por esto (ver la entrada 📦909 del
// Historial.md). El default va aquí, en un solo lugar, y no en 47 `.set()`
// dispersos que se olvidan.
//
// Los tests que necesitan la página HTML (la negociación de contenido) mandan
// su propio `Accept` explícito, que pisa este default.
(function patchSupertestDefaultAccept() {
  let stPath;
  try {
    stPath = require.resolve('supertest');
  } catch (e) {
    return; // sin supertest instalado: no hay nada que parchear
  }
  const st = require(stPath);
  const METODOS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

  function envolver(app) {
    const t = st(app);
    return new Proxy(t, {
      get(target, prop) {
        if (METODOS.includes(prop) && typeof target[prop] === 'function') {
          return (...args) => target[prop](...args).set('Accept', 'application/json');
        }
        if (prop === 'agent' && typeof target[prop] === 'function') {
          return (...args) => envolver(target[prop](...args));
        }
        const v = target[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
  }

  require.cache[stPath].exports = envolver;
})();
