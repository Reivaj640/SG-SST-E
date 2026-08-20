/**
 * Tests E2E del rate limit interno en composición (I-E2E.4, §F7 reducido).
 *
 * Este archivo complementa los tests unitarios de `internalServerLimiter`
 * verificando que la CAPA 4 (anomalía > 10 X-Client-Instance-Id distintos /
 * 24h) del rate limit interno dispara 429 sobre un endpoint REAL
 * (`POST /internal/sign-requests`) con `makeApp()` y el stack HTTP
 * completo, NO con una mini-app.
 *
 * Alcance I-E2E.4 (4 tests + 1 HALLAZGO documentado en I-E2E.4).
 * I-008.2 (re-habilita E2E-RL.3 + cierra HALLAZGO #1). Total actual: 5 tests.
 *
 *   E2E-RL.1  clientA POST /internal/sign-requests 11 veces con 11
 *             X-Client-Instance-Id distintos → la 11ª debe ser 429 con
 *             `error.code === 'RATE_LIMIT_EXCEEDED'`,
 *             `error.details.limiter === 'anomaly'`. Las 10 primeras
 *             son 201 (el threshold es > 10, así que la 11ª es la
 *             primera en disparar).
 *   E2E-RL.2  Cross-company: la anomalía generada por empresa A NO
 *             afecta a empresa B. Verifica que el tracker de capa 4
 *             está scopeado por id_empresa.
 *   E2E-RL.3  (REHABILITADO en I-008.2) 429 incluye headers IETF draft-7
 *             (`RateLimit-Policy`, `RateLimit`). Originalmente iba a
 *             verificar estos headers pero la implementación reveló que
 *             NO se entregaban (HALLAZGO #1, documentado originalmente
 *             en este archivo). I-008.2 corrige el bug setteando los
 *             headers manualmente antes de next(err). Ver HALLAZGO #1
 *             más abajo para detalles de la causa raíz.
 *   E2E-RL.4  El cuerpo del 429 sigue el contrato estándar de error:
 *             `error.code = 'RATE_LIMIT_EXCEEDED'`, `error.message` no
 *             vacío, `error.request_id` presente, `error.details` con
 *             `{limiter, limit, window_ms}`.
 *   E2E-RL.5  SKIP de capa 4 sin X-Client-Instance-Id: 50 POSTs
 *             desde la misma IP/empresa sin el header → ninguno debe
 *             ser 429 por anomalía (capa 4 SKIP cuando instance es
 *             inválido/ausente).
 *
 * Diferencias vs tests existentes:
 *   - tests/middleware/rateLimit.test.js (13 tests): unit tests de
 *     los 4 limiters PÚBLICOS (global, otp, commit, signRequest).
 *   - tests/middleware/internalServerLimiter.test.js (11 tests):
 *     unit tests de las 4 capas con mini-apps Express + endpoint
 *     dummy. Cubre la lógica de cada capa en aislamiento.
 *
 * Acá cubrimos la COMPOSICIÓN con el endpoint REAL
 * `POST /internal/sign-requests`, la composición con authz per-empresa
 * (I-010), y el contrato de error del 429 que verá K+AIR.
 *
 * Decisiones de scope (de la auditoría F7):
 *   - Capas 1, 2, 3 NO se prueban en E2E porque requieren 720+/240+/480+
 *     requests reales (~30s) o env var overrides que afectarían toda
 *     la suite. Ya están cubiertas en `internalServerLimiter.test.js`
 *     y `authz.test.js` (composición con authz).
 *   - Solo capa 4 es factible de testear con `makeApp()` y requests
 *     reales (11 requests, ~100ms).
 *   - Los limiters son SINGLETONS; `_clearInstanceTracker()` resetea
 *     solo capa 4. Las otras capas se resetean naturalmente por el
 *     contexto del test (no se acumulan con esta cantidad de requests).
 *
 * Aislamiento entre tests:
 *   - Cada test llama `_clearInstanceTracker()` al inicio (resetea capa 4).
 *   - Cada test usa X-Forwarded-For único (10.99.X.Y) para aislar
 *     buckets de capa 3.
 *   - Cada test usa X-Client-Instance-Id únicos dentro del test.
 *   - resetDb() limpia la BD y el cache de internalClient.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const { sha256 } = require('../../src/crypto/hash');
const rateLimitModule = require('../../src/middleware/rateLimit');
const {
  resetDb, seedActiveAgreement, seedTestClients, makeApp,
  withClientAApiKey, withClientBApiKey,
  TEST_API_KEY_CLIENT_A, TEST_API_KEY_CLIENT_B, TEST_EMPRESA_A, TEST_EMPRESA_B,
  createAcceptedConsent,
} = require('../helpers');

// =========================================================================
// CONSTANTES
// =========================================================================

// Re-export del módulo para que las aserciones no dependan de magic
// numbers sueltos. Si el módulo cambia estos defaults, los tests fallarán
// y exigirán actualizar.
const ANOMALY_LIMIT = rateLimitModule.INSTANCE_ANOMALY_LIMIT;          // 10
const ANOMALY_WINDOW_MS = rateLimitModule.INSTANCE_ANOMALY_WINDOW_MS;  // 86400000 (24h)

// =========================================================================
// HELPERS
// =========================================================================

/**
 * Crea un PDF válido con pdf-lib. El `seed` permite que cada test tenga
 * un PDF con bytes distintos (SHA-256 server-computed diferente).
 */
