/* ============================================================
 * K+AIR · Formulario Botiquín (GI-FO-031) — Vanilla JS
 * Patrón C — Workflow con sticky footer
 * ============================================================ */
(function (global) {
  "use strict";

  var T = global.KairInspectionTypes;
  var tpl = global.KairTemplates;
  var api = global.KairAPI;

  function FormBotiquin(root, ctx) {
    var store = global.KairStore.getState();
    var meta = T.INSPECTION_TYPES.botiquin;
    var editing = ctx.mode === "editar" && ctx.inspectionId;

    var state = {
      date: new Date().toISOString().slice(0, 10),
      performedBy: "",
      role: "",
      site: "",
      observations: "",
      data: T.emptyBotiquinData(),
      savedId: editing ? ctx.inspectionId : null,
      saving: false
    };

    var wrap = tpl.el("div", { className: "kair-app", style: "min-height:100vh;display:flex;flex-direction:column;" });
    var main = tpl.el("main", { className: "kair-main", style: "max-width:1400px;" });

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
        title: meta.title,
        companyName: store.companyName,
        contextLabel: "SG-SST",
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
        state.role = i.role || "";
        state.site = i.site || "";
        state.observations = i.observations || "";
        state.data = i.data || T.emptyBotiquinData();
        state.savedId = i.id;
        renderAll();
      }).catch(function (e) { tpl.toast("Error", e.message, "error"); });
    }

    function field(label, input) {
      return tpl.el("div", {}, [tpl.el("label", { className: "kair-form-label", textContent: label }), input]);
    }

    function updateItem(idx, f, value) { state.data.items[idx][f] = value; }
    function addItem() {
      state.data.items.push({ item: String(state.data.items.length + 1) + ".0", elemento: "", cantidad: "", fechaVencimiento: "", estado: "" });
      renderAll();
    }
    function removeItem(idx) { state.data.items.splice(idx, 1); renderAll(); }

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
      commonBody.appendChild(field("Realizada por *", tpl.el("input", { type: "text", className: "kair-input", placeholder: "Nombre del responsable", value: state.performedBy, oninput: function (e) { state.performedBy = e.target.value; } })));
      commonBody.appendChild(field("Cargo", tpl.el("input", { type: "text", className: "kair-input", placeholder: "Cargo del responsable", value: state.role, oninput: function (e) { state.role = e.target.value; } })));
      commonBody.appendChild(field("Sede / Sitio", tpl.el("input", { type: "text", className: "kair-input", placeholder: "Lugar de la inspección", value: state.site, oninput: function (e) { state.site = e.target.value; } })));
      main.appendChild(tpl.buildCard("Datos de la Inspección", commonBody));

      var itemsHeader = tpl.el("div", { className: "kair-flex kair-flex--between" }, [
        tpl.el("h2", { className: "kair-card__title", textContent: "Insumos Básicos del Botiquín" }),
        tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--secondary", onclick: addItem }, [tpl.icon("plus", 14), tpl.el("span", { textContent: "Agregar item" })])
      ]);
      var itemsCard = tpl.el("div", { className: "kair-card" });
      itemsCard.appendChild(tpl.el("div", { className: "kair-card__header" }, [itemsHeader]));

      var tableWrap = tpl.el("div", { className: "kair-table-wrap" });
      var table = tpl.el("table", { className: "kair-table" });
      table.appendChild(tpl.el("thead", {}, [tpl.el("tr", {}, [
        tpl.el("th", { textContent: "Item", style: "width:60px;" }),
        tpl.el("th", { textContent: "Elementos" }),
        tpl.el("th", { textContent: "Cantidad", style: "width:110px;" }),
        tpl.el("th", { textContent: "Fecha Vencimiento", style: "width:160px;" }),
        tpl.el("th", { textContent: "Estado / Observación", style: "width:280px;" }),
        tpl.el("th", { style: "width:50px;" })
      ])]));

      var tbody = tpl.el("tbody");
      state.data.items.forEach(function (it, idx) {
        var tr = tpl.el("tr");
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "text", className: "kair-input kair-input--borderless", value: it.item, oninput: function (e) { updateItem(idx, "item", e.target.value); } })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "text", className: "kair-input", placeholder: "Nombre del elemento", value: it.elemento, oninput: function (e) { updateItem(idx, "elemento", e.target.value); } })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "text", className: "kair-input", placeholder: "0", value: it.cantidad, oninput: function (e) { updateItem(idx, "cantidad", e.target.value); } })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "date", className: "kair-input", value: it.fechaVencimiento, oninput: function (e) { updateItem(idx, "fechaVencimiento", e.target.value); } })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "text", className: "kair-input", placeholder: "Estado y observación", value: it.estado, oninput: function (e) { updateItem(idx, "estado", e.target.value); } })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("button", { type: "button", className: "kair-icon-btn", "aria-label": "Eliminar", onclick: function () { removeItem(idx); } }, [tpl.icon("trash-2", 14)])]));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);

      var itemsBody = tpl.el("div", { className: "kair-card__body kair-card__body--flush" });
      itemsBody.appendChild(tableWrap);

      var verifDiv = tpl.el("div", { style: "padding:16px;border-top:1px solid #dee2e6;" }, [
        tpl.el("h4", { style: "font-size:0.85rem;font-weight:600;color:#1a1a2e;margin-bottom:10px;", textContent: "Verificaciones Generales" })
      ]);
      var checksGrid = tpl.el("div", { style: "display:grid;grid-template-columns:1fr auto;gap:8px 12px;align-items:center;" });
      state.data.checks.forEach(function (c, idx) {
        checksGrid.appendChild(tpl.el("div", { style: "font-size:0.85rem;color:#1a1a2e;", textContent: c.label }));
        var rg = tpl.el("div", { className: "kair-radio-group" });
        ["SI", "NO", "NA"].forEach(function (v) {
          rg.appendChild(tpl.el("button", {
            type: "button",
            className: "kair-radio kair-radio--" + v.toLowerCase() + " " + (c.value === v ? "is-active" : ""),
            onclick: function () { state.data.checks[idx].value = v; renderAll(); },
            textContent: v
          }));
        });
        checksGrid.appendChild(rg);
      });
      verifDiv.appendChild(checksGrid);

      verifDiv.appendChild(tpl.el("div", { style: "margin-top:12px;" }, [
        tpl.el("label", { className: "kair-form-label", textContent: "Observaciones del botiquín" }),
        tpl.el("textarea", {
          className: "kair-textarea",
          rows: 2,
          placeholder: "Observaciones específicas del botiquín...",
          value: state.data.observaciones,
          oninput: function (e) { state.data.observaciones = e.target.value; }
        })
      ]));
      itemsBody.appendChild(verifDiv);
      itemsCard.appendChild(itemsBody);
      main.appendChild(itemsCard);

      main.appendChild(tpl.buildCard("Observaciones Generales", tpl.el("textarea", {
        className: "kair-textarea",
        rows: 3,
        placeholder: "Observaciones generales de la inspección, hallazgos y recomendaciones...",
        value: state.observations,
        oninput: function (e) { state.observations = e.target.value; }
      })));

      var footer = tpl.el("div", { className: "kair-sticky-footer no-print" }, [
        tpl.el("span", { className: "kair-text-xs kair-text-muted", textContent: state.savedId ? "Inspección guardada. Puede continuar editando o exportar." : "Complete los campos y guarde la inspección." }),
        tpl.el("div", { className: "kair-flex kair-gap-2" }, [
          tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--ghost", onclick: function () { ctx.go({ name: "hub" }); } }, [tpl.icon("x", 15), tpl.el("span", { textContent: "Cancelar" })]),
          tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--primary", onclick: save, disabled: state.saving }, [tpl.icon("save", 15), tpl.el("span", { textContent: state.saving ? "Guardando..." : (state.savedId ? "Actualizar" : "Guardar") })])
        ])
      ]);
      main.appendChild(footer);

      tpl.refreshIcons();
    }

    function save() {
      if (!state.performedBy.trim()) {
        tpl.toast("Validación", "El campo 'Realizada por' es obligatorio", "warning");
        return;
      }
      state.saving = true;
      renderAll();
      var payload = {
        type: "botiquin",
        date: state.date,
        performedBy: state.performedBy,
        role: state.role,
        site: state.site,
        observations: state.observations,
        status: "Completada",
        data: state.data
      };
      var p = state.savedId
        ? api.updateInspection(state.savedId, payload)
        : api.createInspection(payload);
      p.then(function (res) {
        if (!res.success) throw new Error(res.error && res.error.message);
        state.savedId = res.data.inspection.id;
        tpl.toast("Guardado", "Inspección guardada correctamente", "success");
        renderAll();
      }).catch(function (e) {
        tpl.toast("Error", e.message, "error");
        state.saving = false;
        renderAll();
      });
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
  global.KairViews.FormBotiquin = FormBotiquin;
})(typeof window !== "undefined" ? window : this);