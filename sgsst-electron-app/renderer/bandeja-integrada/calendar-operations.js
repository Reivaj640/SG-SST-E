/* ============================================================
 * K+AIR Bandeja Integrada — Calendar Operations
 * =====================================================================
 * P1-CRO-AUDIT-4/5 fix (2026-09-07) — Este archivo estaba lleno de dead code
 * con bugs latentes:
 *   - loadEventsFromGoogle se llamaba sin await
 *   - reloadEventsForScope usaba `window.BandejaHelpers.getActiveCompanyName()`
 *     que NO está definida en helpers.js (está en app.js:2954)
 *   - getUpcomingEvents, refreshKairAlerts, getEventStartHour/End/DateTime
 *     no se llamaban desde ningún archivo del Bandeja
 *
 * Después del grep, solo se usan 3 funciones:
 *   - loadEventsFromIPC (llamada por event-modal.js:165)
 *   - selectDate (llamada por render-calendar.js:131 y render-sidebar.js:91)
 *   - connectGoogleCalendar (llamada por render-sidebar.js:94)
 *
 * El resto (loadEventsFromIPC nativo de esta archivo, refreshEvents,
 * reloadEventsForScope) se implementa INLINE en app.js porque tiene
 * dependencias que solo existen allí (state.viewYear, getActiveCompanyName).
 *
 * El adapter KairCalendarAdapter (shared/kair-calendar-adapter.js) es la
 * fuente de verdad para cargar eventos. Este archivo solo expone los
 * helpers mínimos que el render y el modal necesitan.
 * ===================================================================== */

(function () {
  "use strict";

  const H = window.BandejaHelpers;

  // ====== Cargar eventos vía el adapter compartido ======
  // Delega al KairCalendarAdapter (que es el source of truth desde 📦543).
  function loadEventsFromIPC() {
    var adapter = H.getKairCalendarAdapter();
    if (!adapter) return Promise.resolve([]);
    var year = (window.BandejaState && window.BandejaState.viewYear) || new Date().getFullYear();
    var range = {
      start: year + "-01-01",
      end: year + "-12-31",
      scope: (window.BandejaState && window.BandejaState.allCompanies) ? "all" : "company"
    };
    return adapter.list(range).then(function (result) {
      if (result && result.success && Array.isArray(result.data)) return result.data;
      return [];
    }).catch(function (err) {
      console.warn("[BandejaIntegrada] loadEventsFromIPC falló:", err);
      return [];
    });
  }

  // ====== Google Calendar connect ======
  // Dispara el flujo OAuth via electronAPI.google.start. La respuesta
  // abre el navegador externo.
  function connectGoogleCalendar() {
    var api = H.getElectronAPI();
    if (api && api.google && api.google.start) {
      api.google.start().then(function (res) {
        if (res && res.success) {
          H.toast("Google Calendar", "Autorización iniciada. Completá el flujo en el navegador.", "info");
        }
      });
    }
  }

  // ====== Selección de día (mini-cal o mes) ======
  // Guarda la fecha en state y re-renderiza el calendario principal.
  function selectDate(dateStr) {
    if (window.BandejaState) {
      window.BandejaState.selectedDate = dateStr;
      window.BandejaRenderCalendar.render(document.getElementById("calendar-slide"));
    }
  }

  window.BandejaCalendarOps = {
    loadEventsFromIPC: loadEventsFromIPC,
    connectGoogleCalendar: connectGoogleCalendar,
    selectDate: selectDate
  };
})();
