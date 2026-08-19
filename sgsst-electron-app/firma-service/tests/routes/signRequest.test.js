/**
 * Tests del endpoint POST /internal/sign-requests + GET /:id + GET lista.
 *
 * Cubre:
 * - POST /internal/sign-requests
 *   - PDF válido → 201 + token + url_publica
 *   - Token NUNCA en BD (solo token_hash)
 *   - document_hash se valida
 *   - PDF inválido (no magic bytes) → 400
 *   - Falta archivo → 400
 *   - Body inválido → 400
 *   - API key incorrecta → 401
 *   - Evento CREATED registrado
 *
 * - GET /internal/sign-requests/:id
 *   - Por id_solicitud → 200
 *   - Por id interno → 200
 *   - Inexistente → 404
 *
 * - GET /internal/sign-requests
 *   - Lista vacía → 200 con total=0
 *   - Lista con filtros → 200
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const { sha256 } = require('../../src/crypto/hash');
const config = require('../../src/config');
const db = require('../../src/db/connection');
const {
  resetDb, seedActiveAgreement, makeApp, TEST_API_KEY,
} = require('../helpers');
const storage = require('../../src/services/storage');

const HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };

// Crea un PDF mínimo válido (con magic bytes %PDF-)
function makePdf() {
  return Buffer.concat([
    Buffer.from('%PDF-1.4\n'),
    Buffer.from('1 0 obj\n<< /Type /Catalog >>\nendobj\n'),
    Buffer.from('trailer\n<< /Root 1 0 R >>\n%%EOF\n'),
  ]);
}

function sha256Hex(buffer) {
  return sha256(buffer);
}

/**
 * Construye metadata con el hash y la versión del Acuerdo sembrado.
 * Cada test que crea un sign request debe llamar antes a seedActiveAgreement()
 * para que esta función tenga un Acuerdo del cual tomar agreement_hash/agreement_version.
 */
function buildMetadata(acuerdo, overrides = {}) {
  return {
    id_documento: 'doc-001',
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    tipo_firma: 'presencial',
    agreement_hash: acuerdo.texto_hash,
    agreement_version: acuerdo.version,
    document_hash: null, // se calcula
    version_kair: '0.1.189',
    ...overrides,
  };
}

// =================================================================
// POST /internal/sign-requests
// =================================================================

test('POST /internal/sign-requests: PDF válido → 201 + token + url', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  assert.equal(res.status, 201);
  assert.ok(res.body.id_solicitud);
  assert.match(res.body.id_solicitud, /^SIGN-\d{4}-\d{6}$/);
  assert.ok(res.body.id_interno);
  assert.equal(res.body.estado, 'PENDING');
  assert.equal(res.body.tipo_firma, 'presencial');
  assert.equal(res.body.document_hash_original, meta.document_hash);
  assert.equal(res.body.agreement_hash, meta.agreement_hash);
  assert.ok(res.body.token);
  assert.equal(res.body.token.length, 32);
  // Validar contra config.publicUrl (no hardcoded) para que el test sea
  // robusto a diferentes entornos (3001, 3737, prod, etc.).
  assert.equal(res.body.url_publica, `${config.publicUrl}/s/${res.body.token}`);
  assert.equal(res.body.qr_payload, res.body.url_publica);
  assert.ok(res.body.fecha_creacion);
  assert.ok(res.body.fecha_expiracion);
});

test('POST /internal/sign-requests: token NO se almacena en plano en BD', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  const token = res.body.token;

  // Verificar que el token_hash en BD es SHA-256(token), no el token
  const row = db.prepare('SELECT token_hash FROM gh_firmas_electronicas WHERE id = ?').get(res.body.id_interno);
  const expected_hash = sha256(token);
  assert.equal(row.token_hash, expected_hash);
  assert.notEqual(row.token_hash, token, 'Token NO debe quedar en plano en BD');
});

test('POST /internal/sign-requests: PDF guardado en storage', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  const row = db.prepare('SELECT pdf_original_path FROM gh_firmas_electronicas WHERE id = ?').get(res.body.id_interno);
  assert.ok(row.pdf_original_path);
  assert.ok(storage.exists(row.pdf_original_path), 'PDF debe existir en storage');

  // El contenido guardado debe coincidir
  const contenido = storage.readPdf(row.pdf_original_path);
  assert.ok(contenido.slice(0, 5).equals(Buffer.from('%PDF-')));
});

