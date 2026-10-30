/**
 * FASE 5 DEL CARRIL DE CÓDIGO — conservación, deber legal y purga gobernada.
 *
 * Ejecutar: node --test --require ./tests/setup.js tests/conservacion-purga.test.js
 *
 * QUÉ SE PRUEBA
 * -------------
 *  - Que la fecha de conservación se calcula con el plazo que declara la
 *    Empresa (8.6) y que SIN plazo declarado no hay fecha ni purga.
 *  - Que el deber legal de conservación (`hold_legal`) bloquea siempre, y que
 *    sin él la fila sí sería elegible (mutación).
 *  - Que el reporte de vencimientos separa los cuatro grupos.
 *  - Que la ventana de purga exige actor y motivo, y se vence sola.
 *  - Que el trigger append-only (3.6(g) y migración 020) SIGUE abortando
 *    fuera de la ventana, y dentro de la ventana solo para el lote.
 *
 * POR QUÉ LOS TRIGGERS SE PRUEBAN EN UNA BD AISLADA
 * -------------------------------------------------
 * La migración 020 lleva `-- @skip-when-env test`, así que en la BD
 * compartida de tests NO se aplica (otros archivos borran eventos entre
 * casos). El comportamiento del trigger se prueba acá contra el ARCHIVO REAL
 * de la migración, en una base de datos aparte, y las tablas que el service
 * necesita se crean en la BD compartida SIN los triggers: si no, un archivo
 * de test que borrara eventos abortaría.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const db = require('../src/db/connection');
const conservacion = require('../src/services/conservacion');
const { resetDb, asegurarTablasPurga, tablaConservacionActivada } = require('./helpers');

// La tabla con la COMPUERTA ABIERTA. La que se despacha viene cerrada: los
// plazos de diez (10) y cinco (5) años no los validó el abogado.
const TABLA_ACTIVADA = tablaConservacionActivada();

const SERVICE = path.resolve(__dirname, '..');
const SQL_020 = fs.readFileSync(
  path.join(SERVICE, 'src', 'db', 'schema', '020_eventos_append_only.sql'),
  'utf8'
);

const EMPRESA = '900123456';
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Crea las tablas de la ventana de purga en la BD compartida, a partir del
 * ARCHIVO REAL de la migración 020, y quita los triggers: en la BD
 * compartida no pueden estar, porque otros archivos de test borran eventos
 * entre casos.
 *
 * La implementación vive en tests/helpers.js (asegurarTablasPurga): la
 * comparten este archivo y el de la 8A.2, para que ninguno dependa del orden
 * en que corran los archivos de test.
 *
 * `gh_firma_holds` viene de la migración 023 (que sí se aplica en test, con
 * ALTER TABLE, que no se puede reejecutar). Se crea acá si falta, con el
 * mismo DDL, para que el test no dependa del orden en que se regeneró la BD.
 */

/**
 * Declara (o no) el plazo de la Empresa, en días.
 * @param {number|null} dias
 */
function declararPlazo(dias) {
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
  db.prepare(`
    INSERT INTO gh_firma_empresas (id_empresa, razon_social, plazo_retencion_dias)
    VALUES (?, 'EMPRESA DE PRUEBA SAS', ?)
  `).run(EMPRESA, dias);
}

/**
 * Inserta una firma con una fecha de conservación concreta.
 * @param {object} opts
 * @param {string|null} opts.fecha_conservacion
 * @param {number} [opts.hold_legal]
 * @param {string} [opts.id_solicitud]
 * @returns {number} el id de la firma
 */
function sembrarFirma(opts = {}) {
  const id = opts.id_solicitud || 'SIGN-2026-' + Math.floor(Math.random() * 900000 + 100000);
  const r = db.prepare(`
    INSERT INTO gh_firmas_electronicas
      (id_solicitud, id_documento, id_trabajador, id_empresa, tipo_firma,
       document_hash_original, agreement_hash, token_hash,
       fecha_creacion, fecha_expiracion, version_kair,
       fecha_conservacion, hold_legal, motivo_hold)
    VALUES (?, 'doc-1', 'psn1_' || substr(hex(randomblob(32)), 1, 64), ?, 'presencial',
            'hash-doc', 'hash-acuerdo', 'hash-token-' || ?,
            datetime('now'), datetime('now'), '0.1.0-test',
            ?, ?, ?)
  `).run(
    id, EMPRESA, id,
    opts.fecha_conservacion === undefined ? null : opts.fecha_conservacion,
    opts.hold_legal || 0,
    opts.motivo_hold || null
  );
  return r.lastInsertRowid;
}

/**
 * Inserta un evento de auditoría para una firma.
 */
function sembrarEvento(firmaId) {
  db.prepare(`
    INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, id_actor)
    VALUES (?, 'CREATED', datetime('now'), 'rh:system')
  `).run(firmaId);
}

test.before(() => {
  asegurarTablasPurga();
});

test.beforeEach(() => {
  // Las tablas de purga se limpian ANTES que resetDb(): el lote tiene FK a
  // gh_firmas_electronicas y borrarla con el lote lleno viola la FK.
  try {
    db.prepare('DELETE FROM gh_firma_purga_lote').run();
    db.prepare('DELETE FROM gh_firma_purga_log').run();
    db.prepare('DELETE FROM gh_firma_purga_registro').run();
    db.prepare('DELETE FROM gh_firma_holds').run();
    db.prepare('DELETE FROM gh_firma_purga_control').run();
  } catch (e) { /* tablas inexistentes */ }
  resetDb();
  asegurarTablasPurga();
});

// =========================================================================
// LA FECHA DE CONSERVACIÓN (8.6)
// =========================================================================

test('sin plazo declarado NO hay fecha de conservación: el sistema no inventa plazos', () => {
  assert.equal(conservacion.calcularFechaConservacion('2026-01-01T00:00:00.000Z', null), null);
  assert.equal(conservacion.calcularFechaConservacion('2026-01-01T00:00:00.000Z', 0), null);
  assert.equal(conservacion.calcularFechaConservacion('2026-01-01T00:00:00.000Z', -5), null);
  assert.equal(conservacion.calcularFechaConservacion('2026-01-01T00:00:00.000Z', 1.5), null);
  assert.equal(conservacion.calcularFechaConservacion(null, 100), null);
});

test('la fecha de conservación es la fecha de creación más el plazo declarado', () => {
  const f = conservacion.calcularFechaConservacion('2026-01-01T00:00:00.000Z', 365);
  assert.equal(f, '2027-01-01T00:00:00.000Z');
});

