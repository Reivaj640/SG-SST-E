/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Submódulo 6.1.1 — Definición de Indicadores
   Component Orchestrator — Tabs + KPI Strip + Header
   ═══════════════════════════════════════════════════════════════════ */

var VIEWS = [
  { key: 'resultado',  label: 'Resultado',  icon: 'bi-bullseye' },
  { key: 'estructura', label: 'Estructura', icon: 'bi-shield-check' },
  { key: 'proceso',    label: 'Proceso',    icon: 'bi-gear' }
];

function DefinicionIndicadoresComponent(container, currentCompany, moduleName, submoduleTitle, backToModuleCallback) {
  this.container = container;
  this.currentCompany = currentCompany || 'Empresa';
  this.moduleName = moduleName || 'Verificación';
  this.submoduleTitle = submoduleTitle || '6.1.1 Definición de Indicadores';
  this.backToModuleCallback = backToModuleCallback;
  this.currentView = 'resultado';
  this.cssLoaded = false;
}

// ── Load CSS ────────────────────────────────────────────────────
DefinicionIndicadoresComponent.prototype._loadCSS = function (callback) {
  var cssHref = 'modules/verificacion/definicion-indicadores/definicion-indicadores.css';
  var existingLink = document.querySelector('link[href="' + cssHref + '"]');
  if (existingLink || this.cssLoaded) {
    this.cssLoaded = true;
    callback();
    return;
  }
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssHref;
  link.onload = function () { this.cssLoaded = true; callback(); }.bind(this);
  link.onerror = function () { this.cssLoaded = true; callback(); }.bind(this);
  document.head.appendChild(link);
};

// ── Escape HTML ─────────────────────────────────────────────────
DefinicionIndicadoresComponent.prototype._esc = function (str) {
  var div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
};

