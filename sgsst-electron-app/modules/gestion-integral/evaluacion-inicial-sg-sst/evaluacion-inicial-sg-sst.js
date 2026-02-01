// evaluacion-inicial-sg-sst.js - Componente para el submódulo "2.3.1 Evaluación inicial del SG-SST"

class EvaluacionInicialSgSst {
    constructor(container, moduleName, submoduleTitle) {
        this.container = container;
        this.moduleName = moduleName;
        this.submoduleTitle = submoduleTitle;
        this.currentFindings = [];
        this.currentData = [];
        this.currentYear = '2025';
        this.currentSource = 'ministerio';
        
        // Datos de ejemplo
        this.findingsBase = {
            '2025': {
                'ministerio': [
                    { code: '1.1.1', desc: 'Responsable del Sistema de Gestión SG-SST', max: 0.5, grade: 0.5, status: 'Cumple' },
                    { code: '1.1.2', desc: 'Responsabilidades en el SG-SST', max: 0.5, grade: 0.5, status: 'Cumple' },
                    { code: '2.10.1', desc: 'Evaluación y selección de proveedores y contratistas', max: 2.0, grade: 0, status: 'No Cumple' },
                    { code: '2.11.1', desc: 'Evaluación del impacto de cambios internos y externos', max: 1.0, grade: 0, status: 'No Cumple' },
                    { code: '2.3.1', desc: 'Evaluación e identificación de prioridades', max: 1.0, grade: 1.0, status: 'Cumple' },
                    { code: '3.1.1', desc: 'Descripción sociodemográfica', max: 1.0, grade: 1.0, status: 'Cumple' }
                ],
                'arl': [
                    { code: '4.1.1', desc: 'Metodología identificación de peligros', max: 4.0, grade: 4.0, status: 'Cumple' },
                    { code: '4.1.2', desc: 'Identificación de peligros con participación', max: 4.0, grade: 4.0, status: 'Cumple' },
                    { code: 'R-ERGO', desc: 'Detección Riesgo Ergonómico (Visita)', max: 10.0, grade: 5.0, status: 'Parcial' },
                    { code: 'R-ELEC', desc: 'Detección Riesgo Eléctrico (Visita)', max: 10.0, grade: 0, status: 'No Cumple' }
                ]
            },
            '2024': {
                'ministerio': [
                    { code: '2.3.1', desc: 'Evaluación inicial antigua', max: 1.0, grade: 0.5, status: 'Parcial' }
                ],
                'arl': []
            }
        };

        this.dataBase = {
            '2025': {
                'ministerio': [
                    { id: 1, finding: "2.10.1 Evaluación y selección de proveedores: No cumple.", action: "Implementar programa de evaluación.", responsible: "Javier Robles", deadline: "30/03/2026", status: "pending", evidence: null, obs: "" },
                    { id: 2, finding: "2.11.1 Evaluación del impacto de cambios: Procedimiento ausente.", action: "Implementar procedimiento.", responsible: "Javier Robles", deadline: "30/03/2026", status: "progress", evidence: "borrador.pdf", obs: "Se requiere aprobación gerencial." }
                ],
                'arl': [
                    { id: 101, finding: "R-ELEC Eléctrico: Falta toma a tierra.", action: "Revisión técnica.", responsible: "Mantenimiento", deadline: "30/01/2026", status: "done", evidence: "rep.pdf", obs: "Correctivo realizado." }
                ]
            },
            '2024': {
                'ministerio': [], 'arl': []
            }
        };
    }

