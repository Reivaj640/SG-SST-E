// investigacion-accidentes.js - Componente para el submódulo "3.2.2 Investigación de Accidentes, indicentes y Enfermedades"



class InvestigacionAccidentesComponent {
    constructor(container, currentCompany, moduleName, submoduleName, onBack) {
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBack = onBack;
        this.currentView = 'main'; // 'main' o 'realizar-investigacion'
        this.currentPath = null;
        this.pathHistory = [];

        // Bind methods
        this.openDocument = this.openDocument.bind(this);
    }

  render() {
    if (this._iframeMessageHandler) {
      window.removeEventListener('message', this._iframeMessageHandler);
      this._iframeMessageHandler = null;
    }
    this.container.innerHTML = '';
    window.currentInvestigacionAccidentesComponent = this;

        // Crear el contenedor principal
        const mainContainer = document.createElement('div');
        mainContainer.className = 'submodule-content';

        if (this.currentView === 'main') {
            this.renderMainView(mainContainer);
        } else if (this.currentView === 'realizar-investigacion') {
            this.renderRealizarInvestigacionView(mainContainer);
        } else if (this.currentView === 'ver-investigacion') {
            this.showVerInvestigacionPage();
        }

        this.container.appendChild(mainContainer);
    }

    renderMainView(container) {
        // Cargar la nueva antesala estilo portal
        this.showPortalHome(container);
    }

    showPortalHome(container) {
        container.innerHTML = '';

        const iframe = document.createElement('iframe');
        iframe.src = `./modules/gestion-salud/investigacion-accidentes/investigacion-home.html?company=${encodeURIComponent(this.currentCompany)}`;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.background = 'white';

        container.appendChild(iframe);

        this.setupPortalCommunication(iframe);
    }

    setupPortalCommunication(iframe) {
        if (this._portalMessageHandler) {
            window.removeEventListener('message', this._portalMessageHandler);
        }

        this._portalMessageHandler = (event) => {
            if (event.source !== iframe.contentWindow) {
                return;
            }

            const { type, action } = event.data;

            if (type === 'back-to-module-request') {
                if (this.onBack && typeof this.onBack === 'function') {
                    this.onBack();
                }
            }

            if (type === 'investigacion-home-action') {
                if (action === 'realizar-investigacion') {
                    this.handlePerformInvestigation();
                } else if (action === 'ver-investigaciones') {
                    this.handleViewInvestigation();
                }
            }
        };

        window.addEventListener('message', this._portalMessageHandler);
    }
    
    // Método para mostrar la nueva interfaz de investigación con IA
    handleAIInvestigation() {
        console.log('[INVESTIGACION-ACCIDENTES] handleAIInvestigation llamado - INICIO');
        console.log('[INVESTIGACION-ACCIDENTES] Cambiando a vista de investigación con IA');
        // Cambiar a la vista de investigación con IA usando iframe
        this.currentView = 'root-cause-investigation';
        this.render();
    }

    renderRealizarInvestigacionView(container) {
        // Crear una instancia del nuevo componente de investigación de accidente
        if (typeof window.InvestigacionAccidenteComponent === 'function') {
            try {
                const investigacionAccidenteComponent = new window.InvestigacionAccidenteComponent(
                    container,
                    this.currentCompany,
                    this.moduleName,
                    this.submoduleName,
                    () => {
                        this.currentView = 'main';
                        this.render();
                    }
                );
                investigacionAccidenteComponent.render();
            } catch (error) {
                console.error('Error al crear/renderizar InvestigacionAccidenteComponent:', error);
                this.renderFallbackView(container);
            }
        } else {
            // Fallback si el componente no está disponible
            this.renderFallbackView(container);
        }
    }

    renderFallbackView(container) {
        const header = document.createElement('div');
        header.className = 'submodule-header';

        const title = document.createElement('h2');
        title.textContent = 'Realizar Investigación';
        header.appendChild(title);

        const backButton = document.createElement('button');
        backButton.className = 'btn';
        backButton.textContent = '← Volver';
        backButton.addEventListener('click', () => {
            this.currentView = 'main';
            this.render();
        });
        header.appendChild(backButton);

        container.appendChild(header);

        const message = document.createElement('p');
        message.textContent = 'La funcionalidad de investigación de accidentes está en desarrollo.';
        container.appendChild(message);
    }

