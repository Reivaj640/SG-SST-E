// =====================================================================
// 📦101 (2026-08-20) — Tests unit del cliente HTTP firma-service (I-101)
// Ejecutar: node --test main/test-firma-client.js
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const fc = require('./firma-client');
const { _internals } = fc;

const BASE_URL = 'http://firma.test.local:3001';
const API_KEY = 'test-api-key-32chars-minimum-len-XXXXX';
const CLIENT_INSTANCE_ID = '550e8400-e29b-41d4-a716-446655440000';

// Helper: crear un Response mock (subset de fetch Response)
function makeResponse(status, body, contentType, extraHeaders) {
  var headers = new Map();
  if (contentType) headers.set('content-type', contentType);
  if (extraHeaders) {
    Object.keys(extraHeaders).forEach(function (k) { headers.set(k.toLowerCase(), extraHeaders[k]); });
  }
  var isJson = contentType && contentType.indexOf('application/json') === 0;
  var isPdf = contentType && contentType.indexOf('application/pdf') === 0;
  return {
    status: status,
    headers: {
      get: function (name) { return headers.get(String(name).toLowerCase()) || null; }
    },
    json: function () {
      return Promise.resolve(isJson ? body : JSON.parse(body));
    },
    arrayBuffer: function () {
      if (isPdf) {
        if (Buffer.isBuffer(body)) return Promise.resolve(body);
        return Promise.resolve(Buffer.from(body));
      }
      return Promise.resolve(Buffer.from(JSON.stringify(body)));
    }
  };
}

// Helper: fetch mock que captura la última request y responde con un builder
function makeFetchMock(responder) {
  var calls = [];
  function mockFetch(url, opts) {
    calls.push({ url: url, opts: opts });
    return Promise.resolve(responder(calls[calls.length - 1]));
  }
  mockFetch.calls = calls;
  return mockFetch;
}

function makeClient(overrides) {
  overrides = overrides || {};
  return fc.createFirmaClient({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    clientInstanceId: CLIENT_INSTANCE_ID,
    appVersion: '0.1.190-test',
    _fetch: overrides._fetch || globalThis.fetch,
    _sleep: overrides._sleep || (function () { return Promise.resolve(); })
  });
}

// =====================================================================
//  Suite: Factory y validación
// =====================================================================

test('createFirmaClient: lanza si falta baseUrl', function () {
  assert.throws(function () {
    fc.createFirmaClient({ apiKey: API_KEY, clientInstanceId: CLIENT_INSTANCE_ID });
  }, /baseUrl required/);
});

test('createFirmaClient: lanza si falta apiKey', function () {
  assert.throws(function () {
    fc.createFirmaClient({ baseUrl: BASE_URL, clientInstanceId: CLIENT_INSTANCE_ID });
  }, /apiKey required/);
});

test('createFirmaClient: lanza si falta clientInstanceId', function () {
  assert.throws(function () {
    fc.createFirmaClient({ baseUrl: BASE_URL, apiKey: API_KEY });
  }, /clientInstanceId required/);
});

test('createFirmaClient: normaliza trailing slash en baseUrl', function () {
  var c = fc.createFirmaClient({
    baseUrl: BASE_URL + '///',
    apiKey: API_KEY,
    clientInstanceId: CLIENT_INSTANCE_ID
  });
  assert.equal(c._internals.baseUrl, BASE_URL);
});

// =====================================================================
//  Suite: Headers
// =====================================================================

test('headers: incluye X-Internal-API-Key, X-Client-Instance-Id, X-Request-Id, User-Agent', function () {
  var captured = null;
  var mockFetch = function (url, opts) {
    captured = { url: url, opts: opts };
    return Promise.resolve(makeResponse(200, { ok: true }, 'application/json'));
  };
  var c = makeClient({ _fetch: mockFetch });
  return c.getActiveAgreement().then(function () {
    var h = captured.opts.headers;
    assert.equal(h['X-Internal-API-Key'], API_KEY);
    assert.equal(h['X-Client-Instance-Id'], CLIENT_INSTANCE_ID);
    assert.ok(h['X-Request-Id'], 'X-Request-Id presente');
    assert.match(h['X-Request-Id'], /^[0-9a-f-]{36}$/i, 'X-Request-Id es UUID');
    assert.equal(h['User-Agent'], 'K+AIR-Desktop/0.1.190-test');
    assert.equal(h['Accept'], 'application/json');
    assert.equal(captured.url, BASE_URL + '/internal/acuerdo-activo');
  });
});

