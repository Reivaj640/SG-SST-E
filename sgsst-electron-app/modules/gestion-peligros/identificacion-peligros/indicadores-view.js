/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
Vista Indicadores — 6 KPIs + Chart.js (doughnut, bar, top procesos) + Heat Map + Notas
Patrón: window.IndicadoresView = { load, destroy, refresh } — Direct DOM
========================================================================== */
(function () {
'use strict';

var _companyName = null;
var _stats = null;
var _heatmap = null;
var _notas = null;
var _charts = [];

var GTC45_COLORS = {
  I: '#1b5e20',
  II: '#f57f17',
  III: '#e65100',
  IV: '#b71c1c',
  V: '#4a148c'
};

var NIVEL_LABELS = {
  I: 'Aceptable',
  II: 'Aceptable con control',
  III: 'Inaceptable nivel 1',
  IV: 'Inaceptable nivel 2',
  V: 'Inaceptable nivel 3'
};

var ND_LABELS = ['Muy Alto', 'Alto', 'Medio', 'Bajo', 'Muy Bajo', 'No existe'];
var NC_LABELS = ['10', '20', '40', '60', '80', '100'];

function _escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _destroyCharts() {
  for (var i = 0; i < _charts.length; i++) {
    if (_charts[i] && typeof _charts[i].destroy === 'function') {
      _charts[i].destroy();
    }
  }
  _charts = [];
}

function _kpiGenerator1_TotalPeligros(stats) {
  return {
    id: 'total',
    header: 'Total Peligros',
    value: stats.total || 0,
    footer: 'Identificados en la matriz',
    variant: ''
  };
}

function _kpiGenerator2_Evaluados(stats) {
  var ev = stats.evaluados || 0;
  var total = stats.total || 0;
  var tasa = stats.tasaEvaluados || 0;
  return {
    id: 'evaluados',
    header: 'Evaluados',
    value: ev + '/' + total,
    footer: tasa + '% con ND/NE/NC asignado',
    variant: tasa >= 80 ? 'verde' : (tasa >= 50 ? 'amarillo' : 'rojo')
  };
}

function _kpiGenerator3_Inaceptables(stats) {
  var inac = stats.inaceptables || 0;
  var tasa = stats.tasaInaceptable || 0;
  return {
    id: 'inaceptables',
    header: 'Inaceptables',
    value: inac,
    footer: 'Nivel IV+V · Tasa ' + tasa + '%',
    variant: tasa >= 30 ? 'rojo' : (tasa >= 15 ? 'naranja' : 'verde')
  };
}

function _kpiGenerator4_MaxNR(stats) {
  return {
    id: 'maxnr',
    header: 'NR Máximo',
    value: stats.maxNR || 0,
    footer: 'Mayor nivel de riesgo registrado',
    variant: ''
  };
}

function _kpiGenerator5_CoberturaSedes(stats) {
  return {
    id: 'sedes',
    header: 'Cobertura Sedes',
    value: stats.totalSedes || 0,
    footer: (stats.totalProcesos || 0) + ' procesos · ' + (stats.totalCargos || 0) + ' cargos',
    variant: ''
  };
}

function _kpiGenerator6_Distribucion(stats) {
  var porAcept = stats.porAcept || {};
  var dominant = 'I';
  var maxCount = 0;
  var levels = ['I', 'II', 'III', 'IV', 'V'];
  for (var i = 0; i < levels.length; i++) {
    if ((porAcept[levels[i]] || 0) > maxCount) {
      maxCount = porAcept[levels[i]] || 0;
      dominant = levels[i];
    }
  }
  return {
    id: 'distribucion',
    header: 'Nivel Dominante',
    value: 'Nivel ' + dominant,
    footer: maxCount + ' peligros (' + ((stats.total || 0) > 0 ? Math.round(maxCount / stats.total * 100) : 0) + '%)',
    variant: (dominant === 'IV' || dominant === 'V') ? 'rojo' : (dominant === 'III' ? 'naranja' : (dominant === 'II' ? 'amarillo' : 'verde'))
  };
}

var KPI_GENERATORS = [
  _kpiGenerator1_TotalPeligros,
  _kpiGenerator2_Evaluados,
  _kpiGenerator3_Inaceptables,
  _kpiGenerator4_MaxNR,
  _kpiGenerator5_CoberturaSedes,
  _kpiGenerator6_Distribucion
];

function _renderKPIs(stats) {
  var html = '<div class="kair-mp-ind__kpis">';
  for (var i = 0; i < KPI_GENERATORS.length; i++) {
    var kpi = KPI_GENERATORS[i](stats);
    var cls = 'kair-mp-ind__kpi';
    if (kpi.variant) cls += ' kair-mp-ind__kpi--' + kpi.variant;
    html += '<div class="' + cls + '">';
    html += '<div class="kair-mp-ind__kpi-header">' + _escHtml(kpi.header) + '</div>';
    html += '<div class="kair-mp-ind__kpi-value">' + _escHtml(String(kpi.value)) + '</div>';
    html += '<div class="kair-mp-ind__kpi-footer">' + _escHtml(kpi.footer) + '</div>';
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function _renderChartsSkeleton() {
  var html = '<div class="kair-mp-ind__charts">';
  html += '<div class="kair-mp-ind__chart">';
  html += '<div class="kair-mp-ind__chart-title"><i class="bi bi-pie-chart"></i> Distribución por Aceptabilidad</div>';
  html += '<canvas id="kair-mp-chart-acept"></canvas>';
  html += '</div>';
  html += '<div class="kair-mp-ind__chart">';
  html += '<div class="kair-mp-ind__chart-title"><i class="bi bi-bar-chart"></i> Peligros por Tipo</div>';
  html += '<canvas id="kair-mp-chart-tipo"></canvas>';
  html += '</div>';
  html += '<div class="kair-mp-ind__chart">';
  html += '<div class="kair-mp-ind__chart-title"><i class="bi bi-building"></i> Top 8 Procesos</div>';
  html += '<canvas id="kair-mp-chart-procesos"></canvas>';
  html += '</div>';
  html += '</div>';
  return html;
}

function _renderChartNote() {
  return '<div class="kair-mp-ind__chart-note"><i class="bi bi-info-circle"></i> Los gráficos se generan a partir de los datos de la matriz actual. Actualice la Matriz para reflejar cambios.</div>';
}

function _renderHeatmapSkeleton() {
  return '<div class="kair-mp-ind__heatmap">' +
    '<div class="kair-mp-ind__heatmap-title"><i class="bi bi-grid-3x3"></i> Mapa de Calor ND × NC (NE=2 referencia)</div>' +
    '<div class="kair-mp-ind__heatmap-subtitle">Cada celda muestra NP/NR de referencia con NE=2. El badge indica la cantidad de peligros reales.</div>' +
    '<div id="kair-mp-heatmap-grid" class="kair-mp-ind__heatmap-grid"></div>' +
    '</div>';
}

function _renderNotasSkeleton() {
  return '<div class="kair-mp-ind__notas">' +
    '<div class="kair-mp-ind__notas-title"><i class="bi bi-lightbulb"></i> Notas Analíticas</div>' +
    '<div id="kair-mp-notas-body"></div>' +
    '</div>';
}

function _buildCharts(stats) {
  if (typeof Chart === 'undefined') return;

  _destroyCharts();

  var porAcept = stats ? stats.porAcept : {};
  var niveles = ['I', 'II', 'III', 'IV', 'V'];
  var aceptData = niveles.map(function (n) { return porAcept[n] || 0; });
  var aceptColors = niveles.map(function (n) { return GTC45_COLORS[n]; });
  var aceptLabels = niveles.map(function (n) { return 'Nivel ' + n + ' — ' + NIVEL_LABELS[n]; });

  var ctxAcept = document.getElementById('kair-mp-chart-acept');
  if (ctxAcept) {
    _charts.push(new Chart(ctxAcept, {
      type: 'doughnut',
      data: {
        labels: aceptLabels,
        datasets: [{
          data: aceptData,
          backgroundColor: aceptColors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 } } }
        }
      }
    }));
  }

  var porTipo = stats ? stats.porTipo : {};
  var tipoKeys = Object.keys(porTipo);
  var tipoData = tipoKeys.map(function (k) { return porTipo[k]; });

  var ctxTipo = document.getElementById('kair-mp-chart-tipo');
  if (ctxTipo && tipoKeys.length) {
    _charts.push(new Chart(ctxTipo, {
      type: 'bar',
      data: {
        labels: tipoKeys,
        datasets: [{
          label: 'Peligros',
          data: tipoData,
          backgroundColor: '#174ea6',
          borderRadius: 4,
          maxBarThickness: 40
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } },
          y: { ticks: { font: { size: 11 } } }
        }
      }
    }));
  }

  var porCargo = stats ? stats.porCargo : {};
  var cargoKeys = Object.keys(porCargo);
  cargoKeys.sort(function (a, b) { return (porCargo[b] || 0) - (porCargo[a] || 0); });
  var top8 = cargoKeys.slice(0, 8);
  var top8Labels = top8.map(function (k) {
    var parts = k.split('@@');
    var cargoName = parts[0] || k;
    if (cargoName.length > 22) cargoName = cargoName.substring(0, 20) + '…';
    return cargoName;
  });
  var top8Data = top8.map(function (k) { return porCargo[k] || 0; });
  var top8Colors = top8.map(function (k, idx) {
    var count = porCargo[k] || 0;
    var maxCount = top8Data[0] || 1;
    var ratio = count / maxCount;
    if (ratio > 0.75) return '#b71c1c';
    if (ratio > 0.5) return '#e65100';
    if (ratio > 0.25) return '#f57f17';
    return '#1b5e20';
  });

  var ctxProc = document.getElementById('kair-mp-chart-procesos');
  if (ctxProc && top8.length) {
    _charts.push(new Chart(ctxProc, {
      type: 'bar',
      data: {
        labels: top8Labels,
        datasets: [{
          label: 'Peligros',
          data: top8Data,
          backgroundColor: top8Colors,
          borderRadius: 4,
          maxBarThickness: 40
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } },
          y: { ticks: { font: { size: 10 } } }
        }
      }
    }));
  }
}

