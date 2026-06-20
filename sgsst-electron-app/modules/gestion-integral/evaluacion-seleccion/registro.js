/* ==========================================================================
   K+AIR Registro — Módulo 2.10.1 (CRUD de Asociados)
   ========================================================================== */

(function () {
  'use strict';

  var currentFilter = { search: '', tipo: '' };
  var currentEditId = null;

  function load() { renderTable(); setupEventListeners(); }

  function setupEventListeners() {
    var searchInput = document.getElementById('kair-es-registro-search');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) { currentFilter.search = e.target.value; renderTable(); });
    }
    var tipoFilter = document.getElementById('kair-es-registro-tipo-filter');
    if (tipoFilter) {
      tipoFilter.addEventListener('change', function (e) { currentFilter.tipo = e.target.value; renderTable(); });
    }
    var newBtn = document.getElementById('kair-es-registro-new-btn');
    if (newBtn) newBtn.addEventListener('click', function () { openModal(); });
    var closeBtn = document.getElementById('kair-es-registro-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { closeModal(); });
    var cancelBtn = document.getElementById('kair-es-registro-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { closeModal(); });
    var saveBtn = document.getElementById('kair-es-registro-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', function () { saveAsociado(); });
    var tipoSelect = document.getElementById('kair-es-registro-tipo');
    if (tipoSelect) tipoSelect.addEventListener('change', function () { renderDocumentsGrid(); });
    var modalOverlay = document.getElementById('kair-es-registro-modal');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', function (e) { if (e.target === modalOverlay) closeModal(); });
    }
  }

  function renderTable() {
    var tbody = document.getElementById('kair-es-registro-tbody');
    if (!tbody) return;

    var asociados = window.AsociadosServiceES.getAll();
    if (currentFilter.search) {
      var q = currentFilter.search.toLowerCase();
      asociados = asociados.filter(function (a) {
        return a.razonSocial.toLowerCase().includes(q) || a.nit.toLowerCase().includes(q) || a.producto.toLowerCase().includes(q);
      });
    }
    if (currentFilter.tipo) {
      asociados = asociados.filter(function (a) { return a.tipo === currentFilter.tipo; });
    }

    if (asociados.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="kair-table__empty">No se encontraron asociados' + (currentFilter.search ? ' para "' + currentFilter.search + '"' : '') + '.</td></tr>';
      return;
    }

    tbody.innerHTML = asociados.map(function (a) {
      var estadoLabel = window.KAIRUtils.getEstadoLabel(a.estado);
      var estadoDotClass = a.estado === 'ACTIVO' ? 'kair-estado-dot--activo' : 'kair-estado-dot--inactivo';
      var tipoLabel = window.KAIRUtils.getTipoLabel(a.tipo);
      return '<tr>' +
        '<td><strong>' + window.KAIRUtils.escapeHtml(a.nit) + '</strong></td>' +
        '<td>' + window.KAIRUtils.escapeHtml(a.razonSocial) + '</td>' +
        '<td><span class="kair-badge kair-badge--primary">' + tipoLabel + '</span></td>' +
        '<td class="kair-text-muted">' + window.KAIRUtils.escapeHtml(a.producto) + '</td>' +
        '<td><span class="kair-estado-cell"><span class="kair-estado-dot ' + estadoDotClass + '"></span> ' + estadoLabel + '</span></td>' +
        '<td><div class="kair-row-actions">' +
          '<button class="kair-btn kair-btn--secondary kair-btn--icon" onclick="RegistroModuleES.openModal(\'' + a.id + '\')" title="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
          '<button class="kair-btn kair-btn--secondary kair-btn--icon" onclick="RegistroModuleES.deleteAsociado(\'' + a.id + '\')" title="Eliminar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
        '</div></td></tr>';
    }).join('');
  }

  function openModal(asociadoId) {
    var modal = document.getElementById('kair-es-registro-modal');
    var title = document.getElementById('kair-es-registro-modal-title');
    if (!modal) return;

    if (asociadoId) {
      var asociado = window.AsociadosServiceES.getById(asociadoId);
      if (!asociado) return;
      title.textContent = 'Editar Asociado';
      fillForm(asociado);
      currentEditId = asociadoId;
    } else {
      title.textContent = 'Nuevo Asociado';
      clearForm();
      currentEditId = null;
    }
    renderDocumentsGrid();
    modal.classList.add('kair-modal-overlay--active');
  }

  function closeModal() {
    var modal = document.getElementById('kair-es-registro-modal');
    if (modal) { modal.classList.remove('kair-modal-overlay--active'); currentEditId = null; }
  }

  function fillForm(asociado) {
    var fields = {
      'kair-es-registro-tipo': asociado.tipo, 'kair-es-registro-nit': asociado.nit,
      'kair-es-registro-razon': asociado.razonSocial, 'kair-es-registro-producto': asociado.producto,
      'kair-es-registro-direccion': asociado.direccion, 'kair-es-registro-telefono': asociado.telefono,
      'kair-es-registro-email': asociado.email, 'kair-es-registro-contacto': asociado.contacto,
      'kair-es-registro-observaciones': asociado.observaciones,
    };
    Object.keys(fields).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = fields[id] || '';
    });
    setTimeout(function () {
      var docs = asociado.documentos || {};
      Object.keys(docs).forEach(function (key) {
        var cb = document.getElementById('kair-es-registro-doc-' + key);
        if (cb) cb.checked = !!docs[key];
      });
    }, 50);
  }

  function clearForm() {
    ['kair-es-registro-tipo', 'kair-es-registro-nit', 'kair-es-registro-razon', 'kair-es-registro-producto',
     'kair-es-registro-direccion', 'kair-es-registro-telefono', 'kair-es-registro-email',
     'kair-es-registro-contacto', 'kair-es-registro-observaciones'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    document.querySelectorAll('#kair-es-registro-docs-grid input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });
    clearErrors();
  }

  function clearErrors() {
    document.querySelectorAll('.kair-form-error').forEach(function (el) { el.remove(); });
    document.querySelectorAll('.kair-input--error, .kair-select--error, .kair-textarea--error').forEach(function (el) {
      el.classList.remove('kair-input--error', 'kair-select--error', 'kair-textarea--error');
    });
  }

  function showFieldError(fieldId, message) {
    var field = document.getElementById(fieldId);
    if (field) field.classList.add(field.tagName === 'SELECT' ? 'kair-select--error' : 'kair-input--error');
    if (field && field.parentNode) {
      var errorEl = document.createElement('span');
      errorEl.className = 'kair-form-error';
      errorEl.textContent = message;
      field.parentNode.appendChild(errorEl);
    }
  }

  function renderDocumentsGrid() {
    var tipoSelect = document.getElementById('kair-es-registro-tipo');
    var grid = document.getElementById('kair-es-registro-docs-grid');
    if (!tipoSelect || !grid) return;
    var tipo = tipoSelect.value || 'PROVEEDOR';
    var docs = window.KAIRUtils.getRequiredDocuments(tipo);
    var currentValues = {};
    grid.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      currentValues[cb.id.replace('kair-es-registro-doc-', '')] = cb.checked;
    });
    grid.innerHTML = docs.map(function (doc) {
      return '<label class="kair-checkbox"><input type="checkbox" id="kair-es-registro-doc-' + doc.key + '" ' + (currentValues[doc.key] ? 'checked' : '') + '><span class="kair-checkbox__label">' + doc.label + '</span></label>';
    }).join('');
  }

  function collectDocuments() {
    var docs = {};
    document.querySelectorAll('#kair-es-registro-docs-grid input[type="checkbox"]').forEach(function (cb) {
      docs[cb.id.replace('kair-es-registro-doc-', '')] = cb.checked;
    });
    return docs;
  }

  function validateForm() {
    clearErrors();
    var isValid = true;
    var tipo = document.getElementById('kair-es-registro-tipo') && document.getElementById('kair-es-registro-tipo').value;
    var nit = document.getElementById('kair-es-registro-nit') && document.getElementById('kair-es-registro-nit').value.trim();
    var razon = document.getElementById('kair-es-registro-razon') && document.getElementById('kair-es-registro-razon').value.trim();
    var producto = document.getElementById('kair-es-registro-producto') && document.getElementById('kair-es-registro-producto').value.trim();
    if (!tipo) { showFieldError('kair-es-registro-tipo', 'Seleccione un tipo'); isValid = false; }
    if (!nit) { showFieldError('kair-es-registro-nit', 'NIT/CC es requerido'); isValid = false; }
    if (!razon) { showFieldError('kair-es-registro-razon', 'Razón social es requerida'); isValid = false; }
    if (!producto) { showFieldError('kair-es-registro-producto', 'Producto/servicio es requerido'); isValid = false; }
    var email = document.getElementById('kair-es-registro-email') && document.getElementById('kair-es-registro-email').value.trim();
    if (email) { var emailError = window.KAIRUtils.validateEmail(email); if (emailError) { showFieldError('kair-es-registro-email', emailError); isValid = false; } }
    return isValid;
  }

  function saveAsociado() {
    if (!validateForm()) return;
    var data = {
      tipo: document.getElementById('kair-es-registro-tipo').value,
      nit: document.getElementById('kair-es-registro-nit').value.trim(),
      razonSocial: document.getElementById('kair-es-registro-razon').value.trim(),
      producto: document.getElementById('kair-es-registro-producto').value.trim(),
      direccion: document.getElementById('kair-es-registro-direccion').value.trim(),
      telefono: document.getElementById('kair-es-registro-telefono').value.trim(),
      email: document.getElementById('kair-es-registro-email').value.trim(),
      contacto: document.getElementById('kair-es-registro-contacto').value.trim(),
      observaciones: document.getElementById('kair-es-registro-observaciones').value.trim(),
      documentos: collectDocuments(), estado: 'ACTIVO',
    };
    if (currentEditId) {
      window.AsociadosServiceES.update(currentEditId, data);
      window.KAIRUtils.showToast('Asociado actualizado correctamente', 'success');
    } else {
      window.AsociadosServiceES.create(data);
      window.KAIRUtils.showToast('Asociado registrado correctamente', 'success');
    }
    closeModal(); renderTable();
  }

  async function deleteAsociado(id) {
    var asociado = window.AsociadosServiceES.getById(id);
    if (!asociado) return;
    var confirmed = await window.KAIRUtils.showConfirm('¿Está seguro de eliminar a "' + asociado.razonSocial + '"? Esta acción no se puede deshacer.');
    if (confirmed) {
      window.AsociadosServiceES.remove(id);
      window.KAIRUtils.showToast('Asociado eliminado', 'info');
      renderTable();
    }
  }

  window.RegistroModuleES = { load: load, openModal: openModal, closeModal: closeModal, deleteAsociado: deleteAsociado };
})();
