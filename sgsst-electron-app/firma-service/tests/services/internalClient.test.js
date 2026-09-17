/**
 * Tests del service internalClient (I-010, D-13 per-company authz).
 *
 * Verifica COMPORTAMIENTO (no implementación):
 *  1. createClient hashea la API key (el hash en BD NO es el plaintext).
 *  2. getActiveClientByApiKey retorna el cliente si existe y está activo.
 *  3. getActiveClientByApiKey retorna null si la key no existe.
 *  4. getActiveClientByApiKey retorna null si el cliente está revocado.
 *  5. revokeClient setea timestamp, próximos lookups fallan.
 *  6. listActiveClients excluye revocados.
 *  7. lookupLegacyClient retorna shape correcto cuando match legacy.
 *  8. lookupLegacyClient retorna null cuando no match legacy.
 *
 * Decisiones validadas:
 *  - SHA-256 (no bcrypt/argon2) es suficiente para API keys ≥32 chars.
 *  - El cache acelera lookups activos; el bypass del cache para revocación
 *    NO es necesario en v1 (acepta ventana de 30s — ver I-010 design).
 *  - El helper de legacy usa constantTimeEqual (no ===) para no filtrar
 *    información por timing al comparar la API key global.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../../src/db/connection');
const { resetDb } = require('../helpers');
const internalClient = require('../../src/services/internalClient');
const { sha256 } = require('../../src/crypto/hash');
const config = require('../../src/config');

const API_KEY_A = 'sk_test_A_32chars_min_abcdef123456';
const API_KEY_B = 'sk_test_B_32chars_min_abcdef654321';

beforeEach();

function beforeEach() {
  resetDb();
  internalClient.clearCache();
}

// =================================================================
// 1. createClient hashea la API key
// =================================================================

test('I-010: createClient hashea la API key (el hash en BD NO es el plaintext)', () => {
  beforeEach();
  const result = internalClient.createClient({
    id_empresa: '900123456',
    allowed_operations: ['sign_request:create', 'sign_request:read'],
    description: 'K+AIR cliente A',
    apiKey: API_KEY_A,
  });
  assert.ok(result.api_key_hash, 'debe retornar api_key_hash');
  assert.equal(result.api_key_hash.length, 64, 'el hash debe tener 64 chars (SHA-256 hex)');
  assert.notEqual(result.api_key_hash, API_KEY_A,
    'el hash en BD NO debe ser el plaintext');
  assert.equal(result.api_key_hash, sha256(API_KEY_A),
    'el hash debe ser SHA-256(apiKey)');

  // Verificación independiente: leer de BD directo y ver que el hash
  // guardado NO contiene la API key.
  const row = db.prepare(
    'SELECT api_key_hash, id_empresa, allowed_operations FROM gh_internal_clients WHERE api_key_hash = ?'
  ).get(result.api_key_hash);
  assert.ok(row, 'la fila debe existir en BD');
  assert.notEqual(row.api_key_hash, API_KEY_A,
    'el hash en BD NO debe ser el plaintext (verificación secundaria)');
  assert.equal(row.id_empresa, '900123456');
  assert.equal(row.allowed_operations, 'sign_request:create,sign_request:read');
});

// =================================================================
// 2. getActiveClientByApiKey retorna el cliente si existe
// =================================================================

test('I-010: getActiveClientByApiKey retorna el cliente si existe y está activo', () => {
  beforeEach();
  internalClient.createClient({
    id_empresa: '900123456',
    allowed_operations: 'sign_request:create',
    apiKey: API_KEY_A,
  });

  const found = internalClient.getActiveClientByApiKey(API_KEY_A);
  assert.ok(found, 'debe encontrar el cliente activo');
  assert.equal(found.id_empresa, '900123456');
  assert.equal(found.allowed_operations, 'sign_request:create');
  assert.equal(found.revoked_at, null, 'revoked_at debe ser null para cliente activo');
});

// =================================================================
// 3. getActiveClientByApiKey retorna null si la key no existe
// =================================================================

test('I-010: getActiveClientByApiKey retorna null si la key no existe', () => {
  beforeEach();
  const found = internalClient.getActiveClientByApiKey('sk_nonexistent_never_seen');
  assert.equal(found, null, 'debe retornar null para key inexistente');
});

// =================================================================
// 4. getActiveClientByApiKey retorna null si el cliente está revocado
// =================================================================

test('I-010: getActiveClientByApiKey retorna null si el cliente está revocado', () => {
  beforeEach();
  const created = internalClient.createClient({
    id_empresa: '900123456',
    allowed_operations: 'sign_request:create',
    apiKey: API_KEY_A,
  });

  // Antes de revocar, debe estar activo
  const beforeRevoke = internalClient.getActiveClientByApiKey(API_KEY_A);
  assert.ok(beforeRevoke, 'antes de revocar debe estar activo');

  // Revocar
  const wasRevoked = internalClient.revokeClient(created.api_key_hash);
  assert.equal(wasRevoked, true, 'revokeClient debe retornar true');

  // Después de revocar, getActiveClientByApiKey debe retornar null
  // (pero solo después de que el cache se haya invalidado, lo cual hace
  // revokeClient automáticamente).
  const afterRevoke = internalClient.getActiveClientByApiKey(API_KEY_A);
  assert.equal(afterRevoke, null, 'después de revocar, getActiveClientByApiKey debe retornar null');
});

// =================================================================
// 5. revokeClient setea timestamp, próximos lookups fallan
// =================================================================

test('I-010: revokeClient setea revoked_at timestamp y persiste en BD', () => {
  beforeEach();
  const created = internalClient.createClient({
    id_empresa: '900123456',
    allowed_operations: 'sign_request:create',
    apiKey: API_KEY_A,
  });

  // Verificar revoked_at es null inicialmente
  const initial = db.prepare(
    'SELECT revoked_at FROM gh_internal_clients WHERE api_key_hash = ?'
  ).get(created.api_key_hash);
  assert.equal(initial.revoked_at, null, 'revoked_at debe ser null inicialmente');

  // Revocar
  internalClient.revokeClient(created.api_key_hash);

  // Verificar que revoked_at tiene un timestamp
  const revoked = db.prepare(
    'SELECT revoked_at FROM gh_internal_clients WHERE api_key_hash = ?'
  ).get(created.api_key_hash);
  assert.ok(revoked.revoked_at, 'revoked_at debe tener timestamp tras revoke');
  // Validar formato ISO8601 aproximado: 'YYYY-MM-DD HH:MM:SS' (datetime('now') retorna esto)
  assert.match(revoked.revoked_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    'revoked_at debe tener formato ISO8601 (datetime)');
});

// =================================================================
// 6. listActiveClients excluye revocados
// =================================================================

test('I-010: listActiveClients excluye revocados', () => {
  beforeEach();
  const c1 = internalClient.createClient({
    id_empresa: '900123456',
    allowed_operations: 'sign_request:create',
    apiKey: API_KEY_A,
  });
  internalClient.createClient({
    id_empresa: '900999999',
    allowed_operations: 'sign_request:read',
    apiKey: API_KEY_B,
  });
  // Revocar el primero
  internalClient.revokeClient(c1.api_key_hash);

  const active = internalClient.listActiveClients();
  assert.equal(active.length, 1, 'debe haber 1 cliente activo (el otro está revocado)');
  assert.equal(active[0].id_empresa, '900999999', 'el cliente activo es el de la empresa B');
  // Asegurar que el revocado no aparece
  for (const c of active) {
    assert.notEqual(c.api_key_hash, c1.api_key_hash,
      'el cliente revocado NO debe aparecer en la lista');
  }
});

// =================================================================
// 7. lookupLegacyClient retorna shape correcto cuando match legacy
// =================================================================

test('I-010: lookupLegacyClient retorna shape legacy cuando la key coincide con config.auth.internalApiKey', () => {
  beforeEach();
  // config.auth.internalApiKey está seteado por tests/helpers.js a TEST_API_KEY.
  // Verificamos que la API key legacy configurada retorna el shape correcto.
  const legacyKey = config.auth.internalApiKey;
  assert.ok(legacyKey, 'config.auth.internalApiKey debe estar seteado en tests');

  const result = internalClient.lookupLegacyClient(legacyKey);
  assert.ok(result, 'debe retornar objeto legacy');
  assert.equal(result.legacy, true, 'legacy flag debe ser true');
  assert.equal(result.id_empresa, null, 'id_empresa del legacy debe ser null (NO \'*\')');
  assert.equal(result.allowed_operations, 'legacy',
    'allowed_operations del legacy debe ser la marca "legacy"');
  assert.equal(result.revoked_at, null);
  assert.ok(result.api_key_hash, 'debe tener api_key_hash derivado');
  assert.notEqual(result.api_key_hash, legacyKey,
    'api_key_hash debe ser el hash, NO el plaintext');
  assert.equal(result.api_key_hash, sha256(legacyKey),
    'api_key_hash debe ser SHA-256 de la legacy key');
});

// =================================================================
// 8. lookupLegacyClient retorna null cuando no match legacy
// =================================================================

test('I-010: lookupLegacyClient retorna null cuando la key NO coincide con config.auth.internalApiKey', () => {
  beforeEach();
  const result = internalClient.lookupLegacyClient('sk_some_other_key_not_the_legacy_one');
  assert.equal(result, null, 'debe retornar null para keys distintas a la legacy');
});
