/**
 * Tests de la migración 056: la suscripción del Anexo de Encargo por la Empresa.
 * ============================================================================
 *
 * Lo que se verifica acá:
 *
 *  - El archivo 056_anexo_encargo_suscripcion.sql existe y declara las dos
 *    tablas (la suscripción y su rastro).
 *  - La tabla gh_firma_anexo_encargo_suscripciones tiene EXACTAMENTE las
 *    columnas del plan de suscripción digital del 6-nov-2026, con su tipo.
 *  - `token_hash` es UNIQUE (en la base nunca vive el enlace en claro, y dos
 *    enlaces no pueden apuntar al mismo token).
 *  - Los NOT NULL del presupuesto están puestos: sin `id_empresa`, sin
 *    `token_hash`, sin `version`, sin `hash_texto`, sin `correo_firmante`, sin
 *    `expira_enlace_at` y sin `estado` la fila no describe una suscripción.
 *  - Los índices de consulta por Empresa y por estado existen.
 *  - La tabla del rastro tiene sus columnas.
 *  - Registry: gh_firma_schema_migrations tiene fila para 056.
 *
 * POR QUÉ ESTE ARCHIVO ES DISTINTO DEL DEL ANEXO DE NUBE
 * -------------------------------------------------------
 * El Anexo de Encargo es BILATERAL: el §12 tiene dos bloques de firma. Por
 * eso la fila guarda los DOS actos por separado (`firmado_at` de la Empresa y
 * `contrafirmado_at` de K+AIR). Si alguien los mezclara, el manifiesto podría
 * declarar "firmado" un contrato que solo tiene una parte, y eso sería una
 * afirmación falsa. Por eso hay un test que exige que sean DOS columnas
 * distintas y que la contrafirma pueda estar vacía sin que eso rompa nada.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const db = require('../src/db/connection');
const { resetDb } = require('./helpers');

const SCHEMA_DIR = path.join(__dirname, '..', 'src', 'db', 'schema');
const MIGRATION_056_PATH = path.join(SCHEMA_DIR, '056_anexo_encargo_suscripcion.sql');

// Las columnas de la suscripción y su tipo. El set es EXACTO: si alguien agrega
// o renombra una columna, este test falla y hay que revisar el plan.
const COLUMNAS_SUSCRIPCION = {
  id: 'INTEGER',
  id_empresa: 'TEXT',
  token_hash: 'TEXT',
  version: 'TEXT',
  hash_texto: 'TEXT',
  datos_empresa: 'TEXT',
  correo_firmante: 'TEXT',
  nombre_firmante: 'TEXT',
  cargo_firmante: 'TEXT',
  estado: 'TEXT',
  otp_hash: 'TEXT',
  otp_intentos: 'INTEGER',
  otp_envios: 'INTEGER',
  otp_enviado_at: 'TEXT',
  enlace_abierto_at: 'TEXT',
  expira_enlace_at: 'TEXT',
  firmado_at: 'TEXT',
  evidencia: 'TEXT',
  ip_creacion: 'TEXT',
  user_agent_creacion: 'TEXT',
  ip_firma: 'TEXT',
  user_agent_firma: 'TEXT',
  contrafirmado_at: 'TEXT',
  contrafirma_evidencia: 'TEXT',
  creado_por: 'TEXT',
  created_at: 'TEXT',
  updated_at: 'TEXT',
};

// Las que no pueden faltar: sin esto la fila no describe una suscripción.
const NOT_NULL_OBLIGATORIAS = [
  'id_empresa',
  'token_hash',
  'version',
  'hash_texto',
  'correo_firmante',
  'expira_enlace_at',
  'estado',
];

const COLUMNAS_EVENTOS = [
  'id',
  'id_suscripcion',
  'id_empresa',
  'evento',
  'detalle',
  'ip',
  'user_agent',
  'fecha_hora',
];

function columnasDe(tabla) {
  return db.prepare(`PRAGMA table_info('${tabla}')`).all();
}

function indicesDe(tabla) {
  return db.prepare(`PRAGMA index_list('${tabla}')`).all().map((i) => i.name);
}

test('056 · el archivo 056_anexo_encargo_suscripcion.sql existe y declara las dos tablas', () => {
  assert.ok(fs.existsSync(MIGRATION_056_PATH),
    'debe existir src/db/schema/056_anexo_encargo_suscripcion.sql');
  const sql = fs.readFileSync(MIGRATION_056_PATH, 'utf8');

  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS gh_firma_anexo_encargo_suscripciones'),
    'debe crear la tabla gh_firma_anexo_encargo_suscripciones');
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS gh_firma_anexo_encargo_eventos'),
    'debe crear la tabla gh_firma_anexo_encargo_eventos');

  // Los triggers NO van acá: van en la 057, que lleva `@skip-when-env test`
  // porque el trigger de no-borrar impide que `resetDb()` vacíe la tabla.
  assert.ok(!/CREATE\s+TRIGGER/i.test(sql),
    'la 056 no debe crear triggers: van en la 057 (ver tests/migration-057.test.js)');
});

test('056 · la tabla de suscripciones tiene EXACTAMENTE las columnas del plan, con su tipo', () => {
  const info = columnasDe('gh_firma_anexo_encargo_suscripciones');
  assert.ok(info.length > 0, 'la tabla gh_firma_anexo_encargo_suscripciones debe existir');

  const porNombre = new Map(info.map((c) => [c.name, c]));
  const nombres = info.map((c) => c.name);

  for (const [nombre, tipo] of Object.entries(COLUMNAS_SUSCRIPCION)) {
    assert.ok(porNombre.has(nombre), `falta la columna ${nombre}`);
    assert.equal(porNombre.get(nombre).type, tipo,
      `la columna ${nombre} debe ser ${tipo}`);
  }

  const esperadas = Object.keys(COLUMNAS_SUSCRIPCION).sort();
  assert.deepEqual(nombres.slice().sort(), esperadas,
    'la tabla no puede tener columnas de más ni de menos: el set es el del plan');
});

test('056 · las columnas del presupuesto son NOT NULL', () => {
  const info = columnasDe('gh_firma_anexo_encargo_suscripciones');
  const porNombre = new Map(info.map((c) => [c.name, c]));
  for (const nombre of NOT_NULL_OBLIGATORIAS) {
    assert.equal(porNombre.get(nombre).notnull, 1,
      `la columna ${nombre} debe ser NOT NULL`);
  }
});

test('056 · token_hash es UNIQUE: dos enlaces no pueden apuntar al mismo token', () => {
  const indices = db.prepare(`PRAGMA index_list('gh_firma_anexo_encargo_suscripciones')`).all();
  const unicos = indices.filter((i) => i.unique === 1);
  assert.ok(unicos.length > 0, 'debe existir un índice UNIQUE en la tabla');

  const columnas = new Set();
  for (const idx of unicos) {
    for (const c of db.prepare(`PRAGMA index_info('${idx.name}')`).all()) {
      columnas.add(c.name);
    }
  }
  assert.ok(columnas.has('token_hash'),
    'el índice UNIQUE debe ser sobre token_hash (el enlace de un solo uso)');
});

test('056 · los índices de consulta por Empresa y por estado existen', () => {
  const indices = indicesDe('gh_firma_anexo_encargo_suscripciones');
  assert.ok(indices.includes('idx_anexo_encargo_suscripciones_empresa'),
    'debe existir el índice por Empresa');
  assert.ok(indices.includes('idx_anexo_encargo_suscripciones_estado'),
    'debe existir el índice por estado');
});

test('056 · la tabla del rastro tiene sus columnas', () => {
  const info = columnasDe('gh_firma_anexo_encargo_eventos');
  const nombres = info.map((c) => c.name);
  for (const c of COLUMNAS_EVENTOS) {
    assert.ok(nombres.includes(c), `falta la columna ${c} en el rastro`);
  }
});

test('056 · los dos actos del contrato bilateral son DOS columnas distintas', () => {
  const info = columnasDe('gh_firma_anexo_encargo_suscripciones');
  const porNombre = new Map(info.map((c) => [c.name, c]));

  assert.ok(porNombre.has('firmado_at'),
    'la suscripción de la Empresa (fase 1) se registra en firmado_at');
  assert.ok(porNombre.has('contrafirmado_at'),
    'la contrafirma de K+AIR (fase 2) se registra en contrafirmado_at');
  assert.ok(porNombre.has('contrafirma_evidencia'),
    'la contrafirma tiene su propia evidencia');

  // Y se pueden llenar por separado: una fila con la contrafirma vacía es
  // válida (fase 1 sin fase 2 todavía). Si estos dos actos se mezclaran en
  // una sola columna, el manifiesto podría declarar "firmado" un contrato
  // que solo tiene una parte.
  resetDb();
  const r = db.prepare(`
    INSERT INTO gh_firma_anexo_encargo_suscripciones
      (id_empresa, token_hash, version, hash_texto, correo_firmante,
       expira_enlace_at, estado, firmado_at, contrafirmado_at)
    VALUES (?, ?, ?, ?, ?, ?, 'FIRMADA', ?, NULL)
  `).run('900111222', 'a'.repeat(64), '2026-11-06', 'b'.repeat(64),
    'representante@empresa-prueba.test', '2026-11-09T00:00:00.000Z',
    '2026-11-06T12:00:00.000Z');

  const fila = db.prepare(
    'SELECT firmado_at, contrafirmado_at FROM gh_firma_anexo_encargo_suscripciones WHERE id = ?'
  ).get(r.lastInsertRowid);

  assert.equal(fila.firmado_at, '2026-11-06T12:00:00.000Z');
  assert.equal(fila.contrafirmado_at, null,
    'sin contrafirma el instrumento NO está ejecutado: esa columna va vacía');

  db.prepare('DELETE FROM gh_firma_anexo_encargo_suscripciones WHERE id = ?').run(r.lastInsertRowid);
});

test('056 · datos_empresa guarda los CINCO datos del §11 tal como los declaró la Empresa', () => {
  resetDb();
  // El §11 del Anexo de Encargo tiene cinco huecos: razón social, NIT/C.C.,
  // domicilio, correo y representante. El texto canónico se suscribe con sus
  // huecos; lo que la Empresa completó en la pantalla es lo que queda en su
  // copia, en el acta y en esta columna.
  const declaracion = {
    razon_social: 'ASEPLUS CARIBE SAS',
    nit: '900829731-1',
    domicilio: 'Calle 47 # 43-57 Piso 2, Barranquilla',
    correo: 'asepluscaribesas@gmail.com',
    representante: 'Lilia Maria Vasquez Muñoz',
  };

  const r = db.prepare(`
    INSERT INTO gh_firma_anexo_encargo_suscripciones
      (id_empresa, token_hash, version, hash_texto, correo_firmante,
       expira_enlace_at, estado, datos_empresa)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE', ?)
  `).run('900111222', 'c'.repeat(64), '2026-11-06', 'd'.repeat(64),
    'representante@empresa-prueba.test', '2026-11-09T00:00:00.000Z',
    JSON.stringify(declaracion));

  const fila = db.prepare(
    'SELECT datos_empresa FROM gh_firma_anexo_encargo_suscripciones WHERE id = ?'
  ).get(r.lastInsertRowid);

  const leido = JSON.parse(fila.datos_empresa);
  assert.deepEqual(Object.keys(leido).sort(), Object.keys(declaracion).sort(),
    'los datos del §11 son cinco y son los del plan');
  assert.equal(leido.nit, '900829731-1');

  db.prepare('DELETE FROM gh_firma_anexo_encargo_suscripciones WHERE id = ?').run(r.lastInsertRowid);
});

test('056 · el registry tiene la fila de la 056', () => {
  const fila = db.prepare(
    "SELECT version, applied_at FROM gh_firma_schema_migrations WHERE version = '056_anexo_encargo_suscripcion'"
  ).get();
  assert.ok(fila, 'gh_firma_schema_migrations debe tener fila para 056_anexo_encargo_suscripcion');
  assert.ok(fila.applied_at, 'la fila debe tener applied_at');
});
