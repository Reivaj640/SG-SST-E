// =====================================================================
// 📦1082 — La contrafirma del Anexo de Nube, desde la app de escritorio
// Ejecutar: node --test main/test-anexos-nube-contrafirma-1082.js
//
// QUE PROTEGE ESTE ARCHIVO
// ------------------------
//
// El SEGUNDO ACTO del Anexo de Nube (lo contrafirma K+AIR) existia en el
// service desde el 9-nov-2026, pero NO existia en la app: no habia handler en
// `main/firma-bridge.js` ni metodo en `preload.js`, y el operador lo hacia por
// HTTP a mano, con el paso a paso escrito en un documento del expediente.
//
// Los guards no son "el texto existe": son invariantes con cota y motivo
// (PROMPT.md §7.1). Cada uno protege algo que, si se rompe, deja al operador
// sin poder hacer el segundo acto, o —peor— le deja hacerlo en el
// INSTRUMENTO EQUIVOCADO:
//
//   - La ruta del service del Nube es `anexo-nube/contrafirmar`: si el cliente
//     pegara a la del Encargo, el segundo acto se escribiria en el Anexo de
//     Encargo y el Anexo de Nube quedaria sin ejecutar.
//   - El cuerpo lleva `acepta: true` y el motivo va en `X-Admin-Motivo`: sin
//     el motivo, el service responde 400 y el acto NO se registra.
//   - El modal sabe DE QUE INSTRUMENTO es: el `_modo` decide a donde va el
//     acto. Un modal que no lo sabe, es un acto a ciegas.
//   - La vista llama canales que EXISTEN: un canal que el bridge no registra
//     es un boton que no hace nada (la trampa 148 aplicada a la app).
//   - La vista NO guarda el codigo: el codigo sale al buzon de K+AIR; si
//     quedara en el disco de la maquina, el control "K+AIR es quien
//     contrafirma" seria de mentira.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const MAIN = path.join(__dirname, '..');
const BRIDGE = path.join(MAIN, 'main', 'firma-bridge.js');
const PRELOAD = path.join(MAIN, 'preload.js');
const CLIENT = path.join(MAIN, 'main', 'firma-client.js');
const OPERADOR = path.join(MAIN, 'modules', 'gestion-humana', 'firma-operador', 'index.js');

const srcBridge = fs.readFileSync(BRIDGE, 'utf8');
const srcPreload = fs.readFileSync(PRELOAD, 'utf8');
const srcOperador = fs.readFileSync(OPERADOR, 'utf8');

const fc = require(CLIENT);

const BASE_URL = 'http://firma.test.local:3001';
const API_KEY = 'test-api-key-32chars-minimum-len-XXXXX';
const ADMIN_API_KEY = 'test-admin-key-32-chars-minimum-padd!!';
const CLIENT_INSTANCE_ID = '550e8400-e29b-41d4-a716-446655440000';

// ── Helpers ──────────────────────────────────────────────────────────

