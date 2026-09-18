/**
 * main/evaluaciones-medicas-bridge.js
 *
 * Bridge IPC para persistir los CERTIFICADOS DE APTITUD del submódulo 3.1.4
 * Evaluaciones Médicas Ocupacionales.
 *
 * Antes este submódulo NO guardaba nada: era un explorador de carpetas
 * (`getDocumentFolders` + `readDirectory`) que solo listaba y previsualizaba
 * archivos del disco. El rediseño (📦762) introduce el registro de certificados
 * con control de vigencia, así que hace falta dónde guardarlos.
 *
 * Esquema:
 *   evaluaciones_medicas_certificados:
 *     id                  TEXT PRIMARY KEY  (UUID v4)
 *     empresa_id          TEXT NOT NULL     (los certificados son por empresa)
 *     trabajador          TEXT NOT NULL
 *     cedula              TEXT NOT NULL
 *     cargo               TEXT
 *     area                TEXT
 *     tipo                TEXT NOT NULL     (Preingreso | Periódico | ...)
 *     ips                 TEXT
 *     fecha_examen        TEXT NOT NULL     (ISO yyyy-mm-dd)
 *     vencimiento         TEXT              (ISO; solo en los periódicos)
 *     concepto            TEXT NOT NULL     (APTO | APTO CON RECOMENDACIONES | APLAZADO | NO APTO)
 *     recomendaciones     TEXT
 *     archivo             TEXT              (ruta del certificado escaneado)
 *     certificado_origen  TEXT              (id del certificado que este renueva)
 *     creado_en           TEXT NOT NULL     (ISO timestamp)
 *     actualizado_en      TEXT NOT NULL     (ISO timestamp)
 *
 * Diseño:
 *   - Columnas explícitas (no un JSON): el control de vigencia se consulta por
 *     `vencimiento` y `empresa_id`, y conviene poder filtrar/ordenar en SQL.
 *   - `certificado_origen` implementa la regla de la Res. 2346 de 2007 art. 12:
 *     una renovación NO modifica ni borra el certificado anterior, agrega uno
 *     nuevo y queda enlazado al que reemplaza. Así el historial del trabajador
 *     se reconstruye sin perder nada.
 *   - UPSERT por id.
 *   - `cedula` se normaliza (sin puntos ni espacios) para poder agrupar el
 *     historial de un trabajador aunque la escriban distinto en cada carga.
 */

'use strict';

const { ipcMain } = require('electron');

const MOD = 'EMO-CERT';

// ---------- DB handle inyectada por main.js ----------
let _getDb = null;

// ---------- Catálogos válidos (espejo de los del módulo) ----------
const TIPOS_VALIDOS = [
  'Preingreso', 'Periódico', 'Cambio de Ocupación', 'Post-Incapacidad',
  'Retorno al Trabajo', 'Retiro', 'Seguimiento', 'Ingreso'
];
const CONCEPTOS_VALIDOS = [
  'APTO', 'APTO CON RECOMENDACIONES', 'APLAZADO', 'NO APTO'
];

