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

        // Widgets Simples (Actualizados)
        widgetsContainer.appendChild(this.createWidget('Inducciones', '124 / 150', '⚠️ 26 Pendientes (Crítico)'));
        widgetsContainer.appendChild(this.createWidget('Capacitaciones', '82%', '✔ Al cumplimiento normativo'));
        widgetsContainer.appendChild(this.createWidget('EPPs Entregados', '1,020', 'Stock actual óptimo'));

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
            let file = result.files.find(f => f.name.includes(currentYear.toString()));
            if(!file) file = result.files[0];

            const dataResult = await window.electronAPI.readPresupuestoData(file.path);
            if (!dataResult.success) return this.renderBudgetWidgetError('Error lectura');

            const { totalPresupuesto, totalEjecutado, porcentajeCumplimiento, saldoDisponible } =
                this.calculateBudgetSummary(dataResult.data.processedData);

            const validTotal = typeof totalPresupuesto === 'number' ? totalPresupuesto : 0;
            const validEjecutado = typeof totalEjecutado === 'number' ? totalEjecutado : 0;
            const validPct = typeof porcentajeCumplimiento === 'number' ? porcentajeCumplimiento : 0;
            const validSaldo = typeof saldoDisponible === 'number' ? saldoDisponible : (validTotal - validEjecutado);

            this.budgetData = {
                company: this.currentCompany,
                totalPresupuesto: validTotal,
                totalEjecutado: validEjecutado,
                porcentajeCumplimiento: validPct,
                saldoDisponible: validSaldo
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
        processedData.forEach(row => {
            if (row.id && typeof row.id === 'string' && row.id.toUpperCase().includes('TOTAL')) return;
            const valP = this.parseFormattedNumber(row.asignacion);
            const valE = this.parseFormattedNumber(row.ejecutado_acumulado);
            if(!isNaN(valP)) totalP += valP;
            if(!isNaN(valE)) totalE += valE;
        });
        const pct = totalP > 0 ? ((totalE / totalP) * 100) : 0;
        return { totalPresupuesto: totalP, totalEjecutado: totalE, porcentajeCumplimiento: pct, saldoDisponible: totalP - totalE };
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
    initCharts() {
        // Configuración Global
        if (typeof Chart !== 'undefined') {
            Chart.defaults.font.family = "'Segoe UI', sans-serif";
            Chart.defaults.color = '#6c757d';
        }

        // 1. Budget Chart (Line: Planned vs Real)
        const ctxBudget = document.getElementById('budgetChart');
        if(ctxBudget && typeof Chart !== 'undefined') {
            this.charts.budget = new Chart(ctxBudget, {
                type: 'line',
                data: {
                    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago'],
                    datasets: [
                        {
                            label: 'Planeado (S-Curve)',
                            data: [5, 12, 20, 28, 35, 42, 50, 58],
                            borderColor: '#dee2e6', // Gris suave para lo planeado
                            borderDash: [5, 5],
                            fill: false,
                            tension: 0.4
                        },
                        {
                            label: 'Ejecutado Real',
                            data: [4.5, 11, 19, 25, 32, 40, 48, 55],
                            borderColor: '#174ea6', // K+AIR Primary
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

        // 2. Training Chart (Bar: Programadas vs Realizadas)
        const ctxTraining = document.getElementById('trainingChart');
        if(ctxTraining && typeof Chart !== 'undefined') {
            this.charts.training = new Chart(ctxTraining, {
                type: 'bar',
                data: {
                    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago'],
                    datasets: [
                        {
                            label: 'Programadas',
                            data: [5, 6, 5, 7, 6, 8, 5, 6],
                            backgroundColor: '#dee2e6',
                            borderRadius: 4
                        },
                        {
                            label: 'Realizadas',
                            data: [5, 5, 6, 6, 7, 7, 5, 5],
                            backgroundColor: '#28a745', // Success
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { x: { stacked: false }, y: { beginAtZero: true, ticks: { precision: 0 } } },
                    plugins: { legend: { display: false } } // Ocultar leyenda para ahorrar espacio
                }
            });
        }

        // 3. Induction Chart (Line: Tendencia)
        const ctxInduction = document.getElementById('inductionChart');
        if(ctxInduction && typeof Chart !== 'undefined') {
            this.charts.induction = new Chart(ctxInduction, {
                type: 'line',
                data: {
                    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago'],
                    datasets: [{
                        label: 'Inducciones Acumuladas',
                        data: [15, 28, 45, 60, 78, 92, 110, 124],
                        borderColor: '#ffc107', // Warning color (Induction is usually urgent)
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