    async render() {
        this.container.innerHTML = '';

        // Crear el contenedor principal con la estructura fiel al código proporcionado
        const mainContainer = document.createElement('div');
        mainContainer.className = 'evaluacion-inicial-sg-sst';
        mainContainer.innerHTML = `
            <!-- Header Global -->
            <header class="global-header">
                <div class="header-top">
                    <div class="main-title">Evaluación Inicial del SG-SST</div>
                    <div class="breadcrumb-context">Gestión Integral / 2.3.1 Evaluación Inicial</div>
                </div>
                <div class="header-nav">
                    <div class="nav-item active" onclick="instance.switchSection('dashboard', this)">Dashboard</div>
                    <div class="nav-item" onclick="instance.switchSection('hallazgos', this)">Hallazgos</div>
                    <div class="nav-item" onclick="instance.switchSection('actions', this)">Planes de Acción</div>
                    <div class="nav-item" onclick="instance.switchSection('history', this)">Historial</div>
                </div>
            </header>

            <main class="container-fluid">
                <!-- PANEL DE CONTROL -->
                <div class="control-panel">
                    <div class="control-group">
                        <span class="control-label">Origen del Informe:</span>
                        <select class="ctx-select" id="sourceSelect" onchange="instance.updateSource()">
                            <option value="ministerio">🏛️ Ministerio de Trabajo</option>
                            <option value="arl">🛡️ Informe ARL</option>
                        </select>
                        <select class="ctx-select" id="yearSelect" onchange="instance.updateSource()">
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                            <option value="2023">2023</option>
                        </select>
                    </div>
                    <div>
                        <input type="file" id="fileUpload" style="display: none;" onchange="instance.handleFileUpload(this)">
                        <div class="file-upload-action" onclick="document.getElementById('fileUpload').click()">
                            📂 Cargar nuevo archivo...
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN 1: DASHBOARD -->
                <div id="dashboard" class="section-view active">
                    
                    <!-- Tarjetas KPIs -->
                    <div class="metrics-row">
                        <div class="metric-card">
                            <div class="metric-header"><span class="metric-title">Cumplimiento Global</span><span>📊</span></div>
                            <div class="metric-value-group"><span class="metric-value text-primary" id="kpi-score">97%</span></div>
                            <div class="chart-internal-container"><canvas id="gaugeKpi" width="200" height="60"></canvas></div>
                        </div>
                        <div class="metric-card" style="border-top: 4px solid var(--danger);">
                            <div class="metric-header"><span class="metric-title">Hallazgos Críticos</span><span class="text-danger">⚠️</span></div>
                            <div class="metric-value-group"><span class="metric-value text-danger" id="kpi-gaps">2</span><span class="metric-sub">Total Hallazgos</span></div>
                            <div class="chart-internal-container"><canvas id="bulletGaps" width="200" height="40"></canvas></div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-header"><span class="metric-title">Planes Pendientes</span><span>📋</span></div>
                            <div class="metric-value-group"><span class="metric-value" style="color:var(--warning);" id="kpi-pending">1</span><span class="metric-sub">Total Planes</span></div>
                            <div class="chart-internal-container"><canvas id="bulletPending" width="200" height="40"></canvas></div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-header"><span class="metric-title">Trabajadores</span><span>👥</span></div>
                            <div class="metric-value-group"><span class="metric-value">154</span><span class="metric-sub">Activos</span></div>
                            <div class="chart-internal-container" style="border-top:1px solid #eee; padding-top:10px; font-size:0.8rem; color:var(--text-muted);">+2% vs. Año anterior</div>
                        </div>
                    </div>

                    <!-- Gráficas -->
                    <div class="charts-row-large">
                        <div class="chart-card">
                            <div class="chart-title">Estado de Cumplimiento General (Gauge)</div>
                            <canvas id="gaugeChart" width="300" height="200"></canvas>
                            <div style="margin-top: -20px; font-weight: 700; font-size: 1.5rem; color:var(--text-dark);">97%</div>
                        </div>
                        <div class="chart-card">
                            <div class="chart-title">Cumplimiento por Ciclo PHVA (Balance)</div>
                            <div style="width: 100%; max-width: 400px; padding: 0 1rem;">
                                <div style="margin-bottom: 1rem;">
                                    <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.85rem; font-weight:600;">PLANEAR <span>76%</span></div>
                                    <div style="height: 12px; background: #f1f3f5; border-radius:6px; overflow:hidden;"><div style="width: 76%; height:100%; background: #174ea6;"></div></div>
                                </div>
                                <div style="margin-bottom: 1rem;">
                                    <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.85rem; font-weight:600;">HACER <span>100%</span></div>
                                    <div style="height: 12px; background: #f1f3f5; border-radius:6px; overflow:hidden;"><div style="width: 100%; height:100%; background: #28a745;"></div></div>
                                </div>
                                <div style="margin-bottom: 1rem;">
                                    <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.85rem; font-weight:600;">VERIFICAR <span>100%</span></div>
                                    <div style="height: 12px; background: #f1f3f5; border-radius:6px; overflow:hidden;"><div style="width: 100%; height:100%; background: #17a2b8;"></div></div>
                                </div>
                                <div>
                                    <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.85rem; font-weight:600;">ACTUAR <span>100%</span></div>
                                    <div style="height: 12px; background: #f1f3f5; border-radius:6px; overflow:hidden;"><div style="width: 100%; height:100%; background: #ffc107;"></div></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="section-card">
                        <div class="card-header">
                            <div class="card-title">📋 Resumen de Evaluación: <span id="source-title" style="color:var(--primary); font-weight:400;">Ministerio de Trabajo - 2025</span></div>
                            <button class="btn-action" style="padding: 0.5rem 1rem; background: white; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">Ver PDF Original</button>
                        </div>
                        <div style="line-height: 1.6; color: var(--text-dark);">
                            <p><strong>Fecha de Evaluación:</strong> 30/12/2025</p>
                            <p><strong>Normatividad Aplicable:</strong> Resolución 0312 de 2019</p>
                            <p style="margin-top:1rem; background: #f8f9fa; padding: 1rem; border-left: 4px solid var(--warning);">
                                <strong>Observación General:</strong> El sistema muestra un desempeño sólido en los ciclos operativos. Se recomienda fortalecer la fase de Planear.
                            </p>
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN 2: HALLAZGOS -->
                <div id="hallazgos" class="section-view">
                    <div class="section-card">
                        <div class="card-header">
                            <div class="card-title">🔍 Detalle de Hallazgos y Calificación</div>
                            <div style="font-size:0.85rem; color:var(--text-muted);">Extraído del informe seleccionado</div>
                        </div>
                        <div class="table-wrapper">
                            <table class="k-table">
                                <thead>
                                    <tr>
                                        <th style="width: 10%">Código Ítem</th>
                                        <th style="width: 50%">Descripción del Estándar</th>
                                        <th style="width: 15%" style="text-align:center;">Puntaje Máximo</th>
                                        <th style="width: 15%" style="text-align:center;">Puntaje Obtenido</th>
                                        <th style="width: 10%" style="text-align:center;">Estado</th>
                                    </tr>
                                </thead>
                                <tbody id="hallazgosTableBody">
                                    <!-- JS Renderizado -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN 3: PLANES DE ACCIÓN -->
                <div id="actions" class="section-view">
                    <div class="section-card">
                        <div class="card-header">
                            <div class="card-title">🚀 Gestión de Planes de Acción (Seguimiento)</div>
                            <button class="btn-action" style="padding: 0.5rem 1rem; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;">+ Agregar Plan Manual</button>
                        </div>
                        <div class="table-wrapper">
                            <table class="k-table">
                                <thead>
                                    <tr>
                                        <th style="width: 5%">Estado</th>
                                        <th style="width: 25%">Hallazgo / Brecha</th>
                                        <th style="width: 25%">Plan de Acción Propuesto</th>
                                        <th style="width: 10%">Responsable</th>
                                        <th style="width: 10%">Fecha Límite</th>
                                        <th style="width: 10%">Evidencia</th>
                                        <th style="width: 15%">Observaciones</th>
                                    </tr>
                                </thead>
                                <tbody id="actionTableBody">
                                    <!-- JS Renderizado -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN 4: HISTORIAL -->
                <div id="history" class="section-view">
                    <div class="section-card" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">📂</div>
                        <h3>Historial de Cargas</h3>
                        <p>Visualización de versiones anteriores de informes cargados para este submódulo.</p>
                    </div>
                </div>
            </main>

            <div id="toast">Acción completada</div>
        `;

        this.container.appendChild(mainContainer);

        // Actualizar referencias a los elementos
        this.updateReferences();
        
        // Inicializar datos y gráficos
        this.initializeData();
        
        // Guardar referencia para los eventos
        window.instance = this;
    }

