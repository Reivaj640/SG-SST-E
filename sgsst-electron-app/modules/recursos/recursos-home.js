class RecursosHome {
    constructor(container, moduleName, submodules) {
        this.container = container;
        this.moduleName = moduleName;
        this.submodules = submodules;
        this.currentCompany = null;
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
        layout.style.height = '100%';

        // Header
        const header = document.createElement('header');
        header.className = 'k-module-header';
        header.innerHTML = `
            <div class="k-module-title">
                <i class="bi bi-grid-1x2-fill me-2" style="color: #212529;"></i>
                <div>
                    <div style="color: #212529; font-weight: 600;">Módulo Recursos</div>
                    <span style="font-size: 0.75rem; font-weight: 400; color: #6c757d;">
                        ${this.currentCompany} / Recursos
                    </span>
                </div>
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

        // Renderizar contenido
        await this.renderMainArea(mainArea);

        contentContainer.appendChild(mainArea);
        layout.appendChild(contentContainer);
        this.container.appendChild(layout);

        // Inicializar gráficos
        setTimeout(() => this.initCharts(), 100);
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
                display: flex;
                flex-direction: column;
                padding: 1.5rem;
                overflow: hidden;
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
        const widgetsContainer = document.createElement('div');
        widgetsContainer.className = 'widgets-container';

        // Cargar estadísticas reales de recursos
        await this.loadResourceStats();

        // Widgets Simples (Actualizados con datos reales)
        widgetsContainer.appendChild(this.createInductionWidget());

        // Crear widget de capacitaciones después de que los cálculos estén completamente completos
        // Esperar un tick adicional para asegurar que todos los datos estén disponibles
        await new Promise(resolve => setTimeout(resolve, 100));
        const trainingWidget = this.createTrainingWidget();
        widgetsContainer.appendChild(trainingWidget);

        widgetsContainer.appendChild(this.createCopasstWidget());  // ← NUEVO: Actas COPASST

        // Widget de Comité de Convivencia
        widgetsContainer.appendChild(this.createComiteConvivenciaWidget());

        // Widget de Afiliación SSSI
        widgetsContainer.appendChild(this.createAfiliacionWidget());

        // Widget de Presupuesto (MODERNIZADO)
        const budgetWidget = await this.createBudgetWidget();
        widgetsContainer.appendChild(budgetWidget);

        container.appendChild(widgetsContainer);

        // Contenedor para gráficos
        const chartsGrid = document.createElement('div');
        chartsGrid.className = 'charts-grid';

        // Gráfico Principal: Ejecución Presupuestal
        const budgetChartCard = document.createElement('div');
        budgetChartCard.className = 'chart-card';
        budgetChartCard.innerHTML = `
            <div class="chart-title">
                <span>Ejecución Presupuestal (Acumulada)</span>
                <i class="bi bi-bar-chart-line" style="color: var(--k-primary);"></i>
            </div>
            <div class="canvas-container"><canvas id="budgetChart"></canvas></div>
        `;
        chartsGrid.appendChild(budgetChartCard);

        // Gráfico 2: Capacitaciones Mensuales
        const trainingChartCard = document.createElement('div');
        trainingChartCard.className = 'chart-card';
        trainingChartCard.innerHTML = `
            <div class="chart-title">
                <span>Capacitaciones Mensuales</span>
                <i class="bi bi-mortarboard" style="color: var(--k-primary);"></i>
            </div>
            <div class="canvas-container"><canvas id="trainingChart"></canvas></div>
        `;
        chartsGrid.appendChild(trainingChartCard);

        // Gráfico 3: Inducciones Anuales
        const inductionChartCard = document.createElement('div');
        inductionChartCard.className = 'chart-card';
        inductionChartCard.innerHTML = `
            <div class="chart-title">
                <span>Inducciones Anuales</span>
                <i class="bi bi-person-check" style="color: var(--k-primary);"></i>
            </div>
            <div class="canvas-container"><canvas id="inductionChart"></canvas></div>
        `;
        chartsGrid.appendChild(inductionChartCard);

        container.appendChild(chartsGrid);

        // Lista Submódulos
        const submodulesContainer = document.createElement('div');
        submodulesContainer.className = 'submodules-container';
        submodulesContainer.innerHTML = `<h3>Submódulos</h3>`;

        const submodulesList = document.createElement('div');
        submodulesList.className = 'submodules-list';
        this.submodules.forEach(submodule => {
            const item = this.renderSubmoduleItem(submodule);
            submodulesList.appendChild(item);
        });
        submodulesContainer.appendChild(submodulesList);
        container.appendChild(submodulesContainer);
    }

    // Nuevo método para cargar estadísticas reales de recursos
    async loadResourceStats() {
        try {
            console.log('🔄 [RecursosHome] Cargando estadísticas reales de recursos para:', this.currentCompany);

            // Inicializar estructura base
            this.resourceStats = {
                inducciones: { totalTrabajadores: 0, totalInducciones: 0, completadas: 0, pendientes: 0, porcentajeCompletado: 0, mensual: new Array(12).fill(0) },
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
                <span class="kb-title">Inducciones ${currentYear}</span>
                <span class="kb-badge ${colorClass}">${Math.round(porcentajeProgreso)}%</span>
            </div>

            <div class="kb-amount" style="font-size: 1.4rem;">${completadas} / ${totalTrabajadores}</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};"></div>
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
                <span class="kb-title">Plan Capacitación ${currentYear}</span>
                <span class="kb-badge ${colorClass}">${porcentaje}%</span>
            </div>

            <div class="kb-amount" style="font-size: 1.4rem;">${realizadas} / ${total}</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};"></div>
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
                <span class="kb-title">Actas COPASST ${currentYear}</span>
                <span class="kb-badge ${colorClass}">${statusText}</span>
            </div>

            <div class="kb-amount" style="font-size: 1.4rem;">${reunionesRealizadas} / ${reunionesEsperadas}</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};"></div>
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
                <span class="kb-title">Actas Comité Convivencia ${currentYear}</span>
                <span class="kb-badge ${colorClass}">${statusText}</span>
            </div>

            <div class="kb-amount" style="font-size: 1.4rem;">${reunionesRealizadas} / ${reunionesEsperadas}</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};"></div>
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
                <span class="kb-title">Afiliación SSSI ${currentYear}</span>
                <span class="kb-badge ${colorClass}">${statusText}</span>
            </div>

            <div class="kb-amount" style="font-size: 1.4rem;">${planillasRealizadas} / ${planillasEsperadas}</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};"></div>
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
                <span class="kb-title">Presupuesto ${currentYear}</span>
                <span class="kb-badge ${colorClass}" id="kb-badge-${Math.random()}">${limitedPct.toFixed(1)}%</span>
            </div>

            <div class="kb-amount">${this.formatCurrency(total)}</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" id="kb-bar-${Math.random()}" style="width: 0%;"></div>
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
            let clean = value.toString().replace(/\$/g, '').replace(/\s/g, '').replace(/,/g, '');
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
                    scales: { y: { display: false, beginAtZero: true } }
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
                    scales: { x: { stacked: false }, y: { beginAtZero: true, ticks: { precision: 0 } } },
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

        // 3. Induction Chart (Line: Tendencia)
        const ctxInduction = document.getElementById('inductionChart');
        if(ctxInduction && typeof Chart !== 'undefined') {
            const iData = this.resourceStats?.inducciones?.mensual || new Array(12).fill(0);

            this.charts.induction = new Chart(ctxInduction, {
                type: 'line',
                data: {
                    labels: labels12,
                    datasets: [{
                        label: 'Inducciones Acumuladas',
                        data: iData,
                        borderColor: '#ffc107',
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
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

            console.log('🔍 [getCapacitacionesChartDataForGraph] Procesando filas...');

            for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i];
                if (!Array.isArray(row) || row.length < 9) continue;

                const getCellValue = (cell) => {
                    if (cell === null || cell === undefined) return '';
                    if (typeof cell === 'object' && cell.value !== undefined) return cell.value;
                    return String(cell);
                };

                const nombreRaw = getCellValue(row[1]);
                const nombre = String(nombreRaw || '').trim();

                if (!nombre || nombre === 'Nombre de la capacitación' || nombre === '') continue;
                if (nombre.toLowerCase().includes('total capacitaciones')) break;

                // Fecha
                let fechaProgramada = 'No especificada';
                const fechaValue = getCellValue(row[3]);
                if (fechaValue) {
                    if (typeof fechaValue === 'number' && fechaValue >= 1) {
                        const utcDate = new Date((fechaValue - 25569) * 86400 * 1000);
                        const localDate = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
                        fechaProgramada = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                    } else {
                        const fechaStr = String(fechaValue);
                        let parsedDate = new Date(fechaStr);
                        if (isNaN(parsedDate.getTime())) {
                            const parts = fechaStr.split('/');
                            if (parts.length === 3) parsedDate = new Date(parts[2], parts[1] - 1, parts[0]);
                        }
                        if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() >= 1900) {
                            fechaProgramada = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
                        }
                    }
                }

                // Estado: Verificar múltiples columnas posibles
                const estadoColumnas = [9, 8, 7, 10, 11, 6];
                let estadoRaw = '';

                for (const colIndex of estadoColumnas) {
                    if (colIndex < row.length) {
                        const cellValue = getCellValue(row[colIndex]);
                        if (cellValue && cellValue.toString().trim() !== '') {
                            estadoRaw = cellValue;
                            break;
                        }
                    }
                }

                const estadoNorm = (estadoRaw || '').toString().toLowerCase().trim();

                console.log(`🔍 Fila ${i}: Nombre="${nombre}", Estado="${estadoRaw}", Fecha="${fechaProgramada}"`);

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

                const date = new Date(fechaProgramada);
                if (!isNaN(date.getTime())) {
                    const month = date.getMonth();
                    if (month >= 0 && month < 12) {
                        programadasData[month]++;
                        if (isRealizada) {
                            realizadasData[month]++;
                        }

                        if (isRealizada) {
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