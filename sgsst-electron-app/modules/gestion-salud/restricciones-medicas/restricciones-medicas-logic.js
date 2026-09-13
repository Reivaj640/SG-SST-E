// restricciones-medicas.js - Componente para el submódulo "3.1.6 Restricciones y recomendaciones médicas"

class RestriccionesMedicasComponent {
    constructor(container, companyName, moduleName, submoduleName, logMessage, onBackToModuleHome) {
        this.container = container;
        this.companyName = companyName;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.logMessage = logMessage;
        this.onBackToModuleHome = onBackToModuleHome;
        this.extractedData = null;
        this.lastGeneratedDoc = null;

        // Estado para el explorador de archivos
        this.currentPath = null;
        this.pathHistory = [];
    }

    async render() {
        this.container.innerHTML = '';

        // Exponer this para que el portal HTML pueda acceder al componente
        window.restriccionesMedicasPortalComponent = this;

        // Cargar el CSS del modal si no está cargado
        this._loadModalStyles();

        // Cargar el HTML del portal moderno
        try {
            const response = await fetch('./modules/gestion-salud/restricciones-medicas/restricciones-medicas-home.html');
            if (!response.ok) throw new Error('No se pudo cargar el portal');
            const html = await response.text();

            // Inyectar HTML en el contenedor
            this.container.innerHTML = html;

            // Cargar el JS del portal dinámicamente
            const script = document.createElement('script');
            script.src = './modules/gestion-salud/restricciones-medicas/restricciones-medicas-home.js';
            script.onload = () => {
                // Portal listo, funciones de navegación disponibles
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('[RM] Error cargando portal:', error);
            // Fallback al método anterior si falla el fetch
            this._renderFallbackCards();
        }
    }

    _loadModalStyles() {
        const cssId = 'env-modal-styles';
        if (!document.getElementById(cssId)) {
            const link = document.createElement('link');
            link.id = cssId;
            link.rel = 'stylesheet';
            link.href = './modules/gestion-salud/restricciones-medicas/env-modal.css';
            document.head.appendChild(link);
        }
    }

    // Fallback por si el fetch del HTML falla (método anterior)
    _renderFallbackCards() {
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

        cardsContainer.appendChild(this.createModuleCard('Ver Remisiones Médicas', 'Visualizar historial de remisiones y recomendaciones médicas.', () => this.showNewDocumentViewer()));
        cardsContainer.appendChild(this.createModuleCard('Enviar Remisiones', 'Crear y enviar nuevas remisiones y recomendaciones.', () => this.showEnviarRemisionPage()));
        cardsContainer.appendChild(this.createModuleCard('Control de Remisiones', 'Realizar seguimiento al estado de las remisiones enviadas.', () => this._renderControlRemisionesView()));
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
        // Configurar contenedor padre: ocupa el espacio disponible, no el viewport completo
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';
        this.container.style.flex = '1';
        this.container.style.overflow = 'hidden';
        var self = this;

        self._messageHandler = function(e) { self.handleIframeMessage(e); };
        window.addEventListener('message', self._messageHandler);

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'width:100%;height:100%;flex:1;border:none;display:block;';
        iframe.src = `./modules/gestion-salud/restricciones-medicas/enviar-remision.html`
                   + `?company=${encodeURIComponent(this.companyName)}`
                   + `&module=${encodeURIComponent(this.moduleName)}`
                   + `&submodule=${encodeURIComponent(this.submoduleName)}`;
        self._viewerFrame = iframe;
        this.container.appendChild(iframe);
    }

    showGenerarInformePage(extractedData) {
        this.container.innerHTML = '';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';
        this.container.style.flex = '1';
        this.container.style.overflow = 'hidden';
        var self = this;

        self._messageHandler = function(e) { self.handleIframeMessage(e); };
        window.addEventListener('message', self._messageHandler);

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'width:100%;height:100%;flex:1;border:none;display:block;';
        iframe.src = `./modules/gestion-salud/restricciones-medicas/generar-informe-remision.html`
                   + `?company=${encodeURIComponent(this.companyName)}`
                   + `&module=${encodeURIComponent(this.moduleName)}`
                   + `&submodule=${encodeURIComponent(this.submoduleName)}`
                   + `&data=${encodeURIComponent(JSON.stringify(extractedData))}`;
        self._viewerFrame = iframe;
        this.container.appendChild(iframe);
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

                if (result.controlUpdated) {
                    this.logMessage(`Archivo de control actualizado: ${result.controlPath}`);
                } else if (result.controlWarning) {
                    this.logMessage(`⚠ ADVERTENCIA: ${result.controlWarning}`, 'warning');
                    alert(`Documento generado exitosamente.\n\n⚠ El archivo de control no se pudo actualizar:\n${result.controlWarning}\n\nPor favor, cierre el archivo Excel y vuelva a intentar.`);
                } else {
                    this.logMessage(`Archivo de control actualizado: ${result.controlPath}`);
                }

                // Habilitar botones de envío
                document.getElementById('send-whatsapp-btn').disabled = false;
                document.getElementById('send-email-btn').disabled = false;

                // Mostrar mensaje de éxito
                if (!result.controlWarning) {
                    alert('Documento generado exitosamente.');
                }
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
            const result = await window.electronAPI.sendRemisionByWhatsapp(
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
            this.logMessage(`Datos a enviar - Documento: ${this.lastGeneratedDoc}, Empresa: ${this.companyName}`);
            
            // Registrar algunos datos clave para depuración
            const cedula = this.extractedData['No. Identificación'] || 'No disponible';
            const nombre = this.extractedData['Nombre Completo'] || 'No disponible';
            const fechaAtencion = this.extractedData['Fecha de Atención'] || 'No disponible';
            const afiliacion = this.extractedData['Afiliación'] || 'No disponible';
            
            this.logMessage(`Datos del trabajador - Cédula: ${cedula}, Nombre: ${nombre}, Fecha: ${fechaAtencion}, Afiliación: ${afiliacion}`, 'info');
            
            const emailBtn = document.getElementById('send-email-btn');
            emailBtn.disabled = true;
            emailBtn.textContent = 'Enviando...';
            
            // Llamar al proceso de Python para enviar por correo
            const result = await window.electronAPI.sendRemisionByEmail(
                this.lastGeneratedDoc,
                this.extractedData,
                this.companyName
            );
            
            this.logMessage(`Respuesta del servidor: ${JSON.stringify(result)}`, 'info');
            
            if (result.success) {
                this.logMessage('Correo electrónico enviado exitosamente.');
                alert('Correo electrónico enviado exitosamente.');
            } else {
                // Verificar si el error tiene más detalles
                let errorMessage = result.error || 'Error desconocido al enviar el correo';
                if (typeof result === 'string') {
                    try {
                        const parsedError = JSON.parse(result);
                        errorMessage = parsedError.error || parsedError.message || errorMessage;
                    } catch (e) {
                        // Si no se puede parsear, usar el mensaje original
                    }
                }
                
                this.logMessage(`Error al enviar correo: ${errorMessage}`, 'error');
                alert(`Error al enviar correo: ${errorMessage}`);
            }
        } catch (error) {
            this.logMessage(`Error crítico al enviar correo: ${error.message}`, 'error');
            this.logMessage(`Stack trace: ${error.stack}`, 'error');
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

    createModernHeader(titleText, subtitleText, onBack) {
        const header = document.createElement('header');
        header.className = 'rem-header';

        const leftSide = document.createElement('div');
        leftSide.className = 'rem-header-left';

        const backBtn = document.createElement('button');
        backBtn.className = 'btn btn-back';
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Volver';
        backBtn.onclick = onBack;
        leftSide.appendChild(backBtn);

        const titleGroup = document.createElement('div');
        const h1 = document.createElement('h1');
        h1.className = 'rem-title';
        h1.textContent = titleText;
        titleGroup.appendChild(h1);

        if (subtitleText) {
            const p = document.createElement('p');
            p.className = 'rem-subtitle';
            p.textContent = subtitleText;
            titleGroup.appendChild(p);
        }
        leftSide.appendChild(titleGroup);
        header.appendChild(leftSide);

        const rightSide = document.createElement('div');
        rightSide.className = 'rem-header-right';
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'rem-btn-icon';
        refreshBtn.title = 'Actualizar';
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        // El evento de refresh se manejará según el contexto
        rightSide.appendChild(refreshBtn);
        header.appendChild(rightSide);

        return header;
    }

    createHeader(titleText, onBack) {        const header = document.createElement('div');
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
        card.innerHTML = `<div class="card-body"><h5 class="card-title">${title}</h5><p class="card-text">${description}</p><button class="btn btn-primary btn-ingresar">Acceder</button></div>`;
        card.querySelector('button').addEventListener('click', onClick);
        return card;
    }

    async _renderControlRemisionesView() {
        this.container.innerHTML = '';
        
        // Cargar CSS específico
        this._loadControlStyles();

        const header = this.createModernHeader(
            'Control de Remisiones', 
            'Seguimiento al estado de las remisiones enviadas a las EPS',
            () => this.render()
        );
        this.container.appendChild(header);

        const wrapper = document.createElement('div');
        wrapper.className = 'control-remisiones-wrapper';
        this.container.appendChild(wrapper);

        // Función interna para renderizar contenido
        const renderContent = async () => {
            wrapper.innerHTML = `
                <div class="ctrl-loading">
                    <i class="fas fa-circle-notch fa-spin"></i>
                    <p>Consultando archivo de control oficial...</p>
                </div>
            `;

            try {
                const result = await window.electronAPI.getControlRemisionesData(this.companyName);
                wrapper.innerHTML = ''; // Limpiar carga

                if (result.success) {
                    if (result.rows && result.rows.length > 0) {
                        // Crear Card
                        const card = document.createElement('div');
                        card.className = 'ctrl-card';
                        
                        // Header de la Card
                        card.innerHTML = `
                            <div class="ctrl-card-header">
                                <h4><i class="fas fa-table"></i> Registros de Remisiones</h4>
                                <span class="ctrl-info-item"><i class="fas fa-file-excel"></i> ${result.rows.length} registros</span>
                            </div>
                        `;

                        // Contenedor de Tabla
                        const tableContainer = document.createElement('div');
                        tableContainer.className = 'ctrl-table-container';

                        const table = document.createElement('table');
                        table.className = 'ctrl-table';

                        // Encabezado de Tabla
                        const thead = document.createElement('thead');
                        const headerRow = document.createElement('tr');
                        if (result.headers && Array.isArray(result.headers)) {
                            result.headers.forEach(headerText => {
                                const th = document.createElement('th');
                                th.textContent = headerText;
                                headerRow.appendChild(th);
                            });
                        }
                        thead.appendChild(headerRow);
                        table.appendChild(thead);

                        // Cuerpo de Tabla
                        const tbody = document.createElement('tbody');
                        result.rows.forEach((row, rowIndex) => {
                            const tr = document.createElement('tr');
                            if (Array.isArray(row)) {
                                row.forEach((cellData, cellIndex) => {
                                    const td = document.createElement('td');
                                    
                                    // Si es la última columna (Estado/Observación), hacerla editable con estilo moderno
                                    if (cellIndex === row.length - 1) {
                                        const input = document.createElement('input');
                                        input.type = 'text';
                                        input.className = 'ctrl-input';
                                        input.value = cellData != null ? cellData.toString() : '';
                                        input.placeholder = 'Añadir observación...';
                                        input.addEventListener('change', (e) => {
                                            this.saveCellData(rowIndex, cellIndex, e.target.value, result.filePath);
                                        });
                                        td.appendChild(input);
                                    } else {
                                        td.textContent = cellData != null ? cellData.toString() : '';
                                    }
                                    tr.appendChild(td);
                                });
                            }
                            tbody.appendChild(tr);
                        });
                        table.appendChild(tbody);
                        tableContainer.appendChild(table);
                        card.appendChild(tableContainer);

                        // Footer de Información
                        const footer = document.createElement('div');
                        footer.className = 'ctrl-info-bar';
                        footer.innerHTML = `
                            <div class="ctrl-info-item">
                                <i class="fas fa-hdd"></i>
                                <span>Ruta: ${result.filePath}</span>
                            </div>
                            <div class="ctrl-info-item">
                                <i class="fas fa-info-circle"></i>
                                <span>La última columna es editable</span>
                            </div>
                        `;
                        card.appendChild(footer);
                        wrapper.appendChild(card);
                        
                    } else {
                        wrapper.innerHTML = `
                            <div class="ctrl-empty">
                                <i class="fas fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                                <h3>No hay datos disponibles</h3>
                                <p>El archivo de control para ${this.companyName} está vacío.</p>
                                <button class="ctrl-btn-retry" id="retry-btn">Reintentar</button>
                            </div>
                        `;
                        wrapper.querySelector('#retry-btn')?.addEventListener('click', renderContent);
                    }
                } else {
                    wrapper.innerHTML = `
                        <div class="ctrl-error">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h3>Error al cargar datos</h3>
                            <p>${result.error}</p>
                            <button class="ctrl-btn-retry" id="retry-btn">Intentar de nuevo</button>
                        </div>
                    `;
                    wrapper.querySelector('#retry-btn').addEventListener('click', renderContent);
                }
            } catch (error) {
                wrapper.innerHTML = `
                    <div class="ctrl-error">
                        <i class="fas fa-bomb"></i>
                        <h3>Error inesperado</h3>
                        <p>${error.message}</p>
                        <button class="ctrl-btn-retry" id="retry-btn">Reiniciar vista</button>
                    </div>
                `;
                wrapper.querySelector('#retry-btn').addEventListener('click', renderContent);
            }
        };

        await renderContent();
    }

    _loadControlStyles() {
        const cssId = 'ctrl-remisiones-styles';
        if (!document.getElementById(cssId)) {
            const link = document.createElement('link');
            link.id = cssId;
            link.rel = 'stylesheet';
            link.href = './modules/gestion-salud/restricciones-medicas/control-remisiones.css';
            document.head.appendChild(link);
        }
    }

    // Agrega este método a la clase RestriccionesMedicasComponent
    async saveCellData(rowIndex, colIndex, newValue, filePath) {
        try {
            this.logMessage(`Guardando cambios en fila ${rowIndex + 2}, columna ${colIndex + 1}...`);
            const result = await window.electronAPI.updateExcelCell(
                filePath, 
                rowIndex + 2, // +1 por encabezado (Fila 1), +1 por base 1-indexed de Excel
                colIndex + 1, // 1-indexed para Excel
                newValue
            );
            
            if (result.success) {
                this.logMessage('Cambios guardados exitosamente en el archivo Excel.');
            } else {
                this.logMessage(`Error al guardar cambios: ${result.error}`, 'error');
                alert(`Error al guardar cambios: ${result.error}`);
            }
        } catch (error) {
            this.logMessage(`Error crítico al guardar cambios: ${error.message}`, 'error');
            alert(`Error crítico al guardar cambios: ${error.message}`);
        }
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
    .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
        margin-bottom: 1rem;
    }
    .data-table th, .data-table td {
        padding: 8px;
        border: 1px solid #ddd;
        text-align: left;
        vertical-align: top;
        white-space: nowrap;
    }
    .data-table th {
        background-color: #f8f9fa;
        font-weight: bold;
        position: sticky;
        top: 0;
        z-index: 1;
    }
    .data-table tr:nth-child(even) {
        background-color: #f8f9fa;
    }
    .data-table tr:hover {
        background-color: #e9ecef;
    }
    .control-remisiones-content {
        max-height: 70vh;
        overflow-y: auto;
    }
`;

// Adjuntar estilos al documento
document.head.appendChild(style);

// ═══════════════════════════════════════════════════════════
// BRIDGE: Escucha mensajes del iframe del viewer
// ═══════════════════════════════════════════════════════════

RestriccionesMedicasComponent.prototype.handleIframeMessage = function(event) {
    if (!event.data || !event.data.type) return;
    if (this._viewerFrame && event.source !== this._viewerFrame.contentWindow) return;
    var self = this;
    var type = event.data.type;
    var requestId = event.data.requestId;
    var payload = event.data.payload;

    switch (type) {
        case 'back-to-submodule-home':
            console.log('[RM-BRIDGE] Regresando al home del submódulo 3.1.6');
            if (self._messageHandler) {
                window.removeEventListener('message', self._messageHandler);
                self._messageHandler = null;
            }
            if (self._viewerFrame) {
                self._viewerFrame.remove();
                self._viewerFrame = null;
            }
            self.render();
            break;
        case 'back-to-module-request':
            console.log('[RM-BRIDGE] Regresando a la antesala del submódulo 3.1.6');
            if (self._messageHandler) {
                window.removeEventListener('message', self._messageHandler);
                self._messageHandler = null;
            }
            if (self._viewerFrame) {
                self._viewerFrame.remove();
                self._viewerFrame = null;
            }
            self.render();
            break;
        case 'open-file-viewer-modal':
            // 📦608-fix13: el iframe pide abrir el archivo en el modal file-viewer del parent
            if (event.data && event.data.filePath && window.kairFV && typeof window.kairFV.openWithFileViewerFromPath === 'function') {
                window.kairFV.openWithFileViewerFromPath(event.data.filePath);
            } else if (event.data && event.data.filePath) {
                console.warn('[RM-BRIDGE] kairFV.openWithFileViewerFromPath no disponible');
            }
            break;
        case 'get-pdf-preview-request':
            self._handlePreview(event, 'getPDFPreview', requestId, payload);
            break;
        case 'get-word-preview-request':
            self._handlePreview(event, 'getWordPreview', requestId, payload);
            break;
        case 'get-excel-preview-request':
            self._handlePreview(event, 'getExcelPreview', requestId, payload);
            break;
        case 'get-document-folders-request':
            self._handleFolders(event, 'getDocumentFolders', requestId, payload);
            break;
        case 'get-documents-in-folder-request':
            self._handleDocsInFolder(event, 'getDocumentsInFolder', requestId, payload);
            break;
        case 'download-document-request':
            self._handleDownload(event, 'downloadDocument', requestId, payload);
            break;
        case 'open-path-request':
            self._handleOpenPath(event, 'openPath', requestId, payload);
            break;

        // ── Enviar Remisiones ──────────────────────────────────────────
        case 'select-pdf-file-request':
            window.electronAPI.selectPdfFile()
                .then(function(filePath) {
                    event.source.postMessage({ type: 'select-pdf-file-response', requestId: requestId,
                        payload: { success: true, filePath: filePath || null } }, '*');
                })
                .catch(function(e) {
                    event.source.postMessage({ type: 'select-pdf-file-response', requestId: requestId,
                        payload: { success: false, error: e.message } }, '*');
                });
            break;

        case 'process-remision-pdf-request':
            window.electronAPI.processRemisionPdf(payload && payload.filePath)
                .then(function(r) {
                    event.source.postMessage({ type: 'process-remision-pdf-response', requestId: requestId,
                        payload: { success: r.success, data: r.data, error: r.error } }, '*');
                })
                .catch(function(e) {
                    event.source.postMessage({ type: 'process-remision-pdf-response', requestId: requestId,
                        payload: { success: false, error: e.message } }, '*');
                });
            break;

        case 'generate-remision-doc-request':
            window.electronAPI.generateRemisionDocument(payload && payload.extractedData, self.companyName)
                .then(function(r) {
                    event.source.postMessage({ type: 'generate-remision-doc-response', requestId: requestId,
                        payload: { success: r.success, documentPath: r.documentPath, controlPath: r.controlPath, controlUpdated: r.controlUpdated, controlWarning: r.controlWarning, error: r.error } }, '*');
                })
                .catch(function(e) {
                    event.source.postMessage({ type: 'generate-remision-doc-response', requestId: requestId,
                        payload: { success: false, error: e.message } }, '*');
                });
            break;

        case 'send-remision-whatsapp-request':
            window.electronAPI.sendRemisionByWhatsapp(
                    payload && payload.documentPath,
                    payload && payload.extractedData,
                    self.companyName)
                .then(function(r) {
                    event.source.postMessage({ type: 'send-remision-whatsapp-response', requestId: requestId,
                        payload: { success: r.success, error: r.error } }, '*');
                })
                .catch(function(e) {
                    event.source.postMessage({ type: 'send-remision-whatsapp-response', requestId: requestId,
                        payload: { success: false, error: e.message } }, '*');
                });
            break;

        case 'send-remision-email-request':
            window.electronAPI.sendRemisionByEmail(
                    payload && payload.documentPath,
                    payload && payload.extractedData,
                    self.companyName)
                .then(function(r) {
                    event.source.postMessage({ type: 'send-remision-email-response', requestId: requestId,
                        payload: { success: r.success, error: r.error } }, '*');
                })
                .catch(function(e) {
                    event.source.postMessage({ type: 'send-remision-email-response', requestId: requestId,
                        payload: { success: false, error: e.message } }, '*');
                });
            break;

        // ── Generar Informe (nuevo paso intermedio) ──────────────────
        case 'informe-data-request':
            event.source.postMessage({ type: 'informe-data-response', requestId: requestId,
                payload: { extractedData: self.extractedData || {} } }, '*');
            break;

        case 'back-to-verify-request':
            if (self._messageHandler) {
                window.removeEventListener('message', self._messageHandler);
                self._messageHandler = null;
            }
            self.showEnviarRemisionPage();
            break;

        case 'continue-to-send-request':
            if (self._messageHandler) {
                window.removeEventListener('message', self._messageHandler);
                self._messageHandler = null;
            }
            // Al continuar, se navega a la página de envío con los datos del documento generado
            self.lastGeneratedDoc = payload && payload.documentPath;
            self.extractedData = payload && payload.extractedData;
            self._renderSendOnlyPage();
            break;

        case 'navigate-to-generar-informe-request':
            if (self._messageHandler) {
                window.removeEventListener('message', self._messageHandler);
                self._messageHandler = null;
            }
            // Guardar datos extraídos y navegar a generar informe
            self.extractedData = payload && payload.extractedData;
            self.showGenerarInformePage(self.extractedData);
            break;
    }
};

RestriccionesMedicasComponent.prototype._handlePreview = async function(event, apiName, requestId, payload) {
    // 📦608-fix15: helper genérico — para Office usa readFileBytes, para PDF usa la API vieja.
    // El helper ya hace el postMessage de la respuesta, no lo duplicamos acá.
    if (window.KairDocPreview && typeof window.KairDocPreview.handleRequest === 'function') {
        try { await window.KairDocPreview.handleRequest(event, apiName); }
        catch (e) {
            var typeKey = apiName === 'getPDFPreview'   ? 'get-pdf-preview-response'
                        : apiName === 'getWordPreview'  ? 'get-word-preview-response'
                        : apiName === 'getExcelPreview' ? 'get-excel-preview-response'
                        : apiName + '-response';
            event.source.postMessage({ type: typeKey, requestId: requestId, payload: { success: false, error: e.message } }, '*');
        }
        return;
    }
    // Fallback al flujo viejo si el helper no está cargado
    var filePath = payload && payload.filePath;
    var typeKey = apiName === 'getPDFPreview'   ? 'get-pdf-preview-response'
                : apiName === 'getWordPreview'  ? 'get-word-preview-response'
                : apiName === 'getExcelPreview' ? 'get-excel-preview-response'
                : apiName + '-response';
    try {
        var result = await window.electronAPI[apiName](filePath);
        event.source.postMessage({ type: typeKey, requestId: requestId, payload: { success: result.success, data: result.data, error: result.error } }, '*');
    } catch(e) {
        event.source.postMessage({ type: typeKey, requestId: requestId, payload: { success: false, error: e.message } }, '*');
    }
};

RestriccionesMedicasComponent.prototype._handleFolders = async function(event, apiName, requestId, payload) {
    try {
        var result = await window.electronAPI[apiName](payload);
        event.source.postMessage({ type: 'get-document-folders-response', requestId: requestId, payload: { success: result.success, folders: result.folders||[], files: result.files||[], error: result.error } }, '*');
    } catch(e) {
        event.source.postMessage({ type: 'get-document-folders-response', requestId: requestId, payload: { success: false, error: e.message } }, '*');
    }
};

RestriccionesMedicasComponent.prototype._handleDocsInFolder = async function(event, apiName, requestId, payload) {
    var folderPath = typeof payload === 'string' ? payload : (payload && payload.folderPath);
    try {
        var result = await window.electronAPI[apiName](folderPath);
        event.source.postMessage({ type: 'get-documents-in-folder-response', requestId: requestId, payload: { success: result.success, files: result.files||[], error: result.error } }, '*');
    } catch(e) {
        event.source.postMessage({ type: 'get-documents-in-folder-response', requestId: requestId, payload: { success: false, error: e.message } }, '*');
    }
};

RestriccionesMedicasComponent.prototype._handleDownload = async function(event, apiName, requestId, payload) {
    try {
        var result = await window.electronAPI[apiName](payload);
        event.source.postMessage({ type: 'download-document-response', requestId: requestId, payload: { success: result.success, fileName: result.fileName, base64Data: result.base64Data, error: result.error } }, '*');
    } catch(e) {
        event.source.postMessage({ type: 'download-document-response', requestId: requestId, payload: { success: false, error: e.message } }, '*');
    }
};

RestriccionesMedicasComponent.prototype._handleOpenPath = async function(event, apiName, requestId, payload) {
    try {
        var result = await window.electronAPI[apiName](payload);
        event.source.postMessage({ type: 'open-path-response', requestId: requestId, payload: { success: result.success, error: result.error } }, '*');
    } catch(e) {
        event.source.postMessage({ type: 'open-path-response', requestId: requestId, payload: { success: false, error: e.message } }, '*');
    }
};

// ═══════════════════════════════════════════════════════════
// Definir el método showNewDocumentViewer correctamente como método del prototipo
// ═══════════════════════════════════════════════════════════

RestriccionesMedicasComponent.prototype.showNewDocumentViewer = function() {
    this.container.innerHTML = '';
    var self = this;

    // Store named handler so removeEventListener can match the exact reference
    self._messageHandler = function(e) { self.handleIframeMessage(e); };
    window.addEventListener('message', self._messageHandler);

    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = 'calc(100vh - 60px)';
    iframe.style.border = 'none';
    iframe.style.display = 'block';

    const viewerUrl = `./modules/gestion-salud/restricciones-medicas/remisiones-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
    iframe.src = viewerUrl;
    self._viewerFrame = iframe;

    this.container.appendChild(iframe);
};

// ═══════════════════════════════════════════════════════════
// Página de solo envío (después de generar informe) - MODAL
// ═══════════════════════════════════════════════════════════

RestriccionesMedicasComponent.prototype._renderSendOnlyPage = function() {
    var self = this;

    // Extraer datos del documento
    var docPath = self.lastGeneratedDoc || '';
    var docName = docPath.split(/[\\/]/).pop() || 'Documento generado';
    var nombre = (self.extractedData && self.extractedData['Nombre Completo']) || 'N/A';
    var cedula = (self.extractedData && self.extractedData['No. Identificación']) || 'N/A';
    var fecha = (self.extractedData && self.extractedData['Fecha de Atención']) || 'N/A';

    // Crear overlay del modal
    var overlay = document.createElement('div');
    overlay.className = 'env-modal-overlay';
    overlay.id = 'sendModalOverlay';

    // Crear modal
    var modal = document.createElement('div');
    modal.className = 'env-modal';
    modal.innerHTML = 
        '<div class="env-modal-header">' +
            '<div class="env-modal-title">' +
                '<i class="fas fa-paper-plane" style="font-size: 1.5rem; color: var(--env-primary);"></i>' +
                '<h2>Enviar Remisión Generada</h2>' +
            '</div>' +
            '<button class="env-modal-close" id="modalCloseBtn" aria-label="Cerrar">' +
                '<i class="fas fa-times"></i>' +
            '</button>' +
        '</div>' +
        '<div class="env-modal-body">' +
            '<div class="env-success-banner">' +
                '<i class="fas fa-check-circle"></i>' +
                '<div class="env-success-text">' +
                    '<h3>Informe Generado Exitosamente</h3>' +
                    '<p>Seleccione el método de envío para el documento</p>' +
                '</div>' +
            '</div>' +
            '<div class="env-doc-info-card">' +
                '<div class="env-doc-info-row">' +
                    '<i class="fas fa-file-word"></i>' +
                    '<span class="env-doc-label">Documento:</span>' +
                    '<span class="env-doc-value">' + docName + '</span>' +
                '</div>' +
                '<div class="env-doc-info-row">' +
                    '<i class="fas fa-user"></i>' +
                    '<span class="env-doc-label">Trabajador:</span>' +
                    '<span class="env-doc-value">' + nombre + '</span>' +
                '</div>' +
                '<div class="env-doc-info-row">' +
                    '<i class="fas fa-id-card"></i>' +
                    '<span class="env-doc-label">Cédula:</span>' +
                    '<span class="env-doc-value">' + cedula + '</span>' +
                '</div>' +
                '<div class="env-doc-info-row">' +
                    '<i class="fas fa-calendar"></i>' +
                    '<span class="env-doc-label">Fecha Atención:</span>' +
                    '<span class="env-doc-value">' + fecha + '</span>' +
                '</div>' +
                '<div class="env-doc-actions" style="margin-top: 1rem; text-align: center;">' +
                    '<button class="env-btn env-btn-secondary env-btn-sm" id="openFolderBtn" title="Abrir carpeta donde se guardó el archivo">' +
                        '<i class="fas fa-folder-open"></i> Abrir Carpeta' +
                    '</button>' +
                '</div>' +
            '</div>' +
            '<div class="env-modal-actions">' +
                '<button class="env-send-btn env-send-wa" id="modalWhatsappBtn">' +
                    '<i class="fab fa-whatsapp env-send-icon" style="color: var(--env-wa);"></i>' +
                    '<span class="env-send-label">WhatsApp</span>' +
                    '<span class="env-send-contact" id="waContactInfo">Buscando teléfono...</span>' +
                '</button>' +
                '<button class="env-send-btn env-send-email" id="modalEmailBtn">' +
                    '<i class="fas fa-envelope env-send-icon" style="color: var(--env-primary);"></i>' +
                    '<span class="env-send-label">Correo Electrónico</span>' +
                    '<span class="env-send-contact" id="emailContactInfo">Buscando email...</span>' +
                '</button>' +
            '</div>' +
            '<div class="env-send-status" id="sendStatus">' +
                '<i class="fas fa-spinner fa-spin"></i>' +
                '<p id="sendStatusText">Procesando...</p>' +
            '</div>' +
        '</div>' +
        '<div class="env-modal-footer">' +
            '<p>El documento se enviará con los datos de contacto registrados en la base de datos</p>' +
        '</div>';

    overlay.appendChild(modal);
    this.container.appendChild(overlay);

    // Event listeners
    document.getElementById('modalCloseBtn').addEventListener('click', function() {
        self._closeSendModal();
    });

    // Cerrar al hacer clic en el overlay
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            self._closeSendModal();
        }
    });

