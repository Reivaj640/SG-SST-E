/* ==========================================================================
K+AIR — Módulo 4.2.5 Mantenimiento Periódico
Bridge — Lectura/escritura Excel GS-FO-008 + Evidencias
Node.js puro (SheetJS) — sin Python
========================================================================== */
var xlsx = require('xlsx');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var HEADER_ROWS = 9;
var DATA_START_ROW = 9;
var MONTH_COL_START = 7;
var COSTO_COL = 43;
var SHEET_NAME = 'General';

var MONTHS = [
 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

var MONTH_TYPES = ['MPP','MPE','MPC'];

var BASE_FIELDS = [
 { key:'item', col:0, label:'Item / Categoría', editable:false },
 { key:'instalacion', col:1, label:'Instalación / Equipo', editable:true },
 { key:'codigo', col:2, label:'Código del equipo', editable:true },
 { key:'responsable', col:3, label:'Responsable del Mto', editable:true },
 { key:'diagnostico', col:4, label:'Diagnóstico', editable:true },
 { key:'actividades', col:5, label:'Actividades realizadas', editable:true },
 { key:'frecuencia', col:6, label:'Frecuencia', editable:true }
];

var TEMPLATE_FILE = 'GS-FO-008 CRONOGRAMA MANTENIMIENTO PREVENTIVO.xls';

var _app = null;
var _getCompanyRootPath = null;

function _getCompanyMantenimientoDir(companyRoot) {
 if (!companyRoot) return null;
 var gestionDir = _findDir(companyRoot, '4. Gestion de Peligros') ||
                   _findDir(companyRoot, '4. Gestión de Peligros');
 if (gestionDir) {
  var sub = _findDir(gestionDir, '4.2.5');
  if (sub) return sub;
 }
 var direct = _findDir(companyRoot, '4.2.5');
 if (direct) return direct;
 return path.join(companyRoot, '4. Gestion de Peligros y Riesgos', '4.2.5 Mantenimiento periodico de equipos, instalaciones herramientas');
}

function _findDir(parent, prefix) {
 if (!parent || !fs.existsSync(parent)) return null;
 try {
  var entries = fs.readdirSync(parent, { withFileTypes: true });
  for (var i = 0; i < entries.length; i++) {
   if (entries[i].isDirectory() && entries[i].name.toLowerCase().startsWith(prefix.toLowerCase())) {
    return path.join(parent, entries[i].name);
   }
  }
 } catch (e) {}
 return null;
}

function _findExcelFile(dir, pattern) {
 if (!dir || !fs.existsSync(dir)) return null;
 try {
  var entries = fs.readdirSync(dir);
  var lower = pattern.toLowerCase();
  for (var i = 0; i < entries.length; i++) {
   if (entries[i].toLowerCase().includes(lower) &&
       (entries[i].toLowerCase().endsWith('.xls') || entries[i].toLowerCase().endsWith('.xlsx'))) {
    return path.join(dir, entries[i]);
   }
  }
 } catch (e) {}
 return null;
}

function _copyTemplateToDir(dir) {
 var templateSrc = path.join(__dirname, '..', 'utils', TEMPLATE_FILE);
 if (!fs.existsSync(templateSrc)) return null;
 if (!fs.existsSync(dir)) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { return null; }
 }
 var dest = path.join(dir, TEMPLATE_FILE);
 if (!fs.existsSync(dest)) {
  fs.copyFileSync(templateSrc, dest);
 }
 return dest;
}

function _createBackup(filePath) {
 if (!filePath || !fs.existsSync(filePath)) return null;
 var backupDir = path.join(path.dirname(filePath), 'backup');
 if (!fs.existsSync(backupDir)) {
  try { fs.mkdirSync(backupDir, { recursive: true }); } catch (e) { return null; }
 }
 var ts = new Date().toISOString().replace(/[:.]/g, '-');
 var backupPath = path.join(backupDir, path.basename(filePath) + '_' + ts + '.bak');
 try {
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
 } catch (e) { return null; }
}

