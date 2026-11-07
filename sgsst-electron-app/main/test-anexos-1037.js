// =====================================================================
// 📦1037 — Tests de los anexos en la app de escritorio
// Ejecutar: node --test main/test-anexos-1037.js
//
// DOS SUITES:
//
//   1. EL CLIENTE HTTP (main/firma-client.js) — los metodos de los anexos.
//   2. EL BRIDGE (main/firma-bridge.js) — los 11 canales IPC nuevos.
//
// Lo que se protege aqui, en orden de importancia:
//
//   - La CONTRAFIRMA es un acto de K+AIR: solo se puede hacer con la admin
//     key, y las tres rutas que exigen motivo (anular, verificar-representante
//     y contrafirmar) NO se pueden llamar sin `X-Admin-Motivo`.
//   - El estado que ve el CLIENTE va con la API key DE LA EMPRESA, no con la
//     admin key: el cliente no puede leer los anexos de otra empresa.
//   - `firma:config:admin-diag` dice SI hay admin key, nunca el valor.
//
// Patrón del mock de 'electron': el mismo de main/test-firma-bridge.js.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Module = require('module');

// =====================================================================
//  SUITE 1 · EL CLIENTE HTTP
// =====================================================================

const fc = require('./firma-client');

const BASE_URL = 'http://firma.test.local:3001';
const API_KEY = 'test-api-key-32chars-minimum-len-XXXXX';
const ADMIN_API_KEY = 'test-admin-key-32-chars-minimum-padd!!';
const CLIENT_INSTANCE_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeResponse(status, body, contentType) {
  var headers = new Map();
  if (contentType) headers.set('content-type', contentType);
  return {
    status: status,
    headers: {
      get: function (name) { return headers.get(String(name).toLowerCase()) || null; }
    },
    json: function () { return Promise.resolve(body); },
    arrayBuffer: function () { return Promise.resolve(Buffer.from(JSON.stringify(body))); }
  };
}

function makeFetchMock(responder) {
  var calls = [];
  function mockFetch(url, opts) {
    calls.push({ url: url, opts: opts });
    return Promise.resolve(responder(calls[calls.length - 1]));
  }
  mockFetch.calls = calls;
  return mockFetch;
}

function makeAdminClient(overrides) {
  overrides = overrides || {};
  return fc.createFirmaClient({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    adminApiKey: ADMIN_API_KEY,
    clientInstanceId: CLIENT_INSTANCE_ID,
    appVersion: '0.1.190-test',
    _fetch: overrides._fetch || globalThis.fetch,
    _sleep: overrides._sleep || (function () { return Promise.resolve(); })
  });
}

function _jsonOk(cuerpo) {
  return makeResponse(200, cuerpo || { ok: true }, 'application/json');
}

// ── El estado del cliente ───────────────────────────────────────────

test('anexos · getEmpresaAnexos pega a GET /internal/empresa/anexos con la key de la empresa', async function () {
  var fetchMock = makeFetchMock(function () { return _jsonOk({ id_empresa: '900829731' }); });
  var client = fc.createFirmaClient({
    baseUrl: BASE_URL, apiKey: API_KEY, clientInstanceId: CLIENT_INSTANCE_ID,
    appVersion: '0.1.190-test', _fetch: fetchMock, _sleep: function () { return Promise.resolve(); }
  });
  var r = await client.getEmpresaAnexos();
  assert.equal(r.success, true);
  assert.equal(fetchMock.calls.length, 1);
  assert.equal(fetchMock.calls[0].url, BASE_URL + '/internal/empresa/anexos');
  assert.equal(fetchMock.calls[0].opts.method, 'GET');
  // La key del CLIENTE: la de la Empresa, NO la admin.
  assert.equal(fetchMock.calls[0].opts.headers['X-Internal-API-Key'], API_KEY);
  assert.equal(fetchMock.calls[0].opts.headers['X-Admin-API-Key'], undefined,
    'el estado del cliente NO va con la admin key');
});

// ── El listado de empresas (operador) ───────────────────────────────

