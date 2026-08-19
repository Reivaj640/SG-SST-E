/**
 * Tests del middleware requireEmpresaScope (I-010, D-13 per-company authz).
 *
 * Verifica COMPORTAMIENTO de las dos capas (authn + authz):
 *
 *  1. Key válida sin allowedOperations requerida → next()
 *  2. Key revocada → 401
 *  3. Key no existe → 401
 *  4. Sin header → 401
 *  5. Cliente normal + operación permitida → next()
 *  6. Cliente normal + operación NO permitida → 403
 *  7. checkIdEmpresa: true + body.id_empresa coincide → next()
 *  8. checkIdEmpresa: true + body.id_empresa MISMATCH → 403 EMPRESA_MISMATCH
 *  9. Legacy key + operación legacy → next() (con deprecation warning)
 * 10. Legacy key + checkIdEmpresa: true → next() (legacy es permisivo en deprecation)
 *
 * Decisiones validadas:
 *  - 401 = authn fallida (key ausente, inválida o revocada)
 *  - 403 = authz fallida (cliente autenticado pero sin permiso de operación
 *    o con id_empresa mismatch)
 *  - 422 = body mal formado (zod), estado inconsistente, etc. (NO se usa acá)
 *  - En legacy mode + checkIdEmpresa, se permite la operación sin check
 *    (deprecation period). El handler hace el check post-lookup si lo necesita.
 *  - `req.id_empresa` siempre viene de la identidad autenticada.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { resetDb, makeApp, TEST_API_KEY } = require('../helpers');
const internalClient = require('../../src/services/internalClient');
const { requireEmpresaScope } = require('../../src/middleware/authz');
const config = require('../../src/config');

const API_KEY_A = 'sk_test_A_32chars_min_abcdef123456';
const API_KEY_B = 'sk_test_B_32chars_min_abcdef654321';

// Helper: app de test con el middleware aplicado a una ruta específica.
function buildAppWithMiddleware(middleware, path = '/test', method = 'post') {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app[method](path, middleware, (req, res) => {
    res.json({
      authSource: req.authSource,
      id_empresa: req.id_empresa,
      clientOperations: req.clientOperations,
      api_key_hash_prefix: req.api_key_hash_prefix,
      body: req.body,
    });
  });
  // error handler
  const { errorHandler } = require('../../src/middleware/errors');
  app.use(errorHandler());
  return app;
}

// =================================================================
// 1. Key válida sin allowedOperations requerida → next()
// =================================================================

test('I-010: key válida sin allowedOperations requerida → next() con req.authSource=client', async () => {
  resetDb();
  internalClient.clearCache();
  internalClient.createClient({
    id_empresa: '900123456',
    allowed_operations: 'sign_request:create',
    apiKey: API_KEY_A,
  });

  const app = buildAppWithMiddleware(requireEmpresaScope({}));
  const res = await request(app)
    .post('/test')
    .set('X-Internal-API-Key', API_KEY_A)
    .send({});
  assert.equal(res.status, 200);
  assert.equal(res.body.authSource, 'client');
  assert.equal(res.body.id_empresa, '900123456');
  assert.deepEqual(res.body.clientOperations, ['sign_request:create']);
});

// =================================================================
// 2. Key revocada → 401
// =================================================================

test('I-010: key revocada → 401 INVALID_API_KEY', async () => {
  resetDb();
  internalClient.clearCache();
  const created = internalClient.createClient({
    id_empresa: '900123456',
    allowed_operations: 'sign_request:create',
    apiKey: API_KEY_A,
  });
  internalClient.revokeClient(created.api_key_hash);

  const app = buildAppWithMiddleware(requireEmpresaScope({}));
  const res = await request(app)
    .post('/test')
    .set('X-Internal-API-Key', API_KEY_A)
    .send({});
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

// =================================================================
// 3. Key no existe → 401
// =================================================================

test('I-010: key no existe (ni en BD ni legacy) → 401', async () => {
  resetDb();
  internalClient.clearCache();
  // NO creamos ningún cliente, y la key no es la legacy
  const app = buildAppWithMiddleware(requireEmpresaScope({}));
  const res = await request(app)
    .post('/test')
    .set('X-Internal-API-Key', 'sk_never_seen_12345678901234567890')
    .send({});
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

// =================================================================
// 4. Sin header → 401
// =================================================================

test('I-010: sin header X-Internal-API-Key → 401', async () => {
  resetDb();
  internalClient.clearCache();
  const app = buildAppWithMiddleware(requireEmpresaScope({}));
  const res = await request(app)
    .post('/test')
    .send({});
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

// =================================================================
// 5. Cliente normal + operación permitida → next()
// =================================================================

test('I-010: cliente normal + operación permitida → next()', async () => {
  resetDb();
  internalClient.clearCache();
  internalClient.createClient({
    id_empresa: '900123456',
    allowed_operations: 'sign_request:create,sign_request:read',
    apiKey: API_KEY_A,
  });

  const app = buildAppWithMiddleware(requireEmpresaScope({
    allowedOperations: ['sign_request:create'],
  }));
  const res = await request(app)
    .post('/test')
    .set('X-Internal-API-Key', API_KEY_A)
    .send({});
  assert.equal(res.status, 200);
  assert.equal(res.body.authSource, 'client');
  assert.equal(res.body.id_empresa, '900123456');
});

// =================================================================
// 6. Cliente normal + operación NO permitida → 403 FORBIDDEN
// =================================================================

test('I-010: cliente normal + operación NO permitida → 403 FORBIDDEN', async () => {
  resetDb();
  internalClient.clearCache();
  internalClient.createClient({
    id_empresa: '900123456',
    // Solo tiene sign_request:read, NO sign_request:create
    allowed_operations: 'sign_request:read',
    apiKey: API_KEY_A,
  });

  const app = buildAppWithMiddleware(requireEmpresaScope({
    allowedOperations: ['sign_request:create'],
  }));
  const res = await request(app)
    .post('/test')
    .set('X-Internal-API-Key', API_KEY_A)
    .send({});
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
  assert.deepEqual(res.body.error.details.required_operations, ['sign_request:create']);
  assert.deepEqual(res.body.error.details.client_operations, ['sign_request:read']);
});

// =================================================================
// 7. checkIdEmpresa: true + body.id_empresa coincide → next()
// =================================================================

test('I-010: checkIdEmpresa=true + body.id_empresa coincide → next()', async () => {
  resetDb();
  internalClient.clearCache();
  internalClient.createClient({
    id_empresa: '900123456',
    allowed_operations: 'sign_request:create',
    apiKey: API_KEY_A,
  });

  const app = buildAppWithMiddleware(requireEmpresaScope({
    allowedOperations: ['sign_request:create'],
    checkIdEmpresa: true,
  }));
  const res = await request(app)
    .post('/test')
    .set('X-Internal-API-Key', API_KEY_A)
    .send({ id_empresa: '900123456' });  // coincide con auth
  assert.equal(res.status, 200);
  assert.equal(res.body.id_empresa, '900123456');
});

// =================================================================
// 8. checkIdEmpresa: true + body.id_empresa MISMATCH → 403 EMPRESA_MISMATCH
// =================================================================

test('I-010: checkIdEmpresa=true + body.id_empresa MISMATCH → 403 EMPRESA_MISMATCH', async () => {
  resetDb();
  internalClient.clearCache();
  internalClient.createClient({
    id_empresa: '900123456',  // cliente A está atado a esta empresa
    allowed_operations: 'sign_request:create',
    apiKey: API_KEY_A,
  });

  const app = buildAppWithMiddleware(requireEmpresaScope({
    allowedOperations: ['sign_request:create'],
    checkIdEmpresa: true,
  }));
  const res = await request(app)
    .post('/test')
    .set('X-Internal-API-Key', API_KEY_A)
    .send({ id_empresa: '900999999' });  // quiere crear para OTRA empresa
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'EMPRESA_MISMATCH');
  assert.equal(res.body.error.details.auth_id_empresa, '900123456');
  assert.equal(res.body.error.details.requested_id_empresa, '900999999');
});

// =================================================================
// 9. Legacy key + operación legacy → next() (con deprecation warning)
// =================================================================

test('I-010: legacy key (config.auth.internalApiKey) → next() con authSource=legacy, deprecation warning', async () => {
  resetDb();
  internalClient.clearCache();
  // NO creamos cliente con TEST_API_KEY. La legacy key es config.auth.internalApiKey.
  const app = buildAppWithMiddleware(requireEmpresaScope({}));
  const res = await request(app)
    .post('/test')
    .set('X-Internal-API-Key', TEST_API_KEY)
    .send({});
  assert.equal(res.status, 200);
  assert.equal(res.body.authSource, 'legacy');
  assert.equal(res.body.id_empresa, null,
    'legacy NO fabrica identidad: id_empresa debe ser null');
  assert.deepEqual(res.body.clientOperations, ['legacy'],
    'legacy clientOperations debe ser la marca especial');
});

// =================================================================
// 10. Legacy key + checkIdEmpresa: true → next() (legacy es permisivo en deprecation)
// =================================================================

test('I-010: legacy key + checkIdEmpresa=true → next() (deprecation: legacy es permisivo)', async () => {
  resetDb();
  internalClient.clearCache();
  // Legacy mode + checkIdEmpresa → permite cualquier id_empresa en body
  // durante el período de deprecation. El route handler hace el check
  // post-lookup si lo necesita.
  const app = buildAppWithMiddleware(requireEmpresaScope({
    checkIdEmpresa: true,
  }));
  const res = await request(app)
    .post('/test')
    .set('X-Internal-API-Key', TEST_API_KEY)
    .send({ id_empresa: '900999999' });
  assert.equal(res.status, 200,
    'legacy + checkIdEmpresa debe ser permisivo (deprecation period)');
  assert.equal(res.body.authSource, 'legacy');
  assert.equal(res.body.id_empresa, null);
});
