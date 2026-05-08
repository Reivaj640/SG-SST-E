const ExcelJS = require("exceljs");
const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

var _writeQueues = {};
function _serializedWrite(filePath, writeFn) {
  var key = filePath.toLowerCase();
  if (!_writeQueues[key]) _writeQueues[key] = Promise.resolve();
  _writeQueues[key] = _writeQueues[key].catch(function() {}).then(writeFn);
  return _writeQueues[key];
}

const INSPECTION_TEMPLATES = {
  EXTINTOR: {
    code: "GI-FO-026",
    name: "Inspección de Extintores",
    ext: ".xlsx",
    sheetName: "Extintores",
    headerFields: [
      { key: "fecha", label: "Fecha de realización", row: 7, col: 2 },
      { key: "inspector", label: "Realizada por", row: 8, col: 3 },
      { key: "cargo", label: "Cargo", row: 8, col: 7 }
    ],
 generalObservations: { row: 21, col: 1, endCol: 12 },
 dataStartRow: 12,
 dataEndRow: 19,
 defaultRowCount: 7,
 colMap: {
      A: { field: "ubicacion", label: "UBICACIÓN", type: "text" },
      B: { field: "numExtintor", label: "# EXTINTOR", type: "text" },
      C: { field: "tipo", label: "Tipo", type: "text" },
      D: { field: "capacidad", label: "Capacidad", type: "text" },
      E: { field: "recarga", label: "Fecha Recarga", type: "text" },
      F: { field: "vencimiento", label: "Fecha Vencimiento", type: "text" },
      G: { field: "presion", label: "Presión manómetro", type: "select", options: ["OK","BAJO","N/A"] },
      H: { field: "estadoCilindro", label: "Estado Cilindro", type: "select", options: ["BUENO","MALO","REGULAR","N/A"] },
      I: { field: "pasador", label: "Pasador", type: "select", options: ["BUENO","MALO","REGULAR","N/A"] },
      J: { field: "anilloVerificacion", label: "Anillo Verificación", type: "select", options: ["BUENO","MALO","REGULAR","N/A"] },
      K: { field: "baseSoporte", label: "Base Soporte", type: "select", options: ["BUENO","MALO","REGULAR","N/A"] },
      L: { field: "observaciones", label: "Observaciones", type: "text" }
    },
    colIndexes: { A:1, B:2, C:3, D:4, E:5, F:6, G:7, H:8, I:9, J:10, K:11, L:12 }
  },
  INSTALACION: {
    code: "GI-FO-025",
    name: "Inspección de Instalaciones",
    ext: ".xls",
    sheetName: "OFICINA",
 headerFields: [
 { key: "fecha", label: "Fecha", row: 6, col: 1, labelPrefix: "FECHA:" },
 { key: "lugar", label: "Lugar", row: 6, col: 6, labelPrefix: "LUGAR :" }
 ],
 signFields: [
 { key: "inspeccionadoPor", label: "Inspeccionado por", row: 37, col: 1, labelPrefix: "INSPECCIONADO POR:" },
 { key: "cargoFirma", label: "Cargo", row: 38, col: 1, labelPrefix: "CARGO:" }
 ],
    sections: [
      { label: "INSTALACIONES SANITARIAS", row: 11 },
      { label: "INSTALACIONES ELÉCTRICAS", row: 15 },
      { label: "ORDEN Y LIMPIEZA", row: 18 },
      { label: "ERGONOMÍA E HIGIENE", row: 21 },
      { label: "PLANTA FÍSICA", row: 28 }
    ],
    dataRows: [12,13,14,16,17,19,20,22,23,24,25,26,27,29,30,31,32,33,34,35],
    colMap: {
      A: { field: "item", label: "ITEM REVISIÓN", type: "text", readOnly: true },
      C: { field: "si", label: "SI", type: "check", options: ["SI",""] },
      D: { field: "no", label: "NO", type: "check", options: ["NO",""] },
      E: { field: "na", label: "N/A", type: "check", options: ["N/A",""] },
      F: { field: "observaciones", label: "OBSERVACIONES", type: "text" },
      G: { field: "compromisos", label: "COMPROMISOS", type: "text" },
      H: { field: "responsableFechas", label: "RESPONSABLE - FECHAS", type: "text" },
      I: { field: "seguimientoEstado", label: "SEGUIMIENTO - ESTADO", type: "text" }
    },
    colIndexes: { A:1, C:3, D:4, E:5, F:6, G:7, H:8, I:9 }
  },
  EMERGENCIA: {
    code: "GI-FO-023",
    name: "Inspección Equipos de Emergencia",
    ext: ".xls",
    sheetName: "E EMERGENCIA",
 headerFields: [
 { key: "fecha", label: "Fecha", row: 6, col: 1, labelPrefix: "FECHA:" },
 { key: "sitio", label: "Sitio de Inspección", row: 7, col: 1, labelPrefix: "SITIO DE INSPECCION:" }
 ],
    dataStartRow: 12,
    dataEndRow: 20,
    colMap: {
      A: { field: "equipo", label: "ITEMS PARA REVISAR", type: "text", readOnly: true },
      B: { field: "bueno", label: "BUENO", type: "check", options: ["BUENO",""] },
      C: { field: "malo", label: "MALO", type: "check", options: ["MALO",""] },
      D: { field: "na", label: "N/A", type: "check", options: ["N/A",""] },
      E: { field: "recomendaciones", label: "RECOMENDACIONES / COMPROMISOS", type: "text" },
      F: { field: "responsables", label: "RESPONSABLES / FECHAS", type: "text" },
      G: { field: "seguimiento", label: "SEGUIMIENTO / ESTATUS", type: "text" }
    },
    colIndexes: { A:1, B:2, C:3, D:4, E:5, F:6, G:7 }
  },
  BOTIQUIN: {
    code: "GI-FO-031",
    name: "Inspección de Botiquín",
    ext: ".xls",
    sheetName: "INSUMOS BASICOS PARA BOTIQUIN",
 headerFields: [
 { key: "fecha", label: "Fecha", row: 6, col: 1, labelPrefix: "FECHA:" },
 { key: "realizadoPor", label: "Realizado por", row: 6, col: 5, labelPrefix: "REALIZADO POR:" }
 ],
    dataStartRow: 9,
    dataEndRow: 31,
 checkRows: [
 { row: 32, field: "botiquinBuenEstado", label: "Botiquín en buen estado", type: "check", options: ["SI","NO"], valueCol: 6 },
 { row: 33, field: "higieneAdecuada", label: "Higiene adecuada del botiquín", type: "check", options: ["SI","NO"], valueCol: 6 }
 ],
    colMap: {
      A: { field: "numero", label: "ITEM", type: "text", readOnly: true },
      B: { field: "elemento", label: "ELEMENTOS", type: "text", readOnly: true },
      E: { field: "cantidad", label: "CANTIDAD", type: "text" },
      F: { field: "fechaVencimiento", label: "FECHA DE VENCIMIENTO", type: "text" },
      G: { field: "estadoObservacion", label: "ESTADO / OBSERVACIÓN", type: "text" }
    },
    colIndexes: { A:1, B:2, E:5, F:6, G:7 }
  }
};

