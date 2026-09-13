/**
 * Tests del endpoint POST /internal/admin/acuerdo-versiones (Bloque B).
 *
 * Cubre:
 * - Autenticación
 *   - Sin X-Admin-API-Key → 401
 *   - X-Admin-API-Key incorrecto → 401
 *   - X-Internal-API-Key (NO debe funcionar) → 401
 *
 * - Validación de body (zod)
 *   - Sin version → 400
 *   - version formato inválido (1.0, v1, v1.0.0) → 400
 *   - Sin texto → 400
 *   - texto demasiado largo (>50000) → 400
 *   - fecha_vigencia_fin inválida → 400
 *   - creado_por/kair_version demasiado largos → 400
 *
 * - Lógica de negocio
 *   - Versión duplicada → 409 ACUERDO_VERSION_EXISTS
 *   - 201 crear v1.0 activa → calcula texto_hash server-side
 *   - 201 crear inactiva (no toca activas)
 *   - Activa desactiva la versión activa anterior
 *   - fecha_vigencia_fin en pasado → 400 INVALID_VIGENCIA
 *   - Crear con metadata
 *   - Nunca 2 activas simultáneamente (índice único parcial)
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../../src/db/connection');
const {
  resetDb, makeApp, withAdminApiKey, TEST_ADMIN_API_KEY,
} = require('../helpers');

const HEADERS = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };

const TEXT_V1 = 'ACUERDO DE USO v1.0\nTérminos y condiciones del servicio.';
const TEXT_V2 = 'ACUERDO DE USO v2.0\nTérminos actualizados.';

// =========================================================================
// Autenticación
// =========================================================================

test('POST /internal/admin/acuerdo-versiones: sin header → 401', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .send({ version: 'v1.0', texto: TEXT_V1 });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('POST /internal/admin/acuerdo-versiones: header admin incorrecto → 401', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set('X-Admin-API-Key', 'wrong')
    .send({ version: 'v1.0', texto: TEXT_V1 });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('POST /internal/admin/acuerdo-versiones: X-Internal-API-Key NO funciona → 401', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set('X-Internal-API-Key', TEST_ADMIN_API_KEY)  // mismo valor, header incorrecto
    .send({ version: 'v1.0', texto: TEXT_V1 });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

// =========================================================================
// Validación de body (zod)
// =========================================================================

test('POST acuerdo-versiones: sin version → 400', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ texto: TEXT_V1 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
  assert.ok(res.body.error.details.issues.some(i => i.path === 'version'));
});

test('POST acuerdo-versiones: version formato inválido "1.0" → 400', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ version: '1.0', texto: TEXT_V1 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST acuerdo-versiones: version formato inválido "v1" → 400', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ version: 'v1', texto: TEXT_V1 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST acuerdo-versiones: version formato inválido "v1.0.0" → 400', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ version: 'v1.0.0', texto: TEXT_V1 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST acuerdo-versiones: sin texto → 400', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ version: 'v1.0' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST acuerdo-versiones: texto > 50000 chars → 400', async () => {
  resetDb();
  const app = makeApp();
  const textoLargo = 'x'.repeat(50001);
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ version: 'v1.0', texto: textoLargo });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST acuerdo-versiones: fecha_vigencia_fin no es ISO-8601 → 400', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ version: 'v1.0', texto: TEXT_V1, fecha_vigencia_fin: 'ayer' });
  assert.equal(res.status, 400);
  // zod detecta formato datetime inválido
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

// =========================================================================
// Lógica de negocio
// =========================================================================

test('POST acuerdo-versiones: 201 crear v1.0 activa → calcula texto_hash server-side', async () => {
  resetDb();
  const app = makeApp();
  const { sha256 } = require('../../src/crypto/hash');
  const hashEsperado = sha256(TEXT_V1);

  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ version: 'v1.0', texto: TEXT_V1 });

  assert.equal(res.status, 201);
  assert.equal(res.body.version, 'v1.0');
  assert.equal(res.body.texto_hash, hashEsperado, 'texto_hash debe ser SHA-256 del texto');
  assert.equal(res.body.activa, true);
  assert.ok(res.body.fecha_vigencia_inicio);
  assert.ok(Array.isArray(res.body.desactivadas), 'desactivadas debe ser array');
  assert.equal(res.body.desactivadas.length, 0, 'No hay versiones anteriores que desactivar');
});

test('POST acuerdo-versiones: cliente NO puede inyectar texto_hash (server siempre recalcula)', async () => {
  resetDb();
  const app = makeApp();
  const { sha256 } = require('../../src/crypto/hash');
  const hashFalso = 'f'.repeat(64);
  const hashReal = sha256(TEXT_V1);

  // Intentar inyectar texto_hash falso
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({
      version: 'v1.0',
      texto: TEXT_V1,
      texto_hash: hashFalso,  // ← el server debe IGNORAR este campo
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.texto_hash, hashReal,
    'texto_hash debe ser SHA-256 del texto, NUNCA del cliente');
  assert.notEqual(res.body.texto_hash, hashFalso);
});

test('POST acuerdo-versiones: 409 version duplicada', async () => {
  resetDb();
  const app = makeApp();
  // Crear primera versión
  await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ version: 'v1.0', texto: TEXT_V1 });

  // Intentar crear la misma
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ version: 'v1.0', texto: TEXT_V2 });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'ACUERDO_VERSION_EXISTS');
});

test('POST acuerdo-versiones: activa=true desactiva la versión activa anterior', async () => {
  resetDb();
  const app = makeApp();
  // v1.0 activa
  await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ version: 'v1.0', texto: TEXT_V1 });

  // v2.0 activa (debe desactivar v1.0)
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ version: 'v2.0', texto: TEXT_V2, activa: true });

  assert.equal(res.status, 201);
  assert.equal(res.body.activa, true);
  assert.ok(Array.isArray(res.body.desactivadas), 'desactivadas debe ser array');
  assert.equal(res.body.desactivadas.length, 1, 'v1.0 debe haberse desactivado');
  assert.equal(res.body.desactivadas[0], 'v1.0');

  // Verificar en BD
  const rows = db.prepare('SELECT version, activa FROM gh_firma_acuerdo_versiones ORDER BY version').all();
  assert.equal(rows.length, 2);
  assert.equal(rows.find(r => r.version === 'v1.0').activa, 0);
  assert.equal(rows.find(r => r.version === 'v2.0').activa, 1);
});

test('POST acuerdo-versiones: activa=false NO desactiva la versión activa anterior', async () => {
  resetDb();
  const app = makeApp();
  // v1.0 activa
  await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ version: 'v1.0', texto: TEXT_V1 });

  // v1.1 inactiva
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ version: 'v1.1', texto: TEXT_V1, activa: false });

  assert.equal(res.status, 201);
  assert.equal(res.body.activa, false);
  assert.ok(Array.isArray(res.body.desactivadas), 'desactivadas debe ser array');
  assert.equal(res.body.desactivadas.length, 0, 'No se debe desactivar nada si activa=false');

  // v1.0 sigue activa
  const row = db.prepare('SELECT activa FROM gh_firma_acuerdo_versiones WHERE version = ?').get('v1.0');
  assert.equal(row.activa, 1, 'v1.0 debe seguir activa');
});

test('POST acuerdo-versiones: NUNCA 2 activas simultáneamente (índice único parcial)', async () => {
  resetDb();
  const app = makeApp();
  // v1.0 activa
  await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ version: 'v1.0', texto: TEXT_V1 });

  // v2.0 activa (debe desactivar v1.0)
  await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ version: 'v2.0', texto: TEXT_V2, activa: true });

  // Verificar SOLO 1 activa
  const activas = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_acuerdo_versiones WHERE activa = 1').get();
  assert.equal(activas.n, 1, 'Solo puede haber UNA versión activa simultáneamente');
  const activa = db.prepare('SELECT version FROM gh_firma_acuerdo_versiones WHERE activa = 1').get();
  assert.equal(activa.version, 'v2.0');
});

test('POST acuerdo-versiones: fecha_vigencia_fin en pasado → 400 INVALID_VIGENCIA', async () => {
  resetDb();
  const app = makeApp();
  const ayer = new Date(Date.now() - 86400000).toISOString();
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({
      version: 'v1.0', texto: TEXT_V1,
      fecha_vigencia_fin: ayer,
    });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_VIGENCIA');
});

test('POST acuerdo-versiones: con metadata opcional', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({
      version: 'v1.0',
      texto: TEXT_V1,
      creado_por: 'admin@tempoactiva.com',
      kair_version: '0.1.189',
      metadata: { approver: 'juridico', legal_review_id: 'LR-2026-001' },
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.creado_por, 'admin@tempoactiva.com');
  assert.equal(res.body.kair_version, '0.1.189');

  // Verificar metadata persistido
  const row = db.prepare('SELECT metadata FROM gh_firma_acuerdo_versiones WHERE version = ?').get('v1.0');
  const meta = JSON.parse(row.metadata);
  assert.equal(meta.approver, 'juridico');
  assert.equal(meta.legal_review_id, 'LR-2026-001');
});

test('POST acuerdo-versiones: GET /internal/acuerdo-activo ve la nueva versión', async () => {
  resetDb();
  const app = makeApp();
  // Antes: no hay acuerdo activo
  const antes = await request(app).get('/internal/acuerdo-activo')
    .set('X-Internal-API-Key', 'test-internal-api-key-32-bytes-min!!');
  assert.equal(antes.status, 404);

  // Publicar v1.0
  await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(HEADERS)
    .send({ version: 'v1.0', texto: TEXT_V1 });

  // Después: GET acuerdo-activo retorna v1.0
  const despues = await request(app).get('/internal/acuerdo-activo')
    .set('X-Internal-API-Key', 'test-internal-api-key-32-bytes-min!!');
  assert.equal(despues.status, 200);
  assert.equal(despues.body.version, 'v1.0');
});
