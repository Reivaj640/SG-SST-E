/**
 * Tests del endpoint POST /internal/sign-requests/:id/revoke (Bloque E7.2).
 *
 * Cobertura:
 * - Auth (X-Admin-API-Key) — 4 tests
 * - Validación de body (zod) — 11 tests
 * - Validación de :id — 3 tests
 * - Estados permitidos → 200 — 6 tests (uno por estado del enunciado)
 * - Estados NO permitidos → 409 — 9 tests (uno por cada estado prohibido)
 * - Idempotencia — 2 tests
 * - Metadata del evento REVOKED — 1 test
 * - Aislamiento entre requests — 1 test
 * - Audit trail ve el REVOKED — 1 test
 *
 * TOTAL: 38 tests.
 *
 * IMPORTANTE: estos tests NO dependen de los cambios de Bloque E6.
 * Forzamos estados vía UPDATE directo sobre gh_firmas_electronicas
 * para no depender del flujo público (que E6 está modificando).
 *
 * Ver C:\Temp\e7-design.md §4 para el contrato.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../../src/db/connection');
const {
  resetDb, seedActiveAgreement, makeApp, TEST_API_KEY, TEST_ADMIN_API_KEY,
} = require('../helpers');
const signRequestService = require('../../src/services/signRequest');

const ADMIN_HEADERS = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };
const INTERNAL_HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };

// Estados permitidos para revoke (alineados con el enunciado del usuario E7)
const ALLOWED_STATES = [
  'PENDING',                  // ex "CREATED" en el enunciado
  'OPENED',
  'IDENTIFICATION_STARTED',
  'IDENTIFIED',
  'OTP_VERIFIED',
  'DOCUMENT_VIEWED',
];

// Estados prohibidos (terminales + intermedios no listados en enunciado)
const FORBIDDEN_STATES = [
  'SIGNED',                   // inmutable
  'REJECTED',                 // decisión del trabajador
  'EXPIRED',                  // cerrado por el sistema
  'CANCELLED',                // terminal
  'OTP_SENT',                 // gap a discutir con usuario
  'DOCUMENT_OPENED',          // gap a discutir
  'MANIFESTATION_RECORDED',   // voluntad ya registrada
  'OTP_LOCKED',               // gap a discutir
  'IDENTIFICATION_FAILED',    // ya falló; crear otra
];

// =================================================================
// Helpers
// =================================================================

function makePdf() {
  return Buffer.concat([
    Buffer.from('%PDF-1.4\n'),
    Buffer.from('1 0 obj\n<< /Type /Catalog >>\nendobj\n'),
    Buffer.from('trailer\n<< /Root 1 0 R >>\n%%EOF\n'),
  ]);
}

/**
 * Crea un sign request en el estado deseado (sin pasar por flujo público).
 * @param {string} estado - Estado forzado (ej. 'PENDING', 'DOCUMENT_VIEWED')
 * @returns {object} El sign request creado.
 */
function createSignRequestInState(estado) {
  // Reusar el Acuerdo activo si ya existe (varios sign requests en el mismo test).
  const agreementService = require('../../src/services/agreement');
  const acuerdo = agreementService.getActive() || seedActiveAgreement();
  const pdf = makePdf();
  const { sha256 } = require('../../src/crypto/hash');
  const result = signRequestService.create({
    id_documento: 'doc-test',
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    tipo_firma: 'presencial',
    agreement_version: acuerdo.version,
    agreement_hash: acuerdo.texto_hash,
    document_hash: sha256(pdf),
    pdf_buffer: pdf,
    pdf_filename: 'test.pdf',
    version_kair: '0.1.189-test',
  });
  db.prepare('UPDATE gh_firmas_electronicas SET estado = ? WHERE id = ?')
    .run(estado, result.signRequest.id);
  return result.signRequest;
}

const VALID_BODY = {
  motivo: 'Documento actualizado con nuevas cláusulas. Se requiere nueva firma.',
  actor: 'juridico@tempoactiva.com',
};

// =================================================================
// Auth (4 tests)
// =================================================================

