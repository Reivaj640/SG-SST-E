/**
 * Tests de los endpoints admin de identificación de empresas (migración 017).
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * --------------------------
 * El router de empresas estaba montado en el servidor real pero NO en el
 * `makeApp()` de los tests: nadie ejercitaba `/internal/admin/empresas`, y
 * por eso un error de wiring pasó inadvertido. El middleware de
 * autenticación administrativa se usaba SIN INVOCAR (`adminApiAuth` en vez de
 * `adminApiAuth()`), así que Express recibía una fábrica de middleware en
 * lugar de un middleware: la petición no avanzaba, no devolvía 401 y se
 * quedaba colgada para siempre. En la práctica, dar de alta una empresa por
 * el API de administración no respondía NUNCA.
 *
 * Estos tests fijan el comportamiento correcto:
 *   - sin key: 401 (no un cuelgue);
 *   - con key equivocada: 401;
 *   - con key válida: el alta, el anexo firmado, el estado y la consulta.
 *
 * Todos los datos son sintéticos.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../../src/db/connection');
const {
  resetDb, makeApp, TEST_ADMIN_API_KEY,
} = require('../helpers');

const ADMIN = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };
const EMPRESA = '900123456';

const ALTA = {
  id_empresa: EMPRESA,
  razon_social: 'Empresa de Prueba S.A.S.',
  nit: '900123456',
  domicilio: 'Bogota D.C.',
  representante_legal: 'Javier Robles',
  representante_legal_identificacion: '79123456',
  responsable_tratamiento: 'Javier Robles',
  responsable_tratamiento_correo: 'privacidad@example.com',
  canal_pqrs: 'pqrs@example.com',
  canal_incidentes: 'seguridad@example.com',
  politica_datos_url: 'https://example.com/privacidad',
  plazo_retencion: '5 anos',
  canal_solicitud_copia: 'privacidad@example.com',
  plazo_retencion_dias: 1825,
};

function limpiar() {
  resetDb();
  // resetDb() no limpia gh_firma_empresas: la tabla no participa del
  // firmware de los consentimientos. Se limpia aparte para que cada test
  // arranque sin empresas.
  try { db.prepare('DELETE FROM gh_firma_empresas').run(); } catch (e) { /* no existe */ }
}

