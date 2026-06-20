/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Helpers (formatos, labels, badges)
   v3.0 · 2026-06-19
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── FECHAS ────────────────────────────────────────────────

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return iso; }
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso; }
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function daysBetween(isoA, isoB) {
    if (!isoA || !isoB) return null;
    var a = new Date(isoA);
    var b = new Date(isoB);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  }

  // ─── STATUS LABELS — K+AIR official semantics ─────────────

  var auditStatusLabel = {
    programada: 'Programada',
    en_curso: 'En curso',
    realizada: 'Realizada',
    vencida: 'Vencida',
    cancelada: 'Cancelada'
  };

  var auditStatusBadge = {
    programada: 'primary',
    en_curso: 'warning',
    realizada: 'success',
    vencida: 'danger',
    cancelada: 'neutral'
  };

  var hallazgoEstadoLabel = {
    abierta: 'Abierta',
    en_tratamiento: 'En tratamiento',
    verificada: 'Verificada',
    cerrada: 'Cerrada',
    vencida: 'Vencida'
  };

  var hallazgoEstadoBadge = {
    abierta: 'danger',
    en_tratamiento: 'warning',
    verificada: 'info',
    cerrada: 'success',
    vencida: 'danger'
  };

  var hallazgoTipoLabel = {
    NC: 'No conformidad',
    OM: 'Observación de mejora',
    OE: 'Oportunidad de mejora'
  };

  var hallazgoCriticidadLabel = {
    baja: 'Baja',
    media: 'Media',
    alta: 'Alta',
    critica: 'Crítica'
  };

  var hallazgoCriticidadBadge = {
    baja: 'info',
    media: 'primary',
    alta: 'warning',
    critica: 'danger'
  };

  var planAccionEstadoLabel = {
    pendiente: 'Pendiente',
    en_progreso: 'En progreso',
    verificada: 'Verificada',
    cerrada: 'Cerrada'
  };

  var planAccionEstadoBadge = {
    pendiente: 'neutral',
    en_progreso: 'warning',
    verificada: 'info',
    cerrada: 'success'
  };

  var cronogramaFaseLabel = {
    preparacion: 'Preparación auditoría interna',
    realizacion: 'Realización auditoría interna',
    plan_accion: 'Determinación plan de acción',
    implementacion: 'Implementación plan de acción'
  };

  var cronogramaFaseShort = {
    preparacion: 'Preparación',
    realizacion: 'Realización',
    plan_accion: 'Plan de acción',
    implementacion: 'Implementación'
  };

  var cronogramaItemStatusBadge = {
    pendiente: 'neutral',
    en_curso: 'warning',
    completado: 'success',
    vencido: 'danger'
  };

  var cronogramaItemStatusLabel = {
    pendiente: 'Pendiente',
    en_curso: 'En curso',
    completado: 'Completado',
    vencido: 'Vencido'
  };

  var procesoAuditStatusBadge = {
    pendiente: 'neutral',
    realizado: 'success',
    no_realizado: 'danger'
  };

  var procesoAuditStatusLabel = {
    pendiente: 'Pendiente',
    realizado: 'Realizado',
    no_realizado: 'No realizado'
  };

  var verificationTypeLabel = {
    documental: 'Documental',
    campo: 'Campo',
    documental_campo: 'Documental - Campo'
  };

  var auditTypeLabel = {
    interna: 'Auditoría interna',
    externa: 'Auditoría externa',
    seguimiento: 'Auditoría de seguimiento'
  };

  // ─── MONTHS — Spanish ─────────────────────────────────────

  var MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var MONTHS_SHORT_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // ─── PERFORMANCE COLOR — semáforo por porcentaje ──────────

  function performanceColor(pct) {
    if (pct >= 90) return 'success';
    if (pct >= 80) return 'warning';
    return 'danger';
  }

  function performanceTextColor(pct) {
    if (pct >= 90) return '#28a745';
    if (pct >= 80) return '#ffc107';
    return '#dc3545';
  }

  // ─── ID GENERATORS ───────────────────────────────────────

  function genId(prefix) {
    return (prefix || 'ID') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  // ─── STRING HELPERS ──────────────────────────────────────

  function truncate(str, max) {
    if (!str) return '';
    var s = String(str);
    return s.length > max ? s.substring(0, max) + '…' : s;
  }

  function pluralize(n, singular, plural) {
    return n === 1 ? singular : (plural || singular + 's');
  }

  // ─── EXPORT ──────────────────────────────────────────────

  window.KairHelpers = {
    /* Fechas */
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    todayISO: todayISO,
    daysBetween: daysBetween,
    /* Labels & badges */
    auditStatusLabel: auditStatusLabel,
    auditStatusBadge: auditStatusBadge,
    hallazgoEstadoLabel: hallazgoEstadoLabel,
    hallazgoEstadoBadge: hallazgoEstadoBadge,
    hallazgoTipoLabel: hallazgoTipoLabel,
    hallazgoCriticidadLabel: hallazgoCriticidadLabel,
    hallazgoCriticidadBadge: hallazgoCriticidadBadge,
    planAccionEstadoLabel: planAccionEstadoLabel,
    planAccionEstadoBadge: planAccionEstadoBadge,
    cronogramaFaseLabel: cronogramaFaseLabel,
    cronogramaFaseShort: cronogramaFaseShort,
    cronogramaItemStatusLabel: cronogramaItemStatusLabel,
    cronogramaItemStatusBadge: cronogramaItemStatusBadge,
    procesoAuditStatusLabel: procesoAuditStatusLabel,
    procesoAuditStatusBadge: procesoAuditStatusBadge,
    verificationTypeLabel: verificationTypeLabel,
    auditTypeLabel: auditTypeLabel,
    /* Meses */
    MONTHS_ES: MONTHS_ES,
    MONTHS_SHORT_ES: MONTHS_SHORT_ES,
    /* Performance */
    performanceColor: performanceColor,
    performanceTextColor: performanceTextColor,
    /* Util */
    genId: genId,
    truncate: truncate,
    pluralize: pluralize
  };
})();
