/**
 * notifications-service.js
 * Detección en main: eventos de calendario (fuentes inyectables) + correo.
 * Patrón timers: sync-service.startAutoSync.
 *
 * Interfaces:
 *   init({ getDb, getMainWindow, getVentanaMs, nowMs, sources, getEnabledCompanies, log })
 *   tick() -> { inserted, nuevas }
 *   start(intervalMs=60000) / stopAll()
 *   setVentanaMs(ms)
 *   Evento: getMainWindow().webContents.send('notificaciones:changed', { companyKey, unreadTotal, nuevas })
 */
'use strict';

var bridge = require('./notifications-bridge.js');

var MOD = 'NOTIF-SERVICE';
var DEFAULT_INTERVAL_MS = 60000;
var PAST_SLACK_MS = 60 * 60 * 1000; // descartar pasados hace >1h

var _getDb = null;
var _getMainWindow = null;
var _getVentanaMs = null;
var _nowMs = null;
var _sources = [];
var _getEnabledCompanies = null;
var _log = function (l, m) { console.log('[' + MOD + '][' + l + '] ' + m); };
var _timer = null;
var _ventanaMs = 24 * 60 * 60 * 1000;
var _ventanaExplicita = false; // true tras setVentanaMs: manda sobre getVentanaMs inyectado
var _emailDetector = null; // inyectable en Task 3
var _consecFails = 0;
var _backoffUntil = 0;
var _tickEnCurso = false; // guard de reentrada: un tick en curso omita el siguiente disparo

function init(opts) {
  opts = opts || {};
  _getDb = opts.getDb;
  _getMainWindow = opts.getMainWindow;
  _getVentanaMs = opts.getVentanaMs || function () { return _ventanaMs; };
  _nowMs = opts.nowMs || function () { return Date.now(); };
  _sources = opts.sources || [];
  _getEnabledCompanies = opts.getEnabledCompanies || function () { return []; };
  if (opts.log) _log = opts.log;
  if (opts.emailDetector) _emailDetector = opts.emailDetector;
  if (typeof opts.ventanaMs === 'number') {
    _ventanaMs = opts.ventanaMs;
    _ventanaExplicita = true;
  } else {
    _ventanaExplicita = false;
  }
  _log('info', 'init sources=' + _sources.length);
}

function setVentanaMs(ms) {
  if (typeof ms === 'number' && ms > 0) {
    _ventanaMs = ms;
    _ventanaExplicita = true; // setVentanaMs tiene prioridad sobre getVentanaMs inyectado
  }
}

function setEmailDetector(fn) { _emailDetector = fn; }

function _ventana() {
  if (_ventanaExplicita) return _ventanaMs;
  if (typeof _getVentanaMs === 'function') {
    var v = _getVentanaMs();
    if (typeof v === 'number' && v > 0) return v;
  }
  return _ventanaMs;
}

function _asegurarSchema(db) {
  // Lección Task 1: schema idempotente (IF NOT EXISTS). Si falla, DEJA FALLAR fuerte
  // (rechaza el tick) — nunca se traga acá dentro de un catch silencioso.
  if (db) db.exec(bridge.SCHEMA_SQL);
}

