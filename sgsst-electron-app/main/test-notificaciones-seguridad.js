/**
 * test-notificaciones-seguridad.js
 * Tests de seguridad de las notificaciones persistentes (Task 7).
 *
 * NOTA: es un test de VERIFICACIÓN sobre código existente (no TDD RED/GREEN):
 * los checks deben pasar de inmediato; si alguno falla hay una regresión de
 * seguridad real en notifications-*.
 *
 * Cubre:
 *   1. Los 4 canales IPC con token inválido (objeto truthy ok:false, como el real) → UNAUTHORIZED
 *   2. companyKey ajena a la sesión → FORBIDDEN_COMPANY (nunca empresas ajenas)
 *   3. marcarLeida con id de otra empresa → updated: 0 (la fila sigue sin leer)
 *   4. getUnreadCount solo devuelve número (sin títulos)
 *   5. bandeja_integrada_enabled=0 → detector de correo produce 0 (gate real + control)
 *   6. El código de notifications-* no contiene/loguea access_token
 *
 * Patrón: electron-mock vía Module._resolveFilename (igual que
 * test-notificaciones-bridge.js). La BD de los handlers es un stub en memoria
 * (igual que test-notificaciones-email.js): este test verifica la LÓGICA de
 * seguridad, no la integración SQLite (esa la cubre el test del bridge con
 * better-sqlite3 real). Corre con node plano.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const checks = [];
function ok(name, cond) { checks.push({ name: name, ok: !!cond }); }

// --- electron-mock ANTES de require del bridge (patrón test-notificaciones-bridge.js) ---
const handlers = {};
global._mockIpcMain = {
  handle: function (ch, fn) { handlers[ch] = fn; },
  removeHandler: function (ch) { delete handlers[ch]; }
};
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'electron') return 'electron-mock';
  return origResolve.call(this, request, ...args);
};
require.cache['electron-mock'] = { id: 'electron-mock', filename: 'electron-mock', loaded: true, exports: { ipcMain: global._mockIpcMain } };

const bridge = require('./notifications-bridge.js');
const gateMod = require('./notifications-gate.js');
const emailMod = require('./notifications-email.js');

// --- fixture: 3 notificaciones (2 de emp1, 1 de empresa ajena) ---
var FILAS = [
  { tipo: 'correo', ref_id: 't1', company_key: 'emp1', titulo: 'Correo de emp1', dedupe_key: 'correo:emp1:t1:0' },
  { tipo: 'evento', ref_id: 'src:ev-9:86400000', company_key: 'emp1', titulo: 'Evento de emp1', dedupe_key: 'evento:emp1:src:ev-9:86400000' },
  { tipo: 'correo', ref_id: 't-otra', company_key: 'emp-otra', titulo: 'Correo de empresa ajena', dedupe_key: 'correo:emp-otra:t-otra:0' }
];

// --- db stub en memoria: soporta exactamente el SQL que usan los 4 handlers ---
function crearDbStub(filas) {
  var data = filas.map(function (f, i) {
    return Object.assign({ id: i + 1, leida_at: null }, f);
  });
  function _cond(sql, params) {
    var conds = [];
    if (/company_key = \?/.test(sql)) {
      var ck = params[0];
      conds.push(function (r) { return r.company_key === ck; });
    }
    if (/company_key IN \(/.test(sql)) {
      var cks = params.slice();
      conds.push(function (r) { return cks.indexOf(r.company_key) !== -1; });
    }
    if (/(^|\s)id IN \(/.test(sql)) {
      var ids = params.filter(function (n) { return Number.isInteger(n) && n > 0; });
      conds.push(function (r) { return ids.indexOf(r.id) !== -1; });
    }
    if (/AND leida_at IS NULL/.test(sql)) {
      conds.push(function (r) { return r.leida_at === null; });
    }
    return function (r) { return conds.every(function (c) { return c(r); }); };
  }
  return {
    _filas: function () { return data; },
    // schema idempotente: la integridad real la cubre el test del bridge (better-sqlite3)
    exec: function () {},
    prepare: function (sql) {
      if (/^SELECT \*/.test(sql)) {
        return {
          all: function () {
            var params = Array.prototype.slice.call(arguments);
            var cond = _cond(sql, params);
            return data.filter(cond).map(function (r) { return Object.assign({}, r); });
          }
        };
      }
      if (/^SELECT COUNT/.test(sql)) {
        return {
          get: function () {
            var params = Array.prototype.slice.call(arguments);
            var cond = _cond(sql, params);
            return { c: data.filter(cond).length };
          }
        };
      }
      if (/^SELECT id, company_key/.test(sql)) {
        return {
          all: function () {
            var params = Array.prototype.slice.call(arguments);
            var cond = _cond(sql, params);
            return data.filter(cond).map(function (r) { return { id: r.id, company_key: r.company_key }; });
          }
        };
      }
      if (/^UPDATE/.test(sql)) {
        return {
          run: function () {
            var params = Array.prototype.slice.call(arguments);
            var cond = _cond(sql, params);
            var changes = 0;
            data.forEach(function (r) { if (cond(r)) { r.leida_at = '2026-09-22T12:00:00'; changes++; } });
            return { changes: changes };
          }
        };
      }
      return { all: function () { return []; }, get: function () { return null; }, run: function () { return { changes: 0 }; } };
    }
  };
}

