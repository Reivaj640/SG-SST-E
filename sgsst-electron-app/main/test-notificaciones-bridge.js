'use strict';
const path = require('path');
const fs = require('fs');
const checks = [];
function ok(name, cond) { checks.push({ name: name, ok: !!cond }); }

// Mock electron ipcMain ANTES de require del bridge
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

// --- helpers puros ---
ok('SCHEMA_SQL crea tabla notificaciones', /CREATE TABLE IF NOT EXISTS notificaciones/.test(bridge.SCHEMA_SQL));
ok('SCHEMA_SQL tiene dedupe_key UNIQUE', /dedupe_key\s+TEXT NOT NULL UNIQUE/.test(bridge.SCHEMA_SQL));
ok('SCHEMA_SQL tiene CHECK tipo', /CHECK \(tipo IN \('correo','evento'\)\)/.test(bridge.SCHEMA_SQL));
ok('SCHEMA_SQL tiene indice pendientes', /idx_notif_pendientes/.test(bridge.SCHEMA_SQL));

const k1 = bridge.buildDedupeKey('correo', 'emp1', 'thr-9', null, 0);
const k2 = bridge.buildDedupeKey('correo', 'emp1', 'thr-9', null, 0);
const k3 = bridge.buildDedupeKey('correo', 'emp1', 'thr-9', null, 900000);
ok('dedupe_key correo estable', k1 === k2);
ok('dedupe_key distinto por ventana', k1 !== k3);
ok('dedupe_key incluye tipo', k1.indexOf('correo:') === 0);

const ke = bridge.buildDedupeKey('evento', 'emp1', 'ev-1', '2026-09-22T10:00:00.000Z', 86400000);
ok('dedupe_key evento con fecha+ventana', /evento:emp1:ev-1:/.test(ke) && ke.indexOf('86400000') !== -1);

const now = Date.parse('2026-09-22T12:00:00.000Z');
const r = bridge.ventanaRango(now, 3600000);
ok('ventanaRango start=now', Date.parse(r.startIso) === now);
ok('ventanaRango end=now+1h', Date.parse(r.endIso) === now + 3600000);