test('anexos · adminListEmpresas pega a GET /internal/admin/empresas con la admin key', async function () {
  var fetchMock = makeFetchMock(function () { return _jsonOk({ items: [] }); });
  var client = makeAdminClient({ _fetch: fetchMock });
  var r = await client.adminListEmpresas();
  assert.equal(r.success, true);
  assert.equal(fetchMock.calls[0].url, BASE_URL + '/internal/admin/empresas');
  assert.equal(fetchMock.calls[0].opts.headers['X-Admin-API-Key'], ADMIN_API_KEY);
  assert.equal(fetchMock.calls[0].opts.headers['X-Internal-API-Key'], undefined,
    'una ruta admin no lleva la key de la Empresa');
});

test('anexos · sin admin key, adminListEmpresas responde ADMIN_TOKEN_REQUIRED sin hacer HTTP', async function () {
  var fetchMock = makeFetchMock(function () { return _jsonOk({}); });
  var client = fc.createFirmaClient({
    baseUrl: BASE_URL, apiKey: API_KEY, clientInstanceId: CLIENT_INSTANCE_ID,
    appVersion: '0.1.190-test', _fetch: fetchMock, _sleep: function () { return Promise.resolve(); }
  });
  var r = await client.adminListEmpresas();
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'ADMIN_TOKEN_REQUIRED');
  assert.equal(fetchMock.calls.length, 0, 'no se sale a la red sin key');
});

// ── Abrir la suscripción del Anexo de Encargo ───────────────────────

test('anexos · adminCrearSuscripcionAnexoEncargo manda los tres canales que el service exige', async function () {
  var fetchMock = makeFetchMock(function () { return _jsonOk({ url: 'https://firma.kair.fyi/anexo-encargo/tok' }); });
  var client = makeAdminClient({ _fetch: fetchMock });
  var r = await client.adminCrearSuscripcionAnexoEncargo('900829731', {
    correo_firmante: 'rep@empresa.test',
    canal_codigo: 'segundo@empresa.test',
    canal_codigo_confirmacion: 'Confirmado por llamada',
    nombre_firmante: 'Lilia Vasquez'
  });
  assert.equal(r.success, true);
  var call = fetchMock.calls[0];
  assert.equal(call.url, BASE_URL + '/internal/admin/empresas/900829731/anexo-encargo/suscripcion');
  assert.equal(call.opts.method, 'POST');
  var body = JSON.parse(call.opts.body);
  assert.equal(body.correo_firmante, 'rep@empresa.test');
  assert.equal(body.canal_codigo, 'segundo@empresa.test');
  assert.equal(body.canal_codigo_confirmacion, 'Confirmado por llamada');
});

test('anexos · el segundo canal NO puede ser el mismo buzon del enlace', async function () {
  var fetchMock = makeFetchMock(function () { return _jsonOk({}); });
  var client = makeAdminClient({ _fetch: fetchMock });
  var r = await client.adminCrearSuscripcionAnexoEncargo('900829731', {
    correo_firmante: 'rep@empresa.test',
    canal_codigo: 'REP@EMPRESA.TEST',
    canal_codigo_confirmacion: 'x'
  });
  assert.equal(r.success, false);
  assert.match(r.error.message, /DISTINTO/i,
    'el enlace y el codigo no pueden ir al mismo buzon: es la regla del service');
  assert.equal(fetchMock.calls.length, 0, 'no se sale a la red con un canal invalido');
});

test('anexos · al Anexo de Nube no se le pide el segundo canal', async function () {
  var fetchMock = makeFetchMock(function () { return _jsonOk({ url: 'https://x/anexo-nube/tok' }); });
  var client = makeAdminClient({ _fetch: fetchMock });
  var r = await client.adminCrearSuscripcionAnexoNube('900829731', { correo_firmante: 'rep@empresa.test' });
  assert.equal(r.success, true);
  var body = JSON.parse(fetchMock.calls[0].opts.body);
  assert.equal(body.canal_codigo, undefined, 'el Anexo de Nube no tiene fase de contrafirma');
  assert.equal(fetchMock.calls[0].url, BASE_URL + '/internal/admin/empresas/900829731/anexo-nube/suscripcion');
});

// ── Los tres actos que exigen MOTIVO ───────────────────────────────