    // Buscar contacto y actualizar botones
    this._loadContactInfo();

    // Handlers de botones de envío
    document.getElementById('modalWhatsappBtn').addEventListener('click', function() {
        self._handleModalWhatsApp();
    });

    document.getElementById('modalEmailBtn').addEventListener('click', function() {
        self._handleModalEmail();
    });
};

// Cargar información de contacto
RestriccionesMedicasComponent.prototype._loadContactInfo = async function() {
    var self = this;
    var cedula = (this.extractedData && this.extractedData['No. Identificación']) || '';
    var empresa = this.companyName || 'TEMPOACTIVA';

    if (!cedula) {
        document.getElementById('waContactInfo').textContent = 'Cédula no disponible';
        document.getElementById('emailContactInfo').textContent = 'Cédula no disponible';
        document.getElementById('modalWhatsappBtn').disabled = true;
        document.getElementById('modalEmailBtn').disabled = true;
        return;
    }

    try {
        var result = await window.electronAPI.getContactInfo(cedula, empresa);
        
        if (result && result.success) {
            var telefono = result.telefono;
            var email = result.email;

            if (telefono) {
                document.getElementById('waContactInfo').textContent = telefono;
                document.getElementById('modalWhatsappBtn').disabled = false;
            } else {
                document.getElementById('waContactInfo').textContent = 'Teléfono no encontrado';
                document.getElementById('modalWhatsappBtn').disabled = true;
            }

            if (email) {
                document.getElementById('emailContactInfo').textContent = email;
                document.getElementById('modalEmailBtn').disabled = false;
            } else {
                document.getElementById('emailContactInfo').textContent = 'Email no encontrado';
                document.getElementById('modalEmailBtn').disabled = true;
            }
        } else {
            document.getElementById('waContactInfo').textContent = 'Contacto no encontrado';
            document.getElementById('emailContactInfo').textContent = 'Contacto no encontrado';
            document.getElementById('modalWhatsappBtn').disabled = true;
            document.getElementById('modalEmailBtn').disabled = true;
        }
    } catch (error) {
        console.error('[SendModal] Error cargando contacto:', error);
        document.getElementById('waContactInfo').textContent = 'Error al buscar contacto';
        document.getElementById('emailContactInfo').textContent = 'Error al buscar contacto';
        document.getElementById('modalWhatsappBtn').disabled = true;
        document.getElementById('modalEmailBtn').disabled = true;
    }
};

