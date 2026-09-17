/* ============================================================
 * K+AIR Bandeja Integrada — Event Handlers
 * ===================================================================== */

(function () {
  "use strict";

  const H = window.BandejaHelpers;
  const S = window.BandejaState;

  function bindEvents() {
    var container = document.getElementById("kair-app");
    if (!container) return;

    // Header buttons
    var backBtn = H.$("#btn-back");
    if (backBtn) backBtn.addEventListener("click", function () { if (window.parent && window.parent !== window) { try { window.parent.postMessage({ type: "bandeja-integrada-back" }, "*"); } catch (e) { } } });

    var composeBtn = H.$("#btn-compose");
    if (composeBtn) composeBtn.addEventListener("click", function () { window.BandejaComposeModal.open("new"); });

    var signatureBtn = H.$("#btn-signature");
    if (signatureBtn) signatureBtn.addEventListener("click", function () { window.BandejaHelpers.toast("Firma", "Editor de firma - próximamente", "info"); });

    var fvBtn = H.$("#btn-fv-test");
    if (fvBtn) fvBtn.addEventListener("click", function () { var input = document.getElementById("fv-file-input"); if (input) { input.value = ""; input.click(); } });

    var gmailIndicator = H.$("#gmail-indicator");
    if (gmailIndicator) gmailIndicator.addEventListener("click", function () { if (window.parent && window.parent !== window) { try { window.parent.postMessage({ type: "bandeja-integrada-open-config", section: "empresas" }, "*"); } catch (e) { } } });

    var refreshBtn = H.$("#btn-refresh");
    if (refreshBtn) refreshBtn.addEventListener("click", function () { window.BandejaMailOps.refresh(); });

    // Panel toggle (calendar)
    var panelToggle = H.$("#panel-toggle");
    if (panelToggle) {
      panelToggle.addEventListener("click", function () {
        var S = window.BandejaState;
        S.calendarVisible = !S.calendarVisible;
        panelToggle.setAttribute("data-calendar-visible", S.calendarVisible);
        panelToggle.setAttribute("aria-label", S.calendarVisible ? "Ocultar calendario" : "Abrir calendario");
        panelToggle.title = S.calendarVisible ? "Ocultar calendario (ver correo)" : "Ver calendario";
        var icon = panelToggle.querySelector(".kair-panel-toggle__icon");
        if (icon) icon.innerHTML = S.calendarVisible ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
        var contentArea = document.getElementById("content-area");
        if (contentArea) contentArea.setAttribute("data-calendar-visible", S.calendarVisible);
        var calendarSlide = document.getElementById("calendar-slide");
        if (calendarSlide) calendarSlide.setAttribute("data-visible", S.calendarVisible);
        window.BandejaRenderSidebar.render(document.getElementById("sidebar"));
        window.BandejaRenderCalendar.render(document.getElementById("calendar-slide"));
      });
    }

    // Company selector
    var companyBtn = H.$("#company-name");
    if (companyBtn) companyBtn.addEventListener("click", function () { window.BandejaHelpers.toast("Empresas", "Selector de empresas - próximamente", "info"); });

    // Search input
    var searchInput = H.$("#search-input");
    if (searchInput) {
      searchInput.addEventListener("input", function (e) {
        window.BandejaState.searchQuery = e.target.value || "";
        window.BandejaRenderMailList.applySearchFilter();
      });
    }

    // Mail list: click row -> select
    var listContainer = document.getElementById("mail-list-container");
    if (listContainer) {
      listContainer.addEventListener("click", function (e) {
        var row = e.target.closest(".email-row, .kair-mail-row");
        if (row && row.dataset.mailId) {
          window.BandejaState.selectedMailId = row.dataset.mailId;
          window.BandejaRenderMailDetail.render(document.getElementById("mail-detail-container"));
        }
      });
    }

    // Detail actions (delegate)
    var detailContainer = document.getElementById("mail-detail-container");
    if (detailContainer) {
      detailContainer.addEventListener("click", function (e) {
        var mail = window.BandejaState.mails.find(function (m) { return m.id === window.BandejaState.selectedMailId; });
        if (!mail) return;

        if (e.target.closest("[data-action=toggle-details]")) {
          var panel = document.getElementById("mail-details-panel");
          var expanded = !panel.hasAttribute("hidden");
          panel.hidden = expanded;
          e.target.setAttribute("aria-expanded", !expanded);
        } else if (e.target.closest(".kair-mail-attachment__download")) {
          var att = e.target.closest(".kair-mail-attachment");
          if (att) {
            var msgId = att.dataset.msgId;
            var attId = att.dataset.attId;
            var fileName = att.querySelector(".kair-mail-attachment__name").textContent;
            window.BandejaMailOps.downloadMailAttachment(msgId, attId, fileName);
          }
        } else if (e.target.closest(".kair-mail-attachment")) {
          var att = e.target.closest(".kair-mail-attachment");
          if (att) {
            var msgId = att.dataset.msgId;
            var attId = att.dataset.attId;
            var fileName = att.querySelector(".kair-mail-attachment__name").textContent;
            window.BandejaMailOps.downloadMailAttachment(msgId, attId, fileName, false, true).then(function (data) {
              if (data) window.BandejaHelpers.openFileViewerFromBytes(data);
            });
          }
        }
      });

    // Modal close (ESC)
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        var overlay = document.getElementById("modal-overlay");
        if (overlay && !overlay.hasAttribute("hidden")) {
          var closeBtn = document.querySelector("#modal-close");
          if (closeBtn) closeBtn.click();
        }
        var fvOverlay = document.getElementById("fv-overlay");
        if (fvOverlay && !fvOverlay.hasAttribute("hidden")) {
          window.BandejaHelpers.closeFileViewer();
        }
        var composeOverlay = document.querySelector(".compose-panel-overlay");
        if (composeOverlay) {
          var closeBtn = composeOverlay.querySelector(".compose-panel__btn--close");
          if (closeBtn) closeBtn.click();
        }
      }
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", function (e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
      if (e.key === "c" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); window.BandejaComposeModal.open("new"); }
      if (e.key === "r" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); window.BandejaMailOps.refresh(); }
      if (e.key === "k") { e.preventDefault(); var inp = document.getElementById("search-input") || document.getElementById("mail-search-input"); if (inp) inp.focus(); }
      if (e.key === "Escape") {
        var fvOverlay = document.getElementById("fv-overlay");
        if (fvOverlay && !fvOverlay.hasAttribute("hidden")) { window.BandejaHelpers.closeFileViewer(); }
      }
    });

    // Visibility change for auto-refresh
    document.addEventListener("visibilitychange", function () {
      var S = window.BandejaState;
      if (document.visibilityState === "visible") window.BandejaMailOps.startAutoRefresh();
      else window.BandejaMailOps.stopAutoRefresh();
    });

    // Window message listener (from iframe to parent)
    window.addEventListener("message", function (event) {
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type === "bandeja-integrada-back") {
        window.BandejaMailOps.stopAutoRefresh();
        if (window.parent && window.parent !== window) {
          try { window.parent.postMessage({ type: "bandeja-integrada-back" }, "*"); } catch (e) { }
        }
      } else if (event.data.type === "bandeja-integrada-destroyed") {
        // Optional: handle destroy confirmation
      }
    });
  }

  window.BandejaHandlers = window.BandejaHandlers || {};
  window.BandejaHandlers.bindEvents = bindEvents;
})();