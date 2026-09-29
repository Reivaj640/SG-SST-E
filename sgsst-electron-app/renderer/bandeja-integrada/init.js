/* ============================================================
 * K+AIR Bandeja Integrada — Init / Bootstrap
 * ===================================================================== */

(function () {
  "use strict";

  const H = window.BandejaHelpers;
  const S = window.BandejaState;

  // ====== Initialize ======
  function init() {
    // State init
    if (D.MONTH_VIEW) {
      S.viewYear = D.MONTH_VIEW.year;
      S.viewMonth = D.MONTH_VIEW.month;
      S.viewMonthLabel = D.MONTH_LABELS_ES[S.viewMonth] + " " + S.viewYear;
    }

    // Load modules that need to be available globally
    // The module scripts are loaded via index.html script tags

    // Bind events
    window.BandejaHandlers.bindEvents();

    // Initial render
    render();

    // Start auto-refresh if connected
    if (S.gmailConnected) window.BandejaMailOps.startAutoRefresh();

    console.log("[BandejaIntegrada] Init completado");
  }

  // ====== Main render ======
  function render() {
    var container = document.getElementById("kair-app");
    if (!container) return;

    container.innerHTML = "";

    var main = H.el("main", { class: "kair-main", id: "kair-main" });

    // KPI Strip
    var kpiStrip = H.el("div", { class: "kair-kpi-strip", id: "kpi-strip" });
    main.appendChild(kpiStrip);

    // Layout
    var layout = H.el("div", { class: "kair-layout", id: "kair-layout" });

    // Sidebar
    var sidebar = H.el("aside", { class: "kair-card kair-sidebar", id: "sidebar", style: "border-radius: 10px 0 0 10px;" });
    main.appendChild(sidebar);

    // Panel toggle
    var panelToggle = H.el("button", { class: "kair-panel-toggle", id: "panel-toggle", "data-calendar-visible": true, "aria-label": "Ocultar calendario", title: "Ocultar calendario (ver correo)" });
    panelToggle.innerHTML = '<svg class="kair-panel-toggle__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
    main.appendChild(panelToggle);

    // Content area
    var contentArea = H.el("div", { class: "kair-content-area", id: "content-area", "data-calendar-visible": "true" });

    // Mail stack (always rendered)
    var mailStack = H.el("div", { class: "kair-mail-stack" });
    var listContainer = H.el("div", { class: "kair-mail-stack__list", id: "mail-list-container" });
    var detailContainer = H.el("div", { class: "kair-mail-stack__detail", id: "mail-detail-container" });
    mailStack.appendChild(listContainer);
    mailStack.appendChild(detailContainer);
    contentArea.appendChild(mailStack);

    // Calendar slide
    var calendarSlide = H.el("div", { class: "kair-calendar-slide", id: "calendar-slide", "data-visible": "true" });
    contentArea.appendChild(calendarSlide);

    main.appendChild(layout);

    // Footer
    var footer = H.el("footer", { class: "kair-footer" });
    footer.innerHTML = '<div class="kair-footer__left"><strong>K+AIR</strong> · Bandeja Integrada v0.1.120<span>·</span>SG-SST · Resolución 0312 de 2019<span>·</span><span id="footer-events-count">0 eventos visibles</span></div><div class="kair-footer__right"><span id="footer-company">Empresa: Todas</span><span>·</span><span id="footer-view">Vista: Calendario + Bandeja</span></div>';
    main.appendChild(footer);

    container.appendChild(main);

    // Modal overlay
    var modalOverlay = H.el("div", { class: "kair-modal-overlay", id: "modal-overlay", hidden: true });
    var eventModal = H.el("div", { class: "kair-card kair-modal", id: "event-modal" });
    modalOverlay.appendChild(eventModal);
    container.appendChild(modalOverlay);

    // File viewer overlay
    var fvOverlay = H.el("div", { class: "kair-fv-overlay", id: "fv-overlay", hidden: true });
    fvOverlay.innerHTML = '<div class="kair-fv-modal">' +
      '<header class="kair-fv-header">' +
        '<div class="kair-fv-header__title"><span class="kair-fv-header__ext" id="fv-ext-badge">…</span><span class="kair-fv-header__name" id="fv-filename">Sin archivo</span><span class="kair-fv-header__meta" id="fv-filesize">—</span></div>' +
        '<div class="kair-fv-header__actions"><button class="kair-fv-btn" id="fv-close-btn" title="Cerrar (ESC)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span>Cerrar</span></button></div>' +
      '</header>' +
      '<div class="kair-fv-body" id="fv-body"></div>' +
      '<input type="file" id="fv-file-input" hidden accept=".pptx,.ppt,.pptm,.potx,.ppsx,.odp,.docx,.doc,.docm,.dotx,.rtf,.odt,.xlsx,.xls,.xlsm,.xlsb,.csv,.ods,.pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.tif,.tiff,.ico,.heic,.mp4,.webm,.mp3,.wav,.ogg,.m4a,.flac,.txt,.md,.json,.xml,.yaml,.yml,.csv,.tsv,.eml,.msg,.zip" title="Elegir archivo para previsualizar con @file-viewer" />' +
    '</div>';
    container.appendChild(fvOverlay);

    // Toast container
    var toastContainer = H.el("div", { class: "kair-toast-container", id: "toast-container" });
    container.appendChild(toastContainer);

    // Initial renders
    window.BandejaRenderSidebar.render(document.getElementById("sidebar"));
    window.BandejaRenderMailList.render(document.getElementById("mail-list-container"));
    window.BandejaRenderCalendar.render(document.getElementById("calendar-slide"));

    // Update Gmail indicator
    window.BandejaMailOps.updateGmailIndicator();

    // Start auto-refresh if connected
    if (window.BandejaState.gmailConnected) window.BandejaMailOps.startAutoRefresh();
  }

  // ====== Destroy ======
  function destroy() {
    window.BandejaMailOps.stopAutoRefresh();
    document.removeEventListener("visibilitychange", window.BandejaHelpers.handleVisibilityChange);
    if (S._resizeTimeout) { clearTimeout(S._resizeTimeout); S._resizeTimeout = null; }
    var fvOverlay = document.getElementById("fv-overlay");
    if (fvOverlay) document.removeEventListener("keydown", window.BandejaHelpers.handleFvKeydown);
    S.mails = []; S.events = []; S.labels = []; S.checkedIds.clear();
    console.log("[BandejaIntegrada] Destroy completado - cleanup de listeners/intervals");
    try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: "bandeja-integrada-destroyed" }, "*"); } catch (_) {}
  }

  // ====== Expose API ======
  window.BandejaIntegrada = {
    init: init,
    render: render,
    destroy: destroy,
    setRerenderCallback: function (fn) { window.BandejaRender._onRerender = fn; }
  };

  // Auto-init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();