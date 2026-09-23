'use strict';
// Task 5 — Fuentes de calendario en main (12 fuentes) + gate real de bandeja.
// Estáticos (main.js + puentes) + unidades puras sin Electron:
//   - gate (createBandejaGate) contra DB stub + validateSession mock
//   - SQL de no leídos contra el schema REAL (node:sqlite en memoria)
//   - detector: fila sin company_key → 1 aviso por empresa (buzón global)
//   - puentes cargan con mock ipcMain (atrapa el ReferenceError del
//     module.exports con la función dentro del register)
const fs = require('fs');
const path = require('path');
const checks = [];
function ok(n, c) { checks.push({ name: n, ok: !!c }); }

const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const bridgeSrcs = {
  insp: fs.readFileSync(path.join(__dirname, 'inspecciones-bridge.js'), 'utf8'),
  mant: fs.readFileSync(path.join(__dirname, 'mantenimiento-bridge.js'), 'utf8'),
  gest: fs.readFileSync(path.join(__dirname, 'gestacion-bridge.js'), 'utf8'),
  aud: fs.readFileSync(path.join(__dirname, 'auditoria-anual-bridge.js'), 'utf8'),
  rap: fs.readFileSync(path.join(__dirname, 'eventos-rapidos-bridge.js'), 'utf8')
};