async function makePdf(seed = 'e2e') {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  page.drawText(`e2e-doc-${seed}`);
  return Buffer.from(await doc.save());
}

/**
 * Construye el metadata para POST /internal/sign-requests con los campos
 * mínimos requeridos por zod.
 */
function buildMetadata(acuerdo, overrides = {}) {
  return {
    id_documento: 'doc-e2e',
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    tipo_firma: 'presencial',
    agreement_hash: acuerdo.texto_hash,
    agreement_version: acuerdo.version,
    document_hash: null,
    version_kair: '0.1.189-test',
    identificacion_tipo: 'CC',
    identificacion_numero_hash: sha256('1234567890'),
    ...overrides,
  };
}

/**
 * Helper para E2E-RL.1/3/4: hace N POSTs a /internal/sign-requests con
 * instancias distintas. Retorna un array de responses. El threshold es
 * `ANOMALY_LIMIT + 1` (la request #`ANOMALY_LIMIT + 1` es la primera
 * en disparar la anomalía).
 *
 * @param {object} opts
 * @param {object} opts.app     - Express app (de makeApp())
 * @param {object} opts.acuerdo - Acuerdo sembrado
 * @param {string} opts.forwardedFor - X-Forwarded-For único para aislar capa 3
 * @param {number} [opts.count=ANOMALY_LIMIT + 1] - cantidad de POSTs
 * @param {string} [opts.idemKeyPrefix] - prefijo de Idempotency-Key (default: nada)
 * @returns {Promise<Array>} array de responses de supertest
 */
async function postNRequests({ app, acuerdo, forwardedFor, count = ANOMALY_LIMIT + 1, idemKeyPrefix = '' }) {
  const responses = [];
  for (let i = 0; i < count; i++) {
    const pdf = await makePdf(`rl-${crypto.randomBytes(4).toString('hex')}`);
    const meta = buildMetadata(acuerdo);
    meta.document_hash = sha256(pdf);
    // Idempotency-Key distinto por request para evitar 409 IDEMPOTENCY_KEY_CONFLICT.
    // Usamos un prefijo + counter para que las keys sean UUIDs v4 válidos.
    const idemKey = idemKeyPrefix
      ? crypto.randomUUID()
      : crypto.randomUUID();
    const r = await withClientAApiKey(
      request(app)
        .post('/internal/sign-requests')
        .set('X-Forwarded-For', forwardedFor)
        .set('X-Client-Instance-Id', `inst-${i}`)
        .set('Idempotency-Key', idemKey)
        .field('metadata', JSON.stringify(meta))
        .attach('documento', pdf, 'contrato.pdf')
    );
    responses.push(r);
  }
  return responses;
}

// =========================================================================
// §F7 (CAPA 4 SOLAMENTE) — RATE LIMIT E2E
// =========================================================================