test('anexos · anular exige el motivo y lo manda en X-Admin-Motivo', async function () {
  var fetchMock = makeFetchMock(function () { return _jsonOk({ anulada: true }); });
  var client = makeAdminClient({ _fetch: fetchMock });
  var r = await client.adminAnularSuscripcionAnexoEncargo('900829731', 7, 'La empresa se dio de baja');
  assert.equal(r.success, true);
  assert.equal(fetchMock.calls[0].opts.headers['X-Admin-Motivo'], 'La empresa se dio de baja');
  assert.equal(fetchMock.calls[0].url, BASE_URL + '/internal/admin/empresas/900829731/anexo-encargo/suscripcion/7/anular');
});

test('anexos · anular SIN motivo no sale a la red', async function () {
  var fetchMock = makeFetchMock(function () { return _jsonOk({}); });
  var client = makeAdminClient({ _fetch: fetchMock });
  var r = await client.adminAnularSuscripcionAnexoEncargo('900829731', 7, '   ');
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'MOTIVO_REQUERIDO');
  assert.equal(fetchMock.calls.length, 0);
});

test('anexos · verificar-representante exige el motivo', async function () {
  var fetchMock = makeFetchMock(function () { return _jsonOk({ verificado: true }); });
  var client = makeAdminClient({ _fetch: fetchMock });
  var r = await client.adminVerificarRepresentante('900829731', 7,
    { tipo_documento: 'CERTIFICADO_CAMARA', referencia: 'R-123' }, '');
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'MOTIVO_REQUERIDO');
  assert.equal(fetchMock.calls.length, 0);
});

test('anexos · contrafirmar exige el motivo y lo manda', async function () {
  var fetchMock = makeFetchMock(function () { return _jsonOk({ contrafirmado: true }); });
  var client = makeAdminClient({ _fetch: fetchMock });
  var r = await client.adminContrafirmar('900829731', 7, '123456', 'Verificado contra el certificado');
  assert.equal(r.success, true);
  assert.equal(fetchMock.calls[0].opts.headers['X-Admin-Motivo'], 'Verificado contra el certificado');
  var body = JSON.parse(fetchMock.calls[0].opts.body);
  assert.equal(body.otp, '123456');
  assert.equal(body.acepta, true);
});

test('anexos · contrafirmar con un codigo que no son 6 digitos no sale a la red', async function () {
  var fetchMock = makeFetchMock(function () { return _jsonOk({}); });
  var client = makeAdminClient({ _fetch: fetchMock });
  var r = await client.adminContrafirmar('900829731', 7, '12345', 'motivo');
  assert.equal(r.success, false);
  assert.match(r.error.message, /6 digitos/);
  assert.equal(fetchMock.calls.length, 0);
});

test('anexos · pedir el codigo de contrafirma NO lleva motivo (pedirlo no es contrafirmar)', async function () {
  var fetchMock = makeFetchMock(function () { return _jsonOk({ expira_en_segundos: 600, canal: 'pri***@gmail.com' }); });
  var client = makeAdminClient({ _fetch: fetchMock });
  var r = await client.adminPedirCodigoContrafirma('900829731', 7);
  assert.equal(r.success, true);
  assert.equal(fetchMock.calls[0].opts.headers['X-Admin-Motivo'], undefined);
  assert.equal(fetchMock.calls[0].url, BASE_URL + '/internal/admin/empresas/900829731/anexo-encargo/contrafirmar/codigo');
  assert.equal(JSON.parse(fetchMock.calls[0].opts.body).id_suscripcion, 7);
});

// =====================================================================
//  SUITE 2 · EL BRIDGE
// =====================================================================

const _mockIpcHandlers = {};
const _mockSafeStorage = {
  isEncryptionAvailable: function () { return _mockSafeStorage._available !== false; },
  encryptString: function (s) { return Buffer.from('ENC:' + s, 'utf-8'); },
  decryptString: function (buf) {
    var s = Buffer.isBuffer(buf) ? buf.toString('utf-8') : String(buf);
    if (s.indexOf('ENC:') !== 0) throw new Error('Invalid encrypted blob');
    return s.slice(4);
  },
  _available: true
};
const _testUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-anexos-test-'));
const _mockApp = {
  on: function () {},
  getPath: function (name) { return name === 'userData' ? _testUserData : os.tmpdir(); },
  getVersion: function () { return '0.1.190-test'; }
};

