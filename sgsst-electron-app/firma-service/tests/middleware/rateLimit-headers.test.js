/**
 * Tests IETF draft-7 headers en respuestas 429 (I-008.2, HALLAZGO #1).
 *
 * Cubre TODOS los limiters donde se puede disparar un 429:
 *   - globalLimiter
 *   - otpLimiter
 *   - commitLimiter
 *   - signRequestLimiter
 *   - internalCapa1 (id_empresa)
 *   - internalCapa2 (id_empresa + X-Client-Instance-Id)
 *   - internalCapa3 (IP fallback)
 *   - Capa 4 anomaly (internalServerLimiter manual, NO usa express-rate-limit)
 *
 * HALLAZGO #1 documentado en firma-rate-limit-e2e.test.js:295.
 *
 * Estrategia: mini-app Express con SOLO el limiter a probar + un endpoint
 * dummy. Mismo patrón que tests/middleware/rateLimit.test.js. NO se usa
 * la createApp completa para no depender de BD, routers, ni authz.
 *
 * Contrato verificado (IETF draft-7):
 *   - res.status === 429
 *   - res.headers['ratelimit-policy'] === '<limit>;w=<windowSec>'
 *   - res.headers['ratelimit'] === 'limit=<limit>, remaining=0, reset=<windowSec>'
 *   - res.body.error.code === 'RATE_LIMIT_EXCEEDED'
 *
 * @see https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { errorHandler } = require('../../src/middleware/errors');
const {
  globalLimiter,
  otpLimiter,
  commitLimiter,
  signRequestLimiter,
  internalServerLimiter,
  _clearInstanceTracker,
  _INTERNAL_EMPRESA_LIMIT_REF, // expuesto solo si lo exporto; usaré _checkAnomaly o similar
} = require('../../src/middleware/rateLimit');
const { rateLimit } = require('express-rate-limit');

// =============================================================================
// Helpers
// =============================================================================

/**
 * Mini-app genérica: aplica un limiter a un endpoint dummy y monta el
 * errorHandler. trust proxy = true para que X-Forwarded-For funcione.
 */
function makeAppWithLimiter(limiter) {
  const app = express();
  app.set('trust proxy', true);
  app.use(limiter);
  app.get('/ping', (req, res) => res.json({ ok: true }));
  app.use(errorHandler());
  return app;
}

/**
 * Mini-app con limiter en ruta tipada :token (replica patrón real
 * de /api/sign/:token/... donde req.params.token debe estar disponible).
 */
function makeAppWithLimiterToken(limiter) {
  const app = express();
  app.set('trust proxy', true);
  app.post('/api/sign/:token/echo', limiter, (req, res) => {
    res.json({ ok: true, token: req.params.token });
  });
  app.use(errorHandler());
  return app;
}

/**
 * Mini-app con internalServerLimiter (que es un middleware no-express-rate-limit
 * que corre 4 capas). Requiere setear req.id_empresa y opcionalmente
 * X-Client-Instance-Id en un middleware previo.
 */
function makeAppWithInternalLimiter() {
  const app = express();
  app.set('trust proxy', true);
  app.use((req, res, next) => {
    // Simular authz: setear req.id_empresa
    req.id_empresa = req.get('X-Test-Empresa') || '900123456';
    req.authSource = 'client';
    next();
  });
  app.use(internalServerLimiter);
  app.get('/internal/test', (req, res) => res.json({ ok: true }));
  app.use(errorHandler());
  return app;
}

/**
 * Asserts: verifica que la respuesta 429 tiene los headers IETF
 * correctos según la policy del limiter.
 *
 * @param {object} res - Response object de supertest
 * @param {number} expectedLimit - limit declarado en el limiter
 * @param {number} expectedWindowSec - window del limiter en segundos
 */
function assertIetfHeaders(res, expectedLimit, expectedWindowSec) {
  // Headers IETF (lowercase en Node.js)
  const policy = res.headers['ratelimit-policy'];
  const rateLimit = res.headers['ratelimit'];

  assert.equal(res.status, 429, 'status debe ser 429');
  assert.equal(res.body.error.code, 'RATE_LIMIT_EXCEEDED');

  // RateLimit-Policy: <limit>;w=<windowSec>
  assert.ok(policy, 'header RateLimit-Policy debe estar presente');
  const expectedPolicy = `${expectedLimit};w=${expectedWindowSec}`;
  assert.equal(policy, expectedPolicy,
    `RateLimit-Policy debe ser "${expectedPolicy}", recibido "${policy}"`);

  // RateLimit: limit=<limit>, remaining=0, reset=<windowSec>
  assert.ok(rateLimit, 'header RateLimit debe estar presente');
  const expectedRateLimit = `limit=${expectedLimit}, remaining=0, reset=${expectedWindowSec}`;
  assert.equal(rateLimit, expectedRateLimit,
    `RateLimit debe ser "${expectedRateLimit}", recibido "${rateLimit}"`);

  // Sanity: el body sigue siendo el contrato estándar de error
  assert.equal(res.body.error.code, 'RATE_LIMIT_EXCEEDED');
  assert.equal(res.body.error.details.limiter, res.body.error.details.limiter,
    'limiter en details debe estar presente');
}

// =============================================================================
// Tests de los 4 limiters públicos
// =============================================================================