function _sanitizeFolderName(name) {
 return name.replace(/[<>:"/\\|?*]/g, '_').trim().substring(0, 80) || 'SIN_CATEGORIA';
}

function _getEvidenceSubdir(companyRoot, category, year) {
 var base = _getCompanyMantenimientoDir(companyRoot);
 if (!base) return null;
 var yearStr = String(year || new Date().getFullYear());
 var safeCat = _sanitizeFolderName(category || 'SIN_CATEGORIA');
 var dir = path.join(base, 'evidencias', yearStr, safeCat);
 if (!fs.existsSync(dir)) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { return null; }
 }
 return dir;
}

function _getEvidenceBaseDir(companyRoot) {
 var base = _getCompanyMantenimientoDir(companyRoot);
 if (!base) return null;
 var dir = path.join(base, 'evidencias');
 if (!fs.existsSync(dir)) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { return null; }
 }
 return dir;
 }

function _safeStr(v) {
 if (v === null || v === undefined) return '';
 return String(v).trim();
}

function _buildMonthMap(rowValues) {
 var months = {};
 for (var m = 0; m < 12; m++) {
  var monthData = {};
  for (var t = 0; t < 3; t++) {
   var col = MONTH_COL_START + (m * 3) + t;
   var val = rowValues[col] !== undefined ? _safeStr(rowValues[col]) : '';
   monthData[MONTH_TYPES[t]] = val.toLowerCase() === 'x';
  }
  months[MONTHS[m]] = monthData;
 }
 return months;
}

function _readExcel(companyRoot) {
 var dir = _getCompanyMantenimientoDir(companyRoot);
 var filePath;

 if (dir && fs.existsSync(dir)) {
  filePath = _findExcelFile(dir, 'GS-FO-008') || _findExcelFile(dir, 'MANTENIMIENTO') || _findExcelFile(dir, 'CRONOGRAMA');
 }

 if (!filePath) {
  filePath = _copyTemplateToDir(dir || path.join(companyRoot, '4. Gestion de Peligros y Riesgos', '4.2.5 Mantenimiento periodico de equipos, instalaciones herramientas'));
 }

 if (!filePath || !fs.existsSync(filePath)) {
  return { success: false, error: { code: 'FILE_NOT_FOUND', message: 'No se encontró el archivo GS-FO-008' } };
 }

 try {
  var wb = xlsx.readFile(filePath, { type: 'file' });
  var sheetName = SHEET_NAME;
  if (!wb.SheetNames.includes(sheetName)) {
   sheetName = wb.SheetNames[0];
  }
  var s = wb.Sheets[sheetName];
  var sd = xlsx.utils.sheet_to_json(s, { header: 1, defval: '', raw: true });

  var headerInfo = {
   process: _safeStr(sd[3] ? sd[3][2] : ''),
   title: _safeStr(sd[4] ? sd[4][2] : ''),
   code: _safeStr(sd[5] ? sd[5][2] : ''),
   year: _extractYearFromHeader(sd)
  };

  var items = [];
  var categories = [];
  var currentCategory = '';

  for (var r = DATA_START_ROW; r < sd.length; r++) {
   var row = sd[r];
   if (!row) continue;

   var hasData = false;
   for (var c = 0; c <= COSTO_COL; c++) {
    if (row[c] !== undefined && row[c] !== null && _safeStr(row[c]) !== '') {
     hasData = true;
     break;
    }
   }
   if (!hasData) continue;

   var itemVal = _safeStr(row[0]);
   if (itemVal) {
    currentCategory = itemVal;
    if (categories.indexOf(currentCategory) === -1) {
     categories.push(currentCategory);
    }
   }

   items.push({
    rowIndex: r,
    item: itemVal || currentCategory,
    _category: itemVal ? itemVal : currentCategory,
    instalacion: _safeStr(row[1]),
    codigo: _safeStr(row[2]),
    responsable: _safeStr(row[3]),
    diagnostico: _safeStr(row[4]),
    actividades: _safeStr(row[5]),
    frecuencia: _safeStr(row[6]),
    months: _buildMonthMap(row),
    costo: row[COSTO_COL] !== undefined && row[COSTO_COL] !== '' ? row[COSTO_COL] : null,
    _filePath: filePath
   });
  }

  return {
   success: true,
   data: {
    header: headerInfo,
    items: items,
    categories: categories,
    totalRows: sd.length,
    totalCols: sd[0] ? sd[0].length : 0,
    _filePath: filePath
   }
  };
 } catch (e) {
  return { success: false, error: { code: 'READ_ERROR', message: e.message } };
 }
}

