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
const empresaService = require('../../src/services/empresa');
const {
  parseArgs, verificar, main, evaluarHold,
} = require('../../scripts/limpiar-rastro-prueba');

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
  //
  //    OJO: `createSignRequestWithIdentificacion` devuelve `{signRequest, token,
  //    url_publica}`. El id de la fila esta en `firma.signRequest.id`. Con
  //    `firma.id` la consulta recibia undefined -> better-sqlite3 lo liga como
  //    NULL -> la cuenta daba 0 y el test pasaba sin comprobar nada.
  const tokens = db.prepare('SELECT COUNT(*) n FROM gh_firma_tokens WHERE firma_id = ?')
    .get(firma.signRequest.id).n;
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

// =========================================================================
// 5. EL FORZAMIENTO DEL HOLD (26-oct-2026)
// =========================================================================
//
// En produccion, la fila que dejo el e2e (id=12, SIGN-2026-427494) quedo con
// hold: la ficha de la Empresa tiene `conservacion_por_deber_legal = 1`, y esa
// bandera le levanta el hold AUTOMATICO a toda firma de esa Empresa. El
// script se negaba a borrar la fila y el rastro de prueba se quedaba en
// produccion para siempre.
//
// `--forzar-hold` abre esa puerta, pero solo para filas que NUNCA tuvieron un
// acto de firma y con el hold automatico. Estos tests son la red: si alguien
// ablanda la regla, se caen.

const NORMA = '2.2.1.1.12 del Decreto 1072 de 2015';
const EMPRESA = '900123456';

/**
 * La Empresa de produccion: deber legal de conservacion sin termino.
 */
function crearEmpresaConDeberLegal() {
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
  empresaService.create({
    id_empresa: EMPRESA,
    razon_social: 'Empresa de Prueba S.A.S.',
    nit: EMPRESA,
    responsable_tratamiento: 'Responsable de Prueba',
    responsable_tratamiento_correo: 'privacidad@example.com',
    canal_pqrs: 'pqrs@example.com',
    canal_incidentes: 'seguridad@example.com',
    plazo_retencion: '20 anos',
    canal_solicitud_copia: 'privacidad@example.com',
    plazo_retencion_dias: 7305,
    conservacion_por_deber_legal: true,
    norma_conservacion: NORMA,
  });
  // D-03: sin Anexo de Encargo firmado, la empresa no puede pedir firmas.
  empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-20');
}

/**
 * Igual que `sembrarProduccion`, pero con la Empresa que tiene deber legal:
 * la firma sale con el hold automatico, como la de produccion.
 */
async function sembrarProduccionConHold() {
  resetDb();
  const texto = fs.readFileSync(ARCHIVO_LEGAL, 'utf8');
  const version = seedActiveAgreement({ version: 'v1.0', texto });
  crearEmpresaConDeberLegal();
  const firma = await createSignRequestWithIdentificacion({
    id_documento: 'doc-limpieza',
    id_trabajador: '1234567890',
    id_empresa: EMPRESA,
    agreement_version: version.version,
    agreement_hash: version.texto_hash,
  });
  return { version, firma };
}

test('parseArgs: --forzar-hold se reconoce y no viene por defecto', () => {
  const con = parseArgs([
    '--actor=Javier', '--motivo=prueba', '--hasta=' + HOY, '--forzar-hold',
  ]);
  assert.equal(con.forzarHold, true);
  const sin = parseArgs(['--actor=Javier', '--motivo=prueba', '--hasta=' + HOY]);
  assert.equal(sin.forzarHold, false, 'el forzado es opt-in: sin la bandera no existe');
});

test('el forzado se permite: fila nunca firmada con el hold automatico', () => {
  const ev = evaluarHold({
    id: 1, estado: 'PENDING', hold_legal: 1,
    motivo_hold: 'deber_legal_' + NORMA, hold_actor: 'sistema',
    document_hash_firmado: null, evidence_hash: null,
    constancia_path: null, pdf_firmado_path: null,
  }, true);
  assert.equal(ev.hold, true);
  assert.equal(ev.forzable, true, 'la fila de prueba de produccion tiene que ser forzable');
});