// ── Render UI ───────────────────────────────────────────────────
DefinicionIndicadoresComponent.prototype._renderUI = function () {
  var self = this;
  var stats = IndicadoresService.getKpiStats();

  // Header card (Capacitaciones pattern — BEM kair-ind-*)
  var headerHtml =
    '<div class="k-section-card" id="kair-ind-header-card" style="padding:0; margin-bottom:1.5rem; flex-shrink:0; flex-grow:0;">' +
      '<div class="kair-ind-header-row">' +
        '<div class="kair-ind-header-left">' +
          '<i class="bi bi-graph-up kair-ind-header-icon"></i>' +
          '<div>' +
            '<h3 class="kair-ind-header-title">Definición de Indicadores</h3>' +
            '<p class="kair-ind-header-subtitle">Submódulo 6.1.1 — Gestión de indicadores del SG-SST</p>' +
          '</div>' +
        '</div>' +
        '<div class="kair-ind-header-actions">' +
          '<span class="kair-ind-header-company" id="kair-ind-header-company"><i class="bi bi-building"></i> <span id="header-company-text">' + this._esc(this.currentCompany) + '</span></span>' +
          '<div class="kair-ind-header-divider"></div>' +
          '<button class="header-back-btn" id="kair-ind-back"><i class="bi bi-arrow-left"></i> Volver</button>' +
          '<button class="header-action--ghost" id="kair-ind-export"><i class="bi bi-download"></i> Exportar</button>' +
        '</div>' +
      '</div>' +
      '<div class="kair-ind-tabs" id="kair-ind-tabs">';

  // Tabs (inside header card, Capacitaciones pattern)
  headerHtml += VIEWS.map(function (v) {
    return '<button class="kair-ind-tab' + (v.key === self.currentView ? ' kair-ind-tab--active' : '') +
      '" data-view="' + v.key + '">' +
      '<i class="bi ' + v.icon + '"></i> ' + v.label +
      '</button>';
  }).join('');

  headerHtml += '</div></div>';

  // KPI Strip
  var kpiColorMap = {
    total: { color: '#174ea6', bg: '#e8f0fe' },
    cumplidos: { color: '#28a745', bg: '#e8f5e9' },
    enProgreso: { color: '#174ea6', bg: '#e8f0fe' },
    pendientes: { color: '#ffc107', bg: '#fff8e1' },
    criticos: { color: '#dc3545', bg: '#fde8e8' },
    tasa: { color: stats.tasaCumplimiento >= 70 ? '#28a745' : stats.tasaCumplimiento >= 40 ? '#ffc107' : '#dc3545',
            bg: stats.tasaCumplimiento >= 70 ? '#e8f5e9' : stats.tasaCumplimiento >= 40 ? '#fff8e1' : '#fde8e8' }
  };

  var kpis = [
    { key: 'total', icon: 'bi-bar-chart', value: stats.total, label: 'Total Indicadores' },
    { key: 'cumplidos', icon: 'bi-check-circle', value: stats.cumplidos, label: 'Cumplidos' },
    { key: 'enProgreso', icon: 'bi-arrow-repeat', value: stats.enProgreso, label: 'En Progreso' },
    { key: 'pendientes', icon: 'bi-clock-history', value: stats.pendientes, label: 'Pendientes' },
    { key: 'criticos', icon: 'bi-exclamation-triangle', value: stats.criticos, label: 'Críticos' },
    { key: 'tasa', icon: 'bi-graph-up', value: stats.tasaCumplimiento + '%', label: 'Tasa Cumplimiento' }
  ];

  var kpiHtml = kpis.map(function (kpi, idx) {
    var c = kpiColorMap[kpi.key];
    var item = '<div class="kair-ind-kpi-item">' +
      '<div class="kair-ind-kpi-item__icon" style="background:' + c.bg + '">' +
        '<i class="bi ' + kpi.icon + '" style="color:' + c.color + ';font-size:1rem"></i>' +
      '</div>' +
      '<div class="kair-ind-kpi-item__content">' +
        '<span class="kair-ind-kpi-item__value" style="color:' + c.color + '">' + kpi.value + '</span>' +
        '<span class="kair-ind-kpi-item__label">' + kpi.label + '</span>' +
      '</div>' +
    '</div>';
    if (idx < kpis.length - 1) item += '<div class="kair-ind-kpi-divider"></div>';
    return item;
  }).join('');

  // Toolbar
  var toolbarHtml =
    '<div class="kair-ind-toolbar">' +
      '<div class="kair-ind-toolbar__search">' +
        '<i class="bi bi-search"></i>' +
        '<input type="text" id="kair-ind-search" placeholder="Buscar indicador por nombre, definición o responsable..." class="kair-ind-toolbar__input" />' +
        '<button class="kair-ind-toolbar__clear" id="kair-ind-search-clear" style="display:none"><i class="bi bi-x"></i></button>' +
      '</div>' +
    '</div>';

  // View containers
  var viewContainers = VIEWS.map(function (v) {
    return '<div class="kair-ind-view-container" id="kair-ind-view-' + v.key + '" style="' + (v.key === self.currentView ? '' : 'display:none') + '"></div>';
  }).join('');

  // Modal
  var modalHtml =
    '<div class="kair-ind-modal-overlay" id="kair-ind-modal">' +
      '<div class="kair-ind-modal">' +
        '<div class="kair-ind-modal__header">' +
          '<div class="kair-ind-modal__header-left">' +
            '<span class="kair-ind-type-badge" id="kair-ind-modal-type-badge"></span>' +
            '<h3 class="kair-ind-modal__title" id="kair-ind-modal-title">Detalle</h3>' +
          '</div>' +
          '<button class="kair-ind-modal__close" id="kair-ind-modal-close"><i class="bi bi-x-lg"></i></button>' +
        '</div>' +
        '<div class="kair-ind-modal__tabs">' +
          '<button class="kair-ind-modal__tab kair-ind-modal__tab--active" data-modal-tab="info"><i class="bi bi-info-circle"></i> Información</button>' +
          '<button class="kair-ind-modal__tab" data-modal-tab="data"><i class="bi bi-file-text"></i> Datos Mensuales</button>' +
          '<button class="kair-ind-modal__tab" data-modal-tab="chart"><i class="bi bi-bar-chart"></i> Tendencia</button>' +
        '</div>' +
        '<div class="kair-ind-modal__content" id="kair-ind-modal-content"></div>' +
        '<div class="kair-ind-modal__footer">' +
          '<button class="kair-ind-btn kair-ind-btn--ghost" id="kair-ind-modal-cancel">Cerrar</button>' +
          '<button class="kair-ind-btn kair-ind-btn--primary" id="kair-ind-modal-edit"><i class="bi bi-pencil"></i> Editar Indicador</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  // Toast container
  var toastHtml = '<div class="kair-ind-toast-container" id="kair-ind-toast-container"></div>';

  // Assemble
  this.container.innerHTML =
    '<div class="kair-ind-wrapper">' +
      headerHtml +
      '<main class="kair-ind-main">' +
        '<div class="kair-ind-kpi-strip" id="kair-ind-kpi-strip">' + kpiHtml + '</div>' +
        toolbarHtml +
        '<div class="kair-ind-card">' +
          '<div class="kair-ind-table-wrapper" id="kair-ind-table-area">' + viewContainers + '</div>' +
        '</div>' +
      '</main>' +
      modalHtml +
      toastHtml +
    '</div>';
};

