class RecursosHome {
    constructor(container, moduleName, submodules, companyName) {
        this.container = container;
        this.moduleName = moduleName;
        this.submodules = submodules;
        // 📦748 · Aceptar currentCompany como parámetro del shell (fix: módulo Recursos vacío).
        // Fallback: getCurrentCompany() lee window.currentCompany → DOM → 'default_company'.
        this.currentCompany = companyName || this.getCurrentCompany() || null;
        this.budgetData = null;
        this.charts = {}; // Almacenar instancias de Chart.js
    }

    getCurrentCompany() {
        if (window.currentCompany && window.currentCompany !== 'default_company') return window.currentCompany;
        if (window.rendererState && window.rendererState.selectedCompany) return window.rendererState.selectedCompany;
        if (window.currentModule && window.currentModule.company) return window.currentModule.company;
        const domCompany = document.getElementById('company-name');
        if (domCompany && domCompany.textContent && domCompany.textContent !== 'Empresa') return domCompany.textContent.trim();
        return 'default_company';
    }

    async render() {
        this.container.innerHTML = '';
        this.currentCompany = this.getCurrentCompany();
        console.log('🏢 [RecursosHome] Renderizando K+AIR UI Field para:', this.currentCompany);

        // 1. Inyectar Estilos (CORREGIDO Y MEJORADO)
        this.injectStyles();

        // 2. Layout
        const layout = document.createElement('div');
        layout.className = 'k-app-layout';
        layout.style.cssText = 'height: 100%; display: flex; flex-direction: column; min-height: 0;';

        // Header (📦762 — minimal: solo breadcrumb + H1, escala fluido)
        const header = document.createElement('header');
        header.className = 'kair-page-header';
        header.innerHTML = `
            <div class="kair-page-title-block">
                <div class="kair-breadcrumb">
                    <span>Inicio</span><span>/</span>
                    <span>Gestión</span><span>/</span>
                    <span>Recursos</span>
                </div>
                <h1>Recursos</h1>
            </div>
        `;
        layout.appendChild(header);

        // Contenedor Principal
        const contentContainer = document.createElement('div');
        contentContainer.className = 'gestion-integral-home';
        contentContainer.id = 'app-container';

        // Área Principal
        const mainArea = document.createElement('div');
        mainArea.className = 'main-area';
        mainArea.style.flex = '1';

        // 📦491 — Skeleton mientras cargan estadísticas de Recursos (6 widgets + 3 charts: line+bar+line)
        mainArea.innerHTML = KairSkeleton.kpiStrip(6) + KairSkeleton.chartBars(12) + KairSkeleton.chartBars(12) + KairSkeleton.chartBars(12);

        // 📦491-fix — Agregar al DOM ANTES del await para que el skeleton sea visible
        contentContainer.appendChild(mainArea);
        layout.appendChild(contentContainer);
        this.container.appendChild(layout);

        // 📦491-fix — Retardo de 200ms para que el browser pinte el skeleton y el ojo lo registre
        // antes de que JS continue con la carga. Sin esto, el skeleton se borra antes de verse.
        await new Promise(r => setTimeout(r, 200));

        // Renderizar contenido (limpia el skeleton y pinta widgets reales cuando llegan los datos)
        await this.renderMainArea(mainArea);

        // El rediseño premium usa SVG (renderChartPresupuesto) en vez de Chart.js.
        // initCharts ya no aplica — los canvases budgetChart/trainingChart/inductionChart no existen en el nuevo layout.
        // setTimeout(() => this.initCharts(), 100); // 📦762 — deshabilitado por rediseño premium
    }

    injectStyles() {
        const styleId = 'k-air-resources-oficial-styles-v2';
        const oldStyle = document.getElementById(styleId);
        if (oldStyle) oldStyle.remove();

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* =========================================
               1. SISTEMA VISUAL K+AIR (OFICIAL)
               ========================================= */
            .gestion-integral-home {
                /* Scope vars */
                --k-primary: #174ea6;
                --k-primary-hover: #185abd;
                --k-primary-light: rgba(23, 78, 166, 0.1);
                --k-success: #28a745;
                --k-success-light: rgba(40, 167, 69, 0.1);
                --k-warning: #ffc107;
                --k-warning-light: rgba(255, 193, 7, 0.1);
                --k-danger: #dc3545;
                --k-danger-light: rgba(220, 53, 69, 0.1);
                --k-bg-app: #f8f9fa;
                --k-bg-card: #ffffff;
                --k-border: #dee2e6;
                --k-font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
                --k-text-main: #212529;
                --k-text-muted: #6c757d;
                --k-radius-md: 0.375rem;
                --k-radius-lg: 0.5rem;
                --k-shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.05);
                --k-shadow-md: 0 0.5rem 1rem rgba(0, 0, 0, 0.08);
                --k-header-height: 60px;

                font-family: var(--k-font-family);
                color: var(--k-text-main);
                background-color: var(--k-bg-app);
                height: 100%;
                min-height: 0;
                display: flex;
                flex-direction: column;
                padding: 1.5rem;
                overflow: hidden auto;
            }

            /* 📦768 — Forzar altura y flex en .k-app-layout para que el chain funcione.
               Sin esta regla, .k-app-layout crece con el contenido y mainArea no tiene altura. */
            .k-app-layout {
                height: 100%;
                min-height: 0;
                display: flex;
                flex-direction: column;
            }

            /* Header & Botones */
            .k-module-header {
                background-color: var(--k-bg-card);
                border-bottom: 1px solid var(--k-border);
                padding: 0 1.5rem;
                height: var(--k-header-height);
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-shrink: 0;
            }

            .k-module-title {
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--k-primary) !important;
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }

            .k-module-title i {
                color: var(--k-primary) !important;
            }

            .k-btn-ingresar {
                background-color: var(--k-bg-card);
                border: 1px solid var(--k-border);
                color: var(--k-text-main);
                padding: 0.5rem 1rem;
                border-radius: var(--k-radius-md);
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .k-btn-ingresar:hover {
                background-color: var(--k-primary-light);
                border-color: var(--k-primary);
                color: var(--k-primary);
            }

            /* Main Layout */
            .main-area {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                overflow-y: auto;
                padding-right: 0.5rem;
                width: 100%;
                flex: 1 1 auto;
                min-height: 0;
                height: 100%;
            }

            /* Grid de Widgets */
            .widgets-container {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 1rem;
            }

            /* Widget Base */
            .widget {
                background: var(--k-bg-card);
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-lg);
                padding: 1rem;
                display: flex;
                flex-direction: column;
                position: relative;
                box-shadow: var(--k-shadow-sm);
                transition: transform 0.2s ease;
                min-height: 120px; /* Altura mínima uniforme */
            }
            .widget:hover {
                transform: translateY(-3px);
                box-shadow: var(--k-shadow-md);
            }
            .widget h4 {
                margin: 0 0 0.5rem 0;
                font-size: 0.65rem;
                color: var(--k-text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 600;
            }
            .widget-value {
                font-size: 1.4rem;
                font-weight: 700;
                color: var(--k-text-main);
                margin-bottom: 0.5rem;
            }
            .widget-description {
                font-size: 0.65rem;
                color: var(--k-text-muted);
            }

            /* =========================================
               WIDGET DE PRESUPUESTO (MODERNO Y CORREGIDO)
               ========================================= */
            .k-budget-card {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }

            /* Header del Widget: Año y Badge */
            .kb-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.5rem;
            }
            .kb-title {
                font-size: 0.65rem;
                font-weight: 600;
                color: var(--k-text-muted);
                text-transform: uppercase;
            }
            .kb-badge {
                font-size: 0.7rem;
                font-weight: 700;
                padding: 0.15rem 0.5rem;
                border-radius: 1rem;
                color: white;
                background-color: var(--k-success); /* Por defecto verde */
            }

            /* Valor Principal */
            .kb-amount {
                font-size: 1.4rem;
                font-weight: 700;
                color: var(--k-text-main);
                margin-bottom: 0.75rem;
                text-align: center;
            }

            /* Descripción del widget (estilo estándar Gestión de la Salud) */
            .kb-description {
                font-size: 0.72rem;
                color: var(--k-text-muted);
                text-align: center;
                margin-bottom: 4px;
            }

            /* Barra de Progreso - CORRECCIÓN VISUAL */
            .kb-progress-track {
                width: 100%;
                height: 10px; /* Altura definida y visible */
                background-color: #e9ecef;
                border-radius: 5px;
                overflow: hidden;
                margin-bottom: 0.5rem;
                position: relative;
            }

            .kb-progress-bar {
                height: 100%;
                width: 0%; /* ESTADO INICIAL: 0% para animar */
                border-radius: 5px;
                background-color: var(--k-success);
                transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s;
                position: relative;
            }

            /* Detalles Footer */
            .kb-footer {
                display: flex;
                justify-content: space-between;
                font-size: 0.6rem;
                margin-top: auto;
                padding-top: 0.5rem;
                border-top: 1px solid var(--k-border);
            }
            .kb-label { color: var(--k-text-muted); font-weight: 500; font-size: 0.6rem; }
            .kb-value { font-weight: 600; }
            .kb-exec { color: var(--k-success); }
            .kb-rem { color: var(--k-primary); }

            /* Colores de estado para la barra y badge (Inyectados por JS) */
            .bg-success { background-color: var(--k-success) !important; }
            .bg-warning { background-color: var(--k-warning) !important; }
            .bg-danger { background-color: var(--k-danger) !important; }

            /* Secciones de Gráficos y Listas */
            .chart-container {
                background: var(--k-bg-card);
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-lg);
                padding: 1.5rem;
                box-shadow: var(--k-shadow-sm);
                min-height: 350px;
                display: flex;
                flex-direction: column;
            }
            .chart-container h3 {
                margin-top: 0;
                margin-bottom: 1rem;
                font-size: 1.1rem;
                color: var(--k-text-main);
            }

            .submodules-container {
                background: var(--k-bg-card);
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-lg);
                padding: 1.5rem;
                box-shadow: var(--k-shadow-sm);
            }
            .submodules-container h3 {
                margin-top: 0;
                margin-bottom: 1rem;
                font-size: 1.1rem;
                color: var(--k-text-main);
                padding-bottom: 1rem;
                border-bottom: 1px solid var(--k-border);
            }
            .submodules-list {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 1rem;
            }
            .submodule-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 1rem;
                background-color: #fcfcfc;
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-md);
                transition: all 0.2s ease;
            }
            .submodule-item:hover {
                background-color: var(--k-primary-light);
                border-color: var(--k-primary);
                transform: translateX(5px);
            }
            .submodule-info { flex: 1; margin-right: 1rem; }
            .submodule-name { font-weight: 600; color: var(--k-text-main); font-size: 0.95rem; }
            .submodule-meta { font-size: 0.8rem; color: var(--k-text-muted); margin-top: 0.2rem; }
            .btn-ingresar {
                background-color: var(--k-primary);
                color: white;
                border: none;
                padding: 0.5rem 1.25rem;
                border-radius: var(--k-radius-md);
                font-weight: 500;
                cursor: pointer;
                transition: background 0.2s;
                white-space: nowrap;
            }
            .btn-ingresar:hover { background-color: var(--k-primary-hover); }

            /* Grid para contenido inferior */
            .content-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 1.5rem;
            }

            /* =========================================
               ANULAR ESTILOS GLOBALES (styles.css)
               Los estilos globales con !important están
               causando espacio excesivo entre widgets y gráficas
               ========================================= */
            .gestion-integral-home .widget {
                margin-bottom: 0 !important;
                padding: 1rem !important;
            }

            .gestion-integral-home .widgets-container {
                margin-bottom: 0 !important;
                gap: 1rem;
            }

            .gestion-integral-home .chart-card {
                margin-top: 0 !important;
                margin-bottom: 0 !important;
                padding: 0.75rem !important;
            }

            .gestion-integral-home .charts-grid {
                margin-top: 0 !important;
            }