    updateReferences() {
        // Actualizar referencias a elementos del DOM
        this.sourceSelect = document.getElementById('sourceSelect');
        this.yearSelect = document.getElementById('yearSelect');
        this.hallazgosTableBody = document.getElementById('hallazgosTableBody');
        this.actionTableBody = document.getElementById('actionTableBody');
    }

    initializeData() {
        // Inicializar con datos predeterminados
        this.currentFindings = this.findingsBase[this.currentYear][this.currentSource];
        this.currentData = this.dataBase[this.currentYear][this.currentSource];
        
        // Renderizar tablas
        this.renderHallazgosTable();
        this.renderActionTable();
        
        // Dibujar gráficos
        this.drawCharts(this.currentYear, this.currentSource);
    }

    renderHallazgosTable() {
        if (!this.hallazgosTableBody) return;
        
        this.hallazgosTableBody.innerHTML = '';

        this.currentFindings.forEach(item => {
            const isCompliant = item.grade >= item.max;
            const rowClass = !isCompliant ? 'row-non-compliant' : '';
            
            const tr = document.createElement('tr');
            tr.className = rowClass;
            
            tr.innerHTML = `
                <td style="font-weight:600;">${item.code}</td>
                <td>${item.desc}</td>
                <td style="text-align:center; color:var(--text-muted);">${item.max}</td>
                <td style="text-align:center; font-weight:bold; color: ${!isCompliant ? 'var(--danger)' : 'var(--success)'};">${item.grade}</td>
                <td style="text-align:center;">
                    <span style="padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:600; background:${!isCompliant ? '#f8d7da' : '#d4edda'}; color:${!isCompliant ? '#721c24' : '#155724'};">
                        ${item.status}
                    </span>
                </td>
            `;
            this.hallazgosTableBody.appendChild(tr);
        });
    }

