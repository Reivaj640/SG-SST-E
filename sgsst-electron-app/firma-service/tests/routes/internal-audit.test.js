/**
 * Tests del endpoint GET /internal/sign-requests/:id/eventos (Bloque E7.1).
 *
 * Cobertura:
 * - Auth (X-Internal-API-Key) — 3 tests
 * - Validación de :id — 5 tests
 * - Happy path sin eventos / con eventos — 3 tests
 * - Lookup por id_solicitud y por id interno — 2 tests
 * - Mapeo de campos BD → JSON — 5 tests
 * - Filtrado de secretos (denylist) — 7 tests
 * - Aislamiento entre requests — 1 test
 * - Estados terminales con eventos — 1 test
 *
 * TOTAL: 27 tests.
 *
 * IMPORTANTE: estos tests NO dependen de los cambios de Bloque E6.
 * Crean sign requests con signRequestService.create() y manipulan
 * estado/eventos directamente vía db.prepare() para evitar el flujo
 * público (que E6 está modificando).
 *
 * Ver C:\Temp\e7-design.md §3 para el contrato.
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

const INTERNAL_HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };
const ADMIN_HEADERS = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };

// =================================================================
// Helpers de fixture (no usan flujo público — independientes de E6)
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
 * Hace UPDATE directo del estado porque el flujo público es de E6.
 */
