// modules/gestion-humana/dashboard/index.js
// 📦710 · Dashboard del módulo Gestión Humana (v0.2.0)
//
// KPIs (6): Total Personal, Activos, Incapacitados/Maternidad, En Vacaciones,
//           Permisos Activos, Contrataciones en proceso.
// Charts (3): Personal por Cargo, Nivel Educativo, Distribución por Estado.
//              (Sede/Género se omiten — no hay columnas sede_id ni genero en base_personal todavía).
// Quick access (4): Nueva Contratación, Vacaciones, Permisos, Comunicación.
//
// Backend: 5 read handlers + 4 nuevos de vacaciones/permisos ya están en el bridge.

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
  }

  _fmt(n) {
    if (n == null) return '—';
    return new Intl.NumberFormat('es-CO').format(n);
  }

  _toast() {
    return (window.parent && window.parent.KAIRToast) ? window.parent.KAIRToast : window.KAIRToast;
  }
  _showToast(msg, type) {
    var t = this._toast();
    if (t) t.show(msg, type || 'info');
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
    } catch (e) {
      console.error('[Dashboard] Error cargando datos:', e);
      this._showToast('Error cargando dashboard: ' + e.message, 'error');
    }
    this.loading = false;
  }

  _computeKpis() {
    var p = this.data.personales;
    var c = this.data.contrataciones;
    var v = this.data.vacaciones;
    var m = this.data.permisos;
    return {
      total: p.length,
      activos: p.filter(function (x) { return x.estado === 'activo'; }).length,
      incapacitados: p.filter(function (x) { return x.estado === 'incapacitado'; }).length,
      maternidad: p.filter(function (x) { return x.estado === 'maternidad'; }).length,
      enVacaciones: p.filter(function (x) { return x.estado === 'vacaciones'; }).length,
      permisosActivos: m.filter(function (x) { return x.estado === 'activo'; }).length,
      contratacionesEnProceso: c.filter(function (x) { return x.estado === 'en_proceso'; }).length
    };
  }

  _computeDistributions() {
    var p = this.data.personales;
    var porCargo = {};
    var porNivel = {};
    var porEstado = {};
    p.forEach(function (t) {
      var cargo = t.cargo || 'Sin cargo';
      var nivel = t.nivelEducativo || 'Sin dato';
      var estado = t.estado || 'activo';
      porCargo[cargo] = (porCargo[cargo] || 0) + 1;
      porNivel[nivel] = (porNivel[nivel] || 0) + 1;
      porEstado[estado] = (porEstado[estado] || 0) + 1;
    });
    return { porCargo: porCargo, porNivel: porNivel, porEstado: porEstado };
  }

  render() {
    var self = this;
    this.container.innerHTML = '';

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding:0; height:100%; overflow-y:auto; background:#f8f9fa;';

    if (this.loading) {
      wrapper.innerHTML = '<div style="padding:3rem; text-align:center; color:#5a6378;"><i class="fas fa-spinner fa-spin"></i> Cargando dashboard…</div>';
      this.container.appendChild(wrapper);
      this._load().then(function () { self.render(); });
      return;
    }

    var k = this._computeKpis();
    var d = this._computeDistributions();

    // ═══ KPIs strip (6) ═══
    wrapper.appendChild(this._renderKpiStrip(k));

    // ═══ Charts row 1: Cargo + Estado ═══
    var row1 = document.createElement('div');
    row1.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(380px, 1fr)); gap:1rem; padding:1rem 1.5rem 0;';
    row1.appendChild(this._renderBarChartCard('Personal por Cargo', 'Distribución por rol', d.porCargo, '#28a745', 'horizontal'));
    row1.appendChild(this._renderBarChartCard('Distribución por Estado', 'Estado actual', d.porEstado, '#174ea6', 'vertical'));
    wrapper.appendChild(row1);

    // ═══ Charts row 2: Nivel Educativo (pie) ═══
    var row2 = document.createElement('div');
    row2.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(380px, 1fr)); gap:1rem; padding:1rem 1.5rem 0;';
    row2.appendChild(this._renderPieCard('Nivel Educativo', 'Escolaridad del personal', d.porNivel));
    row2.appendChild(this._renderContratacionesCard());
    wrapper.appendChild(row2);

    // ═══ Quick access (4) ═══
    wrapper.appendChild(this._renderQuickAccess(k));

    this.container.appendChild(wrapper);
  }

  _renderKpiStrip(k) {
    var self = this;
    var bar = document.createElement('div');
    bar.style.cssText = 'background:white; border-bottom:1px solid #e9ecef; padding:1rem 1.5rem; display:flex; gap:0.875rem; flex-wrap:wrap; align-items:center;';
    var items = [
      { icon: 'fa-users',         color: '#174ea6', bg: '#e8f0fe', value: k.total,                    label: 'Total Personal' },
      { icon: 'fa-user-check',    color: '#28a745', bg: '#d4edda', value: k.activos,                 label: 'Activos', sub: k.total ? Math.round(k.activos/k.total*100) + '%' : null },
      { icon: 'fa-user-xmark',    color: '#dc3545', bg: '#f8d7da', value: k.incapacitados + k.maternidad, label: 'Incapacitados / Maternidad' },
      { icon: 'fa-umbrella-beach', color: '#fd7e14', bg: '#ffe5d0', value: k.enVacaciones,            label: 'En Vacaciones' },
      { icon: 'fa-file-medical',  color: '#6f42c1', bg: '#e7d6ff', value: k.permisosActivos,         label: 'Permisos Activos' },
      { icon: 'fa-user-plus',     color: '#0d9488', bg: '#ccfbf1', value: k.contratacionesEnProceso,  label: 'Contrataciones', sub: 'en proceso' }
    ];
    items.forEach(function (i) {
      bar.innerHTML +=
        '<div style="display:flex; align-items:center; gap:0.625rem;">' +
          '<div style="width:40px; height:40px; border-radius:0.5rem; background:' + i.bg + '; display:flex; align-items:center; justify-content:center;">' +
            '<i class="fas ' + i.icon + '" style="color:' + i.color + ';"></i>' +
          '</div>' +
          '<div>' +
            '<div style="font-size:1.25rem; font-weight:700; color:' + i.color + '; line-height:1;">' + self._fmt(i.value) + '</div>' +
            '<div style="font-size:0.65rem; text-transform:uppercase; color:#5a6378; letter-spacing:0.3px; margin-top:0.2rem;">' + i.label + (i.sub ? ' <span style="color:' + i.color + '; font-weight:600;">· ' + i.sub + '</span>' : '') + '</div>' +
          '</div>' +
        '</div>';
    });
    return bar;
  }

  _renderBarChartCard(title, subtitle, data, color, layout) {
    var entries = Object.entries(data).sort(function (a, b) { return b[1] - a[1]; });
    var max = entries.length ? Math.max.apply(null, entries.map(function (e) { return e[1]; })) : 1;

    var card = document.createElement('div');
    card.style.cssText = 'background:white; border:1px solid #e9ecef; border-radius:0.5rem; padding:1.25rem;';

    var head = document.createElement('div');
    head.style.cssText = 'margin-bottom:0.875rem;';
    head.innerHTML =
      '<h3 style="margin:0; font-size:0.95rem; color:#1a1a2e;">' + title + '</h3>' +
      '<p style="margin:0.125rem 0 0; font-size:0.7rem; color:#5a6378;">' + subtitle + '</p>';
    card.appendChild(head);

    if (entries.length === 0) {
      card.innerHTML += '<p style="color:#5a6378; font-size:0.8125rem; margin:1rem 0; text-align:center;">Sin datos aún.</p>';
      return card;
    }

    var body = document.createElement('div');
    body.style.cssText = 'display:flex; flex-direction:column; gap:0.5rem; max-height:280px; overflow-y:auto;';
    entries.forEach(function (e) {
      var name = e[0], val = e[1];
      var pct = (val / max) * 100;
      if (layout === 'vertical') {
        body.innerHTML +=
          '<div>' +
            '<div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#1a1a2e; margin-bottom:0.2rem;">' +
              '<span style="text-transform:capitalize;">' + name + '</span>' +
              '<strong>' + val + '</strong>' +
            '</div>' +
            '<div style="height:8px; background:#f1f3f5; border-radius:4px; overflow:hidden;">' +
              '<div style="height:100%; background:' + color + '; width:' + pct + '%; border-radius:4px;"></div>' +
            '</div>' +
          '</div>';
      } else {
        body.innerHTML +=
          '<div style="display:grid; grid-template-columns:120px 1fr 40px; gap:0.5rem; align-items:center;">' +
            '<div style="font-size:0.75rem; color:#1a1a2e; text-transform:capitalize; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + name + '</div>' +
            '<div style="height:18px; background:#f1f3f5; border-radius:4px; overflow:hidden;">' +
              '<div style="height:100%; background:' + color + '; width:' + pct + '%; border-radius:4px;"></div>' +
            '</div>' +
            '<div style="font-size:0.75rem; color:#1a1a2e; text-align:right;"><strong>' + val + '</strong></div>' +
          '</div>';
      }
    });
    card.appendChild(body);
    return card;
  }

  _renderPieCard(title, subtitle, data) {
    var entries = Object.entries(data).sort(function (a, b) { return b[1] - a[1]; });
    var total = entries.reduce(function (s, e) { return s + e[1]; }, 0);
    var palette = ['#174ea6', '#28a745', '#ffc107', '#dc3545', '#6c757d', '#5b2a86', '#17a2b8', '#fd7e14', '#0d9488'];

    var card = document.createElement('div');
    card.style.cssText = 'background:white; border:1px solid #e9ecef; border-radius:0.5rem; padding:1.25rem;';

    var head = document.createElement('div');
    head.style.cssText = 'margin-bottom:0.875rem;';
    head.innerHTML =
      '<h3 style="margin:0; font-size:0.95rem; color:#1a1a2e;">' + title + '</h3>' +
      '<p style="margin:0.125rem 0 0; font-size:0.7rem; color:#5a6378;">' + subtitle + '</p>';
    card.appendChild(head);

    if (entries.length === 0 || total === 0) {
      card.innerHTML += '<p style="color:#5a6378; font-size:0.8125rem; margin:1rem 0; text-align:center;">Sin datos aún.</p>';
      return card;
    }

    // SVG donut
    var size = 180;
    var cx = size / 2, cy = size / 2;
    var r = 70;
    var stroke = 22;
    var circumference = 2 * Math.PI * r;
    var offset = 0;
    var svgParts = [];
    entries.forEach(function (e, idx) {
      var val = e[1];
      var frac = val / total;
      var dash = frac * circumference;
      var color = palette[idx % palette.length];
      svgParts.push(
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" ' +
        'stroke-dasharray="' + dash + ' ' + (circumference - dash) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"></circle>'
      );
      offset += dash;
    });
    var svg = '<svg width="' + size + '" height="' + size + '" style="display:block; margin:0 auto;">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#f1f3f5" stroke-width="' + stroke + '"></circle>' +
      svgParts.join('') +
      '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="central" style="font-size:1.25rem; font-weight:700; fill:#1a1a2e;">' + total + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" style="font-size:0.65rem; fill:#5a6378;">PERSONAL</text>' +
      '</svg>';

    var legend = entries.map(function (e, idx) {
      var color = palette[idx % palette.length];
      var pct = Math.round((e[1] / total) * 100);
      return '<div style="display:flex; align-items:center; gap:0.5rem; font-size:0.75rem; color:#1a1a2e;">' +
        '<span style="width:10px; height:10px; border-radius:2px; background:' + color + '; flex-shrink:0;"></span>' +
        '<span style="text-transform:capitalize; flex:1;">' + e[0] + '</span>' +
        '<strong>' + e[1] + ' (' + pct + '%)</strong>' +
      '</div>';
    }).join('');

    var body = document.createElement('div');
    body.style.cssText = 'display:grid; grid-template-columns:auto 1fr; gap:1.25rem; align-items:center;';
    body.innerHTML = svg + '<div style="display:flex; flex-direction:column; gap:0.4rem;">' + legend + '</div>';
    card.appendChild(body);
    return card;
  }

  _renderContratacionesCard() {
    var c = this.data.contrataciones;
    var porPaso = {};
    c.forEach(function (x) { var p = x.pasoActual || 0; porPaso[p] = (porPaso[p] || 0) + 1; });

    var card = document.createElement('div');
    card.style.cssText = 'background:white; border:1px solid #e9ecef; border-radius:0.5rem; padding:1.25rem;';

    var head = document.createElement('div');
    head.style.cssText = 'margin-bottom:0.875rem;';
    head.innerHTML =
      '<h3 style="margin:0; font-size:0.95rem; color:#1a1a2e;">Pipeline de Contratación</h3>' +
      '<p style="margin:0.125rem 0 0; font-size:0.7rem; color:#5a6378;">Distribución por paso actual (1-6)</p>';
    card.appendChild(head);

    if (c.length === 0) {
      card.innerHTML += '<p style="color:#5a6378; font-size:0.8125rem; margin:1rem 0; text-align:center;">Sin contrataciones activas.</p>';
      return card;
    }

    var body = document.createElement('div');
    body.style.cssText = 'display:grid; grid-template-columns:repeat(6, 1fr); gap:0.4rem;';
    var labels = ['Memo', 'Contacto', 'Exámenes', 'Documentos', 'Afiliaciones', 'S400'];
    for (var i = 1; i <= 6; i++) {
      var val = porPaso[i] || 0;
      body.innerHTML +=
        '<div style="background:#f8f9fa; border-left:3px solid #0d9488; padding:0.5rem 0.5rem; border-radius:0.3rem;">' +
          '<div style="font-size:0.6rem; font-weight:700; color:#0d9488;">Paso ' + i + '</div>' +
          '<div style="font-size:0.95rem; font-weight:700; color:#1a1a2e;">' + val + '</div>' +
          '<div style="font-size:0.6rem; color:#5a6378;">' + labels[i-1] + '</div>' +
        '</div>';
    }
    card.appendChild(body);
    return card;
  }

  _renderQuickAccess(k) {
    var self = this;
    var section = document.createElement('div');
    section.style.cssText = 'padding:1.5rem;';
    section.innerHTML = '<h2 style="margin:0 0 0.875rem; font-size:0.75rem; text-transform:uppercase; color:#5a6378; letter-spacing:0.5px; font-weight:600;"><i class="fas fa-bolt"></i> Acceso rápido</h2>';

    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1rem;';

    var items = [
      { icon: 'fa-user-plus',     iconColor: '#0d9488', iconBg: '#ccfbf1', title: 'Nueva Contratación',  meta: k.contratacionesEnProceso + ' en proceso', color: '#0d9488', view: 'contratacion' },
      { icon: 'fa-umbrella-beach', iconColor: '#ea580c', iconBg: '#ffedd5', title: 'Vacaciones',         meta: k.enVacaciones + ' en vacaciones',         color: '#ea580c', view: 'vacaciones' },
      { icon: 'fa-file-medical',   iconColor: '#be123c', iconBg: '#ffe4e6', title: 'Permisos y Estados', meta: k.permisosActivos + ' activos',            color: '#be123c', view: 'permisos' },
      { icon: 'fa-bullhorn',       iconColor: '#a16207', iconBg: '#fef3c7', title: 'Comunicación',      meta: 'Anuncios y mensajes',                     color: '#a16207', view: 'comunicacion' }
    ];
    items.forEach(function (it) {
      var card = document.createElement('div');
      card.style.cssText = 'background:white; border:1px solid #e9ecef; border-radius:0.5rem; padding:1rem 1.25rem; display:flex; align-items:center; gap:0.875rem; cursor:pointer; transition:box-shadow 0.2s, transform 0.2s;';
      card.onmouseenter = function () { card.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)'; card.style.transform = 'translateY(-2px)'; };
      card.onmouseleave = function () { card.style.boxShadow = ''; card.style.transform = ''; };
      card.onclick = function () {
        // Disparar evento custom que el shell captura
        window.dispatchEvent(new CustomEvent('gh-shell-navigate', { detail: { view: it.view } }));
      };
      card.innerHTML =
        '<div style="width:40px; height:40px; border-radius:0.5rem; background:' + it.iconBg + '; display:flex; align-items:center; justify-content:center;">' +
          '<i class="fas ' + it.icon + '" style="color:' + it.iconColor + ';"></i>' +
        '</div>' +
        '<div style="flex:1; min-width:0;">' +
          '<div style="font-size:0.9rem; font-weight:600; color:#1a1a2e;">' + it.title + '</div>' +
          '<div style="font-size:0.7rem; color:#5a6378;">' + it.meta + '</div>' +
        '</div>' +
        '<i class="fas fa-arrow-right" style="color:#5a6378; font-size:0.875rem;"></i>';
      grid.appendChild(card);
    });
    section.appendChild(grid);
    return section;
  }

  destroy() {
    // Sin subscripciones ni listeners globales que limpiar
  }
}

window.DashboardComponent = DashboardComponent;
