// modules/gestion-humana/dashboard/index.js
// 📦720 · Dashboard del módulo Gestión Humana — HTML+CSS+JS separados (v0.2.0)
//
// Estructura visual:
//   - Header (icono + título + subtítulo izq / badge + Volver der)
//   - KPIs (6) via helper GHKPIBar
//   - Charts row 1: Personal por Cargo + Distribución por Estado
//   - Charts row 2: Nivel Educativo (donut) + Pipeline de Contratación
//   - Quick access (4 cards)
//
// HTML: dashboard/index.html (cargado via fetch con fallback inline)
// CSS:  dashboard/index.css (link en index.html)
// Helper KPIs: shared/kpi-bar.js (window.GHKPIBar)

class DashboardComponent {
  constructor(container, companyName, moduleName, subName, onBack) {
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.subName = subName;
    this.onBack = onBack;
    this.data = {
      personales: [],
      contrataciones: [],
      vacaciones: [],
      permisos: []
    };
    this.loading = true;
    // 📦750/752 · Filtros por chart. Default "all" (Todos). Se cambia con el toggle
    // interno de cada chart. Los 4 charts tienen toggle independiente:
    //   - cargo (Personal por Cargo)
    //   - estado (Distribución por Estado)
    //   - antiguedad (Antigüedad del Personal) — nuevo en 📦752
    //   - eps (Top 5 EPS) — nuevo en 📦752
    this.chartFilters = { cargo: 'all', estado: 'all', antiguedad: 'all', eps: 'all' };
  }

