// modules/gestion-humana/documentos/index.js
// 📦722 · Documentos y Firmas — HTML+CSS+JS separados (v0.2.0)
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
    this._trabajadorById = {};
    this.templates = [];  // 📦764 · templates de la empresa
    this._templateById = {};
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
  _esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  // 📦764 · Formatea bytes a texto legible (B / KB / MB)
  _fmtBytes(b) {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
  }
  // 📦764 · Formatea una fecha ISO a texto corto es-CO (dd/mm/yyyy) o '—' si vacía/inválida
  _fmtDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) { return iso; }
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
        window.electronAPI.ghListPersonal({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListTemplates({ companyName: this.companyName }).catch(function () { return { success: false }; })
      ]);
      this.items = results[0].success ? (results[0].data.documentos || []) : [];
      this.trabajadores = results[1].success ? (results[1].data.personales || []) : [];
      this.templates = results[2].success ? (results[2].data.templates || []) : [];
      this._trabajadorById = {};
      this.trabajadores.forEach(function (t) { this._trabajadorById[t.id] = t; }.bind(this));
      this._templateById = {};
      this.templates.forEach(function (t) { this._templateById[t.id] = t; }.bind(this));
    } catch (e) {
      this._showToast('Error cargando documentos: ' + e.message, 'error');
    }
    this.loading = false;
  }

  // 📦764 · Devuelve los templates de un tipo de documento específico
  _templatesByTipo(tipo) {
    var self = this;
    return this.templates.filter(function (t) { return t.tipoDocumento === tipo; });
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

  // === HTML ===
  async _fetchHtml() {
    try {
      var r = await fetch('modules/gestion-humana/documentos/index.html');
      if (r.ok) return await r.text();
    } catch (e) {
      console.warn('[Documentos] fetch HTML falló, usando fallback inline:', e.message);
    }
    return '<div class="doc-wrapper" id="doc-wrapper">' +
      // KPIs primero
      '<div class="doc-kpi-section"><div id="doc-kpi-bar" class="doc-kpi-bar"></div></div>' +
      // 📦772 · Section head después (sticky al scrollear)
      '<div class="doc-section-head">' +
        '<div class="doc-section-head__text">' +
          '<h2 class="doc-section-head__title">Documentos y Firmas Digitales</h2>' +
          '<p class="doc-section-head__subtitle">7 tipos de documentos del proceso de contratación — firma en pantalla</p>' +
        '</div>' +
        '<div class="doc-section-head__actions">' +
          '<button id="doc-tpl-abrir" class="doc-btn doc-btn--ghost" type="button"><i class="fas fa-folder-open"></i> Mis Templates</button>' +
          '<button id="doc-generar" class="doc-btn doc-btn--primary" type="button"><i class="fas fa-plus"></i> Generar Documento</button>' +
        '</div>' +
      '</div>' +
      // Documentos Recientes
      '<div class="doc-section">' +
        '<h3 class="doc-section-title"><i class="fas fa-clock-rotate-left"></i> Documentos Recientes</h3>' +
        '<div id="doc-recientes" class="doc-recientes"></div>' +
      '</div>' +
      // Catálogo
      '<div class="doc-section">' +
        '<h3 class="doc-section-title"><i class="fas fa-book-open"></i> Catálogo de Documentos</h3>' +
        '<div id="doc-catalogo" class="doc-catalogo"></div>' +
      '</div>' +
      // 📦766 · Modal "Administrar Templates" (Mis Templates) — se abre con botón del header
      '<div id="doc-tpl-admin-modal" class="doc-modal" hidden>' +
        '<div class="doc-modal__backdrop" data-close-doc-modal="1"></div>' +
        '<div class="doc-modal__panel doc-modal__panel--admin">' +
          '<header class="doc-modal__header"><h3 class="doc-modal__title"><i class="fas fa-folder-open"></i> Mis Templates</h3>' +
            '<button type="button" class="doc-modal__close" data-close-doc-modal="1" aria-label="Cerrar"><i class="fas fa-times"></i></button>' +
          '</header>' +
          '<div class="doc-modal__body">' +
            '<div class="doc-tpl-admin-header">' +
              '<p class="doc-tpl-admin-header__text">Sube tus propios .docx o .pdf para usar al generar documentos. Los templates quedan en tu computador (AppData) y se copian al generar cada documento.</p>' +
              '<button id="doc-tpl-subir" class="doc-btn doc-btn--primary" type="button"><i class="fas fa-cloud-upload-alt"></i> Subir Template</button>' +
            '</div>' +
            '<div id="doc-templates" class="doc-templates"></div>' +
          '</div>' +
          '<footer class="doc-modal__footer"><button type="button" class="doc-btn doc-btn--ghost" data-close-doc-modal="1">Cerrar</button></footer>' +
        '</div>' +
      '</div>' +
      // 📦763 · Modal Generar Documento (con campo template dinámico)
      '<div id="doc-generar-modal" class="doc-modal" hidden>' +
        '<div class="doc-modal__backdrop" data-close-doc-modal="1"></div>' +
        '<div class="doc-modal__panel doc-modal__panel--generar">' +
          '<header class="doc-modal__header"><h3 class="doc-modal__title">Generar Documento</h3>' +
            '<button type="button" class="doc-modal__close" data-close-doc-modal="1" aria-label="Cerrar"><i class="fas fa-times"></i></button>' +
          '</header>' +
          '<div class="doc-modal__body">' +
            '<div class="doc-field">' +
              '<label class="doc-field__label" for="doc-gen-trabajador">Trabajador <span class="doc-field__req">*</span></label>' +
              '<select id="doc-gen-trabajador" class="doc-field__select"></select>' +
            '</div>' +
            '<div class="doc-field">' +
              '<label class="doc-field__label">Tipo de documento <span class="doc-field__req">*</span></label>' +
              '<div id="doc-gen-tipos" class="doc-gen-tipos"></div>' +
            '</div>' +
            '<div class="doc-field" id="doc-gen-template-field" hidden>' +
              '<label class="doc-field__label" for="doc-gen-template">Template <span class="doc-field__req">*</span></label>' +
              '<select id="doc-gen-template" class="doc-field__select"></select>' +
              '<p class="doc-field__hint" id="doc-gen-template-hint"></p>' +
            '</div>' +
          '</div>' +
          '<footer class="doc-modal__footer">' +
            '<button type="button" class="doc-btn doc-btn--ghost" data-close-doc-modal="1">Cancelar</button>' +
            '<button type="button" id="doc-gen-confirm" class="doc-btn doc-btn--primary"><i class="fas fa-plus"></i> Generar y Firmar</button>' +
          '</footer>' +
        '</div>' +
      '</div>' +
      // 📦764 · Modal Subir Template
      '<div id="doc-tpl-modal" class="doc-modal" hidden>' +
        '<div class="doc-modal__backdrop" data-close-doc-modal="1"></div>' +
        '<div class="doc-modal__panel doc-modal__panel--template">' +
          '<header class="doc-modal__header"><h3 class="doc-modal__title">Subir Template</h3>' +
            '<button type="button" class="doc-modal__close" data-close-doc-modal="1" aria-label="Cerrar"><i class="fas fa-times"></i></button>' +
          '</header>' +
          '<div class="doc-modal__body">' +
            '<div class="doc-field">' +
              '<label class="doc-field__label" for="doc-tpl-tipo">Tipo de documento <span class="doc-field__req">*</span></label>' +
              '<select id="doc-tpl-tipo" class="doc-field__select"></select>' +
            '</div>' +
            '<div class="doc-field">' +
              '<label class="doc-field__label" for="doc-tpl-nombre">Nombre del template <span class="doc-field__req">*</span></label>' +
              '<input id="doc-tpl-nombre" type="text" class="doc-field__input" placeholder="Ej: AUTORIZACIÓN TEMPOACTIVA v1" />' +
              '<p class="doc-field__hint">Nombre legible para identificar este template (puedes tener varios por tipo).</p>' +
            '</div>' +
            '<p class="doc-template-helper"><i class="fas fa-info-circle"></i> Al confirmar, se abrirá el explorador de archivos para que elijas el .docx o .pdf del sistema. El archivo se guarda en AppData y queda disponible para usar al generar documentos.</p>' +
          '</div>' +
          '<footer class="doc-modal__footer">' +
            '<button type="button" class="doc-btn doc-btn--ghost" data-close-doc-modal="1">Cancelar</button>' +
            '<button type="button" id="doc-tpl-confirm" class="doc-btn doc-btn--primary"><i class="fas fa-folder-open"></i> Seleccionar archivo…</button>' +
          '</footer>' +
        '</div>' +
      '</div>' +
      // 📦763 · Modal Firma Digital
      '<div id="doc-firma-modal" class="doc-modal" hidden>' +
        '<div class="doc-modal__backdrop" data-close-doc-modal="1"></div>' +
        '<div class="doc-modal__panel doc-modal__panel--firma">' +
          '<header class="doc-modal__header"><h3 class="doc-modal__title">Firma Digital</h3>' +
            '<button type="button" class="doc-modal__close" data-close-doc-modal="1" aria-label="Cerrar"><i class="fas fa-times"></i></button>' +
          '</header>' +
          '<div class="doc-modal__body">' +
            '<p class="doc-firma__hint"><i class="fas fa-info-circle"></i> Dibuja tu firma con el ratón (o el dedo en pantalla táctil).</p>' +
            '<div class="doc-firma__canvas-wrap">' +
              '<canvas id="doc-firma-canvas" class="doc-firma__canvas" width="600" height="200"></canvas>' +
              '<div class="doc-firma__placeholder" id="doc-firma-placeholder"><i class="fas fa-pen-nib"></i><span>Firma aquí</span></div>' +
            '</div>' +
            '<p class="doc-firma__meta"><i class="fas fa-user"></i> <span id="doc-firma-trabajador">—</span> · <i class="fas fa-file-alt"></i> <span id="doc-firma-tipo">—</span></p>' +
          '</div>' +
          '<footer class="doc-modal__footer">' +
            '<button type="button" id="doc-firma-limpiar" class="doc-btn doc-btn--ghost"><i class="fas fa-eraser"></i> Limpiar</button>' +
            '<div class="doc-modal__footer-right">' +
              '<button type="button" class="doc-btn doc-btn--ghost" data-close-doc-modal="1">Cancelar</button>' +
              '<button type="button" id="doc-firma-confirm" class="doc-btn doc-btn--primary" disabled><i class="fas fa-check"></i> Guardar Firma</button>' +
            '</div>' +
          '</footer>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // === RENDER ===
  async render() {
    var self = this;
    if (!this._html) this._html = await this._fetchHtml();
    this.container.innerHTML = this._html;

    if (this.loading) {
      var kpiBar = this.container.querySelector('#doc-kpi-bar');
      if (kpiBar) kpiBar.innerHTML = '<div style="padding:1rem; text-align:center; color:#5a6378;"><i class="fas fa-spinner fa-spin"></i> Cargando…</div>';
      await this._load();
    }

    this._renderKpiBar();
    this._renderTemplates();  // 📦764 · sección de templates subidos
    this._renderCatalogo();
    this._renderRecientes();

    var btnGenerar = this.container.querySelector('#doc-generar');
    if (btnGenerar) btnGenerar.onclick = function () { self._openGenerarModal(); };

    // 📦766 · Botón "Mis Templates" en el header → abre modal de administración
    var btnTplAdmin = this.container.querySelector('#doc-tpl-abrir');
    if (btnTplAdmin) btnTplAdmin.onclick = function () { self._openTemplatesAdminModal(); };

    // 📦764 · Botón "Subir Template" + wireup del modal de upload (dentro del modal admin)
    var btnTplSubir = this.container.querySelector('#doc-tpl-subir');
    if (btnTplSubir) btnTplSubir.onclick = function () { self._openSubirTemplateModal(); };

    // 📦763 · Wireup de los 2 modales (backdrop + X + botón Cancelar)
    var modales = this.container.querySelectorAll('.doc-modal');
    modales.forEach(function (modal) {
      modal.querySelectorAll('[data-close-doc-modal="1"]').forEach(function (el) {
        el.onclick = function () { self._closeDocModal(modal); };
      });
    });
    // Click en backdrop cierra (pero no cuando se clickea el panel)
    modales.forEach(function (modal) {
      var backdrop = modal.querySelector('.doc-modal__backdrop');
      if (backdrop) {
        backdrop.onclick = function (e) {
          if (e.target === backdrop) self._closeDocModal(modal);
        };
      }
    });
  }

  // 📦763 · Cierra cualquier modal de documento
  _closeDocModal(modal) {
    if (!modal) return;
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  _renderKpiBar() {
    var bar = this.container.querySelector('#doc-kpi-bar');
    if (!bar) return;
    var k = this._kpis();
    var kpis = [
      { icon: 'fa-file-signature',  color: '#1d4ed8', bg: '#dbeafe', value: k.total,           label: 'Total Documentos' },
      { icon: 'fa-check',          color: '#28a745', bg: '#d4edda', value: k.firmados,        label: 'Firmados' },
      { icon: 'fa-clock',          color: '#fd7e14', bg: '#ffe5d0', value: k.pendientes,      label: 'Pendientes' },
      { icon: 'fa-layer-group',    color: '#174ea6', bg: '#e8f0fe', value: k.tiposDisponibles, label: 'Tipos Disponibles' }
    ];
    window.GHKPIBar.render(bar, kpis);
  }

  _renderCatalogo() {
    var self = this;
    var grid = this.container.querySelector('#doc-catalogo');
    if (!grid) return;
    grid.innerHTML = '';
    DocumentosComponent.TIPOS.forEach(function (tp) {
      var count = self._countByTipo(tp.value);
      var card = document.createElement('div');
      card.className = 'doc-catalogo__card';
      card.innerHTML =
        '<div class="doc-catalogo__head">' +
          '<div class="doc-catalogo__icon" style="background:' + tp.color + '22; color:' + tp.color + ';"><i class="fas ' + tp.icon + '"></i></div>' +
          '<div class="doc-catalogo__title">' + tp.label + '</div>' +
        '</div>' +
        '<p class="doc-catalogo__desc">' + tp.desc + '</p>' +
        '<div class="doc-catalogo__count" style="color:' + (count === 0 ? '#9ca3af' : tp.color) + ';">' +
          (count === 0 ? 'Sin documentos generados' : count + ' documento' + (count === 1 ? '' : 's') + ' generado' + (count === 1 ? '' : 's')) +
        '</div>';
      card.onclick = function () { self._showGenerarDialog(tp.value); };
      grid.appendChild(card);
    });
  }

  _renderRecientes() {
    var self = this;
    var wrap = this.container.querySelector('#doc-recientes');
    if (!wrap) return;
    if (this.items.length === 0) {
      wrap.innerHTML = '<div class="doc-recientes__empty">No hay documentos generados. Usa "Generar Documento" para crear el primero.</div>';
      return;
    }
    var rows = '';
    this.items.slice(0, 30).forEach(function (d) {
      var t = self._trabajadorById[d.trabajadorId];
      var tp = DocumentosComponent.TIPOS.find(function (x) { return x.value === d.tipo; }) || { label: d.tipo, color: '#5a6378', icon: 'fa-file' };
      var badgeClass = d.estado === 'firmado' ? 'doc-badge--firmado' : d.estado === 'anulado' ? 'doc-badge--anulado' : 'doc-badge--pendiente';
      // 📦764 · Acciones: descargar (si tiene archivo) + firmar (si está pendiente)
      var acciones = [];
      if (d.rutaArchivo) {
        acciones.push('<button class="doc-btn-mini doc-btn-mini--primary" data-descargar="' + self._esc(d.id) + '" title="Descargar ' + self._esc(d.nombreArchivo || 'archivo') + '"><i class="fas fa-download"></i> Descargar</button>');
      }
      if (d.estado === 'pendiente') {
        acciones.push('<button class="doc-btn-mini" data-firmar="' + self._esc(d.id) + '"><i class="fas fa-pen"></i> Firmar</button>');
      }
      var actionCell = acciones.length > 0
        ? '<div class="doc-template__actions">' + acciones.join('') + '</div>'
        : '<span class="doc-row-empty">—</span>';
      rows += '<tr>' +
        '<td><div class="doc-table__type"><i class="fas ' + tp.icon + '" style="color:' + tp.color + ';"></i><span>' + self._esc(tp.label) + '</span></div></td>' +
        '<td>' + (t ? self._esc(t.nombres + ' ' + t.apellidos) : '<span class="doc-table__empty">—</span>') + '</td>' +
        '<td class="doc-table__date">' + (d.createdAt ? d.createdAt.split('T')[0] : '<span class="doc-table__empty">—</span>') + '</td>' +
        '<td class="doc-table td--center"><span class="doc-badge ' + badgeClass + '">' + d.estado + '</span></td>' +
        '<td class="doc-table__date">' + (d.fechaFirma ? d.fechaFirma.split('T')[0] : '<span class="doc-table__empty">—</span>') + '</td>' +
        '<td class="doc-table td--right">' + actionCell + '</td>' +
      '</tr>';
    });
    wrap.innerHTML =
      '<div class="doc-table-wrap">' +
        '<table class="doc-table">' +
          '<thead>' +
            '<tr>' +
              '<th>Tipo</th>' +
              '<th>Trabajador</th>' +
              '<th>Fecha creación</th>' +
              '<th class="doc-table th--center">Estado</th>' +
              '<th>Fecha firma</th>' +
              '<th class="doc-table th--right">Acción</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>';

    wrap.querySelectorAll('button[data-firmar]').forEach(function (b) {
      b.onclick = function () { self._firmar(b.getAttribute('data-firmar')); };
    });
    wrap.querySelectorAll('button[data-descargar]').forEach(function (b) {
      b.onclick = function () { self._descargarDocumento(b.getAttribute('data-descargar')); };
    });
  }

  // 📦764 · Renderiza la lista de templates subidos por el user
  _renderTemplates() {
    var self = this;
    var grid = this.container.querySelector('#doc-templates');
    if (!grid) return;
    if (this.templates.length === 0) {
      grid.innerHTML = '<div class="doc-template__empty">' +
        '<i class="fas fa-folder-open"></i>' +
        '<strong>No tienes templates subidos</strong>' +
        'Sube tu primer .docx o .pdf para empezar a generar documentos reales.' +
        '</div>';
      return;
    }
    grid.innerHTML = this.templates.map(function (t) {
      var tipoLabel = (DocumentosComponent.TIPOS.find(function (x) { return x.value === t.tipoDocumento; }) || { label: t.tipoDocumento }).label;
      var tipoColor = (DocumentosComponent.TIPOS.find(function (x) { return x.value === t.tipoDocumento; }) || { color: '#5a6378' }).color;
      var tamTxt = self._fmtBytes(t.tamanoBytes);
      var fechaTxt = t.fechaSubida ? self._fmtDate(t.fechaSubida) : '';
      return '<div class="doc-template">' +
        '<div class="doc-template__head">' +
          '<div class="doc-template__icon" style="background:' + tipoColor + '22; color:' + tipoColor + ';">' +
            '<i class="fas fa-file-' + (t.mimeType === 'application/pdf' ? 'pdf' : 'word') + '"></i>' +
          '</div>' +
          '<div class="doc-template__body">' +
            '<div class="doc-template__title" title="' + self._esc(t.nombre) + '">' + self._esc(t.nombre) + '</div>' +
            '<span class="doc-template__tipo" style="color:' + tipoColor + '; background:' + tipoColor + '15;">' + self._esc(tipoLabel) + '</span>' +
            '<div class="doc-template__meta">' + tamTxt + ' · ' + fechaTxt + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="doc-template__actions">' +
          '<button class="doc-btn-mini doc-btn-mini--primary" data-tpl-abrir="' + self._esc(t.id) + '" title="Abrir archivo"><i class="fas fa-external-link-alt"></i> Abrir</button>' +
          '<button class="doc-btn-mini doc-btn-mini--danger" data-tpl-eliminar="' + self._esc(t.id) + '" title="Eliminar template"><i class="fas fa-trash"></i> Eliminar</button>' +
        '</div>' +
      '</div>';
    }).join('');

    grid.querySelectorAll('button[data-tpl-abrir]').forEach(function (b) {
      b.onclick = function () { self._abrirTemplate(b.getAttribute('data-tpl-abrir')); };
    });
    grid.querySelectorAll('button[data-tpl-eliminar]').forEach(function (b) {
      b.onclick = function () { self._eliminarTemplate(b.getAttribute('data-tpl-eliminar')); };
    });
  }

  // 📦764 · Abre el archivo del template con la app por defecto del sistema
  async _abrirTemplate(templateId) {
    try {
      var r = await window.electronAPI.ghAbrirTemplate({ templateId: templateId });
      if (!r || !r.success) {
        this._showToast('Error abriendo template: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  // 📦766 · Modal "Administrar Templates" (Mis Templates) — abre desde el header
  _openTemplatesAdminModal() {
    var self = this;
    var modal = this.container.querySelector('#doc-tpl-admin-modal');
    if (!modal) return;
    document.body.style.overflow = 'hidden';
    // Refrescar el grid de templates dentro del modal (por si hubo cambios)
    this._renderTemplates();
    modal.removeAttribute('hidden');
  }

  // 📦764 · Modal para subir un nuevo template
  _openSubirTemplateModal() {
    var self = this;
    var modal = this.container.querySelector('#doc-tpl-modal');
    if (!modal) return;
    document.body.style.overflow = 'hidden';

    // Llenar select de tipos
    var selTipo = modal.querySelector('#doc-tpl-tipo');
    if (selTipo) {
      selTipo.innerHTML = DocumentosComponent.TIPOS.map(function (t) {
        return '<option value="' + self._esc(t.value) + '">' + self._esc(t.label) + '</option>';
      }).join('');
    }
    // Limpiar input de nombre
    var inputNombre = modal.querySelector('#doc-tpl-nombre');
    if (inputNombre) inputNombre.value = '';

    // Wireup del botón "Seleccionar archivo…"
    var btnConfirm = modal.querySelector('#doc-tpl-confirm');
    if (btnConfirm) {
      btnConfirm.onclick = function () {
        var tipo = selTipo ? selTipo.value : null;
        var nombre = inputNombre ? inputNombre.value.trim() : '';
        if (!tipo) { self._showToast('Selecciona un tipo de documento', 'warning'); return; }
        if (!nombre) { self._showToast('Escribe un nombre para el template', 'warning'); return; }
        self._subirTemplate(tipo, nombre, modal);
      };
    }

    modal.removeAttribute('hidden');
  }

  // 📦764 · Llama al IPC gh:subir-template con tipo + nombre (el bridge abre el dialog)
  async _subirTemplate(tipo, nombre, modal) {
    var self = this;
    var btnConfirm = modal ? modal.querySelector('#doc-tpl-confirm') : null;
    try {
      if (btnConfirm) { btnConfirm.disabled = true; btnConfirm.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo…'; }
      var r = await window.electronAPI.ghSubirTemplate({
        companyName: this.companyName,
        tipoDocumento: tipo,
        nombre: nombre
      });
      if (btnConfirm) { btnConfirm.disabled = false; btnConfirm.innerHTML = '<i class="fas fa-folder-open"></i> Seleccionar archivo…'; }
      if (!r || !r.success) {
        if (r && r.data && r.data.canceled) { return; }  // user canceló el dialog
        this._showToast('Error subiendo: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
        return;
      }
      this._closeDocModal(modal);
      this._showToast('Template subido correctamente', 'success');
      await this._load();
      this.render();
    } catch (e) {
      if (btnConfirm) { btnConfirm.disabled = false; btnConfirm.innerHTML = '<i class="fas fa-folder-open"></i> Seleccionar archivo…'; }
      this._showToast('Error: ' + e.message, 'error');
    }
  }

  // 📦764 · Elimina un template (KairConfirm + IPC)
  async _eliminarTemplate(templateId) {
    var self = this;
    var tpl = this._templateById[templateId];
    var nombre = tpl ? tpl.nombre : 'este template';
    var ok;
    if (window.KairConfirm) {
      ok = await window.KairConfirm.show({
        title: 'Eliminar template',
        message: '¿Eliminar "' + nombre + '"? El archivo se borrará del disco y el template ya no estará disponible para generar documentos.',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
      });
    } else {
      ok = confirm('¿Eliminar "' + nombre + '"?');
    }
    if (!ok) return;
    try {
      var r = await window.electronAPI.ghEliminarTemplate({ templateId: templateId });
      if (!r || !r.success) {
        this._showToast('Error eliminando: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
        return;
      }
      this._showToast('Template eliminado', 'success');
      await this._load();
      this.render();
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  // 📦764 · Abre el archivo del documento generado (descarga)
  async _descargarDocumento(docId) {
    try {
      var r = await window.electronAPI.ghObtenerDocumento({ documentoId: docId });
      if (!r || !r.success || !r.data || !r.data.documento) {
        this._showToast('Error: no se encontró el documento', 'error');
        return;
      }
      var doc = r.data.documento;
      if (!doc.rutaArchivo) {
        this._showToast('El documento no tiene archivo adjunto (usa "Generar Documento" con un template)', 'warning');
        return;
      }
      // Abrir con la app por defecto del sistema
      var r2 = await window.electronAPI.ghAbrirDocumento({ documentoId: docId });
      if (!r2 || !r2.success) {
        // Fallback: si el handler falla, abrir con shell.openPath del preload
        if (window.electronAPI.openPath) {
          await window.electronAPI.openPath(doc.rutaArchivo);
        } else {
          this._showToast('No se puede abrir el archivo: ' + doc.rutaArchivo, 'warning');
        }
      }
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  async _showGenerarDialog(tipoDefault) {
    // 📦763 · Mantener firma por compat con clicks del catálogo
    return this._openGenerarModal(tipoDefault);
  }

  // 📦763 · Modal personalizado de "Generar Documento" con cards de tipos
  async _openGenerarModal(tipoDefault) {
    var self = this;
    if (this.trabajadores.length === 0) {
      this._showToast('No hay trabajadores. Agrega uno en Base de Personal primero.', 'warning');
      return;
    }

    var modal = this.container.querySelector('#doc-generar-modal');
    if (!modal) return;
    document.body.style.overflow = 'hidden';

    // Llenar select de trabajador
    var sel = modal.querySelector('#doc-gen-trabajador');
    if (sel) {
      sel.innerHTML = this.trabajadores.map(function (t) {
        return '<option value="' + self._esc(t.id) + '">' + self._esc(t.nombres + ' ' + t.apellidos + ' — ' + (t.cargo || '—')) + '</option>';
      }).join('');
    }

    // Renderizar cards de tipos de documento (con la primera preseleccionada o la del click)
    var tiposWrap = modal.querySelector('#doc-gen-tipos');
    var templateField = modal.querySelector('#doc-gen-template-field');
    var templateSel = modal.querySelector('#doc-gen-template');
    var templateHint = modal.querySelector('#doc-gen-template-hint');
    var selectedTipo = tipoDefault || (DocumentosComponent.TIPOS[0] && DocumentosComponent.TIPOS[0].value);
    self._selectedTipo = selectedTipo;
    self._selectedTemplateId = null;

    function updateTemplateField() {
      var templates = self._templatesByTipo(self._selectedTipo);
      if (templates.length > 0) {
        templateField.removeAttribute('hidden');
        templateSel.innerHTML = templates.map(function (t) {
          return '<option value="' + self._esc(t.id) + '">' + self._esc(t.nombre) + ' (' + self._esc(t.nombreArchivo) + ')</option>';
        }).join('');
        self._selectedTemplateId = templates[0].id;
        templateHint.textContent = templates.length + ' template' + (templates.length > 1 ? 's' : '') + ' disponible' + (templates.length > 1 ? 's' : '') + ' para este tipo. El archivo del template se copiará como archivo del documento generado.';
        templateHint.style.color = '#28a745';
      } else {
        templateField.setAttribute('hidden', '');
        templateSel.innerHTML = '';
        self._selectedTemplateId = null;
        templateHint.textContent = '';
      }
    }

    function renderTipos() {
      tiposWrap.innerHTML = DocumentosComponent.TIPOS.map(function (tp) {
        var templates = self._templatesByTipo(tp.value);
        var isSelected = tp.value === self._selectedTipo;
        var tplBadge = templates.length > 0
          ? '<span class="doc-gen-tipo__tpl-badge">' + templates.length + ' template' + (templates.length > 1 ? 's' : '') + '</span>'
          : '<span class="doc-gen-tipo__tpl-badge doc-gen-tipo__tpl-badge--empty">sin template</span>';
        return '<div class="doc-gen-tipo ' + (isSelected ? 'doc-gen-tipo--selected' : '') + '" data-tipo="' + self._esc(tp.value) + '">' +
          '<div class="doc-gen-tipo__icon" style="background:' + tp.color + '22; color:' + tp.color + ';"><i class="fas ' + tp.icon + '"></i></div>' +
          '<div class="doc-gen-tipo__body">' +
            '<div class="doc-gen-tipo__title">' + self._esc(tp.label) + ' ' + tplBadge + '</div>' +
            '<div class="doc-gen-tipo__desc">' + self._esc(tp.desc) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
      // Wirear clicks
      tiposWrap.querySelectorAll('.doc-gen-tipo').forEach(function (el) {
        el.onclick = function () {
          self._selectedTipo = el.getAttribute('data-tipo');
          renderTipos();
          updateTemplateField();
        };
      });
    }
    renderTipos();
    updateTemplateField();

    // Wirear cambio de template
    if (templateSel) {
      templateSel.onchange = function (e) { self._selectedTemplateId = e.target.value; };
    }

    // Wireup del botón "Generar y Firmar"
    var btnConfirm = modal.querySelector('#doc-gen-confirm');
    if (btnConfirm) {
      btnConfirm.onclick = function () {
        var trabajadorId = sel ? sel.value : null;
        if (!trabajadorId) { self._showToast('Selecciona un trabajador', 'warning'); return; }
        if (!self._selectedTipo) { self._showToast('Selecciona un tipo de documento', 'warning'); return; }
        self._generarYAbrirFirma(trabajadorId, self._selectedTipo, modal);
      };
    }

    modal.removeAttribute('hidden');
  }

  // 📦763+📦764 · Genera el documento en BD y abre el modal de firma
  async _generarYAbrirFirma(trabajadorId, tipo, generarModal) {
    var self = this;
    var tp = DocumentosComponent.TIPOS.find(function (t) { return t.value === tipo; });
    try {
      // 📦764 · Si hay template seleccionado, el backend copia el archivo
      // del template a la carpeta de documentos generados.
      var templateId = self._selectedTemplateId;
      var r = await window.electronAPI.ghCreateDocumento({
        companyName: this.companyName,
        data: {
          trabajadorId: trabajadorId,
          tipo: tipo,
          titulo: tp.label,
          contenido: JSON.stringify({ tipoDocumento: tipo, generadoEn: new Date().toISOString() }),
          templateId: templateId  // null si no hay template
        }
      });
      if (!r || !r.success) {
        this._showToast('Error generando: ' + (r && r.error && r.error.message || 'desconocido'), 'error');
        return;
      }
      // El bridge retorna { documentoId, rutaArchivo, nombreArchivo }
      await this._load();
      var docNuevo = self.items.find(function (d) { return d.id === r.data.documentoId; });
      if (!docNuevo) {
        this._showToast('Error: no se encontró el documento recién creado', 'error');
        return;
      }
      this._closeDocModal(generarModal);
      this._openFirmaModal(docNuevo, tp);
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  // 📦763 · Modal de Firma Digital con canvas
  _openFirmaModal(documento, tipo) {
    var self = this;
    var modal = this.container.querySelector('#doc-firma-modal');
    if (!modal) return;
    document.body.style.overflow = 'hidden';

    // Set meta info
    var t = this._trabajadorById[documento.trabajadorId];
    var nombreT = t ? (t.nombres + ' ' + t.apellidos) : '—';
    var trabSpan = modal.querySelector('#doc-firma-trabajador');
    var tipoSpan = modal.querySelector('#doc-firma-tipo');
    if (trabSpan) trabSpan.textContent = nombreT;
    if (tipoSpan) tipoSpan.textContent = tipo.label;

    // Set up canvas
    var canvas = modal.querySelector('#doc-firma-canvas');
    var placeholder = modal.querySelector('#doc-firma-placeholder');
    var btnConfirm = modal.querySelector('#doc-firma-confirm');
    var btnLimpiar = modal.querySelector('#doc-firma-limpiar');
    var ctx = canvas.getContext('2d');
    var drawing = false;
    var hasDrawn = false;
    var last = null;

    // Ajustar canvas al DPR del device para que no se vea borroso
    function _setupCanvas() {
      var dpr = window.devicePixelRatio || 1;
      var w = canvas.clientWidth || 600;
      var h = canvas.clientHeight || 200;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1a1a2e';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    _setupCanvas();
    if (btnConfirm) btnConfirm.disabled = true;

    function _pointFromEvent(e) {
      var rect = canvas.getBoundingClientRect();
      var t = (e.touches && e.touches[0]) ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    function _start(e) {
      e.preventDefault();
      drawing = true;
      last = _pointFromEvent(e);
      if (placeholder) placeholder.style.display = 'none';
    }
    function _move(e) {
      if (!drawing) return;
      e.preventDefault();
      var p = _pointFromEvent(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      if (!hasDrawn) {
        hasDrawn = true;
        if (btnConfirm) btnConfirm.disabled = false;
      }
    }
    function _end(e) {
      if (!drawing) return;
      e.preventDefault();
      drawing = false;
    }
    // Mouse events
    canvas.onmousedown = _start;
    canvas.onmousemove = _move;
    canvas.onmouseup = _end;
    canvas.onmouseleave = _end;
    // Touch events (móvil / tablet con stylus)
    canvas.ontouchstart = _start;
    canvas.ontouchmove = _move;
    canvas.ontouchend = _end;
    canvas.ontouchcancel = _end;

    if (btnLimpiar) {
      btnLimpiar.onclick = function () {
        var w = canvas.clientWidth;
        var h = canvas.clientHeight;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        hasDrawn = false;
        if (btnConfirm) btnConfirm.disabled = true;
        if (placeholder) placeholder.style.display = '';
      };
    }

    if (btnConfirm) {
      btnConfirm.onclick = function () {
        if (!hasDrawn) { self._showToast('Dibuja tu firma antes de guardar', 'warning'); return; }
        // Exportar canvas a PNG base64
        var dataUrl = canvas.toDataURL('image/png');
        // Quitar el prefijo "data:image/png;base64," para guardar solo el base64
        var base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        self._saveFirma(documento, base64, modal);
      };
    }

    modal.removeAttribute('hidden');
  }

  // 📦763 · Guarda la firma (gh:create-firma) + la asocia al documento (gh:firmar-documento)
  async _saveFirma(documento, imagenBase64, firmaModal) {
    var self = this;
    try {
      // 1. Crear firma
      var r1 = await window.electronAPI.ghCreateFirma({
        companyName: this.companyName,
        data: {
          trabajadorId: documento.trabajadorId,
          documentoTipo: documento.tipo,
          documentoId: documento.id,
          imagenData: imagenBase64,
          fechaHora: new Date().toISOString(),
          metadata: JSON.stringify({ fuente: 'firma-pantalla-kair', anchoCanvas: 600, altoCanvas: 200 })
        }
      });
      if (!r1 || !r1.success) {
        this._showToast('Error creando firma: ' + (r1 && r1.error && r1.error.message || 'desconocido'), 'error');
        return;
      }
      // 2. Firmar documento
      var r2 = await window.electronAPI.ghFirmarDocumento({
        documentoId: documento.id,
        firmaId: r1.data.firmaId,  // 📦763 · bridge retorna { firmaId: id } (no anidado)
        fechaFirma: new Date().toISOString()
      });
      if (!r2 || !r2.success) {
        this._showToast('Error firmando: ' + (r2 && r2.error && r2.error.message || 'desconocido'), 'error');
        return;
      }
      this._closeDocModal(firmaModal);
      this._showToast('Documento firmado correctamente', 'success');
      await this._load();
      this.render();
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  // 📦763 · Reemplazo de _firmar — ahora abre el modal de canvas
  async _firmar(id) {
    var doc = this.items.find(function (d) { return d.id === id; });
    if (!doc) { this._showToast('Documento no encontrado', 'error'); return; }
    var tp = DocumentosComponent.TIPOS.find(function (t) { return t.value === doc.tipo; }) || { label: doc.tipo, color: '#5a6378', icon: 'fa-file' };
    this._openFirmaModal(doc, tp);
  }

  destroy() { /* noop */ }
}

window.DocumentosComponent = DocumentosComponent;
