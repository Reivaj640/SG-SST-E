/**
 * =====================================================================
 * SUBMÓDULO 6.1.3 — Vista: DESPLIEGUE ESTRATÉGICO (G-FO-001) · Premium v2
 * Header v2 · 4 metric cards · Tabla blindada · IPC real · tok()/palette()
 * =====================================================================
 */

var DespliegueEstrategicoView = (function() {
  'use strict';

  /* ── SVGs inline (sin Bootstrap Icons en header/cards) ── */
  var SVG = {
    bullseye:  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    check:     '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 12 15 17 10"/></svg>',
    alert:     '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    xOctagon:  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    arrowLeft: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    refresh:   '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    search:    '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    info:      '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    trendUp:   '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 15 12 9 18 15"/></svg>',
    trendDown: '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    trendFlat: '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>'
  };

  /* ── Helpers premium (mismo patrón que Frecuencia/Severidad) ── */
  function tok(name, fallback) {
    var host = document.querySelector('.kair-rad-view-despliegue') || document.documentElement;
    var val = getComputedStyle(host).getPropertyValue(name).trim();
    return val || (fallback || '');
  }
  function palette() {
    return {
      bg:      tok('--rad-desp-canvas',  '#fbfcfb'),
      card:    tok('--rad-desp-card',    '#ffffff'),
      primary: tok('--rad-desp-primary', '#2057b8'),
      ink:     tok('--rad-desp-ink',     '#14213d'),
      muted:   tok('--rad-desp-muted',   '#748096'),
      border:  tok('--rad-desp-border',  '#e8ebee'),
      success: tok('--rad-desp-success', '#1bb888'),
      warning: tok('--rad-desp-warning', '#e7a224'),
      danger:  tok('--rad-desp-danger',  '#da5563'),
      info:    tok('--rad-desp-info',    '#0ea5b7')
    };
  }

  function _esc(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  /* Mock fallback (cuando IPC no está disponible) */
  var INDICADORES_MOCK = [
    { id: 'IND-001', politica: 'Política Integral SST', objetivo: 'Mantener una reducción del 10% de los eventos con lesión con respecto al año anterior', indicador: 'Frecuencia de accidentalidad', formula: '(N° de casos de accidentes mes / Total de trabajadores del mes) × 100', meta: '< 1', ultimoValor: '0.7 %', tendencia: 'down', frecuencia: 'Mensual', responsable: 'Coordinador SST', estado: 'Cumple' },
    { id: 'IND-002', politica: 'Política Integral SST', objetivo: 'Mantener una reducción del 10% de los eventos con lesión con respecto al año anterior', indicador: 'Severidad de accidentalidad', formula: '((N° de días de incapacidad por accidente de trabajo en el mes × N° de días cargados en el mes) / Total de trabajadores del mes) × 100', meta: '< 1', ultimoValor: '0.4 %', tendencia: 'flat', frecuencia: 'Mensual', responsable: 'Coordinador SST', estado: 'Cumple' },
    { id: 'IND-003', politica: 'Política Integral SST', objetivo: 'Mantener una reducción del 10% de los eventos con lesión con respecto al año anterior', indicador: 'Proporción de accidentes mortales', formula: '(N° de accidentes de trabajo mortales del año / Total de trabajo del año) × 100', meta: '0.0', ultimoValor: '0 %', tendencia: 'flat', frecuencia: 'Anual', responsable: 'Coordinador SST', estado: 'Cumple' },
    { id: 'IND-004', politica: 'Política Integral SST', objetivo: 'Mantener una reducción del 10% de los eventos con lesión con respecto al año anterior', indicador: 'Incidencia de Enfermedad Laboral', formula: '(N° de casos nuevos de enfermedad laboral en el periodo Z / Promedio de trabajadores en el periodo Z) × 100.000', meta: '0.0', ultimoValor: '0 casos/100k', tendencia: 'flat', frecuencia: 'Anual', responsable: 'Coordinador SST', estado: 'Cumple' },
    { id: 'IND-005', politica: 'Política Integral SST', objetivo: 'Mantener una reducción del 10% de los eventos con lesión con respecto al año anterior', indicador: 'Ausentismo por causa médica', formula: '(N° de días de ausencia por incapacidad laboral o común en el mes / N° de días de trabajo programados en el mes) × 100', meta: '< 50', ultimoValor: '32 %', tendencia: 'down', frecuencia: 'Mensual', responsable: 'Coordinador SST', estado: 'Cumple' },
    { id: 'IND-006', politica: 'Cumplir con los requisitos legales y otros', objetivo: 'Cumplir con los requisitos legales aplicables', indicador: 'Cumplimiento de la matriz legal - Grado de avance', formula: '(N° de requisitos cumplidos / N° de requisitos aplicables) × 100', meta: '≥ 0.8', ultimoValor: '85 %', tendencia: 'up', frecuencia: 'Bimensual', responsable: 'Coordinador SST', estado: 'Cumple' },
    { id: 'IND-007', politica: 'Lograr la satisfacción del cliente', objetivo: 'Lograr la satisfacción del cliente', indicador: 'Encuesta de satisfacción', formula: '(N° de encuestas satisfactorias / N° total de encuestas realizadas) × 100', meta: '≥ 0.9', ultimoValor: '88 %', tendencia: 'up', frecuencia: 'Semestral', responsable: 'Coordinador SST', estado: 'Parcial' },
    { id: 'IND-008', politica: 'Lograr la satisfacción del cliente', objetivo: 'Lograr la satisfacción del cliente', indicador: 'Cierre de Quejas y Reclamos', formula: '(N° de Quejas y reclamos cerrados / N° de Quejas y reclamos reportados) × 100', meta: '≥ 0.8', ultimoValor: '75 %', tendencia: 'flat', frecuencia: 'Mensual', responsable: 'Coordinadora de Recursos Humanos', estado: 'Parcial' },
    { id: 'IND-009', politica: 'Mantener ambientes de trabajo sanos y seguros', objetivo: 'Mantener ambientes de trabajo sanos y seguros', indicador: 'Cumplimiento del cronograma del Sistema Integrado de Gestión', formula: '(Actividades ejecutadas / Actividades programadas) × 100', meta: '≥ 0.85', ultimoValor: '79 %', tendencia: 'up', frecuencia: 'Mensual', responsable: 'Coordinador SST', estado: 'No cumple' }
  ];

  /* ── Carga de indicadores (IPC real → fallback mock) ── */
  function _loadIndicadores(ctx, callback) {
    var ctxEmpresa = (ctx && ctx.empresa) || (ctx && ctx.state && ctx.state.empresa) || window.currentCompany || '';
    if (window.electronAPI && window.electronAPI.revisionAltaDireccion && typeof window.electronAPI.revisionAltaDireccion.listarIndicadores === 'function') {
      window.electronAPI.revisionAltaDireccion.listarIndicadores(ctxEmpresa).then(function(res) {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          callback(res.data);
        } else {
          callback(INDICADORES_MOCK);
        }
      }).catch(function() { callback(INDICADORES_MOCK); });
    } else {
      callback(INDICADORES_MOCK);
    }
  }

  function render(ctx) {
    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-view-despliegue';
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:14px;min-height:0;';

    /* ── Header v2 (badge-ico + título + subtítulo + Volver/Refrescar) ── */
    var header = document.createElement('header');
    header.className = 'kair-rad-despliegue-header';
    header.innerHTML =
      '<div class="kair-badge-ico">' + SVG.bullseye + '</div>' +
      '<div class="kair-titles">' +
        '<h1 class="kair-title">Despliegue Estratégico</h1>' +
        '<p class="kair-sub">G-FO-001 · Objetivos, indicadores y metas del SG-SST</p>' +
      '</div>' +
      '<div class="kair-actions">' +
        '<button class="kair-btn kair-btn-ghost" id="kair-rad-desp-btn-back" type="button">' + SVG.arrowLeft + ' Volver</button>' +
        '<button class="kair-btn kair-btn-outline" id="kair-rad-desp-btn-sync" type="button">' + SVG.refresh + ' Refrescar</button>' +
      '</div>';
    wrap.appendChild(header);

    var btnBack = header.querySelector('#kair-rad-desp-btn-back');
    if (btnBack) {
      btnBack.addEventListener('click', function() {
        if (ctx && typeof ctx.navigate === 'function') ctx.navigate('hub');
      });
    }
    var btnSync = header.querySelector('#kair-rad-desp-btn-sync');
    if (btnSync) {
      btnSync.addEventListener('click', function() {
        if (ctx && typeof ctx.refresh === 'function') ctx.refresh();
      });
    }

    /* ── Contenedor principal (carga async) ── */
    var main = document.createElement('div');
    main.className = 'kair-rad-despliegue-main';
    main.innerHTML = '<div class="kair-rad-despliegue-loading">' + SVG.refresh + ' <span>Cargando indicadores…</span></div>';
    wrap.appendChild(main);

    /* ── Cargar datos + renderizar ── */
    _loadIndicadores(ctx, function(indicadores) {
      main.innerHTML = '';

      /* 4 metric cards premium */
      var total = indicadores.length;
      var cumple = indicadores.filter(function(i) { return i.estado === 'Cumple'; }).length;
      var parcial = indicadores.filter(function(i) { return i.estado === 'Parcial'; }).length;
      var noCumple = indicadores.filter(function(i) { return i.estado === 'No cumple'; }).length;
      var sinMedicion = indicadores.filter(function(i) { return i.estado === 'Sin medición'; }).length;

      var metrics = [
        { id: 'kair-rad-desp-m-total',   tone: 'blue',  icon: SVG.bullseye,  value: String(total),     label: 'Total indicadores', sub: sinMedicion > 0 ? sinMedicion + ' sin medición' : 'del despliegue estratégico' },
        { id: 'kair-rad-desp-m-cumple',  tone: 'green', icon: SVG.check,     value: String(cumple),    label: 'Cumplen',          sub: cumple > 0 ? 'En meta' : 'Sin indicadores en meta' },
        { id: 'kair-rad-desp-m-parcial', tone: 'amber', icon: SVG.alert,     value: String(parcial),   label: 'Parcial',          sub: parcial > 0 ? 'Requieren atención' : 'Sin indicadores parciales' },
        { id: 'kair-rad-desp-m-nocumple',tone: 'red',   icon: SVG.xOctagon,  value: String(noCumple),  label: 'No cumplen',       sub: noCumple > 0 ? 'Críticos' : 'Sin indicadores críticos' }
      ];

      var strip = document.createElement('div');
      strip.className = 'kair-metric-strip';
      metrics.forEach(function(m) {
        var card = document.createElement('div');
        card.className = 'kair-metric-card';
        card.innerHTML =
          '<div class="kair-metric-card__icon kair-metric-card__icon--' + m.tone + '">' + m.icon + '</div>' +
          '<div class="kair-metric-card__body">' +
            '<div class="kair-metric-card__value" id="' + m.id + '">' + _esc(m.value) + '</div>' +
            '<div class="kair-metric-card__label">' + _esc(m.label) + '</div>' +
            '<div class="kair-metric-card__sub">' + _esc(m.sub) + '</div>' +
          '</div>';
        strip.appendChild(card);
      });
      main.appendChild(strip);

      /* Search + filters */
      var viewState = (ctx.state && ctx.state.despliegue) || { filter: 'todos', search: '' };
      var searchRow = document.createElement('div');
      searchRow.className = 'kair-rad-search-row';
      searchRow.innerHTML =
        '<div class="kair-rad-search">' +
          SVG.search +
          '<input type="text" id="kair-rad-despliegue-search" placeholder="Buscar por objetivo, indicador, responsable…" value="' + _esc(viewState.search || '') + '">' +
        '</div>' +
        '<div class="kair-rad-filter-chips">' +
          _filterChip('todos', 'Todos', viewState.filter) +
          _filterChip('Cumple', 'Cumple', viewState.filter) +
          _filterChip('Parcial', 'Parcial', viewState.filter) +
          _filterChip('No cumple', 'No cumple', viewState.filter) +
          _filterChip('Sin medición', 'Sin medición', viewState.filter) +
        '</div>';
      main.appendChild(searchRow);

      /* Tabla blindada */
      var tableCard = document.createElement('div');
      tableCard.className = 'kair-rad-table-card';
      tableCard.id = 'kair-rad-despliegue-table-card';
      main.appendChild(tableCard);

      var filtered = _applyFilters(indicadores, viewState);
      _renderTable(tableCard, filtered);

      /* Bind search & filters */
      var searchInput = searchRow.querySelector('#kair-rad-despliegue-search');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          viewState.search = searchInput.value;
          if (ctx.state) ctx.state.despliegue = viewState;
          _renderTable(tableCard, _applyFilters(indicadores, viewState));
        });
      }
      searchRow.querySelectorAll('[data-filter]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          viewState.filter = btn.getAttribute('data-filter');
          if (ctx.state) ctx.state.despliegue = viewState;
          _renderTable(tableCard, _applyFilters(indicadores, viewState));
          searchRow.querySelectorAll('[data-filter]').forEach(function(b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
        });
      });

      /* Footer */
      var footer = document.createElement('div');
      footer.className = 'kair-rad-despliegue-footer';
      footer.innerHTML = SVG.info + ' <span>Fuente de verdad: formato <strong>G-FO-001 Despliegue Estratégico · Rev. 01 Nov 2016</strong>. Las fórmulas, metas y responsables se preservan idénticos al Excel original.</span>';
      main.appendChild(footer);
    });

    return wrap;
  }

  function _buildMetricStrip(indicadores) {
    var total = indicadores.length;
    var cumple = indicadores.filter(function(i) { return i.estado === 'Cumple'; }).length;
    var parcial = indicadores.filter(function(i) { return i.estado === 'Parcial'; }).length;
    var noCumple = indicadores.filter(function(i) { return i.estado === 'No cumple'; }).length;
    var sinMedicion = indicadores.filter(function(i) { return i.estado === 'Sin medición'; }).length;
    var metrics = [
      { id: 'kair-rad-desp-m-total',   tone: 'blue',  icon: SVG.bullseye,  value: String(total),     label: 'Total indicadores', sub: sinMedicion > 0 ? sinMedicion + ' sin medición' : 'del despliegue estratégico' },
      { id: 'kair-rad-desp-m-cumple',  tone: 'green', icon: SVG.check,     value: String(cumple),    label: 'Cumplen',          sub: cumple > 0 ? 'En meta' : 'Sin indicadores en meta' },
      { id: 'kair-rad-desp-m-parcial', tone: 'amber', icon: SVG.alert,     value: String(parcial),   label: 'Parcial',          sub: parcial > 0 ? 'Requieren atención' : 'Sin indicadores parciales' },
      { id: 'kair-rad-desp-m-nocumple',tone: 'red',   icon: SVG.xOctagon,  value: String(noCumple),  label: 'No cumplen',       sub: noCumple > 0 ? 'Críticos' : 'Sin indicadores críticos' }
    ];
    var strip = document.createElement('div');
    strip.className = 'kair-metric-strip';
    metrics.forEach(function(m) {
      var card = document.createElement('div');
      card.className = 'kair-metric-card';
      card.innerHTML =
        '<div class="kair-metric-card__icon kair-metric-card__icon--' + m.tone + '">' + m.icon + '</div>' +
        '<div class="kair-metric-card__body">' +
          '<div class="kair-metric-card__value">' + _esc(m.value) + '</div>' +
          '<div class="kair-metric-card__label">' + _esc(m.label) + '</div>' +
          '<div class="kair-metric-card__sub">' + _esc(m.sub) + '</div>' +
        '</div>';
      strip.appendChild(card);
    });
    return strip;
  }

  function _buildSearchRow(indicadores, viewState, tableCard) {
    var searchRow = document.createElement('div');
    searchRow.className = 'kair-rad-search-row';
    searchRow.innerHTML =
      '<div class="kair-rad-search">' +
        SVG.search +
        '<input type="text" id="kair-rad-despliegue-search" placeholder="Buscar…" value="' + _esc(viewState.search || '') + '">' +
      '</div>' +
      '<div class="kair-rad-filter-chips">' +
        _filterChip('todos', 'Todos', viewState.filter) +
        _filterChip('Cumple', 'Cumple', viewState.filter) +
        _filterChip('Parcial', 'Parcial', viewState.filter) +
        _filterChip('No cumple', 'No cumple', viewState.filter) +
        _filterChip('Sin medición', 'Sin medición', viewState.filter) +
      '</div>';
    setTimeout(function() {
      var searchInput = searchRow.querySelector('#kair-rad-despliegue-search');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          viewState.search = searchInput.value;
          _renderTable(tableCard, _applyFilters(indicadores, viewState));
        });
      }
      searchRow.querySelectorAll('[data-filter]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          viewState.filter = btn.getAttribute('data-filter');
          _renderTable(tableCard, _applyFilters(indicadores, viewState));
          searchRow.querySelectorAll('[data-filter]').forEach(function(b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
        });
      });
    }, 0);
    return searchRow;
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
          '<div class="kair-rad-state__icon kair-rad-state__icon--muted">' + SVG.bullseye + '</div>' +
          '<h3 class="kair-rad-state__title">Sin indicadores</h3>' +
          '<p class="kair-rad-state__desc">No hay indicadores que coincidan con el filtro o búsqueda activos.</p>' +
        '</div>';
      return;
    }

    var p = palette();
    var html = '<div class="kair-rad-table-wrap"><table class="kair-rad-table"><thead><tr>' +
      '<th>Objetivo estratégico</th>' +
      '<th>Indicador</th>' +
      '<th>Fórmula</th>' +
      '<th>Meta</th>' +
      '<th>Último valor</th>' +
      '<th>Frecuencia</th>' +
      '<th>Responsable</th>' +
      '<th>Estado</th>' +
      '<th>Acciones</th>' +
    '</tr></thead><tbody>';

    rows.forEach(function(i) {
      var estadoCls = i.estado === 'Cumple' ? 'success'
        : i.estado === 'Parcial' ? 'warning'
        : i.estado === 'Sin medición' ? 'info'
        : 'danger';
      var trendIcon = i.ultimoValor === '—' || !i.ultimoValor ? '' :
                       i.tendencia === 'up' ? SVG.trendUp :
                       i.tendencia === 'down' ? SVG.trendDown :
                       SVG.trendFlat;
      var trendColor = i.tendencia === 'up' || i.tendencia === 'down' ? p.success : p.muted;

      html += '<tr>' +
        '<td>' + _esc(i.objetivo) + '</td>' +
        '<td><strong>' + _esc(i.indicador) + '</strong></td>' +
        '<td class="kair-rad-table__td--muted">' + _esc(i.formula) + '</td>' +
        '<td><span class="kair-rad-pill kair-rad-pill--neutral">' + _esc(i.meta) + '</span></td>' +
        '<td><span class="kair-rad-table__val">' + _esc(i.ultimoValor) + '</span> <span style="color:' + trendColor + '">' + trendIcon + '</span></td>' +
        '<td><span class="kair-rad-pill kair-rad-pill--info">' + _esc(i.frecuencia) + '</span></td>' +
        '<td class="kair-rad-table__td--muted">' + _esc(i.responsable) + '</td>' +
        '<td><span class="kair-rad-badge kair-rad-badge--' + estadoCls + '"><span class="dot"></span>' + _esc(i.estado) + '</span></td>' +
        '<td><div class="cell-actions">' +
          '<button class="kair-rad-icon-btn" title="Editar" data-indicador="' + _esc(i.id) + '">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>' +
          '</button>' +
        '</div></td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';
    card.innerHTML = html;
  }

  function _filterChip(value, label, current) {
    var active = value === current;
    return '<button class="kair-rad-filter-chip' + (active ? ' is-active' : '') + '" data-filter="' + _esc(value) + '">' + _esc(label) + '</button>';
  }

  return { render: render };
})();

window.DespliegueEstrategicoView = DespliegueEstrategicoView;
