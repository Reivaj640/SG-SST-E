/**
 * eventos-rapidos-bridge.js
 * Bridge IPC para la tabla eventos_rapidos (SQLite).
 * Usado por el K+AIR Calendar (botón calendario del header) para crear/editar/eliminar
 * eventos rápidos del usuario, sin necesidad de un módulo específico.
 *
 * Patrón: registro de handlers via registerXxxHandlers(app, deps) — sigue convención
 * de los demás bridges del proyecto (revision-alta-direccion-bridge, auditoria-anual-bridge, etc.)
 *
 * Handlers IPC expuestos:
 *   - eventos-rapidos:list  ({ start, end })  -> { success, data }
 *   - eventos-rapidos:create (event)          -> { success, data }
 *   - eventos-rapidos:update (event)          -> { success, data }
 *   - eventos-rapidos:remove (id)             -> { success, data }
 */

'use strict';

var crypto = require('crypto');

function _newId() {
  return 'rapido-' + crypto.randomBytes(8).toString('hex');
}

function _nowIso() {
  return new Date().toISOString();
}

function _ensureSchema(db) {
  if (!db) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS eventos_rapidos (
      id            TEXT PRIMARY KEY,
      titulo        TEXT NOT NULL,
      fecha         TEXT NOT NULL,
      hora_inicio   TEXT,
      hora_fin      TEXT,
      tipo          TEXT NOT NULL DEFAULT 'rapido',
      descripcion   TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_eventos_rapidos_fecha ON eventos_rapidos(fecha);
  `);
}

function _log(level, msg) {
  console.log('[CAL-RAPIDOS][' + level + '] ' + msg);
}

function _rowToEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.titulo,
    date: row.fecha,
    start: row.hora_inicio || null,
    end: row.hora_fin || null,
    type: row.tipo || 'rapido',
    description: row.descripcion || ''
  };
}

function _isValidISODate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function _isValidTime(s) {
  if (!s) return true;
  return typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
}

function registerEventosRapidosHandlers(app, deps) {
  var ipcMain = require('electron').ipcMain;
  var getDb = deps && deps.getDb;
  if (typeof getDb !== 'function') {
    throw new Error('[eventos-rapidos] registerEventosRapidosHandlers requiere deps.getDb');
  }

  // Asegurar schema la primera vez que se registra el handler.
  _ensureSchema(getDb());

  // ── list ────────────────────────────────────────────────────────────
  ipcMain.handle('eventos-rapidos:list', async function (event, range) {
    try {
      var db = getDb();
      if (!db) return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
      _ensureSchema(db);

      var start = range && range.start;
      var end = range && range.end;

      var rows;
      if (_isValidISODate(start) && _isValidISODate(end)) {
        rows = db.prepare(
          'SELECT id, titulo, fecha, hora_inicio, hora_fin, tipo, descripcion, created_at, updated_at ' +
          'FROM eventos_rapidos WHERE fecha BETWEEN ? AND ? ORDER BY fecha ASC, hora_inicio ASC'
        ).all(start, end);
      } else {
        rows = db.prepare(
          'SELECT id, titulo, fecha, hora_inicio, hora_fin, tipo, descripcion, created_at, updated_at ' +
          'FROM eventos_rapidos ORDER BY fecha ASC, hora_inicio ASC LIMIT 500'
        ).all();
      }
      _log('LIST', 'rango=' + (start || '*') + '..' + (end || '*') + ' count=' + rows.length);
      return { success: true, data: rows.map(_rowToEvent) };
    } catch (err) {
      _log('LIST', 'ERROR ' + err.message);
      return { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } };
    }
  });

  // ── create ──────────────────────────────────────────────────────────
  ipcMain.handle('eventos-rapidos:create', async function (event, payload) {
    try {
      var db = getDb();
      if (!db) return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
      _ensureSchema(db);

      var titulo = (payload && payload.title || '').toString().trim();
      var fecha = payload && payload.date;
      var horaInicio = payload && payload.start;
      var horaFin = payload && payload.end;
      var tipo = (payload && payload.type || 'rapido').toString();
      var descripcion = (payload && payload.description || '').toString().trim();

      if (!titulo) return { success: false, error: { code: 'VALIDATION', message: 'El título es obligatorio' } };
      if (!_isValidISODate(fecha)) return { success: false, error: { code: 'VALIDATION', message: 'Fecha inválida (YYYY-MM-DD)' } };
      if (!_isValidTime(horaInicio)) return { success: false, error: { code: 'VALIDATION', message: 'Hora inicio inválida' } };
      if (!_isValidTime(horaFin)) return { success: false, error: { code: 'VALIDATION', message: 'Hora fin inválida' } };

      var id = _newId();
      var now = _nowIso();
      db.prepare(
        'INSERT INTO eventos_rapidos (id, titulo, fecha, hora_inicio, hora_fin, tipo, descripcion, created_at, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, titulo, fecha, horaInicio || null, horaFin || null, tipo, descripcion, now, now);

      _log('CREATE', 'id=' + id + ' titulo=' + titulo + ' fecha=' + fecha);
      var row = db.prepare('SELECT * FROM eventos_rapidos WHERE id = ?').get(id);
      return { success: true, data: _rowToEvent(row) };
    } catch (err) {
      _log('CREATE', 'ERROR ' + err.message);
      return { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } };
    }
  });

  // ── update ──────────────────────────────────────────────────────────
  ipcMain.handle('eventos-rapidos:update', async function (event, payload) {
    try {
      var db = getDb();
      if (!db) return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
      _ensureSchema(db);

      var id = payload && payload.id;
      if (!id || typeof id !== 'string' || !id.startsWith('rapido-')) {
        return { success: false, error: { code: 'VALIDATION', message: 'ID inválido (debe empezar con rapido-)' } };
      }
      var titulo = (payload.title || '').toString().trim();
      var fecha = payload.date;
      var horaInicio = payload.start;
      var horaFin = payload.end;
      var tipo = (payload.type || 'rapido').toString();
      var descripcion = (payload.description || '').toString().trim();

      if (!titulo) return { success: false, error: { code: 'VALIDATION', message: 'El título es obligatorio' } };
      if (!_isValidISODate(fecha)) return { success: false, error: { code: 'VALIDATION', message: 'Fecha inválida' } };
      if (!_isValidTime(horaInicio)) return { success: false, error: { code: 'VALIDATION', message: 'Hora inicio inválida' } };
      if (!_isValidTime(horaFin)) return { success: false, error: { code: 'VALIDATION', message: 'Hora fin inválida' } };

      var existing = db.prepare('SELECT id FROM eventos_rapidos WHERE id = ?').get(id);
      if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Evento no encontrado' } };

      var now = _nowIso();
      db.prepare(
        'UPDATE eventos_rapidos SET titulo = ?, fecha = ?, hora_inicio = ?, hora_fin = ?, tipo = ?, descripcion = ?, updated_at = ? WHERE id = ?'
      ).run(titulo, fecha, horaInicio || null, horaFin || null, tipo, descripcion, now, id);

      _log('UPDATE', 'id=' + id);
      var row = db.prepare('SELECT * FROM eventos_rapidos WHERE id = ?').get(id);
      return { success: true, data: _rowToEvent(row) };
    } catch (err) {
      _log('UPDATE', 'ERROR ' + err.message);
      return { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } };
    }
  });

  // ── remove ──────────────────────────────────────────────────────────
  ipcMain.handle('eventos-rapidos:remove', async function (event, id) {
    try {
      var db = getDb();
      if (!db) return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
      _ensureSchema(db);

      if (!id || typeof id !== 'string' || !id.startsWith('rapido-')) {
        return { success: false, error: { code: 'VALIDATION', message: 'ID inválido (debe empezar con rapido-)' } };
      }

      var result = db.prepare('DELETE FROM eventos_rapidos WHERE id = ?').run(id);
      if (result.changes === 0) {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Evento no encontrado' } };
      }
      _log('REMOVE', 'id=' + id);
      return { success: true, data: { id: id } };
    } catch (err) {
      _log('REMOVE', 'ERROR ' + err.message);
      return { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } };
    }
  });

  _log('INIT', 'Handlers de eventos-rapidos registrados (4 canales)');
}

module.exports = { registerEventosRapidosHandlers: registerEventosRapidosHandlers };