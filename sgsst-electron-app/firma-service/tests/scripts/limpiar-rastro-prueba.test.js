/**
 * Tests del script scripts/limpiar-rastro-prueba.js.
 *
 * POR QUE ESTE ARCHIVO EXISTE
 * ---------------------------
 * El 21-oct-2026, en produccion, el texto legal ya estaba publicado y
 * sellado. El candado del script (que existe para que este script NUNCA
 * borre el texto legal) se negaba a borrar la version v1.0, que era
 * justamente la version vigente: no habia forma de limpiar las filas de
 * prueba que habian quedado de las pruebas del e2e.
 *
 * La respuesta fue el modo `--solo-firmas`: borra las filas de prueba y NO
 * toca ninguna version del Acuerdo. Este archivo prueba que ese modo hace
 * exactamente eso, y sobre todo que NO abre un boquete en el candado.
 *
 * La prueba central arma la situacion REAL de produccion: la version
 * vigente con la huella del texto legal sellado. Con esa base:
 *   - el modo normal tiene que NEGARSE (codigo 4) y no tocar nada;
 *   - el modo --solo-firmas tiene que borrar la firma y DEJAR la version.
 *
 * Si alguien degrada el modo --solo-firmas para que tambien borre la
 * version, estos tests se caen.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { resetDb, seedActiveAgreement, createSignRequestWithIdentificacion } = require('../helpers');
const db = require('../../src/db/connection');
const { parseArgs, verificar, main } = require('../../scripts/limpiar-rastro-prueba');

const ARCHIVO_LEGAL = path.resolve(__dirname, '..', '..', 'scripts', 'fixtures', 'acuerdo-v1.0.txt');
const MANIFIESTO = path.resolve(__dirname, '..', '..', 'scripts', 'fixtures', 'acuerdo-ARCHIVO.json');

/**
 * Corre main() sin ensuciar la salida del reporter de node:test.
 * @returns {number} codigo de salida
 */
function runSilent(args) {
  const origLog = console.log;
  const origWarn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  let code;
  try {
    code = main(args);
  } finally {
    console.log = origLog;
    console.warn = origWarn;
  }
  return code;
}

/**
 * Deja la base como esta en produccion: la version vigente con la huella
 * del texto legal SELLADO, mas una firma de prueba.
 */
async function sembrarProduccion() {
  resetDb();
  const texto = fs.readFileSync(ARCHIVO_LEGAL, 'utf8');
  const version = seedActiveAgreement({ version: 'v1.0', texto });
  const firma = await createSignRequestWithIdentificacion({
    id_documento: 'doc-limpieza',
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    consent_id: null,
    agreement_version: version.version,
    agreement_hash: version.texto_hash,
  });
  return { version, firma };
}

const HOY = new Date().toISOString().slice(0, 10);

/** La huella real del texto legal sellado (la del manifiesto del repo). */
const SELLEDA = JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8')).versiones['v1.0'].sha256;

// =========================================================================
// 1. La huella sellada es la del archivo legal del repo
// =========================================================================

test('el texto legal del repo es el que esta sellado en el manifiesto', () => {
  const manifiesto = JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8'));
  const sellado = manifiesto.versiones['v1.0'].sha256;
  const crypto = require('crypto');
  const delRepo = crypto.createHash('sha256')
    .update(fs.readFileSync(ARCHIVO_LEGAL)).digest('hex');
  assert.equal(delRepo, sellado,
    'el fixture del repo tiene que ser el texto legal sellado: el test depende de eso');
});

// =========================================================================
// 2. parseArgs
// =========================================================================

test('parseArgs: --solo-firmas se reconoce y no pide version', () => {
  const opts = parseArgs([
    '--actor=Javier', '--motivo=prueba', '--hasta=' + HOY, '--solo-firmas',
  ]);
  assert.equal(opts.soloFirmas, true);
  assert.equal(opts.ejecutar, false);
  assert.equal(opts.actor, 'Javier');
});

test('parseArgs: sin --solo-firmas el modo es el normal', () => {
  const opts = parseArgs(['--actor=Javier', '--motivo=prueba', '--hasta=' + HOY]);
  assert.equal(opts.soloFirmas, false);
  assert.equal(opts.version, 'v1.0');
});

test('parseArgs: sin --actor, --motivo o --hasta se niega', () => {
  assert.throws(() => parseArgs(['--motivo=x', '--hasta=' + HOY]), /--actor/);
  assert.throws(() => parseArgs(['--actor=x', '--hasta=' + HOY]), /--motivo/);
  assert.throws(() => parseArgs(['--actor=x', '--motivo=y']), /--hasta/);
});

// =========================================================================
// 3. La decision: el candado del texto legal sigue valiendo
// =========================================================================

test('el modo normal se NIEGA cuando la version es el texto legal sellado', () => {
  const problemas = verificar({
    corte: HOY,
    firmas: [],
    firmasFueraDeRango: [],
    consentimientos: [],
    consentimientosSeQuedan: [],
    consentimientosFuera: [],
    version: { version: 'v1.0', texto_hash: SELLEDA },
    versionSeQueda: null,
    archivos: [],
  }, { actor: 'a', motivo: 'm', hasta: HOY, version: 'v1.0', ejecutar: true, soloFirmas: false });
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /texto legal sellado/);
});

test('el modo --solo-firmas no pide la version: no hay version en el plan', () => {
  const problemas = verificar({
    corte: HOY,
    firmas: [],
    firmasFueraDeRango: [],
    consentimientos: [],
    consentimientosSeQuedan: [],
    consentimientosFuera: [],
    version: null,               // en este modo no se borra ninguna version
    versionSeQueda: { version: 'v1.0', texto_hash: 'X'.repeat(64) },
    archivos: [],
  }, { actor: 'a', motivo: 'm', hasta: HOY, version: 'v1.0', ejecutar: true, soloFirmas: true });
  assert.deepEqual(problemas, [],
    'en el modo --solo-firmas no puede haber problemas por la version: no se toca');
});