test('asignar la fecha de conservación la congela en el momento de crear la firma', () => {
  declararPlazo(365);
  const firmaId = sembrarFirma({});
  const fecha = conservacion.asignarFechaConservacion(
    firmaId, EMPRESA, '2026-01-01T00:00:00.000Z'
  );
  assert.equal(fecha, '2027-01-01T00:00:00.000Z');
  const fila = db.prepare(
    'SELECT fecha_conservacion FROM gh_firmas_electronicas WHERE id = ?'
  ).get(firmaId);
  assert.equal(fila.fecha_conservacion, '2027-01-01T00:00:00.000Z');
});

test('sin plazo declarado la firma toma el plazo de la tabla supletoria', () => {
  // Decisión D1: sin plazo declarado por la Empresa, el plazo es el de la
  // tabla supletoria de conservación administrada por K+AIR. La firma NO
  // queda retenida por falta de configuración.
  //
  // La tabla se inyecta con la compuerta ABIERTA: la que se despacha viene
  // cerrada (los plazos de diez (10) y cinco (5) años no los validó el
  // abogado), y el caso cerrado tiene su propio test más abajo.
  declararPlazo(null);
  const firmaId = sembrarFirma({});
  const fecha = conservacion.asignarFechaConservacion(
    firmaId, EMPRESA, '2026-01-01T00:00:00.000Z',
    { tabla_conservacion: TABLA_ACTIVADA }
  );
  assert.equal(fecha, '2035-12-30T00:00:00.000Z',
    'el plazo por defecto de la tabla supletoria (3650 días desde la firma)');
  const fila = db.prepare(
    'SELECT fecha_conservacion, hold_legal, motivo_hold, '
    + 'plazo_conservacion_dias, plazo_conservacion_fuente '
    + 'FROM gh_firmas_electronicas WHERE id = ?'
  ).get(firmaId);
  assert.equal(fila.fecha_conservacion, '2035-12-30T00:00:00.000Z');
  assert.equal(fila.hold_legal, 0, 'y no queda retenida');
  assert.equal(fila.motivo_hold, null);
  assert.equal(fila.plazo_conservacion_fuente, 'tabla_supletoria');
});

test('sin plazo declarado, con la compuerta CERRADA, la firma toma la custodia del catálogo', () => {
  // Es lo que hace en producción mientras la tabla no se active: el plazo
  // por defecto es el de custodia del catálogo (veinte (20) años), que es el
  // que estaba en vigor. La firma tampoco queda retenida por falta de
  // configuración: no hay retención indefinida en ningún caso.
  declararPlazo(null);
  const firmaId = sembrarFirma({});
  const fecha = conservacion.asignarFechaConservacion(
    firmaId, EMPRESA, '2026-01-01T00:00:00.000Z'
  );
  assert.equal(fecha, '2046-01-01T00:00:00.000Z',
    'la custodia del catálogo: veinte (20) años desde la firma');
  const fila = db.prepare(
    'SELECT fecha_conservacion, hold_legal, motivo_hold, '
    + 'plazo_conservacion_dias, plazo_conservacion_fuente '
    + 'FROM gh_firmas_electronicas WHERE id = ?'
  ).get(firmaId);
  assert.equal(fila.hold_legal, 0, 'y no queda retenida');
  assert.equal(fila.motivo_hold, null);
  assert.equal(fila.plazo_conservacion_fuente, 'catalogo_sistema',
    'y la fila dice de dónde salió el plazo');
  assert.equal(fila.plazo_conservacion_dias, 7305);
});

// =========================================================================
// LAS DOS CONDICIONES DEL 8.6
// =========================================================================

test('es elegible solo si venció el plazo Y no hay deber legal de conservación', () => {
  const vencida = new Date(Date.now() - DIA_MS).toISOString();
  const futura = new Date(Date.now() + 10 * DIA_MS).toISOString();

  assert.equal(conservacion.esElegible({ fecha_conservacion: vencida, hold_legal: 0 }), true);
  // Sin plazo declarado.
  assert.equal(conservacion.esElegible({ fecha_conservacion: null, hold_legal: 0 }), false);
  // Plazo vigente.
  assert.equal(conservacion.esElegible({ fecha_conservacion: futura, hold_legal: 0 }), false);
  // Vencida pero con deber legal.
  assert.equal(conservacion.esElegible({ fecha_conservacion: vencida, hold_legal: 1 }), false);
  // MUTACION: si el hold no existiera, esta fila vencida SÍ sería elegible.
  assert.equal(conservacion.esElegible({ fecha_conservacion: vencida, hold_legal: 0 }), true);
});

test('el hold se declara con actor, motivo, alcance y fecha, y se libera con su propio actor', () => {
  const vencida = new Date(Date.now() - DIA_MS).toISOString();
  const firmaId = sembrarFirma({ fecha_conservacion: vencida });
  conservacion.ponerHold(firmaId, {
    actor: 'La Empresa',
    motivo: 'Requerimiento de una autoridad',
    alcance: 'Expediente SIC-2026-114',
  });
  let fila = db.prepare(
    'SELECT hold_legal, motivo_hold, hold_actor, hold_alcance, hold_fecha, hold_liberado_at FROM gh_firmas_electronicas WHERE id = ?'
  ).get(firmaId);
  assert.equal(fila.hold_legal, 1);
  assert.equal(fila.motivo_hold, 'Requerimiento de una autoridad');
  assert.equal(fila.hold_actor, 'La Empresa');
  assert.equal(fila.hold_alcance, 'Expediente SIC-2026-114');
  assert.ok(fila.hold_fecha, 'el hold lleva fecha');
  assert.equal(fila.hold_liberado_at, null);

  // El historial deja la declaración.
  const historial = conservacion.holdsDe(firmaId);
  assert.equal(historial.length, 1);
  assert.equal(historial[0].actor, 'La Empresa');
  assert.equal(historial[0].motivo, 'Requerimiento de una autoridad');
  assert.equal(historial[0].alcance, 'Expediente SIC-2026-114');
  assert.equal(historial[0].activo, 1);

  conservacion.liberarHold(firmaId, { actor: 'La Empresa', motivo: 'Requerimiento archivado' });
  fila = db.prepare(
    'SELECT hold_legal, hold_liberado_at FROM gh_firmas_electronicas WHERE id = ?'
  ).get(firmaId);
  assert.equal(fila.hold_legal, 0);
  assert.ok(fila.hold_liberado_at, 'la liberación queda con fecha');

  // El historial NO se reescribe: queda la declaración y la liberación.
  const historial2 = conservacion.holdsDe(firmaId);
  assert.equal(historial2.length, 1);
  assert.equal(historial2[0].activo, 0);
  assert.equal(historial2[0].liberado_por, 'La Empresa');
  assert.equal(historial2[0].motivo_liberacion, 'Requerimiento archivado');
});

