/* ============================================================
   K+AIR · 3.1.6 Estadísticas de Remisiones — premium v2
   Componente embebido. Deriva métricas del Control de Remisiones
   (mismo origen: window.electronAPI.getControlRemisionesData).

     · getControlRemisionesData(companyName)
         → { success, headers: [...], rows: [[...]], rowNumbers, filePath }

   El montaje lo hace RestriccionesMedicasComponent.showEstadisticasRemisionesPage()
   con: new EstadisticasRemisionesV2Component(container, { ... }).

   LECCIONES APLICADAS: avisos al <body> envueltos en .remstat-scope,
   destroy() + vigía, barras como CAJAS HTML (no SVG estirado).
   ============================================================ */
(function () {
  'use strict';

  var TAG = 'K+AIRSTAT';
  function klog(mod, acc, st, extra) {
    var l = '[' + TAG + '][' + mod + '][' + acc + '][' + st + ']' + (extra ? ' ' + extra : '');
    if (st === 'ERR') console.warn(l); else console.log(l);
  }

  var IC = {
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="4" width="3" height="14" rx="1"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    cake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16h16"/><path d="M12 3v3M8 3v3M16 3v3"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    err: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>'
  };

  var MARCADO = [
    '<div class="remstat-header">',
    '  <span class="remstat-header__icon">' + IC.chart + '</span>',
    '  <div class="remstat-header__text">',
    '    <h1 class="remstat-header__title">Estadísticas de Remisiones</h1>',
    '    <p class="remstat-header__sub">Métricas derivadas del Control de Remisiones (GI-FO-012)</p>',
    '  </div>',
    '  <span class="remstat-header__chip" title="Empresa activa">' + IC.building + '<span id="remstat-emp">—</span></span>',
    '  <div class="remstat-header__actions">',
    '    <button type="button" class="remstat-btn remstat-btn--ghost" id="remstat-refresh" title="Actualizar">' + IC.refresh + ' Refrescar</button>',
    '    <button type="button" class="remstat-btn remstat-btn--ghost" id="remstat-back">' + IC.arrowLeft + ' Volver</button>',
    '  </div>',
    '</div>',
    '<div class="remstat-kpis" id="remstat-kpis">',
    '  <div class="remstat-kpi remstat-kpi--blue"><span class="remstat-kpi__icon">' + IC.users + '</span><div><div class="remstat-kpi__value" id="remstat-k-total">0</div><div class="remstat-kpi__label">Total remisiones</div></div></div>',
    '  <div class="remstat-kpi remstat-kpi--green"><span class="remstat-kpi__icon">' + IC.check + '</span><div><div class="remstat-kpi__value" id="remstat-k-seg">0</div><div class="remstat-kpi__label">Con seguimiento</div></div></div>',
    '  <div class="remstat-kpi remstat-kpi--amber"><span class="remstat-kpi__icon">' + IC.clock + '</span><div><div class="remstat-kpi__value" id="remstat-k-pend">0</div><div class="remstat-kpi__label">Pendientes</div></div></div>',
    '  <div class="remstat-kpi remstat-kpi--violet"><span class="remstat-kpi__icon">' + IC.cake + '</span><div><div class="remstat-kpi__value" id="remstat-k-edad">—</div><div class="remstat-kpi__label">Edad promedio</div></div></div>',
    '</div>',
    '<div class="remstat-body">',
    '  <div class="remstat-skeleton" id="remstat-loading">',
    '    <div class="remstat-skeleton__row" style="width:92%"></div>',
    '    <div class="remstat-skeleton__row" style="width:78%"></div>',
    '    <div class="remstat-skeleton__row" style="width:85%"></div>',
    '  </div>',
    '  <div class="remstat-state remstat-hidden" id="remstat-empty">',
    '    <div class="remstat-state__icon">' + IC.folder + '</div>',
    '    <p class="remstat-state__title">Sin datos para analizar</p>',
    '    <p class="remstat-state__desc" id="remstat-empty-desc">El Control de Remisiones está vacío.</p>',
    '    <button type="button" class="remstat-btn remstat-btn--primary" id="remstat-retry">' + IC.refresh + ' Reintentar</button>',
    '  </div>',
    '  <div class="remstat-state remstat-hidden" id="remstat-error">',
    '    <div class="remstat-state__icon remstat-state__icon--err">' + IC.err + '</div>',
    '    <p class="remstat-state__title">Error al cargar datos</p>',
    '    <p class="remstat-state__desc" id="remstat-error-desc">—</p>',
    '    <button type="button" class="remstat-btn remstat-btn--primary" id="remstat-retry2">' + IC.refresh + ' Intentar de nuevo</button>',
    '  </div>',
    '  <div class="remstat-grid remstat-hidden" id="remstat-grid">',
    '    <div class="remstat-card remstat-card--donut">',
    '      <div class="remstat-card__head"><h2 class="remstat-card__title">Por sexo</h2></div>',
    '      <div class="remstat-card__body" id="remstat-sexo"></div>',
    '    </div>',
    '    <div class="remstat-card">',
    '      <div class="remstat-card__head"><h2 class="remstat-card__title">Por tipo de evaluación</h2><span class="remstat-card__hint">Según la columna Evaluación Ocupacional</span></div>',
    '      <div class="remstat-card__body" id="remstat-eval"></div>',
    '    </div>',
    '    <div class="remstat-card">',
    '      <div class="remstat-card__head"><h2 class="remstat-card__title">Por rango de edad</h2></div>',
    '      <div class="remstat-card__body" id="remstat-edad"></div>',
    '    </div>',
    '    <div class="remstat-card">',
    '      <div class="remstat-card__head"><h2 class="remstat-card__title">Por concepto médico laboral</h2></div>',
    '      <div class="remstat-card__body" id="remstat-concepto"></div>',
    '    </div>',
    '    <div class="remstat-card">',
    '      <div class="remstat-card__head"><h2 class="remstat-card__title">Top cargos</h2></div>',
    '      <div class="remstat-card__body" id="remstat-cargo"></div>',
    '    </div>',
    '    <div class="remstat-card">',
    '      <div class="remstat-card__head"><h2 class="remstat-card__title">Por estado civil</h2></div>',
    '      <div class="remstat-card__body" id="remstat-civil"></div>',
    '    </div>',
    '  </div>',
    '  <div class="remstat-foot remstat-hidden" id="remstat-foot">',
    '    <span class="remstat-foot__item">' + IC.info + '<span id="remstat-note">—</span></span>',
    '  </div>',
    '</div>',
    '<div class="remstat-toasts" id="remstat-toasts"></div>'
  ].join('\n');

  class EstadisticasRemisionesV2Component {
    constructor(container, opts) {
      opts = opts || {};
      this.container = container;
      this.companyName = opts.companyName || '';
      this.onBack = opts.onBack || null;
      this.logMessage = opts.logMessage || null;

      this.headers = [];
      this.rows = [];
      this.filePath = '';
      this.isDestroyed = false;
      this.raiz = null;
      this._nodosEnBody = [];
      this._obs = null;
    }

    async render() {
      if (this.isDestroyed) return;
      var host = this.container;
      if (!host) { klog('MODULO', 'INIT', 'ERR', 'sin contenedor'); return; }

      this.#limpiarCapas();
      host.innerHTML = '';
      host.style.display = 'flex';
      host.style.flexDirection = 'column';
      host.style.height = '100%';
      host.style.flex = '1';
      host.style.minHeight = '0';
      host.style.overflow = 'hidden';

      this.raiz = document.createElement('div');
      this.raiz.className = 'remstat-scope';
      this.raiz.innerHTML = MARCADO;
      host.appendChild(this.raiz);

      var self = this;
      this._nodosEnBody = [];
      Array.prototype.slice.call(this.raiz.querySelectorAll('.remstat-toasts')).forEach(function (n) {
        var wrap = document.createElement('div');
        wrap.className = 'remstat-scope';
        wrap.appendChild(n);
        document.body.appendChild(wrap);
        self._nodosEnBody.push(wrap);
      });

      if (typeof MutationObserver !== 'undefined') {
        this._obs = new MutationObserver(function () {
          if (!host.isConnected || !self.raiz || !self.raiz.isConnected) self.#limpiarCapas();
        });
        this._obs.observe(document.documentElement, { childList: true, subtree: true });
      }

      this.#bind();
      var emp = this.$('#remstat-emp');
      if (emp) emp.textContent = this.companyName || '—';
      await this.#cargar();
      klog('MODULO', 'INIT', 'OK', 'empresa=' + this.companyName);
    }

    destroy() {
      this.isDestroyed = true;
      this.#limpiarCapas();
      if (this.container) this.container.innerHTML = '';
      this.raiz = null;
      klog('MODULO', 'DESTROY', 'OK', 'capas retiradas');
    }

    #limpiarCapas() {
      if (this._obs) { try { this._obs.disconnect(); } catch (e) {} this._obs = null; }
      this._nodosEnBody.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      this._nodosEnBody = [];
    }

    $(sel) {
      if (!this.raiz) return null;
      var n = this.raiz.querySelector(sel);
      if (n) return n;
      for (var i = 0; i < this._nodosEnBody.length; i++) {
        n = this._nodosEnBody[i].querySelector(sel);
        if (n) return n;
      }
      if (sel.charAt(0) === '#') return document.getElementById(sel.slice(1));
      return null;
    }

    #bind() {
      var self = this;
      var back = this.$('#remstat-back');
      if (back) back.addEventListener('click', function () { if (typeof self.onBack === 'function') self.onBack(); });
      ['#remstat-refresh', '#remstat-retry', '#remstat-retry2'].forEach(function (sel) {
        var b = self.$(sel);
        if (b) b.addEventListener('click', function () { self.#cargar(); });
      });
    }

    /* ── Datos ── */
    async #cargar() {
      this.#show('loading');
      if (!window.electronAPI || typeof window.electronAPI.getControlRemisionesData !== 'function') {
        this.#showError('El servicio de datos no está disponible.');
        return;
      }
      try {
        var result = await window.electronAPI.getControlRemisionesData(this.companyName);
        if (this.isDestroyed) return;
        if (result && result.success) {
          this.headers = Array.isArray(result.headers) ? result.headers : [];
          this.rows = Array.isArray(result.rows) ? result.rows : [];
          this.filePath = result.filePath || '';
          if (this.rows.length) this.#renderStats();
          else {
            var desc = this.$('#remstat-empty-desc');
            if (desc) desc.textContent = 'El Control de Remisiones de ' + (this.companyName || 'la empresa') + ' está vacío.';
            this.#show('empty');
          }
        } else {
          this.#showError((result && result.error) || 'No se pudo leer el Control de Remisiones.');
        }
      } catch (err) {
        klog('DATOS', 'LOAD', 'ERR', err.message);
        if (!this.isDestroyed) this.#showError(err.message);
      }
    }

    #show(estado) {
      var map = { loading: '#remstat-loading', empty: '#remstat-empty', error: '#remstat-error', stats: '#remstat-grid' };
      var self = this;
      Object.keys(map).forEach(function (k) {
        var el = self.$(map[k]);
        if (el) el.classList.toggle('remstat-hidden', k !== estado);
      });
      var foot = this.$('#remstat-foot');
      if (foot) foot.classList.toggle('remstat-hidden', estado !== 'stats');
    }

    #showError(msg) {
      var desc = this.$('#remstat-error-desc');
      if (desc) desc.textContent = msg;
      this.#show('error');
    }

    /* ── Helpers de columnas y normalización ── */
    #colIdx(patron) {
      var p = String(patron).toLowerCase();
      for (var i = 0; i < this.headers.length; i++) {
        if (String(this.headers[i] == null ? '' : this.headers[i]).trim().toLowerCase().indexOf(p) !== -1) return i;
      }
      return -1;
    }
    #val(row, idx) {
      if (idx < 0 || !Array.isArray(row)) return '';
      var v = row[idx];
      return v === null || v === undefined ? '' : String(v).trim();
    }
    #normSexo(v) {
      var s = String(v).toLowerCase();
      if (s.indexOf('fem') !== -1) return 'Femenino';
      if (s.indexOf('masc') !== -1) return 'Masculino';
      return 'Sin dato';
    }
    #normEval(v) {
      var s = String(v).toLowerCase();
      if (!s) return 'Sin especificar';
      if (s.indexOf('ingreso') !== -1) return 'Ingreso';
      if (s.indexOf('egreso') !== -1) return 'Egreso';
      if (s.indexOf('period') !== -1) return 'Periódico';
      if (s.indexOf('post') !== -1) return 'Post-incapacidad';
      if (s.indexOf('retiro') !== -1) return 'Retiro';
      if (s.indexOf('seguim') !== -1) return 'Seguimiento';
      if (s.indexOf('cambio') !== -1) return 'Cambio de ocupación';
      return v;
    }
    #normConcepto(v) {
      var s = String(v).toLowerCase();
      if (!s) return 'Sin especificar';
      if (s.indexOf('no apto') !== -1) return 'No apto';
      if (s.indexOf('aplaz') !== -1) return 'Aplazado';
      if (s.indexOf('recomend') !== -1) return 'Apto con recomendaciones';
      if (s.indexOf('apto') !== -1) return 'Apto';
      return v;
    }
    #normCivil(v) {
      var s = String(v).toLowerCase();
      if (!s) return 'Sin dato';
      if (s.indexOf('solter') !== -1) return 'Soltero(a)';
      if (s.indexOf('casado') !== -1) return 'Casado(a)';
      if (s.indexOf('separado') !== -1) return 'Separado(a)';
      if (s.indexOf('viud') !== -1) return 'Viudo(a)';
      if (s.indexOf('uni') !== -1 && s.indexOf('libre') !== -1) return 'Unión libre';
      return v;
    }
    #rangoEdad(n) {
      if (!isFinite(n) || n <= 0) return 'Sin dato';
      if (n < 30) return '< 30';
      if (n < 40) return '30 - 39';
      if (n < 50) return '40 - 49';
      if (n < 60) return '50 - 59';
      return '60 +';
    }
    #contar(valores) {
      var m = {};
      valores.forEach(function (v) { var k = v || 'Sin dato'; m[k] = (m[k] || 0) + 1; });
      return Object.keys(m).map(function (k) { return { k: k, n: m[k] }; }).sort(function (a, b) { return b.n - a.n; });
    }

    #renderStats() {
      var self = this;
      var iEdad = this.#colIdx('edad');
      var iSexo = this.#colIdx('sexo');
      var iEval = this.#colIdx('evaluación ocupacional') >= 0 ? this.#colIdx('evaluación ocupacional') : this.#colIdx('evaluacion ocupacional');
      var iConcepto = this.#colIdx('concepto medico laboral') >= 0 ? this.#colIdx('concepto medico laboral') : this.#colIdx('concepto médico laboral');
      var iCargo = this.#colIdx('cargo');
      var iCivil = this.#colIdx('estado civil');
      var ultima = this.headers.length - 1;

      var edades = [], sexos = [], evals = [], conceptos = [], cargos = [], civiles = [];
      var conSeg = 0;
      this.rows.forEach(function (row) {
        var edad = parseFloat(self.#val(row, iEdad));
        if (isFinite(edad)) edades.push(edad);
        sexos.push(self.#normSexo(self.#val(row, iSexo)));
        evals.push(self.#normEval(self.#val(row, iEval)));
        conceptos.push(self.#normConcepto(self.#val(row, iConcepto)));
        cargos.push(self.#val(row, iCargo) || 'Sin cargo');
        civiles.push(self.#normCivil(self.#val(row, iCivil)));
        if (self.#val(row, ultima) !== '') conSeg++;
      });

      var total = this.rows.length;
      var prom = edades.length ? Math.round(edades.reduce(function (a, b) { return a + b; }, 0) / edades.length) : null;
      this.#setKpi('remstat-k-total', total);
      this.#setKpi('remstat-k-seg', conSeg);
      this.#setKpi('remstat-k-pend', total - conSeg);
      this.#setKpi('remstat-k-edad', prom === null ? '—' : prom + ' años');

      // Donut de sexo
      var dSexo = this.#contar(sexos);
      this.#renderDonut('#remstat-sexo', dSexo, ['#2057b8', '#1bb888', '#aab1bd']);

      // Barras horizontales
      this.#renderBars('#remstat-eval', this.#contar(evals));
      this.#renderBars('#remstat-concepto', this.#contar(conceptos));
      this.#renderBars('#remstat-cargo', this.#contar(cargos).slice(0, 6));
      this.#renderBars('#remstat-civil', this.#contar(civiles));

      // Rango de edad (columnas)
      var orden = ['< 30', '30 - 39', '40 - 49', '50 - 59', '60 +', 'Sin dato'];
      var rMap = {};
      this.#contar(edades.map(function (n) { return self.#rangoEdad(n); })).forEach(function (x) { rMap[x.k] = x.n; });
      var rArr = orden.filter(function (k) { return rMap[k]; }).map(function (k) { return { k: k, n: rMap[k] }; });
      this.#renderCols('#remstat-edad', rArr);

      var nota = this.$('#remstat-note');
      if (nota) {
        var conFecha = this.rows.filter(function (r) { return self.#val(r, self.#colIdx('fecha de atención')) !== ''; }).length;
        nota.textContent = total + ' remisiones analizadas del Control (GI-FO-012)' +
          (conFecha < total ? ' · ' + (total - conFecha) + ' sin fecha de atención (no entran en series por mes)' : '');
      }
      this.#show('stats');
    }

    #setKpi(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

    /* Barras horizontales (cajas HTML, nunca SVG estirado) */
    #renderBars(sel, datos) {
      var box = this.$(sel);
      if (!box) return;
      if (!datos.length) { box.innerHTML = '<p class="remstat-none">Sin datos</p>'; return; }
      var max = datos.reduce(function (a, d) { return Math.max(a, d.n); }, 0) || 1;
      var total = datos.reduce(function (a, d) { return a + d.n; }, 0) || 1;
      box.innerHTML = datos.map(function (d) {
        var pct = Math.round((d.n / max) * 100);
        var share = Math.round((d.n / total) * 100);
        return '<div class="remstat-bar">' +
          '<span class="remstat-bar__label" title="' + this.#esc(d.k) + '">' + this.#esc(d.k) + '</span>' +
          '<span class="remstat-bar__track"><span class="remstat-bar__fill" style="width:' + pct + '%"></span></span>' +
          '<span class="remstat-bar__value">' + d.n + ' <small>' + share + '%</small></span>' +
          '</div>';
      }.bind(this)).join('');
    }

    /* Barras verticales (rango de edad) */
    #renderCols(sel, datos) {
      var box = this.$(sel);
      if (!box) return;
      if (!datos.length) { box.innerHTML = '<p class="remstat-none">Sin datos</p>'; return; }
      var max = datos.reduce(function (a, d) { return Math.max(a, d.n); }, 0) || 1;
      box.innerHTML = '<div class="remstat-cols">' + datos.map(function (d) {
        var h = Math.max(6, Math.round((d.n / max) * 100));
        return '<div class="remstat-col">' +
          '<span class="remstat-col__n">' + d.n + '</span>' +
          '<span class="remstat-col__bar" style="height:' + h + '%"></span>' +
          '<span class="remstat-col__label">' + this.#esc(d.k) + '</span>' +
          '</div>';
      }.bind(this)).join('') + '</div>';
    }

    /* Donut SVG (sexo) */
    #renderDonut(sel, datos, colores) {
      var box = this.$(sel);
      if (!box) return;
      var total = datos.reduce(function (a, d) { return a + d.n; }, 0);
      if (!total) { box.innerHTML = '<p class="remstat-none">Sin datos</p>'; return; }
      var R = 54, C = 2 * Math.PI * R, acc = 0;
      var segs = datos.map(function (d, i) {
        var frac = d.n / total;
        var len = frac * C;
        var seg = '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="' + colores[i % colores.length] + '" stroke-width="20" ' +
          'stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-acc).toFixed(2) + '" ' +
          'transform="rotate(-90 70 70)"/>';
        acc += len;
        return seg;
      }).join('');
      var leyenda = datos.map(function (d, i) {
        var share = Math.round((d.n / total) * 100);
        return '<div class="remstat-legend__item"><span class="remstat-dot" style="background:' + colores[i % colores.length] + '"></span>' +
          '<span class="remstat-legend__k">' + this.#esc(d.k) + '</span><span class="remstat-legend__v">' + d.n + ' · ' + share + '%</span></div>';
      }.bind(this)).join('');
      box.innerHTML = '<div class="remstat-donut">' +
        '<div class="remstat-donut__svg"><svg viewBox="0 0 140 140">' + segs +
        '<text x="70" y="66" text-anchor="middle" class="remstat-donut__num">' + total + '</text>' +
        '<text x="70" y="84" text-anchor="middle" class="remstat-donut__cap">remisiones</text></svg></div>' +
        '<div class="remstat-legend">' + leyenda + '</div></div>';
    }

    #esc(s) {
      var d = document.createElement('div');
      d.textContent = s === null || s === undefined ? '' : String(s);
      return d.innerHTML;
    }

    #toast(titulo, mensaje, tipo) {
      var box = this.$('#remstat-toasts');
      if (!box) return;
      tipo = tipo || 'info';
      var icon = tipo === 'success' ? IC.check : tipo === 'error' ? IC.err : tipo === 'warning' ? IC.warn : IC.info;
      var el = document.createElement('div');
      el.className = 'remstat-toast remstat-toast--' + tipo;
      el.innerHTML = icon + '<div><p class="remstat-toast__title"></p><p class="remstat-toast__msg"></p></div>';
      el.querySelector('.remstat-toast__title').textContent = titulo;
      el.querySelector('.remstat-toast__msg').textContent = mensaje;
      box.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 5000);
    }
  }

  window.EstadisticasRemisionesV2Component = EstadisticasRemisionesV2Component;
  klog('REGISTRO', 'GLOBAL', 'OK', 'window.EstadisticasRemisionesV2Component');
})();
