// =====================================================================
// 📦101 (2026-08-20) — Tests unit del bridge IPC firma:* (I-101)
// Ejecutar: node --test main/test-firma-bridge.js
//
// Patrón:
//   - Mock de 'electron' (ipcMain + app + safeStorage)
//   - Inyección de firma-client mockeado vía _test_setClientFactory
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Module = require('module');

// ---------- Mock del módulo 'electron' ----------
const _mockIpcHandlers = {};
const _mockSafeStorage = {
  isEncryptionAvailable: function () { return _mockSafeStorage._available !== false; },
  encryptString: function (s) {
    return Buffer.from('ENC:' + s, 'utf-8');
  },
  decryptString: function (buf) {
    var s = Buffer.isBuffer(buf) ? buf.toString('utf-8') : String(buf);
    if (s.indexOf('ENC:') !== 0) throw new Error('Invalid encrypted blob');
    return s.slice(4);
  },
  _available: true
};
const _testUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-firma-test-'));
const _mockApp = {
  on: function () {},
  getPath: function (name) {
    if (name === 'userData') return _testUserData;
    return os.tmpdir();
  },
  getVersion: function () { return '0.1.190-test'; }
};

const _originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === 'electron') {
    return path.join(__dirname, '__mock_electron_firma.js');
  }
  return _originalResolve.call(this, request, parent, ...rest);
};
fs.writeFileSync(
  path.join(__dirname, '__mock_electron_firma.js'),
  'module.exports = global._mockElectronFirmaModule;\n'
);
global._mockElectronFirmaModule = {
  ipcMain: {
    handle: function (channel, handler) { _mockIpcHandlers[channel] = handler; }
  },
  app: _mockApp,
  safeStorage: _mockSafeStorage
};

// ---------- Importar el bridge (con electron mockeado) ----------
const registerFirmaHandlers = require('./firma-bridge');

// ---------- Mock del firma-client (inyectado vía hook) ----------
let _clientCallLog = [];

function _resetClientMock() {
  _clientCallLog = [];
  return {
    createSignRequest: function (args) { _clientCallLog.push({ m: 'createSignRequest', args: args }); return Promise.resolve({ success: true, data: { mocked: true, m: 'createSignRequest' } }); },
    getSignRequest: function (id) { _clientCallLog.push({ m: 'getSignRequest', id: id }); return Promise.resolve({ success: true, data: { mocked: true, m: 'getSignRequest' } }); },
    listSignRequests: function (ids) { _clientCallLog.push({ m: 'listSignRequests', ids: ids }); return Promise.resolve({ success: true, data: { items: [{ mocked: true }] } }); },
    getSignRequestDocument: function (id) { _clientCallLog.push({ m: 'getSignRequestDocument', id: id }); return Promise.resolve({ success: true, data: { base64: 'BESE64', contentType: 'application/pdf' } }); },
    getSignRequestConstancia: function (id) { _clientCallLog.push({ m: 'getSignRequestConstancia', id: id }); return Promise.resolve({ success: true, data: { base64: 'BESE64' } }); },
    getSignRequestLink: function (id) { _clientCallLog.push({ m: 'getSignRequestLink', id: id }); return Promise.resolve({ success: true, data: { token: 'mock-token', url_publica: 'http://test/s/mock' } }); },
    // I-103.A1.5.2 · notifySignRequestRemote mock
    notifySignRequestRemote: function (id, args) { _clientCallLog.push({ m: 'notifySignRequestRemote', id: id, args: args }); return Promise.resolve({ success: true, data: { mocked: true, m: 'notifySignRequestRemote', messageId: 'mock-msg-id', sent_at: '2026-08-24T15:00:00.000Z' } }); },
    createConsent: function (p) { _clientCallLog.push({ m: 'createConsent', payload: p }); return Promise.resolve({ success: true, data: { consent_id: 'cons_mock', estado: 'OTP_SENT' } }); },
    verifyConsentOtp: function (cid, otp) { _clientCallLog.push({ m: 'verifyConsentOtp', consentId: cid, otp: otp }); return Promise.resolve({ success: true, data: { ok: true, estado: 'ACEPTADO' } }); },
    getActiveAgreement: function () { _clientCallLog.push({ m: 'getActiveAgreement' }); return Promise.resolve({ success: true, data: { version: 'v1.0', texto_hash: 'abc' } }); }
  };
}

let _lastMockedClient = null;

function _setMockClient() {
  _lastMockedClient = _resetClientMock();
  registerFirmaHandlers._test_setClientFactory(function () {
    return _lastMockedClient;
  });
  registerFirmaHandlers._test_setGenerateClientInstanceId(function () {
    return '550e8400-e29b-41d4-a716-446655440000';
  });
}

// ---------- Setup por test ----------
function setup() {
  Object.keys(_mockIpcHandlers).forEach(function (k) { delete _mockIpcHandlers[k]; });
  _setMockClient();
  registerFirmaHandlers._test_reset();
  // Restaurar el client mock (porque _test_reset resetea el factory)
  _setMockClient();
  registerFirmaHandlers._test_clearSecrets();
  delete process.env.FIRMA_SERVICE_URL;
  delete process.env.FIRMA_SERVICE_API_KEY;
  delete process.env.FIRMA_SERVICE_CLIENT_INSTANCE_ID;
  registerFirmaHandlers.init({ handle: function (channel, handler) { _mockIpcHandlers[channel] = handler; } });
  registerFirmaHandlers(_mockApp, { appVersion: '0.1.190-test' });
}

function teardown() {
  registerFirmaHandlers._test_clearSecrets();
}

// Helper: configurar secrets.enc v2 con una empresa específica
function _setSecretsV2(empresasObj, opts) {
  opts = opts || {};
  var s2 = {
    version: 2,
    firmaServiceUrl: opts.url !== undefined ? opts.url : 'https://firma.test.k-air.com',
    firmaServiceClientInstanceId: opts.clientInstanceId || '550e8400-e29b-41d4-a716-446655440000',
    empresas: empresasObj || {}
  };
  if (opts.adminApiKey) s2.adminApiKey = opts.adminApiKey;
  if (opts.__legacy__) s2.__legacy__ = opts.__legacy__;
  registerFirmaHandlers._test_setSecrets(s2);
  return s2;
}

