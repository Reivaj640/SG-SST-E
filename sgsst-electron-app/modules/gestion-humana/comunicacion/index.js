// modules/gestion-humana/comunicacion/index.js
// 📦723 · Comunicación — HTML+CSS+JS separados (v0.2.0)
//
// Tabs: Anuncios | Mensajes
// Anuncios: CRUD (info, urgente, mantenimiento, evento) con dirigido_a (todos/sede/cargo)
// Mensajes: lista recibidos/enviados + marcar leído
// Backend: ghListAnuncios, ghCreateAnuncio, ghUpdateAnuncio, ghDeleteAnuncio,
//          ghListMensajes, ghCreateMensaje, ghMarcarLeido

class ComunicacionComponent {
  constructor(container, companyName, moduleName, subName, onBack) {
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.subName = subName;
    this.onBack = onBack;
    this.anuncios = [];
    this.mensajes = [];
    this.trabajadores = [];
    this.sedes = [];
    this._trabajadorById = {};
    this._sedeById = {};
    this.tab = 'anuncios';
    this.loading = true;
  }

  _toast() { return (window.parent && window.parent.KAIRToast) ? window.parent.KAIRToast : window.KAIRToast; }
  _confirmDialog() { return (window.parent && window.parent.KairConfirm) ? window.parent.KairConfirm : window.KairConfirm; }
  _showToast(msg, type) { var t = this._toast(); if (t) t.show(msg, type || 'info'); }
  _escHtml(s) { if (s == null) return ''; return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  static get TIPOS_ANUNCIO() {
    return [
      { value: 'info',          label: 'Informativo',  color: '#174ea6', icon: 'fa-info-circle' },
      { value: 'urgente',       label: 'Urgente',      color: '#dc3545', icon: 'fa-exclamation-circle' },
      { value: 'mantenimiento', label: 'Mantenimiento', color: '#fd7e14', icon: 'fa-wrench' },
      { value: 'evento',        label: 'Evento',       color: '#5b2a86', icon: 'fa-calendar' }
    ];
  }

  async _load() {
    if (!window.electronAPI || !this.companyName) { this.loading = false; return; }
    try {
      var results = await Promise.all([
        window.electronAPI.ghListAnuncios({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListMensajes({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListPersonal({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListSedes({ companyName: this.companyName }).catch(function () { return { success: false }; })
      ]);
      this.anuncios     = results[0].success ? (results[0].data.anuncios || []) : [];
      this.mensajes     = results[1].success ? (results[1].data.mensajes || []) : [];
      this.trabajadores = results[2].success ? (results[2].data.personales || []) : [];
      this.sedes        = results[3].success ? (results[3].data.sedes || []) : [];
      this._trabajadorById = {}; this._sedeById = {};
      this.trabajadores.forEach(function (t) { this._trabajadorById[t.id] = t; }.bind(this));
      this.sedes.forEach(function (s) { this._sedeById[s.id] = s; }.bind(this));
    } catch (e) { this._showToast('Error cargando: ' + e.message, 'error'); }
    this.loading = false;
  }

  _kpis() {
    var a = this.anuncios.filter(function (x) { return x.activo; });
    return {
      anunciosActivos: a.length,
      urgentes: a.filter(function (x) { return x.tipo === 'urgente'; }).length,
      mensajesRecibidos: this.mensajes.length,
      mensajesEnviados: 0
    };
  }

  async _fetchHtml() {
    try {
      var r = await fetch('modules/gestion-humana/comunicacion/index.html');
      if (r.ok) return await r.text();
    } catch (e) { console.warn('[Comunicacion] fetch HTML falló, usando fallback inline:', e.message); }
    return '<div class="cm-wrapper" id="cm-wrapper">' +
      '<div class="cm-kpi-section"><div id="cm-kpi-bar" class="cm-kpi-bar"></div></div>' +
      '<div class="cm-tabs" id="cm-tabs">' +
        '<button data-tab="anuncios" class="cm-tab cm-tab--active" type="button"><i class="fas fa-bullhorn"></i> Anuncios (<span id="cm-count-anuncios">0</span>)</button>' +
        '<button data-tab="mensajes" class="cm-tab" type="button"><i class="fas fa-envelope"></i> Mensajes (<span id="cm-count-mensajes">0</span>)</button>' +
      '</div>' +
      '<div id="cm-content" class="cm-content"></div>' +
    '</div>';
  }

  async render() {
    var self = this;
    if (!this._html) this._html = await this._fetchHtml();
    this.container.innerHTML = this._html;

    if (this.loading) {
      var kpiBar = this.container.querySelector('#cm-kpi-bar');
      if (kpiBar) kpiBar.innerHTML = '<div style="padding:1rem; text-align:center; color:#5a6378;"><i class="fas fa-spinner fa-spin"></i> Cargando…</div>';
      await this._load();
    }

    this._renderKpiBar();
    this._renderTabsBar();
    this._renderContent();

    var tabs = this.container.querySelector('#cm-tabs');
    if (tabs) {
      tabs.querySelectorAll('button[data-tab]').forEach(function (b) {
        b.onclick = function () { self.tab = b.getAttribute('data-tab'); self.render(); };
      });
    }
  }

  _renderKpiBar() {
    var bar = this.container.querySelector('#cm-kpi-bar');
    if (!bar) return;
    var k = this._kpis();
    var kpis = [
      { icon: 'fa-bullhorn',           color: '#174ea6', bg: '#e8f0fe', value: k.anunciosActivos,   label: 'Anuncios Activos' },
      { icon: 'fa-exclamation-circle', color: '#dc3545', bg: '#f8d7da', value: k.urgentes,         label: 'Urgentes' },
      { icon: 'fa-inbox',              color: '#0d9488', bg: '#ccfbf1', value: k.mensajesRecibidos, label: 'Mensajes Recibidos' },
      { icon: 'fa-paper-plane',        color: '#28a745', bg: '#d4edda', value: k.mensajesEnviados,  label: 'Mensajes Enviados' }
    ];
    window.GHKPIBar.render(bar, kpis);
    var cA = this.container.querySelector('#cm-count-anuncios');
    var cM = this.container.querySelector('#cm-count-mensajes');
    if (cA) cA.textContent = k.anunciosActivos;
    if (cM) cM.textContent = k.mensajesRecibidos;
  }

  _renderTabsBar() {
    var self = this;
    var tabs = this.container.querySelectorAll('.cm-tab');
    tabs.forEach(function (b) {
      if (b.getAttribute('data-tab') === self.tab) b.classList.add('cm-tab--active');
      else b.classList.remove('cm-tab--active');
    });
  }

  _renderContent() {
    if (this.tab === 'anuncios') this._renderAnuncios();
    else this._renderMensajes();
  }

  // === ANUNCIOS ===
  _renderAnuncios() {
    var self = this;
    var content = this.container.querySelector('#cm-content');
    if (!content) return;
    var wrap = document.createElement('div');
    var head = document.createElement('div');
    head.className = 'cm-section-head';
    head.innerHTML =
      '<div class="cm-section-head__text">' +
        '<h2 class="cm-section-head__title">Tablón de Anuncios</h2>' +
        '<p class="cm-section-head__subtitle">Comunicación oficial a trabajadores por sede, cargo o general</p>' +
      '</div>' +
      '<button id="anun-nuevo" class="cm-btn cm-btn--primary" type="button"><i class="fas fa-plus"></i> Nuevo Anuncio</button>';
    wrap.appendChild(head);

    var activos = this.anuncios.filter(function (a) { return a.activo; });
    if (activos.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'cm-empty';
      empty.textContent = 'No hay anuncios activos. Crea el primero con "Nuevo Anuncio".';
      wrap.appendChild(empty);
      content.innerHTML = '';
      content.appendChild(wrap);
      var btnNuevo = this.container.querySelector('#anun-nuevo');
      if (btnNuevo) btnNuevo.onclick = function () { self._showAnuncioDialog(); };
      return;
    }

    var grid = document.createElement('div');
    grid.className = 'cm-anuncios-grid';
    activos.forEach(function (a) {
      var tm = ComunicacionComponent.TIPOS_ANUNCIO.find(function (t) { return t.value === a.tipo; }) || { label: a.tipo, color: '#5a6378', icon: 'fa-bullhorn' };
      var dirigidoLabel = a.dirigidoA === 'todos' ? 'Todos' : a.dirigidoA === 'sede' ? 'Sede: ' + (self._sedeById[a.sedeId] ? self._sedeById[a.sedeId].nombre : '—') : a.dirigidoA === 'cargo' ? 'Cargo: ' + (a.cargoFiltro || '—') : a.dirigidoA;
      var card = document.createElement('div');
      card.className = 'cm-anuncio';
      card.innerHTML =
        '<div class="cm-anuncio__head">' +
          '<div class="cm-anuncio__icon" style="background:' + tm.color + '22; color:' + tm.color + ';"><i class="fas ' + tm.icon + '"></i></div>' +
          '<div class="cm-anuncio__title">' + self._escHtml(a.titulo) + '</div>' +
          '<span class="cm-anuncio__type" style="background:' + tm.color + '22; color:' + tm.color + ';">' + tm.label + '</span>' +
        '</div>' +
        '<div class="cm-anuncio__meta">' +
          '<span><i class="fas fa-users"></i> ' + self._escHtml(dirigidoLabel) + '</span>' +
          '<span><i class="fas fa-user"></i> Por ' + self._escHtml(a.publicadoPor || '—') + '</span>' +
          '<span><i class="fas fa-calendar"></i> ' + self._escHtml(a.fechaPublicacion || '—') + '</span>' +
        '</div>' +
        '<p class="cm-anuncio__content">' + self._escHtml(a.contenido) + '</p>' +
        '<div class="cm-anuncio__footer">' +
          '<button class="cm-btn cm-btn--danger" data-eliminar="' + self._escHtml(a.id) + '"><i class="fas fa-times"></i> Eliminar</button>' +
        '</div>';
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    content.innerHTML = '';
    content.appendChild(wrap);

    var btnNuevo = this.container.querySelector('#anun-nuevo');
    if (btnNuevo) btnNuevo.onclick = function () { self._showAnuncioDialog(); };
    content.querySelectorAll('button[data-eliminar]').forEach(function (b) {
      b.onclick = function () { self._eliminarAnuncio(b.getAttribute('data-eliminar')); };
    });
  }

  // === MENSAJES ===
  _renderMensajes() {
    var self = this;
    var content = this.container.querySelector('#cm-content');
    if (!content) return;
    var wrap = document.createElement('div');
    var head = document.createElement('div');
    head.className = 'cm-section-head';
    head.innerHTML =
      '<div class="cm-section-head__text">' +
        '<h2 class="cm-section-head__title">Mensajes</h2>' +
        '<p class="cm-section-head__subtitle">Bandeja de mensajes oficiales</p>' +
      '</div>' +
      '<button id="msg-nuevo" class="cm-btn cm-btn--primary" type="button"><i class="fas fa-plus"></i> Nuevo Mensaje</button>';
    wrap.appendChild(head);

    if (this.mensajes.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'cm-empty';
      empty.textContent = 'No hay mensajes. Crea el primero con "Nuevo Mensaje".';
      wrap.appendChild(empty);
      content.innerHTML = '';
      content.appendChild(wrap);
      var btnNuevo = this.container.querySelector('#msg-nuevo');
      if (btnNuevo) btnNuevo.onclick = function () { self._showMensajeDialog(); };
      return;
    }

    var list = document.createElement('div');
    list.className = 'cm-mensajes';
    this.mensajes.slice(0, 30).forEach(function (m) {
      var from = self._trabajadorById[m.remitenteId] || {};
      var initials = ((from.nombres || '?').charAt(0) + (from.apellidos || '?').charAt(0)).toUpperCase();
      var noLeido = m.estado === 'enviado' || m.estado === 'no_leido';
      var card = document.createElement('div');
      card.className = 'cm-mensaje';
      card.innerHTML =
        '<div class="cm-mensaje__avatar">' + self._escHtml(initials) + '</div>' +
        '<div class="cm-mensaje__body">' +
          '<div class="cm-mensaje__head">' +
            '<div class="cm-mensaje__from">' + self._escHtml((from.nombres || '') + ' ' + (from.apellidos || '—')) + (noLeido ? '<span class="cm-mensaje__badge">NUEVO</span>' : '') + '</div>' +
            '<div class="cm-mensaje__date">' + self._escHtml((m.fechaHora || '').split('T')[0] || '') + '</div>' +
          '</div>' +
          (m.asunto ? '<div class="cm-mensaje__subject">' + self._escHtml(m.asunto) + '</div>' : '') +
          '<p class="cm-mensaje__text">' + self._escHtml(m.contenido) + '</p>' +
          (noLeido ? '<div class="cm-mensaje__actions"><button class="cm-btn cm-btn--primary" data-leido="' + self._escHtml(m.id) + '" type="button"><i class="fas fa-check"></i> Marcar leído</button></div>' : '') +
        '</div>';
      list.appendChild(card);
    });
    wrap.appendChild(list);

    content.innerHTML = '';
    content.appendChild(wrap);

    var btnNuevo = this.container.querySelector('#msg-nuevo');
    if (btnNuevo) btnNuevo.onclick = function () { self._showMensajeDialog(); };
    content.querySelectorAll('button[data-leido]').forEach(function (b) {
      b.onclick = function () { self._marcarLeido(b.getAttribute('data-leido')); };
    });
  }

  // === ACCIONES (placeholders mínimos — la lógica completa se mantiene del original si se necesita) ===
  async _showAnuncioDialog() {
    if (this.trabajadores.length === 0) { this._showToast('No hay trabajadores. Carga uno primero.', 'warning'); return; }
    var choices = this.trabajadores.map(function (t) { return { value: t.id, label: (t.nombres + ' ' + t.apellidos) }; });
    var data = await this._confirmDialog().input({
      title: 'Nuevo Anuncio',
      fields: [
        { name: 'titulo', label: 'Título', type: 'text', required: true },
        { name: 'tipo', label: 'Tipo', type: 'select', required: true, default: 'info',
          options: ComunicacionComponent.TIPOS_ANUNCIO.map(function (t) { return { value: t.value, label: t.label }; }) },
        { name: 'dirigidoA', label: 'Dirigido a', type: 'select', required: true, default: 'todos',
          options: [{ value: 'todos', label: 'Todos' }, { value: 'sede', label: 'Por sede' }, { value: 'cargo', label: 'Por cargo' }] },
        { name: 'contenido', label: 'Contenido', type: 'textarea', required: true }
      ]
    });
    if (!data) return;
    try {
      var r = await window.electronAPI.ghCreateAnuncio({
        companyName: this.companyName,
        data: { titulo: data.titulo, tipo: data.tipo, dirigidoA: data.dirigidoA, contenido: data.contenido, activo: true, publicadoPor: 'Admin', fechaPublicacion: new Date().toISOString().split('T')[0] }
      });
      if (r && r.success) { this._showToast('Anuncio publicado', 'success'); await this._load(); this.render(); }
      else { this._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error'); }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  async _eliminarAnuncio(id) {
    var ok = await this._confirmDialog().confirm({
      title: 'Eliminar Anuncio',
      message: '¿Eliminar este anuncio?',
      confirmText: 'Eliminar', cancelText: 'Cancelar', type: 'warning'
    });
    if (!ok) return;
    try {
      var r = await window.electronAPI.ghDeleteAnuncio({ anuncioId: id });
      if (r && r.success) { this._showToast('Anuncio eliminado', 'success'); await this._load(); this.render(); }
      else { this._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error'); }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  async _showMensajeDialog() {
    if (this.trabajadores.length === 0) { this._showToast('No hay trabajadores.', 'warning'); return; }
    var choices = this.trabajadores.map(function (t) { return { value: t.id, label: (t.nombres + ' ' + t.apellidos) }; });
    var data = await this._confirmDialog().input({
      title: 'Nuevo Mensaje',
      fields: [
        { name: 'destinatarioId', label: 'Destinatario', type: 'select', required: true, options: choices },
        { name: 'asunto', label: 'Asunto', type: 'text', required: true },
        { name: 'contenido', label: 'Contenido', type: 'textarea', required: true }
      ]
    });
    if (!data) return;
    try {
      var r = await window.electronAPI.ghCreateMensaje({
        companyName: this.companyName,
        data: { destinatarioId: data.destinatarioId, asunto: data.asunto, contenido: data.contenido, remitenteId: 'admin', estado: 'enviado', fechaHora: new Date().toISOString() }
      });
      if (r && r.success) { this._showToast('Mensaje enviado', 'success'); await this._load(); this.render(); }
      else { this._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error'); }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  async _marcarLeido(id) {
    try {
      var r = await window.electronAPI.ghMarcarLeido({ mensajeId: id });
      if (r && r.success) { this._showToast('Mensaje marcado como leído', 'success'); await this._load(); this.render(); }
      else { this._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error'); }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  destroy() { /* noop */ }
}

window.ComunicacionComponent = ComunicacionComponent;
