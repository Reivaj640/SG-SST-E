/* ============================================================
 * K+AIR · Inspecciones — API (abstracción IPC + fallback localStorage)
 *
 * En Electron: usa window.electronAPI (expuesto por preload.js)
 *   - canal: modulo:accion (company:listar, programa:obtener, etc.)
 * En navegador: localStorage con misma forma {success, data, error}.
 * ============================================================ */
(function (global) {
  "use strict";

  var T = global.KairInspectionTypes;
  var isElectron = typeof global.electronAPI === "object" && global.electronAPI !== null;

  var LS_KEYS = {
    inspections: "kair.inspections",
    program: "kair.program",
    company: "kair.company"
  };

  function lsRead(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function lsWrite(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  function ensureCompanyLs() {
    var c = lsRead(LS_KEYS.company, null);
    if (!c) {
      c = { id: "default", name: "K+AIR Demo S.A.S." };
      lsWrite(LS_KEYS.company, c);
    }
    return c;
  }

  function emptyScheduleLs() {
    var s = {};
    T.MONTHS.forEach(function (m) { s[m] = ""; });
    return s;
  }

  function ensureProgramLs(year, companyId) {
    var all = lsRead(LS_KEYS.program, {});
    var key = companyId + ":" + year;
    if (!all[key]) {
      all[key] = {
        id: "prog_" + Date.now(),
        year: year,
        companyId: companyId,
        generalObjective: T.GENERAL_OBJECTIVE,
        activities: T.PROGRAM_ACTIVITIES_DEFAULT.map(function (a, idx) {
          return {
            id: "act_" + Date.now() + "_" + idx,
            specificObjective: a.specificObjective,
            activity: a.activity,
            responsible: a.responsible,
            inspectionType: a.inspectionType,
            monthlySchedule: emptyScheduleLs(),
            percentage: 0,
            status: "Sin Iniciar",
            observations: a.inspectionType === "gerencial" ? "Gerencia no realizó la inspección." : null
          };
        })
      };
      lsWrite(LS_KEYS.program, all);
    }
    return all[key];
  }

  function computePct(schedule) {
    var programmed = 0, completed = 0;
    T.MONTHS.forEach(function (m) {
      var v = schedule[m];
      if (v === "p" || v === "c") programmed++;
      if (v === "c") completed++;
    });
    if (programmed === 0) return 0;
    return Math.round((completed / programmed) * 100) / 100;
  }

  function deriveStatus(schedule, pct) {
    var hasAny = T.MONTHS.some(function (m) { return schedule[m] === "p" || schedule[m] === "c"; });
    var hasCompleted = T.MONTHS.some(function (m) { return schedule[m] === "c"; });
    if (!hasAny) return "Sin Iniciar";
    if (pct >= 1 && hasCompleted) return "Ejecutado";
    return "En Proceso";
  }

  var api = {
    isElectron: isElectron,

    /* Empresas */
    listCompanies: function () {
      if (isElectron) return Promise.resolve(global.electronAPI.companyListar());
      var c = ensureCompanyLs();
      return Promise.resolve({ success: true, data: { companies: [c] } });
    },

    /* Programa */
    getProgram: function (year, companyId) {
      var cid = companyId || "default";
      if (isElectron) return Promise.resolve(global.electronAPI.programaObtener(year, cid));
      var program = ensureProgramLs(year, cid);
      return Promise.resolve({ success: true, data: { program: program } });
    },

    updateActivity: function (activityId, patch) {
      if (isElectron) return Promise.resolve(global.electronAPI.programaActualizarActividad(activityId, patch));

      var all = lsRead(LS_KEYS.program, {});
      var updated = null;
      Object.keys(all).forEach(function (key) {
        var program = all[key];
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
      lsWrite(LS_KEYS.program, all);
      if (!updated) return Promise.resolve({ success: false, error: { code: "NOT_FOUND", message: "Actividad no encontrada" } });
      return Promise.resolve({ success: true, data: { activity: updated } });
    },

    /* Inspecciones */
    listInspections: function (filter) {
      if (isElectron) return Promise.resolve(global.electronAPI.inspeccionListar(filter || {}));
      var all = lsRead(LS_KEYS.inspections, []);
      var list = all;
      if (filter && filter.type && filter.type !== "all") list = list.filter(function (i) { return i.type === filter.type; });
      if (filter && filter.companyId) list = list.filter(function (i) { return i.companyId === filter.companyId; });
      list = list.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
      return Promise.resolve({ success: true, data: { inspections: list } });
    },

    getInspection: function (id) {
      if (isElectron) return Promise.resolve(global.electronAPI.inspeccionObtener(id));
      var all = lsRead(LS_KEYS.inspections, []);
      var found = all.find(function (i) { return i.id === id; });
      if (!found) return Promise.resolve({ success: false, error: { code: "NOT_FOUND", message: "Inspección no encontrada" } });
      return Promise.resolve({ success: true, data: { inspection: found } });
    },

    createInspection: function (payload) {
      if (isElectron) return Promise.resolve(global.electronAPI.inspeccionCrear(payload));
      var company = ensureCompanyLs();
      var meta = T.INSPECTION_TYPES[payload.type];
      if (!meta) return Promise.resolve({ success: false, error: { code: "INVALID_TYPE", message: "Tipo inválido" } });
      var enriched = Object.assign({}, payload, { companyId: company.id, companyName: company.name });
      var newInsp = {
        id: "insp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        type: payload.type,
        code: meta.code,
        title: meta.title,
        date: payload.date,
        performedBy: payload.performedBy,
        role: payload.role || null,
        site: payload.site || null,
        companyId: enriched.companyId || company.id,
        companyName: enriched.companyName || company.name,
        status: enriched.status || "Completada",
        observations: enriched.observations || null,
        data: enriched.data || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      var all = lsRead(LS_KEYS.inspections, []);
      all.push(newInsp);
      lsWrite(LS_KEYS.inspections, all);
      return Promise.resolve({ success: true, data: { inspection: newInsp } });
    },

    updateInspection: function (id, patch) {
      if (isElectron) return Promise.resolve(global.electronAPI.inspeccionActualizar(id, patch));
      var all = lsRead(LS_KEYS.inspections, []);
      var idx = all.findIndex(function (i) { return i.id === id; });
      if (idx < 0) return Promise.resolve({ success: false, error: { code: "NOT_FOUND", message: "Inspección no encontrada" } });
      all[idx] = {
        ...all[idx],
        date: patch.date || all[idx].date,
        performedBy: patch.performedBy || all[idx].performedBy,
        role: patch.role != null ? patch.role : all[idx].role,
        site: patch.site != null ? patch.site : all[idx].site,
        observations: patch.observations != null ? patch.observations : all[idx].observations,
        data: patch.data || all[idx].data,
        status: patch.status || all[idx].status,
        updatedAt: new Date().toISOString()
      };
      lsWrite(LS_KEYS.inspections, all);
      return Promise.resolve({ success: true, data: { inspection: all[idx] } });
    },

    deleteInspection: function (id) {
      if (isElectron) return Promise.resolve(global.electronAPI.inspeccionEliminar(id));
      var all = lsRead(LS_KEYS.inspections, []);
      var next = all.filter(function (i) { return i.id !== id; });
      lsWrite(LS_KEYS.inspections, next);
      return Promise.resolve({ success: true, data: { id: id } });
    },

    /* Export (renderer-side con KairExport). En Electron sigue funcionando
       porque el renderer tiene acceso a window.jspdf y window.XLSX vía vendors. */
    exportInspection: function (id, format) {
      return api.getInspection(id).then(function (res) {
        if (!res.success) return res;
        var insp = res.data.inspection;
        if (!global.KairExport) return { success: false, error: { code: "NO_EXPORT", message: "Motor de exportación no cargado" } };
        if (format === "pdf") {
          var blob = global.KairExport.exportInspectionToPdfBlob(insp);
          return { success: true, data: { blob: blob, filename: global.KairExport.safeFileName(insp) + ".pdf" } };
        }
        if (format === "xlsx") {
          var blob2 = global.KairExport.exportInspectionToXlsxBlob(insp);
          return { success: true, data: { blob: blob2, filename: global.KairExport.safeFileName(insp) + ".xlsx" } };
        }
        return { success: false, error: { code: "INVALID_FORMAT", message: "Formato inválido" } };
      });
    },

    exportProgram: function (year, companyId) {
      return api.getProgram(year, companyId).then(function (res) {
        if (!res.success) return res;
        var program = res.data.program;
        if (!global.KairExport) return { success: false, error: { code: "NO_EXPORT", message: "Motor de exportación no cargado" } };
        var blob = global.KairExport.exportProgramToXlsxBlob(program);
        return { success: true, data: { blob: blob, filename: "K+AIR_Programa_Inspecciones_" + year + ".xlsx" } };
      });
    }
  };

  global.KairAPI = api;
})(typeof window !== "undefined" ? window : this);