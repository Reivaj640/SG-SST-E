// modules/gestion-humana/comunicacion/index.js
// 📦710 · Comunicación (v0.2.0) — UI completa
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
    this.tab = 'anuncios';
    this.loading = true;
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
      this._trabajadorById = {};
      this.trabajadores.forEach(function (t) { this._trabajadorById[t.id] = t; }.bind(this));
      this._sedeById = {};
      this.sedes.forEach(function (s) { this._sedeById[s.id] = s; }.bind(this));
    } catch (e) {
      this._showToast('Error cargando: ' + e.message, 'error');
    }
    this.loading = false;
  }

  _kpis() {
    var a = this.anuncios.filter(function (x) { return x.activo; });
    return {
      anunciosActivos: a.length,
      urgentes:        a.filter(function (x) { return x.tipo === 'urgente'; }).length,
      mensajesRecibidos: this.mensajes.length,
      mensajesEnviados: 0  // Por simplicidad, todos los mensajes están en un solo listado
    };
  }

  render() {
    var self = this;
    this.container.innerHTML = '';
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding:0; height:100%; overflow-y:auto; background:#f8f9fa;';

    if (this.loading) {
      wrapper.innerHTML = '<div style="padding:3rem; text-align:center; color:#5a6378;"><i class="fas fa-spinner fa-spin"></i> Cargando…</div>';
      this.container.appendChild(wrapper);
      this._load().then(function () { self.render(); });
      return;
    }

    var k = this._kpis();
    wrapper.appendChild(this._renderKpiStrip(k));

    // Tabs
    var tabs = document.createElement('div');
    tabs.style.cssText = 'display:flex; gap:1rem; padding:0.875rem 1.5rem 0; background:white; border-bottom:1px solid #e9ecef;';
    tabs.innerHTML =
      '<button data-tab="anuncios" style="background:transparent; border:none; padding:0.5rem 0.875rem; cursor:pointer; font-size:0.9rem; font-weight:' + (this.tab === 'anuncios' ? '600' : '500') + '; color:' + (this.tab === 'anuncios' ? '#174ea6' : '#5a6378') + '; border-bottom:2px solid ' + (this.tab === 'anuncios' ? '#174ea6' : 'transparent') + ';"><i class="fas fa-bullhorn"></i> Anuncios (' + k.anunciosActivos + ')</button>' +
      '<button data-tab="mensajes" style="background:transparent; border:none; padding:0.5rem 0.875rem; cursor:pointer; font-size:0.9rem; font-weight:' + (this.tab === 'mensajes' ? '600' : '500') + '; color:' + (this.tab === 'mensajes' ? '#174ea6' : '#5a6378') + '; border-bottom:2px solid ' + (this.tab === 'mensajes' ? '#174ea6' : 'transparent') + ';"><i class="fas fa-envelope"></i> Mensajes (' + k.mensajesRecibidos + ')</button>';
    wrapper.appendChild(tabs);

    if (this.tab === 'anuncios') {
      wrapper.appendChild(this._renderAnuncios());
    } else {
      wrapper.appendChild(this._renderMensajes());
    }

    this.container.appendChild(wrapper);

    this.container.querySelectorAll('button[data-tab]').forEach(function (b) {
      b.onclick = function () { self.tab = b.getAttribute('data-tab'); self.render(); };
    });
  }

  _renderKpiStrip(k) {
    var bar = document.createElement('div');
    bar.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0; background:white; border-bottom:1px solid #e9ecef;';
    var items = [
      { value: k.anunciosActivos,   label: 'ANUNCIOS ACTIVOS', color: '#174ea6', icon: 'fa-bullhorn' },
      { value: k.urgentes,          label: 'URGENTES',         color: '#dc3545', icon: 'fa-exclamation-circle' },
      { value: k.mensajesRecibidos, label: 'MENSAJES RECIBIDOS', color: '#0d9488', icon: 'fa-inbox' },
      { value: k.mensajesEnviados,  label: 'MENSAJES ENVIADOS', color: '#28a745', icon: 'fa-paper-plane' }
    ];
    items.forEach(function (i, idx) {
      bar.innerHTML +=
        '<div style="padding:1rem 1.25rem; display:flex; align-items:center; gap:0.625rem; ' + (idx > 0 ? 'border-left:1px solid #e9ecef;' : '') + '">' +
          '<div style="width:36px; height:36px; border-radius:50%; background:' + i.color + '22; color:' + i.color + '; display:flex; align-items:center; justify-content:center;">' +
            '<i class="fas ' + i.icon + '"></i>' +
          '</div>' +
          '<div>' +
            '<div style="font-size:1.5rem; font-weight:700; color:#1a1a2e; line-height:1;">' + i.value + '</div>' +
            '<div style="font-size:0.65rem; color:#5a6378; letter-spacing:0.4px; margin-top:0.2rem;">' + i.label + '</div>' +
          '</div>' +
        '</div>';
    });
    return bar;
  }

  // === ANUNCIOS ===
  _renderAnuncios() {
    var self = this;
    var wrap = document.createElement('div');
    wrap.style.cssText = 'padding:1rem 1.5rem 1.5rem;';
    var head = document.createElement('div');
    head.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:0.875rem;';
    head.innerHTML =
      '<div>' +
        '<h2 style="margin:0; font-size:1.05rem; color:#1a1a2e;">Tablón de Anuncios</h2>' +
        '<p style="margin:0.125rem 0 0; font-size:0.75rem; color:#5a6378;">Comunicación oficial a trabajadores por sede, cargo o general</p>' +
      '</div>' +
      '<button id="anun-nuevo" style="background:#174ea6; color:white; border:none; padding:0.5rem 0.875rem; border-radius:0.4rem; cursor:pointer; font-size:0.8125rem; font-weight:500; display:inline-flex; align-items:center; gap:0.4rem;">' +
        '<i class="fas fa-plus"></i> Nuevo Anuncio' +
      '</button>';
    wrap.appendChild(head);

    if (this.anuncios.length === 0) {
      wrap.appendChild(this._emptyState('No hay anuncios. Crea el primero con "Nuevo Anuncio".'));
      return wrap;
    }

    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(360px, 1fr)); gap:0.875rem;';
    this.anuncios.filter(function (a) { return a.activo; }).forEach(function (a) {
      var tm = ComunicacionComponent.TIPOS_ANUNCIO.find(function (t) { return t.value === a.tipo; }) || { label: a.tipo, color: '#5a6378', icon: 'fa-bullhorn' };
      var dirigidoLabel = a.dirigidoA === 'todos' ? 'Todos' : a.dirigidoA === 'sede' ? 'Sede: ' + (self._sedeById[a.sedeId] ? self._sedeById[a.sedeId].nombre : '—') : a.dirigidoA === 'cargo' ? 'Cargo: ' + (a.cargoFiltro || '—') : a.dirigidoA;
      var card = document.createElement('div');
      card.style.cssText = 'background:white; border:1px solid #e9ecef; border-radius:0.5rem; padding:1rem 1.125rem; transition:box-shadow 0.2s; position:relative;';
      card.onmouseenter = function () { card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; };
      card.onmouseleave = function () { card.style.boxShadow = ''; };
      card.innerHTML =
        '<div style="display:flex; align-items:flex-start; gap:0.625rem; margin-bottom:0.5rem;">' +
          '<div style="width:32px; height:32px; border-radius:0.4rem; background:' + tm.color + '22; color:' + tm.color + '; display:flex; align-items:center; justify-content:center; flex-shrink:0;">' +
            '<i class="fas ' + tm.icon + '"></i>' +
          '</div>' +
          '<div style="flex:1; min-width:0;">' +
            '<div style="font-size:0.95rem; font-weight:600; color:#1a1a2e;">' + a.titulo + '</div>' +
          '</div>' +
          '<span style="background:' + tm.color + '22; color:' + tm.color + '; padding:0.15rem 0.5rem; border-radius:0.875rem; font-size:0.65rem; font-weight:600;">' + tm.label + '</span>' +
        '</div>' +
        '<div style="font-size:0.7rem; color:#5a6378; margin-bottom:0.5rem; display:flex; gap:0.75rem; flex-wrap:wrap;">' +
          '<span><i class="fas fa-users"></i> ' + dirigidoLabel + '</span>' +
          '<span><i class="fas fa-user"></i> Por ' + (a.publicadoPor || '—') + '</span>' +
          '<span><i class="fas fa-calendar"></i> ' + (a.fechaPublicacion || '—') + '</span>' +
        '</div>' +
        '<p style="margin:0; font-size:0.8125rem; color:#1a1a2e; line-height:1.5; max-height:6.5em; overflow:hidden;">' + a.contenido + '</p>' +
        '<div style="margin-top:0.625rem; padding-top:0.5rem; border-top:1px solid #f1f3f5; text-align:right;">' +
          '<button data-eliminar="' + a.id + '" style="background:transparent; border:none; color:#dc3545; cursor:pointer; padding:0.25rem 0.4rem; font-size:0.8rem;"><i class="fas fa-times"></i> Eliminar</button>' +
        '</div>';
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    var btnNuevo = document.getElementById('anun-nuevo');
    if (btnNuevo) btnNuevo.onclick = function () { self._showAnuncioDialog(); };
    setTimeout(function () {
      self.container.querySelectorAll('button[data-eliminar]').forEach(function (b) {
        b.onclick = function () { self._eliminarAnuncio(b.getAttribute('data-eliminar')); };
      });
    }, 0);
    return wrap;
  }

  async _showAnuncioDialog() {
    var self = this;
    var data = await this._confirmDialog().input({
      title: 'Nuevo Anuncio',
      fields: [
        { name: 'titulo', label: 'Título', type: 'text', required: true },
        { name: 'tipo', label: 'Tipo', type: 'select', required: true, default: 'info',
          options: ComunicacionComponent.TIPOS_ANUNCIO.map(function (t) { return { value: t.value, label: t.label }; })
        },
        { name: 'contenido', label: 'Contenido', type: 'textarea', required: true },
        { name: 'dirigidoA', label: 'Dirigido a', type: 'select', required: true, default: 'todos',
          options: [
            { value: 'todos', label: 'Todos' },
            { value: 'sede', label: 'Sede específica' },
            { value: 'cargo', label: 'Cargo específico' }
          ]
        },
        { name: 'sedeId', label: 'Sede (si dirigido a sede)', type: 'select', required: false,
          options: this.sedes.map(function (s) { return { value: s.id, label: s.nombre }; })
        },
        { name: 'cargoFiltro', label: 'Cargo (si dirigido a cargo)', type: 'text', required: false }
      ]
    });
    if (!data) return;
    try {
      var r = await window.electronAPI.ghCreateAnuncio({
        companyName: this.companyName,
        data: {
          titulo: data.titulo,
          tipo: data.tipo,
          contenido: data.contenido,
          dirigidoA: data.dirigidoA,
          sedeId: data.dirigidoA === 'sede' ? data.sedeId : null,
          cargoFiltro: data.dirigidoA === 'cargo' ? data.cargoFiltro : null,
          fechaPublicacion: new Date().toISOString().split('T')[0],
          publicadoPor: (window.currentUser && window.currentUser.nombre) || 'Recursos Humanos'
        }
      });
      if (r && r.success) {
        this._showToast('Anuncio publicado', 'success');
        await this._load(); this.render();
      } else {
        this._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  async _eliminarAnuncio(id) {
    var ok = await this._confirmDialog().confirm('¿Eliminar este anuncio?', { title: 'Eliminar anuncio', okText: 'Sí, eliminar', okType: 'danger' });
    if (!ok) return;
    try {
      var r = await window.electronAPI.ghDeleteAnuncio({ anuncioId: id });
      if (r && r.success) {
        this._showToast('Anuncio eliminado', 'success');
        await this._load(); this.render();
      } else {
        this._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  // === MENSAJES ===
  _renderMensajes() {
    var self = this;
    var wrap = document.createElement('div');
    wrap.style.cssText = 'padding:1rem 1.5rem 1.5rem;';
    var head = document.createElement('div');
    head.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:0.875rem;';
    head.innerHTML =
      '<div>' +
        '<h2 style="margin:0; font-size:1.05rem; color:#1a1a2e;">Mensajes</h2>' +
        '<p style="margin:0.125rem 0 0; font-size:0.75rem; color:#5a6378;">Mensajes directos entre trabajadores</p>' +
      '</div>' +
      '<button id="msg-nuevo" style="background:#174ea6; color:white; border:none; padding:0.5rem 0.875rem; border-radius:0.4rem; cursor:pointer; font-size:0.8125rem; font-weight:500; display:inline-flex; align-items:center; gap:0.4rem;">' +
        '<i class="fas fa-plus"></i> Nuevo Mensaje' +
      '</button>';
    wrap.appendChild(head);

    if (this.mensajes.length === 0) {
      wrap.appendChild(this._emptyState('No hay mensajes aún. Envía el primero con "Nuevo Mensaje".'));
      return wrap;
    }

    var card = document.createElement('div');
    card.style.cssText = 'background:white; border:1px solid #e9ecef; border-radius:0.5rem; overflow:hidden;';
    var list = document.createElement('div');
    list.style.cssText = '';
    this.mensajes.forEach(function (m) {
      var rem = self._trabajadorById[m.remitenteId];
      var dest = self._trabajadorById[m.destinatarioId];
      var prioridadColor = m.prioridad === 'alta' ? '#dc3545' : m.prioridad === 'baja' ? '#5a6378' : '#174ea6';
      var row = document.createElement('div');
      row.style.cssText = 'padding:0.875rem 1rem; border-bottom:1px solid #f1f3f5; display:flex; gap:0.875rem; align-items:flex-start; background:' + (m.leido ? 'white' : '#f0f7ff') + ';';
      row.innerHTML =
        '<div style="width:36px; height:36px; border-radius:50%; background:' + prioridadColor + '22; color:' + prioridadColor + '; display:flex; align-items:center; justify-content:center; flex-shrink:0;">' +
          '<i class="fas fa-envelope' + (m.leido ? '-open' : '') + '"></i>' +
        '</div>' +
        '<div style="flex:1; min-width:0;">' +
          '<div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">' +
            '<strong style="color:#1a1a2e;">' + (m.asunto || '(sin asunto)') + '</strong>' +
            (m.prioridad === 'alta' ? '<span style="background:#f8d7da; color:#721c24; padding:0.1rem 0.4rem; border-radius:0.875rem; font-size:0.6rem; font-weight:600;">ALTA</span>' : '') +
            (m.leido ? '' : '<span style="background:#174ea6; color:white; padding:0.1rem 0.4rem; border-radius:0.875rem; font-size:0.6rem; font-weight:600;">NUEVO</span>') +
          '</div>' +
          '<div style="font-size:0.7rem; color:#5a6378; margin-bottom:0.25rem;">De: ' + (rem ? (rem.nombres + ' ' + rem.apellidos) : '—') + ' → Para: ' + (dest ? (dest.nombres + ' ' + dest.apellidos) : '—') + ' · ' + (m.createdAt ? m.createdAt.split('T')[0] : '') + '</div>' +
          '<p style="margin:0; font-size:0.8125rem; color:#1a1a2e; line-height:1.5;">' + m.contenido + '</p>' +
        '</div>' +
        (!m.leido ? '<button data-leer="' + m.id + '" style="background:transparent; border:1px solid #28a745; color:#28a745; padding:0.3rem 0.625rem; border-radius:0.3rem; cursor:pointer; font-size:0.7rem; font-weight:500; white-space:nowrap;"><i class="fas fa-check"></i> Marcar leído</button>' : '');
      list.appendChild(row);
    });
    card.appendChild(list);
    wrap.appendChild(card);

    var btnNuevo = document.getElementById('msg-nuevo');
    if (btnNuevo) btnNuevo.onclick = function () { self._showMensajeDialog(); };
    setTimeout(function () {
      self.container.querySelectorAll('button[data-leer]').forEach(function (b) {
        b.onclick = function () { self._marcarLeido(b.getAttribute('data-leer')); };
      });
    }, 0);
    return wrap;
  }

  async _showMensajeDialog() {
    var self = this;
    if (this.trabajadores.length < 2) {
      this._showToast('Necesitas al menos 2 trabajadores para enviar un mensaje.', 'warning');
      return;
    }
    var choices = this.trabajadores.map(function (t) {
      return { value: t.id, label: (t.nombres + ' ' + t.apellidos + ' — ' + (t.cargo || '—') + ' (' + t.cedula + ')') };
    });
    var data = await this._confirmDialog().input({
      title: 'Nuevo Mensaje',
      fields: [
        { name: 'remitenteId', label: 'De (remitente)', type: 'select', required: true, options: choices },
        { name: 'destinatarioId', label: 'Para (destinatario)', type: 'select', required: true, options: choices },
        { name: 'asunto', label: 'Asunto', type: 'text', required: true },
        { name: 'contenido', label: 'Contenido', type: 'textarea', required: true },
        { name: 'prioridad', label: 'Prioridad', type: 'select', required: true, default: 'normal',
          options: [
            { value: 'baja', label: 'Baja' },
            { value: 'normal', label: 'Normal' },
            { value: 'alta', label: 'Alta' }
          ]
        }
      ]
    });
    if (!data) return;
    if (data.remitenteId === data.destinatarioId) {
      this._showToast('El remitente y destinatario no pueden ser la misma persona.', 'warning');
      return;
    }
    try {
      var r = await window.electronAPI.ghCreateMensaje({
        companyName: this.companyName,
        data: {
          remitenteId: data.remitenteId,
          destinatarioId: data.destinatarioId,
          asunto: data.asunto,
          contenido: data.contenido,
          prioridad: data.prioridad
        }
      });
      if (r && r.success) {
        this._showToast('Mensaje enviado', 'success');
        await this._load(); this.render();
      } else {
        this._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  async _marcarLeido(id) {
    try {
      var r = await window.electronAPI.ghMarcarLeido({ mensajeId: id, fechaLectura: new Date().toISOString() });
      if (r && r.success) {
        this._showToast('Marcado como leído', 'success');
        await this._load(); this.render();
      } else {
        this._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  _emptyState(msg) {
    var div = document.createElement('div');
    div.style.cssText = 'background:white; border:1px solid #e9ecef; border-radius:0.5rem; padding:2rem; text-align:center; color:#5a6378;';
    div.innerHTML = '<i class="fas fa-folder-open" style="font-size:1.5rem; color:#9ca3af;"></i><p style="margin:0.5rem 0 0;">' + msg + '</p>';
    return div;
  }

  destroy() { /* noop */ }
}

window.ComunicacionComponent = ComunicacionComponent;
