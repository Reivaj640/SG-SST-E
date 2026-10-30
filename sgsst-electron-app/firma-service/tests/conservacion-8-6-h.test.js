/**
 * LA CONSERVACIÓN CUANDO LA EMPRESA NO DECLARA PLAZO (decisión D1).
 *
 * Ejecutar: node --test --require ./tests/setup.js tests/conservacion-8-6-h.test.js
 *
 * QUÉ SE PRUEBA
 * -------------
 *  - Que SIN plazo declarado por la Empresa HAY fecha de conservación: la
 *    aporta la TABLA SUPLETORIA de conservación administrada por K+AIR
 *    (config/tabla-conservacion.json). Ningún registro queda retenido
 *    indefinidamente por falta de configuración.
 *  - Que el texto que se le comunica al Trabajador (el 8.6(g)) dice el plazo
 *    que se aplica y DE DÓNDE VIENE: no promete un plazo que el sistema no
 *    tiene, y no oculta que el plazo es del del sistema.
 *  - Que la EXCEPCIÓN del 8.6(b) sigue viva: los documentos del SG-SST se
 *    conservan veinte (20) años contados desde el cese, aunque la Empresa no
 *    declare un plazo, porque ese plazo lo fija la ley.
 *  - Que el contrato electrónico sigue con su hold sin término.
 *  - Que la maquinaria de liberación del hold viejo (plazo no declarado) SIGUE
 *    FUNCIONANDO: las filas que ya lo tienen en las bases existentes se
 *    liberan y toman el plazo que resulta aplicable.
 *  - Que un hold de OTRO motivo (deber legal) NO se levanta por recalcular:
 *    son protecciones distintas.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE
 * ---------------------------
 * El 8.6(h) del Acuerdo v1.2 ordenaba retener con un hold por plazo no
 * declarado, y el sistema lo cumplía. La decisión D1 del abogado (30-oct-2026)
 * elimina la retención indefinida: "no vamos a permitir que los documentos se
 * acumulen permanentemente porque una Empresa no configuro su tabla". El plazo
 * por defecto sale ahora de la tabla supletoria de K+AIR.
 *
 * El hold por plazo no declarado NO se pone en el alta de una firma, pero su
 * maquinaria de liberación queda VIVA: en las bases ya hay filas con ese hold
 * (en producción y en los tests), y tienen que poder salir.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/db/connection');
const retencion = require('../src/services/retencion');
const conservacion = require('../src/services/conservacion');
const empresaService = require('../src/services/empresa');
const { resetDb, asegurarTablasPurga, tablaConservacionActivada } = require('./helpers');

const EMPRESA = '900123456';
const DIA_MS = 24 * 60 * 60 * 1000;
const MOTIVO_PLAZO = 'plazo_no_declarado';

// El plazo por defecto de la tabla supletoria para DOCUMENTO_FIRMADO.
const DIAS_TABLA = 3650;
const FIRMA_BASE = '2026-01-15T10:00:00.000Z';
const FECHA_TABLA = new Date(
  new Date(FIRMA_BASE).getTime() + DIAS_TABLA * DIA_MS
).toISOString();

// La tabla con la COMPUERTA ABIERTA. La que se despacha viene cerrada (los
// plazos de diez (10) y cinco (5) años no los validó el abogado), y estos
// tests verifican el MECANISMO de la tabla: que su plazo por defecto sea el
// que aplica, con su fuente y su punto de inicio.
const TABLA_ACTIVADA = tablaConservacionActivada();

/**
 * Crea (o recrea) la Empresa con el plazo que se le pase.
 * @param {number|null} dias
 */
function sembrarEmpresa(dias) {
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
  db.prepare(`
    INSERT INTO gh_firma_empresas (id_empresa, razon_social, plazo_retencion_dias)
    VALUES (?, 'EMPRESA DE PRUEBA SAS', ?)
  `).run(EMPRESA, dias);
}

/**
 * Inserta una firma.
 * @param {object} opts
 * @param {string} opts.categoria - la categoría del catálogo de retención
 * @param {string} [opts.regla]
 * @param {string} [opts.fecha_creacion]
 * @param {string|null} [opts.fecha_terminacion]
 * @returns {number} el id de la firma
 */
