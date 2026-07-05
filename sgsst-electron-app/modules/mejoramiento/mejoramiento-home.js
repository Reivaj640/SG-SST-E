// mejoramiento-home.js - Componente para el home del módulo "Mejoramiento"

// F21.49 (2026-06-21) — Mejoramiento ahora SOLO tiene 7.1.1.
// 7.1.2 / 7.1.3 / 7.1.4 ya no son submódulos activos — sus interfaces quedan reservadas
// en modules/ pero NO se les crea UI porque la normativa (ALL_SUBMODULES en renderer.js)
// solo incluye 7.1.1 en el módulo "Mejoramiento".

class MejoramientoHome {
    constructor(container, moduleName, submodules) {
        this.container = container;
        this.moduleName = moduleName;
        /* this.submodules viene de RESOURCES_SUBMODULES[moduleName] en renderer.js,
           que ya está filtrado por la normativa. Para Mejoramiento ahora solo trae
           7.1.1. Si por algún motivo el array viene vacío, fallback a 7.1.1. */
        this.submodules = (submodules && submodules.length > 0) ? submodules : [
          '7.1.1 Acciones Preventivas y Correctivas'
        ];
        this.currentCompany = null;
        this.widgets = {};
        this._unsubscribe = null;
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
                <i class="bi bi-arrow-up-right-circle-fill me-2" style="color: #212529;"></i>
                <div>
                    <div style="color: #212529; font-weight: 600;">Módulo Mejoramiento</div>
                    <span style="font-size: 0.75rem; font-weight: 400; color: #6c757d;">
                        ${this.currentCompany} / Mejoramiento
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

        // 📦491 — Skeleton mientras Mejora Store carga stats (5 widgets + 2 charts: bar + doughnut)
        mainArea.innerHTML = KairSkeleton.kpiStrip(5) + KairSkeleton.chartBars(12) + KairSkeleton.chartDonut();

        contentContainer.appendChild(mainArea);
        layout.appendChild(contentContainer);
        this.container.appendChild(layout);

        // 📦491-fix — Retardo de 200ms para que el browser pinte el skeleton y el ojo lo registre
        // antes de que JS continue con la carga. Sin esto, el skeleton se borra antes de verse.
        await new Promise(r => setTimeout(r, 200));

        this.renderMainArea(mainArea);

        if (window.MejoramientoStore) {
            this._unsubscribe = window.MejoramientoStore.subscribe((stats) => {
                this.updateWidgetsUI(stats);
            });
            const initialStats = window.MejoramientoStore.getStats();
            this.updateWidgetsUI(initialStats);
        }
    }

