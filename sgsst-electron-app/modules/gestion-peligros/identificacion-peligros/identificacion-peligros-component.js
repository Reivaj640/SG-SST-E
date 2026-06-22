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
  /* F1: AbortController para evitar memory leak del listener al destruir/recrear
     el component. document.addEventListener persiste aunque destruyamos la instancia. */
  if (this._bannerAbortController) {
    try { this._bannerAbortController.abort(); } catch (e) {}
  }
  this._bannerAbortController = (typeof AbortController !== 'undefined') ? new AbortController() : null;

  this._loadCSS(function () {
    self._renderUI();
    self._initNavigation();
    self._navigate('matriz');
    self._updateHeaderContext();
    /* F1: poblar banner con stats iniciales tras el primer read */
    IdentificacionPeligrosService.stats(self.currentCompany).then(function (r) {
      if (r && r.success && r.data) self._updateBanner(r.data);
    }).catch(function () {});
  });

  /* F1: reaccionar a ediciones/add/delete/reset refrescando el banner.
     Usamos { signal } para que destroy() pueda abortar el listener limpiamente. */
  var handler = function () {
    /* Si el component ya fue destruido, self.container está vacío → no hacer nada */
    if (!self.container) return;
    IdentificacionPeligrosService.stats(self.currentCompany).then(function (r) {
      if (r && r.success && r.data) self._updateBanner(r.data);
    }).catch(function () {});
  };
  var opts = this._bannerAbortController ? { signal: this._bannerAbortController.signal } : { once: true };
  document.addEventListener('kair-mp:peligros-changed', handler, opts);
};

