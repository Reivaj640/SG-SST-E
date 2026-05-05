/* ==========================================================================
K+AIR — Módulo 4.2.4 Dashboard de Inspecciones
Sub-módulo: Panel Principal con KPIs, calendario, recientes, alertas
========================================================================== */
(function () {
  'use strict';

  var MONTHS = InspeccionesService.MONTHS;

  var DashboardInsp = {
    load: function (companyName) {
      this.companyName = companyName;
      this.renderStats();
      this.renderCalendar();
      this.renderRecent();
      this.renderAlerts();
    },

    renderStats: function () {
      var container = document.getElementById('kair-insp-dashboard-stats');
      if (!container) return;

        InspeccionesService.getStats(this.companyName).then(function (result) {
            if (!result.success) {
                container.innerHTML = '<div class="kair-insp-empty-state"><i class="bi bi-exclamation-circle"></i><p>Error al cargar estadísticas</p></div>';
                return;
            }
            var s = result.data;
            var rateColor = s.tasaCumplimiento >= 80 ? 'success' : (s.tasaCumplimiento >= 50 ? 'warning' : 'danger');
            container.innerHTML =
                '<div class="kair-insp__stat-card kair-insp__stat-card--primary">' +
                '<div class="kair-insp__stat-card-icon"><i class="bi bi-clipboard-check"></i></div>' +
                '<div class="kair-insp__stat-card-content">' +
                '<div class="kair-insp__stat-card-value">' + s.totalInspecciones + '</div>' +
                '<div class="kair-insp__stat-card-label">Inspecciones Realizadas</div>' +
                '</div>' +
                '</div>' +
                '<div class="kair-insp__stat-card kair-insp__stat-card--warning">' +
                '<div class="kair-insp__stat-card-icon"><i class="bi bi-clock-history"></i></div>' +
                '<div class="kair-insp__stat-card-content">' +
                '<div class="kair-insp__stat-card-value" style="color:var(--kair-insp-' + rateColor + ')">' + s.pendientesMes + '</div>' +
                '<div class="kair-insp__stat-card-label">Pendientes del Mes</div>' +
                '</div>' +
                '</div>' +
                '<div class="kair-insp__stat-card kair-insp__stat-card--info">' +
                '<div class="kair-insp__stat-card-icon"><i class="bi bi-graph-up"></i></div>' +
                '<div class="kair-insp__stat-card-content">' +
                '<div class="kair-insp__stat-card-value" style="color:var(--kair-insp-' + rateColor + ')">' + s.tasaCumplimiento + '%</div>' +
                '<div class="kair-insp__stat-card-label">Tasa de Cumplimiento</div>' +
                '</div>' +
                '</div>' +
                '<div class="kair-insp__stat-card kair-insp__stat-card--success">' +
                '<div class="kair-insp__stat-card-icon"><i class="bi bi-fire"></i></div>' +
                '<div class="kair-insp__stat-card-content">' +
                '<div class="kair-insp__stat-card-value">' + s.extintoresVigentes + '<span style="font-size:0.875rem;color:var(--kair-insp-text-muted);font-weight:400">/' + s.extintoresTotal + '</span></div>' +
                '<div class="kair-insp__stat-card-label">Extintores Vigentes</div>' +
                '</div>' +
                '</div>';
        }).catch(function (err) { console.error('[4.2.4] getStats error:', err); });
    },

    renderCalendar: function () {
      var container = document.getElementById('kair-insp-dashboard-calendar');
      if (!container) return;

      var self = this;
      InspeccionesService.getSchedule(this.companyName, new Date().getFullYear()).then(function (result) {
        if (!result.success) return;
        var schedule = result.data;
        var activities = schedule.activities;
        var currentMonth = new Date().getMonth();

        var monthLabelsHtml = MONTHS.map(function (m) {
          return '<div class="kair-insp__cal-month-label">' + m + '</div>';
        }).join('');

        var rowsHtml = activities.map(function (act) {
          var cellsHtml = '';
          for (var i = 0; i < 12; i++) {
            var status = act.months[i];
            var cls = 'kair-insp__cal-cell--' + (status === 'c' ? 'completed' : (status === 'p' ? 'pending' : 'empty'));
            var label = status === 'c' ? 'C' : (status === 'p' ? 'P' : '\u2014');
            var title = act.name + ' \u2014 ' + MONTHS[i] + ': ' + (status === 'c' ? 'Completada' : (status === 'p' ? 'Pendiente' : 'Sin programar'));
            cellsHtml += '<div class="kair-insp__cal-cell ' + cls + '" title="' + title + '" data-activity="' + act.id + '" data-month="' + i + '">' + label + '</div>';
          }
          var typeInfo = InspeccionesService.getTypeIcon(act.type);
          return '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:4px;min-height:36px;">' +
            '<div style="width:140px;flex-shrink:0;font-size:0.75rem;font-weight:500;color:var(--kair-insp-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + act.name + '"><i class="bi ' + typeInfo + '" style="margin-right:4px;color:var(--kair-insp-primary);"></i>' + act.name + '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(12,1fr);gap:6px;flex:1;">' + cellsHtml + '</div>' +
          '</div>';
        }).join('');

        container.innerHTML =
          '<div class="kair-insp__calendar">' +
            '<div class="kair-insp__calendar-header">' +
              '<div class="kair-insp__calendar-title"><i class="bi bi-calendar3"></i> Programa Anual ' + schedule.year + '</div>' +
              '<div class="kair-insp__calendar-legend">' +
                '<span><span class="kair-insp__legend-dot kair-insp__legend-dot--completed"></span>Completada</span>' +
                '<span><span class="kair-insp__legend-dot kair-insp__legend-dot--pending"></span>Pendiente</span>' +
                '<span><span class="kair-insp__legend-dot kair-insp__legend-dot--empty"></span>Sin programar</span>' +
              '</div>' +
            '</div>' +
            '<div class="kair-insp__calendar-body">' +
              '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:8px;">' +
                '<div style="width:140px;flex-shrink:0;"></div>' +
                '<div style="display:grid;grid-template-columns:repeat(12,1fr);gap:6px;flex:1;">' + monthLabelsHtml + '</div>' +
              '</div>' +
              rowsHtml +
            '</div>' +
          '</div>';

        self.bindCalendarEvents();
        }).catch(function (err) { console.error('[4.2.4] getSchedule (calendar) error:', err); });
    },

    bindCalendarEvents: function () {
      var self = this;
      var cells = document.querySelectorAll('.kair-insp__cal-cell--pending');
      cells.forEach(function (cell) {
        cell.addEventListener('click', function () {
          var activityId = cell.getAttribute('data-activity');
          var month = parseInt(cell.getAttribute('data-month'), 10);
            InspeccionesService.updateMonth(self.companyName, activityId, month, 'c').then(function () {
                self.renderCalendar();
                self.renderStats();
                self.updateTabBadge();
            }).catch(function (err) { console.error('[4.2.4] updateMonth error:', err); });
        });
      });
    },

  updateTabBadge: function () {
        InspeccionesService.getStats(this.companyName).then(function (result) {
            var count = (result.success && result.data.pendientesMes > 0) ? result.data.pendientesMes : 0;
            ['dashboard', 'programa'].forEach(function (tabKey) {
                var badge = document.getElementById('kair-insp-tab-badge-' + tabKey);
                if (badge) {
                    if (count > 0) {
                        badge.textContent = count;
                        badge.style.display = '';
                    } else {
                        badge.style.display = 'none';
                    }
                }
            });
        }).catch(function (err) { console.error('[4.2.4] getStats (badge) error:', err); });
  },

    renderRecent: function () {
      var container = document.getElementById('kair-insp-dashboard-recent');
      if (!container) return;

        InspeccionesService.listInspections(this.companyName, {}).then(function (result) {
            if (!result.success) return;
            var items = result.data.items.slice(0, 5);
            var html = items.map(function (insp) {
                var iconClass = insp.status === 'COMPLETED' ? 'completed' : 'draft';
                var icon = InspeccionesService.getTypeIcon(insp.type);
                var badgeClass = insp.status === 'COMPLETED' ? 'completed' : 'draft';
                var statusLabel = InspeccionesService.getStatusLabel(insp.status);
                var typeLabel = InspeccionesService.getTypeLabel(insp.type);
                return '<div class="kair-insp__recent-item">' +
                    '<div class="kair-insp__recent-icon kair-insp__recent-icon--' + iconClass + '"><i class="bi ' + icon + '"></i></div>' +
                    '<div class="kair-insp__recent-info">' +
                    '<div class="kair-insp__recent-title">' + insp.location + '</div>' +
                    '<div class="kair-insp__recent-meta">' + typeLabel + ' &middot; ' + insp.inspector + ' &middot; ' + insp.date + '</div>' +
                    '</div>' +
                    '<span class="kair-insp__recent-badge kair-insp__recent-badge--' + badgeClass + '">' + statusLabel + '</span>' +
                    '</div>';
            }).join('');

            if (items.length === 0) {
                html = '<div class="kair-insp-empty-state" style="padding:1.5rem;"><i class="bi bi-inbox"></i><p>No hay inspecciones registradas</p></div>';
            }

            container.innerHTML = '<div class="kair-insp__section-card">' +
                '<div class="kair-insp__section-card-header">' +
                '<div class="kair-insp__section-card-title"><i class="bi bi-clock-history"></i> Inspecciones Recientes</div>' +
                '</div>' +
                '<div class="kair-insp__section-card-body">' + html + '</div>' +
                '</div>';
        }).catch(function (err) { console.error('[4.2.4] listInspections (recent) error:', err); });
    },

    renderAlerts: function () {
      var container = document.getElementById('kair-insp-dashboard-alerts');
      if (!container) return;
      var self = this;

        InspeccionesService.getStats(this.companyName).then(function (result) {
            if (!result.success) return;
            var s = result.data;
            var alerts = '';

            if (s.pendientesMes > 0) {
                alerts += '<div class="kair-insp__alert kair-insp__alert--warning">' +
                    '<i class="bi bi-exclamation-triangle-fill"></i>' +
                    '<div>Tienes <strong>' + s.pendientesMes + ' inspecci' + (s.pendientesMes > 1 ? 'ones' : '\u00f3n') + ' pendiente' + (s.pendientesMes > 1 ? 's' : '') + '</strong> este mes. Revisa el programa y marca como completadas al realizarlas.</div>' +
                    '</div>';
            }

            if (s.extintoresVigentes < s.extintoresTotal) {
                var noVigentes = s.extintoresTotal - s.extintoresVigentes;
                alerts += '<div class="kair-insp__alert kair-insp__alert--danger">' +
                    '<i class="bi bi-exclamation-octagon-fill"></i>' +
                    '<div><strong>' + noVigentes + ' extintor' + (noVigentes > 1 ? 'es' : '') + ' vencido' + (noVigentes > 1 ? 's' : '') + '</strong> requieren recarga o reemplazo inmediato.</div>' +
                    '</div>';
            }

            if (s.tasaCumplimiento < 50) {
                alerts += '<div class="kair-insp__alert kair-insp__alert--danger">' +
                    '<i class="bi bi-graph-down-arrow"></i>' +
                    '<div>Tasa de cumplimiento <strong>inferior al 50%</strong>. Se requiere plan de acción inmediato.</div>' +
                    '</div>';
            }

            if (!alerts) {
                alerts = '<div class="kair-insp__alert" style="background:var(--kair-insp-success-light);border:1px solid rgba(40,167,69,0.3);color:#155724;">' +
                    '<i class="bi bi-check-circle-fill" style="color:var(--kair-insp-success);"></i>' +
                    '<div>Todo en orden. No hay alertas pendientes.</div>' +
                    '</div>';
            }

            container.innerHTML = '<div class="kair-insp__section-card">' +
                '<div class="kair-insp__section-card-header">' +
                '<div class="kair-insp__section-card-title"><i class="bi bi-bell"></i> Alertas</div>' +
                '</div>' +
                '<div class="kair-insp__section-card-body">' + alerts + '</div>' +
                '</div>';
        }).catch(function (err) { console.error('[4.2.4] getStats (alerts) error:', err); });
    }
  };

  window.DashboardInsp = DashboardInsp;
})();
