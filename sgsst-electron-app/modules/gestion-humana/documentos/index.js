// modules/gestion-humana/documentos/index.js
// 📦722 · Documentos — HTML+CSS+JS separados (v0.3.0 POST-LEGACY-SIGN-REMOVE)
//
// Catálogo de 7 tipos + tabla de documentos recientes + generación
// LEGACY-SIGN-REMOVE (2026-08-20): la firma canvas operativa interna
// (gh:firmar-documento, gh:create-firma, gh:list-firmas) se eliminó.
// La firma es únicamente electrónica vía firma-service (I-101+).
// Backend actual: ghListDocumentos, ghGetDocumento, ghCreateDocumento,
//                 ghUpdateDocumento, ghDeleteDocumento

// I-102.2.G · Mapa de estados terminales de firma-service → estado persistente
// de gh_documentos. Declarado como constante a NIVEL DE MÓDULO (fuera de la
// clase) porque una class body de JS no admite object literals con coma
// suelta como class member. Si retorna null en 'estado', no se hace
// transición de estado (casos como OTP_LOCKED donde el documento sigue
// técnicamente esperando_firma). 'toast' es el mensaje al usuario.
// 'success' marca el toast como positivo (verde) o warning (amarillo).
const _TRANSICION_FIRMA = {
  'SIGNED':                { estado: 'firmado',   incluirFechaFirma: true,  toast: 'Documento firmado correctamente.',                                success: true  },
  'REJECTED':              { estado: 'rechazado', incluirFechaFirma: false, toast: 'El firmante rechazó el documento.',                                 success: false },
  'EXPIRED':               { estado: 'expirado',  incluirFechaFirma: false, toast: 'La solicitud de firma expiró.',                                    success: false },
  'CANCELLED':             { estado: 'anulado',   incluirFechaFirma: false, toast: 'La solicitud de firma fue cancelada.',                             success: false },
  'REVOKED':               { estado: 'anulado',   incluirFechaFirma: false, toast: 'La solicitud de firma fue revocada.',                              success: false },
  'OTP_LOCKED':            { estado: null,        incluirFechaFirma: false, toast: 'OTP bloqueado por intentos. La solicitud no progresó.',            success: false },
  'IDENTIFICATION_FAILED': { estado: null,        incluirFechaFirma: false, toast: 'Falló la identificación del firmante. La solicitud no progresó.', success: false }
};

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
    // I-102.2.F · Iniciar polling de firma-service. Idempotente.
    if (typeof this._iniciarPolling === 'function') {
      this._iniciarPolling();
    }
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
          '<h2 class="doc-section-head__title">Documentos</h2>' +
          '<p class="doc-section-head__subtitle">7 tipos de documentos del proceso de contratación — la firma es electrónica</p>' +
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
            // LEGACY-SIGN-REMOVE: era "Generar y Firmar". Ahora solo "Generar".
            // La firma se hace luego desde la tabla via firma-service (I-102).
            '<button type="button" id="doc-gen-confirm" class="doc-btn doc-btn--primary" title="Genera el documento. La firma electrónica se hace luego desde la tabla."><i class="fas fa-plus"></i> Generar</button>' +
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
      // MODAL FIRMA DIGITAL — ELIMINADO en LEGACY-SIGN-REMOVE (2026-08-20).
      // La firma canvas ya no se usa. La nueva UI de firma electrónica
      // llegará con I-102 (firma-service). Por ahora, el botón "Generar"
      // solo crea el documento (estado='pendiente'); la firma se hace luego.
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

    // I-103.A1.5.3 · Wireup específico del modal de éxito.
    // Necesita su propio _cerrarModalExito (limpia listener de Escape).
    // Sobreescribe el wireup genérico del backdrop + data-close.
    var modalExito = this.container.querySelector('#doc-firma-success-modal');
    if (modalExito) {
      modalExito.querySelectorAll('[data-close-doc-firma-success="1"]').forEach(function (el) {
        el.onclick = function () { self._cerrarModalExito(modalExito); };
      });
      var backdropExito = modalExito.querySelector('.doc-modal__backdrop');
      if (backdropExito) {
        backdropExito.onclick = function (e) {
          if (e.target === backdropExito) self._cerrarModalExito(modalExito);
        };
      }
      var btnCopy = modalExito.querySelector('#doc-firma-success-copy');
      if (btnCopy) btnCopy.onclick = function () { self._copiarEnlace(modalExito); };
      var btnSend = modalExito.querySelector('#doc-firma-success-send');
      if (btnSend) btnSend.onclick = function () { self._enviarCorreoFirmante(modalExito); };
    }
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
      // I-102.2.B · Acciones por documento:
      //   - "Descargar"          → siempre que tenga rutaArchivo.
      //   - "Firmar electrónicamente" → SOLO si estado === 'pendiente' Y tiene
      //     rutaArchivo (sin archivo no se puede firmar). La accion NO crea
      //     la solicitud de firma todavia (eso es I-102.2.D). Primero valida
      //     que la empresa tenga firma configurada via firma:empresa:list.
      var acciones = [];
      if (d.rutaArchivo) {
        acciones.push('<button class="doc-btn-mini doc-btn-mini--primary" data-descargar="' + self._esc(d.id) + '" title="Descargar ' + self._esc(d.nombreArchivo || 'archivo') + '"><i class="fas fa-download"></i> Descargar</button>');
      }
      if (d.estado === 'pendiente' && d.rutaArchivo) {
        acciones.push('<button class="doc-btn-mini doc-btn-mini--secondary" data-firmar-electronico="' + self._esc(d.id) + '" title="Iniciar firma electrónica vía firma-service"><i class="fas fa-signature"></i> Firmar electrónicamente</button>');
      }
      var actionCell = acciones.length > 0
        ? '<div class="doc-template__actions">' + acciones.join('') + '</div>'
        : '<span class="doc-row-empty">—</span>';

      // I-102.2.F · Sub-estado de firma-service (si lo hemos polledo).
      // Se muestra como un subtexto debajo del badge principal, SOLO si difiere
      // del estado local del documento. El observador (F) NO modifica el
      // estado local — solo refleja lo que firma-service reporta.
      var subEstado = '';
      var statusLocal = (self._signRequestStatus || {})[d.id];
      if (statusLocal && statusLocal.estado && statusLocal.estado !== d.estado && d.estado === 'esperando_firma') {
        var estadoClass = self._esEstadoTerminal(statusLocal.estado) ? 'doc-firma-sub--terminal' : 'doc-firma-sub--pendiente';
        subEstado = '<div class="doc-firma-sub ' + estadoClass + '">' +
          '<i class="fas fa-' + (self._esEstadoTerminal(statusLocal.estado) ? 'check-circle' : 'circle-notch') + '"></i> ' +
          self._esc(statusLocal.estado) +
        '</div>';
      }

      rows += '<tr>' +
        '<td><div class="doc-table__type"><i class="fas ' + tp.icon + '" style="color:' + tp.color + ';"></i><span>' + self._esc(tp.label) + '</span></div></td>' +
        '<td>' + (t ? self._esc(t.nombres + ' ' + t.apellidos) : '<span class="doc-table__empty">—</span>') + '</td>' +
        '<td class="doc-table__date">' + (d.createdAt ? d.createdAt.split('T')[0] : '<span class="doc-table__empty">—</span>') + '</td>' +
        '<td class="doc-table td--center"><span class="doc-badge ' + badgeClass + '">' + d.estado + '</span>' + subEstado + '</td>' +
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

    // Wireup de las acciones
    wrap.querySelectorAll('button[data-descargar]').forEach(function (b) {
      b.onclick = function () { self._descargarDocumento(b.getAttribute('data-descargar')); };
    });
    wrap.querySelectorAll('button[data-firmar-electronico]').forEach(function (b) {
      b.onclick = function () { self._firmarElectronico(b.getAttribute('data-firmar-electronico')); };
    });
  }

  // I-102.2.F · Determina si un estado de firma-service es terminal
  // (no transicionará más). Los estados terminales NO se siguen polleando.
  // G se encargará de aplicar la transición de negocio cuando lo detecte.
  _esEstadoTerminal(estado) {
    if (!estado) return false;
    return ['SIGNED', 'REJECTED', 'REVOKED', 'EXPIRED', 'CANCELLED', 'OTP_LOCKED', 'IDENTIFICATION_FAILED'].indexOf(estado) !== -1;
  }

  // I-102.2.G · Aplica la transición de negocio cuando el polling detecta un
  // estado terminal. Hace el update optimista (local + BD), muestra toast,
  // marca el docId como procesado y refresca la tabla. NO descarga el PDF
  // firmado (eso será otra fase).
  async _aplicarTransicionFirma(docId, statusInfo) {
    var self = this;
    var doc = (this.items || []).find(function (d) { return d.id === docId; });
    if (!doc) return;

    // Idempotencia: si ya procesamos esta transición, no repetir.
    if (statusInfo && statusInfo.procesado) return;

    var estadoFS = statusInfo && statusInfo.estado;
    if (!estadoFS) return;

    var regla = _TRANSICION_FIRMA[estadoFS];
    if (!regla) {
      // Estado terminal desconocido (futuro). No hacer nada automático.
      console.warn('[I-102.2.G] Estado terminal firma-service no mapeado:', estadoFS);
      return;
    }

    // Casos sin transición de estado (OTP_LOCKED, IDENTIFICATION_FAILED):
    // solo mostrar feedback y marcar como procesado (para no re-procesar).
    if (!regla.estado) {
      self._showToast(regla.toast, regla.success ? 'success' : 'warning');
      self._signRequestStatus[docId] = Object.assign({}, statusInfo, { procesado: true });
      return;
    }

    // Construir el update para ghUpdateDocumento.
    var updates = { estado: regla.estado };
    if (regla.incluirFechaFirma && statusInfo.data && statusInfo.data.fecha_firma) {
      // La fecha que viene de firma-service es ISO 8601 (e.g. "2026-08-20T15:30:00.000Z").
      // gh_documentos.fecha_firma es TEXT, acepta ISO. Pasamos directo.
      updates.fechaFirma = statusInfo.data.fecha_firma;
    }
    // Si es REJECTED, podríamos guardar motivoRechazo. PERO el bridge no lo
    // soporta en la whitelist todavía. Lo dejamos en statusInfo (memoria)
    // para futuro. NO es bloqueante.

    try {
      var r = await window.electronAPI.ghUpdateDocumento({
        documentoId: docId,
        updates: updates
      });
      if (!r || !r.success) {
        // No mostramos toast destructivo: el polling reintentará en 30s.
        // Solo log para diagnóstico.
        console.warn('[I-102.2.G] ghUpdateDocumento falló para', docId, ':', r && r.error);
        return;
      }
      // Update optimista del doc local (sin recargar todo).
      doc.estado = regla.estado;
      if (updates.fechaFirma) doc.fechaFirma = updates.fechaFirma;
      // Marcar como procesado (idempotencia) y guardar en el status.
      self._signRequestStatus[docId] = Object.assign({}, statusInfo, { procesado: true });
      // Feedback al usuario.
      self._showToast(regla.toast, regla.success ? 'success' : 'warning');
      // Re-render para reflejar el nuevo estado en la tabla.
      self._renderRecientes();
    } catch (e) {
      console.warn('[I-102.2.G] Error inesperado en transición para', docId, ':', e && e.message);
    }
  }

  // I-102.2.F · Inicia el polling de firma-service (idempotente).
  // Solo consulta documentos con estado='esperando_firma' y idSolicitudFirma.
  _iniciarPolling() {
    if (this._pollHandle) return; // ya está activo
    this._signRequestStatus = this._signRequestStatus || {};
    var self = this;
    // Primer tick inmediato (no esperar 30s la primera vez)
    setTimeout(function () { self._tickPolling(); }, 100);
    this._pollHandle = setInterval(function () { self._tickPolling(); }, 30000);
  }

  // I-102.2.F · Detiene el polling. Llamar en destroy() y cuando el componente
  // se desmonte del DOM.
  _detenerPolling() {
    if (this._pollHandle) {
      clearInterval(this._pollHandle);
      this._pollHandle = null;
    }
  }

  // I-102.2.F · Tick del polling. Evita concurrencia con _pollEnCurso.
  // Solo consulta docs que están 'esperando_firma' con idSolicitudFirma válido.
  // Para docs en estado terminal (visto anteriormente), NO los vuelve a consultar.
  async _tickPolling() {
    if (this._pollEnCurso) return;
    if (!this.items || this.items.length === 0) return;
    var self = this;
    // Identificar candidatos: esperando_firma + idSolicitudFirma + NO terminal previo
    var candidatos = this.items.filter(function (d) {
      if (d.estado !== 'esperando_firma') return false;
      if (!d.idSolicitudFirma) return false;
      var prev = (self._signRequestStatus || {})[d.id];
      if (prev && self._esEstadoTerminal(prev.estado)) return false;
      return true;
    });
    if (candidatos.length === 0) return;

    this._pollEnCurso = true;
    try {
      // Lanzar todas las consultas en paralelo (con Promise.allSettled para
      // que un error individual no aborte el batch).
      var results = await Promise.allSettled(candidatos.map(function (d) {
        return window.electronAPI.firmaSignRequestGet(d.idSolicitudFirma)
          .then(function (r) { return { doc: d, r: r }; });
      }));

      var huboCambios = false;
      var ahora = new Date().toISOString();

      for (var i = 0; i < results.length; i++) {
        var res = results[i];
        if (res.status !== 'fulfilled') continue;
        var doc = res.value.doc;
        var r = res.value.r;

        if (!r || !r.success) {
          // Error individual: ignorar este ciclo. Próximo tick reintenta.
          // (Loggear al console para diagnóstico; no toasts por polling.)
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[I-102.2.F] firmaSignRequestGet falló para', doc.id, ':', r && r.error);
          }
          continue;
        }

        var estadoAnterior = (self._signRequestStatus[doc.id] || {}).estado;
        var estadoNuevo = r.data && r.data.estado;
        if (!estadoNuevo) continue;

        if (estadoAnterior !== estadoNuevo) {
          huboCambios = true;
        }
        self._signRequestStatus[doc.id] = {
          estado: estadoNuevo,
          lastCheckedAt: ahora,
          data: r.data
        };

        // I-102.2.G · Si firma-service reporta un estado terminal, delegamos
        // al reactor _aplicarTransicionFirma. F (este polling) SOLO observa;
        // G (esa función) es quien ejecuta la transición de negocio
        // (ghUpdateDocumento + UI + toast). Se lanza en background para
        // no bloquear el tick de los demás documentos. _aplicarTransicionFirma
        // ya tiene try/catch interno; el .catch() es defensa en profundidad.
        if (self._esEstadoTerminal(estadoNuevo)) {
          self._aplicarTransicionFirma(doc.id, self._signRequestStatus[doc.id])
            .catch(function (e) {
              if (typeof console !== 'undefined' && console.warn) {
                console.warn('[I-102.2.G] transición error inesperado:', doc.id, e && e.message);
              }
            });
        }
      }

      if (huboCambios) {
        // Re-renderizar tabla para mostrar el sub-estado.
        self._renderRecientes();
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[I-102.2.F] _tickPolling error:', e && e.message);
      }
    } finally {
      this._pollEnCurso = false;
    }
  }

  // I-102.2.B · Punto de entrada para "Firmar electrónicamente" desde la tabla.
  // Esta funcion SOLO valida pre-condiciones. NO crea la solicitud de firma
  // (eso es I-102.2.D via firma:sign-request:create). Tampoco abre el modal
  // de envio (eso es I-102.2.C). Por ahora muestra un toast con el estado
  // de la validacion para confirmar que el path end-to-end esta conectado.
  async _firmarElectronico(docId) {
    var self = this;
    // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL (visible en DevTools Console)
    console.log('[A154] _firmarElectronico ENTER docId=' + docId + ' self.companyName=' + JSON.stringify(self.companyName));
    try {
      // 1) Obtener el documento completo (incluye rutaArchivo, idSolicitudFirma, etc.)
      var r1 = await window.electronAPI.ghGetDocumento({ documentoId: docId });
      if (!r1 || !r1.success || !r1.data || !r1.data.documento) {
        self._showToast('No se encontró el documento: ' + docId, 'error');
        return;
      }
      var doc = r1.data.documento;

      // 2) Verificar que tenga archivo asociado (sin archivo no se puede firmar)
      if (!doc.rutaArchivo) {
        self._showToast('El documento no tiene archivo adjunto. Genera el documento con un template primero.', 'warning');
        return;
      }

      // 3) Verificar que la empresa actual tiene firma electrónica configurada
      var r2 = await window.electronAPI.firmaEmpresaList({});
      if (!r2 || !r2.success) {
        self._showToast('Error consultando configuración de firma: ' + (r2 && r2.error && r2.error.message || 'desconocido'), 'error');
        return;
      }
      var configured = (r2.data && r2.data.configured) || [];
      // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL (visible en DevTools Console)
      console.log('[A154] _firmarElectronico · firmaEmpresaList OK configured_count=' + configured.length + ' configured_keys=' + JSON.stringify(configured.map(function (c) { return c && c.companyKey; })));
      // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL — NO COMMITEAR
      // Registra self.companyName vs configured[].companyKey, con la misma
      // normalización que usa el bridge (lowercase + NFD + strip diacritics).
      // El agente CLI lee 'kair_doc_match' después.
      try {
        var _normMatch = function (s) {
          return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        };
        var _diagMatch = {
          ts: new Date().toISOString(),
          self_companyName: self.companyName,
          self_companyName_typeof: typeof self.companyName,
          self_companyName_norm: _normMatch(self.companyName),
          configured_count: configured.length,
          configured_keys: configured.map(function (c) { return c && c.companyKey; }),
          configured_keys_norm: configured.map(function (c) { return _normMatch(c && c.companyKey); }),
          match_will_be_found: configured.some(function (c) { return c && c.companyKey === self.companyName; }),
          match_will_be_found_norm: configured.some(function (c) { return _normMatch(c && c.companyKey) === _normMatch(self.companyName); })
        };
        localStorage.setItem('kair_doc_match', JSON.stringify(_diagMatch));
      } catch (_diagE) { /* noop */ }
      var match = configured.find(function (c) { return c.companyKey === self.companyName; });
      if (!match) {
        self._showToast(
          'La firma electrónica no está configurada para esta empresa (' + self.companyName + '). Configúrala primero en Configuración → Firma Electrónica.',
          'warning'
        );
        return;
      }

      // 4) Pre-condiciones OK. Abrir el modal de envío (I-102.2.C). La
      // creación de la solicitud se hace en I-102.2.D.
      self._abrirModalFirma(doc, match);
    } catch (e) {
      self._showToast('Error: ' + e.message, 'error');
    }
  }

  // I-102.2.C · Modal de envío a firma. Recoge el documento completo
  // (ya validado por _firmarElectronico) + la empresa configurada (match).
  // La creación de la solicitud de firma via firma:sign-request:create
  // se implementa en I-102.2.D.
  _abrirModalFirma(doc, match) {
    var self = this;
    var modal = this.container.querySelector('#doc-firma-modal');
    if (!modal) return;
    document.body.style.overflow = 'hidden';

    // Buscar info del trabajador (viene del listado cargado en _load).
    var t = this._trabajadorById[doc.trabajadorId];
    var tp = DocumentosComponent.TIPOS.find(function (x) { return x.value === doc.tipo; }) || { label: doc.tipo };

    // Resumen del documento (read-only).
    var docSummary = modal.querySelector('#doc-firma-doc-summary');
    if (docSummary) {
      docSummary.innerHTML =
        '<strong>' + self._esc(tp.label) + '</strong> · ' +
        'ID <code>' + self._esc(doc.id) + '</code><br>' +
        '<small style="color:#5a6378">Creado: ' + self._esc((doc.createdAt || '').split('T')[0] || '—') + '</small>';
    }

    // Resumen del firmante (read-only).
    var trabSummary = modal.querySelector('#doc-firma-trab-summary');
    if (trabSummary) {
      if (t) {
        trabSummary.innerHTML =
          '<strong>' + self._esc(t.nombres + ' ' + t.apellidos) + '</strong><br>' +
          '<small style="color:#5a6378">' +
            self._esc(t.cargo || '—') + ' · ' +
            'Cédula ' + self._esc(t.cedula || '—') +
          '</small>';
      } else {
        trabSummary.innerHTML = '<em style="color:#5a6378">Trabajador no encontrado (id=' + self._esc(doc.trabajadorId) + ')</em>';
      }
    }

    // Pre-llenar el correo si el trabajador ya tiene email en base_personal.
    var correoInput = modal.querySelector('#doc-firma-correo');
    if (correoInput) {
      correoInput.value = (t && t.email) ? t.email : '';
      correoInput.classList.remove('is-invalid');
      var correoErr = modal.querySelector('#doc-firma-correo-error');
      if (correoErr) correoErr.hidden = true;
    }

    // Checkbox de confirmación: desmarcar y deshabilitar el botón.
    var confirmInput = modal.querySelector('#doc-firma-confirmar');
    if (confirmInput) confirmInput.checked = false;
    var btnEnviar = modal.querySelector('#doc-firma-enviar');
    if (btnEnviar) btnEnviar.disabled = true;

    // Guardar referencia al doc+match en el modal para uso del wireup.
    modal._docFirmaCtx = { doc: doc, match: match, modal: modal };

    // Wireup de cierre: backdrop, X, Cancelar, Escape.
    modal.querySelectorAll('[data-close-doc-firma="1"]').forEach(function (el) {
      el.onclick = function () { self._cerrarModalFirma(modal); };
    });
    // Click en backdrop (no en panel) cierra.
    var backdrop = modal.querySelector('.doc-modal__backdrop');
    if (backdrop) {
      backdrop.onclick = function (e) {
        if (e.target === backdrop) self._cerrarModalFirma(modal);
      };
    }
    // Escape cierra.
    modal._onEscape = function (e) {
      if (e.key === 'Escape') self._cerrarModalFirma(modal);
    };
    document.addEventListener('keydown', modal._onEscape);

    // Wireup de validación en tiempo real: cada cambio en correo/checkbox
    // revalida y habilita/deshabilita el botón.
    function _revalidar() {
      var ok = self._validarFormularioFirma(modal);
      if (btnEnviar) btnEnviar.disabled = !ok;
    }
    if (correoInput) correoInput.addEventListener('input', _revalidar);
    if (confirmInput) confirmInput.addEventListener('change', _revalidar);

    // Wireup del botón Enviar a firma (I-102.2.D).
    if (btnEnviar) {
      btnEnviar.onclick = function () {
        // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL (visible en DevTools Console)
        console.log('[A154] btnEnviar.onclick FIRED self.companyName=' + JSON.stringify(self.companyName));
        if (!self._validarFormularioFirma(modal)) return;
        var ctx = modal._docFirmaCtx;
        self._enviarAFirma(modal, ctx, correoInput.value.trim());
      };
    }

    modal.removeAttribute('hidden');
    // Foco inicial en el campo correo.
    if (correoInput) setTimeout(function () { correoInput.focus(); correoInput.select(); }, 50);
  }

  // I-102.2.C · Cierra el modal de envío a firma.
  _cerrarModalFirma(modal) {
    if (!modal) return;
    if (modal._onEscape) {
      document.removeEventListener('keydown', modal._onEscape);
      modal._onEscape = null;
    }
    modal._docFirmaCtx = null;
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  // I-102.2.C · Valida el formulario de envío. Retorna true si está OK.
  // Reglas:
  //   - correo: regex simple (no perfecto, suficiente para v1)
  //   - checkbox: debe estar marcado
  // Marca errores visuales con .is-invalid y muestra .doc-field__error.
  _validarFormularioFirma(modal) {
    var correoInput = modal.querySelector('#doc-firma-correo');
    var correoErr = modal.querySelector('#doc-firma-correo-error');
    var confirmInput = modal.querySelector('#doc-firma-confirmar');

    var correo = (correoInput && correoInput.value || '').trim();
    var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var correoOk = re.test(correo);

    if (correoInput) {
      correoInput.classList.toggle('is-invalid', !correoOk);
    }
    if (correoErr) {
      correoErr.hidden = correoOk;
    }

    var confirmOk = !!(confirmInput && confirmInput.checked);
    return correoOk && confirmOk;
  }

  // I-102.2.D · Convierte bytes del PDF en base64.
  // Devuelve un Uint8Array para que crypto.subtle.digest opere.
  _base64ToBytes(b64) {
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  _bytesToHex(buf) {
    var hex = '';
    for (var i = 0; i < buf.length; i++) {
      var b = buf[i].toString(16);
      if (b.length === 1) hex += '0';
      hex += b;
    }
    return hex;
  }

  // I-102.2.D · Convierte errores tipados del backend/firma-service a mensajes
  // comprensibles para el usuario. Mapea códigos AppError a español.
  _traducirErrorFirma(r) {
    if (!r || !r.error) return 'Error desconocido al enviar a firma';
    var code = r.error.code || 'INTERNAL';
    var msg = r.error.message || '';
    var map = {
      'INVALID_REQUEST_BODY': 'Datos de la solicitud incompletos o inválidos.',
      'CONFIG_MISSING': 'La firma electrónica no está configurada. Configúrala primero en Configuración → Firma Electrónica.',
      'ADMIN_TOKEN_REQUIRED': 'Falta el admin token. Configúralo en Configuración → Firma Electrónica.',
      'EMPRESA_MISMATCH': 'La empresa del documento no coincide con la firma configurada.',
      'INVALID_API_KEY': 'API key inválida o revocada. Configura una nueva.',
      'NOT_FOUND': 'Recurso no encontrado en firma-service.',
      'RATE_LIMIT_EXCEEDED': 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.',
      'PAYLOAD_TOO_LARGE': 'El PDF es demasiado grande (>50 MB).',
      'INVALID_INPUT': 'Datos inválidos: ' + msg,
      'NO_DB': 'BD local no disponible. Reinstala K+AIR.',
      'TRABAJADOR_NOT_FOUND': 'El trabajador ya no existe en esta empresa.',
      'CLIENT_NOT_FOUND': 'No hay firma configurada para esta empresa.',
      'INTERNAL': 'Error interno del servicio de firma.'
    };
    return map[code] || ('Error al enviar a firma: ' + (msg || code));
  }

  // I-102.2.D · Envía el documento a firma: crea la sign request, guarda
  // idSolicitudFirma y cambia estado a 'esperando_firma'.
  // No hace polling, no descarga documento firmado, no detecta SIGN_COMMITTED
  // (todo eso es I-102.2.F/G).
  async _enviarAFirma(modal, ctx, correoFirmante) {
    var self = this;
    // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL (visible en DevTools Console)
    console.log('[A154] _enviarAFirma ENTER self.companyName=' + JSON.stringify(self.companyName) + ' correoFirmante_length=' + (correoFirmante || '').length);
    var btnEnviar = modal.querySelector('#doc-firma-enviar');
    var doc = ctx.doc;
    var match = ctx.match;
    var t = this._trabajadorById[doc.trabajadorId];

    // 1) UI: deshabilitar botón y mostrar "Enviando..."
    if (btnEnviar) {
      btnEnviar.disabled = true;
      btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    }

    try {
      // 2) Obtener acuerdo activo (texto_hash + version)
      // I-103.A1.5.4-B · fix: pasar companyName explícitamente para que el
      // bridge entre al path per-empresa (no legacy). Sin esto, _resolveClientForRequest
      // cae al modo legacy y retorna CONFIG_MISSING (legacy key vacía en __default__).
      var rAgr = await window.electronAPI.firmaAgreementGet({ companyName: self.companyName });
      // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL (visible en DevTools Console)
      console.log('[A154] _enviarAFirma · firmaAgreementGet result: success=' + (rAgr && rAgr.success) + ' has_data=' + !!(rAgr && rAgr.data) + ' has_texto_hash=' + !!(rAgr && rAgr.data && rAgr.data.texto_hash));
      if (!rAgr || !rAgr.success) {
        console.log('[A154] _enviarAFirma · EXIT in firmaAgreementGet (no success). Toast: ' + self._traducirErrorFirma(rAgr));
        self._showToast(self._traducirErrorFirma(rAgr), 'error');
        return;
      }
      var agreement = rAgr.data;
      if (!agreement || !agreement.texto_hash) {
        console.log('[A154] _enviarAFirma · EXIT (no agreement.texto_hash)');
        self._showToast('El acuerdo activo no tiene hash. Contacta al administrador.', 'error');
        return;
      }

      // 3) Leer bytes del PDF desde el disco (bridge hace fs.readFileSync)
      // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL (visible en DevTools Console)
      console.log('[A154] _enviarAFirma · firmaDocumentoReadBytes CALL', JSON.stringify({
        doc_rutaArchivo_present: !!(doc && doc.rutaArchivo),
        doc_rutaArchivo_typeof: typeof (doc && doc.rutaArchivo),
        doc_rutaArchivo_length: ((doc && doc.rutaArchivo) || '').length,
        arg_sent_typeof: typeof ({ rutaArchivo: doc.rutaArchivo }),
        arg_sent_isObject: (typeof { rutaArchivo: doc.rutaArchivo }) === 'object',
        arg_sent_keys: Object.keys({ rutaArchivo: doc.rutaArchivo })
      }));
      var rRead = await window.electronAPI.firmaDocumentoReadBytes({ rutaArchivo: doc.rutaArchivo });
      // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL (visible en DevTools Console)
      console.log('[A154] _enviarAFirma · firmaDocumentoReadBytes result: success=' + (rRead && rRead.success) + ' has_data=' + !!(rRead && rRead.data) + ' rutaArchivo_length=' + (doc.rutaArchivo || '').length);
      if (!rRead || !rRead.success) {
        console.log('[A154] _enviarAFirma · EXIT in firmaDocumentoReadBytes. Toast: No se pudo leer el PDF');
        self._showToast('No se pudo leer el PDF: ' + (rRead && rRead.error && rRead.error.message || 'desconocido'), 'error');
        return;
      }

      // 4) Calcular SHA-256 del PDF con Web Crypto
      var pdfBytes = self._base64ToBytes(rRead.data.data);
      var hashBuf = await crypto.subtle.digest('SHA-256', pdfBytes);
      var documentHash = self._bytesToHex(new Uint8Array(hashBuf));

      // 5) I-103.A1.5.3.1 (Bug 2 fix) · Crear y aceptar consentimiento del Acuerdo.
      //    El Bloque E6 requiere que el sign request con agreement_version
      //    esté vinculado a un consent_id ACEPTADO. Sin esto, el commit
      //    del firmante falla con 409 CONSENT_NOT_ACCEPTED.
      //
      //    Contratos verificados (firma-bridge.js + firma-client.js +
      //    routes/consent.js + services/consent.js):
      //      firmaConsentCreate({id_trabajador, id_empresa, version_acuerdo,
      //                          correo_verificacion, kair_version})
      //        - 201: {consent_id, ..., devOtp? (solo dev)}
      //        - 200: {already_accepted: true, consent_id}
      //        - 409 CONSENT_PENDING: ya existe uno pendiente
      //        - 404 ACUERDO_NOT_FOUND: no hay acuerdo activo con esa version
      //        - 409 CONSENT_LOCKED: OTP bloqueado por intentos
      //      firmaConsentVerifyOtp(consentId, otp)
      //        - 200: {consent_id, estado: 'ACCEPTED'}
      //        - 404/409/422 según estado
      //
      //    IMPORTANTE: id_trabajador es la CÉDULA del firmante (por
      //    convención del proyecto, ver comment en signRequest.js línea 27).
      //    Lo tomamos del trabajador asociado al documento.
      var cedulaFirmante = (t && (t.cedula || t.id)) || doc.trabajadorId;
      var rConsent = await window.electronAPI.firmaConsentCreate({
        // I-103.A1.5.4-B · fix: pasar companyName explícitamente para que el
        // bridge entre al path per-empresa (no legacy). Sin esto, _resolveClientForRequest
        // cae al modo legacy y retorna CONFIG_MISSING (legacy key vacía en __default__).
        companyName: self.companyName,
        id_trabajador: cedulaFirmante,
        id_empresa: match.idEmpresa,
        version_acuerdo: agreement.version,
        correo_verificacion: correoFirmante,
        kair_version: '0.1.190'
      });
      // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL (visible en DevTools Console)
      console.log('[A154] _enviarAFirma · firmaConsentCreate result: success=' + (rConsent && rConsent.success) + ' already_accepted=' + !!(rConsent && rConsent.data && rConsent.data.already_accepted) + ' has_devOtp=' + !!(rConsent && rConsent.data && rConsent.data.devOtp) + ' error_code=' + (rConsent && rConsent.error && rConsent.error.code));
      var consentId = null;
      if (rConsent && rConsent.success) {
        if (rConsent.data.already_accepted) {
          // Caso 200: ya estaba aceptado previamente. Usar el consent_id
          // existente (idempotente).
          consentId = rConsent.data.consent_id;
          console.log('[A154] _enviarAFirma · consent already_accepted consentId=' + consentId);
          // No mostramos toast — el flujo continúa normal.
        } else {
          // Caso 201: nuevo. Aceptar con devOtp si está disponible (dev).
          consentId = rConsent.data.consent_id;
          console.log('[A154] _enviarAFirma · consent nuevo consentId=' + consentId + ' has_devOtp=' + !!rConsent.data.devOtp);
          if (rConsent.data.devOtp) {
            var rVerify = await window.electronAPI.firmaConsentVerifyOtp(consentId, rConsent.data.devOtp);
            console.log('[A154] _enviarAFirma · firmaConsentVerifyOtp result: success=' + (rVerify && rVerify.success));
            if (!rVerify || !rVerify.success) {
              console.log('[A154] _enviarAFirma · EXIT in firmaConsentVerifyOtp. Toast: Error aceptando consentimiento');
              self._showToast('Error aceptando consentimiento: ' +
                (rVerify && rVerify.error && rVerify.error.message || 'desconocido'), 'error');
              return;
            }
          } else {
            // Caso production: el OTP se envió al correo del firmante vía
            // mailer.sendOTP (consume el flujo de K+AIR). K+AIR NO puede
            // aceptar el consent sin el OTP. El sign request se creará con
            // consent_id PENDING y el commit del firmante fallará con
            // CONSENT_NOT_ACCEPTED hasta que se implemente un flujo de
            // aceptación en la mini-app del firmante. Esto es un gap
            // conocido del producto (fuera de scope de A1.5.3.1).
            // Lo logueamos con WARN para que sea visible en operación.
            console.warn(
              '[A1.5.3.1][production] Consent OTP enviado al firmante (' +
              correoFirmante + '). K+AIR NO puede aceptar el consent sin ' +
              'el OTP. El sign request se creará con consent_id PENDING y ' +
              'el commit() del firmante fallará con CONSENT_NOT_ACCEPTED. ' +
              'Pendiente: flujo de aceptación en la mini-app del firmante.'
            );
          }
        }
      } else if (rConsent && rConsent.error) {
        if (rConsent.error.code === 'CONSENT_PENDING') {
          console.log('[A154] _enviarAFirma · EXIT in consent (CONSENT_PENDING). Toast: Ya existe un consentimiento en proceso');
          // Ya existe un consent PENDING. El OTP se envió al firmante
          // previamente. NO podemos continuar sin el OTP. Mostramos mensaje
          // claro al user para que sepa qué hacer.
          self._showToast(
            'Ya existe un consentimiento en proceso para este trabajador. ' +
            'Espera a que el firmante acepte el código OTP enviado a su correo, ' +
            'o contacta a RRHH para reintentar.', 'warning'
          );
          return;
        } else if (rConsent.error.code === 'CONSENT_LOCKED') {
          console.log('[A154] _enviarAFirma · EXIT in consent (CONSENT_LOCKED). Toast: Consentimiento bloqueado');
          self._showToast(
            'El consentimiento del Acuerdo está bloqueado por exceso de intentos. ' +
            'Contacta a RRHH para desbloquearlo.', 'error'
          );
          return;
        } else if (rConsent.error.code === 'ACUERDO_NOT_FOUND') {
          console.log('[A154] _enviarAFirma · EXIT in consent (ACUERDO_NOT_FOUND). Toast: No hay Acuerdo activo');
          self._showToast(
            'No hay Acuerdo activo con la versión ' + agreement.version + '. ' +
            'Contacta al administrador.', 'error'
          );
          return;
        } else {
          console.log('[A154] _enviarAFirma · EXIT in consent (otro error: ' + rConsent.error.code + ')');
          self._showToast(self._traducirErrorFirma(rConsent), 'error');
          return;
        }
      } else {
        console.log('[A154] _enviarAFirma · EXIT in consent (error desconocido creando consentimiento)');
        self._showToast('Error desconocido creando consentimiento.', 'error');
        return;
      }

      // 6) Construir metadata del sign request
      var metadata = {
        id_documento: doc.id,
        id_trabajador: cedulaFirmante,
        id_empresa: match.idEmpresa,
        tipo_firma: 'remoto',
        agreement_version: agreement.version,
        agreement_hash: agreement.texto_hash,
        document_hash: documentHash,
        version_kair: '0.1.190',
        ttl_horas: 24,
        // I-103.A1.5.3.1 (Bug 2 fix) · consent_id REQUERIDO cuando el sign
        // request tiene agreement_version. El Bloque E6 valida que el
        // consent esté ACEPTADO en el mismo (id_trabajador, id_empresa,
        // version_acuerdo). Si no, commit() retorna 409 CONSENT_NOT_ACCEPTED.
        consent_id: consentId,
        // I-103.A1.5.3.1 (Bug adicional encontrado en A1.5.4-A) ·
        // identificacion_tipo y identificacion_numero_hash son REQUERIDOS
        // para que publicFlow.identify pueda validar la cédula del firmante.
        // Sin ellos, el commit del firmante falla con 500
        // MISSING_IDENTIFICATION_DATA. La cédula del firmante es la misma
        // que id_trabajador (convención del proyecto). El hash es SHA-256
        // del número de documento en plano (sin sal en v1).
        // K+AIR ya conoce la cédula (viene del trabajador asociado al
        // documento), así que la calculamos acá.
        identificacion_tipo: 'CC',
        identificacion_numero_hash: self._bytesToHex(
          new Uint8Array(await crypto.subtle.digest('SHA-256',
            new TextEncoder().encode(cedulaFirmante)))
        ),
        // I-103.A1.5.3 + A1.5.4 fix · `correo` va DENTRO del sub-objeto
        // `metadata` (JSON string), NO top-level. El contrato del backend
        // (services/signRequest.js#create, líneas 318-347) es:
        //   - `metadata` es un JSON string con campos extra
        //   - el service hace JSON.parse y los preserva en la columna
        //     `metadata` de la BD junto con `_server_metadata`
        // El backend (services/publicFlow.js líneas 289 y 550) lee
        // `signRequest.metadata.correo` para enviar el OTP al firmante.
        // Si mandamos `correo` top-level, zod lo acepta como campo extra
        // PERO el service solo guarda `meta.metadata` (que es undefined),
        // entonces el `correo` se pierde y el OTP va al placeholder
        // 'trabajador@ejemplo.com' (bug encontrado en A1.5.4-A).
        metadata: JSON.stringify({ correo: correoFirmante })
      };

      // 7) Crear la sign request
      // I-103.A1.5.4-B · Defensa en profundidad: validar header mágico %PDF-
      // ANTES de enviar a firma-service. No confiamos solo en la extensión
      // del archivo (renombrar .doc a .pdf no lo convierte en PDF). Si los
      // primeros 5 bytes no son 25 50 44 46 2D, detenemos con mensaje claro
      // en vez de gastar una request que firma-service rechazará con
      // PDF_INVALID ("Header mágico inválido").
      try {
        var _isPdfHeader = pdfBytes && pdfBytes.length >= 5
          && pdfBytes[0] === 0x25 && pdfBytes[1] === 0x50
          && pdfBytes[2] === 0x44 && pdfBytes[3] === 0x46
          && pdfBytes[4] === 0x2D;
        if (!_isPdfHeader) {
          console.log('[A154] _enviarAFirma · EXIT (no es PDF) first_bytes_hex=' + self._bytesToHex(pdfBytes.slice(0, 8)) + ' nombreArchivo=' + doc.nombreArchivo);
          self._showToast('El documento "' + (doc.nombreArchivo || doc.id) + '" no es un PDF válido. Solo se pueden firmar PDFs.', 'error');
          return;
        }
      } catch (_pdfHeaderE) { /* noop */ }
      // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL (visible en DevTools Console)
      console.log('[A154] _enviarAFirma · about to call firmaSignRequestCreate args_companyName=' + JSON.stringify(self.companyName) + ' args_pdfBuffer_length=' + pdfBytes.length);
      // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL — NO COMMITEAR
      // Registra el estado de self.companyName y del objeto args ANTES de
      // enviarlo al bridge. Usa localStorage porque el renderer no tiene
      // acceso a fs. El agente CLI lee 'kair_doc_diag' después.
      try {
        var _diagArgs = {
          ts: new Date().toISOString(),
          self_companyName_present: typeof self.companyName === 'string' && self.companyName.length > 0,
          self_companyName_length: typeof self.companyName === 'string' ? self.companyName.length : 0,
          self_companyName_typeof: typeof self.companyName,
          args_keys: ['companyName', 'metadata', 'pdfBuffer', 'pdfName'],
          args_companyName_present: typeof self.companyName === 'string' && self.companyName.length > 0,
          args_companyName_typeof: typeof self.companyName,
          args_companyName_length: typeof self.companyName === 'string' ? self.companyName.length : 0
        };
        localStorage.setItem('kair_doc_diag', JSON.stringify(_diagArgs));
      } catch (_diagE) { /* noop */ }
      var rCreate = await window.electronAPI.firmaSignRequestCreate({
        companyName: self.companyName,
        metadata: metadata,
        pdfBuffer: pdfBytes,
        pdfName: (doc.nombreArchivo || (doc.id + '.pdf'))
      });
      // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL (visible en DevTools Console)
      console.log('[A154] _enviarAFirma · firmaSignRequestCreate RETURNED: success=' + (rCreate && rCreate.success) + ' error_code=' + (rCreate && rCreate.error && rCreate.error.code) + ' has_id_solicitud=' + !!(rCreate && rCreate.data && rCreate.data.id_solicitud) + ' has_url_publica=' + !!(rCreate && rCreate.data && rCreate.data.url_publica));
      if (!rCreate || !rCreate.success) {
        console.log('[A154] _enviarAFirma · EXIT in firmaSignRequestCreate (no success). Toast: ' + self._traducirErrorFirma(rCreate));
        self._showToast(self._traducirErrorFirma(rCreate), 'error');
        return;
      }
      var idSolicitud = rCreate.data && (rCreate.data.id_solicitud || rCreate.data.id);
      if (!idSolicitud) {
        console.log('[A154] _enviarAFirma · EXIT (no idSolicitud en response)');
        self._showToast('firma-service no devolvió id_solicitud. Revisa el backend.', 'error');
        return;
      }
      console.log('[A154] _enviarAFirma · sign request OK id_solicitud=' + idSolicitud + ' url_publica_present=' + !!(rCreate.data && rCreate.data.url_publica));
      // I-103.A1.5.3 · Capturar url_publica de la respuesta para mostrarla
      // en el modal de éxito. Es la URL que el firmante usará para abrir
      // la mini-app de firma.
      var urlPublica = rCreate.data && rCreate.data.url_publica;

      // 8) Persistir la relación y cambiar estado a 'esperando_firma'
      var rUpd = await window.electronAPI.ghUpdateDocumento({
        documentoId: doc.id,
        updates: {
          idSolicitudFirma: idSolicitud,
          estado: 'esperando_firma'
        }
      });
      console.log('[A154] _enviarAFirma · ghUpdateDocumento result: success=' + (rUpd && rUpd.success) + ' error_code=' + (rUpd && rUpd.error && rUpd.error.code));
      if (!rUpd || !rUpd.success) {
        console.log('[A154] _enviarAFirma · EXIT in ghUpdateDocumento');
        self._showToast('Solicitud creada (id=' + idSolicitud + ') pero NO se pudo persistir la relación. ' +
          (rUpd && rUpd.error && rUpd.error.message || ''), 'error');
        return;
      }

      // 9) Cerrar modal de envío, refrescar tabla y abrir modal de éxito
      //    con id + url_publica + correo. El documento YA está persistido
      //    en 'esperando_firma' antes de este punto, así que cerrar el
      //    modal de éxito NO afecta la solicitud.
      self._cerrarModalFirma(modal);
      self._showToast('Solicitud de firma creada: ' + idSolicitud, 'success');
      // Refrescar tabla para que el doc aparezca como 'esperando_firma'
      // ANTES de mostrar el modal de éxito. Si el polling F/G detecta
      // un cambio de estado mientras el modal está abierto, _renderRecientes
      // se llama y la tabla se actualiza en vivo.
      await self._load();
      self.render();
      // Abrir modal de éxito con la info del sign request
      self._abrirModalExito({
        companyName: self.companyName,
        id_solicitud: idSolicitud,
        url_publica: urlPublica || '',
        correo: correoFirmante
      });
    } catch (e) {
      // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL (visible en DevTools Console)
      console.log('[A154] _enviarAFirma · CATCH exception: ' + (e && e.message || e));
      self._showToast('Error inesperado: ' + (e && e.message || e), 'error');
    } finally {
      if (btnEnviar) {
        btnEnviar.disabled = false;
        btnEnviar.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar a firma';
      }
    }
  }

  // I-103.A1.5.3 · Modal de éxito de solicitud de firma.
  // Muestra: id de la solicitud, URL pública, correo del firmante.
  // Ofrece: Copiar enlace + Enviar por correo (vía notify-remote) + Listo.
  // El modal es INDEPENDIENTE del modal de envío (usa data-close-doc-firma-success).
  // El modal de envío se cierra ANTES de llamar a esta función.
  _abrirModalExito(info) {
    var self = this;
    var modal = this.container.querySelector('#doc-firma-success-modal');
    if (!modal) return;
    document.body.style.overflow = 'hidden';

    // Setear campos (read-only, ya vienen del flujo de envío).
    var idEl = modal.querySelector('#doc-firma-success-id');
    if (idEl) idEl.textContent = info.id_solicitud || '—';
    var urlInput = modal.querySelector('#doc-firma-success-url');
    if (urlInput) urlInput.value = info.url_publica || '';
    var correoInput = modal.querySelector('#doc-firma-success-correo');
    if (correoInput) correoInput.value = info.correo || '';

    // Limpiar feedback previo (por si se reusa el modal en un re-envío).
    var feedback = modal.querySelector('#doc-firma-success-feedback');
    if (feedback) {
      feedback.hidden = true;
      feedback.textContent = '';
      feedback.className = 'doc-field__hint';
    }

    // Resetear estado de los botones (por si vienen de un re-envío previo).
    var btnCopy = modal.querySelector('#doc-firma-success-copy');
    if (btnCopy) {
      btnCopy.disabled = false;
      btnCopy.innerHTML = '<i class="fas fa-copy"></i> Copiar';
    }
    var btnSend = modal.querySelector('#doc-firma-success-send');
    if (btnSend) {
      btnSend.disabled = false;
      btnSend.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar por correo';
    }

    // Guardar contexto para uso de los handlers.
    modal._docFirmaSuccessCtx = { info: info, modal: modal };

    // Escape handler (mismo patrón que _abrirModalFirma).
    modal._onEscape = function (e) {
      if (e.key === 'Escape') self._cerrarModalExito(modal);
    };
    document.addEventListener('keydown', modal._onEscape);

    modal.removeAttribute('hidden');
    // Foco en el botón "Enviar por correo" (acción primaria esperada).
    setTimeout(function () { if (btnSend) btnSend.focus(); }, 50);
  }

  // I-103.A1.5.3 · Cierra el modal de éxito. Limpia el listener de Escape.
  // NO recarga la tabla — eso ya se hizo en _enviarAFirma antes de
  // abrir este modal. El modal de éxito es puramente informativo +
  // acciones secundarias (copiar, enviar correo, cerrar).
  _cerrarModalExito(modal) {
    if (!modal) return;
    if (modal._onEscape) {
      document.removeEventListener('keydown', modal._onEscape);
      modal._onEscape = null;
    }
    modal._docFirmaSuccessCtx = null;
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  // I-103.A1.5.3 · Copia la URL pública al portapapeles usando
  // navigator.clipboard.writeText. Fallback a execCommand si la
  // Clipboard API no está disponible (electron viejos / contextos
  // inseguros).
  _copiarEnlace(modal) {
    var self = this;
    if (!modal) return;
    var ctx = modal._docFirmaSuccessCtx;
    if (!ctx || !ctx.info || !ctx.info.url_publica) {
      self._showToast('No hay enlace para copiar.', 'warning');
      return;
    }
    var url = ctx.info.url_publica;
    var feedback = modal.querySelector('#doc-firma-success-feedback');
    var btnCopy = modal.querySelector('#doc-firma-success-copy');
    function _onSuccess() {
      if (btnCopy) {
        btnCopy.innerHTML = '<i class="fas fa-check"></i> Copiado';
        setTimeout(function () {
          if (btnCopy) btnCopy.innerHTML = '<i class="fas fa-copy"></i> Copiar';
        }, 2000);
      }
      if (feedback) {
        feedback.textContent = 'Enlace copiado al portapapeles.';
        feedback.className = 'doc-field__hint';
        feedback.style.color = '#28a745';
        feedback.hidden = false;
      }
    }
    function _onFallback() {
      // Fallback para contextos sin Clipboard API: crear un textarea
      // temporal, seleccionar y copiar.
      try {
        var ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) {
          _onSuccess();
        } else {
          if (feedback) {
            feedback.textContent = 'No se pudo copiar automáticamente. Selecciona y copia manualmente.';
            feedback.style.color = '#fd7e14';
            feedback.hidden = false;
          }
        }
      } catch (e) {
        if (feedback) {
          feedback.textContent = 'No se pudo copiar. Error: ' + (e && e.message || 'desconocido');
          feedback.style.color = '#dc3545';
          feedback.hidden = false;
        }
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(_onSuccess).catch(_onFallback);
    } else {
      _onFallback();
    }
  }

  // I-103.A1.5.3 · Llama al IPC firma:sign-request:notify-remote (A1.5.2)
  // para enviar la invitación por correo al firmante. Muestra feedback
  // inline en el modal (no toast — el user está mirando el modal).
  // Si el envío falla, NO cierra el modal: el user puede reintentar o
  // cerrar manualmente.
  async _enviarCorreoFirmante(modal) {
    var self = this;
    if (!modal) return;
    var ctx = modal._docFirmaSuccessCtx;
    if (!ctx || !ctx.info) return;
    var info = ctx.info;
    var feedback = modal.querySelector('#doc-firma-success-feedback');
    var btnSend = modal.querySelector('#doc-firma-success-send');

    // UI: spinner mientras se envía
    if (btnSend) {
      btnSend.disabled = true;
      btnSend.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    }
    if (feedback) {
      feedback.textContent = '';
      feedback.hidden = true;
    }

    try {
      var r = await window.electronAPI.firmaSignRequestNotifyRemote(
        info.id_solicitud,
        { companyName: info.companyName, correo: info.correo, context: { via: 'kair-documentos-ui', button: 'enviar-correo' } }
      );
      if (r && r.success) {
        if (feedback) {
          feedback.textContent = 'Correo enviado a ' + info.correo + '. El firmante recibirá el enlace para firmar.';
          feedback.style.color = '#28a745';
          feedback.hidden = false;
        }
        if (btnSend) {
          btnSend.innerHTML = '<i class="fas fa-check"></i> Enviado';
        }
      } else {
        // Mapear error a mensaje user-friendly usando el helper existente.
        if (feedback) {
          feedback.textContent = 'Error al enviar: ' + (self._traducirErrorFirma(r) || 'desconocido');
          feedback.style.color = '#dc3545';
          feedback.hidden = false;
        }
        if (btnSend) {
          btnSend.disabled = false;
          btnSend.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar por correo';
        }
      }
    } catch (e) {
      if (feedback) {
        feedback.textContent = 'Error inesperado: ' + (e && e.message || e);
        feedback.style.color = '#dc3545';
        feedback.hidden = false;
      }
      if (btnSend) {
        btnSend.disabled = false;
        btnSend.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar por correo';
      }
    }
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
      var r = await window.electronAPI.ghGetDocumento({ documentoId: docId });
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

    // Wireup del botón "Generar" (LEGACY-SIGN-REMOVE: antes "Generar y Firmar").
    var btnConfirm = modal.querySelector('#doc-gen-confirm');
    if (btnConfirm) {
      btnConfirm.onclick = function () {
        var trabajadorId = sel ? sel.value : null;
        if (!trabajadorId) { self._showToast('Selecciona un trabajador', 'warning'); return; }
        if (!self._selectedTipo) { self._showToast('Selecciona un tipo de documento', 'warning'); return; }
        self._generarDocumento(trabajadorId, self._selectedTipo, modal);
      };
    }

    modal.removeAttribute('hidden');
  }

  // 📦764 · Genera el documento en BD (sin firma — LEGACY-SIGN-REMOVE).
  // El documento queda en estado='pendiente'. La firma electrónica se hace
  // luego desde la tabla via firma-service (I-102).
  async _generarDocumento(trabajadorId, tipo, generarModal) {
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
      this._closeDocModal(generarModal);
      this._showToast('Documento generado. Pendiente de firma electrónica.', 'success');
      await this._load();
      this.render();
    } catch (e) { this._showToast('Error: ' + e.message, 'error'); }
  }

  // FUNCIONES ELIMINADAS en LEGACY-SIGN-REMOVE (2026-08-20):
  //   - _openFirmaModal (modal de canvas)
  //   - _saveFirma (gh:create-firma + gh:firmar-documento)
  //   - _firmar (entry point desde botón Firmar en tabla)
  //   - _generarYAbrirFirma (renombrada a _generarDocumento, ya no abre firma)
  // La firma se hace ahora únicamente por vía electrónica (firma-service, I-101+).

  destroy() {
    // I-102.2.F · Detener polling al desmontar el componente.
    if (typeof this._detenerPolling === 'function') {
      this._detenerPolling();
    }
  }
}

window.DocumentosComponent = DocumentosComponent;