// --- registro de handlers con sesión de solo emp1 (emp-otra queda ajena) ---
// Forma REAL de validateSession (main.js): token inválido/ausente devuelve un
// objeto TRUTHY { ok: false, error: { code } } (NO null) — prueba el fix de C2:
// el chequeo de UNAUTHORIZED debe mirar sess.ok === false, no solo !sess.
var validateSession = function (tok) {
  if (tok === 'tok-ok') return { ok: true, user: { id: 1, isAdmin: false, companies: ['emp1'] } };
  return { ok: false, error: { code: 'AUTH_REQUIRED', message: 'Sesión inválida' } };
};
var dbStub = crearDbStub(FILAS);
bridge.registerNotificationsHandlers({}, { getDb: function () { return dbStub; }, validateSession: validateSession });

(async function () {
  // --- 1) los 4 canales sin token → UNAUTHORIZED ---
  var canales = ['notificaciones:listar', 'notificaciones:marcarLeida', 'notificaciones:marcarTodas', 'notificaciones:getUnreadCount'];
  for (var i = 0; i < canales.length; i++) {
    var sinTok = await handlers[canales[i]]({}, { token: 'token-invalido' });
    ok('canal ' + canales[i].split(':')[1] + ' sin token → UNAUTHORIZED', sinTok && sinTok.success === false && sinTok.error === 'UNAUTHORIZED');
  }

  // --- 2) companyKey ajena a la sesión → FORBIDDEN_COMPANY ---
  var lAjena = await handlers['notificaciones:listar']({}, { token: 'tok-ok', companyKey: 'emp-otra' });
  ok('listar companyKey ajena → FORBIDDEN_COMPANY', lAjena && lAjena.success === false && lAjena.error === 'FORBIDDEN_COMPANY');
  var tAjena = await handlers['notificaciones:marcarTodas']({}, { token: 'tok-ok', companyKey: 'emp-otra' });
  ok('marcarTodas companyKey ajena → FORBIDDEN_COMPANY', tAjena && tAjena.success === false && tAjena.error === 'FORBIDDEN_COMPANY');
  var cAjena = await handlers['notificaciones:getUnreadCount']({}, { token: 'tok-ok', companyKey: 'emp-otra' });
  ok('getUnreadCount companyKey ajena → FORBIDDEN_COMPANY', cAjena && cAjena.success === false && cAjena.error === 'FORBIDDEN_COMPANY');

  // sin companyKey: nunca filtra datos de la empresa ajena a la respuesta
  var lSesion = await handlers['notificaciones:listar']({}, { token: 'tok-ok' });
  ok('listar sin companyKey no devuelve empresas ajenas', lSesion && lSesion.success === true &&
    lSesion.data.length === 2 && lSesion.data.every(function (n) { return n.companyKey === 'emp1'; }));

  // --- 3) marcarLeida con id de otra empresa → updated: 0 ---
  var idAjeno = dbStub._filas()[2].id; // fila de emp-otra
  var mAjeno = await handlers['notificaciones:marcarLeida']({}, { token: 'tok-ok', ids: [idAjeno] });
  ok('marcarLeida id de otra empresa → updated: 0', mAjeno && mAjeno.success === true && mAjeno.data.updated === 0);
  ok('marcarLeida id ajeno: la fila sigue sin leer', dbStub._filas()[2].leida_at === null);

  // --- 4) getUnreadCount solo devuelve número (sin títulos) ---
  var cnt = await handlers['notificaciones:getUnreadCount']({}, { token: 'tok-ok' });
  ok('getUnreadCount devuelve numero', cnt && cnt.success === true && typeof cnt.data.unread === 'number');
  ok('getUnreadCount data solo tiene unread (sin titulos)', JSON.stringify(cnt.data) === '{"unread":2}');

  // control positivo: el filtro por empresa no bloquea de más
  var idPropio = dbStub._filas()[0].id;
  var mPropio = await handlers['notificaciones:marcarLeida']({}, { token: 'tok-ok', ids: [idPropio] });
  ok('marcarLeida id propio (control) → updated: 1', mPropio && mPropio.success === true && mPropio.data.updated === 1);
  var cnt2 = await handlers['notificaciones:getUnreadCount']({}, { token: 'tok-ok' });
  ok('unread baja tras marcar (control)', cnt2 && cnt2.success === true && cnt2.data.unread === 1);

  // --- 5) gate de bandeja: bandeja_integrada_enabled=0 → detector de correo 0 ---
  var emailDbStub = {
    prepare: function (sql) {
      if (/has_unread/.test(sql) && /SELECT/.test(sql)) {
        return {
          all: function () {
            return [
              { thread_id: 't1', subject: 'Asunto 1', snippet: 'hola', company_key: 'emp1', last_message_date: '2026-09-22T11:00:00Z' },
              { thread_id: 't2', subject: 'Asunto 2', snippet: 'x', company_key: 'emp1', last_message_date: '2026-09-22T11:00:00Z' }
            ];
          }
        };
      }
      if (/email_connections/.test(sql)) return { all: function () { return []; } };
      return { all: function () { return []; }, get: function () { return null; }, run: function () { return { changes: 0 }; } };
    }
  };
  var detOff = emailMod.createEmailDetector({
    getDb: function () { return emailDbStub; },
    bandejaEnabledFor: function () { return false; },
    trySync: async function () { return false; }
  });
  var resOff = await detOff({ companies: ['emp1'] });
  ok('detector con bandeja_integrada_enabled=0 → 0 correos', resOff.nuevas.length === 0);

  // control positivo (el gate no bloquea de más)
  var detOn = emailMod.createEmailDetector({
    getDb: function () { return emailDbStub; },
    bandejaEnabledFor: function (ck) { return ck === 'emp1'; },
    trySync: async function () { return false; }
  });
  var resOn = await detOn({ companies: ['emp1'] });
  ok('detector control positivo (flag=1) → 2 correos', resOn.nuevas.length === 2);

  // gate real (notifications-gate): mismo criterio que el bridge de permisos
  var gateDbFlag0 = {
    prepare: function (sql) {
      if (/FROM sessions/.test(sql)) return { get: function () { return { token: 'tok-gate' }; } };
      if (/FROM users/.test(sql)) return { get: function () { return { bandeja_integrada_enabled: 0 }; } };
      return { get: function () { return null; } };
    }
  };
  var gateUser0 = gateMod.createBandejaGate({
    getDb: function () { return gateDbFlag0; },
    validateSession: function () { return { ok: true, user: { id: 'u2', isAdmin: false } }; }
  });
  ok('gate real con bandeja_integrada_enabled=0 → false', gateUser0() === false);

  var gateDbNoSess = {
    prepare: function () {
      return { get: function () { return null; } };
    }
  };
  var gateNoSess = gateMod.createBandejaGate({
    getDb: function () { return gateDbNoSess; },
    validateSession: function () { return { ok: true, user: { id: 'u1', isAdmin: true } }; }
  });
  ok('gate sin sesión activa → false (fail-closed)', gateNoSess() === false);

  var gateAdmin = gateMod.createBandejaGate({
    getDb: function () { return gateDbFlag0; },
    validateSession: function () { return { ok: true, user: { id: 'u1', isAdmin: true } }; }
  });
  ok('gate admin → true (control, no bloquea de más)', gateAdmin() === true);

  // --- 6) notifications-* no contiene/loguea access_token ---
  var notifFiles = ['notifications-bridge.js', 'notifications-service.js', 'notifications-email.js', 'notifications-gate.js'];
  notifFiles.forEach(function (f) {
    var src = fs.readFileSync(path.join(__dirname, f), 'utf8');
    ok(f + ': sin access_token (no se loguea el token)', src.indexOf('access_token') === -1);
  });

  var f = 0;
  checks.forEach(function (c) {
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name);
    if (!c.ok) f++;
  });
  console.log('---');
  console.log((checks.length - f) + '/' + checks.length + ' OK');
  process.exit(f === 0 ? 0 : 1);
})().catch(function (e) { console.error(e); process.exit(1); });