    createModuleCard(title, description, onClick) {
        const card = document.createElement('div');
        card.className = 'card module-card';

        // Contenedor para el ícono y el título
        const headerDiv = document.createElement('div');
        headerDiv.className = 'card-header';

        // Placeholder para el ícono
        const iconDiv = document.createElement('div');
        iconDiv.className = 'card-icon-placeholder';
        headerDiv.appendChild(iconDiv);

        const cardTitle = document.createElement('h3');
        cardTitle.textContent = title;
        cardTitle.className = 'card-title';
        headerDiv.appendChild(cardTitle);

        card.appendChild(headerDiv);

        const cardDescription = document.createElement('p');
        cardDescription.textContent = description;
        cardDescription.className = 'card-description';
        card.appendChild(cardDescription);

        const cardButton = document.createElement('button');
        cardButton.className = 'btn btn-primary';
        cardButton.textContent = 'Abrir';
        cardButton.addEventListener('click', onClick);
        card.appendChild(cardButton);

        return card;
    }

    handleViewInvestigation() {
        // Redirigir a la interfaz moderna de visualización de investigaciones
        this.showModernDocumentViewer();
    }

    showModernDocumentViewer() {
        this.container.innerHTML = '';

        const iframe = document.createElement('iframe');
        iframe.src = `./modules/gestion-salud/investigacion-accidentes/investigaciones-view.html?company=${encodeURIComponent(this.currentCompany)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.background = 'white';

        this.container.appendChild(iframe);

        this.setupIframeCommunication(iframe);
    }

    handlePerformInvestigation() {
        // Redirigir a la nueva interfaz moderna de investigación de accidentes
        this.showModernInvestigationInterface();
    }

  showModernInvestigationInterface(investigacionNombre, furatPath) {
    if (this._portalMessageHandler) {
      window.removeEventListener('message', this._portalMessageHandler);
      this._portalMessageHandler = null;
    }
    this.container.innerHTML = '';

        const iframe = document.createElement('iframe');
        let src = `./modules/gestion-salud/investigacion-accidentes/investigacion-accidentes-view.html?company=${encodeURIComponent(this.currentCompany)}`;
        if (investigacionNombre) {
            src += `&nombre=${encodeURIComponent(investigacionNombre)}`;
        }
        if (furatPath) {
            src += `&furatPath=${encodeURIComponent(furatPath)}`;
        }
        iframe.src = src;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.background = 'white';

        this.container.appendChild(iframe);

        this.setupIframeCommunication(iframe);
    }

    setupIframeCommunication(iframe) {
        if (this._iframeMessageHandler) {
            window.removeEventListener('message', this._iframeMessageHandler);
        }
        
        this._iframeMessageHandler = (event) => {
            if (event.source !== iframe.contentWindow) {
                return;
            }

            const { type } = event.data;

            if (type === 'goBack' || type === 'back-to-module-request' || type === 'back-to-investigacion-home') {
                this.currentView = 'main';
                this.render();
            } else if (type === 'iniciar-investigacion-desde-viewer') {
                const { investigacionNombre, furatPath } = event.data;
                this.showModernInvestigationInterface(investigacionNombre, furatPath);
            }
        };

        window.addEventListener('message', this._iframeMessageHandler);

        console.log('[INVESTIGACION-ACCIDENTES-LOGIC] Comunicación iframe configurada');
    }

    async handleProcessAccidentPdf(payload, requestId, iframe) {
        try {
            if (window.electronAPI && typeof window.electronAPI.processAccidentPdf === 'function') {
                const result = await window.electronAPI.processAccidentPdf(payload.pdfPath);
                
                // Enviar respuesta al iframe
                iframe.contentWindow.postMessage({
                    type: 'investigacion-accidentes-process-accident-pdf-request-response',
                    requestId: requestId,
                    success: true,
                    payload: result
                }, '*');
            } else {
                throw new Error('electronAPI.processAccidentPdf no está disponible');
            }
        } catch (error) {
            console.error('[INVESTIGACION-ACCIDENTES-LOGIC] Error procesando PDF:', error);
            
            // Enviar error al iframe
            iframe.contentWindow.postMessage({
                type: 'investigacion-accidentes-process-accident-pdf-request-response',
                requestId: requestId,
                success: false,
                error: error.message
            }, '*');
        }
    }

    async handleAnalyzeAccident(payload, requestId, iframe) {
        try {
            if (window.electronAPI && typeof window.electronAPI.analyzeAccident === 'function') {
                const result = await window.electronAPI.analyzeAccident(payload.extractedData, payload.contextoAdicional);
                
                // Enviar respuesta al iframe
                iframe.contentWindow.postMessage({
                    type: 'investigacion-accidentes-analyze-accident-request-response',
                    requestId: requestId,
                    success: true,
                    payload: result
                }, '*');
            } else {
                throw new Error('electronAPI.analyzeAccident no está disponible');
            }
        } catch (error) {
            console.error('[INVESTIGACION-ACCIDENTES-LOGIC] Error analizando accidente:', error);
            
            // Enviar error al iframe
            iframe.contentWindow.postMessage({
                type: 'investigacion-accidentes-analyze-accident-request-response',
                requestId: requestId,
                success: false,
                error: error.message
            }, '*');
        }
    }

    async handleSaveTempPdf(payload, requestId, iframe) {
        try {
            // Enviar solicitud al proceso principal para guardar el archivo temporalmente
            // Usamos el método expuesto en electronAPI directamente
            const result = await window.electronAPI.saveTempPdfFile(payload.filename, payload.data);
            
            // Enviar respuesta al iframe
            iframe.contentWindow.postMessage({
                type: 'investigacion-accidentes-save-temp-pdf-file-response',
                requestId: requestId,
                success: true,
                payload: result
            }, '*');
        } catch (error) {
            console.error('[INVESTIGACION-ACCIDENTES-LOGIC] Error guardando archivo temporal:', error);
            
            // Enviar error al iframe
            iframe.contentWindow.postMessage({
                type: 'investigacion-accidentes-save-temp-pdf-file-response',
                requestId: requestId,
                success: false,
                error: error.message
            }, '*');
        }
    }

    handleComingSoon() {
        // Mostrar mensaje de funcionalidad próxima
        alert('Esta funcionalidad estará disponible próximamente.');
    }

    handleSubmitInvestigacion(form) {
        // Obtener los valores del formulario
        const tipoInvestigacion = form.querySelector('#tipo-investigacion').value;
        const fechaOcurrencia = form.querySelector('#fecha-ocurrencia').value;
        const descripcion = form.querySelector('#descripcion').value;
        const departamento = form.querySelector('#departamento').value;
        const trabajador = form.querySelector('#trabajador').value;

        // Validar campos requeridos
        if (!tipoInvestigacion || !fechaOcurrencia || !descripcion || !departamento) {
            alert('Por favor complete todos los campos marcados con *');
            return;
        }

        // Mostrar mensaje de confirmación
        alert(`Investigación iniciada correctamente:\n\nTipo: ${tipoInvestigacion}\nFecha: ${fechaOcurrencia}\nDepartamento: ${departamento}\n\nLa investigación se ha registrado en el sistema y está lista para ser procesada.`);

        // Volver a la vista principal
        this.currentView = 'main';
        this.render();
    }

    showVerInvestigacionPage() {
        this.container.innerHTML = '';
        this.currentPath = null;
        this.pathHistory = [];

        const header = this.createHeader('Ver Investigaciones', () => {
            this.currentView = 'main';
            this.render();
        });
        this.container.appendChild(header);

        const navBar = document.createElement('div');
        navBar.className = 'file-nav-bar';
        this.container.appendChild(navBar);

        const mainLayout = document.createElement('div');
        mainLayout.className = 'remisiones-layout'; // Re-using class for layout

        const resultsCol = document.createElement('div');
        resultsCol.id = 'search-results-col';
        resultsCol.className = 'search-results-col';
        mainLayout.appendChild(resultsCol);

        const previewCol = document.createElement('div');
        previewCol.id = 'preview-col';
        previewCol.className = 'preview-col';
        previewCol.innerHTML = `<div class="preview-placeholder">Seleccione una investigación para previsualizarla.</div>`;
        mainLayout.appendChild(previewCol);

        this.container.appendChild(mainLayout);

        this.navigateToInitialPath();
    }

    async navigateToInitialPath() {
        try {
            const result = await window.electronAPI.findSubmodulePath(this.currentCompany, this.moduleName, this.submoduleName);
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

        const allowedExtensions = ['.pdf', '.doc', '.docx', '.xlsx', '.xls'];
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
            const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
            let icon = '📄';
            if (extension === '.pdf') icon = '📕';
            else if (extension === '.doc' || extension === '.docx') icon = '📘';
            else if (extension === '.xlsx' || extension === '.xls') icon = '📊';

            li.innerHTML = `${icon} ${file.name}`;
            li.addEventListener('click', () => this.previewDocument(file.path));
            list.appendChild(li);
        });

        if (list.children.length === 0) {
            resultsCol.innerHTML = '<p>No hay investigaciones o carpetas para mostrar.</p>';
        }
        resultsCol.appendChild(list);
    }

    async previewDocument(filePath) {
        const previewCol = document.getElementById('preview-col');
        const fileExtension = filePath.split('.').pop().toLowerCase();
        const escapedPath = filePath.replace(/\\/g, '\\');

        previewCol.innerHTML = `<div class="preview-placeholder">Cargando previsualización...</div>`;

        if (fileExtension === 'pdf') {
            const safePath = filePath.replace(/\\/g, '/');
            previewCol.innerHTML = `<iframe src="file:///${safePath}?t=${new Date().getTime()}" width="100%" height="100%" style="border: none;"></iframe>`;
        } else if (['doc', 'docx', 'xlsx', 'xls'].includes(fileExtension)) {
            try {
                const result = fileExtension.startsWith('doc')
                    ? await window.electronAPI.convertDocxToPdf(filePath)
                    : await window.electronAPI.convertExcelToPdf(filePath);

                if (result.success) {
                    const safePath = result.pdf_path.replace(/\\/g, '/');previewCol.innerHTML = `<iframe src="file:///${safePath}?t=${new Date().getTime()}" width="100%" height="100%" style="border: none;"></iframe>`;
                } else {
                    previewCol.innerHTML = `<div class="preview-error"><h3>Error de Conversión</h3><p>${result.error}</p><button class="btn btn-primary" onclick="window.currentInvestigacionAccidentesComponent.openDocument('${escapedPath}')">Abrir con aplicación externa</button></div>`;
                }
            } catch (error) {
                previewCol.innerHTML = `<div class="preview-error"><h3>Error Inesperado</h3><p>${error.message}</p><button class="btn btn-primary" onclick="window.currentInvestigacionAccidentesComponent.openDocument('${escapedPath}')">Abrir con aplicación externa</button></div>`;
            }
        } else {
            previewCol.innerHTML = `<div class="preview-error"><h3>Previsualización no disponible</h3><p>La previsualización para archivos <strong>.${fileExtension}</strong> no está soportada.</p><button class="btn btn-primary" onclick="window.currentInvestigacionAccidentesComponent.openDocument('${escapedPath}')">Abrir con aplicación externa</button></div>`;
        }
    }

    async openDocument(filePath) {
        try {
            await window.electronAPI.openPath(filePath);
        } catch (error) {
            console.error('Error al abrir el documento:', error);
            alert('Error al abrir el documento.');
        }
    }

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
}

// Definir el método showNewDocumentViewer correctamente como método del prototipo
InvestigacionAccidentesComponent.prototype.showNewDocumentViewer = function() {
  if (this._portalMessageHandler) {
    window.removeEventListener('message', this._portalMessageHandler);
    this._portalMessageHandler = null;
  }
  this.container.innerHTML = '';

    // Crear un contenedor superior con botón de volver
    const header = document.createElement('div');
    header.className = 'submodule-header';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.padding = '10px';
    header.style.backgroundColor = '#ffffff';
    header.style.borderBottom = '1px solid #dee2e6';
    header.style.marginBottom = '20px';

    const backButton = document.createElement('button');
    backButton.className = 'btn btn-back';
    backButton.innerHTML = '&#8592; Volver';
    backButton.style.marginRight = '10px';
    backButton.addEventListener('click', () => {
        this.currentView = 'main';
        this.render();
    });
    header.appendChild(backButton);

    const title = document.createElement('h3');
    title.textContent = 'Ver Investigaciones de Accidentes';
    title.style.flexGrow = '1';
    title.style.textAlign = 'center';
    title.style.margin = '0';
    header.appendChild(title);

    // Crear un iframe para el nuevo visualizador de documentos
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = 'calc(100vh - 150px)'; // Ajustar altura para dejar espacio para el encabezado
    iframe.style.border = 'none';

    // Pasar parámetros a la nueva interfaz a través de la URL
    const viewerUrl = `./modules/gestion-salud/investigacion-accidentes/investigaciones-view.html?company=${encodeURIComponent(this.currentCompany)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
    iframe.src = viewerUrl;

  this.container.appendChild(header);
  this.container.appendChild(iframe);
  this.setupIframeCommunication(iframe);
};

// Hacer la clase disponible globalmente
window.InvestigacionAccidentesComponent = InvestigacionAccidentesComponent;

