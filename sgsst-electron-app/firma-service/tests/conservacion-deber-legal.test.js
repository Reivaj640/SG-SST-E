/**
 * 1.1 · EL DEBER LEGAL DE CONSERVACIÓN SIN TÉRMINO (por Empresa)
 * ==============================================================
 *
 * El artículo 2.2.1.1.12 del Decreto 1072 obliga a los empleadores a
 * conservar los contratos de trabajo firmados electrónicamente, SIN PLAZO. Y
 * el 8.6 del Acuerdo deja el plazo en la tabla de retención documental de la
 * Empresa: con eso, el vencimiento de esa tabla hoy extingue un deber que la
 * ley no extingue, y el sistema suprime el contrato.
 *
 * Decisión del owner (2026-10-20): la carga es **a nivel de EMPRESA**, no de
 * documento. Es una cualidad de la relación laboral, y el sistema no puede
 * clasificar un PDF con acierto (el mismo argumento del 10.8).
 *
 * Lo que estos tests fijan:
 *   1. La Empresa declara el deber y la norma que lo impone.
 *   2. Sus firmas NO reciben fecha de supresión automática.
 *   3. Sus firmas quedan con un HOLD legal automático (actor 'sistema'),
 *      gobernado por `gh_firma_holds`: se libera con actor y motivo.
 *   4. El Trabajador se entera: en la mini-app y en el correo de invitación.
 *   5. Sin el flag, todo sigue igual (plazo normal, sin hold).
 *   6. La base se NIEGA a suprimir una firma con hold (trigger de la 020).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../src/db/connection');
const empresaService = require('../src/services/empresa');
const conservacion = require('../src/services/conservacion');
const mailer = require('../src/services/mailer');
const {
  resetDb, seedActiveAgreement, makeApp, createSignRequestWithIdentificacion,
} = require('./helpers');

const EMPRESA = '900123456';
const NORMA = '2.2.1.1.12 del Decreto 1072 de 2015';

function crearEmpresa({ conDeber = false, conPlazo = true } = {}) {
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
  const datos = {
    id_empresa: EMPRESA,
    razon_social: 'Empresa de Prueba S.A.S.',
    nit: EMPRESA,
    responsable_tratamiento: 'Responsable de Prueba',
    responsable_tratamiento_correo: 'privacidad@example.com',
    canal_pqrs: 'pqrs@example.com',
    canal_incidentes: 'seguridad@example.com',
    plazo_retencion: '5 años',
    canal_solicitud_copia: 'privacidad@example.com',
    plazo_retencion_dias: conPlazo ? 1825 : null,
  };
  if (conDeber) {
    datos.conservacion_por_deber_legal = true;
    datos.norma_conservacion = NORMA;
  }
  const creada = empresaService.create(datos);
  // D-03: sin Anexo de Encargo firmado, la empresa no puede pedir firmas.
  empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-20');
  return creada;
}

function limpiar() {
  resetDb();
  seedActiveAgreement();
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
}

// ===========================================================================
// 1. La declaración
// ===========================================================================

test('1.1 · la Empresa declara el deber legal y la norma que lo impone', () => {
  limpiar();
  crearEmpresa({ conDeber: true });

  const emp = empresaService.getById(EMPRESA);
  assert.equal(emp.conservacion_por_deber_legal, true);
  assert.equal(emp.norma_conservacion, NORMA);

  // Sin declararlo, el flag está apagado (y no es "undefined": es un no).
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
  crearEmpresa({ conDeber: false });
  const sinDeber = empresaService.getById(EMPRESA);
  assert.equal(sinDeber.conservacion_por_deber_legal, false);
  assert.equal(sinDeber.norma_conservacion, null);
});

test('1.1 · actualizar sin mandar el campo NO levanta el deber legal', () => {
  // Levantarlo es un acto, con actor y motivo. Un PUT de rutina no puede
  // dejarlo en off por accidente.
  limpiar();
  crearEmpresa({ conDeber: true });

  empresaService.update(EMPRESA, {
    razon_social: 'Empresa de Prueba S.A.S. (renombrada)',
  });

  const emp = empresaService.getById(EMPRESA);
  assert.equal(emp.conservacion_por_deber_legal, true,
    'un update que no menciona el flag no lo levanta');
});

test('1.1 · el flag se levanta SOLO si se pide explícitamente', () => {
  limpiar();
  crearEmpresa({ conDeber: true });

  empresaService.update(EMPRESA, {
    razon_social: 'Empresa de Prueba S.A.S.',
    conservacion_por_deber_legal: false,
  });

  assert.equal(empresaService.getById(EMPRESA).conservacion_por_deber_legal, false);
});

// ===========================================================================
// 2. El efecto en la firma: sin fecha de supresión y con hold automático
// ===========================================================================

test('1.1 · con deber legal la firma NO tiene fecha de supresión', async () => {
  limpiar();
  crearEmpresa({ conDeber: true });

  const { signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });

  const fila = db.prepare(
    'SELECT fecha_conservacion, hold_legal, motivo_hold, hold_actor FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);

  assert.equal(fila.fecha_conservacion, null,
    'con deber legal sin término no hay fecha de supresión: el plazo de la tabla no extingue el deber');
  assert.equal(fila.hold_legal, 1, 'la firma queda con hold legal');
  assert.equal(fila.hold_actor, 'sistema', 'el hold lo levanta el sistema, no un humano');
  assert.match(fila.motivo_hold, /deber_legal_/);
  assert.ok(fila.motivo_hold.includes(NORMA), 'el motivo dice qué norma impone el deber');
});

test('1.1 · el hold automático queda en gh_firma_holds y se puede liberar', async () => {
  limpiar();
  crearEmpresa({ conDeber: true });

  const { signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });

  const holds = db.prepare(
    'SELECT * FROM gh_firma_holds WHERE firma_id = ? AND activo = 1'
  ).all(signRequest.id);
  assert.equal(holds.length, 1, 'el hold queda registrado en su propio historial');
  assert.equal(holds[0].actor, 'sistema');
  assert.equal(holds[0].motivo, 'deber_legal_' + NORMA);

  // Se libera con actor y motivo: la relación laboral terminó o el documento
  // se sustituyó.
  conservacion.liberarHold(signRequest.id, {
    actor: 'operador:rrhh',
    motivo: 'relación laboral terminada',
  });

  const firmadas = db.prepare(
    'SELECT hold_legal, hold_liberado_at FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.equal(firmadas.hold_legal, 0, 'liberado el hold, la firma vuelve a ser elegible');
  assert.ok(firmadas.hold_liberado_at, 'la liberación queda fechada');

  // El historial NO se reescribe: la declaración original sigue ahí.
  const historia = db.prepare(
    'SELECT * FROM gh_firma_holds WHERE firma_id = ?'
  ).all(signRequest.id);
  assert.equal(historia.length, 1);
  assert.equal(historia[0].activo, 0);
});

test('1.1 · SIN deber legal, la firma sigue el plazo normal (sin hold)', async () => {
  limpiar();
  crearEmpresa({ conDeber: false, conPlazo: true });

  const { signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });

  const fila = db.prepare(
    'SELECT fecha_conservacion, hold_legal FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);

  assert.ok(fila.fecha_conservacion, 'sin deber legal, el plazo de la tabla aplica');
  assert.equal(fila.hold_legal, 0, 'y no hay hold');
});

// ===========================================================================
// 3. La salida al Trabajador
// ===========================================================================

test('1.1 · el Trabajador ve en la mini-app que su documento no se borra', async () => {
  limpiar();
  crearEmpresa({ conDeber: true });

  const app = makeApp();
  const { token } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });

  const res = await request(app)
    .get(`/s/${token}`)
    .set('Accept', 'application/json')
    .timeout({ response: 5000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.empresa.conservacion_por_deber_legal, true);
  assert.equal(res.body.empresa.norma_conservacion, NORMA);
});

test('1.1 · el correo de invitación dice que el documento no se borra', async () => {
  limpiar();
  crearEmpresa({ conDeber: true });
  mailer.clearDevInbox();

  const { signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });
  const signRequestService = require('../src/services/signRequest');
  await signRequestService.notifyRemote(signRequest, 'trabajador@example.com', {});

  const inbox = mailer.getDevInbox();
  assert.ok(inbox.length >= 1, 'debe haber correo');
  const cuerpo = inbox[inbox.length - 1].body;
  assert.ok(cuerpo.includes('no se borra automáticamente'),
    'el Trabajador tiene que saber que su documento no se borra: ' + cuerpo.slice(0, 200));
  assert.ok(cuerpo.includes(NORMA), 'y qué norma lo impone');
});

test('1.1 · sin deber legal, el correo NO dice eso', async () => {
  limpiar();
  crearEmpresa({ conDeber: false, conPlazo: true });
  mailer.clearDevInbox();

  const { signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });
  const signRequestService = require('../src/services/signRequest');
  await signRequestService.notifyRemote(signRequest, 'trabajador@example.com', {});

  const inbox = mailer.getDevInbox();
  const cuerpo = inbox[inbox.length - 1].body;
  assert.equal(cuerpo.includes('no se borra automáticamente'), false);
  assert.ok(cuerpo.includes('Plazo de conservación'), 'pero sí el plazo del 8.6');
});

// ===========================================================================
// 4. La base se niega a suprimir una firma con hold
// ===========================================================================

test('1.1 · con deber legal la firma NO es elegible para supresión', async () => {
  limpiar();
  crearEmpresa({ conDeber: true });

  const { signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });

  assert.equal(conservacion.esElegible(signRequest.id), false,
    'el hold hace que la firma no sea elegible para la purga');
  assert.equal(conservacion.vencidaPorConservacion(signRequest.id), false,
    'y no vence por conservación: el deber no tiene término');
});
