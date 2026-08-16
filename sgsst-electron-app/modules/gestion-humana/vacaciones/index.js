// modules/gestion-humana/vacaciones/index.js
// 📦710 · Vacaciones (v0.2.0) — UI completa
//
// KPIs (4): Pendientes, Aprobadas, Disfrutadas, Por Notificar
// Tabs: Todas | Solicitada | Aprobada | Rechazada | Disfrutada
// Acciones inline: Aprobar, Rechazar, Notificar cliente
// Backend: 6 handlers (list, get, create, update, delete, cambiar-estado)

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
    this.tab = 'todas';
    this.loading = true;
  }

  _fmt(n) {
    if (n == null) return '—';
    return new Intl.NumberFormat('es-CO').format(n);
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

  async _load() {
    if (!window.electronAPI || !this.companyName) { this.loading = false; return; }
    try {
      var results = await Promise.all([
        window.electronAPI.ghListVacaciones({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListPersonal({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListSedes({ companyName: this.companyName }).catch(function () { return { success: false }; })
      ]);
      this.items        = results[0].success ? (results[0].data.vacaciones || []) : [];
      this.trabajadores = results[1].success ? (results[1].data.personales || []) : [];
      this.sedes        = results[2].success ? (results[2].data.sedes || []) : [];
      // Index helpers
      this._trabajadorById = {};
      this.trabajadores.forEach(function (t) { this._trabajadorById[t.id] = t; }.bind(this));
      this._sedeById = {};
      this.sedes.forEach(function (s) { this._sedeById[s.id] = s; }.bind(this));
    } catch (e) {
      this._showToast('Error cargando vacaciones: ' + e.message, 'error');
    }
    this.loading = false;
  }

  _kpis() {
    var i = this.items;
    return {
      pendientes:   i.filter(function (x) { return x.estado === 'solicitada'; }).length,
      aprobadas:    i.filter(function (x) { return x.estado === 'aprobada'; }).length,
      disfrutadas:  i.filter(function (x) { return x.estado === 'disfrutada'; }).length,
      porNotificar: i.filter(function (x) { return x.estado === 'aprobada' && !x.clienteNotificado; }).length
    };
  }

  _trabajador(id) { return this._trabajadorById && this._trabajadorById[id]; }

  _filtered() {
    if (this.tab === 'todas') return this.items;
    return this.items.filter(function (x) { return x.estado === this.tab; }.bind(this));
  }

  render() {
    var self = this;
    this.container.innerHTML = '';
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding:0; height:100%; overflow-y:auto; background:#f8f9fa;';

    if (this.loading) {
      wrapper.innerHTML = '<div style="padding:3rem; text-align:center; color:#5a6378;"><i class="fas fa-spinner fa-spin"></i> Cargando vacaciones…</div>';
      this.container.appendChild(wrapper);
      this._load().then(function () { self.render(); });
      return;
    }

    var k = this._kpis();

    // KPIs strip
    wrapper.appendChild(this._renderKpiStrip(k));

    // Header acciones
    var head = document.createElement('div');
    head.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem 1.5rem; background:white; border-bottom:1px solid #e9ecef; flex-wrap:wrap;';
    head.innerHTML =
      '<div>' +
        '<h2 style="margin:0; font-size:1.05rem; color:#1a1a2e;">Gestión de Vacaciones</h2>' +
        '<p style="margin:0.125rem 0 0; font-size:0.75rem; color:#5a6378;">Programación, aprobaciones y notificación a clientes</p>' +
      '</div>' +
      '<div style="display:flex; gap:0.5rem;">' +
        '<button id="vac-listado-mes" style="background:white; color:#174ea6; border:1px solid #174ea6; padding:0.5rem 0.875rem; border-radius:0.4rem; cursor:pointer; font-size:0.8125rem; font-weight:500; display:inline-flex; align-items:center; gap:0.4rem;">' +
          '<i class="fas fa-download"></i> Listado Mensual' +
        '</button>' +
        '<button id="vac-solicitar" style="background:#174ea6; color:white; border:none; padding:0.5rem 0.875rem; border-radius:0.4rem; cursor:pointer; font-size:0.8125rem; font-weight:500; display:inline-flex; align-items:center; gap:0.4rem;">' +
          '<i class="fas fa-plus"></i> Solicitar Vacaciones' +
        '</button>' +
      '</div>';
    wrapper.appendChild(head);

    // Tabs
    wrapper.appendChild(this._renderTabs());

    // Tabla
    wrapper.appendChild(this._renderTable());

    // Flujo card
    wrapper.appendChild(this._renderFlujoCard());

    this.container.appendChild(wrapper);

    // Wire actions
    var btnListado = document.getElementById('vac-listado-mes');
    if (btnListado) btnListado.onclick = function () { self._exportListadoMensual(); };
    var btnSolicitar = document.getElementById('vac-solicitar');
    if (btnSolicitar) btnSolicitar.onclick = function () { self._showSolicitarDialog(); };
  }

  _renderKpiStrip(k) {
    var bar = document.createElement('div');
    bar.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0; background:white; border-bottom:1px solid #e9ecef;';
    var items = [
      { value: k.pendientes,   label: 'PENDIENTES',      color: '#ffc107' },
      { value: k.aprobadas,    label: 'APROBADAS',       color: '#28a745' },
      { value: k.disfrutadas,  label: 'DISFRUTADAS',     color: '#0d9488' },
      { value: k.porNotificar, label: 'POR NOTIFICAR A CLIENTE', color: '#dc3545' }
    ];
    items.forEach(function (i, idx) {
      bar.innerHTML +=
        '<div style="padding:1rem 1.25rem; display:flex; align-items:center; gap:0.625rem; ' + (idx > 0 ? 'border-left:1px solid #e9ecef;' : '') + '">' +
          '<div style="width:36px; height:36px; border-radius:50%; background:' + i.color + '22; color:' + i.color + '; display:flex; align-items:center; justify-content:center; font-size:0.95rem; font-weight:700;">' +
            '<i class="fas fa-' + (idx === 0 ? 'clock' : idx === 1 ? 'check' : idx === 2 ? 'umbrella-beach' : 'bell') + '"></i>' +
          '</div>' +
          '<div>' +
            '<div style="font-size:1.5rem; font-weight:700; color:#1a1a2e; line-height:1;">' + i.value + '</div>' +
            '<div style="font-size:0.65rem; color:#5a6378; letter-spacing:0.4px; margin-top:0.2rem;">' + i.label + '</div>' +
          '</div>' +
        '</div>';
    });
    return bar;
  }

  _renderTabs() {
    var self = this;
    var tabsBar = document.createElement('div');
    tabsBar.style.cssText = 'padding:0.75rem 1.5rem 0; background:white; border-bottom:1px solid #e9ecef; display:flex; gap:0.25rem; overflow-x:auto;';
    var tabs = [
      { id: 'todas',       label: 'Todas' },
      { id: 'solicitada',  label: 'Solicitada' },
      { id: 'aprobada',    label: 'Aprobada' },
      { id: 'rechazada',   label: 'Rechazada' },
      { id: 'disfrutada',  label: 'Disfrutada' }
    ];
    var count = function (id) {
      return id === 'todas' ? self.items.length : self.items.filter(function (x) { return x.estado === id; }).length;
    };
    tabs.forEach(function (t) {
      var active = self.tab === t.id;
      var b = document.createElement('button');
      b.style.cssText = 'background:' + (active ? '#174ea6' : 'transparent') + '; color:' + (active ? 'white' : '#5a6378') + '; border:none; padding:0.5rem 0.875rem; border-radius:0.4rem; cursor:pointer; font-size:0.8125rem; font-weight:' + (active ? '600' : '500') + '; white-space:nowrap;';
      b.innerHTML = t.label + ' (' + count(t.id) + ')';
      b.onclick = function () { self.tab = t.id; self.render(); };
      tabsBar.appendChild(b);
    });
    return tabsBar;
  }

  _renderTable() {
    var self = this;
    var wrap = document.createElement('div');
    wrap.style.cssText = 'padding:0 1.5rem 1rem; background:#f8f9fa;';
    var card = document.createElement('div');
    card.style.cssText = 'background:white; border:1px solid #e9ecef; border-radius:0.5rem; overflow:hidden; margin-top:1rem;';
    var filtered = this._filtered();
    if (filtered.length === 0) {
      card.innerHTML = '<div style="padding:2rem; text-align:center; color:#5a6378;">No hay vacaciones en este estado aún.</div>';
      wrap.appendChild(card);
      return wrap;
    }
    var table = document.createElement('table');
    table.style.cssText = 'width:100%; border-collapse:collapse; font-size:0.8125rem;';
    table.innerHTML =
      '<thead>' +
        '<tr style="background:#f8f9fa; color:#5a6378; text-transform:uppercase; font-size:0.65rem; letter-spacing:0.4px;">' +
          '<th style="text-align:left; padding:0.75rem 1rem;">Trabajador</th>' +
          '<th style="text-align:left; padding:0.75rem 1rem;">Cargo</th>' +
          '<th style="text-align:left; padding:0.75rem 1rem;">Sede</th>' +
          '<th style="text-align:left; padding:0.75rem 1rem;">Inicio</th>' +
          '<th style="text-align:left; padding:0.75rem 1rem;">Fin</th>' +
          '<th style="text-align:right; padding:0.75rem 1rem;">Días</th>' +
          '<th style="text-align:center; padding:0.75rem 1rem;">Estado</th>' +
          '<th style="text-align:center; padding:0.75rem 1rem;">Cliente</th>' +
          '<th style="text-align:right; padding:0.75rem 1rem;">Acciones</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody></tbody>';
    var tbody = table.querySelector('tbody');
    filtered.forEach(function (v) {
      var t = self._trabajador(v.trabajadorId);
      var s = t && t.sedeId ? self._sedeById[t.sedeId] : null;
      var tr = document.createElement('tr');
      tr.style.cssText = 'border-top:1px solid #f1f3f5;';
      var estadoBadge = self._estadoBadge(v.estado);
      var clienteBadge = v.clienteNotificado
        ? '<span style="background:#d4edda; color:#155724; padding:0.2rem 0.5rem; border-radius:0.875rem; font-size:0.65rem; font-weight:600;">Notificado</span>'
        : (v.estado === 'aprobada' ? '<span style="background:#fff3cd; color:#856404; padding:0.2rem 0.5rem; border-radius:0.875rem; font-size:0.65rem; font-weight:600;">Pendiente</span>' : '<span style="color:#9ca3af; font-size:0.7rem;">—</span>');
      var acciones = self._renderAcciones(v);
      tr.innerHTML =
        '<td style="padding:0.75rem 1rem;">' +
          '<div style="font-weight:600; color:#1a1a2e;">' + (t ? (t.nombres + ' ' + t.apellidos) : '—') + '</div>' +
          (t && t.cedula ? '<div style="font-size:0.7rem; color:#5a6378;">CC ' + t.cedula + '</div>' : '') +
        '</td>' +
        '<td style="padding:0.75rem 1rem;">' + (t ? (t.cargo || '—') : '—') + '</td>' +
        '<td style="padding:0.75rem 1rem;">' + (s ? s.nombre : '—') + '</td>' +
        '<td style="padding:0.75rem 1rem; white-space:nowrap;">' + (v.fechaInicio || '—') + '</td>' +
        '<td style="padding:0.75rem 1rem; white-space:nowrap;">' + (v.fechaFin || '—') + '</td>' +
        '<td style="padding:0.75rem 1rem; text-align:right; font-weight:600;">' + self._fmt(v.diasSolicitados) + '</td>' +
        '<td style="padding:0.75rem 1rem; text-align:center;">' + estadoBadge + '</td>' +
        '<td style="padding:0.75rem 1rem; text-align:center;">' + clienteBadge + '</td>' +
        '<td style="padding:0.75rem 1rem; text-align:right;">' + acciones + '</td>';
      tbody.appendChild(tr);
    });
    card.appendChild(table);
    wrap.appendChild(card);
    return wrap;
  }

  _estadoBadge(estado) {
    var colors = {
      'solicitada':  { bg: '#fff3cd', fg: '#856404', label: 'Solicitada' },
      'aprobada':    { bg: '#cce5ff', fg: '#004085', label: 'Aprobada' },
      'rechazada':   { bg: '#f8d7da', fg: '#721c24', label: 'Rechazada' },
      'programada':  { bg: '#d1ecf1', fg: '#0c5460', label: 'Programada' },
      'disfrutada':  { bg: '#d4edda', fg: '#155724', label: 'Disfrutada' }
    };
    var c = colors[estado] || { bg: '#e9ecef', fg: '#5a6378', label: estado };
    return '<span style="background:' + c.bg + '; color:' + c.fg + '; padding:0.2rem 0.625rem; border-radius:0.875rem; font-size:0.7rem; font-weight:600;">' + c.label + '</span>';
  }

  _renderAcciones(v) {
    var self = this;
    var btns = '';
    if (v.estado === 'solicitada') {
      btns += '<button data-act="aprobar" data-id="' + v.id + '" style="background:transparent; border:none; color:#28a745; cursor:pointer; padding:0.25rem 0.4rem; font-size:0.9rem;" title="Aprobar"><i class="fas fa-check"></i></button>';
      btns += '<button data-act="rechazar" data-id="' + v.id + '" style="background:transparent; border:none; color:#dc3545; cursor:pointer; padding:0.25rem 0.4rem; font-size:0.9rem;" title="Rechazar"><i class="fas fa-times"></i></button>';
    }
    if (v.estado === 'aprobada' && !v.clienteNotificado) {
      btns += '<button data-act="notificar" data-id="' + v.id + '" style="background:transparent; border:none; color:#0d9488; cursor:pointer; padding:0.25rem 0.4rem; font-size:0.9rem;" title="Marcar cliente notificado"><i class="fas fa-bell"></i></button>';
    }
    if (v.estado === 'solicitada' || v.estado === 'aprobada') {
      btns += '<button data-act="cancelar" data-id="' + v.id + '" style="background:transparent; border:none; color:#6c757d; cursor:pointer; padding:0.25rem 0.4rem; font-size:0.9rem;" title="Cancelar"><i class="fas fa-ban"></i></button>';
    }
    setTimeout(function () {
      var card = self.container;
      card.querySelectorAll('button[data-act]').forEach(function (b) {
        b.onclick = function () {
          var act = b.getAttribute('data-act');
          var id = b.getAttribute('data-id');
          if (act === 'aprobar') self._cambiarEstado(id, 'aprobada');
          if (act === 'rechazar') self._cambiarEstado(id, 'rechazada');
          if (act === 'notificar') self._notificarCliente(id);
          if (act === 'cancelar') self._cancelar(id);
        };
      });
    }, 0);
    return btns || '<span style="color:#9ca3af;">—</span>';
  }

  _renderFlujoCard() {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'padding:0.5rem 1.5rem 1.5rem;';
    var card = document.createElement('div');
    card.style.cssText = 'background:#fff8e1; border:1px solid #ffe082; border-radius:0.5rem; padding:1rem 1.25rem; display:flex; gap:0.875rem; align-items:flex-start;';
    card.innerHTML =
      '<div style="color:#a16207; font-size:1.1rem;"><i class="fas fa-info-circle"></i></div>' +
      '<div>' +
        '<div style="font-weight:600; color:#1a1a2e; font-size:0.9rem; margin-bottom:0.25rem;">Flujo de Vacaciones — TEMPOACTIVA</div>' +
        '<p style="margin:0; font-size:0.8rem; color:#5a6378; line-height:1.5;">' +
          'Mensualmente (ej: en julio se envían las de agosto), Recursos Humanos genera el listado de personal próximo a salir de vacaciones. Los jefes inmediatos (como Cabo Roberto en Turipaná) son quienes programan las vacaciones de su personal según la operación. Idealmente, debe notificarse a los clientes cuando un trabajador se va de vacaciones para que ellos reevalúen la cobertura.' +
        '</p>' +
      '</div>';
    wrap.appendChild(card);
    return wrap;
  }

  // === ACTIONS ===
  async _cambiarEstado(id, nuevoEstado) {
    try {
      var payload = { contratacionId: null, vacacionId: id, nuevoEstado: nuevoEstado };
      if (nuevoEstado === 'aprobada') {
        payload.aprobadoPor = (window.currentUser && window.currentUser.nombre) || 'Recursos Humanos';
        payload.fechaAprobacion = new Date().toISOString().split('T')[0];
      }
      var r = await window.electronAPI.ghCambiarEstadoVacacion(payload);
      if (r && r.success) {
        this._showToast('Vacación ' + nuevoEstado + ' correctamente', 'success');
        await this._load(); this.render();
      } else {
        this._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
      }
    } catch (e) {
      this._showToast('Error: ' + e.message, 'error');
    }
  }

  async _notificarCliente(id) {
    try {
      var r = await window.electronAPI.ghUpdateVacacion({ vacacionId: id, updates: { clienteNotificado: 1 } });
      if (r && r.success) {
        this._showToast('Cliente notificado', 'success');
        await this._load(); this.render();
      } else {
        this._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  async _cancelar(id) {
    var ok = await this._confirmDialog().confirm('¿Cancelar esta solicitud de vacaciones? El estado cambiará a cancelado.', { title: 'Cancelar vacaciones', okText: 'Sí, cancelar', okType: 'danger' });
    if (!ok) return;
    try {
      var r = await window.electronAPI.ghDeleteVacacion({ vacacionId: id });
      if (r && r.success) {
        this._showToast('Vacación cancelada', 'success');
        await this._load(); this.render();
      } else {
        this._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  async _showSolicitarDialog() {
    var self = this;
    if (this.trabajadores.length === 0) {
      this._showToast('No hay trabajadores registrados. Agrega uno en Base de Personal primero.', 'warning');
      return;
    }
    var choices = this.trabajadores.map(function (t) {
      return { value: t.id, label: (t.nombres + ' ' + t.apellidos + ' — ' + (t.cargo || '—') + ' (' + t.cedula + ')') };
    });
    var data = await this._confirmDialog().input({
      title: 'Solicitar Vacaciones',
      fields: [
        { name: 'trabajadorId', label: 'Trabajador', type: 'select', required: true, options: choices },
        { name: 'fechaInicio', label: 'Fecha inicio', type: 'date', required: true },
        { name: 'fechaFin', label: 'Fecha fin', type: 'date', required: true },
        { name: 'diasSolicitados', label: 'Días solicitados', type: 'number', required: true, default: 8 },
        { name: 'diasPendientes', label: 'Días pendientes (opcional)', type: 'number', required: false },
        { name: 'notificarCliente', label: '¿Notificar al cliente cuando se apruebe?', type: 'checkbox', required: false, default: true },
        { name: 'notas', label: 'Notas', type: 'textarea', required: false }
      ]
    });
    if (!data) return;
    try {
      var r = await window.electronAPI.ghCreateVacacion({
        companyName: this.companyName,
        data: {
          trabajadorId: data.trabajadorId,
          fechaSolicitud: new Date().toISOString().split('T')[0],
          fechaInicio: data.fechaInicio,
          fechaFin: data.fechaFin,
          diasSolicitados: parseInt(data.diasSolicitados, 10),
          diasPendientes: data.diasPendientes ? parseInt(data.diasPendientes, 10) : null,
          notificarCliente: data.notificarCliente ? 1 : 0,
          notas: data.notas || null
        }
      });
      if (r && r.success) {
        this._showToast('Vacación solicitada', 'success');
        await this._load(); this.render();
      } else {
        this._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  _exportListadoMensual() {
    var mes = new Date();
    mes.setMonth(mes.getMonth() + 1);
    var mesLabel = mes.toLocaleString('es-CO', { month: 'long', year: 'numeric' }).toUpperCase();
    var proximas = this.items.filter(function (v) {
      var f = new Date(v.fechaInicio);
      return f.getMonth() === mes.getMonth() && f.getFullYear() === mes.getFullYear();
    });
    var lines = ['LISTADO DE VACACIONES — ' + mesLabel, this.companyName.toUpperCase(), '========================================', ''];
    if (proximas.length === 0) {
      lines.push('No hay vacaciones programadas para el próximo mes.');
    } else {
      proximas.forEach(function (v) {
        var t = this._trabajador(v.trabajadorId);
        lines.push((t ? (t.nombres + ' ' + t.apellidos) : '—') + ' — ' + (t ? t.cargo : '—') + ' — ' + v.fechaInicio + ' al ' + v.fechaFin + ' (' + v.diasSolicitados + ' días) — ' + v.estado);
      }.bind(this));
    }
    var blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'vacaciones_' + mes.getFullYear() + '_' + String(mes.getMonth() + 1).padStart(2, '0') + '.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this._showToast('Listado generado', 'success');
  }

  destroy() { /* noop */ }
}

window.VacacionesComponent = VacacionesComponent;
