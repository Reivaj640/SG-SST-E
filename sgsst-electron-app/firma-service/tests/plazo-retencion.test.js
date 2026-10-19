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
 *  - Si la Empresa NO los declara, el sistema NO inventa un plazo.
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
} = require('./helpers');
const empresaService = require('../src/services/empresa');
const signRequestService = require('../src/services/signRequest');
const mailer = require('../src/services/mailer');
const db = require('../src/db/connection');

const PLAZO = '5 años para hoja de vida; 10 años para contrataciones.';
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
  // `resetDb` no vacía gh_firma_empresas (no está en su lista de tablas),
  // así que la empresa se borra explícitamente para que cada test arranque
  // desde cero.
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?')
    .run(EMPRESA.id_empresa);
  return empresaService.create(conPlazo
    ? Object.assign({}, EMPRESA, { plazo_retencion: PLAZO, canal_solicitud_copia: CANAL })
    : EMPRESA);
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

test('si la empresa no declara plazo, el correo NO inventa uno', async () => {
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
  assert.ok(!cuerpo.includes('Plazo de conservación'),
    'no debe aparecer una línea de plazo si la empresa no lo declaró');
  assert.ok(!cuerpo.includes('Dónde puedes pedir una copia'),
    'no debe aparecer una línea de canal si la empresa no lo declaró');
  // El correo sale igual: la comunicación es un deber de la Empresa, no
  // puede bloquear la invitación.
  assert.ok(cuerpo.includes('ID de solicitud'), 'el correo debe salir igual');
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