test('el hold NO se puede declarar sin actor o sin motivo', () => {
  const firmaId = sembrarFirma({});
  assert.throws(() => conservacion.ponerHold(firmaId, { motivo: 'x' }), /actor/i);
  assert.throws(() => conservacion.ponerHold(firmaId, { actor: 'x' }), /motivo/i);
});

// =========================================================================
// EL REPORTE
// =========================================================================

test('el reporte separa los cuatro grupos', () => {
  const vencida = new Date(Date.now() - DIA_MS).toISOString();
  const pronto = new Date(Date.now() + 5 * DIA_MS).toISOString();
  const lejos = new Date(Date.now() + 300 * DIA_MS).toISOString();

  const fVencida = sembrarFirma({ fecha_conservacion: vencida, id_solicitud: 'SIGN-2026-000001' });
  const fHold = sembrarFirma({
    fecha_conservacion: vencida, hold_legal: 1, motivo_hold: 'Litigio',
    id_solicitud: 'SIGN-2026-000002',
  });
  const fPronto = sembrarFirma({ fecha_conservacion: pronto, id_solicitud: 'SIGN-2026-000003' });
  sembrarFirma({ fecha_conservacion: lejos, id_solicitud: 'SIGN-2026-000004' });
  sembrarFirma({ fecha_conservacion: null, id_solicitud: 'SIGN-2026-000005' });

  const g = conservacion.vencimientos();
  assert.equal(g.vencidosElegibles.length, 1);
  assert.equal(g.vencidosElegibles[0].id, fVencida);
  assert.equal(g.vencidosEnHold.length, 1);
  assert.equal(g.vencidosEnHold[0].id, fHold);
  assert.equal(g.proximos.length, 1);
  assert.equal(g.proximos[0].id, fPronto);
  assert.equal(g.sinPlazo.length, 1);
  // La que vence en 300 días no está en ningún grupo de los tres primeros:
  // no vence pronto, no venció y sí tiene plazo.
  const ids = g.proximos.concat(g.vencidosElegibles, g.vencidosEnHold).map((f) => f.id);
  assert.equal(ids.includes(fPronto), true);
});

test('MUTACION: si el hold no bloqueara, la firma en hold caería en el grupo elegible', () => {
  const vencida = new Date(Date.now() - DIA_MS).toISOString();
  const fHold = sembrarFirma({
    fecha_conservacion: vencida, hold_legal: 1, motivo_hold: 'Litigio',
  });
  const conHold = conservacion.vencimientos();
  assert.equal(conHold.vencidosElegibles.length, 0);
  assert.equal(conHold.vencidosEnHold.length, 1);

  // Sin el hold, la misma fila es elegible. Esta es la razón de ser del hold.
  db.prepare('UPDATE gh_firmas_electronicas SET hold_legal = 0 WHERE id = ?').run(fHold);
  const sinHold = conservacion.vencimientos();
  assert.equal(sinHold.vencidosElegibles.length, 1);
  assert.equal(sinHold.vencidosEnHold.length, 0);
});

// =========================================================================
// LA VENTANA DE PURGA
// =========================================================================

test('la ventana de purga NO se abre sin actor o sin motivo', () => {
  assert.throws(() => conservacion.abrirVentana({ motivo: 'x' }), /actor/i);
  assert.throws(() => conservacion.abrirVentana({ actor: 'x' }), /motivo/i);
  assert.throws(() => conservacion.abrirVentana({ actor: 'x', motivo: 'y', minutos: 0 }), /minutos/i);
});

test('la ventana abierta se ve, y se cierra', () => {
  const v = conservacion.abrirVentana({ actor: 'operador', motivo: 'tabla de retención', minutos: 10 });
  assert.ok(v.abierta_hasta);
  const vigente = conservacion.ventanaVigente();
  assert.ok(vigente, 'la ventana debe estar vigente');
  assert.equal(vigente.abierta_por, 'operador');

  conservacion.cerrarVentana({ actor: 'operador' });
  assert.equal(conservacion.ventanaVigente(), null);
});

test('una ventana vencida cuenta como ventana cerrada', () => {
  // Se simula una ventana que ya pasó: se escribe a mano en el control.
  db.prepare(`
    INSERT INTO gh_firma_purga_control
      (id, ventana_activa, abierta_at, abierta_hasta, abierta_por, motivo)
    VALUES (1, 1, ?, ?, 'operador', 'ventana vieja')
  `).run(
    new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    new Date(Date.now() - 60 * 60 * 1000).toISOString()
  );
  assert.equal(conservacion.ventanaVigente(), null, 'una ventana vencida no habilita nada');
});

test('el lote NO se puede armar sin ventana abierta', () => {
  const vencida = new Date(Date.now() - DIA_MS).toISOString();
  sembrarFirma({ fecha_conservacion: vencida });
  assert.throws(() => conservacion.armarLote({ actor: 'operador' }), /ventana/i);
});

test('el lote solo mete a las firmas elegibles, y la purga solo toca esas', () => {
  const vencida = new Date(Date.now() - DIA_MS).toISOString();
  const fElegible = sembrarFirma({ fecha_conservacion: vencida, id_solicitud: 'SIGN-2026-000001' });
  const fHold = sembrarFirma({
    fecha_conservacion: vencida, hold_legal: 1, id_solicitud: 'SIGN-2026-000002',
  });
  const fSinPlazo = sembrarFirma({ fecha_conservacion: null, id_solicitud: 'SIGN-2026-000003' });
  sembrarEvento(fElegible);
  sembrarEvento(fHold);
  sembrarEvento(fSinPlazo);

  conservacion.abrirVentana({ actor: 'operador', motivo: 'tabla de retención', minutos: 10 });
  const lote = conservacion.armarLote({ actor: 'operador', motivo: 'tabla de retención' });
  assert.equal(lote.firmas, 1);
  assert.equal(lote.omitidas_hold, 1);
  assert.equal(lote.omitidas_sin_plazo, 1);

  const resultado = conservacion.purgar({ actor: 'operador' });
  assert.equal(resultado.firmas, 1);
  assert.equal(resultado.eventos_purgados, 1);

  const restantes = db.prepare(
    'SELECT firma_id FROM gh_firma_eventos ORDER BY firma_id'
  ).all().map((r) => r.firma_id);
  assert.deepEqual(restantes, [fHold, fSinPlazo].sort((a, b) => a - b));
  assert.equal(restantes.includes(fElegible), false);
});

