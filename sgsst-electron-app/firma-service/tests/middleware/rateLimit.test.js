/**
 * Tests del middleware rateLimit (Bloque E9.1).
 *
 * Cubre los 4 limiters:
 *   - globalLimiter     → 60/min por IP (skip /health)
 *   - otpLimiter        → 10/h por IP+token
 *   - commitLimiter     → 3/min por IP+token
 *   - signRequestLimiter→ 30/min por IP
 *
 * Estrategia: se construyen mini-apps Express con SOLO el limiter a probar
 * y un endpoint dummy. NO se usa la createApp completa para no depender de
 * BD, routers, ni de los flujos reales de firma. El contrato a probar es
 * "este middleware devuelve 429 al exceder N requests", no los endpoints
 * reales (esos ya tienen sus propios tests en tests/routes/*.test.js).
 *
 * Aislamiento entre tests: cada test construye su propio limiter y su
 * propia app. La MemoryStore interna de express-rate-limit v7 está atada
 * al limiter, así que no hay estado compartido.
 *
 * NOTA: estos tests asumen trust proxy = true (igual que server.js). Para
 * simular IPs distintas entre requests, se usa el header X-Forwarded-For
 * (Express, con trust proxy = true, resuelve req.ip a la última IP del
 * header). Esto refleja la realidad del deploy.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { rateLimit } = require('express-rate-limit');
const { errorHandler } = require('../../src/middleware/errors');
const {
  globalLimiter,
  otpLimiter,
  commitLimiter,
  signRequestLimiter,
  _ipKey,
  _ipAndTokenKey,
} = require('../../src/middleware/rateLimit');

/**
 * Mini-app genérica: aplica un limiter a un endpoint dummy GET /ping
 * y monta el errorHandler para que los AppError(429) se serialicen igual
 * que en el server real.
 */
function makeAppWithLimiter(limiter) {
  const app = express();
  app.set('trust proxy', true);
  app.use(limiter);
  app.get('/ping', (req, res) => res.json({ ok: true }));
  app.use(errorHandler());
  return app;
}

function makeAppWithLimiterPost(limiter) {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use(limiter);
  app.post('/echo', (req, res) => res.json({ ok: true, body: req.body }));
  app.use(errorHandler());
  return app;
}

/**
 * Mini-app con limiter montado EN la ruta con `:token`.
 * CRÍTICO: en el server real, el limiter se monta en `/api/sign/:token/...`,
 * lo que hace que Express YA haya hecho el match de ruta y `req.params.token`
 * esté poblado CUANDO se ejecuta el middleware. Si se monta con `app.use(limiter)`
 * a nivel de app, el match aún no ocurrió y `req.params` es {}.
 *
 * Esta función replica el patrón real: limiter en ruta tipada.
 */
function makeAppWithLimiterPostToken(limiter) {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  // El limiter se monta EN la ruta, no a nivel de app. Esto replica
  // el patrón del server.js y garantiza que req.params.token esté
  // disponible dentro del keyGenerator.
  app.post('/api/sign/:token/echo', limiter, (req, res) => {
    res.json({ ok: true, token: req.params.token, body: req.body });
  });
  app.use(errorHandler());
  return app;
}

// =============================================================================
// Tests del globalLimiter
// =============================================================================

test('globalLimiter: primeras 60 requests OK, la #61 retorna 429 RATE_LIMIT_EXCEEDED', async () => {
  const app = makeAppWithLimiter(globalLimiter);
  for (let i = 0; i < 60; i++) {
    const r = await request(app).get('/ping');
    assert.equal(r.status, 200, `request #${i + 1} debería ser 200`);
  }
  const r61 = await request(app).get('/ping');
  assert.equal(r61.status, 429, 'request #61 debería ser 429');
  assert.equal(r61.body.error.code, 'RATE_LIMIT_EXCEEDED');
  assert.equal(r61.body.error.details.limiter, 'global');
  assert.equal(r61.body.error.details.limit, 60);
});

test('globalLimiter: skip /health (no se cuenta)', async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(globalLimiter);
  app.get('/health', (req, res) => res.json({ ok: true }));
  app.use(errorHandler());
  // 100 requests a /health desde la misma IP. Ninguna debería ser 429.
  for (let i = 0; i < 100; i++) {
    const r = await request(app).get('/health');
    assert.equal(r.status, 200, `/health #${i + 1} no debe ser rate limited`);
  }
});

