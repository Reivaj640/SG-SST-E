// responsable-sg.js - Componente para el submódulo "1.1.1 Responsable del SG"

class ResponsableSgComponent {
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
        const viewerUrl = `modules/recursos/responsable-sg/responsable-sg-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
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
            // Puedes añadir más casos para otros tipos de archivos si es necesario
            default:
                console.warn('Mensaje de iframe no reconocido:', event.data.action);
                break;
        }
    }

    async handleFilePreviewRequest(event, apiFunctionName) {
        const { requestId, filePath } = event.data;
        console.log(`[responsable-sg.js][handleFilePreviewRequest] Solicitud de previsualización recibida. requestId: ${requestId}, filePath: ${filePath}, apiFunctionName: ${apiFunctionName}`);
        try {
            if (!window.electronAPI || typeof window.electronAPI[apiFunctionName] !== 'function') {
                console.error(`[responsable-sg.js][handleFilePreviewRequest] Error: electronAPI.${apiFunctionName} no está disponible.`);
                throw new Error(`electronAPI.${apiFunctionName} no está disponible.`);
            }
            const result = await window.electronAPI[apiFunctionName](filePath);
            console.log(`[responsable-sg.js][handleFilePreviewRequest] Respuesta de electronAPI.${apiFunctionName} para requestId ${requestId}: success=${result.success}, error=${result.error}`);
            event.source.postMessage({
                action: `${apiFunctionName}-response`,
                requestId,
                success: result.success,
                data: result.data,
                error: result.error
            }, '*'); // Considerar especificar el origin para mayor seguridad
        } catch (error) {
            console.error(`[responsable-sg.js][handleFilePreviewRequest] Error al manejar la solicitud de previsualización (${apiFunctionName}) para filePath ${filePath}:`, error);
            event.source.postMessage({
                action: `${apiFunctionName}-response`,
                requestId,
                success: false,
                error: error.message
            }, '*'); // Considerar especificar el origin para mayor seguridad
        }
    }

    destroy() {
        // Limpiar el event listener cuando el componente se destruye
        window.removeEventListener('message', this.handleIframeMessage);
        this.container.innerHTML = '';
    }
}

window.ResponsableSgComponent = ResponsableSgComponent;