(function () {
'use strict';

var AUTOSAVE_INTERVAL = 30000;
var DRAFT_KEY_PREFIX = 'kair_inspecciones_draft_';
var MONTHS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

var FormularioInsp = {
  companyName: null,
  currentType: 'EXTINTOR',
  currentFilePath: null,
  currentMonth: null,
  currentYear: null,
  availableFiles: [],
  justSaved: false,
  savedType: null,
  templateData: null,
  autoSaveTimer: null,
  hasUnsavedChanges: false,
  loadedTypes: {},

  load: function (companyName) {
    this.companyName = companyName;

    if (this.justSaved) {
      this._renderTabs();
      this._renderPeriodBar();
      this._showSaveSuccess(this.savedType);
      this.justSaved = false;
      this.savedType = null;
      return;
    }

    this.templateData = null;
    this.hasUnsavedChanges = false;
    this.loadedTypes = {};
    this.currentFilePath = null;
    this.currentMonth = null;
    this.currentYear = null;
    this.availableFiles = [];
    this.clearAutoSave();
    this._renderTabs();
    this._loadType(this.currentType);
  },

  _renderTabs: function () {
    var container = document.getElementById('kair-insp-formulario-content');
    if (!container) return;

    var types = InspeccionesService.TYPES;
    var tabsHtml = '<div class="kair-insp__form-type-tabs">';
    types.forEach(function (t) {
      tabsHtml += '<button class="kair-insp__form-type-tab' + (t.code === this.currentType ? ' active' : '') + '" data-type="' + t.code + '">' +
        '<i class="bi ' + t.icon + '"></i> ' + t.name +
        '</button>';
    }.bind(this));
    tabsHtml += '</div>';
    tabsHtml += '<div id="kair-insp-period-bar" class="kair-insp__period-bar"></div>';
    tabsHtml += '<div id="kair-insp-formulario-body"></div>';

    container.innerHTML = tabsHtml;

    var tabBtns = container.querySelectorAll('.kair-insp__form-type-tab');
    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var type = btn.getAttribute('data-type');
        if (type && type !== this.currentType) {
          if (this.hasUnsavedChanges) {
            this._saveCurrentDraft();
          }
          this.justSaved = false;
          this.savedType = null;
          this.currentType = type;
          this.currentFilePath = null;
          this.currentMonth = null;
          this.currentYear = null;
          this.availableFiles = [];
          tabBtns.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          this._loadType(type);
        }
      }.bind(this));
    }.bind(this));
  },

  _loadType: function (type) {
    var body = document.getElementById('kair-insp-formulario-body');
    if (!body) return;

    this.currentType = type;
    this.currentFilePath = null;
    this.currentMonth = null;
    this.currentYear = null;

    body.innerHTML = '<div class="kair-insp-loading"><div class="kair-insp-spinner"></div><p>Cargando inspecciones ' + InspeccionesService.getTypeLabel(type) + '...</p></div>';

    var self = this;
    InspeccionesService.listFilesByType(this.companyName, type).then(function (listResult) {
      if (!listResult.success) {
        body.innerHTML = '<div class="kair-insp-empty-state"><i class="bi bi-exclamation-circle"></i><h3>Error</h3><p>' + (listResult.error ? listResult.error.message : 'No se pudieron listar los archivos') + '</p></div>';
        return;
      }

      self.availableFiles = listResult.data.files;
      self._renderPeriodBar();

      if (self.availableFiles.length === 0) {
        body.innerHTML = '<div class="kair-insp-empty-state"><i class="bi bi-inbox"></i><h3>Sin inspecciones</h3><p>No hay inspecciones de ' + InspeccionesService.getTypeLabel(type) + '. Use el boton <strong>"Nueva Inspeccion"</strong> para crear una.</p></div>';
        return;
      }

      var latestFile = self.availableFiles[0];
      self.currentFilePath = latestFile.path;
      self.currentMonth = latestFile.month;
      self.currentYear = latestFile.year;
      self._renderPeriodBar();
      self._loadFileByPath(latestFile.path);
    }).catch(function (err) {
      console.error('[4.2.4] listFilesByType error:', err);
      body.innerHTML = '<div class="kair-insp-empty-state"><i class="bi bi-exclamation-circle"></i><h3>Error de conexion</h3><p>No se pudo conectar con el backend</p></div>';
    });
  },

  _loadFileByPath: function (filePath) {
    var body = document.getElementById('kair-insp-formulario-body');
    if (!body) return;

    this.currentFilePath = filePath;

    var matchingFile = this.availableFiles.find(function (f) { return f.path === filePath; });
    if (matchingFile) {
      this.currentMonth = matchingFile.month;
      this.currentYear = matchingFile.year;
    }

    body.innerHTML = '<div class="kair-insp-loading"><div class="kair-insp-spinner"></div><p>Cargando formulario...</p></div>';

    InspeccionesService.readExcelByPath(this.companyName, this.currentType, filePath).then(function (result) {
      if (!result.success) {
        body.innerHTML = '<div class="kair-insp-empty-state"><i class="bi bi-exclamation-circle"></i><h3>Error</h3><p>' + (result.error ? result.error.message : 'No se pudo cargar la plantilla') + '</p></div>';
        return;
      }
      this.templateData = result.data;
      this._renderBody(result.data);
      this._restoreDraft(this.currentType);
      this.startAutoSave();
    }.bind(this)).catch(function (err) {
      console.error('[4.2.4] readExcelByPath error:', err);
      body.innerHTML = '<div class="kair-insp-empty-state"><i class="bi bi-exclamation-circle"></i><h3>Error de conexion</h3><p>No se pudo conectar con el backend</p></div>';
    }.bind(this));
  },

  _renderPeriodBar: function () {
    var bar = document.getElementById('kair-insp-period-bar');
    if (!bar) return;

    var selectHtml = '<select class="kair-insp__period-select" id="kair-insp-period-select">';
    if (this.availableFiles.length === 0) {
      selectHtml += '<option value="">Sin inspecciones</option>';
    } else {
      this.availableFiles.forEach(function (f) {
        var sel = (f.path === this.currentFilePath) ? ' selected' : '';
        selectHtml += '<option value="' + this._esc(f.path) + '"' + sel + '>' + this._esc(f.periodLabel) + '</option>';
      }.bind(this));
    }
    selectHtml += '</select>';

    var periodInfo = '';
    if (this.currentMonth && this.currentYear) {
      periodInfo = '<span class="kair-insp__period-info"><i class="bi bi-calendar3"></i> ' + MONTHS_FULL[this.currentMonth - 1] + ' ' + this.currentYear + '</span>';
    }

    bar.innerHTML = '<div class="kair-insp__period-bar-inner">' +
      '<div class="kair-insp__period-left">' +
      '<i class="bi bi-folder2-open"></i> ' +
      selectHtml +
      periodInfo +
      '</div>' +
      '<div class="kair-insp__period-right">' +
      '<button class="kair-insp-btn kair-insp-btn--secondary kair-insp-btn--sm" id="kair-insp-new-inspection"><i class="bi bi-plus-lg"></i> Nueva Inspeccion</button>' +
      '</div>' +
      '</div>';

    var selectEl = bar.querySelector('#kair-insp-period-select');
    if (selectEl) {
      selectEl.addEventListener('change', function () {
        var chosenPath = selectEl.value;
        if (chosenPath && chosenPath !== this.currentFilePath) {
          if (this.hasUnsavedChanges) {
            this._saveCurrentDraft();
          }
          this._loadFileByPath(chosenPath);
        }
      }.bind(this));
    }

    var newBtn = bar.querySelector('#kair-insp-new-inspection');
    if (newBtn) {
      newBtn.addEventListener('click', function () {
        this._showNewInspectionModal();
      }.bind(this));
    }
  },

  _showNewInspectionModal: function () {
    var existingModal = document.getElementById('kair-insp-new-modal-overlay');
    if (existingModal) existingModal.remove();

    var now = new Date();
    var curMonth = now.getMonth() + 1;
    var curYear = now.getFullYear();

    var monthOptions = '';
    for (var m = 1; m <= 12; m++) {
      monthOptions += '<option value="' + m + '"' + (m === curMonth ? ' selected' : '') + '>' + MONTHS_FULL[m - 1] + '</option>';
    }

    var yearOptions = '';
    for (var y = curYear - 1; y <= curYear + 2; y++) {
      yearOptions += '<option value="' + y + '"' + (y === curYear ? ' selected' : '') + '>' + y + '</option>';
    }

    var overlay = document.createElement('div');
    overlay.id = 'kair-insp-new-modal-overlay';
    overlay.className = 'kair-insp__modal-overlay';
    overlay.innerHTML =
      '<div class="kair-insp__modal">' +
        '<div class="kair-insp__modal-header">' +
          '<h3 class="kair-insp__modal-title"><i class="bi bi-plus-circle"></i> Nueva Inspeccion</h3>' +
          '<button class="kair-insp__modal-close" id="kair-insp-new-modal-close"><i class="bi bi-x-lg"></i></button>' +
        '</div>' +
        '<div class="kair-insp__modal-body">' +
          '<p class="kair-insp__modal-desc">Se creara un nuevo archivo de inspeccion para el periodo seleccionado.</p>' +
          '<div class="kair-insp__modal-field">' +
            '<label for="kair-insp-new-month">Mes</label>' +
            '<select id="kair-insp-new-month" class="kair-insp__modal-select">' + monthOptions + '</select>' +
          '</div>' +
          '<div class="kair-insp__modal-field">' +
            '<label for="kair-insp-new-year">Ano</label>' +
            '<select id="kair-insp-new-year" class="kair-insp__modal-select">' + yearOptions + '</select>' +
          '</div>' +
        '</div>' +
        '<div class="kair-insp__modal-footer">' +
          '<button class="kair-insp-btn kair-insp-btn--ghost" id="kair-insp-new-modal-cancel">Cancelar</button>' +
          '<button class="kair-insp-btn kair-insp-btn--primary" id="kair-insp-new-modal-confirm"><i class="bi bi-plus-lg"></i> Crear</button>' +
        '</div>' +
      '</div>';

    var wrapper = document.querySelector('.kair-insp-wrapper');
  (wrapper || document.body).appendChild(overlay);

    var closeModal = function () {
      var el = document.getElementById('kair-insp-new-modal-overlay');
      if (el) el.remove();
    };

    overlay.querySelector('#kair-insp-new-modal-close').addEventListener('click', closeModal);
    overlay.querySelector('#kair-insp-new-modal-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    overlay.querySelector('#kair-insp-new-modal-confirm').addEventListener('click', function () {
      var month = parseInt(document.getElementById('kair-insp-new-month').value, 10);
      var year = parseInt(document.getElementById('kair-insp-new-year').value, 10);
      closeModal();
      this._createNewInspection(month, year);
    }.bind(this));
  },

  _createNewInspection: function (month, year) {
    var self = this;
    InspeccionesService.toast('Creando inspeccion...', 'info');

    InspeccionesService.createInspection(this.companyName, this.currentType, month, year).then(function (result) {
      if (!result.success) {
        InspeccionesService.toast('Error al crear: ' + (result.error ? result.error.message : 'Desconocido'), 'error');
        return;
      }

      var data = result.data;
      self.currentFilePath = data.filePath;
      self.currentMonth = month;
      self.currentYear = year;

      if (data.alreadyExists) {
        InspeccionesService.toast('La inspeccion ya existe, abriendo...', 'warning');
      } else {
        InspeccionesService.toast('Inspeccion creada correctamente', 'success');
      }

      return InspeccionesService.listFilesByType(self.companyName, self.currentType);
    }).then(function (listResult) {
      if (listResult && listResult.success) {
        self.availableFiles = listResult.data.files;
        self._renderPeriodBar();
      }
      return self._loadFileByPath(self.currentFilePath);
    }).catch(function (err) {
      console.error('[4.2.4] createInspection error:', err);
      InspeccionesService.toast('Error al crear inspeccion', 'error');
    });
  },

  _renderBody: function (data) {
    var body = document.getElementById('kair-insp-formulario-body');
    if (!body) return;

    var html = '';
    html += this._renderHeaderFields(data);
    html += this._renderItemsTable(data);
    if (data.checkRows && data.checkRows.length > 0) {
      html += this._renderCheckRows(data);
    }
    if (data.generalObservations !== undefined && data.generalObservations !== null) {
      html += this._renderGeneralObs(data);
    }
    html += this._renderActions(data);

    body.innerHTML = html;
    this._bindBodyEvents();
  },

  _renderHeaderFields: function (data) {
    var config = this._getConfig(data.type);
    if (!config || !config.headerFields) return '';

    var headerFields = data.headerFields || {};
    var fieldsHtml = '';

    config.headerFields.forEach(function (hf) {
      var val = headerFields[hf.key] || '';
      var inputId = 'kair-insp-hf-' + hf.key;
      fieldsHtml += '<div class="kair-insp__form-hf-group">' +
        '<label class="kair-insp__form-hf-label" for="' + inputId + '">' + hf.label + '</label>' +
        '<input type="text" class="kair-insp__form-hf-input" id="' + inputId + '" data-hf-key="' + hf.key + '" value="' + this._esc(val) + '">' +
        '</div>';
    }.bind(this));

    if (config.signFields && data.signFields) {
      config.signFields.forEach(function (sf) {
        var val = data.signFields[sf.key] || '';
        var inputId = 'kair-insp-sf-' + sf.key;
        fieldsHtml += '<div class="kair-insp__form-hf-group">' +
          '<label class="kair-insp__form-hf-label" for="' + inputId + '">' + sf.label + '</label>' +
          '<input type="text" class="kair-insp__form-hf-input" id="' + inputId + '" data-sf-key="' + sf.key + '" value="' + this._esc(val) + '">' +
          '</div>';
      }.bind(this));
    }

    if (!fieldsHtml) return '';

    return '<div class="kair-insp__form-header-fields">' +
      '<div class="kair-insp__form-meta-item"><i class="bi bi-file-earmark-text"></i> Formato ' + data.code + '</div>' +
      '<div class="kair-insp__form-hf-grid">' + fieldsHtml + '</div>' +
      '<div class="kair-insp__form-autosave" id="kair-insp-autosave-indicator">' +
      '<div class="kair-insp__form-autosave-dot"></div>' +
      '<span id="kair-insp-autosave-text">Guardado</span>' +
      '</div>' +
      '</div>';
  },

  _renderItemsTable: function (data) {
    var items = data.items || [];
    var structure = data.structure || {};
    var headerCells = structure.headerCells || [];
    var sections = data.sections || [];
    var type = data.type;

    var theadHtml = '<tr><th style="width:32px">#</th>';
    headerCells.forEach(function (hc) {
      var widthStyle = '';
      if (hc.type === 'check') widthStyle = ' style="width:70px;"';
      else if (hc.type === 'select') widthStyle = ' style="width:90px;"';
      theadHtml += '<th' + widthStyle + '>' + this._esc(hc.label) + '</th>';
    }.bind(this));
    theadHtml += '</tr>';

    var sectionRowMap = {};
    if (sections.length > 0) {
      sections.forEach(function (sec) {
        sectionRowMap[sec.row] = sec.label;
      });
    }

    var tbodyHtml = '';
    var itemIdx = 0;

    if (sections.length > 0) {
      var sortedSections = sections.slice().sort(function (a, b) { return a.row - b.row; });
      sortedSections.forEach(function (sec, secIdx) {
        tbodyHtml += '<tr class="kair-insp__form-section-row"><td colspan="' + (headerCells.length + 1) + '">' +
          '<i class="bi bi-dash-lg"></i> ' + this._esc(sec.label) + '</td></tr>';

        var sectionItems = items.filter(function (item) {
          if (secIdx < sortedSections.length - 1) {
            return item.row >= sec.row && item.row < sortedSections[secIdx + 1].row;
          }
          return item.row >= sec.row;
        });

        sectionItems.forEach(function (item) {
          itemIdx++;
          tbodyHtml += this._renderItemRow(item, itemIdx, headerCells, type);
        }.bind(this));
      }.bind(this));
    } else {
      items.forEach(function (item) {
        itemIdx++;
        tbodyHtml += this._renderItemRow(item, itemIdx, headerCells, type);
      }.bind(this));
    }

    return '<div class="kair-insp__form-table-wrapper">' +
      '<table class="kair-insp__form-table">' +
      '<thead>' + theadHtml + '</thead>' +
      '<tbody>' + tbodyHtml + '</tbody>' +
      '</table>' +
      '</div>';
  },

  _renderItemRow: function (item, idx, headerCells, type) {
    var rowHtml = '<tr data-row="' + item.row + '">';
    rowHtml += '<td class="kair-insp__form-row-num">' + idx + '</td>';

    headerCells.forEach(function (hc) {
      var val = item[hc.field] !== undefined ? item[hc.field] : '';
      var isReadOnly = hc.readOnly || false;

      if (isReadOnly) {
        rowHtml += '<td class="kair-insp__form-cell-readonly">' + this._esc(val) + '</td>';
      } else if (hc.type === 'select') {
        rowHtml += '<td>' + this._buildSelect(hc.field, val, hc.options || []) + '</td>';
      } else if (hc.type === 'check') {
        rowHtml += '<td>' + this._buildRadio(hc.field, val, hc.options || [], item.row) + '</td>';
      } else {
        rowHtml += '<td><input type="text" class="kair-insp__form-input" data-field="' + hc.field + '" value="' + this._esc(val) + '"></td>';
      }
    }.bind(this));

    rowHtml += '</tr>';
    return rowHtml;
  },

  _renderCheckRows: function (data) {
    var checkRows = data.checkRows || [];
    var html = '<div class="kair-insp__form-check-rows">';
    checkRows.forEach(function (cr) {
      var val = cr.value || '';
      html += '<div class="kair-insp__form-check-row">' +
        '<span class="kair-insp__form-check-label">' + this._esc(cr.label) + '</span>' +
        this._buildRadio(cr.field, val, cr.options || [], 'cr-' + cr.row) +
        '</div>';
    }.bind(this));
    html += '</div>';
    return html;
  },

  _renderGeneralObs: function (data) {
    var val = data.generalObservations || '';
    return '<div class="kair-insp__form-general-obs">' +
      '<label class="kair-insp__form-hf-label">Observaciones Generales</label>' +
      '<textarea class="kair-insp__form-textarea" id="kair-insp-general-obs" rows="3">' + this._esc(val) + '</textarea>' +
      '</div>';
  },

  _renderActions: function (data) {
    return '<div class="kair-insp__form-actions">' +
      '<button class="kair-insp-btn kair-insp-btn--ghost" id="kair-insp-form-reset"><i class="bi bi-arrow-counterclockwise"></i> Restaurar</button>' +
      '<button class="kair-insp-btn kair-insp-btn--primary" id="kair-insp-form-save"><i class="bi bi-floppy"></i> Guardar</button>' +
      '</div>';
  },

  _buildSelect: function (field, currentValue, options) {
    var stateClass = this._getStateClass(currentValue);
    var html = '<select class="kair-insp__form-select ' + stateClass + '" data-field="' + field + '">';
    html += '<option value="">--</option>';
    options.forEach(function (opt) {
      var selected = opt === currentValue ? ' selected' : '';
      html += '<option value="' + this._esc(opt) + '"' + selected + '>' + this._esc(opt) + '</option>';
    }.bind(this));
    html += '</select>';
    return html;
  },

  _buildRadio: function (field, currentValue, options, rowId) {
    var html = '<div class="kair-insp__form-radio-group" data-field="' + field + '" data-row-id="' + rowId + '">';
    options.forEach(function (opt) {
      if (!opt) return;
      var checked = opt === currentValue ? ' checked' : '';
      var radioClass = 'kair-insp__form-radio';
      if (opt === 'SI' || opt === 'BUENO') radioClass += ' kair-insp__form-radio--ok';
      else if (opt === 'NO' || opt === 'MALO') radioClass += ' kair-insp__form-radio--bad';
      else if (opt === 'N/A') radioClass += ' kair-insp__form-radio--na';
      html += '<label class="' + radioClass + '">' +
        '<input type="radio" name="radio-' + field + '-' + rowId + '" value="' + this._esc(opt) + '"' + checked + ' data-field="' + field + '">' +
        '<span>' + this._esc(opt) + '</span>' +
        '</label>';
    }.bind(this));
    html += '</div>';
    return html;
  },

  _bindBodyEvents: function () {
    var body = document.getElementById('kair-insp-formulario-body');
    if (!body) return;

    body.addEventListener('change', function (e) {
      if (e.target.classList.contains('kair-insp__form-select')) {
        var newClass = this._getStateClass(e.target.value);
        e.target.className = 'kair-insp__form-select ' + newClass;
        this.markDirty();
      }
      if (e.target.classList.contains('kair-insp__form-input') || e.target.classList.contains('kair-insp__form-hf-input')) {
        this.markDirty();
      }
      if (e.target.classList.contains('kair-insp__form-textarea')) {
        this.markDirty();
      }
      if (e.target.type === 'radio' && e.target.name && e.target.name.indexOf('radio-') === 0) {
        this.markDirty();
      }
    }.bind(this));

    body.addEventListener('input', function (e) {
      if (e.target.classList.contains('kair-insp__form-input') || e.target.classList.contains('kair-insp__form-hf-input') || e.target.classList.contains('kair-insp__form-textarea')) {
        this.markDirty();
      }
    }.bind(this));

    var resetBtn = body.querySelector('#kair-insp-form-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        this.clearDraft(this.currentType);
        if (this.currentFilePath) {
          this._loadFileByPath(this.currentFilePath);
        } else {
          this._loadType(this.currentType);
        }
      }.bind(this));
    }

    var saveBtn = body.querySelector('#kair-insp-form-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        this.saveForm();
      }.bind(this));
    }
  },

  _getConfig: function (type) {
    var configs = {
      EXTINTOR: {
        headerFields: [
          { key: 'fecha', label: 'Fecha de realización' },
          { key: 'inspector', label: 'Realizada por' },
          { key: 'cargo', label: 'Cargo' }
        ]
      },
      INSTALACION: {
        headerFields: [
          { key: 'fecha', label: 'Fecha' },
          { key: 'lugar', label: 'Lugar' }
        ],
        signFields: [
          { key: 'inspeccionadoPor', label: 'Inspeccionado por' },
          { key: 'cargoFirma', label: 'Cargo' }
        ]
      },
      EMERGENCIA: {
        headerFields: [
          { key: 'fecha', label: 'Fecha' },
          { key: 'sitio', label: 'Sitio de Inspección' }
        ]
      },
      BOTIQUIN: {
        headerFields: [
          { key: 'fecha', label: 'Fecha' },
          { key: 'realizadoPor', label: 'Realizado por' }
        ]
      }
    };
    return configs[type] || null;
  },

  markDirty: function () {
    this.hasUnsavedChanges = true;
    var indicator = document.getElementById('kair-insp-autosave-indicator');
    var text = document.getElementById('kair-insp-autosave-text');
    if (indicator) indicator.classList.add('kair-insp__form-autosave--saving');
    if (text) text.textContent = 'Sin guardar';
  },

  markClean: function () {
    this.hasUnsavedChanges = false;
    var indicator = document.getElementById('kair-insp-autosave-indicator');
    var text = document.getElementById('kair-insp-autosave-text');
    if (indicator) indicator.classList.remove('kair-insp__form-autosave--saving');
    if (text) text.textContent = 'Guardado';
  },

  startAutoSave: function () {
    this.clearAutoSave();
    this.autoSaveTimer = setInterval(function () {
      if (this.hasUnsavedChanges) {
        this._saveCurrentDraft();
        this.markClean();
      }
    }.bind(this), AUTOSAVE_INTERVAL);
  },

  clearAutoSave: function () {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  },

  _saveCurrentDraft: function () {
    var formData = this.collectFormData();
    if (formData) {
      try {
        var key = this._draftKey();
        localStorage.setItem(key, JSON.stringify(formData));
      } catch (e) { /* ignore */ }
    }
  },

  _restoreDraft: function (type) {
    try {
      var key = this._draftKey();
      var raw = localStorage.getItem(key);
      if (!raw) return;
      var draft = JSON.parse(raw);
      this._applyDraft(draft);
    } catch (e) { /* ignore */ }
  },

  _draftKey: function () {
    var suffix = this.currentFilePath ? btoa(this.currentFilePath).replace(/=/g, '') : this.currentType;
    return DRAFT_KEY_PREFIX + suffix;
  },

  _applyDraft: function (draft) {
    var body = document.getElementById('kair-insp-formulario-body');
    if (!body) return;

    if (draft.headerFields) {
      Object.keys(draft.headerFields).forEach(function (key) {
        var input = body.querySelector('[data-hf-key="' + key + '"]');
        if (input) input.value = draft.headerFields[key];
      });
    }

    if (draft.signFields) {
      Object.keys(draft.signFields).forEach(function (key) {
        var input = body.querySelector('[data-sf-key="' + key + '"]');
        if (input) input.value = draft.signFields[key];
      });
    }

    if (draft.generalObservations !== undefined) {
      var obsEl = body.querySelector('#kair-insp-general-obs');
      if (obsEl) obsEl.value = draft.generalObservations;
    }

    if (draft.items) {
      draft.items.forEach(function (draftItem) {
        var row = body.querySelector('tr[data-row="' + draftItem.row + '"]');
        if (!row) return;
        Object.keys(draftItem).forEach(function (field) {
          if (field === 'row') return;
          var input = row.querySelector('[data-field="' + field + '"]');
          if (!input) return;
          if (input.tagName === 'SELECT') {
            input.value = draftItem[field];
            var newClass = this._getStateClass(draftItem[field]);
            input.className = 'kair-insp__form-select ' + newClass;
          } else if (input.tagName === 'INPUT' && input.type === 'text') {
            input.value = draftItem[field];
          } else if (input.type === 'radio') {
            var radios = row.querySelectorAll('input[type="radio"][data-field="' + field + '"]');
            radios.forEach(function (r) { r.checked = (r.value === draftItem[field]); });
          }
        }.bind(this));
      }.bind(this));
    }

    if (draft.checkRows) {
      draft.checkRows.forEach(function (crVal, idx) {
        var crGroup = body.querySelector('.kair-insp__form-radio-group[data-row-id="cr-' + (idx + 1) + '"]');
        if (!crGroup) return;
        var radios = crGroup.querySelectorAll('input[type="radio"]');
        radios.forEach(function (r) { r.checked = (r.value === crVal); });
      });
    }

    this.markDirty();
  },

  clearDraft: function (type) {
    try { localStorage.removeItem(this._draftKey()); } catch (e) { /* ignore */ }
  },

  collectFormData: function () {
    if (!this.templateData) return null;
    var body = document.getElementById('kair-insp-formulario-body');
    if (!body) return null;

    var headerFields = {};
    body.querySelectorAll('[data-hf-key]').forEach(function (el) {
      headerFields[el.getAttribute('data-hf-key')] = el.value;
    });

    var signFields = {};
    body.querySelectorAll('[data-sf-key]').forEach(function (el) {
      signFields[el.getAttribute('data-sf-key')] = el.value;
    });

    var items = [];
    var rows = body.querySelectorAll('.kair-insp__form-table tbody tr[data-row]');
    rows.forEach(function (row) {
      if (row.classList.contains('kair-insp__form-section-row')) return;
      var item = { row: parseInt(row.getAttribute('data-row'), 10) };

      row.querySelectorAll('.kair-insp__form-input').forEach(function (input) {
        item[input.getAttribute('data-field')] = input.value;
      });

      row.querySelectorAll('.kair-insp__form-select').forEach(function (sel) {
        item[sel.getAttribute('data-field')] = sel.value;
      });

      var radioGroups = {};
      row.querySelectorAll('input[type="radio"]').forEach(function (radio) {
        var field = radio.getAttribute('data-field');
        if (!radioGroups[field]) radioGroups[field] = [];
        radioGroups[field].push(radio);
      });
      Object.keys(radioGroups).forEach(function (field) {
        var checked = radioGroups[field].find(function (r) { return r.checked; });
        if (checked) item[field] = checked.value;
      });

      items.push(item);
    });

    var generalObservations = '';
    var obsEl = body.querySelector('#kair-insp-general-obs');
    if (obsEl) generalObservations = obsEl.value;

    var checkRows = [];
    body.querySelectorAll('.kair-insp__form-check-rows .kair-insp__form-radio-group').forEach(function (group) {
      var checked = group.querySelector('input[type="radio"]:checked');
      checkRows.push(checked ? checked.value : '');
    });

    return {
      type: this.currentType,
      code: this.templateData.code,
      headerFields: headerFields,
      signFields: signFields,
      generalObservations: generalObservations,
      items: items,
      checkRows: checkRows.length > 0 ? checkRows : undefined
    };
  },

  saveForm: function () {
    var formData = this.collectFormData();
    if (!formData) {
      InspeccionesService.toast('No hay datos para guardar', 'warning');
      return;
    }

    if (!this.currentFilePath) {
      InspeccionesService.toast('No hay archivo seleccionado para guardar', 'warning');
      return;
    }

    var type = this.currentType;
    var filePath = this.currentFilePath;
    var self = this;

    var saveBtn = document.getElementById('kair-insp-form-save');
    var resetBtn = document.getElementById('kair-insp-form-reset');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';
    }
    if (resetBtn) resetBtn.disabled = true;

    InspeccionesService.writeExcelByPath(this.companyName, type, formData, filePath).then(function (result) {
      if (result.success) {
        self.markClean();
        self.clearDraft(type);
        self.clearAutoSave();
        self.templateData = null;
        self.justSaved = true;
        self.savedType = type;
        self._showSaveSuccess(type);
      } else {
        InspeccionesService.toast('Error al guardar: ' + (result.error ? result.error.message : 'Desconocido'), 'error');
        self._restoreSaveButtons();
      }
    }).catch(function (err) {
      console.error('[4.2.4] writeExcelByPath error:', err);
      InspeccionesService.toast('Error al guardar en Excel', 'error');
      self._restoreSaveButtons();
    });
  },

  _restoreSaveButtons: function () {
    var saveBtn = document.getElementById('kair-insp-form-save');
    var resetBtn = document.getElementById('kair-insp-form-reset');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="bi bi-floppy"></i> Guardar';
    }
    if (resetBtn) resetBtn.disabled = false;
  },

  _showSaveSuccess: function (type) {
    var body = document.getElementById('kair-insp-formulario-body');
    if (!body) return;

    var typeLabel = InspeccionesService.getTypeLabel(type);
    var periodLabel = '';
    if (this.currentMonth && this.currentYear) {
      periodLabel = MONTHS_FULL[this.currentMonth - 1] + ' ' + this.currentYear;
    }

    body.innerHTML =
      '<div class="kair-insp__save-success">' +
        '<div class="kair-insp__save-success-icon"><i class="bi bi-check-circle-fill"></i></div>' +
        '<h3 class="kair-insp__save-success-title">Inspeccion Guardada</h3>' +
        '<p class="kair-insp__save-success-period">' + this._esc(periodLabel ? periodLabel + ' — ' + typeLabel : typeLabel) + '</p>' +
        '<p class="kair-insp__save-success-desc">Los datos se guardaron correctamente en el archivo Excel.</p>' +
        '<div class="kair-insp__save-success-actions">' +
          '<button class="kair-insp-btn kair-insp-btn--secondary" id="kair-insp-save-success-new"><i class="bi bi-plus-lg"></i> Nueva Inspeccion</button>' +
          '<button class="kair-insp-btn kair-insp-btn--ghost" id="kair-insp-save-success-historial"><i class="bi bi-clipboard-check"></i> Volver al Historial</button>' +
        '</div>' +
      '</div>';

    var newBtn = body.querySelector('#kair-insp-save-success-new');
    if (newBtn) {
      newBtn.addEventListener('click', function () {
        this.justSaved = false;
        this.savedType = null;
        this._showNewInspectionModal();
      }.bind(this));
    }

    var histBtn = body.querySelector('#kair-insp-save-success-historial');
    if (histBtn) {
      histBtn.addEventListener('click', function () {
        this.justSaved = false;
        this.savedType = null;
        this._navigateToHistorial();
      }.bind(this));
    }
  },

  _navigateToHistorial: function () {
    var tabBtn = document.querySelector('.k-insp-tab[data-view="historial"]');
    if (tabBtn) tabBtn.click();
  },

  _esc: function (val) {
    if (!val) return '';
    return String(val).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  _getStateClass: function (value) {
    if (value === 'BUENO' || value === 'OK' || value === 'SI') return 'kair-insp__form-select--bueno';
    if (value === 'MALO' || value === 'NO') return 'kair-insp__form-select--malo';
    if (value === 'REGULAR' || value === 'BAJO') return 'kair-insp__form-select--regular';
    if (value === 'N/A') return 'kair-insp__form-select--na';
    return '';
  },

  navigateToType: function (type) {
    var tabBtn = document.querySelector('.kair-insp__form-type-tab[data-type="' + type + '"]');
    if (tabBtn) {
      tabBtn.click();
    } else {
      this.currentType = type;
      this._renderTabs();
      this._loadType(type);
    }
  },

  openFile: function (type, filePath) {
    if (type !== this.currentType) {
      this.currentType = type;
      this._renderTabs();
      this._loadType(type);
      return;
    }
    if (filePath !== this.currentFilePath) {
      if (this.hasUnsavedChanges) {
        this._saveCurrentDraft();
      }
      this._loadFileByPath(filePath);
    }
  },

  showNewInspectionModal: function () {
    this._showNewInspectionModal();
  }
};

window.FormularioInsp = FormularioInsp;
})();