test('headers: Idempotency-Key SOLO en POST sign-requests', function () {
  var calls = [];
  var mockFetch = function (url, opts) {
    calls.push({ url: url, opts: opts });
    return Promise.resolve(makeResponse(200, { ok: true }, 'application/json'));
  };
  var c = makeClient({ _fetch: mockFetch });
  return c.getActiveAgreement().then(function () {
    assert.equal(calls[0].opts.headers['Idempotency-Key'], undefined,
      'GET NO debe llevar Idempotency-Key');
    return c.getSignRequest('SIGN-2026-000123');
  }).then(function () {
    assert.equal(calls[1].opts.headers['Idempotency-Key'], undefined,
      'GET sign-request NO debe llevar Idempotency-Key');
  });
});

test('headers: cada request genera un X-Request-Id distinto', function () {
  var ids = [];
  var mockFetch = function (url, opts) {
    ids.push(opts.headers['X-Request-Id']);
    return Promise.resolve(makeResponse(200, { ok: true }, 'application/json'));
  };
  var c = makeClient({ _fetch: mockFetch });
  return c.getActiveAgreement()
    .then(function () { return c.getActiveAgreement(); })
    .then(function () { return c.getActiveAgreement(); })
    .then(function () {
      assert.equal(ids.length, 3);
      assert.notEqual(ids[0], ids[1]);
      assert.notEqual(ids[1], ids[2]);
    });
});

// =====================================================================
//  Suite: Mapeo de respuestas exitosas
// =====================================================================

test('200 OK: mapea a { success: true, data }', function () {
  var body = { id_solicitud: 'SIGN-2026-000123', estado: 'PENDING' };
  var mockFetch = function () { return Promise.resolve(makeResponse(200, body, 'application/json')); };
  var c = makeClient({ _fetch: mockFetch });
  return c.getSignRequest('SIGN-2026-000123').then(function (r) {
    assert.equal(r.success, true);
    assert.deepEqual(r.data, body);
  });
});

test('201 Created: mapea a { success: true, data }', function () {
  var body = { id_solicitud: 'SIGN-2026-000124', token: 'abc' };
  var mockFetch = function () { return Promise.resolve(makeResponse(201, body, 'application/json')); };
  var c = makeClient({ _fetch: mockFetch });
  return c.getSignRequest('SIGN-2026-000124').then(function (r) {
    assert.equal(r.success, true);
    assert.equal(r.data.token, 'abc');
  });
});

test('204 No Content: mapea a { success: true, data: {} }', function () {
  var mockFetch = function () { return Promise.resolve(makeResponse(204, '', 'application/json')); };
  var c = makeClient({ _fetch: mockFetch });
  return c.getSignRequest('SIGN-X').then(function (r) {
    assert.equal(r.success, true);
  });
});

// =====================================================================
//  Suite: Mapeo de errores del backend
// =====================================================================

test('401: mapea a INVALID_API_KEY', function () {
  var body = { error: { code: 'INVALID_API_KEY', message: 'API key inválida', request_id: 'req_abc' } };
  var mockFetch = function () { return Promise.resolve(makeResponse(401, body, 'application/json')); };
  var c = makeClient({ _fetch: mockFetch });
  return c.getSignRequest('SIGN-X').then(function (r) {
    assert.equal(r.success, false);
    assert.equal(r.error.code, 'INVALID_API_KEY');
    assert.equal(r.error.httpStatus, 401);
    assert.equal(r.error.requestId, 'req_abc');
  });
});

test('404 con AppError: preserva code del backend', function () {
  var body = { error: { code: 'TOKEN_NOT_FOUND', message: 'Token no existe' } };
  var mockFetch = function () { return Promise.resolve(makeResponse(404, body, 'application/json')); };
  var c = makeClient({ _fetch: mockFetch });
  return c.getSignRequest('NOTEXIST').then(function (r) {
    assert.equal(r.success, false);
    assert.equal(r.error.code, 'TOKEN_NOT_FOUND');
    assert.equal(r.error.httpStatus, 404);
  });
});

