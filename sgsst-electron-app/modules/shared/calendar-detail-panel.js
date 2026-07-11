/**
 * modules/shared/calendar-detail-panel.js
 *
 * Side panel derecho que muestra el detalle de un evento cuando el usuario
 * hace click en un evento del K+AIR Calendar (botón calendario del header).
 *
 * Comportamiento:
 *   - Se abre desde la derecha (~420px) con animación slide-in.
 *   - Cierra con X, click fuera del panel, o ESC.
 *   - Botón "Ir al módulo" solo aparece para type ∈ {plan, capacitacion, auditoria}.
 *   - Para type='rapido' el componente no debería llamar open() (el calendario
 *     abre su modal nativo de edición).
 *
 * API:
 *   window.calendarDetailPanel.open(event)
 *   window.calendarDetailPanel.close()
 *   window.calendarDetailPanel.isOpen()
 */

(function (global) {
  'use strict';

  // ── Configuración interna ────────────────────────────────────────────
  var TYPE_LABELS = {
    plan:                 'Plan de Trabajo',
    capacitacion:         'Capacitación',
    auditoria:            'Auditoría',
    rapido:               'Evento rápido',
    vencido:              'Vencido',
    gestacion:            'Seguimiento Gestación',
    inspeccion_programada: 'Inspección Programada',
    // 📦509 — Mantenimientos programados pendientes (MPP) del cronograma anual.
    mantenimiento_programado: 'Mantenimiento Programado',
    // 📦522 — Recordatorio mensual del COPASST (cumplimiento legal Decreto 614/1984
    // y Res. 0312/2019 estandar 1.1.6: acta mensual obligatoria dentro de los
    // primeros 5 dias habiles del mes).
    recordatorio_copasst:   'Acta COPASST',
    // 📦523 — Recordatorio mensual del Comite de Convivencia (Res. 0312/2019
    // estandar 6.2.2: reunion mensual obligatoria). Mismo patron que COPASST.
    recordatorio_convivencia: 'Acta Comite Convivencia',
    // 📦524 — Recordatorio operativo de Actualizacion de Presupuesto Mensual.
    // 2 eventos por mes: dia 5 (cierre de los "5 primeros dias") y dia 20
    // (cierre de los "20 primeros dias"). NO es un recordatorio legal — es
    // operativo, para que el usuario no olvide actualizar el presupuesto del
    // modulo de Recursos.
    recordatorio_presupuesto: 'Actualización Presupuesto',
    // 📦525 — Recordatorio LEGAL-OPERATIVO de Afiliacion al SSSI (Sistema de
    // Seguridad Social Integral — salud/pension/riesgos laborales). 1 evento
    // por mes (dia 10) para reportar novedades de personal del mes anterior
    // (Ley 100/1993, Decreto 1295/1994, Decreto 806/1998 art. 16).
    recordatorio_afiliacion: 'Afiliación SSSI',
    primary:              'Evento',
    success:              'Evento',
    warning:              'Evento',
    danger:               'Evento',
    info:                 'Evento'
  };

  var TYPE_COLORS = {
    plan:                 '#174ea6',
    capacitacion:         '#28a745',
    auditoria:            '#ffc107',
    rapido:               '#6c757d',
    vencido:              '#dc3545',
    gestacion:            '#ec4899',
    inspeccion_programada: '#174ea6',
    // 📦509 — Color teal (#0d9488) distintivo de mantenimiento, no choca con
    // los azules de Inspecciones/Plan ni con los verdes de Capacitación.
    mantenimiento_programado: '#0d9488',
    // 📦522 — Color naranja intenso (#ea580c) para el recordatorio del COPASST.
    // Distintivo, alto contraste, evoca "alerta/pendiente" sin ser rojo critico.
    recordatorio_copasst:   '#ea580c',
    // 📦523 — Color cyan (#0891b2) para el recordatorio del Comite de Convivencia.
    // Distinto del naranja del COPASST para que el usuario diferencie facilmente.
    recordatorio_convivencia: '#0891b2',
    // 📦524 — Color emerald (#10b981) para el recordatorio de Actualizacion de
    // Presupuesto. Verde monetario, distintivo del naranja COPASST y cyan Convivencia.
    recordatorio_presupuesto: '#10b981',
    // 📦525 — Color amber (#f59e0b) para el recordatorio de Afiliacion al SSSI.
    // Amarillo calido, distintivo de los 3 recordatorios anteriores.
    recordatorio_afiliacion: '#f59e0b'
  };

  // Mapeo de tipo de evento → función de navegación al módulo origen.
  // Si no hay mapeo, no se muestra el botón "Ir al módulo".
  var NAV_MAP = {
    plan:                 function () { _navigate('plan-trabajo'); },
    capacitacion:         function () { _navigate('capacitaciones'); },
    auditoria:            function () { _navigate('auditoria-anual'); },
    // 📦497 — Gestación: navega al submódulo de ausentismo donde está
    // Seguimiento de Gestación. 1 click adicional del usuario para llegar
    // a la vista específica (consistente con el patrón de capacitación).
    gestacion:            function () { _navigate('3.3.6 Medición del ausentismo por causa médica'); },
    // 📦506 — Inspecciones planificadas: navega al módulo de Gestión de
    // Peligros y Riesgos → Inspecciones (4.2.4). El usuario aterriza en el
    // hub donde puede ver las inspecciones disponibles del mes.
    inspeccion_programada: function () { _navigate('4.2.4 Inspecciones Sistemáticas'); },
    // 📦509 — Mantenimientos programados: navega al submódulo 4.2.5 que es
    // donde el usuario edita el cronograma MPP/MPE/MPC.
    mantenimiento_programado: function () { _navigate('4.2.5 Mantenimiento periodico de equipos, instalaciones herramientas'); },
    // 📦522 — Recordatorio COPASST: navega al submódulo 1.1.6 donde estan
    // las actas y la gestion del COPASST. Es un recordatorio de cumplimiento
    // legal (Decreto 614/1984, Res. 0312/2019), por lo que el boton "Ir al
    // modulo" SI debe aparecer para que el usuario pueda ir rapidamente.
    recordatorio_copasst:   function () { _navigate('copasst'); },
    // 📦523 — Recordatorio Comite de Convivencia: navega al submódulo 1.1.8.
    recordatorio_convivencia: function () { _navigate('comite-convivencia'); },
    // 📦524 — Recordatorio Actualizacion de Presupuesto: navega al modulo
    // 1.1.3 Asignacion de Recursos → Presupuesto. Aterriza en el home del
    // modulo donde el usuario puede ver el resumen del año en curso y los
    // botones "Ingresar" / "Historico de Anos" para editar.
    recordatorio_presupuesto: function () { _navigate('presupuesto'); },
    // 📦525 — Recordatorio Afiliacion al SSSI: navega al modulo
    // 1.1.5 Afiliacion en Recursos. Aterriza en el home del modulo de
    // afiliacion donde el usuario puede ver el estado de los colaboradores
    // afiliados a EPS/AFP/ARL.
    recordatorio_afiliacion: function () { _navigate('afiliacion'); }
  };

  // 📦500 — Mapeo de tipo → label del módulo de origen (para mostrar como
  // chip en el hero del detail panel). Coincide con NAV_MAP arriba.
  var TYPE_SOURCE = {
    plan:                 'Plan de Trabajo',
    capacitacion:         'Capacitación',
    auditoria:            'Auditoría',
    gestacion:            'Seguimiento de Gestación',
    rapido:               'Evento rápido',
    vencido:              'Vencido',
    inspeccion_programada: 'Inspecciones',
    // 📦509 — Mantenimientos programados: apunta al módulo 4.2.5.
    mantenimiento_programado: 'Mantenimiento',
    // 📦522 — Recordatorio COPASST: el origen del recordatorio es el
    // submódulo 1.1.6 COPASST.
    recordatorio_copasst:   'COPASST',
    // 📦523 — Recordatorio Comite de Convivencia: el origen es el
    // submódulo 1.1.8 Comite de Convivencia.
    recordatorio_convivencia: 'Comite Convivencia',
    // 📦524 — Recordatorio Actualizacion de Presupuesto: el origen es el
    // modulo 1.1.3 Asignacion de Recursos → Presupuesto.
    recordatorio_presupuesto: 'Presupuesto',
    // 📦525 — Recordatorio Afiliacion al SSSI: el origen es el modulo
    // 1.1.5 Afiliacion en Recursos.
    recordatorio_afiliacion: 'Afiliación SSSI'
  };

  // ── Estado ───────────────────────────────────────────────────────────
  var _el = null;          // overlay DOM
  var _currentEvent = null;
  var _isOpen = false;
  var _listeners = [];

  // ── Util ─────────────────────────────────────────────────────────────
  function _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _formatDate(iso) {
    if (!iso) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    if (!m) return iso;
    var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    var d = parseInt(m[3], 10);
    var mes = meses[parseInt(m[2], 10) - 1] || '';
    return d + ' de ' + mes + ' de ' + m[1];
  }

  // 📦500 — Nombre del día de la semana en español para el hero header
  // (ej: "miércoles"). Acepta YYYY-MM-DD y devuelve '' si no parsea.
  function _formatWeekday(iso) {
    if (!iso) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    if (!m) return '';
    var d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    if (isNaN(d.getTime())) return '';
    var dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    return dias[d.getDay()] || '';
  }

  // 📦498 — Formato de fecha+hora ISO ('YYYY-MM-DDTHH:MM:SSZ' o similar) a
  // string legible en español, ej: '15 de julio de 2026 a las 14:30'.
  function _formatDateTime(iso) {
    if (!iso) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(iso));
    if (m) {
      var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      return parseInt(m[3], 10) + ' de ' + (meses[parseInt(m[2], 10) - 1] || '') + ' de ' + m[1] + ' a las ' + m[4] + ':' + m[5];
    }
    // Fallback: solo fecha
    return _formatDate(String(iso).slice(0, 10));
  }

  function _navigate(internalModule) {
    // Cierra panel y calendario, navega al módulo origen vía showModuleContent
    // (función global del proyecto SG-SST, definida en renderer.js)
    close();
    if (typeof global.showModuleContent === 'function') {
      try {
        global.showModuleContent(internalModule);
      } catch (e) {
        console.warn('[CalendarDetailPanel] Error navegando a ' + internalModule + ': ' + e.message);
      }
    } else if (typeof global.navigateToModule === 'function') {
      try { global.navigateToModule(internalModule); } catch (e) {
        console.warn('[CalendarDetailPanel] Error con navigateToModule: ' + e.message);
      }
    } else {
      console.warn('[CalendarDetailPanel] No hay función de navegación disponible');
    }
  }

  function _ensureDom() {
    if (_el && document.body.contains(_el)) return _el;
    _el = document.createElement('div');
    // 📦501 — Wrapper idéntico al modal de "Nuevo evento" (mismo z-index
    // system, mismo backdrop behavior). Clase extra kair-cal-dp-preview
    // da hook para ajustes CSS específicos del preview.
    _el.className = 'kair-cal-modal-overlay kair-cal-dp-preview';
    _el.setAttribute('role', 'dialog');
    _el.setAttribute('aria-modal', 'true');
    _el.setAttribute('aria-label', 'Detalle del evento');
    document.body.appendChild(_el);
    return _el;
  }

  function _render(event) {
    var type = event.type || 'info';
    var label = TYPE_LABELS[type] || 'Evento';
    var color = TYPE_COLORS[type] || '#6c757d';
    var dateStr = _formatDate(event.date);
    var weekdayStr = _formatWeekday(event.date);
    var timeStr = 'Todo el día';
    if (event.start && event.start !== '00:00') {
      timeStr = event.start + (event.end ? ' – ' + event.end : '');
    }
    var descStr = event.description
      ? _esc(event.description)
      : '<em style="color:var(--kair-cal-text-muted);font-style:italic;">Sin descripción</em>';

    var navFn = NAV_MAP[type];
    var navBtn = navFn ? '<button type="button" class="kair-cal-btn kair-cal-btn--primary" data-kair-cal-dp-action="nav">' +
                         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>' +
                         '<span>Ir al módulo</span>' +
                         '</button>' : '';

    // 📦501 — Status pill arriba del body (estilo moderno, sobrio). Para
    // eventos pendientes usamos un pill neutro con icono reloj. Para
    // cumplidos, pill verde con check + fecha.
    var statusPill = '';
    var cumplidoFooter = '';
    if (event.cumplido) {
      var fechaCumplido = _formatDateTime(event.cumplidoEn || '');
      statusPill =
        '<div class="kair-cal-dp-status-done">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
          '<span>Realizado' + (fechaCumplido ? ' · ' + _esc(fechaCumplido) : '') + '</span>' +
        '</div>';
      cumplidoFooter =
        '<button type="button" class="kair-cal-btn kair-cal-btn--secondary" data-kair-cal-dp-action="unmark-cumplido">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>' +
          '<span>Desmarcar</span>' +
        '</button>';
    } else {
      statusPill =
        '<div class="kair-cal-dp-status-pending">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' +
          '<span>Pendiente</span>' +
        '</div>';
      cumplidoFooter =
        '<button type="button" class="kair-cal-btn kair-cal-btn--secondary" data-kair-cal-dp-action="mark-cumplido">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
          '<span>Marcar como realizado</span>' +
        '</button>';
    }

    // 📦503 — Botón Editar: solo para eventos rapido (los demás se editan
    // en su módulo origen: capacitacion, gestacion, auditoria, plan). El
    // handler de click llama a window.kairCal._openEventModal(ev) que abre
    // el modal de edición nativa del calendario.
    var editBtn = '';
    if (type === 'rapido') {
      editBtn =
        '<button type="button" class="kair-cal-btn kair-cal-btn--secondary" data-kair-cal-dp-action="edit">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>' +
          '<span>Editar</span>' +
        '</button>';
    }

    return '' +
      // 📦501 — Mismo wrapper que el modal de "Nuevo evento"
      // (kair-cal-modal-overlay + kair-cal-modal). El detail panel ahora
      // es un MODAL CENTRADO con la MISMA estructura que el modal de
      // creación, pero con valores en lugar de inputs. Width 520px.
      '<div class="kair-cal-modal" role="document" data-type="' + _esc(type) + '">' +
        // Header idéntico al modal: titulo + close X
        '<div class="kair-cal-modal__head">' +
          '<div class="kair-cal-modal__title-wrap">' +
            '<h3 class="kair-cal-modal__title" id="kair-cal-dp-title">' +
              _esc(event.title || 'Detalle del evento') +
            '</h3>' +
            statusPill +
          '</div>' +
          '<button type="button" class="kair-cal-modal__close" data-kair-cal-dp-action="close" aria-label="Cerrar">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
        '</div>' +
        // Body con la MISMA estructura del modal pero valores en lugar de inputs
        '<div class="kair-cal-modal__body">' +
          // Categoría: dot + label
          '<div class="kair-cal-field">' +
            '<label class="kair-cal-field__label">Categoría</label>' +
            '<div class="kair-cal-field__value kair-cal-dp-category">' +
              '<span class="kair-cal-dp-type-dot" style="background:' + color + '"></span>' +
              '<span>' + _esc(label) + '</span>' +
            '</div>' +
          '</div>' +
          // Fecha + Hora en 2 columnas — mismo patrón que kair-cal-field__row
          // del modal de Nuevo evento
          '<div class="kair-cal-field__row">' +
            '<div class="kair-cal-field">' +
              '<label class="kair-cal-field__label">Fecha</label>' +
              '<div class="kair-cal-field__value">' +
                '<span class="kair-cal-dp-weekday-mini">' + _esc(weekdayStr) + '</span>' +
                '<span>' + _esc(dateStr) + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="kair-cal-field">' +
              '<label class="kair-cal-field__label">Hora</label>' +
              '<div class="kair-cal-field__value">' + _esc(timeStr) + '</div>' +
            '</div>' +
          '</div>' +
          // Descripción multilinea (estilo textarea del modal pero solo display)
          '<div class="kair-cal-field">' +
            '<label class="kair-cal-field__label">Descripción</label>' +
            '<div class="kair-cal-field__value kair-cal-field__value--multiline">' + descStr + '</div>' +
          '</div>' +
// 📦506 — Meta extra para inspecciones planificadas: muestra
            // el responsable y el tipo de inspección (datos que vienen en
            // event.meta desde el adapter del programa anual).
          (type === 'inspeccion_programada' && event.meta ? (
            '<div class="kair-cal-field__row">' +
              '<div class="kair-cal-field">' +
                '<label class="kair-cal-field__label">Tipo</label>' +
                '<div class="kair-cal-field__value">' + _esc(event.meta.tipoLabel || event.meta.tipoInspeccion || '—') + '</div>' +
              '</div>' +
              '<div class="kair-cal-field">' +
                '<label class="kair-cal-field__label">Responsable</label>' +
                '<div class="kair-cal-field__value">' + _esc(event.meta.responsable || '—') + '</div>' +
              '</div>' +
            '</div>'
          ) : '') +
          // 📦509 — Meta extra para mantenimientos programados: muestra
          // categoría, instalación, código y responsable del equipo.
          (type === 'mantenimiento_programado' && event.meta ? (
            '<div class="kair-cal-field__row">' +
              '<div class="kair-cal-field">' +
                '<label class="kair-cal-field__label">Categoría</label>' +
                '<div class="kair-cal-field__value">' + _esc(event.meta.categoria || '—') + '</div>' +
              '</div>' +
              '<div class="kair-cal-field">' +
                '<label class="kair-cal-field__label">Instalación</label>' +
                '<div class="kair-cal-field__value">' + _esc(event.meta.instalacion || '—') + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="kair-cal-field__row">' +
              '<div class="kair-cal-field">' +
                '<label class="kair-cal-field__label">Código</label>' +
                '<div class="kair-cal-field__value">' + _esc(event.meta.codigo || '—') + '</div>' +
              '</div>' +
              '<div class="kair-cal-field">' +
                '<label class="kair-cal-field__label">Responsable</label>' +
                '<div class="kair-cal-field__value">' + _esc(event.meta.responsable || '—') + '</div>' +
              '</div>' +
            '</div>'
          ) : '') +
        '</div>' +
        // Footer idéntico al modal — acciones right-aligned
        '<div class="kair-cal-modal__foot">' +
          editBtn +
          cumplidoFooter +
          navBtn +
        '</div>' +
      '</div>';
  }

  function _darken(hex) {
    // Oscurece un color hex (#RRGGBB) ~15% para el gradiente.
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    var r = parseInt(hex.substring(1, 3), 16);
    var g = parseInt(hex.substring(3, 5), 16);
    var b = parseInt(hex.substring(5, 7), 16);
    r = Math.max(0, Math.floor(r * 0.78));
    g = Math.max(0, Math.floor(g * 0.78));
    b = Math.max(0, Math.floor(b * 0.78));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  // ── 📦498 — Acciones de cumplimiento (marcar / desmarcar) ─────────
  // Llaman al IPC, actualizan el currentEvent, re-renderizan el panel
  // y disparan un callback opcional para que el calendario refresque los
  // chips. EmpresaId se infiere de window.currentCompany igual que el adapter.
  function _getEmpresaId() {
    try {
      var cc = (typeof global.currentCompany !== 'undefined') ? global.currentCompany : null;
      return (cc && cc !== 'default_company') ? cc : null;
    } catch (e) { return null; }
  }

  function _showToast(msg, type) {
    if (typeof global.kairToast === 'function') {
      global.kairToast(msg, type || 'info');
    } else if (global.updateNotifier && global.updateNotifier.show) {
      global.updateNotifier.show({ type: type || 'info', title: msg, subtitle: '' });
    }
  }

  function _markCumplido(event) {
    var empresaId = _getEmpresaId();
    if (!empresaId || !event.id) {
      _showToast('No se pudo marcar: falta contexto de empresa', 'error');
      return;
    }
    var api = (typeof global.electronAPI !== 'undefined') ? global.electronAPI : null;
    if (!api || !api.eventosCumplidos || !api.eventosCumplidos.marcar) {
      _showToast('API de cumplimiento no disponible', 'error');
      return;
    }
    api.eventosCumplidos.marcar({ empresaId: empresaId, eventoId: event.id, nota: '' })
      .then(function (res) {
        if (res && res.success) {
          event.cumplido = true;
          event.cumplidoEn = (res.data && res.data.cumplidoEn) || new Date().toISOString();
          // Re-render del panel con el nuevo estado. 📦503 — FIX: el código
          // viejo buscaba '.kair-cal-dp-panel' (clase que ya no existe tras
          // 📦501, ahora se usa '.kair-cal-modal') → retornaba null →
          // "Cannot set properties of null (setting 'outerHTML')". Reemplaza
          // el modal adentro del overlay. Los listeners siguen en document
          // (vía _onDocClick) así que el nuevo modal responde al click.
          if (_isOpen && _el) {
            var modalEl = _el.querySelector('.kair-cal-modal');
            if (modalEl) {
              modalEl.outerHTML = _render(event);
            }
          }
          _showToast('Marcado como realizado ✓', 'success');
          // Refrescar calendario para atenuar el chip
          if (typeof global.kairCal !== 'undefined' && global.kairCal && typeof global.kairCal.refresh === 'function') {
            global.kairCal.refresh();
          }
        } else {
          _showToast('Error al marcar: ' + ((res && res.error && res.error.message) || 'desconocido'), 'error');
        }
      })
      .catch(function (err) {
        _showToast('Error de comunicación: ' + (err && err.message || ''), 'error');
      });
  }

  function _unmarkCumplido(event) {
    var empresaId = _getEmpresaId();
    if (!empresaId || !event.id) {
      _showToast('No se pudo desmarcar: falta contexto de empresa', 'error');
      return;
    }
    var api = (typeof global.electronAPI !== 'undefined') ? global.electronAPI : null;
    if (!api || !api.eventosCumplidos || !api.eventosCumplidos.desmarcar) {
      _showToast('API de cumplimiento no disponible', 'error');
      return;
    }
    api.eventosCumplidos.desmarcar({ empresaId: empresaId, eventoId: event.id })
      .then(function (res) {
        if (res && res.success) {
          event.cumplido = false;
          event.cumplidoEn = null;
          if (_isOpen && _el) {
            var host = _ensureDom();
            host.innerHTML = _render(event);
            void host.offsetWidth;
          }
          _showToast('Marcado removido', 'info');
          if (typeof global.kairCal !== 'undefined' && global.kairCal && typeof global.kairCal.refresh === 'function') {
            global.kairCal.refresh();
          }
        } else {
          _showToast('Error al desmarcar: ' + ((res && res.error && res.error.message) || 'desconocido'), 'error');
        }
      })
      .catch(function (err) {
        _showToast('Error de comunicación: ' + (err && err.message || ''), 'error');
      });
  }

  // ── API pública ─────────────────────────────────────────────────────
  function open(event) {
    if (!event || typeof event !== 'object') return;
    _currentEvent = event;
    var host = _ensureDom();
    host.innerHTML = _render(event);
    // Forzar reflow para que la animación se dispare
    void host.offsetWidth;
    // 📦501 — FIX: el host ahora usa clase `kair-cal-modal-overlay` (no
    // `kair-cal-dp-overlay`). La clase `--open` debe ser la del wrapper
    // actual (modal-overlay), sino el CSS lo deja con opacity:0/pointer-events:none
    // y el modal nunca se hace visible.
    host.classList.add('kair-cal-modal-overlay--open');
    _isOpen = true;

    // Click fuera del panel → cerrar
    setTimeout(function () {
      _add(document, 'click', _onDocClick);
      _add(document, 'keydown', _onKeyDown);
    }, 50);
  }

  function close() {
    if (!_isOpen || !_el) return;
    // 📦501 — Mismo cambio: usar la clase --open del wrapper actual
    _el.classList.remove('kair-cal-modal-overlay--open');
    _isOpen = false;
    _currentEvent = null;
    _listeners.forEach(function (l) {
      l.el.removeEventListener(l.type, l.fn);
    });
    _listeners = [];
  }

  function isOpen() { return _isOpen; }

  function _add(el, type, fn) {
    el.addEventListener(type, fn);
    _listeners.push({ el: el, type: type, fn: fn });
  }

  function _onDocClick(e) {
    if (!_el) return;
    var modal = _el.querySelector('.kair-cal-modal');
    // 📦503 — FIX: click en el backdrop (el overlay mismo) cierra el modal.
    // Antes usaba querySelector('.kair-cal-dp-panel') que ya no existe → panel=null
    // → cualquier click caia al fallback close() → el botón "Marcar" o el X
    // cerraban ANTES de procesar su acción. Ahora:
    //   - target === overlay  → click en backdrop  → cerrar
    //   - target dentro modal → procesar acción si hay → return (no cerrar)
    //   - target fuera de ambos → click fuera → cerrar
    if (e.target === _el) {
      close();
      return;
    }
    if (modal && modal.contains(e.target)) {
      // Dentro del modal: procesar acción si hay
      var actEl = e.target.closest('[data-kair-cal-dp-action]');
      if (actEl) {
        var action = actEl.getAttribute('data-kair-cal-dp-action');
        if (action === 'close') close();
        else if (action === 'edit' && _currentEvent) {
          // 📦503 — Editar evento rapido: cierra el panel y abre el modal
          // nativo de edición del calendario con los datos precargados.
          // El modal hace update via adapter.update → bridge → DB.
          var evToEdit = _currentEvent;
          close();
          if (window.kairCal && typeof window.kairCal._openEventModal === 'function') {
            window.kairCal._openEventModal(evToEdit);
          }
        }
        else if (action === 'nav' && _currentEvent && NAV_MAP[_currentEvent.type]) {
          NAV_MAP[_currentEvent.type]();
        }
        // 📦498 — Acciones de cumplimiento (marcar/desmarcar)
        else if (action === 'mark-cumplido' && _currentEvent) {
          _markCumplido(_currentEvent);
        }
        else if (action === 'unmark-cumplido' && _currentEvent) {
          _unmarkCumplido(_currentEvent);
        }
      }
      // 📦503 — IMPORTANTE: retornar sin cerrar. Click dentro del modal que
      // no es una accion conocida NO debe cerrar el panel.
      return;
    }
    // Click fuera del modal y fuera del overlay (ej: sobre el calendario) → cerrar
    close();
  }

  function _onKeyDown(e) {
    if (e.key === 'Escape' && _isOpen) close();
  }

  global.calendarDetailPanel = {
    open: open,
    close: close,
    isOpen: isOpen
  };
})(typeof window !== 'undefined' ? window : this);