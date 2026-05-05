// ============================================================
// K+AIR SG-SST - inspecciones-bridge.js
// Módulo de lectura/escritura Excel para Inspecciones Sistemáticas (4.2.4)
// Ubicación: main/inspecciones-bridge.js
// Usa ExcelJS para .xlsx y xlsx (SheetJS) para leer .xls legacy
// ============================================================

const ExcelJS = require("exceljs");
const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const INSPECTION_TEMPLATES = {
  EXTINTOR: {
    code: "GI-FO-026",
    name: "Inspección de Extintores",
    sheetName: null,
    dataStartRow: 12,
    dataEndRow: 19,
    colMap: { A:"ubicacion", B:"tipo", C:"capacidad", D:"fabricacion", E:"vencimiento", F:"presion", G:"manometro", H:"manguera", I:"seguro", J:"etiqueta", K:"senalizacion", L:"observaciones" },
    colIndexes: { A:1, B:2, C:3, D:4, E:5, F:6, G:7, H:8, I:9, J:10, K:11, L:12 }
  },
  INSTALACION: {
    code: "GI-FO-025",
    name: "Inspección de Instalaciones",
    sheetName: null,
    dataStartRow: 11,
    dataEndRow: 35,
    colMap: { B:"item", C:"cumple", D:"observaciones", E:"responsable" },
    colIndexes: { B:2, C:3, D:4, E:5 }
  },
  EMERGENCIA: {
    code: "GI-FO-023",
    name: "Inspección Equipos de Emergencia",
    sheetName: null,
    dataStartRow: 11,
    dataEndRow: 19,
    colMap: { B:"equipo", C:"ubicacion", D:"estado", E:"ultimaRevision", F:"proximaRevision", G:"observaciones" },
    colIndexes: { B:2, C:3, D:4, E:5, F:6, G:7 }
  }
};

const PROGRAMA_SHEET_CONFIG = {
  startRow: 8,
  endRow: 16,
  startCol: 7,
  endCol: 18
};

function _getCompanyInspeccionesDir(companyRoot) {
  return path.join(companyRoot, "4.2.4");
}

function _findExcelFile(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  var files = fs.readdirSync(dir);
  var match = files.find(function(f) { return f.toUpperCase().indexOf(pattern.toUpperCase()) !== -1; });
  return match ? path.join(dir, match) : null;
}

function _readXlsWithSheetJs(filePath) {
  var workbook = xlsx.readFile(filePath, { type: "file" });
  var sheetName = workbook.SheetNames[0];
  var ws = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });
}

async function _readXlsxWithExcelJS(filePath, sheetName) {
  var workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  var ws = workbook.getWorksheet(sheetName || 1);
  if (!ws) return null;
  return { workbook: workbook, worksheet: ws };
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

  var filePath = _findExcelFile(dir, config.code);
  if (!filePath) {
    filePath = _findExcelFile(dir, type);
  }
  if (!filePath) {
    return { success: false, error: { code: "FILE_NOT_FOUND", message: "No se encontró el archivo Excel para " + config.name + " en " + dir } };
  }

  var ext = path.extname(filePath).toLowerCase();
  var rows = [];

  if (ext === ".xls") {
    var rawData = _readXlsWithSheetJs(filePath);
    for (var r = config.dataStartRow - 1; r < Math.min(config.dataEndRow, rawData.length); r++) {
      var row = rawData[r] || [];
      var item = { row: r + 1 };
      Object.keys(config.colIndexes).forEach(function(col) {
        var field = config.colMap[col];
        var colIdx = config.colIndexes[col] - 1;
        item[field] = row[colIdx] !== undefined ? String(row[colIdx]).trim() : "";
      });
      rows.push(item);
    }
  } else {
    var raw = xlsx.readFile(filePath, { type: "file" });
    var sheetName = raw.SheetNames[0];
    var sheetData = xlsx.utils.sheet_to_json(raw.Sheets[sheetName], { header: 1, defval: "" });
    for (var r2 = config.dataStartRow - 1; r2 < Math.min(config.dataEndRow, sheetData.length); r2++) {
      var rowData = sheetData[r2] || [];
      var item2 = { row: r2 + 1 };
      Object.keys(config.colIndexes).forEach(function(col2) {
        var field2 = config.colMap[col2];
        var colIdx2 = config.colIndexes[col2] - 1;
        item2[field2] = rowData[colIdx2] !== undefined ? String(rowData[colIdx2]).trim() : "";
      });
      rows.push(item2);
    }
  }

  var headerCells = Object.keys(config.colMap).map(function(col) {
    return { col: col, label: config.colMap[col].toUpperCase() };
  });

  return {
    success: true,
    data: {
      code: config.code,
      name: config.name,
      type: type,
      structure: {
        headerRows: [{ cells: headerCells }],
        dataStartRow: config.dataStartRow,
        dataEndRow: config.dataEndRow
      },
      items: rows,
      validationRules: type === "EXTINTOR" ? { presion: ["OK","BAJO","N/A"], estado: ["BUENO","MALO","N/A","REGULAR"] } : {},
      _filePath: filePath
    }
  };
}