function _buildHeatmap(heatmap) {
  var gridEl = document.getElementById('kair-mp-heatmap-grid');
  if (!gridEl) return;

  var html = '';

  html += '<div class="kair-mp-ind__heatmap-cell kair-mp-ind__heatmap-cell--header"></div>';
  for (var nci = 0; nci < 6; nci++) {
    html += '<div class="kair-mp-ind__heatmap-cell kair-mp-ind__heatmap-cell--header">NC=' + NC_LABELS[nci] + '</div>';
  }

  for (var ndi = 0; ndi < 6; ndi++) {
    html += '<div class="kair-mp-ind__heatmap-cell kair-mp-ind__heatmap-cell--row-header">ND=' + ndi + '<br><span style="font-weight:400;font-size:0.55rem;">' + ND_LABELS[ndi] + '</span></div>';
    for (var nci2 = 0; nci2 < 6; nci2++) {
      var cell = (heatmap && heatmap[ndi] && heatmap[ndi][nci2]) ? heatmap[ndi][nci2] : null;
      var nivel = cell ? cell.nivel : '';
      var nrVal = cell ? cell.nr : '';
      var npVal = cell ? cell.np : '';
      var count = cell ? cell.count : 0;
      var nivelClass = nivel ? ' kair-mp-ind__heatmap-cell--' + nivel : '';

      html += '<div class="kair-mp-ind__heatmap-cell' + nivelClass + ' kair-mp-ind__heatmap-cell--count">';
      html += '<span style="font-size:0.6rem;">NP ' + npVal + '</span><br>';
      html += '<span style="font-weight:700;">' + nrVal + '</span>';
      if (count > 0) {
        html += '<span class="kair-mp-ind__heatmap-count">' + count + '</span>';
      }
      html += '</div>';
    }
  }

  gridEl.innerHTML = html;
}

