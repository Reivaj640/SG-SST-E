/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Submódulo 6.1.2 — Cronograma de Auditorías
   Vista Cronograma — Trimestres + Tabla K+AIR (Patrón 6.1.3)
   ═══════════════════════════════════════════════════════════════════ */

var AuditoriaCronogramaView = (function () {
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

  function render() {
    var auditorias = AuditoriaService.getAuditorias();
    var stats = AuditoriaService.getKpiStats();

    /* Toolbar: filtros + acción primaria */
    var filterHtml =
      '<div class="kair-aud-view__header">' +
        '<h2 class="kair-aud-section-title">Cronograma anual</h2>' +
        '<div class="kair-aud-view__actions">' +
          '<button class="k-btn k-btn-primary k-btn-sm" data-aud-action="nueva-auditoria">' +
            '<i class="bi bi-plus-lg"></i> Nueva auditoría' +
          '</button>' +
        '</div>' +
      '</div>';

    /* Distribución por trimestre (cards) */
    var trimestres = [
      { key: 'Q1', label: 'Trimestre 1', meses: ['Enero', 'Febrero', 'Marzo'], icon: 'bi-calendar3', color: 'primary' },
      { key: 'Q2', label: 'Trimestre 2', meses: ['Abril', 'Mayo', 'Junio'],     icon: 'bi-calendar3', color: 'info'    },
      { key: 'Q3', label: 'Trimestre 3', meses: ['Julio', 'Agosto', 'Septiembre'], icon: 'bi-calendar3', color: 'warning' },
      { key: 'Q4', label: 'Trimestre 4', meses: ['Octubre', 'Noviembre', 'Diciembre'], icon: 'bi-calendar3', color: 'success' }
    ];

    var cronogramaHtml = '<div class="kair-aud-card-grid">' + trimestres.map(function (t) {
      var audTrimestre = auditorias.filter(function (a) {
        if (_currentFilter !== 'todos' && a.estado !== _currentFilter) return false;
        return a.trimestre === t.key;
      });
      var completadas = audTrimestre.filter(function (a) { return a.estado === 'completada'; }).length;
      var totalMes = audTrimestre.length;
      var progCls = totalMes > 0 ? (completadas === totalMes ? 'success' : (completadas > 0 ? 'warning' : 'danger')) : '';
      var prog = totalMes > 0 ? Math.round(completadas * 100 / totalMes) : 0;

      return '<div class="kair-aud-submodule-card" data-trimestre="' + t.key + '">' +
        '<div class="kair-aud-submodule-card__head">' +
          '<div class="kair-aud-submodule-card__icon kair-aud-submodule-card__icon--' + t.color + '">' +
            '<i class="bi ' + t.icon + '"></i>' +
          '</div>' +
          '<div class="kair-aud-submodule-card__title-block">' +
            '<div class="kair-aud-submodule-card__format">' + t.key + ' · ' + t.meses.join(' · ') + '</div>' +
            '<h3 class="kair-aud-submodule-card__title">' + t.label + '</h3>' +
          '</div>' +
          '<i class="bi bi-chevron-right kair-aud-submodule-card__chev"></i>' +
        '</div>' +
        '<p class="kair-aud-submodule-card__desc">' +
          (totalMes > 0
            ? totalMes + ' auditoría' + (totalMes !== 1 ? 's' : '') + ' programada' + (totalMes !== 1 ? 's' : '') + ' · ' + completadas + ' completada' + (completadas !== 1 ? 's' : '')
            : 'Sin auditorías programadas en este trimestre.') +
        '</p>' +
        (totalMes > 0 ? '<div class="kair-aud-progress"><div class="kair-aud-progress__bar kair-aud-progress__bar--' + progCls + '" style="width:' + prog + '%"></div></div>' : '') +
        '<div class="kair-aud-submodule-card__divider"></div>' +
        '<div class="kair-aud-submodule-card__meta">' +
          '<span class="kair-aud-submodule-card__chip kair-aud-submodule-card__chip--' + (totalMes > 0 ? 'primary' : 'neutral') + '">' + totalMes + ' total</span>' +
          '<span class="kair-aud-submodule-card__chip kair-aud-submodule-card__chip--success">' + completadas + ' completadas</span>' +
          (totalMes - completadas > 0 ? '<span class="kair-aud-submodule-card__chip kair-aud-submodule-card__chip--warning">' + (totalMes - completadas) + ' pendientes</span>' : '') +
        '</div>' +
      '</div>';
    }).join('') + '</div>';

    /* Filtros (chip-style) */
    var filterChips =
      '<div class="kair-aud-table-card" style="margin-top:1rem;">' +
        '<div class="kair-aud-table-card__head">' +
          '<h3 class="kair-aud-table-card__title">Listado de auditorías</h3>' +
          '<div class="kair-aud-table-card__filters">' +
            '<button class="kair-aud-table-card__filter' + (_currentFilter === 'todos' ? ' kair-aud-table-card__filter--active' : '') + '" data-filter="todos">Todas (' + stats.total + ')</button>' +
            '<button class="kair-aud-table-card__filter' + (_currentFilter === 'completada' ? ' kair-aud-table-card__filter--active' : '') + '" data-filter="completada">Completadas (' + stats.completadas + ')</button>' +
            '<button class="kair-aud-table-card__filter' + (_currentFilter === 'en-progreso' ? ' kair-aud-table-card__filter--active' : '') + '" data-filter="en-progreso">En Progreso (' + stats.enProgreso + ')</button>' +
            '<button class="kair-aud-table-card__filter' + (_currentFilter === 'programada' ? ' kair-aud-table-card__filter--active' : '') + '" data-filter="programada">Programadas (' + stats.programadas + ')</button>' +
            '<button class="kair-aud-table-card__filter' + (_currentFilter === 'cancelada' ? ' kair-aud-table-card__filter--active' : '') + '" data-filter="cancelada">Canceladas (' + (stats.canceladas || 0) + ')</button>' +
          '</div>' +
        '</div>' +
        buildTableHtml(auditorias) +
      '</div>';

    _container.innerHTML = filterHtml + cronogramaHtml + filterChips;

    bindEvents();
  }

  function buildTableHtml(auditorias) {
    var filtered = auditorias;
    if (_currentFilter !== 'todos') {
      filtered = auditorias.filter(function (a) { return a.estado === _currentFilter; });
    }

    var rows = filtered.map(function (a) {
      var badgeCls = 'kair-aud-badge--' + (
        a.estado === 'completada' ? 'success' :
        a.estado === 'en-progreso' ? 'info' :
        a.estado === 'cancelada' ? 'neutral' : 'warning'
      );
      var estadoLabel = a.estado === 'completada' ? 'Completada' : a.estado === 'en-progreso' ? 'En Progreso' : a.estado === 'cancelada' ? 'Cancelada' : 'Programada';
      var calificacion = a.calificacion !== null && a.calificacion !== undefined ? a.calificacion + '%' : '—';
      var hallazgos = a.hallazgos !== undefined ? a.hallazgos : 0;

      return '<tr>' +
        '<td><span class="kair-aud-table__id">' + _esc(a.id) + '</span></td>' +
        '<td><div class="kair-aud-table__title">' + _esc(a.nombre) + '</div></td>' +
        '<td>' + _esc(a.tipo) + '</td>' +
        '<td>' + formatDate(a.fechaInicio) + ' → ' + formatDate(a.fechaFin) + '</td>' +
        '<td><span class="kair-aud-badge ' + badgeCls + '"><span class="dot"></span>' + estadoLabel + '</span></td>' +
        '<td>' + _esc(a.auditorLider || '—') + '</td>' +
        '<td style="text-align:center;">' + hallazgos + '</td>' +
        '<td style="text-align:center;">' + calificacion + '</td>' +
        '<td><div class="kair-aud-table__actions">' +
          '<button class="kair-aud-icon-btn" data-aud-action="editar" data-id="' + _esc(a.id) + '" title="Editar"><i class="bi bi-pencil"></i></button>' +
          '<button class="kair-aud-icon-btn kair-aud-icon-btn--danger" data-aud-action="eliminar" data-id="' + _esc(a.id) + '" title="Eliminar"><i class="bi bi-trash"></i></button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    if (!rows) {
      rows = '<tr><td colspan="9" class="kair-aud-table__empty">' +
        '<div>' +
          '<i class="bi bi-inbox"></i>' +
          '<h4 class="kair-aud-table__empty-title">Sin auditorías en este filtro</h4>' +
          '<p class="kair-aud-table__empty-desc">Haz clic en <strong>Nueva auditoría</strong> para crear la primera.</p>' +
        '</div>' +
        '</td></tr>';
    }

    return '<table class="kair-aud-table">' +
      '<thead><tr>' +
        '<th>ID</th><th>Nombre</th><th>Tipo</th><th>Período</th>' +
        '<th>Estado</th><th>Auditor Líder</th><th>Hallazgos</th><th>Calificación</th>' +
        '<th style="text-align:right;">Acciones</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table>';
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

    var accionNueva = _container.querySelector('[data-aud-action="nueva-auditoria"]');
    if (accionNueva) {
      accionNueva.addEventListener('click', function () {
        if (window.kairAuditoriaAnual) window.kairAuditoriaAnual.openAuditoriaForm(null);
      });
    }

    var acciones = _container.querySelectorAll('[data-aud-action]');
    acciones.forEach(function (btn) {
      var accion = btn.getAttribute('data-aud-action');
      if (accion !== 'nueva-auditoria') {
        var id = btn.getAttribute('data-id');
        if (accion === 'editar') {
          btn.addEventListener('click', function () {
            var aud = AuditoriaService.getAuditoriaById(id);
            if (aud && window.kairAuditoriaAnual) window.kairAuditoriaAnual.openAuditoriaForm(aud);
            else if (window.kairAuditoriaAnual) window.kairAuditoriaAnual.showToast('Auditoría no encontrada: ' + id, 'error');
          });
        } else if (accion === 'eliminar') {
          btn.addEventListener('click', function () {
            if (window.kairAuditoriaAnual) window.kairAuditoriaAnual.deleteAuditoria(id);
          });
        }
      }
    });
  }

  function destroy() {
    _container = null;
  }

  return { load: load, destroy: destroy };
})();

window.AuditoriaCronogramaView = AuditoriaCronogramaView;
