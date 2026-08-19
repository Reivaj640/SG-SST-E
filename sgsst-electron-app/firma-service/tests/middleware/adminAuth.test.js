/**
 * Tests del middleware adminApiAuth() (Bloque B).
 *
 * Cubre:
 * - Sin header X-Admin-API-Key → 401 INVALID_API_KEY
 * - Con header incorrecto → 401 INVALID_API_KEY
 * - Con header correcto → 200 y req.adminAuth = true
 *
 * NOTA: este test NO usa makeApp() porque queremos probar el middleware
 * aislado, sin todo el routing del server. El adminRouter real se prueba
 * en tests/routes/admin.test.js.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { adminApiAuth } = require('../../src/middleware/auth');
const { errorHandler } = require('../../src/middleware/errors');
const { TEST_ADMIN_API_KEY } = require('../helpers');

function makeProtectedApp() {
  const app = express();
  app.get('/protected', adminApiAuth(), (req, res) => {
    res.json({ ok: true, adminAuth: !!req.adminAuth });
  });
  app.use(errorHandler());
  return app;
}

test('adminApiAuth: sin header X-Admin-API-Key → 401 INVALID_API_KEY', async () => {
  const app = makeProtectedApp();
  const res = await request(app).get('/protected');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
  assert.match(res.body.error.message, /X-Admin-API-Key/);
});

test('adminApiAuth: header X-Admin-API-Key incorrecto → 401 INVALID_API_KEY', async () => {
  const app = makeProtectedApp();
  const res = await request(app)
    .get('/protected')
    .set('X-Admin-API-Key', 'wrong-admin-key-xxxxxxxxxx');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
  // No debe filtrar si la key "estaba cerca" o no
  assert.match(res.body.error.message, /inv.lida/);
});

test('adminApiAuth: header X-Admin-API-Key correcto → 200 + req.adminAuth = true', async () => {
  const app = makeProtectedApp();
  const res = await request(app)
    .get('/protected')
    .set('X-Admin-API-Key', TEST_ADMIN_API_KEY);
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.adminAuth, true);
});

test('adminApiAuth: NO se autentica con X-Internal-API-Key (deben ser keys distintas)', async () => {
  const app = makeProtectedApp();
  // Intentar usar la key de operaciones internas en endpoint admin
  const res = await request(app)
    .get('/protected')
    .set('X-Internal-API-Key', TEST_ADMIN_API_KEY);  // mismo valor, distinto header
  assert.equal(res.status, 401, 'adminApiAuth NO debe aceptar X-Internal-API-Key');
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});