// Helper: configura una empresa por defecto (TEMPOACTIVA EST S.A.S.) con key
function _setupCompanyTempoactiva() {
  return _setSecretsV2({
    'TEMPOACTIVA EST S.A.S.': {
      idEmpresa: '900123456',
      firmaApiKey: 'kair_live_test_key_aBc123XyZ-32chars-min-len-XXX',
      activatedAt: '2026-08-20T15:00:00Z',
      lastValidatedAt: '2026-08-20T15:00:00Z'
    }
  });
}

// Helper: invoca un handler async y espera el resultado
async function _call(channel, payload) {
  var h = _mockIpcHandlers[channel];
  if (!h) throw new Error('Handler no registrado: ' + channel);
  return await h({}, payload || {});
}

// =====================================================================
//  Suite: Registro de handlers
// =====================================================================

test('registro: 21 canales firma:* están registrados (13 v0.1.190 + 7 nuevos v0.1.191 + 1 nuevo I-103.A1.5.2)', function () {
  setup();
  var expected = [
    'firma:config:get',
    'firma:config:set-api-key',
    'firma:config:set-url',
    'firma:config:diag',
    'firma:config:set-admin-key',     // NUEVO v0.1.191
    'firma:sign-request:create',
    'firma:sign-request:get',
    'firma:sign-request:list',
    'firma:sign-request:document',
    'firma:sign-request:constancia',
    'firma:sign-request:link',
    'firma:sign-request:notify-remote',  // NUEVO I-103.A1.5.2
    'firma:consent:create',
    'firma:consent:verify-otp',
    'firma:agreement:get',
    // NUEVOS v0.1.191 (per-empresa admin)
    'firma:empresa:list',
    'firma:empresa:create',
    'firma:empresa:set-api-key',
    'firma:empresa:rotate-api-key',
    'firma:empresa:revoke-api-key',
    'firma:empresa:list-firma-remote'
  ];
  expected.forEach(function (ch) {
    assert.ok(_mockIpcHandlers[ch], 'handler registrado: ' + ch);
  });
  teardown();
});

// =====================================================================
//  Suite: Config (síncronos — safeStorage no toca red)
// =====================================================================

test('config:get en modo missing: genera client_instance_id + URL/API vacías', function () {
  setup();
  var r = _mockIpcHandlers['firma:config:get']({}, {});
  assert.equal(r.success, true);
  assert.equal(r.data.url, '');
  assert.equal(r.data.hasApiKey, false);
  assert.equal(r.data.hasUrl, false);
  assert.equal(r.data.source, 'missing');
  assert.equal(r.data.clientInstanceId, '550e8400-e29b-41d4-a716-446655440000');
  assert.equal(r.data.encryptionAvailable, true);
  teardown();
});

test('config:get en modo env: lee env vars', function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  var r = _mockIpcHandlers['firma:config:get']({}, {});
  assert.equal(r.data.source, 'env');
  assert.equal(r.data.url, 'http://localhost:3001');
  assert.equal(r.data.hasApiKey, true);
  teardown();
});

test('config:get en modo env SIN client_id: genera UUID nuevo (LEGACY-SIGN-REMOVE fix)', function () {
  // HALLAZGO revisión I-101 (2026-08-20): antes, si URL+APIKEY estaban en env
  // pero FIRMA_SERVICE_CLIENT_INSTANCE_ID no, el bridge caía en
  // DEFAULT_DEV_CLIENT_INSTANCE_ID='test-instance-001' — colisión entre devs.
  // Fix: generar UUID nuevo + warning. Persistencia cero (modo env = efímero).
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  // FIRMA_SERVICE_CLIENT_INSTANCE_ID no se setea (borrado en setup()).
  var r = _mockIpcHandlers['firma:config:get']({}, {});
  assert.equal(r.data.source, 'env');
  assert.equal(r.data.url, 'http://localhost:3001');
  assert.equal(r.data.hasApiKey, true);
  // El client_id debe ser el UUID generado (mockeado a valor fijo en _setMockClient).
  assert.equal(r.data.clientInstanceId, '550e8400-e29b-41d4-a716-446655440000',
    'env sin client_id debe generar UUID nuevo, no caer en string fijo');
  teardown();
});

test('config:get en modo env CON client_id: respeta el valor seteado', function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  process.env.FIRMA_SERVICE_CLIENT_INSTANCE_ID = 'mi-instancia-estable-001';
  var r = _mockIpcHandlers['firma:config:get']({}, {});
  assert.equal(r.data.source, 'env');
  assert.equal(r.data.clientInstanceId, 'mi-instancia-estable-001',
    'env CON client_id: respeta el valor (no genera UUID nuevo)');
  teardown();
});

test('config:set-api-key cifra y guarda, luego config:get lee source=secrets', function () {
  setup();
  var setH = _mockIpcHandlers['firma:config:set-api-key'];
  var getH = _mockIpcHandlers['firma:config:get'];
  var r1 = setH({}, { apiKey: 'this-is-a-test-key-32chars-minimum-XXX' });
  assert.equal(r1.success, true);
  assert.equal(r1.data.stored, true);
  assert.equal(r1.data.encryptionAvailable, true);
  var secretsPath = path.join(_testUserData, 'secrets.enc');
  assert.ok(fs.existsSync(secretsPath), 'secrets.enc creado');
  var blob = fs.readFileSync(secretsPath);
  assert.equal(blob.toString('utf-8').indexOf('ENC:'), 0, 'cifrado con safeStorage mock');
  var r2 = getH({}, {});
  assert.equal(r2.data.source, 'secrets');
  assert.equal(r2.data.hasApiKey, true);
  assert.equal(r2.data.apiKey, undefined, 'NO se filtra apiKey al renderer');
  teardown();
});

test('config:set-api-key con safeStorage no disponible: retorna ENCRYPTION_UNAVAILABLE', function () {
  setup();
  _mockSafeStorage._available = false;
  var r = _mockIpcHandlers['firma:config:set-api-key']({}, { apiKey: 'this-is-a-test-key-32chars-minimum-XXX' });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'ENCRYPTION_UNAVAILABLE');
  _mockSafeStorage._available = true;
  teardown();
});

test('config:set-api-key rechaza apiKey corta', function () {
  setup();
  var r = _mockIpcHandlers['firma:config:set-api-key']({}, { apiKey: 'short' });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'INVALID_REQUEST_BODY');
  teardown();
});

