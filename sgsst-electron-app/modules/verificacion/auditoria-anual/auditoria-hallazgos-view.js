/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Submódulo 6.1.2 — Gestión de Hallazgos
   Vista Hallazgos — CRUD de hallazgos de auditoría
   ═══════════════════════════════════════════════════════════════════ */

var AuditoriaHallazgosView = (function () {
  'use strict';

  var _container = null;
  var _currentFilter = 'todos';

  function load(container) {
    _container = container;
    render();
  }

  function render() {
    var hallazgos = AuditoriaService.getHallazgos();
    var stats = AuditoriaService.getKpiStats();

    var filterHtml =
      '<div class="kair-aud-filters">' +
        '<button class="kair-aud-filter' + (_currentFilter === 'todos' ? ' kair-aud-filter--active' : '') + '" data-filter="todos">Todos (' + stats.totalHallazgos + ')</button>' +
        '<button class="kair-aud-filter' + (_currentFilter === 'abierto' ? ' kair-aud-filter--active' : '') + '" data-filter="abierto">Abiertos (' + stats.hallazgosAbiertos + ')</button>' +
        '<button class="kair-aud-filter' + (_currentFilter === 'critico' ? ' kair-aud-filter--active' : '') + '" data-filter="critico">Críticos (' + stats.hallazgosCriticos + ')</button>' +
        '<button class="kair-aud-filter' + (_currentFilter === 'cerrado' ? ' kair-aud-filter--active' : '') + '" data-filter="cerrado">Cerrados</button>' +
      '</div>';

    var filtered = hallazgos;
    if (_currentFilter === 'abierto') {
      filtered = hallazgos.filter(function (h) { return h.estado !== 'cerrado'; });
    } else if (_currentFilter === 'critico') {
      filtered = hallazgos.filter(function (h) { return h.severidad === 'critico'; });
    } else if (_currentFilter === 'cerrado') {
      filtered = hallazgos.filter(function (h) { return h.estado === 'cerrado'; });
    }

    var hallazgosHtml = filtered.map(function (h) {
      var estadoLabel = h.estado === 'cerrado' ? 'Cerrado' : h.estado === 'en-progreso' ? 'En Progreso' : 'Abierto';
      var estadoClass = h.estado === 'cerrado' ? 'kair-aud-status--completada' : h.estado === 'en-progreso' ? 'kair-aud-status--en-progreso' : 'kair-aud-status--programada';

      return '<div class="kair-aud-hallazgo-card">' +
        '<div class="kair-aud-hallazgo-card__severity kair-aud-hallazgo-card__severity--' + h.severidad + '"></div>' +
        '<div class="kair-aud-hallazgo-card__content">' +
          '<div class="kair-aud-hallazgo-card__header">' +
            '<span class="kair-aud-hallazgo-card__code">' + h.codigo + '</span>' +
            '<span class="kair-aud-status ' + estadoClass + '">' + estadoLabel + '</span>' +
          '</div>' +
          '<div class="kair-aud-hallazgo-card__desc">' + h.descripcion + '</div>' +
          '<div class="kair-aud-hallazgo-card__meta">' +
            '<span><i class="bi bi-person"></i> ' + h.responsable + '</span>' +
            '<span><i class="bi bi-calendar"></i> ' + formatDate(h.fechaDeteccion) + '</span>' +
            '<span class="kair-aud-severity kair-aud-severity--' + h.severidad + '">' + capitalize(h.severidad) + '</span>' +
          '</div>' +
          (h.accionCorrectiva ? '<div style="margin-top:0.5rem;padding:0.5rem 0.75rem;background:#f8f9fa;border-radius:6px;font-size:0.75rem;color:var(--kair-aud-text-muted);"><strong>Acción:</strong> ' + h.accionCorrectiva + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    _container.innerHTML =
      filterHtml +
      '<div class="kair-aud-hallazgos" id="kair-aud-hallazgos-list">' +
        (hallazgosHtml || '<div style="text-align:center;padding:3rem;color:#6c757d;"><i class="bi bi-check-circle" style="font-size:2rem;display:block;margin-bottom:0.5rem;"></i>No hay hallazgos para este filtro</div>') +
      '</div>';

    bindEvents();
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    var day = String(d.getDate()).padStart(2, '0');
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var year = d.getFullYear();
    return day + '/' + month + '/' + year;
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function bindEvents() {
    var filters = _container.querySelectorAll('.kair-aud-filter');
    filters.forEach(function (btn) {
      btn.addEventListener('click', function () {
        _currentFilter = btn.getAttribute('data-filter');
        render();
      });
    });
  }

  function destroy() {
    _container = null;
  }

  return { load: load, destroy: destroy };
})();

window.AuditoriaHallazgosView = AuditoriaHallazgosView;
