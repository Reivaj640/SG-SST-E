/**
 * Tests del middleware requireIdempotencyKey (I-003.3, capa HTTP).
 *
 * Cubre la capa de orquestación HTTP sobre el service idempotency (I-003.2).
 * La capa de dominio está cubierta en tests/services/idempotency.test.js;
 * acá solo verificamos:
 *
 *   §1  — Header ausente: next() sin tocar BD.
 *   §2  — Header presente, key nueva: PENDING insertada, req/res contexts.
 *   §3  — REPLAY: handler NO re-ejecuta, X-Idempotency-Replay: true.
 *   §4  — CONFLICT: 409, handler NO ejecuta.
 *   §5  — IN_PROGRESS: 409 + Retry-After, handler NO ejecuta.
 *   §6  — TERMINAL: 409, handler NO ejecuta.
 *   §7  — Header inválido: 400 IDEMPOTENCY_KEY_INVALID.
 *   §8  — Lifecycle 2xx → markComplete.
 *   §9  — Lifecycle 4xx default → markFailed (body NO cacheado).
 *   §10 — Lifecycle 4xx con opt-in → markTerminal (body cacheado, retry bloqueado).
 *   §11 — Lifecycle 5xx / uncaught → PENDING queda, sin mark.
 *   §12 — Defense in depth: req.id_empresa missing → 500.
 *   §13 — Scope por id_empresa (G4): misma key en distintas empresas.
 *   §14 — X-Idempotency-Replay header: solo en REPLAY.
 *   §15 — Case insensitivity del header.
 *   §16 — Body NO se guarda en FAILED (G8 refinado).
 *
 * Estructura del test (supertest + app local mínima):
 *
 *   - NO usamos makeApp() (mantiene el test aislado, sin authz/rate-limit).
 *   - Cada test construye su propia mini-app con:
 *       requestId() → requireIdempotencyKey() → fake handler → errorHandler()
 *   - El fake handler setea req.id_empresa manualmente (stub de authz).
 *   - La BD está aislada vía tests/setup.js (apunta a test.sqlite, no a la dev).
 *   - resetDb() (de tests/helpers) limpia gh_idempotency_keys en cada test.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const db = require('../../src/db/connection');
const { resetDb } = require('../helpers');
const idempotency = require('../../src/services/idempotency');
const requestIdMiddleware = require('../../src/middleware/requestId');
const { requireIdempotencyKey } = require('../../src/middleware/idempotency');
const { errorHandler } = require('../../src/middleware/errors');

// =============================================================================
// Constantes de test
// =============================================================================

const TEST_EMPRESA_A = '900123456';
const TEST_EMPRESA_B = '900999999';

// UUIDs v4 válidos (random de ejemplo, formato correcto)
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const VALID_UUID_3 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const VALID_UUID_4 = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

// SHA-256 hex (64 chars) válido
const VALID_PDF_SHA256 = 'a'.repeat(64);
const VALID_PDF_SHA256_B = 'b'.repeat(64);

const VALID_METADATA = {
  id_trabajador: '1234567890',
  id_documento: 'doc-001',
  tipo_firma: 'presencial',
};

// =============================================================================
// Helpers de construcción de app
// =============================================================================

/**
 * Construye una mini-app con requestId, requireIdempotencyKey, fake handler.
 * El fake handler setea req.id_empresa antes del idempotency (simula authz).
 * Permite customizar el fake handler vía `handlerFn`.
 *
 * NOTA: por el orden de middlewares, el stub de id_empresa DEBE correr
 * ANTES de requireIdempotencyKey. El middleware idempotency lee
 * req.id_empresa, no lo setea.
 */