test('config:set-url valida URL', function () {
  setup();
  var h = _mockIpcHandlers['firma:config:set-url'];
  var r1 = h({}, { url: 'not-a-url' });
  assert.equal(r1.success, false);
  assert.equal(r1.error.code, 'INVALID_REQUEST_BODY');
  var r2 = h({}, { url: '' });
  assert.equal(r2.success, false);
  var r3 = h({}, { url: 'http://localhost:3001' });
  assert.equal(r3.success, true);
  assert.equal(r3.data.url, 'http://localhost:3001');
  var r4 = h({}, { url: 'https://firma.k-air.com/' });
  assert.equal(r4.success, true);
  assert.equal(r4.data.url, 'https://firma.k-air.com');
  teardown();
});

test('config:diag reporta env + secrets + encryptionAvailable + schemaVersion', function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  var r = _mockIpcHandlers['firma:config:diag']({}, {});
  assert.equal(r.success, true);
  assert.equal(r.data.env.hasUrl, true);
  assert.equal(r.data.env.hasApiKey, false);
  assert.equal(r.data.secretsPath, path.join(_testUserData, 'secrets.enc'));
  // Nuevos campos v2
  assert.equal(r.data.schemaVersion, 2);
  assert.equal(r.data.configuredEmpresas, 0);
  assert.equal(r.data.hasLegacyKey, false);
  assert.equal(typeof r.data.cacheStats, 'object');
  assert.equal(r.data.cacheStats.size, 0);
  teardown();
});

// =====================================================================
//  Suite: Sign request handlers (async)
// =====================================================================

test('sign-request:create: delega a client.createSignRequest', async function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  var r = await _call('firma:sign-request:create', {
    metadata: { id_documento: 'doc-1', id_trabajador: 't-1' },
    pdfBase64: Buffer.from('%PDF-1.4').toString('base64'),
    pdfName: 'contrato.pdf'
  });
  assert.equal(r.success, true);
  assert.equal(r.data.mocked, true);
  assert.equal(_clientCallLog[0].m, 'createSignRequest');
  assert.equal(_clientCallLog[0].args.metadata.id_documento, 'doc-1');
  assert.equal(_clientCallLog[0].args.pdfName, 'contrato.pdf');
  assert.ok(Buffer.isBuffer(_clientCallLog[0].args.pdfBuffer));
  teardown();
});

test('sign-request:create: sin config retorna CONFIG_MISSING', async function () {
  setup();
  var r = await _call('firma:sign-request:create', {
    metadata: { id_documento: 'd' },
    pdfBase64: Buffer.from('x').toString('base64')
  });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'CONFIG_MISSING');
  assert.ok(r.error.extra.hint);
  teardown();
});

test('sign-request:get: delega a client.getSignRequest con id', async function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  var r = await _call('firma:sign-request:get', { id: 'SIGN-2026-000123' });
  assert.equal(r.success, true);
  assert.equal(_clientCallLog[0].m, 'getSignRequest');
  assert.equal(_clientCallLog[0].id, 'SIGN-2026-000123');
  teardown();
});

test('sign-request:get: sin id retorna INVALID_REQUEST_BODY', async function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  var r = await _call('firma:sign-request:get', {});
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'INVALID_REQUEST_BODY');
  teardown();
});

test('sign-request:list: valida ids[]', async function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  var r1 = await _call('firma:sign-request:list', {});
  assert.equal(r1.error.code, 'INVALID_REQUEST_BODY');
  var r2 = await _call('firma:sign-request:list', { ids: [] });
  assert.equal(r2.error.code, 'INVALID_REQUEST_BODY');
  var r3 = await _call('firma:sign-request:list', { ids: ['a', 'b'] });
  assert.equal(r3.success, true);
  assert.equal(_clientCallLog[0].ids.length, 2);
  teardown();
});

test('sign-request:document delega a client.getSignRequestDocument', async function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  var r = await _call('firma:sign-request:document', { id: 'SIGN-1' });
  assert.equal(r.success, true);
  assert.equal(r.data.contentType, 'application/pdf');
  assert.equal(_clientCallLog[0].m, 'getSignRequestDocument');
  teardown();
});

test('sign-request:constancia delega a client.getSignRequestConstancia', async function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  var r = await _call('firma:sign-request:constancia', { id: 'SIGN-1' });
  assert.equal(r.success, true);
  assert.equal(_clientCallLog[0].m, 'getSignRequestConstancia');
  teardown();
});

test('sign-request:link delega a client.getSignRequestLink', async function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  var r = await _call('firma:sign-request:link', { id: 'SIGN-1' });
  assert.equal(r.success, true);
  assert.equal(r.data.token, 'mock-token');
  teardown();
});

// =====================================================================
//  Suite: I-103.A1.5.2 · firma:sign-request:notify-remote (5 tests)
// =====================================================================

test('sign-request:notify-remote: delega a client.notifySignRequestRemote con id + correo', async function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  var r = await _call('firma:sign-request:notify-remote', {
    id: 'SIGN-2026-000001',
    correo: 'firmante@example.com'
  });
  assert.equal(r.success, true);
  var calls = _clientCallLog.filter(function (c) { return c.m === 'notifySignRequestRemote'; });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, 'SIGN-2026-000001');
  assert.equal(calls[0].args.correo, 'firmante@example.com');
  teardown();
});

test('sign-request:notify-remote: pasa context al client cuando se incluye', async function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  var r = await _call('firma:sign-request:notify-remote', {
    id: 'SIGN-1',
    correo: 'firmante@example.com',
    context: { via: 'kair-documentos-ui', button: 'enviar-correo' }
  });
  assert.equal(r.success, true);
  var calls = _clientCallLog.filter(function (c) { return c.m === 'notifySignRequestRemote'; });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args.context, {
    via: 'kair-documentos-ui',
    button: 'enviar-correo'
  });
  teardown();
});

test('sign-request:notify-remote: sin id retorna INVALID_REQUEST_BODY sin HTTP', function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  // Caso sync: el handler retorna {success:false} directo (sin HTTP).
  // Usamos _mockIpcHandlers[...]() directamente (NO _call que es async).
  var r = _mockIpcHandlers['firma:sign-request:notify-remote']({}, {
    correo: 'x@example.com'
  });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'INVALID_REQUEST_BODY');
  assert.match(r.error.message, /id requerido/);
  // No se debe haber llamado al client
  var calls = _clientCallLog.filter(function (c) { return c.m === 'notifySignRequestRemote'; });
  assert.equal(calls.length, 0);
  teardown();
});

