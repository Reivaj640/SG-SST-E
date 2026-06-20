// objetivos-sst-logic.js
// Componente lógico para el submódulo "2.2.1 Objetivos SST"

class ObjetivosSSTComponent {
    constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
        this.container = container;
        this.companyName = companyName;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBackToModuleHome = onBackToModuleHome;
        this.handleIframeMessage = this.handleIframeMessage.bind(this);
    }

    render() {
        console.log('[objetivos-sst-logic.js][render] Iniciando renderizado del componente Objetivos SST');
        console.log('[objetivos-sst-logic.js][render] companyName:', this.companyName);
        console.log('[objetivos-sst-logic.js][render] moduleName:', this.moduleName);
        console.log('[objetivos-sst-logic.js][render] submoduleName:', this.submoduleName);
        
        this.container.innerHTML = ''; // Limpiar el contenedor
        
        // Registrar listener ANTES de crear el iframe
        window.addEventListener('message', this.handleIframeMessage);
        console.log('[objetivos-sst-logic.js][render] Listener de mensajes registrado');

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';

        // Pasar parámetros a la nueva interfaz a través de la URL
        const viewerUrl = `modules/gestion-integral/objetivos-sst/objetivos-sst-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        iframe.src = viewerUrl;
        
        console.log('[objetivos-sst-logic.js][render] Iframe creado con src:', viewerUrl);

        this.container.appendChild(iframe);
        console.log('[objetivos-sst-logic.js][render] Iframe agregado al DOM');
    }

    handleIframeMessage(event) {
        if (!event.data) {
            return;
        }

        // Normalizar clave: aceptar tanto `type` (estándar) como `action` (legacy viewer)
        const messageKey = event.data.type || event.data.action;
        if (!messageKey) {
            return;
        }

        console.log(`[objetivos-sst-logic.js][handleIframeMessage] Mensaje recibido del iframe:`, event.data);

        switch (messageKey) {
            case 'back-to-module-request':
                console.log('[objetivos-sst-logic.js][handleIframeMessage] Acción: back-to-module-request');
                break;
            case 'get-excel-path-request':
                console.log('[objetivos-sst-logic.js][handleIframeMessage] Acción: get-excel-path-request');
                this.handleGetExcelPathRequest(event);
                break;
            case 'load-excel-data-request':
                console.log('[objetivos-sst-logic.js][handleIframeMessage] Acción: load-excel-data-request');
                this.handleLoadExcelDataRequest(event);
                break;
            case 'save-excel-data-request':
                console.log('[objetivos-sst-logic.js][handleIframeMessage] Acción: save-excel-data-request');
                this.handleSaveExcelDataRequest(event);
                break;
            case 'load-resultados-request':
                console.log('[objetivos-sst-logic.js][handleIframeMessage] Acción: load-resultados-request');
                this.handleLoadResultadosRequest(event);
                break;
            case 'save-resultados-request':
                console.log('[objetivos-sst-logic.js][handleIframeMessage] Acción: save-resultados-request');
                this.handleSaveResultadosRequest(event);
                break;
            case 'load-auto-resultados-request':
                console.log('[objetivos-sst-logic.js][handleIframeMessage] Acción: load-auto-resultados-request');
                this.handleLoadAutoResultadosRequest(event);
                break;
            default:
                console.warn('[objetivos-sst-logic.js][handleIframeMessage] Mensaje no reconocido:', messageKey);
                break;
        }
    }

    async handleGetExcelPathRequest(event) {
        const { requestId } = event.data;
        console.log(`[objetivos-sst-logic.js][handleGetExcelPathRequest] Solicitud de ruta de archivo recibida. requestId: ${requestId}`);

        try {
            if (!window.electronAPI || typeof window.electronAPI.getObjetivosExcelPath !== 'function') {
                console.error(`[objetivos-sst-logic.js][handleGetExcelPathRequest] Error: electronAPI.getObjetivosExcelPath no está disponible.`);
                throw new Error('electronAPI.getObjetivosExcelPath no está disponible.');
            }

            // Llamar al backend para obtener la ruta del archivo Excel
            const result = await window.electronAPI.getObjetivosExcelPath(this.companyName);
            console.log(`[objetivos-sst-logic.js][handleGetExcelPathRequest] Respuesta de electronAPI.getObjetivosExcelPath para requestId ${requestId}:`, result);

            event.source.postMessage({
                action: 'get-excel-path-response',
                requestId,
                success: result.success,
                filePath: result.filePath,
                error: result.error
            }, '*');
        } catch (error) {
            console.error(`[objetivos-sst-logic.js][handleGetExcelPathRequest] Error al manejar la solicitud de ruta de archivo:`, error);
            event.source.postMessage({
                action: 'get-excel-path-response',
                requestId,
                success: false,
                error: error.message
            }, '*');
        }
    }

    async handleLoadExcelDataRequest(event) {
        const { requestId, payload } = event.data;
        const filePath = payload.filePath;
        console.log(`[objetivos-sst-logic.js][handleLoadExcelDataRequest] Solicitud de carga de datos recibida. requestId: ${requestId}, filePath: ${filePath}`);

        try {
            if (!window.electronAPI || typeof window.electronAPI.loadObjetivosExcelData !== 'function') {
                console.error(`[objetivos-sst-logic.js][handleLoadExcelDataRequest] Error: electronAPI.loadObjetivosExcelData no está disponible.`);
                throw new Error('electronAPI.loadObjetivosExcelData no está disponible.');
            }

            // Llamar al backend para cargar los datos del archivo Excel
            const result = await window.electronAPI.loadObjetivosExcelData(filePath);
            console.log(`[objetivos-sst-logic.js][handleLoadExcelDataRequest] Respuesta de electronAPI.loadObjetivosExcelData para requestId ${requestId}:`, result);

            event.source.postMessage({
                action: 'load-excel-data-response',
                requestId,
                success: result.success,
                data: result.data,
                error: result.error
            }, '*');
        } catch (error) {
            console.error(`[objetivos-sst-logic.js][handleLoadExcelDataRequest] Error al manejar la solicitud de carga de datos:`, error);
            event.source.postMessage({
                action: 'load-excel-data-response',
                requestId,
                success: false,
                error: error.message
            }, '*');
        }
    }

    async handleSaveExcelDataRequest(event) {
        const { requestId, payload } = event.data;
        const { filePath, data } = payload;
        console.log(`[objetivos-sst-logic.js][handleSaveExcelDataRequest] Solicitud de guardado de datos recibida. requestId: ${requestId}, filePath: ${filePath}`);

        try {
            if (!window.electronAPI || typeof window.electronAPI.saveObjetivosExcelData !== 'function') {
                console.error(`[objetivos-sst-logic.js][handleSaveExcelDataRequest] Error: electronAPI.saveObjetivosExcelData no está disponible.`);
                throw new Error('electronAPI.saveObjetivosExcelData no está disponible.');
            }

            // Llamar al backend para guardar los datos en el archivo Excel
            const result = await window.electronAPI.saveObjetivosExcelData(filePath, data);
            console.log(`[objetivos-sst-logic.js][handleSaveExcelDataRequest] Respuesta de electronAPI.saveObjetivosExcelData para requestId ${requestId}:`, result);

            event.source.postMessage({
                action: 'save-excel-data-response',
                requestId,
                success: result.success,
                error: result.error
            }, '*');
        } catch (error) {
            console.error(`[objetivos-sst-logic.js][handleSaveExcelDataRequest] Error al manejar la solicitud de guardado de datos:`, error);
            event.source.postMessage({
                action: 'save-excel-data-response',
                requestId,
                success: false,
                error: error.message
            }, '*');
        }
    }

    async handleLoadResultadosRequest(event) {
        const { requestId, payload } = event.data;
        const { excelFilePath } = payload;
        console.log(`[objetivos-sst-logic.js][handleLoadResultadosRequest] Cargando resultados. requestId: ${requestId}`);

        try {
            if (!window.electronAPI || typeof window.electronAPI.getObjetivosResultados !== 'function') {
                throw new Error('electronAPI.getObjetivosResultados no está disponible.');
            }
            const result = await window.electronAPI.getObjetivosResultados(excelFilePath);
            event.source.postMessage({
                action: 'load-resultados-response',
                requestId,
                success: result.success,
                data: result.data,
                error: result.error
            }, '*');
        } catch (error) {
            console.error(`[objetivos-sst-logic.js][handleLoadResultadosRequest] Error:`, error);
            event.source.postMessage({
                action: 'load-resultados-response',
                requestId,
                success: false,
                error: error.message
            }, '*');
        }
    }

    async handleSaveResultadosRequest(event) {
        const { requestId, payload } = event.data;
        const { excelFilePath, data } = payload;
        console.log(`[objetivos-sst-logic.js][handleSaveResultadosRequest] Guardando resultados. requestId: ${requestId}`);

        try {
            if (!window.electronAPI || typeof window.electronAPI.saveObjetivosResultados !== 'function') {
                throw new Error('electronAPI.saveObjetivosResultados no está disponible.');
            }
            const result = await window.electronAPI.saveObjetivosResultados(excelFilePath, data);
            event.source.postMessage({
                action: 'save-resultados-response',
                requestId,
                success: result.success,
                error: result.error
            }, '*');
        } catch (error) {
            console.error(`[objetivos-sst-logic.js][handleSaveResultadosRequest] Error:`, error);
            event.source.postMessage({
                action: 'save-resultados-response',
                requestId,
                success: false,
                error: error.message
            }, '*');
        }
    }

    async handleLoadAutoResultadosRequest(event) {
        const { requestId, payload } = event.data;
        const companyName = payload?.companyName;
        console.log(`[objetivos-sst-logic.js][handleLoadAutoResultadosRequest] Cargando auto-resultados. requestId: ${requestId}, company: ${companyName}`);

        try {
            if (!window.electronAPI || typeof window.electronAPI.getObjetivosResultadosAuto !== 'function') {
                throw new Error('electronAPI.getObjetivosResultadosAuto no está disponible.');
            }
            const result = await window.electronAPI.getObjetivosResultadosAuto(companyName);
            event.source.postMessage({
                action: 'load-auto-resultados-response',
                requestId,
                success: result.success,
                data: result.data,
                error: result.error
            }, '*');
        } catch (error) {
            console.error(`[objetivos-sst-logic.js][handleLoadAutoResultadosRequest] Error:`, error);
            event.source.postMessage({
                action: 'load-auto-resultados-response',
                requestId,
                success: false,
                data: {},
                error: error.message
            }, '*');
        }
    }

    destroy() {
        console.log('[objetivos-sst-logic.js][destroy] Limpiando listener de mensajes');
        // Limpiar el event listener cuando el componente se destruye
        window.removeEventListener('message', this.handleIframeMessage);
        this.container.innerHTML = '';
        console.log('[objetivos-sst-logic.js][destroy] Componente destruido');
    }
}

window.ObjetivosSSTComponent = ObjetivosSSTComponent;