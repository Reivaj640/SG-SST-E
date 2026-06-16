// verificacion-home.js - Componente para el home del módulo "Verificación"

class VerificacionHome {
    constructor(container, moduleName, submodules) {
        this.container = container;
        this.moduleName = moduleName;
        this.submodules = submodules || [];
        this.currentCompany = null;
        this.widgets = {};
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

        this.injectStyles();

        const layout = document.createElement('div');
        layout.className = 'k-app-layout';
        layout.style.height = '100%';

        const header = document.createElement('header');
        header.className = 'k-module-header';
        header.innerHTML = `
            <div class="k-module-title">
                <i class="bi bi-clipboard-check-fill me-2" style="color: #212529;"></i>
                <div>
                    <div style="color: #212529; font-weight: 600;">Módulo Verificación</div>
                    <span style="font-size: 0.75rem; font-weight: 400; color: #6c757d;">
                        ${this.currentCompany} / Verificación
                    </span>
                </div>
            </div>
        `;
        layout.appendChild(header);

        const contentContainer = document.createElement('div');
        contentContainer.className = 'gestion-integral-home';
        contentContainer.id = 'app-container';

        const mainArea = document.createElement('div');
        mainArea.className = 'main-area';
        mainArea.style.flex = '1';

        this.renderMainArea(mainArea);

        contentContainer.appendChild(mainArea);
        layout.appendChild(contentContainer);
        this.container.appendChild(layout);
    }

    renderMainArea(container) {
        const widgetsContainer = document.createElement('div');
        widgetsContainer.className = 'widgets-container';

        widgetsContainer.appendChild(this.createSubmoduleWidget('611', 'Definición de Indicadores', 'bg-success', {
            total: 18, pendientes: 4, completados: 14, enProceso: 2, mesActual: 3, year: String(new Date().getFullYear()), mes: this.getCurrentMonthName()
        }));
        widgetsContainer.appendChild(this.createSubmoduleWidget('612', 'Auditoría Anual', 'bg-primary', {
            total: 4, pendientes: 1, completados: 3, enProceso: 0, mesActual: 1, year: String(new Date().getFullYear()), mes: this.getCurrentMonthName()
        }));
        widgetsContainer.appendChild(this.createSubmoduleWidget('613', 'Revisión Alta Dirección', 'bg-warning', {
            total: 6, pendientes: 2, completados: 4, enProceso: 1, mesActual: 1, year: String(new Date().getFullYear()), mes: this.getCurrentMonthName()
        }));
        widgetsContainer.appendChild(this.createSubmoduleWidget('614', 'Planificación Auditoría', 'bg-danger', {
            total: 3, pendientes: 1, completados: 2, enProceso: 0, mesActual: 0, year: String(new Date().getFullYear()), mes: this.getCurrentMonthName()
        }));
        widgetsContainer.appendChild(this.createEficaciaWidget({
            eficacia: 82, total: 31, completados: 25, year: String(new Date().getFullYear()), mes: this.getCurrentMonthName()
        }));
        widgetsContainer.appendChild(this.createHallazgosWidget({
            criticos: 3, abiertos: 7, cerrados: 24, year: String(new Date().getFullYear()), mes: this.getCurrentMonthName()
        }));

        container.appendChild(widgetsContainer);

        const chartsGrid = document.createElement('div');
        chartsGrid.className = 'charts-grid-verificacion';

        const chartAuditorias = document.createElement('div');
        chartAuditorias.className = 'chart-container';
        chartAuditorias.innerHTML = `
            <h3>Auditorías por Mes — ${new Date().getFullYear()}</h3>
            <div class="chart-placeholder" style="padding: 0.5rem 0;">
                <canvas id="verAuditoriasChart" style="max-height: 180px;"></canvas>
            </div>
        `;
        chartsGrid.appendChild(chartAuditorias);

        const chartCumplimiento = document.createElement('div');
        chartCumplimiento.className = 'chart-container';
        chartCumplimiento.innerHTML = `
            <h3>Cumplimiento por Submódulo — ${new Date().getFullYear()}</h3>
            <div class="chart-placeholder" style="padding: 0.5rem 0;">
                <canvas id="verCumplimientoChart" style="max-height: 180px;"></canvas>
            </div>
        `;
        chartsGrid.appendChild(chartCumplimiento);

        container.appendChild(chartsGrid);

        setTimeout(() => {
            this.renderAuditoriasChart();
            this.renderCumplimientoChart();
        }, 50);

        const submodulesContainer = document.createElement('div');
        submodulesContainer.className = 'submodules-container';
        submodulesContainer.innerHTML = `<h3>Submódulos</h3>`;

        const submodulesList = document.createElement('div');
        submodulesList.className = 'submodules-list';

        if (this.submodules && this.submodules.length > 0) {
            this.submodules.forEach(submodule => {
                submodulesList.appendChild(this.renderSubmoduleItem(submodule));
            });
        } else {
            submodulesList.innerHTML = `<div style="padding: 1rem; color: var(--k-text-muted); font-style: italic;">No hay submódulos configurados aún.</div>`;
        }

        submodulesContainer.appendChild(submodulesList);
        container.appendChild(submodulesContainer);
    }