    renderActionTable() {
        if (!this.actionTableBody) return;
        
        this.actionTableBody.innerHTML = '';

        this.currentData.forEach(item => {
            const evidenceBtn = item.evidence 
                ? `<button class="btn-upload" style="border-style:solid; border-color:var(--success); color:var(--success);">📄 ${item.evidence}</button>`
                : `<button class="btn-upload" onclick="instance.handleEvidenceUpload(${item.id})">📎 Subir</button>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align:center;">
                    <div style="width:10px; height:10px; border-radius:50%; background: ${item.status === 'pending' ? 'var(--warning)' : item.status === 'progress' ? 'var(--primary)' : 'var(--success)'};"></div>
                </td>
                <td>${item.finding}</td>
                <td style="font-weight:600;">${item.action}</td>
                <td>${item.responsible}</td>
                <td>${item.deadline}</td>
                <td>
                    <select class="status-select ${item.status}" onchange="instance.updateStatus(${item.id}, this.value)">
                        <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                        <option value="progress" ${item.status === 'progress' ? 'selected' : ''}>En Progreso</option>
                        <option value="done" ${item.status === 'done' ? 'selected' : ''}>Completado</option>
                    </select>
                    <div style="margin-top:0.5rem;">${evidenceBtn}</div>
                </td>
                <td>
                    <input type="text" class="obs-input" placeholder="Observación..." value="${item.obs}" onchange="instance.saveObs(${item.id}, this.value)">
                </td>
            `;
            this.actionTableBody.appendChild(tr);
        });

        this.updateDashboardMetrics();
    }

    updateSource() {
        this.currentYear = document.getElementById('yearSelect').value;
        this.currentSource = document.getElementById('sourceSelect').value;
        
        // Actualizar Texto
        const sourceName = this.currentSource === 'ministerio' ? 'Ministerio de Trabajo' : 'Administradora de Riesgos Laborales (ARL)';
        document.getElementById('source-title').textContent = `${sourceName} - ${this.currentYear}`;

        // Cargar Datos de Hallazgos
        if (this.findingsBase[this.currentYear] && this.findingsBase[this.currentYear][this.currentSource]) {
            this.currentFindings = this.findingsBase[this.currentYear][this.currentSource];
        } else {
            this.currentFindings = [];
        }
        this.renderHallazgosTable();

        // Cargar Datos de Planes
        if (this.dataBase[this.currentYear] && this.dataBase[this.currentYear][this.currentSource]) {
            this.currentData = this.dataBase[this.currentYear][this.currentSource];
        } else {
            this.currentData = [];
        }
        this.renderActionTable();
        
        // Redibujar Gráficas
        this.drawCharts(this.currentYear, this.currentSource);
    }

    updateDashboardMetrics() {
        const pending = this.currentData.filter(i => i.status === 'pending').length;
        document.getElementById('kpi-gaps').textContent = this.currentData.length;
        document.getElementById('kpi-pending').textContent = pending;
    }

    updateStatus(id, newStatus) {
        const item = this.currentData.find(i => i.id === id);
        if(item) {
            item.status = newStatus;
            this.renderActionTable();
            this.showToast(`Estado actualizado`);
        }
    }

    saveObs(id, text) {
        const item = this.currentData.find(i => i.id === id);
        if(item) item.obs = text;
    }

