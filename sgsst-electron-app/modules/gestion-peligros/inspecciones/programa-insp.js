(function () {
'use strict';

var MONTHS = InspeccionesService.MONTHS;

var ProgramaInsp = {
  companyName: null,
  currentYear: new Date().getFullYear(),
  scheduleData: null,
  saveTimers: {},

  load: function (companyName) {
    this.companyName = companyName;
    this.scheduleData = null;
    Object.keys(this.saveTimers).forEach(function (k) {
      clearTimeout(this.saveTimers[k]);
    }.bind(this));
    this.saveTimers = {};
    this.renderKPIs();
    this.renderTable();
  },

  renderKPIs: function () {
    var container = document.getElementById('kair-insp-programa-kpis');
    if (!container) return;

    InspeccionesService.getSchedule(this.companyName, this.currentYear).then(function (result) {
      if (!result.success) {
        container.innerHTML = '<div class="kair-insp-empty-state"><i class="bi bi-exclamation-circle"></i><p>' + (result.error ? result.error.message : 'Error cargando programa') + '</p></div>';
        return;
      }
      var kpis = result.data.kpis;
      var rateClass = kpis.indicator >= 80 ? 'success' : (kpis.indicator >= 50 ? 'warning' : 'primary');
      container.innerHTML =
        '<div class="kair-insp__kpi-card">' +
        '<div class="kair-insp__kpi-value kair-insp__kpi-value--' + rateClass + '">' + kpis.indicator + '%</div>' +
        '<div class="kair-insp__kpi-label">Indicador de Cumplimiento</div>' +
        '</div>' +
        '<div class="kair-insp__kpi-card">' +
        '<div class="kair-insp__kpi-value kair-insp__kpi-value--success">' + (kpis.realizadas || kpis.completed || 0) + '</div>' +
        '<div class="kair-insp__kpi-label">Realizadas</div>' +
        '</div>' +
        '<div class="kair-insp__kpi-card">' +
        '<div class="kair-insp__kpi-value kair-insp__kpi-value--warning">' + (kpis.sinRealizar || kpis.pending || 0) + '</div>' +
        '<div class="kair-insp__kpi-label">Sin Realizar</div>' +
        '</div>';
    }.bind(this)).catch(function (err) { console.error('[4.2.4] getSchedule (kpis) error:', err); });
  },

  renderTable: function () {
    var container = document.getElementById('kair-insp-programa-table');
    if (!container) return;

    InspeccionesService.getSchedule(this.companyName, this.currentYear).then(function (result) {
      if (!result.success) {
        container.innerHTML = '<div class="kair-insp-empty-state"><i class="bi bi-exclamation-circle"></i><h3>Sin datos</h3><p>' + (result.error ? result.error.message : 'No se encontró el programa') + '</p></div>';
        return;
      }

      var schedule = result.data;
      this.scheduleData = schedule;
      var activities = schedule.activities;

      if (activities.length === 0) {
        container.innerHTML = '<div class="kair-insp-empty-state"><i class="bi bi-calendar-x"></i><h3>Sin programa</h3><p>No se encontraron actividades en el archivo de programa</p></div>';
        return;
      }

      var theadHtml = '<tr>' +
        '<th>Objetivo Gral.</th>' +
        '<th>Objetivos Esp.</th>' +
        '<th>Actividad</th>' +
        '<th>Responsable</th>';
      MONTHS.forEach(function (m) {
        theadHtml += '<th>' + m + '</th>';
      });
      theadHtml += '<th>%</th>' +
        '<th>Estado</th>' +
        '<th>Observaciones</th>' +
        '</tr>';

      var tbodyHtml = activities.map(function (act) {
        var typeIcon = InspeccionesService.getTypeIcon(act.type);
        var typeLabel = InspeccionesService.getTypeLabel(act.type);
        var actClass = act.type ? ' kair-insp__programa-activity--' + act.type.toLowerCase() : '';

        var rowHtml = '<tr data-activity-id="' + act.id + '">';
        rowHtml += '<td class="kair-insp__programa-obj-gral' + actClass + '">' + this._esc(act.objetivoGeneral || '') + '</td>';
        rowHtml += '<td class="kair-insp__programa-obj-esp' + actClass + '">' + this._esc(act.objetivosEspecificos || '') + '</td>';
 rowHtml += '<td class="kair-insp__programa-activity' + actClass + '">' +
 '<i class="bi ' + typeIcon + ' kair-insp__programa-activity-icon"></i>' +
 this._esc(act.actividades || '') +
 '</td>';
        rowHtml += '<td class="kair-insp__programa-editable"><input type="text" class="kair-insp__programa-input" data-activity="' + act.id + '" data-field="responsable" value="' + this._esc(act.responsable || '') + '" placeholder="Responsable"></td>';

        for (var i = 0; i < 12; i++) {
          var status = act.months[i];
          var cellClass = status === 'c' ? 'c' : (status === 'p' ? 'p' : 'null');
          var cellLabel = status === 'c' ? 'C' : (status === 'p' ? 'P' : '\u2014');
          rowHtml += '<td><div class="kair-insp__programa-cell kair-insp__programa-cell--' + cellClass + '" ' +
            'data-activity="' + act.id + '" data-month="' + i + '" data-status="' + (status || '') + '" ' +
            'title="' + this._esc(act.actividades || '') + ' \u2014 ' + MONTHS[i] + ': ' + (status === 'c' ? 'Completada' : (status === 'p' ? 'Pendiente' : 'Sin programar')) + '">' +
            cellLabel + '</div></td>';
        }

        var pctVal = act.porcentaje || 0;
        var pctDisplay = typeof pctVal === 'number' ? Math.round(pctVal * 100) / 100 : pctVal;
        rowHtml += '<td class="kair-insp__programa-pct">' + pctDisplay + '</td>';
        rowHtml += '<td class="kair-insp__programa-status">' + this._esc(act.estado || '') + '</td>';
        rowHtml += '<td class="kair-insp__programa-editable"><input type="text" class="kair-insp__programa-input" data-activity="' + act.id + '" data-field="observacionesSeguimiento" value="' + this._esc(act.observacionesSeguimiento || '') + '" placeholder="Observaciones"></td>';

        rowHtml += '</tr>';
        return rowHtml;
      }.bind(this)).join('');

      container.innerHTML =
        '<div class="kair-insp__programa-table-wrapper">' +
        '<table class="kair-insp__programa-table">' +
        '<thead>' + theadHtml + '</thead>' +
        '<tbody>' + tbodyHtml + '</tbody>' +
        '</table>' +
        '</div>';

      this.bindCellToggle();
      this.bindEditableFields();
      this.bindExport();
    }.bind(this)).catch(function (err) { console.error('[4.2.4] getSchedule (table) error:', err); });
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

        var cellLabel = nextStatus === 'c' ? 'C' : (nextStatus === 'p' ? 'P' : '\u2014');
        var cellClass = nextStatus === 'c' ? 'c' : (nextStatus === 'p' ? 'p' : 'null');
        cell.className = 'kair-insp__programa-cell kair-insp__programa-cell--' + cellClass;
        cell.textContent = cellLabel;
        cell.setAttribute('data-status', nextStatus || '');

        InspeccionesService.updateMonth(self.companyName, activityId, month, nextStatus).then(function (result) {
          if (result.success) {
            self.renderKPIs();
          }
        }).catch(function (err) { console.error('[4.2.4] updateMonth error:', err); });
      });
    });
  },

  bindEditableFields: function () {
    var self = this;
    var inputs = document.querySelectorAll('.kair-insp__programa-input');
    inputs.forEach(function (input) {
      input.addEventListener('change', function () {
        var activityId = input.getAttribute('data-activity');
        var field = input.getAttribute('data-field');
        var value = input.value;

        if (self.saveTimers[activityId + '-' + field]) {
          clearTimeout(self.saveTimers[activityId + '-' + field]);
        }

        self.saveTimers[activityId + '-' + field] = setTimeout(function () {
          InspeccionesService.updateField(self.companyName, activityId, field, value).then(function (result) {
            if (result.success) {
              InspeccionesService.toast('Campo actualizado', 'success');
            } else {
              InspeccionesService.toast('Error al actualizar: ' + (result.error ? result.error.message : ''), 'error');
            }
          }).catch(function (err) {
            console.error('[4.2.4] updateField error:', err);
            InspeccionesService.toast('Error de conexión', 'error');
          });
        }, 800);
      });

      input.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    });
  },

  bindExport: function () {
    var btn = document.getElementById('kair-insp-programa-export');
    if (!btn || btn._kairBound) return;
    btn._kairBound = true;
    var self = this;

    btn.addEventListener('click', function () {
      if (!self.scheduleData || !self.scheduleData.activities) {
        InspeccionesService.toast('No hay datos para exportar', 'warning');
        return;
      }
      var activities = self.scheduleData.activities;
      var csvContent = 'Objetivo General,Objetivos Específicos,Actividad,Responsable,' + MONTHS.join(',') + ',%,Estado,Observaciones\n';
      activities.forEach(function (act) {
        var row = [
          '"' + (act.objetivoGeneral || '').replace(/"/g, '""') + '"',
          '"' + (act.objetivosEspecificos || '').replace(/"/g, '""') + '"',
          '"' + (act.actividades || '').replace(/"/g, '""') + '"',
          '"' + (act.responsable || '').replace(/"/g, '""') + '"'
        ];
        for (var i = 0; i < 12; i++) {
          row.push(act.months[i] === 'c' ? 'C' : (act.months[i] === 'p' ? 'P' : ''));
        }
        row.push(act.porcentaje || 0);
        row.push('"' + (act.estado || '').replace(/"/g, '""') + '"');
        row.push('"' + (act.observacionesSeguimiento || '').replace(/"/g, '""') + '"');
        csvContent += row.join(',') + '\n';
      });
      var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'Programa_Inspecciones_' + self.currentYear + '.csv';
      link.click();
      URL.revokeObjectURL(url);
      InspeccionesService.toast('Programa exportado como CSV', 'success');
    });
  },

  _esc: function (val) {
    if (!val) return '';
    return String(val).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
};

window.ProgramaInsp = ProgramaInsp;
})();
