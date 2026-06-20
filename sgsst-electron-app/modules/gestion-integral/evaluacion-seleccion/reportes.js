/* ==========================================================================
   K+AIR Reportes — Módulo 2.10.1
   ========================================================================== */

(function () {
  'use strict';

  var filters = { tipo: '', estado: '', fechaDesde: '', fechaHasta: '' };

  function load() {
    setupEvents();
    renderSummary();
    renderDistribution();
    renderTable();
    renderCriteriaChart();
  }

  function setupEvents() {
    var tipoFilter = document.getElementById('kair-es-report-tipo');
    var estadoFilter = document.getElementById('kair-es-report-estado');
    var fechaDesde = document.getElementById('kair-es-report-desde');
    var fechaHasta = document.getElementById('kair-es-report-hasta');

    [tipoFilter, estadoFilter, fechaDesde, fechaHasta].forEach(function (el) {
      if (el) {
        el.addEventListener('change', function () {
          filters.tipo = tipoFilter ? tipoFilter.value : '';
          filters.estado = estadoFilter ? estadoFilter.value : '';
          filters.fechaDesde = fechaDesde ? fechaDesde.value : '';
          filters.fechaHasta = fechaHasta ? fechaHasta.value : '';
          renderTable();
          renderDistribution();
        });
      }
    });

    var exportBtn = document.getElementById('kair-es-report-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        window.KAIRUtils.showToast('Función de exportación disponible en la versión de escritorio', 'info');
      });
    }
  }

  function renderSummary() {
    var container = document.getElementById('kair-es-report-summary');
    if (!container) return;

    var allData = window.EvaluacionesServiceES.getAllEvaluationsForReport();
    var totalEval = allData.filter(function (d) { return d.selectionScore !== null; }).length;

    var distribution = { BUENO: 0, REGULAR: 0, DEFICIENTE: 0 };
    allData.forEach(function (d) { if (d.clasificacion) distribution[d.clasificacion]++; });

    var totalWithStatus = distribution.BUENO + distribution.REGULAR + distribution.DEFICIENTE || 1;
    var buenoPct = Math.round((distribution.BUENO / totalWithStatus) * 100);
    var deficientePct = Math.round((distribution.DEFICIENTE / totalWithStatus) * 100);

    container.innerHTML = '<div class="kair-report__summary">' +
      '<div class="kair-report__summary-card"><div class="kair-report__summary-value">' + totalEval + '</div><div class="kair-report__summary-label">Total Evaluados</div></div>' +
      '<div class="kair-report__summary-card"><div class="kair-report__summary-value" style="color:var(--kair-success)">' + buenoPct + '%</div><div class="kair-report__summary-label">Clasificación Bueno</div></div>' +
      '<div class="kair-report__summary-card"><div class="kair-report__summary-value" style="color:var(--kair-danger)">' + deficientePct + '%</div><div class="kair-report__summary-label">Clasificación Deficiente</div></div>' +
    '</div>';
  }

  function renderDistribution() {
    var container = document.getElementById('kair-es-report-distribution');
    if (!container) return;

    var allData = window.EvaluacionesServiceES.getAllEvaluationsForReport();
    var distribution = { BUENO: 0, REGULAR: 0, DEFICIENTE: 0 };
    allData.forEach(function (d) { if (d.clasificacion) distribution[d.clasificacion]++; });
    var total = distribution.BUENO + distribution.REGULAR + distribution.DEFICIENTE;

    if (total === 0) {
      container.innerHTML = '<div class="kair-card"><div class="kair-card__body kair-text-center kair-text-muted">Sin datos para mostrar</div></div>';
      return;
    }

    var buenoPct = (distribution.BUENO / total) * 100;
    var regularPct = (distribution.REGULAR / total) * 100;
    var deficientePct = (distribution.DEFICIENTE / total) * 100;

    var conicGradient = 'conic-gradient(var(--kair-success) 0% ' + buenoPct + '%, var(--kair-warning) ' + buenoPct + '% ' + (buenoPct + regularPct) + '%, var(--kair-danger) ' + (buenoPct + regularPct) + '% 100%)';

    container.innerHTML = '<div class="kair-report__distribution">' +
      '<div class="kair-report__dist-chart" style="background:' + conicGradient + '"><div class="kair-report__dist-center"><span class="kair-report__dist-center-value">' + total + '</span><span class="kair-report__dist-center-label">Total</span></div></div>' +
      '<div class="kair-report__dist-legend">' +
        '<div class="kair-report__dist-legend-item"><span class="kair-report__dist-legend-color" style="background:var(--kair-success)"></span><span class="kair-report__dist-legend-label">Bueno</span><span class="kair-report__dist-legend-value">' + distribution.BUENO + ' (' + Math.round(buenoPct) + '%)</span></div>' +
        '<div class="kair-report__dist-legend-item"><span class="kair-report__dist-legend-color" style="background:var(--kair-warning)"></span><span class="kair-report__dist-legend-label">Regular</span><span class="kair-report__dist-legend-value">' + distribution.REGULAR + ' (' + Math.round(regularPct) + '%)</span></div>' +
        '<div class="kair-report__dist-legend-item"><span class="kair-report__dist-legend-color" style="background:var(--kair-danger)"></span><span class="kair-report__dist-legend-label">Deficiente</span><span class="kair-report__dist-legend-value">' + distribution.DEFICIENTE + ' (' + Math.round(deficientePct) + '%)</span></div>' +
      '</div></div>';
  }

  function renderTable() {
    var tbody = document.getElementById('kair-es-report-tbody');
    if (!tbody) return;

    var allData = window.EvaluacionesServiceES.getAllEvaluationsForReport();
    if (filters.tipo) allData = allData.filter(function (d) { return d.tipo === filters.tipo; });
    if (filters.estado) allData = allData.filter(function (d) { return d.clasificacion === filters.estado; });

    if (allData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="kair-table__empty">No se encontraron registros con los filtros aplicados.</td></tr>';
      return;
    }

    tbody.innerHTML = allData.map(function (d) {
      var badgeClass = d.clasificacion ? window.KAIRUtils.getClasificacionBadgeClass(d.clasificacion) : 'kair-badge--secondary';
      var badgeLabel = d.clasificacion ? window.KAIRUtils.getClasificacionLabel(d.clasificacion) : 'Sin evaluar';
      var trendHtml = d.tendencia ? (function () {
        var info = window.KAIRUtils.getTrendInfo(d.tendencia);
        return '<span class="kair-trend ' + info.color + '">' + info.icon + ' ' + info.label + '</span>';
      })() : '<span class="kair-text-muted">—</span>';

      return '<tr>' +
        '<td><strong>' + window.KAIRUtils.escapeHtml(d.razonSocial) + '</strong></td>' +
        '<td><span class="kair-badge kair-badge--primary">' + window.KAIRUtils.getTipoLabel(d.tipo) + '</span></td>' +
        '<td>' + (d.selectionScore !== null ? d.selectionScore.toFixed(1) : '—') + '</td>' +
        '<td>' + (d.lastReevalScore !== null ? d.lastReevalScore.toFixed(1) : '—') + '</td>' +
        '<td>' + trendHtml + '</td>' +
        '<td><span class="kair-badge ' + badgeClass + '">' + badgeLabel + '</span></td>' +
        '<td>' + (d.fecha ? window.KAIRUtils.formatDate(d.fecha) : '—') + '</td></tr>';
    }).join('');
  }

  function renderCriteriaChart() {
    var container = document.getElementById('kair-es-report-criteria-chart');
    if (!container) return;

    var evals = window.EvaluacionesServiceES.getSelectionEvals();
    var reevals = window.EvaluacionesServiceES.getReevaluations();

    var selCriteriaKeys = ['precio', 'disponibilidad', 'experiencia', 'calidad', 'marca', 'requisitosLegales'];
    var reevalCriteriaKeys = ['calidad', 'tiempoEntrega', 'cantidadesPactadas', 'gestionFacturacion', 'garantia', 'sst'];

    var selLabels = { precio: 'Precio', disponibilidad: 'Disponibilidad', experiencia: 'Experiencia', calidad: 'Calidad', marca: 'Marca', requisitosLegales: 'Req. Legales' };
    var reevalLabels = { calidad: 'Calidad', tiempoEntrega: 'Tiempo Entrega', cantidadesPactadas: 'Cantidades', gestionFacturacion: 'Facturación', garantia: 'Garantía', sst: 'SST' };

    var html = '';

    if (evals.length > 0) {
      html += '<h4 class="kair-mb-4">Criterios de Selección</h4><div class="kair-bar-chart">';
      selCriteriaKeys.forEach(function (key) {
        var values = evals.map(function (e) { return e.criterios[key]; }).filter(function (v) { return v !== undefined; });
        var avg = values.length > 0 ? window.KAIRUtils.average(values) : 0;
        var pct = (avg / 5) * 100;
        var colorClass = avg >= 4 ? 'kair-bar-chart__bar--success' : avg >= 2.6 ? 'kair-bar-chart__bar--warning' : 'kair-bar-chart__bar--danger';
        html += '<div class="kair-bar-chart__row"><span class="kair-bar-chart__label">' + selLabels[key] + '</span><div class="kair-bar-chart__bar-track"><div class="kair-bar-chart__bar ' + colorClass + '" style="width:' + pct + '%"><span class="kair-bar-chart__bar-value">' + avg.toFixed(1) + '</span></div></div></div>';
      });
      html += '</div>';
    }

    if (reevals.length > 0) {
      html += '<h4 class="kair-mt-6 kair-mb-4">Criterios de Reevaluación</h4><div class="kair-bar-chart">';
      reevalCriteriaKeys.forEach(function (key) {
        var values = reevals.map(function (r) { return r.criterios[key]; }).filter(function (v) { return v !== undefined; });
        if (values.length === 0) return;
        var avg = window.KAIRUtils.average(values);
        var pct = (avg / 5) * 100;
        var colorClass = avg >= 4 ? 'kair-bar-chart__bar--success' : avg >= 2.6 ? 'kair-bar-chart__bar--warning' : 'kair-bar-chart__bar--danger';
        html += '<div class="kair-bar-chart__row"><span class="kair-bar-chart__label">' + reevalLabels[key] + '</span><div class="kair-bar-chart__bar-track"><div class="kair-bar-chart__bar ' + colorClass + '" style="width:' + pct + '%"><span class="kair-bar-chart__bar-value">' + avg.toFixed(1) + '</span></div></div></div>';
      });
      html += '</div>';
    }

    if (!html) {
      html = '<div class="kair-text-center kair-text-muted kair-text-sm" style="padding:2rem;">Sin datos suficientes para generar gráficos</div>';
    }

    container.innerHTML = html;
  }

  window.ReportesModuleES = { load: load };
})();
