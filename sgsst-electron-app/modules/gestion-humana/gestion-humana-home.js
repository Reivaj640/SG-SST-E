// modules/gestion-humana/gestion-humana-home.js
// 📦713 · Módulo "Gestión Humana" — Shell con HTML+CSS+JS separados (v0.2.0)
//
// Layout: sidebar 8 items (Resumen/Dashboard/Personal/Contratación/Vacaciones/
//          Permisos/Afiliaciones/Documentos/Comunicación) + header con NIT/Bell
//          + footer. CSS del shell en `gestion-humana-home.css` (link en index.html).
// HTML del shell en `gestion-humana-home.html` (cargado via fetch en runtime).
//
// 8 vistas (placeholders "Próximamente" para las que faltan; las reales para
// Base Personal y Contratación).

var GESTION_HUMANA_NAV = [
  { id: 'home',          label: 'Resumen',          shortLabel: 'Resumen',     icon: 'fa-grip',             group: 'Principal' },
  { id: 'dashboard',     label: 'Dashboard',        shortLabel: 'Dashboard',   icon: 'fa-chart-line',       group: 'Gestión' },
  { id: 'personal',      label: 'Base de Personal', shortLabel: 'B. Pers.',    icon: 'fa-users',            group: 'Gestión' },
  { id: 'contratacion',  label: 'Contratación',     shortLabel: 'Contratación', icon: 'fa-user-plus',       group: 'Gestión' },
  { id: 'vacaciones',    label: 'Vacaciones',       shortLabel: 'Vacaciones',  icon: 'fa-umbrella-beach',   group: 'Gestión' },
  { id: 'permisos',      label: 'Permisos y Estados', shortLabel: 'P. y Est.', icon: 'fa-file-medical',     group: 'Gestión' },
  { id: 'afiliaciones',  label: 'Afiliaciones',     shortLabel: 'Afiliaciones', icon: 'fa-shield-halved',   group: 'Gestión' },
  { id: 'documentos',    label: 'Documentos y Firmas', shortLabel: 'Doc. y Fir.', icon: 'fa-file-signature', group: 'Documentos' },
  { id: 'firma-electronica', label: 'Firma electrónica', shortLabel: 'Firma electr.', icon: 'fa-file-signature', group: 'Documentos' },
  { id: 'comunicacion',  label: 'Comunicación',     shortLabel: 'Comunicación', icon: 'fa-bullhorn',        group: 'Colaboración' }
];

var GESTION_HUMANA_TITLES = {
  home:         { title: 'Resumen',          subtitle: 'Vista general del módulo de Gestión Humana' },
  dashboard:    { title: 'Dashboard',        subtitle: 'KPIs, distribuciones y acceso rápido' },
  personal:     { title: 'Base de Personal', subtitle: 'Listado y gestión de trabajadores' },
  contratacion: { title: 'Contratación',     subtitle: 'Pipeline de onboarding de 6 pasos' },
  vacaciones:   { title: 'Vacaciones',       subtitle: 'Programación, aprobaciones y notificaciones' },
  permisos:     { title: 'Permisos y Estados', subtitle: 'Incapacidades, maternidad, luto y permisos diversos' },
  afiliaciones: { title: 'Afiliaciones',     subtitle: 'EPS, Pensión, ARL y Caja de Compensación' },
  documentos:   { title: 'Documentos y Firmas', subtitle: '7 tipos de documentos del proceso de contratación' },
  'firma-electronica': { title: 'Firma electrónica', subtitle: 'Centro de control del proceso de firma por trabajador' },
  comunicacion: { title: 'Comunicación',     subtitle: 'Anuncios y mensajes oficiales' }
};

class GestionHumanaHome {
  constructor(container, moduleName, submodules, companyName) {
    this.container = container;
    this.moduleName = moduleName;
    this.submodules = submodules || [];
    this.currentCompany = companyName || null;
    this.companyName = this.currentCompany;
    this.currentView = 'home';
    this.viewInstance = null;
    this.shellEl = null;
    this.contentEl = null;
    this.kpis = {
      personalActivos: null,
      personalTotal: null,
      contratacionesEnProceso: null,
      contratacionesTotal: null,
      completados: null,
      cancelados: null
    };
  }

