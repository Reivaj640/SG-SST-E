// comite-convivencia-logic.js - Componente para el submódulo "1.1.8 Conformación de Comite de Convivencia"
// UX/UI Pattern: Portal de Submódulo (K+AIR Standard)

class ComiteConvivenciaComponent {
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
        
        // Inyección de Estilos del Portal (Twin of Copasst)
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
                    <i class="fas fa-balance-scale"></i> Comité de Convivencia Laboral Activo
                </div>

                <h1 class="hero-title">Comité de Convivencia</h1>
                <p class="hero-subtitle">
                    Espacio para la gestión de actas, protocolos de prevención de acoso laboral y seguimiento a compromisos del CCL.
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
                                <p>Registrar acta de reunión del CCL usando la plantilla oficial para auditorías.</p>
                            </div>
                        </div>

                        <!-- OPCIÓN: PROTOCOLOS -->
                        <div class="action-card" onclick="alert('Abriendo Protocolo de Prevención...')">
                            <div class="action-icon">
                                <i class="fas fa-book-medical"></i>
                            </div>
                            <div class="action-info">
                                <h4>Protocolo de Prevención</h4>
                                <p>Consultar los procedimientos establecidos para la prevención del acoso laboral.</p>
                            </div>
                        </div>

                        <!-- OPCIÓN: NORMATIVA -->
                        <div class="action-card" onclick="alert('Cargando Ley 1010 y Res. 652...')">
                            <div class="action-icon" style="color: #ffc107;">
                                <i class="fas fa-gavel"></i>
                            </div>
                            <div class="action-info">
                                <h4>Marco Normativo CCL</h4>
                                <p>Acceso rápido a la Resolución 652 de 2012 y normatividad relacionada.</p>
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

    // --- MÉTODOS DE FUNCIONALIDAD (GEMELOS DE LÓGICA) ---

