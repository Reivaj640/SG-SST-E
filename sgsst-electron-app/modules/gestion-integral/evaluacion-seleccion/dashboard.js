/* ==========================================================================
   K+AIR Dashboard — Módulo 2.10.1
   ========================================================================== */

(function () {
  'use strict';

  var DashboardModuleES = {
    load: function () {
      var stats = window.EvaluacionesServiceES.getStats();
      this.renderSummaryCards(stats);
      this.renderAlerts();
      this.renderRecentEvaluations();
      this.renderCharts(stats.distribution);
    },

    renderSummaryCards: function (stats) {
      var container = document.getElementById('kair-es-dashboard-cards');
      if (!container) return;

      container.innerHTML =
        '<div class="k-stats-ribbon">' +
          '<div class="k-stats-ribbon__item">' +
            '<span class="k-stats-ribbon__icon primary"><i class="bi bi-people"></i></span>' +
            '<div class="k-stats-ribbon__data">' +
              '<span class="k-stats-ribbon__value">' + stats.totalAsociados + '</span>' +
              '<span class="k-stats-ribbon__label">Asociados Registrados</span>' +
            '</div>' +
          '</div>' +
          '<div class="k-stats-ribbon__divider"></div>' +
          '<div class="k-stats-ribbon__item">' +
            '<span class="k-stats-ribbon__icon warning"><i class="bi bi-clock-history"></i></span>' +
            '<div class="k-stats-ribbon__data">' +
              '<span class="k-stats-ribbon__value">' + stats.evaluacionesPendientes + '</span>' +
              '<span class="k-stats-ribbon__label">Evaluaciones Pendientes</span>' +
            '</div>' +
          '</div>' +
          '<div class="k-stats-ribbon__divider"></div>' +
          '<div class="k-stats-ribbon__item">' +
            '<span class="k-stats-ribbon__icon primary"><i class="bi bi-arrow-repeat"></i></span>' +
            '<div class="k-stats-ribbon__data">' +
              '<span class="k-stats-ribbon__value">' + stats.reevaluacionesMes + '</span>' +
              '<span class="k-stats-ribbon__label">Reevaluaciones del Mes</span>' +
            '</div>' +
          '</div>' +
          '<div class="k-stats-ribbon__divider"></div>' +
          '<div class="k-stats-ribbon__item">' +
            '<span class="k-stats-ribbon__icon muted"><i class="bi bi-exclamation-triangle"></i></span>' +
            '<div class="k-stats-ribbon__data">' +
              '<span class="k-stats-ribbon__value">' + stats.ncActivas + '</span>' +
              '<span class="k-stats-ribbon__label">No Conformidades Activas</span>' +
            '</div>' +
          '</div>' +
        '</div>';
    },

    renderAlerts: function () {
      var container = document.getElementById('kair-es-dashboard-alerts');
      if (!container) return;

      var asociados = window.AsociadosServiceES.getAll();
      var alerts = [];

      asociados.forEach(function (a) {
        var status = window.EvaluacionesServiceES.getAsociadoStatus(a.id);
        if (status) {
          if (status.clasificacion === 'REGULAR') {
            alerts.push({ type: 'warning', icon: '\u26A0', message: '<strong>' + window.KAIRUtils.escapeHtml(a.razonSocial) + '</strong> — Clasificación REGULAR. Requiere plan de acción.' });
          } else if (status.clasificacion === 'DEFICIENTE') {
            alerts.push({ type: 'danger', icon: '\u2715', message: '<strong>' + window.KAIRUtils.escapeHtml(a.razonSocial) + '</strong> — Clasificación DEFICIENTE. Asociado rechazado.' });
          }
        }
      });

      if (alerts.length === 0) { container.innerHTML = ''; return; }

      container.innerHTML = '<div class="kair-dashboard__alerts">' +
        alerts.map(function (alert) {
          return '<div class="kair-dashboard__alert-item kair-dashboard__alert-item--' + (alert.type === 'danger' ? 'danger' : '') + '">' +
            '<span class="kair-dashboard__alert-icon">' + alert.icon + '</span>' +
            '<span>' + alert.message + '</span>' +
          '</div>';
        }).join('') +
      '</div>';
    },

    renderRecentEvaluations: function () {
      var container = document.getElementById('kair-es-dashboard-recent');
      if (!container) return;

      var evals = window.EvaluacionesServiceES.getSelectionEvals();
      var reevals = window.EvaluacionesServiceES.getReevaluations();
      var all = evals.map(function (e) { return Object.assign({}, e, { tipo: 'Selección' }); })
        .concat(reevals.map(function (r) { return Object.assign({}, r, { tipo: 'Reevaluación' }); }))
        .sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });
      var recent = all.slice(0, 10);

      if (recent.length === 0) {
        container.innerHTML = '<div class="kair-card"><div class="kair-card__header"><span class="kair-card__title">Evaluaciones Recientes</span></div><div class="kair-empty"><div class="kair-empty__title">Sin evaluaciones registradas</div><div class="kair-empty__description">Comience evaluando a los asociados registrados.</div></div></div>';
        return;
      }

      var rows = recent.map(function (ev) {
        var asociado = window.AsociadosServiceES.getById(ev.asociadoId);
        var name = asociado ? window.KAIRUtils.escapeHtml(asociado.razonSocial) : 'Desconocido';
        var tipo = asociado ? window.KAIRUtils.getTipoLabel(asociado.tipo) : '—';
        var badgeClass = window.KAIRUtils.getClasificacionBadgeClass(ev.clasificacion);
        var badgeLabel = window.KAIRUtils.getClasificacionLabel(ev.clasificacion);
        return '<tr><td>' + name + '</td><td>' + tipo + '</td><td>' + window.KAIRUtils.formatDate(ev.fecha) + '</td><td><strong>' + ev.puntajeTotal + '</strong></td><td><span class="kair-badge ' + badgeClass + '">' + badgeLabel + '</span></td></tr>';
      });

      container.innerHTML = '<div class="kair-card"><div class="kair-card__header"><span class="kair-card__title">Evaluaciones Recientes</span></div><div class="kair-table-wrapper" style="border:none;border-radius:0;"><table class="kair-table"><thead><tr><th>Nombre</th><th>Tipo</th><th>Fecha</th><th>Puntaje</th><th>Estado</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div></div>';
    },

    renderCharts: function (distribution) {
      var container = document.getElementById('kair-es-dashboard-charts');
      if (!container) return;

      var total = distribution.BUENO + distribution.REGULAR + distribution.DEFICIENTE || 1;
      var buenoPct = Math.round((distribution.BUENO / total) * 100);
      var regularPct = Math.round((distribution.REGULAR / total) * 100);
      var deficientePct = Math.round((distribution.DEFICIENTE / total) * 100);

      var evals = window.EvaluacionesServiceES.getSelectionEvals();
      var criteriaKeys = ['precio', 'disponibilidad', 'experiencia', 'calidad', 'marca', 'requisitosLegales'];
      var criteriaLabels = { precio: 'Precio', disponibilidad: 'Disponibilidad', experiencia: 'Experiencia', calidad: 'Calidad', marca: 'Marca', requisitosLegales: 'Req. Legales' };

      var criteriaRows = '';
      if (evals.length > 0) {
        criteriaKeys.forEach(function (key) {
          var values = evals.map(function (e) { return e.criterios[key]; }).filter(function (v) { return v !== undefined; });
          var avg = values.length > 0 ? window.KAIRUtils.average(values) : 0;
          var pct = (avg / 5) * 100;
          var colorClass = avg >= 4 ? 'kair-bar-chart__bar--success' : avg >= 2.6 ? 'kair-bar-chart__bar--warning' : 'kair-bar-chart__bar--danger';
          criteriaRows += '<div class="kair-bar-chart__row"><span class="kair-bar-chart__label">' + criteriaLabels[key] + '</span><div class="kair-bar-chart__bar-track"><div class="kair-bar-chart__bar ' + colorClass + '" style="width:' + pct + '%"><span class="kair-bar-chart__bar-value">' + avg.toFixed(1) + '</span></div></div></div>';
        });
      } else {
        criteriaRows = '<div class="kair-text-center kair-text-muted kair-text-sm" style="padding:2rem;">Sin datos suficientes</div>';
      }

      container.innerHTML =
        '<div class="kair-dashboard__charts">' +
          '<div class="kair-dashboard__chart"><div class="kair-dashboard__chart-title">Distribución por Estado</div><div class="kair-bar-chart">' +
            '<div class="kair-bar-chart__row"><span class="kair-bar-chart__label">Bueno</span><div class="kair-bar-chart__bar-track"><div class="kair-bar-chart__bar kair-bar-chart__bar--success" style="width:' + buenoPct + '%"><span class="kair-bar-chart__bar-value">' + distribution.BUENO + ' (' + buenoPct + '%)</span></div></div></div>' +
            '<div class="kair-bar-chart__row"><span class="kair-bar-chart__label">Regular</span><div class="kair-bar-chart__bar-track"><div class="kair-bar-chart__bar kair-bar-chart__bar--warning" style="width:' + regularPct + '%"><span class="kair-bar-chart__bar-value">' + distribution.REGULAR + ' (' + regularPct + '%)</span></div></div></div>' +
            '<div class="kair-bar-chart__row"><span class="kair-bar-chart__label">Deficiente</span><div class="kair-bar-chart__bar-track"><div class="kair-bar-chart__bar kair-bar-chart__bar--danger" style="width:' + deficientePct + '%"><span class="kair-bar-chart__bar-value">' + distribution.DEFICIENTE + ' (' + deficientePct + '%)</span></div></div></div>' +
          '</div></div>' +
          '<div class="kair-dashboard__chart"><div class="kair-dashboard__chart-title">Promedio por Criterio de Selección</div><div class="kair-bar-chart">' + criteriaRows + '</div></div>' +
        '</div>';
    },
  };

  window.DashboardModuleES = DashboardModuleES;
})();
