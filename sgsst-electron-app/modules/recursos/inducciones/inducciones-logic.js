/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Inducción y Reinducción — premium v2 (port del target kair-induccion.html)
   InduccionesComponent: shell premium + motor de métricas + 6 gráficas SVG
   runtime + registro (paginación/búsqueda) + modal + toasts + CSV,
   conectado a datos reales vía IPC (getInduccionesData) con normalizador.
   Se conservan: syncFromForms (Google Forms), checkInduccionesChanges +
   banner, backToModuleCallback, updateNotifier, sample fallback.
   Regla de oro: estado derivado (puntaje>=20 aprueba); refreshAll() único.
   ═══════════════════════════════════════════════════════════════════ */

var INDUC_TOKEN = 'INDUCCIONES-20261126-v23-pickers';
console.log('%c[Inducciones] Versión cargada: ' + INDUC_TOKEN, 'color:#2057b8;font-weight:bold');

/* ---------- 0. Logging + helpers puros (sin DOM) ---------- */
function indLog(mod, acc, st, extra) {
  console.log('[K+AIRIND][' + mod + '][' + acc + '][' + st + ']', extra !== undefined ? extra : '');
}
function indEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function indDebounce(fn, ms) {
  var t;
  return function () {
    var a = arguments, self = this;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(self, a); }, ms);
  };
}
function indFmtDate(iso) {
  var p = String(iso || '').split('-');
  return (p.length === 3) ? p[2] + '/' + p[1] + '/' + p[0] : String(iso || '');
}
function indInitials(name) {
  var w = String(name || '').trim().split(/\s+/);
  return (((w[0] || '').charAt(0) + (w[1] || '').charAt(0)).toUpperCase() || '?');
}

var IND_MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
var IND_MESES_F = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
var IND_UMBRAL_APR = 20, IND_PUNTAJE_MAX = 22;

var IND_ICO = {
  pencil: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  checkC: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8.5 12 2.5 2.5 5-5"/></svg>',
  alert: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  info: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  scale: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>',
  users: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  chevL: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  chevR: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>'
};
var IND_DONUT_COLORS = { H: '#2057B8', M: '#A9C6F2' };
var IND_DONUT_NAMES = { H: 'Hombres', M: 'Mujeres' };

function indEstadoDe(r) { return r.puntaje >= IND_UMBRAL_APR ? 'APROBADO' : 'REPROBADO'; }
function indScoreColor(p) {
  return p >= IND_UMBRAL_APR ? 'var(--kair-green)' : (p >= 16 ? 'var(--kair-amber)' : 'var(--kair-red)');
}
function indLinePath(arr, x, yf) {
  var d = '';
  arr.forEach(function (v, i) { d += (i === 0 ? 'M' : ' L') + (x(i)).toFixed(1) + ' ' + (yf(v)).toFixed(1); });
  return d;
}
function indAreaPath(arr, x, yf, base) {
  var d = indLinePath(arr, x, yf);
  d += ' L' + x(arr.length - 1).toFixed(1) + ' ' + base + ' L' + x(0).toFixed(1) + ' ' + base + ' Z';
  return d;
}
function indRoundTop(bx, by, bw, bh, rr) {
  var r = Math.min(rr, bh / 2, bw / 2);
  return 'M' + bx + ' ' + (by + bh) + ' L' + bx + ' ' + (by + r) + ' Q' + bx + ' ' + by + ' ' + (bx + r) + ' ' + by +
    ' L' + (bx + bw - r) + ' ' + by + ' Q' + (bx + bw) + ' ' + by + ' ' + (bx + bw) + ' ' + (by + r) +
    ' L' + (bx + bw) + ' ' + (by + bh) + ' Z';
}

class InduccionesComponent {
  constructor(container, currentCompany, moduleName, submoduleName, backToModuleCallback) {
    this.container = container;
    this.currentCompany = currentCompany;
    this.moduleName = moduleName;
    this.submoduleName = submoduleName;
    this.backToModuleCallback = backToModuleCallback;
    // Dataset normalizado (forma target) + estado + periodo
    this._db = [];
    this._periodo = { anio: new Date().getFullYear() };
    this._st = { view: 'dashboard', editId: null, page: 1, pageSize: 10,
      filters: { anio: String(new Date().getFullYear()), genero: 'all', estado: 'all', q: '' } };
    this._lastFocus = null;
    this._resizeHandler = null;
    this._keyHandler = null;
    this._currentHash = null;
    this._lastSyncTime = null;
  }

  /* ---------- queries scopeadas al container ---------- */
  q(sel) { return this.container.querySelector(sel); }
  qa(sel) { return Array.prototype.slice.call(this.container.querySelectorAll(sel)); }

  /* ================= CICLO DE VIDA ================= */
  async render() {
    this.container.innerHTML = '';
    this.container.classList.add('inducciones-container');
    this.container.style.position = 'relative';
    this.container.style.overflowY = 'auto';
    window.currentInduccionesComponent = this;
    try {
      const response = await fetch('./modules/recursos/inducciones/inducciones-view.html?v=' + INDUC_TOKEN);
      const html = await response.text();
      this.container.innerHTML = html;
      setTimeout(async () => {
        this._bindEvents();
        await this.loadData();
      }, 100);
    } catch (error) {
      console.error('Error cargando inducciones-view.html:', error);
      this.container.innerHTML = '<div class="alert alert-danger">Error: ' + indEsc(error.message) + '</div>';
    }
  }

  async loadData() {
    const notifier = window.updateNotifier;
    try {
      console.log('🔄 [Inducciones] Cargando datos reales para:', this.currentCompany);
      if (!window.electronAPI || !window.electronAPI.getInduccionesData) {
        throw new Error('API de inducciones no disponible');
      }
      const result = await window.electronAPI.getInduccionesData(this.currentCompany);
      if (result.success) {
        console.log('✅ [Inducciones] Datos cargados:', result.data.length, 'registros');
        this._db = (result.data || []).map((r) => this._normRecord(r)).filter(Boolean);
        this._currentHash = result.currentHash || null;
        this._lastSyncTime = new Date();
        this._afterDataReady();
        if (notifier) {
          notifier.show({ type: 'success', title: 'Datos Cargados',
            subtitle: this._db.length + ' registros cargados desde Excel', autoClose: 3000 });
        }
        setTimeout(() => this.checkForChanges(), 1000);
      } else {
        console.warn('⚠️ [Inducciones] No se pudieron cargar datos reales:', result.error);
        if (notifier) {
          notifier.show({ type: 'warning', title: 'Archivo no encontrado',
            subtitle: 'Usando datos de ejemplo', autoClose: 4000 });
        }
        this.loadSampleData();
      }
    } catch (error) {
      console.error('❌ [Inducciones] Error en loadData:', error);
      if (notifier) {
        notifier.show({ type: 'error', title: 'Error', subtitle: 'Error al acceder al archivo Excel', autoClose: 5000 });
      }
      this.loadSampleData();
    }
  }

  _afterDataReady() {
    // Año por defecto = máximo presente en datos (o año actual si vacío)
    var maxY = 0;
    this._db.forEach((r) => { var y = parseInt(r.fecha.slice(0, 4), 10); if (y > maxY) maxY = y; });
    this._periodo.anio = maxY || new Date().getFullYear();
    this._st.filters.anio = String(this._periodo.anio);
    this._st.page = 1;
    this.populateAnios();
    this.populateCargos();
    this._hideBoot();
    var self = this;
    setTimeout(function () {
      self.refreshAll();
      indLog('DASHBOARD', 'RENDER', 'OK');
      indLog('TABLE', 'RENDER', 'OK', self._db.length + ' registros');
    }, 80);
  }

  loadSampleData() {
    this._db = [
      { id: 's1', fecha: '2024-01-10', nombre: 'Carlos Pérez (Simulado)', cedula: '80123456', cargo: 'Supernumerario', genero: 'H', puntaje: 22 },
      { id: 's2', fecha: '2024-02-15', nombre: 'Ana Gómez (Simulado)', cedula: '80234567', cargo: 'Mesera', genero: 'M', puntaje: 21 }
    ];
    this._afterDataReady();
  }

  destroy() {
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    // 📦1108 — Los listeners globales de los desplegables tambien se
    // quitan: si no, se acumulan cada vez que se entra al modulo.
    if (this._indDocClick) document.removeEventListener('click', this._indDocClick);
    if (this._indDocKey) document.removeEventListener('keydown', this._indDocKey);
    if (this._indDocScroll) document.removeEventListener('scroll', this._indDocScroll, true);
    this._resizeHandler = null;
    this._keyHandler = null;
    this._indDocClick = null;
    this._indDocKey = null;
    this._indDocScroll = null;
    window.currentInduccionesComponent = null;
  }

  init() {}

