/**
 * CATÁLOGO DE RETENCIÓN POR TIPO DE DOCUMENTO
 * ============================================
 *
 * El plazo de conservación de una firma NO se le pregunta a nadie: vive en el
 * código del sistema. Estos tests fijan cuál es ese plazo y cuándo se aplica.
 *
 * Lo que estos tests fijan:
 *   1. La custodia del sistema: 20 años desde la fecha de la firma.
 *   2. Si la Empresa declaró un plazo en su tabla, ese plazo manda (el 8.6).
 *   3. Los cinco grupos SST del art. 2.2.4.6.13 del Decreto 1072 tienen un
 *      piso legal de 20 años desde el cese: si la fecha de cese se conoce y
 *      esa fecha fuera más lejana, esa gana.
 *   4. El contrato electrónico (art. 2.2.1.1.12) no tiene término: queda con
 *      un HOLD y no se borra por el vencimiento de la custodia.
 *   5. El deber legal sin término de la Empresa gana sobre cualquier plazo.
 *   6. Una Empresa que NO declaró plazo de conservación puede firmar: no hay
 *      nada que declarar, el plazo ya existe en el código.
 *   7. La categoría la deriva el sistema del tipo de documento; el operador
 *      no elige nada.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../src/db/connection');
const retencion = require('../src/services/retencion');
const empresaService = require('../src/services/empresa');
const signRequestService = require('../src/services/signRequest');
const mailer = require('../src/services/mailer');
const {
  resetDb, seedActiveAgreement, createSignRequestWithIdentificacion, makeApp,
  tablaConservacionActivada,
} = require('./helpers');

// La tabla con la COMPUERTA ABIERTA. La que se despacha viene cerrada: los
// plazos de diez (10) y cinco (5) años no los validó el abogado. Estos tests
// verifican el MECANISMO de la tabla, así que la usan con la compuerta
// abierta; el estado cerrado tiene sus propios tests en
// tests/services/conservacion-supletoria.test.js.
const TABLA_ACTIVADA = tablaConservacionActivada();

const EMPRESA = '900123456';

// 2026-01-01 + 20 años = 2046-01-01
const CUSTODIA_20 = '2046-01-01T00:00:00.000Z';

const EMPRESA_SIN_TABLA = {
  plazo_retencion: null,
  plazo_retencion_dias: null,
  conservacion_por_deber_legal: false,
  norma_conservacion: null,
};

// La tabla de la Empresa con 5 años declarados.
const EMPRESA_CON_TABLA = {
  plazo_retencion: '5 años',
  plazo_retencion_dias: 1825,
  conservacion_por_deber_legal: false,
  norma_conservacion: null,
};

function limpiar() {
  resetDb();
  seedActiveAgreement();
}

function crearEmpresa({ conAnexo = true, conPlazo = false, conDeber = false } = {}) {
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
  empresaService.create({
    id_empresa: EMPRESA,
    razon_social: 'Empresa de Prueba S.A.S.',
    nit: EMPRESA,
    domicilio: 'Bogotá D.C.',
    responsable_tratamiento: 'Responsable de Prueba',
    responsable_tratamiento_correo: 'privacidad@example.com',
    canal_pqrs: 'pqrs@example.com',
    canal_incidentes: 'seguridad@example.com',
    canal_solicitud_copia: 'privacidad@example.com',
    plazo_retencion: conPlazo ? '5 años' : null,
    plazo_retencion_dias: conPlazo ? 1825 : null,
    conservacion_por_deber_legal: conDeber,
    norma_conservacion: conDeber ? '2.2.1.1.12 del Decreto 1072 de 2015' : null,
  });
  if (conAnexo) empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-20');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Catálogo y resolución de categoría
// ─────────────────────────────────────────────────────────────────────────────

test('catálogo · los cinco grupos SST están bajo la regla de custodia', () => {
  const sst = retencion.CATEGORIAS.filter((c) => c.regla === 'SST_20_ANOS');
  assert.equal(sst.length, 5);
  for (const c of sst) {
    assert.match(c.norma, /2\.2\.4\.6\.13/);
  }
});

test('catálogo · la custodia del sistema son 20 años', () => {
  assert.equal(retencion.ANIOS_CUSTODIA, 20);
  assert.equal(retencion.REGLAS.CUSTODIA_20_ANOS.anios, 20);
  assert.equal(retencion.REGLAS.CUSTODIA_20_ANOS.base, 'creacion');
});

test('catálogo · el id legacy CUSTODIA_80_ANOS se traduce al vigente', () => {
  // La 034 actualiza el id guardado en la fila, pero una base donde no corrió
  // no puede quedar reinterpretada: el id viejo apunta al vigente.
  assert.equal(retencion.REGLAS_LEGACY.CUSTODIA_80_ANOS, 'CUSTODIA_20_ANOS');
  assert.equal(retencion.REGLAS.CUSTODIA_80_ANOS, undefined,
    'el id viejo ya no es una regla del catálogo');

  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    regla_retencion: 'CUSTODIA_80_ANOS',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    empresa: EMPRESA_SIN_TABLA,
    tabla_conservacion: TABLA_ACTIVADA,
  });
  assert.equal(plan.regla, 'CUSTODIA_20_ANOS',
    'la fila dice la regla que de verdad se aplicó');
  assert.ok(plan.fecha_conservacion,
    'y, sin plazo declarado, el plazo es el de la tabla supletoria (decisión D1)');
  assert.equal(plan.aviso, 'RETAIN_FECHA');
  assert.equal(plan.plazo_conservacion_fuente, 'tabla_supletoria');
});

test('catálogo · resuelve la categoría explícita y la derivada', () => {
  assert.equal(
    retencion.resolverCategoria({ categoria_retencion: 'SST_EPP' }),
    'SST_EPP',
  );
  assert.equal(
    retencion.resolverCategoria({ tipo_identificacion: 'CONTRATO' }),
    'CONTRATO_TRABAJO',
  );
  assert.equal(
    retencion.resolverCategoria({
      tipo_identificacion: 'FORMATO',
      subtipo_identificacion: 'induccion',
    }),
    'SST_CAPACITACION',
  );
  assert.equal(
    retencion.resolverCategoria({
      tipo_identificacion: 'CERTIFICADO',
      metadata: JSON.stringify({ subtipo_identificacion: 'examen_especializado' }),
    }),
    'SST_EXAMENES_ESPECIALIZADOS',
  );
  assert.equal(
    retencion.resolverCategoria({ tipo_identificacion: 'ACTA' }),
    'TABLA_EMPRESA',
  );
  assert.equal(retencion.resolverCategoria({}), null, 'sin datos no hay categoría');
});

test('catálogo · la derivación pone primero lo más específico', () => {
  // Un examen especializado es del grupo de especializados, no del grupo
  // general de conceptos médicos.
  assert.equal(
    retencion.resolverCategoria({
      tipo_identificacion: 'CERTIFICADO',
      subtipo_identificacion: 'examen medico especializado',
    }),
    'SST_EXAMENES_ESPECIALIZADOS',
  );
  // Una capacitación sobre EPP es un registro de capacitación.
  assert.equal(
    retencion.resolverCategoria({
      tipo_identificacion: 'ACTA',
      subtipo_identificacion: 'capacitacion en uso de epp',
    }),
    'SST_CAPACITACION',
  );
  // Una palabra genérica NO debe inventar un grupo legal: sin coincidencia
  // clara, la custodia general del sistema.
  assert.equal(
    retencion.resolverCategoria({
      tipo_identificacion: 'ACTA',
      subtipo_identificacion: 'concepto de aprobacion',
    }),
    'TABLA_EMPRESA',
  );
});

test('catálogo · rechaza una categoría desconocida', () => {
  assert.equal(retencion.categoriaValida('NO_EXISTE'), false);
  assert.throws(
    () => retencion.validarCategoria('NO_EXISTE'),
    (e) => e.code === 'CATEGORIA_RETENCION_INVALIDA',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Planes de retención (funciones puras)
// ─────────────────────────────────────────────────────────────────────────────

test('custodia · sin plazo de empresa el plazo es el de la tabla supletoria', () => {
  // Decisión D1: a falta de plazo declarado por la Empresa, el plazo es el
  // de la TABLA SUPLETORIA de conservación administrada por K+AIR. No hay
  // fecha nula por falta de configuración, y el texto que se comunica lo dice
  // de forma honesta: el plazo es del sistema.
  //
  // La excepción es la del 8.6(b): los documentos del SG-SST, que tienen plazo
  // propio en el Acuerdo (veinte años desde el cese).
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    empresa: EMPRESA_SIN_TABLA,
    tabla_conservacion: TABLA_ACTIVADA,
  });
  assert.equal(plan.regla, 'TABLA_EMPRESA');
  assert.ok(plan.fecha_conservacion,
    'la tabla supletoria aporta el plazo: nunca hay fecha nula por falta de plazo');
  assert.equal(plan.anios, 10);
  assert.equal(plan.aviso, 'RETAIN_FECHA');
  assert.equal(plan.plazo_conservacion_fuente, 'tabla_supletoria');
  assert.equal(plan.plazo_conservacion_dias, 3650);
  assert.match(plan.texto, /tabla de conservación del sistema/);
  assert.doesNotMatch(plan.texto, /pendiente de declaración/);
  assert.doesNotMatch(plan.texto, /20 años/,
    'el texto no puede prometer los veinte años que no aplican');
  assert.equal(plan.hold, null);
});

test('custodia · la tabla de la Empresa manda si declaró un plazo', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    empresa: EMPRESA_CON_TABLA,
  });
  assert.equal(plan.fecha_conservacion, '2030-12-31T00:00:00.000Z');
  assert.equal(plan.anios, 5);
  assert.match(plan.texto, /5 años/);
});

test('SST · el mínimo de 20 años desde el cese se comunica en el texto', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    empresa: EMPRESA_SIN_TABLA,
  });
  assert.equal(plan.fecha_conservacion, CUSTODIA_20);
  assert.match(plan.texto, /veinte \(20\) años/);
  assert.match(plan.texto, /cese de la relación laboral/);
  assert.match(plan.texto, /2\.2\.4\.6\.13/);
});

test('SST · si el cese se conoce y es más lejano, ese plazo gana', () => {
  // Relación laboral de 70 años: el mínimo legal (20 desde el cese) cae
  // después de la custodia de 20 años desde la firma.
  const plan = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    fecha_terminacion: '2096-01-01',
    empresa: EMPRESA_SIN_TABLA,
  });
  assert.equal(plan.fecha_conservacion, '2116-01-01T00:00:00.000Z');
});

test('contrato electrónico · hold sin fecha de supresión', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'CONTRATO_TRABAJO',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    empresa: EMPRESA_SIN_TABLA,
  });
  assert.equal(plan.regla, 'CONTRATO_ELECTRONICO');
  assert.equal(plan.fecha_conservacion, null);
  assert.equal(plan.aviso, 'RETAIN_DEBER_LEGAL');
  assert.ok(plan.hold);
  assert.match(plan.hold.motivo, /2\.2\.1\.1\.12/);
  assert.match(plan.texto, /sin término/);
});

test('historia laboral · el Concepto AGN orienta el plazo sin fijarlo', () => {
  // Con plazo declarado por la Empresa, el texto que se le comunica al
  // Trabajador cita el Concepto AGN (que orienta el plazo de la historia
  // laboral sin fijarlo) y la jurisprudencia que lo sostiene.
  const plan = retencion.planificar({
    categoria_retencion: 'HISTORIA_LABORAL',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    // La Empresa declara el plazo COMPUTABLE pero no un texto libre: entonces
    // el texto que se le comunica al Trabajador es el de la regla, que cita el
    // Concepto AGN. (Si la Empresa declarara su propio texto, mandaría el
    // suyo: es su tabla de retención y su redacción.)
    empresa: Object.assign({}, EMPRESA_CON_TABLA, { plazo_retencion: null }),
  });
  assert.equal(plan.fecha_conservacion, '2030-12-31T00:00:00.000Z');
  assert.match(plan.texto, /Concepto 2-2017-01654/);
  assert.match(plan.texto, /T-470\/2019/);
  assert.doesNotMatch(plan.texto, /80 a 100 años/,
    'el rango de 80 a 100 años no es el plazo del sistema');
});

test('historia laboral · sin plazo declarado, el plazo es el de la tabla supletoria', () => {
  // La historia laboral no tiene plazo propio en el Acuerdo: sin plazo
  // declarado por la Empresa, aplica el de la tabla supletoria, y el texto
  // sigue citando la orientación del Concepto AGN (que orienta sin fijar).
  const plan = retencion.planificar({
    categoria_retencion: 'HISTORIA_LABORAL',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    empresa: EMPRESA_SIN_TABLA,
    tabla_conservacion: TABLA_ACTIVADA,
  });
  assert.ok(plan.fecha_conservacion);
  assert.equal(plan.aviso, 'RETAIN_FECHA');
  assert.equal(plan.plazo_conservacion_fuente, 'tabla_supletoria');
  assert.match(plan.texto, /tabla de conservación del sistema/);
  assert.match(plan.texto, /Concepto 2-2017-01654/,
    'la orientación legal de la categoría también se comunica cuando el plazo es del sistema');
});

test('el deber legal de la Empresa gana sobre cualquier plazo', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    empresa: Object.assign({}, EMPRESA_CON_TABLA, {
      conservacion_por_deber_legal: true,
      norma_conservacion: '2.2.1.1.12 del Decreto 1072 de 2015',
    }),
  });
  assert.equal(plan.fecha_conservacion, null, 'sin fecha de supresión');
  assert.equal(plan.aviso, 'RETAIN_DEBER_LEGAL');
  assert.ok(plan.hold);
  assert.match(plan.hold.motivo, /2\.2\.1\.1\.12/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Migración
// ─────────────────────────────────────────────────────────────────────────────

test('migración 033 · las columnas de retención por documento existen', () => {
  const columnas = db.prepare('PRAGMA table_info(gh_firmas_electronicas)').all()
    .map((c) => c.name);
  for (const c of [
    'categoria_retencion',
    'regla_retencion',
    'fecha_terminacion',
    'plazo_retencion_aplicable',
  ]) {
    assert.ok(columnas.includes(c), `falta la columna ${c}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Integración: alta, habilitación, vista pública y correo
// ─────────────────────────────────────────────────────────────────────────────

test('una Empresa sin plazo declarado puede firmar: 20 años de custodia', async () => {
  limpiar();
  crearEmpresa({ conAnexo: true, conPlazo: false });

  // No hay nada que declarar: la habilitación no lo pide.
  const h = empresaService.verificarHabilitacionFirma(EMPRESA);
  assert.equal(h.ok, true);
  assert.deepEqual(h.pendientes, []);

  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    categoria_retencion: 'SST_CAPACITACION',
  });
  // La custodia se cuenta desde la fecha real de creación de la firma.
  const esperado = new Date(signRequest.fecha_creacion);
  esperado.setUTCFullYear(esperado.getUTCFullYear() + 20);
  assert.equal(signRequest.categoria_retencion, 'SST_CAPACITACION');
  assert.equal(signRequest.regla_retencion, 'SST_20_ANOS');
  assert.equal(signRequest.fecha_conservacion, esperado.toISOString());
  assert.equal(signRequest.hold_legal, 0);
  assert.match(signRequest.plazo_retencion_aplicable, /20 años/);

  // 049 · la fila deja la trazabilidad de la regla que se aplicó: el plazo,
  // su fuente y la fecha de inicio del cómputo. Con eso, el §4 se puede
  // demostrar documento por documento.
  const filaFirma = db.prepare(
    'SELECT plazo_conservacion_dias, plazo_conservacion_fuente, '
    + 'fecha_inicio_conservacion, categoria_conservacion '
    + 'FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud);
  assert.equal(filaFirma.plazo_conservacion_dias, 7305);
  assert.equal(filaFirma.plazo_conservacion_fuente, 'piso_legal');
  assert.equal(filaFirma.categoria_conservacion, 'SST_ESPECIAL');
  assert.ok(filaFirma.fecha_inicio_conservacion,
    'y la fecha de inicio del cómputo queda registrada');
});

test('la categoría la deriva el sistema del tipo de documento', async () => {
  limpiar();
  crearEmpresa({ conAnexo: true, conPlazo: false });

  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    tipo_identificacion: 'CONTRATO',
  });
  assert.equal(signRequest.categoria_retencion, 'CONTRATO_TRABAJO');
  assert.equal(signRequest.regla_retencion, 'CONTRATO_ELECTRONICO');
  assert.equal(signRequest.fecha_conservacion, null, 'el contrato no tiene término');
  assert.equal(signRequest.hold_legal, 1);
  assert.match(signRequest.motivo_hold, /2\.2\.1\.1\.12/);
});

test('el contrato con la tabla de la Empresa también queda sin término', async () => {
  limpiar();
  crearEmpresa({ conAnexo: true, conPlazo: true });

  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    categoria_retencion: 'CONTRATO_TRABAJO',
  });
  assert.equal(signRequest.fecha_conservacion, null);
  assert.equal(signRequest.hold_legal, 1);
});

test('la mini-app muestra el plazo de la solicitud', async () => {
  limpiar();
  crearEmpresa({ conAnexo: true, conPlazo: false });

  const { token } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    categoria_retencion: 'SST_CAPACITACION',
  });

  const res = await request(makeApp()).get(`/s/${token}`);
  assert.equal(res.status, 200);
  assert.match(res.body.empresa.plazo_retencion, /20 años/);
  assert.equal(res.body.empresa.conservacion_por_deber_legal, false);
});

test('el correo de invitación comunica el plazo de la solicitud', async () => {
  limpiar();
  crearEmpresa({ conAnexo: true, conPlazo: false });
  mailer.clearDevInbox();

  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    categoria_retencion: 'SST_CAPACITACION',
    correo_verificacion: 'trabajador@example.com',
  });

  await signRequestService.notifyRemote(signRequest, 'trabajador@example.com', {
    actor: 'test',
  });

  const invite = mailer.getDevInbox().find((m) => m.tipo === 'invite');
  assert.ok(invite, 'salió un correo de invitación');
  assert.match(invite.body, /20 años/);
});

test('firma dual · el hijo hereda la fecha y el hold del padre', async () => {
  limpiar();
  crearEmpresa({ conAnexo: true, conPlazo: false });

  const { signRequest: padre } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    categoria_retencion: 'CONTRATO_TRABAJO',
    requiere_firma_empresa: 1,
    representante_legal_snapshot: {
      nombre: 'Lilia Maria Vasquez Muñoz',
      tipo_identificacion: 'CC',
      numero_identificacion: '1129566447',
      correo: 'representante@example.com',
      cargo: 'Representante Legal',
    },
  });

  const hijo = signRequestService.createForCompany({
    parent_id_solicitud: padre.id_solicitud,
    id_empresa: EMPRESA,
    id_documento: padre.id_documento,
    representante: {
      nombre: 'Lilia Maria Vasquez Muñoz',
      tipo_identificacion: 'CC',
      numero_identificacion: '1129566447',
      correo: 'representante@example.com',
      cargo: 'Representante Legal',
    },
  });

  const fila = db.prepare(
    'SELECT categoria_retencion, regla_retencion, ' +
    'plazo_retencion_aplicable, fecha_conservacion, hold_legal ' +
    'FROM gh_firmas_electronicas WHERE id = ?'
  ).get(hijo.id);
  assert.equal(fila.categoria_retencion, 'CONTRATO_TRABAJO');
  assert.equal(fila.regla_retencion, 'CONTRATO_ELECTRONICO');
  assert.equal(fila.fecha_conservacion, null);
  assert.equal(fila.hold_legal, 1, 'el hold del contrato se hereda');
});