function _extractYearFromHeader(sd) {
 for (var r = 0; r < Math.min(9, sd.length); r++) {
  for (var c = 0; c < (sd[r] ? sd[r].length : 0); c++) {
   var v = _safeStr(sd[r][c]);
   if (v.indexOf('Año') !== -1 || v.indexOf('AÑO') !== -1 || v.indexOf('año') !== -1) {
    var m = v.match(/(20\d{2})/);
    if (m) return parseInt(m[1], 10);
    if (sd[r][c + 1]) {
     var m2 = _safeStr(sd[r][c + 1]).match(/(20\d{2})/);
     if (m2) return parseInt(m2[1], 10);
    }
   }
   var vm = _safeStr(sd[r][c]).match(/\b(20\d{2})\b/);
   if (vm) return parseInt(vm[1], 10);
  }
 }
 return new Date().getFullYear();
}

function _saveExcel(companyRoot, items) {
 var readResult = _readExcel(companyRoot);
 if (!readResult.success) return readResult;

 var filePath = readResult.data._filePath;
 if (!filePath || !fs.existsSync(filePath)) {
  return { success: false, error: { code: 'FILE_NOT_FOUND', message: 'Archivo Excel no encontrado' } };
 }

 var backupPath = _createBackup(filePath);

 try {
  var wb = xlsx.readFile(filePath, { type: 'file' });
  var sheetName = SHEET_NAME;
  if (!wb.SheetNames.includes(sheetName)) sheetName = wb.SheetNames[0];
  var s = wb.Sheets[sheetName];
  var sd = xlsx.utils.sheet_to_json(s, { header: 1, defval: '', raw: true });
  var merges = s['!merges'] || [];

  var itemsByRow = {};
  (items || []).forEach(function(item) {
   if (item.rowIndex !== undefined && item.rowIndex !== null) {
    itemsByRow[item.rowIndex] = item;
   }
  });

  for (var r = DATA_START_ROW; r < sd.length; r++) {
   var itemData = itemsByRow[r];
   if (!itemData) continue;

   for (var b = 0; b < BASE_FIELDS.length; b++) {
    var field = BASE_FIELDS[b];
    if (field.editable && itemData[field.key] !== undefined) {
     sd[r][field.col] = itemData[field.key];
    }
   }

   for (var m = 0; m < 12; m++) {
    for (var t = 0; t < 3; t++) {
     var col = MONTH_COL_START + (m * 3) + t;
     var monthName = MONTHS[m];
     var typeName = MONTH_TYPES[t];
     if (itemData.months && itemData.months[monthName] && itemData.months[monthName][typeName] !== undefined) {
      sd[r][col] = itemData.months[monthName][typeName] ? 'x' : '';
     }
    }
   }

   if (itemData.costo !== undefined && itemData.costo !== null) {
    sd[r][COSTO_COL] = itemData.costo;
   }
  }

  var newWs = xlsx.utils.aoa_to_sheet(sd);
  newWs['!merges'] = merges;

  var newWb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(newWb, newWs, sheetName);
  xlsx.writeFile(newWb, filePath, { bookType: filePath.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'xls' });

  if (backupPath && fs.existsSync(backupPath)) {
   try { fs.unlinkSync(backupPath); } catch (e) {}
  }

  return { success: true, data: { message: 'Cambios guardados correctamente', itemsUpdated: items ? items.length : 0 } };
 } catch (e) {
  if (backupPath && fs.existsSync(backupPath)) {
   try { fs.copyFileSync(backupPath, filePath); } catch (re) {}
  }
  return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
 }
}