function buildApp({
  id_empresa = TEST_EMPRESA_A,
  handlerFn = defaultHandler,
  middlewareOptions = {},
} = {}) {
  const app = express();
  app.use(express.json());
  // 1. requestId (real)
  app.use(requestIdMiddleware());
  // 2. authz stub — setea req.id_empresa manualmente
  app.use((req, res, next) => {
    req.id_empresa = id_empresa;
    next();
  });
  // 3. idempotency (objeto bajo test)
  app.use(requireIdempotencyKey(middlewareOptions));
  // 4. fake handler
  app.post('/test', handlerFn);
  // 5. error handler
  app.use(errorHandler());
  return app;
}

function defaultHandler(req, res) {
  res.status(201).json({
    ok: true,
    received_metadata: req.body,
    idempotency_state: req.idempotency && req.idempotency.state,
  });
}

// =============================================================================
// Helpers de seeding (para tests que necesitan filas pre-existentes)
// =============================================================================

/** Sembrar fila PENDING (vía getOrCreate del service). */
function seedPending({ id_empresa = TEST_EMPRESA_A, idempotency_key, metadata = VALID_METADATA, pdf_sha256 = VALID_PDF_SHA256 } = {}) {
  return idempotency.getOrCreate({ id_empresa, idempotency_key, metadata, pdf_sha256 });
}

/** Sembrar fila COMPLETED con body cacheado (vía getOrCreate + markComplete). */
function seedCompleted({
  id_empresa = TEST_EMPRESA_A,
  idempotency_key,
  metadata = VALID_METADATA,
  pdf_sha256 = VALID_PDF_SHA256,
  response_status = 201,
  response_body = { id: 'sign-001', status: 'pending_signature' },
} = {}) {
  idempotency.getOrCreate({ id_empresa, idempotency_key, metadata, pdf_sha256 });
  return idempotency.markComplete({ id_empresa, idempotency_key, response_status, response_body });
}

/** Sembrar fila FAILED (vía getOrCreate + markFailed). */
function seedFailed({ id_empresa = TEST_EMPRESA_A, idempotency_key, metadata = VALID_METADATA, pdf_sha256 = VALID_PDF_SHA256 } = {}) {
  idempotency.getOrCreate({ id_empresa, idempotency_key, metadata, pdf_sha256 });
  return idempotency.markFailed({ id_empresa, idempotency_key });
}

/** Sembrar fila TERMINAL (vía getOrCreate + markComplete + markTerminal). */
function seedTerminal({
  id_empresa = TEST_EMPRESA_A,
  idempotency_key,
  metadata = VALID_METADATA,
  pdf_sha256 = VALID_PDF_SHA256,
  response_status = 422,
  response_body = { error: 'documento_rechazado' },
} = {}) {
  idempotency.getOrCreate({ id_empresa, idempotency_key, metadata, pdf_sha256 });
  return idempotency.markTerminal({ id_empresa, idempotency_key, response_status, response_body });
}

/** Backdate created_at a N segundos atrás. */
function backdateCreatedAt({ id_empresa, idempotency_key, seconds }) {
  db.prepare(`
    UPDATE gh_idempotency_keys
    SET created_at = strftime('%Y-%m-%d %H:%M:%S', 'now', '-' || ? || ' seconds')
    WHERE id_empresa = ? AND idempotency_key = ?
  `).run(seconds, id_empresa, idempotency_key);
}

/** Leer fila por PK. */
function readRow({ id_empresa, idempotency_key }) {
  return db.prepare(
    'SELECT * FROM gh_idempotency_keys WHERE id_empresa = ? AND idempotency_key = ?'
  ).get(id_empresa, idempotency_key) || null;
}

// =============================================================================
// beforeEach global: reset BD entre tests
// =============================================================================
//
// resetDb() limpia gh_idempotency_keys (lo añadimos a TABLES en
// tests/helpers.js) y todas las demás tablas de test.

function beforeEach() {
  resetDb();
}

// =============================================================================
// §1 — Header ausente
// =============================================================================

