// restricciones-medicas.js - Componente para el submódulo "3.1.6 Restricciones y recomendaciones médicas"

class RestriccionesMedicasComponent {
    constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
        this.container = container;
        this.companyName = companyName;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBackToModuleHome = onBackToModuleHome; // Para volver al home del módulo principal
        this.allFiles = [];
        this.submodulePath = null;
        this.extractedData = null; // Para guardar los datos del PDF procesado
        this.lastGeneratedDoc = null; // Para guardar la ruta del DOCX generado
    }

    // El render principal que muestra las 4 tarjetas
    render() {
        this.container.innerHTML = '';
        const backButton = this.createBackButton('&#8592; Volver al Módulo', this.onBackToModuleHome);
        this.container.appendChild(backButton);

        const title = document.createElement('h3');
        title.textContent = this.submoduleName;
        title.style.textAlign = 'center';
        title.style.marginBottom = '20px';
        this.container.appendChild(title);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'module-cards';

        cardsContainer.appendChild(this.createModuleCard('Ver Remisiones Médicas', 'Visualizar, buscar y previsualizar el historial de remisiones.', () => this.showVerRemisionesPage()));
        cardsContainer.appendChild(this.createModuleCard('Enviar Remisiones', 'Crear y enviar nuevas remisiones y recomendaciones.', () => this.showEnviarRemisionPage())); // MODIFICADO
        cardsContainer.appendChild(this.createModuleCard('Control de Remisiones', 'Realizar seguimiento al estado de las remisiones enviadas.', () => this.showPlaceholder('Control de Remisiones')));
        cardsContainer.appendChild(this.createModuleCard('Próxima Función', 'Una nueva funcionalidad estará disponible aquí pronto.', () => this.showPlaceholder('Próxima Función')));

        this.container.appendChild(cardsContainer);
    }

    // --- NUEVA LÓGICA PARA LA SECCIÓN "ENVIAR REMISIONES" ---

    showEnviarRemisionPage() {
        this.container.innerHTML = '';
        this.extractedData = null;
        this.lastGeneratedDoc = null;

        // Encabezado
        const header = this.createHeader('Enviar Nueva Remisión', () => this.render());
        this.container.appendChild(header);

        // Contenedor principal
        const mainDiv = document.createElement('div');
        mainDiv.className = 'enviar-remision-container';

        // Columna Izquierda: Selección y Acciones
        const leftCol = document.createElement('div');
        leftCol.className = 'remision-col-control';
        
        const fileSelectionBox = this.createFileSelectionBox();
        leftCol.appendChild(fileSelectionBox);

        const actionsBox = this.createActionsBox();
        leftCol.appendChild(actionsBox);
        
        mainDiv.appendChild(leftCol);

        // Columna Derecha: Datos extraídos y Log
        const rightCol = document.createElement('div');
        rightCol.className = 'remision-col-data';

        const dataBox = this.createDataDisplayBox();
        rightCol.appendChild(dataBox);

        const logBox = this.createLogBox();
        rightCol.appendChild(logBox);

        mainDiv.appendChild(rightCol);

        this.container.appendChild(mainDiv);
    }

    createFileSelectionBox() {
        const box = document.createElement('div');
        box.className = 'widget-box';
        box.innerHTML = '<h4>1. Selección de Archivo</h4>';

        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';
        
        const pathInput = document.createElement('input');
        pathInput.type = 'text';
        pathInput.id = 'pdf-path-input';
        pathInput.placeholder = 'Ningún archivo seleccionado...';
        pathInput.disabled = true;
        inputGroup.appendChild(pathInput);

        const browseBtn = document.createElement('button');
        browseBtn.textContent = 'Buscar PDF';
        browseBtn.className = 'btn btn-primary';
        browseBtn.addEventListener('click', async () => {
            const filePath = await window.electronAPI.selectPdfFile();
            if (filePath) {
                pathInput.value = filePath;
                this.logMessage('Archivo seleccionado. Procesando...');
                this.processSelectedPdf(filePath);
            }
        });
        inputGroup.appendChild(browseBtn);
        box.appendChild(inputGroup);
        return box;
    }

    createActionsBox() {
        const box = document.createElement('div');
        box.className = 'widget-box';
        box.innerHTML = '<h4>2. Acciones</h4>';

        const generateBtn = document.createElement('button');
        generateBtn.id = 'generate-doc-btn';
        generateBtn.textContent = 'Generar y Guardar';
        generateBtn.className = 'btn btn-success btn-full';
        generateBtn.disabled = true;
        generateBtn.addEventListener('click', () => this.handleGeneration());
        box.appendChild(generateBtn);

        const sendBox = document.createElement('div');
        sendBox.className = 'send-buttons-group';

        const whatsappBtn = document.createElement('button');
        whatsappBtn.id = 'send-whatsapp-btn';
        whatsappBtn.textContent = 'Enviar por WhatsApp';
        whatsappBtn.className = 'btn btn-info';
        whatsappBtn.disabled = true;
        whatsappBtn.addEventListener('click', () => this.showPlaceholder('Enviar por WhatsApp'));
        sendBox.appendChild(whatsappBtn);

        const emailBtn = document.createElement('button');
        emailBtn.id = 'send-email-btn';
        emailBtn.textContent = 'Enviar por Correo';
        emailBtn.className = 'btn btn-info';
        emailBtn.disabled = true;
        emailBtn.addEventListener('click', () => this.showPlaceholder('Enviar por Correo'));
        sendBox.appendChild(emailBtn);
        
        box.appendChild(sendBox);
        return box;
    }

    createDataDisplayBox() {
        const box = document.createElement('div');
        box.className = 'widget-box';
        box.innerHTML = '<h4>Datos Extraídos</h4>';
        
        const dataContainer = document.createElement('div');
        dataContainer.id = 'extracted-data-container';
        dataContainer.className = 'extracted-data-container';
        dataContainer.innerHTML = '<p class="placeholder-text">Esperando archivo PDF para procesar...</p>';
        box.appendChild(dataContainer);
        return box;
    }

    createLogBox() {
        const box = document.createElement('div');
        box.className = 'widget-box';
        box.innerHTML = '<h4>Registro de Actividad</h4>';
        
        const logText = document.createElement('div');
        logText.id = 'remision-log-text';
        logText.className = 'log-text-area';
        box.appendChild(logText);
        return box;
    }

    async processSelectedPdf(filePath) {
        // Deshabilitar botones mientras se procesa
        document.getElementById('generate-doc-btn').disabled = true;
        document.getElementById('send-whatsapp-btn').disabled = true;
        document.getElementById('send-email-btn').disabled = true;

        try {
            const result = await window.electronAPI.processRemisionPdf(filePath);
            if (result.success) {
                this.extractedData = result.data;
                this.displayExtractedData(this.extractedData);
                this.logMessage('Extracción de datos completada exitosamente.');
                document.getElementById('generate-doc-btn').disabled = false; // Habilitar botón de generar
            } else {
                this.logMessage(`Error en la extracción: ${result.error}`, 'error');
            }
        } catch (error) {
            this.logMessage(`Error crítico al llamar al proceso de Python: ${error.message}`, 'error');
        }
    }

    displayExtractedData(data) {
        const container = document.getElementById('extracted-data-container');
        container.innerHTML = ''; // Limpiar placeholder
        const table = document.createElement('table');
        table.className = 'data-table';
        
        for (const [key, value] of Object.entries(data)) {
            const row = table.insertRow();
            const cellKey = row.insertCell();
            cellKey.textContent = key;
            const cellValue = row.insertCell();
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = value;
            input.className = 'form-control-sm';
            // Opcional: guardar cambios en el objeto de datos
            input.addEventListener('change', (e) => {
                this.extractedData[key] = e.target.value;
            });
            cellValue.appendChild(input);
        }
        container.appendChild(table);
    }
    
    handleGeneration() {
        this.logMessage('Funcionalidad "Generar y Guardar" pendiente de implementación.');
        this.logMessage('Esto llamará a los scripts de Python para crear el DOCX y actualizar el Excel.');
        // Simulación de éxito para habilitar los botones de envío
        this.lastGeneratedDoc = "ruta/simulada/al/documento.docx";
        document.getElementById('send-whatsapp-btn').disabled = false;
        document.getElementById('send-email-btn').disabled = false;
    }

    logMessage(message, type = 'info') {
        const logArea = document.getElementById('remision-log-text');
        if (logArea) {
            const msg = document.createElement('p');
            msg.textContent = `[${type.toUpperCase()}] ${message}`;
            msg.className = `log-${type}`;
            logArea.prepend(msg);
        }
    }

    // --- Métodos de Ayuda y Vistas Anteriores (reutilizados y/o sin cambios) ---

    createHeader(titleText, onBack) {
        const header = document.createElement('div');
        header.className = 'submodule-header';
        header.appendChild(this.createBackButton('&#8592; Volver', onBack));
        const title = document.createElement('h3');
        title.textContent = titleText;
        title.style.flexGrow = '1';
        title.style.textAlign = 'center';
        header.appendChild(title);
        return header;
    }
    
    createBackButton(text, onClick) {
        const backButton = document.createElement('button');
        backButton.className = 'btn btn-back';
        backButton.innerHTML = text;
        backButton.addEventListener('click', onClick);
        return backButton;
    }

    // ... (Aquí irían los métodos de la vista "Ver Remisiones": showVerRemisionesPage, loadInitialFiles, etc. que no se han modificado)
    // Por brevedad, no se repiten aquí, pero en el archivo final estarían presentes.
    // ...

    createModuleCard(title, description, onClick) {
        const card = document.createElement('div');
        card.className = 'card module-card';
        card.innerHTML = `<div class="card-body"><h5 class="card-title">${title}</h5><p class="card-text">${description}</p><button class="btn btn-primary">Acceder</button></div>`;
        card.querySelector('button').addEventListener('click', onClick);
        return card;
    }

    showPlaceholder(featureName) {
        alert(`La funcionalidad '${featureName}' se implementará en el futuro.`);
    }
}

