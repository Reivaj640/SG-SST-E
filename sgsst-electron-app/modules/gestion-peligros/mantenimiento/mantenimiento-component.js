/* ==========================================================================
K+AIR — Módulo 4.2.5 Mantenimiento Periódico
Componente principal — Type C Direct DOM con Header v2.0
Patrón 4 Constructor: (container, currentCompany, moduleName, submoduleTitle, backToModuleCallback)
========================================================================== */
(function () {
 'use strict';

 /* ── SVGs inline (premium · sin Bootstrap Icons en el header) ── */
 var SVG = {
  gear: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  arrowLeft: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  chart: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>'
 };

 var VIEWS = [
  { key: 'cronograma', label: 'Cronograma', iconSvg: SVG.calendar },
  { key: 'resumen', label: 'Resumen', iconSvg: SVG.chart }
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
  v.iconSvg + ' <span>' + v.label + '</span>' +
  '</button>';
 }).join('');

 var headerHtml =
  '<header class="k-mnt-header-card">' +
  '<div class="k-mnt-header-row">' +
  '<div class="kair-badge-ico">' + SVG.gear + '</div>' +
  '<div class="kair-titles">' +
  '<h1 class="kair-title">Mantenimiento Periódico</h1>' +
  '<p class="kair-sub">Programación y seguimiento del mantenimiento de equipos, instalaciones y herramientas SG-SST.</p>' +
  '</div>' +
  '<div class="kair-actions">' +
  '<button id="kair-mnt-btn-back" class="kair-btn kair-btn-ghost" title="Volver al módulo">' +
  SVG.arrowLeft + ' <span>Volver</span>' +
  '</button>' +
  '</div>' +
  '</div>' +
  '<div class="k-mnt-tabs" id="kair-mnt-tabs">' +
  tabsHtml +
  '</div>' +
  '</header>';

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
  /* Hook legado: el header premium ya no muestra chip de empresa.
     Se conserva por compatibilidad pero no hace nada. */
 };

 window.MantenimientoComponent = MantenimientoComponent;
})();
