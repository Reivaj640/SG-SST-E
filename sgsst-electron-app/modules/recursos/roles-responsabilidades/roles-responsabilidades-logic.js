// roles-responsabilidades-logic.js - Componente para el submódulo "1.1.2 Roles y Responsabilidades"

class RolesResponsabilidadesComponent {
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
        const viewerUrl = `modules/recursos/roles-responsabilidades/roles-responsabilidades-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        iframe.src = viewerUrl;

        this.container.appendChild(iframe);
    }

    handleIframeMessage(event) {
        if (!event.data || !event.data.type) {
            return;
        }

        // Manejar mensajes del nuevo estándar (type: 'action-request')
        if (event.data.type.endsWith('-request')) {
            const action = event.data.type.replace('-request', '');
            
            switch (action) {
                case 'back-to-module':
                    if (this.onBackToModuleHome) this.onBackToModuleHome();
                    break;
                case 'get-document-folders':
                    this.handleStandardRequest(event, 'getDocumentFolders');
                    break;
                case 'get-documents-in-folder':
                    this.handleStandardRequest(event, 'getDocumentsInFolder');
                    break;
                case 'get-pdf-preview':
                    this.handleStandardRequest(event, 'getPDFPreview');
                    break;
                case 'get-word-preview':
                    this.handleStandardRequest(event, 'getWordPreview');
                    break;
                case 'get-excel-preview':
                    this.handleStandardRequest(event, 'getExcelPreview');
                    break;
                case 'download-document':
                    this.handleStandardRequest(event, 'downloadDocument');
                    break;
                default:
                    console.warn(`[RolesLogic] Acción no manejada: ${action}`);
            }
        }
    }

    async handleStandardRequest(event, apiFunctionName) {
        const { requestId, payload } = event.data;
        console.log(`[RolesLogic] Solicitud: ${apiFunctionName}, ID: ${requestId}`);
        
        try {
            if (!window.electronAPI || typeof window.electronAPI[apiFunctionName] !== 'function') {
                throw new Error(`API function ${apiFunctionName} not found`);
            }

            // Preparar argumento: Si el payload es un objeto con filePath (enviado por viewers),
            // extraemos el string porque las APIs de preview esperan la ruta directa.
            let apiArgs = payload;
            if (payload && typeof payload === 'object' && payload.filePath) {
                apiArgs = payload.filePath;
            }

            const result = await window.electronAPI[apiFunctionName](apiArgs);
            
            event.source.postMessage({
                type: `${event.data.type.replace('-request', '')}-response`,
                requestId,
                payload: {
                    success: result.success,
                    data: result.data || result, // Algunos endpoints devuelven data, otros el objeto directo
                    files: result.files, // Específico para getDocumentsInFolder
                    folders: result.folders, // Específico para getDocumentFolders
                    basePath: result.basePath,
                    fileName: result.fileName,
                    base64Data: result.base64Data,
                    error: result.error
                }
            }, '*');

        } catch (error) {
            console.error(`[RolesLogic] Error en ${apiFunctionName}:`, error);
            event.source.postMessage({
                type: `${event.data.type.replace('-request', '')}-response`,
                requestId,
                payload: {
                    success: false,
                    error: error.message
                }
            }, '*');
        }
    }

    destroy() {
        window.removeEventListener('message', this.handleIframeMessage);
        this.container.innerHTML = '';
    }
}

window.RolesResponsabilidadesComponent = RolesResponsabilidadesComponent;