function _toggleMonth(companyRoot, rowIndex, month, type, value) {
 var readResult = _readExcel(companyRoot);
 if (!readResult.success) return readResult;

 var filePath = readResult.data._filePath;
 if (!filePath || !fs.existsSync(filePath)) {
  return { success: false, error: { code: 'FILE_NOT_FOUND', message: 'Archivo Excel no encontrado' } };
 }

 var backupPath = _createBackup(filePath);

 try {
  var wb = xlsx.readFile(filePath, { type: 'file' });
  var sheetName = SHEET_NAME;
  if (!wb.SheetNames.includes(sheetName)) sheetName = wb.SheetNames[0];
  var s = wb.Sheets[sheetName];
  var sd = xlsx.utils.sheet_to_json(s, { header: 1, defval: '', raw: true });
  var merges = s['!merges'] || [];

  if (rowIndex < DATA_START_ROW || rowIndex >= sd.length) {
   return { success: false, error: { code: 'INVALID_ROW', message: 'Fila fuera de rango' } };
  }

  var monthIdx = MONTHS.indexOf(month);
  if (monthIdx === -1) {
   return { success: false, error: { code: 'INVALID_MONTH', message: 'Mes no válido' } };
  }

  var typeIdx = MONTH_TYPES.indexOf(type);
  if (typeIdx === -1) {
   return { success: false, error: { code: 'INVALID_TYPE', message: 'Tipo no válido' } };
  }

  var col = MONTH_COL_START + (monthIdx * 3) + typeIdx;
  sd[rowIndex][col] = value ? 'x' : '';

  var newWs = xlsx.utils.aoa_to_sheet(sd);
  newWs['!merges'] = merges;

  var newWb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(newWb, newWs, sheetName);
  xlsx.writeFile(newWb, filePath, { bookType: filePath.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'xls' });

  if (backupPath && fs.existsSync(backupPath)) {
   try { fs.unlinkSync(backupPath); } catch (e) {}
  }

  return { success: true, data: { message: 'Celda actualizada', rowIndex: rowIndex, month: month, type: type, value: value } };
 } catch (e) {
  if (backupPath && fs.existsSync(backupPath)) {
   try { fs.copyFileSync(backupPath, filePath); } catch (re) {}
  }
  return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
 }
}

function _updateField(companyRoot, rowIndex, field, value) {
 var editableKeys = BASE_FIELDS.filter(function(f) { return f.editable; }).map(function(f) { return f.key; });
 editableKeys.push('costo');

 if (editableKeys.indexOf(field) === -1) {
  return { success: false, error: { code: 'INVALID_FIELD', message: 'Campo no editable: ' + field } };
 }

 var readResult = _readExcel(companyRoot);
 if (!readResult.success) return readResult;

 var filePath = readResult.data._filePath;
 if (!filePath || !fs.existsSync(filePath)) {
  return { success: false, error: { code: 'FILE_NOT_FOUND', message: 'Archivo Excel no encontrado' } };
 }

 var backupPath = _createBackup(filePath);

 try {
  var wb = xlsx.readFile(filePath, { type: 'file' });
  var sheetName = SHEET_NAME;
  if (!wb.SheetNames.includes(sheetName)) sheetName = wb.SheetNames[0];
  var s = wb.Sheets[sheetName];
  var sd = xlsx.utils.sheet_to_json(s, { header: 1, defval: '', raw: true });
  var merges = s['!merges'] || [];

  if (rowIndex < DATA_START_ROW || rowIndex >= sd.length) {
   return { success: false, error: { code: 'INVALID_ROW', message: 'Fila fuera de rango' } };
  }

  if (field === 'costo') {
   sd[rowIndex][COSTO_COL] = value;
  } else {
   var baseField = BASE_FIELDS.find(function(f) { return f.key === field; });
   if (baseField) {
    sd[rowIndex][baseField.col] = value;
   }
  }

  var newWs = xlsx.utils.aoa_to_sheet(sd);
  newWs['!merges'] = merges;

  var newWb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(newWb, newWs, sheetName);
  xlsx.writeFile(newWb, filePath, { bookType: filePath.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'xls' });

  if (backupPath && fs.existsSync(backupPath)) {
   try { fs.unlinkSync(backupPath); } catch (e) {}
  }

  return { success: true, data: { message: 'Campo actualizado', rowIndex: rowIndex, field: field, value: value } };
 } catch (e) {
  if (backupPath && fs.existsSync(backupPath)) {
   try { fs.copyFileSync(backupPath, filePath); } catch (re) {}
  }
  return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
 }
}

