(function () {
'use strict';

var AUTOSAVE_INTERVAL = 30000;
var DRAFT_KEY_PREFIX = 'kair_inspecciones_draft_';

var FormularioInsp = {
  companyName: null,
  currentType: 'EXTINTOR',
  templateData: null,
  autoSaveTimer: null,
  hasUnsavedChanges: false,
  loadedTypes: {},

  load: function (companyName) {
    this.companyName = companyName;
    this.templateData = null;
    this.hasUnsavedChanges = false;
    this.loadedTypes = {};
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
          this.currentType = type;
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

    if (this.loadedTypes[type]) {
      this.templateData = this.loadedTypes[type];
      this._renderBody(this.templateData);
      this._restoreDraft(type);
      this.startAutoSave();
      return;
    }

    body.innerHTML = '<div class="kair-insp-loading"><div class="kair-insp-spinner"></div><p>Cargando formulario ' + InspeccionesService.getTypeLabel(type) + '...</p></div>';

    InspeccionesService.readExcel(this.companyName, type).then(function (result) {
      if (!result.success) {
        body.innerHTML = '<div class="kair-insp-empty-state"><i class="bi bi-exclamation-circle"></i><h3>Error</h3><p>' + (result.error ? result.error.message : 'No se pudo cargar la plantilla') + '</p></div>';
        return;
      }
      this.loadedTypes[type] = result.data;
      this.templateData = result.data;
      this._renderBody(result.data);
      this._restoreDraft(type);
      this.startAutoSave();
    }.bind(this)).catch(function (err) {
      console.error('[4.2.4] readExcel error:', err);
      body.innerHTML = '<div class="kair-insp-empty-state"><i class="bi bi-exclamation-circle"></i><h3>Error de conexión</h3><p>No se pudo conectar con el backend</p></div>';
    }.bind(this));
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
      '<button class="kair-insp-btn kair-insp-btn--success" id="kair-insp-form-save-excel"><i class="bi bi-file-earmark-spreadsheet"></i> Guardar en Excel</button>' +
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
        delete this.loadedTypes[this.currentType];
        this._loadType(this.currentType);
      }.bind(this));
    }

    var saveBtn = body.querySelector('#kair-insp-form-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        this.saveForm(false);
      }.bind(this));
    }

    var saveExcelBtn = body.querySelector('#kair-insp-form-save-excel');
    if (saveExcelBtn) {
      saveExcelBtn.addEventListener('click', function () {
        this.saveForm(true);
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
        localStorage.setItem(DRAFT_KEY_PREFIX + this.currentType, JSON.stringify(formData));
      } catch (e) { /* ignore */ }
    }
  },

  _restoreDraft: function (type) {
    try {
      var raw = localStorage.getItem(DRAFT_KEY_PREFIX + type);
      if (!raw) return;
      var draft = JSON.parse(raw);
      this._applyDraft(draft);
    } catch (e) { /* ignore */ }
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
    try { localStorage.removeItem(DRAFT_KEY_PREFIX + (type || this.currentType)); } catch (e) { /* ignore */ }
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

  saveForm: function (writeToExcel) {
    var formData = this.collectFormData();
    if (!formData) {
      InspeccionesService.toast('No hay datos para guardar', 'warning');
      return;
    }

    var type = this.currentType;
    var self = this;

    var savePromise = InspeccionesService.writeExcel(this.companyName, type, formData);

    savePromise.then(function (result) {
      if (result.success) {
        self.markClean();
        self.clearDraft(type);
        InspeccionesService.toast('Formulario guardado en Excel correctamente', 'success');
        delete self.loadedTypes[type];
      } else {
        InspeccionesService.toast('Error al guardar: ' + (result.error ? result.error.message : 'Desconocido'), 'error');
      }
    }).catch(function (err) {
      console.error('[4.2.4] writeExcel error:', err);
      InspeccionesService.toast('Error al guardar en Excel', 'error');
    });
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
  }
};

window.FormularioInsp = FormularioInsp;
})();
