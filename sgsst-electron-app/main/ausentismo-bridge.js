// =====================================================================
// 📦1095 (2026-11-23) — Bridge IPC del submódulo 3.3.6 "Medición del
// ausentismo por causa médica".
//
// SQLite (kair.db) es la FUENTE DE VERDAD de las incapacidades.
// El Excel oficial (PI-FO-076 / PG-FO-076 / GI-FO-076 / A-FR-31) sigue siendo
// el ENTREGABLE: se genera con el botón "Exportar a Excel", que escribe una
// COPIA y nunca toca el original.
//
// Tabla: ausentismo_registros (una fila por incapacidad).
//
// Patrón idéntico a gestacion-bridge.js / seguimiento-incapacidad-bridge.js:
//   - registerAusentismoHandlers(app, deps) recibe getDb() por inyección
//   - ipcMain.handle('ausentismo:accion', async (event, params) => ...)
//   - Retorna { success: true, data } o { success: false, error: { code, message } }
//
// LO QUE SE MEDIÓ (2026-11-23) Y POR QUÉ IMPORTA:
//   - El Excel tiene DOS formatos de hoja de datos: "<Empresa> <anio>" (25
//     columnas, encabezado en la fila 7) y "<anio>" (13 columnas, igual
//     encabezado). El mapeo es POR NOMBRE DE ENCABEZADO, no por posición.
//   - Las hojas "TD <anio>" son tablas dinámicas (resúmenes): se descartan
//     porque no tienen columna de cédula.
//   - Aseplus 2024 tiene 656 filas; el archivo completo 2016-2024, 1102 filas.
// =====================================================================

const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { leerArchivoAusentismo, mapearColumnas, normalizar } = require('./ausentismo-import');

var _getDb = null;
var _deps = null;
var MOD = '📦1095-AUSENTISMO';