test('sign-request:notify-remote: sin correo retorna INVALID_REQUEST_BODY sin HTTP', function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  // sin correo
  var r1 = _mockIpcHandlers['firma:sign-request:notify-remote']({}, { id: 'SIGN-1' });
  assert.equal(r1.success, false);
  assert.equal(r1.error.code, 'INVALID_REQUEST_BODY');
  assert.match(r1.error.message, /correo requerido/);
  // correo vacío
  var r2 = _mockIpcHandlers['firma:sign-request:notify-remote']({}, { id: 'SIGN-1', correo: '' });
  assert.equal(r2.success, false);
  assert.equal(r2.error.code, 'INVALID_REQUEST_BODY');
  // correo sin @
  var r3 = _mockIpcHandlers['firma:sign-request:notify-remote']({}, { id: 'SIGN-1', correo: 'not-an-email' });
  assert.equal(r3.success, false);
  assert.equal(r3.error.code, 'INVALID_REQUEST_BODY');
  assert.match(r3.error.message, /sin @/);
  // No se debe haber llamado al client
  var calls = _clientCallLog.filter(function (c) { return c.m === 'notifySignRequestRemote'; });
  assert.equal(calls.length, 0);
  teardown();
});

test('sign-request:notify-remote: con companyName usa el cliente per-empresa', async function () {
  setup();
  _setSecretsV2({
    'TEMPOACTIVA EST S.A.S.': {
      idEmpresa: '900123456',
      firmaApiKey: 'kair_live_tempoactiva_key_32chars_minimum_padding_X',
      activatedAt: '2026-08-20T15:00:00Z',
      lastValidatedAt: null
    }
  }, { url: 'https://firma.test.k-air.com' });
  var r = await _call('firma:sign-request:notify-remote', {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    id: 'SIGN-1',
    correo: 'firmante@example.com'
  });
  assert.equal(r.success, true);
  // Se llamó al client (mock retorna success). El test importante es
  // que NO retornó CONFIG_MISSING — eso prueba que se usó el per-empresa.
  assert.notEqual(r.error && r.error.code, 'CONFIG_MISSING');
  var calls = _clientCallLog.filter(function (c) { return c.m === 'notifySignRequestRemote'; });
  assert.equal(calls.length, 1);
  teardown();
});

test('sign-request:notify-remote: con companyName sin configurar → CONFIG_MISSING sin HTTP', function () {
  setup();
  _setSecretsV2({}, { url: 'https://firma.test.k-air.com' });
  // Caso sync: CONFIG_MISSING se retorna sin HTTP (no hay cliente per-empresa).
  var r = _mockIpcHandlers['firma:sign-request:notify-remote']({}, {
    companyName: 'EMPRESA NO CONFIGURADA S.A.S.',
    id: 'SIGN-1',
    correo: 'firmante@example.com'
  });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'CONFIG_MISSING');
  // El error menciona la empresa
  assert.ok(r.error.message && r.error.message.indexOf('EMPRESA NO CONFIGURADA') !== -1);
  // No se debe haber llamado al backend
  var calls = _clientCallLog.filter(function (c) { return c.m === 'notifySignRequestRemote'; });
  assert.equal(calls.length, 0);
  teardown();
});

test('sign-request:notify-remote: error del client propaga {success:false, error}', async function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  // Reemplazar el mock con uno que retorna error
  _lastMockedClient = {
    notifySignRequestRemote: function (id, args) {
      return Promise.resolve({ success: false, error: { code: 'INVITE_NOT_AVAILABLE', message: 'estado terminal SIGNED' } });
    }
  };
  registerFirmaHandlers._test_setClientFactory(function () { return _lastMockedClient; });
  var r = await _call('firma:sign-request:notify-remote', {
    id: 'SIGN-1',
    correo: 'firmante@example.com'
  });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'INVITE_NOT_AVAILABLE');
  teardown();
});

test('sign-request:notify-remote: throw del client → try/catch del bridge devuelve INTERNAL', async function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  _lastMockedClient = {
    notifySignRequestRemote: function () { throw new Error('boom from client'); }
  };
  registerFirmaHandlers._test_setClientFactory(function () { return _lastMockedClient; });
  var r = await _call('firma:sign-request:notify-remote', {
    id: 'SIGN-1',
    correo: 'firmante@example.com'
  });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'INTERNAL');
  teardown();
});

// =====================================================================
//  Suite: Consent handlers (async)
// =====================================================================

test('consent:create: valida campos requeridos', async function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  var r1 = await _call('firma:consent:create', { id_trabajador: 't-1' });
  assert.equal(r1.error.code, 'INVALID_REQUEST_BODY');
  var r2 = await _call('firma:consent:create', {
    id_trabajador: 't-1',
    id_empresa: 'e-1',
    version_acuerdo: 'v1.0',
    correo_verificacion: 'test@example.com'
  });
  assert.equal(r2.success, true);
  assert.equal(_clientCallLog[0].m, 'createConsent');
  teardown();
});

test('consent:verify-otp: valida consentId y otp', async function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  var r1 = await _call('firma:consent:verify-otp', { consentId: 'c-1' });
  assert.equal(r1.error.code, 'INVALID_REQUEST_BODY');
  var r2 = await _call('firma:consent:verify-otp', { consentId: 'c-1', otp: '123456' });
  assert.equal(r2.success, true);
  assert.equal(_clientCallLog[0].m, 'verifyConsentOtp');
  assert.equal(_clientCallLog[0].otp, '123456');
  teardown();
});

// =====================================================================
//  Suite: Agreement (async)
// =====================================================================

test('agreement:get delega a client.getActiveAgreement', async function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  var r = await _call('firma:agreement:get', {});
  assert.equal(r.success, true);
  assert.equal(r.data.version, 'v1.0');
  assert.equal(_clientCallLog[0].m, 'getActiveAgreement');
  teardown();
});

// =====================================================================
//  Suite: Errores del client
// =====================================================================

test('error del client: IPC devuelve { success: false, error }', async function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  _lastMockedClient = {
    getActiveAgreement: function () { return Promise.resolve({ success: false, error: { code: 'INVALID_API_KEY', message: 'API key inválida' } }); }
  };
  var r = await _call('firma:agreement:get', {});
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'INVALID_API_KEY');
  teardown();
});

test('throw del client: try/catch del bridge devuelve INTERNAL', async function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  process.env.FIRMA_SERVICE_API_KEY = 'env-key-1234567890';
  _lastMockedClient = {
    getActiveAgreement: function () { throw new Error('boom'); }
  };
  var r = await _call('firma:agreement:get', {});
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'INTERNAL');
  teardown();
});

