/**
 * =====================================================================
 * SUBMÓDULO 6.1.2 — AUDITORÍA ANUAL
 * Bridge IPC · Backend Process
 * Patrón: registerHandlers(app, deps) — igual que revision-alta-direccion-bridge.js
 *
 * F1 (2026-06-19) — Cimientos de datos:
 *   - Schema SQLite: auditorias_anual + hallazgos_auditoria
 *   - Handlers IPC: cargarTodo, guardarAuditoria, eliminarAuditoria,
 *                   guardarHallazgo, eliminarHallazgo
 *   - Persistencia en JSON como fallback (igual que 6.1.3)
 * =====================================================================
 */

const { ipcMain, app, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ─── XLSX (SheetJS) para import/export — F4 (2026-06-19) ───────────
var XLSX;
try { XLSX = require('xlsx'); } catch (e) { console.warn('[K+AIRSST][6.1.2][INIT][WARN] xlsx no disponible'); }

// ─── Dependencias inyectadas en registerHandlers ──────────────────────
var _getCompanyRootPath = null;
var _getDb = null;

// ─── Helpers de filesystem ──────────────────────────────────────────

/**
 * Resuelve la ruta del módulo 6.1.2 dentro de la carpeta de la empresa.
 * Misma estrategia que 6.1.3: busca "6. Verificación" / "6.1.2" / recursivo.
 */
function _getEmpresaDir(empresaId) {
  if (!empresaId) {
    const userData = app.getPath('userData');
    return path.join(userData, 'empresas', 'default', '6.1.2');
  }

  var companyRoot = null;
  try {
    var configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      var cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      var normalized = String(empresaId).toLowerCase().trim();
      var companyKey = Object.keys(cfg.companyPaths || {}).find(function(k) {
        return String(k).toLowerCase().trim() === normalized;
      });
      if (companyKey) {
        companyRoot = cfg.companyPaths[companyKey].root || cfg.companyPaths[companyKey].ruta_base || null;
      }
    }
  } catch (e) { /* ignore */ }

  if (!companyRoot || !fs.existsSync(companyRoot)) {
    const userData = app.getPath('userData');
    return path.join(userData, 'empresas', empresaId, '6.1.2');
  }

  var verifVariants = ['6. Verificación', '6. Verificacion'];
  for (var i = 0; i < verifVariants.length; i++) {
    var verifDir = path.join(companyRoot, verifVariants[i]);
    if (fs.existsSync(verifDir)) {
      try {
        var entries = fs.readdirSync(verifDir);
        var subfolder = entries.find(function(f) {
          return f.indexOf('6.1.2') === 0 && fs.statSync(path.join(verifDir, f)).isDirectory();
        });
        if (subfolder) return path.join(verifDir, subfolder);
        return verifDir;
      } catch (e) { /* ignore */ }
    }
  }

  try {
    var rootEntries = fs.readdirSync(companyRoot);
    var verifFolder = rootEntries.find(function(f) {
      return /^6\.\s*Verific/i.test(f) && fs.statSync(path.join(companyRoot, f)).isDirectory();
    });
    if (verifFolder) {
      var folder = path.join(companyRoot, verifFolder);
      var subEntries = fs.readdirSync(folder);
      var sub = subEntries.find(function(f) { return f.indexOf('6.1.2') === 0; });
      if (sub) return path.join(folder, sub);
      return folder;
    }
  } catch (e) { /* ignore */ }

  return path.join(companyRoot, '6. Verificación', '6.1.2 Auditoría Anual');
}

function _ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function _readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) { return null; }
}

function _writeJson(filePath, data) {
  try {
    _ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) { return false; }
}

// ─── Schema SQLite ──────────────────────────────────────────────────

