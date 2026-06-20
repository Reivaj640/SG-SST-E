/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Sileo Vanilla Port
   API de notificaciones tipo Sileo (https://sileo.aaryan.design)
   Para vanilla JS / Electron renderer.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── Estado interno ───────────────────────────────────────── */

  var _stack = null;
  var _position = 'top-right';
  var _idCounter = 0;
  var _activeToasts = {}; // id -> { el, timer, pause, opts }
  var _theme = 'auto';     // 'auto' | 'light' | 'dark'

  var ICONS = {
    success: 'bi-check-lg',
    error:   'bi-x-lg',
    warning: 'bi-exclamation-lg',
    info:    'bi-info-lg',
    action:  'bi-stars',
    loading: 'bi-arrow-clockwise'
  };

  /* ─── Helpers ──────────────────────────────────────────────── */

  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Calcula luminancia relativa de un color CSS (0..1). 0 = negro, 1 = blanco. */
  function _luminance(color) {
    if (!color) return 1;
    var tmp = document.createElement('div');
    tmp.style.color = color;
    document.body.appendChild(tmp);
    var rgb = getComputedStyle(tmp).color;
    document.body.removeChild(tmp);
    var m = rgb.match(/\d+/g);
    if (!m || m.length < 3) return 1;
    var r = parseInt(m[0], 10) / 255;
    var g = parseInt(m[1], 10) / 255;
    var b = parseInt(m[2], 10) / 255;
    /* Fórmula perceptual ITU-R BT.601 */
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  /** Detecta si el tema activo es oscuro mirando el fondo de la app.
      Recorre ancestors hasta encontrar un color de fondo no transparente. */
  function _detectDarkTheme() {
    if (_theme === 'dark') return true;
    if (_theme === 'light') return false;
    /* Modo auto: detectar desde el fondo del body, o el container, o cualquier ancestro */
    var bg = getComputedStyle(document.body).backgroundColor;
    var lum = _luminance(bg);
    return lum < 0.5;
  }

  function _applyTheme() {
    if (!_stack) return;
    if (_detectDarkTheme()) {
      _stack.classList.add('sileo-dark');
    } else {
      _stack.classList.remove('sileo-dark');
    }
  }

  function _ensureStack() {
    if (_stack && document.body.contains(_stack)) return _stack;
    _stack = document.createElement('div');
    _stack.className = 'sileo-stack sileo-stack--' + _position;
    _stack.id = 'sileo-stack';
    document.body.appendChild(_stack);
    _applyTheme();
    return _stack;
  }

  function _genId() {
    _idCounter += 1;
    return 'sileo-' + Date.now() + '-' + _idCounter;
  }

  function _closeToast(id) {
    var t = _activeToasts[id];
    if (!t) return;
    if (t.timer) clearTimeout(t.timer);
    t.el.classList.add('sileo-toast--closing');
    var el = t.el;
    delete _activeToasts[id];
    setTimeout(function () {
      if (el && el.parentNode) el.remove();
    }, 240);
  }

  function _pauseTimer(id) {
    var t = _activeToasts[id];
    if (!t || !t.timer) return;
    clearTimeout(t.timer);
    var elapsed = Date.now() - t.startedAt;
    var remaining = Math.max(0, t.duration - elapsed);
    t.pausedAt = Date.now();
    t.remaining = remaining;
    t.timer = null;
  }

  function _resumeTimer(id) {
    var t = _activeToasts[id];
    if (!t || t.timer) return;
    var remaining = t.remaining || t.duration;
    t.startedAt = Date.now();
    t.pausedAt = null;
    t.timer = setTimeout(function () {
      _closeToast(id);
    }, remaining);
  }

  /* ─── API principal: _show(opts) → retorna { id, update, dismiss } ─── */

  function _show(opts) {
    opts = opts || {};
    var id = opts.id || _genId();
    var type = opts.type || 'info';
    var title = opts.title || '';
    var description = opts.description || '';
    var duration = opts.duration !== undefined ? opts.duration : 4000;
    var closable = opts.closable !== false;
    var buttons = opts.buttons || [];
    var position = opts.position || _position;

    if (_position !== position) {
      _position = position;
      if (_stack) _stack.className = 'sileo-stack sileo-stack--' + position;
    }

    var stack = _ensureStack();
    _applyTheme(); /* FIX 2: re-evaluar tema en cada show (por si la app cambió) */
    var el = document.createElement('div');
    el.className = 'sileo-toast sileo-toast--' + type;
    el.setAttribute('role', type === 'action' || type === 'loading' ? 'alertdialog' : 'status');
    el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    el.dataset.id = id;

    var icon = opts.icon || ICONS[type] || ICONS.info;
    var html = '<div class="sileo-toast__icon"><i class="bi ' + icon + '"></i></div>';
    html += '<div class="sileo-toast__body">';
    if (title) html += '<div class="sileo-toast__title">' + _esc(title) + '</div>';
    if (description) html += '<div class="sileo-toast__description">' + _esc(description) + '</div>';
    if (buttons.length) {
      html += '<div class="sileo-toast__actions">';
      buttons.forEach(function (b, i) {
        b._btnId = i;     /* FIX 1: asignar ANTES de generar el HTML */
        b._toastId = id;
        var cls = 'sileo-btn sileo-btn--' + (b.variant || 'secondary');
        var hasCb = typeof b.onClick === 'function';
        var dataAttr = hasCb ? ' data-action="btn" data-btn-id="' + i + '"' : '';
        html += '<button type="button" class="' + cls + '"' + dataAttr + '>' + _esc(b.label || '') + '</button>';
      });
      html += '</div>';
    }
    html += '</div>';
    if (closable) {
      html += '<button type="button" class="sileo-toast__close" data-action="close" aria-label="Cerrar">&times;</button>';
    }
    if (duration > 0 && type !== 'loading') {
      html += '<div class="sileo-toast__progress" style="animation-duration:' + duration + 'ms"></div>';
    }

    el.innerHTML = html;
    stack.appendChild(el);

    /* Mapear botones a callbacks */
    var entry = { el: el, duration: duration, startedAt: Date.now() };
    _activeToasts[id] = entry;

    el.querySelectorAll('[data-action="btn"]').forEach(function (btn) {
      var btnId = parseInt(btn.getAttribute('data-btn-id'), 10);
      var b = buttons[btnId];
      if (b && typeof b.onClick === 'function') {
        btn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          try { b.onClick(); } catch (e) { console.error('[Sileo] button error:', e); }
          if (b.dismissOnClick !== false) _closeToast(id);
        });
      }
    });

    el.querySelectorAll('[data-action="close"]').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        _closeToast(id);
      });
    });

    /* Auto-dismiss timer */
    if (duration > 0 && type !== 'loading') {
      entry.timer = setTimeout(function () { _closeToast(id); }, duration);
      /* Pausar con hover */
      el.addEventListener('mouseenter', function () { _pauseTimer(id); });
      el.addEventListener('mouseleave', function () { _resumeTimer(id); });
    }

    return {
      id: id,
      update: function (newOpts) { return _update(id, newOpts); },
      dismiss: function () { _closeToast(id); }
    };
  }

  function _update(id, opts) {
    var t = _activeToasts[id];
    if (!t) return _show(Object.assign({}, opts, { id: id }));
    var newType = opts.type || (t.el.className.match(/sileo-toast--(\w+)/) || [])[1] || 'info';
    if (opts.type) {
      t.el.classList.remove('sileo-toast--success', 'sileo-toast--error', 'sileo-toast--warning', 'sileo-toast--info', 'sileo-toast--action', 'sileo-toast--loading');
      t.el.classList.add('sileo-toast--' + newType);
    }
    if (opts.title !== undefined) {
      var titleEl = t.el.querySelector('.sileo-toast__title');
      if (titleEl) titleEl.textContent = opts.title; else {
        var body = t.el.querySelector('.sileo-toast__body');
        if (body) body.insertAdjacentHTML('afterbegin', '<div class="sileo-toast__title">' + _esc(opts.title) + '</div>');
      }
    }
    if (opts.description !== undefined) {
      var descEl = t.el.querySelector('.sileo-toast__description');
      if (descEl) descEl.textContent = opts.description; else {
        var body2 = t.el.querySelector('.sileo-toast__body');
        if (body2) body2.insertAdjacentHTML('beforeend', '<div class="sileo-toast__description">' + _esc(opts.description) + '</div>');
      }
    }
    return { id: id, update: _update.bind(null, id), dismiss: function () { _closeToast(id); } };
  }

  /* ─── Helpers públicos ────────────────────────────────────── */

  function _promise(promise, states) {
    states = states || {};
    var t = _show({
      type: 'loading',
      title: (states.loading && states.loading.title) || 'Cargando...',
      description: (states.loading && states.loading.description) || '',
      duration: 0,
      closable: false
    });
    Promise.resolve(promise).then(function (data) {
      var s = typeof states.success === 'function' ? states.success(data) : states.success;
      t.update({ type: 'success', title: (s && s.title) || 'Completado', description: (s && s.description) || '', duration: 4000, closable: true });
    }).catch(function (err) {
      var e = typeof states.error === 'function' ? states.error(err) : states.error;
      t.update({ type: 'error', title: (e && e.title) || 'Error', description: (e && e.description) || (err && err.message) || '', duration: 5000, closable: true });
    });
    return t;
  }

  function _confirm(opts) {
    return new Promise(function (resolve) {
      var resolved = false;
      _show({
        type: 'action',
        title: opts.title || '¿Confirmar?',
        description: opts.description || '',
        duration: 0,
        closable: true,
        buttons: [
          {
            label: opts.cancelText || 'Cancelar',
            variant: 'secondary',
            onClick: function () { resolved = true; resolve(false); }
          },
          {
            label: opts.confirmText || 'Confirmar',
            variant: opts.danger ? 'danger' : 'primary',
            onClick: function () { resolved = true; resolve(true); }
          }
        ]
      });
    });
  }

  function _dismissAll() {
    Object.keys(_activeToasts).forEach(function (id) { _closeToast(id); });
  }

  function _setPosition(pos) {
    _position = pos;
    if (_stack) {
      _stack.className = 'sileo-stack sileo-stack--' + pos;
      _applyTheme();
    }
  }

  /** FIX 2: forzar tema manualmente. 'auto' = detectar desde fondo de la app. */
  function _setTheme(theme) {
    _theme = (theme === 'light' || theme === 'dark') ? theme : 'auto';
    _applyTheme();
  }

  /* ─── Panel de pruebas (Ctrl+Shift+S) ──────────────────────── */

  function _showPlayground() {
    if (document.getElementById('sileo-playground')) {
      document.getElementById('sileo-playground').classList.add('sileo-playground--open');
      return;
    }
    var overlay = document.createElement('div');
    overlay.id = 'sileo-playground';
    overlay.className = 'sileo-playground';
    overlay.innerHTML =
      '<div class="sileo-playground__panel">' +
        '<h2 class="sileo-playground__title">' +
          '<span>🎨 Sileo Playground</span>' +
          '<button class="sileo-playground__close" data-action="close" aria-label="Cerrar">&times;</button>' +
        '</h2>' +
        '<p class="sileo-playground__subtitle">Prueba todos los tipos. Las notificaciones aparecen en la esquina superior derecha.</p>' +

        '<div class="sileo-playground__section">' +
          '<h3 class="sileo-playground__section-title">Tipos básicos</h3>' +
          '<div class="sileo-playground__grid">' +
            '<button class="sileo-playground__btn" data-test="success"><i class="bi bi-check-lg"></i> Success</button>' +
            '<button class="sileo-playground__btn" data-test="error"><i class="bi bi-x-lg"></i> Error</button>' +
            '<button class="sileo-playground__btn" data-test="warning"><i class="bi bi-exclamation-lg"></i> Warning</button>' +
            '<button class="sileo-playground__btn" data-test="info"><i class="bi bi-info-lg"></i> Info</button>' +
          '</div>' +
        '</div>' +

        '<div class="sileo-playground__section">' +
          '<h3 class="sileo-playground__section-title">Casos especiales</h3>' +
          '<div class="sileo-playground__grid">' +
            '<button class="sileo-playground__btn" data-test="action"><i class="bi bi-stars"></i> Con acciones</button>' +
            '<button class="sileo-playground__btn" data-test="confirm"><i class="bi bi-question-lg"></i> Confirm()</button>' +
            '<button class="sileo-playground__btn" data-test="promise"><i class="bi bi-arrow-clockwise"></i> Promise</button>' +
            '<button class="sileo-playground__btn" data-test="long"><i class="bi bi-chat-text"></i> Texto largo</button>' +
            '<button class="sileo-playground__btn" data-test="update"><i class="bi bi-pencil"></i> Update en vivo</button>' +
            '<button class="sileo-playground__btn" data-test="multi"><i class="bi bi-stack"></i> Múltiples</button>' +
          '</div>' +
        '</div>' +

        '<div class="sileo-playground__section">' +
          '<h3 class="sileo-playground__section-title">Posición</h3>' +
          '<div class="sileo-playground__grid">' +
            '<button class="sileo-playground__btn" data-pos="top-right">top-right</button>' +
            '<button class="sileo-playground__btn" data-pos="top-left">top-left</button>' +
            '<button class="sileo-playground__btn" data-pos="top-center">top-center</button>' +
            '<button class="sileo-playground__btn" data-pos="bottom-right">bottom-right</button>' +
            '<button class="sileo-playground__btn" data-pos="bottom-left">bottom-left</button>' +
            '<button class="sileo-playground__btn" data-pos="bottom-center">bottom-center</button>' +
          '</div>' +
        '</div>' +

      '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      var t = e.target.closest('[data-action], [data-test], [data-pos]');
      if (!t) return;
      if (t.dataset.action === 'close') {
        overlay.classList.remove('sileo-playground--open');
        return;
      }
      if (t.dataset.test) {
        runTest(t.dataset.test);
      }
      if (t.dataset.pos) {
        _setPosition(t.dataset.pos);
        Sileo.info({ title: 'Posición: ' + t.dataset.pos, duration: 1500 });
      }
    });

    function runTest(name) {
      switch (name) {
        case 'success': Sileo.success({ title: 'Cambios guardados', description: 'Revisión RG-2026-S1 actualizada correctamente' }); break;
        case 'error':   Sileo.error({ title: 'Error al guardar', description: 'No se pudo conectar con la base de datos. Reintenta.' }); break;
        case 'warning': Sileo.warning({ title: 'Acción requerida', description: 'Tienes 3 actas pendientes de firma antes del viernes' }); break;
        case 'info':    Sileo.info({ title: 'Nueva Revisión Gerencial', description: 'Iniciando ciclo conforme a G-PR-001' }); break;
        case 'action':  Sileo.action({
          title: 'Deshacer cambio',
          description: 'Se eliminó la auditoría "Auditoría SST Q3".',
          buttons: [
            { label: 'Descartar', variant: 'secondary' },
            { label: 'Deshacer',  variant: 'primary', onClick: function () { Sileo.success({ title: 'Acción deshecha' }); } }
          ]
        }); break;
        case 'confirm': Sileo.confirm({
          title: 'Eliminar revisión',
          description: 'Esta acción no se puede deshacer. Se borrarán también las actas asociadas.',
          confirmText: 'Eliminar', danger: true
        }).then(function (ok) {
          if (ok) Sileo.success({ title: 'Eliminado correctamente' });
          else    Sileo.info({ title: 'Eliminación cancelada' });
        }); break;
        case 'promise': Sileo.promise(
          new Promise(function (res) { setTimeout(function () { res({ id: 'RG-2026-S1' }); }, 2200); }),
          {
            loading:  { title: 'Guardando revisión...', description: 'Escribiendo en SQLite' },
            success:  function (d) { return { title: 'Revisión guardada', description: d.id + ' persistido correctamente' }; },
            error:    function (e) { return { title: 'Error', description: e.message }; }
          }
        ); break;
        case 'long': Sileo.info({
          title: 'Notificación con descripción muy larga',
          description: 'Esta notificación demuestra que el texto se ajusta correctamente en varias líneas sin romper el layout. El componente debe manejar contenido extenso de forma natural, manteniendo la legibilidad y la coherencia visual incluso con párrafos largos.',
          duration: 6000
        }); break;
        case 'update': {
          var t = Sileo.loading({ title: 'Conectando con la base de datos...', duration: 0 });
          setTimeout(function () { t.update({ type: 'warning', title: 'Reintentando...', description: 'Conexión lenta, intento 2 de 3' }); }, 1200);
          setTimeout(function () { t.update({ type: 'success', title: 'Conectado', description: 'Sincronización completada' }); }, 2400);
          break;
        }
        case 'multi':
          ['success', 'info', 'warning', 'error'].forEach(function (t, i) {
            setTimeout(function () { Sileo[t]({ title: 'Toast #' + (i + 1) + ' (' + t + ')' }); }, i * 250);
          });
          break;
      }
    }
  }

  function _togglePlayground() {
    var pg = document.getElementById('sileo-playground');
    if (pg && pg.classList.contains('sileo-playground--open')) {
      pg.classList.remove('sileo-playground--open');
    } else {
      _showPlayground();
    }
  }

  /* ─── Atajos de teclado ───────────────────────────────────── */

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      _togglePlayground();
    }
    if (e.key === 'Escape') {
      var pg = document.getElementById('sileo-playground');
      if (pg && pg.classList.contains('sileo-playground--open')) {
        pg.classList.remove('sileo-playground--open');
      }
    }
  });

  /* ─── Exportar API ────────────────────────────────────────── */

  window.Sileo = {
    success:  function (o) { return _show(Object.assign({}, o, { type: 'success' })); },
    error:    function (o) { return _show(Object.assign({}, o, { type: 'error' })); },
    warning:  function (o) { return _show(Object.assign({}, o, { type: 'warning' })); },
    info:     function (o) { return _show(Object.assign({}, o, { type: 'info' })); },
    action:   function (o) { return _show(Object.assign({}, o, { type: 'action' })); },
    loading:  function (o) { return _show(Object.assign({}, o, { type: 'loading', duration: 0, closable: false })); },
    promise:  _promise,
    confirm:  _confirm,
    update:   _update,
    dismiss:  function (id) { if (id) _closeToast(id); else _dismissAll(); },
    clear:    _dismissAll,
    setPosition: _setPosition,
    setTheme:    _setTheme,
    getTheme:    function () { return _theme; },
    showPlayground: _showPlayground,
    togglePlayground: _togglePlayground
  };
})();
