/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
header.js — Header estándar (UNA card: header + tabs)
Patrón: modules/recursos/capacitaciones/capacitaciones-view.html
- Fila 1: icono + título + subtítulo | empresa + Volver + acciones
- Fila 2: tabs dentro de la misma card (border-top)
========================================================================== */
(function (global) {
  'use strict';
  var KM = global.KM;

  var TABS = [
    { key: 'matriz',        label: 'Matriz de peligros',      icon: 'bi-table' },
    { key: 'indicadores',   label: 'KPIs e indicadores',      icon: 'bi-bar-chart' },
    { key: 'priorizacion',  label: 'Priorización de riesgos', icon: 'bi-exclamation-triangle' }
  ];

  var Header = {};

  /* Renderiza header estándar (UNA sola card con header + tabs) */
  Header.render = function (opts) {
    opts = opts || {};
    var currentView = opts.currentView || 'matriz';
    var company = opts.company || '';

    /* Fila 1: contenido principal (icono + título/subtítulo a la izquierda, acciones a la derecha) */
    var mainRow =
      '<div class="km-header-card__main">' +
        '<div class="km-header-card__title-block">' +
          '<i class="bi bi-shield-exclamation km-header-card__icon" aria-hidden="true"></i>' +
          '<div>' +
            '<h3 class="km-header-card__title">Identificación de Peligros</h3>' +
            '<p class="km-header-card__subtitle">Matriz de peligros, priorización e indicadores SG-SST.</p>' +
          '</div>' +
        '</div>' +
        '<div class="km-header-card__right">' +
          (company
            ? '<span class="km-header-card__company" title="Empresa activa"><i class="bi bi-building" style="font-size:0.875rem;"></i> ' + KM.esc(company) + '</span>'
            : '') +
          (company ? '<div class="km-header-card__divider" aria-hidden="true"></div>' : '') +
          '<button type="button" class="km-header-card__back" data-action="back" title="Volver al módulo" aria-label="Volver al módulo">' +
            '<i class="bi bi-arrow-left"></i> Volver' +
          '</button>' +
        '</div>' +
      '</div>';

    /* Fila 2: tabs dentro de la misma card (acciones inline en la derecha) */
    var isEditor = (currentView === 'editor');
    var editorMode = opts.editorMode || 'new';
    var editorPeligroId = opts.editorPeligroId || '';
    var tabsRow;
    if (isEditor) {
      var editorTitle = editorMode === 'edit' && editorPeligroId
        ? 'Editar peligro ' + editorPeligroId
        : 'Nuevo peligro';
      var editorSubtitle = 'Identificación, evaluación y medidas de intervención';
      /* En modo editor: header de editor con pill GI-FO-019 + título dinámico */
      mainRow =
        '<div class="km-header-card__main">' +
          '<div class="km-header-card__title-block">' +
            '<span class="kair-header__pill--section" style="margin-right:8px">GI-FO-019</span>' +
            '<div>' +
              '<h3 class="km-header-card__title">' + KM.esc(editorTitle) + '</h3>' +
              '<p class="km-header-card__subtitle">' + KM.esc(editorSubtitle) + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="km-header-card__right">' +
            (company
              ? '<span class="km-header-card__company" title="Empresa activa"><i class="bi bi-building" style="font-size:0.875rem;"></i> ' + KM.esc(company) + '</span>'
              : '') +
            (company ? '<div class="km-header-card__divider" aria-hidden="true"></div>' : '') +
            '<button type="button" class="km-header-card__back" data-action="back-to-matriz" title="Volver a la matriz" aria-label="Volver a la matriz">' +
              '<i class="bi bi-arrow-left"></i> Volver' +
            '</button>' +
          '</div>' +
        '</div>';

      tabsRow =
        '<div class="km-header-card__tabs km-header-card__tabs--editor" role="tablist">' +
          '<button type="button" class="km-btn km-btn--sm km-btn--ghost" data-action="back-to-matriz">' +
            '<i class="bi bi-arrow-left"></i> Volver a la matriz' +
          '</button>' +
          '<div class="km-header-tab-actions">' +
            '<button type="button" class="km-btn km-btn--sm km-btn--ghost" data-action="reset" title="Restablecer vista"><i class="bi bi-arrow-counterclockwise"></i></button>' +
          '</div>' +
        '</div>';
    } else {
      var tabsHtml = TABS.map(function (t) {
        var cls = 'km-header-tab' + (t.key === currentView ? ' km-header-tab--active' : '');
        return '<button type="button" class="' + cls + '" data-tab="' + t.key + '" role="tab"' +
          (t.key === currentView ? ' aria-selected="true"' : ' aria-selected="false"') + '>' +
          '<i class="bi ' + t.icon + '"></i> ' + KM.esc(t.label) +
          '</button>';
      }).join('');

      var actionsHtml = '';
      if (currentView === 'matriz') {
        /* Solo Nuevo peligro — Importar/Exportar Excel están en la toolbar de la vista */
        actionsHtml =
          '<button type="button" class="km-btn km-btn--sm km-btn--primary" data-action="new-peligro"><i class="bi bi-plus-circle"></i> Nuevo peligro</button>';
      }
      actionsHtml += '<button type="button" class="km-btn km-btn--sm km-btn--ghost" data-action="reset" title="Restablecer vista"><i class="bi bi-arrow-counterclockwise"></i></button>';

      tabsRow =
        '<div class="km-header-card__tabs" role="tablist">' +
          tabsHtml +
          '<div class="km-header-tab-actions">' + actionsHtml + '</div>' +
        '</div>';
    }

    return '<div class="km-header-card">' + mainRow + tabsRow + '</div>';
  };

  /* Bindear eventos */
  Header.bindEvents = function (container, handlers) {
    handlers = handlers || {};

    var back = container.querySelector('[data-action="back"]');
    if (back && handlers.onBack) back.addEventListener('click', handlers.onBack);

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

  /* Mantener compatibilidad: api interna usada por código legacy si existe */
  Header._viewLabel = function (key) {
    var map = { matriz: 'Vista matriz', indicadores: 'KPIs', priorizacion: 'Priorización' };
    return map[key] || 'Vista matriz';
  };

  global.KMHeader = Header;
})(window);