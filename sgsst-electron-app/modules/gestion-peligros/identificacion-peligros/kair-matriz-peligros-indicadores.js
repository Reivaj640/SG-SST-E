/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
indicadores.js — Vista KPIs: 6 KPI cards + barras por sede/clasificación
========================================================================== */
(function (global) {
  'use strict';
  var KM = global.KM;

  var IndicadoresView = {};
  var _companyName = null;
  var _stats = null;

  function _levelCount(stats, key) {
    return (stats && stats.porNivel && stats.porNivel[key]) || 0;
  }

  function _tipoCount(stats, tipo) {
    return (stats && stats.porTipo && stats.porTipo[tipo]) || 0;
  }

  function _sedeCount(stats, sede) {
    return (stats && stats.porSede && stats.porSede[sede]) || 0;
  }

  function _renderKpiStrip(stats) {
    var total = (stats && stats.total) || 0;
    var criticos = _levelCount(stats, 'I');
    var altos = _levelCount(stats, 'II');
    var medios = _levelCount(stats, 'III');
    var bajos = _levelCount(stats, 'IV');
    var expuestos = (stats && stats.totalExpuestos) || 0;

    var items = [
      { label: 'TOTAL PELIGROS', value: total, tone: 'azul',     icon: 'bi-clipboard-check' },
      { label: 'CRÍTICOS (NIVEL I)', sub: 'Requiere atención', value: criticos, tone: 'rojo',     icon: 'bi-exclamation-octagon-fill' },
      { label: 'ALTOS (NIVEL II)', value: altos, tone: 'amarillo', icon: 'bi-exclamation-triangle-fill' },
      { label: 'MEDIOS (NIVEL III)', value: medios, tone: 'info',    icon: 'bi-info-circle-fill' },
      { label: 'BAJOS (NIVEL IV)', value: bajos, tone: 'verde',    icon: 'bi-check-circle-fill' },
      { label: 'TOTAL EXPUESTOS', sub: 'personas expuestas', value: expuestos.toLocaleString('es-CO'), tone: 'azul', icon: 'bi-people-fill' }
    ];

    var html = '<div class="km-kpi-strip">';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var sub = it.sub ? '<div class="km-kpi__sub">' + KM.esc(it.sub) + '</div>' : '';
      html += '<div class="km-kpi">' +
        '<div class="km-kpi__icon km-kpi__icon--' + it.tone + '"><i class="bi ' + it.icon + '"></i></div>' +
        '<div class="km-kpi__body">' +
          '<div class="km-kpi__value">' + KM.esc(it.value) + '</div>' +
          '<div class="km-kpi__label">' + KM.esc(it.label) + '</div>' +
          sub +
        '</div>' +
      '</div>';
    }
    html += '</div>';
    return html;
  }

  function _renderBarSection(title, icon, data, maxOverride) {
    var entries = [];
    var max = maxOverride || 0;
    Object.keys(data).forEach(function (k) {
      entries.push({ label: k, value: data[k] });
      if (data[k] > max) max = data[k];
    });
    // Ordenar por valor descendente
    entries.sort(function (a, b) { return b.value - a.value; });

    var total = entries.reduce(function (s, e) { return s + e.value; }, 0);
    var palette = ['azul', 'verde', 'amarillo', 'rojo', 'naranja', 'morado', 'cyan', 'rosa'];

    var html = '<div class="km-bar-section">' +
      '<div class="km-bar-section__header">' +
        '<div class="km-bar-section__title"><i class="bi ' + icon + '"></i> ' + KM.esc(title) + '</div>' +
        '<span class="km-bar-section__count">' + total + ' total</span>' +
      '</div>';
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var pct = max > 0 ? Math.round((e.value / max) * 100) : 0;
      var color = palette[i % palette.length];
      html += '<div class="km-bar-row">' +
        '<div class="km-bar-row__label">' + KM.esc(e.label) + '</div>' +
        '<div class="km-bar-row__track">' +
          '<div class="km-bar-row__fill km-bar-row__fill--' + color + '" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<div class="km-bar-row__count">' + e.value + '</div>' +
      '</div>';
    }
    html += '</div>';
    return html;
  }

  IndicadoresView.load = function (companyName) {
    _companyName = companyName;
    var container = document.getElementById('km-view-indicadores');
    if (!container) return;
    container.innerHTML = '<div class="km-empty"><div class="km-kpi__icon"><i class="bi bi-arrow-clockwise"></i></div><p>Cargando indicadores...</p></div>';
    global.KMService.stats(companyName).then(function (r) {
      _stats = (r && r.success) ? r.data : null;
      if (!_stats) { container.innerHTML = '<div class="km-empty"><i class="bi bi-x-circle"></i><h3>Error al cargar</h3></div>'; return; }
      container.innerHTML = '<div class="km-kpis-body">' +
        _renderKpiStrip(_stats) +
        _renderBarSection('Peligros por sede', 'bi-building', _stats.porSede || {}) +
        _renderBarSection('Peligros por clasificación', 'bi-tag', _stats.porTipo || {}) +
        '</div>';
    }).catch(function () {
      container.innerHTML = '<div class="km-empty"><i class="bi bi-x-circle"></i><h3>Error al cargar indicadores</h3></div>';
    });
  };

  IndicadoresView.refresh = function () { if (_companyName) IndicadoresView.load(_companyName); };
  IndicadoresView.destroy = function () { _stats = null; _companyName = null; };

  global.KMIndicadoresView = IndicadoresView;
})(window);