    renderMainArea(container) {
        // 📦491-fix — Limpiar skeleton antes de pintar widgets reales
        container.innerHTML = '';

        /* F21.51 (2026-06-21) — Los 5 KPIs del home son EXACTAMENTE los mismos que
           muestra el viewer 7.1.1 (acciones-pc-viewer.js → renderKpis):
           total / abiertas / enProceso / cerradas / vencidas.
           Antes había 4 widgets (711/712/713/714) + 2 globales; ahora solo 7.1.1. */
        const widgetsContainer = document.createElement('div');
        widgetsContainer.className = 'widgets-container';

        const cachedStats = window.MejoramientoStore ? window.MejoramientoStore.getStats() : {};

        widgetsContainer.appendChild(this.createKpiWidget('total', 'Total Acciones', 'bg-primary', cachedStats));
        widgetsContainer.appendChild(this.createKpiWidget('abiertas', 'Abiertas', 'bg-info', cachedStats));
        widgetsContainer.appendChild(this.createKpiWidget('enProceso', 'En Proceso', 'bg-warning', cachedStats));
        widgetsContainer.appendChild(this.createKpiWidget('cerradas', 'Cerradas', 'bg-success', cachedStats));
        widgetsContainer.appendChild(this.createKpiWidget('vencidas', 'Vencidas', 'bg-danger', cachedStats));

        container.appendChild(widgetsContainer);

        const chartsGrid = document.createElement('div');
        chartsGrid.className = 'charts-grid-mejoramiento';

        const chartAcciones = document.createElement('div');
        chartAcciones.className = 'chart-container';
        chartAcciones.innerHTML = `
            <h3>Acciones por Mes — 7.1.1 — ${new Date().getFullYear()}</h3>
            <div class="chart-placeholder" style="padding: 0.5rem 0;">
                <canvas id="mejAccionesChart" style="max-height: 180px;"></canvas>
            </div>
        `;
        chartsGrid.appendChild(chartAcciones);

        const chartEstados = document.createElement('div');
        chartEstados.className = 'chart-container';
        chartEstados.innerHTML = `
            <h3>Distribución por Estado — 7.1.1</h3>
            <div class="chart-placeholder" style="padding: 0.5rem 0;">
                <canvas id="mejEstadosChart" style="max-height: 180px;"></canvas>
            </div>
        `;
        chartsGrid.appendChild(chartEstados);

        container.appendChild(chartsGrid);

        setTimeout(() => {
            this.renderAccionesChart(cachedStats);
            this.renderEstadosChart(cachedStats);
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

    /**
     * Crea un widget KPI individual para el home.
     * `kpiKey` es la clave del campo en stats (total / abiertas / enProceso / cerradas / vencidas).
     * `stats` es el objeto devuelto por MejoramientoStore.getStats() — ya no es por submódulo,
     * ahora es un objeto único con los 5 KPIs de 7.1.1.
     */
    createKpiWidget(kpiKey, title, badgeClass, initialStats) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';

        let data = initialStats;

        const subLabel = {
            total: 'Acciones registradas',
            abiertas: 'Sin iniciar',
            enProceso: 'En ejecución',
            cerradas: 'Finalizadas',
            vencidas: 'Requieren atención'
        }[kpiKey] || '';

        const render = () => {
            const d = data || {};
            const total = d.total || 0;
            const value = d[kpiKey] != null ? d[kpiKey] : 0;
            const pct = total > 0 && kpiKey !== 'total' ? Math.round((value / total) * 100) : null;

            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">${title}</span>
                    <span class="kb-badge ${badgeClass}">7.1.1</span>
                </div>
                <div class="kb-amount" style="text-align:center;">
                    <span>${value}</span>
                </div>
                <div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:4px;">
                    ${subLabel}
                </div>
                ${pct !== null ? `
                <div class="kb-progress-track" style="margin-bottom: 0.5rem;">
                    <div class="kb-progress-bar" style="width: ${pct}%"></div>
                </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Del total</div>
                        <div class="kb-value kb-exec">${pct}%</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Total</div>
                        <div class="kb-value kb-rem">${total}</div>
                    </div>
                </div>
                ` : `
                <div class="kb-footer" style="justify-content:flex-end;">
                    <div style="text-align:right;">
                        <div class="kb-label">Cumplimiento</div>
                        <div class="kb-value kb-exec">${d.cumplimiento || 0}%</div>
                    </div>
                </div>
                `}
            `;
        };

        this.widgets[kpiKey] = {
            update: (newData) => { data = newData; render(); }
        };

        render();
        return widget;
    }

    updateWidgetsUI(stats) {
        if (!stats) return;

        /* Los stats ahora son un objeto único (no por submódulo).
           Los 5 KPIs del home son los mismos del viewer 7.1.1. */
        ['total', 'abiertas', 'enProceso', 'cerradas', 'vencidas'].forEach(key => {
            if (this.widgets[key]) this.widgets[key].update(stats);
        });

        this.renderAccionesChart(stats);
        this.renderEstadosChart(stats);
    }

    renderAccionesChart(stats) {
        if (typeof Chart === 'undefined') return;
        const canvas = document.getElementById('mejAccionesChart');
        if (!canvas) return;

        const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const ds = (stats && stats.byMonth) ? stats.byMonth : Array(12).fill(0);

        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '7.1.1 Acciones',
                    data: ds,
                    backgroundColor: 'rgba(23, 78, 166, 0.75)',
                    borderColor: '#174ea6',
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
                            label: (ctx) => ` ${ctx.raw} acción${ctx.raw !== 1 ? 'es' : ''}`
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

    renderEstadosChart(stats) {
        if (typeof Chart === 'undefined') return;
        const canvas = document.getElementById('mejEstadosChart');
        if (!canvas) return;

        const labels = ['Abiertas', 'En proceso', 'Cerradas', 'Vencidas'];
        const data = [
            stats && stats.abiertas || 0,
            stats && stats.enProceso || 0,
            stats && stats.cerradas || 0,
            stats && stats.vencidas || 0
        ];
        const colors = ['#174ea6', '#ffc107', '#28a745', '#dc3545'];

        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
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
                            label: (ctx) => ` ${ctx.label}: ${ctx.raw} acción${ctx.raw !== 1 ? 'es' : ''}`
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
                <div class="submodule-meta">Ciclo de Mejora Continua</div>
            </div>
            <button class="btn-ingresar">Ingresar</button>
        `;
        submoduleItem.querySelector('button').onclick = () => showSubmoduleContent(this.container, this.moduleName, name);
        return submoduleItem;
    }

    injectStyles() {
        const styleId = 'k-air-mejoramiento-styles-v2';
        const oldStyle = document.getElementById(styleId);
        if (oldStyle) oldStyle.remove();
        const oldV1 = document.getElementById('k-air-mejoramiento-styles-v1');
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
            .k-budget-card .bg-info { background: #17a2b8 !important; }
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
            .charts-grid-mejoramiento { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
            @media (max-width: 992px) { .charts-grid-mejoramiento { grid-template-columns: 1fr; } }

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
            .gestion-integral-home .charts-grid-mejoramiento { margin-top: 0 !important; }

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

window.MejoramientoHome = MejoramientoHome;
