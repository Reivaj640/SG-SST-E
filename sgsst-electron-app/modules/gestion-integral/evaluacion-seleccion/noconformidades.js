/* ==========================================================================
   K+AIR No Conformidades — Módulo 2.10.1
   ========================================================================== */

(function () {
  'use strict';

  var currentFilter = { estado: '', search: '' };
  var currentEditId = null;

  function load() { renderTable(); setupEvents(); }

  function setupEvents() {
    var newBtn = document.getElementById('kair-es-nc-new-btn');
    if (newBtn) newBtn.addEventListener('click', function () { openModal(); });
    var closeBtn = document.getElementById('kair-es-nc-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { closeModal(); });
    var cancelBtn = document.getElementById('kair-es-nc-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { closeModal(); });
    var saveBtn = document.getElementById('kair-es-nc-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', function () { saveNC(); });

    document.querySelectorAll('.kair-es-nc-filters__status-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.kair-es-nc-filters__status-btn').forEach(function (b) { b.classList.remove('kair-es-nc-filters__status-btn--active'); });
        btn.classList.add('kair-es-nc-filters__status-btn--active');
        currentFilter.estado = btn.dataset.estado || '';
        renderTable();
      });
    });

    var searchInput = document.getElementById('kair-es-nc-search');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) { currentFilter.search = e.target.value; renderTable(); });
    }

    var modal = document.getElementById('kair-es-nc-modal');
    if (modal) {
      modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    }
  }

  function renderTable() {
    var tbody = document.getElementById('kair-es-nc-tbody');
    if (!tbody) return;

    var ncs = window.NoConformidadesServiceES.getAll();
    if (currentFilter.estado) ncs = ncs.filter(function (nc) { return nc.estado === currentFilter.estado; });
    if (currentFilter.search) {
      var q = currentFilter.search.toLowerCase();
      ncs = ncs.filter(function (nc) {
        var asociado = window.AsociadosServiceES.getById(nc.asociadoId);
        var name = asociado ? asociado.razonSocial.toLowerCase() : '';
        return name.includes(q) || nc.descripcion.toLowerCase().includes(q);
      });
    }

    if (ncs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="kair-table__empty">No se encontraron no conformidades.</td></tr>';
      return;
    }

    tbody.innerHTML = ncs.map(function (nc, i) {
      var asociado = window.AsociadosServiceES.getById(nc.asociadoId);
      var name = asociado ? window.KAIRUtils.escapeHtml(asociado.razonSocial) : 'Desconocido';
      var estadoLabel = window.KAIRUtils.getNCEstadoLabel(nc.estado);
      var estadoBadgeClass = window.KAIRUtils.getNCEstadoBadgeClass(nc.estado);
      var estadoNcClass = nc.estado === 'ABIERTA' ? 'kair-nc-status--abierta' : nc.estado === 'EN_SEGUIMIENTO' ? 'kair-nc-status--en_seguimiento' : 'kair-nc-status--cerrada';

      var actionHtml = nc.estado === 'ABIERTA' ?
        '<button class="kair-btn kair-btn--warning kair-btn--sm" onclick="window.NoConformidadesModuleES.advanceStatus(\'' + nc.id + '\')">Iniciar seguimiento</button>' :
        nc.estado === 'EN_SEGUIMIENTO' ?
        '<button class="kair-btn kair-btn--success kair-btn--sm" onclick="window.NoConformidadesModuleES.advanceStatus(\'' + nc.id + '\')">Cerrar NC</button>' :
        '<span class="kair-text-muted kair-text-xs">Cerrada</span>';

      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + window.KAIRUtils.formatDate(nc.fechaDeteccion) + '</td>' +
        '<td>' + name + '</td>' +
        '<td style="max-width:250px;"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + window.KAIRUtils.escapeHtml(nc.descripcion) + '">' + window.KAIRUtils.escapeHtml(nc.descripcion) + '</div></td>' +
        '<td><span class="kair-nc-status ' + estadoNcClass + '"><span class="kair-nc-status__dot"></span> ' + estadoLabel + '</span></td>' +
        '<td>' + window.KAIRUtils.escapeHtml(nc.responsableSeguimiento) + '</td>' +
        '<td><div class="kair-row-actions">' + actionHtml + '</div></td></tr>';
    }).join('');
  }

  function openModal() {
    var modal = document.getElementById('kair-es-nc-modal');
    if (!modal) return;
    var asociadoSelect = document.getElementById('kair-es-nc-asociado');
    if (asociadoSelect) {
      var asociados = window.AsociadosServiceES.getAll();
      asociadoSelect.innerHTML = '<option value="">-- Seleccione --</option>';
      asociados.forEach(function (a) {
        var opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.razonSocial + ' (' + window.KAIRUtils.getTipoLabel(a.tipo) + ')';
        asociadoSelect.appendChild(opt);
      });
    }
    var fechaEl = document.getElementById('kair-es-nc-fecha');
    if (fechaEl) fechaEl.value = window.KAIRUtils.todayISO();
    ['kair-es-nc-descripcion', 'kair-es-nc-plan', 'kair-es-nc-responsable', 'kair-es-nc-observaciones'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    modal.classList.add('kair-modal-overlay--active');
  }

  function closeModal() {
    var modal = document.getElementById('kair-es-nc-modal');
    if (modal) modal.classList.remove('kair-modal-overlay--active');
  }

  function validateForm() {
    var errors = [];
    if (!document.getElementById('kair-es-nc-asociado') || !document.getElementById('kair-es-nc-asociado').value) errors.push('Seleccione un asociado');
    var desc = document.getElementById('kair-es-nc-descripcion');
    if (!desc || !desc.value.trim()) errors.push('La descripción es requerida');
    var resp = document.getElementById('kair-es-nc-responsable');
    if (!resp || !resp.value.trim()) errors.push('El responsable de seguimiento es requerido');
    var fecha = document.getElementById('kair-es-nc-fecha-limite');
    if (!fecha || !fecha.value) errors.push('La fecha límite es requerida');
    return errors;
  }

  function saveNC() {
    var errors = validateForm();
    if (errors.length > 0) { window.KAIRUtils.showToast(errors[0], 'warning'); return; }
    window.NoConformidadesServiceES.create({
      asociadoId: document.getElementById('kair-es-nc-asociado').value,
      fechaDeteccion: document.getElementById('kair-es-nc-fecha').value,
      descripcion: document.getElementById('kair-es-nc-descripcion').value.trim(),
      detectadoPor: document.getElementById('kair-es-nc-detectado').value || 'SST',
      planAccion: document.getElementById('kair-es-nc-plan').value.trim(),
      responsableSeguimiento: document.getElementById('kair-es-nc-responsable').value.trim(),
      fechaLimite: document.getElementById('kair-es-nc-fecha-limite').value,
      observaciones: document.getElementById('kair-es-nc-observaciones').value.trim(),
    });
    window.KAIRUtils.showToast('No conformidad reportada correctamente', 'success');
    closeModal(); renderTable();
  }

  function advanceStatus(ncId) {
    var nc = window.NoConformidadesServiceES.getById(ncId);
    if (!nc) return;
    var nextEstado = nc.estado === 'ABIERTA' ? 'EN_SEGUIMIENTO' : 'CERRADA';
    var nextLabel = window.KAIRUtils.getNCEstadoLabel(nextEstado);
    window.KAIRUtils.showConfirm('¿Cambiar el estado de esta NC a "' + nextLabel + '"?').then(function (confirmed) {
      if (confirmed) {
        window.NoConformidadesServiceES.updateEstado(ncId, nextEstado);
        window.KAIRUtils.showToast('NC cambiada a "' + nextLabel + '"', 'success');
        renderTable();
      }
    });
  }

  window.NoConformidadesModuleES = { load: load, openModal: openModal, closeModal: closeModal, advanceStatus: advanceStatus };
})();