// ---------- SQL Schema ----------
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS evaluaciones_medicas_certificados (
    id                  TEXT PRIMARY KEY,
    empresa_id          TEXT NOT NULL,
    trabajador          TEXT NOT NULL,
    cedula              TEXT NOT NULL,
    cargo               TEXT,
    area                TEXT,
    tipo                TEXT NOT NULL,
    ips                 TEXT,
    fecha_examen        TEXT NOT NULL,
    vencimiento         TEXT,
    concepto            TEXT NOT NULL,
    recomendaciones     TEXT,
    archivo             TEXT,
    certificado_origen  TEXT,
    creado_en           TEXT NOT NULL,
    actualizado_en      TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_emo_cert_empresa
    ON evaluaciones_medicas_certificados(empresa_id);
  CREATE INDEX IF NOT EXISTS idx_emo_cert_empresa_cedula
    ON evaluaciones_medicas_certificados(empresa_id, cedula);
  CREATE INDEX IF NOT EXISTS idx_emo_cert_vencimiento
    ON evaluaciones_medicas_certificados(empresa_id, vencimiento);
`;

// ---------- Helpers internos ----------

function _error(code, message) {
  return { success: false, error: { code: code, message: message } };
}

function _texto(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** Normaliza la cédula: sin puntos, espacios ni guiones. */
function _normalizarCedula(v) {
  return _texto(v).replace(/[.\s-]/g, '');
}

/** Valida una fecha ISO (yyyy-mm-dd) y devuelve '' si no sirve. */
function _fechaIso(v) {
  var t = _texto(v);
  if (!t) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '';
  var d = new Date(t + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return t;
}

function _uuid() {
  try {
    if (require('crypto').randomUUID) return require('crypto').randomUUID();
  } catch (e) { /* sin crypto */ }
  return 'emo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

/** Traduce una fila de la base al objeto que usa la vista. */
function _aVista(row) {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    trabajador: row.trabajador,
    cedula: row.cedula,
    cargo: row.cargo || '',
    area: row.area || '',
    tipo: row.tipo,
    ips: row.ips || '',
    fechaExamen: row.fecha_examen,
    vencimiento: row.vencimiento || '',
    concepto: row.concepto,
    recomendaciones: row.recomendaciones || '',
    archivo: row.archivo || '',
    certificadoOrigen: row.certificado_origen || '',
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en
  };
}

/** Valida y normaliza el certificado que llega desde la vista. */
function _validar(datos) {
  if (!datos || typeof datos !== 'object') {
    return { ok: false, error: _error('VALIDATION', 'Certificado inválido') };
  }
  var trabajador = _texto(datos.trabajador);
  var cedula = _normalizarCedula(datos.cedula);
  var tipo = _texto(datos.tipo);
  var concepto = _texto(datos.concepto).toUpperCase();
  var fechaExamen = _fechaIso(datos.fechaExamen);
  var vencimiento = _fechaIso(datos.vencimiento);

  if (!trabajador) return { ok: false, error: _error('VALIDATION', 'El nombre del trabajador es obligatorio') };
  if (!cedula) return { ok: false, error: _error('VALIDATION', 'La cédula es obligatoria') };
  if (!tipo) return { ok: false, error: _error('VALIDATION', 'El tipo de evaluación es obligatorio') };
  if (TIPOS_VALIDOS.indexOf(tipo) < 0) {
    return { ok: false, error: _error('VALIDATION', 'Tipo de evaluación no reconocido: ' + tipo) };
  }
  if (!fechaExamen) return { ok: false, error: _error('VALIDATION', 'La fecha del examen es obligatoria (yyyy-mm-dd)') };
  if (!concepto) return { ok: false, error: _error('VALIDATION', 'El concepto de aptitud es obligatorio') };
  if (CONCEPTOS_VALIDOS.indexOf(concepto) < 0) {
    return { ok: false, error: _error('VALIDATION', 'Concepto de aptitud no reconocido: ' + concepto) };
  }
  var recomendaciones = _texto(datos.recomendaciones);
  if (concepto === 'APTO CON RECOMENDACIONES' && !recomendaciones) {
    return { ok: false, error: _error('VALIDATION', 'El concepto "Apto con recomendaciones" exige registrar las recomendaciones') };
  }
  // El vencimiento solo tiene sentido en los periódicos, pero si viene se valida el orden
  if (vencimiento && vencimiento < fechaExamen) {
    return { ok: false, error: _error('VALIDATION', 'El vencimiento no puede ser anterior a la fecha del examen') };
  }

  return {
    ok: true,
    datos: {
      trabajador: trabajador,
      cedula: cedula,
      cargo: _texto(datos.cargo),
      area: _texto(datos.area),
      tipo: tipo,
      ips: _texto(datos.ips),
      fechaExamen: fechaExamen,
      vencimiento: vencimiento,
      concepto: concepto,
      recomendaciones: recomendaciones,
      archivo: _texto(datos.archivo),
      certificadoOrigen: _texto(datos.certificadoOrigen)
    }
  };
}

// ---------- Handlers internos (reusables, testeables) ----------

/** Lista los certificados de una empresa. */
function _handlerListar(empresaId) {
  if (!_getDb) return _error('NO_DB', 'Base de datos no disponible');
  if (!empresaId) return _error('VALIDATION', 'empresaId requerido');
  try {
    var db = _getDb();
    if (!db) return _error('NO_DB', 'Base de datos no disponible');
    var rows = db.prepare(
      'SELECT * FROM evaluaciones_medicas_certificados WHERE empresa_id = ? ORDER BY fecha_examen DESC, creado_en DESC'
    ).all(empresaId);
    return { success: true, data: rows.map(_aVista) };
  } catch (e) {
    console.error('[' + MOD + '] Error listando:', e.message);
    return _error('DB_ERROR', e.message);
  }
}

/** Crea o actualiza un certificado (UPSERT por id). */
function _handlerGuardar(empresaId, datos) {
  if (!_getDb) return _error('NO_DB', 'Base de datos no disponible');
  if (!empresaId) return _error('VALIDATION', 'empresaId requerido');

  var v = _validar(datos);
  if (!v.ok) return v.error;
  var d = v.datos;

  try {
    var db = _getDb();
    if (!db) return _error('NO_DB', 'Base de datos no disponible');

    var id = _texto(datos.id) || _uuid();
    var ahora = new Date().toISOString();
    var existente = db.prepare(
      'SELECT id, creado_en FROM evaluaciones_medicas_certificados WHERE id = ? AND empresa_id = ?'
    ).get(id, empresaId);

    if (existente) {
      db.prepare(
        'UPDATE evaluaciones_medicas_certificados SET trabajador=?, cedula=?, cargo=?, area=?, tipo=?, ips=?, ' +
        'fecha_examen=?, vencimiento=?, concepto=?, recomendaciones=?, archivo=?, certificado_origen=?, actualizado_en=? ' +
        'WHERE id=? AND empresa_id=?'
      ).run(d.trabajador, d.cedula, d.cargo, d.area, d.tipo, d.ips, d.fechaExamen, d.vencimiento,
        d.concepto, d.recomendaciones, d.archivo, d.certificadoOrigen, ahora, id, empresaId);
    } else {
      db.prepare(
        'INSERT INTO evaluaciones_medicas_certificados ' +
        '(id, empresa_id, trabajador, cedula, cargo, area, tipo, ips, fecha_examen, vencimiento, concepto, ' +
        ' recomendaciones, archivo, certificado_origen, creado_en, actualizado_en) ' +
        'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
      ).run(id, empresaId, d.trabajador, d.cedula, d.cargo, d.area, d.tipo, d.ips, d.fechaExamen,
        d.vencimiento, d.concepto, d.recomendaciones, d.archivo, d.certificadoOrigen, ahora, ahora);
    }

    var fila = db.prepare('SELECT * FROM evaluaciones_medicas_certificados WHERE id = ?').get(id);
    console.log('[' + MOD + '] Guardado id=' + id + ' trabajador=' + d.trabajador + ' concepto=' + d.concepto);
    return { success: true, data: _aVista(fila) };
  } catch (e) {
    console.error('[' + MOD + '] Error guardando:', e.message);
    return _error('DB_ERROR', e.message);
  }
}

/** Elimina un certificado. */
function _handlerEliminar(empresaId, id) {
  if (!_getDb) return _error('NO_DB', 'Base de datos no disponible');
  if (!empresaId) return _error('VALIDATION', 'empresaId requerido');
  if (!id) return _error('VALIDATION', 'id requerido');
  try {
    var db = _getDb();
    if (!db) return _error('NO_DB', 'Base de datos no disponible');
    var info = db.prepare(
      'DELETE FROM evaluaciones_medicas_certificados WHERE id = ? AND empresa_id = ?'
    ).run(id, empresaId);
    if (!info || info.changes === 0) {
      return _error('NOT_FOUND', 'No se encontró el certificado a eliminar');
    }
    console.log('[' + MOD + '] Eliminado id=' + id);
    return { success: true, data: { id: id } };
  } catch (e) {
    console.error('[' + MOD + '] Error eliminando:', e.message);
    return _error('DB_ERROR', e.message);
  }
}

// ---------- Registro de los canales ----------
function registerEvaluacionesMedicasHandlers(app, deps) {
  _getDb = (deps && deps.getDb) ? deps.getDb : null;

  ipcMain.handle('evaluaciones-medicas:listar', async function (event, payload) {
    var p = payload || {};
    return _handlerListar(p.empresaId);
  });

  ipcMain.handle('evaluaciones-medicas:guardar', async function (event, payload) {
    var p = payload || {};
    return _handlerGuardar(p.empresaId, p.certificado || p);
  });

  ipcMain.handle('evaluaciones-medicas:eliminar', async function (event, payload) {
    var p = payload || {};
    return _handlerEliminar(p.empresaId, p.id);
  });

  console.log('[' + MOD + '] Handlers registrados: evaluaciones-medicas:listar/guardar/eliminar');
}

module.exports = {
  registerEvaluacionesMedicasHandlers: registerEvaluacionesMedicasHandlers,
  SCHEMA_SQL: SCHEMA_SQL,
  _handlerListar: _handlerListar,
  _handlerGuardar: _handlerGuardar,
  _handlerEliminar: _handlerEliminar,
  _validar: _validar,
  TIPOS_VALIDOS: TIPOS_VALIDOS,
  CONCEPTOS_VALIDOS: CONCEPTOS_VALIDOS
};
