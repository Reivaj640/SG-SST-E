/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Submódulo 6.1.2 — Gestión de Hallazgos
   Vista Hallazgos — Cards con border-left semántico por severidad
   ═══════════════════════════════════════════════════════════════════ */

var AuditoriaHallazgosView = (function () {
  'use strict';

  var _container = null;
  var _currentFilter = 'todos';

  function load(container) {
    _container = container;
    render();
  }

  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function render() {
    var hallazgos = AuditoriaService.getHallazgos();
    var stats = AuditoriaService.getKpiStats();

    /* Toolbar + filtros + CTA */
    var filterHtml =
      '<div class="kair-aud-view__header">' +
        '<h2 class="kair-aud-section-title">Gestión de hallazgos</h2>' +
        '<div class="kair-aud-view__actions">' +
          '<button class="k-btn k-btn-primary k-btn-sm" data-hal-action="nuevo">' +
            '<i class="bi bi-plus-lg"></i> Nuevo hallazgo' +
          '</button>' +
        '</div>' +
      '</div>';

    var filterChips =
      '<div class="kair-aud-table-card" style="margin-bottom:1rem;">' +
        '<div class="kair-aud-table-card__head">' +
          '<h3 class="kair-aud-table-card__title">Filtrar hallazgos</h3>' +
          '<div class="kair-aud-table-card__filters">' +
            '<button class="kair-aud-table-card__filter' + (_currentFilter === 'todos' ? ' kair-aud-table-card__filter--active' : '') + '" data-filter="todos">Todos (' + (stats.totalHallazgos || 0) + ')</button>' +
            '<button class="kair-aud-table-card__filter' + (_currentFilter === 'abierto' ? ' kair-aud-table-card__filter--active' : '') + '" data-filter="abierto">Abiertos (' + (stats.hallazgosAbiertos || 0) + ')</button>' +
            '<button class="kair-aud-table-card__filter' + (_currentFilter === 'critico' ? ' kair-aud-table-card__filter--active' : '') + '" data-filter="critico">Críticos (' + (stats.hallazgosCriticos || 0) + ')</button>' +
            '<button class="kair-aud-table-card__filter' + (_currentFilter === 'cerrado' ? ' kair-aud-table-card__filter--active' : '') + '" data-filter="cerrado">Cerrados</button>' +
          '</div>' +
        '</div>' +
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
      var estadoBadge = h.estado === 'cerrado' ? 'kair-aud-badge--success' :
                        h.estado === 'en-progreso' ? 'kair-aud-badge--info' :
                        'kair-aud-badge--warning';
      var estadoLabel = h.estado === 'cerrado' ? 'Cerrado' : h.estado === 'en-progreso' ? 'En Progreso' : 'Abierto';
      var sevBadge = h.severidad === 'critico' ? 'kair-aud-badge--danger' :
                     h.severidad === 'mayor'   ? 'kair-aud-badge--warning' :
                                                 'kair-aud-badge--info';
      var sevCls = h.severidad === 'critico' ? 'kair-aud-hallazgo-card--critico' :
                   h.severidad === 'mayor'   ? 'kair-aud-hallazgo-card--mayor' :
                                               'kair-aud-hallazgo-card--menor';

      return '<div class="kair-aud-hallazgo-card ' + sevCls + '" data-hal-id="' + _esc(h.id) + '">' +
        '<div class="kair-aud-hallazgo-card__head">' +
          '<div class="kair-aud-hallazgo-card__title-block">' +
            '<div class="kair-aud-hallazgo-card__codigo">' + _esc(h.codigo || h.id) + ' · Auditoría ' + _esc(h.auditoriaId) + '</div>' +
            '<h3 class="kair-aud-hallazgo-card__title">' + _esc(h.descripcion) + '</h3>' +
          '</div>' +
          '<div class="kair-aud-hallazgo-card__badges">' +
            '<span class="kair-aud-badge ' + sevBadge + '"><span class="dot"></span>' + _capitalize(h.severidad) + '</span>' +
            '<span class="kair-aud-badge ' + estadoBadge + '"><span class="dot"></span>' + estadoLabel + '</span>' +
          '</div>' +
        '</div>' +
        (h.accionCorrectiva ? '<div style="margin-top:0.5rem;padding:0.6rem 0.85rem;background:var(--aud-neutral-soft);border-radius:var(--aud-radius-sm);font-size:0.8125rem;color:var(--aud-text-muted);line-height:1.4;"><strong style="color:var(--aud-text-strong);">Acción correctiva:</strong> ' + _esc(h.accionCorrectiva) + '</div>' : '') +
        '<div class="kair-aud-hallazgo-card__meta">' +
          '<span class="kair-aud-hallazgo-card__meta-item"><i class="bi bi-person"></i> ' + _esc(h.responsable || '—') + '</span>' +
          '<span class="kair-aud-hallazgo-card__meta-item"><i class="bi bi-calendar"></i> Detección: ' + formatDate(h.fechaDeteccion) + '</span>' +
          (h.fechaCierre ? '<span class="kair-aud-hallazgo-card__meta-item"><i class="bi bi-check-circle"></i> Cierre: ' + formatDate(h.fechaCierre) + '</span>' : '') +
        '</div>' +
        '<div class="kair-aud-hallazgo-card__actions">' +
          '<button class="k-btn k-btn-ghost k-btn-sm" data-hal-action="editar" data-id="' + _esc(h.id) + '"><i class="bi bi-pencil"></i> Editar</button>' +
          '<button class="k-btn k-btn-ghost k-btn-sm" style="color:var(--aud-danger);" data-hal-action="eliminar" data-id="' + _esc(h.id) + '"><i class="bi bi-trash"></i> Eliminar</button>' +
        '</div>' +
      '</div>';
    }).join('');

    if (!hallazgosHtml) {
      hallazgosHtml =
        '<div class="kair-aud-placeholder">' +
          '<div class="kair-aud-placeholder__icon"><i class="bi bi-check-circle"></i></div>' +
          '<h3 class="kair-aud-placeholder__title">Sin hallazgos en este filtro</h3>' +
          '<p class="kair-aud-placeholder__desc">No se encontraron hallazgos que coincidan con el filtro seleccionado. Haz clic en <strong>Nuevo hallazgo</strong> para crear el primero.</p>' +
          '<span class="kair-aud-placeholder__phase">Fase 6.1.2 — Auditoría Anual</span>' +
        '</div>';
    }

    _container.innerHTML =
      filterHtml +
      filterChips +
      '<div class="kair-aud-card-grid">' + hallazgosHtml + '</div>';

    bindEvents();
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    var day = String(d.getDate()).padStart(2, '0');
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var year = d.getFullYear();
    return day + '/' + month + '/' + year;
  }

  function bindEvents() {
    var filters = _container.querySelectorAll('.kair-aud-table-card__filter');
    filters.forEach(function (btn) {
      btn.addEventListener('click', function () {
        _currentFilter = btn.getAttribute('data-filter');
        render();
      });
    });

    var btnNuevo = _container.querySelector('[data-hal-action="nuevo"]');
    if (btnNuevo) {
      btnNuevo.addEventListener('click', function () {
        if (window.kairAuditoriaAnual) window.kairAuditoriaAnual.openHallazgoForm(null);
      });
    }

    _container.querySelectorAll('[data-hal-action]').forEach(function (btn) {
      var accion = btn.getAttribute('data-hal-action');
      if (accion === 'nuevo') return;
      var id = btn.getAttribute('data-id');
      if (accion === 'editar') {
        btn.addEventListener('click', function () {
          var hallazgo = AuditoriaService.getHallazgos().find(function (h) { return h.id === id; });
          if (hallazgo && window.kairAuditoriaAnual) {
            window.kairAuditoriaAnual.openHallazgoForm(hallazgo);
          }
        });
      } else if (accion === 'eliminar') {
        btn.addEventListener('click', function () {
          if (window.kairAuditoriaAnual) window.kairAuditoriaAnual.deleteHallazgo(id);
        });
      }
    });
  }

  function destroy() {
    _container = null;
  }

  return { load: load, destroy: destroy };
})();

window.AuditoriaHallazgosView = AuditoriaHallazgosView;
