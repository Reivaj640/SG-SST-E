/**
 * Tests de la migración 007: tipo_identificacion en sign requests (Bloque integración v1, D-1 + A1/A2).
 *
 * Verifica (per C-21, registry-first):
 *  - El archivo 007_tipo_identificacion.sql existe y contiene el ALTER + 2 índices.
 *  - La migración aplica sin romper sign requests legacy (sin tipo_identificacion).
 *  - La columna tipo_identificacion es TEXT nullable.
 *  - Los 2 índices existen (idx_firmas_tipo_identificacion + idx_firmas_empresa_tipo_estado).
 *  - Registry: gh_firma_schema_migrations tiene fila para 007.
 *  - **C-21**: re-aplicar migrate() (NO el SQL directo) NO duplica la fila en el registry.
 *
 * Decisión D-1: la palabra `tipo_documento` se reemplaza por `tipo_identificacion`
 * en todo el código y esquema.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', 'src', 'db', 'schema');
const MIGRATION_007_PATH = path.join(SCHEMA_DIR, '007_tipo_identificacion.sql');

test('A1/A2: archivo 007_tipo_identificacion.sql existe y contiene el ALTER + 2 índices', () => {
  assert.ok(fs.existsSync(MIGRATION_007_PATH), 'debe existir src/db/schema/007_tipo_identificacion.sql');
  const sql = fs.readFileSync(MIGRATION_007_PATH, 'utf8');
  // Columna nueva
  assert.ok(sql.includes('tipo_identificacion'), 'el SQL debe agregar la columna tipo_identificacion');
  assert.ok(sql.includes('ALTER TABLE gh_firmas_electronicas'),
    'debe ser un ALTER TABLE sobre gh_firmas_electronicas');
  // Sin constraint SQL (consistente con agreement_version, consent_id)
  assert.ok(!/\bCHECK\b/i.test(sql), 'no debe incluir constraint a nivel SQL (validación en zod)');
  // 2 índices
  assert.ok(sql.includes('idx_firmas_tipo_identificacion'),
    'debe crear el índice simple idx_firmas_tipo_identificacion');
  assert.ok(sql.includes('idx_firmas_empresa_tipo_estado'),
    'debe crear el índice compuesto idx_firmas_empresa_tipo_estado');
  assert.ok(sql.includes('id_empresa, tipo_identificacion, estado, fecha_creacion DESC'),
    'el índice compuesto debe usar tipo_identificacion (D-1)');
});

test('A1/A2: migración 007 aplica sobre BD con 6 migraciones previas (legacy intacto)', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  // Aplicar las 7 migraciones en orden
  const files = [
    '001_initial.sql',
    '002_agreement_version.sql',
    '003_id_constancia.sql',
    '004_consent_id.sql',
    '005_reduce_check.sql',
    '006_cedula_sal.sql',
    '007_tipo_identificacion.sql',
  ];
  for (const filename of files) {
    const sql = fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8');
    db.exec(sql);
  }

  // 1. Verificar la columna
  const cols = db.prepare("PRAGMA table_info(gh_firmas_electronicas)").all();
  const tipoCol = cols.find(c => c.name === 'tipo_identificacion');
  assert.ok(tipoCol, 'la columna tipo_identificacion debe existir');
  assert.equal(tipoCol.type, 'TEXT', 'tipo_identificacion debe ser TEXT');
  assert.equal(tipoCol.notnull, 0, 'tipo_identificacion debe ser nullable (sign requests legacy)');
  assert.equal(tipoCol.dflt_value, null, 'tipo_identificacion default NULL');

  // 2. Verificar que NO existe la columna `tipo_documento` (D-1: palabra eliminada)
  const tipoDocCol = cols.find(c => c.name === 'tipo_documento');
  assert.equal(tipoDocCol, undefined, 'la columna tipo_documento NO debe existir (D-1)');

  // 3. Verificar el índice simple
  const idxSimple = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='gh_firmas_electronicas' AND name='idx_firmas_tipo_identificacion'"
  ).get();
  assert.ok(idxSimple, 'el índice idx_firmas_tipo_identificacion debe existir');

  // 4. Verificar el índice compuesto
  const idxCompuesto = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='gh_firmas_electronicas' AND name='idx_firmas_empresa_tipo_estado'"
  ).get();
  assert.ok(idxCompuesto, 'el índice idx_firmas_empresa_tipo_estado debe existir');

  // 5. Verificar las columnas del índice compuesto en el orden correcto
  const idxInfo = db.prepare("PRAGMA index_info(idx_firmas_empresa_tipo_estado)").all();
  assert.equal(idxInfo.length, 4, 'el índice compuesto debe tener 4 columnas');
  assert.equal(idxInfo[0].name, 'id_empresa', 'columna 1 debe ser id_empresa');
  assert.equal(idxInfo[1].name, 'tipo_identificacion', 'columna 2 debe ser tipo_identificacion');
  assert.equal(idxInfo[2].name, 'estado', 'columna 3 debe ser estado');
  assert.equal(idxInfo[3].name, 'fecha_creacion', 'columna 4 debe ser fecha_creacion');

  // 6. Verificar que sign request legacy (sin tipo_identificacion) sigue funcionando
  db.prepare(`INSERT INTO gh_firma_acuerdo_versiones (version, texto, texto_hash, activa, fecha_creacion, fecha_vigencia_inicio, creado_por, kair_version) VALUES ('v1.0', 'X', 'h', 1, datetime('now'), datetime('now'), 't', '0.1.189-test')`).run();
  const legacyInsert = db.prepare(`INSERT INTO gh_firmas_electronicas (id_solicitud, id_documento, id_trabajador, id_empresa, tipo_firma, estado, document_hash_original, agreement_hash, agreement_version, token_hash, fecha_creacion, fecha_expiracion, version_kair) VALUES ('SIGN-LEGACY', 'd', 't', 'e', 'presencial', 'PENDING', 'h', 'h', 'v1.0', 'th', datetime('now'), datetime('now', '+1 day'), '0.1.189-test')`);
  try {
    legacyInsert.run();
  } catch (e) {
    throw new Error('legacy INSERT falló: ' + e.message);
  }
  const legacy = db.prepare("SELECT tipo_identificacion FROM gh_firmas_electronicas WHERE id_solicitud = 'SIGN-LEGACY'").get();
  assert.equal(legacy.tipo_identificacion, null, 'sign request legacy debe tener tipo_identificacion NULL');

  // 7. Verificar que sign request con tipo_identificacion válido se persiste
  db.prepare(`INSERT INTO gh_firmas_electronicas (id_solicitud, id_documento, id_trabajador, id_empresa, tipo_firma, estado, document_hash_original, agreement_hash, agreement_version, token_hash, fecha_creacion, fecha_expiracion, version_kair, tipo_identificacion) VALUES ('SIGN-CONTRATO', 'd', 't', 'e', 'presencial', 'PENDING', 'h', 'h', 'v1.0', 'th2', datetime('now'), datetime('now', '+1 day'), '0.1.189-test', 'CONTRATO')`).run();
  const nuevo = db.prepare("SELECT tipo_identificacion FROM gh_firmas_electronicas WHERE id_solicitud = 'SIGN-CONTRATO'").get();
  assert.equal(nuevo.tipo_identificacion, 'CONTRATO', 'sign request nuevo debe tener tipo_identificacion persistido');

  db.close();
});

test('C-21: registry-first — migrate() registra 007 y no duplica al re-aplicar', () => {
  // Usa la conexión real del firma-service (TEST_DB_PATH via setup.js).
  // Esto valida el REGISTRY (gh_firma_schema_migrations), no el SQL.
  const db = require('../src/db/connection');
  const { migrate } = require('../src/db/migrate');

  // 1. Verificar que la fila del registry para 007 existe
  //    (la creó el pretest al regenerar la BD de tests).
  const beforeRow = db.prepare(
    "SELECT version, applied_at, description FROM gh_firma_schema_migrations WHERE version = '007_tipo_identificacion'"
  ).get();
  assert.ok(beforeRow, 'gh_firma_schema_migrations debe tener fila para 007_tipo_identificacion');
  assert.ok(beforeRow.applied_at, 'la fila debe tener applied_at');
  assert.equal(beforeRow.description, 'Auto-aplicada de 007_tipo_identificacion.sql',
    'la descripción debe ser auto-generada');

  // 2. Contar filas antes
  const countBefore = db.prepare(
    "SELECT COUNT(*) AS c FROM gh_firma_schema_migrations WHERE version = '007_tipo_identificacion'"
  ).get().c;
  assert.equal(countBefore, 1, 'debe haber exactamente 1 fila para 007');

  // 3. Re-aplicar migrate() — NO debe re-aplicar 007 ni duplicar la fila
  //    (migrate.js consulta getAppliedMigrations() y salta las aplicadas).
  migrate();

  // 4. Contar filas después
  const countAfter = db.prepare(
    "SELECT COUNT(*) AS c FROM gh_firma_schema_migrations WHERE version = '007_tipo_identificacion'"
  ).get().c;
  assert.equal(countAfter, 1, 'migrate() no debe duplicar la fila del registry');

  // 5. Verificar que la columna sigue existiendo y funcional
  const cols = db.prepare("PRAGMA table_info(gh_firmas_electronicas)").all();
  const tipoCol = cols.find(c => c.name === 'tipo_identificacion');
  assert.ok(tipoCol, 'la columna tipo_identificacion debe seguir existiendo tras re-aplicar migrate()');

  // 6. Verificar que los índices siguen existiendo
  const idxCount = db.prepare(
    "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='index' AND tbl_name='gh_firmas_electronicas' AND name IN ('idx_firmas_tipo_identificacion', 'idx_firmas_empresa_tipo_estado')"
  ).get().c;
  assert.equal(idxCount, 2, 'los 2 índices deben seguir existiendo');
});