test('404 sin AppError: marca como ENDPOINT_NOT_AVAILABLE', function () {
  // Esto ocurre cuando Express responde 404 sin pasar por el handler central
  // (típico cuando I-008/I-103/I-104/I-013b aún no están en Track A backend).
  var body = '<html><body>Cannot GET /internal/sign-requests?ids=...</body></html>';
  var mockFetch = function () { return Promise.resolve(makeResponse(404, body, 'text/html')); };
  var c = makeClient({ _fetch: mockFetch });
  return c.listSignRequests(['a', 'b']).then(function (r) {
    assert.equal(r.success, false);
    assert.equal(r.error.code, 'ENDPOINT_NOT_AVAILABLE');
    assert.equal(r.error.httpStatus, 404);
  });
});

test('422 con OTP_INVALID: preserva code + details + requestId', function () {
  var body = {
    error: {
      code: 'OTP_INVALID',
      message: 'OTP incorrecto',
      details: { intentos_restantes: 2, otp_ttl_seconds: 423 },
      request_id: 'req_xyz'
    }
  };
  var mockFetch = function () { return Promise.resolve(makeResponse(422, body, 'application/json')); };
  var c = makeClient({ _fetch: mockFetch });
  return c.verifyConsentOtp('cons_123', '000000').then(function (r) {
    assert.equal(r.success, false);
    assert.equal(r.error.code, 'OTP_INVALID');
    assert.deepEqual(r.error.details, { intentos_restantes: 2, otp_ttl_seconds: 423 });
    assert.equal(r.error.requestId, 'req_xyz');
  });
});

// =====================================================================
//  Suite: 429 retry
// =====================================================================

test('429 con Retry-After: respeta y reintenta', function () {
  var attempts = 0;
  var sleepCalls = [];
  var sleepFn = function (ms) { sleepCalls.push(ms); return Promise.resolve(); };
  var mockFetch = function () {
    attempts++;
    if (attempts < 2) {
      return Promise.resolve(makeResponse(429,
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'rate' } },
        'application/json',
        { 'Retry-After': '2' }
      ));
    }
    return Promise.resolve(makeResponse(200, { ok: true }, 'application/json'));
  };
  var c = makeClient({ _fetch: mockFetch, _sleep: sleepFn });
  return c.getActiveAgreement().then(function (r) {
    assert.equal(r.success, true);
    assert.equal(attempts, 2, 'reintentó 1 vez');
    assert.equal(sleepCalls[0], 2000, 'esperó 2000ms (Retry-After=2)');
  });
});

test('429 sin Retry-After: backoff exponencial', function () {
  var attempts = 0;
  var sleepCalls = [];
  var sleepFn = function (ms) { sleepCalls.push(ms); return Promise.resolve(); };
  var mockFetch = function () {
    attempts++;
    if (attempts < 3) {
      return Promise.resolve(makeResponse(429,
        { error: { code: 'RATE_LIMIT_EXCEEDED' } },
        'application/json'
      ));
    }
    return Promise.resolve(makeResponse(200, { ok: true }, 'application/json'));
  };
  var c = makeClient({ _fetch: mockFetch, _sleep: sleepFn });
  return c.getActiveAgreement().then(function (r) {
    assert.equal(r.success, true);
    assert.equal(attempts, 3, 'reintentó 2 veces (total 3 attempts)');
    assert.equal(sleepCalls[0], 1000, '1er backoff: 1s');
    assert.equal(sleepCalls[1], 2000, '2do backoff: 2s');
  });
});

test('429 agotado: surface RATE_LIMIT_EXCEEDED', function () {
  var attempts = 0;
  var sleepFn = function () { return Promise.resolve(); };
  var mockFetch = function () {
    attempts++;
    return Promise.resolve(makeResponse(429,
      { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'rate', details: { retry_after_seconds: 30 } } },
      'application/json'
    ));
  };
  var c = makeClient({ _fetch: mockFetch, _sleep: sleepFn });
  return c.getActiveAgreement().then(function (r) {
    assert.equal(r.success, false);
    assert.equal(r.error.code, 'RATE_LIMIT_EXCEEDED');
    assert.equal(attempts, 3, '3 attempts (1 inicial + 2 retries)');
  });
});

// =====================================================================
//  Suite: Errores de red / timeout
// =====================================================================

test('fetch throw: mapea a NETWORK_ERROR', function () {
  var mockFetch = function () { return Promise.reject(new Error('ECONNREFUSED')); };
  var c = makeClient({ _fetch: mockFetch });
  return c.getActiveAgreement().then(function (r) {
    assert.equal(r.success, false);
    assert.equal(r.error.code, 'NETWORK_ERROR');
  });
});

