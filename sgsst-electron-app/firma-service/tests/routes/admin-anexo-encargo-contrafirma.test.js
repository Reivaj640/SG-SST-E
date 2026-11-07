/**
 * LAS RUTAS DE LA CONTRAFIRMA DEL ANEXO DE ENCARGO
 * ============================================================================
 *
 * La contrafirma es un ACTO de K+AIR que ejecuta el instrumento y habilita a
 * la Empresa para firmar documentos de sus trabajadores. Por eso sus rutas
 * son de ADMINISTRACIÓN (con la llave de admin) y exigen `X-Admin-Motivo`.
 *
 * Lo que se comprueba acá:
 *
 * - Sin la llave de admin no se pide el código ni se contrafirma (401).
 * - EL FLUJO COMPLETO POR HTTP: el operador abre la suscripción, la Empresa
 *   pide el código y se suscribe, K+AIR verifica al representante, pide el
 *   código de contrafirma y contrafirma. De principio a fin, por HTTP.
 * - Que la ruta del código NO ACEPTA un canal declarado: el canal es el de la
 *   configuración de K+AIR y el esquema es estricto, así que un `canal_codigo`
 *   en el cuerpo se rechaza (400).
 * - Que la contrafirma exige la aceptación expresa y el motivo.
 * - Que al contrafirmar, la Empresa queda habilitada y la ficha tiene la fecha
 *   de ejecución del instrumento.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../../src/db/connection');
const empresaService = require('../../src/services/empresa');
const mailer = require('../../src/services/mailer');
const config = require('../../src/config');
const {
  resetDb, makeApp, TEST_ADMIN_API_KEY,
} = require('../helpers');

const ADMIN = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };
const ID_EMPRESA = '900777444';
const RAZON_SOCIAL = 'EMPRESA DE LA CONTRAFIRMA SAS';
const CORREO_FIRMANTE = 'representante@empresa-contrafirma.test';
const CANAL_CODIGO = 'segundo-canal@empresa-contrafirma.test';
const CONFIRMACION_CANAL = 'Confirmado por llamada de prueba';
const REPRESENTANTE = { documento: '900123456', calidad: 'REPRESENTANTE_LEGAL' };
const MOTIVO = 'Verificado el certificado de la cámara de comercio';

const DATOS_S11 = {
  razon_social: RAZON_SOCIAL,
  nit: '900777444-1',
  domicilio: 'Calle 47 # 43-57 Piso 2, Barranquilla',
  correo: 'datos@empresa-contrafirma.test',
  representante: 'PERSONA DE PRUEBA',
};

// ===========================================================================
// HELPERS
// ===========================================================================

function sembrarEmpresa() {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, domicilio, canal_pqrs,
       responsable_tratamiento_correo, representante_legal, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(ID_EMPRESA, RAZON_SOCIAL, '900777444-1',
    'Calle 47 # 43-57 Piso 2, Barranquilla', 'pqrs@empresa-contrafirma.test',
    'datos@empresa-contrafirma.test', 'PERSONA DE PRUEBA');
}

/** El código del tipo pedido. */
function codigoDe(tipo) {
  const inbox = mailer.getDevInbox();
  for (let i = inbox.length - 1; i >= 0; i--) {
    if (inbox[i].tipo === tipo && inbox[i].otp) return inbox[i].otp;
  }
  return null;
}

function rutaAdmin(sufijo) {
  return `/internal/admin/empresas/${ID_EMPRESA}/anexo-encargo/${sufijo}`;
}

/**
 * El recorrido completo hasta la suscripción y la verificación del
 * representante: lo que hay que tener para poder contrafirmar.
 *
 * @returns {Promise<number>} el id de la suscripción.
 */
async function hastaLaVerificacion() {
  const app = makeApp();

  const abierto = await request(app)
    .post(rutaAdmin('suscripcion'))
    .set(ADMIN)
    .send({
      correo_firmante: CORREO_FIRMANTE,
      canal_codigo: CANAL_CODIGO,
      canal_codigo_confirmacion: CONFIRMACION_CANAL,
    });
  assert.equal(abierto.status, 201, 'la suscripción tiene que abrirse');
  const token = abierto.body.token;

  await request(app)
    .post(`/api/anexo-encargo/${encodeURIComponent(token)}/codigo`)
    .send({});
  const otp = codigoDe('anexo_encargo');
  assert.ok(otp, 'tiene que salir el código de la suscripción');

  const suscrito = await request(app)
    .post(`/api/anexo-encargo/${encodeURIComponent(token)}/suscribir`)
    .send({
      otp,
      acepta: true,
      acepta_tratamiento: true,
      datos_empresa: DATOS_S11,
      representante: REPRESENTANTE,
    });
  assert.equal(suscrito.status, 200, 'la Empresa tiene que poder suscribir');

  const idSuscripcion = db.prepare(
    'SELECT id FROM gh_firma_anexo_encargo_suscripciones').get().id;

  const verificado = await request(app)
    .post(rutaAdmin(`suscripcion/${idSuscripcion}/verificar-representante`))
    .set(ADMIN)
    .set('X-Admin-Motivo', MOTIVO)
    .send({
      tipo_documento: 'CERTIFICADO_CAMARA',
      referencia: 'Radicado 2026-11-07-14',
    });
  assert.equal(verificado.status, 200, 'la verificación tiene que registrarse');

  return idSuscripcion;
}

// ===========================================================================
// LA LLAVE DE ADMIN
// ===========================================================================