  _fmt(n) {
    if (n == null) return '—';
    return new Intl.NumberFormat('es-CO').format(n);
  }
  _escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  // 📦751 · Normaliza una fecha de cualquier formato a YYYY-MM-DD.
  // Réplica de BasePersonal._normalizeDate (la dashboard no debería depender
  // del componente, así que se duplica el helper).
  _normalizeDate(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) {
      return val.getFullYear() + '-' + String(val.getMonth() + 1).padStart(2, '0') + '-' + String(val.getDate()).padStart(2, '0');
    }
    var s = String(val).trim();
    if (!s) return null;
    if (/^\d{8}$/.test(s)) return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return dmy[3] + '-' + String(dmy[2]).padStart(2, '0') + '-' + String(dmy[1]).padStart(2, '0');
    return null;
  }

  _toast() {
    // 📦GESTION-HUMANA-TOAST — Helper estandarizado con title+subtitle+type.
    if (window.parent && window.parent.GestionHumanaToast) return window.parent.GestionHumanaToast;
    if (window.GestionHumanaToast) return window.GestionHumanaToast;
    // Fallback: KAIRToast directo (compatibilidad si el helper no cargó).
    return (window.parent && window.parent.KAIRToast) ? window.parent.KAIRToast : window.KAIRToast;
  }
  _showToast(msg, type) {
    var t = this._toast();
    if (!t) return;
    // Si el helper está disponible, partir "X: Y" en title/subtitle para mejor legibilidad.
    if (t.success && msg.indexOf(':') > 0 && msg.indexOf(':') < 60) {
      var idx = msg.indexOf(':');
      var title = msg.substring(0, idx).trim();
      var subtitle = msg.substring(idx + 1).trim();
      if (typeof t[type] === 'function') { t[type](title, subtitle); return; }
    }
    if (typeof t.show === 'function') t.show(msg, type || 'info');
  }

  async _load() {
    if (!window.electronAPI || !this.companyName) {
      this.loading = false;
      return;
    }
    try {
      var results = await Promise.all([
        window.electronAPI.ghListPersonal({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListContrataciones({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListVacaciones({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListPermisos({ companyName: this.companyName }).catch(function () { return { success: false }; })
      ]);
      this.data.personales     = results[0].success ? (results[0].data.personales || []) : [];
      this.data.contrataciones = results[1].success ? (results[1].data.contrataciones || []) : [];
      this.data.vacaciones     = results[2].success ? (results[2].data.vacaciones || []) : [];
      this.data.permisos       = results[3].success ? (results[3].data.permisos || []) : [];
      // 📦749 · Normalizar estados legacy (A/ACT/activo, R/RET/retirado, etc.)
      // El BasePersonalComponent lo hace, pero el dashboard no — los KPIs
      // quedaban en 0 porque buscaban 'activo' literal sin normalizar.
      var normalize = this._normalizeEstado.bind(this);
      this.data.personales.forEach(normalize);
      this.data.permisos.forEach(function (p) {
        if (p.estado) p.estado = String(p.estado).trim().toLowerCase();
      });
      this.data.vacaciones.forEach(function (p) {
        if (p.estado) p.estado = String(p.estado).trim().toLowerCase();
      });
    } catch (e) {
      console.error('[Dashboard] Error cargando datos:', e);
      this._toast.error('Error cargando dashboard', e.message);
    }
    this.loading = false;
  }

  // 📦749 · Normaliza el estado legacy del Excel a uno canónico.
  // Réplica del método de BasePersonalComponent (📦741) para no acoplar el
  // dashboard al componente. Si se vuelve a cambiar, mantener ambos sincronizados.
  // FIX bug (📦749): el legacy 'R'/'RET'/'retirado' NO depende de fechaRetiro
  // — el Excel ya indica el estado. La versión anterior con fallback contaba
  // los 625 retirados de Tempoactiva como "activos" porque fechaRetiro=null.
  _normalizeEstado(p) {
    if (!p || !p.estado) return p;
    var e = String(p.estado).trim().toLowerCase();
    if (e === 'a' || e === 'act' || e === 'activo') {
      p.estado = 'activo';
    } else if (e === 'r' || e === 'ret' || e === 'retirado') {
      p.estado = 'retirado';
    } else if (e === 'i' || e === 'ina' || e === 'inactivo') {
      p.estado = 'inactivo';
    } else if (e === 'v' || e === 'vac' || e === 'vacaciones') {
      p.estado = 'vacaciones';
    } else if (e === 'p' || e === 'per' || e === 'permiso') {
      p.estado = 'permiso';
    }
    return p;
  }

  _computeKpis() {
    var p = this.data.personales;
    var c = this.data.contrataciones;
    var v = this.data.vacaciones;
    var m = this.data.permisos;
    return {
      total: p.length,
      // 📦749 · Estados ya normalizados en _load() (A/ACT → activo, R/RET → retirado)
      activos: p.filter(function (x) { return x.estado === 'activo'; }).length,
      retirados: p.filter(function (x) { return x.estado === 'retirado'; }).length,
      incapacitados: p.filter(function (x) { return x.estado === 'incapacitado'; }).length,
      maternidad: p.filter(function (x) { return x.estado === 'maternidad'; }).length,
      enVacaciones: p.filter(function (x) { return x.estado === 'vacaciones'; }).length,
      permisosActivos: m.filter(function (x) { return x.estado === 'activo'; }).length,
      contratacionesEnProceso: c.filter(function (x) { return x.estado === 'en_proceso'; }).length
    };
  }

  _computeDistributions() {
    return this._computeDistributionsFor(this.data.personales);
  }

  // 📦750 · Variante que acepta un array de personales (filtrado o completo)
  // para que los toggles de los charts puedan recalcular distribuciones sin
  // tocar el state global.
  _computeDistributionsFor(personales) {
    var p = personales || [];
    var porCargo = {};
    var porNivel = {};
    var porEstado = {};
    p.forEach(function (t) {
      var cargo = t.cargo || 'Sin cargo';
      var nivel = t.nivelEducativo || 'Sin dato';
      // 📦749 · Estado ya normalizado en _load() (legacy A→activo, R→retirado)
      var estado = t.estado || 'activo';
      porCargo[cargo] = (porCargo[cargo] || 0) + 1;
      porNivel[nivel] = (porNivel[nivel] || 0) + 1;
      porEstado[estado] = (porEstado[estado] || 0) + 1;
    });
    return { porCargo: porCargo, porNivel: porNivel, porEstado: porEstado };
  }

  // === HTML ===
  async _fetchHtml() {
    try {
      var r = await fetch('modules/gestion-humana/dashboard/index.html');
      if (r.ok) return await r.text();
    } catch (e) {
      console.warn('[Dashboard] fetch HTML falló, usando fallback inline:', e.message);
    }
    // Fallback inline — debe coincidir con index.html
    return '<div class="db-wrapper" id="db-wrapper">' +
      '<div class="db-kpi-section"><div id="db-kpi-bar" class="db-kpi-bar"></div></div>' +
      '<div class="db-charts-row">' +
        '<div class="db-chart-card"><div class="db-chart-card__head"><h3>Personal por Cargo</h3><p>Distribución por rol</p></div><div id="db-chart-cargo" class="db-chart-card__body"></div></div>' +
        '<div class="db-chart-card"><div class="db-chart-card__head"><h3>Distribución por Estado</h3><p>Estado actual</p></div><div id="db-chart-estado" class="db-chart-card__body"></div></div>' +
      '</div>' +
      '<div class="db-charts-row">' +
        '<div class="db-chart-card"><div class="db-chart-card__head"><div class="db-chart-card__head-text"><h3>Antigüedad del Personal</h3><p>Años desde fecha de ingreso</p></div><div class="db-chart-toggle" data-chart-toggle="antiguedad"><button type="button" class="db-chart-toggle__btn is-active" data-filter="all">Todos</button><button type="button" class="db-chart-toggle__btn" data-filter="activo">Activos</button><button type="button" class="db-chart-toggle__btn" data-filter="retirado">Retirados</button></div></div><div id="db-chart-antiguedad" class="db-chart-card__body"></div></div>' +
        '<div class="db-chart-card"><div class="db-chart-card__head"><div class="db-chart-card__head-text"><h3>Top 5 EPS</h3><p>Entidades Promotoras de Salud más frecuentes</p></div><div class="db-chart-toggle" data-chart-toggle="eps"><button type="button" class="db-chart-toggle__btn is-active" data-filter="all">Todos</button><button type="button" class="db-chart-toggle__btn" data-filter="activo">Activos</button><button type="button" class="db-chart-toggle__btn" data-filter="retirado">Retirados</button></div></div><div id="db-chart-eps" class="db-chart-card__body"></div></div>' +
      '</div>' +
      '<div class="db-quick-access">' +
        '<h2 class="db-section-title"><i class="fas fa-bolt"></i> Acceso rápido</h2>' +
        '<div id="db-quick-access-grid" class="db-quick-access-grid"></div>' +
      '</div>' +
    '</div>';
  }

  // === RENDER ===
  async render() {
    var self = this;
    if (!this._html) this._html = await this._fetchHtml();
    this.container.innerHTML = this._html;

    // Loading state
    var kpiBar = this.container.querySelector('#db-kpi-bar');
    if (kpiBar) {
      kpiBar.innerHTML = '<div style="padding:1rem; color:#5a6378; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando…</div>';
    }

    // Load data
    await this._load();
    this._renderKpis();
    this._renderFilteredCharts();
    this._renderAntiguedadChart();
    this._renderTopEpsChart();
    this._renderQuickAccess();

    // 📦750 · Wirear los toggles de los charts (Todos/Activos/Retirados).
    // Cada toggle es independiente — afecta solo a su chart.
    this.container.querySelectorAll('.db-chart-toggle').forEach(function (toggle) {
      var chartType = toggle.getAttribute('data-chart-toggle');
      toggle.querySelectorAll('.db-chart-toggle__btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var filter = btn.getAttribute('data-filter');
          self.chartFilters[chartType] = filter;
          // Marcar visualmente el botón activo
          toggle.querySelectorAll('.db-chart-toggle__btn').forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
          // Re-renderizar SOLO el chart correspondiente
          self._renderFilteredChart(chartType);
        });
      });
    });
  }

  // 📦750/752 · Re-renderiza los 4 charts que tienen toggle (cargo, estado,
  // antiguedad, eps) usando los filtros actuales. Llamado en el render inicial
  // y desde los handlers de los toggles (que solo disparan el chart afectado).
  _renderFilteredCharts() {
    this._renderFilteredChart('cargo');
    this._renderFilteredChart('estado');
    this._renderFilteredChart('antiguedad');
    this._renderFilteredChart('eps');
  }

  _renderFilteredChart(chartType) {
    var filter = this.chartFilters[chartType];
    var filteredPersonales = filter === 'all'
      ? this.data.personales
      : this.data.personales.filter(function (p) { return p.estado === filter; });
    if (chartType === 'cargo') {
      this._renderCargoChart(this._computeDistributionsFor(filteredPersonales).porCargo);
    } else if (chartType === 'estado') {
      this._renderEstadoChart(this._computeDistributionsFor(filteredPersonales).porEstado);
    } else if (chartType === 'antiguedad') {
      this._renderAntiguedadChartFor(filteredPersonales);
    } else if (chartType === 'eps') {
      this._renderTopEpsChartFor(filteredPersonales);
    }
  }

  _renderKpis() {
    var k = this._computeKpis();
    var kpiBar = this.container.querySelector('#db-kpi-bar');
    if (!kpiBar) return;
    // 📦750 · Las tarjetas son SOLO informativas (no clickeables). El toggle
    // de filtrado está dentro de los charts (Personal por Cargo, Distribución
    // por Estado) y aplica a TODOS los personales juntos (no por tarjeta).
    var kpis = [
      { icon: 'fa-users',          color: '#174ea6', bg: '#e8f0fe', value: this._fmt(k.total),                    label: 'Total Personal' },
      { icon: 'fa-user-check',     color: '#28a745', bg: '#d4edda', value: this._fmt(k.activos),                 label: 'Activos',              badge: k.total ? { text: Math.round(k.activos/k.total*100) + '%', bg: '#d4edda', color: '#155724' } : null },
      { icon: 'fa-user-slash',     color: '#868e96', bg: '#e9ecef', value: this._fmt(k.retirados),               label: 'Retirados' },
      { icon: 'fa-user-xmark',     color: '#dc3545', bg: '#f8d7da', value: this._fmt(k.incapacitados + k.maternidad), label: 'Incapacitados / Maternidad' },
      { icon: 'fa-umbrella-beach', color: '#fd7e14', bg: '#ffe5d0', value: this._fmt(k.enVacaciones),            label: 'En Vacaciones' },
      { icon: 'fa-file-medical',   color: '#6f42c1', bg: '#e7d6ff', value: this._fmt(k.permisosActivos),         label: 'Permisos Activos' },
      { icon: 'fa-user-plus',      color: '#0d9488', bg: '#ccfbf1', value: this._fmt(k.contratacionesEnProceso),  label: 'Contrataciones',       badge: { text: 'en proceso', bg: '#ccfbf1', color: '#0d9488' } }
    ];
    window.GHKPIBar.render(kpiBar, kpis);
  }

  _renderCargoChart(data) {
    var container = this.container.querySelector('#db-chart-cargo');
    if (!container) return;
    var entries = Object.entries(data).sort(function (a, b) { return b[1] - a[1]; });
    if (entries.length === 0) { container.innerHTML = '<p class="db-chart-empty">Sin datos aún.</p>'; return; }
    var max = Math.max.apply(null, entries.map(function (e) { return e[1]; }));
    var html = '';
    entries.forEach(function (e) {
      var pct = (e[1] / max) * 100;
      html += '<div class="db-bar-row">' +
        '<div class="db-bar-row__name">' + e[0] + '</div>' +
        '<div class="db-bar-row__track"><div class="db-bar-row__fill" style="width:' + pct + '%; background:#28a745;"></div></div>' +
        '<div class="db-bar-row__value">' + e[1] + '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  _renderEstadoChart(data) {
    var container = this.container.querySelector('#db-chart-estado');
    if (!container) return;
    var entries = Object.entries(data).sort(function (a, b) { return b[1] - a[1]; });
    if (entries.length === 0) { container.innerHTML = '<p class="db-chart-empty">Sin datos aún.</p>'; return; }
    var max = Math.max.apply(null, entries.map(function (e) { return e[1]; }));
    var html = '';
    entries.forEach(function (e) {
      var pct = (e[1] / max) * 100;
      html += '<div class="db-bar-vert">' +
        '<div class="db-bar-vert__head"><span>' + e[0] + '</span><strong>' + e[1] + '</strong></div>' +
        '<div class="db-bar-vert__track"><div class="db-bar-vert__fill" style="width:' + pct + '%; background:#174ea6;"></div></div>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  // 📦751/752 · Antigüedad del personal = años desde fecha_ingreso hasta hoy.
  // Crítico para empresas de servicios temporales con contratos 11 meses:
  // muestra qué % del personal tiene contratos largos vs cortos.
  // Acepta array filtrado (para que el toggle Todos/Activos/Retirados funcione).
  _renderAntiguedadChart() {
    this._renderAntiguedadChartFor(this.data.personales);
  }
  _renderAntiguedadChartFor(personales) {
    var container = this.container.querySelector('#db-chart-antiguedad');
    if (!container) return;
    var self = this;
    var today = new Date();
    // Buckets en orden lógico (del más reciente al más antiguo)
    var buckets = [
      { label: 'Menos de 1 año',   min: 0,    max: 1,  count: 0 },
      { label: '1 a 3 años',       min: 1,    max: 3,  count: 0 },
      { label: '3 a 5 años',       min: 3,    max: 5,  count: 0 },
      { label: '5 a 10 años',      min: 5,    max: 10, count: 0 },
      { label: 'Más de 10 años',   min: 10,   max: 999, count: 0 }
    ];
    personales.forEach(function (p) {
      if (!p.fechaIngreso) return;
      var fi = self._normalizeDate(p.fechaIngreso);
      if (!fi) return;
      var d = new Date(fi);
      if (isNaN(d.getTime())) return;
      var years = (today - d) / (1000 * 60 * 60 * 24 * 365.25);
      for (var i = 0; i < buckets.length; i++) {
        if (years >= buckets[i].min && years < buckets[i].max) {
          buckets[i].count++;
          break;
        }
      }
    });
    var total = buckets.reduce(function (s, b) { return s + b.count; }, 0);
    if (total === 0) { container.innerHTML = '<p class="db-chart-empty">Sin fechas de ingreso.</p>'; return; }
    var max = Math.max.apply(null, buckets.map(function (b) { return b.count; }));
    var html = '';
    buckets.forEach(function (b) {
      var pct = max > 0 ? (b.count / max) * 100 : 0;
      var pctTotal = Math.round((b.count / total) * 100);
      html += '<div class="db-bar-row">' +
        '<div class="db-bar-row__name">' + b.label + '<div class="db-bar-row__pct">' + pctTotal + '%</div></div>' +
        '<div class="db-bar-row__track"><div class="db-bar-row__fill" style="width:' + pct + '%; background:#6f42c1;"></div></div>' +
        '<div class="db-bar-row__value">' + b.count + '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  // 📦751/752 · Top 5 EPS (Entidades Promotoras de Salud) del personal.
  // Acepta array filtrado (toggle Todos/Activos/Retirados).
  _renderTopEpsChart() {
    this._renderTopEpsChartFor(this.data.personales);
  }
  _renderTopEpsChartFor(personales) {
    var container = this.container.querySelector('#db-chart-eps');
    if (!container) return;
    var self = this;
    var porEps = {};
    personales.forEach(function (p) {
      var eps = (p.eps || 'Sin dato').trim();
      if (!eps) eps = 'Sin dato';
      porEps[eps] = (porEps[eps] || 0) + 1;
    });
    var entries = Object.entries(porEps)
      .sort(function (a, b) { return b[1] - a[1] })
      .slice(0, 5);
    if (entries.length === 0) { container.innerHTML = '<p class="db-chart-empty">Sin datos de EPS.</p>'; return; }
    var total = entries.reduce(function (s, e) { return s + e[1]; }, 0);
    var max = Math.max.apply(null, entries.map(function (e) { return e[1]; }));
    var html = '';
    entries.forEach(function (e) {
      var pct = max > 0 ? (e[1] / max) * 100 : 0;
      var pctTotal = Math.round((e[1] / total) * 100);
      html += '<div class="db-bar-row">' +
        '<div class="db-bar-row__name">' + self._escHtml(e[0]) + '<div class="db-bar-row__pct">' + pctTotal + '%</div></div>' +
        '<div class="db-bar-row__track"><div class="db-bar-row__fill" style="width:' + pct + '%; background:#0d9488;"></div></div>' +
        '<div class="db-bar-row__value">' + e[1] + '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  _renderQuickAccess() {
    var self = this;
    var k = this._computeKpis();
    var grid = this.container.querySelector('#db-quick-access-grid');
    if (!grid) return;
    var items = [
      { icon: 'fa-user-plus',      iconColor: '#0d9488', iconBg: '#ccfbf1', title: 'Nueva Contratación',  meta: k.contratacionesEnProceso + ' en proceso', view: 'contratacion' },
      { icon: 'fa-umbrella-beach', iconColor: '#ea580c', iconBg: '#ffedd5', title: 'Vacaciones',         meta: k.enVacaciones + ' en vacaciones',         view: 'vacaciones' },
      { icon: 'fa-file-medical',   iconColor: '#be123c', iconBg: '#ffe4e6', title: 'Permisos y Estados', meta: k.permisosActivos + ' activos',            view: 'permisos' },
      { icon: 'fa-bullhorn',       iconColor: '#a16207', iconBg: '#fef3c7', title: 'Comunicación',      meta: 'Anuncios y mensajes',                     view: 'comunicacion' }
    ];
    grid.innerHTML = '';
    items.forEach(function (it) {
      var card = document.createElement('div');
      card.className = 'db-quick-card';
      card.innerHTML =
        '<div class="db-quick-card__icon" style="background:' + it.iconBg + ';"><i class="fas ' + it.icon + '" style="color:' + it.iconColor + ';"></i></div>' +
        '<div class="db-quick-card__body">' +
          '<div class="db-quick-card__title">' + it.title + '</div>' +
          '<div class="db-quick-card__meta">' + it.meta + '</div>' +
        '</div>' +
        '<i class="fas fa-arrow-right db-quick-card__arrow"></i>';
      card.onclick = function () {
        window.dispatchEvent(new CustomEvent('gh-shell-navigate', { detail: { view: it.view } }));
      };
      grid.appendChild(card);
    });
  }

  destroy() {
    // Sin subscripciones ni listeners globales que limpiar
  }
}

window.DashboardComponent = DashboardComponent;
