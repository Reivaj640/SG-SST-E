/* ============================================================
 * K+AIR Bandeja Integrada — Calendar Operations
 * ===================================================================== */

(function () {
  "use strict";

  const H = window.BandejaHelpers;
  const S = window.BandejaState;
  const D = window.KairData;

  // ====== Google Calendar API getter ======
  function getGoogleCalendarApi() {
    try {
      var api = H.getElectronAPI();
      if (api && api.googleCalendar && typeof api.googleCalendar.create === "function") return api.googleCalendar;
    } catch (e) { }
    return null;
  }

  // ====== Event helpers ======
  function getEventStartHour(ev) {
    if (typeof ev.startHour === "number") return ev.startHour;
    if (typeof ev.start === "string" && ev.start.indexOf(":") >= 0) return parseInt(ev.start.split(":")[0], 10);
    return 9;
  }

  function getEventEndHour(ev) {
    if (typeof ev.end === "string" && ev.end.indexOf(":") >= 0) return parseInt(ev.end.split(":")[0], 10);
    if (typeof ev.durationHours === "number") return getEventStartHour(ev) + ev.durationHours;
    return getEventStartHour(ev) + 1;
  }

  function getEventStartDateTime(ev) {
    if (!ev || !ev.date) return null;
    var sh = getEventStartHour(ev);
    var parts = ev.date.split("-");
    if (parts.length !== 3) return null;
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), Math.floor(sh), Math.round((sh % 1) * 60));
    return d;
  }

  function initials(name) { return window.BandejaHelpers.initials(name); }
  function getCategoryStyle(cat) { return window.BandejaHelpers.getCategoryStyle(cat); }
  function formatGmailLongDate(dateVal) { return window.BandejaHelpers.formatGmailLongDate(dateVal); }
  function formatRelativeTime(dateVal) { return window.BandejaHelpers.formatRelativeTime(dateVal); }
  function initials(name) { return window.BandejaHelpers.initials(name); }

  // ====== Load events ======
  function loadEventsFromIPC() {
    var api = window.BandejaHelpers.getElectronAPI();
    var adapter = window.BandejaHelpers.getKairCalendarAdapter();
    if (!api || !adapter) {
      console.warn("[BandejaIntegrada] electronAPI/KairCalendarAdapter no disponible, usando mocks D.EVENTS (api=" + !!api + " adapter=" + !!adapter + ")");
      return Promise.resolve(D.EVENTS.slice());
    }
    try {
      var range = {
        start: S.viewYear + "-01-01",
        end: S.viewYear + "-12-31",
        scope: S.allCompanies ? "all" : "company"
      };
      console.log("[BandejaIntegrada] loadEventsFromIPC: range=", range);
      return adapter.list(range).then(function (result) {
        console.log("[BandejaIntegrada] adapter.list() result:", result && result.success ? "success, " + (result.data ? result.data.length : 0) + " events" : "failed");
        if (result && result.success && Array.isArray(result.data)) {
          if (result.data.length === 0) {
            console.warn("[BandejaIntegrada] IPC retorno 0 eventos. Usando mocks.");
            return D.EVENTS.slice();
          }
          var cumMapFromAdapter = (result && result.cumMap) || {};
          var normalized = result.data.map(function (ev) {
            return Object.assign({}, ev, {
              category: ev.type || ev.category || "plan",
              start: ev.start || ev.startTime || "00:00",
              end: ev.end || ev.endTime || "23:59"
            });
          });
          console.log("[BandejaIntegrada] IPC retorno " + normalized.length + " eventos del mundo real. Fuentes: " + JSON.stringify([...new Set(normalized.map(function (e) { return e.type || e.category; }))]));
          try {
            var gcalEvents = loadEventsFromGoogle(
              new Date(S.viewYear || new Date().getFullYear(), 0, 1).toISOString(),
              new Date(S.viewYear || new Date().getFullYear(), 11, 31, 23, 59, 59).toISOString()
            );
            if (gcalEvents && gcalEvents.length > 0) {
              if (cumMapFromAdapter && Object.keys(cumMapFromAdapter).length > 0) {
                gcalEvents.forEach(function (gev) {
                  if (gev && gev.id && cumMapFromAdapter[gev.id]) {
                    gev.cumplido = true;
                    gev.cumplidoEn = cumMapFromAdapter[gev.id].cumplidoEn;
                    gev.cumplidoNota = cumMapFromAdapter[gev.id].nota;
                  }
                });
              }
              normalized = normalized.concat(gcalEvents);
              console.log("[BandejaIntegrada] Google Calendar agrego " + gcalEvents.length + " eventos (sin duplicar)");
            }
          } catch (gcErr) {
            console.warn("[BandejaIntegrada] Sync con Google Calendar no completado:", gcErr);
          }
          // Deduplicate
          var seen = Object.create(null);
          var deduped = [];
          for (var di = 0; di < normalized.length; di++) {
            var e = normalized[di];
            if (!e) continue;
            var keys = [];
            if (e.googleEventId) keys.push(e.googleEventId);
            if (e.id) keys.push(e.id);
            if (keys.length === 0) { deduped.push(e); continue; }
            var existing = null;
            for (var k = 0; k < keys.length; k++) { if (seen[keys[k]]) { existing = seen[keys[k]]; break; } }
            if (existing) {
              var mergeFields = ["attendees", "htmlLink", "selfResponseStatus", "organizer", "hangoutLink", "conferenceData"];
              for (var fi = 0; fi < mergeFields.length; fi++) {
                var field = mergeFields[fi];
                if (Array.isArray(e[field]) && e[field].length > 0) {
                  if (!Array.isArray(existing[field]) || existing[field].length === 0) existing[field] = e[field];
                } else if (e[field] && !existing[field]) existing[field] = e[field];
              }
            } else {
              deduped.push(e);
              for (var m = 0; m < keys.length; m++) seen[keys[m]] = e;
            }
          }
          return deduped;
        }).catch(function (e) {
          console.error("[BandejaIntegrada] Error cargando eventos del adapter, usando mocks:", e);
          return D.EVENTS.slice();
        });
      });
    }

    function loadEventsFromGoogle(rangeStart, rangeEnd) {
      var gcal = getGoogleCalendarApi();
      if (!gcal) return Promise.resolve([]);
      return gcal.list({
        timeMin: rangeStart || new Date(Date.now() - 7 * 86400000).toISOString(),
        timeMax: rangeEnd || new Date(Date.now() + 60 * 86400000).toISOString()
      }).then(function (res) {
        if (!res || !res.success || !Array.isArray(res.data)) return [];
        return res.data.filter(function (e) { return e && e.googleEventId; });
      }).catch(function (err) {
        console.warn("[BandejaIntegrada] No se pudieron traer eventos de Google Calendar:", err);
        return [];
      });
    }

    function refreshEvents() {
      S.refreshing = true;
      S.mailLoading = true;
      if (H.$("#refresh-icon")) H.$("#refresh-icon").classList.add("kair-spin");
      window.BandejaRenderCalendar.render(document.getElementById("calendar-slide"));
      return loadEventsFromIPC().then(function (events) {
        S.events = events;
        window.BandejaHelpers.refreshKairAlerts();
        if (S.calendarVisible) window.BandejaRenderCalendar.render(document.getElementById("calendar-slide"));
        window.BandejaHelpers.toast("Sincronizado", S.events.length + " eventos · " + S.mails.length + " correos", "success");
      }).catch(function (err) {
        console.warn("[BandejaIntegrada] Error refrescando eventos:", err);
        window.BandejaHelpers.toast("Error", "No se pudieron cargar los eventos", "error");
      }).finally(function () {
        S.refreshing = false; S.mailLoading = false;
        if (H.$("#refresh-icon")) H.$("#refresh-icon").classList.remove("kair-spin");
        window.BandejaRenderCalendar.render(document.getElementById("calendar-slide"));
      });
    }

    function reloadEventsForScope() {
      S.refreshing = true;
      S.mailLoading = true;
      if (H.$("#refresh-icon")) H.$("#refresh-icon").classList.add("kair-spin");
      window.BandejaRenderCalendar.render(document.getElementById("calendar-slide"));
      return loadEventsFromIPC().then(function (events) {
        S.events = events;
        S.events.forEach(function (ev) { if (ev && ev.category && !S.activeCategories.has(ev.category)) S.activeCategories.add(ev.category); });
        var scope = S.allCompanies ? "todas las empresas" : (window.BandejaHelpers.getActiveCompanyName() || "la empresa actual");
        window.BandejaHelpers.toast(S.allCompanies ? "Mostrando todas las empresas" : "Mostrando solo " + scope, S.events.length + " eventos cargados", "info");
      }).finally(function () {
        S.refreshing = false; S.mailLoading = false;
        if (H.$("#refresh-icon")) H.$("#refresh-icon").classList.remove("kair-spin");
        window.BandejaRenderCalendar.render(document.getElementById("calendar-slide"));
      });
    }

    // ====== Google Calendar ======
    function connectGoogleCalendar() {
      var api = getElectronAPI();
      if (api && api.google && api.google.start) {
        api.google.start().then(function (res) {
          if (res && res.success) {
            window.BandejaHelpers.toast("Google Calendar", "Autorización iniciada. Completá el flujo en el navegador.", "info");
          }
        });
      }
    }

    function getEventStartDateTime(ev) {
      if (!ev || !ev.date) return null;
      var sh = getEventStartHour(ev);
      var parts = ev.date.split("-");
      if (parts.length !== 3) return null;
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), Math.floor(sh), Math.round((sh % 1) * 60));
    }

    function getEventStartHour(ev) {
      if (typeof ev.startHour === "number") return ev.startHour;
      if (typeof ev.start === "string" && ev.start.indexOf(":") >= 0) return parseInt(ev.start.split(":")[0], 10);
      return 9;
    }

    function getEventEndHour(ev) {
      if (typeof ev.end === "string" && ev.end.indexOf(":") >= 0) return parseInt(ev.end.split(":")[0], 10);
      if (typeof ev.durationHours === "number") return getEventStartHour(ev) + ev.durationHours;
      return getEventStartHour(ev) + 1;
    }

    function getUpcomingEvents(withinHours) {
      if (!S.events) return [];
      var now = new Date();
      var max = new Date(now.getTime() + (withinHours || 24) * 3600 * 1000);
      return S.events.filter(function (ev) {
        if (!ev || !ev.date) return false;
        if (S.activeCategories && !S.activeCategories.has(ev.category)) return false;
        var d = getEventStartDateTime(ev);
        if (!d) return false;
        return d >= now && d <= max;
      }).sort(function (a, b) { return getEventStartDateTime(a).getTime() - getEventStartDateTime(b).getTime(); });
    }

    function refreshKairAlerts() {
      try {
        var KA = (window.KairAlerts) || (window.parent && window.parent.KairAlerts);
        if (KA && typeof KA.refresh === "function") KA.refresh();
      } catch (e) { }
    }

    function selectDate(dateStr) {
      S.selectedDate = dateStr;
      window.BandejaRenderCalendar.render(document.getElementById("calendar-slide"));
    }

    window.BandejaCalendarOps = {
      loadEventsFromIPC: loadEventsFromIPC,
      loadEventsFromGoogle: loadEventsFromGoogle,
      refreshEvents: refreshEvents,
      reloadEventsForScope: reloadEventsForScope,
      connectGoogleCalendar: connectGoogleCalendar,
      getEventStartHour: getEventStartHour,
      getEventEndHour: getEventEndHour,
      getEventStartDateTime: getEventStartDateTime,
      getUpcomingEvents: getUpcomingEvents,
      refreshKairAlerts: refreshKairAlerts,
      selectDate: selectDate
    };
  })();