const PROGRAMA_SHEET_CONFIG = {
  startRow: 9,
  endRow: 18,
  startCol: 7,
  endCol: 18,
  colMap: {
    B: { field: "objetivoGeneral", label: "OBJETIVO GENERAL", editable: false, col: 3 },
    C: { field: "objetivosEspecificos", label: "OBJETIVOS ESPECÍFICOS", editable: false, col: 4 },
    D: { field: "actividades", label: "ACTIVIDADES", editable: false, col: 5 },
    E: { field: "responsable", label: "RESPONSABLE", editable: true, col: 6 },
    R: { field: "porcentaje", label: "%", editable: false, col: 19 },
    S: { field: "estado", label: "ESTADO", editable: false, col: 20 },
    T: { field: "observacionesSeguimiento", label: "OBSERVACIONES Y SEGUIMIENTO", editable: true, col: 21 }
  }
};

const PROGRAMA_EXCELJS_ROW_OFFSET = 1;

const PROGRAMA_SHEETJS_COL = {
  objetivoGeneral: 1,
  objetivosEspecificos: 2,
  actividades: 3,
  responsable: 4,
  monthStart: 5,
  porcentaje: 17,
  estado: 18,
  observacionesSeguimiento: 19,
  kpiIndicador: 2,
  kpiSinRealizar: 5,
  kpiRealizadas: 5
};

function _getCompanyInspeccionesDir(companyRoot) {
  var gestionPeligrosDir = path.join(companyRoot, "4. Gestion de Peligros y Riesgos");
  if (!fs.existsSync(gestionPeligrosDir)) {
    gestionPeligrosDir = path.join(companyRoot, "4. Gestión de Peligros y Riesgos");
  }
  if (fs.existsSync(gestionPeligrosDir)) {
    try {
      var entries = fs.readdirSync(gestionPeligrosDir);
      var inspeccionesFolder = entries.find(function(f) { return f.startsWith("4.2.4"); });
      if (inspeccionesFolder) {
        return path.join(gestionPeligrosDir, inspeccionesFolder);
      }
    } catch (e) { /* ignore readdir errors */ }
  }

  var directPath = path.join(companyRoot, "4.2.4");
  if (fs.existsSync(directPath)) return directPath;

  if (fs.existsSync(companyRoot)) {
    try {
      var rootEntries = fs.readdirSync(companyRoot);
      var gestionFolder = rootEntries.find(function(f) { return f.startsWith("4."); });
      if (gestionFolder) {
        var gestionFullPath = path.join(companyRoot, gestionFolder);
        var subEntries = fs.readdirSync(gestionFullPath);
        var inspFolder = subEntries.find(function(f) { return f.startsWith("4.2.4"); });
        if (inspFolder) return path.join(gestionFullPath, inspFolder);
      }
    } catch (e) { /* ignore */ }
  }

  return path.join(gestionPeligrosDir, "4.2.4");
}

function _findExcelFile(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  var files = fs.readdirSync(dir);
  var match = files.find(function(f) {
    var fullPath = path.join(dir, f);
    try {
      if (!fs.statSync(fullPath).isFile()) return false;
    } catch (e) { return false; }
    var lower = f.toLowerCase();
    return (lower.endsWith('.xlsx') || lower.endsWith('.xls')) &&
      f.toUpperCase().indexOf(pattern.toUpperCase()) !== -1;
  });
  return match ? path.join(dir, match) : null;
}

function _findExcelFileDeep(dir, pattern) {
  var direct = _findExcelFile(dir, pattern);
  if (direct) return direct;
  if (!fs.existsSync(dir)) return null;
  try {
    var entries = fs.readdirSync(dir);
  } catch (e) { return null; }
  for (var i = 0; i < entries.length; i++) {
    var sub = path.join(dir, entries[i]);
    try {
      if (fs.statSync(sub).isDirectory()) {
        var found = _findExcelFileDeep(sub, pattern);
        if (found) return found;
      }
    } catch (e) { /* skip inaccessible entries */ }
  }
  return null;
}

function _readXlsWithSheetJs(filePath) {
  var workbook = xlsx.readFile(filePath, { type: "file" });
  var sheetName = workbook.SheetNames[0];
  var ws = workbook.Sheets[sheetName];
  return { rawData: xlsx.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true }), workbook: workbook, sheetName: sheetName };
}

function _escapeRegex(s) {
 return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function _extractValueAfterLabel(cellText, labelPrefix) {
 if (!labelPrefix) return String(cellText || "").trim();
 var raw = String(cellText || "").trim();
 var re = new RegExp("^" + _escapeRegex(labelPrefix) + "\\s*");
 var val = raw.replace(re, "").replace(/_+/g, "").trim();
 if (/^[\/\-\.]+$/.test(val)) val = "";
 return val;
}

function _buildLabelCell(labelPrefix, value) {
 if (!labelPrefix) return String(value || "");
 return labelPrefix + " " + String(value || "").trim();
}

function _extractYear(val) {
 if (!val) return NaN;
 var s = String(val).trim();
 var m = s.match(/\b(20\d{2})\b/);
 if (m) return parseInt(m[1], 10);
 var n = parseInt(s, 10);
 return (!isNaN(n) && n >= 2000 && n <= 2100) ? n : NaN;
}

function _colLetterToIndex(letter) {
  var idx = 0;
  for (var i = 0; i < letter.length; i++) {
    idx = idx * 26 + (letter.charCodeAt(i) - 64);
  }
  return idx;
}

function _createBackup(filePath, dir) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  var backupDir = path.join(dir || path.dirname(filePath), "backup");
  if (!fs.existsSync(backupDir)) { try { fs.mkdirSync(backupDir, { recursive: true }); } catch (e) { return null; } }
  var ts = new Date().toISOString().replace(/[:.]/g, '-');
  var backupPath = path.join(backupDir, path.basename(filePath) + '_' + ts + '.bak');
  try { fs.copyFileSync(filePath, backupPath); return backupPath; } catch (e) { return null; }
}

