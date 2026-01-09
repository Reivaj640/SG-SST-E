// curso-virtual-component.js - Componente para el submódulo "1.2.3 Curso Virtual 50 Horas"

class CursoVirtualComponent {
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
        const viewerUrl = `curso-virtual-viewer.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
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
            case 'get-pdf-preview-request':
                this.handleFilePreviewRequest(event, 'getPDFPreview');
                break;
            case 'get-word-preview-request':
                this.handleFilePreviewRequest(event, 'getWordPreview');
                break;
            case 'get-excel-preview-request':
                this.handleFilePreviewRequest(event, 'getExcelPreview');
                break;
            case 'get-document-folders-request':
                this.handleFolderRequest(event, 'getDocumentFolders');
                break;
            case 'download-document-request':
                this.handleDownloadRequest(event, 'downloadDocument');
                break;
            case 'open-path-request':
                this.handleOpenPathRequest(event, 'openPath');
                break;
            // Puedes añadir más casos para otros tipos de archivos o funcionalidades si es necesario
            default:
                console.warn('Mensaje de iframe no reconocido:', event.data.action);
                break;
        }
    }

    async handleFilePreviewRequest(event, apiFunctionName) {
        const { requestId, payload } = event.data;
        const filePath = payload && payload.filePath ? payload.filePath : event.data.filePath;
        console.log(`[curso-virtual-component.js][handleFilePreviewRequest] Solicitud de previsualización recibida. requestId: ${requestId}, filePath: ${filePath}, apiFunctionName: ${apiFunctionName}`);
        try {
            if (!window.electronAPI || typeof window.electronAPI[apiFunctionName] !== 'function') {
                console.error(`[curso-virtual-component.js][handleFilePreviewRequest] Error: electronAPI.${apiFunctionName} no está disponible.`);
                throw new Error(`electronAPI.${apiFunctionName} no está disponible.`);
            }
            const result = await window.electronAPI[apiFunctionName](filePath);
            console.log(`[curso-virtual-component.js][handleFilePreviewRequest] Respuesta de electronAPI.${apiFunctionName} para requestId ${requestId}: success=${result.success}, error=${result.error}`);
            event.source.postMessage({
                action: `${apiFunctionName}-response`,
                requestId,
                success: result.success,
                data: result.data,
                error: result.error
            }, '*'); // Considerar especificar el origin para mayor seguridad
        } catch (error) {
            console.error(`[curso-virtual-component.js][handleFilePreviewRequest] Error al manejar la solicitud de previsualización (${apiFunctionName}) para filePath ${filePath}:`, error);
            event.source.postMessage({
                action: `${apiFunctionName}-response`,
                requestId,
                success: false,
                error: error.message
            }, '*'); // Considerar especificar el origin para mayor seguridad
        }
    }

    async handleFolderRequest(event, apiFunctionName) {
        const { requestId, payload } = event.data;
        console.log(`[curso-virtual-component.js][handleFolderRequest] Solicitud de carpetas recibida. requestId: ${requestId}, payload:`, payload);
        try {
            if (!window.electronAPI || typeof window.electronAPI[apiFunctionName] !== 'function') {
                console.error(`[curso-virtual-component.js][handleFolderRequest] Error: electronAPI.${apiFunctionName} no está disponible.`);
                throw new Error(`electronAPI.${apiFunctionName} no está disponible.`);
            }
            const result = await window.electronAPI[apiFunctionName](payload);
            console.log(`[curso-virtual-component.js][handleFolderRequest] Respuesta de electronAPI.${apiFunctionName} para requestId ${requestId}: success=${result.success}`);
            event.source.postMessage({
                action: `${apiFunctionName}-response`,
                requestId,
                success: result.success,
                folders: result.folders || [],
                files: result.files || [],
                error: result.error
            }, '*');
        } catch (error) {
            console.error(`[curso-virtual-component.js][handleFolderRequest] Error al manejar la solicitud de carpetas:`, error);
            event.source.postMessage({
                action: `${apiFunctionName}-response`,
                requestId,
                success: false,
                error: error.message
            }, '*');
        }
    }

    async handleDownloadRequest(event, apiFunctionName) {
        const { requestId, payload } = event.data;
        const filePath = payload;
        console.log(`[curso-virtual-component.js][handleDownloadRequest] Solicitud de descarga recibida. requestId: ${requestId}, filePath: ${filePath}`);
        try {
            if (!window.electronAPI || typeof window.electronAPI[apiFunctionName] !== 'function') {
                console.error(`[curso-virtual-component.js][handleDownloadRequest] Error: electronAPI.${apiFunctionName} no está disponible.`);
                throw new Error(`electronAPI.${apiFunctionName} no está disponible.`);
            }
            const result = await window.electronAPI[apiFunctionName](filePath);
            console.log(`[curso-virtual-component.js][handleDownloadRequest] Respuesta de electronAPI.${apiFunctionName} para requestId ${requestId}: success=${result.success}`);
            event.source.postMessage({
                action: `${apiFunctionName}-response`,
                requestId,
                success: result.success,
                fileName: result.fileName,
                base64Data: result.base64Data,
                error: result.error
            }, '*');
        } catch (error) {
            console.error(`[curso-virtual-component.js][handleDownloadRequest] Error al manejar la solicitud de descarga:`, error);
            event.source.postMessage({
                action: `${apiFunctionName}-response`,
                requestId,
                success: false,
                error: error.message
            }, '*');
        }
    }

    async handleOpenPathRequest(event, apiFunctionName) {
        const { requestId, payload } = event.data;
        const pathToOpen = payload;
        console.log(`[curso-virtual-component.js][handleOpenPathRequest] Solicitud de apertura de ruta recibida. requestId: ${requestId}, path: ${pathToOpen}`);
        try {
            if (!window.electronAPI || typeof window.electronAPI[apiFunctionName] !== 'function') {
                console.error(`[curso-virtual-component.js][handleOpenPathRequest] Error: electronAPI.${apiFunctionName} no está disponible.`);
                throw new Error(`electronAPI.${apiFunctionName} no está disponible.`);
            }
            const result = await window.electronAPI[apiFunctionName](pathToOpen);
            console.log(`[curso-virtual-component.js][handleOpenPathRequest] Respuesta de electronAPI.${apiFunctionName} para requestId ${requestId}: success=${result.success}`);
            event.source.postMessage({
                action: `${apiFunctionName}-response`,
                requestId,
                success: result.success,
                error: result.error
            }, '*');
        } catch (error) {
            console.error(`[curso-virtual-component.js][handleOpenPathRequest] Error al manejar la solicitud de apertura de ruta:`, error);
            event.source.postMessage({
                action: `${apiFunctionName}-response`,
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

window.CursoVirtualComponent = CursoVirtualComponent;