  /* ================= NORMALIZADOR (IPC → forma target) ================= */
  _normGenero(g) {
    var s = String(g == null ? '' : g).trim().toLowerCase();
    if (s === 'h' || s === 'hombre' || s === 'masculino') return 'H';
    if (s === 'm' || s === 'mujer' || s === 'femenino' || s === 'f') return 'M';
    return null;
  }
  _normRecord(raw) {
    if (!raw) return null;
    var fecha = String(raw.fecha || raw.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
    var puntaje = Number(raw.puntaje != null ? raw.puntaje : raw.score);
    if (isNaN(puntaje)) return null;
    puntaje = Math.max(0, Math.min(IND_PUNTAJE_MAX, Math.round(puntaje)));
    return {
      id: String(raw.id != null ? raw.id : ('n' + Date.now())),
      fecha: fecha,
      nombre: String(raw.nombre || raw.name || '').trim(),
      cedula: String(raw.cedula || raw.idCard || '').replace(/\D/g, ''),
      cargo: String(raw.cargo || raw.position || '').trim(),
      genero: this._normGenero(raw.genero != null ? raw.genero : raw.gender),
      puntaje: puntaje
    };
  }

  /* ================= FILTROS ================= */
  filteredBase() {
    var f = this._st.filters;
    return this._db.filter(function (r) {
      if (f.anio !== 'all' && r.fecha.slice(0, 4) !== f.anio) return false;
      if (f.genero !== 'all' && r.genero !== f.genero) return false;
      return true;
    });
  }
  filtered() {
    var f = this._st.filters;
    var q = f.q.trim().toLowerCase();
    var rows = this.filteredBase().filter(function (r) {
      if (f.estado !== 'all' && indEstadoDe(r) !== f.estado) return false;
      if (q && r.nombre.toLowerCase().indexOf(q) === -1 && r.cedula.indexOf(q) === -1) return false;
      return true;
    });
    rows.sort(function (a, b) { return a.fecha < b.fecha ? 1 : (a.fecha > b.fecha ? -1 : 0); });
    return rows;
  }
  setAnio(v) {
    this._st.filters.anio = v;
    this._st.page = 1;
    var d = this.q('#d-anio'), f = this.q('#f-anio');
    if (d) d.value = v;
    if (f) f.value = v;
    // 📦1108 — El boton del desplegable tiene que decir lo mismo que el
    // filtro: si no, se ve un año y se filtra por otro.
    this._syncIndPickers();
    this.refreshAll();
    indLog('FILTER', 'ANIO', 'OK', v);
  }
  clearRegistroFilters() {
    this._st.filters.estado = 'all';
    this._st.filters.q = '';
    this._st.page = 1;
    var e = this.q('#f-estado'), b = this.q('#f-buscar');
    if (e) e.value = 'all';
    if (b) b.value = '';
    this._syncIndPickers();
    this.renderTable();
    indLog('FILTER', 'CLEAR', 'OK');
  }
  populateAnios() {
    var set = {};
    this._db.forEach(function (r) { set[r.fecha.slice(0, 4)] = 1; });
    var years = Object.keys(set).sort().reverse();
    if (years.indexOf(String(this._periodo.anio)) === -1) years.unshift(String(this._periodo.anio));
    var html = years.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('') +
      '<option value="all">Todos</option>';
    var d = this.q('#d-anio'), f = this.q('#f-anio');
    if (d) { d.innerHTML = html; d.value = this._st.filters.anio; }
    if (f) { f.innerHTML = html; f.value = this._st.filters.anio; }
    // 📦1108 — Las opciones del desplegable de años se leen del campo: hay
    // que resincronizar el boton o seguiría diciendo el texto inicial.
    this._syncIndPickers();
  }
  populateCargos() {
    var set = {};
    this._db.forEach(function (r) { if (r.cargo) set[r.cargo.trim()] = 1; });
    var dl = this.q('#cargos-list');
    if (dl) dl.innerHTML = Object.keys(set).sort().map(function (c) { return '<option value="' + indEsc(c) + '"></option>'; }).join('');
  }

  /* ================= DESPLEGABLES PROPIOS (ind-) ================= */
  /** La grilla del mes en 42 celdas (6 semanas): la que ya usan el resto de
   *  los desplegables de la app. Pura: sin this y sin DOM. */
  _buildMonthGridInd(year, month) {
    var DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var bisiesto = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    var diasDelMes = (month === 1 && bisiesto) ? 29 : DIAS_MES[month];
    var aIso = function (f) {
      var mm = String(f.getMonth() + 1).padStart(2, '0');
      var dd = String(f.getDate()).padStart(2, '0');
      return f.getFullYear() + '-' + mm + '-' + dd;
    };
    var offset = (new Date(year, month, 1).getDay() + 6) % 7;
    var celdas = [];
    var i;
    for (i = offset; i >= 1; i--) {
      var f = new Date(year, month, 1 - i);
      celdas.push({ iso: aIso(f), day: f.getDate(), inMonth: false });
    }
    for (var d = 1; d <= diasDelMes; d++) {
      celdas.push({ iso: aIso(new Date(year, month, d)), day: d, inMonth: true });
    }
    var siguiente = 1;
    while (celdas.length < 42) {
      celdas.push({ iso: aIso(new Date(year, month + 1, siguiente)), day: siguiente, inMonth: false });
      siguiente++;
    }
    return celdas;
  }

  /** 📦1108 — Convierte en desplegables propios los CUATRO FILTROS del
   *  toolbar (año y género del dashboard, año y estado del registro) y los
   *  DOS campos del modal Editar inducción (género y fecha).
   *  El <select> y el <input type="date"> nativos quedan OCULTOS y siguen
   *  siendo la fuente de verdad: set(), la validación y los filtros leen
   *  los mismos IDs. El desplegable es una vista encima, no un reemplazo. */
  _initIndPickers() {
    var self = this;
    var cont = document;
    var dds = cont.querySelectorAll('.ind-dd');
    if (!dds.length) return;

    // Listeners globales de documento: se reemplazan en cada render para
    // no acumularlos (el modulo se vuelve a montar en cada visita)
    if (this._indDocClick) {
      document.removeEventListener('click', this._indDocClick);
      document.removeEventListener('keydown', this._indDocKey);
    }
    if (this._indDocScroll) {
      document.removeEventListener('scroll', this._indDocScroll, true);
    }
    this._indDocClick = function (ev) {
      // Un clic DENTRO de un desplegable nunca lo cierra. Se revisa el
      // camino completo del evento (composedPath) y no solo el destino:
      // al repintar el menu (innerHTML) el boton pulsado queda
      // DESCONECTADO del documento.
      var dentro = (ev.composedPath ? ev.composedPath() : []).some(function (n) {
        return n && n.classList && n.classList.contains('ind-dd');
      }) || (ev.target && ev.target.closest && !!ev.target.closest('.ind-dd'));
      if (!dentro) self._cerrarTodosInd();
    };
    this._indDocKey = function (ev) {
      if (ev.key === 'Escape') self._cerrarTodosInd();
    };
    document.addEventListener('click', this._indDocClick);
    document.addEventListener('keydown', this._indDocKey);
    // 📦1108 — El scroll cierra los menus: un menu que se suelta del
    // scroller (fixed) se quedaria pegado a un punto que ya no existe.
    this._indDocScroll = function () { self._cerrarTodosInd(); };
    document.addEventListener('scroll', this._indDocScroll, true);

    dds.forEach(function (dd) {
      var native = document.getElementById(dd.getAttribute('data-ind-dd'));
      var toggle = dd.querySelector('.ind-dd__toggle');
      var menu = dd.querySelector('.ind-dd__menu');
      if (!native || !toggle || !menu) return;
      var esFecha = native.type === 'date';
      var esLista = native.tagName === 'SELECT';

      if (esFecha) {
        // Calendario: un solo listener delegado en el menu (sobrevive a los
        // repintados de _pintarCalendarioInd, que usa innerHTML)
        menu.addEventListener('click', function (ev) {
          // Un clic dentro del calendario JAMAS debe cerrar el menu.
          ev.stopPropagation();
          var acc = ev.target.closest ? ev.target.closest('[data-ind-accion]') : null;
          if (!acc) return;
          var tipo = acc.getAttribute('data-ind-accion');
          if (tipo === 'mes') {
            var delta = parseInt(acc.getAttribute('data-ind-delta'), 10) || 0;
            var vista = (dd.getAttribute('data-ind-view') || '').split('-');
            var base = new Date(parseInt(vista[0], 10), parseInt(vista[1], 10) + delta, 1);
            dd.setAttribute('data-ind-view', base.getFullYear() + '-' + base.getMonth());
            self._pintarCalendarioInd(dd);
          } else if (tipo === 'dia') {
            var iso = acc.getAttribute('data-iso') || '';
            native.value = iso;
            // La vista queda en el mes del dia elegido: al reabrir el
            // calendario se ve el mes donde esta la fecha.
            var p = iso.split('-');
            if (p.length === 3) dd.setAttribute('data-ind-view', p[0] + '-' + (parseInt(p[1], 10) - 1));
            native.dispatchEvent(new Event('change', { bubbles: true }));
            self._actualizarLabelInd(dd);
            self._cerrarInd(dd);
          } else if (tipo === 'hoy') {
            var h = new Date();
            native.value = h.getFullYear() + '-' +
              String(h.getMonth() + 1).padStart(2, '0') + '-' +
              String(h.getDate()).padStart(2, '0');
            dd.setAttribute('data-ind-view', h.getFullYear() + '-' + h.getMonth());
            native.dispatchEvent(new Event('change', { bubbles: true }));
            self._actualizarLabelInd(dd);
            self._cerrarInd(dd);
          } else if (tipo === 'limpiar') {
            native.value = '';
            dd.removeAttribute('data-ind-view');
            native.dispatchEvent(new Event('change', { bubbles: true }));
            self._actualizarLabelInd(dd);
            self._cerrarInd(dd);
          }
        });
      } else if (esLista) {
        // Una lista de opciones. Se leen del propio <select>, que queda
        // oculto y es la fuente de verdad: asi el desplegable no puede
        // quedar desactualizado con el campo.
        menu.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var acc = ev.target.closest ? ev.target.closest('[data-ind-accion="opcion"]') : null;
          if (!acc) return;
          native.value = acc.getAttribute('data-value') || '';
          native.dispatchEvent(new Event('change', { bubbles: true }));
          self._actualizarLabelInd(dd);
          self._cerrarInd(dd);
        });
      }

      toggle.addEventListener('click', function () {
        if (toggle.disabled) return;
        var abierto = !menu.hidden;
        self._cerrarTodosInd();
        if (!abierto) self._abrirInd(dd);
      });

      // El rotulo del campo tambien abre el desplegable
      var rotulo = cont.querySelector('label[for="' + native.id + '"]');
      if (rotulo) {
        rotulo.addEventListener('click', function (ev) {
          if (toggle.disabled) return;
          ev.preventDefault();
          // Sin esto el clic burbujea a documento y el listener de
          // "clic fuera" cierra el menu que acaba de abrirse
          ev.stopPropagation();
          var abierto = !menu.hidden;
          self._cerrarTodosInd();
          if (!abierto) self._abrirInd(dd);
        });
      }

      self._actualizarLabelInd(dd);
    });
  }

  _abrirInd(dd) {
    var menu = dd.querySelector('.ind-dd__menu');
    var toggle = dd.querySelector('.ind-dd__toggle');
    if (!menu || !toggle || !menu.hidden) return;
    if (dd.classList.contains('ind-dd--fecha')) {
      this._pintarCalendarioInd(dd);
    } else {
      // Los cinco campos de lista (los cuatro filtros y el género del
      // modal) se pintan desde el propio campo.
      this._pintarOpcionesInd(dd);
    }
    this._actualizarLabelInd(dd);
    // 📦1108 — El menu se reposiciona desde cero en cada apertura: si la
    // vez anterior quedo suelto (fixed), vuelve al flujo normal.
    this._resetMenuPos(menu);
    menu.hidden = false;
    dd.classList.add('ind-dd--open');
    toggle.setAttribute('aria-expanded', 'true');

    // El toolbar y el modal tienen scroll: si el menu no cabe hacia abajo
    // se abre hacia arriba; y si se pasa del borde derecho se ancla a la
    // derecha
    var tRect = toggle.getBoundingClientRect();
    var mAlto = menu.offsetHeight;
    var mAncho = menu.offsetWidth;
    var scroller = dd.closest('.kair-modal__body') || dd.closest('.inducciones-container');
    var sRect = scroller ? scroller.getBoundingClientRect() : null;
    var limiteAbajo = Math.min(sRect ? sRect.bottom : window.innerHeight, window.innerHeight);
    var limiteArriba = Math.max(sRect ? sRect.top : 0, 0);
    var cabeAbajo = (limiteAbajo - tRect.bottom) >= (mAlto + 8);
    var cabeArriba = (tRect.top - limiteArriba) >= (mAlto + 8);
    if (cabeAbajo) {
      menu.classList.remove('ind-dd__menu--up');
    } else if (cabeArriba) {
      menu.classList.add('ind-dd__menu--up');
    } else {
      // 📦1108 — No cabe ni ABAJO ni ARRIBA dentro de su scroller (el
      // cuerpo del modal tiene overflow-y:auto y el calendario mide 306
      // px). Un menu absolute se recorta y se pierden los botones de
      // abajo. Se suelta del scroller (position:fixed) y se mide contra la
      // VENTANA, que es donde esta el espacio de verdad.
      menu.classList.remove('ind-dd__menu--up');
      menu.style.position = 'fixed';
      var vh = window.innerHeight;
      var top;
      if (vh - tRect.bottom - 8 >= mAlto) top = tRect.bottom + 6;
      else if (tRect.top - 8 >= mAlto) top = tRect.top - mAlto - 6;
      else top = Math.max(8, Math.round((vh - mAlto) / 2));
      menu.style.top = top + 'px';
      var izq = tRect.left;
      if (izq + mAncho > window.innerWidth - 8) izq = window.innerWidth - mAncho - 8;
      if (izq < 8) izq = 8;
      menu.style.left = izq + 'px';
    }

    if (menu.style.position !== 'fixed') {
      menu.style.left = '';
      menu.style.right = '';
      var limiteDerecha = Math.min(sRect ? sRect.right : window.innerWidth, window.innerWidth);
      if (tRect.left + mAncho > limiteDerecha - 8) {
        menu.style.left = 'auto';
        menu.style.right = '0';
      }
    }
  }

  /** 📦1108 — Devuelve el menu a su posicion normal (dentro de su scroller)
   *  y limpia los estilos inline de posicion. */
  _resetMenuPos(menu) {
    if (!menu) return;
    menu.style.position = '';
    menu.style.top = '';
    menu.style.bottom = '';
    menu.style.left = '';
    menu.style.right = '';
    menu.classList.remove('ind-dd__menu--up');
  }

  _cerrarInd(dd) {
    var menu = dd.querySelector('.ind-dd__menu');
    var toggle = dd.querySelector('.ind-dd__toggle');
    if (menu) { menu.hidden = true; this._resetMenuPos(menu); }
    dd.classList.remove('ind-dd--open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  _cerrarTodosInd() {
    // Cierra TODOS: los del modal y los de los filtros.
    document.querySelectorAll('.ind-dd').forEach(dd => this._cerrarInd(dd));
  }

  /** Escribe en el boton lo que vale el campo oculto (o "Seleccione..."
   *  si esta vacio) y marca en el menu la opcion elegida. */
  _actualizarLabelInd(dd) {
    var native = document.getElementById(dd.getAttribute('data-ind-dd'));
    var valor = dd.querySelector('.ind-dd__value');
    if (!native || !valor) return;
    var texto = '';
    var hayOpciones = true;
    if (native.type === 'date') {
      var p = (native.value || '').split('-');
      if (p.length === 3) texto = p[2] + '/' + p[1] + '/' + p[0];
    } else if (native.tagName === 'SELECT') {
      // Se muestra el TEXTO de la opcion ("Todos", "Hombres"), no el valor
      // interno ("all", "H"): el valor es lo que se guarda, el texto es lo
      // que se lee.
      hayOpciones = !!(native.options && native.options.length);
      var op = hayOpciones ? native.options[native.selectedIndex] : null;
      texto = op ? op.text : (native.value || '');
    } else if (native.value) {
      texto = native.value;
    }
    // Un <select> que todavia no tiene opciones (el filtro de años se
    // puebla por codigo) conserva el texto inicial del boton.
    if (texto) valor.textContent = texto;
    else if (hayOpciones) valor.textContent = 'Seleccione...';
    dd.querySelectorAll('.ind-dd__option').forEach(function (op) {
      var activa = op.getAttribute('data-value') === (native.value || '');
      op.classList.toggle('ind-dd__option--active', activa);
    });
  }

  /** Re-sincroniza las etiquetas de los desplegables. Se llama cuando un
   *  valor cambia FUERA del desplegable (el filtro de años se puebla por
   *  codigo, el modal se abre con un valor): sin esto el boton mostraria
   *  una cosa y el filtro filtraria por otra. */
  _syncIndPickers() {
    document.querySelectorAll('.ind-dd').forEach(dd => this._actualizarLabelInd(dd));
  }

  /** Pinta el calendario del menu de la fecha: mes en curso, navegacion
   *  con chevrons, dia de hoy marcado y el dia elegido en azul. */
  _pintarCalendarioInd(dd) {
    var native = document.getElementById(dd.getAttribute('data-ind-dd'));
    var menu = dd.querySelector('.ind-dd__menu');
    if (!native || !menu) return;
    var hoy = new Date();
    var vista = (dd.getAttribute('data-ind-view') || '').split('-');
    var y = parseInt(vista[0], 10);
    var m = parseInt(vista[1], 10);
    if (isNaN(y) || isNaN(m)) {
      if (native.value) {
        var p = native.value.split('-');
        y = parseInt(p[0], 10);
        m = parseInt(p[1], 10) - 1;
      } else {
        y = hoy.getFullYear();
        m = hoy.getMonth();
      }
      dd.setAttribute('data-ind-view', y + '-' + m);
    }
    var isoHoy = hoy.getFullYear() + '-' +
      String(hoy.getMonth() + 1).padStart(2, '0') + '-' +
      String(hoy.getDate()).padStart(2, '0');
    var celdas = this._buildMonthGridInd(y, m);
    var dias = '';
    celdas.forEach(function (c) {
      var clases = ['ind-cal__day'];
      if (!c.inMonth) clases.push('ind-cal__day--out');
      if (c.iso === native.value) clases.push('ind-cal__day--sel');
      if (c.iso === isoHoy) clases.push('ind-cal__day--today');
      dias += '<button type="button" class="' + clases.join(' ') +
        '" data-ind-accion="dia" data-iso="' + c.iso + '">' + c.day + '</button>';
    });
    menu.innerHTML =
      '<div class="ind-cal__head">' +
        '<button type="button" class="ind-cal__nav" data-ind-accion="mes" data-ind-delta="-1" aria-label="Mes anterior">&#8249;</button>' +
        '<span class="ind-cal__label">' + IND_MESES_F[m] + ' ' + y + '</span>' +
        '<button type="button" class="ind-cal__nav" data-ind-accion="mes" data-ind-delta="1" aria-label="Mes siguiente">&#8250;</button>' +
      '</div>' +
      '<div class="ind-cal__week"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>' +
      '<div class="ind-cal__grid">' + dias + '</div>' +
      '<div class="ind-cal__foot">' +
        '<button type="button" class="ind-cal__btn" data-ind-accion="limpiar">Limpiar</button>' +
        '<button type="button" class="ind-cal__btn" data-ind-accion="hoy">Hoy</button>' +
      '</div>';
  }

  /** Pinta la lista de opciones. Se LEEN del <select> nativo (que queda
   *  oculto y es la fuente de verdad): el desplegable no escribe su
   *  propia lista, asi que no puede quedar desactualizado con el campo.
   *  Si el valor que ya tiene el campo no esta en la lista, se agrega
   *  igual: el usuario tiene que poder ver lo que hay y corregirlo. */
  _pintarOpcionesInd(dd) {
    var native = document.getElementById(dd.getAttribute('data-ind-dd'));
    var menu = dd.querySelector('.ind-dd__menu');
    if (!menu || !native || !native.options) return;
    var html = '';
    var hayActual = false;
    Array.from(native.options).forEach(function (op) {
      if (op.value === native.value) hayActual = true;
      html += '<button type="button" class="ind-dd__option"' +
        ' data-ind-accion="opcion" data-value="' + indEsc(op.value) + '">' +
        indEsc(op.text) + '</button>';
    });
    if (native.value && !hayActual) {
      html = '<button type="button" class="ind-dd__option"' +
        ' data-ind-accion="opcion" data-value="' + indEsc(native.value) + '">' +
        indEsc(native.value) + '</button>' + html;
    }
    menu.innerHTML = html;
  }
  /* ================= MÉTRICAS ================= */
  computeMetrics() {
    var rs = this.filteredBase();
    var total = rs.length;
    var apr = rs.filter(function (r) { return r.puntaje >= IND_UMBRAL_APR; }).length;
    var rep = total - apr;
    var rate = total ? apr / total * 100 : 0;
    var avg = total ? rs.reduce(function (s, r) { return s + r.puntaje; }, 0) / total : 0;
    var min = total ? Math.min.apply(null, rs.map(function (r) { return r.puntaje; })) : 0;
    var max = total ? Math.max.apply(null, rs.map(function (r) { return r.puntaje; })) : 0;
    var g = function (list) {
      var a = list.filter(function (r) { return r.puntaje >= IND_UMBRAL_APR; }).length;
      return { total: list.length, apr: a, rep: list.length - a, rate: list.length ? a / list.length * 100 : null };
    };
    var porGenero = { H: g(rs.filter(function (r) { return r.genero === 'H'; })),
                      M: g(rs.filter(function (r) { return r.genero === 'M'; })) };
    var meses = IND_MESES.map(function (_, i) {
      var k = (i < 9 ? '0' : '') + String(i + 1);
      var rm = rs.filter(function (r) { return r.fecha.slice(5, 7) === k; });
      var ra = rm.filter(function (r) { return r.puntaje >= IND_UMBRAL_APR; }).length;
      return { i: i, real: rm.length, apr: ra, tasa: rm.length ? ra / rm.length * 100 : null };
    });
    var cargoMap = {};
    rs.forEach(function (r) {
      var k = r.cargo.trim().toLowerCase();
      if (!k) return;
      if (!cargoMap[k]) cargoMap[k] = { label: r.cargo.trim(), n: 0 };
      cargoMap[k].n++;
    });
    var cargos = Object.keys(cargoMap).map(function (k) { return cargoMap[k]; })
      .sort(function (a, b) { return b.n - a.n || a.label.localeCompare(b.label); }).slice(0, 5);
    var inR = function (lo, hi) { return rs.filter(function (r) { return r.puntaje >= lo && r.puntaje <= hi; }).length; };
    var rangos = [
      { k: '0–10', label: 'Reprobado', n: inR(0, 10), fill: 'rgba(218,85,99,.55)' },
      { k: '11–15', label: 'Bajo', n: inR(11, 15), fill: 'rgba(231,162,36,.5)' },
      { k: '16–19', label: 'Aceptable', n: inR(16, 19), fill: 'rgba(231,162,36,.72)' },
      { k: '20–22', label: 'Excelente', n: inR(20, 22), fill: 'rgba(27,184,136,.55)' }
    ];
    var lastIdx = -1;
    meses.forEach(function (mm) { if (mm.real > 0) lastIdx = mm.i; });
    return { rs: rs, total: total, apr: apr, rep: rep, rate: rate, avg: avg, min: min, max: max,
      porGenero: porGenero, meses: meses, cargos: cargos, rangos: rangos,
      vigilancia: inR(16, 19), criticos: inR(0, 10), lastIdx: lastIdx };
  }
  anioLabel() { return this._st.filters.anio === 'all' ? 'todos los años' : this._st.filters.anio; }

  /* ================= HERO + KPI + RADAR ================= */
  renderHero(m) {
    var self = this;
    var q = function (s) { return self.q(s); };
    var lbl = q('#hero-label'); if (lbl) lbl.textContent = 'Estado general · ' + this.anioLabel();
    var pct = m.total ? Math.round(m.rate) : 0;
    var pctEl = q('#hero-pct'); if (pctEl) pctEl.textContent = m.total ? pct + '%' : '—';
    var meter = q('#hero-meter');
    if (meter) {
      meter.style.width = (m.total ? pct : 0) + '%';
      meter.className = 'kair-hero__meter-fill' + (pct >= 80 ? '' : (pct >= 60 ? ' kair-hero__meter-fill--amber' : ' kair-hero__meter-fill--red'));
    }
    var title;
    if (!m.total) title = 'Aún no hay inducciones registradas para este filtro.';
    else if (pct >= 85) title = 'Excelente año: la gran mayoría de tus inducciones terminan en aprobación.';
    else if (pct >= 70) title = 'Vas por buen camino: la mayoría de tus inducciones terminan en aprobación.';
    else if (pct >= 55) title = 'Resultado mixto: una parte importante de las inducciones no está aprobando.';
    else title = 'Atención: la mayoría de las inducciones no están aprobando.';
    var titleEl = q('#hero-title'); if (titleEl) titleEl.textContent = title;
    var sub;
    if (!m.total) sub = 'Registra la primera inducción desde la pestaña «Registro».';
    else {
      sub = m.apr + ' de ' + m.total + ' ' + (m.total === 1 ? 'inducción aprobada' : 'inducciones aprobadas') +
        ' · promedio de puntaje ' + m.avg.toFixed(1) + ' / ' + IND_PUNTAJE_MAX + '.';
      if (m.rep > 0) sub += ' ' + m.rep + (m.rep === 1 ? ' persona requiere' : ' personas requieren') + ' reinducción.';
    }
    var subEl = q('#hero-sub'); if (subEl) subEl.textContent = sub;
    var cta = q('#btn-ver-reprobados'); if (cta) cta.style.display = (m.rep > 0) ? '' : 'none';
    var mg = m.porGenero.M, hg = m.porGenero.H;
    var gm = q('#hero-gen-m'); if (gm) gm.textContent = (mg.rate != null) ? Math.round(mg.rate) + '%' : '—';
    var gh = q('#hero-gen-h'); if (gh) gh.textContent = (hg.rate != null) ? Math.round(hg.rate) + '%' : '—';
    var gmb = q('#hero-gen-m-bar'); if (gmb) gmb.style.width = (mg.rate != null ? Math.round(mg.rate) : 0) + '%';
    var ghb = q('#hero-gen-h-bar'); if (ghb) ghb.style.width = (hg.rate != null ? Math.round(hg.rate) : 0) + '%';
  }
  renderKpis(m) {
    var self = this;
    var q = function (s) { return self.q(s); };
    var t = q('#kpi-total'); if (t) t.textContent = m.total || '—';
    var tchip = q('#kpi-total-chip');
    if (tchip) tchip.textContent = this._st.filters.anio === 'all' ? 'Todos' : this._st.filters.anio;
    var pct = m.total ? Math.round(m.rate) : 0;
    var a = q('#kpi-apr'); if (a) a.textContent = m.apr;
    var achip = q('#kpi-apr-chip'); if (achip) achip.textContent = m.total ? pct + '%' : '—%';
    var ab = q('#kpi-apr-bar'); if (ab) ab.style.width = pct + '%';
    var pctR = m.total ? Math.round(m.rep / m.total * 100) : 0;
    var rp = q('#kpi-rep'); if (rp) rp.textContent = m.rep;
    var rchip = q('#kpi-rep-chip'); if (rchip) rchip.textContent = m.total ? pctR + '%' : '—%';
    var rb = q('#kpi-rep-bar'); if (rb) rb.style.width = pctR + '%';
    var pr = q('#kpi-prom'); if (pr) pr.textContent = m.total ? m.avg.toFixed(1) : '—';
    var pchip = q('#kpi-prom-chip');
    if (pchip) {
      var sobre = m.total && m.avg >= IND_UMBRAL_APR;
      pchip.textContent = m.total ? (sobre ? 'Sobre la meta' : 'Bajo la meta') : '—';
      pchip.className = 'kair-chip ' + (sobre ? 'kair-chip--soft-green' : 'kair-chip--soft-amber');
    }
    var ps = q('#kpi-prom-sub');
    if (ps) ps.textContent = m.total ? 'Rango de resultados ' + m.min + '–' + m.max : 'Rango de resultados —';
  }
  _radarItem(iconCls, icon, name, sub, chipCls, chipText) {
    return '<div class="kair-radar__item">' +
      '<span class="kair-radar__icon kair-radar__icon--' + iconCls + '">' + icon + '</span>' +
      '<div class="kair-radar__body"><div class="kair-radar__name">' + indEsc(name) + '</div>' +
      '<div class="kair-radar__sub">' + indEsc(sub) + '</div></div>' +
      '<span class="kair-chip kair-chip-tag kair-radar__chip kair-chip--' + chipCls + '">' + indEsc(chipText) + '</span></div>';
  }
  renderRadar(m) {
    var box = this.q('#radar-items');
    if (!box) return;
    var sub = this.q('#radar-sub');
    if (sub) sub.textContent = this._st.filters.anio === 'all'
      ? 'Lo que merece atención en todos los años' : 'Lo que merece atención en ' + this._st.filters.anio;
    var items = [];
    if (m.rep > 0) {
      items.push(this._radarItem('red', IND_ICO.alert,
        m.rep + (m.rep === 1 ? ' inducción reprobada' : ' inducciones reprobadas'),
        'Trabajadores pendientes de reinducción SG-SST.', 'soft-red', 'Reinducción'));
    } else {
      items.push(this._radarItem('green', IND_ICO.checkC,
        'Sin reprobados en el periodo',
        'Todas las inducciones del filtro actual están aprobadas.', 'soft-green', 'Al día'));
    }
    if (m.vigilancia > 0) {
      items.push(this._radarItem('amber', IND_ICO.eye,
        m.vigilancia + (m.vigilancia === 1 ? ' puntaje en zona de vigilancia' : ' puntajes en zona de vigilancia') + ' (16–19)',
        'Aceptables por poco: quedaron a menos de 4 puntos del aprobado.', 'soft-amber', 'Vigilar'));
    } else {
      items.push(this._radarItem('green', IND_ICO.checkC,
        'Nadie en zona de vigilancia',
        'Ningún puntaje quedó entre 16 y 19 en el filtro actual.', 'soft-green', 'OK'));
    }
    var mg = m.porGenero.M, hg = m.porGenero.H;
    if (mg.rate != null && hg.rate != null) {
      var rM = Math.round(mg.rate), rH = Math.round(hg.rate);
      var gap = Math.abs(rM - rH);
      var mejor = rM >= rH ? 'Mujeres' : 'Hombres';
      var peor = mejor === 'Mujeres' ? 'Hombres' : 'Mujeres';
      var rMejor = Math.max(rM, rH), rPeor = Math.min(rM, rH);
      if (gap >= 3) {
        items.push(this._radarItem('blue', IND_ICO.scale,
          'Brecha de aprobación de ' + gap + ' pts entre géneros',
          mejor + ' ' + rMejor + '% vs ' + peor.toLowerCase() + ' ' + rPeor + '%. Conviene revisar asistencia y seguimiento.',
          'soft-blue', 'Observar'));
      } else {
        items.push(this._radarItem('green', IND_ICO.users,
          'Aprobación equilibrada entre géneros',
          'Mujeres ' + rMejor + '% y hombres ' + rPeor + '%, con ' + gap + ' pts de diferencia.',
          'soft-green', 'Equilibrio'));
      }
    } else {
      var conDatos = m.meses.filter(function (x) { return x.real >= 4; });
      if (conDatos.length) {
        var best = conDatos.reduce(function (a, b) { return (b.tasa > a.tasa) ? b : a; });
        items.push(this._radarItem('blue', IND_ICO.info,
          IND_MESES_F[best.i] + ': mejor mes de aprobación (' + Math.round(best.tasa) + '%)',
          best.apr + ' de ' + best.real + ' inducciones aprobadas ese mes.', 'soft-blue', 'Destacar'));
      } else {
        items.push(this._radarItem('slate', IND_ICO.info,
          'Datos insuficientes para comparar',
          'Registra más inducciones para ver alertas de género y meses.', 'soft-slate', 'Info'));
      }
    }
    box.innerHTML = items.join('');
  }

  /* ================= GRÁFICAS SVG ================= */
  _chartEmpty(el, msg) {
    el.innerHTML = '<div class="kair-empty" style="padding:36px 20px">' +
      '<div class="kair-empty__title" style="font-size:13.5px">Sin datos para mostrar</div>' +
      '<div class="kair-empty__sub">' + indEsc(msg || 'No hay inducciones registradas con los filtros actuales.') + '</div></div>';
  }
  renderChartEjecucion(m) {
    var el = this.q('#chart-ejecucion');
    if (!el) return;
    el.innerHTML = '';
    var n = Math.max(4, m.lastIdx + 1);
    var real = m.meses.slice(0, n).map(function (x) { return x.real; });
    var apr = m.meses.slice(0, n).map(function (x) { return x.apr; });
    if (m.total === 0 || m.lastIdx < 0) { this._chartEmpty(el); return; }
    var W = Math.max(el.clientWidth || 560, 380), H = 238;
    var ML = 30, MR = 14, MT = 14, MB = 26, iw = W - ML - MR, ih = H - MT - MB;
    var maxV = Math.max(4, Math.max.apply(null, real));
    var yMax = Math.ceil(maxV * 1.12);
    var step = yMax <= 6 ? 2 : (yMax <= 12 ? 3 : (yMax <= 30 ? 5 : Math.ceil(yMax / 6 / 5) * 5));
    var x = function (i) { return ML + (n === 1 ? iw / 2 : i * (iw / (n - 1))); };
    var y = function (v) { return MT + ih - (v / yMax * ih); };
    var s = '';
    for (var g = 0; g <= yMax + 0.0001; g += step) {
      s += '<line class="grid-line" x1="' + ML + '" y1="' + y(g) + '" x2="' + (W - MR) + '" y2="' + y(g) + '"/>';
      s += '<text class="axis-label axis-label--y" x="' + (ML - 8) + '" y="' + (y(g) + 3) + '" text-anchor="end">' + g + '</text>';
    }
    for (var i = 0; i < n; i++) {
      s += '<text class="axis-label" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + IND_MESES[i] + '</text>';
    }
    s += '<defs><linearGradient id="gradIndReal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2057B8" stop-opacity=".13"/><stop offset="1" stop-color="#2057B8" stop-opacity="0"/></linearGradient></defs>';
    s += '<line class="guide" id="ind-guide" x1="0" y1="' + MT + '" x2="0" y2="' + (MT + ih) + '"/>';
    s += '<path class="area-real" d="' + indAreaPath(real, x, y, MT + ih) + '" fill="url(#gradIndReal)" style="opacity:0;transition:opacity 220ms ease 80ms"/>';
    s += '<path class="line-real" id="ind-real-line" d="' + indLinePath(real, x, y) + '"/>';
    s += '<path class="line-apr" d="' + indLinePath(apr, x, y) + '"/>';
    real.forEach(function (v, j) {
      s += '<circle cx="' + x(j) + '" cy="' + y(v) + '" r="2.6" fill="#2057B8" stroke="#fff" stroke-width="1.2"/>';
      s += '<circle cx="' + x(j) + '" cy="' + y(apr[j]) + '" r="2.2" fill="#1BB888" stroke="#fff" stroke-width="1.2"/>';
    });
    var li = m.lastIdx;
    s += '<circle cx="' + x(li) + '" cy="' + y(real[li]) + '" r="6.5" fill="rgba(32,87,184,.13)"/><circle cx="' + x(li) + '" cy="' + y(real[li]) + '" r="3.2" fill="#2057B8" stroke="#fff" stroke-width="1.5"/>';
    var stepw = iw / n;
    for (var k = 0; k < n; k++) {
      s += '<rect class="hitzone" data-mi="' + k + '" x="' + (ML + k * stepw) + '" y="' + MT + '" width="' + stepw + '" height="' + ih + '"/>';
    }
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Inducciones realizadas y aprobadas por mes">' + s + '</svg><div class="kair-chart-tip" id="ind-tip"></div>';
    var path = el.querySelector('#ind-real-line');
    try {
      var len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      path.getBoundingClientRect();
      path.style.transition = 'stroke-dashoffset 220ms cubic-bezier(.4,0,.2,1)';
      path.style.strokeDashoffset = '0';
    } catch (e) { /* estático */ }
    requestAnimationFrame(function () { var ar = el.querySelector('.area-real'); if (ar) ar.style.opacity = '1'; });
    var tip = el.querySelector('#ind-tip'), guide = el.querySelector('#ind-guide');
    el.querySelectorAll('.hitzone').forEach(function (hz) {
      var idx = Number(hz.dataset.mi), d = m.meses[idx];
      hz.addEventListener('mouseenter', function () {
        var gx = x(idx);
        guide.setAttribute('x1', gx);
        guide.setAttribute('x2', gx);
        guide.style.opacity = '1';
        if (d.real === 0) { tip.classList.remove('is-on'); return; }
        tip.innerHTML = '<div class="kair-chart-tip__title">' + IND_MESES_F[idx] + '</div>' +
          '<div class="kair-chart-tip__row"><i style="background:#2057B8"></i>Realizadas: ' + d.real + '</div>' +
          '<div class="kair-chart-tip__row"><i style="background:#1BB888"></i>Aprobadas: ' + d.apr + '</div>' +
          '<div class="kair-chart-tip__row"><i style="background:rgba(255,255,255,.4)"></i>Tasa: ' + Math.round(d.tasa) + '%</div>';
        var tx = Math.min(Math.max(gx + 12, 6), W - 160);
        tip.style.left = tx + 'px';
        tip.style.top = '14px';
        tip.classList.add('is-on');
      });
      hz.addEventListener('mouseleave', function () { tip.classList.remove('is-on'); guide.style.opacity = '0'; });
    });
  }
  colChart(elId, slots, o) {
    var el = this.q('#' + elId);
    if (!el) return;
    el.innerHTML = '';
    var hasData = slots.some(function (sl) { return sl.bars.some(function (b) { return b.v > 0; }); });
    if (!hasData) { this._chartEmpty(el); return; }
    var W = Math.max(el.clientWidth || 560, 380), H = o.h || 238;
    var ML = 34, MR = 12, MT = 16, MB = o.mb || 26, iw = W - ML - MR, ih = H - MT - MB;
    var maxV = 0;
    slots.forEach(function (sl) { sl.bars.forEach(function (b) { if (b.v > maxV) maxV = b.v; }); });
    var yMax = o.yMax || Math.max(o.minMax || 4, Math.ceil(maxV * 1.15));
    var y = function (v) { return MT + ih - (Math.min(v, yMax) / yMax * ih); };
    var s = '';
    var stepY = yMax <= 6 ? 2 : (yMax <= 12 ? 3 : (yMax <= 30 ? 5 : Math.ceil(yMax / 6 / 5) * 5));
    for (var g = 0; g <= yMax + 0.0001; g += stepY) {
      s += '<line class="grid-line" x1="' + ML + '" y1="' + y(g) + '" x2="' + (W - MR) + '" y2="' + y(g) + '"/>';
      s += '<text class="axis-label axis-label--y" x="' + (ML - 8) + '" y="' + (y(g) + 3) + '" text-anchor="end">' + g + (o.unit || '') + '</text>';
    }
    var gw = iw / slots.length;
    slots.forEach(function (sl, si) {
      var cx = ML + si * gw + gw / 2;
      var nB = Math.max(1, sl.bars.length);
      var barW = Math.min(o.barMax || 22, Math.max(9, (gw * 0.55) / nB));
      var totalW = nB * barW + (nB - 1) * 3;
      var sx = cx - totalW / 2;
      sl.bars.forEach(function (b) {
        if (b.v > 0) {
          var bh = Math.max(b.v / yMax * ih, 3);
          s += '<path class="col-bar" d="' + indRoundTop(sx, MT + ih - bh, barW, bh, 5) + '" fill="' + b.fill + '" style="transform:scaleY(0);transition-delay:' + (si * 16) + 'ms"/>';
        }
        sx += barW + 3;
      });
      if (o.twoLine) {
        s += '<text class="axis-label" x="' + cx + '" y="' + (H - 20) + '" text-anchor="middle" style="font-weight:600">' + sl.label + '</text>';
        s += '<text class="axis-label" x="' + cx + '" y="' + (H - 7) + '" text-anchor="middle" style="font-size:9.5px">' + sl.sub + '</text>';
      } else {
        s += '<text class="axis-label" x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + sl.label + '</text>';
      }
    });
    if (o.meta != null) {
      var my = y(o.meta);
      s += '<line class="meta-line" x1="' + ML + '" y1="' + my + '" x2="' + (W - MR) + '" y2="' + my + '"/>';
      s += '<text class="meta-label" x="' + (W - MR) + '" y="' + (my - 5) + '" text-anchor="end">' + indEsc(o.metaLabel || '') + '</text>';
    }
    slots.forEach(function (sl, si) {
      s += '<rect class="hitzone" data-si="' + si + '" x="' + (ML + si * gw) + '" y="' + MT + '" width="' + gw + '" height="' + ih + '"/>';
    });
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + indEsc(o.aria || 'Gráfica de columnas') + '">' + s + '</svg><div class="kair-chart-tip"></div>';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.querySelectorAll('.col-bar').forEach(function (b) { b.style.transform = 'scaleY(1)'; });
      });
    });
    var tip = el.querySelector('.kair-chart-tip');
    el.querySelectorAll('.hitzone').forEach(function (hz) {
      var si = Number(hz.dataset.si), sl = slots[si];
      hz.addEventListener('mouseenter', function () {
        if (!sl.tip || !sl.tip.length) { tip.classList.remove('is-on'); return; }
        var html = '<div class="kair-chart-tip__title">' + indEsc(sl.tipTitle) + '</div>';
        sl.tip.forEach(function (row) {
          html += '<div class="kair-chart-tip__row"><i style="background:' + row[0] + '"></i>' + indEsc(row[1]) + '</div>';
        });
        tip.innerHTML = html;
        var cx = ML + si * gw + gw / 2;
        var tx = Math.min(Math.max(cx + 12, 6), W - 170);
        tip.style.left = tx + 'px';
        tip.style.top = '14px';
        tip.classList.add('is-on');
      });
      hz.addEventListener('mouseleave', function () { tip.classList.remove('is-on'); });
    });
  }
  renderChartTasa(m) {
    var sub = this.q('#sub-ejecucion');
    if (sub) sub.textContent = m.lastIdx >= 0
      ? 'Realizadas vs aprobadas por mes · ' + IND_MESES[0] + '–' + IND_MESES[m.lastIdx] + ' ' + this.anioLabel()
      : 'Realizadas vs aprobadas por mes';
    if (m.lastIdx < 0) { this.colChart('chart-tasa', [], {}); return; }
    var n = Math.max(4, m.lastIdx + 1);
    var slots = m.meses.slice(0, n).map(function (d) {
      var baja = d.tasa != null && d.tasa < 75;
      return { label: IND_MESES[d.i],
        bars: [{ v: d.tasa != null ? Math.round(d.tasa) : 0, fill: baja ? 'rgba(231,162,36,.8)' : '#2057B8' }],
        tipTitle: IND_MESES_F[d.i],
        tip: d.real > 0
          ? [['#2057B8', 'Aprobados: ' + d.apr + ' de ' + d.real], ['rgba(255,255,255,.4)', 'Tasa: ' + Math.round(d.tasa) + '%']]
          : null };
    });
    this.colChart('chart-tasa', slots, { yMax: 100, meta: 80, metaLabel: 'Meta 80%', unit: '%', barMax: 20,
      aria: 'Tasa de aprobación por mes' });
  }
  renderChartAprobGenero(m) {
    var mk = function (name, gg) {
      var rows = [];
      if (gg.total > 0) {
        rows.push(['#2057B8', 'Aprobados: ' + gg.apr]);
        rows.push(['rgba(218,85,99,.85)', 'Reprobados: ' + gg.rep]);
        rows.push(['rgba(255,255,255,.4)', 'Tasa: ' + Math.round(gg.rate) + '%']);
      }
      return { label: name, sub: gg.total > 0 ? gg.total + (gg.total === 1 ? ' inducción' : ' inducciones') : 'Sin registros',
        bars: [{ v: gg.apr, fill: '#2057B8' }, { v: gg.rep, fill: 'rgba(218,85,99,.6)' }],
        tipTitle: name, tip: rows };
    };
    this.colChart('chart-aprob-genero', [mk('Hombres', m.porGenero.H), mk('Mujeres', m.porGenero.M)],
      { minMax: 4, twoLine: true, barMax: 26, mb: 32, aria: 'Aprobados y reprobados por género' });
  }
  renderChartRangos(m) {
    var tot = m.total;
    var slots = m.rangos.map(function (r) {
      var pct = tot ? Math.round(r.n / tot * 100) : 0;
      return { label: r.k, sub: r.label,
        bars: [{ v: r.n, fill: r.fill }],
        tipTitle: r.k + ' · ' + r.label,
        tip: [['rgba(255,255,255,.55)', r.n + (r.n === 1 ? ' trabajador' : ' trabajadores') + ' · ' + pct + '%']] };
    });
    this.colChart('chart-rangos', slots, { minMax: 4, twoLine: true, barMax: 30, mb: 32, aria: 'Distribución de puntajes por rango' });
  }
  renderDonutGenero(m) {
    var el = this.q('#donut-genero');
    if (!el) return;
    el.innerHTML = '';
    var C = 190, r = 68, sw = 15, cx = C / 2, cy = C / 2, circ = 2 * Math.PI * r, GAP = 3;
    var segs = ['H', 'M'].map(function (k) { return { k: k, n: m.porGenero[k].total }; })
      .filter(function (sg) { return sg.n > 0; });
    var s = '';
    if (!segs.length) {
      s = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#EEF1F4" stroke-width="' + sw + '"/>';
    } else {
      var acc = 0;
      segs.forEach(function (sg) {
        var frac = sg.n / m.total;
        var len = Math.max(frac * circ - GAP, 1);
        s += '<circle class="donut-seg" data-seg="' + sg.k + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + IND_DONUT_COLORS[sg.k] + '" stroke-width="' + sw + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (circ - len).toFixed(2) + '" stroke-dashoffset="' + (-acc * circ).toFixed(2) + '"/>';
        acc += frac;
      });
    }
    el.innerHTML = '<svg width="' + C + '" height="' + C + '" viewBox="0 0 ' + C + ' ' + C + '" role="img" aria-label="Distribución de inducciones por género"><g transform="rotate(-90 ' + cx + ' ' + cy + ')" style="opacity:0;transition:opacity 200ms ease">' + s + '</g></svg>';
    requestAnimationFrame(function () { var gg = el.querySelector('g'); if (gg) gg.style.opacity = '1'; });
    var tot = this.q('#donut-total'); if (tot) tot.textContent = m.total;
    var cl = this.q('#donut-center-label');
    if (cl) cl.textContent = m.total === 1 ? 'inducción' : 'inducciones';
    var lg = this.q('#donut-legend');
    if (!lg) return;
    if (!segs.length) {
      lg.innerHTML = '<div class="kair-legend__row"><span class="kair-legend__name" style="color:var(--kair-text-3)">Sin registros</span></div>';
      return;
    }
    lg.innerHTML = segs.map(function (sg) {
      var pct = Math.round(sg.n / m.total * 100);
      return '<div class="kair-legend__row" data-seg="' + sg.k + '"><span class="kair-legend__dot" style="background:' + IND_DONUT_COLORS[sg.k] + '"></span><span class="kair-legend__name">' + IND_DONUT_NAMES[sg.k] + '</span><span class="kair-legend__meta">' + sg.n + ' · ' + pct + '%</span></div>';
    }).join('');
    var hl = function (k, on) {
      var seg = el.querySelector('.donut-seg[data-seg="' + k + '"]');
      if (seg) seg.setAttribute('stroke-width', on ? 19 : sw);
      var found = null;
      segs.forEach(function (x) { if (x.k === k) found = x; });
      if (tot) tot.textContent = on ? (found ? found.n : m.total) : m.total;
      if (cl) cl.textContent = on ? IND_DONUT_NAMES[k].toLowerCase() : (m.total === 1 ? 'inducción' : 'inducciones');
    };
    el.querySelectorAll('.donut-seg').forEach(function (seg) {
      seg.addEventListener('mouseenter', function () { hl(seg.dataset.seg, true); });
      seg.addEventListener('mouseleave', function () { hl(seg.dataset.seg, false); });
    });
    lg.querySelectorAll('.kair-legend__row').forEach(function (row) {
      row.addEventListener('mouseenter', function () { hl(row.dataset.seg, true); });
      row.addEventListener('mouseleave', function () { hl(row.dataset.seg, false); });
    });
  }
  renderHbarsCargos(m) {
    var el = this.q('#hbars-cargos');
    if (!el) return;
    if (!m.cargos.length) {
      el.innerHTML = '<div class="kair-empty" style="padding:30px 20px">' +
        '<div class="kair-empty__title" style="font-size:13.5px">Sin datos para mostrar</div>' +
        '<div class="kair-empty__sub">No hay cargos registrados con los filtros actuales.</div></div>';
      return;
    }
    var maxN = m.cargos[0].n;
    el.innerHTML = m.cargos.map(function (c, i) {
      var pct = Math.round(c.n / m.total * 100);
      return '<div class="kair-hbar">' +
        '<span class="kair-hbar__name" title="' + indEsc(c.label) + '">' + indEsc(c.label) + '</span>' +
        '<span class="kair-hbar__track"><span class="kair-hbar__fill" data-w="' + Math.max(6, Math.round(c.n / maxN * 100)) + '" style="transition-delay:' + (i * 40) + 'ms"></span></span>' +
        '<span class="kair-hbar__val">' + c.n + ' · ' + pct + '%</span></div>';
    }).join('');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.querySelectorAll('.kair-hbar__fill').forEach(function (f) { f.style.width = f.dataset.w + '%'; });
      });
    });
  }
  renderCharts(m) {
    m = m || this.computeMetrics();
    this.renderChartEjecucion(m);
    this.renderChartTasa(m);
    this.renderDonutGenero(m);
    this.renderChartAprobGenero(m);
    this.renderHbarsCargos(m);
    this.renderChartRangos(m);
  }

  /* ================= REGISTRO ================= */
  rowHtml(r) {
    var apr = indEstadoDe(r) === 'APROBADO';
    var gen = r.genero === 'H' ? 'Hombre' : (r.genero === 'M' ? 'Mujer' : '—');
    return '<tr data-id="' + indEsc(r.id) + '">' +
      '<td class="kair-cell-muted" style="white-space:nowrap">' + indFmtDate(r.fecha) + '</td>' +
      '<td><div class="kair-emp">' +
        '<span class="kair-avatar" aria-hidden="true">' + indEsc(indInitials(r.nombre)) + '</span>' +
        '<div style="min-width:0"><div class="kair-emp__name" title="' + indEsc(r.nombre) + '">' + indEsc(r.nombre || '—') + '</div>' +
        '<div class="kair-emp__cc">C.C. ' + indEsc(r.cedula || '—') + '</div></div>' +
      '</div></td>' +
      '<td class="kair-cell-muted">' + indEsc(r.cargo || '—') + '</td>' +
      '<td class="kair-cell-muted">' + gen + '</td>' +
      '<td><div class="kair-score"><b>' + r.puntaje + '</b>' +
        '<span class="kair-score__bar"><span class="kair-score__fill" style="width:' + Math.round(r.puntaje / IND_PUNTAJE_MAX * 100) + '%;background:' + indScoreColor(r.puntaje) + '"></span></span>' +
        '<small>/ ' + IND_PUNTAJE_MAX + '</small></div></td>' +
      '<td><span class="kair-chip-tag ' + (apr ? 'kair-chip-tag--aprobado' : 'kair-chip-tag--reprobado') + '"><i></i>' + (apr ? 'Aprobado' : 'Reprobado') + '</span></td>' +
      '<td class="col--actions"><div class="kair-actions">' +
        '<button type="button" class="kair-icon-btn" data-action="edit" data-tip="Editar" aria-label="Editar inducción">' + IND_ICO.pencil + '</button>' +
      '</div></td></tr>';
  }
  renderTable() {
    var rows = this.filtered();
    var pages = Math.max(1, Math.ceil(rows.length / this._st.pageSize));
    if (this._st.page > pages) this._st.page = pages;
    var start = (this._st.page - 1) * this._st.pageSize;
    var slice = rows.slice(start, start + this._st.pageSize);
    var tb = this.q('#tbody'), empty = this.q('#table-empty');
    var rc = this.q('#reg-count');
    if (rc) rc.textContent = rows.length + (rows.length === 1 ? ' registro' : ' registros');
    if (!tb) return;
    if (!rows.length) {
      tb.innerHTML = '';
      if (empty) empty.hidden = false;
      var pg = this.q('#pager'); if (pg) pg.innerHTML = '';
      var fc = this.q('#foot-count'); if (fc) fc.textContent = '0 registros';
    } else {
      if (empty) empty.hidden = true;
      tb.innerHTML = slice.map((r) => this.rowHtml(r)).join('');
      var end = start + slice.length;
      var fc2 = this.q('#foot-count');
      if (fc2) fc2.textContent = 'Mostrando ' + (start + 1) + '–' + end + ' de ' + rows.length + (rows.length === 1 ? ' registro' : ' registros');
      var p = '<button type="button" data-pg="prev" aria-label="Página anterior"' + (this._st.page === 1 ? ' disabled' : '') + '>' + IND_ICO.chevL + '</button>';
      for (var i = 1; i <= pages; i++) {
        p += '<button type="button" data-pg="' + i + '"' + (i === this._st.page ? ' class="is-active"' : '') + ' aria-label="Página ' + i + '">' + i + '</button>';
      }
      p += '<button type="button" data-pg="next" aria-label="Página siguiente"' + (this._st.page === pages ? ' disabled' : '') + '>' + IND_ICO.chevR + '</button>';
      var pg2 = this.q('#pager'); if (pg2) pg2.innerHTML = p;
    }
    this.updateLimpiar();
  }
  updateCounts() {
    var base = this.filteredBase().length;
    var trc = this.q('#tab-reg-count'); if (trc) trc.textContent = base;
    var dc = this.q('#dash-count'); if (dc) dc.textContent = base + (base === 1 ? ' registro' : ' registros');
  }
  updateLimpiar() {
    var active = this._st.filters.estado !== 'all' || this._st.filters.q.trim() !== '';
    var bl = this.q('#btn-limpiar'); if (bl) bl.hidden = !active;
  }

  /* ================= MODAL ================= */
  _hideBoot() {
    var b = this.q('#ind-boot');
    if (b) {
      b.style.transition = 'opacity 200ms ease';
      b.style.opacity = '0';
      setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 210);
    }
  }
  openModal(id) {
    var m = this.q('#' + id);
    if (!m) return;
    this._lastFocus = document.activeElement;
    this.container.classList.add('kair-modal-open');
    m.classList.add('is-open');
    m.setAttribute('aria-hidden', 'false');
    indLog('MODAL', 'OPEN', 'OK', id);
    setTimeout(function () {
      var f = m.querySelector('input,select') || m.querySelector('.kair-modal__close');
      if (f) f.focus();
    }, 40);
  }
  closeModal(m) {
    if (typeof m === 'string') m = this.q('#' + m);
    if (!m) return;
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden', 'true');
    this.container.classList.remove('kair-modal-open');
    if (this._lastFocus && this._lastFocus.focus) this._lastFocus.focus();
    indLog('MODAL', 'CLOSE', 'OK');
  }
  setErr(wrapId, on) {
    var w = this.q('#' + wrapId);
    if (w) w.classList.toggle('is-error', !!on);
  }
  updatePrev() {
    var rawEl = this.q('#ind-puntaje'), chip = this.q('#prev-chip'), txt = this.q('#prev-text');
    if (!rawEl || !chip || !txt) return;
    var raw = rawEl.value;
    if (raw === '') { chip.hidden = true; txt.textContent = 'Ingresa el puntaje para ver el resultado.'; return; }
    var p = Number(raw);
    if (isNaN(p) || p < 0 || p > IND_PUNTAJE_MAX) {
      chip.hidden = true; txt.textContent = 'Puntaje fuera del rango válido (0–22).'; return;
    }
    var apr = p >= IND_UMBRAL_APR;
    chip.hidden = false;
    chip.className = 'kair-chip-tag kair-radar__chip ' + (apr ? 'kair-chip-tag--aprobado' : 'kair-chip-tag--reprobado');
    var pct = this.q('#prev-chip-text'); if (pct) pct.textContent = apr ? 'Aprobado' : 'Reprobado';
    txt.textContent = apr
      ? 'Con ' + p + ' / ' + IND_PUNTAJE_MAX + ' puntos la inducción queda aprobada.'
      : 'Con ' + p + ' / ' + IND_PUNTAJE_MAX + ' puntos la inducción queda reprobada: requiere reinducción.';
  }
  openIndModal(id) {
    this._st.editId = id;
    var isEdit = !!id;
    var t = this.q('#modal-ind-title'); if (t) t.textContent = isEdit ? 'Editar inducción' : 'Registrar inducción';
    var b = this.q('#btn-guardar-ind'); if (b) b.textContent = isEdit ? 'Guardar cambios' : 'Guardar';
    var r = null, i;
    if (isEdit) {
      for (i = 0; i < this._db.length; i++) {
        if (this._db[i].id == id) { r = this._db[i]; break; } // == tolera número/string
      }
    }
    var set = (sel, v) => { var el = this.q(sel); if (el) el.value = v; };
    set('#ind-nombre', r ? r.nombre : '');
    set('#ind-cedula', r ? r.cedula : '');
    set('#ind-cargo', r ? r.cargo : '');
    set('#ind-genero', r ? (r.genero || '') : '');
    set('#ind-fecha', r ? r.fecha : '');
    set('#ind-puntaje', r ? r.puntaje : '');
    ['fw-nombre', 'fw-cedula', 'fw-cargo', 'fw-genero', 'fw-fecha', 'fw-puntaje'].forEach((w) => this.setErr(w, false));
    // 📦1108 — El boton del género y el de la fecha deben mostrar lo que
    // acaba de dejar el campo (si no, el modal abriría en blanco).
    this._syncIndPickers();
    this.updatePrev();
    this.openModal('modal-induccion');
  }

  /* ================= TOASTS + CSV ================= */
  toast(type, title, msg) {
    var wrap = this.q('#toasts');
    if (!wrap) return;
    var icons = { success: IND_ICO.checkC, warn: IND_ICO.alert, info: IND_ICO.info };
    var t = document.createElement('div');
    t.className = 'kair-toast kair-toast--' + type;
    t.innerHTML = '<span class="kair-toast__icon">' + icons[type] + '</span>' +
      '<div><div class="kair-toast__title">' + indEsc(title) + '</div><div class="kair-toast__msg">' + indEsc(msg) + '</div></div>' +
      '<button type="button" class="kair-toast__close" aria-label="Cerrar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';
    wrap.appendChild(t);
    var done = false;
    var kill = function () {
      if (done) return;
      done = true;
      t.classList.add('is-out');
      setTimeout(function () { t.remove(); }, 200);
    };
    t.querySelector('.kair-toast__close').addEventListener('click', kill);
    setTimeout(kill, 3400);
  }
  _csvCell(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
  exportCsv() {
    var self = this;
    var rows = this.filtered();
    if (!rows.length) {
      this.toast('warn', 'Sin datos', 'No hay inducciones para exportar con los filtros actuales.');
      indLog('EXPORT', 'CSV', 'EMPTY');
      return;
    }
    var head = ['Fecha', 'Empleado', 'Cédula', 'Cargo', 'Género', 'Puntaje', 'Estado'];
    var body = rows.map(function (r) {
      return [indFmtDate(r.fecha), r.nombre, r.cedula, r.cargo, (r.genero === 'H' ? 'Hombre' : (r.genero === 'M' ? 'Mujer' : '—')),
        r.puntaje, indEstadoDe(r)].map((v) => self._csvCell(v)).join(';');
    });
    var csv = '﻿' + head.map((v) => self._csvCell(v)).join(';') + '\r\n' + body.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'inducciones-' + (this._st.filters.anio === 'all' ? 'todos' : this._st.filters.anio) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 400);
    this.toast('success', 'Exportación generada', rows.length + (rows.length === 1 ? ' inducción exportada' : ' inducciones exportadas') + ' a CSV.');
    indLog('EXPORT', 'CSV', 'OK', rows.length + ' filas');
  }

  /* ================= REFRESCO + VISTAS ================= */
  refreshAll() {
    var m = this.computeMetrics();
    this.renderHero(m);
    this.renderKpis(m);
    this.renderRadar(m);
    this.updateCounts();
    if (this._st.view === 'dashboard') this.renderCharts(m);
    this.renderTable();
  }
  setView(v) {
    if (this._st.view === v) return;
    this._st.view = v;
    var dash = v === 'dashboard';
    var td = this.q('#tab-dashboard'), tr = this.q('#tab-registro');
    if (td) { td.classList.toggle('is-active', dash); td.setAttribute('aria-selected', String(dash)); }
    if (tr) { tr.classList.toggle('is-active', !dash); tr.setAttribute('aria-selected', String(!dash)); }
    var vd = this.q('#view-dashboard'), vr = this.q('#view-registro');
    if (vd) vd.hidden = !dash;
    if (vr) vr.hidden = dash;
    if (dash) this.renderCharts();
    indLog('TAB', 'SWITCH', 'OK', v);
  }

  /* ================= EVENTOS ================= */
  _bindEvents() {
    var self = this;
    var on = function (sel, ev, fn) {
      var el = self.q(sel);
      if (el) el.addEventListener(ev, fn);
    };
    on('#tab-dashboard', 'click', function () { self.setView('dashboard'); });
    on('#tab-registro', 'click', function () { self.setView('registro'); });
    on('#btn-ver-reprobados', 'click', function () {
      self._st.filters.estado = 'REPROBADO';
      self._st.filters.q = '';
      self._st.page = 1;
      var fe = self.q('#f-estado'); if (fe) fe.value = 'REPROBADO';
      var fb = self.q('#f-buscar'); if (fb) fb.value = '';
      self._syncIndPickers();
      self.setView('registro');
      self.renderTable();
      indLog('DASHBOARD', 'VER_REPROBADOS', 'OK');
    });
    on('#btn-radar-registro', 'click', function () { self.setView('registro'); });
    on('#btn-volver', 'click', function () {
      if (self.backToModuleCallback) self.backToModuleCallback();
      else self.toast('info', 'Navegación', 'Vista disponible al integrar con el módulo Talento Humano.');
      indLog('NAV', 'VOLVER', 'OK');
    });
    ['#bc-inicio', '#bc-gestion', '#bc-modulo'].forEach(function (sel) {
      on(sel, 'click', function (e) {
        e.preventDefault();
        self.toast('info', 'Navegación', 'Ruta disponible al integrar con la aplicación.');
      });
    });
    // Sincronización REAL (Google Forms) — se conserva el flujo existente
    on('#btn-sync', 'click', function () { self.syncFromForms(); });
    on('#btn-sync-dismiss', 'click', function () {
      var b = self.q('#sync-banner'); if (b) b.style.display = 'none';
    });
    on('#btn-sync-now', 'click', function () {
      var b = self.q('#sync-banner'); if (b) b.style.display = 'none';
      self.syncFromForms();
    });
    on('#btn-exportar', 'click', function () { self.exportCsv(); });
    on('#btn-registrar', 'click', function () { self.openIndModal(null); });
    on('#btn-limpiar', 'click', function () { self.clearRegistroFilters(); });
    on('#btn-limpiar-empty', 'click', function () { self.clearRegistroFilters(); });
    on('#d-anio', 'change', function (e) { self.setAnio(e.target.value); });
    on('#f-anio', 'change', function (e) { self.setAnio(e.target.value); });
    on('#d-genero', 'change', function (e) {
      self._st.filters.genero = e.target.value;
      self.refreshAll();
      indLog('FILTER', 'GENERO', 'OK', e.target.value);
    });
    on('#f-estado', 'change', function (e) {
      self._st.filters.estado = e.target.value;
      self._st.page = 1;
      self.renderTable();
      indLog('FILTER', 'ESTADO', 'OK', e.target.value);
    });
    var search = this.q('#f-buscar');
    if (search) {
      search.addEventListener('input', indDebounce(function (e) {
        self._st.filters.q = e.target.value;
        self._st.page = 1;
        self.renderTable();
        indLog('FILTER', 'BUSCAR', 'OK', self._st.filters.q || '(vacío)');
      }, 260));
    }
    var pager = this.q('#pager');
    if (pager) {
      pager.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-pg]');
        if (!b || b.disabled) return;
        var rows = self.filtered();
        var pages = Math.max(1, Math.ceil(rows.length / self._st.pageSize));
        var v = b.dataset.pg;
        if (v === 'prev') self._st.page = Math.max(1, self._st.page - 1);
        else if (v === 'next') self._st.page = Math.min(pages, self._st.page + 1);
        else self._st.page = Number(v);
        self.renderTable();
        indLog('TABLE', 'PAGE', 'OK', self._st.page);
      });
    }
    var tbody = this.q('#tbody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-action]');
        if (!btn) return;
        var tr = btn.closest('tr');
        var id = tr ? tr.dataset.id : null;
        if (!id) return;
        if (btn.dataset.action === 'edit') self.openIndModal(id);
      });
    }
    // Cierre de modales: overlay, [data-close] y Esc
    this.qa('.kair-modal').forEach(function (mm) {
      mm.addEventListener('click', function (e) { if (e.target === mm) self.closeModal(mm); });
      mm.querySelectorAll('[data-close]').forEach(function (b) {
        b.addEventListener('click', function () { self.closeModal(mm); });
      });
    });
    this._keyHandler = function (e) {
      if (e.key === 'Escape') {
        var open = self.qa('.kair-modal.is-open');
        if (open.length) self.closeModal(open[open.length - 1]);
      }
    };
    document.addEventListener('keydown', this._keyHandler);
    on('#ind-puntaje', 'input', function () { self.updatePrev(); });
    [['ind-nombre', 'fw-nombre'], ['ind-cedula', 'fw-cedula'], ['ind-cargo', 'fw-cargo'],
     ['ind-genero', 'fw-genero'], ['ind-fecha', 'fw-fecha'], ['ind-puntaje', 'fw-puntaje']].forEach(function (pair) {
      var el = self.q('#' + pair[0]);
      if (!el) return;
      ['input', 'change'].forEach(function (ev) {
        el.addEventListener(ev, function () { self.setErr(pair[1], false); });
      });
    });
    var form = this.q('#form-induccion');
    if (form) form.addEventListener('submit', function (e) { self._onSubmit(e); });
    this._resizeHandler = indDebounce(function () {
      if (self._st.view === 'dashboard') self.renderCharts();
    }, 220);
    window.addEventListener('resize', this._resizeHandler);
    // 📦1108 — Los seis desplegables (los cuatro filtros del toolbar + el
    // género y la fecha del modal).
    this._initIndPickers();
  }
  _onSubmit(e) {
    e.preventDefault();
    var val = (sel) => { var el = this.q(sel); return el ? el.value.trim() : ''; };
    var nombre = val('#ind-nombre');
    var cedula = val('#ind-cedula');
    var cargo = val('#ind-cargo');
    var genEl = this.q('#ind-genero');
    var genero = genEl ? genEl.value : '';
    var fecha = val('#ind-fecha');
    var puntajeRaw = val('#ind-puntaje');
    var puntaje = Number(puntajeRaw);
    var ok = true;
    this.setErr('fw-nombre', !nombre); if (!nombre) ok = false;
    var cedOk = /^\d{6,12}$/.test(cedula);
    this.setErr('fw-cedula', !cedOk); if (!cedOk) ok = false;
    this.setErr('fw-cargo', !cargo); if (!cargo) ok = false;
    this.setErr('fw-genero', !genero); if (!genero) ok = false;
    this.setErr('fw-fecha', !fecha); if (!fecha) ok = false;
    var pOk = puntajeRaw !== '' && !isNaN(puntaje) && puntaje >= 0 && puntaje <= IND_PUNTAJE_MAX;
    this.setErr('fw-puntaje', !pOk); if (!pOk) ok = false;
    if (!ok) { indLog('INDUCCION', 'VALIDATE', 'ERROR'); return; }
    var payload = { fecha: fecha, nombre: nombre, cedula: cedula, cargo: cargo, genero: genero,
      puntaje: Math.round(puntaje) };
    if (this._st.editId) {
      var found = null;
      for (var i = 0; i < this._db.length; i++) {
        if (this._db[i].id == this._st.editId) { found = this._db[i]; break; } // == tolera número/string
      }
      if (found) Object.assign(found, payload);
      this.toast('success', 'Cambios guardados', 'La inducción de ' + nombre.split(' ')[0] + ' se actualizó correctamente.');
      indLog('INDUCCION', 'UPDATE', 'OK', this._st.editId);
    } else {
      this._db.push(Object.assign({ id: 'n' + Date.now() }, payload));
      this.toast('success', 'Inducción registrada', 'Se agregó al registro de ' + this.anioLabel() + '.');
      indLog('INDUCCION', 'CREATE', 'OK', payload.nombre.slice(0, 40));
    }
    this.populateCargos();
    this.closeModal(this.q('#modal-induccion'));
    this.refreshAll();
  }

  /* ================= SYNC REAL (Google Forms) ================= */
  async checkForChanges() {
    try {
      if (!window.electronAPI || !window.electronAPI.checkInduccionesChanges) return;
      const result = await window.electronAPI.checkInduccionesChanges(this.currentCompany, this._currentHash);
      if (result.success && result.hasChanges) this.showSyncBanner(result.totalRecords || 0);
    } catch (error) {
      console.error('❌ [Inducciones] Error al verificar cambios:', error);
    }
  }
  showSyncBanner(newRecordsCount) {
    const banner = this.q('#sync-banner');
    const message = this.q('#sync-banner-message');
    if (banner && message) {
      message.textContent = 'Hay ' + newRecordsCount + ' registros disponibles en Google Forms. ¿Desea sincronizar ahora?';
      banner.style.display = 'flex';
    }
  }
  async syncFromForms() {
    const btn = this.q('#btn-sync');
    const notifier = window.updateNotifier;
    try {
      if (btn) { btn.disabled = true; btn.classList.add('is-spinning'); }
      if (!window.electronAPI || !window.electronAPI.syncInduccionesFromForms) {
        throw new Error('API de sincronización no disponible');
      }
      if (notifier) {
        notifier.show({ type: 'info', title: 'Sincronizando',
          subtitle: 'Actualizando datos desde Google Forms...', progress: { percent: 0 }, autoClose: 0 });
      }
      const result = await window.electronAPI.syncInduccionesFromForms(this.currentCompany);
      if (result.success) {
        console.log('✅ [Inducciones] Sincronización completada:', result.data.length, 'registros');
        this._db = (result.data || []).map((r) => this._normRecord(r)).filter(Boolean);
        this._currentHash = result.currentHash;
        this._lastSyncTime = new Date();
        this._st.page = 1;
        this._afterDataReady();
        if (notifier) {
          notifier.show({ type: 'success', title: 'Sincronización Completa',
            subtitle: result.message || (this._db.length + ' registros actualizados'), autoClose: 5000 });
        }
      } else {
        throw new Error(result.error || 'Error en sincronización');
      }
    } catch (error) {
      console.error('❌ [Inducciones] Error en sincronización:', error);
      if (notifier) {
        notifier.show({ type: 'error', title: 'Error de Sincronización', subtitle: error.message, autoClose: 6000 });
      }
    } finally {
      if (btn) { btn.disabled = false; btn.classList.remove('is-spinning'); }
    }
  }
}

window.InduccionesComponent = InduccionesComponent;
