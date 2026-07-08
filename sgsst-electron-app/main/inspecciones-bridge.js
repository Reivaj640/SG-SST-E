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
 * Persistencia: <userData>/kair-inspecciones-data.json
 * Plantillas:    <appPath>/utils/GI-FO-*.xlsx
 * ============================================================ */
const { app, ipcMain } = require("electron");
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
   o null (ExcelJS devuelve distinto según el tipo de celda). */
function cellText(cell) {
  var v = cell && cell.value;
  if (v == null || v === "") return "";
  if (typeof v === "string") return v;
  if (v && v.richText) return v.richText.map(function (rt) { return rt.text; }).join("");
  if (v && v.text) return v.text;
  return String(v);
}

function setText(ws, addr, val) {
  ws.getCell(addr).value = val == null ? "" : String(val);
}

let cache = null;

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
  Object.keys(data.programs).forEach(function (key) {
    var program = data.programs[key];
    var idx = program.activities.findIndex(function (a) { return a.id === activityId; });
    if (idx >= 0) {
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
  return ok({ activity: updated });
}

/* ---------- Inspecciones ---------- */
var INSPECTION_META = {
  botiquin: { code: "GI-FO-031", title: "Inspección de Botiquín de Primeros Auxilios" },
  extintores: { code: "GI-FO-026", title: "Inspección de Extintores" },
  instalaciones: { code: "GI-FO-025", title: "Inspección de Instalaciones" },
  equipos_emergencia: { code: "GI-FO-023", title: "Inspección de Equipos de Emergencia" }
};

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
              mensualCompletadas, mensualPendientes}. Leemos del nuevo store. */
function getInspeccionesStats(companyName) {
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

    /* Programa anual de la empresa (mismo año actual) */
    var programKey = companyId + ":" + anioActual;
    var programSummary = summarizeProgram(data.programs[programKey]);

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
  /* 8 canales principales del nuevo módulo */
  ipcMain.handle("company:listar", async function () {
    try { return listCompanies(); }
    catch (e) { console.error("[K+AIRSST][COMPANY][LIST][ERROR]", e); return err("LIST_FAILED", e.message); }
  });

  ipcMain.handle("programa:obtener", async function (event, year, companyId) {
    try { return getProgram(year, companyId || "default"); }
    catch (e) { console.error("[K+AIRSST][PROGRAM][GET][ERROR]", e); return err("GET_FAILED", e.message); }
  });

  ipcMain.handle("programa:actualizarActividad", async function (event, activityId, patch) {
    try {
      if (!activityId || typeof activityId !== "string") {
        return err("INVALID_INPUT", "activityId es obligatorio");
      }
      return updateActivity(activityId, patch || {});
    }
    catch (e) { console.error("[K+AIRSST][PROGRAM][ACTIVITY_UPDATE][ERROR]", e); return err("UPDATE_FAILED", e.message); }
  });

  ipcMain.handle("inspeccion:listar", async function (event, filter) {
    try { return listInspections(filter || {}); }
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

  /* Backward-compat: 1 canal para el home de gestion-peligros */
  ipcMain.handle("inspecciones:get-stats", async function (event, companyName) {
    return getInspeccionesStats(companyName);
  });

  console.log("[K+AIRSST][IPC][REGISTER][SUCCESS] handlers=8+1 (inspecciones nuevo contrato + get-stats legacy)");
}

module.exports = {
  registerInspeccionesHandlers: registerInspeccionesHandlers,
  getInspeccionesStats: getInspeccionesStats
};