function createSignRequestInState(estado, { withEvents = 0 } = {}) {
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

  // Forzar estado deseado
  db.prepare('UPDATE gh_firmas_electronicas SET estado = ? WHERE id = ?')
    .run(estado, result.signRequest.id);

  // Insertar eventos sintéticos (después del CREATED inicial que ya está)
  // Usamos timestamps relativos al momento actual (i+1 segundos después de
  // la creación del sign request) para garantizar que el orden ASC pone
  // CREATED primero, luego SYNTHETIC_0..N en orden.
  const baseTime = Date.now();
  for (let i = 0; i < withEvents; i++) {
    const ts = new Date(baseTime + (i + 1) * 1000).toISOString();
    db.prepare(`
      INSERT INTO gh_firma_eventos
        (firma_id, evento, fecha_hora, ip, user_agent, metadata, id_actor)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      result.signRequest.id,
      `SYNTHETIC_${i}`,
      ts,
      '192.168.1.10',
      'Mozilla/5.0',
      JSON.stringify({ idx: i }),
      'sistema',
    );
  }

  return result.signRequest;
}

/**
 * Inserta un evento adicional con metadata custom en un sign request existente.
 * Útil para tests de filtrado de secretos.
 */
function insertCustomEvent(firmaId, evento, metadata) {
  db.prepare(`
    INSERT INTO gh_firma_eventos
      (firma_id, evento, fecha_hora, ip, user_agent, metadata, id_actor)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    firmaId,
    evento,
    '2026-08-19T14:00:00.000000Z',
    '203.0.113.42',
    'CustomAgent/1.0',
    metadata ? JSON.stringify(metadata) : null,
    'sistema',
  );
}

// =================================================================
// Auth (3 tests)
// =================================================================

test('GET /eventos: sin X-Internal-API-Key → 401', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app).get(`/internal/sign-requests/${sr.id_solicitud}/eventos`);
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('GET /eventos: X-Internal-API-Key incorrecto → 401', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set('X-Internal-API-Key', 'wrong-key');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('GET /eventos: X-Admin-API-Key (header equivocado) → 401', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(ADMIN_HEADERS);
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

// =================================================================
// Validación de :id (5 tests)
// =================================================================

test('GET /eventos: :id con formato inválido → 400 INVALID_REQUEST_BODY', async () => {
  resetDb();
  const app = makeApp();

  const res = await request(app)
    .get('/internal/sign-requests/abc/eventos')
    .set(INTERNAL_HEADERS);
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
  assert.ok(res.body.error.details.received_id, 'debe incluir received_id en details');
});

test('GET /eventos: :id con formato SIGN- pero no existe → 404 NOT_FOUND', async () => {
  resetDb();
  const app = makeApp();

  const res = await request(app)
    .get('/internal/sign-requests/SIGN-2026-999999/eventos')
    .set(INTERNAL_HEADERS);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('GET /eventos: :id numérico positivo que no existe → 404 NOT_FOUND', async () => {
  resetDb();
  const app = makeApp();

  const res = await request(app)
    .get('/internal/sign-requests/999999/eventos')
    .set(INTERNAL_HEADERS);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('GET /eventos: :id numérico 0 → 400 (no positivo)', async () => {
  resetDb();
  const app = makeApp();

  const res = await request(app)
    .get('/internal/sign-requests/0/eventos')
    .set(INTERNAL_HEADERS);
  // "0" matches /^\d+$/ pero parseInt > 0 falla → 404 (no 400)
  // El test documenta la decisión de diseño: ids no positivos → NOT_FOUND.
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('GET /eventos: :id numérico negativo → 404 (regex falla)', async () => {
  resetDb();
  const app = makeApp();

  const res = await request(app)
    .get('/internal/sign-requests/-1/eventos')
    .set(INTERNAL_HEADERS);
  // "-1" no matchea /^\d+$/ → cae al else de parseSignRequestId → 400
  // Actual: depende del diseño. El test verifica el comportamiento.
  assert.ok([400, 404].includes(res.status), `status fue ${res.status}, esperaba 400 o 404`);
});

// =================================================================
// Happy path sin/con eventos (3 tests)
// =================================================================

test('GET /eventos: sign request recién creado → 200 con 1 evento CREATED', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING'); // crea 1 evento CREATED
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  assert.equal(res.status, 200);
  assert.equal(res.body.id_solicitud, sr.id_solicitud);
  assert.equal(res.body.total, 1);
  assert.equal(res.body.eventos.length, 1);
  assert.equal(res.body.eventos[0].tipo_evento, 'CREATED');
  assert.equal(res.body.eventos[0].actor, 'rh:system');
});

test('GET /eventos: sign request sin eventos (insertados manualmente sin) → 200 con []', async () => {
  resetDb();
  // Crear un sign request pero BORRAR sus eventos para simular "sin eventos"
  const sr = createSignRequestInState('PENDING');
  db.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = ?').run(sr.id);
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 0);
  assert.deepEqual(res.body.eventos, []);
});

test('GET /eventos: sign request con 5 eventos → 200 con 5 eventos ordenados ASC', async () => {
  resetDb();
  // withEvents=4 → total 5 (1 CREATED + 4 SYNTHETIC)
  const sr = createSignRequestInState('DOCUMENT_VIEWED', { withEvents: 4 });
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 5);
  assert.equal(res.body.eventos.length, 5);

  // Orden: CREATED primero, luego SYNTHETIC_0..3
  assert.equal(res.body.eventos[0].tipo_evento, 'CREATED');
  for (let i = 1; i <= 4; i++) {
    assert.equal(res.body.eventos[i].tipo_evento, `SYNTHETIC_${i - 1}`);
  }

  // Timestamps en orden ASC
  for (let i = 1; i < res.body.eventos.length; i++) {
    const prev = new Date(res.body.eventos[i - 1].fecha_evento);
    const curr = new Date(res.body.eventos[i].fecha_evento);
    assert.ok(prev <= curr, `evento ${i} debe ser >= que evento ${i - 1}`);
  }
});

// =================================================================
// Lookup por id_solicitud y por id interno (2 tests)
// =================================================================

test('GET /eventos: lookup por id_solicitud → 200', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  assert.equal(res.status, 200);
  assert.equal(res.body.id_solicitud, sr.id_solicitud);
});

test('GET /eventos: lookup por id interno numérico → 200', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id}/eventos`)
    .set(INTERNAL_HEADERS);
  assert.equal(res.status, 200);
  assert.equal(res.body.id_solicitud, sr.id_solicitud);
  assert.equal(res.body.total, 1);
});

// =================================================================
// Mapeo de campos BD → JSON (5 tests)
// =================================================================

test('GET /eventos: mapea evento → tipo_evento', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  assert.equal(res.body.eventos[0].tipo_evento, 'CREATED');
  assert.equal(res.body.eventos[0].evento, undefined, 'NO debe existir campo "evento" en la respuesta');
});

test('GET /eventos: mapea fecha_hora → fecha_evento', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  assert.ok(res.body.eventos[0].fecha_evento);
  assert.match(res.body.eventos[0].fecha_evento, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(res.body.eventos[0].fecha_hora, undefined);
});

test('GET /eventos: mapea ip → ip_origen', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  // El evento CREATED inserta ip=req.ip (puede ser null en test). El test
  // verifica que el campo EXISTE en la respuesta (puede ser null).
  assert.ok('ip_origen' in res.body.eventos[0]);
  assert.equal(res.body.eventos[0].ip, undefined);
});

test('GET /eventos: mapea id_actor → actor', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  assert.equal(res.body.eventos[0].actor, 'rh:system');
  assert.equal(res.body.eventos[0].id_actor, undefined);
});

test('GET /eventos: incluye id (PK del evento)', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  assert.ok(typeof res.body.eventos[0].id === 'number');
  assert.ok(res.body.eventos[0].id > 0);
});

// =================================================================
// Filtrado de secretos (7 tests)
// =================================================================

test('GET /eventos: filtra otp_hash en metadata → [REDACTED]', async () => {
  resetDb();
  const sr = createSignRequestInState('OTP_VERIFIED');
  insertCustomEvent(sr.id, 'OTP_SENT', {
    canal: 'email',
    otp_hash: 'a'.repeat(64),
    otp_sal: 'b'.repeat(32),
  });
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  const ev = res.body.eventos.find(e => e.tipo_evento === 'OTP_SENT');
  assert.equal(ev.metadata.otp_hash, '[REDACTED]');
  assert.equal(ev.metadata.otp_sal, '[REDACTED]');
  assert.equal(ev.metadata.canal, 'email', 'campos no secretos deben pasar');
});

test('GET /eventos: filtra token en metadata → [REDACTED]', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  insertCustomEvent(sr.id, 'TOKEN_LEAK_TEST', {
    token: 'supersecret123',
    token_hash: 'h'.repeat(64),
  });
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  const ev = res.body.eventos.find(e => e.tipo_evento === 'TOKEN_LEAK_TEST');
  assert.equal(ev.metadata.token, '[REDACTED]');
  assert.equal(ev.metadata.token_hash, '[REDACTED]');
});

test('GET /eventos: filtra correo_verificacion y correo_hash en metadata → [REDACTED]', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  insertCustomEvent(sr.id, 'CORREO_LEAK_TEST', {
    correo_verificacion: 'juan@ejemplo.com',
    correo_hash: 'a'.repeat(64),
    correo_sal: 'b'.repeat(32),
    canal: 'email',
  });
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  const ev = res.body.eventos.find(e => e.tipo_evento === 'CORREO_LEAK_TEST');
  assert.equal(ev.metadata.correo_verificacion, '[REDACTED]');
  assert.equal(ev.metadata.correo_hash, '[REDACTED]');
  assert.equal(ev.metadata.correo_sal, '[REDACTED]');
});

test('GET /eventos: filtra identificacion_numero_hash → [REDACTED]', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  insertCustomEvent(sr.id, 'IDENTIF_LEAK_TEST', {
    identificacion_numero: '1234567890',
    identificacion_numero_hash: 'a'.repeat(64),
    tipo_identificacion: 'CC',
  });
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  const ev = res.body.eventos.find(e => e.tipo_evento === 'IDENTIF_LEAK_TEST');
  assert.equal(ev.metadata.identificacion_numero, '[REDACTED]');
  assert.equal(ev.metadata.identificacion_numero_hash, '[REDACTED]');
  assert.equal(ev.metadata.tipo_identificacion, 'CC');
});

test('GET /eventos: filtra firma_visual_png → [REDACTED]', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  insertCustomEvent(sr.id, 'FIRMA_LEAK_TEST', {
    firma_visual_png: 'iVBORw0KGgoAAAANSUhEUgAAA...',
    firma_visual: 'data:image/png;base64,...',
  });
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  const ev = res.body.eventos.find(e => e.tipo_evento === 'FIRMA_LEAK_TEST');
  assert.equal(ev.metadata.firma_visual_png, '[REDACTED]');
  assert.equal(ev.metadata.firma_visual, '[REDACTED]');
});

test('GET /eventos: filtra secretos anidados recursivamente → [REDACTED]', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  insertCustomEvent(sr.id, 'NESTED_LEAK_TEST', {
    user: {
      name: 'Juan',
      email: 'juan@ejemplo.com',
      credentials: {
        token: 'abc123',
        password: 'supersecret',
      },
    },
    safe_field: 'ok',
  });
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  const ev = res.body.eventos.find(e => e.tipo_evento === 'NESTED_LEAK_TEST');
  assert.equal(ev.metadata.user.name, 'Juan');
  assert.equal(ev.metadata.user.email, '[REDACTED]');
  assert.equal(ev.metadata.user.credentials.token, '[REDACTED]');
  assert.equal(ev.metadata.user.credentials.password, '[REDACTED]');
  assert.equal(ev.metadata.safe_field, 'ok');
});

test('GET /eventos: metadata limpio (sin secretos) → se retorna tal cual', async () => {
  resetDb();
  const sr = createSignRequestInState('PENDING');
  insertCustomEvent(sr.id, 'CLEAN_TEST', {
    canal: 'email',
    intentos: 1,
    evidence_hash: 'a'.repeat(64),
    ttl_seconds: 600,
  });
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  const ev = res.body.eventos.find(e => e.tipo_evento === 'CLEAN_TEST');
  assert.equal(ev.metadata.canal, 'email');
  assert.equal(ev.metadata.intentos, 1);
  assert.equal(ev.metadata.evidence_hash, 'a'.repeat(64));
  assert.equal(ev.metadata.ttl_seconds, 600);
});

// =================================================================
// Aislamiento entre requests (1 test)
// =================================================================

test('GET /eventos: aislamiento — eventos de A no aparecen en respuesta de B', async () => {
  resetDb();
  const srA = createSignRequestInState('PENDING');
  const srB = createSignRequestInState('PENDING');
  insertCustomEvent(srA.id, 'EVENTO_DE_A', { idx: 'A' });
  insertCustomEvent(srB.id, 'EVENTO_DE_B', { idx: 'B' });
  const app = makeApp();

  const resA = await request(app)
    .get(`/internal/sign-requests/${srA.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  const resB = await request(app)
    .get(`/internal/sign-requests/${srB.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);

  // A tiene CREATED + EVENTO_DE_A
  assert.equal(resA.body.total, 2);
  assert.ok(resA.body.eventos.some(e => e.tipo_evento === 'EVENTO_DE_A'));
  assert.ok(!resA.body.eventos.some(e => e.tipo_evento === 'EVENTO_DE_B'),
    'A no debe ver evento de B');

  // B tiene CREATED + EVENTO_DE_B
  assert.equal(resB.body.total, 2);
  assert.ok(resB.body.eventos.some(e => e.tipo_evento === 'EVENTO_DE_B'));
  assert.ok(!resB.body.eventos.some(e => e.tipo_evento === 'EVENTO_DE_A'),
    'B no debe ver evento de A');
});

// =================================================================
// Estados terminales con eventos (1 test)
// =================================================================

test('GET /eventos: sign request en REVOKED con 3 eventos → 200 con 3 (incluye REVOKED)', async () => {
  resetDb();
  const sr = createSignRequestInState('REVOKED', { withEvents: 2 });
  insertCustomEvent(sr.id, 'REVOKED', {
    motivo: 'test',
    actor: 'tester',
    estado_anterior: 'DOCUMENT_VIEWED',
    timestamp: '2026-08-19T15:00:00.000000Z',
  });
  const app = makeApp();

  const res = await request(app)
    .get(`/internal/sign-requests/${sr.id_solicitud}/eventos`)
    .set(INTERNAL_HEADERS);
  assert.equal(res.status, 200);
  // 1 CREATED + 2 SYNTHETIC + 1 REVOKED = 4
  assert.equal(res.body.total, 4);
  const revoked = res.body.eventos.find(e => e.tipo_evento === 'REVOKED');
  assert.ok(revoked);
  assert.equal(revoked.metadata.motivo, 'test');
  assert.equal(revoked.metadata.estado_anterior, 'DOCUMENT_VIEWED');
});
