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

const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const MOD = 'EMO-CERT';

// ---------- DB handle inyectada por main.js ----------
let _getDb = null;
let _getCompanyRootPath = null;

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

// ---------- Adjuntar certificado PDF de la IPS (📦766) ----------

/**
 * Busca en `baseDir` una subcarpeta cuyo nombre empiece por `prefijo` y contenga
 * `clave` (insensible a mayúsculas); si no existe, la crea con `nombreCanonico`.
 * Así la app tolera que en el Drive la carpeta se llame "3. Gestión de la Salud",
 * "3. Gestión de la Salud " o con variaciones, sin romper la ruta.
 */
async function _resolverSubcarpeta(baseDir, prefijo, clave, nombreCanonico) {
  var entries = await fsp.readdir(baseDir, { withFileTypes: true });
  for (var i = 0; i < entries.length; i++) {
    if (!entries[i].isDirectory()) continue;
    var n = entries[i].name;
    if (n.indexOf(prefijo) === 0 && n.toLowerCase().indexOf(clave) !== -1) {
      return path.join(baseDir, n);
    }
  }
  var creada = path.join(baseDir, nombreCanonico);
  await fsp.mkdir(creada, { recursive: true });
  return creada;
}

/**
 * Abre el diálogo nativo para elegir el PDF que entrega la IPS y lo copia a la
 * ruta del backend por año:
 *   <empresa>/3. Gestión de la Salud/3.1.4 Evaluaciones médicas/
 *             3.1.4.1. Certificados de Aptitud Medica/<AÑO del examen>/
 * El año viene del formulario (fecha del examen); si no hay fecha, el año actual.
 * Nunca pisa un archivo existente: agrega " (1)", " (2)"… antes de la extensión.
 */
async function _handlerAdjuntar(p) {
  try {
    var empresa = _texto(p.empresaId);
    if (!empresa) return _error('EMPRESA_REQUERIDA', 'Falta la empresa activa.');
    if (typeof _getCompanyRootPath !== 'function') return _error('NO_CONFIG', 'Ruta de empresa no disponible.');

    var root = await _getCompanyRootPath(empresa);
    if (!root) return _error('NO_COMPANY', 'Empresa no configurada.');

    var dirSalud = await _resolverSubcarpeta(root, '3.', 'salud', '3. Gestión de la Salud');
    var dir314   = await _resolverSubcarpeta(dirSalud, '3.1.4', 'evaluaciones', '3.1.4 Evaluaciones médicas');
    var dir3141  = await _resolverSubcarpeta(dir314, '3.1.4.1', 'aptitud', '3.1.4.1. Certificados de Aptitud Medica');

    var anio = parseInt(p.anio, 10);
    if (!anio || anio < 1900 || anio > 2100) anio = new Date().getFullYear();
    var dirAnio = path.join(dir3141, String(anio));
    await fsp.mkdir(dirAnio, { recursive: true });

    var elegido = await dialog.showOpenDialog({
      title: 'Selecciona el certificado de aptitud (PDF de la IPS)',
      properties: ['openFile'],
      filters: [
        { name: 'Certificado de aptitud', extensions: ['pdf'] },
        { name: 'Imagen escaneada', extensions: ['png', 'jpg', 'jpeg'] },
        { name: 'Todos los archivos', extensions: ['*'] }
      ]
    });
    if (elegido.canceled || !elegido.filePaths || !elegido.filePaths.length) {
      return _error('CANCELADO', 'Selección cancelada.');
    }

    var src = elegido.filePaths[0];
    var nombre = path.basename(src);
    var dest = path.join(dirAnio, nombre);
    if (fs.existsSync(dest)) {
      var ext = path.extname(nombre);
      var base = nombre.slice(0, nombre.length - ext.length);
      var n = 1;
      do {
        dest = path.join(dirAnio, base + ' (' + n + ')' + ext);
        n++;
      } while (fs.existsSync(dest) && n < 1000);
    }
    await fsp.copyFile(src, dest);
    console.log('[' + MOD + '] Certificado adjuntado: ' + dest);
    return { success: true, path: dest, fileName: path.basename(dest), anio: String(anio) };
  } catch (e) {
    console.error('[' + MOD + '] Error adjuntando certificado:', e.message);
    return _error('ADJUNTAR_ERROR', e.message);
  }
}

// ---------- Lectura de datos del certificado PDF de la IPS (📦768) ----------

/** dd/mm/yyyy (o dd-mm-yyyy) → ISO yyyy-mm-dd. '' si no calza. */
function _fechaAISO(fecha) {
  var m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(_texto(fecha));
  if (!m) return '';
  var d = m[1], me = m[2], a = m[3];
  if (parseInt(me, 10) > 12) { var tmp = d; d = me; me = tmp; } /* tolera mm/dd */
  return a + '-' + ('0' + me).slice(-2) + '-' + ('0' + d).slice(-2);
}

/** "Evaluación Médica de Ingreso" → 'Preingreso' (el catálogo del formulario usa
 *  Preingreso como tipo canónico; la IPS lo llama "de Ingreso"). */
function _normalizarTipo(t) {
  var t2 = _texto(t).toUpperCase();
  if (t2.indexOf('PREINGRESO') !== -1) return 'Preingreso';
  if (t2.indexOf('INGRESO') !== -1 && t2.indexOf('REINGRESO') === -1) return 'Preingreso';
  for (var i = 0; i < TIPOS_VALIDOS.length; i++) {
    if (t2.indexOf(TIPOS_VALIDOS[i].toUpperCase()) !== -1) return TIPOS_VALIDOS[i];
  }
  if (t2.indexOf('PERIÓDIC') !== -1 || t2.indexOf('PERIODIC') !== -1) return 'Periódico';
  if (t2.indexOf('RETIRO') !== -1 || t2.indexOf('EGRESO') !== -1) return 'Retiro';
  return '';
}

