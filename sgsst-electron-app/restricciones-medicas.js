// restricciones-medicas.js - Componente para el submódulo "3.1.6 Restricciones y recomendaciones médicas"

class RestriccionesMedicasComponent {
    constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
        this.container = container;
        this.companyName = companyName;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBackToModuleHome = onBackToModuleHome;
        this.extractedData = null;
        this.lastGeneratedDoc = null;

        // Estado para el explorador de archivos
        this.currentPath = null;
        this.pathHistory = [];
    }

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

        cardsContainer.appendChild(this.createModuleCard('Ver Remisiones Médicas', 'Navegar, visualizar y previsualizar el historial de remisiones.', () => this.showVerRemisionesPage()));
        cardsContainer.appendChild(this.createModuleCard('Enviar Remisiones', 'Crear y enviar nuevas remisiones y recomendaciones.', () => this.showEnviarRemisionPage()));
        cardsContainer.appendChild(this.createModuleCard('Control de Remisiones', 'Realizar seguimiento al estado de las remisiones enviadas.', () => this.showPlaceholder('Control de Remisiones')));
        cardsContainer.appendChild(this.createModuleCard('Próxima Función', 'Una nueva funcionalidad estará disponible aquí pronto.', () => this.showPlaceholder('Próxima Función')));

        this.container.appendChild(cardsContainer);
    }

    // --- Lógica para la sección "Ver Remisiones Médicas" (Navegador de Archivos) ---

    showVerRemisionesPage() {
        this.container.innerHTML = '';
        this.currentPath = null;
        this.pathHistory = [];

        const header = this.createHeader('Ver Remisiones Médicas', () => this.render());
        this.container.appendChild(header);

        const navBar = document.createElement('div');
        navBar.className = 'file-nav-bar';
        this.container.appendChild(navBar);

        const mainLayout = document.createElement('div');
        mainLayout.className = 'remisiones-layout';

        const resultsCol = document.createElement('div');
        resultsCol.id = 'search-results-col';
        resultsCol.className = 'search-results-col';
        mainLayout.appendChild(resultsCol);

        const previewCol = document.createElement('div');
        previewCol.id = 'preview-col';
        previewCol.className = 'preview-col';
        previewCol.innerHTML = `<div class="preview-placeholder">Seleccione un documento para previsualizarlo.</div>`;
        mainLayout.appendChild(previewCol);

        this.container.appendChild(mainLayout);

        this.navigateToInitialPath();
    }

    async navigateToInitialPath() {
        try {
            const result = await window.electronAPI.findSubmodulePath(this.companyName, this.moduleName, this.submoduleName);
            if (result.success) {
                this.navigateToPath(result.path);
            } else {
                document.getElementById('search-results-col').innerHTML = `<p>Error al encontrar la ruta inicial: ${result.error}</p>`;
            }
        } catch (error) {
            document.getElementById('search-results-col').innerHTML = `<p>Error crítico al buscar ruta: ${error.message}</p>`;
        }
    }

    async navigateToPath(path) {
        const resultsCol = document.getElementById('search-results-col');
        resultsCol.innerHTML = `<p>Cargando...</p>`;
        try {
            const items = await window.electronAPI.readDirectory(path);
            this.currentPath = path;
            this.updateNavBar();
            this.displayItems(items);
        } catch (error) {
            resultsCol.innerHTML = `<p>Error al leer directorio: ${error.message}</p>`;
        }
    }

    updateNavBar() {
        const navBar = this.container.querySelector('.file-nav-bar');
        navBar.innerHTML = '';

        const upButton = document.createElement('button');
        upButton.innerHTML = '&#8679; Subir Nivel';
        upButton.className = 'btn btn-secondary btn-sm';
        upButton.disabled = this.pathHistory.length === 0;
        upButton.addEventListener('click', () => {
            if (this.pathHistory.length > 0) {
                const parentPath = this.pathHistory.pop();
                this.navigateToPath(parentPath);
            }
        });
        navBar.appendChild(upButton);

        const breadcrumb = document.createElement('span');
        breadcrumb.className = 'breadcrumb-display';
        breadcrumb.textContent = this.currentPath;
        navBar.appendChild(breadcrumb);
    }

    displayItems(items) {
        const resultsCol = document.getElementById('search-results-col');
        resultsCol.innerHTML = '';
        const list = document.createElement('ul');
        list.className = 'search-results-list';

        const allowedExtensions = ['.pdf', '.doc', '.docx'];
        const folders = items.filter(item => item.isDirectory);
        const files = items.filter(item => !item.isDirectory && allowedExtensions.includes(item.name.slice(item.name.lastIndexOf('.')).toLowerCase()));

        folders.forEach(folder => {
            const li = document.createElement('li');
            li.innerHTML = `📁 ${folder.name}`;
            li.addEventListener('click', () => {
                this.pathHistory.push(this.currentPath);
                this.navigateToPath(folder.path);
            });
            list.appendChild(li);
        });

        files.forEach(file => {
            const li = document.createElement('li');
            li.innerHTML = `📄 ${file.name}`;
            li.addEventListener('click', () => this.previewDocument(file.path));
            list.appendChild(li);
        });

        if (list.children.length === 0) {
            resultsCol.innerHTML = '<p>No hay archivos o carpetas para mostrar.</p>';
        }
        resultsCol.appendChild(list);
    }

    async previewDocument(filePath) {
        const previewCol = document.getElementById('preview-col');
        const fileExtension = filePath.split('.').pop().toLowerCase();

        // Mostrar indicador de carga
        previewCol.innerHTML = `<div class="preview-placeholder">Cargando previsualización...</div>`;

        if (fileExtension === 'pdf') {
            // Los PDF se cargan directamente
            previewCol.innerHTML = `<iframe src="${filePath}" width="100%" height="100%" style="border: none;"></iframe>`;
        } else if (fileExtension === 'doc' || fileExtension === 'docx') {
            // Para DOC y DOCX, llamar a la conversión
            try {
                const result = await window.electronAPI.convertDocxToPdf(filePath);
                if (result.success) {
                    // Cargar el PDF temporal en el iframe
                    // Añadimos un timestamp para evitar problemas de caché del iframe
                    previewCol.innerHTML = `<iframe src="${result.pdf_path}?t=${new Date().getTime()}" width="100%" height="100%" style="border: none;"></iframe>`;
                } else {
                    // Mostrar error de conversión
                    previewCol.innerHTML = `<div class="preview-error"><h3>Error de Conversión</h3><p>${result.error}</p><button class="btn btn-primary">Abrir con aplicación externa</button></div>`;
                    previewCol.querySelector('button').addEventListener('click', () => window.electronAPI.openPath(filePath));
                }
            } catch (error) {
                // Mostrar error de IPC
                previewCol.innerHTML = `<div class="preview-error"><h3>Error Inesperado</h3><p>${error.message}</p><button class="btn btn-primary">Abrir con aplicación externa</button></div>`;
                previewCol.querySelector('button').addEventListener('click', () => window.electronAPI.openPath(filePath));
            }
        } else {
            // Para otras extensiones, mostrar mensaje de no soportado
            previewCol.innerHTML = `<div class="preview-error"><h3>Previsualización no disponible</h3><p>La previsualización para archivos <strong>.${fileExtension}</strong> no está soportada.</p><button class="btn btn-primary">Abrir con aplicación externa</button></div>`;
            previewCol.querySelector('button').addEventListener('click', () => window.electronAPI.openPath(filePath));
        }
    }

    // --- Lógica para la sección "Enviar Remisiones" ---

    showEnviarRemisionPage() {
        this.container.innerHTML = '';
        this.extractedData = null;
        this.lastGeneratedDoc = null;

        const header = this.createHeader('Enviar Nueva Remisión', () => this.render());
        this.container.appendChild(header);

        const mainDiv = document.createElement('div');
        mainDiv.className = 'enviar-remision-container';

        const leftCol = document.createElement('div');
        leftCol.className = 'remision-col-control';
        leftCol.appendChild(this.createFileSelectionBox());
        leftCol.appendChild(this.createActionsBox());
        mainDiv.appendChild(leftCol);

        const rightCol = document.createElement('div');
        rightCol.className = 'remision-col-data';
        rightCol.appendChild(this.createDataDisplayBox());
        rightCol.appendChild(this.createLogBox());
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
        whatsappBtn.addEventListener('click', () => this.handleSendWhatsApp());
        sendBox.appendChild(whatsappBtn);
        const emailBtn = document.createElement('button');
        emailBtn.id = 'send-email-btn';
        emailBtn.textContent = 'Enviar por Correo';
        emailBtn.className = 'btn btn-info';
        emailBtn.disabled = true;
        emailBtn.addEventListener('click', () => this.handleSendEmail());
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
        document.getElementById('generate-doc-btn').disabled = true;
        document.getElementById('send-whatsapp-btn').disabled = true;
        document.getElementById('send-email-btn').disabled = true;
        try {
            const result = await window.electronAPI.processRemisionPdf(filePath);
            if (result.success) {
                this.extractedData = result.data;
                this.displayExtractedData(this.extractedData);
                this.logMessage('Extracción de datos completada.');
                document.getElementById('generate-doc-btn').disabled = false;
            } else {
                this.logMessage(`Error en la extracción: ${result.error}`, 'error');
            }
        } catch (error) {
            this.logMessage(`Error crítico al llamar al proceso de Python: ${error.message}`, 'error');
        }
    }

    displayExtractedData(data) {
        const container = document.getElementById('extracted-data-container');
        container.innerHTML = '';
        const table = document.createElement('table');
        table.className = 'data-table';
        for (const [key, value] of Object.entries(data)) {
            const row = table.insertRow();
            row.insertCell().textContent = key;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = value;
            input.className = 'form-control-sm';
            input.addEventListener('change', (e) => { this.extractedData[key] = e.target.value; });
            row.insertCell().appendChild(input);
        }
        container.appendChild(table);
    }
    
    async handleGeneration() {
        if (!this.extractedData) {
            this.logMessage('No hay datos extraídos para generar el documento.', 'error');
            return;
        }

        try {
            this.logMessage('Generando documento de remisión...');
            const generateBtn = document.getElementById('generate-doc-btn');
            generateBtn.disabled = true;
            generateBtn.textContent = 'Generando...';
            
            // Llamar al proceso de Python para generar el documento
            const result = await window.electronAPI.generateRemisionDocument(
                this.extractedData,
                this.companyName
            );
            
            if (result.success) {
                this.lastGeneratedDoc = result.documentPath;
                this.logMessage(`Documento generado exitosamente: ${result.documentPath}`);
                this.logMessage(`Archivo de control actualizado: ${result.controlPath}`);
                
                // Habilitar botones de envío
                document.getElementById('send-whatsapp-btn').disabled = false;
                document.getElementById('send-email-btn').disabled = false;
                
                // Mostrar mensaje de éxito
                alert('Documento generado exitosamente.');
            } else {
                this.logMessage(`Error al generar documento: ${result.error}`, 'error');
                alert(`Error al generar documento: ${result.error}`);
            }
        } catch (error) {
            this.logMessage(`Error crítico al generar documento: ${error.message}`, 'error');
            alert(`Error crítico al generar documento: ${error.message}`);
        } finally {
            const generateBtn = document.getElementById('generate-doc-btn');
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generar y Guardar';
        }
    }

    async handleSendWhatsApp() {
        if (!this.extractedData || !this.lastGeneratedDoc) {
            this.logMessage('No hay documento generado para enviar.', 'error');
            alert('No hay documento generado para enviar.');
            return;
        }

        try {
            this.logMessage('Preparando envío por WhatsApp...');
            const whatsappBtn = document.getElementById('send-whatsapp-btn');
            whatsappBtn.disabled = true;
            whatsappBtn.textContent = 'Enviando...';
            
            // Llamar al proceso de Python para enviar por WhatsApp
            const result = await window.electronAPI.sendRemisionByWhatsApp(
                this.lastGeneratedDoc,
                this.extractedData,
                this.companyName
            );
            
            if (result.success) {
                this.logMessage('Mensaje de WhatsApp preparado. Se abrirá WhatsApp Web.');
                alert('Se abrirá WhatsApp Web con el mensaje preparado. Por favor, revise y envíe el mensaje.');
            } else {
                this.logMessage(`Error al preparar WhatsApp: ${result.error}`, 'error');
                alert(`Error al preparar WhatsApp: ${result.error}`);
            }
        } catch (error) {
            this.logMessage(`Error crítico al preparar WhatsApp: ${error.message}`, 'error');
            alert(`Error crítico al preparar WhatsApp: ${error.message}`);
        } finally {
            const whatsappBtn = document.getElementById('send-whatsapp-btn');
            whatsappBtn.disabled = false;
            whatsappBtn.textContent = 'Enviar por WhatsApp';
        }
    }

    async handleSendEmail() {
        if (!this.extractedData || !this.lastGeneratedDoc) {
            this.logMessage('No hay documento generado para enviar.', 'error');
            alert('No hay documento generado para enviar.');
            return;
        }

        try {
            this.logMessage('Preparando envío por correo electrónico...');
            const emailBtn = document.getElementById('send-email-btn');
            emailBtn.disabled = true;
            emailBtn.textContent = 'Enviando...';
            
            // Llamar al proceso de Python para enviar por correo
            const result = await window.electronAPI.sendRemisionByEmail(
                this.lastGeneratedDoc,
                this.extractedData,
                this.companyName
            );
            
            if (result.success) {
                this.logMessage('Correo electrónico enviado exitosamente.');
                alert('Correo electrónico enviado exitosamente.');
            } else {
                this.logMessage(`Error al enviar correo: ${result.error}`, 'error');
                alert(`Error al enviar correo: ${result.error}`);
            }
        } catch (error) {
            this.logMessage(`Error crítico al enviar correo: ${error.message}`, 'error');
            alert(`Error crítico al enviar correo: ${error.message}`);
        } finally {
            const emailBtn = document.getElementById('send-email-btn');
            emailBtn.disabled = false;
            emailBtn.textContent = 'Enviar por Correo';
        }
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

    // --- Métodos de Ayuda --- 

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

// Estilos para la nueva interfaz
const style = document.createElement('style');
style.textContent = `
    .file-nav-bar { display: flex; align-items: center; gap: 1rem; padding: 0.5rem; background-color: var(--widget-bg-color); border-radius: var(--border-radius-md); margin-bottom: 1rem; }
    .breadcrumb-display { font-family: monospace; background-color: var(--bg-color); padding: 0.25rem 0.5rem; border-radius: var(--border-radius-sm); }
    .enviar-remision-container { display: flex; gap: 1rem; }
    .remision-col-control { flex: 1; display: flex; flex-direction: column; gap: 1rem; }
    .remision-col-data { flex: 2; display: flex; flex-direction: column; gap: 1rem; }
    .widget-box { background-color: var(--widget-bg-color); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); padding: 1rem; }
    .widget-box h4 { margin-top: 0; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1rem; color: #000000; }
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
    .preview-error { padding: 2rem; text-align: center; }
    /* Estilo para botones con el mismo color que el botón volver */
    .btn-info { 
        background-color: #f8f9fa; 
        color: #212529; 
        border: 1px solid #dee2e6; 
    }
    .btn-info:hover { 
        background-color: #e2e6ea; 
        border-color: #dae0e5; 
    }
    .btn-info:disabled { 
        background-color: #e9ecef; 
        color: #6c757d; 
        border-color: #dee2e6; 
    }
`;
document.head.appendChild(style);