test('AbortError: mapea a TIMEOUT', function () {
  var e = new Error('aborted');
  e.name = 'AbortError';
  var mockFetch = function () { return Promise.reject(e); };
  var c = makeClient({ _fetch: mockFetch });
  return c.getActiveAgreement().then(function (r) {
    assert.equal(r.success, false);
    assert.equal(r.error.code, 'TIMEOUT');
  });
});

// =====================================================================
//  Suite: Multipart upload (sign-request:create)
// =====================================================================

test('createSignRequest: construye multipart con metadata + documento', function () {
  var captured = null;
  var mockFetch = function (url, opts) {
    captured = { url: url, opts: opts };
    return Promise.resolve(makeResponse(201, { id_solicitud: 'SIGN-1', token: 'tk' }, 'application/json'));
  };
  var c = makeClient({ _fetch: mockFetch });
  var pdfBuffer = Buffer.from('%PDF-1.4\nfake pdf bytes');
  var metadata = {
    id_documento: 'doc-456',
    id_trabajador: 'trab-789',
    id_empresa: 'emp-012',
    tipo_firma: 'presencial',
    agreement_hash: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5'
  };
  return c.createSignRequest({ metadata: metadata, pdfBuffer: pdfBuffer, pdfName: 'contrato.pdf' })
    .then(function (r) {
      assert.equal(r.success, true);
      assert.equal(r.data.id_solicitud, 'SIGN-1');
      assert.equal(captured.url, BASE_URL + '/internal/sign-requests');
      var ct = captured.opts.headers['Content-Type'];
      assert.match(ct, /^multipart\/form-data; boundary=----KAIRFormBoundary/);
      assert.ok(captured.opts.headers['Idempotency-Key'], 'Idempotency-Key presente en POST');
      // body es Buffer con metadata JSON + pdf
      var body = captured.opts.body;
      assert.ok(Buffer.isBuffer(body));
      var bodyStr = body.toString('utf-8');
      assert.ok(bodyStr.indexOf('name="metadata"') !== -1);
      assert.ok(bodyStr.indexOf('name="documento"') !== -1);
      assert.ok(bodyStr.indexOf('"id_documento":"doc-456"') !== -1);
      assert.ok(bodyStr.indexOf('%PDF-1.4') !== -1);
    });
});

test('createSignRequest: acepta pdfBase64 string', function () {
  var captured = null;
  var mockFetch = function (url, opts) {
    captured = { url: url, opts: opts };
    return Promise.resolve(makeResponse(201, { id_solicitud: 'SIGN-2' }, 'application/json'));
  };
  var c = makeClient({ _fetch: mockFetch });
  var b64 = Buffer.from('%PDF-1.4\nfake').toString('base64');
  return c.createSignRequest({ metadata: { id_documento: 'd' }, pdfBuffer: b64 })
    .then(function (r) {
      assert.equal(r.success, true);
      assert.ok(Buffer.isBuffer(captured.opts.body));
      assert.ok(captured.opts.body.toString('utf-8').indexOf('%PDF-1.4') !== -1);
    });
});

test('createSignRequest: sin metadata retorna INVALID_REQUEST_BODY', function () {
  var c = makeClient({ _fetch: function () { throw new Error('NO debe llamar fetch'); } });
  return c.createSignRequest({ pdfBuffer: Buffer.from('x') }).then(function (r) {
    assert.equal(r.success, false);
    assert.equal(r.error.code, 'INVALID_REQUEST_BODY');
  });
});

test('createSignRequest: sin pdfBuffer retorna INVALID_REQUEST_BODY', function () {
  var c = makeClient({ _fetch: function () { throw new Error('NO debe llamar fetch'); } });
  return c.createSignRequest({ metadata: { id_documento: 'd' } }).then(function (r) {
    assert.equal(r.success, false);
    assert.equal(r.error.code, 'INVALID_REQUEST_BODY');
  });
});

// =====================================================================
//  Suite: PDF binary download
// =====================================================================

