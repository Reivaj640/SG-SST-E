/**
 * Tests de la migración 014: extender CHECK constraint de
 * gh_firmas_electronicas.estado para incluir 'DUAL_FIRMADO'
 * (I-FIRMA-DUAL).
 *
 * Verifica:
 * - La migración aplica sin romper sign requests legacy.
 * - El CHECK constraint acepta 'DUAL_FIRMADO' como estado válido.
 * - Las 4 columnas nuevas de 013 siguen presentes con sus defaults.
 * - Los índices de 013 (parent, tipo_firmante, unico_hijo) siguen existiendo.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SCHEMA_DIR = path.join(__dirname, '..', 'src', 'db', 'schema');
const MIGRATION_014_PATH = path.join(SCHEMA_DIR, '014_doble_firma_estado.sql');

/**
 * Aplica todas las migraciones del proyecto en orden (001 → 014).
 * Helper para los tests que necesitan el schema completo.
 */
function applyAllMigrations(db) {
  const files = [
    '001_initial.sql', '002_agreement_version.sql', '003_id_constancia.sql',
    '004_consent_id.sql', '005_reduce_check.sql', '006_cedula_sal.sql',
    '007_tipo_identificacion.sql', '008_idempotency_keys.sql',
    '009_internal_clients.sql', '010_consent_expire.sql',
    '011_consent_partial_unique.sql', '012_drop_consent_otp_not_null.sql',
    '013_firma_dual.sql', '014_doble_firma_estado.sql',
  ];
  for (const filename of files) {
    const sql = fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8');
    db.exec(sql);
  }
}

test('I-FIRMA-DUAL: archivo 014_doble_firma_estado.sql existe', () => {
  assert.ok(fs.existsSync(MIGRATION_014_PATH),
    'debe existir src/db/schema/014_doble_firma_estado.sql');
  const sql = fs.readFileSync(MIGRATION_014_PATH, 'utf8');
  assert.ok(sql.includes("'DUAL_FIRMADO'"),
    'el CHECK constraint debe incluir DUAL_FIRMADO');
  assert.ok(sql.includes('gh_firmas_electronicas_new'),
    'debe usar el patrón 12-step (tabla _new + DROP + RENAME)');
});

test('I-FIRMA-DUAL: migración 014 permite estado DUAL_FIRMADO', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  applyAllMigrations(db);

  // Insertar un sign request válido
  db.prepare(`
    INSERT INTO gh_firmas_electronicas
    (id_solicitud, id_documento, id_empresa, id_trabajador, agreement_version,
     agreement_hash, document_hash_original, pdf_original_path,
     fecha_creacion, fecha_expiracion, estado, tipo_firma, version_kair, verification_channel, token_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('SIGN-DUAL-1', 'doc-1', 'emp-1', 'trab-1', 'v1.0',
    'a'.repeat(64), 'b'.repeat(64), '/tmp/test.pdf',
    new Date().toISOString(), new Date(Date.now() + 86400000).toISOString(),
    'PENDING', 'remoto', '0.1.180-test', 'email', 'c'.repeat(64));

  // UPDATE a DUAL_FIRMADO (este era el bug que rompía Task 1.11)
  assert.doesNotThrow(() => {
    db.prepare("UPDATE gh_firmas_electronicas SET estado = 'DUAL_FIRMADO' WHERE id_solicitud = ?")
      .run('SIGN-DUAL-1');
  }, 'el UPDATE a DUAL_FIRMADO NO debe lanzar CHECK constraint violation');

  // Verificar que quedó persistido
  const row = db.prepare("SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?")
    .get('SIGN-DUAL-1');
  assert.equal(row.estado, 'DUAL_FIRMADO');

  db.close();
});

test('I-FIRMA-DUAL: migración 014 preserva las 4 columnas de 013 con sus defaults', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  applyAllMigrations(db);

  // Insertar sign request sin pasar las 4 columnas nuevas
  db.prepare(`
    INSERT INTO gh_firmas_electronicas
    (id_solicitud, id_documento, id_empresa, id_trabajador, agreement_version,
     agreement_hash, document_hash_original, pdf_original_path,
     fecha_creacion, fecha_expiracion, estado, tipo_firma, version_kair, verification_channel, token_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('SIGN-LEGACY-1', 'doc-2', 'emp-1', 'trab-1', 'v1.0',
    'a'.repeat(64), 'b'.repeat(64), '/tmp/test.pdf',
    new Date().toISOString(), new Date(Date.now() + 86400000).toISOString(),
    'PENDING', 'remoto', '0.1.180-test', 'email', 'd'.repeat(64));

  const row = db.prepare(
    "SELECT requiere_firma_empresa, tipo_firmante, parent_id_solicitud, representante_legal_snapshot " +
    "FROM gh_firmas_electronicas WHERE id_solicitud = ?"
  ).get('SIGN-LEGACY-1');

  assert.equal(row.requiere_firma_empresa, 0, 'requiere_firma_empresa default = 0');
  assert.equal(row.tipo_firmante, 'TRABAJADOR', 'tipo_firmante default = TRABAJADOR');
  assert.equal(row.parent_id_solicitud, null, 'parent_id_solicitud default = NULL');
  assert.equal(row.representante_legal_snapshot, null, 'representante_legal_snapshot default = NULL');

  db.close();
});

test('I-FIRMA-DUAL: migración 014 preserva los 3 índices de 013', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  applyAllMigrations(db);

  const indexes = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='gh_firmas_electronicas'"
  ).all().map(r => r.name);

  assert.ok(indexes.includes('idx_gh_firmas_parent'),
    'debe existir índice idx_gh_firmas_parent');
  assert.ok(indexes.includes('idx_gh_firmas_tipo_firmante'),
    'debe existir índice idx_gh_firmas_tipo_firmante');
  assert.ok(indexes.includes('idx_gh_firmas_unico_hijo'),
    'debe existir índice UNIQUE idx_gh_firmas_unico_hijo');

  db.close();
});

test('I-FIRMA-DUAL: migración 014 NO acepta estados inválidos', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  applyAllMigrations(db);

  db.prepare(`
    INSERT INTO gh_firmas_electronicas
    (id_solicitud, id_documento, id_empresa, id_trabajador, agreement_version,
     agreement_hash, document_hash_original, pdf_original_path,
     fecha_creacion, fecha_expiracion, estado, tipo_firma, version_kair, verification_channel, token_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('SIGN-INVALID-1', 'doc-3', 'emp-1', 'trab-1', 'v1.0',
    'a'.repeat(64), 'b'.repeat(64), '/tmp/test.pdf',
    new Date().toISOString(), new Date(Date.now() + 86400000).toISOString(),
    'PENDING', 'remoto', '0.1.180-test', 'email', 'e'.repeat(64));

  // Intentar un estado inválido
  assert.throws(() => {
    db.prepare("UPDATE gh_firmas_electronicas SET estado = 'ESTADO_INVENTADO' WHERE id_solicitud = ?")
      .run('SIGN-INVALID-1');
  }, /CHECK constraint failed/);

  db.close();
});
