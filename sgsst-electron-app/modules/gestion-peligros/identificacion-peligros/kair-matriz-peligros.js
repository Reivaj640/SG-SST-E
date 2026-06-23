/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
entry.js — Orquestador. Expone window.KairMatrizPeligros
Constructor: (container, currentCompany, moduleName, submoduleTitle, backToModuleCallback)
Método público: render() — alias de _render() para compatibilidad con createComponentSafely

Vistas soportadas: 'matriz' | 'indicadores' | 'priorizacion' | 'editor'
La vista 'editor' monta el editor seccionado de 5 secciones (Nuevo/Editar
peligro) en lugar del modal legacy. Se accede vía botón "Nuevo peligro" del
header o vía evento `km:open-editor` desde la vista Matriz (editar existente).
========================================================================== */
(function (global) {
  'use strict';
  var KM = global.KM;
  var Header = global.KMHeader;
  var Matriz = global.KMMatrizView;
  var Indicadores = global.KMIndicadoresView;
  var Priorizacion = global.KMPriorizacionView;
  var Editor = global.KMEditor;
  var Service = global.KMService;

  var VIEWS = ['matriz', 'indicadores', 'priorizacion'];

  function KairMatrizPeligros(container, currentCompany, moduleName, submoduleTitle, backToModuleCallback) {
    this.container = container;
    this.currentCompany = currentCompany || '';
    this.moduleName = moduleName || 'Gestión de Peligros y Riesgos';
    this.submoduleTitle = submoduleTitle || '4.1.2 Identificación de Peligros';
    this.backToModuleCallback = backToModuleCallback || function () {};
    this.currentView = 'matriz';
    this._editorSession = null; /* payload pendiente al abrir editor (mode/data/cargoId) */
    this._abortController = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    this.render();
    this._bindGlobalEvents();
  }

  KairMatrizPeligros.prototype.render = function () {
    var self = this;
    this.container.innerHTML = '';
    if (this._abortController) { try { this._abortController.abort(); } catch (e) {} }
    this._abortController = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    /* Si el editor estaba montado, destruirlo */
    if (Editor && Editor.destroy) Editor.destroy();

    var wrapper = document.createElement('div');
    wrapper.className = 'km-wrapper';

    // Header estándar K+AIR v2.0 — UNA sola card (header + tabs juntos)
    var headerEl = document.createElement('div');
    headerEl.innerHTML = Header.render({ currentView: this.currentView, company: this.currentCompany });
    if (headerEl.firstChild) wrapper.appendChild(headerEl.firstChild);

    // Views (incluye 'editor' para la vista seccionada de Nuevo/Editar peligro)
    var viewsEl = document.createElement('div');
    viewsEl.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;';
    viewsEl.innerHTML =
      '<div id="km-view-matriz" class="km-view km-view--active"></div>' +
      '<div id="km-view-indicadores" class="km-view"></div>' +
      '<div id="km-view-priorizacion" class="km-view"></div>' +
      '<div id="km-view-editor" class="km-view"></div>';
    wrapper.appendChild(viewsEl);

    this.container.appendChild(wrapper);
    this._bindHeader();
    this._showActiveView();
    KM.log('PELIGROS', 'RENDER', 'SUCCESS', 'view=' + this.currentView);
  };

  KairMatrizPeligros.prototype._bindHeader = function () {
    var self = this;
    var wrapper = this.container.querySelector('.km-wrapper');
    if (!wrapper) return;
    Header.bindEvents(wrapper, {
      onBack: function () { if (typeof self.backToModuleCallback === 'function') self.backToModuleCallback(); },
      onBackToMatriz: function () { self._closeEditor(); },
      onView: function (viewKey) { self._navigate(viewKey); },
      onContext: function () { self._rotateView(); },
      onAction: function (action) { self._handleAction(action); }
    });
  };

  KairMatrizPeligros.prototype._bindGlobalEvents = function () {
    var self = this;
    var opts = this._abortController ? { signal: this._abortController.signal } : { once: true };
    document.addEventListener('km:open-editor', function (e) {
      if (!self.container) return;
      var d = e.detail || {};
      self._openEditor({
        companyName: self.currentCompany,
        mode: d.mode || 'new',
        cargoId: d.cargoId || null,
        data: d.data || {}
      });
    }, opts);
    document.addEventListener('km:close-editor', function () {
      if (self.currentView === 'editor') self._closeEditor();
    }, opts);
    document.addEventListener('km:peligros-changed', function () {
      if (self.currentView === 'matriz') Matriz.refresh();
      else if (self.currentView === 'indicadores') Indicadores.refresh();
      else if (self.currentView === 'priorizacion') Priorizacion.refresh();
      /* Si el editor está abierto, refrescar la matriz en background por si
         cambió la lista de sedes/procesos/cargos */
      if (self.currentView === 'editor' && Editor && Editor.refresh) Editor.refresh();
    }, opts);
  };

  KairMatrizPeligros.prototype._navigate = function (viewKey) {
    this.currentView = viewKey;
    var wrapper = this.container.querySelector('.km-wrapper');
    if (!wrapper) return;
    var headerOpts = { currentView: this.currentView, company: this.currentCompany };
    if (viewKey === 'editor' && this._editorSession) {
      headerOpts.editorMode = this._editorSession.mode || 'new';
      headerOpts.editorPeligroId = (this._editorSession.data && this._editorSession.data.id) || '';
    }
    var newHeader = document.createElement('div');
    newHeader.innerHTML = Header.render(headerOpts);
    var oldCard = wrapper.querySelector('.km-header-card');
    if (oldCard) oldCard.replaceWith(newHeader.firstChild);
    else wrapper.insertBefore(newHeader.firstChild, wrapper.firstChild);
    this._bindHeader();
    this._showActiveView();
  };

  KairMatrizPeligros.prototype._rotateView = function () {
    var idx = VIEWS.indexOf(this.currentView);
    if (idx < 0) idx = 0;
    this._navigate(VIEWS[(idx + 1) % VIEWS.length]);
  };

  KairMatrizPeligros.prototype._showActiveView = function () {
    var self = this;
    var allViews = VIEWS.concat(['editor']);
    allViews.forEach(function (v) {
      var el = self.container.querySelector('#km-view-' + v);
      if (el) el.classList.toggle('km-view--active', v === self.currentView);
    });
    if (this.currentView === 'matriz') Matriz.load(this.currentCompany);
    if (this.currentView === 'indicadores') Indicadores.load(this.currentCompany);
    if (this.currentView === 'priorizacion') Priorizacion.load(this.currentCompany);
    if (this.currentView === 'editor') this._mountEditor();
  };

  KairMatrizPeligros.prototype._openEditor = function (opts) {
    /* Guardar payload y cambiar a vista editor */
    this._editorSession = {
      mode: opts.mode || 'new',
      data: opts.data || {},
      cargoId: opts.cargoId || null
    };
    this._navigate('editor');
  };

  KairMatrizPeligros.prototype._mountEditor = function () {
    if (!Editor || typeof Editor.render !== 'function') return;
    var container = this.container.querySelector('#km-view-editor');
    if (!container) return;
    var session = this._editorSession || { mode: 'new', data: {} };
    var self = this;
    Editor.render(container, {
      companyName: this.currentCompany,
      mode: session.mode,
      data: session.data,
      onSaved: function () { self._closeEditor(); },
      onCancel: function () { self._closeEditor(); }
    });
  };

  KairMatrizPeligros.prototype._closeEditor = function () {
    if (Editor && Editor.destroy) Editor.destroy();
    this._editorSession = null;
    this._navigate('matriz');
  };

  KairMatrizPeligros.prototype._handleAction = function (action) {
    var self = this;
    if (action === 'new-peligro') {
      /* Abrir la vista editor en modo 'new' (sin cargoId preseleccionado;
         el usuario elige sede → proceso → cargo en la sección 1) */
      this._openEditor({
        companyName: this.currentCompany,
        mode: 'new',
        data: {},
        cargoId: null
      });
      return;
    }
    if (action === 'export') {
      KM.notify('Función no disponible', 'Exportar Excel está en desarrollo', 'info');
      return;
    }
    if (action === 'reset') {
      KM.modal({
        title: 'Restablecer matriz',
        body: '<p>Vas a <strong>borrar todos los peligros, sedes, procesos y cargos</strong> de la matriz de esta empresa.</p><p>Esta acción no se puede deshacer.</p>',
        danger: true,
        confirm: 'Restablecer',
        onConfirm: function () {
          Service.reset(self.currentCompany).then(function (r) {
            if (r && r.success) { KM.notify('Matriz restablecida', 'Todos los peligros fueron eliminados', 'success'); try { document.dispatchEvent(new CustomEvent('km:peligros-changed')); } catch (e) {} }
            else KM.notify('Error al restablecer', (r && r.error && r.error.message) || 'Error desconocido', 'error', 6000);
          });
        }
      });
    }
  };

  KairMatrizPeligros.prototype.destroy = function () {
    if (Matriz && Matriz.destroy) Matriz.destroy();
    if (Indicadores && Indicadores.destroy) Indicadores.destroy();
    if (Priorizacion && Priorizacion.destroy) Priorizacion.destroy();
    if (Editor && Editor.destroy) Editor.destroy();
    if (this._abortController) { try { this._abortController.abort(); } catch (e) {} }
    this.container.innerHTML = '';
  };

  global.KairMatrizPeligros = KairMatrizPeligros;
  KM.log('PELIGROS', 'INIT', 'SUCCESS', 'KairMatrizPeligros cargado');
})(window);
