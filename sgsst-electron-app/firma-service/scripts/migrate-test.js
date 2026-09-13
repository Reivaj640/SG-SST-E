#!/usr/bin/env node
/**
 * Pre-aplica las migraciones a la BD de tests (data/test.sqlite).
 *
 * Se invoca como `pretest` de npm: `npm test` → `pretest` → `test`.
 * Garantiza que la BD esté lista ANTES de que `node --test` arranque
 * sus procesos hijos (cada uno con su propio setup.js#migrate()).
 *
 * Por qué este script existe
 * --------------------------
 * Estado corrupto preexistente en data/test.sqlite:
 *   - En sesiones previas, la migración 005 (12-step) y 006 (ALTER TABLE)
 *     se aplicaron al schema de la tabla gh_firmas_electronicas (47 cols,
 *     CHECK de 14 estados), pero NO se registraron en
 *     gh_firma_schema_migrations.
 *   - Esto dejó la BD con schema post-006 pero migrations table mostrando
 *     solo 001-004.
 *   - Cuando migrate() corría, veía 005 y 006 como "pendientes" e intentaba
 *     reaplicarlas. La reaplicación de 005 (que crea una tabla `_new` con
 *     46 cols) fallaba al hacer INSERT SELECT * porque la tabla origen ya
 *     tenía 47 cols:
 *       "table gh_firmas_electronicas_new has 46 columns
 *        but 47 values were supplied"
 *
 * Decisión: REGENERAR la BD de tests desde cero en cada `npm test`.
 *   - Borra `data/test.sqlite*` (incluye `-wal` y `-shm`).
 *   - Llama `migrate()` que aplica las 6 migraciones en orden desde 001.
 *   - Esto garantiza que cada corrida parte de un estado limpio y
 *     conocido. No acumula drift entre sesiones.
 *
 * Idempotencia:
 *   - Borrar y recrear es trivialmente idempotente. Seguro de correr N veces.
 *
 * Side effect intencional (defensa en profundidad):
 *   - También se llama desde setup.js (migrate()). Si la BD ya está
 *     migrada (porque pretest corrió), migrate() ve schema_migrations
 *     lleno y se vuelve no-op. Sin race porque no hay escrituras.
 *
 * NO se modifica tests/setup.js en este commit porque:
 *   (a) Mezclar fix de infra de tests con un cambio funcional (P1-1)
 *       rompe la regla "un commit, un cambio".
 *   (b) El setup.js actual funciona como red de seguridad: si alguien
 *       corre los tests sin pretest, las migraciones se aplican igual
 *       (migrate() es idempotente si la BD está en estado conocido).
 *
 * Uso:
 *   npm test                                  # pretest + test (estándar)
 *   node scripts/migrate-test.js              # solo migrar (manual)
 */
'use strict';

const path = require('path');

// Paths absolutos desde SERVICE_ROOT (no del CWD)
const SERVICE_ROOT = path.resolve(__dirname, '..');
const TEST_DB_PATH = path.join(SERVICE_ROOT, 'data', 'test.sqlite');
const TEST_PDF_PATH = path.join(SERVICE_ROOT, 'storage-test', 'pdfs');

// Forzar env vars ANTES de requerir connection.js (que llama a config.js
// y este último tiene un `required()` que falla si faltan API keys).
process.env.NODE_ENV = 'test';
process.env.DB_PATH = TEST_DB_PATH;
process.env.PDF_STORAGE_PATH = TEST_PDF_PATH;

// API keys dummy — config.js las requiere. Su valor no se usa para
// autenticación en este script (no hay HTTP), pero deben estar
// definidas para que config.js cargue sin throw.
process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'pretend-migrate-internal-key';
process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'pretend-migrate-admin-key';
process.env.PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:3737';
process.env.SMTP_HOST = process.env.SMTP_HOST || 'localhost';
process.env.SMTP_PORT = process.env.SMTP_PORT || '587';
process.env.SMTP_USER = process.env.SMTP_USER || 'test@example.com';
process.env.SMTP_PASS = process.env.SMTP_PASS || 'test-pass';
process.env.SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || 'no-reply@example.com';

// Asegurar que los directorios existen (setup.js también lo hace, pero
// pretest puede correr en aislamiento).
const fs = require('fs');
fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });
fs.mkdirSync(path.join(TEST_PDF_PATH, 'originales'), { recursive: true });
fs.mkdirSync(path.join(TEST_PDF_PATH, 'firmados'), { recursive: true });
fs.mkdirSync(path.join(TEST_PDF_PATH, 'constancias'), { recursive: true });

// Barrera de seguridad: no migrar la BD de desarrollo por accidente.
const DEV_DB_PATH = path.join(SERVICE_ROOT, 'data', 'firma.sqlite');
if (path.resolve(TEST_DB_PATH) === path.resolve(DEV_DB_PATH)) {
  throw new Error(
    '[MIGRATE-TEST SAFETY] TEST_DB_PATH resuelve a la BD de desarrollo.\n' +
    '  TEST_DB_PATH:  ' + TEST_DB_PATH + '\n' +
    '  DEV_DB_PATH:   ' + DEV_DB_PATH + '\n' +
    '  Esto es un bug del script, no de tu config. Avísame.'
  );
}

// REGENERAR la BD de tests desde cero (ver comentario de cabecera).
// Borramos el archivo principal + sus archivos WAL/SHM. Después
// migrate() recreará el schema desde 001.
function safeUnlink(p) {
  try { fs.unlinkSync(p); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
safeUnlink(TEST_DB_PATH);
safeUnlink(TEST_DB_PATH + '-wal');
safeUnlink(TEST_DB_PATH + '-shm');
// eslint-disable-next-line no-console
console.log('[migrate-test] BD de tests regenerada (archivo anterior borrado)');

const { migrate } = require('../src/db/migrate');
migrate();

// eslint-disable-next-line no-console
console.log('[migrate-test] BD de tests lista en:', TEST_DB_PATH);
