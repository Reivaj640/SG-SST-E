// modules/gestion-humana/afiliaciones/index.js
// 📦710 · Afiliaciones (v0.2.0) — UI completa
//
// Vista de solo lectura: estado 4/4 (EPS + Pensión + ARL + Caja) por trabajador.
// KPIs (5): Completos (4/4), Sin EPS, Sin Pensión, Sin ARL, Sin Caja
// Tabs: Todos / Incompletos
// Búsqueda por nombre/cédula
// Backend: usa ghListPersonal (ya existente). Los datos de afiliación están en base_personal.

class AfiliacionesComponent {
  constructor(container, companyName, moduleName, subName, onBack) {
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.subName = subName;
    this.onBack = onBack;
    this.personales = [];
    this.tab = 'todos';
    this.search = '';
    this.loading = true;
  }

  _fmt(n) {
    if (n == null) return '—';
    return new Intl.NumberFormat('es-CO').format(n);
  }

  _toast() {
    return (window.parent && window.parent.KAIRToast) ? window.parent.KAIRToast : window.KAIRToast;
  }
  _confirmDialog() {
    return (window.parent && window.parent.KairConfirm) ? window.parent.KairConfirm : window.KairConfirm;
  }
  _showToast(msg, type) {
    var t = this._toast();
    if (t) t.show(msg, type || 'info');
  }

  async _load() {
    if (!window.electronAPI || !this.companyName) { this.loading = false; return; }
    try {
      var r = await window.electronAPI.ghListPersonal({ companyName: this.companyName });
      this.personales = r && r.success ? (r.data.personales || []) : [];
    } catch (e) {
      this._showToast('Error cargando: ' + e.message, 'error');
    }
    this.loading = false;
  }

  _kpis() {
    var p = this.personales;
    return {
      completos:  p.filter(function (t) { return t.eps && t.pension && t.arl && t.cajaCompensacion; }).length,
      sinEps:     p.filter(function (t) { return !t.eps; }).length,
      sinPension: p.filter(function (t) { return !t.pension; }).length,
      sinArl:     p.filter(function (t) { return !t.arl; }).length,
      sinCaja:    p.filter(function (t) { return !t.cajaCompensacion; }).length
    };
  }

  _filtered() {
    var self = this;
    var s = this.search.toLowerCase().trim();
    return this.personales.filter(function (t) {
      var incompleto = !t.eps || !t.pension || !t.arl || !t.cajaCompensacion;
      if (self.tab === 'incompletos' && !incompleto) return false;
      if (!s) return true;
      return (t.nombres && t.nombres.toLowerCase().indexOf(s) >= 0) ||
             (t.apellidos && t.apellidos.toLowerCase().indexOf(s) >= 0) ||
             (t.cedula && t.cedula.indexOf(s) >= 0);
    });
  }

