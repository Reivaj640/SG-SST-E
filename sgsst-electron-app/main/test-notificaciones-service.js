'use strict';
const checks = [];
function ok(name, cond) { checks.push({ name: name, ok: !!cond }); }

// requerir bridge sin electron real: mock
const handlers = {};
global._mockIpcMain = { handle: (ch, fn) => { handlers[ch] = fn; }, removeHandler: () => {} };
const Module = require('module');
const orig = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'electron') return 'electron-mock';
  return orig.call(this, request, ...args);
};
require.cache['electron-mock'] = { id: 'electron-mock', filename: 'electron-mock', loaded: true, exports: { ipcMain: global._mockIpcMain } };

const bridge = require('./notifications-bridge.js');
const service = require('./notifications-service.js');

let db;
let Database;
try {
  Database = require('better-sqlite3');
  db = new Database(':memory:');
} catch (e) {
  console.log('SKIP better-sqlite3: ' + e.message);
  process.exit(0);
}
// better-sqlite3 cargó: un schema roto debe FALLEN el test (no caer en un fallback verde)
try {
  db.exec(bridge.SCHEMA_SQL);
} catch (e) {
  console.error('FAIL SCHEMA: db.exec(bridge.SCHEMA_SQL) falló: ' + (e && e.message));
  process.exit(1);
}

const sent = [];
const fakeWin = {
  webContents: {
    send: function (ch, payload) { sent.push({ ch: ch, payload: payload }); }
  }
};

const now = Date.parse('2026-09-22T12:00:00.000Z');

// Fechas RELATIVAS al now congelado (el servicio parsea date+start como hora local,
// así que se formatean en hora local para que Date.parse devuelva el instante pedido)
function localParts(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return {
    date: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()),
    start: p(d.getHours()) + ':' + p(d.getMinutes())
  };
}
const partsEnVentana = localParts(now + 30 * 60 * 1000);   // now+30min (ventana 1h → dentro)
const partsFuera = localParts(now + 2 * 60 * 60 * 1000);   // now+2h   (ventana 1h → fuera)
const partsPasado = localParts(now - 26 * 60 * 60 * 1000);  // now-26h  (pasado >1h → descartado)

const evEnVentana = {
  id: 'ev-1', title: 'COPASST', date: partsEnVentana.date, start: partsEnVentana.start,
  type: 'recordatorio_copasst', empresa: 'emp1'
};
const evFuera = {
  id: 'ev-2', title: 'Lejano', date: partsFuera.date, start: partsFuera.start,
  type: 'rapido', empresa: 'emp1'
};
const evPasado = {
  id: 'ev-3', title: 'Ayer', date: partsPasado.date, start: partsPasado.start,
  type: 'rapido', empresa: 'emp1'
};

let listCalls = 0;
const sources = [
  {
    id: 'fake',
    list: function (range) {
      listCalls++;
      return [evEnVentana, evFuera, evPasado];
    }
  },
  {
    id: 'rota',
    list: function () { throw new Error('boom fuente'); }
  }
];

service.init({
  getDb: function () { return db; },
  getMainWindow: function () { return fakeWin; },
  getVentanaMs: function () { return 3600000; }, // 1h
  nowMs: function () { return now; },
  sources: sources,
  getEnabledCompanies: function () { return ['emp1']; },
  log: function () {}
});

(async function () {
  const r1 = await service.tick();
  ok('tick no explota con fuente rota', r1 && typeof r1.inserted === 'number');
  ok('fuente rota no mata tick (siguiente fuente corría)', listCalls >= 1);
  ok('inserta evento en ventana', r1.inserted === 1);
  ok('nuevas trae el evento', r1.nuevas.length === 1 && r1.nuevas[0].titulo === 'COPASST');
  ok('emite notificaciones:changed', sent.length >= 1 && sent[0].ch === 'notificaciones:changed');
  ok('payload tiene unreadTotal', typeof sent[0].payload.unreadTotal === 'number' && sent[0].payload.unreadTotal === 1);

  const r2 = await service.tick();
  ok('segundo tick no duplica (dedupe)', r2.inserted === 0);
  ok('emite solo si hubo inserts', sent.length === 1);

  // ventana más amplia → mismo evento otra key; además evFuera (now+2h) queda dentro de now+24h
  service.setVentanaMs(86400000);
  const r3 = await service.tick();
  ok('ventana distinta puede re-notificar', r3.inserted === 2 &&
    r3.nuevas.some(function (n) { return n.titulo === 'COPASST'; }));

  // pasado >1h no se notifica aunque esté "en rango" de fecha
  service.setVentanaMs(3600000);
  const rows = db.prepare('SELECT ref_id FROM notificaciones').all();
  ok('no inserta evPasado', rows.every(function (r) { return r.ref_id.indexOf('ev-3') === -1; }));

  var failed = 0;
  checks.forEach(function (c) {
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name);
    if (!c.ok) failed++;
  });
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  process.exit(failed === 0 ? 0 : 1);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