function sembrarFirma(opts = {}) {
  const id = 'SIGN-2026-' + Math.floor(Math.random() * 900000 + 100000);
  const r = db.prepare(`
    INSERT INTO gh_firmas_electronicas
      (id_solicitud, id_documento, id_trabajador, id_empresa, tipo_firma,
       document_hash_original, agreement_hash, token_hash,
       fecha_creacion, fecha_expiracion, version_kair,
       categoria_retencion, regla_retencion, fecha_terminacion)
    VALUES (?, 'doc-1', 'psn1_' || substr(hex(randomblob(32)), 1, 64), ?, 'presencial',
            'hash-doc', 'hash-acuerdo', 'hash-token-' || ?,
            ?, datetime('now'), '0.1.0-test',
            ?, ?, ?)
  `).run(
    id, EMPRESA, id,
    opts.fecha_creacion || FIRMA_BASE,
    opts.categoria || null,
    opts.regla || null,
    opts.fecha_terminacion || null
  );
  return r.lastInsertRowid;
}

const fila = (id) => db.prepare(
  'SELECT fecha_conservacion, hold_legal, motivo_hold, '
  + 'plazo_conservacion_dias, plazo_conservacion_fuente, '
  + 'fecha_inicio_conservacion, categoria_conservacion '
  + 'FROM gh_firmas_electronicas WHERE id = ?'
).get(id);

const holdsActivos = (id) => db.prepare(
  'SELECT * FROM gh_firma_holds WHERE firma_id = ? AND activo = 1'
).all(id);

test.before(() => {
  asegurarTablasPurga();
});

test.beforeEach(() => {
  resetDb();
});

// ─────────────────────────────────────────────────────────────────────────────
// EL CÁLCULO: sin plazo declarado HAY fecha, y la fuente se registra.
// ─────────────────────────────────────────────────────────────────────────────

test('D1: sin plazo declarado, la tabla supletoria aporta la fecha de conservacion', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: { plazo_retencion_dias: null, plazo_retencion: null },
    tabla_conservacion: TABLA_ACTIVADA,
  });

  assert.equal(plan.fecha_conservacion, FECHA_TABLA,
    'la tabla supletoria aporta el plazo: nunca hay fecha nula por falta de plazo');
  assert.equal(plan.aviso, 'RETAIN_FECHA');
  assert.equal(plan.hold, null, 'no hay hold: la ausencia de plazo ya no retiene');
  assert.equal(plan.plazo_conservacion_dias, DIAS_TABLA);
  assert.equal(plan.plazo_conservacion_fuente, 'tabla_supletoria');
  assert.equal(plan.categoria_conservacion, 'DOCUMENTO_FIRMADO');
  assert.equal(plan.fecha_inicio_conservacion, FIRMA_BASE);
});

test('D1: el texto que se le comunica al Trabajador dice el plazo y de donde viene', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: { plazo_retencion_dias: null, plazo_retencion: null },
    tabla_conservacion: TABLA_ACTIVADA,
  });

  assert.ok(/10 años/.test(plan.texto), 'el texto dice el plazo que se aplica');
  assert.ok(/3650 días/.test(plan.texto), 'y dice exactamente cuántos días son');
  assert.ok(/tabla de conservación del sistema/.test(plan.texto),
    'y dice de dónde viene: el plazo es del sistema');
  assert.ok(!/pendiente de declaración/.test(plan.texto),
    'el plazo ya no está pendiente: hay una tabla supletoria');
  assert.ok(!/veinte \(20\) años/.test(plan.texto),
    'y no promete la custodia de veinte años que ya no aplica');
});

test('D1: con plazo declarado, la fecha es la que declaró la Empresa', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: { plazo_retencion_dias: 365, plazo_retencion: 'Un (1) año' },
  });

  assert.ok(plan.fecha_conservacion, 'con plazo declarado hay fecha');
  assert.equal(plan.aviso, 'RETAIN_FECHA');
  assert.equal(
    new Date(plan.fecha_conservacion).getTime(),
    new Date(FIRMA_BASE).getTime() + 365 * DIA_MS
  );
  assert.equal(plan.texto, 'Un (1) año', 'manda el texto que declaró la Empresa');
  assert.equal(plan.plazo_conservacion_dias, 365);
  assert.equal(plan.plazo_conservacion_fuente, 'empresa',
    'la fuente registrada es la tabla de la Empresa');
});