test('POST /internal/sign-requests: evento CREATED registrado', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  const eventos = db.prepare(`
    SELECT evento, id_actor, metadata
    FROM gh_firma_eventos
    WHERE firma_id = ?
    ORDER BY id
  `).all(res.body.id_interno);

  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].evento, 'CREATED');
  assert.equal(eventos[0].id_actor, 'rh:system');
  const meta_evento = JSON.parse(eventos[0].metadata);
  assert.equal(meta_evento.id_documento, meta.id_documento);
});

test('POST /internal/sign-requests: estado inicial PENDING + sesión creada', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  const row = db.prepare('SELECT estado, sesion_id FROM gh_firmas_electronicas WHERE id = ?').get(res.body.id_interno);
  assert.equal(row.estado, 'PENDING');
  assert.ok(row.sesion_id);

  const sesion = db.prepare('SELECT estado_sesion FROM gh_firma_sesiones WHERE firma_id = ?').get(res.body.id_interno);
  assert.equal(sesion.estado_sesion, 'PENDING');
});

test('POST /internal/sign-requests: hash mismatch → 422', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo, { document_hash: 'f'.repeat(64) }); // hash incorrecto

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'DOCUMENT_HASH_MISMATCH');
  assert.equal(res.body.error.details.declared, 'f'.repeat(64));
  assert.match(res.body.error.details.calculated, /^[0-9a-f]{64}$/);
});

test('POST /internal/sign-requests: PDF sin magic bytes → 400', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = Buffer.from('NO ES UN PDF'); // no empieza con %PDF-
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'fake.pdf');

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /internal/sign-requests: sin archivo → 400', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = 'a'.repeat(64);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta));
  // No attach

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /internal/sign-requests: body inválido (sin agreement_hash) → 400', async () => {
  resetDb();
  const app = makeApp();
  const pdf = makePdf();
  const meta = { id_documento: 'd', id_trabajador: 't', id_empresa: 'e', tipo_firma: 'presencial' };
  // Falta agreement_hash, document_hash, version_kair

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /internal/sign-requests: API key incorrecta → 401', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set('X-Internal-API-Key', 'wrong-key')
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('POST /internal/sign-requests: tipo_firma=remoto tiene TTL 72h', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo, { tipo_firma: 'remoto' });
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 201);
  const fecha_creacion = new Date(res.body.fecha_creacion);
  const fecha_expiracion = new Date(res.body.fecha_expiracion);
  const horas = (fecha_expiracion - fecha_creacion) / 3600000;
  assert.equal(horas, 72);
});

// =================================================================
// GET /internal/sign-requests/:id
// =================================================================

test('GET /internal/sign-requests/:id por id_solicitud → 200', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const r1 = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  const r2 = await request(app).get(`/internal/sign-requests/${r1.body.id_solicitud}`).set(HEADERS);
  assert.equal(r2.status, 200);
  assert.equal(r2.body.id_solicitud, r1.body.id_solicitud);
  assert.equal(r2.body.estado, 'PENDING');
});

test('GET /internal/sign-requests/:id por id interno → 200', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const r1 = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  const r2 = await request(app).get(`/internal/sign-requests/${r1.body.id_interno}`).set(HEADERS);
  assert.equal(r2.status, 200);
});

test('GET /internal/sign-requests/:id inexistente → 404', async () => {
  resetDb();
  const app = makeApp();
  const r = await request(app).get('/internal/sign-requests/SIGN-2026-999999').set(HEADERS);
  assert.equal(r.status, 404);
});

// =================================================================
// GET /internal/sign-requests
// =================================================================

test('GET /internal/sign-requests lista vacía → 200 total=0', async () => {
  resetDb();
  const app = makeApp();
  const r = await request(app).get('/internal/sign-requests').set(HEADERS);
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 0);
  assert.equal(r.body.items.length, 0);
});

