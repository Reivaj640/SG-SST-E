/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
header.js — Header estándar K+AIR (Header System v2)

Estructura (patrón premium de la app, ref. Perfil de Cargo y Profesiograma):
- Miga de pan:  Módulo › 4.1.2 › Sección actual
- Encabezado:   SIN tarjeta (transparente) — chip de icono (44x44) +
                título Manrope 800 + subtítulo (con código GI-FO-019)
- Barra de pestañas SEPARADA bajo el encabezado: icono SVG + label + badge
                | acciones (Nuevo peligro / restablecer)

Iconos: SVG inline estilo Lucide (sin dependencia de Bootstrap Icons en
el header; las vistas conservan sus `bi` propios).
========================================================================== */
(function (global) {
  'use strict';
  var KM = global.KM;

  var TABS = [
    { key: 'matriz',       label: 'Matriz de peligros',      icon: 'table',      badge: true  },
    { key: 'indicadores',  label: 'KPIs e indicadores',      icon: 'bar-chart',  badge: false },
    { key: 'priorizacion', label: 'Priorización de riesgos', icon: 'alert-tri',  badge: false }
  ];

  /* Iconos SVG inline (trazo 1.9, estilo Lucide) */
  var ICONS = {
    'shield-alert': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
    'table': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M9 10v10"/></svg>',
    'bar-chart': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
    'alert-tri': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    'plus-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>',
    'arrow-left': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
    'rotate-ccw': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
    'building': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>'
  };

  var Header = {};

  function esc(s) { return KM.esc(s); }

  /* Miga de pan: módulo › código › sección actual */
  function _breadcrumb(opts) {
    var moduleName = opts.moduleName || 'Gestión de Peligros y Riesgos';
    var code = opts.submoduleCode || '4.1.2';
    var current = opts.breadcrumbCurrent || _viewLabel(opts.currentView);
    return (
      '<nav class="km-header-card__breadcrumb" aria-label="Ruta">' +
        '<span class="km-bc-item">' + esc(moduleName) + '</span>' +
        '<span class="km-bc-sep" aria-hidden="true">›</span>' +
        '<span class="km-bc-item">' + esc(code) + '</span>' +
        '<span class="km-bc-sep" aria-hidden="true">›</span>' +
        '<span class="km-bc-current">' + esc(current) + '</span>' +
      '</nav>'
    );
  }

  /* Renderiza header estándar: card (miga + título) + barra de pestañas */
  Header.render = function (opts) {
    opts = opts || {};
    var currentView = opts.currentView || 'matriz';
    var isEditor = (currentView === 'editor');
    var editorMode = opts.editorMode || 'new';
    var editorPeligroId = opts.editorPeligroId || '';
    var counts = opts.counts || {};

    var titleBlock;
    if (isEditor) {
      var editorTitle = editorMode === 'edit' && editorPeligroId
        ? 'Editar peligro ' + editorPeligroId
        : 'Nuevo peligro';
      titleBlock =
        '<div class="km-header-card__title-block">' +
          '<span class="kair-header__pill--section">GI-FO-019</span>' +
          '<div class="km-header-card__titles">' +
            '<h3 class="km-header-card__title">' + esc(editorTitle) + '</h3>' +
            '<p class="km-header-card__subtitle">Identificación, evaluación y medidas de intervención</p>' +
          '</div>' +
        '</div>';
    } else {
      titleBlock =
        '<div class="km-header-card__title-block">' +
          '<span class="km-header-card__icon" aria-hidden="true">' + ICONS['shield-alert'] + '</span>' +
          '<div class="km-header-card__titles">' +
            '<h3 class="km-header-card__title">Identificación de Peligros</h3>' +
            '<p class="km-header-card__subtitle">Matriz de peligros, priorización e indicadores SG-SST (GI-FO-019).</p>' +
          '</div>' +
        '</div>';
    }

    /* Fila principal: SOLO icono + título/subtítulo. Estructura estándar del
       sistema (ref. Perfil de Cargo 3.1.3): encabezado transparente, sin
       tarjeta, sin chip de empresa y sin botón Volver — la navegación entre
       módulos la hace el marco general de la app. */
    var mainRow =
      '<div class="km-header-card__main">' +
        titleBlock +
      '</div>';

    /* Barra de pestañas SEPARADA (bajo la card) */
    var tabsRow;
    if (isEditor) {
      /* F24.1 — solo "Volver a la matriz" (acción explícita) + restablecer */
      tabsRow =
        '<div class="km-header-tabs km-header-tabs--editor" role="tablist">' +
          '<button type="button" class="km-btn km-btn--sm km-btn--ghost" data-action="back-to-matriz">' +
            '<span class="km-btn__icon" aria-hidden="true">' + ICONS['arrow-left'] + '</span> Volver a la matriz' +
          '</button>' +
          '<div class="km-header-tab-actions">' +
            '<button type="button" class="km-btn km-btn--sm km-btn--ghost km-btn--icon" data-action="reset" title="Restablecer vista"><span class="km-btn__icon" aria-hidden="true">' + ICONS['rotate-ccw'] + '</span></button>' +
          '</div>' +
        '</div>';
    } else {
      var tabsHtml = TABS.map(function (t) {
        var cls = 'km-header-tab' + (t.key === currentView ? ' km-header-tab--active' : '');
        var badge = (t.badge && counts[t.key] != null && counts[t.key] !== '')
          ? '<span class="km-header-tab__badge" data-tab-badge="' + t.key + '">' + esc(String(counts[t.key])) + '</span>'
          : (t.badge ? '<span class="km-header-tab__badge" data-tab-badge="' + t.key + '" hidden></span>' : '');
        return '<button type="button" class="' + cls + '" data-tab="' + t.key + '" role="tab"' +
          (t.key === currentView ? ' aria-selected="true"' : ' aria-selected="false"') + '>' +
          '<span class="km-header-tab__icon" aria-hidden="true">' + ICONS[t.icon] + '</span>' +
          '<span>' + esc(t.label) + '</span>' + badge +
        '</button>';
      }).join('');

      var actionsHtml = '';
      if (currentView === 'matriz') {
        actionsHtml =
          '<button type="button" class="km-btn km-btn--sm km-btn--primary" data-action="new-peligro"><span class="km-btn__icon" aria-hidden="true">' + ICONS['plus-circle'] + '</span> Nuevo peligro</button>';
      }
      actionsHtml += '<button type="button" class="km-btn km-btn--sm km-btn--ghost km-btn--icon" data-action="reset" title="Restablecer vista"><span class="km-btn__icon" aria-hidden="true">' + ICONS['rotate-ccw'] + '</span></button>';

      tabsRow =
        '<div class="km-header-tabs" role="tablist">' +
          tabsHtml +
          '<div class="km-header-tab-actions">' + actionsHtml + '</div>' +
        '</div>';
    }

    var cardClass = isEditor ? 'km-header-card km-header-card--editor' : 'km-header-card';
    return '<div class="' + cardClass + '">' + _breadcrumb(opts) + mainRow + '</div>' + tabsRow;
  };

  /* Actualiza el badge de una pestaña sin re-renderizar todo el header */
  Header.updateBadge = function (container, tabKey, value) {
    if (!container) return;
    var badge = container.querySelector('[data-tab-badge="' + tabKey + '"]');
    if (!badge) return;
    if (value == null || value === '') { badge.setAttribute('hidden', ''); return; }
    badge.textContent = String(value);
    badge.removeAttribute('hidden');
  };

  /* Bindear eventos (mismos data-action / data-tab que antes) */
  Header.bindEvents = function (container, handlers) {
    handlers = handlers || {};

    /* El botón "Volver" se retiró del encabezado (estructura Perfil de
       Cargo); el editor conserva "Volver a la matriz" en la barra de
       pestañas (data-action="back-to-matriz"). */
    var backToMatriz = container.querySelector('[data-action="back-to-matriz"]');
    if (backToMatriz && handlers.onBackToMatriz) backToMatriz.addEventListener('click', handlers.onBackToMatriz);

    var tabs = container.querySelectorAll('.km-header-tab[data-tab]');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        if (handlers.onView) handlers.onView(tab.getAttribute('data-tab'));
      });
    });

    ['new-peligro', 'reset'].forEach(function (a) {
      var btn = container.querySelector('[data-action="' + a + '"]');
      if (btn && handlers.onAction) btn.addEventListener('click', function () { handlers.onAction(a); });
    });
  };

  function _viewLabel(key) {
    var map = { matriz: 'Matriz de peligros', indicadores: 'KPIs e indicadores', priorizacion: 'Priorización de riesgos', editor: 'Editor' };
    return map[key] || 'Matriz de peligros';
  }

  Header._viewLabel = _viewLabel;

  global.KMHeader = Header;
})(window);