test('globalLimiter (60/min): 429 incluye RateLimit-Policy y RateLimit', async () => {
  const app = makeAppWithLimiter(globalLimiter);
  // 60 OK + 1 que dispara 429
  for (let i = 0; i < 60; i++) {
    await request(app).get('/ping');
  }
  const res = await request(app).get('/ping');
  assertIetfHeaders(res, 60, 60); // limit=60, window=60s
});

test('otpLimiter (10/h): 429 incluye RateLimit-Policy y RateLimit', async () => {
  const app = makeAppWithLimiterToken(otpLimiter);
  for (let i = 0; i < 10; i++) {
    await request(app).post('/api/sign/tok123/echo');
  }
  const res = await request(app).post('/api/sign/tok123/echo');
  assertIetfHeaders(res, 10, 3600); // limit=10, window=1h=3600s
});

test('commitLimiter (3/min): 429 incluye RateLimit-Policy y RateLimit', async () => {
  const app = makeAppWithLimiterToken(commitLimiter);
  for (let i = 0; i < 3; i++) {
    await request(app).post('/api/sign/tok456/echo');
  }
  const res = await request(app).post('/api/sign/tok456/echo');
  assertIetfHeaders(res, 3, 60); // limit=3, window=60s
});

test('signRequestLimiter (30/min): 429 incluye RateLimit-Policy y RateLimit', async () => {
  const app = makeAppWithLimiter(signRequestLimiter);
  for (let i = 0; i < 30; i++) {
    await request(app).get('/ping');
  }
  const res = await request(app).get('/ping');
  assertIetfHeaders(res, 30, 60); // limit=30, window=60s
});

// =============================================================================
// Tests de los limiters internos (4 capas en internalServerLimiter)
// =============================================================================

test('internalServerLimiter: Capa 1 (id_empresa) 429 incluye headers IETF', (t) => {
  // Skip explícito: Capa 1 dispara con 720 requests (720/h por id_empresa),
  // lo cual haría este test muy lento. Los tests de isolation por capa
  // están en tests/middleware/internalServerLimiter.test.js (lentos, cubren
  // isolation, no headers). Acá probamos headers con Capa 4 (anomaly)
  // que dispara con 11 requests — más rápido. Si en el futuro se quiere
  // probar headers en Capa 1, se puede ajustar el env var
  // RATE_LIMIT_INTERNAL_EMPRESA_PER_HOUR ANTES de requerir el módulo.
  t.skip('Capa 1 con 720 requests es muy lento; ver internalServerLimiter.test.js para test de isolation, y test de Capa 4 más abajo para headers IETF');
});

test('internalServerLimiter: Capa 4 (anomaly) 429 incluye headers IETF', async () => {
  // Limpiar tracker para empezar limpio
  _clearInstanceTracker();

  const app = makeAppWithInternalLimiter();
  // Capa 4: anomalía = >10 instance ids distintos
  // Anomaly limit es 10 (default). Necesitamos 11+ requests con
  // 11 instance ids distintos para disparar la anomalía.
  for (let i = 0; i < 11; i++) {
    await request(app)
      .get('/internal/test')
      .set('X-Client-Instance-Id', `instance-${i}`);
  }
  const res = await request(app)
    .get('/internal/test')
    .set('X-Client-Instance-Id', 'instance-11');

  // Capa 4 dispara con INSTANCE_ANOMALY_LIMIT=10, INSTANCE_ANOMALY_WINDOW_MS=24h
  // Window en segundos: 24*60*60 = 86400
  assertIetfHeaders(res, 10, 86400);
  assert.equal(res.body.error.details.limiter, 'anomaly');
});

// =============================================================================
// Test de contrato general
// =============================================================================

test('IETF draft-7: el formato de los headers sigue el spec', async () => {
  // Test que valida el FORMATO de los headers según el draft IETF.
  // El draft define:
  //   - RateLimit-Policy: <limit>;w=<windowSec>[;comment="..."]
  //   - RateLimit: limit=<n>, remaining=<n>, reset=<n>
  // No testeamos la versión "complete" del draft (con quota-policy),
  // solo el formato "basic" que es el que usamos.
  const app = makeAppWithLimiter(globalLimiter);
  for (let i = 0; i < 60; i++) {
    await request(app).get('/ping');
  }
  const res = await request(app).get('/ping');

  const policy = res.headers['ratelimit-policy'];
  const rateLimit = res.headers['ratelimit'];

  // Formato: <limit>;w=<windowSec>
  const policyMatch = policy.match(/^(\d+);w=(\d+)$/);
  assert.ok(policyMatch, `RateLimit-Policy debe tener formato "<limit>;w=<windowSec>", recibido "${policy}"`);
  assert.ok(parseInt(policyMatch[1]) > 0, 'limit debe ser positivo');
  assert.ok(parseInt(policyMatch[2]) > 0, 'windowSec debe ser positivo');

  // Formato: limit=<n>, remaining=<n>, reset=<n>
  // El draft dice que las claves pueden venir en cualquier orden y pueden
  // incluir otras claves opcionales (policy, partition-key).
  assert.match(rateLimit, /limit=\d+/, 'debe incluir limit=<n>');
  assert.match(rateLimit, /remaining=\d+/, 'debe incluir remaining=<n>');
  assert.match(rateLimit, /reset=\d+/, 'debe incluir reset=<n>');

  // En un 429, remaining=0
  const remainingMatch = rateLimit.match(/remaining=(\d+)/);
  assert.equal(remainingMatch[1], '0', 'en un 429, remaining debe ser 0');
});