function _convertXlsToXlsx(xlsPath) {
  var xlsxPath = xlsPath.replace(/\.xls$/i, '.xlsx');
  if (fs.existsSync(xlsxPath)) return xlsxPath;
  try {
    var wb = xlsx.readFile(xlsPath, { type: 'file' });
    var xlsxPath = xlsPath.replace(/\.xls$/i, '.xlsx');
    xlsx.writeFile(wb, xlsxPath, { bookType: 'xlsx' });
    var backupDir = path.join(path.dirname(xlsPath), 'backup');
    if (!fs.existsSync(backupDir)) { try { fs.mkdirSync(backupDir, { recursive: true }); } catch (e) {} }
    var backupPath = path.join(backupDir, path.basename(xlsPath) + '_pre_xlsx_conversion.bak');
    try { fs.copyFileSync(xlsPath, backupPath); } catch (e) {}
    try { fs.unlinkSync(xlsPath); } catch (e) {}
    return xlsxPath;
  } catch (e) {
    console.error('[4.2.4] Error convirtiendo .xls a .xlsx:', e.message);
    return null;
  }
}

function readInspeccionExcel(companyRoot, type) {
  var dir = _getCompanyInspeccionesDir(companyRoot);
  if (!fs.existsSync(dir)) {
    return { success: false, error: { code: "DIR_NOT_FOUND", message: "No se encontró la carpeta 4.2.4 para la empresa" } };
  }

  var config = INSPECTION_TEMPLATES[type];
  if (!config) {
    return { success: false, error: { code: "UNKNOWN_TYPE", message: "Tipo de inspección desconocido: " + type } };
  }

  var filePath = _findExcelFileDeep(dir, config.code);
  if (!filePath) filePath = _findExcelFileDeep(dir, type);
  if (!filePath) {
    return { success: false, error: { code: "FILE_NOT_FOUND", message: "No se encontró el archivo Excel para " + config.name + " en " + dir } };
  }

  try {
    if (!fs.statSync(filePath).isFile()) {
      return { success: false, error: { code: "NOT_A_FILE", message: "La ruta no es un archivo: " + filePath } };
    }
  } catch (e) {
    return { success: false, error: { code: "STAT_ERROR", message: "No se pudo acceder al archivo: " + filePath } };
  }

  var ext = path.extname(filePath).toLowerCase();
  var result = { items: [], headerFields: {}, generalObservations: "", checkRows: [], sections: [] };

  try {
    if (ext === ".xlsx") {
      var wb = xlsx.readFile(filePath, { type: "file" });
      var sn = config.sheetName || wb.SheetNames[0];
      var sheetData = xlsx.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "", raw: true });

 config.headerFields.forEach(function(hf) {
 var rowIdx = hf.row - 1;
 var colIdx = hf.col - 1;
 if (rowIdx < sheetData.length && sheetData[rowIdx]) {
 var rawCell = String(sheetData[rowIdx][colIdx] || "").trim();
 result.headerFields[hf.key] = hf.labelPrefix ? _extractValueAfterLabel(rawCell, hf.labelPrefix) : rawCell;
 }
 });

      if (config.generalObservations) {
        var obsRow = config.generalObservations.row - 1;
        if (obsRow < sheetData.length && sheetData[obsRow]) {
          result.generalObservations = String(sheetData[obsRow][0] || "").replace(/^OBSERVACIONES\s*:\s*/i, "").trim();
        }
      }

      var startRow = config.dataStartRow - 1;
      var endRow = config.dataEndRow;
      for (var r = startRow; r < Math.min(endRow, sheetData.length); r++) {
        var row = sheetData[r] || [];
        var item = { row: r + 1 };
        var hasData = false;
        Object.keys(config.colIndexes).forEach(function(col) {
          var field = config.colMap[col].field;
          var colIdx = config.colIndexes[col] - 1;
          var val = row[colIdx];
          item[field] = val !== undefined && val !== null && val !== "" ? String(val).trim() : "";
          if (item[field]) hasData = true;
        });
 if (hasData) result.items.push(item);
 }

 if (result.items.length === 0 && config.defaultRowCount) {
 for (var di = 0; di < config.defaultRowCount; di++) {
 var emptyItem = { row: config.dataStartRow + di };
 Object.keys(config.colIndexes).forEach(function(col) {
 emptyItem[config.colMap[col].field] = "";
 });
 result.items.push(emptyItem);
 }
 }
 } else {
      var xlsResult = _readXlsWithSheetJs(filePath);
      var rawData = xlsResult.rawData;

 config.headerFields.forEach(function(hf) {
 var rowIdx = hf.row - 1;
 var colIdx = hf.col - 1;
 if (rowIdx < rawData.length && rawData[rowIdx]) {
 var rawCell = String(rawData[rowIdx][colIdx] || "").trim();
 result.headerFields[hf.key] = hf.labelPrefix ? _extractValueAfterLabel(rawCell, hf.labelPrefix) : rawCell;
 }
 });

 if (config.signFields) {
 result.signFields = {};
 config.signFields.forEach(function(sf) {
 var rowIdx = sf.row - 1;
 var colIdx = sf.col - 1;
 if (rowIdx < rawData.length && rawData[rowIdx]) {
 var rawVal = String(rawData[rowIdx][colIdx] || "").trim();
 if (sf.labelPrefix) {
 result.signFields[sf.key] = _extractValueAfterLabel(rawVal, sf.labelPrefix);
 } else {
 result.signFields[sf.key] = rawVal.replace(/_{2,}/g, "").trim();
 }
 }
        });
      }

      if (config.sections) {
        config.sections.forEach(function(sec) {
          var rowIdx = sec.row - 1;
          var secText = "";
          if (rowIdx < rawData.length && rawData[rowIdx]) {
            for (var c = 0; c < (rawData[rowIdx].length || 0); c++) {
              if (rawData[rowIdx][c] && String(rawData[rowIdx][c]).trim()) {
                secText = String(rawData[rowIdx][c]).trim();
                break;
              }
            }
          }
          result.sections.push({ label: secText || sec.label, row: sec.row, type: "section" });
        });
      }

      if (config.dataRows) {
        config.dataRows.forEach(function(rowNum) {
          var rowIdx = rowNum - 1;
          var row = rawData[rowIdx] || [];
          var item = { row: rowNum };
          var hasData = false;
          Object.keys(config.colIndexes).forEach(function(col) {
            var field = config.colMap[col].field;
            var colIdx = config.colIndexes[col] - 1;
            var val = row[colIdx];
            item[field] = val !== undefined && val !== null && val !== "" ? String(val).trim() : "";
            if (item[field] && !config.colMap[col].readOnly) hasData = true;
          });
          item._isSection = false;
          result.items.push(item);
        });
      } else {
        var startRow2 = config.dataStartRow - 1;
        var endRow2 = config.dataEndRow;
        for (var r2 = startRow2; r2 < Math.min(endRow2, rawData.length); r2++) {
          var row2 = rawData[r2] || [];
          var item2 = { row: r2 + 1 };
          var hasData2 = false;
          Object.keys(config.colIndexes).forEach(function(col2) {
            var field2 = config.colMap[col2].field;
            var colIdx2 = config.colIndexes[col2] - 1;
            var val2 = row2[colIdx2];
            item2[field2] = val2 !== undefined && val2 !== null && val2 !== "" ? String(val2).trim() : "";
            if (item2[field2]) hasData2 = true;
          });
 if (hasData2) result.items.push(item2);
 }
 }

 if (result.items.length === 0 && config.defaultRowCount) {
 for (var dj = 0; dj < config.defaultRowCount; dj++) {
 var emptyItem2 = { row: config.dataStartRow + dj };
 Object.keys(config.colIndexes).forEach(function(col2) {
 emptyItem2[config.colMap[col2].field] = "";
 });
 result.items.push(emptyItem2);
 }
 }

 if (config.checkRows) {
 config.checkRows.forEach(function(cr) {
 var rowIdx = cr.row - 1;
 var row = rawData[rowIdx] || [];
 var val = "";
 if (cr.valueCol) {
 val = String(row[cr.valueCol - 1] || "").trim();
 } else {
 for (var c = 0; c < (row.length || 0); c++) {
 if (row[c] && String(row[c]).trim()) {
 val = String(row[c]).trim();
 break;
 }
 }
 }
 result.checkRows.push({ row: cr.row, field: cr.field, label: cr.label, value: val, type: cr.type, options: cr.options });
        });
      }
    }

    var headerCells = [];
    Object.keys(config.colMap).forEach(function(col) {
      var cm = config.colMap[col];
      headerCells.push({ col: col, field: cm.field, label: cm.label, type: cm.type, readOnly: cm.readOnly || false, options: cm.options || null });
    });

    return {
      success: true,
      data: {
        code: config.code,
        name: config.name,
        type: type,
        headerFields: result.headerFields,
        generalObservations: result.generalObservations,
        signFields: result.signFields || null,
        checkRows: result.checkRows.length > 0 ? result.checkRows : null,
        sections: result.sections.length > 0 ? result.sections : null,
        structure: {
          headerCells: headerCells,
      dataStartRow: config.dataStartRow != null ? config.dataStartRow : (config.dataRows ? config.dataRows[0] : null),
      dataEndRow: config.dataEndRow != null ? config.dataEndRow : (config.dataRows ? config.dataRows[config.dataRows.length - 1] : null)
        },
        items: result.items,
        _filePath: filePath
      }
    };
  } catch (e) {
    return { success: false, error: { code: "READ_ERROR", message: "Error leyendo archivo Excel: " + e.message } };
  }
}

