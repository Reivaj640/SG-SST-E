/**
 * =====================================================================
 * SUBMÓDULO 7.1.1 — ACCIONES PREVENTIVAS Y CORRECTIVAS
 * Bridge IPC · Backend Process
 * Patrón: registerHandlers(app, deps) — igual que auditoria-anual-bridge.js
 *
 * F21.43 (2026-06-21) — Refactor al modelo "Matriz de Control Operacional":
 *   - Schema SQLite ampliado: acciones_pc_v2 con campos del GI-FO-014
 *     + análisis 5 porqués + plan de acción tabulado + verificación + cierre
 *   - Tipos: AC (Correctiva), AP (Preventiva), AM (Mejora)
 *   - Estados: ABIERTA / EN PROCESO / CERRADO / VENCIDA
 *   - 15 fuentes oficiales del formato
 *   - Handlers IPC: cargarTodo, guardarAccion, eliminarAccion,
 *                   cambiarEstado, exportarXlsx, importarXlsx
 * =====================================================================
 */

const { ipcMain, app, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ─── XLSX (SheetJS) ─────────────────────────────────────────────────
var XLSX;
try { XLSX = require('xlsx'); } catch (e) { console.warn('[K+AIRSST][7.1.1][INIT][WARN] xlsx no disponible'); }

var _getCompanyRootPath = null;
var _getDb = null;

// ─── Constantes del modelo ─────────────────────────────────────────

var TIPOS = ['AC', 'AP', 'AM'];
var TIPOS_LABEL = { AC: 'Acción Correctiva', AP: 'Acción Preventiva', AM: 'Acción de Mejora' };

var ESTADOS = ['ABIERTA', 'EN PROCESO', 'CERRADO', 'VENCIDA'];
var ESTADOS_LABEL = { 'ABIERTA': 'Abierta', 'EN PROCESO': 'En proceso', 'CERRADO': 'Cerrado', 'VENCIDA': 'Vencida' };

var FUENTES = [
  'Auditoria Interna',
  'Auditoria Externa',
  'Revision Gerencial',
  'Accidente',
  'Indicadores',
  'Manejo de Emergencias',
  'Inspecciones',
  'Observacion de Procesos',
  'Reporte de Condiciones/ Actos inseguros',
  'Investigacion de Accidentes',
  'No Conforme',
  'Resultado de Reuniones, Comites',
  'Manejo del Cambio',
  'Requisitos Legales',
  'Otros'
];

var SISTEMAS_GESTION = ['ISO 9001', 'ISO 14001', 'OHSAS 18001', 'BASC', 'Otro'];

// ─── Helpers de filesystem ──────────────────────────────────────────

function _getEmpresaDir(empresaId) {
  if (!empresaId) {
    const userData = app.getPath('userData');
    return path.join(userData, 'empresas', 'default', '7.1.1');
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
    return path.join(userData, 'empresas', empresaId, '7.1.1');
  }

  var mejorVariants = ['7. Mejoramiento', '7. Mejoramento'];
  for (var i = 0; i < mejorVariants.length; i++) {
    var mejorDir = path.join(companyRoot, mejorVariants[i]);
    if (fs.existsSync(mejorDir)) {
      try {
        var entries = fs.readdirSync(mejorDir);
        var subfolder = entries.find(function(f) {
          return f.indexOf('7.1.1') === 0 && fs.statSync(path.join(mejorDir, f)).isDirectory();
        });
        if (subfolder) return path.join(mejorDir, subfolder);
        return mejorDir;
      } catch (e) { /* ignore */ }
    }
  }

  return path.join(companyRoot, '7. Mejoramiento', '7.1.1 Acciones preventivas y correctivas');
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
    /* F21.43: tabla rediseñada para el modelo "Matriz de Control Operacional".
       Incluye campos para las 6 secciones del formulario: datos básicos,
       descripción, 5 porqués, plan de acción, verificación y cierre. */
    db.exec(`
      CREATE TABLE IF NOT EXISTS acciones_pc (
        id              TEXT PRIMARY KEY,
        empresa_id      TEXT NOT NULL,
        codigo          TEXT,
        fecha           TEXT,
        tipo            TEXT,
        estado          TEXT,
        proceso_pertenece TEXT,
        proceso_solicita TEXT,
        responsable_ejecucion TEXT,
        responsable_cierre TEXT,
        fuente          TEXT,
        sistemas_gestion TEXT,
        descripcion     TEXT,
        observaciones   TEXT,
        causas_json     TEXT,
        plan_accion_json TEXT,
        verificacion_eficacia TEXT,
        cierre_cerrada  INTEGER,
        cierre_responsable TEXT,
        cierre_fecha    TEXT,
        created_at      TEXT,
        updated_at      TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_acciones_pc_empresa ON acciones_pc(empresa_id);
      CREATE INDEX IF NOT EXISTS idx_acciones_pc_estado ON acciones_pc(estado);
    `);
    _log('DB_SCHEMA', 'Tabla acciones_pc (modelo Matriz de Control Operacional) lista');
  } catch (e) {
    _log('DB_SCHEMA', 'Error creando schema: ' + e.message, 'ERROR');
  }
}

