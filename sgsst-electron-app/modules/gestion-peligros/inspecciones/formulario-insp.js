/* ==========================================================================
K+AIR — Módulo 4.2.4 Formulario de Inspección de Extintores (GI-FO-026)
Sub-módulo: Formulario dinámico con auto-save, lectura/escritura Excel
========================================================================== */
(function () {
  'use strict';

  var ESTADO_OPTIONS = ['BUENO', 'MALO', 'REGULAR', 'N/A'];
  var PRESION_OPTIONS = ['OK', 'BAJO', 'N/A'];
  var AUTOSAVE_INTERVAL = 30000;
  var STORAGE_KEY_DRAFT = 'kair_inspecciones_draft_extintor';

  var FormularioInsp = {
    companyName: null,
    templateData: null,
    autoSaveTimer: null,
    hasUnsavedChanges: false,

    load: function (companyName) {
      this.companyName = companyName;
      this.templateData = null;
      this.hasUnsavedChanges = false;
      this.clearAutoSave();
      this.loadTemplate();
    },

    loadTemplate: function () {
      var self = this;
      var container = document.getElementById('kair-insp-formulario-content');
      if (!container) return;

      container.innerHTML = '<div class="kair-insp-loading"><div class="kair-insp-spinner"></div><p>Cargando formulario...</p></div>';

        InspeccionesService.readExcel(this.companyName, 'EXTINTOR').then(function (result) {
            if (!result.success) {
                container.innerHTML = '<div class="kair-insp-empty-state"><i class="bi bi-exclamation-circle"></i><h3>Error</h3><p>' + (result.error ? result.error.message : 'No se pudo cargar la plantilla') + '</p></div>';
                return;
            }
            self.templateData = result.data;
            self.renderForm(result.data);
            self.startAutoSave();
        }).catch(function (err) { console.error('[4.2.4] readExcel error:', err); });
    },

  renderForm: function (template) {
    var self = this;
    var container = document.getElementById('kair-insp-formulario-content');
    if (!container) return;

      var items = template.items || [];
      var header = template.structure && template.structure.headerRows && template.structure.headerRows[0] ? template.structure.headerRows[0].cells : [];

      var theadHtml = '<tr>';
      header.forEach(function (cell) {
        theadHtml += '<th>' + cell.label + '</th>';
      });
      theadHtml += '</tr>';

      var tbodyHtml = items.map(function (item, idx) {
        var rowHtml = '<tr data-row="' + item.row + '">';
        rowHtml += '<td><input type="text" class="kair-insp__form-input" data-field="ubicacion" value="' + self._esc(item.ubicacion) + '"></td>';
        rowHtml += '<td><input type="text" class="kair-insp__form-input" data-field="tipo" value="' + self._esc(item.tipo) + '" style="width:70px;"></td>';
        rowHtml += '<td><input type="text" class="kair-insp__form-input" data-field="capacidad" value="' + self._esc(item.capacidad) + '" style="width:60px;"></td>';
        rowHtml += '<td><input type="text" class="kair-insp__form-input" data-field="fabricacion" value="' + self._esc(item.fabricacion) + '" style="width:65px;"></td>';
        rowHtml += '<td><input type="text" class="kair-insp__form-input" data-field="vencimiento" value="' + self._esc(item.vencimiento) + '" style="width:65px;"></td>';
        rowHtml += '<td>' + self._buildSelect('presion', item.presion, PRESION_OPTIONS) + '</td>';
        rowHtml += '<td>' + self._buildSelect('manometro', item.manometro, ESTADO_OPTIONS) + '</td>';
        rowHtml += '<td>' + self._buildSelect('manguera', item.manguera, ESTADO_OPTIONS) + '</td>';
        rowHtml += '<td>' + self._buildSelect('seguro', item.seguro, ESTADO_OPTIONS) + '</td>';
        rowHtml += '<td>' + self._buildSelect('etiqueta', item.etiqueta, ESTADO_OPTIONS) + '</td>';
        rowHtml += '<td>' + self._buildSelect('senalizacion', item.senalizacion, ESTADO_OPTIONS) + '</td>';
        rowHtml += '<td><input type="text" class="kair-insp__form-input" data-field="observaciones" value="' + self._esc(item.observaciones) + '"></td>';
        rowHtml += '</tr>';
        return rowHtml;
      }).join('');

      var addRowBtn = '<tr id="kair-insp-form-add-row"><td colspan="12" style="text-align:center;padding:8px;">' +
        '<button class="kair-insp-btn kair-insp-btn--ghost kair-insp-btn--sm" id="kair-insp-form-add-btn"><i class="bi bi-plus"></i> Agregar extintor</button></td></tr>';

      var metaHtml = '<div class="kair-insp__form-header">' +
        '<div class="kair-insp__form-meta">' +
          '<div class="kair-insp__form-meta-item"><i class="bi bi-file-earmark-text"></i> Formato ' + template.code + '</div>' +
          '<div class="kair-insp__form-meta-item"><i class="bi bi-clock"></i> Fecha: ' + new Date().toISOString().slice(0, 10) + '</div>' +
          '<div class="kair-insp__form-meta-item"><i class="bi bi-list-ol"></i> Extintores: <span id="kair-insp-form-count">' + items.length + '</span></div>' +
        '</div>' +
        '<div class="kair-insp__form-autosave" id="kair-insp-autosave-indicator">' +
          '<div class="kair-insp__form-autosave-dot"></div>' +
          '<span id="kair-insp-autosave-text">Guardado</span>' +
        '</div>' +
      '</div>';

      var actionsHtml = '<div class="kair-insp__form-actions">' +
        '<button class="kair-insp-btn kair-insp-btn--ghost" id="kair-insp-form-reset"><i class="bi bi-arrow-counterclockwise"></i> Restaurar</button>' +
        '<button class="kair-insp-btn kair-insp-btn--primary" id="kair-insp-form-save"><i class="bi bi-floppy"></i> Guardar</button>' +
        '<button class="kair-insp-btn kair-insp-btn--success" id="kair-insp-form-save-excel"><i class="bi bi-file-earmark-spreadsheet"></i> Guardar en Excel</button>' +
      '</div>';

      container.innerHTML = metaHtml +
        '<div class="kair-insp__form-table-wrapper">' +
          '<table class="kair-insp__form-table">' +
            '<thead>' + theadHtml + '</thead>' +
            '<tbody>' + tbodyHtml + addRowBtn + '</tbody>' +
          '</table>' +
        '</div>' +
        actionsHtml;

      self.bindFormEvents();
    },

    _esc: function (val) {
      if (!val) return '';
      return String(val).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    _buildSelect: function (field, currentValue, options) {
      var self = this;
      var stateClass = self._getStateClass(currentValue);
      var html = '<select class="kair-insp__form-select ' + stateClass + '" data-field="' + field + '">';
      options.forEach(function (opt) {
        var selected = opt === currentValue ? ' selected' : '';
        html += '<option value="' + opt + '"' + selected + '>' + opt + '</option>';
      });
      html += '</select>';
      return html;
    },

    _getStateClass: function (value) {
      if (value === 'BUENO' || value === 'OK') return 'kair-insp__form-select--bueno';
      if (value === 'MALO') return 'kair-insp__form-select--malo';
      if (value === 'REGULAR' || value === 'BAJO') return 'kair-insp__form-select--regular';
      if (value === 'N/A') return 'kair-insp__form-select--na';
      return '';
    },

    bindFormEvents: function () {
      var self = this;

      var container = document.getElementById('kair-insp-formulario-content');
      if (!container) return;

      container.addEventListener('change', function (e) {
        if (e.target.classList.contains('kair-insp__form-select')) {
          var newClass = self._getStateClass(e.target.value);
          e.target.className = 'kair-insp__form-select ' + newClass;
          self.markDirty();
        }
        if (e.target.classList.contains('kair-insp__form-input')) {
          self.markDirty();
        }
      });

      var addBtn = document.getElementById('kair-insp-form-add-btn');
      if (addBtn) {
        addBtn.addEventListener('click', function () {
          self.addRow();
        });
      }

      var resetBtn = document.getElementById('kair-insp-form-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          self.clearDraft();
          self.loadTemplate();
        });
      }

      var saveBtn = document.getElementById('kair-insp-form-save');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          self.saveForm(false);
        });
      }

      var saveExcelBtn = document.getElementById('kair-insp-form-save-excel');
      if (saveExcelBtn) {
        saveExcelBtn.addEventListener('click', function () {
          self.saveForm(true);
        });
      }
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
      var self = this;
      this.clearAutoSave();
      this.autoSaveTimer = setInterval(function () {
        if (self.hasUnsavedChanges) {
          self.saveDraft();
          self.markClean();
        }
      }, AUTOSAVE_INTERVAL);
    },

    clearAutoSave: function () {
      if (this.autoSaveTimer) {
        clearInterval(this.autoSaveTimer);
        this.autoSaveTimer = null;
      }
    },

    saveDraft: function () {
      var formData = this.collectFormData();
      if (formData) {
        try {
          localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(formData));
        } catch (e) { /* ignore */ }
      }
    },

    clearDraft: function () {
      try { localStorage.removeItem(STORAGE_KEY_DRAFT); } catch (e) { /* ignore */ }
    },

    collectFormData: function () {
      if (!this.templateData) return null;
      var items = [];
      var rows = document.querySelectorAll('#kair-insp-formulario-content .kair-insp__form-table tbody tr[data-row]');
      rows.forEach(function (row) {
        var item = { row: parseInt(row.getAttribute('data-row'), 10) };
        var inputs = row.querySelectorAll('.kair-insp__form-input');
        inputs.forEach(function (input) {
          item[input.getAttribute('data-field')] = input.value;
        });
        var selects = row.querySelectorAll('.kair-insp__form-select');
        selects.forEach(function (sel) {
          item[sel.getAttribute('data-field')] = sel.value;
        });
        items.push(item);
      });
      return { code: this.templateData.code, items: items };
    },

    addRow: function () {
      var tbody = document.querySelector('#kair-insp-formulario-content .kair-insp__form-table tbody');
      var addRow = document.getElementById('kair-insp-form-add-row');
      if (!tbody || !addRow) return;

      var lastRow = tbody.querySelectorAll('tr[data-row]');
      var newRowNum = lastRow.length > 0 ? parseInt(lastRow[lastRow.length - 1].getAttribute('data-row'), 10) + 1 : 12;

      var newRow = document.createElement('tr');
      newRow.setAttribute('data-row', newRowNum);
      newRow.innerHTML =
        '<td><input type="text" class="kair-insp__form-input" data-field="ubicacion" value="" placeholder="Ubicación"></td>' +
        '<td><input type="text" class="kair-insp__form-input" data-field="tipo" value="ABC" style="width:70px;"></td>' +
        '<td><input type="text" class="kair-insp__form-input" data-field="capacidad" value="5 kg" style="width:60px;"></td>' +
        '<td><input type="text" class="kair-insp__form-input" data-field="fabricacion" value="" style="width:65px;"></td>' +
        '<td><input type="text" class="kair-insp__form-input" data-field="vencimiento" value="" style="width:65px;"></td>' +
        '<td>' + this._buildSelect('presion', 'OK', PRESION_OPTIONS) + '</td>' +
        '<td>' + this._buildSelect('manometro', 'BUENO', ESTADO_OPTIONS) + '</td>' +
        '<td>' + this._buildSelect('manguera', 'BUENO', ESTADO_OPTIONS) + '</td>' +
        '<td>' + this._buildSelect('seguro', 'BUENO', ESTADO_OPTIONS) + '</td>' +
        '<td>' + this._buildSelect('etiqueta', 'BUENO', ESTADO_OPTIONS) + '</td>' +
        '<td>' + this._buildSelect('senalizacion', 'BUENO', ESTADO_OPTIONS) + '</td>' +
        '<td><input type="text" class="kair-insp__form-input" data-field="observaciones" value=""></td>';

      tbody.insertBefore(newRow, addRow);

      var countEl = document.getElementById('kair-insp-form-count');
      if (countEl) countEl.textContent = tbody.querySelectorAll('tr[data-row]').length;

      this.markDirty();
    },

    saveForm: function (writeToExcel) {
      var formData = this.collectFormData();
    if (!formData) {
      InspeccionesService.toast('No hay datos para guardar', 'warning');
      return;
    }

      var self = this;

        if (writeToExcel) {
            InspeccionesService.writeExcel(this.companyName, 'EXTINTOR', formData).then(function (result) {
                if (result.success) {
        self.markClean();
        self.clearDraft();
        InspeccionesService.toast('Formulario guardado en Excel correctamente', 'success');
      } else {
        InspeccionesService.toast('Error al guardar en Excel: ' + (result.error ? result.error.message : 'Desconocido'), 'error');
      }
    }).catch(function (err) { console.error('[4.2.4] writeExcel error:', err); });
  } else {
    InspeccionesService.writeExcel(this.companyName, 'EXTINTOR', formData).then(function (result) {
      if (result.success) {
        self.markClean();
        self.clearDraft();
        InspeccionesService.toast('Formulario guardado correctamente', 'success');
      } else {
        InspeccionesService.toast('Error al guardar: ' + (result.error ? result.error.message : 'Desconocido'), 'error');
      }
    }).catch(function (err) { console.error('[4.2.4] writeExcel error:', err); });
    }
  }
};

window.FormularioInsp = FormularioInsp;
})();