test('POST /revoke: sin X-Admin-API-Key → 401', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .send(VALID_BODY);
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('POST /revoke: X-Admin-API-Key incorrecto → 401', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set('X-Admin-API-Key', 'wrong-admin-key')
    .send(VALID_BODY);
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('POST /revoke: X-Internal-API-Key (header equivocado) → 401', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(INTERNAL_HEADERS)
    .send(VALID_BODY);
  // Aunque la internal key sea válida, el endpoint espera admin key.
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('POST /revoke: X-Internal-API-Key con valor de admin (otro header) → 401', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  // Mismo valor numérico, distinto header
  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set('X-Internal-API-Key', TEST_ADMIN_API_KEY)
    .send(VALID_BODY);
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

// =================================================================
// Validación de body (zod) — 11 tests
// =================================================================

test('POST /revoke: sin motivo → 400 INVALID_REQUEST_BODY', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send({ actor: 'foo' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
  assert.ok(res.body.error.details.issues.some(i => i.path.includes('motivo')));
});

test('POST /revoke: motivo 9 chars → 400 (min 10)', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send({ motivo: 'a'.repeat(9), actor: 'foo' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /revoke: motivo 10 chars válidos → 200', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send({ motivo: 'a'.repeat(10), actor: 'foo' });
  assert.equal(res.status, 200);
});

test('POST /revoke: motivo 500 chars → 200', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send({ motivo: 'a'.repeat(500), actor: 'foo' });
  assert.equal(res.status, 200);
});

test('POST /revoke: motivo 501 chars → 400 (max 500)', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send({ motivo: 'a'.repeat(501), actor: 'foo' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /revoke: motivo solo espacios → 400 (refine)', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send({ motivo: '          ', actor: 'foo' });  // 10 espacios
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /revoke: sin actor → 400', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send({ motivo: 'motivo válido aquí' });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.issues.some(i => i.path.includes('actor')));
});

test('POST /revoke: actor vacío → 400', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send({ motivo: 'motivo válido aquí', actor: '' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /revoke: actor 100 chars → 200', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send({ motivo: 'motivo válido aquí', actor: 'a'.repeat(100) });
  assert.equal(res.status, 200);
});

test('POST /revoke: actor 101 chars → 400', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send({ motivo: 'motivo válido aquí', actor: 'a'.repeat(101) });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /revoke: campos extra en body → 400 (.strict)', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send({ ...VALID_BODY, foo: 'bar', extra: 123 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

// =================================================================
// Validación de :id — 3 tests
// =================================================================

test('POST /revoke: :id con formato inválido → 400', async () => {
  resetDb();
  const app = makeApp();

  const res = await request(app)
    .post('/internal/sign-requests/abc/revoke')
    .set(ADMIN_HEADERS)
    .send(VALID_BODY);
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /revoke: :id SIGN-2026-999999 (no existe) → 404', async () => {
  resetDb();
  const app = makeApp();

  const res = await request(app)
    .post('/internal/sign-requests/SIGN-2026-999999/revoke')
    .set(ADMIN_HEADERS)
    .send(VALID_BODY);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('POST /revoke: :id numérico 999999 (no existe) → 404', async () => {
  resetDb();
  const app = makeApp();

  const res = await request(app)
    .post('/internal/sign-requests/999999/revoke')
    .set(ADMIN_HEADERS)
    .send(VALID_BODY);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

// =================================================================
// Estados permitidos → 200 (6 tests, uno por cada estado del enunciado)
// =================================================================

for (const estado of ALLOWED_STATES) {
  test(`POST /revoke: estado=${estado} → 200 + REVOKED + estado_anterior=${estado}`, async () => {
    resetDb();
    const sr = createSignRequestInState(estado);
    const app = makeApp();

    const res = await request(app)
      .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
      .set(ADMIN_HEADERS)
      .send(VALID_BODY);

    assert.equal(res.status, 200, `estado ${estado} debería permitir revoke`);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.estado, 'REVOKED');
    assert.equal(res.body.estado_anterior, estado);
    assert.equal(res.body.id_solicitud, sr.id_solicitud);
    assert.equal(res.body.id_interno, sr.id);
    assert.ok(res.body.fecha_revocacion);
    assert.equal(res.body.motivo_revocacion, VALID_BODY.motivo);
    assert.equal(res.body.actor, VALID_BODY.actor);

    // Verificar columnas en BD
    const row = db.prepare(
      'SELECT estado, motivo_revocacion, fecha_revocacion FROM gh_firmas_electronicas WHERE id = ?'
    ).get(sr.id);
    assert.equal(row.estado, 'REVOKED');
    assert.equal(row.motivo_revocacion, VALID_BODY.motivo);
    assert.ok(row.fecha_revocacion);
  });
}

// =================================================================
// Estados NO permitidos → 409 REVOKE_NOT_ALLOWED (9 tests)
// =================================================================

for (const estado of FORBIDDEN_STATES) {
  test(`POST /revoke: estado=${estado} → 409 REVOKE_NOT_ALLOWED`, async () => {
    resetDb();
    const sr = createSignRequestInState(estado);
    const app = makeApp();

    const res = await request(app)
      .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
      .set(ADMIN_HEADERS)
      .send(VALID_BODY);

    assert.equal(res.status, 409,
      `estado ${estado} NO debería permitir revoke; status fue ${res.status}`);
    assert.equal(res.body.error.code, 'REVOKE_NOT_ALLOWED');
    assert.equal(res.body.error.details.current_state, estado);
    assert.ok(Array.isArray(res.body.error.details.allowed_states));
    assert.ok(res.body.error.details.allowed_states.includes('PENDING'));
    assert.ok(res.body.error.details.allowed_states.includes('DOCUMENT_VIEWED'));
  });
}

// =================================================================
// Idempotencia (2 tests)
// =================================================================

test('POST /revoke: ya REVOKED → 200 con already_revoked=true', async () => {
  resetDb();
  const sr = createSignRequestInState('REVOKED');
  // Pre-llenar fecha_revocacion y motivo_revocacion
  db.prepare(`
    UPDATE gh_firmas_electronicas
    SET fecha_revocacion = ?, motivo_revocacion = ?
    WHERE id = ?
  `).run('2026-08-19T10:00:00.000000Z', 'Primer motivo', sr.id);
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send(VALID_BODY);

  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'REVOKED');
  assert.equal(res.body.estado_anterior, 'REVOKED');
  assert.equal(res.body.already_revoked, true);
  // Devuelve los valores ORIGINALES (no los del nuevo intento)
  assert.equal(res.body.motivo_revocacion, 'Primer motivo');
  assert.equal(res.body.fecha_revocacion, '2026-08-19T10:00:00.000000Z');
});

test('POST /revoke: idempotencia — no se duplica evento REVOKED', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  // Primer revoke
  const res1 = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send(VALID_BODY);
  assert.equal(res1.status, 200);
  assert.equal(res1.body.already_revoked, undefined);

  const countAfterFirst = db.prepare(
    `SELECT COUNT(*) AS n FROM gh_firma_eventos WHERE firma_id = ? AND evento = 'REVOKED'`
  ).get(sr.id).n;
  assert.equal(countAfterFirst, 1, 'primer revoke crea 1 evento REVOKED');

  // Segundo revoke (idempotente)
  const res2 = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send({ motivo: 'SEGUNDO motivo distinto', actor: 'otro@actor.com' });
  assert.equal(res2.status, 200);
  assert.equal(res2.body.already_revoked, true);

  const countAfterSecond = db.prepare(
    `SELECT COUNT(*) AS n FROM gh_firma_eventos WHERE firma_id = ? AND evento = 'REVOKED'`
  ).get(sr.id).n;
  assert.equal(countAfterSecond, 1,
    'segundo revoke (idempotente) NO debe crear nuevo evento REVOKED');
});

// =================================================================
// Metadata del evento REVOKED (1 test)
// =================================================================

test('POST /revoke: evento REVOKED tiene metadata correcta', async () => {
  resetDb();
  const sr = createSignRequestInState('DOCUMENT_VIEWED');
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send(VALID_BODY);
  assert.equal(res.status, 200);

  const evento = db.prepare(`
    SELECT evento, id_actor, metadata, fecha_hora, ip, user_agent
    FROM gh_firma_eventos
    WHERE firma_id = ? AND evento = 'REVOKED'
  `).get(sr.id);
  assert.ok(evento, 'evento REVOKED debe existir');
  assert.equal(evento.id_actor, `admin:${VALID_BODY.actor}`);

  const meta = JSON.parse(evento.metadata);
  assert.equal(meta.motivo, VALID_BODY.motivo);
  assert.equal(meta.actor, VALID_BODY.actor);
  assert.equal(meta.estado_anterior, 'DOCUMENT_VIEWED');
  assert.ok(meta.timestamp, 'metadata debe incluir timestamp');
  assert.match(meta.timestamp, /^\d{4}-\d{2}-\d{2}T/);

  // ip y user_agent del request (pueden ser null en test)
  assert.ok('ip' in evento);
  assert.ok('user_agent' in evento);
});

// =================================================================
// Aislamiento entre requests (1 test)
// =================================================================

test('POST /revoke: aislamiento — revoke de A no afecta a B', async () => {
  resetDb();
  const srA = createSignRequestInState('PENDING');
  const srB = createSignRequestInState('DOCUMENT_VIEWED');
  const app = makeApp();

  const resA = await request(app)
    .post(`/internal/sign-requests/${srA.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send(VALID_BODY);
  assert.equal(resA.status, 200);
  assert.equal(resA.body.id_interno, srA.id);

  // B debe seguir intacto
  const rowB = db.prepare(
    'SELECT estado FROM gh_firmas_electronicas WHERE id = ?'
  ).get(srB.id);
  assert.equal(rowB.estado, 'DOCUMENT_VIEWED',
    'B no debe cambiar cuando se revoca A');

  // A debe estar REVOKED
  const rowA = db.prepare(
    'SELECT estado FROM gh_firmas_electronicas WHERE id = ?'
  ).get(srA.id);
  assert.equal(rowA.estado, 'REVOKED');
});

// =================================================================
// Audit trail ve el REVOKED (1 test)
// =================================================================

test('POST /revoke: después de revoke, GET /eventos incluye el evento REVOKED', async () => {
  resetDb();
  const sr = createSignRequestInState('DOCUMENT_VIEWED');
  const app = makeApp();

  // 1. Revoke
  const resRevoke = await request(app)
    .post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS)
    .send(VALID_BODY);
  assert.equal(resRevoke.status, 200);

  // 2. Audit
  const resAudit = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  assert.equal(resAudit.status, 200);

  // El evento REVOKED debe estar en la respuesta
  const revoked = resAudit.body.eventos.find(e => e.tipo_evento === 'REVOKED');
  assert.ok(revoked, 'evento REVOKED debe aparecer en audit trail');
  assert.equal(revoked.metadata.motivo, VALID_BODY.motivo);
  assert.equal(revoked.metadata.estado_anterior, 'DOCUMENT_VIEWED');
  // actor no debe estar filtrado (NO es secreto)
  assert.equal(revoked.metadata.actor, VALID_BODY.actor);
});
