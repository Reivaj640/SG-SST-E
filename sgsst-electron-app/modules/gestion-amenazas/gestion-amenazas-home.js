// gestion-amenazas-home.js - Componente para el home del módulo "Gestión de Amenazas"
// F21.52 (2026-06-21) — Conectado a datos reales via electronAPI.getDocumentFolders.
// Antes mostraba 4 widgets MOCK con números hardcoded ("Amenazas: 15", "Simulacros: 3"…);
// ahora son 2 widgets reales (uno por submódulo) que cuentan carpetas/archivos de la
// estructura de la empresa. Patrón reactivo + cache de sesión (igual a gestion-peligros-home.js).

if (!window._amenazasHomeState) {
    window._amenazasHomeState = {
        cache: new Map(),
        lastUpdate: new Map()
    };
}

class GestionAmenazasHome {
    constructor(container, moduleName, submodules) {
        this.container = container;
        this.moduleName = moduleName;
        /* this.submodules viene de RESOURCES_SUBMODULES en renderer.js.
           Para Gestión de Amenazas son: 5.1.1 y 5.1.2.
           Si el array viene vacío (normativa restrictiva), fallback a ambos. */
        this.submodules = (submodules && submodules.length > 0) ? submodules : [
            '5.1.1 Plan de Prevención de Emergencias',
            '5.1.2 Examenes Medicos Brigadista'
        ];
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
                <i class="bi bi-lightning-fill me-2" style="color: #212529;"></i>
                <div>
                    <div style="color: #212529; font-weight: 600;">Módulo Gestión de Amenazas</div>
                    <span style="font-size: 0.75rem; font-weight: 400; color: #6c757d;">
                        ${this.currentCompany} / Gestión de Amenazas
                    </span>
                </div>
            </div>
        `;
        layout.appendChild(header);

        // Contenedor Principal
        const contentContainer = document.createElement('div');
        contentContainer.className = 'gestion-amenazas-home';
        contentContainer.id = 'app-container';

        // Área Principal
        const mainArea = document.createElement('div');
        mainArea.className = 'main-area';
        mainArea.style.flex = '1';

        this.renderMainArea(mainArea);

        contentContainer.appendChild(mainArea);
        layout.appendChild(contentContainer);
        this.container.appendChild(layout);

        /* Cargar datos reales desde electronAPI.getDocumentFolders */
        this.refreshStats();
    }

    injectStyles() {
        const styleId = 'k-air-gestion-amenazas-styles-v1';
        const oldStyle = document.getElementById(styleId);
        if (oldStyle) oldStyle.remove();

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* =========================================
               1. SISTEMA VISUAL K+AIR (OFICIAL) - GESTIÓN DE AMENAZAS
               ========================================= */
            .gestion-amenazas-home {
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
            }
            .widget:hover {
                transform: translateY(-3px);
                box-shadow: var(--k-shadow-md);
            }

            /* K+Budget Card (replica gestion-peligros-home.js) */
            .k-budget-card .kb-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.5rem;
            }
            .k-budget-card .kb-title {
                font-size: 0.65rem;
                font-weight: 600;
                color: var(--k-text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .k-budget-card .kb-badge {
                font-size: 0.7rem;
                font-weight: 700;
                padding: 0.15rem 0.5rem;
                border-radius: 1rem;
                color: white;
                background-color: var(--k-success);
            }
            .k-budget-card .bg-success { background: var(--k-success) !important; }
            .k-budget-card .bg-danger { background: var(--k-danger) !important; }
            .k-budget-card .bg-primary { background: var(--k-primary) !important; }
            .k-budget-card .bg-warning { background: var(--k-warning) !important; color: #212529 !important; }
            .k-budget-card .kb-amount {
                font-size: 1.4rem;
                font-weight: 700;
                color: var(--k-text-main);
                margin-bottom: 0.5rem;
            }
            .k-budget-card .kb-footer {
                display: flex;
                justify-content: space-between;
                margin-top: auto;
                padding-top: 0.5rem;
                border-top: 1px solid #eee;
            }
            .k-budget-card .kb-label {
                font-size: 0.6rem;
                color: var(--k-text-muted);
                text-transform: uppercase;
            }
            .k-budget-card .kb-value {
                font-size: 0.6rem;
                font-weight: 600;
            }
            .kb-exec { color: var(--k-success); }
            .kb-rem { color: var(--k-primary); }

            /* Secciones de Gráficos y Listas */
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

            /* Charts grid (side-by-side, igual a gestion-peligros-home.js) */
            .charts-grid-amenazas {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1rem;
            }
            @media (max-width: 992px) {
                .charts-grid-amenazas { grid-template-columns: 1fr; }
            }

            /* Anular estilos globales de styles.css (replica del patrón) */
            .gestion-amenazas-home .widget {
                margin-bottom: 0 !important;
                padding: 1rem !important;
            }
            .gestion-amenazas-home .chart-container {
                margin-top: 0 !important;
                margin-bottom: 0 !important;
                min-height: 280px;
            }
            .gestion-amenazas-home .charts-grid-amenazas {
                margin-top: 0 !important;
            }
            .gestion-amenazas-home .submodules-container {
                margin-top: 0 !important;
            }

            /* =========================================
               TEMA OSCURO (MODO SYSTEM/DARK)
               ========================================= */
            [data-theme="dark"] .gestion-amenazas-home {
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
            [data-theme="dark"] .k-budget-card .kb-footer { border-top-color: #4a5568; }
            [data-theme="dark"] .submodule-item { background-color: #374151; }

            /* =========================================
               TEMA OSCURO (DARK-LEGACY - PALETA NEGRO/GRIS)
               ========================================= */
            [data-theme="dark-legacy"] .gestion-amenazas-home {
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
            [data-theme="dark-legacy"] .k-budget-card .kb-footer { border-top-color: #3a3a3a; }
            [data-theme="dark-legacy"] .submodule-item { background-color: #2d2d2d; }
        `;
        document.head.appendChild(style);
    }

