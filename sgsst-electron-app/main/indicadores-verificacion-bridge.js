/**
 * =====================================================================
 * SUBMÓDULO 6.1.1 — DEFINICIÓN DE INDICADORES (Verificación)
 * Bridge IPC · Backend Process · 📦800 (2026-09-21)
 * Patrón: registerHandlers(app, deps) — igual que inspecciones-bridge.js
 *
 * Lee el "INDICADORES <año>.xlsx" real de la carpeta de la empresa:
 *   6. Verificación/6.1.1 Definición de indicadores/INDICADORES 2026.xlsx
 *
 * Estructura del Excel (verificada con el archivo real de Tempoactiva):
 *   Hojas de DEFINICIÓN:  RESULTADO | ESTRUCTURA | PROCESO
 *     Fila "TIPO DE INDICADOR" = encabezados; datos desde la fila siguiente.
 *     A=tipo B=nombre C=definición D=cómo se mide F=fuente G=responsable
 *     H=frecuencia I=unidad J=interpretación K=meta L=divulgación
 *   Hojas de DATOS: "DATOS Y GRÁFICOS <TIPO>"
 *     RESULTADO: meses en columnas DOBLES (numerador impar, valor par):
 *       E/F=ENE G/H=FEB ... AA/AB=DIC · AC=frecuencia AD=meta AE=resultado
 *       Cada indicador ocupa 2 filas: principal + fila de denominador
 *       ("N° Trabajadores") en las columnas impares.
 *     ESTRUCTURA/PROCESO: meses en columnas SIMPLES E..P=ENE..DIC,
 *       Q=frecuencia R=meta S=resultado. Mismo esquema de 2 filas
 *       (referencia: "Cumple" / "N° Items totales" / "N° Actividades propuestas").
 *
 * Match definición ↔ datos por nombre normalizado (sin tildes/espacios).
 * Sin carpeta/Excel → { source: 'none' } y el frontend cae a su libreta
 * de ejemplo (mismo fallback que inspecciones 📦798).
 * =====================================================================
 */

const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

// ─── Dependencia inyectada en registerHandlers ──────────────────────
var _getCompanyRootPath = null;

var MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

