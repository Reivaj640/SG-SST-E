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

        // 0. Cargar estadísticas reales de Gestión Integral
        await this.loadGestionIntegralStats();

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

        this.renderMainArea(mainArea);

        contentContainer.appendChild(mainArea);
        layout.appendChild(contentContainer);
        this.container.appendChild(layout);
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
                gap: 1.5rem;
                overflow-y: auto;
                padding-right: 0.5rem;
                width: 100%;
                flex: 1;
                min-height: 0;
            }

            /* Grid de Widgets */
            .widgets-container {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
            }

            @media (max-width: 768px) {
                .widgets-container {
                    grid-template-columns: repeat(2, 1fr);
                    gap: 0.75rem;
                }
            }

            @media (max-width: 480px) {
                .widgets-container {
                    grid-template-columns: 1fr;
                }
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
                overflow-wrap: break-word;
                word-wrap: break-word;
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

            /* Secciones de Gráficos y Listas */
            .chart-container {
                background: var(--k-bg-card);
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-lg);
                padding: 1.5rem;
                box-shadow: var(--k-shadow-sm);
                min-height: 450px;
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
            
            .donut-chart-wrapper {
                position: relative;
                flex-shrink: 0;
            }
            
            .donut-chart-svg {
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
                gap: 1rem;
            }
            
            .legend-item {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem 1.25rem;
                background: var(--k-bg-app);
                border-radius: var(--k-radius-md);
                border: 1px solid var(--k-border);
                transition: all 0.2s ease;
                cursor: pointer;
            }
            
            .legend-item:hover {
                border-color: var(--k-primary);
                background: var(--k-primary-light);
                transform: translateX(5px);
            }
            
            .legend-dot {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                flex-shrink: 0;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .legend-info {
                flex: 1;
            }
            
            .legend-title {
                font-size: 0.85rem;
                font-weight: 600;
                color: var(--k-text-main);
            }
            
            .legend-description {
                font-size: 0.75rem;
                color: var(--k-text-muted);
                margin-top: 0.2rem;
            }
            
            .legend-value {
                font-size: 1.25rem;
                font-weight: 700;
                color: var(--k-text-main);
                text-align: right;
                min-width: 40px;
            }

            /* Responsive para la gráfica */
            .chart-container {
                overflow-x: hidden;
                max-width: 100%;
            }
            
            .chart-content {
                flex-wrap: wrap;
            }
            
            .donut-chart-wrapper {
                max-width: 100%;
            }
            
            @media (max-width: 1200px) {
                .chart-content {
                    flex-direction: column;
                    align-items: center;
                }

                .chart-legend {
                    width: 100%;
                }
            }

            @media (max-width: 768px) {
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

    renderMainArea(container) {
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

        const widget1 = this.createWidget('Política SST', politica.estado, politica.actualizada ? '✅ Al día' : '⚠️ Por actualizar');
        const widget2 = this.createWidget('Objetivos SST', `${objetivos.cumplidos}/${objetivos.total}`, `📊 ${objetivos.porcentaje}% cumplimiento`);
        const widget3 = this.createPlanTrabajoWidget(plan_trabajo);  // ← NUEVO: Widget moderno
        const widget4 = this.createWidget('Rendición de Cuentas', `${rendicion.actas_realizadas} actas`, rendicion.actas_realizadas > 0 ? '✅ Realizadas' : '⚠️ Sin actas');

        widgetsContainer.appendChild(widget1);
        widgetsContainer.appendChild(widget2);
        widgetsContainer.appendChild(widget3);
        widgetsContainer.appendChild(widget4);

        container.appendChild(widgetsContainer);

        // === NUEVA GRÁFICA DE DONA PARA AVANCE DEL PLAN ANUAL ===
        const chartContainer = this.createAnnualPlanChart(plan_trabajo);
        container.appendChild(chartContainer);

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
    }
    
    createWidget(title, value, description) {
        const widget = document.createElement('div');
        widget.className = 'widget';
        widget.innerHTML = `
            <h4>${title}</h4>
            <div class="widget-value">${value}</div>
            <div class="widget-description">${description}</div>
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

            <div class="kb-progress-track">
                <div class="kb-progress-bar" style="width: 0%; background-color: ${colorVar};"></div>
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
        
        // SVG Parameters
        const size = 200;
        const strokeWidth = 20;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;
        
        const container = document.createElement('div');
        container.className = 'chart-container';
        
        container.innerHTML = `
            <div class="chart-header">
                <div>
                    <h3 class="chart-title">📈 Avance del Plan Anual SST</h3>
                    <p class="chart-subtitle">Plan de Trabajo ${currentYear} • Actualizado ${this.getLastUpdatedText(stats.ultimoMesRegistrado)}</p>
                </div>
                <div class="chart-badge ${statusClass}">
                    <i class="bi bi-${percentage >= expectedProgress ? 'check-circle-fill' : 'exclamation-triangle-fill'}"></i>
                    ${statusText}
                </div>
            </div>
            
            <div class="chart-content">
                <div class="donut-chart-wrapper">
                    <svg class="donut-chart-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
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
                            <div class="legend-title">Actividades Ejecutadas</div>
                            <div class="legend-description">Completadas satisfactoriamente</div>
                        </div>
                        <div class="legend-value" style="color: var(--k-success);">${executed}</div>
                    </div>
                    
                    <div class="legend-item">
                        <div class="legend-dot" style="background: var(--k-warning);"></div>
                        <div class="legend-info">
                            <div class="legend-title">Actividades Pendientes</div>
                            <div class="legend-description">En proceso o por iniciar</div>
                        </div>
                        <div class="legend-value" style="color: var(--k-warning);">${pending}</div>
                    </div>
                    
                    <div class="legend-item">
                        <div class="legend-dot" style="background: var(--k-info);"></div>
                        <div class="legend-info">
                            <div class="legend-title">Total Programadas</div>
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