/**
 * =====================================================================
 * SUBMÓDULO 6.1.3 — Vista: DESPLIEGUE ESTRATÉGICO (G-FO-001)
 * Tabla de indicadores estratégicos con fórmulas, metas, tendencias
 * =====================================================================
 */

var DespliegueEstrategicoView = (function() {
  'use strict';

  function _esc(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  /* Mock: 9 indicadores estratégicos (basados en formato G-FO-001) */
  var INDICADORES_MOCK = [
    {
      id: 'IND-001',
      politica: 'Política Integral SST',
      objetivo: 'Mantener una reducción del 10% de los eventos con lesión con respecto al año anterior',
      indicador: 'Frecuencia de accidentalidad',
      formula: '(N° de casos de accidentes mes / Total de trabajadores del mes) × 100',
      meta: '< 1',
      ultimoValor: '0.7 %',
      tendencia: 'down',
      frecuencia: 'Mensual',
      responsable: 'Coordinador SST',
      estado: 'Cumple'
    },
    {
      id: 'IND-002',
      politica: 'Política Integral SST',
      objetivo: 'Mantener una reducción del 10% de los eventos con lesión con respecto al año anterior',
      indicador: 'Severidad de accidentalidad',
      formula: '((N° de días de incapacidad por accidente de trabajo en el mes × N° de días cargados en el mes) / Total de trabajadores del mes) × 100',
      meta: '< 1',
      ultimoValor: '0.4 %',
      tendencia: 'flat',
      frecuencia: 'Mensual',
      responsable: 'Coordinador SST',
      estado: 'Cumple'
    },
    {
      id: 'IND-003',
      politica: 'Política Integral SST',
      objetivo: 'Mantener una reducción del 10% de los eventos con lesión con respecto al año anterior',
      indicador: 'Proporción de accidentes mortales',
      formula: '(N° de accidentes de trabajo mortales del año / Total de trabajo del año) × 100',
      meta: '0.0',
      ultimoValor: '0 %',
      tendencia: 'flat',
      frecuencia: 'Anual',
      responsable: 'Coordinador SST',
      estado: 'Cumple'
    },
    {
      id: 'IND-004',
      politica: 'Política Integral SST',
      objetivo: 'Mantener una reducción del 10% de los eventos con lesión con respecto al año anterior',
      indicador: 'Incidencia de Enfermedad Laboral',
      formula: '(N° de casos nuevos de enfermedad laboral en el periodo Z / Promedio de trabajadores en el periodo Z) × 100.000',
      meta: '0.0',
      ultimoValor: '0 casos/100k',
      tendencia: 'flat',
      frecuencia: 'Anual',
      responsable: 'Coordinador SST',
      estado: 'Cumple'
    },
    {
      id: 'IND-005',
      politica: 'Política Integral SST',
      objetivo: 'Mantener una reducción del 10% de los eventos con lesión con respecto al año anterior',
      indicador: 'Ausentismo por causa médica',
      formula: '(N° de días de ausencia por incapacidad laboral o común en el mes / N° de días de trabajo programados en el mes) × 100',
      meta: '< 50',
      ultimoValor: '32 %',
      tendencia: 'down',
      frecuencia: 'Mensual',
      responsable: 'Coordinador SST',
      estado: 'Cumple'
    },
    {
      id: 'IND-006',
      politica: 'Cumplir con los requisitos legales y otros',
      objetivo: 'Cumplir con los requisitos legales aplicables',
      indicador: 'Cumplimiento de la matriz legal - Grado de avance',
      formula: '(N° de requisitos cumplidos / N° de requisitos aplicables) × 100',
      meta: '≥ 0.8',
      ultimoValor: '85 %',
      tendencia: 'up',
      frecuencia: 'Bimensual',
      responsable: 'Coordinador SST',
      estado: 'Cumple'
    },
    {
      id: 'IND-007',
      politica: 'Lograr la satisfacción del cliente',
      objetivo: 'Lograr la satisfacción del cliente',
      indicador: 'Encuesta de satisfacción',
      formula: '(N° de encuestas satisfactorias / N° total de encuestas realizadas) × 100',
      meta: '≥ 0.9',
      ultimoValor: '88 %',
      tendencia: 'up',
      frecuencia: 'Semestral',
      responsable: 'Coordinador SST',
      estado: 'Parcial'
    },
    {
      id: 'IND-008',
      politica: 'Lograr la satisfacción del cliente',
      objetivo: 'Lograr la satisfacción del cliente',
      indicador: 'Cierre de Quejas y Reclamos',
      formula: '(N° de Quejas y reclamos cerrados / N° de Quejas y reclamos reportados) × 100',
      meta: '≥ 0.8',
      ultimoValor: '75 %',
      tendencia: 'flat',
      frecuencia: 'Mensual',
      responsable: 'Coordinadora de Recursos Humanos',
      estado: 'Parcial'
    },
    {
      id: 'IND-009',
      politica: 'Mantener ambientes de trabajo sanos y seguros',
      objetivo: 'Mantener ambientes de trabajo sanos y seguros',
      indicador: 'Cumplimiento del cronograma del Sistema Integrado de Gestión',
      formula: '(Actividades ejecutadas / Actividades programadas) × 100',
      meta: '≥ 0.85',
      ultimoValor: '79 %',
      tendencia: 'up',
      frecuencia: 'Mensual',
      responsable: 'Coordinador SST',
      estado: 'No cumple'
    }
  ];

  function render(ctx) {
    var indicadores = (ctx.data.indicadores && ctx.data.indicadores.length > 0) ? ctx.data.indicadores : INDICADORES_MOCK;

    var viewState = ctx.state.despliegue || { filter: 'todos', search: '' };

    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-view-despliegue';

    /* KPIs · mismo patrón visual que el HUB de 6.1.3 (kair-rad-kpi-strip).
       4 tarjetas: Total | Cumplen | Parcial | No cumplen.
       Cada una con icono en círculo de color, valor grande, label uppercase,
       y sub-línea con ícono contextual (check, alerta, reloj). */
    var total = indicadores.length;
    var cumple = indicadores.filter(function(i) { return i.estado === 'Cumple'; }).length;
    var parcial = indicadores.filter(function(i) { return i.estado === 'Parcial'; }).length;
    var noCumple = indicadores.filter(function(i) { return i.estado === 'No cumple'; }).length;
    var sinMedicion = indicadores.filter(function(i) { return i.estado === 'Sin medición'; }).length;

    var kpis = [
      {
        value: String(total),
        label: 'Total indicadores',
        icon: 'bi-bullseye',
        color: 'primary',
        sub: sinMedicion > 0
          ? sinMedicion + ' sin medición registrada'
          : 'del despliegue estratégico',
        subClass: sinMedicion > 0 ? '' : ''
      },
      {
        value: String(cumple),
        label: 'Cumplen',
        icon: 'bi-check2-circle',
        color: 'success',
        sub: cumple > 0
          ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> En meta'
          : 'Sin indicadores en meta',
        subClass: cumple > 0 ? 'kair-rad-kpi__sub--success' : ''
      },
      {
        value: String(parcial),
        label: 'Parcial',
        icon: 'bi-exclamation-circle',
        color: 'warning',
        sub: parcial > 0
          ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Requieren atención'
          : 'Sin indicadores parciales',
        subClass: parcial > 0 ? 'kair-rad-kpi__sub--warning' : ''
      },
      {
        value: String(noCumple),
        label: 'No cumplen',
        icon: 'bi-x-octagon',
        color: 'danger',
        sub: noCumple > 0
          ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Críticos'
          : 'Sin indicadores críticos',
        subClass: noCumple > 0 ? 'kair-rad-kpi__sub--danger' : ''
      }
    ];

    var kpiStrip = document.createElement('div');
    kpiStrip.className = 'kair-rad-kpi-strip kair-rad-kpi-strip--flush';

    kpis.forEach(function(kpi) {
      var item = document.createElement('div');
      item.className = 'kair-rad-kpi';
      item.innerHTML =
        '<div class="kair-rad-kpi__icon kair-rad-kpi__icon--' + kpi.color + '">' +
          '<i class="bi ' + kpi.icon + '" style="font-size:1.125rem"></i>' +
        '</div>' +
        '<div class="kair-rad-kpi__content">' +
          '<div class="kair-rad-kpi__value">' + _esc(kpi.value) + '</div>' +
          '<div class="kair-rad-kpi__label">' + _esc(kpi.label) + '</div>' +
          '<div class="kair-rad-kpi__sub ' + (kpi.subClass || '') + '">' + kpi.sub + '</div>' +
        '</div>';
      kpiStrip.appendChild(item);
    });
    wrap.appendChild(kpiStrip);

    /* Search + filter row */
    var searchRow = document.createElement('div');
    searchRow.className = 'kair-rad-search-row';
    searchRow.innerHTML =
      '<div class="kair-rad-search">' +
        '<i class="bi bi-search kair-rad-search__icon"></i>' +
        '<input type="text" id="kair-rad-despliegue-search" placeholder="Buscar por objetivo, indicador, responsable…" value="' + _esc(viewState.search || '') + '">' +
      '</div>' +
      '<div class="kair-rad-filter-chips">' +
        _filterChip('todos', 'Todos', viewState.filter) +
        _filterChip('Cumple', 'Cumple', viewState.filter) +
        _filterChip('Parcial', 'Parcial', viewState.filter) +
        _filterChip('No cumple', 'No cumple', viewState.filter) +
        _filterChip('Sin medición', 'Sin medición', viewState.filter) +
      '</div>';
    wrap.appendChild(searchRow);

    /* Tabla 10 columnas */
    var tableCard = document.createElement('div');
    tableCard.className = 'kair-rad-table-card';
    tableCard.style.marginTop = 'var(--rad-s4)';
    tableCard.id = 'kair-rad-despliegue-table-card';
    wrap.appendChild(tableCard);

    var filtered = _applyFilters(indicadores, viewState);
    _renderTable(tableCard, filtered);

    /* Bind search & filters */
    setTimeout(function() {
      var searchInput = document.getElementById('kair-rad-despliegue-search');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          viewState.search = searchInput.value;
          ctx.state.despliegue = viewState;
          var f = _applyFilters(indicadores, viewState);
          _renderTable(tableCard, f);
        });
      }
      wrap.querySelectorAll('[data-filter]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          viewState.filter = btn.getAttribute('data-filter');
          ctx.state.despliegue = viewState;
          var f = _applyFilters(indicadores, viewState);
          _renderTable(tableCard, f);
          /* Update active state */
          wrap.querySelectorAll('[data-filter]').forEach(function(b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
        });
      });
    }, 0);

    /* Footer info */
    var footer = document.createElement('div');
    footer.style.cssText = 'padding: var(--rad-s3) var(--rad-s6); font: var(--rad-caption); color: var(--rad-text-muted); text-align: center;';
    footer.innerHTML = '<i class="bi bi-info-circle"></i> Fuente de verdad: formato <strong>G-FO-001 Despliegue Estratégico · Rev. 01 Nov 2016</strong>. Las fórmulas, metas y responsables se preservan idénticos al Excel original.';
    wrap.appendChild(footer);

    return wrap;
  }

  function _applyFilters(rows, state) {
    var r = rows.slice();
    if (state.filter && state.filter !== 'todos') {
      r = r.filter(function(i) { return i.estado === state.filter; });
    }
    var s = (state.search || '').toLowerCase().trim();
    if (s) {
      r = r.filter(function(i) {
        return (i.objetivo || '').toLowerCase().indexOf(s) >= 0 ||
               (i.indicador || '').toLowerCase().indexOf(s) >= 0 ||
               (i.formula || '').toLowerCase().indexOf(s) >= 0 ||
               (i.responsable || '').toLowerCase().indexOf(s) >= 0;
      });
    }
    return r;
  }

  function _renderTable(card, rows) {
    if (rows.length === 0) {
      card.innerHTML =
        '<div class="kair-rad-state">' +
          '<div class="kair-rad-state__icon kair-rad-state__icon--muted">' +
            '<i class="bi bi-bullseye" style="font-size:1.5rem"></i>' +
          '</div>' +
          '<h3 class="kair-rad-state__title">Sin indicadores</h3>' +
          '<p class="kair-rad-state__desc">No hay indicadores que coincidan con el filtro o búsqueda activos.</p>' +
        '</div>';
      return;
    }

    var html = '<table class="kair-rad-table"><thead><tr>' +
      '<th>Objetivo estratégico</th>' +
      '<th>Indicador</th>' +
      '<th style="min-width: 180px">Fórmula</th>' +
      '<th>Meta</th>' +
      '<th>Último valor</th>' +
      '<th>Frecuencia</th>' +
      '<th>Responsable</th>' +
      '<th>Estado</th>' +
      '<th style="width: 100px; text-align: right">Acciones</th>' +
    '</tr></thead><tbody>';

    rows.forEach(function(i) {
      var estadoCls = i.estado === 'Cumple' ? 'success'
        : i.estado === 'Parcial' ? 'warning'
        : i.estado === 'Sin medición' ? 'info'
        : 'danger';
      var trendIcon = i.ultimoValor === '—' || !i.ultimoValor ? '' :
                       i.tendencia === 'up' ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: var(--rad-success)"><polyline points="6 15 12 9 18 15"/></svg>' :
                       i.tendencia === 'down' ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: var(--rad-success)"><polyline points="6 9 12 15 18 9"/></svg>' :
                       '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: var(--rad-text-muted)"><line x1="5" y1="12" x2="19" y2="12"/></svg>';

      html += '<tr>' +
        '<td style="font: var(--rad-body-sm)">' + _esc(i.objetivo) + '</td>' +
        '<td><strong>' + _esc(i.indicador) + '</strong></td>' +
        '<td style="font: var(--rad-caption); color: var(--rad-text-muted); white-space: normal; line-height: 1.4">' + _esc(i.formula) + '</td>' +
        '<td><span style="display:inline-block; padding:2px 8px; background: var(--rad-neutral-soft); border-radius: var(--rad-radius-pill); font: 500 0.75rem/1.3 var(--rad-font); color: var(--rad-text);">' + _esc(i.meta) + '</span></td>' +
        '<td><strong>' + _esc(i.ultimoValor) + '</strong> ' + trendIcon + '</td>' +
        '<td><span style="display:inline-block; padding:2px 8px; background: var(--rad-info-soft); color: var(--rad-info); border-radius: var(--rad-radius-pill); font: 500 0.6875rem/1.3 var(--rad-font);">' + _esc(i.frecuencia) + '</span></td>' +
        '<td style="font: var(--rad-body-sm); color: var(--rad-text-muted)">' + _esc(i.responsable) + '</td>' +
        '<td><span class="kair-rad-badge kair-rad-badge--' + estadoCls + '"><span class="dot"></span>' + _esc(i.estado) + '</span></td>' +
        '<td><div class="cell-actions">' +
          '<button class="kair-rad-icon-btn" title="Editar" data-indicador="' + _esc(i.id) + '"><i class="bi bi-pencil"></i></button>' +
        '</div></td>' +
      '</tr>';
    });

    html += '</tbody></table>';
    card.innerHTML = html;
  }

  function _filterChip(value, label, current) {
    var active = value === current;
    return '<button class="kair-rad-filter-chip' + (active ? ' is-active' : '') + '" data-filter="' + _esc(value) + '">' + _esc(label) + '</button>';
  }

  return { render: render };
})();

window.DespliegueEstrategicoView = DespliegueEstrategicoView;
