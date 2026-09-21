/* ============================================================
 * K+AIR · Vista Hub (Centro de Inspecciones)
 * Patrón A — Submodule Home Premium (📦770+)
 * Estructura: Page-header · Hero con score · 3 metric cards ·
 *              Chart SVG nativo · Module grid (con flecha) · Recientes
 * ============================================================ */
(function (global) {
  "use strict";

  var T = global.KairInspectionTypes;
  var tpl = global.KairTemplates;
  var api = global.KairAPI;

  function Hub(root, ctx) {
    var store = global.KairStore.getState();

    /* ── Layout principal (kair-app · flex chain) ── */
    var wrap = tpl.el("div", { className: "kair-app" });
    wrap.style.cssText = "height:100%;display:flex;flex-direction:column;min-height:0;";

    /* ── Page-header premium (limpio, sin breadcrumb pills) ── */
    wrap.appendChild(buildPageHeader({
      title: "Inspecciones Sistemáticas",
      subtitle: "Centro de inspecciones a instalaciones, máquinas, equipos y elementos de emergencia.",
      actions: [
        {
          label: "Ver Historial",
          variant: "outline",
          icon: tpl.icon("history", 15),
          onClick: function () { ctx.go({ name: "historial" }); }
        },
        {
          label: "Volver",
          variant: "ghost",
          icon: tpl.icon("arrow-left", 15),
          onClick: function () { ctx.go({ name: "dashboard" }); }
        }
      ]
    }));

    /* ── Main scrollable ── */
    var main = tpl.el("main", { className: "insp-hub-home" });
    main.style.cssText = "flex:1;min-height:0;overflow-y:auto;padding:0 1.5rem 1.5rem;box-sizing:border-box;";

    /* 1. Hero con score compuesto */
    main.appendChild(buildHeroCard());

    /* 2. 3 metric cards */
    main.appendChild(buildMetricStrip());

    /* 3. Chart SVG nativo (distribución por tipo) */
    main.appendChild(buildChartCard());

    /* 4. Module grid (4 tipos con flecha) */
    main.appendChild(buildModuleGrid(ctx));

    /* 5. Recientes */
    main.appendChild(buildRecientes());

    wrap.appendChild(main);
    root.appendChild(wrap);

    /* ── Carga de datos ── */
    loadStats();
    loadRecent();

    /* ══════════════ Page-header premium ══════════════ */
    function buildPageHeader(opts) {
      var header = tpl.el("header", { className: "kair-page-header" });

      var badge = tpl.el("div", { className: "kair-badge-ico" }, [tpl.icon("clipboard-check", 22)]);
      header.appendChild(badge);

      var titles = tpl.el("div", { className: "kair-titles" }, [
        tpl.el("h1", { className: "kair-title", textContent: opts.title }),
        tpl.el("p", { className: "kair-sub", textContent: opts.subtitle })
      ]);
      header.appendChild(titles);

      var actions = tpl.el("div", { className: "kair-actions" });
      (opts.actions || []).forEach(function (a) {
        var cls = "kair-btn " + (
          a.variant === "primary" ? "kair-btn-primary" :
          a.variant === "ghost" ? "kair-btn-ghost" :
          "kair-btn-outline"
        );
        var btn = tpl.el("button", { type: "button", className: cls, onclick: a.onClick });
        if (a.icon) btn.appendChild(a.icon);
        btn.appendChild(document.createTextNode(a.label));
        actions.appendChild(btn);
      });
      header.appendChild(actions);

      return header;
    }

    /* ══════════════ Hero card con score ══════════════ */
    function buildHeroCard() {
      var hero = tpl.el("div", { className: "kair-hero-card" });

      var scoreWrap = tpl.el("div", { className: "kair-hero-card__score" });
      var scoreVal = tpl.el("div", { className: "kair-hero-card__score-val", id: "insp-hero-score" });
      scoreVal.textContent = "—%";
      var scoreLbl = tpl.el("div", { className: "kair-hero-card__score-lbl", textContent: "Cumplimiento general" });
      scoreWrap.appendChild(scoreVal);
      scoreWrap.appendChild(scoreLbl);
      hero.appendChild(scoreWrap);

      var body = tpl.el("div", { className: "kair-hero-card__body" }, [
        tpl.el("h2", { className: "kair-hero-card__title", textContent: "Realizar Nueva Inspección" }),
        tpl.el("p", { className: "kair-hero-card__desc", textContent: "Seleccione uno de los formatos oficiales para registrar una inspección. Los datos pueden exportarse a PDF o Excel respetando el formato de cada documento." })
      ]);
      hero.appendChild(body);

      return hero;
    }

    /* ══════════════ 3 metric cards ══════════════ */
    function buildMetricStrip() {
      var strip = tpl.el("div", { className: "kair-metric-strip" });

      var cards = [
        { id: "insp-m-total",  tone: "blue",  icon: "clipboard-list", label: "Inspecciones del mes",  value: "—", sub: "Total registradas" },
        { id: "insp-m-nc",     tone: "amber", icon: "alert-triangle", label: "No conformidades",     value: "—", sub: "Abiertas / pendientes" },
        { id: "insp-m-next",   tone: "red",   icon: "calendar-clock", label: "Próximas a vencer",    value: "—", sub: "En los próximos 7 días" }
      ];

      cards.forEach(function (c) {
        var card = tpl.el("div", { className: "kair-metric-card" }, [
          tpl.el("div", { className: "kair-metric-card__icon kair-metric-card__icon--" + c.tone }, [
            tpl.icon(c.icon, 20)
          ]),
          tpl.el("div", { className: "kair-metric-card__body" }, [
            tpl.el("div", { className: "kair-metric-card__value", id: c.id, textContent: c.value }),
            tpl.el("div", { className: "kair-metric-card__label", textContent: c.label }),
            tpl.el("div", { className: "kair-metric-card__sub", textContent: c.sub })
          ])
        ]);
        strip.appendChild(card);
      });

      return strip;
    }

    /* ══════════════ Chart SVG nativo (distribución por tipo) ══════════════ */
    function buildChartCard() {
      var card = tpl.el("div", { className: "kair-card" });
      card.appendChild(tpl.el("div", { className: "kair-card__header" }, [
        tpl.el("h2", { className: "kair-card__title", textContent: "Distribución por tipo de inspección" })
      ]));
      var body = tpl.el("div", { className: "kair-card__body" });
      body.appendChild(tpl.el("div", { id: "insp-chart", className: "kair-chart-svg" }, [
        tpl.el("div", { className: "kair-loading", style: "padding:32px;" }, [
          tpl.el("span", { className: "kair-spinner" }),
          tpl.el("span", { textContent: "Cargando..." })
        ])
      ]));
      card.appendChild(body);
      return card;
    }

    /* ══════════════ Module grid (4 tipos con flecha) ══════════════ */
    function buildModuleGrid(ctx) {
      var section = tpl.el("div", { className: "kair-module-section" });
      section.appendChild(tpl.el("h2", { className: "kair-section-title", textContent: "Formatos de Inspección Disponibles" }));

      var grid = tpl.el("div", { className: "kair-module-grid" });
      T.INSPECTION_TYPE_LIST.forEach(function (t) {
        var card = tpl.el("button", {
          type: "button",
          className: "kair-module-card",
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
            tpl.el("h3", { className: "kair-module-card__title", textContent: t.title }),
            tpl.el("p", { className: "kair-module-card__desc", textContent: t.description })
          ]),
          tpl.el("div", { className: "kair-module-card__arrow" }, [tpl.icon("arrow-right", 18)])
        ]);
        grid.appendChild(card);
      });
      section.appendChild(grid);
      return section;
    }

    /* ══════════════ Recientes ══════════════ */
    function buildRecientes() {
      var section = tpl.el("div", { className: "kair-module-section" });

      var head = tpl.el("div", { className: "kair-section-head" }, [
        tpl.el("h2", { className: "kair-section-title", textContent: "Inspecciones Recientes" }),
        tpl.el("button", {
          type: "button",
          className: "kair-btn kair-btn-ghost",
          onclick: function () { ctx.go({ name: "historial" }); }
        }, [
          document.createTextNode("Ver historial completo"),
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

    /* ══════════════ Stats: score + métricas + chart ══════════════ */
    function loadStats() {
      api.listInspections({}).then(function (res) {
        if (!res.success) throw new Error(res.error && res.error.message);
        var inspections = res.data.inspections || [];

        var now = new Date();
        var firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        var sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        var totalMonth = inspections.filter(function (i) {
          return new Date(i.date) >= firstOfMonth;
        }).length;

        var ncOpen = inspections.filter(function (i) {
          return i.status === "Pendiente" || i.status === "Vencida" || i.status === "Sin Iniciar";
        }).length;

        var nextToExpire = inspections.filter(function (i) {
          var d = new Date(i.date);
          return (i.status === "Pendiente" || i.status === "Programada" || i.status === "Sin Iniciar") &&
                 d >= now && d <= sevenDays;
        }).length;

        var closedStatuses = ["Ejecutado", "Completada", "Cumplida"];
        var closedCount = inspections.filter(function (i) {
          return closedStatuses.indexOf(i.status) >= 0;
        }).length;
        var score = inspections.length > 0 ? Math.round((closedCount / inspections.length) * 100) : 0;

        var scoreEl = document.getElementById("insp-hero-score");
        if (scoreEl) scoreEl.textContent = score + "%";
        var totalEl = document.getElementById("insp-m-total");
        if (totalEl) totalEl.textContent = String(totalMonth);
        var ncEl = document.getElementById("insp-m-nc");
        if (ncEl) ncEl.textContent = String(ncOpen);
        var nextEl = document.getElementById("insp-m-next");
        if (nextEl) nextEl.textContent = String(nextToExpire);

        renderChart(inspections);
      }).catch(function (e) {
        console.error("[insp-hub] loadStats error:", e);
      });
    }

    function renderChart(inspections) {
      var chart = document.getElementById("insp-chart");
      if (!chart) return;
      chart.innerHTML = "";

      var counts = {};
      T.INSPECTION_TYPE_LIST.forEach(function (t) { counts[t.type] = 0; });
      inspections.forEach(function (i) {
        if (counts[i.type] != null) counts[i.type]++;
      });

      var total = inspections.length;
      var max = 0;
      Object.keys(counts).forEach(function (k) { if (counts[k] > max) max = counts[k]; });
      if (max === 0) max = 1;

      if (total === 0) {
        chart.appendChild(tpl.el("div", { className: "kair-chart-empty", textContent: "Sin inspecciones registradas todavía." }));
        return;
      }

      T.INSPECTION_TYPE_LIST.forEach(function (t) {
        var count = counts[t.type] || 0;
        var pctBar = max > 0 ? Math.round((count / max) * 100) : 0;
        var pctTotal = total > 0 ? Math.round((count / total) * 100) : 0;

        var row = tpl.el("div", { className: "kair-chart-row" }, [
          tpl.el("div", { className: "kair-chart-row__label" }, [
            tpl.el("span", { className: "kair-chart-row__name", textContent: t.shortTitle || t.title }),
            tpl.el("span", { className: "kair-chart-row__val", textContent: count + " (" + pctTotal + "%)" })
          ]),
          tpl.el("div", { className: "kair-chart-row__track" }, [
            tpl.el("div", { className: "kair-chart-row__fill", style: "width:" + pctBar + "%;background-color:" + t.accent + ";" })
          ])
        ]);
        chart.appendChild(row);
      });
    }

    function loadRecent() {
      /* El bloque "Recientes" usa su propio api.listInspections dentro de loadInto(). */
      /* Esta función queda como hook para futuras ampliaciones (filtros, paginación). */
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
