/**
 * LA DESCARGA DEL ACTA DE SUSCRIPCIÓN
 * ============================================================================
 *
 * El acta es el documento que la Empresa guarda y que K+AIR archiva en el
 * expediente. Este test comprueba el camino de la descarga:
 *
 * - La Empresa descarga el acta en PDF, con su huella en la cabecera.
 * - Un enlace que no firmó nada NO tiene acta.
 * - Un token que no existe NO tiene acta.
 * - Si el archivo en disco fue ALTERADO, no se sirve como si fuera el
 *   original: los bytes se comparan con la huella que se registró al
 *   suscribir.
 * - La CADUCIDAD del enlace no impide bajar el acta: la caducidad protege el
 *   acto de firmar, no el documento de un acto ya hecho.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const request = require('supertest');
const db = require('../../src/db/connection');
const anexoEncargo = require('../../src/services/anexoEncargo');
const actaEncargo = require('../../src/services/actaEncargo');
const mailer = require('../../src/services/mailer');
const { resetDb, makeApp } = require('../helpers');

const ID_EMPRESA = '900666444';
const CORREO_FIRMANTE = 'representante@empresa-acta.test';

const DATOS_S11 = {
  razon_social: 'EMPRESA DEL ACTA SAS',
  nit: '900666444-1',
  domicilio: 'Calle 47 # 43-57 Piso 2, Barranquilla',
  correo: CORREO_FIRMANTE,
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
  `).run(ID_EMPRESA, 'EMPRESA DEL ACTA SAS', '900666444-1',
    'Calle 47 # 43-57 Piso 2, Barranquilla', 'pqrs@empresa-acta.test',
    'datos@empresa-acta.test', 'PERSONA DE PRUEBA');
}

/** El último código de verificación que salió. */
function ultimoCodigo() {
  const inbox = mailer.getDevInbox();
  for (let i = inbox.length - 1; i >= 0; i--) {
    if (inbox[i].tipo === 'anexo_encargo' && inbox[i].otp) return inbox[i].otp;
  }
  return null;
}

/** Abre una suscripción, pide el código y suscribe. Devuelve el token. */
async function suscribir() {
  const app = makeApp();
  const abierto = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    nombre_firmante: 'PERSONA DE PRUEBA',
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(abierto.token, {});
  const res = await anexoEncargo.suscribir(abierto.token,
    { otp: ultimoCodigo(), acepta: true, datos_empresa: DATOS_S11 },
    { ip: '203.0.113.9', user_agent: 'Navegador/1.0' });
  return { app, token: abierto.token, res };
}

// ===========================================================================
// LA DESCARGA
// ===========================================================================

test('la Empresa descarga el acta en PDF, con su huella en la cabecera', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { app, token, res } = await suscribir();

  const descarga = await request(app)
    .get(`/api/anexo-encargo/${encodeURIComponent(token)}/acta`);

  assert.equal(descarga.status, 200);
  assert.equal(descarga.headers['content-type'], 'application/pdf');
  assert.match(descarga.headers['content-disposition'], /attachment; filename="acta-\d+-anexo-encargo\.pdf"/);
  assert.equal(descarga.headers['x-anexo-encargo-acta-hash'], res.acta.hash);

  // Lo que baja es un PDF de verdad, y son los MISMOS bytes que se firmaron.
  const bytes = descarga.body;
  assert.ok(Buffer.isBuffer(bytes));
  assert.equal(bytes.slice(0, 5).toString('latin1'), '%PDF-');
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash, res.acta.hash, 'el PDF que baja es el que se registró');

  fs.unlinkSync(actaEncargo.rutaActa(res.acta.archivo));
});

test('un enlace que no firmó nada NO tiene acta', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const abierto = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  }, { actor: 'admin' });

  const res = await request(makeApp())
    .get(`/api/anexo-encargo/${encodeURIComponent(abierto.token)}/acta`);

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'ACTA_NO_DISPONIBLE');
});

test('un token que no existe NO tiene acta', async () => {
  const res = await request(makeApp())
    .get('/api/anexo-encargo/token-que-no-existe/acta');

  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'ENLACE_NO_VALIDO');
});

test('si el acta en disco fue ALTERADA, no se sirve', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { app, token, res } = await suscribir();
  const ruta = actaEncargo.rutaActa(res.acta.archivo);

  // Alguien cambia el archivo después de escrito.
  fs.writeFileSync(ruta, Buffer.from('%PDF-1.7 archivo cambiado a mano'));

  const descarga = await request(app)
    .get(`/api/anexo-encargo/${encodeURIComponent(token)}/acta`);

  assert.equal(descarga.status, 409);
  assert.equal(descarga.body.error.code, 'ACTA_ALTERADA');

  fs.unlinkSync(ruta);
});

test('la caducidad del enlace NO impide bajar el acta', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { app, token, res } = await suscribir();

  // El enlace vence: lo que ya se firmó no se pierde.
  db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
    SET expira_enlace_at = ? WHERE id_empresa = ?`)
    .run('2020-01-01T00:00:00.000Z', ID_EMPRESA);

  const descarga = await request(app)
    .get(`/api/anexo-encargo/${encodeURIComponent(token)}/acta`);

  assert.equal(descarga.status, 200,
    'la caducidad protege el acto de firmar, no el documento de un acto hecho');
  assert.equal(crypto.createHash('sha256').update(descarga.body).digest('hex'), res.acta.hash);

  fs.unlinkSync(actaEncargo.rutaActa(res.acta.archivo));
});