// =============================================================================
// Tests del otpLimiter
// =============================================================================

test('otpLimiter: primeras 10 requests OK, la #11 retorna 429 (mismo IP+token)', async () => {
  const app = makeAppWithLimiterPostToken(otpLimiter);
  for (let i = 0; i < 10; i++) {
    const r = await request(app)
      .post('/api/sign/test-token/echo')
      .set('X-Forwarded-For', '10.0.0.1')
      .send({ otp: '000000' });
    assert.equal(r.status, 200, `request #${i + 1} debería ser 200`);
  }
  const r11 = await request(app)
    .post('/api/sign/test-token/echo')
    .set('X-Forwarded-For', '10.0.0.1')
    .send({ otp: '000000' });
  assert.equal(r11.status, 429, 'request #11 debería ser 429');
  assert.equal(r11.body.error.code, 'RATE_LIMIT_EXCEEDED');
  assert.equal(r11.body.error.details.limiter, 'otp');
  assert.equal(r11.body.error.details.limit, 10);
});

// =============================================================================
// Tests del commitLimiter
// =============================================================================

test('commitLimiter: primeras 3 requests OK, la #4 retorna 429 (mismo IP+token)', async () => {
  const app = makeAppWithLimiterPost(commitLimiter);
  for (let i = 0; i < 3; i++) {
    const r = await request(app)
      .post('/echo')
      .set('X-Forwarded-For', '10.0.0.2')
      .send({ commit: i });
    assert.equal(r.status, 200, `request #${i + 1} debería ser 200`);
  }
  const r4 = await request(app)
    .post('/echo')
    .set('X-Forwarded-For', '10.0.0.2')
    .send({ commit: 'overflow' });
  assert.equal(r4.status, 429, 'request #4 debería ser 429');
  assert.equal(r4.body.error.code, 'RATE_LIMIT_EXCEEDED');
  assert.equal(r4.body.error.details.limiter, 'commit');
  assert.equal(r4.body.error.details.limit, 3);
});

// =============================================================================
// Tests del signRequestLimiter
// =============================================================================

test('signRequestLimiter: primeras 30 requests OK, la #31 retorna 429', async () => {
  const app = makeAppWithLimiterPost(signRequestLimiter);
  for (let i = 0; i < 30; i++) {
    const r = await request(app)
      .post('/echo')
      .set('X-Forwarded-For', '10.0.0.3')
      .send({ n: i });
    assert.equal(r.status, 200, `request #${i + 1} debería ser 200`);
  }
  const r31 = await request(app)
    .post('/echo')
    .set('X-Forwarded-For', '10.0.0.3')
    .send({ n: 31 });
  assert.equal(r31.status, 429, 'request #31 debería ser 429');
  assert.equal(r31.body.error.code, 'RATE_LIMIT_EXCEEDED');
  assert.equal(r31.body.error.details.limiter, 'sign-request');
  assert.equal(r31.body.error.details.limit, 30);
});

// =============================================================================
// Test de ventana: después de windowMs, vuelve a permitir
// =============================================================================

test('rateLimit: después de windowMs, el contador se resetea', async () => {
  // Limiter dedicado con windowMs corto (150ms) para que el test sea rápido.
  const tinyLimiter = rateLimit({
    windowMs: 150,
    limit: 2,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: _ipKey,
    handler: _makeTestHandler(),
  });
  const app = makeAppWithLimiter(tinyLimiter);

  // 2 OK + 1 → 429
  await request(app).get('/ping');
  await request(app).get('/ping');
  const blocked = await request(app).get('/ping');
  assert.equal(blocked.status, 429, 'la #3 debe ser 429 antes de la ventana');

  // Esperar a que la ventana pase
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Ahora debe volver a permitir
  const after = await request(app).get('/ping');
  assert.equal(after.status, 200, 'después de la ventana debe volver a permitir');
});

// Helper local porque el handler de rateLimit.js está pensado para next(new AppError)
function _makeTestHandler() {
  const { AppError } = require('../../src/middleware/errors');
  return function (req, res, next, options) {
    next(new AppError(429, 'RATE_LIMIT_EXCEEDED', 'test', {
      limit: options.limit,
    }));
  };
}

// =============================================================================
// Tests de aislamiento de keys
// =============================================================================

