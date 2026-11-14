/**
 * Tests del plazo de conservacion y el canal de copia (numerales 8.6 y 10.6
 * del Acuerdo de uso).
 *
 * QUE PRUEBA
 * ----------
 * El numeral 8.6 obliga a la Empresa a comunicarle al Trabajador, ANTES de
 * solicitarle la firma, el plazo que le resulta aplicable al documento y
 * dónde puede pedir una copia. El numeral 10.6 deja claro que ese plazo sale
 * de la tabla de retencion documental de la EMPRESA (que es el Responsable,
 * numeral 10.1), no de K+AIR.
 *
 * Lo que se verifica aca es la parte que le toca al sistema:
 *  - La Empresa puede DECLARAR el plazo y el canal.
 *  - Quedan en el snapshot archivado con el consentimiento, y su huella
 *    cambia si cambian (o sea: lo que se le mostro al firmante queda
 *    amarrado a lo que se archivo).
 *  - La mini-app los muestra en el bloque «Empresa que solicita tu firma».
 *  - El correo de invitacion los comunica (es la comunicacion que sale antes
 *    de que el Trabajador firme).
 *  - Si la Empresa NO los declara, la firma se puede pedir igual (D-03) y el
 *    plazo que se le aplica es el POR DEFECTO de la tabla supletoria, que
 *    desde el 13-nov-2026 está ABIERTA por el acto expreso y fechado del
 *    owner (la S-25): diez (10) años contados desde la fecha de la firma, sin
 *    hold. La rama CERRADA (sin plazo aplicable, con el registro retenido
 *    esperando la apertura de la tabla) también se prueba, con la tabla
 *    cerrada inyectada.
 *
 * Tests:
 *   - node --test tests/plazo-retencion.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  resetDb, makeApp, createSignRequestWithIdentificacion,
  tablaConservacionCerrada,
} = require('./helpers');
const empresaService = require('../src/services/empresa');
const signRequestService = require('../src/services/signRequest');
const mailer = require('../src/services/mailer');
const db = require('../src/db/connection');
const retencion = require('../src/services/retencion');

const PLAZO = '5 años para hoja de vida; 10 años para contrataciones.';

// La tabla con la COMPUERTA CERRADA, para la rama cerrada del mecanismo.
const TABLA_CERRADA = tablaConservacionCerrada();
const CANAL = 'RRHH por correo o en la sede de la empresa.';

const EMPRESA = {
  id_empresa: '900123456',
  razon_social: 'EMPRESA DE PRUEBA SAS',
  nit: '900123456-1',
  domicilio: 'Calle 1 # 2-3',
  responsable_tratamiento: 'Nombre Responsable',
  canal_pqrs: 'pqrs@empresa.test',
};

/** Crea la empresa con (o sin) el plazo declarado. */
function _crearEmpresa(conPlazo = true) {
  // `resetDb` ahora vacía gh_firma_empresas (no está en su lista de tablas),
  // así que la empresa se borra explícitamente para que cada test arranque
  // desde cero.
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?')
    .run(EMPRESA.id_empresa);
  const creada = empresaService.create(conPlazo
    ? Object.assign({}, EMPRESA, {
      plazo_retencion: PLAZO,
      canal_solicitud_copia: CANAL,
      // El plazo COMPUTABLE en días (migración 023). El D-03 lo exige: sin
      // número de días no hay fecha de conservación y la firma se conserva
      // de forma indefinida. El texto (PLAZO) es lo que lee el firmante.
      plazo_retencion_dias: 1825,
    })
    : EMPRESA);
  // D-03: con el bloqueo activo, una empresa sin Anexo de Encargo firmado no
  // puede pedir firmas. Estos tests no van de eso, así que la empresa de
  // prueba queda habilitada (el Anexo) y lo que se variationa es el plazo.
  empresaService.marcarAnexoFirmado(EMPRESA.id_empresa, '2026-10-20');
  return creada;
}

// =====================================================================
// La Empresa declara el plazo y el canal
// =====================================================================

test('la empresa guarda el plazo de conservacion y el canal de copia', () => {
  resetDb();
  _crearEmpresa(true);

  const emp = empresaService.getById(EMPRESA.id_empresa);
  assert.equal(emp.plazo_retencion, PLAZO);
  assert.equal(emp.canal_solicitud_copia, CANAL);
});

test('el snapshot de la empresa incluye el plazo y el canal', () => {
  resetDb();
  _crearEmpresa(true);

  const snap = empresaService.buildSnapshot(EMPRESA.id_empresa);
  assert.ok(snap, 'debe construir snapshot');
  assert.equal(snap.datos.plazo_retencion, PLAZO);
  assert.equal(snap.datos.canal_solicitud_copia, CANAL);
});

