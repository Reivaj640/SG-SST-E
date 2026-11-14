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
 *   1. Con la compuerta ABIERTA, ningún registro queda retenido por falta de
 *      configuración: el plazo por defecto lo aporta la tabla supletoria.
 *      Con la compuerta CERRADA (que es como se despacha) no hay plazo por
 *      defecto: el catálogo legado de veinte (20) años desde la firma se
 *      retiró (J8 y J9) y la tabla espera la validación del abogado.
 *   2. Cada registro tiene una categoría y una regla de conservación
 *      identificable (migración 049: el plazo, su fuente y la fecha de inicio).
 *   3. La modificación de un plazo NO altera los registros históricos: los
 *      datos calculados quedan congelados.
 *   4. Las excepciones legales documentadas se conservan (el piso del SG-SST
 *      y el hold sin término del contrato): no dependen de la tabla.
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

// El plazo por defecto de la tabla supletoria para DOCUMENTO_FIRMADO: diez (10)
// AÑOS CALENDARIO (C2, 12-nov-2026).
//
// `DIAS_TABLA` es la EXPRESIÓN NOMINAL del plazo —la que se congela en la fila
// (misma convención que el piso legal)— y NO el cómputo: la fecha se calcula
// en años calendario. Antes se sumaban días (3650) y la fecha salía dos o
// tres días antes que los diez años que dice el texto: la contradicción que
// C2 cierra.
const ANIOS_TABLA = 10;
const DIAS_TABLA = 3650;
const FECHA_TABLA = (() => {
  const base = new Date(FIRMA_BASE);
  return new Date(Date.UTC(
    base.getUTCFullYear() + ANIOS_TABLA,
    base.getUTCMonth(),
    base.getUTCDate(),
    base.getUTCHours(),
    base.getUTCMinutes(),
    base.getUTCSeconds(),
    base.getUTCMilliseconds(),
  )).toISOString();
})();

// El catálogo legado (veinte (20) años DESDE LA FIRMA) se RETIRÓ por orden del
// abogado (30-oct-2026, J8 y J9): con la compuerta cerrada no aplica para nada.
// Su única huella viva es la regla del catálogo, que sigue declarada.

const DIAS_PISO_SST = 7305;

// La tabla con la COMPUERTA ABIERTA: la que usan los tests que verifican el
// mecanismo de la tabla (que su plazo por defecto sea el que aplica).
const TABLA_ACTIVADA = tablaConservacionActivada();

// Una tabla supletoria con la COMPUERTA CERRADA. El 13-nov-2026 el owner
// ABRIO la compuerta del archivo real (S-25), asi que los tests del mecanismo
// cerrado no pueden depender del estado del archivo que se despacha: se la
// inyectan. Lo que se prueba es el MECANISMO, no el estado de hoy.
const TABLA_CERRADA = (() => {
  const t = tablaConservacionActivada();
  return Object.assign({}, t, {
    aplicacion: Object.assign({}, t.aplicacion, { activada: false, activado_at: null }),
  });
})();

