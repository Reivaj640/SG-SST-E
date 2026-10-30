/**
 * LA CONSERVACIÓN CON LA TABLA SUPLETORIA DE K+AIR (decisión D1).
 *
 * Ejecutar: node --test --require ./tests/setup.js tests/services/conservacion-supletoria.test.js
 *
 * QUÉ SE PRUEBA
 * -------------
 * La regla de precedencia del plazo, de punta a punta:
 *
 *   (a) CONTRATO_SIN_TERMINO: hold, sin fecha y sin plazo.
 *   (b) SST_ESPECIAL: el mínimo legal (veinte años desde el cese). La tabla
 *       de la Empresa NO puede bajarlo.
 *   (c) La Empresa declara un plazo: ese plazo manda.
 *   (d) La tabla supletoria: el plazo por defecto de la categoría.
 *
 * Y, sobre todo, las cuatro cosas que el abogado pidió que quedaran probadas:
 *
 *   1. Ningún registro queda retenido indefinidamente por falta de
 *      configuración.
 *   2. Cada registro tiene una categoría y una regla de conservación
 *      identificable (migración 049: el plazo, su fuente y la fecha de inicio).
 *   3. La modificación de un plazo NO altera los registros históricos: los
 *      datos calculados quedan congelados.
 *   4. Las excepciones legales documentadas se conservan (el piso del SG-SST
 *      y el hold sin término del contrato).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../../src/db/connection');
const retencion = require('../../src/services/retencion');
const conservacion = require('../../src/services/conservacion');
const { resetDb, tablaConservacionActivada } = require('../helpers');

const EMPRESA = '901987654';
const DIA_MS = 24 * 60 * 60 * 1000;
const FIRMA_BASE = '2026-01-15T10:00:00.000Z';

// El plazo por defecto de la tabla supletoria para DOCUMENTO_FIRMADO.
const DIAS_TABLA = 3650;
const FECHA_TABLA = new Date(
  new Date(FIRMA_BASE).getTime() + DIAS_TABLA * DIA_MS
).toISOString();

// La custodia del CATÁLOGO: veinte (20) años desde la firma. Es el plazo que
// aplica con la compuerta de la tabla cerrada.
const DIAS_CATALOGO = 7305;
const FECHA_CATALOGO = '2046-01-15T10:00:00.000Z';

// La tabla con la COMPUERTA ABIERTA: la que usan los tests que verifican el
// mecanismo de la tabla (que su plazo por defecto sea el que aplica).
const TABLA_ACTIVADA = tablaConservacionActivada();

// Una tabla supletoria MODIFICADA, para simular un cambio de la tabla de
// conservación sin tocar el archivo de configuración (que es de solo lectura
// para el código).
const TABLA_MODIFICADA = {
  version: 'test-modificada',
  aplicacion: { activada: true, estado: 'PROPUESTA' },
  categorias: [
    { id: 'DOCUMENTO_FIRMADO', plazo_dias: 1000, punto_inicio: 'fecha_firma', piso_legal: false, hold_siempre: false },
    { id: 'SST_ESPECIAL', plazo_dias: 7305, punto_inicio: 'fecha_cese', piso_legal: true, hold_siempre: false },
    { id: 'CONTRATO_SIN_TERMINO', plazo_dias: null, punto_inicio: null, piso_legal: false, hold_siempre: true },
  ],
  mapeo_codigo: {
    SST_PERFIL_Y_CONCEPTOS_MEDICOS: 'SST_ESPECIAL',
    SST_EXAMENES_ESPECIALIZADOS: 'SST_ESPECIAL',
    SST_MONITOREO_AMBIENTAL: 'SST_ESPECIAL',
    SST_CAPACITACION: 'SST_ESPECIAL',
    SST_EPP: 'SST_ESPECIAL',
    CONTRATO_TRABAJO: 'CONTRATO_SIN_TERMINO',
    HISTORIA_LABORAL: 'DOCUMENTO_FIRMADO',
    ASPIRANTE: 'DOCUMENTO_FIRMADO',
    TABLA_EMPRESA: 'DOCUMENTO_FIRMADO',
  },
};

const EMPRESA_SIN_PLAZO = {
  plazo_retencion: null,
  plazo_retencion_dias: null,
  conservacion_por_deber_legal: false,
  norma_conservacion: null,
};

const EMPRESA_CON_PLAZO = {
  plazo_retencion: 'Cinco (5) años',
  plazo_retencion_dias: 1825,
  conservacion_por_deber_legal: false,
  norma_conservacion: null,
};

function sembrarEmpresa(dias) {
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
  db.prepare(`
    INSERT INTO gh_firma_empresas (id_empresa, razon_social, plazo_retencion_dias)
    VALUES (?, 'EMPRESA SUPLETORIA SAS', ?)
  `).run(EMPRESA, dias);
}

function sembrarFirma(opts = {}) {
  const id = 'SIGN-SUP-' + Math.floor(Math.random() * 900000 + 100000);
  const r = db.prepare(`
    INSERT INTO gh_firmas_electronicas
      (id_solicitud, id_documento, id_trabajador, id_empresa, tipo_firma,
       document_hash_original, agreement_hash, token_hash,
       fecha_creacion, fecha_expiracion, version_kair,
       categoria_retencion, regla_retencion, fecha_terminacion,
       plazo_retencion_aplicable)
    VALUES (?, 'doc-1', 'psn1_' || substr(hex(randomblob(32)), 1, 64), ?, 'presencial',
            'hash-doc', 'hash-acuerdo', 'hash-token-' || ?,
            ?, datetime('now'), '0.1.0-test',
            ?, ?, ?, ?)
  `).run(
    id, EMPRESA, id,
    opts.fecha_creacion || FIRMA_BASE,
    opts.categoria || null,
    opts.regla || null,
    opts.fecha_terminacion || null,
    opts.plazo_aplicable || null
  );
  return r.lastInsertRowid;
}

const fila = (id) => db.prepare(
  'SELECT fecha_conservacion, hold_legal, motivo_hold, '
  + 'plazo_conservacion_dias, plazo_conservacion_fuente, '
  + 'fecha_inicio_conservacion, categoria_conservacion '
  + 'FROM gh_firmas_electronicas WHERE id = ?'
).get(id);

test.beforeEach(() => {
  resetDb();
});

// ─────────────────────────────────────────────────────────────────────────────
// LA TABLA SUPLETORIA ES LA FUENTE ÚNICA DEL PLAZO POR DEFECTO.
// ─────────────────────────────────────────────────────────────────────────────

test('la tabla supletoria es la fuente del plazo por defecto y se puede releer', () => {
  const tabla = retencion.tablaConservacion();
  assert.ok(Array.isArray(tabla.categorias));
  const documento = tabla.categorias.find((c) => c.id === 'DOCUMENTO_FIRMADO');
  assert.ok(documento, 'la tabla declara la categoría base');
  assert.equal(documento.plazo_dias, DIAS_TABLA);
  assert.equal(documento.punto_inicio, 'fecha_firma');
  assert.equal(documento.hold_siempre, false);

  // El mapeo del código a la categoría de la tabla vive en la tabla.
  assert.equal(tabla.mapeo_codigo.TABLA_EMPRESA, 'DOCUMENTO_FIRMADO');
  assert.equal(tabla.mapeo_codigo.SST_CAPACITACION, 'SST_ESPECIAL');
  assert.equal(tabla.mapeo_codigo.CONTRATO_TRABAJO, 'CONTRATO_SIN_TERMINO');

  // Y se puede forzar la relectura del archivo.
  const recargada = retencion.recargarTablaConservacion();
  assert.equal(recargada.categorias.length, tabla.categorias.length);
});

test('sin plazo de la Empresa: la tabla aporta la fecha y la fuente queda registrada', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_ACTIVADA,
  });

  assert.equal(plan.fecha_conservacion, FECHA_TABLA);
  assert.equal(plan.plazo_conservacion_dias, DIAS_TABLA);
  assert.equal(plan.plazo_conservacion_fuente, 'tabla_supletoria');
  assert.equal(plan.categoria_conservacion, 'DOCUMENTO_FIRMADO');
  assert.equal(plan.fecha_inicio_conservacion, FIRMA_BASE);
  assert.equal(plan.aviso, 'RETAIN_FECHA');
  assert.equal(plan.hold, null);
});

test('con plazo de la Empresa: manda el de la Empresa y la fuente queda registrada', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_CON_PLAZO,
  });

  assert.equal(
    new Date(plan.fecha_conservacion).getTime(),
    new Date(FIRMA_BASE).getTime() + 1825 * DIA_MS
  );
  assert.equal(plan.plazo_conservacion_dias, 1825);
  assert.equal(plan.plazo_conservacion_fuente, 'empresa');
  assert.equal(plan.texto, 'Cinco (5) años', 'manda también el texto de la Empresa');
});

test('el piso legal del SG-SST: veinte años desde el cese', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: FIRMA_BASE,
    fecha_terminacion: '2027-06-30T10:00:00.000Z',
    empresa: EMPRESA_SIN_PLAZO,
  });

  assert.equal(plan.fecha_inicio_conservacion, '2027-06-30T10:00:00.000Z',
    'el punto de inicio del piso legal es el cese');
  assert.equal(plan.plazo_conservacion_fuente, 'piso_legal');
  assert.equal(plan.plazo_conservacion_dias, 7305);
  assert.equal(plan.categoria_conservacion, 'SST_ESPECIAL');

  const esperada = new Date(
    new Date('2027-06-30T10:00:00.000Z').getTime() + 20 * 365.25 * DIA_MS
  ).getTime();
  assert.ok(
    Math.abs(esperada - new Date(plan.fecha_conservacion).getTime()) < DIA_MS,
    'el plazo del piso se cuenta desde el cese'
  );
});

test('el plazo de la Empresa NO puede bajar el piso legal del SG-SST', () => {
  const sinPiso = retencion.planificar({
    categoria_retencion: 'SST_EPP',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
  });
  const conPlazoCorto = retencion.planificar({
    categoria_retencion: 'SST_EPP',
    fecha_creacion: FIRMA_BASE,
    empresa: Object.assign({}, EMPRESA_CON_PLAZO, { plazo_retencion_dias: 365 }),
  });

  assert.equal(conPlazoCorto.fecha_conservacion, sinPiso.fecha_conservacion,
    'un año no baja el mínimo legal de veinte');
  assert.equal(conPlazoCorto.plazo_conservacion_fuente, 'piso_legal');
});

test('el contrato: hold sin fecha y sin plazo', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'CONTRATO_TRABAJO',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
  });

  assert.ok(plan.hold);
  assert.equal(plan.hold.motivo, 'deber_legal_2.2.1.1.12 del Decreto 1072 de 2015');
  assert.equal(plan.fecha_conservacion, null);
  assert.equal(plan.plazo_conservacion_dias, null, 'sin término no hay plazo');
  assert.equal(plan.plazo_conservacion_fuente, null);
  assert.equal(plan.fecha_inicio_conservacion, null);
  assert.equal(plan.categoria_conservacion, 'CONTRATO_SIN_TERMINO');
});

test('la constancia hereda el plazo del documento asociado', () => {
  // La tabla supletoria declara la constancia como categoría que hereda: no
  // tiene plazo propio, lo toma del documento al que se refiere.
  const tabla = retencion.tablaConservacion();
  const constancia = tabla.categorias.find((c) => c.id === 'CONSTANCIA_Y_MANIFESTACION');
  assert.ok(constancia, 'la tabla declara la categoría de la constancia');
  assert.equal(constancia.hereda_de, 'documento_asociado');
  assert.equal(constancia.plazo_dias, null,
    'la constancia no tiene plazo propio: lo hereda');

  // Y el texto que se comunica es el del documento asociado: la constancia lee
  // la fila de la firma (columna plazo_retencion_aplicable), que es donde
  // quedó congelado el plazo aplicado de ese documento.
  const plan = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
  });
  assert.match(plan.texto, /veinte \(20\) años/,
    'el documento asociado comunica su propio plazo');

  const firmaId = sembrarFirma({
    categoria: 'SST_CAPACITACION',
    regla: 'SST_20_ANOS',
    plazo_aplicable: plan.texto,
  });
  const filaFirma = db.prepare(
    'SELECT plazo_retencion_aplicable FROM gh_firmas_electronicas WHERE id = ?'
  ).get(firmaId);
  assert.equal(filaFirma.plazo_retencion_aplicable, plan.texto,
    'la constancia lee el plazo del documento asociado de esta fila');
});

// ─────────────────────────────────────────────────────────────────────────────
// EL ALTA Y LA TRAZABILIDAD.
// ─────────────────────────────────────────────────────────────────────────────

test('el alta NO crea un hold por plazo no declarado', () => {
  sembrarEmpresa(null);
  const firmaId = sembrarFirma({ categoria: 'TABLA_EMPRESA', regla: 'TABLA_EMPRESA' });

  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    regla_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_ACTIVADA,
  });
  conservacion.aplicarPlanRetencion(firmaId, plan);

  const despues = fila(firmaId);
  assert.equal(despues.hold_legal, 0);
  assert.equal(despues.motivo_hold, null);
  assert.equal(conservacion.holdsDe(firmaId).length, 0);
  assert.ok(despues.fecha_conservacion, 'y hay fecha: la de la tabla supletoria');
});

test('cada registro queda con su categoría y su regla de conservación identificables', () => {
  sembrarEmpresa(null);
  const firmaId = sembrarFirma({ categoria: 'TABLA_EMPRESA', regla: 'TABLA_EMPRESA' });

  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    regla_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_ACTIVADA,
  });
  conservacion.aplicarPlanRetencion(firmaId, plan);

  const despues = fila(firmaId);
  assert.equal(despues.categoria_conservacion, 'DOCUMENTO_FIRMADO');
  assert.equal(despues.plazo_conservacion_dias, DIAS_TABLA);
  assert.equal(despues.plazo_conservacion_fuente, 'tabla_supletoria');
  assert.equal(despues.fecha_inicio_conservacion, FIRMA_BASE);
});

test('la migración 049 · las columnas de la trazabilidad existen', () => {
  const columnas = db.prepare('PRAGMA table_info(gh_firmas_electronicas)').all()
    .map((c) => c.name);
  for (const c of [
    'plazo_conservacion_dias',
    'plazo_conservacion_fuente',
    'fecha_inicio_conservacion',
    'categoria_conservacion',
  ]) {
    assert.ok(columnas.includes(c), `falta la columna ${c}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LOS REGISTROS HISTÓRICOS NO SE MUEVEN.
// ─────────────────────────────────────────────────────────────────────────────

test('cambiar la tabla NO altera un registro ya calculado', () => {
  sembrarEmpresa(null);
  const firmaId = sembrarFirma({ categoria: 'TABLA_EMPRESA', regla: 'TABLA_EMPRESA' });

  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    regla_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_ACTIVADA,
  });
  conservacion.aplicarPlanRetencion(firmaId, plan);
  const antes = fila(firmaId);
  assert.equal(antes.fecha_conservacion, FECHA_TABLA);

  // La tabla cambia (en este caso, a un plazo más corto). El registro ya
  // calculado NO se mueve: su plazo, su fuente y su fecha de inicio quedan
  // congelados.
  const planConTablaNueva = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    regla_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_MODIFICADA,
  });
  assert.equal(
    new Date(planConTablaNueva.fecha_conservacion).getTime(),
    new Date(FIRMA_BASE).getTime() + 1000 * DIA_MS,
    'con la tabla modificada el plazo nuevo sería otro'
  );

  const despues = fila(firmaId);
  assert.equal(despues.fecha_conservacion, antes.fecha_conservacion);
  assert.equal(despues.plazo_conservacion_dias, antes.plazo_conservacion_dias);
  assert.equal(despues.plazo_conservacion_fuente, antes.plazo_conservacion_fuente);
  assert.equal(despues.fecha_inicio_conservacion, antes.fecha_inicio_conservacion);
  assert.equal(despues.categoria_conservacion, antes.categoria_conservacion);

  // Y el recálculo tampoco lo toca: solo mira las filas SIN fecha.
  conservacion.recalcularPlazosDeclarados(EMPRESA, { actor: 'admin:test' });
  const trasRecalculo = fila(firmaId);
  assert.equal(trasRecalculo.fecha_conservacion, antes.fecha_conservacion);
  assert.equal(trasRecalculo.plazo_conservacion_dias, antes.plazo_conservacion_dias);
});

test('un registro histórico con el hold viejo se libera y toma el plazo por defecto', () => {
  // Se simula una fila de las bases existentes: retenida por el motivo viejo
  // ('plazo_no_declarado'), sin fecha. El recálculo explícito la libera y le
  // aplica el plazo que resulta aplicable (el de la tabla supletoria, porque
  // la Empresa no declaró ninguno).
  sembrarEmpresa(null);
  const firmaId = sembrarFirma({ categoria: 'TABLA_EMPRESA', regla: 'TABLA_EMPRESA' });
  conservacion.retenerPorPlazoNoDeclarado(firmaId, { actor: 'sistema' });
  assert.equal(fila(firmaId).fecha_conservacion, null);
  assert.equal(fila(firmaId).motivo_hold, 'plazo_no_declarado');

  const r = conservacion.recalcularPlazosDeclarados(EMPRESA, {
    actor: 'admin:test',
    motivo: 'puesta en regla',
  }, { tabla_conservacion: TABLA_ACTIVADA });

  assert.equal(r.revisados, 1);
  assert.equal(r.con_fecha, 1);
  assert.equal(r.liberados, 1);
  assert.equal(r.sin_fecha, 0);

  const despues = fila(firmaId);
  assert.equal(despues.fecha_conservacion, FECHA_TABLA);
  assert.equal(despues.hold_legal, 0);
  assert.equal(despues.plazo_conservacion_fuente, 'tabla_supletoria');
  assert.equal(despues.plazo_conservacion_dias, DIAS_TABLA);
  assert.equal(conservacion.holdsDe(firmaId).length, 1, 'el historial del hold queda');
  assert.equal(conservacion.holdsDe(firmaId)[0].activo, 0, 'pero el hold queda liberado');
});

// ─────────────────────────────────────────────────────────────────────────────
// EL CÁLCULO DE FECHAS, CON CASOS DE DISTINTAS CATEGORÍAS.
// ─────────────────────────────────────────────────────────────────────────────

test('el cálculo de fechas: un caso por categoría', () => {
  const casos = [
    // [categoría, empresa, fecha esperada, fuente, categoría de la tabla]
    ['TABLA_EMPRESA', EMPRESA_SIN_PLAZO, FECHA_TABLA, 'tabla_supletoria', 'DOCUMENTO_FIRMADO'],
    ['HISTORIA_LABORAL', EMPRESA_SIN_PLAZO, FECHA_TABLA, 'tabla_supletoria', 'DOCUMENTO_FIRMADO'],
    ['ASPIRANTE', EMPRESA_SIN_PLAZO, FECHA_TABLA, 'tabla_supletoria', 'DOCUMENTO_FIRMADO'],
    [
      'SST_CAPACITACION',
      EMPRESA_SIN_PLAZO,
      '2046-01-15T10:00:00.000Z',
      'piso_legal',
      'SST_ESPECIAL',
    ],
    [
      'SST_EPP',
      EMPRESA_CON_PLAZO,
      '2046-01-15T10:00:00.000Z',
      'piso_legal',
      'SST_ESPECIAL',
    ],
  ];

  for (const [categoria, empresa, esperada, fuente, catTabla] of casos) {
    const plan = retencion.planificar({
      categoria_retencion: categoria,
      fecha_creacion: FIRMA_BASE,
      empresa,
      tabla_conservacion: TABLA_ACTIVADA,
    });
    assert.equal(plan.fecha_conservacion, esperada, `la fecha de ${categoria}`);
    assert.equal(plan.plazo_conservacion_fuente, fuente, `la fuente de ${categoria}`);
    assert.equal(plan.categoria_conservacion, catTabla, `la categoría de ${categoria}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LA COMPUERTA DE ACTIVACIÓN.
//
// Lo que se despacha viene con la compuerta CERRADA: los plazos de diez (10)
// y cinco (5) años no los validó el abogado, y el Acuerdo que los describe
// (la v1.3) no está aprobado. Con la compuerta cerrada, el plazo por defecto
// es el de custodia del catálogo, que es el que estaba en vigor.
// ─────────────────────────────────────────────────────────────────────────────

test('la tabla que se despacha viene con la compuerta CERRADA', () => {
  const tabla = retencion.tablaConservacion();
  assert.ok(tabla.aplicacion, 'la tabla declara su propia activación');
  assert.equal(tabla.aplicacion.activada, false,
    'los plazos de diez (10) y cinco (5) años no se activan hasta que el abogado los valide');
  assert.equal(retencion.tablaActivada(), false);
});

test('con la compuerta cerrada, el plazo por defecto es el del catálogo', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
  });

  assert.equal(plan.plazo_conservacion_fuente, 'catalogo_sistema',
    'la fila dice de dónde salió el plazo: del catálogo, no de la tabla');
  assert.equal(plan.plazo_conservacion_dias, DIAS_CATALOGO);
  assert.equal(plan.fecha_conservacion, FECHA_CATALOGO);
  assert.equal(plan.fecha_inicio_conservacion, FIRMA_BASE);
  assert.equal(plan.anios, 20);
  assert.equal(plan.aviso, 'RETAIN_FECHA');
  assert.equal(plan.hold, null);
  assert.match(plan.texto, /Se conserva 20 años contados desde la fecha de la firma/);
});

test('con la compuerta cerrada, la categoría y su punto de inicio se siguen registrando', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'HISTORIA_LABORAL',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
  });

  assert.equal(plan.categoria_conservacion, 'DOCUMENTO_FIRMADO',
    'la categoría es la de la tabla, aunque su plazo no aplique todavía');
  assert.equal(plan.fecha_inicio_conservacion, FIRMA_BASE);
});

test('con la compuerta cerrada, las EXCEPCIONES LEGALES siguen aplicando', () => {
  // El piso del SG-SST y el hold del contrato son deberes: no dependen de la
  // tabla, así que la compuerta cerrada no los apaga.
  const piso = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: FIRMA_BASE,
    fecha_terminacion: '2027-06-30T10:00:00.000Z',
    empresa: EMPRESA_SIN_PLAZO,
  });
  assert.equal(piso.plazo_conservacion_fuente, 'piso_legal');
  assert.equal(piso.plazo_conservacion_dias, 7305);

  const contrato = retencion.planificar({
    categoria_retencion: 'CONTRATO_TRABAJO',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
  });
  assert.ok(contrato.hold, 'el contrato sigue sin término');
  assert.equal(contrato.fecha_conservacion, null);
});

test('con la compuerta cerrada, el plazo de la Empresa tiene la precedencia de siempre', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_CON_PLAZO,
  });
  assert.equal(plan.plazo_conservacion_fuente, 'empresa');
  assert.equal(plan.plazo_conservacion_dias, 1825);
});

test('con la compuerta ABIERTA, el plazo por defecto es el de la tabla', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_ACTIVADA,
  });

  assert.equal(plan.plazo_conservacion_fuente, 'tabla_supletoria');
  assert.equal(plan.plazo_conservacion_dias, DIAS_TABLA);
  assert.equal(plan.fecha_conservacion, FECHA_TABLA);
  assert.equal(plan.fecha_inicio_conservacion, FIRMA_BASE);
  assert.match(plan.texto, /tabla de conservación del sistema/,
    'el texto dice de dónde viene el plazo: de la tabla, no de la Empresa');
});

test('el respaldo congelado también arranca con la compuerta cerrada', () => {
  // Si el archivo de configuración no se puede leer, el respaldo NO puede
  // abrir la compuerta: el sistema conserva el plazo del catálogo.
  const respaldo = retencion.TABLA_RESPALDO;
  assert.ok(respaldo.aplicacion);
  assert.equal(respaldo.aplicacion.activada, false);

  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: respaldo,
  });
  assert.equal(plan.plazo_conservacion_fuente, 'catalogo_sistema');
  assert.equal(plan.plazo_conservacion_dias, DIAS_CATALOGO);
});
