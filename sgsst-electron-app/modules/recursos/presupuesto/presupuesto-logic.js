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
                this.renderIframeView(mainContainer, 'modules/recursos/presupuesto/presupuesto-selector.html', 'selector');
                break;
            case 'gestion':
                this.renderIframeView(mainContainer, 'modules/recursos/presupuesto/presupuesto-gestion.html', 'gestion');
                break;
            default:
                this.log('WARN', `Vista desconocida: ${this.currentView}, usando selector.`);
                this.renderIframeView(mainContainer, 'modules/recursos/presupuesto/presupuesto-selector.html', 'selector');
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
                // FIX: Use the file object directly from the event data for robustness
                if (file && file.path) {
                    try {
                        this.log('DEBUG', `Solicitando datos procesados para: ${file.path}`);
                        // FIX: Use the dedicated function for budget data (headers in row 9, data from row 10)
                        const result = await window.electronAPI.readPresupuestoData(file.path);
                        this.log('DEBUG', 'Resultado de readPresupuestoData:', result);

                        if (result.success) {
                            const gestionIframe = this.container.querySelector('iframe');
                            if (gestionIframe) {
                                this.log('DEBUG', `Enviando datos, fórmulas y encabezados al iframe.`);
                                // Usar la función para formatear los datos antes de enviar
                                const formattedData = this.formatBudgetDataForDisplay(result.data.processedData);

                                gestionIframe.contentWindow.postMessage({
                                    budgetData: formattedData, // Datos formateados para mostrar en la tabla (incluye filas especiales)
                                    calculationData: result.data.filteredData, // Datos para cálculos (excluye filas especiales)
                                    formulaCells: result.data.formulaCells,
                                    headers: result.data.headers
                                }, '*');
                            }
                        } else {
                            throw new Error(result.error);
                        }
                    } catch (error) {
                        this.log('CRITICAL', `Error en requestBudgetData: ${error.message}`, error.stack);
                        this.showErrorUI(error);
                    }
                } else {
                    this.log('ERROR', 'La solicitud requestBudgetData se recibió sin un archivo o ruta de archivo válidos.', event.data);
                    this.showErrorUI(new Error('No se proporcionó un archivo válido para procesar.'));
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

            case 'backToSubmodules':
                // Llamar a la función de retorno al módulo principal
                if (this.onBack) {
                    this.onBack();
                }
                break;

            case 'openOriginalFile':
                if (file && window.electronAPI.openPath) {
                    window.electronAPI.openPath(file.path);
                }
                break;

            case 'duplicate-budget-file':
                try {
                    this.log('INFO', `Solicitud de duplicación de archivo recibida: ${event.data.currentFilePath} con nuevo año: ${event.data.newYear}`);

                    // Llamar a la API de Electron para duplicar el archivo
                    const duplicateResult = await window.electronAPI.duplicateBudgetFile(event.data);

                    // Enviar respuesta de vuelta al iframe
                    const selectorIframe = this.container.querySelector('iframe');
                    if (selectorIframe) {
                        selectorIframe.contentWindow.postMessage({
                            action: 'duplicateBudgetFile',
                            ...duplicateResult
                        }, '*');
                    }

                    // Si la duplicación fue exitosa, recargar la lista de archivos
                    if (duplicateResult.success) {
                        this.sendFilesToSelectorIframe(selectorIframe);
                    }
                } catch (error) {
                    this.log('CRITICAL', `Error al duplicar archivo de presupuesto: ${error.message}`, error.stack);

                    const selectorIframe = this.container.querySelector('iframe');
                    if (selectorIframe) {
                        selectorIframe.contentWindow.postMessage({
                            action: 'duplicateBudgetFile',
                            success: false,
                            error: error.message
                        }, '*');
                    }
                }
                break;

            // El guardado es una funcionalidad más compleja
            case 'saveBudgetChanges':
                this.log('INFO', 'Solicitud de guardado recibida. Llamando a ElectronAPI para guardar el archivo.', event.data);
                try {
                    const filePath = event.data.file.path;
                    const budgetDataToSave = event.data.data;

                    // Validar que los datos sean correctos antes de guardar
                    if (!budgetDataToSave || !Array.isArray(budgetDataToSave)) {
                        throw new Error('Datos de presupuesto no válidos');
                    }

                    // Call Electron API to save the file
                    const saveResult = await window.electronAPI.saveBudgetFile(filePath, budgetDataToSave);

                    const gestionIframe = this.container.querySelector('iframe');
                    if (gestionIframe) {
                        if (saveResult.success) {
                            this.log('INFO', 'Archivo guardado exitosamente:', saveResult.message);
                            gestionIframe.contentWindow.postMessage({
                                action: 'saveBudgetChanges',
                                success: true,
                                message: saveResult.message
                            }, '*');
                        } else {
                            this.log('ERROR', 'Error al guardar archivo:', saveResult.error);
                            gestionIframe.contentWindow.postMessage({
                                action: 'saveBudgetChanges',
                                success: false,
                                error: saveResult.error
                            }, '*');
                        }
                    }
                } catch (error) {
                    this.log('CRITICAL', `Error al procesar solicitud de guardado: ${error.message}`, error.stack);
                    const gestionIframe = this.container.querySelector('iframe');
                    if (gestionIframe) {
                        gestionIframe.contentWindow.postMessage({
                            action: 'saveBudgetChanges',
                            success: false,
                            error: error.message
                        }, '*');
                    }
                }
                break;
        }
    }

    // Método para formatear los datos del presupuesto para mostrar en la interfaz
    formatBudgetDataForDisplay(data) {
        return data.map(row => {
            const newRow = { ...row };
            // Formatear valores numéricos, manteniendo los originales para cálculos
            for (const key in newRow) {
                if (typeof newRow[key] === 'number') {
                    // Aplicar formato de número con separadores de miles y 2 decimales
                    newRow[key] = newRow[key].toLocaleString('es-CO', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });
                }
            }
            return newRow;
        });
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