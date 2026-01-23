// recursos-home.js - Componente para el home del módulo "Recursos"

class RecursosHome {
    constructor(container, moduleName, submodules) {
        this.container = container;
        this.moduleName = moduleName;
        this.submodules = submodules;
        this.currentCompany = null;
        this.budgetData = null;
        this.chartInstance = null;
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
        console.log('🏢 [RecursosHome] Renderizando K+AIR UI Fiel para:', this.currentCompany);

        // 1. Inyectar Estilos Exactos (K+AIR Oficial + Correcciones)
        this.injectStyles();

        // 2. Construir Layout
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

        // Inicializar gráfico
        setTimeout(() => this.initChart(), 100);
    }

    injectStyles() {
        const styleId = 'k-air-resources-official-styles';
        if (document.getElementById(styleId)) return;

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

            .main-area {
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
                overflow-y: auto;
                padding-right: 0.5rem;
                width: 100%;
            }

            .widgets-container {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1.5rem;
            }

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
                min-height: 140px; 
            }
            .widget:hover {
                transform: translateY(-2px);
                box-shadow: var(--k-shadow-md);
            }
            .widget h4 {
                margin: 0 0 0.5rem 0;
                font-size: 0.85rem;
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

            /* Presupuesto - Visual Mejorado */
            .budget-indicator {
                margin-top: auto; 
                width: 100%;
            }
            .progress-container {
                width: 100%;
                height: 12px; 
                background-color: #e9ecef;
                border-radius: 6px;
                overflow: hidden;
                margin-bottom: 0.5rem;
                position: relative;
                box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
            }
            .progress-bar-fill { 
                height: 100%;
                border-radius: 6px;
                width: 0%; /* Empieza en 0 para animar */
                background: linear-gradient(90deg, var(--bar-color, #28a745), var(--bar-color-light, #34ce57));
                transition: width 1.5s cubic-bezier(0.1, 0.5, 0.1, 1);
                display: block;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            }
            .budget-details {
                display: flex;
                justify-content: space-between;
                margin-top: 0.5rem;
                padding-top: 0.5rem;
                border-top: 1px solid var(--k-border);
                font-size: 0.8rem;
            }
            .executed-amount { color: var(--k-success); font-weight: 600; }
            .remaining-amount { color: var(--k-primary); font-weight: 600; }

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
        `;
        document.head.appendChild(style);
    }

    async renderMainArea(container) {
        const widgetsContainer = document.createElement('div');
        widgetsContainer.className = 'widgets-container';

        widgetsContainer.appendChild(this.createWidget('Personal Asignado', '42', '↗ 2 nuevos este mes'));
        widgetsContainer.appendChild(this.createWidget('Capacitaciones', '18', '📅 3 programadas'));
        widgetsContainer.appendChild(this.createWidget('EPPs Entregados', '120', '📦 15 por entregar'));
        
        const budgetWidget = await this.createBudgetWidget();
        widgetsContainer.appendChild(budgetWidget);

        container.appendChild(widgetsContainer);

        const contentGrid = document.createElement('div');
        contentGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 1.5rem;
        `;

        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        chartContainer.innerHTML = `
            <h3>Distribución de Personal por Área</h3>
            <div style="flex: 1; position: relative; min-height: 250px;">
                <canvas id="distributionChart"></canvas>
            </div>
        `;
        contentGrid.appendChild(chartContainer);

        const submodulesContainer = document.createElement('div');
        submodulesContainer.className = 'submodules-container';
        submodulesContainer.innerHTML = `<h3>Submódulos</h3>`;
        
        const submodulesList = document.createElement('div');
        submodulesList.className = 'submodules-list';
        
        this.submodules.forEach(submodule => {
            const item = document.createElement('div');
            item.className = 'submodule-item';
            item.innerHTML = `
                <div class="submodule-info">
                    <div class="submodule-name">${submodule}</div>
                    <div class="submodule-meta">Gestión y control</div>
                </div>
                <button class="btn-ingresar">Ingresar</button>
            `;
            
            const btn = item.querySelector('.btn-ingresar');
            btn.onclick = () => this.handleSubmoduleClick(submodule);
            
            submodulesList.appendChild(item);
        });
        
        submodulesContainer.appendChild(submodulesList);
        contentGrid.appendChild(submodulesContainer);

        container.appendChild(contentGrid);
    }

    async renderSidebarPanel(container) {
        container.style.display = 'none'; 
    }

    createWidget(title, value, desc) {
        const w = document.createElement('div');
        w.className = 'widget';
        w.innerHTML = `
            <h4>${title}</h4>
            <div class="widget-value">${value}</div>
            <div class="widget-description">${desc}</div>
        `;
        return w;
    }

    async createBudgetWidget() {
        try {
            if (!this.currentCompany || this.currentCompany === 'default_company') {
                this.currentCompany = this.getCurrentCompany();
            }

            if (this.budgetData && this.budgetData.company === this.currentCompany) {
                const widget = this.renderBudgetWidgetHTML(
                    this.budgetData.totalPresupuesto, 
                    this.budgetData.totalEjecutado, 
                    this.budgetData.porcentajeCumplimiento, 
                    this.budgetData.saldoDisponible
                );
                this.animateBudgetBar(widget, this.budgetData.porcentajeCumplimiento);
                return widget;
            }

            if (!window.electronAPI || !window.electronAPI.getPresupuestoFiles) {
                return this.renderBudgetWidgetError('API no disponible');
            }

            const result = await window.electronAPI.getPresupuestoFiles(this.currentCompany);
            if (!result.success || !result.files?.length) {
                return this.renderBudgetWidgetError('Sin archivo');
            }

            const currentYear = new Date().getFullYear();
            let file = result.files.find(f => f.name.includes(currentYear.toString()));
            if(!file) file = result.files[0];

            const dataResult = await window.electronAPI.readPresupuestoData(file.path);
            if (!dataResult.success) return this.renderBudgetWidgetError('Error lectura');

            const { totalPresupuesto, totalEjecutado, porcentajeCumplimiento, saldoDisponible } = 
                this.calculateBudgetSummary(dataResult.data.processedData);

            this.budgetData = {
                company: this.currentCompany,
                totalPresupuesto, totalEjecutado, porcentajeCumplimiento, saldoDisponible
            };

            const finalWidget = this.renderBudgetWidgetHTML(totalPresupuesto, totalEjecutado, porcentajeCumplimiento, saldoDisponible);
            this.animateBudgetBar(finalWidget, porcentajeCumplimiento);
            return finalWidget;

        } catch (error) {
            console.error(error);
            return this.renderBudgetWidgetError('Error');
        }
    }

    renderBudgetWidgetHTML(total, exec, pct, saldo) {
        const widget = document.createElement('div');
        widget.className = 'widget';
        
        const currentYear = new Date().getFullYear();
        
        let color = '#28a745'; 
        let colorLight = '#34ce57';
        if(pct < 40) { color = '#dc3545'; colorLight = '#ea4335'; } 
        else if(pct < 80) { color = '#ffc107'; colorLight = '#ffcd39'; } 

        widget.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                <h4 style="margin:0">PRESUPUESTO ${currentYear}</h4>
                <span style="font-weight:700; font-size:0.9rem; color:${color}">${pct.toFixed(1)}%</span>
            </div>
            <div class="widget-value" style="margin-bottom:1rem">${this.formatCurrency(total)}</div>
            
            <div class="budget-indicator">
                <div class="progress-container">
                    <div class="progress-bar-fill" style="--bar-color: ${color}; --bar-color-light: ${colorLight}; width: 0%;"></div>
                </div>
                <div class="budget-details">
                    <div class="executed-amount">Ejec: ${this.formatCurrency(exec)}</div>
                    <div class="remaining-amount">Saldo: ${this.formatCurrency(saldo)}</div>
                </div>
            </div>
        `;
        return widget;
    }

    animateBudgetBar(widget, pct) {
        setTimeout(() => {
            const bar = widget.querySelector('.progress-bar-fill');
            if (bar) {
                const limitedPct = Math.min(pct, 100);
                bar.style.width = `${limitedPct}%`;
            }
        }, 300);
    }

    renderBudgetWidgetError(msg) {
        const w = document.createElement('div');
        w.className = 'widget';
        w.innerHTML = `<h4>Presupuesto</h4><div class="widget-value" style="font-size:1.2rem; color:var(--k-text-muted)">${msg}</div>`;
        return w;
    }

    calculateBudgetSummary(data) {
        let totalP = 0, totalE = 0;
        data.forEach(row => {
            if (row.id && String(row.id).toUpperCase().includes('TOTAL')) return;
            totalP += this.parseNum(row.asignacion);
            totalE += this.parseNum(row.ejecutado_acumulado);
        });
        const pct = totalP > 0 ? (totalE / totalP) * 100 : 0;
        return { 
            totalPresupuesto: totalP, 
            totalEjecutado: totalE, 
            porcentajeCumplimiento: pct, 
            saldoDisponible: totalP - totalE 
        };
    }

    parseNum(val) {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(String(val).replace(/[$,\s]/g, '')) || 0;
    }

    formatCurrency(val) {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
    }

    initChart() {
        const ctx = document.getElementById('distributionChart');
        if(!ctx || typeof Chart === 'undefined') return;

        if(this.chartInstance) this.chartInstance.destroy();

        this.chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Operaciones', 'Administración', 'Mantenimiento', 'Seguridad'],
                datasets: [{
                    data: [40, 20, 20, 20],
                    backgroundColor: ['#174ea6', '#28a745', '#ffc107', '#dc3545'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } }
            }
        });
    }

    handleSubmoduleClick(submoduleName) {
        console.log('Navegando a submódulo:', submoduleName);
        const mainCanvas = document.querySelector('.main-canvas');

        if (mainCanvas && typeof window.showSubmoduleContent === 'function') {
            window.showSubmoduleContent(mainCanvas, this.moduleName, submoduleName);
        } else {
            alert(`Error al intentar abrir "${submoduleName}".`);
        }
    }
}

window.RecursosHome = RecursosHome;