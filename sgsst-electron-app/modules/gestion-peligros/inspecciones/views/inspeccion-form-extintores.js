/* ============================================================
 * K+AIR · Formulario Extintores (GI-FO-026) — Vanilla JS
 * Patrón C — Workflow con sticky footer + tabla 12 columnas
 * ============================================================ */
(function (global) {
  "use strict";

  var T = global.KairInspectionTypes;
  var tpl = global.KairTemplates;
  var api = global.KairAPI;

  function FormExtintores(root, ctx) {
    var store = global.KairStore.getState();
    var meta = T.INSPECTION_TYPES.extintores;
    var editing = ctx.mode === "editar" && ctx.inspectionId;

    var state = {
      date: new Date().toISOString().slice(0, 10),
      performedBy: "", role: "", site: "", observations: "",
      data: T.emptyExtintoresData(),
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
        state.data = i.data || T.emptyExtintoresData();
        state.savedId = i.id;
        renderAll();
      });
    }

    function field(label, input) { return tpl.el("div", {}, [tpl.el("label", { className: "kair-form-label", textContent: label }), input]); }
    function updateRow(idx, f, v) { state.data.rows[idx][f] = v; }
    function addRow() {
      state.data.rows.push({ ubicacion: "", numero: "", tipo: "", capacidad: "", fechaRecarga: "", fechaVencimiento: "", presion: "", estadoCilindro: "", pasador: "", anillo: "", base: "", observaciones: "" });
      renderAll();
    }
    function removeRow(idx) { state.data.rows.splice(idx, 1); renderAll(); }

    function selectInput(value, options) {
      var s = tpl.el("select", { className: "kair-select" });
      s.appendChild(tpl.el("option", { value: "", textContent: "—" }));
      options.forEach(function (o) {
        s.appendChild(tpl.el("option", { value: o, textContent: o }));
      });
      s.value = value || "";
      return s;
    }

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
      commonBody.appendChild(field("Realizada por *", tpl.el("input", { type: "text", className: "kair-input", placeholder: "Nombre", value: state.performedBy, oninput: function (e) { state.performedBy = e.target.value; } })));
      commonBody.appendChild(field("Cargo", tpl.el("input", { type: "text", className: "kair-input", value: state.role, oninput: function (e) { state.role = e.target.value; } })));
      commonBody.appendChild(field("Sede / Sitio", tpl.el("input", { type: "text", className: "kair-input", value: state.site, oninput: function (e) { state.site = e.target.value; } })));
      main.appendChild(tpl.buildCard("Datos de la Inspección", commonBody));

      var itemsHeader = tpl.el("div", { className: "kair-flex kair-flex--between" }, [
        tpl.el("h2", { className: "kair-card__title", textContent: "Registro de Extintores Inspeccionados" }),
        tpl.el("button", { type: "button", className: "kair-header__action kair-header__action--secondary", onclick: addRow }, [tpl.icon("plus", 14), tpl.el("span", { textContent: "Agregar extintor" })])
      ]);
      var itemsCard = tpl.el("div", { className: "kair-card" });
      itemsCard.appendChild(tpl.el("div", { className: "kair-card__header" }, [itemsHeader]));

      var tableWrap = tpl.el("div", { className: "kair-table-wrap" });
      var table = tpl.el("table", { className: "kair-table" });
      table.appendChild(tpl.el("thead", {}, [tpl.el("tr", {}, [
        tpl.el("th", { textContent: "Ubicación" }),
        tpl.el("th", { textContent: "# Extintor", style: "width:100px;" }),
        tpl.el("th", { textContent: "Tipo", style: "width:90px;" }),
        tpl.el("th", { textContent: "Capacidad", style: "width:90px;" }),
        tpl.el("th", { textContent: "F. Recarga", style: "width:130px;" }),
        tpl.el("th", { textContent: "F. Vencimiento", style: "width:130px;" }),
        tpl.el("th", { textContent: "Presión", style: "width:130px;" }),
        tpl.el("th", { textContent: "Estado Cilindro", style: "width:130px;" }),
        tpl.el("th", { textContent: "Pasador", style: "width:110px;" }),
        tpl.el("th", { textContent: "Anillo", style: "width:110px;" }),
        tpl.el("th", { textContent: "Base", style: "width:110px;" }),
        tpl.el("th", { textContent: "Observaciones" }),
        tpl.el("th", { style: "width:50px;" })
      ])]));

      var tbody = tpl.el("tbody");
      state.data.rows.forEach(function (r, idx) {
        var tr = tpl.el("tr");
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "text", className: "kair-input", placeholder: "Recepción...", value: r.ubicacion, oninput: function (e) { updateRow(idx, "ubicacion", e.target.value); } })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "text", className: "kair-input", value: r.numero, oninput: function (e) { updateRow(idx, "numero", e.target.value); } })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "text", className: "kair-input", placeholder: "ABC", value: r.tipo, oninput: function (e) { updateRow(idx, "tipo", e.target.value); } })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "text", className: "kair-input", placeholder: "20 L", value: r.capacidad, oninput: function (e) { updateRow(idx, "capacidad", e.target.value); } })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "date", className: "kair-input", value: r.fechaRecarga, oninput: function (e) { updateRow(idx, "fechaRecarga", e.target.value); } })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "date", className: "kair-input", value: r.fechaVencimiento, oninput: function (e) { updateRow(idx, "fechaVencimiento", e.target.value); } })]));
        var presSel = selectInput(r.presion, ["OK", "BAJO", "ALTO"]);
        presSel.oninput = function (e) { updateRow(idx, "presion", e.target.value); };
        tr.appendChild(tpl.el("td", {}, [presSel]));
        var estadoSel = selectInput(r.estadoCilindro, ["BUENO", "REGULAR", "MALO"]);
        estadoSel.oninput = function (e) { updateRow(idx, "estadoCilindro", e.target.value); };
        tr.appendChild(tpl.el("td", {}, [estadoSel]));
        var pasadorSel = selectInput(r.pasador, ["BUENO", "MALO"]);
        pasadorSel.oninput = function (e) { updateRow(idx, "pasador", e.target.value); };
        tr.appendChild(tpl.el("td", {}, [pasadorSel]));
        var anilloSel = selectInput(r.anillo, ["BUENO", "MALO"]);
        anilloSel.oninput = function (e) { updateRow(idx, "anillo", e.target.value); };
        tr.appendChild(tpl.el("td", {}, [anilloSel]));
        var baseSel = selectInput(r.base, ["BUENO", "MALO"]);
        baseSel.oninput = function (e) { updateRow(idx, "base", e.target.value); };
        tr.appendChild(tpl.el("td", {}, [baseSel]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("input", { type: "text", className: "kair-input", value: r.observaciones, oninput: function (e) { updateRow(idx, "observaciones", e.target.value); } })]));
        tr.appendChild(tpl.el("td", {}, [tpl.el("button", { type: "button", className: "kair-icon-btn", onclick: function () { removeRow(idx); } }, [tpl.icon("trash-2", 14)])]));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);

      var itemsBody = tpl.el("div", { className: "kair-card__body kair-card__body--flush" });
      itemsBody.appendChild(tableWrap);
      itemsBody.appendChild(tpl.el("div", { style: "padding:16px;border-top:1px solid #dee2e6;" }, [
        tpl.el("label", { className: "kair-form-label", textContent: "Observaciones generales" }),
        tpl.el("textarea", { className: "kair-textarea", rows: 2, value: state.data.observaciones, oninput: function (e) { state.data.observaciones = e.target.value; } })
      ]));
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
      var payload = { type: "extintores", date: state.date, performedBy: state.performedBy, role: state.role, site: state.site, observations: state.observations, status: "Completada", data: state.data, companyId: store.companyId, companyName: store.companyName };
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
  global.KairViews.FormExtintores = FormExtintores;
})(typeof window !== "undefined" ? window : this);