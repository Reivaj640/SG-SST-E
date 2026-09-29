/**
 * Tests del service internalClient para los endpoints admin per-company
 * (D-13, I-010, AUD-04, DR-1 a DR-6).
 *
 * Cubre:
 *  - createPerCompanyClient: generación de key, hash, 409 si ya hay activo,
 *    409 preserva historial de revocados, formato de prefijo.
 *  - rotateClientByEmpresa: TX atómica, 404 si no hay activo, cache invalidado,
 *    herencia de allowed_operations y description.
 *  - listClients: filtros, paginación, NUNCA expone hash completo.
 *  - getActiveClientByEmpresa: helper.
 *
 * Acompañante de tests/routes/admin-clientes.test.js (38 tests, capa HTTP).
 * Acá probamos el service directamente (sin Express), incluyendo el path
 * "transaccional" que es crítico.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../../src/db/connection');
const { resetDb } = require('../helpers');
const internalClient = require('../../src/services/internalClient');
const { sha256 } = require('../../src/crypto/hash');

const ALL_OPS = [
  'sign_request:create',
  'sign_request:read',
  'consent:create',
  'consent:verify',
  'audit:read',
];

function beforeEach() {
  resetDb();
  internalClient.clearCache();
}

// =============================================================================
// 1. createPerCompanyClient
// =============================================================================

test('createPerCompanyClient: genera key con formato kair_<env>_<base64url>', () => {
  beforeEach();
  const result = internalClient.createPerCompanyClient({
    id_empresa: '900123456',
    allowed_operations: ALL_OPS,
  });
  // Prefijo kair_test_ (NODE_ENV=test) + 43 chars base64url = 53 chars total
  assert.equal(result.api_key.length, 53);
  assert.match(result.api_key, /^kair_test_[A-Za-z0-9_-]{43}$/);
  // Hash es SHA-256 de la key
  assert.equal(result.api_key_hash, sha256(result.api_key));
  assert.equal(result.api_key_hash.length, 64);
  assert.equal(result.api_key_hash_prefix.length, 8);
  // El hash en BD coincide
  const row = db.prepare(
    'SELECT api_key_hash FROM gh_internal_clients WHERE id_empresa = ?'
  ).get('900123456');
  assert.equal(row.api_key_hash, result.api_key_hash);
});

test('createPerCompanyClient: 409 si id_empresa ya tiene cliente activo', () => {
  beforeEach();
  internalClient.createPerCompanyClient({
    id_empresa: '900123456',
    allowed_operations: ALL_OPS,
  });
  assert.throws(
    () => internalClient.createPerCompanyClient({
      id_empresa: '900123456',
      allowed_operations: ALL_OPS,
    }),
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.equal(err.code, 'CLIENT_EXISTS_FOR_EMPRESA');
      assert.equal(err.details.id_empresa, '900123456');
      assert.match(err.details.existing_hash_prefix, /^[0-9a-f]{8}$/);
      return true;
    },
  );
});

test('createPerCompanyClient: 201 si id_empresa solo tiene clientes revocados', () => {
  beforeEach();
  const first = internalClient.createPerCompanyClient({
    id_empresa: '900123456',
    allowed_operations: ALL_OPS,
  });
  // Revocar el primero vía BD directa
  db.prepare('UPDATE gh_internal_clients SET revoked_at = datetime(\'now\') WHERE api_key_hash = ?')
    .run(first.api_key_hash);
  internalClient.clearCache();

  // Crear uno nuevo: debe ser OK
  const second = internalClient.createPerCompanyClient({
    id_empresa: '900123456',
    allowed_operations: ALL_OPS,
  });
  assert.notEqual(first.api_key_hash, second.api_key_hash);
  assert.notEqual(first.api_key, second.api_key);
});

test('createPerCompanyClient: precomputedKey (test hook) usa la key exacta', () => {
  beforeEach();
  const precomputed = 'kair_test_FIXEDKEY_precomputed_for_tests_xx';
  const result = internalClient.createPerCompanyClient({
    id_empresa: '900123456',
    allowed_operations: ALL_OPS,
    precomputedKey: precomputed,
  });
  assert.equal(result.api_key, precomputed);
  assert.equal(result.api_key_hash, sha256(precomputed));
});

// =============================================================================
// 2. rotateClientByEmpresa
// =============================================================================

test('rotateClientByEmpresa: 404 si no hay cliente activo', () => {
  beforeEach();
  assert.throws(
    () => internalClient.rotateClientByEmpresa('900000000'),
    (err) => {
      assert.equal(err.statusCode, 404);
      assert.equal(err.code, 'CLIENT_NOT_FOUND');
      assert.equal(err.details.id_empresa, '900000000');
      assert.match(err.details.hint, /POST/);
      return true;
    },
  );
});

test('rotateClientByEmpresa: TX atómica — viejo revocado, nuevo activo, mismas ops', () => {
  beforeEach();
  const old = internalClient.createPerCompanyClient({
    id_empresa: '900123456',
    allowed_operations: ALL_OPS,
    description: 'K+AIR X - produccion',
  });
  const result = internalClient.rotateClientByEmpresa('900123456', {
    motivo: 'Rotación trimestral',
    actor: 'ops@example.com',
  });

  // 1) Viejo quedó revocado
  const oldRow = db.prepare(
    'SELECT revoked_at, allowed_operations, description FROM gh_internal_clients WHERE api_key_hash = ?'
  ).get(old.api_key_hash);
  assert.ok(oldRow.revoked_at, 'viejo debe tener revoked_at setado');
  // 2) Nuevo está activo y tiene mismas ops
  const newRow = db.prepare(
    'SELECT revoked_at, allowed_operations, description FROM gh_internal_clients WHERE api_key_hash = ?'
  ).get(result.api_key_hash);
  assert.equal(newRow.revoked_at, null, 'nuevo debe estar activo');
  assert.equal(newRow.allowed_operations, ALL_OPS.join(','),
    'nuevo debe heredar allowed_operations');
  assert.equal(newRow.description, 'K+AIR X - produccion',
    'nuevo debe heredar description');
  // 3) Las keys son distintas
  assert.notEqual(old.api_key, result.api_key);
  assert.notEqual(old.api_key_hash, result.api_key_hash);
  // 4) Defaults aplicados
  // (cubierto en otro test)
  assert.equal(result.motivo, 'Rotación trimestral');
  assert.equal(result.actor, 'ops@example.com');
});

test('rotateClientByEmpresa: defaults motivo/actor si no se pasan', () => {
  beforeEach();
  internalClient.createPerCompanyClient({
    id_empresa: '900123456',
    allowed_operations: ALL_OPS,
  });
  const result = internalClient.rotateClientByEmpresa('900123456');
  assert.equal(result.motivo, 'Rotación programada');
  assert.equal(result.actor, 'admin');
});

test('rotateClientByEmpresa: limpia cache — old key NO funciona, new SÍ', () => {
  beforeEach();
  const old = internalClient.createPerCompanyClient({
    id_empresa: '900123456',
    allowed_operations: ALL_OPS,
  });
  // Forzar que la key vieja quede en el cache
  const cached = internalClient.getActiveClientByApiKey(old.api_key);
  assert.ok(cached, 'old key debe estar en el cache antes de rotar');

  const result = internalClient.rotateClientByEmpresa('900123456');

  // Old key NO debe funcionar (cache limpiado)
  const afterOld = internalClient.getActiveClientByApiKey(old.api_key);
  assert.equal(afterOld, null, 'old key debe retornar null tras rotate');

  // New key SÍ debe funcionar
  const afterNew = internalClient.getActiveClientByApiKey(result.api_key);
  assert.ok(afterNew, 'new key debe estar activa');
  assert.equal(afterNew.id_empresa, '900123456');
});

test('rotateClientByEmpresa: mantiene descripción heredada', () => {
  beforeEach();
  internalClient.createPerCompanyClient({
    id_empresa: '900123456',
    allowed_operations: ['sign_request:create'],
    description: 'TEST: descripción que debe sobrevivir la rotación',
  });
  const result = internalClient.rotateClientByEmpresa('900123456');
  assert.equal(result.description, 'TEST: descripción que debe sobrevivir la rotación');
});

test('rotateClientByEmpresa: rotaciones sucesivas rotan el nuevo cliente, no el viejo', () => {
  beforeEach();
  const original = internalClient.createPerCompanyClient({
    id_empresa: '900123456',
    allowed_operations: ALL_OPS,
  });
  // Primera rotación: ahora hay un nuevo cliente activo
  const first = internalClient.rotateClientByEmpresa('900123456');
  assert.notEqual(first.api_key_hash, original.api_key_hash);
  // Segunda rotación: rota el de la primera, NO el original
  const second = internalClient.rotateClientByEmpresa('900123456');
  assert.notEqual(second.api_key_hash, first.api_key_hash);
  assert.notEqual(second.api_key_hash, original.api_key_hash);
  // Las 3 keys son distintas
  const all = new Set([original.api_key, first.api_key, second.api_key]);
  assert.equal(all.size, 3, 'las 3 keys deben ser únicas');
  // El original sigue revocado
  const origRow = db.prepare(
    'SELECT revoked_at FROM gh_internal_clients WHERE api_key_hash = ?'
  ).get(original.api_key_hash);
  assert.ok(origRow.revoked_at, 'el original debe seguir revocado');
  // El de la 1ra rotación también está revocado
  const firstRow = db.prepare(
    'SELECT revoked_at FROM gh_internal_clients WHERE api_key_hash = ?'
  ).get(first.api_key_hash);
  assert.ok(firstRow.revoked_at, 'el de la 1ra rotación debe estar revocado');
  // El de la 2da rotación está activo
  const secondRow = db.prepare(
    'SELECT revoked_at FROM gh_internal_clients WHERE api_key_hash = ?'
  ).get(second.api_key_hash);
  assert.equal(secondRow.revoked_at, null, 'el de la 2da rotación está activo');
});

// =============================================================================
// 3. listClients
// =============================================================================

test('listClients: filtro por id_empresa exacto', () => {
  beforeEach();
  internalClient.createPerCompanyClient({ id_empresa: '900111111', allowed_operations: ALL_OPS });
  internalClient.createPerCompanyClient({ id_empresa: '900222222', allowed_operations: ALL_OPS });
  const r = internalClient.listClients({ id_empresa: '900111111' });
  assert.equal(r.total, 1);
  assert.equal(r.items[0].id_empresa, '900111111');
});

test('listClients: default excluye revocados', () => {
  beforeEach();
  const c1 = internalClient.createPerCompanyClient({ id_empresa: '900111111', allowed_operations: ALL_OPS });
  internalClient.createPerCompanyClient({ id_empresa: '900222222', allowed_operations: ALL_OPS });
  // Revocar el primero
  db.prepare('UPDATE gh_internal_clients SET revoked_at = datetime(\'now\') WHERE api_key_hash = ?')
    .run(c1.api_key_hash);
  internalClient.clearCache();

  const r = internalClient.listClients({});
  assert.equal(r.total, 1);
  assert.equal(r.items[0].id_empresa, '900222222');
});

test('listClients: include_revoked=true incluye revocados', () => {
  beforeEach();
  const c1 = internalClient.createPerCompanyClient({ id_empresa: '900111111', allowed_operations: ALL_OPS });
  internalClient.createPerCompanyClient({ id_empresa: '900222222', allowed_operations: ALL_OPS });
  db.prepare('UPDATE gh_internal_clients SET revoked_at = datetime(\'now\') WHERE api_key_hash = ?')
    .run(c1.api_key_hash);
  internalClient.clearCache();

  const r = internalClient.listClients({ include_revoked: true });
  assert.equal(r.total, 2);
  const revocados = r.items.filter(i => !i.is_active);
  assert.equal(revocados.length, 1);
  assert.equal(revocados[0].id_empresa, '900111111');
});

test('listClients: paginación limit/offset', () => {
  beforeEach();
  // 5 clientes
  for (let i = 0; i < 5; i++) {
    internalClient.createPerCompanyClient({
      id_empresa: `90000000${i}`,
      allowed_operations: ALL_OPS,
    });
  }
  const page1 = internalClient.listClients({ limit: 2, offset: 0 });
  assert.equal(page1.total, 5);
  assert.equal(page1.items.length, 2);
  const page2 = internalClient.listClients({ limit: 2, offset: 2 });
  assert.equal(page2.items.length, 2);
  // Páginas disjuntas
  const idsP1 = page1.items.map(i => i.id_empresa);
  const idsP2 = page2.items.map(i => i.id_empresa);
  for (const id of idsP2) {
    assert.ok(!idsP1.includes(id), `id ${id} no debe estar en página 1`);
  }
});

test('listClients: NUNCA expone api_key_hash completo', () => {
  beforeEach();
  internalClient.createPerCompanyClient({ id_empresa: '900111111', allowed_operations: ALL_OPS });
  const r = internalClient.listClients({});
  for (const item of r.items) {
    assert.ok(item.api_key_hash_prefix, 'debe tener prefix');
    assert.equal(item.api_key_hash_prefix.length, 8);
    assert.equal(item.api_key_hash, undefined, 'NO debe tener hash completo');
  }
});

// =============================================================================
// 4. getActiveClientByEmpresa
// =============================================================================

test('getActiveClientByEmpresa: retorna el cliente activo de la empresa', () => {
  beforeEach();
  internalClient.createPerCompanyClient({ id_empresa: '900111111', allowed_operations: ALL_OPS });
  const r = internalClient.getActiveClientByEmpresa('900111111');
  assert.ok(r);
  assert.equal(r.id_empresa, '900111111');
  assert.equal(r.revoked_at, null);
});

test('getActiveClientByEmpresa: retorna null si no hay', () => {
  beforeEach();
  const r = internalClient.getActiveClientByEmpresa('900000000');
  assert.equal(r, null);
});

test('getActiveClientByEmpresa: retorna null si solo hay revocados', () => {
  beforeEach();
  const c = internalClient.createPerCompanyClient({ id_empresa: '900111111', allowed_operations: ALL_OPS });
  db.prepare('UPDATE gh_internal_clients SET revoked_at = datetime(\'now\') WHERE api_key_hash = ?')
    .run(c.api_key_hash);
  internalClient.clearCache();
  const r = internalClient.getActiveClientByEmpresa('900111111');
  assert.equal(r, null);
});

// =============================================================================
// 5. hashPrefix
// =============================================================================

test('hashPrefix: retorna 8 chars hex del hash', () => {
  const hash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  assert.equal(internalClient.hashPrefix(hash), 'abcdef12');
});

test('hashPrefix: retorna "" si hash inválido', () => {
  assert.equal(internalClient.hashPrefix('short'), '');
  assert.equal(internalClient.hashPrefix(null), '');
  assert.equal(internalClient.hashPrefix(undefined), '');
});
