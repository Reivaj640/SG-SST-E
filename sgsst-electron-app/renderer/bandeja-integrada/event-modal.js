/* ============================================================
 * K+AIR Bandeja Integrada — Event Modal
 * ===================================================================== */

(function () {
  "use strict";

  const H = window.BandejaHelpers;
  const S = window.BandejaState;
  const D = window.KairData;

  function getCategoryStyle(cat) { return window.BandejaHelpers.getCategoryStyle(cat); }
  function initials(name) { return window.BandejaHelpers.initials(name); }
  function escapeHtml(s) { return String(s || "").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """).replace(/'/g, "'"); }
  function fmtHour(h) { return window.BandejaHelpers.fmtHour(h); }

  window.BandejaEventModal = {
    open: function (ev) {
      ev = ev || {};
      var isEdit = !!ev.id;
      var draft = {
        title: ev.title || "",
        date: ev.date || "",
        startHour: ev.startHour || 10,
        durationHours: ev.durationHours || 1,
        location: ev.location || "",
        attendees: ev.attendees || "",
        notes: ev.notes || "",
        category: ev.category || "plan",
        linkedMailId: ev.linkedMailId,
      };
      S.draft = draft;
      S.linkedMailSubject = ev.subject;

      var modal = H.el("div", { class: "kair-modal-overlay", id: "modal-overlay" });
      modal.hidden = false;
      var card = H.el("div", { class: "kair-card kair-modal", id: "event-modal" });
      modal.appendChild(card);
      document.body.appendChild(modal);

      var categories = Object.values(D.EVENT_CATEGORIES);
      var availableDates = D.MONTH_GRID.flat().filter(function (c) { return c.inMonth; }).map(function (c) { return c.iso; });
      var durations = [0.5, 1, 1.5, 2, 3, 4];

      function render() {
        card.innerHTML = '<div class="kair-modal__header"><h3 class="kair-modal__title" id="compose-panel-title">' + (isEdit ? "Editar evento" : "Nuevo evento") + '</h3><button class="kair-icon-btn" id="modal-close" aria-label="Cerrar" title="Cerrar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div>' +
          '<div class="kair-modal__body">' +
            '<div class="kair-field"><label class="kair-field__label">Título</label><input type="text" class="kair-field__input" id="draft-title" value="' + escapeHtml(draft.title) + '" placeholder="Ej: Reunión de seguimiento SG-SST" /></div>' +
            '<div class="kair-field"><label class="kair-field__label">Categoría</label><div class="kair-chip-select">' + categories.map(function (c) { return '<button class="kair-chip-select__option" data-cat="' + c.id + '" data-active="' + (draft.category === c.id) + '" style="' + (draft.category === c.id ? "background:" + c.bg + ";border-color:" + c.color + ";color:" + c.color + ";" : "") + '"><span class="kair-chip-select__dot" style="background:' + c.color + ';"></span>' + c.label + "</button>"; }).join("") + '</div></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
              '<div class="kair-field"><label class="kair-field__label">' + D.ICONS.calendarPlus + ' Fecha</label><select class="kair-select" id="draft-date">' + availableDates.map(function (iso) { return '<option value="' + iso + '"' + (draft.date === iso ? " selected" : "") + '>' + D.WEEKDAY_LABELS[new Date(iso + "T12:00:00").getDay()] + " " + parseInt(iso.split("-")[2], 10) + "</option>"; }).join("") + '</select></div>' +
              '<div class="kair-field"><label class="kair-field__label">' + D.ICONS.clock + ' Hora</label><select class="kair-select" id="draft-hour">' + Array.from({ length: 24 }, function (_, h) { return '<option value="' + h + '"' + (draft.startHour === h ? " selected" : "") + '>' + String(h).padStart(2, "0") + ":00</option>"; }).join("") + '</select></div>' +
            '</div>' +
            '<div class="kair-field"><label class="kair-field__label">Duración</label><div class="kair-duration-row">' + durations.map(function (d) { return '<button class="kair-duration-row__btn" data-dur="' + d + '" data-active="' + (draft.durationHours === d) + '">' + (d === 0.5 ? "30 min" : d + "h") + "</button>"; }).join("") + '</div></div>' +
            '<div class="kair-field"><label class="kair-field__label">' + D.ICONS.mapPin + ' Lugar</label><input type="text" class="kair-field__input" id="draft-location" value="' + escapeHtml(draft.location) + '" placeholder="Sala de juntas, dirección, enlace..." /></div>' +
            '<div class="kair-field"><label class="kair-field__label">' + D.ICONS.users + ' Asistentes</label><input type="text" class="kair-field__input" id="draft-attendees" value="' + escapeHtml(draft.attendees) + '" placeholder="correos separados por coma" /></div>' +
            '<div class="kair-field"><label class="kair-field__label">Notas</label><textarea class="kair-field__textarea" id="draft-notes" rows="2" placeholder="Agenda, materiales, recordatorios...">' + escapeHtml(draft.notes) + "</textarea></div>" +
          '</div>' +
          '<div class="kair-modal__footer">' +
            '<button class="kair-header__action--ghost" id="modal-cancel">Cancelar</button>' +
            '<button class="kair-header__action--primary" id="modal-save" ' + (!draft.title.trim() ? "disabled" : "") + ' style="' + (!draft.title.trim() ? "opacity:0.5;cursor:not-allowed;" : "") + '">' + (isEdit ? "Guardar cambios" : "Crear evento") + '</button>' +
          '</div>';
        card.innerHTML = modalContent;

        // Bindings
        var closeModal = function () { if (modal.parentNode) modal.parentNode.removeChild(modal); };
        card.querySelector("#modal-close").addEventListener("click", closeModal);
        modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });

        card.querySelector("#draft-title").addEventListener("input", function (e) { S.draft.title = e.target.value; var saveBtn = card.querySelector("#modal-save"); saveBtn.disabled = !e.target.value.trim(); saveBtn.style.opacity = e.target.value.trim() ? "1" : "0.5"; saveBtn.style.cursor = e.target.value.trim() ? "pointer" : "not-allowed"; });

        card.querySelector("#draft-date").addEventListener("change", function (e) { S.draft.date = e.target.value; });
        card.querySelector("#draft-hour").addEventListener("change", function (e) { S.draft.startHour = parseInt(e.target.value, 10); });
        card.querySelector("#draft-location").addEventListener("input", function (e) { S.draft.location = e.target.value; });
        card.querySelector("#draft-attendees").addEventListener("input", function (e) { S.draft.attendees = e.target.value; });
        card.querySelector("#draft-notes").addEventListener("input", function (e) { S.draft.notes = e.target.value; });

        card.querySelectorAll(".kair-chip-select__option").forEach(function (b) { b.addEventListener("click", function () { S.draft.category = b.getAttribute("data-cat"); render(); }); });
        card.querySelectorAll(".kair-duration-row__btn").forEach(function (b) { b.addEventListener("click", function () { S.draft.durationHours = parseFloat(b.getAttribute("data-dur")); render(); }); });

        card.querySelector("#draft-location").addEventListener("input", function (e) { S.draft.location = e.target.value; });
        card.querySelector("#draft-attendees").addEventListener("input", function (e) { S.draft.attendees = e.target.value; });
        card.querySelector("#draft-notes").addEventListener("input", function (e) { S.draft.notes = e.target.value; });

        card.querySelector("#modal-close").addEventListener("click", closeModal);
        card.querySelector("#modal-cancel").addEventListener("click", closeModal);
        card.querySelector("#modal-save").addEventListener("click", function () { saveEvent(); });

        // Focus title
        setTimeout(function () { var t = card.querySelector("#draft-title"); if (t) { t.focus(); var len = t.value.length; t.setSelectionRange(len, len); } }, 50);
      }

      function saveEvent() {
        var S = window.BandejaState;
        var startH = S.draft.startHour || 10;
        var durH = S.draft.durationHours || 1;
        var newEvent = {
          id: "rapido-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
          title: S.draft.title.trim() || "Evento sin título",
          date: S.draft.date,
          start: String(startH).padStart(2, "0") + ":00",
          end: String(startH + Math.ceil(durH)).padStart(2, "0") + ":00",
          startHour: startH,
          durationHours: durH,
          category: S.draft.category,
          type: "rapido",
          location: S.draft.location || undefined,
          notes: S.draft.notes || undefined,
          linkedMailId: S.draft.linkedMailId,
          attendees: S.draft.attendees ? S.draft.attendees.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : undefined,
        };

        var adapter = window.BandejaHelpers.getKairCalendarAdapter();
        if (!adapter) {
          S.events.push(newEvent);
          closeModal();
          window.BandejaHelpers.toast("Evento guardado (sin persistir)", newEvent.title + " · " + newEvent.date, "warning");
          S.calendarVisible = false;
          window.BandejaRenderCalendar.render(document.getElementById("calendar-slide"));
          return;
        }

        try {
          adapter.create(newEvent).then(function (res) {
            if (res && res.success) {
              if (res.data && res.data.id && res.data.id !== newEvent.id) newEvent.id = res.data.id;
              S.events = loadEventsFromIPC().then(function (evs) { S.events = evs; });
              var gcalApi = window.BandejaHelpers.getGoogleCalendarApi();
              if (gcalApi) {
                try {
                  var gRes = gcalApi.create(newEvent);
                  if (gRes && gRes.success && gRes.data && gRes.data.googleEventId) {
                    newEvent.googleEventId = gRes.data.googleEventId; newEvent.source = "kair";
                    try { adapter.update(newEvent); S.events = loadEventsFromIPC().then(function (evs) { S.events = evs; }); window.BandejaHelpers.toast("Evento guardado y sincronizado", newEvent.title + " · " + newEvent.date + " · Google Calendar ✓", "success"); } catch (uErr) { console.warn("[BandejaIntegrada][SAVE] No se pudo guardar googleEventId local:", uErr); window.BandejaHelpers.toast("Evento guardado y sincronizado", newEvent.title + " · " + newEvent.date + " · Google Calendar ✓", "success"); }
                  } else { window.BandejaHelpers.toast("Evento guardado y sincronizado", newEvent.title + " · " + newEvent.date, "success"); }
                } catch (gErr) { console.warn("[BandejaIntegrada][SAVE] No se pudo sincronizar con Google Calendar:", gErr); window.BandejaHelpers.toast("Evento guardado localmente", newEvent.title + " · " + newEvent.date + " · Calendar no disponible", "warning"); }
              } else { window.BandejaHelpers.toast("Evento guardado y sincronizado", newEvent.title + " · " + newEvent.date, "success"); }
            } else { window.BandejaHelpers.toast("Evento guardado y sincronizado", newEvent.title + " · " + newEvent.date, "success"); }

            S.events.forEach(function (ev) { if (ev && ev.category && !S.activeCategories.has(ev.category)) S.activeCategories.add(ev.category); });
            closeModal();
            S.calendarVisible = false;
            window.BandejaRenderCalendar.render(document.getElementById("calendar-slide"));
          }).catch(function (err) { S.events.push(newEvent); closeModal(); window.BandejaHelpers.toast("No se pudo persistir el evento", (res && res.error) || "error desconocido", "error"); });
        }

        function closeModal() { if (modal.parentNode) modal.parentNode.removeChild(modal); S.eventModalOpen = false; }
        function loadEventsFromIPC() { return window.BandejaCalendarOps.loadEventsFromIPC(); }
        var isEdit = false;
        var modal = H.el("div", { class: "kair-modal-overlay", id: "modal-overlay" });
        modal.hidden = false;
        var card = H.el("div", { class: "kair-card kair-modal", id: "event-modal" });
        modal.appendChild(card);
        document.body.appendChild(modal);
        render();
      }
    };
  })();