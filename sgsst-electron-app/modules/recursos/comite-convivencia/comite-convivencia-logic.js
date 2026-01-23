// comite-convivencia-logic.js - Componente para el submódulo "1.1.8 Conformación de Comite de Convivencia"

class ComiteConvivenciaComponent {
    constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
        this.container = container;
        this.currentCompany = companyName; // Normalizando nombres
        this.companyName = companyName;    // Compatibilidad
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBackToModuleHome = onBackToModuleHome; // Callback para volver al home
        
        // Bindings
        this.handleIframeMessage = this.handleIframeMessage.bind(this);
    }

    render() {
        this.container.innerHTML = '';
        
        // Título y botón volver
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '20px';

        const title = document.createElement('h2');
        title.textContent = this.submoduleName;
        title.style.margin = '0';
        header.appendChild(title);

        const backButton = document.createElement('button');
        backButton.className = 'btn btn-secondary'; 
        backButton.textContent = 'Volver al Módulo';
        backButton.style.padding = '8px 16px';
        backButton.style.cursor = 'pointer';
        backButton.addEventListener('click', () => {
            if (this.onBackToModuleHome) this.onBackToModuleHome();
        });
        header.appendChild(backButton);

        this.container.appendChild(header);

        // Contenedor de Tarjetas
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'module-cards';
        cardsContainer.style.display = 'grid';
        cardsContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
        cardsContainer.style.gap = '20px';

        // Tarjeta 1: Ver Actas
        const card1 = this.createCard(
            'Ver actas',
            'Navegar, visualizar y previsualizar el historial de actas.',
            () => this.showVerActasPage()
        );
        cardsContainer.appendChild(card1);

        // Tarjeta 2: Realizar Actas
        const card2 = this.createCard(
            'Realizar Actas',
            'Crear una nueva acta a partir de una plantilla de Excel.',
            () => this.showRealizarActasInterface()
        );
        cardsContainer.appendChild(card2);

        this.container.appendChild(cardsContainer);
        
        // Limpiar listeners anteriores
        window.removeEventListener('message', this.handleIframeMessage);
    }

    createCard(title, description, onClick) {
        const card = document.createElement('div');
        card.style.border = '1px solid #ddd';
        card.style.borderRadius = '8px';
        card.style.padding = '20px';
        card.style.backgroundColor = '#fff';
        card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.justifyContent = 'space-between';

        const h5 = document.createElement('h3');
        h5.textContent = title;
        h5.style.marginTop = '0';
        h5.style.color = '#206A5D'; // Color verde original de Convivencia

        const p = document.createElement('p');
        p.textContent = description;
        p.style.color = '#555';

        const btn = document.createElement('button');
        btn.textContent = 'Acceder';
        btn.style.backgroundColor = '#206A5D';
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.padding = '10px';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.marginTop = '10px';
        
        btn.addEventListener('mouseenter', () => btn.style.backgroundColor = '#1A564B');
        btn.addEventListener('mouseleave', () => btn.style.backgroundColor = '#206A5D');
        btn.addEventListener('click', onClick);

        card.appendChild(h5);
        card.appendChild(p);
        card.appendChild(btn);

        return card;
    }

    // --- SECCIÓN: VER ACTAS (USANDO EL NUEVO VISUALIZADOR REPLICADO) ---
    showVerActasPage() {
        this.container.innerHTML = '';
        
        window.addEventListener('message', this.handleIframeMessage);

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.display = 'block'; 
        
        const viewerUrl = `modules/recursos/comite-convivencia/comite-convivencia-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        iframe.src = viewerUrl;

        this.container.appendChild(iframe);
    }

    handleIframeMessage(event) {
        if (!event.data || !event.data.type) return;

        if (event.data.type.endsWith('-request')) {
            const action = event.data.type.replace('-request', '');
            
            switch (action) {
                case 'back-to-module':
                    window.removeEventListener('message', this.handleIframeMessage);
                    this.render();
                    break;
                case 'get-document-folders':
                    this.handleStandardRequest(event, 'getDocumentFolders');
                    break;
                case 'get-documents-in-folder':
                    this.handleStandardRequest(event, 'getDocumentsInFolder');
                    break;
                case 'get-pdf-preview':
                    this.handleStandardRequest(event, 'getPDFPreview');
                    break;
                case 'get-word-preview':
                    this.handleStandardRequest(event, 'getWordPreview');
                    break;
                case 'get-excel-preview':
                    this.handleStandardRequest(event, 'getExcelPreview');
                    break;
                case 'download-document':
                    this.handleStandardRequest(event, 'downloadDocument');
                    break;
                default:
                    console.warn(`[ComiteConvivenciaLogic] Acción no manejada: ${action}`);
            }
        }
    }

    async handleStandardRequest(event, apiFunctionName) {
        const { requestId, payload } = event.data;
        try {
            if (!window.electronAPI || typeof window.electronAPI[apiFunctionName] !== 'function') {
                throw new Error(`API function ${apiFunctionName} not found`);
            }

            let apiArgs = payload;
            if (payload && typeof payload === 'object' && payload.filePath) {
                apiArgs = payload.filePath;
            }

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
            console.error(`[ComiteConvivenciaLogic] Error en ${apiFunctionName}:`, error);
            event.source.postMessage({
                type: `${event.data.type.replace('-request', '')}-response`,
                requestId,
                payload: { success: false, error: error.message }
            }, '*');
        }
    }

    // --- SECCIÓN: REALIZAR ACTAS (RESTAURADA DEL RESPALDO ORIGINAL) ---
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
        backBtn.innerHTML = '&#8592; Volver';
        backBtn.className = 'btn btn-secondary';
        backBtn.onclick = () => this.render();
        
        const title = document.createElement('h3');
        title.textContent = 'Realizar Acta de Reunión';
        title.style.flexGrow = '1';
        title.style.textAlign = 'center';
        title.style.margin = '0';

        header.appendChild(backBtn);
        header.appendChild(title);
        this.container.appendChild(header);

        const editorContainer = document.createElement('div');
        editorContainer.className = 'acta-editor-container';

        // Estilos ORIGINALES del formulario (Verdes)
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --primary-color: #206A5D;
                --primary-hover-color: #1A564B;
                --bg-color: #f8f9fa;
                --widget-bg-color: #ffffff;
                --border-color: #dee2e6;
                --text-color: #212529;
                --text-light-color: #6c757d;
                --font-family: 'Poppins', sans-serif;
            }

            .acta-form-wrapper {
                font-family: var(--font-family);
                color: var(--text-color);
                background: var(--bg-color);
                padding: 2rem 1.5rem;
                max-width: 1100px;
                margin: 0 auto;
            }

            .acta-card {
                background: var(--widget-bg-color);
                border-radius: 8px;
                border: 1px solid var(--border-color);
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                padding: 2rem;
                margin-bottom: 2rem;
            }

            .acta-card-title {
                font-size: 1.5rem;
                font-weight: 600;
                margin-top: 0;
                margin-bottom: 1.5rem;
                color: #495057;
                border-bottom: 2px solid var(--primary-color);
                padding-bottom: 0.5rem;
            }

            .acta-form-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1.5rem;
            }

            .acta-form-group { display: flex; flex-direction: column; }
            .acta-form-group.full-width { grid-column: 1 / -1; }
            .acta-form-group label { font-size: 0.9rem; font-weight: 500; color: var(--text-light-color); margin-bottom: 0.5rem; }
            .acta-form-group input, .acta-form-group textarea {
                padding: 0.5rem 0.75rem; border: 1px solid var(--border-color); border-radius: 4px;
            }

            .acta-dynamic-item {
                background: #f8f9fa; border: 1px solid var(--border-color); border-radius: 6px;
                padding: 1.5rem; margin-bottom: 1rem; position: relative;
            }

            .acta-btn-add {
                width: 100%; padding: 0.75rem; background: var(--primary-color); color: white;
                border: none; border-radius: 4px; cursor: pointer; font-weight: 500;
            }

            .acta-btn-remove {
                position: absolute; top: 10px; right: 10px; background: #dc3545; color: white;
                border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
            }

            .acta-footer { display: flex; justify-content: center; gap: 1.5rem; margin-top: 2rem; }
            .acta-btn-action { padding: 0.75rem 1.5rem; border-radius: 4px; cursor: pointer; font-weight: 500; border: 1px solid transparent; }
            .acta-btn-primary { background: var(--primary-color); color: white; }
            .acta-btn-secondary { background: white; color: var(--text-color); border-color: var(--border-color); }
        `;
        this.container.appendChild(style);

        // Estructura HTML ORIGINAL del formulario
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

        this.container.appendChild(editorContainer);

        const agendaList = document.getElementById('agenda-list');
        const desarrolloList = document.getElementById('desarrollo-list');

        // Helpers para items dinámicos (ORIGINALES)
        const createAgendaItem = (data = {}) => {
            const div = document.createElement('div');
            div.className = 'acta-dynamic-item';
            div.innerHTML = `
                <div class="acta-form-grid">
                    <div class="acta-form-group" style="grid-column: span 2"><label>Tema</label><input type="text" class="in-tema" value="${data.tema || ''}"></div>
                    <div class="acta-form-group"><label>Duración</label><input type="text" class="in-duracion" value="${data.duracion || ''}"></div>
                    <div class="acta-form-group"><label>Líder</label><input type="text" class="in-lider" value="${data.lider || ''}"></div>
                </div>
                <button class="acta-btn-remove">✕</button>
            `;
            div.querySelector('.acta-btn-remove').onclick = () => div.remove();
            return div;
        };

        const createDesarrolloItem = (data = {}) => {
            const div = document.createElement('div');
            div.className = 'acta-dynamic-item';
            div.innerHTML = `
                <div class="acta-form-group"><label>Temas Tratados</label><textarea class="in-tema" rows="4">${data.tema || ''}</textarea></div>
                <div class="acta-form-group"><label>Compromisos</label><textarea class="in-compromisos" rows="2">${data.compromisos || ''}</textarea></div>
                <div class="acta-form-grid" style="margin-top:10px;">
                    <div class="acta-form-group"><label>Fecha</label><input type="date" class="in-fecha" value="${data.fecha || ''}"></div>
                    <div class="acta-form-group"><label>Responsable</label><input type="text" class="in-responsable" value="${data.responsable || ''}"></div>
                </div>
                <button class="acta-btn-remove">✕</button>
            `;
            div.querySelector('.acta-btn-remove').onclick = () => div.remove();
            return div;
        };

        // Datos iniciales (ORIGINALES del Comité de Convivencia)
        const initialAgenda = [
            { tema: 'Verificación del Quórum', duracion: '00:10 Minutos', lider: 'Representante del Comité de Convivencia' },
            { tema: 'Saludos e inicio de reunión', duracion: '00:10 Minutos', lider: 'Representante del Comité de Convivencia' },
            { tema: 'Programa de bienestar y Temas Varios', duracion: '00:30 Minutos', lider: 'Representante del Comité de Convivencia' }
        ];

        const initialDesarrollo = [
            { tema: 'Verificación del Quórum', compromisos: 'Ninguno', responsable: 'Presidente del Comité de Convivencia' },
            { tema: 'Temas Varios: Se revisan la existencia de solicitudes o quejas sobre Acoso Laboral...', compromisos: 'Solicitar a la profesional de la ARL soporte...', responsable: 'Presidente del Comité de Convivencia' }
        ];

        initialAgenda.forEach(d => agendaList.appendChild(createAgendaItem(d)));
        initialDesarrollo.forEach(d => desarrolloList.appendChild(createDesarrolloItem(d)));

        document.getElementById('add-agenda-btn').onclick = () => agendaList.appendChild(createAgendaItem());
        document.getElementById('add-desarrollo-btn').onclick = () => desarrolloList.appendChild(createDesarrolloItem());

        document.getElementById('save-draft-btn').onclick = () => alert('Borrador guardado (simulado)');
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
            agendaItems: [],
            desarrolloItems: []
        };

        document.querySelectorAll('#agenda-list .acta-dynamic-item').forEach(item => {
            data.agendaItems.push({
                tema: item.querySelector('.in-tema').value,
                duracion: item.querySelector('.in-duracion').value,
                lider: item.querySelector('.in-lider').value
            });
        });

        document.querySelectorAll('#desarrollo-list .acta-dynamic-item').forEach(item => {
            data.desarrolloItems.push({
                tema: item.querySelector('.in-tema').value,
                compromisos: item.querySelector('.in-compromisos').value,
                fecha: item.querySelector('.in-fecha').value,
                responsable: item.querySelector('.in-responsable').value
            });
        });

        const changes = this.prepareExcelChanges(data);

        try {
            const savePath = await window.electronAPI.showSaveDialog({
                title: 'Guardar Acta de Comité de Convivencia',
                defaultPath: `ACTA_CONVIVENCIA_${data.fecha}.xlsx`,
                filters: [{ name: 'Archivos de Excel', extensions: ['xlsx'] }]
            });

            if (!savePath) return;

            const result = await window.electronAPI.generateConvivenciaActa(changes, savePath);
            if (result.success) {
                alert(`Acta generada correctamente en: ${result.documentPath}`);
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    // Mapeo ORIGINAL de celdas para la plantilla de Convivencia
    prepareExcelChanges(data) {
        const changes = [];
        changes.push({ row: 6, col: 4, value: data.actaNumber });
        changes.push({ row: 7, col: 4, value: data.topic });
        changes.push({ row: 9, col: 4, value: data.fecha });
        changes.push({ row: 10, col: 4, value: data.lugar });
        changes.push({ row: 11, col: 4, value: data.inicia });
        changes.push({ row: 12, col: 6, value: data.termina });

        let row = 26; // Inicio Agenda
        data.agendaItems.forEach(item => {
            changes.push({ row: row, col: 3, value: item.tema });
            changes.push({ row: row, col: 5, value: item.duracion });
            changes.push({ row: row, col: 6, value: item.lider });
            row++;
        });

        row += 4; // Espacio para Desarrollo
        data.desarrolloItems.forEach((item, idx) => {
            changes.push({ row: row, col: 1, value: idx + 1 });
            changes.push({ row: row, col: 2, value: item.tema });
            changes.push({ row: row, col: 4, value: item.compromisos });
            changes.push({ row: row, col: 6, value: item.fecha });
            changes.push({ row: row, col: 7, value: item.responsable });
            row++;
        });

        return changes;
    }

    destroy() {
        window.removeEventListener('message', this.handleIframeMessage);
        this.container.innerHTML = '';
    }
}

window.ComiteConvivenciaComponent = ComiteConvivenciaComponent;
