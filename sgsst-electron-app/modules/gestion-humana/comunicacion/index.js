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

  // Getter (NO método): todo el módulo lo usa como propiedad
  // (this._toast.success(...)). Si fuera método, cada acceso lanzaría
  // TypeError y abortaría las recargas que vienen después del aviso.
  get _toast() {
    // 📦GESTION-HUMANA-TOAST — Helper estandarizado con title+subtitle+type.
    if (window.parent && window.parent.GestionHumanaToast) return window.parent.GestionHumanaToast;
    if (window.GestionHumanaToast) return window.GestionHumanaToast;
    // Fallback: KAIRToast directo (compatibilidad si el helper no cargó).
    var k = (window.parent && window.parent.KAIRToast) ? window.parent.KAIRToast : window.KAIRToast;
    if (k) return k;
    // Última red: objeto nulo para que un helper ausente nunca bloquee recargas.
    return { success: function () {}, error: function () {}, warning: function () {}, info: function () {}, show: function () {} };
  }
  _confirmDialog() { return (window.parent && window.parent.KairConfirm) ? window.parent.KairConfirm : window.KairConfirm; }
  _showToast(msg, type) {
    var t = this._toast;
    if (!t) return;
    // Si el helper está disponible, partir "X: Y" en title/subtitle para mejor legibilidad.
    if (t.success && msg.indexOf(':') > 0 && msg.indexOf(':') < 60) {
      var idx = msg.indexOf(':');
      var title = msg.substring(0, idx).trim();
      var subtitle = msg.substring(idx + 1).trim();
      if (typeof t[type] === 'function') { t[type](title, subtitle); return; }
    }
    if (typeof t.show === 'function') t.show(msg, type || 'info');
  }
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
    var self = this;
    try {
      var results = await Promise.all([
        window.electronAPI.ghListAnuncios({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListMensajes({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListPersonal({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListSedes({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        (window.electronAPI.ghListEnvios ? window.electronAPI.ghListEnvios({ companyName: this.companyName }).catch(function () { return { success: false }; }) : Promise.resolve({ success: false }))
      ]);
      this.anuncios     = results[0].success ? (results[0].data.anuncios || []) : [];
      this.mensajes     = results[1].success ? (results[1].data.mensajes || []) : [];
      this.trabajadores = results[2].success ? (results[2].data.personales || []) : [];
      this.sedes        = results[3].success ? (results[3].data.sedes || []) : [];
      // Mapa referencia -> envíos (detalle completo) y conteo de reales (excluye pruebas)
      this._enviosByRef = {};
      this._enviosDetalle = {};
      this._pruebasByRef = {};
      if (results[4].success && results[4].data && results[4].data.envios) {
        results[4].data.envios.forEach(function (e) {
          if (!e.referencia_id) return;
          (self._enviosDetalle[e.referencia_id] = self._enviosDetalle[e.referencia_id] || []).push(e);
          var esPrueba = e.detalle && String(e.detalle).indexOf('PRUEBA') === 0;
          if (e.estado !== 'enviado') return;
          if (esPrueba) { self._pruebasByRef[e.referencia_id] = (self._pruebasByRef[e.referencia_id] || 0) + 1; return; }
          self._enviosByRef[e.referencia_id] = (self._enviosByRef[e.referencia_id] || 0) + 1;
        });
      }
      this._trabajadorById = {}; this._sedeById = {};
      this.trabajadores.forEach(function (t) { this._trabajadorById[t.id] = t; }.bind(this));
      this.sedes.forEach(function (s) { this._sedeById[s.id] = s; }.bind(this));
    } catch (e) { this._toast.error('Error cargando', e.message); }
    this.loading = false;
  }

  _kpis() {
    var a = this.anuncios.filter(function (x) { return x.activo; });
    return {
      anunciosActivos: a.length,
      urgentes: a.filter(function (x) { return x.tipo === 'urgente'; }).length,
      mensajesRecibidos: this.mensajes.filter(function (x) { return x.remitenteId !== 'RRHH'; }).length,
      mensajesEnviados: this.mensajes.filter(function (x) { return x.remitenteId === 'RRHH'; }).length
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
          (self._enviosByRef && self._enviosByRef[a.id] ? '<span class="cm-mensaje__badge"><i class="fas fa-check"></i> Enviado a ' + self._enviosByRef[a.id] + '</span>' : '') +
          (self._pruebasByRef && self._pruebasByRef[a.id] ? '<span class="cm-mensaje__badge" style="background:#e9ecef;color:#495057;"><i class="fas fa-vial"></i> Probado</span>' : '') +
        '</div>' +
        '<p class="cm-anuncio__content">' + self._escHtml(a.contenido) + '</p>' +
        '<div class="cm-anuncio__footer">' +
          '<button class="cm-btn cm-btn--ghost" data-vista="' + self._escHtml(a.id) + '" type="button"><i class="fas fa-eye"></i> Vista previa</button>' +
          '<button class="cm-btn cm-btn--primary" data-enviar="' + self._escHtml(a.id) + '" type="button"><i class="fas fa-paper-plane"></i> Enviar por correo</button>' +
          '<button class="cm-btn cm-btn--ghost" data-hist="' + self._escHtml(a.id) + '" type="button" title="Historial de envíos"><i class="fas fa-clock-rotate-left"></i> Historial</button>' +
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
    content.querySelectorAll('button[data-enviar]').forEach(function (b) {
      b.onclick = function () { self._enviarAnuncio(b.getAttribute('data-enviar'), b); };
    });
    content.querySelectorAll('button[data-vista]').forEach(function (b) {
      b.onclick = function () { self._vistaPreviaAnuncio(b.getAttribute('data-vista')); };
    });
    content.querySelectorAll('button[data-hist]').forEach(function (b) {
      b.onclick = function () { self._verHistorial('anuncio', b.getAttribute('data-hist')); };
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
      var esRRHH = m.remitenteId === 'RRHH';
      var from = self._trabajadorById[m.remitenteId] || {};
      var fromNombre = esRRHH ? 'RRHH · Administración' : ((from.nombres || '') + ' ' + (from.apellidos || '—')).trim();
      var initials = esRRHH ? 'RH' : ((from.nombres || '?').charAt(0) + (from.apellidos || '?').charAt(0)).toUpperCase();
      var noLeido = !m.leido;
      var card = document.createElement('div');
      card.className = 'cm-mensaje';
      card.innerHTML =
        '<div class="cm-mensaje__avatar">' + self._escHtml(initials) + '</div>' +
        '<div class="cm-mensaje__body">' +
          '<div class="cm-mensaje__head">' +
            '<div class="cm-mensaje__from">' + self._escHtml(fromNombre) + (noLeido ? '<span class="cm-mensaje__badge">NUEVO</span>' : '') + '</div>' +
            '<div class="cm-mensaje__date">' + self._escHtml((m.fechaHora || '').split('T')[0] || '') + '</div>' +
          '</div>' +
          (m.asunto ? '<div class="cm-mensaje__subject">' + self._escHtml(m.asunto) + '</div>' : '') +
          '<p class="cm-mensaje__text">' + self._escHtml(m.contenido) + '</p>' +
          '<div class="cm-mensaje__actions">' +
            (self._enviosByRef && self._enviosByRef[m.id] ? '<span class="cm-mensaje__badge" title="Correos enviados"><i class="fas fa-check"></i> Enviado</span>' : '') +
            (self._pruebasByRef && self._pruebasByRef[m.id] ? '<span class="cm-mensaje__badge" style="background:#e9ecef;color:#495057;" title="Prueba enviada"><i class="fas fa-vial"></i> Probado</span>' : '') +
            '<button class="cm-btn cm-btn--ghost" data-vista-msg="' + self._escHtml(m.id) + '" type="button" title="Vista previa"><i class="fas fa-eye"></i></button>' +
            '<button class="cm-btn cm-btn--primary" data-enviar-msg="' + self._escHtml(m.id) + '" type="button" title="Enviar por correo"><i class="fas fa-paper-plane"></i></button>' +
            '<button class="cm-btn cm-btn--ghost" data-hist-msg="' + self._escHtml(m.id) + '" type="button" title="Historial de envíos"><i class="fas fa-clock-rotate-left"></i></button>' +
            (noLeido ? '<button class="cm-btn cm-btn--primary" data-leido="' + self._escHtml(m.id) + '" type="button"><i class="fas fa-check"></i> Marcar leído</button>' : '') +
          '</div>' +
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
    content.querySelectorAll('button[data-vista-msg]').forEach(function (b) {
      b.onclick = function () { self._vistaPreviaMensaje(b.getAttribute('data-vista-msg')); };
    });
    content.querySelectorAll('button[data-hist-msg]').forEach(function (b) {
      b.onclick = function () { self._verHistorial('mensaje', b.getAttribute('data-hist-msg')); };
    });
    content.querySelectorAll('button[data-enviar-msg]').forEach(function (b) {
      b.onclick = function () { self._enviarMensajeCorreo(b.getAttribute('data-enviar-msg'), b); };
    });
  }

  // === ACCIONES (placeholders mínimos — la lógica completa se mantiene del original si se necesita) ===
  // Sube archivos del diálogo al anuncio/mensaje recién creado. Devuelve {ok, fail}.
  async _subirAdjuntosCom(tipo, referenciaId, files) {
    var lista = files && files.length ? files : [];
    if (lista.length === 0) return { ok: 0, fail: 0 };
    var api = (typeof window !== 'undefined') ? (window.electronAPI || null) : null;
    var ok = 0, fail = 0;
    for (var i = 0; i < lista.length; i++) {
      try {
        var f = lista[i];
        var buf = await new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () {
            var parts = String(reader.result || '').split(',');
            resolve(parts.length > 1 ? parts[1] : reader.result);
          };
          reader.onerror = function () { reject(reader.error || new Error('No se pudo leer ' + f.name)); };
          reader.readAsDataURL(f);
        });
        var r = await api.ghSubirAdjuntoCom({
          companyName: this.companyName, tipo: tipo, referenciaId: referenciaId,
          nombre: f.name, mimeType: f.type || 'application/octet-stream', base64: buf
        });
        if (r && r.success) ok++; else fail++;
      } catch (e) { fail++; }
    }
    return { ok: ok, fail: fail };
  }

  async _showAnuncioDialog() {
    if (this.trabajadores.length === 0) { this._toast.warning('No hay trabajadores. Carga uno primero.'); return; }
    var sedeOpts = [{ value: '', label: '—' }].concat(this.sedes.map(function (s) { return { value: s.id, label: s.nombre }; }));
    var cargosVistos = {};
    var cargoOpts = [{ value: '', label: '—' }].concat(this.trabajadores.filter(function (t) {
      if (!t.cargo || cargosVistos[t.cargo]) return false;
      cargosVistos[t.cargo] = true;
      return true;
    }).map(function (t) { return { value: t.cargo, label: t.cargo }; }));
    var data = await this._confirmDialog().input({
      title: 'Nuevo Anuncio',
      fields: [
        { name: 'titulo', label: 'Título', type: 'text', required: true },
        { name: 'tipo', label: 'Tipo', type: 'select', required: true, default: 'info',
          options: ComunicacionComponent.TIPOS_ANUNCIO.map(function (t) { return { value: t.value, label: t.label }; }) },
        { name: 'dirigidoA', label: 'Dirigido a', type: 'select', required: true, default: 'todos',
          options: [{ value: 'todos', label: 'Todos' }, { value: 'sede', label: 'Por sede' }, { value: 'cargo', label: 'Por cargo' }] },
        { name: 'sedeId', label: 'Sede (si es por sede)', type: 'select', required: false, options: sedeOpts },
        { name: 'cargoFiltro', label: 'Cargo (si es por cargo)', type: 'select', required: false, options: cargoOpts },
        { name: 'contenido', label: 'Contenido', type: 'textarea', required: true, rows: 6 },
        { name: 'adjuntos', label: 'Archivos adjuntos (opcional)', type: 'file', multiple: true }
      ]
    });
    if (!data) return;
    if (data.dirigidoA === 'sede' && !data.sedeId) { this._toast.warning('Elegí la sede del anuncio.'); return; }
    if (data.dirigidoA === 'cargo' && !data.cargoFiltro) { this._toast.warning('Elegí el cargo del anuncio.'); return; }
    try {
      var r = await window.electronAPI.ghCreateAnuncio({
        companyName: this.companyName,
        data: { titulo: data.titulo, tipo: data.tipo, dirigidoA: data.dirigidoA, contenido: data.contenido, activo: true,
          sedeId: data.dirigidoA === 'sede' ? (data.sedeId || null) : null,
          cargoFiltro: data.dirigidoA === 'cargo' ? (data.cargoFiltro || null) : null,
          publicadoPor: 'RRHH', fechaPublicacion: new Date().toISOString().split('T')[0] }
      });
      if (r && r.success) {
        var sub = await this._subirAdjuntosCom('anuncio', r.data.anuncioId, data.adjuntos);
        this._toast.success('Anuncio publicado' + (sub.ok > 0 ? ' (' + sub.ok + ' adjunto(s))' : ''));
        if (sub.fail > 0) this._toast.warning(sub.fail + ' adjunto(s) no se pudieron guardar.');
        await this._load(); this.render();
      }
      else { this._toast.error('Error', (r && r.error && r.error.message || 'desconocido')); }
    } catch (e) { this._toast.error('Error', e.message); }
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
      if (r && r.success) { this._toast.success('Anuncio eliminado'); await this._load(); this.render(); }
      else { this._toast.error('Error', (r && r.error && r.error.message || 'desconocido')); }
    } catch (e) { this._toast.error('Error', e.message); }
  }

  async _showMensajeDialog() {
    if (this.trabajadores.length === 0) { this._toast.warning('No hay trabajadores.'); return; }
    var self = this;
    var choices = this.trabajadores
      .slice()
      .sort(function (a, b) { return ((a.nombres || '') + ' ' + (a.apellidos || '')).localeCompare((b.nombres || '') + ' ' + (b.apellidos || '')); })
      .map(function (t) { return { value: t.id, label: (t.nombres + ' ' + t.apellidos + (t.cedula ? ' · CC ' + t.cedula : '')) }; });
    var data = await this._confirmDialog().input({
      title: 'Nuevo Mensaje (remitente: RRHH)',
      fields: [
        { name: 'destinatarioId', label: 'Destinatario', type: 'select', required: true, options: choices },
        { name: 'prioridad', label: 'Prioridad', type: 'select', required: true, default: 'normal',
          options: [{ value: 'baja', label: 'Baja' }, { value: 'normal', label: 'Normal' }, { value: 'alta', label: 'Alta' }] },
        { name: 'asunto', label: 'Asunto', type: 'text', required: true },
        { name: 'contenido', label: 'Contenido', type: 'textarea', required: true, rows: 6 },
        { name: 'adjuntos', label: 'Archivos adjuntos (opcional)', type: 'file', multiple: true }
      ]
    });
    if (!data) return;
    try {
      var r = await window.electronAPI.ghCreateMensaje({
        companyName: this.companyName,
        data: { destinatarioId: data.destinatarioId, asunto: data.asunto, contenido: data.contenido, remitenteId: 'RRHH', prioridad: data.prioridad || 'normal' }
      });
      if (r && r.success) {
        var sub2 = await this._subirAdjuntosCom('mensaje', r.data.mensajeId, data.adjuntos);
        this._toast.success('Mensaje guardado' + (sub2.ok > 0 ? ' (' + sub2.ok + ' adjunto(s))' : ''));
        if (sub2.fail > 0) this._toast.warning(sub2.fail + ' adjunto(s) no se pudieron guardar.');
        await this._load(); this.render();
      }
      else { this._toast.error('Error', (r && r.error && r.error.message || 'desconocido')); }
    } catch (e) { this._toast.error('Error', e.message); }
  }

  // Destinatarios del anuncio: activos (no retirados), con correo, según dirigido_a
  _destinatariosAnuncio(a) {
    var self = this;
    var normEst = function (e) {
      var s = String(e || '').toLowerCase();
      if (s === 'r' || s === 'ret' || s === 'retirado') return 'retirado';
      return s;
    };
    return this.trabajadores.filter(function (t) {
      if (!t.email || !String(t.email).trim()) return false;
      if (normEst(t.estado) === 'retirado') return false;
      if (a.dirigidoA === 'sede' && a.sedeId && t.sedeId !== a.sedeId) return false;
      if (a.dirigidoA === 'cargo' && a.cargoFiltro && t.cargo !== a.cargoFiltro) return false;
      return true;
    }).map(function (t) { return { id: t.id, email: String(t.email).trim(), nombre: ((t.nombres || '') + ' ' + (t.apellidos || '')).trim() }; });
  }

  _gmailApi() {
    if (typeof window === 'undefined') return null;
    var api = window.electronAPI || null;
    if (!api || !api.googleGmail || !api.googleGmail.sendMessage) return null;
    return api;
  }
  _esRetirado(estado) {
    var s = String(estado || '').toLowerCase();
    return s === 'r' || s === 'ret' || s === 'retirado';
  }
  _buildAnuncioEmail(a) {
    return {
      subject: '[Anuncio] ' + a.titulo,
      body: a.titulo + '\n\n' + (a.contenido || '') +
        '\n\n—\n' + 'Publicado por ' + (a.publicadoPor || 'RRHH') +
        (a.fechaPublicacion ? ' · ' + a.fechaPublicacion : '')
    };
  }
  _buildMensajeEmail(m, destNombre) {
    return {
      subject: '[RRHH] ' + (m.asunto || '(sin asunto)'),
      body: 'Hola ' + (destNombre || '') + ',\n\n' + (m.contenido || '') +
        '\n\n—\nRecursos Humanos'
    };
  }
  async _cuentaGmailConectada() {
    try {
      var api = this._gmailApi();
      if (!api) return '';
      var p = await api.googleGmail.getProfile();
      if (p && p.success && p.data && p.data.email) return p.data.email;
      if (p && p.data && p.data.email) return p.data.email;
    } catch (e) { /* sin cuenta detectable */ }
    return '';
  }

  // Lee archivos del input a base64 para adjuntos de Gmail (límite total 25 MB)
  _leerAdjuntos(input) {
    var files = (input && input.files) ? Array.prototype.slice.call(input.files) : [];
    var total = files.reduce(function (acc, f) { return acc + (f.size || 0); }, 0);
    if (total > 25 * 1024 * 1024) return Promise.reject(new Error('Adjuntos superan 25 MB en total.'));
    return Promise.all(files.map(function (file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          var parts = String(reader.result || '').split(',');
          resolve({ name: file.name, mimeType: file.type || 'application/octet-stream', data: parts.length > 1 ? parts[1] : reader.result });
        };
        reader.onerror = function () { reject(reader.error || new Error('No se pudo leer ' + file.name)); };
        reader.readAsDataURL(file);
      });
    }));
  }

  // Vista previa: muestra lo exacto que recibiría el trabajador, sin enviar nada.
  // adjCtx = { tipo, referenciaId } para mostrar/borrar/enviar los adjuntos guardados.
  async _vistaPrevia(titulo, paraHtml, subject, body, onProbar, onProducir, adjCtx) {
    var self = this;
    if (document.getElementById('cm-preview-backdrop')) return;
    var cuenta = await this._cuentaGmailConectada();
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="cm-preview-backdrop" style="position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;">' +
        '<div style="background:#fff;border-radius:0.75rem;max-width:620px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.25);">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid #e9ecef;">' +
            '<strong style="font-size:1rem;color:#1a1a2e;">' + self._escHtml(titulo) + '</strong>' +
            '<button type="button" id="cm-preview-close" style="border:none;background:transparent;font-size:1.25rem;cursor:pointer;color:#5a6378;">×</button>' +
          '</div>' +
          '<div style="padding:1rem 1.25rem;overflow-y:auto;">' +
            '<div style="font-size:0.78rem;color:#5a6378;margin-bottom:0.5rem;"><strong>Para:</strong> ' + paraHtml + '</div>' +
            '<div style="font-size:0.78rem;color:#5a6378;margin-bottom:0.25rem;"><strong>Asunto:</strong> ' + self._escHtml(subject) + '</div>' +
            '<div style="border:1px solid #e9ecef;border-radius:0.5rem;padding:0.75rem;background:#f8f9fa;font-size:0.82rem;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;color:#1a1a2e;max-height:320px;overflow-y:auto;">' + self._escHtml(body) + '</div>' +
            '<div style="margin-top:0.75rem;font-size:0.78rem;color:#5a6378;"><strong><i class="fas fa-paperclip"></i> Adjuntos</strong> ' +
              '<input type="file" id="cm-preview-files" multiple style="font-size:0.75rem;" />' +
              '<div id="cm-preview-stored" style="font-size:0.75rem;margin-top:0.25rem;"></div>' +
              '<div id="cm-preview-filelist" style="font-size:0.72rem;margin-top:0.2rem;"></div></div>' +
            '<div style="display:flex;gap:0.5rem;margin-top:0.75rem;align-items:center;flex-wrap:wrap;">' +
              '<input type="text" id="cm-preview-testmail" value="' + self._escHtml(cuenta) + '" placeholder="Correo para la prueba" style="flex:1;min-width:200px;padding:0.45rem 0.6rem;border:1px solid #dee2e6;border-radius:0.4rem;font-size:0.8rem;" />' +
              '<button type="button" id="cm-preview-sendtest" class="cm-btn cm-btn--primary"><i class="fas fa-vial"></i> Enviar prueba</button>' +
              (onProducir ? '<button type="button" id="cm-preview-sendprod" class="cm-btn cm-btn--primary" style="background:#28a745;border-color:#28a745;"><i class="fas fa-paper-plane"></i> Enviar producción</button>' : '') +
            '</div>' +
            '<div style="font-size:0.72rem;color:#5a6378;margin-top:0.4rem;">La prueba llega <strong>SOLO</strong> a ese correo y queda anotada como PRUEBA. Ningún trabajador recibe nada.</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    var backdrop = wrap.firstChild;
    document.body.appendChild(backdrop);
    var close = function () { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };
    backdrop.querySelector('#cm-preview-close').onclick = close;
    backdrop.onclick = function (e) { if (e.target === backdrop) close(); };
    var filesInput = backdrop.querySelector('#cm-preview-files');
    var filesList = backdrop.querySelector('#cm-preview-filelist');
    var storedZone = backdrop.querySelector('#cm-preview-stored');
    var apiPrev = (typeof window !== 'undefined') ? (window.electronAPI || null) : null;
    filesInput.onchange = function () {
      var names = [];
      for (var i = 0; i < filesInput.files.length; i++) names.push(self._escHtml(filesInput.files[i].name));
      filesList.innerHTML = names.length ? names.join('<br>') : '';
    };
    var pintarGuardados = function (lista) {
      if (!storedZone) return;
      storedZone.innerHTML = (lista || []).map(function (g) {
        var kb = g.tamanoBytes ? Math.max(1, Math.round(g.tamanoBytes / 1024)) : 0;
        return '<div data-stored-adj="' + self._escHtml(g.id) + '"><i class="fas fa-paperclip"></i> ' +
          self._escHtml(g.nombreArchivo) + ' (' + kb + ' KB) ' +
          '<button type="button" data-del-adj="' + self._escHtml(g.id) + '" title="Quitar" style="border:none;background:transparent;cursor:pointer;color:#dc3545;">✕</button></div>';
      }).join('');
      storedZone.querySelectorAll('button[data-del-adj]').forEach(function (b) {
        b.onclick = function () {
          var aid = b.getAttribute('data-del-adj');
          if (!apiPrev || !apiPrev.ghEliminarAdjuntoCom) return;
          apiPrev.ghEliminarAdjuntoCom({ adjuntoId: aid }).then(function (r) {
            if (r && r.success) { self._toast.success('Adjunto quitado'); recargarGuardados(); }
            else self._toast.error('Error', ((r && r.error && r.error.message) || 'desconocido'));
          });
        };
      });
    };
    var guardadosCache = [];
    var recargarGuardados = function () {
      if (!adjCtx || !apiPrev || !apiPrev.ghListarAdjuntosCom) { pintarGuardados([]); return; }
      apiPrev.ghListarAdjuntosCom({ companyName: self.companyName, tipo: adjCtx.tipo, referenciaId: adjCtx.referenciaId }).then(function (r) {
        guardadosCache = (r && r.success && r.data && r.data.adjuntos) || [];
        pintarGuardados(guardadosCache);
      }).catch(function () { pintarGuardados([]); });
    };
    recargarGuardados();
    // Une guardados (leyendo bytes) + elegidos ahora. Límite total 25 MB.
    var conAdjuntos = function (fn) {
      var totalNuevos = 0;
      for (var i = 0; i < filesInput.files.length; i++) totalNuevos += filesInput.files[i].size || 0;
      var totalGuardados = guardadosCache.reduce(function (acc, g) { return acc + (g.tamanoBytes || 0); }, 0);
      if (totalNuevos + totalGuardados > 25 * 1024 * 1024) {
        self._toast.warning('Adjuntos superan 25 MB en total.');
        return;
      }
      var leidos = guardadosCache.map(function (g) {
        return apiPrev.ghLeerAdjuntoCom({ adjuntoId: g.id }).then(function (r) {
          if (r && r.success && r.data && r.data.base64) {
            return { name: r.data.nombre, mimeType: r.data.mimeType || 'application/octet-stream', data: r.data.base64 };
          }
          return null;
        }).catch(function () { return null; });
      });
      Promise.all(leidos).then(function (desdeDisco) {
        self._leerAdjuntos(filesInput).then(function (nuevos) {
          var todos = desdeDisco.filter(function (x) { return x; }).concat(nuevos);
          fn(todos);
        }).catch(function (e) { self._toast.warning(e.message); });
      });
    };
    backdrop.querySelector('#cm-preview-sendtest').onclick = function () {
      var mail = backdrop.querySelector('#cm-preview-testmail').value.trim();
      if (!mail) { self._toast.warning('Escribí el correo de prueba.'); return; }
      var btn = this;
      btn.disabled = true;
      conAdjuntos(function (adj) { onProbar(mail, close, adj); btn.disabled = false; });
    };
    var prodBtn = backdrop.querySelector('#cm-preview-sendprod');
    if (prodBtn && onProducir) {
      prodBtn.onclick = function () {
        var btn = this;
        btn.disabled = true;
        conAdjuntos(function (adj) { onProducir(adj, close); btn.disabled = false; });
      };
    }
  }

  async _vistaPreviaAnuncio(id) {
    var self = this;
    var a = this.anuncios.find(function (x) { return x.id === id; });
    if (!a) return;
    var dests = this._destinatariosAnuncio(a);
    var em = this._buildAnuncioEmail(a);
    var para = dests.length + ' trabajador(es) con correo' +
      (dests.length > 0 ? ' (ej: ' + self._escHtml(dests.slice(0, 3).map(function (d) { return d.email; }).join(', ')) + (dests.length > 3 ? ', …' : '') + ')' : '');
    this._vistaPrevia('Vista previa — Anuncio', para, em.subject, em.body, function (mail, close, adj) {
      self._enviarPrueba('anuncio', a.id, em.subject, em.body, mail, close, adj);
    }, function (adj, close) {
      self._enviarAnuncio(a.id, null, adj).then(function () { close(); });
    }, { tipo: 'anuncio', referenciaId: a.id });
  }

  async _vistaPreviaMensaje(id) {
    var self = this;
    var m = this.mensajes.find(function (x) { return x.id === id; });
    if (!m) return;
    var t = this._trabajadorById[m.destinatarioId] || {};
    var nombre = ((t.nombres || '') + ' ' + (t.apellidos || '')).trim() || '(sin datos)';
    var em = this._buildMensajeEmail(m, (t.nombres || '').trim());
    var para = self._escHtml(nombre) + (t.email ? ' &lt;' + self._escHtml(t.email) + '&gt;' : ' (sin correo registrado)');
    this._vistaPrevia('Vista previa — Mensaje', para, em.subject, em.body, function (mail, close, adj) {
      self._enviarPrueba('mensaje', m.id, em.subject, em.body, mail, close, adj);
    }, function (adj, close) {
      self._enviarMensajeCorreo(m.id, null, adj).then(function () { close(); });
    }, { tipo: 'mensaje', referenciaId: m.id });
  }

  // Prueba: un solo correo, anotado en bitácora con marca PRUEBA
  async _enviarPrueba(tipo, referenciaId, subject, body, testEmail, close, attachments) {
    var api = this._gmailApi();
    if (!api) { this._toast.warning('Gmail no disponible', 'Conectá Gmail en Configuración para enviar.'); return; }
    var adj = attachments && attachments.length ? attachments : undefined;
    try {
      var r = await api.googleGmail.sendMessage({ to: testEmail, subject: subject, body: body, attachments: adj });
      try {
        await api.ghRegistrarEnvios({ companyName: this.companyName, envios: [{
          tipo: tipo, referenciaId: referenciaId, canal: 'email', destinatarioId: null, destino: testEmail,
          estado: (r && r.success) ? 'enviado' : 'fallido',
          detalle: 'PRUEBA - ' + ((r && r.success) ? (r.messageId || r.data || 'ok') : ((r && r.error) || 'desconocido'))
        }] });
      } catch (e) { console.warn('[Comunicacion] no se pudo registrar prueba:', e.message); }
      if (r && r.success) {
        this._toast.success('Prueba enviada', 'Revisá la bandeja de ' + testEmail);
        if (close) close();
      } else {
        this._toast.error('No se pudo enviar la prueba', ((r && r.error) || 'Conectá Gmail en Configuración.'));
      }
    } catch (e) {
      this._toast.error('Error', e.message);
    }
  }

  // Historial de envíos: qué se mandó, a quién, cuándo y cómo terminó
  _verHistorial(tipo, referenciaId) {
    var self = this;
    var lista = (this._enviosDetalle && this._enviosDetalle[referenciaId]) || [];
    var titulo = tipo === 'anuncio' ? 'Historial de envíos — Anuncio' : 'Historial de envíos — Mensaje';
    var filas = lista.map(function (e) {
      var esPrueba = e.detalle && String(e.detalle).indexOf('PRUEBA') === 0;
      var fecha = String(e.created_at || '').slice(0, 16).replace('T', ' ');
      var estHtml = e.estado === 'enviado'
        ? '<span class="cm-mensaje__badge"><i class="fas fa-check"></i> Enviado</span>'
        : '<span class="cm-mensaje__badge" style="background:#f8d7da;color:#721c24;">Fallido</span>';
      return '<tr>' +
        '<td style="padding:0.4rem 0.5rem;border-top:1px solid #f1f3f5;">' + fecha + '</td>' +
        '<td style="padding:0.4rem 0.5rem;border-top:1px solid #f1f3f5;">' + self._escHtml(e.destino || '—') + '</td>' +
        '<td style="padding:0.4rem 0.5rem;border-top:1px solid #f1f3f5;">' + self._escHtml(e.canal || '') + (esPrueba ? ' · prueba' : '') + '</td>' +
        '<td style="padding:0.4rem 0.5rem;border-top:1px solid #f1f3f5;">' + estHtml + '</td>' +
      '</tr>';
    }).join('');
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div style="position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;">' +
        '<div style="background:#fff;border-radius:0.75rem;max-width:640px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.25);">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid #e9ecef;">' +
            '<strong style="font-size:1rem;color:#1a1a2e;">' + titulo + ' (' + lista.length + ')</strong>' +
            '<button type="button" id="cm-hist-close" style="border:none;background:transparent;font-size:1.25rem;cursor:pointer;color:#5a6378;">×</button>' +
          '</div>' +
          '<div style="padding:1rem 1.25rem;overflow-y:auto;">' +
            (lista.length === 0
              ? '<div style="font-size:0.82rem;color:#5a6378;">Sin envíos registrados todavía. Si ya enviaste y no aparece nada, cerrá la app por completo y volvé a abrirla.</div>'
              : '<table style="width:100%;border-collapse:collapse;font-size:0.78rem;"><thead><tr>' +
                '<th style="text-align:left;padding:0.4rem 0.5rem;color:#5a6378;">Fecha</th>' +
                '<th style="text-align:left;padding:0.4rem 0.5rem;color:#5a6378;">Destino</th>' +
                '<th style="text-align:left;padding:0.4rem 0.5rem;color:#5a6378;">Canal</th>' +
                '<th style="text-align:left;padding:0.4rem 0.5rem;color:#5a6378;">Estado</th>' +
                '</tr></thead><tbody>' + filas + '</tbody></table>') +
          '</div>' +
        '</div>' +
      '</div>';
    var backdrop = wrap.firstChild;
    document.body.appendChild(backdrop);
    var close = function () { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };
    backdrop.querySelector('#cm-hist-close').onclick = close;
    backdrop.onclick = function (e) { if (e.target === backdrop) close(); };
  }

  async _enviarAnuncio(id, btn, attachments) {
    var self = this;
    var adj = attachments && attachments.length ? attachments : undefined;
    var a = this.anuncios.find(function (x) { return x.id === id; });
    if (!a) { this._toast.error('Anuncio no encontrado'); return; }
    var api = this._gmailApi();
    if (!api) {
      this._toast.warning('Gmail no disponible', 'Conectá Gmail en Configuración para enviar.');
      return;
    }
    var dests = this._destinatariosAnuncio(a);
    var sinCorreo = this.trabajadores.filter(function (t) {
      var s = String(t.estado || '').toLowerCase();
      if (s === 'r' || s === 'ret' || s === 'retirado') return false;
      if (!t.email || !String(t.email).trim()) {
        if (a.dirigidoA === 'sede' && a.sedeId && t.sedeId !== a.sedeId) return false;
        if (a.dirigidoA === 'cargo' && a.cargoFiltro && t.cargo !== a.cargoFiltro) return false;
        return true;
      }
      return false;
    }).length;
    if (dests.length === 0) {
      this._toast.warning('Sin destinatarios', sinCorreo > 0 ? (sinCorreo + ' sin correo registrado.') : 'Nadie coincide con el destino.');
      return;
    }
    var ok = await this._confirmDialog().confirm({
      title: 'Enviar anuncio por correo',
      message: 'Se enviará "' + a.titulo + '" a ' + dests.length + ' trabajador(es) con correo.' + (sinCorreo > 0 ? ' ' + sinCorreo + ' sin correo quedarán fuera.' : ''),
      confirmText: 'Enviar',
      cancelText: 'Cancelar',
      type: 'info'
    });
    if (!ok) return;
    if (btn) { btn.disabled = true; }
    try {
      var em = this._buildAnuncioEmail(a);
      var subject = em.subject;
      var body = em.body;
      var to = dests[0].email;
      var bcc = dests.slice(1).map(function (d) { return d.email; });
      var r = await api.googleGmail.sendMessage({ to: to, bcc: bcc.length ? bcc : undefined, subject: subject, body: body, attachments: adj });
      var adjTag = adj ? ' +' + adj.length + ' adj' : '';
      var logs = dests.map(function (d) {
        return { tipo: 'anuncio', referenciaId: a.id, canal: 'email', destinatarioId: d.id, destino: d.email,
          estado: (r && r.success) ? 'enviado' : 'fallido',
          detalle: ((r && r.success) ? (r.messageId || r.data || 'ok') : ((r && r.error) || 'desconocido')) + adjTag };
      });
      var bitacoraOk = true;
      try {
        var rr = await api.ghRegistrarEnvios({ companyName: self.companyName, envios: logs });
        if (!rr || !rr.success) bitacoraOk = false;
      } catch (e) { console.warn('[Comunicacion] no se pudo registrar envíos:', e.message); bitacoraOk = false; }
      if (r && r.success) {
        this._toast.success('Anuncio enviado', dests.length + ' correos' + (sinCorreo > 0 ? ' · ' + sinCorreo + ' sin correo' : ''));
        if (!bitacoraOk) this._toast.warning('Sin bitácora', 'Cerrá la app por completo y volvé a abrirla para activar el registro.');
        await self._load();
        self.render();
      } else {
        this._toast.error('No se pudo enviar', ((r && r.error) || 'Conectá Gmail en Configuración.'));
      }
    } catch (e) {
      this._toast.error('Error', e.message);
    } finally {
      if (btn) { btn.disabled = false; }
    }
  }

  // Producción específica: un mensaje al correo de su destinatario
  async _enviarMensajeCorreo(id, btn, attachments) {
    var adj = attachments && attachments.length ? attachments : undefined;
    var m = this.mensajes.find(function (x) { return x.id === id; });
    if (!m) { this._toast.error('Mensaje no encontrado'); return; }
    var t = this._trabajadorById[m.destinatarioId] || {};
    var nombre = ((t.nombres || '') + ' ' + (t.apellidos || '')).trim();
    if (!t.id) { this._toast.warning('Destinatario no encontrado en Base Personal.'); return; }
    if (this._esRetirado(t.estado)) { this._toast.warning('Trabajador retirado: no se puede enviar.'); return; }
    if (!t.email || !String(t.email).trim()) { this._toast.warning('Sin correo registrado', 'Cargá el correo en Base Personal.'); return; }
    var api = this._gmailApi();
    if (!api) { this._toast.warning('Gmail no disponible', 'Conectá Gmail en Configuración para enviar.'); return; }
    var dest = String(t.email).trim();
    var ok = await this._confirmDialog().confirm({
      title: 'Enviar mensaje por correo',
      message: 'Se enviará a ' + nombre + ' <' + dest + '>.',
      confirmText: 'Enviar',
      cancelText: 'Cancelar',
      type: 'info'
    });
    if (!ok) return;
    if (btn) { btn.disabled = true; }
    try {
      var em = this._buildMensajeEmail(m, (t.nombres || '').trim());
      var r = await api.googleGmail.sendMessage({ to: dest, subject: em.subject, body: em.body, attachments: adj });
      var bitacoraOk = true;
      try {
        var rr2 = await api.ghRegistrarEnvios({ companyName: this.companyName, envios: [{
          tipo: 'mensaje', referenciaId: m.id, canal: 'email', destinatarioId: t.id, destino: dest,
          estado: (r && r.success) ? 'enviado' : 'fallido',
          detalle: (r && r.success) ? (r.messageId || r.data || null) : ((r && r.error) || 'desconocido')
        }] });
        if (!rr2 || !rr2.success) bitacoraOk = false;
      } catch (e) { console.warn('[Comunicacion] no se pudo registrar envío:', e.message); bitacoraOk = false; }
      if (r && r.success) {
        this._toast.success('Mensaje enviado', 'Para ' + (nombre || dest));
        if (!bitacoraOk) this._toast.warning('Sin bitácora', 'Cerrá la app por completo y volvé a abrirla para activar el registro.');
        await this._load();
        this.render();
      } else {
        this._toast.error('No se pudo enviar', ((r && r.error) || 'Conectá Gmail en Configuración.'));
      }
    } catch (e) {
      this._toast.error('Error', e.message);
    } finally {
      if (btn) { btn.disabled = false; }
    }
  }

  async _marcarLeido(id) {
    try {
      var r = await window.electronAPI.ghMarcarLeido({ mensajeId: id });
      if (r && r.success) { this._toast.success('Mensaje marcado como leído'); await this._load(); this.render(); }
      else { this._toast.error('Error', (r && r.error && r.error.message || 'desconocido')); }
    } catch (e) { this._toast.error('Error', e.message); }
  }

  destroy() { /* noop */ }
}

window.ComunicacionComponent = ComunicacionComponent;
