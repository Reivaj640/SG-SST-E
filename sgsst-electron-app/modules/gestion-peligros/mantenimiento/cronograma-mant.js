/* ==========================================================================
K+AIR — Módulo 4.2.5 Mantenimiento Periódico
Vista Cronograma — Tabla editable con toggles de meses y evidencias
========================================================================== */
(function () {
 'use strict';

 var MONTHS = MantenimientoService.MONTHS;

 var TYPE_LABELS = { MPP: 'MPP', MPE: 'MPE', MPC: 'MPC' };
 var TYPE_ORDER = ['MPP', 'MPE', 'MPC'];

 var EDITABLE_FIELDS = [
  { key: 'instalacion', label: 'Instalación', width: '120px' },
  { key: 'codigo', label: 'Código', width: '60px' },
  { key: 'responsable', label: 'Responsable', width: '110px' },
  { key: 'diagnostico', label: 'Diagnóstico', width: '130px' },
  { key: 'actividades', label: 'Actividades', width: '130px' },
  { key: 'frecuencia', label: 'Frecuencia', width: '80px' }
 ];

 var _data = null;
 var _filterCategory = '';
 var _evidenceCache = {};

 function _esc(s) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(s || ''));
  return div.innerHTML;
 }

 function _formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
 }

 var CronogramaMant = {
  companyName: null,
  saveTimers: {},

  load: function (companyName) {
   this.companyName = companyName;
   _data = null;
   _filterCategory = '';
   _evidenceCache = {};
   Object.keys(this.saveTimers).forEach(function (k) {
    clearTimeout(this.saveTimers[k]);
   }.bind(this));
   this.saveTimers = {};
   this.render();
  },

  render: function () {
   var kpisEl = document.getElementById('kair-mnt-cronograma-kpis');
   var filtersEl = document.getElementById('kair-mnt-cronograma-filters');
   var tableEl = document.getElementById('kair-mnt-cronograma-table');

   if (!kpisEl && !tableEl) return;

   kpisEl.innerHTML = '<div class="kair-mnt-loading"><div class="kair-mnt-spinner"></div><p>Cargando cronograma...</p></div>';

   MantenimientoService.read(this.companyName).then(function (result) {
    if (!result.success) {
     if (kpisEl) kpisEl.innerHTML = '<div class="kair-mnt-empty-state"><i class="bi bi-exclamation-circle"></i><h3>Error</h3><p>' + (result.error ? result.error.message : 'No se pudo cargar') + '</p></div>';
     if (tableEl) tableEl.innerHTML = '';
     return;
    }

    _data = result.data;
    this._renderKPIs(kpisEl);
    this._renderFilters(filtersEl);
    this._renderTable(tableEl);
    this._preloadEvidenceCounts();
   }.bind(this)).catch(function (err) {
    console.error('[4.2.5] read error:', err);
    if (kpisEl) kpisEl.innerHTML = '<div class="kair-mnt-empty-state"><i class="bi bi-exclamation-circle"></i><h3>Error</h3><p>Error de conexión</p></div>';
   });
  },

  _renderKPIs: function (container) {
   if (!container || !_data) return;
   var items = _data.items || [];
   var total = items.length;
   var totalMPP = 0, totalMPE = 0, totalMPC = 0;
   var possiblePerItem = 12;

   items.forEach(function (item) {
    MONTHS.forEach(function (m) {
     if (item.months && item.months[m]) {
      if (item.months[m].MPP) totalMPP++;
      if (item.months[m].MPE) totalMPE++;
      if (item.months[m].MPC) totalMPC++;
     }
    });
   });

   var totalPossible = total * possiblePerItem;
   var cumplimiento = totalPossible > 0 ? Math.round((totalMPP / totalPossible) * 100) : 0;
   var cmpClass = cumplimiento >= 80 ? 'success' : (cumplimiento >= 50 ? 'warning' : 'danger');

   container.innerHTML =
    '<div class="kair-mnt-kpi-card"><div class="kair-mnt-kpi-card__value kair-mnt-kpi-card__value--' + cmpClass + '">' + cumplimiento + '%</div><div class="kair-mnt-kpi-card__label">Cumplimiento MPP</div></div>' +
    '<div class="kair-mnt-kpi-card"><div class="kair-mnt-kpi-card__value">' + total + '</div><div class="kair-mnt-kpi-card__label">Total Equipos</div></div>' +
    '<div class="kair-mnt-kpi-card"><div class="kair-mnt-kpi-card__value kair-mnt-kpi-card__value--success">' + totalMPP + '</div><div class="kair-mnt-kpi-card__label">MPP Realizados</div></div>' +
    '<div class="kair-mnt-kpi-card"><div class="kair-mnt-kpi-card__value kair-mnt-kpi-card__value--warning">' + totalMPE + '</div><div class="kair-mnt-kpi-card__label">MPE Realizados</div></div>' +
    '<div class="kair-mnt-kpi-card"><div class="kair-mnt-kpi-card__value kair-mnt-kpi-card__value--danger">' + totalMPC + '</div><div class="kair-mnt-kpi-card__label">MPC Realizados</div></div>';
  },

  _renderFilters: function (container) {
   if (!container || !_data) return;
   var categories = _data.categories || [];
   var selectHtml = '<span class="kair-mnt-filters__label"><i class="bi bi-funnel"></i> Categoría:</span> ' +
    '<select class="kair-mnt-filters__select" id="kair-mnt-filter-category">' +
    '<option value="">Todas</option>';
   categories.forEach(function (cat) {
    selectHtml += '<option value="' + _esc(cat) + '"' + (_filterCategory === cat ? ' selected' : '') + '>' + _esc(cat) + '</option>';
   });
   selectHtml += '</select>';

   var filtered = this._getFilteredItems();
   selectHtml += '<span class="kair-mnt-filters__count">' + filtered.length + ' equipo(s)</span>';

   container.innerHTML = selectHtml;

   var sel = document.getElementById('kair-mnt-filter-category');
   if (sel) {
    sel.addEventListener('change', function () {
     _filterCategory = sel.value;
     this._renderFilters(container);
     this._renderTable(document.getElementById('kair-mnt-cronograma-table'));
    }.bind(this));
   }
  },

  _getFilteredItems: function () {
   if (!_data || !_data.items) return [];
   if (!_filterCategory) return _data.items;
   return _data.items.filter(function (item) {
    return item._category === _filterCategory;
   });
  },

  _renderTable: function (container) {
   if (!container) return;
   if (!_data) {
    container.innerHTML = '<div class="kair-mnt-loading"><div class="kair-mnt-spinner"></div><p>Cargando...</p></div>';
    return;
   }

   var items = this._getFilteredItems();
   if (items.length === 0) {
    container.innerHTML = '<div class="kair-mnt-empty-state"><i class="bi bi-calendar-x"></i><h3>Sin datos</h3><p>No se encontraron equipos para esta categoría</p></div>';
    return;
   }

   var html = '<div class="kair-mnt-table-wrapper"><table class="kair-mnt-table"><thead>';

   html += '<tr><th rowspan="2" style="min-width:100px">Categoría / Item</th>';
   EDITABLE_FIELDS.forEach(function (f) {
    html += '<th rowspan="2" style="min-width:' + f.width + '">' + f.label + '</th>';
   });

   MONTHS.forEach(function (m) {
    html += '<th colspan="3" class="kair-mnt-table__th--month">' + m.substring(0, 3) + '</th>';
   });

   html += '<th rowspan="2" style="min-width:70px">Costo</th>';
   html += '<th rowspan="2" style="min-width:32px">Evid.</th>';
   html += '</tr><tr>';

   MONTHS.forEach(function () {
    TYPE_ORDER.forEach(function (t) {
     html += '<th class="kair-mnt-table__th--sub">' + TYPE_LABELS[t] + '</th>';
    });
   });

   html += '</tr></thead><tbody>';

   items.forEach(function (item) {
    var catIcon = MantenimientoService.getCategoryIcon(item._category);
    html += '<tr data-row-index="' + item.rowIndex + '">';

    html += '<td class="kair-mnt-table__td--category"><i class="bi ' + catIcon + '"></i> ' + _esc(item.item) + '</td>';

    EDITABLE_FIELDS.forEach(function (f) {
     var val = _esc(item[f.key] || '');
     html += '<td class="kair-mnt-table__td--editable">' +
      '<input type="text" class="kair-mnt-table__input" ' +
      'data-row="' + item.rowIndex + '" data-field="' + f.key + '" ' +
      'value="' + val + '" placeholder="' + f.label + '">' +
      '</td>';
    });

    MONTHS.forEach(function (month) {
     TYPE_ORDER.forEach(function (type) {
      var active = item.months && item.months[month] && item.months[month][type];
      var cls = active ? 'kair-mnt-cell--' + type.toLowerCase() : 'kair-mnt-cell--null';
      var label = active ? TYPE_LABELS[type] : '\u2014';
      html += '<td>' +
       '<div class="kair-mnt-cell ' + cls + '" ' +
       'data-row="' + item.rowIndex + '" data-month="' + month + '" data-type="' + type + '" ' +
       'title="' + month + ' \u2192 ' + TYPE_LABELS[type] + (active ? ' (activo)' : '') + '">' +
       label +
       '</div></td>';
     });
    });

    var costoVal = item.costo !== null && item.costo !== undefined ? item.costo : '';
    html += '<td><input type="text" class="kair-mnt-table__input kair-mnt-table__input--costo" ' +
     'data-row="' + item.rowIndex + '" data-field="costo" value="' + _esc(String(costoVal)) + '" ' +
     'placeholder="$"></td>';

    var evCount = _evidenceCache[item.rowIndex] || 0;
    var evClass = evCount > 0 ? ' kair-mnt-evidence-btn--has' : '';
    var evBadge = evCount > 0 ? '<span class="kair-mnt-evidence-btn__badge">' + evCount + '</span>' : '';
    html += '<td><button class="kair-mnt-evidence-btn' + evClass + '" data-row="' + item.rowIndex + '" title="Evidencias"><i class="bi bi-paperclip"></i>' + evBadge + '</button></td>';

    html += '</tr>';
   });

   html += '</tbody></table></div>';
   container.innerHTML = html;

   this._bindTableEvents(container);
  },

  _bindTableEvents: function (container) {
   var self = this;

   var cells = container.querySelectorAll('.kair-mnt-cell');
   cells.forEach(function (cell) {
    cell.addEventListener('click', function () {
     var rowIndex = parseInt(cell.getAttribute('data-row'), 10);
     var month = cell.getAttribute('data-month');
     var type = cell.getAttribute('data-type');
     var isActive = cell.classList.contains('kair-mnt-cell--mpp') ||
      cell.classList.contains('kair-mnt-cell--mpe') ||
      cell.classList.contains('kair-mnt-cell--mpc');
     var newValue = !isActive;

     self._toggleMonth(rowIndex, month, type, newValue, cell);
    });
   });

   var inputs = container.querySelectorAll('.kair-mnt-table__input');
   inputs.forEach(function (input) {
    input.addEventListener('change', function () {
     var rowIndex = parseInt(input.getAttribute('data-row'), 10);
     var field = input.getAttribute('data-field');
     var value = input.value;
     self._scheduleFieldUpdate(rowIndex, field, value);
    });
   });

   var evBtns = container.querySelectorAll('.kair-mnt-evidence-btn');
   evBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
     var rowIndex = parseInt(btn.getAttribute('data-row'), 10);
     self._openEvidenceDialog(rowIndex);
    });
   });
  },

  _toggleMonth: function (rowIndex, month, type, value, cellEl) {
   var wasActive = cellEl.classList.contains('kair-mnt-cell--mpp') ||
    cellEl.classList.contains('kair-mnt-cell--mpe') ||
    cellEl.classList.contains('kair-mnt-cell--mpc');

   if (value) {
    cellEl.classList.remove('kair-mnt-cell--null');
    cellEl.classList.add('kair-mnt-cell--' + type.toLowerCase());
    cellEl.textContent = TYPE_LABELS[type];
   } else {
    cellEl.classList.remove('kair-mnt-cell--mpp', 'kair-mnt-cell--mpe', 'kair-mnt-cell--mpc');
    cellEl.classList.add('kair-mnt-cell--null');
    cellEl.textContent = '\u2014';
   }

   if (_data && _data.items) {
    _data.items.forEach(function (item) {
     if (item.rowIndex === rowIndex && item.months && item.months[month]) {
      item.months[month][type] = value;
     }
    });
   }

   MantenimientoService.toggleMonth(this.companyName, rowIndex, month, type, value).then(function (result) {
    if (!result.success) {
     if (value) {
      cellEl.classList.remove('kair-mnt-cell--' + type.toLowerCase());
      cellEl.classList.add('kair-mnt-cell--null');
      cellEl.textContent = '\u2014';
     } else {
      cellEl.classList.remove('kair-mnt-cell--null');
      cellEl.classList.add('kair-mnt-cell--' + type.toLowerCase());
      cellEl.textContent = TYPE_LABELS[type];
     }
     if (_data && _data.items) {
      _data.items.forEach(function (item) {
       if (item.rowIndex === rowIndex && item.months && item.months[month]) {
        item.months[month][type] = !value;
       }
      });
     }
     MantenimientoService.toast('Error al actualizar celda', 'error');
    }
   }).catch(function () {
    MantenimientoService.toast('Error de conexión', 'error');
   });
  },

  _scheduleFieldUpdate: function (rowIndex, field, value) {
   var key = rowIndex + '_' + field;
   if (this.saveTimers[key]) clearTimeout(this.saveTimers[key]);

   this.saveTimers[key] = setTimeout(function () {
    delete this.saveTimers[key];
    this._saveField(rowIndex, field, value);
   }.bind(this), 800);
  },

  _saveField: function (rowIndex, field, value) {
   if (_data && _data.items) {
    _data.items.forEach(function (item) {
     if (item.rowIndex === rowIndex) {
      item[field] = value;
     }
    });
   }

   MantenimientoService.updateField(this.companyName, rowIndex, field, value).then(function (result) {
    if (!result.success) {
     MantenimientoService.toast('Error al guardar campo', 'error');
    }
   }).catch(function () {
    MantenimientoService.toast('Error de conexión', 'error');
   });
  },

  _preloadEvidenceCounts: function () {
   if (!_data || !_data.items) return;
   _data.items.forEach(function (item) {
    MantenimientoService.listEvidences(this.companyName, item.rowIndex).then(function (result) {
     if (result.success && result.data) {
      _evidenceCache[item.rowIndex] = result.data.length;
      var btn = document.querySelector('.kair-mnt-evidence-btn[data-row="' + item.rowIndex + '"]');
      if (btn) {
       var count = result.data.length;
       if (count > 0) {
        btn.classList.add('kair-mnt-evidence-btn--has');
        var existing = btn.querySelector('.kair-mnt-evidence-btn__badge');
        if (existing) {
         existing.textContent = count;
        } else {
         var badge = document.createElement('span');
         badge.className = 'kair-mnt-evidence-btn__badge';
         badge.textContent = count;
         btn.appendChild(badge);
        }
       }
      }
     }
    }.bind(this));
   }.bind(this));
  },

  _openEvidenceDialog: function (rowIndex) {
   var self = this;
   var overlay = document.getElementById('kair-mnt-evidence-overlay');
   var dialogTitle = document.getElementById('kair-mnt-evidence-dialog-title');
   var dialogBody = document.getElementById('kair-mnt-evidence-dialog-body');
   var closeBtn = document.getElementById('kair-mnt-evidence-dialog-close');

   if (!overlay) return;

   var item = _data && _data.items ? _data.items.find(function (i) { return i.rowIndex === rowIndex; }) : null;
   var itemLabel = item ? (item.item + ' \u2014 ' + (item.instalacion || '')) : 'Fila ' + rowIndex;

   if (dialogTitle) dialogTitle.textContent = 'Evidencias: ' + itemLabel;

   dialogBody.innerHTML = '<div class="kair-mnt-evidence__upload" id="kair-mnt-evidence-upload-zone">' +
    '<div class="kair-mnt-evidence__upload-icon"><i class="bi bi-cloud-arrow-up"></i></div>' +
    '<div class="kair-mnt-evidence__upload-text">Arrastra archivos aquí o haz clic para seleccionar</div>' +
    '<div class="kair-mnt-evidence__upload-hint">Imágenes, PDF, DOC, XLS — máx. 10 MB</div>' +
    '<input type="file" id="kair-mnt-evidence-file-input" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style="display:none">' +
    '</div>' +
    '<div class="kair-mnt-evidence__list" id="kair-mnt-evidence-list">' +
    '<div class="kair-mnt-loading"><div class="kair-mnt-spinner"></div><p>Cargando evidencias...</p></div>' +
    '</div>';

   overlay.classList.add('visible');

   overlay._currentRowIndex = rowIndex;

   this._loadEvidenceList(rowIndex);

   var uploadZone = document.getElementById('kair-mnt-evidence-upload-zone');
   var fileInput = document.getElementById('kair-mnt-evidence-file-input');

   if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', function () {
     fileInput.click();
    });

    uploadZone.addEventListener('dragover', function (e) {
     e.preventDefault();
     uploadZone.classList.add('kair-mnt-evidence__upload--dragover');
    });

    uploadZone.addEventListener('dragleave', function () {
     uploadZone.classList.remove('kair-mnt-evidence__upload--dragover');
    });

    uploadZone.addEventListener('drop', function (e) {
     e.preventDefault();
     uploadZone.classList.remove('kair-mnt-evidence__upload--dragover');
     var files = e.dataTransfer.files;
     if (files.length > 0) self._handleFileUpload(rowIndex, files);
    });

    fileInput.addEventListener('change', function () {
     if (fileInput.files.length > 0) {
      self._handleFileUpload(rowIndex, fileInput.files);
      fileInput.value = '';
     }
    });
   }

   if (closeBtn) {
    closeBtn._handler = function () {
     overlay.classList.remove('visible');
    };
    closeBtn.removeEventListener('click', closeBtn._handler);
    closeBtn.addEventListener('click', closeBtn._handler);
   }

   overlay.onclick = function (e) {
    if (e.target === overlay) overlay.classList.remove('visible');
   };
  },

  _loadEvidenceList: function (rowIndex) {
   var listEl = document.getElementById('kair-mnt-evidence-list');
   if (!listEl) return;

   MantenimientoService.listEvidences(this.companyName, rowIndex).then(function (result) {
    if (!result.success || !result.data || result.data.length === 0) {
     listEl.innerHTML = '<div class="kair-mnt-empty-state" style="padding:1rem"><i class="bi bi-inbox"></i><p>Sin evidencias registradas</p></div>';
     return;
    }

    var html = '';
    result.data.forEach(function (ev) {
     var ext = (ev.filePath || ev.fileName || '').split('.').pop().toLowerCase();
     var thumbIcon = 'bi-file-earmark';
     if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].indexOf(ext) !== -1) thumbIcon = 'bi-image';
     else if (ext === 'pdf') thumbIcon = 'bi-file-earmark-pdf';
     else if (['doc', 'docx'].indexOf(ext) !== -1) thumbIcon = 'bi-file-earmark-word';
     else if (['xls', 'xlsx'].indexOf(ext) !== -1) thumbIcon = 'bi-file-earmark-excel';

     var isImage = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].indexOf(ext) !== -1;
     var thumbHtml = isImage ?
      '<div class="kair-mnt-evidence__thumb" data-preview="' + _esc(ev.filePath || ev.fileName) + '"><i class="bi ' + thumbIcon + '"></i></div>' :
      '<div class="kair-mnt-evidence__thumb"><i class="bi ' + thumbIcon + '"></i></div>';

     html += '<div class="kair-mnt-evidence__item">' +
      thumbHtml +
      '<div class="kair-mnt-evidence__info">' +
      '<div class="kair-mnt-evidence__name">' + _esc(ev.fileName || ev.filePath) + '</div>' +
      '<div class="kair-mnt-evidence__meta">' + _formatFileSize(ev.fileSize) + ' \u2022 ' + new Date(ev.createdAt).toLocaleDateString() + '</div>' +
      '</div>' +
      '<div class="kair-mnt-evidence__actions">' +
      (isImage ? '<button class="kair-mnt-evidence__action kair-mnt-evidence__action--preview" data-preview="' + _esc(ev.filePath || ev.fileName) + '" title="Vista previa"><i class="bi bi-eye"></i></button>' : '') +
      '<button class="kair-mnt-evidence__action kair-mnt-evidence__action--delete" data-delete="' + _esc(ev.filePath || ev.fileName) + '" title="Eliminar"><i class="bi bi-trash3"></i></button>' +
      '</div></div>';
    });

    listEl.innerHTML = html;
    this._bindEvidenceListEvents(listEl, rowIndex);
   }.bind(this)).catch(function () {
    listEl.innerHTML = '<div class="kair-mnt-empty-state" style="padding:1rem"><i class="bi bi-exclamation-circle"></i><p>Error cargando evidencias</p></div>';
   });
  },

  _bindEvidenceListEvents: function (listEl, rowIndex) {
   var self = this;

   listEl.querySelectorAll('[data-preview]').forEach(function (el) {
    el.addEventListener('click', function () {
     var fileName = el.getAttribute('data-preview');
     self._previewImage(fileName);
    });
   });

   listEl.querySelectorAll('[data-delete]').forEach(function (btn) {
    btn.addEventListener('click', function () {
     var fileName = btn.getAttribute('data-delete');
     if (confirm('¿Eliminar esta evidencia?')) {
      self._deleteEvidence(rowIndex, fileName);
     }
    });
   });
  },

  _handleFileUpload: function (rowIndex, files) {
   var self = this;
   var maxBytes = 10 * 1024 * 1024;

   Array.from(files).forEach(function (file) {
    if (file.size > maxBytes) {
     MantenimientoService.toast('Archivo ' + file.name + ' excede 10 MB', 'error');
     return;
    }

    var reader = new FileReader();
    reader.onload = function () {
     var buffer = reader.result.split(',')[1];
     var evidenceData = {
      itemRowIndex: rowIndex,
      fileName: file.name,
      buffer: buffer
     };

     MantenimientoService.saveEvidence(self.companyName, evidenceData).then(function (result) {
      if (result.success) {
       MantenimientoService.toast('Evidencia guardada', 'success');
       _evidenceCache[rowIndex] = (_evidenceCache[rowIndex] || 0) + 1;
       self._updateEvidenceBadge(rowIndex);
       self._loadEvidenceList(rowIndex);
      } else {
       MantenimientoService.toast('Error al guardar evidencia', 'error');
      }
     }).catch(function () {
      MantenimientoService.toast('Error de conexión', 'error');
     });
    };
    reader.readAsDataURL(file);
   });
  },

  _deleteEvidence: function (rowIndex, fileName) {
   var self = this;

   MantenimientoService.deleteEvidence(this.companyName, fileName).then(function (result) {
    if (result.success) {
     MantenimientoService.toast('Evidencia eliminada', 'success');
     _evidenceCache[rowIndex] = Math.max(0, (_evidenceCache[rowIndex] || 1) - 1);
     self._updateEvidenceBadge(rowIndex);
     self._loadEvidenceList(rowIndex);
    } else {
     MantenimientoService.toast('Error al eliminar', 'error');
    }
   }).catch(function () {
    MantenimientoService.toast('Error de conexión', 'error');
   });
  },

  _updateEvidenceBadge: function (rowIndex) {
   var btn = document.querySelector('.kair-mnt-evidence-btn[data-row="' + rowIndex + '"]');
   if (!btn) return;
   var count = _evidenceCache[rowIndex] || 0;
   if (count > 0) {
    btn.classList.add('kair-mnt-evidence-btn--has');
    var badge = btn.querySelector('.kair-mnt-evidence-btn__badge');
    if (badge) {
     badge.textContent = count;
    } else {
     badge = document.createElement('span');
     badge.className = 'kair-mnt-evidence-btn__badge';
     badge.textContent = count;
     btn.appendChild(badge);
    }
   } else {
    btn.classList.remove('kair-mnt-evidence-btn--has');
    var oldBadge = btn.querySelector('.kair-mnt-evidence-btn__badge');
    if (oldBadge) oldBadge.remove();
   }
  },

  _previewImage: function (fileName) {
   var viewer = document.getElementById('kair-mnt-image-viewer');
   var viewerImg = document.getElementById('kair-mnt-image-viewer-img');
   if (!viewer || !viewerImg) return;

   viewerImg.src = '';
   viewer.classList.add('visible');

   MantenimientoService.readEvidenceFile(this.companyName, fileName).then(function (result) {
    if (result.success && result.data) {
     viewerImg.src = 'data:' + result.data.mimeType + ';base64,' + result.data.buffer;
    } else {
     viewer.classList.remove('visible');
     MantenimientoService.toast('Error al cargar imagen', 'error');
    }
   }).catch(function () {
    viewer.classList.remove('visible');
    MantenimientoService.toast('Error de conexión', 'error');
   });

   viewer.onclick = function (e) {
    if (e.target === viewer || e.target.classList.contains('kair-mnt-image-viewer__close')) {
     viewer.classList.remove('visible');
    }
   };
  }
 };

 window.CronogramaMant = CronogramaMant;
})();
