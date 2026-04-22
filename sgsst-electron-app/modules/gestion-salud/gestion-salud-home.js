// gestion-salud-home.js - Componente para el home del módulo "Gestión de la Salud"

// Caché global para persistencia entre navegaciones de la misma sesión
if (!window._saludHomeState) {
    window._saludHomeState = {
        cache: new Map(), // companyName -> data
        lastUpdate: new Map() // companyName -> timestamp
    };
}

class GestionSaludHome {
    constructor(container, moduleName, submodules) {
        this.container = container;
        this.moduleName = moduleName;
        this.submodules = submodules;
        this.currentCompany = this.getCurrentCompany();
        this.widgets = {}; // Referencias a elementos de widgets para actualización reactiva
    }

    getCurrentCompany() {
        if (window.currentCompany && window.currentCompany !== 'default_company') return window.currentCompany;
        if (window.rendererState && window.rendererState.selectedCompany) return window.rendererState.selectedCompany;
        if (window.currentModule && window.currentModule.company) return window.currentModule.company;
        const domCompany = document.getElementById('company-name');
        if (domCompany && domCompany.textContent && domCompany.textContent !== 'Empresa') return domCompany.textContent.trim();
        return localStorage.getItem('currentCompanyName') || 'default_company';
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
                <i class="bi bi-heart-pulse me-2" style="color: #212529;"></i>
                <div>
                    <div style="color: #212529; font-weight: 600;">Módulo Gestión de la Salud</div>
                    <span style="font-size: 0.75rem; font-weight: 400; color: #6c757d;">
                        ${this.currentCompany} / Gestión de la Salud
                    </span>
                </div>
            </div>
        `;
        layout.appendChild(header);

        // Contenedor Principal
        const contentContainer = document.createElement('div');
        contentContainer.className = 'gestion-salud-home';
        contentContainer.id = 'app-container';

        // Área Principal
        const mainArea = document.createElement('div');
        mainArea.className = 'main-area';
        mainArea.style.flex = '1';

        // Renderizar contenido
        this.renderMainArea(mainArea);

        contentContainer.appendChild(mainArea);
        layout.appendChild(contentContainer);
        this.container.appendChild(layout);

        // 3. Lanzar actualización en segundo plano (main.js ya tiene su propia caché de disco)
        this.refreshStats();
    }

    /**
     * Refresca las estadísticas en segundo plano y actualiza los widgets existentes.
     */
    async refreshStats() {
        const company = this.currentCompany;
        console.log(`[SALUD] Refrescando estadísticas para ${company}...`);

        try {
            // Ejecutar peticiones en paralelo (main.js responderá rápido gracias a su caché de archivos)
            const [recursosResult, ausResult, accResult, examResult, segResult, remResult] = await Promise.all([
                window.electronAPI.getRecursosStats(company),
                window.electronAPI.getAusentismoStats(company, 'year'),
                window.electronAPI.getAccidentesStats(company),
                window.electronAPI.getExamenesStats(company),
                window.electronAPI.getSaludSeguimientosStats(company),
                window.electronAPI.getRemisionesStats(company)
            ]);

            const newData = {
                inducciones: recursosResult.success ? recursosResult.stats.inducciones : null,
                ausentismo: ausResult.success ? ausResult.data : null,
                accidentes: accResult.success ? accResult.data : null,
                examenes: examResult.success ? examResult.data : null,
                seguimientos: segResult.success ? segResult.data : null,
                remisiones: remResult.success ? remResult.data : null
            };

            // Guardar en caché de sesión
            window._saludHomeState.cache.set(company, newData);
            window._saludHomeState.lastUpdate.set(company, Date.now());

            // Actualizar widgets si el componente sigue montado
            this.updateWidgetsUI(newData);

        } catch (error) {
            console.error('[SALUD] Error refrescando estadísticas:', error);
        }
    }

    updateWidgetsUI(data) {
        if (!data) return;

        // Actualizar Inducciones
        if (data.inducciones && this.widgets.inducciones) {
            this.widgets.inducciones.update(data.inducciones);
        }
        // Actualizar Ausentismo
        if (data.ausentismo && this.widgets.ausentismo) {
            this.widgets.ausentismo.update(data.ausentismo);
        }
        // Actualizar Accidentes
        if (data.accidentes && this.widgets.accidentes) {
            this.widgets.accidentes.update(data.accidentes);
        }
        // Actualizar Exámenes
        if (data.examenes && this.widgets.examenes) {
            this.widgets.examenes.update(data.examenes);
        }
        // Actualizar Seguimientos
        if (data.seguimientos && this.widgets.seguimientos) {
            this.widgets.seguimientos.update(data.seguimientos);
        }
        // Actualizar Remisiones
        if (data.remisiones && this.widgets.remisiones) {
            this.widgets.remisiones.update(data.remisiones);
        }
        // Actualizar gráfica de accidentes
        if (data.accidentes) {
            this.renderAccidentesChart(data.accidentes);
        }
    }

    renderAccidentesChart(data) {
        if (typeof Chart === 'undefined') return;
        const canvas = document.getElementById('saludAccidentesChart');
        if (!canvas) return;

        const monthlyData = data && data.mensual ? data.mensual : Array(12).fill(0);
        const labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        
        // Detectar mes actual para resaltar
        const currentMonth = new Date().getMonth();
        const barColors = monthlyData.map((count, i) => {
            if (count === 0) return 'rgba(40, 167, 69, 0.5)';
            return i === currentMonth ? 'rgba(23, 78, 166, 0.8)' : 'rgba(220, 53, 69, 0.7)';
        });
        const borderColors = monthlyData.map((count, i) => {
            if (count === 0) return '#28a745';
            return i === currentMonth ? '#174ea6' : '#dc3545';
        });

        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Accidentes',
                    data: monthlyData,
                    backgroundColor: barColors,
                    borderColor: borderColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.raw} accidente${ctx.raw !== 1 ? 's' : ''}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, precision: 0 },
                        title: { display: true, text: 'Cantidad', font: { size: 10 } }
                    }
                }
            }
        });
    }

    renderMainArea(container) {
        const widgetsContainer = document.createElement('div');
        widgetsContainer.className = 'widgets-container';

        // Obtener datos iniciales del caché de sesión si existen
        const cachedData = window._saludHomeState.cache.get(this.currentCompany) || {};

        // Crear widgets pasando datos cacheados para renderizado instantáneo
        const examenesWidget = this.createExamenesWidget(cachedData.examenes);
        const accidentesWidget = this.createAccidentesWidget(cachedData.accidentes);
        const remisionesWidget = this.createRemisionesWidget(cachedData.remisiones);
        const seguimientosWidget = this.createSeguimientosWidget(cachedData.seguimientos);
        const ausentismoWidget = this.createAusentismoWidget(cachedData.ausentismo);
        const induccionesWidget = this.createInduccionesWidget(cachedData.inducciones);

        widgetsContainer.appendChild(examenesWidget);
        widgetsContainer.appendChild(accidentesWidget);
        widgetsContainer.appendChild(remisionesWidget);
        widgetsContainer.appendChild(seguimientosWidget);
        widgetsContainer.appendChild(ausentismoWidget);
        widgetsContainer.appendChild(induccionesWidget);

        container.appendChild(widgetsContainer);
        
        // Gráfica de Accidentes
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        chartContainer.innerHTML = `
            <h3>Accidentes por Mes — ${new Date().getFullYear()}</h3>
            <div class="chart-placeholder" style="padding: 0.5rem 0;">
                <canvas id="saludAccidentesChart" style="max-height: 180px;"></canvas>
            </div>
        `;
        container.appendChild(chartContainer);
        
        // Lanzar gráfica con datos cacheados o luego con datos frescos
        const cachedAcc = cachedData.accidentes;
        setTimeout(() => {
            this.renderAccidentesChart(cachedAcc || { mensual: Array(12).fill(0) });
        }, 50);
        
        // Listado de submódulos
        const submodulesContainer = document.createElement('div');
        submodulesContainer.className = 'submodules-container';
        submodulesContainer.innerHTML = `<h3>Submódulos</h3>`;
        
        const submodulesList = document.createElement('div');
        submodulesList.className = 'submodules-list';
        
        this.submodules.forEach(submodule => {
            submodulesList.appendChild(this.renderSubmoduleItem(submodule));
        });
        
        submodulesContainer.appendChild(submodulesList);
        container.appendChild(submodulesContainer);
    }

    /**
     * Widget de Seguimientos Médicos con Toggle Año/Mes
     */
    createSeguimientosWidget(initialData) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        
        let currentMode = 'year';
        let data = initialData;

        const render = () => {
            const displayData = data || { totalAnio: 0, realizadosAnio: 0, totalMes: 0, realizadosMes: 0, year: '—', mes: '—' };
            const pendientes = currentMode === 'year' ? displayData.totalAnio : displayData.totalMes;
            const realizados = currentMode === 'year' ? displayData.realizadosAnio : displayData.realizadosMes;
            const badge = currentMode === 'year' ? displayData.year : (displayData.mes || '').substring(0,3);

            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">Seguimientos Médicos</span>
                    <span class="kb-badge bg-primary" style="background-color: var(--k-primary) !important;">${badge}</span>
                </div>
                <div class="ausentismo-toggles">
                    <button class="ausentismo-toggle ${currentMode==='year'?'active':''}" data-mode="year">Año</button>
                    <button class="ausentismo-toggle ${currentMode==='month'?'active':''}" data-mode="month">Mes</button>
                </div>
                <div class="kb-amount" style="text-align:center;">
                    <span>${pendientes}</span>
                </div>
                <div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:8px;">
                    Casos pendientes (incapacidad > 15 días)
                </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Pendientes</div>
                        <div class="kb-value kb-rem">${pendientes}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Realizados</div>
                        <div class="kb-value kb-exec">${realizados}</div>
                    </div>
                </div>
            `;

            // Re-asignar eventos de toggle
            widget.querySelectorAll('.ausentismo-toggle').forEach(btn => {
                btn.onclick = () => {
                    currentMode = btn.dataset.mode;
                    render();
                };
            });
        };