// ─── Logging + Validaciones ─────────────────────────────────────────

function _log(op, msg, level) {
  var lvl = level || 'INFO';
  var prefix = '[K+AIRSST][7.1.1][' + op + ']';
  if (lvl === 'ERROR') console.error(prefix + ' ' + msg);
  else if (lvl === 'WARN') console.warn(prefix + ' ' + msg);
  else console.log(prefix + ' ' + msg);
}

function _sanitizeString(v, maxLen) {
  if (v == null) return '';
  var s = String(v).trim().replace(/\s+/g, ' ');
  if (maxLen && s.length > maxLen) s = s.substring(0, maxLen);
  return s;
}

function _sanitizeDate(v) {
  if (!v) return '';
  var s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  var d = new Date(s + 'T00:00:00Z');
  if (isNaN(d.getTime())) return '';
  if (d.toISOString().slice(0, 10) !== s) return '';
  return s;
}

function _sanitizeEnum(v, whitelist, fallback) {
  return whitelist.indexOf(v) !== -1 ? v : fallback;
}

function _sanitizeStringArray(arr, maxItems) {
  if (!Array.isArray(arr)) return [];
  var result = [];
  for (var i = 0; i < arr.length && result.length < (maxItems || 50); i++) {
    var s = _sanitizeString(arr[i], 80);
    if (s) result.push(s);
  }
  return result;
}

function _normalizeAccionInput(a) {
  if (!a || typeof a !== 'object') {
    return { ok: false, error: 'Datos de acción inválidos' };
  }

  var id = _sanitizeString(a.id, 80) || null;
  var codigo = _sanitizeString(a.codigo, 30);
  var fecha = _sanitizeDate(a.fecha);
  var tipo = _sanitizeEnum(a.tipo, TIPOS, 'AC');
  var estado = _sanitizeEnum(a.estado, ESTADOS, 'ABIERTA');

  var procesoPertenece = _sanitizeString(a.procesoPertenece, 120);
  var procesoSolicita = _sanitizeString(a.procesoSolicita, 120);
  var responsableEjecucion = _sanitizeString(a.responsableEjecucion, 120);
  var responsableCierre = _sanitizeString(a.responsableCierre, 120);
  var fuente = _sanitizeEnum(a.fuente, FUENTES, '');
  var sistemas = _sanitizeStringArray(a.sistemasGestion || a.sistemas_gestion, 10);

  var descripcion = _sanitizeString(a.descripcion, 2000);
  var observaciones = _sanitizeString(a.observaciones, 2000);
  var verificacionEficacia = _sanitizeString(a.verificacionEficacia, 4000);

  /* Causas (5 Porqués) — array de hasta 5 strings */
  var causas = [];
  if (Array.isArray(a.causas)) {
    for (var i = 0; i < Math.min(a.causas.length, 5); i++) {
      causas.push(_sanitizeString(a.causas[i], 500));
    }
  } else if (typeof a.causas === 'string') {
    /* Compatibilidad: si viene como string, partir por saltos de línea */
    causas = a.causas.split('\n').slice(0, 5).map(function(s) { return _sanitizeString(s, 500); });
  }

  /* Plan de acción — array de actividades */
  var planAccion = [];
  if (Array.isArray(a.planAccion)) {
    for (var j = 0; j < Math.min(a.planAccion.length, 50); j++) {
      var act = a.planAccion[j];
      if (!act || typeof act !== 'object') continue;
      planAccion.push({
        descripcion: _sanitizeString(act.descripcion, 500),
        fecha: _sanitizeDate(act.fecha),
        responsable: _sanitizeString(act.responsable, 120),
        costo: typeof act.costo === 'number' ? act.costo : (parseFloat(act.costo) || 0),
        realizada: !!act.realizada,
        verifico: _sanitizeString(act.verifico, 120),
        fechaVerif: _sanitizeDate(act.fechaVerif)
      });
    }
  }

  var cierreCerrada = a.cierre && (a.cierre.cerrada === true || a.cierre.cerrada === 'true');
  var cierreResponsable = _sanitizeString(a.cierre && a.cierre.responsable, 120);
  var cierreFecha = _sanitizeDate(a.cierre && a.cierre.fecha);

  /* Validaciones */
  if (!descripcion) return { ok: false, error: 'La descripción del hallazgo es obligatoria.' };
  if (descripcion.length < 10) return { ok: false, error: 'La descripción debe tener al menos 10 caracteres.' };
  if (!procesoPertenece) return { ok: false, error: 'El proceso al que pertenece es obligatorio.' };
  if (!responsableEjecucion) return { ok: false, error: 'El responsable de ejecución es obligatorio.' };
  if (!fuente) return { ok: false, error: 'Debe seleccionar una fuente.' };

  return {
    ok: true,
    data: {
      id: id,
      codigo: codigo,
      fecha: fecha,
      tipo: tipo,
      estado: estado,
      procesoPertenece: procesoPertenece,
      procesoSolicita: procesoSolicita,
      responsableEjecucion: responsableEjecucion,
      responsableCierre: responsableCierre,
      fuente: fuente,
      sistemasGestion: sistemas,
      descripcion: descripcion,
      observaciones: observaciones,
      causas: causas,
      planAccion: planAccion,
      verificacionEficacia: verificacionEficacia,
      cierre: {
        cerrada: cierreCerrada,
        responsable: cierreResponsable,
        fecha: cierreFecha
      }
    }
  };
}

