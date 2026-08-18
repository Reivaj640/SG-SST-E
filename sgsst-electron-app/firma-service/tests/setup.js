/**
 * Setup global de tests — se ejecuta ANTES de cualquier test.
 *
 * Se carga con --require ./tests/setup.js (definido en package.json).
 *
 * Responsabilidades:
 *   1. Forzar NODE_ENV=test.
 *   2. Apuntar DB_PATH y PDF_STORAGE_PATH a archivos de tests.
 *   3. Lanzar error si por algun motivo la ruta resuelve a la BD de desarrollo.
 *
 * dotenv (cargado por src/config.js) NO sobrescribe variables ya
 * existentes en process.env, por lo que este setup gana sobre el .env.
 */
'use strict';

const path = require('path');
const fs = require('fs');

const SERVICE_ROOT = path.resolve(__dirname, '..');

// Rutas criticas
const DEV_DB_PATH = path.resolve(SERVICE_ROOT, 'data', 'firma.sqlite');
const TEST_DB_PATH = path.resolve(SERVICE_ROOT, 'data', 'test.sqlite');
const TEST_PDF_PATH = path.resolve(SERVICE_ROOT, 'storage-test', 'pdfs');

// 1. Forzar NODE_ENV=test
if (process.env.NODE_ENV !== 'test') {
  process.env.NODE_ENV = 'test';
}

// 2. Si NO hay DB_PATH en env, apuntar a la TEST DB por defecto.
//    (Si hay uno seteado, lo respetamos y validamos abajo.)
if (!process.env.DB_PATH) {
  process.env.DB_PATH = TEST_DB_PATH;
}
if (!process.env.PDF_STORAGE_PATH) {
  process.env.PDF_STORAGE_PATH = TEST_PDF_PATH;
}

// 3. BARRERA: si la BD efectiva resuelve a la DEV DB, BLOQUEAR.
//    No hay override: la barrera siempre se activa. Si necesitas
//    correr tests contra la BD de desarrollo (deberia ser muy raro),
//    comenta este check temporalmente y documenta el motivo en el commit.
const currentDbPath = path.resolve(SERVICE_ROOT, process.env.DB_PATH);
if (currentDbPath === DEV_DB_PATH) {
  throw new Error(
    '[TEST SAFETY] Tests cannot run against the development database.\n' +
    '  Current DB_PATH resolves to: ' + currentDbPath + '\n' +
    '  Development DB is at:        ' + DEV_DB_PATH + '\n' +
    '  Set DB_PATH to a different file (e.g. ' + TEST_DB_PATH + ')\n' +
    '  This check has NO override for safety. Do not disable it lightly.'
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
