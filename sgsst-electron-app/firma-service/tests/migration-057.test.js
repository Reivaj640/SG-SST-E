/**
 * Tests de la migración 057: el rastro de la suscripción del Anexo de Encargo
 * es APPEND-ONLY.
 * ============================================================================
 *
 * Lo que se verifica acá:
 *
 *  - El archivo 057_anexo_encargo_eventos_append_only.sql existe y lleva la
 *    directiva `-- @skip-when-env test`.
 *  - En el ambiente de test el trigger NO está instalado (por eso la tabla se
 *    puede limpiar entre tests) y la 057 NO queda registrada en el registry.
 *  - Aplicando el ARCHIVO REAL a una base en memoria, el trigger muerde de
 *    verdad: un UPDATE aborta y un DELETE aborta.
 *  - El mensaje del abort nombra la tabla, para que el error apunte al lugar.
 *  - INSERT sí se puede: el rastro tiene que poder CRECER.
 *
 * POR QUÉ LOS TRIGGERS SE PRUEBAN EN UNA BD AISLADA
 * ---------------------------------------------------
 * La migración 057 lleva `@skip-when-env test`, así que en la BD compartida de
 * tests NO se aplica: `resetDb()` borra la tabla entre casos y con el trigger
 * activo ese DELETE abortaría. El comportamiento del trigger se prueba acá
 * contra el ARCHIVO REAL, en una base aparte — el mismo mecanismo y la misma
 * razón que la 020 (el registro de auditoría), la 036, la 038, la 048, la 053
 * y la 055.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const db = require('../src/db/connection');

const SCHEMA_DIR = path.join(__dirname, '..', 'src', 'db', 'schema');
const MIGRATION_056_PATH = path.join(SCHEMA_DIR, '056_anexo_encargo_suscripcion.sql');
const MIGRATION_057_PATH = path.join(SCHEMA_DIR, '057_anexo_encargo_eventos_append_only.sql');

const SQL_057 = fs.readFileSync(MIGRATION_057_PATH, 'utf8');

/**
 * Abre una base en memoria con el ESQUEMA REAL (la 056) y los TRIGGERS REALES
 * (la 057). Si alguien cambia cualquiera de los dos archivos, esta base cambia
 * con él: no hay una copia del esquema escrita a mano que se pueda quedar
 * vieja sin que nadie lo note.
 */
function abrirBdAislada() {
  const Database = require('better-sqlite3');
  const bd = new Database(':memory:');
  bd.exec(fs.readFileSync(MIGRATION_056_PATH, 'utf8'));
  bd.exec(SQL_057);
  return bd;
}

function triggersDe(tabla, bd = db) {
  return bd.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?"
  ).all(tabla).map((t) => t.name);
}

test('057 · el archivo existe y lleva la directiva de salto para el ambiente de test', () => {
  assert.ok(fs.existsSync(MIGRATION_057_PATH),
    'debe existir src/db/schema/057_anexo_encargo_eventos_append_only.sql');
  assert.match(SQL_057, /@skip-when-env\s+test/,
    'la 057 debe llevar `@skip-when-env test` (si no, resetDb() no puede limpiar la tabla)');
});

test('057 · en el ambiente de test el trigger NO está instalado y la 057 no se registra', () => {
  // Esto es lo que hace posible limpiar la tabla entre tests. Si el trigger
  // llegara a instalarse acá, el `DELETE FROM` de resetDb() abortaría y la
  // suite se caería — que es justamente lo que la directiva evita.
  assert.deepEqual(triggersDe('gh_firma_anexo_encargo_eventos'), [],
    'en el ambiente de test no puede haber triggers sobre el rastro');

  const fila = db.prepare(
    "SELECT version FROM gh_firma_schema_migrations WHERE version = '057_anexo_encargo_eventos_append_only'"
  ).get();
  assert.equal(fila, undefined,
    'la 057 no debe registrarse en el ambiente de test: en producción sí se aplica');
});

test('057 · el rastro es append-only: el UPDATE aborta (trigger real)', () => {
  const bd = abrirBdAislada();
  try {
    bd.prepare(`INSERT INTO gh_firma_anexo_encargo_eventos
      (id_suscripcion, id_empresa, evento) VALUES (1, 'X', 'SUSCRIPCION_CREADA')`).run();

    assert.throws(() => bd.prepare(
      'UPDATE gh_firma_anexo_encargo_eventos SET evento = ? WHERE id = 1').run('OTRA'),
    /append-only/,
    'el rastro de la suscripción no se puede alterar');

    // Lo que se insertó sigue intacto: el UPDATE no se aplicó a medias.
    const fila = bd.prepare(
      'SELECT evento FROM gh_firma_anexo_encargo_eventos WHERE id = 1').get();
    assert.equal(fila.evento, 'SUSCRIPCION_CREADA',
      'el UPDATE abortado no puede haber cambiado la fila');
  } finally {
    bd.close();
  }
});

test('057 · el rastro es append-only: el DELETE aborta (trigger real)', () => {
  const bd = abrirBdAislada();
  try {
    bd.prepare(`INSERT INTO gh_firma_anexo_encargo_eventos
      (id_suscripcion, id_empresa, evento) VALUES (1, 'X', 'SUSCRIPCION_CREADA')`).run();

    assert.throws(() => bd.prepare(
      'DELETE FROM gh_firma_anexo_encargo_eventos WHERE id = 1').run(),
    /append-only/,
    'el rastro de la suscripción no se puede borrar');

    const n = bd.prepare('SELECT COUNT(*) AS c FROM gh_firma_anexo_encargo_eventos').get().c;
    assert.equal(n, 1, 'el DELETE abortado no puede haber borrado la fila');
  } finally {
    bd.close();
  }
});

test('057 · el mensaje del abort nombra la tabla del rastro', () => {
  const bd = abrirBdAislada();
  try {
    bd.prepare(`INSERT INTO gh_firma_anexo_encargo_eventos
      (id_suscripcion, id_empresa, evento) VALUES (1, 'X', 'SUSCRIPCION_CREADA')`).run();

    assert.throws(() => bd.prepare(
      'DELETE FROM gh_firma_anexo_encargo_eventos WHERE id = 1').run(),
    /gh_firma_anexo_encargo_eventos/,
    'el error tiene que decir en qué tabla está el problema');
  } finally {
    bd.close();
  }
});

test('057 · el rastro sí se puede CRECER: el trigger no bloquea el INSERT', () => {
  const bd = abrirBdAislada();
  try {
    bd.prepare(`INSERT INTO gh_firma_anexo_encargo_eventos
      (id_suscripcion, id_empresa, evento) VALUES (1, 'X', 'SUSCRIPCION_CREADA')`).run();
    bd.prepare(`INSERT INTO gh_firma_anexo_encargo_eventos
      (id_suscripcion, id_empresa, evento) VALUES (1, 'X', 'CODIGO_ENVIADO')`).run();

    const eventos = bd.prepare(
      'SELECT evento FROM gh_firma_anexo_encargo_eventos ORDER BY id').all().map((r) => r.evento);
    assert.deepEqual(eventos, ['SUSCRIPCION_CREADA', 'CODIGO_ENVIADO'],
      'el rastro tiene que poder crecer: es append-only, no inmutable');
  } finally {
    bd.close();
  }
});
