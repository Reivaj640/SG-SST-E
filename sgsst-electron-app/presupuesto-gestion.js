class PresupuestoGestionComponent {
    constructor(container, currentCompany, moduleName, onBack) {
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.onBack = onBack;
        this.currentView = 'selector'; // 'selector' o 'gestion'
        this.currentFile = null; // Almacena el objeto del archivo seleccionado
        this.messageHandlers = new Map();
        
        this.log('INFO', 'PresupuestoGestionComponent inicializado');
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${level}] [${timestamp.split('T')[1].split('.')[0]}] ${message}`, data || '');
    }

    render() {
        this.log('INFO', `Iniciando render para la vista: ${this.currentView}`);
        this.clearMessageHandlers();
        this.container.innerHTML = '';
        window.currentPresupuestoGestionComponent = this;

        const mainContainer = document.createElement('div');
        mainContainer.className = 'submodule-content';

        switch (this.currentView) {
            case 'selector':
                this.renderIframeView(mainContainer, 'presupuesto-selector.html', 'selector');
                break;
            case 'gestion':
                this.renderIframeView(mainContainer, 'presupuesto-gestion.html', 'gestion');
                break;
            default:
                this.log('WARN', `Vista desconocida: ${this.currentView}, usando selector.`);
                this.renderIframeView(mainContainer, 'presupuesto-selector.html', 'selector');
        }

        this.container.appendChild(mainContainer);
        this.log('INFO', 'Render completado.');
    }

    renderIframeView(container, src, viewType) {
        this.log('INFO', `Renderizando iframe para vista '${viewType}' con src: ${src}`);
        try {
            const iframe = document.createElement('iframe');
            iframe.src = src;
            iframe.style.cssText = `width: 100%; height: 100%; border: none;`;

            const loadingDiv = this.createLoadingElement(`Cargando ${viewType}...`);
            container.appendChild(loadingDiv);

            this.setupIframeEvents(iframe, loadingDiv, viewType);
            
            container.appendChild(iframe);
        } catch (error) {
            this.log('CRITICAL', `Error en renderIframeView(): ${error.message}`, error.stack);
            this.showErrorUI(error);
        }
    }

    setupIframeEvents(iframe, loadingDiv, viewType) {
        iframe.onload = () => {
            this.log('INFO', `✅ Iframe cargado (${viewType})`);
            if (loadingDiv.parentNode) loadingDiv.style.display = 'none';
            
            // Si es la vista de gestión, enviamos el archivo seleccionado para que lo tenga de inmediato.
            if (viewType === 'gestion' && this.currentFile) {
                iframe.contentWindow.postMessage({ file: this.currentFile }, '*');
            }
        };
        iframe.onerror = (error) => this.log('CRITICAL', `❌ Error al cargar iframe: ${error.message}`);
        
        const messageHandler = (event) => this.handleIframeMessage(event);
        this.registerMessageHandler(viewType, messageHandler);
    }

    async handleIframeMessage(event) {
        const { action, file } = event.data;
        if (!action) return;

        this.log('INFO', `Manejando acción: ${action}`, event.data);

        switch (action) {
            case 'openBudgetFile':
                if (file) {
                    this.currentFile = file;
                    this.currentView = 'gestion';
                    this.render();
                }
                break;

            case 'requestBudgetFiles':
                const iframe = this.container.querySelector('iframe');
                if (iframe) {
                    this.sendFilesToSelectorIframe(iframe);
                }
                break;

            case 'requestBudgetData':
                if (this.currentFile) {
                    try {
                        this.log('DEBUG', `Solicitando lectura de archivo Excel a ElectronAPI para: ${this.currentFile.path}`);
                        const result = await window.electronAPI.readExcelFile(this.currentFile.path);
                        this.log('DEBUG', 'Resultado de readExcelFile:', result);

                        if (result.success) {
                            this.log('DEBUG', 'Archivo Excel leído correctamente. Parseando con XLSX...');
                            const workbook = XLSX.read(result.data, { type: 'buffer' });
                            const sheetName = workbook.SheetNames[0];
                            const worksheet = workbook.Sheets[sheetName];
                            const jsonData = XLSX.utils.sheet_to_json(worksheet);
                            this.log('DEBUG', 'Datos JSON parseados:', jsonData);
                            
                            const gestionIframe = this.container.querySelector('iframe');
                            if (gestionIframe) {
                                this.log('DEBUG', 'Enviando budgetData al iframe de gestion.');
                                gestionIframe.contentWindow.postMessage({ budgetData: jsonData }, '*');
                            } else {
                                this.log('WARN', 'No se encontró el iframe de gestion para enviar budgetData.');
                            }
                        } else {
                            this.log('ERROR', `Error al leer archivo Excel: ${result.error}`);
                            throw new Error(result.error);
                        }
                    } catch (error) {
                        this.log('CRITICAL', `Error en requestBudgetData: ${error.message}`, error.stack);
                        this.showErrorUI(error);
                    }
                }
                break;
            
            case 'requestCurrentFile':
                 const gestionIframe = this.container.querySelector('iframe');
                 if (gestionIframe && this.currentFile) {
                    gestionIframe.contentWindow.postMessage({ file: this.currentFile }, '*');
                 }
                break;

            case 'backToSelector':
                this.currentFile = null;
                this.currentView = 'selector';
                this.render();
                break;
            
            case 'openOriginalFile':
                if (file && window.electronAPI.openPath) {
                    window.electronAPI.openPath(file.path);
                }
                break;

            // El guardado es una funcionalidad más compleja, por ahora solo lo registramos
            case 'saveBudgetChanges':
                this.log('INFO', 'Solicitud de guardado recibida. Funcionalidad pendiente de implementación completa.', event.data);
                // Aquí iría la lógica para llamar a un nuevo handler en main.js que use xlsx.write
                break;
        }
    }

    createLoadingElement(message) {
        const div = document.createElement('div');
        div.style.cssText = `display: flex; align-items: center; justify-content: center; height: 100%;`;
        div.innerHTML = `<h3>${message}</h3>`;
        return div;
    }

    showErrorUI(error) {
        this.container.innerHTML = `
            <div style="padding: 20px; background: #ffebee; border: 1px solid #f8bbd9; height: 100%;">
                <h3 style="color: #c62828;">❌ Error Crítico</h3>
                <p>${error.message}</p>
                <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto;">${error.stack}</pre>
            </div>`;
    }

    clearMessageHandlers() {
        this.messageHandlers.forEach(handler => window.removeEventListener('message', handler));
        this.messageHandlers.clear();
    }

    registerMessageHandler(key, handler) {
        if (this.messageHandlers.has(key)) window.removeEventListener('message', this.messageHandlers.get(key));
        window.addEventListener('message', handler);
        this.messageHandlers.set(key, handler);
    }

    async sendFilesToSelectorIframe(iframe) {
        try {
            if (!window.electronAPI || !window.electronAPI.getPresupuestoFiles) {
                throw new Error('API getPresupuestoFiles no disponible');
            }
            this.log('DEBUG', `Llamando a getPresupuestoFiles para la empresa: ${this.currentCompany}`);
            const result = await window.electronAPI.getPresupuestoFiles(this.currentCompany);
            
            if (result.success) {
                this.log('DEBUG', `Archivos de presupuesto recibidos: ${result.files.length}`, result.files);
                iframe.contentWindow.postMessage({ files: result.files }, '*');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.log('CRITICAL', 'Error crítico al cargar archivos de presupuesto:', error.message, error.stack);
            iframe.contentWindow.postMessage({ error: error.message }, '*');
        }
    }
}

window.PresupuestoGestionComponent = PresupuestoGestionComponent;