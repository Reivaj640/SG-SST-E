/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Hub view (replica HubView.tsx del tar)
   Submódulo 6.1.2 + 6.1.4 — Patrón B Submodule Home
   v3.0 · 2026-06-19
   ═══════════════════════════════════════════════════════════════════ */

var AuditoriaHubView = (function () {
  'use strict';

  function _esc(s) { return KairUI.esc(s); }

  function _formatDate(iso) { return KairHelpers.formatDate(iso); }

  function _computeProximas(audits) {
    return audits
      .filter(function (a) { return a.status === 'programada' || a.status === 'en_curso'; })
      .sort(function (a, b) { return (a.fechaProgramada || '').localeCompare(b.fechaProgramada || ''); })
      .slice(0, 3);
  }

  function _computeCriticos(audits) {
    return audits
      .flatMap(function (a) {
        return (a.hallazgos || []).map(function (h) {
          return Object.assign({}, h, { auditCode: a.code, empresa: a.empresa });
        });
      })
      .filter(function (h) {
        return h.estado === 'vencida' || h.criticidad === 'critica' || h.criticidad === 'alta';
      })
      .slice(0, 3);
  }

  function _renderHeader(company) {
    return '<header class="kair-v3-hub-header">' +
      '<div class="kair-v3-hub-header__left">' +
        '<span class="kair-v3-hub-header__pill">' +
          '<i class="bi bi-stack"></i> 6.1.2 + 6.1.4' +
        '</span>' +
        '<h1 class="kair-v3-hub-header__title">Auditorías SG-SST</h1>' +
        '<p class="kair-v3-hub-header__subtitle">Submódulo combinado 6.1.2 Planificación y ejecución · 6.1.4 Seguimiento a hallazgos</p>' +
      '</div>' +
      '<div class="kair-v3-hub-header__right">' +
        '<span class="kair-v3-hub-company">' +
          '<i class="bi bi-building"></i> ' + _esc(company) +
        '</span>' +
      '</div>' +
    '</header>';
  }

  function _renderKpis(kpisAud, kpisHal) {
    var kpis = [
      { key: 'programadas', label: 'Programadas', value: kpisAud.programadas, color: 'primary' },
      { key: 'encurso', label: 'En curso', value: kpisAud.enCurso, color: 'warning' },
      { key: 'realizadas', label: 'Realizadas', value: kpisAud.realizadas, color: 'success' },
      { key: 'vencidas', label: 'Vencidas', value: kpisAud.vencidas, color: 'danger' },
      {
        key: 'hallazgos_abiertos',
        label: 'Hallazgos abiertos',
        value: kpisHal.abiertas + kpisHal.enTratamiento + kpisHal.vencidas,
        color: 'danger',
        sub: kpisHal.vencidas + ' vencidos · ' + kpisHal.cerradas + ' cerrados'
      }
    ];

    return '<div class="kair-v3-kpi-strip">' +
      kpis.map(function (k) {
        return '<div class="kair-v3-kpi kair-v3-kpi--' + k.color + '" data-kpi="' + k.key + '">' +
          '<div class="kair-v3-kpi__icon"><i class="bi bi-' + (
            k.key === 'programadas' ? 'clipboard-check' :
            k.key === 'encurso' ? 'graph-up-arrow' :
            k.key === 'realizadas' ? 'shield-check' :
            'exclamation-triangle'
          ) + '"></i></div>' +
          '<div class="kair-v3-kpi__content">' +
            '<div class="kair-v3-kpi__value">' + k.value + '</div>' +
            '<div class="kair-v3-kpi__label">' + k.label + '</div>' +
            (k.sub ? '<div class="kair-v3-kpi__sub">' + _esc(k.sub) + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function _renderHero() {
    return '<section class="kair-v3-hub-hero">' +
      '<div class="kair-v3-hub-hero__icon"><i class="bi bi-shield-check"></i></div>' +
      '<div class="kair-v3-hub-hero__body">' +
        '<h2 class="kair-v3-hub-hero__title">Centro de gestión de auditorías internas SG-SST</h2>' +
        '<p class="kair-v3-hub-hero__desc">Gestiona el ciclo completo de auditorías bajo el Decreto 1072 de 2015 (Sección 2.2.4.6): planifica, ejecuta, documenta hallazgos y haz seguimiento a los planes de acción hasta su cierre. Una sola interfaz unificada para los puntos 6.1.2 (Auditorías) y 6.1.4 (Seguimiento a hallazgos) del sistema de gestión.</p>' +
      '</div>' +
    '</section>';
  }

  function _renderCards(kpisAud, kpisHal) {
    var cards = [
      {
        key: 'auditorias',
        color: 'primary',
        icon: 'clipboard-check',
        title: 'Gestión de Auditorías',
        desc: 'Plan de auditoría (GI-FO-035), cronograma anual (GI-FO-062), ejecución documental y de campo, desempeño del SG-SST por etapas y componentes, informe final y firmas.',
        meta: kpisAud.total + ' auditorías registradas',
        badge: (kpisAud.programadas + kpisAud.enCurso) + ' activas',
        badgeVariant: 'primary'
      },
      {
        key: 'hallazgos',
        color: 'danger',
        icon: 'exclamation-triangle',
        title: 'Hallazgos y Planes de Acción',
        desc: 'Seguimiento transversal de no conformidades, observaciones de mejora y oportunidades. Planes de acción con responsable, fecha de compromiso, evidencia y verificación de cierre.',
        meta: kpisHal.total + ' hallazgos · ' + kpisHal.cerradas + ' cerrados',
        badge: kpisHal.vencidas + ' vencidos',
        badgeVariant: kpisHal.vencidas > 0 ? 'danger' : 'success'
      },
      {
        key: 'cronograma',
        color: 'success',
        icon: 'calendar3',
        title: 'Cronograma Anual de Auditorías',
        desc: 'Calendarización mensual de las cuatro fases del ciclo de auditoría: preparación, realización, determinación del plan de acción e implementación. Vista consolidada por proceso.',
        meta: new Date().getFullYear() + ' · 12 meses',
        badge: 'GI-FO-062',
        badgeVariant: 'info'
      },
      {
        key: 'informes',
        color: 'neutral',
        icon: 'file-earmark-text',
        title: 'Informes y Firmas',
        desc: 'Generación del informe de auditoría con conclusiones por etapa del SG-SST, registro de entrega y firmas del auditor líder y el responsable del SG-SST.',
        meta: kpisAud.realizadas + ' informes emitidos',
        badge: 'Decreto 1072',
        badgeVariant: 'neutral'
      }
    ];

    return '<div class="kair-v3-hub-cards">' +
      cards.map(function (c) {
        return '<button class="kair-v3-hub-card kair-v3-hub-card--' + c.color +
          '" data-card="' + c.key + '" type="button">' +
          '<div class="kair-v3-hub-card__head">' +
            '<div class="kair-v3-hub-card__icon"><i class="bi bi-' + c.icon + '"></i></div>' +
            '<i class="bi bi-chevron-right kair-v3-hub-card__chev"></i>' +
          '</div>' +
          '<h3 class="kair-v3-hub-card__title">' + c.title + '</h3>' +
          '<p class="kair-v3-hub-card__desc">' + c.desc + '</p>' +
          '<div class="kair-v3-hub-card__meta">' +
            '<span class="kair-v3-hub-card__meta-text">' + c.meta + '</span>' +
            KairUI.Badge({ variant: c.badgeVariant, children: c.badge }) +
          '</div>' +
        '</button>';
      }).join('') +
    '</div>';
  }

  function _renderProximas(proximas) {
    var list = proximas.length === 0
      ? KairUI.EmptyState({
          icon: 'calendar3',
          title: 'Sin auditorías próximas',
          description: 'No hay auditorías programadas o en curso en este momento.'
        })
      : '<ul class="kair-v3-hub-detail__list">' +
        proximas.map(function (a) {
          return '<li>' +
            '<button class="kair-v3-hub-detail__item" data-go-editor="' + _esc(a.id) + '" data-tab="plan" type="button">' +
              '<div class="kair-v3-hub-detail__item-icon kair-v3-hub-detail__item-icon--primary"><i class="bi bi-clipboard-check"></i></div>' +
              '<div class="kair-v3-hub-detail__item-body">' +
                '<div class="kair-v3-hub-detail__item-title">' + _esc(a.process || '—') + '</div>' +
                '<div class="kair-v3-hub-detail__item-sub">' +
                  _esc(a.code || '—') + ' · ' + _esc(_formatDate(a.fechaProgramada)) +
                '</div>' +
              '</div>' +
              '<div class="kair-v3-hub-detail__item-badge">' +
                KairUI.Badge({ variant: KairHelpers.auditStatusBadge[a.status] || 'neutral', dot: true, children: KairHelpers.auditStatusLabel[a.status] || a.status }) +
              '</div>' +
            '</button>' +
          '</li>';
        }).join('') +
      '</ul>';

    return '<div class="kair-v3-hub-detail__col">' +
      '<div class="kair-v3-hub-detail__head">' +
        '<h3 class="kair-v3-hub-detail__title">Próximas auditorías programadas</h3>' +
        '<button class="kair-v3-hub-detail__link" data-go-list="auditorias" type="button">Ver todas →</button>' +
      '</div>' +
      list +
    '</div>';
  }

  function _renderCriticos(criticos) {
    var list = criticos.length === 0
      ? KairUI.EmptyState({
          icon: 'shield-check',
          title: 'Sin hallazgos críticos ni vencidos',
          description: '¡Buen trabajo! No hay hallazgos pendientes de atención.'
        })
      : '<ul class="kair-v3-hub-detail__list">' +
        criticos.map(function (h) {
          var iconClass = h.estado === 'vencida' ? 'danger' : 'warning';
          return '<li>' +
            '<button class="kair-v3-hub-detail__item" data-go-editor="' + _esc(h.auditId) + '" data-tab="hallazgos" type="button">' +
              '<div class="kair-v3-hub-detail__item-icon kair-v3-hub-detail__item-icon--' + iconClass + '"><i class="bi bi-exclamation-triangle"></i></div>' +
              '<div class="kair-v3-hub-detail__item-body">' +
                '<div class="kair-v3-hub-detail__item-sub">' +
                  '<span style="color:var(--v3-primary);font-weight:600;">' + _esc(h.componente || '—') + '</span>' +
                  '<span>· ' + _esc(h.auditCode || '') + '</span>' +
                '</div>' +
                '<div class="kair-v3-hub-detail__item-title">' + _esc(h.descripcion || '—') + '</div>' +
              '</div>' +
              '<div class="kair-v3-hub-detail__item-badge">' +
                KairUI.Badge({ variant: KairHelpers.hallazgoEstadoBadge[h.estado] || 'neutral', dot: true, children: KairHelpers.hallazgoEstadoLabel[h.estado] || h.estado }) +
              '</div>' +
            '</button>' +
          '</li>';
        }).join('') +
      '</ul>';

    return '<div class="kair-v3-hub-detail__col">' +
      '<div class="kair-v3-hub-detail__head">' +
        '<h3 class="kair-v3-hub-detail__title">Hallazgos críticos y vencidos</h3>' +
        '<button class="kair-v3-hub-detail__link" data-go-list="hallazgos" type="button">Ver todos →</button>' +
      '</div>' +
      list +
    '</div>';
  }

  function render(container) {
    var audits = KairStore.selectAudits();
    var kpisAud = KairStore.computeKpisAuditorias();
    var kpisHal = KairStore.computeKpisHallazgos();
    var company = (window.KairMockData && window.KairMockData.ACTIVE_COMPANY && window.KairMockData.ACTIVE_COMPANY.nombre) || '—';
    var proximas = _computeProximas(audits);
    var criticos = _computeCriticos(audits);

    container.innerHTML =
      '<div class="kair-v3-hub">' +
        _renderHeader(company) +
        '<main class="kair-v3-hub-main">' +
          _renderKpis(kpisAud, kpisHal) +
          _renderHero() +
          _renderCards(kpisAud, kpisHal) +
          '<section class="kair-v3-hub-detail">' +
            _renderProximas(proximas) +
            _renderCriticos(criticos) +
          '</section>' +
        '</main>' +
      '</div>';

    _bindEvents(container);
  }

  function _bindEvents(container) {
    container.addEventListener('click', function (e) {
      var card = e.target.closest('[data-card]');
      if (card) {
        var key = card.getAttribute('data-card');
        KairStore.actions['go' + (key === 'auditorias' ? 'List' :
                                    key === 'hallazgos' ? 'Hallazgos' :
                                    key === 'cronograma' ? 'Cronograma' :
                                    key === 'informes' ? 'Informes' : '')]();
        if (typeof Sileo !== 'undefined') {
          Sileo.info({ title: 'Navegando a ' + card.querySelector('.kair-v3-hub-card__title').textContent });
        }
        if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
          window.kairAuditoriaAnual._refreshView();
        }
        return;
      }
      var goEditor = e.target.closest('[data-go-editor]');
      if (goEditor) {
        var id = goEditor.getAttribute('data-go-editor');
        var tab = goEditor.getAttribute('data-tab');
        KairStore.actions.goEditor(id, tab);
        if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
          window.kairAuditoriaAnual._refreshView();
        }
        return;
      }
      var goList = e.target.closest('[data-go-list]');
      if (goList) {
        var listKey = goList.getAttribute('data-go-list');
        KairStore.actions[listKey === 'auditorias' ? 'goList' : 'go' + (listKey === 'hallazgos' ? 'Hallazgos' : '')]();
        if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
          window.kairAuditoriaAnual._refreshView();
        }
      }
    });

    // Re-render cuando el store cambie
    if (window.KairStore && window.KairStore.subscribe) {
      window._kairV3HubUnsub = window.KairStore.subscribe(function () {
        // Solo re-renderizar si el hub está visible
        var hubEl = container.querySelector('.kair-v3-hub');
        if (hubEl && KairStore.getState().view === 'hub') render(container);
      });
    }
  }

  function destroy() {
    if (window._kairV3HubUnsub) {
      window._kairV3HubUnsub();
      window._kairV3HubUnsub = null;
    }
  }

  return { render: render, destroy: destroy };
})();

window.AuditoriaHubView = AuditoriaHubView;