function _insertCountIfNew(row) {
  var db = _getDb();
  if (!db) return 0;
  try {
    var info = db.prepare(
      'INSERT OR IGNORE INTO notificaciones (tipo, ref_id, company_key, titulo, resumen, fecha_evento, dedupe_key) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(row.tipo, row.ref_id, row.company_key, row.titulo, row.resumen || null, row.fecha_evento || null, row.dedupe_key);
    return info.changes || 0;
  } catch (e) {
    _log('error', 'insert ' + e.message);
    return 0;
  }
}

function _unreadTotal() {
  var db = _getDb();
  if (!db) return 0;
  var row = db.prepare('SELECT COUNT(*) AS c FROM notificaciones WHERE leida_at IS NULL').get();
  return (row && row.c) || 0;
}

function _isPastStale(dateStr, startStr, now) {
  // fecha YYYY-MM-DD[+hora] → si terminó hace > PAST_SLACK_MS, descartar
  var iso = dateStr;
  if (startStr && /^\d{2}:\d{2}/.test(startStr)) {
    iso = dateStr + 'T' + startStr;
    if (iso.length === 16) iso += ':00';
  }
  var t = Date.parse(iso.length <= 10 ? dateStr + 'T00:00:00' : iso);
  if (isNaN(t)) return false;
  return t < (now - PAST_SLACK_MS);
}

async function tick() {
  if (_nowMs() < _backoffUntil) {
    _log('info', 'tick omitido por backoff (hasta ' + _backoffUntil + ')');
    return { inserted: 0, nuevas: [] };
  }
  var db = _getDb ? _getDb() : null;
  _asegurarSchema(db); // Lección Task 1: schema asegurado también en el tick (idempotente, falla fuerte)
  var inserted = 0;
  var nuevas = [];
  var companies = _getEnabledCompanies() || [];
  var ventana = _ventana();
  var now = _nowMs();
  var range = bridge.ventanaRango(now, ventana);
  var fallosEsteTick = 0;

  // --- eventos por fuente ---
  for (var i = 0; i < _sources.length; i++) {
    var src = _sources[i];
    try {
      var evs = src.list(range) || [];
      // Fuentes síncronas y asíncronas conviven: si list() devuelve una
      // promesa (thenable), esperarla antes de iterar.
      if (evs && typeof evs.then === 'function') evs = (await evs) || [];
      for (var j = 0; j < evs.length; j++) {
        var ev = evs[j];
        if (!ev || !ev.id || !ev.date) continue;
        var emp = ev.empresa || ev.companyKey || companies[0];
        if (!emp) continue;
        if (companies.length && companies.indexOf(emp) === -1) continue;
        if (_isPastStale(ev.date, ev.start, now)) continue;
        // solo eventos dentro de [now - PAST_SLACK, now + ventana] (techo estricto = ventana)
        var evIso = ev.date + (ev.start ? 'T' + ev.start : 'T00:00:00');
        if (ev.start && ev.start.length === 5) evIso += ':00';
        var evT = Date.parse(evIso);
        if (isNaN(evT)) continue;
        if (evT < now - PAST_SLACK_MS || evT > now + ventana) continue;
        // La ventana es parte de la identidad: el índice único compuesto del puente
        // (tipo, ref_id, company_key, fecha_evento) exige que ref_id cambie con la
        // ventana para poder re-notificar al ampliarla (dedupe_key ya la incluye).
        var ref = src.id + ':' + ev.id + ':' + ventana;
        var key = bridge.buildDedupeKey('evento', emp, ref, ev.date + 'T' + (ev.start || '00:00'), ventana);
        var n = _insertCountIfNew({
          tipo: 'evento',
          ref_id: ref,
          company_key: emp,
          titulo: ev.title || ev.titulo || 'Evento',
          resumen: ev.type || ev.tipo || '',
          fecha_evento: evIso,
          dedupe_key: key
        });
        if (n > 0) {
          inserted += n;
          nuevas.push({ tipo: 'evento', titulo: ev.title || 'Evento', companyKey: emp, fechaEvento: evIso });
        }
      }
    } catch (e) {
      _log('error', 'fuente ' + src.id + ': ' + e.message);
      fallosEsteTick++;
    }
  }

  // --- correo (Task 3: inyectado) ---
  if (typeof _emailDetector === 'function') {
    try {
      var mailRes = await _emailDetector({ now: now, companies: companies });
      if (mailRes && mailRes.nuevas) {
        for (var m = 0; m < mailRes.nuevas.length; m++) {
          var row = mailRes.nuevas[m];
          var n2 = _insertCountIfNew(row);
          if (n2 > 0) {
            inserted += n2;
            nuevas.push(row);
          }
        }
      }
    } catch (e) {
      _log('error', 'emailDetector: ' + e.message);
      fallosEsteTick++;
    }
  }

  // backoff tras fallos consecutivos (solo cuenta ticks con fallos reales;
  // un tick sano — sin ningún throw de fuente/email — resetea el contador)
  if (fallosEsteTick > 0) {
    _consecFails += fallosEsteTick;
    if (_consecFails >= 5) {
      var delay = Math.min(5 * 60 * 1000, 30000 * Math.pow(2, _consecFails - 5));
      _backoffUntil = now + delay;
      _log('warn', 'backoff ' + delay + 'ms tras ' + _consecFails + ' fallos');
      _consecFails = 0;
    }
  } else {
    _consecFails = 0;
  }

  if (inserted > 0) {
    var win = _getMainWindow && _getMainWindow();
    if (win && win.webContents) {
      try {
        win.webContents.send('notificaciones:changed', {
          companyKey: nuevas[0] ? nuevas[0].companyKey : null,
          unreadTotal: _unreadTotal(),
          nuevas: nuevas.slice(0, 3)
        });
      } catch (e) {
        _log('error', 'send: ' + e.message);
      }
    }
  }
  return { inserted: inserted, nuevas: nuevas };
}

async function _tickSeguro(label) {
  if (_tickEnCurso) {
    _log('info', label + ': tick en curso, disparo omitido');
    return { inserted: 0, nuevas: [] };
  }
  _tickEnCurso = true;
  try {
    return await tick();
  } catch (e) {
    _log('error', label + ': ' + e.message);
    return { inserted: 0, nuevas: [] };
  } finally {
    _tickEnCurso = false;
  }
}

function start(intervalMs) {
  stopAll();
  var ms = intervalMs || DEFAULT_INTERVAL_MS;
  _timer = setInterval(function () { _tickSeguro('tick'); }, ms);
  if (_timer && typeof _timer.unref === 'function') _timer.unref();
  _log('info', 'start interval=' + ms);
  // tick inmediato
  _tickSeguro('tick inicial');
}

function stopAll() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    _log('info', 'stopAll');
  }
}

module.exports = {
  init: init,
  tick: tick,
  start: start,
  stopAll: stopAll,
  setVentanaMs: setVentanaMs,
  setEmailDetector: setEmailDetector
};