IdentificacionPeligrosComponent.prototype.destroy = function () {
  if (window.MatrizView) MatrizView.destroy();
  if (window.PriorizacionView) PriorizacionView.destroy();
  if (window.IndicadoresView) IndicadoresView.destroy();
  /* F1: abortar listener del banner para evitar memory leak */
  if (this._bannerAbortController) {
    try { this._bannerAbortController.abort(); } catch (e) {}
    this._bannerAbortController = null;
  }
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
    return '<button class="kair-mp-tab' + (v.key === 'matriz' ? ' kair-mp-tab--active' : '') + '" data-view="' + v.key + '">' +
      '<i class="bi ' + v.icon + '"></i> ' + v.label +
      '</button>';
  }).join('');

  var headerHtml =
    '<div class="k-section-card" style="padding:0; margin-bottom:1.5rem; flex-shrink:0; flex-grow:0;">' +
    '<div class="kair-mp-header-row">' +
    '<div class="kair-mp-header-left">' +
    '<i class="bi bi-exclamation-triangle kair-mp-header-icon"></i>' +
    '<div>' +
    '<h3 class="kair-mp-header-title">Identificación de Peligros</h3>' +
    '<p class="kair-mp-header-subtitle">Matriz de peligros, priorización e indicadores SG-SST.</p>' +
    '</div>' +
    '</div>' +
    '<div class="kair-mp-header-actions">' +
    '<span class="kair-mp-header-company" id="kair-mp-header-company"><i class="bi bi-building"></i> <span></span></span>' +
    '<div class="kair-mp-header-divider"></div>' +
    '<button id="kair-mp-btn-back" class="header-back-btn" title="Volver al módulo">' +
    '<i class="bi bi-arrow-left"></i> Volver' +
    '</button>' +
    '<button id="kair-mp-btn-import-xlsx" class="header-action--ghost" title="Importar matriz desde archivo Excel">' +
    '<i class="bi bi-file-earmark-spreadsheet"></i> Importar XLSX' +
    '</button>' +
    '<button id="kair-mp-btn-nuevo-peligro" class="header-action--primary" title="Crear nuevo peligro (editor completo en próxima fase)">' +
    '<i class="bi bi-plus-circle"></i> Nuevo peligro' +
    '</button>' +
    '<button id="kair-mp-btn-reset" class="header-action--ghost" title="Restablecer matriz a estado vacío">' +
    '<i class="bi bi-arrow-counterclockwise"></i> Restablecer' +
    '</button>' +
    '</div>' +
    '</div>' +
    '<div class="kair-mp-tabs" id="kair-mp-tabs">' +
    tabsHtml +
    '</div>' +
    '</div>';

  /* Banner de estado dinámico — 4 variantes (rojo/amarillo/azul/verde).
     Se recalcula desde updateBanner() tras read/import/reset/edit. */
  var bannerHtml =
    '<div class="kair-mp-banner kair-mp-banner--info" id="kair-mp-banner" role="status">' +
    '<i class="bi bi-info-circle-fill kair-mp-banner__icon"></i>' +
    '<div class="kair-mp-banner__body">' +
    '<strong class="kair-mp-banner__title">Cargando…</strong>' +
    '<span class="kair-mp-banner__msg">Leyendo estado actual de la matriz.</span>' +
    '</div>' +
    '</div>';

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
    bannerHtml +
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

  var nuevoBtn = wrapper.querySelector('#kair-mp-btn-nuevo-peligro');
  if (nuevoBtn) {
    nuevoBtn.addEventListener('click', function () {
      self._handleNuevoPeligro();
    });
  }

  var resetBtn = wrapper.querySelector('#kair-mp-btn-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      self._handleReset();
    });
  }

  var tabs = wrapper.querySelectorAll('.kair-mp-tab');
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

  var tabs = wrapper.querySelectorAll('.kair-mp-tab');
  tabs.forEach(function (tab) {
    if (tab.getAttribute('data-view') === viewKey) {
      tab.classList.add('kair-mp-tab--active');
    } else {
      tab.classList.remove('kair-mp-tab--active');
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
  if (btn) { btn.disabled = true; btn.classList.add('header-action--ghost--loading'); }

  IdentificacionPeligrosService.discoverXlsx(this.currentCompany).then(function (result) {
    if (!result.success) {
      self._showImportError(result.error ? result.error.message : 'Error al buscar archivo');
      if (btn) { btn.disabled = false; btn.classList.remove('header-action--ghost--loading'); }
      return;
    }
    if (!result.data.found) {
      self._showModal(
        'Importar XLSX',
        '<div class="kair-mp-import-msg"><i class="bi bi-info-circle"></i><p>No se encontró archivo .xlsx en la carpeta <strong>4.1.2</strong> de la empresa.</p><p class="kair-mp-import-msg__hint">Asegúrese de que el archivo esté en la carpeta <em>4.1.2 Identificación de Peligros</em> dentro de los datos de la empresa.</p></div>',
        null
      );
      if (btn) { btn.disabled = false; btn.classList.remove('header-action--ghost--loading'); }
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
    if (btn) { btn.disabled = false; btn.classList.remove('header-action--ghost--loading'); }
  }).catch(function (e) {
    self._showImportError(e.message || 'Error inesperado');
    if (btn) { btn.disabled = false; btn.classList.remove('header-action--ghost--loading'); }
  });
};

IdentificacionPeligrosComponent.prototype._executeImport = function (filePath, btn) {
  var self = this;
  var wrapper = this.container.querySelector('.kair-mp-wrapper');
  var modal = wrapper ? wrapper.querySelector('#kair-mp-modal') : null;
  if (modal) modal.classList.remove('visible');

  if (btn) { btn.disabled = true; btn.classList.add('header-action--ghost--loading'); }

  IdentificacionPeligrosService.importXlsx(this.currentCompany, filePath).then(function (result) {
    if (btn) { btn.disabled = false; btn.classList.remove('header-action--ghost--loading'); }
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
    if (btn) { btn.disabled = false; btn.classList.remove('header-action--ghost--loading'); }
    self._showImportError(e.message || 'Error inesperado');
  });
};

IdentificacionPeligrosComponent.prototype._refreshAllViews = function () {
  if (window.MatrizView) MatrizView.refresh();
  if (window.PriorizacionView) PriorizacionView.refresh();
  if (window.IndicadoresView) IndicadoresView.refresh();
  /* F1: recalcular banner tras cualquier operación de datos */
  var self = this;
  IdentificacionPeligrosService.stats(this.currentCompany).then(function (r) {
    if (r && r.success && r.data) self._updateBanner(r.data);
  }).catch(function () {});
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

/* F21.52 (2026-06-22) — F1: handler del botón "Nuevo peligro".
   Para F1 abre un modal stub anunciando que el editor completo (Patrón C)
   llega en F3. En F3 se reemplazará por window.open o un overlay fullscreen. */
IdentificacionPeligrosComponent.prototype._handleNuevoPeligro = function () {
  this._showModal(
    'Nuevo peligro — editor en construcción',
    '<div class="kair-mp-import-msg"><i class="bi bi-tools"></i><p>El editor completo con sidebar de 5 secciones + indicador de completitud <strong>X/5</strong> llega en la <strong>Fase 3 (F3)</strong> de este rediseño.</p>' +
    '<p class="kair-mp-import-msg__hint">Por ahora, agrega el peligro desde la Matriz: selecciona una sede → proceso → cargo → clic en <em>"Agregar peligro"</em>.</p></div>',
    null
  );
};

/* F1: handler del botón "Restablecer". Pide confirmación y vacía la matriz
   via IdentificacionPeligrosService.reset. */
IdentificacionPeligrosComponent.prototype._handleReset = function () {
  var self = this;
  this._showModal(
    'Restablecer matriz',
    '<div class="kair-mp-import-msg kair-mp-import-msg--error"><i class="bi bi-exclamation-triangle"></i>' +
    '<p>Vas a <strong>borrar todos los peligros, sedes, procesos y cargos</strong> de la matriz de esta empresa.</p>' +
    '<p class="kair-mp-import-msg__hint">La metadata (código de formato GI-FO-019, fechas) se conserva. Esta acción no se puede deshacer.</p></div>',
    function () { self._executeReset(); }
  );
};

IdentificacionPeligrosComponent.prototype._executeReset = function () {
  var self = this;
  var btn = this.container.querySelector('#kair-mp-btn-reset');
  if (btn) { btn.disabled = true; btn.classList.add('header-action--ghost--loading'); }

  IdentificacionPeligrosService.reset(this.currentCompany).then(function (result) {
    if (btn) { btn.disabled = false; btn.classList.remove('header-action--ghost--loading'); }
    if (!result || !result.success) {
      IdentificacionPeligrosService.toast(
        'Error al restablecer: ' + (result && result.error && result.error.message || 'desconocido'),
        'error'
      );
      return;
    }
    IdentificacionPeligrosService.toast('Matriz restablecida', 'success');
    /* Refrescar banner con los nuevos stats + las 3 vistas */
    if (result.data && result.data.stats) self._updateBanner(result.data.stats);
    self._refreshAllViews();
  }).catch(function (e) {
    if (btn) { btn.disabled = false; btn.classList.remove('header-action--ghost--loading'); }
    IdentificacionPeligrosService.toast('Error inesperado al restablecer: ' + (e.message || ''), 'error');
  });
};

/* F1: banner dinámico — recalcula la variante desde stats.porAcept.
   4 variantes (doc §9):
     danger  = hay Nivel V (Nivel I del doc — peor)
     warning = hay Nivel IV o III (Nivel II del doc — alto)
     success = todo en I/II (aceptable)
     info    = sin datos */
IdentificacionPeligrosComponent.prototype._updateBanner = function (stats) {
  var bannerEl = this.container.querySelector('#kair-mp-banner');
  if (!bannerEl) return;
  var iconEl = bannerEl.querySelector('.kair-mp-banner__icon');
  var titleEl = bannerEl.querySelector('.kair-mp-banner__title');
  var msgEl = bannerEl.querySelector('.kair-mp-banner__msg');

  var variant = 'info';
  var icon = 'bi-info-circle-fill';
  var title = 'Sin datos aún';
  var msg = 'Importe la matriz desde Excel o agregue peligros para empezar.';

  if (stats && (stats.total || 0) > 0) {
    var pa = stats.porAcept || {};
    var v = pa.V || 0, iv = pa.IV || 0, iii = pa.III || 0, ii = pa.II || 0, i = pa.I || 0;
    if (v > 0) {
      variant = 'danger';
      icon = 'bi-exclamation-octagon-fill';
      title = 'Nivel I — No aceptable';
      msg = v + ' peligro(s) en Nivel V (peor nivel). Requiere intervención inmediata.';
    } else if (iv > 0) {
      variant = 'warning';
      icon = 'bi-exclamation-triangle-fill';
      title = 'Nivel II — Alto';
      msg = iv + ' peligro(s) en Nivel IV. Implementar controles específicos.';
    } else if (iii > 0) {
      variant = 'warning';
      icon = 'bi-exclamation-triangle-fill';
      title = 'Nivel III — Inaceptable nivel 1';
      msg = iii + ' peligro(s) en Nivel III. Tomar medidas correctivas.';
    } else {
      variant = 'success';
      icon = 'bi-check-circle-fill';
      title = 'Riesgo controlado';
      msg = (i + ii) + ' peligro(s) en niveles aceptables (I-II). Sin riesgos altos.';
    }
  }

  bannerEl.className = 'kair-mp-banner kair-mp-banner--' + variant;
  if (iconEl) iconEl.className = 'bi ' + icon + ' kair-mp-banner__icon';
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = msg;
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