  // === HELPERS ===
  _getCurrentCompany() {
    if (window.currentCompany && window.currentCompany !== 'default_company') return window.currentCompany;
    if (window.rendererState && window.rendererState.selectedCompany) return window.rendererState.selectedCompany;
    if (window.currentModule && window.currentModule.company) return window.currentModule.company;
    var el = document.getElementById('company-name');
    if (el && el.textContent && el.textContent !== 'Empresa') return el.textContent.trim();
    return 'default_company';
  }

  _fmt(n) {
    if (n == null) return '—';
    return new Intl.NumberFormat('es-CO').format(n);
  }

  _getCurrentTitle() {
    return GESTION_HUMANA_TITLES[this.currentView] || GESTION_HUMANA_TITLES.home;
  }

  _cleanupView() {
    if (this.viewInstance && typeof this.viewInstance.destroy === 'function') {
      try { this.viewInstance.destroy(); } catch (_) { /* noop */ }
    }
    this.viewInstance = null;
    if (this._navHandler) {
      window.removeEventListener('gh-shell-navigate', this._navHandler);
      this._navHandler = null;
    }
  }

  _nitFromCompany(name) {
    var map = {
      'Tempoactiva': '900.511.178-1',
      'Temposum':    '800.123.456-7',
      'Aseplus':     '900.222.333-4',
      'Asel':        '901.555.666-7'
    };
    return map[name] || '900.511.178-1';
  }

  // === DATA ===
  async _loadKpis() {
    if (!window.electronAPI || !window.electronAPI.ghListPersonal) return;
    var companyName = this.currentCompany;
    if (!companyName || companyName === 'default_company') return;
    try {
      var r1 = await window.electronAPI.ghListPersonal({ companyName: companyName });
      if (r1 && r1.success) {
        this.kpis.personalTotal = r1.data.count;
        this.kpis.personalActivos = r1.data.personales.filter(function (p) { return p.estado === 'activo'; }).length;
      }
      var r2 = await window.electronAPI.ghListContrataciones({ companyName: companyName });
      if (r2 && r2.success) {
        this.kpis.contratacionesTotal = r2.data.count;
        this.kpis.contratacionesEnProceso = r2.data.contrataciones.filter(function (c) { return c.estado === 'en_proceso'; }).length;
        this.kpis.completados = r2.data.contrataciones.filter(function (c) { return c.estado === 'completado'; }).length;
        this.kpis.cancelados = r2.data.contrataciones.filter(function (c) { return c.estado === 'cancelado'; }).length;
      }
    } catch (e) {
      console.warn('[GestionHumanaHome] Error cargando KPIs:', e.message);
    }
  }

