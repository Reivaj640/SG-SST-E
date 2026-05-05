/* ==========================================================================
K+AIR — Módulo 4.2.4 Historial de Inspecciones
Sub-módulo: Tabla, filtros, búsqueda, acciones CRUD
========================================================================== */
(function () {
  'use strict';

  var HistorialInsp = {
    companyName: null,
    currentFilters: {},

    load: function (companyName) {
      this.companyName = companyName;
      this.currentFilters = {};
      this.renderFilters();
      this.renderTable();
      this.bindGlobalActions();
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
            '<label class="kair-insp__filter-label">Estado</label>' +
            '<select class="kair-insp__filter-select" id="kair-insp-filter-status">' +
              '<option value="">Todos</option>' +
              '<option value="COMPLETED">Completada</option>' +
              '<option value="DRAFT">Borrador</option>' +
              '<option value="IN_PROGRESS">En Progreso</option>' +
            '</select>' +
          '</div>' +
          '<div class="kair-insp__filter-group">' +
            '<label class="kair-insp__filter-label">Desde</label>' +
            '<input type="date" class="kair-insp__filter-input" id="kair-insp-filter-from">' +
          '</div>' +
          '<div class="kair-insp__filter-group">' +
            '<label class="kair-insp__filter-label">Hasta</label>' +
            '<input type="date" class="kair-insp__filter-input" id="kair-insp-filter-to">' +
          '</div>' +
          '<div class="kair-insp__search-box">' +
            '<i class="bi bi-search"></i>' +
            '<input type="text" placeholder="Buscar ubicación, inspector..." id="kair-insp-filter-search">' +
          '</div>' +
        '</div>';

      this.bindFilterEvents();
    },

    bindFilterEvents: function () {
      var self = this;
      var filterType = document.getElementById('kair-insp-filter-type');
      var filterStatus = document.getElementById('kair-insp-filter-status');
      var filterFrom = document.getElementById('kair-insp-filter-from');
      var filterTo = document.getElementById('kair-insp-filter-to');
      var filterSearch = document.getElementById('kair-insp-filter-search');

      var debounceTimer = null;
      function applyFilters() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          self.currentFilters = {
            type: filterType ? filterType.value : '',
            status: filterStatus ? filterStatus.value : '',
            dateFrom: filterFrom ? filterFrom.value : '',
            dateTo: filterTo ? filterTo.value : '',
            search: filterSearch ? filterSearch.value : ''
          };
          self.renderTable();
        }, 250);
      }

      [filterType, filterStatus, filterFrom, filterTo].forEach(function (el) {
        if (el) el.addEventListener('change', applyFilters);
      });
      if (filterSearch) filterSearch.addEventListener('input', applyFilters);
    },

    renderTable: function () {
      var container = document.getElementById('kair-insp-historial-table');
      if (!container) return;

      var self = this;
        InspeccionesService.listInspections(this.companyName, this.currentFilters).then(function (result) {
            if (!result.success) return;
        var items = result.data.items;

        if (items.length === 0) {
          container.innerHTML = '<div class="kair-insp__table-card"><div class="kair-insp__table__empty">' +
            '<div class="kair-insp-empty-state"><i class="bi bi-inbox"></i><h3>Sin resultados</h3><p>No se encontraron inspecciones con los filtros aplicados</p></div>' +
            '</div></div>';
          return;
        }

        var theadHtml = '<tr>' +
          '<th>Tipo</th>' +
          '<th>Ubicación</th>' +
          '<th>Inspector</th>' +
          '<th>Fecha</th>' +
          '<th>Formato</th>' +
          '<th>Estado</th>' +
          '<th>Observaciones</th>' +
          '<th style="text-align:center;">Acciones</th>' +
        '</tr>';

        var tbodyHtml = items.map(function (insp) {
          var typeIcon = InspeccionesService.getTypeIcon(insp.type);
          var typeLabel = InspeccionesService.getTypeLabel(insp.type);
          var statusLabel = InspeccionesService.getStatusLabel(insp.status);
          var statusVariant = InspeccionesService.getStatusVariant(insp.status);
          var obs = insp.observations || '';
          if (obs.length > 50) obs = obs.substring(0, 50) + '...';

          return '<tr data-id="' + insp.id + '">' +
            '<td><span class="kair-insp__type-badge"><i class="bi ' + typeIcon + '"></i> ' + typeLabel + '</span></td>' +
            '<td>' + self._esc(insp.location) + '</td>' +
            '<td>' + self._esc(insp.inspector) + '</td>' +
            '<td>' + insp.date + '</td>' +
            '<td style="font-size:0.75rem;color:var(--kair-insp-text-muted);">' + insp.format + '</td>' +
            '<td><span class="kair-insp__status-badge kair-insp__status-badge--' + statusVariant + '">' + statusLabel + '</span></td>' +
            '<td style="font-size:0.75rem;color:var(--kair-insp-text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + self._esc(insp.observations) + '">' + self._esc(obs) + '</td>' +
            '<td style="text-align:center;white-space:nowrap;">' +
              '<button class="kair-insp-btn kair-insp-btn--ghost kair-insp-btn--sm kair-insp-action-view" data-id="' + insp.id + '" title="Ver detalle"><i class="bi bi-eye"></i></button>' +
              '<button class="kair-insp-btn kair-insp-btn--danger kair-insp-btn--sm kair-insp-action-delete" data-id="' + insp.id + '" title="Eliminar" style="margin-left:4px;"><i class="bi bi-trash3"></i></button>' +
            '</td>' +
          '</tr>';
        }).join('');

        var totalLabel = '<div style="padding:0.75rem 1rem;font-size:0.75rem;color:var(--kair-insp-text-muted);border-top:1px solid var(--kair-insp-border-light);">' +
          'Mostrando ' + items.length + ' inspecci' + (items.length !== 1 ? 'ones' : '\u00f3n') + '</div>';

        container.innerHTML = '<div class="kair-insp__table-card">' +
          '<table class="kair-insp__table">' +
            '<thead>' + theadHtml + '</thead>' +
            '<tbody>' + tbodyHtml + '</tbody>' +
          '</table>' +
          totalLabel +
        '</div>';

        self.bindRowActions();
        }).catch(function (err) { console.error('[4.2.4] listInspections error:', err); });
    },

    _esc: function (val) {
      if (!val) return '';
      return String(val).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    bindRowActions: function () {
      var self = this;

      document.querySelectorAll('.kair-insp-action-view').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          self.showDetail(id);
        });
      });

      document.querySelectorAll('.kair-insp-action-delete').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          self.confirmDelete(id);
        });
      });
    },

    bindGlobalActions: function () {
      var self = this;
      var newBtn = document.getElementById('kair-insp-historial-new');
      if (newBtn && !newBtn._kairBound) {
        newBtn._kairBound = true;
        newBtn.addEventListener('click', function () {
          self.showNewModal();
        });
      }
    },

    showDetail: function (id) {
      InspeccionesService.getInspection(this.companyName, id).then(function (result) {
        if (!result.success) {
          HistorialInsp.showNotification('Inspección no encontrada', 'error');
          return;
        }
        var insp = result.data;
        var typeLabel = InspeccionesService.getTypeLabel(insp.type);
        var statusLabel = InspeccionesService.getStatusLabel(insp.status);
        var typeIcon = InspeccionesService.getTypeIcon(insp.type);

        var modal = document.getElementById('kair-insp-modal');
        var modalTitle = document.getElementById('kair-insp-modal-title');
        var modalBody = document.getElementById('kair-insp-modal-body');
        if (!modal || !modalTitle || !modalBody) return;

        modalTitle.textContent = 'Detalle de Inspección';
        modalBody.innerHTML =
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">' +
            '<div><strong style="color:var(--kair-insp-text-muted);font-size:0.75rem;">TIPO</strong><br><i class="bi ' + typeIcon + '" style="color:var(--kair-insp-primary);"></i> ' + typeLabel + '</div>' +
            '<div><strong style="color:var(--kair-insp-text-muted);font-size:0.75rem;">ESTADO</strong><br>' + statusLabel + '</div>' +
            '<div><strong style="color:var(--kair-insp-text-muted);font-size:0.75rem;">UBICACIÓN</strong><br>' + HistorialInsp._esc(insp.location) + '</div>' +
            '<div><strong style="color:var(--kair-insp-text-muted);font-size:0.75rem;">INSPECTOR</strong><br>' + HistorialInsp._esc(insp.inspector) + '</div>' +
            '<div><strong style="color:var(--kair-insp-text-muted);font-size:0.75rem;">FECHA</strong><br>' + insp.date + '</div>' +
            '<div><strong style="color:var(--kair-insp-text-muted);font-size:0.75rem;">FORMATO</strong><br>' + insp.format + '</div>' +
            '<div style="grid-column:1/-1;"><strong style="color:var(--kair-insp-text-muted);font-size:0.75rem;">OBSERVACIONES</strong><br>' + (HistorialInsp._esc(insp.observations) || '<em style="color:var(--kair-insp-text-light);">Sin observaciones</em>') + '</div>' +
          '</div>';

        modal.classList.add('visible');
        }).catch(function (err) { console.error('[4.2.4] getInspection error:', err); });
    },

    confirmDelete: function (id) {
      var modal = document.getElementById('kair-insp-modal');
      var modalTitle = document.getElementById('kair-insp-modal-title');
      var modalBody = document.getElementById('kair-insp-modal-body');
      var modalFooter = document.getElementById('kair-insp-modal-footer');
      if (!modal || !modalTitle || !modalBody) return;

      modalTitle.textContent = 'Confirmar Eliminación';
      modalBody.innerHTML = '<p style="color:var(--kair-insp-text-secondary);">¿Está seguro de eliminar esta inspección? Esta acción no se puede deshacer.</p>';

      var confirmBtn = document.getElementById('kair-insp-modal-confirm');
      if (confirmBtn) {
        var newConfirm = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        newConfirm.id = 'kair-insp-modal-confirm';
        newConfirm.textContent = 'Eliminar';
        newConfirm.className = 'kair-insp-btn kair-insp-btn--danger';
        newConfirm.addEventListener('click', function () {
          HistorialInsp.deleteInspection(id);
          modal.classList.remove('visible');
        });
      }

      modal.classList.add('visible');
    },

    deleteInspection: function (id) {
      var self = this;
        InspeccionesService.deleteInspection(this.companyName, id).then(function (result) {
            if (result.success) {
                self.showNotification('Inspección eliminada', 'success');
                self.renderTable();
            } else {
                self.showNotification('Error al eliminar', 'error');
            }
        }).catch(function (err) { console.error('[4.2.4] deleteInspection error:', err); });
    },

    showNewModal: function () {
      var modal = document.getElementById('kair-insp-modal');
      var modalTitle = document.getElementById('kair-insp-modal-title');
      var modalBody = document.getElementById('kair-insp-modal-body');
      if (!modal || !modalTitle || !modalBody) return;

      var types = InspeccionesService.TYPES;
      var typeOptions = types.map(function (t) {
        return '<option value="' + t.code + '">' + t.name + ' (' + t.format + ')</option>';
      }).join('');

      modalTitle.textContent = 'Nueva Inspección';
      modalBody.innerHTML =
        '<div style="display:grid;gap:1rem;">' +
          '<div><label style="font-size:0.75rem;font-weight:600;color:var(--kair-insp-text-muted);display:block;margin-bottom:4px;">TIPO DE INSPECCIÓN</label>' +
            '<select id="kair-insp-new-type" class="kair-insp__filter-select" style="width:100%;">' + typeOptions + '</select></div>' +
          '<div><label style="font-size:0.75rem;font-weight:600;color:var(--kair-insp-text-muted);display:block;margin-bottom:4px;">UBICACIÓN</label>' +
            '<input type="text" id="kair-insp-new-location" class="kair-insp__filter-input" style="width:100%;" placeholder="Ej: Sede Caribe - Piso 1"></div>' +
          '<div><label style="font-size:0.75rem;font-weight:600;color:var(--kair-insp-text-muted);display:block;margin-bottom:4px;">INSPECTOR</label>' +
            '<input type="text" id="kair-insp-new-inspector" class="kair-insp__filter-input" style="width:100%;" placeholder="Nombre del inspector"></div>' +
          '<div><label style="font-size:0.75rem;font-weight:600;color:var(--kair-insp-text-muted);display:block;margin-bottom:4px;">OBSERVACIONES</label>' +
            '<textarea id="kair-insp-new-obs" class="kair-insp__filter-input" style="width:100%;min-height:80px;resize:vertical;" placeholder="Observaciones generales..."></textarea></div>' +
        '</div>';

      var confirmBtn = document.getElementById('kair-insp-modal-confirm');
      if (confirmBtn) {
        var newConfirm = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        newConfirm.id = 'kair-insp-modal-confirm';
        newConfirm.textContent = 'Crear Inspección';
        newConfirm.className = 'kair-insp-btn kair-insp-btn--primary';
        newConfirm.addEventListener('click', function () {
          HistorialInsp.createInspection();
          modal.classList.remove('visible');
        });
      }

      modal.classList.add('visible');
    },

    createInspection: function () {
      var typeEl = document.getElementById('kair-insp-new-type');
      var locationEl = document.getElementById('kair-insp-new-location');
      var inspectorEl = document.getElementById('kair-insp-new-inspector');
      var obsEl = document.getElementById('kair-insp-new-obs');

      if (!typeEl || !locationEl || !inspectorEl) return;

      var typeCode = typeEl.value;
      var typeObj = InspeccionesService.TYPES.find(function (t) { return t.code === typeCode; });
      if (!typeObj) return;

      var inspectionData = {
        type: typeCode,
        format: typeObj.format,
        location: locationEl.value,
        inspector: inspectorEl.value,
        observations: obsEl ? obsEl.value : '',
        status: 'DRAFT'
      };

      var self = this;
        InspeccionesService.createInspection(this.companyName, inspectionData).then(function (result) {
            if (result.success) {
                self.showNotification('Inspección creada correctamente', 'success');
                self.renderTable();
            } else {
                self.showNotification('Error al crear inspección', 'error');
            }
        }).catch(function (err) { console.error('[4.2.4] createInspection error:', err); });
    },

    showNotification: function (message, type) {
      var existing = document.querySelector('.kair-insp-notification');
      if (existing) existing.remove();

      var icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', warning: 'bi-exclamation-triangle-fill' };
      var notif = document.createElement('div');
      notif.className = 'kair-insp-notification kair-insp-notification--' + (type || 'success');
      notif.innerHTML = '<i class="bi ' + (icons[type] || icons.success) + ' kair-insp-notification__icon"></i>' +
        '<span class="kair-insp-notification__message">' + message + '</span>';
      document.body.appendChild(notif);
      setTimeout(function () { notif.classList.add('show'); }, 10);
      setTimeout(function () {
        notif.classList.remove('show');
        setTimeout(function () { notif.remove(); }, 400);
      }, 3000);
    }
  };

  window.HistorialInsp = HistorialInsp;
})();
