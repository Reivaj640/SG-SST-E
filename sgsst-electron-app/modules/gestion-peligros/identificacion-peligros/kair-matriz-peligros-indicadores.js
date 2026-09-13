/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
indicadores.js — Vista KPIs: strip + 5 nuevos KPIs en grid 2 cols + 2 bar charts
========================================================================== */
(function (global) {
  'use strict';
  var KM = global.KM;

  var IndicadoresView = {};
  var _companyName = null;
  var _stats = null;

  function _levelCount(stats, key) {
    return (stats && stats.porNivel && stats.porNivel[key]) || 0;
  }

  function _renderKpiStrip(stats) {
    var total = (stats && stats.total) || 0;
    var criticos = _levelCount(stats, 'I');
    var altos = _levelCount(stats, 'II');
    var medios = _levelCount(stats, 'III');
    var bajos = _levelCount(stats, 'IV');
    var expuestos = (stats && stats.totalExpuestos) || 0;

    var items = [
      { label: 'TOTAL PELIGROS', value: total, tone: 'azul',     icon: 'bi-clipboard-check' },
      { label: 'CRÍTICOS (NIVEL I)', sub: 'Requiere atención', value: criticos, tone: 'rojo',     icon: 'bi-exclamation-octagon-fill' },
      { label: 'ALTOS (NIVEL II)', value: altos, tone: 'amarillo', icon: 'bi-exclamation-triangle-fill' },
      { label: 'MEDIOS (NIVEL III)', value: medios, tone: 'info',    icon: 'bi-info-circle-fill' },
      { label: 'BAJOS (NIVEL IV)', value: bajos, tone: 'verde',    icon: 'bi-check-circle-fill' },
      { label: 'TOTAL EXPUESTOS', sub: 'personas expuestas', value: expuestos.toLocaleString('es-CO'), tone: 'azul', icon: 'bi-people-fill' }
    ];

    var html = '<div class="km-kpi-strip">';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var sub = it.sub ? '<div class="km-kpi__sub">' + KM.esc(it.sub) + '</div>' : '';
      html += '<div class="km-kpi">' +
        '<div class="km-kpi__icon km-kpi__icon--' + it.tone + '"><i class="bi ' + it.icon + '"></i></div>' +
        '<div class="km-kpi__body">' +
          '<div class="km-kpi__value">' + KM.esc(it.value) + '</div>' +
          '<div class="km-kpi__label">' + KM.esc(it.label) + '</div>' +
          sub +
        '</div>' +
      '</div>';
    }
    html += '</div>';
    return html;
  }

  /* 📦448 (2026-06-25) — Wrapper genérico para los 5 nuevos KPIs.
     Cada KPI es una "card" con header + body. El grid CSS se encarga
     de organizarlos en 2 columnas (o 1 en pantallas chicas). */
  function _renderKpiCard(opts) {
    return '<div class="km-kpi-card">' +
      '<div class="km-kpi-card__header">' +
        '<div class="km-kpi-card__title"><i class="bi ' + KM.esc(opts.icon) + '"></i> ' + KM.esc(opts.title) + '</div>' +
        (opts.subtitle ? '<div class="km-kpi-card__subtitle">' + KM.esc(opts.subtitle) + '</div>' : '') +
      '</div>' +
      '<div class="km-kpi-card__body">' + opts.body + '</div>' +
    '</div>';
  }

  /* 📦448 — KPI #1: Cobertura de controles (jerarquía GTC-45: fuente / medio / individuo).
     3 barras horizontales con %, mostrando cuántos peligros tienen documentado
     cada tipo de control. Decreto 1072 Art. 2.2.4.6.15 lo exige. */
  function _renderCoberturaControles(stats) {
    var c = (stats && stats.cobertura) || { fuente: {count:0,total:0,pct:0}, medio: {count:0,total:0,pct:0}, persona: {count:0,total:0,pct:0} };
    var total = (stats && stats.total) || 0;
    var rows = [
      { label: 'En la fuente',   icon: 'bi-gear-fill',      tone: 'verde',   data: c.fuente },
      { label: 'En el medio',    icon: 'bi-shield-fill',    tone: 'azul',    data: c.medio },
      { label: 'En el individuo', icon: 'bi-person-fill',  tone: 'morado',  data: c.persona }
    ];
    var body = '<div class="km-coverage">';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var pct = r.data.pct || 0;
      var toneCls = pct >= 70 ? 'km-coverage__bar--ok' : (pct >= 40 ? 'km-coverage__bar--mid' : 'km-coverage__bar--low');
      body += '<div class="km-coverage__row">' +
        '<div class="km-coverage__head">' +
          '<i class="bi ' + r.icon + ' km-coverage__icon km-coverage__icon--' + r.tone + '"></i>' +
          '<span class="km-coverage__label">' + KM.esc(r.label) + '</span>' +
          '<span class="km-coverage__pct">' + pct + '%</span>' +
        '</div>' +
        '<div class="km-coverage__track">' +
          '<div class="km-coverage__bar ' + toneCls + '" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<div class="km-coverage__meta">' + r.data.count + ' de ' + total + ' peligros</div>' +
      '</div>';
    }
    body += '</div>';
    return _renderKpiCard({
      icon: 'bi-shield-check',
      title: 'Cobertura de controles',
      subtitle: 'Jerarquía GTC-45 (fuente / medio / individuo)',
      body: body
    });
  }

  /* 📦448 (sustituye a Tareas rutinarias) — KPI: Concentración de riesgo
     Nivel I + II (% de peligros críticos + altos sobre el total).
     KPI crítico para SG-SST — Resolución 0312 lo mide en auditorías.
     Donut grande con % destacado + desglose numérico. */
  function _renderConcentracionRiesgo(stats) {
    var c = (stats && stats.concentracionCritAltos) || { count: 0, total: 0, pct: 0, criticos: 0, altos: 0 };
    var total = c.total || (stats && stats.total) || 0;
    if (total === 0) {
      return _renderKpiCard({
        icon: 'bi-exclamation-octagon-fill',
        title: 'Concentración de riesgo',
        subtitle: 'Nivel I + II sobre el total',
        body: '<div class="km-empty-inline">Sin peligros evaluados</div>'
      });
    }
    var pct = c.pct;
    var pctOtros = 100 - pct;
    var segCritAltos = (pct / 100) * 345.575;
    var segOtros = (pctOtros / 100) * 345.575;
    /* Tono del % según gravedad: rojo si pct >= 60, naranja si >= 30, amarillo si < 30 */
    var pctCls = pct >= 60 ? 'km-concentracion__pct--crit' : (pct >= 30 ? 'km-concentracion__pct--alto' : 'km-concentracion__pct--ok');
    var svg = '<div class="km-concentracion">' +
      '<div class="km-concentracion__hero">' +
        '<svg class="km-donut" viewBox="0 0 150 150" width="150" height="150">' +
          '<circle cx="75" cy="75" r="55" fill="none" stroke="#f1f5f9" stroke-width="24"/>' +
          '<circle cx="75" cy="75" r="55" fill="none" stroke="#dc2626" stroke-width="24" ' +
            'stroke-dasharray="' + segCritAltos + ' ' + (345.575 - segCritAltos) + '" stroke-dashoffset="0" transform="rotate(-90 75 75)" class="km-donut__seg km-donut__seg--si"/>' +
          '<circle cx="75" cy="75" r="55" fill="none" stroke="#16a34a" stroke-width="24" ' +
            'stroke-dasharray="' + segOtros + ' ' + (345.575 - segOtros) + '" stroke-dashoffset="-' + segCritAltos + '" transform="rotate(-90 75 75)" class="km-donut__seg km-donut__seg--no"/>' +
          '<text x="75" y="78" text-anchor="middle" class="km-concentracion__pct ' + pctCls + '">' + pct + '%</text>' +
          '<text x="75" y="95" text-anchor="middle" class="km-donut__label">Nivel I+II</text>' +
        '</svg>' +
        '<div class="km-concentracion__copy">' +
          '<div class="km-concentracion__title">Críticos + Altos</div>' +
          '<div class="km-concentracion__sub"><strong>' + c.count + '</strong> de ' + total + ' peligros</div>' +
          '<div class="km-concentracion__other">Otros niveles: <strong>' + (total - c.count) + '</strong> (' + pctOtros + '%)</div>' +
        '</div>' +
      '</div>' +
      '<div class="km-concentracion__breakdown">' +
        '<div class="km-concentracion__bd-item km-concentracion__bd-item--crit">' +
          '<div class="km-concentracion__bd-icon"><i class="bi bi-exclamation-octagon-fill"></i></div>' +
          '<div class="km-concentracion__bd-body">' +
            '<div class="km-concentracion__bd-value">' + c.criticos + '</div>' +
            '<div class="km-concentracion__bd-label">Críticos (Nivel I)</div>' +
          '</div>' +
        '</div>' +
        '<div class="km-concentracion__bd-item km-concentracion__bd-item--alto">' +
          '<div class="km-concentracion__bd-icon"><i class="bi bi-exclamation-triangle-fill"></i></div>' +
          '<div class="km-concentracion__bd-body">' +
            '<div class="km-concentracion__bd-value">' + c.altos + '</div>' +
            '<div class="km-concentracion__bd-label">Altos (Nivel II)</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
    return _renderKpiCard({
      icon: 'bi-exclamation-octagon-fill',
      title: 'Concentración de riesgo',
      subtitle: 'Nivel I + II sobre el total (Resolución 0312)',
      body: svg
    });
  }

  /* 📦448 — KPI #3: Distribución del NR (histograma en 5 bins).
     Resolución 0312 + GTC-45: 0-20, 21-100, 101-300, 301-600, >600. */
  function _renderNrDistribucion(stats) {
    var dist = (stats && stats.nrDistribucion) || { '0-20': 0, '21-100': 0, '101-300': 0, '301-600': 0, '>600': 0 };
    var total = (stats && stats.total) || 0;
    var nrPromedio = (stats && stats.nrPromedio) || 0;
    var nrMax = (stats && stats.nrMax) || 0;
    var bins = [
      { key: '0-20',     label: 'Aceptable',             tone: 'verde',   desc: 'NR ≤ 20' },
      { key: '21-100',   label: 'Acep. con control',     tone: 'azul',    desc: 'NR 21-100' },
      { key: '101-300',  label: 'Mejorable',             tone: 'amarillo', desc: 'NR 101-300' },
      { key: '301-600',  label: 'No aceptable N1',       tone: 'naranja', desc: 'NR 301-600' },
      { key: '>600',     label: 'No aceptable N2',       tone: 'rojo',    desc: 'NR > 600' }
    ];
    var maxVal = 0;
    for (var k in dist) if (dist[k] > maxVal) maxVal = dist[k];
    var body = '<div class="km-nr-dist">' +
      '<div class="km-nr-dist__stats">' +
        '<div class="km-nr-dist__stat"><span class="km-nr-dist__stat-label">NR Promedio</span><span class="km-nr-dist__stat-value">' + nrPromedio + '</span></div>' +
        '<div class="km-nr-dist__stat"><span class="km-nr-dist__stat-label">NR Máximo</span><span class="km-nr-dist__stat-value km-nr-dist__stat-value--warn">' + nrMax + '</span></div>' +
      '</div>' +
      '<div class="km-nr-dist__bars">';
    for (var i = 0; i < bins.length; i++) {
      var b = bins[i];
      var v = dist[b.key] || 0;
      var pct = maxVal > 0 ? Math.round((v / maxVal) * 100) : 0;
      var pctTotal = total > 0 ? Math.round((v / total) * 100) : 0;
      body += '<div class="km-nr-dist__row">' +
        '<div class="km-nr-dist__head">' +
          '<span class="km-nr-dist__range km-nr-dist__range--' + b.tone + '">' + KM.esc(b.desc) + '</span>' +
          '<span class="km-nr-dist__label">' + KM.esc(b.label) + '</span>' +
          '<span class="km-nr-dist__value">' + v + ' · ' + pctTotal + '%</span>' +
        '</div>' +
        '<div class="km-nr-dist__track">' +
          '<div class="km-nr-dist__bar km-nr-dist__bar--' + b.tone + '" style="width:' + pct + '%"></div>' +
        '</div>' +
      '</div>';
    }
    body += '</div></div>';
    return _renderKpiCard({
      icon: 'bi-bar-chart-fill',
      title: 'Distribución del Nivel de Riesgo',
      subtitle: 'Histograma NR en rangos GTC-45',
      body: body
    });
  }

  /* 📦448 — KPI #4: Top 5 cargos con más peligros.
     Capacitación + EPP se priorizan por cargo. */
  function _renderTopCargos(stats) {
    var top = (stats && stats.topCargos) || [];
    if (top.length === 0) {
      return _renderKpiCard({
        icon: 'bi-person-badge',
        title: 'Top cargos con más peligros',
        subtitle: 'Para priorizar capacitación + EPP',
        body: '<div class="km-empty-inline">Sin cargos con peligros</div>'
      });
    }
    var maxVal = top[0].count || 0;
    var palette = ['azul', 'verde', 'amarillo', 'naranja', 'morado'];
    var body = '<div class="km-top-cargos">';
    for (var i = 0; i < top.length; i++) {
      var t = top[i];
      var pct = maxVal > 0 ? Math.round((t.count / maxVal) * 100) : 0;
      var color = palette[i % palette.length];
      body += '<div class="km-top-cargos__row">' +
        '<div class="km-top-cargos__rank">' + (i + 1) + '</div>' +
        '<div class="km-top-cargos__body">' +
          '<div class="km-top-cargos__head">' +
            '<span class="km-top-cargos__name">' + KM.esc(t.nombre) + '</span>' +
            '<span class="km-top-cargos__count">' + t.count + '</span>' +
          '</div>' +
          '<div class="km-top-cargos__track">' +
            '<div class="km-top-cargos__bar km-top-cargos__bar--' + color + '" style="width:' + pct + '%"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }
    body += '</div>';
    return _renderKpiCard({
      icon: 'bi-person-badge',
      title: 'Top cargos con más peligros',
      subtitle: 'Priorizar capacitación + EPP',
      body: body
    });
  }

  /* 📦448 — KPI extra (D): % de expuestos por sede (respecto al total).
     Complementa el stacked bar existente con la perspectiva porcentual.
     Ubicado debajo del stacked bar como vista complementaria. */
  function _renderExpuestosPorSedePct(stats) {
    var data = (stats && stats.expuestosPorSedePct) || {};
    var keys = Object.keys(data);
    var totalExp = (stats && stats.totalExpuestos) || 0;
    if (keys.length === 0 || totalExp === 0) {
      return _renderKpiCard({
        icon: 'bi-percent',
        title: '% de expuestos por sede',
        subtitle: 'Distribución porcentual de la fuerza laboral',
        body: '<div class="km-empty-inline">Sin datos de expuestos</div>'
      });
    }
    var entries = keys.map(function (k) { return { sede: k, count: data[k].count, pct: data[k].pct }; });
    /* Ordenar por % descendente */
    entries.sort(function (a, b) { return b.pct - a.pct; });
    var palette = ['azul', 'verde', 'amarillo', 'naranja', 'morado', 'cyan', 'rosa'];
    var body = '<div class="km-exp-pct">';
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var color = palette[i % palette.length];
      body += '<div class="km-exp-pct__row">' +
        '<div class="km-exp-pct__label">' + KM.esc(e.sede) + '</div>' +
        '<div class="km-exp-pct__track">' +
          '<div class="km-exp-pct__bar km-exp-pct__bar--' + color + '" style="width:' + e.pct + '%"></div>' +
        '</div>' +
        '<div class="km-exp-pct__value">' + e.pct + '%</div>' +
        '<div class="km-exp-pct__count">' + e.count.toLocaleString('es-CO') + '</div>' +
      '</div>';
    }
    body += '<div class="km-exp-pct__total">Total expuestos: <strong>' + totalExp.toLocaleString('es-CO') + '</strong></div>';
    body += '</div>';
    return _renderKpiCard({
      icon: 'bi-percent',
      title: '% de expuestos por sede',
      subtitle: 'Distribución porcentual de la fuerza laboral',
      body: body
    });
  }

  /* 📦448 — KPI #5: Expuestos por sede (stacked bar por nivel).
     Full-width porque la comparación de expuestos entre sedes es la lectura
     principal para toma de decisiones operativas. */
  function _renderExpuestosPorSede(stats) {
    var data = (stats && stats.expuestosPorSede) || {};
    var keys = Object.keys(data);
    if (keys.length === 0) {
      return _renderKpiCard({
        icon: 'bi-people-fill',
        title: 'Personas expuestas por sede (por nivel)',
        subtitle: 'Sin datos de expuestos',
        body: '<div class="km-empty-inline">Sin datos de personas expuestas</div>'
      });
    }
    /* Encontrar el máximo para escalar las barras */
    var maxExp = 0;
    for (var i = 0; i < keys.length; i++) {
      if (data[keys[i]].total > maxExp) maxExp = data[keys[i]].total;
    }
    var totalExp = (stats && stats.totalExpuestos) || 0;
    var body = '<div class="km-exp-sede">';
    for (var j = 0; j < keys.length; j++) {
      var k = keys[j];
      var d = data[k];
      var widthPct = maxExp > 0 ? Math.round((d.total / maxExp) * 100) : 0;
      /* Stacked: cada nivel ocupa su % dentro del bar */
      var seg = function (lvl, count, tone) {
        var segW = d.total > 0 ? (count / d.total) * widthPct : 0;
        if (count === 0) return '';
        return '<div class="km-exp-sede__seg km-exp-sede__seg--' + tone + '" style="width:' + segW + '%" title="' + lvl + ': ' + count + '"></div>';
      };
      body += '<div class="km-exp-sede__row">' +
        '<div class="km-exp-sede__label">' + KM.esc(k) + '</div>' +
        '<div class="km-exp-sede__track">' +
          seg('Nivel I',   d.porNivel.I,   'rojo') +
          seg('Nivel II',  d.porNivel.II,  'naranja') +
          seg('Nivel III', d.porNivel.III, 'amarillo') +
          seg('Nivel IV',  d.porNivel.IV,  'verde') +
          seg('Nivel V',   d.porNivel.V,   'morado') +
        '</div>' +
        '<div class="km-exp-sede__total">' + d.total + '</div>' +
      '</div>';
    }
    body += '<div class="km-exp-sede__legend">' +
      '<span class="km-exp-sede__legend-item"><span class="km-exp-sede__legend-dot km-exp-sede__legend-dot--rojo"></span>Nivel I (Crítico)</span>' +
      '<span class="km-exp-sede__legend-item"><span class="km-exp-sede__legend-dot km-exp-sede__legend-dot--naranja"></span>Nivel II (Alto)</span>' +
      '<span class="km-exp-sede__legend-item"><span class="km-exp-sede__legend-dot km-exp-sede__legend-dot--amarillo"></span>Nivel III (Medio)</span>' +
      '<span class="km-exp-sede__legend-item"><span class="km-exp-sede__legend-dot km-exp-sede__legend-dot--verde"></span>Nivel IV (Bajo)</span>' +
      '<span class="km-exp-sede__legend-item km-exp-sede__legend-total">Total expuestos: <strong>' + totalExp.toLocaleString('es-CO') + '</strong></span>' +
    '</div>';
    body += '</div>';
    return _renderKpiCard({
      icon: 'bi-people-fill',
      title: 'Personas expuestas por sede (por nivel)',
      subtitle: 'Distribución del riesgo sobre los trabajadores',
      body: body
    });
  }

  /* Bar charts existentes (se mantienen) */
  function _renderBarSection(title, icon, data, maxOverride) {
    var entries = [];
    var max = maxOverride || 0;
    Object.keys(data).forEach(function (k) {
      entries.push({ label: k, value: data[k] });
      if (data[k] > max) max = data[k];
    });
    entries.sort(function (a, b) { return b.value - a.value; });
    var total = entries.reduce(function (s, e) { return s + e.value; }, 0);
    var palette = ['azul', 'verde', 'amarillo', 'rojo', 'naranja', 'morado', 'cyan', 'rosa'];

    var html = '<div class="km-bar-section">' +
      '<div class="km-bar-section__header">' +
        '<div class="km-bar-section__title"><i class="bi ' + icon + '"></i> ' + KM.esc(title) + '</div>' +
        '<span class="km-bar-section__count">' + total + ' total</span>' +
      '</div>';
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var pct = max > 0 ? Math.round((e.value / max) * 100) : 0;
      var color = palette[i % palette.length];
      html += '<div class="km-bar-row">' +
        '<div class="km-bar-row__label">' + KM.esc(e.label) + '</div>' +
        '<div class="km-bar-row__track">' +
          '<div class="km-bar-row__fill km-bar-row__fill--' + color + '" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<div class="km-bar-row__count">' + e.value + '</div>' +
      '</div>';
    }
    html += '</div>';
    return html;
  }

  IndicadoresView.load = function (companyName) {
    _companyName = companyName;
    var container = document.getElementById('km-view-indicadores');
    if (!container) return;
    container.innerHTML = '<div class="km-empty"><div class="km-kpi__icon"><i class="bi bi-arrow-clockwise"></i></div><p>Cargando indicadores...</p></div>';
    global.KMService.stats(companyName).then(function (r) {
      _stats = (r && r.success) ? r.data : null;
      if (!_stats) { container.innerHTML = '<div class="km-empty"><i class="bi bi-x-circle"></i><h3>Error al cargar</h3></div>'; return; }
      /* 📦448 (2026-06-25) — Layout reorganizado en 3 zonas:
         1. KPI Strip (6 cards) — fila completa
         2. Grid de 5 nuevos KPIs (2 columnas + 1 full-width)
         3. Grid de 2 bar charts originales (2 columnas) */
      container.innerHTML = '<div class="km-kpis-body">' +
        /* Zona 1: KPI strip */
        _renderKpiStrip(_stats) +
        /* Zona 2: 5 nuevos KPIs */
        '<div class="km-kpis-grid">' +
          _renderCoberturaControles(_stats) +
          _renderConcentracionRiesgo(_stats) +
          _renderNrDistribucion(_stats) +
          _renderTopCargos(_stats) +
        '</div>' +
        /* KPI #5 full-width (stacked bar) */
        '<div class="km-kpis-grid km-kpis-grid--full">' +
          _renderExpuestosPorSede(_stats) +
        '</div>' +
        /* 📦448 (sustituye a Tareas rutinarias) — KPI extra (D): % expuestos
           por sede. Vista complementaria del stacked bar, full-width para
           comparar visualmente la distribución porcentual. */
        '<div class="km-kpis-grid km-kpis-grid--full">' +
          _renderExpuestosPorSedePct(_stats) +
        '</div>' +
        /* Zona 3: 2 bar charts originales */
        '<div class="km-kpis-grid">' +
          _renderBarSection('Peligros por sede', 'bi-building', _stats.porSede || {}) +
          _renderBarSection('Peligros por clasificación', 'bi-tag', _stats.porTipo || {}) +
        '</div>' +
      '</div>';
    }).catch(function () {
      container.innerHTML = '<div class="km-empty"><i class="bi bi-x-circle"></i><h3>Error al cargar indicadores</h3></div>';
    });
  };

  IndicadoresView.refresh = function () { if (_companyName) IndicadoresView.load(_companyName); };
  IndicadoresView.destroy = function () { _stats = null; _companyName = null; };

  global.KMIndicadoresView = IndicadoresView;
})(window);