test('§1.1 idempotency: sin header Idempotency-Key → next() sin tocar BD', async () => {
  beforeEach();
  let handlerCalled = 0;
  const app = buildApp({
    handlerFn: (req, res) => {
      handlerCalled++;
      res.status(201).json({ ok: true });
    },
  });
  const res = await request(app)
    .post('/test')
    .send({ id_trabajador: '111' });
  assert.equal(res.status, 201);
  assert.equal(handlerCalled, 1, 'handler debe ejecutarse una vez');
  const count = db.prepare('SELECT COUNT(*) AS c FROM gh_idempotency_keys').get().c;
  assert.equal(count, 0, 'no debe haber filas en BD');
});

test('§1.2 idempotency: sin header → no se setea X-Idempotency-Replay', async () => {
  beforeEach();
  const app = buildApp();
  const res = await request(app).post('/test').send({});
  assert.equal(res.status, 201);
  assert.equal(res.headers['x-idempotency-replay'], undefined,
    'no debe haber header X-Idempotency-Replay');
});

test('§1.3 idempotency: sin header → handler body se devuelve tal cual', async () => {
  beforeEach();
  const app = buildApp({
    handlerFn: (req, res) => res.status(201).json({ echo: 'hello' }),
  });
  const res = await request(app).post('/test').send({ extra: 'data' });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body, { echo: 'hello' });
});

// =============================================================================
// §2 — Header presente, key nueva (PENDING)
// =============================================================================

test('§2.1 idempotency: header + key nueva → fila PENDING insertada', async () => {
  beforeEach();
  const app = buildApp();
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 201);
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.ok(row, 'debe existir la fila');
  assert.equal(row.status, 'COMPLETED', 'handler respondió 201 → debe estar COMPLETED');
});

test('§2.2 idempotency: handler recibe req.idempotency con state=pending', async () => {
  beforeEach();
  let capturedReqIdem = null;
  const app = buildApp({
    handlerFn: (req, res) => {
      capturedReqIdem = req.idempotency;
      res.status(201).json({ ok: true });
    },
  });
  await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.ok(capturedReqIdem, 'req.idempotency debe estar adjunto');
  assert.equal(capturedReqIdem.state, 'pending');
  assert.equal(capturedReqIdem.id_empresa, TEST_EMPRESA_A);
  assert.equal(capturedReqIdem.idempotency_key, VALID_UUID);
  assert.equal(capturedReqIdem.fingerprint.length, 64);
});

test('§2.3 idempotency: handler recibe res.idempotency.terminal() callable', async () => {
  beforeEach();
  let capturedResIdem = null;
  const app = buildApp({
    handlerFn: (req, res) => {
      capturedResIdem = res.idempotency;
      res.status(201).json({ ok: true });
    },
  });
  await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.ok(capturedResIdem, 'res.idempotency debe estar adjunto');
  assert.equal(typeof capturedResIdem.terminal, 'function');
});

test('§2.4 idempotency: handler se ejecuta una sola vez (no es replay)', async () => {
  beforeEach();
  let handlerCalled = 0;
  const app = buildApp({
    handlerFn: (req, res) => {
      handlerCalled++;
      res.status(201).json({ call: handlerCalled });
    },
  });
  await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(handlerCalled, 1);
});

// =============================================================================
// §3 — REPLAY (existing COMPLETED, mismo fingerprint)
// =============================================================================

test('§3.1 idempotency: REPLAY → response body cacheado se devuelve', async () => {
  beforeEach();
  seedCompleted({
    idempotency_key: VALID_UUID,
    response_status: 201,
    response_body: { id: 'sign-cached', status: 'pending_signature', version: 7 },
  });
  const app = buildApp();
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 201);
  assert.equal(res.body.id, 'sign-cached');
  assert.equal(res.body.version, 7);
});

test('§3.2 idempotency: REPLAY → header X-Idempotency-Replay: true', async () => {
  beforeEach();
  seedCompleted({ idempotency_key: VALID_UUID });
  const app = buildApp();
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.headers['x-idempotency-replay'], 'true');
});