// ─── Normalización ──────────────────────────────────────────────────
function _num(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  var n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

/* Texto limpio: trim; el Excel usa '0' como "vacío" en campos de texto. */
function _str(v) {
  if (v === null || v === undefined) return '';
  var s = String(v).replace(/\s+/g, ' ').trim();
  if (s === '0') return '';
  return s;
}

function _normName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ok(data) { return { success: true, data: data }; }
function err(code, message) { return { success: false, error: { code: code, message: message } }; }

// ─── Resolución de la carpeta 6.1.1 ─────────────────────────────────
/* Misma estrategia inteligente que revision-alta-direccion-bridge.js:
   1. "6. Verificación" / "6. Verificacion" dentro de la raíz de la empresa
   2. Subcarpeta que empiece con "6.1.1" (acepta sufijos)
   3. Fallback: ruta esperada (no se crea nada; solo lectura) */
function _getIndicadoresDir(companyRoot) {
  if (!companyRoot || !fs.existsSync(companyRoot)) return null;
  var variants = ['6. Verificación', '6. Verificacion'];
  for (var i = 0; i < variants.length; i++) {
    var verifDir = path.join(companyRoot, variants[i]);
    if (!fs.existsSync(verifDir)) continue;
    try {
      var entries = fs.readdirSync(verifDir);
      var sub = entries.filter(function (f) {
        return f.indexOf('6.1.1') === 0 && fs.statSync(path.join(verifDir, f)).isDirectory();
      }).sort();
      if (sub.length) return path.join(verifDir, sub[0]);
      return verifDir;
    } catch (e) { /* ignore */ }
  }
  try {
    var rootEntries = fs.readdirSync(companyRoot);
    var verif = rootEntries.find(function (f) {
      return /^6\.\s*Verific/i.test(f) && fs.statSync(path.join(companyRoot, f)).isDirectory();
    });
    if (verif) {
      var folder = path.join(companyRoot, verif);
      var subs = fs.readdirSync(folder).filter(function (f) { return f.indexOf('6.1.1') === 0; });
      if (subs.length) return path.join(folder, subs.sort()[0]);
      return folder;
    }
  } catch (e) { /* ignore */ }
  return path.join(companyRoot, '6. Verificación', '6.1.1 Definición de indicadores');
}

/* Elige el Excel del año pedido, o el de mayor año disponible. */
function _findExcel(dir, year) {
  if (!dir || !fs.existsSync(dir)) return null;
  var files;
  try { files = fs.readdirSync(dir); } catch (e) { return null; }
  var candidates = [];
  files.forEach(function (f) {
    var m = /^INDICADORES\s+(\d{4})\.xlsx$/i.exec(f);
    if (m && f.indexOf('~$') !== 0) candidates.push({ file: f, year: parseInt(m[1], 10) });
  });
  if (!candidates.length) return null;
  if (year) {
    var exact = candidates.find(function (c) { return c.year === Number(year); });
    if (exact) return { path: path.join(dir, exact.file), year: exact.year, file: exact.file };
    return null;
  }
  candidates.sort(function (a, b) { return b.year - a.year; });
  return { path: path.join(dir, candidates[0].file), year: candidates[0].year, file: candidates[0].file };
}

// ─── Lectura de hojas ───────────────────────────────────────────────
/* Convierte una hoja a matriz de celdas (aofs = array of arrays). */
function _sheetRows(ws) {
  return xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
}

/* Localiza la fila de encabezados (col A contiene "TIPO DE INDICADOR"). */
function _headerRow(rows) {
  for (var r = 0; r < Math.min(rows.length, 20); r++) {
    var a = rows[r] && rows[r][0];
    if (a && String(a).toUpperCase().indexOf('TIPO DE INDICADOR') !== -1) return r;
  }
  return -1;
}

function _cell(row, idx) { /* idx 0-based */
  return row && idx < row.length ? row[idx] : null;
}

/* Hojas de DEFINICIÓN: una fila por indicador, mientras la col A tenga tipo. */
function _parseDefiniciones(rows) {
  var hr = _headerRow(rows);
  if (hr < 0) return [];
  var out = [];
  for (var r = hr + 1; r < rows.length; r++) {
    var tipo = _str(_cell(rows[r], 0)).toUpperCase();
    if (!tipo || ['RESULTADO', 'ESTRUCTURA', 'PROCESO'].indexOf(tipo) === -1) continue;
    out.push({
      type: tipo,
      name: _str(_cell(rows[r], 1)),
      definition: _str(_cell(rows[r], 2)),
      howToMeasure: _str(_cell(rows[r], 3)),
      source: _str(_cell(rows[r], 5)),
      responsible: _str(_cell(rows[r], 6)),
      frequency: _str(_cell(rows[r], 7)),
      unit: _str(_cell(rows[r], 8)),
      interpretation: _str(_cell(rows[r], 9)),
      targetDef: _num(_cell(rows[r], 10)),
      disclosure: _str(_cell(rows[r], 11))
    });
  }
  return out;
}

/* Hojas de DATOS. doble=true para RESULTADO (meses en pares de columnas).
   Devuelve mapa nombreNormalizado → { monthlyData, frequency, target,
   resultDeclared, dataLabel }. Cada indicador ocupa su fila + la fila
   siguiente de referencia (denominador), que se detecta por A/B vacíos. */
function _parseDatos(rows, doble) {
  var hr = _headerRow(rows);
  if (hr < 0) return {};
  var map = {};
  for (var r = hr + 1; r < rows.length; r++) {
    var tipo = _str(_cell(rows[r], 0)).toUpperCase();
    var nombre = _str(_cell(rows[r], 1));
    if (!tipo || !nombre || ['RESULTADO', 'ESTRUCTURA', 'PROCESO'].indexOf(tipo) === -1) continue;

    var refRow = rows[r + 1] || null;
    var isRef = refRow && !_str(_cell(refRow, 0)) && !_str(_cell(refRow, 1));
    var monthly = [];
    for (var m = 0; m < 12; m++) {
      var cNum = doble ? 4 + (m * 2) : 4 + m;       /* columna del dato principal */
      var cVal = doble ? 5 + (m * 2) : 4 + m;       /* columna del valor calculado (solo doble) */
      var principal = _num(_cell(rows[r], cNum));
      var calculated = doble ? _num(_cell(rows[r], cVal)) : null;
      var denominator = isRef ? _num(_cell(refRow, cNum)) : null;
      /* Valor a mostrar: en hojas DOBLES el Excel ya trae el valor
         calculado en la 2ª columna del par; en hojas SIMPLES guarda
         conteos crudos y el valor del indicador se deriva num/den
         (ej. ejecución del plan = desarrolladas/propuestas). */
      var value;
      if (calculated !== null) value = calculated;
      else if (!doble && denominator !== null && denominator > 0 && principal !== null) value = principal / denominator;
      else value = principal;
      monthly.push({
        month: MONTHS[m],
        numerator: principal,
        denominator: denominator,
        value: value
      });
    }

    map[_normName(nombre)] = {
      dataLabel: _str(_cell(rows[r], 3)),
      formula: _str(_cell(rows[r], 2)),
      monthlyData: monthly,
      frequency: _str(_cell(rows[r], doble ? 28 : 16)),
      target: _num(_cell(rows[r], doble ? 29 : 17)),
      resultDeclared: _str(_cell(rows[r], doble ? 30 : 18))
    };
    r++; /* saltar la fila de referencia */
  }
  return map;
}

/* Match definición ↔ datos: exacto, o por PREFIJO cuando el nombre
   está truncado/extendido entre hojas (ej. la hoja de datos escribe
   "Plan de trabajo anual" y la de definición "Plan de trabajo
   anual/Capacitaciones SST"). Se exige un piso de 8 caracteres para
   evitar falsos positivos con nombres cortos. */
function _matchDatos(key, map) {
  if (map[key]) return map[key];
  var k = null;
  Object.keys(map).some(function (dk) {
    if (dk.length >= 8 && key.length >= 8 &&
        (key.indexOf(dk) === 0 || dk.indexOf(key) === 0)) { k = dk; return true; }
    return false;
  });
  return k ? map[k] : null;
}

// ─── Carga completa del libro ───────────────────────────────────────
function _loadFromExcel(filePath, year) {
  var wb = xlsx.readFile(filePath);
  var sheetNames = wb.SheetNames || [];

  function sheet(name) {
    var exact = sheetNames.find(function (s) { return s.trim().toUpperCase() === name; });
    return exact ? wb.Sheets[exact] : null;
  }

  var defSheets = ['RESULTADO', 'ESTRUCTURA', 'PROCESO'];
  var definiciones = [];
  defSheets.forEach(function (tipo) {
    var ws = sheet(tipo);
    if (ws) definiciones = definiciones.concat(_parseDefiniciones(_sheetRows(ws)));
  });

  /* Hoja de datos de RESULTADO usa columnas dobles. */
  var datosResultado = {};
  var wsDR = sheet('DATOS Y GRÁFICOS RESULTADO');
  if (wsDR) datosResultado = _parseDatos(_sheetRows(wsDR), true);
  var datosSimples = {};
  ['ESTRUCTURA', 'PROCESO'].forEach(function (tipo) {
    var ws = sheet('DATOS Y GRÁFICOS ' + tipo);
    if (ws) {
      var parsed = _parseDatos(_sheetRows(ws), false);
      Object.keys(parsed).forEach(function (k) { datosSimples[k] = parsed[k]; });
    }
  });

  var indicadores = definiciones.map(function (def, idx) {
    var key = _normName(def.name);
    var datos = _matchDatos(key, datosResultado) || _matchDatos(key, datosSimples) || null;
    var monthly = datos ? datos.monthlyData : [];

    /* currentValue: último valor no nulo de la serie. */
    var currentValue = null;
    for (var m = monthly.length - 1; m >= 0; m--) {
      if (monthly[m].value !== null) { currentValue = monthly[m].value; break; }
    }

    return {
      id: def.type.substring(0, 3).toLowerCase() + '-' + String(idx + 1).padStart(2, '0'),
      type: def.type,
      name: def.name,
      definition: def.definition,
      howToMeasure: def.howToMeasure,
      formula: datos && datos.formula ? datos.formula : def.howToMeasure,
      dataLabel: datos ? datos.dataLabel : '',
      source: def.source,
      responsible: def.responsible,
      frequency: datos && datos.frequency ? datos.frequency : def.frequency,
      unit: def.unit,
      interpretation: def.interpretation,
      target: (datos && datos.target !== null) ? datos.target : (def.targetDef !== null ? def.targetDef : null),
      disclosure: def.disclosure,
      resultDeclared: datos ? datos.resultDeclared : '',
      monthlyData: monthly,
      currentValue: currentValue
    };
  });

  return { source: 'excel', year: year, indicadores: indicadores };
}

// ─── API pública (también usada por el test) ────────────────────────
function obtenerIndicadores(companyName, year) {
  return _obtenerIndicadoresAsync(companyName, year);
}

async function _obtenerIndicadoresAsync(companyName, year) {
  var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
  if (!companyRoot) return ok({ source: 'none', reason: 'COMPANY_NOT_FOUND' });

  var dir = _getIndicadoresDir(companyRoot);
  var found = _findExcel(dir, year);
  if (!found) return ok({ source: 'none', reason: 'EXCEL_NOT_FOUND', dir: dir });

  try {
    var data = _loadFromExcel(found.path, found.year);
    data.file = found.file;
    return ok(data);
  } catch (e) {
    return err('PARSE_ERROR', 'No se pudo leer ' + found.file + ': ' + e.message);
  }
}

// ─── Registro de handlers IPC ───────────────────────────────────────
function registerVerificacionIndicadoresHandlers(appInstance, deps) {
  _getCompanyRootPath = deps && deps.getCompanyRootPath ? deps.getCompanyRootPath : null;

  ipcMain.handle('indicadores:obtener', async function (_e, companyName, year) {
    try {
      return await _obtenerIndicadoresAsync(companyName, year);
    } catch (e) {
      return err('HANDLER_ERROR', e.message);
    }
  });
}

module.exports = {
  registerVerificacionIndicadoresHandlers: registerVerificacionIndicadoresHandlers,
  obtenerIndicadores: obtenerIndicadores,
  /* expuestos para el test */
  _parseDefiniciones: _parseDefiniciones,
  _parseDatos: _parseDatos,
  _findExcel: _findExcel,
  _getIndicadoresDir: _getIndicadoresDir,
  _normName: _normName
};
