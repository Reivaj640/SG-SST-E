/**
 * Tests de la Migración 005: reducción del CHECK de estado 16 → 14.
 *
 * Esta migración aplica el patrón 12-step de SQLite (recreate-table) para
 * eliminar 'DOCUMENT_OPENED' y 'MANIFESTATION_RECORDED' del CHECK constraint
 * de gh_firmas_electronicas.estado.
 *
 * Los tests usan una BD en memoria (`:memory:`) para verificar el
 * comportamiento de la migración sin afectar la BD de tests ni la de
 * desarrollo. La BD de tests real ya tiene la migración aplicada por
 * setup.js.
 *
 * Ejecutar: node --test tests/migration-005.test.js
 * O:        npm test (incluye este archivo)
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SCHEMA_DIR = path.resolve(__dirname, '..', 'src', 'db', 'schema');
const MIGRATION_005_PATH = path.join(SCHEMA_DIR, '005_reduce_check.sql');

function readSchema(name) {
  return fs.readFileSync(path.join(SCHEMA_DIR, name), 'utf8');
}

/**
 * Parsea los estados del CHECK constraint de un CREATE TABLE.
 * Devuelve array de strings.
 */
function extractCheckStates(sql) {
  const m = sql.match(/CHECK\s*\(\s*estado\s+IN\s*\(([\s\S]*?)\)\s*\)/i);
  if (!m) return null;
  return m[1].split(',').map(s => s.trim().replace(/^'/, '').replace(/'$/, ''));
}

function freshDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return db;
}

function applyMigrationsUpTo(db, upTo) {
  const all = ['001_initial.sql', '002_agreement_version.sql', '003_id_constancia.sql', '004_consent_id.sql', '005_reduce_check.sql'];
  for (const m of all) {
    if (m.replace('.sql', '') > upTo) break;
    db.exec(readSchema(m));
  }
}