test('el forzado NO se permite en una fila que ya se firmo', () => {
  for (const estado of ['SIGNED', 'DUAL_FIRMADO', 'REJECTED', 'REVOKED', 'CANCELLED']) {
    const ev = evaluarHold({
      id: 1, estado, hold_legal: 1,
      motivo_hold: 'deber_legal_' + NORMA, hold_actor: 'sistema',
      document_hash_firmado: null, evidence_hash: null,
      constancia_path: null, pdf_firmado_path: null,
    }, true);
    assert.equal(ev.forzable, false, 'una fila en estado ' + estado + ' no se puede forzar');
  }
});

test('el forzado NO se permite si hay un artefacto de firma', () => {
  const base = {
    id: 1, estado: 'PENDING', hold_legal: 1,
    motivo_hold: 'deber_legal_' + NORMA, hold_actor: 'sistema',
    document_hash_firmado: null, evidence_hash: null,
    constancia_path: null, pdf_firmado_path: null,
  };
  for (const campo of ['document_hash_firmado', 'evidence_hash', 'constancia_path', 'pdf_firmado_path']) {
    const fila = Object.assign({}, base);
    fila[campo] = 'algo';
    const ev = evaluarHold(fila, true);
    assert.equal(ev.forzable, false, 'con ' + campo + ' la fila no se puede forzar');
  }
});

test('el forzado NO se permite si el hold lo declaro una persona', () => {
  const ev = evaluarHold({
    id: 1, estado: 'PENDING', hold_legal: 1,
    motivo_hold: 'deber_legal_' + NORMA, hold_actor: 'operador:rrhh',
    document_hash_firmado: null, evidence_hash: null,
    constancia_path: null, pdf_firmado_path: null,
  }, true);
  assert.equal(ev.forzable, false, 'un hold declarado por un humano es un acto de gobierno');
  assert.match(ev.razon, /rrhh/);
});

test('el forzado NO se permite si el motivo del hold no es el automatico', () => {
  const ev = evaluarHold({
    id: 1, estado: 'PENDING', hold_legal: 1,
    motivo_hold: 'causa judicial 12345', hold_actor: 'sistema',
    document_hash_firmado: null, evidence_hash: null,
    constancia_path: null, pdf_firmado_path: null,
  }, true);
  assert.equal(ev.forzable, false);
  assert.match(ev.razon, /automatico/);
});

test('sin --forzar-hold, el hold de la fila de produccion sigue bloqueando', async () => {
  const { firma } = await sembrarProduccionConHold();
  const id = firma.signRequest.id;

  const fila = db.prepare(
    'SELECT hold_legal, hold_actor, motivo_hold FROM gh_firmas_electronicas WHERE id = ?'
  ).get(id);
  assert.equal(fila.hold_legal, 1, 'la firma sale con el hold automatico de la ficha');
  assert.equal(fila.hold_actor, 'sistema');
  assert.match(fila.motivo_hold, /^deber_legal_/);

  const codigo = runSilent([
    '--actor=Javier Robles Fontalvo',
    '--motivo=limpieza del rastro de prueba del e2e',
    '--hasta=' + HOY,
    '--solo-firmas',
    '--ejecutar',
  ]);

  assert.equal(codigo, 4, 'sin --forzar-hold el script tiene que negarse (codigo 4)');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gh_firmas_electronicas WHERE id = ?')
    .get(id).n, 1, 'la fila tiene que seguir ahi');
});

test('con --forzar-hold, la fila de prueba de produccion se borra', async () => {
  const { version, firma } = await sembrarProduccionConHold();
  const id = firma.signRequest.id;

  const codigo = runSilent([
    '--actor=Javier Robles Fontalvo',
    '--motivo=limpieza del rastro de prueba del e2e de produccion',
    '--hasta=' + HOY,
    '--solo-firmas',
    '--forzar-hold',
    '--ejecutar',
  ]);

  assert.equal(codigo, 0, 'la limpieza tiene que salir bien (codigo 0)');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gh_firmas_electronicas WHERE id = ?')
    .get(id).n, 0, 'la fila de prueba tiene que estar borrada');

  // El texto legal SIGUE ahi, con su huella sellada y activa.
  const fila = db.prepare(
    'SELECT texto_hash, activa FROM gh_firma_acuerdo_versiones WHERE version = ?'
  ).get('v1.0');
  assert.ok(fila, 'la version vigente no puede desaparecer en este modo');
  assert.equal(fila.texto_hash, version.texto_hash, 'el texto legal no puede cambiar');
  assert.equal(fila.activa, 1, 'la version vigente tiene que seguir activa');
});