/**
 * Columnas de la tabla. El contrato lo fijo el owner:
 *   id, empresa_id, created_at, updated_at,
 *   cedula, nombre, cargo, area,
 *   fecha_inicio, fecha_fin, dias_incapacidad,
 *   tipo_incapacidad, clase_incapacidad, entidad, diagnostico, observaciones,
 *   mas_10_dias, anio_incapacidad, mes_incapacidad, concepto, descripcion,
 *   anio, mes,
 *   origen, excel_fila, excel_archivo, excel_row_json
 * Mas tres que hacen falta de verdad:
 *   codigo  — el CIE-10; sin el, el export no puede llenar la columna CODIGO.
 *   empresa_usuaria, genero — vienen del formulario y del Excel.
 *   exportado_excel_en / exportado_excel_fila — para no exportar dos veces.
 */
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS ausentismo_registros (
    id                   TEXT PRIMARY KEY,
    empresa_id           TEXT NOT NULL,
    cedula               TEXT,
    nombre               TEXT,
    cargo                TEXT,
    area                 TEXT,
    empresa_usuaria      TEXT,
    genero               TEXT,
    fecha_inicio         TEXT,
    fecha_fin            TEXT,
    dias_incapacidad     INTEGER DEFAULT 0,
    tipo_incapacidad     TEXT,
    clase_incapacidad    TEXT,
    entidad              TEXT,
    codigo               TEXT,
    diagnostico          TEXT,
    descripcion          TEXT,
    observaciones        TEXT,
    concepto             TEXT,
    mas_10_dias          INTEGER DEFAULT 0,
    anio_incapacidad     INTEGER,
    mes_incapacidad      INTEGER,
    anio                 INTEGER,
    mes                  INTEGER,
    origen               TEXT NOT NULL DEFAULT 'app',   -- 'app' | 'import_excel'
    excel_fila           INTEGER,
    excel_archivo        TEXT,
    excel_hoja           TEXT,
    excel_row_json       TEXT,
    exportado_excel_en   TEXT,
    exportado_excel_fila INTEGER,
    creado_en            TEXT NOT NULL,
    actualizado_en       TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ausentismo_empresa ON ausentismo_registros(empresa_id);
  CREATE INDEX IF NOT EXISTS idx_ausentismo_cedula  ON ausentismo_registros(empresa_id, cedula);
  CREATE INDEX IF NOT EXISTS idx_ausentismo_anio    ON ausentismo_registros(empresa_id, anio);
  CREATE INDEX IF NOT EXISTS idx_ausentismo_origen  ON ausentismo_registros(empresa_id, origen);
`;

/** Id estable: 'aus-' + timestamp36 + '-' + random. */
function nuevoId() {
  return 'aus-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function ahora() {
  return new Date().toISOString();
}

function error(code, message, extra) {
  var e = { code: code, message: message };
  if (extra) e.details = extra;
  return { success: false, error: e };
}

/** Normaliza la cédula: solo dígitos (el Excel las trae con puntos y comas). */
function normalizarCedula(valor) {
  return String(valor == null ? '' : valor).replace(/[^\d]/g, '');
}

/**
 * 📦1095 — Resuelve el nombre de la empresa (como lo manda la UI) al
 * `company_key`, que es lo que se guarda en la tabla (misma convencion que
 * mp_programas y presupuesto).
 *
 * La UI manda cosas como "Tempoactiva Est SAS" (la carpeta de Drive) o
 * "Tempoactiva" (el display_name). La BD guarda "Tempoactiva".
 */
function resolverEmpresaKey(nombre) {
  if (!nombre) return null;
  var objetivo = normalizar(nombre);
  if (!objetivo) return null;
  try {
    var db = _getDb();
    var filas = db.prepare('SELECT company_key, display_name FROM companies').all();
    var i;
    for (i = 0; i < filas.length; i++) {
      if (normalizar(filas[i].company_key) === objetivo) return filas[i].company_key;
      if (normalizar(filas[i].display_name) === objetivo) return filas[i].company_key;
    }
    // "Tempoactiva Est SAS" vs "Tempoactiva": el nombre de la carpeta trae
    // el company_key adentro.
    for (i = 0; i < filas.length; i++) {
      var clave = normalizar(filas[i].company_key);
      if (clave && objetivo.indexOf(clave) !== -1) return filas[i].company_key;
    }
  } catch (e) {
    // Sin tabla companies (o sin BD): se usa el nombre tal cual.
  }
  return null;
}

/** Empresa effective: la key si se puede resolver, si no el nombre tal cual. */
function _empresaDe(params) {
  var crudo = params && (params.empresaId || params.empresaNombre);
  if (!crudo) return null;
  return resolverEmpresaKey(crudo) || String(crudo);
}

/**
 * Convierte el registro del formulario (camelCase) al registro de la tabla.
 * El formulario manda: cedula, nombre, cargo, area, fechaInicio, fechaFin,
 * diasIncapacidad, tipoIncapacidad, claseIncapacidad, entidad, diagnostico,
 * observaciones.
 */
function _aRegistro(empresaId, datos, extras) {
  var d = datos || {};
  var fechaInicio = _textoFecha(d.fechaInicio || d.fecha_inicio);
  var fechaFin = _textoFecha(d.fechaFin || d.fecha_fin || d.fecha_finalizacion);

  var dias = Number(d.diasIncapacidad != null ? d.diasIncapacidad : d.dias_incapacidad);
  if (!isFinite(dias) || dias <= 0) {
    dias = (fechaInicio && fechaFin)
      ? Math.round((new Date(fechaFin + 'T00:00:00Z') - new Date(fechaInicio + 'T00:00:00Z')) / 86400000) + 1
      : 0;
  }

  var anioInc = fechaInicio ? Number(fechaInicio.slice(0, 4)) : null;
  var mesInc = fechaInicio ? Number(fechaInicio.slice(5, 7)) : null;

  return {
    id: nuevoId(),
    empresa_id: empresaId,
    cedula: normalizarCedula(d.cedula),
    nombre: String(d.nombre || '').trim(),
    cargo: String(d.cargo || '').trim(),
    area: String(d.area || d.departamento || '').trim(),
    empresa_usuaria: String(d.empresaUsuaria || d.empresa_usuaria || '').trim(),
    genero: String(d.genero || '').trim(),
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    dias_incapacidad: dias,
    tipo_incapacidad: String(d.tipoIncapacidad || d.tipo_incapacidad || '').trim(),
    clase_incapacidad: String(d.claseIncapacidad || d.clase_incapacidad || '').trim(),
    entidad: String(d.entidad || '').trim(),
    codigo: String(d.codigo || d.codigo_cie10 || '').trim(),
    diagnostico: String(d.diagnostico || d.descripcion || '').trim(),
    descripcion: String(d.descripcion || '').trim(),
    observaciones: String(d.observaciones || '').trim(),
    concepto: String(d.concepto || '').trim(),
    mas_10_dias: dias > 10 ? 1 : 0,
    anio_incapacidad: anioInc,
    mes_incapacidad: mesInc,
    anio: anioInc,
    mes: mesInc,
    origen: 'app',
    excel_fila: null,
    excel_archivo: null,
    excel_hoja: null,
    excel_row_json: null,
    exportado_excel_en: null,
    exportado_excel_fila: null,
    creado_en: ahora(),
    actualizado_en: ahora()
  };
}

function _textoFecha(valor) {
  if (valor == null || valor === '') return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  var s = String(valor).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  return null;
}

function _insertar(db, registro) {
  var cols = Object.keys(registro);
  var sql = 'INSERT INTO ausentismo_registros (' + cols.join(', ') + ') VALUES (' +
    cols.map(function () { return '?'; }).join(', ') + ')';
  var stmt = db.prepare(sql);
  stmt.run.apply(stmt, cols.map(function (c) { return registro[c]; }));
}

// =====================================================================
// Handlers
// =====================================================================

/** Registrar una incapacidad (SQLite es la fuente de verdad). */
function _handlerRegistrar(params) {
  if (!_getDb) return error('NO_DB', 'Base de datos no disponible');
  var empresaId = _empresaDe(params);
  if (!empresaId) return error('NO_COMPANY', 'empresaId requerido');
  if (!params.datos || !normalizarCedula(params.datos.cedula)) {
    return error('VALIDATION', 'Falta la cedula del trabajador');
  }
  try {
    var db = _getDb();
    var registro = _aRegistro(empresaId, params.datos);
    _insertar(db, registro);
    return { success: true, data: registro };
  } catch (e) {
    console.error('[' + MOD + '][REGISTRAR]', e.message);
    return error('DB_ERROR', e.message, e.stack);
  }
}

/** Listar registros de una empresa. */
function _handlerListar(params) {
  if (!_getDb) return error('NO_DB', 'Base de datos no disponible');
  var empresaId = _empresaDe(params);
  if (!empresaId) return error('NO_COMPANY', 'empresaId requerido');
  try {
    var db = _getDb();
    var sql = 'SELECT * FROM ausentismo_registros WHERE empresa_id = ?';
    var args = [empresaId];
    if (params.anio) { sql += ' AND anio = ?'; args.push(Number(params.anio)); }
    if (params.origen) { sql += ' AND origen = ?'; args.push(String(params.origen)); }
    if (params.cedula) { sql += ' AND cedula = ?'; args.push(normalizarCedula(params.cedula)); }
    sql += ' ORDER BY anio DESC, mes_incapacidad DESC, fecha_inicio DESC';
    var limite = Number(params.limite) || 0;
    if (limite > 0) sql += ' LIMIT ' + limite;
    return { success: true, data: db.prepare(sql).all.apply(db.prepare(sql), args) };
  } catch (e) {
    console.error('[' + MOD + '][LISTAR]', e.message);
    return error('DB_ERROR', e.message);
  }
}

/** Buscar por cédula (normaliza: el Excel trae "32.840.309"). */
function _handlerBuscarPorCedula(params) {
  if (!_getDb) return error('NO_DB', 'Base de datos no disponible');
  var empresaId = _empresaDe(params);
  if (!empresaId) return error('NO_COMPANY', 'empresaId requerido');
  var cedula = normalizarCedula(params.cedula);
  if (!cedula) return error('NO_CEDULA', 'cedula requerida');
  try {
    var db = _getDb();
    var rows = db.prepare(
      'SELECT * FROM ausentismo_registros WHERE empresa_id = ? AND cedula = ? ORDER BY fecha_inicio DESC'
    ).all(empresaId, cedula);
    return { success: true, data: rows };
  } catch (e) {
    console.error('[' + MOD + '][BUSCAR]', e.message);
    return error('DB_ERROR', e.message);
  }
}

/** Eliminar un registro. */
function _handlerEliminar(params) {
  if (!_getDb) return error('NO_DB', 'Base de datos no disponible');
  if (!params || !params.id) return error('NO_ID', 'id requerido');
  var empresaId = _empresaDe(params);
  try {
    var db = _getDb();
    var r = db.prepare('DELETE FROM ausentismo_registros WHERE id = ? AND empresa_id = ?')
      .run(params.id, empresaId);
    if (r.changes === 0) return error('NOT_FOUND', 'Registro no encontrado');
    return { success: true, data: { eliminados: r.changes } };
  } catch (e) {
    console.error('[' + MOD + '][ELIMINAR]', e.message);
    return error('DB_ERROR', e.message);
  }
}

/**
 * 📦1095 — Importar el Excel oficial a la tabla.
 *
 * Es idempotente: borra lo que antes se importó de ESE archivo y vuelve a
 * insertarlo. Los registros creados en la app (origen='app') NO se tocan.
 */
function _handlerImportarExcel(params) {
  if (!_getDb) return error('NO_DB', 'Base de datos no disponible');
  var empresaId = _empresaDe(params);
  if (!empresaId) return error('NO_COMPANY', 'empresaId requerido');
  if (!params.filePath) return error('NO_FILE', 'filePath requerido');
  if (!fs.existsSync(params.filePath)) return error('NO_FILE', 'No existe el archivo: ' + params.filePath);

  var leido = leerArchivoAusentismo(params.filePath);
  if (!leido.hojas.length) {
    return error('SIN_DATOS', leido.avisos.join(' ') || 'El archivo no tiene hojas de datos');
  }

  try {
    var db = _getDb();
    var tx = db.transaction(function () {
      db.prepare('DELETE FROM ausentismo_registros WHERE empresa_id = ? AND origen = ? AND excel_archivo = ?')
        .run(empresaId, 'import_excel', path.basename(params.filePath));

      var COLS = [
        'id', 'empresa_id', 'cedula', 'nombre', 'cargo', 'area', 'empresa_usuaria', 'genero',
        'fecha_inicio', 'fecha_fin', 'dias_incapacidad', 'tipo_incapacidad', 'clase_incapacidad',
        'entidad', 'codigo', 'diagnostico', 'descripcion', 'observaciones', 'concepto',
        'mas_10_dias', 'anio_incapacidad', 'mes_incapacidad', 'anio', 'mes', 'origen',
        'excel_fila', 'excel_archivo', 'excel_hoja', 'excel_row_json', 'creado_en', 'actualizado_en'
      ];
      var insertar = db.prepare(
        'INSERT INTO ausentismo_registros (' + COLS.join(', ') + ') VALUES (' +
        COLS.map(function () { return '?'; }).join(', ') + ')'
      );

      var total = 0;
      var ahoraIso = ahora();
      leido.hojas.forEach(function (hoja) {
        hoja.filas.forEach(function (f) {
          insertar.run(
            nuevoId(), empresaId, f.cedula, f.nombre, f.cargo, f.area, f.empresa_usuaria, f.genero,
            f.fecha_inicio, f.fecha_fin, f.dias_incapacidad, f.tipo_incapacidad, f.clase_incapacidad,
            f.entidad, f.codigo, f.diagnostico, f.descripcion, f.observaciones, f.concepto,
            f.mas_10_dias, f.anio_incapacidad, f.mes_incapacidad, f.anio, f.mes, 'import_excel',
            f.excel_fila, path.basename(params.filePath), hoja.nombre, JSON.stringify(f), ahoraIso, ahoraIso
          );
          total++;
        });
      });
      return total;
    });

    var total = tx();
    var porAnio = {};
    leido.hojas.forEach(function (h) { porAnio[h.anio] = (porAnio[h.anio] || 0) + h.filas.length; });

    return {
      success: true,
      data: {
        importadas: total,
        hojas: leido.hojas.length,
        por_anio: porAnio,
        archivo: params.filePath,
        avisos: leido.avisos
      }
    };
  } catch (e) {
    console.error('[' + MOD + '][IMPORTAR]', e.message);
    return error('DB_ERROR', e.message, e.stack);
  }
}

/**
 * 📦1095 — Importar el archivo OFICIAL de la empresa (el que ya usa para
 * entregar). Resuelve la ruta y llama al importador.
 *
 * Es lo que usa el boton "Importar historico": la UI no sabe donde esta el
 * archivo, eso lo sabe el main.
 */
function _handlerImportarOficial(params) {
  if (!_getDb) return error('NO_DB', 'Base de datos no disponible');
  var empresaId = _empresaDe(params);
  if (!empresaId) return error('NO_COMPANY', 'empresaId requerido');
  if (!_deps || !_deps.obtenerRutaAusentismo) return error('NO_ROUTE', 'No se puede resolver el archivo oficial');

  var nombreEmpresa = (params && (params.empresaNombre || params.empresaId)) || empresaId;
  return _deps.obtenerRutaAusentismo(nombreEmpresa).then(function (rutaOficial) {
    if (!rutaOficial) return error('NO_ROUTE', 'No se encontro el archivo oficial de ausentismo');
    var res = _handlerImportarExcel({
      empresaId: empresaId,
      filePath: rutaOficial
    });
    if (res.success) res.data.archivo = rutaOficial;
    return res;
  }).catch(function (e) {
    console.error('[' + MOD + '][IMPORTAR_OFICIAL]', e.message);
    return error('IMPORT_ERROR', e.message);
  });
}

/**
 * 📦1095 — Marcar un registro como ya escrito en el Excel.
 *
 * Se usa cuando el registro se escribió directo en el Excel oficial (el
 * camino viejo, que sigue vigente para las empresas que todavia no
 * importaron su histórico). Asi el botón "Exportar a Excel" no lo anexa
 * otra vez y queda una sola fila en el archivo.
 */
function _handlerMarcarExportado(params) {
  if (!_getDb) return error('NO_DB', 'Base de datos no disponible');
  if (!params || !params.id) return error('NO_ID', 'id requerido');
  var empresaId = _empresaDe(params);
  try {
    var db = _getDb();
    var r = db.prepare(
      'UPDATE ausentismo_registros SET exportado_excel_en = ?, exportado_excel_fila = ?, actualizado_en = ? WHERE id = ? AND empresa_id = ?'
    ).run(ahora(), params.fila || null, ahora(), params.id, empresaId);
    if (r.changes === 0) return error('NOT_FOUND', 'Registro no encontrado');
    return { success: true, data: { actualizados: r.changes } };
  } catch (e) {
    console.error('[' + MOD + '][MARCAR_EXPORTADO]', e.message);
    return error('DB_ERROR', e.message);
  }
}

/**
 * 📦1095 — Buscar un trabajador en `base_personal` (autollenado del
 * formulario). Devuelve null si esa empresa no tiene la persona.
 *
 * La persona se busca en la BD PRIMERO; el Excel de "BD Personal" queda como
 * respaldo (lo hace el renderer).
 */
function _handlerBuscarEmpleado(params) {
  if (!_getDb) return error('NO_DB', 'Base de datos no disponible');
  var cedula = normalizarCedula(params && params.cedula);
  if (!cedula) return error('NO_CEDULA', 'cedula requerida');
  var empresaId = _empresaDe(params);
  try {
    var db = _getDb();
    var cols = db.prepare('PRAGMA table_info(base_personal)').all().map(function (c) { return c.name; });
    if (!cols.length) return { success: true, data: null };

    var columnaCedula = null;
    ['cedula', 'numero_documento', 'documento', 'nro_documento', 'cedula_trabajador'].some(function (c) {
      if (cols.indexOf(c) !== -1) { columnaCedula = c; return true; }
      return false;
    });
    if (!columnaCedula) return { success: true, data: null, columnas: cols };

    var sql = 'SELECT p.* FROM base_personal p WHERE REPLACE(REPLACE(REPLACE(CAST(p.' + columnaCedula +
      " AS TEXT), '.', ''), ',', ''), ' ', '') = ?";
    var args = [cedula];
    if (empresaId && cols.indexOf('empresa_id') !== -1) {
      sql += ' AND p.empresa_id = ?';
      args.push(empresaId);
    }
    // La columna `activo` no existe en todas las versiones de base_personal:
    // ordenar por ella reventaba la consulta. Se usa solo si esta.
    if (cols.indexOf('activo') !== -1) sql += ' ORDER BY p.activo DESC';
    sql += ' LIMIT 1';

    var fila = db.prepare(sql).get.apply(db.prepare(sql), args);
    if (!fila) return { success: true, data: null };

    // La sede es el "area" del formulario.
    var sede = null;
    try {
      if (fila.sede_id) {
        sede = db.prepare('SELECT nombre FROM gh_sedes WHERE id = ?').get(fila.sede_id);
      }
    } catch (e) { /* la tabla gh_sedes puede no existir */ }

    fila.nombre_completo = [fila.nombres, fila.apellidos].filter(Boolean).join(' ').trim() || (fila.nombre || '');
    fila.area = sede ? sede.nombre : (fila.area || fila.departamento || '');
    return { success: true, data: fila };
  } catch (e) {
    console.error('[' + MOD + '][EMPLEADO]', e.message);
    return error('DB_ERROR', e.message);
  }
}

/**
 * 📦1095 — Exportar a Excel: copia del archivo oficial + las filas nuevas.
 *
 * NUNCA se escribe sobre el archivo original: se copia a un archivo nuevo y
 * ahí se anexan las filas que la app registró y que todavía no se han
 * exportado.
 */
function _handlerExportarExcel(params) {
  if (!_getDb) return error('NO_DB', 'Base de datos no disponible');
  var empresaId = _empresaDe(params);
  if (!empresaId) return error('NO_COMPANY', 'empresaId requerido');
  if (!_deps || !_deps.obtenerRutaAusentismo) return error('NO_ROUTE', 'No se puede resolver el archivo oficial');

  return _deps.obtenerRutaAusentismo(params.empresaNombre || empresaId).then(function (rutaOficial) {
    if (!rutaOficial) return error('NO_ROUTE', 'No se encontró el archivo oficial de ausentismo');
    var db = _getDb();
    var pendientes = db.prepare(
      "SELECT * FROM ausentismo_registros WHERE empresa_id = ? AND origen = 'app' " +
      'AND exportado_excel_en IS NULL ORDER BY fecha_inicio ASC'
    ).all(empresaId);

    var anio = Number(params.anio) || new Date().getFullYear();
    var destino = params.destino || rutaOficial.replace(/\.xlsx$/i, '') +
      ' (export ' + anio + ' ' + new Date().toISOString().slice(0, 10) + ').xlsx';

    // Copiar el original: el archivo de la empresa no se toca.
    try {
      fs.copyFileSync(rutaOficial, destino);
    } catch (e) {
      return error('NO_COPY', 'No se pudo copiar el archivo oficial: ' + e.message);
    }

    if (!pendientes.length) {
      return {
        success: true,
        data: { archivo: destino, origen: rutaOficial, filas: 0, aviso: 'No hay filas nuevas que exportar.' }
      };
    }

    return _anexarConPython(destino, params.empresaNombre || empresaId, anio, pendientes)
      .then(function (resultado) {
        if (!resultado.success) return resultado;
        var ahoraIso = ahora();
        var marcar = db.prepare(
          'UPDATE ausentismo_registros SET exportado_excel_en = ?, exportado_excel_fila = ?, actualizado_en = ? WHERE id = ?'
        );
        resultado.filas_por_id.forEach(function (item) {
          marcar.run(ahoraIso, item.fila, ahoraIso, item.id);
        });
        return {
          success: true,
          data: {
            archivo: destino,
            origen: rutaOficial,
            filas: resultado.filas_por_id.length,
            hoja: resultado.hoja,
            aviso: 'El archivo original NO se modificó. Se escribió una copia.'
          }
        };
      });
  }).catch(function (e) {
    console.error('[' + MOD + '][EXPORTAR]', e.message);
    return error('EXPORT_ERROR', e.message);
  });
}

/**
 * Llama al script de Python que anexa las filas a la copia.
 * El mapeo de columnas se hace acá (Node) y se le manda al Python ya
 * resuelto: el Python solo escribe celdas.
 */
function _anexarConPython(archivo, empresa, anio, registros) {
  return new Promise(function (resolve) {
    var db = _getDb();
    var mapa = null;
    var filaEncabezado = 7;
    var hojasDetectadas = [];

    try {
      var XLSX = require('xlsx');
      var libro = XLSX.readFile(archivo, { cellDates: true });
      for (var i = 0; i < libro.SheetNames.length; i++) {
        var nombreHoja = libro.SheetNames[i];
        var ws = libro.Sheets[nombreHoja];
        if (!ws || !ws['!ref']) continue;
        var deteccion = require('./ausentismo-import').detectarEncabezado(ws);
        if (!deteccion) continue;
        hojasDetectadas.push({ nombre: nombreHoja, deteccion: deteccion });
        if (!mapa) { mapa = deteccion.mapa; filaEncabezado = deteccion.filaHeader; }
      }
    } catch (e) {
      return resolve(error('NO_LEER', 'No se pudo leer la copia: ' + e.message));
    }
    if (!mapa) return resolve(error('NO_ENCABEZADO', 'La copia no tiene una hoja de datos reconocible'));

    var hojaElegida = null;
    for (var h = 0; h < hojasDetectadas.length; h++) {
      if (normalizar(hojasDetectadas[h].nombre).indexOf(normalizar(empresa)) !== -1 &&
        hojasDetectadas[h].nombre.indexOf(String(anio)) !== -1) {
        hojaElegida = hojasDetectadas[h].nombre;
        break;
      }
    }
    if (!hojaElegida) {
      for (var h2 = 0; h2 < hojasDetectadas.length; h2++) {
        if (hojasDetectadas[h2].nombre.indexOf(String(anio)) !== -1) {
          hojaElegida = hojasDetectadas[h2].nombre;
          break;
        }
      }
    }
    // Si no hay hoja del anio pedido, hojaElegida queda null a proposito: el
    // exportador de Python crea "<EMPRESA> <anio>" copiando la estructura de
    // la hoja de datos mas reciente. Una incapacidad de 2026 NO debe
    // aterrizar en la hoja de 2024.

    var columnas = Object.keys(mapa).map(function (campo) { return mapa[campo]; });
    var filas = registros.map(function (r) {
      return columnas.map(function (col) {
        return r[campoDeColumna(mapa, col)] != null ? r[campoDeColumna(mapa, col)] : '';
      });
    });

    var carga = {
      hoja: hojaElegida,
      encabezado_fila: filaEncabezado,
      mapa_columnas: mapa,
      campos: columnas.map(function (col) { return campoDeColumna(mapa, col); }),
      filas: filas,
      registros: registros.map(function (r) { return { id: r.id, fecha_inicio: r.fecha_inicio }; })
    };

    var pythonPath;
    try {
      pythonPath = _deps.getPythonSync ? _deps.getPythonSync() : null;
    } catch (e) { pythonPath = null; }
    if (!pythonPath && _deps.getPython) {
      return _deps.getPython().then(function (p) { return _correrPython(p, archivo, empresa, anio, carga); });
    }
    if (!pythonPath) return resolve(error('NO_PYTHON', 'Python no disponible'));
    return _correrPython(pythonPath, archivo, empresa, anio, carga);
  });
}

function campoDeColumna(mapa, col) {
  for (var campo in mapa) {
    if (mapa.hasOwnProperty(campo) && mapa[campo] === col) return campo;
  }
  return null;
}

function _correrPython(pythonPath, archivo, empresa, anio, carga) {
  return new Promise(function (resolve) {
    var scriptPath = _deps.getPythonScriptPath('exportar_ausentismo.py');
    if (!fs.existsSync(scriptPath)) {
      return resolve(error('NO_SCRIPT', 'No existe el script de export: ' + scriptPath));
    }
    var python = spawn(pythonPath, [scriptPath, archivo, empresa, String(anio), JSON.stringify(carga)], {
      cwd: path.dirname(scriptPath),
      env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }),
      windowsHide: true
    });
    var buffer = '';
    python.stdout.on('data', function (d) { buffer += d.toString(); });
    python.stderr.on('data', function (d) { buffer += d.toString(); });
    python.on('close', function (code) {
      var linea = null;
      buffer.split(/\r?\n/).forEach(function (l) {
        // El Python emite {"type": "result", ...} (en ingles, como el resto de
        // los scripts de Portear/src).
        if (l.indexOf('"type": "result"') !== -1) linea = l;
      });
      if (!linea) {
        return resolve(error('PYTHON_SIN_SALIDA', 'El script no devolvió resultado (código ' + code + ')'));
      }
      var parsed;
      try { parsed = JSON.parse(linea); } catch (e) {
        return resolve(error('PYTHON_JSON', 'No se pudo leer la salida del script'));
      }
      var payload = parsed.payload || parsed;
      if (!payload.success) {
        return resolve(error('PYTHON_ERROR', payload.error || 'Error desconocido del script de export'));
      }
      // Empareja cada registro con la fila donde quedó en el Excel.
      var porFila = payload.filas_por_id || [];
      resolve({
        success: true,
        hoja: payload.hoja,
        filas_por_id: porFila
      });
    });
  });
}

// =====================================================================
// Registro de handlers
// =====================================================================
function registerAusentismoHandlers(app, deps) {
  _deps = deps || {};
  _getDb = deps && deps.getDb ? deps.getDb : null;

  ipcMain.handle('ausentismo:registrar', async function (event, params) {
    return _handlerRegistrar(params || {});
  });
  ipcMain.handle('ausentismo:listar', async function (event, params) {
    return _handlerListar(params || {});
  });
  ipcMain.handle('ausentismo:buscarPorCedula', async function (event, params) {
    return _handlerBuscarPorCedula(params || {});
  });
  ipcMain.handle('ausentismo:eliminar', async function (event, params) {
    return _handlerEliminar(params || {});
  });
  ipcMain.handle('ausentismo:importarExcel', async function (event, params) {
    return _handlerImportarExcel(params || {});
  });
  ipcMain.handle('ausentismo:exportarExcel', async function (event, params) {
    return _handlerExportarExcel(params || {});
  });
  ipcMain.handle('ausentismo:buscarEmpleado', async function (event, params) {
    return _handlerBuscarEmpleado(params || {});
  });
  ipcMain.handle('ausentismo:marcarExportado', async function (event, params) {
    return _handlerMarcarExportado(params || {});
  });
  ipcMain.handle('ausentismo:importarOficial', async function (event, params) {
    return _handlerImportarOficial(params || {});
  });

  console.log('[MAIN] 📦1095 · Handlers de ausentismo (9 canales) registrados correctamente');
}

module.exports = {
  registerAusentismoHandlers: registerAusentismoHandlers,
  SCHEMA_SQL: SCHEMA_SQL,
  _aRegistro: _aRegistro,
  _normalizarCedula: normalizarCedula
};
