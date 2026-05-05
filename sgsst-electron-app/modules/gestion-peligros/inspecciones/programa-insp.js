/* ==========================================================================
K+AIR — Módulo 4.2.4 Programa Anual de Inspecciones
Sub-módulo: Grilla anual con toggle c/p, KPIs, exportar
========================================================================== */
(function () {
  'use strict';

  var MONTHS = InspeccionesService.MONTHS;

  var ProgramaInsp = {
    companyName: null,
    currentYear: new Date().getFullYear(),

    load: function (companyName) {
      this.companyName = companyName;
      this.renderKPIs();
      this.renderTable();
    },

    renderKPIs: function () {
      var container = document.getElementById('kair-insp-programa-kpis');
      if (!container) return;

      var self = this;
        InspeccionesService.getSchedule(this.companyName, this.currentYear).then(function (result) {
            if (!result.success) return;
            var kpis = result.data.kpis;
            var rateClass = kpis.indicator >= 80 ? 'success' : (kpis.indicator >= 50 ? 'warning' : 'primary');
            container.innerHTML =
                '<div class="kair-insp__kpi-card">' +
                '<div class="kair-insp__kpi-value kair-insp__kpi-value--' + rateClass + '">' + kpis.indicator + '%</div>' +
                '<div class="kair-insp__kpi-label">Indicador de Cumplimiento</div>' +
                '</div>' +
                '<div class="kair-insp__kpi-card">' +
                '<div class="kair-insp__kpi-value kair-insp__kpi-value--success">' + kpis.completed + '</div>' +
                '<div class="kair-insp__kpi-label">Completadas</div>' +
                '</div>' +
                '<div class="kair-insp__kpi-card">' +
                '<div class="kair-insp__kpi-value kair-insp__kpi-value--warning">' + kpis.pending + '</div>' +
                '<div class="kair-insp__kpi-label">Pendientes</div>' +
                '</div>';
        }).catch(function (err) { console.error('[4.2.4] getSchedule (kpis) error:', err); });
    },

    renderTable: function () {
      var container = document.getElementById('kair-insp-programa-table');
      if (!container) return;

      var self = this;
      InspeccionesService.getSchedule(this.companyName, this.currentYear).then(function (result) {
        if (!result.success) return;
        var schedule = result.data;
        var activities = schedule.activities;

        var theadHtml = '<tr><th>Actividad</th>';
        MONTHS.forEach(function (m) {
          theadHtml += '<th>' + m + '</th>';
        });
        theadHtml += '</tr>';

        var tbodyHtml = activities.map(function (act) {
          var typeIcon = InspeccionesService.getTypeIcon(act.type);
          var typeLabel = InspeccionesService.getTypeLabel(act.type);
          var rowHtml = '<tr><td><i class="bi ' + typeIcon + '" style="color:var(--kair-insp-primary);margin-right:6px;"></i>' + act.name +
            '<span class="kair-insp__programa-type-badge" style="background:var(--kair-insp-primary-light);color:var(--kair-insp-primary);">' + typeLabel + '</span>' +
            '<span style="font-size:0.6875rem;color:var(--kair-insp-text-muted);margin-left:8px;">' + act.frequency + '</span></td>';
          for (var i = 0; i < 12; i++) {
            var status = act.months[i];
            var cellClass = status === 'c' ? 'c' : (status === 'p' ? 'p' : 'null');
            var cellLabel = status === 'c' ? 'C' : (status === 'p' ? 'P' : '\u2014');
            rowHtml += '<td><div class="kair-insp__programa-cell kair-insp__programa-cell--' + cellClass + '" ' +
              'data-activity="' + act.id + '" data-month="' + i + '" data-status="' + (status || '') + '" ' +
              'title="' + act.name + ' \u2014 ' + MONTHS[i] + ': ' + (status === 'c' ? 'Completada' : (status === 'p' ? 'Pendiente' : 'Sin programar')) + '">' +
              cellLabel + '</div></td>';
          }
          rowHtml += '</tr>';
          return rowHtml;
        }).join('');

        container.innerHTML =
          '<div class="kair-insp__programa-table-wrapper">' +
            '<table class="kair-insp__programa-table">' +
              '<thead>' + theadHtml + '</thead>' +
              '<tbody>' + tbodyHtml + '</tbody>' +
            '</table>' +
          '</div>';

        self.bindCellToggle();
            self.bindExport();
        }).catch(function (err) { console.error('[4.2.4] getSchedule (table) error:', err); });
    },

    bindCellToggle: function () {
      var self = this;
      var cells = document.querySelectorAll('.kair-insp__programa-cell');
      cells.forEach(function (cell) {
        cell.addEventListener('click', function () {
          var activityId = cell.getAttribute('data-activity');
          var month = parseInt(cell.getAttribute('data-month'), 10);
          var currentStatus = cell.getAttribute('data-status');
          var nextStatus;
          if (currentStatus === 'p') {
            nextStatus = 'c';
          } else if (currentStatus === 'c') {
            nextStatus = null;
          } else {
            nextStatus = 'p';
          }
            InspeccionesService.updateMonth(self.companyName, activityId, month, nextStatus).then(function () {
                self.renderKPIs();
                self.renderTable();
            }).catch(function (err) { console.error('[4.2.4] updateMonth error:', err); });
        });
      });
    },

    bindExport: function () {
      var btn = document.getElementById('kair-insp-programa-export');
      if (!btn) return;
      var self = this;
      btn.addEventListener('click', function () {
            InspeccionesService.getSchedule(self.companyName, self.currentYear).then(function (result) {
                if (!result.success) return;
                var schedule = result.data;
                var csvContent = 'Actividad,Tipo,Frecuencia,' + MONTHS.join(',') + '\n';
                schedule.activities.forEach(function (act) {
                    var row = [
                        '"' + act.name + '"',
                        act.type,
                        act.frequency
                    ];
                    for (var i = 0; i < 12; i++) {
                        row.push(act.months[i] === 'c' ? 'Completada' : (act.months[i] === 'p' ? 'Pendiente' : ''));
                    }
                    csvContent += row.join(',') + '\n';
                });
                var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                var url = URL.createObjectURL(blob);
                var link = document.createElement('a');
                link.href = url;
                link.download = 'Programa_Inspecciones_' + self.currentYear + '.csv';
                link.click();
                URL.revokeObjectURL(url);
                self.showNotification('Programa exportado como CSV', 'success');
            }).catch(function (err) { console.error('[4.2.4] getSchedule (export) error:', err); });
      });
    },

    showNotification: function (message, type) {
      var existing = document.querySelector('.kair-insp-notification');
      if (existing) existing.remove();

      var icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', warning: 'bi-exclamation-triangle-fill' };
      var notif = document.createElement('div');
      notif.className = 'kair-insp-notification kair-insp-notification--' + (type || 'success');
      notif.innerHTML = '<i class="bi ' + (icons[type] || icons.success) + ' kair-insp-notification__icon"></i>' +
        '<span class="kair-insp-notification__message">' + message + '</span>';
      document.body.appendChild(notif);
      setTimeout(function () { notif.classList.add('show'); }, 10);
      setTimeout(function () {
        notif.classList.remove('show');
        setTimeout(function () { notif.remove(); }, 400);
      }, 3000);
    }
  };

  window.ProgramaInsp = ProgramaInsp;
})();