test('MUTACION: cambiar el plazo cambia la huella del snapshot', () => {
  // Si el plazo no estuviera dentro del snapshot archivado, cambiarlo no
  // cambiaria la huella: la constancia seguiria firmando "lo que el
  // firmante vio" cuando en realidad ya no es lo que vio.
  resetDb();
  _crearEmpresa(true);
  const antes = empresaService.buildSnapshot(EMPRESA.id_empresa).huella;

  empresaService.update(EMPRESA.id_empresa, Object.assign({}, EMPRESA, {
    plazo_retencion: PLAZO + ' (modificado)',
    canal_solicitud_copia: CANAL,
  }));
  const despues = empresaService.buildSnapshot(EMPRESA.id_empresa).huella;

  assert.notEqual(antes, despues, 'la huella debe cambiar si cambia el plazo');
});

test('la vista publica de la empresa expone el plazo y el canal', () => {
  resetDb();
  _crearEmpresa(true);

  const vista = empresaService.publicViewFor(EMPRESA.id_empresa);
  assert.equal(vista.plazo_retencion, PLAZO);
  assert.equal(vista.canal_solicitud_copia, CANAL);
});

// =====================================================================
// La mini-app lo muestra al firmante
// =====================================================================

test('la mini-app muestra el plazo y el canal en el bloque de la empresa', async () => {
  resetDb();
  _crearEmpresa(true);
  const { token } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA.id_empresa,
  });

  const app = makeApp();
  const res = await request(app)
    .get(`/s/${token}`)
    .set('Accept', 'application/json');

  assert.equal(res.status, 200);
  assert.ok(res.body.empresa, 'la mini-app debe recibir el bloque de empresa');
  assert.equal(res.body.empresa.plazo_retencion, PLAZO);
  assert.equal(res.body.empresa.canal_solicitud_copia, CANAL);
});

// =====================================================================
// El correo de invitacion los comunica (numeral 8.6)
// =====================================================================

test('el correo de invitacion comunica el plazo y el canal de copia', async () => {
  resetDb();
  mailer.clearDevInbox();
  _crearEmpresa(true);
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA.id_empresa,
  });

  await signRequestService.notifyRemote(signRequest, 'trabajador@example.com', {});

  const inbox = mailer.getDevInbox();
  assert.equal(inbox.length, 1, 'debe haber un correo de invitación');
  const cuerpo = inbox[0].body;
  assert.ok(cuerpo.includes(PLAZO), 'el correo debe comunicar el plazo de conservación');
  assert.ok(cuerpo.includes(CANAL), 'el correo debe comunicar el canal para pedir copia');
});

test('D-03 · si la empresa no declara plazo, la firma SÍ se puede pedir', async () => {
  // La Empresa no tiene NADA que declarar para pedir firmas: la falta de un
  // plazo declarado no bloquea la solicitud.
  //
  // Lo de la conservación (J8 y J9): desde el 13-nov-2026 la compuerta de la
  // tabla supletoria la ABRIÓ el owner con su acto expreso y fechado (la S-25),
  // asi que sin plazo declarado por la Empresa aplica el plazo POR DEFECTO de
  // esa tabla: diez (10) años contados desde la fecha de la firma. No hay hold:
  // el catálogo legado de veinte (20) años desde la firma se retiró (J8 y J9)
  // y la tabla abierta no deja nada pendiente.
  resetDb();
  _crearEmpresa(false);

  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA.id_empresa,
  });
  assert.ok(signRequest && signRequest.id_solicitud,
    'una empresa sin plazo declarado puede pedir firmas');
  assert.ok(signRequest.fecha_conservacion,
    'con la compuerta abierta hay fecha de supresión: el plazo por defecto de la tabla');
  assert.equal(signRequest.hold_legal, 0,
    'y el registro NO queda retenido: la tabla supletoria ya está activada');
  assert.equal(signRequest.motivo_hold, null,
    'no hay ningún motivo de hold');
  assert.notEqual(signRequest.motivo_hold, 'plazo_no_declarado',
    'el motivo viejo (retención indefinida por falta de configuración) ya no existe');

  // La fuente del plazo se lee de la BASE: no viene en el objeto devuelto.
  const fila = db.prepare(
    'SELECT plazo_conservacion_fuente, fecha_conservacion, hold_legal, motivo_hold '
    + 'FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud);
  assert.equal(fila.plazo_conservacion_fuente, 'tabla_supletoria',
    'el plazo sale de la tabla supletoria que administra K+AIR');
  assert.equal(fila.fecha_conservacion, signRequest.fecha_conservacion);
  assert.equal(fila.hold_legal, 0);
  assert.equal(fila.motivo_hold, null);
});

