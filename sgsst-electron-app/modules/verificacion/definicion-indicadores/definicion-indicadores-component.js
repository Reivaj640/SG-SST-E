/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Submódulo 6.1.1 — Definición de Indicadores
   Component Orchestrator — Tabs + KPI Strip + Header
   ═══════════════════════════════════════════════════════════════════ */

var VIEWS = [
  { key: 'resultado',  label: 'Resultado',  icon: 'target' },
  { key: 'estructura', label: 'Estructura', icon: 'shield-check' },
  { key: 'proceso',    label: 'Proceso',    icon: 'settings' }
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

// ── Iconos Lucide (📦800) ────────────────────────────────────────
DefinicionIndicadoresComponent.prototype._icon = function (name, size) {
  return '<i data-lucide="' + name + '" style="width:' + (size || 16) + 'px;height:' + (size || 16) + 'px;display:inline-block;vertical-align:middle"></i>';
};

DefinicionIndicadoresComponent.prototype._refreshIcons = function () {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    try { window.lucide.createIcons(); } catch (e) { /* ignore */ }
  }
};

// ── Render UI ───────────────────────────────────────────────────
DefinicionIndicadoresComponent.prototype._renderUI = function () {
  var self = this;
  var stats = IndicadoresService.getKpiStats();

  /* 📦800 — Header premium v2 (estándar · kair-page-header + kair-badge-ico +
     kair-titles + kair-actions). Mismos ids (#kair-ind-export, #kair-ind-back,
     #kair-ind-tabs, #kair-ind-tab[data-view]) que el header viejo para no
     tocar _initNavigation. La fuente de datos se anuncia en una píldora
     suave (.kair-badge-soft) en lugar del badge custom kind-header__sync. */
  var isExcel = IndicadoresService.getSource() === 'excel';
  var syncLabel = isExcel
    ? 'Sincronizado · INDICADORES ' + IndicadoresService.getYear() + '.xlsx'
    : 'Datos de ejemplo (sin Excel en la carpeta)';

  var headerHtml =
    '<header class="kair-page-header">' +
      '<div class="kair-badge-ico">' + this._icon('target', 22) + '</div>' +
      '<div class="kair-titles">' +
        '<h1 class="kair-title">Definición de Indicadores</h1>' +
        '<p class="kair-sub">Gestión de indicadores del SG-SST — definición, estructura, proceso y resultado.</p>' +
      '</div>' +
      '<div class="kair-actions">' +
        '<span class="kair-badge-soft' + (isExcel ? '' : ' kair-badge-soft--warn') + '" title="' + this._esc(syncLabel) + '">' +
          this._icon(isExcel ? 'check-circle-2' : 'info', 13) + '<span>' + this._esc(syncLabel) + '</span>' +
        '</span>' +
        '<button class="kair-btn kair-btn-outline" id="kair-ind-export">' + this._icon('download', 14) + ' Exportar</button>' +
        '<button class="kair-btn kair-btn-ghost" id="kair-ind-back">' + this._icon('arrow-left', 14) + ' Volver</button>' +
      '</div>' +
    '</header>' +
    '<div class="kair-ind-tabs" id="kair-ind-tabs">';

  // Tabs (debajo del header, premium pattern como en Evaluación Inicial)
  headerHtml += VIEWS.map(function (v) {
    return '<button class="kair-ind-tab' + (v.key === self.currentView ? ' kair-ind-tab--active' : '') +
      '" data-view="' + v.key + '">' +
      self._icon(v.icon, 15) + ' ' + v.label +
      '</button>';
  }).join('');

  headerHtml += '</div>';

  /* KPI Strip — colores por clase (📦800): el color por estado sale del
     CSS con tokens canónicos, ya no de hex inline. */
  var kpis = [
    { key: 'total', icon: 'bar-chart-3', value: stats.total, label: 'Total Indicadores' },
    { key: 'cumplidos', icon: 'check-circle-2', value: stats.cumplidos, label: 'Cumplidos' },
    { key: 'enProgreso', icon: 'refresh-cw', value: stats.enProgreso, label: 'En Progreso' },
    { key: 'pendientes', icon: 'history', value: stats.pendientes, label: 'Pendientes' },
    { key: 'criticos', icon: 'alert-triangle', value: stats.criticos, label: 'Críticos' },
    { key: 'tasa', icon: 'trending-up', value: stats.tasaCumplimiento + '%', label: 'Tasa Cumplimiento' }
  ];

  var kpiHtml = kpis.map(function (kpi, idx) {
    var item = '<div class="kair-ind-kpi-item kair-ind-kpi-item--' + kpi.key + '">' +
      '<div class="kair-ind-kpi-item__icon">' +
        self._icon(kpi.icon, 16) +
      '</div>' +
      '<div class="kair-ind-kpi-item__content">' +
        '<span class="kair-ind-kpi-item__value">' + kpi.value + '</span>' +
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
        self._icon('search', 15) +
        '<input type="text" id="kair-ind-search" placeholder="Buscar indicador por nombre, definición o responsable..." class="kair-ind-toolbar__input" />' +
        '<button class="kair-ind-toolbar__clear" id="kair-ind-search-clear" style="display:none">' + self._icon('x', 14) + '</button>' +
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
          '<button class="kair-ind-modal__close" id="kair-ind-modal-close">' + this._icon('x', 16) + '</button>' +
        '</div>' +
        '<div class="kair-ind-modal__tabs">' +
          '<button class="kair-ind-modal__tab kair-ind-modal__tab--active" data-modal-tab="info">' + this._icon('info', 14) + ' Información</button>' +
          '<button class="kair-ind-modal__tab" data-modal-tab="data">' + this._icon('file-text', 14) + ' Datos Mensuales</button>' +
          '<button class="kair-ind-modal__tab" data-modal-tab="chart">' + this._icon('bar-chart-3', 14) + ' Tendencia</button>' +
        '</div>' +
        '<div class="kair-ind-modal__content" id="kair-ind-modal-content"></div>' +
        '<div class="kair-ind-modal__footer">' +
          '<button class="kair-ind-btn kair-ind-btn--ghost" id="kair-ind-modal-cancel">Cerrar</button>' +
          '<button class="kair-ind-btn kair-ind-btn--primary" id="kair-ind-modal-edit">' + this._icon('pencil', 14) + ' Editar Indicador</button>' +
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

  /* 📦800 — Exportar antes no tenía acción (botón muerto). Por ahora
     informa con un toast; la exportación real a Excel vendrá después. */
  var exportBtn = wrapper.querySelector('#kair-ind-export');
  if (exportBtn) {
    exportBtn.onclick = function () {
      self._showToast('La exportación a Excel estará disponible próximamente', 'info');
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
    self._refreshIcons();
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
  var map = {
    success: { icon: 'check-circle-2', color: '#1a9e74' },
    error: { icon: 'alert-circle', color: '#d64550' },
    info: { icon: 'info', color: '#2057b8' }
  };
  var m = map[type] || map.info;
  var toast = document.createElement('div');
  toast.className = 'kair-ind-toast kair-ind-toast--' + type;
  toast.innerHTML = this._icon(m.icon, 18).replace('<i ', '<i style="color:' + m.color + '" ') + '<span>' + this._esc(title) + '</span>';
  container.appendChild(toast);
  setTimeout(function () { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(function () { toast.remove(); }, 300); }, 3000);
};

// ── Render ──────────────────────────────────────────────────────
DefinicionIndicadoresComponent.prototype.render = function () {
  var self = this;
  /* 📦800 — carga los indicadores reales del Excel de la empresa
     (con fallback transparente a la libreta de ejemplo). */
  var done = function () {
    self._loadCSS(function () {
      self._renderUI();
      self._initNavigation();
      self._loadCurrentView();
      self._refreshIcons();
    });
  };
  if (IndicadoresService && typeof IndicadoresService.loadData === 'function') {
    IndicadoresService.loadData(this.currentCompany).finally(done);
  } else {
    done();
  }
};

// ── Destroy ─────────────────────────────────────────────────────
DefinicionIndicadoresComponent.prototype.destroy = function () {
  this.container.innerHTML = '';
};

// Export globally
window.DefinicionIndicadoresComponent = DefinicionIndicadoresComponent;
