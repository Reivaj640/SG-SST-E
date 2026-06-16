/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Submódulo 6.1.1 — Modal de Detalle de Indicador
   3 tabs: Información, Datos Mensuales, Tendencia
   ═══════════════════════════════════════════════════════════════════ */

var IndicadoresDetalleModal = (function () {
  'use strict';

  var _currentIndicator = null;
  var _currentTab = 'info';
  var _charts = [];

  function _destroyCharts() {
    for (var i = 0; i < _charts.length; i++) {
      if (_charts[i] && typeof _charts[i].destroy === 'function') _charts[i].destroy();
    }
    _charts = [];
  }

  function _esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function _renderInfoTab(ind) {
    var targetDisplay = IndicadoresService.formatTarget(ind);
    var valueDisplay = IndicadoresService.formatValue(ind);

    return '<div class="kair-ind-detail-grid">' +
      '<div class="kair-ind-detail-field kair-ind-detail-field--full">' +
        '<label class="kair-ind-detail-field__label">Definición</label>' +
        '<div class="kair-ind-detail-field__value">' + _esc(ind.definition) + '</div>' +
      '</div>' +
      '<div class="kair-ind-detail-field">' +
        '<label class="kair-ind-detail-field__label"><i class="bi bi-calculator"></i> Fórmula</label>' +
        '<div class="kair-ind-detail-field__value">' + _esc(ind.formula) + '</div>' +
      '</div>' +
      '<div class="kair-ind-detail-field">' +
        '<label class="kair-ind-detail-field__label">¿Cómo se mide?</label>' +
        '<div class="kair-ind-detail-field__value">' + _esc(ind.howToMeasure) + '</div>' +
      '</div>' +
      '<div class="kair-ind-detail-field">' +
        '<label class="kair-ind-detail-field__label">Fuente de Información</label>' +
        '<div class="kair-ind-detail-field__value">' + _esc(ind.source) + '</div>' +
      '</div>' +
      '<div class="kair-ind-detail-field">' +
        '<label class="kair-ind-detail-field__label">Responsable</label>' +
        '<div class="kair-ind-detail-field__value">' + _esc(ind.responsible) + '</div>' +
      '</div>' +
      '<div class="kair-ind-detail-field">' +
        '<label class="kair-ind-detail-field__label">Frecuencia de Medición</label>' +
        '<div class="kair-ind-detail-field__value">' + _esc(ind.frequency) + '</div>' +
      '</div>' +
      '<div class="kair-ind-detail-field">' +
        '<label class="kair-ind-detail-field__label">Unidad</label>' +
        '<div class="kair-ind-detail-field__value">' + _esc(ind.unit) + '</div>' +
      '</div>' +
      '<div class="kair-ind-detail-field">' +
        '<label class="kair-ind-detail-field__label">Meta</label>' +
        '<div class="kair-ind-detail-field__value">' + _esc(targetDisplay) + '</div>' +
      '</div>' +
      '<div class="kair-ind-detail-field kair-ind-detail-field--full">' +
        '<label class="kair-ind-detail-field__label">Interpretación</label>' +
        '<div class="kair-ind-detail-field__value">' + _esc(ind.interpretation) + '</div>' +
      '</div>' +
      '<div class="kair-ind-detail-field">' +
        '<label class="kair-ind-detail-field__label">Divulgación</label>' +
        '<div class="kair-ind-detail-field__value">' + _esc(ind.disclosure) + '</div>' +
      '</div>' +
      '<div class="kair-ind-detail-field">' +
        '<label class="kair-ind-detail-field__label">Estado Actual</label>' +
        '<div class="kair-ind-detail-field__value">' +
          '<span class="kair-ind-badge" style="background:' + IndicadoresService.getStatusBg(ind.status) +
          ';color:' + IndicadoresService.getStatusColor(ind.status) + '">' +
          IndicadoresService.getStatusLabel(ind.status) + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function _renderDataTab(ind) {
    var isPercent = ind.unit === 'Porcentaje' || ind.unit === 'Cumplimiento';
    var targetVal = isPercent ? ind.target * 100 : ind.target;

    var rows = ind.monthlyData.map(function (dp) {
      var val = dp.value;
      var diff = val !== null ? val - targetVal : null;
      var valDisplay = val !== null ? (isPercent ? val.toFixed(1) + '%' : val.toLocaleString()) : '—';
      var diffHtml = diff !== null
        ? '<span style="color:' + (diff >= 0 ? '#28a745' : '#dc3545') + ';font-weight:500">' +
            (diff >= 0 ? '+' : '') + (isPercent ? diff.toFixed(1) + '%' : diff.toLocaleString()) + '</span>'
        : '—';

      return '<tr>' +
        '<td class="kair-ind-data-table__month">' + dp.month + '</td>' +
        '<td class="kair-ind-data-table__num">' + dp.numerator + '</td>' +
        '<td class="kair-ind-data-table__num">' + dp.denominator + '</td>' +
        '<td class="kair-ind-data-table__num">' + valDisplay + '</td>' +
        '<td class="kair-ind-data-table__num">' + diffHtml + '</td>' +
      '</tr>';
    }).join('');

    return '<div class="kair-ind-data-table-wrapper">' +
      '<table class="kair-ind-data-table">' +
      '<thead><tr>' +
        '<th>Mes</th><th>Numerador</th><th>Denominador</th><th>Valor</th><th>vs Meta</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>';
  }

  function _renderChartTab(ind) {
    return '<div class="kair-ind-chart-container">' +
      '<div class="kair-ind-chart" id="kair-ind-chart-bars"></div>' +
      '<div class="kair-ind-chart__legend">' +
        '<div class="kair-ind-chart__legend-item">' +
          '<span class="kair-ind-chart__legend-dot" style="background:#174ea6"></span> Valor mensual' +
        '</div>' +
        '<div class="kair-ind-chart__legend-item">' +
          '<span class="kair-ind-chart__legend-line"></span> Meta (' + _esc(IndicadoresService.formatTarget(ind)) + ')' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function _buildChart(ind) {
    _destroyCharts();
    if (typeof Chart === 'undefined') return;

    var container = document.getElementById('kair-ind-chart-bars');
    if (!container) return;

    var isPercent = ind.unit === 'Porcentaje' || ind.unit === 'Cumplimiento';
    var targetVal = isPercent ? ind.target * 100 : ind.target;
    var maxVal = Math.max.apply(null, ind.monthlyData.map(function (d) { return d.value || 0; }).concat([targetVal]));
    if (maxVal === 0) maxVal = 1;

    container.innerHTML = '';

    ind.monthlyData.forEach(function (dp) {
      var barHeight = dp.value !== null ? (dp.value / maxVal) * 100 : 0;
      var targetHeight = (targetVal / maxVal) * 100;
      var barColor = ind.status === 'critico' ? '#dc3545'
        : (dp.value !== null && dp.value >= ind.target) ? '#28a745' : '#174ea6';

      var group = document.createElement('div');
      group.className = 'kair-ind-chart__bar-group';
      group.innerHTML =
        '<div class="kair-ind-chart__bar-container">' +
          '<div class="kair-ind-chart__bar" style="height:' + Math.min(barHeight, 100) + '%;background:' + barColor + '"></div>' +
          '<div class="kair-ind-chart__target-line" style="bottom:' + Math.min(targetHeight, 100) + '%"></div>' +
        '</div>' +
        '<span class="kair-ind-chart__bar-label">' + dp.month + '</span>';
      container.appendChild(group);
    });
  }

  function open(indicator, onEdit) {
    _currentIndicator = indicator;
    _currentTab = 'info';

    var overlay = document.getElementById('kair-ind-modal');
    if (!overlay) return;

    var titleEl = document.getElementById('kair-ind-modal-title');
    var contentEl = document.getElementById('kair-ind-modal-content');
    var typeBadge = document.getElementById('kair-ind-modal-type-badge');

    if (titleEl) titleEl.textContent = indicator.name;
    if (typeBadge) {
      typeBadge.textContent = indicator.type;
      typeBadge.style.background = IndicadoresService.getTypeBg(indicator.type);
      typeBadge.style.color = IndicadoresService.getTypeColor(indicator.type);
    }

    _renderContent(contentEl);
    _updateTabs();

    overlay.classList.add('visible');

    var closeBtn = document.getElementById('kair-ind-modal-close');
    var cancelBtn = document.getElementById('kair-ind-modal-cancel');
    var editBtn = document.getElementById('kair-ind-modal-edit');

    function closeFn() { close(); }
    if (closeBtn) { closeBtn.onclick = closeFn; }
    if (cancelBtn) { cancelBtn.onclick = closeFn; }
    if (editBtn) {
      editBtn.onclick = function () {
        close();
        if (onEdit) onEdit(indicator);
      };
    }

    overlay.onclick = function (e) {
      if (e.target === overlay) close();
    };

    var modalTabs = overlay.querySelectorAll('.kair-ind-modal__tab');
    modalTabs.forEach(function (tab) {
      tab.onclick = function () {
        _currentTab = tab.getAttribute('data-modal-tab');
        _updateTabs();
        _renderContent(contentEl);
        if (_currentTab === 'chart') {
          setTimeout(function () { _buildChart(_currentIndicator); }, 50);
        }
      };
    });
  }

  function close() {
    _destroyCharts();
    _currentIndicator = null;
    var overlay = document.getElementById('kair-ind-modal');
    if (overlay) overlay.classList.remove('visible');
  }

  function _updateTabs() {
    var overlay = document.getElementById('kair-ind-modal');
    if (!overlay) return;
    var tabs = overlay.querySelectorAll('.kair-ind-modal__tab');
    tabs.forEach(function (tab) {
      if (tab.getAttribute('data-modal-tab') === _currentTab) {
        tab.classList.add('kair-ind-modal__tab--active');
      } else {
        tab.classList.remove('kair-ind-modal__tab--active');
      }
    });
  }

  function _renderContent(contentEl) {
    if (!contentEl || !_currentIndicator) return;
    switch (_currentTab) {
      case 'info':
        contentEl.innerHTML = _renderInfoTab(_currentIndicator);
        break;
      case 'data':
        contentEl.innerHTML = _renderDataTab(_currentIndicator);
        break;
      case 'chart':
        contentEl.innerHTML = _renderChartTab(_currentIndicator);
        break;
    }
  }

  return {
    open: open,
    close: close
  };
})();
