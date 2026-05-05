/* ==========================================================================
K+AIR — Módulo 4.2.4 Inspecciones Sistemáticas
Componente principal — Type C Direct DOM con Header v2.0 Patrón 4
Constructor: (container, currentCompany, moduleName, submoduleTitle, backToModuleCallback)
========================================================================== */
(function () {
  'use strict';

  var VIEWS = [
    { key: 'dashboard', label: 'Panel', icon: 'bi-speedometer2' },
    { key: 'programa', label: 'Programa', icon: 'bi-calendar3' },
    { key: 'formulario', label: 'Formulario', icon: 'bi-file-earmark-text' },
    { key: 'historial', label: 'Historial', icon: 'bi-clock-history' }
  ];

function InspeccionesComponent(container, currentCompany, moduleName, submoduleTitle, backToModuleCallback) {
    this.container = container;
    this.currentCompany = currentCompany;
    this.moduleName = moduleName;
    this.submoduleTitle = submoduleTitle;
    this.backToModuleCallback = backToModuleCallback;
    this.currentView = 'dashboard';
    this.cssLoaded = false;
  }

  InspeccionesComponent.prototype.render = function () {
    var self = this;
    this.container.innerHTML = '';
    this._loadCSS(function () {
      self._renderUI();
      self._initNavigation();
      self._navigate('dashboard');
      self._updateHeaderContext();
    });
  };

  InspeccionesComponent.prototype.destroy = function () {
    this.container.innerHTML = '';
  };

InspeccionesComponent.prototype._loadCSS = function (callback) {
  var cssHref = 'modules/gestion-peligros/inspecciones/inspecciones.css';
  var existingLink = document.querySelector('link[href="' + cssHref + '"]');
  if (existingLink || this.cssLoaded) {
    this.cssLoaded = true;
    callback();
    return;
  }
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssHref;
  link.onload = function () {
    this.cssLoaded = true;
    callback();
  }.bind(this);
  link.onerror = function () {
    this.cssLoaded = true;
    callback();
  }.bind(this);
  document.head.appendChild(link);
};

  InspeccionesComponent.prototype._renderUI = function () {
    var self = this;

    var tabsHtml = VIEWS.map(function (v) {
      var badgeHtml = '';
      if (v.key === 'dashboard' || v.key === 'programa') {
        badgeHtml = '<span class="kair-header__tab-badge" id="kair-insp-tab-badge-' + v.key + '" style="display:none;">0</span>';
      }
      return '<button class="kair-header__tab' + (v.key === 'dashboard' ? ' active' : '') + '" data-view="' + v.key + '">' +
        '<i class="bi ' + v.icon + '"></i> ' + v.label + ' ' + badgeHtml +
      '</button>';
    }).join('');

    var headerHtml =
      '<header class="kair-header">' +
        '<div class="kair-header__bar">' +
          '<div class="kair-header__left">' +
            '<button class="kair-header__back" id="kair-insp-btn-back" title="Volver">' +
              '<i class="bi bi-arrow-left"></i>' +
            '</button>' +
            '<div class="kair-header__divider"></div>' +
          '</div>' +
          '<div class="kair-header__center">' +
            '<h1 class="kair-header__title"><i class="bi bi-clipboard-check"></i> Inspecciones Sistemáticas</h1>' +
            '<ol class="kair-header__breadcrumb">' +
              '<li>Gestión de Peligros</li>' +
              '<li>4.2.4</li>' +
              '<li class="kair-header__breadcrumb--active" id="kair-insp-breadcrumb-active">Panel</li>' +
            '</ol>' +
          '</div>' +
          '<div class="kair-header__right">' +
            '<span class="kair-header__pill--section">4.2.4</span>' +
            '<span class="kair-header__company" id="kair-insp-header-company"><i class="bi bi-building"></i> <span></span></span>' +
            '<button class="kair-header__action--primary" id="kair-insp-btn-new" style="display:none;"><i class="bi bi-plus-lg"></i> Nueva Inspección</button>' +
            '<button class="kair-header__action--ghost" id="kair-insp-btn-export" style="display:none;"><i class="bi bi-download"></i> Exportar</button>' +
          '</div>' +
        '</div>' +
        '<div class="kair-header__tabs" id="kair-insp-tabs">' +
          tabsHtml +
        '</div>' +
      '</header>';

    var viewsHtml = VIEWS.map(function (v) {
      return '<div class="kair-insp-view' + (v.key === 'dashboard' ? ' kair-insp-view--active' : '') + '" id="kair-insp-view-' + v.key + '">' +
        self._getViewSkeleton(v.key) +
      '</div>';
    }).join('');

    var modalHtml =
      '<div class="kair-insp-modal-overlay" id="kair-insp-modal">' +
        '<div class="kair-insp-modal">' +
          '<div class="kair-insp-modal__header">' +
            '<h3 class="kair-insp-modal__title" id="kair-insp-modal-title">Modal</h3>' +
            '<button class="kair-insp-modal__close" id="kair-insp-modal-close"><i class="bi bi-x-lg"></i></button>' +
          '</div>' +
          '<div class="kair-insp-modal__body" id="kair-insp-modal-body"></div>' +
          '<div class="kair-insp-modal__footer" id="kair-insp-modal-footer">' +
            '<button class="kair-insp-btn kair-insp-btn--ghost" id="kair-insp-modal-cancel">Cancelar</button>' +
            '<button class="kair-insp-btn kair-insp-btn--primary" id="kair-insp-modal-confirm">Confirmar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var wrapper = document.createElement('div');
    wrapper.className = 'kair-insp-wrapper';
    wrapper.innerHTML =
      headerHtml +
      '<div class="kair-insp-views-container">' +
        viewsHtml +
      '</div>' +
      modalHtml;

    this.container.appendChild(wrapper);

    this._bindModalEvents();
  };

  InspeccionesComponent.prototype._getViewSkeleton = function (viewKey) {
    switch (viewKey) {
      case 'dashboard':
        return '<div id="kair-insp-dashboard-stats" class="kair-insp__stats-grid"></div>' +
          '<div class="kair-insp__dashboard-grid">' +
            '<div class="kair-insp__dashboard-full" id="kair-insp-dashboard-calendar"></div>' +
          '</div>' +
          '<div class="kair-insp__dashboard-grid" style="margin-top:1.5rem;">' +
            '<div id="kair-insp-dashboard-recent"></div>' +
            '<div id="kair-insp-dashboard-alerts"></div>' +
          '</div>';

      case 'programa':
        return '<div id="kair-insp-programa-kpis" class="kair-insp__programa-kpis"></div>' +
          '<div id="kair-insp-programa-table"></div>';

      case 'formulario':
        return '<div id="kair-insp-formulario-content">' +
          '<div class="kair-insp-loading"><div class="kair-insp-spinner"></div><p>Cargando formulario...</p></div>' +
        '</div>';

      case 'historial':
        return '<div id="kair-insp-historial-filters"></div>' +
          '<div id="kair-insp-historial-table"></div>';

      default:
        return '<div class="kair-insp-empty-state"><i class="bi bi-inbox"></i><h3>Vista no disponible</h3></div>';
    }
  };

  InspeccionesComponent.prototype._initNavigation = function () {
    var self = this;
    var wrapper = this.container.querySelector('.kair-insp-wrapper');
    if (!wrapper) return;

    var backBtn = wrapper.querySelector('#kair-insp-btn-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (typeof self.backToModuleCallback === 'function') {
          self.backToModuleCallback();
        }
      });
    }

    var tabs = wrapper.querySelectorAll('.kair-header__tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var viewKey = tab.getAttribute('data-view');
        if (viewKey) self._navigate(viewKey);
      });
    });
  };

  InspeccionesComponent.prototype._navigate = function (viewKey) {
    this.currentView = viewKey;
    var wrapper = this.container.querySelector('.kair-insp-wrapper');
    if (!wrapper) return;

    var tabs = wrapper.querySelectorAll('.kair-header__tab');
    tabs.forEach(function (tab) {
      if (tab.getAttribute('data-view') === viewKey) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    var views = wrapper.querySelectorAll('.kair-insp-view');
    views.forEach(function (view) {
      if (view.id === 'kair-insp-view-' + viewKey) {
        view.classList.add('kair-insp-view--active');
      } else {
        view.classList.remove('kair-insp-view--active');
      }
    });

    var breadcrumbActive = wrapper.querySelector('#kair-insp-breadcrumb-active');
    if (breadcrumbActive) {
      var viewObj = VIEWS.find(function (v) { return v.key === viewKey; });
      breadcrumbActive.textContent = viewObj ? viewObj.label : viewKey;
    }

    var btnNew = wrapper.querySelector('#kair-insp-btn-new');
    var btnExport = wrapper.querySelector('#kair-insp-btn-export');
    if (btnNew) btnNew.style.display = (viewKey === 'historial') ? '' : 'none';
    if (btnExport) btnExport.style.display = (viewKey === 'programa') ? '' : 'none';

    setTimeout(function () {
      switch (viewKey) {
        case 'dashboard':
          if (window.DashboardInsp) DashboardInsp.load(this.currentCompany);
          break;
        case 'programa':
          if (window.ProgramaInsp) ProgramaInsp.load(this.currentCompany);
          break;
        case 'formulario':
          if (window.FormularioInsp) FormularioInsp.load(this.currentCompany);
          break;
        case 'historial':
          if (window.HistorialInsp) HistorialInsp.load(this.currentCompany);
          break;
      }
    }.bind(this), 50);

    this._updateHeaderContext();
  };

  InspeccionesComponent.prototype._updateHeaderContext = function () {
    var wrapper = this.container.querySelector('.kair-insp-wrapper');
    if (!wrapper) return;

    var companyEl = wrapper.querySelector('#kair-insp-header-company span');
    if (companyEl) {
      companyEl.textContent = this.currentCompany || '';
    }

    var btnNew = wrapper.querySelector('#kair-insp-btn-new');
    if (btnNew && !btnNew._kairBound) {
      btnNew._kairBound = true;
      btnNew.addEventListener('click', function () {
        if (window.HistorialInsp) HistorialInsp.showNewModal();
      });
    }

    var btnExport = wrapper.querySelector('#kair-insp-btn-export');
    if (btnExport && !btnExport._kairBound) {
      btnExport._kairBound = true;
      btnExport.setAttribute('id', 'kair-insp-programa-export');
    }
  };

  InspeccionesComponent.prototype._bindModalEvents = function () {
    var wrapper = this.container.querySelector('.kair-insp-wrapper');
    if (!wrapper) return;

    var modal = wrapper.querySelector('#kair-insp-modal');
    var closeBtn = wrapper.querySelector('#kair-insp-modal-close');
    var cancelBtn = wrapper.querySelector('#kair-insp-modal-cancel');

    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        modal.classList.remove('visible');
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        modal.classList.remove('visible');
      });
    }
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.classList.remove('visible');
      });
    }
  };

  window.InspeccionesComponent = InspeccionesComponent;
})();