// Una tabla supletoria MODIFICADA, para simular un cambio de la tabla de
// conservación sin tocar el archivo de configuración (que es de solo lectura
// para el código).
const TABLA_MODIFICADA = {
  version: 'test-modificada',
  aplicacion: {
    activada: true,
    estado: 'PREPARADA',
    // La compuerta exige el ACTO FECHADO del owner (13-nov-2026): sin
    // `activado_at` NO se abre, por mucho que `activada` diga que si. La
    // validacion escrita de un tercero ya no es requisito.
    activado_at: '2026-11-13T00:00:00.000Z',
  },
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
  assert.equal(documento.plazo_anos, ANIOS_TABLA,
    'C2: el plazo se declara y se computa en años calendario');
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
  // El MECANISMO del piso legal, con la tabla supletoria activada. Con la
  // compuerta cerrada (que es como se despacha) el piso legal sigue aplicando
  // y NO depende de la tabla: eso lo verifica el test de "las EXCEPCIONES
  // LEGALES" de más abajo.
  const plan = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: FIRMA_BASE,
    fecha_terminacion: '2027-06-30T10:00:00.000Z',
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_ACTIVADA,
  });

  assert.equal(plan.fecha_inicio_conservacion, '2027-06-30T10:00:00.000Z',
    'el punto de inicio del piso legal es el cese');
  assert.equal(plan.plazo_conservacion_fuente, 'piso_legal');
  assert.equal(plan.plazo_conservacion_dias, DIAS_PISO_SST);
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
  assert.equal(sinPiso.fecha_conservacion, null,
    'sin fecha real de cese no se calcula una fecha de supresión');
  assert.equal(sinPiso.aviso, 'RETAIN_PENDIENTE_CESE');
  assert.equal(sinPiso.hold.motivo, 'fecha_cese_pendiente');
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
      '2026-01-15T10:00:00.000Z',
    ],
    [
      'SST_EPP',
      EMPRESA_CON_PLAZO,
      '2046-01-15T10:00:00.000Z',
      'piso_legal',
      'SST_ESPECIAL',
      '2026-01-15T10:00:00.000Z',
    ],
  ];

  for (const [categoria, empresa, esperada, fuente, catTabla, fecha_terminacion] of casos) {
    const plan = retencion.planificar({
      categoria_retencion: categoria,
      fecha_creacion: FIRMA_BASE,
      fecha_terminacion,
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
// Lo que se despacha viene con la compuerta ABIERTA: el 13-nov-2026 el owner
// la abrió con un acto expreso y fechado (S-25). Desde esa fecha los plazos de
// diez (10) y cinco (5) años se aplican a los documentos que la Empresa no
// declara, con su fuente y su punto de inicio.
//
// El acto es del owner, no de un tercero: la validación escrita nunca fue
// requisito (13-nov-2026) y los campos `validado_por` y `validado_at`
// siguen en null porque no hay validación.
//
// Lo que NO depende de la compuerta son las EXCEPCIONES LEGALES: el piso del
// SG-SST y el hold sin término del contrato. Son deberes.
// ─────────────────────────────────────────────────────────────────────────────

test('la tabla que se despacha viene con la compuerta ABIERTA por el acto fechado', () => {
  const tabla = retencion.tablaConservacion();
  assert.ok(tabla.aplicacion, 'la tabla declara su propia activación');
  assert.equal(tabla.aplicacion.activada, true,
    'el owner abrió la compuerta el 13-nov-2026 (S-25)');
  assert.equal(tabla.aplicacion.activado_at, '2026-11-13',
    'el acto es FECHADO: sin la fecha no hay acto');
  assert.equal(retencion.tablaActivada(), true);
});

// LA COMPUERTA SE ABRE CON EL ACTO FECHADO DEL OWNER (13-nov-2026).
//
// El cambio de regla: hasta el 12-nov-2026 la compuerta exigia `activada: true`
// Y ADEMAS la validacion escrita de un tercero (`validado_por` y `validado_at`).
// El owner decidio el 13-nov-2026 que ese escrito formal NO es requisito, y el
// codigo cambio con la regla: la compuerta se abre con `activada: true` y
// `activado_at` con fecha, que es el rastro auditable del acto.
//
// Aqui se fija lo contrario, y con las tres formas que importan: sin fecha,
// con un marcador en vez de fecha, y con el acto completo. Y el guard de que la
// validacion escrita YA NO ES REQUISITO: sin `validado_por` ni `validado_at`,
// la compuerta se abre igual. Ese ultimo es el mutante que tiene que morder:
// si alguien vuelve a meter la validacion como condicion, esta prueba falla.

test('la compuerta NO se abre con `activada: true` y sin la fecha del acto', () => {
  const sinActo = {
    version: 'test-sin-acto',
    aplicacion: { activada: true, estado: 'PREPARADA', activado_at: null },
    categorias: TABLA_MODIFICADA.categorias,
    mapeo_codigo: TABLA_MODIFICADA.mapeo_codigo,
  };
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: sinActo,
  });
  assert.equal(plan.plazo_conservacion_fuente, 'tabla_supletoria_pendiente',
    'sin la fecha del acto, la tabla no aplica sus plazos aunque la bandera diga que si');
  assert.equal(plan.fecha_conservacion, null,
    'y por eso el registro queda retenido, sin fecha de supresion');
});

test('la compuerta tampoco se abre con un marcador de pendiente en vez de fecha', () => {
  const conMarcador = {
    version: 'test-marcador',
    aplicacion: {
      activada: true,
      estado: 'PREPARADA',
      activado_at: 'PENDIENTE: lo llena el owner',
    },
    categorias: TABLA_MODIFICADA.categorias,
    mapeo_codigo: TABLA_MODIFICADA.mapeo_codigo,
  };
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: conMarcador,
  });
  assert.equal(plan.plazo_conservacion_fuente, 'tabla_supletoria_pendiente',
    'un marcador es la ausencia del acto escrita: la compuerta sigue cerrada');
});

