/* ==========================================================================
K+AIR — Módulo 2.10.1 Evaluación y Selección de Proveedores y Contratistas
Componente principal con header kair-header v2.0 + tabs integradas
========================================================================== */

(function () {
'use strict';

function EvaluacionSeleccionComponent(container, moduleName, submoduleTitle, backToModuleCallback, currentCompany) {
  this.container = container;
  this.moduleName = moduleName;
  this.submoduleTitle = submoduleTitle;
  this.backToModuleCallback = backToModuleCallback;
  this.currentCompany = currentCompany || '';
  this.currentView = 'dashboard';
  this.cssLoaded = false;
}

EvaluacionSeleccionComponent.prototype.render = function () {
  var self = this;
  this.container.innerHTML = '';

  this.loadCSS(function () {
    self.renderUI();
    self.initNavigation();
    self.seedData();
    self.navigate('dashboard');
    self.updateHeaderContext();
  });
};

EvaluacionSeleccionComponent.prototype.loadCSS = function (callback) {
  if (this.cssLoaded) { callback(); return; }

  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = 'modules/gestion-integral/evaluacion-seleccion/evaluacion-seleccion.css';
  link.onload = function () { this.cssLoaded = true; callback(); }.bind(this);
  link.onerror = function () { this.cssLoaded = true; callback(); }.bind(this);
  document.head.appendChild(link);
};

EvaluacionSeleccionComponent.prototype.seedData = function () {
  if (window.AsociadosServiceES && typeof window.AsociadosServiceES.seedSampleData === 'function') {
    window.AsociadosServiceES.seedSampleData();
  }
  if (window.EvaluacionesServiceES && typeof window.EvaluacionesServiceES.seedSampleData === 'function') {
    window.EvaluacionesServiceES.seedSampleData();
  }
  if (window.NoConformidadesServiceES && typeof window.NoConformidadesServiceES.seedSampleData === 'function') {
    window.NoConformidadesServiceES.seedSampleData();
  }
};

EvaluacionSeleccionComponent.prototype.renderUI = function () {
  var views = [
    { key: 'dashboard', label: 'Dashboard', icon: 'bi-grid-1x2' },
    { key: 'registro', label: 'Registro', icon: 'bi-people' },
    { key: 'evaluacion', label: 'Evaluación', icon: 'bi-check2-square' },
    { key: 'reevaluacion', label: 'Reevaluación', icon: 'bi-arrow-repeat' },
    { key: 'noconformidades', label: 'No Conformidades', icon: 'bi-exclamation-triangle' },
    { key: 'reportes', label: 'Reportes', icon: 'bi-file-earmark-bar-graph' }
  ];

  var stats = null;
  try { stats = window.EvaluacionesServiceES.getStats(); } catch (e) { stats = null; }
  var ncCount = 0;
  try { var ncs = window.NoConformidadesServiceES.getAll(); ncCount = ncs.filter(function(nc) { return nc.estado !== 'CERRADA'; }).length; } catch (e) { ncCount = 0; }

  var tabsHtml = views.map(function (v) {
    var badge = '';
    if (v.key === 'noconformidades' && ncCount > 0) {
      badge = '<span class="es-tab__badge">' + ncCount + '</span>';
    }
    return '<button class="es-tab' + (this.currentView === v.key ? ' active' : '') + '" data-view="' + v.key + '">' +
      '<i class="bi ' + v.icon + '"></i>' +
      '<span>' + v.label + '</span>' +
      badge +
    '</button>';
  }.bind(this)).join('');

  var viewsHtml = views.map(function (v) {
    var contentId = 'kair-es-view-' + v.key;
    var content = this.getViewContent(v.key);
    return '<div class="kair-es-view' + (this.currentView === v.key ? ' kair-es-view--active' : '') + '" id="' + contentId + '">' + content + '</div>';
  }.bind(this)).join('');

  var headerHtml =
    '<div class="k-section-card" style="padding:0; margin-bottom:0;">' +
      '<!-- Fila 1: contenido principal -->' +
      '<div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1.25rem 1.5rem;">' +
        '<div style="display:flex; align-items:center; gap:0.75rem;">' +
          '<i class="bi bi-people" style="color:#174ea6; font-size:1.25rem;"></i>' +
          '<div>' +
            '<h3 style="font-size:1.125rem; font-weight:600; margin:0; color:#1E293B;">Evaluación y Selección de Proveedores y Contratistas</h3>' +
            '<p style="font-size:0.8125rem; color:#64748B; margin:0.25rem 0 0 0;">Gestión de asociados y evaluación de proveedores y contratistas SG-SST.</p>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:0.75rem;">' +
          '<span class="k-section-card__company">' +
            '<i class="kair-icon-building"></i>' +
            '<span id="kair-es-header-company">' + (this.currentCompany || '') + '</span>' +
          '</span>' +
          '<div class="k-section-card__divider"></div>' +
          '<button class="header-back-btn" id="btn-back-es" title="Volver al módulo Gestión Integral">' +
            '<i class="fas fa-arrow-left"></i> Volver' +
          '</button>' +
          '<button class="header-action--ghost" id="kair-es-action-registro" style="display:none;" title="Nuevo Asociado">' +
            '<i class="bi bi-plus-lg"></i> Nuevo' +
          '</button>' +
          '<button class="header-action--ghost" id="kair-es-action-nc" style="display:none;" title="Reportar NC">' +
            '<i class="bi bi-exclamation-triangle"></i> Reportar NC' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<!-- Fila 2: tabs integrados -->' +
      '<div class="es-tabs">' +
        tabsHtml +
      '</div>' +
    '</div>';

  this.container.innerHTML =
    '<div class="kair-es-wrapper">' +
      headerHtml +
      '<div class="kair-es-views-container">' +
        viewsHtml +
      '</div>' +
    '</div>';
};

EvaluacionSeleccionComponent.prototype.getViewContent = function (viewKey) {
  switch (viewKey) {
  case 'dashboard':
    return '<div id="kair-es-dashboard-cards" class="kair-dashboard__cards"></div>' +
    '<div id="kair-es-dashboard-alerts" class="kair-dashboard__alerts"></div>' +
    '<div id="kair-es-dashboard-charts"></div>' +
    '<div id="kair-es-dashboard-recent"></div>';

  case 'registro':
    return '<button id="kair-es-registro-new-btn" style="display:none;"></button>' +
    '<div class="kair-es-nc-filters">' +
    '<div class="kair-form-group" style="min-width:200px;"><input type="text" id="kair-es-registro-search" class="kair-input" placeholder="Buscar por nombre, NIT..."></div>' +
    '<div class="kair-form-group" style="min-width:160px;"><select id="kair-es-registro-tipo-filter" class="kair-select"><option value="">Todos los tipos</option><option value="PROVEEDOR">Proveedores</option><option value="CONTRATISTA">Contratistas</option></select></div>' +
    '</div>' +
    '<div class="kair-card"><div class="kair-table-wrapper"><table class="kair-table kair-table--striped"><thead><tr><th>NIT / CC</th><th>Razón Social</th><th>Tipo</th><th>Producto / Servicio</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="kair-es-registro-tbody"><tr><td colspan="6" class="kair-table__empty">Cargando...</td></tr></tbody></table></div></div>' +
    this.getRegistroModal();

  case 'evaluacion':
    return '<div class="kair-eval-ranges kair-mb-6">' +
    '<span class="kair-eval-range kair-eval-range--bueno"><span class="kair-eval-range__dot"></span> Bueno (3.1 - 5.0)</span>' +
    '<span class="kair-eval-range kair-eval-range--regular"><span class="kair-eval-range__dot"></span> Regular (2.6 - 3.0)</span>' +
    '<span class="kair-eval-range kair-eval-range--deficiente"><span class="kair-eval-range__dot"></span> Deficiente (1.0 - 2.5)</span>' +
    '</div>' +
    '<div class="kair-form-group" style="max-width:500px;"><label class="kair-label kair-label--required" for="kair-es-eval-asociado">Seleccione el asociado a evaluar</label>' +
    '<select id="kair-es-eval-asociado" class="kair-select"><option value="">-- Seleccione un asociado --</option></select></div>' +
    '<div id="kair-es-eval-asociado-info"></div>' +
    '<div id="kair-es-eval-matrix"></div>' +
    '<div id="kair-es-eval-result"></div>' +
    '<div class="kair-card kair-mt-6" style="display:none;" id="kair-es-eval-actions">' +
    '<div class="kair-card__body">' +
    '<div class="kair-form-group kair-form-group--full"><label class="kair-label" for="kair-es-eval-observaciones">Observaciones de la evaluación</label>' +
    '<textarea id="kair-es-eval-observaciones" class="kair-textarea" rows="3" placeholder="Observaciones adicionales..."></textarea></div>' +
    '<div class="kair-flex kair-justify-between kair-mt-4">' +
    '<div class="kair-text-muted kair-text-sm"><em>Los puntajes se asignan en la escala 1-3-5 según el procedimiento GC-PR-001</em></div>' +
    '<button id="kair-es-eval-save-btn" class="kair-btn kair-btn--primary">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>' +
    'Guardar Evaluación' +
    '</button>' +
    '</div>' +
    '</div>' +
    '</div>';

  case 'reevaluacion':
    return '<div class="kair-form-group" style="max-width:500px;"><label class="kair-label kair-label--required" for="kair-es-reeval-asociado">Seleccione el asociado a reevaluar</label>' +
    '<select id="kair-es-reeval-asociado" class="kair-select"><option value="">-- Seleccione un asociado --</option></select></div>' +
    '<div id="kair-es-reeval-asociado-info"></div>' +
    '<div id="kair-es-reeval-history"></div>' +
    '<div id="kair-es-reeval-matrix"></div>' +
    '<div id="kair-es-reeval-result"></div>' +
    '<div class="kair-card kair-mt-6" style="display:none;" id="kair-es-reeval-actions">' +
    '<div class="kair-card__body">' +
    '<div class="kair-form-group kair-form-group--full"><label class="kair-label" for="kair-es-reeval-observaciones">Observaciones de la reevaluación</label>' +
    '<textarea id="kair-es-reeval-observaciones" class="kair-textarea" rows="3" placeholder="Observaciones sobre el desempeño..."></textarea></div>' +
    '<div class="kair-flex kair-justify-between kair-mt-4">' +
    '<div class="kair-text-muted kair-text-sm"><em>Frecuencia: Anual — Referencia: Procedimiento GC-PR-001</em></div>' +
    '<button id="kair-es-reeval-save-btn" class="kair-btn kair-btn--primary">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>' +
    'Guardar Reevaluación' +
    '</button>' +
    '</div>' +
    '</div>' +
    '</div>';

  case 'noconformidades':
    return '<button id="kair-es-nc-new-btn" style="display:none;"></button>' +
    '<div class="kair-es-nc-filters">' +
    '<div class="kair-form-group" style="min-width:200px;"><input type="text" id="kair-es-nc-search" class="kair-input" placeholder="Buscar..."></div>' +
    '<div class="kair-es-nc-filters__status">' +
    '<button class="kair-es-nc-filters__status-btn kair-es-nc-filters__status-btn--active" data-estado="">Todas</button>' +
    '<button class="kair-es-nc-filters__status-btn" data-estado="ABIERTA">Abiertas</button>' +
    '<button class="kair-es-nc-filters__status-btn" data-estado="EN_SEGUIMIENTO">En seguimiento</button>' +
    '<button class="kair-es-nc-filters__status-btn" data-estado="CERRADA">Cerradas</button>' +
    '</div>' +
    '</div>' +
    '<div class="kair-card"><div class="kair-table-wrapper"><table class="kair-table kair-table--striped"><thead><tr><th>No.</th><th>Fecha</th><th>Asociado</th><th>Descripción</th><th>Estado</th><th>Responsable</th><th>Acciones</th></tr></thead><tbody id="kair-es-nc-tbody"><tr><td colspan="7" class="kair-table__empty">Cargando...</td></tr></tbody></table></div></div>' +
    this.getNCModal();

  case 'reportes':
    return '<div class="kair-es-nc-filters">' +
    '<div class="kair-form-group"><label class="kair-label" for="kair-es-report-tipo">Tipo de asociado</label>' +
    '<select id="kair-es-report-tipo" class="kair-select"><option value="">Todos</option><option value="PROVEEDOR">Proveedor</option><option value="CONTRATISTA">Contratista</option></select></div>' +
    '<div class="kair-form-group"><label class="kair-label" for="kair-es-report-estado">Clasificación</label>' +
    '<select id="kair-es-report-estado" class="kair-select"><option value="">Todas</option><option value="BUENO">Bueno</option><option value="REGULAR">Regular</option><option value="DEFICIENTE">Deficiente</option></select></div>' +
    '<div class="kair-form-group"><label class="kair-label" for="kair-es-report-desde">Desde</label>' +
    '<input type="date" id="kair-es-report-desde" class="kair-input"></div>' +
    '<div class="kair-form-group"><label class="kair-label" for="kair-es-report-hasta">Hasta</label>' +
    '<input type="date" id="kair-es-report-hasta" class="kair-input"></div>' +
    '</div>' +
    '<div id="kair-es-report-summary"></div>' +
    '<div id="kair-es-report-distribution"></div>' +
    '<div class="kair-card"><div class="kair-card__header"><span class="kair-card__title">Detalle de Evaluaciones</span>' +
    '<button id="kair-es-report-export" class="kair-btn kair-btn--secondary kair-btn--sm">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
    'Exportar' +
    '</button>' +
    '</div><div class="kair-table-wrapper"><table class="kair-table kair-table--striped"><thead><tr><th>Nombre</th><th>Tipo</th><th>Selección</th><th>Reevaluación</th><th>Tendencia</th><th>Clasificación</th><th>Fecha</th></tr></thead><tbody id="kair-es-report-tbody"><tr><td colspan="7" class="kair-table__empty">Cargando...</td></tr></tbody></table></div></div>' +
    '<div id="kair-es-report-criteria-chart" class="kair-card kair-mt-6"></div>';

  default:
    return '<p>Vista no encontrada</p>';
  }
};

EvaluacionSeleccionComponent.prototype.getRegistroModal = function () {
  return '<div id="kair-es-registro-modal" class="kair-modal-overlay">' +
  '<div class="kair-modal" style="max-width:750px;">' +
  '<div class="kair-modal__header"><span id="kair-es-registro-modal-title" class="kair-modal__title">Nuevo Asociado</span>' +
  '<button id="kair-es-registro-modal-close" class="kair-modal__close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
  '</div>' +
  '<div class="kair-modal__body"><div class="kair-form-grid">' +
  '<div class="kair-form-group"><label class="kair-label kair-label--required" for="kair-es-registro-tipo">Tipo de asociado</label><select id="kair-es-registro-tipo" class="kair-select"><option value="PROVEEDOR">Proveedor</option><option value="CONTRATISTA">Contratista</option></select></div>' +
  '<div class="kair-form-group"><label class="kair-label kair-label--required" for="kair-es-registro-nit">NIT / CC</label><input type="text" id="kair-es-registro-nit" class="kair-input" placeholder="Ej: 900123456-1"></div>' +
  '<div class="kair-form-group kair-form-group--full"><label class="kair-label kair-label--required" for="kair-es-registro-razon">Razón Social</label><input type="text" id="kair-es-registro-razon" class="kair-input" placeholder="Nombre completo o razón social"></div>' +
  '<div class="kair-form-group kair-form-group--full"><label class="kair-label kair-label--required" for="kair-es-registro-producto">Producto / Servicio</label><input type="text" id="kair-es-registro-producto" class="kair-input" placeholder="Descripción del producto o servicio"></div>' +
  '<div class="kair-form-group"><label class="kair-label" for="kair-es-registro-direccion">Dirección</label><input type="text" id="kair-es-registro-direccion" class="kair-input" placeholder="Dirección"></div>' +
  '<div class="kair-form-group"><label class="kair-label" for="kair-es-registro-telefono">Teléfono</label><input type="text" id="kair-es-registro-telefono" class="kair-input" placeholder="Teléfono"></div>' +
  '<div class="kair-form-group"><label class="kair-label" for="kair-es-registro-email">Correo Electrónico</label><input type="email" id="kair-es-registro-email" class="kair-input" placeholder="correo@ejemplo.com"></div>' +
  '<div class="kair-form-group"><label class="kair-label" for="kair-es-registro-contacto">Persona de Contacto</label><input type="text" id="kair-es-registro-contacto" class="kair-input" placeholder="Nombre del contacto"></div>' +
  '</div>' +
  '<div class="kair-form-group kair-form-group--full kair-mt-6"><label class="kair-label" style="margin-bottom:0.5rem;">Documentos Requeridos</label><div id="kair-es-registro-docs-grid"></div></div>' +
  '<div class="kair-form-group kair-form-group--full kair-mt-4"><label class="kair-label" for="kair-es-registro-observaciones">Notas / Observaciones</label><textarea id="kair-es-registro-observaciones" class="kair-textarea" rows="3" placeholder="Observaciones..."></textarea></div>' +
  '</div>' +
  '<div class="kair-modal__footer"><button id="kair-es-registro-cancel-btn" class="kair-btn kair-btn--secondary">Cancelar</button><button id="kair-es-registro-save-btn" class="kair-btn kair-btn--primary">Guardar Asociado</button></div>' +
  '</div></div>';
};

EvaluacionSeleccionComponent.prototype.getNCModal = function () {
  return '<div id="kair-es-nc-modal" class="kair-modal-overlay">' +
  '<div class="kair-modal" style="max-width:700px;">' +
  '<div class="kair-modal__header"><span class="kair-modal__title">Reportar No Conformidad</span>' +
  '<button id="kair-es-nc-modal-close" class="kair-modal__close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
  '</div>' +
  '<div class="kair-modal__body"><div class="kair-form-grid">' +
  '<div class="kair-form-group"><label class="kair-label kair-label--required" for="kair-es-nc-asociado">Asociado</label><select id="kair-es-nc-asociado" class="kair-select"><option value="">-- Seleccione --</option></select></div>' +
  '<div class="kair-form-group"><label class="kair-label kair-label--required" for="kair-es-nc-fecha">Fecha de detección</label><input type="date" id="kair-es-nc-fecha" class="kair-input"></div>' +
  '<div class="kair-form-group"><label class="kair-label kair-label--required" for="kair-es-nc-detectado">Detectado por</label><select id="kair-es-nc-detectado" class="kair-select"><option value="SST">SST</option><option value="COMPRAS">Compras</option><option value="USUARIO_FINAL">Usuario Final</option></select></div>' +
  '<div class="kair-form-group"><label class="kair-label kair-label--required" for="kair-es-nc-fecha-limite">Fecha límite</label><input type="date" id="kair-es-nc-fecha-limite" class="kair-input"></div>' +
  '<div class="kair-form-group kair-form-group--full"><label class="kair-label kair-label--required" for="kair-es-nc-descripcion">Descripción</label><textarea id="kair-es-nc-descripcion" class="kair-textarea" rows="3" placeholder="Describa la no conformidad..."></textarea></div>' +
  '<div class="kair-form-group kair-form-group--full"><label class="kair-label" for="kair-es-nc-plan">Plan de acción</label><textarea id="kair-es-nc-plan" class="kair-textarea" rows="3" placeholder="Acciones correctivas..."></textarea></div>' +
  '<div class="kair-form-group"><label class="kair-label kair-label--required" for="kair-es-nc-responsable">Responsable</label><input type="text" id="kair-es-nc-responsable" class="kair-input" placeholder="Nombre del responsable"></div>' +
  '<div class="kair-form-group"><label class="kair-label" for="kair-es-nc-observaciones">Observaciones</label><textarea id="kair-es-nc-observaciones" class="kair-textarea" rows="2" placeholder="Observaciones..."></textarea></div>' +
  '</div></div>' +
  '<div class="kair-modal__footer"><button id="kair-es-nc-cancel-btn" class="kair-btn kair-btn--secondary">Cancelar</button><button id="kair-es-nc-save-btn" class="kair-btn kair-btn--primary">Reportar NC</button></div>' +
  '</div></div>';
};

EvaluacionSeleccionComponent.prototype.initNavigation = function () {
  var self = this;

  this.container.querySelectorAll('.es-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var view = btn.getAttribute('data-view');
      self.navigate(view);
    });
  });

  var backBtn = this.container.querySelector('#btn-back-es');
  if (backBtn && this.backToModuleCallback) {
    backBtn.addEventListener('click', function () {
      self.backToModuleCallback();
    });
  }

  var actionRegistro = this.container.querySelector('#kair-es-action-registro');
  if (actionRegistro) {
    actionRegistro.addEventListener('click', function () {
      if (window.RegistroModuleES && typeof window.RegistroModuleES.openModal === 'function') {
        window.RegistroModuleES.openModal();
      }
    });
  }

  var actionNC = this.container.querySelector('#kair-es-action-nc');
  if (actionNC) {
    actionNC.addEventListener('click', function () {
      if (window.NoConformidadesModuleES && typeof window.NoConformidadesModuleES.openModal === 'function') {
        window.NoConformidadesModuleES.openModal();
      }
    });
  }
};