    showVerActasPage() {
        this.container.innerHTML = '';
        window.addEventListener('message', this.handleIframeMessage);
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        const viewerUrl = `modules/recursos/comite-convivencia/comite-convivencia-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
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

        const wrapper = document.createElement('div');
        wrapper.className = 'convivencia-actas-container';
        wrapper.style.cssText = 'display:flex; flex-direction:column; height:100%; overflow:hidden;';

        const header = document.createElement('header');
        header.className = 'kair-header';
        header.innerHTML = `
<div class="kair-header__bar">
    <div class="kair-header__left">
        <button class="kair-header__back" id="btn-back-portal" title="Volver al Portal Comité de Convivencia">
            <i class="bi bi-arrow-left"></i>
        </button>
    </div>
    <div class="kair-header__divider"></div>
    <div class="kair-header__center">
        <h1 class="kair-header__title">
            <i class="bi bi-file-earmark-text"></i>
            Generador de Actas Convivencia
        </h1>
        <ol class="kair-header__breadcrumb">
            <li><a href="#" onclick="return false;">Recursos</a></li>
            <li><a href="#" onclick="return false;">Comité de Convivencia</a></li>
            <li class="kair-header__breadcrumb--active">1.1.8 Generador de Actas</li>
        </ol>
    </div>
    <div class="kair-header__right">
        <span class="kair-header__company">
            <i class="bi bi-building"></i>
            <span id="header-company-text">${this.currentCompany || '—'}</span>
        </span>
        <div class="kair-header__divider"></div>
        <button class="kair-header__action--ghost" id="btn-save-draft-header" title="Guardar borrador">
            <i class="bi bi-save"></i> Guardar
        </button>
        <button class="kair-header__action--ghost" id="btn-export-excel-header" title="Exportar a Excel">
            <i class="bi bi-file-earmark-excel"></i> Exportar
        </button>
    </div>
</div>
`;
        wrapper.appendChild(header);

        const editorContainer = document.createElement('div');
        editorContainer.className = 'acta-editor-container';
        editorContainer.style.cssText = 'flex:1; overflow-y:auto;';

        const style = document.createElement('style');
        style.textContent = `
.convivencia-actas-container .kair-header { background: #ffffff; border-bottom: 1px solid #dee2e6; flex-shrink: 0; position: sticky; top: 0; z-index: 100; }
.convivencia-actas-container .kair-header__bar { display: flex; align-items: center; justify-content: flex-start; gap: 0.75rem; min-height: 52px; padding: 0 1.5rem; }
.convivencia-actas-container .kair-header__left { display: flex; align-items: center; gap: 0.5rem; }
.convivencia-actas-container .kair-header__back { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; color: #5a6378; border-radius: 0.375rem; cursor: pointer; transition: background 0.15s ease; font-size: 1rem; }
.convivencia-actas-container .kair-header__back:hover { background: #e8f0fe; color: #174ea6; }
.convivencia-actas-container .kair-header__divider { width: 1px; height: 24px; background: #dee2e6; }
.convivencia-actas-container .kair-header__center { display: flex; flex-direction: column; gap: 0.125rem; }
.convivencia-actas-container .kair-header__title { font-size: 1.25rem; font-weight: 600; color: #1a1a2e; margin: 0; display: flex; align-items: center; gap: 0.5rem; }
.convivencia-actas-container .kair-header__title i { color: #174ea6; }
.convivencia-actas-container .kair-header__breadcrumb { display: flex; align-items: center; gap: 0.375rem; list-style: none; margin: 0; padding: 0; font-size: 0.8125rem; font-weight: 400; color: #5a6378; }
.convivencia-actas-container .kair-header__breadcrumb li + li::before { content: '›'; margin-right: 0.375rem; color: #adb5bd; }
.convivencia-actas-container .kair-header__breadcrumb a { color: #5a6378; text-decoration: none; }
.convivencia-actas-container .kair-header__breadcrumb a:hover { color: #174ea6; }
.convivencia-actas-container .kair-header__breadcrumb--active { color: #174ea6; font-weight: 500; }
.convivencia-actas-container .kair-header__right { display: flex; align-items: center; gap: 0.75rem; margin-left: auto; }
.convivencia-actas-container .kair-header__company { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; font-weight: 400; color: #5a6378; }
.convivencia-actas-container .kair-header__company i { font-size: 0.875rem; }
.convivencia-actas-container .kair-header__action--ghost { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; font-size: 0.8125rem; font-weight: 500; color: #5a6378; background: transparent; border: none; border-radius: 0.375rem; cursor: pointer; transition: background 0.15s ease; }
.convivencia-actas-container .kair-header__action--ghost:hover { background: #f0f2f5; color: #1a1a2e; }

.convivencia-actas-container[data-theme="dark"] .kair-header { background: var(--k-bg-card, #2d3748); border-bottom-color: var(--k-border, #4a5568); }
.convivencia-actas-container[data-theme="dark"] .kair-header__title { color: #e9ecef; }
.convivencia-actas-container[data-theme="dark"] .kair-header__breadcrumb, .convivencia-actas-container[data-theme="dark"] .kair-header__breadcrumb a { color: #adb5bd; }
.convivencia-actas-container[data-theme="dark"] .kair-header__breadcrumb--active { color: var(--k-primary, #4da6ff); }
.convivencia-actas-container[data-theme="dark"] .kair-header__company { color: #adb5bd; }
.convivencia-actas-container[data-theme="dark"] .kair-header__divider { background: var(--k-border, #4a5568); }
.convivencia-actas-container[data-theme="dark"] .kair-header__back { color: #adb5bd; }
.convivencia-actas-container[data-theme="dark"] .kair-header__back:hover { background: rgba(77, 166, 255, 0.15); color: var(--k-primary, #4da6ff); }
.convivencia-actas-container[data-theme="dark"] .kair-header__action--ghost { color: #adb5bd; }
.convivencia-actas-container[data-theme="dark"] .kair-header__action--ghost:hover { background: rgba(255, 255, 255, 0.08); color: #e9ecef; }

@media (max-width: 768px) {
    .convivencia-actas-container .kair-header__bar { flex-wrap: wrap; gap: 0.5rem; padding: 0.75rem 1rem; min-height: auto; }
    .convivencia-actas-container .kair-header__right { width: 100%; justify-content: flex-end; margin-left: 0; }
}

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
        wrapper.appendChild(style);

        editorContainer.innerHTML = `
            <div class="acta-form-wrapper">
                <section class="acta-card">
                    <h2 class="acta-card-title">Información de la Reunión</h2>
                    <div class="acta-form-grid">
                        <div class="acta-form-group"><label>N° de Acta</label><input type="number" id="acta-number" value="001"></div>
                        <div class="acta-form-group"><label>Fecha</label><input type="date" id="fecha" value="${new Date().toISOString().split('T')[0]}"></div>
                        <div class="acta-form-group"><label>Hora Inicio</label><input type="time" id="inicia" value="08:00"></div>
                        <div class="acta-form-group"><label>Hora Fin</label><input type="time" id="termina" value="09:00"></div>
                        <div class="acta-form-group full-width"><label>Tema</label><input type="text" id="topic" value="Reunión del Comité de Convivencia Laboral"></div>
                        <div class="acta-form-group full-width"><label>Lugar</label><input type="text" id="ciudad-lugar" value="Barranquilla, Oficinas"></div>
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
        wrapper.appendChild(editorContainer);
        this.container.appendChild(wrapper);

        document.getElementById('btn-back-portal').onclick = () => this.render();

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
            div.innerHTML = `<div class="acta-form-group"><label>Temas Tratados</label><textarea class="in-tema" rows="4">${data.tema || ''}</textarea></div>
                <div class="acta-form-group"><label>Compromisos</label><textarea class="in-compromisos" rows="2">${data.compromisos || ''}</textarea></div>
                <div class="acta-form-grid" style="margin-top:10px;">
                    <div class="acta-form-group"><label>Fecha</label><input type="date" class="in-fecha" value="${data.fecha || ''}"></div>
                    <div class="acta-form-group"><label>Responsable</label><input type="text" class="in-responsable" value="${data.responsable || ''}"></div>
                </div><button class="acta-btn-remove">✕</button>`;
            div.querySelector('.acta-btn-remove').onclick = () => div.remove();
            return div;
        };

        const initialAgenda = [{ tema: 'Verificación del Quórum', duracion: '00:10 Minutos', lider: 'Representante del Comité' }, { tema: 'Saludos e inicio de reunión', duracion: '00:10 Minutos', lider: 'Representante del Comité' }, { tema: 'Programa de bienestar y Temas Varios', duracion: '00:30 Minutos', lider: 'Representante del Comité' }];
        const initialDesarrollo = [{ tema: 'Verificación del Quórum', compromisos: 'Ninguno', responsable: 'Presidente del Comité' }, { tema: 'Temas Varios: Se revisan la existencia de solicitudes...', compromisos: 'Solicitar a la profesional de la ARL...', responsable: 'Presidente del Comité' }];

        initialAgenda.forEach(d => agendaList.appendChild(createAgendaItem(d)));
        initialDesarrollo.forEach(d => desarrolloList.appendChild(createDesarrolloItem(d)));
        document.getElementById('add-agenda-btn').onclick = () => agendaList.appendChild(createAgendaItem());
        document.getElementById('add-desarrollo-btn').onclick = () => desarrolloList.appendChild(createDesarrolloItem());
        document.getElementById('save-draft-btn').onclick = () => alert('Borrador guardado');
        document.getElementById('export-excel-btn').onclick = () => this.handleExportExcel();
        document.getElementById('btn-save-draft-header').onclick = () => alert('Borrador guardado');
        document.getElementById('btn-export-excel-header').onclick = () => this.handleExportExcel();
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
            const savePath = await window.electronAPI.showSaveDialog({ title: 'Guardar Acta de Convivencia', defaultPath: `ACTA_CONVIVENCIA_${data.fecha}.xlsx`, filters: [{ name: 'Archivos de Excel', extensions: ['xlsx'] }] });
            if (!savePath) return;
            const result = await window.electronAPI.generateConvivenciaActa(changes, savePath);
            if (result.success) alert(`Acta generada en: ${result.documentPath}`);
            else alert(`Error: ${result.error}`);
        } catch (error) { alert(`Error: ${error.message}`); }
    }

    prepareExcelChanges(data) {
        const changes = [];
        changes.push({ row: 6, col: 4, value: data.actaNumber }, { row: 7, col: 4, value: data.topic }, { row: 9, col: 4, value: data.fecha }, { row: 10, col: 4, value: data.lugar }, { row: 11, col: 4, value: data.inicia }, { row: 12, col: 6, value: data.termina });
        let row = 26;
        data.agendaItems.forEach(item => {
            changes.push({ row: row, col: 3, value: item.tema }, { row: row, col: 5, value: item.duracion }, { row: row, col: 6, value: item.lider });
            row++;
        });
        row += 4;
        data.desarrolloItems.forEach((item, idx) => {
            changes.push({ row: row, col: 1, value: idx + 1 }, { row: row, col: 2, value: item.tema }, { row: row, col: 4, value: item.compromisos }, { row: row, col: 6, value: item.fecha }, { row: row, col: 7, value: item.responsable });
            row++;
        });
        return changes;
    }

    updateHeaderContext() {
        const companyText = document.getElementById('header-company-text');
        if (companyText) {
            companyText.textContent = this.currentCompany || '—';
        }
    }

    destroy() {
        window.removeEventListener('message', this.handleIframeMessage);
        this.container.innerHTML = '';
    }
}

window.ComiteConvivenciaComponent = ComiteConvivenciaComponent;