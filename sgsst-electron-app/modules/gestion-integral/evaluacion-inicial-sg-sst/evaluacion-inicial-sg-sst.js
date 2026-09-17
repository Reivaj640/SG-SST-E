(function() {
// evaluacion-inicial-sg-sst.js - Componente para el submódulo "2.3.1 Evaluación inicial del SG-SST"
// Diseño alineado estrictamente con el Sistema de Diseño K+AIR (Tempoactiva/Temposum/Aseplus/Asel)

class EvaluacionInicialSgSst {
    constructor(container, moduleName, submoduleTitle, backToModuleCallback) {
        this.container = container;
        this.moduleName = moduleName;
        this.submoduleTitle = submoduleTitle;
        this.backToModuleCallback = backToModuleCallback;

        // 📦531 — Estado del componente
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

        // Datos de planes de acción — persistidos en SQLite desde 📦531
        this.actionPlans = [];
        this.lastScore = 0;

        // 📦531 — Flag de debug. Poner en true para ver console.logs de flujo.
        // Mantener en false en producción (default).
        this._debug = false;

        // 📦531 — Referencia al ResizeObserver del gauge (para cleanup en destroy)
        this._gaugeResizeObserver = null;

        // 📦531 — Flag para evitar doble-bind de event listeners en re-renders
        this._listenersBound = false;
    }

    _log(level, msg) {
        if (!this._debug && level === 'log') return;
        if (typeof console !== 'undefined' && console[level]) {
            console[level]('[EvaluacionInicialSgSst] ' + msg);
        }
    }

    /**
     * 📦534 — Wrapper fijo para modales adjuntados al body.
     *
     * Por que: position: fixed en el modal-overlay falla en este Electron app
     * porque body { overflow: hidden; height: 100vh } + otros z-index altos
     * (loading-overlay z-index: 10000) hacen que el modal se renderice mal.
     *
     * Solucion: crear un wrapper position:fixed fullscreen UNA sola vez,
     * appendear el modal como position:absolute dentro de el. Asi el modal
     * siempre se posiciona relativo al wrapper (que SI es fixed al viewport).
     */
    _getModalRoot() {
        let root = document.getElementById('k-modal-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'k-modal-root';
            root.style.cssText = [
                'position: fixed',
                'inset: 0',
                'z-index: 99999',
                'pointer-events: none'
            ].join(';') + ';';
            document.body.appendChild(root);
        }
        return root;
    }

    /**
     * 📦534 — Inyecta ::backdrop para los <dialog> de planes de acción.
     * Se llama una sola vez. Regla global porque los <dialog> se mueven
     * al top layer y no se ven afectados por scoping del módulo.
     */
    _ensureDialogBackdropStyle() {
        if (document.getElementById('k-modal-dialog-backdrop-style')) return;
        const style = document.createElement('style');
        style.id = 'k-modal-dialog-backdrop-style';
        style.textContent = `
            dialog.k-modal[open]::backdrop {
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(2px);
            }
        `;
        document.head.appendChild(style);
    }


    async render() {
        // Registrar instancia global para manejo de eventos DOM
        window.currentEvaluacionInstance = this;

        // Limpiar contenedor y establecer clase base del sistema K+AIR
        this.container.innerHTML = '';
        this.container.className = ''; // Limpiar clases previas
        this.container.classList.add('k-module-container'); // Clase contenedora estándar

        // 📦532 — El sistema de notificaciones ahora es window.KAIRToast
        // (assets/js/kair-toast.js), el estandar del proyecto. KAIRToast
        // gestiona su propio hub #notification-hub internamente, asi que
        // no necesitamos un nodo toast propio en el container.

        const mainLayout = document.createElement('div');
        mainLayout.className = 'k-module-layout ev-inicial-sgsst';

        mainLayout.innerHTML = `
            <!-- 1. HEADER — Card k-section-card (tabs integrados) -->
            <div class="k-section-card" style="padding:0; margin-bottom:1.5rem; flex-shrink:0; flex-grow:0;">
              <!-- Fila 1: contenido principal -->
              <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1.25rem 1.5rem;">
                <div style="display:flex; align-items:center; gap:0.75rem;">
                  <i class="bi bi-clipboard-pulse" style="color:#174ea6; font-size:1.25rem;"></i>
                  <div>
                    <h3 style="font-size:1.125rem; font-weight:600; margin:0; color:#1E293B;">Evaluación Inicial del SG-SST</h3>
                    <p style="font-size:0.8125rem; color:#64748B; margin:0.25rem 0 0 0;">Evaluación del cumplimiento normativo SG-SST.</p>
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
                  <!-- 📦533 — Selector simplificado: 2 botones directos.
                       Antes habia un <select> + un boton "Cambiar Archivo" (4 pasos:
                       cambiar dropdown + click + seleccionar PDF + procesar). Ahora
                       2 pasos: click en el boton del source + seleccionar PDF. -->
                  <button class="header-action--outline" id="btn-load-ministerio" onclick="window.currentEvaluacionInstance.loadPdfBySource('ministerio')" title="Cargar PDF del Ministerio de Trabajo">
                    <i class="kair-icon-building"></i> Cargar Ministerio
                  </button>
                  <button class="header-action--outline" id="btn-load-arl" onclick="window.currentEvaluacionInstance.loadPdfBySource('arl')" title="Cargar PDF del informe de la ARL">
                    <i class="bi bi-shield-check"></i> Cargar ARL
                  </button>
                  <button class="header-action--outline" id="btn-change-pdf" onclick="window.currentEvaluacionInstance.showPdfSelectorModal()" title="Buscar un PDF en la carpeta (auto-detecta el source)" style="display:none;">
                    <i class="bi bi-folder2-open"></i> Explorar
                  </button>
                  <div id="loading-indicator" class="k-loading-badge" style="display:none;">
                    <span class="spinner-border spinner-border-sm"></span> Procesando...
                  </div>
                  <div style="width:1px; height:24px; background:#dee2e6;"></div>
                  <button class="header-back-btn" id="btn-back-eval" title="Volver al panel principal">
                    <i class="bi bi-arrow-left"></i> Volver
                  </button>
                </div>
              </div>

              <!-- Fila 2: tabs (dentro del card) -->
              <div class="evaluacion-tabs">
                <button class="evaluacion-tab active" data-tab="dashboard" onclick="window.currentEvaluacionInstance.switchTab('dashboard')">
                  <i class="bi bi-speedometer2"></i> Dashboard
                </button>
                <button class="evaluacion-tab" data-tab="hallazgos" onclick="window.currentEvaluacionInstance.switchTab('hallazgos')">
                  <i class="bi bi-list-check"></i> Hallazgos
                </button>
                <button class="evaluacion-tab" data-tab="actions" onclick="window.currentEvaluacionInstance.switchTab('actions')">
                  <i class="bi bi-clipboard-check"></i> Planes de Acción
                </button>
              </div>
            </div>

            <!-- 3. CONTENIDO SCROLLABLE -->
            <div class="k-module-content">

                <!-- VISTA: DASHBOARD -->
                <section id="view-dashboard" class="k-view active">

<!-- Franja de estadísticas compacta -->
<div class="k-stats-ribbon">
<div class="k-stats-ribbon__item">
<span class="k-stats-ribbon__icon primary"><i class="bi bi-pie-chart-fill"></i></span>
<div class="k-stats-ribbon__data">
<span class="k-stats-ribbon__value" id="kpi-score">0%</span>
<span class="k-stats-ribbon__label">Cumplimiento</span>
</div>
<span class="k-stats-ribbon__pct" id="kpi-score-pct">0%</span>
</div>
<div class="k-stats-ribbon__divider"></div>
<div class="k-stats-ribbon__item">
<span class="k-stats-ribbon__icon danger"><i class="bi bi-exclamation-triangle-fill"></i></span>
<div class="k-stats-ribbon__data">
<span class="k-stats-ribbon__value" id="kpi-gaps">0</span>
<span class="k-stats-ribbon__label">Hallazgos Críticos</span>
</div>
</div>
<div class="k-stats-ribbon__divider"></div>
<div class="k-stats-ribbon__item">
<span class="k-stats-ribbon__icon warning"><i class="bi bi-hourglass-split"></i></span>
<div class="k-stats-ribbon__data">
<span class="k-stats-ribbon__value" id="kpi-pending">0</span>
<span class="k-stats-ribbon__label">Planes Pendientes</span>
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
                        <div class="k-card-body">
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
                    </div>
                </section>

                <!-- VISTA: HALLAZGOS -->
                <section id="view-hallazgos" class="k-view">
                    <div class="k-card">
                        <div class="k-card-header">
                            <h3>Detalle de Estándares</h3>
                            <input type="text" class="k-input-search" placeholder="Buscar estándar...">
                        </div>
                        <div class="k-table-responsive k-table-scrollable">
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
                        <div class="k-table-responsive k-table-scrollable">
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

            </div>
        `;

        // 📦531 — El toast ahora es externo (creado por _ensureToastNode) y
        // sobrevive re-renders. Ya no se incluye en el template.
        this.container.appendChild(mainLayout);

        // Inicializar referencias y datos
        this.updateReferences();
        await this.initializeData();
    }

    updateReferences() {
        // 📦531 — DOM scope: usar this.container.querySelector en vez de
        // getElementById global. Evita colisiones si hay otros componentes
        // en la página con IDs similares.
        this.hallazgosTableBody = this.container.querySelector('#hallazgosTableBody');
        this.actionTableBody = this.container.querySelector('#actionTableBody');

        // 📦531 — Listeners con cleanup. Guardamos referencias para removerlas
        // en destroy() si el usuario re-renderiza el módulo.
        // (Por ahora los listeners se recrean en cada render — el DOM viejo
        // se va con innerHTML='', pero mantenemos el patrón por seguridad.)
        this._backHandler = this.backToModuleCallback;
        this._viewPdfHandler = () => {
            if (this.currentPdfPath) window.electronAPI.openPath(this.currentPdfPath);
        };

        const backBtn = this.container.querySelector('#btn-back-eval');
        if (backBtn && this._backHandler) {
            backBtn.addEventListener('click', this._backHandler);
        }

        const btnPdf = this.container.querySelector('#btn-view-pdf');
        if (btnPdf) {
            btnPdf.addEventListener('click', this._viewPdfHandler);
        }
    }

    // --- LÓGICA DE NAVEGACIÓN (TABS) ---
    switchTab(tabId) {
        this._log('log', 'switchTab() - Cambiando a pestaña: ' + tabId);

        // 1. Actualizar botones de navegación
        const navItems = this.container.querySelectorAll('.evaluacion-tab');
        navItems.forEach(btn => {
            if (btn.dataset.tab === tabId) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // 2. Mostrar la sección correspondiente.
        // 📦531 — Quitamos el style.display inline redundante. El CSS ya
        // hace esto con .k-view { display: none } y .k-view.active.
        const views = this.container.querySelectorAll('.k-view');
        views.forEach(view => view.classList.remove('active'));

        const activeView = this.container.querySelector(`#view-${tabId}`);
        if (activeView) {
            activeView.classList.add('active');

            // Redibujar gráficos si se entra al dashboard para asegurar renderizado correcto
            if (tabId === 'dashboard' && this.currentFindings.length > 0) {
                // Pequeño delay para que el canvas tenga dimensiones
                setTimeout(() => this.updateDashboardWithRealData({ cumplimiento: this.lastScore || 0 }), 50);
            }
        } else {
            this._log('error', 'switchTab() - Vista no encontrada: #' + 'view-' + tabId);
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

            // 📦531 — Cargar planes de acción persistidos del año actual.
            // Esto resuelve el bug crítico donde los planes se perdían al
            // cerrar el módulo. Si los planes en memoria (this.actionPlans)
            // ya tienen contenido, se respeta (no se pisan cambios no guardados).
            await this._loadPersistedActionPlans();
        } catch (error) {
            console.error('Init Error:', error);
            this.showToast('Error inicializando sistema de archivos.', 'danger');
        }
    }

    // 📦531/533 — Carga los planes persistidos de la BD para la empresa+año
    // actuales, FILTRADOS por source (ministerio/arl) para no mezclar
    // planes de informes diferentes. Si ya hay planes en memoria con el
    // mismo source, hace merge (los de memoria tienen precedencia).
    async _loadPersistedActionPlans(sourceFilter) {
        try {
            if (!window.electronAPI || !window.electronAPI.evaluacionActionPlans) {
                this._log('warn', 'evaluacionActionPlans API no disponible');
                return;
            }
            const empresaId = window.currentCompany;
            if (!empresaId || empresaId === 'default_company') {
                this._log('warn', 'No hay empresa activa para cargar planes');
                return;
            }
            const res = await window.electronAPI.evaluacionActionPlans.listar({
                empresaId: empresaId,
                year: this.currentYear
            });
            if (!res || !res.success) {
                this._log('error', 'Error listando planes persistidos: ' + (res && res.error && res.error.message));
                return;
            }
            const persisted = res.data || [];
            // 📦533 — Filtrar por source: si el usuario esta cargando un
            // PDF del Ministerio, NO mostrar planes persistidos de ARL
            // (y viceversa). Asi cada vista muestra SOLO lo del informe
            // seleccionado.
            const filtered = sourceFilter
                ? persisted.filter(function (p) { return (p._source || 'manual') === sourceFilter || (p._source || 'manual') === 'manual'; })
                : persisted;
            this._log('log', 'Cargados ' + filtered.length + ' planes persistidos de ' + empresaId + '/' + this.currentYear + ' (filtrados por source=' + (sourceFilter || 'all') + ', total BD=' + persisted.length + ')');
            // Merge: planes en memoria tienen precedencia. Solo agregamos los
            // que no estan en memoria (por id).
            const inMemoryIds = new Set(this.actionPlans.map(function (p) { return p.id; }));
            for (let i = 0; i < filtered.length; i++) {
                const p = filtered[i];
                if (!inMemoryIds.has(p.id)) {
                    this.actionPlans.push(p);
                }
            }
        } catch (e) {
            this._log('error', 'Excepcion cargando planes persistidos: ' + e.message);
        }
    }

    // 📦531 — Persiste un plan en la BD. Si la operacion falla, no
    // afecta el estado en memoria (el usuario ve el plan igual; la
    // persistencia se reintenta en el proximo save).
    async _persistActionPlan(plan) {
        try {
            if (!window.electronAPI || !window.electronAPI.evaluacionActionPlans) return;
            const empresaId = window.currentCompany;
            if (!empresaId || empresaId === 'default_company') {
                this._log('warn', 'No hay empresa activa para guardar plan');
                return;
            }
            const res = await window.electronAPI.evaluacionActionPlans.guardar({
                empresaId: empresaId,
                year: this.currentYear,
                source: this.currentSource,
                plan: plan
            });
            if (!res || !res.success) {
                this._log('error', 'Error persistiendo plan: ' + (res && res.error && res.error.message));
                this.showToast('No se pudo guardar el plan en disco (sigue en memoria)', 'warning');
            } else {
                this._log('log', 'Plan ' + plan.id + ' guardado OK');
            }
        } catch (e) {
            this._log('error', 'Excepcion persistiendo plan: ' + e.message);
        }
    }

    async loadRealFiles(forceShowModal = false) {
        try {
            console.log('[EvaluacionInicialSgSst] Cargando archivos desde:', this.submodulePath);
            console.log('[EvaluacionInicialSgSst] forceShowModal:', forceShowModal);
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

            // Filtrar solo archivos PDF
            const pdfFiles = allFiles.filter(f => f.name.toLowerCase().endsWith('.pdf'));
            console.log('[EvaluacionInicialSgSst] Archivos PDF encontrados:', pdfFiles.length);
            console.log('[EvaluacionInicialSgSst] Lista de PDFs:', pdfFiles.map(f => f.name));

            // Si hay múltiples PDFs, mostrar selector
            if (pdfFiles.length > 1) {
                console.log('[EvaluacionInicialSgSst] Mostrando selector de PDFs');
                if (forceShowModal) {
                    // Forzar mostrar el modal incluso si ya hay uno cerrado
                    this.showPdfSelectorModalWithFiles(pdfFiles);
                } else {
                    this.showPdfSelector(pdfFiles);
                }
            } else if (pdfFiles.length === 1) {
                // Si solo hay uno, procesarlo directamente
                this._log('log', 'Procesando único PDF encontrado');
                const reportPdf = pdfFiles[0];
                this.currentPdfPath = reportPdf.path;
                // 📦531 — Scoping al container del módulo
                const titleEl = this.container.querySelector('#source-title');
                const metaEl = this.container.querySelector('#source-meta');
                const btnView = this.container.querySelector('#btn-view-pdf');

                if (titleEl) titleEl.textContent = reportPdf.name;
                if (metaEl) metaEl.textContent = 'Archivo detectado en: ...' + (reportPdf.path ? reportPdf.path.slice(-30) : '');
                if (btnView) btnView.style.display = 'inline-flex';

                // Si se forzó el modal pero solo hay 1 PDF, mostrar mensaje y procesar
                if (forceShowModal) {
                    this.showToast('Solo hay 1 PDF disponible. Procesando...', 'info');
                }
                await this.processPdfData(reportPdf.path);
            } else {
                this._log('warn', 'No se encontraron archivos PDF');
                // 📦531 — Scoping
                const titleEl2 = this.container.querySelector('#source-title');
                const metaEl2 = this.container.querySelector('#source-meta');
                if (titleEl2) titleEl2.textContent = 'No se encontró informe estándar';
                if (metaEl2) metaEl2.textContent = 'Por favor cargue un archivo PDF de evaluación (0312).';

                if (forceShowModal) {
                    this.showToast('No se encontraron archivos PDF en la carpeta.', 'warning');
                }
            }

        } catch (e) {
            console.error('[EvaluacionInicialSgSst] Error en loadRealFiles:', e);
            this.showToast('Error accediendo a los archivos.', 'warning');
        }
    }

    showPdfSelector(pdfFiles) {
        this._log('log', 'showPdfSelector() - Iniciando con ' + pdfFiles.length + ' PDFs');

        // 📦534 — Limpieza defensiva: eliminar cualquier modal PDF selector
        // existente antes de crear uno nuevo. Evita que se acumulen modales
        // apilados (causa "se coloca más negro" + no poder cerrar).
        document.querySelectorAll('.k-file-selector-modal').forEach(m => m.remove());

        // Crear un modal estilo Copasst para seleccionar el PDF
        const modal = document.createElement('div');
        modal.className = 'k-file-selector-modal';
        // 📦534 — Pointer-events: el wrapper #k-modal-root tiene
        // pointer-events:none para no bloquear el fondo. Esto se hereda
        // a los hijos. Restauramos auto en el modal (y todos sus hijos)
        // para que los clicks funcionen. Sin esto, el modal se ve pero
        // no se puede clickear.
        modal.style.cssText = 'pointer-events: auto !important;';

        // Agrupar PDFs por tipo
        const ministerioPdfs = pdfFiles.filter(f => f.path.toLowerCase().includes('ministerio'));
        const arlPdfs = pdfFiles.filter(f => f.path.toLowerCase().includes('arl'));
        const otherPdfs = pdfFiles.filter(f =>
            !f.path.toLowerCase().includes('ministerio') &&
            !f.path.toLowerCase().includes('arl')
        );

        // 📦531 — Sin inline onclick. Usamos data-* attributes + event
        // delegation abajo. Tambien: el conteo por carpeta va en data-count
        // para que el JS lo actualice sin re-renderizar el HTML (evita XSS).
        let otherItem = '';
        if (otherPdfs.length > 0) {
            otherItem = `
                <div class="k-file-item" data-folder="otros">
                    <div class="k-file-item-icon folder">
                        <i class="fas fa-folder"></i>
                    </div>
                    <div class="k-file-item-info">
                        <div class="k-file-item-name">Otros Archivos</div>
                        <div class="k-file-item-meta">
                            <span class="k-file-badge" data-folder-count="otros">${otherPdfs.length}</span>
                        </div>
                    </div>
                </div>`;
        }

        let modalContent = `
            <div class="k-file-selector-content">
                <div class="k-file-selector-header">
                    <div class="k-file-selector-title">
                        <i class="bi bi-file-earmark-pdf-fill" style="color: var(--primary);"></i>
                        Seleccionar PDF de Evaluación
                    </div>
                    <div>
                        <button class="btn btn-ghost" data-modal-close>
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="k-file-selector-body">
                    <div class="k-file-selector-sidebar">
                        <div class="k-file-breadcrumb" data-folder-breadcrumb>
                            <span class="k-file-breadcrumb-current">Raíz</span>
                        </div>
                        <div class="k-file-section-header">
                            Carpetas
                        </div>
                        <div class="k-file-section-content">
                            <div class="k-file-item" data-folder="ministerio">
                                <div class="k-file-item-icon folder">
                                    <i class="fas fa-folder"></i>
                                </div>
                                <div class="k-file-item-info">
                                    <div class="k-file-item-name">Ministerio de Trabajo</div>
                                    <div class="k-file-item-meta">
                                        <span class="k-file-badge" data-folder-count="ministerio">${ministerioPdfs.length}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="k-file-item" data-folder="arl">
                                <div class="k-file-item-icon folder">
                                    <i class="fas fa-shield-alt"></i>
                                </div>
                                <div class="k-file-item-info">
                                    <div class="k-file-item-name">Informe ARL</div>
                                    <div class="k-file-item-meta">
                                        <span class="k-file-badge" data-folder-count="arl">${arlPdfs.length}</span>
                                    </div>
                                </div>
                            </div>
                            ${otherItem}
                        </div>
                    </div>
                    <div class="k-file-selector-main">
                        <div class="k-file-go-back" data-go-back style="display: none;">
                            <i class="fas fa-level-up-alt" style="margin-right: 8px; transform: rotate(90deg);"></i>
                            Volver a carpetas
                        </div>
                        <div class="k-file-section-header">
                            Documentos
                        </div>
                        <div class="k-file-section-content" data-pdf-list>
                            <div class="k-file-empty-state">
                                <div class="k-file-empty-icon">
                                    <i class="fas fa-folder-open"></i>
                                </div>
                                <div class="k-file-empty-title">Seleccione una carpeta</div>
                                <div class="k-file-empty-desc">Haga clic en una carpeta del panel izquierdo para ver los archivos PDF disponibles.</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="k-file-selector-footer">
                    <button class="btn btn-ghost" data-modal-close>
                        Cancelar
                    </button>
                </div>
            </div>
        `;

        modal.innerHTML = modalContent;
        this._getModalRoot().appendChild(modal);

        // Guardar referencia a los PDFs para usar en navigateToFolder
        this.pdfFilesCache = {
            ministerio: ministerioPdfs,
            arl: arlPdfs,
            otros: otherPdfs
        };

        // Inicializar estado de navegación
        this.currentFolder = null;

        // 📦531 — Event delegation (reemplaza los inline onclick que eran
        // vulnerables a XSS). Un solo listener en el modal maneja TODOS
        // los clicks. Lee data-* attributes para saber qué hacer.
        modal.addEventListener('click', (e) => {
            const t = e.target;
            // Click en el backdrop (no en contenido) cierra
            if (t === modal) {
                modal.remove();
                return;
            }
            // Click en botón de cerrar
            if (t.closest('[data-modal-close]')) {
                modal.remove();
                return;
            }
            // Click en una carpeta
            const folderItem = t.closest('[data-folder]');
            if (folderItem) {
                this.navigateToFolder(folderItem.dataset.folder);
                return;
            }
            // Click en "volver a carpetas"
            if (t.closest('[data-go-back]')) {
                this.goBackToRoot();
                return;
            }
            // Click en un PDF (item con data-pdf-path)
            const pdfItem = t.closest('[data-pdf-path]');
            if (pdfItem) {
                this.selectPdf(pdfItem.dataset.pdfPath, pdfItem.dataset.pdfName);
                return;
            }
        });
    }

    navigateToFolder(type) {
        const pdfs = (this.pdfFilesCache && this.pdfFilesCache[type]) || [];
        // 📦531 — Scoping: usar el modal actual como root en vez de
        // getElementById global. Esto permite multiples instancias del modal
        // y evita colisiones con otros componentes.
        const modal = this.container.ownerDocument.querySelector('.k-file-selector-modal') ||
                      document.querySelector('.k-file-selector-modal');
        if (!modal) return;
        const fileList = modal.querySelector('[data-pdf-list]');
        const breadcrumb = modal.querySelector('[data-folder-breadcrumb]');
        const goBackBtn = modal.querySelector('[data-go-back]');

        // Actualizar estado de navegación
        this.currentFolder = type;

        // Mostrar botón de volver
        if (goBackBtn) goBackBtn.style.display = 'flex';

        // Actualizar breadcrumb (con textContent para evitar XSS)
        const folderNames = {
            ministerio: 'Ministerio de Trabajo',
            arl: 'Informe ARL',
            otros: 'Otros Archivos'
        };
        if (breadcrumb) {
            breadcrumb.innerHTML = '';
            const root = document.createElement('span');
            root.className = 'k-file-breadcrumb-item';
            root.textContent = 'Raíz';
            root.addEventListener('click', () => this.goBackToRoot());
            const sep = document.createElement('span');
            sep.className = 'k-file-breadcrumb-separator';
            sep.innerHTML = '<i class="fas fa-chevron-right"></i>';
            const current = document.createElement('span');
            current.className = 'k-file-breadcrumb-current';
            current.textContent = folderNames[type] || type;
            breadcrumb.appendChild(root);
            breadcrumb.appendChild(sep);
            breadcrumb.appendChild(current);
        }

        if (pdfs.length === 0) {
            if (fileList) {
                fileList.innerHTML = `
                    <div class="k-file-empty-state">
                        <div class="k-file-empty-icon">
                            <i class="fas fa-file-pdf"></i>
                        </div>
                        <div class="k-file-empty-title">No hay archivos</div>
                        <div class="k-file-empty-desc">No se encontraron archivos PDF en esta carpeta.</div>
                    </div>`;
            }
            return;
        }

        // 📦531 — Construir items con textContent (no template literals con
        // data del filesystem). El nombre del PDF y su path van a data-*
        // attributes que el event delegation lee. Esto elimina el XSS
        // completamente (un nombre con ' o < no rompe nada).
        if (fileList) {
            fileList.innerHTML = '';
            const frag = document.createDocumentFragment();
            for (let i = 0; i < pdfs.length; i++) {
                const pdf = pdfs[i];
                const item = document.createElement('div');
                item.className = 'k-file-item';
                item.setAttribute('data-pdf-path', pdf.path);
                item.setAttribute('data-pdf-name', pdf.name);
                item.innerHTML = `
                    <div class="k-file-item-icon pdf">
                        <i class="fas fa-file-pdf"></i>
                    </div>
                    <div class="k-file-item-info">
                        <div class="k-file-item-name"></div>
                        <div class="k-file-item-meta">
                            <span class="k-file-badge"></span>
                        </div>
                    </div>`;
                // textContent para evitar inyeccion
                item.querySelector('.k-file-item-name').textContent = pdf.name;
                item.querySelector('.k-file-badge').textContent = Math.round((pdf.size || 0) / 1024) + ' KB';
                frag.appendChild(item);
            }
            fileList.appendChild(frag);
        }
    }

    goBackToRoot() {
        const modal = this.container.ownerDocument.querySelector('.k-file-selector-modal') ||
                      document.querySelector('.k-file-selector-modal');
        if (!modal) return;
        const fileList = modal.querySelector('[data-pdf-list]');
        const breadcrumb = modal.querySelector('[data-folder-breadcrumb]');
        const goBackBtn = modal.querySelector('[data-go-back]');

        // Resetear estado de navegación
        this.currentFolder = null;

        // Ocultar botón de volver
        if (goBackBtn) goBackBtn.style.display = 'none';

        // Resetear breadcrumb
        if (breadcrumb) {
            breadcrumb.innerHTML = '';
            const current = document.createElement('span');
            current.className = 'k-file-breadcrumb-current';
            current.textContent = 'Raíz';
            breadcrumb.appendChild(current);
        }

        // Mostrar estado inicial
        if (fileList) {
            fileList.innerHTML = `
                <div class="k-file-empty-state">
                    <div class="k-file-empty-icon">
                        <i class="fas fa-folder-open"></i>
                    </div>
                    <div class="k-file-empty-title">Seleccione una carpeta</div>
                    <div class="k-file-empty-desc">Haga clic en una carpeta del panel izquierdo para ver los archivos PDF disponibles.</div>
                </div>`;
        }
    }

    selectPdf(pdfPath, pdfName) {
        // Cerrar el modal de selección de archivos
        const modal = this.container.ownerDocument.querySelector('.k-file-selector-modal');
        if (modal) modal.remove();

        // Actualizar la UI con el archivo seleccionado
        this.currentPdfPath = pdfPath;
        // 📦531 — Scoping al container del módulo
        const titleEl = this.container.querySelector('#source-title');
        const metaEl = this.container.querySelector('#source-meta');
        const btnView = this.container.querySelector('#btn-view-pdf');

        if (titleEl) titleEl.textContent = pdfName;
        if (metaEl) metaEl.textContent = 'Archivo seleccionado: ...' + (pdfPath ? pdfPath.slice(-30) : '');
        if (btnView) btnView.style.display = 'inline-flex';

        // Procesar el PDF seleccionado
        this.processPdfData(pdfPath);
    }

    // 📦531 — Valida que el resultado del backend tenga la estructura
    // mínima esperada. Si no, loguea y devuelve false (el caller maneja).
    _validateProcessResult(result) {
        if (!result || typeof result !== 'object') return false;
        if (result.success !== true) return false;
        if (result.findings !== undefined && !Array.isArray(result.findings)) {
            this._log('error', 'result.findings no es array');
            return false;
        }
        if (result.metrics !== undefined && (typeof result.metrics !== 'object' || result.metrics === null)) {
            this._log('error', 'result.metrics no es objeto');
            return false;
        }
        return true;
    }

    async processPdfData(pdfPath) {
        const loading = this.container.querySelector('#loading-indicator');
        if (loading) loading.style.display = 'inline-flex';

        try {
            this._log('log', 'Iniciando procesamiento de PDF: ' + pdfPath);
            const sourceType = pdfPath.toLowerCase().includes('arl') ? 'arl' : 'ministerio';
            this._log('log', 'Tipo de fuente detectado: ' + sourceType);

            // 📦533 — Reset COMPLETO del estado del PDF anterior antes de
            // procesar el nuevo. Antes los hallazgos y planes del PDF
            // anterior persistian en memoria, lo que causaba que al
            // cambiar de Ministerio a ARL (o viceversa) se mostraran
            // mezclados. Ahora cada PDF muestra SOLO sus hallazgos y planes.
            this.currentSource = sourceType;
            this.currentPdfPath = pdfPath;
            this.currentFindings = [];
            this.actionPlans = [];
            this._log('log', 'Estado reseteado para source=' + sourceType);

            if (window.electronAPI && window.electronAPI.processEvaluacionPdf) {
                const result = await window.electronAPI.processEvaluacionPdf(pdfPath, sourceType);

                // 📦531 — Validar estructura del resultado antes de usarlo
                if (!this._validateProcessResult(result)) {
                    this._log('error', 'Resultado del backend invalido: ' + JSON.stringify(result).slice(0, 200));
                    this.showToast('El backend devolvió datos con formato inesperado.', 'danger');
                    return;
                }

                this._log('log', 'PDF procesado OK. Hallazgos=' + (result.findings ? result.findings.length : 0));
                this.currentFindings = result.findings || [];
                this.renderHallazgosTable();
                this.updateDashboardWithRealData(result.metrics);

                // Cargar planes persistidos de BD filtrados por source + year
                // (best-effort: si falla, seguimos con los que estan en memoria)
                await this._loadPersistedActionPlans(sourceType);

                // Procesar planes de acción según el tipo de fuente
                if (result.source === 'arl' && result.actionPlans && result.actionPlans.length > 0) {
                    this._log('log', 'Procesando planes de acción de ARL');
                    this.processArlActionPlans(result.actionPlans);
                } else if (result.source === 'ministerio') {
                    this._log('log', 'Generando planes de acción para hallazgos no_cumple');
                    this.generateActionPlansForNoCumple();
                }

                this.renderActionPlansTable();

                // Cambiar a la pestaña de Planes de Acción para mostrar la tabla
                this.switchTab('actions');

                this.showToast('Datos procesados correctamente.', 'success');
            } else {
                this._log('error', 'electronAPI o processEvaluacionPdf no disponible');
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
const pendingCount = this.actionPlans.filter(p => p.estado !== 'completado').length;

this.lastScore = score;

        const scoreEl = this.container.querySelector('#kpi-score');
        const scorePctEl = this.container.querySelector('#kpi-score-pct');
        const gapsEl = this.container.querySelector('#kpi-gaps');
        const pendingEl = this.container.querySelector('#kpi-pending');
        const chartLabel = this.container.querySelector('#chart-score-label');

        if (scoreEl) scoreEl.textContent = score + '%';
        if (scorePctEl) scorePctEl.textContent = score + '%';
        if (chartLabel) chartLabel.textContent = score + '%';
        if (gapsEl) gapsEl.textContent = noCumplidos;
        if (pendingEl) pendingEl.textContent = pendingCount;

        // Actualizar Gráficos
        this.drawGauge(score);
        // 📦531 — Setup del observer para resize (solo la primera vez)
        this._setupGaugeResizeObserver();

        // 📦531 — PHVA: si el backend trae datos reales por fase
        // (metrics.phva = {planear, hacer, verificar, actuar}), los usamos.
        // Si no, mostramos empty state. Ya no fabricamos datos falsos.
        const phvaContainer = this.container.querySelector('#phva-chart-container');
        if (phvaContainer) {
            const phva = metrics.phva;
            if (phva && typeof phva === 'object'
                && phva.planear !== undefined
                && phva.hacer !== undefined
                && phva.verificar !== undefined
                && phva.actuar !== undefined) {
                phvaContainer.innerHTML = `
                    <div class="k-progress-group">
                        <div class="k-progress-label"><span>PLANEAR</span><span>${Math.min(phva.planear, 100)}%</span></div>
                        <div class="k-progress-bar"><div class="k-progress-fill" style="width:${Math.min(phva.planear, 100)}%; background:var(--primary);"></div></div>
                    </div>
                    <div class="k-progress-group">
                        <div class="k-progress-label"><span>HACER</span><span>${Math.min(phva.hacer, 100)}%</span></div>
                        <div class="k-progress-bar"><div class="k-progress-fill" style="width:${Math.min(phva.hacer, 100)}%; background:var(--success);"></div></div>
                    </div>
                    <div class="k-progress-group">
                        <div class="k-progress-label"><span>VERIFICAR</span><span>${Math.min(phva.verificar, 100)}%</span></div>
                        <div class="k-progress-bar"><div class="k-progress-fill" style="width:${Math.min(phva.verificar, 100)}%; background:var(--info);"></div></div>
                    </div>
                    <div class="k-progress-group">
                        <div class="k-progress-label"><span>ACTUAR</span><span>${Math.min(phva.actuar, 100)}%</span></div>
                        <div class="k-progress-bar"><div class="k-progress-fill" style="width:${Math.min(phva.actuar, 100)}%; background:var(--warning);"></div></div>
                    </div>
                `;
            } else {
                phvaContainer.innerHTML = '<div class="k-empty-state-small">Sin datos PHVA en el PDF</div>';
            }
        }
    }

    /**
     * 📦533 — Selector simplificado. En vez del viejo flujo
     * (cambiar dropdown + click "Cambiar Archivo" + seleccionar PDF),
     * el usuario hace click directo en "Cargar Ministerio" o "Cargar ARL"
     * y se abre el file picker (que el SO suele recordar la ultima carpeta).
     * Si hay varios PDFs en la subcarpeta, se muestra el modal de
     * seleccion. Si hay solo uno, se procesa directamente.
     */
    loadPdfBySource(source) {
        this._log('log', 'loadPdfBySource(' + source + ')');
        this.currentSource = source;
        this.loadRealFiles(true);
    }

    // Mantener updateSource como wrapper retrocompatible (por si algo
    // todavia llama el viejo handler del <select>), pero ya no se usa
    // desde el template.
    updateSource() {
        this._log('warn', 'updateSource() llamado pero ya no se usa (selector simplificado)');
    }
    
    showPdfSelectorModal() {
        console.log('[EvaluacionInicialSgSst] Abriendo modal de selección de PDFs (forzando)');

        // 📦534 — Cerrar TODOS los modales PDF selector existentes antes de
        // crear uno nuevo. Evita que se acumulen si loadRealFiles se llama
        // varias veces en un loop o re-render.
        document.querySelectorAll('.k-file-selector-modal').forEach(m => m.remove());

        // Cargar archivos y forzar mostrar el modal
        this.loadRealFiles(true);
    }

    showPdfSelectorModalWithFiles(pdfFiles) {
        console.log('[EvaluacionInicialSgSst] Mostrando modal con', pdfFiles.length, 'PDFs');
        this.showPdfSelector(pdfFiles);
    }
    
    // --- FUNCIONES PARA PLANES DE ACCIÓN ---
    
    showActionPlanModal(planId = null) {
        console.log('[EvaluacionInicialSgSst] Abriendo modal de plan de acción:', planId);
        
        const isEdit = planId !== null;
        const plan = isEdit ? this.actionPlans.find(p => p.id === planId) : null;
        
        const modal = document.createElement('dialog');
        modal.className = 'k-modal';
        // 📦534 — HTML5 <dialog> con showModal(): el navegador centra
        // automaticamente y da ::backdrop nativo. Sin position:fixed,
        // sin wrapper, sin stacking context. Los close buttons
        // (this.closest('.k-modal').remove()) siguen funcionando
        // porque removemos el dialog del DOM.
        modal.style.cssText = `
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            margin: auto !important;
            max-width: 95vw !important;
            max-height: 95vh !important;
            overflow: visible !important;
            color: inherit !important;
            animation: ei-fadeIn 0.3s ease-in-out;
        `;

        const hallazgosOptions = this.currentFindings.map(f => 
            `<option value="${f.code}">${f.code} - ${f.desc.substring(0, 50)}...</option>`
        ).join('');
        
        let modalContent = `
            <div class="k-modal-content">
                <div class="k-modal-header text-center">
                    <div class="k-modal-icon">
                        <i class="bi bi-clipboard-check"></i>
                    </div>
                    <h3>${isEdit ? 'Editar Plan de Acción' : 'Nuevo Plan de Acción'}</h3>
                    <p class="k-modal-subtitle">${isEdit ? 'Modifique los datos del plan de acción existente' : 'Complete el formulario para crear un nuevo plan de acción'}</p>
                </div>
                <div class="k-modal-body">
                    <form id="actionPlanForm">
                        <div class="k-form-row">
                            <div class="k-form-group">
                                <label class="k-form-label">Hallazgo Asociado <span class="text-danger">*</span></label>
                                <select id="planHallazgo" class="k-form-control" required>
                                    <option value="">Seleccione un hallazgo...</option>
                                    ${hallazgosOptions}
                                </select>
                            </div>
                            <div class="k-form-group">
                                <label class="k-form-label">Estado <span class="text-danger">*</span></label>
                                <select id="planEstado" class="k-form-control" required>
                                    <option value="pendiente">⏳ Pendiente</option>
                                    <option value="en_progreso">🔄 En Progreso</option>
                                    <option value="completado">✅ Completado</option>
                                    <option value="cancelado">❌ Cancelado</option>
                                </select>
                            </div>
                        </div>
                        <div class="k-form-group">
                            <label class="k-form-label">Acción Correctiva <span class="text-danger">*</span></label>
                            <textarea id="planAccion" class="k-form-control" rows="4" required placeholder="Describa la acción correctiva a implementar..."></textarea>
                        </div>
                        <div class="k-form-row">
                            <div class="k-form-group">
                                <label class="k-form-label">Responsable <span class="text-danger">*</span></label>
                                <input type="text" id="planResponsable" class="k-form-control" required placeholder="Nombre del responsable">
                            </div>
                            <div class="k-form-group">
                                <label class="k-form-label">Fecha Límite <span class="text-danger">*</span></label>
                                <input type="date" id="planFechaLimite" class="k-form-control" required>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="k-modal-footer">
                    <button class="k-btn k-btn-outline" onclick="this.closest('.k-modal').remove()">
                        <i class="bi bi-x-lg"></i> Cancelar
                    </button>
                    <button class="k-btn k-btn-primary" onclick="window.currentEvaluacionInstance.saveActionPlan(${planId})">
                        <i class="bi bi-check-lg"></i> ${isEdit ? 'Guardar Cambios' : 'Crear Plan'}
                    </button>
                </div>
            </div>
        `;
        
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);
        modal.showModal();
        this._ensureDialogBackdropStyle();
        
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
                // 📦531 — Persistir en BD
                this._persistActionPlan(this.actionPlans[planIndex]);
            }
        } else {
            // Crear nuevo plan — 📦531 usar crypto.randomUUID() en vez de
            // contador (mas robusto, sin colisiones entre instancias).
            var newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : 'eap-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 0xffffff).toString(16);
            const newPlan = {
                id: newId,
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
            // 📦531 — Persistir en BD
            this._persistActionPlan(newPlan);
        }

        // Cerrar modal y actualizar tabla
        const modal = document.querySelector('.k-modal');
        if (modal) modal.remove();

        this.renderActionPlansTable();

        // 📦531 — Refrescar KPI del dashboard si esta visible (cambio
        // de estado pendiente/completado afecta el contador).
        if (this.activeTab === 'dashboard' || this.currentFindings.length > 0) {
            this.updateDashboardWithRealData({ cumplimiento: this.lastScore });
        }
    }
    
    showActionPlanDetailModal(planId) {
        console.log('[EvaluacionInicialSgSst] Mostrando detalle del plan:', planId);
        
        const plan = this.actionPlans.find(p => p.id === planId);
        if (!plan) {
            this.showToast('Plan no encontrado', 'danger');
            return;
        }
        
        const hallazgo = this.currentFindings.find(f => f.code === plan.hallazgoId);
        
        const modal = document.createElement('dialog');
        modal.className = 'k-modal';
        // 📦534 — HTML5 <dialog> con showModal(): el navegador centra
        // automaticamente y da ::backdrop nativo. Sin position:fixed,
        // sin wrapper, sin stacking context. Los close buttons
        // (this.closest('.k-modal').remove()) siguen funcionando
        // porque removemos el dialog del DOM.
        modal.style.cssText = `
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            margin: auto !important;
            max-width: 95vw !important;
            max-height: 95vh !important;
            overflow: visible !important;
            color: inherit !important;
            animation: ei-fadeIn 0.3s ease-in-out;
        `;

        let modalContent = `
            <div class="k-modal-content" style="background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);">
                <div class="k-modal-header text-center" style="margin-bottom: 2rem;">
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
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div style="grid-column: 1 / -1; background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border);">
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
        modal.showModal();
        this._ensureDialogBackdropStyle();
    }
    
    showFollowUpModal(planId) {
        console.log('[EvaluacionInicialSgSst] Abriendo modal de seguimiento para plan:', planId);
        
        const plan = this.actionPlans.find(p => p.id === planId);
        if (!plan) {
            this.showToast('Plan no encontrado', 'danger');
            return;
        }
        
        const modal = document.createElement('dialog');
        modal.className = 'k-modal';
        // 📦534 — HTML5 <dialog> con showModal(): el navegador centra
        // automaticamente y da ::backdrop nativo. Sin position:fixed,
        // sin wrapper, sin stacking context. Los close buttons
        // (this.closest('.k-modal').remove()) siguen funcionando
        // porque removemos el dialog del DOM.
        modal.style.cssText = `
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            margin: auto !important;
            max-width: 95vw !important;
            max-height: 95vh !important;
            overflow: visible !important;
            color: inherit !important;
            animation: ei-fadeIn 0.3s ease-in-out;
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
                <div class="k-modal-header text-center" style="margin-bottom: 2rem;">
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
        modal.showModal();
        this._ensureDialogBackdropStyle();
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

        // 📦535 — Persistir en BD: antes solo se guardaba en memoria y se
        // perdia al cerrar la app. Ahora el seguimiento sobrevive reinicios.
        this._persistActionPlan(this.actionPlans[planIndex]);

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
        
        const modal = document.createElement('dialog');
        modal.className = 'k-modal';
        // 📦534 — HTML5 <dialog> con showModal(): el navegador centra
        // automaticamente y da ::backdrop nativo. Sin position:fixed,
        // sin wrapper, sin stacking context. Los close buttons
        // (this.closest('.k-modal').remove()) siguen funcionando
        // porque removemos el dialog del DOM.
        modal.style.cssText = `
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            margin: auto !important;
            max-width: 95vw !important;
            max-height: 95vh !important;
            overflow: visible !important;
            color: inherit !important;
            animation: ei-fadeIn 0.3s ease-in-out;
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
                <div class="k-modal-header text-center" style="margin-bottom: 2rem;">
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
        modal.showModal();
        this._ensureDialogBackdropStyle();
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

        // 📦535 — Persistir en BD: antes solo se guardaba en memoria.
        this._persistActionPlan(this.actionPlans[planIndex]);

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

        // 📦535 — Persistir en BD: antes solo se guardaba en memoria.
        this._persistActionPlan(this.actionPlans[planIndex]);

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

        // 📦535 — Persistir en BD: antes el plan "eliminado" volvia a
        // aparecer al reiniciar la app porque solo se borraba de memoria.
        // Ahora ademas de quitarlo de this.actionPlans, lo borramos de la
        // tabla evaluacion_action_plans via IPC. Defensa cross-tenant
        // ya esta en el bridge (WHERE id=? AND empresa_id=?).
        if (window.electronAPI && window.electronAPI.evaluacionActionPlans) {
            const empresaId = window.currentCompany;
            if (empresaId && empresaId !== 'default_company') {
                window.electronAPI.evaluacionActionPlans.eliminar({
                    empresaId: empresaId,
                    id: planId
                }).then(function (res) {
                    if (!res || !res.success) {
                        console.warn('[EvaluacionInicialSgSst] No se pudo eliminar plan de BD:', res && res.error && res.error.message);
                    }
                }).catch(function (err) {
                    console.error('[EvaluacionInicialSgSst] Error eliminando plan de BD:', err);
                });
            }
        }

        this.renderActionPlansTable();
    }
    
    getEstadoBadge(estado) {
        // 📦532 — El badge usa k-badge--inline para que el emoji y el texto
        // queden en la misma linea (display: inline-flex + align-items: center).
        // Antes se veia apilado porque el k-badge default no tiene gap ni
        // nowrap, y el emoji ⏳/✅ con line-height alto quedaba visualmente
        // arriba del texto.
        const badges = {
            'pendiente': '<span class="k-badge k-badge-warning k-badge--inline">⏳ Pendiente</span>',
            'en_progreso': '<span class="k-badge k-badge-info k-badge--inline">🔄 En Progreso</span>',
            'completado': '<span class="k-badge k-badge-success k-badge--inline">✅ Completado</span>',
            'cancelado': '<span class="k-badge k-badge-danger k-badge--inline">❌ Cancelado</span>'
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

        // 📦533 — Separar planes con hallazgo vinculado de planes huerfanos
        // (hallazgoId null). Los huerfanos vienen del parser del ARL que es
        // demasiado permisivo (utils/evaluacionPdfParser.js). Los ocultamos
        // del render normal y los mostramos en una fila colapsable al final
        // para que el usuario los pueda ver/eliminar si quiere.
        var normalPlans = this.actionPlans.filter(function (p) { return p.hallazgoId != null; });
        var orphanPlans = this.actionPlans.filter(function (p) { return p.hallazgoId == null; });

        if (this.actionPlans.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="k-empty-table">No hay planes activos.</td></tr>';
            return;
        }

        if (normalPlans.length === 0 && orphanPlans.length > 0) {
            // Solo hay huerfanos. Mostrar el disclosure por defecto.
            tbody.innerHTML = '<tr><td colspan="6" class="k-empty-table">' +
                'Todos los planes extraídos del PDF actual quedaron sin hallazgo vinculado. ' +
                'Probablemente el parser del ARL extrajo texto descriptivo en vez de planes reales. ' +
                'Verificá el PDF o revisá el parser.</td></tr>';
            this._renderOrphanDisclosure(tbody, orphanPlans);
            return;
        }

        console.log('[EvaluacionInicialSgSst] Renderizando', normalPlans.length, 'planes normales +', orphanPlans.length, 'huerfanos');

        var rows = normalPlans.map(function (plan) {
            var hallazgo = this.currentFindings.find(function (f) { return f.code === plan.hallazgoId; });
            var hallazgoCode = hallazgo ? hallazgo.code : '';
            var hallazgoDesc = hallazgo ? hallazgo.desc : '';
            return '<tr>' +
                '<td>' + this.getEstadoBadge(plan.estado) + '</td>' +
                '<td>' +
                  '<div style="font-weight: 500;">' + hallazgoCode + '</div>' +
                  '<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">' + hallazgoDesc + '</div>' +
                '</td>' +
                '<td>' + plan.accion + '</td>' +
                '<td>' + plan.responsable + '</td>' +
                '<td>' + (plan.fechaLimite ? new Date(plan.fechaLimite).toLocaleDateString('es-CO') : '—') + '</td>' +
                '<td>' +
                  '<div style="display: flex; gap: 0.5rem; justify-content: flex-end;">' +
                    '<button class="k-btn k-btn-sm k-btn-outline" onclick="window.currentEvaluacionInstance.showActionPlanDetailModal(\'' + plan.id + '\')" title="Ver detalle">' +
                      '<i class="bi bi-eye"></i></button>' +
                    '<button class="k-btn k-btn-sm k-btn-outline" onclick="window.currentEvaluacionInstance.showActionPlanModal(\'' + plan.id + '\')" title="Editar">' +
                      '<i class="bi bi-pencil"></i></button>' +
                    '<button class="k-btn k-btn-sm k-btn-outline" onclick="window.currentEvaluacionInstance.deleteActionPlan(\'' + plan.id + '\')" title="Eliminar" style="color: var(--danger); border-color: var(--danger);">' +
                      '<i class="bi bi-trash"></i></button>' +
                  '</div>' +
                '</td>' +
            '</tr>';
        }.bind(this));

        if (orphanPlans.length > 0) {
            this._renderOrphanDisclosure(tbody, orphanPlans);
        }

        tbody.innerHTML = rows.join('');
    }

    /**
     * 📦533 — Renderiza una fila colapsable al final de la tabla con los
     * planes huerfanos (sin hallazgo vinculado). Por defecto esta fila
     * esta colapsada (muestra solo un resumen). El usuario hace click para
     * expandir y ver/eliminar los planes huerfanos.
     */
    _renderOrphanDisclosure(tbody, orphanPlans) {
        var disclosureId = 'kair-orphan-disclosure-' + Date.now();
        var rows = orphanPlans.map(function (plan, idx) {
            return '<tr style="background-color: rgba(255, 193, 7, 0.08);">' +
                '<td>' + this.getEstadoBadge(plan.estado) + '</td>' +
                '<td colspan="2">' +
                  '<span class="k-badge k-badge-warning k-badge--inline" title="Este plan no se vinculo a ningun hallazgo del PDF">⚠️ Plan ARL sin hallazgo</span>' +
                '</td>' +
                '<td>' + plan.responsable + '</td>' +
                '<td>' + (plan.fechaLimite ? new Date(plan.fechaLimite).toLocaleDateString('es-CO') : '—') + '</td>' +
                '<td>' +
                  '<div style="display: flex; gap: 0.5rem; justify-content: flex-end;">' +
                    '<button class="k-btn k-btn-sm k-btn-outline" onclick="window.currentEvaluacionInstance.showActionPlanDetailModal(\'' + plan.id + '\')" title="Ver detalle">' +
                      '<i class="bi bi-eye"></i></button>' +
                    '<button class="k-btn k-btn-sm k-btn-outline" onclick="window.currentEvaluacionInstance.deleteActionPlan(\'' + plan.id + '\')" title="Eliminar" style="color: var(--danger); border-color: var(--danger);">' +
                      '<i class="bi bi-trash"></i></button>' +
                  '</div>' +
                '</td>' +
            '</tr>';
        }.bind(this));

        var html = '<tr class="kair-orphan-disclosure-row">' +
            '<td colspan="6" style="padding: 0; background-color: #fff8e1; border-left: 3px solid #ffc107;">' +
              '<div style="padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; cursor: pointer;" onclick="document.getElementById(\'' + disclosureId + '\').classList.toggle(\'kair-collapsed\'); this.querySelector(\'i\').classList.toggle(\'bi-chevron-down\'); this.querySelector(\'i\').classList.toggle(\'bi-chevron-up\');">' +
                '<div>' +
                  '<i class="bi bi-chevron-down" style="margin-right: 8px; color: #856404;"></i>' +
                  '<span style="color: #856404; font-weight: 600;">' + orphanPlans.length + ' plan(es) huerfano(s) del ARL</span>' +
                  '<span style="color: #856404; opacity: 0.7; margin-left: 8px; font-size: 0.85rem;">(sin hallazgo vinculado, posible ruido del parser)</span>' +
                '</div>' +
                '<button class="k-btn k-btn-sm" style="background: #ffc107; color: #212529; border: none;" onclick="event.stopPropagation(); window.currentEvaluacionInstance._discardAllOrphans();" title="Eliminar todos los huerfanos">' +
                  '<i class="bi bi-trash"></i> Descartar todos' +
                '</button>' +
              '</div>' +
              '<div id="' + disclosureId + '" class="kair-collapsed">' +
                '<table style="width: 100%; border-collapse: collapse;">' +
                  rows.join('') +
                '</table>' +
              '</div>' +
            '</td>' +
        '</tr>';

        tbody.insertAdjacentHTML('beforeend', html);
    }

    /**
     * 📦533 — Descarta todos los planes huerfanos (sin hallazgo vinculado).
     * Se llama desde el boton "Descartar todos" del disclosure.
     */
    _discardAllOrphans() {
        if (!confirm('¿Eliminar todos los planes huerfanos (sin hallazgo vinculado)? Esta accion no se puede deshacer.')) {
            return;
        }
        var orphansRemoved = 0;
        this.actionPlans = this.actionPlans.filter(function (p) {
            if (p.hallazgoId == null) {
                orphansRemoved++;
                // Eliminar de la BD tambien
                if (window.electronAPI && window.electronAPI.evaluacionActionPlans) {
                    var empresaId = window.currentCompany;
                    if (empresaId && empresaId !== 'default_company') {
                        window.electronAPI.evaluacionActionPlans.eliminar({
                            empresaId: empresaId,
                            id: p.id
                        }).catch(function (e) { /* ignore */ });
                    }
                }
                return false;
            }
            return true;
        });
        this._log('log', '_discardAllOrphans: eliminados ' + orphansRemoved + ' planes huerfanos');
        this.renderActionPlansTable();
        this.showToast(orphansRemoved + ' plan(es) huerfano(s) descartado(s)', 'success');
    }
    
    /**
     * Procesa los planes de acción extraídos de un informe de ARL.
     * 📦533 — NO borra los planes existentes. Hace merge: los planes del
     * ARL se agregan a this.actionPlans sin pisar los que ya están
     * (de cargas anteriores o de carga del Ministerio). Después llama
     * a _ensureNoCumpleFindingsHavePlans() para garantizar que cada
     * hallazgo no_cumple tenga su plan de acción visible.
     * @param {Array} arlActionPlans - Planes de acción extraídos del informe ARL
     */
    processArlActionPlans(arlActionPlans) {
        console.log('[EvaluacionInicialSgSst] Procesando', arlActionPlans.length, 'planes de acción de ARL');

        // IDs de hallazgos que ya tienen plan del ARL (se usan despues para
        // el merge con planes auto-generados)
        const hallazgosCubiertosPorARL = new Set();

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

            // Si hay un hallazgo relacionado, sobrescribir el plan existente
            // (si lo hay) para usar la data del ARL que es más especifica.
            if (relatedHallazgo) {
                hallazgosCubiertosPorARL.add(relatedHallazgo.code);
                // Buscar si ya hay un plan para este hallazgo
                const existingIdx = this.actionPlans.findIndex(
                    p => p.hallazgoId === relatedHallazgo.code
                );
                const newPlan = {
                    id: existingIdx >= 0 ? this.actionPlans[existingIdx].id : this._generatePlanId(),
                    hallazgoId: relatedHallazgo.code,
                    hallazgoCodigo: relatedHallazgo.code,
                    hallazgoDescripcion: relatedHallazgo.desc,
                    accion: arlPlan.accion,
                    responsable: arlPlan.responsable || 'Por asignar',
                    fechaLimite: arlPlan.fechaLimite,
                    estado: arlPlan.estado || 'pendiente',
                    seguimientos: arlPlan.seguimientos || [],
                    responsables: arlPlan.responsables || []
                };
                if (existingIdx >= 0) {
                    this.actionPlans[existingIdx] = newPlan;
                } else {
                    this.actionPlans.push(newPlan);
                }
                console.log('[EvaluacionInicialSgSst] Plan ARL vinculado a hallazgo:', relatedHallazgo.code);
            } else {
                // Plan del ARL sin hallazgo relacionado: lo agregamos igual
                // con hallazgoId null. Sirve para mostrar planes que el ARL
                // extrajo pero que no pudimos vincular automaticamente.
                const newPlan = {
                    id: this._generatePlanId(),
                    hallazgoId: null,
                    hallazgoCodigo: null,
                    hallazgoDescripcion: '',
                    accion: arlPlan.accion,
                    responsable: arlPlan.responsable || 'Por asignar',
                    fechaLimite: arlPlan.fechaLimite,
                    estado: arlPlan.estado || 'pendiente',
                    seguimientos: arlPlan.seguimientos || [],
                    responsables: arlPlan.responsables || [],
                    _source: 'arl-sin-vincular'
                };
                this.actionPlans.push(newPlan);
                console.log('[EvaluacionInicialSgSst] Plan ARL sin hallazgo vinculado (agregado con hallazgoId=null)');
            }
        });

        console.log('[EvaluacionInicialSgSst] Hallazgos cubiertos por ARL:', hallazgosCubiertosPorARL.size);

        // Despues de procesar el ARL, garantizar que cada hallazgo no_cumple
        // tenga su plan visible (genera los que faltan).
        this._ensureNoCumpleFindingsHavePlans('arl');
    }

    /**
     * Genera automáticamente planes de acción para hallazgos con estado "no_cumple".
     * 📦533 — NO borra los planes existentes. Solo crea planes para los
     * hallazgos no_cumple que AUN NO tienen un plan. Despues limpia los
     * planes cuyo hallazgo ya no es no_cumple (porque el status del
     * hallazgo cambio en una carga posterior del PDF).
     */
    generateActionPlansForNoCumple() {
        console.log('[EvaluacionInicialSgSst] Generando planes de acción para hallazgos no_cumple (modo merge)');

        // Limpiar planes cuyo hallazgo ya no es no_cumple (o ya no existe
        // en currentFindings). Esto evita planes huerfanos de cargas
        // anteriores del PDF.
        const hallazgosMap = new Map(this.currentFindings.map(f => [f.code, f]));
        const before = this.actionPlans.length;
        this.actionPlans = this.actionPlans.filter(p => {
            if (!p.hallazgoId) {
                // Planes sin hallazgo vinculado (ej: ARL sin match) — los dejamos
                return true;
            }
            const hallazgo = hallazgosMap.get(p.hallazgoId);
            return hallazgo && hallazgo.status === 'no_cumple';
        });
        const removed = before - this.actionPlans.length;
        if (removed > 0) {
            console.log('[EvaluacionInicialSgSst] Eliminados', removed, 'planes cuyo hallazgo ya no es no_cumple');
        }

        // Delegar a la funcion unificada
        this._ensureNoCumpleFindingsHavePlans('ministerio');
    }

    /**
     * 📦533 — Garantiza que cada hallazgo con status='no_cumple' tenga al
     * menos un plan de acción visible en this.actionPlans.
     *
     * Estrategia:
     * 1. Calcula los hallazgos no_cumple del PDF actual
     * 2. Calcula los hallazgos que ya tienen plan (por hallazgoId)
     * 3. Para cada hallazgo no_cumple SIN plan: crea uno generico
     *    (accion placeholder, responsable 'Por asignar', fecha limite +30 dias)
     * 4. Persiste los nuevos planes en la BD
     *
     * Esto resuelve el bug donde cargar un PDF de ARL pisaba los planes
     * del Ministerio: ahora ambos tipos conviven, y los hallazgos que
     * quedaron sin cubrir tienen un plan auto-generado que el usuario
     * puede editar (responsable, fecha, accion especifica).
     *
     * @param {string} source - 'ministerio' | 'arl' (para logging y
     *                           metadata del plan auto-generado)
     */
    _ensureNoCumpleFindingsHavePlans(source) {
        const noCumpleFindings = this.currentFindings.filter(f => f.status === 'no_cumple');
        console.log('[EvaluacionInicialSgSst] [_ensureNoCumpleFindingsHavePlans] source=' + source + ' hallazgos no_cumple=' + noCumpleFindings.length);

        // Set de hallazgoId que ya tienen plan en memoria
        const hallazgosConPlan = new Set(
            this.actionPlans
                .map(p => p.hallazgoId)
                .filter(id => id != null)
        );

        let created = 0;
        for (const hallazgo of noCumpleFindings) {
            if (hallazgosConPlan.has(hallazgo.code)) continue;

            // Crear plan generico para este hallazgo no_cumple
            const newPlan = {
                id: this._generatePlanId(),
                hallazgoId: hallazgo.code,
                hallazgoCodigo: hallazgo.code,
                hallazgoDescripcion: hallazgo.desc,
                accion: 'Implementar acciones correctivas para cumplir con el estandar ' + hallazgo.code,
                responsable: 'Por asignar',
                fechaLimite: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 dias desde hoy
                estado: 'pendiente',
                seguimientos: [],
                responsables: [],
                _source: source,
                _autoGenerated: true
            };
            this.actionPlans.push(newPlan);
            created++;
            // Persistir en la BD (best-effort: si falla, el plan queda en memoria)
            this._persistActionPlan(newPlan);
        }
        if (created > 0) {
            console.log('[EvaluacionInicialSgSst] [_ensureNoCumpleFindingsHavePlans] ' + created + ' planes auto-generados para cubrir hallazgos no_cumple');
        }
    }

    /**
     * 📦533 — Genera un ID unico para un plan. Usa crypto.randomUUID()
     * si esta disponible, con fallback timestamp+random hex.
     */
    _generatePlanId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'eap-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 0xffffff).toString(16);
    }

    // 📦532 — showToast ahora delega a window.KAIRToast, el estandar
    // de notificaciones del proyecto (mismo que usan los modulos de
    // Capacitacion, COPASST, Comite de Convivencia, etc.). Ver
    // assets/js/kair-toast.js para la API completa (show msg, type, opts).
    //
    // Mantenemos showToast como wrapper para no romper los 30+ call
    // sites que ya usan this.showToast(msg, type). KAIRToast.show()
    // acepta los mismos tipos que usabamos antes ('success' | 'error' |
    // 'warning' | 'info' | 'danger' → 'error').
    showToast(msg, type = 'info') {
        if (typeof window.KAIRToast !== 'object' || typeof window.KAIRToast.show !== 'function') {
            // Fallback defensivo: si KAIRToast no esta disponible (ej: en
            // un test o si se carga en orden raro), usar console.error
            // para no perder el mensaje silenciosamente.
            console.error('[showToast fallback] ' + type + ': ' + msg);
            return;
        }
        window.KAIRToast.show(msg, type);
    }

    drawGauge(value = 0) {
        // 📦531 — Scoping al container
        const canvas = this.container.querySelector('#gaugeChart');
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

    // 📦531 — Setup del ResizeObserver para que el gauge se redibuje
    // cuando el usuario redimensiona la ventana. Llamar una vez despues
    // del render inicial. Cleanup en destroy().
    _setupGaugeResizeObserver() {
        const canvas = this.container.querySelector('#gaugeChart');
        if (!canvas) return;
        const parent = canvas.parentElement;
        if (!parent || typeof ResizeObserver === 'undefined') return;
        // Si ya hay uno, desconectarlo
        if (this._gaugeResizeObserver) {
            this._gaugeResizeObserver.disconnect();
        }
        this._gaugeResizeObserver = new ResizeObserver(() => {
            // Redibujar con throttle basico (evita llamar varias veces
            // en el mismo frame)
            if (this._gaugeResizePending) return;
            this._gaugeResizePending = true;
            requestAnimationFrame(() => {
                this._gaugeResizePending = false;
                if (this.lastScore !== undefined) {
                    this.drawGauge(this.lastScore);
                }
            });
        });
        this._gaugeResizeObserver.observe(parent);
    }

    // 📦531 — Cleanup. Llamar cuando el módulo se desmonta (ej: el
    // usuario navega a otro módulo o submódulo). Libera observers,
    // listeners y referencias para evitar memory leaks.
    destroy() {
        this._log('log', 'destroy() — limpiando recursos');

        // Desconectar ResizeObserver
        if (this._gaugeResizeObserver) {
            this._gaugeResizeObserver.disconnect();
            this._gaugeResizeObserver = null;
        }

        // 📦532 — El sistema de toasts es global (KAIRToast usa
        // #notification-hub en document.body). No hay nada que limpiar
        // local al desmontar el modulo — los toasts que sigan visibles
        // se mantendran hasta su autoClose natural. Si quisieramos
        // limpiarlos, hariamos window.KAIRToast (no expone dismiss
        // actualmente; ver si se quiere agregar).

        // Limpiar referencias grandes
        this.actionPlans = [];
        this.currentFindings = [];
        this.pdfFilesCache = null;
        this.hallazgosTableBody = null;
        this.actionTableBody = null;
        this._backHandler = null;
        this._viewPdfHandler = null;

        // Limpiar instancia global
        if (window.currentEvaluacionInstance === this) {
            window.currentEvaluacionInstance = null;
        }

        // El container se vacia desde el caller; no tocamos el DOM acá.
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

        /* HEADER — Card k-section-card */
        .k-section-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .header-back-btn { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; font-size: 0.8125rem; font-weight: 500; color: #5a6378; background: transparent; border: 1px solid #dee2e6; border-radius: 0.375rem; cursor: pointer; transition: all 0.15s ease; }
        .header-back-btn:hover { background: #e8f0fe; color: #174ea6; border-color: #174ea6; }
        .header-action--outline { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; font-size: 0.8125rem; font-weight: 500; color: #5a6378; background: transparent; border: 1px solid #dee2e6; border-radius: 0.375rem; cursor: pointer; transition: all 0.15s ease; }
        .header-action--outline:hover { background: #f0f2f5; color: #1a1a2e; }
        .header-select { padding: 0.375rem 0.75rem; border: 1px solid #dee2e6; border-radius: 0.375rem; font-size: 0.8125rem; font-weight: 500; color: #1E293B; background: #fff; cursor: pointer; }

        /* TABS — dentro del card */
        .evaluacion-tabs { display: flex; gap: 0; margin: 0 -1.5rem; padding: 0 1.5rem; border-top: 1px solid #dee2e6; overflow-x: auto; }
        .evaluacion-tab { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.75rem 1rem; font-size: 0.875rem; font-weight: 500; color: #5a6378; background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: color 0.15s ease, border-color 0.15s ease; white-space: nowrap; }
        .evaluacion-tab:hover { color: #174ea6; }
        .evaluacion-tab.active { color: #174ea6; font-weight: 600; border-bottom-color: #174ea6; }

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

/* STATS RIBBON */
.k-stats-ribbon { display: flex; align-items: center; gap: 0; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 0; margin-bottom: 1.5rem; box-shadow: var(--shadow-sm); overflow: hidden; }
.k-stats-ribbon__item { display: flex; align-items: center; gap: 0.625rem; padding: 0.75rem 1.25rem; flex: 1; min-width: 0; }
.k-stats-ribbon__icon { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.875rem; flex-shrink: 0; }
.k-stats-ribbon__icon.primary { background: var(--primary-light); color: var(--primary); }
.k-stats-ribbon__icon.danger { background: rgba(220, 53, 69, 0.1); color: var(--danger); }
.k-stats-ribbon__icon.warning { background: rgba(255, 193, 7, 0.1); color: var(--warning); }
.k-stats-ribbon__data { display: flex; flex-direction: column; min-width: 0; }
.k-stats-ribbon__value { font-size: 1.25rem; font-weight: 700; color: var(--text-dark); line-height: 1.2; }
.k-stats-ribbon__label { font-size: 0.6875rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
.k-stats-ribbon__pct { margin-left: auto; font-size: 0.75rem; font-weight: 600; color: var(--primary); background: var(--primary-light); padding: 0.125rem 0.5rem; border-radius: 10px; white-space: nowrap; flex-shrink: 0; }
.k-stats-ribbon__divider { width: 1px; height: 32px; background: var(--border); flex-shrink: 0; }
@media (max-width: 768px) { .k-stats-ribbon { flex-wrap: wrap; } .k-stats-ribbon__item { flex: 1 1 45%; } .k-stats-ribbon__divider { display: none; } }

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

        /* Tablas con scroll vertical propio y encabezado fijo.
           Aplica a la tabla de estándares (~60 filas) y a la de
           planes de acción. Evita que los títulos se pierdan al
           hacer scroll dentro de la tabla. */
        .k-table-scrollable { max-height: 60vh; overflow-y: auto; scrollbar-gutter: stable; }
        .k-table-scrollable .k-table { border-collapse: separate; border-spacing: 0; }
        .k-table-scrollable .k-table th {
            position: sticky;
            top: 0;
            z-index: 2;
            background: #f8f9fa;
            border-bottom: none;
            box-shadow: inset 0 -2px 0 var(--border);
        }

        /* BADGES & BUTTONS */
        .k-badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
        /* 📦532 — Variante inline del badge: emoji + texto en la misma
           linea (display: inline-flex + align-items: center + gap + white-space: nowrap).
           Sin esto, el emoji quedaba visualmente arriba del texto en columnas
           angostas (ej: Estado con 10% de ancho). */
        .k-badge.k-badge--inline { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; line-height: 1.2; }
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

        /* 📦534 — Reglas de modal SIN scoping + posición ABSOLUTE.
           Los modales se adjuntan al wrapper #k-modal-root (que SI es
           position:fixed fullscreen), NO al body. Por eso el overlay
           usa position:absolute relativo al wrapper. Esto evita los
           problemas de position:fixed en Electron con body overflow:hidden.
           El CSS externo evaluacion-inicial-sg-sst.css define .k-modal
           bajo .ev-inicial-sgsst (no aplica) y con position:fixed (tambien
           problematico). Por eso duplicamos las reglas base aqui. */
        .k-modal {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.6);
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 9999 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            pointer-events: auto !important;
            animation: ei-fadeIn 0.3s ease-in-out;
        }
        .k-modal-content {
            background: var(--bg-card);
            border-radius: 16px;
            width: 90%;
            max-width: 700px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            pointer-events: auto !important;
            animation: ei-slideUp 0.4s ease-out;
        }
        .k-modal-content.k-modal-content--wide { max-width: 900px; }
        .k-modal-header {
            padding: 1.5rem 2rem;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }
        .k-modal-header.text-center {
            text-align: center;
            flex-direction: column;
            gap: 0.25rem;
        }
        .k-modal-header h3 { margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--text-dark); }
        .k-modal-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 56px; height: 56px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark, #0d3578) 100%);
            border-radius: 50%;
            margin-bottom: 0.75rem;
        }
        .k-modal-icon i { color: white; font-size: 1.6rem; }
        .k-modal-subtitle {
            margin: 0;
            color: var(--text-muted);
            font-size: 0.9rem;
        }
        .k-modal-body {
            padding: 1.5rem 2rem;
            overflow-y: auto;
            flex: 1;
        }
        .k-modal-footer {
            padding: 1rem 2rem;
            border-top: 1px solid var(--border);
            display: flex;
            justify-content: flex-end;
            gap: 0.75rem;
            flex-shrink: 0;
            background: var(--bg-body);
        }

        /* 📦533 — Form SIN scoping (misma razón que modal: el form vive
           dentro del modal que se adjunta al body, fuera del scope). */
        .k-form-group { margin-bottom: 1.25rem; }
        .k-form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5rem;
        }
        .k-form-label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
            color: var(--text-dark);
            font-size: 0.9rem;
        }
        .k-form-control {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid var(--border);
            border-radius: 6px;
            font-size: 0.9rem;
            font-family: inherit;
            color: var(--text-dark);
            background: var(--bg-card);
            transition: border-color 0.2s, box-shadow 0.2s;
            box-sizing: border-box;
        }
        .k-form-control:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.1);
        }
        .k-form-control-sm { padding: 0.375rem 0.625rem; font-size: 0.8rem; }

        @keyframes ei-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ei-slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* 📦532 — El bloque .k-toast se elimino. Las notificaciones ahora
           las gestiona KAIRToast (assets/js/kair-toast.js + #notification-hub). */

    `;
    document.head.appendChild(style);
}

// Inicialización
window.EvaluacionInicialSgSst = EvaluacionInicialSgSst;

})();