test('§3.3 idempotency: REPLAY → handler NO se re-ejecuta (verificar con counter)', async () => {
  beforeEach();
  seedCompleted({ idempotency_key: VALID_UUID });
  let handlerCalls = 0;
  const app = buildApp({
    handlerFn: (req, res) => {
      handlerCalls++;
      res.status(201).json({ ok: true });
    },
  });
  await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(handlerCalls, 0, 'handler NO debe ejecutarse en REPLAY');
});

test('§3.4 idempotency: REPLAY → status code cacheado (no el del handler)', async () => {
  beforeEach();
  // Sembrar con 200, no 201 (diferente del default del handler)
  seedCompleted({
    idempotency_key: VALID_UUID,
    response_status: 200,
    response_body: { ok: true },
  });
  const app = buildApp({
    // Este handler NUNCA debe ejecutarse (REPLAY).
    handlerFn: (req, res) => res.status(500).json({ should_not_run: true }),
  });
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 200, 'debe devolver 200 cacheado, no 500 del handler');
  assert.equal(res.body.ok, true);
});

// =============================================================================
// §4 — CONFLICT (existing COMPLETED, fingerprint distinto)
// =============================================================================

test('§4.1 idempotency: CONFLICT → 409 IDEMPOTENCY_KEY_CONFLICT', async () => {
  beforeEach();
  seedCompleted({
    idempotency_key: VALID_UUID,
    metadata: { id_trabajador: '111' },
    pdf_sha256: VALID_PDF_SHA256,
  });
  const app = buildApp();
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, id_trabajador: '222', pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_CONFLICT');
});

test('§4.2 idempotency: CONFLICT → handler NO se ejecuta', async () => {
  beforeEach();
  seedCompleted({
    idempotency_key: VALID_UUID,
    metadata: { id_trabajador: '111' },
  });
  let handlerCalls = 0;
  const app = buildApp({
    handlerFn: (req, res) => {
      handlerCalls++;
      res.status(201).json({ ok: true });
    },
  });
  await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, id_trabajador: '222', pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(handlerCalls, 0, 'handler NO debe ejecutarse en CONFLICT');
});

test('§4.3 idempotency: CONFLICT → NO se setea X-Idempotency-Replay', async () => {
  beforeEach();
  seedCompleted({
    idempotency_key: VALID_UUID,
    metadata: { id_trabajador: '111' },
  });
  const app = buildApp();
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, id_trabajador: '222', pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.headers['x-idempotency-replay'], undefined,
    'CONFLICT no es replay, no debe llevar el header');
});

// =============================================================================
// §5 — IN_PROGRESS (existing PENDING dentro del in-flight timeout)
// =============================================================================

test('§5.1 idempotency: IN_PROGRESS → 409 IDEMPOTENCY_KEY_IN_PROGRESS', async () => {
  beforeEach();
  seedPending({ idempotency_key: VALID_UUID });
  const app = buildApp();
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_IN_PROGRESS');
});

test('§5.2 idempotency: IN_PROGRESS → header Retry-After presente y >= 1', async () => {
  beforeEach();
  seedPending({ idempotency_key: VALID_UUID });
  const app = buildApp();
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  const retryAfter = res.headers['retry-after'];
  assert.ok(retryAfter, 'Retry-After debe estar presente');
  const seconds = parseInt(retryAfter, 10);
  assert.ok(Number.isInteger(seconds) && seconds >= 1, `Retry-After debe ser >= 1s, fue ${retryAfter}`);
});

test('§5.3 idempotency: IN_PROGRESS → handler NO se ejecuta', async () => {
  beforeEach();
  seedPending({ idempotency_key: VALID_UUID });
  let handlerCalls = 0;
  const app = buildApp({
    handlerFn: (req, res) => {
      handlerCalls++;
      res.status(201).json({ ok: true });
    },
  });
  await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(handlerCalls, 0);
});

