/* ==========================================================================
K+AIR — Módulo 4.2.5 Mantenimiento Periódico
Bridge — Lectura/escritura Excel GS-FO-008 + Evidencias
Escritura: ExcelJS (preserva layout) — Lectura: SheetJS
========================================================================== */
var ExcelJS = require('exceljs');
var xlsx = require('xlsx');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var electron_ = require('electron');
var BrowserWindow = electron_.BrowserWindow;

var DATA_START_ROW = 9;
var EXCELJS_ROW_OFFSET = 4;
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

var TEMPLATE_FILE = 'GS-FO-008 CRONOGRAMA MANTENIMIENTO PREVENTIVO.xlsx';

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
		var xlsxMatch = null;
		var xlsMatch = null;
		for (var i = 0; i < entries.length; i++) {
			var e = entries[i].toLowerCase();
			if (e.includes(lower)) {
				if (e.endsWith('.xlsx') && !xlsxMatch) xlsxMatch = path.join(dir, entries[i]);
				if (e.endsWith('.xls') && !e.endsWith('.xlsx') && !xlsMatch) xlsMatch = path.join(dir, entries[i]);
			}
		}
		return xlsxMatch || xlsMatch || null;
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

/* Devuelve los días hábiles (lun-vie) de la 2da y 3ra semana natural de un mes.
   Sirve para distribuir los mantenimientos programados en el calendario en
   "los primeros 5 días de la 2 o 3 semana". Retorna hasta 10 strings 'YYYY-MM-DD'.
   monthIdx es 0-based (0=Enero, 11=Diciembre). */
function _getWeek2And3BusinessDays(year, monthIdx) {
 var firstOfMonth = new Date(year, monthIdx, 1);
 var firstWeekday = firstOfMonth.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb

 // Calcular el primer lunes EN O DESPUÉS del día 1 del mes
 var daysToFirstMonday = (1 - firstWeekday + 7) % 7;
 var firstMondayDay = 1 + daysToFirstMonday;

 var dates = [];
 // Semana 2: lunes firstMondayDay+7 a viernes firstMondayDay+11
 // Semana 3: lunes firstMondayDay+14 a viernes firstMondayDay+18
 for (var week = 2; week <= 3; week++) {
  var mondayOfWeek = firstMondayDay + (week - 1) * 7;
  for (var d = 0; d < 5; d++) {
   var dayNum = mondayOfWeek + d;
   var date = new Date(year, monthIdx, dayNum);
   // Si se pasa al mes siguiente (caso febrero corto), parar
   if (date.getMonth() !== monthIdx) continue;
   var yyyy = date.getFullYear();
   var mm = String(date.getMonth() + 1).padStart(2, '0');
   var dd = String(date.getDate()).padStart(2, '0');
   dates.push(yyyy + '-' + mm + '-' + dd);
  }
 }
 return dates;
}

function _convertXlsToXlsx(xlsPath) {
	try {
		var wb = xlsx.readFile(xlsPath, { type: 'file' });
		var xlsxPath = xlsPath.replace(/\.xls$/i, '.xlsx');
		xlsx.writeFile(wb, xlsxPath, { bookType: 'xlsx' });
		var backupDir = path.join(path.dirname(xlsPath), 'backup');
		if (!fs.existsSync(backupDir)) {
			try { fs.mkdirSync(backupDir, { recursive: true }); } catch (e) {}
		}
		var backupPath = path.join(backupDir, path.basename(xlsPath) + '_pre_xlsx_conversion.bak');
		try { fs.copyFileSync(xlsPath, backupPath); } catch (e) {}
		try { fs.unlinkSync(xlsPath); } catch (e) {}
		return xlsxPath;
	} catch (e) {
		console.error('[MANTENIMIENTO] Error convirtiendo .xls a .xlsx:', e.message);
		return null;
	}
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

	if (filePath.toLowerCase().endsWith('.xls') && !filePath.toLowerCase().endsWith('.xlsx')) {
		filePath = _convertXlsToXlsx(filePath);
		if (!filePath) {
			return { success: false, error: { code: 'CONVERT_ERROR', message: 'No se pudo convertir .xls a .xlsx' } };
		}
	}

 try {
   return _parseExcel(filePath);
 } catch (e) {
   return { success: false, error: { code: 'READ_ERROR', message: e.message } };
 }
}

