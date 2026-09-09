// modules/gestion-humana/vacaciones/index.js
// 📦757 · Vacaciones — Estilo demo Tempoactiva
//
// Layout:
//   - 4 KPIs: Pendientes, Aprobadas, Disfrutadas, Por Notificar a Cliente
//   - Header sección + botones (Listado Mensual, Solicitar Vacaciones)
//   - Tabs: Todas / Solicitada / Aprobada / Rechazada / Disfrutada
//   - Tabla: Trabajador, Cargo, Sede, Fechas, Días, Estado, Cliente, Acciones
//   - Info box "Flujo de Vacaciones" (instrucciones del proceso)
//   - Modal "Solicitar Vacaciones" (trabajador + fechas + días)
//
// Backend: 6 handlers (list/get/create/update/delete/cambiar-estado)

class VacacionesComponent {
  constructor(container, companyName, moduleName, subName, onBack) {
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.subName = subName;
    this.onBack = onBack;
    this.items = [];
    this.trabajadores = [];
    this.sedes = [];
    this._trabajadorById = {};
    this._sedeById = {};
    this.tab = 'personal';
    this.loading = true;
  }

  // Personal activo (normaliza estados legacy A/act/activo)
  _esActivo(t) {
    var s = String((t && t.estado) || '').toLowerCase();
    return s === 'a' || s === 'act' || s === 'activo';
  }
  _personalActivo() {
    var self = this;
    return this.trabajadores
      .filter(function (t) { return self._esActivo(t); })
      .sort(function (a, b) { return ((a.nombres || '') + ' ' + (a.apellidos || '')).localeCompare((b.nombres || '') + ' ' + (b.apellidos || '')); });
  }
  // Solicitud abierta (solicitada/aprobada/programada) más reciente del trabajador
  _solicitudAbierta(trabajadorId) {
    var best = null;
    this.items.forEach(function (v) {
      if (v.trabajadorId !== trabajadorId) return;
      if (v.estado !== 'solicitada' && v.estado !== 'aprobada' && v.estado !== 'programada') return;
      if (!best || String(v.fechaSolicitud || '') > String(best.fechaSolicitud || '')) best = v;
    });
    return best;
  }

