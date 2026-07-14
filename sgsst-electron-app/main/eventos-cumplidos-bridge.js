/**
 * main/eventos-cumplidos-bridge.js
 *
 * Bridge IPC para marcar/desmarcar eventos del K+AIR Calendar como cumplidos
 * (persistente en SQLite). Aplica a CUALQUIER tipo (capacitacion, gestacion,
 * auditoria, plan, rapido, rapido, vencido — lo que el adapter del calendario
 * emita como event.id).
 *
 * Esquema:
 *   eventos_cumplidos:
 *     evento_id  TEXT PRIMARY KEY  (el ID del event que viene del adapter)
 *     empresa_id TEXT NOT NULL     (por seguridad / futuro listado por empresa)
 *     cumplido_en TEXT NOT NULL    (ISO timestamp de cuándo se marcó)
 *     nota        TEXT DEFAULT ''  (opcional, ej: "hecho el 15/07")
 *
 * Diseño:
 *   - NO toca los modulos origen (capacitaciones Excel, gestacion seguimiento,
 *     etc.). El cumplimiento es solo una marca personal en el calendario.
 *   - Persistencia por evento_id (cualquier formato: 'gest-...', 'cap-1-...',
 *     'rapido-uuid', 'aud-...', 'plan-...').
 *   - El adapter del calendario enriquece cada event con `cumplido: true`
 *     y `cumplido_en: ISO` para que el chip del calendario se atenúe.
 */
'use strict';

const { ipcMain } = require('electron');

const MOD = 'EVENTOS-CUMPLIDOS';

// ---------- DB handle inyectada por main.js ----------
let _getDb = null;

// ---------- SQL Schema ----------
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS eventos_cumplidos (
    evento_id   TEXT PRIMARY KEY,
    empresa_id  TEXT NOT NULL,
    cumplido_en TEXT NOT NULL,
    nota        TEXT DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_eventos_cumplidos_empresa
    ON eventos_cumplidos(empresa_id);
`;

// ---------- Handlers internos (reusables, testeables) ----------

/**
 * Lista todos los eventos cumplidos de una empresa.
 * Devuelve un array de { evento_id, empresa_id, cumplido_en, nota }.
 *
 * 📦543 — Soporte para empresaId === null: devuelve cumplidos de TODAS las
 * empresas (usado por el toggle "Todas las empresas" del calendario).
 */
function _handlerListarCumplidos(empresaId) {
  if (!_getDb) {
    return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  }
  try {
    var db = _getDb();
    var rows;
    if (!empresaId) {
      // scope='all' → todas las empresas
      rows = db.prepare(
        'SELECT evento_id, empresa_id, cumplido_en, nota FROM eventos_cumplidos ORDER BY cumplido_en DESC'
      ).all();
    } else {
      rows = db.prepare(
        'SELECT evento_id, empresa_id, cumplido_en, nota FROM eventos_cumplidos WHERE empresa_id = ? ORDER BY cumplido_en DESC'
      ).all(empresaId);
    }
    return { success: true, data: rows };
  } catch (e) {
    console.error('[' + MOD + '][LISTAR]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

/**
 * Marca un evento como cumplido. UPSERT: si ya existe, actualiza nota y timestamp.
 */
function _handlerMarcarCumplido(empresaId, eventoId, nota) {
  if (!_getDb) {
    return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  }
  if (!empresaId || !eventoId) {
    return {
      success: false,
      error: { code: 'VALIDATION', message: 'empresaId y eventoId son requeridos' }
    };
  }
  try {
    var db = _getDb();
    var now = new Date().toISOString();
    db.prepare(`
      INSERT INTO eventos_cumplidos (evento_id, empresa_id, cumplido_en, nota)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(evento_id) DO UPDATE SET
        cumplido_en = excluded.cumplido_en,
        nota        = excluded.nota
    `).run(eventoId, empresaId, now, nota || '');
    console.log('[' + MOD + '][MARCAR] ' + eventoId + ' en ' + empresaId);
    // 📦538 — Trigger push al hub multipc
    try {
      var syncService = require('./sync-service');
      syncService.debouncedPush(empresaId);
    } catch (syncErr) {
      console.warn('[' + MOD + '] No se pudo triggear sync push: ' + syncErr.message);
    }
    return { success: true, data: { eventoId: eventoId, cumplidoEn: now, nota: nota || '' } };
  } catch (e) {
    console.error('[' + MOD + '][MARCAR]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

/**
 * Desmarca un evento cumplido (DELETE).
 */
function _handlerDesmarcarCumplido(empresaId, eventoId) {
  if (!_getDb) {
    return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  }
  if (!empresaId || !eventoId) {
    return {
      success: false,
      error: { code: 'VALIDATION', message: 'empresaId y eventoId son requeridos' }
    };
  }
  try {
    var db = _getDb();
    var result = db.prepare(
      'DELETE FROM eventos_cumplidos WHERE evento_id = ? AND empresa_id = ?'
    ).run(eventoId, empresaId);
    console.log('[' + MOD + '][DESMARCAR] ' + eventoId + ' (cambios=' + result.changes + ')');
    // 📦538 — Trigger push al hub multipc
    try {
      var syncService = require('./sync-service');
      syncService.debouncedPush(empresaId);
    } catch (syncErr) {
      console.warn('[' + MOD + '] No se pudo triggear sync push: ' + syncErr.message);
    }
    return { success: true, deleted: result.changes > 0 };
  } catch (e) {
    console.error('[' + MOD + '][DESMARCAR]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

// ---------- Registro de handlers IPC ----------
function registerEventosCumplidosHandlers(app, deps) {
  _getDb = deps && deps.getDb ? deps.getDb : null;

  console.log('[' + MOD + '][INIT][INFO] Registrando handlers de cumplimiento de eventos...');

  // Listar (consumido por kair-calendar-adapter.js)
  ipcMain.handle('eventos-cumplidos:listar', async function (event, payload) {
    try {
      var params = (payload && typeof payload === 'object') ? payload : {};
      return _handlerListarCumplidos(params.empresaId || (params && params.empresaId));
    } catch (e) {
      console.error('[' + MOD + '][HANDLER-LISTAR]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // Marcar
  ipcMain.handle('eventos-cumplidos:marcar', async function (event, payload) {
    try {
      var params = (payload && typeof payload === 'object') ? payload : {};
      return _handlerMarcarCumplido(params.empresaId, params.eventoId, params.nota);
    } catch (e) {
      console.error('[' + MOD + '][HANDLER-MARCAR]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // Desmarcar
  ipcMain.handle('eventos-cumplidos:desmarcar', async function (event, payload) {
    try {
      var params = (payload && typeof payload === 'object') ? payload : {};
      return _handlerDesmarcarCumplido(params.empresaId, params.eventoId);
    } catch (e) {
      console.error('[' + MOD + '][HANDLER-DESMARCAR]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  console.log('[' + MOD + '][INIT][SUCCESS] 3 handlers de cumplimiento de eventos registrados');
}

module.exports = {
  registerEventosCumplidosHandlers: registerEventosCumplidosHandlers,
  SCHEMA_SQL: SCHEMA_SQL,
  // Exportar handlers internos para tests / debug
  _handlerListarCumplidos: _handlerListarCumplidos,
  _handlerMarcarCumplido: _handlerMarcarCumplido,
  _handlerDesmarcarCumplido: _handlerDesmarcarCumplido
};