EvaluacionSeleccionComponent.prototype._viewLabels = {
  dashboard: 'Dashboard',
  registro: 'Registro',
  evaluacion: 'Evaluación',
  reevaluacion: 'Reevaluación',
  noconformidades: 'No Conformidades',
  reportes: 'Reportes'
};

EvaluacionSeleccionComponent.prototype.navigate = function (viewName) {
  var self = this;
  this.currentView = viewName;

  this.container.querySelectorAll('.es-tab').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
  });

  this.container.querySelectorAll('.kair-es-view').forEach(function (view) {
    view.classList.remove('kair-es-view--active');
  });
  var targetView = this.container.querySelector('#kair-es-view-' + viewName);
  if (targetView) targetView.classList.add('kair-es-view--active');

  var breadcrumb = this.container.querySelector('#kair-es-breadcrumb-active');
  if (breadcrumb) {
    breadcrumb.textContent = this._viewLabels[viewName] || viewName;
  }

  var actionRegistro = this.container.querySelector('#kair-es-action-registro');
  var actionNC = this.container.querySelector('#kair-es-action-nc');
  if (actionRegistro) actionRegistro.style.display = viewName === 'registro' ? '' : 'none';
  if (actionNC) actionNC.style.display = viewName === 'noconformidades' ? '' : 'none';

  setTimeout(function () {
    switch (viewName) {
    case 'dashboard':
      if (window.DashboardModuleES) window.DashboardModuleES.load();
      break;
    case 'registro':
      if (window.RegistroModuleES) window.RegistroModuleES.load();
      break;
    case 'evaluacion':
      if (window.EvaluacionModuleES) window.EvaluacionModuleES.load();
      break;
    case 'reevaluacion':
      if (window.ReevaluacionModuleES) window.ReevaluacionModuleES.load();
      break;
    case 'noconformidades':
      if (window.NoConformidadesModuleES) window.NoConformidadesModuleES.load();
      break;
    case 'reportes':
      if (window.ReportesModuleES) window.ReportesModuleES.load();
      break;
    }
  }, 50);
};

EvaluacionSeleccionComponent.prototype.updateHeaderContext = function () {
  var companyEl = this.container.querySelector('#kair-es-header-company');
  if (companyEl && this.currentCompany) {
    companyEl.textContent = this.currentCompany;
  }
};

EvaluacionSeleccionComponent.prototype.destroy = function () {
  this.container.innerHTML = '';
};

window.EvaluacionSeleccionComponent = EvaluacionSeleccionComponent;
})();