// =============================================================================
// §6 — TERMINAL (existing TERMINAL)
// =============================================================================

test('§6.1 idempotency: TERMINAL → 409 IDEMPOTENCY_KEY_TERMINAL', async () => {
  beforeEach();
  seedTerminal({ idempotency_key: VALID_UUID });
  const app = buildApp();
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_TERMINAL');
});

test('§6.2 idempotency: TERMINAL → handler NO se ejecuta', async () => {
  beforeEach();
  seedTerminal({ idempotency_key: VALID_UUID });
  let handlerCalls = 0;
  const app = buildApp({
    handlerFn: (req, res) => {
      handlerCalls++;
      res.status(201).json({ ok: true });
    },
  });
  await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(handlerCalls, 0);
});

// =============================================================================
// §7 — Header inválido
// =============================================================================

test('§7.1 idempotency: header vacío → 400 IDEMPOTENCY_KEY_INVALID', async () => {
  beforeEach();
  let handlerCalls = 0;
  const app = buildApp({
    handlerFn: (req, res) => {
      handlerCalls++;
      res.status(201).json({ ok: true });
    },
  });
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', '')
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  // Header '' es técnicamente "presente" (string vacío), el middleware lo
  // valida con el service que rechaza con empty.
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_INVALID');
  assert.equal(handlerCalls, 0);
});

test('§7.2 idempotency: header no-UUID → 400 IDEMPOTENCY_KEY_INVALID', async () => {
  beforeEach();
  let handlerCalls = 0;
  const app = buildApp({
    handlerFn: (req, res) => {
      handlerCalls++;
      res.status(201).json({ ok: true });
    },
  });
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', 'not-a-uuid-at-all')
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_INVALID');
  assert.equal(handlerCalls, 0);
});

test('§7.3 idempotency: header 256 chars → 400 IDEMPOTENCY_KEY_INVALID', async () => {
  beforeEach();
  let handlerCalls = 0;
  const app = buildApp({
    handlerFn: (req, res) => {
      handlerCalls++;
      res.status(201).json({ ok: true });
    },
  });
  const tooLong = 'a'.repeat(256);
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', tooLong)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_INVALID');
  assert.equal(handlerCalls, 0);
});

test('§7.4 idempotency: header inválido → handler NO se ejecuta', async () => {
  beforeEach();
  let handlerCalls = 0;
  const app = buildApp({
    handlerFn: (req, res) => {
      handlerCalls++;
      res.status(201).json({ ok: true });
    },
  });
  await request(app)
    .post('/test')
    .set('Idempotency-Key', 'bad-uuid')
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(handlerCalls, 0);
});

// =============================================================================
// §8 — Lifecycle 2xx (markComplete)
// =============================================================================

test('§8.1 idempotency: handler 201 → markComplete con response_status=201, body cacheado', async () => {
  beforeEach();
  const app = buildApp({
    handlerFn: (req, res) => res.status(201).json({ id: 'sign-001', nested: { x: 1 } }),
  });
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 201);
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.equal(row.status, 'COMPLETED');
  assert.equal(row.response_status, 201);
  const body = JSON.parse(row.response_body);
  assert.equal(body.id, 'sign-001');
  assert.equal(body.nested.x, 1);
  assert.ok(row.completed_at, 'completed_at debe estar poblado');
});

test('§8.2 idempotency: handler 200 → markComplete con response_status=200', async () => {
  beforeEach();
  const app = buildApp({
    handlerFn: (req, res) => res.status(200).json({ ok: true }),
  });
  await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.equal(row.status, 'COMPLETED');
  assert.equal(row.response_status, 200);
});

// =============================================================================
// §9 — Lifecycle 4xx default (markFailed, body NO cacheado)
// =============================================================================

