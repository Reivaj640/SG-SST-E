/* ============================================================
 * K+AIR · Inspecciones — Bridge IPC con file-based JSON store
 *
 * Handlers (9 canales, naming `modulo:accion`):
 *   company:listar                    → store.listCompanies()
 *   programa:obtener                  → store.getProgram(year, companyId)
 *   programa:actualizarActividad      → store.updateActivity(id, patch)
 *   inspeccion:listar                 → store.listInspections(filter)
 *   inspeccion:obtener                → store.getInspection(id)
 *   inspeccion:crear                  → store.createInspection(payload)
 *   inspeccion:actualizar             → store.updateInspection(id, patch)
 *   inspeccion:eliminar               → store.deleteInspection(id)
 *   inspeccion:exportarXlsx           → exporta la inspección a .xlsx usando
 *                                        la plantilla oficial de utils/ como
 *                                        base (preserva bordes, fonts, fills,
 *                                        merges y anchos de columna).
 *                                        Aplica a los 4 tipos: instalaciones,
 *                                        botiquin, extintores, equipos_emergencia.
 *
 * Backward-compat (para widgets del home de gestion-peligros):
 *   inspecciones:get-stats(company)   → wrapper que lee del nuevo store
 *     y retorna {totalInspecciones, completadas, pendientesMes,
 *                tasaCumplimiento, extintoresVigentes, extintoresTotal}
 *
 * Persistencia: <userData>/kair-inspecciones-data.json (índice interno)
 * Plantillas:    <appPath>/utils/GI-FO-*.xlsx
 *
 * Conexión carpeta empresa (2026-09-21, reconexión post-📦500):
 *   - Programa anual: si la empresa tiene carpeta configurada con
 *     "PROGRAMA DE INSPECCIONES.xlsx", se lee/escribe ESE archivo (el real),
 *     con respaldo automático en <carpeta>/backup/ antes de cada escritura.
 *     Si no hay carpeta/Excel, cae a la libreta interna como antes.
 *   - Histórico: nuevo canal inspeccion:explorarHistorico escanea
 *     "Inspeciones realizadas/<Sede>/<DD-MM-AAAA>/" y lista los archivos.
 *   - Archivado: inspeccion:archivar copia el formato exportado de una
 *     inspección a "Inspeciones realizadas/<sede>/<fecha>/".
 *   - Migración: inspecciones_data.json legado de la carpeta se importa
 *     una sola vez a la libreta interna (idempotente por id).
 * ============================================================ */
const { app, ipcMain, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const ExcelJS = require("exceljs");

const DATA_FILE = () =>
  path.join(app.getPath("userData"), "kair-inspecciones-data.json");

/* Las plantillas originales son .xls pero ExcelJS (que sí preserva estilos
   al escribir .xlsx) requiere .xlsx de entrada. La conversión .xls → .xlsx
   se hizo una sola vez con Excel vía pywin32 y queda commiteada en utils/.
   En dev: <repo>/utils/...
   En prod (asar=false): <appPath>/utils/... (incluida en el build por
   la regla files: ["**\/*"] de electron-builder) */
const TEMPLATE_BASE = () => path.join(app.getAppPath(), "utils");

function fmtDate(d) {
  try {
    var date = typeof d === "string" ? new Date(d) : d;
    var dd = String(date.getDate()).padStart(2, "0");
    var mm = String(date.getMonth() + 1).padStart(2, "0");
    var yyyy = date.getFullYear();
    return dd + "/" + mm + "/" + yyyy;
  } catch (e) { return String(d); }
}

/* Normaliza para matching: lowercase + ELIMINA todos los espacios.
   Los items son frases únicas largas, no hay riesgo de falsos positivos;
   esto cubre casos como "( SILLAS" vs "(SILLAS" que la plantilla trae. */
function norm(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, "").trim();
}

/* Helper: extrae el texto plano de una celda que puede ser string, richText
   o null (ExcelJS devuelve distinto según el tipo de celda). Las celdas con
   error de fórmula (ej. #VALUE!) llegan como objeto {error:...} y se tratan
   como vacías — sin esto, una celda de error rompía el parseo del programa. */
function cellText(cell) {
  var v = cell && cell.value;
  if (v == null || v === "") return "";
  if (typeof v === "string") return v;
  if (v && v.error) return "";
  if (v && v.richText) return v.richText.map(function (rt) { return rt.text; }).join("");
  if (v && v.text) return v.text;
  return String(v);
}

function setText(ws, addr, val) {
  ws.getCell(addr).value = val == null ? "" : String(val);
}

let cache = null;

/* Deps inyectadas por main.js ({ getCompanyRootPath }). Se guardan a nivel
   módulo porque la reconexión a la carpeta de la empresa (2026-09-21) las
   usa fuera del registro de handlers. */
let _gDeps = {};

/* Cache en memoria de programas leídos desde el Excel de la empresa.
   Key: filePath + "|" + mtimeMs → evita releer el Excel en cada mes cuando
   el calendario itera mes a mes, pero invalida automáticamente si el archivo
   cambia (mtime distinto). Se invalida también tras cada escritura. */
let _excelProgramCache = {};

function load() {
  if (cache) return cache;
  try {
    if (fs.existsSync(DATA_FILE())) {
      cache = JSON.parse(fs.readFileSync(DATA_FILE(), "utf-8"));
    } else {
      cache = { companies: {}, programs: {}, inspections: [] };
      save();
    }
  } catch (e) {
    console.error("[K+AIRSST][STORE][LOAD][ERROR]", e);
    cache = { companies: {}, programs: {}, inspections: [] };
  }
  return cache;
}

function save() {
  try {
    fs.writeFileSync(DATA_FILE(), JSON.stringify(cache, null, 2), "utf-8");
  } catch (e) {
    console.error("[K+AIRSST][STORE][SAVE][ERROR]", e);
  }
}

function ensureCompany(companyId) {
  var data = load();
  if (!data.companies[companyId]) {
    data.companies[companyId] = {
      id: companyId,
      name: companyId === "default" ? "K+AIR Demo S.A.S." : "Empresa K+AIR",
      createdAt: new Date().toISOString(),
    };
    save();
  } else if (companyId !== "default" &&
             data.companies[companyId].name === "Empresa K+AIR") {
    /* Backfill: empresas reales creadas con el placeholder genérico se
       renombran a su propio id (mejor que el placeholder). El historial
       refrescará los companyName de las inspecciones migradas. */
    data.companies[companyId].name = companyId;
    save();
  }
  return data.companies[companyId];
}

function ok(data) {
  return { success: true, data };
}
function err(code, message) {
  return { success: false, error: { code, message } };
}

/* ---------- Empresas ---------- */
function listCompanies() {
  var data = load();
  ensureCompany("default");
  return ok({ companies: Object.values(data.companies) });
}

/* ---------- Programa ---------- */
var MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function emptySchedule() {
  var s = {};
  MONTHS.forEach(function (m) { s[m] = ""; });
  return s;
}

var GENERAL_OBJECTIVE =
  "Garantizar la identificación, evaluación y control de los riesgos laborales en los lugares de trabajo asignados al personal en misión, promoviendo condiciones seguras y saludables que cumplan con las normativas legales y las políticas de seguridad y salud en el trabajo (SST) establecidas por la empresa.";

var PROGRAM_ACTIVITIES_DEFAULT = [
  { specificObjective: "Identificar condiciones inseguras: Realizar inspecciones periódicas en los lugares de trabajo asignados al personal para detectar posibles riesgos físicos, químicos, ergonómicos, biológicos o psicosociales.", activity: "1. Inspección gerencial", responsible: "Gerencia", inspectionType: "gerencial" },
  { specificObjective: "Identificar condiciones inseguras: Realizar inspecciones periódicas en los lugares de trabajo asignados al personal para detectar posibles riesgos físicos, químicos, ergonómicos, biológicos o psicosociales.", activity: "3. Inspecciones de elementos de protección personal", responsible: "Responsable del SG-SST", inspectionType: "epp" },
  { specificObjective: "Evaluar el cumplimiento normativo: Verificar que las empresas usuarias cumplan con las normativas aplicables de seguridad y salud en el trabajo, incluyendo lo estipulado en el Decreto 1072 de 2015.", activity: "2. Inspecciones de extintores", responsible: "Gerencia", inspectionType: "extintores" },
  { specificObjective: "Evaluar el cumplimiento normativo: Verificar que las empresas usuarias cumplan con las normativas aplicables de seguridad y salud en el trabajo, incluyendo lo estipulado en el Decreto 1072 de 2015.", activity: "3. Inspecciones de botiquines", responsible: "Responsable del SG-SST", inspectionType: "botiquin" },
  { specificObjective: "Proponer mejoras: Generar informes con hallazgos y recomendaciones específicas para la mejora de las condiciones laborales.", activity: "1. Inspección gerencial", responsible: "Gerencia", inspectionType: "gerencial" },
  { specificObjective: "Proponer mejoras: Generar informes con hallazgos y recomendaciones específicas para la mejora de las condiciones laborales.", activity: "2. Inspecciones de instalaciones", responsible: "Responsable del SG-SST", inspectionType: "instalaciones" },
  { specificObjective: "Promover la prevención: Fomentar una cultura de prevención mediante la sensibilización de los trabajadores en misión y de las empresas usuarias sobre la importancia de la seguridad laboral.", activity: "1. Inspección gerencial", responsible: "Gerencia", inspectionType: "gerencial" },
  { specificObjective: "Promover la prevención: Fomentar una cultura de prevención mediante la sensibilización de los trabajadores en misión y de las empresas usuarias sobre la importancia de la seguridad laboral.", activity: "2. Inspecciones equipos de emergencias.", responsible: "Responsable del SG-SST", inspectionType: "equipos_emergencia" },
  { specificObjective: "Promover la prevención: Fomentar una cultura de prevención mediante la sensibilización de los trabajadores en misión y de las empresas usuarias sobre la importancia de la seguridad laboral.", activity: "3. Inspecciones de elementos de protección personal", responsible: "Responsable del SG-SST", inspectionType: "epp" },
];

