/**
 * notifications-bridge.js
 * Bridge IPC para notificaciones persistentes (correo + eventos).
 * Patrón: registerNotificationsHandlers(app, { getDb, validateSession })
 */
'use strict';

var SCHEMA_SQL = [
  'CREATE TABLE IF NOT EXISTS notificaciones (',
  '  id            INTEGER PRIMARY KEY AUTOINCREMENT,',
  "  tipo          TEXT NOT NULL CHECK (tipo IN ('correo','evento')),",
  '  ref_id        TEXT NOT NULL,',
  '  company_key   TEXT NOT NULL,',
  '  titulo        TEXT NOT NULL,',
  '  resumen       TEXT,',
  '  fecha_evento  TEXT,',
  "  created_at    TEXT NOT NULL DEFAULT (datetime('now')),",
  '  leida_at      TEXT,',
  '  dedupe_key    TEXT NOT NULL UNIQUE',
  ');',
  // SQLite prohíbe expresiones en UNIQUE de tabla → misma semántica vía índice único con expresión
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_uniq_ref ON notificaciones(tipo, ref_id, company_key, COALESCE(fecha_evento,''));",
  'CREATE INDEX IF NOT EXISTS idx_notif_pendientes',
  '  ON notificaciones(company_key, leida_at, created_at);'
].join('\n');

function buildDedupeKey(tipo, companyKey, refId, fechaEvento, ventanaMs) {
  if (tipo === 'correo') {
    return 'correo:' + companyKey + ':' + refId + ':' + (ventanaMs || 0);
  }
  return 'evento:' + companyKey + ':' + refId + ':' + (fechaEvento || '') + ':' + (ventanaMs || 0);
}

function ventanaRango(nowMs, ventanaMs) {
  return {
    startIso: new Date(nowMs).toISOString(),
    endIso: new Date(nowMs + (ventanaMs || 0)).toISOString()
  };
}

function _ensureSchema(db) {
  if (!db) return;
  db.exec(SCHEMA_SQL);
}

function _companiesFromSession(sess) {
  if (!sess) return [];
  // Dos formas de sesión: la real de validateSession ({ ok, session,
  // user: { id, email, companies, roles, isAdmin } }) y la compacta de tests
  // ({ companies, isAdmin } al tope). Aceptar AMBAS: con la wiring real los
  // datos viven en sess.user; sin esto allowed saldría [] siempre.
  var u = (sess && sess.user) || {};
  if (Array.isArray(sess && sess.companies)) return sess.companies;
  if (Array.isArray(u.companies)) return u.companies;
  if (sess.companyKey) return [sess.companyKey];
  if (u.companyKey) return [u.companyKey];
  if (sess.company) return [sess.company];
  if (u.company) return [u.company];
  return [];
}

function _isAdmin(sess) {
  return !!((sess && sess.user && sess.user.isAdmin) || (sess && sess.isAdmin));
}