async function writeInspeccionExcel(companyRoot, type, formData) {
  var dir = _getCompanyInspeccionesDir(companyRoot);
  var config = INSPECTION_TEMPLATES[type];
  if (!config) return { success: false, error: { code: "UNKNOWN_TYPE", message: "Tipo desconocido: " + type } };

  var originalPath = _findExcelFileDeep(dir, config.code) || _findExcelFileDeep(dir, type);
  if (!originalPath) return { success: false, error: { code: "FILE_NOT_FOUND", message: "Archivo Excel no encontrado para escritura" } };

  if (originalPath.toLowerCase().endsWith('.xls') && !originalPath.toLowerCase().endsWith('.xlsx')) {
    var converted = _convertXlsToXlsx(originalPath);
    if (!converted) return { success: false, error: { code: "CONVERT_ERROR", message: "No se pudo convertir .xls a .xlsx" } };
    originalPath = converted;
  }

  var capturedPath = originalPath;
  var capturedConfig = config;
  return _serializedWrite(originalPath, function() {
    return _doWriteInspeccionExcel(capturedPath, dir, capturedConfig, formData);
  });
}

async function _doWriteInspeccionExcel(filePath, dir, config, formData) {
  var backupPath = _createBackup(filePath, dir);

  try {
    var workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    var ws = workbook.getWorksheet(config.sheetName || 1);
    if (!ws) {
      if (backupPath && fs.existsSync(backupPath)) { try { fs.unlinkSync(backupPath); } catch (e) {} }
      return { success: false, error: { code: "SHEET_NOT_FOUND", message: "Hoja no encontrada" } };
    }

    if (formData.headerFields) {
      config.headerFields.forEach(function(hf) {
        if (formData.headerFields[hf.key] !== undefined) {
          ws.getCell(hf.row, hf.col).value = hf.labelPrefix ? _buildLabelCell(hf.labelPrefix, formData.headerFields[hf.key]) : formData.headerFields[hf.key];
        }
      });
    }

    if (formData.signFields && config.signFields) {
      config.signFields.forEach(function(sf) {
        if (formData.signFields[sf.key] !== undefined) {
          ws.getCell(sf.row, sf.col).value = sf.labelPrefix ? _buildLabelCell(sf.labelPrefix, formData.signFields[sf.key]) : formData.signFields[sf.key];
        }
      });
    }

    var items = formData.items || [];
    items.forEach(function(item) {
      var rowNum = item.row || config.dataStartRow;
      Object.keys(config.colIndexes).forEach(function(col) {
        var field = config.colMap[col].field;
        var colIdx = config.colIndexes[col];
        if (item[field] !== undefined) {
          ws.getCell(rowNum, colIdx).value = item[field];
        }
      });
    });

    if (formData.checkRows && config.checkRows) {
      config.checkRows.forEach(function(cr, idx) {
        if (formData.checkRows[idx] !== undefined) {
          var writeCol = cr.valueCol || 1;
          ws.getCell(cr.row, writeCol).value = formData.checkRows[idx];
        }
      });
    }

    if (formData.generalObservations !== undefined && config.generalObservations) {
      ws.getCell(config.generalObservations.row, config.generalObservations.col).value =
        "OBSERVACIONES : " + formData.generalObservations;
    }

    await workbook.xlsx.writeFile(filePath);

    if (backupPath && fs.existsSync(backupPath)) {
      try { fs.unlinkSync(backupPath); } catch (e) {}
    }

    return {
      success: true,
      data: { filePath: filePath, saved: true, rowCount: (formData.items || []).length }
    };
  } catch (e) {
    if (backupPath && fs.existsSync(backupPath)) {
      try { fs.copyFileSync(backupPath, filePath); } catch (re) {}
    }
    return { success: false, error: { code: "WRITE_ERROR", message: "Error escribiendo Excel: " + e.message } };
  }
}

async function writeInspeccionHeader(companyRoot, type, headerData) {
  var dir = _getCompanyInspeccionesDir(companyRoot);
  var config = INSPECTION_TEMPLATES[type];
  if (!config) return { success: false, error: { code: "UNKNOWN_TYPE", message: "Tipo desconocido: " + type } };

  var originalPath = _findExcelFileDeep(dir, config.code) || _findExcelFileDeep(dir, type);
  if (!originalPath) return { success: false, error: { code: "FILE_NOT_FOUND", message: "Archivo Excel no encontrado" } };

  if (originalPath.toLowerCase().endsWith('.xls') && !originalPath.toLowerCase().endsWith('.xlsx')) {
    var converted = _convertXlsToXlsx(originalPath);
    if (!converted) return { success: false, error: { code: "CONVERT_ERROR", message: "No se pudo convertir .xls a .xlsx" } };
    originalPath = converted;
  }

  var capturedPath = originalPath;
  var capturedConfig = config;
  return _serializedWrite(originalPath, function() {
    return _doWriteInspeccionHeader(capturedPath, dir, capturedConfig, headerData);
  });
}