test('la compuerta SI se abre con el acto fechado del owner', () => {
  const conActo = {
    version: 'test-acto-completo',
    aplicacion: {
      activada: true,
      estado: 'ACTIVADA',
      activado_at: '2026-11-13T00:00:00.000Z',
    },
    categorias: TABLA_MODIFICADA.categorias,
    mapeo_codigo: TABLA_MODIFICADA.mapeo_codigo,
  };
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: conActo,
  });
  assert.notEqual(plan.plazo_conservacion_fuente, 'tabla_supletoria_pendiente',
    'con el acto fechado, la tabla aplica su plazo por defecto');
  assert.ok(plan.fecha_conservacion, 'y el registro deja de quedar retenido sin fecha');
});

test('la compuerta NO exige la validacion escrita de un tercero (13-nov-2026)', () => {
  // EL GUARD DE LA REGLA NUEVA. Si alguien volviera a meter `validado_por` y
  // `validado_at` como condicion, esta prueba falla: no hay forma de abrir la
  // compuerta sin un escrito formal de un abogado.
  const sinValidacion = {
    version: 'test-sin-validacion',
    aplicacion: {
      activada: true,
      estado: 'ACTIVADA',
      activado_at: '2026-11-13T00:00:00.000Z',
    },
    categorias: TABLA_MODIFICADA.categorias,
    mapeo_codigo: TABLA_MODIFICADA.mapeo_codigo,
  };
  assert.equal(retencion.tablaActivada({ tabla: sinValidacion }), true,
    'la validacion escrita ya no es requisito: la abre el acto fechado del owner');
  assert.equal(retencion.tablaActivada({ tabla: TABLA_MODIFICADA }), true,
    'tampoco la exige cuando los campos ni siquiera estan');
});

test('con la compuerta cerrada, no hay plazo por defecto: la tabla sigue sin activar', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_CERRADA,
  });

  assert.equal(plan.fecha_conservacion, null,
    'sin plazo declarado y con la compuerta cerrada no hay fecha de supresión');
  assert.equal(plan.plazo_conservacion_fuente, 'tabla_supletoria_pendiente',
    'la fila dice de dónde vendría el plazo: de la tabla, que todavía no aplica');
  assert.equal(plan.plazo_conservacion_dias, null,
    'y no se registra un plazo que no aplica');
  assert.equal(plan.fecha_inicio_conservacion, null,
    'sin plazo no hay punto de inicio del cómputo');
  assert.equal(plan.aviso, 'RETAIN_TABLA_PENDIENTE');
  assert.ok(plan.hold, 'el registro queda retenido');
  assert.equal(plan.hold.motivo, 'tabla_supletoria_pendiente_validacion');
});

test('con la compuerta cerrada, el texto NO promete la custodia que se retiró', () => {
  // El texto que se le comunica al Trabajador (el 8.6(g)) no puede prometer un
  // plazo que el sistema no tiene. El catálogo legado de veinte (20) años
  // desde la firma se retiró: no puede seguir ofreciéndose.
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_CERRADA,
  });

  assert.doesNotMatch(plan.texto, /Se conserva 20 años contados desde la fecha de la firma/,
    'la custodia de veinte (20) años desde la firma se retiró (J8 y J9)');
  assert.doesNotMatch(plan.texto, /tabla de conservación del sistema/,
    'el plazo no sale de la tabla supletoria mientras la compuerta esté cerrada');
  assert.match(plan.texto, /pendiente|no se suprime/,
    'el texto dice que el plazo está pendiente y que el documento no se suprime');
});

test('con la compuerta cerrada, la categoría se sigue registrando y no hay punto de inicio', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'HISTORIA_LABORAL',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_CERRADA,
  });

  assert.equal(plan.categoria_conservacion, 'DOCUMENTO_FIRMADO',
    'la categoría es la de la tabla, aunque su plazo no aplique todavía');
  assert.equal(plan.fecha_inicio_conservacion, null,
    'sin plazo aplicable no hay punto de inicio del cómputo');
});