function _addRow(companyRoot, itemData) {
 var readResult = _readExcel(companyRoot);
 if (!readResult.success) return readResult;

 var filePath = readResult.data._filePath;
 if (!filePath || !fs.existsSync(filePath)) {
  return { success: false, error: { code: 'FILE_NOT_FOUND', message: 'Archivo Excel no encontrado' } };
 }

 var backupPath = _createBackup(filePath);

 try {
  var wb = xlsx.readFile(filePath, { type: 'file' });
  var sheetName = SHEET_NAME;
  if (!wb.SheetNames.includes(sheetName)) sheetName = wb.SheetNames[0];
  var s = wb.Sheets[sheetName];
  var sd = xlsx.utils.sheet_to_json(s, { header: 1, defval: '', raw: true });
  var merges = s['!merges'] || [];

  var newRow = [];
  newRow[0] = _safeStr(itemData.item || '');
  newRow[1] = _safeStr(itemData.instalacion || '');
  newRow[2] = _safeStr(itemData.codigo || '');
  newRow[3] = _safeStr(itemData.responsable || '');
  newRow[4] = _safeStr(itemData.diagnostico || '');
  newRow[5] = _safeStr(itemData.actividades || '');
  newRow[6] = _safeStr(itemData.frecuencia || '');

  for (var m = 0; m < 12; m++) {
   for (var t = 0; t < 3; t++) {
    var col = MONTH_COL_START + (m * 3) + t;
    var monthName = MONTHS[m];
    var typeName = MONTH_TYPES[t];
    if (itemData.months && itemData.months[monthName] && itemData.months[monthName][typeName]) {
     newRow[col] = 'x';
    } else {
     newRow[col] = '';
    }
   }
  }

  newRow[COSTO_COL] = itemData.costo || null;

  sd.push(newRow);
  var newRowIndex = sd.length - 1;

  var newWs = xlsx.utils.aoa_to_sheet(sd);
  newWs['!merges'] = merges;

  var newWb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(newWb, newWs, sheetName);
  xlsx.writeFile(newWb, filePath, { bookType: filePath.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'xls' });

  if (backupPath && fs.existsSync(backupPath)) {
   try { fs.unlinkSync(backupPath); } catch (e) {}
  }

  return { success: true, data: { message: 'Fila agregada', newRowIndex: newRowIndex } };
 } catch (e) {
  if (backupPath && fs.existsSync(backupPath)) {
   try { fs.copyFileSync(backupPath, filePath); } catch (re) {}
  }
  return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
 }
}

function _saveEvidence(companyRoot, evidenceData) {
 var category = evidenceData.category || 'SIN_CATEGORIA';
 var year = evidenceData.year || new Date().getFullYear();
 var evidenceDir = _getEvidenceSubdir(companyRoot, category, year);
 if (!evidenceDir) {
  return { success: false, error: { code: 'DIR_ERROR', message: 'No se pudo crear directorio de evidencias' } };
 }

 try {
  var fileName = _safeStr(path.basename(evidenceData.fileName || 'archivo'));
  var rowIndex = evidenceData.itemRowIndex || 0;
  var ts = Date.now();
  var rand = crypto.randomBytes(4).toString('hex');
  var ext = path.extname(fileName) || '';
  var safeName = 'row' + rowIndex + '_' + ts + '_' + rand + ext;
  var filePath = path.join(evidenceDir, safeName);

  var buffer = Buffer.from(evidenceData.buffer, 'base64');
  fs.writeFileSync(filePath, buffer);

  var yearStr = String(year);
  var safeCat = _sanitizeFolderName(category);
  var relativePath = yearStr + '/' + safeCat + '/' + safeName;

  return {
   success: true,
   data: {
    id: ts + '_' + rand,
    itemRowIndex: rowIndex,
    fileName: fileName,
    filePath: relativePath,
    fileSize: buffer.length,
    createdAt: new Date().toISOString()
   }
  };
 } catch (e) {
  return { success: false, error: { code: 'EVIDENCE_SAVE_ERROR', message: e.message } };
 }
}

