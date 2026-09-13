/* ============================================================
 * K+AIR Bandeja Integrada — Render Calendar
 * ============================================================ */

(function () {
  "use strict";

  const H = window.BandejaHelpers;
  const S = window.BandejaState;
  const D = window.KairData;

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

  function initials(name) { return window.BandejaHelpers.initials(name); }

  function formatGmailLongDate(dateVal) { return window.BandejaHelpers.formatGmailLongDate(dateVal); }
  function formatRelativeTime(dateVal) { return window.BandejaHelpers.formatRelativeTime(dateVal); }
  function initials(name) { return window.BandejaHelpers.initials(name); }

  window.BandejaRenderCalendar = {
    render: function (container) {
      var state = window.BandejaState;
      container.innerHTML = "";

      // Toolbar
      var toolbar = H.el("div", { class: "kair-calendar-toolbar", style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--kair-border-soft, #e9ecef)" } });

      var viewBtns = H.el("div", { class: "kair-calendar-view-btns", style: { display: "flex", gap: "4px" } });
      ["day", "week", "month", "schedule"].forEach(function (v) {
        var btn = H.el("button", { class: "kair-calendar-view-btn" + (S.calView === v ? " active" : ""), "data-view": v, title: v.charAt(0).toUpperCase() + v.slice(1) });
        btn.innerHTML = v === "day" ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="18" x2="21" y2="18"></svg>' :
          v === "week" ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="18" x2="21" y2="18"></svg>' :
          v === "month" ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"></svg>' :
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7"/></svg>';
        btn.addEventListener("click", function () { S.calView = v; window.BandejaRenderCalendar.render(document.getElementById("calendar-slide")); });
        viewBtns.appendChild(btn);
      });
      toolbar.appendChild(viewBtns);

      var todayBtn = H.el("button", { class: "kair-header__action--ghost", title: "Hoy" });
      todayBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/></svg>';
      todayBtn.addEventListener("click", function () { S.viewYear = new Date().getFullYear(); S.viewMonth = new Date().getMonth(); window.BandejaRenderCalendar.render(document.getElementById("calendar-slide")); });
      toolbar.appendChild(todayBtn);

      var createBtn = H.el("button", { class: "kair-header__action--primary", title: "Nuevo evento" });
      createBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg><span>Nuevo</span>';
      createBtn.addEventListener("click", function () { window.BandejaEventModal.open(); });
      toolbar.appendChild(createBtn);

      container.appendChild(toolbar);

      // Calendar grid
      var grid = H.el("div", { class: "kair-calendar-grid", style: { flex: "1", overflow: "auto" } });
      container.appendChild(grid);

      // Render based on view
      if (S.calView === "month") window.BandejaRenderCalendar.renderMonth(grid);
      else if (S.calView === "week") window.BandejaRenderCalendar.renderWeek(grid);
      else if (S.calView === "day") window.BandejaRenderCalendar.renderDay(grid);
      else window.BandejaRenderCalendar.renderSchedule(grid);
    },

    renderMonth: function (grid) {
      var S = window.BandejaState;
      var H = window.BandejaHelpers;
      var D = window.KairData;

      var year = S.viewYear || new Date().getFullYear();
      var month = S.viewMonth || new Date().getMonth();

      S.viewMonthLabel = D.MONTH_LABELS_ES[month] + " " + year;

      var firstDay = new Date(year, month, 1);
      var startWeekday = (firstDay.getDay() - 1 + 7) % 7; // Lunes = 0
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var daysInPrevMonth = new Date(year, month, 0).getDate();

      var today = new Date();
      var todayStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

      var gridHtml = '<div class="kair-cal-month"><div class="kair-cal-month__header"><button class="kair-cal-nav" data-nav="prev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg></button><h2 class="kair-cal-month__title" style="flex:1;text-align:center;">' + S.viewMonthLabel + '</h2><button class="kair-cal-nav" data-nav="next"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></button></div><div class="kair-cal-month__weekdays">Lun</div><div class="kair-cal-weekdays">Mar</div><div class="kair-cal-weekdays">Mié</div><div class="kair-cal-weekdays">Jue</div><div class="kair-cal-weekdays">Vie</div><div class="kair-cal-weekdays">Sáb</div><div class="kair-cal-weekdays">Dom</div><div class="kair-cal-month__days">';

      // Prev month days
      for (var i = startWeekday - 1; i >= 0; i--) {
        var d = daysInPrevMonth - i;
        var prevMonth = month - 1 < 0 ? 11 : month - 1;
        var prevYear = month - 1 < 0 ? year - 1 : year;
        var iso = prevYear + "-" + String(prevMonth + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
        gridHtml += '<div class="kair-cal-day kair-cal-day--other" data-date="' + iso + '"><span class="kair-cal-day__num">' + d + '</span></div>';
      }

      // Current month days
      for (var dd = 1; dd <= daysInMonth; dd++) {
        var iso = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
        var isToday = iso === todayStr;
        var dayEvents = state.events.filter(function (e) { return e.date === iso; });
        var eventDots = dayEvents.slice(0, 3).map(function (e) { return '<span class="kair-cal-dot" style="background:' + (e.color || (window.BandejaHelpers.getCategoryStyle(e.category) || {}).color || "#888") + '"></span>'; }).join("");
        gridHtml += '<div class="kair-cal-day' + (isToday ? " kair-cal-day--today" : "") + '" data-date="' + iso + '"><span class="kair-cal-day__num">' + dd + '</span><div class="kair-cal-day__dots">' + eventDots + '</div></div>';
      }

      // Next month days
      var totalCells = 6 * 7;
      var nextDay = 1;
      while ((startWeekday + daysInMonth + (nextDay - 1)) < totalCells) {
        var nextMonth = month + 1 > 11 ? 0 : month + 1;
        var nextYear = month + 1 > 11 ? year + 1 : year;
        var iso = nextYear + "-" + String(nextMonth + 1).padStart(2, "0") + "-" + String(nextDay).padStart(2, "0");
        gridHtml += '<div class="kair-cal-day kair-cal-day--other" data-date="' + iso + '"><span class="kair-cal-day__num">' + nextDay + '</span></div>';
        nextDay++;
      }

      gridHtml += '</div>';
      grid.innerHTML = gridHtml;

      // Bind nav
      grid.querySelector('[data-nav="prev"]').addEventListener("click", function () { S.viewMonth = (S.viewMonth - 1 + 12) % 12; S.viewYear = S.viewMonth === 11 ? S.viewYear - 1 : S.viewYear; window.BandejaRenderCalendar.render(document.getElementById("calendar-slide")); });
      grid.querySelector('[data-nav="next"]').addEventListener("click", function () { S.viewMonth = (S.viewMonth + 1) % 12; S.viewYear = S.viewMonth === 0 ? S.viewYear + 1 : S.viewYear; window.BandejaRenderCalendar.render(document.getElementById("calendar-slide")); });

      // Bind day click
      grid.querySelectorAll(".kair-cal-day:not(.kair-cal-day--other)").forEach(function (day) {
        day.addEventListener("click", function () { window.BandejaCalendarOps.selectDate(this.dataset.date); });
      });
    },

    // P0-CRO-AUDIT-2 fix (2026-09-07) — Implementadas las 3 vistas que antes eran
    // STUB ("pendiente"). Ahora muestran los eventos reales de state.events con
    // el mismo formato visual que renderMonth. Usan el mismo set de categorías
    // (EVENT_CATEGORIES) y la misma función getCategoryStyle().

    // Vista SEMANA: 7 columnas (Lun-Dom) de la semana actual, con eventos
    // listados debajo del header de cada día.
    renderWeek: function (grid) {
      var S = window.BandejaState;
      var D = window.KairData;
      var today = new Date();
      var dayOfWeek = (today.getDay() - 1 + 7) % 7; // Monday = 0
      var monday = new Date(today);
      monday.setDate(today.getDate() - dayOfWeek);
      monday.setHours(0, 0, 0, 0);

      var todayIso = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
      var monthLabel = D.MONTH_LABELS_ES[monday.getMonth()] + " " + monday.getFullYear();

      var html = '<div class="kair-cal-week"><div class="kair-cal-week__header"><h2 class="kair-cal-week__title">' + monthLabel + '</h2></div><div class="kair-cal-week__grid">';
      for (var i = 0; i < 7; i++) {
        var d = new Date(monday);
        d.setDate(monday.getDate() + i);
        var iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        var isToday = iso === todayIso;
        var dayEvents = S.events.filter(function (e) { return e && e.date === iso; });
        var eventList = dayEvents.map(function (e) {
          var style = H.getCategoryStyle(e.category) || {};
          var color = style.color || "#888";
          return '<div class="kair-cal-week-event" style="border-left:3px solid ' + color + '">' +
            '<div class="kair-cal-week-event__time">' + (e.start || "") + '</div>' +
            '<div class="kair-cal-week-event__title">' + H.esc(e.title || "Sin título") + '</div>' +
            '</div>';
        }).join("");
        html += '<div class="kair-cal-week-day' + (isToday ? " kair-cal-week-day--today" : "") + '">' +
          '<div class="kair-cal-week-day__header">' + D.WEEKDAY_LABELS[d.getDay()] + ' ' + d.getDate() + '</div>' +
          '<div class="kair-cal-week-day__events">' + (eventList || '<div class="kair-cal-week-day__empty">—</div>') + '</div>' +
          '</div>';
      }
      html += '</div></div>';
      grid.innerHTML = html;
    },

    // Vista DÍA: slots horarios (0-23) con eventos posicionados por hora de inicio.
    renderDay: function (grid) {
      var S = window.BandejaState;
      var D = window.KairData;
      var selected = S.selectedDate || (function () {
        var t = new Date();
        return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
      })();
      var dateObj = new Date(selected + "T00:00:00");
      var dayEvents = S.events.filter(function (e) { return e && e.date === selected; });

      var html = '<div class="kair-cal-day-view">';
      html += '<div class="kair-cal-day-view__header"><h2>' + selected + ' (' + D.WEEKDAY_LABELS[dateObj.getDay()] + ')</h2></div>';
      html += '<div class="kair-cal-day-view__body">';
      for (var h = 0; h < 24; h++) {
        var hourEvents = dayEvents.filter(function (e) {
          if (!e.start) return false;
          var eh = parseInt(String(e.start).split(":")[0], 10);
          return eh === h;
        });
        var eventBlocks = hourEvents.map(function (e) {
          var style = H.getCategoryStyle(e.category) || {};
          var color = style.color || "#888";
          return '<div class="kair-cal-day-event" style="border-left:3px solid ' + color + ';background:' + (style.bg || "transparent") + '">' +
            '<strong>' + (e.start || "") + '–' + (e.end || "") + '</strong> ' + H.esc(e.title || "Sin título") +
            (e.location ? ' <small>· ' + H.esc(e.location) + '</small>' : '') +
            '</div>';
        }).join("");
        html += '<div class="kair-cal-day-slot"><div class="kair-cal-day-slot__hour">' + String(h).padStart(2, "0") + ':00</div><div class="kair-cal-day-slot__events">' + eventBlocks + '</div></div>';
      }
      html += '</div></div>';
      grid.innerHTML = html;
    },

    // Vista AGENDA (schedule): lista de próximos N eventos a partir de hoy,
    // ordenados por fecha y hora. Útil para ver "qué viene" sin entrar al mes.
    renderSchedule: function (grid) {
      var S = window.BandejaState;
      var D = window.KairData;
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var todayIso = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

      var upcoming = (S.events || [])
        .filter(function (e) { return e && e.date && e.date >= todayIso; })
        .sort(function (a, b) {
          if (a.date !== b.date) return a.date < b.date ? -1 : 1;
          return (a.start || "") < (b.start || "") ? -1 : 1;
        })
        .slice(0, 50);

      if (upcoming.length === 0) {
        grid.innerHTML = '<div style="padding:40px;text-align:center;color:var(--kair-text-muted);">No hay eventos próximos.</div>';
        return;
      }

      var html = '<div class="kair-cal-schedule"><div class="kair-cal-schedule__header"><h2>Próximos eventos</h2></div><ul class="kair-cal-schedule__list">';
      upcoming.forEach(function (e) {
        var style = H.getCategoryStyle(e.category) || {};
        var color = style.color || "#888";
        var d = new Date(e.date + "T00:00:00");
        var dayLabel = d.getDate() + " " + D.MONTH_LABELS_ES[d.getMonth()].toLowerCase().slice(0, 3);
        html += '<li class="kair-cal-schedule__item" style="border-left:3px solid ' + color + '">' +
          '<span class="kair-cal-schedule__date">' + dayLabel + '</span>' +
          '<span class="kair-cal-schedule__time">' + (e.start || "—") + '</span>' +
          '<span class="kair-cal-schedule__title">' + H.esc(e.title || "Sin título") + '</span>' +
          '<span class="kair-cal-schedule__cat">' + (style.label || e.category || "Otro") + '</span>' +
          '</li>';
      });
      html += '</ul></div>';
      grid.innerHTML = html;
    }
  };
})();