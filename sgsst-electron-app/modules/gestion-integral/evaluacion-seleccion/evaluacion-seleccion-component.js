/* ==========================================================================
   K+AIR — Módulo 2.10.1 Evaluación y Selección de Proveedores y Contratistas
   Componente principal con navegación horizontal (tabs)
   ========================================================================== */

(function () {
  'use strict';

  function EvaluacionSeleccionComponent(container, moduleName, submoduleTitle, backToModuleCallback) {
    this.container = container;
    this.moduleName = moduleName;
    this.submoduleTitle = submoduleTitle;
    this.backToModuleCallback = backToModuleCallback;
    this.currentView = 'dashboard';
    this.cssLoaded = false;
  }

  EvaluacionSeleccionComponent.prototype.render = function () {
    var self = this;
    this.container.innerHTML = '';

    // Cargar CSS dinámicamente
    this.loadCSS(function () {
      self.renderUI();
      self.initNavigation();
      self.seedData();
      self.navigate('dashboard');
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
      { key: 'dashboard', label: 'Dashboard', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' },
      { key: 'registro', label: 'Registro', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
      { key: 'evaluacion', label: 'Evaluación', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' },
      { key: 'reevaluacion', label: 'Reevaluación', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>' },
      { key: 'noconformidades', label: 'No Conformidades', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' },
      { key: 'reportes', label: 'Reportes', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
    ];

    // Obtener contadores para badges
    var stats = null;
    try { stats = window.EvaluacionesServiceES.getStats(); } catch (e) { stats = null; }
    var ncCount = 0;
    try { var ncs = window.NoConformidadesServiceES.getAll(); ncCount = ncs.filter(function(nc) { return nc.estado !== 'CERRADA'; }).length; } catch (e) { ncCount = 0; }

    var navHtml = views.map(function (v) {
      var badge = '';
      if (v.key === 'noconformidades' && ncCount > 0) {
        badge = '<span class="kair-es-nav__badge">' + ncCount + '</span>';
      }
      return '<button class="kair-es-nav__item' + (this.currentView === v.key ? ' kair-es-nav__item--active' : '') + '" data-view="' + v.key + '">' +
        '<span class="kair-es-nav__item-icon">' + v.icon + '</span>' +
        '<span>' + v.label + '</span>' + badge + '</button>';
    }.bind(this)).join('');

    var viewsHtml = views.map(function (v) {
      var contentId = 'kair-es-view-' + v.key;
      var content = this.getViewContent(v.key);
      return '<div class="kair-es-view' + (this.currentView === v.key ? ' kair-es-view--active' : '') + '" id="' + contentId + '">' + content + '</div>';
    }.bind(this)).join('');

    this.container.innerHTML =
      '<div class="kair-es-wrapper">' +
        '<nav class="kair-es-nav">' + navHtml + '</nav>' +
        '<div class="kair-es-views-container">' + viewsHtml + '</div>' +
      '</div>';
  };

  EvaluacionSeleccionComponent.prototype.getViewContent = function (viewKey) {
    switch (viewKey) {
      case 'dashboard':
        return '<div class="kair-content__header">' +
            '<div><h1 class="kair-content__title">Dashboard</h1>' +
            '<p class="kair-content__subtitle">Resumen general del sistema de evaluación</p></div>' +
          '</div>' +
          '<div id="kair-es-dashboard-cards"></div>' +
          '<div id="kair-es-dashboard-alerts"></div>' +
          '<div id="kair-es-dashboard-charts"></div>' +
          '<div id="kair-es-dashboard-recent"></div>';

      case 'registro':
        return '<div class="kair-content__header">' +
            '<div><h1 class="kair-content__title">Registro de Asociados</h1>' +
            '<p class="kair-content__subtitle">Gestión de proveedores y contratistas</p></div>' +
            '<button id="kair-es-registro-new-btn" class="kair-btn kair-btn--primary">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
              'Nuevo Asociado' +
            '</button>' +
          '</div>' +
          '<div class="kair-es-nc-filters">' +
            '<div class="kair-form-group" style="min-width:200px;"><input type="text" id="kair-es-registro-search" class="kair-input" placeholder="Buscar por nombre, NIT..."></div>' +
            '<div class="kair-form-group" style="min-width:160px;"><select id="kair-es-registro-tipo-filter" class="kair-select"><option value="">Todos los tipos</option><option value="PROVEEDOR">Proveedores</option><option value="CONTRATISTA">Contratistas</option></select></div>' +
          '</div>' +
          '<div class="kair-card"><div class="kair-table-wrapper"><table class="kair-table kair-table--striped"><thead><tr><th>NIT / CC</th><th>Razón Social</th><th>Tipo</th><th>Producto / Servicio</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="kair-es-registro-tbody"><tr><td colspan="6" class="kair-table__empty">Cargando...</td></tr></tbody></table></div></div>' +
          this.getRegistroModal();

      case 'evaluacion':
        return '<div class="kair-content__header">' +
            '<div><h1 class="kair-content__title">Evaluación de Selección</h1>' +
            '<p class="kair-content__subtitle">Evaluación inicial de proveedores y contratistas</p></div>' +
          '</div>' +
          '<div class="kair-eval-ranges kair-mb-6">' +
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
        return '<div class="kair-content__header">' +
            '<div><h1 class="kair-content__title">Reevaluación Anual</h1>' +
            '<p class="kair-content__subtitle">Seguimiento periódico del desempeño de asociados</p></div>' +
          '</div>' +
          '<div class="kair-form-group" style="max-width:500px;"><label class="kair-label kair-label--required" for="kair-es-reeval-asociado">Seleccione el asociado a reevaluar</label>' +
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
        return '<div class="kair-content__header">' +
            '<div><h1 class="kair-content__title">No Conformidades</h1>' +
            '<p class="kair-content__subtitle">Gestión y seguimiento de no conformidades</p></div>' +
            '<button id="kair-es-nc-new-btn" class="kair-btn kair-btn--primary">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
              'Reportar NC' +
            '</button>' +
          '</div>' +
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
        return '<div class="kair-content__header">' +
            '<div><h1 class="kair-content__title">Reportes</h1>' +
            '<p class="kair-content__subtitle">Estadísticas y análisis de evaluaciones</p></div>' +
          '</div>' +
          '<div class="kair-es-nc-filters">' +
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
    this.container.querySelectorAll('.kair-es-nav__item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var view = btn.getAttribute('data-view');
        self.navigate(view);
      });
    });
  };

  EvaluacionSeleccionComponent.prototype.navigate = function (viewName) {
    var self = this;
    this.currentView = viewName;

    // Actualizar tabs
    this.container.querySelectorAll('.kair-es-nav__item').forEach(function (btn) {
      btn.classList.toggle('kair-es-nav__item--active', btn.getAttribute('data-view') === viewName);
    });

    // Actualizar vistas
    this.container.querySelectorAll('.kair-es-view').forEach(function (view) {
      view.classList.remove('kair-es-view--active');
    });
    var targetView = this.container.querySelector('#kair-es-view-' + viewName);
    if (targetView) targetView.classList.add('kair-es-view--active');

    // Cargar módulo correspondiente
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

  EvaluacionSeleccionComponent.prototype.destroy = function () {
    this.container.innerHTML = '';
  };

  window.EvaluacionSeleccionComponent = EvaluacionSeleccionComponent;
})();
