/* ============================================================
 * K+AIR · Formulario Instalaciones (GI-FO-025) — Vanilla JS
 * Patrón C — Tabla con 5 categorias y respuestas SI/NO/N/A
 * ============================================================ */
(function (global) {
  "use strict";

  var T = global.KairInspectionTypes;
  var tpl = global.KairTemplates;
  var api = global.KairAPI;

  function FormInstalaciones(root, ctx) {
    var store = global.KairStore.getState();
    var meta = T.INSPECTION_TYPES.instalaciones;
    var editing = ctx.mode === "editar" && ctx.inspectionId;

    var state = {
      date: new Date().toISOString().slice(0, 10),
      performedBy: "", role: "", site: "", observations: "",
      data: T.emptyInstalacionesData(),
      savedId: editing ? ctx.inspectionId : null,
      saving: false
    };

    var wrap = tpl.el("div", { className: "kair-app", style: "min-height:100vh;display:flex;flex-direction:column;" });
    var main = tpl.el("main", { className: "kair-main", style: "max-width:1600px;" });

    wrap.appendChild(buildHeader());
    wrap.appendChild(main);
    root.appendChild(wrap);

    if (editing) load();
    renderAll();

    function buildHeader() {
      return tpl.buildHeader({
        onBack: function () { ctx.go({ name: "hub" }); },
        breadcrumb: [
          { label: "Inspecciones", onClick: function () { ctx.go({ name: "hub" }); } },
          { label: meta.shortTitle }
        ],
        title: meta.title, companyName: store.companyName, contextLabel: "SG-SST",
        actions: [
          { label: "Exportar PDF", variant: "secondary", icon: tpl.icon("file-down", 15), onClick: function () { exportOne("pdf"); } },
          { label: "Exportar Excel", variant: "secondary", icon: tpl.icon("file-down", 15), onClick: function () { exportOne("xlsx"); } },
          { label: "Guardar", variant: "primary", icon: tpl.icon("save", 15), onClick: save, disabled: state.saving }
        ]
      });
    }

    function load() {
      api.getInspection(ctx.inspectionId).then(function (res) {
        if (!res.success) return;
        var i = res.data.inspection;
        state.date = new Date(i.date).toISOString().slice(0, 10);
        state.performedBy = i.performedBy;
        state.role = i.role || ""; state.site = i.site || "";
        state.observations = i.observations || "";
        state.data = i.data || T.emptyInstalacionesData();
        state.savedId = i.id;
        renderAll();
      });
    }

    function field(label, input) { return tpl.el("div", {}, [tpl.el("label", { className: "kair-form-label", textContent: label }), input]); }
    function updateItem(idx, f, v) { state.data.items[idx][f] = v; }
    function updateMeta(f, v) { state.data[f] = v; }

    function renderAll() {
      main.innerHTML = "";

      main.appendChild(tpl.buildCard(null, tpl.el("div", { className: "kair-format-banner" }, [
        tpl.el("div", {}, [
          tpl.el("div", { className: "kair-format-banner__meta" }, [
            tpl.el("span", { className: "kair-format-banner__code", textContent: meta.code }),
            tpl.el("span", { className: "kair-format-banner__rev", textContent: meta.revision })
          ]),
          tpl.el("h2", { className: "kair-format-banner__title", textContent: "PROCESO DE GESTIÓN INTEGRAL · " + meta.title })
        ]),
        state.savedId ? tpl.el("span", { className: "kair-status kair-status--completada", textContent: "Guardada · ID: " + state.savedId.slice(-8) }) : null
      ])));

      var commonBody = tpl.el("div", { className: "kair-grid kair-grid--4" });
      commonBody.appendChild(field("Fecha", tpl.el("input", { type: "date", className: "kair-input", value: state.date, oninput: function (e) { state.date = e.target.value; } })));
      commonBody.appendChild(field("Realizada por *", tpl.el("input", { type: "text", className: "kair-input", value: state.performedBy, oninput: function (e) { state.performedBy = e.target.value; } })));
      commonBody.appendChild(field("Cargo", tpl.el("input", { type: "text", className: "kair-input", value: state.role, oninput: function (e) { state.role = e.target.value; } })));
      commonBody.appendChild(field("Sede / Sitio", tpl.el("input", { type: "text", className: "kair-input", value: state.site, oninput: function (e) { state.site = e.target.value; } })));
      main.appendChild(tpl.buildCard("Datos de la Inspección", commonBody));

      var itemsCard = tpl.el("div", { className: "kair-card" });
      itemsCard.appendChild(tpl.el("div", { className: "kair-card__header" }, [
        tpl.el("h2", { className: "kair-card__title", textContent: "Lista de Verificación de Instalaciones" })
      ]));

      var tableWrap = tpl.el("div", { className: "kair-table-wrap" });
      var table = tpl.el("table", { className: "kair-table" });
      table.appendChild(tpl.el("thead", {}, [tpl.el("tr", {}, [
        tpl.el("th", { textContent: "Item Revisión", style: "min-width:320px;" }),
        tpl.el("th", { textContent: "Respuesta", style: "width:160px;text-align:center;" }),
        tpl.el("th", { textContent: "Observaciones", style: "min-width:200px;" }),
        tpl.el("th", { textContent: "Compromisos", style: "min-width:200px;" }),
        tpl.el("th", { textContent: "Responsable - Fechas", style: "min-width:160px;" }),
        tpl.el("th", { textContent: "Seguimiento - Estado", style: "min-width:160px;" })
      ])]));

      var tbody = tpl.el("tbody");
      // Group items by categoria preserving order
      var currentCat = "";
      state.data.items.forEach(function (it, idx) {
        if (it.categoria !== currentCat) {
          currentCat = it.categoria;
          tbody.appendChild(tpl.el("tr", {}, [tpl.el("td", { colSpan: 6, className: "kair-table__categoria", textContent: currentCat })]));
        }
        var tr = tpl.el("tr");
        tr.appendChild(tpl.el("td", { style: "font-size:0.8rem;", textContent: it.item }));
        var tdResp = tpl.el("td", { style: "text-align:center;" });
        var rg = tpl.el("div", { className: "kair-radio-group", style: "margin:0 auto;" });
        ["SI", "NO", "N/A"].forEach(function (v) {
          var key = v === "N/A" ? "na" : v.toLowerCase();
          rg.appendChild(tpl.el("button", {
            type: "button",
            className: "kair-radio kair-radio--" + key + " " + (it.respuesta === v ? "is-active" : ""),
            onclick: function () { state.data.items[idx].respuesta = v; renderAll(); },
            textContent: v
          }));
        });
        tdResp.appendChild(rg);
        tr.appendChild(tdResp);
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "text", className: "kair-input", value: it.observaciones, oninput: function (e) { updateItem(idx, "observaciones", e.target.value); } })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "text", className: "kair-input", value: it.compromisos, oninput: function (e) { updateItem(idx, "compromisos", e.target.value); } })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "text", className: "kair-input", value: it.responsable, oninput: function (e) { updateItem(idx, "responsable", e.target.value); } })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "text", className: "kair-input", value: it.seguimiento, oninput: function (e) { updateItem(idx, "seguimiento", e.target.value); } })]));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);

      var itemsBody = tpl.el("div", { className: "kair-card__body kair-card__body--flush" });
      itemsBody.appendChild(tableWrap);

      var metaGrid = tpl.el("div", { style: "padding:16px;border-top:1px solid #dee2e6;", className: "kair-grid kair-grid--3" });
      metaGrid.appendChild(field("Inspeccionado por", tpl.el("input", { className: "kair-input", value: state.data.inspeccionadoPor, oninput: function (e) { updateMeta("inspeccionadoPor", e.target.value); } })));
      metaGrid.appendChild(field("Cargo", tpl.el("input", { className: "kair-input", value: state.data.cargo, oninput: function (e) { updateMeta("cargo", e.target.value); } })));
      metaGrid.appendChild(field("Firma", tpl.el("input", { className: "kair-input", placeholder: "Nombre completo", value: state.data.firma, oninput: function (e) { updateMeta("firma", e.target.value); } })));
      itemsBody.appendChild(metaGrid);

      itemsCard.appendChild(itemsBody);
      main.appendChild(itemsCard);

      main.appendChild(tpl.buildCard("Observaciones Generales", tpl.el("textarea", {
        className: "kair-textarea", rows: 3,
        placeholder: "Observaciones generales de la inspección, hallazgos y recomendaciones...",
        value: state.observations,
        oninput: function (e) { state.observations = e.target.value; }
      })));

      var footer = tpl.el("div", { className: "kair-sticky-footer no-print" }, [
        tpl.el("span", { className: "kair-text-xs kair-text-muted", textContent: state.savedId ? "Inspección guardada." : "Complete los campos y guarde." }),
        tpl.el("div", { className: "kair-flex kair-gap-2" }, [
          tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--ghost", onclick: function () { ctx.go({ name: "hub" }); } }, [tpl.icon("x", 15), tpl.el("span", { textContent: "Cancelar" })]),
          tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--primary", onclick: save, disabled: state.saving }, [tpl.icon("save", 15), tpl.el("span", { textContent: state.saving ? "Guardando..." : (state.savedId ? "Actualizar" : "Guardar") })])
        ])
      ]);
      main.appendChild(footer);
      tpl.refreshIcons();
    }

    function save() {
      if (!state.performedBy.trim()) { tpl.toast("Validación", "El campo 'Realizada por' es obligatorio", "warning"); return; }
      state.saving = true; renderAll();
      var payload = { type: "instalaciones", date: state.date, performedBy: state.performedBy, role: state.role, site: state.site, observations: state.observations, status: "Completada", data: state.data, companyId: store.companyId, companyName: store.companyName };
      var p = state.savedId ? api.updateInspection(state.savedId, payload) : api.createInspection(payload);
      p.then(function (res) {
        if (!res.success) throw new Error(res.error && res.error.message);
        state.savedId = res.data.inspection.id;
        tpl.toast("Inspección guardada", "La inspección quedó registrada correctamente", "success");
        ctx.go({ name: "historial" });
      }).catch(function (e) { tpl.toast("Error al guardar", e.message, "error"); state.saving = false; renderAll(); });
    }

    function exportOne(format) {
      if (!state.savedId) { tpl.toast("Atención", "Guarde la inspección antes de exportar", "warning"); return; }
      tpl.toast("Exportando", "Generando " + format.toUpperCase() + "...", "info");
      api.exportInspection(state.savedId, format).then(function (res) {
        if (!res.success) throw new Error(res.error && res.error.message);
        if (global.KairExport) global.KairExport.downloadBlob(res.data.blob, res.data.filename);
        tpl.toast("Éxito", "Archivo generado", "success");
      }).catch(function (e) { tpl.toast("Error", e.message, "error"); });
    }

    tpl.refreshIcons();
  }

  global.KairViews = global.KairViews || {};
  global.KairViews.FormInstalaciones = FormInstalaciones;
})(typeof window !== "undefined" ? window : this);