async function _doWriteInspeccionHeader(filePath, dir, config, headerData) {
  var backupPath = _createBackup(filePath, dir);

  try {
    var workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    var ws = workbook.getWorksheet(config.sheetName || 1);
    if (!ws) {
      if (backupPath && fs.existsSync(backupPath)) { try { fs.unlinkSync(backupPath); } catch (e) {} }
      return { success: false, error: { code: "SHEET_NOT_FOUND", message: "Hoja no encontrada" } };
    }

    config.headerFields.forEach(function(hf) {
      if (headerData[hf.key] !== undefined) {
        ws.getCell(hf.row, hf.col).value = hf.labelPrefix ? _buildLabelCell(hf.labelPrefix, headerData[hf.key]) : headerData[hf.key];
      }
    });

    if (headerData.generalObservations !== undefined && config.generalObservations) {
      ws.getCell(config.generalObservations.row, config.generalObservations.col).value =
        "OBSERVACIONES : " + headerData.generalObservations;
    }

    if (headerData.signFields && config.signFields) {
      config.signFields.forEach(function(sf) {
        if (headerData.signFields[sf.key] !== undefined) {
          ws.getCell(sf.row, sf.col).value = sf.labelPrefix ? _buildLabelCell(sf.labelPrefix, headerData.signFields[sf.key]) : headerData.signFields[sf.key];
        }
      });
    }

    if (headerData.checkRows && config.checkRows) {
      config.checkRows.forEach(function(cr, idx) {
        if (headerData.checkRows[idx] !== undefined) {
          var writeCol = cr.valueCol || 1;
          ws.getCell(cr.row, writeCol).value = headerData.checkRows[idx];
        }
      });
    }

    await workbook.xlsx.writeFile(filePath);

    if (backupPath && fs.existsSync(backupPath)) {
      try { fs.unlinkSync(backupPath); } catch (e) {}
    }

    return { success: true, data: { filePath: filePath, saved: true } };
  } catch (e) {
    if (backupPath && fs.existsSync(backupPath)) {
      try { fs.copyFileSync(backupPath, filePath); } catch (re) {}
    }
    return { success: false, error: { code: "WRITE_ERROR", message: "Error escribiendo header: " + e.message } };
  }
}

function listInspeccionFiles(companyRoot) {
  var dir = _getCompanyInspeccionesDir(companyRoot);
  if (!fs.existsSync(dir)) return { success: true, data: { files: [] } };

  try {
    var entries = fs.readdirSync(dir);
    var files = [];
    entries.forEach(function(f) {
      var fullPath = path.join(dir, f);
      try {
        var stat = fs.statSync(fullPath);
        if (!stat.isFile()) return;
      } catch (e) { return; }
      var lower = f.toLowerCase();
      if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) return;

      var type = "DESCONOCIDO";
      var upper = f.toUpperCase();
      if (upper.indexOf("GI-FO-026") !== -1 || upper.indexOf("EXTINTOR") !== -1) type = "EXTINTOR";
      else if (upper.indexOf("GI-FO-025") !== -1 || upper.indexOf("INSTALACION") !== -1) type = "INSTALACION";
      else if (upper.indexOf("GI-FO-023") !== -1 || upper.indexOf("EMERGENCIA") !== -1) type = "EMERGENCIA";
      else if (upper.indexOf("GI-FO-031") !== -1 || upper.indexOf("BOTIQUIN") !== -1) type = "BOTIQUIN";
      else if (upper.indexOf("PROGRAMA") !== -1) type = "PROGRAMA";

      var config = INSPECTION_TEMPLATES[type] || {};
      files.push({
        name: f,
        path: fullPath,
        type: type,
        code: config.code || "",
        typeName: config.name || f.replace(/\.(xlsx|xls)$/i, ""),
        ext: path.extname(f).toLowerCase(),
        size: fs.statSync(fullPath).size,
        modified: fs.statSync(fullPath).mtime.toISOString()
      });
    });

    return { success: true, data: { files: files } };
  } catch (e) {
    return { success: false, error: { code: "READ_ERROR", message: "Error listando archivos: " + e.message } };
  }
}

function getInspeccionFileMetadata(companyRoot, filePath) {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: { code: "FILE_NOT_FOUND", message: "Archivo no encontrado: " + filePath } };
  }

  var fileName = path.basename(filePath).toUpperCase();
  var type = "DESCONOCIDO";
  if (fileName.indexOf("GI-FO-026") !== -1 || fileName.indexOf("EXTINTOR") !== -1) type = "EXTINTOR";
  else if (fileName.indexOf("GI-FO-025") !== -1 || fileName.indexOf("INSTALACION") !== -1) type = "INSTALACION";
  else if (fileName.indexOf("GI-FO-023") !== -1 || fileName.indexOf("EMERGENCIA") !== -1) type = "EMERGENCIA";
  else if (fileName.indexOf("GI-FO-031") !== -1 || fileName.indexOf("BOTIQUIN") !== -1) type = "BOTIQUIN";
  else if (fileName.indexOf("PROGRAMA") !== -1) type = "PROGRAMA";

  var config = INSPECTION_TEMPLATES[type];
  if (!config) {
    var stat = fs.statSync(filePath);
    return {
      success: true,
      data: {
        type: type,
        typeName: path.basename(filePath, path.extname(filePath)),
        code: "",
        filePath: filePath,
        fileName: path.basename(filePath),
        modified: stat.mtime.toISOString(),
        headerFields: {},
        itemsCount: 0
      }
    };
  }

  var readResult = readInspeccionExcel(companyRoot, type);
  if (!readResult.success) return readResult;

  var stat2 = fs.statSync(filePath);
  return {
    success: true,
    data: {
      type: type,
      typeName: config.name,
      code: config.code,
      filePath: filePath,
      fileName: path.basename(filePath),
      modified: stat2.mtime.toISOString(),
      headerFields: readResult.data.headerFields,
      itemsCount: readResult.data.items.length
    }
  };
}

function _inferFrequency(months) {
  var count = Object.values(months).filter(function(v) { return v !== null; }).length;
  if (count >= 10) return "Mensual";
  if (count >= 3 && count <= 5) return "Trimestral";
  if (count >= 1 && count <= 2) return "Semestral";
  return "Según programa";
}

