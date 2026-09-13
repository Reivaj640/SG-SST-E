/**
 * Tests de la migración 008: gh_idempotency_keys (I-003 idempotency).
 *
 * Verifica (per C-21, registry-first):
 *  - El archivo 008_idempotency_keys.sql existe y contiene CREATE TABLE + CHECK + índice.
 *  - La migración aplica sobre BD con 7 migraciones previas sin romper nada.
 *  - Las columnas esperadas existen con tipos correctos.
 *  - El CHECK constraint del status rechaza valores fuera de la whitelist.
 *  - El PK compuesta es (id_empresa, idempotency_key).
 *  - El índice idx_idempotency_expires existe.
 *  - Registry: gh_firma_schema_migrations tiene fila para 008.
 *  - **C-21**: re-aplicar migrate() NO duplica la fila en el registry.
 *  - **Idempotencia SQL**: re-aplicar el SQL puro (db.exec) no falla.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', 'src', 'db', 'schema');
const MIGRATION_008_PATH = path.join(SCHEMA_DIR, '008_idempotency_keys.sql');

test('I-003: archivo 008_idempotency_keys.sql existe y contiene CREATE TABLE + CHECK + índice', () => {
  assert.ok(fs.existsSync(MIGRATION_008_PATH),
    'debe existir src/db/schema/008_idempotency_keys.sql');
  const sql = fs.readFileSync(MIGRATION_008_PATH, 'utf8');

  // CREATE TABLE gh_idempotency_keys
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS gh_idempotency_keys'),
    'debe crear la tabla gh_idempotency_keys');

  // Columnas esperadas (per spec de I-003)
  assert.ok(sql.includes('id_empresa'), 'debe tener columna id_empresa');
  assert.ok(sql.includes('idempotency_key'), 'debe tener columna idempotency_key');
  assert.ok(sql.includes('request_fingerprint'), 'debe tener columna request_fingerprint');
  assert.ok(sql.includes('pdf_sha256'), 'debe tener columna pdf_sha256');
  assert.ok(sql.includes('status'), 'debe tener columna status');
  assert.ok(sql.includes('response_status'), 'debe tener columna response_status');
  assert.ok(sql.includes('response_body'), 'debe tener columna response_body');
  assert.ok(sql.includes('created_at'), 'debe tener columna created_at');
  assert.ok(sql.includes('expires_at'), 'debe tener columna expires_at');
  assert.ok(sql.includes('completed_at'), 'debe tener columna completed_at');

  // Restricciones
  assert.ok(sql.includes('PRIMARY KEY (id_empresa, idempotency_key)'),
    'la PRIMARY KEY debe ser compuesta (id_empresa, idempotency_key)');
  assert.ok(sql.includes("CHECK (status IN ('PENDING','COMPLETED','FAILED','TERMINAL'))"),
    'debe tener CHECK del status con la whitelist de 4 valores');

  // Default de expires_at: +24h
  assert.ok(sql.includes("'+24 hours'"),
    'expires_at debe tener default de +24 hours sobre now (TTL)');
  assert.ok(sql.includes('strftime'),
    'expires_at debe usar strftime para el default (formato ISO 8601 con T y Z)');

  // Índice sobre expires_at
  assert.ok(sql.includes('idx_idempotency_expires'),
    'debe crear el índice idx_idempotency_expires');
  assert.ok(sql.includes('ON gh_idempotency_keys(expires_at)'),
    'el índice debe estar sobre la columna expires_at de gh_idempotency_keys');
});

test('I-003: migración 008 aplica sobre BD con 7 migraciones previas (todo intacto)', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  // Aplicar las 8 migraciones en orden (007 → 008)
  const files = [
    '001_initial.sql',
    '002_agreement_version.sql',
    '003_id_constancia.sql',
    '004_consent_id.sql',
    '005_reduce_check.sql',
    '006_cedula_sal.sql',
    '007_tipo_identificacion.sql',
    '008_idempotency_keys.sql',
  ];
  for (const filename of files) {
    const sql = fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8');
    db.exec(sql);
  }

  // 1. Verificar que la tabla gh_idempotency_keys existe
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='gh_idempotency_keys'"
  ).get();
  assert.ok(tableExists, 'la tabla gh_idempotency_keys debe existir');

  // 2. Verificar que las tablas previas siguen intactas
  const expectedPrevTables = [
    'gh_firma_acuerdo_versiones',
    'gh_consentimientos_firma',
    'gh_firmas_electronicas',
    'gh_firma_eventos',
    'gh_firma_sesiones',
    'gh_firma_schema_migrations',
  ];
  for (const tbl of expectedPrevTables) {
    const t = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(tbl);
    assert.ok(t, `la tabla previa ${tbl} debe seguir existiendo`);
  }

  // 3. Verificar que la columna tipo_identificacion (007) sigue existiendo
  const sigReqCols = db.prepare("PRAGMA table_info(gh_firmas_electronicas)").all();
  const tipoCol = sigReqCols.find(c => c.name === 'tipo_identificacion');
  assert.ok(tipoCol, 'la columna tipo_identificacion de migración 007 debe seguir existiendo');
  assert.equal(tipoCol.type, 'TEXT', 'tipo_identificacion debe seguir siendo TEXT');
  assert.equal(tipoCol.notnull, 0, 'tipo_identificacion debe seguir siendo nullable');

  db.close();
});

test('I-003: columnas de gh_idempotency_keys con tipos correctos', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  const files = [
    '001_initial.sql',
    '002_agreement_version.sql',
    '003_id_constancia.sql',
    '004_consent_id.sql',
    '005_reduce_check.sql',
    '006_cedula_sal.sql',
    '007_tipo_identificacion.sql',
    '008_idempotency_keys.sql',
  ];
  for (const filename of files) {
    const sql = fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8');
    db.exec(sql);
  }

  const cols = db.prepare("PRAGMA table_info(gh_idempotency_keys)").all();
  const colByName = Object.fromEntries(cols.map(c => [c.name, c]));

  // Columnas NOT NULL
  const requiredNotNull = [
    'id_empresa',
    'idempotency_key',
    'request_fingerprint',
    'pdf_sha256',
    'status',
    'created_at',
    'expires_at',
  ];
  for (const name of requiredNotNull) {
    assert.ok(colByName[name], `columna ${name} debe existir`);
    assert.equal(colByName[name].notnull, 1, `columna ${name} debe ser NOT NULL`);
  }

  // Columnas NULLable
  const requiredNullable = ['response_status', 'response_body', 'completed_at'];
  for (const name of requiredNullable) {
    assert.ok(colByName[name], `columna ${name} debe existir`);
    assert.equal(colByName[name].notnull, 0, `columna ${name} debe ser nullable`);
  }

  // Tipos específicos
  assert.equal(colByName['id_empresa'].type, 'TEXT', 'id_empresa debe ser TEXT');
  assert.equal(colByName['idempotency_key'].type, 'TEXT', 'idempotency_key debe ser TEXT');
  assert.equal(colByName['request_fingerprint'].type, 'TEXT', 'request_fingerprint debe ser TEXT');
  assert.equal(colByName['pdf_sha256'].type, 'TEXT', 'pdf_sha256 debe ser TEXT');
  assert.equal(colByName['status'].type, 'TEXT', 'status debe ser TEXT');
  assert.equal(colByName['response_status'].type, 'INTEGER', 'response_status debe ser INTEGER');
  assert.equal(colByName['response_body'].type, 'TEXT', 'response_body debe ser TEXT');
  assert.equal(colByName['created_at'].type, 'TEXT', 'created_at debe ser TEXT');
  assert.equal(colByName['expires_at'].type, 'TEXT', 'expires_at debe ser TEXT');
  assert.equal(colByName['completed_at'].type, 'TEXT', 'completed_at debe ser TEXT');

  // Default del status debe ser 'PENDING'
  assert.equal(colByName['status'].dflt_value, "'PENDING'",
    "status debe tener default 'PENDING'");

  // Default de created_at debe ser datetime('now')
  assert.ok(/datetime\('now'\)/.test(colByName['created_at'].dflt_value),
    "created_at debe tener default datetime('now')");

  // Default de expires_at debe usar strftime +24h
  assert.ok(/strftime.*\+24 hours/.test(colByName['expires_at'].dflt_value),
    'expires_at debe tener default strftime(... +24 hours)');

  db.close();
});

test('I-003: PK compuesta (id_empresa, idempotency_key) — no surrogate id', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  const files = [
    '001_initial.sql',
    '002_agreement_version.sql',
    '003_id_constancia.sql',
    '004_consent_id.sql',
    '005_reduce_check.sql',
    '006_cedula_sal.sql',
    '007_tipo_identificacion.sql',
    '008_idempotency_keys.sql',
  ];
  for (const filename of files) {
    const sql = fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8');
    db.exec(sql);
  }

  // 1. NO debe haber columna 'id' (no usamos surrogate)
  const cols = db.prepare("PRAGMA table_info(gh_idempotency_keys)").all();
  const idCol = cols.find(c => c.name === 'id');
  assert.equal(idCol, undefined, 'NO debe existir columna id surrogate');

  // 2. Las columnas del PK deben ser id_empresa y idempotency_key, en ese orden
  const pkCols = cols.filter(c => c.pk > 0).sort((a, b) => a.pk - b.pk);
  assert.equal(pkCols.length, 2, 'PK compuesta debe tener exactamente 2 columnas');
  assert.equal(pkCols[0].name, 'id_empresa',
    'columna 1 del PK debe ser id_empresa');
  assert.equal(pkCols[0].pk, 1, 'id_empresa debe estar en posición 1 del PK');
  assert.equal(pkCols[1].name, 'idempotency_key',
    'columna 2 del PK debe ser idempotency_key');
  assert.equal(pkCols[1].pk, 2, 'idempotency_key debe estar en posición 2 del PK');

  // 3. Insertar dos filas con la misma (id_empresa, idempotency_key) debe fallar
  db.prepare(`
    INSERT INTO gh_idempotency_keys
      (id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status)
    VALUES ('900123456', 'key-1', 'fp1', 'pdf1', 'PENDING')
  `).run();

  let duplicateInsertFailed = false;
  try {
    db.prepare(`
      INSERT INTO gh_idempotency_keys
        (id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status)
      VALUES ('900123456', 'key-1', 'fp2', 'pdf2', 'PENDING')
    `).run();
  } catch (e) {
    duplicateInsertFailed = true;
    assert.ok(
      /UNIQUE constraint failed/i.test(e.message) ||
      /PRIMARY KEY constraint failed/i.test(e.message),
      'el error debe ser por UNIQUE/PRIMARY KEY constraint, no otro motivo'
    );
  }
  assert.equal(duplicateInsertFailed, true,
    'insertar (id_empresa, idempotency_key) duplicado debe fallar por PK compuesta');

  // 4. La misma idempotency_key en OTRA empresa debe ser válida (scope por empresa)
  db.prepare(`
    INSERT INTO gh_idempotency_keys
      (id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status)
    VALUES ('900999999', 'key-1', 'fp3', 'pdf3', 'PENDING')
  `).run();

  const rowOtherEmpresa = db.prepare(`
    SELECT id_empresa FROM gh_idempotency_keys WHERE idempotency_key = 'key-1'
  `).all();
  assert.equal(rowOtherEmpresa.length, 2,
    'la misma idempotency_key puede existir en otra empresa (scope por empresa)');

  db.close();
});

test('I-003: CHECK constraint del status rechaza valores fuera de la whitelist', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  const files = [
    '001_initial.sql',
    '002_agreement_version.sql',
    '003_id_constancia.sql',
    '004_consent_id.sql',
    '005_reduce_check.sql',
    '006_cedula_sal.sql',
    '007_tipo_identificacion.sql',
    '008_idempotency_keys.sql',
  ];
  for (const filename of files) {
    const sql = fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8');
    db.exec(sql);
  }

  // 1. Los 4 valores válidos se aceptan
  const validStatuses = ['PENDING', 'COMPLETED', 'FAILED', 'TERMINAL'];
  for (let i = 0; i < validStatuses.length; i++) {
    const s = validStatuses[i];
    db.prepare(`
      INSERT INTO gh_idempotency_keys
        (id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(`empresa-${i}`, `key-${i}`, `fp${i}`, `pdf${i}`, s);
  }

  const inserted = db.prepare("SELECT COUNT(*) AS c FROM gh_idempotency_keys").get().c;
  assert.equal(inserted, 4, 'los 4 statuses válidos deben haberse insertado');

  // 2. Status inválido debe fallar
  let invalidInsertFailed = false;
  try {
    db.prepare(`
      INSERT INTO gh_idempotency_keys
        (id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status)
      VALUES ('empresa-bad', 'key-bad', 'fpbad', 'pdfbad', 'INVALID')
    `).run();
  } catch (e) {
    invalidInsertFailed = true;
    assert.ok(/CHECK constraint failed/i.test(e.message),
      'el error debe ser por CHECK constraint failed');
  }
  assert.equal(invalidInsertFailed, true,
    "insertar status='INVALID' debe fallar por CHECK constraint");

  // 3. Variantes lowercase también deben fallar (whitelist es case-sensitive)
  let lowercaseInsertFailed = false;
  try {
    db.prepare(`
      INSERT INTO gh_idempotency_keys
        (id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status)
      VALUES ('empresa-lc', 'key-lc', 'fplc', 'pdflc', 'pending')
    `).run();
  } catch (e) {
    lowercaseInsertFailed = true;
  }
  assert.equal(lowercaseInsertFailed, true,
    "status 'pending' (lowercase) debe fallar (whitelist es case-sensitive)");

  db.close();
});

test('I-003: índice idx_idempotency_expires existe y cubre expires_at', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  const files = [
    '001_initial.sql',
    '002_agreement_version.sql',
    '003_id_constancia.sql',
    '004_consent_id.sql',
    '005_reduce_check.sql',
    '006_cedula_sal.sql',
    '007_tipo_identificacion.sql',
    '008_idempotency_keys.sql',
  ];
  for (const filename of files) {
    const sql = fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8');
    db.exec(sql);
  }

  // 1. El índice existe
  const idx = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_idempotency_expires'"
  ).get();
  assert.ok(idx, 'el índice idx_idempotency_expires debe existir');

  // 2. PRAGMA index_list debe incluirlo
  const idxList = db.prepare("PRAGMA index_list('gh_idempotency_keys')").all();
  const found = idxList.find(i => i.name === 'idx_idempotency_expires');
  assert.ok(found, 'PRAGMA index_list debe incluir idx_idempotency_expires');

  // 3. PRAGMA index_info debe mostrar expires_at como única columna del índice
  const idxInfo = db.prepare("PRAGMA index_info('idx_idempotency_expires')").all();
  assert.equal(idxInfo.length, 1, 'el índice debe tener 1 columna');
  assert.equal(idxInfo[0].name, 'expires_at',
    'la columna del índice debe ser expires_at');

  db.close();
});

test('C-21: registry-first — migrate() registra 008 y no duplica al re-aplicar', () => {
  // Usa la conexión real del firma-service (TEST_DB_PATH via setup.js).
  // Esto valida el REGISTRY (gh_firma_schema_migrations), no el SQL.
  const db = require('../src/db/connection');
  const { migrate } = require('../src/db/migrate');

  // 1. Verificar que la fila del registry para 008 existe
  //    (la creó el pretest al regenerar la BD de tests).
  const beforeRow = db.prepare(
    "SELECT version, applied_at, description FROM gh_firma_schema_migrations WHERE version = '008_idempotency_keys'"
  ).get();
  assert.ok(beforeRow, 'gh_firma_schema_migrations debe tener fila para 008_idempotency_keys');
  assert.ok(beforeRow.applied_at, 'la fila debe tener applied_at');
  assert.equal(beforeRow.description, 'Auto-aplicada de 008_idempotency_keys.sql',
    'la descripción debe ser auto-generada');

  // 2. Contar filas antes
  const countBefore = db.prepare(
    "SELECT COUNT(*) AS c FROM gh_firma_schema_migrations WHERE version = '008_idempotency_keys'"
  ).get().c;
  assert.equal(countBefore, 1, 'debe haber exactamente 1 fila para 008');

  // 3. Re-aplicar migrate() — NO debe re-aplicar 008 ni duplicar la fila
  //    (migrate.js consulta getAppliedMigrations() y salta las aplicadas).
  migrate();

  // 4. Contar filas después
  const countAfter = db.prepare(
    "SELECT COUNT(*) AS c FROM gh_firma_schema_migrations WHERE version = '008_idempotency_keys'"
  ).get().c;
  assert.equal(countAfter, 1, 'migrate() no debe duplicar la fila del registry');

  // 5. Verificar que la tabla sigue existiendo
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='gh_idempotency_keys'"
  ).get();
  assert.ok(tableExists, 'la tabla gh_idempotency_keys debe seguir existiendo tras re-aplicar migrate()');

  // 6. Verificar que el índice sigue existiendo
  const idxExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_idempotency_expires'"
  ).get();
  assert.ok(idxExists, 'el índice idx_idempotency_expires debe seguir existiendo');

  // 7. Verificar que la fila insertable vía migrate (defensa en profundidad):
  //    la BD real permite INSERT real con status='PENDING'
  db.prepare(`
    INSERT INTO gh_idempotency_keys
      (id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status)
    VALUES ('900-test-registry', 'key-test-registry', 'fpreg1', 'pdfreg1', 'PENDING')
  `).run();

  const insertedRow = db.prepare(
    "SELECT id_empresa, idempotency_key, status FROM gh_idempotency_keys WHERE idempotency_key = 'key-test-registry'"
  ).get();
  assert.ok(insertedRow, 'la fila de prueba debe haberse insertado en la BD de tests');
  assert.equal(insertedRow.id_empresa, '900-test-registry');
  assert.equal(insertedRow.status, 'PENDING');

  // 8. Limpieza (defensa en profundidad): borrar la fila de prueba para que
  //    el test sea idempotente entre corridas sin pretest (mismo DB state).
  db.prepare(
    "DELETE FROM gh_idempotency_keys WHERE idempotency_key = 'key-test-registry'"
  ).run();
});

test('I-003: idempotencia SQL — re-aplicar el SQL directo no falla (IF NOT EXISTS)', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  // Aplicar las 8 migraciones
  const files = [
    '001_initial.sql',
    '002_agreement_version.sql',
    '003_id_constancia.sql',
    '004_consent_id.sql',
    '005_reduce_check.sql',
    '006_cedula_sal.sql',
    '007_tipo_identificacion.sql',
    '008_idempotency_keys.sql',
  ];
  for (const filename of files) {
    const sql = fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8');
    db.exec(sql);
  }

  // Re-aplicar 008 directamente. NO debe fallar (todo es IF NOT EXISTS).
  // El runner de migraciones es defensa en profundidad, pero el SQL debe
  // ser idempotente en sí mismo para que funcione en escenarios donde
  // migrate() no esté disponible.
  const sql008 = fs.readFileSync(MIGRATION_008_PATH, 'utf8');
  let reapplyThrew = false;
  try {
    db.exec(sql008);
  } catch (e) {
    reapplyThrew = true;
  }
  assert.equal(reapplyThrew, false,
    're-aplicar el SQL de 008 no debe fallar (todo es IF NOT EXISTS)');

  // Verificar que la tabla sigue teniendo exactamente 1 fila del PK compuesta
  // (no se duplicaron constraints ni se rompieron las restricciones)
  const cols = db.prepare("PRAGMA table_info(gh_idempotency_keys)").all();
  const pkCols = cols.filter(c => c.pk > 0);
  assert.equal(pkCols.length, 2,
    'la PK compuesta debe seguir teniendo 2 columnas tras re-aplicar');

  // El CHECK constraint debe seguir activo (re-aplicar INSERT inválido debe fallar)
  let reapplyCheckActive = false;
  try {
    db.prepare(`
      INSERT INTO gh_idempotency_keys
        (id_empresa, idempotency_key, request_fingerprint, pdf_sha256, status)
      VALUES ('empresa-r', 'key-r', 'fpr', 'pdfr', 'BOGUS')
    `).run();
  } catch (e) {
    reapplyCheckActive = /CHECK constraint failed/i.test(e.message);
  }
  assert.equal(reapplyCheckActive, true,
    'el CHECK constraint debe seguir activo tras re-aplicar el SQL');

  db.close();
});