/**
 * E2E-RL.1: Capa 4 dispara 429 en endpoint real /internal/sign-requests.
 *
 * Verifica que después de `ANOMALY_LIMIT` (10) requests con
 * X-Client-Instance-Id distintos, la siguiente dispara la anomalía
 * y retorna 429 con el código y details correctos.
 *
 * Coverage NO duplicado con `internalServerLimiter.test.js`:
 *   - El test unit usa un endpoint dummy (`/ping`) y un middleware
 *     que setea `req.id_empresa` manualmente.
 *   - Acá usamos `makeApp()` (mismo que producción) con el route
 *     real + authz per-empresa + PDF validation + idempotency.
 */
test('E2E-RL.1: 11 X-Client-Instance-Id distintos en POST /internal/sign-requests → 11ª 429', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  rateLimitModule._clearInstanceTracker();
  const app = makeApp();
  const forwardedFor = '10.99.1.1';

  const responses = await postNRequests({
    app, acuerdo, forwardedFor, count: ANOMALY_LIMIT + 1,
  });

  // Las primeras ANOMALY_LIMIT requests deben pasar (201)
  for (let i = 0; i < ANOMALY_LIMIT; i++) {
    assert.equal(responses[i].status, 201,
      `request #${i + 1} con instance inst-${i} debe ser 201, obtuve ${responses[i].status} ${JSON.stringify(responses[i].body)}`);
    assert.ok(responses[i].body.token,
      `request #${i + 1} debe retornar token`);
  }

  // La request #ANOMALY_LIMIT + 1 (inst-10) es la 11ª instance distinta
  // → dispara la anomalía → 429
  const last = responses[ANOMALY_LIMIT];
  assert.equal(last.status, 429,
    `request #${ANOMALY_LIMIT + 1} con instance inst-${ANOMALY_LIMIT} debe ser 429, obtuve ${last.status} ${JSON.stringify(last.body)}`);
  assert.equal(last.body.error.code, 'RATE_LIMIT_EXCEEDED');
  assert.equal(last.body.error.details.limiter, 'anomaly');
  assert.equal(last.body.error.details.limit, ANOMALY_LIMIT);
  assert.equal(last.body.error.details.window_ms, ANOMALY_WINDOW_MS);

  // Solo se crearon ANOMALY_LIMIT sign requests (la 11ª fue 429 antes de create)
  const signRequestCount = db_count_sign_requests();
  assert.equal(signRequestCount, ANOMALY_LIMIT,
    `Solo deben existir ${ANOMALY_LIMIT} sign requests (la 11ª fue 429, no creó)`);
});

/**
 * Helper: cuenta los sign requests. Lo defino acá para no importar db
 * en el archivo de tests (se usa solo en este test).
 */
function db_count_sign_requests() {
  const db = require('../../src/db/connection');
  return db.prepare('SELECT COUNT(*) AS n FROM gh_firmas_electronicas').get().n;
}

/**
 * E2E-RL.2: Cross-company — la anomalía de A no bloquea a B.
 *
 * Verifica que el tracker de capa 4 está scopeado por id_empresa.
 * Empresa A dispara la anomalía (10 instances OK + 1 = 429). Después,
 * empresa B hace 1 request con un instance id cualquiera → 201, NO
 * afectado por la anomalía de A.
 */
