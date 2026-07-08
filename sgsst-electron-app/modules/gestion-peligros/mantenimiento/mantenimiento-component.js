/* ==========================================================================
K+AIR — Módulo 4.2.5 Mantenimiento Periódico
Componente principal — Type C Direct DOM con Header v2.0
Patrón 4 Constructor: (container, currentCompany, moduleName, submoduleTitle, backToModuleCallback)
========================================================================== */
(function () {
 'use strict';

 var VIEWS = [
  { key: 'cronograma', label: 'Cronograma', icon: 'bi-calendar3' },
  { key: 'resumen', label: 'Resumen', icon: 'bi-bar-chart-line' }
 ];

 function MantenimientoComponent(container, currentCompany, moduleName, submoduleTitle, backToModuleCallback) {
  this.container = container;
  this.currentCompany = currentCompany;
  this.moduleName = moduleName;
  this.submoduleTitle = submoduleTitle;
  this.backToModuleCallback = backToModuleCallback;
  /* currentView=null para que el primer _navigate('cronograma') desde render()
     NO retorne por el early return y pueda cargar la vista inicial.
     Antes era 'cronograma' pero bloqueaba la primera carga (bug tras Fase 2). */
  this.currentView = null;
  this.cssLoaded = false;
 }

 MantenimientoComponent.prototype.render = function () {
  var self = this;
  this.container.innerHTML = '';
  this._loadCSS(function () {
   self._renderUI();
   self._initNavigation();
   self._navigate('cronograma');
   self._updateHeaderContext();
  });
 };

 MantenimientoComponent.prototype.destroy = function () {
  this.container.innerHTML = '';
 };

 MantenimientoComponent.prototype._loadCSS = function (callback) {
  var cssHref = 'modules/gestion-peligros/mantenimiento/mantenimiento.css';
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

 MantenimientoComponent.prototype._renderUI = function () {
  var self = this;

 var tabsHtml = VIEWS.map(function (v) {
  return '<button class="k-mnt-tab' + (v.key === 'cronograma' ? ' k-mnt-tab--active' : '') + '" data-view="' + v.key + '">' +
  '<i class="bi ' + v.icon + '"></i> ' + v.label +
  '</button>';
 }).join('');

 var headerHtml =
  '<div class="k-section-card k-mnt-header-card">' +
  '<div class="k-mnt-header-row">' +
  '<div class="k-mnt-header-left">' +
  '<i class="bi bi-gear k-mnt-header-icon"></i>' +
  '<div>' +
  '<h3 class="k-mnt-header-title">Mantenimiento Periódico</h3>' +
  '<ol class="k-mnt-header-breadcrumb">' +
  '<li>Gestión de Peligros</li>' +
  '<li>4.2.5</li>' +
  '<li class="k-mnt-header-breadcrumb--active" id="kair-mnt-breadcrumb-active">Cronograma</li>' +
  '</ol>' +
  '</div>' +
  '</div>' +
  '<div class="k-mnt-header-actions">' +
  '<span class="k-mnt-header-company" id="kair-mnt-header-company"><i class="bi bi-building"></i> <span></span></span>' +
  '<div class="k-mnt-header-divider"></div>' +
  '<button id="kair-mnt-btn-back" class="header-back-btn" title="Volver al módulo">' +
  '<i class="bi bi-arrow-left"></i> Volver' +
  '</button>' +
  '</div>' +
  '</div>' +
  '<div class="k-mnt-tabs" id="kair-mnt-tabs">' +
  tabsHtml +
  '</div>' +
  '</div>';

  var viewsHtml = VIEWS.map(function (v) {
   return '<div class="kair-mnt-view' + (v.key === 'cronograma' ? ' kair-mnt-view--active' : '') + '" id="kair-mnt-view-' + v.key + '">' +
    self._getViewSkeleton(v.key) +
    '</div>';
  }).join('');

  var evidenceDialogHtml =
   '<div class="kair-mnt-evidence-overlay" id="kair-mnt-evidence-overlay">' +
   '<div class="kair-mnt-evidence-dialog">' +
   '<div class="kair-mnt-evidence-dialog__header">' +
   '<h3 class="kair-mnt-evidence-dialog__title" id="kair-mnt-evidence-dialog-title">Evidencias</h3>' +
   '<button class="kair-mnt-evidence-dialog__close" id="kair-mnt-evidence-dialog-close"><i class="bi bi-x-lg"></i></button>' +
   '</div>' +
   '<div class="kair-mnt-evidence-dialog__body" id="kair-mnt-evidence-dialog-body"></div>' +
   '</div>' +
   '</div>';

  var imageViewerHtml =
   '<div class="kair-mnt-image-viewer" id="kair-mnt-image-viewer">' +
   '<button class="kair-mnt-image-viewer__close"><i class="bi bi-x-lg"></i></button>' +
   '<img id="kair-mnt-image-viewer-img" src="" alt="Vista previa">' +
   '</div>';

  var wrapper = document.createElement('div');
  wrapper.className = 'kair-mnt-wrapper';
  wrapper.innerHTML = headerHtml +
   '<div class="kair-mnt-views-container">' + viewsHtml + '</div>' +
   evidenceDialogHtml +
   imageViewerHtml;

  this.container.appendChild(wrapper);
 };

 MantenimientoComponent.prototype._getViewSkeleton = function (viewKey) {
  switch (viewKey) {
   case 'cronograma':
    return '<div id="kair-mnt-cronograma-kpis" class="kair-mnt-kpis"></div>' +
     '<div id="kair-mnt-cronograma-filters" class="kair-mnt-filters"></div>' +
     '<div id="kair-mnt-cronograma-table"></div>';
   case 'resumen':
    return '<div id="kair-mnt-resumen-content">' +
     KairSkeleton.kpiStrip(4) +
     '</div>';
   default:
    return '<div class="kair-mnt-empty-state"><i class="bi bi-inbox"></i><h3>Vista no disponible</h3></div>';
  }
 };

 MantenimientoComponent.prototype._initNavigation = function () {
  var self = this;
  var wrapper = this.container.querySelector('.kair-mnt-wrapper');
  if (!wrapper) return;

  var backBtn = wrapper.querySelector('#kair-mnt-btn-back');
  if (backBtn) {
   backBtn.addEventListener('click', function () {
    if (typeof self.backToModuleCallback === 'function') {
     self.backToModuleCallback();
    }
   });
  }

   var tabs = wrapper.querySelectorAll('.k-mnt-tab');
   tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
     var viewKey = tab.getAttribute('data-view');
     if (viewKey) self._navigate(viewKey);
    });
   });
 };

 MantenimientoComponent.prototype._navigate = function (viewKey) {
  if (this.currentView === viewKey) return;
  this.currentView = viewKey;

  var wrapper = this.container.querySelector('.kair-mnt-wrapper');
  if (!wrapper) return;

   var tabs = wrapper.querySelectorAll('.k-mnt-tab');
   tabs.forEach(function (tab) {
    if (tab.getAttribute('data-view') === viewKey) {
     tab.classList.add('k-mnt-tab--active');
    } else {
     tab.classList.remove('k-mnt-tab--active');
    }
   });

  var views = wrapper.querySelectorAll('.kair-mnt-view');
  views.forEach(function (view) {
   if (view.id === 'kair-mnt-view-' + viewKey) {
    view.classList.add('kair-mnt-view--active');
   } else {
    view.classList.remove('kair-mnt-view--active');
   }
  });

  var breadcrumbActive = wrapper.querySelector('#kair-mnt-breadcrumb-active');
  if (breadcrumbActive) {
   var viewObj = VIEWS.find(function (v) { return v.key === viewKey; });
   breadcrumbActive.textContent = viewObj ? viewObj.label : viewKey;
  }

  setTimeout(function () {
   switch (viewKey) {
    case 'cronograma':
     if (window.CronogramaMant) CronogramaMant.load(this.currentCompany);
     break;
    case 'resumen':
     if (window.ResumenMant) ResumenMant.load(this.currentCompany);
     break;
   }
  }.bind(this), 50);

  this._updateHeaderContext();
 };

 MantenimientoComponent.prototype._updateHeaderContext = function () {
  var wrapper = this.container.querySelector('.kair-mnt-wrapper');
  if (!wrapper) return;

  var companyEl = wrapper.querySelector('#kair-mnt-header-company span');
  if (companyEl) {
   companyEl.textContent = this.currentCompany || '';
  }
 };

 window.MantenimientoComponent = MantenimientoComponent;
})();
