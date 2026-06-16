/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Submódulo 6.1.2 — Informe de Auditoría
   Vista Informe — Resumen ejecutivo y exportación
   ═══════════════════════════════════════════════════════════════════ */

var AuditoriaInformeView = (function () {
  'use strict';

  var _container = null;

  function load(container) {
    _container = container;
    render();
  }

  function render() {
    var stats = AuditoriaService.getKpiStats();
    var auditorias = AuditoriaService.getAuditorias();
    var hallazgos = AuditoriaService.getHallazgos();

    var hallazgosPorSeveridad = {
      critico: hallazgos.filter(function (h) { return h.severidad === 'critico'; }).length,
      mayor: hallazgos.filter(function (h) { return h.severidad === 'mayor'; }).length,
      menor: hallazgos.filter(function (h) { return h.severidad === 'menor'; }).length
    };

    var hallazgosPorEstado = {
      abierto: hallazgos.filter(function (h) { return h.estado === 'abierto'; }).length,
      enProgreso: hallazgos.filter(function (h) { return h.estado === 'en-progreso'; }).length,
      cerrado: hallazgos.filter(function (h) { return h.estado === 'cerrado'; }).length
    };

    _container.innerHTML =
      '<div class="kair-aud-informe">' +
        // Resumen General
        '<div class="kair-aud-informe__section">' +
          '<div class="kair-aud-informe__section-title"><i class="bi bi-bar-chart"></i> Resumen General</div>' +
          '<div class="kair-aud-informe__grid">' +
            statItem('bi-clipboard-check', '#e8f0fe', '#174ea6', stats.total, 'Total Auditorías') +
            statItem('bi-check-circle', '#d4edda', '#28a745', stats.completadas, 'Completadas') +
            statItem('bi-arrow-repeat', '#e8f0fe', '#174ea6', stats.enProgreso, 'En Progreso') +
            statItem('bi-calendar-event', '#fff3cd', '#ffc107', stats.programadas, 'Programadas') +
          '</div>' +
        '</div>' +
        // Hallazgos
        '<div class="kair-aud-informe__section">' +
          '<div class="kair-aud-informe__section-title"><i class="bi bi-exclamation-triangle"></i> Hallazgos</div>' +
          '<div class="kair-aud-informe__grid">' +
            statItem('bi-exclamation-octagon', '#f8d7da', '#dc3545', hallazgosPorSeveridad.critico, 'Críticos') +
            statItem('bi-exclamation-triangle', '#fff3cd', '#ffc107', hallazgosPorSeveridad.mayor, 'Mayores') +
            statItem('bi-info-circle', '#e2e3e5', '#6c757d', hallazgosPorSeveridad.menor, 'Menores') +
            statItem('bi-check-circle', '#d4edda', '#28a745', hallazgosPorEstado.cerrado, 'Cerrados') +
          '</div>' +
        '</div>' +
        // Calificación
        '<div class="kair-aud-informe__section">' +
          '<div class="kair-aud-informe__section-title"><i class="bi bi-trophy"></i> Calificación Promedio</div>' +
          '<div style="display:flex;align-items:center;gap:1.5rem;padding:1rem;">' +
            '<div style="width:80px;height:80px;border-radius:50%;background:' + getCalificacionColor(stats.calificacionProm) + '20;display:flex;align-items:center;justify-content:center;">' +
              '<span style="font-size:1.5rem;font-weight:700;color:' + getCalificacionColor(stats.calificacionProm) + ';">' + stats.calificacionProm + '%</span>' +
            '</div>' +
            '<div>' +
              '<div style="font-size:0.875rem;font-weight:600;color:var(--kair-aud-text);margin-bottom:0.25rem;">' + getCalificacionLabel(stats.calificacionProm) + '</div>' +
              '<div style="font-size:0.75rem;color:var(--kair-aud-text-muted);">Basado en ' + auditorias.filter(function (a) { return a.calificacion !== null; }).length + ' auditorías completadas</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        // Acciones
        '<div class="kair-aud-informe__section">' +
          '<div class="kair-aud-informe__section-title"><i class="bi bi-download"></i> Exportar Informe</div>' +
          '<div style="display:flex;gap:0.75rem;flex-wrap:wrap;">' +
            '<button class="kair-aud-btn kair-aud-btn--primary" onclick="AuditoriaInformeView.exportPDF()"><i class="bi bi-file-earmark-pdf"></i> Exportar PDF</button>' +
            '<button class="kair-aud-btn kair-aud-btn--ghost" onclick="AuditoriaInformeView.exportExcel()"><i class="bi bi-file-earmark-excel"></i> Exportar Excel</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function statItem(icon, bg, color, value, label) {
    return '<div class="kair-aud-informe__stat">' +
      '<div class="kair-aud-informe__stat-icon" style="background:' + bg + ';color:' + color + ';"><i class="bi ' + icon + '"></i></div>' +
      '<div>' +
        '<div class="kair-aud-informe__stat-value" style="color:' + color + ';">' + value + '</div>' +
        '<div class="kair-aud-informe__stat-label">' + label + '</div>' +
      '</div>' +
    '</div>';
  }

  function getCalificacionColor(cal) {
    if (cal >= 90) return '#28a745';
    if (cal >= 70) return '#ffc107';
    return '#dc3545';
  }

  function getCalificacionLabel(cal) {
    if (cal >= 90) return 'Excelente';
    if (cal >= 80) return 'Bueno';
    if (cal >= 70) return 'Aceptable';
    return 'Requiere Mejora';
  }

  function exportPDF() {
    alert('Exportando informe de auditoría en PDF...\n\nEl documento incluirá:\n• Resumen ejecutivo\n• Estado de auditorías\n• Análisis de hallazgos\n• Calificación promedio');
  }

  function exportExcel() {
    alert('Exportando datos de auditoría en Excel...\n\nSe generará un archivo con:\n• Lista de auditorías\n• Detalle de hallazgos\n• Estadísticas por trimestre');
  }

  function destroy() {
    _container = null;
  }

  return { load: load, destroy: destroy, exportPDF: exportPDF, exportExcel: exportExcel };
})();

window.AuditoriaInformeView = AuditoriaInformeView;
