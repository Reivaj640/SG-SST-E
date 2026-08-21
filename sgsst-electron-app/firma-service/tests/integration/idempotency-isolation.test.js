/**
 * Tests de integración de aislamiento de idempotency per-empresa.
 *
 * Hipótesis (spec §3): el `Idempotency-Key` está particionado por
 * `id_empresa` (PK compuesta de `gh_idempotency_keys`), NO es global.
 * Si empresa A usa `Idempotency-Key=X` y luego empresa B usa la misma
 * `Idempotency-Key=X`, NO son el mismo request — son DOS requests
 * distintos, cada uno con su propia fila en la tabla.
 *
 * Cobertura:
 *   - Caso 1: A con idem-001 + body B1 → 201 crea A1
 *   - Caso 2: A con idem-001 + mismo body B1 → 201 REPLAY (mismo id_solicitud)
 *   - Caso 3: A con idem-001 + body B2 (distinto) → 409 IDEMPOTENCY_KEY_CONFLICT
 *   - Caso 4: B con idem-001 + body B1 → 201 crea B1 (independiente de A1)
 *   - Caso 5: A con idem-002 + body B1 → 201 crea A2 (key distinta, request nuevo)
 *   - Caso 6: A sin idem + body B1 → 201 (sin replay protection, request nuevo)
 *
 * Verifica también la PARTICIÓN a nivel de tabla: las filas de A y B
 * coexisten con el mismo `idempotency_key` (PK compuesta).
 *
 * Decisiones validadas:
 *   - PK compuesta (id_empresa, idempotency_key) en `gh_idempotency_keys`.
 *   - El fingerprint incluye `id_empresa` indirectamente vía el request
 *     (un sign request de A y uno de B tienen distinto `id_empresa` en
 *     el metadata → fingerprints distintos → no son replay).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../../src/db/connection');
const { PDFDocument } = require('pdf-lib');
const { sha256 } = require('../../src/crypto/hash');
const {
  resetDb, seedActiveAgreement, seedTestClients, makeApp,
  withClientAApiKey, withClientBApiKey,
  TEST_API_KEY_CLIENT_A, TEST_API_KEY_CLIENT_B,
  TEST_EMPRESA_A, TEST_EMPRESA_B,
} = require('../helpers');

let _lastPdf = null;
async function makePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([300, 200]);
  const buf = Buffer.from(await doc.save());
  _lastPdf = buf;
  return buf;
}

function makeMetadata(acuerdo, opts) {
  // El schema requiere document_hash (zod regex SHA-256 hex).
  // El backend recalcula server-side pero el campo debe estar presente
  // para pasar zod. Usamos el hash del PDF que vamos a adjuntar.
  const docHash = sha256(_lastPdf);
  return JSON.stringify({
    id_documento: opts.id_documento,
    id_trabajador: opts.id_trabajador,
    id_empresa: opts.id_empresa,
    tipo_firma: 'presencial',
    agreement_hash: acuerdo.texto_hash,
    agreement_version: acuerdo.version,
    document_hash: docHash,
    version_kair: '0.1.190-test',
    identificacion_tipo: 'CC',
    identificacion_numero_hash: sha256(opts.id_trabajador),
  });
}

/**
 * Helper: hace un POST /internal/sign-requests con la key indicada.
 * Genera un PDF nuevo y adjunta el mismo buffer al request, computando
 * el document_hash para que el schema zod pase.
 */
async function postSign(app, opts) {
  const pdf = await makePdf();
  // Reemplazamos opts.metadata por uno con el document_hash correcto,
  // si opts.metadata es un JSON string que no incluye document_hash.
  let meta = opts.metadata;
  if (typeof meta === 'string' && !meta.includes('"document_hash"')) {
    const parsed = JSON.parse(meta);
    parsed.document_hash = sha256(pdf);
    meta = JSON.stringify(parsed);
  }
  const req = request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', opts.apiKey)
    .field('metadata', meta)
    .attach('documento', pdf, opts.pdfName || 'a.pdf');
  if (opts.idemKey) {
    req.set('Idempotency-Key', opts.idemKey);
  }
  return req;
}