        this.widgets.seguimientos = {
            update: (newData) => { data = newData; render(); }
        };

        render();
        return widget;
    }

    /**
     * Widget de Ausentismo con Toggle Año/Mes
     */
    createAusentismoWidget(initialData) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        
        let currentMode = 'year';
        let data = initialData;

        const render = () => {
            const displayData = data || { total: 0, mesActual: 0, year: '—', mes: '—' };
            const value = currentMode === 'year' ? displayData.total : displayData.mesActual;
            const badge = currentMode === 'year' ? displayData.year : (displayData.mes || '').substring(0,3);

            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">Ausentismo Médico</span>
                    <span class="kb-badge bg-success">${badge}</span>
                </div>
                <div class="ausentismo-toggles">
                    <button class="ausentismo-toggle ${currentMode==='year'?'active':''}" data-mode="year">Año</button>
                    <button class="ausentismo-toggle ${currentMode==='month'?'active':''}" data-mode="month">Mes</button>
                </div>
                <div class="kb-amount" style="text-align:center;">
                    <span>${value}</span>
                </div>
                <div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:8px;">
                    Incapacidades registradas
                </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Total Año</div>
                        <div class="kb-value kb-exec">${displayData.total}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Mes Actual</div>
                        <div class="kb-value kb-rem">${displayData.mesActual}</div>
                    </div>
                </div>
            `;

            widget.querySelectorAll('.ausentismo-toggle').forEach(btn => {
                btn.onclick = () => {
                    currentMode = btn.dataset.mode;
                    render();
                };
            });
        };

        this.widgets.ausentismo = {
            update: (newData) => { data = newData; render(); }
        };

        render();
        return widget;
    }

    /**
     * Widget de Exámenes Médicos con Toggle Año/Mes
     */
    createExamenesWidget(initialData) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        
        let currentMode = 'year';
        let data = initialData;

        const render = () => {
            const displayData = data || { totalYear: 0, mesActual: 0, year: '—', mes: '—' };
            const value = currentMode === 'year' ? displayData.totalYear : displayData.mesActual;
            const badge = currentMode === 'year' ? displayData.year : (displayData.mes || '').substring(0,3);

            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">Exámenes Médicos</span>
                    <span class="kb-badge bg-success">${badge}</span>
                </div>
                <div class="ausentismo-toggles">
                    <button class="ausentismo-toggle ${currentMode==='year'?'active':''}" data-mode="year">Año</button>
                    <button class="ausentismo-toggle ${currentMode==='month'?'active':''}" data-mode="month">Mes</button>
                </div>
                <div class="kb-amount" style="text-align:center;">
                    <span>${value}</span>
                </div>
                <div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:8px;">
                    Evaluaciones médicas
                </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Total Año</div>
                        <div class="kb-value kb-exec">${displayData.totalYear}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Mes Actual</div>
                        <div class="kb-value kb-rem">${displayData.mesActual}</div>
                    </div>
                </div>
            `;

            widget.querySelectorAll('.ausentismo-toggle').forEach(btn => {
                btn.onclick = () => {
                    currentMode = btn.dataset.mode;
                    render();
                };
            });
        };

        this.widgets.examenes = {
            update: (newData) => { data = newData; render(); }
        };

        render();
        return widget;
    }

    /**
     * Widget de Accidentes Reportados con Toggle Año/Mes
     */
    createAccidentesWidget(initialData) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        
        let currentMode = 'year';
        let data = initialData;

        const render = () => {
            const displayData = data || { totalYear: 0, mesActual: 0, year: '—', mes: '—' };
            const value = currentMode === 'year' ? displayData.totalYear : displayData.mesActual;
            const badge = currentMode === 'year' ? displayData.year : (displayData.mes || '').substring(0,3);

            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">Accidentes Reportados</span>
                    <span class="kb-badge bg-danger">${badge}</span>
                </div>
                <div class="ausentismo-toggles">
                    <button class="ausentismo-toggle ${currentMode==='year'?'active':''}" data-mode="year">Año</button>
                    <button class="ausentismo-toggle ${currentMode==='month'?'active':''}" data-mode="month">Mes</button>
                </div>
                <div class="kb-amount" style="text-align:center;">
                    <span>${value}</span>
                </div>
                <div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:8px;">
                    Reportes FURAT
                </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Total Año</div>
                        <div class="kb-value kb-exec">${displayData.totalYear}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Mes Actual</div>
                        <div class="kb-value kb-rem">${displayData.mesActual}</div>
                    </div>
                </div>
            `;

            widget.querySelectorAll('.ausentismo-toggle').forEach(btn => {
                btn.onclick = () => {
                    currentMode = btn.dataset.mode;
                    render();
                };
            });
        };

        this.widgets.accidentes = {
            update: (newData) => { data = newData; render(); }
        };

        render();
        return widget;
    }

    /**
     * Widget de Remisiones Médicas dinámico
     */
    createRemisionesWidget(initialData) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        
        let data = initialData;

        const render = () => {
            const displayData = data || { total: 0, mesActual: 0, month: '—' };
            
            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">Remisiones a EPS</span>
                    <span class="kb-badge" style="background:#17a2b8;">TOTAL</span>
                </div>
                <div class="kb-amount" style="text-align:center; padding: 1.2rem 0;">
                    <span>${displayData.total}</span>
                </div>
                <div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:8px;">
                    Control de remisiones y recomendaciones
                </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Mes Actual</div>
                        <div class="kb-value">${displayData.mesActual}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Estado</div>
                        <div class="kb-value kb-exec">Al día</div>
                    </div>
                </div>
            `;
        };

        this.widgets.remisiones = {
            update: (newData) => { data = newData; render(); }
        };

        render();
        return widget;
    }

    /**
     * Widget de Inducciones (Integrado desde RecursosStats)
     */
    createInduccionesWidget(initialData) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        
        let data = initialData;

        const render = () => {
            const displayData = data || { completadas: 0, pendientes: 0, porcentajeCompletado: 0 };
            
            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">Inducciones SST</span>
                    <span class="kb-badge bg-success">${displayData.porcentajeCompletado}%</span>
                </div>
                <div class="kb-amount" style="text-align:center;">
                    <span>${displayData.completadas}</span>
                </div>
                <div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:8px;">
                    Trabajadores con inducción al día
                </div>
                <div class="kb-progress-track" style="margin: 10px 0;">
                    <div class="kb-progress-bar" style="width: ${displayData.porcentajeCompletado}%"></div>
                </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Completas</div>
                        <div class="kb-value kb-exec">${displayData.completadas}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Pendientes</div>
                        <div class="kb-value kb-rem">${displayData.pendientes}</div>
                    </div>
                </div>
            `;
        };

        this.widgets.inducciones = {
            update: (newData) => { data = newData; render(); }
        };

        render();
        return widget;
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

    renderSubmoduleItem(name) {
        const submoduleItem = document.createElement('div');
        submoduleItem.className = 'submodule-item';
        submoduleItem.innerHTML = `
            <div class="submodule-info">
                <div class="submodule-name">${name}</div>
                <div class="submodule-meta">Gestión y registros asociados</div>
            </div>
            <button class="btn-ingresar">Ingresar</button>
        `;
        submoduleItem.querySelector('button').onclick = () => showSubmoduleContent(this.container, this.moduleName, name);
        return submoduleItem;
    }

    injectStyles() {
        const styleId = 'k-salud-home-optimized-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .gestion-salud-home {
                --k-primary: #174ea6;
                --k-success: #28a745;
                --k-danger: #dc3545;
                --k-bg-card: #ffffff;
                --k-border: #dee2e6;
                --k-text-main: #212529;
                --k-text-muted: #6c757d;
                padding: 1.5rem;
                background: #f8f9fa;
                height: 100%;
                overflow-y: auto;
            }
            .widgets-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
            .widget { background: white; border: 1px solid var(--k-border); border-radius: 8px; padding: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; flex-direction: column; }
            .k-budget-card .kb-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
            .k-budget-card .kb-title { font-size: 0.65rem; font-weight: 600; color: var(--k-text-muted); text-transform: uppercase; }
            .k-budget-card .kb-badge { font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 1rem; color: white; background: #6c757d; }
            .k-budget-card .bg-success { background: var(--k-success) !important; }
            .k-budget-card .bg-danger { background: var(--k-danger) !important; }
            .k-budget-card .kb-amount { font-size: 2rem; font-weight: 700; color: var(--k-text-main); padding: 0.5rem 0; }
            .k-budget-card .kb-footer { display: flex; justify-content: space-between; margin-top: auto; padding-top: 0.5rem; border-top: 1px solid #eee; }
            .k-budget-card .kb-label { font-size: 0.6rem; color: var(--k-text-muted); text-transform: uppercase; }
            .k-budget-card .kb-value { font-size: 0.85rem; font-weight: 600; }
            .kb-exec { color: var(--k-success); }
            .kb-rem { color: var(--k-primary); }
            
            .kb-progress-track { width: 100%; height: 8px; background: #eee; border-radius: 4px; overflow: hidden; }
            .kb-progress-bar { height: 100%; background: var(--k-success); transition: width 0.5s ease; }

            .ausentismo-toggles { display: flex; gap: 4px; margin: 8px 0; background: #f1f3f4; padding: 3px; border-radius: 6px; }
            .ausentismo-toggle { flex: 1; border: none; background: transparent; font-size: 0.7rem; padding: 4px; border-radius: 4px; cursor: pointer; color: var(--k-text-muted); transition: all 0.2s; }
            .ausentismo-toggle.active { background: white; color: var(--k-primary); box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-weight: 600; }

            .submodules-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
            .submodule-item { display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: white; border: 1px solid var(--k-border); border-radius: 8px; transition: transform 0.2s; }
            .submodule-item:hover { transform: translateX(5px); border-color: var(--k-primary); }
            .btn-ingresar { background: var(--k-primary); color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
            
            .main-area { display: flex; flex-direction: column; gap: 1rem; }
            .submodules-container { margin-top: 0.5rem; }
            .submodules-container h3 { font-size: 0.8rem; font-weight: 600; color: var(--k-text-main); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
            .chart-container { background: white; border: 1px solid var(--k-border); border-radius: 8px; padding: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
            .chart-container h3 { font-size: 0.75rem; font-weight: 600; color: var(--k-primary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
        `;
        document.head.appendChild(style);
    }
}

// Hacer la clase disponible globalmente
window.GestionSaludHome = GestionSaludHome;
