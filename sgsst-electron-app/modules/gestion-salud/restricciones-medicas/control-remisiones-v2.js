/* ============================================================
   K+AIR · 3.1.6 Control de Remisiones — premium v2
   Componente embebido. Conserva el contrato de datos:

     · window.electronAPI.getControlRemisionesData(companyName)
         → { success, headers: [...], rows: [[...]], filePath, error }
     · window.electronAPI.updateExcelCell({ filePath, cellAddress, newValue })
         — dirección A1 (ej. "N5"), firma real del backend (la versión
           anterior llamaba con argumentos sueltos y nunca guardaba.
     · window.electronAPI.openPath(filePath) — abre el Excel.

   El montaje lo hace RestriccionesMedicasComponent._renderControlRemisionesView()
   con: new ControlRemisionesV2Component(container, { ... }).

   LECCIONES APLICADAS: avisos al <body> envueltos en .remctl-scope,
   destroy() + vigía de navegación, render repetido sin duplicar capas.
   ============================================================ */
(function () {
  'use strict';

  var TAG = 'K+AIRECTL';
  function klog(mod, acc, st, extra) {
    var l = '[' + TAG + '][' + mod + '][' + acc + '][' + st + ']' + (extra ? ' ' + extra : '');
    if (st === 'ERR') console.warn(l); else console.log(l);
  }

  var IC = {
    table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    err: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>'
  };

  var MARCADO = [
    '<div class="remctl-header">',
    '  <span class="remctl-header__icon">' + IC.table + '</span>',
    '  <div class="remctl-header__text">',
    '    <h1 class="remctl-header__title">Control de Remisiones</h1>',
    '    <p class="remctl-header__sub">Seguimiento al estado de las remisiones enviadas a las EPS — la última columna es editable</p>',
    '  </div>',
    '  <span class="remctl-header__chip" title="Empresa activa">' + IC.building + '<span id="remctl-emp">—</span></span>',
    '  <div class="remctl-header__actions">',
    '    <button type="button" class="remctl-btn remctl-btn--ghost" id="remctl-open" title="Abrir el archivo de control en Excel">' + IC.folder + ' Abrir Excel</button>',
    '    <button type="button" class="remctl-btn remctl-btn--ghost" id="remctl-refresh" title="Actualizar">' + IC.refresh + ' Refrescar</button>',
    '    <button type="button" class="remctl-btn remctl-btn--ghost" id="remctl-back">' + IC.arrowLeft + ' Volver</button>',
    '  </div>',
    '</div>',
    '<div class="remctl-kpis">',
    '  <div class="remctl-kpi remctl-kpi--blue"><span class="remctl-kpi__icon">' + IC.users + '</span><div><div class="remctl-kpi__value" id="remctl-k-total">0</div><div class="remctl-kpi__label">Registros</div></div></div>',
    '  <div class="remctl-kpi remctl-kpi--green"><span class="remctl-kpi__icon">' + IC.check + '</span><div><div class="remctl-kpi__value" id="remctl-k-seg">0</div><div class="remctl-kpi__label">Con seguimiento</div></div></div>',
    '  <div class="remctl-kpi remctl-kpi--amber"><span class="remctl-kpi__icon">' + IC.clock + '</span><div><div class="remctl-kpi__value" id="remctl-k-pend">0</div><div class="remctl-kpi__label">Pendientes</div></div></div>',
    '  <div class="remctl-kpi remctl-kpi--violet"><span class="remctl-kpi__icon">' + IC.file + '</span><div><div class="remctl-kpi__value" id="remctl-k-arch" style="font-size:14px;line-height:1.3;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">—</div><div class="remctl-kpi__label">Archivo de control</div></div></div>',
    '</div>',
    '<div class="remctl-body">',
    '  <div class="remctl-card">',
    '    <div class="remctl-card__head">' + IC.table + '<h2 class="remctl-card__title">Registros de remisiones</h2><span class="remctl-card__count" id="remctl-count">0 registros</span></div>',
    '    <div class="remctl-skeleton" id="remctl-loading">',
    '      <div class="remctl-skeleton__row" style="width:92%"></div>',
    '      <div class="remctl-skeleton__row" style="width:78%"></div>',
    '      <div class="remctl-skeleton__row" style="width:85%"></div>',
    '      <div class="remctl-skeleton__row" style="width:70%"></div>',
    '      <div class="remctl-skeleton__row" style="width:88%"></div>',
    '    </div>',
    '    <div class="remctl-state remctl-hidden" id="remctl-empty">',
    '      <div class="remctl-state__icon">' + IC.folder + '</div>',
    '      <p class="remctl-state__title">No hay datos disponibles</p>',
    '      <p class="remctl-state__desc" id="remctl-empty-desc">El archivo de control está vacío.</p>',
    '      <button type="button" class="remctl-btn remctl-btn--primary" id="remctl-retry">' + IC.refresh + ' Reintentar</button>',
    '    </div>',
    '    <div class="remctl-state remctl-hidden" id="remctl-error">',
    '      <div class="remctl-state__icon remctl-state__icon--err">' + IC.err + '</div>',
    '      <p class="remctl-state__title">Error al cargar datos</p>',
    '      <p class="remctl-state__desc" id="remctl-error-desc">—</p>',
    '      <button type="button" class="remctl-btn remctl-btn--primary" id="remctl-retry2">' + IC.refresh + ' Intentar de nuevo</button>',
    '    </div>',
    '    <div class="remctl-tablewrap remctl-hidden" id="remctl-wrap">',
    '      <table class="remctl-table"><thead id="remctl-thead"></thead><tbody id="remctl-tbody"></tbody></table>',
    '    </div>',
    '    <div class="remctl-foot remctl-hidden" id="remctl-foot">',
    '      <span class="remctl-foot__item">' + IC.folder + '<span id="remctl-path" title=""></span></span>',
    '      <span class="remctl-foot__item">' + IC.pencil + '<span>Los cambios en la última columna se guardan directo en el Excel</span></span>',
    '    </div>',
    '  </div>',
    '</div>',
    '<div class="remctl-toasts" id="remctl-toasts"></div>'
  ].join('\n');

  class ControlRemisionesV2Component {
    constructor(container, opts) {
      opts = opts || {};
      this.container = container;
      this.companyName = opts.companyName || '';
      this.onBack = opts.onBack || null;
      this.logMessage = opts.logMessage || null;

      this.headers = [];
      this.rows = [];
      this.rowNumbers = [];
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
      this.raiz.className = 'remctl-scope';
      this.raiz.innerHTML = MARCADO;
      host.appendChild(this.raiz);

      var self = this;
      this._nodosEnBody = [];
      Array.prototype.slice.call(this.raiz.querySelectorAll('.remctl-toasts')).forEach(function (n) {
        var wrap = document.createElement('div');
        wrap.className = 'remctl-scope';
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
      var emp = this.$('#remctl-emp');
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
      var back = this.$('#remctl-back');
      if (back) back.addEventListener('click', function () {
        if (typeof self.onBack === 'function') self.onBack();
      });
      var refresh = this.$('#remctl-refresh');
      if (refresh) refresh.addEventListener('click', function () { self.#cargar(); });
      var retry = this.$('#remctl-retry');
      if (retry) retry.addEventListener('click', function () { self.#cargar(); });
      var retry2 = this.$('#remctl-retry2');
      if (retry2) retry2.addEventListener('click', function () { self.#cargar(); });
      var open = this.$('#remctl-open');
      if (open) open.addEventListener('click', function () {
        if (!self.filePath) { self.#toast('Sin archivo', 'Aún no se ha identificado el archivo de control.', 'warning'); return; }
        if (window.electronAPI && typeof window.electronAPI.openPath === 'function') {
          window.electronAPI.openPath(self.filePath);
        }
      });
    }

    /* ── Datos ── */
    async #cargar() {
      var self = this;
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
          this.rowNumbers = Array.isArray(result.rowNumbers) ? result.rowNumbers : [];
          this.filePath = result.filePath || '';
          if (this.rows.length) this.#renderTable();
          else {
            var desc = this.$('#remctl-empty-desc');
            if (desc) desc.textContent = 'El archivo de control para ' + (this.companyName || 'la empresa') + ' está vacío.';
            this.#show('empty');
          }
        } else {
          this.#showError((result && result.error) || 'No se pudo leer el archivo de control.');
        }
      } catch (err) {
        klog('DATOS', 'LOAD', 'ERR', err.message);
        if (!this.isDestroyed) this.#showError(err.message);
      }
    }

    #show(estado) {
      var map = { loading: '#remctl-loading', empty: '#remctl-empty', error: '#remctl-error', table: '#remctl-wrap' };
      var self = this;
      Object.keys(map).forEach(function (k) {
        var el = self.$(map[k]);
        if (el) el.classList.toggle('remctl-hidden', k !== estado);
      });
      var foot = this.$('#remctl-foot');
      if (foot) foot.classList.toggle('remctl-hidden', estado !== 'table');
    }

    #showError(msg) {
      var desc = this.$('#remctl-error-desc');
      if (desc) desc.textContent = msg;
      this.#show('error');
    }

    #renderTable() {
      var self = this;
      var thead = this.$('#remctl-thead'), tbody = this.$('#remctl-tbody');
      if (!thead || !tbody) return;

      var ultimaIdx = this.headers.length - 1;
      thead.innerHTML = '<tr>' + this.headers.map(function (h, i) {
        return '<th' + (i === ultimaIdx ? ' title="Columna editable"' : '') + '>' + self.#esc(h) + '</th>';
      }).join('') + '</tr>';

      tbody.innerHTML = '';
      this.rows.forEach(function (row, rowIndex) {
        var tr = document.createElement('tr');
        (Array.isArray(row) ? row : []).forEach(function (cellData, cellIndex) {
          var td = document.createElement('td');
          if (cellIndex === row.length - 1) {
            td.className = 'remctl-td--edit';
            var input = document.createElement('input');
            input.type = 'text';
            input.className = 'remctl-input';
            input.placeholder = 'Añadir observación…';
            input.value = cellData !== null && cellData !== undefined ? String(cellData) : '';
            input.addEventListener('change', function (e) {
              self.#guardarCelda(rowIndex, cellIndex, e.target.value, input);
            });
            td.appendChild(input);
          } else {
            td.textContent = cellData !== null && cellData !== undefined ? String(cellData) : '';
            if (cellIndex === 0) td.className = 'remctl-td--num';
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });

      /* KPIs */
      var conSeg = this.rows.filter(function (r) {
        var last = Array.isArray(r) ? r[r.length - 1] : null;
        return last !== null && last !== undefined && String(last).trim() !== '';
      }).length;
      this.#setKpi('remctl-k-total', this.rows.length);
      this.#setKpi('remctl-k-seg', conSeg);
      this.#setKpi('remctl-k-pend', this.rows.length - conSeg);
      var arch = this.filePath ? String(this.filePath).split('\\').pop().split('/').pop() : '—';
      this.#setKpi('remctl-k-arch', arch);
      var count = this.$('#remctl-count');
      if (count) count.textContent = this.rows.length + (this.rows.length === 1 ? ' registro' : ' registros');
      var path = this.$('#remctl-path');
      if (path) { path.textContent = this.filePath || '—'; path.title = this.filePath || ''; }

      this.#show('table');
    }

    #setKpi(id, v) {
      var el = document.getElementById(id);
      if (el) el.textContent = v;
    }

    /* Guardado: firma real del backend { filePath, cellAddress, newValue } —
       la versión anterior pasaba argumentos sueltos y el guardado fallaba. */
    async #guardarCelda(rowIndex, colIndex, newValue, input) {
      if (!this.filePath) {
        this.#toast('Sin archivo', 'No se identificó el archivo de control.', 'error');
        return;
      }
      if (!window.electronAPI || typeof window.electronAPI.updateExcelCell !== 'function') {
        this.#toast('Sin conexión', 'El servicio de guardado no está disponible.', 'error');
        return;
      }
      try {
        // 📦778 — el backend descarta filas vacías y encabezados repetidos, así
        // que el índice de la fila ya no coincide con la fila real del Excel.
        // `rowNumbers[rowIndex]` guarda el nº de fila REAL para escribir bien.
        var excelRow = this.rowNumbers[rowIndex] || (rowIndex + 2);
        var result = await window.electronAPI.updateExcelCell({
          filePath: this.filePath,
          cellAddress: this.#direccionA1(colIndex, excelRow),
          newValue: newValue
        });
        if (result && result.success) {
          if (input) { input.classList.add('is-saved'); setTimeout(function () { input.classList.remove('is-saved'); }, 1400); }
          this.#toast('Guardado', 'La observación se guardó en el Excel de control.', 'success');
          if (this.logMessage) this.logMessage('Control de remisiones: celda actualizada (' + this.#direccionA1(colIndex, excelRow) + ').');
        } else {
          this.#toast('Error al guardar', (result && result.error) || 'No se pudo escribir en el Excel.', 'error');
        }
      } catch (err) {
        klog('DATOS', 'SAVE', 'ERR', err.message);
        this.#toast('Error al guardar', err.message, 'error');
      }
    }

    /* Columna 0 → A, 13 → N, 26 → AA … ; excelRow = nº de fila REAL del Excel (1-based) */
    #direccionA1(colIndex, excelRow) {
      var n = colIndex + 1, letras = '';
      while (n > 0) { var m = (n - 1) % 26; letras = String.fromCharCode(65 + m) + letras; n = Math.floor((n - 1) / 26); }
      return letras + excelRow;
    }

    #esc(s) {
      var d = document.createElement('div');
      d.textContent = s === null || s === undefined ? '' : String(s);
      return d.innerHTML;
    }

    #toast(titulo, mensaje, tipo) {
      var box = this.$('#remctl-toasts');
      if (!box) return;
      tipo = tipo || 'info';
      var icon = tipo === 'success' ? IC.check : tipo === 'error' ? IC.err : tipo === 'warning' ? IC.warn : IC.info;
      var el = document.createElement('div');
      el.className = 'remctl-toast remctl-toast--' + tipo;
      el.innerHTML = icon + '<div><p class="remctl-toast__title"></p><p class="remctl-toast__msg"></p></div>';
      el.querySelector('.remctl-toast__title').textContent = titulo;
      el.querySelector('.remctl-toast__msg').textContent = mensaje;
      box.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 5000);
    }
  }

  window.ControlRemisionesV2Component = ControlRemisionesV2Component;
  klog('REGISTRO', 'GLOBAL', 'OK', 'window.ControlRemisionesV2Component');
})();