function _getExcelFilePath(companyRoot) {
	var dir = _getCompanyMantenimientoDir(companyRoot);
	var filePath;

	if (dir && fs.existsSync(dir)) {
		filePath = _findExcelFile(dir, 'GS-FO-008') || _findExcelFile(dir, 'MANTENIMIENTO') || _findExcelFile(dir, 'CRONOGRAMA');
	}

	if (!filePath) {
		filePath = _copyTemplateToDir(dir || path.join(companyRoot, '4. Gestion de Peligros y Riesgos', '4.2.5 Mantenimiento periodico de equipos, instalaciones herramientas'));
	}

	if (!filePath || !fs.existsSync(filePath)) {
		return { success: false, error: { code: 'FILE_NOT_FOUND', message: 'Archivo Excel no encontrado' } };
	}

	if (filePath.toLowerCase().endsWith('.xls') && !filePath.toLowerCase().endsWith('.xlsx')) {
		filePath = _convertXlsToXlsx(filePath);
		if (!filePath) {
			return { success: false, error: { code: 'CONVERT_ERROR', message: 'No se pudo convertir .xls a .xlsx' } };
		}
	}

	return { success: true, data: { filePath: filePath } };
}

function _parseExcel(filePath) {
  var wb = xlsx.readFile(filePath, { type: 'file' });
  var sheetName = SHEET_NAME;
  if (!wb.SheetNames.includes(sheetName)) {
   sheetName = wb.SheetNames[0];
  }
  var s = wb.Sheets[sheetName];
  var sd = xlsx.utils.sheet_to_json(s, { header: 1, defval: '', raw: true });

  var headerInfo = {
    process: _safeStr(sd[0] ? sd[0][2] : ''),
    title: _safeStr(sd[1] ? sd[1][2] : ''),
    code: _safeStr(sd[2] ? sd[2][2] : ''),
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

async function _saveExcel(companyRoot, items) {
	var pathResult = _getExcelFilePath(companyRoot);
	if (!pathResult.success) return pathResult;

	var filePath = pathResult.data.filePath;
	if (!filePath || !fs.existsSync(filePath)) {
		return { success: false, error: { code: 'FILE_NOT_FOUND', message: 'Archivo Excel no encontrado' } };
	}

	var backupPath = _createBackup(filePath);

	try {
		var workbook = new ExcelJS.Workbook();
		await workbook.xlsx.readFile(filePath);
		var ws = workbook.getWorksheet(SHEET_NAME) || workbook.worksheets[0];
		if (!ws) return { success: false, error: { code: 'SHEET_NOT_FOUND', message: 'Hoja no encontrada' } };

		var itemsByRow = {};
		(items || []).forEach(function(item) {
			if (item.rowIndex !== undefined && item.rowIndex !== null) {
				itemsByRow[item.rowIndex] = item;
			}
		});

  var dataStartRow = DATA_START_ROW + EXCELJS_ROW_OFFSET;
  for (var r = dataStartRow; r <= ws.rowCount; r++) {
    var sheetjsRow = r - EXCELJS_ROW_OFFSET;
    var itemData = itemsByRow[sheetjsRow];
			if (!itemData) continue;

			var row = ws.getRow(r);

			for (var b = 0; b < BASE_FIELDS.length; b++) {
				var field = BASE_FIELDS[b];
				if (field.editable && itemData[field.key] !== undefined) {
					row.getCell(field.col + 1).value = itemData[field.key];
				}
			}

			for (var m = 0; m < 12; m++) {
				for (var t = 0; t < 3; t++) {
					var col = MONTH_COL_START + (m * 3) + t;
					var monthName = MONTHS[m];
					var typeName = MONTH_TYPES[t];
					if (itemData.months && itemData.months[monthName] && itemData.months[monthName][typeName] !== undefined) {
						row.getCell(col + 1).value = itemData.months[monthName][typeName] ? 'x' : '';
					}
				}
			}

			if (itemData.costo !== undefined && itemData.costo !== null) {
				row.getCell(COSTO_COL + 1).value = itemData.costo;
			}

			row.commit();
		}

		await workbook.xlsx.writeFile(filePath);

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

async function _toggleMonth(companyRoot, rowIndex, month, type, value) {
	var pathResult = _getExcelFilePath(companyRoot);
	if (!pathResult.success) return pathResult;

	var filePath = pathResult.data.filePath;
	if (!filePath || !fs.existsSync(filePath)) {
		return { success: false, error: { code: 'FILE_NOT_FOUND', message: 'Archivo Excel no encontrado' } };
	}

	var monthIdx = MONTHS.indexOf(month);
	if (monthIdx === -1) {
		return { success: false, error: { code: 'INVALID_MONTH', message: 'Mes no válido' } };
	}

	var typeIdx = MONTH_TYPES.indexOf(type);
	if (typeIdx === -1) {
		return { success: false, error: { code: 'INVALID_TYPE', message: 'Tipo no válido' } };
	}

	var backupPath = _createBackup(filePath);

	try {
		var workbook = new ExcelJS.Workbook();
		await workbook.xlsx.readFile(filePath);
		var ws = workbook.getWorksheet(SHEET_NAME) || workbook.worksheets[0];
		if (!ws) return { success: false, error: { code: 'SHEET_NOT_FOUND', message: 'Hoja no encontrada' } };

  var exceljsRow = rowIndex + EXCELJS_ROW_OFFSET;
  if (exceljsRow < DATA_START_ROW + EXCELJS_ROW_OFFSET || exceljsRow > ws.rowCount) {
    return { success: false, error: { code: 'INVALID_ROW', message: 'Fila fuera de rango' } };
  }

  var col = MONTH_COL_START + (monthIdx * 3) + typeIdx;
  var row = ws.getRow(exceljsRow);
  row.getCell(col + 1).value = value ? 'x' : '';
  row.commit();

		await workbook.xlsx.writeFile(filePath);

		if (backupPath && fs.existsSync(backupPath)) {
			try { fs.unlinkSync(backupPath); } catch (e) {}
		}

		/* 📦509 — Notificar al renderer para que el calendario recargue si está
		   visible (mismo patrón que en inspecciones). */
		try {
		 BrowserWindow.getAllWindows().forEach(function (win) {
		  if (win && win.webContents && !win.isDestroyed()) {
		   win.webContents.send("mantenimiento:programa:actualizado", {
		    rowIndex: rowIndex,
		    month: month,
		    type: type,
		    value: value
		   });
		  }
		 });
		} catch (e) {
		 console.warn("[K+AIRSST][MANTENIMIENTO][BROADCAST_FAIL]", e.message);
		}

		return { success: true, data: { message: 'Celda actualizada', rowIndex: rowIndex, month: month, type: type, value: value } };
	} catch (e) {
		if (backupPath && fs.existsSync(backupPath)) {
			try { fs.copyFileSync(backupPath, filePath); } catch (re) {}
		}
		return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
	}
}

async function _updateField(companyRoot, rowIndex, field, value) {
	var editableKeys = BASE_FIELDS.filter(function(f) { return f.editable; }).map(function(f) { return f.key; });
	editableKeys.push('costo');

	if (editableKeys.indexOf(field) === -1) {
		return { success: false, error: { code: 'INVALID_FIELD', message: 'Campo no editable: ' + field } };
	}

	var pathResult = _getExcelFilePath(companyRoot);
	if (!pathResult.success) return pathResult;

	var filePath = pathResult.data.filePath;

	var backupPath = _createBackup(filePath);

	try {
		var workbook = new ExcelJS.Workbook();
		await workbook.xlsx.readFile(filePath);
		var ws = workbook.getWorksheet(SHEET_NAME) || workbook.worksheets[0];
		if (!ws) return { success: false, error: { code: 'SHEET_NOT_FOUND', message: 'Hoja no encontrada' } };

  var exceljsRow = rowIndex + EXCELJS_ROW_OFFSET;
  if (exceljsRow < DATA_START_ROW + EXCELJS_ROW_OFFSET || exceljsRow > ws.rowCount) {
    return { success: false, error: { code: 'INVALID_ROW', message: 'Fila fuera de rango' } };
  }

  var row = ws.getRow(exceljsRow);

  if (field === 'costo') {
			row.getCell(COSTO_COL + 1).value = value;
		} else {
			var baseField = BASE_FIELDS.find(function(f) { return f.key === field; });
			if (baseField) {
				row.getCell(baseField.col + 1).value = value;
			}
		}

		row.commit();
		await workbook.xlsx.writeFile(filePath);

		if (backupPath && fs.existsSync(backupPath)) {
			try { fs.unlinkSync(backupPath); } catch (e) {}
		}

		/* 📦509 — Notificar al renderer para que el calendario recargue si está
		   visible. _updateField usualmente no afecta eventos del calendario
		   (edita texto de campos, no marca MPP/MPE/MPC), pero lo emitimos igual
		   por consistencia y para futuras integraciones. */
		try {
		 BrowserWindow.getAllWindows().forEach(function (win) {
		  if (win && win.webContents && !win.isDestroyed()) {
		   win.webContents.send("mantenimiento:programa:actualizado", {
		    rowIndex: rowIndex,
		    field: field,
		    value: value
		   });
		  }
		 });
		} catch (e) {
		 console.warn("[K+AIRSST][MANTENIMIENTO][BROADCAST_FAIL]", e.message);
		}

		return { success: true, data: { message: 'Campo actualizado', rowIndex: rowIndex, field: field, value: value } };
	} catch (e) {
		if (backupPath && fs.existsSync(backupPath)) {
			try { fs.copyFileSync(backupPath, filePath); } catch (re) {}
		}
		return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
	}
}

async function _addRow(companyRoot, itemData) {
	var pathResult = _getExcelFilePath(companyRoot);
	if (!pathResult.success) return pathResult;

	var filePath = pathResult.data.filePath;

	var backupPath = _createBackup(filePath);

	try {
		var workbook = new ExcelJS.Workbook();
		await workbook.xlsx.readFile(filePath);
		var ws = workbook.getWorksheet(SHEET_NAME) || workbook.worksheets[0];
		if (!ws) return { success: false, error: { code: 'SHEET_NOT_FOUND', message: 'Hoja no encontrada' } };

		var newExceljsRow = ws.rowCount + 1;
		var row = ws.getRow(newExceljsRow);

		row.getCell(1).value = _safeStr(itemData.item || '');
		row.getCell(2).value = _safeStr(itemData.instalacion || '');
		row.getCell(3).value = _safeStr(itemData.codigo || '');
		row.getCell(4).value = _safeStr(itemData.responsable || '');
		row.getCell(5).value = _safeStr(itemData.diagnostico || '');
		row.getCell(6).value = _safeStr(itemData.actividades || '');
		row.getCell(7).value = _safeStr(itemData.frecuencia || '');

		for (var m = 0; m < 12; m++) {
			for (var t = 0; t < 3; t++) {
				var col = MONTH_COL_START + (m * 3) + t;
				var monthName = MONTHS[m];
				var typeName = MONTH_TYPES[t];
				var isChecked = itemData.months && itemData.months[monthName] && itemData.months[monthName][typeName];
				row.getCell(col + 1).value = isChecked ? 'x' : '';
			}
		}

		row.getCell(COSTO_COL + 1).value = itemData.costo || null;

		row.commit();
		await workbook.xlsx.writeFile(filePath);

		if (backupPath && fs.existsSync(backupPath)) {
			try { fs.unlinkSync(backupPath); } catch (e) {}
		}

  var newRowIndex = newExceljsRow - EXCELJS_ROW_OFFSET;
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

function _getMantenimientoStats(companyRoot) {
	var dir = _getCompanyMantenimientoDir(companyRoot);
	if (!dir || !fs.existsSync(dir)) {
		return { success: true, data: { totalActividades: 0, completadasMes: 0, pendientesMes: 0, tasaCumplimiento: 0, categoriasCount: 0, year: new Date().getFullYear() } };
	}

	var readResult = _readExcel(companyRoot);
	if (!readResult.success || !readResult.data) {
		return { success: true, data: { totalActividades: 0, completadasMes: 0, pendientesMes: 0, tasaCumplimiento: 0, categoriasCount: 0, year: new Date().getFullYear() } };
	}

	var items = readResult.data.items || [];
	var categories = readResult.data.categories || [];
	var year = readResult.data.header && readResult.data.header.year ? readResult.data.header.year : new Date().getFullYear();
	var currentMonth = new Date().getMonth();
	var currentMonthName = MONTHS[currentMonth];

	var totalActividades = items.length;
	var completadasMes = 0;

	for (var i = 0; i < items.length; i++) {
		var item = items[i];
		var monthData = item.months && item.months[currentMonthName];
		if (monthData && (monthData.MPP || monthData.MPE || monthData.MPC)) {
			completadasMes++;
		}
	}

	var pendientesMes = totalActividades - completadasMes;
	var tasaCumplimiento = totalActividades > 0 ? Math.round((completadasMes / totalActividades) * 100) : 0;

	return {
		success: true,
		data: {
			totalActividades: totalActividades,
			completadasMes: completadasMes,
			pendientesMes: pendientesMes,
			tasaCumplimiento: tasaCumplimiento,
			categoriasCount: categories.length,
			year: year
		}
	};
}

/* 📦509 — Devuelve los eventos del calendario para los mantenimientos
   PROGRAMADOS PENDIENTES (MPP) del cronograma anual de la empresa.
   Por cada item (equipo) que tenga MPP marcado en un mes, genera 1 evento
   en uno de los primeros 10 días hábiles de las semanas 2 y 3 del mes
   (round-robin entre actividades del mes). Solo incluye MPP (pendientes),
   NO incluye MPE (ya ejecutado) ni MPC (cancelado/no realizado).
   Params: { start, end, currentCompany } (plano, NO envuelto en range). */
function _getCalendarEvents(companyRoot, params) {
 try {
  var start = params && params.start;
  var end = params && params.end;
  var currentCompany = (params && params.currentCompany) || 'default';
  if (!start || !end) {
   return { success: false, error: { code: 'INVALID_INPUT', message: 'start y end son obligatorios' } };
  }

  var startDate = new Date(start + 'T00:00:00');
  var endDate = new Date(end + 'T23:59:59');
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
   return { success: false, error: { code: 'INVALID_INPUT', message: 'start/end inválidos' } };
  }

  var readResult = _readExcel(companyRoot);
  if (!readResult.success || !readResult.data) {
   return { success: true, data: [] };
  }

  var items = readResult.data.items || [];
  var events = [];

  var cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  var endCursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cursor <= endCursor) {
   var year = cursor.getFullYear();
   var monthIdx = cursor.getMonth();
   var monthName = MONTHS[monthIdx];

   var businessDays = _getWeek2And3BusinessDays(year, monthIdx);
   /* Round-robin: cada item con MPP en el mes cae en UNO de los 10 días
      hábiles de las semanas 2 y 3. Esto refleja el plan anual: 1 evento
      por item por mes, sin apilar 10 copias en el calendario. */
   var itemCount = 0;
   items.forEach(function (item) {
    var monthData = item.months && item.months[monthName];
    if (!monthData || !monthData.MPP) return;
    var dayIdx = itemCount % businessDays.length;
    itemCount++;
    var dateStr = businessDays[dayIdx];
    var itemLabel = item.instalacion || item.codigo || ('Fila ' + item.rowIndex);
    var itemCat = item._category || item.item || 'Mantenimiento';
    events.push({
     id: 'mnt-prog-' + currentCompany + '-' + year + '-' + monthIdx + '-' + item.rowIndex,
     type: 'mantenimiento_programado',
     title: 'MPP ' + itemCat + ' — ' + itemLabel,
     date: dateStr,
     start: '00:00',
     end: '23:59',
     color: '#0d9488',
     source: 'mantenimiento',
     meta: {
      categoria: itemCat,
      instalacion: item.instalacion || '',
      codigo: item.codigo || '',
      responsable: item.responsable || '',
      rowIndex: item.rowIndex,
      mes: monthName,
      dia: dayIdx + 1,
      empresaId: currentCompany,
      year: year,
      tipo: 'MPP'
     }
    });
   });

   cursor.setMonth(cursor.getMonth() + 1);
  }

  return { success: true, data: events };
 } catch (e) {
  console.error('[K+AIRSST][MANTENIMIENTO][CAL_EVENTS][ERROR]', e);
  return { success: false, error: { code: 'GET_EVENTS_FAILED', message: e.message } };
 }
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
			return await _saveExcel(companyRoot, items);
		} catch (e) {
			return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
		}
	});

	ipcMain.handle('mantenimiento:toggle-month', async function(_e, companyName, rowIndex, month, type, value) {
		try {
			var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
			if (!companyRoot) return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
			return await _toggleMonth(companyRoot, rowIndex, month, type, value);
		} catch (e) {
			return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
		}
	});

	ipcMain.handle('mantenimiento:update-field', async function(_e, companyName, rowIndex, field, value) {
		try {
			var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
			if (!companyRoot) return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
			return await _updateField(companyRoot, rowIndex, field, value);
		} catch (e) {
			return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
		}
	});

	ipcMain.handle('mantenimiento:add-row', async function(_e, companyName, itemData) {
		try {
			var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
			if (!companyRoot) return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
			return await _addRow(companyRoot, itemData);
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

	ipcMain.handle('mantenimiento:get-stats', async function(_e, companyName) {
		try {
			var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
			if (!companyRoot) return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
			return _getMantenimientoStats(companyRoot);
		} catch (e) {
			return { success: false, error: { code: 'STATS_ERROR', message: e.message } };
		}
	});

	/* 📦509 — Devuelve los eventos del calendario para los mantenimientos
	   PROGRAMADOS PENDIENTES (MPP). Consumido por el adapter del calendario.

	   📦543 — Soporte para scope='all': si companyName es null, lee de
	   TODAS las empresas del config y concatena los eventos. */
	ipcMain.handle('mantenimiento:calendario:get-events', async function(_e, params) {
		try {
			var companyName = params && params.currentCompany;
			if (companyName) {
				var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
				if (!companyRoot) return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
				return _getCalendarEvents(companyRoot, params);
			}
			// 📦543 — Scope='all' → iterar todas las empresas del config
			var configPath = path.join(_app.getPath('userData'), 'config.json');
			var config;
			try {
				var fs = require('fs');
				var configRaw = fs.readFileSync(configPath, 'utf8');
				config = JSON.parse(configRaw);
			} catch (e) {
				return { success: false, error: { code: 'CONFIG_READ_FAILED', message: e.message } };
			}
			var allCompanies = Object.keys((config && config.companyPaths) || {});
			var allEvents = [];
			for (var i = 0; i < allCompanies.length; i++) {
				var compName = allCompanies[i];
				var compRoot = _getCompanyRootPath ? await _getCompanyRootPath(compName) : null;
				if (!compRoot) continue;
				var res = _getCalendarEvents(compRoot, params);
				if (res && res.success && Array.isArray(res.data)) {
					allEvents.push.apply(allEvents, res.data);
				}
			}
			return { success: true, data: allEvents };
		} catch (e) {
			return { success: false, error: { code: 'GET_EVENTS_FAILED', message: e.message } };
		}
	});
}

module.exports = { registerMantenimientoHandlers };