function insertSignRequest(db, { id, estado, version_kair = '0.1.189' }) {
  db.prepare(`
    INSERT INTO gh_firmas_electronicas (
      id_solicitud, id_documento, id_trabajador, id_empresa, tipo_firma,
      estado, document_hash_original, agreement_hash, token_hash,
      fecha_creacion, fecha_expiracion, version_kair
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `SOL-${id}`, `DOC-${id}`, `TRAB-${id}`, '900123456', 'remoto',
    estado, `hash-${id}`, `ahash-${id}`, `token-${id}`,
    '2026-08-19', '2026-09-19', version_kair
  );
}

// =============================================================================
// SECTION: el schema pre-migración tiene 16 estados
// =============================================================================

test('pre-migración: schema 001-004 tiene 16 estados en CHECK', () => {
  const db = freshDb();
  applyMigrationsUpTo(db, '004_consent_id');

  const sql = db.prepare(`
    SELECT sql FROM sqlite_master WHERE type='table' AND name='gh_firmas_electronicas'
  `).get();
  const states = extractCheckStates(sql.sql);

  assert.equal(states.length, 16, 'CHECK debe tener 16 estados antes de la migración');
  assert.ok(states.includes('DOCUMENT_OPENED'));
  assert.ok(states.includes('MANIFESTATION_RECORDED'));

  db.close();
});

// =============================================================================
// SECTION: la migración 005 cambia el CHECK a 14 estados
// =============================================================================

test('migración 005: reduce CHECK de 16 → 14 estados', () => {
  const db = freshDb();
  applyMigrationsUpTo(db, '004_consent_id');

  // El runner (migrate.js) setea foreign_keys=OFF fuera de la transacción
  // porque PRAGMA foreign_keys es no-op dentro de tx. Aquí replicamos eso.
  db.pragma('foreign_keys = OFF');
  const tx = db.transaction(() => {
    db.exec(readSchema('005_reduce_check.sql'));
  });
  tx();
  db.pragma('foreign_keys = ON');

  const sql = db.prepare(`
    SELECT sql FROM sqlite_master WHERE type='table' AND name='gh_firmas_electronicas'
  `).get();
  const states = extractCheckStates(sql.sql);

  assert.equal(states.length, 14, 'CHECK debe tener 14 estados después de la migración');
  assert.ok(!states.includes('DOCUMENT_OPENED'), 'DOCUMENT_OPENED debe estar removido');
  assert.ok(!states.includes('MANIFESTATION_RECORDED'), 'MANIFESTATION_RECORDED debe estar removido');

  // Los 14 estados que se mantienen
  for (const expected of [
    'PENDING', 'OPENED', 'IDENTIFICATION_STARTED', 'IDENTIFIED',
    'OTP_SENT', 'OTP_VERIFIED', 'DOCUMENT_VIEWED',
    'SIGNED', 'REJECTED', 'EXPIRED',
    'REVOKED', 'CANCELLED', 'OTP_LOCKED', 'IDENTIFICATION_FAILED',
  ]) {
    assert.ok(states.includes(expected), `${expected} debe estar presente en el CHECK`);
  }

  db.close();
});

// =============================================================================
// SECTION: la migración preserva los datos existentes
// =============================================================================

test('migración 005: preserva filas existentes (PENDING, SIGNED, REJECTED)', () => {
  const db = freshDb();
  applyMigrationsUpTo(db, '004_consent_id');

  insertSignRequest(db, { id: '1', estado: 'PENDING' });
  insertSignRequest(db, { id: '2', estado: 'SIGNED' });
  insertSignRequest(db, { id: '3', estado: 'REJECTED' });

  db.pragma('foreign_keys = OFF');
  const tx = db.transaction(() => {
    db.exec(readSchema('005_reduce_check.sql'));
  });
  tx();
  db.pragma('foreign_keys = ON');

  const rows = db.prepare(`
    SELECT id_solicitud, estado FROM gh_firmas_electronicas ORDER BY id_solicitud
  `).all();

  assert.equal(rows.length, 3);
  assert.equal(rows.find(r => r.id_solicitud === 'SOL-1').estado, 'PENDING');
  assert.equal(rows.find(r => r.id_solicitud === 'SOL-2').estado, 'SIGNED');
  assert.equal(rows.find(r => r.id_solicitud === 'SOL-3').estado, 'REJECTED');

  // AUTOINCREMENT preservado
  const maxId = db.prepare('SELECT MAX(id) as m FROM gh_firmas_electronicas').get();
  assert.equal(maxId.m, 3, 'AUTOINCREMENT debe continuar desde max(id)');

  db.close();
});

// =============================================================================
// SECTION: el CHECK post-migración rechaza los estados eliminados
// =============================================================================

test('migración 005: INSERT con DOCUMENT_OPENED es rechazado', () => {
  const db = freshDb();
  applyMigrationsUpTo(db, '005_reduce_check');

  assert.throws(
    () => insertSignRequest(db, { id: 'X', estado: 'DOCUMENT_OPENED' }),
    /CHECK constraint/i,
    'CHECK debe rechazar DOCUMENT_OPENED'
  );

  db.close();
});

test('migración 005: INSERT con MANIFESTATION_RECORDED es rechazado', () => {
  const db = freshDb();
  applyMigrationsUpTo(db, '005_reduce_check');

  assert.throws(
    () => insertSignRequest(db, { id: 'Y', estado: 'MANIFESTATION_RECORDED' }),
    /CHECK constraint/i,
    'CHECK debe rechazar MANIFESTATION_RECORDED'
  );

  db.close();
});

test('migración 005: INSERT con estados válidos (PENDING, SIGNED, OPENED) funciona', () => {
  const db = freshDb();
  applyMigrationsUpTo(db, '005_reduce_check');

  insertSignRequest(db, { id: 'A', estado: 'PENDING' });
  insertSignRequest(db, { id: 'B', estado: 'OPENED' });
  insertSignRequest(db, { id: 'C', estado: 'SIGNED' });

  const n = db.prepare('SELECT COUNT(*) as n FROM gh_firmas_electronicas').get().n;
  assert.equal(n, 3);

  db.close();
});

// =============================================================================
// SECTION: la migración recrea todos los índices
// =============================================================================

test('migración 005: recrea los 7 índices explícitos + 2 auto-index', () => {
  const db = freshDb();
  applyMigrationsUpTo(db, '004_consent_id');
  db.pragma('foreign_keys = OFF');
  const tx = db.transaction(() => {
    db.exec(readSchema('005_reduce_check.sql'));
  });
  tx();
  db.pragma('foreign_keys = ON');

  const idx = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='index' AND tbl_name='gh_firmas_electronicas'
    ORDER BY name
  `).all().map(r => r.name);

  for (const expected of [
    'idx_firmas_agreement_version',
    'idx_firmas_consent_id',
    'idx_firmas_documento',
    'idx_firmas_empresa_estado_fecha',
    'idx_firmas_id_constancia_unica',
    'idx_firmas_token_hash',
    'idx_firmas_trabajador',
    'sqlite_autoindex_gh_firmas_electronicas_1', // id_solicitud UNIQUE
    'sqlite_autoindex_gh_firmas_electronicas_2', // token_hash UNIQUE
  ]) {
    assert.ok(idx.includes(expected), `Índice ${expected} debe existir después de la migración`);
  }
  assert.equal(idx.length, 9, 'Debe haber 9 índices en total');

  db.close();
});

// =============================================================================
// SECTION: la migración es segura — rechaza correr si hay filas en estados eliminados
// =============================================================================

test('migración 005: REFUSA correr si hay filas en DOCUMENT_OPENED', () => {
  const db = freshDb();
  applyMigrationsUpTo(db, '004_consent_id');
  insertSignRequest(db, { id: 'DANGEROUS', estado: 'DOCUMENT_OPENED' });

  db.pragma('foreign_keys = OFF');
  const tx = db.transaction(() => {
    db.exec(readSchema('005_reduce_check.sql'));
  });
  assert.throws(() => tx(), /CHECK constraint/i);
  db.pragma('foreign_keys = ON');

  // La fila original debe estar intacta (ROLLBACK funcionó)
  const rows = db.prepare('SELECT * FROM gh_firmas_electronicas').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].estado, 'DOCUMENT_OPENED');

  db.close();
});

// =============================================================================
// SECTION: foreign_keys se reactivan al final
// =============================================================================

test('migración 005: foreign_keys queda en ON al final', () => {
  const db = freshDb();
  applyMigrationsUpTo(db, '004_consent_id');

  // La migración desactiva FKs durante la operación, pero las reactiva al final
  db.pragma('foreign_keys = OFF');
  const tx = db.transaction(() => {
    db.exec(readSchema('005_reduce_check.sql'));
  });
  tx();
  db.pragma('foreign_keys = ON');

  const fk = db.pragma('foreign_keys', { simple: true });
  assert.equal(fk, 1, 'foreign_keys debe estar en ON después de la migración');

  db.close();
});
