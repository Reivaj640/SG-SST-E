// modules/gestion-humana/contratacion/index.js
// 📦709 · Submódulo "Contratación" — UI completa (Fase 6)
//
// Tabla con filtros + CRUD básico + detalle de 6 pasos + marcar paso.
// Backend: 5 read + 4 write handlers (probados con 155+ tests).

class ContratacionComponent {
  constructor(container, companyName, moduleName, submoduleName, onBack) {
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.submoduleName = submoduleName;
    this.onBack = onBack;
    this.contrataciones = [];
    this.filtered = [];
    this.search = '';
    this.filterEstado = 'all';
  }

  static get PASOS() {
    return [
      { num: 1, label: 'Memo / Correo', desc: 'Recepción del memo con datos del trabajador', icon: 'fa-envelope', color: '#3b82f6' },
      { num: 2, label: 'Contacto Aspirante', desc: 'Llamar/WhatsApp para citar el día antes del ingreso', icon: 'fa-phone', color: '#3b82f6' },
      { num: 3, label: 'Exámenes Médicos', desc: 'Coordinar con IPS según fecha de ingreso', icon: 'fa-stethoscope', color: '#3b82f6' },
      { num: 4, label: 'Firma de Documentos', desc: '7 formatos: autorizaciones, datos, contrato, cartas', icon: 'fa-pen', color: '#3b82f6' },
      { num: 5, label: 'Afiliaciones', desc: 'EPS, Pensión, ARL, Caja de Compensación', icon: 'fa-shield-check', color: '#3b82f6' },
      { num: 6, label: 'Activación S400', desc: 'Activación en sistema interno tras autorización', icon: 'fa-microchip', color: '#3b82f6' }
    ];
  }