test('con la compuerta cerrada, las EXCEPCIONES LEGALES siguen aplicando', () => {
  // El piso del SG-SST y el hold del contrato son deberes: no dependen de la
  // tabla, así que la compuerta cerrada no los apaga.
  const piso = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: FIRMA_BASE,
    fecha_terminacion: '2027-06-30T10:00:00.000Z',
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_CERRADA,
  });
  assert.equal(piso.plazo_conservacion_fuente, 'piso_legal');
  assert.equal(piso.plazo_conservacion_dias, DIAS_PISO_SST);
  assert.equal(piso.fecha_inicio_conservacion, '2027-06-30T10:00:00.000Z',
    'el punto de inicio del piso es el cese, y el cese se conoce');
  const esperada = new Date(
    new Date('2027-06-30T10:00:00.000Z').getTime() + 20 * 365.25 * DIA_MS
  ).getTime();
  assert.ok(
    Math.abs(esperada - new Date(piso.fecha_conservacion).getTime()) < DIA_MS,
    'el piso legal produce su fecha de supresión: con el cese conocido, el plazo corre'
  );
  assert.equal(piso.hold, null,
    'y el registro no queda retenido por la tabla pendiente de validación');

  const contrato = retencion.planificar({
    categoria_retencion: 'CONTRATO_TRABAJO',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_CERRADA,
  });
  assert.ok(contrato.hold, 'el contrato sigue sin término');
  assert.equal(contrato.fecha_conservacion, null);
});

test('con la compuerta cerrada, el plazo de la Empresa tiene la precedencia de siempre', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_CON_PLAZO,
    tabla_conservacion: TABLA_CERRADA,
  });
  assert.equal(plan.plazo_conservacion_fuente, 'empresa');
  assert.equal(plan.plazo_conservacion_dias, 1825);
  assert.ok(plan.fecha_conservacion, 'el plazo declarado por la Empresa no depende de la compuerta');
  assert.equal(plan.hold, null);
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
  // abrir la compuerta: tampoco hay plazo por defecto, y el registro queda
  // retenido esperando la validación de la tabla.
  const respaldo = retencion.TABLA_RESPALDO;
  assert.ok(respaldo.aplicacion);
  assert.equal(respaldo.aplicacion.activada, false);

  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: respaldo,
  });
  assert.equal(plan.fecha_conservacion, null,
    'sin plazo declarado y sin compuerta abierta no hay fecha de supresión');
  assert.equal(plan.plazo_conservacion_fuente, 'tabla_supletoria_pendiente');
  assert.equal(plan.plazo_conservacion_dias, null);
  assert.equal(plan.aviso, 'RETAIN_TABLA_PENDIENTE');
  assert.equal(plan.hold.motivo, 'tabla_supletoria_pendiente_validacion');
});

// ─────────────────────────────────────────────────────────────────────────────
// LAS CUATRO CONDICIONES DE LA VALIDACIÓN (C1 a C4).
//
// El dictamen legal del 12-nov-2026 (L3) propone cuatro condiciones que la
// validación del abogado externo tenía que cubrir. Lo que se prueba aquí es
// que la tabla que el CÓDIGO ejecuta es la que se entregó, y que las cuatro
// condiciones se cumplen con la compuerta ABIERTA (acto del owner del
// 13-nov-2026).
//
//   C1  el registro de operaciones sigue al documento asociado cuando este
//       tiene piso legal o hold sin término.
//   C2  el cómputo es en años calendario (o el texto se corrige).
//   C3  el piso legal no puede ser bajado por la tabla de la Empresa.
//   C4  la fecha de cese la informa y valida la Empresa por escrito.
// ─────────────────────────────────────────────────────────────────────────────

