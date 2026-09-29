/**
 * Tests del script scripts/seed-dev-acuerdo.js (Bloque C).
 *
 * Estrategia: no capturamos stdout (el script usa console.log/error
 * directamente, no process.stdout.write). En su lugar, verificamos:
 *  - código de retorno de main()
 *  - estado de la BD (que es lo que importa)
 *
 * Cubre:
 * - parseArgs con cada opción
 * - Hard-block NODE_ENV=production
 * - Fixture no existe → error
 * - Fixture sin marca "ACUERDO DEV" o "NO LEGAL" → error
 * - Versión no existe + dry-run (default) → 0 escrituras
 * - Versión no existe + --yes → crea la versión
 * - Versión ya existe + --yes → idempotente (no duplica)
 * - getByVersion retorna la versión creada con activa=1
 * - Variables de entorno SEED_VERSION / SEED_FILE
 * - Constantes exportadas
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { resetDb } = require('../helpers');
const agreementService = require('../../src/services/agreement');
const db = require('../../src/db/connection');
const {
  main, parseArgs, DEFAULT_VERSION, DEFAULT_FIXTURE, MARCA_DEV, MARCA_NO_LEGAL,
} = require('../../scripts/seed-dev-acuerdo');

// Helper: ejecuta main silenciando console, retorna solo el código
function runSilent(args, envOverrides = {}) {
  const savedEnv = {};
  for (const k of Object.keys(envOverrides)) {
    savedEnv[k] = process.env[k];
    process.env[k] = envOverrides[k];
  }
  const origLog = console.log;
  const origErr = console.error;
  console.log = () => {};
  console.error = () => {};
  let code;
  try {
    code = main(['node', 'seed-dev-acuerdo.js', ...args]);
  } finally {
    console.log = origLog;
    console.error = origErr;
    for (const k of Object.keys(envOverrides)) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  }
  return code;
}

// =========================================================================
// parseArgs
// =========================================================================

test('parseArgs: defaults → yes=false, dryRun=true', () => {
  const args = parseArgs(['node', 'script.js']);
  assert.equal(args.yes, false);
  assert.equal(args.dryRun, true);
  assert.equal(args.version, null);
  assert.equal(args.file, null);
});

test('parseArgs: --yes → yes=true', () => {
  const args = parseArgs(['node', 'script.js', '--yes']);
  assert.equal(args.yes, true);
});

test('parseArgs: --no-dry-run → dryRun=false', () => {
  const args = parseArgs(['node', 'script.js', '--no-dry-run']);
  assert.equal(args.dryRun, false);
});

test('parseArgs: --version=v2.0 → version="v2.0"', () => {
  const args = parseArgs(['node', 'script.js', '--version=v2.0']);
  assert.equal(args.version, 'v2.0');
});

test('parseArgs: --file=/tmp/x.txt → file="/tmp/x.txt"', () => {
  const args = parseArgs(['node', 'script.js', '--file=/tmp/x.txt']);
  assert.equal(args.file, '/tmp/x.txt');
});

test('parseArgs: --version con valor que tiene "=" → mantiene el "="', () => {
  // Caso edge: si el valor tiene "=" no debe romperse
  const args = parseArgs(['node', 'script.js', '--version=v=1.0']);
  assert.equal(args.version, 'v=1.0');
});

// =========================================================================
// Hard-block producción
// =========================================================================

test('main: NODE_ENV=production → exit code 1 sin tocar BD', () => {
  resetDb();
  // config.js cachea config.env al hacer require(); para simular
  // producción mutamos el campo directamente y restauramos al final.
  const config = require('../../src/config');
  const originalEnv = config.env;
  config.env = 'production';
  try {
    const code = runSilent(['--yes']);
    assert.equal(code, 1);
  } finally {
    config.env = originalEnv;
  }
  const ac = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_acuerdo_versiones').get();
  assert.equal(ac.n, 0, 'No se debe crear versión en producción');
});

// =========================================================================
// Validaciones de fixture
// =========================================================================

test('main: fixture no existe → exit code 1', () => {
  resetDb();
  const code = runSilent(['--yes', '--file=/path/que/no/existe.txt']);
  assert.equal(code, 1);
});

test('main: fixture sin marca "ACUERDO DEV" → exit code 1', () => {
  resetDb();
  const tmpFile = path.join(__dirname, '..', '..', 'tmp-no-marca.txt');
  fs.writeFileSync(tmpFile, 'Texto sin marca de Acuerdo DEV');
  try {
    const code = runSilent(['--yes', `--file=${tmpFile}`]);
    assert.equal(code, 1);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('main: fixture sin marca "NO LEGAL" → exit code 1', () => {
  resetDb();
  const tmpFile = path.join(__dirname, '..', '..', 'tmp-sin-no-legal.txt');
  // Texto que SÍ tiene "ACUERDO DEV" pero NO tiene "NO LEGAL" como substring continuo
  fs.writeFileSync(tmpFile, 'Texto con ACUERDO DEV pero no contiene la marca prohibida');
  try {
    const code = runSilent(['--yes', `--file=${tmpFile}`]);
    assert.equal(code, 1);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('main: fixture con ambas marcas → acepta', () => {
  resetDb();
  const tmpFile = path.join(__dirname, '..', '..', 'tmp-fixture-ok.txt');
  fs.writeFileSync(tmpFile, 'Texto con ACUERDO DEV y NO LEGAL válido');
  try {
    const code = runSilent(['--yes', '--no-dry-run', `--file=${tmpFile}`, '--version=v9.0']);
    assert.equal(code, 0, 'Con ambas marcas debe pasar la validación');
    const row = db.prepare('SELECT version FROM gh_firma_acuerdo_versiones WHERE version = ?').get('v9.0');
    assert.ok(row);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// =========================================================================
// Dry-run (default)
// =========================================================================

test('main: dry-run (sin --yes) → 0 escrituras', () => {
  resetDb();
  const code = runSilent([]);
  assert.equal(code, 0, 'dry-run retorna 0');
  const ac = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_acuerdo_versiones').get();
  assert.equal(ac.n, 0, 'dry-run NO debe escribir');
});

test('main: dry-run pero versión ya existe → retorna 0 sin tocar', () => {
  resetDb();
  // Sembrar primero
  runSilent(['--yes']);
  const before = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_acuerdo_versiones').get().n;
  // Volver a correr sin --yes (dry-run)
  const code = runSilent([]);
  assert.equal(code, 0);
  const after = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_acuerdo_versiones').get().n;
  assert.equal(after, before, 'No debe duplicar en dry-run');
});

// =========================================================================
// Crear versión (con --yes)
// =========================================================================

test('main: --yes con BD limpia → crea v1.0 activa', () => {
  resetDb();
  const code = runSilent(['--yes']);
  assert.equal(code, 0);
  const row = db.prepare('SELECT version, activa, creado_por FROM gh_firma_acuerdo_versiones WHERE version = ?').get('v1.0');
  assert.ok(row);
  assert.equal(row.activa, 1);
  assert.equal(row.creado_por, 'rh:seed-dev-acuerdo');
});

test('main: --yes con --version=v2.0 → crea v2.0', () => {
  resetDb();
  const code = runSilent(['--yes', '--version=v2.0']);
  assert.equal(code, 0);
  const row = db.prepare('SELECT version, activa FROM gh_firma_acuerdo_versiones WHERE version = ?').get('v2.0');
  assert.ok(row);
  assert.equal(row.activa, 1);
});

test('main: --no-dry-run sin --yes → exit code 2 (requiere --yes)', () => {
  resetDb();
  const code = runSilent(['--no-dry-run']);
  assert.equal(code, 2);
  const ac = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_acuerdo_versiones').get();
  assert.equal(ac.n, 0);
});

test('main: --yes y --no-dry-run juntos → escribe', () => {
  resetDb();
  const code = runSilent(['--yes', '--no-dry-run']);
  assert.equal(code, 0);
  const ac = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_acuerdo_versiones').get();
  assert.equal(ac.n, 1);
});

// =========================================================================
// Idempotencia
// =========================================================================

test('main: --yes dos veces seguidas → idempotente, no duplica', () => {
  resetDb();
  const r1 = runSilent(['--yes']);
  assert.equal(r1, 0);

  const r2 = runSilent(['--yes']);
  assert.equal(r2, 0);

  const ac = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_acuerdo_versiones').get();
  assert.equal(ac.n, 1, 'No se debe duplicar la versión');
});

test('main: idempotente preserva el Acuerdo creado originalmente', () => {
  resetDb();
  runSilent(['--yes']);
  const original = db.prepare('SELECT texto_hash, fecha_creacion FROM gh_firma_acuerdo_versiones WHERE version = ?').get('v1.0');

  runSilent(['--yes']);

  const despues = db.prepare('SELECT texto_hash, fecha_creacion FROM gh_firma_acuerdo_versiones WHERE version = ?').get('v1.0');
  assert.equal(despues.texto_hash, original.texto_hash);
  assert.equal(despues.fecha_creacion, original.fecha_creacion);
});

// =========================================================================
// Integración con agreementService
// =========================================================================

test('main: Acuerdo creado es visible vía agreementService.getActive()', () => {
  resetDb();
  runSilent(['--yes']);
  const ac = agreementService.getActive();
  assert.ok(ac);
  assert.equal(ac.version, 'v1.0');
  assert.equal(ac.activa, 1);
});

test('main: Acuerdo creado es visible vía agreementService.getByVersion()', () => {
  resetDb();
  runSilent(['--yes']);
  const ac = agreementService.getByVersion('v1.0');
  assert.ok(ac);
  assert.equal(ac.creado_por, 'rh:seed-dev-acuerdo');
  assert.match(ac.texto_hash, /^[0-9a-f]{64}$/);
});

test('main: SEED_VERSION env var sobrescribe default', () => {
  resetDb();
  const code = runSilent(['--yes'], { SEED_VERSION: 'v3.0' });
  assert.equal(code, 0);
  const ac = db.prepare('SELECT version FROM gh_firma_acuerdo_versiones').get();
  assert.equal(ac.version, 'v3.0');
});

test('main: --version CLI tiene prioridad sobre SEED_VERSION', () => {
  resetDb();
  const code = runSilent(['--yes', '--version=v4.0'], { SEED_VERSION: 'v3.0' });
  assert.equal(code, 0);
  const rows = db.prepare('SELECT version FROM gh_firma_acuerdo_versiones').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].version, 'v4.0');
});

test('main: Acuerdo sembrado tiene texto_hash de 64 chars hex', () => {
  resetDb();
  runSilent(['--yes']);
  const ac = db.prepare('SELECT texto_hash FROM gh_firma_acuerdo_versiones WHERE version = ?').get('v1.0');
  assert.equal(ac.texto_hash.length, 64);
  assert.match(ac.texto_hash, /^[0-9a-f]{64}$/);
});

test('main: Acuerdo sembrado tiene metadata.source', () => {
  resetDb();
  runSilent(['--yes']);
  const ac = db.prepare('SELECT metadata FROM gh_firma_acuerdo_versiones WHERE version = ?').get('v1.0');
  const meta = JSON.parse(ac.metadata);
  assert.equal(meta.source, 'scripts/seed-dev-acuerdo.js');
});

// =========================================================================
// Constantes exportadas
// =========================================================================

test('main: constantes exportadas son correctas', () => {
  assert.equal(DEFAULT_VERSION, 'v1.0');
  assert.ok(DEFAULT_FIXTURE.endsWith('acuerdo-dev-v1.0.txt'));
  assert.equal(MARCA_DEV, 'ACUERDO DEV');
  assert.equal(MARCA_NO_LEGAL, 'NO LEGAL');
});
