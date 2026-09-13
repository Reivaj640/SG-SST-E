/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Skeleton Helpers
   v1.0 · 2026-07-04 — Sistema centralizado de skeleton screens

   Genera HTML de esqueletos estructurales para mostrar mientras se
   cargan datos. Cada componente imita la forma del componente real
   para que la transición carga→datos se vea natural.

   USO BÁSICO:
     container.innerHTML = KairSkeleton.kpiStrip(4);
     // ... carga async ...
     container.innerHTML = renderRealData(data);

   CON HELPERS show/hide (recomendado):
     KairSkeleton.show(container, 'table', { rows: 12 });
     // ... carga async ...
     KairSkeleton.hide(container);
     container.innerHTML = renderRealData(data);

   COMPONENTES DISPONIBLES:
     kpiStrip(n)     → tira de N cards KPI (default 4)
     table(r,c)      → tabla con r filas y c columnas (default 8 filas)
     chartBars(n)    → chart de barras con n barras (default 12)
     chartDonut()    → donut + leyenda lateral
     filters(n)      → barra de N filtros (default 4)
     section(opts)   → header de sección (título + subtítulo + botón)
     form(n)         → formulario con N campos (default 6)
     detail(n)       → vista detalle con N items (default 5)
     list(n)         → lista genérica con N items (default 8)
     card(opts)      → card individual
     bar(opts)       → barrita individual (primitiva)
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Helpers internos ────────────────────────────────────────────

  function _esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Genera una barrita individual con variante opcional.
   * @param {object} opts - { variant, width, height, style }
   *   variant: 'text' | 'text-sm' | 'text-lg' | 'title' | 'number' | 'avatar' | 'button'
   *   width: '60%' | '120px' | etc.
   *   height: override de height
   *   style: estilos inline extra
   */
  function _bar(opts) {
    var o = opts || {};
    var variant = o.variant || 'text';
    var variantClass = variant === 'text' ? '' : ' ks-' + variant;
    var styleParts = [];

    if (o.width) styleParts.push('width:' + _esc(o.width));
    if (o.height) styleParts.push('height:' + _esc(o.height));
    if (o.style) styleParts.push(o.style);

    var styleAttr = styleParts.length ? ' style="' + styleParts.join(';') + '"' : '';
    return '<span class="ks-bar' + variantClass + '"' + styleAttr + '></span>';
  }

  /**
   * Genera un grupo de N barritas con stagger (cascada de delays).
   * @param {number} count - cantidad de barritas
   * @param {object} opts - { variant, widths: [], gap }
   */
  function _staggerGroup(count, opts) {
    var o = opts || {};
    var variant = o.variant || 'text';
    var widths = o.widths || [];
    var gap = o.gap || '8px';
    var html = '<span class="ks-stagger" style="display:flex;flex-direction:column;gap:' + gap + ';">';
    for (var i = 0; i < count; i++) {
      var w = widths[i] || (i === count - 1 ? '60%' : '100%');
      html += _bar({ variant: variant, width: w });
    }
    html += '</span>';
    return html;
  }

  // ─── Componentes públicos ────────────────────────────────────────

  /**
   * Tira de N cards KPI (icono + label + número + sublabel).
   * @param {number} count - cantidad de cards (default 4)
   */
  function kpiStrip(count) {
    var n = count || 4;
    var html = '<div class="ks-kpi-strip">';
    for (var i = 0; i < n; i++) {
      html +=
        '<div class="ks-kpi-card">' +
          _bar({ variant: 'avatar', style: 'width:48px;height:48px;border-radius:12px;flex-shrink:0;' }) +
          '<span class="ks-kpi-body">' +
            _bar({ variant: 'text-sm', width: '70%' }) +
            _bar({ variant: 'number' }) +
            _bar({ variant: 'text-sm', width: '50%' }) +
          '</span>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  /**
   * Tabla con header + filas.
   * @param {number} rows - cantidad de filas (default 8)
   * @param {number} cols - cantidad de columnas (default 6)
   */
  function table(rows, cols) {
    var r = rows || 8;
    var c = cols || 6;

    // Distribuir columnas: primera corta (id/checkbox), última corta (acción)
    var colWidths = [];
    for (var i = 0; i < c; i++) {
      if (i === 0) colWidths.push('80px');
      else if (i === c - 1) colWidths.push('100px');
      else if (i === c - 2) colWidths.push('120px');
      else colWidths.push('1fr');
    }
    var gridTemplate = colWidths.join(' ');

    var html = '<div class="ks-table">';

    // Header
    html += '<div class="ks-table__header" style="grid-template-columns:' + gridTemplate + ';">';
    for (var h = 0; h < c; h++) {
      var hWidth = h === 0 ? '60%' : (h === c - 1 ? '70%' : '90%');
      html += _bar({ variant: 'text-sm', width: hWidth, style: 'opacity:0.7;' });
    }
    html += '</div>';

    // Filas con stagger
    html += '<div class="ks-stagger">';
    for (var ri = 0; ri < r; ri++) {
      html += '<div class="ks-table__row" style="grid-template-columns:' + gridTemplate + ';">';
      for (var ci = 0; ci < c; ci++) {
        var cellWidth = ci === 0 ? '60%' : (ci === c - 1 ? '80%' : (ci === c - 2 ? '85%' : '95%'));
        html += _bar({ variant: 'text-sm', width: cellWidth, height: '14px' });
      }
      html += '</div>';
    }
    html += '</div>';

    html += '</div>';
    return html;
  }

  /**
   * Chart de barras (skeleton).
   * @param {number} bars - cantidad de barras (default 12, ej: 12 meses)
   */
  function chartBars(bars) {
    var n = bars || 12;
    // Generar alturas pseudo-aleatorias pero estables (para que no salte cada render)
    var heights = [];
    for (var i = 0; i < n; i++) {
      var seed = (i * 37 + 13) % 100;
      heights.push(30 + (seed % 65)); // entre 30% y 95%
    }

    var html = '<div class="ks-chart">';
    html += '<div class="ks-chart__header">' + _bar({ variant: 'text', width: '30%' }) + '</div>';
    html += '<div class="ks-chart__body ks-chart__body--bars">';
    for (var j = 0; j < n; j++) {
      html += '<span class="ks-bar" style="width:100%;height:' + heights[j] + '%;"></span>';
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  /**
   * Chart donut (skeleton con leyenda).
   */
  function chartDonut() {
    var html = '<div class="ks-chart">';
    html += '<div class="ks-chart__header">' + _bar({ variant: 'text', width: '30%' }) + '</div>';
    html += '<div class="ks-chart__body ks-chart__body--donut">';
    html += '<span class="ks-donut"></span>';
    html += '<span class="ks-donut-legend">' + _staggerGroup(4, { variant: 'text-sm', widths: ['85%', '70%', '90%', '60%'] }) + '</span>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  /**
   * Barra de filtros (N selects).
   * @param {number} count - cantidad de filtros (default 4)
   */
  function filters(count) {
    var n = count || 4;
    // Anchos variados para que parezca realista
    var widths = ['200px', '150px', '180px', '160px', '140px', '170px'];

    var html = '<div class="ks-filters">';
    for (var i = 0; i < n; i++) {
      var w = widths[i % widths.length];
      html += '<span class="ks-bar ks-text" style="width:' + w + ';height:36px;border-radius:8px;"></span>';
    }
    html += '</div>';
    return html;
  }

  /**
   * Header de sección (título + subtítulo + botón de acción).
   * @param {object} opts - { title: bool, subtitle: bool, button: bool }
   *   defaults: todo true
   */
  function section(opts) {
    var o = opts || {};
    var showTitle = o.title !== false;
    var showSubtitle = o.subtitle !== false;
    var showButton = o.button !== false;

    var html = '<div class="ks-section">';
    html += '<span class="ks-section__head">';
    if (showTitle) html += _bar({ variant: 'title' });
    if (showSubtitle) html += _bar({ variant: 'text', width: '40%', style: 'margin-top:8px;' });
    html += '</span>';
    if (showButton) {
      html += _bar({ variant: 'button' });
    }
    html += '</div>';
    return html;
  }

  /**
   * Formulario con N campos (label + input).
   * @param {number} fields - cantidad de campos (default 6)
   */
  function form(fields) {
    var n = fields || 6;
    var html = '<div class="ks-form">';
    for (var i = 0; i < n; i++) {
      html += '<span class="ks-form__field">';
      html += _bar({ variant: 'text-sm', width: '40%', style: 'height:12px;' });
      html += _bar({ variant: 'text', style: 'width:100%;height:38px;margin-top:6px;border-radius:8px;' });
      html += '</span>';
    }
    html += '</div>';
    return html;
  }

  /**
   * Vista detalle con N items (label: valor).
   * @param {number} items - cantidad de items (default 5)
   */
  function detail(items) {
    var n = items || 5;
    var html = '<div class="ks-detail">';
    for (var i = 0; i < n; i++) {
      html += '<span class="ks-detail__row">';
      html += _bar({ variant: 'text-sm', width: '30%', style: 'opacity:0.6;' });
      html += _bar({ variant: 'text', width: '60%' });
      html += '</span>';
    }
    html += '</div>';
    return html;
  }

  /**
   * Lista genérica con N items (avatar + 2 líneas).
   * @param {number} count - cantidad de items (default 8)
   */
  function list(count) {
    var n = count || 8;
    var html = '<div class="ks-list ks-stagger">';
    for (var i = 0; i < n; i++) {
      html +=
        '<span class="ks-list__item">' +
          _bar({ variant: 'avatar', style: 'width:36px;height:36px;flex-shrink:0;' }) +
          '<span class="ks-list__body">' +
            _bar({ variant: 'text', width: '70%' }) +
            _bar({ variant: 'text-sm', width: '50%', style: 'margin-top:4px;' }) +
          '</span>' +
        '</span>';
    }
    html += '</div>';
    return html;
  }

  /**
   * Card individual (imagen opcional + título + descripción + meta).
   * @param {object} opts - { image: bool, title: bool, desc: bool, meta: bool }
   */
  function card(opts) {
    var o = opts || {};
    var showImage = o.image !== false;
    var showTitle = o.title !== false;
    var showDesc = o.desc !== false;
    var showMeta = o.meta !== false;

    var html = '<div class="ks-card">';
    if (showImage) {
      html += _bar({ variant: 'avatar', style: 'width:100%;height:140px;border-radius:8px 8px 0 0;' });
    }
    html += '<span class="ks-card__body">';
    if (showTitle) html += _bar({ variant: 'text-lg', width: '70%' });
    if (showDesc) html += _bar({ variant: 'text', width: '95%', style: 'margin-top:8px;' });
    if (showDesc) html += _bar({ variant: 'text', width: '85%', style: 'margin-top:4px;' });
    if (showMeta) html += _bar({ variant: 'text-sm', width: '40%', style: 'margin-top:8px;opacity:0.6;' });
    html += '</span>';
    html += '</div>';
    return html;
  }

  /**
   * Inyecta un skeleton en un contenedor target.
   * @param {Element|string} target - elemento DOM o selector CSS
   * @param {string} component - nombre del componente ('kpiStrip', 'table', etc.)
   * @param {object} opts - opciones que se pasan al componente
   */
  function show(target, component, opts) {
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) {
      console.warn('[KairSkeleton] target no encontrado:', target);
      return;
    }
    var fn = _components[component];
    if (typeof fn !== 'function') {
      console.warn('[KairSkeleton] componente desconocido:', component);
      return;
    }
    // Guardar contenido original para poder restaurarlo (opcional)
    if (!el.dataset.ksPrev) {
      el.dataset.ksPrev = el.innerHTML;
    }
    el.innerHTML = '<div class="ks-skeleton-state">' + fn(opts || {}) + '</div>';
  }

  /**
   * Limpia el skeleton de un contenedor (lo deja vacío).
   */
  function hide(target) {
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    var inner = el.querySelector('.ks-skeleton-state');
    if (inner) inner.remove();
  }

  // Mapa de componentes para `show()`
  var _components = {
    kpiStrip: kpiStrip,
    table: table,
    chartBars: chartBars,
    chartDonut: chartDonut,
    filters: filters,
    section: section,
    form: form,
    detail: detail,
    list: list,
    card: card
  };

  // ─── API pública ─────────────────────────────────────────────────

  window.KairSkeleton = {
    // Primitivas
    bar: _bar,

    // Componentes
    kpiStrip: kpiStrip,
    table: table,
    chartBars: chartBars,
    chartDonut: chartDonut,
    filters: filters,
    section: section,
    form: form,
    detail: detail,
    list: list,
    card: card,

    // Helpers
    show: show,
    hide: hide,

    // Metadata
    version: '1.0.0',
    cssRequired: true  // Requiere las reglas .ks-* en styles.css
  };
})();