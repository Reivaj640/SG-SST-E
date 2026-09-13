/* ============================================================
 * K+AIR Bandeja Integrada — Render Sidebar
 * ============================================================ */

(function () {
  "use strict";

  const H = window.BandejaHelpers;
  const S = window.BandejaState;
  const D = window.KairData;

  window.BandejaRenderSidebar = {
    render: function (container) {
      var state = S;
      container.innerHTML = "";

      // Mini calendar
      var miniCal = H.el("div", { class: "kair-sidebar__minical", style: { padding: "12px", borderBottom: "1px solid var(--kair-border-soft, #e9ecef)" } });
      var year = state.viewYear || new Date().getFullYear();
      var month = state.viewMonth || new Date().getMonth();
      var D = window.KairData;

      var header = H.el("div", { class: "kair-minical-header", style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" } });
      var prevBtn = H.el("button", { class: "kair-icon-btn", title: "Mes anterior" });
      prevBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>';
      prevBtn.addEventListener("click", function () { state.viewMonth = (state.viewMonth - 1 + 12) % 12; state.viewYear = state.viewMonth === 11 ? state.viewYear - 1 : state.viewYear; window.BandejaRenderSidebar.render(container); });
      var nextBtn = H.el("button", { class: "kair-icon-btn", title: "Mes siguiente" });
      nextBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';
      nextBtn.addEventListener("click", function () { state.viewMonth = (state.viewMonth + 1) % 12; state.viewYear = state.viewMonth === 0 ? state.viewYear + 1 : state.viewYear; window.BandejaRenderSidebar.render(container); });
      var title = H.el("span", { style: { fontWeight: 600, fontSize: "0.875rem" } });
      title.textContent = D.MONTH_LABELS_ES[month] + " " + year;
      header.appendChild(prevBtn);
      header.appendChild(title);
      header.appendChild(nextBtn);
      miniCal.appendChild(header);

      // Weekday headers
      var weekdays = H.el("div", { class: "kair-minical-weekdays", style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", fontSize: "0.6875rem", color: "var(--kair-text-light)", marginBottom: "4px" } });
      ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].forEach(function (d) {
        miniCal.appendChild(H.el("div", { textContent: d, style: { padding: "2px" } }));
      });
      // Actually let's use a grid
      var grid = H.el("div", { style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" } });
      var firstDay = new Date(state.viewYear, state.viewMonth, 1);
      var startWeekday = (firstDay.getDay() - 1 + 7) % 7; // Lunes = 0
      var daysInMonth = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();
      var daysInPrevMonth = new Date(state.viewYear, state.viewMonth, 0).getDate();
      var today = new Date();
      var todayStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

      for (var i = startWeekday - 1; i >= 0; i--) {
        var d = daysInPrevMonth - i;
        var prevMonth = state.viewMonth - 1 < 0 ? 11 : state.viewMonth - 1;
        var prevYear = state.viewMonth - 1 < 0 ? state.viewYear - 1 : state.viewYear;
        var iso = prevYear + "-" + String(prevMonth + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
        var dayEl = H.el("div", { class: "kair-minical-day kair-minical-day--other", style: { aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "var(--kair-text-light)", border: "1px solid var(--kair-border-soft)" }, "data-date": iso });
        dayEl.textContent = d;
        miniCal.appendChild(dayEl);
      }
      var todayStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
      var daysInMonth = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();
      for (var dd = 1; dd <= daysInMonth; dd++) {
        var iso = state.viewYear + "-" + String(state.viewMonth + 1).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
        var isToday = iso === todayStr;
        var dayEl = H.el("div", { class: "kair-minical-day" + (isToday ? " kair-minical-day--today" : ""), style: { aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: isToday ? 700 : 400, color: isToday ? "var(--kair-primary)" : "var(--kair-text-body)", border: "1px solid var(--kair-border-soft)", background: isToday ? "var(--kair-primary-bg)" : "transparent", borderRadius: "4px", cursor: "pointer" }, "data-date": iso });
        dayEl.textContent = dd;
        miniCal.appendChild(dayEl);
      }
      container.appendChild(miniCal);

      // Legend
      var legend = H.el("div", { class: "kair-sidebar__legend", style: { padding: "12px", borderBottom: "1px solid var(--kair-border-soft)" } });
      legend.innerHTML = '<div style="font-size:0.75rem;font-weight:600;color:var(--kair-text-muted);margin-bottom:8px;">Leyenda</div>' +
        '<div style="display:flex;flex-direction:column;gap:6px;font-size:0.75rem;">' +
        '<div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:#28a745;"></span><span>Realizado</span></div>' +
        '<div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:#ffc107;"></span><span>Pendiente</span></div>' +
        '<div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:#dc3545;"></span><span>Vencido</span></div>' +
        '</div>';
      container.appendChild(legend);

      // Integration (Google Calendar, etc.)
      var integration = H.el("div", { class: "kair-sidebar__integration", style: { padding: "12px" } });
      integration.innerHTML = '<div style="font-size:0.75rem;font-weight:600;color:var(--kair-text-muted);margin-bottom:8px;">Integraciones</div>' +
        '<button class="kair-btn kair-btn--outline" style="width:100%;font-size:0.8125rem;justify-content:flex-start;gap:8px;" data-action="google-calendar-connect">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Google Calendar</button>';
      container.appendChild(integration);

      // Bind events
      setTimeout(function () {
        container.querySelectorAll(".kair-minical-day:not(.kair-minical-day--other)").forEach(function (day) {
          day.addEventListener("click", function () { window.BandejaCalendarOps.selectDate(this.dataset.date); });
        });
        var gcBtn = container.querySelector('[data-action="google-calendar-connect"]');
        if (gcBtn) gcBtn.addEventListener("click", function () { window.BandejaCalendarOps.connectGoogleCalendar(); });
      }, 0);
    }
  };
})();