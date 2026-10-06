// modules/gestion-humana/shared/kpi-bar.js
// 📦720 · Helper compartido para barras de KPIs (patrón Programa de Capacitación)
// 📦749 · Cada KPI puede tener `onClick` para hacer la tarjeta interactiva.
//        Si está presente, la tarjeta se renderiza como <button> con cursor pointer
//        y se le da una clase extra `gh-kpi--clickable` para hover effects.
//
// Uso:
//   window.GHKPIBar.render(container, [
//     { icon: 'fa-calendar', color: '#174ea6', bg: '#e8f0fe', value: 19, label: 'Programadas' },
//     { icon: 'fa-check',    color: '#28a745', bg: '#d4edda', value: 2,  label: 'Realizadas', badge: { text: '11%', bg: '#d4edda', color: '#155724' }, onClick: function() { ... } },
//     ...
//   ]);
//
// Estilos en shared/kpi-bar.css (prefijo `gh-kpi-`).

window.GHKPIBar = {
  /**
   * Renderiza una barra de KPIs en el container.
   * @param {HTMLElement} container - Elemento donde se inyecta la barra
   * @param {Array<{icon, color, bg, value, label, badge?, onClick?}>} kpis - Array de KPIs
   * @param {Object} [opts] - { wrap: bool, className: string }
   */
  render: function (container, kpis, opts) {
    if (!container) return;
    opts = opts || {};
    var wrap = opts.wrap !== false;
    var className = opts.className || 'gh-kpi-bar';

    var html = '<div class="' + className + '">';
    kpis.forEach(function (kpi, idx) {
      if (idx > 0) html += '<div class="gh-kpi-sep" aria-hidden="true"></div>';
      var isClickable = typeof kpi.onClick === 'function';
      var tag = isClickable ? 'button' : 'div';
      var extraClass = isClickable ? ' gh-kpi--clickable' : '';
      var attrs = isClickable ? ' type="button" data-kpi-idx="' + idx + '"' : '';
      html += '<' + tag + ' class="gh-kpi' + extraClass + '"' + attrs + '>';
      html += '  <div class="gh-kpi__icon" style="background:' + (kpi.bg || '#f1f3f5') + ';">';
      html += '    <i class="fas ' + (kpi.icon || 'fa-chart-bar') + '" style="color:' + (kpi.color || '#174ea6') + ';"></i>';
      html += '  </div>';
      html += '  <div class="gh-kpi__text">';
      html += '    <div class="gh-kpi__value" style="color:' + (kpi.color || '#174ea6') + ';">' + (kpi.value == null ? '—' : kpi.value) + '</div>';
      html += '    <div class="gh-kpi__label">' + (kpi.label || '') + '</div>';
      html += '  </div>';
      if (kpi.badge && kpi.badge.text) {
        html += '<div class="gh-kpi__badge" style="background:' + (kpi.badge.bg || '#d4edda') + '; color:' + (kpi.badge.color || '#155724') + ';">' + kpi.badge.text + '</div>';
      }
      html += '</' + tag + '>';
    });
    html += '</div>';
    container.innerHTML = html;

    // 📦749 · Wirear los onClick (delegación de eventos, no inline)
    if (kpis.some(function (k) { return typeof k.onClick === 'function'; })) {
      container.querySelectorAll('.gh-kpi--clickable').forEach(function (el) {
        var idx = parseInt(el.getAttribute('data-kpi-idx'), 10);
        if (typeof kpis[idx].onClick === 'function') {
          el.addEventListener('click', kpis[idx].onClick);
        }
      });
    }
  },

  /**
   * Helper para formatear números en es-CO.
   */
  fmt: function (n) {
    if (n == null) return '—';
    return new Intl.NumberFormat('es-CO').format(n);
  }
};