const _originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === 'electron') {
    return path.join(__dirname, '__mock_electron_anexos.js');
  }
  return _originalResolve.call(this, request, parent, ...rest);
};
fs.writeFileSync(
  path.join(__dirname, '__mock_electron_anexos.js'),
  'module.exports = global._mockElectronAnexosModule;\n'
);
global._mockElectronAnexosModule = {
  ipcMain: {
    handle: function (channel, handler) { _mockIpcHandlers[channel] = handler; }
  },
  app: _mockApp,
  safeStorage: _mockSafeStorage
};

const registerFirmaHandlers = require('./firma-bridge');

let _clientCallLog = [];
let _lastMockedClient = null;

function _resetClientMock() {
  _clientCallLog = [];
  return {
    // Los metodos de los anexos.
    adminListEmpresas: function () {
      _clientCallLog.push({ m: 'adminListEmpresas' });
      return Promise.resolve({ success: true, data: { items: [{ id_empresa: '900829731' }] } });
    },
    adminGetEmpresaAnexos: function (id) {
      _clientCallLog.push({ m: 'adminGetEmpresaAnexos', id: id });
      return Promise.resolve({ success: true, data: { id_empresa: id, anexo_encargo: { suscripcion: null, eventos: [] } } });
    },
    adminCrearSuscripcionAnexoEncargo: function (id, datos) {
      _clientCallLog.push({ m: 'adminCrearSuscripcionAnexoEncargo', id: id, datos: datos });
      return Promise.resolve({ success: true, data: { url: 'https://firma.kair.fyi/anexo-encargo/tok', expira_en: '2026-11-10T00:00:00.000Z' } });
    },
    adminCrearSuscripcionAnexoNube: function (id, datos) {
      _clientCallLog.push({ m: 'adminCrearSuscripcionAnexoNube', id: id, datos: datos });
      return Promise.resolve({ success: true, data: { url: 'https://firma.kair.fyi/anexo-nube/tok' } });
    },
    adminAnularSuscripcionAnexoEncargo: function (id, sub, motivo) {
      _clientCallLog.push({ m: 'adminAnularSuscripcionAnexoEncargo', id: id, sub: sub, motivo: motivo });
      return Promise.resolve({ success: true, data: { anulada: true } });
    },
    adminAnularSuscripcionAnexoNube: function (id, sub, motivo) {
      _clientCallLog.push({ m: 'adminAnularSuscripcionAnexoNube', id: id, sub: sub, motivo: motivo });
      return Promise.resolve({ success: true, data: { anulada: true } });
    },
    adminVerificarRepresentante: function (id, sub, datos, motivo) {
      _clientCallLog.push({ m: 'adminVerificarRepresentante', id: id, sub: sub, datos: datos, motivo: motivo });
      return Promise.resolve({ success: true, data: { verificado: true } });
    },
    adminPedirCodigoContrafirma: function (id, sub) {
      _clientCallLog.push({ m: 'adminPedirCodigoContrafirma', id: id, sub: sub });
      return Promise.resolve({ success: true, data: { expira_en_segundos: 600, canal: 'pri***@gmail.com' } });
    },
    adminContrafirmar: function (id, sub, otp, motivo) {
      _clientCallLog.push({ m: 'adminContrafirmar', id: id, sub: sub, otp: otp, motivo: motivo });
      return Promise.resolve({ success: true, data: { contrafirmado: true } });
    },
    // El canal del CLIENTE: usa la key de la Empresa.
    getEmpresaAnexos: function () {
      _clientCallLog.push({ m: 'getEmpresaAnexos' });
      return Promise.resolve({ success: true, data: { id_empresa: '900829731', anexo_encargo: { estado: 'ejecutado' } } });
    },
    // Los que ya existian (por si el bridge los llama).
    getActiveAgreement: function () { return Promise.resolve({ success: true, data: {} }); },
    adminGetEmpresa: function () { return Promise.resolve({ success: true, data: {} }); },
    adminUpdateEmpresa: function () { return Promise.resolve({ success: true, data: {} }); },
    adminListClients: function () { return Promise.resolve({ success: true, data: { items: [] } }); }
  };
}