test('§9.1 idempotency: handler 422 sin opt-in terminal → markFailed, body=NULL', async () => {
  beforeEach();
  const app = buildApp({
    handlerFn: (req, res) => res.status(422).json({ error: 'validation_failed' }),
  });
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 422);
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.equal(row.status, 'FAILED');
  assert.equal(row.response_status, null, 'FAILED no debe cachear response_status');
  assert.equal(row.response_body, null, 'FAILED no debe cachear response_body');
  assert.ok(row.completed_at, 'completed_at debe estar poblado');
});

test('§9.2 idempotency: FAILED → re-send con misma key+fingerprint → isRetry=true (handler corre)', async () => {
  beforeEach();
  // 1ª request → 422 (sin opt-in) → FAILED
  const app = buildApp({
    handlerFn: (req, res) => {
      const isRetry = req.idempotency && req.idempotency.state === 'pending';
      // En retry, la fila existente es FAILED, pero el middleware la
      // expone como 'pending' (la nueva rama "pendiente del nuevo intento").
      res.status(422).json({ error: 'validation_failed', is_retry_call: !!isRetry });
    },
  });
  // 1ª request
  await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  // 2ª request (mismo key + mismo fingerprint) → handler debe ejecutarse otra vez
  const res2 = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res2.status, 422, 'segunda llamada también 422 (handler corre)');
  // El handler SÍ corrió (no es REPLAY, es RETRY).
  // Después de la 2ª, la fila debe estar FAILED otra vez.
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.equal(row.status, 'FAILED');
});

// =============================================================================
// §10 — Lifecycle 4xx con opt-in terminal (markTerminal)
// =============================================================================

test('§10.1 idempotency: handler 409 con res.idempotency.terminal(body, 409) → markTerminal', async () => {
  beforeEach();
  const terminalBody = { error: 'documento_rechazado', motivo: 'X' };
  const app = buildApp({
    handlerFn: (req, res) => {
      res.idempotency.terminal(terminalBody, 409);
      res.status(409).json(terminalBody);
    },
  });
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 409);
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.equal(row.status, 'TERMINAL');
  assert.equal(row.response_status, 409);
  const body = JSON.parse(row.response_body);
  assert.equal(body.error, 'documento_rechazado');
  assert.equal(body.motivo, 'X');
});

test('§10.2 idempotency: TERMINAL → re-send con mismo fingerprint → 409 IDEMPOTENCY_KEY_TERMINAL (bloqueado)', async () => {
  beforeEach();
  // 1ª request con opt-in TERMINAL
  const app = buildApp({
    handlerFn: (req, res) => {
      res.idempotency.terminal({ error: 'rechazado' }, 409);
      res.status(409).json({ error: 'rechazado' });
    },
  });
  await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  // 2ª request con MISMO fingerprint → debe ser 409 IDEMPOTENCY_KEY_TERMINAL
  const res2 = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res2.status, 409);
  assert.equal(res2.body.error.code, 'IDEMPOTENCY_KEY_TERMINAL');
});

// =============================================================================
// §11 — Lifecycle 5xx / uncaught: NO marcar, PENDING queda
// =============================================================================

test('§11.1 idempotency: handler throw uncaught → response 500, fila queda PENDING', async () => {
  beforeEach();
  const app = buildApp({
    handlerFn: (req, res) => {
      throw new Error('boom');
    },
  });
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  // El errorHandler central serializa el error como 500.
  assert.equal(res.status, 500);
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.equal(row.status, 'PENDING', 'uncaught throw NO debe marcar FAILED');
  assert.equal(row.response_status, null);
  assert.equal(row.response_body, null);
  assert.equal(row.completed_at, null);
});

test('§11.2 idempotency: handler retorna 500 → fila queda PENDING (no blanket FAILED)', async () => {
  beforeEach();
  const app = buildApp({
    handlerFn: (req, res) => res.status(500).json({ error: 'server_error' }),
  });
  await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.equal(row.status, 'PENDING', '5xx NO debe marcar FAILED');
  assert.equal(row.response_status, null);
  assert.equal(row.response_body, null);
});