test('GET /internal/sign-requests lista con filtros', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  // Crear 2 solicitudes
  for (let i = 0; i < 2; i++) {
    const pdf = makePdf();
    const meta = buildMetadata(acuerdo, {
      id_documento: `doc-${i}`,
      document_hash: sha256Hex(pdf),
    });
    await request(app)
      .post('/internal/sign-requests')
      .set(HEADERS)
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, `x${i}.pdf`);
  }

  // Listar todas
  const r1 = await request(app).get('/internal/sign-requests').set(HEADERS);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.total, 2);
  assert.equal(r1.body.items.length, 2);

  // Filtrar por id_documento
  const r2 = await request(app).get('/internal/sign-requests?id_documento=doc-0').set(HEADERS);
  assert.equal(r2.status, 200);
  assert.equal(r2.body.total, 1);
  assert.equal(r2.body.items[0].id_documento, 'doc-0');
});

// =================================================================
// Bloque A — agreement_version obligatorio
// =================================================================

test('POST /internal/sign-requests: sin agreement_version → 400 (zod)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  // Construir metadata SIN agreement_version
  const meta = buildMetadata(acuerdo);
  delete meta.agreement_version;
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
  assert.ok(res.body.error.details.issues.some(i => i.path.includes('agreement_version')),
    'El issue debe mencionar agreement_version');
});

test('POST /internal/sign-requests: agreement_version inexistente → 422 ACUERDO_INVALIDO', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo, { agreement_version: 'v999.0' });
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'ACUERDO_INVALIDO');
  assert.equal(res.body.error.details.reason, 'version_not_found');
  assert.equal(res.body.error.details.agreement_version, 'v999.0');
});

test('POST /internal/sign-requests: agreement_version inactiva → 422 ACUERDO_INVALIDO', async () => {
  resetDb();
  const acuerdoV1 = seedActiveAgreement({ version: 'v1.0', texto: 'texto v1' });
  // Crear v2.0 y marcarla activa (auto-desactiva v1.0)
  const agreementService = require('../../src/services/agreement');
  agreementService.createVersion({ version: 'v2.0', texto: 'texto v2', activa: true });
  const app = makeApp();
  const pdf = makePdf();
  // Intentar firmar con v1.0 (que ya no es activa)
  const meta = buildMetadata(acuerdoV1); // acuerdoV1 es v1.0
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'ACUERDO_INVALIDO');
  assert.equal(res.body.error.details.reason, 'inactive');
  assert.equal(res.body.error.details.agreement_version, 'v1.0');
  assert.equal(res.body.error.details.active_version, 'v2.0');
});

test('POST /internal/sign-requests: agreement_hash ≠ texto_hash → 422 ACUERDO_INVALIDO', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  // Hash falso (correcto formato, valor incorrecto)
  const meta = buildMetadata(acuerdo, { agreement_hash: 'f'.repeat(64) });
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'ACUERDO_INVALIDO');
  assert.equal(res.body.error.details.reason, 'hash_mismatch');
  assert.equal(res.body.error.details.agreement_version, acuerdo.version);
});

test('POST /internal/sign-requests: sin Acuerdo activo → 422 ACUERDO_INVALIDO', async () => {
  resetDb();
  // NO sembrar Acuerdo
  const app = makeApp();
  const pdf = makePdf();
  const meta = {
    id_documento: 'd',
    id_trabajador: 't',
    id_empresa: 'e',
    tipo_firma: 'presencial',
    agreement_version: 'v1.0',
    agreement_hash: 'a'.repeat(64),
    document_hash: sha256Hex(pdf),
    version_kair: '0.1.189',
  };

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'ACUERDO_INVALIDO');
  assert.equal(res.body.error.details.reason, 'version_not_found');
});

test('POST /internal/sign-requests: persiste agreement_version en BD', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 201);
  const row = db.prepare('SELECT agreement_version, agreement_hash FROM gh_firmas_electronicas WHERE id = ?').get(res.body.id_interno);
  assert.equal(row.agreement_version, acuerdo.version);
  assert.equal(row.agreement_hash, acuerdo.texto_hash);
});