function getProgram(year, companyId) {
  var data = load();
  ensureCompany(companyId);
  var key = companyId + ":" + year;
  if (!data.programs[key]) {
    data.programs[key] = {
      id: "prog_" + Date.now(),
      year: year,
      companyId: companyId,
      generalObjective: GENERAL_OBJECTIVE,
      activities: PROGRAM_ACTIVITIES_DEFAULT.map(function (a, idx) {
        return {
          id: "act_" + Date.now() + "_" + idx,
          specificObjective: a.specificObjective,
          activity: a.activity,
          responsible: a.responsible,
          inspectionType: a.inspectionType,
          monthlySchedule: emptySchedule(),
          percentage: 0,
          status: "Sin Iniciar",
          observations: a.inspectionType === "gerencial" ? "Gerencia no realizó la inspección." : null
        };
      })
    };
    save();
  }
  return ok({ program: data.programs[key] });
}

function computePct(schedule) {
  var programmed = 0, completed = 0;
  MONTHS.forEach(function (m) {
    var v = schedule[m];
    if (v === "p" || v === "c") programmed++;
    if (v === "c") completed++;
  });
  if (programmed === 0) return 0;
  return Math.round((completed / programmed) * 100) / 100;
}

function deriveStatus(schedule, pct) {
  var hasAny = MONTHS.some(function (m) { return schedule[m] === "p" || schedule[m] === "c"; });
  var hasCompleted = MONTHS.some(function (m) { return schedule[m] === "c"; });
  if (!hasAny) return "Sin Iniciar";
  if (pct >= 1 && hasCompleted) return "Ejecutado";
  return "En Proceso";
}

function updateActivity(activityId, patch) {
  var data = load();
  var updated = null;
  var targetCompanyId = null;
  var targetYear = null;
  Object.keys(data.programs).forEach(function (key) {
    var program = data.programs[key];
    var idx = program.activities.findIndex(function (a) { return a.id === activityId; });
    if (idx >= 0) {
      targetCompanyId = program.companyId;
      targetYear = program.year;
      var schedule = patch.monthlySchedule || program.activities[idx].monthlySchedule;
      var pct = computePct(schedule);
      var status = patch.status || deriveStatus(schedule, pct);
      program.activities[idx] = {
        ...program.activities[idx],
        monthlySchedule: schedule,
        percentage: typeof patch.percentage === "number" ? patch.percentage : pct,
        status: status,
        observations: patch.observations != null ? patch.observations : program.activities[idx].observations
      };
      updated = program.activities[idx];
    }
  });
  if (!updated) return err("NOT_FOUND", "Actividad no encontrada");
  save();
  /* 📦507 — Notificar al renderer para que el calendario recargue si está
     visible. Antes el calendario quedaba con eventos stale hasta que se
     cerraba y volvía a abrir. */
  try {
    BrowserWindow.getAllWindows().forEach(function (win) {
      if (win && win.webContents && !win.isDestroyed()) {
        win.webContents.send("inspeccion:programa:actualizado", {
          activityId: activityId,
          companyId: targetCompanyId,
          year: targetYear
        });
      }
    });
  } catch (e) {
    console.warn("[K+AIRSST][PROGRAM][BROADCAST_FAIL]", e.message);
  }
  return ok({ activity: updated });
}

/* ============================================================
 * Conexión a la carpeta real de la empresa (reconexión 2026-09-21)
 * Patrón de resolución heredado de 📦332/338 (probado en producción mayo
 * 2026): soporta "4. Gestión de Peligros y Riesgos" con/sin tilde, nombres
 * de subcarpeta 4.2.4 variables, y fallback por prefijos.
 * ============================================================ */

async function _getCompanyRoot(companyName) {
  if (!_gDeps || typeof _gDeps.getCompanyRootPath !== "function") return null;
  if (!companyName || companyName === "default") return null;
  try {
    return await _gDeps.getCompanyRootPath(companyName);
  } catch (e) {
    console.warn("[K+AIRSST][4.2.4][ROOT_PATH][WARN]", e.message);
    return null;
  }
}

