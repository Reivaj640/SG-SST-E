// afiliacion-logic.js - Componente para el submódulo "1.1.4 Afiliación al SSSI"

class AfiliacionComponent {
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
        const viewerUrl = `modules/recursos/afiliacion/afiliacion-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        iframe.src = viewerUrl;

        this.container.appendChild(iframe);
    }

    handleIframeMessage(event) {
        if (!event.data || !event.data.type) {
            return;
        }

        // 📦608-fix15 — El iframe nos pide abrir el modal full-screen de file-viewer.
        if (event.data.type === 'open-file-viewer-modal') {
            const filePath = event.data.filePath;
            if (!filePath) return;
            if (window.kairFV && typeof window.kairFV.openWithFileViewerFromPath === 'function') {
                window.kairFV.openWithFileViewerFromPath(filePath);
            } else {
                console.warn('[AfiliacionLogic] kairFV.openWithFileViewerFromPath no disponible');
            }
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
                    window.KairDocPreview.handleRequest(event, 'getDocumentFolders');
                    break;
                case 'get-documents-in-folder':
                    window.KairDocPreview.handleRequest(event, 'getDocumentsInFolder');
                    break;
                case 'get-pdf-preview':
                    window.KairDocPreview.handleRequest(event, 'getPDFPreview');
                    break;
                case 'get-word-preview':
                    window.KairDocPreview.handleRequest(event, 'getWordPreview');
                    break;
                case 'get-excel-preview':
                    window.KairDocPreview.handleRequest(event, 'getExcelPreview');
                    break;
                case 'download-document':
                    window.KairDocPreview.handleRequest(event, 'downloadDocument');
                    break;
                default:
                    console.warn(`[AfiliacionLogic] Acción no manejada: ${action}`);
            }
        }
    }

    destroy() {
        window.removeEventListener('message', this.handleIframeMessage);
        this.container.innerHTML = '';
    }
}

window.AfiliacionComponent = AfiliacionComponent;