test('D1: el alta NO pone un hold por plazo no declarado', () => {
  // El camino de alta es `aplicarPlanRetencion`: el hold por plazo no
  // declarado ya no se pone. Sin plazo declarado hay fecha (la de la tabla
  // supletoria) y no hay retención.
  sembrarEmpresa(null);
  const firmaId = sembrarFirma({ categoria: 'TABLA_EMPRESA', regla: 'TABLA_EMPRESA' });

  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    regla_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: { plazo_retencion_dias: null, plazo_retencion: null },
    tabla_conservacion: TABLA_ACTIVADA,
  });
  conservacion.aplicarPlanRetencion(firmaId, plan);

  const despues = fila(firmaId);
  assert.equal(despues.fecha_conservacion, FECHA_TABLA);
  assert.equal(despues.hold_legal, 0, 'no hay hold por plazo no declarado');
  assert.equal(despues.motivo_hold, null);
  assert.equal(holdsActivos(firmaId).length, 0);
  assert.equal(despues.plazo_conservacion_fuente, 'tabla_supletoria');
  assert.equal(despues.plazo_conservacion_dias, DIAS_TABLA);
  assert.equal(despues.fecha_inicio_conservacion, FIRMA_BASE);
  assert.equal(despues.categoria_conservacion, 'DOCUMENTO_FIRMADO');
});

// ─────────────────────────────────────────────────────────────────────────────
// LA EXCEPCIÓN DEL 8.6(b): los documentos del SG-SST tienen plazo propio.
// ─────────────────────────────────────────────────────────────────────────────

test('8.6(b): los documentos del SG-SST conservan 20 años aunque la Empresa no declare', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: FIRMA_BASE,
    empresa: { plazo_retencion_dias: null, plazo_retencion: null },
  });

  assert.ok(plan.fecha_conservacion,
    'el 8.6(b) fija el plazo de los grupos SST: no depende de que la Empresa declare');
  assert.equal(plan.aviso, 'RETAIN_FECHA');
  assert.equal(plan.plazo_conservacion_fuente, 'piso_legal');
  assert.equal(plan.plazo_conservacion_dias, 7305);
  assert.equal(plan.categoria_conservacion, 'SST_ESPECIAL');
});

test('8.6(b): el plazo de la Empresa NO puede bajar el piso legal', () => {
  const sinPiso = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: FIRMA_BASE,
    empresa: { plazo_retencion_dias: null, plazo_retencion: null },
  });
  const conPiso = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: FIRMA_BASE,
    empresa: { plazo_retencion_dias: 365, plazo_retencion: 'Un (1) año' },
  });

  assert.equal(conPiso.fecha_conservacion, sinPiso.fecha_conservacion,
    'un plazo de un año no baja el mínimo legal de veinte');
  assert.equal(conPiso.plazo_conservacion_fuente, 'piso_legal');
});

test('8.6(b): con fecha de cese conocida, el plazo se cuenta desde el cese', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: FIRMA_BASE,
    fecha_terminacion: '2027-06-30T10:00:00.000Z',
    empresa: { plazo_retencion_dias: null, plazo_retencion: null },
  });

  const esperada = new Date(
    new Date('2027-06-30T10:00:00.000Z').getTime() + 20 * 365.25 * DIA_MS
  ).getTime();
  const obtenida = new Date(plan.fecha_conservacion).getTime();

  // El código compara contra el cese con años de 365.25 días: se compara con
  // un margen de un día, que es la diferencia entre 365 y 365.25 en 20 años.
  assert.ok(Math.abs(esperada - obtenida) < DIA_MS,
    `el plazo del 8.6(b) se cuenta desde el cese (esperado ~${esperada}, obtenido ${obtenida})`);
  assert.equal(plan.fecha_inicio_conservacion, '2027-06-30T10:00:00.000Z',
    'la fecha de inicio del computo es el cese');
});