async function writeInspeccionExcel(companyRoot, type, formData) {
  var dir = _getCompanyInspeccionesDir(companyRoot);
  var config = INSPECTION_TEMPLATES[type];
  if (!config) return { success: false, error: { code: "UNKNOWN_TYPE", message: "Tipo desconocido: " + type } };

  var originalPath = _findExcelFile(dir, config.code) || _findExcelFile(dir, type);
  if (!originalPath) return { success: false, error: { code: "FILE_NOT_FOUND", message: "Archivo Excel no encontrado para escritura" } };

  var backupDir = path.join(dir, "backup");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  var backupPath = path.join(backupDir, path.basename(originalPath, path.extname(originalPath)) + "_" + Date.now() + path.extname(originalPath));
  fs.copyFileSync(originalPath, backupPath);

  var newFilePath = originalPath;
  var ext = path.extname(originalPath).toLowerCase();

  if (ext === ".xls") {
    newFilePath = originalPath.replace(/\.xls$/i, ".xlsx");
  }

  var workbook = new ExcelJS.Workbook();
  if (ext === ".xls") {
    var rawData = _readXlsWithSheetJs(originalPath);
    var ws = workbook.addWorksheet("Inspección");
    rawData.forEach(function(row, rowIdx) {
      row.forEach(function(cellVal, colIdx) {
        ws.getCell(rowIdx + 1, colIdx + 1).value = cellVal;
      });
    });
  } else {
    await workbook.xlsx.readFile(originalPath);
  }

  var ws2 = workbook.getWorksheet(1);
  if (!ws2) return { success: false, error: { code: "SHEET_NOT_FOUND", message: "Hoja no encontrada" } };

  var items = formData.items || [];
  items.forEach(function(item) {
    var rowNum = item.row || config.dataStartRow;
    Object.keys(config.colIndexes).forEach(function(col) {
      var field = config.colMap[col];
      var colIdx = config.colIndexes[col];
      if (item[field] !== undefined) {
        ws2.getCell(rowNum, colIdx).value = item[field];
      }
    });
  });

  await workbook.xlsx.writeFile(newFilePath);

  return {
    success: true,
    data: {
      filePath: newFilePath,
      backupPath: backupPath,
      saved: true,
      rowCount: items.length
    }
  };
}

