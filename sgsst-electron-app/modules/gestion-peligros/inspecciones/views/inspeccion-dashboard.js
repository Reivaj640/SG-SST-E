/* ============================================================
 * K+AIR · Vista Dashboard (Programa de Inspecciones)
 * Patrón A — Dashboard Operacional
 * Estructura: Header · KPI Strip · Tabla anual · Objetivo + Tipos
 * ============================================================ */
(function (global) {
  "use strict";

  var T = global.KairInspectionTypes;
  var tpl = global.KairTemplates;
  var api = global.KairAPI;

  function Dashboard(root, ctx) {
    var store = global.KairStore.getState();
    var currentProgram = null;

    var wrap = tpl.el("div", { className: "kair-app", style: "min-height:100vh;display:flex;flex-direction:column;" });
    wrap.appendChild(tpl.buildHeader({
      title: "Programa de Inspecciones SG-SST",
      subtitle: "Programación anual " + new Date().getFullYear() + " · Sistema de Gestión de Seguridad y Salud en el Trabajo",
      companyName: store.companyName,
      contextLabel: "SG-SST",
      actions: [
        { label: "Exportar Programa", variant: "secondary", icon: tpl.icon("file-down", 15), onClick: function () { exportProgram(); } },
        { label: "Nueva Inspección", variant: "primary", icon: tpl.icon("plus", 15), onClick: function () { ctx.go({ name: "hub" }); } }
      ],
      tabs: [
        { id: "dashboard", label: "Programa", active: true, onClick: function () { ctx.go({ name: "dashboard" }); } },
        { id: "hub", label: "Inspecciones", onClick: function () { ctx.go({ name: "hub" }); } },
        { id: "historial", label: "Historial", onClick: function () { ctx.go({ name: "historial" }); } }
      ]
    }));

    var main = tpl.el("main", { className: "kair-main" });
    main.appendChild(tpl.loadingBlock("Cargando programa..."));
    wrap.appendChild(main);
    root.appendChild(wrap);

    loadProgram();

    function loadProgram() {
      api.getProgram(new Date().getFullYear(), store.companyId).then(function (res) {
        if (!res.success) {
          main.innerHTML = "";
          main.appendChild(tpl.buildCard("Error", tpl.el("div", { textContent: (res.error && res.error.message) || "Error", style: "color:#dc3545;" })));
          return;
        }
        currentProgram = res.data.program;
        if (global.KairStore) global.KairStore.setProgram(currentProgram);
        renderProgram(currentProgram);
      }).catch(function (e) {
        main.innerHTML = "";
        main.appendChild(tpl.buildCard("Error", tpl.el("div", { textContent: e.message, style: "color:#dc3545;" })));
      });
    }

    function renderProgram(program) {
      currentProgram = program;
      main.innerHTML = "";

      var programmed = 0, completed = 0, inProgress = 0;
      program.activities.forEach(function (a) {
        T.MONTHS.forEach(function (m) {
          var v = a.monthlySchedule[m];
          if (v === "p" || v === "c") programmed++;
          if (v === "c") completed++;
          else if (v === "p") inProgress++;
        });
      });
      var pending = programmed - completed;
      var indicator = programmed > 0 ? Math.round((completed / programmed) * 1000) / 10 : 0;

      main.appendChild(tpl.buildKpiStrip([
        { value: indicator + "%", label: "Indicador de Cumplimiento", subdata: completed + " de " + programmed + " programadas", icon: tpl.icon("calendar-clock", 20), tone: "primary" },
        { value: completed, label: "Inspecciones Realizadas", subdata: "Inspecciones completadas", icon: tpl.icon("check-circle-2", 20), tone: "success" },
        { value: inProgress, label: "En Proceso", subdata: "Programadas pendientes", icon: tpl.icon("clock", 20), tone: "warning" },
        { value: pending, label: "Sin Realizar", subdata: "Faltan por ejecutar", icon: tpl.icon("alert-triangle", 20), tone: "danger" }
      ]));

      var tableCard = tpl.el("div", { className: "kair-card" });
      tableCard.appendChild(tpl.el("div", { className: "kair-card__header" }, [
        tpl.el("h2", { className: "kair-card__title", textContent: "Programación Anual de Inspecciones" }),
        tpl.el("div", { className: "kair-flex kair-gap-3 kair-text-xs kair-text-muted" }, [
          tpl.el("span", { className: "kair-flex kair-gap-2" }, [
            tpl.el("span", { className: "kair-month-cell kair-month-cell--p", style: "width:18px;height:18px;cursor:default;", textContent: "P" }),
            tpl.el("span", { textContent: "Programada" })
          ]),
          tpl.el("span", { className: "kair-flex kair-gap-2" }, [
            tpl.el("span", { className: "kair-month-cell kair-month-cell--c", style: "width:18px;height:18px;cursor:default;", textContent: "C" }),
            tpl.el("span", { textContent: "Cumplida" })
          ])
        ])
      ]));

      var tableWrap = tpl.el("div", { className: "kair-table-wrap", style: "max-height:520px;" });
      var table = tpl.el("table", { className: "kair-table kair-program-table" });
      table.appendChild(tpl.el("thead", {}, [tpl.el("tr", {}, [
        tpl.el("th", { textContent: "Actividad" }),
        tpl.el("th", { textContent: "Responsable" }),
        T.MONTHS.map(function (m) { return tpl.el("th", { "data-month": m, textContent: m }); }),
        tpl.el("th", { textContent: "%", style: "text-align:center;" }),
        tpl.el("th", { textContent: "Estado" })
      ].reduce(function (acc, el) { if (Array.isArray(el)) acc.push.apply(acc, el); else acc.push(el); return acc; }, []))]));

      var tbody = tpl.el("tbody");
      program.activities.forEach(function (a) {
        var pct = Math.round((a.percentage || 0) * 100);
        var tr = tpl.el("tr");

        var actCell = tpl.el("td");
        actCell.appendChild(tpl.el("div", { className: "activity-cell", textContent: a.activity }));
        var sub = (a.specificObjective || "").length > 80 ? a.specificObjective.slice(0, 80) + "..." : (a.specificObjective || "");
        actCell.appendChild(tpl.el("span", { className: "activity-cell__sub", textContent: sub }));
        tr.appendChild(actCell);

        tr.appendChild(tpl.el("td", {}, [tpl.el("span", { className: "kair-text-xs kair-text-muted", textContent: a.responsible })]));

        T.MONTHS.forEach(function (m) {
          var v = a.monthlySchedule[m] || "";
          var td = tpl.el("td", { "data-month": m });
          td.appendChild(tpl.el("button", {
            type: "button",
            "aria-label": "Toggle " + m,
            className: "kair-month-cell kair-month-cell--" + (v || "empty"),
            textContent: v === "p" ? "P" : v === "c" ? "C" : "",
            onclick: function () { toggleMonth(a, m); }
          }));
          tr.appendChild(td);
        });

        var pctColor = pct === 100 ? "#28a745" : pct > 0 ? "#174ea6" : "#5a6378";
        tr.appendChild(tpl.el("td", { style: "text-align:center;" }, [tpl.el("span", { style: "font-weight:600;color:" + pctColor + ";", textContent: pct + "%" })]));
        var statusTd = tpl.el("td");
        statusTd.appendChild(tpl.statusPill(a.status));
        tr.appendChild(statusTd);

        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);

      var tableBody = tpl.el("div", { className: "kair-card__body kair-card__body--flush" });
      tableBody.appendChild(tableWrap);
      tableCard.appendChild(tableBody);
      main.appendChild(tableCard);

      var grid = tpl.el("div", { className: "kair-grid", style: "grid-template-columns:1fr 2fr;" });

      var objBody = tpl.el("div", {}, [
        tpl.el("p", { style: "font-size:0.875rem;color:#1a1a2e;line-height:1.6;", textContent: program.generalObjective }),
        tpl.el("div", { style: "margin-top:16px;padding-top:16px;border-top:1px solid #dee2e6;" }, [
          tpl.el("h3", { style: "font-size:0.85rem;font-weight:600;color:#1a1a2e;margin-bottom:8px;", textContent: "Objetivos Específicos" }),
          tpl.el("ul", { style: "list-style:disc;padding-left:18px;font-size:0.8125rem;color:#5a6378;line-height:1.7;" }, [
            tpl.el("li", { textContent: "Identificar condiciones inseguras en los lugares de trabajo." }),
            tpl.el("li", { textContent: "Evaluar el cumplimiento normativo (Decreto 1072 de 2015)." }),
            tpl.el("li", { textContent: "Proponer mejoras con hallazgos y recomendaciones." }),
            tpl.el("li", { textContent: "Promover una cultura de prevención en SST." })
          ])
        ])
      ]);
      grid.appendChild(tpl.buildCard("Objetivo General", objBody));

      var typesBody = tpl.el("div", { className: "kair-grid kair-grid--2" });
      T.INSPECTION_TYPE_LIST.forEach(function (t) {
        var card = tpl.el("button", {
          type: "button",
          className: "kair-type-card",
          onclick: function () { ctx.go({ name: "nueva", inspectionType: t.type }); }
        }, [
          tpl.el("div", { className: "kair-flex kair-gap-3" }, [
            tpl.el("span", { className: "kair-type-icon", style: "width:36px;height:36px;background-color:" + t.accent + "1a;color:" + t.accent + ";" }, [iconFor(t.type, 18)]),
            tpl.el("div", { style: "flex:1;min-width:0;" }, [
              tpl.el("div", { className: "kair-flex kair-gap-2" }, [
                tpl.el("span", { style: "font-weight:600;font-size:0.9rem;color:#1a1a2e;", textContent: t.shortTitle }),
                tpl.el("span", { style: "font-size:0.65rem;font-weight:700;color:#5a6378;background-color:#f1f3f5;padding:1px 6px;border-radius:4px;", textContent: t.code })
              ]),
              tpl.el("p", { style: "font-size:0.75rem;color:#5a6378;margin-top:4px;line-height:1.4;", textContent: t.description })
            ])
          ])
        ]);
        typesBody.appendChild(card);
      });

      var typesHeaderExtra = tpl.el("button", {
        type: "button",
        className: "kair-header__action kair-header__action--ghost",
        onclick: function () { ctx.go({ name: "hub" }); }
      }, [
        document.createTextNode("Ver todas"),
        tpl.icon("chevron-right", 14)
      ]);
      grid.appendChild(tpl.buildCard("Tipos de Inspección", typesBody, typesHeaderExtra));
      main.appendChild(grid);

      tpl.refreshIcons();
    }

    function toggleMonth(activity, month) {
      if (!currentProgram) return;
      var current = activity.monthlySchedule[month] || "";
      var next = current === "" ? "p" : current === "p" ? "c" : "";
      var newSchedule = {};
      Object.keys(activity.monthlySchedule).forEach(function (k) { newSchedule[k] = activity.monthlySchedule[k]; });
      newSchedule[month] = next;

      var programmed = 0, completed = 0;
      T.MONTHS.forEach(function (m) {
        var v = newSchedule[m];
        if (v === "p" || v === "c") programmed++;
        if (v === "c") completed++;
      });
      var newPct = programmed === 0 ? 0 : Math.round((completed / programmed) * 100) / 100;
      var newStatus = "Sin Iniciar";
      var hasAny = programmed > 0;
      if (newPct >= 1 && completed > 0) newStatus = "Ejecutado";
      else if (hasAny) newStatus = "En Proceso";

      activity.monthlySchedule = newSchedule;
      activity.percentage = newPct;
      activity.status = newStatus;
      renderProgram(currentProgram);

      api.updateActivity(activity.id, { monthlySchedule: newSchedule }).then(function (res) {
        if (!res.success) tpl.toast("Error", "No se pudo guardar el cambio", "error");
        else console.log("[K+AIRSST][PROGRAM][ACTIVITY_UPDATE][SUCCESS] id=" + activity.id + " pct=" + newPct);
      }).catch(function (e) {
        tpl.toast("Error", e.message, "error");
      });
    }

    function exportProgram() {
      tpl.toast("Exportando", "Generando Excel del programa...", "info");
      api.exportProgram(new Date().getFullYear(), store.companyId).then(function (res) {
        if (!res.success) throw new Error(res.error && res.error.message);
        if (global.KairExport) global.KairExport.downloadBlob(res.data.blob, res.data.filename);
        tpl.toast("Éxito", "Programa exportado a Excel", "success");
      }).catch(function (e) {
        tpl.toast("Error", e.message, "error");
      });
    }

    tpl.refreshIcons();
  }

  function iconFor(type, size) {
    switch (type) {
      case "botiquin": return tpl.icon("clipboard-list", size);
      case "extintores": return tpl.icon("flame", size);
      case "instalaciones": return tpl.icon("building-2", size);
      case "equipos_emergencia": return tpl.icon("siren", size);
      default: return tpl.icon("layout-grid", size);
    }
  }

  global.KairViews = global.KairViews || {};
  global.KairViews.Dashboard = Dashboard;
})(typeof window !== "undefined" ? window : this);