function _setMockClient() {
  _lastMockedClient = _resetClientMock();
  registerFirmaHandlers._test_setClientFactory(function () { return _lastMockedClient; });
  registerFirmaHandlers._test_setGenerateClientInstanceId(function () { return CLIENT_INSTANCE_ID; });
}

function _setSecretsV2(empresasObj, opts) {
  opts = opts || {};
  var s2 = {
    version: 2,
    firmaServiceUrl: opts.url !== undefined ? opts.url : 'https://firma.test.local',
    firmaServiceClientInstanceId: CLIENT_INSTANCE_ID,
    empresas: empresasObj || {}
  };
  if (opts.adminApiKey) s2.adminApiKey = opts.adminApiKey;
  registerFirmaHandlers._test_setSecrets(s2);
  return s2;
}

function setup(opts) {
  opts = opts || {};
  Object.keys(_mockIpcHandlers).forEach(function (k) { delete _mockIpcHandlers[k]; });
  registerFirmaHandlers._test_reset();
  _setMockClient();
  registerFirmaHandlers._test_clearSecrets();
  delete process.env.FIRMA_SERVICE_URL;
  delete process.env.FIRMA_SERVICE_API_KEY;
  delete process.env.FIRMA_SERVICE_CLIENT_INSTANCE_ID;
  delete process.env.FIRMA_SERVICE_ADMIN_KEY;
  registerFirmaHandlers.init({ handle: function (channel, handler) { _mockIpcHandlers[channel] = handler; } });
  registerFirmaHandlers(_mockApp, { appVersion: '0.1.190-test' });
  if (opts.conEmpresa !== false) {
    _setSecretsV2({
      'TEMPOACTIVA EST S.A.S.': {
        idEmpresa: '900123456',
        firmaApiKey: 'kair_live_test_key_aBc123XyZ-32chars-min-len-XXX',
        activatedAt: '2026-08-20T15:00:00Z'
      }
    }, { adminApiKey: opts.adminApiKey });
  }
}

function teardown() {
  registerFirmaHandlers._test_clearSecrets();
}

async function _call(channel, payload) {
  var h = _mockIpcHandlers[channel];
  if (!h) throw new Error('Handler no registrado: ' + channel);
  return await h({}, payload || {});
}

var CANALES_ANEXOS = [
  'firma:anexo:empresas',
  'firma:anexo:estado',
  'firma:anexo:suscripcion',
  'firma:anexo:nube-suscripcion',
  'firma:anexo:verificar-representante',
  'firma:anexo:contrafirma-codigo',
  'firma:anexo:contrafirmar',
  'firma:anexo:anular',
  'firma:anexo:nube-anular',
  'firma:empresa:anexos',
  'firma:config:admin-diag'
];

test('anexos · los 11 canales nuevos estan registrados', function () {
  setup();
  CANALES_ANEXOS.forEach(function (ch) {
    assert.ok(_mockIpcHandlers[ch], 'handler registrado: ' + ch);
  });
  teardown();
});

test('anexos · sin admin key, los canales del operador responden ADMIN_TOKEN_REQUIRED', async function () {
  setup({ adminApiKey: null });
  var r = await _call('firma:anexo:empresas');
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'ADMIN_TOKEN_REQUIRED');
  assert.equal(_clientCallLog.length, 0, 'no se sale a la red sin key');
  teardown();
});

test('anexos · con admin key, el listado de empresas llega al cliente', async function () {
  setup({ adminApiKey: 'admin-key-de-prueba-32-caracteres-min!!' });
  var r = await _call('firma:anexo:empresas');
  assert.equal(r.success, true);
  assert.equal(r.data.items.length, 1);
  assert.equal(_clientCallLog[0].m, 'adminListEmpresas');
  teardown();
});

test('anexos · el detalle pide la empresa y va con el id', async function () {
  setup({ adminApiKey: 'admin-key-de-prueba-32-caracteres-min!!' });
  var r = await _call('firma:anexo:estado', { id_empresa: '900829731' });
  assert.equal(r.success, true);
  assert.equal(_clientCallLog[0].id, '900829731');
  teardown();
});