test('E2E-RL.2: cross-company — anomalía de empresa A no bloquea empresa B', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  rateLimitModule._clearInstanceTracker();
  const app = makeApp();
  const fwdA = '10.99.1.2';
  const fwdB = '10.99.1.3';

  // Empresa A: 10 instances OK, 11ª → 429
  const responsesA = [];
  for (let i = 0; i < ANOMALY_LIMIT; i++) {
    const pdf = await makePdf(`rl2-A-${i}`);
    const meta = buildMetadata(acuerdo, { id_empresa: TEST_EMPRESA_A });
    meta.document_hash = sha256(pdf);
    const r = await withClientAApiKey(
      request(app)
        .post('/internal/sign-requests')
        .set('X-Forwarded-For', fwdA)
        .set('X-Client-Instance-Id', `A-inst-${i}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .field('metadata', JSON.stringify(meta))
        .attach('documento', pdf, 'a.pdf')
    );
    responsesA.push(r);
    assert.equal(r.status, 201, `A request #${i + 1} debe ser 201`);
  }
  // 11ª A: anomalía
  const pdfA11 = await makePdf('rl2-A-11');
  const metaA11 = buildMetadata(acuerdo, { id_empresa: TEST_EMPRESA_A });
  metaA11.document_hash = sha256(pdfA11);
  const rA11 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('X-Forwarded-For', fwdA)
      .set('X-Client-Instance-Id', 'A-inst-10')
      .set('Idempotency-Key', crypto.randomUUID())
      .field('metadata', JSON.stringify(metaA11))
      .attach('documento', pdfA11, 'a11.pdf')
  );
  assert.equal(rA11.status, 429, 'A 11ª instance debe ser 429');

  // Empresa B: 1 request → debe ser 201, NO afectada por anomalía de A
  const pdfB = await makePdf('rl2-B');
  const metaB = buildMetadata(acuerdo, { id_empresa: TEST_EMPRESA_B });
  metaB.document_hash = sha256(pdfB);
  const rB = await withClientBApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('X-Forwarded-For', fwdB)
      .set('X-Client-Instance-Id', 'B-inst-0')
      .set('Idempotency-Key', crypto.randomUUID())
      .field('metadata', JSON.stringify(metaB))
      .attach('documento', pdfB, 'b.pdf')
  );
  assert.equal(rB.status, 201,
    `B 1ª request NO debe ser afectada por anomalía de A, obtuve ${rB.status} ${JSON.stringify(rB.body)}`);
  assert.ok(rB.body.token, 'B debe retornar token');
});

// ============================================================================
// HALLAZGO #1 — IETF draft-7 headers NO se entregan en respuestas 429
// ============================================================================
//
// Severidad: MEDIA (afecta el contrato con K+AIR; el cliente no puede
// saber cuántos requests le quedan ni cuándo reintentar con backoff
// inteligente).
//
// Ubicación: src/middleware/rateLimit.js:78-93 (función makeHandler).
//
// Síntoma: la respuesta 429 que el cliente recibe NO lleva los headers
// `RateLimit-Policy` ni `RateLimit`, aunque la config de express-rate-limit
// los anuncia con `standardHeaders: 'draft-7'`.
//
// Causa: express-rate-limit solo setea los headers IETF cuando su handler
// interno envía la respuesta (`res.status(429).json(...)` directo). Cuando
// se usa un handler custom que llama `next(new AppError(...))` (como en
// `makeHandler`), express-rate-limit NO setea los headers. El
// errorHandler central luego envía solo el JSON, sin headers IETF.
//
// Decisión: NO se corrige producción en este bloque (fuera de scope de
// I-E2E.4). Se programa como fix futuro en un bloque independiente
// (I-008.x o I-013b según prioridad). El test E2E-RL.3 que verificaba
// estos headers fue REMOVIDO de este archivo y se reincorporará cuando
// el fix de producción se implemente.
//
// Impacto para K+AIR:
//   - No puede saber cuántos requests le quedan antes del reset
//     (RateLimit: limit=…, remaining=…, reset=…s).
//   - No puede hacer backoff inteligente basado en headers.
//   - Solo tiene el body `details.window_ms` para inferir el reset.
//   - Workaround manual: usar 86400s (24h) como peor caso o consultar
//     el estado del sign request después del 429.
//
// Reproducción:
//   1. resetDb(); seedTestClients(); rateLimit._clearInstanceTracker();
//   2. POST /internal/sign-requests con 11 X-Client-Instance-Id distintos.
//   3. La 11ª retorna 429 con body correcto pero res.headers no
//      incluye `RateLimit-Policy` ni `RateLimit`.
//
// FIX PROPUESTO (fuera de scope de I-E2E.4):
//   En makeHandler, antes de llamar next(err), setear manualmente
//   los headers IETF usando los optionsUsed:
//     res.setHeader('RateLimit-Policy', `${optionsUsed.limit};w=${Math.floor(optionsUsed.windowMs/1000)}`);
//     res.setHeader('RateLimit', `limit=${optionsUsed.limit}, remaining=0, reset=${Math.ceil(optionsUsed.windowMs/1000)}`);
//   Esto preserva la intención original del standardHeaders: 'draft-7'
//   declarada en la config.
// ============================================================================

