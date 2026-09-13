/**
 * Tests de la migración 016: consentimiento propio del representante
 * (rol_firmante + datos del aceptante en gh_consentimientos_firma).
 *
 * Verifica:
 * - El archivo 016_consent_rol_firmante.sql existe y crea las columnas.
 * - La migración aplica sobre un esquema 001..014 sin romper datos.
 * - Conviven un consent TRABAJADOR + uno EMPRESA para la misma key
 *   (trabajador, empresa, versión) gracias al índice parcial extendido.
 * - El registry tiene la fila 016 (vía migrate runner en e2e, aquí solo
 *   verificamos aplicación directa del SQL).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', 'src', 'db', 'schema');
const MIGRATION_016_PATH = path.join(SCHEMA_DIR, '016_consent_rol_firmante.sql');

test('migración 016 existe y declara rol_firmante', () => {
  assert.ok(fs.existsSync(MIGRATION_016_PATH),
    'debe existir src/db/schema/016_consent_rol_firmante.sql');
  const sql = fs.readFileSync(MIGRATION_016_PATH, 'utf8');
  assert.ok(sql.includes('rol_firmante'), 'debe agregar rol_firmante');
  assert.ok(sql.includes('nombre_aceptante'), 'debe agregar nombre_aceptante');
  assert.ok(sql.includes('idx_consentimientos_key_activo'),
    'debe recrear el índice único parcial');
  assert.ok(sql.includes('rol_firmante)'),
    'el índice parcial debe incluir rol_firmante');
});

test('migración 016 aplica y permite consent TRABAJADOR + EMPRESA en la misma key', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = OFF');

  const files = [
    '001_initial.sql', '002_agreement_version.sql', '003_id_constancia.sql',
    '004_consent_id.sql', '005_reduce_check.sql', '006_cedula_sal.sql',
    '007_tipo_identificacion.sql', '008_idempotency_keys.sql',
    '009_internal_clients.sql', '010_consent_expire.sql',
    '011_consent_partial_unique.sql', '012_drop_consent_otp_not_null.sql',
    '013_firma_dual.sql', '014_doble_firma_estado.sql',
    '016_consent_rol_firmante.sql',
  ];
  for (const filename of files) {
    db.exec(fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8'));
  }

  const cols = db.prepare('PRAGMA table_info(gh_consentimientos_firma)').all()
    .map(function (c) { return c.name; });
  ['rol_firmante', 'nombre_aceptante', 'cargo_aceptante', 'identificacion_aceptante']
    .forEach(function (c) {
      assert.ok(cols.includes(c), 'columna ' + c + ' debe existir');
    });

  // Dos consents misma key, distinto rol: ambos entran (índice extendido).
  db.prepare(
    "INSERT INTO gh_consentimientos_firma (id_trabajador, id_empresa, version_acuerdo, " +
    "hash_texto_acuerdo, correo_verificacion, correo_hash, kair_version, manifestacion_aceptada, estado, rol_firmante) " +
    "VALUES ('w1', 'e1', 'v1.0', 'h', 'w@x.co', 'h', 'k', 1, 'ACCEPTED', 'TRABAJADOR')"
  ).run();
  db.prepare(
    "INSERT INTO gh_consentimientos_firma (id_trabajador, id_empresa, version_acuerdo, " +
    "hash_texto_acuerdo, correo_verificacion, correo_hash, kair_version, manifestacion_aceptada, estado, " +
    "rol_firmante, nombre_aceptante, cargo_aceptante) " +
    "VALUES ('w1', 'e1', 'v1.0', 'h', 'rep@x.co', 'h', 'k', 1, 'ACCEPTED', 'EMPRESA', 'Rep Legal', 'Representante Legal')"
  ).run();
  const n = db.prepare(
    "SELECT COUNT(*) AS n FROM gh_consentimientos_firma WHERE id_trabajador = 'w1'"
  ).get().n;
  assert.equal(n, 2, 'deben coexistir TRABAJADOR + EMPRESA');

  // Pero NO dos activos del mismo rol (índice parcial lo impide).
  db.prepare(
    "INSERT INTO gh_consentimientos_firma (id_trabajador, id_empresa, version_acuerdo, " +
    "hash_texto_acuerdo, correo_verificacion, correo_hash, kair_version, manifestacion_aceptada, estado, rol_firmante) " +
    "VALUES ('w1', 'e1', 'v1.0', 'h', 'otro@x.co', 'h', 'k', 0, 'OTP_PENDING', 'EMPRESA')"
  ).run();
  assert.throws(function () {
    db.prepare(
      "INSERT INTO gh_consentimientos_firma (id_trabajador, id_empresa, version_acuerdo, " +
      "hash_texto_acuerdo, correo_verificacion, correo_hash, kair_version, manifestacion_aceptada, estado, rol_firmante) " +
      "VALUES ('w1', 'e1', 'v1.0', 'h', 'otro2@x.co', 'h', 'k', 0, 'OTP_PENDING', 'EMPRESA')"
    ).run();
  }, 'dos EMPRESA activos deben chocar en el índice parcial');
  db.close();
});
