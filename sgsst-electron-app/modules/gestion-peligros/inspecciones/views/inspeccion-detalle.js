/* ============================================================
 * K+AIR · Vista Detalle (read-only de una inspección)
 * Muestra la info + resultado por tipo + acciones (PDF/XLSX/eliminar)
 * ============================================================ */
(function (global) {
  "use strict";

  var T = global.KairInspectionTypes;
  var tpl = global.KairTemplates;
  var api = global.KairAPI;

  function Detalle(root, ctx) {
    var store = global.KairStore.getState();

    var wrap = tpl.el("div", { className: "kair-app", style: "min-height:100vh;display:flex;flex-direction:column;" });

    var main = tpl.el("main", { className: "kair-main", style: "max-width:1400px;" });
    main.appendChild(tpl.loadingBlock("Cargando..."));
    wrap.appendChild(main);
    root.appendChild(wrap);

    api.getInspection(ctx.inspectionId).then(function (res) {
      if (!res.success) {
        main.innerHTML = "";
        main.appendChild(tpl.buildCard("Error", tpl.el("div", { style: "color:#dc3545;", textContent: (res.error && res.error.message) || "Inspección no encontrada" })));
        return;
      }
      renderDetalle(res.data.inspection);
    }).catch(function (e) {
      main.innerHTML = "";
      main.appendChild(tpl.buildCard("Error", tpl.el("div", { style: "color:#dc3545;", textContent: e.message })));
    });

    function renderDetalle(insp) {
      var meta = T.INSPECTION_TYPES[insp.type];
      main.innerHTML = "";

      wrap.insertBefore(buildHeader(insp, meta), main);

      // Header info
      var metaGrid = tpl.el("div", { className: "kair-detail-meta" }, [
        metaEl("Fecha", tpl.formatDate(insp.date)),
        metaEl("Realizada por", insp.performedBy + (insp.role ? "" : ""), insp.role || null),
        insp.site ? metaEl("Sede", insp.site) : null,
        metaEl("Empresa", insp.companyName)
      ]);
      main.appendChild(tpl.buildCard(null, tpl.el("div", { className: "kair-format-banner" }, [
        tpl.el("div", {}, [
          tpl.el("div", { className: "kair-format-banner__meta" }, [
            tpl.el("span", { className: "kair-format-banner__code", textContent: meta.code }),
            tpl.el("span", { className: "kair-format-banner__rev", textContent: meta.revision }),
            tpl.statusPill(insp.status)
          ]),
          tpl.el("h2", { className: "kair-format-banner__title", textContent: meta.title })
        ]),
        metaGrid
      ])));

      // Type-specific read-only content
      main.appendChild(buildContent(insp));

      // Observations
      if (insp.observations) {
        main.appendChild(tpl.buildCard("Observaciones Generales", tpl.el("p", {
          style: "font-size:0.875rem;color:#1a1a2e;line-height:1.6;margin:0;", textContent: insp.observations
        })));
      }
      tpl.refreshIcons();
    }

    function metaEl(label, value, sub) {
      return tpl.el("div", {}, [
        tpl.el("div", { className: "kair-detail-meta__label", textContent: label }),
        tpl.el("div", { className: "kair-detail-meta__value", textContent: value || "—" }),
        sub ? tpl.el("div", { style: "color:#5a6378;font-size:0.72rem;", textContent: sub }) : null
      ]);
    }

    function buildHeader(insp, meta) {
      return tpl.buildHeader({
        onBack: function () { ctx.go({ name: "historial" }); },
        breadcrumb: [
          { label: "Historial", onClick: function () { ctx.go({ name: "historial" }); } },
          { label: meta.shortTitle }
        ],
        title: meta.shortTitle + " · " + tpl.formatDate(insp.date),
        subtitle: meta.code + " · " + meta.title,
        companyName: store.companyName, contextLabel: "SG-SST",
        actions: [
          { label: "Eliminar", variant: "ghost", icon: tpl.icon("trash-2", 15), onClick: function () { del(insp.id); } },
          { label: "Editar", variant: "secondary", icon: tpl.icon("pencil", 15), onClick: function () { ctx.go({ name: "editar", inspectionType: insp.type, inspectionId: insp.id }); } },
          { label: "Exportar PDF", variant: "primary", icon: tpl.icon("file-down", 15), onClick: function () { exportOne(insp.id, "pdf"); } }
        ]
      });
    }

    function buildContent(insp) {
      var data = insp.data || {};
      if (insp.type === "botiquin") return buildBotiquin(data);
      if (insp.type === "extintores") return buildExtintores(data);
      if (insp.type === "instalaciones") return buildInstalaciones(data);
      if (insp.type === "equipos_emergencia") return buildEmergencia(data);
      return tpl.buildCard("Datos", tpl.el("div", { textContent: "Sin datos" }));
    }

    function buildBotiquin(data) {
      var tableWrap = tpl.el("div", { className: "kair-table-wrap" });
      var table = tpl.el("table", { className: "kair-table" });
      table.appendChild(tpl.el("thead", {}, [tpl.el("tr", {}, [
        tpl.el("th", { textContent: "Item", style: "width:60px;" }),
        tpl.el("th", { textContent: "Elementos" }),
        tpl.el("th", { textContent: "Cantidad", style: "width:100px;" }),
        tpl.el("th", { textContent: "Vencimiento", style: "width:140px;" }),
        tpl.el("th", { textContent: "Estado / Observación" })
      ])]));
      var tbody = tpl.el("tbody");
      (data.items || []).forEach(function (it) {
        tbody.appendChild(tpl.el("tr", {}, [
          tpl.el("td", { textContent: it.item || "" }),
          tpl.el("td", { style: "font-weight:500;", textContent: it.elemento || "" }),
          tpl.el("td", { textContent: it.cantidad || "—" }),
          tpl.el("td", { textContent: it.fechaVencimiento ? tpl.formatDate(it.fechaVencimiento) : "—" }),
          tpl.el("td", { textContent: it.estado || "—" })
        ]));
      });
      if ((data.checks || []).length > 0) {
        tbody.appendChild(tpl.el("tr", {}, [tpl.el("td", { colSpan: 5, className: "kair-table__categoria", textContent: "Verificaciones Generales" })]));
        (data.checks || []).forEach(function (c) {
          tbody.appendChild(tpl.el("tr", {}, [
            tpl.el("td", { colSpan: 4, textContent: c.label }),
            tpl.el("td", {}, [tpl.statusPill(c.value || "Pendiente")])
          ]));
        });
      }
      if (data.observaciones) {
        tbody.appendChild(tpl.el("tr", {}, [tpl.el("td", { colSpan: 5, style: "background:#f8f9fa;", innerHTML: "<strong>Observaciones del botiquín:</strong> " + escapeHtml(data.observaciones) })]));
      }
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      var body = tpl.el("div", { className: "kair-card__body kair-card__body--flush" });
      body.appendChild(tableWrap);
      var card = tpl.el("div", { className: "kair-card" });
      card.appendChild(tpl.el("div", { className: "kair-card__header" }, [
        tpl.el("h2", { className: "kair-card__title", textContent: "Resultado de la Inspección" }),
        tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--ghost", onclick: function () { exportOne(inspId(), "xlsx"); } }, [tpl.icon("file-down", 14), tpl.el("span", { textContent: "Exportar Excel" })])
      ]));
      card.appendChild(body);
      return card;
    }

    function buildExtintores(data) {
      var headers = ["Ubicación", "# Extintor", "Tipo", "Capacidad", "F. Recarga", "F. Vencimiento", "Presión", "Estado Cilindro", "Pasador", "Anillo", "Base", "Observaciones"];
      var tableWrap = tpl.el("div", { className: "kair-table-wrap" });
      var table = tpl.el("table", { className: "kair-table" });
      table.appendChild(tpl.el("thead", {}, [tpl.el("tr", {}, headers.map(function (h) { return tpl.el("th", { textContent: h }); }))]));
      var tbody = tpl.el("tbody");
      (data.rows || []).forEach(function (r) {
        tbody.appendChild(tpl.el("tr", {}, [
          r.ubicacion || "—", r.numero || "—", r.tipo || "—", r.capacidad || "—",
          r.fechaRecarga ? tpl.formatDate(r.fechaRecarga) : "—",
          r.fechaVencimiento ? tpl.formatDate(r.fechaVencimiento) : "—",
          r.presion || "—", r.estadoCilindro || "—",
          r.pasador || "—", r.anillo || "—", r.base || "—", r.observaciones || "—"
        ].map(function (v) {
          return typeof v === "string" ? tpl.el("td", { textContent: v }) : v;
        })));
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      var body = tpl.el("div", { className: "kair-card__body kair-card__body--flush" });
      body.appendChild(tableWrap);
      var card = tpl.el("div", { className: "kair-card" });
      card.appendChild(tpl.el("div", { className: "kair-card__header" }, [
        tpl.el("h2", { className: "kair-card__title", textContent: "Resultado de la Inspección" }),
        tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--ghost", onclick: function () { exportOne(inspId(), "xlsx"); } }, [tpl.icon("file-down", 14), tpl.el("span", { textContent: "Exportar Excel" })])
      ]));
      card.appendChild(body);
      return card;
    }

    function buildInstalaciones(data) {
      var tableWrap = tpl.el("div", { className: "kair-table-wrap" });
      var table = tpl.el("table", { className: "kair-table" });
      table.appendChild(tpl.el("thead", {}, [tpl.el("tr", {}, [
        tpl.el("th", { textContent: "Item Revisión", style: "min-width:280px;" }),
        tpl.el("th", { textContent: "SI", style: "width:80px;text-align:center;" }),
        tpl.el("th", { textContent: "NO", style: "width:80px;text-align:center;" }),
        tpl.el("th", { textContent: "N/A", style: "width:80px;text-align:center;" }),
        tpl.el("th", { textContent: "Observaciones" }),
        tpl.el("th", { textContent: "Compromisos" }),
        tpl.el("th", { textContent: "Responsable" }),
        tpl.el("th", { textContent: "Seguimiento" })
      ])]));
      var tbody = tpl.el("tbody");
      var currentCat = "";
      (data.items || []).forEach(function (it) {
        if (it.categoria !== currentCat) {
          currentCat = it.categoria;
          tbody.appendChild(tpl.el("tr", {}, [tpl.el("td", { colSpan: 8, className: "kair-table__categoria", textContent: currentCat })]));
        }
        tbody.appendChild(tpl.el("tr", {}, [
          tpl.el("td", { style: "font-size:0.8rem;", textContent: it.item }),
          tpl.el("td", { style: "text-align:center;", textContent: it.respuesta === "SI" ? "X" : "" }),
          tpl.el("td", { style: "text-align:center;", textContent: it.respuesta === "NO" ? "X" : "" }),
          tpl.el("td", { style: "text-align:center;", textContent: it.respuesta === "N/A" ? "X" : "" }),
          tpl.el("td", { textContent: it.observaciones || "—" }),
          tpl.el("td", { textContent: it.compromisos || "—" }),
          tpl.el("td", { textContent: it.responsable || "—" }),
          tpl.el("td", { textContent: it.seguimiento || "—" })
        ]));
      });
      tbody.appendChild(tpl.el("tr", {}, [tpl.el("td", { colSpan: 8, style: "background:#f8f9fa;padding-top:16px;", innerHTML: "<div style=\"display:flex;gap:24px;flex-wrap:wrap;\"><div><strong>Inspeccionado por:</strong> " + escapeHtml(data.inspeccionadoPor || "—") + "</div><div><strong>Cargo:</strong> " + escapeHtml(data.cargo || "—") + "</div></div>" })]));
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      var body = tpl.el("div", { className: "kair-card__body kair-card__body--flush" });
      body.appendChild(tableWrap);
      var card = tpl.el("div", { className: "kair-card" });
      card.appendChild(tpl.el("div", { className: "kair-card__header" }, [
        tpl.el("h2", { className: "kair-card__title", textContent: "Resultado de la Inspección" }),
        tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--ghost", onclick: function () { exportOne(inspId(), "xlsx"); } }, [tpl.icon("file-down", 14), tpl.el("span", { textContent: "Exportar Excel" })])
      ]));
      card.appendChild(body);
      return card;
    }

    function buildEmergencia(data) {
      var tableWrap = tpl.el("div", { className: "kair-table-wrap" });
      var table = tpl.el("table", { className: "kair-table" });
      table.appendChild(tpl.el("thead", {}, [tpl.el("tr", {}, [
        tpl.el("th", { textContent: "Items para Revisar", style: "min-width:280px;" }),
        tpl.el("th", { textContent: "Bueno", style: "width:80px;text-align:center;" }),
        tpl.el("th", { textContent: "Malo", style: "width:80px;text-align:center;" }),
        tpl.el("th", { textContent: "N/A", style: "width:80px;text-align:center;" }),
        tpl.el("th", { textContent: "Recomendaciones" }),
        tpl.el("th", { textContent: "Responsables" }),
        tpl.el("th", { textContent: "Seguimiento" })
      ])]));
      var tbody = tpl.el("tbody");
      (data.items || []).forEach(function (it) {
        tbody.appendChild(tpl.el("tr", {}, [
          tpl.el("td", { style: "font-size:0.8rem;", textContent: it.item }),
          tpl.el("td", { style: "text-align:center;", textContent: it.estado === "BUENO" ? "X" : "" }),
          tpl.el("td", { style: "text-align:center;", textContent: it.estado === "MALO" ? "X" : "" }),
          tpl.el("td", { style: "text-align:center;", textContent: it.estado === "N/A" ? "X" : "" }),
          tpl.el("td", { textContent: it.recomendaciones || "—" }),
          tpl.el("td", { textContent: it.responsables || "—" }),
          tpl.el("td", { textContent: it.seguimiento || "—" })
        ]));
      });
      if ((data.participantes || []).length > 0) {
        tbody.appendChild(tpl.el("tr", {}, [tpl.el("td", { colSpan: 7, className: "kair-table__categoria", textContent: "Participantes" })]));
        (data.participantes || []).forEach(function (p) {
          tbody.appendChild(tpl.el("tr", {}, [
            tpl.el("td", { colSpan: 5, textContent: p.nombre || "—" }),
            tpl.el("td", { colSpan: 2, textContent: p.cargo || "—" })
          ]));
        });
      }
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      var body = tpl.el("div", { className: "kair-card__body kair-card__body--flush" });
      body.appendChild(tableWrap);
      var card = tpl.el("div", { className: "kair-card" });
      card.appendChild(tpl.el("div", { className: "kair-card__header" }, [
        tpl.el("h2", { className: "kair-card__title", textContent: "Resultado de la Inspección" }),
        tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--ghost", onclick: function () { exportOne(inspId(), "xlsx"); } }, [tpl.icon("file-down", 14), tpl.el("span", { textContent: "Exportar Excel" })])
      ]));
      card.appendChild(body);
      return card;
    }

    function inspId() { return ctx.inspectionId; }

    function escapeHtml(s) {
      return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function exportOne(id, format) {
      tpl.toast("Exportando", "Generando " + format.toUpperCase() + "...", "info");
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
        tpl.toast("Eliminada", "La inspección fue eliminada", "success");
        ctx.go({ name: "historial" });
      }).catch(function (e) { tpl.toast("Error", e.message, "error"); });
    }

    tpl.refreshIcons();
  }

  global.KairViews = global.KairViews || {};
  global.KairViews.Detalle = Detalle;
})(typeof window !== "undefined" ? window : this);