/**
 * Tests del endpoint GET /internal/acuerdo-activo.
 *
 * Casos cubiertos:
 * - Sin API key → 401
 * - Sin versión activa → 404 ACUERDO_NOT_FOUND
 * - Con versión activa → 200 con la versión
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDb, seedActiveAgreement, makeApp, withApiKey } = require('../helpers');

test('GET /internal/acuerdo-activo sin API key → 401', async () => {
  resetDb();
  const app = makeApp();
  const res = await require('supertest')(app).get('/internal/acuerdo-activo');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('GET /internal/acuerdo-activo sin Acuerdo activo → 404', async () => {
  resetDb();
  // No seed: no hay Acuerdo activo
  const app = makeApp();
  const res = await require('supertest')(app)
    .get('/internal/acuerdo-activo')
    .set('X-Internal-API-Key', 'test-internal-api-key-32-bytes-min!!');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'ACUERDO_NOT_FOUND');
});

test('GET /internal/acuerdo-activo con Acuerdo activo → 200', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const res = await require('supertest')(app)
    .get('/internal/acuerdo-activo')
    .set('X-Internal-API-Key', 'test-internal-api-key-32-bytes-min!!');
  assert.equal(res.status, 200);
  assert.equal(res.body.version, acuerdo.version);
  assert.equal(res.body.texto, acuerdo.texto);
  assert.equal(res.body.texto_hash, acuerdo.texto_hash);
  assert.equal(res.body.activa, true);
  assert.ok(res.body.fecha_vigencia_inicio);
});

test('GET /internal/acuerdo-activo con múltiples versiones → solo la activa', async () => {
  resetDb();
  // Crear v1.0, luego v2.0 como activa
  const agreementService = require('../../src/services/agreement');
  agreementService.createVersion({
    version: 'v1.0', texto: 'texto v1', activa: false,
  });
  agreementService.createVersion({
    version: 'v2.0', texto: 'texto v2', activa: true,
  });

  const app = makeApp();
  const res = await require('supertest')(app)
    .get('/internal/acuerdo-activo')
    .set('X-Internal-API-Key', 'test-internal-api-key-32-bytes-min!!');
  assert.equal(res.status, 200);
  assert.equal(res.body.version, 'v2.0');
  assert.equal(res.body.texto, 'texto v2');
});

// =================================================================
// Bloque A — Vigencia del Acuerdo (fecha_vigencia_inicio / fecha_vigencia_fin)
// =================================================================

test('getActive: Acuerdo vencido (fecha_vigencia_fin en el pasado) → null', async () => {
  resetDb();
  const agreementService = require('../../src/services/agreement');
  agreementService.createVersion({
    version: 'v1.0', texto: 'texto v1', activa: true,
  });
  // Forzar fecha_vigencia_fin a ayer
  const ayer = new Date(Date.now() - 86400000).toISOString();
  require('../../src/db/connection').prepare(
    'UPDATE gh_firma_acuerdo_versiones SET fecha_vigencia_fin = ?'
  ).run(ayer);

  const acuerdo = agreementService.getActive();
  assert.equal(acuerdo, null, 'Acuerdo vencido NO debe retornarse como activo');
});

test('getActive: Acuerdo sin fecha_vigencia_fin (NULL) → retorna activa', async () => {
  resetDb();
  const agreementService = require('../../src/services/agreement');
  agreementService.createVersion({
    version: 'v1.0', texto: 'texto v1', activa: true,
  });
  // Por defecto fecha_vigencia_fin = NULL en createVersion → válida indefinidamente
  const acuerdo = agreementService.getActive();
  assert.ok(acuerdo, 'Acuerdo sin fecha_fin debe retornarse como activo');
  assert.equal(acuerdo.version, 'v1.0');
});

test('getActive: Acuerdo futuro (fecha_vigencia_inicio en el futuro) → null', async () => {
  resetDb();
  const agreementService = require('../../src/services/agreement');
  agreementService.createVersion({
    version: 'v1.0', texto: 'texto v1', activa: true,
  });
  // Forzar fecha_vigencia_inicio a mañana
  const manana = new Date(Date.now() + 86400000).toISOString();
  require('../../src/db/connection').prepare(
    'UPDATE gh_firma_acuerdo_versiones SET fecha_vigencia_inicio = ?'
  ).run(manana);

  const acuerdo = agreementService.getActive();
  assert.equal(acuerdo, null, 'Acuerdo que aún no entra en vigencia NO debe ser activo');
});

test('GET /internal/acuerdo-activo con Acuerdo vencido → 404', async () => {
  resetDb();
  const agreementService = require('../../src/services/agreement');
  agreementService.createVersion({
    version: 'v1.0', texto: 'texto v1', activa: true,
  });
  const ayer = new Date(Date.now() - 86400000).toISOString();
  require('../../src/db/connection').prepare(
    'UPDATE gh_firma_acuerdo_versiones SET fecha_vigencia_fin = ?'
  ).run(ayer);

  const app = makeApp();
  const res = await require('supertest')(app)
    .get('/internal/acuerdo-activo')
    .set('X-Internal-API-Key', 'test-internal-api-key-32-bytes-min!!');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'ACUERDO_NOT_FOUND');
});