  // === HELPERS ===
  _fmtDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return iso; }
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
      'en_proceso': '#0d9488',
      'completado': '#28a745',
      'cancelado': '#868e96'
    };
    return colors[estado] || '#6c757d';
  }
  _estadoLabel(estado) {
    var labels = { 'en_proceso': 'En Proceso', 'completado': 'Completado', 'cancelado': 'Cancelado' };
    return labels[estado] || estado;
  }
  _pasoBoolKey(pasoNum) {
    return ['', 'memo_recibido', 'contacto_realizado', 'examenes_programados', 'documentos_firmados', 'afiliaciones_completadas', 's400_activado'][pasoNum];
  }
  _pasoFechaKey(pasoNum) {
    return ['', 'memo_fecha', 'contacto_fecha', 'examenes_fecha', 'documentos_fecha', 'afiliaciones_fecha', 's400_fecha'][pasoNum];
  }

  // === DATA ===
  async _load() {
    if (!window.electronAPI || !this.companyName) return;
    try {
      var r = await window.electronAPI.ghListContrataciones({ companyName: this.companyName });
      if (r && r.success) {
        this.contrataciones = r.data.contrataciones;
        this._applyFilter();
        this._render();
      } else {
        this._showToast('Error: ' + (r.error ? r.error.message : 'desconocido'), 'error');
      }
    } catch (e) {
      this._showToast('Error: ' + e.message, 'error');
    }
  }

  _applyFilter() {
    var s = this.search.toLowerCase().trim();
    this.filtered = this.contrataciones.filter(function (c) {
      var matchSearch = !s || (c.nombres && c.nombres.toLowerCase().indexOf(s) >= 0)
        || (c.apellidos && c.apellidos.toLowerCase().indexOf(s) >= 0)
        || (c.cedula && c.cedula.indexOf(s) >= 0)
        || (c.cargo && c.cargo.toLowerCase().indexOf(s) >= 0);
      var matchEstado = this.filterEstado === 'all' || c.estado === this.filterEstado;
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
      '<button id="ct-back-btn" style="background:#f8f9fa;border:1px solid #dee2e6;padding:0.4rem 0.75rem;border-radius:0.5rem;cursor:pointer;color:#6c757d;font-size:0.8rem;display:inline-flex;align-items:center;gap:0.375rem;">' +
        '<i class="fas fa-arrow-left"></i> Volver' +
      '</button>' +
      '<div style="flex:1;">' +
        '<h1 style="margin:0;font-size:1.25rem;color:#1a1a2e;display:flex;align-items:center;gap:0.5rem;">' +
          '<i class="fas fa-user-plus" style="color:#0d9488;"></i> Contratación' +
        '</h1>' +
        '<div style="font-size:0.7rem;color:#6c757d;">' + this.companyName + ' · Pipeline de onboarding (6 pasos)</div>' +
      '</div>' +
      '<button id="ct-new-btn" style="background:#0d9488;color:white;border:none;padding:0.5rem 1rem;border-radius:0.4rem;cursor:pointer;font-size:0.85rem;font-weight:500;display:inline-flex;align-items:center;gap:0.4rem;">' +
        '<i class="fas fa-plus"></i> Nueva Contratación' +
      '</button>';
    wrapper.appendChild(header);

    // ═══ STATS BAR ═══
    var statsBar = document.createElement('div');
    statsBar.id = 'ct-stats-bar';
    statsBar.style.cssText = 'background:#f8f9fa;padding:0.75rem 2rem;border-bottom:1px solid #e9ecef;display:flex;gap:1rem;flex-wrap:wrap;flex-shrink:0;';
    wrapper.appendChild(statsBar);

    // ═══ FILTERS BAR ═══
    var filtersBar = document.createElement('div');
    filtersBar.style.cssText = 'background:white;padding:0.75rem 2rem;border-bottom:1px solid #e9ecef;display:flex;gap:0.75rem;align-items:center;flex-shrink:0;';
    filtersBar.innerHTML =
      '<div style="flex:1;position:relative;">' +
        '<i class="fas fa-search" style="position:absolute;left:0.75rem;top:50%;transform:translateY(-50%);color:#6c757d;font-size:0.85rem;"></i>' +
        '<input id="ct-search" type="text" placeholder="Buscar por cédula, nombre, apellido o cargo..." value="' + this._escHtml(this.search) + '" style="width:100%;padding:0.5rem 0.75rem 0.5rem 2.25rem;border:1px solid #dee2e6;border-radius:0.4rem;font-size:0.85rem;outline:none;" />' +
      '</div>' +
      '<select id="ct-filter-estado" style="padding:0.5rem 0.75rem;border:1px solid #dee2e6;border-radius:0.4rem;font-size:0.85rem;background:white;outline:none;cursor:pointer;">' +
        '<option value="all">Todos los estados</option>' +
        '<option value="en_proceso">En Proceso</option>' +
        '<option value="completado">Completados</option>' +
        '<option value="cancelado">Cancelados</option>' +
      '</select>';
    wrapper.appendChild(filtersBar);

    // ═══ TABLE CONTAINER ═══
    var tableContainer = document.createElement('div');
    tableContainer.id = 'ct-table-container';
    tableContainer.style.cssText = 'flex:1;overflow-y:auto;background:white;';
    wrapper.appendChild(tableContainer);

    this.container.appendChild(wrapper);

    // Wire up
    document.getElementById('ct-back-btn').onclick = function () { if (self.onBack) self.onBack(); };
    document.getElementById('ct-new-btn').onclick = function () { self._openCreateModal(); };
    document.getElementById('ct-search').oninput = function (e) { self.search = e.target.value; self._applyFilter(); self._renderTable(); };
    document.getElementById('ct-filter-estado').value = this.filterEstado;
    document.getElementById('ct-filter-estado').onchange = function (e) { self.filterEstado = e.target.value; self._applyFilter(); self._renderTable(); };

    this._load();
  }

  _renderStatsBar() {
    var total = this.contrataciones.length;
    var enProceso = this.contrataciones.filter(function (c) { return c.estado === 'en_proceso'; }).length;
    var completados = this.contrataciones.filter(function (c) { return c.estado === 'completado'; }).length;
    var cancelados = this.contrataciones.filter(function (c) { return c.estado === 'cancelado'; }).length;
    var stats = [
      { label: 'Total', value: total, color: '#174ea6' },
      { label: 'En Proceso', value: enProceso, color: '#0d9488' },
      { label: 'Completados', value: completados, color: '#28a745' },
      { label: 'Cancelados', value: cancelados, color: '#868e96' }
    ];
    var html = '';
    stats.forEach(function (s) {
      html += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.25rem 0.75rem;border-right:1px solid #dee2e6;">' +
        '<div style="font-size:1.1rem;font-weight:700;color:' + s.color + ';">' + s.value + '</div>' +
        '<div style="font-size:0.65rem;text-transform:uppercase;color:#6c757d;letter-spacing:0.3px;">' + s.label + '</div>' +
      '</div>';
    });
    document.getElementById('ct-stats-bar').innerHTML = html;
  }

  _renderTable() {
    var container = document.getElementById('ct-table-container');
    if (!container) return;

    if (this.filtered.length === 0) {
      container.innerHTML =
        '<div style="padding:4rem 2rem;text-align:center;color:#6c757d;">' +
          '<i class="fas fa-inbox" style="font-size:3rem;margin-bottom:1rem;color:#dee2e6;"></i>' +
          '<p style="font-size:1rem;margin:0;">' + (this.contrataciones.length === 0 ? 'No hay procesos de contratación.' : 'No se encontraron procesos con esos filtros.') + '</p>' +
          (this.contrataciones.length === 0 ? '<p style="font-size:0.85rem;margin:0.5rem 0 0;">Hacé click en <strong>Nueva Contratación</strong> para empezar un proceso.</p>' : '') +
        '</div>';
      return;
    }

    var rows = '';
    var self = this;
    this.filtered.forEach(function (c) {
      var estadoColor = self._estadoColor(c.estado);
      var paso = c.pasoActual || 1;
      var pasoLabel = paso + '/6';
      rows += '<tr style="border-bottom:1px solid #f1f3f5;">' +
        '<td style="padding:0.625rem 1rem;color:#6c757d;font-family:monospace;font-size:0.8rem;">' + self._escHtml(c.cedula || '—') + '</td>' +
        '<td style="padding:0.625rem 1rem;">' +
          '<div style="font-weight:500;color:#1a1a2e;">' + self._escHtml(c.nombres + ' ' + c.apellidos) + '</div>' +
          '<div style="font-size:0.7rem;color:#6c757d;">' + self._escHtml(c.cargo || '—') + '</div>' +
        '</td>' +
        '<td style="padding:0.625rem 1rem;color:#495057;">' + self._fmtDate(c.fechaIngreso) + '</td>' +
        '<td style="padding:0.625rem 1rem;">' +
          '<div style="display:flex;align-items:center;gap:0.5rem;">' +
            '<div style="background:#e9ecef;height:6px;width:80px;border-radius:3px;overflow:hidden;">' +
              '<div style="background:#0d9488;height:100%;width:' + ((paso / 6) * 100) + '%;"></div>' +
            '</div>' +
            '<span style="font-size:0.7rem;color:#6c757d;font-weight:600;">' + pasoLabel + '</span>' +
          '</div>' +
        '</td>' +
        '<td style="padding:0.625rem 1rem;">' +
          '<span style="background:' + estadoColor + ';color:white;padding:0.15rem 0.5rem;border-radius:0.75rem;font-size:0.7rem;font-weight:600;">' + self._escHtml(self._estadoLabel(c.estado)) + '</span>' +
        '</td>' +
        '<td style="padding:0.625rem 1rem;text-align:right;">' +
          '<button class="ct-view" data-id="' + self._escHtml(c.id) + '" style="background:#e8f0fe;color:#174ea6;border:none;padding:0.3rem 0.6rem;border-radius:0.3rem;cursor:pointer;font-size:0.75rem;margin-right:0.25rem;" title="Ver detalle">' +
            '<i class="fas fa-eye"></i>' +
          '</button>' +
          (c.estado !== 'cancelado' ? '<button class="ct-cancel" data-id="' + self._escHtml(c.id) + '" data-nombre="' + self._escHtml(c.nombres + " " + c.apellidos) + '" style="background:#f8d7da;color:#dc3545;border:none;padding:0.3rem 0.6rem;border-radius:0.3rem;cursor:pointer;font-size:0.75rem;" title="Cancelar">' +
            '<i class="fas fa-ban"></i>' +
          '</button>' : '') +
        '</td>' +
      '</tr>';
    });

    container.innerHTML =
      '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">' +
        '<thead style="background:#f8f9fa;position:sticky;top:0;z-index:1;">' +
          '<tr style="border-bottom:2px solid #dee2e6;">' +
            '<th style="padding:0.75rem 1rem;text-align:left;font-size:0.7rem;text-transform:uppercase;color:#6c757d;letter-spacing:0.3px;font-weight:600;">Cédula</th>' +
            '<th style="padding:0.75rem 1rem;text-align:left;font-size:0.7rem;text-transform:uppercase;color:#6c757d;letter-spacing:0.3px;font-weight:600;">Aspirante</th>' +
            '<th style="padding:0.75rem 1rem;text-align:left;font-size:0.7rem;text-transform:uppercase;color:#6c757d;letter-spacing:0.3px;font-weight:600;">Ingreso</th>' +
            '<th style="padding:0.75rem 1rem;text-align:left;font-size:0.7rem;text-transform:uppercase;color:#6c757d;letter-spacing:0.3px;font-weight:600;">Pipeline</th>' +
            '<th style="padding:0.75rem 1rem;text-align:left;font-size:0.7rem;text-transform:uppercase;color:#6c757d;letter-spacing:0.3px;font-weight:600;">Estado</th>' +
            '<th style="padding:0.75rem 1rem;text-align:right;font-size:0.7rem;text-transform:uppercase;color:#6c757d;letter-spacing:0.3px;font-weight:600;">Acciones</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>';

    this._renderStatsBar();

    // Wire up row actions
    var viewBtns = container.querySelectorAll('.ct-view');
    viewBtns.forEach(function (btn) {
      btn.onclick = function () { self._openDetailModal(btn.getAttribute('data-id')); };
    });
    var cancelBtns = container.querySelectorAll('.ct-cancel');
    cancelBtns.forEach(function (btn) {
      btn.onclick = function () { self._openCancelConfirm(btn.getAttribute('data-id'), btn.getAttribute('data-nombre')); };
    });
  }

  _render() {
    this._renderStatsBar();
    this._renderTable();
  }

  // === MODALS ===
  async _openCreateModal() {
    var values = await this._confirmDialog().input({
      title: '➕ Nueva Contratación',
      message: 'Iniciá un nuevo proceso de contratación. Los campos marcados con * son obligatorios.',
      fields: [
        { key: 'nombres', label: 'Nombres', type: 'text', required: true, placeholder: 'Ej: María' },
        { key: 'apellidos', label: 'Apellidos', type: 'text', required: true, placeholder: 'Ej: López García' },
        { key: 'cedula', label: 'Cédula', type: 'text', placeholder: '1234567890' },
        { key: 'telefono', label: 'Teléfono', type: 'text', placeholder: '3001234567' },
        { key: 'cargo', label: 'Cargo', type: 'text', required: true, placeholder: 'Ej: Operario de mantenimiento' },
        { key: 'salario', label: 'Salario (COP)', type: 'number', placeholder: '1500000' },
        { key: 'fechaIngreso', label: 'Fecha de Ingreso (YYYY-MM-DD)', type: 'text', required: true, placeholder: '2026-09-01' }
      ],
      confirmText: 'Crear Contratación',
      type: 'info'
    });
    if (!values) return;
    this._create(values);
  }

  async _openCancelConfirm(contratacionId, nombre) {
    var confirmed = await this._confirmDialog().confirm({
      title: '🚫 Cancelar Contratación',
      message: '¿Cancelar la contratación de "' + nombre + '"?',
      details: 'Esto cambia el estado a "cancelado" (soft via estado). El registro se preserva para histórico.',
      confirmText: 'Sí, cancelar',
      cancelText: 'No, volver',
      type: 'warning'
    });
    if (!confirmed) return;
    this._cancel(contratacionId);
  }

  async _openDetailModal(contratacionId) {
    var c = this.contrataciones.find(function (x) { return x.id === contratacionId; });
    if (!c) {
      this._showToast('Contratación no encontrada', 'error');
      return;
    }

    // Construir el contenido del modal con los 6 pasos
    var pasosHtml = '';
    var pasos = ContratacionComponent.PASOS;
    var self = this;
    pasos.forEach(function (p) {
      var boolKey = self._pasoBoolKey(p.num);
      var fechaKey = self._pasoFechaKey(p.num);
      var completado = c[boolKey] === 1;
      var fecha = c[fechaKey];
      var isCurrent = c.pasoActual === p.num;
      var isPast = c.pasoActual > p.num;
      var bg = completado ? '#d4edda' : (isCurrent ? '#fff3cd' : '#f8f9fa');
      var borderColor = completado ? '#28a745' : (isCurrent ? '#ffc107' : '#dee2e6');
      var iconBg = completado ? '#28a745' : (isCurrent ? '#ffc107' : '#adb5bd');
      var iconClass = completado ? 'fa-check' : (isCurrent ? 'fa-clock' : String(p.num));

      pasosHtml += '<div style="background:' + bg + ';border-left:4px solid ' + borderColor + ';border-radius:0.4rem;padding:0.875rem;margin-bottom:0.5rem;display:flex;align-items:center;gap:0.75rem;">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:' + iconBg + ';color:white;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
          (completado ? '<i class="fas fa-check"></i>' : (isCurrent ? '<i class="fas fa-clock"></i>' : '<span style="font-weight:700;">' + p.num + '</span>')) +
        '</div>' +
        '<div style="flex:1;">' +
          '<div style="font-weight:600;color:#1a1a2e;">' + p.label + '</div>' +
          '<div style="font-size:0.75rem;color:#6c757d;">' + p.desc + '</div>' +
          (fecha ? '<div style="font-size:0.7rem;color:#28a745;margin-top:0.25rem;"><i class="fas fa-calendar-check"></i> ' + self._fmtDate(fecha) + '</div>' : '') +
        '</div>' +
        (c.estado !== 'cancelado' ? '<button class="ct-marcar-paso" data-paso="' + p.num + '" data-contratacion-id="' + self._escHtml(c.id) + '" style="background:' + (completado ? '#6c757d' : '#0d9488') + ';color:white;border:none;padding:0.4rem 0.75rem;border-radius:0.3rem;cursor:pointer;font-size:0.75rem;white-space:nowrap;">' +
          (completado ? '<i class="fas fa-undo"></i> Revertir' : '<i class="fas fa-check"></i> Marcar') +
        '</button>' : '') +
      '</div>';
    });

    // Crear overlay
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:2rem;';
    overlay.innerHTML =
      '<div style="background:white;border-radius:0.5rem;max-width:700px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +
        '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid #dee2e6;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:white;z-index:1;">' +
          '<div>' +
            '<h2 style="margin:0;font-size:1.1rem;color:#1a1a2e;">' + self._escHtml(c.nombres + ' ' + c.apellidos) + '</h2>' +
            '<div style="font-size:0.75rem;color:#6c757d;">' + self._escHtml(c.cargo || '—') + ' · Ingreso: ' + self._fmtDate(c.fechaIngreso) + '</div>' +
          '</div>' +
          '<button id="ct-detail-close" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#6c757d;padding:0 0.5rem;">&times;</button>' +
        '</div>' +
        '<div style="padding:1.5rem;">' +
          '<div style="margin-bottom:1rem;font-size:0.85rem;color:#6c757d;">Pipeline de 6 pasos: ' +
            '<span style="background:' + self._estadoColor(c.estado) + ';color:white;padding:0.15rem 0.5rem;border-radius:0.75rem;font-size:0.7rem;font-weight:600;">' + self._escHtml(self._estadoLabel(c.estado)) + '</span>' +
          '</div>' +
          pasosHtml +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('ct-detail-close').onclick = function () { overlay.remove(); };
    overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };

    // Wire up "Marcar paso" buttons
    var marcarBtns = overlay.querySelectorAll('.ct-marcar-paso');
    marcarBtns.forEach(function (btn) {
      btn.onclick = function () {
        var paso = parseInt(btn.getAttribute('data-paso'), 10);
        var ctId = btn.getAttribute('data-contratacion-id');
        overlay.remove();
        self._openMarcarPasoModal(ctId, paso, c);
      };
    });
  }

  async _openMarcarPasoModal(contratacionId, pasoNum, c) {
    var paso = ContratacionComponent.PASOS.find(function (p) { return p.num === pasoNum; });
    var nuevoEstado = pasoNum === 6;
    var titlePrefix = c[this._pasoBoolKey(pasoNum)] === 1 ? 'Revertir' : 'Marcar';
    var values = await this._confirmDialog().input({
      title: titlePrefix + ' paso ' + pasoNum + ': ' + paso.label,
      message: paso.desc + (nuevoEstado ? '\n\n✅ Marcar el paso 6 cambia el estado a "completado".' : ''),
      fields: [
        { key: 'fecha', label: 'Fecha (YYYY-MM-DD)', type: 'text', required: true, value: new Date().toISOString().slice(0, 10), placeholder: '2026-08-15' },
        { key: 'notas', label: 'Notas (opcional)', type: 'textarea', placeholder: 'Detalles del paso...' }
      ],
      confirmText: titlePrefix + ' paso',
      type: nuevoEstado ? 'success' : 'info'
    });
    if (!values) return;
    this._marcarPaso(contratacionId, pasoNum, values.fecha, values.notas);
  }

  // === IPC CALLS ===
  async _create(data) {
    try {
      var r = await window.electronAPI.ghCreateContratacion({ companyName: this.companyName, data: data });
      if (r && r.success) {
        this._showToast('✅ Contratación creada: ' + data.nombres + ' ' + data.apellidos, 'success');
        await this._load();
      } else {
        this._showToast('❌ Error: ' + (r.error ? r.error.message : 'desconocido'), 'error');
      }
    } catch (e) {
      this._showToast('❌ Error: ' + e.message, 'error');
    }
  }

  async _cancel(contratacionId) {
    try {
      var r = await window.electronAPI.ghDeleteContratacion({ contratacionId: contratacionId });
      if (r && r.success) {
        this._showToast('✅ Contratación cancelada', 'success');
        await this._load();
      } else {
        this._showToast('❌ Error: ' + (r.error ? r.error.message : 'desconocido'), 'error');
      }
    } catch (e) {
      this._showToast('❌ Error: ' + e.message, 'error');
    }
  }

  async _marcarPaso(contratacionId, pasoNum, fecha, notas) {
    try {
      var r = await window.electronAPI.ghMarcarPaso({ contratacionId: contratacionId, pasoNum: pasoNum, fecha: fecha, notas: notas });
      if (r && r.success) {
        if (pasoNum === 6) {
          this._showToast('🎉 ¡Proceso de contratación completado! Paso 6 marcado.', 'success');
        } else {
          this._showToast('✅ Paso ' + pasoNum + ' marcado correctamente', 'success');
        }
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

window.ContratacionComponent = ContratacionComponent;