function _findInspeccionesDirSync(companyRoot) {
  if (!companyRoot || !fs.existsSync(companyRoot)) return null;
  var gestionPeligrosDir = path.join(companyRoot, "4. Gestion de Peligros y Riesgos");
  if (!fs.existsSync(gestionPeligrosDir)) {
    gestionPeligrosDir = path.join(companyRoot, "4. Gestión de Peligros y Riesgos");
  }
  if (fs.existsSync(gestionPeligrosDir)) {
    try {
      var entries = fs.readdirSync(gestionPeligrosDir);
      var inspeccionesFolder = entries.find(function (f) { return f.indexOf("4.2.4") === 0; });
      if (inspeccionesFolder) {
        return path.join(gestionPeligrosDir, inspeccionesFolder);
      }
    } catch (e) { /* ignore readdir errors */ }
  }
  var directPath = path.join(companyRoot, "4.2.4");
  if (fs.existsSync(directPath)) return directPath;
  try {
    var rootEntries = fs.readdirSync(companyRoot);
    var gestionFolder = rootEntries.find(function (f) { return f.indexOf("4.") === 0; });
    if (gestionFolder) {
      var gestionFullPath = path.join(companyRoot, gestionFolder);
      var subEntries = fs.readdirSync(gestionFullPath);
      var inspFolder = subEntries.find(function (f) { return f.indexOf("4.2.4") === 0; });
      if (inspFolder) return path.join(gestionFullPath, inspFolder);
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function _resolveInspeccionesDir(companyName) {
  var root = await _getCompanyRoot(companyName);
  if (!root) return null;
  return _findInspeccionesDirSync(root);
}

/* Busca el Excel del programa anual en la carpeta 4.2.4. Prefiere el nombre
   exacto; acepta variaciones ("PROGRAMA DE INSPECCIONES 2026.xlsx", etc.). */
function _findProgramaExcel(dir) {
  if (!dir || !fs.existsSync(dir)) return null;
  var files;
  try { files = fs.readdirSync(dir); } catch (e) { return null; }
  var exact = files.find(function (f) {
    return /^PROGRAMA DE INSPECCIONES\.xlsx$/i.test(f);
  });
  if (exact) return path.join(dir, exact);
  var loose = files.find(function (f) {
    return /^PROGRAMA\s+DE\s+INSPECCIONES.*\.xlsx$/i.test(f) && f.indexOf("~$") !== 0;
  });
  return loose ? path.join(dir, loose) : null;
}

/* Normaliza el texto de un encabezado de mes: trim + lowercase + sin tilde.
   Acepta "Ene", "Enero", "ENERO", etc. */
var _MONTH_HEADER_ALIASES = (function () {
  var names = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var map = {};
  MONTHS.forEach(function (short, idx) {
    map[short.toLowerCase()] = idx;
    map[names[idx]] = idx;
  });
  return map;
})();

function _normHeader(s) {
  return String(s || "").toLowerCase().replace(/[áàä]/g, "a").replace(/[éèë]/g, "e")
    .replace(/[íìï]/g, "i").replace(/[óòö]/g, "o").replace(/[úùü]/g, "u")
    .replace(/\s+/g, " ").trim();
}

/* Detecta el tipo de inspección a partir del texto de la actividad del
   programa (los textos vienen del Excel real del cliente). */
function _detectTypeFromActivity(text) {
  var t = _normHeader(text);
  if (t.indexOf("extintor") !== -1) return "extintores";
  if (t.indexOf("botiquin") !== -1 || t.indexOf("primeros auxilios") !== -1) return "botiquin";
  if (t.indexOf("equipo") !== -1 && t.indexOf("emergencia") !== -1) return "equipos_emergencia";
  if (t.indexOf("instalacion") !== -1) return "instalaciones";
  if (t.indexOf("proteccion personal") !== -1 || t.indexOf("epp") !== -1) return "epp";
  if (t.indexOf("gerencial") !== -1 || t.indexOf("gerencia") !== -1) return "gerencial";
  return null;
}

/* Lee el programa anual desde el Excel real de la empresa.
   Retorna { program, filePath } o null si no hay carpeta/Excel/no se pudo
   leer. El programa retornado tiene la MISMA forma que el de la libreta
   interna, con ids "excel:<empresa>:<anio>:<fila>" para round-trip de
   escritura, y source:"excel" para que la UI pueda diferenciar. */
async function readProgramFromExcel(companyName, year) {
  var dir = await _resolveInspeccionesDir(companyName);
  if (!dir) return null;
  var filePath = _findProgramaExcel(dir);
  if (!filePath) return null;

  var mtimeMs = 0;
  try { mtimeMs = fs.statSync(filePath).mtimeMs; } catch (e) { /* ok */ }
  var cacheKey = filePath + "|" + mtimeMs;
  if (_excelProgramCache[cacheKey]) {
    return { program: _excelProgramCache[cacheKey], filePath: filePath };
  }

  var wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(filePath);
  } catch (e) {
    console.error("[K+AIRSST][4.2.4][EXCEL_READ][ERROR]", e.message);
    return null;
  }
  var ws = wb.getWorksheet("PROGRAMA") || wb.worksheets[0];
  if (!ws) return null;

  /* 1) Localizar la fila de encabezados buscando la celda "ACTIVIDADES"
     y >= 6 encabezados de mes. Se detecta por texto, no por posición fija,
     porque el Excel real tiene filas históricas desalineadas. */
  var headerRow = 0, colMap = null;
  var maxScan = Math.min(ws.rowCount || 40, 40);
  for (var r = 1; r <= maxScan; r++) {
    var row = ws.getRow(r);
    var map = { months: {} };
    var monthCount = 0;
    row.eachCell({ includeEmpty: false }, function (cell, colNumber) {
      var t = _normHeader(cellText(cell));
      if (!t) return;
      if (t === "actividades") map.actCol = colNumber;
      else if (t === "responsable") map.respCol = colNumber;
      else if (t.indexOf("objetivo general") !== -1) map.objGralCol = colNumber;
      else if (t.indexOf("objetivos especificos") !== -1 || t.indexOf("objetivos específicos") !== -1) map.objEspCol = colNumber;
      else if (t.indexOf("observaciones") !== -1) map.obsCol = colNumber;
      else if (_MONTH_HEADER_ALIASES[t] !== undefined) {
        if (map.months[_MONTH_HEADER_ALIASES[t]] === undefined) {
          map.months[_MONTH_HEADER_ALIASES[t]] = colNumber;
          monthCount++;
        }
      }
    });
    if (map.actCol && monthCount >= 6) { headerRow = r; colMap = map; break; }
  }
  if (!headerRow || !colMap) {
    console.warn("[K+AIRSST][4.2.4][EXCEL_PARSE] No se encontró fila de encabezados con ACTIVIDADES + meses");
    return null;
  }

  function txt(rowNum, col) {
    if (!col) return "";
    return cellText(ws.getRow(rowNum).getCell(col)).trim();
  }

  /* 2) Leer filas de actividades desde el encabezado+1. Se permite huecos
     (celdas combinadas de objetivos) — se interrumpe tras 4 filas vacías
     seguidas sin texto de actividad. Objetivos combinados se heredan de la
     última fila que los trajo. */
  var activities = [];
  var lastObjGral = "", lastObjEsp = "";
  var emptyStreak = 0;
  for (var dr = headerRow + 1; dr <= headerRow + 60; dr++) {
    var actText = txt(dr, colMap.actCol);
    /* La zona de firmas del Excel real ("FIRMA DEL RESPONSABLE...") marca el
       fin de las actividades. */
    if (actText && _normHeader(actText).indexOf("firma") !== -1) break;
    if (!actText) {
      emptyStreak++;
      if (emptyStreak >= 4) break;
      continue;
    }
    emptyStreak = 0;
    var g = txt(dr, colMap.objGralCol);
    if (g) lastObjGral = g;
    var e = txt(dr, colMap.objEspCol);
    if (e && e.indexOf("#VALUE!") !== 0) lastObjEsp = e;

    var schedule = emptySchedule();
    Object.keys(colMap.months).forEach(function (mIdx) {
      var raw = txt(dr, colMap.months[mIdx]).toLowerCase();
      schedule[MONTHS[mIdx]] = raw === "p" || raw === "c" ? raw : "";
    });
    var pct = computePct(schedule);
    activities.push({
      id: "excel:" + companyName + ":" + year + ":" + dr,
      row: dr,
      specificObjective: lastObjEsp,
      activity: actText,
      responsible: txt(dr, colMap.respCol),
      inspectionType: _detectTypeFromActivity(actText),
      monthlySchedule: schedule,
      percentage: pct,
      status: deriveStatus(schedule, pct),
      observations: txt(dr, colMap.obsCol) || null,
      source: "excel"
    });
  }
  if (activities.length === 0) return null;

  var program = {
    id: "prog_excel_" + companyName + "_" + year,
    year: year,
    companyId: companyName,
    generalObjective: lastObjGral || GENERAL_OBJECTIVE,
    activities: activities,
    source: "excel",
    excelPath: filePath
  };
  /* Cachear bajo la mtime actual y limpiar entradas viejas del mismo file */
  Object.keys(_excelProgramCache).forEach(function (k) {
    if (k.indexOf(filePath + "|") === 0 && k !== cacheKey) delete _excelProgramCache[k];
  });
  _excelProgramCache[cacheKey] = program;
  return { program: program, filePath: filePath };
}

/* Escribe los cambios de una actividad (fila del Excel) de vuelta al archivo
   real: respaldo automático en <carpeta>/backup/ antes de escribir (mismo
   patrón que la versión de mayo 📦332). Solo toca las celdas de meses
   (p/c/vacío), responsable y observaciones — nunca las columnas de
   fórmulas (%/ESTADO) para no romper el Excel del cliente. */
async function writeActivityToExcel(companyName, year, rowNum, patch) {
  var dir = await _resolveInspeccionesDir(companyName);
  if (!dir) return err("DIR_NOT_FOUND", "No se encontró la carpeta 4.2.4 de la empresa");
  var filePath = _findProgramaExcel(dir);
  if (!filePath) return err("EXCEL_NOT_FOUND", "No se encontró PROGRAMA DE INSPECCIONES.xlsx en la carpeta");

  var wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(filePath);
  } catch (e) {
    return err("EXCEL_READ_FAILED", "No se pudo leer el Excel: " + e.message);
  }
  var ws = wb.getWorksheet("PROGRAMA") || wb.worksheets[0];
  if (!ws) return err("EXCEL_EMPTY", "El Excel no tiene hojas");

  /* Re-detectar columnas por encabezado (igual que la lectura) */
  var colMap = null;
  var maxScan = Math.min(ws.rowCount || 40, 40);
  for (var r = 1; r <= maxScan; r++) {
    var row = ws.getRow(r);
    var map = { months: {} };
    var monthCount = 0;
    row.eachCell({ includeEmpty: false }, function (cell, colNumber) {
      var t = _normHeader(cellText(cell));
      if (!t) return;
      if (t === "actividades") map.actCol = colNumber;
      else if (t === "responsable") map.respCol = colNumber;
      else if (t.indexOf("observaciones") !== -1) map.obsCol = colNumber;
      else if (_MONTH_HEADER_ALIASES[t] !== undefined) {
        if (map.months[_MONTH_HEADER_ALIASES[t]] === undefined) {
          map.months[_MONTH_HEADER_ALIASES[t]] = colNumber;
          monthCount++;
        }
      }
    });
    if (map.actCol && monthCount >= 6) { colMap = map; break; }
  }
  if (!colMap) return err("EXCEL_PARSE", "No se encontró la fila de encabezados del programa");

  /* Respaldo antes de escribir (patrón 📦332 probado en producción) */
  try {
    var backupDir = path.join(dir, "backup");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    var stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(filePath, path.join(backupDir, path.basename(filePath, ".xlsx") + "_" + stamp + ".bak"));
  } catch (e) {
    console.warn("[K+AIRSST][4.2.4][BACKUP][WARN]", e.message);
  }

  var target = ws.getRow(rowNum);
  if (patch.monthlySchedule) {
    Object.keys(colMap.months).forEach(function (mIdx) {
      var v = patch.monthlySchedule[MONTHS[mIdx]];
      var cell = target.getCell(colMap.months[mIdx]);
      if (v === "p" || v === "c") cell.value = v;
      else if (v === "" || v == null) cell.value = null;
    });
  }
  if (patch.responsible != null && colMap.respCol) {
    target.getCell(colMap.respCol).value = String(patch.responsible);
  }
  if (patch.observations != null && colMap.obsCol) {
    target.getCell(colMap.obsCol).value = String(patch.observations);
  }
  try {
    await wb.xlsx.writeFile(filePath);
  } catch (e) {
    return err("EXCEL_WRITE_FAILED", "No se pudo guardar el Excel (¿está abierto en Excel?): " + e.message);
  }

  /* Invalidar cache y devolver la actividad reconstruida desde el Excel */
  Object.keys(_excelProgramCache).forEach(function (k) {
    if (k.indexOf(filePath + "|") === 0) delete _excelProgramCache[k];
  });
  var reloaded = await readProgramFromExcel(companyName, year);
  if (reloaded) {
    var found = reloaded.program.activities.find(function (a) { return a.row === rowNum; });
    if (found) return ok({ activity: found });
  }
  return ok({ activity: { id: "excel:" + companyName + ":" + year + ":" + rowNum, row: rowNum } });
}

/* Programa "inteligente": Excel real si existe, libreta interna si no.
   Misma forma de respuesta que getProgram() para no romper consumidores. */
async function getProgramSmart(year, companyId) {
  try {
    var fromExcel = await readProgramFromExcel(companyId, year);
    if (fromExcel && fromExcel.program) {
      return ok({ program: fromExcel.program });
    }
  } catch (e) {
    console.error("[K+AIRSST][4.2.4][PROGRAM][EXCEL_FALLBACK]", e.message);
  }
  return getProgram(year, companyId);
}

/* ============================================================
 * Migración legado (📦332): el archivo inspecciones_data.json que la
 * versión de mayo dejó en la carpeta de la empresa se importa UNA SOLA
 * VEZ a la libreta interna. Idempotente por id de registro.
 * ============================================================ */
var _legacyImportAttempts = {};
async function importLegacyFolderInspections(companyName) {
  if (!companyName || companyName === "default") return false;
  if (_legacyImportAttempts[companyName]) return false;
  _legacyImportAttempts[companyName] = true;
  try {
    var dir = await _resolveInspeccionesDir(companyName);
    if (!dir) return false;
    var legacyFile = path.join(dir, "inspecciones_data.json");
    if (!fs.existsSync(legacyFile)) return false;
    var data = load();
    data.meta = data.meta || {};
    if (data.meta.legacyFolderImportedFor === companyName) return false;
    var legacy = JSON.parse(fs.readFileSync(legacyFile, "utf-8"));
    var list = (legacy && Array.isArray(legacy.inspections)) ? legacy.inspections : [];
    var added = 0;
    list.forEach(function (rec) {
      if (!rec || !rec.id) return;
      var exists = data.inspections.some(function (i) { return i.id === rec.id; }) ||
        data.inspections.some(function (i) { return i.legacyId === rec.id; });
      if (exists) return;
      var type = String(rec.type || "").toLowerCase();
      if (type === "extintor") type = "extintores";
      var meta = INSPECTION_META[type] || { code: rec.format || "", title: "Inspección (histórico)" };
      data.inspections.push({
        id: "insp_legacy_" + rec.id,
        legacyId: rec.id,
        type: INSPECTION_META[type] ? type : "instalaciones",
        code: meta.code,
        title: meta.title,
        date: rec.date || null,
        performedBy: rec.inspector || "—",
        role: null,
        site: rec.location || null,
        companyId: companyName,
        companyName: companyName,
        status: rec.status === "COMPLETED" ? "Completada" : (rec.status || "Histórico"),
        observations: rec.observations || "Registro importado desde el archivo histórico de la carpeta de la empresa.",
        data: {},
        sourceFolder: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      added++;
    });
    data.meta.legacyFolderImportedFor = companyName;
    if (added > 0) {
      save();
      console.log("[K+AIRSST][4.2.4][LEGACY_IMPORT] " + added + " registro(s) importados desde carpeta de " + companyName);
    } else {
      save(); /* guarda el flag meta igual para no releer en cada listado */
    }
    return added > 0;
  } catch (e) {
    console.warn("[K+AIRSST][4.2.4][LEGACY_IMPORT][WARN]", e.message);
    return false;
  }
}

/* ============================================================
 * Exploración del histórico real: escanea "Inspeciones realizadas/
 * <Sede>/<DD-MM-AAAA>/" de la carpeta de la empresa y devuelve entradas
 * con sus archivos (fotos, formatos, informes). Solo lectura.
 * ============================================================ */
var PHOTO_EXT = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
var DOC_EXT = [".xlsx", ".xls", ".pdf", ".docx", ".doc"];

async function explorarHistoricoCarpeta(companyName) {
  var dir = await _resolveInspeccionesDir(companyName);
  if (!dir) {
    return ok({ found: false, folderPath: null, entries: [] });
  }
  var entries = [];
  var base = dir;
  var historicoDir = path.join(dir, "Inspeciones realizadas");
  var altDir = path.join(dir, "Inspecciones realizadas");
  if (fs.existsSync(altDir)) historicoDir = altDir;

  function scanFiles(folder) {
    try {
      return fs.readdirSync(folder)
        .filter(function (f) { return f.indexOf("~$") !== 0; })
        .map(function (f) {
          var ext = path.extname(f).toLowerCase();
          return { name: f, ext: ext, isPhoto: PHOTO_EXT.indexOf(ext) !== -1 };
        });
    } catch (e) { return []; }
  }

  if (fs.existsSync(historicoDir)) {
    /* Archivos sueltos directamente en "Inspeciones realizadas" (ej. el
       Informe General.xlsx) */
    scanFiles(historicoDir).forEach(function (f) {
      entries.push({
        kind: "archivo",
        sede: "Informe general",
        fecha: null,
        files: [f],
        photoCount: 0,
        path: historicoDir
      });
    });
    /* Sedes → fechas */
    var sedes = fs.readdirSync(historicoDir).filter(function (f) {
      try { return fs.statSync(path.join(historicoDir, f)).isDirectory(); }
      catch (e) { return false; }
    });
    sedes.forEach(function (sede) {
      var sedePath = path.join(historicoDir, sede);
      var fechas = fs.readdirSync(sedePath).filter(function (f) {
        try { return fs.statSync(path.join(sedePath, f)).isDirectory(); }
        catch (e) { return false; }
      });
      fechas.forEach(function (fechaDir) {
        var fechaPath = path.join(sedePath, fechaDir);
        var files = scanFiles(fechaPath);
        if (files.length === 0) return;
        var m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(fechaDir);
        var fechaIso = m ? (m[3] + "-" + m[2] + "-" + m[1]) : null;
        entries.push({
          kind: "visita",
          sede: sede,
          fecha: fechaIso,
          fechaLabel: fechaDir,
          files: files,
          photoCount: files.filter(function (f) { return f.isPhoto; }).length,
          path: fechaPath
        });
      });
    });
  }

  /* Formatos rellenados sueltos en la raíz de 4.2.4 (ej. "GI-FO-026 1-2026.xlsx") */
  try {
    fs.readdirSync(base).forEach(function (f) {
      if (/^~\$/.test(f)) return;
      var ext = path.extname(f).toLowerCase();
      if (DOC_EXT.indexOf(ext) === -1) return;
      if (!/GI-FO|GI-OD|INFORME|INSPECCI/i.test(f)) return;
      if (/PROGRAMA DE INSPECCIONES/i.test(f)) return;
      var m = /(\d{1,2})-(\d{4})/.exec(f);
      var fechaIso = m ? (m[2] + "-" + String(m[1]).padStart(2, "0") + "-01") : null;
      entries.push({
        kind: "archivo",
        sede: "Formato rellenado",
        fecha: fechaIso,
        files: [{ name: f, ext: ext, isPhoto: false }],
        photoCount: 0,
        path: base
      });
    });
  } catch (e) { /* ignore */ }

  entries.sort(function (a, b) {
    var da = a.fecha ? new Date(a.fecha).getTime() : 0;
    var db = b.fecha ? new Date(b.fecha).getTime() : 0;
    return db - da;
  });
  return ok({ found: true, folderPath: dir, entries: entries });
}

/* ============================================================
 * Archivado en la carpeta de la empresa (Fase D): genera el formato
 * exportado de la inspección y lo guarda en "Inspeciones realizadas/
 * <sede|General>/<DD-MM-AAAA>/", creando carpetas si no existen.
 * La libreta interna sigue siendo el índice; la carpeta es el archivo oficial.
 * ============================================================ */
async function archivarInspeccionEnCarpeta(payload) {
  var id = payload && payload.id;
  var companyName = payload && (payload.companyName || payload.companyId);
  if (!id) return err("INVALID_INPUT", "id es obligatorio");
  var found = getInspection(id);
  if (!found.success) return found;
  var insp = found.data.inspection;
  if (!TEMPLATES[insp.type]) {
    return err("NO_TEMPLATE", "Este tipo de inspección no tiene formato para archivar");
  }
  var dir = await _resolveInspeccionesDir(companyName || insp.companyName);
  if (!dir) {
    return err("DIR_NOT_FOUND", "La empresa no tiene carpeta configurada o no se encontró la carpeta 4.2.4");
  }
  var exported = await exportXlsxFromTemplate(insp);
  if (!exported.success) return exported;

  var buffer = Buffer.from(exported.data.xlsxBase64, "base64");
  var d = insp.date ? new Date(insp.date) : new Date();
  if (isNaN(d.getTime())) d = new Date();
  var dd = String(d.getDate()).padStart(2, "0");
  var mm = String(d.getMonth() + 1).padStart(2, "0");
  var yyyy = d.getFullYear();
  var safe = function (s) {
    return String(s || "").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 60) || "General";
  };
  var historicoDir = path.join(dir, "Inspeciones realizadas");
  if (!fs.existsSync(historicoDir) && fs.existsSync(path.join(dir, "Inspecciones realizadas"))) {
    historicoDir = path.join(dir, "Inspecciones realizadas");
  }
  var targetDir = path.join(historicoDir, safe(insp.site), dd + "-" + mm + "-" + yyyy);
  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch (e) {
    return err("MKDIR_FAILED", "No se pudo crear la carpeta destino: " + e.message);
  }
  var fileName = (insp.code || "INSPECCION") + " " + safe(insp.site) + " " + dd + "-" + mm + "-" + yyyy + ".xlsx";
  var targetPath = path.join(targetDir, fileName);
  try {
    fs.writeFileSync(targetPath, buffer);
  } catch (e) {
    return err("WRITE_FAILED", "No se pudo guardar el archivo: " + e.message);
  }
  console.log("[K+AIRSST][4.2.4][ARCHIVAR][OK] " + targetPath);
  return ok({ path: targetPath, archived: true });
}

/* ---------- Inspecciones ---------- */
var INSPECTION_META = {
  botiquin: { code: "GI-FO-031", title: "Inspección de Botiquín de Primeros Auxilios" },
  extintores: { code: "GI-FO-026", title: "Inspección de Extintores" },
  instalaciones: { code: "GI-FO-025", title: "Inspección de Instalaciones" },
  equipos_emergencia: { code: "GI-FO-023", title: "Inspección de Equipos de Emergencia" }
};

/* Labels humanos para los tipos de inspección que aparecen en el programa
   anual (incluye gerencial y epp que NO son tipos del bridge de inspecciones
   individuales — son actividades que se planifican en el programa pero no
   generan un registro de inspección). Usado por el endpoint que alimenta
   el calendario. */
var INSPECTION_TYPE_LABELS = {
  gerencial:          "Inspección Gerencial",
  epp:                "Inspección de EPP",
  equipos_emergencia: "Equipos de Emergencia",
  extintores:         "Extintores",
  botiquin:           "Botiquín",
  instalaciones:      "Instalaciones"
};

/* Devuelve los primeros 5 días hábiles (lun-vie) de un mes.
   monthIdx es 0-based (0=Enero, 11=Diciembre). Retorna array de strings
   'YYYY-MM-DD' en zona horaria local (NO UTC). */
function getFirst5BusinessDays(year, monthIdx) {
  var dates = [];
  var day = 1;
  while (dates.length < 5) {
    var date = new Date(year, monthIdx, day);
    var dow = date.getDay(); // 0=Dom, 6=Sáb
    if (dow !== 0 && dow !== 6) {
      var yyyy = date.getFullYear();
      var mm = String(date.getMonth() + 1).padStart(2, "0");
      var dd = String(date.getDate()).padStart(2, "0");
      dates.push(yyyy + "-" + mm + "-" + dd);
    }
    day++;
  }
  return dates;
}

/* ---------- Registry de plantillas para export XLSX ----------
   Cada entrada define cómo llenar la plantilla oficial de un tipo de
   inspección. La función genérica `exportXlsxFromTemplate` carga la
   plantilla, aplica las funciones de mapping y devuelve el buffer.
   Esto preserva borders, fonts, fills, merges y anchos de columna
   (ExcelJS lee/escribe .xlsx preservando estilos; las plantillas
   originales .xls se convierten una sola vez a .xlsx con Excel+pywin32).

   `mapHeader(ws, insp)`     — llena celdas de cabecera (fecha, lugar, etc.)
   `mapItems(ws, data)`      — llena filas de items del cuerpo
   `mapFooter(ws, insp, data)` — opcional, llena celdas del pie
   `extra(ws, insp, data)`   — opcional, pasos extra (ej. participantes) */
var TEMPLATES = {

  /* GI-FO-025: Instalaciones ----------------------------------------------
     Cabecera: A7 = fecha, F7 = lugar
     Items: 20 filas en col A (con categorias en 12, 16, 19, 22, 29) —
     col C/D/E = X segun respuesta, F/G/H/I = textos
     Pie: A38/39/40 = inspector/cargo/firma */
  instalaciones: {
    templateFile: "GI-FO-025 INSPECCION DE INSTALACIONES.xlsx",
    itemRows: [13, 14, 15, 17, 18, 20, 21, 23, 24, 25, 26, 27, 28, 30, 31, 32, 33, 34, 35, 36],
    labelCol: "A",
    mapHeader: function (ws, insp) {
      setText(ws, "A7", "FECHA: " + fmtDate(insp.date));
      setText(ws, "F7", "LUGAR: " + (insp.site || ""));
    },
    mapItems: function (ws, data) {
      var items = Array.isArray(data.items) ? data.items : [];
      var byNorm = {};
      items.forEach(function (it) { if (it && it.item) byNorm[norm(it.item)] = it; });
      TEMPLATES.instalaciones.itemRows.forEach(function (r) {
        var label = cellText(ws.getCell(TEMPLATES.instalaciones.labelCol + r));
        if (!label) return;
        var it = byNorm[norm(label)];
        if (!it) return;
        setText(ws, "C" + r, it.respuesta === "SI"  ? "X" : "");
        setText(ws, "D" + r, it.respuesta === "NO"  ? "X" : "");
        setText(ws, "E" + r, it.respuesta === "N/A" ? "X" : "");
        setText(ws, "F" + r, it.observaciones || "");
        setText(ws, "G" + r, it.compromisos   || "");
        setText(ws, "H" + r, it.responsable   || "");
        setText(ws, "I" + r, it.seguimiento   || "");
      });
    },
    mapFooter: function (ws, insp, data) {
      var inspPor = data.inspeccionadoPor || insp.performedBy || "";
      setText(ws, "A38", "INSPECCIONADO POR: " + inspPor);
      setText(ws, "A39", "CARGO: " + (data.cargo || insp.role || ""));
      setText(ws, "A40", "FIRMA: " + (data.firma || inspPor));
    }
  },

  /* GI-FO-031: Botiquin ---------------------------------------------------
     Cabecera: A6 = fecha, E6 = realizado por
     Items: 16 elementos en filas 9-24 (label en B/C/D por merge),
     col E = cantidad, F = fecha vencimiento, G = estado
     Filas 25-31 son slots extra vacíos; filas 32-33 son checks
     (botiquin en buen estado / higiene adecuada) */
  botiquin: {
    templateFile: "GI-FO-031 INSPECCION DE BOTIQUIN DE PRIMEROS AUXILIOS.xlsx",
    itemRows: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
    labelCol: "B",
    mapHeader: function (ws, insp) {
      setText(ws, "A6", "FECHA: " + fmtDate(insp.date));
      setText(ws, "E6", "REALIZADO POR: " + (insp.performedBy || ""));
    },
    mapItems: function (ws, data) {
      var items = Array.isArray(data.items) ? data.items : [];
      var byNorm = {};
      items.forEach(function (it) {
        /* El form del botiquin usa el campo `item` para el nombre del
           elemento (igual que la columna B de la plantilla). */
        if (it && it.item) byNorm[norm(it.item)] = it;
      });
      TEMPLATES.botiquin.itemRows.forEach(function (r) {
        var label = cellText(ws.getCell(TEMPLATES.botiquin.labelCol + r));
        if (!label) return;
        var it = byNorm[norm(label)];
        if (!it) return;
        setText(ws, "E" + r, it.cantidad         != null ? String(it.cantidad) : "");
        setText(ws, "F" + r, it.fechaVencimiento || "");
        setText(ws, "G" + r, it.estado           || "");
      });
    },
    /* Checks: si el JSON trae `data.checks`, los matcheamos contra las
       filas 32 ("Botiquin en buen estado") y 33 ("Higiene adecuada del
       botiquin") y marcamos con X (o el valor) en col E. */
    extra: function (ws, insp, data) {
      var checks = Array.isArray(data.checks) ? data.checks : [];
      if (checks.length === 0) return;
      var byNorm = {};
      checks.forEach(function (c) { if (c && c.label) byNorm[norm(c.label)] = c; });
      [32, 33].forEach(function (r) {
        var label = cellText(ws.getCell(TEMPLATES.botiquin.labelCol + r));
        if (!label) return;
        var c = byNorm[norm(label)];
        if (!c) return;
        setText(ws, "E" + r, c.value === true ? "X" : (c.value || ""));
      });
    }
  },

  /* GI-FO-026: Extintores -------------------------------------------------
     Cabecera: A7 = fecha, A8 = realizado por, F8 = cargo
     Items: 9 filas (12-20) con mapeo directo por columna:
       A=ubicacion, B=#, C=tipo, D=capacidad, E=fechaRecarga,
       F=fechaVencimiento, G=presion, H=estadoCilindro, I=pasador,
       J=anillo, K=base, L=observaciones
     Fila 21 = OBSERVACIONES (texto libre)
     Filas siguientes = firmas (no las tocamos, el usuario firma manual) */
  extintores: {
    templateFile: "GI-FO-026 INSPECCION DE EXTINTORES.xlsx",
    mapHeader: function (ws, insp) {
      setText(ws, "A7", "Fecha de Realizacion de inspeccion: " + fmtDate(insp.date));
      setText(ws, "A8", "Realizada por: " + (insp.performedBy || ""));
      setText(ws, "F8", "Cargo: " + (insp.role || ""));
    },
    mapItems: function (ws, data) {
      var rows = Array.isArray(data.rows) ? data.rows : [];
      var startRow = 12;
      var cols = ["ubicacion", "numero", "tipo", "capacidad", "fechaRecarga",
                  "fechaVencimiento", "presion", "estadoCilindro", "pasador",
                  "anillo", "base", "observaciones"];
      rows.forEach(function (row, idx) {
        if (idx >= 9) return; /* la plantilla tiene 9 slots (12-20) */
        var r = startRow + idx;
        cols.forEach(function (field, ci) {
          setText(ws, String.fromCharCode(65 + ci) + r, row[field] || "");
        });
      });
    },
    extra: function (ws, insp, data) {
      var obs = data.observaciones || insp.observations || "";
      if (obs) setText(ws, "A22", obs);
    }
  },

  /* GI-FO-023: Equipos de Emergencia --------------------------------------
     Cabecera: A6 = fecha, A7 = sitio de inspeccion
     Items: 9 filas (12-20) con label en A — col B/C/D = X segun estado
     (BUENO/MALO/N/A), E=recomendaciones, F=responsables, G=seguimiento
     Fila 25+ = participantes (no implementado por ahora; se llena abajo) */
  equipos_emergencia: {
    templateFile: "GI-FO-023 INSPECCION DE EQUIPOS DE EMERGENCIA.xlsx",
    itemRows: [12, 13, 14, 15, 16, 17, 18, 19, 20],
    labelCol: "A",
    mapHeader: function (ws, insp) {
      setText(ws, "A6", "FECHA: " + fmtDate(insp.date));
      setText(ws, "A7", "SITIO DE INSPECCION: " + (insp.site || ""));
    },
    mapItems: function (ws, data) {
      var items = Array.isArray(data.items) ? data.items : [];
      var byNorm = {};
      items.forEach(function (it) { if (it && it.item) byNorm[norm(it.item)] = it; });
      TEMPLATES.equipos_emergencia.itemRows.forEach(function (r) {
        var label = cellText(ws.getCell(TEMPLATES.equipos_emergencia.labelCol + r));
        if (!label) return;
        var it = byNorm[norm(label)];
        if (!it) return;
        setText(ws, "B" + r, it.estado === "BUENO" ? "X" : "");
        setText(ws, "C" + r, it.estado === "MALO"  ? "X" : "");
        setText(ws, "D" + r, it.estado === "N/A"  ? "X" : "");
        setText(ws, "E" + r, it.recomendaciones || "");
        setText(ws, "F" + r, it.responsables    || "");
        setText(ws, "G" + r, it.seguimiento     || "");
      });
    },
    /* Participantes: si el JSON trae `data.participantes`, los colocamos
       a partir de la fila 25 (después del header de PARTICIPANTES). */
    extra: function (ws, insp, data) {
      var parts = Array.isArray(data.participantes) ? data.participantes : [];
      if (parts.length === 0) return;
      var startRow = 26; /* debajo del header "NOMBRE COMPLETO ... | CARGO" */
      parts.forEach(function (p, idx) {
        var r = startRow + idx;
        if (r > 40) return; /* safety: no overflow */
        setText(ws, "A" + r, p.nombre || "");
        setText(ws, "D" + r, p.cargo   || "");
      });
    }
  }
};

/* Funcion generica: carga la plantilla del tipo, aplica los mappers y
   devuelve el .xlsx en base64. */
async function exportXlsxFromTemplate(insp) {
  var tpl = TEMPLATES[insp && insp.type];
  if (!tpl) {
    return err("NO_TEMPLATE",
      "No hay plantilla registrada para type=" + (insp && insp.type));
  }

  var templatePath = path.join(TEMPLATE_BASE(), tpl.templateFile);
  if (!fs.existsSync(templatePath)) {
    return err("TEMPLATE_NOT_FOUND",
      "Plantilla no encontrada en runtime: " + templatePath);
  }

  var wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(templatePath);
  } catch (e) {
    return err("TEMPLATE_READ_FAILED",
      "No se pudo leer la plantilla .xlsx: " + e.message);
  }
  var ws = wb.worksheets[0];
  if (!ws) return err("TEMPLATE_EMPTY", "La plantilla no tiene hojas");
  var data = (insp && insp.data) || {};

  if (tpl.mapHeader) tpl.mapHeader(ws, insp);
  if (tpl.mapItems)  tpl.mapItems(ws, data);
  if (tpl.mapFooter) tpl.mapFooter(ws, insp, data);
  if (tpl.extra)     tpl.extra(ws, insp, data);

  var buf;
  try {
    buf = await wb.xlsx.writeBuffer();
  } catch (e) {
    return err("XLSX_WRITE_FAILED", "No se pudo generar el .xlsx: " + e.message);
  }

  var nodeBuf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return ok({ xlsxBase64: nodeBuf.toString("base64") });
}

/* Migra inspecciones heredadas que quedaron con companyId="default" pero
   fueron creadas para otra empresa. Reasigna companyId + companyName a la
   empresa del filtro. */
function migrateLegacyDefaultInspections(targetCompanyId, targetCompanyName) {
  if (!targetCompanyId || targetCompanyId === "default") return false;
  var data = load();

  /* Si el caller no mandó companyName, lo tomamos del registro de empresa
     persistido. Si tampoco existe, usamos el companyId como fallback. */
  var resolvedName = targetCompanyName;
  if (!resolvedName && data.companies[targetCompanyId]) {
    resolvedName = data.companies[targetCompanyId].name;
  }
  if (!resolvedName) resolvedName = targetCompanyId;

  var changed = false;
  data.inspections.forEach(function (i) {
    if (i.companyId === "default") {
      i.companyId = targetCompanyId;
      i.companyName = resolvedName;
      changed = true;
    } else if (i.companyId === targetCompanyId && resolvedName &&
               (!i.companyName || i.companyName === "K+AIR Demo S.A.S." || i.companyName === "Empresa K+AIR")) {
      /* Si la inspección ya está bien asignada por companyId pero el
         companyName quedó con un placeholder heredado ("K+AIR Demo S.A.S.",
         "Empresa K+AIR", vacío, etc.), lo normalizamos al nombre real de la
         empresa para que la columna Empresa muestre el nombre correcto. */
      i.companyName = resolvedName;
      changed = true;
    }
  });
  if (changed) {
    save();
    console.log("[K+AIRSST][INSPECTION][MIGRATE] default -> " + targetCompanyId + " (name=" + resolvedName + ")");
  }
  return changed;
}

function listInspections(filter) {
  var data = load();

  /* Si el filtro pide una empresa específica que NO es "default" y existen
     inspecciones heredadas bajo "default" o con companyName de demo,
     migrarlas a esa empresa. */
  if (filter && filter.companyId && filter.companyId !== "default") {
    migrateLegacyDefaultInspections(filter.companyId, filter.companyName);
    data = load();
  }

  var list = data.inspections.slice();
  if (filter && filter.type && filter.type !== "all") {
    list = list.filter(function (i) { return i.type === filter.type; });
  }
  if (filter && filter.companyId) {
    list = list.filter(function (i) { return i.companyId === filter.companyId; });
  }
  list.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  return ok({ inspections: list });
}

function getInspection(id) {
  var data = load();
  var found = data.inspections.find(function (i) { return i.id === id; });
  if (!found) return err("NOT_FOUND", "Inspección no encontrada");
  return ok({ inspection: found });
}

function createInspection(payload) {
  var data = load();
  if (!INSPECTION_META[payload.type]) return err("INVALID_TYPE", "Tipo de inspección inválido");
  if (!payload.date || !payload.performedBy) return err("MISSING_FIELDS", "Fecha y responsable son obligatorios");
  var company = ensureCompany(payload.companyId || "default");
  var meta = INSPECTION_META[payload.type];
  var newInsp = {
    id: "insp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    type: payload.type,
    code: meta.code,
    title: meta.title,
    date: payload.date,
    performedBy: payload.performedBy,
    role: payload.role || null,
    site: payload.site || null,
    companyId: payload.companyId || company.id,
    companyName: payload.companyName || company.name,
    status: payload.status || "Completada",
    observations: payload.observations || null,
    data: payload.data || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.inspections.push(newInsp);
  save();
  console.log("[K+AIRSST][INSPECTION][CREATE][SUCCESS] id=" + newInsp.id + " type=" + payload.type);
  return ok({ inspection: newInsp });
}

function updateInspection(id, patch) {
  var data = load();
  var idx = data.inspections.findIndex(function (i) { return i.id === id; });
  if (idx < 0) return err("NOT_FOUND", "Inspección no encontrada");
  data.inspections[idx] = {
    ...data.inspections[idx],
    date: patch.date || data.inspections[idx].date,
    performedBy: patch.performedBy || data.inspections[idx].performedBy,
    role: patch.role != null ? patch.role : data.inspections[idx].role,
    site: patch.site != null ? patch.site : data.inspections[idx].site,
    observations: patch.observations != null ? patch.observations : data.inspections[idx].observations,
    data: patch.data || data.inspections[idx].data,
    status: patch.status || data.inspections[idx].status,
    updatedAt: new Date().toISOString()
  };
  save();
  console.log("[K+AIRSST][INSPECTION][UPDATE][SUCCESS] id=" + id);
  return ok({ inspection: data.inspections[idx] });
}

function deleteInspection(id) {
  var data = load();
  var next = data.inspections.filter(function (i) { return i.id !== id; });
  if (next.length === data.inspections.length) return err("NOT_FOUND", "Inspección no encontrada");
  data.inspections = next;
  save();
  console.log("[K+AIRSST][INSPECTION][DELETE][SUCCESS] id=" + id);
  return ok({ id: id });
}

/* ---------- Backward-compat para widgets del home ---------- */
/* El home de gestion-peligros llama electronAPI.inspecciones.getStats(company)
   y espera {totalInspecciones, completadas, pendientesMes, tasaCumplimiento,
              extintoresVigentes, extintoresTotal, year, mes,
              mensualCompletadas, mensualPendientes}. Leemos del nuevo store.
   2026-09-21 — async: el resumen del programa anual ahora puede venir del
   Excel real de la carpeta de la empresa (getProgramSmart). */
async function getInspeccionesStats(companyName) {
  try {
    var data = load();
    var companyId = companyName || "default";

    /* Migrar legacy "default" -> empresa destino antes de filtrar (idempotente) */
    if (companyId !== "default") {
      migrateLegacyDefaultInspections(companyId, null);
      data = load();
    }

    var company = data.companies[companyId];
    if (!company) {
      return ok({
        totalInspecciones: 0,
        completadas: 0,
        pendientesMes: 0,
        tasaCumplimiento: 0,
        extintoresVigentes: 0,
        extintoresTotal: 0,
        year: new Date().getFullYear(),
        mes: new Date().toLocaleDateString("es-CO", { month: "long" }),
        mensualCompletadas: Array(12).fill(0),
        mensualPendientes: Array(12).fill(0),
        programaTotal: 0,
        programaCompletadas: 0,
        programaPendientes: 0
      });
    }
    var insps = data.inspections.filter(function (i) { return i.companyId === companyId; });
    var completadas = insps.filter(function (i) { return i.status === "Completada"; }).length;
    var now = new Date();
    var mesActual = now.getMonth();
    var anioActual = now.getFullYear();
    var pendientesMes = 0;
    /* Desglose mensual: cuenta por mes del año actual, basado en i.date.
       "Completadas" = status === "Completada"; "Pendientes" = todo lo demás. */
    var mensualCompletadas = Array(12).fill(0);
    var mensualPendientes = Array(12).fill(0);
    insps.forEach(function (i) {
      if (!i.date) return;
      var d = new Date(i.date);
      if (isNaN(d.getTime())) return;
      if (d.getFullYear() === anioActual) {
        var m = d.getMonth();
        if (i.status === "Completada") {
          mensualCompletadas[m] = (mensualCompletadas[m] || 0) + 1;
        } else {
          mensualPendientes[m] = (mensualPendientes[m] || 0) + 1;
        }
      }
      if (d.getMonth() === mesActual && d.getFullYear() === anioActual && i.status !== "Completada") {
        pendientesMes++;
      }
    });
    var tasaCumplimiento = insps.length === 0 ? 0 : Math.round((completadas / insps.length) * 1000) / 10;
    var extintores = insps.filter(function (i) { return i.type === "extintores"; });
    var extintoresVigentes = extintores.filter(function (i) {
      if (!i.data || !i.data.rows) return false;
      return i.data.rows.some(function (r) {
        if (!r.fechaVencimiento) return false;
        return new Date(r.fechaVencimiento) > now;
      });
    }).length;

    /* Programa anual de la empresa (mismo año actual) — Excel real si la
       empresa tiene carpeta configurada; libreta interna si no. */
    var programSummary = { programaTotal: 0, programaCompletadas: 0, programaPendientes: 0 };
    try {
      var progRes = await getProgramSmart(anioActual, companyId);
      if (progRes && progRes.success && progRes.data && progRes.data.program) {
        programSummary = summarizeProgram(progRes.data.program);
      }
    } catch (eProg) {
      console.warn("[K+AIRSST][STATS][PROGRAM][WARN]", eProg.message);
    }

    return ok({
      totalInspecciones: insps.length,
      completadas: completadas,
      pendientesMes: pendientesMes,
      tasaCumplimiento: tasaCumplimiento,
      extintoresVigentes: extintoresVigentes,
      extintoresTotal: extintores.length,
      year: anioActual,
      mes: now.toLocaleDateString("es-CO", { month: "long" }),
      mensualCompletadas: mensualCompletadas,
      mensualPendientes: mensualPendientes,
      programaTotal: programSummary.programaTotal,
      programaCompletadas: programSummary.programaCompletadas,
      programaPendientes: programSummary.programaPendientes
    });
  } catch (e) {
    console.error("[K+AIRSST][INSPECTIONS][STATS][ERROR]", e);
    return ok({
      totalInspecciones: 0,
      completadas: 0,
      pendientesMes: 0,
      tasaCumplimiento: 0,
      extintoresVigentes: 0,
      extintoresTotal: 0,
      year: new Date().getFullYear(),
      mes: new Date().toLocaleDateString("es-CO", { month: "long" }),
      mensualCompletadas: Array(12).fill(0),
      mensualPendientes: Array(12).fill(0),
      programaTotal: 0,
      programaCompletadas: 0,
      programaPendientes: 0
    });
  }
}

/* Calcula contadores del programa anual: total de actividades-mes
   programadas (valor 'p' o 'c'), completadas ('c') y pendientes ('p').
   Acepta el payload del programa (data.programs[key]) o null. */
function summarizeProgram(program) {
  if (!program || !program.activities) {
    return { programaTotal: 0, programaCompletadas: 0, programaPendientes: 0 };
  }
  var total = 0, comp = 0, pend = 0;
  program.activities.forEach(function (a) {
    if (!a.monthlySchedule) return;
    Object.keys(a.monthlySchedule).forEach(function (m) {
      var v = a.monthlySchedule[m];
      if (v === "p" || v === "c") {
        total++;
        if (v === "c") comp++;
        else if (v === "p") pend++;
      }
    });
  });
  return { programaTotal: total, programaCompletadas: comp, programaPendientes: pend };
}

/* ---------- Registro de handlers IPC ---------- */
// Firma flexible: acepta (app, deps) — usa el ipcMain importado arriba.
// main.js llama registerInspeccionesHandlers(app, { getCompanyRootPath })
function registerInspeccionesHandlers(_appOrIpcMain, _deps) {
  /* Guardar deps para la reconexión a la carpeta de la empresa */
  _gDeps = _deps || {};

  /* 8 canales principales del nuevo módulo */
  ipcMain.handle("company:listar", async function () {
    try { return listCompanies(); }
    catch (e) { console.error("[K+AIRSST][COMPANY][LIST][ERROR]", e); return err("LIST_FAILED", e.message); }
  });

  ipcMain.handle("programa:obtener", async function (event, year, companyId) {
    try { return await getProgramSmart(year, companyId || "default"); }
    catch (e) { console.error("[K+AIRSST][PROGRAM][GET][ERROR]", e); return err("GET_FAILED", e.message); }
  });

  // 📦543 — Helper: lee las inspecciones planificadas de UNA empresa.
  // Extraido del handler para poder llamarlo en loop cuando el scope es 'all'.
  // 2026-09-21 — async: usa getProgramSmart (lee el Excel real de la empresa
  // si existe; cacheado por mtime para no releerlo en cada mes del rango).
  async function _leerInspeccionesCalendarioDeEmpresa(currentCompany, start, end) {
    var startDate = new Date(start + "T00:00:00");
    var endDate = new Date(end + "T23:59:59");
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return [];
    }
    var events = [];
    var cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    var endCursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (cursor <= endCursor) {
      var year = cursor.getFullYear();
      var monthIdx = cursor.getMonth();
      var monthName = MONTHS[monthIdx];

      var programRes = await getProgramSmart(year, currentCompany);
      if (programRes && programRes.success && programRes.data && programRes.data.program) {
        var program = programRes.data.program;
        var businessDays = getFirst5BusinessDays(year, monthIdx);
        var activityCount = 0;
        (program.activities || []).forEach(function (act) {
          var schedule = act.monthlySchedule || {};
          var mesEstado = schedule[monthName];
          if (mesEstado !== "p" && mesEstado !== "c") return;
          var dayIdx = activityCount % 5;
          activityCount++;
          var dateStr = businessDays[dayIdx];
          var tipoLabel = INSPECTION_TYPE_LABELS[act.inspectionType] || act.inspectionType || "Inspección";
          events.push({
            id: "insp-prog-" + currentCompany + "-" + year + "-" + monthIdx + "-" + act.id,
            type: "inspeccion_programada",
            title: act.activity || tipoLabel,
            date: dateStr,
            start: "00:00",
            end: "23:59",
            color: "#174ea6",
            source: "inspecciones",
            // 📦543 — Empresa en el nivel top para que la UI pueda filtrar/agrupar
            empresa: currentCompany,
            meta: {
              actividad: act.activity || tipoLabel,
              tipoInspeccion: act.inspectionType,
              tipoLabel: tipoLabel,
              responsable: act.responsible || "",
              actividadId: act.id,
              mes: monthName,
              dia: dayIdx + 1,
              empresaId: currentCompany,
              year: year,
              estado: mesEstado
            }
          });
        });
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return events;
  }

  /* Devuelve los eventos del calendario para las inspecciones PLANIFICADAS
     (monthlySchedule[Mes] === "p") del programa anual de la empresa.
     Cada actividad planificada genera 5 eventos puntuales, uno por cada
     uno de los primeros 5 días hábiles (lun-vie) del mes. Filtra por rango
     y por empresa. El adapter del calendario lo consume.
     Params: { start, end, currentCompany } (plano, NO envuelto en range).

     📦543 — Soporte para scope='all': si currentCompany es null, lee de
     TODAS las empresas del config y concatena los eventos.

     Task 5 — extraído a _getEventsCalendarioImpl para poder exportarlo como
     fuente de notificaciones (module.exports.getEventsCalendario). */
  async function _getEventsCalendarioImpl(params) {
    try {
      var start = params && params.start;
      var end = params && params.end;
      var currentCompany = (params && params.currentCompany) || "default";
      if (!start || !end) {
        return err("INVALID_INPUT", "start y end son obligatorios");
      }

      // Si hay empresa valida, leer solo de ella
      if (currentCompany && currentCompany !== "default") {
        return ok(await _leerInspeccionesCalendarioDeEmpresa(currentCompany, start, end));
      }

      // 📦543 — Scope='all' → leer de todas las empresas del config
      var configPath = path.join(_appOrIpcMain.getPath('userData'), 'config.json');
      var config;
      try {
        var fs = require('fs');
        var configRaw = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(configRaw);
      } catch (e) {
        console.log('[INSP-CAL] ERROR leyendo config:', e.message);
        return ok([]);
      }
      var allCompanies = Object.keys((config && config.companyPaths) || {});
      console.log('[INSP-CAL] scope=all → iterando', allCompanies.length, 'empresas');
      var allEvents = [];
      for (var i = 0; i < allCompanies.length; i++) {
        var evs = await _leerInspeccionesCalendarioDeEmpresa(allCompanies[i], start, end);
        allEvents.push.apply(allEvents, evs);
      }
      return ok(allEvents);
    }
    catch (e) {
      console.error("[K+AIRSST][INSPECTION][CAL_EVENTS][ERROR]", e);
      return err("GET_EVENTS_FAILED", e.message);
    }
  }

  module.exports.getEventsCalendario = _getEventsCalendarioImpl;

  ipcMain.handle("inspeccion:programa:getEventsCalendario", async function (event, params) {
    return _getEventsCalendarioImpl(params);
  });

  ipcMain.handle("programa:actualizarActividad", async function (event, activityId, patch) {
    try {
      if (!activityId || typeof activityId !== "string") {
        return err("INVALID_INPUT", "activityId es obligatorio");
      }
      /* 2026-09-21 — Actividades con prefijo "excel:<empresa>:<anio>:<fila>"
         se escriben en el Excel real de la carpeta de la empresa (con
         respaldo). Las demás siguen por la libreta interna. */
      if (activityId.indexOf("excel:") === 0) {
        var parts = activityId.split(":");
        if (parts.length !== 4) return err("INVALID_ID", "Id de actividad de Excel inválido");
        return await writeActivityToExcel(parts[1], parseInt(parts[2], 10), parseInt(parts[3], 10), patch || {});
      }
      return updateActivity(activityId, patch || {});
    }
    catch (e) { console.error("[K+AIRSST][PROGRAM][ACTIVITY_UPDATE][ERROR]", e); return err("UPDATE_FAILED", e.message); }
  });

  ipcMain.handle("inspeccion:listar", async function (event, filter) {
    try {
      /* Importación idempotente del inspecciones_data.json legado que la
         versión de mayo (📦332) dejó en la carpeta de la empresa. */
      if (filter && (filter.companyId || filter.companyName)) {
        await importLegacyFolderInspections(filter.companyName || filter.companyId);
      }
      return listInspections(filter || {});
    }
    catch (e) { console.error("[K+AIRSST][INSPECTION][LIST][ERROR]", e); return err("LIST_FAILED", e.message); }
  });

  ipcMain.handle("inspeccion:obtener", async function (event, id) {
    try {
      if (!id) return err("INVALID_INPUT", "id es obligatorio");
      return getInspection(id);
    }
    catch (e) { console.error("[K+AIRSST][INSPECTION][GET][ERROR]", e); return err("GET_FAILED", e.message); }
  });

  ipcMain.handle("inspeccion:crear", async function (event, payload) {
    try {
      if (!payload || typeof payload !== "object") {
        return err("INVALID_INPUT", "payload es obligatorio");
      }
      return createInspection(payload);
    }
    catch (e) { console.error("[K+AIRSST][INSPECTION][CREATE][ERROR]", e); return err("CREATE_FAILED", e.message); }
  });

  ipcMain.handle("inspeccion:actualizar", async function (event, id, patch) {
    try {
      if (!id) return err("INVALID_INPUT", "id es obligatorio");
      return updateInspection(id, patch || {});
    }
    catch (e) { console.error("[K+AIRSST][INSPECTION][UPDATE][ERROR]", e); return err("UPDATE_FAILED", e.message); }
  });

  ipcMain.handle("inspeccion:eliminar", async function (event, id) {
    try {
      if (!id) return err("INVALID_INPUT", "id es obligatorio");
      return deleteInspection(id);
    }
    catch (e) { console.error("[K+AIRSST][INSPECTION][DELETE][ERROR]", e); return err("DELETE_FAILED", e.message); }
  });

  /* Exporta una inspección a .xlsx usando la plantilla oficial de su tipo
     (instalaciones, botiquin, extintores, equipos_emergencia). Solo aplica
     a esos 4 tipos. Devuelve el archivo serializado en base64. */
  ipcMain.handle("inspeccion:exportarXlsx", async function (event, insp) {
    try {
      if (!insp || !insp.type) {
        return err("INVALID_INPUT", "insp.type es obligatorio");
      }
      if (!TEMPLATES[insp.type]) {
        return err("NO_TEMPLATE",
          "No hay plantilla registrada para type=" + insp.type);
      }
      var res = await exportXlsxFromTemplate(insp);
      if (!res.success) {
        console.warn("[K+AIRSST][INSPECTION][EXPORT_XLSX_FROM_TEMPLATE]", res.error);
      }
      return res;
    }
    catch (e) {
      console.error("[K+AIRSST][INSPECTION][EXPORT_XLSX_FROM_TEMPLATE][ERROR]", e);
      return err("EXPORT_FAILED", e.message);
    }
  });

  /* 2026-09-21 — Explora el histórico real de la carpeta de la empresa
     ("Inspeciones realizadas/<Sede>/<fecha>/") para mostrarlo en la vista
     de historial. Solo lectura. */
  ipcMain.handle("inspeccion:explorarHistorico", async function (event, companyId) {
    try { return await explorarHistoricoCarpeta(companyId); }
    catch (e) { console.error("[K+AIRSST][INSPECTION][EXPLORAR][ERROR]", e); return err("EXPLORAR_FAILED", e.message); }
  });

  /* Abre una ruta del explorador de archivos del SO. Las rutas vienen del
     propio escaneo del bridge (entradas de explorarHistorico), no de input
     libre del renderer. */
  ipcMain.handle("inspeccion:abrirRuta", async function (event, targetPath) {
    try {
      if (!targetPath || typeof targetPath !== "string") {
        return err("INVALID_INPUT", "ruta es obligatoria");
      }
      await shell.openPath(targetPath);
      return ok({ opened: true });
    } catch (e) { console.error("[K+AIRSST][INSPECTION][OPEN_PATH][ERROR]", e); return err("OPEN_FAILED", e.message); }
  });

  /* 2026-09-21 — Archiva una inspección en la carpeta de la empresa:
     genera su formato oficial y lo guarda en "Inspeciones realizadas/
     <sede>/<fecha>/". */
  ipcMain.handle("inspeccion:archivar", async function (event, payload) {
    try { return await archivarInspeccionEnCarpeta(payload || {}); }
    catch (e) { console.error("[K+AIRSST][INSPECTION][ARCHIVAR][ERROR]", e); return err("ARCHIVAR_FAILED", e.message); }
  });

  /* Backward-compat: 1 canal para el home de gestion-peligros */
  ipcMain.handle("inspecciones:get-stats", async function (event, companyName) {
    return await getInspeccionesStats(companyName);
  });

  console.log("[K+AIRSST][IPC][REGISTER][SUCCESS] handlers=8+3+1 (inspecciones nuevo contrato + carpeta empresa + get-stats legacy)");
}

module.exports = {
  registerInspeccionesHandlers: registerInspeccionesHandlers,
  getInspeccionesStats: getInspeccionesStats
};