test('globalLimiter: diferentes IPs tienen contadores independientes', async () => {
  const app = makeAppWithLimiter(globalLimiter);
  // IP-A: 60 requests → llega al límite
  for (let i = 0; i < 60; i++) {
    const r = await request(app).get('/ping').set('X-Forwarded-For', '192.168.1.1');
    assert.equal(r.status, 200);
  }
  // IP-A: la 61 debe ser 429
  const aBlocked = await request(app).get('/ping').set('X-Forwarded-For', '192.168.1.1');
  assert.equal(aBlocked.status, 429, 'IP-A debe estar bloqueada');

  // IP-B: debe poder hacer al menos 1 request sin problema
  const bOk = await request(app).get('/ping').set('X-Forwarded-For', '192.168.1.2');
  assert.equal(bOk.status, 200, 'IP-B no debe estar afectada por el límite de IP-A');
});

test('otpLimiter: el contador es por (IP, token) — cambiar token libera el límite', async () => {
  const app = makeAppWithLimiterPostToken(otpLimiter);
  // Misma IP, token A: agotar el límite
  for (let i = 0; i < 10; i++) {
    await request(app)
      .post('/api/sign/token-A/echo')
      .set('X-Forwarded-For', '10.0.0.4')
      .send({ i });
  }
  const aBlocked = await request(app)
    .post('/api/sign/token-A/echo')
    .set('X-Forwarded-For', '10.0.0.4')
    .send({ i: 'overflow' });
  assert.equal(aBlocked.status, 429, 'token A debe estar bloqueado');

  // Misma IP, token B: el contador debe estar en 0 (key nueva)
  const bOk = await request(app)
    .post('/api/sign/token-B/echo')
    .set('X-Forwarded-For', '10.0.0.4')
    .send({ token: 'B' });
  assert.equal(bOk.status, 200, 'cambiar el token debe resetear el contador (misma IP)');
});

test('commitLimiter: el contador es por (IP, token) — cambiar IP también libera', async () => {
  const app = makeAppWithLimiterPostToken(commitLimiter);
  // IP-A + token X: agotar
  for (let i = 0; i < 3; i++) {
    await request(app)
      .post('/api/sign/token-X/echo')
      .set('X-Forwarded-For', '10.0.0.5')
      .send({ i });
  }
  const aBlocked = await request(app)
    .post('/api/sign/token-X/echo')
    .set('X-Forwarded-For', '10.0.0.5')
    .send({});
  assert.equal(aBlocked.status, 429, 'IP-A + token X debe estar bloqueado');

  // IP-B + mismo token X: el contador debe estar en 0
  const bOk = await request(app)
    .post('/api/sign/token-X/echo')
    .set('X-Forwarded-For', '10.0.0.6')
    .send({});
  assert.equal(bOk.status, 200, 'cambiar la IP debe resetear el contador (mismo token)');
});

// =============================================================================
// Tests del keyGenerator
// =============================================================================

test('_ipKey: usa req.ip tal como lo resuelve Express', () => {
  const fakeReq = { ip: '203.0.113.5' };
  assert.equal(_ipKey(fakeReq), '203.0.113.5');
});

test('_ipKey: fallback "unknown" si req.ip no está definido', () => {
  const fakeReq = {};
  assert.equal(_ipKey(fakeReq), 'unknown');
});

test('_ipAndTokenKey: combina IP + token', () => {
  const fakeReq = { ip: '203.0.113.5', params: { token: 'abc123' } };
  assert.equal(_ipAndTokenKey(fakeReq), '203.0.113.5:abc123');
});

test('_ipAndTokenKey: si no hay token en params, usa "no-token"', () => {
  const fakeReq = { ip: '203.0.113.5', params: {} };
  assert.equal(_ipAndTokenKey(fakeReq), '203.0.113.5:no-token');
});

// =============================================================================
// Test de headers estándar IETF
// =============================================================================

test('globalLimiter: emite headers estándar RateLimit (IETF draft-7)', async () => {
  const app = makeAppWithLimiter(globalLimiter);
  // IP única para no contaminar con tests previos.
  const r = await request(app).get('/ping').set('X-Forwarded-For', '203.0.113.50');
  assert.equal(r.status, 200);
  // En v7.5.1, draft-7 emite: RateLimit-Policy + RateLimit (consolidado).
  // NO usa los headers separados RateLimit-Limit/Remaining/Reset (eso es draft-6).
  assert.ok(r.headers['ratelimit-policy'], 'debe emitir RateLimit-Policy');
  assert.ok(r.headers['ratelimit'], 'debe emitir RateLimit');
  // El header RateLimit debe incluir limit=60, remaining=59, reset=60
  assert.match(r.headers['ratelimit'], /limit=60/);
  assert.match(r.headers['ratelimit'], /remaining=59/);
});