function readProgramaInspecciones(companyRoot, year) {
  var dir = _getCompanyInspeccionesDir(companyRoot);
  if (!fs.existsSync(dir)) {
    return { success: false, error: { code: "DIR_NOT_FOUND", message: "Carpeta 4.2.4 no encontrada" } };
  }

  var filePath = _findExcelFile(dir, "PROGRAMA DE INSPECCIONES");
  if (!filePath) {
    filePath = _findExcelFile(dir, "PROGRAMA");
  }
  if (!filePath) {
    return { success: false, error: { code: "FILE_NOT_FOUND", message: "Archivo PROGRAMA DE INSPECCIONES no encontrado" } };
  }

  var rawData = _readXlsWithSheetJs(filePath);
  var activities = [];

  for (var r = PROGRAMA_SHEET_CONFIG.startRow - 1; r < Math.min(PROGRAMA_SHEET_CONFIG.endRow, rawData.length); r++) {
    var row = rawData[r] || [];
    if (!row[0] && !row[1]) continue;

    var actName = row[0] ? String(row[0]).trim() : (row[1] ? String(row[1]).trim() : "");
    if (!actName) continue;

    var months = {};
    for (var m = 0; m < 12; m++) {
      var colIdx = PROGRAMA_SHEET_CONFIG.startCol - 1 + m;
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

    activities.push({
      id: "act-prog-" + (r + 1),
      name: actName,
      type: "INSTALACION",
      frequency: "Según programa",
      months: months
    });
  }

  var totalC = 0, totalP = 0;
  activities.forEach(function(a) {
    Object.values(a.months).forEach(function(v) {
      if (v === "c") totalC++;
      else if (v === "p") totalP++;
    });
  });
  var total = totalC + totalP;

  return {
    success: true,
    data: {
      year: year || new Date().getFullYear(),
      activities: activities,
      kpis: {
        indicator: total > 0 ? Math.round((totalC / total) * 100) : 0,
        completed: totalC,
        pending: totalP,
        total: total
      }
    }
  };
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
      return parseInt(item.vencimiento) >= currentYear;
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

function registerInspeccionesHandlers(app) {
  var ipcMain = require("electron").ipcMain;

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
      var dir = _getCompanyInspeccionesDir(companyRoot);
      var filePath = _findExcelFile(dir, "PROGRAMA DE INSPECCIONES") || _findExcelFile(dir, "PROGRAMA");
      if (filePath) {
        var rawData = _readXlsWithSheetJs(filePath);
        var rowIdx = parseInt(activityId.replace("act-prog-", ""), 10) - 1;
        var colIdx = PROGRAMA_SHEET_CONFIG.startCol - 1 + month;
        if (rawData[rowIdx]) {
          var newValue = status === "c" ? "C" : (status === "p" ? "P" : "");
          rawData[rowIdx][colIdx] = newValue;
          var wb = xlsx.utils.book_new();
          var ws = xlsx.utils.aoa_to_sheet(rawData);
          xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
          var backupDir = path.join(dir, "backup");
          if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
          var backupPath = path.join(backupDir, "PROGRAMA_INSPECCIONES_" + Date.now() + ".xls");
          if (fs.existsSync(filePath)) fs.copyFileSync(filePath, backupPath);
          xlsx.writeFile(wb, filePath);
        }
      }
      return readProgramaInspecciones(companyRoot, new Date().getFullYear());
    } catch (e) {
      console.error("[4.2.4] Error en update-month:", e);
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

  ipcMain.handle("inspecciones:list", async function(event, companyName, filters) {
    try {
      var companyRoot = await getCompanyRootPath(companyName);
      if (!companyRoot) return { success: false, error: { code: "COMPANY_NOT_FOUND", message: "Empresa no encontrada" } };
      var dataDir = path.join(_getCompanyInspeccionesDir(companyRoot), "inspecciones_data.json");
      var items = [];
      if (fs.existsSync(dataDir)) {
        var content = fs.readFileSync(dataDir, "utf8");
        var data = JSON.parse(content);
        items = data.items || data.inspections || [];
      }
      if (filters) {
        if (filters.type) items = items.filter(function(i) { return i.type === filters.type; });
        if (filters.status) items = items.filter(function(i) { return i.status === filters.status; });
        if (filters.search) {
          var s = filters.search.toLowerCase();
          items = items.filter(function(i) {
            return (i.location || "").toLowerCase().indexOf(s) !== -1 ||
              (i.inspector || "").toLowerCase().indexOf(s) !== -1 ||
              (i.observations || "").toLowerCase().indexOf(s) !== -1;
          });
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
      var dir = _getCompanyInspeccionesDir(companyRoot);
      var dataFile = path.join(dir, "inspecciones_data.json");
      var data = { inspections: [] };
      if (fs.existsSync(dataFile)) {
        data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
      }
      var insp = data.inspections.find(function(i) { return i.id === id; });
      if (insp) return { success: true, data: insp };
      return { success: false, error: { code: "INSPECTION_NOT_FOUND", message: "Inspección no encontrada: " + id } };
    } catch (e) {
      console.error("[4.2.4] Error en get:", e);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  });

  ipcMain.handle("inspecciones:create", async function(event, companyName, inspectionData) {
    try {
      var companyRoot = await getCompanyRootPath(companyName);
      if (!companyRoot) return { success: false, error: { code: "COMPANY_NOT_FOUND", message: "Empresa no encontrada" } };
      var dir = _getCompanyInspeccionesDir(companyRoot);
      var dataFile = path.join(dir, "inspecciones_data.json");
      var data = { inspections: [] };
      if (fs.existsSync(dataFile)) {
        data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
      }
      var newInsp = {
        id: "insp-" + Date.now(),
        type: inspectionData.type || "EXTINTOR",
        format: inspectionData.format || "GI-FO-026",
        location: inspectionData.location || "",
        inspector: inspectionData.inspector || "",
        date: inspectionData.date || new Date().toISOString().slice(0, 10),
        status: inspectionData.status || "DRAFT",
        items: inspectionData.items || 0,
        observations: inspectionData.observations || ""
      };
      data.inspections.unshift(newInsp);
      fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), "utf8");
      return { success: true, data: newInsp };
    } catch (e) {
      console.error("[4.2.4] Error en create:", e);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  });

  ipcMain.handle("inspecciones:delete", async function(event, companyName, id) {
    try {
      var companyRoot = await getCompanyRootPath(companyName);
      if (!companyRoot) return { success: false, error: { code: "COMPANY_NOT_FOUND", message: "Empresa no encontrada" } };
      var dir = _getCompanyInspeccionesDir(companyRoot);
      var dataFile = path.join(dir, "inspecciones_data.json");
      var data = { inspections: [] };
      if (fs.existsSync(dataFile)) {
        data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
      }
      data.inspections = data.inspections.filter(function(i) { return i.id !== id; });
      fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), "utf8");
      return { success: true, data: { deleted: true, id: id } };
    } catch (e) {
      console.error("[4.2.4] Error en delete:", e);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  });
}

module.exports = { registerInspeccionesHandlers };
