/* ==========================================================================
K+AIR — Módulo 4.2.5 Mantenimiento Periódico
Vista Resumen — KPIs por categoría y estadísticas generales
========================================================================== */
(function () {
 'use strict';

 var MONTHS = MantenimientoService.MONTHS;

 function _esc(s) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(s || ''));
  return div.innerHTML;
 }

 var ResumenMant = {
  companyName: null,

  load: function (companyName) {
   this.companyName = companyName;
   this.render();
  },

  render: function () {
   var container = document.getElementById('kair-mnt-resumen-content');
   if (!container) return;

   container.innerHTML = KairSkeleton.kpiStrip(4);

   MantenimientoService.read(this.companyName).then(function (result) {
    if (!result.success) {
     container.innerHTML = '<div class="kair-mnt-empty-state"><i class="bi bi-exclamation-circle"></i><h3>Error</h3><p>' + (result.error ? result.error.message : 'No se pudo cargar') + '</p></div>';
     return;
    }

    var data = result.data;
    this._render(container, data);
   }.bind(this)).catch(function (err) {
    console.error('[4.2.5] resumen read error:', err);
    container.innerHTML = '<div class="kair-mnt-empty-state"><i class="bi bi-exclamation-circle"></i><h3>Error</h3><p>Error de conexión</p></div>';
   });
  },

  _render: function (container, data) {
   var items = data.items || [];
   var categories = data.categories || [];
   var header = data.header || {};

   if (items.length === 0) {
    container.innerHTML = '<div class="kair-mnt-empty-state"><i class="bi bi-bar-chart"></i><h3>Sin datos</h3><p>No hay datos de mantenimiento para mostrar</p></div>';
    return;
   }

   var catStats = {};
   categories.forEach(function (cat) {
    catStats[cat] = { count: 0, mpp: 0, mpe: 0, mpc: 0, totalPossible: 0, costoTotal: 0 };
   });

   var globalMPP = 0, globalMPE = 0, globalMPC = 0, globalPossible = 0, globalCosto = 0;

   items.forEach(function (item) {
    var cat = item._category || 'Sin categoría';
    if (!catStats[cat]) {
     catStats[cat] = { count: 0, mpp: 0, mpe: 0, mpc: 0, totalPossible: 0, costoTotal: 0 };
     categories.push(cat);
    }
    var s = catStats[cat];
    s.count++;
    s.totalPossible += 12;
    globalPossible += 12;

    MONTHS.forEach(function (m) {
     if (item.months && item.months[m]) {
      if (item.months[m].MPP) { s.mpp++; globalMPP++; }
      if (item.months[m].MPE) { s.mpe++; globalMPE++; }
      if (item.months[m].MPC) { s.mpc++; globalMPC++; }
     }
    });

    if (item.costo !== null && item.costo !== undefined && !isNaN(parseFloat(item.costo))) {
     var c = parseFloat(item.costo);
     s.costoTotal += c;
     globalCosto += c;
    }
   });

   var globalCumpl = globalPossible > 0 ? Math.round((globalMPP / globalPossible) * 100) : 0;
   var globalCumplClass = globalCumpl >= 80 ? 'success' : (globalCumpl >= 50 ? 'warning' : 'danger');

   var html = '';

   html += '<div class="kair-mnt-kpis" style="margin-bottom:1.5rem">';
   html += '<div class="kair-mnt-kpi-card"><div class="kair-mnt-kpi-card__value kair-mnt-kpi-card__value--' + globalCumplClass + '">' + globalCumpl + '%</div><div class="kair-mnt-kpi-card__label">Cumplimiento Global MPP</div></div>';
   html += '<div class="kair-mnt-kpi-card"><div class="kair-mnt-kpi-card__value">' + items.length + '</div><div class="kair-mnt-kpi-card__label">Total Equipos</div></div>';
   html += '<div class="kair-mnt-kpi-card"><div class="kair-mnt-kpi-card__value kair-mnt-kpi-card__value--success">' + globalMPP + '</div><div class="kair-mnt-kpi-card__label">MPP Realizados</div></div>';
   html += '<div class="kair-mnt-kpi-card"><div class="kair-mnt-kpi-card__value kair-mnt-kpi-card__value--warning">' + globalMPE + '</div><div class="kair-mnt-kpi-card__label">MPE Realizados</div></div>';
   html += '<div class="kair-mnt-kpi-card"><div class="kair-mnt-kpi-card__value kair-mnt-kpi-card__value--danger">' + globalMPC + '</div><div class="kair-mnt-kpi-card__label">MPC Realizados</div></div>';
   if (globalCosto > 0) {
    html += '<div class="kair-mnt-kpi-card"><div class="kair-mnt-kpi-card__value">$' + this._formatNumber(globalCosto) + '</div><div class="kair-mnt-kpi-card__label">Costo Total</div></div>';
   }
   html += '</div>';

   html += '<h3 style="font-size:0.9375rem;font-weight:600;color:var(--kair-mnt-text);margin:0 0 1rem">Desglose por Categoría</h3>';

   html += '<div class="kair-mnt-resumen-cards">';
   categories.forEach(function (cat) {
    var s = catStats[cat];
    if (!s || s.count === 0) return;

    var cumpl = s.totalPossible > 0 ? Math.round((s.mpp / s.totalPossible) * 100) : 0;
    var cumplClass = cumpl >= 80 ? 'success' : (cumpl >= 50 ? 'warning' : 'danger');
    var catIcon = MantenimientoService.getCategoryIcon(cat);

    html += '<div class="kair-mnt-resumen-card">';
    html += '<div class="kair-mnt-resumen-card__header">';
    html += '<div class="kair-mnt-resumen-card__icon"><i class="bi ' + catIcon + '"></i></div>';
    html += '<h4 class="kair-mnt-resumen-card__title">' + _esc(cat) + '</h4>';
    html += '</div>';
    html += '<div class="kair-mnt-resumen-card__stats">';
    html += '<div><div class="kair-mnt-resumen-card__stat-value kair-mnt-resumen-card__stat-value--' + cumplClass + '">' + cumpl + '%</div><div class="kair-mnt-resumen-card__stat-label">Cumpl. MPP</div></div>';
    html += '<div><div class="kair-mnt-resumen-card__stat-value">' + s.count + '</div><div class="kair-mnt-resumen-card__stat-label">Equipos</div></div>';
    html += '<div><div class="kair-mnt-resumen-card__stat-value kair-mnt-resumen-card__stat-value--success">' + s.mpp + '</div><div class="kair-mnt-resumen-card__stat-label">MPP</div></div>';
    html += '<div><div class="kair-mnt-resumen-card__stat-value kair-mnt-resumen-card__stat-value--warning">' + s.mpe + '</div><div class="kair-mnt-resumen-card__stat-label">MPE</div></div>';
    html += '<div><div class="kair-mnt-resumen-card__stat-value kair-mnt-resumen-card__stat-value--' + cumplClass + '">' + s.mpc + '</div><div class="kair-mnt-resumen-card__stat-label">MPC</div></div>';
    if (s.costoTotal > 0) {
     html += '<div><div class="kair-mnt-resumen-card__stat-value">$' + this._formatNumber(s.costoTotal) + '</div><div class="kair-mnt-resumen-card__stat-label">Costo</div></div>';
    }
    html += '</div>';
    html += '</div>';
   }.bind(this));
   html += '</div>';

   html += '<div style="margin-top:1.5rem">';
   html += '<h3 style="font-size:0.9375rem;font-weight:600;color:var(--kair-mnt-text);margin:0 0 1rem">Resumen Mensual</h3>';
   html += '<div class="kair-mnt-table-wrapper" style="overflow-x:auto"><table class="kair-mnt-table" style="min-width:auto">';
   html += '<thead><tr><th>Mes</th><th>MPP</th><th>MPE</th><th>MPC</th><th>Total Equipos</th><th>% Cumpl.</th></tr></thead><tbody>';

   var monthTotals = {};
   MONTHS.forEach(function (m) {
    monthTotals[m] = { mpp: 0, mpe: 0, mpc: 0 };
    items.forEach(function (item) {
     if (item.months && item.months[m]) {
      if (item.months[m].MPP) monthTotals[m].mpp++;
      if (item.months[m].MPE) monthTotals[m].mpe++;
      if (item.months[m].MPC) monthTotals[m].mpc++;
     }
    });
   });

   MONTHS.forEach(function (m) {
    var t = monthTotals[m];
    var pct = items.length > 0 ? Math.round((t.mpp / items.length) * 100) : 0;
    var pctClass = pct >= 80 ? 'success' : (pct >= 50 ? 'warning' : 'danger');
    html += '<tr>';
    html += '<td style="text-align:left;font-weight:600">' + m + '</td>';
    html += '<td><span style="color:var(--kair-mnt-primary);font-weight:600">' + t.mpp + '</span></td>';
    html += '<td><span style="color:var(--kair-mnt-success);font-weight:600">' + t.mpe + '</span></td>';
    html += '<td><span style="color:var(--kair-mnt-warning);font-weight:600">' + t.mpc + '</span></td>';
    html += '<td>' + items.length + '</td>';
    html += '<td><span style="color:var(--kair-mnt-' + pctClass + ');font-weight:700">' + pct + '%</span></td>';
    html += '</tr>';
   });

   html += '</tbody></table></div>';
   html += '</div>';

   if (header.year) {
    html += '<div style="margin-top:1rem;text-align:center;font-size:0.75rem;color:var(--kair-mnt-text-light)">';
    html += 'Año: ' + header.year + ' \u2022 Código: ' + _esc(header.code || 'GS-FO-008');
    html += '</div>';
   }

   container.innerHTML = html;
  },

  _formatNumber: function (n) {
   if (!n && n !== 0) return '0';
   return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
 };

 window.ResumenMant = ResumenMant;
})();
