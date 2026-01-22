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
        backButton.className = 'btn btn-secondary'; // Clase visual si existe
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
        cardsContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr));';
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
        h5.style.color = '#174ea6'; // K+AIR Primary

        const p = document.createElement('p');
        p.textContent = description;
        p.style.color = '#555';

        const btn = document.createElement('button');
        btn.textContent = 'Acceder';
        btn.style.backgroundColor = '#174ea6';
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.padding = '10px';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.marginTop = '10px';
        
        btn.addEventListener('mouseenter', () => btn.style.backgroundColor = '#13428e');
        btn.addEventListener('mouseleave', () => btn.style.backgroundColor = '#174ea6');
        btn.addEventListener('click', onClick);

        card.appendChild(h5);
        card.appendChild(p);
        card.appendChild(btn);

        return card;
    }

    // --- SECCIÓN: VER ACTAS (INTEGRACIÓN K+AIR) ---
    showVerActasPage() {
        this.container.innerHTML = '';
        
        // Registrar listener para comunicación con el iframe
        window.addEventListener('message', this.handleIframeMessage);

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.display = 'block'; 
        
        // Pasar parámetros a la nueva interfaz
        const viewerUrl = `modules/recursos/comite-convivencia/comite-convivencia-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        iframe.src = viewerUrl;

        this.container.appendChild(iframe);
    }

    handleIframeMessage(event) {
        if (!event.data || !event.data.type) {
            return;
        }

        // Manejar mensajes del nuevo estándar (type: 'action-request')
        if (event.data.type.endsWith('-request')) {
            const action = event.data.type.replace('-request', '');
            
            switch (action) {
                case 'back-to-module':
                    window.removeEventListener('message', this.handleIframeMessage);
                    this.render(); // Volver a las tarjetas
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
        console.log(`[ComiteConvivenciaLogic] Solicitud: ${apiFunctionName}, ID: ${requestId}`);
        
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
                payload: {
                    success: false,
                    error: error.message
                }
            }, '*');
        }
    }

    // --- SECCIÓN: REALIZAR ACTAS (Lógica original adaptada) ---
    showRealizarActasInterface() {
        this.container.innerHTML = '';

        // Header simple
        const header = document.createElement('div');
        header.style.marginBottom = '20px';
        header.style.padding = '10px';
        header.style.backgroundColor = '#f8f9fa';
        header.style.borderBottom = '1px solid #dee2e6';
        
        const backBtn = document.createElement('button');
        backBtn.textContent = '← Volver';
        backBtn.className = 'btn btn-secondary'; 
        backBtn.style.padding = '5px 15px';
        backBtn.style.cursor = 'pointer';
        backBtn.onclick = () => this.render();
        
        const title = document.createElement('span');
        title.textContent = ' Realizar Acta de Reunión';
        title.style.fontWeight = 'bold';
        title.style.marginLeft = '15px';
        title.style.fontSize = '1.1rem';

        header.appendChild(backBtn);
        header.appendChild(title);
        this.container.appendChild(header);

        // Contenedor principal del editor
        const editorContainer = document.createElement('div');
        editorContainer.className = 'acta-editor-container';
        
        // Estilos específicos para el editor
        const style = document.createElement('style');
        style.textContent = 
            `.acta-editor-container { padding: 20px; font-family: 'Roboto', sans-serif; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .form-section { margin-bottom: 25px; padding: 15px; border: 1px solid #eee; border-radius: 6px; }
            .form-section h3 { margin-top: 0; color: #174ea6; border-bottom: 2px solid #e8f0fe; padding-bottom: 10px; margin-bottom: 15px; }
            .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
            .form-group { margin-bottom: 10px; }
            .form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: #555; }
            .form-group input, .form-group textarea { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
            .form-group input:focus, .form-group textarea:focus { border-color: #174ea6; outline: none; }
            .dynamic-item { background: #f9f9f9; padding: 15px; margin-bottom: 10px; border-radius: 4px; border: 1px solid #eee; position: relative; }
            .btn-add { background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin-top: 10px; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 5px; }
            .btn-add:hover { background: #218838; }
            .btn-remove { position: absolute; top: 10px; right: 10px; background: #dc3545; color: white; border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; }
            .actions-bar { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; display: flex; justify-content: flex-end; gap: 10px; }
            .btn-action { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }
            .btn-save { background: #174ea6; color: white; }
            .btn-export { background: #206A5D; color: white; } /* Color Excel-like */
        
`;
        this.container.appendChild(style);

        // Estructura del Formulario
        editorContainer.innerHTML = 
            `<div class="form-section">
                <h3>Información de la Reunión</h3>
                <div class="form-grid">
                    <div class="form-group"><label>N° de Acta</label><input type="number" id="acta-number" value="001"></div>
                    <div class="form-group"><label>Fecha</label><input type="date" id="fecha" value="${new Date().toISOString().split('T')[0]}"></div>
                    <div class="form-group"><label>Hora Inicio</label><input type="time" id="inicia" value="08:00"></div>
                    <div class="form-group"><label>Hora Fin</label><input type="time" id="termina" value="09:00"></div>
                    <div class="form-group" style="grid-column: 1/-1"><label>Tema</label><input type="text" id="topic" value="Reunión del Comité de Convivencia Laboral"></div>
                    <div class="form-group" style="grid-column: 1/-1"><label>Lugar</label><input type="text" id="ciudad-lugar" value="Barranquilla, Oficinas"></div>
                </div>
            </div>

            <div class="form-section">
                <h3>Agenda de la Reunión</h3>
                <div id="agenda-list"></div>
                <button class="btn-add" id="add-agenda-btn">+ Agregar tema</button>
            </div>

            <div class="form-section">
                <h3>Desarrollo y Compromisos</h3>
                <div id="desarrollo-list"></div>
                <button class="btn-add" id="add-desarrollo-btn">+ Agregar punto</button>
            </div>

            <div class="actions-bar">
                <button class="btn-action btn-save" id="save-draft-btn">Guardar Borrador</button>
                <button class="btn-action btn-export" id="export-excel-btn">Exportar a Excel</button>
            </div>
        
`;

        this.container.appendChild(editorContainer);

        // Lógica del Formulario
        const agendaList = document.getElementById('agenda-list');
        const desarrolloList = document.getElementById('desarrollo-list');

        // Helpers para crear items
        const createAgendaItem = (data = {}) => {
            const item = document.createElement('div');
            item.className = 'dynamic-item agenda-item';
            item.innerHTML = 
                `<div class="form-grid">
                    <div class="form-group" style="grid-column: span 2"><label>Tema</label><input type="text" class="input-tema" placeholder="Descripción" value="${data.tema || ''}"></div>
                    <div class="form-group"><label>Duración</label><input type="text" class="input-duracion" placeholder="Ej: 10 min" value="${data.duracion || ''}"></div>
                    <div class="form-group"><label>Líder</label><input type="text" class="input-lider" placeholder="Nombre" value="${data.lider || ''}"></div>
                </div>
                <button class="btn-remove" title="Eliminar">✕</button>
            `;
            item.querySelector('.btn-remove').onclick = () => item.remove();
            return item;
        };

        const createDesarrolloItem = (data = {}) => {
            const item = document.createElement('div');
            item.className = 'dynamic-item desarrollo-item';
            item.innerHTML = 
                `<div class="form-group"><label>Temas Tratados</label><textarea class="input-tema" rows="3">${data.tema || ''}</textarea></div>
                <div class="form-group"><label>Compromisos Generados</label><textarea class="input-compromisos" rows="2">${data.compromisos || ''}</textarea></div>
                <div class="form-grid">
                    <div class="form-group"><label>Fecha Límite</label><input type="date" class="input-fecha" value="${data.fecha || ''}"></div>
                    <div class="form-group"><label>Responsable</label><input type="text" class="input-responsable" value="${data.responsable || ''}">
</div>
                </div>
                <button class="btn-remove" title="Eliminar">✕</button>
            `;
            item.querySelector('.btn-remove').onclick = () => item.remove();
            return item;
        };

        // Datos iniciales de ejemplo
        agendaList.appendChild(createAgendaItem({ tema: 'Verificación del Quórum', duracion: '10 min', lider: 'Presidente' }));
        agendaList.appendChild(createAgendaItem({ tema: 'Saludos e inicio', duracion: '5 min', lider: 'Presidente' }));
        
        desarrolloList.appendChild(createDesarrolloItem({ tema: 'Se verificó la asistencia...', compromisos: 'Ninguno', responsable: 'N/A' }));

        // Listeners de botones
        document.getElementById('add-agenda-btn').onclick = () => agendaList.appendChild(createAgendaItem());
        document.getElementById('add-desarrollo-btn').onclick = () => desarrolloList.appendChild(createDesarrolloItem());

        document.getElementById('save-draft-btn').onclick = () => {
            alert('Funcionalidad de guardado temporal (simulada).');
        };

        document.getElementById('export-excel-btn').onclick = () => {
            this.handleExportExcel();
        };
    }

    async handleExportExcel() {
        // 1. Recopilar datos
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

        // Agenda
        document.querySelectorAll('#agenda-list .agenda-item').forEach(item => {
            data.agendaItems.push({
                tema: item.querySelector('.input-tema').value,
                duracion: item.querySelector('.input-duracion').value,
                lider: item.querySelector('.input-lider').value
            });
        });

        // Desarrollo
        document.querySelectorAll('#desarrollo-list .desarrollo-item').forEach(item => {
            data.desarrolloItems.push({
                tema: item.querySelector('.input-tema').value,
                compromisos: item.querySelector('.input-compromisos').value,
                fecha: item.querySelector('.input-fecha').value,
                responsable: item.querySelector('.input-responsable').value
            });
        });

        // 2. Preparar cambios para el Excel (Mapeo de celdas)
        const changes = this.prepareExcelChanges(data);

        if (changes.length === 0) {
            alert('No hay datos suficientes para exportar.');
            return;
        }

        // 3. Diálogo de guardado
        try {
            const savePath = await window.electronAPI.showSaveDialog({
                title: 'Guardar Acta de Comité de Convivencia',
                defaultPath: `ACTA_CONVIVENCIA_${data.fecha}.xlsx`,
                filters: [{ name: 'Archivos de Excel', extensions: ['xlsx'] }]
            });

            if (!savePath) return;

            // 4. Generar usando la API de Convivencia
            const result = await window.electronAPI.generateConvivenciaActa(changes, savePath);
            
            if (result.success) {
                alert(`Acta generada correctamente en: ${result.documentPath}`);
            } else {
                alert(`Error al generar: ${result.error}`);
            }

        } catch (error) {
            console.error('Error exportando:', error);
            alert(`Error inesperado: ${error.message}`);
        }
    }

    prepareExcelChanges(data) {
        const changes = [];
        
        // Mapeo básico a celdas específicas de la plantilla
        changes.push({ row: 6, col: 4, value: data.actaNumber }); // C5 aprox
        changes.push({ row: 7, col: 4, value: data.topic });      // C6
        changes.push({ row: 9, col: 4, value: data.fecha });      // C8
        changes.push({ row: 10, col: 4, value: data.lugar });     // C9
        changes.push({ row: 11, col: 4, value: data.inicia });    // C10
        changes.push({ row: 12, col: 6, value: data.termina });   // C11

        // Lógica para tablas dinámicas
        let row = 26; // Inicio Agenda (aprox)
        data.agendaItems.forEach(item => {
            changes.push({ row: row, col: 3, value: item.tema });    // Col D
            changes.push({ row: row, col: 5, value: item.duracion });// Col F
            changes.push({ row: row, col: 6, value: item.lider });   // Col G
            row++;
        });

        row += 4; // Espacio entre tablas
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