function readProgramaInspecciones(companyRoot, year) {
  var dir = _getCompanyInspeccionesDir(companyRoot);
  if (!fs.existsSync(dir)) {
    return { success: false, error: { code: "DIR_NOT_FOUND", message: "Carpeta 4.2.4 no encontrada" } };
  }

  var filePath = _findExcelFileDeep(dir, "PROGRAMA DE INSPECCIONES") || _findExcelFileDeep(dir, "PROGRAMA");
  if (!filePath) {
    return { success: false, error: { code: "FILE_NOT_FOUND", message: "Archivo PROGRAMA DE INSPECCIONES no encontrado" } };
  }

  if (filePath.toLowerCase().endsWith('.xls') && !filePath.toLowerCase().endsWith('.xlsx')) {
    filePath = _convertXlsToXlsx(filePath);
    if (!filePath) {
      return { success: false, error: { code: "CONVERT_ERROR", message: "No se pudo convertir .xls a .xlsx" } };
    }
  }

  try {
    if (!fs.statSync(filePath).isFile()) {
      return { success: false, error: { code: "NOT_A_FILE", message: "La ruta no es un archivo: " + filePath } };
    }
  } catch (e) {
    return { success: false, error: { code: "STAT_ERROR", message: "No se pudo acceder al archivo: " + filePath } };
  }

  var rawData;
  var merges = [];
  var sheetName = "PROGRAMA";
  try {
    var xlsResult = _readXlsWithSheetJs(filePath);
    rawData = xlsResult.rawData;
    merges = xlsResult.workbook.Sheets[xlsResult.sheetName]['!merges'] || [];
    sheetName = xlsResult.sheetName;
  } catch (e) {
    return { success: false, error: { code: "READ_ERROR", message: "Error leyendo programa: " + e.message } };
  }

  var kpiRow1 = rawData[3] || [];
  var kpiRow2 = rawData[4] || [];
  var indicador = kpiRow1[PROGRAMA_SHEETJS_COL.kpiIndicador] || 0;
  var sinRealizar = kpiRow1[PROGRAMA_SHEETJS_COL.kpiSinRealizar] || 0;
  var realizadas = kpiRow2[PROGRAMA_SHEETJS_COL.kpiRealizadas] || 0;

  var activities = [];
  var emptyCount = 0;

  for (var r = PROGRAMA_SHEET_CONFIG.startRow - 1; r < Math.min(PROGRAMA_SHEET_CONFIG.endRow, rawData.length); r++) {
    var row = rawData[r] || [];
    var actividad = String(row[PROGRAMA_SHEETJS_COL.actividades] || "").trim();
    if (!actividad) {
      emptyCount++;
      if (emptyCount >= 3 && activities.length > 0) break;
      continue;
    }
    emptyCount = 0;

    var objetivoGeneral = String(row[PROGRAMA_SHEETJS_COL.objetivoGeneral] || "").trim();
    var objetivosEspecificos = String(row[PROGRAMA_SHEETJS_COL.objetivosEspecificos] || "").trim();
    var responsable = String(row[PROGRAMA_SHEETJS_COL.responsable] || "").trim();

    var months = {};
    for (var m = 0; m < 12; m++) {
      var colIdx = PROGRAMA_SHEETJS_COL.monthStart + m;
      var val = row[colIdx];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        var s = String(val).trim().toUpperCase();
        if (s.indexOf("C") === 0 || s === "1" || s === "COMPLETADA" || s === "SI" || s === "SÍ") {
          months[m] = "c";
        } else if (s.indexOf("P") === 0 || s === "0" || s === "PENDIENTE" || s === "PROGRAMADA") {
          months[m] = "p";
        } else {
          months[m] = null;
        }
      } else {
        months[m] = null;
      }
    }

    var porcentaje = row[PROGRAMA_SHEETJS_COL.porcentaje] || 0;
    var estado = String(row[PROGRAMA_SHEETJS_COL.estado] || "").trim();
    var observaciones = String(row[PROGRAMA_SHEETJS_COL.observacionesSeguimiento] || "").trim();

    var hasAnyMonth = Object.values(months).some(function(v) { return v !== null; });
    var actType = "INSTALACION";
    var upperName = actividad.toUpperCase();
    if (upperName.indexOf("EXTINTOR") !== -1) actType = "EXTINTOR";
    else if (upperName.indexOf("EMERGENCIA") !== -1) actType = "EMERGENCIA";
    else if (upperName.indexOf("BOTIQU") !== -1) actType = "BOTIQUIN";
    else if (upperName.indexOf("GERENCIAL") !== -1 || upperName.indexOf("GERENC") !== -1) actType = "GERENCIAL";
    else if (upperName.indexOf("PROTECCION") !== -1) actType = "EPP";

    activities.push({
      id: "act-prog-" + (r + 1),
      row: r + 1,
      objetivoGeneral: objetivoGeneral,
      objetivosEspecificos: objetivosEspecificos,
      actividades: actividad,
      responsable: responsable,
      type: actType,
      frequency: hasAnyMonth ? _inferFrequency(months) : "Según programa",
      months: months,
      porcentaje: porcentaje,
      estado: estado,
      observacionesSeguimiento: observaciones
    });
  }

  var totalC = 0, totalP = 0;
  activities.forEach(function(a) {
    Object.values(a.months).forEach(function(v) {
      if (v === "c") totalC++;
      else if (v === "p") totalP++;
    });
  });

  return {
    success: true,
    data: {
      year: year || new Date().getFullYear(),
      filePath: filePath,
      activities: activities,
    kpis: {
      indicator: typeof indicador === 'number' ? Math.round(indicador * 100) / 100 : indicador,
      computedIndicator: (totalC + totalP) > 0 ? Math.round((totalC / (totalC + totalP)) * 10000) / 100 : 0,
      completed: totalC,
        pending: totalP,
        total: totalC + totalP,
        realizadas: typeof realizadas === 'number' ? realizadas : 0,
        sinRealizar: typeof sinRealizar === 'number' ? sinRealizar : 0
      }
    }
  };
}

async function updateProgramaMonth(companyRoot, activityId, month, status) {
  var dir = _getCompanyInspeccionesDir(companyRoot);
  var filePath = _findExcelFileDeep(dir, "PROGRAMA DE INSPECCIONES") || _findExcelFileDeep(dir, "PROGRAMA");
  if (!filePath) return { success: false, error: { code: "FILE_NOT_FOUND", message: "Archivo PROGRAMA no encontrado" } };

  if (filePath.toLowerCase().endsWith('.xls') && !filePath.toLowerCase().endsWith('.xlsx')) {
    filePath = _convertXlsToXlsx(filePath);
    if (!filePath) return { success: false, error: { code: "CONVERT_ERROR", message: "No se pudo convertir .xls a .xlsx" } };
  }

  var capturedFilePath = filePath;
  return _serializedWrite(filePath, function() {
    return _doUpdateProgramaMonth(capturedFilePath, dir, activityId, month, status);
  });
}