test('§11.3 idempotency: PENDING dentro del timeout → re-send → 409 IN_PROGRESS', async () => {
  beforeEach();
  // 1ª request → handler tira → PENDING
  const app = buildApp({
    handlerFn: (req, res) => {
      throw new Error('boom');
    },
  });
  await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  // 2ª request (mismo key, dentro del timeout) → 409 IN_PROGRESS
  const res2 = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res2.status, 409);
  assert.equal(res2.body.error.code, 'IDEMPOTENCY_KEY_IN_PROGRESS');
});

test('§11.4 idempotency: PENDING con created_at > 5min → re-send crea nueva fila (timeout recovery)', async () => {
  beforeEach();
  // 1ª request → handler tira → PENDING
  const app = buildApp({
    handlerFn: (req, res) => {
      throw new Error('boom');
    },
  });
  await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  // Backdate created_at a 6 min atrás (simula crash y timeout expirado)
  backdateCreatedAt({
    id_empresa: TEST_EMPRESA_A,
    idempotency_key: VALID_UUID,
    seconds: 6 * 60,
  });
  // 2ª request → debe tratarla como expirada, crear nueva PENDING
  const res2 = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  // El handler corre otra vez (no es replay, es nueva PENDING).
  // El handler tira, así que response 500, pero la fila fue RECREADA.
  assert.equal(res2.status, 500);
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.equal(row.status, 'PENDING', 'nueva fila PENDING creada por timeout recovery');
  // created_at debe ser reciente (re-creada hace instantes)
  // Verificamos que la fila "vieja" con created_at de hace 6 min fue
  // reemplazada. created_at de la nueva está en formato 'YYYY-MM-DD HH:MM:SS'.
  // No podemos medir "hace cuánto" exactamente, pero sabemos que el
  // service hace DELETE + INSERT, así que la fila actual tiene un
  // created_at fresco.
  // (Verificación implícita: si la recuperación funcionó, el handler
  // corrió otra vez y el response 500 confirma eso.)
});

// =============================================================================
// §12 — Defense in depth
// =============================================================================

test('§12.1 idempotency: req.id_empresa missing → 500 INTERNAL_ERROR', async () => {
  beforeEach();
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware());
  // NO seteamos req.id_empresa
  app.use(requireIdempotencyKey());
  app.post('/test', (req, res) => res.status(201).json({ ok: true }));
  app.use(errorHandler());
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 500);
  assert.equal(res.body.error.code, 'INTERNAL_ERROR');
});

test('§12.2 idempotency: body unparseable (sin express.json) → no crashea, trata metadata como {}', async () => {
  beforeEach();
  // App sin express.json
  const app = express();
  app.use(requestIdMiddleware());
  app.use((req, res, next) => {
    req.id_empresa = TEST_EMPRESA_A;
    next();
  });
  app.use(requireIdempotencyKey());
  app.post('/test', (req, res) => res.status(201).json({ ok: true }));
  app.use(errorHandler());
  // Enviamos un payload que NO es JSON válido (raw text)
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .set('Content-Type', 'application/json')
    .send('not json{');
  // El service tirará INVALID_REQUEST (pdf_sha256 missing) → 400.
  // Lo importante es que el middleware NO crashea con un TypeError.
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST');
});

// =============================================================================
// §13 — Scope por id_empresa (G4)
// =============================================================================

