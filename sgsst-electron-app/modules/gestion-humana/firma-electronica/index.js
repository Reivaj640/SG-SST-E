/**
 * modules/gestion-humana/firma-electronica/index.js
 * I-103.A1.6 · Firma electrónica — Centro de control del proceso de firma por trabajador.
 *
 * Fase 1 (esta fase):
 *   - Tabla principal centrada en el TRABAJADOR (no en el documento).
 *   - Una fila por trabajador con estado agregado del proceso.
 *   - Buscador por nombre, cédula, correo o ID de solicitud.
 *   - Pills de filtros rápidos por estado del proceso.
 *   - Barra de progreso y desglose "X firmados · Y esperando · Z pendientes".
 *   - Modal de expediente como PLACEHOLDER (Fase 2).
 *
 * NO consulta firma-service en Fase 1. Solo lee datos locales de K+AIR
 * (gh_documentos, gh_personal) via los IPC ya existentes.
 *
 * Reglas:
 *   - No modifica firma-service, firma-bridge, preload ni la lógica A1.5.4-B.
 *   - Multi-empresa: el companyName viene del constructor (gestion-humana-home).
 *   - companyName se preserva y se pasa a IPCs.
 *
 * @param {HTMLElement} container  - Contenedor donde se monta el componente
 * @param {string}      companyName - Empresa activa (multiempresa)
 * @param {string}      moduleName  - "Gestión Humana"
 * @param {string}      subName     - "Firma electrónica"
 * @param {function}    onBack      - Callback para volver al home del módulo
 */
'use strict';

