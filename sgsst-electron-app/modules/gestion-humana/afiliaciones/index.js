// modules/gestion-humana/afiliaciones/index.js
// 📦759 · Afiliaciones — Estilo demo Tempoactiva
//
// Layout:
//   - 5 KPIs (Completos 4/4, Sin EPS, Sin Pensión, Sin ARL, Sin Caja)
//   - Header sección + 2 botones filtro (Todos, Completos) + búsqueda
//   - Tabla con Trabajador, Cédula, EPS, Pensión, ARL, Caja, Estado, Acción
//   - Modal de detalle al hacer clic en 👁 (info del personal estilo Base Personal)
//
// Backend: usa ghListPersonal + ghGetPersonal (ya existentes).

class AfiliacionesComponent {
  constructor(container, companyName, moduleName, subName, onBack) {
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.subName = subName;
    this.onBack = onBack;
    this.personales = [];
    this.filter = 'todos'; // 'todos' | 'completos'
    this.search = '';
    this.loading = true;
  }

  // ─── Helpers ───
  _toast() { return (window.parent && window.parent.KAIRToast) ? window.parent.KAIRToast : window.KAIRToast; }
  _showToast(msg, type) { var t = this._toast(); if (t) t.show(msg, type || 'info'); }
  _escHtml(s) { if (s == null) return ''; return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  _normalizeEstado(e) {
    if (e == null) return 'activo';  // null / undefined / '' → activo (default conservador)
    var v = String(e).toLowerCase().trim();
    if (v === 'r' || v === 'ret' || v === 'retirado') return 'retirado';
    if (v === 'a' || v === 'act' || v === 'activo') return 'activo';
    return 'activo';  // cualquier otro valor (vacío, 'incapacitado', 'vacaciones', etc) → activo
  }

  _initials(nombres, apellidos) {
    var n = (nombres || '').trim();
    var a = (apellidos || '').trim();
    var i1 = n ? n.charAt(0) : '';
    var i2 = a ? a.charAt(0) : '';
    return (i1 + i2).toUpperCase() || '?';
  }
  _avatarColor(seed) {
    var s = String(seed || '');
    var hash = 0;
    for (var i = 0; i < s.length; i++) hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    var hue = Math.abs(hash) % 360;
    var bg = 'hsl(' + hue + ', 55%, 45%)';
    return { bg: bg, fg: '#ffffff' };
  }
  _fmtDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) { return iso; }
  }
  _fmtDateInput(iso) {
    if (!iso) return '';
    try { return new Date(iso).toISOString().slice(0, 10); } catch (e) { return ''; }
  }
  _calcAntiguedad(fechaIngreso) {
    if (!fechaIngreso) return '—';
    var ing = new Date(fechaIngreso);
    if (isNaN(ing.getTime())) return '—';
    var now = new Date();
    var years = now.getFullYear() - ing.getFullYear();
    var m = now.getMonth() - ing.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < ing.getDate())) years--;
    if (years <= 0) {
      var months = (now.getFullYear() - ing.getFullYear()) * 12 + m;
      return months <= 0 ? 'Menos de 1 mes' : months + (months === 1 ? ' mes' : ' meses');
    }
    return years + (years === 1 ? ' año' : ' años');
  }
  _calcEdad(fechaNac) {
    if (!fechaNac) return '—';
    var fn = new Date(fechaNac);
    if (isNaN(fn.getTime())) return '—';
    var now = new Date();
    var years = now.getFullYear() - fn.getFullYear();
    var m = now.getMonth() - fn.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < fn.getDate())) years--;
    return years >= 0 ? years + (years === 1 ? ' año' : ' años') : '—';
  }

  // ─── Carga ───
  async _load() {
    if (!window.electronAPI || !this.companyName) { this.loading = false; return; }
    try {
      var r = await window.electronAPI.ghListPersonal({ companyName: this.companyName });
      this.personales = r && r.success ? (r.data.personales || []) : [];
    } catch (e) {
      this._showToast('Error cargando: ' + e.message, 'error');
    }
    this.loading = false;
  }

  // ─── Cálculos ───
  _kpis() {
    var p = this.personales;
    return {
      completos:  p.filter(function (t) { return t.eps && t.pension && t.arl && t.cajaCompensacion; }).length,
      sinEps:     p.filter(function (t) { return !t.eps; }).length,
      sinPension: p.filter(function (t) { return !t.pension; }).length,
      sinArl:     p.filter(function (t) { return !t.arl; }).length,
      sinCaja:    p.filter(function (t) { return !t.cajaCompensacion; }).length
    };
  }
  _countByEstado() {
    var self = this;
    return {
      todos:     this.personales.length,
      activos:   this.personales.filter(function (t) { return self._normalizeEstado(t.estado) === 'activo'; }).length,
      retirados: this.personales.filter(function (t) { return self._normalizeEstado(t.estado) === 'retirado'; }).length
    };
  }
  _filtered() {
    var self = this;
    var s = this.search.toLowerCase().trim();
    return this.personales.filter(function (t) {
      // Filtro por estado
      if (self.filter === 'activos' && self._normalizeEstado(t.estado) !== 'activo') return false;
      if (self.filter === 'retirados' && self._normalizeEstado(t.estado) !== 'retirado') return false;
      // Filtro por búsqueda
      if (!s) return true;
      return (t.nombres && t.nombres.toLowerCase().indexOf(s) >= 0) ||
             (t.apellidos && t.apellidos.toLowerCase().indexOf(s) >= 0) ||
             (t.cedula && t.cedula.indexOf(s) >= 0);
    });
  }

  // ─── Fetch + fallback HTML ───
  async _fetchHtml() {
    try {
      var r = await fetch('modules/gestion-humana/afiliaciones/index.html');
      if (r.ok) return await r.text();
    } catch (e) { console.warn('[Afiliaciones] fetch HTML falló, usando fallback inline:', e.message); }
    return '<div class="af-wrapper" id="af-wrapper">' +
      '<div class="af-kpi-section"><div id="af-kpi-bar" class="af-kpi-bar"></div></div>' +
      '<div class="af-section-head">' +
        '<div class="af-section-head__text"><h2 class="af-section-head__title">Afiliaciones de Seguridad Social</h2>' +
        '<p class="af-section-head__subtitle">EPS, Fondo de Pensión, ARL y Caja de Compensación</p></div>' +
        '<div class="af-section-head__actions">' +
          '<div class="af-seg" role="tablist" aria-label="Filtro por estado">' +
            '<button id="af-filter-todos" class="af-seg-btn af-seg-btn--active" type="button" data-filter="todos" role="tab" aria-selected="true">Todos <span id="af-count-todos" class="af-seg-count">0</span></button>' +
            '<button id="af-filter-activos" class="af-seg-btn" type="button" data-filter="activos" role="tab" aria-selected="false">Activos <span id="af-count-activos" class="af-seg-count">0</span></button>' +
            '<button id="af-filter-retirados" class="af-seg-btn" type="button" data-filter="retirados" role="tab" aria-selected="false">Retirados <span id="af-count-retirados" class="af-seg-count">0</span></button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="af-search-bar"><input id="af-search" type="text" class="af-search-input" placeholder="Buscar trabajador..." /></div>' +
      '<div id="af-table-wrap" class="af-table-wrap"></div>' +
    '</div>';
  }

  // ─── Render principal ───
  async render() {
    var self = this;
    if (!this._html) this._html = await this._fetchHtml();
    this.container.innerHTML = this._html;

    if (this.loading) {
      var kpiBar = this.container.querySelector('#af-kpi-bar');
      if (kpiBar) kpiBar.innerHTML = '<div class="af-loading"><i class="fas fa-spinner fa-spin"></i> Cargando…</div>';
      await this._load();
    }

    this._renderKpiBar();
    this._renderFilterButtons();
    this._renderSearch();
    this._renderTable();

    var searchInput = this.container.querySelector('#af-search');
    if (searchInput) {
      searchInput.value = self.search;
      var tt = null;
      searchInput.oninput = function (e) {
        clearTimeout(tt);
        tt = setTimeout(function () { self.search = e.target.value; self._renderTable(); }, 200);
      };
    }
  }

  _renderAll() {
    this._renderKpiBar();
    this._renderFilterButtons();
    this._renderTable();
  }

  _renderKpiBar() {
    var bar = this.container.querySelector('#af-kpi-bar');
    if (!bar || !window.GHKPIBar) return;
    var k = this._kpis();
    var kpis = [
      { icon: 'fa-check-circle',  color: '#28a745', bg: '#d4edda', value: k.completos,  label: 'Completos (4/4)' },
      { icon: 'fa-heart',         color: '#be123c', bg: '#f8d7da', value: k.sinEps,     label: 'Sin EPS' },
      { icon: 'fa-chart-line',    color: '#a16207', bg: '#fff3cd', value: k.sinPension, label: 'Sin Pensión' },
      { icon: 'fa-shield-halved', color: '#be123c', bg: '#f8d7da', value: k.sinArl,     label: 'Sin ARL' },
      { icon: 'fa-house',         color: '#a16207', bg: '#fff3cd', value: k.sinCaja,    label: 'Sin Caja' }
    ];
    window.GHKPIBar.render(bar, kpis);
  }

  _renderFilterButtons() {
    var self = this;
    var cont = this.container.querySelector('.af-seg');
    if (!cont) return;
    var counts = this._countByEstado();
    var cTodos = this.container.querySelector('#af-count-todos');
    var cActivos = this.container.querySelector('#af-count-activos');
    var cRetirados = this.container.querySelector('#af-count-retirados');
    if (cTodos) cTodos.textContent = counts.todos;
    if (cActivos) cActivos.textContent = counts.activos;
    if (cRetirados) cRetirados.textContent = counts.retirados;
    cont.querySelectorAll('button[data-filter]').forEach(function (b) {
      var isActive = b.getAttribute('data-filter') === self.filter;
      if (isActive) b.classList.add('af-seg-btn--active');
      else b.classList.remove('af-seg-btn--active');
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      b.onclick = function () { self.filter = b.getAttribute('data-filter'); self._renderFilterButtons(); self._renderTable(); };
    });
  }

  _renderSearch() {
    var si = this.container.querySelector('#af-search');
    if (si) si.value = this.search;
  }

  _renderTable() {
    var self = this;
    var wrap = this.container.querySelector('#af-table-wrap');
    if (!wrap) return;
    var filtered = this._filtered();
    if (filtered.length === 0) {
      wrap.innerHTML = '<div class="af-empty">No hay trabajadores que coincidan con los filtros.</div>';
      return;
    }
    var rows = filtered.map(function (t) { return self._renderRow(t); }).join('');
    wrap.innerHTML = '<div class="af-table-card">' +
      '<table class="af-table"><thead><tr>' +
        '<th>Trabajador</th>' +
        '<th>Cédula</th>' +
        '<th>EPS</th>' +
        '<th>Pensión</th>' +
        '<th>ARL</th>' +
        '<th>Caja Comp.</th>' +
        '<th class="af-table th--center">Estado</th>' +
        '<th class="af-table th--right">Acción</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';

    wrap.querySelectorAll('button[data-ver]').forEach(function (b) {
      b.onclick = function () { self._openDetailModal(b.getAttribute('data-ver')); };
    });
  }

  _renderRow(t) {
    var self = this;
    var has4 = !!(t.eps && t.pension && t.arl && t.cajaCompensacion);
    var badge = has4
      ? '<span class="af-badge af-badge--ok">4/4</span>'
      : '<span class="af-badge af-badge--fail">Incompleto</span>';

    var fieldCell = function (val, fecha) {
      if (!val) return '<span class="af-table__field-empty">—</span>';
      var dateLine = fecha ? '<div class="af-table__field-date">' + self._escHtml(self._fmtDate(fecha)) + '</div>' : '';
      return '<div class="af-table__field">' +
        '<div class="af-table__field-main" title="' + self._escHtml(val) + '">' + self._escHtml(val) + '</div>' +
        dateLine +
      '</div>';
    };

    var fullName = self._escHtml((t.nombres || '') + ' ' + (t.apellidos || ''));
    var personaTxt = fullName;
    var cargoTxt = self._escHtml(t.cargo || '—') + (t.cedula ? ' · CC ' + t.cedula : '');

    return '<tr>' +
      '<td>' +
        '<div class="af-table__name">' + fullName + '</div>' +
        '<div class="af-table__cargo">' + cargoTxt + '</div>' +
      '</td>' +
      '<td class="af-table__cedula">' + self._escHtml(t.cedula || '—') + '</td>' +
      '<td>' + fieldCell(t.eps, t.epsFecha) + '</td>' +
      '<td>' + fieldCell(t.pension, t.pensionFecha) + '</td>' +
      '<td>' + fieldCell(t.arl, t.arlFecha) + '</td>' +
      '<td>' + fieldCell(t.cajaCompensacion, t.cajaFecha) + '</td>' +
      '<td class="af-table td--center">' + badge + '</td>' +
      '<td class="af-table td--right">' +
        '<button class="af-row-action" data-ver="' + self._escHtml(t.id) + '" title="Ver detalle del trabajador"><i class="fas fa-eye"></i></button>' +
      '</td>' +
    '</tr>';
  }

  // ─── Modal de Detalle (info del personal) ───
  async _openDetailModal(personalId) {
    var self = this;
    var p = this.personales.find(function (x) { return x.id === personalId; });
    if (!p) { this._showToast('Trabajador no encontrado', 'error'); return; }
    // Si no tenemos todos los datos (por ejemplo, fechas de nacimiento), hacer fetch
    var full = p;
    if (!p.fechaNacimiento) {
      try {
        var r = await window.electronAPI.ghGetPersonal({ personalId: personalId });
        if (r && r.success && r.data && r.data.personal) full = r.data.personal;
      } catch (e) { /* noop */ }
    }

    // Cargar documentos de afiliaciones (4 slots: EPS/Pensión/ARL/Caja)
    var docsByTipo = {};
    try {
      var rdocs = await window.electronAPI.ghListDocumentosAfiliaciones({
        companyName: this.companyName,
        trabajadorId: personalId
      });
      if (rdocs && rdocs.success && rdocs.data && rdocs.data.documentos) {
        rdocs.data.documentos.forEach(function (slot) {
          docsByTipo[slot.tipoAfiliacion] = slot.doc;
        });
      }
    } catch (e) { console.warn('[Afiliaciones] Error cargando docs:', e.message); }

    var avatarColor = this._avatarColor(full.cedula || full.id);
    var initials = this._initials(full.nombres, full.apellidos);
    var fullName = ((full.nombres || '') + ' ' + (full.apellidos || '')).trim() || '—';

    var chips = [
      '<span class="af-chip"><i class="fas fa-briefcase"></i> ' + this._escHtml(full.cargo || 'Sin cargo') + '</span>',
      (full.sedeId ? '<span class="af-chip"><i class="fas fa-building"></i> ' + this._escHtml(full.sedeId) + '</span>' : ''),
      (full.cedula ? '<span class="af-chip"><i class="fas fa-id-card"></i> CC ' + this._escHtml(full.cedula) + '</span>' : ''),
      '<span class="af-chip"><i class="fas fa-birthday-cake"></i> ' + this._escHtml(this._calcEdad(full.fechaNacimiento)) + '</span>',
      '<span class="af-chip"><i class="fas fa-clock"></i> ' + this._escHtml(this._calcAntiguedad(full.fechaIngreso)) + ' en la empresa</span>'
    ].filter(Boolean).join('');

    var row = function (label, value) {
      return '<div class="af-detail-row">' +
        '<span class="af-detail-row__label">' + label + '</span>' +
        '<span class="af-detail-row__value">' + self._escHtml(value || '—') + '</span>' +
      '</div>';
    };

    // Slot de afiliación con bloque de documento (📦760)
    var affilCell = function (label, tipo, nombre, fecha) {
      var doc = docsByTipo[tipo];
      var docBlock;
      if (doc) {
        var tamanoTxt = doc.tamanoBytes ? self._fmtBytes(doc.tamanoBytes) : '';
        docBlock = '<div class="af-doc-block af-doc-block--has">' +
          '<div class="af-doc-block__file">' +
            '<i class="fas fa-file-pdf"></i>' +
            '<div class="af-doc-block__info">' +
              '<div class="af-doc-block__name" title="' + self._escHtml(doc.nombreArchivo) + '">' + self._escHtml(doc.nombreArchivo) + '</div>' +
              '<div class="af-doc-block__meta">' + tamanoTxt + ' · ' + self._fmtDate(doc.fechaSubida) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="af-doc-actions">' +
            '<button class="af-doc-btn af-doc-btn--primary" type="button" data-doc-action="ver" data-doc-id="' + self._escHtml(doc.id) + '" title="Abrir PDF"><i class="fas fa-eye"></i> Ver</button>' +
            '<button class="af-doc-btn" type="button" data-doc-action="reemplazar" data-doc-id="' + self._escHtml(doc.id) + '" data-doc-tipo="' + self._escHtml(tipo) + '" title="Reemplazar PDF"><i class="fas fa-sync-alt"></i></button>' +
            '<button class="af-doc-btn af-doc-btn--danger" type="button" data-doc-action="eliminar" data-doc-id="' + self._escHtml(doc.id) + '" data-doc-nombre="' + self._escHtml(doc.nombreArchivo) + '" title="Eliminar PDF"><i class="fas fa-trash"></i></button>' +
          '</div>' +
        '</div>';
      } else {
        docBlock = '<div class="af-doc-block af-doc-block--empty">' +
          '<div class="af-doc-block__empty-text"><i class="fas fa-file-pdf"></i> Sin documento</div>' +
          '<button class="af-doc-btn af-doc-btn--primary" type="button" data-doc-action="subir" data-doc-tipo="' + self._escHtml(tipo) + '" title="Subir PDF"><i class="fas fa-upload"></i> Subir PDF</button>' +
        '</div>';
      }

      var mainCls = 'af-affil-cell' + (nombre ? '' : ' af-affil-cell--empty');
      return '<div class="' + mainCls + '">' +
        '<div class="af-affil-cell__header">' +
          '<div class="af-affil-cell__label">' + label + '</div>' +
          (nombre ? '<div class="af-affil-cell__name">' + self._escHtml(nombre) + '</div>' : '<div class="af-affil-cell__name">—</div>') +
          (fecha ? '<div class="af-affil-cell__date">' + self._escHtml(self._fmtDate(fecha)) + '</div>' : '') +
        '</div>' +
        docBlock +
      '</div>';
    };

    var html =
      '<div class="af-modal-backdrop" id="af-modal-backdrop">' +
        '<div class="af-modal" role="dialog" aria-modal="true">' +
          '<div class="af-modal__head">' +
            '<div>' +
              '<h2 class="af-modal__title">Información del Trabajador</h2>' +
              '<p class="af-modal__sub">Vista detalle estilo Base Personal</p>' +
            '</div>' +
            '<button class="af-modal__close" type="button" aria-label="Cerrar">×</button>' +
          '</div>' +
          '<div class="af-modal__body">' +
            '<div class="af-profile">' +
              '<div class="af-profile__avatar" style="background:' + avatarColor.bg + ';color:' + avatarColor.fg + ';">' + this._escHtml(initials) + '</div>' +
              '<div>' +
                '<h3 class="af-profile__name">' + this._escHtml(fullName) + '</h3>' +
                '<p class="af-profile__cargo">' + this._escHtml(full.cargo || '—') + (full.cedula ? ' · CC ' + this._escHtml(full.cedula) : '') + '</p>' +
                '<div class="af-chips">' + chips + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="af-detail-rows">' +
              row('Fecha de ingreso', this._fmtDate(full.fechaIngreso)) +
              row('Fecha de retiro', this._fmtDate(full.fechaRetiro)) +
              row('Estado', full.estado) +
              row('Tipo de contrato', full.tipoContrato) +
              row('Salario', full.salario ? '$' + new Intl.NumberFormat('es-CO').format(full.salario) : null) +
              row('Celular', full.celular || full.telefono) +
              row('Email', full.email) +
              row('Ciudad', full.ciudad) +
              row('Empresa usuaria', full.empresaUsuaria) +
            '</div>' +
            '<div class="af-detail-section">' +
              '<h4 class="af-detail-section__title">Afiliaciones y Documentos</h4>' +
              '<p class="af-detail-section__hint">Sube el certificado de cada afiliación. Solo se permite 1 PDF por slot (reemplaza el anterior).</p>' +
              '<div class="af-affil-grid">' +
                affilCell('EPS', 'eps', full.eps, full.epsFecha) +
                affilCell('Pensión', 'pension', full.pension, full.pensionFecha) +
                affilCell('ARL', 'arl', full.arl, full.arlFecha) +
                affilCell('Caja', 'caja', full.cajaCompensacion, full.cajaFecha) +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="af-modal__foot">' +
            '<button class="af-btn af-btn--ghost" type="button" data-action="close">Cerrar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var backdrop = wrap.firstChild;
    document.body.appendChild(backdrop);

    var close = function () { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };
    backdrop.querySelector('.af-modal__close').onclick = close;
    backdrop.querySelector('[data-action="close"]').onclick = close;
    backdrop.onclick = function (e) { if (e.target === backdrop) close(); };

    // 📦760 · Handlers de documentos
    self._bindDocActions(backdrop, personalId, function () {
      // onChange callback: recargar el modal
      close();
      self._openDetailModal(personalId);
    });
  }

  // 📦760 · Helpers de documentos
  _fmtBytes(b) {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
  }

  _bindDocActions(backdrop, personalId, onChange) {
    var self = this;
    backdrop.querySelectorAll('[data-doc-action]').forEach(function (btn) {
      btn.onclick = async function () {
        var action = btn.getAttribute('data-doc-action');
        var tipo = btn.getAttribute('data-doc-tipo');
        var docId = btn.getAttribute('data-doc-id');
        var nombre = btn.getAttribute('data-doc-nombre') || '';

        if (action === 'ver') {
          try {
            var r = await window.electronAPI.ghAbrirDocumentoAfiliacion({ documentoId: docId });
            if (r && !r.success) self._showToast('Error abriendo PDF: ' + (r.error && r.error.message || ''), 'error');
          } catch (e) { self._showToast('Error: ' + e.message, 'error'); }
        } else if (action === 'subir' || action === 'reemplazar') {
          try {
            btn.disabled = true;
            var originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo…';
            var r = await window.electronAPI.ghSubirDocumentoAfiliacion({
              companyName: self.companyName,
              trabajadorId: personalId,
              tipoAfiliacion: tipo
            });
            btn.disabled = false;
            btn.innerHTML = originalHtml;
            if (r && r.success) {
              if (r.data && r.data.canceled) return;
              self._showToast(action === 'reemplazar' ? 'Documento reemplazado' : 'Documento subido', 'success');
              onChange && onChange();
            } else {
              self._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
            }
          } catch (e) {
            btn.disabled = false;
            self._showToast('Error: ' + e.message, 'error');
          }
        } else if (action === 'eliminar') {
          if (!window.KairConfirm) {
            if (!confirm('¿Eliminar "' + nombre + '"?')) return;
          } else {
            var ok = await window.KairConfirm.confirm({
              title: 'Eliminar documento',
              message: '¿Eliminar "' + nombre + '"? Esta acción no se puede deshacer.',
              confirmText: 'Eliminar',
              cancelText: 'Cancelar',
              type: 'danger'
            });
            if (!ok) return;
          }
          try {
            var r = await window.electronAPI.ghEliminarDocumentoAfiliacion({ documentoId: docId });
            if (r && r.success) {
              self._showToast('Documento eliminado', 'success');
              onChange && onChange();
            } else {
              self._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
            }
          } catch (e) { self._showToast('Error: ' + e.message, 'error'); }
        }
      };
    });
  }

  destroy() { /* noop */ }
}

window.AfiliacionesComponent = AfiliacionesComponent;
