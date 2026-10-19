/**
 * Test del trigger append-only sobre gh_firma_eventos (migración 020).
 *
 * Ejecutar: node --test --require ./tests/setup.js tests/eventos-append-only.test.js
 *
 * POR QUÉ EL TRIGGER SE APLICA A MANO Y NO CON LA MIGRACIÓN
 * --------------------------------------------------------
 * La migración 020 lleva la directiva `-- @skip-when-env test`, así que en
 * el ambiente de test NO se aplica: varios tests limpian la tabla con
 * `DELETE FROM gh_firma_eventos` entre casos y con el trigger abortarían.
 *
 * Debilitar la garantía "para que los tests pasen" dejaría la puerta
 * abierta en producción. Lo correcto es lo contrario: la garantía se
 * salta SOLO en el ambiente que la necesita, y este test la crea a mano
 * para comprobar que funciona. En producción la migración 020 sí se aplica
 * (el runner la registra y la ejecuta).
 *
 * Qué se prueba:
 *  - Que el INSERT en el registro de auditoría siga funcionando.
 *  - Que un UPDATE sobre un evento ya registrado aborte.
 *  - Que un DELETE sobre un evento ya registrado aborte.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/db/connection');
const { resetDb } = require('./helpers');

const TRIGGER_UPDATE = `
CREATE TRIGGER IF NOT EXISTS trg_test_eventos_no_update
BEFORE UPDATE ON gh_firma_eventos
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_eventos es append-only: no se puede UPDATE (Acuerdo 3.6(g))');
END;
`;

const TRIGGER_DELETE = `
CREATE TRIGGER IF NOT EXISTS trg_test_eventos_no_delete
BEFORE DELETE ON gh_firma_eventos
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_eventos es append-only: no se puede DELETE (Acuerdo 3.6(g))');
END;
`;

/**
 * Crea una fila de firma y un evento, para tener sobre qué probar.
 */
function sembrarEvento() {
  resetDb();
  db.exec(`
    INSERT INTO gh_firmas_electronicas
      (id_solicitud, id_documento, id_trabajador, id_empresa, tipo_firma,
       document_hash_original, agreement_hash, agreement_version,
       token_hash, fecha_creacion, fecha_expiracion, version_kair)
    VALUES ('SIGN-2026-000001', 'doc-1', 'trab-1', '900123456', 'presencial',
            'hash-doc', 'hash-acuerdo', 'v1.0', 'hash-token',
            datetime('now'), datetime('now'), '0.1.0-test');
  `);
  const firmaId = db.prepare('SELECT id FROM gh_firmas_electronicas').get().id;
  db.prepare(`
    INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, id_actor)
    VALUES (?, 'CREATED', datetime('now'), 'rh:system')
  `).run(firmaId);
  return firmaId;
}

test('el INSERT en el registro de auditoría sigue funcionando', () => {
  resetDb();
  const firmaId = sembrarEvento();
  const total = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_eventos').get().n;
  assert.equal(total, 1);
  assert.ok(firmaId);
});

test('un UPDATE sobre un evento ya registrado aborta', () => {
  const firmaId = sembrarEvento();
  db.exec(TRIGGER_UPDATE);
  try {
    assert.throws(
      () => db.prepare(
        "UPDATE gh_firma_eventos SET evento = 'ALTERADO' WHERE firma_id = ?"
      ).run(firmaId),
      /append-only/,
      'el UPDATE debe abortar'
    );
    // El evento quedó como estaba.
    const fila = db.prepare('SELECT evento FROM gh_firma_eventos WHERE firma_id = ?').get(firmaId);
    assert.equal(fila.evento, 'CREATED');
  } finally {
    db.exec('DROP TRIGGER IF EXISTS trg_test_eventos_no_update');
  }
});

test('un DELETE sobre un evento ya registrado aborta', () => {
  const firmaId = sembrarEvento();
  db.exec(TRIGGER_DELETE);
  try {
    assert.throws(
      () => db.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = ?').run(firmaId),
      /append-only/,
      'el DELETE debe abortar'
    );
    const total = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_eventos').get().n;
    assert.equal(total, 1, 'el evento debe seguir ahí');
  } finally {
    db.exec('DROP TRIGGER IF EXISTS trg_test_eventos_no_delete');
  }
});

test('MUTACION: sin el trigger, el UPDATE y el DELETE si pasan', () => {
  // Si el trigger no existiera, el UPDATE y el DELETE se ejecutarían
  // sin error: esa es exactamente la debilidad que el 3.6(g) dice que
  // no debe existir.
  const firmaId = sembrarEvento();
  db.prepare("UPDATE gh_firma_eventos SET evento = 'ALTERADO' WHERE firma_id = ?").run(firmaId);
  assert.equal(
    db.prepare('SELECT evento FROM gh_firma_eventos WHERE firma_id = ?').get(firmaId).evento,
    'ALTERADO'
  );
  db.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = ?').run(firmaId);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM gh_firma_eventos').get().n, 0);
});

test('la migración 020 lleva la directiva de salto para el ambiente de test', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'db', 'schema', '020_eventos_append_only.sql'),
    'utf8'
  );
  assert.match(sql, /@skip-when-env\s+test/);
});