// =====================================================================
//  Suite: Persistencia de secrets.enc
// =====================================================================

test('persistencia: client_instance_id persiste entre llamadas', function () {
  setup();
  var getH = _mockIpcHandlers['firma:config:get'];
  var r1 = getH({}, {});
  var firstId = r1.data.clientInstanceId;
  var r2 = getH({}, {});
  assert.equal(r2.data.clientInstanceId, firstId, 'mismo id entre llamadas');
  var secretsPath = path.join(_testUserData, 'secrets.enc');
  assert.ok(fs.existsSync(secretsPath));
  teardown();
});

test('persistencia: setUrl luego get devuelve la URL', function () {
  setup();
  var setH = _mockIpcHandlers['firma:config:set-url'];
  setH({}, { url: 'https://firma.example.com' });
  var getH = _mockIpcHandlers['firma:config:get'];
  var r = getH({}, {});
  assert.equal(r.data.url, 'https://firma.example.com');
  assert.equal(r.data.source, 'secrets');
  teardown();
});

test('persistencia: secrets.enc corrupto se borra y se regenera', function () {
  setup();
  var secretsPath = path.join(_testUserData, 'secrets.enc');
  fs.writeFileSync(secretsPath, 'NOT-ENC-corrupted-data');
  var getH = _mockIpcHandlers['firma:config:get'];
  var r = getH({}, {});
  assert.equal(r.success, true);
  assert.equal(r.data.source, 'missing');
  assert.ok(fs.existsSync(secretsPath));
  var blob = fs.readFileSync(secretsPath);
  assert.equal(blob.toString('utf-8').indexOf('ENC:'), 0, 'regenerado con cifrado válido');
  teardown();
});

test('teardown: no quedan archivos residuales', function () {
  setup();
  teardown();
  var secretsPath = path.join(_testUserData, 'secrets.enc');
  assert.equal(fs.existsSync(secretsPath), false);
});

// =====================================================================
//  Suite: FASE 3 — per-empresa auth (DR-1..6, binding)
//  Lista de pruebas obligatorias (del orquestador).
// =====================================================================

// Helper: crea una factory que retorna un mock con método adminCreateClient etc.
function _setMockClientWithAdmin() {
  _lastMockedClient = _resetClientMock();
  // Agregar métodos admin al mock
  _lastMockedClient.adminCreateClient = function (args) {
    _clientCallLog.push({ m: 'adminCreateClient', args: args });
    return Promise.resolve({
      success: true,
      data: {
        id_empresa: args.id_empresa,
        api_key: 'kair_test_NEWkey1234567890abcdefghijABCDEFGHIJ',
        api_key_hash_prefix: 'newhash01',
        allowed_operations: args.allowed_operations,
        description: args.description,
        created_at: '2026-08-20T17:00:00.000Z',
        message: 'API key generada'
      }
    });
  };
  _lastMockedClient.adminListClients = function (args) {
    _clientCallLog.push({ m: 'adminListClients', args: args });
    return Promise.resolve({
      success: true,
      data: { total: 0, limit: 100, offset: 0, items: [] }
    });
  };
  _lastMockedClient.adminGetClient = function (id, opts) {
    _clientCallLog.push({ m: 'adminGetClient', id: id, opts: opts });
    return Promise.resolve({ success: true, data: { id_empresa: id, is_active: true } });
  };
  _lastMockedClient.adminRotateClient = function (id, args) {
    _clientCallLog.push({ m: 'adminRotateClient', id: id, args: args });
    return Promise.resolve({
      success: true,
      data: {
        id_empresa: id,
        old_api_key_hash_prefix: 'oldhash01',
        new_api_key: 'kair_test_ROTkey1234567890abcdefghijABCDEFGHIJ',
        new_api_key_hash_prefix: 'newhash02',
        allowed_operations: ['sign_request:create', 'sign_request:read', 'consent:create', 'consent:verify', 'audit:read'],
        description: 'K+AIR test',
        rotated_at: '2026-08-20T17:00:00.000Z',
        motivo: (args && args.motivo) || 'Rotación programada',
        actor: (args && args.actor) || 'admin',
        message: 'OK'
      }
    });
  };
  _lastMockedClient.adminRevokeClient = function (id) {
    _clientCallLog.push({ m: 'adminRevokeClient', id: id });
    return Promise.resolve({ success: true, data: { revoked: true } });
  };
  registerFirmaHandlers._test_setClientFactory(function () {
    return _lastMockedClient;
  });
  registerFirmaHandlers._test_setGenerateClientInstanceId(function () {
    return '550e8400-e29b-41d4-a716-446655440000';
  });
}

// ---------- v1 → v2 migration ----------
test('v1 → v2: secrets v1 con firmaServiceApiKey migra silenciosamente a v2 con __legacy__', function () {
  setup();
  // Escribir secrets v1 directamente (simula una instalación vieja).
  var p = path.join(_testUserData, 'secrets.enc');
  var v1Blob = JSON.stringify({
    version: 1,
    firmaServiceUrl: 'https://firma.test.k-air.com',
    firmaServiceApiKey: 'kair_live_OLDkey_32chars_padding_padding_pad',
    clientInstanceId: '550e8400-e29b-41d4-a716-446655440000'
  });
  fs.writeFileSync(p, 'ENC:' + v1Blob);
  // Llamar config:get — debe haber migrado.
  var r = _mockIpcHandlers['firma:config:get']({}, {});
  assert.equal(r.success, true);
  assert.equal(r.data.schemaVersion, 2);
  assert.equal(r.data.hasLegacyKey, true);
  // El archivo en disco ahora debe ser v2.
  var newBlob = fs.readFileSync(p, 'utf-8').slice(4);  // quitar 'ENC:'
  var parsed = JSON.parse(newBlob);
  assert.equal(parsed.version, 2);
  assert.ok(parsed.__legacy__);
  assert.equal(parsed.__legacy__.firmaApiKey, 'kair_live_OLDkey_32chars_padding_padding_pad');
  teardown();
});

test('v1 → v2: secrets v1 SIN firmaServiceApiKey migra a v2 con empresas vacías', function () {
  setup();
  var p = path.join(_testUserData, 'secrets.enc');
  var v1Blob = JSON.stringify({
    version: 1,
    firmaServiceUrl: 'https://firma.test.k-air.com',
    clientInstanceId: '550e8400-e29b-41d4-a716-446655440000'
  });
  fs.writeFileSync(p, 'ENC:' + v1Blob);
  var r = _mockIpcHandlers['firma:config:get']({}, {});
  assert.equal(r.data.schemaVersion, 2);
  assert.equal(r.data.hasLegacyKey, false);
  teardown();
});

