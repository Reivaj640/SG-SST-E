/* ============================================================
 * K+AIR · Vista Hub (Centro de Inspecciones)
 * Patrón B — Submodule Home
 * Estructura: Header · Hero CTA · Tipos · Recientes
 * ============================================================ */
(function (global) {
  "use strict";

  var T = global.KairInspectionTypes;
  var tpl = global.KairTemplates;
  var api = global.KairAPI;

  function Hub(root, ctx) {
    var store = global.KairStore.getState();

    var wrap = tpl.el("div", { className: "kair-app", style: "min-height:100vh;display:flex;flex-direction:column;" });

    wrap.appendChild(tpl.buildHeader({
      onBack: function () { ctx.go({ name: "dashboard" }); },
      sectionPill: "Inspecciones",
      title: "Centro de Inspecciones",
      subtitle: "Seleccione el tipo de inspección que desea realizar",
      companyName: store.companyName,
      contextLabel: "SG-SST",
      actions: [
        { label: "Ver Historial", variant: "secondary", icon: tpl.icon("history", 15), onClick: function () { ctx.go({ name: "historial" }); } }
      ]
    }));

    var main = tpl.el("main", { className: "kair-main", style: "max-width:1400px;" });

    var heroBody = tpl.el("div", { className: "kair-hero" }, [
      tpl.el("span", { className: "kair-hero__icon" }, [tpl.icon("clipboard-list", 32)]),
      tpl.el("div", { style: "flex:1;min-width:0;" }, [
        tpl.el("h2", { className: "kair-hero__title", textContent: "Realizar Nueva Inspección" }),
        tpl.el("p", { className: "kair-hero__desc", textContent: "Seleccione uno de los formatos oficiales para registrar una inspección. Los datos pueden exportarse a PDF o Excel respetando el formato de cada documento." })
      ])
    ]);
    main.appendChild(tpl.buildCard(null, heroBody));

    main.appendChild(tpl.el("h3", { style: "font-size:0.95rem;font-weight:600;color:#1a1a2e;margin-bottom:12px;", textContent: "Formatos de Inspección Disponibles" }));

    var typesGrid = tpl.el("div", { className: "kair-grid kair-grid--2" });
    T.INSPECTION_TYPE_LIST.forEach(function (t) {
      var card = tpl.el("button", {
        type: "button",
        className: "kair-type-card",
        onclick: function () { ctx.go({ name: "nueva", inspectionType: t.type }); }
      }, [
        tpl.el("div", { className: "kair-flex kair-gap-4" }, [
          tpl.el("span", {
            className: "kair-type-icon",
            style: "width:48px;height:48px;background-color:" + t.accent + "1a;color:" + t.accent + ";"
          }, [iconFor(t.type, 22)]),
          tpl.el("div", { style: "flex:1;min-width:0;" }, [
            tpl.el("div", { className: "kair-type-card__head" }, [
              tpl.el("span", { className: "kair-type-card__code", textContent: t.code }),
              tpl.el("span", { className: "kair-type-card__rev", textContent: t.revision })
            ]),
            tpl.el("h4", { className: "kair-type-card__title", textContent: t.title }),
            tpl.el("p", { className: "kair-type-card__desc", textContent: t.description }),
            tpl.el("div", { className: "kair-type-card__cta" }, [
              tpl.icon("plus", 14),
              tpl.el("span", { textContent: "Iniciar inspección" })
            ])
          ])
        ])
      ]);
      typesGrid.appendChild(card);
    });
    main.appendChild(typesGrid);

    var recientesHeader = tpl.el("div", { className: "kair-flex kair-flex--between", style: "margin-bottom:12px;" }, [
      tpl.el("h3", { style: "font-size:0.95rem;font-weight:600;color:#1a1a2e;margin:0;", textContent: "Inspecciones Recientes" }),
      tpl.el("button", {
        type: "button",
        className: "kair-header__action kair-header__action--ghost",
        onclick: function () { ctx.go({ name: "historial" }); }
      }, [
        document.createTextNode("Ver historial completo"),
        tpl.icon("arrow-right", 14)
      ])
    ]);
    main.appendChild(recientesHeader);

    var recentCard = tpl.el("div", { className: "kair-card" });
    var recentBody = tpl.el("div", { className: "kair-card__body kair-card__body--flush" });
    recentBody.appendChild(tpl.loadingBlock("Cargando..."));
    recentCard.appendChild(recentBody);
    main.appendChild(recentCard);

    wrap.appendChild(main);
    root.appendChild(wrap);

    loadRecent();

    function loadRecent() {
      api.listInspections({}).then(function (res) {
        if (!res.success) throw new Error(res.error && res.error.message);
        var list = res.data.inspections.slice(0, 5);
        recentBody.innerHTML = "";
        if (list.length === 0) {
          recentBody.appendChild(tpl.emptyState("file-text", "Sin inspecciones registradas", "Cuando realice su primera inspección aparecerá aquí para acceso rápido."));
          tpl.refreshIcons();
          return;
        }
        var tableWrap = tpl.el("div", { className: "kair-table-wrap" });
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
              tpl.el("div", { style: "font-weight:500;color:#1a1a2e;font-size:0.85rem;", textContent: (meta && meta.shortTitle) || r.title }),
              tpl.el("div", { style: "font-size:0.7rem;color:#adb5bd;", textContent: r.code })
            ])
          ]));
          tr.appendChild(tdTipo);
          tr.appendChild(tpl.el("td", {}, [tpl.el("span", { className: "kair-text-xs kair-text-muted", textContent: tpl.formatDate(r.date, { short: true }) })]));
          tr.appendChild(tpl.el("td", {}, [tpl.el("span", { className: "kair-text-sm", style: "color:#1a1a2e;", textContent: r.performedBy })]));
          tr.appendChild(tpl.el("td", {}, [tpl.el("span", { className: "kair-text-xs kair-text-muted", textContent: r.site || "—" })]));
          tr.appendChild(tpl.el("td", {}, [tpl.statusPill(r.status)]));
          var tdActions = tpl.el("td", { style: "text-align:right;" });
          tdActions.appendChild(tpl.el("button", {
            type: "button",
            className: "kair-header__action kair-header__action--ghost",
            style: "padding:4px 10px;font-size:0.78rem;",
            onclick: function () { ctx.go({ name: "detalle", inspectionId: r.id }); }
          }, [tpl.icon("eye", 14), tpl.el("span", { textContent: "Ver detalle" })]));
          tr.appendChild(tdActions);
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        tableWrap.appendChild(table);
        recentBody.appendChild(tableWrap);
        tpl.refreshIcons();
      }).catch(function (e) {
        recentBody.innerHTML = "";
        recentBody.appendChild(tpl.el("div", { style: "padding:24px;color:#dc3545;", textContent: e.message }));
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
      default: return tpl.icon("file-text", size);
    }
  }

  global.KairViews = global.KairViews || {};
  global.KairViews.Hub = Hub;
})(typeof window !== "undefined" ? window : this);