    getCurrentMonthName() {
        const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        return months[new Date().getMonth()];
    }

    createSubmoduleWidget(code, title, badgeClass, data) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';

        let currentMode = 'year';

        const render = () => {
            const d = data;
            const value = currentMode === 'year' ? d.total : d.mesActual;
            const badge = currentMode === 'year' ? d.year : (d.mes || '').substring(0, 3);

            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">${title}</span>
                    <span class="kb-badge ${badgeClass}">${badge}</span>
                </div>
                <div class="ausentismo-toggles">
                    <button class="ausentismo-toggle ${currentMode === 'year' ? 'active' : ''}" data-mode="year">Año</button>
                    <button class="ausentismo-toggle ${currentMode === 'month' ? 'active' : ''}" data-mode="month">Mes</button>
                </div>
                <div class="kb-amount" style="text-align:center;">
                    <span>${value}</span>
                </div>
                <div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:4px;">
                    Registros totales
                </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Pendientes</div>
                        <div class="kb-value kb-exec">${d.pendientes}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Completados</div>
                        <div class="kb-value kb-rem">${d.completados}</div>
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

        this.widgets[code] = { update: (newData) => { data = newData; render(); } };
        render();
        return widget;
    }

    createEficaciaWidget(data) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';

        let currentMode = 'year';

        const render = () => {
            const d = data;
            const badge = currentMode === 'year' ? d.year : (d.mes || '').substring(0, 3);

            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">Eficacia de Verificación</span>
                    <span class="kb-badge bg-success">${badge}</span>
                </div>
                <div class="ausentismo-toggles">
                    <button class="ausentismo-toggle ${currentMode === 'year' ? 'active' : ''}" data-mode="year">Año</button>
                    <button class="ausentismo-toggle ${currentMode === 'month' ? 'active' : ''}" data-mode="month">Mes</button>
                </div>
                <div class="kb-amount" style="text-align:center;">
                    <span>${d.eficacia}%</span>
                </div>
                <div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:4px;">
                    Completados / Total
                </div>
                <div class="kb-progress-track" style="margin-bottom: 0.5rem;">
                    <div class="kb-progress-bar" style="width: ${d.eficacia}%"></div>
                </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Completados</div>
                        <div class="kb-value kb-exec">${d.completados}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Total</div>
                        <div class="kb-value kb-rem">${d.total}</div>
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

        this.widgets._eficacia = { update: (newData) => { data = newData; render(); } };
        render();
        return widget;
    }

    createHallazgosWidget(data) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';

        let currentMode = 'year';

        const render = () => {
            const d = data;
            const badge = currentMode === 'year' ? d.year : (d.mes || '').substring(0, 3);

            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">Hallazgos Críticos</span>
                    <span class="kb-badge bg-danger">${badge}</span>
                </div>
                <div class="ausentismo-toggles">
                    <button class="ausentismo-toggle ${currentMode === 'year' ? 'active' : ''}" data-mode="year">Año</button>
                    <button class="ausentismo-toggle ${currentMode === 'month' ? 'active' : ''}" data-mode="month">Mes</button>
                </div>
                <div class="kb-amount" style="text-align:center;">
                    <span>${d.criticos}</span>
                </div>
                <div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:4px;">
                    Requieren atención inmediata
                </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Abiertos</div>
                        <div class="kb-value kb-exec">${d.abiertos}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Cerrados</div>
                        <div class="kb-value kb-rem">${d.cerrados}</div>
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

        this.widgets._hallazgos = { update: (newData) => { data = newData; render(); } };
        render();
        return widget;
    }

