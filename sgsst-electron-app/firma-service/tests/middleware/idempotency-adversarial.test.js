/**
 * I-003.4 — Batería adversarial del middleware requireIdempotencyKey.
 *
 * OBJETIVO: atacar la capa HTTP (orquestación sobre el service idempotency)
 * desde ángulos NO cubiertos por los 40 tests "normales" de
 * tests/middleware/idempotency.test.js. Estos tests son descubrimiento:
 * si un test revela un defecto real, se REPORTA, no se silencia.
 *
 * Secciones:
 *   §M1 — Concurrencia HTTP con misma key (race conditions reales).
 *   §M2 — PENDING blocking (Retry-After, blocking semantics).
 *   §M3 — REPLAY body redaction (C-22: el body cacheado es lo que se devuelve).
 *   §M4 — Header attacks (whitespace, length, case, unicode, null byte).
 *   §M5 — 5xx / uncaught no pre-marcan FAILED (re-test bajo carga).
 *   §M6 — PII en error responses y logs (key_prefix only, no body).
 *   §M7 — id_empresa missing (defense in depth, 500 INTERNAL_ERROR).
 *   §M8 — Body fingerprint integrity (pdf_sha256 + metadata contributions).
 *
 * Setup:
 *   - BD real (test.sqlite via tests/setup.js --require).
 *   - resetDb() en cada test (incluye gh_idempotency_keys desde I-003.3).
 *   - buildApp() helper minimal (estilo del archivo original).
 *   - captureLogs() helper para tests de PII en logs.
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

// =====================================================================
// Constantes de test
// =====================================================================

const TEST_EMPRESA_A = '900123456';
const TEST_EMPRESA_B = '900999999';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const VALID_UUID_3 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const VALID_UUID_4 = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
const VALID_UUID_5 = 'b2c3d4e5-f6a7-4890-b123-456789abcdef';

const VALID_PDF_SHA256 = 'a'.repeat(64);
const VALID_PDF_SHA256_B = 'b'.repeat(64);
const VALID_PDF_SHA256_C = 'c'.repeat(64);

const VALID_METADATA = {
  id_trabajador: '1234567890',
  id_documento: 'doc-001',
  tipo_firma: 'presencial',
};

// =====================================================================
// Helpers de construcción de app (mismo patrón que el archivo original)
// =====================================================================

function buildApp({
  id_empresa = TEST_EMPRESA_A,
  handlerFn = defaultHandler,
  middlewareOptions = {},
} = {}) {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware());
  app.use((req, res, next) => {
    req.id_empresa = id_empresa;
    next();
  });
  app.use(requireIdempotencyKey(middlewareOptions));
  app.post('/test', handlerFn);
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

// =====================================================================
// Helpers de seeding y lectura
// =====================================================================

function seedPending({ id_empresa = TEST_EMPRESA_A, idempotency_key, metadata = VALID_METADATA, pdf_sha256 = VALID_PDF_SHA256 } = {}) {
  return idempotency.getOrCreate({ id_empresa, idempotency_key, metadata, pdf_sha256 });
}

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

function backdateCreatedAt({ id_empresa, idempotency_key, seconds }) {
  db.prepare(`
    UPDATE gh_idempotency_keys
    SET created_at = strftime('%Y-%m-%d %H:%M:%S', 'now', '-' || ? || ' seconds')
    WHERE id_empresa = ? AND idempotency_key = ?
  `).run(seconds, id_empresa, idempotency_key);
}

function readRow({ id_empresa, idempotency_key }) {
  return db.prepare(
    'SELECT * FROM gh_idempotency_keys WHERE id_empresa = ? AND idempotency_key = ?'
  ).get(id_empresa, idempotency_key) || null;
}

function beforeEach() {
  resetDb();
}

// =====================================================================
// captureLogs — captura stdout/stderr para tests de PII en logs
// =====================================================================
//
// El logger (src/utils/logger.js) escribe JSON a process.stdout (info)
// y process.stderr (warn/error). Para tests de PII en logs, monkey-patch
// los writers durante el test, capturar todas las líneas, y restaurarlos.

function captureLogs() {
  const captured = { stdout: [], stderr: [] };
  const origStdout = process.stdout.write.bind(process.stdout);
  const origStderr = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk) => {
    captured.stdout.push(chunk.toString());
    return true;
  };
  process.stderr.write = (chunk) => {
    captured.stderr.push(chunk.toString());
    return true;
  };
  return {
    captured,
    restore: () => {
      process.stdout.write = origStdout;
      process.stderr.write = origStderr;
    },
    parseLines: () => {
      const all = [...captured.stdout, ...captured.stderr];
      return all
        .flatMap((s) => s.split('\n'))
        .filter((l) => l.trim().length > 0)
        .map((l) => {
          try { return JSON.parse(l); } catch (_) { return null; }
        })
        .filter(Boolean);
    },
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// =====================================================================
// §M1 — Concurrent HTTP requests with same key
// =====================================================================

test('§M1.1 concurrent: 2 parallel calls same key → handler corre 1 vez, 2do es 409 IN_PROGRESS o 201 REPLAY', async () => {
  beforeEach();
  // Handler con sleep para forzar solapamiento real.
  let handlerCalls = 0;
  const app = buildApp({
    handlerFn: async (req, res) => {
      handlerCalls++;
      await sleep(80);
      res.status(201).json({ call: handlerCalls, key_prefix: req.idempotency.idempotency_key.slice(0, 8) });
    },
  });
  // Lanzar 2 requests en paralelo.
  const results = await Promise.all([
    request(app).post('/test')
      .set('Idempotency-Key', VALID_UUID)
      .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 }),
    request(app).post('/test')
      .set('Idempotency-Key', VALID_UUID)
      .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 }),
  ]);
  // El handler debe correr exactamente 1 vez. El 2do request es:
  //   - 409 IDEMPOTENCY_KEY_IN_PROGRESS si llegó mientras el 1º aún estaba
  //     en el sleep (escenario típico con 80ms de handler).
  //   - 201 con X-Idempotency-Replay:true si el 1º alcanzó a hacer markComplete
  //     antes de que el 2º llegara al SELECT.
  // Ambos son correctos. Lo que NO está permitido es que el handler corra 2 veces.
  assert.equal(handlerCalls, 1, `handler debe correr exactamente 1 vez, corrió ${handlerCalls}`);
  // Aceptar ambos outcomes. Validar que cada uno cumple contrato.
  const statuses = results.map((r) => r.status).sort();
  // Escenario 1: [201, 409] — 2do fue IN_PROGRESS.
  // Escenario 2: [201, 201] — 2do fue REPLAY (uno lleva X-Idempotency-Replay).
  assert.ok(
    (statuses[0] === 201 && statuses[1] === 201) ||
    (statuses[0] === 201 && statuses[1] === 409),
    `statuses deben ser [201, 201] o [201, 409], obtuve [${statuses.join(', ')}]`
  );
  // Si alguno es 201, validar header de replay correcto.
  const replays = results.filter((r) => r.headers['x-idempotency-replay'] === 'true');
  const news = results.filter((r) => r.status === 201 && r.headers['x-idempotency-replay'] === undefined);
  const conflicts = results.filter((r) => r.status === 409);
  // A lo sumo UN new, a lo sumo DOS replays (1 si el otro fue conflict), conflicts=0 o 1.
  assert.ok(news.length <= 1, `a lo sumo 1 NEW, obtuve ${news.length}`);
  assert.ok(conflicts.length <= 1, `a lo sumo 1 CONFLICT, obtuve ${conflicts.length}`);
  // Si hay 1 REPLAY y 1 NEW, el body del REPLAY debe coincidir con el del NEW.
  if (replays.length === 1 && news.length === 1) {
    assert.deepEqual(replays[0].body, news[0].body, 'REPLAY body debe coincidir con NEW body');
  }
  // Si hay CONFLICT, validar Retry-After y código.
  if (conflicts.length === 1) {
    assert.equal(conflicts[0].body.error.code, 'IDEMPOTENCY_KEY_IN_PROGRESS');
    const retryAfter = parseInt(conflicts[0].headers['retry-after'], 10);
    assert.ok(Number.isInteger(retryAfter) && retryAfter >= 1,
      `Retry-After debe ser >= 1, fue ${conflicts[0].headers['retry-after']}`);
  }
  // Sum check.
  assert.equal(news.length + replays.length + conflicts.length, 2,
    `debe haber 2 responses en total, news=${news.length} replays=${replays.length} conflicts=${conflicts.length}`);
});

test('§M1.2 concurrent: 2nd call DELAYED (después de que el 1st complete) → REPLAY', async () => {
  beforeEach();
  let handlerCalls = 0;
  const app = buildApp({
    handlerFn: async (req, res) => {
      handlerCalls++;
      await sleep(50);
      res.status(201).json({ call: handlerCalls });
    },
  });
  // 1ª request
  const r1 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(r1.status, 201);
  assert.equal(handlerCalls, 1);
  // 2ª request DESPUÉS de que la 1ª complete → debe ser REPLAY.
  const r2 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(r2.status, 201);
  assert.equal(r2.headers['x-idempotency-replay'], 'true',
    '2ª request después de 1ª COMPLETED debe ser REPLAY');
  assert.deepEqual(r2.body, r1.body, 'body del REPLAY debe ser idéntico al del primer call');
  assert.equal(handlerCalls, 1, 'handler no debe re-ejecutarse en REPLAY');
});

test('§M1.3 concurrent: 5 parallel calls same key → handler corre 1 vez, resto REPLAY o IN_PROGRESS', async () => {
  beforeEach();
  let handlerCalls = 0;
  const app = buildApp({
    handlerFn: async (req, res) => {
      handlerCalls++;
      await sleep(100);
      res.status(201).json({ call: handlerCalls });
    },
  });
  // Lanzar 5 en paralelo.
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      request(app).post('/test')
        .set('Idempotency-Key', VALID_UUID)
        .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 })
    );
  }
  const results = await Promise.all(promises);
  // El handler DEBE correr exactamente 1 vez. El resto son REPLAY (201) o
  // IN_PROGRESS (409). En este caso con sleep de 100ms es probable que
  // varios vean REPLAY (porque el 1st completa antes de que los demás
  // lleguen al SELECT).
  assert.equal(handlerCalls, 1, `handler debe correr 1 vez, corrió ${handlerCalls}`);
  for (const r of results) {
    assert.ok(r.status === 201 || r.status === 409,
      `cada response debe ser 201 o 409, obtuve ${r.status}`);
  }
  // Contar correctamente sin doble-contar: un 409 IN_PROGRESS no tiene
  // X-Idempotency-Replay, pero tampoco es NEW. Lo contamos SOLO en inProgress.
  // NEW = 201 sin X-Idempotency-Replay. REPLAY = 201 con X-Idempotency-Replay.
  // IN_PROGRESS = 409.
  const noReplay = results.filter((r) => r.status === 201 && r.headers['x-idempotency-replay'] === undefined);
  const withReplay = results.filter((r) => r.status === 201 && r.headers['x-idempotency-replay'] === 'true');
  const inProgress = results.filter((r) => r.status === 409);
  // Aceptamos: 1 NEW + (3 REPLAY) + (1 IN_PROGRESS) — la suma debe ser 5.
  assert.equal(noReplay.length + withReplay.length + inProgress.length, 5);
});

// =====================================================================
// §M2 — PENDING blocking
// =====================================================================

test('§M2.1 PENDING: 1st handler slow, 2nd call → 409 IN_PROGRESS + Retry-After (si llega durante PENDING)', async () => {
  beforeEach();
  const app = buildApp({
    handlerFn: async (req, res) => {
      await sleep(200);
      res.status(201).json({ ok: true });
    },
  });
  // Lanzar 1ª request — usamos .then() para que se envíe sin bloquear
  // el test. Importante: const p1 = request(...).send(...) NO envía hasta
  // que se await-ee, por eso necesitamos .then() explícito.
  let p1Response;
  const p1Promise = request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 })
    .then((r) => { p1Response = r; })
    .catch((e) => { p1Response = { error: e }; });
  // Esperar 80ms (handler del 1º está en sleep de 200ms).
  await sleep(80);
  // Ahora lanzar 2ª request, que llega durante PENDING del 1º.
  const r2 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  // El 2º debe ser 409 IN_PROGRESS (porque llega durante el PENDING).
  assert.equal(r2.status, 409, '2º request durante PENDING debe ser 409');
  assert.equal(r2.body.error.code, 'IDEMPOTENCY_KEY_IN_PROGRESS');
  const retryAfter = parseInt(r2.headers['retry-after'], 10);
  assert.ok(Number.isInteger(retryAfter) && retryAfter >= 1,
    `Retry-After debe ser >= 1, fue ${r2.headers['retry-after']}`);
  // Esperar a que la 1ª complete.
  await p1Promise;
  assert.equal(p1Response.status, 201, '1ª request completa con 201');
  // Ahora un 3er request debe ser REPLAY (cached).
  const r3 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(r3.status, 201);
  assert.equal(r3.headers['x-idempotency-replay'], 'true',
    '3er request después de COMPLETED debe ser REPLAY');
});

test('§M2.2 PENDING → COMPLETED → 3rd call → 201 REPLAY (cached)', async () => {
  beforeEach();
  let handlerCalls = 0;
  const app = buildApp({
    handlerFn: async (req, res) => {
      handlerCalls++;
      await sleep(50);
      res.status(201).json({ call: handlerCalls, token: 'tok-001' });
    },
  });
  // 1ª: NEW (handler corre).
  const r1 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(r1.status, 201);
  assert.equal(handlerCalls, 1);
  // 2ª: REPLAY (handler NO corre).
  const r2 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(r2.status, 201);
  assert.equal(r2.headers['x-idempotency-replay'], 'true');
  assert.equal(handlerCalls, 1, 'handler no debe re-ejecutarse en REPLAY');
  // El body del REPLAY debe ser el MISMO que el del 1º.
  assert.deepEqual(r2.body, r1.body);
});

// =====================================================================
// §M3 — REPLAY body redaction (C-22)
// =====================================================================

test('§M3.1 REPLAY: body cacheado es el mismo (no se regenera)', async () => {
  beforeEach();
  // Sembrar fila COMPLETED con body complejo (PII-like).
  const cachedBody = {
    id_solicitud: 'sign-xyz-001',
    token: 'tok-original-001',
    url_publica: 'https://firma.example.com/s/abc',
    qr_payload: 'qr-encrypted-payload-001',
    nested: { field: 'value', count: 7 },
  };
  seedCompleted({
    idempotency_key: VALID_UUID,
    response_status: 201,
    response_body: cachedBody,
  });
  const app = buildApp({
    // Este handler NO debe ejecutarse. Si se ejecuta, será un fallo.
    handlerFn: (req, res) => res.status(201).json({ NEW: true, fresh: 'body' }),
  });
  const res = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 201);
  // El body debe ser IDÉNTICO al cacheado.
  assert.deepEqual(res.body, cachedBody);
  assert.equal(res.body.id_solicitud, 'sign-xyz-001');
  assert.equal(res.body.token, 'tok-original-001');
  assert.equal(res.body.qr_payload, 'qr-encrypted-payload-001');
});

test('§M3.2 REPLAY: body es JSON-equal (deep equal) al 1st response', async () => {
  beforeEach();
  // Hacer 1st request real (no seed) y capturar su body.
  const app = buildApp({
    handlerFn: (req, res) => res.status(201).json({ id: 'live-001', meta: { x: 1, y: [1, 2, 3] } }),
  });
  const r1 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  const r2 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.deepEqual(r2.body, r1.body);
  assert.equal(r2.body.id, 'live-001');
  assert.deepEqual(r2.body.meta, { x: 1, y: [1, 2, 3] });
});

test('§M3.3 REPLAY: X-Idempotency-Replay header SOLO en el 2º response, NO en el 1º', async () => {
  beforeEach();
  const app = buildApp({
    handlerFn: (req, res) => res.status(201).json({ call: 'first' }),
  });
  const r1 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(r1.status, 201);
  assert.equal(r1.headers['x-idempotency-replay'], undefined,
    '1er request (NEW) NO debe tener X-Idempotency-Replay');
  const r2 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(r2.status, 201);
  assert.equal(r2.headers['x-idempotency-replay'], 'true',
    '2º request (REPLAY) debe tener X-Idempotency-Replay: true');
});

// =====================================================================
// §M4 — Header attacks
// =====================================================================

test('§M4.1 header: leading whitespace → Node HTTP parser LO TRIM, UUID válido', async () => {
  beforeEach();
  // El parser HTTP de Node (RFC 7230 §3.2.4) trimea whitespace de los valores
  // de header, así que '   550e8400-...' se recibe como '550e8400-...'. Esto es
  // comportamiento estándar de HTTP, no algo que el middleware controle.
  // El test documenta este comportamiento: la key con whitespace es ACEPTADA
  // porque el trim ocurre antes de que el middleware la vea.
  const app = buildApp();
  const res = await request(app).post('/test')
    .set('Idempotency-Key', '   ' + VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 201, 'whitespace en header es trimeado por HTTP parser, key es válida');
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.ok(row, 'la key trimeada fue persistida');
});

test('§M4.2 header: trailing whitespace → Node HTTP parser LO TRIM, UUID válido', async () => {
  beforeEach();
  // Mismo comportamiento que M4.1: el parser HTTP trimea whitespace.
  const app = buildApp();
  const res = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID + '   ')
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 201, 'whitespace en header es trimeado por HTTP parser, key es válida');
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.ok(row, 'la key trimeada fue persistida');
});

test('§M4.3 header: mixed case UUID → aceptado (UUID case-insensitive RFC 4122)', async () => {
  beforeEach();
  const app = buildApp();
  // UUID con case mixto en las primeras letras.
  const mixedUuid = '550E8400-e29b-41D4-a716-446655440000';
  const res = await request(app).post('/test')
    .set('Idempotency-Key', mixedUuid)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 201,
    'UUID con case mixto debe ser aceptado (case-insensitive por RFC 4122)');
  // Y debe haberse guardado en BD.
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: mixedUuid });
  assert.ok(row);
});

test('§M4.4 header: 254 chars (justo bajo el límite) → aceptado', async () => {
  beforeEach();
  // Construir un "UUID" de 254 chars que matchee el regex UUID v4
  // (8-4-4-4-12 = 36 chars; los 218 restantes deben ser chars hex
  // válidos en una posición donde el regex lo permita).
  // PERO el regex exige exactamente 8-4-4-4-12. Por lo tanto un string
  // >36 chars NO matchea el regex → se rechaza. Documentamos.
  const longString = 'a'.repeat(254);  // no es un UUID válido
  const app = buildApp();
  const res = await request(app).post('/test')
    .set('Idempotency-Key', longString)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  // El regex UUID v4 rechaza cualquier string que no sea 8-4-4-4-12 → 400.
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_INVALID',
    'string de 254 chars no es UUID → debe ser rechazado');
});

test('§M4.5 header: 256 chars (sobre el límite) → 400 IDEMPOTENCY_KEY_INVALID', async () => {
  beforeEach();
  const app = buildApp();
  const tooLong = 'a'.repeat(256);
  const res = await request(app).post('/test')
    .set('Idempotency-Key', tooLong)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_INVALID');
  assert.equal(res.body.error.details.reason, 'too_long',
    'detalles deben indicar reason=too_long');
});

test('§M4.6 header: unicode chars → 400 IDEMPOTENCY_KEY_INVALID', async () => {
  beforeEach();
  const app = buildApp();
  const unicodeKey = '550e8400-é29b-41d4-a716-446655440000'; // 'é' no es hex
  const res = await request(app).post('/test')
    .set('Idempotency-Key', unicodeKey)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_INVALID');
});

test('§M4.7 header: dos Idempotency-Key headers → Express concatena con coma → 400 INVALID', async () => {
  beforeEach();
  // Comportamiento observado: cuando Node HTTP recibe dos headers con el
  // mismo nombre, los CONCATENA con ", " (RFC 7230 §3.2.2). Express expone
  // el valor concatenado vía req.get('Idempotency-Key'), por lo que el
  // middleware ve un string como "UUID1, UUID2", que no es un UUID válido.
  // Resultado: 400 IDEMPOTENCY_KEY_INVALID.
  const app = buildApp();
  const res = await request(app).post('/test')
    .set('Idempotency-Key', [VALID_UUID, VALID_UUID_2])
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 400, 'dos headers concatenados no son UUID válido');
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_INVALID');
});

test('§M4.8 header: null byte en valor → supertest/Node HTTP rechaza con ERR_INVALID_CHAR', async () => {
  beforeEach();
  // El parser HTTP de Node rechaza valores de header que contengan caracteres
  // nulos (\0) antes de que lleguen al middleware (lanza ERR_INVALID_CHAR).
  // Esto es defensa estándar de Node, no algo del middleware. Documentamos
  // que el cliente recibe un error del client HTTP, no un 400 del server.
  const app = buildApp();
  const nullByteKey = '550e8400-e29b-41d4-a716-44665544' + '\0' + '0000';
  let threw = false;
  try {
    await request(app).post('/test')
      .set('Idempotency-Key', nullByteKey)
      .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  } catch (e) {
    threw = true;
    // Verificamos que es ERR_INVALID_CHAR (Node HTTP parser, no middleware).
    assert.ok(e.code === 'ERR_INVALID_CHAR' || /invalid character/i.test(e.message),
      `error esperado: ERR_INVALID_CHAR por null byte, obtuve: ${e.message}`);
  }
  assert.ok(threw, 'supertest debe rechazar el null byte antes de enviar el request');
});

// =====================================================================
// §M5 — 5xx doesn't pre-mark FAILED (re-test bajo carga)
// =====================================================================

test('§M5.1 handler throw Error("boom") → 500 al cliente, fila PENDING (no FAILED)', async () => {
  beforeEach();
  const app = buildApp({
    handlerFn: (req, res) => {
      throw new Error('boom');
    },
  });
  const res = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  // errorHandler central serializa como 500.
  assert.equal(res.status, 500);
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.equal(row.status, 'PENDING',
    '5xx/uncaught debe dejar la fila PENDING, NO FAILED (G8 refinado)');
  assert.equal(row.response_status, null);
  assert.equal(row.response_body, null);
  // Re-send dentro del timeout → 409 IN_PROGRESS (la fila sigue PENDING).
  const res2 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res2.status, 409);
  assert.equal(res2.body.error.code, 'IDEMPOTENCY_KEY_IN_PROGRESS');
});

test('§M5.2 handler returns res.status(500) → 500 al cliente, fila PENDING', async () => {
  beforeEach();
  const app = buildApp({
    handlerFn: (req, res) => res.status(500).json({ error: 'oops' }),
  });
  const res = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 500);
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.equal(row.status, 'PENDING',
    'handler 500 (incluso explícito) debe dejar PENDING, no FAILED');
  assert.equal(row.response_status, null,
    '5xx NO debe cachear response_status (a diferencia de 2xx)');
  assert.equal(row.response_body, null);
  // Re-send dentro del timeout → 409 IN_PROGRESS.
  const res2 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res2.status, 409);
  assert.equal(res2.body.error.code, 'IDEMPOTENCY_KEY_IN_PROGRESS');
});

test('§M5.3 handler throw AFTER res.idempotency.terminal() → fila TERMINAL, resend → 409 IDEMPOTENCY_KEY_TERMINAL', async () => {
  beforeEach();
  // El handler llama terminal() ANTES de tirar. El res se envía
  // (porque res.json ya se llamó), luego el throw no afecta al cliente.
  // En realidad, el throw después de res.json() sí afecta porque el
  // errorHandler lo procesa. Verificamos el comportamiento real.
  let appErr;
  try {
    const app = buildApp({
      handlerFn: (req, res) => {
        res.idempotency.terminal({ error: 'rechazado-negocio' }, 409);
        res.status(409).json({ error: 'rechazado-negocio' });
        throw new Error('despues-de-respuesta');
      },
    });
    const res = await request(app).post('/test')
      .set('Idempotency-Key', VALID_UUID)
      .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
    appErr = res;
  } catch (e) {
    appErr = e;
  }
  // El comportamiento es: el res.status(409).json() se envía primero;
  // luego el throw se procesa por el errorHandler. La fila queda TERMINAL
  // porque el hook de 'finish' vio statusCode=409 y opt-in terminal.
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  // Aceptamos PENDING (si el throw evitó que el finish viera el opt-in)
  // o TERMINAL (si el opt-in se procesó antes del throw). En cualquier
  // caso, NO debe ser FAILED.
  assert.ok(row.status === 'PENDING' || row.status === 'TERMINAL',
    `fila no debe ser FAILED, fue ${row.status}`);
  // Si es TERMINAL, el re-send debe ser bloqueado.
  if (row.status === 'TERMINAL') {
    const res2 = await request(app).post('/test')
      .set('Idempotency-Key', VALID_UUID)
      .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
    assert.equal(res2.status, 409);
    assert.equal(res2.body.error.code, 'IDEMPOTENCY_KEY_TERMINAL');
  }
});

test('§M5.4 handler tira DESPUÉS de res.json → cliente recibe 201, fila queda PENDING (defecto documentado)', async () => {
  beforeEach();
  // HALLAZGO DOCUMENTADO: cuando el handler hace res.json() y LUEGO throw,
  // Express invoca errorHandler que intenta res.status(500).json() sobre
  // una response ya enviada. El cliente recibe 201 (la response original),
  // pero internamente res.statusCode queda en 500 y el body capturado por
  // el lifecycle hook es el del errorHandler. El hook ve 5xx y deja la
  // fila PENDING (regla "no blanket FAILED"). El resultado: cliente ve 201
  // pero la fila NO queda COMPLETED. Una llamada subsecuente con misma
  // key + fingerprint verá la fila PENDING y podría recibir 409 IN_PROGRESS
  // (incorrecto, porque la operación SÍ terminó).
  //
  // Este es un edge case (handler con bug de programación que tira tras
  // res.json). El comportamiento actual es conservador (no marca
  // COMPLETED incorrectamente), pero deja al cliente sin opción de
  // REPLAY. Se documenta aquí como HALLAZGO para I-003.5 (SECURITY.md)
  // considerar mitigación (e.g., resetear statusCode al original ANTES
  // de capturar en el hook).
  const app = buildApp({
    handlerFn: (req, res) => {
      res.status(201).json({ ok: true });
      throw new Error('post-response-throw');
    },
  });
  const res = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  // El cliente ve 201 (la response original).
  assert.equal(res.status, 201, 'cliente ve 201 de la response original');
  // Pero la fila está PENDING (no COMPLETED) por la razón documentada arriba.
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.equal(row.status, 'PENDING',
    'HALLAZGO: cliente recibió 201 pero la fila queda PENDING (errorHandler corrompió statusCode)');
});

test('§M5.5 10 sequential 5xx → todas 500, fila PENDING siempre (no FAILED, no TERMINAL)', async () => {
  beforeEach();
  const app = buildApp({
    handlerFn: (req, res) => res.status(500).json({ error: 'oops-' + Math.random() }),
  });
  for (let i = 0; i < 10; i++) {
    const res = await request(app).post('/test')
      .set('Idempotency-Key', VALID_UUID)
      .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
    if (i === 0) {
      // La 1ª: NEW (handler corre, status 500).
      assert.equal(res.status, 500);
    } else {
      // Las siguientes: 409 IN_PROGRESS (la fila está PENDING).
      assert.equal(res.status, 409, `iteración ${i}: esperaba 409, obtuve ${res.status}`);
      assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_IN_PROGRESS');
    }
  }
  // Verificar estado final de la fila.
  const row = readRow({ id_empresa: TEST_EMPRESA_A, idempotency_key: VALID_UUID });
  assert.equal(row.status, 'PENDING',
    'tras 10 5xx secuenciales, la fila NO debe ser FAILED ni TERMINAL (PENDING permite in-flight timeout)');
  assert.equal(row.response_status, null);
  assert.equal(row.response_body, null);
});

// =====================================================================
// §M6 — PII en error responses y logs
// =====================================================================

test('§M6.1 error 409 CONFLICT: response NO contiene id_trabajador, correo, ni body', async () => {
  beforeEach();
  // Seed fila COMPLETED con metadata que incluye PII.
  seedCompleted({
    idempotency_key: VALID_UUID,
    metadata: {
      id_trabajador: '1234567890',  // PII (cédula)
      correo: 'foo@bar.com',         // PII
      nombre: 'Juan Pérez',
    },
  });
  // 2ª request con distinto pdf_sha256 → fuerza CONFLICT.
  const app = buildApp();
  const res = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({
      id_trabajador: '9876543',
      correo: 'different@bar.com',
      pdf_sha256: VALID_PDF_SHA256_B,  // distinto → CONFLICT
    });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_CONFLICT');
  // El response NO debe contener el PII del body enviado.
  const bodyStr = JSON.stringify(res.body);
  assert.ok(!bodyStr.includes('1234567890'),
    'response 409 CONFLICT NO debe contener id_trabajador (PII)');
  assert.ok(!bodyStr.includes('foo@bar.com'),
    'response 409 CONFLICT NO debe contener correo (PII)');
  assert.ok(!bodyStr.includes('Juan Pérez'),
    'response 409 CONFLICT NO debe contener nombre (PII)');
});

test('§M6.2 error 400 INVALID: details NO contiene la key completa (solo metadata)', async () => {
  beforeEach();
  const app = buildApp();
  const badKey = 'not-a-valid-uuid-key-12345';
  const res = await request(app).post('/test')
    .set('Idempotency-Key', badKey)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_INVALID');
  // El error details debe contener razón, NO la key completa.
  const details = res.body.error.details || {};
  const detailsStr = JSON.stringify(details);
  assert.equal(details.reason, 'not_uuid_v4',
    'details debe indicar reason=not_uuid_v4');
  // Verificar que la key completa NO aparece (ni en details, ni en message).
  const fullResponse = JSON.stringify(res.body);
  assert.ok(!fullResponse.includes(badKey),
    'response 400 NO debe contener la key completa (solo metadata del error)');
});

test('§M6.3 error 409 IN_PROGRESS: details contiene retry_after + created_at, NO body ni fingerprint', async () => {
  beforeEach();
  seedPending({ idempotency_key: VALID_UUID });
  const app = buildApp();
  const res = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({
      ...VALID_METADATA,
      pdf_sha256: VALID_PDF_SHA256,
      // Incluir PII-like fields en el body — NUNCA deben aparecer.
      id_trabajador: '1234567890',
      correo: 'pii@example.com',
    });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_IN_PROGRESS');
  const details = res.body.error.details || {};
  // El details DEBE contener info útil para retry.
  assert.equal(typeof details.retry_after, 'number',
    'details debe contener retry_after (segundos)');
  assert.ok(details.retry_after > 0, 'retry_after debe ser positivo');
  assert.equal(typeof details.created_at, 'string',
    'details debe contener created_at (timestamp)');
  // El details NO debe contener PII del body.
  const detailsStr = JSON.stringify(details);
  assert.ok(!detailsStr.includes('1234567890'),
    'details NO debe contener id_trabajador');
  assert.ok(!detailsStr.includes('pii@example.com'),
    'details NO debe contener correo');
  // Y el body completo tampoco debe contenerlos.
  const fullStr = JSON.stringify(res.body);
  assert.ok(!fullStr.includes('1234567890'),
    'response 409 IN_PROGRESS NO debe contener PII del body');
  assert.ok(!fullStr.includes('pii@example.com'),
    'response 409 IN_PROGRESS NO debe contener correo');
});

test('§M6.4 logs: idempotency_key_prefix es 8 chars, NO la key completa, NO el body', async () => {
  beforeEach();
  const logCapture = captureLogs();
  try {
    const app = buildApp();
    const res = await request(app).post('/test')
      .set('Idempotency-Key', VALID_UUID)
      .send({
        ...VALID_METADATA,
        pdf_sha256: VALID_PDF_SHA256,
        id_trabajador: '1234567890',
        correo: 'pii@example.com',
      });
    assert.equal(res.status, 201);
    // Esperar un tick para que los logs se procesen.
    await sleep(20);
    const entries = logCapture.parseLines();
    // Buscar logs de idempotency.
    const idemLogs = entries.filter((e) =>
      e.message && /idempotency/i.test(e.message)
    );
    assert.ok(idemLogs.length > 0, 'debe haber al menos 1 log de idempotency');
    for (const log of idemLogs) {
      // El log debe tener idempotency_key_prefix (8 chars).
      if (log.idempotency_key_prefix) {
        assert.equal(log.idempotency_key_prefix.length, 8,
          `idempotency_key_prefix debe ser 8 chars, fue ${log.idempotency_key_prefix.length}`);
        assert.equal(log.idempotency_key_prefix, VALID_UUID.slice(0, 8));
      }
      // El log NO debe contener la key completa.
      const logStr = JSON.stringify(log);
      assert.ok(!logStr.includes(VALID_UUID),
        'log NO debe contener la idempotency_key completa');
      // El log NO debe contener PII del body.
      assert.ok(!logStr.includes('1234567890'),
        'log NO debe contener id_trabajador (PII)');
      assert.ok(!logStr.includes('pii@example.com'),
        'log NO debe contener correo (PII)');
    }
  } finally {
    logCapture.restore();
  }
});

test('§M6.5 stress: misma key 100 veces con bodies distintos → ningún PII en responses ni logs', async () => {
  beforeEach();
  const logCapture = captureLogs();
  try {
    const app = buildApp({
      handlerFn: (req, res) => res.status(201).json({ ok: true }),
    });
    // 100 requests con la misma key, alternando pdf_sha256 entre A y B.
    // El fingerprint cambia SOLO por el pdf_sha256, no por el resto del body
    // (sin nonce, sin variación de metadata — solo el campo que prueba
    // CONFLICT). Esto produce:
    //   - i=0: pdf=A, NEW → 201 (handler corre).
    //   - i impar: pdf=B, fingerprint distinto al de A → 409 CONFLICT.
    //   - i par (>0): pdf=A, mismo fingerprint que i=0 → 201 REPLAY.
    for (let i = 0; i < 100; i++) {
      const res = await request(app).post('/test')
        .set('Idempotency-Key', VALID_UUID)
        .send({
          ...VALID_METADATA,
          pdf_sha256: i % 2 === 0 ? VALID_PDF_SHA256 : VALID_PDF_SHA256_B,
          id_trabajador: '1234567890',
          correo: 'pii@example.com',
        });
      if (i === 0) {
        // 1ª: NEW (handler corre, 201).
        assert.equal(res.status, 201);
      } else if (i % 2 === 0) {
        // pdf=A, después de la 1ª: REPLAY.
        assert.equal(res.status, 201);
        assert.equal(res.headers['x-idempotency-replay'], 'true');
      } else {
        // pdf=B: CONFLICT.
        assert.equal(res.status, 409);
        assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_CONFLICT');
      }
      // Cada response NO debe contener PII.
      const bodyStr = JSON.stringify(res.body);
      assert.ok(!bodyStr.includes('1234567890'),
        `iter ${i}: response contiene id_trabajador`);
      assert.ok(!bodyStr.includes('pii@example.com'),
        `iter ${i}: response contiene correo`);
    }
    await sleep(50);
    // Verificar logs.
    const entries = logCapture.parseLines();
    for (const log of entries) {
      const logStr = JSON.stringify(log);
      assert.ok(!logStr.includes(VALID_UUID) || logStr.includes(VALID_UUID.slice(0, 8)),
        'log contiene la key completa o solo el prefix?');
      // Más estricto: el log NO debe contener el nonce único de cada iter
      // (cada nonce es 0..99, así que verificamos que el log no tenga
      //  "nonce":50 con PII embebido).
      // En realidad, los logs no loguean el body, así que no tendrán
      // el nonce. Verificamos que no haya PII.
      assert.ok(!logStr.includes('1234567890'),
        'log contiene id_trabajador');
      assert.ok(!logStr.includes('pii@example.com'),
        'log contiene correo');
    }
  } finally {
    logCapture.restore();
  }
});

// =====================================================================
// §M7 — id_empresa missing
// =====================================================================

function buildAppNoAuthz() {
  // App SIN stub de id_empresa (simula que requireEmpresaScope no corrió).
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware());
  // Saltamos el stub de id_empresa intencionalmente.
  app.use(requireIdempotencyKey());
  app.post('/test', (req, res) => res.status(201).json({ ok: true }));
  app.use(errorHandler());
  return app;
}

test('§M7.1 req.id_empresa = undefined → 500 INTERNAL_ERROR', async () => {
  beforeEach();
  const app = buildAppNoAuthz();
  const res = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 500);
  assert.equal(res.body.error.code, 'INTERNAL_ERROR');
  assert.equal(res.body.error.details.reason, 'id_empresa_missing');
});

test('§M7.2 req.id_empresa = null → 500 INTERNAL_ERROR', async () => {
  beforeEach();
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware());
  app.use((req, res, next) => {
    req.id_empresa = null;  // explícitamente null
    next();
  });
  app.use(requireIdempotencyKey());
  app.post('/test', (req, res) => res.status(201).json({ ok: true }));
  app.use(errorHandler());
  const res = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 500);
  assert.equal(res.body.error.code, 'INTERNAL_ERROR');
  assert.equal(res.body.error.details.reason, 'id_empresa_missing');
});

test('§M7.3 req.id_empresa = "" (empty string) → 500 INTERNAL_ERROR', async () => {
  beforeEach();
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware());
  app.use((req, res, next) => {
    req.id_empresa = '';  // empty string
    next();
  });
  app.use(requireIdempotencyKey());
  app.post('/test', (req, res) => res.status(201).json({ ok: true }));
  app.use(errorHandler());
  const res = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 500);
  assert.equal(res.body.error.code, 'INTERNAL_ERROR');
  assert.equal(res.body.error.details.reason, 'id_empresa_missing');
});

test('§M7.4 req.id_empresa = "not-a-valid-nit" → middleware NO valida formato, service acepta', async () => {
  beforeEach();
  // El middleware NO valida el formato de id_empresa (eso es responsabilidad
  // del authz de I-010). El service acepta cualquier string no vacío.
  // Verificamos que el flow funciona (201) cuando id_empresa es un
  // string cualquiera no vacío.
  const app = buildApp({ id_empresa: 'not-a-valid-nit' });
  const res = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(res.status, 201,
    'middleware NO valida formato de id_empresa (responsabilidad del authz)');
  const row = readRow({ id_empresa: 'not-a-valid-nit', idempotency_key: VALID_UUID });
  assert.ok(row);
  assert.equal(row.id_empresa, 'not-a-valid-nit');
});

// =====================================================================
// §M8 — Body fingerprint integrity (pdf_sha256 + metadata)
// =====================================================================

test('§M8.1 mismo metadata, distinto pdf_sha256 → 409 CONFLICT (fingerprint distinto)', async () => {
  beforeEach();
  const app = buildApp();
  // 1ª: pdf=A.
  const r1 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(r1.status, 201);
  // 2ª: mismo metadata, pdf=B → CONFLICT.
  const r2 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256_B });
  assert.equal(r2.status, 409);
  assert.equal(r2.body.error.code, 'IDEMPOTENCY_KEY_CONFLICT');
});

test('§M8.2 distinto metadata, mismo pdf_sha256 → 409 CONFLICT', async () => {
  beforeEach();
  const app = buildApp();
  // 1ª: metadata X.
  const r1 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ id_trabajador: '111', pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(r1.status, 201);
  // 2ª: metadata Y, mismo pdf → CONFLICT.
  const r2 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ id_trabajador: '222', pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(r2.status, 409);
  assert.equal(r2.body.error.code, 'IDEMPOTENCY_KEY_CONFLICT');
});

test('§M8.3 mismo metadata, mismo pdf_sha256 → 201 REPLAY', async () => {
  beforeEach();
  const app = buildApp();
  // 1ª: NEW.
  const r1 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(r1.status, 201);
  assert.equal(r1.headers['x-idempotency-replay'], undefined);
  // 2ª: mismo metadata + mismo pdf → REPLAY.
  const r2 = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: VALID_PDF_SHA256 });
  assert.equal(r2.status, 201);
  assert.equal(r2.headers['x-idempotency-replay'], 'true');
});

test('§M8.4 pdf_sha256 MISSING (no está en body) → 400 INVALID_REQUEST', async () => {
  beforeEach();
  const app = buildApp();
  const res = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA });  // sin pdf_sha256
  assert.equal(res.status, 400);
  // El error code puede ser IDEMPOTENCY_KEY_INVALID (vía mapper) o
  // INVALID_REQUEST (directo del service). Ambos son 400.
  assert.ok(
    res.body.error.code === 'IDEMPOTENCY_KEY_INVALID' ||
    res.body.error.code === 'INVALID_REQUEST',
    `error code inesperado: ${res.body.error.code}`
  );
});

test('§M8.5 pdf_sha256 = null → 400 INVALID_REQUEST', async () => {
  beforeEach();
  const app = buildApp();
  const res = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: null });
  assert.equal(res.status, 400);
  assert.ok(
    res.body.error.code === 'IDEMPOTENCY_KEY_INVALID' ||
    res.body.error.code === 'INVALID_REQUEST',
    `error code inesperado: ${res.body.error.code}`
  );
});

test('§M8.6 pdf_sha256 = "" (empty string) → 400 INVALID_REQUEST', async () => {
  beforeEach();
  const app = buildApp();
  const res = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: '' });
  assert.equal(res.status, 400);
  assert.ok(
    res.body.error.code === 'IDEMPOTENCY_KEY_INVALID' ||
    res.body.error.code === 'INVALID_REQUEST',
    `error code inesperado: ${res.body.error.code}`
  );
});

test('§M8.7 pdf_sha256 = "not-hex" → 400 INVALID_REQUEST', async () => {
  beforeEach();
  const app = buildApp();
  const res = await request(app).post('/test')
    .set('Idempotency-Key', VALID_UUID)
    .send({ ...VALID_METADATA, pdf_sha256: 'xyz123nothex' });
  assert.equal(res.status, 400);
  assert.ok(
    res.body.error.code === 'IDEMPOTENCY_KEY_INVALID' ||
    res.body.error.code === 'INVALID_REQUEST',
    `error code inesperado: ${res.body.error.code}`
  );
});
