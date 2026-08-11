/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Alertas del Calendario
   v1.0 · 2026-07-12 — Sistema de alertas persistentes para el calendario
   ═══════════════════════════════════════════════════════════════════

   Muestra un contador con eventos vencidos o que vencen hoy en el badge
   del icono del calendario. Cuando hay pendientes, fuerza la visibilidad
   del header y abre un popover con la lista para atender cada uno.

   Reutiliza:
     - KairCalendarAdapter.list()      → eventos unificados
     - electronAPI.eventosCumplidos    → marcar / desmarcar
     - window.calendarDetailPanel.open() → detalle de cada evento

   No modifica KairCalendar. El badge y el popover son independientes.
   ═══════════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // ── Configuración interna ────────────────────────────────────────────
  // Las alertas SOLO muestran eventos del año en curso. Esto es una decisión
  // de UX: el usuario quiere ver "lo que tiene que atender este año", no
  // una lista infinita de atrasos históricos que abruma. Si necesita
  // histórico, lo busca en el calendario completo.
  // Si en el futuro se quiere dar opción (ej: "incluir atrasos de años
  // anteriores"), agregar una variable USE_CURRENT_YEAR_ONLY y permitir
  // override via init({ yearScope: 'all' }).
  var USE_CURRENT_YEAR_ONLY = true;

  // Reusa los mismos labels y colores que el resto del sistema. Mantener
  // sincronía con calendar-detail-panel.js (TYPE_LABELS, TYPE_COLORS).
  // Si en el futuro el detail panel cambia, hay que actualizar acá.
  var TYPE_LABELS = {
    plan:                   'Plan de Trabajo',
    capacitacion:           'Capacitación',
    auditoria:              'Auditoría',
    rapido:                 'Evento rápido',
    vencido:                'Vencido',
    gestacion:              'Seguimiento Gestación',
    inspeccion_programada:  'Inspección Programada',
    mantenimiento_programado: 'Mantenimiento Programado',
    recordatorio_copasst:   'Acta COPASST',
    recordatorio_convivencia: 'Acta Comité Convivencia',
    recordatorio_presupuesto: 'Actualización Presupuesto',
    recordatorio_afiliacion: 'Afiliación SSSI',
    recordatorio_inducciones: 'Actualización Inducciones'
  };

  var TYPE_COLORS = {
    plan: '#174ea6',
    capacitacion: '#28a745',
    auditoria: '#ffc107',
    rapido: '#6c757d',
    vencido: '#dc3545',
    gestacion: '#ec4899',
    inspeccion_programada: '#174ea6',
    mantenimiento_programado: '#0d9488',
    recordatorio_copasst: '#ea580c',
    recordatorio_convivencia: '#0891b2',
    recordatorio_presupuesto: '#10b981',
    recordatorio_afiliacion: '#f59e0b',
    recordatorio_inducciones: '#6366f1'
  };

  // ── Estado privado ──────────────────────────────────────────────────
  var _state = {
    pending: [],          // array de eventos pendientes
    lastFetched: 0,       // timestamp del último fetch
    isFetching: false,    // evita fetches concurrentes
    isOpen: false,        // popover abierto
    popoverEl: null,      // elemento DOM del popover
    count: 0              // último conteo conocido
  };

  var _listeners = [];    // subscriptores de onCountChange

  // ── Utilidades internas ──────────────────────────────────────────────
  function _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Fecha de hoy normalizada a las 00:00 hora local. Sirve para comparar
  // con la fecha del evento (que viene como YYYY-MM-DD) sin importar la hora.
  function _todayMidnight() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Convierte "2026-07-12" o ISO a un Date a las 00:00 hora local.
  // Devuelve null si no se puede parsear.
  function _parseEventDate(s) {
    if (!s) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    if (!m) {
      var d = new Date(s);
      return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }

  // "hace 3 días" / "hoy" / "ayer" / "en 2 días"
  function _formatRelative(date, today) {
    if (!date) return '';
    var diffMs = today.getTime() - date.getTime();
    var diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Vence hoy';
    if (diffDays === 1) return 'Vencida · ayer';
    if (diffDays > 0) return 'Vencida · hace ' + diffDays + ' días';
    if (diffDays === -1) return 'Vence mañana';
    return 'En ' + Math.abs(diffDays) + ' días';
  }

  // "15 de julio de 2026" (formato corto para el meta del item)
  function _formatShort(iso) {
    var d = _parseEventDate(iso);
    if (!d) return _esc(iso || '');
    var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return d.getDate() + ' ' + meses[d.getMonth()] + ' ' + d.getFullYear();
  }

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

  function _log(level, msg) {
    if (typeof console !== 'undefined' && console[level]) {
      console[level]('[KairAlerts] ' + msg);
    }
  }

  // ── Lógica de fetch ─────────────────────────────────────────────────
  function _buildRange() {
    var today = _todayMidnight();
    var year = today.getFullYear();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    if (USE_CURRENT_YEAR_ONLY) {
      // 📦 Año en curso: del 1 de enero al 31 de diciembre del año actual.
      // Esto descarta eventos de años anteriores aunque sigan "vencidos" —
      // son ruido histórico que no aporta al día a día del usuario.
      return {
        start: year + '-01-01',
        end:   year + '-12-31'
      };
    }
    // Fallback (no usado actualmente): últimos 365 días
    var start = new Date(today);
    start.setDate(start.getDate() - 365);
    return {
      start: start.getFullYear() + '-' + pad(start.getMonth() + 1) + '-' + pad(start.getDate()),
      end:   year + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate())
    };
  }

  function _fetchPendingList() {
    if (_state.isFetching) return Promise.resolve(_state.pending);
    _state.isFetching = true;
    var api = (typeof global.electronAPI !== 'undefined') ? global.electronAPI : null;
    if (!api) {
      _log('warn', 'electronAPI no disponible — lista vacía');
      _state.isFetching = false;
      return Promise.resolve([]);
    }
    var adapter = global.KairCalendarAdapter;
    if (!adapter || typeof adapter.list !== 'function') {
      _log('warn', 'KairCalendarAdapter no disponible — lista vacía');
      _state.isFetching = false;
      return Promise.resolve([]);
    }
    var range = _buildRange();
    return adapter.list(range).then(function (res) {
      _state.isFetching = false;
      _state.lastFetched = Date.now();
      if (!res || !res.success || !Array.isArray(res.data)) {
        _log('warn', 'adapter.list devolvió respuesta inválida');
        return [];
      }
      var today = _todayMidnight();
      var currentYear = today.getFullYear();
      // Filtra: no cumplido, tiene id, fecha parseable, fecha <= hoy, y
      // (si USE_CURRENT_YEAR_ONLY) pertenece al año en curso.
      var filtered = [];
      for (var i = 0; i < res.data.length; i++) {
        var ev = res.data[i];
        if (!ev || !ev.id) continue;
        if (ev.cumplido === true) continue;
        var d = _parseEventDate(ev.date || ev.start);
        if (!d) continue;
        if (d.getTime() > today.getTime()) continue; // futuro, no es pendiente
        if (USE_CURRENT_YEAR_ONLY && d.getFullYear() !== currentYear) continue; // año anterior, no se muestra
        filtered.push(ev);
      }
      // Orden: vencidos primero (más viejo arriba), luego los de hoy en el
      // orden que los devolvió el adapter.
      filtered.sort(function (a, b) {
        var da = _parseEventDate(a.date || a.start);
        var db = _parseEventDate(b.date || b.start);
        return da.getTime() - db.getTime();
      });
      _state.pending = filtered;
      return filtered;
    }).catch(function (err) {
      _state.isFetching = false;
      _log('error', 'Error en fetchPendingList: ' + (err && err.message || err));
      return _state.pending;
    });
  }

  // ── Render del badge ────────────────────────────────────────────────
  function _renderBadge(count) {
    var badge = document.getElementById('bandeja-integrada-badge');
    if (!badge) return;
    if (count <= 0) {
      badge.hidden = true;
      badge.textContent = '0';
    } else if (count >= 100) {
      badge.hidden = false;
      badge.textContent = '99+';
      badge.setAttribute('aria-label', 'Más de 99 eventos pendientes');
    } else {
      badge.hidden = false;
      badge.textContent = String(count);
      badge.setAttribute('aria-label', count + ' evento' + (count === 1 ? '' : 's') + ' pendiente' + (count === 1 ? '' : 's'));
    }
  }

  // ── Pin / unpin del header con auto-hide ────────────────────────────
  // 📦703 (2026-08-11) — Comportamiento normal: cuando hay notificaciones,
  // el header se "anuncia" (pinned) por 30 segundos, luego se oculta aunque
  // sigan habiendo notificaciones. Si llegan NUEVAS notificaciones (count
  // sube vs. el último refresh), el timer se resetea y se vuelve a mostrar
  // por otros 30s. Si el refresh se llama con el mismo count, NO resetea
  // (así el header sí se oculta a los 30s aunque el polling siga activo).
  var HEADER_PIN_DURATION_MS = 30 * 1000; // 30 segundos
  var _headerPinTimer = null;
  var _lastPinnedCount = 0;
  function _pinHeader(count) {
    var hdr = document.getElementById('app-header');
    if (!hdr) return;
    if (count > 0) {
      if (count > _lastPinnedCount) {
        // Hay nuevas notificaciones (count subió). Resetear timer y mostrar.
        if (_headerPinTimer) {
          clearTimeout(_headerPinTimer);
          _headerPinTimer = null;
        }
        hdr.classList.add('app-header-pinned');
        _headerPinTimer = setTimeout(function () {
          hdr.classList.remove('app-header-pinned');
          _headerPinTimer = null;
        }, HEADER_PIN_DURATION_MS);
      }
      // Si count === _lastPinnedCount, NO hacemos nada: dejar que el timer
      // actual corra para que el header sí se oculte a los 30s aunque el
      // refresh periódico siga marcando count > 0.
      _lastPinnedCount = count;
    } else {
      // Sin notificaciones → quitar pinned inmediatamente y limpiar timer
      if (_headerPinTimer) {
        clearTimeout(_headerPinTimer);
        _headerPinTimer = null;
      }
      hdr.classList.remove('app-header-pinned');
      _lastPinnedCount = 0;
    }
  }

  // ── Notificar a subscriptores ───────────────────────────────────────
  function _emitCountChange(count) {
    _state.count = count;
    for (var i = 0; i < _listeners.length; i++) {
      try { _listeners[i](count); } catch (e) {
        _log('error', 'onCountChange listener threw: ' + e.message);
      }
    }
  }

  // ── Render del popover ──────────────────────────────────────────────
  function _buildItemEl(ev, today) {
    var type = ev.type || 'info';
    var label = TYPE_LABELS[type] || 'Evento';
    var color = TYPE_COLORS[type] || '#6c757d';
    var evDate = _parseEventDate(ev.date || ev.start);
    var rel = evDate ? _formatRelative(evDate, today) : '';
    var dateStr = _formatShort(ev.date || ev.start);
    var isRapido = type === 'rapido';

    // El botón principal cambia según el tipo:
    //   - rapido: "✓ Marcar cumplido" (acción directa, sin navegar)
    //   - otros: "Ir al módulo" (que abre el detail panel y desde ahí navega)
    // Para mantener simpleza y consistencia con el detail panel, dejamos
    // un solo botón "Ver detalle" que abre el calendarDetailPanel. Desde ahí
    // el usuario puede marcar cumplido o navegar, según aplique.
    var actionLabel = isRapido ? 'Marcar realizado' : 'Ver detalle';
    var actionIcon = isRapido
      ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
      : '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';

    var item = document.createElement('div');
    item.className = 'kair-alerts-item';
    item.setAttribute('data-event-id', _esc(ev.id));
    item.setAttribute('data-type', _esc(type));
    item.innerHTML =
      '<div class="kair-alerts-item__head">' +
        '<span class="kair-alerts-item__dot" style="background:' + _esc(color) + '"></span>' +
        '<span class="kair-alerts-item__type">' + _esc(label) + '</span>' +
        '<span class="kair-alerts-item__rel">' + _esc(rel) + '</span>' +
      '</div>' +
      '<div class="kair-alerts-item__title">' + _esc(ev.title || '(sin título)') + '</div>' +
      '<div class="kair-alerts-item__meta">' +
        '<span>' + _esc(dateStr) + '</span>' +
      '</div>' +
      '<div class="kair-alerts-item__actions">' +
        '<button type="button" class="kair-alerts-item__btn" data-kair-alerts-action="open">' +
          actionIcon + '<span>' + _esc(actionLabel) + '</span>' +
        '</button>' +
      '</div>';
    return item;
  }

  function _renderPopover() {
    if (_state.popoverEl && _state.popoverEl.parentNode) {
      _state.popoverEl.parentNode.removeChild(_state.popoverEl);
    }
    var today = _todayMidnight();
    var items = _state.pending;

    var listHtml;
    if (items.length === 0) {
      listHtml =
        '<div class="kair-alerts-empty">' +
          '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:#28a745;">' +
            '<path d="M20 6 9 17l-5-5"/>' +
          '</svg>' +
          '<p class="kair-alerts-empty__title">¡Todo al día!</p>' +
          '<p class="kair-alerts-empty__desc">No hay eventos pendientes.</p>' +
        '</div>';
    } else {
      listHtml = '<div class="kair-alerts-list" data-kair-alerts-list></div>';
    }

    // 📦 Panel lateral anclado al badge del calendario (NO modal). El arrow
    // CSS apunta hacia el badge para indicar visualmente el origen. Sin
    // backdrop: el resto de la app sigue siendo interactuable.
    var panel = document.createElement('div');
    panel.className = 'kair-alerts-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Eventos pendientes del calendario');
    panel.innerHTML =
      '<div class="kair-alerts-panel__arrow" data-kair-alerts-arrow></div>' +
      '<div class="kair-alerts-popover">' +
        '<div class="kair-alerts-popover__head">' +
          '<div class="kair-alerts-popover__title-wrap">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>' +
              '<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>' +
            '</svg>' +
            '<h3 class="kair-alerts-popover__title">Pendientes</h3>' +
            '<span class="kair-alerts-popover__count">' + items.length + '</span>' +
          '</div>' +
          '<button type="button" class="kair-alerts-popover__close" data-kair-alerts-action="close" aria-label="Cerrar">' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<line x1="18" y1="6" x2="6" y2="18"/>' +
              '<line x1="6" y1="6" x2="18" y2="18"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
        '<div class="kair-alerts-popover__body">' + listHtml + '</div>' +
        '<div class="kair-alerts-popover__foot">' +
          '<button type="button" class="kair-alerts-popover__calendar-link" data-kair-alerts-action="open-calendar">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<rect x="3" y="4" width="18" height="18" rx="2"/>' +
              '<line x1="16" y1="2" x2="16" y2="6"/>' +
              '<line x1="8" y1="2" x2="8" y2="6"/>' +
              '<line x1="3" y1="10" x2="21" y2="10"/>' +
            '</svg>' +
            '<span>Abrir calendario completo</span>' +
          '</button>' +
        '</div>' +
      '</div>';

    // Mientras el panel está abierto, fuerza el header pinned para que el
    // badge (origen del panel) siga visible. Cuando el panel cierra, el
    // próximo refresh() re-evalúa el pinned en base al conteo.
    _pinHeader(Math.max(items.length, 1));

    // Posicionar el panel debajo del badge con la flecha apuntando a él.
    // El badge es la "anchor" — el panel crece hacia abajo y a un costado.
    _positionPanel(panel);

    // Append al body. position:fixed lo mantiene anclado aunque el header
    // se oculte.
    document.body.appendChild(panel);
    _state.popoverEl = panel;
    _state.isOpen = true;

    // Si hay items, renderízalos
    if (items.length > 0) {
      var listEl = panel.querySelector('[data-kair-alerts-list]');
      var frag = document.createDocumentFragment();
      for (var i = 0; i < items.length; i++) {
        frag.appendChild(_buildItemEl(items[i], today));
      }
      listEl.appendChild(frag);
    }

    // Click handlers del panel
    panel.addEventListener('click', function (e) {
      var actEl = e.target.closest('[data-kair-alerts-action]');
      if (actEl) {
        var action = actEl.getAttribute('data-kair-alerts-action');
        if (action === 'close') {
          _closePopover();
        } else if (action === 'open-calendar') {
          _closePopover();
          var calBtn = document.getElementById('calendar-button');
          if (calBtn) calBtn.click();
        } else if (action === 'open') {
          var itemEl = actEl.closest('.kair-alerts-item');
          if (itemEl) {
            var evId = itemEl.getAttribute('data-event-id');
            _openEventDetail(evId);
          }
        }
      }
    });

    // Click fuera del panel (y fuera del badge) → cerrar
    setTimeout(function () {
      _state._onDocClickOutside = function (e) {
        if (!_state.isOpen || !_state.popoverEl) return;
        var target = e.target;
        // Si el click es dentro del panel, ignorar
        if (_state.popoverEl.contains(target)) return;
        // Si el click es en el badge, ignorar (el badge tiene su propio toggle)
        var badge = document.getElementById('bandeja-integrada-badge');
        if (badge && badge.contains(target)) return;
        // Si el click es en el detail panel del calendario, ignorar
        // (sino cierra apenas se abre el detail)
        if (target.closest && target.closest('.kair-cal-modal-overlay')) return;
        _closePopover();
      };
      document.addEventListener('click', _state._onDocClickOutside, true);

      // ESC para cerrar
      _state._onKeyDown = function (e) {
        if (e.key === 'Escape') {
          _closePopover();
        }
      };
      document.addEventListener('keydown', _state._onKeyDown);

      // Reposicionar al cambiar tamaño de ventana
      _state._onResize = function () {
        if (_state.isOpen && _state.popoverEl) {
          _positionPanel(_state.popoverEl);
        }
      };
      window.addEventListener('resize', _state._onResize);
    }, 50);

    // Forzar reflow + clase para animación
    void panel.offsetWidth;
    panel.classList.add('kair-alerts-panel--open');
  }

  // Posiciona el panel debajo del badge con la flecha apuntando al centro
  // del badge. Si no se puede (panel no entra en viewport), lo ajusta.
  function _positionPanel(panel) {
    var badge = document.getElementById('bandeja-integrada-badge');
    if (!badge) return;
    var rect = badge.getBoundingClientRect();
    var panelWidth = 420;
    var gap = 12; // gap entre badge y panel

    // Centro X del badge en coords del viewport
    var badgeCenterX = rect.left + rect.width / 2;

    // Default: el panel aparece debajo del badge, alineado a la derecha
    // (el badge está en el lado derecho del header, así que el panel debe
    // colgar hacia la izquierda para no salirse del viewport).
    var panelLeft = rect.right - panelWidth;
    // Pero si la flecha debe apuntar al centro del badge, ajustamos para
    // que la flecha quede a 40px del borde derecho del panel (alineado
    // aproximadamente con el badge).
    var arrowOffsetFromRight = rect.right - (panelLeft + panelWidth);
    // Si el badge está muy a la izquierda dentro del panel, el arrow queda
    // muy al borde. Lo recalculamos:
    panelLeft = rect.left - 40; // alineado: el borde izquierdo del panel está 40px a la izquierda del badge
    // Ahora verificamos que no se salga del viewport
    if (panelLeft + panelWidth > window.innerWidth - 12) {
      // Se sale por la derecha — ajustamos para que entre
      panelLeft = window.innerWidth - panelWidth - 12;
    }
    if (panelLeft < 12) {
      panelLeft = 12;
    }

    // Posición vertical: debajo del badge con un pequeño gap
    var panelTop = rect.bottom + gap;

    // Si no entra vertical (poco probable con max-height), ajustar
    var maxTop = window.innerHeight - 100;
    if (panelTop > maxTop) {
      // Intentar arriba del badge
      var aboveTop = rect.top - 200; // altura estimada del panel
      if (aboveTop > 12) {
        panelTop = aboveTop;
        panel.classList.add('kair-alerts-panel--above');
      } else {
        panelTop = Math.max(12, maxTop);
      }
    } else {
      panel.classList.remove('kair-alerts-panel--above');
    }

    panel.style.left = panelLeft + 'px';
    panel.style.top = panelTop + 'px';
    panel.style.width = panelWidth + 'px';

    // Posicionar la flecha (mide 14px de ancho). El centro de la flecha
    // debe coincidir con el centro X del badge.
    var arrow = panel.querySelector('[data-kair-alerts-arrow]');
    if (arrow) {
      var arrowLeft = badgeCenterX - panelLeft - 7; // 7 = mitad de la flecha
      // Clamp para que la flecha no se salga del panel
      if (arrowLeft < 6) arrowLeft = 6;
      if (arrowLeft > panelWidth - 20) arrowLeft = panelWidth - 20;
      arrow.style.left = arrowLeft + 'px';
    }
  }

  function _openEventDetail(eventId) {
    // Busca el evento en el cache local
    var ev = null;
    for (var i = 0; i < _state.pending.length; i++) {
      if (_state.pending[i].id === eventId) { ev = _state.pending[i]; break; }
    }
    if (!ev) {
      _showToast('No se encontró el evento', 'error');
      return;
    }
    // Cierra el popover y abre el detail panel que ya existe
    _closePopover();
    if (global.calendarDetailPanel && typeof global.calendarDetailPanel.open === 'function') {
      try {
        global.calendarDetailPanel.open(ev);
      } catch (e) {
        _log('error', 'Error abriendo detail panel: ' + e.message);
        _showToast('No se pudo abrir el detalle', 'error');
      }
    } else {
      _showToast('Panel de detalle no disponible', 'error');
    }
  }

  function _closePopover() {
    if (_state.popoverEl && _state.popoverEl.parentNode) {
      _state.popoverEl.classList.remove('kair-alerts-panel--open');
      var el = _state.popoverEl;
      // Limpia después de la animación (si hay)
      setTimeout(function () {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }, 180);
    }
    _state.popoverEl = null;
    _state.isOpen = false;
    // Limpia los listeners globales que se agregaron al abrir
    if (_state._onDocClickOutside) {
      document.removeEventListener('click', _state._onDocClickOutside, true);
      _state._onDocClickOutside = null;
    }
    if (_state._onKeyDown) {
      document.removeEventListener('keydown', _state._onKeyDown);
      _state._onKeyDown = null;
    }
    if (_state._onResize) {
      window.removeEventListener('resize', _state._onResize);
      _state._onResize = null;
    }
  }

  function _togglePopover() {
    if (_state.isOpen) {
      _closePopover();
      return;
    }
    // Si está vacío, abre igual (muestra el empty state) — el usuario
    // puede querer ver el botón "Abrir calendario" igual.
    _renderPopover();
  }

  // ── API pública ─────────────────────────────────────────────────────
  function init() {
    _log('info', 'init()');
    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _wire);
    } else {
      _wire();
    }
  }

  function _wire() {
    var badge = document.getElementById('bandeja-integrada-badge');
    if (!badge) {
      _log('warn', 'Badge no encontrado (#bandeja-integrada-badge) — verifica index.html');
      return;
    }
    // Click en el badge → toggle del popover. stopPropagation para que
    // no se propague al #bandeja-integrada-button (que abre el iframe de Bandeja Integrada).
    badge.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      _togglePopover();
    });

    // Primer fetch + render
    refresh();
  }

  function refresh() {
    return _fetchPendingList().then(function (list) {
      var count = list.length;
      _renderBadge(count);
      _pinHeader(count);
      _emitCountChange(count);
      // Si el popover está abierto y la lista cambió, re-render
      if (_state.isOpen) {
        _renderPopover();
      }
      return count;
    });
  }

  function getCount() { return _state.count; }

  function onCountChange(fn) {
    if (typeof fn === 'function') {
      _listeners.push(fn);
      // Emite el conteo actual al subscriptor nuevo
      try { fn(_state.count); } catch (e) { /* ignore */ }
    }
  }

  function isOpen() { return _state.isOpen; }

  function close() { _closePopover(); }

  function destroy() {
    _closePopover();
    _listeners = [];
    _state.pending = [];
    _state.count = 0;
    _renderBadge(0);
    _pinHeader(0);
    var badge = document.getElementById('bandeja-integrada-badge');
    if (badge) {
      // No podemos remover el listener sin referencia, pero el badge sigue
      // siendo funcional. Si necesitas destroy real, recargar la página.
    }
  }

  global.KairAlerts = {
    init: init,
    refresh: refresh,
    getCount: getCount,
    onCountChange: onCountChange,
    isOpen: isOpen,
    close: close,
    destroy: destroy,
    // F4-fix — API nuevo: devuelve la lista de eventos pendientes (vencidos o que vencen hoy).
    // Usado por el badge de la Bandeja Integrada para mostrar el popover al hacer click.
    // Devuelve copia del array para evitar mutaciones externas del state interno.
    getPendingEvents: function () {
      return Array.isArray(_state.pending) ? _state.pending.slice() : [];
    },
    version: '1.0.0'
  };
})(typeof window !== 'undefined' ? window : this);
