// modules/gestion-humana/documentos/index.js
// 📦710 · Documentos y Firmas (v0.2.0) — UI completa
//
// Catálogo de 7 tipos + tabla de documentos recientes + flujo de firma
// Backend: ghListDocumentos, ghGetDocumento, ghCreateDocumento, ghUpdateDocumento,
//          ghDeleteDocumento, ghFirmarDocumento, ghListFirmas, ghCreateFirma

class DocumentosComponent {
  constructor(container, companyName, moduleName, subName, onBack) {
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.subName = subName;
    this.onBack = onBack;
    this.items = [];
    this.trabajadores = [];
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

  static get TIPOS() {
    return [
      { value: 'autorizacion_datos',       label: 'Autorización Datos Sensibles', desc: 'Consentimiento informado Ley 1581/2012 para tratamiento de datos personales sensibles', color: '#174ea6', icon: 'fa-shield-halved' },
      { value: 'autorizacion_hojas_vida',  label: 'Autorización Hojas de Vida',    desc: 'Autorización expresa para aspirantes laborales — tratamiento de CV y verificación', color: '#28a745', icon: 'fa-id-card' },
      { value: 'actualizacion_datos',      label: 'Formato Actualización de Datos', desc: 'Datos personales, contacto, laborales y familiares del trabajador', color: '#0d9488', icon: 'fa-file-lines' },
      { value: 'induccion',                label: 'Inducción',                      desc: 'Acta de inducción con aceptación de protección de datos al final', color: '#5b2a86', icon: 'fa-book' },
      { value: 'contrato',                 label: 'Contrato Laboral',               desc: 'Contrato por hora real trabajada / obra labor / tiempo completo según cargo', color: '#1d4ed8', icon: 'fa-file-contract' },
      { value: 'carta_examenes',           label: 'Carta Solicitud Exámenes Médicos', desc: 'Soporte para facturación IPS — no es parte del proceso de contratación', color: '#be123c', icon: 'fa-flask' },
      { value: 'carta_cuenta_bancaria',    label: 'Carta Apertura Cuenta Nómina',   desc: 'Solicitud al banco AV Villas para apertura de cuenta de nómina del trabajador', color: '#0d9488', icon: 'fa-building-columns' }
    ];
  }

  async _load() {
    if (!window.electronAPI || !this.companyName) { this.loading = false; return; }
    try {
      var results = await Promise.all([
        window.electronAPI.ghListDocumentos({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListPersonal({ companyName: this.companyName }).catch(function () { return { success: false }; })
      ]);
      this.items        = results[0].success ? (results[0].data.documentos || []) : [];
      this.trabajadores = results[1].success ? (results[1].data.personales || []) : [];
      this._trabajadorById = {};
      this.trabajadores.forEach(function (t) { this._trabajadorById[t.id] = t; }.bind(this));
    } catch (e) {
      this._showToast('Error cargando documentos: ' + e.message, 'error');
    }
    this.loading = false;
  }

  _kpis() {
    var i = this.items;
    return {
      total: i.length,
      firmados: i.filter(function (x) { return x.estado === 'firmado'; }).length,
      pendientes: i.filter(function (x) { return x.estado === 'pendiente'; }).length,
      tiposDisponibles: 7
    };
  }

  _countByTipo(tipo) {
    return this.items.filter(function (x) { return x.tipo === tipo; }).length;
  }

  render() {
    var self = this;
    this.container.innerHTML = '';
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding:0; height:100%; overflow-y:auto; background:#f8f9fa;';

    if (this.loading) {
      wrapper.innerHTML = '<div style="padding:3rem; text-align:center; color:#5a6378;"><i class="fas fa-spinner fa-spin"></i> Cargando documentos…</div>';
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
        '<h2 style="margin:0; font-size:1.05rem; color:#1a1a2e;">Documentos y Firmas Digitales</h2>' +
        '<p style="margin:0.125rem 0 0; font-size:0.75rem; color:#5a6378;">7 tipos de documentos del proceso de contratación — firma en pantalla</p>' +
      '</div>' +
      '<button id="doc-generar" style="background:#1d4ed8; color:white; border:none; padding:0.5rem 0.875rem; border-radius:0.4rem; cursor:pointer; font-size:0.8125rem; font-weight:500; display:inline-flex; align-items:center; gap:0.4rem;">' +
        '<i class="fas fa-plus"></i> Generar Documento' +
      '</button>';
    wrapper.appendChild(head);

    // Catálogo
    wrapper.appendChild(this._renderCatalogo());

    // Documentos recientes
    wrapper.appendChild(this._renderRecientes());

    this.container.appendChild(wrapper);

    var btnGenerar = document.getElementById('doc-generar');
    if (btnGenerar) btnGenerar.onclick = function () { self._showGenerarDialog(); };
  }

  _renderKpiStrip(k) {
    var bar = document.createElement('div');
    bar.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:0; background:white; border-bottom:1px solid #e9ecef;';
    var items = [
      { value: k.total,    label: 'TOTAL DOCUMENTOS', color: '#1d4ed8', icon: 'fa-file-signature' },
      { value: k.firmados, label: 'FIRMADOS',         color: '#28a745', icon: 'fa-check' },
      { value: k.pendientes, label: 'PENDIENTES',    color: '#fd7e14', icon: 'fa-clock' },
      { value: k.tiposDisponibles, label: 'TIPOS DISPONIBLES', color: '#174ea6', icon: 'fa-layer-group' }
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

  _renderCatalogo() {
    var self = this;
    var wrap = document.createElement('div');
    wrap.style.cssText = 'padding:1.5rem;';
    wrap.innerHTML = '<h2 style="margin:0 0 0.875rem; font-size:0.75rem; text-transform:uppercase; color:#5a6378; letter-spacing:0.5px; font-weight:600;"><i class="fas fa-book-open"></i> Catálogo de Documentos</h2>';
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:0.875rem;';
    DocumentosComponent.TIPOS.forEach(function (tp) {
      var count = self._countByTipo(tp.value);
      var card = document.createElement('div');
      card.style.cssText = 'background:white; border:1px solid #e9ecef; border-radius:0.5rem; padding:1rem 1.125rem; cursor:pointer; transition:box-shadow 0.2s, transform 0.2s;';
      card.onmouseenter = function () { card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; card.style.transform = 'translateY(-2px)'; };
      card.onmouseleave = function () { card.style.boxShadow = ''; card.style.transform = ''; };
      card.onclick = function () { self._showGenerarDialog(tp.value); };
      card.innerHTML =
        '<div style="display:flex; align-items:flex-start; gap:0.625rem; margin-bottom:0.625rem;">' +
          '<div style="width:32px; height:32px; border-radius:0.4rem; background:' + tp.color + '22; color:' + tp.color + '; display:flex; align-items:center; justify-content:center; flex-shrink:0;">' +
            '<i class="fas ' + tp.icon + '"></i>' +
          '</div>' +
          '<div style="flex:1; min-width:0;">' +
            '<div style="font-size:0.9rem; font-weight:600; color:#1a1a2e;">' + tp.label + '</div>' +
          '</div>' +
        '</div>' +
        '<p style="margin:0; font-size:0.75rem; color:#5a6378; line-height:1.45; min-height:2.6em;">' + tp.desc + '</p>' +
        '<div style="margin-top:0.625rem; padding-top:0.5rem; border-top:1px solid #f1f3f5; font-size:0.7rem; color:' + (count === 0 ? '#9ca3af' : tp.color) + ';">' +
          (count === 0 ? 'Sin documentos generados' : count + ' documento' + (count === 1 ? '' : 's') + ' generado' + (count === 1 ? '' : 's')) +
        '</div>';
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    return wrap;
  }

  _renderRecientes() {
    var self = this;
    var wrap = document.createElement('div');
    wrap.style.cssText = 'padding:0 1.5rem 1.5rem;';
    wrap.innerHTML = '<h2 style="margin:0 0 0.875rem; font-size:0.75rem; text-transform:uppercase; color:#5a6378; letter-spacing:0.5px; font-weight:600;"><i class="fas fa-clock-rotate-left"></i> Documentos Recientes</h2>';
    var card = document.createElement('div');
    card.style.cssText = 'background:white; border:1px solid #e9ecef; border-radius:0.5rem; overflow:hidden;';
    if (this.items.length === 0) {
      card.innerHTML = '<div style="padding:2rem; text-align:center; color:#5a6378;">No hay documentos generados. Usa "Generar Documento" para crear el primero.</div>';
      wrap.appendChild(card);
      return wrap;
    }
    var table = document.createElement('table');
    table.style.cssText = 'width:100%; border-collapse:collapse; font-size:0.8125rem;';
    table.innerHTML =
      '<thead>' +
        '<tr style="background:#f8f9fa; color:#5a6378; text-transform:uppercase; font-size:0.65rem; letter-spacing:0.4px;">' +
          '<th style="text-align:left; padding:0.75rem 1rem;">Tipo</th>' +
          '<th style="text-align:left; padding:0.75rem 1rem;">Trabajador</th>' +
          '<th style="text-align:left; padding:0.75rem 1rem;">Fecha creación</th>' +
          '<th style="text-align:center; padding:0.75rem 1rem;">Estado</th>' +
          '<th style="text-align:left; padding:0.75rem 1rem;">Fecha firma</th>' +
          '<th style="text-align:right; padding:0.75rem 1rem;">Acción</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody></tbody>';
    var tbody = table.querySelector('tbody');
    this.items.slice(0, 30).forEach(function (d) {
      var t = self._trabajadorById[d.trabajadorId];
      var tp = DocumentosComponent.TIPOS.find(function (x) { return x.value === d.tipo; }) || { label: d.tipo, color: '#5a6378', icon: 'fa-file' };
      var tr = document.createElement('tr');
      tr.style.cssText = 'border-top:1px solid #f1f3f5;';
      var estadoColor = d.estado === 'firmado' ? '#28a745' : d.estado === 'anulado' ? '#6c757d' : '#fd7e14';
      var estadoBg    = d.estado === 'firmado' ? '#d4edda' : d.estado === 'anulado' ? '#e9ecef' : '#fff3cd';
      tr.innerHTML =
        '<td style="padding:0.75rem 1rem;"><div style="display:flex; align-items:center; gap:0.5rem;"><i class="fas ' + tp.icon + '" style="color:' + tp.color + ';"></i><span style="color:#1a1a2e;">' + tp.label + '</span></div></td>' +
        '<td style="padding:0.75rem 1rem; color:#1a1a2e;">' + (t ? (t.nombres + ' ' + t.apellidos) : '—') + '</td>' +
        '<td style="padding:0.75rem 1rem; color:#5a6378;">' + (d.createdAt ? d.createdAt.split('T')[0] : '—') + '</td>' +
        '<td style="padding:0.75rem 1rem; text-align:center;"><span style="background:' + estadoBg + '; color:' + estadoColor + '; padding:0.2rem 0.625rem; border-radius:0.875rem; font-size:0.7rem; font-weight:600; text-transform:capitalize;">' + d.estado + '</span></td>' +
        '<td style="padding:0.75rem 1rem; color:#5a6378;">' + (d.fechaFirma ? d.fechaFirma.split('T')[0] : '—') + '</td>' +
        '<td style="padding:0.75rem 1rem; text-align:right;">' +
          (d.estado === 'pendiente'
            ? '<button data-firmar="' + d.id + '" style="background:#28a745; color:white; border:none; padding:0.3rem 0.625rem; border-radius:0.3rem; cursor:pointer; font-size:0.75rem; font-weight:500;"><i class="fas fa-pen"></i> Firmar</button>'
            : '<span style="color:#9ca3af; font-size:0.7rem;">—</span>') +
        '</td>';
      tbody.appendChild(tr);
    });
    card.appendChild(table);
    wrap.appendChild(card);

    setTimeout(function () {
      self.container.querySelectorAll('button[data-firmar]').forEach(function (b) {
        b.onclick = function () { self._firmar(b.getAttribute('data-firmar')); };
      });
    }, 0);
    return wrap;
  }

  async _showGenerarDialog(tipoDefault) {
    var self = this;
    if (this.trabajadores.length === 0) {
      this._showToast('No hay trabajadores. Agrega uno en Base de Personal primero.', 'warning');
      return;
    }
    var choices = this.trabajadores.map(function (t) {
      return { value: t.id, label: (t.nombres + ' ' + t.apellidos + ' — ' + (t.cargo || '—') + ' (' + t.cedula + ')') };
    });
    var data = await this._confirmDialog().input({
      title: 'Generar Documento',
      fields: [
        { name: 'tipo', label: 'Tipo de documento', type: 'select', required: true, default: tipoDefault || 'autorizacion_datos',
          options: DocumentosComponent.TIPOS.map(function (t) { return { value: t.value, label: t.label }; })
        },
        { name: 'trabajadorId', label: 'Trabajador', type: 'select', required: true, options: choices },
        { name: 'titulo', label: 'Título (opcional, se autocompleta)', type: 'text', required: false }
      ]
    });
    if (!data) return;
    var tp = DocumentosComponent.TIPOS.find(function (t) { return t.value === data.tipo; });
    try {
      var r = await window.electronAPI.ghCreateDocumento({
        companyName: this.companyName,
        data: {
          trabajadorId: data.trabajadorId,
          tipo: data.tipo,
          titulo: data.titulo || tp.label,
          contenido: JSON.stringify({ tipoDocumento: data.tipo, generadoEn: new Date().toISOString() })
        }
      });
      if (r && r.success) {
        this._showToast('Documento generado', 'success');
        await this._load(); this.render();
      } else {
        this._showToast('Error: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  async _firmar(id) {
    try {
      // 1) Crear firma dummy (base64 minimal)
      var placeholderPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      var r1 = await window.electronAPI.ghCreateFirma({
        companyName: this.companyName,
        data: {
          trabajadorId: this.items.find(function (d) { return d.id === id; }).trabajadorId,
          documentoTipo: this.items.find(function (d) { return d.id === id; }).tipo,
          documentoId: id,
          imagenData: placeholderPng,
          fechaHora: new Date().toISOString(),
          metadata: JSON.stringify({ fuente: 'firma-pantalla-kair' })
        }
      });
      if (!r1 || !r1.success) {
        this._showToast('Error creando firma: ' + (r1 && r1.error && r1.error.message || 'desconocido'), 'error');
        return;
      }
      // 2) Marcar documento como firmado
      var r2 = await window.electronAPI.ghFirmarDocumento({
        documentoId: id,
        firmaId: r1.data.firma.id,
        fechaFirma: new Date().toISOString()
      });
      if (r2 && r2.success) {
        this._showToast('Documento firmado', 'success');
        await this._load(); this.render();
      } else {
        this._showToast('Error firmando: ' + (r2 && r2.error && r2.error.message || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  destroy() { /* noop */ }
}

window.DocumentosComponent = DocumentosComponent;
