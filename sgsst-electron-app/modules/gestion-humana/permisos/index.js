// modules/gestion-humana/permisos/index.js
// 📦710 · Permisos y Estados (v0.2.0) — UI completa
//
// KPIs (5): Permisos Activos, Incapacidades, Maternidad, Paternidad, Luto
// Cards con: badge de tipo, badge de estado, fecha inicio/fin, motivo, soporte, botón Finalizar
// Backend: 5 handlers (list, get, create, update, finalizar)

class PermisosComponent {
  constructor(container, companyName, moduleName, subName, onBack) {
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.subName = subName;
    this.onBack = onBack;
    this.items = [];
    this.trabajadores = [];
    this.filtroTipo = 'all';
    this.filtroEstado = 'all';
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

  static get TIPOS() {
    return [
      { value: 'incapacidad',           label: 'Cita Médica / Incapacidad', color: '#be123c', icon: 'fa-stethoscope' },
      { value: 'maternidad',            label: 'Maternidad',                color: '#5b2a86', icon: 'fa-baby' },
      { value: 'paternidad',            label: 'Paternidad',                color: '#174ea6', icon: 'fa-baby' },
      { value: 'luto',                  label: 'Luto',                      color: '#6c757d', icon: 'fa-cross' },
      { value: 'permiso_cita_medica',   label: 'Cita Médica',               color: '#fd7e14', icon: 'fa-stethoscope' },
      { value: 'permiso_personal',      label: 'Personal',                  color: '#0d9488', icon: 'fa-user-clock' },
      { value: 'calamidad',             label: 'Calamidad Doméstica',       color: '#dc3545', icon: 'fa-triangle-exclamation' },
      { value: 'licencia_no_remunerada', label: 'No Remunerada',            color: '#868e96', icon: 'fa-calendar-xmark' }
    ];
  }

  async _load() {
    if (!window.electronAPI || !this.companyName) { this.loading = false; return; }
    try {
      var results = await Promise.all([
        window.electronAPI.ghListPermisos({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListPersonal({ companyName: this.companyName }).catch(function () { return { success: false }; })
      ]);
      this.items        = results[0].success ? (results[0].data.permisos || []) : [];
      this.trabajadores = results[1].success ? (results[1].data.personales || []) : [];
      this._trabajadorById = {};
      this.trabajadores.forEach(function (t) { this._trabajadorById[t.id] = t; }.bind(this));
    } catch (e) {
      this._showToast('Error cargando permisos: ' + e.message, 'error');
    }
    this.loading = false;
  }

  _kpis() {
    var i = this.items;
    var activos = i.filter(function (x) { return x.estado === 'activo'; });
    return {
      activos:        activos.length,
      incapacidades:  activos.filter(function (x) { return x.tipo === 'incapacidad'; }).length,
      maternidad:     activos.filter(function (x) { return x.tipo === 'maternidad'; }).length,
      paternidad:     activos.filter(function (x) { return x.tipo === 'paternidad'; }).length,
      luto:           activos.filter(function (x) { return x.tipo === 'luto'; }).length
    };
  }

  _filtered() {
    var self = this;
    return this.items.filter(function (x) {
      if (self.filtroTipo !== 'all' && x.tipo !== self.filtroTipo) return false;
      if (self.filtroEstado !== 'all' && x.estado !== self.filtroEstado) return false;
      return true;
    });
  }

  _tipoMeta(tipo) {
    return PermisosComponent.TIPOS.find(function (t) { return t.value === tipo; }) || { value: tipo, label: tipo, color: '#5a6378', icon: 'fa-file-medical' };
  }

  render() {
    var self = this;
    this.container.innerHTML = '';
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding:0; height:100%; overflow-y:auto; background:#f8f9fa;';

    if (this.loading) {
      wrapper.innerHTML = '<div style="padding:3rem; text-align:center; color:#5a6378;"><i class="fas fa-spinner fa-spin"></i> Cargando permisos…</div>';
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
        '<h2 style="margin:0; font-size:1.05rem; color:#1a1a2e;">Permisos y Estados del Trabajador</h2>' +
        '<p style="margin:0.125rem 0 0; font-size:0.75rem; color:#5a6378;">Incapacidades, maternidad, paternidad, luto y permisos diversos</p>' +
      '</div>' +
      '<button id="perm-nuevo" style="background:#174ea6; color:white; border:none; padding:0.5rem 0.875rem; border-radius:0.4rem; cursor:pointer; font-size:0.8125rem; font-weight:500; display:inline-flex; align-items:center; gap:0.4rem;">' +
        '<i class="fas fa-plus"></i> Registrar Permiso / Estado' +
      '</button>';
    wrapper.appendChild(head);

    // Filtros
    var filtros = document.createElement('div');
    filtros.style.cssText = 'padding:0.75rem 1.5rem; background:white; border-bottom:1px solid #e9ecef; display:flex; gap:0.5rem; flex-wrap:wrap;';
    filtros.innerHTML =
      '<select id="perm-filtro-tipo" style="padding:0.4rem 0.625rem; border:1px solid #dee2e6; border-radius:0.375rem; font-size:0.8125rem; background:white; color:#1a1a2e;">' +
        '<option value="all">Todos los tipos</option>' +
        PermisosComponent.TIPOS.map(function (t) { return '<option value="' + t.value + '"' + (self.filtroTipo === t.value ? ' selected' : '') + '>' + t.label + '</option>'; }).join('') +
      '</select>' +
      '<select id="perm-filtro-estado" style="padding:0.4rem 0.625rem; border:1px solid #dee2e6; border-radius:0.375rem; font-size:0.8125rem; background:white; color:#1a1a2e;">' +
        '<option value="all">Todos los estados</option>' +
        '<option value="activo"' + (self.filtroEstado === 'activo' ? ' selected' : '') + '>Activo</option>' +
        '<option value="finalizado"' + (self.filtroEstado === 'finalizado' ? ' selected' : '') + '>Finalizado</option>' +
        '<option value="prorrogado"' + (self.filtroEstado === 'prorrogado' ? ' selected' : '') + '>Prorrogado</option>' +
      '</select>';
    wrapper.appendChild(filtros);

    // Cards grid
    wrapper.appendChild(this._renderCardsGrid());

    this.container.appendChild(wrapper);

    // Wire actions
    var btnNuevo = document.getElementById('perm-nuevo');
    if (btnNuevo) btnNuevo.onclick = function () { self._showNuevoDialog(); };
    var selTipo = document.getElementById('perm-filtro-tipo');
    if (selTipo) selTipo.onchange = function (e) { self.filtroTipo = e.target.value; self.render(); };
    var selEstado = document.getElementById('perm-filtro-estado');
    if (selEstado) selEstado.onchange = function (e) { self.filtroEstado = e.target.value; self.render(); };
  }

  _renderKpiStrip(k) {
    var bar = document.createElement('div');
    bar.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:0; background:white; border-bottom:1px solid #e9ecef;';
    var items = [
      { value: k.activos,        label: 'PERMISOS ACTIVOS', color: '#174ea6' },
      { value: k.incapacidades,  label: 'INCAPACIDADES',    color: '#be123c' },
      { value: k.maternidad,     label: 'MATERNIDAD',       color: '#5b2a86' },
      { value: k.paternidad,     label: 'PATERNIDAD',       color: '#174ea6' },
      { value: k.luto,           label: 'LUTO',             color: '#6c757d' }
    ];
    items.forEach(function (i, idx) {
      bar.innerHTML +=
        '<div style="padding:1rem 1.25rem; display:flex; align-items:center; gap:0.625rem; ' + (idx > 0 ? 'border-left:1px solid #e9ecef;' : '') + '">' +
          '<div style="width:36px; height:36px; border-radius:50%; background:' + i.color + '22; color:' + i.color + '; display:flex; align-items:center; justify-content:center;">' +
            '<i class="fas fa-' + (idx === 0 ? 'file-medical' : idx === 1 ? 'stethoscope' : idx === 2 ? 'baby' : idx === 3 ? 'baby-carriage' : 'cross') + '"></i>' +
          '</div>' +
          '<div>' +
            '<div style="font-size:1.5rem; font-weight:700; color:#1a1a2e; line-height:1;">' + i.value + '</div>' +
            '<div style="font-size:0.65rem; color:#5a6378; letter-spacing:0.4px; margin-top:0.2rem;">' + i.label + '</div>' +
          '</div>' +
        '</div>';
    });
    return bar;
  }

  _renderCardsGrid() {
    var self = this;
    var wrap = document.createElement('div');
    wrap.style.cssText = 'padding:1rem 1.5rem 1.5rem;';
    var filtered = this._filtered();
    if (filtered.length === 0) {
      wrap.innerHTML = '<div style="background:white; border:1px solid #e9ecef; border-radius:0.5rem; padding:2rem; text-align:center; color:#5a6378;">No hay permisos con esos filtros. Haz clic en "Registrar Permiso / Estado" para agregar el primero.</div>';
      return wrap;
    }
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:0.875rem;';
    filtered.forEach(function (p) {
      var t = self._trabajadorById[p.trabajadorId];
      var tm = self._tipoMeta(p.tipo);
      var card = document.createElement('div');
      card.style.cssText = 'background:white; border:1px solid #e9ecef; border-radius:0.5rem; padding:1rem 1.125rem; transition:box-shadow 0.2s;';
      card.onmouseenter = function () { card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; };
      card.onmouseleave = function () { card.style.boxShadow = ''; };
      var estadoColor = p.estado === 'activo' ? '#28a745' : p.estado === 'finalizado' ? '#5a6378' : '#fd7e14';
      var estadoBg    = p.estado === 'activo' ? '#d4edda' : p.estado === 'finalizado' ? '#e9ecef' : '#fff3cd';
      card.innerHTML =
        '<div style="display:flex; align-items:flex-start; gap:0.625rem; margin-bottom:0.625rem;">' +
          '<div style="width:32px; height:32px; border-radius:0.4rem; background:' + tm.color + '22; color:' + tm.color + '; display:flex; align-items:center; justify-content:center; flex-shrink:0;">' +
            '<i class="fas ' + tm.icon + '"></i>' +
          '</div>' +
          '<div style="flex:1; min-width:0;">' +
            '<div style="font-size:0.9rem; font-weight:600; color:#1a1a2e;">' + tm.label + '</div>' +
            '<div style="font-size:0.7rem; color:#5a6378;">' + (t ? (t.nombres + ' ' + t.apellidos) : '—') + (t && t.cargo ? ' · ' + t.cargo : '') + '</div>' +
          '</div>' +
          '<span style="background:' + estadoBg + '; color:' + estadoColor + '; padding:0.15rem 0.5rem; border-radius:0.875rem; font-size:0.65rem; font-weight:600; text-transform:capitalize;">' + p.estado + '</span>' +
        '</div>' +
        '<div style="border-top:1px solid #f1f3f5; padding-top:0.625rem; font-size:0.8rem; color:#1a1a2e;">' +
          this._renderCardRows(p) +
        '</div>' +
        (p.estado === 'activo' ? '<div style="margin-top:0.625rem;"><button data-finalizar="' + p.id + '" style="width:100%; background:white; color:#174ea6; border:1px solid #174ea6; padding:0.4rem 0.625rem; border-radius:0.4rem; cursor:pointer; font-size:0.8rem; font-weight:500;"><i class="fas fa-check"></i> Finalizar Permiso</button></div>' : '');
      grid.appendChild(card);
    }.bind(this));
    // Wire finalizar buttons
    setTimeout(function () {
      self.container.querySelectorAll('button[data-finalizar]').forEach(function (b) {
        b.onclick = function () { self._finalizar(b.getAttribute('data-finalizar')); };
      });
    }, 0);
    wrap.appendChild(grid);
    return wrap;
  }

  _renderCardRows(p) {
    var rows = '';
    rows += '<div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;"><span style="color:#5a6378;">Fecha inicio:</span><span style="font-weight:500;">' + (p.fechaInicio || '—') + '</span></div>';
    if (p.fechaFin) rows += '<div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;"><span style="color:#5a6378;">Fecha fin:</span><span style="font-weight:500;">' + p.fechaFin + '</span></div>';
    if (p.dias) rows += '<div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;"><span style="color:#5a6378;">Días:</span><span style="font-weight:500;">' + this._fmt(p.dias) + '</span></div>';
    if (p.motivo) rows += '<div style="margin-top:0.375rem;"><div style="color:#5a6378; font-size:0.7rem;">Motivo:</div><div style="font-size:0.8rem;">' + p.motivo + '</div></div>';
    if (p.soporteUrl) rows += '<div style="margin-top:0.375rem; font-size:0.7rem; color:#5a6378;">Soporte: <a href="' + p.soporteUrl + '" target="_blank" style="color:#174ea6;">documento cargado</a></div>';
    return rows;
  }

  async _finalizar(id) {
    try {
      var r = await window.electronAPI.ghFinalizarPermiso({ permisoId: id, fechaFin: new Date().toISOString().split('T')[0] });
      if (r && r.success) {
        this._showToast('Permiso finalizado', 'success');
        await this._load(); this.render();
      } else {
        this._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  async _showNuevoDialog() {
    var self = this;
    if (this.trabajadores.length === 0) {
      this._showToast('No hay trabajadores registrados. Agrega uno en Base de Personal primero.', 'warning');
      return;
    }
    var choices = this.trabajadores.map(function (t) {
      return { value: t.id, label: (t.nombres + ' ' + t.apellidos + ' — ' + (t.cargo || '—') + ' (' + t.cedula + ')') };
    });
    var data = await this._confirmDialog().input({
      title: 'Registrar Permiso / Estado',
      fields: [
        { name: 'trabajadorId', label: 'Trabajador', type: 'select', required: true, options: choices },
        { name: 'tipo', label: 'Tipo de permiso', type: 'select', required: true,
          options: PermisosComponent.TIPOS.map(function (t) { return { value: t.value, label: t.label }; })
        },
        { name: 'fechaInicio', label: 'Fecha inicio', type: 'date', required: true },
        { name: 'fechaFin', label: 'Fecha fin (opcional si aún no termina)', type: 'date', required: false },
        { name: 'dias', label: 'Días (estimado)', type: 'number', required: false, default: 1 },
        { name: 'motivo', label: 'Motivo', type: 'textarea', required: false },
        { name: 'soporteUrl', label: 'URL soporte (opcional)', type: 'text', required: false },
        { name: 'notas', label: 'Notas', type: 'textarea', required: false }
      ]
    });
    if (!data) return;
    try {
      var r = await window.electronAPI.ghCreatePermiso({
        companyName: this.companyName,
        data: {
          trabajadorId: data.trabajadorId,
          tipo: data.tipo,
          fechaInicio: data.fechaInicio,
          fechaFin: data.fechaFin || null,
          dias: data.dias ? parseInt(data.dias, 10) : null,
          motivo: data.motivo || null,
          soporteUrl: data.soporteUrl || null,
          notas: data.notas || null
        }
      });
      if (r && r.success) {
        this._showToast('Permiso registrado', 'success');
        await this._load(); this.render();
      } else {
        this._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  destroy() { /* noop */ }
}

window.PermisosComponent = PermisosComponent;