function _buildNotas(notas) {
  var body = document.getElementById('kair-mp-notas-body');
  if (!body) return;

  if (!notas || !notas.length) {
    body.innerHTML = '<p style="font-size:var(--kair-mp-font-size-sm);color:var(--kair-mp-text-muted);">No hay notas analíticas disponibles. Identifique peligros en la Matriz.</p>';
    return;
  }

  var html = '';
  for (var i = 0; i < notas.length; i++) {
    html += '<div class="kair-mp-ind__note">';
    html += '<i class="bi bi-lightbulb kair-mp-ind__note-icon"></i>';
    html += '<span>' + notas[i] + '</span>';
    html += '</div>';
  }
  body.innerHTML = html;
}

function _render(container) {
  var html = '<h2 class="kair-mp-ind__title"><i class="bi bi-speedometer2"></i> Indicadores KPI — Identificación de Peligros</h2>';

  html += _renderKPIs(_stats);
  html += _renderChartsSkeleton();
  html += _renderChartNote();
  html += _renderHeatmapSkeleton();
  html += _renderNotasSkeleton();

  container.innerHTML = html;

  setTimeout(function () {
    _buildCharts(_stats);
    _buildHeatmap(_heatmap);
    _buildNotas(_notas);
  }, 80);
}

function _reload() {
  if (!_companyName) return;
  var container = document.getElementById('kair-mp-indicadores-content');
  if (!container) return;

  var statsP = IdentificacionPeligrosService.stats(_companyName);
  var heatP = IdentificacionPeligrosService.heatmap(_companyName);
  var notasP = IdentificacionPeligrosService.notasAnaliticas(_companyName);

  Promise.all([statsP, heatP, notasP]).then(function (results) {
    var statsResult = results[0];
    var heatResult = results[1];
    var notasResult = results[2];

    if (statsResult && statsResult.success && statsResult.data) {
      _stats = statsResult.data;
    }
    if (heatResult && heatResult.success && heatResult.data) {
      _heatmap = heatResult.data;
    }
    if (notasResult && notasResult.success && notasResult.data) {
      _notas = notasResult.data;
    }

    _render(container);
  }).catch(function () {
    container.innerHTML = '<div class="kair-mp-acc__empty-state"><i class="bi bi-x-circle"></i><h3>Error al cargar indicadores</h3></div>';
  });
}

