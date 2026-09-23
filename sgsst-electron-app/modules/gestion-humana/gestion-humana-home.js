// modules/gestion-humana/gestion-humana-home.js
// 📦811 · Módulo "Gestión Humana" — Shell + Home MIGRACIÓN PREMIUM (v0.3.0).
//
// Shell: header premium (badge SVG + título + subtítulo con empresa) + tabs
//        horizontales con iconos SVG inline (adiós Font Awesome en el shell)
//        + contenido. CSS en `gestion-humana-home.css`; HTML en
//        `gestion-humana-home.html` (fetch con fallback inline, DEBEN coincidir).
// Home (Resumen): hero + 3 métricas + grid de las 9 áreas (navegación interna).
// Las vistas de trabajo (Base de Personal, Contratación, etc.) se montan como
// siempre con _mountExistingView — sin cambios de IPC ni de contratos.

// 📦811 · Iconos del shell = SVG inline (estilo Lucide, stroke currentColor).
// El shell YA NO usa Font Awesome (las vistas sí, hasta su propia migración).
var GESTION_HUMANA_NAV = [
  { id: 'home',          label: 'Resumen',          shortLabel: 'Resumen',     icon: 'grid',       group: 'Principal' },
  { id: 'dashboard',     label: 'Dashboard',        shortLabel: 'Dashboard',   icon: 'chart',      group: 'Gestión' },
  { id: 'contratacion',  label: 'Contratación',     shortLabel: 'Contratación', icon: 'userplus',  group: 'Gestión' },
  { id: 'carpetas',      label: 'Carpetas',         shortLabel: 'Carpetas',     icon: 'folder',    group: 'Documentos' },
  { id: 'firma-electronica', label: 'Firma electrónica', shortLabel: 'Firma electr.', icon: 'filepen', group: 'Documentos' },
  { id: 'afiliaciones',  label: 'Afiliaciones',     shortLabel: 'Afiliaciones', icon: 'shield',    group: 'Gestión' },
  { id: 'personal',      label: 'Base de Personal', shortLabel: 'B. Pers.',    icon: 'users',      group: 'Gestión' },
  { id: 'vacaciones',    label: 'Vacaciones',       shortLabel: 'Vacaciones',  icon: 'umbrella',   group: 'Gestión' },
  { id: 'permisos',      label: 'Permisos y Estados', shortLabel: 'P. y Est.', icon: 'filemed',    group: 'Gestión' },
  { id: 'comunicacion',  label: 'Comunicación',     shortLabel: 'Comunicación', icon: 'megaphone', group: 'Colaboración' }
];

// Diccionario de SVG (24×24, stroke-based)
var GH_SVG = {
  grid:      '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  chart:     '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 14l4-4 4 3 5-6"/><circle cx="20" cy="7" r="0.6"/>',
  userplus:  '<circle cx="10" cy="7" r="3.5"/><path d="M3.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5"/><path d="M18.5 8v5M16 10.5h5"/>',
  folder:    '<path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  filepen:   '<path d="M6 3.5h7L19 9v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V5A1.5 1.5 0 0 1 6 3.5z"/><path d="M13 3.5V9h6"/><path d="M9.3 16.8 14.8 11l1.7 1.7-5.5 5.8-2.4.6z"/>',
  shield:    '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
  users:     '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c0-3.3 2.7-5 5.5-5s5.5 1.7 5.5 5"/><circle cx="17" cy="9.5" r="2.6"/><path d="M15.8 14.7c2.6.3 4.7 1.9 4.7 4.3"/>',
  umbrella:  '<path d="M12 3C7 3 3.5 7 3.5 11.5h17C20.5 7 17 3 12 3z"/><path d="M12 11.5V18a2 2 0 0 0 4 0"/><path d="M12 3V1.8"/>',
  filemed:   '<path d="M6 3.5h7L19 9v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V5A1.5 1.5 0 0 1 6 3.5z"/><path d="M13 3.5V9h6"/><path d="M12 12v5M9.5 14.5h5"/>',
  megaphone: '<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V7L7 9H5a1 1 0 0 0-1 1z"/><path d="M16.2 9.8a3.5 3.5 0 0 1 0 4.4"/><path d="M18.8 7.5a7 7 0 0 1 0 9"/>',
  bell:      '<path d="M6 9.5a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/>',
  chevron:   '<path d="M9 6l6 6-6 6"/>',
  pulse:     '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
  checkflag: '<path d="M5 21V4"/><path d="M5 4.7C7.5 3 10 3 12 4.7s4.5 1.7 7 0V13c-2.5 1.7-5 1.7-7 0S7.5 11.7 5 13"/>'
};