  // ─── Helpers ───
  // Getter (NO método): todo el módulo lo usa como propiedad
  // (this._toast.success(...)). Si fuera método, cada acceso lanzaría
  // TypeError y abortaría las recargas que vienen después del aviso.
  get _toast() {
    // 📦GESTION-HUMANA-TOAST — Helper estandarizado con title+subtitle+type.
    if (window.parent && window.parent.GestionHumanaToast) return window.parent.GestionHumanaToast;
    if (window.GestionHumanaToast) return window.GestionHumanaToast;
    // Fallback: KAIRToast directo (compatibilidad si el helper no cargó).
    var k = (window.parent && window.parent.KAIRToast) ? window.parent.KAIRToast : window.KAIRToast;
    if (k) return k;
    // Última red: objeto nulo para que un helper ausente nunca bloquee recargas.
    return { success: function () {}, error: function () {}, warning: function () {}, info: function () {}, show: function () {} };
  }
  _showToast(msg, type) {
    var t = this._toast;
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
  _escHtml(s) { if (s == null) return ''; return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  _fmtDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) { return iso; }
  }
  _isoToInputDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toISOString().slice(0, 10); } catch (e) { return ''; }
  }
  _inputDateToIso(s) {
    if (!s) return '';
    try { return new Date(s + 'T12:00:00').toISOString(); } catch (e) { return ''; }
  }
  _diffDias(inicio, fin) {
    if (!inicio || !fin) return null;
    var a = new Date(inicio);
    var b = new Date(fin);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    return Math.round((b - a) / 86400000) + 1;
  }

  // ─── Días hábiles (lunes a sábado; domingo y festivos no cuentan) ───
  _inputToDate(s) {
    var p = String(s || '').split('-');
    if (p.length < 3) return null;
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    return isNaN(d.getTime()) ? null : d;
  }
  _dateToInput(d) {
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }
  _esHabilDia(input) {
    var d = this._inputToDate(input);
    if (!d) return false;
    if (d.getDay() === 0) return false; // domingo
    try {
      if (window.ColombiaFestivos && typeof window.ColombiaFestivos.getFestivoByDate === 'function') {
        if (window.ColombiaFestivos.getFestivoByDate(input)) return false;
      }
    } catch (e) { /* sin festivos: solo domingos */ }
    return true;
  }
  _contarHabiles(inicio, fin) {
    if (!inicio || !fin || inicio > fin) return null;
    var d = this._inputToDate(inicio);
    var end = this._inputToDate(fin);
    if (!d || !end) return null;
    var n = 0;
    var guard = 0;
    while (d <= end && guard < 750) {
      if (this._esHabilDia(this._dateToInput(d))) n++;
      d.setDate(d.getDate() + 1);
      guard++;
    }
    return n;
  }
  _sumarHabiles(inicio, n) {
    // Suma n días hábiles desde inicio (el inicio cuenta como día 1 si es hábil)
    var d = this._inputToDate(inicio);
    if (!d || !(n > 0)) return null;
    while (!this._esHabilDia(this._dateToInput(d))) d.setDate(d.getDate() + 1);
    var contados = 1;
    var guard = 0;
    while (contados < n && guard < 750) {
      d.setDate(d.getDate() + 1);
      if (this._esHabilDia(this._dateToInput(d))) contados++;
      guard++;
    }
    return this._dateToInput(d);
  }

  // ─── Recomendación de vacaciones (todo en memoria, sin backend nuevo) ───
  // Regla Tempoactiva (servicios temporales): proporcionales por días exactos
  // trabajados — causados = días × 15 / 360 (base de liquidación). Como el
  // personal rara vez cumple 12 meses, el saldo se parte en: a disfrutar
  // (días enteros, con fechas sugeridas) + a compensar en dinero al terminar
  // el contrato (incluye la fracción). Usados = suma de días de todo lo no
  // rechazado ni cancelado.
  _red1(v) { return Math.round(v * 10) / 10; }
  _recomendarVacaciones(t) {
    var self = this;
    if (!t.fechaIngreso) return { ok: false, mensaje: 'Sin fecha de ingreso registrada: no se puede calcular el saldo.' };
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    var ing = self._inputToDate(String(t.fechaIngreso).slice(0, 10));
    if (!ing) return { ok: false, mensaje: 'Fecha de ingreso inválida: no se puede calcular el saldo.' };
    var diasTrab = Math.floor((hoy - ing) / 86400000);
    if (diasTrab < 0) diasTrab = 0;
    var causados = self._red1(diasTrab * 15 / 360);
    var historial = this.items.filter(function (v) {
      return v.trabajadorId === t.id && v.estado !== 'rechazada' && v.estado !== 'cancelado';
    });
    var usados = historial.reduce(function (acc, v) { return acc + (parseInt(v.diasSolicitados, 10) || 0); }, 0);
    var saldo = self._red1(causados - usados);
    var anos = Math.floor(diasTrab / 360);
    var mesesR = Math.floor((diasTrab % 360) / 30);
    var antigTxt = anos + 'a ' + mesesR + 'm · ' + diasTrab + ' días';
    if (saldo <= 0) {
      var proxAniv = new Date(hoy.getFullYear(), ing.getMonth(), ing.getDate());
      if (proxAniv <= hoy) proxAniv = new Date(hoy.getFullYear() + 1, ing.getMonth(), ing.getDate());
      return { ok: true, saldo: saldo, causados: causados, usados: usados, antiguedad: antigTxt, aDisfrutar: 0, aCompensar: 0, sugerencia: null, proximoAniversario: self._dateToInput(proxAniv) };
    }
    var enteros = Math.floor(saldo);
    var fraccion = self._red1(saldo - enteros);
    if (enteros < 1) {
      return { ok: true, saldo: saldo, causados: causados, usados: usados, antiguedad: antigTxt, aDisfrutar: 0, aCompensar: saldo, sugerencia: null, soloCompensar: true };
    }
    // Rango sugerido para los días enteros: desde hoy, saltando períodos ya
    // programados del trabajador
    var rangos = historial
      .filter(function (v) { return v.fechaInicio && v.fechaFin; })
      .map(function (v) { return { ini: String(v.fechaInicio).slice(0, 10), fin: String(v.fechaFin).slice(0, 10) }; })
      .sort(function (a, b) { return a.ini < b.ini ? -1 : 1; });
    var inicio = self._dateToInput(hoy);
    var guard = 0;
    var movido = true;
    while (movido && guard < 370) {
      movido = false;
      guard++;
      for (var i = 0; i < rangos.length; i++) {
        if (inicio >= rangos[i].ini && inicio <= rangos[i].fin) {
          var dFin = self._inputToDate(rangos[i].fin);
          dFin.setDate(dFin.getDate() + 1);
          inicio = self._dateToInput(dFin);
          movido = true;
          break;
        }
      }
    }
    var fin = self._sumarHabiles(inicio, enteros);
    return { ok: true, saldo: saldo, causados: causados, usados: usados, antiguedad: antigTxt, aDisfrutar: enteros, aCompensar: fraccion, sugerencia: { inicio: inicio, fin: fin, dias: enteros } };
  }

  _renderRecomendacion(backdrop, trabajadorId) {
    var self = this;
    var zone = backdrop.querySelector('#va-reco-zone');
    if (!zone) return;
    var t = this._trabajadorById[trabajadorId];
    if (!t) { zone.innerHTML = ''; return; }
    var r = this._recomendarVacaciones(t);
    var base = 'border-radius:0.5rem;padding:0.7rem 0.9rem;font-size:0.78rem;margin-top:0.25rem;';
    if (!r.ok) {
      zone.innerHTML = '<div style="background:#fff8e1;border:1px solid #ffe69b;color:#856404;' + base + '"><i class="fas fa-info-circle"></i> ' + self._escHtml(r.mensaje) + '</div>';
      return;
    }
    if (r.soloCompensar) {
      zone.innerHTML = '<div style="background:#fff3cd;border:1px solid #ffe69b;color:#856404;' + base + '">' +
        '<strong>Saldo menor a 1 día: se compensa en dinero al terminar el contrato.</strong> Causados proporcionales: ' + r.causados + ' · Usados: ' + r.usados + ' · Saldo: <strong>' + r.saldo + '</strong> · Antigüedad: ' + self._escHtml(r.antiguedad) + '.</div>';
      return;
    }
    if (!r.sugerencia) {
      zone.innerHTML = '<div style="background:#fff3cd;border:1px solid #ffe69b;color:#856404;' + base + '">' +
        '<strong>Sin saldo disponible.</strong> Causados proporcionales: ' + r.causados + ' · Usados: ' + r.usados + ' · Antigüedad: ' + self._escHtml(r.antiguedad) + '.' +
        (r.proximoAniversario ? ' Próximo aniversario: ' + self._fmtDate(r.proximoAniversario) + '.' : '') + '</div>';
      return;
    }
    zone.innerHTML = '<div style="background:#e8f0fe;border:1px solid #c5d9f5;color:#174ea6;' + base + '">' +
      '<div style="font-weight:600;margin-bottom:0.25rem;"><i class="fas fa-wand-magic-sparkles"></i> Sugerencia según su saldo</div>' +
      '<div>Antigüedad: <strong>' + self._escHtml(r.antiguedad) + '</strong> · Causados proporcionales: <strong>' + r.causados + '</strong> · Usados: <strong>' + r.usados + '</strong> · Saldo: <strong>' + r.saldo + '</strong></div>' +
      '<div style="margin-top:0.25rem;">A disfrutar: <strong>' + r.aDisfrutar + ' días</strong> — del <strong>' + self._fmtDate(r.sugerencia.inicio) + '</strong> al <strong>' + self._fmtDate(r.sugerencia.fin) + '</strong> (sin traslapar lo programado).' +
      (r.aCompensar > 0 ? ' A compensar en dinero al terminar: <strong>' + r.aCompensar + ' días</strong>.' : ' Sin fracción pendiente.') + '</div>' +
      '<div style="margin-top:0.5rem;"><button class="va-btn va-btn--primary" type="button" id="va-reco-apply" style="font-size:0.75rem;padding:0.35rem 0.8rem;"><i class="fas fa-check"></i> Aplicar sugerencia</button></div>' +
    '</div>';
    var applyBtn = zone.querySelector('#va-reco-apply');
    if (applyBtn) {
      applyBtn.onclick = function () {
        backdrop.querySelector('input[name="fechaInicio"]').value = r.sugerencia.inicio;
        backdrop.querySelector('input[name="fechaFin"]').value = r.sugerencia.fin;
        backdrop.querySelector('input[name="dias"]').value = r.sugerencia.dias;
        self._pintarAvisoTraslape(backdrop);
      };
    }
  }

  // Aviso no bloqueante si las fechas elegidas se cruzan con otra solicitud
  _pintarAvisoTraslape(backdrop) {
    var sel = backdrop.querySelector('select[name="trabajadorId"]');
    var fi = backdrop.querySelector('input[name="fechaInicio"]');
    var ff = backdrop.querySelector('input[name="fechaFin"]');
    var zone = backdrop.querySelector('#va-reco-zone');
    if (!sel || !fi || !ff || !fi.value || !ff.value) return;
    var tid = sel.value;
    if (!tid) return;
    var cruza = this.items.some(function (v) {
      if (v.trabajadorId !== tid || v.estado === 'rechazada' || v.estado === 'cancelado') return false;
      var a = String(v.fechaInicio || '').slice(0, 10);
      var b = String(v.fechaFin || '').slice(0, 10);
      return fi.value <= b && a <= ff.value;
    });
    var hint = backdrop.querySelector('#va-overlap-hint');
    if (cruza && !hint) {
      var d = document.createElement('div');
      d.id = 'va-overlap-hint';
      d.setAttribute('style', 'background:#fff3cd;border:1px solid #ffe69b;color:#856404;border-radius:0.5rem;padding:0.5rem 0.8rem;font-size:0.75rem;margin-top:0.25rem;');
      d.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Estas fechas se cruzan con otra solicitud de este trabajador.';
      zone.parentNode.insertBefore(d, zone.nextSibling);
    } else if (!cruza && hint && hint.parentNode) {
      hint.parentNode.removeChild(hint);
    }
  }

  // ─── Carga de datos ───
  async _load() {
    if (!window.electronAPI || !this.companyName) { this.loading = false; return; }
    try {
      var results = await Promise.all([
        window.electronAPI.ghListVacaciones({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListPersonal({ companyName: this.companyName }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListSedes({ companyName: this.companyName }).catch(function () { return { success: false }; })
      ]);
      this.items = (results[0].success && results[0].data) ? (results[0].data.vacaciones || []) : [];
      this.trabajadores = (results[1].success && results[1].data) ? (results[1].data.personales || []) : [];
      this.sedes = (results[2].success && results[2].data) ? (results[2].data.sedes || []) : [];
      this._trabajadorById = {}; this._sedeById = {};
      var self = this;
      this.trabajadores.forEach(function (t) { self._trabajadorById[t.id] = t; });
      this.sedes.forEach(function (s) { self._sedeById[s.id] = s; });
    } catch (e) { this._toast.error('Error cargando vacaciones', e.message); }
    this.loading = false;
  }

  // ─── Cálculos ───
  _kpis() {
    var self = this;
    return {
      pendientes:   this.items.filter(function (x) { return x.estado === 'solicitada'; }).length,
      aprobadas:    this.items.filter(function (x) { return x.estado === 'aprobada'; }).length,
      disfrutadas:  this.items.filter(function (x) { return x.estado === 'disfrutada'; }).length,
      porNotificar: this.items.filter(function (x) { return x.estado === 'aprobada' && !x.clienteNotificado; }).length
    };
  }
  _countByEstado(id) {
    if (id === 'todas') return this.items.length;
    if (id === 'personal') return this._personalActivo().length;
    return this.items.filter(function (x) { return x.estado === id; }).length;
  }
  _filtered() {
    if (this.tab === 'todas') return this.items;
    if (this.tab === 'personal') return this._personalActivo();
    var tab = this.tab;
    return this.items.filter(function (x) { return x.estado === tab; });
  }

  // ─── Fetch + fallback HTML ───
  async _fetchHtml() {
    try {
      var r = await fetch('modules/gestion-humana/vacaciones/index.html');
      if (r.ok) return await r.text();
    } catch (e) { console.warn('[Vacaciones] fetch HTML falló, usando fallback inline:', e.message); }
    return '<div class="va-wrapper" id="va-wrapper">' +
      '<div class="va-kpi-section"><div id="va-kpi-bar" class="va-kpi-bar"></div></div>' +
      '<div class="va-section-head">' +
        '<div class="va-section-head__text"><h2 class="va-section-head__title">Gestión de Vacaciones</h2>' +
        '<p class="va-section-head__subtitle">Programación, aprobaciones y notificación a clientes</p></div>' +
        '<div class="va-section-head__actions">' +
          '<button id="va-listado-mes" class="va-btn va-btn--ghost" type="button"><i class="fas fa-download"></i> Listado Mensual</button>' +
          '<button id="va-solicitar" class="va-btn va-btn--primary" type="button"><i class="fas fa-plus"></i> Solicitar Vacaciones</button>' +
        '</div>' +
      '</div>' +
      '<div class="va-tabs" id="va-tabs"></div>' +
      '<div id="va-table-wrap" class="va-table-wrap"></div>' +
      '<div class="va-info-box"><div class="va-info-box__icon"><i class="fas fa-info-circle"></i></div>' +
        '<div class="va-info-box__body"><h4 class="va-info-box__title">Flujo de Vacaciones — TEMPOACTIVA</h4>' +
        '<p class="va-info-box__text">Mensualmente (ej: en julio se envían las de agosto), Recursos Humanos genera el listado de personal próximo a salir de vacaciones. Los jefes inmediatos son quienes programan las vacaciones de su personal según la operación. Idealmente, debe notificarse a los clientes cuando un trabajador saldrá de vacaciones para que ellos resuelvan la cobertura.</p>' +
        '<p class="va-info-box__text">Usa el botón <strong>"Listado Mensual"</strong> para exportar el reporte del próximo mes (formato similar al que enviaba Lilimare por correo).</p>' +
        '</div></div>' +
    '</div>';
  }

  // ─── Render principal ───
  async render() {
    var self = this;
    if (!this._html) this._html = await this._fetchHtml();
    this.container.innerHTML = this._html;

    if (this.loading) {
      var kpiBar = this.container.querySelector('#va-kpi-bar');
      if (kpiBar) kpiBar.innerHTML = '<div class="va-loading"><i class="fas fa-spinner fa-spin"></i> Cargando vacaciones…</div>';
      var tw = this.container.querySelector('#va-table-wrap');
      if (tw) tw.innerHTML = '<div class="va-loading"><i class="fas fa-spinner fa-spin"></i> Cargando…</div>';
      await this._load();
    }

    this._renderKpiBar();
    this._renderTabs();
    this._renderTable();

    var btnListado = this.container.querySelector('#va-listado-mes');
    if (btnListado) btnListado.onclick = function () { self._exportListadoMensual(); };
    var btnSolicitar = this.container.querySelector('#va-solicitar');
    if (btnSolicitar) btnSolicitar.onclick = function () { self._openSolicitarModal(); };
  }

  _renderAll() {
    this._renderKpiBar();
    this._renderTabs();
    this._renderTable();
  }

  _renderKpiBar() {
    var bar = this.container.querySelector('#va-kpi-bar');
    if (!bar || !window.GHKPIBar) return;
    var k = this._kpis();
    var kpis = [
      { icon: 'fa-clock',          color: '#a16207', bg: '#fff3cd', value: k.pendientes,   label: 'Pendientes' },
      { icon: 'fa-check',          color: '#28a745', bg: '#d4edda', value: k.aprobadas,    label: 'Aprobadas' },
      { icon: 'fa-umbrella-beach', color: '#0d9488', bg: '#ccfbf1', value: k.disfrutadas,  label: 'Disfrutadas' },
      { icon: 'fa-bell',           color: '#dc3545', bg: '#f8d7da', value: k.porNotificar, label: 'Por Notificar a Cliente' }
    ];
    window.GHKPIBar.render(bar, kpis);
  }

  _renderTabs() {
    var self = this;
    var tabsBar = this.container.querySelector('#va-tabs');
    if (!tabsBar) return;
    var tabs = [
      { id: 'personal',   label: 'Personal' },
      { id: 'todas',      label: 'Todas' },
      { id: 'solicitada', label: 'Solicitada' },
      { id: 'aprobada',   label: 'Aprobada' },
      { id: 'programada', label: 'Programada' },
      { id: 'rechazada',  label: 'Rechazada' },
      { id: 'disfrutada', label: 'Disfrutada' }
    ];
    var html = tabs.map(function (t) {
      var count = self._countByEstado(t.id);
      return '<button class="va-tab ' + (self.tab === t.id ? 'va-tab--active' : '') + '" data-tab="' + t.id + '" type="button">' +
        self._escHtml(t.label) + ' (' + count + ')</button>';
    }).join('');
    tabsBar.innerHTML = html;
    tabsBar.querySelectorAll('.va-tab').forEach(function (b) {
      b.onclick = function () { self.tab = b.getAttribute('data-tab'); self._renderTabs(); self._renderTable(); };
    });
  }

  _renderPersonalRow(t) {
    var self = this;
    var s = this._sedeById[t.sedeId] || {};
    var r = this._recomendarVacaciones(t);
    var sol = this._solicitudAbierta(t.id);
    var saldoHtml = !r.ok
      ? '<span style="color:#856404;">—</span>'
      : '<div class="va-table__name">' + r.saldo + '</div>' +
        '<div class="va-table__sub">C ' + r.causados + ' · U ' + r.usados + '</div>';
    var estadoHtml;
    if (sol) {
      estadoHtml = '<span class="va-badge va-badge--' + sol.estado + '">' + self._escHtml(sol.estado) + '</span>';
    } else {
      estadoHtml = '<span style="display:inline-flex;align-items:center;font-size:0.68rem;font-weight:600;padding:0.15rem 0.5rem;border-radius:0.75rem;background:#e9ecef;color:#6c757d;white-space:nowrap;">Sin solicitud</span>';
    }
    var actions = '';
    if (sol && sol.estado === 'solicitada') {
      actions += '<button class="va-btn--icon success" data-accion="aprobar" data-id="' + self._escHtml(sol.id) + '" title="Aprobar"><i class="fas fa-check"></i></button>';
      actions += '<button class="va-btn--icon danger"  data-accion="rechazar" data-id="' + self._escHtml(sol.id) + '" title="Rechazar"><i class="fas fa-times"></i></button>';
    } else if (sol && sol.estado === 'aprobada') {
      actions += '<button class="va-btn--icon info" data-accion="programar" data-id="' + self._escHtml(sol.id) + '" title="Programar"><i class="fas fa-calendar-alt"></i></button>';
      actions += '<button class="va-btn--icon success" data-accion="disfrutada" data-id="' + self._escHtml(sol.id) + '" title="Marcar disfrutada"><i class="fas fa-umbrella-beach"></i></button>';
    } else if (sol && sol.estado === 'programada') {
      actions += '<button class="va-btn--icon success" data-accion="disfrutada" data-id="' + self._escHtml(sol.id) + '" title="Marcar disfrutada"><i class="fas fa-umbrella-beach"></i></button>';
    }
    actions += '<button class="va-btn--icon info" data-accion="solicitar" data-id="' + self._escHtml(t.id) + '" title="Solicitar vacaciones"><i class="fas fa-paper-plane"></i></button>';
    return '<tr>' +
      '<td><div class="va-table__name">' + self._escHtml(((t.nombres || '') + ' ' + (t.apellidos || '')).trim()) + '</div>' +
      '<div class="va-table__cargo">' + self._escHtml(t.cedula ? ('CC ' + t.cedula) : '—') + '</div></td>' +
      '<td>' + self._escHtml(t.cargo || '—') + '</td>' +
      '<td>' + self._escHtml(s.nombre || '—') + '</td>' +
      '<td class="va-table__date">' + self._escHtml(r.ok ? r.antiguedad : '—') + '</td>' +
      '<td class="va-table__date">' + saldoHtml + '</td>' +
      '<td>' + estadoHtml + '</td>' +
      '<td class="td--right"><div class="va-table__actions">' + actions + '</div></td>' +
    '</tr>';
  }

  _renderTable() {
    var self = this;
    var wrap = this.container.querySelector('#va-table-wrap');
    if (!wrap) return;
    if (this.tab === 'personal') {
      var lista = this._filtered();
      if (lista.length === 0) {
        wrap.innerHTML = '<div class="va-table-card"><table class="va-table va-table--personal" style="table-layout:fixed;width:100%;"><thead><tr>' +
          '<th>Trabajador</th><th>Cargo</th><th>Sede</th><th>Antigüedad</th><th>Saldo</th><th>Estado</th><th class="th--right">Acciones</th>' +
          '</tr></thead><tbody><tr><td colspan="7" class="va-empty-row">No hay personal activo.</td></tr></tbody></table></div>';
        return;
      }
      wrap.innerHTML = '<div class="va-table-card"><table class="va-table va-table--personal" style="table-layout:fixed;width:100%;min-width:880px;"><colgroup>' +
        '<col style="width:24%" /><col style="width:14%" /><col style="width:12%" /><col style="width:17%" />' +
        '<col style="width:9%" /><col style="width:12%" /><col style="width:12%" />' +
        '</colgroup><thead><tr>' +
        '<th>Trabajador</th><th>Cargo</th><th>Sede</th><th>Antigüedad</th><th>Saldo (C·U)</th><th>Estado</th><th class="th--right">Acciones</th>' +
        '</tr></thead><tbody>' + lista.map(function (t) { return self._renderPersonalRow(t); }).join('') + '</tbody></table></div>';
      wrap.querySelectorAll('button[data-accion]').forEach(function (b) {
        b.onclick = function () {
          var accion = b.getAttribute('data-accion');
          var id = b.getAttribute('data-id');
          if (accion === 'aprobar')           self._cambiarEstado(id, 'aprobada');
          else if (accion === 'rechazar')     self._cambiarEstado(id, 'rechazada');
          else if (accion === 'programar')    self._programar(id);
          else if (accion === 'disfrutada')   self._cambiarEstado(id, 'disfrutada');
          else if (accion === 'notificar')    self._notificarCliente(id);
          else if (accion === 'solicitar')    self._openSolicitarModal(id);
        };
      });
      return;
    }
    var filtered = this._filtered();
    if (filtered.length === 0) {
      wrap.innerHTML = '<div class="va-table-card">' +
        '<table class="va-table"><thead><tr>' +
        '<th>Trabajador</th><th>Cargo</th><th>Sede</th>' +
        '<th>Fecha Inicio</th><th>Fecha Fin</th><th>Días</th>' +
        '<th>Estado</th><th>Cliente</th><th class="th--right">Acciones</th>' +
        '</tr></thead><tbody><tr><td colspan="9" class="va-empty-row">No hay vacaciones en este estado.</td></tr></tbody></table></div>';
      return;
    }
    var rows = filtered.map(function (v) { return self._renderRow(v); }).join('');
    wrap.innerHTML = '<div class="va-table-card">' +
      '<table class="va-table"><thead><tr>' +
      '<th>Trabajador</th><th>Cargo</th><th>Sede</th>' +
      '<th>Fecha Inicio</th><th>Fecha Fin</th><th>Días</th>' +
      '<th>Estado</th><th>Cliente</th><th class="th--right">Acciones</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';

    wrap.querySelectorAll('button[data-accion]').forEach(function (b) {
      b.onclick = function () {
        var accion = b.getAttribute('data-accion');
        var id = b.getAttribute('data-id');
        if (accion === 'aprobar')        self._cambiarEstado(id, 'aprobada');
        else if (accion === 'rechazar')  self._cambiarEstado(id, 'rechazada');
        else if (accion === 'programar') self._programar(id);
        else if (accion === 'disfrutada') self._cambiarEstado(id, 'disfrutada');
        else if (accion === 'notificar') self._notificarCliente(id);
      };
    });
  }

  _renderRow(v) {
    var self = this;
    var t = this._trabajadorById[v.trabajadorId] || {};
    var s = this._sedeById[t.sedeId] || {};

    // Badge de cliente
    var clienteHtml = '';
    if (v.estado === 'aprobada') {
      if (v.clienteNotificado) {
        clienteHtml = '<span class="va-cliente-badge va-cliente-badge--notificado"><i class="fas fa-check"></i> Notificado</span>';
      } else {
        clienteHtml = '<span class="va-cliente-badge va-cliente-badge--pendiente"><i class="fas fa-clock"></i> Pendiente</span>';
      }
    } else {
      clienteHtml = '<span class="va-cliente-badge va-cliente-badge--na">—</span>';
    }

    // Acciones por estado
    var actions = '';
    if (v.estado === 'solicitada') {
      actions += '<button class="va-btn--icon success" data-accion="aprobar" data-id="' + self._escHtml(v.id) + '" title="Aprobar"><i class="fas fa-check"></i></button>';
      actions += '<button class="va-btn--icon danger"  data-accion="rechazar" data-id="' + self._escHtml(v.id) + '" title="Rechazar"><i class="fas fa-times"></i></button>';
    } else if (v.estado === 'aprobada') {
      actions += '<button class="va-btn--icon info"    data-accion="programar" data-id="' + self._escHtml(v.id) + '" title="Programar"><i class="fas fa-calendar-alt"></i></button>';
      actions += '<button class="va-btn--icon success" data-accion="disfrutada" data-id="' + self._escHtml(v.id) + '" title="Marcar disfrutada"><i class="fas fa-umbrella-beach"></i></button>';
      if (!v.clienteNotificado) {
        actions += '<button class="va-btn--icon info"    data-accion="notificar" data-id="' + self._escHtml(v.id) + '" title="Notificar al cliente"><i class="fas fa-envelope"></i></button>';
      }
    } else if (v.estado === 'programada') {
      actions += '<button class="va-btn--icon success" data-accion="disfrutada" data-id="' + self._escHtml(v.id) + '" title="Marcar disfrutada"><i class="fas fa-umbrella-beach"></i></button>';
      if (!v.clienteNotificado) {
        actions += '<button class="va-btn--icon info"    data-accion="notificar" data-id="' + self._escHtml(v.id) + '" title="Notificar al cliente"><i class="fas fa-envelope"></i></button>';
      }
    }

    var sinTrabajador = !t.id;
    return '<tr>' +
      '<td>' +
        '<div class="va-table__name">' + self._escHtml(((t.nombres || '') + ' ' + (t.apellidos || '')).trim() || (sinTrabajador ? 'Trabajador no encontrado' : '')) + '</div>' +
        '<div class="va-table__cargo">' + self._escHtml(t.cedula || (sinTrabajador ? ('ID: ' + String(v.trabajadorId || '').slice(0, 12) + '…') : '—')) + '</div>' +
      '</td>' +
      '<td>' + self._escHtml(t.cargo || '—') + '</td>' +
      '<td>' + self._escHtml(s.nombre || '—') + '</td>' +
      '<td class="va-table__date">' + self._fmtDate(v.fechaInicio) + '</td>' +
      '<td class="va-table__date">' + self._fmtDate(v.fechaFin) + '</td>' +
      '<td class="va-table__date">' + (v.diasSolicitados || '—') + '</td>' +
      '<td><span class="va-badge va-badge--' + v.estado + '">' + self._escHtml(v.estado) + '</span></td>' +
      '<td>' + clienteHtml + '</td>' +
      '<td class="td--right"><div class="va-table__actions">' + actions + '</div></td>' +
    '</tr>';
  }

  // ─── Modal: Solicitar Vacaciones ───
  _openSolicitarModal(presetTrabajadorId) {
    var self = this;
    if (document.getElementById('va-solicitar-backdrop')) return; // evita ventanas apiladas por doble clic
    if (this.trabajadores.length === 0) {
      this._toast.warning('No hay trabajadores registrados. Carga la Base Personal primero.');
      return;
    }
    var today = new Date().toISOString().slice(0, 10);
    var choices = this.trabajadores
      .slice()
      .sort(function (a, b) { return ((a.nombres || '') + ' ' + (a.apellidos || '')).localeCompare((b.nombres || '') + ' ' + (b.apellidos || '')); })
      .map(function (t) { return '<option value="' + self._escHtml(t.id) + '">' + self._escHtml((t.nombres || '') + ' ' + (t.apellidos || '') + (t.cedula ? ' · CC ' + t.cedula : '')) + '</option>'; })
      .join('');

    var html =
      '<div class="va-modal-backdrop" id="va-solicitar-backdrop">' +
        '<div class="va-modal" role="dialog" aria-modal="true">' +
          '<div class="va-modal__head">' +
            '<div>' +
              '<h2 class="va-modal__title">Solicitar Vacaciones</h2>' +
              '<p class="va-modal__sub">Inicia un proceso de solicitud. Quedará en estado <strong>Solicitada</strong> hasta que sea aprobada o rechazada.</p>' +
            '</div>' +
            '<button class="va-modal__close" type="button" aria-label="Cerrar">×</button>' +
          '</div>' +
          '<div class="va-modal__body">' +
            '<form id="va-solicitar-form" class="va-form-grid">' +
              '<div class="va-field va-field--full"><label>Buscar trabajador</label>' +
                '<input type="text" id="va-trab-search" placeholder="Nombre o número de cédula…" autocomplete="off" /></div>' +
              '<div class="va-field va-field--full" id="va-cedula-status" style="margin-top:-0.35rem;"></div>' +
              '<div class="va-field va-field--full"><label>Trabajador <span class="req">*</span></label>' +
                '<select name="trabajadorId" required><option value="">— Selecciona un trabajador —</option>' + choices + '</select>' +
                '<div id="va-trab-count" style="font-size:0.7rem;color:#5a6378;margin-top:0.2rem;"></div></div>' +
              '<div class="va-field va-field--full" id="va-reco-zone"></div>' +
              '<div class="va-field"><label>Fecha Inicio <span class="req">*</span></label><input type="date" name="fechaInicio" required value="' + today + '" /></div>' +
              '<div class="va-field"><label>Fecha Fin <span class="req">*</span></label><input type="date" name="fechaFin" required /></div>' +
              '<div class="va-field"><label>Días hábiles <span class="req">*</span></label><input type="number" name="dias" min="1" required value="8" /></div>' +
              '<div class="va-field"><label>Fecha Solicitud</label><input type="date" name="fechaSolicitud" value="' + today + '" /></div>' +
              '<div class="va-field va-field--full"><label>Observaciones</label><textarea name="notas" rows="2" placeholder="Opcional"></textarea></div>' +
            '</form>' +
          '</div>' +
          '<div class="va-modal__foot">' +
            '<button class="va-btn va-btn--ghost" type="button" data-action="cancel">Cancelar</button>' +
            '<button class="va-btn va-btn--primary" type="button" data-action="submit"><i class="fas fa-paper-plane"></i> Enviar Solicitud</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var backdrop = wrap.firstChild;
    document.body.appendChild(backdrop);

    var close = function () { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };
    backdrop.querySelector('.va-modal__close').onclick = close;
    backdrop.querySelector('[data-action="cancel"]').onclick = close;
    backdrop.onclick = function (e) { if (e.target === backdrop) close(); };

    // Auto-calcular días hábiles al cambiar fechas + aviso de traslape
    var fechaInicioEl = backdrop.querySelector('input[name="fechaInicio"]');
    var fechaFinEl    = backdrop.querySelector('input[name="fechaFin"]');
    var diasEl        = backdrop.querySelector('input[name="dias"]');
    var selectEl      = backdrop.querySelector('select[name="trabajadorId"]');
    var syncDias = function () {
      var d = self._contarHabiles(fechaInicioEl.value, fechaFinEl.value);
      if (d && d > 0) diasEl.value = d;
      self._pintarAvisoTraslape(backdrop);
    };
    fechaInicioEl.onchange = syncDias;
    fechaFinEl.onchange    = syncDias;

    // Búsqueda por nombre o cédula (filtra las opciones en memoria)
    var searchEl = backdrop.querySelector('#va-trab-search');
    var countEl = backdrop.querySelector('#va-trab-count');
    var norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
    var paintOptions = function (keepId) {
      var q = norm(searchEl.value);
      var list = self.trabajadores
        .slice()
        .sort(function (a, b) { return ((a.nombres || '') + ' ' + (a.apellidos || '')).localeCompare((b.nombres || '') + ' ' + (b.apellidos || '')); })
        .filter(function (t) {
          if (!q) return true;
          return norm((t.nombres || '') + ' ' + (t.apellidos || '')).indexOf(q) >= 0 ||
                 norm(t.cedula).indexOf(q) >= 0;
        });
      selectEl.innerHTML = '<option value="">— Selecciona un trabajador —</option>' + list.map(function (t) {
        return '<option value="' + self._escHtml(t.id) + '">' + self._escHtml((t.nombres || '') + ' ' + (t.apellidos || '') + (t.cedula ? ' · CC ' + t.cedula : '')) + '</option>';
      }).join('');
      if (keepId && list.some(function (t) { return t.id === keepId; })) selectEl.value = keepId;
      if (countEl) countEl.textContent = list.length + ' de ' + self.trabajadores.length + ' trabajadores';
    };
    // Verificación contra la base de datos por cédula exacta:
    // activo → selecciona y muestra fechas; retirado → informa y bloquea;
    // no existe → informa y bloquea.
    var statusEl = backdrop.querySelector('#va-cedula-status');
    var cedulaState = { status: 'idle', personal: null };
    var digitsOnly = function (s) { return String(s || '').replace(/\D/g, ''); };
    var normEstado = function (e) {
      var s = String(e || '').toLowerCase();
      if (s === 'a' || s === 'act' || s === 'activo') return 'activo';
      if (s === 'r' || s === 'ret' || s === 'retirado') return 'retirado';
      return s || 'sin estado';
    };
    var boxBase = 'border-radius:0.5rem;padding:0.55rem 0.8rem;font-size:0.76rem;margin-top:0.25rem;';
    var paintCedulaStatus = function () {
      if (!statusEl) return;
      var st = cedulaState.status;
      var p = cedulaState.personal;
      if (st === 'ok-activo' && p) {
        statusEl.innerHTML = '<div style="background:#e6f4ea;border:1px solid #a3d9b1;color:#146c2e;' + boxBase + '">' +
          '<i class="fas fa-circle-check"></i> <strong>Activo:</strong> ' + self._escHtml((p.nombres || '') + ' ' + (p.apellidos || '')) +
          (p.cargo ? ' · ' + self._escHtml(p.cargo) : '') + '. Puedes continuar con las fechas.</div>';
      } else if (st === 'retirado' && p) {
        statusEl.innerHTML = '<div style="background:#fdecea;border:1px solid #f5c2c7;color:#842029;' + boxBase + '">' +
          '<i class="fas fa-ban"></i> <strong>Trabajador retirado:</strong> ' + self._escHtml((p.nombres || '') + ' ' + (p.apellidos || '')) +
          ' (CC ' + self._escHtml(p.cedula || '') + '). No se puede solicitar vacaciones.</div>';
      } else if (st === 'otro' && p) {
        statusEl.innerHTML = '<div style="background:#fff8e1;border:1px solid #ffe69b;color:#856404;' + boxBase + '">' +
          '<i class="fas fa-info-circle"></i> Estado en base: <strong>' + self._escHtml(p.estado || '') + '</strong> — ' +
          self._escHtml((p.nombres || '') + ' ' + (p.apellidos || '')) + '.</div>';
      } else if (st === 'noexiste') {
        statusEl.innerHTML = '<div style="background:#e9ecef;border:1px solid #ced4da;color:#495057;' + boxBase + '">' +
          '<i class="fas fa-user-xmark"></i> No existe un trabajador con esa cédula en esta empresa.</div>';
      } else {
        statusEl.innerHTML = '';
      }
    };
    var lookupTimer = null;
    var lookupCedulaDb = async function (raw) {
      var digits = digitsOnly(raw);
      if (!digits || digits.length < 4) {
        if (cedulaState.status !== 'idle' || cedulaState.personal) { cedulaState = { status: 'idle', personal: null }; paintCedulaStatus(); }
        return;
      }
      try {
        var rq = await window.electronAPI.ghGetPersonalByCedula({ companyName: self.companyName, cedula: raw.trim() });
        var p = (rq && rq.success && rq.data) ? rq.data.personal : null;
        if (!p && digits !== raw.trim()) {
          var rq2 = await window.electronAPI.ghGetPersonalByCedula({ companyName: self.companyName, cedula: digits });
          p = (rq2 && rq2.success && rq2.data) ? rq2.data.personal : null;
        }
        if (!p) {
          cedulaState = { status: 'noexiste', personal: null };
        } else {
          var est = normEstado(p.estado);
          if (est === 'activo') {
            cedulaState = { status: 'ok-activo', personal: p };
            var opt = selectEl.querySelector('option[value="' + p.id + '"]');
            if (!opt) { paintOptions(''); opt = selectEl.querySelector('option[value="' + p.id + '"]'); }
            if (opt) {
              selectEl.value = p.id;
              self._renderRecomendacion(backdrop, p.id);
              syncDias();
            }
          } else if (est === 'retirado') {
            cedulaState = { status: 'retirado', personal: p };
            selectEl.value = '';
            self._renderRecomendacion(backdrop, '');
          } else {
            cedulaState = { status: 'otro', personal: p };
            var opt2 = selectEl.querySelector('option[value="' + p.id + '"]');
            if (opt2) {
              selectEl.value = p.id;
              self._renderRecomendacion(backdrop, p.id);
              syncDias();
            }
          }
        }
      } catch (e) { cedulaState = { status: 'idle', personal: null }; }
      paintCedulaStatus();
    };
    searchEl.oninput = function () {
      paintOptions(selectEl.value);
      if (lookupTimer) clearTimeout(lookupTimer);
      var val = searchEl.value;
      lookupTimer = setTimeout(function () { lookupCedulaDb(val); }, 400);
    };
    selectEl.onchange = function () {
      // Selección manual desde la lista (ya viene de la BD): refleja su estado
      var t = self._trabajadorById[selectEl.value];
      if (t) {
        var est = normEstado(t.estado);
        if (est === 'activo') cedulaState = { status: 'ok-activo', personal: t };
        else if (est === 'retirado') cedulaState = { status: 'retirado', personal: t };
        else cedulaState = { status: 'otro', personal: t };
      } else {
        cedulaState = { status: 'idle', personal: null };
      }
      paintCedulaStatus();
      self._renderRecomendacion(backdrop, selectEl.value);
      syncDias();
    };
    paintOptions(null);

    // Pre-selección desde la tabla Personal: deja todo listo con fechas sugeridas
    (function () {
      var pre = presetTrabajadorId && self._trabajadorById[presetTrabajadorId];
      if (!pre) return;
      if (pre.cedula) searchEl.value = pre.cedula;
      paintOptions(pre.id);
      selectEl.value = pre.id;
      self._renderRecomendacion(backdrop, pre.id);
      syncDias();
      var est = normEstado(pre.estado);
      cedulaState = { status: est === 'activo' ? 'ok-activo' : (est === 'retirado' ? 'retirado' : 'otro'), personal: pre };
      paintCedulaStatus();
    })();

    backdrop.querySelector('[data-action="submit"]').onclick = function () {
      var form = backdrop.querySelector('#va-solicitar-form');
      if (!form.checkValidity()) { form.reportValidity(); return; }
      // El trabajador debe existir en la BD y estar activo (verificado por
      // cédula contra la base o por selección manual de la lista)
      var selT = self._trabajadorById[form.trabajadorId.value];
      if (!selT) { self._toast.warning('Selecciona un trabajador válido de la lista.'); return; }
      if (normEstado(selT.estado) === 'retirado') { self._toast.warning('Trabajador retirado: no se puede solicitar vacaciones.'); return; }
      var d = self._contarHabiles(form.fechaInicio.value, form.fechaFin.value);
      if (!d || d <= 0) {
        self._toast.error('La fecha de fin debe ser posterior a la fecha de inicio');
        return;
      }
      var data = {
        trabajadorId:      form.trabajadorId.value,
        fechaSolicitud:    self._inputDateToIso(form.fechaSolicitud.value) || new Date().toISOString(),
        fechaInicio:       self._inputDateToIso(form.fechaInicio.value),
        fechaFin:          self._inputDateToIso(form.fechaFin.value),
        diasSolicitados:   parseInt(form.dias.value, 10) || d,
        notas:             form.notas.value || null,
        estado:            'solicitada',
        notificarCliente:  0
      };
      close();
      self._create(data);
    };
  }

  async _create(data) {
    try {
      var r = await window.electronAPI.ghCreateVacacion({ companyName: this.companyName, data: data });
      if (r && r.success) {
        this._toast.success('Solicitud enviada');
        await this._load();
        this._renderAll();
      } else {
        this._toast.error('Error', ((r && r.error && r.error.message) || 'desconocido'));
      }
    } catch (e) { this._toast.error('Error', e.message); }
  }

  async _cambiarEstado(id, estado) {
    try {
      var r = await window.electronAPI.ghCambiarEstadoVacacion({ vacacionId: id, estado: estado });
      if (r && r.success) {
        this._toast.success('Vacación ' + estado);
        await this._load();
        this._renderAll();
      } else {
        this._toast.error('Error', ((r && r.error && r.error.message) || 'desconocido'));
      }
    } catch (e) { this._toast.error('Error', e.message); }
  }

  async _programar(id) {
    // Programar = marcar como "disfrutada" (salió en esas fechas). Alternativa:
    // cambiar a 'programada' si se quiere representar como paso previo a disfrutada.
    var self = this;
    var ok = window.confirm('¿Marcar esta vacación como programada (lista para el período de inicio)?');
    if (!ok) return;
    try {
      var r = await window.electronAPI.ghCambiarEstadoVacacion({ vacacionId: id, estado: 'programada' });
      if (r && r.success) {
        self._toast.success('Vacación programada');
        await self._load();
        self._renderAll();
      } else {
        self._toast.error('Error', ((r && r.error && r.error.message) || 'desconocido'));
      }
    } catch (e) { self._toast.error('Error', e.message); }
  }

  async _notificarCliente(id) {
    try {
      var r = await window.electronAPI.ghUpdateVacacion({ vacacionId: id, updates: { clienteNotificado: 1 } });
      if (r && r.success) {
        this._toast.success('Cliente notificado');
        await this._load();
        this._renderAll();
      } else {
        this._toast.error('Error', ((r && r.error && r.error.message) || 'desconocido'));
      }
    } catch (e) { this._toast.error('Error', e.message); }
  }

  _exportListadoMensual() {
    // Generar CSV del mes actual / próximo con vacaciones aprobadas y pendientes
    var rows = [['TRABAJADOR', 'CARGO', 'SEDE', 'FECHA INICIO', 'FECHA FIN', 'DIAS', 'ESTADO', 'CLIENTE NOTIFICADO']];
    var self = this;
    this.items.forEach(function (v) {
      var t = self._trabajadorById[v.trabajadorId] || {};
      var s = self._sedeById[t.sedeId] || {};
      rows.push([
        ((t.nombres || '') + ' ' + (t.apellidos || '')).trim(),
        t.cargo || '',
        s.nombre || '',
        self._isoToInputDate(v.fechaInicio),
        self._isoToInputDate(v.fechaFin),
        v.diasSolicitados || '',
        v.estado,
        v.clienteNotificado ? 'Si' : 'No'
      ]);
    });
    var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url;
    a.download = 'listado-vacaciones-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    this._toast.success('Listado exportado');
  }

  destroy() { /* noop */ }
}

window.VacacionesComponent = VacacionesComponent;