test('el modo --solo-firmas se NIEGA si el plan trae una version (guarda interna)', () => {
  const problemas = verificar({
    corte: HOY,
    firmas: [],
    firmasFueraDeRango: [],
    consentimientos: [],
    consentimientosSeQuedan: [],
    consentimientosFuera: [],
    version: { version: 'v1.0', texto_hash: 'X'.repeat(64) },
    versionSeQueda: null,
    archivos: [],
  }, { actor: 'a', motivo: 'm', hasta: HOY, version: 'v1.0', ejecutar: true, soloFirmas: true });
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /no puede borrar una versi/);
});

test('el hold legal bloquea en los dos modos', () => {
  const plan = {
    corte: HOY,
    firmas: [{ id: 1, hold_legal: 1 }],
    firmasFueraDeRango: [],
    consentimientos: [],
    consentimientosSeQuedan: [],
    consentimientosFuera: [],
    version: null,
    versionSeQueda: null,
    archivos: [],
  };
  for (const soloFirmas of [true, false]) {
    const problemas = verificar(plan, {
      actor: 'a', motivo: 'm', hasta: HOY, version: 'v1.0', ejecutar: true, soloFirmas,
    });
    assert.ok(problemas.some((p) => /hold/.test(p)),
      'una firma con hold tiene que bloquear la limpieza (soloFirmas=' + soloFirmas + ')');
  }
});

// =========================================================================
// 4. La prueba de fuego: contra una base sembrada como la de produccion
// =========================================================================

test('el modo normal NO borra nada cuando la version vigente es el legal sellado', async () => {
  const { version, firma } = await sembrarProduccion();
  const antes = db.prepare('SELECT COUNT(*) n FROM gh_firmas_electronicas').get().n;

  const codigo = runSilent([
    '--actor=Javier Robles Fontalvo',
    '--motivo=prueba de la guarda del texto legal',
    '--hasta=' + HOY,
    '--ejecutar',
  ]);

  assert.equal(codigo, 4, 'el modo normal tiene que negarse (codigo 4)');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gh_firmas_electronicas').get().n, antes,
    'no se puede borrar ninguna firma cuando el modo se niega');
  assert.ok(db.prepare('SELECT COUNT(*) n FROM gh_firma_acuerdo_versiones WHERE version = ?')
    .get('v1.0').n === 1, 'la version vigente sigue ahi');
  void version; void firma;
});

test('el modo --solo-firmas borra la firma de prueba y DEJA el texto legal', async () => {
  const { version, firma } = await sembrarProduccion();
  const firmasAntes = db.prepare('SELECT COUNT(*) n FROM gh_firmas_electronicas').get().n;
  assert.ok(firmasAntes >= 1);

  const codigo = runSilent([
    '--actor=Javier Robles Fontalvo',
    '--motivo=limpieza del rastro de prueba del e2e',
    '--hasta=' + HOY,
    '--solo-firmas',
    '--ejecutar',
  ]);

  assert.equal(codigo, 0, 'la limpieza tiene que salir bien (codigo 0)');

  // 1. La firma se fue.
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gh_firmas_electronicas').get().n, 0,
    'la firma de prueba tiene que estar borrada');

  // 2. SUS tokens tambien (son credenciales).
  const tokens = db.prepare('SELECT COUNT(*) n FROM gh_firma_tokens WHERE firma_id = ?')
    .get(firma.id).n;
  assert.equal(tokens, 0, 'los tokens de la firma borrada tambien tienen que estar');

  // 3. El texto legal SIGUE ahi, con su huella sellada y activa.
  const fila = db.prepare(
    'SELECT texto_hash, activa FROM gh_firma_acuerdo_versiones WHERE version = ?'
  ).get('v1.0');
  assert.ok(fila, 'la version vigente no puede desaparecer en este modo');
  assert.equal(fila.texto_hash, version.texto_hash, 'el texto legal no puede cambiar');
  assert.equal(fila.activa, 1, 'la version vigente tiene que seguir activa');

  // 4. El recibo: una fila por firma en el registro y una en el log.
  const recibo = db.prepare('SELECT COUNT(*) n FROM gh_firma_purga_registro').get().n;
  assert.ok(recibo >= 1, 'tiene que quedar el recibo de la purga');
  const log = db.prepare(
    "SELECT COUNT(*) n FROM gh_firma_purga_log WHERE evento = 'LIMPIEZA_RASTRO_PRUEBA_SOLO_FIRMAS'"
  ).get().n;
  assert.equal(log, 1, 'el recibo dice que NO se toco ninguna version');

  // 5. La base quedo integra y con los triggers repuestos.
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
  for (const t of ['trg_firma_eventos_no_update', 'trg_firma_eventos_no_delete']) {
    assert.ok(db.prepare(
      "SELECT name FROM sqlite_master WHERE type='trigger' AND name=?"
    ).get(t), 'el trigger ' + t + ' tiene que estar repuesto');
  }
});

test('el modo --solo-firmas sin --ejecutar es simulacion: no borra nada', async () => {
  await sembrarProduccion();
  const antes = db.prepare('SELECT COUNT(*) n FROM gh_firmas_electronicas').get().n;

  const codigo = runSilent([
    '--actor=Javier Robles Fontalvo',
    '--motivo=simulacion',
    '--hasta=' + HOY,
    '--solo-firmas',
  ]);

  assert.equal(codigo, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gh_firmas_electronicas').get().n, antes,
    'la simulacion no puede borrar nada');
});