test('si la empresa no declara plazo, el correo dice el plazo que REALMENTE aplica', async () => {
  // El correo es la comunicación del 8.6(g): tiene que decir el plazo que se
  // aplica. No puede prometer un plazo que el sistema no tiene, ni callar de
  // dónde viene.
  //
  // CON LA COMPUERTA ABIERTA (que es como se despacha desde el 13-nov-2026, con
  // el acto expreso y fechado del owner) el plazo que aplica sin declaración de
  // la Empresa es el POR DEFECTO de la tabla supletoria: diez (10) años
  // contados desde la fecha de la firma. El correo lo dice y dice de dónde
  // sale. El catálogo legado de veinte (20) años desde la firma se retiró
  // (J8 y J9) y no puede prometer.
  resetDb();
  mailer.clearDevInbox();
  _crearEmpresa(false);

  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA.id_empresa,
  });

  await signRequestService.notifyRemote(signRequest, 'trabajador@example.com', {});

  const inbox = mailer.getDevInbox();
  assert.equal(inbox.length, 1);
  const cuerpo = inbox[0].body;
  assert.ok(!cuerpo.includes('20 años'),
    'el correo no puede prometer veinte (20) años desde la firma: ese catálogo se retiró (J8 y J9)');
  assert.ok(cuerpo.includes('10 años'),
    'el correo dice el plazo que realmente aplica: el de la tabla supletoria');
  assert.ok(cuerpo.includes('tabla de conservación del sistema'),
    'y dice de dónde sale: la tabla supletoria que administra K+AIR');
  assert.ok(!/pendiente/i.test(cuerpo),
    'el plazo ya no está pendiente de ninguna validación');
  assert.ok(!cuerpo.includes('Dónde puedes pedir una copia'),
    'no debe aparecer una línea de canal si la empresa no lo declaró');
  // El correo sale igual: la comunicación es un deber, no puede bloquear
  // la invitación.
  assert.ok(cuerpo.includes('ID de solicitud'), 'el correo debe salir igual');
});

test('con la compuerta CERRADA, el correo dice que el plazo NO es aplicable todavia', async () => {
  // La rama cerrada del mecanismo sigue viva: la compuerta la puede cerrar
  // otro acto del owner, y el respaldo interno del código arranca cerrado.
  // Sin plazo declarado por la Empresa NO hay fecha de supresión: el registro
  // queda retenido con el motivo de la tabla pendiente y el correo lo dice.
  //
  // El texto NO se transcribe: sale del motor, con la tabla cerrada inyectada.
  resetDb();
  mailer.clearDevInbox();
  _crearEmpresa(false);

  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA.id_empresa,
  });

  const fila = db.prepare(
    'SELECT fecha_creacion, categoria_retencion FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud);
  const plan = retencion.planificar({
    categoria_retencion: fila.categoria_retencion,
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    empresa: { plazo_retencion: null, plazo_retencion_dias: null },
    tabla_conservacion: TABLA_CERRADA,
  });
  assert.equal(plan.fecha_conservacion, null,
    'con la compuerta cerrada no hay fecha de supresión');
  assert.equal(plan.hold.motivo, 'tabla_supletoria_pendiente_validacion');

  // El alta con la compuerta cerrada devolvería el plan cerrado: eso es lo que
  // se comunica en el correo.
  await signRequestService.notifyRemote(Object.assign({}, signRequest, {
    plazo_retencion_aplicable: plan.texto,
    hold_legal: 1,
    motivo_hold: plan.hold.motivo,
  }), 'trabajador@example.com', {});

  const cuerpo = mailer.getDevInbox()[0].body;
  assert.ok(cuerpo.includes(plan.texto),
    'el correo dice el texto del motor con la tabla cerrada');
  assert.ok(!cuerpo.includes('tabla de conservación del sistema'),
    'el plazo del sistema no sale de la tabla mientras la compuerta esté cerrada');
  assert.ok(!cuerpo.includes('20 años'),
    'y el catálogo legado de veinte (20) años está retirado (J8 y J9)');
  assert.match(cuerpo, /pendiente/i,
    'el correo dice que el plazo aplicable está pendiente');
});

test('MUTACION: el correo comunica el plazo de la EMPRESA, no uno del sistema', async () => {
  // Si el sistema se inventara el plazo, este test lo detectaria: el texto
  // del correo tiene que ser exactamente el que declaró la empresa.
  resetDb();
  mailer.clearDevInbox();
  _crearEmpresa(true);
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA.id_empresa,
  });

  await signRequestService.notifyRemote(signRequest, 'trabajador@example.com', {});

  const cuerpo = mailer.getDevInbox()[0].body;
  const linea = cuerpo.split('\n').find((l) => l.includes('Plazo de conservación'));
  assert.ok(linea, 'debe haber una línea de plazo');
  assert.equal(linea, 'Plazo de conservación de tus datos: ' + PLAZO);
});