function makeResponse(status, body, contentType) {
  const headers = new Map();
  if (contentType) headers.set('content-type', contentType);
  const isJson = contentType && contentType.indexOf('application/json') === 0;
  return {
    status: status,
    headers: {
      get: function (name) { return headers.get(String(name).toLowerCase()) || null; }
    },
    json: function () { return Promise.resolve(isJson ? body : JSON.parse(body)); },
    arrayBuffer: function () { return Promise.resolve(Buffer.from(JSON.stringify(body))); }
  };
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

/**
 * El cuerpo de UNA llamada: el que se capturo.
 */
function cuerpoDe(capturadas, indice) {
  const c = capturadas[indice === undefined ? capturadas.length - 1 : indice];
  if (!c || !c.opts || !c.opts.body) return null;
  return JSON.parse(c.opts.body);
}

// ── 1. El cliente pega a la ruta DEL NUBE ────────────────────────────

test('cliente · pedir el codigo de contrafirma del Nube pega a la ruta del Nube', function () {
  const capturadas = [];
  const c = makeAdminClient({
    _fetch: function (url, opts) {
      capturadas.push({ url: url, opts: opts });
      return Promise.resolve(makeResponse(200, { expira_en_segundos: 600, canal: 'p***@gmail.com' },
        'application/json'));
    }
  });

  return c.adminPedirCodigoContrafirmaNube('EMP-1', 7).then(function (r) {
    assert.equal(r.success, true, 'la llamada tiene que salir bien');
    assert.equal(capturadas.length, 1, 'tiene que haber exactamente una llamada HTTP');
    assert.match(capturadas[0].url, /\/internal\/admin\/empresas\/EMP-1\/anexo-nube\/contrafirmar\/codigo$/,
      'la URL tiene que ser la del Anexo de Nube, no la del Encargo');
    assert.doesNotMatch(capturadas[0].url, /anexo-encargo/,
      'un codigo pedido por la ruta del Encargo no habilita el segundo acto del Nube');
    assert.deepEqual(cuerpoDe(capturadas), { id_suscripcion: 7 });
  });
});

test('cliente · contrafirmar el Nube pega a la ruta del Nube, con acepta y motivo', function () {
  const capturadas = [];
  const c = makeAdminClient({
    _fetch: function (url, opts) {
      capturadas.push({ url: url, opts: opts });
      return Promise.resolve(makeResponse(200, { ok: true }, 'application/json'));
    }
  });

  return c.adminContrafirmarNube('EMP-1', 7, '123456', 'cierre de la ronda 24').then(function (r) {
    assert.equal(r.success, true);
    assert.match(capturadas[0].url, /\/internal\/admin\/empresas\/EMP-1\/anexo-nube\/contrafirmar$/,
      'la URL tiene que ser la de la contrafirma del Nube');
    assert.doesNotMatch(capturadas[0].url, /anexo-encargo/,
      'el segundo acto del Nube no se escribe por la ruta del Encargo');
    const cuerpo = cuerpoDe(capturadas);
    assert.equal(cuerpo.id_suscripcion, 7);
    assert.equal(cuerpo.otp, '123456');
    assert.equal(cuerpo.acepta, true,
      'la aceptacion expresa es obligatoria: el service responde 400 ACEPTACION_REQUERIDA sin ella');
    assert.equal(capturadas[0].opts.headers['X-Admin-Motivo'], 'cierre de la ronda 24',
      'el motivo va en X-Admin-Motivo y queda en el rastro');
    assert.ok(capturadas[0].opts.headers['X-Admin-API-Key'],
      'el acto es de K+AIR: viaja con la admin key, nunca con la de la Empresa');
  });
});

test('cliente · contrafirmar el Nube SIN motivo no hace HTTP', function () {
  const c = makeAdminClient({
    _fetch: function () { throw new Error('NO debe llamar fetch'); }
  });
  return c.adminContrafirmarNube('EMP-1', 7, '123456', '   ').then(function (r) {
    assert.equal(r.success, false);
    assert.equal(r.error.code, 'MOTIVO_REQUERIDO',
      'sin motivo no hay acto: el service responde 400 MOTIVO_REQUERIDO');
  });
});

test('cliente · contrafirmar el Nube con un codigo que no son 6 digitos no hace HTTP', function () {
  const c = makeAdminClient({
    _fetch: function () { throw new Error('NO debe llamar fetch'); }
  });
  return c.adminContrafirmarNube('EMP-1', 7, '1234', 'motivo').then(function (r) {
    assert.equal(r.success, false);
    assert.equal(r.error.code, 'INVALID_REQUEST_BODY');
  });
});

// ── 2. El bridge registra los dos canales ────────────────────────────

test('bridge · el bridge REGISTRA los dos canales de la contrafirma del Nube', function () {
  // El canal que la vista invoca tiene que existir en el bridge: un canal
  // documentado que no se escribe es un verde falso por la via del
  // documento (trampa 148).
  assert.match(srcBridge, /handle\('firma:anexo:nube-contrafirmar'/,
    'el bridge no registra el canal de la contrafirma del Nube');
  assert.match(srcBridge, /handle\('firma:anexo:nube-contrafirma-codigo'/,
    'el bridge no registra el canal del codigo de contrafirma del Nube');
});

test('bridge · los handlers del Nube delegan en los metodos del NUBE del cliente', function () {
  const handlerCtr = srcBridge.slice(srcBridge.indexOf('function _handlerAnexoNubeContrafirmar'));
  const fin = handlerCtr.indexOf('function _handlerAnexoAnular');
  const bloque = handlerCtr.slice(0, fin > 0 ? fin : handlerCtr.length);
  assert.match(bloque, /adminContrafirmarNube/,
    'el handler tiene que delegar en el metodo del Nube, no en el del Encargo');
  assert.doesNotMatch(bloque, /'adminContrafirmar'/,
    'si delegara en el metodo del Encargo, el segundo acto se escribiria en el instrumento equivocado');
});

test('bridge · el handler de la contrafirma del Nube EXIGE el motivo', function () {
  const handler = srcBridge.slice(srcBridge.indexOf('function _handlerAnexoNubeContrafirmar'));
  const fin = handler.indexOf('function _handlerAnexoAnular');
  const bloque = handler.slice(0, fin > 0 ? fin : handler.length);
  assert.match(bloque, /MOTIVO_REQUERIDO/,
    'sin motivo no se ejecuta el acto: el guard del handler es el que lo impide');
  assert.match(bloque, /args\.motivo/,
    'el motivo tiene que llegar al handler, no comingarse en el camino');
});

// ── 3. El preload expone los canales, y el puente los registra ───────

test('preload · cada metodo nuevo del preload apunta a un canal que el bridge registra', function () {
  // El cruce automatico: lo que el preload expone, el bridge lo tiene que
  // registrar. Este guard muerde si alguien escribe un metodo en el preload
  // sin escribir el handler (o al reves).
  const canalesBridge = new Set();
  const re = /handle\('([^']+)'/g;
  let m;
  while ((m = re.exec(srcBridge)) !== null) canalesBridge.add(m[1]);

  const metodos = srcPreload.match(/firmaAnexoNubeContrafirma\w*: \(args\) => ipcRenderer\.invoke\('([^']+)'/g) || [];
  assert.ok(metodos.length >= 2,
    'el preload tiene que exponer los dos metodos del Nube: hay ' + metodos.length);

  metodos.forEach(function (linea) {
    const canal = linea.match(/invoke\('([^']+)'/)[1];
    assert.ok(canalesBridge.has(canal),
      'el preload invoca el canal ' + canal + ' y el bridge NO lo registra');
  });
});

test('preload · los metodos del Nube NO invocan los canales del Encargo', function () {
  const metodos = srcPreload.match(/firmaAnexoNubeContrafirma\w*: \(args\) => ipcRenderer\.invoke\('([^']+)'/g) || [];
  metodos.forEach(function (linea) {
    const canal = linea.match(/invoke\('([^']+)'/)[1];
    assert.doesNotMatch(canal, /anexo-encargo/,
      'un metodo del Nube que invoque un canal del Encargo hace el acto en el instrumento equivocado');
  });
});

// ── 4. La vista manda el acto al instrumento del modal ───────────────

/**
 * Carga la vista del operador con un `window` minimo y devuelve una instancia
 * con el `electronAPI` espiado.
 */
function cargarVista(spy) {
  global.window = global.window || {};
  global.window.electronAPI = spy;
  delete require.cache[require.resolve(OPERADOR)];
  const mod = require(OPERADOR);
  const comp = Object.create(mod.FirmaOperadorComponent.prototype);
  comp._seleccion = 'EMP-1';
  comp._detalle = {
    anexo_encargo: { suscripcion: { id: 11, estado: 'FIRMADA' } },
    anexo_nube: { suscripcion: { id: 77, estado: 'FIRMADA' } }
  };
  comp._valor = function () { return '123456'; };
  comp._showToast = function () {};
  comp._abrirDetalle = function () { return Promise.resolve(); };
  return comp;
}

test('vista · con el modo del NUBE, el acto va al metodo del Nube', function () {
  const llamadas = [];
  const comp = cargarVista({
    firmaAnexoNubeContrafirmar: function (args) {
      llamadas.push({ metodo: 'nube', args: args });
      return Promise.resolve({ success: true, data: {} });
    },
    firmaAnexoContrafirmar: function (args) {
      llamadas.push({ metodo: 'encargo', args: args });
      return Promise.resolve({ success: true, data: {} });
    }
  });
  comp._modo = 'nube-contrafirmar';

  return comp._guardarContrafirma().then(function () {
    assert.equal(llamadas.length, 1, 'tiene que haber exactamente una llamada');
    assert.equal(llamadas[0].metodo, 'nube',
      'el modal del Nube tiene que contrafirmar el Nube, no el Encargo');
    assert.equal(llamadas[0].args.id_suscripcion, 77,
      'y con la suscripcion del NUBE (77), no la del Encargo (11)');
    assert.equal(llamadas[0].args.otp, '123456');
    assert.ok(llamadas[0].args.motivo, 'el motivo se pasa al acto: queda en el rastro');
  });
});

test('vista · con el modo del ENCARGO, el acto va al metodo del Encargo', function () {
  const llamadas = [];
  const comp = cargarVista({
    firmaAnexoNubeContrafirmar: function (args) {
      llamadas.push({ metodo: 'nube', args: args });
      return Promise.resolve({ success: true, data: {} });
    },
    firmaAnexoContrafirmar: function (args) {
      llamadas.push({ metodo: 'encargo', args: args });
      return Promise.resolve({ success: true, data: {} });
    }
  });
  comp._modo = 'contrafirmar';

  return comp._guardarContrafirma().then(function () {
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].metodo, 'encargo',
      'el modal del Encargo tiene que contrafirmar el Encargo');
    assert.equal(llamadas[0].args.id_suscripcion, 11);
  });
});