function _resolveEvidencePath(companyRoot, relativePath) {
 var baseDir = _getEvidenceBaseDir(companyRoot);
 if (!baseDir) return null;
 var parts = relativePath.split('/').map(function(p) { return path.basename(p); });
 var resolved = path.join.apply(null, [baseDir].concat(parts));
 if (resolved.indexOf(baseDir) !== 0) return null;
 if (fs.existsSync(resolved)) return resolved;
 var flatPath = path.join(baseDir, path.basename(relativePath));
 if (fs.existsSync(flatPath)) return flatPath;
 return null;
}

function _readEvidenceFile(companyRoot, relativePath) {
 var resolved = _resolveEvidencePath(companyRoot, relativePath);
 if (!resolved) {
  return { success: false, error: { code: 'FILE_NOT_FOUND', message: 'Archivo de evidencia no encontrado' } };
 }
 try {
  var buffer = fs.readFileSync(resolved);
  var safeName = path.basename(resolved);
  var ext = path.extname(safeName).toLowerCase();
  var mimeType = 'application/octet-stream';
  if (ext === '.png') mimeType = 'image/png';
  else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
  else if (ext === '.gif') mimeType = 'image/gif';
  else if (ext === '.pdf') mimeType = 'application/pdf';
  else if (ext === '.doc' || ext === '.docx') mimeType = 'application/msword';
  else if (ext === '.xls' || ext === '.xlsx') mimeType = 'application/vnd.ms-excel';
  return {
   success: true,
   data: {
    buffer: buffer.toString('base64'),
    fileName: safeName,
    mimeType: mimeType
   }
  };
 } catch (e) {
  return { success: false, error: { code: 'READ_ERROR', message: e.message } };
 }
}

function _deleteEvidence(companyRoot, relativePath) {
 var resolved = _resolveEvidencePath(companyRoot, relativePath);
 if (!resolved) {
  return { success: false, error: { code: 'FILE_NOT_FOUND', message: 'Archivo de evidencia no encontrado' } };
 }
 try {
  fs.unlinkSync(resolved);
  return { success: true, data: { message: 'Evidencia eliminada' } };
 } catch (e) {
  return { success: false, error: { code: 'DELETE_ERROR', message: e.message } };
 }
}

function _listEvidences(companyRoot, rowIndex, category, year) {
 var baseDir = _getEvidenceBaseDir(companyRoot);
 if (!baseDir || !fs.existsSync(baseDir)) {
  return { success: true, data: [] };
 }
 try {
  var result = [];
  var yearStr = String(year || new Date().getFullYear());
  var safeCat = _sanitizeFolderName(category || '');
  var subdir = path.join(baseDir, yearStr, safeCat);
  if (category && year && fs.existsSync(subdir)) {
   _scanEvidenceDir(subdir, rowIndex, yearStr + '/' + safeCat + '/', result);
  } else if (category && year) {
   var legacyDir = path.join(baseDir, yearStr);
   if (fs.existsSync(legacyDir)) {
    _scanEvidenceDir(legacyDir, rowIndex, yearStr + '/', result);
   }
   _scanEvidenceDir(baseDir, rowIndex, '', result);
  } else {
   _scanEvidenceTree(baseDir, rowIndex, '', result);
  }
  result.sort(function(a, b) { return b.createdAt.localeCompare(a.createdAt); });
  return { success: true, data: result };
 } catch (e) {
  return { success: false, error: { code: 'LIST_ERROR', message: e.message } };
 }
}

function _scanEvidenceDir(dir, rowIndex, pathPrefix, result) {
 if (!fs.existsSync(dir)) return;
 try {
  var entries = fs.readdirSync(dir);
  var prefix = rowIndex !== undefined && rowIndex !== null ? 'row' + rowIndex + '_' : null;
  entries.forEach(function(entry) {
   var fp = path.join(dir, entry);
   try {
    var stat = fs.statSync(fp);
    if (stat.isFile()) {
     if (prefix && !entry.startsWith(prefix)) return;
     result.push({
      fileName: entry,
      filePath: pathPrefix + entry,
      fileSize: stat.size,
      createdAt: stat.mtime.toISOString()
     });
    }
   } catch (e) {}
  });
 } catch (e) {}
}

