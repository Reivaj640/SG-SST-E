/**
 * CATÁLOGO DE RETENCIÓN POR TIPO DE DOCUMENTO
 * ============================================
 *
 * El 8.6 del Acuerdo deja el plazo en la tabla de retención documental de la
 * Empresa, pero hay documentos cuyo plazo NO lo fija la Empresa: lo fija la
 * ley. El artículo 2.2.4.6.13 del Decreto 1072 de 2015 ordena conservar por
 * un mínimo de 20 años, desde el cese de la relación laboral, cinco grupos de
 * registros del SG-SST. Y el artículo 2.2.1.1.12 (adicionado por el Decreto
 * 526 de 2021) obliga a conservar los contratos electrónicos sin fijar término.
 *
 * Estos tests fijan:
 *   1. El catálogo resuelve la categoría explícita y la derivada del tipo.
 *   2. Los cinco grupos SST se conservan 20 años desde el CESE, no desde la
 *      firma.
 *   3. El contrato electrónico queda con un HOLD, sin fecha de supresión.
 *   4. La historia laboral usa el rango 80-100 años desde el RETIRO.
 *   5. Sin fecha de cese/retiro no se inventa una fecha: queda pendiente.
 *   6. La tabla de la Empresa sigue siendo el fallback de los documentos que
 *      la ley no regula.
 *   7. Una solicitud SST se puede crear aunque la Empresa no haya declarado
 *      `plazo_retencion_dias` (el plazo lo fija la ley, no la Empresa).
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
} = require('./helpers');

const EMPRESA = '900123456';

const EMPRESA_BASE = {
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
    plazo_retencion: '5 años',
    plazo_retencion_dias: conPlazo ? 1825 : null,
    conservacion_por_deber_legal: conDeber,
    norma_conservacion: conDeber ? '2.2.1.1.12 del Decreto 1072 de 2015' : null,
  });
  if (conAnexo) empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-20');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Catálogo y resolución de categoría
// ─────────────────────────────────────────────────────────────────────────────

test('catálogo · los cinco grupos SST están bajo la regla de 20 años', () => {
  const sst = retencion.CATEGORIAS.filter((c) => c.regla === 'SST_20_ANOS');
  assert.equal(sst.length, 5);
  for (const c of sst) {
    assert.equal(c.requiere_fecha, true, `${c.id} necesita fecha de cese`);
    assert.match(c.norma, /2\.2\.4\.6\.13/);
  }
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
  assert.equal(retencion.resolverCategoria({}), null, 'sin datos es legacy');
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
  // clara, la tabla de la Empresa.
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

test('SST · 20 años desde el cese, no desde la firma', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    fecha_terminacion: '2026-01-15',
    empresa: EMPRESA_BASE,
  });
  assert.equal(plan.regla, 'SST_20_ANOS');
  assert.equal(plan.fecha_conservacion, '2046-01-15T00:00:00.000Z');
  assert.equal(plan.aviso, 'RETAIN_FECHA');
  assert.match(plan.texto, /20 años/);
  assert.match(plan.texto, /cese de la relación laboral/);
  assert.match(plan.texto, /2\.2\.4\.6\.13/);
  assert.equal(plan.hold, null);
});

test('SST · sin fecha de cese no se inventa la fecha', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'SST_EPP',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    empresa: EMPRESA_BASE,
  });
  assert.equal(plan.fecha_conservacion, null);
  assert.equal(plan.aviso, 'RETAIN_PENDIENTE_CESE');
  assert.match(plan.texto, /pendiente/i);
  assert.equal(plan.hold, null);
});

test('contrato electrónico · hold sin fecha de supresión', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'CONTRATO_TRABAJO',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    empresa: EMPRESA_BASE,
  });
  assert.equal(plan.regla, 'CONTRATO_ELECTRONICO');
  assert.equal(plan.fecha_conservacion, null);
  assert.equal(plan.aviso, 'RETAIN_DEBER_LEGAL');
  assert.ok(plan.hold);
  assert.match(plan.hold.motivo, /2\.2\.1\.1\.12/);
  assert.match(plan.texto, /autenticidad, integridad y disponibilidad/);
});

test('historia laboral · rango 80-100 años desde el retiro, aplica 100', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'HISTORIA_LABORAL',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    fecha_terminacion: '2026-01-15',
    empresa: EMPRESA_BASE,
  });
  assert.equal(plan.regla, 'HISTORIA_LABORAL');
  assert.equal(plan.fecha_conservacion, '2126-01-15T00:00:00.000Z');
  assert.equal(plan.aviso, 'RETAIN_FECHA');
  assert.match(plan.texto, /80/);
  assert.match(plan.texto, /100/);
  assert.match(plan.texto, /retiro/);
});

test('historia laboral · sin fecha de retiro queda pendiente', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'HISTORIA_LABORAL',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    empresa: EMPRESA_BASE,
  });
  assert.equal(plan.fecha_conservacion, null);
  assert.equal(plan.aviso, 'RETAIN_PENDIENTE_RETIRO');
  assert.match(plan.texto, /pendiente/i);
});

test('tabla de la Empresa · usa el plazo declarado', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    empresa: EMPRESA_BASE,
  });
  assert.equal(plan.regla, 'TABLA_EMPRESA');
  assert.equal(plan.fecha_conservacion, '2030-12-31T00:00:00.000Z');
  assert.equal(plan.texto, '5 años');
  assert.equal(plan.aviso, 'RETAIN_FECHA');
});

test('tabla de la Empresa · el deber legal de la Empresa manda', () => {
  const plan = retencion.planificar({
    categoria_retencion: 'TABLA_EMPRESA',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    empresa: Object.assign({}, EMPRESA_BASE, {
      conservacion_por_deber_legal: true,
      norma_conservacion: '2.2.1.1.12 del Decreto 1072 de 2015',
    }),
  });
  assert.equal(plan.fecha_conservacion, null);
  assert.equal(plan.aviso, 'RETAIN_DEBER_LEGAL');
  assert.ok(plan.hold);
  assert.match(plan.hold.motivo, /2\.2\.1\.1\.12/);
});

test('SST · el deber legal de la Empresa NO se recorta con los 20 años', () => {
  // Si la Empresa declaró un deber legal SIN término, ese deber manda
  // aunque el documento tenga un plazo legal propio: un plazo más corto no
  // puede recortar un deber sin término (perder esa protección sería una
  // supresión indebida).
  const plan = retencion.planificar({
    categoria_retencion: 'SST_CAPACITACION',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    fecha_terminacion: '2026-01-15',
    empresa: Object.assign({}, EMPRESA_BASE, {
      conservacion_por_deber_legal: true,
      norma_conservacion: '2.2.1.1.12 del Decreto 1072 de 2015',
    }),
  });
  assert.equal(plan.fecha_conservacion, null, 'sin fecha de supresión');
  assert.equal(plan.aviso, 'RETAIN_DEBER_LEGAL');
  assert.ok(plan.hold);
  assert.match(plan.hold.motivo, /2\.2\.1\.1\.12/);
});

test('legacy · sin categoría conserva la tabla de la Empresa', () => {
  const plan = retencion.planificar({
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    empresa: EMPRESA_BASE,
  });
  assert.equal(plan.categoria, null);
  assert.equal(plan.regla, 'TABLA_EMPRESA');
  assert.equal(plan.fecha_conservacion, '2030-12-31T00:00:00.000Z');
  assert.equal(plan.texto, null, 'legacy no congela texto: usa la empresa viva');
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
// 4. Integración: creación, habilitación y vista pública
// ─────────────────────────────────────────────────────────────────────────────

test('SST · la Empresa sin plazo puede firmar una inducción', async () => {
  limpiar();
  crearEmpresa({ conAnexo: true, conPlazo: false });

  const h = empresaService.verificarHabilitacionFirma(EMPRESA, {
    categoria_retencion: 'SST_CAPACITACION',
  });
  assert.equal(h.ok, true, 'el plazo lo fija la ley, no la Empresa');
  assert.deepEqual(h.pendientes, []);

  const legacy = empresaService.verificarHabilitacionFirma(EMPRESA);
  assert.equal(legacy.ok, false, 'sin categoría sigue exigiendo el plazo');
  assert.deepEqual(legacy.pendientes, ['plazo_retencion']);

  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    categoria_retencion: 'SST_CAPACITACION',
    fecha_terminacion: '2026-01-15',
  });

  assert.equal(signRequest.categoria_retencion, 'SST_CAPACITACION');
  assert.equal(signRequest.regla_retencion, 'SST_20_ANOS');
  assert.equal(signRequest.fecha_terminacion, '2026-01-15T00:00:00.000Z');
  assert.equal(signRequest.fecha_conservacion, '2046-01-15T00:00:00.000Z');
  assert.equal(signRequest.hold_legal, 0);
  assert.match(signRequest.plazo_retencion_aplicable, /20 años/);
});

test('SST · sin fecha de cese queda pendiente en la fila', async () => {
  limpiar();
  crearEmpresa({ conAnexo: true, conPlazo: false });

  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    categoria_retencion: 'SST_EPP',
  });
  assert.equal(signRequest.fecha_conservacion, null);
  assert.equal(signRequest.hold_legal, 0);
  assert.match(signRequest.plazo_retencion_aplicable, /pendiente/i);
});

test('contrato electrónico · la fila queda con hold y sin fecha', async () => {
  limpiar();
  crearEmpresa({ conAnexo: true, conPlazo: false });

  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    categoria_retencion: 'CONTRATO_TRABAJO',
  });
  assert.equal(signRequest.fecha_conservacion, null);
  assert.equal(signRequest.hold_legal, 1);
  assert.match(signRequest.motivo_hold, /2\.2\.1\.1\.12/);
  assert.match(signRequest.plazo_retencion_aplicable, /2\.2\.1\.1\.12/);
});

test('vista pública · usa el texto de la solicitud, no el de la Empresa', () => {
  limpiar();
  crearEmpresa({ conAnexo: true, conPlazo: true });

  const vista = empresaService.publicViewFor(EMPRESA, {
    plazo_retencion: 'Mínimo 20 años desde el cese (texto de la solicitud)',
    conservacion_por_deber_legal: false,
    norma_conservacion: null,
  });
  assert.match(vista.plazo_retencion, /texto de la solicitud/);
  assert.equal(vista.conservacion_por_deber_legal, false);

  const sinOverride = empresaService.publicViewFor(EMPRESA);
  assert.equal(sinOverride.plazo_retencion, '5 años');
});

test('firma dual · el hijo hereda la categoría y la fecha del padre', async () => {  limpiar();
  crearEmpresa({ conAnexo: true, conPlazo: false });

  const { signRequest: padre } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    categoria_retencion: 'SST_CAPACITACION',
    fecha_terminacion: '2026-01-15',
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
    'SELECT categoria_retencion, regla_retencion, fecha_terminacion, ' +
    'plazo_retencion_aplicable, fecha_conservacion, hold_legal ' +
    'FROM gh_firmas_electronicas WHERE id = ?'
  ).get(hijo.id);
  assert.equal(fila.categoria_retencion, 'SST_CAPACITACION');
  assert.equal(fila.regla_retencion, 'SST_20_ANOS');
  assert.equal(fila.fecha_terminacion, '2026-01-15T00:00:00.000Z');
  assert.equal(fila.fecha_conservacion, '2046-01-15T00:00:00.000Z');
  assert.equal(fila.hold_legal, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Lo que ve el Trabajador: la mini-app y el correo de invitación
// ─────────────────────────────────────────────────────────────────────────────

test('la mini-app muestra el plazo de la solicitud, no el de la Empresa', async () => {
  limpiar();
  crearEmpresa({ conAnexo: true, conPlazo: true });

  const { token } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    categoria_retencion: 'SST_CAPACITACION',
    fecha_terminacion: '2026-01-15',
  });

  const res = await request(makeApp()).get(`/s/${token}`);
  assert.equal(res.status, 200);
  assert.match(res.body.empresa.plazo_retencion, /20 años/);
  assert.equal(res.body.empresa.conservacion_por_deber_legal, false);
});

test('el correo de invitación comunica el plazo de la solicitud', async () => {
  limpiar();
  crearEmpresa({ conAnexo: true, conPlazo: true });
  mailer.clearDevInbox();

  const { signRequest, token } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    categoria_retencion: 'SST_CAPACITACION',
    fecha_terminacion: '2026-01-15',
    correo_verificacion: 'trabajador@example.com',
  });

  await signRequestService.notifyRemote(signRequest, 'trabajador@example.com', {
    actor: 'test',
  });

  const invite = mailer.getDevInbox().find((m) => m.tipo === 'invite');
  assert.ok(invite, 'salió un correo de invitación');
  assert.match(invite.body, /20 años/);
});