var IndicadoresView = {
  load: function (companyName) {
    _companyName = companyName;
    _destroyCharts();

    var container = document.getElementById('kair-mp-indicadores-content');
    if (!container) return;
    container.innerHTML = '<div class="kair-mp-loading"><div class="kair-mp-spinner"></div><p>Cargando indicadores...</p></div>';

    var statsP = IdentificacionPeligrosService.stats(companyName);
    var heatP = IdentificacionPeligrosService.heatmap(companyName);
    var notasP = IdentificacionPeligrosService.notasAnaliticas(companyName);

    Promise.all([statsP, heatP, notasP]).then(function (results) {
      var statsResult = results[0];
      var heatResult = results[1];
      var notasResult = results[2];

      if (statsResult && statsResult.success && statsResult.data) {
        _stats = statsResult.data;
      }
      if (heatResult && heatResult.success && heatResult.data) {
        _heatmap = heatResult.data;
      }
      if (notasResult && notasResult.success && notasResult.data) {
        _notas = notasResult.data;
      }

      _render(container);
    }).catch(function () {
      container.innerHTML = '<div class="kair-mp-acc__empty-state"><i class="bi bi-x-circle"></i><h3>Error al cargar indicadores</h3></div>';
    });
  },

  destroy: function () {
    _destroyCharts();
    _stats = null;
    _heatmap = null;
    _notas = null;
    _companyName = null;
  },

  refresh: function () {
    if (_companyName) _reload();
  }
};

window.IndicadoresView = IndicadoresView;
})();