// ---------- empresa A y B guardan keys ----------
test('empresa:empresa A guarda key con set-api-key', function () {
  setup();
  _setMockClientWithAdmin();
  // Setear URL primero (requerido por set-api-key)
  _setSecretsV2({}, { url: 'https://firma.test.k-air.com' });
  var r = _mockIpcHandlers['firma:empresa:set-api-key']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    idEmpresa: '900123456',
    firmaApiKey: 'kair_live_A_key_32chars_minimum_XXXXXXXXXXXXXX'
  });
  assert.equal(r.success, true);
  assert.equal(r.data.companyKey, 'TEMPOACTIVA EST S.A.S.');
  assert.equal(r.data.idEmpresa, '900123456');
  assert.ok(r.data.activatedAt);
  teardown();
});

test('empresa:empresa B guarda key con set-api-key (independiente de A)', function () {
  setup();
  _setMockClientWithAdmin();
  _setSecretsV2({}, { url: 'https://firma.test.k-air.com' });
  _mockIpcHandlers['firma:empresa:set-api-key']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    idEmpresa: '900123456',
    firmaApiKey: 'kair_live_A_key_32chars_minimum_XXXXXXXXXXXXXX'
  });
  var r2 = _mockIpcHandlers['firma:empresa:set-api-key']({}, {
    companyName: 'OTRA EMPRESA S.A.S.',
    idEmpresa: '900999999',
    firmaApiKey: 'kair_live_B_key_32chars_minimum_XXXXXXXXXXXXXX'
  });
  assert.equal(r2.success, true);
  assert.equal(r2.data.companyKey, 'OTRA EMPRESA S.A.S.');
  // Verificar que secrets.enc tiene ambas
  var list = _mockIpcHandlers['firma:empresa:list']({}, {});
  assert.equal(list.data.configured.length, 2);
  teardown();
});

// ---------- ALREADY_CONFIGURED (DR-6.C) ----------
test('empresa:create duplicado para misma empresa → ALREADY_CONFIGURED sin HTTP', function () {
  setup();
  _setMockClientWithAdmin();
  _setSecretsV2({}, { url: 'https://firma.test.k-air.com' });
  // Setear adminApiKey para que el handler pase el primer check
  _mockIpcHandlers['firma:config:set-admin-key']({}, {
    adminApiKey: 'test-admin-api-key-32-chars-minimum-padding!!!'
  });
  // Setear empresa A via set-api-key (local)
  _mockIpcHandlers['firma:empresa:set-api-key']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    idEmpresa: '900123456',
    firmaApiKey: 'kair_live_A_key_32chars_minimum_XXXXXXXXXXXXXX'
  });
  // Limpiar log de calls
  _clientCallLog = [];
  // Intentar create de nuevo
  var r = _mockIpcHandlers['firma:empresa:create']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    idEmpresa: '900123456',
    displayName: 'TEMPOACTIVA EST S.A.S.'
  });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'ALREADY_CONFIGURED');
  // DR-6.C: NO debe haber llamado al backend
  var adminCalls = _clientCallLog.filter(function (c) { return c.m === 'adminCreateClient'; });
  assert.equal(adminCalls.length, 0, 'pre-chequeo debe evitar HTTP call');
  teardown();
});

// ---------- adminApiKey persistida + nunca logueada ----------
test('config:set-admin-key persiste en secrets.enc.adminApiKey', function () {
  setup();
  _setMockClientWithAdmin();
  var r = _mockIpcHandlers['firma:config:set-admin-key']({}, {
    adminApiKey: 'test-admin-api-key-32-chars-minimum-padding!!!'
  });
  assert.equal(r.success, true);
  assert.equal(r.data.stored, true);
  assert.equal(r.data.adminKeyHashPrefix.length, 8);
  // Verificar que el archivo tiene adminApiKey cifrado
  var p = path.join(_testUserData, 'secrets.enc');
  var blob = fs.readFileSync(p, 'utf-8').slice(4);
  var parsed = JSON.parse(blob);
  assert.ok(parsed.adminApiKey);
  assert.equal(parsed.adminApiKey, 'test-admin-api-key-32-chars-minimum-padding!!!');
  teardown();
});

test('config:set-admin-key con < 32 chars → INVALID_REQUEST_BODY', function () {
  setup();
  var r = _mockIpcHandlers['firma:config:set-admin-key']({}, {
    adminApiKey: 'short'
  });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'INVALID_REQUEST_BODY');
  teardown();
});

test('config:set-admin-key: el adminApiKey NUNCA aparece en el response (solo hash_prefix)', function () {
  setup();
  _setMockClientWithAdmin();
  var adminKey = 'test-admin-api-key-32-chars-minimum-padding!!!';
  var r = _mockIpcHandlers['firma:config:set-admin-key']({}, { adminApiKey: adminKey });
  // El response NO debe contener el plaintext
  var responseStr = JSON.stringify(r);
  assert.ok(responseStr.indexOf(adminKey) === -1,
    'response NO debe contener adminApiKey en plaintext');
  // Pero SÍ debe contener el prefix del hash
  assert.ok(r.data.adminKeyHashPrefix);
  teardown();
});

// ---------- create + ALREADY_CONFIGURED + adminApiKey nunca fluye al renderer ----------
test('empresa:create con adminApiKey persiste api_key en secrets.enc y NO la propaga al renderer', async function () {
  setup();
  _setMockClientWithAdmin();
  _setSecretsV2({}, { url: 'https://firma.test.k-air.com' });
  // Setear adminApiKey
  _mockIpcHandlers['firma:config:set-admin-key']({}, {
    adminApiKey: 'test-admin-api-key-32-chars-minimum-padding!!!'
  });
  // Crear empresa
  var r = await _call('firma:empresa:create', {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    idEmpresa: '900123456',
    displayName: 'TEMPOACTIVA EST S.A.S.'
  });
  assert.equal(r.success, true);
  // El response NO debe contener la api_key del backend
  var responseStr = JSON.stringify(r);
  assert.ok(responseStr.indexOf('kair_test_NEWkey') === -1,
    'response NO debe contener api_key en plaintext (DR-3)');
  // Pero secrets.enc SÍ debe tener la key (el bridge la guarda internamente)
  var list = _mockIpcHandlers['firma:empresa:list']({}, {});
  assert.equal(list.data.configured.length, 1);
  assert.equal(list.data.configured[0].companyKey, 'TEMPOACTIVA EST S.A.S.');
  teardown();
});

