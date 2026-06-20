/**
 * =====================================================================
 * SUBMÓDULO 6.1.3 — REVISIÓN POR LA ALTA DIRECCIÓN
 * Componente Principal · Diseño v2.0
 * · Hub (Patrón B Submodule Home)
 * · View Router interno (hub → subvistas)
 * · Migración suave desde estructura legacy
 * · CSS: revision-alta-direccion-v2.css (prefijo .kair-rad-*)
 * · API pública preservada: constructor(container, company, moduleName,
 *   submoduleTitle, backCb) → .render() / .destroy()
 * =====================================================================
 */

var RevisionAltaDireccionComponent = (function() {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════
     CONSTANTES · Identidad del módulo + 5 componentes normativos
     ═══════════════════════════════════════════════════════════════════════ */

  var MODULO = {
    CODIGO: '6.1.3',
    NOMBRE: 'Revisión por la Alta Dirección',
    SLUG: 'revision-alta-direccion',
    PROCEDIMIENTO: 'G-PR-001'
  };

  /* Catálogo de los 5 componentes normativos del spec 6.1.3
     Cada componente preserva su formato oficial como fuente de verdad */
  var COMPONENTES = [
    {
      key: 'revisiones',
      title: 'Revisiones Gerenciales',
      format: 'G-FO-006',
      formatLabel: 'Acta formal con 12 secciones',
      icon: 'bi-file-earmark-text',
      iconColor: 'primary',
      description: 'Ciclo anual completo: lectura acta anterior, componentes organizacionales, auditorías, requisitos legales, participación, incidentes, recursos, riesgos, conclusiones y acciones.',
      meta: { realizadas: 2, enCurso: 1 },
      chipVariant: 'success',
      chipLabel: 'Rev. 03',
      phase: 2
    },
    {
      key: 'actas',
      title: 'Actas de Reunión Gerencial',
      format: 'G-FO-009',
      formatLabel: 'Reuniones de seguimiento',
      icon: 'bi-people',
      iconColor: 'success',
      description: 'Registro operativo de reuniones mensuales con agenda, orden del día, desarrollo de temas y compromisos con responsables y fechas.',
      meta: { total: 2, abiertas: 1 },
      chipVariant: 'info',
      chipLabel: '1 abiertas',
      phase: 3
    },
    {
      key: 'despliegue',
      title: 'Despliegue Estratégico',
      format: 'G-FO-001',
      formatLabel: 'Objetivos e indicadores',
      icon: 'bi-bullseye',
      iconColor: 'info',
      description: 'Objetivos estratégicos SST con sus indicadores, fórmulas, metas, frecuencia de medición y responsables. Insumo principal de la revisión gerencial.',
      meta: { total: 9, cumplen: 6 },
      chipVariant: 'success',
      chipLabel: '6 cumplen',
      phase: 3
    },
    {
      key: 'procedimiento',
      title: 'Procedimiento',
      format: 'G-PR-001',
      formatLabel: 'Cómo se realiza la revisión',
      icon: 'bi-journal-text',
      iconColor: 'neutral',
      description: 'Documento normativo que define objeto, alcance, responsables, generalidades, desarrollo del proceso (información, ejecución, distribución) y control de cambios.',
      meta: { rev: 'Rev. 01 · Nov 2016' },
      chipVariant: 'neutral',
      chipLabel: 'Referencia',
      phase: 3
    }
  ];

  /* Las 12 secciones canónicas del formato G-FO-006 Rev. 03
     Esta es la fuente de verdad del submódulo */
  var SECCIONES_G006 = [
    'Lectura del acta anterior',
    'Revisión de componentes organizacionales',
    'Auditorías internas',
    'Requisitos legales',
    'Participación y consulta',
    'Investigación de incidentes',
    'Acciones del acta de revisión gerencial anterior',
    'Cambios que puedan afectar el SG-SST',
    'Resultados de la supervisión',
    'Resultados de la evaluación inicial',
    'Acciones preventivas y correctivas',
    'Conclusiones'
  ];

  /* Mock data: ciclo activo (revisión en curso) */
  var CICLO_ACTIVO_MOCK = {
    id: 'RG-2025-01',
    periodo: '2025',
    fechaProgramada: '2025-12-15',
    preside: 'Sergina Orozco Hincapié',
    elabora: 'Javier Robles Fontalvo',
    empresa: 'TEMPOSUM S.A.S.',
    participantes: 2,
    progreso: 25,
    estado: 'Borrador'
  };

  /* Mock data: revisiones recientes (3) */
  var REVISIONES_MOCK = [
    {
      id: 'RG-2024-01',
      periodo: '2024',
      fecha: '2024-01-04',
      empresa: 'TEMPOSUM S.A.S.',
      preside: 'Sergina Orozco Hincapié',
      elabora: 'Javier Robles Fontalvo',
      participantes: 4,
      estado: 'Realizada',
      progreso: 100
    },
    {
      id: 'RG-2025-01',
      periodo: '2025',
      fecha: '2025-12-15',
      empresa: 'TEMPOSUM S.A.S.',
      preside: 'Sergina Orozco Hincapié',
      elabora: 'Javier Robles Fontalvo',
      participantes: 2,
      estado: 'Borrador',
      progreso: 25
    },
    {
      id: 'RG-2023-01',
      periodo: '2023',
      fecha: '2023-01-12',
      empresa: 'TEMPOSUM S.A.S.',
      preside: 'Sergina Orozco Hincapié',
      elabora: 'Javier Robles Fontalvo',
      participantes: 3,
      estado: 'Realizada',
      progreso: 100
    }
  ];

  /* ═══════════════════════════════════════════════════════════════════════
     ESTADO · Predecible, single source of truth
     ═══════════════════════════════════════════════════════════════════════ */

  var state = {
    /* View router */
    currentView: 'hub',         // hub | revisiones | revisiones-list | revisiones-editor | revisiones-viewer | actas | actas-editor | despliegue | procedimiento
    viewParams: {},

    /* Data (estructura NUEVA alineada al spec 6.1.3) */
    empresaActiva: '',
    empresaId: '',
    cicloActivo: null,
    revisiones: [],
    actas: [],
    indicadores: [],
    documentos: [],

    /* Legacy fallback (estructura vieja) */
    legacyData: {
      programacion: [],
      actas: [],
      hallazgos: [],
      indicadores: [],
      documentos: []
    },

    /* UI state */
    isDirty: false,
    loading: false,
    error: null,
    dataSource: 'mock'  // mock | backend | legacy-migrated
  };

  var container = null;
  var currentCompany = null;
  var backToModuleCallback = null;
  var cssLoaded = false;

  /* ═══════════════════════════════════════════════════════════════════════
     HELPERS · Puros, no mutan estado compartido
     ═══════════════════════════════════════════════════════════════════════ */

  function _esc(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function log(accion, status, detail) {
    var msg = '[K+AIRSST][6.1.3][' + accion + '][' + status + '] ' + (detail || '');
    if (window.console && window.console.log) {
      window.console.log(msg);
    }
    if (window.electronAPI && window.electronAPI.log) {
      try { window.electronAPI.log(msg); } catch (e) { /* no-op */ }
    }
  }

  function formatDate(d) {
    if (!d) return '';
    var months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    var parts = String(d).split('-');
    if (parts.length === 3) return parseInt(parts[2], 10) + ' ' + months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
    return String(d);
  }

  function badgeFor(value) {
    var map = {
      'Realizada': 'success', 'Borrador': 'info', 'Vencida': 'danger',
      'En Proceso': 'warning', 'Cerrado': 'success', 'Abierto': 'warning',
      'Cumple': 'success', 'Parcial': 'warning', 'No cumple': 'danger'
    };
    var cls = map[value] || 'neutral';
    return '<span class="kair-rad-badge kair-rad-badge--' + cls + '"><span class="dot"></span>' + _esc(value) + '</span>';
  }

  /* ═══════════════════════════════════════════════════════════════════════
     TOAST · Feedback visual no-bloqueante
     ═══════════════════════════════════════════════════════════════════════ */

  /* F-Sileo (2026-06-19): toast() ahora es un proxy a Sileo.
     Mantiene la firma (title, msg, type) para no tocar los ~30 call-sites. */
  function toast(title, msg, type) {
    if (window.Sileo && window.Sileo[type || 'info']) {
      window.Sileo[type || 'info']({ title: title, description: msg });
    } else {
      /* Fallback al sistema legacy si Sileo no está cargado todavía */
      var stack = document.getElementById('kair-rad-toast-stack');
      if (!stack) return;
      var icons = {
        success: 'bi-check-circle-fill',
        warning: 'bi-exclamation-triangle-fill',
        error: 'bi-x-circle-fill',
        info: 'bi-info-circle-fill'
      };
      var el = document.createElement('div');
      el.className = 'kair-rad-toast kair-rad-toast--' + (type || 'info');
      el.innerHTML =
        '<i class="bi ' + (icons[type] || icons.info) + ' kair-rad-toast__icon"></i>' +
        '<div>' +
          '<div class="kair-rad-toast__title">' + _esc(title) + '</div>' +
          (msg ? '<div class="kair-rad-toast__msg">' + _esc(msg) + '</div>' : '') +
        '</div>';
      stack.appendChild(el);
      setTimeout(function() {
        el.classList.add('is-leaving');
        setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
      }, 3800);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONFIRM DIALOG · Modal de confirmación estándar K+AIR
     Mismo patrón que capacitaciones (k-modal-overlay + k-modal)
     ═══════════════════════════════════════════════════════════════════════ */

  function _ensureConfirmModal() {
    /* DEBUG: trace de creación del modal */
    try { console.log('[K+AIRSST][6.1.3][DELETE-MODAL] _ensureConfirmModal()'); } catch (e) {}

    var existing = document.getElementById('kair-rad-confirm-modal');
    if (existing) return existing;

    var overlay = document.createElement('div');
    overlay.className = 'k-modal-overlay';
    overlay.id = 'kair-rad-confirm-modal';
    overlay.innerHTML =
      '<div class="k-modal k-modal-sm">' +
        '<div class="k-modal-header">' +
          '<h3 class="k-modal-title" id="kair-rad-confirm-title">' +
            '<i class="bi bi-question-circle" id="kair-rad-confirm-icon"></i>' +
            '<span id="kair-rad-confirm-title-text">Confirmar acción</span>' +
          '</h3>' +
          '<button type="button" class="btn-close-modal" id="kair-rad-confirm-close" aria-label="Cerrar">' +
            '<i class="bi bi-x-lg"></i>' +
          '</button>' +
        '</div>' +
        '<div class="k-modal-body">' +
          '<p id="kair-rad-confirm-message"></p>' +
          '<p class="k-modal-warning" id="kair-rad-confirm-warning" style="display:none;"></p>' +
        '</div>' +
        '<div class="k-modal-footer">' +
          '<button type="button" class="k-btn k-btn-outline" id="kair-rad-confirm-cancel">Cancelar</button>' +
          '<button type="button" class="k-btn k-btn-danger" id="kair-rad-confirm-accept">' +
            '<i class="bi bi-exclamation-triangle"></i>' +
            '<span id="kair-rad-confirm-accept-label">Confirmar</span>' +
          '</button>' +
        '</div>' +
      '</div>';

    /* IMPORTANTE: appendear a document.body (no al container del módulo)
       para que el modal NO sea destruido cuando renderAll() limpie el
       container al re-renderizar la vista (ej. al confirmar una eliminación).
       El CSS del modal es GLOBAL (no scoped), por lo que funciona aquí. */
    document.body.appendChild(overlay);
    return overlay;
  }

  /**
   * Muestra un diálogo de confirmación estándar K+AIR
   * @param {Object} opts
   * @param {string} opts.title      - Título del modal (ej: "Eliminar borrador")
   * @param {string} opts.message    - Mensaje principal (ej: "¿Estás seguro...?")
   * @param {string} [opts.warning]  - Advertencia opcional (se muestra destacada)
   * @param {string} [opts.acceptLabel] - Texto del botón de aceptar (default: "Confirmar")
   * @param {string} [opts.cancelLabel] - Texto del botón de cancelar (default: "Cancelar")
   * @param {string} [opts.variant]   - 'danger' | 'warning' | 'info' (default: 'danger')
   * @returns {Promise<boolean>}    - true si el usuario aceptó, false si canceló
   */
  /* F-Sileo (2026-06-19): _showConfirmDialog() ahora es un proxy a Sileo.confirm.
     Mantiene la firma ({title, message, acceptLabel, cancelLabel, warning, variant}).
     Devuelve Promise<boolean> igual que antes. */
  function _showConfirmDialog(opts) {
    try { console.log('[K+AIRSST][6.1.3][DELETE-MODAL] _showConfirmDialog() opts:', opts); } catch (e) {}

    if (window.Sileo && window.Sileo.confirm) {
      var description = opts.message || '¿Estás seguro?';
      if (opts.warning) description += '\n\n⚠ ' + opts.warning;
      return window.Sileo.confirm({
        title:      opts.title || 'Confirmar acción',
        description: description,
        confirmText: opts.acceptLabel || 'Confirmar',
        cancelText:  opts.cancelLabel || 'Cancelar',
        danger:     opts.variant !== 'warning' /* default: danger */
      });
    }

    /* Fallback al modal legacy si Sileo aún no cargó */
    return new Promise(function(resolve) {
      var overlay = _ensureConfirmModal();
      document.getElementById('kair-rad-confirm-title-text').textContent = opts.title || 'Confirmar acción';
      document.getElementById('kair-rad-confirm-message').textContent = opts.message || '¿Estás seguro?';
      document.getElementById('kair-rad-confirm-accept-label').textContent = opts.acceptLabel || 'Confirmar';
      var cancelBtn = overlay.querySelector('#kair-rad-confirm-cancel');
      cancelBtn.textContent = opts.cancelLabel || 'Cancelar';
      var warnEl = document.getElementById('kair-rad-confirm-warning');
      if (opts.warning) { warnEl.textContent = opts.warning; warnEl.style.display = 'block'; }
      else { warnEl.style.display = 'none'; }
      var acceptBtn = overlay.querySelector('#kair-rad-confirm-accept');
      acceptBtn.className = 'k-btn ' + (opts.variant === 'warning' ? 'k-btn-warning' : 'k-btn-danger');
      overlay.classList.add('open');
      var close = function(result) {
        overlay.classList.remove('open');
        acceptBtn.removeEventListener('click', onAccept);
        cancelBtn.removeEventListener('click', onCancel);
        document.getElementById('kair-rad-confirm-close').removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onEscape);
        resolve(result);
      };
      var onAccept = function() { close(true); };
      var onCancel = function() { close(false); };
      var onBackdrop = function(e) { if (e.target === overlay) close(false); };
      var onEscape = function(e) { if (e.key === 'Escape') close(false); };
      acceptBtn.addEventListener('click', onAccept);
      cancelBtn.addEventListener('click', onCancel);
      document.getElementById('kair-rad-confirm-close').addEventListener('click', onCancel);
      overlay.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onEscape);
    });
  }

  /**
   * Crea o actualiza una revisión (borrador o finalizada)
   * Conecta con IPC `revisionAltaDireccion.crearRevision` / `actualizarRevision`
   * @param {Object} data - Datos de la revisión (id opcional, periodo, fecha, preside, etc.)
   * @param {boolean} [esNuevo] - Si true, fuerza crear nueva; si false, actualiza existente
   * @returns {Promise<Object|null>} - {success, revision} o null en error
   */
  async function guardarRevision(data, esNuevo) {
    console.log('[K+AIRSST][6.1.3][SAVE] guardarRevision() data.id=' + (data && data.id) + ' esNuevo=' + !!esNuevo);

    if (!data || typeof data !== 'object') {
      toast('Datos inválidos', 'No se puede guardar la revisión', 'error');
      log('SAVE', 'ERROR', 'data inválido');
      return null;
    }

    /* Inserta o reemplaza en state.revisiones (top), y actualiza cicloActivo si coincide. */
    function _upsertRevision(r) {
      if (!Array.isArray(state.revisiones)) state.revisiones = [];
      state.revisiones = state.revisiones.filter(function(x) { return x.id !== r.id; });
      state.revisiones.unshift(r);
      if (!state.cicloActivo || state.cicloActivo.id === r.id) state.cicloActivo = r;
    }

    var empresaId = state.empresaActiva || state.empresaId || '';
    var resp = null;
    var isMock = false;

    try {
      if (esNuevo || !data.id) {
        /* CREAR nueva revisión */
        if (window.RevisionAltaDireccionService && window.RevisionAltaDireccionService.crearRevision) {
          resp = await window.RevisionAltaDireccionService.crearRevision(empresaId, data);
        }
        var nueva = null;
        if (resp && resp.success && resp.data) {
          nueva = resp.data;
        } else if (resp && resp.error) {
          toast('Error al guardar', resp.error.message || 'No se pudo crear la revisión', 'error');
          log('SAVE', 'ERROR', resp.error.message);
          return null;
        } else {
          /* Fallback mock · id determinístico sin colisiones */
          isMock = true;
          var year = new Date().getFullYear();
          var maxNum = (state.revisiones || []).reduce(function(m, r) {
            var n = parseInt(String(r.id || '').split('-').pop(), 10);
            return isNaN(n) ? m : Math.max(m, n);
          }, 0);
          nueva = Object.assign({}, data, {
            id: data.id || ('RG-' + year + '-' + String(maxNum + 1).padStart(2, '0')),
            estado: data.estado || 'Borrador',
            fecha: data.fecha || new Date().toISOString().split('T')[0],
            periodo: data.periodo || String(year),
            participantes: data.participantes || 0,
            progreso: data.progreso || 0
          });
        }
        _upsertRevision(nueva);
        toast('Borrador guardado' + (isMock ? ' (demo)' : ''), nueva.id + ' se guardó correctamente', 'success');
        log('SAVE', isMock ? 'INFO' : 'SUCCESS', nueva.id + (isMock ? ' (mock sin backend)' : ' (nuevo)'));
        return { success: true, revision: nueva };
      } else {
        /* ACTUALIZAR revisión existente */
        if (window.RevisionAltaDireccionService && window.RevisionAltaDireccionService.actualizarRevision) {
          resp = await window.RevisionAltaDireccionService.actualizarRevision(empresaId, data.id, data);
        }
        if (resp && resp.success) {
          var updated = Object.assign({}, data);
          _upsertRevision(updated);
          toast('Cambios guardados' + (isMock ? ' (demo)' : ''), data.id + ' actualizado correctamente', 'success');
          log('SAVE', 'SUCCESS', data.id + ' (update)');
          return { success: true, revision: updated };
        } else if (resp && resp.error) {
          toast('Error al actualizar', resp.error.message || 'No se pudo actualizar la revisión', 'error');
          log('SAVE', 'ERROR', resp.error.message);
          return null;
        } else {
          isMock = true;
          _upsertRevision(Object.assign({}, data));
          toast('Cambios guardados (demo)', data.id + ' actualizado localmente', 'success');
          log('SAVE', 'INFO', data.id + ' (mock update)');
          return { success: true, revision: data };
        }
      }
    } catch (e) {
      toast('Error al guardar', e && e.message ? e.message : 'Error inesperado', 'error');
      log('SAVE', 'ERROR', e && e.message ? e.message : String(e));
      return null;
    }
  }

  /**
   * Crea o actualiza un acta de reunión (G-FO-009) conforme al modelo semestral.
   * Conecta con IPC `revisionAltaDireccion.guardarActa` vía service.
   * - Si esNuevo=true y data no tiene id, genera `ACT-YYYY-S1` (Principal) o `ACT-YYYY-S2-SEG` (Seguimiento)
   * - Valida unicidad: no permite 2 actas del mismo tipo+año
   * @param {Object} data - Datos del acta (id opcional, fecha, estado, metadata con tipo/año/semestre)
   * @param {boolean} [esNuevo] - Si true, fuerza crear nueva; si false, actualiza
   * @returns {Promise<Object|null>} - {success, acta} o null en error
   */
  async function guardarActa(data, esNuevo) {
    console.log('[K+AIRSST][6.1.3][SAVE_ACTA] guardarActa() data.id=' + (data && data.id) +
      ' tipo=' + (data && data.metadata && data.metadata.tipo) +
      ' año=' + (data && data.metadata && data.metadata.año) +
      ' esNuevo=' + !!esNuevo);

    if (!data || typeof data !== 'object') {
      toast('Datos inválidos', 'No se puede guardar el acta', 'error');
      log('SAVE_ACTA', 'ERROR', 'data inválido');
      return null;
    }

    var meta = data.metadata || {};
    var tipo = meta.tipo || 'Principal';
    var año = meta.año || new Date().getFullYear();

    /* Generar ID si es nuevo y no trae uno */
    if (esNuevo && !data.id) {
      if (tipo === 'Seguimiento') {
        data.id = 'ACT-' + año + '-S2-SEG';
      } else {
        data.id = 'ACT-' + año + '-S1';
      }
      data.numero = (tipo === 'Seguimiento') ? 2 : 1;
    }

    /* Validación de unicidad (defensa adicional — el editor ya validó,
       pero verificamos aquí también por si llega data inconsistente) */
    if (esNuevo && Array.isArray(state.actas)) {
      var dup = state.actas.find(function(a) {
        var m = a.metadata || {};
        return m.tipo === tipo && m.año === año;
      });
      if (dup) {
        toast('Duplicado', 'Ya existe ' + dup.id + ' (' + tipo + ' ' + año + ')', 'error');
        log('SAVE_ACTA', 'ERROR', 'duplicado: ' + dup.id);
        return null;
      }
    }

    /* Inserta o reemplaza en state.actas (top) */
    function _upsertActa(a) {
      if (!Array.isArray(state.actas)) state.actas = [];
      state.actas = state.actas.filter(function(x) { return x.id !== a.id; });
      state.actas.unshift(a);
    }

    var empresaId = state.empresaActiva || state.empresaId || '';
    var resp = null;
    var isMock = false;

    try {
      if (window.RevisionAltaDireccionService && window.RevisionAltaDireccionService.guardarActa) {
        resp = await window.RevisionAltaDireccionService.guardarActa(empresaId, data);
      }

      if (resp && resp.success && resp.data) {
        var actaCompleta = Object.assign({}, data, {
          id: resp.data.id || data.id,
          numero: resp.data.numero || data.numero
        });
        _upsertActa(actaCompleta);
        toast(esNuevo ? 'Acta creada' : 'Acta actualizada', actaCompleta.id, 'success');
        log('SAVE_ACTA', 'SUCCESS', actaCompleta.id);
        return { success: true, acta: actaCompleta };
      } else if (resp && resp.error) {
        toast('Error al guardar', resp.error.message || 'No se pudo guardar el acta', 'error');
        log('SAVE_ACTA', 'ERROR', resp.error.message);
        return null;
      } else {
        /* Fallback mock · usar ID calculado */
        isMock = true;
        var actaMock = Object.assign({}, data, {
          id: data.id,
          numero: data.numero,
          creado_en: new Date().toISOString(),
          actualizado_en: new Date().toISOString()
        });
        _upsertActa(actaMock);
        toast('Acta guardada (demo)', actaMock.id, 'success');
        log('SAVE_ACTA', 'INFO', actaMock.id + ' (mock)');
        return { success: true, acta: actaMock };
      }
    } catch (e) {
      toast('Error al guardar', e && e.message ? e.message : 'Error inesperado', 'error');
      log('SAVE_ACTA', 'ERROR', e && e.message ? e.message : String(e));
      return null;
    }
  }

  /**
   * Elimina una revisión gerencial (borrador o cualquiera)
   * Conecta con IPC `revisionAltaDireccion.eliminarRevision`
   * @param {string} id - Consecutivo de la revisión (ej: 'RG-2025-01')
   * @param {boolean} isBorrador - Si es borrador, aplica mensaje específico
   * @returns {Promise<boolean>} true si se eliminó, false si el usuario canceló
   */
  async function eliminarRevision(id, isBorrador) {
    /* DEBUG: trace del eliminarRevision */
    try { console.log('[K+AIRSST][6.1.3][DELETE] eliminarRevision() id=' + id + ' isBorrador=' + isBorrador); } catch (e) {}

    if (!id) return false;

    var msg = isBorrador
      ? 'Vas a eliminar el borrador de revisión "' + id + '". Esta acción no se puede deshacer.'
      : 'Vas a eliminar la revisión "' + id + '". Esta acción no se puede deshacer.';

    var warning = isBorrador
      ? 'Esta revisión aún no ha sido finalizada. Todos los datos del borrador se perderán permanentemente.'
      : 'Si la revisión ya fue finalizada, considera descargar el acta G-FO-006 antes de continuar.';

    var confirmed = await _showConfirmDialog({
      title: 'Eliminar revisión ' + id,
      message: msg,
      warning: warning,
      acceptLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      variant: 'danger'
    });

    if (!confirmed) {
      log('DELETE', 'INFO', 'Cancelado por el usuario: ' + id);
      toast('Eliminación cancelada', 'No se realizó ningún cambio', 'info');
      return false;
    }

    /* Llamada al backend vía service */
    try {
      var empresaId = state.empresaActiva || state.empresaId || '';
      var resp = null;
      if (window.RevisionAltaDireccionService && window.RevisionAltaDireccionService.eliminarRevision) {
        resp = await window.RevisionAltaDireccionService.eliminarRevision(empresaId, id);
      }

      if (resp && resp.success) {
        /* Eliminar del estado local */
        state.revisiones = (state.revisiones || []).filter(function(r) { return r.id !== id; });
        if (state.cicloActivo && state.cicloActivo.id === id) {
          state.cicloActivo = null;
        }
        toast('Revisión eliminada', id + ' se eliminó correctamente', 'success');
        log('DELETE', 'SUCCESS', id);
        return true;
      } else if (resp && resp.error) {
        toast('Error al eliminar', resp.error.message || 'No se pudo eliminar la revisión', 'error');
        log('DELETE', 'ERROR', resp.error.message);
        return false;
      } else {
        /* Modo mock (sin backend) · eliminar del estado local igualmente */
        state.revisiones = (state.revisiones || []).filter(function(r) { return r.id !== id; });
        if (state.cicloActivo && state.cicloActivo.id === id) {
          state.cicloActivo = null;
        }
        toast('Revisión eliminada (demo)', id + ' se eliminó localmente', 'success');
        log('DELETE', 'INFO', id + ' (modo demo sin backend)');
        return true;
      }
    } catch (e) {
      toast('Error al eliminar', e && e.message ? e.message : 'Error inesperado', 'error');
      log('DELETE', 'ERROR', e && e.message ? e.message : String(e));
      return false;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CSS LAZY LOAD · Carga el v2 solo cuando se instancia el componente
     ═══════════════════════════════════════════════════════════════════════ */

  function ensureCSS() {
    if (cssLoaded) return;
    cssLoaded = true;
    var href = 'modules/verificacion/revision-alta-direccion/revision-alta-direccion-v2.css';
    var existing = document.querySelector('link[href*="revision-alta-direccion-v2.css"]');
    if (!existing) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
      log('CSS_LOAD', 'INFO', href);
    }
    /* F-Sileo (2026-06-19): cargar assets de Sileo vanilla (aislado a 6.1.3) */
    if (!document.querySelector('link[href*="k-sileo.css"]')) {
      var sileoCss = document.createElement('link');
      sileoCss.rel = 'stylesheet';
      sileoCss.href = 'shared/k-sileo.css';
      document.head.appendChild(sileoCss);
      log('SILEO_CSS', 'INFO', 'shared/k-sileo.css');
    }
    if (!document.querySelector('script[src*="k-sileo.js"]') && !window.Sileo) {
      var sileoScript = document.createElement('script');
      sileoScript.src = 'shared/k-sileo.js';
      sileoScript.onload = function () { log('SILEO_JS', 'INFO', 'Cargado y listo'); };
      sileoScript.onerror = function () { log('SILEO_JS', 'ERROR', 'No se pudo cargar shared/k-sileo.js'); };
      document.head.appendChild(sileoScript);
    } else {
      log('SILEO_JS', 'INFO', 'Ya estaba cargado');
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     MIGRACIÓN SUAVE · De estructura legacy → estructura nueva
     Mantiene compat 100% con backend actual sin tocar contratos IPC
     ═══════════════════════════════════════════════════════════════════════ */

  function _migrateFromLegacy(legacyData) {
    var migrated = {
      revisiones: [],
      cicloActivo: null,
      empresaActiva: state.empresaActiva || 'EMPRESA ACTIVA',
      hasLegacyStructure: true
    };

    if (!legacyData || typeof legacyData !== 'object') return migrated;

    /* Mapear programacion → revisiones + cicloActivo */
    if (Array.isArray(legacyData.programacion)) {
      migrated.revisiones = legacyData.programacion.map(function(p) {
        return {
          id: p.id || '',
          periodo: (p.fechaProg || '').substring(0, 4),
          fecha: p.fechaReal || p.fechaProg || '',
          fechaProgramada: p.fechaProg || '',
          empresa: migrated.empresaActiva,
          preside: p.responsable || '',
          elabora: '',
          participantes: 0,
          estado: p.estado || 'Borrador',
          progreso: p.estado === 'Realizada' ? 100 : (p.estado === 'Programada' ? 0 : 25),
          modalidad: p.modalidad || '',
          tipo: p.tipo || ''
        };
      });

      var activas = migrated.revisiones.filter(function(r) {
        return r.estado === 'Borrador' || r.estado === 'En Proceso' || r.estado === 'Programada';
      });
      if (activas.length > 0) {
        migrated.cicloActivo = activas[0];
      }
    }

    /* Mapear actas legacy → actas nuevas */
    if (Array.isArray(legacyData.actas)) {
      migrated.actas = legacyData.actas;
    }

    /* Mapear indicadores legacy → indicadores despliegue */
    if (Array.isArray(legacyData.indicadores)) {
      migrated.indicadores = legacyData.indicadores;
    }

    /* Mapear documentos legacy */
    if (Array.isArray(legacyData.documentos)) {
      migrated.documentos = legacyData.documentos;
    }

    return migrated;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DATA LOADING · Con fallback graceful a mocks
     ═══════════════════════════════════════════════════════════════════════ */

  async function loadData() {
    state.loading = true;
    state.error = null;

    /* Resolver empresa activa desde currentCompany */
    if (currentCompany) {
      if (typeof currentCompany === 'object') {
        state.empresaActiva = currentCompany.nombre || currentCompany.name || currentCompany.razonSocial || 'EMPRESA ACTIVA';
        state.empresaId = currentCompany.id || currentCompany.empresaId || '';
      } else {
        state.empresaActiva = String(currentCompany);
        state.empresaId = String(currentCompany);
      }
    }

    /* 1. Intentar cargar desde backend (canal: cargarTodo) */
    var loaded = false;
    if (window.RevisionAltaDireccionService && typeof window.RevisionAltaDireccionService.cargarTodo === 'function') {
      try {
        /* IMPORTANTE: pasamos empresaActiva (nombre legible) en vez de
           empresaId (ID/UUID). El bridge usa getCompanyRootPath que busca
           por nombre en config.companyPaths. Si pasáramos el ID, no lo
           encontraría y caería al fallback de userData.
           Mismo patrón que inspecciones-bridge, mantenimiento-bridge, etc. */
        var resp = await window.RevisionAltaDireccionService.cargarTodo(state.empresaActiva || state.empresaId);
        if (resp && resp.success && resp.data) {
          /* Log del seed de indicadores (espejo del backend, ayuda a diagnosticar) */
          if (resp.data.seedIndicadores) {
            var s = resp.data.seedIndicadores;
            console.log('[K+AIRSST][6.1.3][SEED_FRONT] resultado=' +
              JSON.stringify({
                seeded: s.seeded,
                fuente: s.fuente || null,
                source: s.source || null,
                reason: s.reason || null,
                rehidratado: s.rehidratado || false
              }));
          }

          /* Detectar si viene en estructura nueva o legacy */
          if (resp.data.revisiones || resp.data.cicloActivo) {
            /* Estructura nueva (G-FO-006 alineada) */
            state.revisiones = resp.data.revisiones || [];
            state.cicloActivo = resp.data.cicloActivo || null;
            state.actas = resp.data.actas || [];
            state.indicadores = resp.data.indicadores || [];
            state.documentos = resp.data.documentos || [];
            state.dataSource = 'backend';
            loaded = true;
            log('LOAD_BACKEND', 'SUCCESS', 'estructura nueva');

            /* Enriquecer indicadores con auto-resultados (Último Valor + Estado).
               Los indicadores recién sembrados tienen resultado=null. Llamamos al
               mismo handler IPC que usa objetivos-sst-viewer.js para obtener
               los resultados auto-calculados (frecuencia, severidad, presupuesto,
               etc.) y enriquecer cada indicador con su mejor match por keyword. */
            if (window.electronAPI && typeof window.electronAPI.getObjetivosResultadosAuto === 'function') {
              try {
                var autoResp = await window.electronAPI.getObjetivosResultadosAuto(state.empresaActiva);
                if (autoResp && autoResp.success && autoResp.data) {
                  var autoCount = Object.keys(autoResp.data).length;
                  var matchedCount = _enrichIndicadoresConAuto(state.indicadores, autoResp.data);
                  console.log('[K+AIRSST][6.1.3][AUTO_ENRICH] ' + matchedCount + '/' + state.indicadores.length +
                    ' indicadores enriquecidos desde ' + autoCount + ' keywords auto');
                }
              } catch (autoErr) {
                console.warn('[K+AIRSST][6.1.3][AUTO_ENRICH] Error:', autoErr && autoErr.message);
              }
            }
          } else if (resp.data.programacion || resp.data.actas || resp.data.indicadores) {
            /* Estructura legacy → aplicar migración suave */
            var migrated = _migrateFromLegacy(resp.data);
            state.legacyData = resp.data;
            state.revisiones = migrated.revisiones;
            state.cicloActivo = migrated.cicloActivo;
            state.actas = migrated.actas;
            state.indicadores = migrated.indicadores;
            state.documentos = migrated.documentos;
            state.dataSource = 'legacy-migrated';
            loaded = true;
            log('LOAD_BACKEND', 'SUCCESS', 'estructura legacy migrada');
            toast('Datos sincronizados', 'Estructura anterior convertida automáticamente', 'info');
          }
        }
      } catch (e) {
        log('LOAD_BACKEND', 'ERROR', e && e.message ? e.message : String(e));
        state.error = e && e.message ? e.message : 'Error desconocido';
      }
    }

    /* 2. Fallback a mocks alineados al G-FO-006 */
    if (!loaded) {
      state.revisiones = REVISIONES_MOCK.slice();
      state.cicloActivo = Object.assign({}, CICLO_ACTIVO_MOCK);
      state.dataSource = 'mock';
      log('LOAD_MOCK', 'INFO', 'usando mocks G-FO-006');
    }

    /* Si no hay ciclo activo mockeado pero sí revisiones, derivarlo */
    if (!state.cicloActivo && state.revisiones.length > 0) {
      var borrador = state.revisiones.filter(function(r) {
        return r.estado !== 'Realizada' && r.estado !== 'Cerrado';
      })[0];
      if (borrador) state.cicloActivo = borrador;
    }

    state.loading = false;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     VIEW ROUTER · Navegación interna sin acoplar al router global
     ═══════════════════════════════════════════════════════════════════════ */

  function navigate(view, params) {
    state.currentView = view || 'hub';
    state.viewParams = params || {};
    log('NAVIGATE', 'INFO', state.currentView);
    renderAll();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: ROOT · Despacha al renderer de la vista activa
     ═══════════════════════════════════════════════════════════════════════ */

  function renderAll() {
    if (!container) return;
    container.innerHTML = '';

    var root = document.createElement('div');
    root.className = 'kair-rad-module';

    /* Toast stack (siempre presente) */
    var toastStack = document.createElement('div');
    toastStack.className = 'kair-rad-toast-stack';
    toastStack.id = 'kair-rad-toast-stack';
    root.appendChild(toastStack);

    /* Header (siempre visible) */
    root.appendChild(_renderHeader());

    /* Vista activa */
    var viewHost = document.createElement('div');
    viewHost.className = 'kair-rad-view-host';
    viewHost.id = 'kair-rad-view-host';

    if (state.loading) {
      viewHost.appendChild(_renderLoadingView());
    } else if (state.error && state.revisiones.length === 0) {
      viewHost.appendChild(_renderErrorView(state.error));
    } else {
      switch (state.currentView) {
        case 'hub':             viewHost.appendChild(_renderHubView()); break;
        case 'revisiones':      /* alias → revisiones-list */
        case 'revisiones-list': viewHost.appendChild(_renderRevisionesListView()); break;
        case 'revisiones-editor': viewHost.appendChild(_renderRevisionEditorView()); break;
        case 'revisiones-viewer': viewHost.appendChild(_renderRevisionViewerView()); break;
        case 'actas':           viewHost.appendChild(_renderActasReunionView()); break;
        case 'actas-editor':    viewHost.appendChild(_renderActasEditorView()); break;
        case 'despliegue':      viewHost.appendChild(_renderDespliegueView()); break;
        case 'procedimiento':   viewHost.appendChild(_renderProcedimientoView()); break;
        default:                viewHost.appendChild(_renderHubView());
      }
    }

    root.appendChild(viewHost);
    container.appendChild(root);
    bindGlobalActions();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: HEADER v2.0 · Patrón 1 (subtitle + company + action--primary)
     ═══════════════════════════════════════════════════════════════════════ */

  function _renderHeader() {
    /* Header estándar K+AIR · Mismo patrón usado en capacitaciones e indicadores.
       Estructura: .k-module-header > (.k-header-left + .k-header-right) */
    var header = document.createElement('header');
    header.className = 'k-module-header';

    /* ──────────────────────────────────────────────
       LEFT · Back + title group (título + breadcrumb)
       ────────────────────────────────────────────── */
    var left = document.createElement('div');
    left.className = 'k-header-left';

    /* NOTA: El botón "Volver" se renderiza en .k-header-right (lado derecho)
       para coincidir con el patrón de capacitaciones.
       Ver función _renderBackButton() más abajo. */

    var titleGroup = document.createElement('div');
    titleGroup.className = 'k-header-title-group';

    var mainTitle = document.createElement('div');
    mainTitle.className = 'k-header-main-title';
    mainTitle.innerHTML = '<i class="bi bi-clipboard-check-fill"></i> ' +
      _esc(state.currentView === 'hub'
        ? '6.1.3 · ' + MODULO.NOMBRE
        : _getHeaderTitleForView(state.currentView));
    titleGroup.appendChild(mainTitle);

    var breadcrumb = document.createElement('div');
    breadcrumb.className = 'k-header-breadcrumb';
    var empresaText = state.empresaActiva ? state.empresaActiva : 'Empresa';
    breadcrumb.innerHTML =
      '<span>' + _esc(empresaText) + '</span>' +
      '<i class="bi bi-chevron-right"></i>' +
      '<button data-bc="verificacion">Verificación</button>' +
      '<i class="bi bi-chevron-right"></i>' +
      '<span class="k-breadcrumb-item active">' + _esc(MODULO.CODIGO + ' ' + MODULO.NOMBRE) + '</span>';
    titleGroup.appendChild(breadcrumb);

    left.appendChild(titleGroup);
    header.appendChild(left);

    /* ──────────────────────────────────────────────
       RIGHT · Sync badge + acciones
       ────────────────────────────────────────────── */
    var right = document.createElement('div');
    right.className = 'k-header-right';

    /* Sync badge · refleja el dataSource */
    var badge = document.createElement('span');
    var syncCls = 'k-sync-synced';
    var syncIcon = 'bi-check-circle-fill';
    var syncLabel = 'Sincronizado';
    if (state.dataSource === 'mock') {
      syncCls = 'k-sync-saving';
      syncIcon = 'bi-database';
      syncLabel = 'Modo demo';
    } else if (state.dataSource === 'legacy-migrated') {
      syncCls = 'k-sync-synced';
      syncIcon = 'bi-arrow-repeat';
      syncLabel = 'Migrado';
    } else if (state.error) {
      syncCls = 'k-sync-error';
      syncIcon = 'bi-exclamation-triangle-fill';
      syncLabel = 'Sin conexión';
    }
    badge.className = 'k-sync-badge ' + syncCls;
    badge.innerHTML = '<i class="bi ' + syncIcon + '"></i> ' + syncLabel;
    right.appendChild(badge);

    /* ──────────────────────────────────────────────
       Botón "Volver" · Mismo estilo que capacitaciones (header-back-btn)
       Posición: entre "Sincronizado" y la CTA primaria
       Comportamiento:
       - En sub-vistas (list, editor, viewer, actas, etc.) → vuelve al HUB del submódulo
       - En el hub del submódulo → vuelve al MÓDULO PADRE (Verificación)
       ────────────────────────────────────────────── */
    var back = document.createElement('button');
    back.className = 'header-back-btn';
    back.id = 'kair-rad-back';
    back.title = _getBackLabel(state.currentView);
    back.setAttribute('aria-label', 'Volver');
    back.innerHTML = '<i class="bi bi-arrow-left"></i> Volver';
    back.addEventListener('click', function() {
      if (state.currentView === 'hub') {
        /* Nivel 2: hub → módulo padre (Verificación) */
        if (typeof backToModuleCallback === 'function') {
          log('BACK', 'INFO', 'hub → parent module');
          backToModuleCallback();
        } else {
          toast('Sin módulo padre', 'No se configuró el callback de retorno', 'warning');
        }
      } else {
        /* Nivel 1: sub-vista → hub del submódulo (pantalla principal) */
        var target = _getBackTarget(state.currentView);
        log('BACK', 'INFO', state.currentView + ' → ' + target);
        navigate(target);
      }
    });
    right.appendChild(back);

    /* CTA primaria del header (Nueva revisión) · solo en hub */
    if (state.currentView === 'hub') {
      var cta = document.createElement('button');
      cta.className = 'k-btn k-btn-primary k-btn-sm';
      cta.id = 'kair-rad-cta-new';
      cta.innerHTML = '<i class="bi bi-plus-circle"></i> Nueva Revisión Gerencial';
      right.appendChild(cta);
    } else if (state.currentView === 'revisiones-editor') {
      /* En el editor, mostramos "Finalizar y ver acta" */
      var ctaFinish = document.createElement('button');
      ctaFinish.className = 'k-btn k-btn-success k-btn-sm';
      ctaFinish.id = 'kair-rad-cta-finish';
      ctaFinish.innerHTML = '<i class="bi bi-check-circle"></i> Finalizar y ver acta';
      right.appendChild(ctaFinish);
    } else if (state.currentView === 'revisiones-viewer') {
      var ctaExport = document.createElement('button');
      ctaExport.className = 'k-btn k-btn-ghost k-btn-sm';
      ctaExport.id = 'kair-rad-cta-export';
      ctaExport.innerHTML = '<i class="bi bi-download"></i> Exportar';
      right.appendChild(ctaExport);

      var ctaPrint = document.createElement('button');
      ctaPrint.className = 'k-btn k-btn-primary k-btn-sm';
      ctaPrint.id = 'kair-rad-cta-print';
      ctaPrint.innerHTML = '<i class="bi bi-printer"></i> Imprimir';
      right.appendChild(ctaPrint);
    } else if (state.currentView === 'procedimiento') {
      var ctaOpenDoc = document.createElement('button');
      ctaOpenDoc.className = 'k-btn k-btn-primary k-btn-sm';
      ctaOpenDoc.id = 'kair-rad-cta-open-doc';
      ctaOpenDoc.innerHTML = '<i class="bi bi-file-earmark-word"></i> Abrir .doc original';
      right.appendChild(ctaOpenDoc);
    } else if (state.currentView === 'actas-editor') {
      /* En el editor de actas, mostramos "Volver al listado" en el header.
         Los botones específicos (Guardar borrador / Guardar y cerrar / Cancelar)
         viven en el sticky footer del editor. */
      var ctaBackEditor = document.createElement('button');
      ctaBackEditor.className = 'k-btn k-btn-ghost k-btn-sm';
      ctaBackEditor.id = 'kair-rad-cta-back-editor';
      ctaBackEditor.innerHTML = '<i class="bi bi-arrow-left"></i> Volver al listado';
      right.appendChild(ctaBackEditor);
    } else if (state.currentView === 'despliegue' || state.currentView === 'actas') {
      var ctaExport2 = document.createElement('button');
      ctaExport2.className = 'k-btn k-btn-ghost k-btn-sm';
      ctaExport2.id = 'kair-rad-cta-export';
      ctaExport2.innerHTML = '<i class="bi bi-download"></i> Exportar XLSX';
      right.appendChild(ctaExport2);

      var ctaNew = document.createElement('button');
      ctaNew.className = 'k-btn k-btn-primary k-btn-sm';
      ctaNew.id = 'kair-rad-cta-new';
      ctaNew.innerHTML = '<i class="bi bi-plus-circle"></i> Nuevo';
      right.appendChild(ctaNew);
    }

    header.appendChild(right);
    return header;
  }

  function _getBackTarget(view) {
    /* Lógica de navegación "Volver":
       - Si view === 'hub'  → null (lo maneja el botón con backToModuleCallback)
       - Si view === 'actas-editor' → 'actas' (volver al listado de actas)
       - Otros → 'hub' (pantalla principal del submódulo) */
    if (view === 'hub') return null;
    if (view === 'actas-editor') return 'actas';
    return 'hub';
  }

  function _getBackLabel(view) {
    var map = {
      'hub':               'Volver al módulo Verificación',
      'revisiones':        'Volver al hub del submódulo',
      'revisiones-list':   'Volver al hub del submódulo',
      'revisiones-editor': 'Volver al listado',
      'revisiones-viewer': 'Volver al listado',
      'actas':             'Volver al hub del submódulo',
      'actas-editor':      'Volver al listado de actas',
      'despliegue':        'Volver al hub del submódulo',
      'procedimiento':     'Volver al hub del submódulo'
    };
    return map[view] || 'Volver';
  }

  function _getHeaderTitleForView(view) {
    var map = {
      revisiones:           'Revisiones Gerenciales',
      'revisiones-list':    'Revisiones Gerenciales',
      'revisiones-editor':  state.viewParams && state.viewParams.id
        ? 'Revisión Gerencial ' + state.viewParams.id
        : 'Editor de Revisión',
      'revisiones-viewer':  state.viewParams && state.viewParams.id
        ? 'Acta ' + state.viewParams.id
        : 'Acta de Revisión Gerencial',
      actas:         'Actas de Reunión Gerencial',
      'actas-editor': state.viewParams && state.viewParams.id
        ? 'Editar Acta ' + state.viewParams.id
        : 'Nueva Acta de Reunión',
      despliegue:    'Despliegue Estratégico',
      procedimiento: 'Procedimiento G-PR-001'
    };
    return map[view] || MODULO.NOMBRE;
  }

  function _getHeaderSubtitleForView(view) {
    var map = {
      revisiones:           'Ciclo anual del acta G-FO-006 con 12 secciones canónicas',
      'revisiones-list':    'Ciclo anual del acta G-FO-006 con 12 secciones canónicas',
      'revisiones-editor':  'Editor del acta conforme al formato G-FO-006 Rev. 03',
      'revisiones-viewer':  'Acta imprimible conforme a G-FO-006 Rev. 03',
      actas:         'Reuniones de seguimiento G-FO-009 con agenda y compromisos',
      'actas-editor': 'Editor del acta conforme al formato G-FO-009',
      despliegue:    'Objetivos estratégicos e indicadores G-FO-001',
      procedimiento: 'Documento normativo de referencia'
    };
    return map[view] || 'Gestión integral de revisiones gerenciales del SG-SST';
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: KPI STRIP canónico v1.0 · 4 indicadores con divider vertical
     ═══════════════════════════════════════════════════════════════════════ */

  function _renderKpiStrip() {
    var strip = document.createElement('div');
    strip.className = 'kair-rad-kpi-strip';

    var revisiones = state.revisiones || [];
    var realizadas  = revisiones.filter(function(r) { return r.estado === 'Realizada' || r.estado === 'Cerrado'; }).length;
    var borrador    = revisiones.filter(function(r) { return r.estado === 'Borrador' || r.estado === 'Programada' || r.estado === 'En Proceso'; }).length;
    var prox        = state.cicloActivo ? state.cicloActivo.id : '—';

    /* Acciones pendientes: derivado del ciclo activo (heurística: si no está al 100%) */
    var progCiclo = state.cicloActivo ? (state.cicloActivo.progreso || 0) : 100;
    var accionesPendientes = progCiclo < 100 ? Math.max(1, Math.round((100 - progCiclo) / 10)) : 0;

    var actasTotal = (state.actas && state.actas.length) || 2;
    var ultimaActa = (state.actas && state.actas.length > 0) ? state.actas[0].id : 'ACT-2025-11';

    var kpis = [
      {
        value: String(realizadas),
        label: 'Revisiones Realizadas',
        icon: 'bi-clipboard-check',
        color: 'success',
        sub: realizadas > 0 ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Histórico cerrado' : 'Sin histórico aún',
        subClass: realizadas > 0 ? 'kair-rad-kpi__sub--success' : ''
      },
      {
        value: String(borrador),
        label: 'En Borrador / Programadas',
        icon: 'bi-clock-history',
        color: 'warning',
        sub: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Próxima: ' + prox,
        subClass: 'kair-rad-kpi__sub--warning'
      },
      {
        value: String(accionesPendientes),
        label: 'Acciones Pendientes',
        icon: 'bi-exclamation-triangle',
        color: 'danger',
        sub: accionesPendientes > 0 ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Requieren seguimiento' : '✓ Sin acciones',
        subClass: accionesPendientes > 0 ? 'kair-rad-kpi__sub--danger' : 'kair-rad-kpi__sub--success'
      },
      {
        value: String(actasTotal),
        label: 'Actas de Reunión',
        icon: 'bi-people',
        color: 'info',
        sub: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Última: ' + ultimaActa
      }
    ];

    kpis.forEach(function(kpi) {
      var item = document.createElement('div');
      item.className = 'kair-rad-kpi';
      item.innerHTML =
        '<div class="kair-rad-kpi__icon kair-rad-kpi__icon--' + kpi.color + '">' +
          '<i class="bi ' + kpi.icon + '" style="font-size:1.125rem"></i>' +
        '</div>' +
        '<div class="kair-rad-kpi__content">' +
          '<div class="kair-rad-kpi__value">' + _esc(kpi.value) + '</div>' +
          '<div class="kair-rad-kpi__label">' + _esc(kpi.label) + '</div>' +
          '<div class="kair-rad-kpi__sub ' + (kpi.subClass || '') + '">' + kpi.sub + '</div>' +
        '</div>';
      strip.appendChild(item);
    });

    return strip;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: HERO CONTEXTUAL · Patrón B
     ═══════════════════════════════════════════════════════════════════════ */

  function _renderHero() {
    /* Hero SIN título interno · ahora el título viene del section-title
       del caller (alineado con las demás secciones del hub) */
    var hero = document.createElement('section');
    hero.className = 'kair-rad-hero';

    var pillsHtml = '<div class="kair-rad-hero__pills">' +
      '<span class="kair-rad-hero__pill kair-rad-hero__pill--active"><span class="dot"></span>Submódulo activo</span>' +
      '<span class="kair-rad-hero__pill kair-rad-hero__pill--meta">Ciclo anual · Resolución 0312 de 2019</span>' +
      '<span class="kair-rad-hero__pill kair-rad-hero__pill--meta">Decreto 1072 de 2015 · Art. 2.2.4.1.7</span>' +
    '</div>';

    var ctas = '';
    if (state.cicloActivo) {
      ctas = '<div class="kair-rad-hero__cta">' +
        '<button class="kair-rad-header__action kair-rad-header__action--primary" data-cta="open-cycle">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
          ' Iniciar nueva revisión' +
        '</button>' +
        '<button class="kair-rad-header__action kair-rad-header__action--secondary" data-cta="history">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
          ' Ver historial completo' +
        '</button>' +
      '</div>';
    } else {
      ctas = '<div class="kair-rad-hero__cta">' +
        '<button class="kair-rad-header__action kair-rad-header__action--primary" data-cta="open-cycle">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
          ' Iniciar primera revisión' +
        '</button>' +
      '</div>';
    }

    hero.innerHTML = pillsHtml +
      '<p class="kair-rad-hero__desc">Administra el ciclo completo de la revisión gerencial anual conforme al procedimiento <strong>G-PR-001</strong>: preparación de información, ejecución de la revisión con la gerencia, elaboración del acta <strong>G-FO-006</strong> (12 secciones canónicas), seguimiento de acciones resultantes y trazabilidad documental. Las plantillas Excel siguen siendo la fuente de verdad y pueden exportarse en cualquier momento.</p>' +
      ctas;

    return hero;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: GRID DE COMPONENTES · 5 cards + 1 cycle card
     ═══════════════════════════════════════════════════════════════════════ */

  function _renderComponentesGrid() {
    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-card-grid';

    COMPONENTES.forEach(function(c) {
      var card = document.createElement('article');
      card.className = 'kair-rad-submodule-card';
      card.setAttribute('data-view', c.key);
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      var metaHtml = '';
      if (c.key === 'revisiones') {
        metaHtml = '<div class="kair-rad-submodule-card__meta">' +
          '<span class="kair-rad-submodule-card__chip kair-rad-submodule-card__chip--success">' + c.meta.realizadas + ' realizadas</span>' +
          '<span class="kair-rad-submodule-card__chip kair-rad-submodule-card__chip--warning">' + c.meta.enCurso + ' en curso</span>' +
        '</div>';
      } else if (c.key === 'actas') {
        metaHtml = '<div class="kair-rad-submodule-card__meta">' +
          '<span class="kair-rad-submodule-card__chip">' + c.meta.total + ' actas</span>' +
          '<span class="kair-rad-submodule-card__chip kair-rad-submodule-card__chip--info">' + c.meta.abiertas + '</span>' +
        '</div>';
      } else if (c.key === 'despliegue') {
        metaHtml = '<div class="kair-rad-submodule-card__meta">' +
          '<span class="kair-rad-submodule-card__chip">' + c.meta.total + ' indicadores</span>' +
          '<span class="kair-rad-submodule-card__chip kair-rad-submodule-card__chip--success">' + c.meta.cumplen + ' cumplen</span>' +
        '</div>';
      } else if (c.key === 'procedimiento') {
        metaHtml = '<div class="kair-rad-submodule-card__meta">' +
          '<span class="kair-rad-submodule-card__chip">' + c.meta.rev + '</span>' +
          '<span class="kair-rad-submodule-card__chip kair-rad-submodule-card__chip--neutral">' + c.chipLabel + '</span>' +
        '</div>';
      }

      card.innerHTML =
        '<div class="kair-rad-submodule-card__head">' +
          '<div class="kair-rad-submodule-card__icon kair-rad-submodule-card__icon--' + c.iconColor + '">' +
            '<i class="bi ' + c.icon + '" style="font-size:1.125rem"></i>' +
          '</div>' +
          '<div style="flex:1; min-width:0">' +
            '<div class="kair-rad-submodule-card__format">' + _esc(c.format) + ' · ' + _esc(c.formatLabel) + '</div>' +
            '<h3 class="kair-rad-submodule-card__title">' + _esc(c.title) + '</h3>' +
          '</div>' +
          '<i class="bi bi-chevron-right kair-rad-submodule-card__chev"></i>' +
        '</div>' +
        '<p class="kair-rad-submodule-card__desc">' + _esc(c.description) + '</p>' +
        '<div class="kair-rad-submodule-card__divider"></div>' +
        metaHtml;

      card.addEventListener('click', function() { navigate(c.key); });
      card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(c.key);
        }
      });
      wrap.appendChild(card);
    });

    return wrap;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: CYCLE CARD · Revisión activa (si existe)
     ═══════════════════════════════════════════════════════════════════════ */

  function _renderCycleCard() {
    if (!state.cicloActivo) return null;

    var ciclo = state.cicloActivo;
    var prog = ciclo.progreso || 0;
    var progCls = prog >= 100 ? 'success' : (prog >= 60 ? '' : (prog >= 25 ? '' : 'warning'));

    var card = document.createElement('article');
    card.className = 'kair-rad-cycle-card';
    card.innerHTML =
      '<span class="kair-rad-cycle-card__pill"><span class="dot"></span>Ciclo activo</span>' +
      '<h3 class="kair-rad-cycle-card__title">Revisión ' + _esc(ciclo.id || '') + '</h3>' +
      '<p class="kair-rad-cycle-card__period">Período ' + _esc(ciclo.periodo || '') + ' · ' + _esc(ciclo.estado || '') + '</p>' +
      '<div class="kair-rad-cycle-card__progress">' +
        '<div class="kair-rad-cycle-card__progress-label">' +
          '<span>Progreso del acta</span>' +
          '<strong>' + prog + '%</strong>' +
        '</div>' +
        '<div class="kair-rad-progress">' +
          '<div class="kair-rad-progress__bar ' + (progCls ? 'kair-rad-progress__bar--' + progCls : '') + '" style="width:' + prog + '%"></div>' +
        '</div>' +
      '</div>' +
      '<div class="kair-rad-cycle-card__actions">' +
        '<button class="kair-rad-header__action kair-rad-header__action--secondary" data-cycle="view">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
          ' Ver acta completa' +
        '</button>' +
        '<button class="kair-rad-header__action kair-rad-header__action--primary" data-cycle="open">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
          ' Iniciar nueva revisión' +
        '</button>' +
      '</div>';

    return card;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: HUB · Vista principal
     ═══════════════════════════════════════════════════════════════════════ */

  function _renderHubView() {
    /* Layout BENTO 2×2 · aprovecha espacio horizontal secuencialmente:
       ┌──────────────────────────────────────────────────────────┐
       │ KPI Strip (ancho completo)                              │
       ├────────────────────────────┬─────────────────────────────┤
       │ Fila 1 · Hero contextual   │ Ciclo Activo                 │
       ├────────────────────────────┼─────────────────────────────┤
       │ Fila 2 · Componentes       │ Revisiones recientes         │
       └────────────────────────────┴─────────────────────────────┘
    */
    var wrap = document.createElement('div');

    /* KPI Strip (ancho completo) */
    wrap.appendChild(_renderKpiStrip());

    /* ════════════════════════════════════════════════════
       FILA 1 · Hero contextual + Ciclo Activo
       ════════════════════════════════════════════════════ */
    var row1 = document.createElement('div');
    row1.className = 'kair-rad-hub-row kair-rad-hub-row--2col';

    /* Columna izquierda · Hero contextual + section-title arriba */
    var row1Left = document.createElement('div');
    row1Left.className = 'kair-rad-hub-row__col kair-rad-hub-row__col--wide';
    /* Section title (alineado con las demás secciones) */
    var heroTitle = document.createElement('div');
    heroTitle.className = 'kair-rad-section-title';
    heroTitle.innerHTML =
      '<h3>Revisión por la Alta Dirección</h3>' +
      '<p>Contexto normativo y acciones rápidas del submódulo 6.1.3.</p>';
    row1Left.appendChild(heroTitle);
    row1Left.appendChild(_renderHero());
    row1.appendChild(row1Left);

    /* Columna derecha · Ciclo Activo (con título) */
    var row1Right = document.createElement('div');
    row1Right.className = 'kair-rad-hub-row__col kair-rad-hub-row__col--narrow';
    if (state.cicloActivo) {
      var cycleTitle = document.createElement('div');
      cycleTitle.className = 'kair-rad-section-title';
      cycleTitle.innerHTML = '<h3>Ciclo activo</h3><p>Revisión gerencial en curso.</p>';
      row1Right.appendChild(cycleTitle);
      var cycleCard = _renderCycleCard();
      if (cycleCard) row1Right.appendChild(cycleCard);
    } else {
      /* Sin ciclo activo · placeholder motivacional */
      var empty = document.createElement('div');
      empty.className = 'kair-rad-hub-empty';
      empty.innerHTML =
        '<div class="kair-rad-hub-empty__icon"><i class="bi bi-clipboard2-pulse"></i></div>' +
        '<h4>Sin ciclo activo</h4>' +
        '<p>Inicia una nueva revisión gerencial para comenzar el ciclo conforme al procedimiento G-PR-001.</p>' +
        '<button class="k-btn k-btn-primary k-btn-sm" data-empty="start-cycle">' +
          '<i class="bi bi-plus-circle"></i> Iniciar primera revisión' +
        '</button>';
      row1Right.appendChild(empty);
    }
    row1.appendChild(row1Right);
    wrap.appendChild(row1);

    /* ════════════════════════════════════════════════════
       FILA 2 · Componentes del submódulo + Revisiones recientes
       ════════════════════════════════════════════════════ */
    var row2 = document.createElement('div');
    row2.className = 'kair-rad-hub-row kair-rad-hub-row--2col';

    /* Columna izquierda · Componentes del submódulo (grid 2 cols interno) */
    var row2Left = document.createElement('div');
    row2Left.className = 'kair-rad-hub-row__col kair-rad-hub-row__col--wide';
    var compTitle = document.createElement('div');
    compTitle.className = 'kair-rad-section-title';
    compTitle.innerHTML =
      '<h3>Componentes del submódulo</h3>' +
      '<p>Cada componente preserva su formato oficial como fuente de verdad y plantilla exportable.</p>';
    row2Left.appendChild(compTitle);
    row2Left.appendChild(_renderComponentesGrid());
    row2.appendChild(row2Left);

    /* Columna derecha · Revisiones recientes (tabla) */
    var row2Right = document.createElement('div');
    row2Right.className = 'kair-rad-hub-row__col kair-rad-hub-row__col--narrow';
    var recentTitle = document.createElement('div');
    recentTitle.className = 'kair-rad-section-title';
    recentTitle.innerHTML =
      '<h3>Revisiones recientes</h3>' +
      '<p>Acceso rápido a las últimas revisiones gerenciales registradas.</p>';
    row2Right.appendChild(recentTitle);
    row2Right.appendChild(_renderRevisionesRecientesTable());
    row2.appendChild(row2Right);

    wrap.appendChild(row2);

    /* Bind del botón "Iniciar primera revisión" cuando no hay ciclo activo */
    setTimeout(function() {
      var btn = document.querySelector('[data-empty="start-cycle"]');
      if (btn) {
        btn.addEventListener('click', function() {
          navigate('revisiones-list');
          toast('Nueva Revisión Gerencial', 'Iniciando ciclo conforme a G-PR-001', 'info');
        });
      }
    }, 0);

    return wrap;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: TABLA REVISIONES RECIENTES
     ═══════════════════════════════════════════════════════════════════════ */

  function _renderRevisionesRecientesTable() {
    var card = document.createElement('div');
    card.className = 'kair-rad-table-card';

    var rows = state.revisiones.slice(0, 10);
    if (rows.length === 0) {
      card.appendChild(_renderEmptyState(
        'Sin revisiones registradas',
        'Aún no hay revisiones gerenciales. Inicie la primera desde el botón superior derecho.',
        'Iniciar primera revisión',
        'kair-rad-empty-cta'
      ));
      return card;
    }

    var table = document.createElement('table');
    table.className = 'kair-rad-table';

    var thead = '<thead><tr>' +
      '<th>Consecutivo</th>' +
      '<th>Período</th>' +
      '<th class="cell-ellipsis">Empresa</th>' +
      '<th>Fecha</th>' +
      '<th class="cell-ellipsis">Preside</th>' +
      '<th class="cell-ellipsis">Elabora</th>' +
      '<th>Estado</th>' +
      '<th style="min-width:140px">Progreso</th>' +
      '<th class="cell-actions-head">Acciones</th>' +
    '</tr></thead>';
    table.innerHTML = thead;

    var tbody = document.createElement('tbody');
    rows.forEach(function(r) {
      var prog = r.progreso || 0;
      var fillCls = prog >= 100 ? 'kair-rad-table-progress__fill--success' : (prog >= 50 ? '' : 'kair-rad-table-progress__fill--warning');

      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="cell-mono">' + _esc(r.id || '') + '</td>' +
        '<td>' + _esc(r.periodo || '') + '</td>' +
        '<td class="cell-ellipsis" title="' + _esc(r.empresa || '—') + '">' + _esc(r.empresa || '—') + '</td>' +
        '<td>' + _esc(formatDate(r.fecha || r.fechaProgramada || '')) + '</td>' +
        '<td class="cell-ellipsis" title="' + _esc(r.preside || '—') + '">' + _esc(r.preside || '—') + '</td>' +
        '<td class="cell-ellipsis" title="' + _esc(r.elabora || '—') + '">' + _esc(r.elabora || '—') + '</td>' +
        '<td>' + badgeFor(r.estado || 'Borrador') + '</td>' +
        '<td>' +
          '<div class="kair-rad-table-progress">' +
            '<div class="kair-rad-table-progress__bar">' +
              '<div class="kair-rad-table-progress__fill ' + fillCls + '" style="width:' + prog + '%"></div>' +
            '</div>' +
            '<span class="kair-rad-table-progress__label">' + prog + '%</span>' +
          '</div>' +
        '</td>' +
        '<td class="cell-actions-cell"><div class="cell-actions">' +
          '<button class="kair-rad-icon-btn" title="Ver acta" data-hub-action="view" data-row-id="' + _esc(r.id || '') + '">' +
            '<i class="bi bi-eye"></i>' +
          '</button>' +
          '<button class="kair-rad-icon-btn" title="Editar" data-hub-action="edit" data-row-id="' + _esc(r.id || '') + '">' +
            '<i class="bi bi-pencil"></i>' +
          '</button>' +
          '<button class="kair-rad-icon-btn kair-rad-icon-btn--danger" title="Eliminar borrador" data-hub-action="delete" data-row-id="' + _esc(r.id || '') + '" data-row-estado="' + _esc(r.estado || '') + '">' +
            '<i class="bi bi-trash"></i>' +
          '</button>' +
        '</div></td>';
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    card.appendChild(table);
    return card;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: REVISIONES LIST · Patrón A Dashboard (OLA 2)
     ═══════════════════════════════════════════════════════════════════════ */

  /* ═══════════════════════════════════════════════════════════════════════
     ENRIQUECIMIENTO DE INDICADORES CON AUTO-RESULTADOS
     Cuando los indicadores vienen recién sembrados del Excel espejo
     (resultado=null), los enriquecemos con los resultados auto-calculados
     que el módulo 2.2.1 también usa. Esto llena las columnas "Último Valor"
     y "Estado" de la tabla de Despliegue Estratégico.

     Matching por keyword: cada keyword (frecuencia, severidad, presupuesto,
     etc.) se busca en el nombre del indicador; gana el match más largo y
     específico. Mismo algoritmo que objetivos-sst-viewer.js.
     ═══════════════════════════════════════════════════════════════════════ */

  function _matchIndicatorToAutoData(indicador, autoData) {
    if (!indicador || !autoData) return null;
    var nameText = (indicador.indicador || '').toLowerCase();
    var fullText = ((indicador.indicador || '') + ' ' + (indicador.formula || '') + ' ' + (indicador.meta || '')).toLowerCase();
    var best = { keyword: null, resultado: null, score: 0 };

    Object.keys(autoData).forEach(function(keyword) {
      var data = autoData[keyword];
      if (!data || !data.resultado) return;
      var kw = keyword.toLowerCase();
      var nameScore = nameText.indexOf(kw) >= 0 ? keyword.length * 2 : 0;
      var fullScore = fullText.indexOf(kw) >= 0 ? keyword.length : 0;
      var score = Math.max(nameScore, fullScore);
      if (score > best.score) {
        best.keyword = keyword;
        best.resultado = data;
        best.score = score;
      }
    });

    return best.resultado ? {
      keyword: best.keyword,
      resultado: best.resultado.resultado,
      porcentajeReal: best.resultado.porcentajeReal
    } : null;
  }

  /* Estado derivado del porcentaje real (auto-resultado).
     - porcentajeReal >= 80  → Cumple
     - 60 <= porcentajeReal < 80 → Parcial
     - porcentajeReal < 60  → No cumple
     - null / undefined → Sin medición */
  function _calcularEstadoDesdePorcentaje(porcentajeReal) {
    if (porcentajeReal == null || isNaN(porcentajeReal)) return 'Sin medición';
    if (porcentajeReal >= 80) return 'Cumple';
    if (porcentajeReal >= 60) return 'Parcial';
    return 'No cumple';
  }

  function _enrichIndicadoresConAuto(indicadores, autoData) {
    if (!Array.isArray(indicadores) || !autoData) return 0;
    var matched = 0;
    indicadores.forEach(function(ind) {
      if (!ind) return;
      /* Si ya tiene resultado manual, respetarlo */
      if (ind.ultimoValor && ind.ultimoValor !== '—') return;
      var match = _matchIndicatorToAutoData(ind, autoData);
      if (match) {
        ind.ultimoValor = match.resultado;
        ind.estado = _calcularEstadoDesdePorcentaje(match.porcentajeReal);
        ind.keyword = match.keyword;
        ind.porcentajeReal = match.porcentajeReal;
        /* Tendiente hacia arriba si cumple, hacia abajo si no */
        ind.tendencia = match.porcentajeReal >= 80 ? 'up' : match.porcentajeReal >= 60 ? 'flat' : 'down';
        matched++;
      }
    });
    return matched;
  }

  function _buildViewCtx() {
    return {
      data: {
        revisiones: state.revisiones,
        cicloActivo: state.cicloActivo,
        empresaActiva: state.empresaActiva,
        actas: state.actas,
        indicadores: state.indicadores,
        documentos: state.documentos
      },
      params: state.viewParams,
      state: state,
      navigate: navigate,
      toast: toast,
      confirm: _showConfirmDialog,
      eliminarRevision: eliminarRevision,
      guardarRevision: guardarRevision,
      guardarActa: guardarActa,
      refresh: function() {
        /* Forzar re-render preservando la vista actual */
        renderAll();
      }
    };
  }

  function _renderRevisionesListView() {
    if (!window.RevisionesListView) {
      return _renderErrorView('Vista de listado no disponible. Recargue la página.');
    }
    return window.RevisionesListView.render(_buildViewCtx());
  }

  function _renderRevisionEditorView() {
    if (!window.RevisionEditorView) {
      return _renderErrorView('Vista de editor no disponible. Recargue la página.');
    }
    return window.RevisionEditorView.render(_buildViewCtx());
  }

  function _renderRevisionViewerView() {
    if (!window.RevisionViewerView) {
      return _renderErrorView('Vista de visor no disponible. Recargue la página.');
    }
    return window.RevisionViewerView.render(_buildViewCtx());
  }

  function _renderActasReunionView() {
    if (!window.ActasReunionView) {
      return _renderErrorView('Vista de actas no disponible. Recargue la página.');
    }
    var ctx = _buildViewCtx();
    return window.ActasReunionView.render(ctx);
  }

  function _renderActasEditorView() {
    if (!window.ActasEditorView) {
      return _renderErrorView('Vista de editor de actas no disponible. Recargue la página.');
    }
    return window.ActasEditorView.render(_buildViewCtx());
  }

  function _renderDespliegueView() {
    if (!window.DespliegueEstrategicoView) {
      return _renderErrorView('Vista de despliegue no disponible. Recargue la página.');
    }
    return window.DespliegueEstrategicoView.render(_buildViewCtx());
  }

  function _renderProcedimientoView() {
    if (!window.ProcedimientoView) {
      return _renderErrorView('Vista de procedimiento no disponible. Recargue la página.');
    }
    return window.ProcedimientoView.render(_buildViewCtx());
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: PLACEHOLDER · Para vistas en construcción (OLA 2-3)
     ═══════════════════════════════════════════════════════════════════════ */

  function _renderPlaceholderView(viewKey) {
    var comp = COMPONENTES.filter(function(c) { return c.key === viewKey; })[0];
    if (!comp) return _renderErrorView('Vista desconocida: ' + viewKey);

    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-placeholder';

    var phaseMap = {
      2: 'OLA 2',
      3: 'OLA 3'
    };

    wrap.innerHTML =
      '<div class="kair-rad-placeholder__icon">' +
        '<i class="bi ' + comp.icon + '" style="font-size:1.5rem"></i>' +
      '</div>' +
      '<h2 class="kair-rad-placeholder__title">' + _esc(comp.title) + '</h2>' +
      '<p class="kair-rad-placeholder__desc">' +
        'La vista completa de <strong>' + _esc(comp.title) + '</strong> se entrega en la siguiente ola de implementación. ' +
        'El formato oficial <strong>' + _esc(comp.format) + '</strong> ya está catalogado como fuente de verdad y los datos existentes se preservan sin cambios.' +
      '</p>' +
      '<span class="kair-rad-placeholder__phase">' +
        '<i class="bi bi-flag-fill"></i> Próxima entrega: ' + phaseMap[comp.phase] || 'siguiente fase' +
      '</span>' +
      '<div style="margin-top:var(--rad-s6)">' +
        '<button class="kair-rad-header__action kair-rad-header__action--secondary" data-placeholder="back">' +
          '<i class="bi bi-arrow-left"></i> Volver al hub' +
        '</button>' +
      '</div>';

    return wrap;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER: ESTADOS · Loading / Empty / Error
     ═══════════════════════════════════════════════════════════════════════ */

  function _renderLoadingView() {
    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-state';
    wrap.innerHTML =
      '<div class="kair-rad-skeleton" style="width:48px;height:48px;border-radius:50%"></div>' +
      '<h3 class="kair-rad-state__title">Cargando módulo 6.1.3</h3>' +
      '<p class="kair-rad-state__desc">Sincronizando revisiones gerenciales con el backend…</p>';
    return wrap;
  }

  function _renderErrorView(msg) {
    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-state';
    wrap.innerHTML =
      '<div class="kair-rad-state__icon kair-rad-state__icon--danger">' +
        '<i class="bi bi-exclamation-triangle" style="font-size:1.5rem"></i>' +
      '</div>' +
      '<h3 class="kair-rad-state__title">No se pudo cargar la información</h3>' +
      '<p class="kair-rad-state__desc">' + _esc(msg) + '</p>' +
      '<button class="kair-rad-header__action kair-rad-header__action--secondary" data-error="retry">' +
        '<i class="bi bi-arrow-clockwise"></i> Reintentar' +
      '</button>';
    return wrap;
  }

  function _renderEmptyState(title, desc, btnLabel, btnId) {
    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-state';
    wrap.innerHTML =
      '<div class="kair-rad-state__icon kair-rad-state__icon--muted">' +
        '<i class="bi bi-inbox" style="font-size:1.5rem"></i>' +
      '</div>' +
      '<h3 class="kair-rad-state__title">' + _esc(title) + '</h3>' +
      '<p class="kair-rad-state__desc">' + _esc(desc) + '</p>' +
      (btnLabel ? '<button class="kair-rad-header__action kair-rad-header__action--primary" id="' + _esc(btnId) + '">' + _esc(btnLabel) + '</button>' : '');
    return wrap;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     GLOBAL BINDINGS · Handlers del header y CTAs
     ═══════════════════════════════════════════════════════════════════════ */

  function bindGlobalActions() {
    /* CTA primaria del header (Nueva Revisión Gerencial)
       FIX (2026-06-19, segundo intento): siempre crea una revisión nueva,
       sin importar que ya exista cicloActivo. La acción del usuario es
       explícita ("quiero una nueva"), no "continuar con la actual". */
    var cta = document.getElementById('kair-rad-cta-new');
    if (cta) {
      cta.addEventListener('click', async function() {
        var t = null;
        try { t = Sileo.loading({ title: 'Nueva Revisión Gerencial', description: 'Creando borrador inicial...' }); } catch (e) {}
        try {
          var result = await guardarRevision({}, true);
          if (t) { try { t.dismiss(); } catch (e) {} }
          if (result && result.success && result.revision) {
            /* Poner la nueva como ciclo activo */
            state.cicloActivo = result.revision;
            navigate('revisiones-editor', { id: result.revision.id });
          } else {
            navigate('revisiones-list');
          }
        } catch (e) {
          if (t) { try { t.dismiss(); } catch (e) {} }
          log('NEW', 'ERROR', e && e.message ? e.message : String(e));
          navigate('revisiones-list');
        }
      });
    }

    /* Breadcrumb · click en "Verificación" → vuelve al home del módulo (si existe backCb) */
    document.querySelectorAll('[data-bc]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (typeof backToModuleCallback === 'function') {
          backToModuleCallback();
        } else {
          navigate('hub');
        }
      });
    });

    /* Header CTAs contextuales por vista */
    var ctaFinish = document.getElementById('kair-rad-cta-finish');
    if (ctaFinish) {
      ctaFinish.addEventListener('click', function() {
        var id = state.viewParams && state.viewParams.id;
        if (id) {
          /* Marcar todas las secciones como completas y navegar al viewer */
          if (state.editor) {
            if (window.RevisionEditorView && window.RevisionEditorView.SECCIONES) {
              window.RevisionEditorView.SECCIONES.forEach(function(s) {
                state.editor.completed[s.key] = true;
              });
            }
          }
          toast('Revisión finalizada', 'Generando acta G-FO-006', 'success');
          navigate('revisiones-viewer', { id: id });
        }
      });
    }
    var ctaExport = document.getElementById('kair-rad-cta-export');
    if (ctaExport) {
      ctaExport.addEventListener('click', async function() {
        if (ctaExport.disabled) return;
        ctaExport.disabled = true;
        try {
          var empresaId = state.empresaActiva || state.empresaId || '';
          /* Determinar el tipo de plantilla según la vista actual */
          var tipoPlantilla = 'G-FO-009';
          var itemId = null;
          if (state.currentView === 'revisiones-viewer' && state.viewParams && state.viewParams.id) {
            tipoPlantilla = 'G-FO-006';
            itemId = state.viewParams.id;
          } else if (state.currentView === 'actas' && state.actas && state.actas.length > 0) {
            /* Si hay un acta activa seleccionada, exportar esa; sino exportar la primera */
            var actaActiva = state.viewParams && state.viewParams.id
              ? state.actas.filter(function(a) { return a.id === state.viewParams.id; })[0]
              : state.actas[0];
            if (actaActiva) itemId = actaActiva.id;
          } else if (state.currentView === 'despliegue' && state.indicadores && state.indicadores.length > 0) {
            tipoPlantilla = 'G-FO-001';
            itemId = state.indicadores[0].id;
          }

          if (!itemId) {
            toast('Sin datos', 'No hay un ' + tipoPlantilla + ' seleccionado para exportar', 'warning');
            ctaExport.disabled = false;
            return;
          }

          if (window.RevisionAltaDireccionService && window.RevisionAltaDireccionService.exportarXlsx) {
            toast('Exportación', 'Generando XLSX (' + tipoPlantilla + ') para ' + itemId, 'info');
            var resp = await window.RevisionAltaDireccionService.exportarXlsx(empresaId, tipoPlantilla, itemId);
            if (resp && resp.success) {
              var ruta = (resp.data && (resp.data.path || resp.data.ruta)) || '';
              toast('Exportación completa', ruta ? ('Guardado en: ' + ruta) : ('XLSX generado para ' + itemId), 'success');
            } else {
              toast('Error al exportar', (resp && resp.error && resp.error.message) || 'No se pudo generar el XLSX', 'error');
            }
          } else {
            toast('Función no disponible', 'No se puede exportar en este momento', 'error');
          }
        } catch (e) {
          toast('Error al exportar', e && e.message ? e.message : 'Error inesperado', 'error');
        } finally {
          ctaExport.disabled = false;
        }
      });
    }
    var ctaPrint = document.getElementById('kair-rad-cta-print');
    if (ctaPrint) {
      ctaPrint.addEventListener('click', function() {
        window.print();
      });
    }
    var ctaOpenDoc = document.getElementById('kair-rad-cta-open-doc');
    if (ctaOpenDoc) {
      ctaOpenDoc.addEventListener('click', function() {
        toast('Abriendo documento', 'G-PR-001 Rev. 01 Nov 2016 (Word)', 'info');
      });
    }
    /* CTA "Volver al listado" del editor de actas (header) */
    var ctaBackEditor = document.getElementById('kair-rad-cta-back-editor');
    if (ctaBackEditor) {
      ctaBackEditor.addEventListener('click', function() {
        navigate('actas');
      });
    }

    /* Hero CTAs */
    document.querySelectorAll('[data-cta]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var cta = btn.getAttribute('data-cta');
        if (cta === 'open-cycle') {
          /* Si hay ciclo activo, abrir su editor; si no, crear uno nuevo y abrirlo */
          if (state.cicloActivo && state.cicloActivo.id) {
            navigate('revisiones-editor', { id: state.cicloActivo.id });
            return;
          }
          var t = null;
          try { t = Sileo.loading({ title: 'Iniciando ciclo de revisión', description: 'Conforme a G-PR-001' }); } catch (e) {}
          try {
            var result = await guardarRevision({}, true);
            if (t) { try { t.dismiss(); } catch (e) {} }
            if (result && result.success && result.revision) {
              navigate('revisiones-editor', { id: result.revision.id });
            } else {
              navigate('revisiones-list');
            }
          } catch (e) {
            if (t) { try { t.dismiss(); } catch (e) {} }
            log('OPEN_CYCLE', 'ERROR', e && e.message ? e.message : String(e));
            navigate('revisiones-list');
          }
        } else if (cta === 'history') {
          navigate('revisiones-list');
        }
      });
    });

    /* Cycle card CTAs */
    document.querySelectorAll('[data-cycle]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var action = btn.getAttribute('data-cycle');
        if (action === 'view' && state.cicloActivo && state.cicloActivo.id) {
          navigate('revisiones-viewer', { id: state.cicloActivo.id });
        } else if (action === 'open') {
          if (state.cicloActivo && state.cicloActivo.id) {
            navigate('revisiones-editor', { id: state.cicloActivo.id });
          } else {
            navigate('revisiones-list');
          }
        }
      });
    });

    /* Placeholder back */
    document.querySelectorAll('[data-placeholder="back"]').forEach(function(btn) {
      btn.addEventListener('click', function() { navigate('hub'); });
    });

    /* Error retry */
    var retryBtn = document.querySelector('[data-error="retry"]');
    if (retryBtn) {
      retryBtn.addEventListener('click', function() {
        init();
      });
    }

    /* Tabla acciones del hub → navega a la vista de detalle, edita o elimina
       NOTA: usa [data-hub-action] (específico del hub) para NO interferir
       con los handlers de las vistas revisiones-list/revisiones-editor que
       usan [data-row-action]. Antes del fix, este handler global capturaba
       también los botones de las vistas y causaba doble-binding. */
    document.querySelectorAll('[data-hub-action]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var id = btn.getAttribute('data-row-id');
        var action = btn.getAttribute('data-hub-action');
        if (action === 'view') {
          navigate('revisiones-viewer', { id: id });
        } else if (action === 'edit') {
          navigate('revisiones-editor', { id: id });
        } else if (action === 'delete') {
          var estado = btn.getAttribute('data-row-estado') || '';
          var isBorrador = estado === 'Borrador' || estado === 'En Proceso' || estado === 'Programada';
          var eliminado = await eliminarRevision(id, isBorrador);
          if (eliminado) {
            /* Re-render para reflejar el cambio */
            renderAll();
          }
        }
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     INIT · Punto de entrada
     ═══════════════════════════════════════════════════════════════════════ */

  async function init() {
    ensureCSS();
    /* Render inmediato con loading state */
    renderAll();
    /* Carga async de datos */
    await loadData();
    /* Re-render con datos */
    renderAll();
    log('INIT', 'SUCCESS', 'dataSource=' + state.dataSource + ' | view=' + state.currentView);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PUBLIC API · Preservada 100% para compat con renderer.js dispatch
     ═══════════════════════════════════════════════════════════════════════ */

  function RevisionAltaDireccionComponent(containerEl, company, moduleName, submoduleTitle, backCb) {
    container = containerEl;
    currentCompany = company;
    backToModuleCallback = backCb;
    /* moduleName y submoduleTitle son parte de la firma legacy pero ya no se usan internamente */
  }

  RevisionAltaDireccionComponent.prototype.render = function() {
    return init();
  };

  RevisionAltaDireccionComponent.prototype.destroy = function() {
    if (container) container.innerHTML = '';
    state.editing = null;
    state.currentView = 'hub';
    state.viewParams = {};
  };

  return RevisionAltaDireccionComponent;
})();

window.RevisionAltaDireccionComponent = RevisionAltaDireccionComponent;