test('la tabla que se despacha está ACTIVADA, con su acto fechado', () => {
  const tabla = retencion.tablaConservacion();
  const aplicacion = tabla.aplicacion;

  assert.equal(aplicacion.activada, true, 'la compuerta está ABIERTA');
  assert.equal(aplicacion.estado, 'ACTIVADA',
    'el estado dice ACTIVADA: el acto ya se produjo');
  assert.equal(aplicacion.activado_at, '2026-11-13',
    'el acto de apertura lleva su fecha: lo hizo el owner el 13-nov-2026');
  assert.equal(aplicacion.validado_por, null,
    'no hay validacion escrita de un tercero, y ya no se exige una');
  assert.equal(aplicacion.validado_at, null,
    'idem: no hay fecha de validacion');
  assert.equal(aplicacion.validado_por_documento, null,
    'idem: no hay escrito de validacion');

  // La consulta al abogado SI existe, y queda como REGISTRO, no como
  // condicion de apertura: eso es exactamente lo que cambio el 13-nov-2026.
  assert.ok(aplicacion.consulta_juridica,
    'la consulta al abogado queda registrada, aunque no sea requisito');
  assert.equal(aplicacion.consulta_juridica.estado, 'RESPONDIDA, NO FORMAL');
  assert.match(aplicacion.consulta_juridica.sha256, /^[0-9a-f]{64}$/,
    'la consulta se registra con la huella del documento archivado');

  // Las cuatro condiciones están declaradas en la tabla.
  assert.ok(Array.isArray(aplicacion.condiciones));
  assert.equal(aplicacion.condiciones.length, 4);
  for (const condicion of ['C1', 'C2', 'C3', 'C4']) {
    assert.ok(
      aplicacion.condiciones.some((c) => c.startsWith(condicion + ' ')),
      `la tabla no declara la condición ${condicion}`
    );
  }

  // Y el alcance que se somete a validación son las OCHO categorías, no cinco.
  assert.equal(tabla.categorias.length, 8);
  assert.equal(aplicacion.alcance_validado.length, 8);
});

test('el marcador de "PENDIENTE" no abre la compuerta aunque se ponga la bandera', () => {
  // El archivo que se despacha trae la compuerta ABIERTA por el acto del owner
  // (13-nov-2026). Si alguien abriera la bandera SIN la fecha real del acto, el
  // código tiene que seguir tratándola como cerrada: el marcador es la
  // ausencia del acto escrita, no un acto.
  const tabla = retencion.tablaConservacion();
  const conMarcador = Object.assign({}, tabla, {
    aplicacion: Object.assign({}, tabla.aplicacion, {
      activada: true,
      activado_at: 'PENDIENTE: lo llena el owner',
    }),
  });
  assert.equal(retencion.tablaActivada({ tabla: conMarcador }), false,
    'un marcador de pendiente no es el acto del owner');

  // Con el acto de verdad (la bandera y la fecha), se abre.
  const conActo = Object.assign({}, tabla, {
    aplicacion: Object.assign({}, tabla.aplicacion, {
      activada: true,
      activado_at: '2026-11-13T19:20:00-05:00',
    }),
  });
  assert.equal(retencion.tablaActivada({ tabla: conActo }), true);
});

test('C2: el plazo por defecto se computa en años calendario y el texto lo dice', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_ACTIVADA,
  });

  // La fecha es la de DIEZ AÑOS CALENDARIO. La de 3650 días caía dos días
  // antes (el 13-ene-2036 en vez del 15-ene-2036): esa era la contradicción.
  assert.equal(plan.fecha_conservacion, FECHA_TABLA);
  assert.notEqual(
    new Date(plan.fecha_conservacion).getTime(),
    new Date(FIRMA_BASE).getTime() + DIAS_TABLA * DIA_MS,
    'la fecha NO es la de 3650 días: el cómputo es en años calendario'
  );

  // El texto no dice dos verdades: dice los años, dice cómo se computan y NO
  // afirma una equivalencia en días que es falsa.
  assert.match(plan.texto, /10 años/);
  assert.match(plan.texto, /años calendario/);
  assert.doesNotMatch(plan.texto, /3650 días/,
    'el texto no puede afirmar «10 años (3650 días)»: no es lo mismo');
  assert.match(plan.texto, /tabla de conservación del sistema/);
});

test('C1: el registro de operaciones sigue al documento con piso legal o hold sin término', () => {
  // (a) El documento con PISO LEGAL (los registros del SG-SST): su registro de
  // operaciones sigue al piso de veinte (20) años desde el cese, NO al plazo
  // de cinco (5) años de la categoría REGISTRO_OPERACIONES.
  const sst = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: FIRMA_BASE,
    fecha_terminacion: '2027-06-30T10:00:00.000Z',
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_ACTIVADA,
  });
  assert.equal(sst.plazo_registro_operaciones.fuente, 'piso_legal');
  assert.equal(sst.plazo_registro_operaciones.sigue_al_documento, true);
  assert.equal(sst.plazo_registro_operaciones.fecha, sst.fecha_conservacion,
    'el registro se conserva hasta la fecha del piso');
  const cincoAnosDesdeElCese = new Date(
    new Date('2027-06-30T10:00:00.000Z').getTime() + 1825 * DIA_MS
  ).toISOString();
  assert.notEqual(sst.plazo_registro_operaciones.fecha, cincoAnosDesdeElCese,
    'el registro del documento con piso legal NO se purga a los cinco (5) años');

  // (b) El documento SIN TÉRMINO (el contrato): su registro tampoco vence.
  const contrato = retencion.planificar({
    categoria_retencion: 'CONTRATO_TRABAJO',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_ACTIVADA,
  });
  assert.equal(contrato.plazo_registro_operaciones.fuente, 'documento_sin_termino');
  assert.equal(contrato.plazo_registro_operaciones.fecha, null,
    'sin término en el documento, no hay término en su registro');
  assert.equal(contrato.plazo_registro_operaciones.sigue_al_documento, true);

  // (c) Los demás: el registro sigue al documento y no puede ser menor.
  const comun = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_ACTIVADA,
  });
  assert.equal(comun.plazo_registro_operaciones.fuente, 'documento_asociado');
  assert.equal(comun.plazo_registro_operaciones.fecha, comun.fecha_conservacion);
});

