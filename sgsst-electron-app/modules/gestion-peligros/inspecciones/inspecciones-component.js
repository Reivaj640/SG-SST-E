/* ==========================================================================
K+AIR — Módulo 4.2.4 Inspecciones Sistemáticas
Componente principal — Type C Direct DOM con Header v2.0 Patrón 4
Constructor: (container, currentCompany, moduleName, submoduleTitle, backToModuleCallback)
========================================================================== */
(function () {
  'use strict';

var VIEWS = [
  { key: 'historial', label: 'Inspecciones', icon: 'bi-clipboard-check' },
  { key: 'programa', label: 'Programa', icon: 'bi-calendar3' },
  { key: 'formulario', label: 'Formulario', icon: 'bi-file-earmark-text' }
];

function InspeccionesComponent(container, currentCompany, moduleName, submoduleTitle, backToModuleCallback) {
    this.container = container;
    this.currentCompany = currentCompany;
    this.moduleName = moduleName;
    this.submoduleTitle = submoduleTitle;
    this.backToModuleCallback = backToModuleCallback;
    this.currentView = 'historial';
    this.cssLoaded = false;
  }

  InspeccionesComponent.prototype.render = function () {
    var self = this;
    this.container.innerHTML = '';
    this._loadCSS(function () {
      self._renderUI();
      self._initNavigation();
      self._navigate('historial');
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
    if (v.key === 'programa') {
      badgeHtml = '<span class="k-insp-tab-badge" id="kair-insp-tab-badge-' + v.key + '" style="display:none;">0</span>';
    }
      return '<button class="k-insp-tab' + (v.key === 'historial' ? ' k-insp-tab--active' : '') + '" data-view="' + v.key + '">' +
        '<i class="bi ' + v.icon + '"></i> ' + v.label + ' ' + badgeHtml +
      '</button>';
    }).join('');

    var headerHtml =
      '<div class="k-section-card k-insp-header-card">' +
        '<div class="k-insp-header-row">' +
          '<div class="k-insp-header-left">' +
            '<i class="bi bi-clipboard-check k-insp-header-icon"></i>' +
            '<div>' +
              '<h3 class="k-insp-header-title">Inspecciones Sistemáticas</h3>' +
              '<ol class="k-insp-header-breadcrumb">' +
                '<li>Gestión de Peligros</li>' +
                '<li>4.2.4</li>' +
                '<li class="k-insp-header-breadcrumb--active" id="kair-insp-breadcrumb-active">Inspecciones</li>' +
              '</ol>' +
            '</div>' +
          '</div>' +
          '<div class="k-insp-header-actions">' +
            '<span class="k-insp-header-company" id="kair-insp-header-company"><i class="bi bi-building"></i> <span></span></span>' +
            '<div class="k-insp-header-divider"></div>' +
            '<button id="kair-insp-btn-back" class="header-back-btn" title="Volver al módulo">' +
              '<i class="bi bi-arrow-left"></i> Volver' +
            '</button>' +
            '<button id="kair-insp-btn-export" class="header-action--ghost" style="display:none;">' +
              '<i class="bi bi-download"></i> Exportar' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="k-insp-tabs" id="kair-insp-tabs">' +
          tabsHtml +
        '</div>' +
      '</div>';

    var viewsHtml = VIEWS.map(function (v) {
      return '<div class="kair-insp-view' + (v.key === 'historial' ? ' kair-insp-view--active' : '') + '" id="kair-insp-view-' + v.key + '">' +
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
    case 'programa':
      return '<div id="kair-insp-programa-kpis" class="kair-insp__programa-kpis"></div>' +
        '<div id="kair-insp-programa-table"></div>';

    case 'formulario':
      return '<div id="kair-insp-formulario-content">' +
        KairSkeleton.form(6) +
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

    var tabs = wrapper.querySelectorAll('.k-insp-tab');
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

    var tabs = wrapper.querySelectorAll('.k-insp-tab');
    tabs.forEach(function (tab) {
      if (tab.getAttribute('data-view') === viewKey) {
        tab.classList.add('k-insp-tab--active');
      } else {
        tab.classList.remove('k-insp-tab--active');
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

  var btnExport = wrapper.querySelector('#kair-insp-btn-export');
  if (btnExport) btnExport.style.display = (viewKey === 'programa') ? '' : 'none';

    setTimeout(function () {
    switch (viewKey) {
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
