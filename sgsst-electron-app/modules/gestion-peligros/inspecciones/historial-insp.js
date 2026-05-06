(function () {
'use strict';

var HistorialInsp = {
  companyName: null,
  currentFilters: {},
  filesData: null,

  load: function (companyName) {
    this.companyName = companyName;
    this.currentFilters = {};
    this.filesData = null;
    this.renderFilters();
    this.renderTable();
  },

  renderFilters: function () {
    var container = document.getElementById('kair-insp-historial-filters');
    if (!container) return;

    var types = InspeccionesService.TYPES;
    var typeOptions = '<option value="">Todos los tipos</option>';
    types.forEach(function (t) {
      typeOptions += '<option value="' + t.code + '">' + t.name + '</option>';
    });

    container.innerHTML =
      '<div class="kair-insp__filters-bar">' +
      '<div class="kair-insp__filter-group">' +
      '<label class="kair-insp__filter-label">Tipo</label>' +
      '<select class="kair-insp__filter-select" id="kair-insp-filter-type">' + typeOptions + '</select>' +
      '</div>' +
      '<div class="kair-insp__filter-group">' +
      '<label class="kair-insp__filter-label">Formato</label>' +
      '<input type="text" class="kair-insp__filter-input" id="kair-insp-filter-format" placeholder="GI-FO-026">' +
      '</div>' +
      '<div class="kair-insp__search-box">' +
      '<i class="bi bi-search"></i>' +
      '<input type="text" placeholder="Buscar archivo..." id="kair-insp-filter-search">' +
      '</div>' +
      '</div>';

    this.bindFilterEvents();
  },

  bindFilterEvents: function () {
    var self = this;
    var filterType = document.getElementById('kair-insp-filter-type');
    var filterFormat = document.getElementById('kair-insp-filter-format');
    var filterSearch = document.getElementById('kair-insp-filter-search');

    var debounceTimer = null;
    function applyFilters() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        self.currentFilters = {
          type: filterType ? filterType.value : '',
          search: filterSearch ? filterSearch.value : ''
        };
        self._renderFilteredTable();
      }, 250);
    }

    if (filterType) filterType.addEventListener('change', applyFilters);
    if (filterFormat) filterFormat.addEventListener('input', applyFilters);
    if (filterSearch) filterSearch.addEventListener('input', applyFilters);
  },

  renderTable: function () {
    var container = document.getElementById('kair-insp-historial-table');
    if (!container) return;

    container.innerHTML = '<div class="kair-insp-loading"><div class="kair-insp-spinner"></div><p>Cargando archivos...</p></div>';

    InspeccionesService.listFiles(this.companyName).then(function (result) {
      if (!result.success) {
        container.innerHTML = '<div class="kair-insp-empty-state"><i class="bi bi-exclamation-circle"></i><h3>Error</h3><p>' + (result.error ? result.error.message : 'Error cargando archivos') + '</p></div>';
        return;
      }

      this.filesData = (result.data.files || []).filter(function (f) {
        return f.type !== 'PROGRAMA' && f.type !== 'DESCONOCIDO';
      });

      this._renderFilteredTable();
    }.bind(this)).catch(function (err) {
      console.error('[4.2.4] listFiles error:', err);
      container.innerHTML = '<div class="kair-insp-empty-state"><i class="bi bi-exclamation-circle"></i><h3>Error de conexión</h3></div>';
    }.bind(this));
  },

  _renderFilteredTable: function () {
    var container = document.getElementById('kair-insp-historial-table');
    if (!container) return;

    var items = this.filesData || [];

    if (this.currentFilters.type) {
      items = items.filter(function (f) { return f.type === this.currentFilters.type; }.bind(this));
    }
    if (this.currentFilters.search) {
      var s = this.currentFilters.search.toLowerCase();
      items = items.filter(function (f) {
        return (f.name || '').toLowerCase().indexOf(s) !== -1 ||
          (f.typeName || '').toLowerCase().indexOf(s) !== -1 ||
          (f.code || '').toLowerCase().indexOf(s) !== -1;
      });
    }

    if (items.length === 0) {
      container.innerHTML = '<div class="kair-insp__table-card"><div class="kair-insp__table__empty">' +
        '<div class="kair-insp-empty-state"><i class="bi bi-inbox"></i><h3>Sin archivos</h3><p>No se encontraron archivos de inspección</p></div>' +
        '</div></div>';
      return;
    }

    var theadHtml = '<tr>' +
      '<th>Tipo</th>' +
      '<th>Formato</th>' +
      '<th>Archivo</th>' +
      '<th>Extensión</th>' +
      '<th>Modificado</th>' +
      '<th style="text-align:center;">Acciones</th>' +
      '</tr>';

    var tbodyHtml = items.map(function (file) {
      var typeIcon = InspeccionesService.getTypeIcon(file.type);
      var typeLabel = file.typeName || InspeccionesService.getTypeLabel(file.type);
      var modDate = file.modified ? new Date(file.modified).toLocaleDateString('es-CO') : '';
      var extDisplay = (file.ext || '').replace('.', '').toUpperCase();

      return '<tr data-path="' + this._esc(file.path) + '">' +
        '<td><span class="kair-insp__type-badge"><i class="bi ' + typeIcon + '"></i> ' + typeLabel + '</span></td>' +
        '<td style="font-size:0.75rem;color:var(--kair-insp-text-muted);">' + this._esc(file.code) + '</td>' +
        '<td>' + this._esc(file.name) + '</td>' +
        '<td><span class="kair-insp__status-badge" style="background:var(--kair-insp-bg-hover);color:var(--kair-insp-text-secondary);">' + extDisplay + '</span></td>' +
        '<td style="font-size:0.75rem;color:var(--kair-insp-text-muted);">' + modDate + '</td>' +
        '<td style="text-align:center;white-space:nowrap;">' +
        '<button class="kair-insp-btn kair-insp-btn--ghost kair-insp-btn--sm kair-insp-action-view" data-path="' + this._esc(file.path) + '" data-type="' + file.type + '" title="Abrir en formulario"><i class="bi bi-pencil-square"></i></button>' +
        '<button class="kair-insp-btn kair-insp-btn--danger kair-insp-btn--sm kair-insp-action-delete" data-path="' + this._esc(file.path) + '" title="Eliminar" style="margin-left:4px;"><i class="bi bi-trash3"></i></button>' +
        '</td>' +
        '</tr>';
    }.bind(this)).join('');

    var totalLabel = '<div style="padding:0.75rem 1rem;font-size:0.75rem;color:var(--kair-insp-text-muted);border-top:1px solid var(--kair-insp-border-light);">' +
      'Mostrando ' + items.length + ' archivo' + (items.length !== 1 ? 's' : '') + '</div>';

    container.innerHTML = '<div class="kair-insp__table-card">' +
      '<table class="kair-insp__table">' +
      '<thead>' + theadHtml + '</thead>' +
      '<tbody>' + tbodyHtml + '</tbody>' +
      '</table>' +
      totalLabel +
      '</div>';

    this.bindRowActions();
  },

  _esc: function (val) {
    if (!val) return '';
    return String(val).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  bindRowActions: function () {
    var self = this;

    document.querySelectorAll('.kair-insp-action-view').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var filePath = btn.getAttribute('data-path');
        var type = btn.getAttribute('data-type');
        self.openInFormulario(type);
      });
    });

    document.querySelectorAll('.kair-insp-action-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var filePath = btn.getAttribute('data-path');
        self.confirmDelete(filePath);
      });
    });
  },

  openInFormulario: function (type) {
    if (window.FormularioInsp) {
      FormularioInsp.navigateToType(type);
    }
    if (typeof InspeccionesComponent !== 'undefined') {
      var tabBtn = document.querySelector('.kair-header__tab[data-view="formulario"]');
      if (tabBtn) tabBtn.click();
    }
  },

  confirmDelete: function (filePath) {
    var modal = document.getElementById('kair-insp-modal');
    var modalTitle = document.getElementById('kair-insp-modal-title');
    var modalBody = document.getElementById('kair-insp-modal-body');
    if (!modal || !modalTitle || !modalBody) return;

    var fileName = filePath.split(/[/\\]/).pop();

    modalTitle.textContent = 'Confirmar Eliminación';
    modalBody.innerHTML = '<p style="color:var(--kair-insp-text-secondary);">¿Está seguro de eliminar el archivo <strong>' + this._esc(fileName) + '</strong>? Se creará un backup automático.</p>';

    var confirmBtn = document.getElementById('kair-insp-modal-confirm');
    if (confirmBtn) {
      var newConfirm = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
      newConfirm.id = 'kair-insp-modal-confirm';
      newConfirm.textContent = 'Eliminar';
      newConfirm.className = 'kair-insp-btn kair-insp-btn--danger';
      newConfirm.addEventListener('click', function () {
        HistorialInsp.deleteFile(filePath);
        modal.classList.remove('visible');
      });
    }

    modal.classList.add('visible');
  },

  deleteFile: function (filePath) {
    var self = this;
    InspeccionesService.deleteInspection(this.companyName, filePath).then(function (result) {
      if (result.success) {
        InspeccionesService.toast('Archivo eliminado', 'success');
        self.renderTable();
      } else {
        InspeccionesService.toast('Error al eliminar: ' + (result.error ? result.error.message : ''), 'error');
      }
    }).catch(function (err) {
      console.error('[4.2.4] deleteInspection error:', err);
      InspeccionesService.toast('Error de conexión', 'error');
    });
  },

  showNewModal: function () {
    InspeccionesService.toast('Use las pestañas del Formulario para crear inspecciones', 'info');
    this.openInFormulario('EXTINTOR');
  }
};

window.HistorialInsp = HistorialInsp;
})();