test('§13.1 idempotency: misma key + distinto id_empresa → ambas corren (scope aislado)', async () => {
  beforeEach();
  // Empresa A: handler cuenta calls de A
  let callsA = 0;
  const appA = buildApp({
    id_empresa: TEST_EMPRESA_A,
    handlerFn: (req, res) => {
      callsA++;
      res.status(201).json({ from: 'A', n: callsA });
    },
  });
  // Empresa B: handler cuenta calls de B (mismo key, distinto scope)
  let callsB = 0;
  const appB = buildApp({
    id_empresa: TEST_EMPRESA_B,
    handlerFn: (req, res) => {
      callsB++;
      res.status(201).json({ from: 'B', n: callsB });
    },
  });
  // Empresa A usa la key
  await request(appA)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  // Empresa B usa la MISMA key
  await request(appB)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(callsA, 1);
  assert.equal(callsB, 1, 'empresa B debe poder usar la misma key sin conflicto');
  // Ambas filas existen
  const rowA = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  const rowB = readRow({ id_empresa: TEST_EMPRESA_B, idempotency_key: VALID_UUID });
  assert.ok(rowA);
  assert.ok(rowB);
  assert.notEqual(rowA.id_empresa, rowB.id_empresa);
});

// =============================================================================
// §14 — X-Idempotency-Replay header: solo en REPLAY
// =============================================================================

test('§14.1 idempotency: X-Idempotency-Replay solo en REPLAY, no en new 2xx ni en errors', async () => {
  beforeEach();
  // 1. NEW (2xx) → no header
  const app = buildApp();
  const r1 = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID_2)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(r1.status, 201);
  assert.equal(r1.headers['x-idempotency-replay'], undefined,
    'NEW 2xx NO debe tener X-Idempotency-Replay');

  // 2. REPLAY → sí header
  const r2 = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID_2)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(r2.status, 201);
  assert.equal(r2.headers['x-idempotency-replay'], 'true',
    'REPLAY debe tener X-Idempotency-Replay: true');

  // 3. IN_PROGRESS (error) → no header
  seedPending({ idempotency_key: VALID_UUID_3 });
  const r3 = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID_3)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(r3.status, 409);
  assert.equal(r3.headers['x-idempotency-replay'], undefined,
    'IN_PROGRESS NO debe tener X-Idempotency-Replay');

  // 4. CONFLICT (error) → no header
  seedCompleted({
    idempotency_key: VALID_UUID_4,
    metadata: { id_trabajador: '111' },
  });
  const r4 = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID_4)
    .send({ ...VALID_METADATA, id_trabajador: '222', pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(r4.status, 409);
  assert.equal(r4.headers['x-idempotency-replay'], undefined,
    'CONFLICT NO debe tener X-Idempotency-Replay');
});

// =============================================================================
// §15 — Case insensitivity del header
// =============================================================================

test('§15.1 idempotency: Idempotency-Key (canonical) funciona', async () => {
  beforeEach();
  const app = buildApp();
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 201);
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.ok(row, 'debe existir la fila');
});

test('§15.2 idempotency: idempotency-key (lowercase) → Express normaliza, funciona igual', async () => {
  beforeEach();
  const app = buildApp();
  const res = await request(app)
    .post('/test')
    .set('idempotency-key', VALID_UUID)  // lowercase
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 201);
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.ok(row, 'debe existir la fila con la key correcta');
});

// =============================================================================
// §16 — Body NO se guarda en FAILED (G8 refinado)
// =============================================================================

test('§16.1 idempotency: 4xx sin opt-in → response_body en BD es NULL (no se cachea)', async () => {
  beforeEach();
  const app = buildApp({
    handlerFn: (req, res) => res.status(400).json({ error: 'bad_request', detalle: 'X' }),
  });
  const res = await request(app)
    .post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 400);
  // El cliente SÍ recibió el body (se envió al cliente)
  assert.equal(res.body.error, 'bad_request');
  // Pero la BD NO debe haberlo cacheado
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.equal(row.status, 'FAILED');
  assert.equal(row.response_status, null,
    'FAILED no debe cachear response_status (G8 refinado)');
  assert.equal(row.response_body, null,
    'FAILED no debe cachear response_body (G8 refinado)');
});
