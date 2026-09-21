/* ============================================================
 * K+AIR · Vista Historial (premium 📦796)
 * Referencia 2026-09-21: buscador + píldoras de tipo + contador +
 * filas con chip de icono, código, meta, estado y acciones por icono
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
      onBack: function () { ctx.go({ name: "hub" }); },
      title: "Historial de Inspecciones",
      subtitle: "Inspecciones registradas",
      companyName: store.companyName,
      contextLabel: "SG-SST",
      actions: [
        { label: "Nueva Inspección", variant: "primary", icon: tpl.icon("plus", 15), onClick: function () { ctx.go({ name: "hub" }); } }
      ],
      tabs: [
        { id: "hub", label: "Dashboard", onClick: function () { ctx.go({ name: "hub" }); } },
        { id: "dashboard", label: "Programa anual", onClick: function () { ctx.go({ name: "dashboard" }); } },
        { id: "historial", label: "Historial", active: true, onClick: function () { ctx.go({ name: "historial" }); } }
      ]
    }));

    var main = tpl.el("main", { className: "kair-main", style: "max-width:1600px;" });

    /* ── Barra de filtros: búsqueda + píldoras de tipo ── */
    var pills = tpl.el("div", { className: "kair-insp-filters__pills" });
    function renderPills() {
      pills.innerHTML = "";
      var all = [{ type: "all", shortTitle: "Todas" }].concat(T.INSPECTION_TYPE_LIST);
      all.forEach(function (t) {
        var btn = tpl.el("button", {
          type: "button",
          className: "kair-insp-pill" + (filterType === t.type ? " kair-insp-pill--active" : ""),
          textContent: t.shortTitle,
          onclick: function () {
            filterType = t.type;
            renderPills();
            renderList();
          }
        });
        pills.appendChild(btn);
      });
    }
    renderPills();

    var filterBody = tpl.el("div", { className: "kair-insp-filters" }, [
      tpl.el("div", { className: "kair-insp-filters__search" }, [
        tpl.icon("search", 16),
        tpl.el("input", { type: "text", placeholder: "Buscar por código, persona o sede...", oninput: function (e) { query = e.target.value.toLowerCase(); renderList(); } })
      ]),
      pills
    ]);
    main.appendChild(filterBody);

    /* ── Contador ── */
    var counter = tpl.el("div", { className: "kair-insp-counter", textContent: "Cargando inspecciones..." });
    main.appendChild(counter);

    /* ── Lista de filas ── */
    var listCard = tpl.el("div", { className: "kair-card" });
    var listBody = tpl.el("div", { className: "kair-card__body kair-card__body--flush" });
    listBody.appendChild(tpl.loadingBlock("Cargando inspecciones..."));
    listCard.appendChild(listBody);
    main.appendChild(listCard);

    /* ── Archivo histórico de la carpeta de la empresa (2026-09-21) ──
       Explora "Inspeciones realizadas/<Sede>/<fecha>/" de la carpeta real
       4.2.4 y lista las visitas antiguas con sus fotos/formatos. Solo
       lectura; cada entrada abre su carpeta en el explorador del SO. */
    var histBody = tpl.el("div", { className: "kair-card__body kair-card__body--flush" });
    histBody.appendChild(tpl.loadingBlock("Explorando archivo histórico..."));
    var histCard = tpl.el("div", { className: "kair-card", style: "margin-top:16px;" }, [
      tpl.el("div", { className: "kair-card__header" }, [
        tpl.el("h2", { className: "kair-card__title", textContent: "Archivo histórico · carpeta de la empresa" }),
        tpl.el("span", { className: "kair-insp-row__code", textContent: "Inspecciones realizadas por sede y fecha" })
      ]),
      histBody
    ]);
    main.appendChild(histCard);

    if (api.isElectron) {
      api.explorarHistorico(store.companyId || store.companyName).then(function (res) {
        if (!res.success) throw new Error(res.error && res.error.message);
        renderHistorico(res.data);
      }).catch(function (e) {
        histBody.innerHTML = "";
        histBody.appendChild(tpl.el("div", { style: "padding:20px 24px;font-size:0.82rem;color:var(--kair-text-muted);", textContent: "No se pudo leer el archivo histórico de la carpeta: " + e.message }));
      });
    } else {
      histBody.innerHTML = "";
      histBody.appendChild(tpl.el("div", { style: "padding:20px 24px;font-size:0.82rem;color:var(--kair-text-muted);", textContent: "El archivo histórico de la carpeta solo está disponible en la aplicación de escritorio." }));
    }

    function renderHistorico(data) {
      histBody.innerHTML = "";
      if (!data.found || !data.entries || data.entries.length === 0) {
        histBody.appendChild(tpl.el("div", { style: "padding:20px 24px;font-size:0.82rem;color:var(--kair-text-muted);", textContent: "No se encontró archivo histórico en la carpeta 4.2.4 de esta empresa." }));
        return;
      }
      var rows = tpl.el("div", { className: "kair-insp-rows" });
      data.entries.forEach(function (en) {
        var row = tpl.el("div", { className: "kair-insp-row" });
        row.appendChild(tpl.el("span", {
          className: "kair-insp-row__icon",
          style: "background-color:var(--kair-text-muted);color:var(--kair-card);"
        }, [tpl.icon("archive", 18)]));
        var fileBits = [];
        if (en.photoCount) fileBits.push(en.photoCount + (en.photoCount === 1 ? " foto" : " fotos"));
        var docCount = en.files.length - en.photoCount;
        if (docCount > 0) fileBits.push(docCount + (docCount === 1 ? " formato" : " formatos"));
        var meta = [
          en.sede,
          en.fecha ? tpl.formatDate(en.fecha, { short: true }) : (en.fechaLabel || ""),
          fileBits.join(" · ")
        ].filter(Boolean).join("  ·  ");
        row.appendChild(tpl.el("div", { className: "kair-insp-row__body" }, [
          tpl.el("div", { className: "kair-insp-row__head" }, [
            tpl.el("span", { className: "kair-insp-row__title", textContent: en.kind === "visita" ? "Visita de inspección" : (en.files[0] ? en.files[0].name : "Archivo") })
          ]),
          tpl.el("div", { className: "kair-insp-row__meta", textContent: meta })
        ]));
        row.appendChild(tpl.el("div", { className: "kair-insp-row__actions" }, [
          tpl.el("button", {
            type: "button", className: "kair-insp-row__btn", title: "Abrir carpeta",
            onclick: function () {
              api.abrirRuta(en.path).then(function (r) {
                if (!r.success) tpl.toast("Error", (r.error && r.error.message) || "No se pudo abrir", "error");
              });
            }
          }, [tpl.icon("folder-open", 15)])
        ]));
        rows.appendChild(row);
      });
      histBody.appendChild(rows);
      tpl.refreshIcons();
    }

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
        renderList();
      }).catch(function (e) {
        listBody.innerHTML = "";
        listBody.appendChild(tpl.el("div", { style: "padding:24px;color:var(--kair-danger);", textContent: e.message }));
      });
    }

    function renderList() {
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

      counter.textContent = filtered.length + (filtered.length === 1 ? " inspección encontrada" : " inspecciones encontradas");
      listBody.innerHTML = "";

      if (filtered.length === 0) {
        var btn = tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--primary", style: "margin-top:12px;", onclick: function () { ctx.go({ name: "hub" }); } }, [tpl.icon("plus", 14), tpl.el("span", { textContent: "Nueva inspección" })]);
        listBody.appendChild(tpl.emptyState(
          "file-text",
          allList.length === 0 ? "Sin inspecciones registradas" : "Sin resultados para el filtro",
          allList.length === 0 ? "Realice su primera inspección desde el centro de inspecciones." : "Ajuste los filtros o el término de búsqueda.",
          btn
        ));
        tpl.refreshIcons();
        return;
      }

      var rows = tpl.el("div", { className: "kair-insp-rows" });
      filtered.forEach(function (i) {
        var meta = T.INSPECTION_TYPES[i.type];
        var accent = (meta && meta.accent) || "var(--kair-primary)";

        var row = tpl.el("div", { className: "kair-insp-row" });

        /* Icono del tipo */
        row.appendChild(tpl.el("span", {
          className: "kair-insp-row__icon",
          style: "background-color:" + accent + "1a;color:" + accent + ";"
        }, [iconFor(i.type, 18)]));

        /* Título + código + meta */
        var body = tpl.el("div", { className: "kair-insp-row__body" }, [
          tpl.el("div", { className: "kair-insp-row__head" }, [
            tpl.el("span", { className: "kair-insp-row__title", textContent: (meta && meta.title) || i.title }),
            tpl.el("span", { className: "kair-insp-row__code", textContent: i.code || (meta && meta.code) || "" })
          ]),
          tpl.el("div", { className: "kair-insp-row__meta", textContent: buildMeta(i) })
        ]);
        row.appendChild(body);

        /* Estado */
        row.appendChild(tpl.el("div", { className: "kair-insp-row__status" }, [tpl.statusPill(i.status)]));

        /* Acciones por icono */
        var actions = tpl.el("div", { className: "kair-insp-row__actions" }, [
          tpl.el("button", { type: "button", className: "kair-insp-row__btn", title: "Ver detalle", onclick: function () { ctx.go({ name: "detalle", inspectionId: i.id }); } }, [tpl.icon("eye", 15)]),
          tpl.el("button", { type: "button", className: "kair-insp-row__btn", title: "Editar", onclick: function () { ctx.go({ name: "editar", inspectionType: i.type, inspectionId: i.id }); } }, [tpl.icon("pencil", 15)]),
          tpl.el("button", { type: "button", className: "kair-insp-row__btn", title: "Exportar PDF", onclick: function () { exportOne(i.id, "pdf"); } }, [tpl.icon("file-down", 15)]),
          tpl.el("button", { type: "button", className: "kair-insp-row__btn", title: "Exportar Excel", onclick: function () { exportOne(i.id, "xlsx"); } }, [tpl.icon("sheet", 15)]),
          tpl.el("button", { type: "button", className: "kair-insp-row__btn kair-insp-row__btn--danger", title: "Eliminar", onclick: function () { del(i.id); } }, [tpl.icon("trash-2", 15)])
        ]);
        row.appendChild(actions);
        rows.appendChild(row);
      });
      listBody.appendChild(rows);
      tpl.refreshIcons();
    }

    function buildMeta(i) {
      var parts = [];
      if (i.performedBy) parts.push(i.performedBy);
      if (i.site) parts.push(i.site);
      parts.push(tpl.formatDate(i.date, { short: true }));
      return parts.join("  ·  ");
    }

    function iconFor(type) {
      switch (type) {
        case "botiquin": return tpl.icon("clipboard-list", 18);
        case "extintores": return tpl.icon("flame", 18);
        case "instalaciones": return tpl.icon("building-2", 18);
        case "equipos_emergencia": return tpl.icon("siren", 18);
        default: return tpl.icon("file-text", 18);
      }
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
        renderList();
      }).catch(function (e) { tpl.toast("Error", e.message, "error"); });
    }

    tpl.refreshIcons();
  }

  global.KairViews = global.KairViews || {};
  global.KairViews.Historial = Historial;
})(typeof window !== "undefined" ? window : this);
