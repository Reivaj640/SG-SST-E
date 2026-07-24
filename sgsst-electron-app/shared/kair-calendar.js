/* K+AIR Calendar Component - extracted from kair-calendar-standalone.html */
/* Project: SG-SST (electron-app) | Path: shared/kair-calendar.js */
/* Do not modify unless you also update the standalone reference. */

/* ===== INICIO JS DEL COMPONENTE K+AIR CALENDAR ===== */
/* =====================================================================
 * K+AIR Calendar Component  v1.0.0
 * Vanilla JS — sin dependencias externas.
 * Diseñado para integrarse en apps Electron + Node.js de K+AIR.
 *
 * Contrato de integración:
 *   window.KairCalendar.create(options) -> instancia
 *
 * Contrato IPC sugerido (electronAPI):
 *   calendar:listEvents(payload)  -> { success, data, error }
 *   calendar:createEvent(payload)  -> { success, data, error }
 *   calendar:updateEvent(payload)  -> { success, data, error }
 *   calendar:deleteEvent(payload)  -> { success, data, error }
 *
 * TODA comunicación de datos debe ir por electronAPI.
 * El renderer NO persiste directamente.
 * ===================================================================== */
(function (global) {
  'use strict';

  // ---------- Utilidades internas ----------
  const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const DOW_ES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const DOW_ES_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const DOW_ES_MIN = ['D','L','M','X','J','V','S'];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function toISODate(d) { return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
  function parseISODate(s) {
    const [y,m,d] = s.split('-').map(Number);
    return new Date(y, m-1, d);
  }
  function sameDay(a,b) {
    return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  }
  function startOfWeek(d) {
    const r = new Date(d);
    const day = r.getDay(); // 0=Dom
    r.setDate(r.getDate() - day);
    r.setHours(0,0,0,0);
    return r;
  }
  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
  function isSameMonth(a,b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth(); }
  function clamp(v,min,max) { return Math.max(min, Math.min(max, v)); }
  function safeEl(v) { return (v == null) ? '' : String(v); }
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function formatTime(d) {
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return h + ':' + pad(m) + ' ' + ampm;
  }
  function formatTime24(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  // ---------- Estado del componente ----------
  const DEFAULTS = {
    triggerSelector: null,        // selector o elemento del icono que abre el calendario
    anchor: 'right',              // 'left' | 'right' | 'center' (solo modo popover)
    inline: false,                // true = calendario siempre visible (no popover)
    mountSelector: null,          // selector/elemento donde montar el calendario inline
    initialView: 'month',         // 'month' | 'week' | 'day'
    initialDate: new Date(),
    locale: 'es',
    showSidebar: true,
    eventTypes: [
      { id: 'primary',   label: 'Capacitación',          color: '#174ea6' },
      { id: 'success',   label: 'Inspección realizada',  color: '#28a745' },
      { id: 'warning',   label: 'Pendiente',             color: '#ffc107' },
      { id: 'danger',    label: 'Vencido / Crítico',     color: '#dc3545' },
      { id: 'info',      label: 'Informativo',           color: '#6c757d' }
    ],
    // Adaptador de datos. Por defecto: eventos locales.
    // En producción K+AIR debe reemplazarse por electronAPI.calendar:*
    adapter: null,
    onEventClick: null,
    onEventCreate: null,
    onNavigate: null
  };

  // ---------- Constructor ----------
  function KairCalendar(options) {
    if (!(this instanceof KairCalendar)) return new KairCalendar(options);
    this.opts = Object.assign({}, DEFAULTS, options || {});
    // 📦543 — Leer scope persistido de localStorage. Default 'company' para
    // mantener el comportamiento original. Si el usuario activo "Todas las
    // empresas" en una sesion anterior, lo respetamos al abrir.
    var _persistedScope = 'company';
    try {
      if (typeof localStorage !== 'undefined') {
        var v = localStorage.getItem('kair-cal.scope-all');
        if (v === '1' || v === 'true') _persistedScope = 'all';
      }
    } catch (e) { /* sin localStorage (modo privado?), ignorar */ }
    this.state = {
      view: this.opts.initialView,
      current: new Date(this.opts.initialDate),
      selectedDate: new Date(this.opts.initialDate),
      miniCurrent: new Date(this.opts.initialDate),
      events: [],
      loading: false,
      error: null,
      open: false,
      miniCurrentEvents: new Set(), // fechas ISO con eventos (para mini-cal)
      // 📦543 — Scope del calendario: 'company' = solo empresa actual,
      // 'all' = todas las empresas. Se persiste en localStorage.
      scope: _persistedScope
    };
    this._els = {};
    this._listeners = [];
    this._adapter = this.opts.adapter || createLocalAdapter();
    // 📦497 — Cache lookup de color por tipo desde eventTypes
    this._typeColorCache = {};
    (this.opts.eventTypes || []).forEach(function (t) {
      if (t && t.id && t.color) this._typeColorCache[t.id] = t.color;
    }, this);
    this._init();
  }

  // 📦497-fix — Devuelve el color configurado en eventTypes para un tipo dado,
  // o null si no está configurado. Usado para inyectar border-left-color inline
  // en chips/blocks (inline style gana sobre cualquier CSS conflictivo).
  KairCalendar.prototype._typeColor = function (type) {
    if (!type) return null;
    return this._typeColorCache[type] || null;
  };

  // Atributos de estilo para el chip de mes: solo border-left-color.
  KairCalendar.prototype._chipStyle = function (e) {
    const c = this._typeColor(e.type);
    return c ? ' style="border-left-color:' + c + '"' : '';
  };

  // CSS inline para bloques (vista semana/día). Devuelve la parte del atributo
  // style="" adicional (después de top/height). Devuelve '' si no hay color.
  KairCalendar.prototype._blockBorderCss = function (e) {
    const c = this._typeColor(e.type);
    return c ? 'border-left-color:' + c + ';' : '';
  };

  // ---------- Adaptador local (demo / fallback) ----------
  function createLocalAdapter() {
    let memory = [];
    // datos de ejemplo
    const today = new Date();
    memory = [
      { id: 'demo-1', title: 'Capacitación SST - Trabajo en alturas', date: toISODate(today), start: '09:00', end: '11:00', type: 'primary', description: 'Sesión presencial en sala de capacitación.' },
      { id: 'demo-2', title: 'Inspección de extintores', date: toISODate(addDays(today,1)), start: '14:00', end: '15:30', type: 'success', description: 'Edificio administrativo.' },
      { id: 'demo-3', title: 'Vencimiento exámenes médicos', date: toISODate(addDays(today,3)), start: '00:00', end: '23:59', type: 'danger', description: '5 colaboradores pendientes.' },
      { id: 'demo-4', title: 'Reunión comité SST', date: toISODate(addDays(today,-2)), start: '10:00', end: '11:00', type: 'info' }
    ];
    return {
      list: async function (range) {
        await new Promise(r => setTimeout(r, 80));
        return { success: true, data: memory.filter(e => {
          if (!range || !range.start || !range.end) return true;
          return e.date >= range.start && e.date <= range.end;
        }) };
      },
      create: async function (ev) {
        await new Promise(r => setTimeout(r, 60));
        const item = Object.assign({ id: 'ev-' + Date.now() }, ev);
        memory.push(item);
        return { success: true, data: item };
      },
      update: async function (ev) {
        await new Promise(r => setTimeout(r, 60));
        const i = memory.findIndex(m => m.id === ev.id);
        if (i >= 0) memory[i] = Object.assign({}, memory[i], ev);
        return { success: true, data: memory[i] };
      },
      remove: async function (id) {
        await new Promise(r => setTimeout(r, 60));
        memory = memory.filter(m => m.id !== id);
        return { success: true, data: { id: id } };
      }
    };
  }

  // ---------- Inicialización ----------
  KairCalendar.prototype._init = function () {
    if (this.opts.inline) {
      // Modo inline: el calendario se monta directamente en un contenedor,
      // siempre visible, sin popover ni trigger.
      this._buildInline();
    } else {
      // Modo popover: se despliega desde un trigger (icono).
      this._buildTrigger();
      this._buildPopover();
    }
    this._bindGlobal();
    // En modo inline, el calendario está "siempre abierto"
    if (this.opts.inline) {
      this.state.open = true;
      this._loadEvents().then(() => this._refresh());
      this._startNowLineTimer();
    } else {
      this._refresh();
    }
  };

  // ---------- Modo inline ----------
  KairCalendar.prototype._buildInline = function () {
    let mount;
    if (this.opts.mountSelector instanceof HTMLElement) {
      mount = this.opts.mountSelector;
    } else if (typeof this.opts.mountSelector === 'string') {
      mount = document.querySelector(this.opts.mountSelector);
    }
    if (!mount) {
      // Si no se provee contenedor, crear uno al final del body
      mount = document.createElement('div');
      mount.className = 'kair-cal-inline-mount';
      document.body.appendChild(mount);
    }
    // Construir el contenido del calendario (reutiliza _buildPopover)
    // pero sin las clases de popover/anchoring.
    this._buildPopover(true /* inline */);
    // Mover el popover al contenedor inline y reemplazar clases
    const pop = this._els.popover;
    pop.classList.remove('kair-cal-popover', 'kair-cal-popover--anchor-right',
                         'kair-cal-popover--anchor-left', 'kair-cal-popover--anchor-center');
    pop.classList.add('kair-cal-inline');
    pop.classList.add('kair-cal-popover--open'); // siempre abierto
    pop.style.position = 'relative';
    pop.style.top = 'auto';
    pop.style.left = 'auto';
    pop.style.right = 'auto';
    mount.appendChild(pop);
  };

  KairCalendar.prototype._buildTrigger = function () {
    let trigger;
    if (this.opts.triggerSelector instanceof HTMLElement) {
      trigger = this.opts.triggerSelector;
    } else if (typeof this.opts.triggerSelector === 'string') {
      trigger = document.querySelector(this.opts.triggerSelector);
    }
    // Inicializa arreglo de triggers (puede haber varios)
    this._triggers = this._triggers || [];
    if (!trigger) {
      // Si no se provee trigger, se asume que el host lo gestiona y abrirá con .open()
      this._els.trigger = null;
      return;
    }
    // Refuerza clases para asegurar la apariencia del trigger (no destruye clases existentes)
    trigger.classList.add('kair-cal-trigger');
    // Si el trigger NO contiene un SVG/img/icono propio, le inyecta el icono de calendario.
    // Si ya tiene uno (inyectado inline en HTML), respétalo.
    const hasIcon = trigger.querySelector('svg, img, i.material-icons, i.fa, span.kair-cal-trigger__icon');
    if (!hasIcon) {
      trigger.innerHTML = CALENDAR_ICON_SVG;
    }
    // Registrar este trigger
    if (this._triggers.indexOf(trigger) === -1) this._triggers.push(trigger);
    this._els.trigger = trigger;
    this._on(trigger, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    });
  };

  // API pública para registrar triggers adicionales (mismo componente, misma instancia)
  KairCalendar.prototype.addTrigger = function (selectorOrEl) {
    let el;
    if (selectorOrEl instanceof HTMLElement) el = selectorOrEl;
    else if (typeof selectorOrEl === 'string') el = document.querySelector(selectorOrEl);
    if (!el) return;
    this._triggers = this._triggers || [];
    if (this._triggers.indexOf(el) !== -1) return; // ya registrado
    el.classList.add('kair-cal-trigger');
    const hasIcon = el.querySelector('svg, img, i.material-icons, i.fa, span.kair-cal-trigger__icon');
    if (!hasIcon) el.innerHTML = CALENDAR_ICON_SVG;
    this._triggers.push(el);
    this._on(el, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    });
  };

  KairCalendar.prototype._buildPopover = function (inline) {
    const pop = document.createElement('div');
    pop.className = 'kair-cal-popover kair-cal-popover--anchor-' + this.opts.anchor;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'true');
    pop.setAttribute('aria-label', 'Calendario K+AIR');
    pop.innerHTML =
      // ===== Topbar estilo Bitrix24: logo + búsqueda + toggle + settings =====
      '<div class="kair-cal-topbar">' +
        '<div class="kair-cal-topbar__left">' +
          '<span class="kair-cal-topbar__logo">' + CALENDAR_ICON_SVG_WHITE + '</span>' +
          '<span class="kair-cal-topbar__title">Calendario</span>' +
        '</div>' +
        '<div class="kair-cal-topbar__center">' +
          '<div class="kair-cal-search">' +
            SEARCH_SVG +
            '<input type="text" class="kair-cal-search__input" placeholder="Filtrar y buscar" />' +
          '</div>' +
        '</div>' +
        '<div class="kair-cal-topbar__right">' +
          // 📦543 — Toggle "Todas las empresas": cuando esta ON, el adapter pasa
          // scope:'all' a las fuentes por empresa, que devuelven eventos de
          // TODAS las empresas (no solo la actual). Default OFF.
          '<label class="kair-cal-toggle" title="Mostrar eventos de todas las empresas (no solo la actual)">' +
            '<input type="checkbox" class="kair-cal-toggle__input" data-kair-cal-action="toggle-scope-all" ' + (this.state.scope === 'all' ? 'checked' : '') + ' />' +
            '<span class="kair-cal-toggle__track"></span>' +
            '<span class="kair-cal-toggle__label">Todas las empresas</span>' +
          '</label>' +
          '<button type="button" class="kair-cal-topbar__btn" aria-label="Calendarios">' + GRID_SVG + '<span>Calendarios</span>' + CHEVRON_DOWN_SVG + '</button>' +
          '<button type="button" class="kair-cal-topbar__icon-btn" aria-label="Configuración">' + GEAR_SVG + '</button>' +
        '</div>' +
      '</div>' +
      // ===== Toolbar: botón Crear (verde) + navegación + tabs =====
      '<div class="kair-cal-toolbar">' +
        '<div class="kair-cal-toolbar__left">' +
          '<button type="button" class="kair-cal-btn-create" data-kair-cal-action="new">' + PLUS_SVG + '<span>Crear</span></button>' +
        '</div>' +
        '<div class="kair-cal-toolbar__center">' +
          '<div class="kair-cal-nav">' +
            '<button type="button" class="kair-cal-nav__btn" data-kair-cal-action="prev" aria-label="Anterior">' + CHEVRON_LEFT_SVG + '</button>' +
            '<button type="button" class="kair-cal-btn kair-cal-btn--secondary" data-kair-cal-action="today">' + CHEVRON_LEFT_SVG + '<span>Hoy</span></button>' +
            '<span class="kair-cal-nav__label" data-kair-cal-label="nav"></span>' +
            '<button type="button" class="kair-cal-nav__btn" data-kair-cal-action="next" aria-label="Siguiente">' + CHEVRON_RIGHT_SVG + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="kair-cal-toolbar__right">' +
          '<div class="kair-cal-tabs" role="tablist">' +
            '<button type="button" class="kair-cal-tab" data-kair-cal-view="day" role="tab">Día</button>' +
            '<button type="button" class="kair-cal-tab" data-kair-cal-view="week" role="tab">Semana</button>' +
            '<button type="button" class="kair-cal-tab" data-kair-cal-view="month" role="tab">Mes</button>' +
            '<button type="button" class="kair-cal-tab" data-kair-cal-action="programar" role="tab">Programar <span class="kair-cal-tab__badge">0</span></button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="kair-cal-body' + (this.opts.showSidebar ? '' : ' kair-cal-body--no-sidebar') + '">' +
        (this.opts.showSidebar ?
          '<aside class="kair-cal-sidebar">' +
            '<div class="kair-cal-mini">' +
              '<div class="kair-cal-mini__head">' +
                '<span class="kair-cal-mini__title" data-kair-cal-label="mini-title"></span>' +
                '<div class="kair-cal-mini__nav">' +
                  '<button type="button" class="kair-cal-mini__nav-btn" data-kair-cal-action="mini-prev" aria-label="Mes anterior">' + CHEVRON_LEFT_SVG + '</button>' +
                  '<button type="button" class="kair-cal-mini__nav-btn" data-kair-cal-action="mini-next" aria-label="Mes siguiente">' + CHEVRON_RIGHT_SVG + '</button>' +
                '</div>' +
              '</div>' +
              '<div class="kair-cal-mini__grid" data-kair-cal-mini="grid"></div>' +
            '</div>' +
            '<div class="kair-cal-legend">' +
              '<p class="kair-cal-legend__title">Tipos de evento</p>' +
              this.opts.eventTypes.map(t =>
                '<div class="kair-cal-legend__item" data-kair-cal-type="' + escapeHTML(t.id) + '">' +
                  '<span class="kair-cal-legend__dot" style="background:' + escapeHTML(t.color) + '"></span>' +
                  '<span>' + escapeHTML(t.label) + '</span>' +
                '</div>'
              ).join('') +
            '</div>' +
          '</aside>' : '') +
        '<section class="kair-cal-main" data-kair-cal-main style="min-width:0;min-height:0;display:flex;flex-direction:column;"></section>' +
      '</div>' +
      '<div class="kair-cal-footer">' +
        '<span class="kair-cal-footer__hint">' + INFO_SVG + ' Click en día/hora para crear evento · Click en evento para ver detalle</span>' +
        '<span data-kair-cal-label="footer-count"></span>' +
      '</div>';

    // Anclar al trigger o al body (en modo inline, _buildInline se encarga del montaje)
    // ═══════════════════════════════════════════════════════════════════════════
    // [Fix 2026-07-01] Calendar como MODAL central (z-index 1100):
    // En lugar de anclar el pop al wrapper del trigger (donde #app-header lo
    // recorta via overflow:hidden), envolver el pop en un .kair-cal-modal-overlay
    // que vive en document.body. Asi queda por encima de TODO y es independiente
    // del header. Reusa el mismo patron CSS que el modal de "Nuevo evento".
    // ═══════════════════════════════════════════════════════════════════════════
    if (!inline) {
      // Estilos para que el pop se vea como modal grande.
      // [Fix 2026-07-01 v2] NO forzar opacity/pointer-events inline — debe
      // heredar del overlay via las clases --open para que cuando el calendario
      // esta cerrado los clicks pasen a traves (no quede bloqueando el header).
      pop.classList.remove('kair-cal-popover--anchor-right', 'kair-cal-popover--anchor-left', 'kair-cal-popover--anchor-center');
      pop.style.position = 'relative';
      pop.style.top = 'auto';
      pop.style.right = 'auto';
      pop.style.left = 'auto';
      pop.style.transform = 'none';
      pop.style.width = '960px';
      pop.style.maxWidth = 'calc(100vw - 64px)';
      pop.style.maxHeight = 'calc(100vh - 32px)';
      // [Fix 2026-07-01 v4] Modal ocupa casi todo el alto del viewport para
      // que la grilla del mes (5-6 filas) entre sin cortarse en pantallas <800px.
      pop.style.height = 'calc(100vh - 32px)';

      const overlay = document.createElement('div');
      overlay.className = 'kair-cal-modal-overlay kair-cal-overlay--main';
      overlay.appendChild(pop);
      document.body.appendChild(overlay);
      this._els.overlay = overlay;

      // Click en el backdrop (overlay, no descendiente del pop) cierra el
      // calendario principal. Guard 200ms anti doble-disparo: si el click
      // viene del trigger bubbled up inmediatamente despues de open(), no cerrar.
      this._on(overlay, 'click', function (e) {
        if (e.target !== overlay) return; // click dentro del pop: ignorar
        // [Fix 2026-07-01 v3] Si el modal de "Nuevo evento" esta abierto,
        // no cerrar el calendario principal. El modal chiquito ya tiene
        // su propia logica de cierre al click en su backdrop.
        if (this._els.eventModalOverlay) return;
        const since = Date.now() - (this._lastOpenedAt || 0);
        if (since < 200) return; // vino del trigger, no cerrar
        this.close();
      }.bind(this));
    }

    this._els.popover = pop;
    this._els.main = pop.querySelector('[data-kair-cal-main]');

    // [Fix 2026-07-01 v4] En modo modal, sobrescribir las constraints CSS del
    // body (min-height: 480px + max-height: 70vh) que cortan la grilla del mes
    // en pantallas <800px. Hacerlo scrolleable y flexible.
    if (!inline) {
      const body = pop.querySelector('.kair-cal-body');
      if (body) {
        body.style.minHeight = '0';    // quita min-height: 480px del CSS
        body.style.maxHeight = 'none'; // quita max-height: 70vh del CSS
        body.style.overflowY = 'auto'; // scroll si el contenido no entra
        body.style.flex = '1';         // ocupar el espacio restante del pop
        body.style.minWidth = '0';     // evitar overflow horizontal por sidebar
        this._els.body = body;
      }
    }
    this._els.miniGrid = pop.querySelector('[data-kair-cal-mini="grid"]');
    this._els.labelNav = pop.querySelector('[data-kair-cal-label="nav"]');
    this._els.labelMiniTitle = pop.querySelector('[data-kair-cal-label="mini-title"]');
    this._els.labelFooterCount = pop.querySelector('[data-kair-cal-label="footer-count"]');

    // Bindings internos
    this._on(pop, 'click', (e) => {
      const actEl = e.target.closest('[data-kair-cal-action]');
      if (actEl) {
        const action = actEl.getAttribute('data-kair-cal-action');
        this._handleAction(action);
        return;
      }
      const viewEl = e.target.closest('[data-kair-cal-view]');
      if (viewEl) {
        this.setView(viewEl.getAttribute('data-kair-cal-view'));
        return;
      }
      const evEl = e.target.closest('[data-kair-cal-event-id]');
      if (evEl) {
        const id = evEl.getAttribute('data-kair-cal-event-id');
        const ev = this.state.events.find(x => x.id === id);
        if (ev && typeof this.opts.onEventClick === 'function') {
          this.opts.onEventClick(ev);
        } else if (ev) {
          this._openEventModal(ev);
        }
        return;
      }
      const cellEl = e.target.closest('[data-kair-cal-cell-date]');
      if (cellEl) {
        const slotStr = cellEl.getAttribute('data-kair-cal-cell-date');
        // 📦544 — Click en celda del mes: cancelar hover, abrir popover
        // EXPANDIDO cerca del día (con todos los eventos + botón crear).
        // Si tiene hora (week view) mantiene el modal de crear.
        if (slotStr.indexOf('T') >= 0) {
          this._handleCellClick(slotStr);
        } else {
          const d = parseISODate(slotStr);
          this.state.selectedDate = d;
          this.state.current = new Date(d);
          this._closeDayPopover();
          var dayEvents = (this.state.events || []).filter(function (e) { return e.date === slotStr; });
          this._showDayPopover(slotStr, cellEl, dayEvents, /* expanded */ true);
        }
        return;
      }
      const slotEl = e.target.closest('[data-kair-cal-slot]');
      if (slotEl) {
        const dateStr = slotEl.getAttribute('data-kair-cal-slot');
        this._handleCellClick(dateStr);
        return;
      }
      const miniDayEl = e.target.closest('[data-kair-cal-mini-day]');
      if (miniDayEl) {
        const dateStr = miniDayEl.getAttribute('data-kair-cal-mini-day');
        const d = parseISODate(dateStr);
        this.state.selectedDate = d;
        this.state.current = new Date(d);
        this.setView('day');
        return;
      }
    });

    // Cerrar al click fuera (solo si está abierto y NO estamos en modo inline)
    if (!inline) {
      this._on(document, 'click', (e) => {
        if (!this.state.open) return;
        // Guard anti-doble-disparo: si el popover se acaba de abrir
        // (en este mismo click, p.ej. desde un botón externo que llama a
        // setView()/goToDate()), NO cerrarlo. Da una ventana de 300ms.
        if (this._lastOpenedAt && (Date.now() - this._lastOpenedAt < 300)) return;
        if (pop.contains(e.target)) return;
        // 📦501/📦499 — Excluir cualquier modal-overlay del calendario. Esto
        // cubre AMBOS: el modal de "Nuevo evento" y el detail panel
        // (que también es modal-overlay). Sin esta exclusion, cualquier
        // click dentro de cualquiera de los 2 modales cerraba el calendario.
        // 📦499 FIX BUG: antes usaba document.querySelector('.kair-cal-modal-overlay')
        // que solo retorna el PRIMER overlay del DOM. Si el detail panel y el
        // modal de edición están abiertos al mismo tiempo (click en "Editar"),
        // querySelector devolvía el detail panel; el X del modal de edición
        // NO está adentro del detail panel → modalOverlay.contains(target) era
        // false → caía al this.close() → cerraba el calendario entero.
        // Fix: usar closest() que sube desde el target y devuelve el overlay
        // más cercano (o null si no hay). Si retorna algo, el target está
        // dentro de ALGÚN modal-overlay → no cerrar el calendario.
        if (e.target.closest && e.target.closest('.kair-cal-modal-overlay')) return;
        // Verificar si el click fue en CUALQUIER trigger registrado
        if (this._triggers && this._triggers.length) {
          for (let i = 0; i < this._triggers.length; i++) {
            if (this._triggers[i].contains(e.target)) return;
          }
        } else if (this._els.trigger && this._els.trigger.contains(e.target)) {
          return;
        }
        this.close();
      });
      // ESC para cerrar
      this._on(document, 'keydown', (e) => {
        if (e.key === 'Escape' && this.state.open) this.close();
      });
    }
  };

  // ---------- Acciones ----------
  KairCalendar.prototype._handleAction = function (action) {
    switch (action) {
      case 'prev':    this._navigate(-1); break;
      case 'next':    this._navigate(1); break;
      case 'today':   this.state.current = new Date(); this.state.selectedDate = new Date(); this.state.miniCurrent = new Date(); this._refresh(); break;
      case 'new':     this._openEventModal(null); break;
      case 'programar':
        // 📦594 — Programar: abre el modal de crear evento con la fecha de hoy
        // preseteada. Mismo flujo que "+ Crear" pero sin scrollear el calendario
        // para elegir día primero. _openEventModal ya cierra cualquier modal previo
        // y usa el timeStr default ('09:00') si no se le pasa.
        this._openEventModal(null, toISODate(new Date()), null);
        break;
      case 'mini-prev': this.state.miniCurrent = new Date(this.state.miniCurrent.getFullYear(), this.state.miniCurrent.getMonth()-1, 1); this._renderMini(); break;
      case 'mini-next': this.state.miniCurrent = new Date(this.state.miniCurrent.getFullYear(), this.state.miniCurrent.getMonth()+1, 1); this._renderMini(); break;
      case 'modal-save':   this._saveEventFromModal(); break;
      case 'modal-delete': this._deleteEventFromModal(); break;
      case 'modal-cancel': this._closeEventModal(); break;
      // 📦544 — Day popover (cerrar / crear)
      case 'day-popover-close': this._closeDayPopover(); break;
      case 'day-popover-create':
        var dateStrCreate = actEl.getAttribute('data-date');
        this._closeDayPopover();
        this._openEventModal(null, dateStrCreate, null);
        break;
      case 'toggle-scope-all':
        // 📦543 — Alternar scope 'company' / 'all'. Persistir en localStorage
        // y recargar eventos. El toggle en el DOM lo maneja el handler de
        // 'change' (más abajo) — aca solo actualizamos el state cuando se
        // dispara via el data-attribute.
        this.state.scope = (this.state.scope === 'all') ? 'company' : 'all';
        try { localStorage.setItem('kair-cal.scope-all', this.state.scope === 'all' ? '1' : '0'); } catch (e) {}
        this._loadEvents().then(() => this._refresh());
        break;
    }
  };

  KairCalendar.prototype._navigate = function (dir) {
    const c = this.state.current;
    if (this.state.view === 'month') {
      this.state.current = new Date(c.getFullYear(), c.getMonth()+dir, 1);
    } else if (this.state.view === 'week') {
      this.state.current = addDays(c, dir*7);
    } else if (this.state.view === 'day') {
      this.state.current = addDays(c, dir);
    }
    this.state.miniCurrent = new Date(this.state.current);
    this._refresh();
    if (typeof this.opts.onNavigate === 'function') {
      this.opts.onNavigate({ view: this.state.view, current: new Date(this.state.current) });
    }
  };

  KairCalendar.prototype.setView = function (view) {
    if (['day','week','month'].indexOf(view) === -1) return;
    this.state.view = view;
    // Si el popover está cerrado, abrirlo automáticamente.
    // Cambiar de vista implica que el usuario quiere VER el calendario.
    if (!this.state.open) {
      this.open();
    } else {
      this._refresh();
    }
  };

  // ---------- Render principal ----------
  KairCalendar.prototype._refresh = function () {
    // Refresca tabs activos
    const tabs = this._els.popover.querySelectorAll('[data-kair-cal-view]');
    tabs.forEach(t => {
      const v = t.getAttribute('data-kair-cal-view');
      t.classList.toggle('kair-cal-tab--active', v === this.state.view);
    });
    // Label navegación
    this._updateNavLabel();
    // Render de la vista principal
    this._renderMain();
    // Render del mini-calendario
    if (this.opts.showSidebar) this._renderMini();
  };

  KairCalendar.prototype._updateNavLabel = function () {
    const c = this.state.current;
    let label = '';
    if (this.state.view === 'month') {
      label = MONTHS_ES[c.getMonth()].charAt(0).toUpperCase() + MONTHS_ES[c.getMonth()].slice(1) + ' ' + c.getFullYear();
    } else if (this.state.view === 'week') {
      const ws = startOfWeek(c);
      const we = addDays(ws, 6);
      const sameMonth = isSameMonth(ws, we);
      if (sameMonth) {
        label = MONTHS_ES[ws.getMonth()].charAt(0).toUpperCase() + MONTHS_ES[ws.getMonth()].slice(1) + ' ' + ws.getFullYear();
      } else {
        label = MONTHS_ES[ws.getMonth()].charAt(0).toUpperCase() + MONTHS_ES[ws.getMonth()].slice(1) + ' · ' + MONTHS_ES[we.getMonth()].charAt(0).toUpperCase() + MONTHS_ES[we.getMonth()].slice(1) + ' ' + we.getFullYear();
      }
    } else {
      label = c.getDate() + ' de ' + MONTHS_ES[c.getMonth()] + ' ' + c.getFullYear();
    }
    if (this._els.labelNav) this._els.labelNav.textContent = label;
  };

  // ---------- Render: vista MES ----------
  KairCalendar.prototype._renderMain = function () {
    if (this.state.loading) {
      this._els.main.innerHTML = stateLoadingHTML();
      return;
    }
    if (this.state.error) {
      this._els.main.innerHTML = stateErrorHTML(this.state.error);
      return;
    }
    if (this.state.view === 'month') this._renderMonth();
    else if (this.state.view === 'week') this._renderWeek();
    else if (this.state.view === 'day') this._renderDay();
    // 📦544 — Wire hover 3s en celdas con eventos (después de re-renderizar
    // el HTML, los listeners viejos se borran solos con el innerHTML).
    this._wireCellHover();
    // Conteo footer
    if (this._els.labelFooterCount) {
      this._els.labelFooterCount.textContent = this.state.events.length + ' evento(s) en el rango visible';
    }
  };

  KairCalendar.prototype._renderMonth = function () {
    const c = this.state.current;
    const first = new Date(c.getFullYear(), c.getMonth(), 1);
    const startDow = first.getDay(); // 0=Dom
    const gridStart = addDays(first, -startDow);
    const today = new Date();

    let html = '<div class="kair-cal-view-month" style="flex:1;min-height:0;display:flex;flex-direction:column;">';
    // Header días de la semana
    html += '<div class="kair-cal-month__dow-row">';
    for (let i = 0; i < 7; i++) {
      html += '<div class="kair-cal-month__dow">' + DOW_ES_SHORT[(i) % 7] + '</div>';
    }
    html += '</div>';
    // Grid 6 semanas
    html += '<div class="kair-cal-month__grid">';
    for (let i = 0; i < 42; i++) {
      const d = addDays(gridStart, i);
      const iso = toISODate(d);
      const isOther = !isSameMonth(d, c);
      const isToday = sameDay(d, today);
      const isSelected = sameDay(d, this.state.selectedDate);
      const dayEvents = this.state.events.filter(e => e.date === iso);
      const classes = ['kair-cal-month__cell'];
      if (isOther) classes.push('kair-cal-month__cell--other-month');
      if (isToday) classes.push('kair-cal-month__cell--today');
      if (isSelected && !isToday) classes.push('kair-cal-month__cell--selected');

      html += '<div class="' + classes.join(' ') + '" data-kair-cal-cell-date="' + iso + '">';
      html += '<span class="kair-cal-month__date">' + d.getDate() + '</span>';
      html += '<div class="kair-cal-month__events">';
      const maxShow = 3;
      dayEvents.slice(0, maxShow).forEach(e => {
        // 📦498 — Class extra --cumplido si event.cumplido es true. La clase
        // se concatena ANTES del cierre del class= para que coexista con
        // --gestacion, --capacitacion, etc.
        var cumplidoClass = e.cumplido ? ' kair-cal-event-chip--cumplido' : '';
        html += '<div class="kair-cal-event-chip kair-cal-event-chip--' + escapeHTML(e.type || 'primary') + cumplidoClass + '" data-kair-cal-event-id="' + escapeHTML(e.id) + '" title="' + escapeHTML(e.title) + '"' + this._chipStyle(e) + '>';
        if (e.start && e.start !== '00:00') {
          html += '<span class="kair-cal-event-chip__time">' + escapeHTML(e.start) + '</span>';
        }
        // 📦498 — Si cumplido, prefijo ✓ antes del título. 📦503 — Si es
        // evento rápido (tipo=rapido), prefijo ⚡ para distinguirlo del
        // gris plano del chip neutral. El ⚡ se ve siempre, independiente
        // del tema/contraste.
        var titlePrefix = e.cumplido ? '✓ ' : (e.type === 'rapido' ? '⚡ ' : '');
        html += '<span class="kair-cal-event-chip__title">' + titlePrefix + escapeHTML(e.title) + '</span>';
        html += '</div>';
      });
      if (dayEvents.length > maxShow) {
        html += '<span class="kair-cal-month__more" data-kair-cal-cell-date="' + iso + '">+' + (dayEvents.length - maxShow) + ' más</span>';
      }
      html += '</div>'; // events
      html += '</div>'; // cell
    }
    html += '</div>'; // grid
    html += '</div>'; // view-month

    if (this.state.events.length === 0) {
      // Estado vacío solo si NO hay eventos en absoluto en el rango
      html = stateEmptyHTML('No hay eventos', 'Click en cualquier día para crear uno nuevo o usa “Nuevo evento”.') + html;
    }
    this._els.main.innerHTML = html;
    // 📦497 — Aplicar border-left-color vía DOM directo (bypassa cualquier
    // specificity de CSS). Usamos el cache construido del eventTypes config.
    this._els.main.querySelectorAll('.kair-cal-event-chip').forEach(function (el) {
      var id = el.getAttribute('data-kair-cal-event-id');
      var ev = (this.state.events || []).find(function (e) { return e.id === id; });
      if (ev) {
        var c = this._typeColor(ev.type);
        if (c) el.style.borderLeftColor = c;
      }
    }, this);
  };

  // ---------- Render: vista SEMANA ----------
  KairCalendar.prototype._renderWeek = function () {
    const c = this.state.current;
    const ws = startOfWeek(c);
    const today = new Date();
    const hours = 24;

    let html = '<div class="kair-cal-view-week" style="flex:1;min-height:0;">';
    // Header
    html += '<div class="kair-cal-week__head">';
    html += '<div class="kair-cal-week__head-corner"></div>';
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      const isToday = sameDay(d, today);
      html += '<div class="kair-cal-week__head-day' + (isToday ? ' kair-cal-week__head-day--today' : '') + '" data-kair-cal-cell-date="' + toISODate(d) + '">';
      html += '<div class="kair-cal-week__head-dow">' + DOW_ES_SHORT[i] + '</div>';
      html += '<div class="kair-cal-week__head-num">' + d.getDate() + '</div>';
      html += '</div>';
    }
    html += '</div>';

    // Body grid
    html += '<div class="kair-cal-week__body" data-kair-cal-week-body>';
    // Columna de horas
    html += '<div class="kair-cal-week__time-col">';
    for (let h = 0; h < hours; h++) {
      const d = new Date();
      d.setHours(h, 0, 0, 0);
      html += '<div class="kair-cal-week__time-slot">' + formatTime(d) + '</div>';
    }
    html += '</div>';
    // Columnas de días
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      const iso = toISODate(d);
      const isToday = sameDay(d, today);
      html += '<div class="kair-cal-week__day-col' + (isToday ? ' kair-cal-week__day-col--today' : '') + '">';
      for (let h = 0; h < hours; h++) {
        const slotIso = iso + 'T' + pad(h) + ':00';
        html += '<div class="kair-cal-week__hour-slot" data-kair-cal-slot="' + slotIso + '"></div>';
      }
      // Eventos absolutos
      const dayEvents = this.state.events.filter(e => e.date === iso && e.start && e.start !== '00:00');
      dayEvents.forEach(e => {
        const [sh, sm] = e.start.split(':').map(Number);
        const [eh, em] = (e.end || e.start).split(':').map(Number);
        const top = (sh + sm/60) * 48;
        const height = Math.max(20, ((eh + em/60) - (sh + sm/60)) * 48);
        // 📦498 — Class extra --cumplido si event.cumplido
        var cumplidoClass = e.cumplido ? ' kair-cal-event-block--cumplido' : '';
        html += '<div class="kair-cal-event-block kair-cal-event-block--' + escapeHTML(e.type || 'primary') + cumplidoClass + '" '
              + 'data-kair-cal-event-id="' + escapeHTML(e.id) + '" '
              + 'style="top:' + top + 'px;height:' + height + 'px;' + this._blockBorderCss(e) + '">'
              + '<div class="kair-cal-event-block__title">' + (e.cumplido ? '✓ ' : (e.type === 'rapido' ? '⚡ ' : '')) + escapeHTML(e.title) + '</div>'
              + '<div class="kair-cal-event-block__time">' + escapeHTML(e.start) + (e.end ? ' – ' + escapeHTML(e.end) : '') + '</div>'
              + '</div>';
      });
      html += '</div>'; // day-col
    }
    html += '</div>'; // body
    html += '</div>'; // view-week

    this._els.main.innerHTML = html;
    // 📦497-debug — Aplicar color vía DOM directo (week view)
    this._els.main.querySelectorAll('.kair-cal-event-block').forEach(function (el) {
      var id = el.getAttribute('data-kair-cal-event-id');
      var ev = (this.state.events || []).find(function (e) { return e.id === id; });
      if (ev) {
        var c = this._typeColor(ev.type);
        if (c) el.style.borderLeftColor = c;
      }
    }, this);
    this._positionNowLine();
  };

  // ---------- Render: vista DÍA ----------
  KairCalendar.prototype._renderDay = function () {
    const c = this.state.current;
    const iso = toISODate(c);
    const today = new Date();
    const isToday = sameDay(c, today);

    let html = '<div class="kair-cal-view-day" style="flex:1;min-height:0;">';
    // Columna de horas
    html += '<div class="kair-cal-day__time-col">';
    for (let h = 0; h < 24; h++) {
      const d = new Date();
      d.setHours(h, 0, 0, 0);
      html += '<div class="kair-cal-day__time-slot">' + formatTime(d) + '</div>';
    }
    html += '</div>';
    // Columna del día
    html += '<div class="kair-cal-day__slot-col" data-kair-cal-day-col>';
    for (let h = 0; h < 24; h++) {
      const slotIso = iso + 'T' + pad(h) + ':00';
      html += '<div class="kair-cal-day__hour-slot" data-kair-cal-slot="' + slotIso + '"></div>';
    }
    // Eventos
    const dayEvents = this.state.events.filter(e => e.date === iso);
    dayEvents.forEach(e => {
      if (!e.start || e.start === '00:00') {
        // Evento de todo el día: banner arriba
        var allDayCumplidoClass = e.cumplido ? ' kair-cal-event-block--cumplido' : '';
        html += '<div class="kair-cal-event-block kair-cal-event-block--' + escapeHTML(e.type || 'primary') + allDayCumplidoClass + '" '
              + 'data-kair-cal-event-id="' + escapeHTML(e.id) + '" '
              + 'style="top:4px;height:32px;left:8px;right:8px;' + this._blockBorderCss(e) + '">'
              + '<div class="kair-cal-event-block__title">' + (e.cumplido ? '✓ ' : (e.type === 'rapido' ? '⚡ ' : '')) + escapeHTML(e.title) + ' (Todo el día)</div>'
              + '</div>';
        return;
      }
      const [sh, sm] = e.start.split(':').map(Number);
      const [eh, em] = (e.end || e.start).split(':').map(Number);
      const top = (sh + sm/60) * 56;
      const height = Math.max(28, ((eh + em/60) - (sh + sm/60)) * 56);
      var dayCumplidoClass = e.cumplido ? ' kair-cal-event-block--cumplido' : '';
      html += '<div class="kair-cal-event-block kair-cal-event-block--' + escapeHTML(e.type || 'primary') + dayCumplidoClass + '" '
            + 'data-kair-cal-event-id="' + escapeHTML(e.id) + '" '
            + 'style="top:' + top + 'px;height:' + height + 'px;' + this._blockBorderCss(e) + '">'
            + '<div class="kair-cal-event-block__title">' + (e.cumplido ? '✓ ' : (e.type === 'rapido' ? '⚡ ' : '')) + escapeHTML(e.title) + '</div>'
            + '<div class="kair-cal-event-block__time">' + escapeHTML(e.start) + (e.end ? ' – ' + escapeHTML(e.end) : '') + '</div>'
            + '</div>';
    });
    html += '</div>'; // slot-col
    html += '</div>'; // view-day

    this._els.main.innerHTML = html;
    // 📦497-fix-v2 — Aplicar border-left-color vía DOM directo
    this._els.main.querySelectorAll('.kair-cal-event-block').forEach(function (el) {
      var id = el.getAttribute('data-kair-cal-event-id');
      var ev = (this.state.events || []).find(function (e) { return e.id === id; });
      if (ev) {
        var c = this._typeColor(ev.type);
        if (c) el.style.borderLeftColor = c;
      }
    }, this);
    this._positionNowLine();
  };

  // ---------- Mini calendario ----------
  KairCalendar.prototype._renderMini = function () {
    if (!this._els.miniGrid) return;
    const c = this.state.miniCurrent;
    if (this._els.labelMiniTitle) {
      this._els.labelMiniTitle.textContent = MONTHS_ES[c.getMonth()].charAt(0).toUpperCase() + MONTHS_ES[c.getMonth()].slice(1) + ' ' + c.getFullYear();
    }
    const first = new Date(c.getFullYear(), c.getMonth(), 1);
    const startDow = first.getDay();
    const gridStart = addDays(first, -startDow);
    const today = new Date();

    let html = '';
    // Días de la semana
    for (let i = 0; i < 7; i++) {
      html += '<div class="kair-cal-mini__dow">' + DOW_ES_MIN[i] + '</div>';
    }
    for (let i = 0; i < 42; i++) {
      const d = addDays(gridStart, i);
      const iso = toISODate(d);
      const classes = ['kair-cal-mini__day'];
      if (!isSameMonth(d, c)) classes.push('kair-cal-mini__day--other-month');
      if (sameDay(d, today)) classes.push('kair-cal-mini__day--today');
      if (sameDay(d, this.state.selectedDate) && !sameDay(d, today)) classes.push('kair-cal-mini__day--selected');
      if (this.state.events.some(e => e.date === iso)) classes.push('kair-cal-mini__day--has-events');
      html += '<div class="' + classes.join(' ') + '" data-kair-cal-mini-day="' + iso + '">' + d.getDate() + '</div>';
    }
    this._els.miniGrid.innerHTML = html;
  };

  // ---------- Línea de hora actual ----------
  KairCalendar.prototype._positionNowLine = function () {
    const body = this._els.popover.querySelector('[data-kair-cal-week-body], [data-kair-cal-day-col]');
    if (!body) return;
    // Limpiar líneas previas
    body.querySelectorAll('.kair-cal-now-line').forEach(n => n.remove());
    const today = new Date();
    // Solo si la vista incluye hoy
    let inView = false;
    if (this.state.view === 'day') {
      inView = sameDay(this.state.current, today);
    } else if (this.state.view === 'week') {
      const ws = startOfWeek(this.state.current);
      const we = addDays(ws, 6);
      inView = today >= ws && today <= we;
    }
    if (!inView) return;
    const hour = today.getHours() + today.getMinutes()/60;
    const slotH = (this.state.view === 'day') ? 56 : 48;
    const top = hour * slotH;
    if (this.state.view === 'week') {
      // línea en la columna del día actual
      const cols = body.querySelectorAll('.kair-cal-week__day-col');
      const ws = startOfWeek(this.state.current);
      const todayIdx = Math.floor((today - ws) / (24*3600*1000));
      const col = cols[todayIdx];
      if (col) {
        const line = document.createElement('div');
        line.className = 'kair-cal-now-line';
        line.style.top = top + 'px';
        col.appendChild(line);
      }
    } else {
      const line = document.createElement('div');
      line.className = 'kair-cal-now-line';
      line.style.top = top + 'px';
      body.appendChild(line);
    }
  };

  // ---------- Click en celda ----------
  KairCalendar.prototype._handleCellClick = function (slotStr) {
    // slotStr puede ser: 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:MM'
    let dateStr, timeStr = null;
    if (slotStr.indexOf('T') >= 0) {
      const [d, t] = slotStr.split('T');
      dateStr = d;
      timeStr = t;
    } else {
      dateStr = slotStr;
    }
    const d = parseISODate(dateStr);
    this.state.selectedDate = d;
    this.state.current = new Date(d);
    // Pre-abrir modal con fecha (y hora si aplica)
    this._openEventModal(null, dateStr, timeStr);
  };

  // ---------- 📦544 — Day popover (hover 1s + click expande) ----------
  // Un solo componente: aparece cerca del día, muestra los eventos con scroll
  // si hay muchos, y tiene botón "+ Nuevo evento" abajo. Se invoca desde
  // hover (1s) o desde click (sin hover). El usuario pidió: "que se despliegue
  // ya de esa alerta que se muestra en lugar de que se cree en una nueva
  // ubicación" → posicionado cerca del día, NO en panel lateral.
  KairCalendar.prototype._scheduleDayPopover = function (dateStr, anchorEl) {
    this._cancelDayPopoverTimeout();
    var dayEvents = (this.state.events || []).filter(function (e) { return e.date === dateStr; });
    // Solo mostrar preview si hay eventos. Si está vacío, no tiene sentido
    // un preview (pero el click sí lo va a mostrar para poder crear).
    if (dayEvents.length === 0) return;
    var self = this;
    this._popoverTimeout = setTimeout(function () {
      self._showDayPopover(dateStr, anchorEl, dayEvents, /* expanded */ false);
    }, 1000);
  };

  // 📦545 — Cancelar SOLO el timer (sin cerrar el popover visible).
  // El mouseleave de la celda llama a este para que si el mouse va al
  // popover (ya visible), no se cierre. Si se va a otra celda, el popover
  // se cierra por la lógica de "click en otro día" o "click fuera".
  KairCalendar.prototype._cancelDayPopoverTimeout = function () {
    if (this._popoverTimeout) {
      clearTimeout(this._popoverTimeout);
      this._popoverTimeout = null;
    }
  };

  /**
   * Muestra el day popover.
   * - expanded=false (preview de hover): muestra hasta 3 eventos, sin botón crear
   * - expanded=true  (click): muestra TODOS los eventos con scroll + botón crear
   */
  KairCalendar.prototype._showDayPopover = function (dateStr, anchorEl, dayEvents, expanded) {
    this._closeDayPopover();
    expanded = !!expanded;
    var self = this;
    var dayDate = new Date(dateStr + 'T00:00:00');
    var dayName = dayDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' });
    var pop = document.createElement('div');
    pop.id = 'ei-day-popover';
    pop.className = 'kair-cal-day-popover';
    pop.style.cssText = [
      'position: absolute',
      'z-index: 200001',
      'background: var(--v3-bg-card, #fff)',
      'border: 1px solid var(--v3-border, #d1d5db)',
      'border-radius: 8px',
      'box-shadow: 0 6px 20px rgba(0,0,0,0.18)',
      'padding: 10px 12px',
      'min-width: 240px',
      'max-width: 340px',
      'max-height: ' + (expanded ? '420px' : '320px') + '',
      'font-size: 0.85rem',
      'pointer-events: auto',
      'display: flex',
      'flex-direction: column',
      'animation: ei-tip-fadeIn 0.18s ease'
    ].join(';');
    var html = '';
    // Header
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">';
    html +=   '<div style="font-weight:600;color:var(--v3-foreground,#1f2937);font-size:0.9rem;text-transform:capitalize;">' + escapeHTML(dayName) + '</div>';
    html +=   '<button data-kair-cal-action="day-popover-close" aria-label="Cerrar" style="background:none;border:none;cursor:pointer;font-size:1.3rem;color:var(--v3-muted,#6b7280);line-height:1;padding:0 4px;">&times;</button>';
    html += '</div>';
    // Lista de eventos (con scroll si hay muchos)
    html += '<div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px;">';
    var maxShow = expanded ? dayEvents.length : 3;
    for (var i = 0; i < Math.min(maxShow, dayEvents.length); i++) {
      var e = dayEvents[i];
      var color = this._typeColor(e.type) || '#174ea6';
      var hora = (e.start && e.start !== '00:00') ? e.start : '';
      var prefix = e.cumplido ? '✓ ' : (e.type === 'rapido' ? '⚡ ' : '');
      html += '<div class="ei-day-popover__event" data-event-id="' + escapeHTML(e.id) + '" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;background:var(--v3-muted,#f3f4f6);cursor:pointer;">';
      html +=   '<span style="width:4px;height:18px;border-radius:2px;background:' + color + ';flex-shrink:0;"></span>';
      html +=   '<div style="flex:1;min-width:0;">';
      html +=     '<div style="font-size:0.8rem;color:var(--v3-foreground,#1f2937);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + prefix + escapeHTML(e.title) + '</div>';
      if (hora) html += '<div style="font-size:0.7rem;color:var(--v3-muted,#6b7280);margin-top:1px;">' + hora + '</div>';
      html +=   '</div>';
      html += '</div>';
    }
    if (dayEvents.length > maxShow) {
      html += '<div style="font-size:0.75rem;color:var(--v3-muted,#6b7280);text-align:center;padding-top:4px;">+' + (dayEvents.length - maxShow) + ' más</div>';
    }
    html += '</div>';  // lista
    // Botón crear (solo en modo expanded)
    if (expanded) {
      html += '<div style="padding-top:8px;margin-top:8px;border-top:1px solid var(--v3-border,#e5e7eb);">';
      html +=   '<button data-kair-cal-action="day-popover-create" data-date="' + escapeHTML(dateStr) + '" style="width:100%;padding:8px 10px;background:var(--rosa,#e91e63);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;font-weight:600;display:flex;align-items:center;justify-content:center;gap:4px;">';
      html +=     '<i class="bi bi-plus-lg"></i> Nuevo evento para este día';
      html +=   '</button>';
      html += '</div>';
    }
    pop.innerHTML = html;
    document.body.appendChild(pop);

    // Posicionar cerca del anchor
    var rect = anchorEl.getBoundingClientRect();
    var popRect = pop.getBoundingClientRect();
    var top, left;
    // Default: debajo del día
    top = window.scrollY + rect.bottom + 6;
    left = window.scrollX + rect.left;
    // Si no entra a la derecha, ajustar
    if (left + popRect.width > window.innerWidth - 8) {
      left = window.innerWidth - popRect.width - 8;
    }
    // Si no entra abajo (cerca del final de la página), poner arriba
    if (rect.bottom + popRect.height + 12 > window.innerHeight) {
      top = window.scrollY + rect.top - popRect.height - 6;
    }
    pop.style.top = top + 'px';
    pop.style.left = Math.max(8, left) + 'px';

    this._els.dayPopover = pop;
    this._els.dayPopoverDate = dateStr;

    // 📦546 (FIX) — Bind: clicks en botones del day popover (X, + Nuevo evento).
    // El day popover está appendeado a document.body, NO es hijo del
    // contenedor principal del calendario. Por eso los clicks de estos
    // botones nunca llegan al action handler que procesa 'day-popover-close'
    // y 'day-popover-create'. Si dejamos que se propaguen al document, el
    // _onDocClick del calendario evalúa `e.target.closest('.kair-cal-modal-overlay')`
    // → null (el day popover no es un modal-overlay) → `this.close()` cierra
    // el calendario entero. Fix: bind directo con e.stopPropagation() — mismo
    // patrón que los eventos individuales del popover (línea 1117).
    var dayPopoverBtns = pop.querySelectorAll('[data-kair-cal-action^="day-popover-"]');
    for (var b = 0; b < dayPopoverBtns.length; b++) {
      (function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
          var action = btn.getAttribute('data-kair-cal-action');
          if (action === 'day-popover-close') {
            self._closeDayPopover();
          } else if (action === 'day-popover-create') {
            var dateStrCreate = btn.getAttribute('data-date');
            self._closeDayPopover();
            self._openEventModal(null, dateStrCreate, null);
          }
        });
      })(dayPopoverBtns[b]);
    }

    // 📦545 — Si es el popover EXPANDIDO (click), no se cierra al mover
    // el mouse fuera de la celda. Solo se cierra con X, click en otro día
    // o click fuera del popover (con delay 200ms para dar tiempo a mover
    // el mouse de un item a otro). Permite navegar por los eventos sin
    // que se cierre.
    if (expanded) {
      var closeOnLeaveTimer = null;
      pop.addEventListener('mouseenter', function () {
        if (closeOnLeaveTimer) {
          clearTimeout(closeOnLeaveTimer);
          closeOnLeaveTimer = null;
        }
      });
      pop.addEventListener('mouseleave', function () {
        closeOnLeaveTimer = setTimeout(function () {
          self._closeDayPopover();
        }, 250);
      });
    }

    // Bind: click en cada evento → abrir detail panel
    var evEls = pop.querySelectorAll('.ei-day-popover__event');
    for (var k = 0; k < evEls.length; k++) {
      (function (el) {
        el.addEventListener('click', function (e) {
          // 📦545 (FIX) — stopPropagation evita que el click se propague al
          // document y dispare el handler "click fuera → cerrar calendario"
          // de kair-calendar.js. Antes, el detail panel se abría DESPUÉS
          // del click, entonces cuando el handler del document evaluaba
          // `e.target.closest('.kair-cal-modal-overlay')` aún no existía el
          // modal → caía al this.close() → cerraba el calendario entero.
          e.stopPropagation();
          e.preventDefault();
          var evId = el.getAttribute('data-event-id');
          var ev = dayEvents.find(function (e) { return e.id === evId; });
          if (!ev) return;
          self._closeDayPopover();
          if (window.calendarDetailPanel) {
            window.calendarDetailPanel.open(ev);
          } else if (self._els.main) {
            // Fallback: simular click en el chip original
            var chip = self._els.main.querySelector('[data-kair-cal-event-id="' + evId + '"]');
            if (chip) chip.click();
          }
        });
        el.addEventListener('mouseenter', function () { el.style.background = 'var(--v3-border,#e5e7eb)'; });
        el.addEventListener('mouseleave', function () { el.style.background = 'var(--v3-muted,#f3f4f6)'; });
      })(evEls[k]);
    }
  };

  KairCalendar.prototype._closeDayPopover = function () {
    if (this._els && this._els.dayPopover && this._els.dayPopover.parentNode) {
      this._els.dayPopover.parentNode.removeChild(this._els.dayPopover);
      this._els.dayPopover = null;
      this._els.dayPopoverDate = null;
    }
  };

  // Cerrar popover al hacer click fuera
  // (Se hace via un listener global, se setea en _init)

  // 📦544 — Wire del hover 1s en cada celda. Llamado desde _renderMain
  // después de re-renderizar. Como el innerHTML borra listeners viejos,
  // no hay duplicación.
  KairCalendar.prototype._wireCellHover = function () {
    if (!this._els || !this._els.main) return;
    var self = this;
    var cells = this._els.main.querySelectorAll('[data-kair-cal-cell-date]');
    for (var i = 0; i < cells.length; i++) {
      (function (cellEl) {
        cellEl.addEventListener('mouseenter', function () {
          var dateStr = cellEl.getAttribute('data-kair-cal-cell-date');
          if (dateStr && dateStr.indexOf('T') < 0) {
            self._scheduleDayPopover(dateStr, cellEl);
          }
        });
        cellEl.addEventListener('mouseleave', function () {
          // 📦545 — Solo cancelar el timer del preview, NO cerrar el
          // popover visible. Si el mouse va al popover (ya expanded),
          // no se cierra. El popover se cierra solo con X, click fuera,
          // o cuando se navega a otro día.
          self._cancelDayPopoverTimeout();
        });
      })(cells[i]);
    }
  };

  // ---------- Modal de evento ----------
  KairCalendar.prototype._openEventModal = function (event, dateStr, timeStr) {
    // Cerrar previo
    this._closeEventModal();
    const isEdit = !!event;
    const overlay = document.createElement('div');
    overlay.className = 'kair-cal-modal-overlay';
    const ev = event || { id: null, title: '', date: dateStr || toISODate(this.state.current), start: timeStr || '09:00', end: '10:00', type: 'primary', description: '' };
    overlay.innerHTML =
      '<div class="kair-cal-modal" role="dialog" aria-modal="true" aria-labelledby="kair-cal-modal-title">' +
        '<div class="kair-cal-modal__head">' +
          '<h3 class="kair-cal-modal__title" id="kair-cal-modal-title">' + (isEdit ? 'Editar evento' : 'Nuevo evento') + '</h3>' +
          '<button type="button" class="kair-cal-modal__close" data-kair-cal-action="modal-cancel" aria-label="Cerrar">' + X_SVG + '</button>' +
        '</div>' +
        '<div class="kair-cal-modal__body">' +
          '<div class="kair-cal-field">' +
            '<label class="kair-cal-field__label" for="kair-cal-f-title">Título</label>' +
            '<input type="text" id="kair-cal-f-title" class="kair-cal-field__input" value="' + escapeHTML(ev.title) + '" placeholder="Ej: Capacitación SST" maxlength="120" />' +
          '</div>' +
          '<div class="kair-cal-field__row">' +
            '<div class="kair-cal-field">' +
              '<label class="kair-cal-field__label" for="kair-cal-f-date">Fecha</label>' +
              '<input type="date" id="kair-cal-f-date" class="kair-cal-field__input" value="' + escapeHTML(ev.date) + '" />' +
            '</div>' +
            '<div class="kair-cal-field">' +
              '<label class="kair-cal-field__label" for="kair-cal-f-type">Tipo</label>' +
              '<select id="kair-cal-f-type" class="kair-cal-field__select">' +
                this.opts.eventTypes.map(t =>
                  '<option value="' + escapeHTML(t.id) + '"' + (t.id === ev.type ? ' selected' : '') + '>' + escapeHTML(t.label) + '</option>'
                ).join('') +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="kair-cal-field__row">' +
            '<div class="kair-cal-field">' +
              '<label class="kair-cal-field__label" for="kair-cal-f-start">Hora inicio</label>' +
              '<input type="time" id="kair-cal-f-start" class="kair-cal-field__input" value="' + escapeHTML(ev.start) + '" />' +
            '</div>' +
            '<div class="kair-cal-field">' +
              '<label class="kair-cal-field__label" for="kair-cal-f-end">Hora fin</label>' +
              '<input type="time" id="kair-cal-f-end" class="kair-cal-field__input" value="' + escapeHTML(ev.end) + '" />' +
            '</div>' +
          '</div>' +
          '<div class="kair-cal-field">' +
            '<label class="kair-cal-field__label" for="kair-cal-f-desc">Descripción</label>' +
            '<textarea id="kair-cal-f-desc" class="kair-cal-field__textarea" placeholder="Notas internas (opcional)" maxlength="500">' + escapeHTML(ev.description || '') + '</textarea>' +
          '</div>' +
        '</div>' +
        '<div class="kair-cal-modal__foot">' +
          (isEdit ? '<button type="button" class="kair-cal-btn kair-cal-btn--ghost" data-kair-cal-action="modal-delete" style="margin-right:auto;color:' + 'var(--kair-cal-danger)' + ';">Eliminar</button>' : '') +
          '<button type="button" class="kair-cal-btn kair-cal-btn--secondary" data-kair-cal-action="modal-cancel">Cancelar</button>' +
          '<button type="button" class="kair-cal-btn kair-cal-btn--primary" data-kair-cal-action="modal-save">' + (isEdit ? 'Guardar cambios' : 'Crear evento') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    this._els.eventModalOverlay = overlay;
    this._els.modalEditingId = ev.id;
    // Abrir con animación
    requestAnimationFrame(() => overlay.classList.add('kair-cal-modal-overlay--open'));
    // Bind acciones del modal
    this._on(overlay, 'click', (e) => {
      e.stopPropagation(); // [Fix 2026-07-01 v3] evita propagacion al overlay principal
      const actEl = e.target.closest('[data-kair-cal-action]');
      if (actEl) {
        e.preventDefault();
        this._handleAction(actEl.getAttribute('data-kair-cal-action'));
        return;
      }
      if (e.target === overlay) this._closeEventModal();
    });
    // Foco
    setTimeout(() => {
      const t = overlay.querySelector('#kair-cal-f-title');
      if (t) t.focus();
    }, 100);
  };

  KairCalendar.prototype._closeEventModal = function () {
    if (!this._els.eventModalOverlay) return;
    const ov = this._els.eventModalOverlay;
    ov.classList.remove('kair-cal-modal-overlay--open');
    setTimeout(() => { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 160);
    this._els.eventModalOverlay = null;
    this._els.modalEditingId = null;
  };

  KairCalendar.prototype._saveEventFromModal = function () {
    const ov = this._els.eventModalOverlay;
    if (!ov) return;
    const title = ov.querySelector('#kair-cal-f-title').value.trim();
    const date = ov.querySelector('#kair-cal-f-date').value;
    const start = ov.querySelector('#kair-cal-f-start').value;
    const end = ov.querySelector('#kair-cal-f-end').value;
    const type = ov.querySelector('#kair-cal-f-type').value;
    const description = ov.querySelector('#kair-cal-f-desc').value.trim();

    if (!title) {
      const t = ov.querySelector('#kair-cal-f-title');
      t.style.borderColor = 'var(--kair-cal-danger)';
      t.focus();
      return;
    }
    if (!date) return;

    const payload = { title, date, start: start || '09:00', end: end || '10:00', type, description };
    const id = this._els.modalEditingId;
    const promise = id ? this._adapter.update(Object.assign({ id }, payload)) : this._adapter.create(payload);
    promise.then(res => {
      if (!res || !res.success) {
        this._showToast('No se pudo guardar el evento', 'error');
        return;
      }
      this._closeEventModal();
      this._loadEvents().then(() => {
        this._refresh();
        this._showToast(id ? 'Evento actualizado' : 'Evento creado', 'success');
      });
    }).catch(err => {
      this._showToast('Error: ' + (err && err.message ? err.message : 'desconocido'), 'error');
    });
  };

  KairCalendar.prototype._deleteEventFromModal = function () {
    const id = this._els.modalEditingId;
    if (!id) return;
    if (!confirm('¿Eliminar este evento? Esta acción no se puede deshacer.')) return;
    this._adapter.remove(id).then(res => {
      if (!res || !res.success) {
        this._showToast('No se pudo eliminar el evento', 'error');
        return;
      }
      this._closeEventModal();
      this._loadEvents().then(() => {
        this._refresh();
        this._showToast('Evento eliminado', 'success');
      });
    }).catch(err => {
      this._showToast('Error: ' + (err && err.message ? err.message : 'desconocido'), 'error');
    });
  };

  // ---------- Toasts (mínimos, opcionales) ----------
  KairCalendar.prototype._showToast = function (msg, type) {
    let cont = document.getElementById('kair-cal-toast-cont');
    if (!cont) {
      cont = document.createElement('div');
      cont.id = 'kair-cal-toast-cont';
      cont.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2000;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
      document.body.appendChild(cont);
    }
    const t = document.createElement('div');
    const bg = type === 'error' ? '#dc3545' : (type === 'success' ? '#28a745' : '#174ea6');
    t.style.cssText = 'background:' + bg + ';color:#fff;padding:10px 16px;border-radius:6px;font-family:Segoe UI,Roboto,sans-serif;font-size:0.875rem;box-shadow:0 4px 12px rgba(0,0,0,.15);opacity:0;transform:translateY(8px);transition:all 160ms ease;max-width:340px;';
    t.textContent = msg;
    cont.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(8px)';
      setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 200);
    }, 3000);
  };

  // ---------- Carga de eventos (rango visible) ----------
  KairCalendar.prototype._loadEvents = function () {
    const range = this._currentRange();
    // 📦543 — Propagar el scope al adapter para que las fuentes por empresa
    // (capacitaciones, gestaciones, inspecciones, mantenimientos, cumplidos)
    // devuelvan eventos de TODAS las empresas cuando scope='all'.
    range.scope = this.state.scope;
    this.state.loading = true;
    this.state.error = null;
    this._renderMain();
    return Promise.resolve(this._adapter.list(range))
      .then(res => {
        if (!res || !res.success) {
          this.state.error = (res && res.error && res.error.message) || 'No se pudieron cargar los eventos';
          this.state.events = [];
        } else {
          this.state.events = (res.data || []).map(e => this._normalizeEvent(e));
        }
      })
      .catch(err => {
        this.state.error = (err && err.message) || 'Error de comunicación';
        this.state.events = [];
      })
      .then(() => {
        this.state.loading = false;
      });
  };

  KairCalendar.prototype._currentRange = function () {
    const c = this.state.current;
    let start, end;
    if (this.state.view === 'month') {
      const first = new Date(c.getFullYear(), c.getMonth(), 1);
      const startDow = first.getDay();
      const gridStart = addDays(first, -startDow);
      start = toISODate(gridStart);
      end = toISODate(addDays(gridStart, 41));
    } else if (this.state.view === 'week') {
      const ws = startOfWeek(c);
      start = toISODate(ws);
      end = toISODate(addDays(ws, 6));
    } else {
      start = toISODate(c);
      end = toISODate(c);
    }
    return { start, end };
  };

  // ---------- API pública ----------
  KairCalendar.prototype.open = function () {
    if (!this._els.popover) return;
    if (this.opts.inline) return; // no-op en modo inline (siempre visible)
    this.state.open = true;
    // Timestamp para el guard anti-doble-disparo del handler "cerrar al click fuera"
    this._lastOpenedAt = Date.now();
    // [Fix 2026-07-01 v2] Modal: alternar overlay principal Y pop. Si por
    // alguna razón no existe el overlay (modo inline puro), caer al legacy.
    if (this._els.overlay) {
      this._els.overlay.classList.add('kair-cal-modal-overlay--open');
      this._els.popover.classList.add('kair-cal-popover--open');
    } else {
      this._els.popover.classList.add('kair-cal-popover--open');
    }
    if (this._els.trigger) this._els.trigger.classList.add('kair-cal-trigger--active');
    // Marcar también triggers adicionales
    if (this._triggers) {
      this._triggers.forEach(t => t.classList.add('kair-cal-trigger--active'));
    }
    // 📦594 — Re-sincronizar current/selectedDate/miniCurrent con "hoy" cada vez
    // que se abre el popover. Sin esto, si la app quedó abierta varios días,
    // el calendario mostraba el día en que se cargó la app como "seleccionado"
    // (porque state se cachea al instanciar el KairCalendar). Ahora al abrir
    // siempre arranca en hoy, que es lo que el usuario espera.
    var _today = new Date();
    this.state.current = _today;
    this.state.selectedDate = _today;
    this.state.miniCurrent = _today;
    this._loadEvents().then(() => this._refresh());
    this._startNowLineTimer();
  };
  KairCalendar.prototype.close = function () {
    if (!this._els.popover) return;
    if (this.opts.inline) return; // no-op en modo inline (siempre visible)
    this.state.open = false;
    // 📦545 (FIX) — Limpiar el day popover al cerrar el calendario. Si no,
    // el popover queda "huérfano" visible aunque el calendario ya no esté.
    this._cancelDayPopoverTimeout();
    this._closeDayPopover();
    // [Fix 2026-07-01 v2] Modal: quitar --open del overlay Y del pop.
    if (this._els.overlay) {
      this._els.overlay.classList.remove('kair-cal-modal-overlay--open');
      this._els.popover.classList.remove('kair-cal-popover--open');
    } else {
      this._els.popover.classList.remove('kair-cal-popover--open');
    }
    if (this._els.trigger) this._els.trigger.classList.remove('kair-cal-trigger--active');
    if (this._triggers) {
      this._triggers.forEach(t => t.classList.remove('kair-cal-trigger--active'));
    }
    this._stopNowLineTimer();
  };
  KairCalendar.prototype.toggle = function () {
    if (this.state.open) this.close(); else this.open();
  };
  KairCalendar.prototype.destroy = function () {
    this._stopNowLineTimer();
    this._listeners.forEach(({ el, type, fn }) => el.removeEventListener(type, fn));
    this._listeners = [];
    if (this._els.overlay && this._els.overlay.parentNode) this._els.overlay.parentNode.removeChild(this._els.overlay);
    if (this._els.popover && this._els.popover.parentNode) this._els.popover.parentNode.removeChild(this._els.popover);
    if (this._els.eventModalOverlay && this._els.eventModalOverlay.parentNode) this._els.eventModalOverlay.parentNode.removeChild(this._els.eventModalOverlay);
  };
  KairCalendar.prototype.refresh = function () {
    return this._loadEvents().then(() => this._refresh());
  };
  KairCalendar.prototype.goToDate = function (date) {
    this.state.current = new Date(date);
    this.state.selectedDate = new Date(date);
    this.state.miniCurrent = new Date(date);
    // Si el popover está cerrado, abrirlo (igual que setView).
    if (!this.state.open) {
      this.open();
    } else {
      this._refresh();
    }
  };

  // ---------- Helpers de eventos internos ----------
  KairCalendar.prototype._on = function (el, type, fn) {
    el.addEventListener(type, fn);
    this._listeners.push({ el, type, fn });
  };
  KairCalendar.prototype._bindGlobal = function () {
    // [Fix 2026-07-01] Modal central: ESC cierra el calendario principal.
    // No cerrar si hay un modal de "Nuevo evento" abierto encima (prioridad).
    this._on(document, 'keydown', function (e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      if (!this.state.open) return;
      if (this._els.eventModalOverlay) return; // modal de evento tiene prioridad
      this.close();
    }.bind(this));
  };
  KairCalendar.prototype._startNowLineTimer = function () {
    this._stopNowLineTimer();
    this._nowTimer = setInterval(() => {
      if (this.state.open) this._positionNowLine();
    }, 60 * 1000); // cada minuto
  };
  KairCalendar.prototype._stopNowLineTimer = function () {
    if (this._nowTimer) { clearInterval(this._nowTimer); this._nowTimer = null; }
  };

  // ---------- Normalización de evento ----------
  // 📦497 — Reemplazo de normalizeEvent() global: ahora es un método de
  // instancia porque necesita acceder a this.opts.eventTypes para validar
  // tipos custom (capacitacion, gestacion, etc.). Antes usaba un whitelist
  // hardcoded de 5 tipos default que descartaba tipos custom → chips
  // mostraban type='primary' aunque vinieran con type='gestacion'.
  // 📦498 — Acepta y preserva campos de cumplimiento: cumplido, cumplidoEn,
  // cumplidoNota. Estos vienen del adapter (enriquecidos desde eventosCumplidos).
  KairCalendar.prototype._normalizeEvent = function (e) {
    if (!e) return null;
    // Whitelist dinámico desde eventTypes config. Si un tipo no está,
    // cae a 'primary' (mantiene compatibilidad con eventos sin tipo).
    var validIds = (this._typeColorCache && Object.keys(this._typeColorCache).length)
      ? Object.keys(this._typeColorCache)
      : ['primary','success','warning','danger','info'];
    var t = e.type;
    var finalType = validIds.indexOf(t) >= 0 ? t : 'primary';
    return {
      id: safeEl(e.id),
      title: safeEl(e.title) || '(Sin título)',
      date: safeEl(e.date),
      start: e.start ? safeEl(e.start) : null,
      end: e.end ? safeEl(e.end) : null,
      type: finalType,
      description: e.description ? safeEl(e.description) : '',
      // 📦498 — Estado de cumplimiento (preservado del adapter)
      cumplido: !!e.cumplido,
      cumplidoEn: e.cumplidoEn ? String(e.cumplidoEn) : null,
      cumplidoNota: e.cumplidoNota ? String(e.cumplidoNota) : ''
    };
  };

  // ---------- Estados HTML ----------
  function stateLoadingHTML() {
    return '<div class="kair-cal-state kair-cal-state--loading">' +
      '<div class="kair-cal-state__icon"><div class="kair-cal-spinner"></div></div>' +
      '<p class="kair-cal-state__title">Cargando eventos…</p>' +
      '<p class="kair-cal-state__text">Espere un momento mientras se consulta la información.</p>' +
    '</div>';
  }
  function stateEmptyHTML(title, text) {
    return '<div class="kair-cal-state">' +
      '<div class="kair-cal-state__icon">' + CALENDAR_ICON_SVG + '</div>' +
      '<p class="kair-cal-state__title">' + escapeHTML(title) + '</p>' +
      '<p class="kair-cal-state__text">' + escapeHTML(text) + '</p>' +
    '</div>';
  }
  function stateErrorHTML(msg) {
    return '<div class="kair-cal-state kair-cal-state--error">' +
      '<div class="kair-cal-state__icon">' + ALERT_SVG + '</div>' +
      '<p class="kair-cal-state__title">No se pudo cargar el calendario</p>' +
      '<p class="kair-cal-state__text">' + escapeHTML(msg || 'Error desconocido') + '</p>' +
    '</div>';
  }

  // ---------- Iconos SVG inline (sin dependencias) ----------
  const CALENDAR_ICON_SVG = '<svg class="kair-cal-trigger__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
  const CALENDAR_ICON_SVG_WHITE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
  const CHEVRON_LEFT_SVG  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
  const CHEVRON_RIGHT_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
  const CHEVRON_DOWN_SVG  = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  const PLUS_SVG          = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  const X_SVG             = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const ALERT_SVG         = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  const INFO_SVG          = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  const SEARCH_SVG        = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  const GRID_SVG          = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';
  const GEAR_SVG          = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

  // ---------- Exportar ----------
  global.KairCalendar = {
    create: function (options) { return new KairCalendar(options); },
    version: '1.0.0'
  };
})(typeof window !== 'undefined' ? window : this);

/* ===== FIN JS DEL COMPONENTE K+AIR CALENDAR ===== */