test('el forzamiento queda escrito en el recibo (con quien y por que)', async () => {
  await sembrarProduccionConHold();

  const codigo = runSilent([
    '--actor=Javier Robles Fontalvo',
    '--motivo=limpieza del rastro de prueba del e2e de produccion',
    '--hasta=' + HOY,
    '--solo-firmas',
    '--forzar-hold',
    '--ejecutar',
  ]);
  assert.equal(codigo, 0);

  const log = db.prepare(
    "SELECT * FROM gh_firma_purga_log WHERE evento = 'LIMPIEZA_RASTRO_PRUEBA' ORDER BY id DESC"
  ).get();
  assert.ok(log, 'tiene que quedar el recibo de la limpieza');
  assert.match(log.motivo, /HOLD FORZADO/, 'el recibo dice que se forzo un hold');
  assert.equal(log.hold_revisados, 1, 'se reviso el hold de una fila');
  assert.equal(log.hold_bloqueados, 0, 'no quedo ninguna fila afuera');

  const registro = db.prepare(
    'SELECT * FROM gh_firma_purga_registro ORDER BY id DESC'
  ).get();
  assert.ok(registro, 'tiene que quedar el recibo por firma');
  assert.match(registro.motivo, /HOLD FORZADO/);
  assert.equal(registro.actor, 'Javier Robles Fontalvo', 'el recibo dice quien lo hizo');
});

test('el historial de holds se borra con la firma (no queda rastro huerfano)', async () => {
  const { firma } = await sembrarProduccionConHold();
  const id = firma.signRequest.id;

  const holdsAntes = db.prepare('SELECT COUNT(*) n FROM gh_firma_holds WHERE firma_id = ?')
    .get(id).n;
  assert.equal(holdsAntes, 1, 'el hold automatico queda registrado en su propio historial');

  runSilent([
    '--actor=Javier Robles Fontalvo',
    '--motivo=limpieza del rastro de prueba',
    '--hasta=' + HOY,
    '--solo-firmas',
    '--forzar-hold',
    '--ejecutar',
  ]);

  assert.equal(db.prepare('SELECT COUNT(*) n FROM gh_firma_holds WHERE firma_id = ?')
    .get(id).n, 0, 'un hold de una firma que ya no existe es un rastro huerfano');
});

test('una fila que YA se firmo NO se borra ni con --forzar-hold', async () => {
  const { firma } = await sembrarProduccionConHold();
  const id = firma.signRequest.id;

  // Se simula el acto: la fila quedo firmada.
  db.prepare(
    "UPDATE gh_firmas_electronicas SET estado = 'SIGNED', document_hash_firmado = ? "
    + "WHERE id = ?"
  ).run('a'.repeat(64), id);

  const codigo = runSilent([
    '--actor=Javier Robles Fontalvo',
    '--motivo=limpieza del rastro de prueba',
    '--hasta=' + HOY,
    '--solo-firmas',
    '--forzar-hold',
    '--ejecutar',
  ]);

  assert.equal(codigo, 4, 'una firma que ocurrio tiene que bloquear la limpieza');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gh_firmas_electronicas WHERE id = ?')
    .get(id).n, 1, 'la firma tiene que seguir ahi');
});

test('un hold declarado por una persona bloquea, aunque nunca se haya firmado', async () => {
  const { firma } = await sembrarProduccionConHold();
  const id = firma.signRequest.id;

  db.prepare(
    "INSERT INTO gh_firma_holds (firma_id, actor, motivo, alcance, declarado_at, activo) "
    + "VALUES (?, 'operador:juridico', 'causa judicial 12345', 'expediente 9', "
    + "datetime('now'), 1)"
  ).run(id);

  const codigo = runSilent([
    '--actor=Javier Robles Fontalvo',
    '--motivo=limpieza del rastro de prueba',
    '--hasta=' + HOY,
    '--solo-firmas',
    '--forzar-hold',
    '--ejecutar',
  ]);

  assert.equal(codigo, 4, 'un hold de una persona es un acto de gobierno: no se toca');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gh_firmas_electronicas WHERE id = ?')
    .get(id).n, 1, 'la fila tiene que seguir ahi');
});