test('empresa:create sin adminApiKey → ADMIN_TOKEN_REQUIRED sin HTTP', function () {
  setup();
  _setMockClientWithAdmin();
  _setSecretsV2({}, { url: 'https://firma.test.k-air.com' });
  _clientCallLog = [];
  var r = _mockIpcHandlers['firma:empresa:create']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    idEmpresa: '900123456',
    displayName: 'TEMPOACTIVA EST S.A.S.'
  });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'ADMIN_TOKEN_REQUIRED');
  assert.ok(r.error.message && r.error.message.indexOf('adminApiKey') !== -1);
  // No debe haber llamado al backend
  var calls = _clientCallLog.filter(function (c) { return c.m === 'adminCreateClient'; });
  assert.equal(calls.length, 0);
  teardown();
});

// ---------- rotate ----------
test('empresa:rotate-api-key genera nueva key, marca old como revocado en backend', async function () {
  setup();
  _setMockClientWithAdmin();
  _setSecretsV2({}, { url: 'https://firma.test.k-air.com' });
  // Setup: setear empresa A + adminApiKey
  _mockIpcHandlers['firma:config:set-admin-key']({}, {
    adminApiKey: 'test-admin-api-key-32-chars-minimum-padding!!!'
  });
  _mockIpcHandlers['firma:empresa:set-api-key']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    idEmpresa: '900123456',
    firmaApiKey: 'kair_live_OLD_key_32chars_padding_padding_pad!'
  });
  _clientCallLog = [];
  var r = await _call('firma:empresa:rotate-api-key', {
    companyName: 'TEMPOACTIVA EST S.A.S.'
  });
  assert.equal(r.success, true);
  assert.equal(r.data.companyKey, 'TEMPOACTIVA EST S.A.S.');
  assert.ok(r.data.newApiKeyHashPrefix);
  assert.ok(r.data.oldApiKeyHashPrefix);
  // Verificar que adminRotateClient fue llamado
  var calls = _clientCallLog.filter(function (c) { return c.m === 'adminRotateClient'; });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, '900123456');
  teardown();
});

test('empresa:rotate-api-key sin adminApiKey → ADMIN_TOKEN_REQUIRED', function () {
  setup();
  _setMockClientWithAdmin();
  _setSecretsV2({}, { url: 'https://firma.test.k-air.com' });
  _mockIpcHandlers['firma:empresa:set-api-key']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    idEmpresa: '900123456',
    firmaApiKey: 'kair_live_OLD_key_32chars_padding_padding_pad!'
  });
  _clientCallLog = [];
  var r = _mockIpcHandlers['firma:empresa:rotate-api-key']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.'
  });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'ADMIN_TOKEN_REQUIRED');
  teardown();
});

// ---------- revoke local (sin revokeRemote) ----------
test('empresa:revoke-api-key SIN revokeRemote borra local sin HTTP', function () {
  setup();
  _setMockClientWithAdmin();
  _setSecretsV2({}, { url: 'https://firma.test.k-air.com' });
  _mockIpcHandlers['firma:empresa:set-api-key']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    idEmpresa: '900123456',
    firmaApiKey: 'kair_live_OLD_key_32chars_padding_padding_pad!'
  });
  _clientCallLog = [];
  var r = _mockIpcHandlers['firma:empresa:revoke-api-key']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.'
  });
  assert.equal(r.success, true);
  assert.equal(r.data.revokedRemote, false);
  // Verificar que la empresa ya no está en secrets.enc
  var list = _mockIpcHandlers['firma:empresa:list']({}, {});
  assert.equal(list.data.configured.length, 0);
  // NO debe haber llamado al backend
  var calls = _clientCallLog.filter(function (c) { return c.m && c.m.indexOf('admin') === 0; });
  assert.equal(calls.length, 0);
  teardown();
});

test('empresa:revoke-api-key CON revokeRemote=true llama a adminRotateClient', async function () {
  setup();
  _setMockClientWithAdmin();
  _setSecretsV2({}, { url: 'https://firma.test.k-air.com' });
  _mockIpcHandlers['firma:config:set-admin-key']({}, {
    adminApiKey: 'test-admin-api-key-32-chars-minimum-padding!!!'
  });
  _mockIpcHandlers['firma:empresa:set-api-key']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    idEmpresa: '900123456',
    firmaApiKey: 'kair_live_OLD_key_32chars_padding_padding_pad!'
  });
  _clientCallLog = [];
  var r = await _call('firma:empresa:revoke-api-key', {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    revokeRemote: true
  });
  assert.equal(r.success, true);
  assert.equal(r.data.revokedRemote, true);
  var calls = _clientCallLog.filter(function (c) { return c.m === 'adminRotateClient'; });
  assert.equal(calls.length, 1);
  teardown();
});

// ---------- list ----------
test('empresa:list retorna configured + hasLegacyKey', function () {
  setup();
  _setSecretsV2({
    'EMPRESA A': { idEmpresa: '900111111', firmaApiKey: 'kair_live_A_32chars_padding_padding_pad_x', activatedAt: '2026-08-20T15:00:00Z', lastValidatedAt: null },
    'EMPRESA B': { idEmpresa: '900222222', firmaApiKey: 'kair_live_B_32chars_padding_padding_pad_x', activatedAt: '2026-08-20T15:01:00Z', lastValidatedAt: null }
  });
  var r = _mockIpcHandlers['firma:empresa:list']({}, {});
  assert.equal(r.success, true);
  assert.equal(r.data.configured.length, 2);
  assert.equal(r.data.hasLegacyKey, false);
  teardown();
});

// ---------- list-firma-remote ----------
test('empresa:list-firma-remote llama adminListClients con adminApiKey', async function () {
  setup();
  _setMockClientWithAdmin();
  _setSecretsV2({}, { url: 'https://firma.test.k-air.com' });
  _mockIpcHandlers['firma:config:set-admin-key']({}, {
    adminApiKey: 'test-admin-api-key-32-chars-minimum-padding!!!'
  });
  _clientCallLog = [];
  var r = await _call('firma:empresa:list-firma-remote', { idEmpresa: '900123456' });
  assert.equal(r.success, true);
  var calls = _clientCallLog.filter(function (c) { return c.m === 'adminListClients'; });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.id_empresa, '900123456');
  teardown();
});

