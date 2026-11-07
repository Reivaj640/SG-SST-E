/**
 * 059 · LA CONTRAFIRMA DEL ANEXO DE ENCARGO (FASE 2)
 * ============================================================================
 *
 * Qué comprueba este archivo:
 *
 *  - El archivo 059_anexo_encargo_contrafirma.sql existe y está aplicado.
 *  - La tabla de suscripciones tiene las columnas del segundo acto: el
 *    código de la contrafirma, su ámbito, quién lo hizo y el acta que lo
 *    acredita.
 *  - La ficha de la Empresa NO se toca: la contrafirma escribe la fecha de
 *    EJECUCIÓN en `anexo_encargo_firmado_at`, que ya existía, y no inventa
 *    una columna nueva para el mismo hecho.
 *
 * POR QUÉ LOS CONTADORES NO PUEDEN SER NULL
 * -----------------------------------------
 * `contrafirma_otp_intentos` y `contrafirma_otp_envios` son NOT NULL con
 * omisión 0: son contadores, y un contador que empieza en NULL se rompe en
 * la primera cuenta (`NULL + 1` es NULL en SQL, no 1). El resto de columnas
 * son NULLables: una fila vieja no tiene código de contrafirma, y su
 * `contrafirmado_at` en NULL significa que el instrumento todavía no está
 * ejecutado.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const db = require('../src/db/connection');
const { resetDb } = require('./helpers');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const MIGRATION_059 = path.join(SERVICE_ROOT, 'src', 'db', 'schema',
  '059_anexo_encargo_contrafirma.sql');

/** Las columnas de `tabla`, con su tipo. */
function columnasDe(tabla) {
  return db.prepare(`PRAGMA table_info('${tabla}')`).all();
}

test('059 · el archivo de la migración existe', () => {
  assert.ok(fs.existsSync(MIGRATION_059),
    `debe existir el archivo ${MIGRATION_059}`);
});

test('059 · la migración está aplicada y registrada', () => {
  resetDb();
  const fila = db.prepare(
    'SELECT * FROM gh_firma_schema_migrations WHERE version = ?',
  ).get('059_anexo_encargo_contrafirma');
  assert.ok(fila, 'la migración 059 tiene que estar aplicada y registrada');
});

test('059 · la suscripción tiene las columnas de la contrafirma', () => {
  const porNombre = new Map(columnasDe('gh_firma_anexo_encargo_suscripciones')
    .map((c) => [c.name, c]));

  const esperadas = {
    contrafirma_otp_hash: 'TEXT',
    contrafirma_otp_intentos: 'INTEGER',
    contrafirma_otp_envios: 'INTEGER',
    contrafirma_otp_enviado_at: 'TEXT',
    contrafirma_canal: 'TEXT',
    contrafirma_actor: 'TEXT',
    contrafirma_motivo: 'TEXT',
    contrafirma_ip: 'TEXT',
    contrafirma_user_agent: 'TEXT',
    contrafirma_acta_hash: 'TEXT',
    contrafirma_acta_bytes: 'INTEGER',
    contrafirma_acta_archivo: 'TEXT',
  };
  for (const [nombre, tipo] of Object.entries(esperadas)) {
    assert.ok(porNombre.has(nombre), `falta la columna ${nombre}`);
    assert.equal(porNombre.get(nombre).type, tipo,
      `la columna ${nombre} debe ser ${tipo}`);
  }

  // Los CONTADORES no pueden ser NULL: `NULL + 1` es NULL en SQL.
  for (const nombre of ['contrafirma_otp_intentos', 'contrafirma_otp_envios']) {
    assert.equal(porNombre.get(nombre).notnull, 1,
      `la columna ${nombre} es un contador: no puede ser NULL`);
    assert.equal(porNombre.get(nombre).dflt_value, '0',
      `la columna ${nombre} tiene que empezar en 0`);
  }

  // Las demás son NULLables: una fila vieja no tiene contrafirma.
  for (const nombre of ['contrafirma_otp_hash', 'contrafirma_otp_enviado_at',
    'contrafirma_canal', 'contrafirma_acta_hash', 'contrafirma_acta_archivo']) {
    assert.equal(porNombre.get(nombre).notnull, 0,
      `la columna ${nombre} no puede ser NOT NULL: las filas anteriores no la tienen`);
  }
});

test('059 · la ficha de la Empresa NO tiene columnas nuevas de la contrafirma', () => {
  const porNombre = new Map(columnasDe('gh_firma_empresas').map((c) => [c.name, c]));

  // La contrafirma escribe la fecha de EJECUCIÓN en la columna que ya
  // existía: no hay una segunda columna para el mismo hecho.
  assert.ok(porNombre.has('anexo_encargo_firmado_at'),
    'la fecha de ejecución del instrumento tiene que seguir existiendo');
  assert.equal(porNombre.get('anexo_encargo_firmado_at').type, 'TEXT');

  for (const nombre of Object.keys(porNombre)) {
    assert.ok(!nombre.startsWith('anexo_encargo_contrafirma'),
      `la ficha no necesita una columna ${nombre}: la fecha de ejecución ya está `
      + 'en anexo_encargo_firmado_at, y la evidencia de la contrafirma vive en la '
      + 'suscripción');
  }
});

test('059 · la suscripción nueva empieza sin contrafirma y con los contadores en cero', () => {
  resetDb();
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, activo)
    VALUES (?, ?, 1)
  `).run('900555000', 'EMPRESA DE LA MIGRACION SAS');

  const crypto = require('crypto');
  db.prepare(`
    INSERT INTO gh_firma_anexo_encargo_suscripciones
      (id_empresa, token_hash, version, hash_texto, correo_firmante, expira_enlace_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('900555000', crypto.createHash('sha256').update('x').digest('hex'),
    '2026-11-06', 'a'.repeat(64), 'alguien@empresa.test', '2026-11-09T00:00:00.000Z');

  const fila = db.prepare(
    'SELECT contrafirmado_at, contrafirma_otp_hash, contrafirma_otp_intentos, '
    + 'contrafirma_otp_envios FROM gh_firma_anexo_encargo_suscripciones').get();

  assert.equal(fila.contrafirmado_at, null,
    'una suscripción nueva no está contrafirmada');
  assert.equal(fila.contrafirma_otp_hash, null,
    'una suscripción nueva no tiene código de contrafirma');
  assert.equal(fila.contrafirma_otp_intentos, 0);
  assert.equal(fila.contrafirma_otp_envios, 0);
});
