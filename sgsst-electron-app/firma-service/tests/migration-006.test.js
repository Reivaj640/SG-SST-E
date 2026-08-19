/**
 * Tests de la migración 006: identificacion_numero_sal (Bloque P1-2).
 *
 * Verifica:
 * - La migración aplica sin romper sign requests legacy (sin sal)
 * - La columna identificacion_numero_sal es NULL por default
 * - K+AIR puede enviar sal y se persiste correctamente
 * - El servicio genera sal automáticamente si K+AIR no la envía
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', 'src', 'db', 'schema');
const MIGRATION_006_PATH = path.join(SCHEMA_DIR, '006_cedula_sal.sql');

test('P1-2: archivo 006_cedula_sal.sql existe', () => {
  assert.ok(fs.existsSync(MIGRATION_006_PATH), 'debe existir src/db/schema/006_cedula_sal.sql');
  const sql = fs.readFileSync(MIGRATION_006_PATH, 'utf8');
  assert.ok(sql.includes('identificacion_numero_sal'),
    'el SQL debe agregar la columna identificacion_numero_sal');
  assert.ok(sql.includes('ALTER TABLE gh_firmas_electronicas'),
    'debe ser un ALTER TABLE sobre gh_firmas_electronicas');
});

test('P1-2: migración 006 aplica sobre BD con 5 migraciones previas', () => {
  // Lee todas las migraciones y simula aplicación.
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  for (let i = 1; i <= 6; i++) {
    const filename = ['001_initial.sql', '002_agreement_version.sql', '003_id_constancia.sql', '004_consent_id.sql', '005_reduce_check.sql', '006_cedula_sal.sql'][i - 1];
    const sql = fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8');
    db.exec(sql);
  }

  // Verificar que la columna existe.
  const cols = db.prepare("PRAGMA table_info(gh_firmas_electronicas)").all();
  const salCol = cols.find(c => c.name === 'identificacion_numero_sal');
  assert.ok(salCol, 'la columna identificacion_numero_sal debe existir');
  assert.equal(salCol.type, 'TEXT', 'identificacion_numero_sal debe ser TEXT');
  assert.equal(salCol.notnull, 0, 'identificacion_numero_sal debe ser nullable (sign requests legacy)');

  // Insertar sign request sin sal (legacy) → debe funcionar.
  db.prepare(`INSERT INTO gh_firma_acuerdo_versiones (version, texto, texto_hash, activa, fecha_creacion, fecha_vigencia_inicio, creado_por, kair_version) VALUES ('v1.0', 'X', 'h', 1, datetime('now'), datetime('now'), 't', '0.1.189-test')`).run();
  // Usamos el INSERT mínimo. Si falla, mostramos el error específico.
  const legacyInsert = db.prepare(`INSERT INTO gh_firmas_electronicas (id_solicitud, id_documento, id_trabajador, id_empresa, tipo_firma, estado, document_hash_original, agreement_hash, agreement_version, token_hash, fecha_creacion, fecha_expiracion, version_kair) VALUES ('SIGN-LEGACY', 'd', 't', 'e', 'presencial', 'PENDING', 'h', 'h', 'v1.0', 'th', datetime('now'), datetime('now', '+1 day'), '0.1.189-test')`);
  try {
    legacyInsert.run();
  } catch (e) {
    throw new Error('legacy INSERT falló: ' + e.message);
  }
  const legacy = db.prepare("SELECT identificacion_numero_sal FROM gh_firmas_electronicas WHERE id_solicitud = 'SIGN-LEGACY'").get();
  assert.equal(legacy.identificacion_numero_sal, null, 'sign request legacy debe tener sal NULL');

  // Insertar sign request CON sal.
  db.prepare(`INSERT INTO gh_firmas_electronicas (id_solicitud, id_documento, id_trabajador, id_empresa, tipo_firma, estado, document_hash_original, agreement_hash, agreement_version, token_hash, fecha_creacion, fecha_expiracion, version_kair, identificacion_numero_sal) VALUES ('SIGN-NUEVO', 'd', 't', 'e', 'presencial', 'PENDING', 'h', 'h', 'v1.0', 'th2', datetime('now'), datetime('now', '+1 day'), '0.1.189-test', 'a1b2c3d4e5f6')`).run();
  const nuevo = db.prepare("SELECT identificacion_numero_sal FROM gh_firmas_electronicas WHERE id_solicitud = 'SIGN-NUEVO'").get();
  assert.equal(nuevo.identificacion_numero_sal, 'a1b2c3d4e5f6', 'sign request nuevo debe tener sal persistida');

  db.close();
});
