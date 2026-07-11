// gestion-integral-home.js - Componente para el home del módulo "Gestión Integral"

class GestionIntegralHome {
    constructor(container, moduleName, submodules) {
        this.container = container;
        this.moduleName = moduleName;
        this.submodules = submodules;
        this.currentCompany = null;
        this.gestionIntegralStats = null;  // Almacenar estadísticas reales
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

        // 1. Inyectar Estilos K+AIR
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
                    <div style="color: #212529; font-weight: 600;">Módulo Gestión Integral</div>
                    <span style="font-size: 0.75rem; font-weight: 400; color: #6c757d;">
                        ${this.currentCompany} / Gestión Integral
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

        // 📦491 — Skeleton mientras cargan estadísticas de Gestión Integral (5 widgets + 2 bar charts)
        mainArea.innerHTML = KairSkeleton.kpiStrip(5) + KairSkeleton.chartBars(12) + KairSkeleton.chartBars(12);

        // 📦491-fix — Agregar al DOM ANTES del await para que el skeleton sea visible
        contentContainer.appendChild(mainArea);
        layout.appendChild(contentContainer);
        this.container.appendChild(layout);

        // 📦491-fix — Retardo de 200ms para que el browser pinte el skeleton y el ojo lo registre
        // antes de que JS continue con la carga. Sin esto, el skeleton se borra antes de verse.
        await new Promise(r => setTimeout(r, 200));

        // 0. Cargar estadísticas reales de Gestión Integral (skeleton visible durante la espera)
        await this.loadGestionIntegralStats();

        // 1. Renderizar contenido (limpia el skeleton y pinta widgets reales)
        await this.renderMainArea(mainArea);

        // Listen for fullscreen changes to update chart texts
        if (window.electronAPI?.onFullscreenChanged) {
            this._removeFullscreenListener = window.electronAPI.onFullscreenChanged((isFullscreen) => {
                console.log(`[CHART-DIAG] IPC fullscreen-changed received: ${isFullscreen}`);
                this.updateChartTexts(isFullscreen);
            });
        }

        // Set initial text state based on actual window state
        const isMaximized = await window.electronAPI?.isMaximized() ?? false;
        this._isMaximized = isMaximized;
        this.updateChartTexts(isMaximized);
    }

    injectStyles() {
        const styleId = 'k-air-gestion-integral-styles-v1';
        const oldStyle = document.getElementById(styleId);
        if (oldStyle) oldStyle.remove();

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* =========================================
               1. SISTEMA VISUAL K+AIR (OFICIAL) - GESTIÓN INTEGRAL
               ========================================= */
            .gestion-integral-home {
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
                overflow: auto;
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
                color: var(--k-text-main);
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }

            /* Main Layout */
            .main-area {
                display: flex;
                flex-direction: column;
gap: 1rem;
overflow-y: auto;
                padding-right: 0.5rem;
                width: 100%;
                flex: 1;
                min-height: 0;
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
                min-height: 120px;
                overflow: hidden;
                word-wrap: break-word;
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
                overflow-wrap: break-word;
            }
            .widget-value {
                font-size: 1.4rem;
                font-weight: 700;
                color: var(--k-text-main);
                margin-bottom: 0.5rem;
                overflow-wrap: break-word;
                word-wrap: break-word;
            }
            .widget-description {
                font-size: 0.65rem;
                color: var(--k-text-muted);
                overflow-wrap: break-word;
                word-wrap: break-word;
            }

            /* =========================================
               2. COMPONENTES K+AIR (Budget Card Style)
               Para widgets de Plan de Trabajo y otros
               ========================================= */

            /* Budget Card Base */
            .k-budget-card {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                overflow: hidden;
            }

            /* Header del Widget */
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
            }

            /* Valor Principal */
            .kb-amount {
                font-size: 1.4rem;
                font-weight: 700;
                color: var(--k-text-main);
                margin-bottom: 0.75rem;
                text-align: center;
                overflow-wrap: break-word;
                word-wrap: break-word;
            }

            /* Descripción del widget (estilo estándar) */
            .kb-description {
                font-size: 0.72rem;
                color: var(--k-text-muted);
                text-align: center;
                margin-bottom: 4px;
            }

            /* Barra de Progreso */
            .kb-progress-track {
                width: 100%;
                height: 10px;
                background-color: #e9ecef;
                border-radius: 5px;
                overflow: hidden;
                margin-bottom: 0.5rem;
                position: relative;
            }