// =============================================================================
// Caso 1: A con idem-001 + body B1 → 201 crea A1
// =============================================================================

test('idempotency isolation #1: A con idem-001 + body B1 → 201 crea A1', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const idem = '00000000-0000-4000-8000-000000000001';
  const meta = makeMetadata(acuerdo, {
    id_documento: 'doc-idem-A1',
    id_trabajador: '111',
    id_empresa: TEST_EMPRESA_A,
  });
  const res = await postSign(app, { apiKey: TEST_API_KEY_CLIENT_A, idemKey: idem, metadata: meta });
  assert.equal(res.status, 201, JSON.stringify(res.body).slice(0, 500));
  const idA1 = res.body.id_solicitud;
  assert.ok(idA1);
});

// =============================================================================
// Caso 2: A con idem-001 + mismo body B1 → 201 REPLAY (mismo id_solicitud)
// =============================================================================

test('idempotency isolation #2: A con idem-001 + mismo body → 201 REPLAY con mismo id_solicitud', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const idem = '00000000-0000-4000-8000-000000000010';
  const meta = makeMetadata(acuerdo, {
    id_documento: 'doc-idem-replay',
    id_trabajador: '111',
    id_empresa: TEST_EMPRESA_A,
  });
  // Primer request
  const r1 = await postSign(app, { apiKey: TEST_API_KEY_CLIENT_A, idemKey: idem, metadata: meta });
  assert.equal(r1.status, 201);
  // Replay
  const r2 = await postSign(app, { apiKey: TEST_API_KEY_CLIENT_A, idemKey: idem, metadata: meta });
  assert.equal(r2.status, 201, JSON.stringify(r2.body).slice(0, 500));
  // Replay puede retornar 201 con el mismo id_solicitud (G3 refinado, I-003 §4)
  // O puede retornar la response cacheada completa. Verificamos que el id es el mismo.
  assert.equal(r2.body.id_solicitud, r1.body.id_solicitud,
    'replay con misma idem+body debe retornar mismo id_solicitud');
});

// =============================================================================
// Caso 3: A con idem-001 + body B2 distinto → 409 IDEMPOTENCY_KEY_CONFLICT
// =============================================================================

test('idempotency isolation #3: A con idem-001 + body DISTINTO → 409 IDEMPOTENCY_KEY_CONFLICT', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const idem = '00000000-0000-4000-8000-000000000020';
  // Primer request con id_documento=A
  const meta1 = makeMetadata(acuerdo, {
    id_documento: 'doc-idem-A-orig',
    id_trabajador: '111',
    id_empresa: TEST_EMPRESA_A,
  });
  const r1 = await postSign(app, { apiKey: TEST_API_KEY_CLIENT_A, idemKey: idem, metadata: meta1 });
  assert.equal(r1.status, 201);

  // Segundo request con MISMA idem pero id_documento distinto
  const meta2 = makeMetadata(acuerdo, {
    id_documento: 'doc-idem-A-DIFFERENT',  // ← CAMBIO
    id_trabajador: '111',
    id_empresa: TEST_EMPRESA_A,
  });
  const r2 = await postSign(app, { apiKey: TEST_API_KEY_CLIENT_A, idemKey: idem, metadata: meta2 });
  assert.equal(r2.status, 409, JSON.stringify(r2.body).slice(0, 500));
  assert.equal(r2.body.error.code, 'IDEMPOTENCY_KEY_CONFLICT');
});

// =============================================================================
// Caso 4: B con idem-001 + body B1 → 201 crea B1 (independiente de A1)
// =============================================================================