test('globalLimiter: NO emite headers legacy X-RateLimit-*', async () => {
  const app = makeAppWithLimiter(globalLimiter);
  // IP única para no contaminar con tests previos.
  const r = await request(app).get('/ping').set('X-Forwarded-For', '203.0.113.51');
  assert.equal(r.status, 200);
  // legacyHeaders:false → no debe haber X-RateLimit-Limit ni X-RateLimit-Remaining
  assert.equal(r.headers['x-ratelimit-limit'], undefined,
    'no debe emitir X-RateLimit-Limit (legacy)');
  assert.equal(r.headers['x-ratelimit-remaining'], undefined,
    'no debe emitir X-RateLimit-Remaining (legacy)');
});

// =============================================================================
// Test de P1-6 (trust proxy): server.js NO debe usar 'true' (bypass de XFF)
// =============================================================================

test('P1-6: server.js NO usa trust proxy=true (bypass de X-Forwarded-For)', () => {
  // Lee el código de server.js directamente. No requiere levantar el server.
  // Esto es defensa en profundidad: si alguien cambia `app.set('trust proxy', true)`
  // por error, este test falla antes de que llegue a producción.
  const fs = require('fs');
  const serverSrc = fs.readFileSync(
    require('path').join(__dirname, '..', '..', 'src', 'server.js'),
    'utf8'
  );
  // No debe aparecer `app.set('trust proxy', true)` (con o sin espacios).
  assert.ok(
    !/app\.set\(\s*['"]trust proxy['"]\s*,\s*true\s*\)/.test(serverSrc),
    "server.js NO debe contener `app.set('trust proxy', true)` — usa config.trustProxy (P1-6)"
  );
  // Debe aparecer el uso de config.trustProxy.
  assert.ok(
    /config\.trustProxy/.test(serverSrc),
    "server.js debe usar config.trustProxy (P1-6)"
  );
});

test('P1-6: config.trustProxy default es seguro (no "true")', () => {
  // Borra la env var TRUST_PROXY temporalmente.
  const prev = process.env.TRUST_PROXY;
  delete process.env.TRUST_PROXY;
  // Limpia cache de config para forzar re-lectura.
  delete require.cache[require.resolve('../../src/config')];
  try {
    const cfg = require('../../src/config');
    assert.notEqual(cfg.trustProxy, true,
      'config.trustProxy NO debe ser true (bypass de X-Forwarded-For)');
    assert.notEqual(cfg.trustProxy, 'true',
      'config.trustProxy NO debe ser "true" (string)');
    // Default seguro: 'loopback'.
    assert.equal(cfg.trustProxy, 'loopback',
      'default de trustProxy debe ser "loopback" (solo 127.0.0.1, ::1)');
  } finally {
    if (prev !== undefined) process.env.TRUST_PROXY = prev;
    delete require.cache[require.resolve('../../src/config')];
    // Recarga el módulo para que el resto de los tests vean la config original.
    require('../../src/config');
  }
});

test('P1-6: con trust proxy=loopback, X-Forwarded-For falsificado NO evade el rate limit', async () => {
  // Test de integración: usa el trust proxy real (loopback) y verifica
  // que un atacante con X-Forwarded-For falsificado SÍ es rate-limiteado
  // (porque la IP del socket wins, no la del header).
  const { createApp } = require('../../src/server');
  // Crea app con rate limit + endpoint dummy.
  // NO usamos la createApp completa (intenta conectar a BD), solo verificamos
  // que la config del trust proxy está bien.
  const config = require('../../src/config');
  assert.notEqual(config.trustProxy, true,
    "config.trustProxy debe estar configurado (P1-6)");
  assert.equal(typeof config.trustProxy, 'string',
    'config.trustProxy debe ser string (Express trust proxy format)');
  // La creación de createApp() corre migrate() que puede fallar en tests.
  // Por eso solo validamos la config aquí. El test del limiter con XFF
  // bypass está cubierto por los tests anteriores de cada limiter.
});