            .kb-progress-bar {
                height: 100%;
                width: 0%;
                border-radius: 5px;
                background-color: var(--k-success);
                transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1), 
                            background-color 0.3s;
                position: relative;
            }

            /* Footer del Widget */
            .kb-footer {
                display: flex;
                justify-content: space-between;
                font-size: 0.6rem;
                margin-top: auto;
                padding-top: 0.5rem;
                border-top: 1px solid var(--k-border);
            }

            .kb-label {
                color: var(--k-text-muted);
                font-weight: 500;
                font-size: 0.6rem;
            }

            .kb-value {
                font-weight: 600;
            }

            .kb-exec {
                color: var(--k-success);
            }

            .kb-rem {
                color: var(--k-primary);
            }

            /* Badge Colors */
            .bg-success {
                background-color: var(--k-success) !important;
            }
            .bg-warning {
                background-color: var(--k-warning) !important;
            }
            .bg-danger {
                background-color: var(--k-danger) !important;
            }

            /* Toggle Buttons (estilo estándar Gestión de la Salud) */
            .ausentismo-toggles {
                display: flex;
                gap: 4px;
                margin: 4px 0;
                background: #f1f3f4;
                padding: 3px;
                border-radius: 6px;
            }
            .ausentismo-toggle {
                flex: 1;
                border: none;
                background: transparent;
                font-size: 0.7rem;
                padding: 2px 6px;
                border-radius: var(--k-radius-md);
                cursor: pointer;
                color: var(--k-text-muted);
                transition: all 0.2s;
            }
            .ausentismo-toggle.active {
                background: white;
                color: var(--k-primary);
                box-shadow: var(--k-shadow-sm);
                font-weight: 600;
            }

            /* Secciones de Gráficos y Listas */
            .charts-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 1.25rem;
            }

            .chart-container {
                background: var(--k-bg-card);
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-lg);
                padding: 1.5rem;
                box-shadow: var(--k-shadow-sm);
                min-height: auto;
                display: flex;
                flex-direction: column;
            }
            .chart-container h3 {
                margin-top: 0;
                margin-bottom: 1rem;
                font-size: 1.1rem;
                color: var(--k-text-main);
            }

            /* =========================================
               GRÁFICA DE AVANCE PLAN ANUAL (DONUT)
               ========================================= */
            
            .chart-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.25rem;
                padding-bottom: 1rem;
                border-bottom: 1px solid var(--k-border);
            }
            
            .chart-title {
                margin: 0;
                font-size: 1.2rem;
                color: var(--k-text-main);
                font-weight: 600;
            }
            
            .chart-subtitle {
                font-size: 0.8rem;
                color: var(--k-text-muted);
                margin-top: 0.35rem;
            }
            
            .chart-badge {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 1rem;
                border-radius: 2rem;
                font-size: 0.8rem;
                font-weight: 600;
            }
            
            .chart-badge i {
                font-size: 0.9rem;
            }
            
            .chart-badge-success {
                background: var(--k-success-light);
                color: var(--k-success);
            }
            
            .chart-badge-warning {
                background: var(--k-warning-light);
                color: #856404;
            }
            
            .chart-badge-danger {
                background: var(--k-danger-light);
                color: var(--k-danger);
            }
            
            .chart-content {
                display: flex;
                gap: 2rem;
                flex: 1;
                align-items: center;
            }
            
            /* Fullscreen: donut auto / tarjetas max 420px centradas */
            .chart-content.chart-fullscreen {
                gap: 2rem;
                min-height: 320px;
                justify-content: center;
            }
            .chart-content.chart-fullscreen .donut-chart-wrapper {
                flex: 0 0 auto;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .chart-content.chart-fullscreen .donut-chart-svg {
                width: 240px;
                height: 240px;
            }
            .chart-content.chart-fullscreen .donut-percentage {
                font-size: 3.5rem;
            }
            .chart-content.chart-fullscreen .donut-label {
                font-size: 1rem;
            }
            .chart-content.chart-fullscreen .chart-legend {
                flex: 1;
                min-width: 0;
                max-width: 420px;
                gap: 0.5rem;
                align-items: center;
            }
            .chart-content.chart-fullscreen .legend-item {
                padding: 0.6rem 1rem;
                gap: 0.6rem;
                max-width: 360px;
                width: 100%;
            }
            .chart-content.chart-fullscreen .legend-title {
                font-size: 0.7rem;
            }
            .chart-content.chart-fullscreen .legend-description {
                font-size: 0.6rem;
            }
            .chart-content.chart-fullscreen .legend-value {
                font-size: 0.85rem;
                min-width: 25px;
            }
            .chart-content.chart-fullscreen .legend-dot {
                width: 10px;
                height: 10px;
            }
            
            .donut-chart-wrapper {
                position: relative;
                flex-shrink: 0;
            }
            
            .donut-chart-svg {
                width: 160px;
                height: 160px;
                transform: rotate(-90deg);
                filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
            }
            
            .donut-segment {
                fill: none;
                stroke-linecap: round;
            }
            
            .donut-segment-bg {
                stroke: #e9ecef;
            }
            
            .donut-segment-progress {
                transition: stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1),
                            stroke 0.3s ease;
            }
            
            .donut-center-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
            }
            
            .donut-percentage {
                font-size: 2.8rem;
                font-weight: 700;
                color: var(--k-text-main);
                line-height: 1;
            }
            
            .donut-label {
                font-size: 0.75rem;
                color: var(--k-text-muted);
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-top: 0.35rem;
            }
            
            .chart-legend {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 0.6rem;
                justify-content: center;
            }
            
            .legend-item {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem 1rem;
                background: var(--k-bg-app);
                border-radius: var(--k-radius-md);
                border: 1px solid var(--k-border);
                transition: all 0.2s ease;
                cursor: pointer;
                min-width: 0;
            }
            
            .legend-item:hover {
                border-color: var(--k-primary);
                background: var(--k-primary-light);
                transform: translateX(5px);
            }
            
            .legend-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                flex-shrink: 0;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .legend-info {
                flex: 1;
                min-width: 0;
            }
            
            .legend-title {
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--k-text-main);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .legend-description {
                font-size: 0.65rem;
                color: var(--k-text-muted);
                margin-top: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .legend-value {
                font-size: 1rem;
                font-weight: 700;
                color: var(--k-text-main);
                text-align: right;
                min-width: 30px;
                flex-shrink: 0;
            }

            /* =========================================
               GRÁFICA DE OBJETIVOS SST (BARRAS)
               ========================================= */
            .objetivos-chart-wrapper {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-height: 0;
                padding: 0.5rem 0;
            }
            .objetivos-chart-wrapper canvas {
                flex: 1;
                min-height: 220px;
            }

            /* Responsive para la gráfica */
            .chart-container {
                overflow-x: hidden;
                max-width: 100%;
            }
            
            .donut-chart-wrapper {
                max-width: 100%;
            }
            
            @media (max-width: 992px) {
                .charts-grid {
                    grid-template-columns: 1fr;
                }
                .chart-content {
                    gap: 1.5rem;
                }
                .legend-item {
                    padding: 0.6rem 0.85rem;
                }
            }
            
            @media (max-width: 768px) {
                .charts-grid {
                    grid-template-columns: 1fr;
                }
                .chart-content {
                    flex-direction: column;
                    align-items: center;
                }
                
                .chart-stats {
                    grid-template-columns: 1fr;
                }

                .donut-percentage {
                    font-size: 2rem;
                }

                .chart-container {
                    min-height: auto;
                }

                .chart-header {
                    flex-direction: column;
                    gap: 1rem;
                    align-items: flex-start;
                }

                .chart-badge {
                    align-self: flex-start;
                }
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

/* ANULAR ESTILOS GLOBALES (styles.css) */
.gestion-integral-home .widget { margin-bottom: 0 !important; padding: 1rem !important; }
.gestion-integral-home .widgets-container { margin-bottom: 0 !important; }
.gestion-integral-home .chart-container { margin-top: 0 !important; margin-bottom: 0 !important; }

@media (max-width: 768px) {
                .submodules-list {
                    grid-template-columns: 1fr;
                }
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
            .submodule-info {
                flex: 1;
                margin-right: 1rem;
                min-width: 0;  /* Importante para text truncation */
            }
            .submodule-name {
                font-weight: 600;
                color: var(--k-text-main);
                font-size: 0.95rem;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .submodule-meta {
                font-size: 0.8rem;
                color: var(--k-text-muted);
                margin-top: 0.2rem;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .btn-ingresar {
                background-color: var(--k-primary);
                color: white;
                border: none;
                padding: 0.5rem 1.25rem;
                border-radius: var(--k-radius-md);
                font-weight: 500;
                font-size: 0.9rem;
                cursor: pointer;
                transition: background 0.2s;
                white-space: nowrap;
                flex-shrink: 0;  /* El botón no se encoje */
            }
            .btn-ingresar:hover { background-color: var(--k-primary-hover); }

            /* =========================================
               AJUSTES RESPONSIVE GENERALES
               ========================================= */
            
            /* Ajustar tamaños de fuente en tablets y móviles */
            @media (max-width: 768px) {
                .widget-value {
                    font-size: 1.2rem !important;
                }
                
                .kb-amount {
                    font-size: 1.2rem !important;
                }
                
                .widget h4 {
                    font-size: 0.6rem !important;
                }
                
                .kb-title {
                    font-size: 0.6rem !important;
                }
                
                .kb-badge {
                    font-size: 0.65rem !important;
                    padding: 0.15rem 0.4rem !important;
                }
                
                .widget {
                    padding: 0.75rem;
                    min-height: 100px;
                }
                
                .k-budget-card {
                    min-height: auto;
                }
                
                .chart-container {
                    padding: 1rem;
                }
                
                .submodule-name {
                    font-size: 0.85rem;
                }
            }
            
            /* Ajustes para móviles pequeños */
            @media (max-width: 480px) {
                .gestion-integral-home {
                    padding: 1rem;
                }
                
                .widget-value {
                    font-size: 1.1rem !important;
                }
                
                .kb-amount {
                    font-size: 1.1rem !important;
                }
                
                .donut-percentage {
                    font-size: 1.8rem;
                }
                
                .legend-item {
                    padding: 0.75rem;
                }
                
                .legend-value {
                    font-size: 1.1rem;
                }
            }
            
            /* Prevenir desbordamiento en submodules */
            .submodule-name {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                max-width: 220px;
            }

            @media (max-width: 768px) {
                .submodule-name {
                    max-width: 180px;
                }
                
                .btn-ingresar {
                    font-size: 0.85rem;
                    padding: 0.45rem 1rem;
                }
            }

            @media (max-width: 480px) {
                .submodule-name {
                    max-width: 160px;
                }
                
                .btn-ingresar {
                    font-size: 0.8rem;
                    padding: 0.4rem 0.85rem;
                }
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
        `;
        document.head.appendChild(style);
    }

    /**
     * Cargar estadísticas reales de Gestión Integral
     */
    async loadGestionIntegralStats() {
        try {
            console.log('🔄 [GestionIntegralHome] Cargando estadísticas para:', this.currentCompany);

            if (window.electronAPI && window.electronAPI.getGestionIntegralStats) {
                const result = await window.electronAPI.getGestionIntegralStats(this.currentCompany);
                if (result.success) {
                    this.gestionIntegralStats = result.stats;
                    console.log('✅ [GestionIntegralHome] Estadísticas cargadas:', this.gestionIntegralStats);
                } else {
                    console.warn('⚠️ [GestionIntegralHome] Error cargando estadísticas:', result.error);
                    this.gestionIntegralStats = null;
                }
            }
        } catch (error) {
            console.error('❌ [GestionIntegralHome] Error cargando estadísticas:', error);
            this.gestionIntegralStats = null;
        }
    }

    async renderMainArea(container) {
        // 📦491-fix — Limpiar skeleton antes de pintar widgets reales
        container.innerHTML = '';

        // Widgets con contadores específicos para Gestión Integral (USANDO DATOS REALES)
        const widgetsContainer = document.createElement('div');
        widgetsContainer.className = 'widgets-container';

        // Obtener datos reales o usar valores por defecto
        const politica = this.gestionIntegralStats?.politica || { estado: 'No disponible', actualizada: false };
        const objetivos = this.gestionIntegralStats?.objetivos || { total: 0, cumplidos: 0, porcentaje: 0 };
        const plan_trabajo = this.gestionIntegralStats?.plan_trabajo || {
            totalActividades: 0,
            actividadesEjecutadas: 0,
            actividadesPendientes: 0,
            actividadesProgramadas: 0,
            porcentajeAvance: 0,
            ultimoMesRegistrado: null,
            estado: 'warning'
        };
        const rendicion = this.gestionIntegralStats?.rendicion_cuentas || { actas_realizadas: 0 };
        // Estructura completa de evaluación inicial con las 3 fuentes de datos
        const evaluacion_inicial = this.gestionIntegralStats?.evaluacion_inicial || {
            disponible: false,
            combinado: {
                cumplimiento: 0,
                hallazgosCriticos: 0,
                hallazgosParciales: 0,
                hallazgosCumplidos: 0,
                totalHallazgos: 0
            },
            ministerio: {
                disponible: false,
                cumplimiento: 0,
                hallazgosCriticos: 0,
                hallazgosParciales: 0,
                hallazgosCumplidos: 0,
                totalHallazgos: 0,
                ultimoInforme: null
            },
            arl: {
                disponible: false,
                cumplimiento: 0,
                hallazgosCriticos: 0,
                hallazgosParciales: 0,
                hallazgosCumplidos: 0,
                totalHallazgos: 0,
                ultimoInforme: null
            }
        };

        console.log('[GestionIntegralHome] Datos Evaluación Inicial:', evaluacion_inicial);

        const widget1 = this.createWidget('Política SST', politica.estado, politica.actualizada ? '✅ Al día' : '⚠️ Por actualizar');
        const widget2 = this.createWidget('Objetivos SST', `${objetivos.cumplidos}/${objetivos.total}`, `📊 ${objetivos.porcentaje}% cumplimiento`);
        const widget3 = this.createPlanTrabajoWidget(plan_trabajo);  // ← NUEVO: Widget moderno
        const widget4 = this.createEvaluacionInicialWidget(evaluacion_inicial);  // ← NUEVO: Widget Evaluación Inicial
        const widget5 = this.createWidget('Rendición de Cuentas', `${rendicion.actas_realizadas} actas`, rendicion.actas_realizadas > 0 ? '✅ Realizadas' : '⚠️ Sin actas');

        widgetsContainer.appendChild(widget1);
        widgetsContainer.appendChild(widget2);
        widgetsContainer.appendChild(widget3);
        widgetsContainer.appendChild(widget4);
        widgetsContainer.appendChild(widget5);

        // Widget de Archivo y Retención Documental (2.5.1)
        try {
            if (window.electronAPI?.archivoRetencion?.getStats) {
                const statsResult = await window.electronAPI.archivoRetencion.getStats(this.currentCompany);
                if (statsResult?.success && statsResult?.data) {
                    const widget6 = this.createArchivoRetencionWidget(statsResult.data);
                    widget6.style.cursor = 'pointer';
                    widget6.title = 'Ver dashboard de gestión documental';
                    widget6.addEventListener('click', () => {
                        this.openArchivoRetencionDashboard();
                    });
                    widgetsContainer.appendChild(widget6);
                }
            }
        } catch (err) {
            console.warn('⚠️ [GestionIntegralHome] No se pudieron cargar stats de archivo retención:', err.message);
        }

        container.appendChild(widgetsContainer);

        // === NUEVA GRÁFICA DE DONA PARA AVANCE DEL PLAN ANUAL ===
        const chartsGrid = document.createElement('div');
        chartsGrid.className = 'charts-grid';
        const chartContainer = this.createAnnualPlanChart(plan_trabajo);
        chartsGrid.appendChild(chartContainer);

        // === GRÁFICA DE OBJETIVOS SST POR PRINCIPIO ===
        const principiosAutoResultados = this.gestionIntegralStats?.principiosAutoResultados || null;
        const objetivosChartContainer = this.createObjetivosChart(objetivos, principiosAutoResultados);
        chartsGrid.appendChild(objetivosChartContainer);

        container.appendChild(chartsGrid);

        const submodulesContainer = document.createElement('div');
        submodulesContainer.className = 'submodules-container';
        
        const submodulesTitle = document.createElement('h3');
        submodulesTitle.textContent = 'Submódulos';
        submodulesContainer.appendChild(submodulesTitle);
        
        const submodulesList = document.createElement('div');
        submodulesList.className = 'submodules-list';
        
        this.submodules.forEach(submodule => {
            const submoduleItem = this.renderSubmoduleItem(submodule);
            submodulesList.appendChild(submoduleItem);
        });
        
        submodulesContainer.appendChild(submodulesList);
        container.appendChild(submodulesContainer);

        this._logChartDiagnostics(`RENDER — DOM ready (isMaximized=${this._isMaximized ?? 'pending'})`);
        this.updateChartTexts(this._isMaximized ?? false);
    }

    createWidget(title, value, description) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        widget.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">${title}</span>
            </div>
            <div class="kb-amount">${value}</div>
            <div class="kb-description">${description}</div>
        `;
        return widget;
    }

    // Nuevo método para crear widget de Plan de Trabajo (estilo K+AIR Budget Card)
    createPlanTrabajoWidget(stats) {
        const currentYear = new Date().getFullYear();

        // Determinar color (semáforo)
        let colorVar = 'var(--k-success)';
        let colorClass = 'bg-success';
        if (stats.porcentajeAvance < 50) {
            colorVar = 'var(--k-danger)';
            colorClass = 'bg-danger';
        } else if (stats.porcentajeAvance < 80) {
            colorVar = 'var(--k-warning)';
            colorClass = 'bg-warning';
        }

        const w = document.createElement('div');
        w.className = 'widget k-budget-card';

        w.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">Plan de Trabajo ${currentYear}</span>
                <span class="kb-badge ${colorClass}">${stats.porcentajeAvance}%</span>
            </div>

            <div class="kb-amount" style="font-size: 1.4rem;">
                ${stats.actividadesEjecutadas} / ${stats.actividadesProgramadas}
            </div>
            <div class="kb-description">Actividades del plan anual ejecutadas</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};">
                    <div class="kb-shimmer"></div>
                </div>
            </div>

            <div class="kb-footer">
                <div>
                    <div class="kb-label">Ejecutadas</div>
                    <div class="kb-value kb-exec" style="color: var(--k-success);">${stats.actividadesEjecutadas}</div>
                </div>
                <div style="text-align: right;">
                    <div class="kb-label">Pendientes</div>
                    <div class="kb-value kb-rem" style="color: var(--k-text-muted);">${stats.actividadesPendientes}</div>
                </div>
            </div>
        `;

        // Animación de barra (después de insertar en DOM)
        setTimeout(() => {
            const bar = w.querySelector('.kb-progress-bar');
            if (bar) {
                bar.style.width = `${stats.porcentajeAvance}%`;
            }
        }, 100);

        return w;
    }

    // Widget de Archivo y Retención Documental (estilo K+AIR Budget Card)
    createArchivoRetencionWidget(stats) {
        // Determinar color (semáforo por vigencia)
        let colorVar = 'var(--k-success)';
        let colorClass = 'bg-success';
        if (stats.porcentajeVigencia < 50) {
            colorVar = 'var(--k-danger)';
            colorClass = 'bg-danger';
        } else if (stats.porcentajeVigencia < 80) {
            colorVar = 'var(--k-warning)';
            colorClass = 'bg-warning';
        }

        const w = document.createElement('div');
        w.className = 'widget k-budget-card';

        w.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">📁 Gestión Documental</span>
                <span class="kb-badge ${colorClass}">${stats.porcentajeVigencia}%</span>
            </div>

            <div class="kb-amount" style="font-size: 1.4rem;">
                ${stats.vigentes} / ${stats.total}
            </div>
            <div class="kb-description">Documentos con vigencia verificada</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};">
                    <div class="kb-shimmer"></div>
                </div>
            </div>

            <div class="kb-footer">
                <div>
                    <div class="kb-label">Vigentes</div>
                    <div class="kb-value" style="color: var(--k-success);">${stats.vigentes}</div>
                </div>
                <div style="text-align: right;">
                    <div class="kb-label">Obsoletos</div>
                    <div class="kb-value" style="color: var(--k-text-muted);">${stats.obsoletos}</div>
                </div>
            </div>
        `;

        // Animación de barra
        setTimeout(() => {
            const bar = w.querySelector('.kb-progress-bar');
            if (bar) {
                bar.style.width = `${stats.porcentajeVigencia}%`;
            }
        }, 100);

        return w;
    }

    /**
     * Abre el dashboard de Archivo y Retención Documental
     */
    async openArchivoRetencionDashboard() {
        // Buscar el contenedor principal del módulo en el DOM
        const mainContent = document.querySelector('.module-content, .submodule-content, #module-home-page');
        if (!mainContent) {
            console.error('[AR] No se encontró contenedor para el dashboard');
            return;
        }

        // Limpiar y cargar directamente el componente de archivo retención
        // que luego abrirá el dashboard
        if (window.ArchivoRetencionComponent && window.archivoRetencionInstance) {
            window.archivoRetencionInstance.openDashboard();
        } else {
            // Si no hay instancia, crear una nueva
            const tempContainer = document.createElement('div');
            tempContainer.style.cssText = 'width:100%;height:100%;';

            // Reemplazar el contenido actual del panel
            const parent = mainContent.closest('.content-area, .main-content') || mainContent;
            parent.innerHTML = '';
            parent.appendChild(tempContainer);

            const comp = new window.ArchivoRetencionComponent(
                tempContainer,
                this.currentCompany,
                'Gestión Integral',
                '2.5.1 Archivo y retención documental del SG-SST',
                () => this.container.dispatchEvent(new CustomEvent('back-to-module'))
            );
            window.archivoRetencionInstance = comp;
            comp.render();

            // Abrir dashboard después de que el iframe esté listo
            setTimeout(() => comp.openDashboard(), 300);
        }
    }

    /**
     * Crea widget de Evaluación Inicial del SG-SST (estilo K+AIR Metric Card)
     * @param {Object} stats - Estadísticas completas: { combinado, ministerio, arl }
     */
    createEvaluacionInicialWidget(stats) {
        console.log('[EvaluacionWidget] Datos recibidos:', stats);
        
        // Estado del filtro (por defecto 'combinado')
        if (!this.evaluacionFilter) {
            this.evaluacionFilter = 'combinado';
        }

        // Obtener datos según el filtro activo
        const data = stats[this.evaluacionFilter] || stats.combinado || {
            disponible: false,
            cumplimiento: 0,
            hallazgosCriticos: 0,
            totalHallazgos: 0
        };

        console.log('[EvaluacionWidget] Filtro:', this.evaluacionFilter, 'Datos a mostrar:', data);

        const cumplimiento = data.cumplimiento || 0;
        const hallazgosCriticos = data.hallazgosCriticos || 0;
        const totalHallazgos = data.totalHallazgos || 0;

        // Determinar color según cumplimiento
        let colorVar = 'var(--k-danger)';
        let colorClass = 'bg-danger';

        if (cumplimiento >= 80) {
            colorVar = 'var(--k-success)';
            colorClass = 'bg-success';
        } else if (cumplimiento >= 50) {
            colorVar = 'var(--k-warning)';
            colorClass = 'bg-warning';
        }

        const w = document.createElement('div');
        w.className = 'widget k-budget-card';
        w.id = 'evaluacion-inicial-widget';

        w.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">📋 Evaluación Inicial</span>
                <span class="kb-badge ${colorClass}">${cumplimiento}%</span>
            </div>

            <div class="ausentismo-toggles">
                <button class="ausentismo-toggle ${this.evaluacionFilter === 'combinado' ? 'active' : ''}" 
                        onclick="window.currentGestionIntegralHome.updateEvaluacionFilter('combinado')">
                    Todo
                </button>
                <button class="ausentismo-toggle ${this.evaluacionFilter === 'ministerio' ? 'active' : ''}" 
                        onclick="window.currentGestionIntegralHome.updateEvaluacionFilter('ministerio')">
                    🏛️ Min
                </button>
                <button class="ausentismo-toggle ${this.evaluacionFilter === 'arl' ? 'active' : ''}" 
                        onclick="window.currentGestionIntegralHome.updateEvaluacionFilter('arl')">
                    🛡️ ARL
                </button>
            </div>

            <div class="kb-amount" style="font-size: 1.4rem; margin-top: 12px;">
            </div>
            <div class="kb-description">Cumplimiento de estándares del SG-SST</div>

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};">
                    <div class="kb-shimmer"></div>
                </div>
            </div>

            <div class="kb-footer">
                <div>
                    <div class="kb-label">No Cumple</div>
                    <div class="kb-value" style="color: var(--k-danger);">${hallazgosCriticos}</div>
                </div>
                <div style="text-align: right;">
                    <div class="kb-label">Total Estándares</div>
                    <div class="kb-value">${totalHallazgos}</div>
                </div>
            </div>
        `;

        // Animación de barra
        setTimeout(() => {
            const bar = w.querySelector('.kb-progress-bar');
            if (bar) {
                bar.style.width = `${cumplimiento}%`;
            }
        }, 100);

        return w;
    }

    /**
     * Actualiza el filtro de Evaluación Inicial y re-renderiza el widget
     */
    updateEvaluacionFilter(newFilter) {
        console.log('[GestionIntegralHome] Actualizando filtro Evaluación Inicial:', newFilter);
        this.evaluacionFilter = newFilter;
        
        // Re-renderizar el área principal con los nuevos datos
        const container = document.querySelector('.gestion-integral-home .widgets-container');
        if (container && this.gestionIntegralStats) {
            // Eliminar widget actual
            const oldWidget = document.getElementById('evaluacion-inicial-widget');
            if (oldWidget) {
                oldWidget.remove();
            }
            
            // Crear nuevo widget con el filtro actualizado
            const evaluacionStats = this.gestionIntegralStats.evaluacion_inicial || {};
            const newWidget = this.createEvaluacionInicialWidget(evaluacionStats);
            
            // Insertar después del widget de Evaluación Inicial original (o al final)
            const evalWidget = document.getElementById('evaluacion-inicial-widget');
            if (evalWidget && evalWidget.parentElement === container) {
                // Re-insertar en la misma posición que el widget original
                container.insertBefore(newWidget, evalWidget.nextSibling);
            } else {
                // Fallback: insertar después del 3er widget (Plan de Trabajo)
                const planTrabajoWidget = container.children[2];
                if (planTrabajoWidget) {
                    container.insertBefore(newWidget, planTrabajoWidget.nextSibling);
                } else {
                    container.appendChild(newWidget);
                }
            }
        }
    }

    /**
     * Crea la gráfica de dona para el Avance del Plan Anual
     */
    createAnnualPlanChart(stats) {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        const percentage = stats.porcentajeAvance || 0;
        const executed = stats.actividadesEjecutadas || 0;
        const pending = stats.actividadesPendientes || 0;
        const programmed = stats.actividadesProgramadas || 0;
        const total = stats.totalActividades || programmed;
        
        // Determinar estado y colores
        let statusClass = 'chart-badge-success';
        let statusText = 'En buen camino';
        let progressColor = 'var(--k-success)';
        
        const expectedProgress = Math.round((currentMonth / 12) * 100);
        
        if (percentage < 50) {
            statusClass = 'chart-badge-danger';
            statusText = 'Requiere atención urgente';
            progressColor = 'var(--k-danger)';
        } else if (percentage < expectedProgress) {
            statusClass = 'chart-badge-warning';
            statusText = 'Progreso moderado';
            progressColor = 'var(--k-warning)';
        }

        // Store metadata for fullscreen/windowed text switching
        this._chartMeta = {
            currentYear,
            lastUpdatedText: this.getLastUpdatedText(stats.ultimoMesRegistrado),
            statusText,
            statusClass,
            percentage,
            expectedProgress
        };
        
        // SVG Parameters
        const size = 160;
        const strokeWidth = 18;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;
        
        const container = document.createElement('div');
        container.className = 'chart-container';
        
        container.innerHTML = `
            <div class="chart-header">
                <div>
                    <h3 class="chart-title" id="chart-title">📈 Avance del Plan Anual SST</h3>
                    <p class="chart-subtitle" id="chart-subtitle">Plan de Trabajo ${currentYear} • Actualizado ${this.getLastUpdatedText(stats.ultimoMesRegistrado)}</p>
                </div>
                <div class="chart-badge ${statusClass}" id="chart-badge">
                    <i class="bi bi-${percentage >= expectedProgress ? 'check-circle-fill' : 'exclamation-triangle-fill'}"></i>
                    ${statusText}
                </div>
            </div>
            
            <div class="chart-content" id="plan-chart-content">
                <div class="donut-chart-wrapper">
                    <svg class="donut-chart-svg" viewBox="0 0 ${size} ${size}">
                        <circle 
                            class="donut-segment donut-segment-bg"
                            cx="${size/2}" 
                            cy="${size/2}" 
                            r="${radius}"
                            stroke-width="${strokeWidth}"
                        />
                        <circle 
                            class="donut-segment donut-segment-progress"
                            id="donut-progress"
                            cx="${size/2}" 
                            cy="${size/2}" 
                            r="${radius}"
                            stroke-width="${strokeWidth}"
                            stroke="${progressColor}"
                            stroke-dasharray="${circumference}"
                            stroke-dashoffset="${circumference}"
                        />
                    </svg>
                    <div class="donut-center-text">
                        <div class="donut-percentage" id="donut-percentage">0%</div>
                        <div class="donut-label">Avance</div>
                    </div>
                </div>
                
                <div class="chart-legend">
                    <div class="legend-item">
                        <div class="legend-dot" style="background: var(--k-success);"></div>
                        <div class="legend-info">
                            <div class="legend-title" id="legend-title-1">Act. Ejec.</div>
                            <div class="legend-description">Completadas satisfactoriamente</div>
                        </div>
                        <div class="legend-value" style="color: var(--k-success);">${executed}</div>
                    </div>
                    
                    <div class="legend-item">
                        <div class="legend-dot" style="background: var(--k-warning);"></div>
                        <div class="legend-info">
                            <div class="legend-title" id="legend-title-2">Act. Pend.</div>
                            <div class="legend-description">En proceso o por iniciar</div>
                        </div>
                        <div class="legend-value" style="color: var(--k-warning);">${pending}</div>
                    </div>
                    
                    <div class="legend-item">
                        <div class="legend-dot" style="background: var(--k-info);"></div>
                        <div class="legend-info">
                            <div class="legend-title" id="legend-title-3">Total Prog.</div>
                            <div class="legend-description">Plan anual completo</div>
                        </div>
                        <div class="legend-value">${total}</div>
                    </div>
                </div>
            </div>
        `;

        // Animar después de insertar en DOM
        setTimeout(() => {
            this.animateDonutChart(percentage, offset);
        }, 100);

        return container;
    }

    /**
     * Anima la gráfica de dona
     */
    animateDonutChart(percentage, offset) {
        const progressCircle = document.getElementById('donut-progress');
        const percentageText = document.getElementById('donut-percentage');
        
        if (!progressCircle || !percentageText) return;
        
        setTimeout(() => {
            progressCircle.style.strokeDashoffset = offset;
        }, 100);
        
        this.animateCounter(percentageText, 0, percentage, 1500, '%');
    }

    /**
     * Crea la gráfica de barras horizontales para Objetivos SST por principio
     */
    createObjetivosChart(objetivos, principiosAutoResultados) {
        const porPrincipio = objetivos.porPrincipio || {
            1: { total: 0, cumplidos: 0, porcentaje: 0 },
            2: { total: 0, cumplidos: 0, porcentaje: 0 },
            3: { total: 0, cumplidos: 0, porcentaje: 0 },
            4: { total: 0, cumplidos: 0, porcentaje: 0 }
        };

        const container = document.createElement('div');
        container.className = 'chart-container';

        const statusClass = objetivos.porcentaje >= 70 ? 'chart-badge-success'
            : objetivos.porcentaje >= 40 ? 'chart-badge-warning'
            : 'chart-badge-danger';

        container.innerHTML = `
            <div class="chart-header">
                <div>
                    <h3 class="chart-title" id="obj-chart-title">📊 Objetivos SST</h3>
                    <p class="chart-subtitle" id="obj-chart-subtitle">${objetivos.cumplidos}/${objetivos.total} cumplidos</p>
                </div>
                <div class="chart-badge ${statusClass}" id="obj-chart-badge">
                    <i class="bi bi-${objetivos.porcentaje >= 70 ? 'check-circle-fill' : 'exclamation-triangle-fill'}"></i>
                    ${objetivos.porcentaje}% cumplimiento
                </div>
            </div>
            <div class="objetivos-chart-wrapper">
                <canvas id="objetivosChart"></canvas>
            </div>
        `;

        // Guardar textos para switching fullscreen
        this._objChartMeta = {
            total: objetivos.total,
            cumplidos: objetivos.cumplidos,
            porcentaje: objetivos.porcentaje
        };

        // Renderizar Chart.js después de insertar en DOM
        setTimeout(() => {
            this._renderObjetivosBarChart(porPrincipio, objetivos, principiosAutoResultados);
        }, 100);

        return container;
    }

    /**
     * Renderiza la gráfica de barras horizontales con Chart.js
     */
    _renderObjetivosBarChart(porPrincipio, objetivos, principiosAutoResultados) {
        if (typeof Chart === 'undefined') return;
        const canvas = document.getElementById('objetivosChart');
        if (!canvas) return;

        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        const labels = ['Principio 1', 'Principio 2', 'Principio 3', 'Principio 4'];
        const cumplidos = [1, 2, 3, 4].map(pid => porPrincipio[pid].cumplidos);
        const pendientes = [1, 2, 3, 4].map(pid => porPrincipio[pid].total - porPrincipio[pid].cumplidos);

        // Auto-resultados: promedio de avance por principio (0-100)
        const autoAvance = [1, 2, 3, 4].map(pid => {
            if (principiosAutoResultados && principiosAutoResultados[pid]) {
                return principiosAutoResultados[pid].porcentajePromedio || 0;
            }
            return 0;
        });

        const hasAutoData = autoAvance.some(v => v > 0);

        const datasets = [
            {
                label: 'Cumplidos',
                data: cumplidos,
                backgroundColor: 'rgba(23, 78, 166, 0.8)',
                borderColor: '#174ea6',
                borderWidth: 1,
                borderRadius: 3,
                stack: 'objetivos'
            },
            {
                label: 'Pendientes',
                data: pendientes,
                backgroundColor: 'rgba(200, 200, 200, 0.4)',
                borderColor: '#c8c8c8',
                borderWidth: 1,
                borderRadius: 3,
                stack: 'objetivos'
            }
        ];

        if (hasAutoData) {
            datasets.push({
                label: 'Indicadores (%)',
                data: autoAvance,
                backgroundColor: 'rgba(40, 167, 69, 0.7)',
                borderColor: '#28a745',
                borderWidth: 1,
                borderRadius: 3,
                stack: 'indicadores'
            });
        }

        new Chart(canvas, {
            type: 'bar',
            data: { labels, datasets },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: { stepSize: 1, precision: 0, font: { size: 11 } },
                        grid: { display: false },
                        title: { display: true, text: hasAutoData ? 'Cantidad / % Avance' : 'Cantidad', font: { size: 10 } }
                    },
                    y: {
                        stacked: true,
                        ticks: { font: { size: 11, weight: '500' } },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 15, usePointStyle: true, pointStyle: 'rectRounded', font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const pid = ctx.dataIndex + 1;
                                const p = porPrincipio[pid];
                                if (ctx.dataset.label === 'Indicadores (%)') {
                                    const auto = principiosAutoResultados?.[pid];
                                    const total = auto?.totalKeywords || 0;
                                    return ` Indicadores: ${ctx.raw}% promedio (${total} indicadores)`;
                                }
                                return ` ${ctx.dataset.label}: ${ctx.raw} (${p.total > 0 ? Math.round((ctx.raw / p.total) * 100) : 0}%)`;
                            },
                            afterBody: (tooltipItems) => {
                                const pid = tooltipItems[0].dataIndex + 1;
                                const p = porPrincipio[pid];
                                const lines = [`Total: ${p.cumplidos}/${p.total} (${p.porcentaje}%)`];
                                if (hasAutoData && principiosAutoResultados?.[pid]) {
                                    const auto = principiosAutoResultados[pid];
                                    const kws = Object.keys(auto.keywords || {}).slice(0, 5);
                                    if (kws.length > 0) {
                                        lines.push(`Indicadores: ${kws.join(', ')}${auto.totalKeywords > 5 ? '...' : ''}`);
                                    }
                                }
                                return lines;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Actualiza textos del chart según modo ventana/pantalla completa
     */
    updateChartTexts(isFullscreen) {
        const meta = this._chartMeta;
        if (!meta) return;

        // Toggle layout fullscreen en el chart de plan de trabajo
        const chartContent = document.getElementById('plan-chart-content');
        if (chartContent) {
            chartContent.classList.toggle('chart-fullscreen', isFullscreen);
        }

        const title = document.getElementById('chart-title');
        const subtitle = document.getElementById('chart-subtitle');
        const badge = document.getElementById('chart-badge');
        const legend1 = document.getElementById('legend-title-1');
        const legend2 = document.getElementById('legend-title-2');
        const legend3 = document.getElementById('legend-title-3');

        if (title) {
            title.textContent = isFullscreen
                ? '📈 Avance del Plan Anual SST'
                : '📈 Plan Anual SST';
        }

        if (subtitle) {
            subtitle.textContent = isFullscreen
                ? `Plan de Trabajo ${meta.currentYear} • Actualizado ${meta.lastUpdatedText}`
                : `Plan ${meta.currentYear} • ${meta.lastUpdatedText}`;
        }

        if (badge) {
            const statusMap = {
                'Requiere atención urgente': { full: 'Requiere atención urgente', short: 'Atención urgente' },
                'Progreso moderado': { full: 'Progreso moderado', short: 'Moderado' },
                'En buen camino': { full: 'En buen camino', short: 'En buen camino' }
            };
            const mapped = statusMap[meta.statusText];
            if (mapped) {
                const icon = meta.percentage >= meta.expectedProgress
                    ? 'check-circle-fill'
                    : 'exclamation-triangle-fill';
                badge.innerHTML = `<i class="bi bi-${icon}"></i> ${isFullscreen ? mapped.full : mapped.short}`;
            }
        }

        if (legend1) legend1.textContent = isFullscreen ? 'Actividades Ejecutadas' : 'Act. Ejec.';
        if (legend2) legend2.textContent = isFullscreen ? 'Actividades Pendientes' : 'Act. Pend.';
        if (legend3) legend3.textContent = isFullscreen ? 'Total Programadas' : 'Total Prog.';

        this._logChartDiagnostics(`updateChartTexts(isFullscreen=${isFullscreen})`);
    }

    /**
     * Diagnóstico visual: mide dimensiones, posición y proporciones del donut vs tarjetas
     */
    _logChartDiagnostics(context) {
        const chartContent = document.getElementById('plan-chart-content');
        if (!chartContent) { console.log(`[CHART-DIAG] ${context} — chart-content NOT FOUND`); return; }

        const cc = chartContent.getBoundingClientRect();
        const donut = chartContent.querySelector('.donut-chart-wrapper');
        const legend = chartContent.querySelector('.chart-legend');
        const svg = chartContent.querySelector('.donut-chart-svg');
        const container = chartContent.closest('.chart-container');

        const d = donut?.getBoundingClientRect();
        const l = legend?.getBoundingClientRect();
        const c = container?.getBoundingClientRect();

        console.log(`[CHART-DIAG] ═══ ${context} ═══`);
        console.log(`[CHART-DIAG] State: classList = "${chartContent.className}"`);
        console.log(`[CHART-DIAG] Window: ${Math.round(window.innerWidth)}×${Math.round(window.innerHeight)}`);
        console.log(`[CHART-DIAG] Container (.chart-container): ${c ? Math.round(c.width)+'×'+Math.round(c.height) : 'N/A'}`);
        console.log(`[CHART-DIAG] Flex row (.chart-content): ${Math.round(cc.width)}×${Math.round(cc.height)}`);
        console.log(`[CHART-DIAG] Donut: ${d ? Math.round(d.width)+'×'+Math.round(d.height) : 'N/A'} → ${d ? Math.round(d.width/cc.width*100)+'%' : 'N/A'} del flex`);
        console.log(`[CHART-DIAG] Legend: ${l ? Math.round(l.width)+'×'+Math.round(l.height) : 'N/A'} → ${l ? Math.round(l.width/cc.width*100)+'%' : 'N/A'} del flex`);
        console.log(`[CHART-DIAG] SVG size: ${svg ? getComputedStyle(svg).width : 'N/A'}`);
        console.log(`[CHART-DIAG] Gap: ${getComputedStyle(chartContent).gap}`);

        const items = chartContent.querySelectorAll('.legend-item');
        items.forEach((item, i) => {
            const r = item.getBoundingClientRect();
            console.log(`[CHART-DIAG]   Card ${i+1}: ${Math.round(r.width)}×${Math.round(r.height)}`);
        });
        console.log(`[CHART-DIAG] ══════════════════════`);
    }

    /**
     * Anima un contador numérico
     */
    animateCounter(element, start, end, duration, suffix = '') {
        const startTime = performance.now();
        const diff = end - start;
        
        const step = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + diff * easeOut);
            
            element.textContent = current + suffix;
            
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        };
        
        requestAnimationFrame(step);
    }

    /**
     * Obtiene texto legible para el último mes registrado
     */
    getLastUpdatedText(lastMonth) {
        if (!lastMonth) {
            return 'recientemente';
        }
        
        const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        
        return `en ${months[lastMonth - 1] || 'el último mes'}`;
    }

    /**
     * Obtiene meses restantes del año
     */
    getMonthsRemaining() {
        const currentMonth = new Date().getMonth() + 1;
        return Math.max(0, 12 - currentMonth);
    }

    renderSubmoduleItem(name) {
        // Generar datos simulados para el submódulo
        const lastAccess = this.getRandomLastAccess();
        const timeSpent = this.getRandomTimeSpent();

        const submoduleItem = document.createElement('div');
        submoduleItem.className = 'submodule-item';

        const submoduleInfo = document.createElement('div');
        submoduleInfo.className = 'submodule-info';

        const submoduleName = document.createElement('div');
        submoduleName.className = 'submodule-name';
        submoduleName.textContent = name;
        submoduleInfo.appendChild(submoduleName);

        const submoduleMeta = document.createElement('div');
        submoduleMeta.className = 'submodule-meta';
        submoduleMeta.textContent = `Último acceso: ${lastAccess} | Tiempo: ${timeSpent}`;
        submoduleInfo.appendChild(submoduleMeta);

        const button = document.createElement('button');
        button.className = 'btn btn-primary btn-ingresar';
        button.textContent = 'Ingresar';
        button.addEventListener('click', () => {
            showSubmoduleContent(document.querySelector('.main-canvas'), this.moduleName, name);
        });

        submoduleItem.appendChild(submoduleInfo);
        submoduleItem.appendChild(button);
        
        return submoduleItem;
    }
    
    getRandomLastAccess() {
        const days = ['Hace 1 día', 'Hace 2 días', 'Hace 3 días', 'Hace 1 semana', 'Hace 2 semanas'];
        return days[Math.floor(Math.random() * days.length)];
    }
    
    getRandomTimeSpent() {
        const times = ['5 min', '15 min', '30 min', '1 hora', '2 horas'];
        return times[Math.floor(Math.random() * times.length)];
    }
    
    async renderSidebarPanel(container) {
    }
}

// Hacer la clase disponible globalmente
window.GestionIntegralHome = GestionIntegralHome;