  render() {
    var self = this;
    this.container.innerHTML = '';
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding:0; height:100%; overflow-y:auto; background:#f8f9fa;';

    if (this.loading) {
      wrapper.innerHTML = '<div style="padding:3rem; text-align:center; color:#5a6378;"><i class="fas fa-spinner fa-spin"></i> Cargando afiliaciones…</div>';
      this.container.appendChild(wrapper);
      this._load().then(function () { self.render(); });
      return;
    }

    var k = this._kpis();
    wrapper.appendChild(this._renderKpiStrip(k));

    // Header
    var head = document.createElement('div');
    head.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem 1.5rem; background:white; border-bottom:1px solid #e9ecef; flex-wrap:wrap;';
    head.innerHTML =
      '<div>' +
        '<h2 style="margin:0; font-size:1.05rem; color:#1a1a2e;">Afiliaciones de Seguridad Social</h2>' +
        '<p style="margin:0.125rem 0 0; font-size:0.75rem; color:#5a6378;">EPS, Fondo de Pensión, ARL y Caja de Compensación</p>' +
      '</div>' +
      '<div style="display:flex; gap:0.4rem;">' +
        '<button data-tab="todos" style="background:' + (this.tab === 'todos' ? '#174ea6' : 'white') + '; color:' + (this.tab === 'todos' ? 'white' : '#174ea6') + '; border:1px solid #174ea6; padding:0.4rem 0.75rem; border-radius:0.4rem; cursor:pointer; font-size:0.8rem; font-weight:500;">Todos (' + this.personales.length + ')</button>' +
        '<button data-tab="incompletos" style="background:' + (this.tab === 'incompletos' ? '#174ea6' : 'white') + '; color:' + (this.tab === 'incompletos' ? 'white' : '#174ea6') + '; border:1px solid #174ea6; padding:0.4rem 0.75rem; border-radius:0.4rem; cursor:pointer; font-size:0.8rem; font-weight:500;">Incompletos (' + (k.completos === this.personales.length ? 0 : this.personales.length - k.completos) + ')</button>' +
      '</div>';
    wrapper.appendChild(head);

    // Búsqueda
    var searchBar = document.createElement('div');
    searchBar.style.cssText = 'padding:0.75rem 1.5rem; background:white; border-bottom:1px solid #e9ecef;';
    searchBar.innerHTML =
      '<div style="position:relative; max-width:400px;">' +
        '<i class="fas fa-search" style="position:absolute; left:0.625rem; top:50%; transform:translateY(-50%); color:#9ca3af; font-size:0.85rem;"></i>' +
        '<input id="afil-search" type="text" placeholder="Buscar trabajador…" value="' + this._escAttr(this.search) + '" style="width:100%; padding:0.5rem 0.625rem 0.5rem 2rem; border:1px solid #dee2e6; border-radius:0.375rem; font-size:0.8125rem; box-sizing:border-box;">' +
      '</div>';
    wrapper.appendChild(searchBar);

    // Tabla
    wrapper.appendChild(this._renderTable());

    this.container.appendChild(wrapper);

    // Wire actions
    var self2 = this;
    this.container.querySelectorAll('button[data-tab]').forEach(function (b) {
      b.onclick = function () { self2.tab = b.getAttribute('data-tab'); self2.render(); };
    });
    var searchInput = document.getElementById('afil-search');
    if (searchInput) {
      var t = null;
      searchInput.oninput = function (e) {
        clearTimeout(t);
        t = setTimeout(function () { self2.search = e.target.value; self2.render(); }, 250);
      };
    }
  }