/* Layout Grid para los Gráficos - RESPONSIVE */
.charts-grid {
display: grid;
grid-template-columns: 1fr 1fr 1fr;
grid-template-rows: auto;
gap: 0.75rem;
margin-bottom: 0.5rem;
}

            .chart-card {
                background: var(--k-bg-card);
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-lg);
                padding: 0.75rem;
                box-shadow: var(--k-shadow-sm);
                min-width: 0; /* Prevenir desbordamiento */
            }



            .chart-title {
                font-size: 1.1rem; font-weight: 600; color: var(--k-text-main);
                margin-bottom: 0.5rem; display: flex; justify-content: space-between;
            }

            /* Canvas Container - RESPONSIVE */
            .canvas-container {
                position: relative;
                width: 100%;
                height: 260px; /* Altura base para desktop */
                min-height: 200px;
            }

            /* =========================================
               TEMA OSCURO (MODO SYSTEM/DARK)
               ========================================= */
            [data-theme="dark"] .gestion-integral-home {
                --k-primary: #4da6ff;
                --k-primary-hover: #66b3ff;
                --k-primary-light: rgba(77, 166, 255, 0.15);
                --k-success: #5cb85c;
                --k-success-light: rgba(92, 184, 92, 0.15);
                --k-warning: #f0ad4e;
                --k-warning-light: rgba(240, 173, 78, 0.15);
                --k-danger: #d9534f;
                --k-danger-light: rgba(217, 83, 79, 0.15);
                --k-bg-app: #1a202c;
                --k-bg-card: #2d3748;
                --k-border: #4a5568;
                --k-text-main: #e9ecef;
                --k-text-muted: #adb5bd;
                --k-shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.3);
                --k-shadow-md: 0 0.5rem 1rem rgba(0, 0, 0, 0.4);
            }

            /* =========================================
               TEMA OSCURO (DARK-LEGACY - PALETA NEGRO/GRIS)
               ========================================= */
            [data-theme="dark-legacy"] .gestion-integral-home {
                --k-primary: #9e9e9e;
                --k-primary-hover: #bdbdbd;
                --k-primary-light: rgba(158, 158, 158, 0.15);
                --k-success: #4caf50;
                --k-success-light: rgba(76, 175, 80, 0.15);
                --k-warning: #ff9800;
                --k-warning-light: rgba(255, 152, 0, 0.15);
                --k-danger: #f44336;
                --k-danger-light: rgba(244, 67, 54, 0.15);
                --k-bg-app: #121212;
                --k-bg-card: #1e1e1e;
                --k-border: #404040;
                --k-text-main: #e0e0e0;
                --k-text-muted: #a0a0a0;
                --k-shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.6);
                --k-shadow-md: 0 0.5rem 1rem rgba(0, 0, 0, 0.8);
            }

