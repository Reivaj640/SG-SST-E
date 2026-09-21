/* ============================================================
 * K+AIR Bandeja Integrada — Estado Central
 * ============================================================ */

(function () {
  "use strict";

  // ====== Estado del renderer (vanilla) ======
  window.BandejaState = {
    calendarVisible: true,      // true = calendario overlay visible | false = solo correo
    mails: [],
    events: [],
    selectedMailId: null,
    mailFilter: "all",          // "all" | "unread" | "flagged" | "meeting" | "sent"
    mailFolder: "INBOX",        // "INBOX" | "SENT" — carpeta de Gmail que se está mostrando
    searchQuery: "",            // query de búsqueda en tiempo real (vacío = sin filtro)
    labels: [],                 // labels de Gmail cacheados
    refreshing: false,
    mailLoading: false,
    allCompanies: true,
    checkedIds: new Set(),
    activeLabelIds: new Set(),   // Labels de usuario activos como filtro adicional
    selectedDate: null,
    userEmail: null,             // email del usuario autenticado (para RSVP)
    activeCategories: new Set(),
    calView: "month",            // "day" | "week" | "month" | "schedule"
    viewYear: null,              // se inicializa en init() desde D.MONTH_VIEW
    viewMonth: null,             // 0-indexed (0=enero, 6=julio)
    viewMonthLabel: "",          // "Julio 2026"
    dropTarget: null,
    eventModalOpen: false,
    draft: {
      title: "",
      date: "",
      startHour: 10,
      durationHours: 1,
      location: "",
      attendees: "",
      notes: "",
      category: "plan",
      linkedMailId: undefined,
    },
    linkedMailSubject: undefined,
    gmailConnected: false,
  };

  // Getters / Setters para encapsular
  window.BandejaState.get = function (key) {
    return window.BandejaState[key];
  };

  window.BandejaState.set = function (key, value) {
    window.BandejaState[key] = value;
  };

  window.BandejaState.setMultiple = function (obj) {
    Object.keys(obj).forEach(function (k) {
      if (window.BandejaState.hasOwnProperty(k)) {
        window.BandejaState[k] = obj[k];
      }
    });
  };

  window.BandejaState.reset = function () {
    window.BandejaState.mails = [];
    window.BandejaState.events = [];
    window.BandejaState.selectedMailId = null;
    window.BandejaState.mailFilter = "all";
    window.BandejaState.mailFolder = "INBOX";
    window.BandejaState.searchQuery = "";
    window.BandejaState.labels = [];
    window.BandejaState.refreshing = false;
    window.BandejaState.mailLoading = false;
    window.BandejaState.checkedIds.clear();
    window.BandejaState.activeLabelIds.clear();
    window.BandejaState.selectedDate = null;
    window.BandejaState.userEmail = null;
    window.BandejaState.activeCategories.clear();
    window.BandejaState.calView = "month";
    window.BandejaState.viewYear = null;
    window.BandejaState.viewMonth = null;
    window.BandejaState.viewMonthLabel = "";
    window.BandejaState.dropTarget = null;
    window.BandejaState.eventModalOpen = false;
    window.BandejaState.draft = {
      title: "",
      date: "",
      startHour: 10,
      durationHours: 1,
      location: "",
      attendees: "",
      notes: "",
      category: "plan",
      linkedMailId: undefined,
    };
    window.BandejaState.linkedMailSubject = undefined;
    window.BandejaState.gmailConnected = false;
    window.BandejaState.allCompanies = true;
  };
})();