async function _doUpdateProgramaMonth(filePath, dir, activityId, month, status) {
  var backupPath = _createBackup(filePath, dir);

  try {
    var workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    var ws = workbook.getWorksheet("PROGRAMA") || workbook.worksheets[0];
    if (!ws) {
      if (backupPath && fs.existsSync(backupPath)) { try { fs.unlinkSync(backupPath); } catch (e) {} }
      return { success: false, error: { code: "SHEET_NOT_FOUND", message: "Hoja no encontrada" } };
    }

    var exceljsRow = parseInt(activityId.replace("act-prog-", ""), 10);
    var monthCol = PROGRAMA_SHEET_CONFIG.startCol + month;

    var row = ws.getRow(exceljsRow);

    var newValue = status === "c" ? "c" : (status === "p" ? "p" : "");
    row.getCell(monthCol).value = newValue;

    var totalC = 0, totalP = 0;
    for (var m = 0; m < 12; m++) {
      var cellVal = row.getCell(PROGRAMA_SHEET_CONFIG.startCol + m).value;
      if (cellVal) {
        var ms = String(cellVal).trim().toLowerCase();
        if (ms === "c") totalC++;
        else if (ms === "p") totalP++;
      }
    }
    var total = totalC + totalP;
    var pct = total > 0 ? Math.round((totalC / total) * 100) / 100 : 0;
    var estadoVal = totalC > 0 && totalP === 0 ? "Ejecutado" : (totalP > 0 ? " Sin Iniciar" : "");
    row.getCell(PROGRAMA_SHEET_CONFIG.colMap.R.col).value = pct;
    row.getCell(PROGRAMA_SHEET_CONFIG.colMap.S.col).value = estadoVal;

    row.commit();
    await workbook.xlsx.writeFile(filePath);

    if (backupPath && fs.existsSync(backupPath)) {
      try { fs.unlinkSync(backupPath); } catch (e) {}
    }

    return {
      success: true,
      data: {
        activities: [{
          id: activityId,
          porcentaje: pct,
          estado: estadoVal
        }]
      }
    };
  } catch (e) {
    if (backupPath && fs.existsSync(backupPath)) {
      try { fs.copyFileSync(backupPath, filePath); } catch (re) {}
    }
    return { success: false, error: { code: "WRITE_ERROR", message: "Error actualizando programa: " + e.message } };
  }
}

async function updateProgramaField(companyRoot, activityId, field, value) {
  var dir = _getCompanyInspeccionesDir(companyRoot);
  var filePath = _findExcelFileDeep(dir, "PROGRAMA DE INSPECCIONES") || _findExcelFileDeep(dir, "PROGRAMA");
  if (!filePath) return { success: false, error: { code: "FILE_NOT_FOUND", message: "Archivo PROGRAMA no encontrado" } };

  var colConfig = PROGRAMA_SHEET_CONFIG.colMap[
    Object.keys(PROGRAMA_SHEET_CONFIG.colMap).find(function(k) {
      return PROGRAMA_SHEET_CONFIG.colMap[k].field === field;
    })
  ];
  if (!colConfig || !colConfig.editable) {
    return { success: false, error: { code: "FIELD_NOT_EDITABLE", message: "Campo no editable: " + field } };
  }

  if (filePath.toLowerCase().endsWith('.xls') && !filePath.toLowerCase().endsWith('.xlsx')) {
    filePath = _convertXlsToXlsx(filePath);
    if (!filePath) return { success: false, error: { code: "CONVERT_ERROR", message: "No se pudo convertir .xls a .xlsx" } };
  }

  var capturedFilePath = filePath;
  var capturedColConfig = colConfig;
  return _serializedWrite(filePath, function() {
    return _doUpdateProgramaField(capturedFilePath, dir, activityId, capturedColConfig, value);
  });
}

async function _doUpdateProgramaField(filePath, dir, activityId, colConfig, value) {
  var backupPath = _createBackup(filePath, dir);

  try {
    var workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    var ws = workbook.getWorksheet("PROGRAMA") || workbook.worksheets[0];
    if (!ws) {
      if (backupPath && fs.existsSync(backupPath)) { try { fs.unlinkSync(backupPath); } catch (e) {} }
      return { success: false, error: { code: "SHEET_NOT_FOUND", message: "Hoja no encontrada" } };
    }

    var exceljsRow = parseInt(activityId.replace("act-prog-", ""), 10);
    var row = ws.getRow(exceljsRow);
    row.getCell(colConfig.col).value = value;
    row.commit();
    await workbook.xlsx.writeFile(filePath);

    if (backupPath && fs.existsSync(backupPath)) {
      try { fs.unlinkSync(backupPath); } catch (e) {}
    }

    return { success: true };
  } catch (e) {
    if (backupPath && fs.existsSync(backupPath)) {
      try { fs.copyFileSync(backupPath, filePath); } catch (re) {}
    }
    return { success: false, error: { code: "WRITE_ERROR", message: "Error actualizando campo programa: " + e.message } };
  }
}

function getInspeccionesStats(companyRoot) {
  var dir = _getCompanyInspeccionesDir(companyRoot);
  if (!fs.existsSync(dir)) {
    return { success: true, data: { totalInspecciones: 0, completadas: 0, pendientesMes: 0, tasaCumplimiento: 0, extintoresVigentes: 0, extintoresTotal: 0 } };
  }

  var programaResult = readProgramaInspecciones(companyRoot, new Date().getFullYear());
  var currentMonth = new Date().getMonth();
  var pendingThisMonth = 0;
  var totalCompleted = 0;
  var totalProgrammed = 0;

  if (programaResult.success && programaResult.data.activities) {
    programaResult.data.activities.forEach(function(a) {
      if (a.months[currentMonth] === "p") pendingThisMonth++;
      Object.values(a.months).forEach(function(v) {
        if (v === "c" || v === "p") totalProgrammed++;
        if (v === "c") totalCompleted++;
      });
    });
  }

  var extintoresResult = readInspeccionExcel(companyRoot, "EXTINTOR");
  var vigentes = 0, totalExt = 0;
  if (extintoresResult.success && extintoresResult.data.items) {
    totalExt = extintoresResult.data.items.length;
    var currentYear = new Date().getFullYear();
 vigentes = extintoresResult.data.items.filter(function(item) {
 var venc = _extractYear(item.vencimiento);
 return !isNaN(venc) && venc >= currentYear;
    }).length;
  }

  var rate = totalProgrammed > 0 ? Math.round((totalCompleted / totalProgrammed) * 100) : 0;

  return {
    success: true,
    data: {
      totalInspecciones: totalCompleted,
      completadas: totalCompleted,
      pendientesMes: pendingThisMonth,
      tasaCumplimiento: rate,
      extintoresVigentes: vigentes,
      extintoresTotal: totalExt
    }
  };
}

