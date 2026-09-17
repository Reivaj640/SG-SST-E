/* ============================================================
 * K+AIR · Vista Historial
 * Tabla enterprise con búsqueda + filtro de tipo + acciones por fila
 * ============================================================ */
(function (global) {
  "use strict";

  var T = global.KairInspectionTypes;
  var tpl = global.KairTemplates;
  var api = global.KairAPI;

  function Historial(root, ctx) {
    var store = global.KairStore.getState();
    var allList = [];
    var filterType = "all";
    var query = "";

    var wrap = tpl.el("div", { className: "kair-app", style: "min-height:100vh;display:flex;flex-direction:column;" });

    wrap.appendChild(tpl.buildHeader({
      onBack: function () { ctx.go({ name: "dashboard" }); },
      title: "Historial de Inspecciones",
      subtitle: "Inspecciones registradas",
      companyName: store.companyName, contextLabel: "SG-SST",
      actions: [
        { label: "Nueva Inspección", variant: "primary", icon: tpl.icon("plus", 15), onClick: function () { ctx.go({ name: "hub" }); } }
      ],
      tabs: [
        { id: "dashboard", label: "Programa", onClick: function () { ctx.go({ name: "dashboard" }); } },
        { id: "hub", label: "Inspecciones", onClick: function () { ctx.go({ name: "hub" }); } },
        { id: "historial", label: "Historial", active: true, onClick: function () { ctx.go({ name: "historial" }); } }
      ]
    }));

    var main = tpl.el("main", { className: "kair-main", style: "max-width:1600px;" });

    // Filter bar
    var filterBody = tpl.el("div", { className: "kair-filter-bar" }, [
      tpl.el("div", { className: "kair-filter-bar__search" }, [
        tpl.icon("search", 16),
        tpl.el("input", { type: "text", placeholder: "Buscar por responsable, sede, código...", oninput: function (e) { query = e.target.value.toLowerCase(); renderTable(); } })
      ]),
      tpl.el("div", { className: "kair-flex kair-gap-2" }, [
        tpl.icon("filter", 16),
        (function () {
          var sel = tpl.el("select", { className: "kair-select", style: "width:auto;min-width:200px;", onchange: function (e) { filterType = e.target.value; renderTable(); } });
          sel.appendChild(tpl.el("option", { value: "all", textContent: "Todos los tipos" }));
          T.INSPECTION_TYPE_LIST.forEach(function (t) {
            sel.appendChild(tpl.el("option", { value: t.type, textContent: t.shortTitle + " (" + t.code + ")" }));
          });
          return sel;
        })()
      ])
    ]);
    main.appendChild(tpl.buildCard(null, filterBody));

    var tableCard = tpl.el("div", { className: "kair-card" });
    var tableBody = tpl.el("div", { className: "kair-card__body kair-card__body--flush" });
    tableBody.appendChild(tpl.loadingBlock("Cargando inspecciones..."));
    tableCard.appendChild(tableBody);
    main.appendChild(tableCard);

    wrap.appendChild(main);
    root.appendChild(wrap);

    load();

    function load() {
      // 📦504 — Pasar también companyName para que la migración retroactiva
      // del bridge pueda normalizar inspections guardadas con placeholders
      // heredados ("K+AIR Demo S.A.S.", "Empresa K+AIR", etc.).
      api.listInspections({ companyId: store.companyId, companyName: store.companyName }).then(function (res) {
        if (!res.success) throw new Error(res.error && res.error.message);
        allList = res.data.inspections;
        if (global.KairStore) global.KairStore.setInspections(allList);
        renderTable();
      }).catch(function (e) {
        tableBody.innerHTML = "";
        tableBody.appendChild(tpl.el("div", { style: "padding:24px;color:#dc3545;", textContent: e.message }));
      });
    }

    function renderTable() {
      var filtered = allList;
      if (filterType !== "all") filtered = filtered.filter(function (i) { return i.type === filterType; });
      if (query) {
        filtered = filtered.filter(function (i) {
          return (i.performedBy || "").toLowerCase().indexOf(query) !== -1 ||
            (i.site || "").toLowerCase().indexOf(query) !== -1 ||
            (i.title || "").toLowerCase().indexOf(query) !== -1 ||
            (i.code || "").toLowerCase().indexOf(query) !== -1;
        });
      }
      tableBody.innerHTML = "";

      if (filtered.length === 0) {
        var btn = tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--primary", style: "margin-top:12px;", onclick: function () { ctx.go({ name: "hub" }); } }, [tpl.icon("plus", 14), tpl.el("span", { textContent: "Nueva inspección" })]);
        tableBody.appendChild(tpl.emptyState(
          "file-text",
          allList.length === 0 ? "Sin inspecciones registradas" : "Sin resultados para el filtro",
          allList.length === 0 ? "Realice su primera inspección desde el centro de inspecciones." : "Ajuste los filtros o el término de búsqueda.",
          btn
        ));
        tpl.refreshIcons();
        return;
      }

      var tableWrap = tpl.el("div", { className: "kair-table-wrap", style: "max-height:600px;" });
      var table = tpl.el("table", { className: "kair-table" });
      table.appendChild(tpl.el("thead", {}, [tpl.el("tr", {}, [
        tpl.el("th", { textContent: "Tipo", style: "min-width:220px;" }),
        tpl.el("th", { textContent: "Fecha", style: "width:120px;" }),
        tpl.el("th", { textContent: "Realizada por" }),
        tpl.el("th", { textContent: "Sede / Sitio" }),
        tpl.el("th", { textContent: "Empresa" }),
        tpl.el("th", { textContent: "Estado", style: "width:110px;" }),
        tpl.el("th", { textContent: "Acciones", style: "width:240px;text-align:right;" })
      ])]));

      var tbody = tpl.el("tbody");
      filtered.forEach(function (i) {
        var meta = T.INSPECTION_TYPES[i.type];
        var tr = tpl.el("tr");
        var tdTipo = tpl.el("td");
        tdTipo.appendChild(tpl.el("div", { className: "kair-flex kair-gap-2" }, [
          tpl.el("span", { className: "kair-type-icon", style: "width:32px;height:32px;background-color:" + (meta && meta.accent || "#174ea6") + "1a;color:" + (meta && meta.accent || "#174ea6") + ";" }, [tpl.icon("file-text", 16)]),
          tpl.el("div", {}, [
            tpl.el("div", { style: "font-weight:500;color:#1a1a2e;font-size:0.85rem;", textContent: (meta && meta.shortTitle) || i.title }),
            tpl.el("div", { style: "font-size:0.7rem;color:#adb5bd;", textContent: i.code })
          ])
        ]));
        tr.appendChild(tdTipo);
        tr.appendChild(tpl.el("td", {}, [tpl.el("span", { className: "kair-text-xs kair-text-muted", textContent: tpl.formatDate(i.date, { short: true }) })]));
        var whoTd = tpl.el("td");
        whoTd.appendChild(tpl.el("div", { style: "font-size:0.85rem;color:#1a1a2e;font-weight:500;", textContent: i.performedBy }));
        if (i.role) whoTd.appendChild(tpl.el("div", { style: "font-size:0.72rem;color:#5a6378;", textContent: i.role }));
        tr.appendChild(whoTd);
        tr.appendChild(tpl.el("td", {}, [tpl.el("span", { className: "kair-text-xs kair-text-muted", textContent: i.site || "—" })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("span", { className: "kair-text-xs kair-text-muted", textContent: i.companyName || store.companyName || "—" })]));
        tr.appendChild(tpl.el("td", {}, [tpl.statusPill(i.status)]));
        var tdActions = tpl.el("td");
        var actionsWrap = tpl.el("div", { style: "display:flex;justify-content:flex-end;gap:4px;" });
        actionsWrap.appendChild(tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--ghost", style: "padding:4px 8px;font-size:0.75rem;", title: "Ver detalle", onclick: function () { ctx.go({ name: "detalle", inspectionId: i.id }); } }, [tpl.icon("eye", 14), tpl.el("span", { textContent: "Ver" })]));
        actionsWrap.appendChild(tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--ghost", style: "padding:4px 8px;font-size:0.75rem;", title: "Exportar PDF", onclick: function () { exportOne(i.id, "pdf"); } }, [tpl.icon("file-down", 14), tpl.el("span", { textContent: "PDF" })]));
        actionsWrap.appendChild(tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--ghost", style: "padding:4px 8px;font-size:0.75rem;", title: "Exportar Excel", onclick: function () { exportOne(i.id, "xlsx"); } }, [tpl.icon("file-down", 14), tpl.el("span", { textContent: "XLSX" })]));
        actionsWrap.appendChild(tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--ghost", style: "padding:4px 8px;font-size:0.75rem;color:#dc3545;", title: "Eliminar", onclick: function () { del(i.id); } }, [tpl.icon("trash-2", 14)]));
        tdActions.appendChild(actionsWrap);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      tableBody.appendChild(tableWrap);
      tpl.refreshIcons();
    }

    function exportOne(id, format) {
      tpl.toast("Exportando", "Generando " + format.toUpperCase() + "...", "info");

      // 📦504 — XLSX va por IPC al main process, que carga la plantilla
      // oficial de utils/ para el tipo de inspección, completa las celdas
      // editables y devuelve un .xlsx preservando bordes, fonts, fills,
      // merges y anchos de columna. Aplica a los 4 tipos con plantilla
      // (instalaciones, botiquin, extintores, equipos_emergencia).
      if (format === "xlsx") {
        var inspRef = null;
        api.getInspection(id).then(function (getRes) {
          if (!getRes.success) throw new Error(getRes.error && getRes.error.message);
          inspRef = getRes.data.inspection;
          if (!global.electronAPI || typeof global.electronAPI.inspeccionExportarXlsx !== "function") {
            throw new Error("API de export XLSX no disponible");
          }
          return global.electronAPI.inspeccionExportarXlsx(inspRef);
        }).then(function (res) {
          if (!res || !res.success || !res.data || !res.data.xlsxBase64) {
            throw new Error((res && res.error && res.error.message) || "Error al generar XLSX");
          }
          // Decodificar base64 → Uint8Array → Blob y descargar
          var binStr = atob(res.data.xlsxBase64);
          var bytes = new Uint8Array(binStr.length);
          for (var i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
          var blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
          if (global.KairExport) {
            global.KairExport.downloadBlob(blob, global.KairExport.safeFileName(inspRef) + ".xlsx");
          }
          tpl.toast("Éxito", "Archivo generado desde plantilla", "success");
        }).catch(function (e) { tpl.toast("Error", e.message, "error"); });
        return;
      }

      // PDF: engine cliente (sin cambios)
      api.exportInspection(id, format).then(function (res) {
        if (!res.success) throw new Error(res.error && res.error.message);
        if (global.KairExport) global.KairExport.downloadBlob(res.data.blob, res.data.filename);
        tpl.toast("Éxito", "Archivo generado", "success");
      }).catch(function (e) { tpl.toast("Error", e.message, "error"); });
    }

    function del(id) {
      if (!confirm("¿Eliminar esta inspección? Esta acción no se puede deshacer.")) return;
      api.deleteInspection(id).then(function (res) {
        if (!res.success) throw new Error(res.error && res.error.message);
        allList = allList.filter(function (x) { return x.id !== id; });
        tpl.toast("Eliminada", "La inspección fue eliminada", "success");
        renderTable();
      }).catch(function (e) { tpl.toast("Error", e.message, "error"); });
    }

    tpl.refreshIcons();
  }

  global.KairViews = global.KairViews || {};
  global.KairViews.Historial = Historial;
})(typeof window !== "undefined" ? window : this);