test('admin empresas · sin key devuelve 401 (y no se queda colgado)', async () => {
  limpiar();
  const res = await request(makeApp())
    .get('/internal/admin/empresas')
    .timeout({ response: 3000 });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('admin empresas · con key equivocada devuelve 401', async () => {
  limpiar();
  const res = await request(makeApp())
    .get('/internal/admin/empresas')
    .set('X-Admin-API-Key', 'clave-que-no-es')
    .timeout({ response: 3000 });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('admin empresas · el alta guarda la identificación y el plazo', async () => {
  limpiar();
  const res = await request(makeApp())
    .post('/internal/admin/empresas')
    .set(ADMIN)
    .send(ALTA)
    .timeout({ response: 3000 });

  assert.equal(res.status, 201);
  assert.equal(res.body.id_empresa, EMPRESA);
  assert.equal(res.body.razon_social, ALTA.razon_social);
  assert.equal(res.body.plazo_retencion_dias, 1825);
  assert.equal(res.body.activo, true);
  assert.equal(res.body.anexo_encargo_firmado_at, null);
});

test('admin empresas · el alta repetida devuelve 409', async () => {
  limpiar();
  const app = makeApp();
  await request(app).post('/internal/admin/empresas').set(ADMIN).send(ALTA);

  const res = await request(app)
    .post('/internal/admin/empresas')
    .set(ADMIN)
    .send(ALTA)
    .timeout({ response: 3000 });

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'EMPRESA_ALREADY_EXISTS');
});

test('admin empresas · un body incompleto devuelve 400', async () => {
  limpiar();
  const res = await request(makeApp())
    .post('/internal/admin/empresas')
    .set(ADMIN)
    .send({ id_empresa: EMPRESA })
    .timeout({ response: 3000 });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('admin empresas · el Anexo firmado se registra en su propio endpoint', async () => {
  limpiar();
  const app = makeApp();
  await request(app).post('/internal/admin/empresas').set(ADMIN).send(ALTA);

  const res = await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/anexo-firmado`)
    .set(ADMIN)
    .send({ fecha: '2026-10-20' })
    .timeout({ response: 3000 });

  assert.equal(res.status, 200);
  assert.ok(res.body.anexo_encargo_firmado_at, 'la fecha del Anexo queda registrada');
});

test('admin empresas · quitar el Anexo exige motivo y deja rastro', async () => {
  limpiar();
  const app = makeApp();
  await request(app).post('/internal/admin/empresas').set(ADMIN).send(ALTA);
  await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/anexo-firmado`)
    .set(ADMIN)
    .send({ fecha: '2026-10-20' });

  const sinMotivo = await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/anexo-firmado/quitar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'Operador de prueba')
    .timeout({ response: 3000 });

  assert.equal(sinMotivo.status, 400);
  assert.equal(sinMotivo.body.error.code, 'MOTIVO_REQUERIDO');

  const conMotivo = await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/anexo-firmado/quitar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'Operador de prueba')
    .set('X-Admin-Motivo', 'No existe el PDF firmado; se vuelve a firmar')
    .timeout({ response: 3000 });

  assert.equal(conMotivo.status, 200);
  assert.equal(conMotivo.body.anexo_encargo_firmado_at, null);

  const historial = await request(app)
    .get(`/internal/admin/empresas/${EMPRESA}/historial`)
    .set(ADMIN)
    .timeout({ response: 3000 });

  const fila = historial.body.items.find(
    (i) => i.campo === 'anexo_encargo_firmado_at' && i.valor_nuevo === null
  );
  assert.ok(fila, 'el desmarcado queda en el historial');
  assert.equal(fila.id_actor, 'Operador de prueba');
  assert.match(String(fila.motivo), /PDF/i);
});

test('admin empresas · cambiar una fecha ya registrada exige motivo', async () => {
  limpiar();
  const app = makeApp();
  await request(app).post('/internal/admin/empresas').set(ADMIN).send(ALTA);
  await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/anexo-firmado`)
    .set(ADMIN)
    .send({ fecha: '2026-10-20' });

  const sinMotivo = await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/anexo-firmado`)
    .set(ADMIN)
    .send({ fecha: '2026-10-19' })
    .timeout({ response: 3000 });

  assert.equal(sinMotivo.status, 400);
  assert.equal(sinMotivo.body.error.code, 'MOTIVO_REQUERIDO');

  const conMotivo = await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/anexo-firmado`)
    .set(ADMIN)
    .set('X-Admin-Motivo', 'Corrección de la fecha contra el PDF')
    .send({ fecha: '2026-10-19' })
    .timeout({ response: 3000 });

  assert.equal(conMotivo.status, 200);
  assert.equal(conMotivo.body.anexo_encargo_firmado_at, '2026-10-19T00:00:00.000Z');
});

test('admin empresas · una fecha futura del Anexo se rechaza', async () => {
  limpiar();
  const app = makeApp();
  await request(app).post('/internal/admin/empresas').set(ADMIN).send(ALTA);

  const futura = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const res = await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/anexo-firmado`)
    .set(ADMIN)
    .send({ fecha: futura })
    .timeout({ response: 3000 });

  assert.equal(res.status, 400);
  assert.match(res.body.error.message, /futura/i);
});

test('admin empresas · el estado se puede cambiar sin tocar la identidad', async () => {
  limpiar();
  const app = makeApp();
  await request(app).post('/internal/admin/empresas').set(ADMIN).send(ALTA);

  const res = await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/estado`)
    .set(ADMIN)
    .send({ activo: false })
    .timeout({ response: 3000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.activo, false);
  assert.equal(res.body.razon_social, ALTA.razon_social);
});

test('admin empresas · la consulta devuelve la empresa y 404 si no existe', async () => {
  limpiar();
  const app = makeApp();
  await request(app).post('/internal/admin/empresas').set(ADMIN).send(ALTA);

  const ok = await request(app)
    .get(`/internal/admin/empresas/${EMPRESA}`)
    .set(ADMIN)
    .timeout({ response: 3000 });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.id_empresa, EMPRESA);

  const lista = await request(app)
    .get('/internal/admin/empresas')
    .set(ADMIN)
    .timeout({ response: 3000 });
  assert.equal(lista.status, 200);
  assert.equal(lista.body.items.length, 1);

  const noExiste = await request(app)
    .get('/internal/admin/empresas/900999999')
    .set(ADMIN)
    .timeout({ response: 3000 });
  assert.equal(noExiste.status, 404);
});
