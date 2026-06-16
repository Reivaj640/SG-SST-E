/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Submódulo 6.1.2 — Auditoría Anual
   Component Orchestrator — Tabs + KPI Strip + Header
   ═══════════════════════════════════════════════════════════════════ */

var VIEWS_AUD = [
  { key: 'cronograma', label: 'Cronograma', icon: 'bi-calendar3' },
  { key: 'plan',       label: 'Plan de Auditoría', icon: 'bi-file-earmark-text' },
  { key: 'hallazgos',  label: 'Hallazgos', icon: 'bi-exclamation-triangle' },
  { key: 'informe',    label: 'Informe', icon: 'bi-file-earmark-bar-graph' }
];

function AuditoriaAnualComponent(container, currentCompany, moduleName, submoduleTitle, backToModuleCallback) {
  this.container = container;
  this.currentCompany = currentCompany || 'Empresa';
  this.moduleName = moduleName || 'Verificación';
  this.submoduleTitle = submoduleTitle || '6.1.2 Auditoría Anual';
  this.backToModuleCallback = backToModuleCallback;
  this.currentView = 'cronograma';
  this.cssLoaded = false;
}

// ── Load CSS ────────────────────────────────────────────────────
AuditoriaAnualComponent.prototype._loadCSS = function (callback) {
  var cssHref = 'modules/verificacion/auditoria-anual/auditoria-anual.css';
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
AuditoriaAnualComponent.prototype._esc = function (str) {
  var div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
};

// ── Render UI ───────────────────────────────────────────────────
AuditoriaAnualComponent.prototype._renderUI = function () {
  var self = this;
  var stats = AuditoriaService.getKpiStats();

  // Header card (Capacitations pattern — BEM kair-aud-*)
  var headerHtml =
    '<div class="k-section-card" id="kair-aud-header-card" style="padding:0; margin-bottom:1.5rem; flex-shrink:0; flex-grow:0;">' +
      '<div class="kair-aud-header-row">' +
        '<div class="kair-aud-header-left">' +
          '<i class="bi bi-clipboard-check kair-aud-header-icon"></i>' +
          '<div>' +
            '<h3 class="kair-aud-header-title">Auditoría Anual</h3>' +
            '<p class="kair-aud-header-subtitle">Submódulo 6.1.2 — Programa anual de auditorías SG-SST</p>' +
          '</div>' +
        '</div>' +
        '<div class="kair-aud-header-actions">' +
          '<span class="kair-aud-header-company" id="kair-aud-header-company"><i class="bi bi-building"></i> <span id="header-company-text">' + this._esc(this.currentCompany) + '</span></span>' +
          '<div class="kair-aud-header-divider"></div>' +
          '<button class="header-back-btn" id="kair-aud-back"><i class="bi bi-arrow-left"></i> Volver</button>' +
          '<button class="header-action--ghost" id="kair-aud-export"><i class="bi bi-download"></i> Exportar</button>' +
        '</div>' +
      '</div>' +
      '<div class="kair-aud-tabs" id="kair-aud-tabs">';

  // Tabs
  headerHtml += VIEWS_AUD.map(function (v) {
    return '<button class="kair-aud-tab' + (v.key === self.currentView ? ' kair-aud-tab--active' : '') +
      '" data-view="' + v.key + '">' +
      '<i class="bi ' + v.icon + '"></i> ' + v.label +
      '</button>';
  }).join('');

  headerHtml += '</div></div>';

  // KPI Strip
  var kpis = [
    { key: 'total', icon: 'bi-clipboard-check', value: stats.total, label: 'Total Auditorías', color: '#174ea6', bg: '#e8f0fe' },
    { key: 'completadas', icon: 'bi-check-circle', value: stats.completadas, label: 'Completadas', color: '#28a745', bg: '#d4edda' },
    { key: 'enProgreso', icon: 'bi-arrow-repeat', value: stats.enProgreso, label: 'En Progreso', color: '#174ea6', bg: '#e8f0fe' },
    { key: 'programadas', icon: 'bi-calendar-event', value: stats.programadas, label: 'Programadas', color: '#ffc107', bg: '#fff3cd' },
    { key: 'hallazgos', icon: 'bi-exclamation-triangle', value: stats.totalHallazgos, label: 'Hallazgos', color: '#dc3545', bg: '#f8d7da' },
    { key: 'calificacion', icon: 'bi-trophy', value: stats.calificacionProm + '%', label: 'Calificación', color: stats.calificacionProm >= 80 ? '#28a745' : '#ffc107', bg: stats.calificacionProm >= 80 ? '#d4edda' : '#fff3cd' }
  ];

  var kpiHtml = kpis.map(function (kpi, idx) {
    var item = '<div class="kair-aud-kpi-item">' +
      '<div class="kair-aud-kpi-item__icon" style="background:' + kpi.bg + '">' +
        '<i class="bi ' + kpi.icon + '" style="color:' + kpi.color + ';font-size:1rem;"></i>' +
      '</div>' +
      '<div class="kair-aud-kpi-item__content">' +
        '<span class="kair-aud-kpi-item__value" style="color:' + kpi.color + ';">' + kpi.value + '</span>' +
        '<span class="kair-aud-kpi-item__label">' + kpi.label + '</span>' +
      '</div>' +
    '</div>';
    if (idx < kpis.length - 1) item += '<div class="kair-aud-kpi-divider"></div>';
    return item;
  }).join('');

  // View containers
  var viewContainers = VIEWS_AUD.map(function (v) {
    return '<div class="kair-aud-view' + (v.key === self.currentView ? ' kair-aud-view--active' : '') + '" id="kair-aud-view-' + v.key + '"></div>';
  }).join('');

  // Assemble
  this.container.innerHTML =
    '<div class="kair-aud-wrapper">' +
      headerHtml +
      '<main class="kair-aud-main">' +
        '<div class="kair-aud-kpi-strip" id="kair-aud-kpi-strip">' + kpiHtml + '</div>' +
        viewContainers +
      '</main>' +
    '</div>';
};

// ── Init Navigation ─────────────────────────────────────────────
AuditoriaAnualComponent.prototype._initNavigation = function () {
  var self = this;
  var wrapper = this.container.querySelector('.kair-aud-wrapper');
  if (!wrapper) return;

  // Back button
  var backBtn = wrapper.querySelector('#kair-aud-back');
  if (backBtn) {
    backBtn.onclick = function () {
      if (typeof self.backToModuleCallback === 'function') self.backToModuleCallback();
    };
  }

  // Tab navigation
  var tabs = wrapper.querySelectorAll('.kair-aud-tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var viewKey = tab.getAttribute('data-view');
      if (viewKey) self._navigate(viewKey);
    });
  });
};