function registerNotificationsHandlers(app, deps) {
  var ipcMain = require('electron').ipcMain;
  var getDb = deps && deps.getDb;
  var validateSession = deps && deps.validateSession;
  if (typeof getDb !== 'function') {
    throw new Error('[notifs] registerNotificationsHandlers requiere deps.getDb');
  }
  if (typeof validateSession !== 'function') {
    throw new Error('[notifs] registerNotificationsHandlers requiere deps.validateSession');
  }
  _ensureSchema(getDb());

  ipcMain.handle('notificaciones:listar', async function (event, payload) {
    try {
      payload = payload || {};
      var sess = validateSession(payload.token);
      if (!sess || sess.ok === false) return { success: false, error: 'UNAUTHORIZED' };
      var allowed = _companiesFromSession(sess);
      var companyKey = payload.companyKey || null;
      if (companyKey && allowed.indexOf(companyKey) === -1 && !_isAdmin(sess)) {
        return { success: false, error: 'FORBIDDEN_COMPANY' };
      }
      var db = getDb();
      var limit = Math.min(Math.max(parseInt(payload.limit, 10) || 50, 1), 200);
      var rows;
      if (companyKey) {
        rows = payload.soloNoLeidas
          ? db.prepare('SELECT * FROM notificaciones WHERE company_key = ? AND leida_at IS NULL ORDER BY created_at DESC LIMIT ?').all(companyKey, limit)
          : db.prepare('SELECT * FROM notificaciones WHERE company_key = ? ORDER BY created_at DESC LIMIT ?').all(companyKey, limit);
      } else {
        // solo empresas de la sesión
        if (allowed.length === 0) return { success: true, data: [] };
        var ph = allowed.map(function () { return '?'; }).join(',');
        if (payload.soloNoLeidas) {
          var stmtN1 = db.prepare('SELECT * FROM notificaciones WHERE company_key IN (' + ph + ') AND leida_at IS NULL ORDER BY created_at DESC LIMIT ?');
          rows = stmtN1.all.apply(stmtN1, allowed.concat([limit]));
        } else {
          var stmtN2 = db.prepare('SELECT * FROM notificaciones WHERE company_key IN (' + ph + ') ORDER BY created_at DESC LIMIT ?');
          rows = stmtN2.all.apply(stmtN2, allowed.concat([limit]));
        }
      }
      return {
        success: true,
        data: rows.map(function (r) {
          return {
            id: r.id,
            tipo: r.tipo,
            refId: r.ref_id,
            companyKey: r.company_key,
            titulo: r.titulo,
            resumen: r.resumen,
            fechaEvento: r.fecha_evento,
            createdAt: r.created_at,
            leida: !!r.leida_at
          };
        })
      };
    } catch (e) {
      console.error('[notifs][listar] ' + (e && e.message));
      return { success: false, error: 'DB_ERROR' };
    }
  });

  ipcMain.handle('notificaciones:marcarLeida', async function (event, payload) {
    try {
      payload = payload || {};
      var sess = validateSession(payload.token);
      if (!sess || sess.ok === false) return { success: false, error: 'UNAUTHORIZED' };
      var allowed = _companiesFromSession(sess);
      var ids = Array.isArray(payload.ids) ? payload.ids : [];
      ids = ids.filter(function (n) { return Number.isInteger(n) && n > 0; });
      if (ids.length === 0) return { success: true, data: { updated: 0 } };
      var db = getDb();
      var ph = ids.map(function () { return '?'; }).join(',');
      // solo ids cuya company_key pertenezca a la sesión
      var stmtIds = db.prepare('SELECT id, company_key FROM notificaciones WHERE id IN (' + ph + ')');
      var rows = stmtIds.all.apply(stmtIds, ids);
      var myIds = rows.filter(function (r) { return allowed.indexOf(r.company_key) !== -1; }).map(function (r) { return r.id; });
      if (myIds.length === 0) return { success: true, data: { updated: 0 } };
      var ph2 = myIds.map(function () { return '?'; }).join(',');
      var stmtUpd = db.prepare("UPDATE notificaciones SET leida_at = datetime('now') WHERE id IN (" + ph2 + ") AND leida_at IS NULL");
      var info = stmtUpd.run.apply(stmtUpd, myIds);
      return { success: true, data: { updated: info.changes || 0 } };
    } catch (e) {
      console.error('[notifs][marcarLeida] ' + (e && e.message));
      return { success: false, error: 'DB_ERROR' };
    }
  });

  ipcMain.handle('notificaciones:marcarTodas', async function (event, payload) {
    try {
      payload = payload || {};
      var sess = validateSession(payload.token);
      if (!sess || sess.ok === false) return { success: false, error: 'UNAUTHORIZED' };
      var allowed = _companiesFromSession(sess);
      var companyKey = payload.companyKey || null;
      if (companyKey && allowed.indexOf(companyKey) === -1 && !_isAdmin(sess)) {
        return { success: false, error: 'FORBIDDEN_COMPANY' };
      }
      var db = getDb();
      var target = companyKey ? [companyKey] : allowed;
      if (target.length === 0) return { success: true, data: { updated: 0 } };
      var ph = target.map(function () { return '?'; }).join(',');
      var stmtTodas = db.prepare("UPDATE notificaciones SET leida_at = datetime('now') WHERE company_key IN (" + ph + ") AND leida_at IS NULL");
      var info = stmtTodas.run.apply(stmtTodas, target);
      return { success: true, data: { updated: info.changes || 0 } };
    } catch (e) {
      console.error('[notifs][marcarTodas] ' + (e && e.message));
      return { success: false, error: 'DB_ERROR' };
    }
  });

  ipcMain.handle('notificaciones:getUnreadCount', async function (event, payload) {
    try {
      payload = payload || {};
      var sess = validateSession(payload.token);
      if (!sess || sess.ok === false) return { success: false, error: 'UNAUTHORIZED' };
      var allowed = _companiesFromSession(sess);
      var db = getDb();
      if (payload.companyKey) {
        if (allowed.indexOf(payload.companyKey) === -1 && !_isAdmin(sess)) {
          return { success: false, error: 'FORBIDDEN_COMPANY' };
        }
        var row = db.prepare('SELECT COUNT(*) AS c FROM notificaciones WHERE company_key = ? AND leida_at IS NULL').get(payload.companyKey);
        return { success: true, data: { unread: (row && row.c) || 0 } };
      }
      if (allowed.length === 0) return { success: true, data: { unread: 0 } };
      var ph = allowed.map(function () { return '?'; }).join(',');
      var stmtCnt = db.prepare('SELECT COUNT(*) AS c FROM notificaciones WHERE company_key IN (' + ph + ') AND leida_at IS NULL');
      var row2 = stmtCnt.get.apply(stmtCnt, allowed);
      return { success: true, data: { unread: (row2 && row2.c) || 0 } };
    } catch (e) {
      console.error('[notifs][getUnreadCount] ' + (e && e.message));
      return { success: false, error: 'DB_ERROR' };
    }
  });
}

module.exports = {
  SCHEMA_SQL: SCHEMA_SQL,
  buildDedupeKey: buildDedupeKey,
  ventanaRango: ventanaRango,
  registerNotificationsHandlers: registerNotificationsHandlers
};