test('C3: el piso legal no puede ser bajado por la tabla de la Empresa', () => {
  const CESE = '2027-06-30T10:00:00.000Z';
  const FECHA_PISO = '2047-06-30T10:00:00.000Z';

  // El piso: veinte (20) años desde el CESE (no desde la firma).
  const piso = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: FIRMA_BASE,
    fecha_terminacion: CESE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_ACTIVADA,
  });
  assert.equal(piso.fecha_conservacion, FECHA_PISO);
  assert.equal(piso.plazo_conservacion_fuente, 'piso_legal');

  // La Empresa declara un plazo MENOR (un año): NO baja el piso.
  const empresaCorta = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: FIRMA_BASE,
    fecha_terminacion: CESE,
    empresa: Object.assign({}, EMPRESA_CON_PLAZO, { plazo_retencion_dias: 365 }),
    tabla_conservacion: TABLA_ACTIVADA,
  });
  assert.equal(empresaCorta.fecha_conservacion, FECHA_PISO,
    'un plazo de la Empresa más corto NO baja el piso legal');
  assert.equal(empresaCorta.plazo_conservacion_fuente, 'piso_legal');

  // Y si declara uno MAYOR, se aplica el más lejano (el 8.6(a)).
  const empresaLarga = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: FIRMA_BASE,
    fecha_terminacion: CESE,
    empresa: Object.assign({}, EMPRESA_CON_PLAZO, { plazo_retencion_dias: 30 * 365 }),
    tabla_conservacion: TABLA_ACTIVADA,
  });
  assert.equal(empresaLarga.plazo_conservacion_fuente, 'empresa');
  assert.ok(
    new Date(empresaLarga.fecha_conservacion).getTime()
      > new Date(FECHA_PISO).getTime(),
    'con un plazo mayor de la Empresa se aplica la fecha más lejana'
  );
});

test('C4: la fecha de cese la informa y valida la Empresa, y la firma no la sustituye', () => {
  // SIN fecha de cese: no se calcula fecha de supresión y el registro queda
  // pendiente de que la Empresa informe y valide esa fecha.
  const sinCese = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: FIRMA_BASE,
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_ACTIVADA,
  });
  assert.equal(sinCese.fecha_conservacion, null,
    'la fecha de la firma NO sustituye a la fecha real de cese');
  assert.equal(sinCese.aviso, 'RETAIN_PENDIENTE_CESE');
  assert.equal(sinCese.hold.motivo, 'fecha_cese_pendiente');
  assert.match(sinCese.hold.alcance, /informe y valide la fecha real de cese/,
    'el hold dice QUIÉN tiene que informar y validar la fecha');
  assert.match(sinCese.texto, /La Empresa debe informar y validar esa fecha/);

  // CON fecha de cese: el plazo corre desde el cese, no desde la firma.
  const conCese = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: FIRMA_BASE,
    fecha_terminacion: '2027-06-30T10:00:00.000Z',
    empresa: EMPRESA_SIN_PLAZO,
    tabla_conservacion: TABLA_ACTIVADA,
  });
  assert.equal(conCese.fecha_inicio_conservacion, '2027-06-30T10:00:00.000Z',
    'el punto de inicio del cómputo es el cese');
  assert.equal(conCese.fecha_conservacion, '2047-06-30T10:00:00.000Z');
  assert.notEqual(conCese.fecha_inicio_conservacion, FIRMA_BASE,
    'y no la fecha de la firma');
});
