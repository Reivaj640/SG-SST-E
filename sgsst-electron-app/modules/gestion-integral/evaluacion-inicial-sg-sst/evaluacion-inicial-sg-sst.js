(function() {
// evaluacion-inicial-sg-sst.js - Componente para el submódulo "2.3.1 Evaluación inicial del SG-SST"
// Diseño alineado estrictamente con el Sistema de Diseño K+AIR (Tempoactiva/Temposum/Aseplus/Asel)

class EvaluacionInicialSgSst {
    constructor(container, moduleName, submoduleTitle, backToModuleCallback) {
        this.container = container;
        this.moduleName = moduleName;
        this.submoduleTitle = submoduleTitle;
        this.backToModuleCallback = backToModuleCallback;
        
        // Estado del componente
        this.currentFindings = [];
        this.currentData = [];
        this.currentYear = new Date().getFullYear().toString();
        this.currentSource = 'ministerio';
        this.currentPdfPath = null;
        this.submodulePath = null;
        this.activeTab = 'dashboard';

        // Datos vacíos iniciales
        this.findingsBase = {};
        this.dataBase = {};
    }

    async render() {
        // Registrar instancia global para manejo de eventos DOM
        window.currentEvaluacionInstance = this;
        
        // Limpiar contenedor y establecer clase base del sistema K+AIR
        this.container.innerHTML = '';
        this.container.className = ''; // Limpiar clases previas
        this.container.classList.add('k-module-container'); // Clase contenedora estándar

        const mainLayout = document.createElement('div');
        mainLayout.className = 'k-module-layout';
        
        mainLayout.innerHTML = `
            <!-- 1. HEADER DEL MÓDULO (Patrón Estándar K+AIR) -->
            <header class="k-module-header">
                <div class="k-header-top">
                    <div class="k-title-group">
                        <button class="k-btn-back" id="btn-back-eval" title="Volver al panel principal">
                            <i class="bi bi-arrow-left"></i>
                        </button>
                        <div class="k-title-text">
                            <h2 class="k-main-title">Evaluación Inicial del SG-SST</h2>
                            <span class="k-breadcrumb">Gestión Integral / 2.3.1 Evaluación Inicial</span>
                        </div>
                    </div>
                    <div class="k-header-actions">
                        <!-- Selector de Contexto -->
                        <div class="k-context-selector">
                            <i class="bi bi-calendar3"></i>
                            <select id="yearSelect" onchange="window.currentEvaluacionInstance.updateSource()">
                                <option value="2025" selected>2025</option>
                                <option value="2024">2024</option>
                                <option value="2023">2023</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 2. NAVEGACIÓN (Tabs) -->
                <nav class="k-module-nav">
                    <button class="k-nav-item active" data-tab="dashboard" onclick="window.currentEvaluacionInstance.switchTab('dashboard')">
                        <i class="bi bi-speedometer2"></i> Dashboard
                    </button>
                    <button class="k-nav-item" data-tab="hallazgos" onclick="window.currentEvaluacionInstance.switchTab('hallazgos')">
                        <i class="bi bi-list-check"></i> Hallazgos
                    </button>
                    <button class="k-nav-item" data-tab="actions" onclick="window.currentEvaluacionInstance.switchTab('actions')">
                        <i class="bi bi-clipboard-check"></i> Planes de Acción
                    </button>
                    <button class="k-nav-item" data-tab="history" onclick="window.currentEvaluacionInstance.switchTab('history')">
                        <i class="bi bi-clock-history"></i> Historial
                    </button>
                </nav>
            </header>

            <!-- 3. CONTENIDO SCROLLABLE -->
            <div class="k-module-content">
                
                <!-- Panel de Control Interno -->
                <div class="k-toolbar">
                    <div class="k-toolbar-group">
                        <label class="k-label-muted">Fuente de Datos:</label>
                        <select class="k-select-sm" id="sourceSelect" onchange="window.currentEvaluacionInstance.updateSource()">
                            <option value="ministerio">🏛️ Ministerio de Trabajo (Estándares Mínimos)</option>
                            <option value="arl">🛡️ Informe ARL</option>
                        </select>
                    </div>
                    <div id="loading-indicator" class="k-loading-badge" style="display:none;">
                        <span class="spinner-border spinner-border-sm"></span> Procesando...
                    </div>
                </div>

                <!-- VISTA: DASHBOARD -->
                <section id="view-dashboard" class="k-view active">
                    
                    <!-- KPIs Principales -->
                    <div class="k-grid-metrics">
                        <div class="k-card k-card-metric">
                            <div class="k-metric-header">
                                <span>CUMPLIMIENTO</span>
                                <i class="bi bi-pie-chart-fill text-primary"></i>
                            </div>
                            <div class="k-metric-body">
                                <span class="k-value text-primary" id="kpi-score">0%</span>
                                <span class="k-trend">Global</span>
                            </div>
                            <div class="k-mini-chart">
                                <canvas id="gaugeKpi" height="40"></canvas>
                            </div>
                        </div>

                        <div class="k-card k-card-metric">
                            <div class="k-metric-header">
                                <span>HALLAZGOS CRÍTICOS</span>
                                <i class="bi bi-exclamation-triangle-fill text-danger"></i>
                            </div>
                            <div class="k-metric-body">
                                <span class="k-value text-danger" id="kpi-gaps">0</span>
                                <span class="k-trend">Items "No Cumple"</span>
                            </div>
                            <div class="k-mini-chart">
                                <canvas id="bulletGaps" height="30"></canvas>
                            </div>
                        </div>

                        <div class="k-card k-card-metric">
                            <div class="k-metric-header">
                                <span>PLANES PENDIENTES</span>
                                <i class="bi bi-hourglass-split text-warning"></i>
                            </div>
                            <div class="k-metric-body">
                                <span class="k-value text-warning" id="kpi-pending">0</span>
                                <span class="k-trend">Acciones abiertas</span>
                            </div>
                            <div class="k-mini-chart">
                                <canvas id="bulletPending" height="30"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- Gráficos Principales -->
                    <div class="k-grid-charts">
                        <div class="k-card">
                            <div class="k-card-header">
                                <h3>Estado General de Cumplimiento</h3>
                            </div>
                            <div class="k-card-body k-flex-center">
                                <div style="position: relative; height: 200px; width: 100%;">
                                    <canvas id="gaugeChart"></canvas>
                                </div>
                                <div class="k-chart-label" id="chart-score-label">0%</div>
                            </div>
                        </div>

                        <div class="k-card">
                            <div class="k-card-header">
                                <h3>Balance Ciclo PHVA</h3>
                            </div>
                            <div class="k-card-body">
                                <div class="k-phva-bars" id="phva-chart-container">
                                    <div class="k-empty-state-small">Sin datos cargados</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tarjeta de Fuente -->
                    <div class="k-card k-card-source">
                        <div class="k-source-info">
                            <div class="k-source-icon"><i class="bi bi-file-earmark-pdf"></i></div>
                            <div>
                                <h4 id="source-title">Esperando archivo fuente...</h4>
                                <p id="source-meta">El sistema buscará automáticamente informes en la carpeta.</p>
                            </div>
                        </div>
                        <button class="k-btn k-btn-outline" id="btn-view-pdf" style="display:none;">
                            <i class="bi bi-eye"></i> Ver Documento
                        </button>
                    </div>
                </section>

                <!-- VISTA: HALLAZGOS -->
                <section id="view-hallazgos" class="k-view">
                    <div class="k-card">
                        <div class="k-card-header">
                            <h3>Detalle de Estándares</h3>
                            <input type="text" class="k-input-search" placeholder="Buscar estándar...">
                        </div>
                        <div class="k-table-responsive">
                            <table class="k-table">
                                <thead>
                                    <tr>
                                        <th style="width:10%">Código</th>
                                        <th style="width:50%">Descripción del Estándar</th>
                                        <th style="width:10%" class="text-center">Max</th>
                                        <th style="width:10%" class="text-center">Obt.</th>
                                        <th style="width:15%" class="text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody id="hallazgosTableBody">
                                    <tr><td colspan="5" class="k-empty-table">No hay datos cargados.</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <!-- VISTA: PLANES DE ACCIÓN -->
                <section id="view-actions" class="k-view">
                    <div class="k-card">
                        <div class="k-card-header">
                            <h3>Seguimiento de Planes</h3>
                            <button class="k-btn k-btn-primary"><i class="bi bi-plus-lg"></i> Nuevo Plan</button>
                        </div>
                        <div class="k-table-responsive">
                            <table class="k-table">
                                <thead>
                                    <tr>
                                        <th>Estado</th>
                                        <th>Hallazgo Asociado</th>
                                        <th>Acción Correctiva</th>
                                        <th>Responsable</th>
                                        <th>Fecha Límite</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="actionTableBody">
                                    <tr><td colspan="6" class="k-empty-table">No hay planes activos.</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <!-- VISTA: HISTORIAL -->
                <section id="view-history" class="k-view">
                    <div class="k-card" id="history-content">
                        <div class="k-empty-state">
                            <i class="bi bi-folder2-open"></i>
                            <p>Explorando directorio...</p>
                        </div>
                    </div>
                </section>

            </div>
            
            <!-- Notificaciones Toast -->
            <div id="k-toast" class="k-toast"></div>
        `;

        this.container.appendChild(mainLayout);

        // Inicializar referencias y datos
        this.updateReferences();
        await this.initializeData();
    }

    updateReferences() {
        this.hallazgosTableBody = document.getElementById('hallazgosTableBody');
        this.actionTableBody = document.getElementById('actionTableBody');
        
        const backBtn = document.getElementById('btn-back-eval');
        if (backBtn && this.backToModuleCallback) {
            backBtn.addEventListener('click', this.backToModuleCallback);
        }
        
        const btnPdf = document.getElementById('btn-view-pdf');
        if (btnPdf) {
            btnPdf.addEventListener('click', () => { 
                if (this.currentPdfPath) window.electronAPI.openPath(this.currentPdfPath); 
            });
        }
    }

    // --- LÓGICA DE NAVEGACIÓN (TABS) ---
    switchTab(tabId) {
        // 1. Actualizar botones de navegación
        const navItems = this.container.querySelectorAll('.k-nav-item');
        navItems.forEach(btn => {
            if (btn.dataset.tab === tabId) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // 2. Mostrar la sección correspondiente
        const views = this.container.querySelectorAll('.k-view');
        views.forEach(view => {
            view.classList.remove('active');
            // Usar display none/block para asegurar limpieza visual
            view.style.display = 'none'; 
        });

        const activeView = this.container.querySelector(`#view-${tabId}`);
        if (activeView) {
            activeView.classList.add('active');
            activeView.style.display = 'block';
            
            // Redibujar gráficos si se entra al dashboard para asegurar renderizado correcto
            if (tabId === 'dashboard' && this.currentFindings.length > 0) {
                // Pequeño delay para que el canvas tenga dimensiones
                setTimeout(() => this.updateDashboardWithRealData({ cumplimiento: parseInt(document.getElementById('kpi-score').textContent) }), 50);
            }
        }
        
        this.activeTab = tabId;
    }

    // --- LÓGICA DE DATOS ---
    async initializeData() {
        try {
            const company = window.currentCompany || 'Tempoactiva';
            const pathResult = await window.electronAPI.findSubmodulePath(company, 'Gestión Integral', '2.3.1 Evaluación inicial del SG-SST');
            
            if (pathResult.success && pathResult.path) {
                this.submodulePath = pathResult.path;
                await this.loadRealFiles();
            } else {
                this.showToast('No se encontró la carpeta del submódulo.', 'warning');
            }
        } catch (error) {
            console.error('Init Error:', error);
            this.showToast('Error inicializando sistema de archivos.', 'danger');
        }
    }

    async loadRealFiles() {
        try {
            const filesResult = await window.electronAPI.readDirectory(this.submodulePath);
            if (!filesResult.success) throw new Error('Error de lectura');

            let allFiles = [...(filesResult.files || [])];

            // Búsqueda recursiva simulada en carpetas clave
            const subfolders = ['Diagnostico Ministerio', 'Diagnostico ARL', 'SGSST'];
            for (const sub of subfolders) {
                const subPath = `${this.submodulePath}\${sub}`;
                // Intentamos leer sin lanzar error si no existe la subcarpeta
                try {
                    const subResult = await window.electronAPI.readDirectory(subPath);
                    if (subResult.success && subResult.files) {
                        allFiles = allFiles.concat(subResult.files);
                    }
                } catch (e) { /* Ignorar carpetas inexistentes */ }
            }

            this.renderHistoryFiles(allFiles);

            // Prioridad de detección de informe
            const reportPdf = allFiles.find(f => 
                f.name.toLowerCase().endsWith('.pdf') && 
                (f.name.includes('0312') || f.name.includes('evaluacion') || f.name.includes('informe'))
            );

            if (reportPdf) {
                this.currentPdfPath = reportPdf.path;
                const titleEl = document.getElementById('source-title');
                const metaEl = document.getElementById('source-meta');
                const btnView = document.getElementById('btn-view-pdf');

                if (titleEl) titleEl.textContent = reportPdf.name;
                if (metaEl) metaEl.textContent = `Archivo detectado en: ...${reportPdf.path.slice(-30)}`;
                if (btnView) btnView.style.display = 'inline-flex';
                
                await this.processPdfData(reportPdf.path);
            } else {
                document.getElementById('source-title').textContent = "No se encontró informe estándar";
                document.getElementById('source-meta').textContent = "Por favor cargue un archivo PDF de evaluación (0312).";
            }

        } catch (e) {
            console.warn(e);
            this.showToast('Error accediendo a los archivos.', 'warning');
        }
    }

    async processPdfData(pdfPath) {
        const loading = document.getElementById('loading-indicator');
        if (loading) loading.style.display = 'inline-flex';

        try {
            const sourceType = pdfPath.toLowerCase().includes('arl') ? 'arl' : 'ministerio';
            
            if (window.electronAPI && window.electronAPI.processEvaluacionPdf) {
                const result = await window.electronAPI.processEvaluacionPdf(pdfPath, sourceType);
                
                if (result.success) {
                    this.currentFindings = result.findings || [];
                    this.renderHallazgosTable();
                    this.updateDashboardWithRealData(result.metrics);
                    this.showToast('Datos procesados correctamente.', 'success');
                } else {
                    this.showToast('No se pudieron extraer datos estructurados.', 'warning');
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            if (loading) loading.style.display = 'none';
        }
    }

    // --- RENDERIZADO DE COMPONENTES ---
    renderHistoryFiles(files) {
        const container = document.getElementById('history-content');
        if (!container) return;

        if (!files || files.length === 0) {
            container.innerHTML = `
                <div class="k-empty-state">
                    <i class="bi bi-folder-x"></i>
                    <p>Carpeta vacía</p>
                </div>`;
            return;
        }

        let html = `
            <div class="k-card-header"><h3>Archivos Disponibles</h3></div>
            <div class="k-table-responsive">
            <table class="k-table">
                <thead><tr><th>Tipo</th><th>Nombre del Archivo</th><th class="text-right">Acción</th></tr></thead>
                <tbody>
        `;

        files.forEach(f => {
            const isPdf = f.name.toLowerCase().endsWith('.pdf');
            const isXls = f.name.toLowerCase().includes('xls');
            let icon = '<i class="bi bi-file-earmark"></i>';
            let colorClass = 'text-muted';
            
            if (isPdf) { icon = '<i class="bi bi-file-earmark-pdf-fill"></i>'; colorClass = 'text-danger'; }
            if (isXls) { icon = '<i class="bi bi-file-earmark-excel-fill"></i>'; colorClass = 'text-success'; }

            const safePath = f.path.replace(/\\/g, '\\\\');
            
            html += `
                <tr>
                    <td class="text-center" style="font-size:1.2rem; color:var(--text-muted);"><span class="${colorClass}">${icon}</span></td>
                    <td>
                        <div style="font-weight:500;">${f.name}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${safePath.split('\\').slice(-2, -1)[0] || 'Raíz'}</div>
                    </td>
                    <td class="text-right">
                        <button class="k-btn k-btn-sm k-btn-outline" onclick="window.electronAPI.openPath('${safePath}')">
                            Abrir <i class="bi bi-box-arrow-up-right ms-1"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    renderHallazgosTable() {
        const tbody = this.hallazgosTableBody;
        if (!tbody) return;
        
        if (this.currentFindings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="k-empty-table">No hay hallazgos para mostrar.</td></tr>';
            return;
        }

        tbody.innerHTML = this.currentFindings.map(item => {
            const isCompliant = item.grade >= item.max;
            const badgeClass = isCompliant ? 'k-badge-success' : 'k-badge-danger';
            
            return `
            <tr>
                <td style="font-weight:600; font-family:'Lexend';">${item.code}</td>
                <td>${item.desc}</td>
                <td class="text-center">${item.max}</td>
                <td class="text-center" style="font-weight:bold; color:${isCompliant ? 'var(--success)' : 'var(--danger)'}">${item.grade}</td>
                <td class="text-center">
                    <span class="k-badge ${badgeClass}">${item.status}</span>
                </td>
            </tr>
        `}).join('');
    }

    updateDashboardWithRealData(metrics) {
        if (!metrics) return;
        
        // Actualizar Textos
        const score = metrics.cumplimiento || 0;
        const noCumplidos = metrics.noCumplidos || 0;
        
        const scoreEl = document.getElementById('kpi-score');
        const gapsEl = document.getElementById('kpi-gaps');
        const chartLabel = document.getElementById('chart-score-label');
        
        if (scoreEl) scoreEl.textContent = score + '%';
        if (chartLabel) chartLabel.textContent = score + '%';
        if (gapsEl) gapsEl.textContent = noCumplidos;

        // Actualizar Gráficos
        this.drawGauge(score);
        
        // Simular PHVA si no hay datos detallados
        const phvaContainer = document.getElementById('phva-chart-container');
        if (phvaContainer) {
            phvaContainer.innerHTML = `
                <div class="k-progress-group">
                    <div class="k-progress-label"><span>PLANEAR</span><span>${Math.min(score + 10, 100)}%</span></div>
                    <div class="k-progress-bar"><div class="k-progress-fill" style="width:${Math.min(score + 10, 100)}%; background:var(--primary);"></div></div>
                </div>
                <div class="k-progress-group">
                    <div class="k-progress-label"><span>HACER</span><span>${score}%</span></div>
                    <div class="k-progress-bar"><div class="k-progress-fill" style="width:${score}%; background:var(--success);"></div></div>
                </div>
                <div class="k-progress-group">
                    <div class="k-progress-label"><span>VERIFICAR</span><span>${Math.max(score - 5, 0)}%</span></div>
                    <div class="k-progress-bar"><div class="k-progress-fill" style="width:${Math.max(score - 5, 0)}%; background:var(--info);"></div></div>
                </div>
                <div class="k-progress-group">
                    <div class="k-progress-label"><span>ACTUAR</span><span>${Math.max(score - 10, 0)}%</span></div>
                    <div class="k-progress-bar"><div class="k-progress-fill" style="width:${Math.max(score - 10, 0)}%; background:var(--warning);"></div></div>
                </div>
            `;
        }
    }

    updateSource() {
        console.log('Fuente actualizada por el usuario');
    }

    showToast(msg, type = 'info') {
        const t = document.getElementById("k-toast");
        if(t) {
            t.textContent = msg;
            t.className = `k-toast show ${type}`;
            setTimeout(() => t.classList.remove('show'), 3000);
        }
    }

    drawGauge(value = 0) {
        const canvas = document.getElementById('gaugeChart');
        if (!canvas) return;
        
        // Asegurar alta resolución
        const ctx = canvas.getContext('2d');
        const width = canvas.parentElement.offsetWidth;
        const height = 200; // Altura fija
        canvas.width = width;
        canvas.height = height;

        const cx = width / 2;
        const cy = height - 20;
        const r = Math.min(width, height) / 1.5;

        ctx.clearRect(0, 0, width, height);
        
        // Arco fondo
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
        ctx.lineWidth = 25;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#f1f3f5';
        ctx.stroke();

        // Arco valor
        const percentage = value / 100;
        const endAngle = Math.PI + (percentage * Math.PI);
        
        // Color dinámico
        let strokeColor = '#dc3545'; // Rojo
        if (value > 60) strokeColor = '#ffc107'; // Amarillo
        if (value > 85) strokeColor = '#28a745'; // Verde

        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI, endAngle);
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
    }
}

// Inyección de Estilos del Sistema K+AIR (Scoped)
if (!document.getElementById('k-air-eval-styles')) {
    const style = document.createElement('style');
    style.id = 'k-air-eval-styles';
    style.textContent = 
        `
        /*VARIABLES DEL SISTEMA */
        :root {
            --primary: #174ea6;
            --primary-hover: #185abd;
            --success: #28a745;
            --warning: #ffc107;
            --danger: #dc3545;
            --info: #17a2b8;
            --text-dark: #212529;
            --text-muted: #6c757d;
            --bg-body: #f8f9fa;
            --bg-card: #ffffff;
            --border: #dee2e6;
            --radius: 0.375rem;
            --shadow-sm: 0 0.125rem 0.25rem rgba(0,0,0,0.075);
        }

        /* LAYOUT PRINCIPAL */
        .k-module-container { height: 100%; width: 100%; background: var(--bg-body); font-family: 'Segoe UI', Roboto, sans-serif; overflow: hidden; }
        .k-module-layout { display: flex; flex-direction: column; height: 100%; }
        
        /* HEADER */
        .k-module-header { background: var(--bg-card); border-bottom: 1px solid var(--border); flex-shrink: 0; box-shadow: var(--shadow-sm); z-index: 10; }
        .k-header-top { display: flex; align-items: center; justify-content: space-between; padding: 1rem 2rem; height: 70px; }
        
        .k-title-group { display: flex; align-items: center; gap: 1rem; }
        .k-btn-back { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: white; border: 1px solid var(--border); border-radius: 8px; color: var(--text-dark); cursor: pointer; transition: 0.2s; }
        .k-btn-back:hover { border-color: var(--primary); color: var(--primary); background: #f0f7ff; }
        
        .k-title-text { display: flex; flex-direction: column; }
        .k-main-title { margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--primary); font-family: 'Lexend', sans-serif; }
        .k-breadcrumb { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }

        .k-context-selector select { padding: 0.4rem 0.8rem; border: 1px solid var(--border); border-radius: 6px; font-weight: 600; color: var(--text-dark); cursor: pointer; }

        /* NAVEGACIÓN TABS */
        .k-module-nav { display: flex; padding: 0 2rem; gap: 2rem; border-top: 1px solid #f8f9fa; }
        .k-nav-item { background: none; border: none; padding: 0.8rem 0; font-size: 0.9rem; font-weight: 600; color: var(--text-muted); border-bottom: 3px solid transparent; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 0.5rem; }
        .k-nav-item:hover { color: var(--primary); }
        .k-nav-item.active { color: var(--primary); border-bottom-color: var(--primary); }

        /* CONTENIDO */
        .k-module-content { flex: 1; overflow-y: auto; padding: 2rem; position: relative; }
        .k-view { display: none; animation: k-fade-in 0.3s ease-out; }
        .k-view.active { display: block; }
        @keyframes k-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* TOOLBAR */
        .k-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; background: white; padding: 1rem; border-radius: var(--radius); border: 1px solid var(--border); }
        .k-toolbar-group { display: flex; align-items: center; gap: 1rem; }
        .k-label-muted { font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
        .k-select-sm { padding: 0.3rem 0.6rem; border-radius: 4px; border: 1px solid var(--border); font-size: 0.9rem; }
        .k-loading-badge { font-size: 0.85rem; color: var(--primary); font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }

        /* METRICS GRID */
        .k-grid-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem; }
        .k-card-metric { padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; }
        .k-metric-header { display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 0.5rem; }
        .k-metric-body { z-index: 2; }
        .k-value { font-size: 2.2rem; font-weight: 700; line-height: 1; display: block; font-family: 'Teko', sans-serif; }
        .k-trend { font-size: 0.85rem; color: var(--text-muted); }
        .k-mini-chart { position: absolute; right: 1rem; bottom: 1rem; opacity: 0.5; }

        /* CHARTS GRID */
        .k-grid-charts { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
        .k-flex-center { display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }
        .k-chart-label { position: absolute; top: 60%; left: 50%; transform: translate(-50%, -50%); font-size: 2rem; font-weight: 700; color: var(--text-dark); }

        /* CARDS */
        .k-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-sm); overflow: hidden; }
        .k-card-header { padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #fff; }
        .k-card-header h3 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-dark); }
        .k-card-body { padding: 1.25rem; }

        /* PROGRESS BARS */
        .k-phva-bars { display: flex; flex-direction: column; gap: 1rem; }
        .k-progress-group { width: 100%; }
        .k-progress-label { display: flex; justify-content: space-between; margin-bottom: 0.3rem; font-size: 0.8rem; font-weight: 600; color: var(--text-dark); }
        .k-progress-bar { height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; }
        .k-progress-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }

        /* SOURCE CARD */
        .k-card-source { padding: 1rem; display: flex; justify-content: space-between; align-items: center; }
        .k-source-info { display: flex; align-items: center; gap: 1rem; }
        .k-source-icon { width: 40px; height: 40px; background: #e7f1ff; color: var(--primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
        .k-source-info h4 { margin: 0; font-size: 0.95rem; font-weight: 700; }
        .k-source-info p { margin: 0; font-size: 0.8rem; color: var(--text-muted); }

        /* TABLES */
        .k-table-responsive { width: 100%; overflow-x: auto; }
        .k-table { width: 100%; border-collapse: collapse; }
        .k-table th { background: #f8f9fa; padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; border-bottom: 2px solid var(--border); }
        .k-table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); font-size: 0.9rem; color: var(--text-dark); vertical-align: middle; }
        .k-table tr:hover { background-color: #f8f9fa; }
        .k-empty-table { text-align: center; padding: 2rem; color: var(--text-muted); font-style: italic; }

        /* BADGES & BUTTONS */
        .k-badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
        .k-badge-success { background: #d4edda; color: #155724; }
        .k-badge-danger { background: #f8d7da; color: #721c24; }
        .k-btn { padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.9rem; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; transition: 0.2s; border: 1px solid transparent; }
        .k-btn-primary { background: var(--primary); color: white; }
        .k-btn-primary:hover { background: var(--primary-hover); }
        .k-btn-outline { background: white; border-color: var(--border); color: var(--text-dark); }
        .k-btn-outline:hover { border-color: var(--primary); color: var(--primary); }
        .k-btn-sm { padding: 0.25rem 0.5rem; font-size: 0.8rem; }

        /* EMPTY STATES */
        .k-empty-state { text-align: center; padding: 3rem; color: var(--text-muted); }
        .k-empty-state i { font-size: 2.5rem; margin-bottom: 1rem; display: block; opacity: 0.5; }
        .k-empty-state-small { text-align: center; padding: 1rem; font-size: 0.85rem; color: var(--text-muted); font-style: italic; }

        /* UTILS */
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-primary { color: var(--primary) !important; }
        .text-success { color: var(--success) !important; }
        .text-warning { color: var(--warning) !important; }
        .text-danger { color: var(--danger) !important; }
        .text-muted { color: var(--text-muted) !important; }

        /* TOAST */
        .k-toast { visibility: hidden; min-width: 300px; background-color: #333; color: #fff; text-align: center; border-radius: 6px; padding: 12px 20px; position: fixed; z-index: 2000; bottom: 30px; right: 30px; font-size: 0.9rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15); opacity: 0; transition: opacity 0.3s; }
        .k-toast.show { visibility: visible; opacity: 1; }
        .k-toast.success { background-color: var(--success); }
        .k-toast.warning { background-color: var(--warning); color: #212529; }
        .k-toast.danger { background-color: var(--danger); }
    	
    `;
    document.head.appendChild(style);
}

// Inicialización
window.EvaluacionInicialSgSst = EvaluacionInicialSgSst;

})();