test('vista · pedir el codigo del Nube usa el metodo del Nube', function () {
  const llamadas = [];
  const comp = cargarVista({
    firmaAnexoNubeContrafirmaCodigo: function (args) {
      llamadas.push({ metodo: 'nube', args: args });
      return Promise.resolve({ success: true, data: { canal: 'p***@gmail.com' } });
    },
    firmaAnexoContrafirmaCodigo: function (args) {
      llamadas.push({ metodo: 'encargo', args: args });
      return Promise.resolve({ success: true, data: { canal: 'p***@gmail.com' } });
    }
  });

  return comp._pedirCodigo(true).then(function () {
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].metodo, 'nube',
      'el codigo del Nube se pide por la ruta del Nube');
    assert.equal(llamadas[0].args.id_suscripcion, 77);
  });
});

// ── 5. La vista no guarda el codigo ──────────────────────────────────

test('vista · la vista NO guarda el codigo de contrafirma en ningun lado', function () {
  // El codigo sale al buzon de K+AIR. Si quedara en el disco de la maquina, el
  // control "K+AIR es quien contrafirma" seria de mentira.
  assert.equal(srcOperador.indexOf('localStorage'), -1,
    'la vista del operador no escribe en localStorage: el codigo no se guarda');
  assert.equal(srcOperador.indexOf('sessionStorage'), -1,
    'la vista del operador no escribe en sessionStorage');
  assert.equal(srcOperador.indexOf('writeFile'), -1,
    'la vista del operador no escribe archivos');
});

// ── 6. La vista no invoca canales que no existen ─────────────────────

test('vista · la vista NO invoca ningun metodo de anexos que el preload no exponga', function () {
  // El guard de la trampa 148 aplicado a la app, por el otro lado: la vista
  // no puede llamar un metodo que el preload no expone, porque ese boton no
  // haria nada.
  const usados = srcOperador.match(/firmaAnexo[A-Za-z]+/g) || [];
  const unicos = Array.from(new Set(usados));
  unicos.forEach(function (nombre) {
    assert.match(srcPreload, new RegExp('\\b' + nombre + ':'),
      'la vista usa ' + nombre + ' y el preload NO lo expone');
  });
});
