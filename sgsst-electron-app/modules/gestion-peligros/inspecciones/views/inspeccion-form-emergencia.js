/* ============================================================
 * K+AIR · Formulario Equipos de Emergencia (GI-FO-023) — Vanilla JS
 * Patrón C — Tabla con 9 items + participantes
 * ============================================================ */
(function (global) {
  "use strict";

  var T = global.KairInspectionTypes;
  var tpl = global.KairTemplates;
  var api = global.KairAPI;

  function FormEmergencia(root, ctx) {
    var store = global.KairStore.getState();
    var meta = T.INSPECTION_TYPES.equipos_emergencia;
    var editing = ctx.mode === "editar" && ctx.inspectionId;

    var state = {
      date: new Date().toISOString().slice(0, 10),
      performedBy: "", role: "", site: "", observations: "",
      data: T.emptyEmergenciaData(),
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
        state.data = i.data || T.emptyEmergenciaData();
        state.savedId = i.id;
        renderAll();
      });
    }

    function field(label, input) { return tpl.el("div", {}, [tpl.el("label", { className: "kair-form-label", textContent: label }), input]); }
    function updateItem(idx, f, v) { state.data.items[idx][f] = v; }
    function updateParticipante(idx, f, v) { state.data.participantes[idx][f] = v; }
    function addParticipante() { state.data.participantes.push({ nombre: "", cargo: "" }); renderAll(); }
    function removeParticipante(idx) { state.data.participantes.splice(idx, 1); renderAll(); }

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
        tpl.el("h2", { className: "kair-card__title", textContent: "Items para Revisar" })
      ]));

      var tableWrap = tpl.el("div", { className: "kair-table-wrap" });
      var table = tpl.el("table", { className: "kair-table" });
      table.appendChild(tpl.el("thead", {}, [tpl.el("tr", {}, [
        tpl.el("th", { textContent: "Items para Revisar", style: "min-width:320px;" }),
        tpl.el("th", { textContent: "Estado", style: "width:180px;text-align:center;" }),
        tpl.el("th", { textContent: "Recomendaciones / Compromisos", style: "min-width:220px;" }),
        tpl.el("th", { textContent: "Responsables / Fechas", style: "min-width:180px;" }),
        tpl.el("th", { textContent: "Seguimiento / Estatus", style: "min-width:180px;" })
      ])]));

      var tbody = tpl.el("tbody");
      state.data.items.forEach(function (it, idx) {
        var tr = tpl.el("tr");
        tr.appendChild(tpl.el("td", { style: "font-size:0.8rem;font-weight:500;", textContent: it.item }));
        var tdEstado = tpl.el("td", { style: "text-align:center;" });
        var rg = tpl.el("div", { className: "kair-radio-group", style: "margin:0 auto;" });
        ["BUENO", "MALO", "N/A"].forEach(function (v) {
          var key = v === "N/A" ? "na" : v.toLowerCase();
          rg.appendChild(tpl.el("button", {
            type: "button",
            className: "kair-radio kair-radio--" + key + " " + (it.estado === v ? "is-active" : ""),
            onclick: function () { state.data.items[idx].estado = v; renderAll(); },
            textContent: v === "BUENO" ? "B" : v === "MALO" ? "M" : "N/A"
          }));
        });
        tdEstado.appendChild(rg);
        tr.appendChild(tdEstado);
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "text", className: "kair-input", value: it.recomendaciones, oninput: function (e) { updateItem(idx, "recomendaciones", e.target.value); } })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "text", className: "kair-input", value: it.responsables, oninput: function (e) { updateItem(idx, "responsables", e.target.value); } })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "text", className: "kair-input", value: it.seguimiento, oninput: function (e) { updateItem(idx, "seguimiento", e.target.value); } })]));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);

      var itemsBody = tpl.el("div", { className: "kair-card__body kair-card__body--flush" });
      itemsBody.appendChild(tableWrap);

      var partWrap = tpl.el("div", { style: "padding:16px;border-top:1px solid #dee2e6;" });
      var partHeader = tpl.el("div", { className: "kair-flex kair-flex--between", style: "margin-bottom:10px;" }, [
        tpl.el("h4", { style: "font-size:0.85rem;font-weight:600;color:#1a1a2e;margin:0;", textContent: "Nombre Completo de Participantes" }),
        tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--secondary", onclick: addParticipante, style: "padding:4px 10px;font-size:0.78rem;" }, [tpl.icon("plus", 12), tpl.el("span", { textContent: "Agregar" })])
      ]);
      partWrap.appendChild(partHeader);
      var partGrid = tpl.el("div", { className: "kair-grid kair-grid--2" });
      state.data.participantes.forEach(function (p, idx) {
        var row = tpl.el("div", { style: "display:flex;gap:8px;" }, [
          tpl.el("input", { className: "kair-input", placeholder: "Nombre completo", value: p.nombre, oninput: function (e) { updateParticipante(idx, "nombre", e.target.value); } }),
          tpl.el("input", { className: "kair-input", placeholder: "Cargo", value: p.cargo, oninput: function (e) { updateParticipante(idx, "cargo", e.target.value); } }, ),
          tpl.el("button", { type: "button", className: "kair-icon-btn", onclick: function () { removeParticipante(idx); } }, [tpl.icon("trash-2", 14)])
        ]);
        partGrid.appendChild(row);
      });
      partWrap.appendChild(partGrid);
      itemsBody.appendChild(partWrap);

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
      var payload = { type: "equipos_emergencia", date: state.date, performedBy: state.performedBy, role: state.role, site: state.site, observations: state.observations, status: "Completada", data: state.data };
      var p = state.savedId ? api.updateInspection(state.savedId, payload) : api.createInspection(payload);
      p.then(function (res) {
        if (!res.success) throw new Error(res.error && res.error.message);
        state.savedId = res.data.inspection.id;
        tpl.toast("Guardado", "Inspección guardada correctamente", "success");
        renderAll();
      }).catch(function (e) { tpl.toast("Error", e.message, "error"); state.saving = false; renderAll(); });
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
  global.KairViews.FormEmergencia = FormEmergencia;
})(typeof window !== "undefined" ? window : this);