@media (max-width: 992px) {
.charts-grid { grid-template-columns: 1fr; }
.canvas-container { height: 240px; }
}

            @media (max-width: 768px) {
                .gestion-integral-home { padding: 1rem; }
                .widgets-container { grid-template-columns: 1fr; }
                .canvas-container { height: 250px; }
                .chart-card { padding: 1rem; }
                .submodules-list { grid-template-columns: 1fr; }
            }

            @media (max-width: 576px) {
                .k-module-title { font-size: 1rem; }
                .kb-amount { font-size: 1.5rem; }
                .canvas-container { height: 220px; }
                .widget-value { font-size: 1.5rem; }
            }
        `;
        document.head.appendChild(style);
    }

    async renderMainArea(container) {
        // 📦494-fix — cargar datos PRIMERO con el skeleton todavía visible.
        // Ahora limpiamos recién cuando los datos ya están.
        if (!this.resourceStats || Object.keys(this.resourceStats).length === 0) {
            await this.loadResourceStats();
        }

        // 📦762 — cargar también los datos mensuales de presupuesto para el chart SVG.
        // createBudgetWidget es un async que tiene como side-effect poblar this.budgetData.mensual.
        if (!this.budgetData || this.budgetData.company !== this.currentCompany) {
            // Llamamos solo por su side-effect; el widget devuelto se descarta (será GC).
            await this.createBudgetWidget();
        }

        // 📦494-fix — limpiar skeleton ahora que los datos están listos
        container.innerHTML = '';

        // Rediseño premium: 1 hero + 3 metrics + 1 chart SVG + radar + submódulos
        const stats = this.resourceStats || {};
        const inducciones = stats.inducciones || {};
        const capacitaciones = stats.capacitaciones || {};
        const presupuestoData = this.budgetData && this.budgetData.mensual
            ? this.budgetData.mensual
            : { planeado: Array(12).fill(0), ejecutado: Array(12).fill(0) };
        const totalPlaneado = presupuestoData.planeado.reduce(function (a, b) { return a + b; }, 0);
        const totalEjecutado = presupuestoData.ejecutado.reduce(function (a, b) { return a + b; }, 0);
        // cumplimientoPresupuesto: dato específico de la card "Presupuesto"
        const cumplimientoPresupuesto = totalPlaneado > 0 ? Math.round((totalEjecutado / totalPlaneado) * 100) : 0;

        // 📦730 · cumplimientoGeneral: score compuesto del módulo.
        // Promedio simple de los % disponibles. Excluye componentes sin datos
        // (no penaliza con 0 un componente no cargado aún).
        const copasst = stats.copasst || {};
        const comite = stats.comite_convivencia || {};
        const epps = stats.epps || {};
        const afiliacion = stats.afiliacion || {};
        const compInducciones = inducciones.totalTrabajadores > 0 ? (inducciones.porcentajeCompletado || 0) : null;
        const compCapacitaciones = capacitaciones.programadas > 0 ? (capacitaciones.porcentajeCumplimiento || 0) : null;
        const compPresupuesto = totalPlaneado > 0 ? cumplimientoPresupuesto : null;
        const compCopasst = copasst.actaMesEnCurso ? 100 : 0;        // binario mensual
        const compComite = comite.actaMesEnCurso ? 100 : 0;           // binario mensual
        const compAfiliacion = afiliacion.estado === 'ok' ? 100 : (afiliacion.estado ? 0 : null); // null si no hay dato
        const compGeneralArr = [compInducciones, compCapacitaciones, compPresupuesto, compCopasst, compComite, compAfiliacion]
            .filter(function (v) { return v !== null; });
        const cumplimientoGeneral = compGeneralArr.length > 0
            ? Math.round(compGeneralArr.reduce(function (a, b) { return a + b; }, 0) / compGeneralArr.length)
            : 0;

        // 1) HERO STRIP
        const health = document.createElement('section');
        health.className = 'kair-health';

        const hero = document.createElement('article');
        hero.className = 'kair-hero-card';
        const heroMsg = cumplimientoGeneral >= 80
            ? 'Tu sistema va por buen camino.'
            : cumplimientoGeneral >= 50
                ? 'Hay áreas que necesitan atención este mes.'
                : 'Atención: hay actividades críticas pendientes.';
        // 📦730 · Tareas pendientes: ahora incluye TODOS los pendientes del módulo
        // (inducciones, capacitaciones, EPPs, actas COPASST/Comite, afiliación)
        const tareasPendientes = (inducciones.pendientes || 0) +
            (capacitaciones.programadas && capacitaciones.realizadas !== undefined
                ? Math.max(0, capacitaciones.programadas - capacitaciones.realizadas)
                : 0) +
            (epps.pendientes || 0) +
            (copasst.actaMesEnCurso ? 0 : 1) +
            (comite.actaMesEnCurso ? 0 : 1) +
            (afiliacion.estado && afiliacion.estado !== 'ok' ? 1 : 0);
        hero.innerHTML = ''
            + '<div class="kair-hero-eyebrow">Estado general</div>'
            + '<h2>' + heroMsg + '</h2>'
            + '<p class="kair-hero-msg">Hay ' + tareasPendientes + ' actividades que necesitan atención este mes.</p>'
            + '<div class="kair-hero-score">' + cumplimientoGeneral + '%<span>cumplimiento</span></div>';
        health.appendChild(hero);

        const induccionesPct = inducciones.porcentajeCompletado || 0;
        const capacitacionesPct = capacitaciones.porcentajeCumplimiento || 0;
        health.appendChild(this.renderMetricCard({
            label: 'Inducciones',
            valueHTML: (inducciones.completadas || 0) + ' <small style="font:500 15px DM Sans;color:#8791a1">/ ' + (inducciones.totalTrabajadores || 0) + '</small>',
            desc: 'Personal con inducción al día',
            progressPct: induccionesPct,
            variant: induccionesPct >= 70 ? 'ok' : induccionesPct >= 40 ? 'warning' : 'danger'
        }));
        health.appendChild(this.renderMetricCard({
            label: 'Plan de capacitación',
            valueHTML: (capacitaciones.realizadas || 0) + ' <small style="font:500 15px DM Sans;color:#8791a1">/ ' + (capacitaciones.programadas || 0) + '</small>',
            desc: 'Actividades ejecutadas',
            progressPct: capacitacionesPct,
            variant: capacitacionesPct >= 70 ? 'ok' : capacitacionesPct >= 40 ? 'warning' : 'danger'
        }));
        health.appendChild(this.renderMetricCard({
            label: 'Presupuesto',
            valueHTML: cumplimientoPresupuesto.toFixed(1) + '<span style="font:600 16px DM Sans">%</span>',
            desc: 'Ejecución presupuestal acumulada',
            progressPct: cumplimientoPresupuesto,
            variant: cumplimientoPresupuesto >= 70 ? 'ok' : cumplimientoPresupuesto >= 40 ? 'warning' : 'danger'
        }));
        container.appendChild(health);

        // 2) CONTENT GRID: chart + radar
        const content = document.createElement('section');
        content.className = 'kair-content';

        const chartCard = document.createElement('article');
        chartCard.className = 'kair-card';
        chartCard.innerHTML = ''
            + '<div class="kair-card-head">'
            + '  <div>'
            + '    <h3>Ejecución presupuestal</h3>'
            + '    <div class="kair-card-hint">Acumulado anual · presupuesto vs. ejecución real</div>'
            + '  </div>'
            + '</div>'
            + '<div class="kair-chart" id="kair-chart-presupuesto"></div>'
            + '<div class="kair-legend">'
            + '  <span><i class="kair-dot"></i>Ejecutado real</span>'
            + '  <span><i class="kair-dot" style="background:#d4dae3"></i>Planeado</span>'
            + '</div>';
        content.appendChild(chartCard);

        const radar = document.createElement('article');
        radar.className = 'kair-card';
        radar.innerHTML = ''
            + '<div class="kair-row-title">'
            + '  <div>'
            + '    <h3>En tu radar</h3>'
            + '    <div class="kair-card-hint">Requieren gestión este mes</div>'
            + '  </div>'
            + '</div>'
            + this.buildRadarTasks();
        content.appendChild(radar);
        container.appendChild(content);

        // 3) SUBMÓDULOS
        const modules = document.createElement('section');
        modules.className = 'kair-modules';
        const modulesCard = document.createElement('article');
        modulesCard.className = 'kair-card';
        modulesCard.innerHTML = ''
            + '<div class="kair-card-head">'
            + '  <div>'
            + '    <h3>Explorar submódulos</h3>'
            + '    <div class="kair-card-hint">Gestiona la documentación y evidencias de tu sistema.</div>'
            + '  </div>'
            + '  <button class="kair-btn kair-btn-ghost">Ver todos</button>'
            + '</div>'
            + '<div class="kair-module-grid" id="kair-submodules-grid"></div>';
        modules.appendChild(modulesCard);
        container.appendChild(modules);

        // Renderizar chart SVG y submódulos (data-driven, después del DOM)
        this.renderChartPresupuesto(presupuestoData);
        this.renderSubmodulesGrid();
    }

    renderMetricCard(opts) {
        var label = opts.label;
        var valueHTML = opts.valueHTML;
        var desc = opts.desc;
        var progressPct = opts.progressPct;
        var variant = opts.variant;
        var card = document.createElement('article');
        card.className = 'kair-metric-card' + (variant && variant !== 'ok' ? ' kair-metric-card--' + variant : '');
        card.innerHTML = ''
            + '<span class="kair-metric-head">' + label + '</span>'
            + '<div class="kair-metric-value">' + valueHTML + '</div>'
            + '<p class="kair-metric-desc">' + desc + '</p>'
            + '<div class="kair-progress"><i style="width:' + Math.min(100, progressPct) + '%"></i></div>';
        return card;
    }

    buildRadarTasks() {
        var stats = this.resourceStats || {};
        var tareas = [];
        var copasst = stats.copasst || {};
        if (copasst.estado === 'warn' || copasst.estado === 'danger') {
            tareas.push({
                icon: '◷', bg: '#eff7f5', color: '#178666',
                title: 'Actas COPASST',
                sub: (copasst.actasAnio || 0) + ' de 12 reuniones registradas',
                status: 'Pendiente', statusClass: 'kair-status-pill--warn'
            });
        }
        var afiliacion = stats.afiliacion || {};
        if (afiliacion.estado === 'warn' || afiliacion.estado === 'danger') {
            tareas.push({
                icon: '◷', bg: '#fff5e6', color: '#c28316',
                title: 'Afiliación a SSSI',
                sub: 'Aún no hay planillas cargadas',
                status: 'Pendiente', statusClass: 'kair-status-pill--warn'
            });
        }
        var inducciones = stats.inducciones || {};
        // 📦730 · Reemplazado por Comité de Convivencia (inducciones ya se muestra en su card dedicada)
        var comite = stats.comite_convivencia || {};
        if (comite.estado === 'warn' || comite.estado === 'danger') {
            tareas.push({
                icon: '◷', bg: '#f0eaff', color: '#6b3fb8',
                title: 'Actas Comité de Convivencia',
                sub: (comite.actasAnio || 0) + ' de 12 reuniones registradas',
                status: 'Pendiente', statusClass: 'kair-status-pill--warn'
            });
        }
        if (tareas.length === 0) {
            tareas.push({
                icon: '✓', bg: '#e9f3ff', color: '#2057b8',
                title: 'Sistema estable',
                sub: 'Sin alertas pendientes este mes',
                status: 'Al día', statusClass: 'kair-status-pill--ok'
            });
        }
        var html = '';
        for (var i = 0; i < tareas.length && i < 3; i++) {
            var t = tareas[i];
            html += ''
                + '<div class="kair-task">'
                + '  <div class="kair-task-icon" style="background:' + t.bg + ';color:' + t.color + '">' + t.icon + '</div>'
                + '  <div>'
                + '    <strong>' + t.title + '</strong>'
                + '    <small>' + t.sub + '</small>'
                + '  </div>'
                + '  <span class="kair-status-pill ' + t.statusClass + '">' + t.status + '</span>'
                + '</div>';
        }
        return html;
    }

    renderChartPresupuesto(data) {
        var el = document.getElementById('kair-chart-presupuesto');
        if (!el) return;
        var labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        var W = 690, H = 220;
        var PAD_L = 30, PAD_R = 10, PAD_T = 10, PAD_B = 20;
        var maxArr = data.planeado.concat(data.ejecutado);
        var maxVal = Math.max.apply(null, maxArr.concat([1]));
        function xi(i) { return PAD_L + (i / 11) * (W - PAD_L - PAD_R); }
        function yv(v) { return PAD_T + (1 - v / maxVal) * (H - PAD_T - PAD_B); }
        // 📦763-fix — usar L (line-to, 1 par de coords) en lugar de C (cubic bezier, 3 pares).
        // C sin los 6 números causa el error SVG: "Expected number, …C148.18…".
        function pathFor(arr) {
            var p = '';
            for (var i = 0; i < arr.length; i++) {
                p += (i === 0 ? 'M ' : ' L ') + xi(i).toFixed(2) + ' ' + yv(arr[i]).toFixed(2);
            }
            return p;
        }
        var planeadoPath = pathFor(data.planeado);
        var ejecutadoPath = pathFor(data.ejecutado);
        var labelSvg = '';
        for (var i = 0; i < labels.length; i++) {
            labelSvg += '<text x="' + xi(i).toFixed(2) + '" y="' + (H - 4) + '" text-anchor="middle">' + labels[i] + '</text>';
        }
        el.innerHTML = ''
            + '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">'
            + '  <defs>'
            + '    <linearGradient id="kair-grad" x1="0" x2="0" y1="0" y2="1">'
            + '      <stop offset="0" stop-color="#2057b8" stop-opacity=".18"/>'
            + '      <stop offset="1" stop-color="#2057b8" stop-opacity="0"/>'
            + '    </linearGradient>'
            + '  </defs>'
            + '  <path d="' + planeadoPath + ' L ' + W + ' ' + H + ' L 0 ' + H + ' Z" fill="none" stroke="#d4dae3" stroke-width="3" stroke-dasharray="5 7"/>'
            + '  <path d="' + ejecutadoPath + ' L ' + W + ' ' + H + ' L 0 ' + H + ' Z" fill="url(#kair-grad)"/>'
            + '  <path d="' + ejecutadoPath + '" fill="none" stroke="#2057b8" stroke-width="3.5"/>'
            + '  <g font-family="DM Sans" font-size="10" fill="#aab1bd">' + labelSvg + '</g>'
            + '</svg>';
    }

    renderSubmodulesGrid() {
        var grid = document.getElementById('kair-submodules-grid');
        if (!grid) return;
        // 📦730 · Mostrar TODOS los submódulos del módulo (no solo los primeros 6).
        // El grid CSS responsivo (auto-fill + minmax) se ajusta solo.
        var items = this.submodules || [];
        var html = '';
        for (var i = 0; i < items.length; i++) {
            var name = items[i];
            var m = name.match(/^(\d+\.\d+\.\d+)/);
            var codeStr = m ? m[1] : String(i + 1);
            var cleanName = name.replace(/^\d+\.\d+\.\d+\s*/, '');
            html += ''
                + '<div class="kair-module" data-submodule="' + name + '">'
                + '  <span class="kair-module-n">' + codeStr + '</span>'
                + '  <strong>' + cleanName + '</strong>'
                + '  <small>Gestión y control</small>'
                + '  <span class="kair-module-arrow">→</span>'
                + '</div>';
        }
        grid.innerHTML = html;
        var els = grid.querySelectorAll('.kair-module');
        for (var j = 0; j < els.length; j++) {
            (function (el) {
                el.onclick = function () { self_handle(this, el); };
            })(els[j]);
        }
        var self = this;
        function self_handle(el) {
            self.handleSubmoduleClick(el.dataset.submodule);
        }
    }


    // Nuevo método para cargar estadísticas reales de recursos
    async loadResourceStats() {
        try {
            console.log('🔄 [RecursosHome] Cargando estadísticas reales de recursos para:', this.currentCompany);

            // Inicializar estructura base
            this.resourceStats = {
                inducciones: { totalTrabajadores: 0, totalInducciones: 0, completadas: 0, pendientes: 0, porcentajeCompletado: 0, mensual: new Array(12).fill(0), mensualApproved: new Array(12).fill(0) },
                capacitaciones: { totalCapacitaciones: 0, programadas: 0, realizadas: 0, porcentajeCumplimiento: 0, mensual: { programadas: new Array(12).fill(0), realizadas: new Array(12).fill(0) } },
                epps: { totalEPPs: 0, entregados: 0, pendientes: 0, stockActual: 0 },
                copasst: { totalActas: 0, actaMesEnCurso: false, ultimoMesRegistrado: null, actasAnio: 0, estado: 'ok', alertas: [] },
                comite_convivencia: { totalActas: 0, actaMesEnCurso: false, ultimoMesRegistrado: null, actasAnio: 0, estado: 'ok', alertas: [] },
                afiliacion: { totalPlanillas: 0, planillaMesEnCurso: false, ultimoMesRegistrado: null, estado: 'ok', alertas: [] }
            };

            // 1. Cargar Estadísticas Generales (Backend) - Para Inducciones, EPPs, COPASST y Comité de Convivencia
            if (window.electronAPI && window.electronAPI.getRecursosStats) {
                const result = await window.electronAPI.getRecursosStats(this.currentCompany);
                if (result.success) {
                    this.resourceStats = { ...this.resourceStats, ...result.stats };
                    console.log('✅ [RecursosHome] Estadísticas generales cargadas (Backend).');
                }
            }

            // 2. CALCULAR CAPACITACIONES (CLIENT-SIDE) - Lógica espejo del submódulo
            // Esto sobrescribe lo que venga del backend para Capacitaciones con la lógica exacta del visor
            await this.calculateCapacitacionesClientSide();

            // 3. VERIFICAR AFILIACIÓN SSSI (CLIENT-SIDE) - Lógica espejo del backend
            await this.calculateAfiliacionClientSide();

            // LOG DE DEPURACIÓN: Resumen de estadísticas cargadas
            console.log('[RESUMEN RECURSOS] 📊 Estadísticas cargadas:', {
                inducciones: this.resourceStats.inducciones,
                capacitaciones: this.resourceStats.capacitaciones,
                epps: this.resourceStats.epps,
                copasst: this.resourceStats.copasst,
                comite_convivencia: this.resourceStats.comite_convivencia,
                afiliacion: this.resourceStats.afiliacion
            });

        } catch (error) {
            console.error('❌ [RecursosHome] Error al cargar estadísticas de recursos:', error);
        }
    }

    // Lógica portada de CapacitacionesComponent para asegurar consistencia
    async calculateCapacitacionesClientSide() {
        try {
            console.log('📊 [RecursosHome] Calculando estadísticas de Capacitaciones (Cliente)...');
            console.log('🏢 [RecursosHome] Empresa actual:', this.currentCompany);

            // A. Buscar ruta del submódulo
            const submodulePathResult = await window.electronAPI.findSubmodulePath(this.currentCompany, 'Recursos', '1.2.1 Programa de capacitación Anual');
            if (!submodulePathResult.success) {
                console.warn('⚠️ [RecursosHome] Ruta del submódulo no encontrada');
                return;
            }
            const submodulePath = submodulePathResult.path;
            console.log('📂 [RecursosHome] Ruta del submódulo:', submodulePath);

            // B. Buscar TODOS los archivos en la carpeta
            const filesResult = await window.electronAPI.readDirectory(submodulePath);
            if (!filesResult.success) {
                console.warn('⚠️ [RecursosHome] No se pudo leer directorio de capacitaciones');
                return;
            }

            const allFiles = filesResult.files || [];
            console.log(`📁 [RecursosHome] Total archivos en carpeta: ${allFiles.length}`);
            allFiles.forEach((f, i) => {
                const fname = f.name || (f.path ? f.path.split(/[/\\]/).pop() : 'unknown');
                console.log(`   [${i}] ${fname}`);
            });

            // 🔍 PASO 1: FILTRAR SOLO ARCHIVOS CON "CRONOGRAMA" EN EL NOMBRE
            const cronogramaFiles = allFiles.filter(item => {
                const name = (item.name || item.path || '').toLowerCase();
                const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
                const notTemp = !name.startsWith('~$');
                const hasCronograma = name.includes('cronograma');
                
                console.log(`🔍 "${name}" | ¿Excel?: ${isExcel} | ¿Cronograma?: ${hasCronograma}`);
                
                return hasCronograma && isExcel && notTemp;
            });

            console.log(`✅ [RecursosHome] Archivos con "CRONOGRAMA": ${cronogramaFiles.length}`);
            cronogramaFiles.forEach((f, i) => {
                const fname = f.name || (f.path ? f.path.split(/[/\\]/).pop() : 'unknown');
                console.log(`   [${i}] ✅ ${fname}`);
            });

            // Si hay archivos con "cronograma", usar SOLO esos
            const excelFiles = cronogramaFiles.length > 0 ? cronogramaFiles : allFiles.filter(item => {
                const name = (item.name || item.path || '').toLowerCase();
                const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
                const notTemp = !name.startsWith('~$');
                return isExcel && notTemp;
            });

            if (excelFiles.length === 0) {
                console.warn('⚠️ [RecursosHome] No se encontró NINGÚN archivo Excel');
                return;
            }

            // 🎯 SELECCIÓN: Si hay cronogramas, buscar por año
            const currentYear = new Date().getFullYear(); // 2026
            const previousYear = currentYear - 1; // 2025

            console.log(`📅 [RecursosHome] Años: ${currentYear} (prioritario), ${previousYear} (fallback)`);

            let selectedFile = null;

            if (cronogramaFiles.length > 0) {
                console.log('🎯 [RecursosHome] Buscando CRONOGRAMA con año...');
                
                // 1. Cronograma con año actual
                selectedFile = cronogramaFiles.find(f => {
                    const name = (f.name || '').toLowerCase();
                    return name.includes(currentYear.toString());
                });

                // 2. Cronograma con año anterior
                if (!selectedFile) {
                    selectedFile = cronogramaFiles.find(f => {
                        const name = (f.name || '').toLowerCase();
                        return name.includes(previousYear.toString());
                    });
                    if (selectedFile) {
                        console.log(`📄 [RecursosHome] Usando cronograma ${previousYear}`);
                    }
                }

                // 3. Cualquier cronograma
                if (!selectedFile) {
                    selectedFile = cronogramaFiles[0];
                    console.log('📄 [RecursosHome] Usando primer cronograma disponible');
                }
            } else {
                console.warn('⚠️ [RecursosHome] NO hay archivos con "cronograma"');
                console.log('💡 Renombrar archivo a "CRONOGRAMA DE CAPACITACIONES 2025.xlsx"');
                selectedFile = excelFiles[0];
            }

            const fileName = selectedFile.name || (selectedFile.path ? selectedFile.path.split(/[/\\]/).pop() : 'archivo.xlsx');
            const filePath = `${submodulePath}/${fileName}`;
            console.log(`✅✅✅ [RecursosHome] ARCHIVO SELECCIONADO: ${fileName}`);

            // C. Leer hojas
            console.log('🔍 [RecursosHome] Leyendo hojas...');
            const sheetsResult = await window.electronAPI.getCapacitacionesSheets(filePath);
            if (!sheetsResult.success) {
                console.error('❌ [RecursosHome] Error leyendo hojas:', sheetsResult.error);
                this.resourceStats.capacitaciones = {
                    ...this.resourceStats.capacitaciones,
                    error: 'Error leyendo archivo',
                    hasDataForCurrentYear: false
                };
                return;
            }

            console.log(`📋 [RecursosHome] Hojas (${sheetsResult.sheets.length}):`, sheetsResult.sheets.join(', '));

            // VALIDAR QUE TENGA HOJAS
            if (!sheetsResult.sheets || sheetsResult.sheets.length === 0) {
                console.error('❌ [RecursosHome] El archivo NO tiene hojas');
                this.resourceStats.capacitaciones = {
                    ...this.resourceStats.capacitaciones,
                    error: 'Archivo sin hojas válidas',
                    hasDataForCurrentYear: false
                };
                return;
            }

            // Procesar archivo
            return this.processCapacitacionesFile(filePath, sheetsResult.sheets, currentYear, previousYear);

        } catch (error) {
            console.error('❌ [RecursosHome] Error calculando capacitaciones:', error);
        }
    }

    // Método auxiliar para procesar archivo de capacitaciones
    async processCapacitacionesFile(filePath, availableSheets, currentYear, previousYear) {
        console.log(`📅 [RecursosHome] Buscando hoja para año: ${currentYear} (fallback: ${previousYear})`);

        // 🔍 BÚSQUEDA FLEXIBLE DE HOJAS
        // Intenta múltiples variaciones
        let sheetName = null;

        // 1. Buscar hoja con "matriz cap" y año actual
        sheetName = availableSheets.find(s =>
            s.toLowerCase().includes('matriz cap') && s.includes(currentYear.toString())
        );
        
        // 2. Buscar hoja con año actual (cualquier nombre)
        if (!sheetName) {
            sheetName = availableSheets.find(s => s.includes(currentYear.toString()));
        }
        
        // 3. Buscar hoja con "matriz cap" y año anterior (fallback)
        if (!sheetName) {
            sheetName = availableSheets.find(s => 
                s.toLowerCase().includes('matriz cap') && s.includes(previousYear.toString())
            );
            if (sheetName) {
                console.log('📄 [RecursosHome] Usando hoja del año anterior:', sheetName);
            }
        }
        
        // 4. Buscar hoja con año anterior (cualquier nombre)
        if (!sheetName) {
            sheetName = availableSheets.find(s => s.includes(previousYear.toString()));
        }
        
        // 5. Fallback: usar la primera hoja que no sea "inicio" o similar
        if (!sheetName) {
            sheetName = availableSheets.find(s => 
                !s.toLowerCase().includes('inicio') && 
                !s.toLowerCase().includes('portada') &&
                !s.toLowerCase().includes('indice')
            );
        }
        
        // 6. Último fallback: usar la primera hoja disponible
        if (!sheetName && availableSheets.length > 0) {
            sheetName = availableSheets[0];
            console.log('⚠️ [RecursosHome] Usando primera hoja disponible como fallback:', sheetName);
        }

        // 🔒 VALIDACIÓN: Si no hay hoja, reportar error
        if (!sheetName) {
            console.warn(`⚠️ [RecursosHome] No se encontró ninguna hoja válida en el Excel`);
            this.resourceStats.capacitaciones = {
                ...this.resourceStats.capacitaciones,
                error: `No hay hojas válidas en el archivo`,
                hasDataForCurrentYear: false
            };
            return;
        }

        console.log('✅ [RecursosHome] Hoja seleccionada:', sheetName);

        // D. Leer Datos y Procesar
        const excelResult = await window.electronAPI.initExcel({ filePath, sheetName });
        if (!excelResult.success) {
            console.warn('⚠️ [RecursosHome] Error al inicializar Excel');
            return;
        }

        const { processedData } = excelResult.data;
        const dataRows = processedData;

        // --- LÓGICA DE CONTEO AJUSTADA (Alineada con getCapacitacionesChartDataForGraph) ---
        const stats = {
            totalCapacitaciones: 0,
            programadas: 0,
            realizadas: 0,
            porcentajeCumplimiento: 0,
            mensual: { programadas: new Array(12).fill(0), realizadas: new Array(12).fill(0) }
        };

        console.groupCollapsed('🔍 [RecursosHome] Procesamiento de filas detallado');

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (!Array.isArray(row) || row.length < 2) continue;

            // Helper para extraer valor de celda (Maneja objetos/texto)
            const getVal = (cell) => {
                if (cell === null || cell === undefined) return '';
                if (typeof cell === 'object' && cell.value !== undefined) return String(cell.value);
                return String(cell);
            };

            // Alineación de columnas con getCapacitacionesChartDataForGraph:
            // Columna 1 (B) -> Nombre (Índice 1)
            // Columna 3 (D) -> Fecha Programada (Índice 3)
            // Columna 9 (J) -> Indicador de realización (Índice 9 y otros)

            const nombre = getVal(row[1]).trim(); // Índice 1: Nombre
            const nombreLower = nombre.toLowerCase();

            // 1. Filtros de Encabezados y Basura
            if (!nombre || nombre.length < 3) continue; // Muy corto
            if (nombreLower.includes('nombre de la') || nombreLower === 'contenido de la capacitación') {
                console.log(`Skipping Header Row ${i}: ${nombre}`);
                continue;
            }

            // 2. Filtro de Totalizador (Break)
            if (nombreLower.includes('total capacitaciones') || nombreLower.includes('total')) {
                console.log(`Break at Row ${i}: ${nombre} (Totalizador detectado)`);
                break;
            }

            // 3. Validación Adicional: Debe tener fecha o tipo para ser real
            const fechaRaw = row[3]; // Índice 3: Fecha
            const tipoRaw = getVal(row[2]); // Índice 2: Tipo (opcional para validación)

            // Si no tiene fecha Y no tiene tipo, probablemente es basura
            // (Aunque getCapacitacionesChartDataForGraph usa fechaRaw del índice 3 principalmente)
            
            // --- PROCESAMIENTO ---

            // Incrementar total capacitaciones
            stats.totalCapacitaciones++;

            // FECHA: Columna 3 (D) - Verificar si tiene fecha válida
            let monthIndex = -1;
            let fechaValida = false;

            if (typeof fechaRaw === 'number' && fechaRaw > 1000) {
                 const dateCode = new Date((fechaRaw - 25569) * 86400 * 1000);
                 monthIndex = dateCode.getMonth();
                 fechaValida = true;
            } else {
                const fStr = getVal(fechaRaw);
                if (fStr && fStr !== 'No especificada' && fStr !== '') {
                    // Intentar parsear fecha dd/mm/yyyy o mm/dd/yyyy
                    const parts = fStr.split('/');
                    if (parts.length === 3) {
                        monthIndex = parseInt(parts[0]) - 1; // Asumiendo mm/dd/yyyy por consistencia, pero revisando logs podría ser dd/mm
                        // Si el mes > 11, invertir lógica (dd/mm/yyyy)
                         if (monthIndex > 11) {
                            monthIndex = parseInt(parts[1]) - 1;
                        }
                        fechaValida = true;
                    } else {
                        const d = new Date(fStr);
                        if (!isNaN(d.getTime())) {
                            monthIndex = d.getMonth();
                            fechaValida = true;
                        }
                    }
                }
            }

            // Solo incrementar programadas si tiene fecha válida
            if (fechaValida) {
                stats.programadas++;
            } else {
                console.log(`ℹ️ Fila ${i}: "${nombre}" tiene nombre pero no fecha válida (${getVal(fechaRaw)}), no se cuenta como programada`);
            }

            // ESTADO: Verificar múltiples columnas posibles para determinar si está realizada
            const estadoColumnas = [9, 8, 7, 10, 11, 6]; // J, I, H, K, L, G
            let estadoRaw = '';

            for (const colIndex of estadoColumnas) {
                if (colIndex < row.length) {
                    const cellValue = getVal(row[colIndex]);
                    if (cellValue && cellValue.toString().trim() !== '') {
                        estadoRaw = cellValue;
                        break;
                    }
                }
            }

            const estadoNorm = (estadoRaw || '').toString().toLowerCase().trim();

            // Es realizada si dice "100", "ejecutada", "realizada", ...
            const isRealizada = estadoNorm.includes('100') ||
                                estadoNorm.includes('realizada') ||
                                estadoNorm.includes('ejecutada') ||
                                estadoNorm.includes('completada') ||
                                estadoNorm.includes('completadas') ||
                                estadoNorm.includes('cumplida') ||
                                estadoNorm.includes('si') ||
                                estadoNorm.includes('sí') ||
                                estadoNorm.includes('ok') ||
                                estadoNorm.includes('true') ||
                                estadoNorm.includes('activo') ||
                                estadoNorm.includes('aprobada') ||
                                estadoNorm.includes('exitosa') ||
                                estadoNorm.includes('1') ||
                                estadoNorm.includes('x') ||
                                estadoNorm.includes('v') ||
                                estadoNorm.includes('verdadero') ||
                                estadoNorm.includes('yes') ||
                                estadoNorm.includes('done') ||
                                estadoNorm.includes('completa') ||
                                estadoNorm.includes('finalizada') ||
                                estadoNorm.includes('terminada') ||
                                estadoNorm.includes('efectuada') ||
                                estadoNorm.includes('realizado') ||
                                estadoNorm.includes('ejecutado') ||
                                estadoNorm.includes('aplicada') ||
                                estadoNorm.includes('aplicado') ||
                                estadoNorm.includes('asistida') ||
                                estadoNorm.includes('asistieron') ||
                                estadoNorm.includes('asistencia') ||
                                estadoNorm.includes('participaron') ||
                                estadoNorm.includes('participación') ||
                                estadoNorm.includes('certificada') ||
                                estadoNorm.includes('certificado') ||
                                estadoNorm.includes('evaluada') ||
                                estadoNorm.includes('evaluado') ||
                                estadoNorm.includes('verificada') ||
                                estadoNorm.includes('verificado');

            // Actualizar conteo mensual solo si tiene fecha válida
            if (monthIndex >= 0 && monthIndex < 12 && fechaValida) {
                stats.mensual.programadas[monthIndex]++;
                if (isRealizada) {
                    stats.mensual.realizadas[monthIndex]++;
                }
            }

            console.log(`✅ Fila ${i}: "${nombre}" | Estado: "${estadoRaw}" -> ${isRealizada ? 'REALIZADA' : 'PENDIENTE'} | Fecha válida: ${fechaValida ? 'SÍ' : 'NO'}`);

            // Solo incrementar realizadas si la capacitación está marcada como realizada Y tiene fecha válida
            if (isRealizada && fechaValida) {
                stats.realizadas++;
            }
        }
        console.groupEnd();

        if (stats.programadas > 0) {
            stats.porcentajeCumplimiento = Math.round((stats.realizadas / stats.programadas) * 100);
        } else {
            stats.porcentajeCumplimiento = 0;
        }

        // Actualizar estado
        this.resourceStats.capacitaciones = stats;
        console.log('📊 [RecursosHome] Capacitaciones calculadas (Cliente):', stats);
    }

    // Nuevo método para verificar afiliación SSSI (Cliente-Side)
    async calculateAfiliacionClientSide() {
        try {
            console.log('📊 [RecursosHome] Verificando afiliación SSSI...');

            // A. Buscar ruta del submódulo
            const submodulePathResult = await window.electronAPI.findSubmodulePath(
                this.currentCompany, 'Recursos', '1.1.4 Afiliación al SSSI'
            );

            if (!submodulePathResult.success) {
                console.warn('⚠️ [RecursosHome] Ruta del submódulo de afiliación no encontrada');
                return;
            }

            const submodulePath = submodulePathResult.path;
            console.log('📂 [RecursosHome] Ruta de afiliación:', submodulePath);

            // B. Leer archivos en la carpeta
            const filesResult = await window.electronAPI.readDirectory(submodulePath);
            if (!filesResult.success) {
                console.warn('⚠️ [RecursosHome] No se pudo leer directorio de afiliación');
                return;
            }

            const allFiles = filesResult.files || [];
            console.log(`📁 [RecursosHome] Total archivos en afiliación: ${allFiles.length}`);

            // C. Filtrar solo planillas (PDF o Excel)
            const planillas = allFiles.filter(item => {
                const name = (item.name || item.path || '').toLowerCase();
                const isPDF = name.endsWith('.pdf');
                const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
                const notTemp = !name.startsWith('~$');
                const hasPlanilla = name.includes('planilla');

                return hasPlanilla && (isPDF || isExcel) && notTemp;
            });

            console.log(`✅ [RecursosHome] Planillas encontradas: ${planillas.length}`);
            planillas.forEach((f, i) => {
                const fname = f.name || (f.path ? f.path.split(/[/\\]/).pop() : 'unknown');
                console.log(`   [${i}] 📄 ${fname}`);
            });

            // D. Verificar mes en curso
            const currentMonth = new Date().getMonth();
            const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                                'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
            const currentMonthName = monthNames[currentMonth];

            let planillaEncontrada = false;
            let ultimoMes = null;
            let ultimoMesIndex = -1;

            planillas.forEach(f => {
                const name = (f.name || f.path || '').toLowerCase();
                console.log('🔍 [RecursosHome] Analizando archivo:', name);

                // Buscar patrones de mes en el nombre del archivo
                const monthMatch = name.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/);
                if (monthMatch) {
                    const mesEncontrado = monthMatch[1];
                    const monthIndex = monthNames.indexOf(mesEncontrado);

                    console.log(`🔍 [RecursosHome] Archivo: ${name}, Mes encontrado: ${mesEncontrado}`);

                    // Verificar si es el mes en curso
                    if (mesEncontrado === currentMonthName) {
                        planillaEncontrada = true;
                        console.log(`✅ [RecursosHome] Planilla del mes en curso (${currentMonthName}) encontrada`);
                    }

                    // Track del último mes encontrado
                    if (monthIndex > ultimoMesIndex) {
                        ultimoMes = mesEncontrado;
                        ultimoMesIndex = monthIndex;
                    }
                }
            });

            // E. Actualizar estado
            this.resourceStats.afiliacion = {
                totalPlanillas: planillas.length,
                planillaMesEnCurso: planillaEncontrada,
                ultimoMesRegistrado: ultimoMes,
                estado: planillaEncontrada ? 'ok' : 'danger'
            };

            console.log('📊 [RecursosHome] Afiliación SSSI:', this.resourceStats.afiliacion);
            console.log(`[AFILIACIÓN WIDGET] 📊 Datos para renderizar:`, {
                totalPlanillas: this.resourceStats.afiliacion.totalPlanillas,
                planillaMesEnCurso: this.resourceStats.afiliacion.planillaMesEnCurso,
                ultimoMesRegistrado: this.resourceStats.afiliacion.ultimoMesRegistrado,
                estado: this.resourceStats.afiliacion.estado,
                mesActual: monthNames[currentMonth],
                alertaActiva: !planillaEncontrada
            });

        } catch (error) {
            console.error('❌ [RecursosHome] Error calculando afiliación:', error);
        }
    }

    // Nuevo método para crear widget de inducciones con datos reales
    createInductionWidget() {
        const stats = this.resourceStats?.inducciones || {
            totalTrabajadores: 0,
            totalInducciones: 0,
            completadas: 0,
            pendientes: 0,
            porcentajeCompletado: 0,
            ultimoMesRegistrado: null
        };

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const currentMonthName = monthNames[currentMonth];

        // Usar totalTrabajadores como denominador (o fallback a totalInducciones si es 0)
        const totalTrabajadores = stats.totalTrabajadores || stats.totalInducciones;
        const completadas = stats.completadas || 0;
        const porcentajeProgreso = totalTrabajadores > 0 
            ? Math.min((completadas / totalTrabajadores) * 100, 100) 
            : 0;

        // Determinar color (semáforo)
        let colorVar = 'var(--k-success)';
        let colorClass = 'bg-success';
        if (porcentajeProgreso < 50) {
            colorVar = 'var(--k-danger)';
            colorClass = 'bg-danger';
        } else if (porcentajeProgreso < 80) {
            colorVar = 'var(--k-warning)';
            colorClass = 'bg-warning';
        }

        const w = document.createElement('div');
        w.className = 'widget k-budget-card';

        w.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">Inducciones</span>
                <span class="kb-badge ${colorClass}">${Math.round(porcentajeProgreso)}%</span>
            </div>

            <div class="kb-amount" style="font-size: 1.4rem;">${completadas} / ${totalTrabajadores}</div>
            <div class="kb-description">Trabajadores con inducción SST completada</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};">
                    <div class="kb-shimmer"></div>
                </div>
            </div>

            <div class="kb-footer">
                <div>
                    <div class="kb-label">Mes actual</div>
                    <div class="kb-value" style="color: ${colorVar}">${currentMonthName}</div>
                </div>
                <div style="text-align: right;">
                    <div class="kb-label">Último registro</div>
                    <div class="kb-value">${stats.ultimoMesRegistrado || 'N/A'}</div>
                </div>
            </div>
        `;

        // Animación de barra (después de insertar en DOM)
        setTimeout(() => {
            const bar = w.querySelector('.kb-progress-bar');
            if (bar) {
                bar.style.width = `${porcentajeProgreso}%`;
            }
        }, 100);

        return w;
    }

    // Nuevo método para crear widget de capacitaciones con datos reales
    createTrainingWidget() {
        // Usar los datos ya calculados en calculateCapacitacionesClientSide()
        const stats = this.resourceStats?.capacitaciones || { totalCapacitaciones: 0, programadas: 0, realizadas: 0, porcentajeCumplimiento: 0 };
        const currentYear = new Date().getFullYear();

        // 🔒 REGLA: Si hay un error registrado o flag de "no data" explícito, mostrar mensaje de error (Igual que Presupuesto)
        if (stats.error || stats.hasDataForCurrentYear === false) {
            return this.renderTrainingWidgetError(stats.error || `Sin datos para ${currentYear}`);
        }

        const total = stats.programadas;
        const realizadas = stats.realizadas;
        const restante = Math.max(0, total - realizadas); // Calcular restante
        const porcentaje = stats.porcentajeCumplimiento;

        console.log('📊 [createTrainingWidget] Datos para widget de capacitaciones:', {
            total,
            realizadas,
            restante,
            porcentaje
        });

        // Log para mostrar los datos que se están mostrando en la estadística
        console.log(`📊 [createTrainingWidget] ESTADÍSTICA MOSTRADA: ${realizadas} / ${total} (${porcentaje}%) - Realizadas: ${realizadas}, Restante: ${restante}`);

        // 1. Determinar Color (Semáforo)
        let colorVar = 'var(--k-success)';
        let colorClass = 'bg-success';

        if (porcentaje < 50) {
            colorVar = 'var(--k-danger)';
            colorClass = 'bg-danger';
        } else if (porcentaje < 80) {
            colorVar = 'var(--k-warning)';
            colorClass = 'bg-warning';
        }

        // 2. Crear Elemento con estructura de "Budget Card" (Reutilizando clases kb-*)
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';

        widget.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">Plan Capacitación</span>
                <span class="kb-badge ${colorClass}">${porcentaje}%</span>
            </div>

            <div class="kb-amount" style="font-size: 1.4rem;">${realizadas} / ${total}</div>
            <div class="kb-description">Capacitaciones del plan anual ejecutadas</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};">
                    <div class="kb-shimmer"></div>
                </div>
            </div>

            <div class="kb-footer">
                <div>
                    <div class="kb-label">Realizadas</div>
                    <div class="kb-value kb-exec" style="color: var(--k-success);">${realizadas}</div>
                </div>
                <div style="text-align: right;">
                    <div class="kb-label">Restante</div>
                    <div class="kb-value kb-rem" style="color: var(--k-text-muted);">${restante}</div>
                </div>
            </div>
        `;

        // 3. Animación de barra (después de insertar en DOM)
        setTimeout(() => {
            const bar = widget.querySelector('.kb-progress-bar');
            if (bar) {
                bar.style.width = `${Math.min(porcentaje, 100)}%`;
            }
        }, 100);

        return widget;
    }

    renderTrainingWidgetError(msg) {
        const w = document.createElement('div');
        w.className = 'widget';
        // Usamos el mismo estilo visual que renderBudgetWidgetError
        w.innerHTML = `<h4>Capacitaciones</h4><div class="widget-value" style="font-size:1.2rem; color:var(--k-danger)">Sin Datos</div><div class="widget-description">${msg}</div>`;
        return w;
    }

    // Nuevo método para crear widget de Actas COPASST (similar a Afiliación)
    createCopasstWidget() {
        const stats = this.resourceStats?.copasst || {
            totalActas: 0,
            actaMesEnCurso: false,
            ultimoMesRegistrado: null,
            actasAnio: 0,
            estado: 'ok',
            alertas: []
        };

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const currentMonthName = monthNames[currentMonth];

        // Determinar color y estado
        const alDia = stats.actaMesEnCurso;
        let colorVar = alDia ? 'var(--k-success)' : 'var(--k-danger)';
        let colorClass = alDia ? 'bg-success' : 'bg-danger';
        let statusText = alDia ? 'Al día' : 'Pendiente';

        // Calcular progreso anual (12 reuniones esperadas por año)
        const reunionesEsperadas = 12;
        const reunionesRealizadas = stats.actasAnio || 0;
        const porcentajeProgreso = Math.min((reunionesRealizadas / reunionesEsperadas) * 100, 100);

        const w = document.createElement('div');
        w.className = 'widget k-budget-card';

        w.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">Actas COPASST</span>
                <span class="kb-badge ${colorClass}">${statusText}</span>
            </div>

            <div class="kb-amount" style="font-size: 1.4rem;">${reunionesRealizadas} / ${reunionesEsperadas}</div>
            <div class="kb-description">Reuniones mensuales del COPASST</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};">
                    <div class="kb-shimmer"></div>
                </div>
            </div>

            <div class="kb-footer">
                <div>
                    <div class="kb-label">Mes actual</div>
                    <div class="kb-value" style="color: ${colorVar}">${currentMonthName}</div>
                </div>
                <div style="text-align: right;">
                    <div class="kb-label">Último registro</div>
                    <div class="kb-value">${stats.ultimoMesRegistrado || 'N/A'}</div>
                </div>
            </div>
        `;

        // Animación de barra (después de insertar en DOM)
        setTimeout(() => {
            const bar = w.querySelector('.kb-progress-bar');
            if (bar) {
                bar.style.width = `${porcentajeProgreso}%`;
            }
        }, 100);

        return w;
    }

    // Nuevo método para crear widget de Actas Comité de Convivencia (gemelo de COPASST)
    createComiteConvivenciaWidget() {
        const stats = this.resourceStats?.comite_convivencia || {
            totalActas: 0,
            actaMesEnCurso: false,
            ultimoMesRegistrado: null,
            actasAnio: 0,
            estado: 'ok',
            alertas: []
        };

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const currentMonthName = monthNames[currentMonth];

        // Determinar color y estado
        const alDia = stats.actaMesEnCurso;
        let colorVar = alDia ? 'var(--k-success)' : 'var(--k-danger)';
        let colorClass = alDia ? 'bg-success' : 'bg-danger';
        let statusText = alDia ? 'Al día' : 'Pendiente';

        // Calcular progreso anual (12 reuniones esperadas por año)
        const reunionesEsperadas = 12;
        const reunionesRealizadas = stats.actasAnio || 0;
        const porcentajeProgreso = Math.min((reunionesRealizadas / reunionesEsperadas) * 100, 100);

        const w = document.createElement('div');
        w.className = 'widget k-budget-card';

        w.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">Actas Cocola</span>
                <span class="kb-badge ${colorClass}">${statusText}</span>
            </div>

            <div class="kb-amount" style="font-size: 1.4rem;">${reunionesRealizadas} / ${reunionesEsperadas}</div>
            <div class="kb-description">Reuniones del Comité de Convivencia</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};">
                    <div class="kb-shimmer"></div>
                </div>
            </div>

            <div class="kb-footer">
                <div>
                    <div class="kb-label">Mes actual</div>
                    <div class="kb-value" style="color: ${colorVar}">${currentMonthName}</div>
                </div>
                <div style="text-align: right;">
                    <div class="kb-label">Último registro</div>
                    <div class="kb-value">${stats.ultimoMesRegistrado || 'N/A'}</div>
                </div>
            </div>
        `;

        // Animación de barra (después de insertar en DOM)
        setTimeout(() => {
            const bar = w.querySelector('.kb-progress-bar');
            if (bar) {
                bar.style.width = `${porcentajeProgreso}%`;
            }
        }, 100);

        return w;
    }

    // Nuevo método para crear widget de Afiliación SSSI
    createAfiliacionWidget() {
        const stats = this.resourceStats?.afiliacion || {
            totalPlanillas: 0,
            planillaMesEnCurso: false,
            planillasAnio: 0,
            ultimoMesRegistrado: null,
            estado: 'ok'
        };

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const currentMonthName = monthNames[currentMonth];

        // Determinar color y estado
        const alDia = stats.planillaMesEnCurso;
        let colorVar = alDia ? 'var(--k-success)' : 'var(--k-danger)';
        let colorClass = alDia ? 'bg-success' : 'bg-danger';
        let statusText = alDia ? 'Al día' : 'Pendiente';

        // Calcular progreso anual (12 planillas esperadas por año)
        const planillasEsperadas = 12;
        const planillasRealizadas = stats.planillasAnio || 0;
        const porcentajeProgreso = Math.min((planillasRealizadas / planillasEsperadas) * 100, 100);

        // LOG DE DEPURACIÓN: Datos del widget de afiliación
        console.log(`[AFILIACIÓN WIDGET] 🎨 Renderizando widget:`, {
            totalPlanillas: stats.totalPlanillas,
            planillasAnio: stats.planillasAnio,
            planillaMesEnCurso: stats.planillaMesEnCurso,
            ultimoMesRegistrado: stats.ultimoMesRegistrado,
            mesActual: currentMonthName,
            estado: stats.estado,
            colorUsado: colorVar,
            statusText: statusText,
            alertaActiva: !alDia
        });

        const w = document.createElement('div');
        w.className = 'widget k-budget-card';

        w.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">Afiliación SSSI</span>
                <span class="kb-badge ${colorClass}">${statusText}</span>
            </div>

            <div class="kb-amount" style="font-size: 1.4rem;">${planillasRealizadas} / ${planillasEsperadas}</div>
            <div class="kb-description">Planillas de afiliación al SSSI</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};">
                    <div class="kb-shimmer"></div>
                </div>
            </div>

            <div class="kb-footer">
                <div>
                    <div class="kb-label">Mes actual</div>
                    <div class="kb-value" style="color: ${colorVar}">${currentMonthName}</div>
                </div>
                <div style="text-align: right;">
                    <div class="kb-label">Último registro</div>
                    <div class="kb-value">${stats.ultimoMesRegistrado || 'N/A'}</div>
                </div>
            </div>
        `;

        // Animación de barra (después de insertar en DOM)
        setTimeout(() => {
            const bar = w.querySelector('.kb-progress-bar');
            if (bar) {
                bar.style.width = `${porcentajeProgreso}%`;
            }
        }, 100);

        return w;
    }

    // =========================================
    // MÉTODO CORREGIDO: Crear Widget de Presupuesto
    // =========================================
    async createBudgetWidget() {
        try {
            // 1. Re-Verificar empresa
            if (!this.currentCompany || this.currentCompany === 'default_company') {
                this.currentCompany = this.getCurrentCompany();
            }

            // 2. Usar caché si existe
            if (this.budgetData && this.budgetData.company === this.currentCompany) {
                return this.renderBudgetWidgetModern(
                    this.budgetData.totalPresupuesto,
                    this.budgetData.totalEjecutado,
                    this.budgetData.porcentajeCumplimiento,
                    this.budgetData.saldoDisponible
                );
            }

            // 3. Cargar Datos (Mismo código lógico original, no tocar)
            if (!window.electronAPI || !window.electronAPI.getPresupuestoFiles) {
                return this.renderBudgetWidgetError('API no disponible');
            }

            const result = await window.electronAPI.getPresupuestoFiles(this.currentCompany);
            if (!result.success || !result.files?.length) {
                return this.renderBudgetWidgetError('No hay archivos de presupuesto');
            }

            const currentYear = new Date().getFullYear();
            const file = result.files.find(f => f.name.includes(currentYear.toString()));
            
            // 🔒 REGLA: Solo mostrar datos si existe archivo para el periodo actual
            if (!file) {
                console.warn(`⚠️ [createBudgetWidget] No se encontró archivo de presupuesto para el año ${currentYear}`);
                return this.renderBudgetWidgetError(`No hay archivo de presupuesto para ${currentYear}`);
            }

            const dataResult = await window.electronAPI.readPresupuestoData(file.path);
            if (!dataResult.success) return this.renderBudgetWidgetError('Error lectura');

            const summary = this.calculateBudgetSummary(dataResult.data.processedData);

            const validTotal = typeof summary.totalPresupuesto === 'number' ? summary.totalPresupuesto : 0;
            const validEjecutado = typeof summary.totalEjecutado === 'number' ? summary.totalEjecutado : 0;
            const validPct = typeof summary.porcentajeCumplimiento === 'number' ? summary.porcentajeCumplimiento : 0;
            const validSaldo = typeof summary.saldoDisponible === 'number' ? summary.saldoDisponible : (validTotal - validEjecutado);

            this.budgetData = {
                company: this.currentCompany,
                totalPresupuesto: validTotal,
                totalEjecutado: validEjecutado,
                porcentajeCumplimiento: validPct,
                saldoDisponible: validSaldo,
                mensual: summary.mensual
            };

            // 4. Renderizar Widget Moderno
            return this.renderBudgetWidgetModern(validTotal, validEjecutado, validPct, validSaldo);

        } catch (error) {
            console.error('Error en createBudgetWidget:', error);
            return this.renderBudgetWidgetError(`Error: ${error.message}`);
        }
    }

    // =========================================
    // MÉTODO CORREGIDO: Renderizar HTML y Animar Barra
    // =========================================
    renderBudgetWidgetModern(total, ejecutado, porcentaje, saldo) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';

        const currentYear = new Date().getFullYear();
        const limitedPct = Math.min(porcentaje, 100);

        // 1. Determinar Color (Lógica Semántica)
        let colorVar = 'var(--k-success)';
        let colorClass = 'bg-success';
        let textClass = 'var(--k-success)';

        if (limitedPct < 50) {
            colorVar = 'var(--k-danger)';
            colorClass = 'bg-danger';
            textClass = 'var(--k-danger)';
        } else if (limitedPct < 80) {
            colorVar = 'var(--k-warning)';
            colorClass = 'bg-warning';
            textClass = 'var(--k-warning)';
        }

        // 2. Construir HTML (ESTRUCTURA MODERNA)
        widget.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">Presupuesto</span>
                <span class="kb-badge ${colorClass}" id="kb-badge-${Math.random()}">${limitedPct.toFixed(1)}%</span>
            </div>

            <div class="kb-amount">${this.formatCurrency(total)}</div>
            <div class="kb-description">Ejecución presupuestal del SG-SST</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" id="kb-bar-${Math.random()}" style="width: 0%;">
                    <div class="kb-shimmer"></div>
                </div>
            </div>

            <div class="kb-footer">
                <div>
                    <div class="kb-label">Ejecutado</div>
                    <div class="kb-value kb-exec">${this.formatCurrency(ejecutado)}</div>
                </div>
                <div style="text-align: right;">
                    <div class="kb-label">Restante</div>
                    <div class="kb-value kb-rem">${this.formatCurrency(saldo)}</div>
                </div>
            </div>
        `;

        // 3. Animar Barra (CORRECCIÓN DE LÓGICA)
        // Usamos setTimeout para asegurar que el elemento ya existe en el DOM
        setTimeout(() => {
            const bar = widget.querySelector('.kb-progress-bar');
            const badge = widget.querySelector('.kb-badge');

            if (bar) {
                // Aplicar color y ancho
                bar.style.backgroundColor = colorVar;
                bar.style.width = `${limitedPct}%`;
            }

            // Asegurar color del badge
            if (badge) {
                badge.style.backgroundColor = colorVar;
            }
        }, 100);

        return widget;
    }

    // ... (Mantén todos tus métodos existentes: createWidget, calculateBudgetSummary, etc. exactamente igual) ...

    // Solo incluyo aquí el createWidget estándar para completitud del archivo,
    // pero NO necesitas cambiarlo si ya lo tenías.
    createWidget(title, value, desc) {
        const w = document.createElement('div');
        w.className = 'widget';
        w.innerHTML = `<h4>${title}</h4><div class="widget-value">${value}</div><div class="widget-description">${desc}</div>`;
        return w;
    }

    renderBudgetWidgetError(msg) {
        const w = document.createElement('div');
        w.className = 'widget';
        w.innerHTML = `<h4>Presupuesto</h4><div class="widget-value" style="font-size:1.2rem; color:var(--k-danger)">Error</div><div class="widget-description">${msg}</div>`;
        return w;
    }

    // ... Resto de la clase (renderSubmoduleItem, getCurrentCompany, etc.) ...

    async renderSidebarPanel(container) {
        container.style.display = 'none';
    }

    calculateBudgetSummary(processedData) {
        // (Mantén tu lógica original de cálculo aquí intacta)
        console.log('📊 [calculateBudgetSummary] Calculando resumen...');

        let totalP = 0, totalE = 0;
        const monthlyExecution = new Array(12).fill(0);
        const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

        processedData.forEach(row => {
            if (row.id && typeof row.id === 'string' && row.id.toUpperCase().includes('TOTAL')) return;
            const valP = this.parseFormattedNumber(row.asignacion);
            const valE = this.parseFormattedNumber(row.ejecutado_acumulado);
            if(!isNaN(valP)) totalP += valP;
            if(!isNaN(valE)) totalE += valE;

            // Monthly execution
            months.forEach((m, idx) => {
                const mVal = this.parseFormattedNumber(row[m]);
                if (!isNaN(mVal)) monthlyExecution[idx] += mVal;
            });
        });

        // Cumulative data for S-curve
        const cumulativeExecution = [];
        const cumulativePlanned = [];
        let cumE = 0;
        let cumP = 0;
        for (let i = 0; i < 12; i++) {
            cumE += monthlyExecution[i];
            cumulativeExecution.push(cumE);
            cumP += totalP / 12; // Approximation: even distribution
            cumulativePlanned.push(cumP);
        }

        const pct = totalP > 0 ? ((totalE / totalP) * 100) : 0;
        return {
            totalPresupuesto: totalP,
            totalEjecutado: totalE,
            porcentajeCumplimiento: pct,
            saldoDisponible: totalP - totalE,
            mensual: { ejecutado: cumulativeExecution, planeado: cumulativePlanned }
        };
    }

parseFormattedNumber(value) {
            if (value === null || value === undefined || value === '') return 0;
            if (typeof value === 'number') return value;
            if (typeof value === 'object' && value.value !== undefined) return value.value;
            if (typeof value === 'string') {
                let clean = value.toString()
                    .replace(/\$/g, '')
                    .replace(/\s/g, '')
                    .replace(/\./g, '')
                    .replace(/,/g, '.');
                const parsed = parseFloat(clean);
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        }

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0
        }).format(amount);
    }

    renderSubmoduleItem(name) {
        const item = document.createElement('div');
        item.className = 'submodule-item';
        item.innerHTML = `
            <div class="submodule-info">
                <div class="submodule-name">${name}</div>
                <div class="submodule-meta">Gestión y control</div>
            </div>
            <button class="btn-ingresar">Ingresar</button>
        `;
        const btn = item.querySelector('.btn-ingresar');
        btn.onclick = () => this.handleSubmoduleClick(name);
        return item;
    }

    // --- CHART INITIALIZATION ---
    async initCharts() {
        // 📦760-fix — Destruir charts anteriores antes de crear nuevos.
        // Sin esto, al re-navegar al módulo, container.innerHTML='' borra los canvas
        // del DOM pero las instancias de Chart.js siguen vivas con el mismo canvas ID,
        // y new Chart(ctx, ...) tira "Canvas is already in use" con ID auto-incremental.
        // Patrón estándar de K+AIR (verificacion, gestion-amenazas, gestion-peligros,
        // mejoramiento, gestion-integral, gestion-salud, medicion-ausentismo).
        ['budgetChart', 'trainingChart', 'inductionChart'].forEach(function (id) {
            try {
                var canvas = document.getElementById(id);
                if (!canvas) return;
                var existing = Chart.getChart(canvas);
                if (existing && typeof existing.destroy === 'function') existing.destroy();
            } catch (_) { /* canvas no existe o Chart no cargado — ignorar */ }
        });

        // Configuración Global
        if (typeof Chart !== 'undefined') {
            Chart.defaults.font.family = "'Segoe UI', sans-serif";
            Chart.defaults.color = '#6c757d';
        }

        const labels12 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        // 1. Budget Chart (Line: Planned vs Real)
        const ctxBudget = document.getElementById('budgetChart');
        if(ctxBudget && typeof Chart !== 'undefined') {
            const bData = this.budgetData?.mensual || { planeado: Array(12).fill(0), ejecutado: Array(12).fill(0) };

            this.charts.budget = new Chart(ctxBudget, {
                type: 'line',
                data: {
                    labels: labels12,
                    datasets: [
                        {
                            label: 'Planeado (S-Curve)',
                            data: bData.planeado,
                            borderColor: '#dee2e6',
                            borderDash: [5, 5],
                            fill: false,
                            tension: 0.4
                        },
                        {
                            label: 'Ejecutado Real',
                            data: bData.ejecutado,
                            borderColor: '#174ea6',
                            backgroundColor: 'rgba(23, 78, 166, 0.1)',
                            fill: true,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { display: false, beginAtZero: true, grid: { display: false } } }
                }
            });
        }

        // 2. Training Chart (Bar: Programadas vs Realizadas - similar a Ejecución Mensual del dashboard)
        const ctxTraining = document.getElementById('trainingChart');
        if(ctxTraining && typeof Chart !== 'undefined') {
            // Obtener datos específicos del dashboard de capacitaciones para esta gráfica (esperar a que se completen)
            const stats = await this.getCapacitacionesChartDataForGraph() || {
                programadas: new Array(12).fill(0),
                realizadas: new Array(12).fill(0)
            };

            // Log para mostrar qué datos está visualizando la gráfica y de dónde los obtiene
            console.log('📊 [TrainingChart] Datos para gráfica de capacitaciones mensuales (Programadas vs Realizadas):');
            console.log('   - Fuente: this.getCapacitacionesChartDataForGraph()');
            console.log('   - Programadas:', stats.programadas);
            console.log('   - Realizadas:', stats.realizadas);
            console.log('   - Empresa actual:', this.currentCompany);

            this.charts.training = new Chart(ctxTraining, {
                type: 'bar',
                data: {
                    labels: labels12,
                    datasets: [
                        {
                            label: 'Programadas',
                            data: stats.programadas,
                            backgroundColor: '#ffc107', // var(--k-warning) - amarillo para programadas
                            borderRadius: 4
                        },
                        {
                            label: 'Realizadas',
                            data: stats.realizadas,
                            backgroundColor: '#174ea6', // var(--k-primary) - azul para realizadas
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { x: { stacked: false, grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 }, grid: { display: false } } },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: { boxWidth: 12, padding: 15 }
                        }
                    }
                }
            });
        }

    // 3. Induction Chart (Line: Realizadas vs Aprobadas)
    const ctxInduction = document.getElementById('inductionChart');
    if(ctxInduction && typeof Chart !== 'undefined') {
      const iData = this.resourceStats?.inducciones?.mensual || new Array(12).fill(0);
      const iApproved = this.resourceStats?.inducciones?.mensualApproved || new Array(12).fill(0);

      this.charts.induction = new Chart(ctxInduction, {
        type: 'line',
        data: {
          labels: labels12,
          datasets: [
            {
              label: 'Realizadas',
              data: iData,
              borderColor: '#174ea6',
              backgroundColor: 'rgba(23,78,166,0.1)',
              fill: true,
              tension: 0.4
            },
            {
              label: 'Aprobadas',
              data: iApproved,
              borderColor: '#28a745',
              backgroundColor: 'rgba(40,167,69,0.1)',
              fill: true,
              tension: 0.4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { display: false } }, x: { grid: { display: false } } }
        }
      });
    }
    }

    // Método para obtener datos específicos del dashboard de capacitaciones para la gráfica
    async getCapacitacionesChartDataForGraph() {
        try {
            console.log('📊 [getCapacitacionesChartDataForGraph] Iniciando búsqueda para:', this.currentCompany);
            
            // Obtener datos de capacitaciones para mostrar Programadas vs Realizadas como en el dashboard
            const submodulePathResult = await window.electronAPI.findSubmodulePath(this.currentCompany, 'Recursos', '1.2.1 Programa de capacitación Anual');
            if (!submodulePathResult.success) {
                console.warn('⚠️ [RecursosHome] No se encontró ruta del submódulo de capacitaciones');
                return {
                    programadas: new Array(12).fill(0),
                    realizadas: new Array(12).fill(0)
                };
            }

            const submodulePath = submodulePathResult.path;
            console.log('📂 [getCapacitacionesChartDataForGraph] Ruta:', submodulePath);

            const filesResult = await window.electronAPI.readDirectory(submodulePath);
            if (!filesResult.success) {
                console.warn('⚠️ [RecursosHome] No se pudo leer directorio de capacitaciones');
                return {
                    programadas: new Array(12).fill(0),
                    realizadas: new Array(12).fill(0)
                };
            }

            const allFiles = filesResult.files || [];
            
            // 🔍 FILTRAR SOLO ARCHIVOS CON "CRONOGRAMA" (Misma lógica que calculateCapacitacionesClientSide)
            const cronogramaFiles = allFiles.filter(item => {
                const name = (item.name || item.path || '').toLowerCase();
                const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
                const notTemp = !name.startsWith('~$');
                const hasCronograma = name.includes('cronograma');
                return hasCronograma && isExcel && notTemp;
            });

            console.log(`📋 [getCapacitacionesChartDataForGraph] Archivos con "cronograma": ${cronogramaFiles.length}`);
            cronogramaFiles.forEach((f, i) => {
                const fname = f.name || (f.path ? f.path.split(/[/\\]/).pop() : 'unknown');
                console.log(`   [${i}] ✅ ${fname}`);
            });

            // Usar SOLO archivos con "cronograma" si existen
            const excelFiles = cronogramaFiles.length > 0 ? cronogramaFiles : allFiles.filter(item => {
                const name = (item.name || item.path || '').toLowerCase();
                const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
                const notTemp = !name.startsWith('~$');
                return isExcel && notTemp;
            });

            if (excelFiles.length === 0) {
                console.warn('⚠️ [RecursosHome] No se encontró archivo Excel');
                return {
                    programadas: new Array(12).fill(0),
                    realizadas: new Array(12).fill(0)
                };
            }

            // 🎯 SELECCIÓN: Priorizar cronograma con año
            const currentYear = new Date().getFullYear();
            const previousYear = currentYear - 1;

            let selectedFile = null;

            if (cronogramaFiles.length > 0) {
                // 1. Cronograma con año anterior (2025)
                selectedFile = cronogramaFiles.find(f => {
                    const name = (f.name || '').toLowerCase();
                    return name.includes(previousYear.toString());
                });

                // 2. Cualquier cronograma
                if (!selectedFile) {
                    selectedFile = cronogramaFiles[0];
                }
            } else {
                selectedFile = excelFiles[0];
            }

            const allExcelFiles = excelFiles.map(item => item.name || item.path);
            const selectedFileName = selectedFile.name || (selectedFile.path ? selectedFile.path.split(/[/\\]/).pop() : '');
            
            console.log(`📄 [getCapacitacionesChartDataForGraph] Archivo seleccionado: ${selectedFileName}`);

            const excelFilePath = `${submodulePath}/${selectedFileName}`;

            // Obtener hojas disponibles
            const sheetsResult = await window.electronAPI.getCapacitacionesSheets(excelFilePath);
            if (!sheetsResult.success) {
                console.warn('⚠️ [RecursosHome] Error al leer hojas del Excel');
                return {
                    programadas: new Array(12).fill(0),
                    realizadas: new Array(12).fill(0)
                };
            }

            const availableSheets = sheetsResult.sheets.filter(sheet => sheet && typeof sheet === 'string');
            console.log('📋 [getCapacitacionesChartDataForGraph] Hojas disponibles:', availableSheets.join(', '));

            // Determinar año actual y anterior
            const currentYear2 = new Date().getFullYear();
            const previousYear2 = currentYear2 - 1;
            
            console.log(`📅 [getCapacitacionesChartDataForGraph] Buscando hoja para año: ${currentYear2} (fallback: ${previousYear2})`);

            // 🔍 BÚSQUEDA FLEXIBLE DE HOJAS (6 intentos)
            let sheetName = null;
            
            // 1. Buscar hoja con "matriz cap" y año actual
            sheetName = availableSheets.find(s => 
                s.trim().toLowerCase().includes('matriz cap') && s.includes(currentYear2.toString())
            );
            
            // 2. Buscar hoja con año actual (cualquier nombre)
            if (!sheetName) {
                sheetName = availableSheets.find(s => s.includes(currentYear2.toString()));
            }
            
            // 3. Buscar hoja con "matriz cap" y año anterior
            if (!sheetName) {
                sheetName = availableSheets.find(s => 
                    s.trim().toLowerCase().includes('matriz cap') && s.includes(previousYear2.toString())
                );
            }
            
            // 4. Buscar hoja con año anterior
            if (!sheetName) {
                sheetName = availableSheets.find(s => s.includes(previousYear2.toString()));
            }
            
            // 5. Fallback: primera hoja que no sea portada
            if (!sheetName) {
                sheetName = availableSheets.find(s => 
                    !s.toLowerCase().includes('inicio') && 
                    !s.toLowerCase().includes('portada') &&
                    !s.toLowerCase().includes('indice')
                );
            }
            
            // 6. Último fallback: primera hoja
            if (!sheetName && availableSheets.length > 0) {
                sheetName = availableSheets[0];
            }

            if (!sheetName) {
                console.warn(`⚠️ [RecursosHome] No se encontró ninguna hoja válida`);
                return {
                    programadas: new Array(12).fill(0),
                    realizadas: new Array(12).fill(0)
                };
            }

            console.log('✅ [getCapacitacionesChartDataForGraph] Hoja seleccionada:', sheetName);

            const excelResult = await window.electronAPI.initExcel({ filePath: excelFilePath, sheetName });
            if (!excelResult.success) {
                console.warn('⚠️ [RecursosHome] Error al inicializar Excel');
                return {
                    programadas: new Array(12).fill(0),
                    realizadas: new Array(12).fill(0)
                };
            }

            const { processedData, headers } = excelResult.data;
            const dataRows = processedData.slice(5); // Datos empiezan en fila 6 (índice 5)

            // Arrays para contar programadas y realizadas por mes
            const programadasData = Array(12).fill(0);
            const realizadasData = Array(12).fill(0);

            // 📦656-fix — Auto-detección de columnas (igual que el submódulo).
            // Antes el home hardcodeaba row[1] para nombre, row[3] para fecha y
            // [9,8,7...] para estado, lo que hacía que se contaran fechas de
            // columnas equivocadas (la columna 3 del Excel no es la fecha
            // programada; el submódulo detecta que la fecha real está en col 5).
            // Esta auto-detección lee el header y encuentra las columnas reales.
            let colNombre = 1, colFecha = 3, colEstado = 8;

            for (let i = 0; i < Math.min(5, processedData.length); i++) {
                const row = processedData[i];
                if (!Array.isArray(row)) continue;
                for (let j = 0; j < row.length; j++) {
                    const cell = String(row[j] || '').toLowerCase();
                    if (cell.includes('nombre') || cell.includes('capacitación')) colNombre = j;
                    if (cell.includes('fecha') || cell.includes('programada') || cell.includes('date')) colFecha = j;
                    if (cell.includes('estado') || cell.includes('indicador') || cell.includes('status')) colEstado = j;
                }
            }

            console.log(`📊 [getCapacitacionesChartDataForGraph] Columnas detectadas: Nombre=${colNombre}, Fecha=${colFecha}, Estado=${colEstado}`);

            console.log('🔍 [getCapacitacionesChartDataForGraph] Procesando filas...');

            for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i];
                if (!Array.isArray(row) || row.length < Math.max(colNombre, colFecha, colEstado) + 1) continue;

                const getCellValue = (cell) => {
                    if (cell === null || cell === undefined) return '';
                    if (typeof cell === 'object' && cell.value !== undefined) return cell.value;
                    return String(cell);
                };

                const nombre = String(getCellValue(row[colNombre]) || '').trim();

                if (!nombre || nombre.length < 3) continue;
                if (nombre.toLowerCase().includes('nombre de la') || nombre.toLowerCase().includes('contenido de la')) continue;
                if (nombre.toLowerCase().includes('total capacitaciones')) break;

                // Fecha con parser robusto + fallback offset ±2 columnas
                let fechaProgramada = 'No especificada';
                let fechaValue = getCellValue(row[colFecha]);

                if (!fechaValue || fechaValue === '') {
                    for (let offset = -2; offset <= 2; offset++) {
                        const testCol = colFecha + offset;
                        if (testCol >= 0 && testCol < row.length) {
                            const testValue = getCellValue(row[testCol]);
                            if (testValue && testValue !== '') {
                                fechaValue = testValue;
                                colFecha = testCol;
                                break;
                            }
                        }
                    }
                }

                if (fechaValue) {
                    if (typeof fechaValue === 'number' && fechaValue >= 1) {
                        // Serial date de Excel
                        const utcDate = new Date((fechaValue - 25569) * 86400 * 1000);
                        const localDate = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
                        fechaProgramada = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                    } else {
                        const fechaStr = String(fechaValue).trim();
                        let parsedDate = null;

                        // DMY (24/04/2026 o 24-04-2026)
                        const dmyMatch = fechaStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                        if (dmyMatch) {
                            parsedDate = new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
                        }

                        // ISO (2026-04-24 o 2026/04/24)
                        if (!parsedDate) {
                            const isoMatch = fechaStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
                            if (isoMatch) {
                                parsedDate = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
                            }
                        }

                        // Fallback genérico
                        if (!parsedDate) {
                            parsedDate = new Date(fechaStr);
                        }

                        if (parsedDate && !isNaN(parsedDate.getTime()) && parsedDate.getFullYear() >= 1900) {
                            fechaProgramada = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
                        }
                    }
                }

                // Estado usando la columna detectada
                const estadoRaw = getCellValue(row[colEstado]);
                const estadoNorm = (estadoRaw || '').toString().toLowerCase().trim();

                console.log(`🔍 Fila ${i}: Nombre="${nombre}", Estado="${estadoRaw}", Fecha="${fechaProgramada}", colE=${colEstado}`);

                // 📦656 — Misma detección de "realizada" que el submódulo
                const isRealizada = estadoNorm.includes('ejecutado') ||
                                    estadoNorm.includes('completado') ||
                                    estadoNorm.includes('realizado') ||
                                    estadoNorm === '1' ||
                                    estadoNorm === '3' ||
                                    estadoNorm === '4' ||
                                    estadoNorm === '100' ||
                                    estadoNorm.includes('si') ||
                                    estadoNorm.includes('sí');

                const date = new Date(fechaProgramada);
                if (!isNaN(date.getTime())) {
                    const month = date.getMonth();
                    if (month >= 0 && month < 12) {
                        programadasData[month]++;
                        if (isRealizada) {
                            realizadasData[month]++;
                            console.log(`✅ Capacitación "${nombre}" marcada como realizada en mes ${month + 1}`);
                        }
                    }
                }
            }

            console.log('📊 [getCapacitacionesChartDataForGraph] Datos encontrados - Programadas:', programadasData, 'Realizadas:', realizadasData);
            return {
                programadas: programadasData,
                realizadas: realizadasData
            };
        } catch (error) {
            console.error('❌ [RecursosHome] Error obteniendo datos de capacitaciones para gráfica:', error);
            return {
                programadas: new Array(12).fill(0),
                realizadas: new Array(12).fill(0)
            };
        }
    }

    handleSubmoduleClick(submoduleName) {
        console.log('Navegando a submódulo:', submoduleName);
        const mainCanvas = document.querySelector('.main-canvas'); // Ajustar según tu ID real
        if (mainCanvas && typeof window.showSubmoduleContent === 'function') {
            window.showSubmoduleContent(mainCanvas, this.moduleName, submoduleName);
        } else {
            alert(`Navegando a ${submoduleName}`);
        }
    }
}

window.RecursosHome = RecursosHome;