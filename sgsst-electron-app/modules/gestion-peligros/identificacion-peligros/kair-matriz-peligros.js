/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
entry.js — Orquestador. Expone window.KairMatrizPeligros
Constructor: (container, currentCompany, moduleName, submoduleTitle, backToModuleCallback)
Método público: render() — alias de _render() para compatibilidad con createComponentSafely
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

  function KairMatrizPeligros(container, currentCompany, moduleName, submoduleTitle, backToModuleCallback) {
    this.container = container;
    this.currentCompany = currentCompany || '';
    this.moduleName = moduleName || 'Gestión de Peligros y Riesgos';
    this.submoduleTitle = submoduleTitle || '4.1.2 Identificación de Peligros';
    this.backToModuleCallback = backToModuleCallback || function () {};
    this.currentView = 'matriz';
    this._abortController = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    this.render();
    this._bindGlobalEvents();
  }

  KairMatrizPeligros.prototype.render = function () {
    var self = this;
    this.container.innerHTML = '';
    if (this._abortController) { try { this._abortController.abort(); } catch (e) {} }
    this._abortController = (typeof AbortController !== 'undefined') ? new AbortController() : null;

    var wrapper = document.createElement('div');
    wrapper.className = 'km-wrapper';

    // Header estándar K+AIR v2.0 — UNA sola card (header + tabs juntos)
    var headerEl = document.createElement('div');
    headerEl.innerHTML = Header.render({ currentView: this.currentView, company: this.currentCompany });
    if (headerEl.firstChild) wrapper.appendChild(headerEl.firstChild);

    // Views
    var viewsEl = document.createElement('div');
    viewsEl.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;';
    viewsEl.innerHTML =
      '<div id="km-view-matriz" class="km-view km-view--active"></div>' +
      '<div id="km-view-indicadores" class="km-view"></div>' +
      '<div id="km-view-priorizacion" class="km-view"></div>';
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
      d.companyName = self.currentCompany;
      self._openEditor(d);
    }, opts);
    document.addEventListener('km:peligros-changed', function () {
      if (self.currentView === 'matriz') Matriz.refresh();
      else if (self.currentView === 'indicadores') Indicadores.refresh();
      else if (self.currentView === 'priorizacion') Priorizacion.refresh();
    }, opts);
  };

  KairMatrizPeligros.prototype._navigate = function (viewKey) {
    this.currentView = viewKey;
    var wrapper = this.container.querySelector('.km-wrapper');
    if (!wrapper) return;
    /* Header ahora es UNA sola card (header + tabs juntos) */
    var newHeader = document.createElement('div');
    newHeader.innerHTML = Header.render({ currentView: this.currentView, company: this.currentCompany });
    var oldCard = wrapper.querySelector('.km-header-card');
    if (oldCard) oldCard.replaceWith(newHeader.firstChild);
    else wrapper.insertBefore(newHeader.firstChild, wrapper.firstChild);
    this._bindHeader();
    this._showActiveView();
  };

  KairMatrizPeligros.prototype._rotateView = function () {
    var order = ['matriz', 'indicadores', 'priorizacion'];
    var idx = order.indexOf(this.currentView);
    this._navigate(order[(idx + 1) % order.length]);
  };

  KairMatrizPeligros.prototype._showActiveView = function () {
    var self = this;
    ['matriz', 'indicadores', 'priorizacion'].forEach(function (v) {
      var el = self.container.querySelector('#km-view-' + v);
      if (el) el.classList.toggle('km-view--active', v === self.currentView);
    });
    if (this.currentView === 'matriz') Matriz.load(this.currentCompany);
    if (this.currentView === 'indicadores') Indicadores.load(this.currentCompany);
    if (this.currentView === 'priorizacion') Priorizacion.load(this.currentCompany);
  };

  KairMatrizPeligros.prototype._openEditor = function (args) {
    Editor.open({
      companyName: this.currentCompany,
      cargoId: args.cargoId || null,
      mode: args.mode || 'new',
      data: args.data || {},
      onSaved: function () { try { document.dispatchEvent(new CustomEvent('km:peligros-changed')); } catch (e) {} }
    });
  };

  KairMatrizPeligros.prototype._handleAction = function (action) {
    var self = this;
    if (action === 'new-peligro') {
      // Sin cargo activo en la nueva UI plana; pedir uno o usar el primero
      KM.modal({
        title: 'Nuevo peligro',
        body: '<p>Selecciona primero una sede → proceso → cargo en la vista Matriz. Por ahora puedes usar la función de importar XLSX para cargar peligros existentes.</p>',
        confirm: 'Entendido'
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
    if (Editor && Editor.close) Editor.close();
    if (this._abortController) { try { this._abortController.abort(); } catch (e) {} }
    this.container.innerHTML = '';
  };

  global.KairMatrizPeligros = KairMatrizPeligros;
  KM.log('PELIGROS', 'INIT', 'SUCCESS', 'KairMatrizPeligros cargado');
})(window);
