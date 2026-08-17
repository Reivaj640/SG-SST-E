// modules/gestion-humana/permisos/index.js
// 📦758 · Permisos y Estados — Estilo demo Tempoactiva
//
// Layout:
//   - 5 KPIs: Permisos Activos, Incapacidades, Maternidad, Paternidad, Luto
//   - Header sección + botón "Registrar Permiso / Estado"
//   - 2 filtros dropdown (tipo + estado)
//   - Grid 3 cols de cards con header (icono+título+badge) + persona + fechas
//   - Info box "Tipos de Permisos y Licencias" con 8 cards (descripción)
//   - Modal "Registrar Permiso" (trabajador + tipo + fechas + motivo + soporte + notas)
//
// Backend: 5 handlers (list/get/create/update/finalizar)

class PermisosComponent {
  constructor(container, companyName, moduleName, subName, onBack) {
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.subName = subName;
    this.onBack = onBack;
    this.items = [];
    this.trabajadores = [];
    this._trabajadorById = {};
    this.filtroTipo = 'all';
    this.filtroEstado = 'all';
    this.loading = true;
  }

  // ─── Catálogo de tipos con metadata visual + descripciones para el info box ───
  static get TIPOS() {
    return [
      { value: 'cita_medica',            label: 'Cita Médica',          color: '#fd7e14', icon: 'fa-stethoscope',
        desc: 'Permiso para cita médica' },
      { value: 'permiso_personal',       label: 'Personal',             color: '#0d9488', icon: 'fa-user-clock',
        desc: 'Permiso personal remunerado' },
      { value: 'paternidad',             label: 'Paternidad',           color: '#174ea6', icon: 'fa-baby',
        desc: 'Licencia 14 días paternidad' },
      { value: 'maternidad',             label: 'Maternidad',           color: '#5b2a86', icon: 'fa-baby-carriage',
        desc: 'Licencia 126 días (pre y postnatal)' },
      { value: 'incapacidad',            label: 'Incapacidad',          color: '#be123c', icon: 'fa-notes-medical',
        desc: 'EPS certifica incapacidad médica' },
      { value: 'luto',                   label: 'Luto',                 color: '#6c757d', icon: 'fa-cross',
        desc: '5 días por fallecimiento familiar' },
      { value: 'calamidad',              label: 'Calamidad Doméstica',  color: '#dc3545', icon: 'fa-triangle-exclamation',
        desc: 'Calamidad doméstica comprobada' },
      { value: 'licencia_no_remunerada', label: 'No Remunerada',        color: '#868e96', icon: 'fa-calendar-xmark',
        desc: 'Licencia sin goce de salario' }
    ];
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

  // ─── Carga ───
  async _load() {
    if (!window.electronAPI || !this.companyName) { this.loading = false; return; }
    try {
      var results = await Promise.all([
        window.electronAPI.ghListPermisos({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListPersonal({ companyName: this.companyName }).catch(function () { return { success: false }; })
      ]);
      this.items = (results[0].success && results[0].data) ? (results[0].data.permisos || []) : [];
      this.trabajadores = (results[1].success && results[1].data) ? (results[1].data.personales || []) : [];
      this._trabajadorById = {};
      var self = this;
      this.trabajadores.forEach(function (t) { self._trabajadorById[t.id] = t; });
    } catch (e) { this._showToast('Error cargando permisos: ' + e.message, 'error'); }
    this.loading = false;
  }

  // ─── Cálculos ───
  _kpis() {
    var self = this;
    var activos = this.items.filter(function (x) { return x.estado === 'activo'; });
    return {
      activos:       activos.length,
      incapacidades: activos.filter(function (x) { return x.tipo === 'incapacidad'; }).length,
      maternidad:    activos.filter(function (x) { return x.tipo === 'maternidad'; }).length,
      paternidad:    activos.filter(function (x) { return x.tipo === 'paternidad'; }).length,
      luto:          activos.filter(function (x) { return x.tipo === 'luto'; }).length
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
    return PermisosComponent.TIPOS.find(function (t) { return t.value === tipo; }) || { value: tipo, label: tipo, color: '#5a6378', icon: 'fa-file-medical', desc: tipo };
  }

  // ─── Fetch + fallback HTML ───
  async _fetchHtml() {
    try {
      var r = await fetch('modules/gestion-humana/permisos/index.html');
      if (r.ok) return await r.text();
    } catch (e) { console.warn('[Permisos] fetch HTML falló, usando fallback inline:', e.message); }
    return '<div class="pe-wrapper" id="pe-wrapper">' +
      '<div class="pe-kpi-section"><div id="pe-kpi-bar" class="pe-kpi-bar"></div></div>' +
      '<div class="pe-section-head">' +
        '<div class="pe-section-head__text"><h2 class="pe-section-head__title">Permisos y Estados del Trabajador</h2>' +
        '<p class="pe-section-head__subtitle">Incapacidades, maternidad, paternidad, luto y permisos diversos</p></div>' +
        '<button id="pe-nuevo" class="pe-btn pe-btn--primary" type="button"><i class="fas fa-plus"></i> Registrar Permiso / Estado</button>' +
      '</div>' +
      '<div class="pe-filters">' +
        '<select id="pe-filtro-tipo" class="pe-select"><option value="all">Todos los tipos</option></select>' +
        '<select id="pe-filtro-estado" class="pe-select"><option value="all">Todos los estados</option><option value="activo">Activos</option><option value="finalizado">Finalizados</option><option value="prorrogado">Prorrogados</option></select>' +
      '</div>' +
      '<div id="pe-cards" class="pe-cards"></div>' +
      '<div class="pe-info-box"><div class="pe-info-box__head"><h3 class="pe-info-box__title">Tipos de Permisos y Licencias</h3></div>' +
      '<div class="pe-info-box__grid" id="pe-tipos-info"></div></div>' +
    '</div>';
  }

  // ─── Render principal ───
  async render() {
    var self = this;
    if (!this._html) this._html = await this._fetchHtml();
    this.container.innerHTML = this._html;

    if (this.loading) {
      var kpiBar = this.container.querySelector('#pe-kpi-bar');
      if (kpiBar) kpiBar.innerHTML = '<div class="pe-loading"><i class="fas fa-spinner fa-spin"></i> Cargando…</div>';
      await this._load();
    }

    this._renderKpiBar();
    this._renderFilters();
    this._renderCards();
    this._renderTiposInfo();

    var btnNuevo = this.container.querySelector('#pe-nuevo');
    if (btnNuevo) btnNuevo.onclick = function () { self._openNuevoModal(); };
  }

  _renderAll() {
    this._renderKpiBar();
    this._renderFilters();
    this._renderCards();
  }

  _renderKpiBar() {
    var bar = this.container.querySelector('#pe-kpi-bar');
    if (!bar || !window.GHKPIBar) return;
    var k = this._kpis();
    var kpis = [
      { icon: 'fa-file-medical',  color: '#174ea6', bg: '#e8f0fe', value: k.activos,        label: 'Permisos Activos' },
      { icon: 'fa-notes-medical', color: '#be123c', bg: '#f8d7da', value: k.incapacidades,  label: 'Incapacidades' },
      { icon: 'fa-baby-carriage', color: '#5b2a86', bg: '#e7d6ff', value: k.maternidad,     label: 'Maternidad' },
      { icon: 'fa-baby',         color: '#1d4ed8', bg: '#dbeafe', value: k.paternidad,     label: 'Paternidad' },
      { icon: 'fa-cross',        color: '#6c757d', bg: '#e9ecef', value: k.luto,           label: 'Luto' }
    ];
    window.GHKPIBar.render(bar, kpis);
  }

  _renderFilters() {
    var self = this;
    var selTipo = this.container.querySelector('#pe-filtro-tipo');
    if (selTipo) {
      selTipo.innerHTML = '<option value="all">Todos los tipos</option>' +
        PermisosComponent.TIPOS.map(function (t) {
          return '<option value="' + t.value + '"' + (self.filtroTipo === t.value ? ' selected' : '') + '>' + t.label + '</option>';
        }).join('');
      selTipo.onchange = function (e) { self.filtroTipo = e.target.value; self._renderCards(); };
    }
    var selEstado = this.container.querySelector('#pe-filtro-estado');
    if (selEstado) {
      selEstado.value = self.filtroEstado;
      selEstado.onchange = function (e) { self.filtroEstado = e.target.value; self._renderCards(); };
    }
  }

  _renderCards() {
    var self = this;
    var wrap = this.container.querySelector('#pe-cards');
    if (!wrap) return;
    var filtered = this._filtered();
    if (filtered.length === 0) {
      wrap.innerHTML = '<div class="pe-cards__empty">No hay permisos/estados que coincidan con los filtros.</div>';
      return;
    }
    var html = filtered.map(function (p) { return self._renderCard(p); }).join('');
    wrap.innerHTML = html;

    wrap.querySelectorAll('button[data-finalizar]').forEach(function (b) {
      b.onclick = function () { self._finalizar(b.getAttribute('data-finalizar')); };
    });
  }

  _renderCard(p) {
    var self = this;
    var t = this._trabajadorById[p.trabajadorId] || {};
    var tm = this._tipoMeta(p.tipo);
    var statusLabel = { 'activo': 'Activo', 'finalizado': 'Finalizado', 'prorrogado': 'Prorrogado' }[p.estado] || (p.estado || '—');
    var personaTxt = (t.nombres || '') + ' ' + (t.apellidos || '');
    var cargoTxt   = (t.cargo || '—') + (t.cargo && t.cedula ? ' · CC ' + t.cedula : '');

    return '<div class="pe-card">' +
      '<div class="pe-card__head">' +
        '<div class="pe-card__icon" style="background:' + tm.color + '1A; color:' + tm.color + ';"><i class="fas ' + tm.icon + '"></i></div>' +
        '<div class="pe-card__head-text">' +
          '<div class="pe-card__title">' + self._escHtml(tm.label) + '</div>' +
        '</div>' +
        '<span class="pe-status pe-status--' + self._escHtml(p.estado || 'activo') + '">' + self._escHtml(statusLabel) + '</span>' +
      '</div>' +
      '<div class="pe-card__persona"><strong>' + self._escHtml(personaTxt || '—') + '</strong> · ' + self._escHtml(cargoTxt) + '</div>' +
      '<div class="pe-card__body">' +
        '<div class="pe-card__row"><span class="pe-card__row-label">Fecha inicio:</span><span class="pe-card__row-value">' + self._fmtDate(p.fechaInicio) + '</span></div>' +
        (p.fechaFin ? '<div class="pe-card__row"><span class="pe-card__row-label">Fecha fin:</span><span class="pe-card__row-value">' + self._fmtDate(p.fechaFin) + '</span></div>' : '') +
        (p.dias ? '<div class="pe-card__row"><span class="pe-card__row-label">Días:</span><span class="pe-card__row-value pe-card__row-value--num">' + p.dias + '</span></div>' : '') +
        (p.motivo ? '<div class="pe-card__row"><span class="pe-card__row-label">Motivo:</span><span class="pe-card__row-value">' + self._escHtml(p.motivo) + '</span></div>' : '') +
        (p.notas ? '<div class="pe-card__row"><span class="pe-card__row-label">Notas:</span><span class="pe-card__row-value">' + self._escHtml(p.notas) + '</span></div>' : '<div class="pe-card__row"><span class="pe-card__row-label">Notas:</span><span class="pe-card__row-value">' + self._escHtml('') + '</span></div>') +
      '</div>' +
      '<div class="pe-card__soporte"><i class="fas fa-paperclip"></i> Soporte: ' + (p.soporteUrl ? '<a href="' + self._escHtml(p.soporteUrl) + '" target="_blank" rel="noopener">documento cargado</a>' : 'documento cargado') + '</div>' +
      (p.estado === 'activo'
        ? '<div class="pe-card__footer"><button class="pe-btn pe-btn--outline pe-btn--full" data-finalizar="' + self._escHtml(p.id) + '" type="button"><i class="fas fa-check"></i> Finalizar Permiso</button></div>'
        : '') +
    '</div>';
  }

  _renderTiposInfo() {
    var cont = this.container.querySelector('#pe-tipos-info');
    if (!cont) return;
    cont.innerHTML = PermisosComponent.TIPOS.map(function (t) {
      return '<div class="pe-tipo-info">' +
        '<div class="pe-tipo-info__icon" style="background:' + t.color + ';"><i class="fas ' + t.icon + '"></i></div>' +
        '<div class="pe-tipo-info__body">' +
          '<p class="pe-tipo-info__title">' + t.label + '</p>' +
          '<p class="pe-tipo-info__desc">' + t.desc + '</p>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ─── Modal: Registrar Permiso / Estado ───
  _openNuevoModal() {
    var self = this;
    if (this.trabajadores.length === 0) {
      this._showToast('No hay trabajadores registrados. Carga la Base Personal primero.', 'warning');
      return;
    }
    var choices = this.trabajadores
      .slice()
      .sort(function (a, b) { return ((a.nombres || '') + ' ' + (a.apellidos || '')).localeCompare((b.nombres || '') + ' ' + (b.apellidos || '')); })
      .map(function (t) { return '<option value="' + self._escHtml(t.id) + '">' + self._escHtml((t.nombres || '') + ' ' + (t.apellidos || '') + (t.cedula ? ' · CC ' + t.cedula : '')) + '</option>'; })
      .join('');
    var today = new Date().toISOString().slice(0, 10);
    var tipoOptions = PermisosComponent.TIPOS.map(function (t) { return '<option value="' + t.value + '">' + t.label + '</option>'; }).join('');

    var html =
      '<div class="pe-modal-backdrop" id="pe-nuevo-backdrop">' +
        '<div class="pe-modal" role="dialog" aria-modal="true">' +
          '<div class="pe-modal__head">' +
            '<div>' +
              '<h2 class="pe-modal__title">Registrar Permiso / Estado</h2>' +
              '<p class="pe-modal__sub">Inicia el registro de una ausencia justificada para un trabajador.</p>' +
            '</div>' +
            '<button class="pe-modal__close" type="button" aria-label="Cerrar">×</button>' +
          '</div>' +
          '<div class="pe-modal__body">' +
            '<form id="pe-nuevo-form" class="pe-form-grid">' +
              '<div class="pe-field pe-field--full"><label>Trabajador <span class="req">*</span></label>' +
                '<select name="trabajadorId" required><option value="">— Selecciona un trabajador —</option>' + choices + '</select></div>' +
              '<div class="pe-field"><label>Tipo <span class="req">*</span></label>' +
                '<select name="tipo" required><option value="">— Tipo —</option>' + tipoOptions + '</select></div>' +
              '<div class="pe-field"><label>Fecha Inicio <span class="req">*</span></label><input type="date" name="fechaInicio" required value="' + today + '" /></div>' +
              '<div class="pe-field"><label>Fecha Fin</label><input type="date" name="fechaFin" /></div>' +
              '<div class="pe-field"><label>Días</label><input type="number" name="dias" min="1" /></div>' +
              '<div class="pe-field pe-field--full"><label>Motivo</label><input type="text" name="motivo" placeholder="Ej: Nacimiento de hijo, cita especialista…" /></div>' +
              '<div class="pe-field pe-field--full"><label>Soporte (URL del documento)</label><input type="text" name="soporteUrl" placeholder="Opcional — enlace a la incapacidad, certificado, etc." /></div>' +
              '<div class="pe-field pe-field--full"><label>Notas</label><textarea name="notas" rows="2" placeholder="Opcional"></textarea></div>' +
            '</form>' +
          '</div>' +
          '<div class="pe-modal__foot">' +
            '<button class="pe-btn pe-btn--ghost" type="button" data-action="cancel">Cancelar</button>' +
            '<button class="pe-btn pe-btn--primary" type="button" data-action="submit"><i class="fas fa-check"></i> Registrar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var backdrop = wrap.firstChild;
    document.body.appendChild(backdrop);

    var close = function () { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };
    backdrop.querySelector('.pe-modal__close').onclick = close;
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
      var form = backdrop.querySelector('#pe-nuevo-form');
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var data = {
        trabajadorId: form.trabajadorId.value,
        tipo:          form.tipo.value,
        fechaInicio:   self._inputDateToIso(form.fechaInicio.value),
        fechaFin:      form.fechaFin.value ? self._inputDateToIso(form.fechaFin.value) : null,
        dias:          form.dias.value ? parseInt(form.dias.value, 10) : null,
        motivo:        form.motivo.value || null,
        soporteUrl:    form.soporteUrl.value || null,
        notas:         form.notas.value || null,
        estado:        'activo'
      };
      close();
      self._create(data);
    };
  }

  async _create(data) {
    try {
      var r = await window.electronAPI.ghCreatePermiso({ companyName: this.companyName, data: data });
      if (r && r.success) {
        this._showToast('Permiso registrado', 'success');
        await this._load();
        this._renderAll();
      } else {
        this._showToast('Error: ' + ((r && r.error && r.error.message) || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  async _finalizar(id) {
    try {
      var r = await window.electronAPI.ghFinalizarPermiso({ permisoId: id, fechaFin: new Date().toISOString().split('T')[0] });
      if (r && r.success) {
        this._showToast('Permiso finalizado', 'success');
        await this._load();
        this._renderAll();
      } else {
        this._showToast('Error: ' + ((r && r.error && r.error.message) || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  destroy() { /* noop */ }
}

window.PermisosComponent = PermisosComponent;
