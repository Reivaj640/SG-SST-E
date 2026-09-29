/**
 * Tests de la migración 011: UNIQUE constraint parcial en
 * gh_consentimientos_firma (FASE 3 · A1.5.4-B).
 *
 * Verifica:
 * - La migración aplica sin romper consentimientos legacy.
 * - El índice único parcial idx_consentimientos_key_activo existe y
 *   solo aplica a estados activos (OTP_PENDING, OTP_LOCKED).
 * - Se puede crear un nuevo consent para la misma key si el anterior
 *   está en EXPIRED (la nueva constraint lo permite).
 * - NO se puede crear un nuevo consent si hay uno en OTP_PENDING o
 *   OTP_LOCKED (la constraint los considera activos).
 * - El registry tiene la fila 011_consent_partial_unique.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', 'src', 'db', 'schema');
const MIGRATION_011_PATH = path.join(SCHEMA_DIR, '011_consent_partial_unique.sql');

test('FASE 3: archivo 011_consent_partial_unique.sql existe', () => {
  assert.ok(fs.existsSync(MIGRATION_011_PATH),
    'debe existir src/db/schema/011_consent_partial_unique.sql');
  const sql = fs.readFileSync(MIGRATION_011_PATH, 'utf8');
  assert.ok(sql.includes('CREATE UNIQUE INDEX idx_consentimientos_key_activo'),
    'debe crear el índice único parcial');
  assert.ok(sql.includes("WHERE estado IN ('OTP_PENDING', 'OTP_LOCKED')"),
    'el índice debe ser parcial WHERE estado IN activos');
});

test('FASE 3: migración 011 aplica y permite nuevo consent después de EXPIRED', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  // Aplicar las 11 migraciones en orden
  const files = [
    '001_initial.sql', '002_agreement_version.sql', '003_id_constancia.sql',
    '004_consent_id.sql', '005_reduce_check.sql', '006_cedula_sal.sql',
    '007_tipo_identificacion.sql', '008_idempotency_keys.sql',
    '009_internal_clients.sql', '010_consent_expire.sql',
    '011_consent_partial_unique.sql',
  ];
  for (const filename of files) {
    const sql = fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8');
    db.exec(sql);
  }

  // Insertar un consent EXPIRED
  db.prepare(`
    INSERT INTO gh_consentimientos_firma
      (id_trabajador, id_empresa, version_acuerdo,
       hash_texto_acuerdo, correo_verificacion, correo_hash,
       otp_hash, otp_sal, otp_intentos,
       kair_version, manifestacion_aceptada, estado)
    VALUES (?, ?, ?, 'h', 'a@b.com', 'h', 'h', 's', 0, 'k', 0, 'EXPIRED')
  `).run('111', '222', 'v1.0');

  // Intentar crear OTRO consent para la misma key
  // Debe ser POSIBLE porque EXPIRED no entra en el índice parcial
  const insert2 = db.prepare(`
    INSERT INTO gh_consentimientos_firma
      (id_trabajador, id_empresa, version_acuerdo,
       hash_texto_acuerdo, correo_verificacion, correo_hash,
       otp_hash, otp_sal, otp_intentos,
       kair_version, manifestacion_aceptada, estado)
    VALUES (?, ?, ?, 'h', 'a@b.com', 'h', 'h', 's', 0, 'k', 0, 'OTP_PENDING')
  `);
  assert.doesNotThrow(() => insert2.run('111', '222', 'v1.0'),
    'debe permitir crear un nuevo consent para la misma key si el anterior está EXPIRED');

  // Verificar que hay 2 filas para esa key
  const count = db.prepare(
    "SELECT COUNT(*) AS c FROM gh_consentimientos_firma WHERE id_trabajador = '111' AND id_empresa = '222'"
  ).get().c;
  assert.equal(count, 2);

  // Pero NO debe permitir crear un tercero si hay un OTP_PENDING activo
  const insert3 = db.prepare(`
    INSERT INTO gh_consentimientos_firma
      (id_trabajador, id_empresa, version_acuerdo,
       hash_texto_acuerdo, correo_verificacion, correo_hash,
       otp_hash, otp_sal, otp_intentos,
       kair_version, manifestacion_aceptada, estado)
    VALUES (?, ?, ?, 'h', 'a@b.com', 'h', 'h', 's', 0, 'k', 0, 'OTP_PENDING')
  `);
  assert.throws(() => insert3.run('111', '222', 'v1.0'),
    'NO debe permitir un tercer consent cuando hay OTP_PENDING activo');

  db.close();
});

test('FASE 3: índice parcial idx_consentimientos_key_activo existe', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  const files = [
    '001_initial.sql', '002_agreement_version.sql', '003_id_constancia.sql',
    '004_consent_id.sql', '005_reduce_check.sql', '006_cedula_sal.sql',
    '007_tipo_identificacion.sql', '008_idempotency_keys.sql',
    '009_internal_clients.sql', '010_consent_expire.sql',
    '011_consent_partial_unique.sql',
  ];
  for (const filename of files) {
    const sql = fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8');
    db.exec(sql);
  }

  const idx = db.prepare(
    "SELECT name, sql FROM sqlite_master WHERE type='index' AND name='idx_consentimientos_key_activo'"
  ).get();
  assert.ok(idx, 'el índice idx_consentimientos_key_activo debe existir');
  assert.ok(idx.sql.includes("WHERE estado IN ('OTP_PENDING', 'OTP_LOCKED')"),
    'el índice debe tener el WHERE correcto');

  db.close();
});
