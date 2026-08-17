// modules/gestion-humana/vacaciones/index.js
// 📦757 · Vacaciones — Estilo demo Tempoactiva
//
// Layout:
//   - 4 KPIs: Pendientes, Aprobadas, Disfrutadas, Por Notificar a Cliente
//   - Header sección + botones (Listado Mensual, Solicitar Vacaciones)
//   - Tabs: Todas / Solicitada / Aprobada / Rechazada / Disfrutada
//   - Tabla: Trabajador, Cargo, Sede, Fechas, Días, Estado, Cliente, Acciones
//   - Info box "Flujo de Vacaciones" (instrucciones del proceso)
//   - Modal "Solicitar Vacaciones" (trabajador + fechas + días)
//
// Backend: 6 handlers (list/get/create/update/delete/cambiar-estado)

class VacacionesComponent {
  constructor(container, companyName, moduleName, subName, onBack) {
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.subName = subName;
    this.onBack = onBack;
    this.items = [];
    this.trabajadores = [];
    this.sedes = [];
    this._trabajadorById = {};
    this._sedeById = {};
    this.tab = 'todas';
    this.loading = true;
  }

  // ─── Helpers ───
  _toast() { return (window.parent && window.parent.KAIRToast) ? window.parent.KAIRToast : window.KAIRToast; }
  _showToast(msg, type) { var t = this._toast(); if (t) t.show(msg, type || 'info'); }
  _escHtml(s) { if (s == null) return ''; return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  _fmtDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) { return iso; }
  }
  _isoToInputDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toISOString().slice(0, 10); } catch (e) { return ''; }
  }
  _inputDateToIso(s) {
    if (!s) return '';
    try { return new Date(s + 'T12:00:00').toISOString(); } catch (e) { return ''; }
  }
  _diffDias(inicio, fin) {
    if (!inicio || !fin) return null;
    var a = new Date(inicio);
    var b = new Date(fin);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    return Math.round((b - a) / 86400000) + 1;
  }

  // ─── Carga de datos ───
  async _load() {
    if (!window.electronAPI || !this.companyName) { this.loading = false; return; }
    try {
      var results = await Promise.all([
        window.electronAPI.ghListVacaciones({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListPersonal({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListSedes({ companyName: this.companyName }).catch(function () { return { success: false }; })
      ]);
      this.items = (results[0].success && results[0].data) ? (results[0].data.vacaciones || []) : [];
      this.trabajadores = (results[1].success && results[1].data) ? (results[1].data.personales || []) : [];
      this.sedes = (results[2].success && results[2].data) ? (results[2].data.sedes || []) : [];
      this._trabajadorById = {}; this._sedeById = {};
      var self = this;
      this.trabajadores.forEach(function (t) { self._trabajadorById[t.id] = t; });
      this.sedes.forEach(function (s) { self._sedeById[s.id] = s; });
    } catch (e) { this._showToast('Error cargando vacaciones: ' + e.message, 'error'); }
    this.loading = false;
  }

  // ─── Cálculos ───
  _kpis() {
    var self = this;
    return {
      pendientes:   this.items.filter(function (x) { return x.estado === 'solicitada'; }).length,
      aprobadas:    this.items.filter(function (x) { return x.estado === 'aprobada'; }).length,
      disfrutadas:  this.items.filter(function (x) { return x.estado === 'disfrutada'; }).length,
      porNotificar: this.items.filter(function (x) { return x.estado === 'aprobada' && !x.clienteNotificado; }).length
    };
  }
  _countByEstado(id) {
    if (id === 'todas') return this.items.length;
    return this.items.filter(function (x) { return x.estado === id; }).length;
  }
  _filtered() {
    if (this.tab === 'todas') return this.items;
    return this.items.filter(function (x) { return x.estado === this.tab; });
  }

  // ─── Fetch + fallback HTML ───
  async _fetchHtml() {
    try {
      var r = await fetch('modules/gestion-humana/vacaciones/index.html');
      if (r.ok) return await r.text();
    } catch (e) { console.warn('[Vacaciones] fetch HTML falló, usando fallback inline:', e.message); }
    return '<div class="va-wrapper" id="va-wrapper">' +
      '<div class="va-kpi-section"><div id="va-kpi-bar" class="va-kpi-bar"></div></div>' +
      '<div class="va-section-head">' +
        '<div class="va-section-head__text"><h2 class="va-section-head__title">Gestión de Vacaciones</h2>' +
        '<p class="va-section-head__subtitle">Programación, aprobaciones y notificación a clientes</p></div>' +
        '<div class="va-section-head__actions">' +
          '<button id="va-listado-mes" class="va-btn va-btn--ghost" type="button"><i class="fas fa-download"></i> Listado Mensual</button>' +
          '<button id="va-solicitar" class="va-btn va-btn--primary" type="button"><i class="fas fa-plus"></i> Solicitar Vacaciones</button>' +
        '</div>' +
      '</div>' +
      '<div class="va-tabs" id="va-tabs"></div>' +
      '<div id="va-table-wrap" class="va-table-wrap"></div>' +
      '<div class="va-info-box"><div class="va-info-box__icon"><i class="fas fa-info-circle"></i></div>' +
        '<div class="va-info-box__body"><h4 class="va-info-box__title">Flujo de Vacaciones — TEMPOACTIVA</h4>' +
        '<p class="va-info-box__text">Mensualmente (ej: en julio se envían las de agosto), Recursos Humanos genera el listado de personal próximo a salir de vacaciones. Los jefes inmediatos son quienes programan las vacaciones de su personal según la operación. Idealmente, debe notificarse a los clientes cuando un trabajador saldrá de vacaciones para que ellos resuelvan la cobertura.</p>' +
        '<p class="va-info-box__text">Usa el botón <strong>"Listado Mensual"</strong> para exportar el reporte del próximo mes (formato similar al que enviaba Lilimare por correo).</p>' +
        '</div></div>' +
    '</div>';
  }

  // ─── Render principal ───
  async render() {
    var self = this;
    if (!this._html) this._html = await this._fetchHtml();
    this.container.innerHTML = this._html;

    if (this.loading) {
      var kpiBar = this.container.querySelector('#va-kpi-bar');
      if (kpiBar) kpiBar.innerHTML = '<div class="va-loading"><i class="fas fa-spinner fa-spin"></i> Cargando vacaciones…</div>';
      var tw = this.container.querySelector('#va-table-wrap');
      if (tw) tw.innerHTML = '<div class="va-loading"><i class="fas fa-spinner fa-spin"></i> Cargando…</div>';
      await this._load();
    }

    this._renderKpiBar();
    this._renderTabs();
    this._renderTable();

    var btnListado = this.container.querySelector('#va-listado-mes');
    if (btnListado) btnListado.onclick = function () { self._exportListadoMensual(); };
    var btnSolicitar = this.container.querySelector('#va-solicitar');
    if (btnSolicitar) btnSolicitar.onclick = function () { self._openSolicitarModal(); };
  }

  _renderAll() {
    this._renderKpiBar();
    this._renderTabs();
    this._renderTable();
  }

  _renderKpiBar() {
    var bar = this.container.querySelector('#va-kpi-bar');
    if (!bar || !window.GHKPIBar) return;
    var k = this._kpis();
    var kpis = [
      { icon: 'fa-clock',          color: '#a16207', bg: '#fff3cd', value: k.pendientes,   label: 'Pendientes' },
      { icon: 'fa-check',          color: '#28a745', bg: '#d4edda', value: k.aprobadas,    label: 'Aprobadas' },
      { icon: 'fa-umbrella-beach', color: '#0d9488', bg: '#ccfbf1', value: k.disfrutadas,  label: 'Disfrutadas' },
      { icon: 'fa-bell',           color: '#dc3545', bg: '#f8d7da', value: k.porNotificar, label: 'Por Notificar a Cliente' }
    ];
    window.GHKPIBar.render(bar, kpis);
  }

  _renderTabs() {
    var self = this;
    var tabsBar = this.container.querySelector('#va-tabs');
    if (!tabsBar) return;
    var tabs = [
      { id: 'todas',      label: 'Todas' },
      { id: 'solicitada', label: 'Solicitada' },
      { id: 'aprobada',   label: 'Aprobada' },
      { id: 'rechazada',  label: 'Rechazada' },
      { id: 'disfrutada', label: 'Disfrutada' }
    ];
    var html = tabs.map(function (t) {
      var count = self._countByEstado(t.id);
      return '<button class="va-tab ' + (self.tab === t.id ? 'va-tab--active' : '') + '" data-tab="' + t.id + '" type="button">' +
        self._escHtml(t.label) + ' (' + count + ')</button>';
    }).join('');
    tabsBar.innerHTML = html;
    tabsBar.querySelectorAll('.va-tab').forEach(function (b) {
      b.onclick = function () { self.tab = b.getAttribute('data-tab'); self._renderTabs(); self._renderTable(); };
    });
  }

  _renderTable() {
    var self = this;
    var wrap = this.container.querySelector('#va-table-wrap');
    if (!wrap) return;
    var filtered = this._filtered();
    if (filtered.length === 0) {
      wrap.innerHTML = '<div class="va-table-card">' +
        '<table class="va-table"><thead><tr>' +
        '<th>Trabajador</th><th>Cargo</th><th>Sede</th>' +
        '<th>Fecha Inicio</th><th>Fecha Fin</th><th>Días</th>' +
        '<th>Estado</th><th>Cliente</th><th class="va-table th--right">Acciones</th>' +
        '</tr></thead><tbody><tr><td colspan="9" class="va-empty-row">No hay vacaciones en este estado.</td></tr></tbody></table></div>';
      return;
    }
    var rows = filtered.map(function (v) { return self._renderRow(v); }).join('');
    wrap.innerHTML = '<div class="va-table-card">' +
      '<table class="va-table"><thead><tr>' +
      '<th>Trabajador</th><th>Cargo</th><th>Sede</th>' +
      '<th>Fecha Inicio</th><th>Fecha Fin</th><th>Días</th>' +
      '<th>Estado</th><th>Cliente</th><th class="va-table th--right">Acciones</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';

    wrap.querySelectorAll('button[data-accion]').forEach(function (b) {
      b.onclick = function () {
        var accion = b.getAttribute('data-accion');
        var id = b.getAttribute('data-id');
        if (accion === 'aprobar')        self._cambiarEstado(id, 'aprobada');
        else if (accion === 'rechazar')  self._cambiarEstado(id, 'rechazada');
        else if (accion === 'programar') self._programar(id);
        else if (accion === 'notificar') self._notificarCliente(id);
      };
    });
  }

  _renderRow(v) {
    var self = this;
    var t = this._trabajadorById[v.trabajadorId] || {};
    var s = this._sedeById[t.sedeId] || {};

    // Badge de cliente
    var clienteHtml = '';
    if (v.estado === 'aprobada') {
      if (v.clienteNotificado) {
        clienteHtml = '<span class="va-cliente-badge va-cliente-badge--notificado"><i class="fas fa-check"></i> Notificado</span>';
      } else {
        clienteHtml = '<span class="va-cliente-badge va-cliente-badge--pendiente"><i class="fas fa-clock"></i> Pendiente</span>';
      }
    } else {
      clienteHtml = '<span class="va-cliente-badge va-cliente-badge--na">—</span>';
    }

    // Acciones por estado
    var actions = '';
    if (v.estado === 'solicitada') {
      actions += '<button class="va-btn--icon success" data-accion="aprobar" data-id="' + self._escHtml(v.id) + '" title="Aprobar"><i class="fas fa-check"></i></button>';
      actions += '<button class="va-btn--icon danger"  data-accion="rechazar" data-id="' + self._escHtml(v.id) + '" title="Rechazar"><i class="fas fa-times"></i></button>';
    } else if (v.estado === 'aprobada') {
      actions += '<button class="va-btn--icon info"    data-accion="programar" data-id="' + self._escHtml(v.id) + '" title="Programar"><i class="fas fa-calendar-alt"></i></button>';
      if (!v.clienteNotificado) {
        actions += '<button class="va-btn--icon info"    data-accion="notificar" data-id="' + self._escHtml(v.id) + '" title="Notificar al cliente"><i class="fas fa-envelope"></i></button>';
      }
    }

    return '<tr>' +
      '<td>' +
        '<div class="va-table__name">' + self._escHtml((t.nombres || '') + ' ' + (t.apellidos || '')) + '</div>' +
        '<div class="va-table__cargo">' + self._escHtml(t.cedula || '—') + '</div>' +
      '</td>' +
      '<td>' + self._escHtml(t.cargo || '—') + '</td>' +
      '<td>' + self._escHtml(s.nombre || '—') + '</td>' +
      '<td class="va-table__date">' + self._fmtDate(v.fechaInicio) + '</td>' +
      '<td class="va-table__date">' + self._fmtDate(v.fechaFin) + '</td>' +
      '<td class="va-table__date">' + (v.diasSolicitados || '—') + '</td>' +
      '<td><span class="va-badge va-badge--' + v.estado + '">' + self._escHtml(v.estado) + '</span></td>' +
      '<td>' + clienteHtml + '</td>' +
      '<td class="va-table td--right"><div class="va-table__actions">' + actions + '</div></td>' +
    '</tr>';
  }

  // ─── Modal: Solicitar Vacaciones ───
  _openSolicitarModal() {
    var self = this;
    if (this.trabajadores.length === 0) {
      this._showToast('No hay trabajadores registrados. Carga la Base Personal primero.', 'warning');
      return;
    }
    var today = new Date().toISOString().slice(0, 10);
    var choices = this.trabajadores
      .slice()
      .sort(function (a, b) { return ((a.nombres || '') + ' ' + (a.apellidos || '')).localeCompare((b.nombres || '') + ' ' + (b.apellidos || '')); })
      .map(function (t) { return '<option value="' + self._escHtml(t.id) + '">' + self._escHtml((t.nombres || '') + ' ' + (t.apellidos || '') + (t.cedula ? ' · CC ' + t.cedula : '')) + '</option>'; })
      .join('');

    var html =
      '<div class="va-modal-backdrop" id="va-solicitar-backdrop">' +
        '<div class="va-modal" role="dialog" aria-modal="true">' +
          '<div class="va-modal__head">' +
            '<div>' +
              '<h2 class="va-modal__title">Solicitar Vacaciones</h2>' +
              '<p class="va-modal__sub">Inicia un proceso de solicitud. Quedará en estado <strong>Solicitada</strong> hasta que sea aprobada o rechazada.</p>' +
            '</div>' +
            '<button class="va-modal__close" type="button" aria-label="Cerrar">×</button>' +
          '</div>' +
          '<div class="va-modal__body">' +
            '<form id="va-solicitar-form" class="va-form-grid">' +
              '<div class="va-field va-field--full"><label>Trabajador <span class="req">*</span></label>' +
                '<select name="trabajadorId" required><option value="">— Selecciona un trabajador —</option>' + choices + '</select></div>' +
              '<div class="va-field"><label>Fecha Inicio <span class="req">*</span></label><input type="date" name="fechaInicio" required value="' + today + '" /></div>' +
              '<div class="va-field"><label>Fecha Fin <span class="req">*</span></label><input type="date" name="fechaFin" required /></div>' +
              '<div class="va-field"><label>Días hábiles <span class="req">*</span></label><input type="number" name="dias" min="1" required value="8" /></div>' +
              '<div class="va-field"><label>Fecha Solicitud</label><input type="date" name="fechaSolicitud" value="' + today + '" /></div>' +
              '<div class="va-field va-field--full"><label>Observaciones</label><textarea name="notas" rows="2" placeholder="Opcional"></textarea></div>' +
            '</form>' +
          '</div>' +
          '<div class="va-modal__foot">' +
            '<button class="va-btn va-btn--ghost" type="button" data-action="cancel">Cancelar</button>' +
            '<button class="va-btn va-btn--primary" type="button" data-action="submit"><i class="fas fa-paper-plane"></i> Enviar Solicitud</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var backdrop = wrap.firstChild;
    document.body.appendChild(backdrop);

    var close = function () { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };
    backdrop.querySelector('.va-modal__close').onclick = close;
    backdrop.querySelector('[data-action="cancel"]').onclick = close;
    backdrop.onclick = function (e) { if (e.target === backdrop) close(); };

    // Auto-calcular días al cambiar fechas
    var fechaInicioEl = backdrop.querySelector('input[name="fechaInicio"]');
    var fechaFinEl    = backdrop.querySelector('input[name="fechaFin"]');
    var diasEl        = backdrop.querySelector('input[name="dias"]');
    var syncDias = function () {
      var d = self._diffDias(fechaInicioEl.value, fechaFinEl.value);
      if (d && d > 0) diasEl.value = d;
    };
    fechaInicioEl.onchange = syncDias;
    fechaFinEl.onchange    = syncDias;

    backdrop.querySelector('[data-action="submit"]').onclick = function () {
      var form = backdrop.querySelector('#va-solicitar-form');
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var d = self._diffDias(form.fechaInicio.value, form.fechaFin.value);
      if (!d || d <= 0) {
        self._showToast('La fecha de fin debe ser posterior a la fecha de inicio', 'error');
        return;
      }
      var data = {
        trabajadorId:      form.trabajadorId.value,
        fechaSolicitud:    self._inputDateToIso(form.fechaSolicitud.value) || new Date().toISOString(),
        fechaInicio:       self._inputDateToIso(form.fechaInicio.value),
        fechaFin:          self._inputDateToIso(form.fechaFin.value),
        diasSolicitados:   parseInt(form.dias.value, 10) || d,
        notas:             form.notas.value || null,
        estado:            'solicitada',
        notificarCliente:  0
      };
      close();
      self._create(data);
    };
  }

  async _create(data) {
    try {
      var r = await window.electronAPI.ghCreateVacacion({ companyName: this.companyName, data: data });
      if (r && r.success) {
        this._showToast('Solicitud enviada', 'success');
        await this._load();
        this._renderAll();
      } else {
        this._showToast('Error: ' + ((r && r.error && r.error.message) || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  async _cambiarEstado(id, estado) {
    try {
      var r = await window.electronAPI.ghCambiarEstadoVacacion({ vacacionId: id, estado: estado });
      if (r && r.success) {
        this._showToast('Vacación ' + estado, 'success');
        await this._load();
        this._renderAll();
      } else {
        this._showToast('Error: ' + ((r && r.error && r.error.message) || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  async _programar(id) {
    // Programar = marcar como "disfrutada" (salió en esas fechas). Alternativa:
    // cambiar a 'programada' si se quiere representar como paso previo a disfrutada.
    var self = this;
    var ok = window.confirm('¿Marcar esta vacación como programada (lista para el período de inicio)?');
    if (!ok) return;
    try {
      var r = await window.electronAPI.ghCambiarEstadoVacacion({ vacacionId: id, estado: 'programada' });
      if (r && r.success) {
        self._showToast('Vacación programada', 'success');
        await self._load();
        self._renderAll();
      } else {
        self._showToast('Error: ' + ((r && r.error && r.error.message) || 'desconocido'), 'error');
      }
    } catch (e) { self._showToast('Error: ' + e.message, 'error'); }
  }

  async _notificarCliente(id) {
    try {
      var r = await window.electronAPI.ghUpdateVacacion({ vacacionId: id, updates: { clienteNotificado: 1 } });
      if (r && r.success) {
        this._showToast('Cliente notificado', 'success');
        await this._load();
        this._renderAll();
      } else {
        this._showToast('Error: ' + ((r && r.error && r.error.message) || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  _exportListadoMensual() {
    // Generar CSV del mes actual / próximo con vacaciones aprobadas y pendientes
    var rows = [['TRABAJADOR', 'CARGO', 'SEDE', 'FECHA INICIO', 'FECHA FIN', 'DIAS', 'ESTADO', 'CLIENTE NOTIFICADO']];
    var self = this;
    this.items.forEach(function (v) {
      var t = self._trabajadorById[v.trabajadorId] || {};
      var s = self._sedeById[t.sedeId] || {};
      rows.push([
        ((t.nombres || '') + ' ' + (t.apellidos || '')).trim(),
        t.cargo || '',
        s.nombre || '',
        self._isoToInputDate(v.fechaInicio),
        self._isoToInputDate(v.fechaFin),
        v.diasSolicitados || '',
        v.estado,
        v.clienteNotificado ? 'Si' : 'No'
      ]);
    });
    var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url;
    a.download = 'listado-vacaciones-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    this._showToast('Listado exportado', 'success');
  }

  destroy() { /* noop */ }
}

window.VacacionesComponent = VacacionesComponent;
