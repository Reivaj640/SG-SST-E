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
        
        // Datos de planes de acción
        this.actionPlans = [];
        this.actionPlanIdCounter = 1;
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
                        <button class="k-btn k-btn-sm k-btn-outline" id="btn-change-pdf" onclick="window.currentEvaluacionInstance.showPdfSelectorModal()" title="Cambiar archivo PDF">
                            <i class="bi bi-file-earmark-pdf"></i> Cambiar Archivo
                        </button>
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
                            <button class="k-btn k-btn-primary" onclick="window.currentEvaluacionInstance.showActionPlanModal()">
                                <i class="bi bi-plus-lg"></i> Nuevo Plan
                            </button>
                        </div>
                        <div class="k-table-responsive">
                            <table class="k-table">
                                <thead>
                                    <tr>
                                        <th style="width: 10%;">Estado</th>
                                        <th style="width: 25%;">Hallazgo Asociado</th>
                                        <th style="width: 25%;">Acción Correctiva</th>
                                        <th style="width: 15%;">Responsable</th>
                                        <th style="width: 10%;">Fecha Límite</th>
                                        <th style="width: 15%;">Acciones</th>
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
        console.log('[EvaluacionInicialSgSst] switchTab() - Cambiando a pestaña:', tabId);
        
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
            console.log('[EvaluacionInicialSgSst] switchTab() - Vista encontrada:', activeView.id);
            activeView.classList.add('active');
            activeView.style.display = 'block';
            console.log('[EvaluacionInicialSgSst] switchTab() - Vista activada con display:', activeView.style.display);

            // Redibujar gráficos si se entra al dashboard para asegurar renderizado correcto
            if (tabId === 'dashboard' && this.currentFindings.length > 0) {
                // Pequeño delay para que el canvas tenga dimensiones
                setTimeout(() => this.updateDashboardWithRealData({ cumplimiento: parseInt(document.getElementById('kpi-score').textContent) }), 50);
            }
        } else {
            console.error('[EvaluacionInicialSgSst] switchTab() - Vista no encontrada:', `#view-${tabId}`);
        }

        this.activeTab = tabId;
        console.log('[EvaluacionInicialSgSst] switchTab() - Pestaña actual actualizada a:', this.activeTab);
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
            console.log('[EvaluacionInicialSgSst] Cargando archivos desde:', this.submodulePath);
            const filesResult = await window.electronAPI.readDirectory(this.submodulePath);
            console.log('[EvaluacionInicialSgSst] Resultado readDirectory:', filesResult);
            
            if (!filesResult.success) throw new Error('Error de lectura');

            let allFiles = [...(filesResult.files || [])];
            console.log('[EvaluacionInicialSgSst] Archivos encontrados en raíz:', allFiles.length);

            // Búsqueda recursiva simulada en carpetas clave
            const subfolders = ['Diagnostico Ministerio', 'Diagnostico ARL', 'SGSST'];
            for (const sub of subfolders) {
                const subPath = `${this.submodulePath}\\${sub}`;
                console.log('[EvaluacionInicialSgSst] Buscando en subcarpeta:', subPath);
                // Intentamos leer sin lanzar error si no existe la subcarpeta
                try {
                    const subResult = await window.electronAPI.readDirectory(subPath);
                    console.log('[EvaluacionInicialSgSst] Resultado subcarpeta', sub, ':', subResult);
                    if (subResult.success && subResult.files) {
                        allFiles = allFiles.concat(subResult.files);
                        console.log('[EvaluacionInicialSgSst] Archivos agregados desde', sub, ':', subResult.files.length);
                    }
                } catch (e) { 
                    console.log('[EvaluacionInicialSgSst] Subcarpeta no existe o error:', sub, e.message);
                }
            }

            console.log('[EvaluacionInicialSgSst] Total de archivos encontrados:', allFiles.length);
            this.renderHistoryFiles(allFiles);

            // Filtrar solo archivos PDF
            const pdfFiles = allFiles.filter(f => f.name.toLowerCase().endsWith('.pdf'));
            console.log('[EvaluacionInicialSgSst] Archivos PDF encontrados:', pdfFiles.length);
            console.log('[EvaluacionInicialSgSst] Lista de PDFs:', pdfFiles.map(f => f.name));

            // Si hay múltiples PDFs, mostrar selector
            if (pdfFiles.length > 1) {
                console.log('[EvaluacionInicialSgSst] Mostrando selector de PDFs');
                this.showPdfSelector(pdfFiles);
            } else if (pdfFiles.length === 1) {
                // Si solo hay uno, procesarlo directamente
                console.log('[EvaluacionInicialSgSst] Procesando único PDF encontrado');
                const reportPdf = pdfFiles[0];
                this.currentPdfPath = reportPdf.path;
                const titleEl = document.getElementById('source-title');
                const metaEl = document.getElementById('source-meta');
                const btnView = document.getElementById('btn-view-pdf');

                if (titleEl) titleEl.textContent = reportPdf.name;
                if (metaEl) metaEl.textContent = `Archivo detectado en: ...${reportPdf.path.slice(-30)}`;
                if (btnView) btnView.style.display = 'inline-flex';

                await this.processPdfData(reportPdf.path);
            } else {
                console.warn('[EvaluacionInicialSgSst] No se encontraron archivos PDF');
                document.getElementById('source-title').textContent = "No se encontró informe estándar";
                document.getElementById('source-meta').textContent = "Por favor cargue un archivo PDF de evaluación (0312).";
            }

        } catch (e) {
            console.error('[EvaluacionInicialSgSst] Error en loadRealFiles:', e);
            this.showToast('Error accediendo a los archivos.', 'warning');
        }
    }

    showPdfSelector(pdfFiles) {
        // Crear un modal mejorado para seleccionar el PDF
        const modal = document.createElement('div');
        modal.className = 'k-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: fadeIn 0.3s ease-in-out;
        `;
 
        // Agrupar PDFs por tipo
        const ministerioPdfs = pdfFiles.filter(f => f.path.toLowerCase().includes('ministerio'));
        const arlPdfs = pdfFiles.filter(f => f.path.toLowerCase().includes('arl'));
        const otherPdfs = pdfFiles.filter(f => 
            !f.path.toLowerCase().includes('ministerio') && 
            !f.path.toLowerCase().includes('arl')
        );
 
        let modalContent = `
            <div class="k-modal-content" style="
                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                padding: 2.5rem;
                border-radius: 16px;
                width: 90%;
                max-width: 700px;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                animation: slideUp 0.4s ease-out;
            ">
                <div class="k-modal-header" style="margin-bottom: 2rem; text-align: center;">
                    <div style="
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 60px;
                        height: 60px;
                        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
                        border-radius: 50%;
                        margin-bottom: 1rem;
                        box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
                    ">
                        <i class="bi bi-file-earmark-pdf-fill" style="color: white; font-size: 1.8rem;"></i>
                    </div>
                    <h3 style="margin: 0 0 0.5rem 0; color: var(--text-dark); font-size: 1.5rem; font-weight: 600;">
                        Seleccionar PDF de Evaluación
                    </h3>
                    <p style="margin: 0; color: var(--text-muted); font-size: 0.95rem;">
                        Se encontraron <strong style="color: var(--primary);">${pdfFiles.length}</strong> archivos PDF
                    </p>
                </div>
                <div class="k-modal-body">
        `;
 
        // Función para renderizar grupo de PDFs
        const renderPdfGroup = (title, pdfs, icon, color, bgColor) => {
            if (pdfs.length === 0) return '';
            
            let groupHtml = `
                <div style="margin-bottom: 1.5rem;">
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        margin-bottom: 1rem;
                        padding-bottom: 0.5rem;
                        border-bottom: 2px solid ${bgColor};
                    ">
                        <i class="${icon}" style="color: ${color}; font-size: 1.2rem;"></i>
                        <h4 style="margin: 0; color: var(--text-dark); font-size: 1.1rem; font-weight: 600;">
                            ${title} <span style="color: var(--text-muted); font-weight: 400; font-size: 0.9rem;">(${pdfs.length})</span>
                        </h4>
                    </div>
                    <div class="k-list-group" style="display: grid; gap: 0.75rem;">
            `;
 
            pdfs.forEach((pdf, index) => {
                const encodedPath = encodeURIComponent(pdf.path);
                const encodedName = encodeURIComponent(pdf.name);
                const isMinisterio = pdf.path.toLowerCase().includes('ministerio');
                const cardColor = isMinisterio ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' : 'linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%)';
                const iconColor = isMinisterio ? '#0d6efd' : '#ffc107';
                const iconClass = isMinisterio ? 'bi-building' : 'bi-shield-check';
                
                groupHtml += `
                    <div class="k-list-item" style="
                        padding: 1.25rem;
                        border: 2px solid ${bgColor};
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        background: white;
                        position: relative;
                        overflow: hidden;
                    " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.15)';" 
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';"
                       onclick="window.currentEvaluacionInstance.selectPdf(decodeURIComponent('${encodedPath}'), decodeURIComponent('${encodedName}'))">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                width: 50px;
                                height: 50px;
                                background: ${cardColor};
                                border-radius: 10px;
                                flex-shrink: 0;
                            ">
                                <i class="bi ${iconClass}" style="color: white; font-size: 1.4rem;"></i>
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="
                                    font-weight: 600; 
                                    color: var(--text-dark); 
                                    font-size: 1rem;
                                    margin-bottom: 0.25rem;
                                    white-space: nowrap;
                                    overflow: hidden;
                                    text-overflow: ellipsis;
                                ">${pdf.name}</div>
                                <div style="
                                    display: flex;
                                    align-items: center;
                                    gap: 0.5rem;
                                    font-size: 0.85rem;
                                    color: var(--text-muted);
                                ">
                                    <span style="
                                        display: inline-flex;
                                        align-items: center;
                                        gap: 0.25rem;
                                        padding: 0.25rem 0.5rem;
                                        background: ${bgColor}20;
                                        border-radius: 4px;
                                    ">
                                        <i class="bi bi-folder" style="font-size: 0.9rem;"></i>
                                        ${pdf.path.split('\\').slice(-2, -1)[0] || 'Raíz'}
                                    </span>
                                    <span style="
                                        display: inline-flex;
                                        align-items: center;
                                        gap: 0.25rem;
                                        padding: 0.25rem 0.5rem;
                                        background: var(--success)15;
                                        border-radius: 4px;
                                    ">
                                        <i class="bi bi-file-earmark" style="font-size: 0.9rem;"></i>
                                        ${Math.round(pdf.size / 1024)} KB
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div style="
                            position: absolute;
                            top: 0;
                            right: 0;
                            width: 4px;
                            height: 100%;
                            background: ${iconColor};
                            border-radius: 0 12px 12px 0;
                        "></div>
                    </div>
                `;
            });
 
            groupHtml += `</div></div>`;
            return groupHtml;
        };
 
        // Renderizar grupos
        modalContent += renderPdfGroup('🏛️ Ministerio de Trabajo', ministerioPdfs, 'bi-building', '#0d6efd', '#0d6efd');
        modalContent += renderPdfGroup('🛡️ Informe ARL', arlPdfs, 'bi-shield-check', '#ffc107', '#ffc107');
        if (otherPdfs.length > 0) {
            modalContent += renderPdfGroup('📁 Otros Archivos', otherPdfs, 'bi-file-earmark', '#6c757d', '#6c757d');
        }
 
        modalContent += `
                </div>
                <div class="k-modal-footer" style="
                    margin-top: 2rem; 
                    padding-top: 1.5rem; 
                    border-top: 1px solid var(--border); 
                    display: flex; 
                    justify-content: flex-end; 
                    gap: 0.75rem;
                ">
                    <button class="k-btn k-btn-outline" onclick="this.closest('.k-modal').remove()" style="
                        padding: 0.75rem 1.5rem;
                        font-size: 0.95rem;
                        border-radius: 8px;
                    ">
                        <i class="bi bi-x-lg me-1"></i> Cancelar
                    </button>
                </div>
            </div>
            
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { 
                        opacity: 0; 
                        transform: translateY(30px); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0); 
                    }
                }
                .k-list-item:hover {
                    border-color: var(--primary) !important;
                }
            </style>
        `;
 
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);
    }

    selectPdf(pdfPath, pdfName) {
        // Cerrar el modal
        const modal = document.querySelector('.k-modal');
        if (modal) modal.remove();

        // Actualizar la UI con el archivo seleccionado
        this.currentPdfPath = pdfPath;
        const titleEl = document.getElementById('source-title');
        const metaEl = document.getElementById('source-meta');
        const btnView = document.getElementById('btn-view-pdf');

        if (titleEl) titleEl.textContent = pdfName;
        if (metaEl) metaEl.textContent = `Archivo seleccionado: ...${pdfPath.slice(-30)}`;
        if (btnView) btnView.style.display = 'inline-flex';

        // Procesar el PDF seleccionado
        this.processPdfData(pdfPath);
    }

    async processPdfData(pdfPath) {
        const loading = document.getElementById('loading-indicator');
        if (loading) loading.style.display = 'inline-flex';

        try {
            console.log('[EvaluacionInicialSgSst] Iniciando procesamiento de PDF:', pdfPath);
            const sourceType = pdfPath.toLowerCase().includes('arl') ? 'arl' : 'ministerio';
            console.log('[EvaluacionInicialSgSst] Tipo de fuente detectado:', sourceType);

            if (window.electronAPI && window.electronAPI.processEvaluacionPdf) {
                console.log('[EvaluacionInicialSgSst] Llamando a processEvaluacionPdf...');
                const result = await window.electronAPI.processEvaluacionPdf(pdfPath, sourceType);
                console.log('[EvaluacionInicialSgSst] Resultado recibido:', result);

                if (result.success) {
                    console.log('[EvaluacionInicialSgSst] PDF procesado exitosamente');
                    console.log('[EvaluacionInicialSgSst] Hallazgos encontrados:', result.findings?.length || 0);
                    console.log('[EvaluacionInicialSgSst] Métricas:', result.metrics);
                    console.log('[EvaluacionInicialSgSst] Pestaña actual:', this.activeTab);
                    console.log('[EvaluacionInicialSgSst] Planes de acción extraídos:', result.actionPlans?.length || 0);
                    
                    this.currentFindings = result.findings || [];
                    this.renderHallazgosTable();
                    this.updateDashboardWithRealData(result.metrics);
                    
                    // Procesar planes de acción según el tipo de fuente
                    if (result.source === 'arl' && result.actionPlans && result.actionPlans.length > 0) {
                        // Para informes de ARL, usar los planes de acción extraídos
                        console.log('[EvaluacionInicialSgSst] Procesando planes de acción de ARL');
                        this.processArlActionPlans(result.actionPlans);
                    } else if (result.source === 'ministerio') {
                        // Para informes del Ministerio, generar planes automáticamente para hallazgos "no_cumple"
                        console.log('[EvaluacionInicialSgSst] Generando planes de acción para hallazgos no_cumple');
                        this.generateActionPlansForNoCumple();
                    }
                    
                    this.renderActionPlansTable();
                    
                    // Cambiar a la pestaña de Planes de Acción para mostrar la tabla
                    console.log('[EvaluacionInicialSgSst] Cambiando a pestaña de Planes de Acción');
                    this.switchTab('actions');
                    
                    this.showToast('Datos procesados correctamente.', 'success');
                } else {
                    console.error('[EvaluacionInicialSgSst] Error procesando PDF:', result.error);
                    this.showToast(`No se pudieron extraer datos: ${result.error || 'Error desconocido'}`, 'warning');
                }
            } else {
                console.error('[EvaluacionInicialSgSst] electronAPI o processEvaluacionPdf no disponible');
                this.showToast('Error: API no disponible', 'danger');
            }
        } catch (error) {
            console.error('[EvaluacionInicialSgSst] Excepción en processPdfData:', error);
            this.showToast(`Error: ${error.message}`, 'danger');
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
            
            const encodedPath = encodeURIComponent(f.path);
            
            html += `
                <tr>
                    <td class="text-center" style="font-size:1.2rem; color:var(--text-muted);"><span class="${colorClass}">${icon}</span></td>
                    <td>
                        <div style="font-weight:500;">${f.name}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${f.path.split('\\').slice(-2, -1)[0] || 'Raíz'}</div>
                    </td>
                    <td class="text-right">
                        <button class="k-btn k-btn-sm k-btn-outline" onclick="window.electronAPI.openPath(decodeURIComponent('${encodedPath}'))">
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
            const needsReview = item.requiereRevisionManual;
            const hasErrors = item.errores && item.errores.length > 0;
            const rowClass = needsReview ? 'k-row-warning' : '';

            // Crear tooltip con errores si existen
            let errorTooltip = '';
            if (hasErrors) {
                const errorText = item.errores.join(', ');
                errorTooltip = `title="${errorText}" data-bs-toggle="tooltip"`;
            }

            return `
            <tr class="${rowClass}">
                <td style="font-weight:600; font-family:'Lexend';">
                    ${item.code}
                    ${needsReview ? '<i class="bi bi-exclamation-circle text-warning" title="Requiere revisión manual"></i>' : ''}
                    ${hasErrors ? `<i class="bi bi-x-circle text-danger" ${errorTooltip}></i>` : ''}
                </td>
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
        console.log('[EvaluacionInicialSgSst] Fuente actualizada por el usuario');
        
        // Obtener el valor seleccionado
        const sourceSelect = document.getElementById('sourceSelect');
        const yearSelect = document.getElementById('yearSelect');
        
        if (!sourceSelect || !yearSelect) return;
        
        const newSource = sourceSelect.value;
        const newYear = yearSelect.value;
        
        console.log('[EvaluacionInicialSgSst] Nueva fuente:', newSource);
        console.log('[EvaluacionInicialSgSst] Nuevo año:', newYear);
        
        // Actualizar estado
        this.currentSource = newSource;
        this.currentYear = newYear;
        
        // Cargar archivos nuevamente sin recargar la página
        this.loadRealFiles();
    }
    
    showPdfSelectorModal() {
        console.log('[EvaluacionInicialSgSst] Abriendo modal de selección de PDFs');
        
        // Cargar archivos nuevamente y mostrar el modal
        this.loadRealFiles();
    }
    
    // --- FUNCIONES PARA PLANES DE ACCIÓN ---
    
    showActionPlanModal(planId = null) {
        console.log('[EvaluacionInicialSgSst] Abriendo modal de plan de acción:', planId);
        
        const isEdit = planId !== null;
        const plan = isEdit ? this.actionPlans.find(p => p.id === planId) : null;
        
        const modal = document.createElement('div');
        modal.className = 'k-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: fadeIn 0.3s ease-in-out;
        `;
        
        const hallazgosOptions = this.currentFindings.map(f => 
            `<option value="${f.code}">${f.code} - ${f.desc.substring(0, 50)}...</option>`
        ).join('');
        
        let modalContent = `
            <div class="k-modal-content" style="
                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                padding: 2.5rem;
                border-radius: 16px;
                width: 90%;
                max-width: 700px;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                animation: slideUp 0.4s ease-out;
            ">
                <div class="k-modal-header" style="margin-bottom: 2rem; text-align: center;">
                    <div style="
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 60px;
                        height: 60px;
                        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
                        border-radius: 50%;
                        margin-bottom: 1rem;
                        box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
                    ">
                        <i class="bi bi-clipboard-check" style="color: white; font-size: 1.8rem;"></i>
                    </div>
                    <h3 style="margin: 0 0 0.5rem 0; color: var(--text-dark); font-size: 1.5rem; font-weight: 600;">
                        ${isEdit ? 'Editar Plan de Acción' : 'Nuevo Plan de Acción'}
                    </h3>
                    <p style="margin: 0; color: var(--text-muted); font-size: 0.95rem;">
                        ${isEdit ? 'Modifique los datos del plan de acción existente' : 'Complete el formulario para crear un nuevo plan de acción'}
                    </p>
                </div>
                <div class="k-modal-body">
                    <form id="actionPlanForm" style="display: grid; gap: 1.5rem;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div>
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-dark);">
                                    Hallazgo Asociado <span style="color: var(--danger);">*</span>
                                </label>
                                <select id="planHallazgo" class="k-input" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;" required>
                                    <option value="">Seleccione un hallazgo...</option>
                                    ${hallazgosOptions}
                                </select>
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-dark);">
                                    Estado <span style="color: var(--danger);">*</span>
                                </label>
                                <select id="planEstado" class="k-input" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;" required>
                                    <option value="pendiente">⏳ Pendiente</option>
                                    <option value="en_progreso">🔄 En Progreso</option>
                                    <option value="completado">✅ Completado</option>
                                    <option value="cancelado">❌ Cancelado</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-dark);">
                                Acción Correctiva <span style="color: var(--danger);">*</span>
                            </label>
                            <textarea id="planAccion" class="k-input" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; min-height: 100px; resize: vertical;" required placeholder="Describa la acción correctiva a implementar..."></textarea>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div>
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-dark);">
                                    Responsable <span style="color: var(--danger);">*</span>
                                </label>
                                <input type="text" id="planResponsable" class="k-input" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;" required placeholder="Nombre del responsable">
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-dark);">
                                    Fecha Límite <span style="color: var(--danger);">*</span>
                                </label>
                                <input type="date" id="planFechaLimite" class="k-input" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;" required>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="k-modal-footer" style="
                    margin-top: 2rem; 
                    padding-top: 1.5rem; 
                    border-top: 1px solid var(--border); 
                    display: flex; 
                    justify-content: flex-end; 
                    gap: 0.75rem;
                ">
                    <button class="k-btn k-btn-outline" onclick="this.closest('.k-modal').remove()" style="
                        padding: 0.75rem 1.5rem;
                        font-size: 0.95rem;
                        border-radius: 8px;
                    ">
                        <i class="bi bi-x-lg me-1"></i> Cancelar
                    </button>
                    <button class="k-btn k-btn-primary" onclick="window.currentEvaluacionInstance.saveActionPlan(${planId})" style="
                        padding: 0.75rem 1.5rem;
                        font-size: 0.95rem;
                        border-radius: 8px;
                    ">
                        <i class="bi bi-check-lg me-1"></i> ${isEdit ? 'Guardar Cambios' : 'Crear Plan'}
                    </button>
                </div>
            </div>
            
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { 
                        opacity: 0; 
                        transform: translateY(30px); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0); 
                    }
                }
                .k-input {
                    font-family: 'Segoe UI', Roboto, sans-serif;
                    font-size: 0.95rem;
                    color: var(--text-dark);
                    transition: border-color 0.2s;
                }
                .k-input:focus {
                    outline: none;
                    border-color: var(--primary);
                    box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.1);
                }
            </style>
        `;
        
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);
        
        // Si es edición, llenar el formulario con los datos existentes
        if (isEdit && plan) {
            document.getElementById('planHallazgo').value = plan.hallazgoId;
            document.getElementById('planEstado').value = plan.estado;
            document.getElementById('planAccion').value = plan.accion;
            document.getElementById('planResponsable').value = plan.responsable;
            document.getElementById('planFechaLimite').value = plan.fechaLimite;
        }
    }
    
    saveActionPlan(planId = null) {
        const form = document.getElementById('actionPlanForm');
        if (!form) return;
        
        const hallazgoId = document.getElementById('planHallazgo').value;
        const estado = document.getElementById('planEstado').value;
        const accion = document.getElementById('planAccion').value;
        const responsable = document.getElementById('planResponsable').value;
        const fechaLimite = document.getElementById('planFechaLimite').value;
        
        if (!hallazgoId || !estado || !accion || !responsable || !fechaLimite) {
            this.showToast('Por favor complete todos los campos requeridos', 'warning');
            return;
        }
        
        const hallazgo = this.currentFindings.find(f => f.code === hallazgoId);
        if (!hallazgo) {
            this.showToast('Hallazgo no encontrado', 'danger');
            return;
        }
        
        if (planId) {
            // Editar plan existente
            const planIndex = this.actionPlans.findIndex(p => p.id === planId);
            if (planIndex !== -1) {
                this.actionPlans[planIndex] = {
                    ...this.actionPlans[planIndex],
                    hallazgoId,
                    estado,
                    accion,
                    responsable,
                    fechaLimite,
                    fechaModificacion: new Date().toISOString()
                };
                this.showToast('Plan de acción actualizado correctamente', 'success');
            }
        } else {
            // Crear nuevo plan
            const newPlan = {
                id: this.actionPlanIdCounter++,
                hallazgoId,
                hallazgoCodigo: hallazgo.code,
                hallazgoDescripcion: hallazgo.desc,
                estado,
                accion,
                responsable,
                fechaLimite,
                fechaCreacion: new Date().toISOString(),
                seguimientos: [],
                responsables: [responsable]
            };
            this.actionPlans.push(newPlan);
            this.showToast('Plan de acción creado correctamente', 'success');
        }
        
        // Cerrar modal y actualizar tabla
        const modal = document.querySelector('.k-modal');
        if (modal) modal.remove();
        
        this.renderActionPlansTable();
    }
    
    showActionPlanDetailModal(planId) {
        console.log('[EvaluacionInicialSgSst] Mostrando detalle del plan:', planId);
        
        const plan = this.actionPlans.find(p => p.id === planId);
        if (!plan) {
            this.showToast('Plan no encontrado', 'danger');
            return;
        }
        
        const hallazgo = this.currentFindings.find(f => f.code === plan.hallazgoId);
        
        const modal = document.createElement('div');
        modal.className = 'k-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: fadeIn 0.3s ease-in-out;
        `;
        
        let modalContent = `
            <div class="k-modal-content" style="
                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                padding: 2.5rem;
                border-radius: 16px;
                width: 90%;
                max-width: 800px;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                animation: slideUp 0.4s ease-out;
            ">
                <div class="k-modal-header" style="margin-bottom: 2rem; text-align: center;">
                    <div style="
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 60px;
                        height: 60px;
                        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
                        border-radius: 50%;
                        margin-bottom: 1rem;
                        box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
                    ">
                        <i class="bi bi-clipboard-data" style="color: white; font-size: 1.8rem;"></i>
                    </div>
                    <h3 style="margin: 0 0 0.5rem 0; color: var(--text-dark); font-size: 1.5rem; font-weight: 600;">
                        Detalle del Plan de Acción
                    </h3>
                </div>
                <div class="k-modal-body">
                    <div style="display: grid; gap: 1.5rem;">
                        <div style="background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border);">
                            <h4 style="margin: 0 0 1rem 0; color: var(--primary); font-size: 1.1rem; font-weight: 600;">
                                <i class="bi bi-list-check me-2"></i> Información del Plan
                            </h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                                <div>
                                    <span style="color: var(--text-muted); font-size: 0.9rem;">Estado:</span>
                                    <span style="font-weight: 600; color: var(--text-dark); margin-left: 0.5rem;">
                                        ${this.getEstadoBadge(plan.estado)}
                                    </span>
                                </div>
                                <div>
                                    <span style="color: var(--text-muted); font-size: 0.9rem;">Fecha Límite:</span>
                                    <span style="font-weight: 600; color: var(--text-dark); margin-left: 0.5rem;">
                                        ${new Date(plan.fechaLimite).toLocaleDateString('es-CO')}
                                    </span>
                                </div>
                            </div>
                            <div style="margin-top: 1rem;">
                                <span style="color: var(--text-muted); font-size: 0.9rem;">Responsable:</span>
                                <div style="font-weight: 600; color: var(--text-dark); margin-top: 0.5rem;">
                                    ${plan.responsable}
                                </div>
                            </div>
                        </div>
                        
                        <div style="background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border);">
                            <h4 style="margin: 0 0 1rem 0; color: var(--primary); font-size: 1.1rem; font-weight: 600;">
                                <i class="bi bi-exclamation-triangle me-2"></i> Hallazgo Asociado
                            </h4>
                            <div style="margin-top: 1rem;">
                                <div style="background: var(--warning)15; padding: 1rem; border-radius: 8px; margin-bottom: 0.5rem;">
                                    <span style="font-weight: 600; color: var(--text-dark);">${hallazgo.code}</span>
                                    <span class="k-badge k-badge-warning" style="margin-left: 0.5rem;">${hallazgo.status}</span>
                                </div>
                                <div style="color: var(--text-dark); line-height: 1.6;">
                                    ${hallazgo.desc}
                                </div>
                            </div>
                        </div>
                        
                        <div style="background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border);">
                            <h4 style="margin: 0 0 1rem 0; color: var(--primary); font-size: 1.1rem; font-weight: 600;">
                                <i class="bi bi-clipboard-check me-2"></i> Acción Correctiva
                            </h4>
                            <div style="margin-top: 1rem; color: var(--text-dark); line-height: 1.6;">
                                ${plan.accion}
                            </div>
                        </div>
                        
                        <div style="background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border);">
                            <h4 style="margin: 0 0 1rem 0; color: var(--primary); font-size: 1.1rem; font-weight: 600;">
                                <i class="bi bi-people me-2"></i> Responsables
                            </h4>
                            <div style="margin-top: 1rem;">
                                ${plan.responsables.map(r => `
                                    <div style="
                                        display: flex;
                                        align-items: center;
                                        gap: 0.75rem;
                                        padding: 0.75rem;
                                        background: var(--bg-body);
                                        border-radius: 8px;
                                        margin-bottom: 0.5rem;
                                    ">
                                        <i class="bi bi-person-circle" style="color: var(--primary); font-size: 1.2rem;"></i>
                                        <span style="font-weight: 500;">${r}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div style="background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border);">
                            <h4 style="margin: 0 0 1rem 0; color: var(--primary); font-size: 1.1rem; font-weight: 600;">
                                <i class="bi bi-clock-history me-2"></i> Seguimiento
                            </h4>
                            <div style="margin-top: 1rem;">
                                ${plan.seguimientos.length > 0 ? plan.seguimientos.map(s => `
                                    <div style="
                                        padding: 1rem;
                                        background: var(--bg-body);
                                        border-radius: 8px;
                                        margin-bottom: 0.75rem;
                                        border-left: 3px solid var(--primary);
                                    ">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                            <span style="font-weight: 600; color: var(--text-dark);">${s.descripcion}</span>
                                            <span style="color: var(--text-muted); font-size: 0.85rem;">${new Date(s.fecha).toLocaleDateString('es-CO')}</span>
                                        </div>
                                        <div style="color: var(--text-muted); font-size: 0.9rem;">${s.responsable}</div>
                                    </div>
                                `).join('') : '<p style="color: var(--text-muted); font-style: italic;">No hay seguimientos registrados</p>'}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="k-modal-footer" style="
                    margin-top: 2rem; 
                    padding-top: 1.5rem; 
                    border-top: 1px solid var(--border); 
                    display: flex; 
                    justify-content: space-between; 
                    gap: 0.75rem;
                ">
                    <button class="k-btn k-btn-outline" onclick="window.currentEvaluacionInstance.showFollowUpModal(${plan.id})" style="
                        padding: 0.75rem 1.5rem;
                        font-size: 0.95rem;
                        border-radius: 8px;
                    ">
                        <i class="bi bi-plus-lg me-1"></i> Agregar Seguimiento
                    </button>
                    <button class="k-btn k-btn-outline" onclick="window.currentEvaluacionInstance.showResponsibleModal(${plan.id})" style="
                        padding: 0.75rem 1.5rem;
                        font-size: 0.95rem;
                        border-radius: 8px;
                    ">
                        <i class="bi bi-person-plus me-1"></i> Gestionar Responsables
                    </button>
                    <button class="k-btn k-btn-primary" onclick="this.closest('.k-modal').remove()" style="
                        padding: 0.75rem 1.5rem;
                        font-size: 0.95rem;
                        border-radius: 8px;
                    ">
                        <i class="bi bi-x-lg me-1"></i> Cerrar
                    </button>
                </div>
            </div>
            
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { 
                        opacity: 0; 
                        transform: translateY(30px); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0); 
                    }
                }
            </style>
        `;
        
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);
    }
    
    showFollowUpModal(planId) {
        console.log('[EvaluacionInicialSgSst] Abriendo modal de seguimiento para plan:', planId);
        
        const plan = this.actionPlans.find(p => p.id === planId);
        if (!plan) {
            this.showToast('Plan no encontrado', 'danger');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'k-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: fadeIn 0.3s ease-in-out;
        `;
        
        let modalContent = `
            <div class="k-modal-content" style="
                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                padding: 2.5rem;
                border-radius: 16px;
                width: 90%;
                max-width: 600px;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                animation: slideUp 0.4s ease-out;
            ">
                <div class="k-modal-header" style="margin-bottom: 2rem; text-align: center;">
                    <div style="
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 60px;
                        height: 60px;
                        background: linear-gradient(135deg, var(--success) 0%, #1e7e34 100%);
                        border-radius: 50%;
                        margin-bottom: 1rem;
                        box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
                    ">
                        <i class="bi bi-clock-history" style="color: white; font-size: 1.8rem;"></i>
                    </div>
                    <h3 style="margin: 0 0 0.5rem 0; color: var(--text-dark); font-size: 1.5rem; font-weight: 600;">
                        Agregar Seguimiento
                    </h3>
                    <p style="margin: 0; color: var(--text-muted); font-size: 0.95rem;">
                        Registre el progreso del plan de acción
                    </p>
                </div>
                <div class="k-modal-body">
                    <form id="followUpForm" style="display: grid; gap: 1.5rem;">
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-dark);">
                                Descripción <span style="color: var(--danger);">*</span>
                            </label>
                            <textarea id="followUpDescripcion" class="k-input" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; min-height: 100px; resize: vertical;" required placeholder="Describa el progreso o novedad..."></textarea>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div>
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-dark);">
                                    Fecha <span style="color: var(--danger);">*</span>
                                </label>
                                <input type="date" id="followUpFecha" class="k-input" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;" required>
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-dark);">
                                    Responsable <span style="color: var(--danger);">*</span>
                                </label>
                                <input type="text" id="followUpResponsable" class="k-input" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;" required placeholder="Nombre del responsable">
                            </div>
                        </div>
                    </form>
                </div>
                <div class="k-modal-footer" style="
                    margin-top: 2rem; 
                    padding-top: 1.5rem; 
                    border-top: 1px solid var(--border); 
                    display: flex; 
                    justify-content: flex-end; 
                    gap: 0.75rem;
                ">
                    <button class="k-btn k-btn-outline" onclick="this.closest('.k-modal').remove()" style="
                        padding: 0.75rem 1.5rem;
                        font-size: 0.95rem;
                        border-radius: 8px;
                    ">
                        <i class="bi bi-x-lg me-1"></i> Cancelar
                    </button>
                    <button class="k-btn k-btn-primary" onclick="window.currentEvaluacionInstance.saveFollowUp(${plan.id})" style="
                        padding: 0.75rem 1.5rem;
                        font-size: 0.95rem;
                        border-radius: 8px;
                    ">
                        <i class="bi bi-check-lg me-1"></i> Guardar Seguimiento
                    </button>
                </div>
            </div>
            
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { 
                        opacity: 0; 
                        transform: translateY(30px); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0); 
                    }
                }
                .k-input {
                    font-family: 'Segoe UI', Roboto, sans-serif;
                    font-size: 0.95rem;
                    color: var(--text-dark);
                    transition: border-color 0.2s;
                }
                .k-input:focus {
                    outline: none;
                    border-color: var(--primary);
                    box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.1);
                }
            </style>
        `;
        
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);
    }
    
    saveFollowUp(planId) {
        const form = document.getElementById('followUpForm');
        if (!form) return;
        
        const descripcion = document.getElementById('followUpDescripcion').value;
        const fecha = document.getElementById('followUpFecha').value;
        const responsable = document.getElementById('followUpResponsable').value;
        
        if (!descripcion || !fecha || !responsable) {
            this.showToast('Por favor complete todos los campos requeridos', 'warning');
            return;
        }
        
        const planIndex = this.actionPlans.findIndex(p => p.id === planId);
        if (planIndex === -1) {
            this.showToast('Plan no encontrado', 'danger');
            return;
        }
        
        const newSeguimiento = {
            id: Date.now(),
            descripcion,
            fecha,
            responsable
        };
        
        this.actionPlans[planIndex].seguimientos.push(newSeguimiento);
        this.showToast('Seguimiento agregado correctamente', 'success');
        
        // Cerrar modal y actualizar vista de detalle
        const modal = document.querySelector('.k-modal');
        if (modal) modal.remove();
        
        // Mostrar el detalle actualizado
        this.showActionPlanDetailModal(planId);
    }
    
    showResponsibleModal(planId) {
        console.log('[EvaluacionInicialSgSst] Abriendo modal de responsables para plan:', planId);
        
        const plan = this.actionPlans.find(p => p.id === planId);
        if (!plan) {
            this.showToast('Plan no encontrado', 'danger');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'k-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: fadeIn 0.3s ease-in-out;
        `;
        
        let modalContent = `
            <div class="k-modal-content" style="
                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                padding: 2.5rem;
                border-radius: 16px;
                width: 90%;
                max-width: 600px;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                animation: slideUp 0.4s ease-out;
            ">
                <div class="k-modal-header" style="margin-bottom: 2rem; text-align: center;">
                    <div style="
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 60px;
                        height: 60px;
                        background: linear-gradient(135deg, var(--info) 0%, #138496 100%);
                        border-radius: 50%;
                        margin-bottom: 1rem;
                        box-shadow: 0 4px 12px rgba(23, 162, 184, 0.3);
                    ">
                        <i class="bi bi-people" style="color: white; font-size: 1.8rem;"></i>
                    </div>
                    <h3 style="margin: 0 0 0.5rem 0; color: var(--text-dark); font-size: 1.5rem; font-weight: 600;">
                        Gestionar Responsables
                    </h3>
                    <p style="margin: 0; color: var(--text-muted); font-size: 0.95rem;">
                        Agregue o elimine responsables del plan de acción
                    </p>
                </div>
                <div class="k-modal-body">
                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-dark);">
                            Nuevo Responsable <span style="color: var(--danger);">*</span>
                        </label>
                        <input type="text" id="newResponsible" class="k-input" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;" required placeholder="Nombre del responsable">
                    </div>
                    <div style="background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border);">
                        <h4 style="margin: 0 0 1rem 0; color: var(--primary); font-size: 1.1rem; font-weight: 600;">
                            <i class="bi bi-people me-2"></i> Responsables Actuales
                        </h4>
                        <div style="margin-top: 1rem;">
                            ${plan.responsables.length > 0 ? plan.responsables.map((r, index) => `
                                <div style="
                                    display: flex;
                                    align-items: center;
                                    justify-content: space-between;
                                    gap: 0.75rem;
                                    padding: 1rem;
                                    background: var(--bg-body);
                                    border-radius: 8px;
                                    margin-bottom: 0.5rem;
                                ">
                                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                                        <i class="bi bi-person-circle" style="color: var(--primary); font-size: 1.2rem;"></i>
                                        <span style="font-weight: 500;">${r}</span>
                                    </div>
                                    <button class="k-btn k-btn-sm k-btn-outline" onclick="window.currentEvaluacionInstance.removeResponsible(${plan.id}, ${index})" style="padding: 0.25rem 0.5rem;">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            `).join('') : '<p style="color: var(--text-muted); font-style: italic;">No hay responsables asignados</p>'}
                        </div>
                    </div>
                </div>
                <div class="k-modal-footer" style="
                    margin-top: 2rem; 
                    padding-top: 1.5rem; 
                    border-top: 1px solid var(--border); 
                    display: flex; 
                    justify-content: flex-end; 
                    gap: 0.75rem;
                ">
                    <button class="k-btn k-btn-outline" onclick="this.closest('.k-modal').remove()" style="
                        padding: 0.75rem 1.5rem;
                        font-size: 0.95rem;
                        border-radius: 8px;
                    ">
                        <i class="bi bi-x-lg me-1"></i> Cancelar
                    </button>
                    <button class="k-btn k-btn-primary" onclick="window.currentEvaluacionInstance.addResponsible(${plan.id})" style="
                        padding: 0.75rem 1.5rem;
                        font-size: 0.95rem;
                        border-radius: 8px;
                    ">
                        <i class="bi bi-plus-lg me-1"></i> Agregar Responsable
                    </button>
                </div>
            </div>
            
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { 
                        opacity: 0; 
                        transform: translateY(30px); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0); 
                    }
                }
                .k-input {
                    font-family: 'Segoe UI', Roboto, sans-serif;
                    font-size: 0.95rem;
                    color: var(--text-dark);
                    transition: border-color 0.2s;
                }
                .k-input:focus {
                    outline: none;
                    border-color: var(--primary);
                    box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.1);
                }
            </style>
        `;
        
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);
    }
    
    addResponsible(planId) {
        const newResponsible = document.getElementById('newResponsible').value;
        if (!newResponsible || newResponsible.trim() === '') {
            this.showToast('Por favor ingrese el nombre del responsable', 'warning');
            return;
        }
        
        const planIndex = this.actionPlans.findIndex(p => p.id === planId);
        if (planIndex === -1) {
            this.showToast('Plan no encontrado', 'danger');
            return;
        }
        
        this.actionPlans[planIndex].responsables.push(newResponsible.trim());
        this.showToast('Responsable agregado correctamente', 'success');
        
        // Cerrar modal y actualizar vista
        const modal = document.querySelector('.k-modal');
        if (modal) modal.remove();
        
        this.showResponsibleModal(planId);
    }
    
    removeResponsible(planId, responsibleIndex) {
        const planIndex = this.actionPlans.findIndex(p => p.id === planId);
        if (planIndex === -1) {
            this.showToast('Plan no encontrado', 'danger');
            return;
        }
        
        this.actionPlans[planIndex].responsables.splice(responsibleIndex, 1);
        this.showToast('Responsable eliminado correctamente', 'success');
        
        // Actualizar vista
        const modal = document.querySelector('.k-modal');
        if (modal) modal.remove();
        
        this.showResponsibleModal(planId);
    }
    
    deleteActionPlan(planId) {
        if (!confirm('¿Está seguro de que desea eliminar este plan de acción?')) {
            return;
        }
        
        const planIndex = this.actionPlans.findIndex(p => p.id === planId);
        if (planIndex === -1) {
            this.showToast('Plan no encontrado', 'danger');
            return;
        }
        
        this.actionPlans.splice(planIndex, 1);
        this.showToast('Plan de acción eliminado correctamente', 'success');
        
        this.renderActionPlansTable();
    }
    
    getEstadoBadge(estado) {
        const badges = {
            'pendiente': '<span class="k-badge k-badge-warning">⏳ Pendiente</span>',
            'en_progreso': '<span class="k-badge k-badge-info">🔄 En Progreso</span>',
            'completado': '<span class="k-badge k-badge-success">✅ Completado</span>',
            'cancelado': '<span class="k-badge k-badge-danger">❌ Cancelado</span>'
        };
        return badges[estado] || badges['pendiente'];
    }
    
    renderActionPlansTable() {
        const tbody = this.actionTableBody;
        console.log('[EvaluacionInicialSgSst] renderActionPlansTable() - actionTableBody:', tbody);
        if (!tbody) {
            console.error('[EvaluacionInicialSgSst] actionTableBody no encontrado');
            return;
        }
        
        if (this.actionPlans.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="k-empty-table">No hay planes activos.</td></tr>';
            return;
        }
        
        console.log('[EvaluacionInicialSgSst] Renderizando', this.actionPlans.length, 'planes de acción');
        tbody.innerHTML = this.actionPlans.map(plan => {
            const hallazgo = this.currentFindings.find(f => f.code === plan.hallazgoId);
            const hallazgoText = hallazgo ? `${hallazgo.code} - ${hallazgo.desc.substring(0, 30)}...` : 'No encontrado';
            
            return `
                <tr>
                    <td>${this.getEstadoBadge(plan.estado)}</td>
                    <td>
                        <div style="font-weight: 500;">${hallazgoText}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                            ${plan.accion.substring(0, 50)}${plan.accion.length > 50 ? '...' : ''}
                        </div>
                    </td>
                    <td>${plan.responsable}</td>
                    <td>${new Date(plan.fechaLimite).toLocaleDateString('es-CO')}</td>
                    <td>
                        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                            <button class="k-btn k-btn-sm k-btn-outline" onclick="window.currentEvaluacionInstance.showActionPlanDetailModal(${plan.id})" title="Ver detalle">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="k-btn k-btn-sm k-btn-outline" onclick="window.currentEvaluacionInstance.showActionPlanModal(${plan.id})" title="Editar">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="k-btn k-btn-sm k-btn-outline" onclick="window.currentEvaluacionInstance.deleteActionPlan(${plan.id})" title="Eliminar" style="color: var(--danger); border-color: var(--danger);">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    /**
     * Procesa los planes de acción extraídos de un informe de ARL
     * @param {Array} arlActionPlans - Planes de acción extraídos del informe ARL
     */
    processArlActionPlans(arlActionPlans) {
        console.log('[EvaluacionInicialSgSst] Procesando', arlActionPlans.length, 'planes de acción de ARL');
        
        // Limpiar planes de acción existentes
        this.actionPlans = [];
        this.actionPlanIdCounter = 1;
        
        // Procesar cada plan de acción del ARL
        arlActionPlans.forEach((arlPlan, index) => {
            // Intentar encontrar un hallazgo relacionado
            let relatedHallazgo = null;
            
            // Buscar por coincidencia en la descripción del hallazgo
            for (const hallazgo of this.currentFindings) {
                if (hallazgo.status === 'no_cumple' && 
                    (hallazgo.desc.toLowerCase().includes(arlPlan.accion.toLowerCase().substring(0, 50)) ||
                     arlPlan.accion.toLowerCase().includes(hallazgo.desc.toLowerCase().substring(0, 50)))) {
                    relatedHallazgo = hallazgo;
                    break;
                }
            }
            
            // Crear el plan de acción
            const actionPlan = {
                id: this.actionPlanIdCounter++,
                hallazgoId: relatedHallazgo ? relatedHallazgo.code : null,
                hallazgoDesc: relatedHallazgo ? relatedHallazgo.desc : '',
                accion: arlPlan.accion,
                responsable: arlPlan.responsable || 'Por asignar',
                fechaLimite: arlPlan.fechaLimite,
                estado: arlPlan.estado || 'pendiente',
                seguimientos: arlPlan.seguimientos || [],
                responsables: arlPlan.responsables || []
            };
            
            this.actionPlans.push(actionPlan);
            console.log('[EvaluacionInicialSgSst] Plan de acción creado:', actionPlan.id, '- Hallazgo:', actionPlan.hallazgoId);
        });
        
        console.log('[EvaluacionInicialSgSst] Total de planes de acción creados:', this.actionPlans.length);
    }
    
    /**
     * Genera automáticamente planes de acción para hallazgos con estado "no_cumple"
     */
    generateActionPlansForNoCumple() {
        console.log('[EvaluacionInicialSgSst] Generando planes de acción para hallazgos no_cumple');
        
        // Limpiar planes de acción existentes
        this.actionPlans = [];
        this.actionPlanIdCounter = 1;
        
        // Filtrar hallazgos con estado "no_cumple"
        const noCumpleFindings = this.currentFindings.filter(f => f.status === 'no_cumple');
        console.log('[EvaluacionInicialSgSst] Hallazgos no_cumple encontrados:', noCumpleFindings.length);
        
        // Generar un plan de acción para cada hallazgo "no_cumple"
        noCumpleFindings.forEach((hallazgo, index) => {
            const actionPlan = {
                id: this.actionPlanIdCounter++,
                hallazgoId: hallazgo.code,
                hallazgoDesc: hallazgo.desc,
                accion: `Implementar acciones correctivas para cumplir con el estándar ${hallazgo.code}`,
                responsable: 'Por asignar',
                fechaLimite: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 días desde hoy
                estado: 'pendiente',
                seguimientos: [],
                responsables: []
            };
            
            this.actionPlans.push(actionPlan);
            console.log('[EvaluacionInicialSgSst] Plan de acción generado:', actionPlan.id, '- Hallazgo:', hallazgo.code);
        });
        
        console.log('[EvaluacionInicialSgSst] Total de planes de acción generados:', this.actionPlans.length);
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
        .k-table tr.k-row-warning { background-color: #fff3cd; border-left: 3px solid var(--warning); }
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