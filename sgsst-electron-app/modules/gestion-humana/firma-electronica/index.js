/**
 * modules/gestion-humana/firma-electronica/index.js
 * I-103.A1.6 · Firma electrónica — Centro de control del proceso de firma por trabajador.
 *
 * Fase 1 (esta fase):
 *   - Tabla principal centrada en el TRABAJADOR (no en el documento).
 *   - Una fila por trabajador con estado agregado del proceso.
 *   - Buscador por nombre, cédula, correo o ID de solicitud.
 *   - Pills de filtros rápidos por estado del proceso.
 *   - Barra de progreso y desglose "X firmados · Y esperando · Z pendientes".
 *   - Modal de expediente como PLACEHOLDER (Fase 2).
 *
 * NO consulta firma-service en Fase 1. Solo lee datos locales de K+AIR
 * (gh_documentos, gh_personal) via los IPC ya existentes.
 *
 * Reglas:
 *   - No modifica firma-service, firma-bridge, preload ni la lógica A1.5.4-B.
 *   - Multi-empresa: el companyName viene del constructor (gestion-humana-home).
 *   - companyName se preserva y se pasa a IPCs.
 *
 * @param {HTMLElement} container  - Contenedor donde se monta el componente
 * @param {string}      companyName - Empresa activa (multiempresa)
 * @param {string}      moduleName  - "Gestión Humana"
 * @param {string}      subName     - "Firma electrónica"
 * @param {function}    onBack      - Callback para volver al home del módulo
 */
'use strict';