function _ensureSchema(db) {
  if (!db) return;
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS auditorias_anual (
        id              TEXT PRIMARY KEY,
        empresa_id      TEXT NOT NULL,
        nombre          TEXT,
        tipo            TEXT,
        alcance         TEXT,
        fecha_inicio    TEXT,
        fecha_fin       TEXT,
        estado          TEXT,
        auditor_lider   TEXT,
        equipo_json     TEXT,
        trimestre       TEXT,
        calificacion    INTEGER,
        created_at      TEXT,
        updated_at      TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_auditorias_empresa ON auditorias_anual(empresa_id);

      CREATE TABLE IF NOT EXISTS hallazgos_auditoria (
        id                    TEXT PRIMARY KEY,
        empresa_id            TEXT NOT NULL,
        auditoria_id          TEXT NOT NULL,
        codigo                TEXT,
        descripcion           TEXT,
        severidad             TEXT,
        estado                TEXT,
        responsable           TEXT,
        fecha_deteccion       TEXT,
        fecha_cierre          TEXT,
        accion_correctiva     TEXT,
        created_at            TEXT,
        updated_at            TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_hallazgos_empresa ON hallazgos_auditoria(empresa_id);
      CREATE INDEX IF NOT EXISTS idx_hallazgos_auditoria ON hallazgos_auditoria(auditoria_id);
    `);
    _log('DB_SCHEMA', 'Tablas creadas/verificadas');
  } catch (e) {
    _log('DB_SCHEMA', 'Error creando schema: ' + e.message, 'ERROR');
  }
}

// ─── F6 (2026-06-19) — Validaciones + Logging ───────────────────────

/** Logging estandarizado: [K+AIRSST][6.1.2][ACCION] mensaje */
function _log(op, msg, level) {
  var lvl = level || 'INFO';
  var prefix = '[K+AIRSST][6.1.2][' + op + ']';
  if (lvl === 'ERROR') console.error(prefix + ' ' + msg);
  else if (lvl === 'WARN') console.warn(prefix + ' ' + msg);
  else console.log(prefix + ' ' + msg);
}

/** Sanitiza un string: trim + maxlength + colapsa espacios */
function _sanitizeString(v, maxLen) {
  if (v == null) return '';
  var s = String(v).trim().replace(/\s+/g, ' ');
  if (maxLen && s.length > maxLen) s = s.substring(0, maxLen);
  return s;
}

/** Valida fecha YYYY-MM-DD. Retorna null si es inválida o vacía. */
function _sanitizeDate(v) {
  if (!v) return '';
  var s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  /* Validar que la fecha exista (no 2026-13-45) */
  var d = new Date(s + 'T00:00:00Z');
  if (isNaN(d.getTime())) return '';
  if (d.toISOString().slice(0, 10) !== s) return '';
  return s;
}

/** Sanitiza entero en rango [min, max]. null si inválido. */
function _sanitizeInt(v, min, max) {
  if (v === null || v === undefined || v === '') return null;
  var n = parseInt(v, 10);
  if (isNaN(n)) return null;
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

/** Sanitiza array de strings (equipo), filtrando vacíos */
function _sanitizeStringArray(arr, maxItems, maxItemLen) {
  if (!Array.isArray(arr)) return [];
  var result = [];
  for (var i = 0; i < arr.length && result.length < (maxItems || 20); i++) {
    var s = _sanitizeString(arr[i], maxItemLen || 80);
    if (s) result.push(s);
  }
  return result;
}

/** Whitelist de valores permitidos */
var _TIPOS_AUD = ['Interna', 'Especializada', 'Externa'];
var _ESTADOS_AUD = ['programada', 'en-progreso', 'completada', 'cancelada'];
var _TRIMESTRES = ['Q1', 'Q2', 'Q3', 'Q4'];
var _SEVERIDADES = ['critico', 'mayor', 'menor'];
var _ESTADOS_HAL = ['abierto', 'en-progreso', 'cerrado'];

/** Normaliza y sanitiza una auditoría completa. Retorna {ok, data, error} */
function _normalizeAuditoriaInput(a) {
  if (!a || typeof a !== 'object') {
    return { ok: false, error: 'Datos de auditoría inválidos' };
  }
  var id = _sanitizeString(a.id, 60) || null;
  var nombre = _sanitizeString(a.nombre, 200);
  var tipo = _TIPOS_AUD.indexOf(a.tipo) !== -1 ? a.tipo : 'Interna';
  var alcance = _sanitizeString(a.alcance, 300);
  var fechaInicio = _sanitizeDate(a.fechaInicio || a.fecha_inicio);
  var fechaFin = _sanitizeDate(a.fechaFin || a.fecha_fin);
  var estado = _ESTADOS_AUD.indexOf(a.estado) !== -1 ? a.estado : 'programada';
  var auditorLider = _sanitizeString(a.auditorLider || a.auditor_lider, 120);
  var equipo = _sanitizeStringArray(a.equipo, 20, 80);
  var trimestre = _TRIMESTRES.indexOf(a.trimestre) !== -1 ? a.trimestre : '';
  var calificacion = _sanitizeInt(a.calificacion, 0, 100);

  /* Validaciones críticas */
  if (!nombre) return { ok: false, error: 'El nombre es obligatorio.' };
  if (nombre.length < 3) return { ok: false, error: 'El nombre debe tener al menos 3 caracteres.' };
  if (!fechaInicio) return { ok: false, error: 'La fecha de inicio es obligatoria.' };
  if (!fechaFin) return { ok: false, error: 'La fecha de fin es obligatoria.' };
  if (fechaInicio > fechaFin) {
    return { ok: false, error: 'La fecha de inicio no puede ser posterior a la fecha de fin.' };
  }
  if (estado === 'completada' && calificacion === null) {
    /* Sugerir pero no bloquear — el usuario puede completar sin calificar */
  }

  return {
    ok: true,
    data: {
      id: id,
      nombre: nombre,
      tipo: tipo,
      alcance: alcance,
      fechaInicio: fechaInicio,
      fechaFin: fechaFin,
      estado: estado,
      auditorLider: auditorLider,
      equipo: equipo,
      trimestre: trimestre,
      calificacion: calificacion
    }
  };
}

/** Normaliza y sanitiza un hallazgo completo */
function _normalizeHallazgoInput(h) {
  if (!h || typeof h !== 'object') {
    return { ok: false, error: 'Datos de hallazgo inválidos' };
  }
  var id = _sanitizeString(h.id, 60) || null;
  var auditoriaId = _sanitizeString(h.auditoriaId || h.auditoria_id, 60);
  var codigo = _sanitizeString(h.codigo, 30);
  var descripcion = _sanitizeString(h.descripcion, 500);
  var severidad = _SEVERIDADES.indexOf(h.severidad) !== -1 ? h.severidad : 'menor';
  var estado = _ESTADOS_HAL.indexOf(h.estado) !== -1 ? h.estado : 'abierto';
  var responsable = _sanitizeString(h.responsable, 120);
  var fechaDeteccion = _sanitizeDate(h.fechaDeteccion || h.fecha_deteccion);
  var fechaCierre = _sanitizeDate(h.fechaCierre || h.fecha_cierre);
  var accionCorrectiva = _sanitizeString(h.accionCorrectiva || h.accion_correctiva, 300);

  /* Validaciones críticas */
  if (!auditoriaId) return { ok: false, error: 'La auditoría padre es obligatoria.' };
  if (!descripcion) return { ok: false, error: 'La descripción es obligatoria.' };
  if (descripcion.length < 5) return { ok: false, error: 'La descripción debe tener al menos 5 caracteres.' };
  if (estado === 'cerrado' && !fechaCierre) {
    /* Autocompletar fecha de cierre con hoy si el usuario marca cerrado sin fecha */
    fechaCierre = new Date().toISOString().split('T')[0];
  }

  return {
    ok: true,
    data: {
      id: id,
      auditoriaId: auditoriaId,
      codigo: codigo,
      descripcion: descripcion,
      severidad: severidad,
      estado: estado,
      responsable: responsable,
      fechaDeteccion: fechaDeteccion,
      fechaCierre: fechaCierre,
      accionCorrectiva: accionCorrectiva
    }
  };
}

// ─── CRUD SQLite: Auditorías ────────────────────────────────────────

function _loadAuditoriasFromDb(empresaId) {
  if (!_getDb) return null;
  try {
    var db = _getDb();
    var rows = db.prepare('SELECT * FROM auditorias_anual WHERE empresa_id = ? ORDER BY fecha_inicio DESC').all(empresaId);
    _log('LOAD_AUD', 'empresa=' + empresaId + ' encontrados=' + rows.length);
    return rows.map(function(r) {
      var equipo = [];
      try { if (r.equipo_json) equipo = JSON.parse(r.equipo_json); } catch (e) {}
      return {
        id: r.id,
        nombre: r.nombre,
        tipo: r.tipo,
        alcance: r.alcance,
        fechaInicio: r.fecha_inicio,
        fechaFin: r.fecha_fin,
        estado: r.estado,
        auditorLider: r.auditor_lider,
        equipo: equipo,
        trimestre: r.trimestre,
        calificacion: r.calificacion,
        created_at: r.created_at,
        updated_at: r.updated_at
      };
    });
  } catch (e) {
    _log('LOAD_AUD', 'Error: ' + e.message, 'ERROR');
    return null;
  }
}

function _saveAuditoriaToDb(empresaId, aud) {
  if (!_getDb) return { success: false, error: 'NO_DB' };
  try {
    /* F6: normalizar y validar ANTES de tocar la BD */
    var normalized = _normalizeAuditoriaInput(aud);
    if (!normalized.ok) {
      _log('SAVE_AUD', normalized.error, 'WARN');
      return { success: false, error: { code: 'VALIDATION', message: normalized.error } };
    }
    var clean = normalized.data;

    var db = _getDb();
    var now = new Date().toISOString();
    var id = clean.id || ('AUD-' + Date.now());
    var equipoJson = JSON.stringify(clean.equipo || []);
    db.prepare(`
      INSERT INTO auditorias_anual (
        id, empresa_id, nombre, tipo, alcance, fecha_inicio, fecha_fin,
        estado, auditor_lider, equipo_json, trimestre, calificacion, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        nombre = excluded.nombre,
        tipo = excluded.tipo,
        alcance = excluded.alcance,
        fecha_inicio = excluded.fecha_inicio,
        fecha_fin = excluded.fecha_fin,
        estado = excluded.estado,
        auditor_lider = excluded.auditor_lider,
        equipo_json = excluded.equipo_json,
        trimestre = excluded.trimestre,
        calificacion = excluded.calificacion,
        updated_at = excluded.updated_at
    `).run(
      id, empresaId,
      clean.nombre, clean.tipo, clean.alcance,
      clean.fechaInicio, clean.fechaFin,
      clean.estado, clean.auditorLider,
      equipoJson, clean.trimestre,
      clean.calificacion !== null ? clean.calificacion : 0,
      now, now
    );
    _log('SAVE_AUD', 'auditoria=' + id + ' empresa=' + empresaId + ' estado=' + clean.estado);
    return { success: true, data: { id: id } };
  } catch (e) {
    _log('SAVE_AUD', 'Error: ' + e.message, 'ERROR');
    return { success: false, error: { code: 'DB_ERROR', message: 'Error al guardar auditoría: ' + e.message } };
  }
}

function _deleteAuditoriaFromDb(empresaId, id) {
  if (!_getDb) return { success: false, error: 'NO_DB' };
  try {
    var db = _getDb();
    // Borrar hallazgos asociados primero (cascade manual)
    var hals = db.prepare('DELETE FROM hallazgos_auditoria WHERE auditoria_id = ? AND empresa_id = ?').run(id, empresaId);
    var aud = db.prepare('DELETE FROM auditorias_anual WHERE id = ? AND empresa_id = ?').run(id, empresaId);
    _log('DEL_AUD', 'auditoria=' + id + ' empresa=' + empresaId + ' hallazgosBorrados=' + (hals.changes || 0) + ' audBorrada=' + (aud.changes || 0));
    return { success: true };
  } catch (e) {
    _log('DEL_AUD', 'Error: ' + e.message, 'ERROR');
    return { success: false, error: { code: 'DB_ERROR', message: 'Error al eliminar auditoría: ' + e.message } };
  }
}

// ─── CRUD SQLite: Hallazgos ─────────────────────────────────────────

function _loadHallazgosFromDb(empresaId) {
  if (!_getDb) return null;
  try {
    var db = _getDb();
    var rows = db.prepare('SELECT * FROM hallazgos_auditoria WHERE empresa_id = ? ORDER BY created_at DESC').all(empresaId);
    _log('LOAD_HAL', 'empresa=' + empresaId + ' encontrados=' + rows.length);
    return rows.map(function(r) {
      return {
        id: r.id,
        auditoriaId: r.auditoria_id,
        codigo: r.codigo,
        descripcion: r.descripcion,
        severidad: r.severidad,
        estado: r.estado,
        responsable: r.responsable,
        fechaDeteccion: r.fecha_deteccion,
        fechaCierre: r.fecha_cierre,
        accionCorrectiva: r.accion_correctiva,
        created_at: r.created_at,
        updated_at: r.updated_at
      };
    });
  } catch (e) {
    _log('LOAD_HAL', 'Error: ' + e.message, 'ERROR');
    return null;
  }
}

function _saveHallazgoToDb(empresaId, hal) {
  if (!_getDb) return { success: false, error: 'NO_DB' };
  try {
    /* F6: normalizar y validar ANTES de tocar la BD */
    var normalized = _normalizeHallazgoInput(hal);
    if (!normalized.ok) {
      _log('SAVE_HAL', normalized.error, 'WARN');
      return { success: false, error: { code: 'VALIDATION', message: normalized.error } };
    }
    var clean = normalized.data;

    var db = _getDb();
    var now = new Date().toISOString();
    var id = clean.id || ('HAL-' + Date.now());
    db.prepare(`
      INSERT INTO hallazgos_auditoria (
        id, empresa_id, auditoria_id, codigo, descripcion, severidad,
        estado, responsable, fecha_deteccion, fecha_cierre, accion_correctiva,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        auditoria_id = excluded.auditoria_id,
        codigo = excluded.codigo,
        descripcion = excluded.descripcion,
        severidad = excluded.severidad,
        estado = excluded.estado,
        responsable = excluded.responsable,
        fecha_deteccion = excluded.fecha_deteccion,
        fecha_cierre = excluded.fecha_cierre,
        accion_correctiva = excluded.accion_correctiva,
        updated_at = excluded.updated_at
    `).run(
      id, empresaId,
      clean.auditoriaId, clean.codigo,
      clean.descripcion, clean.severidad,
      clean.estado, clean.responsable,
      clean.fechaDeteccion, clean.fechaCierre,
      clean.accionCorrectiva,
      now, now
    );
    _log('SAVE_HAL', 'hallazgo=' + id + ' aud=' + clean.auditoriaId + ' sev=' + clean.severidad + ' est=' + clean.estado);
    return { success: true, data: { id: id } };
  } catch (e) {
    _log('SAVE_HAL', 'Error: ' + e.message, 'ERROR');
    return { success: false, error: { code: 'DB_ERROR', message: 'Error al guardar hallazgo: ' + e.message } };
  }
}

function _deleteHallazgoFromDb(empresaId, id) {
  if (!_getDb) return { success: false, error: 'NO_DB' };
  try {
    var db = _getDb();
    var result = db.prepare('DELETE FROM hallazgos_auditoria WHERE id = ? AND empresa_id = ?').run(id, empresaId);
    _log('DEL_HAL', 'hallazgo=' + id + ' empresa=' + empresaId + ' cambios=' + (result.changes || 0));
    return { success: true };
  } catch (e) {
    _log('DEL_HAL', 'Error: ' + e.message, 'ERROR');
    return { success: false, error: { code: 'DB_ERROR', message: 'Error al eliminar hallazgo: ' + e.message } };
  }
}

// ─── Registro de handlers IPC ────────────────────────────────────────

function registerAuditoriaAnualHandlers(app, deps) {
  _getCompanyRootPath = deps && deps.getCompanyRootPath ? deps.getCompanyRootPath : null;
  _getDb = deps && deps.getDb ? deps.getDb : null;

  // Asegurar schema SQLite al iniciar
  if (_getDb) {
    try { _ensureSchema(_getDb()); } catch (e) { /* ignore */ }
  }

  _log('INIT', 'Registrando handlers de Auditoría Anual...');

  // ── Cargar todo (auditorías + hallazgos) ──
  ipcMain.handle('auditoriaAnual:cargarTodo', async function(event, params) {
    try {
      var empresaId = params && params.empresaId;
      var dir = _getEmpresaDir(empresaId);
      if (!dir) return { success: false, error: { code: 'NO_COMPANY', message: 'Empresa no encontrada: ' + empresaId } };
      _ensureDir(dir);

      // Fuente primaria: SQLite
      var dbAuds = _loadAuditoriasFromDb(empresaId);
      var dbHals = _loadHallazgosFromDb(empresaId);

      var auditorias = (dbAuds !== null) ? dbAuds : (_readJson(path.join(dir, 'auditorias.json')) || []);
      var hallazgos = (dbHals !== null) ? dbHals : (_readJson(path.join(dir, 'hallazgos.json')) || []);

      var fuente = (dbAuds !== null || dbHals !== null) ? 'sqlite' : 'json';
      _log('CARGAR_TODO', 'empresa=' + empresaId + ' fuente=' + fuente + ' auditorias=' + auditorias.length + ' hallazgos=' + hallazgos.length);

      return {
        success: true,
        data: {
          auditorias: auditorias,
          hallazgos: hallazgos,
          fuente: fuente
        }
      };
    } catch (e) {
      _log('CARGAR_TODO', 'Error: ' + e.message, 'ERROR');
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Guardar auditoría (crear o actualizar) ──
  ipcMain.handle('auditoriaAnual:guardarAuditoria', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var auditoria = params.auditoria;
      if (!auditoria) {
        return { success: false, error: { code: 'NO_DATA', message: 'Falta el objeto auditoria' } };
      }
      var dbResult = _saveAuditoriaToDb(empresaId, auditoria);
      if (dbResult.success) {
        return { success: true, data: { id: dbResult.data.id } };
      }
      // Fallback JSON si SQLite falla (después de F6: solo VALIDATION, NO_DB o DB_ERROR)
      if (dbResult.error && dbResult.error.code === 'VALIDATION') {
        return dbResult; /* Propagar error de validación tal cual */
      }
      _log('GUARDAR_AUD', 'SQLite falló, usando fallback JSON: ' + (dbResult.error ? dbResult.error.message : ''), 'WARN');
      var dir = _getEmpresaDir(empresaId);
      var filePath = path.join(dir, 'auditorias.json');
      var existing = _readJson(filePath) || [];
      var idx = existing.findIndex(function(a) { return a.id === auditoria.id; });
      if (idx >= 0) existing[idx] = auditoria;
      else existing.push(auditoria);
      _writeJson(filePath, existing);
      return { success: true, data: { id: auditoria.id || ('AUD-' + Date.now()) }, fuente: 'json-fallback' };
    } catch (e) {
      _log('GUARDAR_AUD', 'Error: ' + e.message, 'ERROR');
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Eliminar auditoría ──
  ipcMain.handle('auditoriaAnual:eliminarAuditoria', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var id = params.id;
      var dbResult = _deleteAuditoriaFromDb(empresaId, id);
      if (dbResult.success) return { success: true };
      _log('ELIMINAR_AUD', 'SQLite falló, usando fallback JSON', 'WARN');
      var dir = _getEmpresaDir(empresaId);
      var filePath = path.join(dir, 'auditorias.json');
      var existing = _readJson(filePath) || [];
      var filtered = existing.filter(function(a) { return a.id !== id; });
      _writeJson(filePath, filtered);
      return { success: true, fuente: 'json-fallback' };
    } catch (e) {
      _log('ELIMINAR_AUD', 'Error: ' + e.message, 'ERROR');
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Guardar hallazgo (crear o actualizar) ──
  ipcMain.handle('auditoriaAnual:guardarHallazgo', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var hallazgo = params.hallazgo;
      if (!hallazgo) {
        return { success: false, error: { code: 'NO_DATA', message: 'Falta el objeto hallazgo' } };
      }
      var dbResult = _saveHallazgoToDb(empresaId, hallazgo);
      if (dbResult.success) {
        return { success: true, data: { id: dbResult.data.id } };
      }
      if (dbResult.error && dbResult.error.code === 'VALIDATION') {
        return dbResult; /* Propagar error de validación tal cual */
      }
      _log('GUARDAR_HAL', 'SQLite falló, usando fallback JSON: ' + (dbResult.error ? dbResult.error.message : ''), 'WARN');
      var dir = _getEmpresaDir(empresaId);
      var filePath = path.join(dir, 'hallazgos.json');
      var existing = _readJson(filePath) || [];
      var idx = existing.findIndex(function(h) { return h.id === hallazgo.id; });
      if (idx >= 0) existing[idx] = hallazgo;
      else existing.push(hallazgo);
      _writeJson(filePath, existing);
      return { success: true, data: { id: hallazgo.id || ('HAL-' + Date.now()) }, fuente: 'json-fallback' };
    } catch (e) {
      _log('GUARDAR_HAL', 'Error: ' + e.message, 'ERROR');
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Eliminar hallazgo ──
  ipcMain.handle('auditoriaAnual:eliminarHallazgo', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var id = params.id;
      var dbResult = _deleteHallazgoFromDb(empresaId, id);
      if (dbResult.success) return { success: true };
      _log('ELIMINAR_HAL', 'SQLite falló, usando fallback JSON', 'WARN');
      var dir = _getEmpresaDir(empresaId);
      var filePath = path.join(dir, 'hallazgos.json');
      var existing = _readJson(filePath) || [];
      var filtered = existing.filter(function(h) { return h.id !== id; });
      _writeJson(filePath, filtered);
      return { success: true, fuente: 'json-fallback' };
    } catch (e) {
      _log('ELIMINAR_HAL', 'Error: ' + e.message, 'ERROR');
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Exportar a XLSX (F4 — 2026-06-19) ──
  ipcMain.handle('auditoriaAnual:exportarXlsx', async function(event, params) {
    try {
      if (!XLSX) return { success: false, error: { code: 'NO_XLSX', message: 'Módulo xlsx no disponible' } };

      var empresaId = params && params.empresaId;
      var dir = _getEmpresaDir(empresaId);
      var exportDir = path.join(dir, 'exports');
      _ensureDir(exportDir);

      var timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      var nombreArchivo = 'G-FO-014_AuditoriaAnual_' + timestamp + '.xlsx';
      var exportPath = path.join(exportDir, nombreArchivo);

      /* Cargar datos: preferir SQLite, fallback a JSON */
      var auditorias = _loadAuditoriasFromDb(empresaId);
      if (auditorias === null) auditorias = _readJson(path.join(dir, 'auditorias.json')) || [];
      var hallazgos = _loadHallazgosFromDb(empresaId);
      if (hallazgos === null) hallazgos = _readJson(path.join(dir, 'hallazgos.json')) || [];

      /* Hoja 1: Auditorías */
      var audRows = [['ID', 'Nombre', 'Tipo', 'Alcance', 'Fecha Inicio', 'Fecha Fin',
                       'Estado', 'Auditor Líder', 'Equipo', 'Trimestre', 'Calificación',
                       'Hallazgos', 'Críticos']];
      auditorias.forEach(function(a) {
        audRows.push([
          a.id || '', a.nombre || '', a.tipo || '', a.alcance || '',
          a.fechaInicio || '', a.fechaFin || '',
          a.estado || '', a.auditorLider || '',
          Array.isArray(a.equipo) ? a.equipo.join(', ') : '',
          a.trimestre || '',
          (a.calificacion !== null && a.calificacion !== undefined) ? a.calificacion : '',
          a.hallazgos || 0, a.hallazgosCriticos || 0
        ]);
      });

      /* Hoja 2: Hallazgos */
      var halRows = [['ID', 'Auditoría ID', 'Código', 'Descripción', 'Severidad', 'Estado',
                       'Responsable', 'Fecha Detección', 'Fecha Cierre', 'Acción Correctiva']];
      hallazgos.forEach(function(h) {
        halRows.push([
          h.id || '', h.auditoriaId || '', h.codigo || '',
          h.descripcion || '', h.severidad || '', h.estado || '',
          h.responsable || '', h.fechaDeteccion || '', h.fechaCierre || '',
          h.accionCorrectiva || ''
        ]);
      });

      /* Hoja 3: Resumen (KPI) */
      var totalAud = auditorias.length;
      var completadas = auditorias.filter(function(a) { return a.estado === 'completada'; }).length;
      var enProgreso = auditorias.filter(function(a) { return a.estado === 'en-progreso'; }).length;
      var programadas = auditorias.filter(function(a) { return a.estado === 'programada'; }).length;
      var totalHal = hallazgos.length;
      var halCriticos = hallazgos.filter(function(h) { return h.severidad === 'critico'; }).length;
      var halAbiertos = hallazgos.filter(function(h) { return h.estado !== 'cerrado'; }).length;
      var calificadas = auditorias.filter(function(a) { return a.calificacion !== null && a.calificacion !== undefined; });
      var califProm = calificadas.length > 0
        ? Math.round(calificadas.reduce(function(s, a) { return s + (a.calificacion || 0); }, 0) / calificadas.length)
        : 0;

      var resumenRows = [
        ['Métrica', 'Valor'],
        ['Total Auditorías', totalAud],
        ['Completadas', completadas],
        ['En Progreso', enProgreso],
        ['Programadas', programadas],
        ['Total Hallazgos', totalHal],
        ['Hallazgos Críticos', halCriticos],
        ['Hallazgos Abiertos', halAbiertos],
        ['Calificación Promedio', califProm + '%'],
        ['Empresa', empresaId],
        ['Fecha Exportación', new Date().toISOString()]
      ];

      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(audRows), 'Auditorías');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(halRows), 'Hallazgos');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumenRows), 'Resumen');

      XLSX.writeFile(wb, exportPath);

      _log('EXPORTAR_XLSX', 'empresa=' + empresaId + ' auditorias=' + auditorias.length + ' hallazgos=' + hallazgos.length + ' → ' + exportPath);

      return {
        success: true,
        data: {
          ruta: exportPath,
          archivo: nombreArchivo,
          auditorias: auditorias.length,
          hallazgos: hallazgos.length
        }
      };
    } catch (e) {
      _log('EXPORTAR_XLSX', 'Error: ' + e.message, 'ERROR');
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Importar desde XLSX (F4 — 2026-06-19) ──

  // Helper: mostrar diálogo nativo para seleccionar archivo
  ipcMain.handle('auditoriaAnual:seleccionarArchivoImportar', async function(event) {
    try {
      var result = await dialog.showOpenDialog({
        title: 'Seleccionar archivo Excel para importar',
        properties: ['openFile'],
        filters: [
          { name: 'Archivos Excel', extensions: ['xlsx', 'xls'] }
        ]
      });
      if (result.canceled || !result.filePaths.length) {
        return { success: false, error: { code: 'CANCELLED', message: 'Selección cancelada' } };
      }
      return { success: true, data: { archivoPath: result.filePaths[0] } };
    } catch (e) {
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  ipcMain.handle('auditoriaAnual:importarXlsx', async function(event, params) {
    try {
      if (!XLSX) return { success: false, error: { code: 'NO_XLSX', message: 'Módulo xlsx no disponible' } };

      var empresaId = params && params.empresaId;
      var archivoPath = params && params.archivoPath;

      if (!archivoPath || !fs.existsSync(archivoPath)) {
        return { success: false, error: { code: 'FILE_NOT_FOUND', message: 'Archivo no encontrado' } };
      }

      var wb = XLSX.readFile(archivoPath, { cellDates: true });
      var importados = { auditorias: 0, hallazgos: 0, errores: [] };

      /* Hoja "Auditorías" → INSERT/UPDATE en BD */
      if (wb.SheetNames.indexOf('Auditorías') !== -1) {
        var sheetAud = wb.Sheets['Auditorías'];
        var rowsAud = XLSX.utils.sheet_to_json(sheetAud, { header: 1, defval: '' });
        if (rowsAud.length > 1) {
          for (var i = 1; i < rowsAud.length; i++) {
            var row = rowsAud[i];
            if (!row || !row[0]) continue; // saltar filas vacías
            var aud = {
              id: String(row[0] || '').trim() || null,
              nombre: String(row[1] || '').trim(),
              tipo: String(row[2] || 'Interna').trim(),
              alcance: String(row[3] || '').trim(),
              fechaInicio: formatXlsxDate(row[4]),
              fechaFin: formatXlsxDate(row[5]),
              estado: String(row[6] || 'programada').trim(),
              auditorLider: String(row[7] || '').trim(),
              equipo: String(row[8] || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean),
              trimestre: String(row[9] || '').trim(),
              calificacion: row[10] === '' || row[10] === null || row[10] === undefined
                ? null
                : parseInt(row[10], 10),
              hallazgos: parseInt(row[11], 10) || 0,
              hallazgosCriticos: parseInt(row[12], 10) || 0
            };
            if (!aud.nombre) continue;
            try {
              _saveAuditoriaToDb(empresaId, aud);
              importados.auditorias++;
            } catch (e) {
              importados.errores.push('Auditoría fila ' + (i + 1) + ': ' + e.message);
            }
          }
        }
      }

      /* Hoja "Hallazgos" → INSERT/UPDATE en BD */
      if (wb.SheetNames.indexOf('Hallazgos') !== -1) {
        var sheetHal = wb.Sheets['Hallazgos'];
        var rowsHal = XLSX.utils.sheet_to_json(sheetHal, { header: 1, defval: '' });
        if (rowsHal.length > 1) {
          for (var j = 1; j < rowsHal.length; j++) {
            var rowH = rowsHal[j];
            if (!rowH || !rowH[0]) continue;
            var hal = {
              id: String(rowH[0] || '').trim() || null,
              auditoriaId: String(rowH[1] || '').trim(),
              codigo: String(rowH[2] || '').trim(),
              descripcion: String(rowH[3] || '').trim(),
              severidad: String(rowH[4] || 'menor').trim(),
              estado: String(rowH[5] || 'abierto').trim(),
              responsable: String(rowH[6] || '').trim(),
              fechaDeteccion: formatXlsxDate(rowH[7]),
              fechaCierre: formatXlsxDate(rowH[8]),
              accionCorrectiva: String(rowH[9] || '').trim()
            };
            if (!hal.auditoriaId || !hal.descripcion) continue;
            try {
              _saveHallazgoToDb(empresaId, hal);
              importados.hallazgos++;
            } catch (e) {
              importados.errores.push('Hallazgo fila ' + (j + 1) + ': ' + e.message);
            }
          }
        }
      }

      _log('IMPORTAR_XLSX', 'empresa=' + empresaId + ' importados=' + JSON.stringify(importados));

      return { success: true, data: importados };
    } catch (e) {
      _log('IMPORTAR_XLSX', 'Error: ' + e.message, 'ERROR');
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  /* Helper: convierte una celda Excel fecha a string YYYY-MM-DD */
  function formatXlsxDate(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date) {
      var y = v.getFullYear();
      var m = String(v.getMonth() + 1).padStart(2, '0');
      var d = String(v.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + d;
    }
    var s = String(v).trim();
    /* Si viene como número serial de Excel (ej: 46000), convertir */
    if (/^\d+(\.\d+)?$/.test(s) && !isNaN(parseFloat(s))) {
      var n = parseFloat(s);
      if (n > 25569 && n < 80000) { /* rango razonable */
        var ms = (n - 25569) * 86400 * 1000;
        var date = new Date(ms);
        var yy = date.getFullYear();
        var mm = String(date.getMonth() + 1).padStart(2, '0');
        var dd = String(date.getDate()).padStart(2, '0');
        return yy + '-' + mm + '-' + dd;
      }
    }
    return s;
  }

  _log('INIT', 'Handlers de Auditoría Anual registrados correctamente (7 canales)');
}

module.exports = { registerAuditoriaAnualHandlers: registerAuditoriaAnualHandlers };
