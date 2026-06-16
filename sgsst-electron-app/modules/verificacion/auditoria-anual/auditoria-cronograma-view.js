/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Submódulo 6.1.2 — Cronograma de Auditorías
   Vista Cronograma — Calendario por Trimestre
   ═══════════════════════════════════════════════════════════════════ */

var AuditoriaCronogramaView = (function () {
  'use strict';

  var _container = null;
  var _currentFilter = 'todos';

  function load(container) {
    _container = container;
    render();
  }

  function render() {
    var auditorias = AuditoriaService.getAuditorias();
    var stats = AuditoriaService.getKpiStats();

    var filterHtml =
      '<div class="kair-aud-filters">' +
        '<button class="kair-aud-filter' + (_currentFilter === 'todos' ? ' kair-aud-filter--active' : '') + '" data-filter="todos">Todas (' + stats.total + ')</button>' +
        '<button class="kair-aud-filter' + (_currentFilter === 'completada' ? ' kair-aud-filter--active' : '') + '" data-filter="completada">Completadas (' + stats.completadas + ')</button>' +
        '<button class="kair-aud-filter' + (_currentFilter === 'en-progreso' ? ' kair-aud-filter--active' : '') + '" data-filter="en-progreso">En Progreso (' + stats.enProgreso + ')</button>' +
        '<button class="kair-aud-filter' + (_currentFilter === 'programada' ? ' kair-aud-filter--active' : '') + '" data-filter="programada">Programadas (' + stats.programadas + ')</button>' +
      '</div>';

    var trimestres = [
      { key: 'Q1', label: 'Trimestre 1', meses: ['Enero', 'Febrero', 'Marzo'] },
      { key: 'Q2', label: 'Trimestre 2', meses: ['Abril', 'Mayo', 'Junio'] },
      { key: 'Q3', label: 'Trimestre 3', meses: ['Julio', 'Agosto', 'Septiembre'] },
      { key: 'Q4', label: 'Trimestre 4', meses: ['Octubre', 'Noviembre', 'Diciembre'] }
    ];

    var cronogramaHtml = trimestres.map(function (t) {
      var audTrimestre = auditorias.filter(function (a) {
        if (_currentFilter !== 'todos' && a.estado !== _currentFilter) return false;
        return a.trimestre === t.key;
      });

      var mesesHtml = t.meses.map(function (mes, idx) {
        var mesNum = idx + 1;
        var audMes = audTrimestre.filter(function (a) {
          var inicio = new Date(a.fechaInicio);
          var fin = new Date(a.fechaFin);
          return (inicio.getMonth() + 1 === mesNum) || (fin.getMonth() + 1 === mesNum);
        });
        return '<div class="kair-aud-cronograma__mes">' +
          '<span class="kair-aud-cronograma__mes-name">' + mes + '</span>' +
          '<span class="kair-aud-cronograma__mes-count">' + audMes.length + ' auditoría' + (audMes.length !== 1 ? 's' : '') + '</span>' +
        '</div>';
      }).join('');

      return '<div class="kair-aud-cronograma__trimestre">' +
        '<div class="kair-aud-cronograma__trimestre-header">' +
          '<span class="kair-aud-cronograma__trimestre-title">' + t.label + '</span>' +
          '<span class="kair-aud-cronograma__trimestre-badge">' + t.key + '</span>' +
        '</div>' +
        mesesHtml +
      '</div>';
    }).join('');

    var tableHtml = buildTableHtml(auditorias);

    _container.innerHTML =
      filterHtml +
      '<div class="kair-aud-cronograma__grid" style="margin-bottom:1rem;">' + cronogramaHtml + '</div>' +
      '<div class="kair-aud-table-wrapper">' + tableHtml + '</div>';

    bindEvents();
  }

  function buildTableHtml(auditorias) {
    var filtered = auditorias;
    if (_currentFilter !== 'todos') {
      filtered = auditorias.filter(function (a) { return a.estado === _currentFilter; });
    }

    var rows = filtered.map(function (a) {
      var statusClass = 'kair-aud-status--' + a.estado;
      var estadoLabel = a.estado === 'completada' ? 'Completada' : a.estado === 'en-progreso' ? 'En Progreso' : 'Programada';
      var calificacion = a.calificacion !== null ? a.calificacion + '%' : '—';

      return '<tr>' +
        '<td><strong>' + a.id + '</strong></td>' +
        '<td>' + a.nombre + '</td>' +
        '<td>' + a.tipo + '</td>' +
        '<td>' + formatDate(a.fechaInicio) + ' - ' + formatDate(a.fechaFin) + '</td>' +
        '<td><span class="kair-aud-status ' + statusClass + '">' + estadoLabel + '</span></td>' +
        '<td>' + a.auditorLider + '</td>' +
        '<td style="text-align:center;">' + a.hallazgos + '</td>' +
        '<td style="text-align:center;">' + calificacion + '</td>' +
      '</tr>';
    }).join('');

    return '<table class="kair-aud-table">' +
      '<thead><tr>' +
        '<th>ID</th><th>Nombre</th><th>Tipo</th><th>Período</th>' +
        '<th>Estado</th><th>Auditor Líder</th><th>Hallazgos</th><th>Calificación</th>' +
      '</tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="8" style="text-align:center;padding:2rem;color:#6c757d;">No hay auditorías para este filtro</td></tr>') + '</tbody>' +
    '</table>';
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr);
    var day = String(d.getDate()).padStart(2, '0');
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var year = d.getFullYear();
    return day + '/' + month + '/' + year;
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

window.AuditoriaCronogramaView = AuditoriaCronogramaView;