test('la purga deja rastro en el log, que es append-only', () => {
  const vencida = new Date(Date.now() - DIA_MS).toISOString();
  const f = sembrarFirma({ fecha_conservacion: vencida });
  sembrarEvento(f);

  conservacion.abrirVentana({ actor: 'operador', motivo: 'tabla de retención' });
  conservacion.armarLote({ actor: 'operador', motivo: 'tabla de retención' });
  conservacion.purgar({ actor: 'operador' });

  const eventos = db.prepare(
    'SELECT evento FROM gh_firma_purga_log ORDER BY id'
  ).all().map((r) => r.evento);
  assert.deepEqual(eventos, [
    'VENTANA_ABIERTA', 'LOTE_ARMADO', 'PURGA_EJECUTADA', 'VENTANA_CERRADA',
  ]);
});

test('al cerrar la ventana, el lote se vacía: una ventana siguiente no hereda habilitaciones', () => {
  const vencida = new Date(Date.now() - DIA_MS).toISOString();
  sembrarFirma({ fecha_conservacion: vencida });
  conservacion.abrirVentana({ actor: 'operador', motivo: 'tabla de retención' });
  conservacion.armarLote({ actor: 'operador' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM gh_firma_purga_lote').get().n, 1);

  conservacion.cerrarVentana({ actor: 'operador' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM gh_firma_purga_lote').get().n, 0);
});

// =========================================================================
// EL TRIGGER (3.6(g)) — en una base de datos AISLADA
// =========================================================================

/**
 * Abre una BD aislada con el schema mínimo y aplica el ARCHIVO REAL de la
 * migración 020. Los triggers quedan ahí, con su nombre real.
 *
 * El schema mínimo incluye las columnas que el trigger lee de la firma:
 * `fecha_conservacion` (¿venció el plazo?) y `hold_legal` (¿hay deber legal?).
 */
function abrirBdAislada() {
  const ruta = path.join(
    os.tmpdir(),
    'kair-purga-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.sqlite'
  );
  const bd = new Database(ruta);
  bd.exec(`
    CREATE TABLE gh_firmas_electronicas (
      id INTEGER PRIMARY KEY,
      id_solicitud TEXT,
      fecha_conservacion TEXT,
      hold_legal INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE gh_firma_eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firma_id INTEGER NOT NULL,
      evento TEXT NOT NULL,
      fecha_hora TEXT NOT NULL,
      id_actor TEXT NOT NULL
    );
  `);
  bd.exec(SQL_020);
  return { bd, ruta };
}

/**
 * Inserta una firma en la BD aislada.
 */
function sembrarFirmaAislada(bd, opts = {}) {
  bd.prepare(`
    INSERT INTO gh_firmas_electronicas (id, id_solicitud, fecha_conservacion, hold_legal)
    VALUES (?, ?, ?, ?)
  `).run(
    opts.id || 1,
    opts.id_solicitud || 'SIGN-2026-000001',
    opts.fecha_conservacion === undefined ? null : opts.fecha_conservacion,
    opts.hold_legal || 0
  );
  bd.prepare(
    "INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, id_actor) VALUES (?, 'CREATED', datetime('now'), 'rh:system')"
  ).run(opts.id || 1);
}

/**
 * Abre una ventana de purga en la BD aislada.
 */
function abrirVentanaAislada(bd) {
  bd.prepare(`
    INSERT INTO gh_firma_purga_control
      (id, ventana_activa, abierta_at, abierta_hasta, abierta_por, motivo)
    VALUES (1, 1, datetime('now'), datetime('now', '+1 hour'), 'operador', 'prueba')
  `).run();
}

test('el trigger append-only SIGUE abortando fuera de la ventana', () => {
  const { bd, ruta } = abrirBdAislada();
  try {
    bd.prepare('INSERT INTO gh_firmas_electronicas (id, id_solicitud) VALUES (1, ?)')
      .run('SIGN-2026-000001');
    bd.prepare(
      "INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, id_actor) VALUES (1, 'CREATED', datetime('now'), 'rh:system')"
    ).run();

    assert.throws(
      () => bd.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = 1').run(),
      /append-only/,
      'sin ventana, el DELETE debe abortar'
    );
    assert.throws(
      () => bd.prepare("UPDATE gh_firma_eventos SET evento = 'X' WHERE firma_id = 1").run(),
      /append-only/,
      'sin ventana, el UPDATE debe abortar'
    );
  } finally {
    bd.close();
    try { fs.unlinkSync(ruta); } catch (e) { /* ya no está */ }
  }
});

test('dentro de la ventana pero SIN lote, el trigger sigue abortando', () => {
  const { bd, ruta } = abrirBdAislada();
  try {
    bd.prepare('INSERT INTO gh_firmas_electronicas (id, id_solicitud) VALUES (1, ?)')
      .run('SIGN-2026-000001');
    bd.prepare(
      "INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, id_actor) VALUES (1, 'CREATED', datetime('now'), 'rh:system')"
    ).run();
    // Ventana abierta y vigente, pero lote vacío.
    bd.prepare(`
      INSERT INTO gh_firma_purga_control
        (id, ventana_activa, abierta_at, abierta_hasta, abierta_por, motivo)
      VALUES (1, 1, datetime('now'), datetime('now', '+1 hour'), 'operador', 'prueba')
    `).run();

    assert.throws(
      () => bd.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = 1').run(),
      /append-only/,
      'la ventana sola no habilita: hace falta el lote'
    );
  } finally {
    bd.close();
    try { fs.unlinkSync(ruta); } catch (e) { /* ya no está */ }
  }
});

test('con ventana abierta Y lote, el trigger permite tocar SOLO lo del lote', () => {
  const { bd, ruta } = abrirBdAislada();
  try {
    const vencida = new Date(Date.now() - 86400000).toISOString();
    sembrarFirmaAislada(bd, { id: 1, fecha_conservacion: vencida });
    sembrarFirmaAislada(bd, { id: 2, fecha_conservacion: vencida });
    abrirVentanaAislada(bd);
    // Solo la firma 1 entra al lote.
    bd.prepare(
      "INSERT INTO gh_firma_purga_lote (firma_id, anadida_por, motivo) VALUES (1, 'operador', 'prueba')"
    ).run();

    // La firma del lote sí se puede tocar.
    bd.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = 1').run();
    assert.equal(
      bd.prepare('SELECT COUNT(*) AS n FROM gh_firma_eventos WHERE firma_id = 1').get().n, 0
    );
    // La que NO está en el lote, no.
    assert.throws(
      () => bd.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = 2').run(),
      /append-only/
    );
  } finally {
    bd.close();
    try { fs.unlinkSync(ruta); } catch (e) { /* ya no está */ }
  }
});

test('el lote NO se puede ampliar si no hay ventana abierta', () => {
  const { bd, ruta } = abrirBdAislada();
  try {
    bd.prepare('INSERT INTO gh_firmas_electronicas (id, id_solicitud) VALUES (1, ?)')
      .run('SIGN-2026-000001');
    assert.throws(
      () => bd.prepare(
        "INSERT INTO gh_firma_purga_lote (firma_id, anadida_por, motivo) VALUES (1, 'x', 'y')"
      ).run(),
      /ventana/i
    );
  } finally {
    bd.close();
    try { fs.unlinkSync(ruta); } catch (e) { /* ya no está */ }
  }
});

test('una ventana vencida NO habilita el lote', () => {
  const { bd, ruta } = abrirBdAislada();
  try {
    bd.prepare('INSERT INTO gh_firmas_electronicas (id, id_solicitud) VALUES (1, ?)')
      .run('SIGN-2026-000001');
    bd.prepare(`
      INSERT INTO gh_firma_purga_control
        (id, ventana_activa, abierta_at, abierta_hasta, abierta_por, motivo)
      VALUES (1, 1, datetime('now', '-2 hours'), datetime('now', '-1 hour'), 'operador', 'prueba')
    `).run();
    assert.throws(
      () => bd.prepare(
        "INSERT INTO gh_firma_purga_lote (firma_id, anadida_por, motivo) VALUES (1, 'x', 'y')"
      ).run(),
      /ventana/i
    );
  } finally {
    bd.close();
    try { fs.unlinkSync(ruta); } catch (e) { /* ya no está */ }
  }
});

test('el log de purgas es append-only: si la supresión borrara su rastro, no habría prueba', () => {
  const { bd, ruta } = abrirBdAislada();
  try {
    bd.prepare(
      "INSERT INTO gh_firma_purga_log (evento, actor, motivo) VALUES ('VENTANA_ABIERTA', 'operador', 'prueba')"
    ).run();
    assert.throws(
      () => bd.prepare("UPDATE gh_firma_purga_log SET evento = 'X'").run(),
      /append-only/
    );
    assert.throws(
      () => bd.prepare('DELETE FROM gh_firma_purga_log').run(),
      /append-only/
    );
    const total = bd.prepare('SELECT COUNT(*) AS n FROM gh_firma_purga_log').get().n;
    assert.equal(total, 1, 'el registro de la ventana sigue ahí');
  } finally {
    bd.close();
    try { fs.unlinkSync(ruta); } catch (e) { /* ya no está */ }
  }
});

// =========================================================================
// LA QUINTA CONDICIÓN: el deber legal de conservación (hold)
// =========================================================================

test('la base de datos se niega a suprimir una firma con hold activo, aunque haya ventana y lote', () => {
  const { bd, ruta } = abrirBdAislada();
  try {
    // Vencida (para que el plazo no la detenga) pero CON hold.
    sembrarFirmaAislada(bd, {
      id: 1,
      fecha_conservacion: new Date(Date.now() - 86400000).toISOString(),
      hold_legal: 1,
    });
    abrirVentanaAislada(bd);
    bd.prepare(
      "INSERT INTO gh_firma_purga_lote (firma_id, anadida_por, motivo) VALUES (1, 'operador', 'prueba')"
    ).run();

    // Con ventana y lote, la única que falta es el hold: la base se niega.
    assert.throws(
      () => bd.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = 1').run(),
      /deber legal/,
      'con hold activo, la base de datos no puede suprimir la firma'
    );
    assert.throws(
      () => bd.prepare("UPDATE gh_firma_eventos SET evento = 'X' WHERE firma_id = 1").run(),
      /deber legal/
    );
    // Y el evento sigue ahí.
    assert.equal(
      bd.prepare('SELECT COUNT(*) AS n FROM gh_firma_eventos WHERE firma_id = 1').get().n, 1
    );
  } finally {
    bd.close();
    try { fs.unlinkSync(ruta); } catch (e) { /* ya no está */ }
  }
});

test('MUTACION: sin el hold, esa misma firma sí se suprime (el hold es lo que la frena)', () => {
  const { bd, ruta } = abrirBdAislada();
  try {
    sembrarFirmaAislada(bd, {
      id: 1,
      fecha_conservacion: new Date(Date.now() - 86400000).toISOString(),
      hold_legal: 0,
    });
    abrirVentanaAislada(bd);
    bd.prepare(
      "INSERT INTO gh_firma_purga_lote (firma_id, anadida_por, motivo) VALUES (1, 'operador', 'prueba')"
    ).run();
    bd.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = 1').run();
    assert.equal(
      bd.prepare('SELECT COUNT(*) AS n FROM gh_firma_eventos WHERE firma_id = 1').get().n, 0
    );
  } finally {
    bd.close();
    try { fs.unlinkSync(ruta); } catch (e) { /* ya no está */ }
  }
});

test('la base de datos no suprime una firma cuyo plazo todavía no venció', () => {
  const { bd, ruta } = abrirBdAislada();
  try {
    sembrarFirmaAislada(bd, {
      id: 1,
      fecha_conservacion: new Date(Date.now() + 86400000).toISOString(),
      hold_legal: 0,
    });
    abrirVentanaAislada(bd);
    bd.prepare(
      "INSERT INTO gh_firma_purga_lote (firma_id, anadida_por, motivo) VALUES (1, 'operador', 'prueba')"
    ).run();
    assert.throws(
      () => bd.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = 1').run(),
      /plazo de conservacion/,
      'no se puede suprimir antes de que venza el plazo'
    );
  } finally {
    bd.close();
    try { fs.unlinkSync(ruta); } catch (e) { /* ya no está */ }
  }
});

test('la base de datos no suprime una firma sin plazo declarado', () => {
  const { bd, ruta } = abrirBdAislada();
  try {
    sembrarFirmaAislada(bd, { id: 1, fecha_conservacion: null, hold_legal: 0 });
    abrirVentanaAislada(bd);
    bd.prepare(
      "INSERT INTO gh_firma_purga_lote (firma_id, anadida_por, motivo) VALUES (1, 'operador', 'prueba')"
    ).run();
    assert.throws(
      () => bd.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = 1').run(),
      /plazo de conservacion/
    );
  } finally {
    bd.close();
    try { fs.unlinkSync(ruta); } catch (e) { /* ya no está */ }
  }
});

test('el recibo de purga es append-only y no lleva datos personales', () => {
  const { bd, ruta } = abrirBdAislada();
  try {
    bd.prepare(`
      INSERT INTO gh_firma_purga_registro
        (firma_id, id_empresa, actor, motivo, categorias, hold_verificado)
      VALUES (1, '900123456', 'operador', 'tabla de retencion', 'eventos_auditoria', 1)
    `).run();
    assert.throws(
      () => bd.prepare("UPDATE gh_firma_purga_registro SET actor = 'X'").run(),
      /append-only/
    );
    assert.throws(
      () => bd.prepare('DELETE FROM gh_firma_purga_registro').run(),
      /append-only/
    );
  } finally {
    bd.close();
    try { fs.unlinkSync(ruta); } catch (e) { /* ya no está */ }
  }
});

// =========================================================================
// EL RECIBO POR FIRMA (la prueba de cumplimiento)
// =========================================================================

test('cada firma purgada deja su recibo: qué firma, qué empresa, cuándo, quién, por qué y el chequeo de hold', () => {
  const vencida = new Date(Date.now() - DIA_MS).toISOString();
  const f = sembrarFirma({ fecha_conservacion: vencida, id_solicitud: 'SIGN-2026-000001' });
  sembrarEvento(f);

  conservacion.abrirVentana({ actor: 'operador', motivo: 'tabla de retención' });
  conservacion.armarLote({ actor: 'operador', motivo: 'tabla de retención' });
  const r = conservacion.purgar({ actor: 'operador' });
  assert.equal(r.firmas, 1);
  assert.equal(r.eventos_purgados, 1);

  const recibo = db.prepare(
    'SELECT * FROM gh_firma_purga_registro WHERE firma_id = ?'
  ).get(f);
  assert.ok(recibo, 'debe existir el recibo de la firma purgada');
  assert.equal(recibo.id_empresa, EMPRESA);
  assert.equal(recibo.actor, 'operador');
  assert.equal(recibo.motivo, 'tabla de retención');
  assert.equal(recibo.categorias, 'eventos_auditoria');
  assert.equal(recibo.hold_verificado, 1);
  assert.equal(recibo.eventos_purgados, 1);
  assert.ok(recibo.purgado_at, 'el recibo lleva fecha');
  assert.ok(recibo.ventana_hasta, 'el recibo lleva la ventana');

  // El recibo NO lleva datos personales: ni correo, ni huella, ni documento.
  const columnas = db.prepare('PRAGMA table_info(gh_firma_purga_registro)').all()
    .map((c) => c.name);
  for (const prohibida of ['correo', 'correo_hash', 'identificacion', 'manifestacion', 'ip', 'user_agent', 'nombre']) {
    assert.equal(
      columnas.some((c) => c.toLowerCase().includes(prohibida)),
      false,
      'el recibo no debe tener la columna ' + prohibida
    );
  }
});

test('el log de purgas registra el conteo del chequeo de hold', () => {
  const vencida = new Date(Date.now() - DIA_MS).toISOString();
  sembrarFirma({ fecha_conservacion: vencida, id_solicitud: 'SIGN-2026-000001' });
  const fHold = sembrarFirma({
    fecha_conservacion: vencida, hold_legal: 1, id_solicitud: 'SIGN-2026-000002',
  });
  // El hold se declara por la vía nueva, con actor y motivo.
  conservacion.ponerHold(fHold, { actor: 'La Empresa', motivo: 'Reclamación' });

  conservacion.abrirVentana({ actor: 'operador', motivo: 'tabla de retención' });
  const lote = conservacion.armarLote({ actor: 'operador' });
  assert.equal(lote.omitidas_hold, 1);

  const entrada = db.prepare(
    "SELECT hold_revisados, hold_bloqueados FROM gh_firma_purga_log WHERE evento = 'LOTE_ARMADO'"
  ).get();
  assert.equal(entrada.hold_revisados, 2, 'se revisaron las dos firmas vencidas');
  assert.equal(entrada.hold_bloqueados, 1, 'una quedó afuera por el hold');
});

test('una firma con hold activo NO entra al lote ni se purga', () => {
  const vencida = new Date(Date.now() - DIA_MS).toISOString();
  const fHold = sembrarFirma({ fecha_conservacion: vencida, id_solicitud: 'SIGN-2026-000001' });
  sembrarEvento(fHold);
  conservacion.ponerHold(fHold, { actor: 'La Empresa', motivo: 'Reclamación' });

  conservacion.abrirVentana({ actor: 'operador', motivo: 'tabla de retención' });
  const lote = conservacion.armarLote({ actor: 'operador' });
  assert.equal(lote.firmas, 0);

  const r = conservacion.purgar({ actor: 'operador' });
  assert.equal(r.firmas, 0);
  assert.equal(r.eventos_purgados, 0);
  // El evento sigue ahí: la prueba de la firma en discusión no se destruye.
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM gh_firma_eventos WHERE firma_id = ?').get(fHold).n, 1
  );
  // Y no hay recibo de purga para esa firma.
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM gh_firma_purga_registro WHERE firma_id = ?').get(fHold).n, 0
  );
});

// =========================================================================
// EL 8.6(h): SIN PLAZO DECLARADO NO SE SUPRIME, SE RETIENE Y SE REPORTA
// =========================================================================
//
// La RETENCIÓN POR PLAZO NO DECLARADO, después de la decisión D1.
//
// El numeral 8.6(h) del Acuerdo v1.2 decía: "Si la Empresa no declara un
// plazo para una categoría documental, el registro no se suprime: el sistema lo
// retiene con un hold por plazo no declarado, deja constancia del pendiente y
// lo reporta a la Empresa".
//
// La decisión D1 del abogado (30-oct-2026) elimina esa retención INDEFINIDA:
// a falta de plazo declarado se aplica el plazo por defecto de la TABLA
// SUPLETORIA de conservación administrada por K+AIR. El hold por plazo no
// declarado NO se pone en el alta de una firma.
//
// Su maquinaria, en cambio, SIGUE VIVA: en las bases ya hay filas con ese
// hold (en producción y en los tests), y tienen que poder salir por el
// recálculo. Estos tests comprueban las dos cosas: que el alta ya no lo pone,
// y que la liberación y el reporte siguen funcionando.
//

test('sin plazo declarado la firma NO queda retenida: el plazo es el de la tabla', () => {
  declararPlazo(null);
  const firmaId = sembrarFirma({});
  const fecha = conservacion.asignarFechaConservacion(
    firmaId, EMPRESA, '2026-01-01T00:00:00.000Z'
  );

  assert.ok(fecha, 'sin plazo declarado hay fecha: la aporta la tabla supletoria');
  const fila = db.prepare(
    'SELECT fecha_conservacion, hold_legal, motivo_hold, hold_actor, hold_alcance FROM gh_firmas_electronicas WHERE id = ?'
  ).get(firmaId);
  assert.equal(fila.hold_legal, 0, 'y la firma NO queda retenida');
  assert.equal(fila.motivo_hold, null);
  assert.equal(conservacion.holdsDe(firmaId).length, 0);
});

test('el hold por plazo no declarado sigue disponible para las filas que ya lo tienen', () => {
  // Es lo que hay en las bases existentes: filas retenidas por el mecanismo
  // viejo. La función no se borra (las tiene que liberar), y es idempotente.
  declararPlazo(null);
  const firmaId = sembrarFirma({});
  const primero = conservacion.retenerPorPlazoNoDeclarado(firmaId, { actor: 'sistema' });
  const segundo = conservacion.retenerPorPlazoNoDeclarado(firmaId, { actor: 'sistema' });

  assert.equal(primero.ya_retenida, false, 'la primera vez sí la retiene');
  assert.equal(segundo.ya_retenida, true);
  assert.equal(conservacion.holdsDe(firmaId).length, 1, 'una sola fila en el historial');

  const fila = db.prepare(
    'SELECT motivo_hold, hold_actor FROM gh_firmas_electronicas WHERE id = ?'
  ).get(firmaId);
  assert.equal(fila.motivo_hold, 'plazo_no_declarado');
  assert.equal(fila.hold_actor, 'sistema');
});

test('el hold por plazo no declarado es DISTINTO del hold por deber legal', () => {
  // El deber legal: su motivo es la norma que obliga a conservar.
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, plazo_retencion_dias, conservacion_por_deber_legal, norma_conservacion)
    VALUES (?, 'EMPRESA DE PRUEBA SAS', NULL, 1, '2.2.1.1.12 del Decreto 1072 de 2015')
  `).run(EMPRESA);
  const conDeber = sembrarFirma({ id_solicitud: 'SIGN-2026-000010' });
  conservacion.asignarFechaConservacion(conDeber, EMPRESA, '2026-01-01T00:00:00.000Z');

  // El plazo no declarado: su motivo es el pendiente (fila legacy).
  declararPlazo(null);
  const sinPlazo = sembrarFirma({ id_solicitud: 'SIGN-2026-000011' });
  conservacion.retenerPorPlazoNoDeclarado(sinPlazo, { actor: 'sistema' });

  const motivoDeber = db.prepare(
    'SELECT motivo_hold FROM gh_firmas_electronicas WHERE id = ?'
  ).get(conDeber).motivo_hold;
  const motivoPendiente = db.prepare(
    'SELECT motivo_hold FROM gh_firmas_electronicas WHERE id = ?'
  ).get(sinPlazo).motivo_hold;

  assert.notEqual(motivoDeber, motivoPendiente, 'son dos razones distintas');
  assert.ok(motivoDeber.startsWith('deber_legal_'));
  assert.equal(motivoPendiente, 'plazo_no_declarado');
});

test('una firma retenida por plazo no declarado NO es elegible y el reporte la nombra', () => {
  declararPlazo(null);
  const firmaId = sembrarFirma({ id_solicitud: 'SIGN-2026-000012' });
  // Se simula la fila legacy: retenida por el mecanismo viejo.
  conservacion.retenerPorPlazoNoDeclarado(firmaId, { actor: 'sistema' });

  const fila = db.prepare(
    'SELECT id, id_empresa, fecha_conservacion, hold_legal FROM gh_firmas_electronicas WHERE id = ?'
  ).get(firmaId);
  assert.equal(conservacion.esElegible(fila), false, 'no se suprime');

  const reporte = conservacion.reportePlazoPendiente({ id_empresa: EMPRESA });
  assert.equal(reporte.total, 1);
  assert.equal(reporte.pendientes[0].id, firmaId);
  assert.equal(reporte.pendientes[0].retenida, true);
  assert.equal(reporte.pendientes[0].motivo_retencion, 'plazo_no_declarado');
  assert.ok(
    reporte.pendientes[0].plazo_pendiente.includes('no declarado'),
    'el reporte nombra el plazo pendiente'
  );
  assert.ok(reporte.mensaje.includes('8.6(h)'));

  // Y el reporte de vencimientos lo mete en el grupo "sin plazo", nombrado.
  const grupos = conservacion.vencimientos({ id_empresa: EMPRESA });
  assert.equal(grupos.sinPlazo.length, 1);
  assert.equal(grupos.sinPlazo[0].plazo_pendiente, true);
  assert.equal(grupos.sinPlazo[0].motivo_retencion, 'plazo_no_declarado');
});

test('un plan de retención sin fecha NO retiene por plazo no declarado', () => {
  // Última defensa: un plan sin fecha (una tabla supletoria sin plazo
  // computable). La firma queda SIN fecha: nunca se suprime, y no se le
  // inventa un motivo de retención que ya no existe.
  const firmaId = sembrarFirma({});
  const plan = {
    categoria: 'tabla_empresa',
    regla: 'TABLA_EMPRESA',
    base: 'creacion',
    anios: 20,
    fecha_conservacion: null,
    texto: null,
    hold: null,
    aviso: 'RETAIN_SIN_PLAZO',
  };
  const fecha = conservacion.aplicarPlanRetencion(firmaId, plan);

  assert.equal(fecha, null);
  const fila = db.prepare(
    'SELECT hold_legal, motivo_hold, fecha_conservacion FROM gh_firmas_electronicas WHERE id = ?'
  ).get(firmaId);
  assert.equal(fila.hold_legal, 0,
    'un plan sin fecha NO retiene por plazo no declarado: ese motivo ya no existe');
  assert.equal(fila.motivo_hold, null);
  assert.equal(fila.fecha_conservacion, null,
    'y sin fecha no hay supresión: el registro nunca se suprime');
});

test('un plan CON fecha no levanta el hold por plazo no declarado', () => {
  const firmaId = sembrarFirma({});
  const fecha = new Date(Date.now() + 365 * DIA_MS).toISOString();
  conservacion.aplicarPlanRetencion(firmaId, {
    categoria: 'tabla_empresa',
    regla: 'TABLA_EMPRESA',
    fecha_conservacion: fecha,
    hold: null,
    aviso: 'RETAIN_FECHA',
  });

  const fila = db.prepare(
    'SELECT hold_legal, motivo_hold FROM gh_firmas_electronicas WHERE id = ?'
  ).get(firmaId);
  assert.equal(fila.hold_legal, 0, 'con plazo no hay hold');
});

test('la liberación del hold por plazo no declarado ocurre cuando la Empresa declara el plazo', () => {
  // La fila legacy: retenida por el mecanismo viejo, sin fecha.
  declararPlazo(null);
  const firmaId = sembrarFirma({});
  conservacion.retenerPorPlazoNoDeclarado(firmaId, { actor: 'sistema' });

  const r = conservacion.liberarHoldPorPlazoNoDeclarado(firmaId, {
    actor: 'La Empresa',
    motivo: 'Declaró el plazo de conservación documental',
  });
  assert.equal(r.liberado, true);

  const fila = db.prepare(
    'SELECT hold_legal, hold_liberado_at FROM gh_firmas_electronicas WHERE id = ?'
  ).get(firmaId);
  assert.equal(fila.hold_legal, 0);
  assert.ok(fila.hold_liberado_at, 'la liberación queda con fecha');

  // La declaración original no se reescribe: queda el historial.
  const holds = conservacion.holdsDe(firmaId);
  assert.equal(holds.length, 1);
  assert.equal(holds[0].activo, 0);
  assert.equal(holds[0].liberado_por, 'La Empresa');
});

test('al declarar la Empresa el plazo, la liberación deja la firma con fecha de conservación', () => {
  // Sin fecha no hay supresión: soltar el hold sin fecha dejaría la firma
  // retenida ya no, pero tampoco suprimible, y sin registro de por qué.
  declararPlazo(null);
  const firmaId = sembrarFirma({});
  conservacion.retenerPorPlazoNoDeclarado(firmaId, { actor: 'sistema' });
  assert.equal(
    db.prepare('SELECT fecha_conservacion FROM gh_firmas_electronicas WHERE id = ?').get(firmaId).fecha_conservacion,
    null
  );

  const r = conservacion.liberarHoldPorPlazoNoDeclarado(firmaId, {
    actor: 'La Empresa',
    motivo: 'Declaró el plazo de conservación documental',
    plazo_declarado_dias: 365,
    punto_inicio: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.liberado, true);
  assert.equal(r.fecha_conservacion, '2027-01-01T00:00:00.000Z');

  const fila = db.prepare(
    'SELECT fecha_conservacion, hold_legal FROM gh_firmas_electronicas WHERE id = ?'
  ).get(firmaId);
  assert.equal(fila.hold_legal, 0);
  assert.equal(fila.fecha_conservacion, '2027-01-01T00:00:00.000Z');
});

test('la liberación por plazo declarado NO levanta un hold por deber legal', () => {
  const firmaId = sembrarFirma({});
  conservacion.ponerHold(firmaId, {
    actor: 'La Empresa',
    motivo: 'deber_legal_2.2.1.1.12 del Decreto 1072 de 2015',
    alcance: '2.2.1.1.12',
  });

  assert.throws(
    () => conservacion.liberarHoldPorPlazoNoDeclarado(firmaId, { actor: 'La Empresa' }),
    /no es por plazo no declarado/,
    'el deber legal no se levanta porque la Empresa haya declarado un plazo'
  );
  const fila = db.prepare('SELECT hold_legal FROM gh_firmas_electronicas WHERE id = ?').get(firmaId);
  assert.equal(fila.hold_legal, 1, 'el hold sigue vigente');
});

test('retenerPendientesDePlazo pone en regla lo que ya está en la base', () => {
  declararPlazo(null);
  const f1 = sembrarFirma({ id_solicitud: 'SIGN-2026-000020' });
  const f2 = sembrarFirma({ id_solicitud: 'SIGN-2026-000021' });
  // Una ya retenida, otra no: el hold se pone solo donde falta.
  conservacion.retenerPorPlazoNoDeclarado(f1, { actor: 'sistema' });

  const r = conservacion.retenerPendientesDePlazo({ id_empresa: EMPRESA, actor: 'sistema' });
  assert.equal(r.revisados, 2);
  assert.equal(r.retenidas, 1);
  assert.equal(r.ya_retenidas, 1);

  assert.equal(
    db.prepare('SELECT hold_legal FROM gh_firmas_electronicas WHERE id = ?').get(f2).hold_legal, 1
  );
});

test('MUTACION: la fila sin plazo declarado ya no depende de un hold para no suprimirse', () => {
  // La fila con fecha vencida y SIN hold ES elegible: eso es lo que el hold
  // impide. Si `retenerPorPlazoNoDeclarado` no hiciera nada, el test de
  // "queda retenida" fallaría en hold_legal === 1.
  const vencida = new Date(Date.now() - DIA_MS).toISOString();
  const conFecha = sembrarFirma({ fecha_conservacion: vencida, id_solicitud: 'SIGN-2026-000030' });
  const fila = db.prepare(
    'SELECT id, id_empresa, fecha_conservacion, hold_legal FROM gh_firmas_electronicas WHERE id = ?'
  ).get(conFecha);
  assert.equal(conservacion.esElegible(fila), true, 'sin hold, la firma vencida SÍ se suprime');

  // Sin plazo declarado ya no hay hold: la fila no se suprime porque su plazo
  // (el de la tabla supletoria) NO ha vencido.
  declararPlazo(null);
  const sinPlazo = sembrarFirma({ id_solicitud: 'SIGN-2026-000031' });
  const fecha = conservacion.asignarFechaConservacion(
    sinPlazo, EMPRESA, '2026-01-01T00:00:00.000Z'
  );
  assert.ok(fecha, 'sin plazo declarado hay fecha: la aporta la tabla supletoria');
  const fila2 = db.prepare(
    'SELECT id, id_empresa, fecha_conservacion, hold_legal FROM gh_firmas_electronicas WHERE id = ?'
  ).get(sinPlazo);
  assert.equal(fila2.hold_legal, 0, 'y no hay hold: ese motivo ya no existe');
  assert.equal(conservacion.esElegible(fila2), false, 'NO se suprime: el plazo no ha vencido');
});