test('POST /internal/sign-requests: evento CREATED incluye agreement_version en metadata', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  const eventos = db.prepare(`
    SELECT evento, metadata FROM gh_firma_eventos
    WHERE firma_id = ? ORDER BY id
  `).all(res.body.id_interno);
  assert.equal(eventos.length, 1);
  const metaEvento = JSON.parse(eventos[0].metadata);
  assert.equal(metaEvento.agreement_version, acuerdo.version);
});

test('POST /internal/sign-requests: Acuerdo vencido (fecha_vigencia_fin < now) → 422', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  // Forzar Acuerdo vencido (ayer)
  const ayer = new Date(Date.now() - 86400000).toISOString();
  db.prepare('UPDATE gh_firma_acuerdo_versiones SET fecha_vigencia_fin = ?')
    .run(ayer);
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'x.pdf');

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'ACUERDO_INVALIDO');
  // El servicio detecta que NO hay activa vigente → reason no_active_version
  assert.equal(res.body.error.details.reason, 'no_active_version');
});

// =================================================================
// I-002 end-to-end: tipo_identificacion se propaga del body al service
// a la BD y a las responses (POST 201 + GET /:id).
//
// Cierra el gap detectado por Agentes B/C/E: el route POST no propagaba
// `tipo_identificacion` desde `meta` validado por zod al service, por lo
// que el valor llegaba como `undefined` → `null` en BD silencioso.
//
// Con este fix, el flujo end-to-end es:
//   Zod valida el campo → ✅
//   Route lo lee de meta y lo pasa al service → ✅ (este fix)
//   Service valida + INSERT → ✅
//   Service retorna el valor en getById → ✅
//   POST 201 response incluye el valor → ✅ (este fix)
//   GET /:id response incluye el valor → ✅ (este fix)
// =================================================================

test('I-002 e2e: POST con tipo_identificacion=CONTRATO → 201 + persiste + GET /:id retorna', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);
  meta.tipo_identificacion = 'CONTRATO';

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  assert.equal(res.status, 201);
  // 1. La respuesta POST confirma el valor persistido
  assert.equal(res.body.tipo_identificacion, 'CONTRATO',
    'POST 201 debe incluir tipo_identificacion en la respuesta');

  // 2. La fila en BD tiene la columna poblada (no quedó undefined → null)
  const fila = db.prepare(
    "SELECT tipo_identificacion FROM gh_firmas_electronicas WHERE id_solicitud = ?"
  ).get(res.body.id_solicitud);
  assert.equal(fila.tipo_identificacion, 'CONTRATO',
    'la fila en BD debe tener tipo_identificacion=CONTRATO (gap B/C/E cerrado)');

  // 3. GET /:id retorna el valor para que el cliente lo lea
  const get = await request(app)
    .get(`/internal/sign-requests/${res.body.id_solicitud}`)
    .set(HEADERS);
  assert.equal(get.status, 200);
  assert.equal(get.body.tipo_identificacion, 'CONTRATO',
    'GET /:id debe incluir tipo_identificacion en la respuesta');
});

test('I-002 e2e: POST sin tipo_identificacion → 201 + null (backward compat legacy pre-007)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);
  // tipo_identificacion NO se envía (sign request legacy pre-007)

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'doc.pdf');

  assert.equal(res.status, 201);
  assert.equal(res.body.tipo_identificacion, null,
    'POST 201 debe incluir tipo_identificacion=null cuando no se envía');

  const fila = db.prepare(
    "SELECT tipo_identificacion FROM gh_firmas_electronicas WHERE id_solicitud = ?"
  ).get(res.body.id_solicitud);
  assert.equal(fila.tipo_identificacion, null,
    'BD debe tener tipo_identificacion=null para sign requests legacy');
});

test('I-002 e2e: POST con tipo_identificacion inválido → 400 INVALID_REQUEST_BODY (zod)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256Hex(pdf);
  meta.tipo_identificacion = 'NO_ES_VALIDO';  // no está en TIPOS_IDENTIFICACION

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'doc.pdf');

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
  // No se crea fila en BD
  const fila = db.prepare("SELECT COUNT(*) AS n FROM gh_firmas_electronicas").get();
  assert.equal(fila.n, 0, 'ningún sign request debe haberse creado');
});