  _escAttr(s) { return String(s || '').replace(/"/g, '&quot;'); }

  _renderKpiStrip(k) {
    var bar = document.createElement('div');
    bar.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:0; background:white; border-bottom:1px solid #e9ecef;';
    var items = [
      { value: k.completos,  label: 'COMPLETOS (4/4)', color: '#28a745', icon: 'fa-check-circle' },
      { value: k.sinEps,     label: 'SIN EPS',          color: '#be123c', icon: 'fa-heart' },
      { value: k.sinPension, label: 'SIN PENSIÓN',      color: '#ffc107', icon: 'fa-chart-line' },
      { value: k.sinArl,     label: 'SIN ARL',          color: '#be123c', icon: 'fa-shield-halved' },
      { value: k.sinCaja,    label: 'SIN CAJA',         color: '#ffc107', icon: 'fa-house' }
    ];
    items.forEach(function (i, idx) {
      bar.innerHTML +=
        '<div style="padding:1rem 1.25rem; display:flex; align-items:center; gap:0.625rem; ' + (idx > 0 ? 'border-left:1px solid #e9ecef;' : '') + '">' +
          '<div style="width:36px; height:36px; border-radius:50%; background:' + i.color + '22; color:' + i.color + '; display:flex; align-items:center; justify-content:center;">' +
            '<i class="fas ' + i.icon + '"></i>' +
          '</div>' +
          '<div>' +
            '<div style="font-size:1.5rem; font-weight:700; color:#1a1a2e; line-height:1;">' + i.value + '</div>' +
            '<div style="font-size:0.65rem; color:#5a6378; letter-spacing:0.4px; margin-top:0.2rem;">' + i.label + '</div>' +
          '</div>' +
        '</div>';
    });
    return bar;
  }

  _renderTable() {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'padding:1rem 1.5rem;';
    var card = document.createElement('div');
    card.style.cssText = 'background:white; border:1px solid #e9ecef; border-radius:0.5rem; overflow:hidden;';
    var filtered = this._filtered();
    if (filtered.length === 0) {
      card.innerHTML = '<div style="padding:2rem; text-align:center; color:#5a6378;">No hay trabajadores que coincidan.</div>';
      wrap.appendChild(card);
      return wrap;
    }
    var table = document.createElement('table');
    table.style.cssText = 'width:100%; border-collapse:collapse; font-size:0.8125rem;';
    table.innerHTML =
      '<thead>' +
        '<tr style="background:#f8f9fa; color:#5a6378; text-transform:uppercase; font-size:0.65rem; letter-spacing:0.4px;">' +
          '<th style="text-align:left; padding:0.75rem 1rem;">Trabajador</th>' +
          '<th style="text-align:left; padding:0.75rem 1rem;">Cédula</th>' +
          '<th style="text-align:left; padding:0.75rem 1rem;">EPS</th>' +
          '<th style="text-align:left; padding:0.75rem 1rem;">Pensión</th>' +
          '<th style="text-align:left; padding:0.75rem 1rem;">ARL</th>' +
          '<th style="text-align:left; padding:0.75rem 1rem;">Caja Comp.</th>' +
          '<th style="text-align:center; padding:0.75rem 1rem;">Estado</th>' +
          '<th style="text-align:right; padding:0.75rem 1rem;">Acción</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody></tbody>';
    var tbody = table.querySelector('tbody');
    filtered.forEach(function (t) {
      var tr = document.createElement('tr');
      tr.style.cssText = 'border-top:1px solid #f1f3f5;';
      var has4 = !!(t.eps && t.pension && t.arl && t.cajaCompensacion);
      var tr2html = '';
      tr2html +=
        '<td style="padding:0.75rem 1rem;">' +
          '<div style="font-weight:600; color:#1a1a2e;">' + (t.nombres + ' ' + t.apellidos) + '</div>' +
          '<div style="font-size:0.7rem; color:#5a6378;">' + (t.cargo || '—') + '</div>' +
        '</td>' +
        '<td style="padding:0.75rem 1rem;">' + (t.cedula || '—') + '</td>' +
        '<td style="padding:0.75rem 1rem;"><div style="color:#1a1a2e;">' + (t.eps || '—') + '</div><div style="font-size:0.7rem; color:#5a6378;">' + (t.epsFecha || '') + '</div></td>' +
        '<td style="padding:0.75rem 1rem;"><div style="color:#1a1a2e;">' + (t.pension || '—') + '</div><div style="font-size:0.7rem; color:#5a6378;">' + (t.pensionFecha || '') + '</div></td>' +
        '<td style="padding:0.75rem 1rem;"><div style="color:#1a1a2e;">' + (t.arl || '—') + '</div><div style="font-size:0.7rem; color:#5a6378;">' + (t.arlFecha || '') + '</div></td>' +
        '<td style="padding:0.75rem 1rem;"><div style="color:#1a1a2e;">' + (t.cajaCompensacion || '—') + '</div><div style="font-size:0.7rem; color:#5a6378;">' + (t.cajaFecha || '') + '</div></td>' +
        '<td style="padding:0.75rem 1rem; text-align:center;">' +
          (has4
            ? '<span style="background:#d4edda; color:#155724; padding:0.2rem 0.625rem; border-radius:0.875rem; font-size:0.7rem; font-weight:600;">4/4</span>'
            : '<span style="background:#f8d7da; color:#721c24; padding:0.2rem 0.625rem; border-radius:0.875rem; font-size:0.7rem; font-weight:600;">Incompleto</span>') +
        '</td>' +
        '<td style="padding:0.75rem 1rem; text-align:right;">' +
          '<button data-editar="' + t.id + '" style="background:transparent; border:none; color:#5a6378; cursor:pointer; padding:0.25rem 0.4rem; font-size:0.9rem;" title="Ver detalle"><i class="fas fa-eye"></i></button>' +
        '</td>';
      tr.innerHTML = tr2html;
      tbody.appendChild(tr);
    });
    card.appendChild(table);
    wrap.appendChild(card);

    // Wire acciones (no implementamos edición inline — usamos shell-nav al detalle)
    var self3 = this;
    setTimeout(function () {
      self3.container.querySelectorAll('button[data-editar]').forEach(function (b) {
        b.onclick = function () { self3._showToast('Vista 360° del trabajador (próximamente)', 'info'); };
      });
    }, 0);
    return wrap;
  }

  destroy() { /* noop */ }
}

window.AfiliacionesComponent = AfiliacionesComponent;