// ── Estáticos: main.js — las 12 fuentes ──
ok('define _notifCalendarSources', /_notifCalendarSources/.test(mainSrc));
ok('fuente plan-trabajo (stub)', /id: 'plan-trabajo'/.test(mainSrc));
ok('fuente capacitaciones', /_notifPorEmpresaSource\('capacitaciones'/.test(mainSrc));
ok('fuente auditoria', /id: 'auditoria'/.test(mainSrc));
ok('fuente eventos_rapidos', /id: 'eventos_rapidos'/.test(mainSrc));
ok('fuente gestaciones', /id: 'gestaciones'/.test(mainSrc));
ok('fuente inspecciones', /id: 'inspecciones'/.test(mainSrc));
ok('fuente mantenimiento', /id: 'mantenimiento'/.test(mainSrc));
ok('fuente recordatorio copasst', /_notifGlobalSource\('recordatorio_copasst'/.test(mainSrc));
ok('fuente recordatorio convivencia', /_notifGlobalSource\('recordatorio_convivencia'/.test(mainSrc));
ok('fuente recordatorio presupuesto', /_notifGlobalSource\('recordatorio_presupuesto'/.test(mainSrc));
ok('fuente recordatorio afiliacion', /_notifGlobalSource\('recordatorio_afiliacion'/.test(mainSrc));
ok('fuente recordatorio inducciones', /_notifGlobalSource\('recordatorio_inducciones'/.test(mainSrc));
ok('gate bandeja usa flag real (bandeja_integrada_enabled + notifications)', /bandeja_integrada_enabled/.test(mainSrc) && /notifications/.test(mainSrc));
ok('gate delega en createBandejaGate (criterio del bridge de permisos)', /createBandejaGate\(\{ getDb: getDb, validateSession: validateSession \}/.test(mainSrc));
ok('getEnabledCompanies acotado por conexiones de correo', /email_connections/.test(mainSrc));
ok('capacitaciones reusa _leerCapacitacionesDeEmpresa', /_leerCapacitacionesDeEmpresa/.test(mainSrc));

// Handlers de recordatorios refactorizados: la MISMA función para IPC y fuente
// (no duplicar la lógica fin de semana→lunes).
ok('recordatorio copasst refactorizado a función nombrada', /async function _genRecordatorioCopasstEvents/.test(mainSrc) && /'recordatorio-copasst:get-events', function/.test(mainSrc));
ok('recordatorio convivencia refactorizado', /async function _genRecordatorioConvivenciaEvents/.test(mainSrc) && /'recordatorio-convivencia:get-events', function/.test(mainSrc));
ok('recordatorio presupuesto refactorizado', /async function _genRecordatorioPresupuestoEvents/.test(mainSrc) && /'recordatorio-presupuesto:get-events', function/.test(mainSrc));
ok('recordatorio afiliacion refactorizado', /async function _genRecordatorioAfiliacionEvents/.test(mainSrc) && /'recordatorio-afiliacion:get-events', function/.test(mainSrc));
ok('recordatorio inducciones refactorizado', /async function _genRecordatorioInduccionesEvents/.test(mainSrc) && /'recordatorio-inducciones:get-events', function/.test(mainSrc));

// El bloque de fuentes no duplica la lógica fin de semana→lunes (vive una sola
// vez en las funciones extraídas de los handlers).
var idxFuentes = mainSrc.indexOf('var _notifCalendarSources');
var idxStart = idxFuentes >= 0 ? mainSrc.indexOf('notificationsService.start', idxFuentes) : -1;
ok('fuentes sin dayOfWeek (lógica fin de semana no duplicada)', idxFuentes >= 0 && idxStart > 0 && mainSrc.slice(idxFuentes, idxStart).indexOf('dayOfWeek') === -1);

// ── Unidad: puentes cargan con mock ipcMain y exponen lo que consumen las
//    fuentes. Este test atrapa el ReferenceError de un module.exports que
//    referencia una función declarada DENTRO del register.
const handlers = {};
global._mockIpcMain = { handle: function (ch, fn) { handlers[ch] = fn; }, removeHandler: function () {} };
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'electron') return 'electron-mock';
  return origResolve.call(this, request, ...args);
};
require.cache['electron-mock'] = { id: 'electron-mock', filename: 'electron-mock', loaded: true, exports: { ipcMain: global._mockIpcMain } };

var mantMod = null, gestMod = null, inspMod = null, audMod = null, rapMod = null;
var falloCarga = null;
try {
  mantMod = require('./mantenimiento-bridge.js');
  gestMod = require('./gestacion-bridge.js');
  inspMod = require('./inspecciones-bridge.js');
  audMod = require('./auditoria-anual-bridge.js');
  rapMod = require('./eventos-rapidos-bridge.js');
} catch (e) {
  falloCarga = e;
}
ok('puentes cargan con mock ipcMain (sin ReferenceError)', !falloCarga);
if (falloCarga) console.error('FAIL carga puentes: ' + falloCarga.message);
ok('mantenimiento exporta getCalendarEventsAll', !!(mantMod && typeof mantMod.getCalendarEventsAll === 'function'));
ok('gestaciones exporta _handlerEventosCalendario', !!(gestMod && typeof gestMod._handlerEventosCalendario === 'function'));
if (inspMod && typeof inspMod.registerInspeccionesHandlers === 'function') {
  try {
    inspMod.registerInspeccionesHandlers({ getPath: function () { return '.'; } }, { getCompanyRootPath: async function () { return null; } });
  } catch (e) { console.error('FAIL register inspecciones: ' + e.message); }
}
ok('inspecciones: getEventsCalendario tras register', !!(inspMod && typeof inspMod.getEventsCalendario === 'function'));
if (rapMod && typeof rapMod.registerEventosRapidosHandlers === 'function') {
  try {
    rapMod.registerEventosRapidosHandlers({}, { getDb: function () { return null; } });
  } catch (e) { console.error('FAIL register eventos rapidos: ' + e.message); }
}
ok('eventos rapidos: _listEventosRapidosImpl tras register', !!(rapMod && typeof rapMod._listEventosRapidosImpl === 'function'));
ok('auditoria exporta _getFasesImpl', !!(audMod && typeof audMod._getFasesImpl === 'function'));

// ── Estáticos: extracciones en los puentes ──
ok('inspecciones exporta impl (module.exports.getEventsCalendario)', /module\.exports\.getEventsCalendario = _getEventsCalendarioImpl/.test(bridgeSrcs.insp));
ok('gestaciones exporta _handlerEventosCalendario en module.exports', /_handlerEventosCalendario: _handlerEventosCalendario/.test(bridgeSrcs.gest));
ok('mantenimiento enriquece empresa en scope=all', /res\.data\[k\]\.empresa = compName/.test(bridgeSrcs.mant));
ok('auditoria mapea empresa en eventos de fases', /empresa: r\.empresa_id/.test(bridgeSrcs.aud));
ok('eventos rapidos mapea empresa en _rowToEvent', /empresa: row\.empresa_id/.test(bridgeSrcs.rap));

// ── Unidad: gate real de bandeja (createBandejaGate) ──
// Mismo criterio que bandeja-integrada-permissions-bridge: admin o
// users.bandeja_integrada_enabled=1 del user de la sesión activa.
const gateMod = require('./notifications-gate.js');
function mkDbGate(sessions, users) {
  return {
    prepare: function (sql) {
      if (/FROM sessions/.test(sql)) {
        return { get: function () { return sessions.length ? sessions[0] : null; } };
      }
      if (/bandeja_integrada_enabled/.test(sql) && /FROM users/.test(sql)) {
        return { get: function (id) { return users[id] || null; } };
      }
      return { get: function () { return null; } };
    }
  };
}
const gateNow = Date.parse('2026-09-22T12:00:00.000Z');
ok('gate existe (createBandejaGate exportado)', typeof gateMod.createBandejaGate === 'function');
ok('gate: admin → true (forzado)', gateMod.createBandejaGate({
  getDb: function () { return mkDbGate([{ token: 'tok-a' }], {}); },
  validateSession: function () { return { ok: true, user: { id: 1, isAdmin: true } }; },
  nowMs: function () { return gateNow; }
})() === true);
ok('gate: user con flag=1 → true', gateMod.createBandejaGate({
  getDb: function () { return mkDbGate([{ token: 'tok-b' }], { 2: { bandeja_integrada_enabled: 1 } }); },
  validateSession: function () { return { ok: true, user: { id: 2, isAdmin: false } }; },
  nowMs: function () { return gateNow; }
})() === true);
ok('gate: user con flag=0 → false', gateMod.createBandejaGate({
  getDb: function () { return mkDbGate([{ token: 'tok-c' }], { 2: { bandeja_integrada_enabled: 0 } }); },
  validateSession: function () { return { ok: true, user: { id: 2, isAdmin: false } }; },
  nowMs: function () { return gateNow; }
})() === false);
ok('gate: sin sesión activa → false (fail-closed)', gateMod.createBandejaGate({
  getDb: function () { return mkDbGate([], {}); },
  validateSession: function () { return { ok: true, user: { id: 2, isAdmin: false } }; },
  nowMs: function () { return gateNow; }
})() === false);
ok('gate: sesión inválida → false', gateMod.createBandejaGate({
  getDb: function () { return mkDbGate([{ token: 'tok-d' }], { 2: { bandeja_integrada_enabled: 1 } }); },
  validateSession: function () { return { ok: false, error: { code: 'INVALID_SESSION' } }; },
  nowMs: function () { return gateNow; }
})() === false);
ok('gate: sin getDb → false', gateMod.createBandejaGate({
  validateSession: function () { return { ok: true, user: { id: 1, isAdmin: true } }; },
  nowMs: function () { return gateNow; }
})() === false);

// ── Unidad: SQL de no leídos contra el schema REAL (node:sqlite en memoria) ──
const emailSchema = require('./email-schema-sql.js');
const emailMod = require('./notifications-email.js');
ok('SQL_NO_LEIDOS exportado para el test', typeof emailMod.SQL_NO_LEIDOS === 'string');
ok('SQL_NO_LEIDOS_FALLBACK exportado', typeof emailMod.SQL_NO_LEIDOS_FALLBACK === 'string');
let dbReal = null;
try {
  const { DatabaseSync } = require('node:sqlite');
  dbReal = new DatabaseSync(':memory:');
  dbReal.exec(emailSchema.EMAIL_SCHEMA_SQL);
} catch (e) {
  dbReal = null;
  console.log('SKIP node:sqlite: ' + e.message);
}
if (dbReal) {
  const ahora = Date.now();
  dbReal.prepare(
    "INSERT INTO email_connections (id, email, provider, created_at, updated_at) VALUES (?, ?, 'gmail', ?, ?)"
  ).run('a@gmail.com', 'a@gmail.com', ahora, ahora);
  dbReal.prepare(
    "INSERT INTO email_threads (id, connection_id, subject, snippet, message_count, has_unread, folder, last_message_date, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, 1, 1, 'INBOX', ?, ?, ?)"
  ).run('t1', 'a@gmail.com', 'Asunto real', 'hola', ahora, ahora, ahora);
  dbReal.prepare(
    "INSERT INTO email_threads (id, connection_id, subject, snippet, message_count, has_unread, folder, last_message_date, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, 1, 0, 'INBOX', ?, ?, ?)"
  ).run('t2', 'a@gmail.com', 'Ya leido', 'x', ahora, ahora, ahora);
  try {
    const rows = dbReal.prepare(emailMod.SQL_NO_LEIDOS).all();
    ok('SQL real corre contra schema real', Array.isArray(rows) && rows.length === 1);
    ok('SQL trae columnas del contrato (thread_id/subject)', rows.length === 1 && rows[0].thread_id === 't1' && rows[0].subject === 'Asunto real');
    ok('SQL trae connection_email (mapeo conexión→empresa)', rows.length === 1 && rows[0].connection_email === 'a@gmail.com');
    ok('SQL filtra folder INBOX + solo no leidos', rows.every(function (r) { return r.thread_id !== 't2'; }));
  } catch (e) {
    ok('SQL real corre contra schema real', false);
    console.error('FAIL SQL real: ' + e.message);
  }
  try {
    const rowsF = dbReal.prepare(emailMod.SQL_NO_LEIDOS_FALLBACK).all();
    // El fallback sigue filtrando has_unread=1 (sin folder): solo t1
    ok('SQL fallback corre contra schema real', Array.isArray(rowsF) && rowsF.length === 1 && rowsF[0].thread_id === 't1');
  } catch (e) {
    ok('SQL fallback corre contra schema real', false);
    console.error('FAIL SQL fallback: ' + e.message);
  }
}

// ── Unidad: detector con filas SIN company_key (schema real) →
//    UN solo aviso global company_key='*' (buzón compartido, sin fan-out).
const dbStubSinCompany = {
  prepare: function (sql) {
    if (/has_unread/.test(sql) && /SELECT/.test(sql)) {
      return {
        all: function () {
          return [
            { thread_id: 't1', subject: 'Asunto 1', snippet: 'hola', last_message_date: '2026-09-22T11:00:00Z' }
          ];
        }
      };
    }
    return { all: function () { return []; }, get: function () { return null; }, run: function () { return { changes: 0 }; } };
  }
};

(async function () {
  const detSin = emailMod.createEmailDetector({
    getDb: function () { return dbStubSinCompany; },
    bandejaEnabledFor: function () { return true; },
    trySync: async function () { return false; }
  });
  const resSin = await detSin({ companies: ['emp1', 'emp2'] });
  ok('detector: fila sin company_key → 1 aviso global (no 1 por empresa)', resSin.nuevas.length === 1);
  ok('detector: company_key global *', resSin.nuevas.every(function (n) { return n.companyKey === '*' && n.company_key === '*'; }));
  ok('detector: dedupe key única por thread', new Set(resSin.nuevas.map(function (n) { return n.dedupe_key; })).size === 1);

  const detSinOff = emailMod.createEmailDetector({
    getDb: function () { return dbStubSinCompany; },
    bandejaEnabledFor: function () { return false; },
    trySync: async function () { return false; }
  });
  const resSinOff = await detSinOff({ companies: ['emp1', 'emp2'] });
  ok('detector: gate off → 0 avisos (aun sin company_key)', resSinOff.nuevas.length === 0);

  // Reporte
  var f = 0;
  checks.forEach(function (c) {
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name);
    if (!c.ok) f++;
  });
  console.log((checks.length - f) + '/' + checks.length + ' OK');
  process.exit(f === 0 ? 0 : 1);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
