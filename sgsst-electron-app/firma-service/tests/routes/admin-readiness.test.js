/**
 * Tests del endpoint admin de readiness legal (Etapa 1).
 *
 * Qué se fija acá:
 *   - Sin X-Admin-API-Key responde 401.
 *   - Con la key responde 200 y el reporte tiene la forma esperada.
 *   - El gate por defecto es `primera_firma`.
 *   - `?gate=publicacion` cambia el gate.
 *   - Un gate inválido cae en `primera_firma` (no rompe el endpoint).
 *
 * No se publica nada, no se firma nada y no se enciende D-02.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../../src/db/connection');
const { resetDb, makeApp, TEST_ADMIN_API_KEY } = require('../helpers');

const ADMIN = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };

function limpiar() {
  resetDb();
  // resetDb() no limpia gh_firma_empresas: la tabla no participa de la firma.
  // Para que el reporte no dependa de empresas de otro test, se vacía acá.
  try {
    db.prepare('DELETE FROM gh_firma_empresas').run();
  } catch (e) { /* la tabla no existe en una BD vieja */ }
}

test.beforeEach(() => {
  limpiar();
});

test('readiness legal · sin API key responde 401', async () => {
  const app = makeApp();
  const res = await request(app).get('/internal/admin/readiness-legal');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('readiness legal · con API key responde 200 y la forma esperada', async () => {
  const app = makeApp();
  const res = await request(app)
    .get('/internal/admin/readiness-legal')
    .set(ADMIN);

  assert.equal(res.status, 200);
  assert.equal(res.body.gate, 'primera_firma');
  assert.equal(typeof res.body.listo, 'boolean');
  assert.equal(typeof res.body.generado_at, 'string');
  assert.ok(res.body.resumen);
  assert.equal(typeof res.body.resumen.total_items, 'number');
  assert.ok(Array.isArray(res.body.grupos));
  assert.ok(res.body.grupos.length >= 10);
  assert.ok(res.body.documentos);
  assert.ok(res.body.documentos.anexo_nube);
  assert.ok(res.body.documentos.anexo_encargo);
  assert.ok(res.body.documentos.acuerdo_v1_1);
  // La respuesta no debe exponer rutas absolutas del servidor.
  assert.equal(JSON.stringify(res.body).includes('C:\\'), false);
});

test('readiness legal · gate=publicacion cambia el gate', async () => {
  const app = makeApp();
  const res = await request(app)
    .get('/internal/admin/readiness-legal?gate=publicacion')
    .set(ADMIN);

  assert.equal(res.status, 200);
  assert.equal(res.body.gate, 'publicacion');
});

test('readiness legal · un gate inválido cae en primera_firma', async () => {
  const app = makeApp();
  const res = await request(app)
    .get('/internal/admin/readiness-legal?gate=otro')
    .set(ADMIN);

  assert.equal(res.status, 200);
  assert.equal(res.body.gate, 'primera_firma');
});

test('readiness legal · el gate de publicación no exige D-02 ni Anexo de Nube', async () => {
  const app = makeApp();
  const res = await request(app)
    .get('/internal/admin/readiness-legal?gate=publicacion')
    .set(ADMIN);

  assert.equal(res.status, 200);
  const grupos = new Set(res.body.bloqueantes.map((b) => b.grupo));
  assert.equal(grupos.has('d02'), false);
  assert.equal(grupos.has('anexo_nube'), false);
  assert.equal(grupos.has('anexo_encargo'), false);
  assert.ok(grupos.has('acuerdo_v1_1'));
});