// ── Navigate ────────────────────────────────────────────────────
AuditoriaAnualComponent.prototype._navigate = function (viewKey) {
  var self = this;
  this.currentView = viewKey;

  // Update tab active state
  var tabs = this.container.querySelectorAll('.kair-aud-tab');
  tabs.forEach(function (tab) {
    if (tab.getAttribute('data-view') === viewKey) {
      tab.classList.add('kair-aud-tab--active');
    } else {
      tab.classList.remove('kair-aud-tab--active');
    }
  });

  // Show/hide view containers
  VIEWS_AUD.forEach(function (v) {
    var el = document.getElementById('kair-aud-view-' + v.key);
    if (el) el.style.display = v.key === viewKey ? 'flex' : 'none';
  });

  // Load view content
  setTimeout(function () {
    self._loadCurrentView();
  }, 50);
};

// ── Load Current View ───────────────────────────────────────────
AuditoriaAnualComponent.prototype._loadCurrentView = function () {
  var viewKey = this.currentView;
  var container = document.getElementById('kair-aud-view-' + viewKey);
  if (!container) return;

  switch (viewKey) {
    case 'cronograma':
      AuditoriaCronogramaView.load(container);
      break;
    case 'plan':
      AuditoriaPlanView.load(container);
      break;
    case 'hallazgos':
      AuditoriaHallazgosView.load(container);
      break;
    case 'informe':
      AuditoriaInformeView.load(container);
      break;
  }
};

// ── Render ──────────────────────────────────────────────────────
AuditoriaAnualComponent.prototype.render = function () {
  var self = this;
  this._loadCSS(function () {
    self._renderUI();
    self._initNavigation();
    self._loadCurrentView();
  });
};

// ── Destroy ─────────────────────────────────────────────────────
AuditoriaAnualComponent.prototype.destroy = function () {
  this.container.innerHTML = '';
};

// Export globally
window.AuditoriaAnualComponent = AuditoriaAnualComponent;