test('anexos · el detalle sin id_empresa se rechaza antes de la red', async function () {
  setup({ adminApiKey: 'admin-key-de-prueba-32-caracteres-min!!' });
  var r = await _call('firma:anexo:estado', {});
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'INVALID_REQUEST_BODY');
  assert.equal(_clientCallLog.length, 0);
  teardown();
});

test('anexos · anular, verificar y contrafirmar NO salen sin motivo', async function () {
  setup({ adminApiKey: 'admin-key-de-prueba-32-caracteres-min!!' });
  var r1 = await _call('firma:anexo:anular', { id_empresa: '900829731', id_suscripcion: 7 });
  var r2 = await _call('firma:anexo:nube-anular', { id_empresa: '900829731', id_suscripcion: 7 });
  var r3 = await _call('firma:anexo:verificar-representante', { id_empresa: '900829731', id_suscripcion: 7 });
  var r4 = await _call('firma:anexo:contrafirmar', { id_empresa: '900829731', id_suscripcion: 7, otp: '123456' });
  [r1, r2, r3, r4].forEach(function (r) {
    assert.equal(r.success, false);
    assert.equal(r.error.code, 'MOTIVO_REQUERIDO');
  });
  assert.equal(_clientCallLog.length, 0, 'ningun acto sin motivo llega al service');
  teardown();
});

test('anexos · con motivo, los tres actos llegan al service CON el motivo', async function () {
  setup({ adminApiKey: 'admin-key-de-prueba-32-caracteres-min!!' });
  await _call('firma:anexo:anular', { id_empresa: '900829731', id_suscripcion: 7, motivo: 'm1' });
  await _call('firma:anexo:verificar-representante', {
    id_empresa: '900829731', id_suscripcion: 7, motivo: 'm2',
    datos: { tipo_documento: 'CERTIFICADO_CAMARA', referencia: 'R-1' }
  });
  await _call('firma:anexo:contrafirmar', {
    id_empresa: '900829731', id_suscripcion: 7, otp: '123456', motivo: 'm3'
  });
  assert.equal(_clientCallLog.length, 3);
  assert.equal(_clientCallLog[0].motivo, 'm1');
  assert.equal(_clientCallLog[1].motivo, 'm2');
  assert.equal(_clientCallLog[2].motivo, 'm3');
  assert.equal(_clientCallLog[2].otp, '123456');
  teardown();
});

test('anexos · pedir el codigo de contrafirma NO exige motivo', async function () {
  setup({ adminApiKey: 'admin-key-de-prueba-32-caracteres-min!!' });
  var r = await _call('firma:anexo:contrafirma-codigo', { id_empresa: '900829731', id_suscripcion: 7 });
  assert.equal(r.success, true);
  assert.equal(_clientCallLog[0].m, 'adminPedirCodigoContrafirma');
  teardown();
});

test('anexos · el canal del CLIENTE usa la key de la empresa, no la admin', async function () {
  setup({ adminApiKey: 'admin-key-de-prueba-32-caracteres-min!!' });
  var r = await _call('firma:empresa:anexos', { companyName: 'TEMPOACTIVA EST S.A.S.' });
  assert.equal(r.success, true);
  assert.equal(r.data.anexo_encargo.estado, 'ejecutado');
  assert.equal(_clientCallLog[0].m, 'getEmpresaAnexos');
  teardown();
});

test('anexos · admin-diag dice SI hay key y NUNCA el valor', async function () {
  setup({ adminApiKey: null });
  var sin = await _call('firma:config:admin-diag');
  assert.equal(sin.success, true);
  assert.equal(sin.data.hayAdminKey, false);
  assert.equal(sin.data.source, null);
  assert.equal(JSON.stringify(sin.data).indexOf('admin-key'), -1, 'no hay ningun valor de key');
  teardown();

  setup({ adminApiKey: 'admin-key-de-prueba-32-caracteres-min!!' });
  var con = await _call('firma:config:admin-diag');
  assert.equal(con.success, true);
  assert.equal(con.data.hayAdminKey, true);
  assert.equal(con.data.source, 'secrets');
  assert.equal(JSON.stringify(con.data).indexOf('admin-key-de-prueba'), -1,
    'la key jamas se muestra: solo se dice si existe');
  teardown();
});