test('sin la llave de admin no se pide el código de contrafirma', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();
  const idSuscripcion = await hastaLaVerificacion();

  const res = await request(makeApp())
    .post(rutaAdmin('contrafirmar/codigo'))
    .send({ id_suscripcion: idSuscripcion });

  assert.equal(res.status, 401,
    'la contrafirma es un acto de K+AIR: sin la llave no se pide el código');
});

test('sin la llave de admin no se contrafirma', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();
  const idSuscripcion = await hastaLaVerificacion();

  const res = await request(makeApp())
    .post(rutaAdmin('contrafirmar'))
    .send({ id_suscripcion: idSuscripcion, otp: '123456', acepta: true });

  assert.equal(res.status, 401);
});

// ===========================================================================
// EL CANAL NO SE DECLARA
// ===========================================================================

test('la ruta del código NO acepta un canal declarado', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();
  const idSuscripcion = await hastaLaVerificacion();

  const res = await request(makeApp())
    .post(rutaAdmin('contrafirmar/codigo'))
    .set(ADMIN)
    .send({ id_suscripcion: idSuscripcion, canal_codigo: 'intruso@atacante.test' });

  assert.equal(res.status, 400,
    'el canal es el de la configuración de K+AIR: no se puede declarar');
  assert.ok(res.body && res.body.error,
    'el error tiene que venir en la envoltura del servicio');
});

// ===========================================================================
// EL FLUJO COMPLETO
// ===========================================================================

test('el flujo completo: la Empresa suscribe, K+AIR contrafirma', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();
  const app = makeApp();

  const idSuscripcion = await hastaLaVerificacion();

  // ANTES DE LA CONTRAFIRMA: la Empresa NO puede firmar.
  assert.equal(empresaService.verificarHabilitacionFirma(ID_EMPRESA).ok, false,
    'con la suscripción sola no se puede firmar: falta la contrafirma');

  // 1. El código de contrafirma.
  const pedido = await request(app)
    .post(rutaAdmin('contrafirmar/codigo'))
    .set(ADMIN)
    .send({ id_suscripcion: idSuscripcion });
  assert.equal(pedido.status, 200);

  const correo = mailer.getDevInbox()
    .filter((c) => c.tipo === 'anexo_encargo_contrafirma').pop();
  assert.ok(correo, 'tiene que salir el correo del código de contrafirma');
  assert.equal(correo.to, config.canalProteccionDatos,
    'el código sale al buzón de K+AIR, no a uno que elija quien lo pide');

  // 2. La contrafirma.
  const res = await request(app)
    .post(rutaAdmin('contrafirmar'))
    .set(ADMIN)
    .set('X-Admin-Motivo', MOTIVO)
    .send({ id_suscripcion: idSuscripcion, otp: correo.otp, acepta: true });
  assert.equal(res.status, 200);
  assert.equal(res.body.contrafirmado, true);
  assert.ok(res.body.contrafirmado_at);
  assert.ok(res.body.acta && res.body.acta.hash,
    'la contrafirma genera su acta, con su huella');

  // 3. La ficha: la fecha de ejecución y la habilitación.
  const empresa = empresaService.getById(ID_EMPRESA);
  assert.ok(empresa.anexo_encargo_firmado_at,
    'la ficha tiene la fecha de ejecución del instrumento');
  assert.equal(empresaService.verificarHabilitacionFirma(ID_EMPRESA).ok, true,
    'con la contrafirma, la Empresa ya puede firmar documentos de sus trabajadores');
});

test('la contrafirma exige la aceptación expresa y el motivo', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();
  const app = makeApp();

  const idSuscripcion = await hastaLaVerificacion();
  await request(app)
    .post(rutaAdmin('contrafirmar/codigo'))
    .set(ADMIN)
    .send({ id_suscripcion: idSuscripcion });
  const otp = codigoDe('anexo_encargo_contrafirma');

  // Sin `acepta`: el esquema lo pide (es obligatorio).
  const sinAcepta = await request(app)
    .post(rutaAdmin('contrafirmar'))
    .set(ADMIN)
    .set('X-Admin-Motivo', MOTIVO)
    .send({ id_suscripcion: idSuscripcion, otp });
  assert.equal(sinAcepta.status, 400);

  // Con `acepta: false`: el esquema lo acepta (es un booleano) pero el
  // servicio no: la contrafirma es expresa.
  const conFalse = await request(app)
    .post(rutaAdmin('contrafirmar'))
    .set(ADMIN)
    .set('X-Admin-Motivo', MOTIVO)
    .send({ id_suscripcion: idSuscripcion, otp, acepta: false });
  assert.equal(conFalse.status, 400);
  assert.equal(conFalse.body.error.code, 'ACEPTACION_REQUERIDA');

  // Sin motivo: es un acto que habilita a la Empresa.
  const sinMotivo = await request(app)
    .post(rutaAdmin('contrafirmar'))
    .set(ADMIN)
    .send({ id_suscripcion: idSuscripcion, otp, acepta: true });
  assert.equal(sinMotivo.status, 400);
  assert.equal(sinMotivo.body.error.code, 'MOTIVO_REQUERIDO');
});

test('la contrafirma de una suscripción de otra empresa no se puede', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();
  const idSuscripcion = await hastaLaVerificacion();

  const res = await request(makeApp())
    .post(rutaAdmin('contrafirmar/codigo'))
    .set(ADMIN)
    .send({ id_suscripcion: idSuscripcion + 999 });

  assert.equal(res.status, 404,
    'la suscripción tiene que ser de esa empresa');
});