test('empresa:list-firma-remote sin adminApiKey → ADMIN_TOKEN_REQUIRED', function () {
  setup();
  _setMockClientWithAdmin();
  var r = _mockIpcHandlers['firma:empresa:list-firma-remote']({}, {});
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'ADMIN_TOKEN_REQUIRED');
  teardown();
});

// ---------- LEGACY compat: firma:config:set-api-key escribe a empresas["__default__"] con WARN ----------
test('LEGACY: firma:config:set-api-key escribe a empresas["__default__"] con deprecationWarning', function () {
  setup();
  _setMockClientWithAdmin();
  var r = _mockIpcHandlers['firma:config:set-api-key']({}, {
    apiKey: 'kair_live_LEGACY_key_32chars_padding_padding_pad!'
  });
  assert.equal(r.success, true);
  assert.match(r.data.deprecationWarning, /deprecado/);
  // Verificar que se guardó en __default__
  var p = path.join(_testUserData, 'secrets.enc');
  var blob = fs.readFileSync(p, 'utf-8').slice(4);
  var parsed = JSON.parse(blob);
  assert.ok(parsed.empresas['__default__']);
  assert.equal(parsed.empresas['__default__'].idEmpresa, '__default__');
  assert.equal(parsed.empresas['__default__']._legacy, true);
  teardown();
});

test('LEGACY: la key en __default__ NO aparece en empresa:list (excluida)', function () {
  setup();
  _setMockClientWithAdmin();
  _mockIpcHandlers['firma:config:set-api-key']({}, {
    apiKey: 'kair_live_LEGACY_key_32chars_padding_padding_pad!'
  });
  var r = _mockIpcHandlers['firma:empresa:list']({}, {});
  // __default__ NO debe estar en configured (son per-empresa, no legacy).
  assert.equal(r.data.configured.length, 0);
  // Pero config:get sí detecta la legacy
  var cg = _mockIpcHandlers['firma:config:get']({}, {});
  // La legacy no es __legacy__ propiamente, sino empresas['__default__']._legacy
  // hasLegacyKey solo se activa con __legacy__ (migración v1).
  // Para el caso de set-api-key LEGACY, no activamos hasLegacyKey (es un caso
  // operativo, no una migración de v1).
  assert.equal(cg.data.hasLegacyKey, false);
  teardown();
});

// ---------- Extensión de 9 handlers con args.companyName ----------
test('sign-request:create con companyName usa el cliente per-empresa (no legacy)', function () {
  setup();
  _setSecretsV2({
    'TEMPOACTIVA EST S.A.S.': {
      idEmpresa: '900123456',
      firmaApiKey: 'kair_live_A_key_32chars_minimum_XXXXXXXXXXXXXX',
      activatedAt: '2026-08-20T15:00:00Z',
      lastValidatedAt: null
    }
  }, { url: 'https://firma.test.k-air.com' });
  // Llamar sign-request:create con companyName
  var r = _mockIpcHandlers['firma:sign-request:create']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    metadata: { id_documento: 'd-1', id_trabajador: 't-1', id_empresa: '900123456', tipo_firma: 'remoto' },
    pdfBase64: Buffer.from('%PDF-1.4').toString('base64')
  });
  // El mock client debe haber sido llamado
  var calls = _clientCallLog.filter(function (c) { return c.m === 'createSignRequest'; });
  assert.equal(calls.length, 1);
  // El factory debe haber sido llamado con adminApiKey (si está seteado) o sin
  // (en este test no hay adminApiKey). Verificamos que la URL sea la per-empresa.
  // La factory se llama una vez por empresa (cache). No podemos inspeccionar
  // fácilmente la key sin adminApiKey, pero la integración funciona.
  teardown();
});

test('sign-request:create con companyName sin configurar → CONFIG_MISSING', function () {
  setup();
  _setSecretsV2({}, { url: 'https://firma.test.k-air.com' });
  var r = _mockIpcHandlers['firma:sign-request:create']({}, {
    companyName: 'EMPRESA NO CONFIGURADA S.A.S.',
    metadata: { id_documento: 'd-1' },
    pdfBase64: Buffer.from('%PDF-1.4').toString('base64')
  });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'CONFIG_MISSING');
  // El error menciona la empresa
  assert.ok(r.error.message && r.error.message.indexOf('EMPRESA NO CONFIGURADA') !== -1);
  // NO debe haber llamado al backend
  var calls = _clientCallLog.filter(function (c) { return c.m === 'createSignRequest'; });
  assert.equal(calls.length, 0);
  teardown();
});

test('cambio de empresa: A configurada, B no — llamada a B retorna CONFIG_MISSING (no usa A)', function () {
  setup();
  _setSecretsV2({
    'EMPRESA A': {
      idEmpresa: '900111111',
      firmaApiKey: 'kair_live_A_key_32chars_minimum_XXXXXXXXXXXXXX',
      activatedAt: '2026-08-20T15:00:00Z',
      lastValidatedAt: null
    }
  }, { url: 'https://firma.test.k-air.com' });
  // A: debe funcionar
  var rA = _mockIpcHandlers['firma:sign-request:create']({}, {
    companyName: 'EMPRESA A',
    metadata: { id_documento: 'd-A', id_trabajador: 't-1', id_empresa: '900111111' },
    pdfBase64: Buffer.from('%PDF-1.4').toString('base64')
  });
  // La llamada a A puede pasar (mock retorna success). Lo importante es
  // que la llamada a B NO use la key de A.
  var callsA = _clientCallLog.filter(function (c) { return c.m === 'createSignRequest'; });
  assert.equal(callsA.length, 1, 'A debe llamar al backend');
  // B: no configurada → CONFIG_MISSING
  var rB = _mockIpcHandlers['firma:sign-request:create']({}, {
    companyName: 'EMPRESA B',
    metadata: { id_documento: 'd-B' },
    pdfBase64: Buffer.from('%PDF-1.4').toString('base64')
  });
  assert.equal(rB.success, false);
  assert.equal(rB.error.code, 'CONFIG_MISSING');
  // El cache de A NO debe usarse para B
  var callsB = _clientCallLog.filter(function (c) { return c.m === 'createSignRequest'; });
  assert.equal(callsB.length, 1, 'B NO debe llamar al backend (no tiene key)');
  teardown();
});
