// modules/gestion-humana/base-personal/index.js
// 📦709 · Submódulo "Base de Personal" — UI completa (Fase 5)
//
// Tabla con búsqueda + filtros + CRUD completo via KairConfirm + IPC.
// Backend: 5 read + 4 write handlers (probados con 130+ tests).

class BasePersonalComponent {
  constructor(container, companyName, moduleName, submoduleName, onBack) {
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.submoduleName = submoduleName;
    this.onBack = onBack;
    this.personales = [];
    this.filtered = [];
    this.search = '';
    this.filterEstado = 'all';
  }

  // === HELPERS ===
  _fmt(n) {
    if (n == null) return '—';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
  }
  _toast() {
    return (window.parent && window.parent.KAIRToast) ? window.parent.KAIRToast : window.KAIRToast;
  }
  _confirmDialog() {
    return (window.parent && window.parent.KairConfirm) ? window.parent.KairConfirm : window.KairConfirm;
  }
  _showToast(msg, type) {
    var t = this._toast();
    if (t) t.show(msg, type || 'info');
  }
  _escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  _estadoColor(estado) {
    var colors = {
      'activo': '#28a745', 'incapacitado': '#dc3545', 'vacaciones': '#fd7e14',
      'permiso': '#6f42c1', 'maternidad': '#17a2b8', 'paternidad': '#17a2b8',
      'luto': '#6c757d', 'retirado': '#868e96'
    };
    return colors[estado] || '#6c757d';
  }

  // === DATA ===
  async _load() {
    if (!window.electronAPI || !this.companyName) return;
    try {
      var r = await window.electronAPI.ghListPersonal({ companyName: this.companyName });
      if (r && r.success) {
        this.personales = r.data.personales;
        this._applyFilter();
        this._render();
      } else {
        this._showToast('Error cargando personal: ' + (r.error ? r.error.message : 'desconocido'), 'error');
      }
    } catch (e) {
      this._showToast('Error: ' + e.message, 'error');
    }
  }

  _applyFilter() {
    var s = this.search.toLowerCase().trim();
    this.filtered = this.personales.filter(function (p) {
      var matchSearch = !s || (p.nombres && p.nombres.toLowerCase().indexOf(s) >= 0)
        || (p.apellidos && p.apellidos.toLowerCase().indexOf(s) >= 0)
        || (p.cedula && p.cedula.indexOf(s) >= 0)
        || (p.cargo && p.cargo.toLowerCase().indexOf(s) >= 0);
      var matchEstado = this.filterEstado === 'all' || p.estado === this.filterEstado;
      return matchSearch && matchEstado;
    }.bind(this));
  }

