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
        if (!event.data || !event.data.type) {
            return;
        }

        // 📦608-fix13 — El iframe (responsable-sg-viewer.js) nos pide abrir el
        // modal full-screen de file-viewer. El iframe NO tiene window.electronAPI,
        // así que tiene que delegarnos esta tarea. El parent SÍ tiene electronAPI
        // y kairFV cargado, así que abrimos el modal acá.
        if (event.data.type === 'open-file-viewer-modal') {
            const filePath = event.data.filePath;
            if (!filePath) return;
            if (window.kairFV && typeof window.kairFV.openWithFileViewerFromPath === 'function') {
                window.kairFV.openWithFileViewerFromPath(filePath);
            } else {
                console.warn('[ResponsableLogic] kairFV.openWithFileViewerFromPath no disponible');
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
                case 'upload-document':
                    this.handleStandardRequest(event, 'uploadDocument');
                    break;
                case 'open-file':
                    this.handleStandardRequest(event, 'openFile');
                    break;
                case 'delete-document':
                    this.handleStandardRequest(event, 'deleteDocument');
                    break;
                default:
                    console.warn(`[ResponsableLogic] Acción no manejada: ${action}`);
            }
        }
    }

    async handleStandardRequest(event, apiFunctionName) {
        const { requestId, payload } = event.data;
        console.log(`[ResponsableLogic] Solicitud: ${apiFunctionName}, ID: ${requestId}`);

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

            // 📦608-fix8 — Si el preview solicitado es de un archivo Office (no PDF),
            // no usamos el IPC viejo (que convierte a PDF con LibreOffice) — en su lugar
            // leemos los bytes crudos y los devolvemos al viewer para que renderice el
            // <flyfish-file-viewer> directamente en su panel de preview. El viewer
            // detecta `mode: 'file-viewer'` y monta el Web Component en su DOM.
            const filePathStr = typeof apiArgs === 'string' ? apiArgs : (apiArgs?.filePath || '');
            const fileExt = (filePathStr.split('.').pop() || '').toLowerCase();
            const isOfficeRequest = (apiFunctionName === 'getExcelPreview' || apiFunctionName === 'getWordPreview')
                && fileExt && fileExt !== 'pdf';

            if (isOfficeRequest && window.electronAPI.readFileBytes) {
                console.log(`[ResponsableLogic] 📦608: Office preview (${fileExt}) → readFileBytes`);
                const rfb = await window.electronAPI.readFileBytes(filePathStr);
                if (!rfb || !rfb.success) {
                    event.source.postMessage({
                        type: `${event.data.type.replace('-request', '')}-response`,
                        requestId,
                        payload: {
                            success: false,
                            error: (rfb && rfb.error) || 'No se pudo leer el archivo'
                        }
                    }, '*');
                    return;
                }
                event.source.postMessage({
                    type: `${event.data.type.replace('-request', '')}-response`,
                    requestId,
                    payload: {
                        success: true,
                        mode: 'file-viewer',
                        data: {
                            bytes: rfb.data.bytes,
                            name: rfb.data.name,
                            ext: rfb.data.ext,
                            size: rfb.data.size,
                            // 📦608-fix8 — path original para que el viewer pueda
                            // "Expandir" el modal full-screen reusando el helper.
                            filePath: filePathStr
                        }
                    }
                }, '*');
                return;
            }

            const result = await window.electronAPI[apiFunctionName](apiArgs);

            event.source.postMessage({
                type: `${event.data.type.replace('-request', '')}-response`,
                requestId,
                payload: {
                    success: result.success,
                    data: result.data || result,
                    files: result.files,
                    folders: result.folders,
                    basePath: result.basePath,
                    fileName: result.fileName,
                    base64Data: result.base64Data,
                    error: result.error
                }
            }, '*');

        } catch (error) {
            console.error(`[ResponsableLogic] Error en ${apiFunctionName}:`, error);
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

window.ResponsableSgComponent = ResponsableSgComponent;