function registerInspeccionesHandlers(app, deps) {
  var ipcMain = require("electron").ipcMain;
  var getCompanyRootPath = deps && deps.getCompanyRootPath;
  if (!getCompanyRootPath) {
    throw new Error("[4.2.4] registerInspeccionesHandlers requiere deps.getCompanyRootPath");
  }

  ipcMain.handle("inspecciones:get-stats", async function(event, companyName) {
    try {
      var companyRoot = await getCompanyRootPath(companyName);
      if (!companyRoot) return { success: false, error: { code: "COMPANY_NOT_FOUND", message: "Empresa no encontrada: " + companyName } };
      return getInspeccionesStats(companyRoot);
    } catch (e) {
      console.error("[4.2.4] Error en get-stats:", e);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  });

  ipcMain.handle("inspecciones:get-schedule", async function(event, companyName, year) {
    try {
      var companyRoot = await getCompanyRootPath(companyName);
      if (!companyRoot) return { success: false, error: { code: "COMPANY_NOT_FOUND", message: "Empresa no encontrada" } };
      return readProgramaInspecciones(companyRoot, year);
    } catch (e) {
      console.error("[4.2.4] Error en get-schedule:", e);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  });

  ipcMain.handle("inspecciones:update-month", async function(event, companyName, activityId, month, status) {
    try {
      var companyRoot = await getCompanyRootPath(companyName);
      if (!companyRoot) return { success: false, error: { code: "COMPANY_NOT_FOUND", message: "Empresa no encontrada" } };
      return await updateProgramaMonth(companyRoot, activityId, month, status);
    } catch (e) {
      console.error("[4.2.4] Error en update-month:", e);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  });

  ipcMain.handle("inspecciones:update-field", async function(event, companyName, activityId, field, value) {
    try {
      var companyRoot = await getCompanyRootPath(companyName);
      if (!companyRoot) return { success: false, error: { code: "COMPANY_NOT_FOUND", message: "Empresa no encontrada" } };
      return await updateProgramaField(companyRoot, activityId, field, value);
    } catch (e) {
      console.error("[4.2.4] Error en update-field:", e);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  });

  ipcMain.handle("inspecciones:read-excel", async function(event, companyName, type) {
    try {
      var companyRoot = await getCompanyRootPath(companyName);
      if (!companyRoot) return { success: false, error: { code: "COMPANY_NOT_FOUND", message: "Empresa no encontrada" } };
      return readInspeccionExcel(companyRoot, type);
    } catch (e) {
      console.error("[4.2.4] Error en read-excel:", e);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  });

  ipcMain.handle("inspecciones:write-excel", async function(event, companyName, type, formData) {
    try {
      var companyRoot = await getCompanyRootPath(companyName);
      if (!companyRoot) return { success: false, error: { code: "COMPANY_NOT_FOUND", message: "Empresa no encontrada" } };
      return await writeInspeccionExcel(companyRoot, type, formData);
    } catch (e) {
      console.error("[4.2.4] Error en write-excel:", e);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  });

  ipcMain.handle("inspecciones:write-header", async function(event, companyName, type, headerData) {
    try {
      var companyRoot = await getCompanyRootPath(companyName);
      if (!companyRoot) return { success: false, error: { code: "COMPANY_NOT_FOUND", message: "Empresa no encontrada" } };
      return await writeInspeccionHeader(companyRoot, type, headerData);
    } catch (e) {
      console.error("[4.2.4] Error en write-header:", e);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  });

  ipcMain.handle("inspecciones:get-template", async function(event, companyName, type) {
    try {
      var companyRoot = await getCompanyRootPath(companyName);
      if (!companyRoot) return { success: false, error: { code: "COMPANY_NOT_FOUND", message: "Empresa no encontrada" } };
      return readInspeccionExcel(companyRoot, type);
    } catch (e) {
      console.error("[4.2.4] Error en get-template:", e);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  });

  ipcMain.handle("inspecciones:list-files", async function(event, companyName) {
    try {
      var companyRoot = await getCompanyRootPath(companyName);
      if (!companyRoot) return { success: false, error: { code: "COMPANY_NOT_FOUND", message: "Empresa no encontrada" } };
      return listInspeccionFiles(companyRoot);
    } catch (e) {
      console.error("[4.2.4] Error en list-files:", e);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  });

  ipcMain.handle("inspecciones:get-file-metadata", async function(event, companyName, filePath) {
    try {
      var companyRoot = await getCompanyRootPath(companyName);
      if (!companyRoot) return { success: false, error: { code: "COMPANY_NOT_FOUND", message: "Empresa no encontrada" } };
      return getInspeccionFileMetadata(companyRoot, filePath);
    } catch (e) {
      console.error("[4.2.4] Error en get-file-metadata:", e);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  });

  ipcMain.handle("inspecciones:list", async function(event, companyName, filters) {
    try {
      var companyRoot = await getCompanyRootPath(companyName);
      if (!companyRoot) return { success: false, error: { code: "COMPANY_NOT_FOUND", message: "Empresa no encontrada" } };
      var filesResult = listInspeccionFiles(companyRoot);
      if (!filesResult.success) return filesResult;

      var items = filesResult.data.files.filter(function(f) { return f.type !== "PROGRAMA"; });

      if (filters) {
        if (filters.type) items = items.filter(function(i) { return i.type === filters.type; });
        if (filters.search) {
          var s = filters.search.toLowerCase();
          items = items.filter(function(i) {
            return (i.typeName || "").toLowerCase().indexOf(s) !== -1 ||
              (i.name || "").toLowerCase().indexOf(s) !== -1;
          });
        }
        if (filters.dateFrom) {
          items = items.filter(function(i) { return i.modified >= filters.dateFrom; });
        }
        if (filters.dateTo) {
          items = items.filter(function(i) { return i.modified <= filters.dateTo + "T23:59:59.999Z"; });
        }
      }

      return { success: true, data: { items: items, total: items.length } };
    } catch (e) {
      console.error("[4.2.4] Error en list:", e);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  });

  ipcMain.handle("inspecciones:get", async function(event, companyName, id) {
    try {
      var companyRoot = await getCompanyRootPath(companyName);
      if (!companyRoot) return { success: false, error: { code: "COMPANY_NOT_FOUND", message: "Empresa no encontrada" } };
      return getInspeccionFileMetadata(companyRoot, id);
    } catch (e) {
      console.error("[4.2.4] Error en get:", e);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  });

  ipcMain.handle("inspecciones:delete", async function(event, companyName, id) {
    try {
      if (!fs.existsSync(id)) return { success: false, error: { code: "FILE_NOT_FOUND", message: "Archivo no encontrado" } };
      var dir = _getCompanyInspeccionesDir(await getCompanyRootPath(companyName));
      _createBackup(id, dir);
      fs.unlinkSync(id);
      return { success: true, data: { deleted: true, id: id } };
    } catch (e) {
      console.error("[4.2.4] Error en delete:", e);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  });
}

module.exports = { registerInspeccionesHandlers };