  // === RENDER ===
  render() {
    var self = this;
    this.container.innerHTML = '';

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding:0;height:100%;overflow-y:auto;background:#f8f9fa;display:flex;flex-direction:column;';

    // ═══ HEADER ═══
    var header = document.createElement('div');
    header.style.cssText = 'background:white;border-bottom:1px solid #e9ecef;padding:1rem 2rem;display:flex;align-items:center;gap:1rem;flex-shrink:0;';
    header.innerHTML =
      '<button id="bp-back-btn" style="background:#f8f9fa;border:1px solid #dee2e6;padding:0.4rem 0.75rem;border-radius:0.5rem;cursor:pointer;color:#6c757d;font-size:0.8rem;display:inline-flex;align-items:center;gap:0.375rem;">' +
        '<i class="fas fa-arrow-left"></i> Volver' +
      '</button>' +
      '<div style="flex:1;">' +
        '<h1 style="margin:0;font-size:1.25rem;color:#1a1a2e;display:flex;align-items:center;gap:0.5rem;">' +
          '<i class="fas fa-users" style="color:#174ea6;"></i> Base de Personal' +
        '</h1>' +
        '<div style="font-size:0.7rem;color:#6c757d;">' + this.companyName + ' · Gestión Humana</div>' +
      '</div>' +
      '<button id="bp-new-btn" style="background:#28a745;color:white;border:none;padding:0.5rem 1rem;border-radius:0.4rem;cursor:pointer;font-size:0.85rem;font-weight:500;display:inline-flex;align-items:center;gap:0.4rem;">' +
        '<i class="fas fa-plus"></i> Nuevo Trabajador' +
      '</button>';
    wrapper.appendChild(header);

    // ═══ STATS BAR ═══
    var statsBar = document.createElement('div');
    statsBar.id = 'bp-stats-bar';
    statsBar.style.cssText = 'background:#f8f9fa;padding:0.75rem 2rem;border-bottom:1px solid #e9ecef;display:flex;gap:1rem;flex-wrap:wrap;flex-shrink:0;';
    wrapper.appendChild(statsBar);

    // ═══ FILTERS BAR ═══
    var filtersBar = document.createElement('div');
    filtersBar.style.cssText = 'background:white;padding:0.75rem 2rem;border-bottom:1px solid #e9ecef;display:flex;gap:0.75rem;align-items:center;flex-shrink:0;';
    filtersBar.innerHTML =
      '<div style="flex:1;position:relative;">' +
        '<i class="fas fa-search" style="position:absolute;left:0.75rem;top:50%;transform:translateY(-50%);color:#6c757d;font-size:0.85rem;"></i>' +
        '<input id="bp-search" type="text" placeholder="Buscar por cédula, nombre, apellido o cargo..." value="' + this._escHtml(this.search) + '" style="width:100%;padding:0.5rem 0.75rem 0.5rem 2.25rem;border:1px solid #dee2e6;border-radius:0.4rem;font-size:0.85rem;outline:none;" />' +
      '</div>' +
      '<select id="bp-filter-estado" style="padding:0.5rem 0.75rem;border:1px solid #dee2e6;border-radius:0.4rem;font-size:0.85rem;background:white;outline:none;cursor:pointer;">' +
        '<option value="all">Todos los estados</option>' +
        '<option value="activo">Activos</option>' +
        '<option value="incapacitado">Incapacitados</option>' +
        '<option value="vacaciones">En Vacaciones</option>' +
        '<option value="permiso">En Permiso</option>' +
        '<option value="maternidad">Maternidad</option>' +
        '<option value="paternidad">Paternidad</option>' +
        '<option value="luto">Luto</option>' +
        '<option value="retirado">Retirados</option>' +
      '</select>';
    wrapper.appendChild(filtersBar);

    // ═══ TABLE CONTAINER ═══
    var tableContainer = document.createElement('div');
    tableContainer.id = 'bp-table-container';
    tableContainer.style.cssText = 'flex:1;overflow-y:auto;background:white;';
    wrapper.appendChild(tableContainer);

    this.container.appendChild(wrapper);

    // Wire up
    document.getElementById('bp-back-btn').onclick = function () { if (self.onBack) self.onBack(); };
    document.getElementById('bp-new-btn').onclick = function () { self._openCreateModal(); };
    var searchInput = document.getElementById('bp-search');
    searchInput.oninput = function (e) { self.search = e.target.value; self._applyFilter(); self._renderTable(); };
    document.getElementById('bp-filter-estado').value = this.filterEstado;
    document.getElementById('bp-filter-estado').onchange = function (e) { self.filterEstado = e.target.value; self._applyFilter(); self._renderTable(); };

    this._load();
  }

  _renderStatsBar() {
    var total = this.personales.length;
    var activos = this.personales.filter(function (p) { return p.estado === 'activo'; }).length;
    var retirados = this.personales.filter(function (p) { return p.estado === 'retirado'; }).length;
    var vacaciones = this.personales.filter(function (p) { return p.estado === 'vacaciones'; }).length;
    var permisos = this.personales.filter(function (p) { return p.estado === 'permiso' || p.estado === 'maternidad' || p.estado === 'paternidad' || p.estado === 'luto' || p.estado === 'incapacitado'; }).length;
    var stats = [
      { label: 'Total', value: total, color: '#174ea6' },
      { label: 'Activos', value: activos, color: '#28a745' },
      { label: 'Vacaciones', value: vacaciones, color: '#fd7e14' },
      { label: 'Permisos / Otros', value: permisos, color: '#6f42c1' },
      { label: 'Retirados', value: retirados, color: '#868e96' }
    ];
    var html = '';
    stats.forEach(function (s) {
      html += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.25rem 0.75rem;border-right:1px solid #dee2e6;">' +
        '<div style="font-size:1.1rem;font-weight:700;color:' + s.color + ';">' + s.value + '</div>' +
        '<div style="font-size:0.65rem;text-transform:uppercase;color:#6c757d;letter-spacing:0.3px;">' + s.label + '</div>' +
      '</div>';
    });
    document.getElementById('bp-stats-bar').innerHTML = html;
  }

