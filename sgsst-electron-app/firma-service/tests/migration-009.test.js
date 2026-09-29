/**
 * Tests de la migración 009: gh_internal_clients (D-13, I-010 per-company authz).
 *
 * Verifica (per C-21, registry-first):
 *  - El archivo 009_internal_clients.sql existe y contiene CREATE TABLE + índice.
 *  - La migración aplica sobre BD con 7 migraciones previas sin romper nada.
 *  - La tabla gh_internal_clients tiene las columnas esperadas con tipos correctos.
 *  - El índice parcial idx_internal_clients_empresa_active existe.
 *  - Registry: gh_firma_schema_migrations tiene fila para 009.
 *  - **C-21**: re-aplicar migrate() NO duplica la fila en el registry.
 *  - **Seguridad**: el hash almacenado NUNCA contiene la API key plaintext.
 *
 * Decisión D-13 (aprobada): api_key_hash se almacena, NO el plaintext.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sha256 } = require('../src/crypto/hash');

const SCHEMA_DIR = path.join(__dirname, '..', 'src', 'db', 'schema');
const MIGRATION_009_PATH = path.join(SCHEMA_DIR, '009_internal_clients.sql');

test('I-010: archivo 009_internal_clients.sql existe y contiene CREATE TABLE + índice', () => {
  assert.ok(fs.existsSync(MIGRATION_009_PATH), 'debe existir src/db/schema/009_internal_clients.sql');
  const sql = fs.readFileSync(MIGRATION_009_PATH, 'utf8');

  // CREATE TABLE gh_internal_clients
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS gh_internal_clients'),
    'debe crear la tabla gh_internal_clients');

  // Columnas esperadas (D-13)
  assert.ok(sql.includes('api_key_hash'), 'debe tener columna api_key_hash');
  assert.ok(sql.includes('id_empresa'), 'debe tener columna id_empresa');
  assert.ok(sql.includes('allowed_operations'), 'debe tener columna allowed_operations');
  assert.ok(sql.includes('description'), 'debe tener columna description');
  assert.ok(sql.includes('created_at'), 'debe tener columna created_at');
  assert.ok(sql.includes('revoked_at'), 'debe tener columna revoked_at');

  // Restricciones
  assert.ok(sql.includes('PRIMARY KEY'),
    'api_key_hash debe ser PRIMARY KEY (lookup directo por hash)');
  assert.ok(sql.includes('id_empresa TEXT NOT NULL'),
    'id_empresa debe ser NOT NULL (cada cliente está atado a una empresa)');

  // Índice parcial sobre clientes activos
  assert.ok(sql.includes('idx_internal_clients_empresa_active'),
    'debe crear el índice idx_internal_clients_empresa_active');
  assert.ok(sql.includes('WHERE revoked_at IS NULL'),
    'el índice debe ser parcial WHERE revoked_at IS NULL');
});

test('I-010: migración 009 aplica sobre BD con 7 migraciones previas (todo intacto)', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  // Aplicar las 8 migraciones en orden
  const files = [
    '001_initial.sql',
    '002_agreement_version.sql',
    '003_id_constancia.sql',
    '004_consent_id.sql',
    '005_reduce_check.sql',
    '006_cedula_sal.sql',
    '007_tipo_identificacion.sql',
    '009_internal_clients.sql',
  ];
  for (const filename of files) {
    const sql = fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8');
    db.exec(sql);
  }

  // 1. Verificar columnas de gh_internal_clients
  const cols = db.prepare("PRAGMA table_info(gh_internal_clients)").all();
  const colNames = cols.map(c => c.name);
  assert.ok(colNames.includes('api_key_hash'), 'api_key_hash debe existir');
  assert.ok(colNames.includes('id_empresa'), 'id_empresa debe existir');
  assert.ok(colNames.includes('allowed_operations'), 'allowed_operations debe existir');
  assert.ok(colNames.includes('description'), 'description debe existir');
  assert.ok(colNames.includes('created_at'), 'created_at debe existir');
  assert.ok(colNames.includes('revoked_at'), 'revoked_at debe existir');

  // 2. api_key_hash es PRIMARY KEY
  const pkInfo = db.prepare("PRAGMA table_info(gh_internal_clients)").all()
    .find(c => c.pk === 1);
  assert.ok(pkInfo, 'debe haber una PRIMARY KEY');
  assert.equal(pkInfo.name, 'api_key_hash',
    'la PRIMARY KEY debe ser api_key_hash (no un id surrogate)');

  // 3. id_empresa es TEXT NOT NULL
  const idEmpresaCol = cols.find(c => c.name === 'id_empresa');
  assert.equal(idEmpresaCol.type, 'TEXT', 'id_empresa debe ser TEXT');
  assert.equal(idEmpresaCol.notnull, 1, 'id_empresa debe ser NOT NULL');

  // 4. allowed_operations es TEXT NOT NULL
  const opsCol = cols.find(c => c.name === 'allowed_operations');
  assert.equal(opsCol.type, 'TEXT', 'allowed_operations debe ser TEXT');
  assert.equal(opsCol.notnull, 1, 'allowed_operations debe ser NOT NULL');

  // 5. description es TEXT nullable
  const descCol = cols.find(c => c.name === 'description');
  assert.equal(descCol.type, 'TEXT', 'description debe ser TEXT');
  assert.equal(descCol.notnull, 0, 'description debe ser nullable');

  // 6. revoked_at es TEXT nullable
  const revokedCol = cols.find(c => c.name === 'revoked_at');
  assert.equal(revokedCol.type, 'TEXT', 'revoked_at debe ser TEXT');
  assert.equal(revokedCol.notnull, 0, 'revoked_at debe ser nullable');

  // 7. Índice parcial existe
  const idx = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_internal_clients_empresa_active'"
  ).get();
  assert.ok(idx, 'el índice idx_internal_clients_empresa_active debe existir');

  // 8. Verificar que las migraciones previas siguen intactas (gh_firmas_electronicas)
  const sigReqCols = db.prepare("PRAGMA table_info(gh_firmas_electronicas)").all();
  const tipoCol = sigReqCols.find(c => c.name === 'tipo_identificacion');
  assert.ok(tipoCol, 'la columna tipo_identificacion de migración 007 debe seguir existiendo');
  const consentIdCol = sigReqCols.find(c => c.name === 'consent_id');
  assert.ok(consentIdCol, 'la columna consent_id de migración 004 debe seguir existiendo');

  // 9. Verificar que se puede insertar un cliente (regla de hash)
  const apiKey = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
  const apiKeyHash = sha256(apiKey);
  db.prepare(`
    INSERT INTO gh_internal_clients (api_key_hash, id_empresa, allowed_operations, description)
    VALUES (?, ?, ?, ?)
  `).run(apiKeyHash, '900123456', 'sign_request:create,sign_request:read', 'K+AIR test');

  const row = db.prepare(
    'SELECT api_key_hash, id_empresa, allowed_operations FROM gh_internal_clients WHERE api_key_hash = ?'
  ).get(apiKeyHash);
  assert.ok(row, 'el cliente debe estar insertado');
  assert.equal(row.id_empresa, '900123456');
  assert.equal(row.allowed_operations, 'sign_request:create,sign_request:read');

  // 10. Verificar que el hash almacenado NUNCA contiene el plaintext
  //     (es una propiedad fundamental de la migración: solo guardamos el hash)
  const allHashes = db.prepare(
    "SELECT api_key_hash FROM gh_internal_clients"
  ).all();
  for (const r of allHashes) {
    assert.notEqual(r.api_key_hash, apiKey,
      'el hash almacenado NUNCA debe ser igual a la API key en plaintext');
    assert.equal(r.api_key_hash, apiKeyHash,
      'el hash almacenado debe ser el SHA-256 de la API key');
    assert.equal(r.api_key_hash.length, 64, 'el hash SHA-256 debe tener 64 chars hex');
  }

  // 11. Verificar revocación: NULL = activa, ISO8601 = revocada
  const activeRow = db.prepare(
    "SELECT revoked_at FROM gh_internal_clients WHERE api_key_hash = ?"
  ).get(apiKeyHash);
  assert.equal(activeRow.revoked_at, null, 'revoked_at debe ser NULL para cliente activo');

  // Insertar segundo cliente (mismo id_empresa, diferente hash) y revocarlo
  const apiKey2 = 'sk_test_2_abcdefghij';
  const apiKey2Hash = sha256(apiKey2);
  db.prepare(`
    INSERT INTO gh_internal_clients (api_key_hash, id_empresa, allowed_operations, revoked_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(apiKey2Hash, '900123456', 'sign_request:create');
  const revokedRow = db.prepare(
    "SELECT revoked_at FROM gh_internal_clients WHERE api_key_hash = ?"
  ).get(apiKey2Hash);
  assert.ok(revokedRow.revoked_at, 'cliente revocado debe tener timestamp en revoked_at');

  // El índice parcial solo debe contar el cliente activo
  const idxCount = db.prepare(`
    SELECT COUNT(*) AS c FROM gh_internal_clients
    WHERE id_empresa = '900123456' AND revoked_at IS NULL
  `).get().c;
  assert.equal(idxCount, 1, 'el índice parcial debe contar solo 1 cliente activo');

  db.close();
});

test('C-21: registry-first — migrate() registra 009 y no duplica al re-aplicar', () => {
  // Usa la conexión real del firma-service (TEST_DB_PATH via setup.js).
  // Esto valida el REGISTRY (gh_firma_schema_migrations), no el SQL.
  const db = require('../src/db/connection');
  const { migrate } = require('../src/db/migrate');

  // 1. Verificar que la fila del registry para 009 existe
  //    (la creó el pretest al regenerar la BD de tests).
  const beforeRow = db.prepare(
    "SELECT version, applied_at, description FROM gh_firma_schema_migrations WHERE version = '009_internal_clients'"
  ).get();
  assert.ok(beforeRow, 'gh_firma_schema_migrations debe tener fila para 009_internal_clients');
  assert.ok(beforeRow.applied_at, 'la fila debe tener applied_at');
  assert.equal(beforeRow.description, 'Auto-aplicada de 009_internal_clients.sql',
    'la descripción debe ser auto-generada');

  // 2. Contar filas antes
  const countBefore = db.prepare(
    "SELECT COUNT(*) AS c FROM gh_firma_schema_migrations WHERE version = '009_internal_clients'"
  ).get().c;
  assert.equal(countBefore, 1, 'debe haber exactamente 1 fila para 009');

  // 3. Re-aplicar migrate() — NO debe re-aplicar 009 ni duplicar la fila
  //    (migrate.js consulta getAppliedMigrations() y salta las aplicadas).
  migrate();

  // 4. Contar filas después
  const countAfter = db.prepare(
    "SELECT COUNT(*) AS c FROM gh_firma_schema_migrations WHERE version = '009_internal_clients'"
  ).get().c;
  assert.equal(countAfter, 1, 'migrate() no debe duplicar la fila del registry');

  // 5. Verificar que la tabla sigue existiendo
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='gh_internal_clients'"
  ).get();
  assert.ok(tableExists, 'la tabla gh_internal_clients debe seguir existiendo tras re-aplicar migrate()');

  // 6. Verificar que el índice sigue existiendo
  const idxExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_internal_clients_empresa_active'"
  ).get();
  assert.ok(idxExists, 'el índice idx_internal_clients_empresa_active debe seguir existiendo');
});

test('I-010: idempotencia SQL — re-aplicar el SQL directo no falla (IF NOT EXISTS)', () => {
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
    '009_internal_clients.sql',
  ];
  for (const filename of files) {
    const sql = fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8');
    db.exec(sql);
  }

  // Re-aplicar 009 directamente. NO debe fallar (todo es IF NOT EXISTS).
  // El runner de migraciones es defensa en profundidad, pero el SQL debe
  // ser idempotente en sí mismo para que funcione en escenarios donde
  // migrate() no esté disponible.
  const sql009 = fs.readFileSync(MIGRATION_009_PATH, 'utf8');
  let reapplyThrew = false;
  try {
    db.exec(sql009);
  } catch (e) {
    reapplyThrew = true;
  }
  assert.equal(reapplyThrew, false,
    're-aplicar el SQL de 009 no debe fallar (todo es IF NOT EXISTS)');

  db.close();
});
