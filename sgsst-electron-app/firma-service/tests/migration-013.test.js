/**
 * Tests de la migración 013: firma dual (I-FIRMA-DUAL · v0.1.180).
 *
 * Verifica:
 * - El archivo 013_firma_dual.sql existe y contiene la estructura esperada
 *   (4 ALTER TABLE, 3 índices, índice único parcial sobre parent_id_solicitud).
 * - La migración aplica sin romper sign requests legacy (compatibilidad 100%
 *   con v0.1.179): las 4 columnas nuevas tienen los defaults correctos.
 * - Un INSERT con solo las columnas legacy funciona y respeta los defaults
 *   nuevos (requiere_firma_empresa=0, tipo_firmante='TRABAJADOR',
 *   parent_id_solicitud=NULL).
 * - El índice único parcial idx_gh_firmas_unico_hijo bloquea un 2do hijo
 *   para el mismo padre.
 * - El índice único parcial NO aplica cuando parent_id_solicitud IS NULL
 *   (múltiples padres son permitidos).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', 'src', 'db', 'schema');
const MIGRATION_013_PATH = path.join(SCHEMA_DIR, '013_firma_dual.sql');

// Lista de migraciones aplicadas en orden (001..013). Reutilizada por los
// tests que necesitan el schema completo en una BD en memoria.
const MIGRATION_FILES = [
  '001_initial.sql', '002_agreement_version.sql', '003_id_constancia.sql',
  '004_consent_id.sql', '005_reduce_check.sql', '006_cedula_sal.sql',
  '007_tipo_identificacion.sql', '008_idempotency_keys.sql',
  '009_internal_clients.sql', '010_consent_expire.sql',
  '011_consent_partial_unique.sql', '012_drop_consent_otp_not_null.sql',
  '013_firma_dual.sql',
];

function applyAllMigrations(db) {
  for (const filename of MIGRATION_FILES) {
    const sql = fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8');
    db.exec(sql);
  }
}

test('I-FIRMA-DUAL: archivo 013_firma_dual.sql existe y tiene estructura esperada', () => {
  assert.ok(fs.existsSync(MIGRATION_013_PATH),
    'debe existir src/db/schema/013_firma_dual.sql');
  const sql = fs.readFileSync(MIGRATION_013_PATH, 'utf8');

  // 4 ALTER TABLE (uno por cada columna nueva).
  const alterMatches = sql.match(/ALTER TABLE gh_firmas_electronicas/g) || [];
  assert.equal(alterMatches.length, 4,
    'debe haber 4 ALTER TABLE gh_firmas_electronicas (uno por columna nueva)');

  // 3 índices: idx_gh_firmas_parent, idx_gh_firmas_tipo_firmante, idx_gh_firmas_unico_hijo
  assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS idx_gh_firmas_parent'),
    'debe crear el índice idx_gh_firmas_parent');
  assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS idx_gh_firmas_tipo_firmante'),
    'debe crear el índice idx_gh_firmas_tipo_firmante');
  assert.ok(sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_gh_firmas_unico_hijo'),
    'debe crear el índice UNIQUE idx_gh_firmas_unico_hijo');

  // El índice único debe ser parcial: WHERE parent_id_solicitud IS NOT NULL
  assert.ok(sql.includes('WHERE parent_id_solicitud IS NOT NULL'),
    'el índice único debe ser parcial WHERE parent_id_solicitud IS NOT NULL');
});

test('I-FIRMA-DUAL: migración 013 aplica y las 4 columnas nuevas tienen los defaults correctos', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  applyAllMigrations(db);

  const cols = db.prepare('PRAGMA table_info(gh_firmas_electronicas)').all();
  const byName = Object.fromEntries(cols.map(c => [c.name, c]));

  // Las 4 columnas nuevas deben existir
  assert.ok(byName['requiere_firma_empresa'],
    'la columna requiere_firma_empresa debe existir');
  assert.ok(byName['tipo_firmante'],
    'la columna tipo_firmante debe existir');
  assert.ok(byName['parent_id_solicitud'],
    'la columna parent_id_solicitud debe existir');
  assert.ok(byName['representante_legal_snapshot'],
    'la columna representante_legal_snapshot debe existir');

  // Defaults correctos (compatibilidad 100% con v0.1.179)
  assert.equal(byName['requiere_firma_empresa'].dflt_value, '0',
    'requiere_firma_empresa debe tener default 0 (compatibilidad legacy)');
  assert.equal(byName['tipo_firmante'].dflt_value, "'TRABAJADOR'",
    "tipo_firmante debe tener default 'TRABAJADOR'");
  assert.equal(byName['parent_id_solicitud'].dflt_value, null,
    'parent_id_solicitud debe tener default NULL');
  assert.equal(byName['representante_legal_snapshot'].dflt_value, null,
    'representante_legal_snapshot debe tener default NULL');

  // Los índices deben existir en sqlite_master
  const idxNames = ['idx_gh_firmas_parent', 'idx_gh_firmas_tipo_firmante', 'idx_gh_firmas_unico_hijo'];
  for (const idxName of idxNames) {
    const idx = db.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type='index' AND name=?"
    ).get(idxName);
    assert.ok(idx, `el índice ${idxName} debe existir`);
  }

  // El índice único parcial debe tener el WHERE correcto
  const uniqueIdx = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_gh_firmas_unico_hijo'"
  ).get();
  assert.ok(uniqueIdx.sql.includes('WHERE parent_id_solicitud IS NOT NULL'),
    'idx_gh_firmas_unico_hijo debe tener WHERE parent_id_solicitud IS NOT NULL');

  db.close();
});

test('I-FIRMA-DUAL: INSERT legacy (sin campos nuevos) respeta defaults', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  applyAllMigrations(db);

  // INSERT mínimo: solo columnas legacy, SIN pasar requiere_firma_empresa,
  // tipo_firmante, parent_id_solicitud ni representante_legal_snapshot.
  // Esto valida compatibilidad 100% con v0.1.179.
  const legacyInsert = db.prepare(`
    INSERT INTO gh_firmas_electronicas
      (id_solicitud, id_documento, id_trabajador, id_empresa,
       tipo_firma, estado, document_hash_original, agreement_hash,
       token_hash, fecha_creacion, fecha_expiracion, version_kair)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  assert.doesNotThrow(
    () => legacyInsert.run(
      'SIGN-LEGACY-013', 'doc-013', 't-013', 'e-013',
      'presencial', 'PENDING', 'h-doc', 'h-agr',
      'tok-013', "datetime('now')", "datetime('now', '+1 day')", '0.1.180-test'
    ),
    'INSERT legacy (sin columnas nuevas) debe funcionar'
  );

  // Verificar defaults aplicados
  const row = db.prepare(
    "SELECT requiere_firma_empresa, tipo_firmante, parent_id_solicitud, representante_legal_snapshot FROM gh_firmas_electronicas WHERE id_solicitud = 'SIGN-LEGACY-013'"
  ).get();
  assert.equal(row.requiere_firma_empresa, 0,
    'sign request legacy debe tener requiere_firma_empresa = 0');
  assert.equal(row.tipo_firmante, 'TRABAJADOR',
    "sign request legacy debe tener tipo_firmante = 'TRABAJADOR'");
  assert.equal(row.parent_id_solicitud, null,
    'sign request legacy debe tener parent_id_solicitud = NULL');
  assert.equal(row.representante_legal_snapshot, null,
    'sign request legacy debe tener representante_legal_snapshot = NULL');

  db.close();
});

test('I-FIRMA-DUAL: UNIQUE index bloquea 2do hijo del mismo padre', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  applyAllMigrations(db);

  // Insertar un padre (parent) con requiere_firma_empresa=1
  const insertPadre = db.prepare(`
    INSERT INTO gh_firmas_electronicas
      (id_solicitud, id_documento, id_trabajador, id_empresa,
       tipo_firma, estado, document_hash_original, agreement_hash,
       token_hash, fecha_creacion, fecha_expiracion, version_kair,
       requiere_firma_empresa, tipo_firmante)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPadre.run(
    'SIGN-PADRE-013', 'doc-p', 't-p', 'e-p',
    'presencial', 'PENDING', 'h-doc-p', 'h-agr-p',
    'tok-p', "datetime('now')", "datetime('now', '+1 day')", '0.1.180-test',
    1, 'TRABAJADOR'
  );

  // Insertar el 1er hijo (parent_id_solicitud = id_solicitud del padre).
  // tipo_firmante='REPRESENTANTE_LEGAL' lo distingue como hijo.
  const insertHijo = db.prepare(`
    INSERT INTO gh_firmas_electronicas
      (id_solicitud, id_documento, id_trabajador, id_empresa,
       tipo_firma, estado, document_hash_original, agreement_hash,
       token_hash, fecha_creacion, fecha_expiracion, version_kair,
       requiere_firma_empresa, tipo_firmante, parent_id_solicitud)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  assert.doesNotThrow(
    () => insertHijo.run(
      'SIGN-HIJO-013-1', 'doc-h1', 't-h1', 'e-h1',
      'presencial', 'PENDING', 'h-doc-h1', 'h-agr-h1',
      'tok-h1', "datetime('now')", "datetime('now', '+1 day')", '0.1.180-test',
      0, 'REPRESENTANTE_LEGAL', 'SIGN-PADRE-013'
    ),
    'el 1er hijo del padre debe poder insertarse'
  );

  // Intentar insertar un 2do hijo con el mismo parent_id_solicitud.
  // Debe FALLAR con UNIQUE constraint failed.
  assert.throws(
    () => insertHijo.run(
      'SIGN-HIJO-013-2', 'doc-h2', 't-h2', 'e-h2',
      'presencial', 'PENDING', 'h-doc-h2', 'h-agr-h2',
      'tok-h2', "datetime('now')", "datetime('now', '+1 day')", '0.1.180-test',
      0, 'REPRESENTANTE_LEGAL', 'SIGN-PADRE-013'
    ),
    /UNIQUE constraint failed/,
    'un 2do hijo con el mismo parent_id_solicitud debe ser rechazado por UNIQUE'
  );

  // Verificar que solo hay 1 hijo en BD
  const hijosCount = db.prepare(
    "SELECT COUNT(*) AS c FROM gh_firmas_electronicas WHERE parent_id_solicitud = 'SIGN-PADRE-013'"
  ).get().c;
  assert.equal(hijosCount, 1, 'solo debe haber 1 hijo del padre en BD');

  db.close();
});

test('I-FIRMA-DUAL: UNIQUE index NO aplica cuando parent_id_solicitud IS NULL', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  applyAllMigrations(db);

  // Insertar 2 sign requests como padres (parent_id_solicitud = NULL por default).
  // El índice parcial solo aplica cuando parent_id_solicitud IS NOT NULL,
  // por lo que múltiples padres deben poder coexistir.
  const insertPadre = db.prepare(`
    INSERT INTO gh_firmas_electronicas
      (id_solicitud, id_documento, id_trabajador, id_empresa,
       tipo_firma, estado, document_hash_original, agreement_hash,
       token_hash, fecha_creacion, fecha_expiracion, version_kair)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  assert.doesNotThrow(
    () => insertPadre.run(
      'SIGN-PADRE-013-A', 'doc-a', 't-a', 'e-a',
      'presencial', 'PENDING', 'h-a', 'h-agr-a',
      'tok-a', "datetime('now')", "datetime('now', '+1 day')", '0.1.180-test'
    ),
    '1er padre (parent_id_solicitud NULL) debe poder insertarse'
  );
  assert.doesNotThrow(
    () => insertPadre.run(
      'SIGN-PADRE-013-B', 'doc-b', 't-b', 'e-b',
      'presencial', 'PENDING', 'h-b', 'h-agr-b',
      'tok-b', "datetime('now')", "datetime('now', '+1 day')", '0.1.180-test'
    ),
    '2do padre (parent_id_solicitud NULL) debe poder insertarse (índice parcial)'
  );

  // Verificar que ambos están en BD
  const count = db.prepare(
    "SELECT COUNT(*) AS c FROM gh_firmas_electronicas WHERE parent_id_solicitud IS NULL"
  ).get().c;
  assert.equal(count, 2, 'deben haber 2 padres (parent_id_solicitud NULL)');

  db.close();
});
