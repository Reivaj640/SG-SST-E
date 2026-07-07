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
    plan:         'Plan de Trabajo',
    capacitacion: 'Capacitación',
    auditoria:    'Auditoría',
    rapido:       'Evento rápido',
    vencido:      'Vencido',
    gestacion:    'Seguimiento Gestación',
    primary:      'Evento',
    success:      'Evento',
    warning:      'Evento',
    danger:       'Evento',
    info:         'Evento'
  };

  var TYPE_COLORS = {
    plan:         '#174ea6',
    capacitacion: '#28a745',
    auditoria:    '#ffc107',
    rapido:       '#6c757d',
    vencido:      '#dc3545',
    gestacion:    '#ec4899'
  };

  // Mapeo de tipo de evento → función de navegación al módulo origen.
  // Si no hay mapeo, no se muestra el botón "Ir al módulo".
  var NAV_MAP = {
    plan:         function () { _navigate('plan-trabajo'); },
    capacitacion: function () { _navigate('capacitaciones'); },
    auditoria:    function () { _navigate('auditoria-anual'); },
    // 📦497 — Gestación: navega al submódulo de ausentismo donde está
    // Seguimiento de Gestación. 1 click adicional del usuario para llegar
    // a la vista específica (consistente con el patrón de capacitación).
    gestacion:    function () { _navigate('3.3.6 Medición del ausentismo por causa médica'); }
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
    _el.className = 'kair-cal-dp-overlay';
    _el.setAttribute('role', 'dialog');
    _el.setAttribute('aria-label', 'Detalle del evento');
    document.body.appendChild(_el);
    return _el;
  }

  function _render(event) {
    var type = event.type || 'info';
    var label = TYPE_LABELS[type] || 'Evento';
    var color = TYPE_COLORS[type] || '#6c757d';
    var dateStr = _formatDate(event.date);
    var timeStr = '';
    if (event.start && event.start !== '00:00') {
      timeStr = event.start + (event.end ? ' – ' + event.end : '');
    } else if (event.end && event.end !== '23:59') {
      timeStr = event.start === '00:00' ? '' : '';
    }
    var descStr = event.description ? _esc(event.description) : '<em style="color:var(--kair-cal-text-muted)">Sin descripción</em>';
    var navFn = NAV_MAP[type];
    var navBtn = navFn ? '<button type="button" class="kair-cal-dp-btn kair-cal-dp-btn--primary" data-kair-cal-dp-action="nav">' +
                         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>' +
                         '<span>Ir al módulo</span>' +
                         '</button>' : '';

    return '' +
      '<div class="kair-cal-dp-panel" role="document">' +
        '<header class="kair-cal-dp-head" style="background:linear-gradient(135deg,' + color + ' 0%,' + _darken(color) + ' 100%)">' +
          '<span class="kair-cal-dp-pill">' + _esc(label) + '</span>' +
          '<button type="button" class="kair-cal-dp-close" data-kair-cal-dp-action="close" aria-label="Cerrar">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
          '<h2 class="kair-cal-dp-title">' + _esc(event.title || '(Sin título)') + '</h2>' +
        '</header>' +
        '<div class="kair-cal-dp-body">' +
          '<div class="kair-cal-dp-row">' +
            '<span class="kair-cal-dp-row__label">Fecha</span>' +
            '<span class="kair-cal-dp-row__value">' + _esc(dateStr) + '</span>' +
          '</div>' +
          (timeStr ? '<div class="kair-cal-dp-row">' +
            '<span class="kair-cal-dp-row__label">Hora</span>' +
            '<span class="kair-cal-dp-row__value">' + _esc(timeStr) + '</span>' +
          '</div>' : '') +
          '<div class="kair-cal-dp-row kair-cal-dp-row--block">' +
            '<span class="kair-cal-dp-row__label">Descripción</span>' +
            '<span class="kair-cal-dp-row__value">' + descStr + '</span>' +
          '</div>' +
        '</div>' +
        (navBtn ? '<footer class="kair-cal-dp-foot">' + navBtn + '</footer>' : '') +
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

  // ── API pública ─────────────────────────────────────────────────────
  function open(event) {
    if (!event || typeof event !== 'object') return;
    _currentEvent = event;
    var host = _ensureDom();
    host.innerHTML = _render(event);
    // Forzar reflow para que la animación se dispare
    void host.offsetWidth;
    host.classList.add('kair-cal-dp-overlay--open');
    _isOpen = true;

    // Click fuera del panel → cerrar
    setTimeout(function () {
      _add(document, 'click', _onDocClick);
      _add(document, 'keydown', _onKeyDown);
    }, 50);
  }

  function close() {
    if (!_isOpen || !_el) return;
    _el.classList.remove('kair-cal-dp-overlay--open');
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
    var panel = _el.querySelector('.kair-cal-dp-panel');
    if (panel && panel.contains(e.target)) {
      // Dentro del panel: procesar acción si hay
      var actEl = e.target.closest('[data-kair-cal-dp-action]');
      if (actEl) {
        var action = actEl.getAttribute('data-kair-cal-dp-action');
        if (action === 'close') close();
        else if (action === 'nav' && _currentEvent && NAV_MAP[_currentEvent.type]) {
          NAV_MAP[_currentEvent.type]();
        }
      }
      return;
    }
    // Click fuera → cerrar
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