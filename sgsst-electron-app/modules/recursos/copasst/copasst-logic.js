// copasst-logic.js - Componente para el submódulo "1.1.6 Conformación de Copasst"
// UX/UI Pattern: Portal de Submódulo (K+AIR Standard)

class CopasstComponent {
    constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
        this.container = container;
        this.currentCompany = companyName;
        this.companyName = companyName;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBackToModuleHome = onBackToModuleHome;
        
        this.handleIframeMessage = this.handleIframeMessage.bind(this);
    }

    render() {
        this.container.innerHTML = '';
        
        // Inyección de Estilos del Portal (Scrutinized by UI Architect)
        const style = document.createElement('style');
        style.textContent = `
            .portal-container {
                background-color: #f8f9fa;
                min-height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 3rem 2rem;
                font-family: 'Roboto', sans-serif;
                overflow-y: auto;
            }
            .portal-card {
                background: white;
                width: 100%;
                max-width: 950px;
                border-radius: 0.75rem;
                box-shadow: 0 15px 35px rgba(0,0,0,0.05);
                padding: 4rem 3rem;
                text-align: center;
                border: 1px solid #dee2e6;
                animation: portalFadeIn 0.5s ease-out;
            }
            @keyframes portalFadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .status-pill {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 20px;
                border-radius: 50px;
                background: #e8f0fe;
                color: #174ea6;
                font-size: 0.85rem;
                font-weight: 600;
                margin-bottom: 2rem;
                border: 1px solid #c2d7ff;
            }
            .hero-title {
                font-family: 'Lexend', sans-serif;
                font-size: 2.8rem;
                color: #212529;
                margin-bottom: 1rem;
                font-weight: 600;
            }
            .hero-subtitle {
                color: #6c757d;
                font-size: 1.15rem;
                margin-bottom: 3rem;
                max-width: 650px;
                margin-left: auto;
                margin-right: auto;
                line-height: 1.6;
            }
            .main-action-btn {
                display: inline-flex;
                align-items: center;
                gap: 12px;
                padding: 1.2rem 3rem;
                font-size: 1.2rem;
                font-weight: 600;
                background-color: #174ea6;
                color: white;
                border: none;
                border-radius: 50px;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 8px 20px rgba(23, 78, 166, 0.25);
                margin-bottom: 4rem;
            }
            .main-action-btn:hover {
                background-color: #185abd;
                transform: translateY(-3px);
                box-shadow: 0 12px 25px rgba(23, 78, 166, 0.35);
            }
            .quick-actions-section {
                text-align: left;
                border-top: 1px solid #f1f3f5;
                padding-top: 3rem;
            }
            .section-label {
                font-size: 0.9rem;
                font-weight: 700;
                text-transform: uppercase;
                color: #adb5bd;
                letter-spacing: 1.5px;
                margin-bottom: 2rem;
                display: block;
            }
            .actions-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: 1.5rem;
            }
            .action-card {
                background: #ffffff;
                border: 1px solid #dee2e6;
                border-radius: 0.6rem;
                padding: 1.5rem;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 20px;
            }
            .action-card:hover {
                border-color: #174ea6;
                background: #f8fbff;
                transform: translateY(-4px);
                box-shadow: 0 10px 20px rgba(0,0,0,0.06);
            }
            .action-icon {
                width: 50px;
                height: 50px;
                background: #f1f3f5;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #174ea6;
                font-size: 1.4rem;
                transition: all 0.2s;
            }
            .action-card:hover .action-icon {
                background: #174ea6;
                color: white;
            }
            .action-info h4 {
                font-size: 1rem;
                font-weight: 600;
                margin-bottom: 4px;
                color: #212529;
            }
            .action-info p {
                font-size: 0.85rem;
                color: #6c757d;
                margin: 0;
                line-height: 1.4;
            }
            .back-nav {
                width: 100%;
                max-width: 950px;
                margin-bottom: 1.5rem;
                display: flex;
            }
            .btn-back-portal {
                background: transparent;
                border: none;
                color: #6c757d;
                cursor: pointer;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 0.95rem;
                transition: color 0.2s;
            }
            .btn-back-portal:hover { color: #174ea6; }
        `;
        this.container.appendChild(style);

        const portalContainer = document.createElement('div');
        portalContainer.className = 'portal-container';

        portalContainer.innerHTML = `
            <nav class="back-nav">
                <button class="btn-back-portal" id="portalBackBtn">
                    <i class="fas fa-chevron-left"></i> Volver al Módulo Principal
                </button>
            </nav>

            <div class="portal-card">
                <div class="status-pill">
                    <i class="fas fa-shield-alt"></i> Comité Paritario de SST Vigente
                </div>

                <h1 class="hero-title">Gestión del COPASST</h1>
                <p class="hero-subtitle">
                    Portal centralizado para la administración documental, registro de actas mensuales y seguimiento normativo del comité paritario.
                </p>

                <!-- ACCIÓN MAESTRA -->
                <button class="main-action-btn" id="portalExploreBtn">
                    <i class="fas fa-folder-open"></i> Explorar Repositorio de Actas
                </button>

                <div class="quick-actions-section">
                    <span class="section-label">Herramientas y Operaciones</span>
                    
                    <div class="actions-grid">
                        <!-- OPCIÓN: REALIZAR ACTA -->
                        <div class="action-card" id="portalCreateBtn">
                            <div class="action-icon" style="color: #28a745;">
                                <i class="fas fa-file-signature"></i>
                            </div>
                            <div class="action-info">
                                <h4>Realizar Nueva Acta</h4>
                                <p>Generar acta de reunión mensual utilizando la plantilla oficial en Excel.</p>
                            </div>
                        </div>

                        <!-- OPCIÓN: MIEMBROS -->
                        <div class="action-card" onclick="alert('Funcionalidad: Gestión de Miembros')">
                            <div class="action-icon">
                                <i class="fas fa-users-cog"></i>
                            </div>
                            <div class="action-info">
                                <h4>Miembros y Roles</h4>
                                <p>Consultar y actualizar la lista de representantes de la empresa y trabajadores.</p>
                            </div>
                        </div>

                        <!-- OPCIÓN: NORMATIVA -->
                        <div class="action-card" onclick="alert('Cargando base legal COPASST...')">
                            <div class="action-icon" style="color: #ffc107;">
                                <i class="fas fa-balance-scale"></i>
                            </div>
                            <div class="action-info">
                                <h4>Marco Normativo</h4>
                                <p>Acceso rápido a la Resolución 2013 de 1986 y normatividad vigente.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container.appendChild(portalContainer);

        // Listeners de Navegación
        document.getElementById('portalBackBtn').onclick = () => this.onBackToModuleHome();
        document.getElementById('portalExploreBtn').onclick = () => this.showVerActasPage();
        document.getElementById('portalCreateBtn').onclick = () => this.showRealizarActasInterface();
        
        window.removeEventListener('message', this.handleIframeMessage);
    }

    // --- MÉTODOS DE FUNCIONALIDAD (SIN CAMBIOS EN LÓGICA INTERNA) ---

    showVerActasPage() {
        this.container.innerHTML = '';
        window.addEventListener('message', this.handleIframeMessage);
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        const viewerUrl = `modules/recursos/copasst/copasst-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        iframe.src = viewerUrl;
        this.container.appendChild(iframe);
    }

    handleIframeMessage(event) {
        if (!event.data || !event.data.type) return;
        if (event.data.type.endsWith('-request')) {
            const action = event.data.type.replace('-request', '');
            if (action === 'back-to-module') {
                window.removeEventListener('message', this.handleIframeMessage);
                this.render();
            } else {
                this.handleStandardRequest(event, this.getApiMap()[action]);
            }
        }
    }

    getApiMap() {
        return {
            'get-document-folders': 'getDocumentFolders',
            'get-documents-in-folder': 'getDocumentsInFolder',
            'get-pdf-preview': 'getPDFPreview',
            'get-word-preview': 'getWordPreview',
            'get-excel-preview': 'getExcelPreview',
            'download-document': 'downloadDocument'
        };
    }

    async handleStandardRequest(event, apiFunctionName) {
        const { requestId, payload } = event.data;
        try {
            const apiArgs = (payload && payload.filePath) ? payload.filePath : payload;
            const result = await window.electronAPI[apiFunctionName](apiArgs);
            event.source.postMessage({
                type: `${event.data.type.replace('-request', '')}-response`,
                requestId,
                payload: {
                    success: result.success,
                    data: result.data || result, 
                    files: result.files, 
                    folders: result.folders,
                    basePath: result.basePath,
                    fileName: result.fileName,
                    base64Data: result.base64Data,
                    error: result.error
                }
            }, '*');
        } catch (error) {
            event.source.postMessage({
                type: `${event.data.type.replace('-request', '')}-response`,
                requestId,
                payload: { success: false, error: error.message }
            }, '*');
        }
    }

    showRealizarActasInterface() {
        this.container.innerHTML = '';
        const header = document.createElement('div');
        header.className = 'submodule-header';
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.marginBottom = '20px';
        header.style.padding = '10px';
        header.style.backgroundColor = '#f8f9fa';
        header.style.borderBottom = '1px solid #dee2e6';

        const backBtn = document.createElement('button');
        backBtn.innerHTML = '&#8592; Volver al Portal';
        backBtn.className = 'btn btn-secondary';
        backBtn.onclick = () => this.render();
        
        const title = document.createElement('h3');
        title.textContent = 'Generador de Actas COPASST';
        title.style.flexGrow = '1';
        title.style.textAlign = 'center';
        title.style.margin = '0';

        header.appendChild(backBtn);
        header.appendChild(title);
        this.container.appendChild(header);

        const editorContainer = document.createElement('div');
        editorContainer.className = 'acta-editor-container';

        const style = document.createElement('style');
        style.textContent = `
            :root { --primary-color: #206A5D; --primary-hover-color: #1A564B; --bg-color: #f8f9fa; --widget-bg-color: #ffffff; --border-color: #dee2e6; }
            .acta-form-wrapper { font-family: 'Poppins', sans-serif; color: #212529; background: var(--bg-color); padding: 2rem 1.5rem; max-width: 1100px; margin: 0 auto; }
            .acta-card { background: white; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 2px 4px rgba(0,0,0,0.05); padding: 2rem; margin-bottom: 2rem; }
            .acta-card-title { font-size: 1.5rem; font-weight: 600; margin-top: 0; margin-bottom: 1.5rem; color: #495057; border-bottom: 2px solid var(--primary-color); padding-bottom: 0.5rem; }
            .acta-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
            .acta-form-group { display: flex; flex-direction: column; }
            .acta-form-group.full-width { grid-column: 1 / -1; }
            .acta-form-group label { font-size: 0.9rem; font-weight: 500; color: #6c757d; margin-bottom: 0.5rem; }
            .acta-form-group input, .acta-form-group textarea { padding: 0.5rem 0.75rem; border: 1px solid var(--border-color); border-radius: 4px; }
            .acta-dynamic-item { background: #f8f9fa; border: 1px solid var(--border-color); border-radius: 6px; padding: 1.5rem; margin-bottom: 1rem; position: relative; }
            .acta-btn-add { width: 100%; padding: 0.75rem; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }
            .acta-btn-remove { position: absolute; top: 10px; right: 10px; background: #dc3545; color: white; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; }
            .acta-footer { display: flex; justify-content: center; gap: 1.5rem; margin-top: 2rem; }
            .acta-btn-action { padding: 0.75rem 1.5rem; border-radius: 4px; cursor: pointer; font-weight: 500; border: 1px solid transparent; }
            .acta-btn-primary { background: var(--primary-color); color: white; }
            .acta-btn-secondary { background: white; color: #212529; border-color: var(--border-color); }
        `;
        this.container.appendChild(style);

        editorContainer.innerHTML = `
            <div class="acta-form-wrapper">
                <section class="acta-card">
                    <h2 class="acta-card-title">Información de la Reunión</h2>
                    <div class="acta-form-grid">
                        <div class="acta-form-group"><label>N° de Acta</label><input type="number" id="acta-number" value="108"></div>
                        <div class="acta-form-group"><label>Fecha</label><input type="date" id="fecha" value="${new Date().toISOString().split('T')[0]}"></div>
                        <div class="acta-form-group"><label>Hora Inicio</label><input type="time" id="inicia" value="08:00"></div>
                        <div class="acta-form-group"><label>Hora Fin</label><input type="time" id="termina" value="09:00"></div>
                        <div class="acta-form-group full-width"><label>Tema</label><input type="text" id="topic" value="Reunión del COPASST"></div>
                        <div class="acta-form-group full-width"><label>Lugar</label><input type="text" id="ciudad-lugar" value="Barranquilla, Oficinas Tempoactiva"></div>
                    </div>
                </section>
                <section class="acta-card">
                    <h2 class="acta-card-title">Agenda de la Reunión</h2>
                    <div id="agenda-list"></div>
                    <button class="acta-btn-add" id="add-agenda-btn">+ Agregar tema</button>
                </section>
                <section class="acta-card">
                    <h2 class="acta-card-title">Desarrollo y Compromisos</h2>
                    <div id="desarrollo-list"></div>
                    <button class="acta-btn-add" id="add-desarrollo-btn">+ Agregar punto tratado</button>
                </section>
                <div class="acta-footer">
                    <button class="acta-btn-action acta-btn-secondary" id="save-draft-btn">Guardar Borrador</button>
                    <button class="acta-btn-action acta-btn-primary" id="export-excel-btn">Exportar a Excel</button>
                </div>
            </div>
        `;
        this.container.appendChild(editorContainer);
        const agendaList = document.getElementById('agenda-list');
        const desarrolloList = document.getElementById('desarrollo-list');

        const createAgendaItem = (data = {}) => {
            const div = document.createElement('div');
            div.className = 'acta-dynamic-item';
            div.innerHTML = `<div class="acta-form-grid">
                <div class="acta-form-group" style="grid-column: span 2"><label>Tema</label><input type="text" class="in-tema" value="${data.tema || ''}"></div>
                <div class="acta-form-group"><label>Duración</label><input type="text" class="in-duracion" value="${data.duracion || ''}"></div>
                <div class="acta-form-group"><label>Líder</label><input type="text" class="in-lider" value="${data.lider || ''}"></div>
            </div><button class="acta-btn-remove">✕</button>`;
            div.querySelector('.acta-btn-remove').onclick = () => div.remove();
            return div;
        };

        const createDesarrolloItem = (data = {}) => {
            const div = document.createElement('div');
            div.className = 'acta-dynamic-item';
            div.innerHTML = `<div class="acta-form-group"><label>Temas Tratados</label><textarea class="in-tema" rows="9">${data.tema || ''}</textarea></div>
                <div class="acta-form-group"><label>Compromisos</label><textarea class="in-compromisos" rows="5">${data.compromisos || ''}</textarea></div>
                <div class="acta-form-grid" style="margin-top:10px;">
                    <div class="acta-form-group"><label>Fecha</label><input type="date" class="in-fecha" value="${data.fecha || ''}"></div>
                    <div class="acta-form-group"><label>Responsable</label><input type="text" class="in-responsable" value="${data.responsable || ''}"></div>
                </div><button class="acta-btn-remove">✕</button>`;
            div.querySelector('.acta-btn-remove').onclick = () => div.remove();
            return div;
        };

        const initialAgenda = [{ tema: 'Revisión del acta anterior N° 107', duracion: '00:10 Minutos', lider: 'Representante del Copasst' }, { tema: 'Revisión de Accidentes del Mes de Diciembre', duracion: '00:10 Minutos', lider: 'Representante del Copasst' }, { tema: 'Revisión Avance del Plan de Trabajo Anual', duracion: '00:30 Minutos', lider: 'Representante del Copasst' }];
        const initialDesarrollo = [{ tema: 'Revisión del Acta Anterior, se continúan realizando las inspecciones programadas...', compromisos: 'Ninguno', responsable: 'Ninguno' }, { tema: 'Accidente laboral de Armando Cervantes Perez', compromisos: 'Realizar seguimiento del plan de acción del AT.', responsable: 'Miembros del Copasst y Asesor SST' }];

        initialAgenda.forEach(d => agendaList.appendChild(createAgendaItem(d)));
        initialDesarrollo.forEach(d => desarrolloList.appendChild(createDesarrolloItem(d)));
        document.getElementById('add-agenda-btn').onclick = () => agendaList.appendChild(createAgendaItem());
        document.getElementById('add-desarrollo-btn').onclick = () => desarrolloList.appendChild(createDesarrolloItem());
        document.getElementById('save-draft-btn').onclick = () => alert('Borrador guardado');
        document.getElementById('export-excel-btn').onclick = () => this.handleExportExcel();
    }

    async handleExportExcel() {
        const data = {
            actaNumber: document.getElementById('acta-number').value,
            fecha: document.getElementById('fecha').value,
            inicia: document.getElementById('inicia').value,
            termina: document.getElementById('termina').value,
            topic: document.getElementById('topic').value,
            lugar: document.getElementById('ciudad-lugar').value,
            agendaItems: [], desarrolloItems: []
        };
        document.querySelectorAll('#agenda-list .acta-dynamic-item').forEach(item => {
            data.agendaItems.push({ tema: item.querySelector('.in-tema').value, duracion: item.querySelector('.in-duracion').value, lider: item.querySelector('.in-lider').value });
        });
        document.querySelectorAll('#desarrollo-list .acta-dynamic-item').forEach(item => {
            data.desarrolloItems.push({ tema: item.querySelector('.in-tema').value, compromisos: item.querySelector('.in-compromisos').value, fecha: item.querySelector('.in-fecha').value, responsable: item.querySelector('.in-responsable').value });
        });
        const changes = this.prepareExcelChanges(data);
        try {
            const savePath = await window.electronAPI.showSaveDialog({ title: 'Guardar Acta de COPASST', defaultPath: `ACTA_COPASST_${data.fecha}.xlsx`, filters: [{ name: 'Archivos de Excel', extensions: ['xlsx'] }] });
            if (!savePath) return;
            const result = await window.electronAPI.generateCopasstActa(changes, savePath);
            if (result.success) alert(`Acta generada en: ${result.documentPath}`);
            else alert(`Error: ${result.error}`);
        } catch (error) { alert(`Error: ${error.message}`); }
    }

    prepareExcelChanges(data) {
        const changes = [];
        changes.push({ row: 4, col: 6, value: data.actaNumber }, { row: 5, col: 6, value: data.topic }, { row: 7, col: 6, value: data.fecha }, { row: 8, col: 6, value: data.lugar }, { row: 9, col: 6, value: data.inicia }, { row: 10, col: 6, value: data.termina });
        let row = 25;
        data.agendaItems.forEach(item => {
            changes.push({ row: row, col: 3, value: item.tema }, { row: row, col: 5, value: item.duracion }, { row: row, col: 6, value: item.lider });
            row++;
        });
        row += 5;
        data.desarrolloItems.forEach((item, idx) => {
            changes.push({ row: row, col: 1, value: idx + 1 }, { row: row, col: 2, value: item.tema }, { row: row, col: 4, value: item.compromisos }, { row: row, col: 6, value: item.fecha }, { row: row, col: 7, value: item.responsable });
            row++;
        });
        return changes;
    }

    destroy() {
        window.removeEventListener('message', this.handleIframeMessage);
        this.container.innerHTML = '';
    }
}

window.CopasstComponent = CopasstComponent;