    handleFileUpload(input) {
        if (input.files && input.files[0]) {
            const fileName = input.files[0].name;
            this.showToast(`Procesando ${fileName}...`);
        }
    }

    handleEvidenceUpload(id) {
        this.showToast(`Subiendo evidencia para ID ${id}`);
    }

    switchSection(sectionId, navElement) {
        document.querySelectorAll('.section-view').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        document.getElementById(sectionId).classList.add('active');
        navElement.classList.add('active');
    }

    showToast(msg) {
        const t = document.getElementById("toast");
        t.textContent = msg; 
        t.className = "show success";
        setTimeout(() => t.className = t.className.replace("show", ""), 3000);
    }

    // Funciones para dibujar gráficos
    drawGauge(canvasId, value) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h - 30;
        const r = Math.min(w, h) - 30;

        ctx.clearRect(0, 0, w, h);
        ctx.beginPath(); 
        ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI); 
        ctx.lineWidth = 20; 
        ctx.strokeStyle = '#e9ecef'; 
        ctx.stroke();

        const percentage = value / 100;
        const endAngle = Math.PI + (percentage * Math.PI);
        ctx.beginPath(); 
        ctx.arc(cx, cy, r, Math.PI, endAngle);
        ctx.strokeStyle = value > 85 ? '#28a745' : value > 60 ? '#ffc107' : '#dc3545'; 
        ctx.stroke();

        // Puntero
        ctx.save(); 
        ctx.translate(cx, cy); 
        ctx.rotate(endAngle);
        ctx.beginPath(); 
        ctx.moveTo(0, -5); 
        ctx.lineTo(r - 10, 0); 
        ctx.lineTo(0, 5); 
        ctx.fillStyle = '#212529'; 
        ctx.fill(); 
        ctx.restore();
        ctx.beginPath(); 
        ctx.arc(cx, cy, 8, 0, 2 * Math.PI); 
        ctx.fillStyle = '#212529'; 
        ctx.fill();
    }

    drawBullet(ctx, w, h, current, max, color) {
        ctx.clearRect(0, 0, w, h);
        const barHeight = 10; 
        const y = (h - barHeight) / 2;
        ctx.fillStyle = '#e9ecef'; 
        ctx.fillRect(0, y, w, barHeight);
        const currentWidth = (current / max) * w;
        ctx.fillStyle = color; 
        ctx.fillRect(0, y, currentWidth, barHeight);
    }

    drawCharts(year, source) {
        let score = 97;
        if(year === '2024') score = 85; 
        else if(source === 'arl') score = 90;
        
        this.drawGauge('gaugeChart', score);
        this.drawGauge('gaugeKpi', score);

        const ctxGaps = document.getElementById('bulletGaps');
        const ctxPending = document.getElementById('bulletPending');
        
        if (ctxGaps && ctxPending) {
            const gapsCtx = ctxGaps.getContext('2d');
            const pendingCtx = ctxPending.getContext('2d');
            
            this.drawBullet(gapsCtx, 200, 40, this.currentData.length, 10, '#dc3545');
            const pending = this.currentData.filter(i => i.status === 'pending').length;
            this.drawBullet(pendingCtx, 200, 40, pending, 5, '#ffc107');
        }
    }
}