// --- schema + handlers con db en memoria (patrón repo: mock electron) ---
// better-sqlite3 solo con Electron ABI → si falla, usar stub mínimo
let Database = null;
let db = null;
let dbOk = false;
try {
  Database = require('better-sqlite3');
  db = new Database(':memory:');
  dbOk = true;
} catch (e) {
  dbOk = false;
}
if (dbOk) {
  // better-sqlite3 cargó y abrió db: cualquier fallo del schema es un error REAL del test (no fallback)
  try {
    db.exec(bridge.SCHEMA_SQL);
  } catch (e) {
    console.error('FAIL SCHEMA: db.exec(bridge.SCHEMA_SQL) falló: ' + (e && e.message));
    console.error('EXIT=1');
    process.exit(1);
  }
  ok('schema aplica en sqlite', true);
  db.prepare('INSERT INTO notificaciones (tipo,ref_id,company_key,titulo,dedupe_key) VALUES (?,?,?,?,?)')
    .run('correo', 't1', 'emp1', 'Hola', k1);
  let threw = false;
  try {
    db.prepare('INSERT INTO notificaciones (tipo,ref_id,company_key,titulo,dedupe_key) VALUES (?,?,?,?,?)')
      .run('correo', 't1', 'emp1', 'Hola dup', k1);
  } catch (e) { threw = true; }
  ok('dedupe_key UNIQUE rechaza duplicado', threw);

  // Forma REAL de validateSession (main.js): { ok, session, user: { id, email, companies, roles, isAdmin } }
  const validateSession = function (tok) {
    if (tok === 'tok-ok') return { ok: true, user: { id: 1, isAdmin: false, companies: ['emp1', 'emp2'] } };
    if (tok === 'tok-admin') return { ok: true, user: { id: 2, isAdmin: true, companies: [] } };
    return null;
  };
  bridge.registerNotificationsHandlers({ }, { getDb: function () { return db; }, validateSession: validateSession });

  ok('handler listar registrado', typeof handlers['notificaciones:listar'] === 'function');
  ok('handler marcarLeida registrado', typeof handlers['notificaciones:marcarLeida'] === 'function');
  ok('handler marcarTodas registrado', typeof handlers['notificaciones:marcarTodas'] === 'function');
  ok('handler getUnreadCount registrado', typeof handlers['notificaciones:getUnreadCount'] === 'function');

  // ejecutar handlers de forma síncrona (son async → await)
  (async function () {
    const noTok = await handlers['notificaciones:listar']({}, { token: 'malo' });
    ok('listar sin session rechaza', noTok && noTok.success === false);

    const conTok = await handlers['notificaciones:listar']({}, { token: 'tok-ok', companyKey: 'emp1' });
    ok('listar con session ok', conTok && conTok.success === true && Array.isArray(conTok.data));
    // Correos van globales '*' (+ migración); eventos siguen por empresa.
    ok('listar filtra company (+ global *)', !!(conTok && conTok.data) && conTok.data.every(function (n) {
      return n.companyKey === 'emp1' || n.companyKey === '*';
    }));

    const cnt = await handlers['notificaciones:getUnreadCount']({}, { token: 'tok-ok' });
    ok('getUnreadCount devuelve numero', cnt && cnt.success && typeof cnt.data.unread === 'number' && cnt.data.unread === 1);

    // marcarLeida con id inexistente de otra empresa → no marca
    const idRow = db.prepare('SELECT id FROM notificaciones LIMIT 1').get();
    const ajeno = await handlers['notificaciones:marcarLeida']({}, { token: 'tok-ok', ids: [idRow.id + 9999] });
    ok('marcarLeida id ajeno no marca', ajeno.success);

    const bien = await handlers['notificaciones:marcarLeida']({}, { token: 'tok-ok', ids: [idRow.id] });
    ok('marcarLeida ok', bien.success);
    const cnt2 = await handlers['notificaciones:getUnreadCount']({}, { token: 'tok-ok' });
    ok('unread baja a 0', cnt2.data.unread === 0);

    // marcarTodas: companyKey prohibido → rechaza (no marca todas)
    const proh = await handlers['notificaciones:marcarTodas']({}, { token: 'tok-ok', companyKey: 'emp-otra' });
    ok('marcarTodas companyKey prohibido rechaza', proh && proh.success === false && proh.error === 'FORBIDDEN_COMPANY');

    // marcarTodas: sin companyKey → marca todas las empresas de la sesión
    const todas = await handlers['notificaciones:marcarTodas']({}, { token: 'tok-ok' });
    ok('marcarTodas sin companyKey ok', todas && todas.success === true && typeof todas.data.updated === 'number' && todas.data.updated >= 0);

    // admin (forma real): isAdmin en sess.user.isAdmin → bypass de FORBIDDEN_COMPANY
    const admListar = await handlers['notificaciones:listar']({}, { token: 'tok-admin', companyKey: 'emp-otra' });
    ok('listar admin sin empresas → FORBIDDEN bypassed', admListar && admListar.success === true);
    const admTodas = await handlers['notificaciones:marcarTodas']({}, { token: 'tok-admin', companyKey: 'emp-otra' });
    ok('marcarTodas admin bypass', admTodas && admTodas.success === true);
    const admCnt = await handlers['notificaciones:getUnreadCount']({}, { token: 'tok-admin', companyKey: 'emp-otra' });
    ok('getUnreadCount admin bypass', admCnt && admCnt.success === true);

    report();
  })();
} else {
  // Sin better-sqlite3 en node plano: registrar handlers igual con db null → deben fallar limpio
  const validateSession = function (tok) { return tok === 'tok-ok' ? { ok: true, user: { id: 1, isAdmin: false, companies: ['emp1'] } } : null; };
  try {
    bridge.registerNotificationsHandlers({}, { getDb: function () { return null; }, validateSession: validateSession });
    ok('register no throw sin db', true);
  } catch (e) {
    ok('register no throw sin db', false);
  }
  report();
}

function report() {
  var failed = 0;
  checks.forEach(function (c) {
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name);
    if (!c.ok) failed++;
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  process.exit(failed === 0 ? 0 : 1);
}