/**
 * E2E-RL.4: Cuerpo 429 RATE_LIMIT_EXCEEDED con details.

/**
 * E2E-RL.4: Cuerpo 429 RATE_LIMIT_EXCEEDED con details.
 *
 * Verifica que el body del 429 sigue el contrato estándar de error:
 *   - `error.code = 'RATE_LIMIT_EXCEEDED'`
 *   - `error.message` no vacío y human-readable
 *   - `error.request_id` presente (para correlación con logs)
 *   - `error.details.limiter = 'anomaly'`
 *   - `error.details.limit = 10`
 *   - `error.details.window_ms = 86400000`
 */
test('E2E-RL.4: cuerpo 429 RATE_LIMIT_EXCEEDED con details.limiter/limit/window_ms', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  rateLimitModule._clearInstanceTracker();
  const app = makeApp();
  const forwardedFor = '10.99.1.5';

  const responses = await postNRequests({
    app, acuerdo, forwardedFor, count: ANOMALY_LIMIT + 1,
  });

  const last = responses[ANOMALY_LIMIT];
  assert.equal(last.status, 429, '11ª request debe ser 429');

  // Cuerpo estándar
  assert.equal(last.body.error.code, 'RATE_LIMIT_EXCEEDED',
    'error.code debe ser RATE_LIMIT_EXCEEDED');
  assert.ok(last.body.error.message, 'error.message no debe estar vacío');
  assert.ok(typeof last.body.error.message === 'string' && last.body.error.message.length > 0,
    'error.message debe ser string no vacío');
  assert.ok(last.body.error.request_id,
    'error.request_id debe estar presente (para correlación con logs)');

  // Details del rate limit
  assert.equal(last.body.error.details.limiter, 'anomaly',
    'details.limiter debe ser "anomaly"');
  assert.equal(last.body.error.details.limit, ANOMALY_LIMIT,
    `details.limit debe ser ${ANOMALY_LIMIT}`);
  assert.equal(last.body.error.details.window_ms, ANOMALY_WINDOW_MS,
    `details.window_ms debe ser ${ANOMALY_WINDOW_MS} (24h)`);
});

/**
 * E2E-RL.5 (opcional): SKIP de capa 4 sin X-Client-Instance-Id.
 *
 * Verifica que cuando NO se envía el header X-Client-Instance-Id,
 * la capa 4 NO dispara, incluso con muchas requests. Esto valida el
 * skip condition del rate limit (rateLimit.js:326):
 *   `if (!id_empresa || !instanceId) return false;`
 *
 * Hace 50 requests sin el header. Si la skip condition funciona,
 * ninguna será 429 por anomalía. Pueden ser 201 (éxito) u otros
 * status (validación de PDF, etc.) — lo crítico es que NINGUNA sea
 * 429 con `details.limiter === 'anomaly'`.
 */
test('E2E-RL.5: sin X-Client-Instance-Id → SKIP de capa 4 (50 requests sin 429)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  rateLimitModule._clearInstanceTracker();
  const app = makeApp();
  const forwardedFor = '10.99.1.6';

  // 50 POSTs sin X-Client-Instance-Id
  let anomalyCount = 0;
  for (let i = 0; i < 50; i++) {
    const pdf = await makePdf(`rl5-${i}`);
    const meta = buildMetadata(acuerdo);
    meta.document_hash = sha256(pdf);
    const r = await withClientAApiKey(
      request(app)
        .post('/internal/sign-requests')
        .set('X-Forwarded-For', forwardedFor)
        // NO se setea X-Client-Instance-Id
        .set('Idempotency-Key', crypto.randomUUID())
        .field('metadata', JSON.stringify(meta))
        .attach('documento', pdf, 'contrato.pdf')
    );
    // Lo crítico: ninguna debe ser 429 con limiter='anomaly'.
    // (Pueden ser 201 o 4xx de validación, eso es OK).
    if (r.status === 429 && r.body.error && r.body.error.details && r.body.error.details.limiter === 'anomaly') {
      anomalyCount++;
    }
  }
  assert.equal(anomalyCount, 0,
    `Capa 4 debe SKIP sin X-Client-Instance-Id, pero ${anomalyCount} requests dispararon anomalía`);
});

