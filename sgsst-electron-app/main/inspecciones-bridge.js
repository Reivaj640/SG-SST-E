/* ============================================================
 * K+AIR · Inspecciones — Bridge IPC con file-based JSON store
 *
 * Handlers (8 canales, naming `modulo:accion`):
 *   company:listar                    → store.listCompanies()
 *   programa:obtener                  → store.getProgram(year, companyId)
 *   programa:actualizarActividad      → store.updateActivity(id, patch)
 *   inspeccion:listar                 → store.listInspections(filter)
 *   inspeccion:obtener                → store.getInspection(id)
 *   inspeccion:crear                  → store.createInspection(payload)
 *   inspeccion:actualizar             → store.updateInspection(id, patch)
 *   inspeccion:eliminar               → store.deleteInspection(id)
 *
 * Backward-compat (para widgets del home de gestion-peligros):
 *   inspecciones:get-stats(company)   → wrapper que lee del nuevo store
 *     y retorna {totalInspecciones, completadas, pendientesMes,
 *                tasaCumplimiento, extintoresVigentes, extintoresTotal}
 *
 * Persistencia: <userData>/kair-inspecciones-data.json
 * ============================================================ */
const { app, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const DATA_FILE = () =>
  path.join(app.getPath("userData"), "kair-inspecciones-data.json");

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

function listInspections(filter) {
  var data = load();
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
    companyId: company.id,
    companyName: company.name,
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
             extintoresVigentes, extintoresTotal}. Leemos del nuevo store. */
function getInspeccionesStats(companyName) {
  try {
    var data = load();
    var companyId = companyName || "default";
    var company = data.companies[companyId];
    if (!company) {
      return ok({
        totalInspecciones: 0,
        completadas: 0,
        pendientesMes: 0,
        tasaCumplimiento: 0,
        extintoresVigentes: 0,
        extintoresTotal: 0
      });
    }
    var insps = data.inspections.filter(function (i) { return i.companyId === companyId; });
    var completadas = insps.filter(function (i) { return i.status === "Completada"; }).length;
    var now = new Date();
    var mesActual = now.getMonth();
    var anioActual = now.getFullYear();
    var pendientesMes = 0;
    insps.forEach(function (i) {
      var d = new Date(i.date);
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
    return ok({
      totalInspecciones: insps.length,
      completadas: completadas,
      pendientesMes: pendientesMes,
      tasaCumplimiento: tasaCumplimiento,
      extintoresVigentes: extintoresVigentes,
      extintoresTotal: extintores.length
    });
  } catch (e) {
    console.error("[K+AIRSST][INSPECTIONS][STATS][ERROR]", e);
    return ok({
      totalInspecciones: 0,
      completadas: 0,
      pendientesMes: 0,
      tasaCumplimiento: 0,
      extintoresVigentes: 0,
      extintoresTotal: 0
    });
  }
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