test('8.6(c): el contrato electrónico sigue con su hold sin término', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'CONTRATO_TRABAJO',
    fecha_creacion: FIRMA_BASE,
    empresa: { plazo_retencion_dias: null, plazo_retencion: null },
  });

  assert.ok(plan.hold, 'el contrato electrónico tiene hold');
  assert.equal(plan.fecha_conservacion, null);
  assert.equal(plan.aviso, 'RETAIN_DEBER_LEGAL');
  assert.equal(plan.categoria_conservacion, 'CONTRATO_SIN_TERMINO');
  assert.equal(plan.plazo_conservacion_dias, null, 'sin término no hay plazo');
  assert.equal(plan.plazo_conservacion_fuente, null);
  assert.equal(plan.fecha_inicio_conservacion, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// LA LIBERACIÓN: la maquinaria del hold viejo sigue funcionando.
// ─────────────────────────────────────────────────────────────────────────────

test('D1: el recálculo libera la fila retenida y le aplica el plazo de la tabla', () => {
  // Se simula una fila que quedó con el hold viejo: es lo que hay en las
  // bases donde el sistema todavía ponía esa retención.
  sembrarEmpresa(null);
  const firmaId = sembrarFirma({ categoria: 'TABLA_EMPRESA', regla: 'TABLA_EMPRESA' });
  conservacion.retenerPorPlazoNoDeclarado(firmaId, { actor: 'sistema' });
  assert.equal(fila(firmaId).fecha_conservacion, null);
  assert.equal(fila(firmaId).motivo_hold, MOTIVO_PLAZO);

  const r = conservacion.recalcularPlazosDeclarados(EMPRESA, { actor: 'admin:test' },
    { tabla_conservacion: TABLA_ACTIVADA });

  assert.equal(r.con_fecha, 1);
  assert.equal(r.liberados, 1);
  assert.equal(r.sin_fecha, 0);

  const despues = fila(firmaId);
  assert.equal(despues.fecha_conservacion, FECHA_TABLA,
    'toma el plazo por defecto de la tabla supletoria');
  assert.equal(despues.hold_legal, 0, 'el hold queda levantado');
  assert.equal(despues.plazo_conservacion_fuente, 'tabla_supletoria');
  assert.equal(holdsActivos(firmaId).length, 0);
});

test('D1: declarar el plazo recalcula la fecha y levanta la retención', () => {
  sembrarEmpresa(null);
  const firmaId = sembrarFirma({ categoria: 'TABLA_EMPRESA', regla: 'TABLA_EMPRESA' });

  // Estado inicial: retenida por plazo no declarado, sin fecha.
  conservacion.retenerPorPlazoNoDeclarado(firmaId, { actor: 'sistema' });
  assert.equal(fila(firmaId).fecha_conservacion, null);
  assert.equal(fila(firmaId).motivo_hold, MOTIVO_PLAZO);

  // La Empresa declara su plazo.
  db.prepare('UPDATE gh_firma_empresas SET plazo_retencion_dias = ? WHERE id_empresa = ?')
    .run(730, EMPRESA);

  const r = conservacion.recalcularPlazosDeclarados(EMPRESA, { actor: 'admin:test' });

  assert.equal(r.con_fecha, 1);
  assert.equal(r.liberados, 1);
  assert.equal(r.sin_fecha, 0);

  const despues = fila(firmaId);
  assert.ok(despues.fecha_conservacion, 'la firma queda con fecha de conservación');
  assert.equal(despues.hold_legal, 0, 'el hold queda levantado');
  assert.equal(despues.plazo_conservacion_fuente, 'empresa');
  assert.equal(holdsActivos(firmaId).length, 0);
});

test('8.6(h): un hold de OTRO motivo no se levanta por declarar el plazo', () => {
  sembrarEmpresa(null);
  const firmaId = sembrarFirma({ categoria: 'TABLA_EMPRESA', regla: 'TABLA_EMPRESA' });

  // Un deber legal declarado por la Empresa: es otra protección.
  conservacion.ponerHold(firmaId, {
    actor: 'sistema',
    motivo: 'deber_legal_2.2.1.1.12 del Decreto 1072 de 2015',
    alcance: '2.2.1.1.12 del Decreto 1072 de 2015',
  });

  db.prepare('UPDATE gh_firma_empresas SET plazo_retencion_dias = ? WHERE id_empresa = ?')
    .run(730, EMPRESA);

  const r = conservacion.recalcularPlazosDeclarados(EMPRESA, { actor: 'admin:test' });

  assert.equal(r.liberados, 0, 'el deber legal no se levanta porque la Empresa declare un plazo');
  assert.equal(r.sin_fecha, 0, 'y no queda como pendiente de plazo: es otro motivo');
  assert.equal(holdsActivos(firmaId).length, 1, 'el hold del deber legal sigue vigente');
  assert.equal(fila(firmaId).hold_legal, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// EL ENGANCHE: el update de la Empresa dispara el recálculo.
// ─────────────────────────────────────────────────────────────────────────────

test('8.6(h): actualizar la Empresa con un plazo libera las retenciones pendientes', () => {
  sembrarEmpresa(null);
  const firmaId = sembrarFirma({ categoria: 'TABLA_EMPRESA', regla: 'TABLA_EMPRESA' });
  conservacion.retenerPorPlazoNoDeclarado(firmaId, { actor: 'sistema' });

  assert.equal(fila(firmaId).fecha_conservacion, null);
  assert.equal(holdsActivos(firmaId).length, 1);

  empresaService.update(EMPRESA, {
    razon_social: 'EMPRESA DE PRUEBA SAS',
    plazo_retencion_dias: 730,
  }, { actor: 'admin:test', motivo: 'declara su plazo de retencion' });

  const despues = fila(firmaId);
  assert.ok(despues.fecha_conservacion,
    'al declarar el plazo, el registro queda con fecha de conservación');
  assert.equal(despues.hold_legal, 0, 'y su retención queda levantada');
  assert.equal(despues.plazo_conservacion_fuente, 'empresa');
  assert.equal(holdsActivos(firmaId).length, 0);
});

test('8.6(h): el recálculo usa el mismo plan que el alta (una sola fuente de verdad)', () => {
  sembrarEmpresa(730);
  const firmaId = sembrarFirma({ categoria: 'TABLA_EMPRESA', regla: 'TABLA_EMPRESA' });
  conservacion.retenerPorPlazoNoDeclarado(firmaId, { actor: 'sistema' });

  const planAlta = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    regla_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: { plazo_retencion_dias: 730, plazo_retencion: null },
  });

  db.prepare('UPDATE gh_firma_empresas SET plazo_retencion_dias = ? WHERE id_empresa = ?')
    .run(730, EMPRESA);
  conservacion.recalcularPlazosDeclarados(EMPRESA, { actor: 'admin:test' });

  assert.equal(
    fila(firmaId).fecha_conservacion,
    planAlta.fecha_conservacion,
    'la fecha del recálculo tiene que ser la misma que habría dado el alta'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// LOS REGISTROS HISTÓRICOS NO SE MUEVEN.
// ─────────────────────────────────────────────────────────────────────────────

test('D1: cambiar el plazo de la Empresa NO altera un registro ya calculado', () => {
  sembrarEmpresa(730);
  const firmaId = sembrarFirma({ categoria: 'TABLA_EMPRESA', regla: 'TABLA_EMPRESA' });

  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    regla_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: { plazo_retencion_dias: 730, plazo_retencion: null },
  });
  conservacion.aplicarPlanRetencion(firmaId, plan);
  const antes = fila(firmaId);
  assert.ok(antes.fecha_conservacion);

  // La Empresa cambia su plazo: el documento ya firmado no se mueve.
  db.prepare('UPDATE gh_firma_empresas SET plazo_retencion_dias = ? WHERE id_empresa = ?')
    .run(365, EMPRESA);
  conservacion.recalcularPlazosDeclarados(EMPRESA, { actor: 'admin:test' });

  const despues = fila(firmaId);
  assert.equal(despues.fecha_conservacion, antes.fecha_conservacion);
  assert.equal(despues.plazo_conservacion_dias, antes.plazo_conservacion_dias);
  assert.equal(despues.plazo_conservacion_fuente, antes.plazo_conservacion_fuente);
  assert.equal(despues.fecha_inicio_conservacion, antes.fecha_inicio_conservacion);
  assert.equal(despues.categoria_conservacion, antes.categoria_conservacion);
});