// ─── CRUD SQLite ────────────────────────────────────────────────────

function _loadAccionesFromDb(empresaId) {
  if (!_getDb) return null;
  try {
    var db = _getDb();
    var rows = db.prepare(
      'SELECT * FROM acciones_pc WHERE empresa_id = ? ORDER BY fecha DESC, created_at DESC'
    ).all(empresaId);
    _log('LOAD', 'empresa=' + empresaId + ' encontrados=' + rows.length);
    return rows.map(_rowToAccion);
  } catch (e) {
    _log('LOAD', 'Error: ' + e.message, 'ERROR');
    return null;
  }
}

function _rowToAccion(r) {
  var causas = [];
  var planAccion = [];
  var sistemas = [];
  try { if (r.causas_json) causas = JSON.parse(r.causas_json); } catch (e) {}
  try { if (r.plan_accion_json) planAccion = JSON.parse(r.plan_accion_json); } catch (e) {}
  try { if (r.sistemas_gestion) sistemas = JSON.parse(r.sistemas_gestion); } catch (e) {}

  return {
    id: r.id,
    codigo: r.codigo,
    fecha: r.fecha,
    tipo: r.tipo,
    estado: r.estado,
    procesoPertenece: r.proceso_pertenece,
    procesoSolicita: r.proceso_solicita,
    responsableEjecucion: r.responsable_ejecucion,
    responsableCierre: r.responsable_cierre,
    fuente: r.fuente,
    sistemasGestion: sistemas,
    descripcion: r.descripcion,
    observaciones: r.observaciones,
    causas: causas,
    planAccion: planAccion,
    verificacionEficacia: r.verificacion_eficacia,
    cierre: {
      cerrada: r.cierre_cerrada === 1,
      responsable: r.cierre_responsable,
      fecha: r.cierre_fecha
    },
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

function _saveAccionToDb(empresaId, accion) {
  if (!_getDb) return { success: false, error: 'NO_DB' };
  try {
    var normalized = _normalizeAccionInput(accion);
    if (!normalized.ok) {
      _log('SAVE', normalized.error, 'WARN');
      return { success: false, error: { code: 'VALIDATION', message: normalized.error } };
    }
    var clean = normalized.data;

    var db = _getDb();
    var now = new Date().toISOString();
    var id = clean.id || ('AP-' + Date.now());
    if (!clean.codigo) clean.codigo = 'AP-' + id.slice(-8);

    var causasJson = JSON.stringify(clean.causas || []);
    var planJson = JSON.stringify(clean.planAccion || []);
    var sistemasJson = JSON.stringify(clean.sistemasGestion || []);

    db.prepare(`
      INSERT INTO acciones_pc (
        id, empresa_id, codigo, fecha, tipo, estado,
        proceso_pertenece, proceso_solicita,
        responsable_ejecucion, responsable_cierre, fuente,
        sistemas_gestion, descripcion, observaciones,
        causas_json, plan_accion_json,
        verificacion_eficacia,
        cierre_cerrada, cierre_responsable, cierre_fecha,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        codigo = excluded.codigo,
        fecha = excluded.fecha,
        tipo = excluded.tipo,
        estado = excluded.estado,
        proceso_pertenece = excluded.proceso_pertenece,
        proceso_solicita = excluded.proceso_solicita,
        responsable_ejecucion = excluded.responsable_ejecucion,
        responsable_cierre = excluded.responsable_cierre,
        fuente = excluded.fuente,
        sistemas_gestion = excluded.sistemas_gestion,
        descripcion = excluded.descripcion,
        observaciones = excluded.observaciones,
        causas_json = excluded.causas_json,
        plan_accion_json = excluded.plan_accion_json,
        verificacion_eficacia = excluded.verificacion_eficacia,
        cierre_cerrada = excluded.cierre_cerrada,
        cierre_responsable = excluded.cierre_responsable,
        cierre_fecha = excluded.cierre_fecha,
        updated_at = excluded.updated_at
    `).run(
      id, empresaId, clean.codigo, clean.fecha, clean.tipo, clean.estado,
      clean.procesoPertenece, clean.procesoSolicita,
      clean.responsableEjecucion, clean.responsableCierre, clean.fuente,
      sistemasJson, clean.descripcion, clean.observaciones,
      causasJson, planJson,
      clean.verificacionEficacia,
      clean.cierre.cerrada ? 1 : 0, clean.cierre.responsable, clean.cierre.fecha,
      now, now
    );

    _log('SAVE', 'accion=' + id + ' empresa=' + empresaId + ' estado=' + clean.estado + ' tipo=' + clean.tipo);
    return { success: true, data: { id: id, codigo: clean.codigo } };
  } catch (e) {
    _log('SAVE', 'Error: ' + e.message, 'ERROR');
    return { success: false, error: { code: 'DB_ERROR', message: 'Error al guardar acción: ' + e.message } };
  }
}

function _deleteAccionFromDb(empresaId, id) {
  if (!_getDb) return { success: false, error: 'NO_DB' };
  try {
    var db = _getDb();
    var result = db.prepare('DELETE FROM acciones_pc WHERE id = ? AND empresa_id = ?').run(id, empresaId);
    _log('DELETE', 'accion=' + id + ' empresa=' + empresaId + ' cambios=' + (result.changes || 0));
    return { success: true };
  } catch (e) {
    _log('DELETE', 'Error: ' + e.message, 'ERROR');
    return { success: false, error: { code: 'DB_ERROR', message: 'Error al eliminar acción: ' + e.message } };
  }
}

// ─── Parser Excel GI-FO-014 (modelo Matriz Control Operacional) ─────

/**
 * El GI-FO-014 tiene el header en fila 8 con:
 *   N(0) | DD(1) | MM(2) | AÑO(3) | DESC(4) | TIPO(5) | PROCESO(6) |
 *   FUENTE(7) | CAUSAS(8) | ACTIVIDADES(9) | FECHAS(10) | RESP(11) |
 *   FECHA_CIERRE(12) | OBSERV(13) | STATUS(14)
 */
function _parsearGiFo014(filePath) {
  if (!XLSX) throw new Error('xlsx no disponible');
  var wb = XLSX.readFile(filePath, { cellDates: true });
  var sheetName = wb.SheetNames[0];
  var sheet = wb.Sheets[sheetName];
  var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

  var headerRowIdx = -1;
  for (var i = 0; i < Math.min(rows.length, 15); i++) {
    if (rows[i] && String(rows[i][4] || '').toUpperCase().indexOf('DESCRIPCION') !== -1) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    throw new Error('No se encontró la fila de encabezados del GI-FO-014');
  }

  var acciones = [];
  for (var j = headerRowIdx + 1; j < rows.length; j++) {
    var r = rows[j];
    if (!r) continue;
    var desc = String(r[4] || '').trim();
    if (!desc && !r[1] && !r[2] && !r[3]) continue;

    var statusExcel = String(r[14] || '').trim().toUpperCase();
    var estado = 'ABIERTA';
    if (statusExcel === 'EN PROCESO') estado = 'EN PROCESO';
    else if (statusExcel === 'CERRADO' || statusExcel === 'CERRADA') estado = 'CERRADO';

    var tipoExcel = String(r[5] || '').trim().toUpperCase();
    var tipo = 'AC';
    if (tipoExcel === 'AP') tipo = 'AP';
    else if (tipoExcel === 'AM') tipo = 'AM';

    var fuenteExcel = String(r[7] || '').trim();
    var fuente = _matchFuente(fuenteExcel);

    var fechaHallazgo = '';
    var dd = String(r[1] || '').trim();
    var mm = String(r[2] || '').trim();
    var aa = String(r[3] || '').trim();
    if (dd && mm && aa) {
      fechaHallazgo = aa + '-' + mm.padStart(2, '0') + '-' + dd.padStart(2, '0');
    }

    var fechaCierre = '';
    if (r[12]) {
      try {
        var fc = r[12];
        if (fc instanceof Date) fechaCierre = fc.toISOString().split('T')[0];
        else {
          var parts = String(fc).split('/');
          if (parts.length === 3) fechaCierre = parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
        }
      } catch (e) {}
    }

    /* Causas: partir por saltos de línea */
    var causasRaw = String(r[8] || '').trim();
    var causas = causasRaw ? causasRaw.split(/\r?\n/).filter(function(s) { return s.trim(); }).slice(0, 5) : [];

    acciones.push({
      id: 'AP-FO014-' + Date.now() + '-' + j,
      codigo: '',
      fecha: fechaHallazgo,
      tipo: tipo,
      estado: estado,
      procesoPertenece: String(r[6] || '').trim(),
      procesoSolicita: '',
      responsableEjecucion: String(r[11] || '').trim(),
      responsableCierre: '',
      fuente: fuente,
      sistemasGestion: [],
      descripcion: desc,
      observaciones: String(r[13] || '').trim(),
      causas: causas,
      planAccion: [],
      verificacionEficacia: '',
      cierre: { cerrada: estado === 'CERRADO', responsable: '', fecha: fechaCierre }
    });
  }

  return { archivo: path.basename(filePath), total: acciones.length, acciones: acciones };
}

function _matchFuente(texto) {
  var t = texto.toLowerCase();
  if (t.indexOf('auditoria') !== -1 && t.indexOf('externa') !== -1) return 'Auditoria Externa';
  if (t.indexOf('auditoria') !== -1) return 'Auditoria Interna';
  if (t.indexOf('revision') !== -1) return 'Revision Gerencial';
  if (t.indexOf('emergencia') !== -1) return 'Manejo de Emergencias';
  if (t.indexOf('accidente') !== -1) return 'Investigacion de Accidentes';
  if (t.indexOf('indicador') !== -1) return 'Indicadores';
  if (t.indexOf('inspecci') !== -1) return 'Inspecciones';
  if (t.indexOf('observaci') !== -1) return 'Observacion de Procesos';
  if (t.indexOf('reporte') !== -1) return 'Reporte de Condiciones/ Actos inseguros';
  if (t.indexOf('no conforme') !== -1 || t.indexOf('nc') === 0) return 'No Conforme';
  if (t.indexOf('reunion') !== -1 || t.indexOf('comite') !== -1) return 'Resultado de Reuniones, Comites';
  if (t.indexOf('cambio') !== -1) return 'Manejo del Cambio';
  if (t.indexOf('legal') !== -1 || t.indexOf('requisito') !== -1) return 'Requisitos Legales';
  return 'Otros';
}

// ─── Registro de handlers IPC ────────────────────────────────────────

function registerAccionesPreventivasCorrectivasHandlers(app, deps) {
  _getCompanyRootPath = deps && deps.getCompanyRootPath ? deps.getCompanyRootPath : null;
  _getDb = deps && deps.getDb ? deps.getDb : null;

  if (_getDb) {
    try { _ensureSchema(_getDb()); } catch (e) { /* ignore */ }
  }

  _log('INIT', 'Registrando handlers de Acciones Preventivas y Correctivas (Matriz Control Operacional)...');

  // ── Cargar todo ──
  // F21.44 (2026-06-21) — Fuente primaria = Excel GI-FO-014 del repositorio.
  //   1. Buscar el archivo Excel en la carpeta de la empresa (recursivo).
  //   2. Si existe, parsearlo y usarlo como fuente de verdad.
  //   3. Combinar con SQLite (cambios nuevos del usuario) por ID sin duplicar.
  //   4. Si no hay Excel, fallback a SQLite/JSON.
  function _findGiFo014(dir) {
    if (!dir || !fs.existsSync(dir)) return null;
    /* Búsqueda recursiva hasta 3 niveles */
    var visit = function(d, depth) {
      if (depth > 3) return null;
      var entries;
      try { entries = fs.readdirSync(d); } catch (e) { return null; }
      /* Preferir el archivo con nombre "MATRIZ" */
      var matriz = entries.find(function(name) {
        return /^GI-FO-014/i.test(name) && /MATRIZ/i.test(name) && /\.(xlsx|xlsm)$/i.test(name);
      });
      if (matriz) return path.join(d, matriz);
      var fo014 = entries.find(function(name) {
        return /^GI-FO-014/i.test(name) && /\.(xlsx|xlsm)$/i.test(name);
      });
      if (fo014) return path.join(d, fo014);
      for (var i = 0; i < entries.length; i++) {
        var full = path.join(d, entries[i]);
        try {
          if (fs.statSync(full).isDirectory()) {
            var found = visit(full, depth + 1);
            if (found) return found;
          }
        } catch (e) {}
      }
      return null;
    };
    return visit(dir, 0);
  }

  ipcMain.handle('accionesPc:cargarTodo', async function(event, params) {
    try {
      var empresaId = params && params.empresaId;
      var dir = _getEmpresaDir(empresaId);
      if (!dir) return { success: false, error: { code: 'NO_COMPANY', message: 'Empresa no encontrada: ' + empresaId } };
      _ensureDir(dir);

      /* Paso 1: leer Excel GI-FO-014 (fuente de verdad) */
      var excelPath = _findGiFo014(dir);
      var accionesExcel = [];
      var excelError = null;
      if (excelPath && XLSX) {
        try {
          var parsed = _parsearGiFo014(excelPath);
          accionesExcel = parsed.acciones.map(function(a) {
            a.__fuente = 'excel';
            a.__archivo = parsed.archivo;
            return a;
          });
        } catch (exErr) {
          excelError = exErr.message;
          _log('CARGAR_TODO', 'Error parseando Excel: ' + exErr.message, 'WARN');
        }
      }

      /* Paso 2: leer SQLite (cache de cambios nuevos) */
      var dbAcciones = _loadAccionesFromDb(empresaId) || [];
      dbAcciones.forEach(function(a) { a.__fuente = a.__fuente || 'sqlite'; });

      /* Paso 3: merge sin duplicar por ID */
      var mapa = {};
      accionesExcel.forEach(function(a) { mapa[a.id] = a; });
      dbAcciones.forEach(function(a) {
        if (!mapa[a.id]) mapa[a.id] = a;
        /* Si el mismo ID está en ambos (porque el usuario re-importó el mismo Excel),
           gana la versión de SQLite (más reciente, edits del usuario). */
        else if (a.updatedAt && mapa[a.id].updatedAt && a.updatedAt > mapa[a.id].updatedAt) {
          mapa[a.id] = a;
        }
      });
      var acciones = Object.keys(mapa).map(function(k) { return mapa[k]; });

      var fuentePrincipal = accionesExcel.length > 0 ? 'excel' : (dbAcciones.length > 0 ? 'sqlite' : 'vacio');
      var totalExcel = accionesExcel.length;
      var totalSqlite = dbAcciones.length;
      var totalNuevo = acciones.filter(function(a) { return a.__fuente === 'sqlite' && accionesExcel.indexOf(a) === -1; }).length;

      _log('CARGAR_TODO', 'empresa=' + empresaId +
        ' fuente=' + fuentePrincipal +
        ' excel=' + totalExcel + ' sqlite=' + totalSqlite +
        ' total=' + acciones.length +
        (excelPath ? ' archivo=' + path.basename(excelPath) : ' sin-excel') +
        (excelError ? ' excelError=' + excelError : '')
      );

      return {
        success: true,
        data: {
          acciones: acciones,
          fuente: fuentePrincipal,
          excelPath: excelPath || null,
          excelDisponible: !!excelPath,
          excelError: excelError,
          conteos: {
            excel: totalExcel,
            sqlite: totalSqlite,
            total: acciones.length,
            pendientesExportar: dbAcciones.filter(function(a) { return a.__fuente === 'sqlite'; }).length
          },
          catalogos: {
            tipos: TIPOS.map(function(t) { return { value: t, label: TIPOS_LABEL[t] }; }),
            estados: ESTADOS.map(function(e) { return { value: e, label: ESTADOS_LABEL[e] }; }),
            fuentes: FUENTES,
            sistemas: SISTEMAS_GESTION
          }
        }
      };
    } catch (e) {
      _log('CARGAR_TODO', 'Error: ' + e.message, 'ERROR');
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Guardar acción ──
  ipcMain.handle('accionesPc:guardarAccion', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var accion = params.accion;
      if (!accion) return { success: false, error: { code: 'NO_DATA', message: 'Falta el objeto acción' } };

      var dbResult = _saveAccionToDb(empresaId, accion);
      if (dbResult.success) return { success: true, data: dbResult.data };

      if (dbResult.error && dbResult.error.code === 'VALIDATION') return dbResult;

      _log('GUARDAR', 'SQLite falló, usando fallback JSON', 'WARN');
      var dir = _getEmpresaDir(empresaId);
      var filePath = path.join(dir, 'acciones.json');
      var existing = _readJson(filePath) || [];
      var idx = existing.findIndex(function(a) { return a.id === accion.id; });
      if (idx >= 0) existing[idx] = accion;
      else existing.unshift(accion);
      _writeJson(filePath, existing);
      return { success: true, data: { id: accion.id || ('AP-' + Date.now()) }, fuente: 'json-fallback' };
    } catch (e) {
      _log('GUARDAR', 'Error: ' + e.message, 'ERROR');
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Eliminar acción ──
  ipcMain.handle('accionesPc:eliminarAccion', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var id = params.id;
      var dbResult = _deleteAccionFromDb(empresaId, id);
      if (dbResult.success) return { success: true };
      _log('ELIMINAR', 'SQLite falló, usando fallback JSON', 'WARN');
      var dir = _getEmpresaDir(empresaId);
      var filePath = path.join(dir, 'acciones.json');
      var existing = _readJson(filePath) || [];
      var filtered = existing.filter(function(a) { return a.id !== id; });
      _writeJson(filePath, filtered);
      return { success: true, fuente: 'json-fallback' };
    } catch (e) {
      _log('ELIMINAR', 'Error: ' + e.message, 'ERROR');
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Cambiar estado ──
  ipcMain.handle('accionesPc:cambiarEstado', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var id = params.id;
      var nuevoEstado = params.estado;
      if (ESTADOS.indexOf(nuevoEstado) === -1) {
        return { success: false, error: { code: 'VALIDATION', message: 'Estado inválido: ' + nuevoEstado } };
      }

      var accion = null;
      if (_getDb) {
        try {
          var db = _getDb();
          var row = db.prepare('SELECT * FROM acciones_pc WHERE id = ? AND empresa_id = ?').get(id, empresaId);
          if (row) accion = _rowToAccion(row);
        } catch (e) {}
      }
      if (!accion) {
        var dir = _getEmpresaDir(empresaId);
        var existing = _readJson(path.join(dir, 'acciones.json')) || [];
        accion = existing.find(function(a) { return a.id === id; });
      }
      if (!accion) return { success: false, error: { code: 'NOT_FOUND', message: 'Acción no encontrada' } };

      accion.estado = nuevoEstado;
      if (nuevoEstado === 'CERRADO' && accion.cierre) {
        accion.cierre.cerrada = true;
        if (!accion.cierre.fecha) accion.cierre.fecha = new Date().toISOString().split('T')[0];
      }
      return _saveAccionToDb(empresaId, accion);
    } catch (e) {
      _log('CAMBIAR_ESTADO', 'Error: ' + e.message, 'ERROR');
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Exportar a XLSX ──
  ipcMain.handle('accionesPc:exportarXlsx', async function(event, params) {
    try {
      if (!XLSX) return { success: false, error: { code: 'NO_XLSX', message: 'xlsx no disponible' } };
      var empresaId = params && params.empresaId;
      var dir = _getEmpresaDir(empresaId);
      _ensureDir(dir);

      var acciones = _loadAccionesFromDb(empresaId);
      if (acciones === null) acciones = _readJson(path.join(dir, 'acciones.json')) || [];

      var rows = [['Código', 'Fecha', 'Tipo', 'Estado', 'Proceso Pertenece', 'Proceso Solicita',
                   'Responsable Ejecución', 'Responsable Cierre', 'Fuente',
                   'Sistemas Gestión', 'Descripción', 'Observaciones',
                   'Causas (5 Porqués)', 'Verificación Eficacia', 'Cerrada',
                   'Responsable Cierre Formal', 'Fecha Cierre Formal']];
      acciones.forEach(function(a) {
        rows.push([
          a.codigo || '', a.fecha || '', a.tipo || '', a.estado || '',
          a.procesoPertenece || '', a.procesoSolicita || '',
          a.responsableEjecucion || '', a.responsableCierre || '',
          a.fuente || '',
          (a.sistemasGestion || []).join('; '),
          a.descripcion || '', a.observaciones || '',
          (a.causas || []).join(' | '),
          a.verificacionEficacia || '',
          a.cierre && a.cierre.cerrada ? 'Sí' : 'No',
          a.cierre && a.cierre.responsable || '',
          a.cierre && a.cierre.fecha || ''
        ]);
      });

      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 14 }, { wch: 12 }, { wch: 6 }, { wch: 12 }, { wch: 24 }, { wch: 24 },
        { wch: 24 }, { wch: 24 }, { wch: 32 }, { wch: 24 },
        { wch: 50 }, { wch: 40 }, { wch: 50 }, { wch: 40 },
        { wch: 8 }, { wch: 24 }, { wch: 14 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Matriz Control Operacional');

      var timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      var nombreArchivo = 'Matriz_Control_Operacional_' + empresaId + '_' + timestamp + '.xlsx';
      var exportPath = path.join(dir, nombreArchivo);
      XLSX.writeFile(wb, exportPath);

      _log('EXPORTAR_XLSX', 'empresa=' + empresaId + ' acciones=' + acciones.length);
      return { success: true, data: { ruta: exportPath, archivo: nombreArchivo, acciones: acciones.length } };
    } catch (e) {
      _log('EXPORTAR_XLSX', 'Error: ' + e.message, 'ERROR');
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Importar desde XLSX (GI-FO-014) ──
  ipcMain.handle('accionesPc:importarXlsx', async function(event, params) {
    try {
      if (!XLSX) return { success: false, error: { code: 'NO_XLSX', message: 'xlsx no disponible' } };
      var empresaId = params && params.empresaId;
      var archivoPath = params && params.archivoPath;
      if (!archivoPath || !fs.existsSync(archivoPath)) {
        return { success: false, error: { code: 'FILE_NOT_FOUND', message: 'Archivo no encontrado' } };
      }

      var result;
      try {
        result = _parsearGiFo014(archivoPath);
      } catch (parseErr) {
        return { success: false, error: { code: 'PARSE_ERROR', message: parseErr.message } };
      }

      var importados = 0;
      var errores = [];
      result.acciones.forEach(function(a, idx) {
        var r = _saveAccionToDb(empresaId, a);
        if (r.success) importados++;
        else errores.push('Fila ' + (idx + 1) + ': ' + (r.error ? r.error.message : 'error'));
      });

      _log('IMPORTAR_XLSX', 'archivo=' + result.archivo + ' importados=' + importados + ' errores=' + errores.length);
      return {
        success: true,
        data: { archivo: result.archivo, totalLeidas: result.total, importados: importados, errores: errores }
      };
    } catch (e) {
      _log('IMPORTAR_XLSX', 'Error: ' + e.message, 'ERROR');
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Selector de archivo ──
  ipcMain.handle('accionesPc:seleccionarArchivoImportar', async function() {
    try {
      var result = await dialog.showOpenDialog({
        title: 'Seleccionar GI-FO-014 para importar',
        properties: ['openFile'],
        filters: [{ name: 'Archivos Excel', extensions: ['xlsx', 'xls'] }]
      });
      if (result.canceled || !result.filePaths.length) {
        return { success: false, error: { code: 'CANCELLED', message: 'Selección cancelada' } };
      }
      return { success: true, data: { archivoPath: result.filePaths[0] } };
    } catch (e) {
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });
}

module.exports = {
  registerAccionesPreventivasCorrectivasHandlers: registerAccionesPreventivasCorrectivasHandlers
};
