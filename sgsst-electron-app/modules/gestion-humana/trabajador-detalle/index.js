// modules/gestion-humana/trabajador-detalle/index.js
// 📦710 · Trabajador Detalle (v0.2.0) — vista 360° del trabajador
//
// Muestra: datos personales, estado actual, vacaciones, permisos, afiliaciones,
//          documentos firmados, S400.
// Backend: ghGetPersonal + ghListVacaciones + ghListPermisos + ghListDocumentos

class TrabajadorDetalleComponent {
  constructor(container, companyName, moduleName, subName, onBack, personalId) {
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.subName = subName;
    this.onBack = onBack;
    this.personalId = personalId;
    this.personal = null;
    this.vacaciones = [];
    this.permisos = [];
    this.documentos = [];
    this.loading = true;
  }

  _fmt(n) {
    if (n == null) return '—';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
  }
  _fmtInt(n) {
    if (n == null) return '—';
    return new Intl.NumberFormat('es-CO').format(n);
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

  _estadoColor(estado) {
    return { 'activo': '#28a745', 'incapacitado': '#dc3545', 'vacaciones': '#fd7e14', 'permiso': '#6f42c1', 'maternidad': '#17a2b8', 'paternidad': '#17a2b8', 'luto': '#6c757d', 'retirado': '#868e96' }[estado] || '#5a6378';
  }

  async _load() {
    if (!window.electronAPI || !this.companyName || !this.personalId) { this.loading = false; return; }
    try {
      var results = await Promise.all([
        window.electronAPI.ghGetPersonal({ personalId: this.personalId }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListVacaciones({ companyName: this.companyName, trabajadorId: this.personalId }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListPermisos({ companyName: this.companyName, trabajadorId: this.personalId }).catch(function () { return { success: false }; }),
        window.electronAPI.ghListDocumentos({ companyName: this.companyName, trabajadorId: this.personalId }).catch(function () { return { success: false }; })
      ]);
      this.personal    = results[0].success ? results[0].data.personal : null;
      this.vacaciones  = results[1].success ? (results[1].data.vacaciones || []) : [];
      this.permisos    = results[2].success ? (results[2].data.permisos || []) : [];
      this.documentos  = results[3].success ? (results[3].data.documentos || []) : [];
    } catch (e) {
      this._toast.error('Error', e.message);
    }
    this.loading = false;
  }

  render() {
    var self = this;
    this.container.innerHTML = '';
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding:0; height:100%; overflow-y:auto; background:#f8f9fa;';

    if (this.loading) {
      wrapper.innerHTML = '<div style="padding:3rem; text-align:center; color:#5a6378;"><i class="fas fa-spinner fa-spin"></i> Cargando…</div>';
      this.container.appendChild(wrapper);
      this._load().then(function () { self.render(); });
      return;
    }

    if (!this.personal) {
      wrapper.innerHTML = '<div style="padding:3rem; text-align:center; color:#dc3545;"><i class="fas fa-exclamation-circle"></i> Trabajador no encontrado.</div>';
      this.container.appendChild(wrapper);
      return;
    }

    // Back button
    var back = document.createElement('div');
    back.style.cssText = 'padding:0.75rem 1.5rem; background:white; border-bottom:1px solid #e9ecef;';
    back.innerHTML = '<button id="td-back" style="background:#f8f9fa; border:1px solid #dee2e6; padding:0.4rem 0.75rem; border-radius:0.375rem; cursor:pointer; color:#5a6378; font-size:0.8125rem; display:inline-flex; align-items:center; gap:0.4rem;"><i class="fas fa-arrow-left"></i> Volver a Base de Personal</button>';
    wrapper.appendChild(back);

    // Hero
    wrapper.appendChild(this._renderHero());

    // Secciones
    var content = document.createElement('div');
    content.style.cssText = 'padding:1rem 1.5rem 1.5rem; display:grid; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); gap:1rem;';
    content.appendChild(this._renderDatosPersonales());
    content.appendChild(this._renderDatosLaborales());
    content.appendChild(this._renderAfiliaciones());
    content.appendChild(this._renderVacacionesRecientes());
    content.appendChild(this._renderPermisosRecientes());
    content.appendChild(this._renderDocumentosRecientes());
    wrapper.appendChild(content);

    this.container.appendChild(wrapper);

    var btnBack = document.getElementById('td-back');
    if (btnBack) btnBack.onclick = function () { if (self.onBack) self.onBack(); };
  }

  _renderHero() {
    var p = this.personal;
    var initials = ((p.nombres || '?').charAt(0) + (p.apellidos || '?').charAt(0)).toUpperCase();
    var color = this._estadoColor(p.estado);
    var hero = document.createElement('div');
    hero.style.cssText = 'background:linear-gradient(135deg, #174ea6 0%, #2d5dc7 100%); color:white; padding:1.5rem; display:flex; align-items:center; gap:1.25rem; flex-wrap:wrap;';
    hero.innerHTML =
      '<div style="width:72px; height:72px; border-radius:50%; background:white; color:#174ea6; display:flex; align-items:center; justify-content:center; font-size:1.5rem; font-weight:700; flex-shrink:0;">' + initials + '</div>' +
      '<div style="flex:1; min-width:200px;">' +
        '<h1 style="margin:0; font-size:1.4rem; font-weight:600;">' + p.nombres + ' ' + p.apellidos + '</h1>' +
        '<div style="display:flex; align-items:center; gap:0.875rem; margin-top:0.375rem; font-size:0.875rem; opacity:0.95; flex-wrap:wrap;">' +
          '<span><i class="fas fa-id-card"></i> CC ' + p.cedula + '</span>' +
          (p.cargo ? '<span><i class="fas fa-briefcase"></i> ' + p.cargo + '</span>' : '') +
          (p.sedeId ? '<span><i class="fas fa-building"></i> Sede ' + p.sedeId + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div style="display:flex; gap:0.625rem; align-items:center;">' +
        '<span style="background:' + color + '; color:white; padding:0.4rem 0.875rem; border-radius:1rem; font-size:0.8125rem; font-weight:600; text-transform:capitalize;">' + (p.estado || '—') + '</span>' +
        (p.activoS400 ? '<span style="background:#28a745; color:white; padding:0.4rem 0.875rem; border-radius:1rem; font-size:0.8125rem; font-weight:600;"><i class="fas fa-check"></i> S400</span>' : '<span style="background:rgba(255,255,255,0.2); color:white; padding:0.4rem 0.875rem; border-radius:1rem; font-size:0.8125rem; font-weight:600;">Sin S400</span>') +
      '</div>';
    return hero;
  }

  _sectionCard(title, icon, body) {
    var card = document.createElement('div');
    card.style.cssText = 'background:white; border:1px solid #e9ecef; border-radius:0.5rem; padding:1rem 1.125rem;';
    card.innerHTML =
      '<div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.625rem; padding-bottom:0.5rem; border-bottom:1px solid #f1f3f5;">' +
        '<i class="fas ' + icon + '" style="color:#174ea6;"></i>' +
        '<h3 style="margin:0; font-size:0.95rem; color:#1a1a2e; font-weight:600;">' + title + '</h3>' +
      '</div>' +
      '<div>' + body + '</div>';
    return card;
  }

  _row(label, value) {
    return '<div style="display:flex; justify-content:space-between; padding:0.3rem 0; font-size:0.8125rem; border-bottom:1px solid #f8f9fa;"><span style="color:#5a6378;">' + label + '</span><span style="color:#1a1a2e; font-weight:500; text-align:right; max-width:60%;">' + (value || '—') + '</span></div>';
  }

  _renderDatosPersonales() {
    var p = this.personal;
    var body = '';
    body += this._row('Tipo documento', p.tipoDocumento);
    body += this._row('Cédula', p.cedula);
    body += this._row('Fecha nacimiento', p.fechaNacimiento);
    body += this._row('Lugar nacimiento', p.lugarNacimiento);
    body += this._row('Estado civil', p.estadoCivil);
    body += this._row('Nivel educativo', p.nivelEducativo);
    body += this._row('Email', p.email);
    body += this._row('Teléfono', p.telefono);
    body += this._row('Celular', p.celular);
    return this._sectionCard('Datos Personales', 'fa-user', body);
  }

  _renderDatosLaborales() {
    var p = this.personal;
    var body = '';
    body += this._row('Cargo', p.cargo);
    body += this._row('Tipo contrato', p.tipoContrato);
    body += this._row('Salario', p.salario ? this._fmt(p.salario) : null);
    body += this._row('Fecha ingreso', p.fechaIngreso);
    body += this._row('Fecha retiro', p.fechaRetiro);
    body += this._row('Empresa usuaria', p.empresaUsuaria);
    body += this._row('Banco', p.banco);
    body += this._row('Número cuenta', p.numeroCuenta);
    body += this._row('Activo S400', p.activoS400 ? 'Sí' : 'No');
    body += this._row('Fecha activación S400', p.fechaActivacionS400);
    return this._sectionCard('Datos Laborales', 'fa-briefcase', body);
  }

  _renderAfiliaciones() {
    var p = this.personal;
    var body = '';
    body += this._afilRow('EPS', p.eps, p.epsFecha);
    body += this._afilRow('Pensión', p.pension, p.pensionFecha);
    body += this._afilRow('ARL', p.arl, p.arlFecha);
    body += this._afilRow('Caja', p.cajaCompensacion, p.cajaFecha);
    var completos = p.eps && p.pension && p.arl && p.cajaCompensacion;
    body += '<div style="margin-top:0.625rem; padding:0.5rem; background:' + (completos ? '#d4edda' : '#f8d7da') + '; color:' + (completos ? '#155724' : '#721c24') + '; border-radius:0.4rem; font-size:0.75rem; font-weight:600; text-align:center;">' +
      '<i class="fas fa-' + (completos ? 'check-circle' : 'exclamation-triangle') + '"></i> ' + (completos ? 'Afiliaciones completas (4/4)' : 'Afiliaciones incompletas') +
      '</div>';
    return this._sectionCard('Seguridad Social', 'fa-shield-halved', body);
  }

  _afilRow(label, nombre, fecha) {
    var ok = !!nombre;
    return '<div style="display:flex; justify-content:space-between; align-items:center; padding:0.3rem 0; font-size:0.8125rem; border-bottom:1px solid #f8f9fa;">' +
      '<span style="color:#5a6378; flex:1;">' + label + '</span>' +
      '<span style="flex:1; text-align:right; color:' + (ok ? '#1a1a2e' : '#dc3545') + '; font-weight:500;">' + (nombre || '—') + '</span>' +
      '<span style="color:#9ca3af; font-size:0.7rem; min-width:80px; text-align:right;">' + (fecha || '') + '</span>' +
    '</div>';
  }

  _renderVacacionesRecientes() {
    var items = this.vacaciones.slice(0, 5);
    var body = '';
    if (items.length === 0) {
      body = '<p style="color:#9ca3af; font-size:0.8125rem; text-align:center; margin:0.5rem 0;">Sin vacaciones registradas</p>';
    } else {
      items.forEach(function (v) {
        var color = { 'solicitada': '#ffc107', 'aprobada': '#28a745', 'rechazada': '#dc3545', 'disfrutada': '#0d9488' }[v.estado] || '#5a6378';
        body += '<div style="padding:0.4rem 0; border-bottom:1px solid #f8f9fa; display:flex; justify-content:space-between; align-items:center; font-size:0.8125rem;">' +
          '<span style="color:#1a1a2e;">' + (v.fechaInicio || '—') + ' → ' + (v.fechaFin || '—') + '</span>' +
          '<span style="color:' + color + '; font-weight:600; text-transform:capitalize; font-size:0.7rem;">' + v.estado + '</span>' +
        '</div>';
      });
    }
    return this._sectionCard('Vacaciones (últimas ' + items.length + ')', 'fa-umbrella-beach', body);
  }

  _renderPermisosRecientes() {
    var items = this.permisos.slice(0, 5);
    var body = '';
    if (items.length === 0) {
      body = '<p style="color:#9ca3af; font-size:0.8125rem; text-align:center; margin:0.5rem 0;">Sin permisos registrados</p>';
    } else {
      items.forEach(function (p) {
        var color = { 'activo': '#28a745', 'finalizado': '#6c757d', 'prorrogado': '#fd7e14' }[p.estado] || '#5a6378';
        body += '<div style="padding:0.4rem 0; border-bottom:1px solid #f8f9fa; font-size:0.8125rem;">' +
          '<div style="display:flex; justify-content:space-between;"><span style="color:#1a1a2e; text-transform:capitalize;">' + (p.tipo || '—').replace(/_/g, ' ') + '</span><span style="color:' + color + '; font-weight:600; text-transform:capitalize; font-size:0.7rem;">' + p.estado + '</span></div>' +
          '<div style="font-size:0.7rem; color:#5a6378;">' + (p.fechaInicio || '—') + (p.fechaFin ? ' → ' + p.fechaFin : '') + '</div>' +
        '</div>';
      });
    }
    return this._sectionCard('Permisos (últimos ' + items.length + ')', 'fa-file-medical', body);
  }

  _renderDocumentosRecientes() {
    var items = this.documentos.slice(0, 5);
    var body = '';
    if (items.length === 0) {
      body = '<p style="color:#9ca3af; font-size:0.8125rem; text-align:center; margin:0.5rem 0;">Sin documentos generados</p>';
    } else {
      items.forEach(function (d) {
        var color = d.estado === 'firmado' ? '#28a745' : d.estado === 'anulado' ? '#6c757d' : '#fd7e14';
        body += '<div style="padding:0.4rem 0; border-bottom:1px solid #f8f9fa; font-size:0.8125rem;">' +
          '<div style="display:flex; justify-content:space-between;"><span style="color:#1a1a2e;">' + (d.titulo || d.tipo) + '</span><span style="color:' + color + '; font-weight:600; text-transform:capitalize; font-size:0.7rem;">' + d.estado + '</span></div>' +
          '<div style="font-size:0.7rem; color:#5a6378;">' + (d.createdAt ? d.createdAt.split('T')[0] : '—') + '</div>' +
        '</div>';
      });
    }
    return this._sectionCard('Documentos (últimos ' + items.length + ')', 'fa-file-signature', body);
  }

  destroy() { /* noop */ }
}

window.TrabajadorDetalleComponent = TrabajadorDetalleComponent;