test('getSignRequestDocument: devuelve base64 + contentType', function () {
  var pdfBytes = Buffer.from('%PDF-1.4\nhello world');
  var mockFetch = function () {
    return Promise.resolve(makeResponse(200, pdfBytes, 'application/pdf', {
      'X-Document-Hash': 'abc123',
      'X-Evidence-Hash': 'def456'
    }));
  };
  var c = makeClient({ _fetch: mockFetch });
  return c.getSignRequestDocument('SIGN-1').then(function (r) {
    assert.equal(r.success, true);
    assert.equal(r.data.contentType, 'application/pdf');
    assert.equal(r.data.contentLength, pdfBytes.length);
    assert.equal(r.data.base64, pdfBytes.toString('base64'));
    assert.equal(r.data.documentHash, 'abc123');
    assert.equal(r.data.evidenceHash, 'def456');
  });
});

// =====================================================================
//  Suite: Validación de input
// =====================================================================

test('getSignRequest: sin id retorna INVALID_REQUEST_BODY sin llamar fetch', function () {
  var called = false;
  var c = makeClient({ _fetch: function () { called = true; throw new Error('NO'); } });
  return c.getSignRequest(null).then(function (r) {
    assert.equal(r.success, false);
    assert.equal(r.error.code, 'INVALID_REQUEST_BODY');
    assert.equal(called, false);
  });
});

test('listSignRequests: sin ids retorna INVALID_REQUEST_BODY', function () {
  var c = makeClient({ _fetch: function () { throw new Error('NO'); } });
  return c.listSignRequests([]).then(function (r) {
    assert.equal(r.success, false);
    assert.equal(r.error.code, 'INVALID_REQUEST_BODY');
  });
});

test('createConsent: sin payload retorna INVALID_REQUEST_BODY', function () {
  var c = makeClient({ _fetch: function () { throw new Error('NO'); } });
  return c.createConsent(null).then(function (r) {
    assert.equal(r.success, false);
    assert.equal(r.error.code, 'INVALID_REQUEST_BODY');
  });
});

test('verifyConsentOtp: sin otp retorna INVALID_REQUEST_BODY', function () {
  var c = makeClient({ _fetch: function () { throw new Error('NO'); } });
  return c.verifyConsentOtp('cons_1', null).then(function (r) {
    assert.equal(r.success, false);
    assert.equal(r.error.code, 'INVALID_REQUEST_BODY');
  });
});

// =====================================================================
//  Suite: generateClientInstanceId
// =====================================================================

test('generateClientInstanceId: genera UUID v4', function () {
  var id1 = fc.generateClientInstanceId();
  var id2 = fc.generateClientInstanceId();
  assert.match(id1, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notEqual(id1, id2);
});

// =====================================================================
//  Suite: HTTP code mapping (internals)
// =====================================================================

test('_internals._httpToCode: mapea códigos conocidos', function () {
  assert.equal(_internals._httpToCode(400), 'INVALID_REQUEST_BODY');
  assert.equal(_internals._httpToCode(401), 'INVALID_API_KEY');
  assert.equal(_internals._httpToCode(403), 'FORBIDDEN');
  assert.equal(_internals._httpToCode(404), 'NOT_FOUND');
  assert.equal(_internals._httpToCode(409), 'CONFLICT');
  assert.equal(_internals._httpToCode(410), 'GONE');
  assert.equal(_internals._httpToCode(413), 'PAYLOAD_TOO_LARGE');
  assert.equal(_internals._httpToCode(422), 'UNPROCESSABLE');
  assert.equal(_internals._httpToCode(429), 'RATE_LIMIT_EXCEEDED');
  assert.equal(_internals._httpToCode(500), 'INTERNAL_ERROR');
  assert.equal(_internals._httpToCode(503), 'SERVICE_UNAVAILABLE');
  assert.equal(_internals._httpToCode(418), 'CLIENT_ERROR'); // teapot
  assert.equal(_internals._httpToCode(599), 'SERVER_ERROR');
  assert.equal(_internals._httpToCode(200), 'UNKNOWN_ERROR'); // 2xx no es error
});

test('_internals._getRetryAfterMs: parsea Retry-After en segundos', function () {
  var r1 = makeResponse(429, {}, 'application/json', { 'Retry-After': '30' });
  assert.equal(_internals._getRetryAfterMs(r1), 30000);
  var r2 = makeResponse(429, {}, 'application/json', { 'RateLimit-Reset': '5' });
  assert.equal(_internals._getRetryAfterMs(r2), 5000);
  var r3 = makeResponse(429, {}, 'application/json', {});
  assert.equal(_internals._getRetryAfterMs(r3), null);
});