window.RestriccionesMedicasComponent = RestriccionesMedicasComponent;

// Estilos para la nueva interfaz (se inyectan para mantener todo encapsulado)
const style = document.createElement('style');
style.textContent = `
    .enviar-remision-container { display: flex; gap: 1rem; }
    .remision-col-control { flex: 1; display: flex; flex-direction: column; gap: 1rem; }
    .remision-col-data { flex: 2; display: flex; flex-direction: column; gap: 1rem; }
    .widget-box { background-color: var(--widget-bg-color); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); padding: 1rem; }
    .widget-box h4 { margin-top: 0; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1rem; }
    .input-group { display: flex; gap: 0.5rem; }
    .input-group input { flex-grow: 1; }
    .btn-full { width: 100%; margin-top: 0.5rem; }
    .send-buttons-group { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 1rem; }
    .extracted-data-container { max-height: 300px; overflow-y: auto; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table td { padding: 0.25rem; }
    .data-table td:first-child { font-weight: bold; text-align: right; width: 40%; }
    .log-text-area { height: 100px; background-color: var(--bg-color); border-radius: var(--border-radius-sm); padding: 0.5rem; overflow-y: auto; font-family: monospace; font-size: 0.8rem; }
    .log-error { color: var(--danger-color); }
    .log-info { color: var(--text-color); }
`;
document.head.appendChild(style);