// ── Init Navigation ─────────────────────────────────────────────
DefinicionIndicadoresComponent.prototype._initNavigation = function () {
  var self = this;
  var wrapper = this.container.querySelector('.kair-ind-wrapper');
  if (!wrapper) return;

  // Back button
  var backBtn = wrapper.querySelector('#kair-ind-back');
  if (backBtn) {
    backBtn.onclick = function () {
      if (typeof self.backToModuleCallback === 'function') self.backToModuleCallback();
    };
  }

  // Tab navigation
  var tabs = wrapper.querySelectorAll('.kair-ind-tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var viewKey = tab.getAttribute('data-view');
      if (viewKey) self._navigate(viewKey);
    });
  });

  // Search
  var searchInput = wrapper.querySelector('#kair-ind-search');
  var searchClear = wrapper.querySelector('#kair-ind-search-clear');
  if (searchInput) {
    var debounceTimer = null;
    searchInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        var q = searchInput.value;
        if (searchClear) searchClear.style.display = q ? 'flex' : 'none';
        self._propagateSearch(q);
      }, 250);
    });
  }
  if (searchClear) {
    searchClear.addEventListener('click', function () {
      if (searchInput) searchInput.value = '';
      searchClear.style.display = 'none';
      self._propagateSearch('');
    });
  }
};

// ── Navigate ────────────────────────────────────────────────────
DefinicionIndicadoresComponent.prototype._navigate = function (viewKey) {
  var self = this;
  this.currentView = viewKey;

  // Update tab active state
  var tabs = this.container.querySelectorAll('.kair-ind-tab');
  tabs.forEach(function (tab) {
    if (tab.getAttribute('data-view') === viewKey) {
      tab.classList.add('kair-ind-tab--active');
    } else {
      tab.classList.remove('kair-ind-tab--active');
    }
  });

  // Show/hide view containers
  VIEWS.forEach(function (v) {
    var el = document.getElementById('kair-ind-view-' + v.key);
    if (el) el.style.display = v.key === viewKey ? '' : 'none';
  });

  // Load view content
  setTimeout(function () {
    self._loadCurrentView();
  }, 50);
};

// ── Load Current View ───────────────────────────────────────────
DefinicionIndicadoresComponent.prototype._loadCurrentView = function () {
  var searchInput = this.container.querySelector('#kair-ind-search');
  var q = searchInput ? searchInput.value : '';
  var viewKey = this.currentView;
  var container = document.getElementById('kair-ind-view-' + viewKey);
  if (!container) return;

  switch (viewKey) {
    case 'resultado':
      IndicadoresResultadoView.load(container, q);
      break;
    case 'estructura':
      IndicadoresEstructuraView.load(container, q);
      break;
    case 'proceso':
      IndicadoresProcesoView.load(container, q);
      break;
  }
};

// ── Propagate Search ────────────────────────────────────────────
DefinicionIndicadoresComponent.prototype._propagateSearch = function (q) {
  switch (this.currentView) {
    case 'resultado': IndicadoresResultadoView.setSearch(q); break;
    case 'estructura': IndicadoresEstructuraView.setSearch(q); break;
    case 'proceso': IndicadoresProcesoView.setSearch(q); break;
  }
};

// ── Show Toast ──────────────────────────────────────────────────
DefinicionIndicadoresComponent.prototype._showToast = function (title, type) {
  var container = document.getElementById('kair-ind-toast-container');
  if (!container) return;
  var icon = type === 'success' ? 'bi-check-circle-fill' : type === 'error' ? 'bi-exclamation-circle-fill' : 'bi-info-circle-fill';
  var color = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#174ea6';
  var toast = document.createElement('div');
  toast.className = 'kair-ind-toast kair-ind-toast--' + type;
  toast.innerHTML = '<i class="bi ' + icon + '" style="color:' + color + ';font-size:1.1rem"></i><span>' + title + '</span>';
  container.appendChild(toast);
  setTimeout(function () { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(function () { toast.remove(); }, 300); }, 3000);
};

// ── Render ──────────────────────────────────────────────────────
DefinicionIndicadoresComponent.prototype.render = function () {
  var self = this;
  this._loadCSS(function () {
    self._renderUI();
    self._initNavigation();
    self._loadCurrentView();
  });
};

// ── Destroy ─────────────────────────────────────────────────────
DefinicionIndicadoresComponent.prototype.destroy = function () {
  this.container.innerHTML = '';
};

// Export globally
window.DefinicionIndicadoresComponent = DefinicionIndicadoresComponent;