    renderAuditoriasChart() {
        if (typeof Chart === 'undefined') return;
        const canvas = document.getElementById('verAuditoriasChart');
        if (!canvas) return;

        const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const currentMonth = new Date().getMonth();

        const auditorias = [1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0];
        const indicadores = [3, 2, 4, 2, 1, 3, 1, 0, 2, 0, 0, 0];
        const revisiones = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0];

        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Auditorías', data: auditorias, backgroundColor: 'rgba(23, 78, 166, 0.7)', borderColor: '#174ea6', borderWidth: 1 },
                    { label: 'Indicadores', data: indicadores, backgroundColor: 'rgba(40, 167, 69, 0.7)', borderColor: '#28a745', borderWidth: 1 },
                    { label: 'Revisiones', data: revisiones, backgroundColor: 'rgba(255, 193, 7, 0.7)', borderColor: '#ffc107', borderWidth: 1 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12, padding: 8 } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw}`
                        }
                    }
                },
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, title: { display: true, text: 'Cantidad', font: { size: 10 } } }
                }
            }
        });
    }

    renderCumplimientoChart() {
        if (typeof Chart === 'undefined') return;
        const canvas = document.getElementById('verCumplimientoChart');
        if (!canvas) return;

        const labels = ['6.1.1', '6.1.2', '6.1.3', '6.1.4'];
        const colors = ['#28a745', '#174ea6', '#ffc107', '#dc3545'];
        const cumplimiento = [78, 75, 67, 67];

        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: cumplimiento,
                    backgroundColor: colors.map(c => c + 'cc'),
                    borderColor: colors,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12, padding: 8 } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ${ctx.raw}% cumplimiento`
                        }
                    }
                }
            }
        });
    }

    renderSubmoduleItem(name) {
        const submoduleItem = document.createElement('div');
        submoduleItem.className = 'submodule-item';
        submoduleItem.innerHTML = `
            <div class="submodule-info">
                <div class="submodule-name">${name}</div>
                <div class="submodule-meta">Verificación y Cumplimiento</div>
            </div>
            <button class="btn-ingresar">Ingresar</button>
        `;
        submoduleItem.querySelector('button').onclick = () => showSubmoduleContent(this.container, this.moduleName, name);
        return submoduleItem;
    }

    injectStyles() {
        const styleId = 'k-air-verificacion-styles-v2';
        const oldStyle = document.getElementById(styleId);
        if (oldStyle) oldStyle.remove();
        const oldV1 = document.getElementById('k-air-verificacion-styles-v1');
        if (oldV1) oldV1.remove();

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
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
                color: var(--k-text-main);
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }

            .main-area {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                overflow-y: auto;
                padding-right: 0.5rem;
                width: 100%;
            }

            .widgets-container {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 1rem;
                margin-bottom: 0 !important;
            }

            .widget {
                background: var(--k-bg-card);
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-lg);
                padding: 1rem;
                box-shadow: var(--k-shadow-sm);
                display: flex;
                flex-direction: column;
                min-height: 120px;
                transition: transform 0.2s ease;
            }
            .widget:hover {
                transform: translateY(-3px);
                box-shadow: var(--k-shadow-md);
            }

            .k-budget-card .kb-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
            .k-budget-card .kb-title { font-size: 0.65rem; font-weight: 600; color: var(--k-text-muted); text-transform: uppercase; }
            .k-budget-card .kb-badge { font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 1rem; color: white; background-color: var(--k-success); }
            .k-budget-card .bg-success { background: var(--k-success) !important; }
            .k-budget-card .bg-danger { background: var(--k-danger) !important; }
            .k-budget-card .bg-primary { background: var(--k-primary) !important; }
            .k-budget-card .bg-warning { background: var(--k-warning) !important; color: #212529 !important; }
            .k-budget-card .kb-amount { font-size: 1.4rem; font-weight: 700; color: var(--k-text-main); margin-bottom: 0.5rem; }
            .k-budget-card .kb-footer { display: flex; justify-content: space-between; margin-top: auto; padding-top: 0.5rem; border-top: 1px solid #eee; }
            .k-budget-card .kb-label { font-size: 0.6rem; color: var(--k-text-muted); text-transform: uppercase; }
            .k-budget-card .kb-value { font-size: 0.6rem; font-weight: 600; }
            .kb-exec { color: var(--k-success); }
            .kb-rem { color: var(--k-primary); }

            .kb-progress-track { width: 100%; height: 10px; background: #e9ecef; border-radius: 5px; overflow: hidden; margin-bottom: 0.5rem; position: relative; }
            .kb-progress-bar { height: 100%; width: 0%; border-radius: 5px; background-color: var(--k-success); transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s; }

            .ausentismo-toggles { display: flex; gap: 4px; margin: 4px 0; background: #f1f3f4; padding: 3px; border-radius: 6px; }
            .ausentismo-toggle { flex: 1; border: none; background: transparent; font-size: 0.7rem; padding: 2px 6px; border-radius: var(--k-radius-md); cursor: pointer; color: var(--k-text-muted); transition: all 0.2s; }
            .ausentismo-toggle.active { background: white; color: var(--k-primary); box-shadow: var(--k-shadow-sm); font-weight: 600; }

            .chart-container {
                background: var(--k-bg-card);
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-lg);
                padding: 1.5rem;
                box-shadow: var(--k-shadow-sm);
                min-height: 280px;
                display: flex;
                flex-direction: column;
            }
            .chart-container h3 {
                margin-top: 0;
                margin-bottom: 1rem;
                font-size: 1.1rem;
                font-weight: 600;
                color: var(--k-text-main);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            .charts-grid-verificacion { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
            @media (max-width: 992px) { .charts-grid-verificacion { grid-template-columns: 1fr; } }

            .submodules-container {
                background: var(--k-bg-card);
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-lg);
                padding: 1.5rem;
                box-shadow: var(--k-shadow-sm);
                margin-top: 0 !important;
            }
            .submodules-container h3 {
                margin-top: 0;
                margin-bottom: 1rem;
                font-size: 1.1rem;
                font-weight: 600;
                color: var(--k-text-main);
                padding-bottom: 1rem;
                border-bottom: 1px solid var(--k-border);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            .submodules-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
            .submodule-item { display: flex; align-items: center; justify-content: space-between; padding: 1rem; background-color: #fcfcfc; border: 1px solid var(--k-border); border-radius: var(--k-radius-md); transition: all 0.2s ease; }
            .submodule-item:hover { background-color: var(--k-primary-light); border-color: var(--k-primary); transform: translateX(5px); }
            .submodule-info { flex: 1; margin-right: 1rem; }
            .submodule-name { font-weight: 600; color: var(--k-text-main); font-size: 0.95rem; }
            .submodule-meta { font-size: 0.8rem; color: var(--k-text-muted); margin-top: 0.2rem; }
            .btn-ingresar { background-color: var(--k-primary); color: white; border: none; padding: 0.5rem 1.25rem; border-radius: var(--k-radius-md); font-weight: 500; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
            .btn-ingresar:hover { background-color: var(--k-primary-hover); }

            .gestion-integral-home .widget { margin-bottom: 0 !important; padding: 1rem !important; }
            .gestion-integral-home .chart-container { margin-top: 0 !important; margin-bottom: 0 !important; }
            .gestion-integral-home .charts-grid-verificacion { margin-top: 0 !important; }

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
            [data-theme="dark"] .ausentismo-toggle.active { background: #2d3748; }
            [data-theme="dark"] .ausentismo-toggles { background: #1a202c; }

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
            [data-theme="dark-legacy"] .ausentismo-toggle.active { background: #1e1e1e; }
            [data-theme="dark-legacy"] .ausentismo-toggles { background: #121212; }
        `;
        document.head.appendChild(style);
    }
}

window.VerificacionHome = VerificacionHome;