    /**
     * Construye los 2 widgets KPI (uno por submódulo) + chart + listado.
     * Los datos llegan vía this.refreshStats() que consulta
     * electronAPI.getDocumentFolders() para cada submódulo.
     */
    renderMainArea(container) {
        const cached = this._getCachedStats() || {};

        /* ── Widgets (uno por submódulo) ───────────────────────────────── */
        const widgetsContainer = document.createElement('div');
        widgetsContainer.className = 'widgets-container';

        /* Metadata visual por submódulo. Si this.submodules tiene códigos que
           no están acá, usamos fallback genérico. */
        const meta = {
            '5.1.1': { title: 'Plan de Prevención', badgeClass: 'bg-primary' },
            '5.1.2': { title: 'Exámenes Brigadista', badgeClass: 'bg-warning' }
        };

        this.submodules.forEach(sub => {
            const codeMatch = sub.match(/^(\d+\.\d+\.\d+)/);
            const code = codeMatch ? codeMatch[1] : sub;
            const m = meta[code] || { title: sub, badgeClass: 'bg-primary' };
            widgetsContainer.appendChild(this.createSubmoduleWidget(code, m.title, m.badgeClass, cached[code]));
        });

        container.appendChild(widgetsContainer);

        /* ── Chart: distribución por submódulo ─────────────────────────── */
        const chartsGrid = document.createElement('div');
        chartsGrid.className = 'charts-grid-amenazas';

        const chartArchivos = document.createElement('div');
        chartArchivos.className = 'chart-container';
        chartArchivos.innerHTML = `
            <h3>Archivos por Submódulo</h3>
            <div class="chart-placeholder" style="padding: 0.5rem 0;">
                <canvas id="ameArchivosChart" style="max-height: 180px;"></canvas>
            </div>
        `;
        chartsGrid.appendChild(chartArchivos);

        const chartTipos = document.createElement('div');
        chartTipos.className = 'chart-container';
        chartTipos.innerHTML = `
            <h3>Distribución por Tipo de Archivo</h3>
            <div class="chart-placeholder" style="padding: 0.5rem 0;">
                <canvas id="ameTiposChart" style="max-height: 180px;"></canvas>
            </div>
        `;
        chartsGrid.appendChild(chartTipos);

        container.appendChild(chartsGrid);

        setTimeout(() => {
            this.renderArchivosChart(cached);
            this.renderTiposChart(cached);
        }, 50);

        /* ── Listado de submódulos (botón Ingresar, sin datos mock) ────── */
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
     * Crea un widget KPI para un submódulo.
     * `code` = '5.1.1' o '5.1.2'
     * `stats` = { carpetas, archivos, ultimaModificacion, porExtension } o null
     */
    createSubmoduleWidget(code, title, badgeClass, stats) {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';

        const render = () => {
            const d = stats || { carpetas: 0, archivos: 0, ultimaModificacion: null, porExtension: {} };
            const ultimaMod = d.ultimaModificacion
                ? new Date(d.ultimaModificacion).toLocaleDateString('es-CO')
                : '—';
            const badge = (stats && stats.error) ? '⚠️' : code;

            widget.innerHTML = `
                <div class="kb-header">
                    <span class="kb-title">${title}</span>
                    <span class="kb-badge ${badgeClass}">${badge}</span>
                </div>
                <div class="kb-amount" style="text-align:center;">
                    <span>${d.archivos || 0}</span>
                </div>
                <div style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:4px;">
                    Archivos cargados
                </div>
                <div class="kb-footer">
                    <div>
                        <div class="kb-label">Carpetas</div>
                        <div class="kb-value kb-exec">${d.carpetas || 0}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="kb-label">Última carga</div>
                        <div class="kb-value kb-rem" style="font-size:0.65rem;">${ultimaMod}</div>
                    </div>
                </div>
            `;
        };

        this.widgets[code] = {
            update: (newStats) => { stats = newStats; render(); }
        };

        render();
        return widget;
    }

    renderSubmoduleItem(name) {
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
        submoduleMeta.textContent = 'Visualizador de documentos';
        submoduleInfo.appendChild(submoduleMeta);

        const button = document.createElement('button');
        button.className = 'btn-ingresar';
        button.textContent = 'Ingresar';
        button.addEventListener('click', () => {
            showSubmoduleContent(document.querySelector('.main-canvas'), this.moduleName, name);
        });

        submoduleItem.appendChild(submoduleInfo);
        submoduleItem.appendChild(button);
        return submoduleItem;
    }

    /* ════════════════════════════════════════════════════════════════════
       DATA: cache + IPC
       Patrón idéntico a gestion-peligros-home.js
       ════════════════════════════════════════════════════════════════════ */

    _getCachedStats() {
        return window._amenazasHomeState.cache.get(this.currentCompany) || null;
    }

    /**
     * Llama electronAPI.getDocumentFolders() para cada submódulo y computa
     * {carpetas, archivos, ultimaModificacion, porExtension}.
     * Si falla, guarda {error: msg} en ese submódulo y el widget muestra ⚠️.
     */
    async refreshStats() {
        const company = this.currentCompany;
        if (!company || !window.electronAPI || !window.electronAPI.getDocumentFolders) {
            console.warn('[AMENAZAS] No se puede refrescar — falta electronAPI o empresa.');
            return;
        }

        console.log('[AMENAZAS] Refrescando estadísticas para ' + company + '...');

        const cached = this._getCachedStats() || {};
        const next = Object.assign({}, cached);

        /* Disparar todas las peticiones en paralelo (patrón gestion-peligros-home.js) */
        const tasks = this.submodules.map(async (sub) => {
            const codeMatch = sub.match(/^(\d+\.\d+\.\d+)/);
            if (!codeMatch) return;
            const code = codeMatch[1];
            try {
                const result = await window.electronAPI.getDocumentFolders({
                    companyName: company,
                    moduleName: this.moduleName,
                    submoduleName: sub
                });

                if (!result || !result.success) {
                    next[code] = { error: (result && result.error) || 'Sin acceso a la carpeta' };
                    return;
                }

                const folders = Array.isArray(result.folders) ? result.folders : [];
                const files = Array.isArray(result.files) ? result.files : [];

                const ultimaMod = files.reduce((max, f) => {
                    const t = f.modified ? new Date(f.modified).getTime() : 0;
                    return t > max ? t : max;
                }, 0);

                const porExtension = {};
                files.forEach(f => {
                    const ext = (f.extension || 'otro').toLowerCase() || 'otro';
                    porExtension[ext] = (porExtension[ext] || 0) + 1;
                });

                next[code] = {
                    carpetas: folders.length,
                    archivos: files.length,
                    ultimaModificacion: ultimaMod ? new Date(ultimaMod).toISOString() : null,
                    porExtension
                };
            } catch (err) {
                console.error('[AMENAZAS] Error en submódulo', sub, err);
            }
        });

        await Promise.all(tasks);

        window._amenazasHomeState.cache.set(company, next);
        window._amenazasHomeState.lastUpdate.set(company, Date.now());
        this.updateWidgetsUI(next);
    }

    updateWidgetsUI(data) {
        if (!data) return;
        Object.keys(this.widgets).forEach(code => {
            if (data[code]) {
                this.widgets[code].update(data[code]);
            }
        });
        this.renderArchivosChart(data);
        this.renderTiposChart(data);
    }

    /* ════════════════════════════════════════════════════════════════════
       CHARTS
       ════════════════════════════════════════════════════════════════════ */

    renderArchivosChart(data) {
        if (typeof Chart === 'undefined') return;
        const canvas = document.getElementById('ameArchivosChart');
        if (!canvas) return;

        /* Deriva los códigos (5.1.1, 5.1.2, ...) directamente de this.submodules */
        const palette = ['#174ea6', '#ffc107', '#28a745', '#dc3545', '#6f42c1', '#20c997', '#fd7e14', '#6c757d'];
        const labels = this.submodules
            .map(s => (s.match(/^(\d+\.\d+\.\d+)/) || [])[1])
            .filter(Boolean);
        const colors = labels.map((_, i) => palette[i % palette.length]);
        const counts = labels.map(code => (data[code] && !data[code].error) ? (data[code].archivos || 0) : 0);

        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Archivos',
                    data: counts,
                    backgroundColor: colors.map(c => c + 'cc'),
                    borderColor: colors,
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
                            label: (ctx) => ` ${ctx.raw} archivo${ctx.raw !== 1 ? 's' : ''}`
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, title: { display: true, text: 'Cantidad', font: { size: 10 } } }
                }
            }
        });
    }

    renderTiposChart(data) {
        if (typeof Chart === 'undefined') return;
        const canvas = document.getElementById('ameTiposChart');
        if (!canvas) return;

        /* Agrega las extensiones de todos los submódulos (derivado dinámicamente) */
        const agg = {};
        Object.keys(this.widgets).forEach(code => {
            const d = data && data[code];
            if (!d || d.error || !d.porExtension) return;
            Object.entries(d.porExtension).forEach(([ext, n]) => {
                agg[ext] = (agg[ext] || 0) + n;
            });
        });

        const entries = Object.entries(agg).sort((a, b) => b[1] - a[1]);
        const labels = entries.map(e => (e[0] || 'otro').toUpperCase());
        const counts = entries.map(e => e[1]);
        const palette = ['#174ea6', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#20c997', '#fd7e14', '#6c757d'];

        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();

        if (counts.length === 0) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '12px Segoe UI';
            ctx.fillStyle = '#6c757d';
            ctx.textAlign = 'center';
            ctx.fillText('Sin archivos cargados', canvas.width / 2, canvas.height / 2);
            return;
        }

        new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: counts,
                    backgroundColor: labels.map((_, i) => palette[i % palette.length] + 'cc'),
                    borderColor: '#fff',
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
                            label: (ctx) => ` ${ctx.label}: ${ctx.raw} archivo${ctx.raw !== 1 ? 's' : ''}`
                        }
                    }
                }
            }
        });
    }

    async renderSidebarPanel(container) {
    }
}

// Hacer la clase disponible globalmente
window.GestionAmenazasHome = GestionAmenazasHome;