/**
 * E2E-RL.3 (REHABILITADO en I-008.2): 429 incluye headers IETF draft-7.
 *
 * HALLAZGO #1 documentado en I-E2E.4: los headers IETF NO se entregaban
 * en respuestas 429 porque el handler custom en makeHandler() llamaba
 * next(err) en lugar de enviar la respuesta directamente. I-008.2 corrige
 * el bug setteando los headers manualmente antes de next(err).
 *
 * Verifica con stack E2E completo (authz + rate limit + 429 response)
 * que:
 *   - Status 429
 *   - Header `RateLimit-Policy: <limit>;w=<windowSec>` presente
 *   - Header `RateLimit: limit=<limit>, remaining=0, reset=<windowSec>` presente
 *   - Body sigue siendo RATE_LIMIT_EXCEEDED (contrato estándar)
 *
 * Usa Capa 4 (anomaly) con 11 instance ids distintos — más rápido
 * que 720 requests de Capa 1.
 */
test('E2E-RL.3 (rehabilitado I-008.2): 429 de Capa 4 incluye headers IETF draft-7', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  rateLimitModule._clearInstanceTracker();
  const app = makeApp();
  const forwardedFor = '10.99.2.1';

  // Disparar anomalía: ANOMALY_LIMIT=10 requests OK, la 11ª dispara 429.
  // Capa 4 verifica: tras registrar la 11ª instance, instances.size=11 > 10.
  for (let i = 0; i < ANOMALY_LIMIT; i++) {
    const pdf = await makePdf(`rl3-${i}`);
    const meta = buildMetadata(acuerdo);
    meta.document_hash = sha256(pdf);
    const r = await withClientAApiKey(
      request(app)
        .post('/internal/sign-requests')
        .set('X-Forwarded-For', forwardedFor)
        .set('X-Client-Instance-Id', `instance-rl3-${i}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .field('metadata', JSON.stringify(meta))
        .attach('documento', pdf, 'contrato.pdf')
    );
    assert.equal(r.status, 201, `request #${i + 1} debería ser 201, obtuve ${r.status}`);
  }

  // Request #ANOMALY_LIMIT + 1 (i=10) es la 11ª instance distinta
  // → dispara la anomalía → 429
  const pdfTrig = await makePdf('rl3-trigger');
  const metaTrig = buildMetadata(acuerdo);
  metaTrig.document_hash = sha256(pdfTrig);
  const rTrig = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('X-Forwarded-For', forwardedFor)
      .set('X-Client-Instance-Id', 'instance-rl3-trigger')
      .set('Idempotency-Key', crypto.randomUUID())
      .field('metadata', JSON.stringify(metaTrig))
      .attach('documento', pdfTrig, 'contrato.pdf')
  );

  assert.equal(rTrig.status, 429, `debe ser 429, obtuve ${rTrig.status}`);
  assert.equal(rTrig.body.error.code, 'RATE_LIMIT_EXCEEDED');
  assert.equal(rTrig.body.error.details.limiter, 'anomaly');

  // Headers IETF draft-7 (lowercase en Node.js)
  const policy = rTrig.headers['ratelimit-policy'];
  const rateLimit = rTrig.headers['ratelimit'];

  assert.ok(policy, 'header RateLimit-Policy debe estar presente');
  // INSTANCE_ANOMALY_LIMIT=10, INSTANCE_ANOMALY_WINDOW_MS=24h=86400s
  assert.match(policy, /^10;w=86400$/,
    `RateLimit-Policy debe ser "10;w=86400", recibido "${policy}"`);

  assert.ok(rateLimit, 'header RateLimit debe estar presente');
  assert.match(rateLimit, /^limit=10, remaining=0, reset=86400$/,
    `RateLimit debe ser "limit=10, remaining=0, reset=86400", recibido "${rateLimit}"`);
});
