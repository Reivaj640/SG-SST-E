// acciones-mg-logic.js - Componente para el submódulo "7.1.2 Acciones de Mejora — Alta Gerencia"

class AccionesMgComponent {
    constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
        this.container = container;
        this.companyName = companyName;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBackToModuleHome = onBackToModuleHome;
        this.handleIframeMessage = this.handleIframeMessage.bind(this);
    }

    render() {
        this.container.innerHTML = '';
        window.addEventListener('message', this.handleIframeMessage);

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';

        const viewerUrl = `modules/mejoramiento/acciones-mejora-gerencia/acciones-mg-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        iframe.src = viewerUrl;

        this.container.appendChild(iframe);
    }

    handleIframeMessage(event) {
        if (!event.data || !event.data.type) return;
        if (event.data.type.endsWith('-request')) {
            const action = event.data.type.replace('-request', '');
            switch (action) {
                case 'back-to-module':
                    if (this.onBackToModuleHome) this.onBackToModuleHome();
                    break;
                default:
                    this.handleStandardRequest(event, action);
            }
        }
    }

    async handleStandardRequest(event, apiFunctionName) {
        const { requestId, payload } = event.data;
        try {
            if (!window.electronAPI || typeof window.electronAPI[apiFunctionName] !== 'function') {
                throw new Error(`API function ${apiFunctionName} not found`);
            }
            let apiArgs = payload;
            if (payload && typeof payload === 'object' && payload.filePath) apiArgs = payload.filePath;
            const result = await window.electronAPI[apiFunctionName](apiArgs);
            event.source.postMessage({ type: `${apiFunctionName}-response`, requestId, payload: { success: result.success, data: result.data || result, files: result.files, folders: result.folders, basePath: result.basePath, fileName: result.fileName, base64Data: result.base64Data, error: result.error } }, '*');
        } catch (error) {
            console.error(`[AccionesMgLogic] Error en ${apiFunctionName}:`, error);
            event.source.postMessage({ type: `${apiFunctionName}-response`, requestId, payload: { success: false, error: error.message } }, '*');
        }
    }

    destroy() {
        window.removeEventListener('message', this.handleIframeMessage);
        this.container.innerHTML = '';
    }
}

window.AccionesMgComponent = AccionesMgComponent;
