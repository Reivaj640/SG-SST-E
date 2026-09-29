/* ============================================================
 * K+AIR · Vista Hub (Dashboard de Inspecciones)
 * Patrón A — Submodule Home Premium (📦796)
 * Referencia: preview premium 2026-09-21 (header estándar v7 +
 * hero del programa con donut + 4 KPIs + formatos + recientes/avance)
 * Estructura: Header v7 con pestañas · Hero programa anual ·
 *             4 metric cards · Nueva inspección (formatos) ·
 *             Recientes + Avance del programa
 * ============================================================ */
(function (global) {
  "use strict";

  var T = global.KairInspectionTypes;
  var tpl = global.KairTemplates;
  var api = global.KairAPI;

  function Hub(root, ctx) {
    var store = global.KairStore.getState();
    var currentYear = new Date().getFullYear();

    /* ── Layout principal (kair-app · flex chain) ── */
    var wrap = tpl.el("div", { className: "kair-app" });
    wrap.style.cssText = "height:100%;display:flex;flex-direction:column;min-height:0;";

    /* ── Header estándar premium v7 + pestañas ── */
    wrap.appendChild(tpl.buildHeader({
      title: "Inspecciones Sistemáticas",
      subtitle: "Centro de inspecciones a instalaciones, máquinas, equipos y elementos de emergencia.",
      companyName: store.companyName,
      titleIcon: "clipboard-check",
      onBack: typeof ctx.backToModule === "function" ? ctx.backToModule : null,
      backTitle: "Volver a Gestión de Peligros",
      actions: [
        {
          label: "Ver Historial",
          variant: "secondary",
          icon: tpl.icon("history", 15),
          onClick: function () { ctx.go({ name: "historial" }); }
        },
        {
          label: "Nueva Inspección",
          variant: "primary",
          icon: tpl.icon("plus", 15),
          onClick: function () {
            var target = document.getElementById("insp-formatos");
            if (target && target.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      ],
      tabs: [
        { id: "hub", label: "Dashboard", active: true, onClick: function () { ctx.go({ name: "hub" }); } },
        { id: "dashboard", label: "Programa anual", onClick: function () { ctx.go({ name: "dashboard" }); } },
        { id: "historial", label: "Historial", onClick: function () { ctx.go({ name: "historial" }); } }
      ]
    }));

    /* ── Main scrollable ── */
    var main = tpl.el("main", { className: "insp-hub-home" });
    main.style.cssText = "flex:1;min-height:0;overflow-y:auto;padding:1.25rem 1.5rem 1.5rem;box-sizing:border-box;";

    /* 1. Hero del programa anual (donut + acciones) */
    main.appendChild(buildHeroCard());

    /* 2. 4 metric cards */
    main.appendChild(buildMetricStrip());

    /* 3. Nueva inspección (formatos oficiales) */
    main.appendChild(buildFormatos(ctx));

    /* 4. Recientes + Avance del programa */
    var bottom = tpl.el("div", { className: "kair-hub-bottom" });
    bottom.appendChild(buildRecientes(ctx));
    bottom.appendChild(buildAvanceCard());
    main.appendChild(bottom);

    wrap.appendChild(main);
    root.appendChild(wrap);

    /* ── Carga de datos ── */
    loadInspectionStats();
    loadProgramStats();

    /* ══════════════ Hero del programa anual ══════════════ */
    function buildHeroCard() {
      var hero = tpl.el("div", { className: "kair-hero-card kair-hero-card--program" });

      /* Izquierda: eyebrow + título + objetivo + acciones */
      var body = tpl.el("div", { className: "kair-hero-card__body kair-hero-card__main" }, [
        tpl.el("span", { className: "kair-hero-card__eyebrow", textContent: "PROGRAMA DE INSPECCIONES · SG-SST" }),
        tpl.el("h2", { className: "kair-hero-card__title", id: "insp-hero-title", textContent: "Programa Anual " + currentYear }),
        tpl.el("p", { className: "kair-hero-card__desc", id: "insp-hero-desc", textContent: "Cargando objetivo del programa..." })
      ]);

      var actions = tpl.el("div", { className: "kair-hero-card__actions" }, [
        tpl.el("button", {
          type: "button",
          className: "kair-hero-card__btn kair-hero-card__btn--white",
          onclick: function () { ctx.go({ name: "dashboard" }); }
        }, [tpl.icon("calendar-days", 15), document.createTextNode("Abrir programa")]),
        tpl.el("button", {
          type: "button",
          className: "kair-hero-card__btn kair-hero-card__btn--outline",
          onclick: function () { exportProgram(); }
        }, [tpl.icon("file-down", 15), document.createTextNode("Exportar XLSX")])
      ]);
      body.appendChild(actions);
      hero.appendChild(body);

      /* Derecha: donut de cumplimiento + meses programados/cumplidos */
      var side = tpl.el("div", { className: "kair-hero-card__side" });

      var donutWrap = tpl.el("div", { className: "kair-hero-card__donut", id: "insp-hero-donut" });
      donutWrap.appendChild(tpl.el("span", { className: "kair-hero-card__donut-pct", id: "insp-hero-pct", textContent: "—%" }));
      donutWrap.appendChild(tpl.el("span", { className: "kair-hero-card__donut-lbl", textContent: "INDICADOR" }));
      side.appendChild(donutWrap);

      var stats = tpl.el("div", { className: "kair-hero-card__stats" }, [
        tpl.el("div", { className: "kair-hero-card__stat" }, [
          tpl.el("span", { className: "kair-hero-card__stat-val", id: "insp-hero-prog", textContent: "—" }),
          tpl.el("span", { className: "kair-hero-card__stat-lbl", textContent: "Meses programados" })
        ]),
        tpl.el("div", { className: "kair-hero-card__stat" }, [
          tpl.el("span", { className: "kair-hero-card__stat-val", id: "insp-hero-done", textContent: "—" }),
          tpl.el("span", { className: "kair-hero-card__stat-lbl", textContent: "Cumplidos" })
        ])
      ]);
      side.appendChild(stats);
      hero.appendChild(side);

      return hero;
    }

    /* Donut SVG theme-aware (relleno proporcional al porcentaje) */
    function renderDonut(pct) {
      var host = document.getElementById("insp-hero-donut");
      if (!host) return;
      host.innerHTML = "";
      var size = 132, stroke = 12, r = (size - stroke) / 2, c = 2 * Math.PI * r;
      var filled = Math.max(0, Math.min(100, pct));
      var svgNS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("width", String(size));
      svg.setAttribute("height", String(size));
      svg.setAttribute("viewBox", "0 0 " + size + " " + size);
      svg.classList.add("kair-hero-card__donut-svg");

      var bg = document.createElementNS(svgNS, "circle");
      bg.setAttribute("cx", String(size / 2));
      bg.setAttribute("cy", String(size / 2));
      bg.setAttribute("r", String(r));
      bg.setAttribute("fill", "none");
      bg.setAttribute("stroke", "rgba(255,255,255,0.18)");
      bg.setAttribute("stroke-width", String(stroke));
      svg.appendChild(bg);

      var arc = document.createElementNS(svgNS, "circle");
      arc.setAttribute("cx", String(size / 2));
      arc.setAttribute("cy", String(size / 2));
      arc.setAttribute("r", String(r));
      arc.setAttribute("fill", "none");
      arc.setAttribute("stroke", "#8ec5ff");
      arc.setAttribute("stroke-width", String(stroke));
      arc.setAttribute("stroke-linecap", "round");
      arc.setAttribute("stroke-dasharray", String(c));
      arc.setAttribute("stroke-dashoffset", String(c * (1 - filled / 100)));
      arc.setAttribute("transform", "rotate(-90 " + size / 2 + " " + size / 2 + ")");
      svg.appendChild(arc);

      host.appendChild(svg);
      var pctEl = tpl.el("span", { className: "kair-hero-card__donut-pct", textContent: Math.round(filled) + "%" });
      host.appendChild(pctEl);
      host.appendChild(tpl.el("span", { className: "kair-hero-card__donut-lbl", textContent: "INDICADOR" }));
    }

    /* ══════════════ 4 metric cards ══════════════ */
    function buildMetricStrip() {
      var strip = tpl.el("div", { className: "kair-metric-strip kair-metric-strip--4" });

      var cards = [
        { id: "insp-m-total",  tone: "blue",  icon: "clipboard-list", label: "Inspecciones totales",      value: "—", sub: "Registros acumulados" },
        { id: "insp-m-month",  tone: "green", icon: "calendar-check", label: "Realizadas este mes",       value: "—", sub: "En " + monthName() },
        { id: "insp-m-prog",   tone: "amber", icon: "calendar-days",  label: "Meses programados",         value: "—", sub: "— cumplidos" },
        { id: "insp-m-ind",    tone: "rose",  icon: "gauge",          label: "Indicador de cumplimiento", value: "—", sub: "— actividades ejecutadas" }
      ];

      cards.forEach(function (c) {
        var card = tpl.el("div", { className: "kair-metric-card" }, [
          tpl.el("div", { className: "kair-metric-card__icon kair-metric-card__icon--" + c.tone }, [
            tpl.icon(c.icon, 20)
          ]),
          tpl.el("div", { className: "kair-metric-card__body" }, [
            tpl.el("div", { className: "kair-metric-card__value", id: c.id, textContent: c.value }),
            tpl.el("div", { className: "kair-metric-card__label", textContent: c.label }),
            tpl.el("div", { className: "kair-metric-card__sub", id: c.id + "-sub", textContent: c.sub })
          ])
        ]);
        strip.appendChild(card);
      });

      return strip;
    }

    function monthName() {
      try {
        return new Date().toLocaleDateString("es-CO", { month: "long" });
      } catch (e) { return "el mes en curso"; }
    }

    /* ══════════════ Formatos de inspección ══════════════ */
    function buildFormatos(ctx) {
      var section = tpl.el("div", { className: "kair-module-section", id: "insp-formatos" });
      section.appendChild(tpl.el("h2", { className: "kair-section-title", textContent: "Nueva inspección" }));
      section.appendChild(tpl.el("p", { className: "kair-section-desc", textContent: "Inicia un registro con formato oficial en un clic." }));

      var grid = tpl.el("div", { className: "kair-module-grid kair-module-grid--formats" });
      T.INSPECTION_TYPE_LIST.forEach(function (t) {
        var card = tpl.el("button", {
          type: "button",
          className: "kair-module-card kair-module-card--format",
          onclick: function () { ctx.go({ name: "nueva", inspectionType: t.type }); }
        }, [
          tpl.el("div", {
            className: "kair-module-card__icon",
            style: "background-color:" + t.accent + "1a;color:" + t.accent + ";"
          }, [iconFor(t.type, 24)]),
          tpl.el("div", { className: "kair-module-card__body" }, [
            tpl.el("div", { className: "kair-module-card__head" }, [
              tpl.el("span", { className: "kair-module-card__code", textContent: t.code }),
              tpl.el("span", { className: "kair-module-card__rev", textContent: t.revision })
            ]),
            tpl.el("h3", { className: "kair-module-card__title", textContent: t.shortTitle }),
            tpl.el("p", { className: "kair-module-card__desc", textContent: t.description })
          ]),
          tpl.el("div", { className: "kair-module-card__start" }, [
            document.createTextNode("Comenzar"),
            tpl.icon("arrow-right", 16)
          ])
        ]);
        grid.appendChild(card);
      });
      section.appendChild(grid);
      return section;
    }

    /* ══════════════ Recientes ══════════════ */
    function buildRecientes(ctx) {
      var section = tpl.el("div", { className: "kair-module-section" });

      var head = tpl.el("div", { className: "kair-section-head" }, [
        tpl.el("h2", { className: "kair-section-title", textContent: "Registros recientes" }),
        tpl.el("button", {
          type: "button",
          className: "kair-btn kair-btn-ghost",
          onclick: function () { ctx.go({ name: "historial" }); }
        }, [
          document.createTextNode("Ver historial"),
          tpl.icon("arrow-right", 14)
        ])
      ]);
      section.appendChild(head);

      var card = tpl.el("div", { className: "kair-card" });
      var body = tpl.el("div", { className: "kair-card__body kair-card__body--flush" });
      body.appendChild(tpl.loadingBlock("Cargando..."));
      card.appendChild(body);
      section.appendChild(card);

      loadInto(body);
      return section;

      function loadInto(target) {
        api.listInspections({}).then(function (res) {
          if (!res.success) throw new Error(res.error && res.error.message);
          var list = (res.data.inspections || []).slice(0, 5);
          target.innerHTML = "";
          if (list.length === 0) {
            target.appendChild(tpl.emptyState("file-text", "Sin inspecciones registradas", "Cuando realice su primera inspección aparecerá aquí para acceso rápido."));
            tpl.refreshIcons();
            return;
          }
          var wrap = tpl.el("div", { className: "kair-table-wrap" });
          var table = tpl.el("table", { className: "kair-table" });
          table.appendChild(tpl.el("thead", {}, [tpl.el("tr", {}, [
            tpl.el("th", { textContent: "Tipo" }),
            tpl.el("th", { textContent: "Fecha" }),
            tpl.el("th", { textContent: "Realizada por" }),
            tpl.el("th", { textContent: "Sede / Sitio" }),
            tpl.el("th", { textContent: "Estado" }),
            tpl.el("th", { textContent: "Acciones", style: "text-align:right;" })
          ])]));
          var tbody = tpl.el("tbody");
          list.forEach(function (r) {
            var meta = T.INSPECTION_TYPES[r.type];
            var tr = tpl.el("tr");
            var tdTipo = tpl.el("td");
            tdTipo.appendChild(tpl.el("div", { className: "kair-flex kair-gap-2" }, [
              tpl.el("span", {
                className: "kair-type-icon",
                style: "width:28px;height:28px;background-color:" + (meta && meta.accent || "#174ea6") + "1a;color:" + (meta && meta.accent || "#174ea6") + ";"
              }, [iconFor(r.type, 16)]),
              tpl.el("div", {}, [
                tpl.el("div", { style: "font-weight:500;color:var(--kair-text);font-size:0.85rem;", textContent: (meta && meta.shortTitle) || r.title }),
                tpl.el("div", { style: "font-size:0.7rem;color:var(--kair-text-soft);", textContent: r.code })
              ])
            ]));
            tr.appendChild(tdTipo);
            tr.appendChild(tpl.el("td", {}, [tpl.el("span", { className: "kair-text-xs kair-text-muted", textContent: tpl.formatDate(r.date, { short: true }) })]));
            tr.appendChild(tpl.el("td", {}, [tpl.el("span", { className: "kair-text-sm", style: "color:var(--kair-text);", textContent: r.performedBy })]));
            tr.appendChild(tpl.el("td", {}, [tpl.el("span", { className: "kair-text-xs kair-text-muted", textContent: r.site || "—" })]));
            tr.appendChild(tpl.el("td", {}, [tpl.statusPill(r.status)]));
            var tdAct = tpl.el("td", { style: "text-align:right;" });
            tdAct.appendChild(tpl.el("button", {
              type: "button",
              className: "kair-btn kair-btn-ghost",
              style: "padding:4px 10px;font-size:0.78rem;",
              onclick: function () { ctx.go({ name: "detalle", inspectionId: r.id }); }
            }, [tpl.icon("eye", 14), tpl.el("span", { textContent: "Ver detalle" })]));
            tr.appendChild(tdAct);
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          wrap.appendChild(table);
          target.appendChild(wrap);
          tpl.refreshIcons();
        }).catch(function (e) {
          target.innerHTML = "";
          target.appendChild(tpl.el("div", { style: "padding:24px;color:var(--kair-danger);", textContent: e.message }));
        });
      }
    }

    /* ══════════════ Avance del programa ══════════════ */
    function buildAvanceCard() {
      var section = tpl.el("div", { className: "kair-module-section" });

      var head = tpl.el("div", { className: "kair-section-head" }, [
        tpl.el("h2", { className: "kair-section-title", textContent: "Avance del programa" }),
        tpl.el("button", {
          type: "button",
          className: "kair-btn kair-btn-ghost",
          onclick: function () { ctx.go({ name: "dashboard" }); }
        }, [
          document.createTextNode("Ver programa"),
          tpl.icon("arrow-right", 14)
        ])
      ]);
      section.appendChild(head);

      var card = tpl.el("div", { className: "kair-card" });
      var body = tpl.el("div", { className: "kair-card__body" });
      body.appendChild(tpl.loadingBlock("Cargando programa..."));
      card.appendChild(body);
      section.appendChild(card);
      return section;
    }

    function renderAvance(program) {
      var host = document.querySelector(".kair-hub-bottom .kair-module-section:last-child .kair-card__body");
      if (!host) return;
      host.innerHTML = "";
      var activities = (program && program.activities) || [];
      if (!activities.length) {
        host.appendChild(tpl.el("div", { className: "kair-chart-empty", textContent: "Sin actividades en el programa." }));
        return;
      }
      activities.forEach(function (a) {
        var pct = Math.round((a.percentage || 0) * 100);
        var row = tpl.el("div", { className: "kair-avance-row" }, [
          tpl.el("div", { className: "kair-avance-row__top" }, [
            tpl.el("span", { className: "kair-avance-row__name", textContent: a.activity }),
            tpl.el("span", { className: "kair-avance-row__pct", textContent: pct + "%" })
          ]),
          tpl.el("div", { className: "kair-avance-row__track" }, [
            tpl.el("div", {
              className: "kair-avance-row__fill" + (pct === 100 ? " is-full" : ""),
              style: "width:" + pct + "%;"
            })
          ])
        ]);
        host.appendChild(row);
      });
    }

    /* ══════════════ Stats de inspecciones ══════════════ */
    function loadInspectionStats() {
      api.listInspections({}).then(function (res) {
        if (!res.success) throw new Error(res.error && res.error.message);
        var inspections = res.data.inspections || [];

        var now = new Date();
        var firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        var totalMonth = inspections.filter(function (i) {
          return new Date(i.date) >= firstOfMonth;
        }).length;

        var totalEl = document.getElementById("insp-m-total");
        if (totalEl) totalEl.textContent = String(inspections.length);
        var monthEl = document.getElementById("insp-m-month");
        if (monthEl) monthEl.textContent = String(totalMonth);
      }).catch(function (e) {
        console.error("[insp-hub] loadInspectionStats error:", e);
      });
    }

    /* ══════════════ Stats del programa ══════════════ */
    function loadProgramStats() {
      api.getProgram(currentYear, store.companyId).then(function (res) {
        if (!res.success) throw new Error(res.error && res.error.message);
        var program = res.data.program;
        if (global.KairStore) global.KairStore.setProgram(program);

        var programmed = 0, completed = 0, executedActivities = 0;
        var activities = (program && program.activities) || [];
        activities.forEach(function (a) {
          T.MONTHS.forEach(function (m) {
            var v = a.monthlySchedule[m];
            if (v === "p" || v === "c") programmed++;
            if (v === "c") completed++;
          });
          if ((a.percentage || 0) >= 1) executedActivities++;
        });
        var indicator = programmed > 0 ? Math.round((completed / programmed) * 100) : 0;

        /* Hero */
        var descEl = document.getElementById("insp-hero-desc");
        if (descEl && program && program.generalObjective) {
          descEl.textContent = program.generalObjective;
        }
        renderDonut(indicator);
        var progEl = document.getElementById("insp-hero-prog");
        if (progEl) progEl.textContent = String(programmed);
        var doneEl = document.getElementById("insp-hero-done");
        if (doneEl) doneEl.textContent = String(completed);

        /* KPIs */
        var progVal = document.getElementById("insp-m-prog");
        if (progVal) progVal.textContent = String(programmed);
        var progSub = document.getElementById("insp-m-prog-sub");
        if (progSub) progSub.textContent = completed + " cumplidos";
        var indVal = document.getElementById("insp-m-ind");
        if (indVal) indVal.textContent = indicator + "%";
        var indSub = document.getElementById("insp-m-ind-sub");
        if (indSub) indSub.textContent = executedActivities + "/" + activities.length + " actividades ejecutadas";

        /* Avance */
        renderAvance(program);
      }).catch(function (e) {
        console.error("[insp-hub] loadProgramStats error:", e);
        renderAvance(null);
      });
    }

    function exportProgram() {
      tpl.toast("Exportando", "Generando Excel del programa...", "info");
      api.exportProgram(currentYear, store.companyId).then(function (res) {
        if (!res.success) throw new Error(res.error && res.error.message);
        if (global.KairExport) global.KairExport.downloadBlob(res.data.blob, res.data.filename);
        tpl.toast("Éxito", "Programa exportado a Excel", "success");
      }).catch(function (e) {
        tpl.toast("Error", e.message, "error");
      });
    }

    function iconFor(type, size) {
      switch (type) {
        case "botiquin": return tpl.icon("clipboard-list", size);
        case "extintores": return tpl.icon("flame", size);
        case "instalaciones": return tpl.icon("building-2", size);
        case "equipos_emergencia": return tpl.icon("siren", size);
        default: return tpl.icon("file-text", size);
      }
    }

    tpl.refreshIcons();
  }

  global.KairViews = global.KairViews || {};
  global.KairViews.Hub = Hub;
})(typeof window !== "undefined" ? window : this);