function ghSvg(name, cls) {
  return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (GH_SVG[name] || '') + '</svg>';
}

var GESTION_HUMANA_TITLES = {
  home:         { title: 'Resumen',          subtitle: 'Vista general del módulo de Gestión Humana' },
  dashboard:    { title: 'Dashboard',        subtitle: 'KPIs, distribuciones y acceso rápido' },
  personal:     { title: 'Base de Personal', subtitle: 'Listado y gestión de trabajadores' },
  contratacion: { title: 'Contratación',     subtitle: 'Pipeline de onboarding de 6 pasos' },
  vacaciones:   { title: 'Vacaciones',       subtitle: 'Programación, aprobaciones y notificaciones' },
  permisos:     { title: 'Permisos y Estados', subtitle: 'Incapacidades, maternidad, luto y permisos diversos' },
  afiliaciones: { title: 'Afiliaciones',     subtitle: 'EPS, Pensión, ARL y Caja de Compensación' },
  'firma-electronica': { title: 'Firma electrónica', subtitle: 'Centro de control del proceso documental y firma electrónica' },
  carpetas:     { title: 'Carpetas',          subtitle: 'Archivo digital por trabajador' },
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

  // 📦811 · Header: subtítulo dinámico con la empresa (antes venía quemado "TEMPOACTIVA EST S.A.S.")
  _updateSubtitle() {
    var el = this.container.querySelector('#gh-subtitle');
    if (!el) return;
    var empresa = this.companyName && this.companyName !== 'default_company' ? this.companyName : null;
    el.textContent = 'Sistema de Gestión de Personal' + (empresa ? ' — ' + empresa : '');
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

    // 📦811 · Subtítulo con la empresa activa
    this._updateSubtitle();

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
          '<div class="gh-header__id">' +
            '<span class="gh-header__badge" aria-hidden="true">' + ghSvg('users') + '</span>' +
            '<div class="gh-header__text">' +
              '<h1 class="gh-header__title">Gestión Humana</h1>' +
              '<p class="gh-header__subtitle" id="gh-subtitle">Sistema de Gestión de Personal</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="gh-header__right">' +
          '<button class="gh-bell-btn" id="gh-bell-btn" title="Notificaciones" aria-label="Notificaciones">' +
            ghSvg('bell') + '<span class="gh-bell-badge" id="gh-bell-badge"></span>' +
          '</button>' +
        '</div>' +
      '</header>' +
      '<nav class="gh-tabs" id="gh-tabs" role="tablist" aria-label="Secciones de Gestión Humana"></nav>' +
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
        // Maximizado: icono SVG + label completo
        btn.innerHTML =
          '<span class="gh-tab__icon">' + ghSvg(item.icon) + '</span>' +
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
      case 'firma-electronica':
        this._mountExistingView(content, 'FirmaElectronicaComponent', 'Firma electrónica');
        break;
      case 'comunicacion':
        this._mountExistingView(content, 'ComunicacionComponent', 'Comunicación');
        break;
      case 'carpetas':
        this._mountExistingView(content, 'CarpetasComponent', 'Carpetas');
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
      '<div style="background: var(--widget-bg-color); border:1px solid #f5c6cb; border-radius:0.5rem; padding:1.5rem; color: var(--danger-color);">' +
        '<h3 style="margin:0 0 0.5rem;">⚠️ No se pudo cargar <code>' + className + '</code></h3>' +
        (err ? '<p style="margin:0; font-size:0.875rem;">' + err + '</p>' : '<p style="margin:0; font-size:0.875rem;">Verifica que el script esté cargado en <code>index.html</code>.</p>') +
      '</div>';
  }

  // === VIEWS ===
  // 📦811 · Home premium: hero (headline + big stat) + 3 métricas + grid de áreas.
  // Los datos siguen saliendo de _loadKpis() (mismo backend gh:*, sin tocar IPC).
  _renderHomeView(content) {
    var self = this;
    content.innerHTML = '';

    var scrollWrap = document.createElement('div');
    scrollWrap.className = 'gh-home-scroll';

    // ── HERO ──
    var empresa = this.companyName && this.companyName !== 'default_company' ? this.companyName : 'tu empresa';
    var hero = document.createElement('section');
    hero.className = 'gh-hero';
    hero.innerHTML =
      '<div class="gh-hero__main">' +
        '<span class="gh-hero__eyebrow">Resumen del módulo</span>' +
        '<h2 class="gh-hero__title">Talento humano bajo control</h2>' +
        '<p class="gh-hero__sub">Personal, contratación, ausencias y documentos del equipo en un solo lugar' +
          (this.companyName && this.companyName !== 'default_company' ? ' — ' + String(empresa).replace(/[<>&]/g, '') : '') + '.</p>' +
      '</div>' +
      '<div class="gh-hero__stat">' +
        '<span class="gh-hero__value">' + this._fmt(this.kpis.personalActivos) + '</span>' +
        '<span class="gh-hero__label">trabajadores activos</span>' +
        '<span class="gh-hero__foot">de ' + this._fmt(this.kpis.personalTotal) + ' registrados</span>' +
      '</div>';
    scrollWrap.appendChild(hero);

    // ── MÉTRICAS ──
    var metrics = document.createElement('div');
    metrics.className = 'gh-metrics';
    metrics.appendChild(this._renderMetric({
      tone: '', icon: 'pulse',
      label: 'Contrataciones en proceso',
      value: this.kpis.contratacionesEnProceso,
      sub: 'de ' + this._fmt(this.kpis.contratacionesTotal) + ' convocatorias'
    }));
    metrics.appendChild(this._renderMetric({
      tone: 'gh-metric--ok', icon: 'checkflag',
      label: 'Onboarding completados',
      value: this.kpis.completados,
      sub: 'procesos finalizados'
    }));
    metrics.appendChild(this._renderMetric({
      tone: 'gh-metric--neutral', icon: 'users',
      label: 'Procesos cancelados',
      value: this.kpis.cancelados,
      sub: 'convocatorias descartadas'
    }));
    // nota de tono warn para "en proceso" si hay alguno
    if ((this.kpis.contratacionesEnProceso || 0) > 0) {
      metrics.firstChild.classList.add('gh-metric--warn');
    }
    scrollWrap.appendChild(metrics);

    // ── GRID DE ÁREAS ──
    var head = document.createElement('div');
    head.className = 'gh-modwrap__head';
    head.innerHTML = '<h3>Áreas del módulo</h3><span class="gh-modwrap__count">9 vistas</span>';
    scrollWrap.appendChild(head);

    var grid = document.createElement('div');
    grid.className = 'gh-modules';

    var CARDS = [
      { view: 'dashboard', icon: 'chart', accent: '#7c3aed', tint: 'rgba(124,58,237,.12)',
        title: 'Dashboard', sub: 'Vista general',
        desc: 'KPIs del módulo, distribuciones por sede, género, cargo y nivel educativo, y acceso rápido a lo más usado.' },
      { view: 'personal', icon: 'users', accent: '#2057b8', tint: 'rgba(32,87,184,.12)',
        title: 'Base de Personal', sub: 'Trabajadores',
        desc: 'Listado de trabajadores activos e inactivos con búsqueda, filtros y gestión completa: contacto, contrato, seguridad social y datos bancarios.',
        chips: [
          { label: 'Activos', value: this.kpis.personalActivos },
          { label: 'Total', value: this.kpis.personalTotal }
        ] },
      { view: 'contratacion', icon: 'userplus', accent: '#0d9488', tint: 'rgba(13,148,136,.12)',
        title: 'Contratación', sub: 'Pipeline de onboarding',
        desc: 'Pipeline de 6 pasos para nuevos aspirantes: memo, contacto, exámenes, firma de documentos, afiliaciones y activación.',
        chips: [
          { label: 'En proceso', value: this.kpis.contratacionesEnProceso },
          { label: 'Completados', value: this.kpis.completados }
        ] },
      { view: 'carpetas', icon: 'folder', accent: '#16a34a', tint: 'rgba(22,163,74,.12)',
        title: 'Carpetas', sub: 'Archivo digital',
        desc: 'Expediente digital por trabajador con categorías de documentos, estados de completitud y subida directa de archivos.' },
      { view: 'firma-electronica', icon: 'filepen', accent: '#d97706', tint: 'rgba(217,119,6,.12)',
        title: 'Firma electrónica', sub: 'Centro de control',
        desc: 'Vista unificada del proceso de firma por trabajador: estados agregados, buscador por solicitud y expediente con trazabilidad.' },
      { view: 'afiliaciones', icon: 'shield', accent: '#0891b2', tint: 'rgba(8,145,178,.12)',
        title: 'Afiliaciones', sub: 'Seguridad social',
        desc: 'Estado 4/4 de cada trabajador: EPS, Fondo de Pensión, ARL y Caja de Compensación, con búsqueda por nombre o cédula.' },
      { view: 'vacaciones', icon: 'umbrella', accent: '#ea580c', tint: 'rgba(234,88,12,.12)',
        title: 'Vacaciones', sub: 'Programación y aprobaciones',
        desc: 'Solicitudes, aprobaciones y programación con flujo mensual: solicitada, aprobada, rechazada y disfrutada.' },
      { view: 'permisos', icon: 'filemed', accent: '#be123c', tint: 'rgba(190,18,60,.10)',
        title: 'Permisos y Estados', sub: 'Incapacidades, maternidad, luto',
        desc: 'Registro y seguimiento de permisos (incapacidad, maternidad, paternidad, luto, citas médicas, calamidad) con finalización y prórroga.' },
      { view: 'comunicacion', icon: 'megaphone', accent: '#a16207', tint: 'rgba(161,98,7,.12)',
        title: 'Comunicación', sub: 'Anuncios y mensajes',
        desc: 'Tablón de anuncios oficiales (info, urgente, mantenimiento, evento) y mensajes directos entre trabajadores.' }
    ];
    CARDS.forEach(function (c) { grid.appendChild(self._renderModCard(c)); });
    scrollWrap.appendChild(grid);

    content.appendChild(scrollWrap);
  }

  _renderMetric(m) {
    var el = document.createElement('div');
    el.className = 'gh-metric' + (m.tone ? ' ' + m.tone : '');
    el.innerHTML =
      '<div class="gh-metric__top">' +
        '<span class="gh-metric__icon">' + ghSvg(m.icon) + '</span>' +
        '<span class="gh-metric__label">' + m.label + '</span>' +
      '</div>' +
      '<div class="gh-metric__value">' + this._fmt(m.value) + '</div>' +
      '<div class="gh-metric__sub">' + m.sub + '</div>';
    return el;
  }

  _renderModCard(o) {
    var self = this;
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'gh-mod';
    card.style.setProperty('--gh-mod-accent', o.accent);
    card.style.setProperty('--gh-mod-tint', o.tint);

    var chips = '';
    if (o.chips && o.chips.length) {
      chips = '<span class="gh-mod__chips">' + o.chips.map(function (c) {
        return '<span class="gh-mod__chip">' + c.label + ' <strong>' + self._fmt(c.value) + '</strong></span>';
      }).join('') + '</span>';
    }

    card.innerHTML =
      '<span class="gh-mod__tile">' + ghSvg(o.icon) + '</span>' +
      '<span class="gh-mod__body">' +
        '<span class="gh-mod__title">' + o.title + '</span>' +
        '<span class="gh-mod__sub">' + o.sub + '</span>' +
        '<span class="gh-mod__desc">' + o.desc + '</span>' +
        chips +
      '</span>' +
      '<span class="gh-mod__go">' + ghSvg('chevron') + '</span>';

    card.addEventListener('click', function () {
      if (o.view !== self.currentView) {
        self.currentView = o.view;
        self.render();
      }
    });
    return card;
  }

  // 📦811 · Placeholder premium (solo se muestra si llega una vista desconocida)
  _renderPlaceholder(content, viewId) {
    var t = GESTION_HUMANA_TITLES[viewId] || { title: viewId, subtitle: '' };
    var item = GESTION_HUMANA_NAV.find(function (n) { return n.id === viewId; });
    var icon = item ? item.icon : 'grid';
    content.innerHTML =
      '<div class="gh-home-scroll">' +
      '<div class="gh-placeholder">' +
        '<div class="gh-placeholder__icon">' + ghSvg(icon) + '</div>' +
        '<h2>' + t.title + '</h2>' +
        '<p>' + t.subtitle + '</p>' +
        '<p style="margin-top:10px;">Esta vista se implementará en una fase posterior del rediseño de Gestión Humana.</p>' +
      '</div>' +
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