(function () {
  var COMPONENT_NAME = 'FirmaElectronicaComponent';

  // Estados principales del PROCESO del trabajador (no del documento individual).
  // Los estados técnicos (PENDING, OTP_PENDING, SIGNED, etc.) solo aparecen
  // dentro del expediente (Fase 2).
  var ESTADOS_PROCESO = {
    PENDIENTE:       'pendiente',
    EN_PREPARACION:  'en_preparacion',
    EN_PROCESO:      'en_proceso',
    COMPLETADO:      'completado',
    RECHAZADO:       'rechazado',
    VENCIDO:         'vencido',
    CANCELADO:       'cancelado',
    ERROR:           'error'
  };

  // Etiquetas humanas para cada estado
  var ESTADOS_LABELS = {
    pendiente:       'Pendiente',
    en_preparacion:  'En preparación',
    en_proceso:      'En proceso',
    completado:      'Completado',
    rechazado:       'Rechazado',
    vencido:         'Vencido',
    cancelado:       'Cancelado',
    error:           'Error'
  };

  // Rank de orden para la tabla
  var ESTADOS_ORDER = {
    en_proceso: 0, en_preparacion: 1, pendiente: 2,
    rechazado: 3, vencido: 4, cancelado: 5, error: 6,
    completado: 7
  };

  // HTML escape
  function _esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function FirmaElectronicaComponent(container, companyName, moduleName, subName, onBack) {
    this.container = container;
    this.companyName = companyName || null;
    this.moduleName = moduleName || 'Gestión Humana';
    this.subName = subName || 'Firma electrónica';
    this.onBack = typeof onBack === 'function' ? onBack : null;

    this._documentos = [];
    this._trabajadores = [];
    this._trabajadorById = {};
    this._procesosPorTrabajador = []; // resultado del cálculo agregado
    this._filtroEstado = 'todos';
    this._busqueda = '';
    this._cargando = false;
    this._toastTimer = null;
    this._escKeyHandler = null;
  }

  FirmaElectronicaComponent.prototype.render = function () {
    var self = this;
    if (!self.container) return;
    self.container.innerHTML = self._getShellHtml();
    self._cacheRefs();
    self._setupListeners();
    self._load();
  };

  FirmaElectronicaComponent.prototype._getShellHtml = function () {
    return [
      '<div class="fe-wrapper" id="fe-wrapper">',
      '  <div class="fe-section-head">',
      '    <div class="fe-section-head__text">',
      '      <h2 class="fe-section-head__title">',
      '        <i class="fas fa-file-signature"></i> Firma electrónica',
      '      </h2>',
      '      <p class="fe-section-head__subtitle">',
      '        Centro de control del proceso de firma por trabajador · la firma es electrónica (firma-service)',
      '      </p>',
      '    </div>',
      '  </div>',
      '',
      '  <div class="fe-search-section">',
      '    <div class="fe-search">',
      '      <i class="fas fa-search fe-search__icon"></i>',
      '      <input id="fe-search-input" class="fe-search__input" type="search"',
      '        placeholder="Buscar trabajador, cédula, correo o ID de solicitud (ej. 548905)"',
      '        autocomplete="off" spellcheck="false" />',
      '    </div>',
      '  </div>',
      '',
      '  <div class="fe-filters-section">',
      '    <div class="fe-pills" id="fe-pills">',
      '      <button class="fe-pill fe-pill--active" data-filter="todos" type="button">Todos</button>',
      '      <button class="fe-pill" data-filter="pendiente" type="button"><span class="fe-pill__dot fe-pill__dot--pendiente"></span> Pendientes</button>',
      '      <button class="fe-pill" data-filter="en_preparacion" type="button"><span class="fe-pill__dot fe-pill__dot--preparacion"></span> En preparación</button>',
      '      <button class="fe-pill" data-filter="en_proceso" type="button"><span class="fe-pill__dot fe-pill__dot--proceso"></span> En proceso</button>',
      '      <button class="fe-pill" data-filter="completado" type="button"><span class="fe-pill__dot fe-pill__dot--completado"></span> Completados</button>',
      '      <button class="fe-pill" data-filter="rechazado" type="button"><span class="fe-pill__dot fe-pill__dot--rechazado"></span> Rechazados</button>',
      '      <button class="fe-pill" data-filter="vencido" type="button"><span class="fe-pill__dot fe-pill__dot--vencido"></span> Vencidos</button>',
      '      <button class="fe-pill" data-filter="cancelado" type="button"><span class="fe-pill__dot fe-pill__dot--cancelado"></span> Cancelados</button>',
      '      <button class="fe-pill" data-filter="error" type="button"><span class="fe-pill__dot fe-pill__dot--error"></span> Errores</button>',
      '    </div>',
      '    <button id="fe-filtros-avanzados" class="fe-btn fe-btn--ghost fe-btn--sm" type="button" disabled',
      '      title="Filtros avanzados — disponible en Fase 2">',
      '      <i class="fas fa-sliders"></i> Filtros avanzados',
      '    </button>',
      '  </div>',
      '',
      '  <div class="fe-count-section">',
      '    <span class="fe-count" id="fe-count">Cargando…</span>',
      '  </div>',
      '',
      '  <div class="fe-table-section">',
      '    <table class="fe-table" id="fe-table">',
      '      <thead>',
      '        <tr>',
      '          <th class="fe-table__th fe-table__th--trabajador">Trabajador</th>',
      '          <th class="fe-table__th fe-table__th--cedula">Cédula</th>',
      '          <th class="fe-table__th fe-table__th--estado">Estado del proceso</th>',
      '          <th class="fe-table__th fe-table__th--solicitudes">Solicitudes</th>',
      '          <th class="fe-table__th fe-table__th--accion">Acción</th>',
      '        </tr>',
      '      </thead>',
      '      <tbody id="fe-tbody"></tbody>',
      '    </table>',
      '  </div>',
      '</div>',
      '',
      '<div id="fe-expediente-modal" class="fe-modal" hidden>',
      '  <div class="fe-modal__overlay" data-close-modal="true"></div>',
      '  <div class="fe-modal__panel" role="dialog" aria-labelledby="fe-expediente-title">',
      '    <header class="fe-modal__header">',
      '      <h3 id="fe-expediente-title" class="fe-modal__title">',
      '        <i class="fas fa-file-signature"></i> Firma electrónica — Expediente',
      '      </h3>',
      '      <button class="fe-modal__close" data-close-modal="true" type="button" aria-label="Cerrar">',
      '        <i class="fas fa-times"></i>',
      '      </button>',
      '    </header>',
      '    <div class="fe-modal__body" id="fe-expediente-body"></div>',
      '  </div>',
      '</div>',
      '',
      '<div id="fe-toast" class="fe-toast" hidden></div>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._cacheRefs = function () {
    this._searchInput = this.container.querySelector('#fe-search-input');
    this._pillsContainer = this.container.querySelector('#fe-pills');
    this._countEl = this.container.querySelector('#fe-count');
    this._tbody = this.container.querySelector('#fe-tbody');
    this._modal = this.container.querySelector('#fe-expediente-modal');
    this._modalBody = this.container.querySelector('#fe-expediente-body');
    this._toast = this.container.querySelector('#fe-toast');
  };

  FirmaElectronicaComponent.prototype._setupListeners = function () {
    var self = this;

    // Buscador (con debounce de 120ms)
    if (self._searchInput) {
      var searchTimer = null;
      self._searchInput.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          self._busqueda = (self._searchInput.value || '').toLowerCase().trim();
          self._renderTabla();
        }, 120);
      });
    }

    // Pills de filtros
    if (self._pillsContainer) {
      self._pillsContainer.addEventListener('click', function (ev) {
        var btn = ev.target.closest('.fe-pill');
        if (!btn) return;
        var filter = btn.getAttribute('data-filter');
        if (!filter) return;
        self._filtroEstado = filter;
        var pills = self._pillsContainer.querySelectorAll('.fe-pill');
        pills.forEach(function (p) { p.classList.remove('fe-pill--active'); });
        btn.classList.add('fe-pill--active');
        self._renderTabla();
      });
    }

    // Click en botón "Ver" de la tabla (delegación)
    if (self._tbody) {
      self._tbody.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-action="ver-expediente"]');
        if (!btn) return;
        var tid = btn.getAttribute('data-trabajador-id');
        if (tid) self._abrirModalExpediente(tid);
      });
    }

    // Click en acciones del modal de expediente (delegación en el body del modal)
    if (self._modalBody) {
      self._modalBody.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-action]');
        if (!btn || !self._modal || self._modal.hidden) return;
        // Solo actuar sobre acciones que NO sean 'ver-expediente' (esas son de la tabla)
        var action = btn.getAttribute('data-action');
        if (action === 'ver-expediente') return;
        // Botones deshabilitados no actúan
        if (btn.disabled) return;
        var srId = btn.getAttribute('data-sr-id') || '';
        if (action === 'enviar-correo') {
          self._actionEnviarCorreo(srId);
        } else if (action === 'copiar-enlace') {
          self._actionCopiarEnlace(srId);
        }
      });
    }

    // Modal: click en overlay o botón cerrar
    if (self._modal) {
      self._modal.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-close-modal="true"]')) {
          self._cerrarModal();
        }
      });
    }

    // Escape para cerrar modal
    self._escKeyHandler = function (ev) {
      if (ev.key === 'Escape' && self._modal && !self._modal.hidden) {
        self._cerrarModal();
      }
    };
    document.addEventListener('keydown', self._escKeyHandler);
  };

  FirmaElectronicaComponent.prototype._load = async function () {
    var self = this;
    if (!window.electronAPI || !self.companyName) {
      if (self._countEl) self._countEl.textContent = 'Sin empresa activa';
      return;
    }
    self._cargando = true;
    try {
      var results = await Promise.all([
        window.electronAPI.ghListDocumentos({ companyName: self.companyName })
          .catch(function () { return { success: false }; }),
        window.electronAPI.ghListPersonal({ companyName: self.companyName })
          .catch(function () { return { success: false }; }),
        // FASE 2 (A1.5.4-B) · bp-ids con contratación en_proceso.
        // Solo esos se muestran como "Pendiente" en la tabla cuando no
        // tienen documentos aún. Esto evita que los 754 trabajadores sin
        // contratacion saturen la tabla.
        window.electronAPI.ghListTrabajadoresConContratacionActiva({ companyName: self.companyName })
          .catch(function () { return { success: false }; })
      ]);
      self._documentos = results[0].success ? (results[0].data.documentos || []) : [];
      self._trabajadores = results[1].success ? (results[1].data.personales || []) : [];
      self._bpsConContratacionActiva = results[2].success && results[2].data ? (results[2].data.bpIds || []) : [];
      self._trabajadorById = {};
      self._trabajadores.forEach(function (t) {
        self._trabajadorById[t.id] = t;
      });
    } catch (e) {
      self._showToast('Error cargando datos: ' + e.message, 'error');
      self._documentos = [];
      self._trabajadores = [];
    }
    self._cargando = false;
    self._calcularProcesos();
    self._renderTabla();
  };

  /**
   * Agrupa los documentos por trabajador y calcula el estado agregado del proceso.
   * Reglas:
   *   - Solo aparecen trabajadores que tienen al menos 1 documento.
   *   - Estados del documento gh_documentos:
   *     - 'pendiente' (lowercase en BD): docs sin solicitud creada
   *     - 'esperando_firma' o 'esperando': docs con solicitud creada, en curso
   *     - 'firmado': docs finalizados
   *     - 'anulado': docs anulados (excluidos del conteo de "vivos")
   *   - Estado agregado del PROCESO (Fase 1: solo desde datos locales):
   *     - Sin firma en curso y sin firmas: Pendiente
   *     - Hay firmas en curso (esperando o firmado parcialmente): En proceso
   *     - Todos firmados: Completado
   *     - Hay docs con id_solicitudFirma que NO están esperando ni firmados
   *       (estado técnico desconocido sin consultar firma-service): En preparación
   */
  FirmaElectronicaComponent.prototype._calcularProcesos = function () {
    var self = this;
    var docsPorTrabajador = {};
    self._documentos.forEach(function (d) {
      var tid = d.trabajadorId;
      if (!tid) return;
      if (!docsPorTrabajador[tid]) docsPorTrabajador[tid] = [];
      docsPorTrabajador[tid].push(d);
    });

    var procesos = [];
    Object.keys(docsPorTrabajador).forEach(function (tid) {
      var trab = self._trabajadorById[tid];
      if (!trab) return; // Trabajador borrado, omitir
      var docs = docsPorTrabajador[tid];
      var proceso = self._calcularEstadoProceso(docs);
      proceso.trabajador = trab;
      proceso.trabajadorId = tid;
      proceso.documentos = docs;
      // Número de solicitudes distintas (id_solicitudFirma únicas)
      var idsSolicitudSet = {};
      docs.forEach(function (d) {
        if (d.idSolicitudFirma) idsSolicitudSet[d.idSolicitudFirma] = true;
      });
      proceso.numSolicitudes = Object.keys(idsSolicitudSet).length;
      procesos.push(proceso);
    });

    // FASE 2 (A1.5.4-B) · Incluir los bp-ids con contratacion en_proceso
    // que NO tienen documentos aún. Aparecen como "Pendiente" y permiten
    // que el admin entre a su expediente para generar los documentos
    // desde la pantalla de Firma Electrónica. Esto cubre el caso
    // de Nueva Contratación: el bp-id se crea/vincula con la contratación
    // (FASE 1) y queda visible inmediatamente en esta tabla. NO se
    // incluyen los 748 trabajadores que existen en base_personal sin
    // tener una contratación activa.
    var bpsConContratacion = self._bpsConContratacionActiva || [];
    var bpsConContratacionSet = {};
    bpsConContratacion.forEach(function (bpId) { bpsConContratacionSet[bpId] = true; });
    var trabajadoresConProceso = {};
    procesos.forEach(function (p) { trabajadoresConProceso[p.trabajadorId] = true; });
    self._trabajadores.forEach(function (t) {
      if (!t || !t.id) return;
      if (trabajadoresConProceso[t.id]) return; // ya tiene docs, no duplicar
      if (!bpsConContratacionSet[t.id]) return; // solo bp-ids con contratacion activa
      procesos.push({
        estado: ESTADOS_PROCESO.PENDIENTE,
        total: 0, firmados: 0, esperando: 0, pendientes: 0, anulados: 0,
        conSolicitud: 0, progreso: 0,
        trabajador: t,
        trabajadorId: t.id,
        documentos: [],
        numSolicitudes: 0
      });
    });

    // Orden: En proceso primero, luego Pendientes, luego Completados al final
    procesos.sort(function (a, b) {
      var ra = ESTADOS_ORDER[a.estado] !== undefined ? ESTADOS_ORDER[a.estado] : 99;
      var rb = ESTADOS_ORDER[b.estado] !== undefined ? ESTADOS_ORDER[b.estado] : 99;
      if (ra !== rb) return ra - rb;
      var na = (a.trabajador.nombres + ' ' + a.trabajador.apellidos).toLowerCase();
      var nb = (b.trabajador.nombres + ' ' + b.trabajador.apellidos).toLowerCase();
      return na.localeCompare(nb);
    });

    self._procesosPorTrabajador = procesos;
  };

  FirmaElectronicaComponent.prototype._calcularEstadoProceso = function (documentos) {
    var total = documentos.length;
    var firmados = 0, esperando = 0, pendientes = 0, anulados = 0;
    var conSolicitud = 0;

    documentos.forEach(function (d) {
      var est = (d.estado || '').toLowerCase();
      if (est === 'firmado') firmados++;
      else if (est === 'esperando_firma' || est === 'esperando') esperando++;
      else if (est === 'anulado') anulados++;
      else pendientes++; // incluye 'pendiente' y cualquier estado desconocido
      if (d.idSolicitudFirma) conSolicitud++;
    });

    var vivos = total - anulados;
    var progreso = vivos > 0 ? Math.round((firmados / vivos) * 100) : 0;

    var estado;
    if (total > 0 && firmados === total) {
      estado = ESTADOS_PROCESO.COMPLETADO;
    } else if (esperando > 0 || (firmados > 0 && firmados < total)) {
      estado = ESTADOS_PROCESO.EN_PROCESO;
    } else if (conSolicitud > 0 && esperando === 0 && firmados === 0) {
      // Hay solicitud creada pero ningún doc está esperando ni firmado.
      // Estado técnico desconocido sin consultar firma-service.
      // "En preparación" como estado provisional.
      estado = ESTADOS_PROCESO.EN_PREPARACION;
    } else {
      estado = ESTADOS_PROCESO.PENDIENTE;
    }

    return {
      estado: estado,
      total: total,
      firmados: firmados,
      esperando: esperando,
      pendientes: pendientes,
      anulados: anulados,
      conSolicitud: conSolicitud,
      progreso: progreso
    };
  };

  FirmaElectronicaComponent.prototype._renderTabla = function () {
    var self = this;
    if (!self._tbody) return;

    // 1. Aplicar búsqueda
    var procesos = self._procesosPorTrabajador.filter(function (p) {
      return self._matchBusqueda(p);
    });

    // 2. Aplicar filtro de estado
    if (self._filtroEstado !== 'todos') {
      procesos = procesos.filter(function (p) {
        return p.estado === self._filtroEstado;
      });
    }

    // 3. Actualizar contador
    if (self._countEl) {
      var total = self._procesosPorTrabajador.length;
      var visibles = procesos.length;
      if (total === 0) {
        self._countEl.textContent = 'Sin trabajadores con documentos en proceso';
      } else if (visibles === total) {
        self._countEl.textContent = 'Mostrando ' + total + ' trabajador' + (total !== 1 ? 'es' : '');
      } else {
        self._countEl.textContent = 'Mostrando ' + visibles + ' de ' + total + ' trabajadores';
      }
    }

    // 4. Renderizar filas
    if (procesos.length === 0) {
      self._tbody.innerHTML = self._renderEmpty();
      return;
    }
    self._tbody.innerHTML = procesos.map(function (p) {
      return self._renderFila(p);
    }).join('');
  };

  FirmaElectronicaComponent.prototype._matchBusqueda = function (proceso) {
    var self = this;
    var q = self._busqueda;
    if (!q) return true;
    var t = proceso.trabajador;
    var campos = [
      (t.nombres || ''),
      (t.apellidos || ''),
      (t.nombres + ' ' + t.apellidos),
      (t.cedula || ''),
      (t.correo || ''),
      (t.id || '')
    ];
    // También buscar por ID de solicitud (SIGN-...)
    proceso.documentos.forEach(function (d) {
      if (d.idSolicitudFirma) campos.push(d.idSolicitudFirma);
    });
    for (var i = 0; i < campos.length; i++) {
      if (String(campos[i] || '').toLowerCase().indexOf(q) !== -1) return true;
    }
    return false;
  };

  FirmaElectronicaComponent.prototype._renderFila = function (p) {
    var self = this;
    var t = p.trabajador;
    var nombreCompleto = _esc((t.nombres || '') + ' ' + (t.apellidos || ''));
    var correo = t.correo ? _esc(t.correo) : '';
    var cedula = self._fmtCedula(t.cedula || t.id || '—');

    var solicitudesHtml;
    if (p.numSolicitudes === 0) {
      solicitudesHtml = '<span class="fe-solicitudes__hint">—</span>';
    } else if (p.numSolicitudes === 1) {
      solicitudesHtml = '<span class="fe-solicitudes__count">1 solicitud</span>';
    } else {
      solicitudesHtml = '<span class="fe-solicitudes__count">' + p.numSolicitudes + ' solicitudes</span>';
    }

    return [
      '<tr class="fe-table__row" data-trabajador-id="' + _esc(t.id) + '">',
      '  <td class="fe-table__td">',
      '    <div class="fe-trabajador">',
      '      <span class="fe-trabajador__nombre">' + nombreCompleto + '</span>',
      correo ? '      <span class="fe-trabajador__correo">' + correo + '</span>' : '',
      '    </div>',
      '  </td>',
      '  <td class="fe-table__td fe-cedula">' + cedula + '</td>',
      '  <td class="fe-table__td">' + self._renderEstado(p) + '</td>',
      '  <td class="fe-table__td">' + solicitudesHtml + '</td>',
      '  <td class="fe-table__td fe-table__td--center">',
      '    <button class="fe-action" data-action="ver-expediente" data-trabajador-id="' + _esc(t.id) + '" type="button">',
      '      <i class="fas fa-folder-open"></i> Ver',
      '    </button>',
      '  </td>',
      '</tr>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderEstado = function (p) {
    var self = this;
    var label = ESTADOS_LABELS[p.estado] || p.estado;
    var desgloseParts = [];
    if (p.firmados > 0) desgloseParts.push(p.firmados + ' firmado' + (p.firmados !== 1 ? 's' : ''));
    if (p.esperando > 0) desgloseParts.push(p.esperando + ' esperando');
    if (p.pendientes > 0) desgloseParts.push(p.pendientes + ' pendiente' + (p.pendientes !== 1 ? 's' : ''));
    var desglose = desgloseParts.length > 0 ? desgloseParts.join(' · ') : '—';
    var vivos = p.total - p.anulados;
    var barraFillClass = p.estado === 'completado' ? 'fe-estado__barra-fill--completado' :
                        p.estado === 'en_proceso' ? 'fe-estado__barra-fill--en_proceso' : '';
    return [
      '<div class="fe-estado">',
      '  <span class="fe-estado__badge fe-estado__badge--' + p.estado + '">',
      '    <span class="fe-estado__badge-dot"></span>',
      _esc(label),
      '  </span>',
      vivos > 0 ? [
        '  <div class="fe-estado__progreso">',
        '    <div class="fe-estado__barra"><div class="fe-estado__barra-fill ' + barraFillClass + '" style="width: ' + p.progreso + '%;"></div></div>',
        '    <span class="fe-estado__progreso-text">' + p.firmados + ' / ' + vivos + ' documentos completados</span>',
        '  </div>'
      ].join('\n') : '',
      '  <div class="fe-estado__desglose">' + _esc(desglose) + '</div>',
      '</div>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderEmpty = function () {
    var self = this;
    if (self._procesosPorTrabajador.length === 0) {
      return [
        '<tr><td colspan="5">',
        '  <div class="fe-empty">',
        '    <div class="fe-empty__icon"><i class="fas fa-inbox"></i></div>',
        '    <h3 class="fe-empty__title">Sin documentos en proceso</h3>',
        '    <p class="fe-empty__text">No hay trabajadores con documentos en la empresa <strong>' + _esc(self.companyName || '') + '</strong>.</p>',
        '    <p class="fe-empty__text" style="margin-top:0.5rem;">Para crear documentos, vaya a la sección <strong>Documentos y Firmas</strong>.</p>',
        '  </div>',
        '</td></tr>'
      ].join('\n');
    }
    return [
      '<tr><td colspan="5">',
      '  <div class="fe-empty">',
      '    <div class="fe-empty__icon"><i class="fas fa-search"></i></div>',
      '    <h3 class="fe-empty__title">Sin resultados</h3>',
      '    <p class="fe-empty__text">Ningún trabajador coincide con el filtro o la búsqueda actual.</p>',
      '  </div>',
      '</td></tr>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._fmtCedula = function (cedula) {
    if (!cedula) return '—';
    var s = String(cedula);
    // Formato con puntos como separador de miles (estilo colombiano)
    if (s.length >= 7 && /^\d+$/.test(s)) {
      return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
    return s;
  };

  FirmaElectronicaComponent.prototype._abrirModalExpediente = function (trabajadorId) {
    var self = this;
    var proceso = self._procesosPorTrabajador.find(function (p) { return p.trabajadorId === trabajadorId; });
    if (!proceso) return;
    if (!self._modal || !self._modalBody) return;
    // 1) Mostrar spinner inmediatamente
    self._modalBody.innerHTML = self._renderLoading();
    self._modal.hidden = false;
    // 2) Cargar datos de firma-service en background
    self._cargarExpedienteData(proceso).then(function (data) {
      // 3) Renderizar contenido real (si el modal sigue abierto y el proceso no cambió)
      if (self._modal && !self._modal.hidden) {
        self._modalBody.innerHTML = self._renderExpediente(proceso, data);
      }
    }).catch(function (e) {
      if (self._modal && !self._modal.hidden) {
        self._modalBody.innerHTML = self._renderError(e);
      }
    });
  };

  FirmaElectronicaComponent.prototype._renderLoading = function () {
    return [
      '<div class="fe-modal__loading">',
      '  <i class="fas fa-spinner fa-spin"></i>',
      '  <p>Cargando expediente de firma…</p>',
      '</div>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderError = function (err) {
    return [
      '<div class="fe-modal__error">',
      '  <i class="fas fa-exclamation-triangle"></i>',
      '  <h4>Error cargando expediente</h4>',
      '  <p>' + _esc(err && err.message ? err.message : 'Error desconocido') + '</p>',
      '  <p class="fe-modal__error-hint">Los datos locales del expediente siguen disponibles abajo.</p>',
      '</div>'
    ].join('\n');
  };

  /**
   * Carga datos del expediente desde firma-service.
   * - Acuerdo activo (versión, texto_hash)
   * - Para cada id_solicitudFirma único: GET /sign-requests/:id
   * - Batch de detalles vía /sign-requests-batch
   *
   * NO consulta eventos de trazabilidad (no hay IPC firma:sign-request:eventos
   * en el preload actual). Quedan como placeholder en el render.
   * NO consulta estado del consentimiento (no hay IPC firma:consent:get).
   * Usa el consent_id que viene en el sign request como referencia.
   *
   * @param {object} proceso - Proceso del trabajador (incluye documentos)
   * @returns {Promise<{agreement, signRequests, signRequestsError}>}
   */
  FirmaElectronicaComponent.prototype._cargarExpedienteData = function (proceso) {
    var self = this;
    if (!window.electronAPI) {
      return Promise.resolve({ agreement: null, signRequests: [], signRequestsError: 'electronAPI no disponible' });
    }

    // IDs únicos de solicitudes (no null)
    var solicitudIds = [];
    var seen = {};
    proceso.documentos.forEach(function (d) {
      if (d.idSolicitudFirma && !seen[d.idSolicitudFirma]) {
        seen[d.idSolicitudFirma] = true;
        solicitudIds.push(d.idSolicitudFirma);
      }
    });

    // Cargar en paralelo desde 3 orígenes (Fase 3, I-103.A1.6):
    //   A) Acuerdo activo (reutilizamos el fix de companyName ya validado)
    //   B) Por cada sign request: 3 IPCs independientes
    //      - firmaSignRequestGet  → estado, fechas, agreement_version, id_empresa
    //      - firmaSignRequestLink → url_publica, qr_payload, token (endpoint I-013b)
    //      - ghGetSignRequest     → correo_verificacion (de metadata) + fecha_envio
    //                                (último INVITE_SENT). BD read-only local.
    // Los errores por sign request son INDEPENDIENTES: si falta el link o el
    // correo, el sign request sigue siendo "ok" con los datos que sí se
    // pudieron obtener (merge tolerante a fallos parciales).
    var promises = [
      window.electronAPI.firmaAgreementGet({ companyName: self.companyName })
        .catch(function () { return { success: false }; })
    ];

    // Para mapear promesas → idSolicitud en el then()
    var idForPromise = [];
    solicitudIds.forEach(function (id) {
      // B1) Datos generales
      idForPromise.push({ id: id, source: 'get' });
      promises.push(
        window.electronAPI.firmaSignRequestGet(id, { companyName: self.companyName })
          .catch(function () { return { success: false, error: { code: 'FETCH_ERROR', message: 'No se pudo obtener ' + id } }; })
      );
      // B2) Link público (puede fallar si está en estado terminal — no es fatal)
      idForPromise.push({ id: id, source: 'link' });
      promises.push(
        window.electronAPI.firmaSignRequestLink(id, { companyName: self.companyName })
          .catch(function () { return { success: false, error: { code: 'FETCH_ERROR', message: 'No se pudo obtener link de ' + id } }; })
      );
      // B3) Datos locales de BD (correo + fecha_envio)
      idForPromise.push({ id: id, source: 'gh' });
      promises.push(
        window.electronAPI.ghGetSignRequest(id, { companyName: self.companyName })
          .catch(function () { return { success: false, error: { code: 'FETCH_ERROR', message: 'No se pudo obtener gh-data de ' + id } }; })
      );
    });

    return Promise.all(promises).then(function (results) {
      var agreementResult = results[0];
      var srResults = results.slice(1);

      // Agrupar por id_solicitud (3 promesas por id)
      var byId = {};
      srResults.forEach(function (r, i) {
        var meta = idForPromise[i];
        if (!byId[meta.id]) byId[meta.id] = { get: null, link: null, gh: null };
        byId[meta.id][meta.source] = r;
      });

      var signRequests = solicitudIds.map(function (id) {
        var parts = byId[id] || {};
        var getR = parts.get;
        var linkR = parts.link;
        var ghR = parts.gh;

        // Merge tolerante: si al menos firmaSignRequestGet funcionó, ok=true
        if (getR && getR.success && getR.data) {
          var data = Object.assign({}, getR.data);
          // Sumar link si está disponible
          if (linkR && linkR.success && linkR.data) {
            data.url_publica = linkR.data.url_publica || null;
            data.qr_payload = linkR.data.qr_payload || null;
            data.token = linkR.data.token || null;
            data.fecha_expiracion_link = linkR.data.fecha_expiracion || null;
          }
          // Sumar datos de BD local (correo + fecha_envio)
          if (ghR && ghR.success && ghR.data && ghR.data.signRequest) {
            var g = ghR.data.signRequest;
            data.correo_verificacion = g.correo_verificacion || null;
            data.fecha_envio = g.fecha_envio || null;
            data.fecha_creacion_local = g.fecha_creacion || null;
          }
          return { id: id, ok: true, data: data };
        }
        // Si get falló pero link o gh funcionaron, intentamos un fallback mínimo
        // mostrando lo que se pudo recuperar.
        var partialData = {};
        if (linkR && linkR.success && linkR.data) {
          partialData.url_publica = linkR.data.url_publica || null;
          partialData.qr_payload = linkR.data.qr_payload || null;
          partialData.estado = linkR.data.estado || null;
        }
        if (ghR && ghR.success && ghR.data && ghR.data.signRequest) {
          var g2 = ghR.data.signRequest;
          partialData.correo_verificacion = g2.correo_verificacion || null;
          partialData.fecha_envio = g2.fecha_envio || null;
          partialData.estado = partialData.estado || g2.estado || null;
        }
        if (Object.keys(partialData).length > 0) {
          return { id: id, ok: true, data: partialData, partial: true };
        }
        var firstErr = (getR && getR.error && getR.error.message) || 'No disponible';
        return { id: id, ok: false, error: firstErr };
      });

      var agreement = (agreementResult && agreementResult.success && agreementResult.data) || null;

      // Detectar error global: si NINGUNO se pudo cargar pero había IDs
      var signRequestsError = null;
      if (solicitudIds.length > 0 && signRequests.every(function (sr) { return !sr.ok; })) {
        signRequestsError = 'No se pudo obtener ninguna solicitud de firma-service';
      }

      return { agreement: agreement, signRequests: signRequests, signRequestsError: signRequestsError };
    });
  };

  /**
   * Renderiza el modal de expediente completo con todas las secciones.
   */
  FirmaElectronicaComponent.prototype._renderExpediente = function (proceso, data) {
    var self = this;
    // Guardar data en el componente para que los handlers de acciones tengan
    // acceso al detalle de cada sign request (url_publica, correo, etc.)
    self._lastExpedienteData = data;
    self._lastExpedienteProceso = proceso;
    var t = proceso.trabajador;
    var srByDocId = self._indexSignRequestsByDocId(proceso.documentos, data.signRequests);

    return [
      // ═══ 1. Header del trabajador ═══
      self._renderExpedienteHeader(proceso, t),
      // ═══ 2. Resumen del proceso + progreso ═══
      self._renderExpedienteResumen(proceso),
      // ═══ 3. Documentos involucrados ═══
      self._renderExpedienteDocumentos(proceso.documentos, srByDocId),
      // ═══ 4. Solicitudes de firma (sign requests) ═══
      self._renderExpedienteSolicitudes(proceso, data),
      // ═══ 5. Consentimiento y acuerdo ═══
      self._renderExpedienteConsentimiento(data),
      // ═══ 6. Trazabilidad (placeholder) ═══
      self._renderExpedienteTrazabilidad(data),
      // ═══ 7. Acciones (placeholders Fase 3) ═══
      self._renderExpedienteAcciones(proceso, data)
    ].join('\n');
  };

  /**
   * Indexa los sign requests cargados por id_solicitudFirma para lookup rápido
   * desde los documentos.
   */
  FirmaElectronicaComponent.prototype._indexSignRequestsByDocId = function (documentos, signRequests) {
    var bySr = {};
    (signRequests || []).forEach(function (sr) {
      bySr[sr.id] = sr;
    });
    return bySr;
  };

  FirmaElectronicaComponent.prototype._renderExpedienteHeader = function (proceso, t) {
    var self = this;
    var estadoLabel = ESTADOS_LABELS[proceso.estado] || proceso.estado;
    return [
      '<section class="fe-exp-section fe-exp-section--header">',
      '  <div class="fe-exp-header">',
      '    <div class="fe-exp-header__avatar"><i class="fas fa-user"></i></div>',
      '    <div class="fe-exp-header__info">',
      '      <h3 class="fe-exp-header__name">' + _esc((t.nombres || '') + ' ' + (t.apellidos || '')) + '</h3>',
      '      <div class="fe-exp-header__meta">',
      '        <span><i class="fas fa-id-card"></i> C.C. ' + _esc(self._fmtCedula(t.cedula || t.id || '—')) + '</span>',
      t.correo ? '        <span><i class="fas fa-envelope"></i> ' + _esc(t.correo) + '</span>' : '',
      t.cargo ? '        <span><i class="fas fa-briefcase"></i> ' + _esc(t.cargo) + '</span>' : '',
      '      </div>',
      '    </div>',
      '    <div class="fe-exp-header__state">',
      '      <span class="fe-estado__badge fe-estado__badge--' + proceso.estado + '">',
      '        <span class="fe-estado__badge-dot"></span>',
      _esc(estadoLabel),
      '      </span>',
      '    </div>',
      '  </div>',
      '</section>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderExpedienteResumen = function (proceso) {
    var vivos = proceso.total - proceso.anulados;
    var barraFillClass = proceso.estado === 'completado' ? 'fe-estado__barra-fill--completado' :
                        proceso.estado === 'en_proceso' ? 'fe-estado__barra-fill--en_proceso' : '';
    var desgloseParts = [];
    if (proceso.firmados > 0) desgloseParts.push(proceso.firmados + ' firmado' + (proceso.firmados !== 1 ? 's' : ''));
    if (proceso.esperando > 0) desgloseParts.push(proceso.esperando + ' esperando');
    if (proceso.pendientes > 0) desgloseParts.push(proceso.pendientes + ' pendiente' + (proceso.pendientes !== 1 ? 's' : ''));
    var desglose = desgloseParts.length > 0 ? desgloseParts.join(' · ') : '—';
    return [
      '<section class="fe-exp-section">',
      '  <h4 class="fe-exp-section__title"><i class="fas fa-chart-line"></i> Resumen del proceso</h4>',
      '  <div class="fe-exp-resumen">',
      vivos > 0 ? [
        '    <div class="fe-estado__progreso" style="margin: 0.25rem 0 0.75rem;">',
        '      <div class="fe-estado__barra"><div class="fe-estado__barra-fill ' + barraFillClass + '" style="width: ' + proceso.progreso + '%;"></div></div>',
        '      <span class="fe-estado__progreso-text">' + proceso.firmados + ' / ' + vivos + ' documentos completados (' + proceso.progreso + '%)</span>',
        '    </div>'
      ].join('\n') : '<p style="color:#6b7280;font-size:0.875rem;">Sin documentos vivos.</p>',
      '    <div class="fe-exp-resumen__stats">',
      '      <div class="fe-exp-stat"><span class="fe-exp-stat__value">' + proceso.total + '</span><span class="fe-exp-stat__label">Documentos</span></div>',
      '      <div class="fe-exp-stat"><span class="fe-exp-stat__value">' + proceso.firmados + '</span><span class="fe-exp-stat__label">Firmados</span></div>',
      '      <div class="fe-exp-stat"><span class="fe-exp-stat__value">' + proceso.esperando + '</span><span class="fe-exp-stat__label">Esperando</span></div>',
      '      <div class="fe-exp-stat"><span class="fe-exp-stat__value">' + proceso.pendientes + '</span><span class="fe-exp-stat__label">Pendientes</span></div>',
      '      <div class="fe-exp-stat"><span class="fe-exp-stat__value">' + proceso.numSolicitudes + '</span><span class="fe-exp-stat__label">Solicitudes</span></div>',
      '    </div>',
      '    <p class="fe-exp-resumen__desglose">' + _esc(desglose) + '</p>',
      '  </div>',
      '</section>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderExpedienteDocumentos = function (documentos, srByDocId) {
    var self = this;
    var rows = documentos.map(function (d) {
      var tipoLabel = d.tipo || '—';
      var estadoLabel = (d.estado || '—');
      var sr = d.idSolicitudFirma ? srByDocId[d.idSolicitudFirma] : null;
      var srEstadoBadge = '';
      if (sr && sr.ok && sr.data && sr.data.estado) {
        var srEstado = sr.data.estado;
        srEstadoBadge = '<span class="fe-exp-doc__sr-estado">' + _esc(srEstado) + '</span>';
      } else if (d.idSolicitudFirma && (!sr || !sr.ok)) {
        srEstadoBadge = '<span class="fe-exp-doc__sr-estado fe-exp-doc__sr-estado--error">No disponible</span>';
      }
      return [
        '    <div class="fe-exp-doc">',
        '      <div class="fe-exp-doc__icon"><i class="fas fa-file-pdf"></i></div>',
        '      <div class="fe-exp-doc__info">',
        '        <div class="fe-exp-doc__title">' + _esc(d.titulo || tipoLabel) + '</div>',
        '        <div class="fe-exp-doc__meta">',
        '          <span class="fe-exp-doc__tipo">' + _esc(tipoLabel) + '</span>',
        '          <span class="fe-exp-doc__sep">·</span>',
        '          <span class="fe-exp-doc__estado">' + _esc(estadoLabel) + '</span>',
        d.idSolicitudFirma ? '<span class="fe-exp-doc__sep">·</span><span class="fe-exp-doc__sr">' + _esc(d.idSolicitudFirma) + '</span>' : '',
        '        </div>',
        '        <div class="fe-exp-doc__sr-detail">' + srEstadoBadge + '</div>',
        '      </div>',
        '    </div>'
      ].join('\n');
    }).join('\n');
    return [
      '<section class="fe-exp-section">',
      '  <h4 class="fe-exp-section__title"><i class="fas fa-file-alt"></i> Documentos asociados (' + documentos.length + ')</h4>',
      '  <div class="fe-exp-docs">' + rows + '</div>',
      '</section>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderExpedienteSolicitudes = function (proceso, data) {
    var self = this;
    if (data.signRequests.length === 0) {
      return [
        '<section class="fe-exp-section">',
        '  <h4 class="fe-exp-section__title"><i class="fas fa-file-signature"></i> Solicitudes de firma (0)</h4>',
        '  <p style="color:#6b7280;font-size:0.875rem;padding:0.5rem 0;">Este trabajador aún no tiene solicitudes de firma creadas en firma-service.</p>',
        '</section>'
      ].join('\n');
    }
    if (data.signRequestsError) {
      return [
        '<section class="fe-exp-section">',
        '  <h4 class="fe-exp-section__title"><i class="fas fa-file-signature"></i> Solicitudes de firma (' + data.signRequests.length + ')</h4>',
        '  <div class="fe-exp-warning">',
        '    <i class="fas fa-exclamation-triangle"></i>',
        '    <span>' + _esc(data.signRequestsError) + '. Los datos mostrados abajo son aproximados desde el estado local.</span>',
        '  </div>',
        '</section>'
      ].join('\n');
    }
    var cards = data.signRequests.map(function (sr) {
      return self._renderSolicitudCard(sr);
    }).join('\n');
    return [
      '<section class="fe-exp-section">',
      '  <h4 class="fe-exp-section__title"><i class="fas fa-file-signature"></i> Solicitudes de firma (' + data.signRequests.length + ')</h4>',
      '  <div class="fe-exp-solicitudes">' + cards + '</div>',
      '</section>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderSolicitudCard = function (sr) {
    if (!sr.ok) {
      return [
        '  <div class="fe-exp-sr fe-exp-sr--error">',
        '    <div class="fe-exp-sr__head">',
        '      <span class="fe-exp-sr__id">' + _esc(sr.id) + '</span>',
        '      <span class="fe-exp-sr__badge fe-exp-sr__badge--error">No disponible</span>',
        '    </div>',
        '    <p class="fe-exp-sr__msg">' + _esc(sr.error || 'firma-service no respondió') + '</p>',
        '  </div>'
      ].join('\n');
    }
    var d = sr.data || {};
    var estadoRaw = d.estado || d.estado_firma || 'DESCONOCIDO';
    var badgeClass = this._srEstadoToBadge(estadoRaw);
    var rows = [];
    rows.push(this._srField('Tipo de firma', d.tipo_firma));
    rows.push(this._srField('Consentimiento', d.consent_id ? '#' + d.consent_id : '—'));
    rows.push(this._srField('Versión acuerdo', d.agreement_version || '—'));
    rows.push(this._srField('Creada', this._fmtFechaHora(d.fecha_creacion)));
    rows.push(this._srField('Vence', this._fmtFechaHora(d.fecha_expiracion)));
    rows.push(this._srField('Firmada', this._fmtFechaHora(d.fecha_firma)));
    rows.push(this._srField('Correo destino', d.correo_verificacion ? this._maskEmail(d.correo_verificacion) : '—'));
    if (d.fecha_envio) {
      rows.push(this._srField('Fecha de envío', this._fmtFechaHora(d.fecha_envio)));
    }
    var urlPublica = d.url_publica;
    var qrPayload = d.qr_payload;
    var link = this._srField('Enlace público', urlPublica ? '<a href="' + _esc(urlPublica) + '" target="_blank" rel="noopener" class="fe-exp-sr__link"><i class="fas fa-external-link-alt"></i> Abrir enlace</a>' : '—');
    rows.push(link);
    if (qrPayload) {
      rows.push(this._srField('QR (payload)', '<code style="font-size:0.75rem;color:#1e40af;">' + _esc(qrPayload) + '</code>'));
    }
    if (d.error_code) {
      rows.push(this._srField('Error', '<span class="fe-exp-sr__error-code">' + _esc(d.error_code) + '</span> ' + _esc(d.error_message || '')));
    }
    return [
      '  <div class="fe-exp-sr">',
      '    <div class="fe-exp-sr__head">',
      '      <span class="fe-exp-sr__id">' + _esc(sr.id) + '</span>',
      '      <span class="fe-exp-sr__badge ' + badgeClass + '">' + _esc(estadoRaw) + '</span>',
      '    </div>',
      '    <div class="fe-exp-sr__grid">' + rows.join('\n') + '</div>',
      '  </div>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._srEstadoToBadge = function (estado) {
    var e = String(estado || '').toUpperCase();
    if (e === 'SIGNED' || e === 'COMPLETADO' || e === 'FIRMADO') return 'fe-exp-sr__badge--ok';
    if (e === 'PENDING' || e === 'OTP_VERIFIED' || e === 'IDENTIFIED' || e === 'VIEWED') return 'fe-exp-sr__badge--info';
    if (e === 'OTP_PENDING' || e === 'WAITING_OTP') return 'fe-exp-sr__badge--warning';
    if (e === 'REJECTED') return 'fe-exp-sr__badge--rejected';
    if (e === 'EXPIRED' || e === 'CANCELLED' || e === 'REVOKED') return 'fe-exp-sr__badge--expired';
    if (e === 'ERROR') return 'fe-exp-sr__badge--error';
    return 'fe-exp-sr__badge--info';
  };
  FirmaElectronicaComponent.prototype._srField = function (label, value) {
    var v = (value === null || value === undefined || value === '') ? '—' : value;
    return '<div class="fe-exp-sr__field"><span class="fe-exp-sr__label">' + _esc(label) + '</span><span class="fe-exp-sr__value">' + (typeof v === 'string' ? v : String(v)) + '</span></div>';
  };
  FirmaElectronicaComponent.prototype._fmtFechaHora = function (iso) {
    if (!iso) return null;
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return _esc(iso);
      return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) { return _esc(iso); }
  };
  FirmaElectronicaComponent.prototype._maskEmail = function (email) {
    if (!email || typeof email !== 'string') return '';
    var at = email.indexOf('@');
    if (at <= 1) return email;
    var local = email.substring(0, at);
    var domain = email.substring(at);
    var firstChar = local.substring(0, 1);
    return firstChar + '***' + domain;
  };

  FirmaElectronicaComponent.prototype._renderExpedienteConsentimiento = function (data) {
    var agreement = data.agreement;
    var info = [];
    if (agreement) {
      info.push('<div class="fe-exp-consent__field"><span class="fe-exp-consent__label">Versión del acuerdo</span><span class="fe-exp-consent__value">' + _esc(agreement.version || '—') + '</span></div>');
      info.push('<div class="fe-exp-consent__field"><span class="fe-exp-consent__label">Hash del texto</span><span class="fe-exp-consent__value"><code style="font-size:0.75rem;">' + _esc((agreement.texto_hash || '').substring(0, 16) + '…') + '</code></span></div>');
      info.push('<div class="fe-exp-consent__field"><span class="fe-exp-consent__label">Vigente desde</span><span class="fe-exp-consent__value">' + _esc(agreement.fecha_vigencia_inicio || '—') + '</span></div>');
    } else {
      info.push('<p style="color:#6b7280;font-size:0.875rem;">No se pudo obtener la versión activa del acuerdo.</p>');
    }
    return [
      '<section class="fe-exp-section">',
      '  <h4 class="fe-exp-section__title"><i class="fas fa-file-contract"></i> Consentimiento y versión del acuerdo</h4>',
      '  <div class="fe-exp-consent">' + info.join('\n') + '</div>',
      '  <p class="fe-exp-section__note"><i class="fas fa-info-circle"></i> El estado detallado del consentimiento (OTP enviado, verificado, aceptado) se consultará en una versión posterior cuando el bridge exponga un endpoint dedicado de consentimiento.</p>',
      '</section>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderExpedienteTrazabilidad = function (data) {
    return [
      '<section class="fe-exp-section">',
      '  <h4 class="fe-exp-section__title"><i class="fas fa-stream"></i> Trazabilidad / eventos</h4>',
      '  <div class="fe-exp-warning">',
      '    <i class="fas fa-clock"></i>',
      '    <span>La línea de tiempo detallada de eventos (CREATED, INVITE_SENT, IDENTIFIED, OTP_VERIFIED, SIGNED, etc.) requiere un endpoint adicional en el bridge de firma. Se añadirá en una versión posterior.</span>',
      '  </div>',
      '</section>'
    ].join('\n');
  };

  FirmaElectronicaComponent.prototype._renderExpedienteAcciones = function (proceso, data) {
    var self = this;
    // Primer sign request válido (toma el primero; si hay varios, igual sirve para el correo/enlace del primero)
    var srActivo = data.signRequests.find(function (sr) { return sr.ok; });
    var srActivoEstado = srActivo && srActivo.data && srActivo.data.estado;
    var srFirmado = data.signRequests.find(function (sr) { return sr.ok && sr.data && sr.data.estado === 'SIGNED'; });
    var hayPdfFirmado = proceso.documentos.some(function (d) { return d.estado === 'firmado'; });

    // El botón de enviar correo solo se habilita si hay un sr activo que NO esté firmado/cancelado/vencido/revocado
    var puedeEnviar = !!srActivo && srActivoEstado !== 'SIGNED' && srActivoEstado !== 'CANCELLED' && srActivoEstado !== 'EXPIRED' && srActivoEstado !== 'REVOKED';
    // El botón de copiar enlace solo se habilita si hay url_publica
    var puedeCopiar = !!srActivo && srActivo.data && srActivo.data.url_publica;
    // Ver documento / descargar evidencia solo si hay un firmado
    var puedeVerPdf = !!srFirmado || hayPdfFirmado;

    var srId = srActivo ? srActivo.id : '';

    return [
      '<section class="fe-exp-section fe-exp-section--actions">',
      '  <h4 class="fe-exp-section__title"><i class="fas fa-bolt"></i> Acciones disponibles</h4>',
      '  <div class="fe-exp-actions">',
      // Enviar / reenviar correo — HABILITADO
      '    <button class="fe-exp-action" type="button" data-action="enviar-correo" data-sr-id="' + _esc(srId) + '"' + (puedeEnviar ? '' : ' disabled title="Solicitud no activa o sin firma-service"') + '>',
      '      <i class="fas ' + (srActivoEstado === 'SIGNED' ? 'fa-check' : 'fa-paper-plane') + '"></i> ' + (srActivoEstado === 'PENDING' ? 'Enviar correo inicial' : srActivoEstado === 'SIGNED' ? 'Reenviar correo (firmado)' : 'Reenviar correo'),
      '    </button>',
      // Copiar enlace público — HABILITADO
      '    <button class="fe-exp-action" type="button" data-action="copiar-enlace" data-sr-id="' + _esc(srId) + '"' + (puedeCopiar ? '' : ' disabled title="Aún no se ha generado el enlace público (envía primero el correo)"') + '>',
      '      <i class="fas fa-link"></i> Copiar enlace público',
      '    </button>',
      // Reenviar OTP — PLACEHOLDER (no hay IPC público)
      '    <button class="fe-exp-action" type="button" disabled title="No expuesto en preload (pendiente IPC público para reenvío de OTP)">',
      '      <i class="fas fa-redo"></i> Reenviar OTP',
      '    </button>',
      // Cancelar solicitud — PLACEHOLDER (endpoint backend existe pero requiere adminApiKey)
      '    <button class="fe-exp-action fe-exp-action--danger" type="button" disabled title="Endpoint backend existe pero no está expuesto en preload (requiere adminApiKey)">',
      '      <i class="fas fa-ban"></i> Cancelar solicitud',
      '    </button>',
      // Ver documento firmado / Descargar evidencia — PLACEHOLDER
      puedeVerPdf ? [
        '    <button class="fe-exp-action" type="button" disabled title="Disponible en una fase posterior (requiere abrir PDF desde firma-service)">',
        '      <i class="fas fa-file-pdf"></i> Ver documento firmado',
        '    </button>',
        '    <button class="fe-exp-action" type="button" disabled title="Disponible en una fase posterior (requiere descargar evidencia desde firma-service)">',
        '      <i class="fas fa-download"></i> Descargar evidencia',
        '    </button>'
      ].join('\n') : '',
      '  </div>',
      '  <p class="fe-exp-section__note"><i class="fas fa-info-circle"></i> <strong>2 acciones habilitadas</strong> (enviar correo, copiar enlace). Las demás quedan como placeholder hasta exponer los IPCs correspondientes en el preload.</p>',
      '</section>'
    ].join('\n');
  };

  /**
   * Handler del botón "Enviar / reenviar correo".
   * Flujo (I-103.A1.6):
   *   1. Obtener consent_id del sign request
   *   2. Consultar el consentimiento en K+AIR via ghGetConsentimiento
   *      (IPC local que retorna correo_verificacion desde gh_consentimientos_firma)
   *   3. Llamar a firma-service notify-remote con companyName + correo
   *   4. Refetch del expediente al terminar
   */
  FirmaElectronicaComponent.prototype._actionEnviarCorreo = async function (srId) {
    var self = this;
    if (!srId) return;
    var data = self._lastExpedienteData;
    var proceso = self._lastExpedienteProceso;
    if (!data || !proceso) return;
    var sr = (data.signRequests || []).find(function (s) { return s.id === srId; });
    if (!sr || !sr.ok || !sr.data) {
      self._showToast('No se puede reenviar: solicitud no disponible', 'error');
      return;
    }
    // 1. consent_id del sign request
    var consentId = sr.data.consent_id;
    if (!consentId) {
      self._showToast('No se puede reenviar: el sign request no tiene consent_id vinculado', 'error');
      return;
    }
    // 2. Consultar el consentimiento en K+AIR (BD local, NO firma-service)
    var consentResult = await window.electronAPI.ghGetConsentimiento(consentId, { companyName: self.companyName });
    if (!consentResult || !consentResult.success || !consentResult.data || !consentResult.data.consentimiento) {
      var errMsg = consentResult && consentResult.error && consentResult.error.message || 'desconocido';
      self._showToast('No se pudo obtener el consentimiento #' + consentId + ': ' + errMsg, 'error');
      return;
    }
    var correo = consentResult.data.consentimiento.correo_verificacion;
    if (!correo) {
      self._showToast('El consentimiento #' + consentId + ' no tiene correo_verificacion guardado', 'error');
      return;
    }
    // 3. Llamar a firma-service con companyName (fix A1.5.4-B) + correo + context
    var r;
    try {
      r = await window.electronAPI.firmaSignRequestNotifyRemote(srId, {
        companyName: self.companyName,
        correo: correo,
        context: { via: 'firma-electronica', button: 'enviar-correo' }
      });
    } catch (e) {
      self._showToast('Excepción enviando correo: ' + e.message, 'error');
      return;
    }
    if (r && r.success) {
      var sent = r.data && r.data.messageId ? ' (messageId: ' + r.data.messageId + ')' : '';
      self._showToast('Correo enviado a ' + correo + sent, 'success');
      // 4. Refetch del expediente para mostrar el nuevo estado
      await self._refetchExpediente(proceso);
    } else {
      var errCode = r && r.error && r.error.code;
      var errMsg2 = r && r.error && r.error.message;
      self._showToast('Error enviando correo: ' + (errCode ? errCode + ' — ' : '') + (errMsg2 || 'desconocido'), 'error');
    }
  };

  /**
   * Handler del botón "Copiar enlace público".
   * Usa la url_publica del sign request (disponible después de enviar el correo).
   */
  FirmaElectronicaComponent.prototype._actionCopiarEnlace = async function (srId) {
    var self = this;
    if (!srId) return;
    var data = self._lastExpedienteData;
    if (!data) return;
    var sr = (data.signRequests || []).find(function (s) { return s.id === srId; });
    if (!sr || !sr.ok || !sr.data || !sr.data.url_publica) {
      self._showToast('Aún no se ha generado el enlace público. Envía primero el correo.', 'info');
      return;
    }
    var url = sr.data.url_publica;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback para entornos sin clipboard API
        var ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      self._showToast('Enlace público copiado al portapapeles', 'success');
    } catch (e) {
      self._showToast('Error copiando enlace: ' + e.message, 'error');
    }
  };

  /**
   * Re-carga los datos del expediente desde firma-service y re-renderiza el modal.
   * Llamado después de cada acción que pueda cambiar el estado del sign request.
   */
  FirmaElectronicaComponent.prototype._refetchExpediente = async function (proceso) {
    var self = this;
    if (!self._modal || self._modal.hidden) return;
    try {
      var data = await self._cargarExpedienteData(proceso);
      // Solo re-renderizar si el modal sigue abierto
      if (self._modal && !self._modal.hidden && self._modalBody) {
        self._modalBody.innerHTML = self._renderExpediente(proceso, data);
      }
    } catch (e) {
      self._showToast('Error refrescando expediente: ' + e.message, 'error');
    }
  };

  FirmaElectronicaComponent.prototype._cerrarModal = function () {
    if (this._modal) this._modal.hidden = true;
  };

  FirmaElectronicaComponent.prototype._showToast = function (msg, type) {
    var self = this;
    if (!self._toast) return;
    self._toast.className = 'fe-toast fe-toast--' + (type || 'info');
    self._toast.textContent = msg;
    self._toast.hidden = false;
    clearTimeout(self._toastTimer);
    self._toastTimer = setTimeout(function () {
      self._toast.hidden = true;
    }, 3500);
  };

  FirmaElectronicaComponent.prototype.destroy = function () {
    var self = this;
    if (self._toastTimer) clearTimeout(self._toastTimer);
    if (self._escKeyHandler) {
      document.removeEventListener('keydown', self._escKeyHandler);
      self._escKeyHandler = null;
    }
    if (self._modal && !self._modal.hidden) self._cerrarModal();
    if (self.container) self.container.innerHTML = '';
    self.container = null;
  };

  // Exponer en window para que gestion-humana-home.js lo monte
  window[COMPONENT_NAME] = FirmaElectronicaComponent;
})();