  // === RENDER ===
  async render() {
    this._cleanupView();
    console.log('🏢 [GestionHumanaHome] Renderizando view=' + this.currentView + ' company=' + this.companyName);

    await this._loadKpis();

    // Cargar HTML del shell via fetch (cached después de la primera carga)
    if (!this._shellHtml) {
      this._shellHtml = await this._fetchShellHtml();
    }

    // 📦714 · Limpiar estilos del container padre (#content-area tiene padding,
    // border-radius y box-shadow que interfieren con el layout del shell).
    // Aplicar en CADA render (idempotente, no causa daño).
    this.container.style.padding = '0';
    this.container.style.background = 'transparent';
    this.container.style.borderRadius = '0';
    this.container.style.boxShadow = 'none';
    this.container.style.overflow = 'hidden';
    this.container.style.position = 'relative';

    // 📦719 · Prevenir scroll del container padre (#main-content tiene
    // overflow-y: auto que hace scroll cuando el shell es más alto que el viewport).
    // Guardamos el valor original para restaurarlo en destroy().
    if (!this._prevBodyOverflow) {
      this._prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    // Inyectar el HTML en el container
    this.container.innerHTML = this._shellHtml;
    // Aislar el shell y el content
    this.shellEl = this.container.querySelector('.gh-shell');
    this.contentEl = this.container.querySelector('.gh-content');
    this._tabsEl = this.container.querySelector('.gh-tabs');

    // Wire tabs
    this._renderTabs();
    this._wireResizeTabs();

    // Wire shell navigation event (quick access cards en DashboardComponent)
    var self = this;
    if (!this._navHandler) {
      this._navHandler = function (e) {
        if (e && e.detail && e.detail.view && e.detail.view !== self.currentView) {
          self.currentView = e.detail.view;
          self.render();
        }
      };
      window.addEventListener('gh-shell-navigate', this._navHandler);
    }

    // Set NIT badge (si existiera)
    // (Removido por pedido del user — ya no se muestra el badge de empresa ni el NIT en el header)

    // Render view in content
    this._renderViewInto(this.contentEl);
  }

  async _fetchShellHtml() {
    // Intentar fetch al HTML; fallback inline si falla
    try {
      var r = await fetch('modules/gestion-humana/gestion-humana-home.html');
      if (r.ok) {
        return await r.text();
      }
    } catch (e) {
      console.warn('[GestionHumanaHome] fetch HTML falló, usando fallback inline:', e.message);
    }
    // Fallback: HTML inline (debe coincidir con gestion-humana-home.html)
    return '<div class="gh-shell" id="gh-shell">' +
      '<header class="gh-header">' +
        '<div class="gh-header__left">' +
          '<h1 class="gh-header__title">' +
            '<i class="fas fa-people-group gh-header__icon"></i> Gestión Humana' +
          '</h1>' +
          '<p class="gh-header__subtitle">Sistema de Gestión de Personal — TEMPOACTIVA EST S.A.S.</p>' +
        '</div>' +
        '<div class="gh-header__right">' +
          '<button class="gh-bell-btn" id="gh-bell-btn" title="Notificaciones">' +
            '<i class="fas fa-bell"></i><span class="gh-bell-badge" id="gh-bell-badge"></span>' +
          '</button>' +
        '</div>' +
      '</header>' +
      '<nav class="gh-tabs" id="gh-tabs" role="tablist"></nav>' +
      '<main class="gh-content" id="gh-content"></main>' +
    '</div>';
  }

  _renderTabs() {
    if (!this._tabsEl) return;
    var self = this;
    this._tabsEl.innerHTML = '';

    // 📦716 · Modo ventana: < 1200px → solo shortLabel sin iconos
    //      Modo maximizado: ≥ 1200px → icono + label completo
    var expanded = window.innerWidth >= 1200;

    GESTION_HUMANA_NAV.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gh-tab' + (item.id === self.currentView ? ' gh-tab--active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', item.id === self.currentView ? 'true' : 'false');
      btn.setAttribute('title', item.label);
      if (expanded) {
        // Maximizado: icono + label completo
        btn.innerHTML =
          '<i class="fas ' + item.icon + ' gh-tab__icon"></i>' +
          '<span>' + item.label + '</span>';
      } else {
        // Modo ventana: solo shortLabel (abreviado) sin iconos
        var text = item.shortLabel || item.label;
        btn.innerHTML = '<span>' + text + '</span>';
      }
      btn.onclick = function () {
        if (item.id !== self.currentView) {
          self.currentView = item.id;
          self.render();
        }
      };
      this._tabsEl.appendChild(btn);
    }.bind(this));
  }

  // 📦716 · Escuchar cambios de tamaño de ventana para re-renderizar tabs
  _wireResizeTabs() {
    if (this._resizeTabsHandler) return;
    var self = this;
    var lastExpanded = window.innerWidth >= 1200;
    this._resizeTabsHandler = function () {
      var expanded = window.innerWidth >= 1200;
      if (expanded !== lastExpanded) {
        lastExpanded = expanded;
        self._renderTabs();
      }
    };
    window.addEventListener('resize', this._resizeTabsHandler);
  }

  // === VIEW DISPATCH ===
  _renderViewInto(content) {
    if (!content) {
      console.error('[GestionHumanaHome] _renderViewInto: content es null');
      return;
    }
    switch (this.currentView) {
      case 'home':
        this._renderHomeView(content);
        break;
      case 'dashboard':
        this._mountExistingView(content, 'DashboardComponent', 'Dashboard');
        break;
      case 'personal':
        this._mountExistingView(content, 'BasePersonalComponent', 'Base de Personal');
        break;
      case 'contratacion':
        this._mountExistingView(content, 'ContratacionComponent', 'Contratación');
        break;
      case 'vacaciones':
        this._mountExistingView(content, 'VacacionesComponent', 'Vacaciones');
        break;
      case 'permisos':
        this._mountExistingView(content, 'PermisosComponent', 'Permisos y Estados');
        break;
      case 'afiliaciones':
        this._mountExistingView(content, 'AfiliacionesComponent', 'Afiliaciones');
        break;
      case 'documentos':
        this._mountExistingView(content, 'DocumentosComponent', 'Documentos y Firmas');
        break;
      case 'firma-electronica':
        this._mountExistingView(content, 'FirmaElectronicaComponent', 'Firma electrónica');
        break;
      case 'comunicacion':
        this._mountExistingView(content, 'ComunicacionComponent', 'Comunicación');
        break;
      default:
        this._renderPlaceholder(content, this.currentView);
        break;
    }
  }

  _mountExistingView(content, className, subName) {
    if (typeof window[className] !== 'function') {
      this._renderMissingComponent(content, className);
      return;
    }
    try {
      this.viewInstance = new window[className](
        content,
        this.companyName,
        'Gestión Humana',
        subName,
        function () { self.currentView = 'home'; self.render(); }
      );
      var self = this;
      if (typeof this.viewInstance.render === 'function') {
        this.viewInstance.render();
      } else if (typeof this.viewInstance.show === 'function') {
        this.viewInstance.show();
      }
    } catch (e) {
      console.error('[GestionHumanaHome] Error montando ' + className + ':', e);
      this._renderMissingComponent(content, className, e.message);
    }
  }

  _renderMissingComponent(content, className, err) {
    content.innerHTML =
      '<div style="background:white; border:1px solid #f5c6cb; border-radius:0.5rem; padding:1.5rem; color:#721c24;">' +
        '<h3 style="margin:0 0 0.5rem;">⚠️ No se pudo cargar <code>' + className + '</code></h3>' +
        (err ? '<p style="margin:0; font-size:0.875rem;">' + err + '</p>' : '<p style="margin:0; font-size:0.875rem;">Verifica que el script esté cargado en <code>index.html</code>.</p>') +
      '</div>';
  }

  // === VIEWS ===
  _renderHomeView(content) {
    var self = this;
    content.innerHTML = '';

    // KPIs bar
    content.appendChild(this._renderKpisBar());

    // Section title
    var sec = document.createElement('div');
    sec.style.cssText = 'margin-top:1.5rem;';
    sec.innerHTML =
      '<h2 style="margin:0 0 0.875rem; font-size:0.75rem; text-transform:uppercase; color:#5a6378; letter-spacing:0.5px; font-weight:600;">' +
        '<i class="fas fa-th-large"></i> Sub-módulos' +
      '</h2>';
    content.appendChild(sec);

    // Grid de cards
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:1rem;';
    grid.appendChild(this._renderNavCard({
      icon: 'fa-chart-line', iconColor: '#7c3aed', iconBg: '#f3e8ff',
      title: 'Dashboard', subtitle: 'Vista general',
      description: 'KPIs del módulo, distribuciones (sede, género, cargo, nivel educativo) y acceso rápido a las funciones más usadas.',
      buttonText: 'Abrir Dashboard', buttonColor: '#7c3aed',
      view: 'dashboard', ready: true
    }));
    grid.appendChild(this._renderNavCard({
      icon: 'fa-users', iconColor: '#174ea6', iconBg: '#e8f0fe',
      title: 'Base de Personal', subtitle: 'Trabajadores',
      description: 'Listado de trabajadores activos e inactivos con búsqueda, filtros y CRUD completo. Datos de contacto, contrato, seguridad social y datos bancarios.',
      kpis: [
        { label: 'Activos', value: this.kpis.personalActivos, color: '#28a745' },
        { label: 'Total',   value: this.kpis.personalTotal,   color: '#174ea6' }
      ],
      buttonText: 'Abrir Base de Personal', buttonColor: '#174ea6',
      view: 'personal', ready: true
    }));
    grid.appendChild(this._renderNavCard({
      icon: 'fa-user-plus', iconColor: '#0d9488', iconBg: '#ccfbf1',
      title: 'Contratación', subtitle: 'Pipeline de onboarding',
      description: 'Pipeline de 6 pasos para nuevos aspirantes: memo, contacto, exámenes, firma de documentos, afiliaciones y activación S400.',
      kpis: [
        { label: 'En Proceso',  value: this.kpis.contratacionesEnProceso, color: '#ffc107' },
        { label: 'Completados', value: this.kpis.completados,             color: '#28a745' },
        { label: 'Total',       value: this.kpis.contratacionesTotal,     color: '#174ea6' }
      ],
      buttonText: 'Abrir Contratación', buttonColor: '#0d9488',
      view: 'contratacion', ready: true
    }));
    grid.appendChild(this._renderNavCard({
      icon: 'fa-umbrella-beach', iconColor: '#ea580c', iconBg: '#ffedd5',
      title: 'Vacaciones', subtitle: 'Programación y aprobaciones',
      description: 'Solicitudes de vacaciones, aprobaciones, programación y notificación a clientes. Flujo mensual con tipos solicitada, aprobada, rechazada y disfrutada.',
      buttonText: 'Abrir Vacaciones', buttonColor: '#ea580c',
      view: 'vacaciones', ready: true
    }));
    grid.appendChild(this._renderNavCard({
      icon: 'fa-file-medical', iconColor: '#be123c', iconBg: '#ffe4e6',
      title: 'Permisos y Estados', subtitle: 'Incapacidades, maternidad, luto',
      description: 'Registro y seguimiento de permisos (incapacidad, maternidad, paternidad, luto, citas médicas, calamidad). Finalización automática y prórroga.',
      buttonText: 'Abrir Permisos', buttonColor: '#be123c',
      view: 'permisos', ready: true
    }));
    grid.appendChild(this._renderNavCard({
      icon: 'fa-shield-halved', iconColor: '#0891b2', iconBg: '#cffafe',
      title: 'Afiliaciones', subtitle: 'Seguridad social',
      description: 'Estado 4/4 de cada trabajador: EPS, Fondo de Pensión, ARL y Caja de Compensación. Búsqueda por nombre o cédula.',
      buttonText: 'Abrir Afiliaciones', buttonColor: '#0891b2',
      view: 'afiliaciones', ready: true
    }));
    grid.appendChild(this._renderNavCard({
      icon: 'fa-file-signature', iconColor: '#1d4ed8', iconBg: '#dbeafe',
      title: 'Documentos y Firmas', subtitle: '7 formatos del proceso',
      description: 'Generación y firma digital de los 7 formatos del proceso de contratación: autorización datos, hojas de vida, inducción, contrato, etc.',
      buttonText: 'Abrir Documentos', buttonColor: '#1d4ed8',
      view: 'documentos', ready: true
    }));
    grid.appendChild(this._renderNavCard({
      icon: 'fa-file-signature', iconColor: '#f59e0b', iconBg: '#fef3c7',
      title: 'Firma electrónica', subtitle: 'Centro de control por trabajador',
      description: 'Vista unificada del proceso de firma por trabajador. Tabla con estado agregado (pendiente, en proceso, completado), buscador por ID de solicitud y drill-down a expediente.',
      buttonText: 'Abrir Firma electrónica', buttonColor: '#f59e0b',
      view: 'firma-electronica', ready: true
    }));
    grid.appendChild(this._renderNavCard({
      icon: 'fa-bullhorn', iconColor: '#a16207', iconBg: '#fef3c7',
      title: 'Comunicación', subtitle: 'Anuncios y mensajes',
      description: 'Tablón de anuncios oficiales (info, urgente, mantenimiento, evento) y mensajes directos entre trabajadores.',
      buttonText: 'Abrir Comunicación', buttonColor: '#a16207',
      view: 'comunicacion', ready: true
    }));
    sec.appendChild(grid);

    // Pipeline preview
    var pipelinePreview = document.createElement('div');
    pipelinePreview.style.cssText = 'margin-top:1.5rem; background:white; border:1px solid #e9ecef; border-radius:0.5rem; padding:1.25rem;';
    pipelinePreview.innerHTML =
      '<div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.875rem;">' +
        '<i class="fas fa-info-circle" style="color:#0d9488;"></i>' +
        '<strong style="color:#1a1a2e; font-size:0.875rem;">Pipeline de Contratación (6 pasos)</strong>' +
      '</div>' +
      '<div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:0.5rem;">' +
        this._renderPipelineStep(1, 'Memo',         'Recepción del memo') +
        this._renderPipelineStep(2, 'Contacto',     'WhatsApp / llamada') +
        this._renderPipelineStep(3, 'Exámenes',     'Médicos ocupacionales') +
        this._renderPipelineStep(4, 'Documentos',   '7 formatos a firmar') +
        this._renderPipelineStep(5, 'Afiliaciones', 'EPS, ARL, Caja') +
        this._renderPipelineStep(6, 'Activar S400', 'Sistema interno') +
      '</div>';
    content.appendChild(pipelinePreview);
  }

  _renderKpisBar() {
    // 📦720 · Usa el helper compartido GHKPIBar (patrón Programa de Capacitación)
    var self = this;
    var bar = document.createElement('div');
    var kpis = [
      { icon: 'fa-user-check',         color: '#28a745', bg: '#d4edda', value: this._fmt(this.kpis.personalActivos),         label: 'Personal Activo' },
      { icon: 'fa-user-clock',         color: '#0d9488', bg: '#ccfbf1', value: this._fmt(this.kpis.contratacionesEnProceso), label: 'Contrataciones en Proceso' },
      { icon: 'fa-user-check-double',  color: '#174ea6', bg: '#e8f0fe', value: this._fmt(this.kpis.completados),             label: 'Completados' },
      { icon: 'fa-user-xmark',         color: '#6c757d', bg: '#e9ecef', value: this._fmt(this.kpis.cancelados),              label: 'Cancelados' }
    ];
    window.GHKPIBar.render(bar, kpis);
    return bar;
  }

  _renderNavCard(opts) {
    var self = this;
    var card = document.createElement('div');
    card.style.cssText = 'background:white; border:1px solid #e9ecef; border-radius:0.5rem; padding:0; overflow:hidden; transition:box-shadow 0.2s, transform 0.2s; display:flex; flex-direction:column;';
    card.onmouseenter = function () { card.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)'; card.style.transform = 'translateY(-2px)'; };
    card.onmouseleave = function () { card.style.boxShadow = ''; card.style.transform = ''; };

    var banner = document.createElement('div');
    banner.style.cssText = 'background:' + opts.iconBg + '; padding:1rem 1.25rem; display:flex; align-items:center; gap:0.75rem;';
    var pill = opts.ready
      ? '<span style="background:#d4edda; color:#155724; padding:0.2rem 0.5rem; border-radius:1rem; font-size:0.65rem; font-weight:600;">✓ Backend OK</span>'
      : '<span style="background:#fff3cd; color:#856404; padding:0.2rem 0.5rem; border-radius:1rem; font-size:0.65rem; font-weight:600;">⏳ Próximamente</span>';
    banner.innerHTML =
      '<div style="width:40px; height:40px; border-radius:0.5rem; background:white; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 3px rgba(0,0,0,0.08);">' +
        '<i class="fas ' + opts.icon + '" style="color:' + opts.iconColor + '; font-size:1.125rem;"></i>' +
      '</div>' +
      '<div style="flex:1; min-width:0;">' +
        '<h3 style="margin:0; font-size:1rem; color:#1a1a2e;">' + opts.title + '</h3>' +
        '<div style="font-size:0.7rem; color:#5a6378; text-transform:uppercase; letter-spacing:0.3px;">' + opts.subtitle + '</div>' +
      '</div>' +
      pill;
    card.appendChild(banner);

    var body = document.createElement('div');
    body.style.cssText = 'padding:1rem 1.25rem; flex:1; display:flex; flex-direction:column; gap:0.875rem;';

    var desc = document.createElement('p');
    desc.style.cssText = 'margin:0; color:#495057; font-size:0.8125rem; line-height:1.5;';
    desc.textContent = opts.description;
    body.appendChild(desc);

    if (opts.kpis && opts.kpis.length > 0) {
      var kpiRow = document.createElement('div');
      kpiRow.style.cssText = 'display:flex; gap:0.5rem; padding:0.5rem 0; border-top:1px solid #f1f3f5; border-bottom:1px solid #f1f3f5;';
      opts.kpis.forEach(function (k) {
        kpiRow.innerHTML +=
          '<div style="flex:1; text-align:center;">' +
            '<div style="font-size:1rem; font-weight:700; color:' + k.color + '; line-height:1;">' + self._fmt(k.value) + '</div>' +
            '<div style="font-size:0.6rem; text-transform:uppercase; color:#5a6378; letter-spacing:0.3px; margin-top:0.2rem;">' + k.label + '</div>' +
          '</div>';
      });
      body.appendChild(kpiRow);
    }

    var btn = document.createElement('button');
    btn.style.cssText = 'background:' + (opts.ready ? opts.buttonColor : '#9ca3af') + '; color:white; border:none; padding:0.55rem 1rem; border-radius:0.4rem; cursor:' + (opts.ready ? 'pointer' : 'not-allowed') + '; font-size:0.8125rem; font-weight:500; display:flex; align-items:center; justify-content:center; gap:0.5rem; margin-top:auto;';
    btn.innerHTML = '<i class="fas ' + (opts.ready ? 'fa-arrow-right' : 'fa-hourglass-half') + '"></i> ' + opts.buttonText;
    btn.disabled = !opts.ready;
    btn.onclick = function () {
      if (!opts.ready) return;
      self.currentView = opts.view;
      self.render();
    };
    body.appendChild(btn);

    card.appendChild(body);
    return card;
  }

  _renderPipelineStep(num, label, desc) {
    return '<div style="background:#f8f9fa; border-left:3px solid #0d9488; padding:0.5rem 0.625rem; border-radius:0.3rem;">' +
      '<div style="font-size:0.65rem; font-weight:700; color:#0d9488;">' + num + '</div>' +
      '<div style="font-size:0.75rem; font-weight:600; color:#1a1a2e;">' + label + '</div>' +
      '<div style="font-size:0.65rem; color:#5a6378;">' + desc + '</div>' +
    '</div>';
  }

  _renderPlaceholder(content, viewId) {
    var t = GESTION_HUMANA_TITLES[viewId] || { title: viewId, subtitle: '' };
    var item = GESTION_HUMANA_NAV.find(function (n) { return n.id === viewId; });
    var icon = item ? item.icon : 'fa-cube';
    content.innerHTML =
      '<div style="background:white; border:1px solid #e9ecef; border-radius:0.5rem; padding:3rem 2rem; text-align:center; max-width:600px; margin:2rem auto;">' +
        '<div style="width:64px; height:64px; border-radius:0.75rem; background:#fef3c7; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem;">' +
          '<i class="fas ' + icon + '" style="font-size:1.5rem; color:#a16207;"></i>' +
        '</div>' +
        '<h2 style="margin:0 0 0.5rem; font-size:1.25rem; color:#1a1a2e;">' + t.title + '</h2>' +
        '<p style="margin:0 0 1.25rem; color:#5a6378; font-size:0.875rem;">' + t.subtitle + '</p>' +
        '<p style="margin:0; padding:0.875rem 1rem; background:#fff3cd; border-radius:0.375rem; color:#856404; font-size:0.8125rem;">' +
          '<i class="fas fa-clock"></i> Esta vista se implementará en una fase posterior del rediseño de Gestión Humana (v0.2.0).' +
        '</p>' +
      '</div>';
  }

  destroy() {
    this._cleanupView();
    if (this._resizeTabsHandler) {
      window.removeEventListener('resize', this._resizeTabsHandler);
      this._resizeTabsHandler = null;
    }
    // 📦719 · Restaurar overflow del body que modificamos en render()
    if (this._prevBodyOverflow !== undefined) {
      document.body.style.overflow = this._prevBodyOverflow;
      this._prevBodyOverflow = undefined;
    }
  }
}

window.GestionHumanaHome = GestionHumanaHome;
