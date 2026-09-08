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
      -- 📦646-fix8 — Columna nueva para persistir el ID del evento en
      -- Google Calendar cuando se sincroniza. Antes no existía y al hacer
      -- delete, el código no sabía el googleEventId en el primer click
      -- (solo se enteraba después del auto-refresh que traía el evento
      -- de vuelta desde Google), obligando al user a hacer 2 clicks
      -- para eliminar el evento. Ahora se guarda apenas se crea en Google.
      google_event_id TEXT,
      -- 📦646-fix11 — Columna nueva para persistir los asistentes del
      -- evento. Antes se guardaban solo en Google Calendar pero no en
      -- K+AIR DB, entonces al editar un evento desde K+AIR el campo
      -- Asistentes aparecía vacío aunque el evento sí tuviera invitados.
      -- Se guarda como JSON array stringificado.
      attendees TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_eventos_rapidos_fecha ON eventos_rapidos(fecha);
    -- 📦646-fix8 — Migración defensiva: ALTER TABLE para DBs creadas antes
    -- de este cambio. SQLite no tiene IF NOT EXISTS para columnas, así que
    -- usamos un try/catch silencioso. Si la columna ya existe, falla
    -- con "duplicate column" y lo ignoramos.
    -- (mejor-sqlite3 no soporta try/catch alrededor de db.exec en ALTER,
    --  así que lo hacemos con un prepared statement directo)
  `);
  // Migración de columnas para DBs existentes. Cada ALTER es idempotente
  // gracias al try/catch.
  try { db.exec("ALTER TABLE eventos_rapidos ADD COLUMN google_event_id TEXT"); } catch (e) { /* ya existe */ }
  try { db.exec("ALTER TABLE eventos_rapidos ADD COLUMN attendees TEXT"); } catch (e) { /* ya existe */ }
  // P0-FILTER-1 (2026-09-07) — Agregar columna empresa_id para que el filtro
  // por empresa del switch "Todas las empresas" funcione. Antes, eventos
  // creados en cualquier empresa quedaban mezclados y se mostraban siempre
  // (sin filtro de empresa al listarlos).
  try { db.exec("ALTER TABLE eventos_rapidos ADD COLUMN empresa_id TEXT"); } catch (e) { /* ya existe */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_eventos_rapidos_empresa ON eventos_rapidos(empresa_id)"); } catch (e) { /* ya existe */ }
}

function _log(level, msg) {
  console.log('[CAL-RAPIDOS][' + level + '] ' + msg);
}

function _rowToEvent(row) {
  if (!row) return null;
  // 📦646-fix11 — Parsear el JSON de attendees (string en DB → array en JS).
  // Si el JSON es inválido o está vacío, devolver array vacío.
  var attendees = [];
  if (row.attendees) {
    try {
      var parsed = JSON.parse(row.attendees);
      if (Array.isArray(parsed)) attendees = parsed;
    } catch (e) {
      // Fallback: si por alguna razón hay texto plano (ej: viejo de antes
      // de este fix), tratarlo como un solo attendee.
      attendees = String(row.attendees).split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    }
  }
  return {
    id: row.id,
    title: row.titulo,
    date: row.fecha,
    start: row.hora_inicio || null,
    end: row.hora_fin || null,
    type: row.tipo || 'rapido',
    description: row.descripcion || '',
    // 📦646-fix8 — Devolver el googleEventId persistido.
    googleEventId: row.google_event_id || null,
    // 📦646-fix11 — Devolver los asistentes como array. La Bandeja
    // Integrada los usa para el campo "Asistentes" del modal de edición
    // y para sincronizar con Google Calendar.
    attendees: attendees,
    // P0-FILTER-1 (2026-09-07) — Devolver empresa_id para que el adapter y
    // la UI puedan filtrar/agrupar por empresa cuando se muestran eventos
    // de múltiples empresas (scope='all' en el switch).
    empresa: row.empresa_id || null
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
  // P0-FILTER-1 (2026-09-07) — Aceptar `currentCompany` en el payload para
  // filtrar por empresa. Sin empresa válida → todos (compatibilidad con
  // scope='all' o sin empresa activa). Con empresa → solo de esa empresa.
  ipcMain.handle('eventos-rapidos:list', async function (event, range) {
    try {
      var db = getDb();
      if (!db) return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
      _ensureSchema(db);

      var start = range && range.start;
      var end = range && range.end;
      // Aceptar tanto `currentCompany` (convención del adapter) como
      // `empresa` (convención del frontend) por defensa.
      var empresaId = (range && (range.currentCompany || range.empresa)) || null;
      // Si la empresa es el placeholder 'default_company' o vacío, tratar como null
      if (empresaId === 'default_company' || empresaId === '') empresaId = null;

      var rows;
      if (_isValidISODate(start) && _isValidISODate(end)) {
        if (empresaId) {
          rows = db.prepare(
            'SELECT id, titulo, fecha, hora_inicio, hora_fin, tipo, descripcion, google_event_id, empresa_id, created_at, updated_at ' +
            'FROM eventos_rapidos WHERE empresa_id = ? AND fecha BETWEEN ? AND ? ORDER BY fecha ASC, hora_inicio ASC'
          ).all(empresaId, start, end);
        } else {
          rows = db.prepare(
            'SELECT id, titulo, fecha, hora_inicio, hora_fin, tipo, descripcion, google_event_id, empresa_id, created_at, updated_at ' +
            'FROM eventos_rapidos WHERE fecha BETWEEN ? AND ? ORDER BY fecha ASC, hora_inicio ASC'
          ).all(start, end);
        }
      } else {
        if (empresaId) {
          rows = db.prepare(
            'SELECT id, titulo, fecha, hora_inicio, hora_fin, tipo, descripcion, google_event_id, empresa_id, created_at, updated_at ' +
            'FROM eventos_rapidos WHERE empresa_id = ? ORDER BY fecha ASC, hora_inicio ASC LIMIT 500'
          ).all(empresaId);
        } else {
          rows = db.prepare(
            'SELECT id, titulo, fecha, hora_inicio, hora_fin, tipo, descripcion, google_event_id, empresa_id, created_at, updated_at ' +
            'FROM eventos_rapidos ORDER BY fecha ASC, hora_inicio ASC LIMIT 500'
          ).all();
        }
      }
      _log('LIST', 'empresa=' + (empresaId || '*') + ' rango=' + (start || '*') + '..' + (end || '*') + ' count=' + rows.length);
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
      // 📦646-fix8 — INSERT con google_event_id. Si el payload lo trae (caso
      // de re-sincronización), lo persistimos. Si no, queda null y se setea
      // después en el update post-Google-create.
      var googleEventId = payload && payload.googleEventId ? String(payload.googleEventId) : null;
      // 📦646-fix11 — Persistir attendees como JSON stringificado. Si el
      // payload trae array, lo guardamos. Si trae null/empty, queda null.
      var attendeesJson = null;
      if (payload && Array.isArray(payload.attendees) && payload.attendees.length > 0) {
        attendeesJson = JSON.stringify(payload.attendees.map(function (a) {
          return String(a || '').trim();
        }).filter(Boolean));
      }
      // P0-FILTER-1 (2026-09-07) — Persistir empresa_id para que el evento
      // pueda filtrarse correctamente. Aceptar `empresa` (frontend) o
      // `currentCompany` (adapter) por compatibilidad. Si el caller no
      // manda ninguno, queda null (evento global — comportamiento legacy).
      var empresaId = (payload && (payload.empresa || payload.currentCompany)) || null;
      if (empresaId === 'default_company' || empresaId === '') empresaId = null;
      db.prepare(
        'INSERT INTO eventos_rapidos (id, titulo, fecha, hora_inicio, hora_fin, tipo, descripcion, google_event_id, attendees, empresa_id, created_at, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, titulo, fecha, horaInicio || null, horaFin || null, tipo, descripcion, googleEventId, attendeesJson, empresaId, now, now);

      _log('CREATE', 'id=' + id + ' titulo=' + titulo + ' empresa=' + (empresaId || '*') + ' fecha=' + fecha + ' attendees=' + (attendeesJson ? attendeesJson.length : 0));
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
      // 📦646-fix8 — Si el payload trae googleEventId, lo actualizamos. Si
      // trae explícitamente null o cadena vacía, lo limpiamos (caso de
      // re-sincronización). Si no trae la key, no tocamos la columna
      // (preservamos el valor anterior).
      var hasGoogleEventId = payload && Object.prototype.hasOwnProperty.call(payload, 'googleEventId');
      var googleEventId = hasGoogleEventId
        ? (payload.googleEventId ? String(payload.googleEventId) : null)
        : undefined; // undefined = no tocar la columna
      // 📦646-fix11 — Misma lógica para attendees. Si el payload trae la
      // key (incluso con array vacío), actualizamos. Si no trae la key,
      // preservamos el valor anterior en DB.
      var hasAttendees = payload && Object.prototype.hasOwnProperty.call(payload, 'attendees');
      var attendeesJson = null;
      if (hasAttendees && Array.isArray(payload.attendees) && payload.attendees.length > 0) {
        attendeesJson = JSON.stringify(payload.attendees.map(function (a) {
          return String(a || '').trim();
        }).filter(Boolean));
      }
      // P0-FILTER-1 (2026-09-07) — empresa_id se PRESERVA en update (igual
      // que googleEventId/attendees). Si el caller no manda la key, no
      // tocamos la columna. Esto evita que un update accidental mueva el
      // evento a otra empresa.
      var hasEmpresa = payload && Object.prototype.hasOwnProperty.call(payload, 'empresa');
      var empresaUpdate = hasEmpresa
        ? ((payload.empresa && payload.empresa !== 'default_company') ? String(payload.empresa) : null)
        : undefined;
      // Construir el UPDATE dinámicamente para no pisar columnas que el
      // caller no mandó (preservar valor anterior en DB).
      var sets = ['titulo = ?', 'fecha = ?', 'hora_inicio = ?', 'hora_fin = ?', 'tipo = ?', 'descripcion = ?', 'updated_at = ?'];
      var params = [titulo, fecha, horaInicio || null, horaFin || null, tipo, descripcion, now];
      if (hasGoogleEventId) {
        sets.push('google_event_id = ?');
        params.push(googleEventId);
      }
      if (hasAttendees) {
        sets.push('attendees = ?');
        params.push(attendeesJson);
      }
      if (hasEmpresa) {
        sets.push('empresa_id = ?');
        params.push(empresaUpdate);
      }
      params.push(id);
      var sql = 'UPDATE eventos_rapidos SET ' + sets.join(', ') + ' WHERE id = ?';
      var stmt = db.prepare(sql);
      stmt.run.apply(stmt, params);

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