// Enviar por WhatsApp desde modal
RestriccionesMedicasComponent.prototype._handleModalWhatsApp = async function() {
    var self = this;
    var btn = document.getElementById('modalWhatsappBtn');
    var statusDiv = document.getElementById('sendStatus');
    var statusText = document.getElementById('sendStatusText');

    btn.disabled = true;
    btn.innerHTML = '<div class="env-send-spinner"></div><span class="env-send-label">Enviando...</span>';
    statusDiv.className = 'env-send-status';
    statusText.textContent = 'Preparando WhatsApp...';

    try {
        var result = await window.electronAPI.sendRemisionByWhatsapp(
            this.lastGeneratedDoc,
            this.extractedData,
            this.companyName
        );

        if (result.success) {
            statusDiv.className = 'env-send-status env-status-success';
            statusText.textContent = '¡WhatsApp abierto correctamente!';
            btn.innerHTML = '<i class="fas fa-check" style="color: white;"></i><span class="env-send-label" style="color: white;">Enviado</span>';
            btn.style.backgroundColor = 'var(--env-wa)';
            btn.style.borderColor = 'var(--env-wa)';
        } else {
            statusDiv.className = 'env-send-status env-status-error';
            statusText.textContent = result.error || 'Error al enviar';
            btn.disabled = false;
            btn.innerHTML = '<i class="fab fa-whatsapp env-send-icon" style="color: var(--env-wa);"></i><span class="env-send-label">Reintentar</span>';
        }
    } catch (error) {
        console.error('[SendModal] Error WhatsApp:', error);
        statusDiv.className = 'env-send-status env-status-error';
        statusText.textContent = 'Error: ' + error.message;
        btn.disabled = false;
        btn.innerHTML = '<i class="fab fa-whatsapp env-send-icon" style="color: var(--env-wa);"></i><span class="env-send-label">Reintentar</span>';
    }
};

