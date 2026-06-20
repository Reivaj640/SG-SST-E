/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
Vista Priorización — ISO 45001 §6.1.2: 10 col evaluación riesgos + distribución + escala
Tabla real (<table>) con mismos estilos visuales que la Matriz
Patrón: window.PriorizacionView = { load, destroy, refresh } — Direct DOM
========================================================================== */
(function () {
'use strict';

var _companyName = null;
var _grupos = null;
var _stats = null;
var _sortCol = 'nr';
var _sortDir = 'desc';
var _collapsedGroups = {};

var GTC45_COLORS = {
  V: '#4a148c',
  IV: '#b71c1c',
  III: '#e65100',
  II: '#f57f17',
  I: '#1b5e20'
};

var NIVEL_META = {
  V: { icon: 'bi-exclamation-diamond-fill', label: 'Inaceptable nivel 3', rango: '>200', acept: 'No Aceptable' },
  IV: { icon: 'bi-exclamation-triangle-fill', label: 'Inaceptable nivel 2', rango: '121-200', acept: 'No Aceptable' },
  III: { icon: 'bi-exclamation-circle-fill', label: 'Inaceptable nivel 1', rango: '41-120', acept: 'No Aceptable' },
  II: { icon: 'bi-info-circle-fill', label: 'Aceptable con control', rango: '11-40', acept: 'Aceptable' },
  I: { icon: 'bi-check-circle-fill', label: 'Aceptable', rango: '≤10', acept: 'Aceptable' }
};

var TABLE_COLS = [
  { key: 'tipo', label: 'Tipo de\nPeligro', type: 'select-tipo' },
  { key: 'peligro', label: 'Peligro', type: 'text' },
  { key: 'efectosPosibles', label: 'Efectos\nPosibles', type: 'text' },
  { key: 'nd', label: 'ND', type: 'number' },
  { key: 'ne', label: 'NE', type: 'number' },
  { key: 'np', label: 'NP', type: 'computed' },
  { key: 'nc', label: 'NC', type: 'number' },
  { key: 'nr', label: 'NR', type: 'computed' },
  { key: 'nrNivel', label: 'Nivel de\nRiesgo', type: 'computed' },
  { key: 'nrLabel', label: 'Aceptabilidad', type: 'computed' }
];

function _escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _sortPeligros(peligros, col, dir) {
  if (!peligros || !peligros.length) return peligros;
  var sorted = peligros.slice(0);
  sorted.sort(function (a, b) {
    var va = a[col];
    var vb = b[col];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') {
      return dir === 'asc' ? va - vb : vb - va;
    }
    var sa = String(va).toLowerCase();
    var sb = String(vb).toLowerCase();
    if (sa < sb) return dir === 'asc' ? -1 : 1;
    if (sa > sb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

function _renderStatsBar() {
  if (!_stats) return '';
  var total = _stats.total || 0;
  var inac = _stats.inaceptables || 0;
  var tasa = _stats.tasaInaceptable || 0;
  var ev = _stats.evaluados || 0;

  var kpis = [
    { header: 'Peligros', value: total, footer: 'Identificados en la matriz', variant: 'morado' },
    { header: 'Sedes', value: _stats.totalSedes || 0, footer: 'Con peligros asociados', variant: 'primary' },
    { header: 'Procesos', value: _stats.totalProcesos || 0, footer: 'Con peligros asociados', variant: 'primary' },
    { header: 'Cargos', value: _stats.totalCargos || 0, footer: 'Con peligros asociados', variant: 'primary' },
    { header: 'Inaceptables', value: inac, footer: 'Nivel III / IV / V', variant: 'rojo' },
    { header: 'Tasa Inaceptabilidad', value: tasa + '%', footer: 'Proporción del total', variant: 'naranja' },
    { header: 'Evaluados', value: ev + '/' + total, footer: 'Con ND + NE + NC asignados', variant: 'verde' }
  ];

  var html = '<div class="kair-mp-prior__kpis">';
  for (var i = 0; i < kpis.length; i++) {
    var kpi = kpis[i];
    var cls = 'kair-mp-prior__kpi';
    if (kpi.variant) cls += ' kair-mp-prior__kpi--' + kpi.variant;
    html += '<div class="' + cls + '">';
    html += '<div class="kair-mp-prior__kpi-header">' + _escHtml(kpi.header) + '</div>';
    html += '<div class="kair-mp-prior__kpi-value">' + _escHtml(String(kpi.value)) + '</div>';
    html += '<div class="kair-mp-prior__kpi-footer">' + _escHtml(kpi.footer) + '</div>';
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function _renderDistributionBar() {
  if (!_stats || !_stats.porAcept) return '';
  var total = _stats.total || 0;
  if (total === 0) return '';

  var porAcept = _stats.porAcept;
  var levels = ['V', 'IV', 'III', 'II', 'I'];

  var html = '<div class="kair-mp-prior__dist-bar">';
  html += '<div class="kair-mp-prior__dist-track">';
  for (var i = 0; i < levels.length; i++) {
    var lvl = levels[i];
    var count = porAcept[lvl] || 0;
    if (count === 0) continue;
    var pct = (count / total * 100).toFixed(1);
    html += '<div class="kair-mp-prior__dist-segment kair-mp-prior__dist-segment--' + lvl + '" style="width:' + pct + '%;" title="Nivel ' + lvl + ': ' + count + ' (' + pct + '%)"></div>';
  }
  html += '</div>';
  html += '<div class="kair-mp-prior__dist-legend">';
  for (var j = 0; j < levels.length; j++) {
    var l = levels[j];
    var c = porAcept[l] || 0;
    html += '<div class="kair-mp-prior__dist-legend-item"><span class="kair-mp-prior__dist-dot" style="background:' + GTC45_COLORS[l] + ';"></span><span>Nivel ' + l + ' (' + c + ')</span></div>';
  }
  html += '</div>';
  html += '</div>';
  return html;
}

function _renderScale() {
  var levels = ['I', 'II', 'III', 'IV', 'V'];
  var html = '<div class="kair-mp-prior__scale">';
  html += '<div class="kair-mp-prior__scale-title">Escala GTC-45 — Nivel de Riesgo</div>';
  html += '<div class="kair-mp-prior__scale-track">';
  for (var i = 0; i < levels.length; i++) {
    var l = levels[i];
    var m = NIVEL_META[l];
    html += '<div class="kair-mp-prior__scale-seg kair-mp-prior__scale-seg--' + l + '">';
    html += '<div class="kair-mp-prior__scale-nivel" style="background:' + GTC45_COLORS[l] + ';">' + l + '</div>';
    html += '<div class="kair-mp-prior__scale-info"><strong>' + _escHtml(m.label) + '</strong><span>NR ' + m.rango + '</span><span>' + m.acept + '</span></div>';
    html += '</div>';
  }
  html += '</div>';
  html += '</div>';
  return html;
}

function _renderTableHeader() {
  var html = '<thead><tr>';
  for (var i = 0; i < TABLE_COLS.length; i++) {
    var col = TABLE_COLS[i];
    var isActive = _sortCol === col.key;
    var arrow = isActive ? (_sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    var cls = 'kair-mp-prior__th';
    if (isActive) cls += ' kair-mp-prior__th--active';
    if (col.type === 'number') cls += ' kair-mp-prior__th--num';
    if (col.type === 'computed') cls += ' kair-mp-prior__th--computed';
    html += '<th class="' + cls + '" data-sort="' + col.key + '">' + col.label.replace(/\n/g, '<br>') + arrow + '</th>';
  }
  html += '</tr></thead>';
  return html;
}

function _renderTableRow(p, nivel) {
  var html = '<tr class="kair-mp-prior__peligro-row">';
  for (var i = 0; i < TABLE_COLS.length; i++) {
    var col = TABLE_COLS[i];
    var val = p[col.key];
    var cls = 'kair-mp-prior__td';
    if (col.type === 'computed') {
      cls += ' kair-mp-acc__cell--computed';
      if (col.key === 'nr') {
        cls += ' kair-mp-acc__cell--nr';
      }
      if ((col.key === 'nr' || col.key === 'nrNivel' || col.key === 'nrLabel') && nivel) {
        cls += ' kair-mp-acc__cell--nivel-' + nivel;
      }
      html += '<td class="' + cls + '">' + (val != null ? _escHtml(String(val)) : '—') + '</td>';
    } else if (col.type === 'number') {
      cls += ' kair-mp-prior__td--num';
      html += '<td class="' + cls + '">' + (val != null ? val : '—') + '</td>';
    } else {
      html += '<td class="' + cls + '">' + _escHtml(val || '—') + '</td>';
    }
  }
  html += '</tr>';
  return html;
}

function _renderGroup(grupo) {
  var meta = NIVEL_META[grupo.nivel] || {};
  var count = grupo.peligros ? grupo.peligros.length : 0;
  var isCollapsed = _collapsedGroups[grupo.nivel] === true;
  var sorted = _sortPeligros(grupo.peligros, _sortCol, _sortDir);

  var html = '<div class="kair-mp-prior__group kair-mp-prior__group--' + grupo.nivel + (isCollapsed ? ' kair-mp-prior__group--collapsed' : '') + '" data-nivel="' + grupo.nivel + '">';
  html += '<div class="kair-mp-prior__group-header">';
  html += '<i class="bi ' + (meta.icon || 'bi-circle') + ' kair-mp-prior__group-icon"></i>';
  html += '<span class="kair-mp-prior__group-label">Nivel ' + grupo.nivel + ' — ' + _escHtml(grupo.label || meta.label) + '</span>';
  html += '<span class="kair-mp-prior__group-range">NR ' + (grupo.rango || meta.rango || '') + '</span>';
  html += '<span class="kair-mp-prior__group-badge">' + count + '</span>';
  html += '<i class="bi bi-chevron-down kair-mp-prior__group-chevron"></i>';
  html += '</div>';

  html += '<div class="kair-mp-prior__group-body">';
  if (count === 0) {
    html += '<div class="kair-mp-prior__empty-row"><i class="bi bi-check2-circle" style="font-size:1.2rem;opacity:0.4;"></i> <span>Sin peligros en este nivel</span></div>';
  } else {
    html += '<div class="kair-mp-acc__table-wrapper">';
    html += '<table class="kair-mp-acc__table kair-mp-prior__table">';
    html += _renderTableHeader();
    html += '<tbody>';
    for (var i = 0; i < sorted.length; i++) {
      html += _renderTableRow(sorted[i], grupo.nivel);
    }
    html += '</tbody>';
    html += '</table>';
    html += '</div>';
  }
  html += '</div>';
  html += '</div>';
  return html;
}

function _renderUnevaluated() {
  if (!_grupos) return '';
  var unevaluated = [];
  for (var g = 0; g < _grupos.length; g++) {
    var grupo = _grupos[g];
    if (!grupo.peligros) continue;
    for (var p = 0; p < grupo.peligros.length; p++) {
      var pel = grupo.peligros[p];
      if (pel.nd == null || pel.ne == null || pel.nc == null) {
        unevaluated.push(pel);
      }
    }
  }
  if (unevaluated.length === 0) return '';

  var html = '<div class="kair-mp-prior__uneval">';
  html += '<div class="kair-mp-prior__uneval-header"><i class="bi bi-question-circle"></i> <span>Peligros sin evaluar</span> <span class="kair-mp-prior__uneval-badge">' + unevaluated.length + '</span></div>';
  html += '<div class="kair-mp-prior__uneval-list">';
  for (var i = 0; i < unevaluated.length; i++) {
    var u = unevaluated[i];
    html += '<div class="kair-mp-prior__uneval-item">';
    html += '<span class="kair-mp-prior__uneval-tipo">' + _escHtml(u.tipo || '—') + '</span>';
    html += '<span class="kair-mp-prior__uneval-peligro">' + _escHtml(u.peligro || '—') + '</span>';
    html += '<span class="kair-mp-prior__uneval-ubicacion">' + _escHtml(u.sede || '') + ' / ' + _escHtml(u.proceso || '') + ' / ' + _escHtml(u.cargo || '') + '</span>';
    html += '</div>';
  }
  html += '</div>';
  html += '</div>';
  return html;
}

function _render(container) {
  if (!_grupos || !_grupos.length) {
    container.innerHTML = '<div class="kair-mp-prior__empty"><i class="bi bi-bar-chart-steps" style="font-size:2.5rem;opacity:0.4;"></i><h3>Sin datos de priorización</h3><p>Identifique peligros en la Matriz para ver la priorización por nivel de riesgo.</p></div>';
    return;
  }

  var html = '';
  html += '<h2 class="kair-mp-prior__title"><i class="bi bi-bar-chart-steps"></i> Priorización de Peligros por Nivel de Riesgo</h2>';
  html += _renderStatsBar();
  html += _renderDistributionBar();
  html += _renderScale();

  for (var j = 0; j < _grupos.length; j++) {
    html += _renderGroup(_grupos[j]);
  }

  html += _renderUnevaluated();

  container.innerHTML = html;
  _bindEvents(container);
}

function _handleSort(e) {
  var th = e.target.closest('.kair-mp-prior__th');
  if (!th) return;
  var col = th.getAttribute('data-sort');
  if (!col) return;

  if (_sortCol === col) {
    _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    _sortCol = col;
    _sortDir = col === 'nr' || col === 'nd' || col === 'ne' || col === 'np' || col === 'nc' ? 'desc' : 'asc';
  }

  var container = document.getElementById('kair-mp-priorizacion-content');
  if (container) _render(container);
}

function _bindEvents(container) {
  container.addEventListener('click', function (e) {
    var header = e.target.closest('.kair-mp-prior__group-header');
    if (header) {
      var group = header.closest('.kair-mp-prior__group');
      if (group) {
        var nivel = group.getAttribute('data-nivel');
        _collapsedGroups[nivel] = !_collapsedGroups[nivel];
        group.classList.toggle('kair-mp-prior__group--collapsed');
      }
      return;
    }

    var th = e.target.closest('.kair-mp-prior__th');
    if (th) {
      _handleSort(e);
      return;
    }
  });
}

function _reload() {
  if (!_companyName) return;
  var self = this;
  var container = document.getElementById('kair-mp-priorizacion-content');
  if (!container) return;

  var priorPromise = IdentificacionPeligrosService.priorizacion(_companyName);
  var statsPromise = IdentificacionPeligrosService.stats(_companyName);

  Promise.all([priorPromise, statsPromise]).then(function (results) {
    var priorResult = results[0];
    var statsResult = results[1];

    if (priorResult && priorResult.success && priorResult.data) {
      _grupos = priorResult.data;
    }
    if (statsResult && statsResult.success && statsResult.data) {
      _stats = statsResult.data;
    }
    _render(container);
  }).catch(function () {
    container.innerHTML = '<div class="kair-mp-prior__empty"><i class="bi bi-x-circle"></i><h3>Error al cargar</h3></div>';
  });
}

var PriorizacionView = {
  load: function (companyName) {
    _companyName = companyName;
    _collapsedGroups = {};
    _sortCol = 'nr';
    _sortDir = 'desc';

    var container = document.getElementById('kair-mp-priorizacion-content');
    if (!container) return;
    container.innerHTML = '<div class="kair-mp-loading"><div class="kair-mp-spinner"></div><p>Cargando priorización...</p></div>';

    var priorPromise = IdentificacionPeligrosService.priorizacion(companyName);
    var statsPromise = IdentificacionPeligrosService.stats(companyName);

    Promise.all([priorPromise, statsPromise]).then(function (results) {
      var priorResult = results[0];
      var statsResult = results[1];

      if (priorResult && priorResult.success && priorResult.data) {
        _grupos = priorResult.data;
      }
      if (statsResult && statsResult.success && statsResult.data) {
        _stats = statsResult.data;
      }
      _render(container);
    }).catch(function () {
      container.innerHTML = '<div class="kair-mp-prior__empty"><i class="bi bi-x-circle"></i><h3>Error al cargar</h3></div>';
    });
  },

  destroy: function () {
    _grupos = null;
    _stats = null;
    _companyName = null;
    _collapsedGroups = {};
  },

  refresh: function () {
    if (_companyName) _reload();
  }
};

window.PriorizacionView = PriorizacionView;
})();