  _renderTable() {
    var container = document.getElementById('bp-table-container');
    if (!container) return;

    if (this.filtered.length === 0) {
      container.innerHTML =
        '<div style="padding:4rem 2rem;text-align:center;color:#6c757d;">' +
          '<i class="fas fa-inbox" style="font-size:3rem;margin-bottom:1rem;color:#dee2e6;"></i>' +
          '<p style="font-size:1rem;margin:0;">' + (this.personales.length === 0 ? 'No hay trabajadores registrados todavía.' : 'No se encontraron trabajadores con esos filtros.') + '</p>' +
          (this.personales.length === 0 ? '<p style="font-size:0.85rem;margin:0.5rem 0 0;">Hacé click en <strong>Nuevo Trabajador</strong> para empezar.</p>' : '') +
        '</div>';
      return;
    }

    var rows = '';
    this.filtered.forEach(function (p) {
      var estadoColor = this._estadoColor(p.estado);
      rows += '<tr style="border-bottom:1px solid #f1f3f5;">' +
        '<td style="padding:0.625rem 1rem;color:#6c757d;font-family:monospace;font-size:0.8rem;">' + this._escHtml(p.cedula) + '</td>' +
        '<td style="padding:0.625rem 1rem;">' +
          '<div style="font-weight:500;color:#1a1a2e;">' + this._escHtml(p.nombres + ' ' + p.apellidos) + '</div>' +
          (p.email ? '<div style="font-size:0.7rem;color:#6c757d;">' + this._escHtml(p.email) + '</div>' : '') +
        '</td>' +
        '<td style="padding:0.625rem 1rem;color:#495057;">' + this._escHtml(p.cargo || '—') + '</td>' +
        '<td style="padding:0.625rem 1rem;">' +
          '<span style="background:' + estadoColor + ';color:white;padding:0.15rem 0.5rem;border-radius:0.75rem;font-size:0.7rem;font-weight:600;text-transform:capitalize;">' + this._escHtml(p.estado) + '</span>' +
        '</td>' +
        '<td style="padding:0.625rem 1rem;color:#495057;text-align:right;font-variant-numeric:tabular-nums;">' + this._fmt(p.salario) + '</td>' +
        '<td style="padding:0.625rem 1rem;text-align:right;">' +
          '<button class="bp-edit" data-id="' + this._escHtml(p.id) + '" style="background:#e8f0fe;color:#174ea6;border:none;padding:0.3rem 0.6rem;border-radius:0.3rem;cursor:pointer;font-size:0.75rem;margin-right:0.25rem;">' +
            '<i class="fas fa-edit"></i>' +
          '</button>' +
          '<button class="bp-del" data-id="' + this._escHtml(p.id) + '" data-nombre="' + this._escHtml(p.nombres + ' ' + p.apellidos) + '" style="background:#f8d7da;color:#dc3545;border:none;padding:0.3rem 0.6rem;border-radius:0.3rem;cursor:pointer;font-size:0.75rem;">' +
            '<i class="fas fa-trash"></i>' +
          '</button>' +
        '</td>' +
      '</tr>';
    }.bind(this));

    container.innerHTML =
      '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">' +
        '<thead style="background:#f8f9fa;position:sticky;top:0;z-index:1;">' +
          '<tr style="border-bottom:2px solid #dee2e6;">' +
            '<th style="padding:0.75rem 1rem;text-align:left;font-size:0.7rem;text-transform:uppercase;color:#6c757d;letter-spacing:0.3px;font-weight:600;">Cédula</th>' +
            '<th style="padding:0.75rem 1rem;text-align:left;font-size:0.7rem;text-transform:uppercase;color:#6c757d;letter-spacing:0.3px;font-weight:600;">Nombre</th>' +
            '<th style="padding:0.75rem 1rem;text-align:left;font-size:0.7rem;text-transform:uppercase;color:#6c757d;letter-spacing:0.3px;font-weight:600;">Cargo</th>' +
            '<th style="padding:0.75rem 1rem;text-align:left;font-size:0.7rem;text-transform:uppercase;color:#6c757d;letter-spacing:0.3px;font-weight:600;">Estado</th>' +
            '<th style="padding:0.75rem 1rem;text-align:right;font-size:0.7rem;text-transform:uppercase;color:#6c757d;letter-spacing:0.3px;font-weight:600;">Salario</th>' +
            '<th style="padding:0.75rem 1rem;text-align:right;font-size:0.7rem;text-transform:uppercase;color:#6c757d;letter-spacing:0.3px;font-weight:600;">Acciones</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>';

    this._renderStatsBar();

    // Wire up row actions
    var self = this;
    var editBtns = container.querySelectorAll('.bp-edit');
    editBtns.forEach(function (btn) {
      btn.onclick = function () { self._openEditModal(btn.getAttribute('data-id')); };
    });
    var delBtns = container.querySelectorAll('.bp-del');
    delBtns.forEach(function (btn) {
      btn.onclick = function () { self._openDeleteConfirm(btn.getAttribute('data-id'), btn.getAttribute('data-nombre')); };
    });
  }

  _render() {
    this._renderStatsBar();
    this._renderTable();
  }

