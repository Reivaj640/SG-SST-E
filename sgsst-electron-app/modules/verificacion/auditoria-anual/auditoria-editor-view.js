/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Editor view (replica EditorView.tsx del tar)
   Patrón C Workflow — header + tabs + secciones + sidebar + footer
   v3.0 · 2026-06-19
   ═══════════════════════════════════════════════════════════════════ */

var AuditoriaEditorView = (function () {
  'use strict';

  var TABS = [
    { id: 'plan',         label: 'Plan',              icon: 'clipboard-check',   count: null },
    { id: 'cronograma',   label: 'Cronograma',        icon: 'calendar3',         count: function (a) { return (a.cronograma || []).length; } },
    { id: 'ejecucion',    label: 'Ejecución',         icon: 'activity',          count: null },
    { id: 'desempeno',    label: 'Desempeño SGSST',   icon: 'bar-chart-fill',    count: null },
    { id: 'hallazgos',    label: 'Hallazgos',         icon: 'exclamation-triangle', count: function (a) { return (a.hallazgos || []).length; } },
    { id: 'plan_accion',  label: 'Plan de acción',    icon: 'check-square-fill', count: function (a) { return (a.planAccion || []).length; } },
    { id: 'informe',      label: 'Informe y firmas',  icon: 'file-earmark-text', count: null }
  ];

  function _esc(s) { return KairUI.esc(s); }
  function _fmtDate(iso) { return KairHelpers.formatDate(iso); }

  function _seccionCompletada(audit) {
    return {
      plan: (audit.procesos || []).length > 0 && (audit.objective || '').length > 0,
      cronograma: (audit.cronograma || []).length > 0,
      ejecucion: !!audit.fechaVisitaDocumental || !!audit.fechaCampo,
      desempeno: (audit.desempenoEtapas || []).length > 0,
      hallazgos: (audit.hallazgos || []).length > 0,
      plan_accion: (audit.planAccion || []).length > 0,
      informe: (audit.firmas || []).length > 0
    };
  }

  /* ─── HEADER + BANNER ────────────────────────────────── */

  function _renderHeader(audit, activeTab, completitud) {
    var progresoGlobal = Math.round((completitud.filter(Boolean).length / TABS.length) * 100);
    /* F16 (2026-06-20): Header estándar K+AIR · mismo patrón que HUB y 6.1.3.
       Las tabs salen del header y van en un nav separado (debajo del header)
       para que el header respete el estándar sin perder navegación. */
    var company = (window.KairMockData && window.KairMockData.ACTIVE_COMPANY && window.KairMockData.ACTIVE_COMPANY.nombre) || 'Empresa';
    return '<header class="k-module-header">' +
      '<div class="k-header-left">' +
        '<div class="k-header-title-group">' +
          '<div class="k-header-main-title">' +
            '<i class="bi bi-clipboard-check-fill"></i> ' +
            _esc(audit.code) +
          '</div>' +
          '<div class="k-header-breadcrumb">' +
            '<span>' + _esc(company) + '</span>' +
            '<i class="bi bi-chevron-right"></i>' +
            '<button type="button" data-back-module="1">Verificación</button>' +
            '<i class="bi bi-chevron-right"></i>' +
            '<button type="button" data-go-list="1">6.1.2 Auditoría Anual</button>' +
            '<i class="bi bi-chevron-right"></i>' +
            '<button type="button" data-go-hub="1">Gestión de Auditorías</button>' +
            '<i class="bi bi-chevron-right"></i>' +
            '<span class="k-breadcrumb-item active">' + _esc(audit.code) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="k-header-right">' +
        KairUI.Badge({ variant: KairHelpers.auditStatusBadge[audit.status] || 'neutral', dot: true, children: KairHelpers.auditStatusLabel[audit.status] || audit.status }) +
        '<span class="k-sync-badge k-sync-synced" title="Datos cargados">' +
          '<i class="bi bi-check-circle-fill"></i> Sincronizado' +
        '</span>' +
        '<button type="button" class="header-back-btn" data-go-hub="1" title="Volver al Hub">' +
          '<i class="bi bi-arrow-left"></i> Hub' +
        '</button>' +
        (audit.status === 'programada' || audit.status === 'en_curso'
          ? '<button type="button" class="k-btn k-btn-secondary k-btn-sm" id="kair-v3-editor-start" title="Marcar auditoría en curso">' +
              '<i class="bi bi-play-fill"></i> Marcar en curso' +
            '</button>'
          : '') +
        (audit.status !== 'realizada' && audit.status !== 'cancelada'
          ? '<button type="button" class="k-btn k-btn-success k-btn-sm" id="kair-v3-editor-finish" title="Finalizar auditoría">' +
              '<i class="bi bi-check-circle-fill"></i> Finalizar' +
            '</button>'
          : '') +
      '</div>' +
    '</header>' +
    /* Tabs del editor · fuera del header, en nav propio */
    '<nav class="kair-v3-editor-tabs" role="tablist">' +
      TABS.map(function (t) {
        var active = activeTab === t.id;
        var count = t.count ? t.count(audit) : null;
        return '<button type="button" class="kair-v3-tab' + (active ? ' kair-v3-tab--active' : '') + '" data-set-tab="' + t.id + '">' +
          '<i class="bi bi-' + t.icon + '"></i>' +
          '<span>' + t.label + '</span>' +
          (count != null ? '<span class="kair-v3-tab__badge">' + count + '</span>' : '') +
        '</button>';
      }).join('') +
    '</nav>';
  }

  /* ─── BANNER DE ESTADO ───────────────────────────────── */

  function _renderBanner(audit, completitud) {
    var progresoGlobal = Math.round((completitud.filter(Boolean).length / TABS.length) * 100);
    var status = audit.status;
    var colorMap = {
      vencida: { bg: '#f8d7da', border: '#dc3545', icon: 'exclamation-triangle-fill', iconColor: '#dc3545' },
      realizada: { bg: '#d4edda', border: '#28a745', icon: 'check-circle-fill', iconColor: '#28a745' },
      en_curso: { bg: '#fff3cd', border: '#ffc107', icon: 'clock-fill', iconColor: '#856404' },
      programada: { bg: '#e8f0fe', border: '#174ea6', icon: 'clipboard-check-fill', iconColor: '#174ea6' }
    };
    var c = colorMap[status] || colorMap.programada;

    return '<div class="kair-v3-editor-banner" style="background:' + c.bg + ';border-color:' + c.border + ';">' +
      '<div class="kair-v3-editor-banner__left">' +
        '<div class="kair-v3-editor-banner__icon" style="color:' + c.iconColor + ';"><i class="bi bi-' + c.icon + '"></i></div>' +
        '<div>' +
          '<div class="kair-v3-editor-banner__title">' + _esc(audit.process || '—') + '</div>' +
          '<div class="kair-v3-editor-banner__sub">' + _esc(KairHelpers.auditTypeLabel[audit.auditType] || audit.auditType) + ' · ' + audit.year + ' · Auditor líder: ' + _esc(audit.auditorLider) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="kair-v3-editor-banner__right">' +
        '<div class="kair-v3-editor-banner__prog">' +
          '<div class="kair-v3-editor-banner__prog-label">Progreso</div>' +
          '<div class="kair-v3-editor-banner__prog-value">' + progresoGlobal + '%</div>' +
        '</div>' +
        '<div class="kair-v3-progress" style="width:120px;">' +
          '<div class="kair-v3-progress__bar' + (progresoGlobal === 100 ? ' kair-v3-progress__bar--success' : '') + '" style="width:' + progresoGlobal + '%"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ─── SIDEBAR ────────────────────────────────────────── */

  function _renderSidebar(audit, activeTab, completitud) {
    var completadas = completitud.filter(Boolean).length;
    var progreso = Math.round((completadas / TABS.length) * 100);
    var hTotal = (audit.hallazgos || []).length;
    var hCerrados = (audit.hallazgos || []).filter(function (h) { return h.estado === 'cerrada'; }).length;
    var hVencidos = (audit.hallazgos || []).filter(function (h) { return h.estado === 'vencida'; }).length;

    return '<aside class="kair-v3-editor-sidebar">' +
      '<div class="kair-v3-editor-sidebar__section">' +
        '<h4 class="kair-v3-editor-sidebar__title">Secciones</h4>' +
        '<nav class="kair-v3-side-nav">' +
          TABS.map(function (tab) {
            var active = activeTab === tab.id;
            var done = completitud[TABS.indexOf(tab)];
            var count = tab.count ? tab.count(audit) : null;
            return '<button type="button" class="kair-v3-side-nav__item' + (active ? ' kair-v3-side-nav__item--active' : '') + '" data-set-tab="' + tab.id + '">' +
              '<i class="bi bi-' + tab.icon + '"></i>' +
              '<span>' + tab.label + '</span>' +
              (count > 0 ? '<span class="kair-v3-side-nav__count">' + count + '</span>' : '') +
              (done ? '<i class="bi bi-check-circle-fill kair-v3-side-nav__check"></i>' : '') +
            '</button>';
          }).join('') +
        '</nav>' +
      '</div>' +
      '<div class="kair-v3-editor-sidebar__section kair-v3-editor-sidebar__progress-card">' +
        '<div class="kair-v3-row kair-v3-row--between">' +
          '<span class="kair-v3-editor-sidebar__label">Completitud</span>' +
          '<span class="kair-v3-editor-sidebar__count-strong">' + completadas + '/' + TABS.length + '</span>' +
        '</div>' +
        '<div class="kair-v3-progress">' +
          '<div class="kair-v3-progress__bar' + (progreso === 100 ? ' kair-v3-progress__bar--success' : '') + '" style="width:' + progreso + '%"></div>' +
        '</div>' +
        '<p class="kair-v3-editor-sidebar__hint">' + (progreso === 100 ? 'Auditoría completa' : 'Completa las secciones para finalizar') + '</p>' +
      '</div>' +
      '<div class="kair-v3-editor-sidebar__section">' +
        '<h4 class="kair-v3-editor-sidebar__title">Datos de la auditoría</h4>' +
        '<ul class="kair-v3-side-data">' +
          '<li><i class="bi bi-building"></i><span>' + _esc(audit.empresa) + '</span></li>' +
          '<li><i class="bi bi-person"></i><span>' + _esc(audit.auditorLider) + '</span></li>' +
          '<li><i class="bi bi-calendar"></i><span>Programada: ' + _esc(_fmtDate(audit.fechaProgramada)) + '</span></li>' +
          (audit.fechaEntrega ? '<li><i class="bi bi-check-circle"></i><span>Entregada: ' + _esc(_fmtDate(audit.fechaEntrega)) + '</span></li>' : '') +
        '</ul>' +
      '</div>' +
      (hTotal > 0
        ? '<div class="kair-v3-editor-sidebar__section kair-v3-editor-sidebar__hallazgos-card" style="background:' + (hVencidos > 0 ? '#f8d7da' : '#fff3cd') + ';">' +
            '<div class="kair-v3-row">' +
              '<i class="bi bi-exclamation-triangle-fill" style="color:' + (hVencidos > 0 ? '#dc3545' : '#856404') + ';"></i>' +
              '<span class="kair-v3-editor-sidebar__label">HALLAZGOS</span>' +
            '</div>' +
            '<div class="kair-v3-row" style="margin-top:0.5rem;">' +
              '<div><div style="font:700 1.25rem/1 var(--v3-font-sans);color:var(--v3-foreground);">' + hTotal + '</div><div class="kair-v3-editor-sidebar__label">Total</div></div>' +
              '<div><div style="font:700 1.25rem/1 var(--v3-font-sans);color:' + (hVencidos > 0 ? '#dc3545' : '#28a745') + ';">' + hCerrados + '</div><div class="kair-v3-editor-sidebar__label">Cerrados</div></div>' +
            '</div>' +
          '</div>'
        : '') +
    '</aside>';
  }

  /* ─── SECCIONES ──────────────────────────────────────── */

  function _renderPlanSection(audit) {
    return '<div class="kair-v3-section-stack">' +
      _renderSectionCard('Objetivo, alcance y criterio', 'bullseye', [
        { label: 'Objetivo de la auditoría', value: audit.objective, full: true },
        { label: 'Alcance', value: audit.alcance },
        { label: 'Criterio de cumplimiento', value: audit.criterio },
        { label: 'Metodología', value: audit.metodologia, full: true },
        { label: 'Participación COPASST / Vigía', value: audit.participacionCopasst, full: true }
      ], 'GI-FO-035') +
      _renderSectionCard('Equipo auditor y auditados', 'people-fill', [
        { label: 'Auditor líder', value: '<div class="kair-v3-row"><div class="kair-v3-avatar">' + (audit.auditorLider || '?').charAt(0) + '</div><div><div style="font-weight:600;">' + _esc(audit.auditorLider) + '</div><div style="font-size:0.75rem;color:var(--v3-muted-foreground);">Auditor líder</div></div></div>' },
        { label: 'Personal auditado', value: '<div class="kair-v3-stack kair-v3-stack--sm">' +
          (audit.auditados || []).map(function (a) { return '<div class="kair-v3-row">' + _esc(a) + '</div>'; }).join('') +
        '</div>' }
      ]) +
      _renderProcesosSection(audit) +
    '</div>';
  }

  function _renderSectionCard(title, icon, fields, badge) {
    return '<section class="kair-v3-section-card">' +
      '<header class="kair-v3-section-card__head">' +
        '<h3 class="kair-v3-section-card__title"><i class="bi bi-' + icon + '"></i> ' + _esc(title) + '</h3>' +
        (badge ? KairUI.Badge({ variant: 'info', children: badge }) : '') +
      '</header>' +
      '<div class="kair-v3-section-card__body kair-v3-grid kair-v3-grid--2">' +
        fields.map(function (f) {
          return '<div class="kair-v3-field' + (f.full ? ' kair-v3-field--full' : '') + '">' +
            '<label class="kair-v3-field__label">' + _esc(f.label) + '</label>' +
            (typeof f.value === 'string' && f.value.indexOf('<') === -1
              ? '<p class="kair-v3-field__text">' + _esc(f.value) + '</p>'
              : '<div class="kair-v3-field__text">' + (f.value || '—') + '</div>') +
          '</div>';
        }).join('') +
      '</div>' +
    '</section>';
  }

  function _renderProcesosSection(audit) {
    var procesos = audit.procesos || [];
    if (procesos.length === 0) {
      return '<section class="kair-v3-section-card">' +
        '<header class="kair-v3-section-card__head">' +
          '<h3 class="kair-v3-section-card__title"><i class="bi bi-list-check"></i> Procesos a auditar (GI-FO-035)</h3>' +
        '</header>' +
        '<div class="kair-v3-section-card__body">' +
          KairUI.EmptyState({ icon: 'inbox', title: 'Sin procesos registrados', description: 'Esta auditoría aún no tiene procesos cargados. Se cargarán desde el Excel GI-FO-035.' }) +
        '</div>' +
      '</section>';
    }
    return '<section class="kair-v3-section-card">' +
      '<header class="kair-v3-section-card__head">' +
        '<h3 class="kair-v3-section-card__title"><i class="bi bi-list-check"></i> Procesos a auditar (GI-FO-035)</h3>' +
        KairUI.Badge({ variant: 'info', children: procesos.length + ' procesos' }) +
      '</header>' +
      '<div class="kair-v3-section-card__body">' +
        '<div class="kair-v3-table-card">' +
          '<table class="kair-v3-table" style="min-width:700px;">' +
            '<thead><tr>' +
              '<th>Proceso</th>' +
              '<th>Auditado</th>' +
              '<th>Auditor</th>' +
              '<th>Requisitos</th>' +
              '<th>Fecha</th>' +
              '<th>Estado</th>' +
            '</tr></thead>' +
            '<tbody>' +
              procesos.map(function (p) {
                return '<tr>' +
                  '<td><div style="font-weight:600;">' + _esc(p.proceso) + '</div></td>' +
                  '<td>' + _esc(p.auditado || '—') + '</td>' +
                  '<td>' + _esc(p.auditor || '—') + '</td>' +
                  '<td style="font-size:0.75rem;color:var(--v3-muted-foreground);">' + _esc(p.requisitos || '—') + '</td>' +
                  '<td>' + _esc(_fmtDate(p.fecha)) + '</td>' +
                  '<td>' + KairUI.Badge({ variant: KairHelpers.procesoAuditStatusBadge[p.estado] || 'neutral', children: KairHelpers.procesoAuditStatusLabel[p.estado] || p.estado }) + '</td>' +
                '</tr>';
              }).join('') +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function _renderHallazgosSection(audit) {
    var hallazgos = audit.hallazgos || [];
    if (hallazgos.length === 0) {
      return '<div class="kair-v3-section-stack">' +
        _renderHallazgosHeader(audit, hallazgos) +
        '<div class="kair-v3-section-card">' +
          '<div class="kair-v3-section-card__body">' +
            KairUI.EmptyState({
              icon: 'shield-check',
              title: 'Sin hallazgos registrados',
              description: 'Esta auditoría no tiene hallazgos documentados. Cuando se detecten no conformidades durante la ejecución, aparecerán aquí.'
            }) +
          '</div>' +
        '</div>' +
      '</div>';
    }

    return '<div class="kair-v3-section-stack">' +
      _renderHallazgosHeader(audit, hallazgos) +
      '<div class="kair-v3-stack">' +
        hallazgos.map(function (h) {
          var sevClass = h.criticidad === 'critica' ? 'kair-v3-hallazgo-card--critica' :
                         h.criticidad === 'alta' ? 'kair-v3-hallazgo-card--alta' :
                         h.criticidad === 'media' ? 'kair-v3-hallazgo-card--media' :
                         'kair-v3-hallazgo-card--baja';
          return '<div class="kair-v3-hallazgo-card ' + sevClass + '">' +
            '<div class="kair-v3-hallazgo-card__head">' +
              '<div>' +
                '<div class="kair-v3-hallazgo-card__codigo">' + _esc(h.componente || '—') + ' · ' + _esc(h.id) + '</div>' +
                '<h4 class="kair-v3-hallazgo-card__title">' + _esc(KairHelpers.hallazgoTipoLabel[h.tipo] || h.tipo) + '</h4>' +
              '</div>' +
              '<div class="kair-v3-row">' +
                KairUI.Badge({ variant: KairHelpers.hallazgoCriticidadBadge[h.criticidad] || 'neutral', children: KairHelpers.hallazgoCriticidadLabel[h.criticidad] || h.criticidad }) +
                KairUI.Badge({ variant: KairHelpers.hallazgoEstadoBadge[h.estado] || 'neutral', dot: true, children: KairHelpers.hallazgoEstadoLabel[h.estado] || h.estado }) +
              '</div>' +
            '</div>' +
            '<p class="kair-v3-hallazgo-card__desc">' + _esc(h.descripcion) + '</p>' +
            (h.evidencia ? '<div class="kair-v3-hallazgo-card__evidencia"><strong>Evidencia:</strong> ' + _esc(h.evidencia) + '</div>' : '') +
            '<div class="kair-v3-hallazgo-card__meta">' +
              '<span><i class="bi bi-calendar"></i> Detectado: ' + _esc(_fmtDate(h.fechaDeteccion)) + '</span>' +
              (h.fechaCompromisoCierre ? '<span><i class="bi bi-flag"></i> Compromiso: ' + _esc(_fmtDate(h.fechaCompromisoCierre)) + '</span>' : '') +
              (h.fechaCierreReal ? '<span><i class="bi bi-check-circle"></i> Cerrado: ' + _esc(_fmtDate(h.fechaCierreReal)) + '</span>' : '') +
            '</div>' +
            (h.estado !== 'cerrada' && h.estado !== 'verificada'
              ? '<div class="kair-v3-hallazgo-card__actions">' +
                  KairUI.Button({
                    size: 'sm', variant: 'secondary', icon: 'check-circle',
                    label: 'Marcar verificado', dataAttrs: { 'mark-verified': h.id }
                  }) +
                  KairUI.Button({
                    size: 'sm', variant: 'success', icon: 'check2-circle',
                    label: 'Cerrar hallazgo', dataAttrs: { 'mark-closed': h.id }
                  }) +
                '</div>'
              : '') +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  function _renderHallazgosHeader(audit, hallazgos) {
    var stats = {
      total: hallazgos.length,
      criticas: hallazgos.filter(function (h) { return h.criticidad === 'critica'; }).length,
      abiertas: hallazgos.filter(function (h) { return h.estado === 'abierta'; }).length,
      enTratamiento: hallazgos.filter(function (h) { return h.estado === 'en_tratamiento'; }).length,
      cerradas: hallazgos.filter(function (h) { return h.estado === 'cerrada'; }).length
    };
    return '<div class="kair-v3-kpi-strip" style="grid-template-columns:repeat(5, 1fr);">' +
      '<div class="kair-v3-kpi kair-v3-kpi--primary"><div class="kair-v3-kpi__icon"><i class="bi bi-exclamation-triangle"></i></div><div class="kair-v3-kpi__content"><div class="kair-v3-kpi__value">' + stats.total + '</div><div class="kair-v3-kpi__label">Total</div></div></div>' +
      '<div class="kair-v3-kpi kair-v3-kpi--danger"><div class="kair-v3-kpi__icon"><i class="bi bi-exclamation-octagon"></i></div><div class="kair-v3-kpi__content"><div class="kair-v3-kpi__value">' + stats.criticas + '</div><div class="kair-v3-kpi__label">Críticas</div></div></div>' +
      '<div class="kair-v3-kpi kair-v3-kpi--danger"><div class="kair-v3-kpi__icon"><i class="bi bi-exclamation-diamond"></i></div><div class="kair-v3-kpi__content"><div class="kair-v3-kpi__value">' + stats.abiertas + '</div><div class="kair-v3-kpi__label">Abiertas</div></div></div>' +
      '<div class="kair-v3-kpi kair-v3-kpi--warning"><div class="kair-v3-kpi__icon"><i class="bi bi-arrow-repeat"></i></div><div class="kair-v3-kpi__content"><div class="kair-v3-kpi__value">' + stats.enTratamiento + '</div><div class="kair-v3-kpi__label">En tratamiento</div></div></div>' +
      '<div class="kair-v3-kpi kair-v3-kpi--success"><div class="kair-v3-kpi__icon"><i class="bi bi-check-circle"></i></div><div class="kair-v3-kpi__content"><div class="kair-v3-kpi__value">' + stats.cerradas + '</div><div class="kair-v3-kpi__label">Cerradas</div></div></div>' +
    '</div>';
  }

  function _renderPlaceholderSection(title, icon, desc) {
    return '<div class="kair-v3-section-card">' +
      '<div class="kair-v3-section-card__body">' +
        KairUI.EmptyState({
          icon: icon,
          title: title,
          description: desc
        }) +
      '</div>' +
    '</div>';
  }

  function _renderSection(audit, activeTab) {
    switch (activeTab) {
      case 'plan':         return _renderPlanSection(audit);
      case 'cronograma':   return _renderPlaceholderSection('Cronograma', 'calendar3', 'La vista detallada del cronograma anual se implementa en F7. Por ahora se muestran ' + ((audit.cronograma || []).length) + ' hitos.');
      case 'ejecucion':    return _renderPlaceholderSection('Ejecución', 'activity', 'Documentación de visita documental/campo. Se implementa en F8.');
      case 'desempeno':    return _renderPlaceholderSection('Desempeño SGSST', 'bar-chart-fill', 'Resultados por etapa y componente del SG-SST. Se implementa en F8.');
      case 'hallazgos':    return _renderHallazgosSection(audit);
      case 'plan_accion':  return _renderPlaceholderSection('Plan de acción', 'check-square-fill', 'Planes derivados de hallazgos. Se implementa en F8.');
      case 'informe':      return _renderPlaceholderSection('Informe y firmas', 'file-earmark-text', 'Generación del informe y registro de firmas. Se implementa en F8.');
      default:            return _renderPlanSection(audit);
    }
  }

  /* ─── FOOTER ──────────────────────────────────────────── */

  function _renderFooter(audit) {
    return '<footer class="kair-v3-editor-footer">' +
      '<div class="kair-v3-row">' +
        KairUI.Button({ id: 'kair-v3-editor-close', variant: 'ghost', size: 'sm', icon: 'x-lg', label: 'Cerrar' }) +
        '<span style="font-size:0.75rem;color:var(--v3-muted-foreground);">Última actualización: ' + _esc(_fmtDate(audit.updatedAt)) + '</span>' +
      '</div>' +
      '<div class="kair-v3-row">' +
        KairUI.Button({ id: 'kair-v3-editor-save', variant: 'secondary', size: 'sm', icon: 'save', label: 'Guardar borrador' }) +
        (audit.status !== 'realizada'
          ? KairUI.Button({ id: 'kair-v3-editor-finish-footer', variant: 'success', size: 'sm', icon: 'check-circle-fill', label: 'Finalizar auditoría' })
          : '') +
      '</div>' +
    '</footer>';
  }

  /* ─── RENDER PRINCIPAL ───────────────────────────────── */

  function render(container) {
    var state = KairStore.getState();
    var auditId = state.activeAuditId;
    var activeTab = state.activeTab || 'plan';
    var audit = KairStore.selectAuditById(auditId);

    if (!audit) {
      container.innerHTML = KairUI.EmptyState({
        icon: 'exclamation-triangle',
        title: 'Auditoría no encontrada',
        description: 'No se encontró la auditoría solicitada. Vuelve al hub para seleccionar otra.'
      });
      return;
    }

    var completitud = _seccionCompletada(audit);
    var completitudArr = TABS.map(function (t) { return completitud[t.id]; });

    container.innerHTML =
      '<div class="kair-v3-editor">' +
        _renderHeader(audit, activeTab, completitudArr) +
        '<div class="kair-v3-editor-body">' +
          '<main class="kair-v3-editor-main">' +
            _renderBanner(audit, completitudArr) +
            _renderSection(audit, activeTab) +
          '</main>' +
          _renderSidebar(audit, activeTab, completitudArr) +
        '</div>' +
        _renderFooter(audit) +
      '</div>';

    _bindEvents(container, audit, activeTab);
  }

  function _bindEvents(container, audit, activeTab) {
    /* F16: Volver al Hub (data-go-hub) */
    var goHubBtns = container.querySelectorAll('[data-go-hub]');
    goHubBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        KairStore.actions.goHub();
        if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
          window.kairAuditoriaAnual._refreshView();
        }
      });
    });
    /* F16: Ir a la lista de auditorías (data-go-list) */
    var goListBtns = container.querySelectorAll('[data-go-list]');
    goListBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        KairStore.actions.goList();
        if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
          window.kairAuditoriaAnual._refreshView();
        }
      });
    });
    /* F17: breadcrumb "Verificación" → regresa al módulo padre */
    var backModuleBtns = container.querySelectorAll('[data-back-module]');
    backModuleBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var inst = window.__kairAudInstance;
        if (inst && typeof inst.backToModuleCallback === 'function') {
          inst.backToModuleCallback();
        }
      });
    });

    /* Tabs (header y sidebar) */
    container.querySelectorAll('[data-set-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-set-tab');
        KairStore.actions.setTab(tab);
        KairStore.actions.goEditor(audit.id, tab);
        if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
          window.kairAuditoriaAnual._refreshView();
        }
      });
    });

    /* Acciones del header */
    var startBtn = document.getElementById('kair-v3-editor-start');
    if (startBtn) startBtn.addEventListener('click', function () {
      KairStore.actions.updateAuditStatus(audit.id, 'en_curso');
      if (window.updateNotifier) window.updateNotifier.show({ type: 'success', title: 'Auditoría en curso' });
    });

    var finishBtn = document.getElementById('kair-v3-editor-finish');
    if (finishBtn) finishBtn.addEventListener('click', function () { _confirmFinish(audit); });
    var finishBtnFooter = document.getElementById('kair-v3-editor-finish-footer');
    if (finishBtnFooter) finishBtnFooter.addEventListener('click', function () { _confirmFinish(audit); });

    /* Footer */
    var closeBtn = document.getElementById('kair-v3-editor-close');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      KairStore.actions.goHub();
      if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
        window.kairAuditoriaAnual._refreshView();
      }
    });
    var saveBtn = document.getElementById('kair-v3-editor-save');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      if (window.updateNotifier) window.updateNotifier.show({ type: 'success', title: 'Borrador guardado', subtitle: 'Auditoría ' + audit.code });
    });

    /* Acciones inline de hallazgos */
    container.querySelectorAll('[data-mark-verified]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var hId = btn.getAttribute('data-mark-verified');
        KairStore.actions.updateHallazgoEstado(hId, 'verificada');
        if (window.updateNotifier) window.updateNotifier.show({ type: 'success', title: 'Hallazgo verificado' });
        if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
          window.kairAuditoriaAnual._refreshView();
        }
      });
    });
    container.querySelectorAll('[data-mark-closed]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var hId = btn.getAttribute('data-mark-closed');
        KairStore.actions.updateHallazgoEstado(hId, 'cerrada');
        if (window.updateNotifier) window.updateNotifier.show({ type: 'success', title: 'Hallazgo cerrado' });
        if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
          window.kairAuditoriaAnual._refreshView();
        }
      });
    });
  }

  function _confirmFinish(audit) {
    if (window.kairAuditoriaAnual && window.kairAuditoriaAnual.showConfirm) {
      window.kairAuditoriaAnual.showConfirm({
        title: '¿Finalizar auditoría?',
        message: 'Se emitirá el informe y se habilitarán las firmas.',
        acceptLabel: 'Finalizar',
        danger: false
      }).then(function (ok) {
        if (ok) {
          KairStore.actions.updateAuditStatus(audit.id, 'realizada');
          if (window.updateNotifier) window.updateNotifier.show({ type: 'success', title: 'Auditoría finalizada', subtitle: 'Informe de ' + audit.code + ' emitido' });
          if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
            window.kairAuditoriaAnual._refreshView();
          }
        }
      });
    } else if (window.confirm('¿Finalizar auditoría?')) {
      KairStore.actions.updateAuditStatus(audit.id, 'realizada');
    }
  }

  return { render: render };
})();

window.AuditoriaEditorView = AuditoriaEditorView;