(function () {
  var COMPONENT_NAME = 'FirmaElectronicaComponent';

  // Estados principales del PROCESO del trabajador (no del documento individual).
  // Los estados técnicos (PENDING, OTP_PENDING, SIGNED, etc.) solo aparecen
  // dentro del expediente (Fase 2).
  var ESTADOS_PROCESO = {
    PENDIENTE:       'pendiente',
    EN_PREPARACION:  'en_preparacion',
    EN_PROCESO:      'en_proceso',
    COMPLETADO:      'completado',
    RECHAZADO:       'rechazado',
    VENCIDO:         'vencido',
    CANCELADO:       'cancelado',
    ERROR:           'error'
  };

  // Etiquetas humanas para cada estado
  var ESTADOS_LABELS = {
    pendiente:       'Pendiente',
    en_preparacion:  'En preparación',
    en_proceso:      'En proceso',
    completado:      'Completado',
    rechazado:       'Rechazado',
    vencido:         'Vencido',
    cancelado:       'Cancelado',
    error:           'Error'
  };

  // Rank de orden para la tabla
  var ESTADOS_ORDER = {
    en_proceso: 0, en_preparacion: 1, pendiente: 2,
    rechazado: 3, vencido: 4, cancelado: 5, error: 6,
    completado: 7
  };

  // I-102.2.G · Mapa de estados terminales de firma-service → estado persistente
  var _TRANSICION_FIRMA = {
    'SIGNED':                { estado: 'firmado',   toast: 'Documento firmado correctamente.',                                success: true  },
    'REJECTED':              { estado: 'rechazado', toast: 'El firmante rechazó el documento.',                                 success: false },
    'EXPIRED':               { estado: 'expirado',  toast: 'La solicitud de firma expiró.',                                    success: false },
    'CANCELLED':             { estado: 'anulado',   toast: 'La solicitud de firma fue cancelada.',                             success: false },
    'REVOKED':               { estado: 'anulado',   toast: 'La solicitud de firma fue revocada.',                              success: false },
    'OTP_LOCKED':            { estado: null,        toast: 'OTP bloqueado por intentos.',                                      success: false },
    'IDENTIFICATION_FAILED': { estado: null,        toast: 'Falló la identificación del firmante.',                             success: false }
  };

  // 7 tipos de documento (reutilizados de Documentos)
  var TIPOS = [
    { value: 'autorizacion_datos',      label: 'Autorización Datos Sensibles', color: '#174ea6', icon: 'fa-shield-halved' },
    { value: 'autorizacion_hojas_vida', label: 'Autorización Hojas de Vida',   color: '#28a745', icon: 'fa-id-card' },
    { value: 'actualizacion_datos',     label: 'Formato Actualización Datos',  color: '#0d9488', icon: 'fa-file-lines' },
    { value: 'induccion',               label: 'Inducción',                     color: '#5b2a86', icon: 'fa-book' },
    { value: 'contrato',                label: 'Contrato Laboral',             color: '#1d4ed8', icon: 'fa-file-contract' },
    { value: 'carta_examenes',          label: 'Carta Solicitud Exámenes',     color: '#be123c', icon: 'fa-flask' },
    { value: 'carta_cuenta_bancaria',   label: 'Carta Apertura Cuenta Nómina', color: '#0d9488', icon: 'fa-building-columns' }
  ];

  function _fmtBytes(b) {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
  }

  // HTML escape
  function _esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function FirmaElectronicaComponent(container, companyName, moduleName, subName, onBack) {
    this.container = container;
    this.companyName = companyName || null;
    this.moduleName = moduleName || 'Gestión Humana';
    this.subName = subName || 'Firma electrónica';
    this.onBack = typeof onBack === 'function' ? onBack : null;

    this._documentos = [];
    this._trabajadores = [];
    this._trabajadorById = {};
    this._procesosPorTrabajador = [];
    this._filtroEstado = 'todos';
    this._busqueda = '';
    this._cargando = false;
    this._toastTimer = null;
    this._escKeyHandler = null;
    this._templates = [];
    this._templateById = {};
    this._pollingInterval = null;
    this._pollingProcessed = {};
    this._firmaDoc = null;
    this._firmaTrab = null;
    this._firmaCtx = null;
    this._selectedTipo = null;
    this._selectedTemplateId = null;
  }

  FirmaElectronicaComponent.prototype.render = function () {
    var self = this;
    if (!self.container) return;
    self.container.innerHTML = self._getShellHtml();
    self._cacheRefs();
    self._setupListeners();
    self._load();
    self._startPolling();
  };

  FirmaElectronicaComponent.prototype._getShellHtml = function () {
    return [
      '<div class="fe-wrapper" id="fe-wrapper">',
      '  <div class="fe-search-section">',
      '    <div class="fe-search">',
      '      <i class="fas fa-search fe-search__icon"></i>',
      '      <input id="fe-search-input" class="fe-search__input" type="search"',
      '        placeholder="Buscar trabajador, cédula, correo o ID de solicitud (ej. 548905)"',
      '        autocomplete="off" spellcheck="false" />',
      '    </div>',
      '  </div>',
      '',
      '  <div class="fe-filters-section">',
      '    <div class="fe-filter-dropdown" id="fe-filter-dropdown">',
      '      <button id="fe-filtros-avanzados" class="fe-btn fe-btn--primary fe-btn--sm fe-filter-dropdown__toggle" type="button" aria-haspopup="listbox" aria-expanded="false">',
      '        <i class="fas fa-sliders"></i>',
      '        <span id="fe-filtros-label">Filtros: Todos</span>',
      '        <i class="fas fa-chevron-down fe-filter-dropdown__chevron"></i>',
      '      </button>',
      '      <div id="fe-filter-dropdown-menu" class="fe-filter-dropdown__menu" role="listbox" hidden>',
      '        <button class="fe-filter-option fe-filter-option--active" data-filter="todos" type="button" role="option">Todos</button>',
      '        <button class="fe-filter-option" data-filter="pendiente" type="button" role="option"><span class="fe-pill__dot fe-pill__dot--pendiente"></span> Pendientes</button>',
      '        <button class="fe-filter-option" data-filter="en_preparacion" type="button" role="option"><span class="fe-pill__dot fe-pill__dot--preparacion"></span> En preparación</button>',
      '        <button class="fe-filter-option" data-filter="en_proceso" type="button" role="option"><span class="fe-pill__dot fe-pill__dot--proceso"></span> En proceso</button>',
      '        <button class="fe-filter-option" data-filter="completado" type="button" role="option"><span class="fe-pill__dot fe-pill__dot--completado"></span> Completados</button>',
      '        <button class="fe-filter-option" data-filter="rechazado" type="button" role="option"><span class="fe-pill__dot fe-pill__dot--rechazado"></span> Rechazados</button>',
      '        <button class="fe-filter-option" data-filter="vencido" type="button" role="option"><span class="fe-pill__dot fe-pill__dot--vencido"></span> Vencidos</button>',
      '        <button class="fe-filter-option" data-filter="cancelado" type="button" role="option"><span class="fe-pill__dot fe-pill__dot--cancelado"></span> Cancelados</button>',
      '        <button class="fe-filter-option" data-filter="error" type="button" role="option"><span class="fe-pill__dot fe-pill__dot--error"></span> Errores</button>',
      '      </div>',
      '    </div>',
      '  </div>',
      '',
      '  <div class="fe-count-section">',
      '    <span class="fe-count" id="fe-count">Cargando…</span>',
      '  </div>',
      '',
      '  <div class="fe-table-section">',
      '    <table class="fe-table" id="fe-table">',
      '      <thead>',
      '        <tr>',
      '          <th class="fe-table__th fe-table__th--trabajador">Trabajador</th>',
      '          <th class="fe-table__th fe-table__th--cedula">Cédula</th>',
      '          <th class="fe-table__th fe-table__th--estado">Estado del proceso</th>',
      '          <th class="fe-table__th fe-table__th--solicitudes">Solicitudes</th>',
      '          <th class="fe-table__th fe-table__th--accion">Acción</th>',
      '        </tr>',
      '      </thead>',
      '      <tbody id="fe-tbody"></tbody>',
      '    </table>',
      '  </div>',
      '</div>',
      '',
      '<div id="fe-expediente-modal" class="fe-modal" hidden>',
      '  <div class="fe-modal__overlay" data-close-modal="true"></div>',
      '  <div class="fe-modal__panel" role="dialog" aria-labelledby="fe-expediente-title">',
      '    <header class="fe-modal__header">',
      '      <h3 id="fe-expediente-title" class="fe-modal__title">',
      '        <i class="fas fa-file-signature"></i> Firma electrónica — Expediente',
      '      </h3>',
      '      <button class="fe-modal__close" data-close-modal="true" type="button" aria-label="Cerrar">',
      '        <i class="fas fa-times"></i>',
      '      </button>',
      '    </header>',
      '    <div class="fe-modal__body" id="fe-expediente-body"></div>',
      '  </div>',
      '</div>',
      '',
      '<!-- ═══ MODAL ADMINISTRAR TEMPLATES ═══ -->',
      '<div id="fe-tpl-admin-modal" class="fe-modal" hidden>',
      '  <div class="fe-modal__overlay" data-close-modal="true"></div>',
      '  <div class="fe-modal__panel fe-modal__panel--admin" role="dialog">',
      '    <header class="fe-modal__header">',
      '      <h3 class="fe-modal__title"><i class="fas fa-folder-open"></i> Mis Templates</h3>',
      '      <button class="fe-modal__close" data-close-modal="true" type="button" aria-label="Cerrar"><i class="fas fa-times"></i></button>',
      '    </header>',
      '    <div class="fe-modal__body">',
      '      <div class="fe-tpl-admin-header">',
      '        <p class="fe-tpl-admin-header__text">Sube tus propios .docx o .pdf para usar al generar documentos.</p>',
      '        <button id="fe-tpl-subir" class="fe-btn fe-btn--primary" type="button"><i class="fas fa-cloud-upload-alt"></i> Subir Template</button>',
      '      </div>',
      '      <div id="fe-templates" class="fe-templates"></div>',
      '    </div>',
      '    <div class="fe-modal__footer">',
      '      <button class="fe-btn fe-btn--ghost" data-close-modal="true" type="button">Cerrar</button>',
      '    </div>',
      '  </div>',
      '</div>',
      '',
      '<!-- ═══ MODAL SUBIR TEMPLATE ═══ -->',
      '<div id="fe-tpl-upload-modal" class="fe-modal" hidden>',
      '  <div class="fe-modal__overlay" data-close-modal="true"></div>',
      '  <div class="fe-modal__panel fe-modal__panel--template" role="dialog">',
      '    <header class="fe-modal__header">',
      '      <h3 class="fe-modal__title"><i class="fas fa-cloud-upload-alt"></i> Subir Template</h3>',
      '      <button class="fe-modal__close" data-close-modal="true" type="button" aria-label="Cerrar"><i class="fas fa-times"></i></button>',
      '    </header>',
      '    <div class="fe-modal__body">',
      '      <div class="fe-field">',
      '        <label class="fe-field__label" for="fe-tpl-tipo">Tipo de documento <span class="fe-field__req">*</span></label>',
      '        <select id="fe-tpl-tipo" class="fe-field__select"></select>',
      '      </div>',
      '      <div class="fe-field">',
      '        <label class="fe-field__label" for="fe-tpl-nombre">Nombre del template <span class="fe-field__req">*</span></label>',
      '        <input id="fe-tpl-nombre" class="fe-field__input" type="text" placeholder="Ej: Contrato base 2026" />',
      '        <p class="fe-field__hint">Nombre legible para identificar este template.</p>',
      '      </div>',
      '      <p class="fe-tpl-helper"><i class="fas fa-info-circle"></i> Al confirmar, se abrirá el explorador de archivos para que elijas el .docx o .pdf.</p>',
      '    </div>',
      '    <div class="fe-modal__footer">',
      '      <button class="fe-btn fe-btn--ghost" data-close-modal="true" type="button">Cancelar</button>',
      '      <button id="fe-tpl-confirm" class="fe-btn fe-btn--primary" type="button">Seleccionar archivo...</button>',
      '    </div>',
      '  </div>',
      '</div>',
      '',
      '<!-- ═══ MODAL GENERAR DOCUMENTO ═══ -->',
      '<div id="fe-gen-modal" class="fe-modal" hidden>',
      '  <div class="fe-modal__overlay" data-close-modal="true"></div>',
      '  <div class="fe-modal__panel fe-modal__panel--generar" role="dialog">',
      '    <header class="fe-modal__header">',
      '      <h3 class="fe-modal__title"><i class="fas fa-plus-circle"></i> Generar Documento</h3>',
      '      <button class="fe-modal__close" data-close-modal="true" type="button" aria-label="Cerrar"><i class="fas fa-times"></i></button>',
      '    </header>',
      '    <div class="fe-modal__body">',
      '      <div class="fe-field">',
      '        <label class="fe-field__label">Trabajador</label>',
      '        <div id="fe-gen-trabajador-info" class="fe-firma-summary"></div>',
      '      </div>',
      '      <div class="fe-field">',
      '        <label class="fe-field__label">Tipo de documento <span class="fe-field__req">*</span></label>',
      '        <div id="fe-gen-tipos" class="fe-gen-tipos"></div>',
      '      </div>',
      '      <div class="fe-field" id="fe-gen-template-field" hidden>',
      '        <label class="fe-field__label" for="fe-gen-template">Template</label>',
      '        <select id="fe-gen-template" class="fe-field__select"></select>',
      '        <p class="fe-field__hint" id="fe-gen-template-hint"></p>',
      '      </div>',
      '    </div>',
      '    <div class="fe-modal__footer">',
      '      <button class="fe-btn fe-btn--ghost" data-close-modal="true" type="button">Cancelar</button>',
      '      <button id="fe-gen-confirm" class="fe-btn fe-btn--primary" type="button"><i class="fas fa-plus"></i> Generar</button>',
      '    </div>',
      '  </div>',
      '</div>',
      '',
      '<!-- ═══ MODAL ENVIAR A FIRMA ═══ -->',
      '<div id="fe-firma-modal" class="fe-modal" hidden>',
      '  <div class="fe-modal__overlay" data-close-firma-modal="true"></div>',
      '  <div class="fe-modal__panel fe-modal__panel--firma" role="dialog">',
      '    <header class="fe-modal__header">',
      '      <h3 class="fe-modal__title"><i class="fas fa-file-signature"></i> Enviar documento a firma</h3>',
      '      <button class="fe-modal__close" data-close-firma-modal="true" type="button" aria-label="Cerrar"><i class="fas fa-times"></i></button>',
      '    </header>',
      '    <div class="fe-modal__body">',
      '      <div class="fe-field">',
      '        <label class="fe-field__label">Documento</label>',
      '        <div id="fe-firma-doc-summary" class="fe-firma-summary"></div>',
      '      </div>',
      '      <div class="fe-field">',
      '        <label class="fe-field__label">Firmante</label>',
      '        <div id="fe-firma-trab-summary" class="fe-firma-summary"></div>',
      '      </div>',
      '      <div class="fe-field">',
      '        <label class="fe-field__label" for="fe-firma-correo">Correo del firmante <span class="fe-field__req">*</span></label>',
      '        <input id="fe-firma-correo" class="fe-field__input" type="email" placeholder="correo@empresa.com" />',
      '        <p class="fe-field__hint" id="fe-firma-correo-hint"></p>',
      '        <p class="fe-field__error" id="fe-firma-correo-error" hidden></p>',
      '      </div>',
      '      <div class="fe-field">',
      '        <label class="fe-firma-confirm">',
      '          <input id="fe-firma-confirmar" type="checkbox" />',
      '          <span>Confirmo que este documento será enviado a firma electrónica</span>',
      '        </label>',
      '      </div>',
      '    </div>',
      '    <div class="fe-modal__footer">',
      '      <button class="fe-btn fe-btn--ghost" data-close-firma-modal="true" type="button">Cancelar</button>',
      '      <button id="fe-firma-enviar" class="fe-btn fe-btn--primary" disabled type="button"><i class="fas fa-paper-plane"></i> Enviar a firma</button>',
      '    </div>',
      '  </div>',
      '</div>',
      '',
      '<!-- ═══ MODAL ÉXITO FIRMA ═══ -->',
      '<div id="fe-firma-success-modal" class="fe-modal" hidden>',
      '  <div class="fe-modal__overlay" data-close-success-modal="true"></div>',
      '  <div class="fe-modal__panel fe-modal__panel--success" role="dialog">',
      '    <header class="fe-modal__header fe-modal__header--success">',
      '      <h3 class="fe-modal__title"><i class="fas fa-check-circle"></i> Solicitud de firma creada</h3>',
      '      <button class="fe-modal__close" data-close-success-modal="true" type="button" aria-label="Cerrar"><i class="fas fa-times"></i></button>',
      '    </header>',
      '    <div class="fe-modal__body">',
      '      <div class="fe-field">',
      '        <label class="fe-field__label">ID de solicitud</label>',
      '        <div id="fe-success-id" class="fe-success-id"></div>',
      '      </div>',
      '      <div class="fe-field">',
      '        <label class="fe-field__label">Enlace único para el firmante</label>',
      '        <div class="fe-success-link">',
      '          <input id="fe-success-url" class="fe-success-link__input" type="text" readonly />',
      '          <button id="fe-success-copy" class="fe-btn fe-btn--ghost" type="button">Copiar</button>',
      '        </div>',
      '        <p class="fe-field__hint">El enlace vence en 24 horas.</p>',
      '      </div>',
      '      <div class="fe-field">',
      '        <label class="fe-field__label">Correo del firmante</label>',
      '        <input id="fe-success-correo" class="fe-field__input" type="text" readonly />',
      '        <p id="fe-success-feedback" class="fe-field__hint" hidden></p>',
      '      </div>',
      '    </div>',
      '    <div class="fe-modal__footer">',
      '      <button class="fe-btn fe-btn--ghost" data-close-success-modal="true" type="button">Listo</button>',
      '      <button id="fe-success-send" class="fe-btn fe-btn--primary" type="button"><i class="fas fa-paper-plane"></i> Enviar por correo</button>',
      '    </div>',
      '  </div>',
      '</div>',
      '',
      '<div id="fe-toast" class="fe-toast" hidden></div>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._cacheRefs = function () {
    this._searchInput = this.container.querySelector('#fe-search-input');
    this._filterDropdown = this.container.querySelector('#fe-filter-dropdown');
    this._filterDropdownToggle = this.container.querySelector('#fe-filtros-avanzados');
    this._filterDropdownMenu = this.container.querySelector('#fe-filter-dropdown-menu');
    this._filterLabel = this.container.querySelector('#fe-filtros-label');
    this._countEl = this.container.querySelector('#fe-count');
    this._tbody = this.container.querySelector('#fe-tbody');
    this._modal = this.container.querySelector('#fe-expediente-modal');
    this._modalBody = this.container.querySelector('#fe-expediente-body');
    this._toast = this.container.querySelector('#fe-toast');
  };

  // Etiqueta humana del filtro de estado del proceso.
  FirmaElectronicaComponent.prototype._FILTRO_LABELS = {
    todos: 'Todos',
    pendiente: 'Pendientes',
    en_preparacion: 'En preparación',
    en_proceso: 'En proceso',
    completado: 'Completados',
    rechazado: 'Rechazados',
    vencido: 'Vencidos',
    cancelado: 'Cancelados',
    error: 'Errores'
  };

  FirmaElectronicaComponent.prototype._actualizarFiltroLabel = function () {
    if (!this._filterLabel) return;
    var lbl = this._FILTRO_LABELS[this._filtroEstado] || 'Todos';
    this._filterLabel.textContent = 'Filtros: ' + lbl;
  };

  FirmaElectronicaComponent.prototype._setupListeners = function () {
    var self = this;

    // Buscador (con debounce de 120ms)
    if (self._searchInput) {
      var searchTimer = null;
      self._searchInput.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          self._busqueda = (self._searchInput.value || '').toLowerCase().trim();
          self._renderTabla();
        }, 120);
      });
    }

    // Dropdown de filtros (sustituye a los pills anteriores)
    if (self._filterDropdownToggle && self._filterDropdownMenu) {
      // Toggle al hacer click en el botón
      self._filterDropdownToggle.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var isOpen = !self._filterDropdownMenu.hidden;
        self._filterDropdownMenu.hidden = isOpen;
        self._filterDropdownToggle.setAttribute('aria-expanded', String(!isOpen));
        self._filterDropdown.classList.toggle('fe-filter-dropdown--open', !isOpen);
      });
      // Click en una opción: aplicar filtro + cerrar
      self._filterDropdownMenu.addEventListener('click', function (ev) {
        var btn = ev.target.closest('.fe-filter-option');
        if (!btn) return;
        ev.stopPropagation();
        var filter = btn.getAttribute('data-filter');
        if (!filter) return;
        self._filtroEstado = filter;
        // Marcar visualmente la opción activa
        var opts = self._filterDropdownMenu.querySelectorAll('.fe-filter-option');
        opts.forEach(function (o) { o.classList.remove('fe-filter-option--active'); });
        btn.classList.add('fe-filter-option--active');
        // Cerrar dropdown y refrescar
        self._filterDropdownMenu.hidden = true;
        self._filterDropdownToggle.setAttribute('aria-expanded', 'false');
        self._filterDropdown.classList.remove('fe-filter-dropdown--open');
        self._actualizarFiltroLabel();
        self._renderTabla();
      });
      // Click fuera del dropdown: cerrar
      document.addEventListener('click', function (ev) {
        if (self._filterDropdownMenu.hidden) return;
        if (self._filterDropdown && self._filterDropdown.contains(ev.target)) return;
        self._filterDropdownMenu.hidden = true;
        self._filterDropdownToggle.setAttribute('aria-expanded', 'false');
        self._filterDropdown.classList.remove('fe-filter-dropdown--open');
      });
      // ESC: cerrar también
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && !self._filterDropdownMenu.hidden) {
          self._filterDropdownMenu.hidden = true;
          self._filterDropdownToggle.setAttribute('aria-expanded', 'false');
          self._filterDropdown.classList.remove('fe-filter-dropdown--open');
        }
      });
    }

    // Click en botón "Ver" de la tabla (delegación)
    if (self._tbody) {
      self._tbody.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-action="ver-expediente"]');
        if (!btn) return;
        var tid = btn.getAttribute('data-trabajador-id');
        if (tid) self._abrirModalExpediente(tid);
      });
    }

    // Click en acciones del modal de expediente (delegación en el body del modal)
    if (self._modalBody) {
      self._modalBody.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-action]');
        if (!btn || !self._modal || self._modal.hidden) return;
        var action = btn.getAttribute('data-action');
        if (action === 'ver-expediente') return;
        if (btn.disabled) return;
        var srId = btn.getAttribute('data-sr-id') || '';
        var docId = btn.getAttribute('data-doc-id') || '';
        if (action === 'enviar-correo') {
          self._actionEnviarCorreo(srId);
        } else if (action === 'copiar-enlace') {
          self._actionCopiarEnlace(srId);
        } else if (action === 'ver-documento-firmado') {
          self._actionVerDocumentoFirmado(srId);
        } else if (action === 'descargar-constancia') {
          self._actionDescargarConstancia(srId);
        } else if (action === 'generar-documento') {
          self._openGenerarModal();
        } else if (action === 'firmar-electronico') {
          self._firmarElectronico(docId);
        } else if (action === 'descargar-documento') {
          self._descargarDocumento(docId);
        } else if (action === 'ver-documento') {
          self._verDocumento(docId);
        } else if (action === 'abrir-template') {
          self._abrirTemplate(btn.getAttribute('data-tpl-id'));
        } else if (action === 'eliminar-template') {
          self._eliminarTemplate(btn.getAttribute('data-tpl-id'));
        } else if (action === 'admin-templates') {
          self._openTemplatesAdminModal();
        } else if (action === 'subir-template') {
          self._openSubirTemplateModal();
        }
      });
    }

    // Modal: click en overlay o botón cerrar
    if (self._modal) {
      self._modal.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-close-modal="true"]')) {
          self._cerrarModal();
        }
      });
    }

    // Sub-modals close handlers
    ['fe-tpl-admin-modal', 'fe-tpl-upload-modal', 'fe-gen-modal', 'fe-firma-modal', 'fe-firma-success-modal'].forEach(function (id) {
      var el = self.container.querySelector('#' + id);
      if (el) {
        el.addEventListener('click', function (ev) {
          if (ev.target.closest('[data-close-modal="true"]') || ev.target.closest('[data-close-firma-modal="true"]') || ev.target.closest('[data-close-success-modal="true"]')) {
            el.hidden = true;
          }
        });
      }
    });

    // Escape para cerrar modales
    self._escKeyHandler = function (ev) {
      if (ev.key === 'Escape') {
        // Close sub-modals first, then main modal
        var subModals = ['fe-firma-success-modal', 'fe-firma-modal', 'fe-gen-modal', 'fe-tpl-upload-modal', 'fe-tpl-admin-modal'];
        for (var i = 0; i < subModals.length; i++) {
          var el = self.container && self.container.querySelector('#' + subModals[i]);
          if (el && !el.hidden) { el.hidden = true; return; }
        }
        if (self._modal && !self._modal.hidden) self._cerrarModal();
      }
    };
    document.addEventListener('keydown', self._escKeyHandler);
  };

  FirmaElectronicaComponent.prototype._load = async function () {
    var self = this;
    if (!window.electronAPI || !self.companyName) {
      if (self._countEl) self._countEl.textContent = 'Sin empresa activa';
      return;
    }
    self._cargando = true;
    try {
      var results = await Promise.all([
        window.electronAPI.ghListDocumentos({ companyName: self.companyName })
          .catch(function () { return { success: false }; }),
        window.electronAPI.ghListPersonal({ companyName: self.companyName })
          .catch(function () { return { success: false }; }),
        window.electronAPI.ghListTemplates({ companyName: self.companyName })
          .catch(function () { return { success: false }; }),
        // FASE 2 (A1.5.4-B) · bp-ids con contratación en_proceso.
        // Solo esos se muestran como "Pendiente" en la tabla cuando no
        // tienen documentos aún. Esto evita que los 754 trabajadores sin
        // contratacion saturen la tabla.
        window.electronAPI.ghListTrabajadoresConContratacionActiva({ companyName: self.companyName })
          .catch(function () { return { success: false }; })
      ]);
      self._documentos = results[0].success ? (results[0].data.documentos || []) : [];
      self._trabajadores = results[1].success ? (results[1].data.personales || []) : [];
      self._templates = results[2].success ? (results[2].data.templates || []) : [];
      self._bpsConContratacionActiva = results[3].success && results[3].data ? (results[3].data.bpIds || []) : [];
      self._trabajadorById = {};
      self._trabajadores.forEach(function (t) {
        self._trabajadorById[t.id] = t;
      });
      self._templateById = {};
      self._templates.forEach(function (t) {
        self._templateById[t.id] = t;
      });
    } catch (e) {
      self._showToast('Error cargando datos: ' + e.message, 'error');
      self._documentos = [];
      self._trabajadores = [];
    }
    self._cargando = false;
    self._calcularProcesos();
    self._renderTabla();
  };

  /**
   * Agrupa los documentos por trabajador y calcula el estado agregado del proceso.
   * Reglas:
   *   - Solo aparecen trabajadores que tienen al menos 1 documento.
   *   - Estados del documento gh_documentos:
   *     - 'pendiente' (lowercase en BD): docs sin solicitud creada
   *     - 'esperando_firma' o 'esperando': docs con solicitud creada, en curso
   *     - 'firmado': docs finalizados
   *     - 'anulado': docs anulados (excluidos del conteo de "vivos")
   *   - Estado agregado del PROCESO (Fase 1: solo desde datos locales):
   *     - Sin firma en curso y sin firmas: Pendiente
   *     - Hay firmas en curso (esperando o firmado parcialmente): En proceso
   *     - Todos firmados: Completado
   *     - Hay docs con id_solicitudFirma que NO están esperando ni firmados
   *       (estado técnico desconocido sin consultar firma-service): En preparación
   */
  FirmaElectronicaComponent.prototype._calcularProcesos = function () {
    var self = this;
    var docsPorTrabajador = {};
    self._documentos.forEach(function (d) {
      var tid = d.trabajadorId;
      if (!tid) return;
      if (!docsPorTrabajador[tid]) docsPorTrabajador[tid] = [];
      docsPorTrabajador[tid].push(d);
    });

    var procesos = [];
    Object.keys(docsPorTrabajador).forEach(function (tid) {
      var trab = self._trabajadorById[tid];
      if (!trab) return; // Trabajador borrado, omitir
      var docs = docsPorTrabajador[tid];
      var proceso = self._calcularEstadoProceso(docs);
      proceso.trabajador = trab;
      proceso.trabajadorId = tid;
      proceso.documentos = docs;
      // Número de solicitudes distintas (id_solicitudFirma únicas)
      var idsSolicitudSet = {};
      docs.forEach(function (d) {
        if (d.idSolicitudFirma) idsSolicitudSet[d.idSolicitudFirma] = true;
      });
      proceso.numSolicitudes = Object.keys(idsSolicitudSet).length;
      procesos.push(proceso);
    });

    // FASE 2 (A1.5.4-B) · Incluir los bp-ids con contratacion en_proceso
    // que NO tienen documentos aún. Aparecen como "Pendiente" y permiten
    // que el admin entre a su expediente para generar los documentos
    // desde la pantalla de Firma Electrónica. Esto cubre el caso
    // de Nueva Contratación: el bp-id se crea/vincula con la contratación
    // (FASE 1) y queda visible inmediatamente en esta tabla. NO se
    // incluyen los 748 trabajadores que existen en base_personal sin
    // tener una contratación activa.
    var bpsConContratacion = self._bpsConContratacionActiva || [];
    var bpsConContratacionSet = {};
    bpsConContratacion.forEach(function (bpId) { bpsConContratacionSet[bpId] = true; });
    var trabajadoresConProceso = {};
    procesos.forEach(function (p) { trabajadoresConProceso[p.trabajadorId] = true; });
    self._trabajadores.forEach(function (t) {
      if (!t || !t.id) return;
      if (trabajadoresConProceso[t.id]) return; // ya tiene docs, no duplicar
      if (!bpsConContratacionSet[t.id]) return; // solo bp-ids con contratacion activa
      procesos.push({
        estado: ESTADOS_PROCESO.PENDIENTE,
        total: 0, firmados: 0, esperando: 0, pendientes: 0, anulados: 0,
        conSolicitud: 0, progreso: 0,
        trabajador: t,
        trabajadorId: t.id,
        documentos: [],
        numSolicitudes: 0
      });
    });

    // Orden: En proceso primero, luego Pendientes, luego Completados al final
    procesos.sort(function (a, b) {
      var ra = ESTADOS_ORDER[a.estado] !== undefined ? ESTADOS_ORDER[a.estado] : 99;
      var rb = ESTADOS_ORDER[b.estado] !== undefined ? ESTADOS_ORDER[b.estado] : 99;
      if (ra !== rb) return ra - rb;
      var na = (a.trabajador.nombres + ' ' + a.trabajador.apellidos).toLowerCase();
      var nb = (b.trabajador.nombres + ' ' + b.trabajador.apellidos).toLowerCase();
      return na.localeCompare(nb);
    });

    self._procesosPorTrabajador = procesos;
  };

  FirmaElectronicaComponent.prototype._calcularEstadoProceso = function (documentos) {
    var total = documentos.length;
    var firmados = 0, esperando = 0, pendientes = 0, anulados = 0;
    var conSolicitud = 0;

    documentos.forEach(function (d) {
      var est = (d.estado || '').toLowerCase();
      if (est === 'firmado') firmados++;
      else if (est === 'esperando_firma' || est === 'esperando') esperando++;
      else if (est === 'anulado') anulados++;
      else pendientes++; // incluye 'pendiente' y cualquier estado desconocido
      if (d.idSolicitudFirma) conSolicitud++;
    });

    var vivos = total - anulados;
    var progreso = vivos > 0 ? Math.round((firmados / vivos) * 100) : 0;

    var estado;
    if (total > 0 && firmados === total) {
      estado = ESTADOS_PROCESO.COMPLETADO;
    } else if (esperando > 0 || (firmados > 0 && firmados < total)) {
      estado = ESTADOS_PROCESO.EN_PROCESO;
    } else if (conSolicitud > 0 && esperando === 0 && firmados === 0) {
      // Hay solicitud creada pero ningún doc está esperando ni firmado.
      // Estado técnico desconocido sin consultar firma-service.
      // "En preparación" como estado provisional.
      estado = ESTADOS_PROCESO.EN_PREPARACION;
    } else {
      estado = ESTADOS_PROCESO.PENDIENTE;
    }

    return {
      estado: estado,
      total: total,
      firmados: firmados,
      esperando: esperando,
      pendientes: pendientes,
      anulados: anulados,
      conSolicitud: conSolicitud,
      progreso: progreso
    };
  };

  FirmaElectronicaComponent.prototype._renderTabla = function () {
    var self = this;
    if (!self._tbody) return;

    // 1. Aplicar búsqueda
    var procesos = self._procesosPorTrabajador.filter(function (p) {
      return self._matchBusqueda(p);
    });

    // 2. Aplicar filtro de estado
    if (self._filtroEstado !== 'todos') {
      procesos = procesos.filter(function (p) {
        return p.estado === self._filtroEstado;
      });
    }

    // 3. Actualizar contador
    if (self._countEl) {
      var total = self._procesosPorTrabajador.length;
      var visibles = procesos.length;
      if (total === 0) {
        self._countEl.textContent = 'Sin trabajadores con documentos en proceso';
      } else if (visibles === total) {
        self._countEl.textContent = 'Mostrando ' + total + ' trabajador' + (total !== 1 ? 'es' : '');
      } else {
        self._countEl.textContent = 'Mostrando ' + visibles + ' de ' + total + ' trabajadores';
      }
    }

    // 4. Renderizar filas
    if (procesos.length === 0) {
      self._tbody.innerHTML = self._renderEmpty();
      return;
    }
    self._tbody.innerHTML = procesos.map(function (p) {
      return self._renderFila(p);
    }).join('');
  };

  FirmaElectronicaComponent.prototype._matchBusqueda = function (proceso) {
    var self = this;
    var q = self._busqueda;
    if (!q) return true;
    var t = proceso.trabajador;
    var campos = [
      (t.nombres || ''),
      (t.apellidos || ''),
      (t.nombres + ' ' + t.apellidos),
      (t.cedula || ''),
      (t.correo || ''),
      (t.id || '')
    ];
    // También buscar por ID de solicitud (SIGN-...)
    proceso.documentos.forEach(function (d) {
      if (d.idSolicitudFirma) campos.push(d.idSolicitudFirma);
    });
    for (var i = 0; i < campos.length; i++) {
      if (String(campos[i] || '').toLowerCase().indexOf(q) !== -1) return true;
    }
    return false;
  };

  FirmaElectronicaComponent.prototype._renderFila = function (p) {
    var self = this;
    var t = p.trabajador;
    var nombreCompleto = _esc((t.nombres || '') + ' ' + (t.apellidos || ''));
    var correo = t.correo ? _esc(t.correo) : '';
    var cedula = self._fmtCedula(t.cedula || t.id || '—');

    var solicitudesHtml;
    if (p.numSolicitudes === 0) {
      solicitudesHtml = '<span class="fe-solicitudes__hint">—</span>';
    } else if (p.numSolicitudes === 1) {
      solicitudesHtml = '<span class="fe-solicitudes__count">1 solicitud</span>';
    } else {
      solicitudesHtml = '<span class="fe-solicitudes__count">' + p.numSolicitudes + ' solicitudes</span>';
    }

    return [
      '<tr class="fe-table__row" data-trabajador-id="' + _esc(t.id) + '">',
      '  <td class="fe-table__td">',
      '    <div class="fe-trabajador">',
      '      <span class="fe-trabajador__nombre">' + nombreCompleto + '</span>',
      correo ? '      <span class="fe-trabajador__correo">' + correo + '</span>' : '',
      '    </div>',
      '  </td>',
      '  <td class="fe-table__td fe-cedula">' + cedula + '</td>',
      '  <td class="fe-table__td">' + self._renderEstado(p) + '</td>',
      '  <td class="fe-table__td">' + solicitudesHtml + '</td>',
      '  <td class="fe-table__td fe-table__td--center">',
      '    <button class="fe-action" data-action="ver-expediente" data-trabajador-id="' + _esc(t.id) + '" type="button">',
      '      <i class="fas fa-folder-open"></i> Ver',
      '    </button>',
      '  </td>',
      '</tr>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderEstado = function (p) {
    var self = this;
    var label = ESTADOS_LABELS[p.estado] || p.estado;
    var desgloseParts = [];
    if (p.firmados > 0) desgloseParts.push(p.firmados + ' firmado' + (p.firmados !== 1 ? 's' : ''));
    if (p.esperando > 0) desgloseParts.push(p.esperando + ' esperando');
    if (p.pendientes > 0) desgloseParts.push(p.pendientes + ' pendiente' + (p.pendientes !== 1 ? 's' : ''));
    var desglose = desgloseParts.length > 0 ? desgloseParts.join(' · ') : '—';
    var vivos = p.total - p.anulados;
    var barraFillClass = p.estado === 'completado' ? 'fe-estado__barra-fill--completado' :
                        p.estado === 'en_proceso' ? 'fe-estado__barra-fill--en_proceso' : '';
    return [
      '<div class="fe-estado">',
      '  <span class="fe-estado__badge fe-estado__badge--' + p.estado + '">',
      '    <span class="fe-estado__badge-dot"></span>',
      _esc(label),
      '  </span>',
      vivos > 0 ? [
        '  <div class="fe-estado__progreso">',
        '    <div class="fe-estado__barra"><div class="fe-estado__barra-fill ' + barraFillClass + '" style="width: ' + p.progreso + '%;"></div></div>',
        '    <span class="fe-estado__progreso-text">' + p.firmados + ' / ' + vivos + ' documentos completados</span>',
        '  </div>'
      ].join('\n') : '',
      '  <div class="fe-estado__desglose">' + _esc(desglose) + '</div>',
      '</div>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderEmpty = function () {
    var self = this;
    if (self._procesosPorTrabajador.length === 0) {
      return [
        '<tr><td colspan="5">',
        '  <div class="fe-empty">',
        '    <div class="fe-empty__icon"><i class="fas fa-inbox"></i></div>',
        '    <h3 class="fe-empty__title">Sin documentos en proceso</h3>',
      '    <p class="fe-empty__text">No hay trabajadores con documentos en la empresa <strong>' + _esc(self.companyName || '') + '</strong>.</p>',
      '    <p class="fe-empty__text" style="margin-top:0.5rem;">Genera documentos desde el expediente de cada trabajador.</p>',
        '  </div>',
        '</td></tr>'
      ].join('\n');
    }
    return [
      '<tr><td colspan="5">',
      '  <div class="fe-empty">',
      '    <div class="fe-empty__icon"><i class="fas fa-search"></i></div>',
      '    <h3 class="fe-empty__title">Sin resultados</h3>',
      '    <p class="fe-empty__text">Ningún trabajador coincide con el filtro o la búsqueda actual.</p>',
      '  </div>',
      '</td></tr>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._fmtCedula = function (cedula) {
    if (!cedula) return '—';
    var s = String(cedula);
    // Formato con puntos como separador de miles (estilo colombiano)
    if (s.length >= 7 && /^\d+$/.test(s)) {
      return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
    return s;
  };

  FirmaElectronicaComponent.prototype._abrirModalExpediente = function (trabajadorId) {
    var self = this;
    var proceso = self._procesosPorTrabajador.find(function (p) { return p.trabajadorId === trabajadorId; });
    if (!proceso) return;
    if (!self._modal || !self._modalBody) return;
    // 1) Mostrar spinner inmediatamente
    self._modalBody.innerHTML = self._renderLoading();
    self._modal.hidden = false;
    // 2) Cargar datos de firma-service en background
    self._cargarExpedienteData(proceso).then(function (data) {
      // 3) Renderizar contenido real (si el modal sigue abierto y el proceso no cambió)
      if (self._modal && !self._modal.hidden) {
        self._modalBody.innerHTML = self._renderExpediente(proceso, data);
      }
    }).catch(function (e) {
      if (self._modal && !self._modal.hidden) {
        self._modalBody.innerHTML = self._renderError(e);
      }
    });
  };

  FirmaElectronicaComponent.prototype._renderLoading = function () {
    return [
      '<div class="fe-modal__loading">',
      '  <i class="fas fa-spinner fa-spin"></i>',
      '  <p>Cargando expediente de firma…</p>',
      '</div>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderError = function (err) {
    return [
      '<div class="fe-modal__error">',
      '  <i class="fas fa-exclamation-triangle"></i>',
      '  <h4>Error cargando expediente</h4>',
      '  <p>' + _esc(err && err.message ? err.message : 'Error desconocido') + '</p>',
      '  <p class="fe-modal__error-hint">Los datos locales del expediente siguen disponibles abajo.</p>',
      '</div>'
    ].join('\n');
  };

  /**
   * Carga datos del expediente desde firma-service.
   * - Acuerdo activo (versión, texto_hash)
   * - Para cada id_solicitudFirma único: GET /sign-requests/:id
   * - Batch de detalles vía /sign-requests-batch
   *
   * NO consulta eventos de trazabilidad (no hay IPC firma:sign-request:eventos
   * en el preload actual). Quedan como placeholder en el render.
   * NO consulta estado del consentimiento (no hay IPC firma:consent:get).
   * Usa el consent_id que viene en el sign request como referencia.
   *
   * @param {object} proceso - Proceso del trabajador (incluye documentos)
   * @returns {Promise<{agreement, signRequests, signRequestsError}>}
   */
  FirmaElectronicaComponent.prototype._cargarExpedienteData = function (proceso) {
    var self = this;
    if (!window.electronAPI) {
      return Promise.resolve({ agreement: null, signRequests: [], signRequestsError: 'electronAPI no disponible' });
    }

    // IDs únicos de solicitudes (no null)
    var solicitudIds = [];
    var seen = {};
    proceso.documentos.forEach(function (d) {
      if (d.idSolicitudFirma && !seen[d.idSolicitudFirma]) {
        seen[d.idSolicitudFirma] = true;
        solicitudIds.push(d.idSolicitudFirma);
      }
    });

    // Cargar en paralelo desde 3 orígenes (Fase 3, I-103.A1.6):
    //   A) Acuerdo activo (reutilizamos el fix de companyName ya validado)
    //   B) Por cada sign request: 3 IPCs independientes
    //      - firmaSignRequestGet  → estado, fechas, agreement_version, id_empresa
    //      - firmaSignRequestLink → url_publica, qr_payload, token (endpoint I-013b)
    //      - ghGetSignRequest     → correo_verificacion (de metadata) + fecha_envio
    //                                (último INVITE_SENT). BD read-only local.
    // Los errores por sign request son INDEPENDIENTES: si falta el link o el
    // correo, el sign request sigue siendo "ok" con los datos que sí se
    // pudieron obtener (merge tolerante a fallos parciales).
    var promises = [
      window.electronAPI.firmaAgreementGet({ companyName: self.companyName })
        .catch(function () { return { success: false }; })
    ];

    // Para mapear promesas → idSolicitud en el then()
    var idForPromise = [];
    solicitudIds.forEach(function (id) {
      // B1) Datos generales
      idForPromise.push({ id: id, source: 'get' });
      promises.push(
        window.electronAPI.firmaSignRequestGet(id, { companyName: self.companyName })
          .catch(function () { return { success: false, error: { code: 'FETCH_ERROR', message: 'No se pudo obtener ' + id } }; })
      );
      // B2) Link público (puede fallar si está en estado terminal — no es fatal)
      idForPromise.push({ id: id, source: 'link' });
      promises.push(
        window.electronAPI.firmaSignRequestLink(id, { companyName: self.companyName })
          .catch(function () { return { success: false, error: { code: 'FETCH_ERROR', message: 'No se pudo obtener link de ' + id } }; })
      );
      // B3) Datos locales de BD (correo + fecha_envio)
      idForPromise.push({ id: id, source: 'gh' });
      promises.push(
        window.electronAPI.ghGetSignRequest(id, { companyName: self.companyName })
          .catch(function () { return { success: false, error: { code: 'FETCH_ERROR', message: 'No se pudo obtener gh-data de ' + id } }; })
      );
    });

    return Promise.all(promises).then(function (results) {
      var agreementResult = results[0];
      var srResults = results.slice(1);

      // Agrupar por id_solicitud (3 promesas por id)
      var byId = {};
      srResults.forEach(function (r, i) {
        var meta = idForPromise[i];
        if (!byId[meta.id]) byId[meta.id] = { get: null, link: null, gh: null };
        byId[meta.id][meta.source] = r;
      });

      var signRequests = solicitudIds.map(function (id) {
        var parts = byId[id] || {};
        var getR = parts.get;
        var linkR = parts.link;
        var ghR = parts.gh;

        // Merge tolerante: si al menos firmaSignRequestGet funcionó, ok=true
        if (getR && getR.success && getR.data) {
          var data = Object.assign({}, getR.data);
          // Sumar link si está disponible
          if (linkR && linkR.success && linkR.data) {
            data.url_publica = linkR.data.url_publica || null;
            data.qr_payload = linkR.data.qr_payload || null;
            data.token = linkR.data.token || null;
            data.fecha_expiracion_link = linkR.data.fecha_expiracion || null;
          }
          // Sumar datos de BD local (correo + fecha_envio)
          if (ghR && ghR.success && ghR.data && ghR.data.signRequest) {
            var g = ghR.data.signRequest;
            data.correo_verificacion = g.correo_verificacion || null;
            data.fecha_envio = g.fecha_envio || null;
            data.fecha_creacion_local = g.fecha_creacion || null;
          }
          return { id: id, ok: true, data: data };
        }
        // Si get falló pero link o gh funcionaron, intentamos un fallback mínimo
        // mostrando lo que se pudo recuperar.
        var partialData = {};
        if (linkR && linkR.success && linkR.data) {
          partialData.url_publica = linkR.data.url_publica || null;
          partialData.qr_payload = linkR.data.qr_payload || null;
          partialData.estado = linkR.data.estado || null;
        }
        if (ghR && ghR.success && ghR.data && ghR.data.signRequest) {
          var g2 = ghR.data.signRequest;
          partialData.correo_verificacion = g2.correo_verificacion || null;
          partialData.fecha_envio = g2.fecha_envio || null;
          partialData.estado = partialData.estado || g2.estado || null;
        }
        if (Object.keys(partialData).length > 0) {
          return { id: id, ok: true, data: partialData, partial: true };
        }
        var firstErr = (getR && getR.error && getR.error.message) || 'No disponible';
        return { id: id, ok: false, error: firstErr };
      });

      var agreement = (agreementResult && agreementResult.success && agreementResult.data) || null;

      // Detectar error global: si NINGUNO se pudo cargar pero había IDs
      var signRequestsError = null;
      if (solicitudIds.length > 0 && signRequests.every(function (sr) { return !sr.ok; })) {
        signRequestsError = 'No se pudo obtener ninguna solicitud de firma-service';
      }

      return { agreement: agreement, signRequests: signRequests, signRequestsError: signRequestsError };
    });
  };

  /**
   * Renderiza el modal de expediente completo con todas las secciones.
   */
  FirmaElectronicaComponent.prototype._renderExpediente = function (proceso, data) {
    var self = this;
    // Guardar data en el componente para que los handlers de acciones tengan
    // acceso al detalle de cada sign request (url_publica, correo, etc.)
    self._lastExpedienteData = data;
    self._lastExpedienteProceso = proceso;
    var t = proceso.trabajador;
    var srByDocId = self._indexSignRequestsByDocId(proceso.documentos, data.signRequests);

    return [
      // ═══ 1. Header del trabajador ═══
      self._renderExpedienteHeader(proceso, t),
      // ═══ 2. Resumen del proceso + progreso ═══
      self._renderExpedienteResumen(proceso),
      // ═══ 3. Documentos involucrados + acciones ═══
      self._renderExpedienteDocumentos(proceso.documentos, srByDocId),
      // ═══ 4. Templates disponibles ═══
      self._renderExpedienteTemplates(),
      // ═══ 5. Solicitudes de firma (sign requests) ═══
      self._renderExpedienteSolicitudes(proceso, data),
      // ═══ 6. Consentimiento y acuerdo ═══
      self._renderExpedienteConsentimiento(data),
      // ═══ 7. Trazabilidad (placeholder) ═══
      self._renderExpedienteTrazabilidad(data),
      // ═══ 8. Acciones ═══
      self._renderExpedienteAcciones(proceso, data)
    ].join('\n');
  };

  /**
   * Indexa los sign requests cargados por id_solicitudFirma para lookup rápido
   * desde los documentos.
   */
  FirmaElectronicaComponent.prototype._indexSignRequestsByDocId = function (documentos, signRequests) {
    var bySr = {};
    (signRequests || []).forEach(function (sr) {
      bySr[sr.id] = sr;
    });
    return bySr;
  };

  FirmaElectronicaComponent.prototype._renderExpedienteHeader = function (proceso, t) {
    var self = this;
    var estadoLabel = ESTADOS_LABELS[proceso.estado] || proceso.estado;
    return [
      '<section class="fe-exp-section fe-exp-section--header">',
      '  <div class="fe-exp-header">',
      '    <div class="fe-exp-header__avatar"><i class="fas fa-user"></i></div>',
      '    <div class="fe-exp-header__info">',
      '      <h3 class="fe-exp-header__name">' + _esc((t.nombres || '') + ' ' + (t.apellidos || '')) + '</h3>',
      '      <div class="fe-exp-header__meta">',
      '        <span><i class="fas fa-id-card"></i> C.C. ' + _esc(self._fmtCedula(t.cedula || t.id || '—')) + '</span>',
      t.correo ? '        <span><i class="fas fa-envelope"></i> ' + _esc(t.correo) + '</span>' : '',
      t.cargo ? '        <span><i class="fas fa-briefcase"></i> ' + _esc(t.cargo) + '</span>' : '',
      '      </div>',
      '    </div>',
      '    <div class="fe-exp-header__state">',
      '      <span class="fe-estado__badge fe-estado__badge--' + proceso.estado + '">',
      '        <span class="fe-estado__badge-dot"></span>',
      _esc(estadoLabel),
      '      </span>',
      '    </div>',
      '  </div>',
      '</section>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderExpedienteResumen = function (proceso) {
    var vivos = proceso.total - proceso.anulados;
    var barraFillClass = proceso.estado === 'completado' ? 'fe-estado__barra-fill--completado' :
                        proceso.estado === 'en_proceso' ? 'fe-estado__barra-fill--en_proceso' : '';
    var desgloseParts = [];
    if (proceso.firmados > 0) desgloseParts.push(proceso.firmados + ' firmado' + (proceso.firmados !== 1 ? 's' : ''));
    if (proceso.esperando > 0) desgloseParts.push(proceso.esperando + ' esperando');
    if (proceso.pendientes > 0) desgloseParts.push(proceso.pendientes + ' pendiente' + (proceso.pendientes !== 1 ? 's' : ''));
    var desglose = desgloseParts.length > 0 ? desgloseParts.join(' · ') : '—';
    return [
      '<section class="fe-exp-section">',
      '  <h4 class="fe-exp-section__title"><i class="fas fa-chart-line"></i> Resumen del proceso</h4>',
      '  <div class="fe-exp-resumen">',
      vivos > 0 ? [
        '    <div class="fe-estado__progreso" style="margin: 0.25rem 0 0.75rem;">',
        '      <div class="fe-estado__barra"><div class="fe-estado__barra-fill ' + barraFillClass + '" style="width: ' + proceso.progreso + '%;"></div></div>',
        '      <span class="fe-estado__progreso-text">' + proceso.firmados + ' / ' + vivos + ' documentos completados (' + proceso.progreso + '%)</span>',
        '    </div>'
      ].join('\n') : '<p style="color:#6b7280;font-size:0.875rem;">Sin documentos vivos.</p>',
      '    <div class="fe-exp-resumen__stats">',
      '      <div class="fe-exp-stat"><span class="fe-exp-stat__value">' + proceso.total + '</span><span class="fe-exp-stat__label">Documentos</span></div>',
      '      <div class="fe-exp-stat"><span class="fe-exp-stat__value">' + proceso.firmados + '</span><span class="fe-exp-stat__label">Firmados</span></div>',
      '      <div class="fe-exp-stat"><span class="fe-exp-stat__value">' + proceso.esperando + '</span><span class="fe-exp-stat__label">Esperando</span></div>',
      '      <div class="fe-exp-stat"><span class="fe-exp-stat__value">' + proceso.pendientes + '</span><span class="fe-exp-stat__label">Pendientes</span></div>',
      '      <div class="fe-exp-stat"><span class="fe-exp-stat__value">' + proceso.numSolicitudes + '</span><span class="fe-exp-stat__label">Solicitudes</span></div>',
      '    </div>',
      '    <p class="fe-exp-resumen__desglose">' + _esc(desglose) + '</p>',
      '  </div>',
      '</section>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderExpedienteDocumentos = function (documentos, srByDocId) {
    var self = this;
    var rows = documentos.map(function (d) {
      var tipoLabel = d.tipo || '—';
      var estadoLabel = (d.estado || '—');
      var sr = d.idSolicitudFirma ? srByDocId[d.idSolicitudFirma] : null;
      var srEstadoBadge = '';
      if (sr && sr.ok && sr.data && sr.data.estado) {
        var srEstado = sr.data.estado;
        srEstadoBadge = '<span class="fe-exp-doc__sr-estado">' + _esc(srEstado) + '</span>';
      } else if (d.idSolicitudFirma && (!sr || !sr.ok)) {
        srEstadoBadge = '<span class="fe-exp-doc__sr-estado fe-exp-doc__sr-estado--error">No disponible</span>';
      }
      // Per-document actions
      var actions = [];
      actions.push('<button class="fe-doc-action" data-action="ver-documento" data-doc-id="' + _esc(d.id) + '" type="button"><i class="fas fa-eye"></i> Ver</button>');
      if (d.rutaArchivo) {
        actions.push('<button class="fe-doc-action" data-action="descargar-documento" data-doc-id="' + _esc(d.id) + '" type="button"><i class="fas fa-download"></i> Descargar</button>');
      }
      if (d.estado === 'pendiente' && d.rutaArchivo) {
        actions.push('<button class="fe-doc-action fe-doc-action--primary" data-action="firmar-electronico" data-doc-id="' + _esc(d.id) + '" type="button"><i class="fas fa-file-signature"></i> Firmar electrónicamente</button>');
      }
      var badgeClass = 'fe-doc-badge--' + (d.estado || 'pendiente');
      return [
        '    <div class="fe-exp-doc">',
        '      <div class="fe-exp-doc__icon"><i class="fas fa-file-pdf"></i></div>',
        '      <div class="fe-exp-doc__info">',
        '        <div class="fe-exp-doc__title">' + _esc(d.titulo || tipoLabel) + '</div>',
        '        <div class="fe-exp-doc__meta">',
        '          <span class="fe-exp-doc__tipo">' + _esc(tipoLabel) + '</span>',
        '          <span class="fe-exp-doc__sep">·</span>',
        '          <span class="fe-doc-badge ' + badgeClass + '">' + _esc(estadoLabel) + '</span>',
        d.idSolicitudFirma ? '<span class="fe-exp-doc__sep">·</span><span class="fe-exp-doc__sr">' + _esc(d.idSolicitudFirma) + '</span>' : '',
        '        </div>',
        '        <div class="fe-exp-doc__sr-detail">' + srEstadoBadge + '</div>',
        '        <div class="fe-doc-actions">' + actions.join('') + '</div>',
        '      </div>',
        '    </div>'
      ].join('\n');
    }).join('\n');
    return [
      '<section class="fe-exp-section">',
      '  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">',
      '    <h4 class="fe-exp-section__title" style="margin:0;"><i class="fas fa-file-alt"></i> Documentos (' + documentos.length + ')</h4>',
      '    <button class="fe-btn fe-btn--primary fe-btn--sm" data-action="generar-documento" type="button"><i class="fas fa-plus"></i> Generar documento</button>',
      '  </div>',
      '  <div class="fe-exp-docs">' + rows + '</div>',
      '</section>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderExpedienteTemplates = function () {
    var self = this;
    var tiposConTpl = TIPOS.filter(function (t) { return self._templatesByTipo(t.value).length > 0; });
    var totalTemplates = self._templates.length;
    var rows = '';
    tiposConTpl.forEach(function (tipo) {
      var tpls = self._templatesByTipo(tipo.value);
      tpls.forEach(function (t) {
        var iconClass = (t.mimeType || '').indexOf('pdf') !== -1 ? 'fa-file-pdf' : 'fa-file-word';
        rows += '<div class="fe-exp-doc">' +
          '<div class="fe-exp-doc__icon" style="background:' + tipo.color + '22; color:' + tipo.color + ';"><i class="fas ' + iconClass + '"></i></div>' +
          '<div class="fe-exp-doc__info">' +
            '<div class="fe-exp-doc__title">' + _esc(t.nombre) + '</div>' +
            '<div class="fe-exp-doc__meta"><span class="fe-exp-doc__tipo">' + _esc(tipo.label) + '</span>' +
            '<span class="fe-exp-doc__sep">·</span><span>' + _fmtBytes(t.tamanio) + '</span></div>' +
            '<div class="fe-doc-actions">' +
              '<button class="fe-doc-action" data-action="abrir-template" data-tpl-id="' + _esc(t.id) + '" type="button"><i class="fas fa-external-link-alt"></i> Abrir</button>' +
              '<button class="fe-doc-action fe-doc-action--danger" data-action="eliminar-template" data-tpl-id="' + _esc(t.id) + '" type="button"><i class="fas fa-trash"></i> Eliminar</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      });
    });
    return [
      '<section class="fe-exp-section">',
      '  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">',
      '    <h4 class="fe-exp-section__title" style="margin:0;"><i class="fas fa-folder-open"></i> Mis Templates (' + totalTemplates + ')</h4>',
      '    <button class="fe-btn fe-btn--ghost fe-btn--sm" data-action="admin-templates" type="button"><i class="fas fa-cog"></i> Administrar</button>',
      '  </div>',
      rows ? '<div class="fe-exp-docs">' + rows + '</div>' :
        '<p style="color:#6b7280;font-size:0.875rem;">No hay templates. Sube un .docx o .pdf para generar documentos personalizados.</p>',
      '</section>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderExpedienteSolicitudes = function (proceso, data) {
    var self = this;
    if (data.signRequests.length === 0) {
      return [
        '<section class="fe-exp-section">',
        '  <h4 class="fe-exp-section__title"><i class="fas fa-file-signature"></i> Solicitudes de firma (0)</h4>',
        '  <p style="color:#6b7280;font-size:0.875rem;padding:0.5rem 0;">Este trabajador aún no tiene solicitudes de firma creadas en firma-service.</p>',
        '</section>'
      ].join('\n');
    }
    if (data.signRequestsError) {
      return [
        '<section class="fe-exp-section">',
        '  <h4 class="fe-exp-section__title"><i class="fas fa-file-signature"></i> Solicitudes de firma (' + data.signRequests.length + ')</h4>',
        '  <div class="fe-exp-warning">',
        '    <i class="fas fa-exclamation-triangle"></i>',
        '    <span>' + _esc(data.signRequestsError) + '. Los datos mostrados abajo son aproximados desde el estado local.</span>',
        '  </div>',
        '</section>'
      ].join('\n');
    }
    var cards = data.signRequests.map(function (sr) {
      return self._renderSolicitudCard(sr);
    }).join('\n');
    return [
      '<section class="fe-exp-section">',
      '  <h4 class="fe-exp-section__title"><i class="fas fa-file-signature"></i> Solicitudes de firma (' + data.signRequests.length + ')</h4>',
      '  <div class="fe-exp-solicitudes">' + cards + '</div>',
      '</section>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderSolicitudCard = function (sr) {
    if (!sr.ok) {
      return [
        '  <div class="fe-exp-sr fe-exp-sr--error">',
        '    <div class="fe-exp-sr__head">',
        '      <span class="fe-exp-sr__id">' + _esc(sr.id) + '</span>',
        '      <span class="fe-exp-sr__badge fe-exp-sr__badge--error">No disponible</span>',
        '    </div>',
        '    <p class="fe-exp-sr__msg">' + _esc(sr.error || 'firma-service no respondió') + '</p>',
        '  </div>'
      ].join('\n');
    }
    var d = sr.data || {};
    var estadoRaw = d.estado || d.estado_firma || 'DESCONOCIDO';
    var badgeClass = this._srEstadoToBadge(estadoRaw);
    var rows = [];
    rows.push(this._srField('Tipo de firma', d.tipo_firma));
    rows.push(this._srField('Consentimiento', d.consent_id ? '#' + d.consent_id : '—'));
    rows.push(this._srField('Versión acuerdo', d.agreement_version || '—'));
    rows.push(this._srField('Creada', this._fmtFechaHora(d.fecha_creacion)));
    rows.push(this._srField('Vence', this._fmtFechaHora(d.fecha_expiracion)));
    rows.push(this._srField('Firmada', this._fmtFechaHora(d.fecha_firma)));
    rows.push(this._srField('Correo destino', d.correo_verificacion ? this._maskEmail(d.correo_verificacion) : '—'));
    if (d.fecha_envio) {
      rows.push(this._srField('Fecha de envío', this._fmtFechaHora(d.fecha_envio)));
    }
    var urlPublica = d.url_publica;
    var qrPayload = d.qr_payload;
    var link = this._srField('Enlace público', urlPublica ? '<a href="' + _esc(urlPublica) + '" target="_blank" rel="noopener" class="fe-exp-sr__link"><i class="fas fa-external-link-alt"></i> Abrir enlace</a>' : '—');
    rows.push(link);
    if (qrPayload) {
      rows.push(this._srField('QR (payload)', '<code style="font-size:0.75rem;color:#1e40af;">' + _esc(qrPayload) + '</code>'));
    }
    if (d.error_code) {
      rows.push(this._srField('Error', '<span class="fe-exp-sr__error-code">' + _esc(d.error_code) + '</span> ' + _esc(d.error_message || '')));
    }
    return [
      '  <div class="fe-exp-sr">',
      '    <div class="fe-exp-sr__head">',
      '      <span class="fe-exp-sr__id">' + _esc(sr.id) + '</span>',
      '      <span class="fe-exp-sr__badge ' + badgeClass + '">' + _esc(estadoRaw) + '</span>',
      '    </div>',
      '    <div class="fe-exp-sr__grid">' + rows.join('\n') + '</div>',
      '  </div>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._srEstadoToBadge = function (estado) {
    var e = String(estado || '').toUpperCase();
    if (e === 'SIGNED' || e === 'COMPLETADO' || e === 'FIRMADO') return 'fe-exp-sr__badge--ok';
    if (e === 'PENDING' || e === 'OTP_VERIFIED' || e === 'IDENTIFIED' || e === 'VIEWED') return 'fe-exp-sr__badge--info';
    if (e === 'OTP_PENDING' || e === 'WAITING_OTP') return 'fe-exp-sr__badge--warning';
    if (e === 'REJECTED') return 'fe-exp-sr__badge--rejected';
    if (e === 'EXPIRED' || e === 'CANCELLED' || e === 'REVOKED') return 'fe-exp-sr__badge--expired';
    if (e === 'ERROR') return 'fe-exp-sr__badge--error';
    return 'fe-exp-sr__badge--info';
  };
  FirmaElectronicaComponent.prototype._srField = function (label, value) {
    var v = (value === null || value === undefined || value === '') ? '—' : value;
    return '<div class="fe-exp-sr__field"><span class="fe-exp-sr__label">' + _esc(label) + '</span><span class="fe-exp-sr__value">' + (typeof v === 'string' ? v : String(v)) + '</span></div>';
  };
  FirmaElectronicaComponent.prototype._fmtFechaHora = function (iso) {
    if (!iso) return null;
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return _esc(iso);
      return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) { return _esc(iso); }
  };
  FirmaElectronicaComponent.prototype._maskEmail = function (email) {
    if (!email || typeof email !== 'string') return '';
    var at = email.indexOf('@');
    if (at <= 1) return email;
    var local = email.substring(0, at);
    var domain = email.substring(at);
    var firstChar = local.substring(0, 1);
    return firstChar + '***' + domain;
  };

  FirmaElectronicaComponent.prototype._renderExpedienteConsentimiento = function (data) {
    var agreement = data.agreement;
    var info = [];
    if (agreement) {
      info.push('<div class="fe-exp-consent__field"><span class="fe-exp-consent__label">Versión del acuerdo</span><span class="fe-exp-consent__value">' + _esc(agreement.version || '—') + '</span></div>');
      info.push('<div class="fe-exp-consent__field"><span class="fe-exp-consent__label">Hash del texto</span><span class="fe-exp-consent__value"><code style="font-size:0.75rem;">' + _esc((agreement.texto_hash || '').substring(0, 16) + '…') + '</code></span></div>');
      info.push('<div class="fe-exp-consent__field"><span class="fe-exp-consent__label">Vigente desde</span><span class="fe-exp-consent__value">' + _esc(agreement.fecha_vigencia_inicio || '—') + '</span></div>');
    } else {
      info.push('<p style="color:#6b7280;font-size:0.875rem;">No se pudo obtener la versión activa del acuerdo.</p>');
    }
    return [
      '<section class="fe-exp-section">',
      '  <h4 class="fe-exp-section__title"><i class="fas fa-file-contract"></i> Consentimiento y versión del acuerdo</h4>',
      '  <div class="fe-exp-consent">' + info.join('\n') + '</div>',
      '  <p class="fe-exp-section__note"><i class="fas fa-info-circle"></i> El estado detallado del consentimiento (OTP enviado, verificado, aceptado) se consultará en una versión posterior cuando el bridge exponga un endpoint dedicado de consentimiento.</p>',
      '</section>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderExpedienteTrazabilidad = function (data) {
    return [
      '<section class="fe-exp-section">',
      '  <h4 class="fe-exp-section__title"><i class="fas fa-stream"></i> Trazabilidad / eventos</h4>',
      '  <div class="fe-exp-warning">',
      '    <i class="fas fa-clock"></i>',
      '    <span>La línea de tiempo detallada de eventos (CREATED, INVITE_SENT, IDENTIFIED, OTP_VERIFIED, SIGNED, etc.) requiere un endpoint adicional en el bridge de firma. Se añadirá en una versión posterior.</span>',
      '  </div>',
      '</section>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderExpedienteAcciones = function (proceso, data) {
    var self = this;
    // Primer sign request válido (toma el primero; si hay varios, igual sirve para el correo/enlace del primero)
    var srActivo = data.signRequests.find(function (sr) { return sr.ok; });
    var srActivoEstado = srActivo && srActivo.data && srActivo.data.estado;
    var srFirmado = data.signRequests.find(function (sr) { return sr.ok && sr.data && sr.data.estado === 'SIGNED'; });
    var hayPdfFirmado = proceso.documentos.some(function (d) { return d.estado === 'firmado'; });

    // El botón de enviar correo solo se habilita si hay un sr activo que NO esté firmado/cancelado/vencido/revocado
    var puedeEnviar = !!srActivo && srActivoEstado !== 'SIGNED' && srActivoEstado !== 'CANCELLED' && srActivoEstado !== 'EXPIRED' && srActivoEstado !== 'REVOKED';
    // El botón de copiar enlace solo se habilita si hay url_publica
    var puedeCopiar = !!srActivo && srActivo.data && srActivo.data.url_publica;
    // Ver documento / descargar constancia solo si hay un firmado (estado SIGNED o doc local firmado)
    var puedeVerPdf = !!srFirmado || hayPdfFirmado;

    var srId = srFirmado
      ? srFirmado.id
      : (
          hayPdfFirmado
            ? ((proceso.documentos.find(function (d) {
                  return d.estado === 'firmado';
                }) || {}).idSolicitudFirma || '')
            : (srActivo ? srActivo.id : '')
        );

    // Contador dinámico: cuenta cuántas acciones quedan realmente habilitadas.
    // (No asumir "4": depende de si url_publica existe, etc.)
    var accionesHabilitadas = 0;
    if (puedeEnviar) accionesHabilitadas++;
    if (puedeCopiar) accionesHabilitadas++;
    if (puedeVerPdf) accionesHabilitadas += 2; // Ver documento + Descargar constancia

    return [
      '<section class="fe-exp-section fe-exp-section--actions">',
      '  <h4 class="fe-exp-section__title"><i class="fas fa-bolt"></i> Acciones disponibles</h4>',
      '  <div class="fe-exp-actions">',
      // Enviar / reenviar correo
      '    <button class="fe-exp-action" type="button" data-action="enviar-correo" data-sr-id="' + _esc(srId) + '"' + (puedeEnviar ? '' : ' disabled title="Solicitud no activa o sin firma-service"') + '>',
      '      <i class="fas ' + (srActivoEstado === 'SIGNED' ? 'fa-check' : 'fa-paper-plane') + '"></i> ' + (srActivoEstado === 'PENDING' ? 'Enviar correo inicial' : srActivoEstado === 'SIGNED' ? 'Reenviar correo (firmado)' : 'Reenviar correo'),
      '    </button>',
      // Copiar enlace público
      '    <button class="fe-exp-action" type="button" data-action="copiar-enlace" data-sr-id="' + _esc(srId) + '"' + (puedeCopiar ? '' : ' disabled title="Aún no se ha generado el enlace público (envía primero el correo)"') + '>',
      '      <i class="fas fa-link"></i> Copiar enlace público',
      '    </button>',
      // Reenviar OTP — Próximamente (no hay IPC público; pendiente decisión arquitectura)
      '    <button class="fe-exp-action" type="button" disabled title="Próximamente: requiere nuevo endpoint en firma-service">',
      '      <i class="fas fa-redo"></i> Reenviar OTP',
      '    </button>',
      // Cancelar solicitud — Próximamente (requiere adminApiKey, decisión de modelo de autorización)
      '    <button class="fe-exp-action fe-exp-action--danger" type="button" disabled title="Próximamente: requiere decisión de autorización (adminApiKey)">',
      '      <i class="fas fa-ban"></i> Cancelar solicitud',
      '    </button>',
      // Ver documento firmado — habilitado cuando SIGNED
      puedeVerPdf ? [
        '    <button class="fe-exp-action" type="button" data-action="ver-documento-firmado" data-sr-id="' + _esc(srId) + '">',
        '      <i class="fas fa-file-pdf"></i> Ver documento firmado',
        '    </button>'
      ].join('\n') : '',
      // Descargar constancia de firma — habilitado cuando SIGNED (usa cache local)
      puedeVerPdf ? [
        '    <button class="fe-exp-action" type="button" data-action="descargar-constancia" data-sr-id="' + _esc(srId) + '">',
        '      <i class="fas fa-download"></i> Descargar constancia de firma',
        '    </button>'
      ].join('\n') : '',
      '  </div>',
      '  <p class="fe-exp-section__note"><i class="fas fa-info-circle"></i> <strong>' + accionesHabilitadas + (accionesHabilitadas === 1 ? ' acción habilitada' : ' acciones habilitadas') + '</strong> según el estado actual del sign request. Reenviar OTP y Cancelar solicitud quedan como Próximamente.</p>',
      '</section>'
    ].join('\n');
  };

  /**
   * Handler del botón "Enviar / reenviar correo".
   * Flujo (I-103.A1.6):
   *   1. Obtener consent_id del sign request
   *   2. Consultar el consentimiento en K+AIR via ghGetConsentimiento
   *      (IPC local que retorna correo_verificacion desde gh_consentimientos_firma)
   *   3. Llamar a firma-service notify-remote con companyName + correo
   *   4. Refetch del expediente al terminar
   */
  FirmaElectronicaComponent.prototype._actionEnviarCorreo = async function (srId) {
    var self = this;
    if (!srId) return;
    var data = self._lastExpedienteData;
    var proceso = self._lastExpedienteProceso;
    if (!data || !proceso) return;
    var sr = (data.signRequests || []).find(function (s) { return s.id === srId; });
    if (!sr || !sr.ok || !sr.data) {
      self._showToast('No se puede reenviar: solicitud no disponible', 'error');
      return;
    }
    // 1. Leer el correo del sign request desde signRequest.metadata.correo
    //    (gestión humana bridge retorna este valor parseado de la metadata).
    //    Esto respeta la regla única: el correo de cada SR es independiente
    //    del consent vinculado (que es histórico).
    var srResult = await window.electronAPI.ghGetSignRequest(srId, { companyName: self.companyName });
    if (!srResult || !srResult.success || !srResult.data || !srResult.data.signRequest) {
      var errMsg = srResult && srResult.error && srResult.error.message || 'desconocido';
      self._showToast('No se pudo obtener el sign request ' + srId + ': ' + errMsg, 'error');
      return;
    }
    var correo = srResult.data.signRequest.correo_verificacion;
    if (!correo) {
      // Fallback para SR legacy sin metadata.correo: el consent (histórico)
      // se usa solo como último recurso. Esto preserva compatibilidad con
      // sign requests creados antes del fix A1.5.4-A.
      var consentId = sr.data.consent_id;
      if (!consentId) {
        self._showToast('El sign request ' + srId + ' no tiene correo (ni en metadata ni en consent)', 'error');
        return;
      }
      var consentResult = await window.electronAPI.ghGetConsentimiento(consentId, { companyName: self.companyName });
      if (!consentResult || !consentResult.success || !consentResult.data || !consentResult.data.consentimiento) {
        self._showToast('No se pudo obtener el correo (ni de metadata ni del consent #' + consentId + ')', 'error');
        return;
      }
      correo = consentResult.data.consentimiento.correo_verificacion;
      if (!correo) {
        self._showToast('No hay correo disponible para esta solicitud', 'error');
        return;
      }
    }
    // 2. Llamar a firma-service con companyName (fix A1.5.4-B) + correo + context
    var r;
    try {
      r = await window.electronAPI.firmaSignRequestNotifyRemote(srId, {
        companyName: self.companyName,
        correo: correo,
        context: { via: 'firma-electronica', button: 'enviar-correo' }
      });
    } catch (e) {
      self._showToast('Excepción enviando correo: ' + e.message, 'error');
      return;
    }
    if (r && r.success) {
      var sent = r.data && r.data.messageId ? ' (messageId: ' + r.data.messageId + ')' : '';
      self._showToast('Correo enviado a ' + correo + sent, 'success');
      // 3. Refetch del expediente para mostrar el nuevo estado
      await self._refetchExpediente(proceso);
    } else {
      var errCode = r && r.error && r.error.code;
      var errMsg2 = r && r.error && r.error.message;
      self._showToast('Error enviando correo: ' + (errCode ? errCode + ' — ' : '') + (errMsg2 || 'desconocido'), 'error');
    }
  };

  /**
   * Handler del botón "Copiar enlace público".
   * Usa la url_publica del sign request (disponible después de enviar el correo).
   */
  FirmaElectronicaComponent.prototype._actionCopiarEnlace = async function (srId) {
    var self = this;
    if (!srId) return;
    var data = self._lastExpedienteData;
    if (!data) return;
    var sr = (data.signRequests || []).find(function (s) { return s.id === srId; });
    if (!sr || !sr.ok || !sr.data || !sr.data.url_publica) {
      self._showToast('Aún no se ha generado el enlace público. Envía primero el correo.', 'info');
      return;
    }
    var url = sr.data.url_publica;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback para entornos sin clipboard API
        var ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      self._showToast('Enlace público copiado al portapapeles', 'success');
    } catch (e) {
      self._showToast('Error copiando enlace: ' + e.message, 'error');
    }
  };

  /**
   * Handler del botón "Ver documento firmado".
   * Pide al bridge que obtenga el PDF firmado (cache local primero), luego
   * invoca electronAPI.openPath para abrirlo con el visor predeterminado.
   * Verifica success/error de openPath.
   */
  FirmaElectronicaComponent.prototype._actionVerDocumentoFirmado = async function (srId) {
    var self = this;
    if (!srId) {
      return;
    }
    try {
      var r = await window.electronAPI.firmaSignRequestDocument(srId, { companyName: self.companyName });
      if (!r || !r.success || !r.data || !r.data.rutaArchivo) {
        self._showToast('No se pudo obtener el documento firmado', 'error');
        return;
      }
      var openResult = await window.electronAPI.openPath(r.data.rutaArchivo);
      if (!openResult || !openResult.success) {
        self._showToast('No se pudo abrir el documento: ' + ((openResult && openResult.error) || 'error desconocido'), 'error');
        return;
      }
      var origen = r.data.desdeCache ? ' (desde caché local)' : '';
      self._showToast('Documento firmado abierto' + origen, 'success');
    } catch (e) {
      self._showToast('Error abriendo documento: ' + e.message, 'error');
    }
  };

  /**
   * Handler del botón "Descargar constancia de firma".
   * Pide al bridge que muestre dialog.showSaveDialog y guarde el PDF.
   * El renderer NO recibe bytes.
   */
  FirmaElectronicaComponent.prototype._actionDescargarConstancia = async function (srId) {
    var self = this;
    if (!srId) return;
    try {
      var r = await window.electronAPI.firmaSignRequestConstanciaSaveAs(srId, { companyName: self.companyName });
      if (r && r.canceled) {
        self._showToast('Descarga cancelada', 'info');
        return;
      }
      if (!r || !r.success || !r.data || !r.data.rutaArchivo) {
        self._showToast('No se pudo guardar la constancia', 'error');
        return;
      }
      self._showToast('Constancia guardada en ' + r.data.rutaArchivo, 'success');
    } catch (e) {
      self._showToast('Error guardando constancia: ' + e.message, 'error');
    }
  };

  /**
   * Re-carga los datos del expediente desde firma-service y re-renderiza el modal.
   * Llamado después de cada acción que pueda cambiar el estado del sign request.
   */
  FirmaElectronicaComponent.prototype._refetchExpediente = async function (proceso) {
    var self = this;
    if (!self._modal || self._modal.hidden) return;
    try {
      var data = await self._cargarExpedienteData(proceso);
      // Solo re-renderizar si el modal sigue abierto
      if (self._modal && !self._modal.hidden && self._modalBody) {
        self._modalBody.innerHTML = self._renderExpediente(proceso, data);
      }
    } catch (e) {
      self._showToast('Error refrescando expediente: ' + e.message, 'error');
    }
  };

  FirmaElectronicaComponent.prototype._cerrarModal = function () {
    if (this._modal) this._modal.hidden = true;
  };

  // ═══════════════════════════════════════════════════════════
  // TEMPLATES
  // ═══════════════════════════════════════════════════════════

  FirmaElectronicaComponent.prototype._templatesByTipo = function (tipo) {
    return this._templates.filter(function (t) { return t.tipoDocumento === tipo; });
  };

  FirmaElectronicaComponent.prototype._openTemplatesAdminModal = function () {
    var modal = this.container.querySelector('#fe-tpl-admin-modal');
    if (!modal) return;
    this._renderTemplates();
    modal.hidden = false;
  };

  FirmaElectronicaComponent.prototype._renderTemplates = function () {
    var grid = this.container.querySelector('#fe-templates');
    if (!grid) return;
    var self = this;
    if (self._templates.length === 0) {
      grid.innerHTML = '<div class="fe-tpl-empty"><i class="fas fa-folder-open"></i>' +
        '<strong>No tienes templates subidos</strong>' +
        '<p>Sube tu primer .docx o .pdf para empezar a generar documentos reales.</p></div>';
      return;
    }
    grid.innerHTML = self._templates.map(function (t) {
      var tipoObj = TIPOS.find(function (tp) { return tp.value === t.tipoDocumento; });
      var tipoLabel = tipoObj ? tipoObj.label : t.tipoDocumento;
      var tipoColor = tipoObj ? tipoObj.color : '#6b7280';
      var tamTxt = _fmtBytes(t.tamanio);
      var fechaTxt = t.fechaCreacion ? new Date(t.fechaCreacion).toLocaleDateString('es-CO') : '—';
      var iconClass = (t.mimeType || '').indexOf('pdf') !== -1 ? 'fa-file-pdf' : 'fa-file-word';
      return '<div class="fe-tpl-card">' +
        '<div class="fe-tpl-card__head">' +
          '<div class="fe-tpl-card__icon" style="background:' + tipoColor + '22; color:' + tipoColor + ';">' +
            '<i class="fas ' + iconClass + '"></i></div>' +
          '<div class="fe-tpl-card__body">' +
            '<div class="fe-tpl-card__title" title="' + _esc(t.nombre) + '">' + _esc(t.nombre) + '</div>' +
            '<span class="fe-tpl-card__tipo" style="color:' + tipoColor + '; background:' + tipoColor + '15;">' + _esc(tipoLabel) + '</span>' +
            '<div class="fe-tpl-card__meta">' + tamTxt + ' · ' + fechaTxt + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="fe-tpl-card__actions">' +
          '<button class="fe-btn-mini" data-action="abrir-template" data-tpl-id="' + _esc(t.id) + '" type="button"><i class="fas fa-external-link-alt"></i> Abrir</button>' +
          '<button class="fe-btn-mini fe-btn-mini--danger" data-action="eliminar-template" data-tpl-id="' + _esc(t.id) + '" type="button"><i class="fas fa-trash"></i> Eliminar</button>' +
        '</div>' +
      '</div>';
    }).join('');
  };

  FirmaElectronicaComponent.prototype._abrirTemplate = async function (templateId) {
    if (!templateId || !window.electronAPI) return;
    var r = await window.electronAPI.ghAbrirTemplate({ templateId: templateId });
    if (r && !r.success) {
      self._showToast('Error abriendo template: ' + (r.error && r.error.message || 'desconocido'), 'error');
    }
  };

  FirmaElectronicaComponent.prototype._eliminarTemplate = async function (templateId) {
    if (!templateId || !window.electronAPI) return;
    var tpl = this._templateById[templateId];
    var nombre = tpl ? tpl.nombre : 'este template';
    var ok = confirm('¿Eliminar "' + nombre + '"? El archivo se borrará del disco.');
    if (!ok) return;
    var r = await window.electronAPI.ghEliminarTemplate({ templateId: templateId });
    if (r && r.success) {
      this._showToast('Template eliminado', 'success');
      await this._reloadData();
      this._renderTemplates();
    } else {
      this._showToast('Error eliminando template: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
    }
  };

  FirmaElectronicaComponent.prototype._openSubirTemplateModal = function () {
    var modal = this.container.querySelector('#fe-tpl-upload-modal');
    if (!modal) return;
    var tipoSelect = modal.querySelector('#fe-tpl-tipo');
    var nombreInput = modal.querySelector('#fe-tpl-nombre');
    var confirmBtn = modal.querySelector('#fe-tpl-confirm');
    var self = this;
    tipoSelect.innerHTML = TIPOS.map(function (t) {
      return '<option value="' + t.value + '">' + _esc(t.label) + '</option>';
    }).join('');
    nombreInput.value = '';
    modal.hidden = false;
    confirmBtn.onclick = function () {
      var tipo = tipoSelect.value;
      var nombre = (nombreInput.value || '').trim();
      if (!nombre) { self._showToast('Escribe un nombre para el template', 'warning'); return; }
      self._subirTemplate(tipo, nombre, modal);
    };
  };

  FirmaElectronicaComponent.prototype._subirTemplate = async function (tipo, nombre, modal) {
    if (!window.electronAPI) return;
    var r = await window.electronAPI.ghSubirTemplate({
      companyName: this.companyName,
      tipoDocumento: tipo,
      nombre: nombre
    });
    if (r && r.data && r.data.canceled) return;
    if (r && r.success) {
      modal.hidden = true;
      this._showToast('Template subido correctamente', 'success');
      await this._reloadData();
      this._renderTemplates();
    } else {
      this._showToast('Error subiendo template: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // GENERAR DOCUMENTO
  // ═══════════════════════════════════════════════════════════

  FirmaElectronicaComponent.prototype._openGenerarModal = function () {
    var self = this;
    var modal = self.container.querySelector('#fe-gen-modal');
    if (!modal) return;
    var proceso = self._lastExpedienteProceso;
    if (!proceso) { self._showToast('No hay trabajador seleccionado', 'warning'); return; }
    var trab = proceso.trabajador;
    // Pre-fill trabajador
    var infoEl = modal.querySelector('#fe-gen-trabajador-info');
    if (infoEl) {
      infoEl.innerHTML = '<strong>' + _esc((trab.nombres || '') + ' ' + (trab.apellidos || '')) + '</strong>' +
        (trab.cedula ? ' — C.C. ' + _esc(self._fmtCedula(trab.cedula)) : '');
    }
    // Render tipos
    var tiposEl = modal.querySelector('#fe-gen-tipos');
    if (tiposEl) {
      tiposEl.innerHTML = TIPOS.map(function (t) {
        var count = self._templatesByTipo(t.value).length;
        var badgeClass = count > 0 ? '' : ' fe-gen-tipo__tpl-badge--empty';
        var badgeText = count > 0 ? count + ' template' + (count !== 1 ? 's' : '') : 'sin template';
        return '<div class="fe-gen-tipo' + (self._selectedTipo === t.value ? ' fe-gen-tipo--selected' : '') + '" data-tipo="' + t.value + '">' +
          '<div class="fe-gen-tipo__icon" style="background:' + t.color + '22; color:' + t.color + ';">' +
            '<i class="fas ' + t.icon + '"></i></div>' +
          '<div class="fe-gen-tipo__body">' +
            '<div class="fe-gen-tipo__title">' + _esc(t.label) +
              ' <span class="fe-gen-tipo__tpl-badge' + badgeClass + '">' + badgeText + '</span></div>' +
          '</div>' +
        '</div>';
      }).join('');
    }
    // If no tipo selected, select first
    if (!self._selectedTipo) self._selectedTipo = TIPOS[0].value;
    self._updateTemplateField(modal);
    // Wire tipo click
    if (tiposEl) {
      tiposEl.onclick = function (ev) {
        var card = ev.target.closest('.fe-gen-tipo');
        if (!card) return;
        self._selectedTipo = card.getAttribute('data-tipo');
        tiposEl.querySelectorAll('.fe-gen-tipo').forEach(function (c) { c.classList.remove('fe-gen-tipo--selected'); });
        card.classList.add('fe-gen-tipo--selected');
        self._updateTemplateField(modal);
      };
    }
    // Wire confirm
    var confirmBtn = modal.querySelector('#fe-gen-confirm');
    if (confirmBtn) {
      confirmBtn.onclick = function () { self._generarDocumento(trab.id, self._selectedTipo, modal); };
    }
    modal.hidden = false;
  };

  FirmaElectronicaComponent.prototype._updateTemplateField = function (modal) {
    var field = modal.querySelector('#fe-gen-template-field');
    var select = modal.querySelector('#fe-gen-template');
    var hint = modal.querySelector('#fe-gen-template-hint');
    if (!field || !select) return;
    var templates = this._templatesByTipo(this._selectedTipo);
    if (templates.length === 0) {
      field.hidden = true;
      this._selectedTemplateId = null;
      return;
    }
    field.hidden = false;
    select.innerHTML = '<option value="">— Sin template (contenido genérico) —</option>' +
      templates.map(function (t) {
        return '<option value="' + _esc(t.id) + '">' + _esc(t.nombre) + ' (' + _esc(t.nombreArchivo || '') + ')</option>';
      }).join('');
    this._selectedTemplateId = null;
    select.onchange = function () {
      this._selectedTemplateId = select.value || null;
    }.bind(this);
    if (hint) hint.textContent = 'Selecciona un template o deja vacío para contenido genérico.';
  };

  FirmaElectronicaComponent.prototype._generarDocumento = async function (trabajadorId, tipo, modal) {
    var self = this;
    if (!window.electronAPI || !self.companyName) return;
    var tipoObj = TIPOS.find(function (t) { return t.value === tipo; });
    var titulo = tipoObj ? tipoObj.label : tipo;
    var contenido = JSON.stringify({ tipoDocumento: tipo, generadoEn: new Date().toISOString() });
    var confirmBtn = modal.querySelector('#fe-gen-confirm');
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Generando...'; }
    try {
      var r = await window.electronAPI.ghCreateDocumento({
        companyName: self.companyName,
        data: {
          trabajadorId: trabajadorId,
          tipo: tipo,
          titulo: titulo,
          contenido: contenido,
          templateId: self._selectedTemplateId || undefined
        }
      });
      if (r && r.success) {
        modal.hidden = true;
        self._showToast('Documento generado. Pendiente de firma electrónica.', 'success');
        await self._reloadData();
        self._renderTabla();
        // Re-open expediente if modal was open
        if (self._modal && !self._modal.hidden && self._lastExpedienteProceso) {
          await self._refetchExpediente(self._lastExpedienteProceso);
        }
      } else {
        self._showToast('Error generando documento: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
      }
    } catch (e) {
      self._showToast('Error generando documento: ' + e.message, 'error');
    }
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.innerHTML = '<i class="fas fa-plus"></i> Generar'; }
  };

  // ═══════════════════════════════════════════════════════════
  // FIRMA ELECTRÓNICA
  // ═══════════════════════════════════════════════════════════

  FirmaElectronicaComponent.prototype._firmarElectronico = async function (docId) {
    var self = this;
    if (!docId || !window.electronAPI) return;
    try {
      var docResult = await window.electronAPI.ghGetDocumento({ documentoId: docId });
      if (!docResult || !docResult.success || !docResult.data || !docResult.data.documento) {
        self._showToast('No se pudo obtener el documento', 'error');
        return;
      }
      var doc = docResult.data.documento;
      if (!doc.rutaArchivo) {
        self._showToast('El documento no tiene archivo adjunto. Genera el documento con un template primero.', 'warning');
        return;
      }
      var empresas = await window.electronAPI.firmaEmpresaList({});
      var match = null;
      if (empresas && empresas.success && empresas.data && empresas.data.configured) {
        match = empresas.data.configured.find(function (c) { return c.companyKey === self.companyName; });
      }
      if (!match) {
        self._showToast('La empresa no tiene firma-service configurado', 'error');
        return;
      }
      self._abrirModalFirma(doc, match);
    } catch (e) {
      self._showToast('Error validando documento: ' + e.message, 'error');
    }
  };

  FirmaElectronicaComponent.prototype._abrirModalFirma = function (doc, match) {
    var self = this;
    var modal = self.container.querySelector('#fe-firma-modal');
    if (!modal) return;
    self._firmaDoc = doc;
    self._firmaCtx = match;
    var proceso = self._lastExpedienteProceso;
    var trab = proceso ? proceso.trabajador : null;
    self._firmaTrab = trab;
    // Populate summaries
    var docSummary = modal.querySelector('#fe-firma-doc-summary');
    if (docSummary) {
      docSummary.innerHTML = '<strong>' + _esc(doc.titulo || doc.tipo || 'Documento') + '</strong>' +
        (doc.rutaArchivo ? ' <span style="color:#6b7280;font-size:0.75rem;">(' + _esc((doc.rutaArchivo.split(/[/\\]/).pop())) + ')</span>' : '');
    }
    var trabSummary = modal.querySelector('#fe-firma-trab-summary');
    if (trabSummary && trab) {
      trabSummary.innerHTML = '<strong>' + _esc((trab.nombres || '') + ' ' + (trab.apellidos || '')) + '</strong>' +
        (trab.cedula ? ' — C.C. ' + _esc(trab.cedula) : '');
    }
    // Pre-fill email
    var correoInput = modal.querySelector('#fe-firma-correo');
    var hintEl = modal.querySelector('#fe-firma-correo-hint');
    var errorEl = modal.querySelector('#fe-firma-correo-error');
    var confirmarCheck = modal.querySelector('#fe-firma-confirmar');
    var enviarBtn = modal.querySelector('#fe-firma-enviar');
    if (correoInput) correoInput.value = (trab && trab.correo) || '';
    if (hintEl) hintEl.textContent = (trab && trab.correo) ? 'Correo prellenado del trabajador.' : '';
    if (errorEl) errorEl.hidden = true;
    if (confirmarCheck) confirmarCheck.checked = false;
    if (enviarBtn) enviarBtn.disabled = true;
    // FASE 4 · A1.5.4-B: ya no hay pausa para OTP en K+AIR.
    // El único correo que sale es la invitación con la URL.
    // El firmante recibe su OTP al validar la cédula en la mini-app.
    if (enviarBtn) {
      enviarBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar a firma';
    }
    // Wire validation
    function validate() {
      var correo = (correoInput.value || '').trim();
      var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) && confirmarCheck.checked;
      enviarBtn.disabled = !valid;
    }
    if (correoInput) correoInput.oninput = validate;
    if (confirmarCheck) confirmarCheck.onchange = validate;
    // Wire send (sin pausa de OTP — el flujo es lineal)
    if (enviarBtn) {
      enviarBtn.onclick = function () {
        self._enviarAFirma(modal, self._firmaCtx, correoInput.value.trim());
      };
    }
    modal.hidden = false;
  };

  FirmaElectronicaComponent.prototype._enviarAFirma = async function (modal, ctx, correoFirmante) {
    // FASE 4 · A1.5.4-B · REDISEÑO DEL FLUJO:
    // 1. K+AIR crea consent (pendiente, sin OTP) + sign_request + notify_remote
    // 2. El único correo que sale es la invitación con la URL pública
    // 3. El OTP del firmante se genera en la mini-app vía identify()
    // 4. El Acuerdo se acepta en la mini-app vía consentAccept()
    //
    // NO hay pausa para OTP en K+AIR. El flujo es lineal.
    var self = this;
    var enviarBtn = modal.querySelector('#fe-firma-enviar');
    if (enviarBtn) { enviarBtn.disabled = true; enviarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; }
    try {
      // 1. Get agreement
      var agr = await window.electronAPI.firmaAgreementGet({ companyName: self.companyName });
      var agreement = (agr && agr.success && agr.data) || null;
      if (!agreement) { self._showToast('No se pudo obtener el acuerdo activo', 'error'); self._restoreEnviarButton(enviarBtn); return; }
      // 2. Read PDF bytes
      var pdfResult = await window.electronAPI.firmaDocumentoReadBytes({ rutaArchivo: self._firmaDoc.rutaArchivo });
      if (!pdfResult || !pdfResult.success || !pdfResult.data) {
        self._showToast('Error leyendo el archivo PDF: ' + (pdfResult && pdfResult.error && pdfResult.error.message || 'desconocido'), 'error');
        self._restoreEnviarButton(enviarBtn); return;
      }
      var pdfBytes = pdfResult.data.data; // base64
      var pdfBuffer = self._base64ToBytes(pdfBytes);
      // 3. SHA-256 hash
      var hashBuffer = await crypto.subtle.digest('SHA-256', pdfBuffer);
      var documentHash = self._bytesToHex(hashBuffer);
      // 4. Create consent (sin OTP — FASE 4)
      var trab = self._firmaTrab;
      var consentPayload = {
        companyName: self.companyName,
        id_trabajador: trab.cedula || trab.id,
        id_empresa: ctx.idEmpresa,
        version_acuerdo: agreement.version,
        correo_verificacion: correoFirmante,
        kair_version: '0.1.190'
      };
      var consentR = await window.electronAPI.firmaConsentCreate(consentPayload);
      var consentId = null;
      if (consentR && consentR.success && consentR.data) {
        consentId = consentR.data.consent_id;
      } else if (consentR && consentR.error && consentR.error.code === 'CONSENT_PENDING') {
        // Si ya hay un consent PENDING (legacy u otro caso), reusar su id.
        consentId = consentR.error.details && consentR.error.details.consent_id;
      } else {
        self._showToast('Error creando consentimiento: ' + (consentR && consentR.error && consentR.error.message || 'desconocido'), 'error');
        self._restoreEnviarButton(enviarBtn); return;
      }
      if (!consentId) {
        self._showToast('No se obtuvo consent_id. Contacta a RRHH.', 'error');
        self._restoreEnviarButton(enviarBtn); return;
      }
      // 5. Build metadata (Nombres de campos según schema del backend firma-service.
      //    El bridge espera un objeto; firma-client.js lo serializa a JSON string
      //    para el multipart. NO hacer JSON.stringify acá.)
      var cedulaHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(trab.cedula || trab.id));
      var metadata = {
        id_documento: self._firmaDoc.id,
        id_trabajador: trab.cedula || trab.id,
        id_empresa: ctx.idEmpresa,
        tipo_firma: 'remoto',
        agreement_version: agreement.version,
        agreement_hash: agreement.texto_hash,
        document_hash: documentHash,
        version_kair: '0.1.190',
        ttl_horas: 24,
        consent_id: consentId,
        identificacion_tipo: 'CC',
        identificacion_numero_hash: self._bytesToHex(cedulaHash),
        // I-103.A1.5.4-B · REGLA ÚNICA DEL CORREO:
        //   Toda solicitud de firma creada desde K+AIR debe guardar el correo
        //   introducido por el operador en `metadata.correo`. El backend
        //   (services/publicFlow.js#resolveCorreo) usa esto como fuente
        //   primaria para enviar la invitación y el OTP. El
        //   `consent.correo_verificacion` queda como dato histórico
        //   (fallback solo para SR legacy sin metadata.correo).
        //   Sin esta línea, el OTP del firmante se enviaría al correo del
        //   consent (viejo) en lugar del correo actual del operador.
        //   Estructura resultante en BD: `metadata = {"correo": "...", "_server_metadata": {...}}`
        metadata: JSON.stringify({ correo: correoFirmante })
      };
      // 6. Create sign request
      var srR = await window.electronAPI.firmaSignRequestCreate({
        companyName: self.companyName,
        metadata: metadata,
        pdfBuffer: pdfBuffer,
        pdfName: self._firmaDoc.titulo || 'documento.pdf'
      });
      if (!srR || !srR.success || !srR.data) {
        self._showToast('Error creando solicitud de firma: ' + (srR && srR.error && srR.error.message || 'desconocido'), 'error');
        self._restoreEnviarButton(enviarBtn); return;
      }
      // 7. Auto-invitar al firmante con la URL pública.
      //    Este es el ÚNICO correo que sale de K+AIR: la invitación con la URL.
      //    El OTP se generará después en la mini-app vía identify().
      var autoInviteOk = false;
      try {
        var inviteR = await window.electronAPI.firmaSignRequestNotifyRemote(srR.data.id_solicitud, {
          companyName: self.companyName,
          correo: correoFirmante,
          context: { via: 'firma-electronica', button: 'auto' }
        });
        autoInviteOk = !!(inviteR && inviteR.success === true);
        if (!autoInviteOk) {
          self._showToast('No se pudo enviar la invitación automáticamente. Usa "Enviar por correo" en el modal de éxito.', 'warning');
        }
      } catch (e) {
        self._showToast('Error en auto-invitación (no bloquea): ' + (e && e.message || 'desconocido'), 'warning');
      }
      // 7. Update doc state
      await window.electronAPI.ghUpdateDocumento({
        documentoId: self._firmaDoc.id,
        updates: { idSolicitudFirma: srR.data.id_solicitud, estado: 'esperando_firma' }
      });
      // 8. Close firma modal, refetch, show success
      modal.hidden = true;
      await self._reloadData();
      self._renderTabla();
      if (self._lastExpedienteProceso) await self._refetchExpediente(self._lastExpedienteProceso);
      self._abrirModalExito(srR.data, correoFirmante, autoInviteOk);
    } catch (e) {
      self._showToast('Error en flujo de firma: ' + e.message, 'error');
      self._restoreEnviarButton(modal.querySelector('#fe-firma-enviar'));
    }
  };

  // Restaura el botón "Enviar a firma" a su estado inicial.
  FirmaElectronicaComponent.prototype._restoreEnviarButton = function (enviarBtn) {
    if (!enviarBtn) return;
    enviarBtn.disabled = false;
    enviarBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar a firma';
  };

  FirmaElectronicaComponent.prototype._abrirModalExito = function (info, correo, autoInviteOk) {
    var self = this;
    var modal = self.container.querySelector('#fe-firma-success-modal');
    if (!modal) return;
    var idEl = modal.querySelector('#fe-success-id');
    var urlEl = modal.querySelector('#fe-success-url');
    var correoEl = modal.querySelector('#fe-success-correo');
    var copyBtn = modal.querySelector('#fe-success-copy');
    var sendBtn = modal.querySelector('#fe-success-send');
    var feedbackEl = modal.querySelector('#fe-success-feedback');
    if (idEl) idEl.textContent = info.id_solicitud || '';
    if (urlEl) urlEl.value = info.url_publica || '';
    if (correoEl) correoEl.value = correo || '';
    // Banner de auto-invitación (reusa #fe-success-feedback, no agrega HTML).
    // autoInviteOk === true  → enviado automáticamente
    // autoInviteOk === false → fallo, usar botón manual
    // autoInviteOk === undefined → flujo legacy (no se hizo auto), ocultar
    if (feedbackEl) {
      if (autoInviteOk === true) {
        feedbackEl.hidden = false;
        feedbackEl.textContent = 'Invitación enviada automáticamente al firmante.';
        feedbackEl.style.color = '#065f46';
      } else if (autoInviteOk === false) {
        feedbackEl.hidden = false;
        feedbackEl.textContent = 'No se envió la invitación automáticamente. Usa el botón "Enviar por correo" para enviarla manualmente.';
        feedbackEl.style.color = '#92400e';
      } else {
        feedbackEl.hidden = true;
      }
    }
    if (copyBtn) {
      copyBtn.onclick = function () {
        var url = info.url_publica;
        if (!url) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            self._showToast('Enlace copiado al portapapeles', 'success');
          });
        } else {
          var ta = document.createElement('textarea');
          ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); document.body.removeChild(ta);
          self._showToast('Enlace copiado al portapapeles', 'success');
        }
      };
    }
    if (sendBtn) {
      sendBtn.onclick = async function () {
        if (!info.id_solicitud || !correo) return;
        try {
          var r = await window.electronAPI.firmaSignRequestNotifyRemote(info.id_solicitud, {
            companyName: self.companyName, correo: correo,
            context: { via: 'firma-electronica', button: 'enviar-exito' }
          });
          if (feedbackEl) {
            feedbackEl.hidden = false;
            feedbackEl.textContent = (r && r.success) ? 'Correo enviado correctamente.' : 'Error: ' + (r && r.error && r.error.message || 'desconocido');
            feedbackEl.style.color = (r && r.success) ? '#065f46' : '#991b1b';
          }
        } catch (e) {
          if (feedbackEl) { feedbackEl.hidden = false; feedbackEl.textContent = 'Error: ' + e.message; feedbackEl.style.color = '#991b1b'; }
        }
      };
    }
    modal.hidden = false;
  };

  // ═══════════════════════════════════════════════════════════
  // DESCARGAR / VER DOCUMENTO
  // ═══════════════════════════════════════════════════════════

  FirmaElectronicaComponent.prototype._descargarDocumento = async function (docId) {
    if (!docId || !window.electronAPI) return;
    try {
      var r = await window.electronAPI.ghGetDocumento({ documentoId: docId });
      if (!r || !r.success || !r.data || !r.data.documento) {
        this._showToast('No se pudo obtener el documento', 'error');
        return;
      }
      var doc = r.data.documento;
      if (!doc.rutaArchivo) {
        this._showToast('El documento no tiene archivo adjunto', 'warning');
        return;
      }
      await window.electronAPI.ghAbrirDocumento({ documentoId: docId });
    } catch (e) {
      this._showToast('Error descargando: ' + e.message, 'error');
    }
  };

  FirmaElectronicaComponent.prototype._verDocumento = async function (docId) {
    if (!docId || !window.electronAPI) return;
    try {
      await window.electronAPI.ghAbrirDocumento({ documentoId: docId });
    } catch (e) {
      this._showToast('Error abriendo documento: ' + e.message, 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // POLLING (30s)
  // ═══════════════════════════════════════════════════════════

  FirmaElectronicaComponent.prototype._startPolling = function () {
    var self = this;
    if (self._pollingInterval) return;
    self._pollingInterval = setInterval(function () { self._tickPolling(); }, 30000);
  };

  FirmaElectronicaComponent.prototype._stopPolling = function () {
    if (this._pollingInterval) { clearInterval(this._pollingInterval); this._pollingInterval = null; }
  };

  FirmaElectronicaComponent.prototype._tickPolling = async function () {
    var self = this;
    if (!window.electronAPI) return;
    var candidates = self._documentos.filter(function (d) {
      return d.estado === 'esperando_firma' && d.idSolicitudFirma && !self._pollingProcessed[d.idSolicitudFirma];
    });
    if (candidates.length === 0) return;
    var promises = candidates.map(function (d) {
      return window.electronAPI.firmaSignRequestGet(d.idSolicitudFirma, { companyName: self.companyName })
        .then(function (r) { return { doc: d, result: r }; })
        .catch(function () { return { doc: d, result: { success: false } }; });
    });
    var results = await Promise.all(promises);
    var changed = false;
    results.forEach(function (item) {
      if (!item.result || !item.result.success || !item.result.data) return;
      var estado = item.result.data.estado;
      var transicion = _TRANSICION_FIRMA[estado];
      if (!transicion) return;
      self._pollingProcessed[item.doc.idSolicitudFirma] = true;
      if (transicion.estado) {
        var updates = { estado: transicion.estado };
        if (transicion.estado === 'firmado' && item.result.data.fecha_firma) {
          updates.fechaFirma = item.result.data.fecha_firma;
        }
        window.electronAPI.ghUpdateDocumento({ documentoId: item.doc.id, updates: updates });
        item.doc.estado = transicion.estado;
        changed = true;
      }
      self._showToast(transicion.toast, transicion.success ? 'success' : 'warning');
    });
    if (changed) {
      self._calcularProcesos();
      self._renderTabla();
    }
  };

  // ═══════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════

  FirmaElectronicaComponent.prototype._reloadData = async function () {
    var self = this;
    if (!window.electronAPI || !self.companyName) return;
    try {
      var results = await Promise.all([
        window.electronAPI.ghListDocumentos({ companyName: self.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListPersonal({ companyName: self.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListTemplates({ companyName: self.companyName }).catch(function () { return { success: false }; })
      ]);
      self._documentos = results[0].success ? (results[0].data.documentos || []) : [];
      self._trabajadores = results[1].success ? (results[1].data.personales || []) : [];
      self._templates = results[2].success ? (results[2].data.templates || []) : [];
      self._trabajadorById = {};
      self._trabajadores.forEach(function (t) { self._trabajadorById[t.id] = t; });
      self._templateById = {};
      self._templates.forEach(function (t) { self._templateById[t.id] = t; });
      self._calcularProcesos();
    } catch (e) { /* silent */ }
  };

  FirmaElectronicaComponent.prototype._base64ToBytes = function (b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  FirmaElectronicaComponent.prototype._bytesToHex = function (buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  };

  FirmaElectronicaComponent.prototype._showToast = function (msg, type) {
    var self = this;
    if (!self._toast) return;
    self._toast.className = 'fe-toast fe-toast--' + (type || 'info');
    self._toast.textContent = msg;
    self._toast.hidden = false;
    clearTimeout(self._toastTimer);
    self._toastTimer = setTimeout(function () {
      self._toast.hidden = true;
    }, 3500);
  };

  FirmaElectronicaComponent.prototype.destroy = function () {
    var self = this;
    self._stopPolling();
    if (self._toastTimer) clearTimeout(self._toastTimer);
    if (self._escKeyHandler) {
      document.removeEventListener('keydown', self._escKeyHandler);
      self._escKeyHandler = null;
    }
    if (self._modal && !self._modal.hidden) self._cerrarModal();
    if (self.container) self.container.innerHTML = '';
    self.container = null;
  };

  // Exponer en window para que gestion-humana-home.js lo monte
  window[COMPONENT_NAME] = FirmaElectronicaComponent;
})();