// Añadir estilos CSS específicos para este módulo
const styleElement = document.createElement('style');
styleElement.textContent = `
    /* =========================================
       4. SISTEMA VISUAL OFICIAL (COHERENTE)
       ========================================= */
    :root {
        --primary: #174ea6;
        --primary-hover: #185abd;
        --success: #28a745;
        --warning: #ffc107;
        --danger: #dc3545;
        --info: #17a2b8;
        
        --bg-body: #f8f9fa;
        --bg-card: #ffffff;
        --border-color: #dee2e6;
        
        --font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        --text-dark: #212529;
        --text-muted: #6c757d;
        
        --radius: 0.375rem;
        --shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
        --shadow-md: 0 0.5rem 1rem rgba(0, 0, 0, 0.1);
    }

    .evaluacion-inicial-sg-sst * { 
        box-sizing: border-box; 
        margin: 0; 
        padding: 0; 
    }

    .evaluacion-inicial-sg-sst {
        font-family: var(--font-family);
        background-color: var(--bg-body);
        color: var(--text-dark);
        line-height: 1.5;
        font-size: 0.9rem;
        padding-top: 140px; 
    }

    /* =========================================
       HEADER GLOBAL
       ========================================= */
    header.global-header {
        position: fixed;
        top: 0; left: 0; width: 100%;
        background: white;
        border-bottom: 1px solid var(--border-color);
        z-index: 1000;
        box-shadow: var(--shadow-sm);
    }

    .header-top {
        height: 80px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 2rem;
        border-bottom: 1px solid #f0f0f0;
    }

    .main-title { 
        font-size: 1.4rem; 
        font-weight: 800; 
        color: var(--primary); 
    }
    .breadcrumb-context { 
        font-size: 0.9rem; 
        color: var(--text-muted); 
        font-weight: 500; 
    }

    .header-nav {
        background: #fdfdfd;
        display: flex;
        align-items: center;
        padding: 0 2rem;
        height: 50px;
    }

    .nav-item {
        padding: 0 1.5rem;
        height: 100%;
        display: flex;
        align-items: center;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--text-muted);
        border-bottom: 3px solid transparent;
        transition: all 0.2s;
    }
    .nav-item:hover { 
        color: var(--primary); 
        background: #f0f7ff; 
    }
    .nav-item.active { 
        color: var(--primary); 
        border-bottom-color: var(--primary); 
    }

    /* =========================================
       CONTENIDO PRINCIPAL
       ========================================= */
    .container-fluid { 
        max-width: 1400px; 
        margin: 0 auto; 
        padding: 2rem; 
    }
    .section-view { 
        display: none; 
        animation: fadeIn 0.3s ease; 
    }
    .section-view.active { 
        display: block; 
    }

    @keyframes fadeIn { 
        from { opacity: 0; transform: translateY(10px); } 
        to { opacity: 1; transform: translateY(0); } 
    }

    /* PANEL DE CONTROL */
    .control-panel {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
        padding: 1.5rem;
        margin-bottom: 2rem;
        box-shadow: var(--shadow-sm);
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1.5rem;
    }
    .control-group { 
        display: flex; 
        align-items: center; 
        gap: 1rem; 
    }
    .control-label { 
        font-weight: 700; 
        color: var(--text-muted); 
        font-size: 0.8rem; 
        text-transform: uppercase; 
        margin-right: 0.5rem; 
    }
    .ctx-select {
        padding: 0.6rem 1rem; 
        border: 1px solid var(--border-color); 
        border-radius: 4px;
        background: #f8f9fa; 
        font-size: 0.9rem; 
        font-weight: 600; 
        color: var(--text-dark);
        min-width: 160px; 
        cursor: pointer;
    }
    .ctx-select:focus { 
        outline: 2px solid var(--primary); 
        background: white; 
    }
    .file-upload-action { 
        font-size: 0.85rem; 
        color: var(--primary); 
        cursor: pointer; 
        text-decoration: underline; 
        font-weight: 600; 
    }

    /* COMPONENTES DE INTERFAZ */
    .section-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
        box-shadow: var(--shadow-sm);
        padding: 1.5rem;
        margin-bottom: 1.5rem;
    }
    .card-header {
        display: flex; 
        justify-content: space-between; 
        align-items: center;
        margin-bottom: 1.5rem; 
        padding-bottom: 1rem; 
        border-bottom: 1px solid var(--border-color);
    }
    .card-title { 
        font-size: 1.1rem; 
        font-weight: 700; 
        color: var(--text-dark); 
        display: flex; 
        align-items: center; 
        gap: 0.5rem; 
    }

    /* KPI Cards */
    .metrics-row { 
        display: grid; 
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); 
        gap: 1.5rem; 
        margin-bottom: 2rem; 
    }
    .metric-card {
        background: white; 
        border: 1px solid var(--border-color); 
        border-radius: var(--radius);
        padding: 1.25rem 1.5rem; 
        box-shadow: var(--shadow-sm); 
        display: flex; 
        flex-direction: column; 
        justify-content: space-between;
    }
    .metric-header { 
        display: flex; 
        justify-content: space-between; 
        align-items: start; 
        margin-bottom: 0.5rem; 
    }
    .metric-title { 
        font-size: 0.85rem; 
        text-transform: uppercase; 
        font-weight: 700; 
        color: var(--text-muted); 
    }
    .metric-value-group { 
        display: flex; 
        align-items: baseline; 
        gap: 0.5rem; 
        margin-bottom: 1rem; 
    }
    .metric-value { 
        font-size: 2.2rem; 
        font-weight: 700; 
        color: var(--text-dark); 
    }
    .metric-sub { 
        font-size: 0.85rem; 
        color: var(--text-muted); 
    }
    .chart-internal-container { 
        margin-top: auto; 
        height: 60px; 
        width: 100%; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        position: relative; 
    }

    /* Gráficas */
    .charts-row-large { 
        display: grid; 
        grid-template-columns: 1fr 1fr; 
        gap: 1.5rem; 
        margin-bottom: 2rem; 
    }
    .chart-card {
        background: white; 
        border: 1px solid var(--border-color); 
        border-radius: var(--radius);
        padding: 1.5rem; 
        display: flex; 
        flex-direction: column; 
        align-items: center; 
        box-shadow: var(--shadow-sm);
    }
    .chart-title { 
        font-size: 0.9rem; 
        font-weight: 700; 
        color: var(--text-muted); 
        text-transform: uppercase; 
        margin-bottom: 1rem; 
        text-align: center; 
    }

    /* Tablas Estándar */
    .table-wrapper { 
        width: 100%; 
        overflow-x: auto; 
        border: 1px solid var(--border-color); 
        border-radius: var(--radius); 
    }
    .k-table { 
        width: 100%; 
        border-collapse: collapse; 
        min-width: 1100px; 
        background: white; 
    }
    .k-table th {
        background: #f1f3f5; 
        text-align: left; 
        padding: 1rem;
        font-size: 0.8rem; 
        text-transform: uppercase; 
        color: var(--text-muted);
        border-bottom: 2px solid var(--border-color); 
        white-space: nowrap;
    }
    .k-table td { 
        padding: 1rem; 
        border-bottom: 1px solid var(--border-color); 
        vertical-align: middle; 
        font-size: 0.9rem; 
    }
    .k-table tr:hover { 
        background-color: #f8f9fa; 
    }
    
    /* Filas No Cumplen */
    .row-non-compliant { 
        background-color: rgba(220, 53, 69, 0.05); 
        border-left: 4px solid var(--danger); 
    }
    .k-table tbody tr.row-non-compliant:hover { 
        background-color: rgba(220, 53, 69, 0.1); 
    }

    /* Estilos Planes */
    .status-select { 
        padding: 0.4rem; 
        border-radius: 4px; 
        border: 1px solid var(--border-color); 
        font-size: 0.85rem; 
        background: white; 
        cursor: pointer; 
    }
    .status-select.pending { 
        background: #fff3cd; 
        border-color: #ffeeba; 
        color: #856404; 
    }
    .status-select.progress { 
        background: #cce5ff; 
        border-color: #b8daff; 
        color: #004085; 
    }
    .status-select.done { 
        background: #d4edda; 
        border-color: #c3e6cb; 
        color: #155724; 
    }

    .obs-input { 
        width: 100%; 
        padding: 0.5rem; 
        border: 1px solid var(--border-color); 
        border-radius: 4px; 
        font-size: 0.9rem; 
        font-family: inherit; 
        background: #fdfdfd; 
    }
    .obs-input:focus { 
        background: white; 
        outline: 2px solid var(--primary); 
    }

    .btn-upload { 
        display: inline-flex; 
        align-items: center; 
        gap: 0.5rem; 
        padding: 0.4rem 0.8rem; 
        border: 1px dashed var(--border-color); 
        border-radius: 4px; 
        background: #fdfdfd; 
        cursor: pointer; 
        font-size: 0.85rem; 
        color: var(--text-muted); 
        transition: 0.2s; 
    }
    .btn-upload:hover { 
        border-color: var(--primary); 
        color: var(--primary); 
    }

    /* Toast */
    #toast { 
        visibility: hidden; 
        min-width: 250px; 
        background-color: #333; 
        color: #fff; 
        text-align: center; 
        border-radius: 4px; 
        padding: 16px; 
        position: fixed; 
        z-index: 2000; 
        bottom: 30px; 
        right: 30px; 
        opacity: 0; 
        transition: opacity 0.5s; 
    }
    #toast.show { 
        visibility: visible; 
        opacity: 1; 
    }
    #toast.success { 
        background-color: var(--success); 
    }
`;

// Agregar los estilos al head
document.head.appendChild(styleElement);

// Hacer la clase disponible globalmente
window.EvaluacionInicialSgSst = EvaluacionInicialSgSst;