// Enviar por Email desde modal
RestriccionesMedicasComponent.prototype._handleModalEmail = async function() {
    var self = this;
    var btn = document.getElementById('modalEmailBtn');
    var statusDiv = document.getElementById('sendStatus');
    var statusText = document.getElementById('sendStatusText');

    btn.disabled = true;
    btn.innerHTML = '<div class="env-send-spinner"></div><span class="env-send-label">Enviando...</span>';
    statusDiv.className = 'env-send-status';
    statusText.textContent = 'Enviando correo...';

    try {
        var result = await window.electronAPI.sendRemisionByEmail(
            this.lastGeneratedDoc,
            this.extractedData,
            this.companyName
        );

        if (result.success) {
            statusDiv.className = 'env-send-status env-status-success';
            statusText.textContent = '¡Correo enviado exitosamente!';
            btn.innerHTML = '<i class="fas fa-check" style="color: white;"></i><span class="env-send-label" style="color: white;">Enviado</span>';
            btn.style.backgroundColor = 'var(--env-primary)';
            btn.style.borderColor = 'var(--env-primary)';
        } else {
            statusDiv.className = 'env-send-status env-status-error';
            statusText.textContent = result.error || 'Error al enviar';
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-envelope env-send-icon" style="color: var(--env-primary);"></i><span class="env-send-label">Reintentar</span>';
        }
    } catch (error) {
        console.error('[SendModal] Error Email:', error);
        statusDiv.className = 'env-send-status env-status-error';
        statusText.textContent = 'Error: ' + error.message;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-envelope env-send-icon" style="color: var(--env-primary);"></i><span class="env-send-label">Reintentar</span>';
    }
};

// Cerrar modal
RestriccionesMedicasComponent.prototype._closeSendModal = function() {
    var overlay = document.getElementById('sendModalOverlay');
    if (overlay) {
        overlay.remove();
    }
    // Regresar a la sección de procesar remisión, no al inicio
    this.showEnviarRemisionPage();
};