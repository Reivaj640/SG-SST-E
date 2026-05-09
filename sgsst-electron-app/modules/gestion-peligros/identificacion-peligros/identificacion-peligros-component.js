/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
Componente principal — Type C Direct DOM con Header v2.0 Patrón 4
Constructor: (container, currentCompany, moduleName, submoduleTitle, backToModuleCallback)
========================================================================== */
(function () {
'use strict';

var VIEWS = [
  { key: 'matriz',       label: 'Matriz',         icon: 'bi-table' },
  { key: 'priorizacion', label: 'Priorización',   icon: 'bi-bar-chart-steps' },
  { key: 'indicadores',  label: 'Indicadores KPI', icon: 'bi-speedometer2' }
];

function IdentificacionPeligrosComponent(container, currentCompany, moduleName, submoduleTitle, backToModuleCallback) {
  this.container = container;
  this.currentCompany = currentCompany;
  this.moduleName = moduleName;
  this.submoduleTitle = submoduleTitle;
  this.backToModuleCallback = backToModuleCallback;
  this.currentView = 'matriz';
  this.cssLoaded = false;
}

IdentificacionPeligrosComponent.prototype.render = function () {
  var self = this;
  this.container.innerHTML = '';
  this._loadCSS(function () {
    self._renderUI();
    self._initNavigation();
    self._navigate('matriz');
    self._updateHeaderContext();
  });
};

IdentificacionPeligrosComponent.prototype.destroy = function () {
  if (window.MatrizView) MatrizView.destroy();
  if (window.PriorizacionView) PriorizacionView.destroy();
  if (window.IndicadoresView) IndicadoresView.destroy();
  this.container.innerHTML = '';
};

IdentificacionPeligrosComponent.prototype._loadCSS = function (callback) {
  var cssHref = 'modules/gestion-peligros/identificacion-peligros/identificacion-peligros.css';
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

IdentificacionPeligrosComponent.prototype._renderUI = function () {
  var self = this;

  var tabsHtml = VIEWS.map(function (v) {
    return '<button class="kair-header__tab' + (v.key === 'matriz' ? ' kair-header__tab--active' : '') + '" data-view="' + v.key + '">' +
      '<i class="bi ' + v.icon + '"></i> ' + v.label +
      '</button>';
  }).join('');

  var headerHtml =
    '<header class="kair-header">' +
    '<div class="kair-header__bar">' +
    '<button class="kair-header__back" id="kair-mp-btn-back" title="Volver">' +
    '<i class="bi bi-arrow-left"></i>' +
    '</button>' +
    '<h1 class="kair-header__title"><i class="bi bi-exclamation-triangle"></i> Identificación de Peligros</h1>' +
    '<div class="kair-header__right">' +
    '<button class="kair-header__action-btn" id="kair-mp-btn-import-xlsx" title="Importar matriz desde archivo Excel"><i class="bi bi-file-earmark-spreadsheet"></i> Importar XLSX</button>' +
    '<span class="kair-header__pill--section">4.1.2</span>' +
    '<span class="kair-header__company" id="kair-mp-header-company"><i class="bi bi-building"></i> <span></span></span>' +
    '</div>' +
    '</div>' +
    '<div class="kair-header__tabs" id="kair-mp-tabs">' +
    tabsHtml +
    '</div>' +
    '</header>';

  var viewsHtml = VIEWS.map(function (v) {
    var isActive = v.key === 'matriz';
    return '<div class="kair-mp-view' + (isActive ? ' kair-mp-view--active' : '') + '" id="kair-mp-view-' + v.key + '" style="display:' + (isActive ? 'flex' : 'none') + ';flex:1;flex-direction:column;overflow:hidden;">' +
      self._getViewSkeleton(v.key) +
      '</div>';
  }).join('');

  var modalHtml =
    '<div class="kair-mp-modal-overlay" id="kair-mp-modal">' +
    '<div class="kair-mp-modal">' +
    '<div class="kair-mp-modal__header">' +
    '<h3 class="kair-mp-modal__title" id="kair-mp-modal-title">Modal</h3>' +
    '<button class="kair-mp-modal__close" id="kair-mp-modal-close"><i class="bi bi-x-lg"></i></button>' +
    '</div>' +
    '<div class="kair-mp-modal__body" id="kair-mp-modal-body"></div>' +
    '<div class="kair-mp-modal__footer" id="kair-mp-modal-footer">' +
    '<button class="kair-mp-btn kair-mp-btn--ghost" id="kair-mp-modal-cancel">Cancelar</button>' +
    '<button class="kair-mp-btn kair-mp-btn--primary" id="kair-mp-modal-confirm">Confirmar</button>' +
    '</div>' +
    '</div>' +
    '</div>';

  var wrapper = document.createElement('div');
  wrapper.className = 'kair-mp-wrapper';
  wrapper.innerHTML =
    headerHtml +
    '<div class="kair-mp-views-container" style="flex:1;display:flex;flex-direction:column;overflow:hidden;">' +
    viewsHtml +
    '</div>' +
    modalHtml;

  this.container.appendChild(wrapper);
  this._bindModalEvents();
};

IdentificacionPeligrosComponent.prototype._getViewSkeleton = function (viewKey) {
  switch (viewKey) {
    case 'matriz':
      return '<div id="kair-mp-matriz-content" class="kair-mp-matriz">' +
        '<div class="kair-mp-loading"><div class="kair-mp-spinner"></div><p>Cargando matriz...</p></div>' +
        '</div>';

    case 'priorizacion':
      return '<div id="kair-mp-priorizacion-content" class="kair-mp-prior">' +
        '<div class="kair-mp-loading"><div class="kair-mp-spinner"></div><p>Cargando priorización...</p></div>' +
        '</div>';

    case 'indicadores':
      return '<div id="kair-mp-indicadores-content" class="kair-mp-ind">' +
        '<div class="kair-mp-loading"><div class="kair-mp-spinner"></div><p>Cargando indicadores...</p></div>' +
        '</div>';

    default:
      return '<div class="kair-mp-matriz__empty"><i class="bi bi-inbox"></i><h3>Vista no disponible</h3></div>';
  }
};

IdentificacionPeligrosComponent.prototype._initNavigation = function () {
  var self = this;
  var wrapper = this.container.querySelector('.kair-mp-wrapper');
  if (!wrapper) return;

  var backBtn = wrapper.querySelector('#kair-mp-btn-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      if (typeof self.backToModuleCallback === 'function') {
        self.backToModuleCallback();
      }
    });
  }

  var importBtn = wrapper.querySelector('#kair-mp-btn-import-xlsx');
  if (importBtn) {
    importBtn.addEventListener('click', function () {
      self._handleImportXlsx();
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

IdentificacionPeligrosComponent.prototype._navigate = function (viewKey) {
  this.currentView = viewKey;
  var wrapper = this.container.querySelector('.kair-mp-wrapper');
  if (!wrapper) return;

  var tabs = wrapper.querySelectorAll('.kair-header__tab');
  tabs.forEach(function (tab) {
    if (tab.getAttribute('data-view') === viewKey) {
      tab.classList.add('kair-header__tab--active');
    } else {
      tab.classList.remove('kair-header__tab--active');
    }
  });

  var views = wrapper.querySelectorAll('.kair-mp-view');
  views.forEach(function (view) {
    if (view.id === 'kair-mp-view-' + viewKey) {
      view.style.display = 'flex';
      view.classList.add('kair-mp-view--active');
    } else {
      view.style.display = 'none';
      view.classList.remove('kair-mp-view--active');
    }
  });

  setTimeout(function () {
    switch (viewKey) {
      case 'matriz':
        if (window.MatrizView) MatrizView.load(this.currentCompany);
        break;
      case 'priorizacion':
        if (window.PriorizacionView) PriorizacionView.load(this.currentCompany);
        break;
      case 'indicadores':
        if (window.IndicadoresView) IndicadoresView.load(this.currentCompany);
        break;
    }
  }.bind(this), 50);

  this._updateHeaderContext();
};

IdentificacionPeligrosComponent.prototype._handleImportXlsx = function () {
  var self = this;
  var btn = this.container.querySelector('#kair-mp-btn-import-xlsx');
  if (btn) { btn.disabled = true; btn.classList.add('kair-header__action-btn--loading'); }

  IdentificacionPeligrosService.discoverXlsx(this.currentCompany).then(function (result) {
    if (!result.success) {
      self._showImportError(result.error ? result.error.message : 'Error al buscar archivo');
      if (btn) { btn.disabled = false; btn.classList.remove('kair-header__action-btn--loading'); }
      return;
    }
    if (!result.data.found) {
      self._showModal(
        'Importar XLSX',
        '<div class="kair-mp-import-msg"><i class="bi bi-info-circle"></i><p>No se encontró archivo .xlsx en la carpeta <strong>4.1.2</strong> de la empresa.</p><p class="kair-mp-import-msg__hint">Asegúrese de que el archivo esté en la carpeta <em>4.1.2 Identificación de Peligros</em> dentro de los datos de la empresa.</p></div>',
        null
      );
      if (btn) { btn.disabled = false; btn.classList.remove('kair-header__action-btn--loading'); }
      return;
    }
    var fileName = result.data.fileName || 'archivo.xlsx';
    var filePath = result.data.filePath;
    self._showModal(
      'Importar Matriz de Peligros',
      '<div class="kair-mp-import-msg"><i class="bi bi-file-earmark-spreadsheet"></i><p>Se encontró: <strong>' + fileName + '</strong></p><p class="kair-mp-import-msg__hint">Los peligros se <em>agregarán</em> a la matriz existente. No se eliminarán datos actuales.</p></div>',
      function () {
        self._executeImport(filePath, btn);
      }
    );
    if (btn) { btn.disabled = false; btn.classList.remove('kair-header__action-btn--loading'); }
  }).catch(function (e) {
    self._showImportError(e.message || 'Error inesperado');
    if (btn) { btn.disabled = false; btn.classList.remove('kair-header__action-btn--loading'); }
  });
};

IdentificacionPeligrosComponent.prototype._executeImport = function (filePath, btn) {
  var self = this;
  var wrapper = this.container.querySelector('.kair-mp-wrapper');
  var modal = wrapper ? wrapper.querySelector('#kair-mp-modal') : null;
  if (modal) modal.classList.remove('visible');

  if (btn) { btn.disabled = true; btn.classList.add('kair-header__action-btn--loading'); }

  IdentificacionPeligrosService.importXlsx(this.currentCompany, filePath).then(function (result) {
    if (btn) { btn.disabled = false; btn.classList.remove('kair-header__action-btn--loading'); }
    if (!result.success) {
      self._showImportError(result.error ? result.error.message : 'Error al importar');
      return;
    }
    var d = result.data;
    var msg = '<strong>' + d.rowsImported + '</strong> peligros importados';
    if (d.sedesCreated) msg += ' · ' + d.sedesCreated + ' sedes';
    if (d.procesosCreated) msg += ' · ' + d.procesosCreated + ' procesos';
    if (d.cargosCreated) msg += ' · ' + d.cargosCreated + ' cargos';
    IdentificacionPeligrosService.toast(msg, 'success');
    self._refreshAllViews();
  }).catch(function (e) {
    if (btn) { btn.disabled = false; btn.classList.remove('kair-header__action-btn--loading'); }
    self._showImportError(e.message || 'Error inesperado');
  });
};

IdentificacionPeligrosComponent.prototype._refreshAllViews = function () {
  if (window.MatrizView) MatrizView.refresh();
  if (window.PriorizacionView) PriorizacionView.refresh();
  if (window.IndicadoresView) IndicadoresView.refresh();
};

IdentificacionPeligrosComponent.prototype._showImportError = function (message) {
  this._showModal(
    'Error de Importación',
    '<div class="kair-mp-import-msg kair-mp-import-msg--error"><i class="bi bi-exclamation-triangle"></i><p>' + message + '</p></div>',
    null
  );
};

IdentificacionPeligrosComponent.prototype._updateHeaderContext = function () {
  var wrapper = this.container.querySelector('.kair-mp-wrapper');
  if (!wrapper) return;

  var companyEl = wrapper.querySelector('#kair-mp-header-company span');
  if (companyEl) {
    companyEl.textContent = this.currentCompany || '';
  }
};

IdentificacionPeligrosComponent.prototype._bindModalEvents = function () {
  var self = this;
  var wrapper = this.container.querySelector('.kair-mp-wrapper');
  if (!wrapper) return;

  var modal = wrapper.querySelector('#kair-mp-modal');
  var closeBtn = wrapper.querySelector('#kair-mp-modal-close');
  var cancelBtn = wrapper.querySelector('#kair-mp-modal-cancel');

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

IdentificacionPeligrosComponent.prototype._showModal = function (title, bodyHtml, onConfirm) {
  var wrapper = this.container.querySelector('.kair-mp-wrapper');
  if (!wrapper) return;

  var overlay = wrapper.querySelector('.kair-mp-modal-overlay');
  if (!overlay) return;

  var titleEl = overlay.querySelector('.kair-mp-modal__title');
  var bodyEl = overlay.querySelector('.kair-mp-modal__body');
  var confirmBtn = overlay.querySelector('#kair-mp-modal-confirm');
  var footerEl = overlay.querySelector('.kair-mp-modal__footer');

  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = bodyHtml;

  var newConfirm = confirmBtn.cloneNode(true);
  if (confirmBtn && confirmBtn.parentNode) {
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
  }
  newConfirm.id = 'kair-mp-modal-confirm';

  if (typeof onConfirm === 'function') {
    if (footerEl) footerEl.style.display = '';
    newConfirm.addEventListener('click', function () {
      onConfirm();
      overlay.classList.remove('visible');
    });
  } else {
    if (footerEl) footerEl.style.display = 'none';
  }

  overlay.classList.add('visible');
};

window.IdentificacionPeligrosComponent = IdentificacionPeligrosComponent;
})();
