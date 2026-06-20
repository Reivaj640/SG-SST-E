/* ═══════════════════════════════════════════════════════════════════
   K+AIR · UI Library (vanilla port de shadcn/ui)
   Helpers para construir componentes sin React
   v3.0 · 2026-06-19
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── Helpers internos ───────────────────────────────────── */

  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Crea un elemento HTML con atributos y children */
  function _el(tag, attrs, ...children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class' || k === 'className') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.substring(2).toLowerCase(), v);
        else if (k === 'html') el.innerHTML = v;
        else el.setAttribute(k, v);
      });
    }
    children.forEach(function (c) {
      if (c == null || c === false) return;
      if (Array.isArray(c)) c.forEach(function (cc) { cc != null && el.appendChild(typeof cc === 'string' ? document.createTextNode(cc) : cc); });
      else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  /** Convierte children mixto (string/HTMLElement/función) a HTML string */
  function _renderChildren(children) {
    if (children == null) return '';
    if (Array.isArray(children)) return children.map(_renderChildren).join('');
    if (typeof children === 'function') return _renderChildren(children());
    if (typeof children === 'object' && children.outerHTML) return children.outerHTML;
    return _esc(String(children));
  }

  /* ─── Icon helper (usa kair-icons.js) ─────────────────────── */

  function _icon(name, attrs) {
    var cls = window.KairIcons && window.KairIcons[name] ? window.KairIcons[name] : (name || 'circle');
    var extra = (attrs && attrs.class) ? ' ' + attrs.class : '';
    return '<i class="bi bi-' + cls + extra + '"></i>';
  }

  /* ═══════════════════════════════════════════════════════════════
     COMPONENTES — API tipo shadcn
     ═══════════════════════════════════════════════════════════════ */

  /* ─── Card ──────────────────────────────────────────────── */

  function Card(props) {
    props = props || {};
    var variant = props.variant || 'default';
    var cls = 'kair-v3-card' + (props.hover ? ' kair-v3-card--hover' : '');
    var headerHtml = '';
    var contentHtml = '';
    var footerHtml = '';

    if (props.header || props.title || props.description) {
      headerHtml = '<div class="kair-v3-card__header">' +
        (props.title ? '<h3 class="kair-v3-card__title">' + _icon(props.icon) + _esc(props.title) + '</h3>' : '') +
        (props.description ? '<p class="kair-v3-card__description">' + _esc(props.description) + '</p>' : '') +
        (props.header ? '<div>' + _renderChildren(props.header) + '</div>' : '') +
      '</div>';
    }

    var bodyContent = props.content != null ? props.content : props.children;
    if (bodyContent != null) {
      contentHtml = '<div class="kair-v3-card__content">' + _renderChildren(bodyContent) + '</div>';
    }

    if (props.footer) {
      footerHtml = '<div class="kair-v3-card__footer">' + _renderChildren(props.footer) + '</div>';
    }

    var attrs = { class: cls, id: props.id };
    if (props.onClick) attrs.onclick = props.onClick;
    if (props.dataset) attrs.dataset = props.dataset;
    return '<div' + Object.keys(attrs).filter(function(k){return attrs[k]!=null;}).map(function(k){return ' ' + k + '="' + _esc(attrs[k]) + '"';}).join('') + '>' +
      headerHtml + contentHtml + footerHtml + '</div>';
  }

  /* ─── Button ────────────────────────────────────────────── */

  function Button(props) {
    props = props || {};
    var variant = props.variant || 'default';
    var size = props.size || 'default';
    var cls = 'kair-v3-btn kair-v3-btn--' + variant + (size !== 'default' ? ' kair-v3-btn--' + size : '');
    var iconHtml = props.icon ? _icon(props.icon) : '';
    var content = props.children != null ? _renderChildren(props.children) : (props.label || '');
    var attrs = ' class="' + _esc(cls) + '"';
    if (props.id) attrs += ' id="' + _esc(props.id) + '"';
    if (props.type) attrs += ' type="' + _esc(props.type) + '"';
    if (props.disabled) attrs += ' disabled';
    if (props.onClick) attrs += ' data-action="btn" data-btn-id="' + _esc(props.btnId || '') + '"';
    if (props.title) attrs += ' title="' + _esc(props.title) + '"';
    /* F21.24 (2026-06-20): aceptar tanto `dataset` (estándar) como `dataAttrs`
       (alias usado por todos los call sites del módulo). Esto resuelve el bug
       donde los botones no recibían atributos data-* porque se pasaba
       dataAttrs pero el código solo leía dataset. */
    var datasetMerged = Object.assign({}, props.dataset || {}, props.dataAttrs || {});
    if (Object.keys(datasetMerged).length > 0) {
      Object.keys(datasetMerged).forEach(function(k) {
        attrs += ' data-' + _esc(k) + '="' + _esc(datasetMerged[k]) + '"';
      });
    }
    return '<button' + attrs + '>' + iconHtml + content + '</button>';
  }

  /* ─── Badge ─────────────────────────────────────────────── */

  function Badge(props) {
    props = props || {};
    var variant = props.variant || 'default';
    var cls = 'kair-v3-badge kair-v3-badge--' + variant;
    var dotHtml = props.dot ? '<span class="dot"></span>' : '';
    var iconHtml = props.icon ? _icon(props.icon) : '';
    return '<span class="' + _esc(cls) + '">' + dotHtml + iconHtml + _esc(props.children || props.label || '') + '</span>';
  }

  /* ─── Dialog (overlay + panel) ──────────────────────────── */

  var _dialogCounter = 0;

  function Dialog(props) {
    props = props || {};
    if (props.open === false) return ''; // No renderizar si está cerrado
    var id = props.id || ('kair-v3-dialog-' + (++_dialogCounter));
    var sizeCls = props.size === 'lg' ? ' kair-v3-dialog--lg' :
                  props.size === 'xl' ? ' kair-v3-dialog--xl' :
                  props.size === 'full' ? ' kair-v3-dialog--full' : '';
    var overlay = _el('div', {
      id: id,
      class: 'kair-v3-dialog-overlay kair-v3-dialog-overlay--open',
      dataset: { action: 'dialog-backdrop', dialogId: id }
    });
    var panel = _el('div', { class: 'kair-v3-dialog' + sizeCls, role: 'dialog', 'aria-modal': 'true' });

    var header = _el('div', { class: 'kair-v3-dialog__header' });
    var titleBlock = _el('div', { style: { flex: '1', minWidth: '0' } });
    if (props.title) {
      var h = _el('h3', { class: 'kair-v3-dialog__title' });
      if (props.icon) h.innerHTML = _icon(props.icon) + _esc(props.title);
      else h.textContent = props.title;
      titleBlock.appendChild(h);
    }
    if (props.description) {
      var p = _el('p', { class: 'kair-v3-dialog__description' });
      p.textContent = props.description;
      titleBlock.appendChild(p);
    }
    header.appendChild(titleBlock);

    var closeBtn = _el('button', {
      class: 'kair-v3-dialog__close',
      'aria-label': 'Cerrar',
      dataset: { action: 'dialog-close', dialogId: id }
    });
    closeBtn.innerHTML = '&times;';
    header.appendChild(closeBtn);
    panel.appendChild(header);

    var body = _el('div', { class: 'kair-v3-dialog__body' });
    if (typeof props.children === 'string') body.innerHTML = props.children;
    else if (Array.isArray(props.children)) props.children.forEach(function(c) { c != null && body.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    else if (props.children instanceof HTMLElement) body.appendChild(props.children);
    panel.appendChild(body);

    if (props.footer) {
      var footer = _el('div', { class: 'kair-v3-dialog__footer' });
      if (typeof props.footer === 'string') footer.innerHTML = props.footer;
      else if (Array.isArray(props.footer)) props.footer.forEach(function(c) { c != null && footer.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
      else if (props.footer instanceof HTMLElement) footer.appendChild(props.footer);
      panel.appendChild(footer);
    }

    overlay.appendChild(panel);
    return overlay;
  }

  function openDialog(htmlOrProps) {
    var overlay;
    if (typeof htmlOrProps === 'string') {
      var div = document.createElement('div');
      div.innerHTML = htmlOrProps;
      overlay = div.firstElementChild;
    } else {
      overlay = Dialog(htmlOrProps);
    }
    if (!overlay) return null;
    document.body.appendChild(overlay);
    _bindDialogEvents(overlay);
    return overlay;
  }

  function closeDialog(overlayOrId) {
    var overlay = typeof overlayOrId === 'string' ? document.getElementById(overlayOrId) : overlayOrId;
    if (!overlay) return;
    overlay.style.animation = 'kair-v3-fade-in 200ms ease reverse';
    setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 180);
  }

  function _bindDialogEvents(overlay) {
    overlay.addEventListener('click', function (e) {
      var t = e.target.closest('[data-action="dialog-close"], [data-action="dialog-backdrop"]');
      if (!t) return;
      var isBackdrop = t.dataset.action === 'dialog-backdrop';
      if (isBackdrop && t !== e.target) return; // Solo el overlay directo
      closeDialog(overlay);
    });
    var escHandler = function (e) { if (e.key === 'Escape') { closeDialog(overlay); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
  }

  /* ─── Input + Textarea ──────────────────────────────────── */

  function Input(props) {
    props = props || {};
    var cls = 'kair-v3-input' + (props.error ? ' kair-v3-input--error' : '');
    var attrs = ' type="' + _esc(props.type || 'text') + '" class="' + _esc(cls) + '"';
    if (props.id) attrs += ' id="' + _esc(props.id) + '"';
    if (props.name) attrs += ' name="' + _esc(props.name) + '"';
    if (props.placeholder) attrs += ' placeholder="' + _esc(props.placeholder) + '"';
    if (props.value != null) attrs += ' value="' + _esc(props.value) + '"';
    if (props.disabled) attrs += ' disabled';
    if (props.readonly) attrs += ' readonly';
    if (props.required) attrs += ' required';
    if (props.maxlength) attrs += ' maxlength="' + props.maxlength + '"';
    if (props.min != null) attrs += ' min="' + props.min + '"';
    if (props.max != null) attrs += ' max="' + props.max + '"';
    if (props.step != null) attrs += ' step="' + props.step + '"';
    if (props.autocomplete) attrs += ' autocomplete="' + _esc(props.autocomplete) + '"';

    var inputHtml = '<input' + attrs + '>';

    if (props.icon) {
      inputHtml = '<div class="kair-v3-input-wrap">' + _icon(props.icon) + inputHtml + '</div>';
    }

    var hintHtml = '';
    if (props.error) hintHtml += '<span class="kair-v3-input-error">' + _esc(props.error) + '</span>';
    else if (props.hint) hintHtml += '<span class="kair-v3-input-hint">' + _esc(props.hint) + '</span>';

    return inputHtml + hintHtml;
  }

  function Textarea(props) {
    props = props || {};
    var cls = 'kair-v3-textarea' + (props.error ? ' kair-v3-textarea--error' : '');
    var attrs = ' class="' + _esc(cls) + '"';
    if (props.id) attrs += ' id="' + _esc(props.id) + '"';
    if (props.name) attrs += ' name="' + _esc(props.name) + '"';
    if (props.placeholder) attrs += ' placeholder="' + _esc(props.placeholder) + '"';
    if (props.disabled) attrs += ' disabled';
    if (props.readonly) attrs += ' readonly';
    if (props.required) attrs += ' required';
    if (props.maxlength) attrs += ' maxlength="' + props.maxlength + '"';
    if (props.rows) attrs += ' rows="' + props.rows + '"';
    var content = _esc(props.value || '');
    return '<textarea' + attrs + '>' + content + '</textarea>' +
      (props.error ? '<span class="kair-v3-input-error">' + _esc(props.error) + '</span>' :
       props.hint ? '<span class="kair-v3-input-hint">' + _esc(props.hint) + '</span>' : '');
  }

  /* ─── Select ────────────────────────────────────────────── */

  function SelectOption(opt) {
    if (typeof opt === 'string') opt = { value: opt, label: opt };
    var attrs = ' value="' + _esc(opt.value) + '"';
    if (opt.disabled) attrs += ' disabled';
    if (opt.selected) attrs += ' selected';
    return '<option' + attrs + '>' + _esc(opt.label) + '</option>';
  }

  function Select(props) {
    props = props || {};
    var attrs = ' class="kair-v3-select"';
    if (props.id) attrs += ' id="' + _esc(props.id) + '"';
    if (props.name) attrs += ' name="' + _esc(props.name) + '"';
    if (props.disabled) attrs += ' disabled';
    if (props.required) attrs += ' required';
    var optionsHtml = '';
    if (props.placeholder) {
      optionsHtml += '<option value="" disabled' + (props.value == null ? ' selected' : '') + '>' + _esc(props.placeholder) + '</option>';
    }
    (props.options || []).forEach(function (opt) {
      var o = typeof opt === 'string' ? { value: opt, label: opt } : opt;
      optionsHtml += SelectOption(Object.assign({}, o, { selected: String(o.value) === String(props.value) }));
    });
    return '<select' + attrs + '>' + optionsHtml + '</select>';
  }

  /* ─── Tabs ──────────────────────────────────────────────── */

  function Tabs(props) {
    props = props || {};
    var tabs = props.tabs || [];
    var active = props.active || tabs[0] && tabs[0].key;
    var nav = '<nav class="kair-v3-tabs" role="tablist">';
    tabs.forEach(function (t) {
      var cls = 'kair-v3-tab' + (t.key === active ? ' kair-v3-tab--active' : '');
      nav += '<button type="button" class="' + cls + '" role="tab" data-tab="' + _esc(t.key) + '"' +
        (t.icon ? ' data-icon="' + _esc(t.icon) + '"' : '') +
        (t.badge ? ' data-badge="' + _esc(t.badge) + '"' : '') +
        '>' + _icon(t.icon) + '<span>' + _esc(t.label) + '</span>' +
        (t.badge != null ? '<span class="kair-v3-tab__badge">' + _esc(t.badge) + '</span>' : '') +
        '</button>';
    });
    nav += '</nav>';
    return nav;
  }

  /* ─── Tooltip (simple, via title) ────────────────────────── */

  function Tooltip(text, children) {
    return '<span class="kair-v3-tooltip" title="' + _esc(text) + '">' + _renderChildren(children) + '</span>';
  }

  /* ─── EmptyState ────────────────────────────────────────── */

  function EmptyState(props) {
    props = props || {};
    var iconHtml = props.icon ? '<div class="kair-v3-empty__icon">' + _icon(props.icon) + '</div>' : '';
    var titleHtml = props.title ? '<h3 class="kair-v3-empty__title">' + _esc(props.title) + '</h3>' : '';
    var descHtml = props.description ? '<p class="kair-v3-empty__desc">' + _esc(props.description) + '</p>' : '';
    var actionHtml = props.action ? '<div class="kair-v3-empty__action">' + _renderChildren(props.action) + '</div>' : '';
    return '<div class="kair-v3-empty">' + iconHtml + titleHtml + descHtml + actionHtml + '</div>';
  }

  /* ─── Stack (alias de kair-v3-stack con children) ─────────── */

  function Stack(props) {
    props = props || {};
    var cls = 'kair-v3-stack' + (props.size && props.size !== 'default' ? ' kair-v3-stack--' + props.size : '');
    return '<div class="' + _esc(cls) + '">' + _renderChildren(props.children) + '</div>';
  }

  function Row(props) {
    props = props || {};
    var cls = 'kair-v3-row' + (props.justify === 'between' ? ' kair-v3-row--between' : '') +
                          (props.justify === 'end' ? ' kair-v3-row--end' : '');
    return '<div class="' + _esc(cls) + '">' + _renderChildren(props.children) + '</div>';
  }

  /* ═══════════════════════════════════════════════════════════════
     EXPORT
     ═══════════════════════════════════════════════════════════════ */

  window.KairUI = {
    /* Componentes */
    Card: Card,
    Button: Button,
    Badge: Badge,
    Dialog: Dialog,
    openDialog: openDialog,
    closeDialog: closeDialog,
    Input: Input,
    Textarea: Textarea,
    Select: Select,
    SelectOption: SelectOption,
    Tabs: Tabs,
    Tooltip: Tooltip,
    EmptyState: EmptyState,
    Stack: Stack,
    Row: Row,
    /* Helpers */
    icon: _icon,
    esc: _esc,
    el: _el,
    renderChildren: _renderChildren
  };
})();
