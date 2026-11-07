/**
 * 058 · LOS AJUSTES DEL ABOGADO EN LA SUSCRIPCIÓN DEL ANEXO DE ENCARGO
 * ============================================================================
 *
 * Qué comprueba este archivo:
 *
 *  - El archivo 058_anexo_encargo_ajustes_abogado.sql existe y está aplicado.
 *  - La tabla de suscripciones tiene las columnas del segundo canal, del
 *    representante y de la aceptación.
 *  - La ficha de la Empresa tiene las columnas de la SUSCRIPCIÓN, que son
 *    distintas de las de la FIRMA: el Anexo de Encargo es bilateral y el
 *    nombre del campo de firma solo puede ser cierto cuando el instrumento
 *    está ejecutado por las dos partes.
 *
 * POR QUÉ ESTA MIGRACIÓN NO LLEVA TRIGGERS
 * ---------------------------------------
 * La 058 solo AGREGA columnas: no crea tablas, así que no hay rastro nuevo que
 * hacer inalterable. Los triggers del rastro de la suscripción son los de la
 * 057, y esa migración lleva `@skip-when-env test` porque `resetDb()` limpia
 * esa tabla entre tests.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const db = require('../src/db/connection');
const { resetDb } = require('./helpers');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const MIGRATION_058 = path.join(SERVICE_ROOT, 'src', 'db', 'schema',
  '058_anexo_encargo_ajustes_abogado.sql');

/** Las columnas de `tabla`, con su tipo. */
function columnasDe(tabla) {
  return db.prepare(`PRAGMA table_info('${tabla}')`).all();
}

test('058 · el archivo de la migración existe', () => {
  assert.ok(fs.existsSync(MIGRATION_058),
    `debe existir el archivo ${MIGRATION_058}`);
});

test('058 · la migración está aplicada y registrada', () => {
  resetDb();
  const fila = db.prepare(
    'SELECT * FROM gh_firma_schema_migrations WHERE version = ?',
  ).get('058_anexo_encargo_ajustes_abogado');
  assert.ok(fila, 'la migración 058 tiene que estar aplicada y registrada');
});

test('058 · la suscripción tiene las columnas del segundo canal, del representante y de la aceptación', () => {
  const porNombre = new Map(columnasDe('gh_firma_anexo_encargo_suscripciones')
    .map((c) => [c.name, c]));

  const esperadas = {
    canal_codigo: 'TEXT',
    canal_codigo_tipo: 'TEXT',
    canal_codigo_confirmacion: 'TEXT',
    canal_codigo_confirmado_por: 'TEXT',
    canal_codigo_confirmado_at: 'TEXT',
    representante_documento: 'TEXT',
    representante_calidad: 'TEXT',
    representante_verificacion: 'TEXT',
    representante_verificado_por: 'TEXT',
    representante_verificado_at: 'TEXT',
    aceptacion_hash: 'TEXT',
    aceptacion_tratamiento_hash: 'TEXT',
  };
  for (const [nombre, tipo] of Object.entries(esperadas)) {
    assert.ok(porNombre.has(nombre), `falta la columna ${nombre}`);
    assert.equal(porNombre.get(nombre).type, tipo,
      `la columna ${nombre} debe ser ${tipo}`);
    // Son columnas nuevas: pueden estar vacías en las filas viejas, pero no
    // pueden ser NOT NULL, porque las filas anteriores no las tienen.
    assert.equal(porNombre.get(nombre).notnull, 0,
      `la columna ${nombre} no puede ser NOT NULL: las filas anteriores no la tienen`);
  }
});

test('058 · la ficha de la Empresa distingue la SUSCRIPCIÓN de la FIRMA', () => {
  const porNombre = new Map(columnasDe('gh_firma_empresas').map((c) => [c.name, c]));

  for (const nombre of [
    'anexo_encargo_suscrito_at',
    'anexo_encargo_suscrito_version',
    'anexo_encargo_suscrito_hash',
    'anexo_encargo_suscrito_evidencia',
  ]) {
    assert.ok(porNombre.has(nombre), `falta la columna ${nombre}`);
    assert.equal(porNombre.get(nombre).type, 'TEXT');
  }

  // La de la firma sigue existiendo y sigue siendo la del instrumento
  // EJECUTADO: la suscripción no la escribe.
  assert.ok(porNombre.has('anexo_encargo_firmado_at'),
    'la fecha de firma no puede desaparecer: es la que habilita a la Empresa');
});