  // === CREATE / EDIT MODAL via KairConfirm.input() ===
  async _openCreateModal() {
    var values = await this._confirmDialog().input({
      title: '➕ Nuevo Trabajador',
      message: 'Completá los datos del nuevo trabajador. Cédula, nombres y apellidos son obligatorios.',
      fields: [
        { key: 'nombres', label: 'Nombres', type: 'text', required: true, placeholder: 'Ej: Juan Carlos' },
        { key: 'apellidos', label: 'Apellidos', type: 'text', required: true, placeholder: 'Ej: Pérez García' },
        { key: 'cedula', label: 'Cédula', type: 'text', required: true, placeholder: '1234567890' },
        { key: 'cargo', label: 'Cargo', type: 'text', required: true, placeholder: 'Ej: Operario' },
        { key: 'salario', label: 'Salario (COP)', type: 'number', placeholder: '1500000' },
        { key: 'telefono', label: 'Teléfono', type: 'text', placeholder: '3001234567' },
        { key: 'email', label: 'Email', type: 'text', placeholder: 'email@empresa.com' },
        { key: 'fechaIngreso', label: 'Fecha de Ingreso (YYYY-MM-DD)', type: 'text', placeholder: '2026-01-15' }
      ],
      confirmText: 'Crear Trabajador',
      type: 'info'
    });
    if (!values) return;
    this._create(values);
  }

  async _openEditModal(personalId) {
    var p = this.personales.find(function (x) { return x.id === personalId; });
    if (!p) {
      this._showToast('Trabajador no encontrado', 'error');
      return;
    }
    var values = await this._confirmDialog().input({
      title: '✏️ Editar Trabajador',
      message: 'Modificá los campos que necesites. Dejá vacío lo que no cambia.',
      fields: [
        { key: 'nombres', label: 'Nombres', type: 'text', required: true, value: p.nombres || '' },
        { key: 'apellidos', label: 'Apellidos', type: 'text', required: true, value: p.apellidos || '' },
        { key: 'cedula', label: 'Cédula', type: 'text', required: true, value: p.cedula || '' },
        { key: 'cargo', label: 'Cargo', type: 'text', required: true, value: p.cargo || '' },
        { key: 'salario', label: 'Salario (COP)', type: 'number', value: p.salario || '' },
        { key: 'telefono', label: 'Teléfono', type: 'text', value: p.telefono || '' },
        { key: 'email', label: 'Email', type: 'text', value: p.email || '' },
        { key: 'fechaIngreso', label: 'Fecha de Ingreso (YYYY-MM-DD)', type: 'text', value: p.fechaIngreso || '' },
        { key: 'estado', label: 'Estado', type: 'text', value: p.estado || 'activo' }
      ],
      confirmText: 'Guardar Cambios',
      type: 'info'
    });
    if (!values) return;
    this._update(personalId, values);
  }

  async _openDeleteConfirm(personalId, nombre) {
    var confirmed = await this._confirmDialog().confirm({
      title: '🗑️ Retirar Trabajador',
      message: '¿Querés retirar a "' + nombre + '"?',
      details: 'Esto hace un soft delete (activo=0, estado=retirado). El registro se preserva para histórico. Después podés volver a activarlo cambiándole el estado.',
      confirmText: 'Sí, retirar',
      cancelText: 'Cancelar',
      type: 'warning'
    });
    if (!confirmed) return;
    this._delete(personalId);
  }

  // === IPC CALLS ===
  async _create(data) {
    try {
      var r = await window.electronAPI.ghCreatePersonal({ companyName: this.companyName, data: data });
      if (r && r.success) {
        this._showToast('✅ Trabajador creado: ' + data.nombres + ' ' + data.apellidos, 'success');
        await this._load();
      } else {
        this._showToast('❌ Error: ' + (r.error ? r.error.message : 'desconocido'), 'error');
      }
    } catch (e) {
      this._showToast('❌ Error: ' + e.message, 'error');
    }
  }

  async _update(personalId, data) {
    try {
      var r = await window.electronAPI.ghUpdatePersonal({ personalId: personalId, updates: data });
      if (r && r.success) {
        this._showToast('✅ Trabajador actualizado', 'success');
        await this._load();
      } else {
        this._showToast('❌ Error: ' + (r.error ? r.error.message : 'desconocido'), 'error');
      }
    } catch (e) {
      this._showToast('❌ Error: ' + e.message, 'error');
    }
  }

  async _delete(personalId) {
    try {
      var r = await window.electronAPI.ghDeletePersonal({ personalId: personalId });
      if (r && r.success) {
        this._showToast('✅ Trabajador retirado', 'success');
        await this._load();
      } else {
        this._showToast('❌ Error: ' + (r.error ? r.error.message : 'desconocido'), 'error');
      }
    } catch (e) {
      this._showToast('❌ Error: ' + e.message, 'error');
    }
  }

  destroy() {
    if (this.container) this.container.innerHTML = '';
  }
}

window.BasePersonalComponent = BasePersonalComponent;
