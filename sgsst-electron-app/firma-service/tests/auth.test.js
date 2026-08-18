/**
 * Tests del middleware de auth (X-Internal-API-Key).
 *
 * Usa supertest para hacer requests HTTP reales al middleware.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { internalApiAuth } = require('../src/middleware/auth');
const { errorHandler } = require('../src/middleware/errors');

// App de prueba mínima
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.get('/internal/protected', internalApiAuth(), (req, res) => {
    res.json({ ok: true, internalAuth: req.internalAuth });
  });
  app.use(errorHandler());
  return app;
}

test('GET /internal/protected sin API key → 401', async () => {
  const app = createTestApp();
  const res = await request(app).get('/internal/protected');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('GET /internal/protected con API key inválida → 401', async () => {
  const app = createTestApp();
  const res = await request(app)
    .get('/internal/protected')
    .set('X-Internal-API-Key', 'wrong-key');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('GET /internal/protected con API key correcta → 200', async () => {
  const app = createTestApp();
  const config = require('../src/config');
  const res = await request(app)
    .get('/internal/protected')
    .set('X-Internal-API-Key', config.auth.internalApiKey);
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.internalAuth, true);
});
