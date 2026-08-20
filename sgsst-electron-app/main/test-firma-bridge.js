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

// Helper: invoca un handler async y espera el resultado
async function _call(channel, payload) {
  var h = _mockIpcHandlers[channel];
  if (!h) throw new Error('Handler no registrado: ' + channel);
  return await h({}, payload || {});
}

// =====================================================================
//  Suite: Registro de handlers
// =====================================================================

test('registro: 13 canales firma:* están registrados', function () {
  setup();
  var expected = [
    'firma:config:get',
    'firma:config:set-api-key',
    'firma:config:set-url',
    'firma:config:diag',
    'firma:sign-request:create',
    'firma:sign-request:get',
    'firma:sign-request:list',
    'firma:sign-request:document',
    'firma:sign-request:constancia',
    'firma:sign-request:link',
    'firma:consent:create',
    'firma:consent:verify-otp',
    'firma:agreement:get'
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

test('config:diag reporta env + secrets + encryptionAvailable', function () {
  setup();
  process.env.FIRMA_SERVICE_URL = 'http://localhost:3001';
  var r = _mockIpcHandlers['firma:config:diag']({}, {});
  assert.equal(r.success, true);
  assert.equal(r.data.env.hasUrl, true);
  assert.equal(r.data.env.hasApiKey, false);
  assert.equal(r.data.secretsPath, path.join(_testUserData, 'secrets.enc'));
  assert.equal(r.data.version, '1.0.0');
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
