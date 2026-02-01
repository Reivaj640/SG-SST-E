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
        this.container.innerHTML = ''; // Limpiar el contenedor
        window.addEventListener('message', this.handleIframeMessage);

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';

        // Pasar parámetros a la nueva interfaz a través de la URL
        const viewerUrl = `modules/gestion-integral/objetivos-sst/objetivos-sst-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        iframe.src = viewerUrl;

        this.container.appendChild(iframe);
    }

    handleIframeMessage(event) {
        // Por seguridad, podrías verificar event.origin aquí si supieras el origen exacto del iframe
        if (!event.data || !event.data.action) {
            return; // Ignorar mensajes sin acción definida
        }

        switch (event.data.action) {
            case 'backToModule':
                if (this.onBackToModuleHome) {
                    this.onBackToModuleHome();
                }
                break;
            case 'get-excel-path-request':
                this.handleGetExcelPathRequest(event);
                break;
            case 'load-excel-data-request':
                this.handleLoadExcelDataRequest(event);
                break;
            case 'save-excel-data-request':
                this.handleSaveExcelDataRequest(event);
                break;
            // Puedes añadir más casos para otras funcionalidades si es necesario
            default:
                console.warn('Mensaje de iframe no reconocido:', event.data.action);
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

    destroy() {
        // Limpiar el event listener cuando el componente se destruye
        window.removeEventListener('message', this.handleIframeMessage);
        this.container.innerHTML = '';
    }
}

window.ObjetivosSSTComponent = ObjetivosSSTComponent;