function _scanEvidenceTree(dir, rowIndex, pathPrefix, result) {
 if (!fs.existsSync(dir)) return;
 try {
  var entries = fs.readdirSync(dir);
  var prefix = rowIndex !== undefined && rowIndex !== null ? 'row' + rowIndex + '_' : null;
  entries.forEach(function(entry) {
   var fp = path.join(dir, entry);
   try {
    var stat = fs.statSync(fp);
    if (stat.isFile()) {
     if (prefix && !entry.startsWith(prefix)) return;
     result.push({
      fileName: entry,
      filePath: pathPrefix + entry,
      fileSize: stat.size,
      createdAt: stat.mtime.toISOString()
     });
    } else if (stat.isDirectory()) {
     _scanEvidenceTree(fp, rowIndex, pathPrefix + entry + '/', result);
    }
   } catch (e) {}
  });
 } catch (e) {}
}

function registerMantenimientoHandlers(app, deps) {
 _app = app;
 _getCompanyRootPath = deps && deps.getCompanyRootPath ? deps.getCompanyRootPath : null;

 var ipcMain = require('electron').ipcMain;

 ipcMain.handle('mantenimiento:read', async function(_e, companyName) {
  try {
   var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
   if (!companyRoot) return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
   return _readExcel(companyRoot);
  } catch (e) {
   return { success: false, error: { code: 'READ_ERROR', message: e.message } };
  }
 });

 ipcMain.handle('mantenimiento:save', async function(_e, companyName, items) {
  try {
   var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
   if (!companyRoot) return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
   return _saveExcel(companyRoot, items);
  } catch (e) {
   return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
  }
 });

 ipcMain.handle('mantenimiento:toggle-month', async function(_e, companyName, rowIndex, month, type, value) {
  try {
   var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
   if (!companyRoot) return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
   return _toggleMonth(companyRoot, rowIndex, month, type, value);
  } catch (e) {
   return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
  }
 });

 ipcMain.handle('mantenimiento:update-field', async function(_e, companyName, rowIndex, field, value) {
  try {
   var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
   if (!companyRoot) return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
   return _updateField(companyRoot, rowIndex, field, value);
  } catch (e) {
   return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
  }
 });

 ipcMain.handle('mantenimiento:add-row', async function(_e, companyName, itemData) {
  try {
   var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
   if (!companyRoot) return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
   return _addRow(companyRoot, itemData);
  } catch (e) {
   return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
  }
 });

 ipcMain.handle('mantenimiento:save-evidence', async function(_e, companyName, evidenceData) {
  try {
   var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
   if (!companyRoot) return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
   return _saveEvidence(companyRoot, evidenceData);
  } catch (e) {
   return { success: false, error: { code: 'EVIDENCE_SAVE_ERROR', message: e.message } };
  }
 });

 ipcMain.handle('mantenimiento:read-evidence-file', async function(_e, companyName, relativePath) {
  try {
   var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
   if (!companyRoot) return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
   return _readEvidenceFile(companyRoot, relativePath);
  } catch (e) {
   return { success: false, error: { code: 'READ_ERROR', message: e.message } };
  }
 });

 ipcMain.handle('mantenimiento:delete-evidence', async function(_e, companyName, relativePath) {
  try {
   var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
   if (!companyRoot) return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
   return _deleteEvidence(companyRoot, relativePath);
  } catch (e) {
   return { success: false, error: { code: 'DELETE_ERROR', message: e.message } };
  }
 });

 ipcMain.handle('mantenimiento:list-evidences', async function(_e, companyName, rowIndex, category, year) {
  try {
   var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
   if (!companyRoot) return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
   return _listEvidences(companyRoot, rowIndex, category, year);
  } catch (e) {
   return { success: false, error: { code: 'LIST_ERROR', message: e.message } };
  }
 });
}

module.exports = { registerMantenimientoHandlers };
