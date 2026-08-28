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