/**
 * Extrae los campos del formato "CONCEPTO OCUPACIONAL" que emiten las IPS
 * (probado con Comfamiliar Atlántico). Tolerante: devuelve solo lo que encuentre.
 * El texto llega de RemisionUtils.extractTextFromPDF (misma utilidad que usa el
 * submódulo de restricciones médicas).
 */
function extraerDatosCertificado(text) {
  var t = String(text || '').replace(/\r/g, '');
  var d = { trabajador: '', cedula: '', cargo: '', tipo: '', ips: '', fechaExamen: '', conceptoDb: '', recomendaciones: '' };
  var m;

  if ((m = /DOCUMENTO\s*:\s*([A-Za-z]{1,3})[\s.]*([\d.,]+)/i.exec(t))) d.cedula = m[2].replace(/[.,]/g, '');
  if ((m = /PACIENTE\s*:\s*([^\n]+)/i.exec(t))) d.trabajador = m[1].trim();
  if ((m = /Cargo\s*:\s*([^\n]+?)(?:\s+Fecha de atenci[oó]n|\n|$)/i.exec(t))) d.cargo = m[1].trim();
  if ((m = /Evaluaci[oó]n Ocupacional\s*:\s*([^\n]+?)(?:\s+Fecha de atenci[oó]n|\n|$)/i.exec(t))) d.tipo = _normalizarTipo(m[1]);
  if ((m = /Fecha de atenci[oó]n\s*:\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})/i.exec(t))) d.fechaExamen = _fechaAISO(m[1]);
  if ((m = /RECOMENDACIONES LABORALES\s*:\s*([\s\S]*?)(?:\n\s*MANEJO EPS|\n\s*CONCEPTO MEDICO|$)/i.exec(t))) {
    d.recomendaciones = m[1].split('\n').map(function (l) { return l.trim(); }).filter(Boolean).join('\n');
  }
  if ((m = /CONCEPTO MEDICO OCUPACIONAL\s*:\s*([^\n]+)/i.exec(t))) {
    var c = m[1].toUpperCase();
    if (c.indexOf('NO APTO') !== -1) d.conceptoDb = 'NO APTO';
    else if (c.indexOf('APLAZADO') !== -1) d.conceptoDb = 'APLAZADO';
    else if (c.indexOf('RECOMENDACIONES') !== -1 || c.indexOf('RESTRICCIONES') !== -1) d.conceptoDb = 'APTO CON RECOMENDACIONES';
    else if (c.indexOf('APTO') !== -1) d.conceptoDb = 'APTO';
  }
  /* IPS: primera línea con texto del documento (encabezado del formato). */
  var lineas = t.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  if (lineas.length && !/concepto/i.test(lineas[0])) d.ips = lineas[0];

  return d;
}

async function _handlerExtraer(pdfPath) {
  try {
    var ruta = _texto(pdfPath);
    if (!ruta) return _error('PDF_REQUERIDO', 'Falta la ruta del PDF.');
    if (!fs.existsSync(ruta)) return _error('NO_EXISTE', 'No se encontró el archivo.');
    if (!/\.pdf$/i.test(ruta)) return _error('NO_PDF', 'El archivo no es un PDF.');

    var RemisionUtils = require('../utils/remisionUtils.js');
    var texto = await new RemisionUtils().extractTextFromPDF(ruta);
    var data = extraerDatosCertificado(texto);
    if (!data.trabajador && !data.cedula) {
      return _error('FORMATO_NO_RECONOCIDO', 'No se reconoció el formato del certificado. Llena los datos a mano.');
    }
    return { success: true, data: data };
  } catch (e) {
    console.error('[' + MOD + '] Error extrayendo certificado:', e.message);
    return _error('EXTRAER_ERROR', e.message);
  }
}

// ---------- Registro de los canales ----------
function registerEvaluacionesMedicasHandlers(app, deps) {
  _getDb = (deps && deps.getDb) ? deps.getDb : null;
  _getCompanyRootPath = (deps && deps.getCompanyRootPath) ? deps.getCompanyRootPath : null;

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

  ipcMain.handle('evaluaciones-medicas:adjuntar-certificado', async function (event, payload) {
    var p = payload || {};
    return _handlerAdjuntar(p);
  });

  ipcMain.handle('evaluaciones-medicas:extraer-certificado', async function (event, payload) {
    var p = payload || {};
    return _handlerExtraer(p.pdfPath);
  });

  console.log('[' + MOD + '] Handlers registrados: evaluaciones-medicas:listar/guardar/eliminar/adjuntar-certificado/extraer-certificado');
}

module.exports = {
  registerEvaluacionesMedicasHandlers: registerEvaluacionesMedicasHandlers,
  SCHEMA_SQL: SCHEMA_SQL,
  _handlerListar: _handlerListar,
  _handlerGuardar: _handlerGuardar,
  _handlerEliminar: _handlerEliminar,
  _handlerAdjuntar: _handlerAdjuntar,
  _handlerExtraer: _handlerExtraer,
  _resolverSubcarpeta: _resolverSubcarpeta,
  extraerDatosCertificado: extraerDatosCertificado,
  _validar: _validar,
  TIPOS_VALIDOS: TIPOS_VALIDOS,
  CONCEPTOS_VALIDOS: CONCEPTOS_VALIDOS
};
