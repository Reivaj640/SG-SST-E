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
                <i class="bi bi-grid-1x2-fill me-2"></i>
                <div>
                    <div>Módulo Recursos</div>
                    <span style="font-size: 0.75rem; font-weight: 400; color: var(--k-text-muted);">
                        ${this.currentCompany} / Gestión Integral
                    </span>
                </div>
            </div>
            <div>
                <button class="k-btn-ingresar"><i class="bi bi-gear"></i> Configuración</button>
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
                color: var(--k-primary);
                display: flex;
                align-items: center;
                gap: 0.75rem;
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
                gap: 1.5rem;
                overflow-y: auto;
                padding-right: 0.5rem;
                width: 100%;
            }

            /* Grid de Widgets */
            .widgets-container {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                gap: 1.5rem;
            }

            /* Widget Base */
            .widget {
                background: var(--k-bg-card);
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-lg);
                padding: 1.25rem;
                display: flex;
                flex-direction: column;
                position: relative;
                box-shadow: var(--k-shadow-sm);
                transition: transform 0.2s ease;
                min-height: 140px; /* Altura mínima uniforme */
            }
            .widget:hover {
                transform: translateY(-3px);
                box-shadow: var(--k-shadow-md);
            }
            .widget h4 {
                margin: 0 0 0.5rem 0;
                font-size: 0.8rem;
                color: var(--k-text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 600;
            }
            .widget-value {
                font-size: 1.8rem;
                font-weight: 700;
                color: var(--k-text-main);
                margin-bottom: 0.5rem;
            }
            .widget-description {
                font-size: 0.85rem;
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
                font-size: 0.85rem;
                font-weight: 600;
                color: var(--k-text-muted);
                text-transform: uppercase;
            }
            .kb-badge {
                font-size: 0.85rem;
                font-weight: 700;
                padding: 0.2rem 0.6rem;
                border-radius: 1rem;
                color: white;
                background-color: var(--k-success); /* Por defecto verde */
            }

            /* Valor Principal */
            .kb-amount {
                font-size: 2rem;
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
                font-size: 0.8rem;
                margin-top: auto;
                padding-top: 0.5rem;
                border-top: 1px solid var(--k-border);
            }
            .kb-label { color: var(--k-text-muted); font-weight: 500; }
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
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
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
                grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                gap: 1.5rem;
            }

            /* Layout Grid para los Gráficos */
            .charts-grid {
                display: grid;
                grid-template-columns: 2fr 1fr; /* 2/3 para Presupuesto, 1/3 para los otros apilados */
                grid-template-rows: auto auto;
                gap: 1.5rem;
                margin-bottom: 2rem;
            }

            .chart-card {
                background: var(--k-bg-card);
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-lg);
                padding: 1.5rem;
                box-shadow: var(--k-shadow-sm);
            }

            /* El gráfico grande ocupa toda la primera fila si es desktop */
            .chart-card.budget-chart { grid-column: 1 / -1; }

            .chart-title {
                font-size: 1.1rem; font-weight: 600; color: var(--k-text-main);
                margin-bottom: 1rem; display: flex; justify-content: space-between;
            }

            .canvas-container { position: relative; height: 250px; }

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
                .chart-card.budget-chart { grid-column: auto; }
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

        widgetsContainer.appendChild(this.createEPPWidget());

        // Widget de Presupuesto (MODERNIZADO)
        const budgetWidget = await this.createBudgetWidget();
        widgetsContainer.appendChild(budgetWidget);

        container.appendChild(widgetsContainer);

        // Contenedor para gráficos
        const chartsGrid = document.createElement('div');
        chartsGrid.className = 'charts-grid';

        // Gráfico Principal: Ejecución Presupuestal
        const budgetChartCard = document.createElement('div');
        budgetChartCard.className = 'chart-card budget-chart';
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
                inducciones: { totalInducciones: 0, completadas: 0, pendientes: 0, porcentajeCompletado: 0, mensual: new Array(12).fill(0) },
                capacitaciones: { totalCapacitaciones: 0, programadas: 0, realizadas: 0, porcentajeCumplimiento: 0, mensual: { programadas: new Array(12).fill(0), realizadas: new Array(12).fill(0) } },
                epps: { totalEPPs: 0, entregados: 0, pendientes: 0, stockActual: 0 }
            };

            // 1. Cargar Estadísticas Generales (Backend) - Para Inducciones y EPPs (por ahora)
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

        } catch (error) {
            console.error('❌ [RecursosHome] Error al cargar estadísticas de recursos:', error);
        }
    }

    // Lógica portada de CapacitacionesComponent para asegurar consistencia
    async calculateCapacitacionesClientSide() {
        try {
            console.log('📊 [RecursosHome] Calculando estadísticas de Capacitaciones (Cliente)...');

            // A. Buscar ruta del submódulo
            const submodulePathResult = await window.electronAPI.findSubmodulePath(this.currentCompany, 'Recursos', '1.2.1 Programa de capacitación Anual');
            if (!submodulePathResult.success) throw new Error("Ruta submódulo no encontrada");
            const submodulePath = submodulePathResult.path;

            // B. Buscar archivo Excel
            const filesResult = await window.electronAPI.readDirectory(submodulePath);
            if (!filesResult.success) throw new Error("No se pudo leer directorio");

            const excelFiles = (filesResult.files || []).filter(item => {
                const name = (item.name || item.path || '').toLowerCase();
                return (name.includes('act-fo-005') || name.includes('cronograma')) &&
                       (name.endsWith('.xlsx') || name.endsWith('.xls')) &&
                       !name.startsWith('~$');
            });

            if (excelFiles.length === 0) {
                console.warn('⚠️ [RecursosHome] No se encontró Excel de capacitaciones (ACT-FO-005)');
                return;
            }
            // Preferir el más reciente o específico si hay varios
            const excelFile = excelFiles[0];
            // Intentar usar excelFile.name, si no existe, usar una lógica segura para el nombre
            const fileName = excelFile.name || (excelFile.path ? excelFile.path.split(/[/\\]/).pop() : 'archivo.xlsx');
            const filePath = `${submodulePath}/${fileName}`;

            // C. Determinar Hoja (Año Actual)
            const sheetsResult = await window.electronAPI.getCapacitacionesSheets(filePath);
            if (!sheetsResult.success) throw new Error("Error leyendo hojas");

            const currentYear = new Date().getFullYear();
            let sheetName = sheetsResult.sheets.find(s => s.toLowerCase().includes(`matriz cap`) && s.includes(currentYear.toString()));
            if (!sheetName) sheetName = sheetsResult.sheets.find(s => s.includes(currentYear.toString()));
            
            // 🔒 VALIDACIÓN ESTRICTA: Si no hay hoja para el año actual, NO usar fallback. Reportar error.
            if (!sheetName) {
                console.warn(`⚠️ [RecursosHome] No se encontró hoja de capacitaciones para el año ${currentYear}`);
                this.resourceStats.capacitaciones = {
                    ...this.resourceStats.capacitaciones,
                    error: `No hay cronograma ${currentYear}`,
                    hasDataForCurrentYear: false
                };
                return;
            }

            // Log para mostrar de qué hoja se están obteniendo los datos
            console.log('📊 [RecursosHome] Obteniendo datos de capacitaciones de la hoja:', sheetName, 'para el año:', currentYear);

            // D. Leer Datos y Procesar
            const excelResult = await window.electronAPI.initExcel({ filePath, sheetName });
            if (!excelResult.success) throw new Error("Error initExcel");

            const { processedData } = excelResult.data;
            const dataRows = processedData; // Iteramos desde el inicio para encontrar los datos reales

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

        } catch (error) {
            console.error('❌ [RecursosHome] Error calculando capacitaciones client-side:', error);
        }
    }

    // Nuevo método para crear widget de inducciones con datos reales
    createInductionWidget() {
        const stats = this.resourceStats?.inducciones || { totalInducciones: 0, completadas: 0, pendientes: 0, porcentajeCompletado: 0 };

        const title = 'Inducciones';
        const value = `${stats.completadas} / ${stats.totalInducciones}`;

        let desc = '';
        const porcentaje = stats.totalInducciones > 0 ? Math.round((stats.completadas / stats.totalInducciones) * 100) : 0;

        if (porcentaje >= 80) {
            desc = `✔ ${porcentaje}% Completado`;
        } else if (porcentaje >= 50) {
            desc = `⚠ ${porcentaje}% Completado`;
        } else {
            desc = `❌ ${porcentaje}% Completado (${stats.pendientes} Pendientes)`;
        }

        const w = document.createElement('div');
        w.className = 'widget';
        w.innerHTML = `
            <h4>${title}</h4>
            <div class="widget-value">${value}</div>
            <div class="widget-description">${desc}</div>
        `;
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

            <div class="kb-amount" style="font-size: 1.8rem;">${realizadas} / ${total}</div>

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

    // Nuevo método para crear widget de EPPs con datos reales
    createEPPWidget() {
        const stats = this.resourceStats?.epps || { totalEPPs: 0, entregados: 0, pendientes: 0, stockActual: 0 };

        const title = 'EPPs Entregados';
        const value = stats.entregados;
        const desc = stats.stockActual > 0
            ? `Stock actual: ${stats.stockActual}`
            : 'Sin datos';

        const w = document.createElement('div');
        w.className = 'widget';
        w.innerHTML = `
            <h4>${title}</h4>
            <div class="widget-value">${value}</div>
            <div class="widget-description">${desc}</div>
        `;
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
                    scales: { y: { beginAtZero: true } }
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
            // Obtener datos de capacitaciones para mostrar Programadas vs Realizadas como en el dashboard
            // Similar a la lógica de updateCharts() en CapacitacionesComponent
            const submodulePathResult = await window.electronAPI.findSubmodulePath(this.currentCompany, 'Recursos', '1.2.1 Programa de capacitación Anual');
            if (!submodulePathResult.success) {
                console.warn('⚠️ [RecursosHome] No se encontró ruta del submódulo de capacitaciones');
                return {
                    programadas: new Array(12).fill(0),
                    realizadas: new Array(12).fill(0)
                };
            }

            const submodulePath = submodulePathResult.path;

            const filesResult = await window.electronAPI.readDirectory(submodulePath);
            if (!filesResult.success) {
                console.warn('⚠️ [RecursosHome] No se pudo leer directorio de capacitaciones');
                return {
                    programadas: new Array(12).fill(0),
                    realizadas: new Array(12).fill(0)
                };
            }

            // Filtrar archivos Excel de capacitaciones
            const allExcelFiles = (filesResult.files || []).filter(item => {
                const fileName = (item.name || item.path || '').toLowerCase();
                return fileName.includes('act-fo-005') &&
                       (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) &&
                       !fileName.startsWith('~$');
            }).map(item => item.name || item.path);

            // Ordenar: .xlsx preferido
            allExcelFiles.sort((a, b) => {
                const aIsXlsx = a.toLowerCase().endsWith('.xlsx');
                const bIsXlsx = b.toLowerCase().endsWith('.xlsx');
                if (aIsXlsx && !bIsXlsx) return -1;
                if (!aIsXlsx && bIsXlsx) return 1;
                return a.localeCompare(b);
            });

            if (allExcelFiles.length === 0) {
                console.warn('⚠️ [RecursosHome] No se encontró archivo "ACT-FO-005"');
                return {
                    programadas: new Array(12).fill(0),
                    realizadas: new Array(12).fill(0)
                };
            }

            const excelFilePath = `${submodulePath}/${allExcelFiles[0]}`;

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

            // Determinar año actual
            const currentYear = new Date().getFullYear();

            // Lógica robusta para encontrar la hoja
            let sheetName = availableSheets.find(s =>
                s.trim().toLowerCase().includes(`matriz cap.`) && s.includes(currentYear.toString())
            ) || availableSheets.find(s => s.includes(currentYear.toString()));

            if (!sheetName) {
                console.warn(`⚠️ [RecursosHome] No hay hoja para el año ${currentYear}`);
                return {
                    programadas: new Array(12).fill(0),
                    realizadas: new Array(12).fill(0)
                };
            }

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

            console.log('🔍 [getCapacitacionesChartDataForGraph] Iniciando procesamiento de filas...');

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

                // Estado: Verificar múltiples columnas posibles para determinar si está realizada
                // Probamos varias columnas que comúnmente contienen información de estado
                const estadoColumnas = [9, 8, 7, 10, 11, 6]; // J, I, H, K, L, G
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

                // Es realizada si dice "100", "ejecutada", "realizada", "completada", "si", "sí", "cumplida", "ok", "true", etc.
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

                // Procesar fecha y aumentar contador por estado y mes
                const date = new Date(fechaProgramada);
                if (!isNaN(date.getTime())) {
                    const month = date.getMonth(); // 0-11
                    if (month >= 0 && month < 12) {
                        programadasData[month]++; // Siempre incrementa programadas
                        if (isRealizada) {
                            realizadasData[month]++; // Solo incrementa realizadas si está realizada
                        }

                        if (isRealizada) {
                            console.log(`✅ Capacitación "${nombre}" marcada como realizada en mes ${month + 1} (${['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][month]})`);
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