test('idempotency isolation #4: B con misma idem-001 → 201 crea B1 (independiente de A1)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const idem = '00000000-0000-4000-8000-000000000030';

  // A crea A1
  const metaA = makeMetadata(acuerdo, {
    id_documento: 'doc-idem-shared-A',
    id_trabajador: '111',
    id_empresa: TEST_EMPRESA_A,
  });
  const rA = await postSign(app, { apiKey: TEST_API_KEY_CLIENT_A, idemKey: idem, metadata: metaA });
  assert.equal(rA.status, 201);
  const idA1 = rA.body.id_solicitud;

  // B con la MISMA idem-001 pero body con id_trabajador distinto (también distinto id_empresa)
  // El idem-001 pertenece solo al scope de A. B debe poder usarla libremente.
  const metaB = makeMetadata(acuerdo, {
    id_documento: 'doc-idem-shared-B',
    id_trabajador: '222',
    id_empresa: TEST_EMPRESA_B,
  });
  const rB = await postSign(app, { apiKey: TEST_API_KEY_CLIENT_B, idemKey: idem, metadata: metaB });
  assert.equal(rB.status, 201, JSON.stringify(rB.body).slice(0, 500));
  const idB1 = rB.body.id_solicitud;

  // B1 debe ser distinto de A1
  assert.notEqual(idA1, idB1, 'B con misma idem debe crear un sign request DISTINTO al de A');

  // Verificación adicional: 2 filas en gh_idempotency_keys con misma idempotency_key
  // pero distintos id_empresa (PK compuesta, debe coexistir).
  const rows = db.prepare(
    'SELECT id_empresa, idempotency_key FROM gh_idempotency_keys WHERE idempotency_key = ?'
  ).all(idem);
  assert.equal(rows.length, 2, 'debe haber 2 filas con misma idempotency_key pero distintos id_empresa');
  const idEmpresas = rows.map(r => r.id_empresa).sort();
  assert.deepEqual(idEmpresas, [TEST_EMPRESA_A, TEST_EMPRESA_B].sort());
});

// =============================================================================
// Caso 5: A con idem-002 + body B1 → 201 crea A2 (key distinta, request nuevo)
// =============================================================================

test('idempotency isolation #5: A con idem-002 distinta → 201 crea A2 (request nuevo)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const meta = makeMetadata(acuerdo, {
    id_documento: 'doc-idem-002',
    id_trabajador: '111',
    id_empresa: TEST_EMPRESA_A,
  });
  const r = await postSign(app, {
    apiKey: TEST_API_KEY_CLIENT_A,
    idemKey: '00000000-0000-4000-8000-000000000040',
    metadata: meta,
  });
  assert.equal(r.status, 201);
  assert.ok(r.body.id_solicitud);
});

// =============================================================================
// Caso 6: A sin idem + body B1 → 201 (sin replay protection)
// =============================================================================

test('idempotency isolation #6: A sin Idempotency-Key → 201 (request nuevo siempre)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const meta = makeMetadata(acuerdo, {
    id_documento: 'doc-no-idem',
    id_trabajador: '111',
    id_empresa: TEST_EMPRESA_A,
  });
  // Sin header Idempotency-Key
  const r = await postSign(app, { apiKey: TEST_API_KEY_CLIENT_A, metadata: meta });
  assert.equal(r.status, 201);
  assert.ok(r.body.id_solicitud);
});

// =============================================================================
// Test de regresión: PK compuesta de gh_idempotency_keys
// =============================================================================

test('idempotency isolation #7 (regresión PK): dos filas con misma idempotency_key pero distinto id_empresa coexisten', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  seedTestClients();
  const app = makeApp();
  const idemCompartida = '00000000-0000-4000-8000-000000000050';

  // A
  const metaA = makeMetadata(acuerdo, {
    id_documento: 'doc-pk-test-A',
    id_trabajador: '111',
    id_empresa: TEST_EMPRESA_A,
  });
  const rA = await postSign(app, { apiKey: TEST_API_KEY_CLIENT_A, idemKey: idemCompartida, metadata: metaA });
  assert.equal(rA.status, 201);

  // B (con la misma idem)
  const metaB = makeMetadata(acuerdo, {
    id_documento: 'doc-pk-test-B',
    id_trabajador: '222',
    id_empresa: TEST_EMPRESA_B,
  });
  const rB = await postSign(app, { apiKey: TEST_API_KEY_CLIENT_B, idemKey: idemCompartida, metadata: metaB });
  assert.equal(rB.status, 201);

  // Ambas filas deben existir
  const count = db.prepare(
    'SELECT COUNT(*) AS n FROM gh_idempotency_keys WHERE idempotency_key = ?'
  ).get(idemCompartida);
  assert.equal(count.n, 2, 'PK compuesta debe permitir 2 filas con misma idempotency_key');
});
