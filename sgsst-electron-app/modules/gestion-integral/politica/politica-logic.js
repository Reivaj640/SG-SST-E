// politica-logic.js - Lógica del componente Política (CORREGIDO)
// ============================================================================
// Este archivo maneja la comunicación entre el iframe (politica-view.html) 
// y el proceso principal mediante postMessage
// ============================================================================

class PoliticaComponent {
    constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
        this.container = container;
        this.companyName = companyName;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBackToModuleHome = onBackToModuleHome;
        
        // Binding para el handler de mensajes
        this.handleParentMessage = this.handleParentMessage.bind(this);
        
        // Estado del iframe
        this.iframe = null;
        this.isReady = false;
        this.isDestroyed = false;
        
        // Protección contra bucles infinitos
        this.lastRequestTime = 0;
        this.requestCount = 0;
        this.maxRequestsPerSecond = 5;
        
        // Registrar en el objeto global de componentes
        if (!window.SG_SST_Components) {
            window.SG_SST_Components = {};
        }
        window.SG_SST_Components['politica'] = this;
        
        console.log('[PoliticaComponent] ✅ Instancia creada');
    }

    render() {
        if (this.isDestroyed) {
            console.warn('[PoliticaComponent] ⚠️ No se puede renderizar: componente destruido');
            return;
        }
        
        console.log('[PoliticaComponent] 🔄 Renderizando iframe...');
        
        try {
            // Limpiar contenedor antes de crear iframe
            this.container.innerHTML = '';
            
            // Crear iframe
            this.iframe = document.createElement('iframe');
            this.iframe.id = 'politica-iframe';
            this.iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
            
            // URL del viewer
            const viewerUrl = `modules/gestion-integral/politica/politica-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
            this.iframe.src = viewerUrl;
            
            console.log('[PoliticaComponent] 📄 iframe creado con URL:', viewerUrl.substring(0, 80) + '...');
            
            // Escuchar mensajes del iframe (solo una vez)
            window.addEventListener('message', this.handleParentMessage);
            
            // Insertar iframe
            this.container.appendChild(this.iframe);
            
            console.log('[PoliticaComponent] ✅ iframe insertado en el DOM');
            
        } catch (error) {
            console.error('[PoliticaComponent] ❌ Error en render():', error.message);
        }
    }

    handleParentMessage(event) {
        // Verificar si el componente fue destruido
        if (this.isDestroyed) return;
        
        // Verificar origen del mensaje
        if (!event.data || !event.data.type) return;
        
        // Protección contra bucle infinito
        const now = Date.now();
        if (now - this.lastRequestTime < 1000 / this.maxRequestsPerSecond) {
            this.requestCount++;
            if (this.requestCount > 10) {
                console.warn('[PoliticaComponent] ⚠️ Bucle infinito detectado, ignorando mensajes');
                return;
            }
        } else {
            this.requestCount = 0;
        }
        this.lastRequestTime = now;
        
        const { type, payload, requestId } = event.data;
        
        console.log('[PoliticaComponent] 📩 Mensaje del iframe:', type);
        
        switch (type) {
            case 'iframe-ready':
                this.isReady = true;
                console.log('[PoliticaComponent] ✅ iframe listo para recibir mensajes');
                break;
                
            case 'get-document-folders-request':
                this.handleGetDocumentFolders(payload, requestId);
                break;
                
            case 'get-documents-in-folder-request':
                this.handleGetDocumentsInFolder(payload, requestId);
                break;
                
            case 'open-onlyoffice-editor-request':
                this.handleOpenOnlyOfficeEditor(payload, requestId);
                break;
                
            case 'get-pdf-preview-request':
                this.handleGetPdfPreview(payload, requestId);
                break;
                
            case 'download-document-request':
                this.handleDownloadDocument(payload, requestId);
                break;
                
            case 'back-to-module-request':
                if (this.onBackToModuleHome) {
                    this.onBackToModuleHome();
                }
                break;
                
            case 'iframe-debug-log':
                // Ignorar mensajes de debug para evitar spam
                break;
                
            default:
                console.log('[PoliticaComponent] Tipo de mensaje no manejado:', type);
        }
    }

    /**
     * Responder al iframe mediante postMessage
     */
    sendResponseToIframe(type, requestId, payload) {
        if (this.isDestroyed || !this.iframe || !this.iframe.contentWindow) return;
        
        try {
            this.iframe.contentWindow.postMessage({
                type: `${type}-response`,
                requestId: requestId,
                payload: payload
            }, '*');
            console.log('[PoliticaComponent] 📤 Respuesta enviada:', type);
        } catch (e) {
            console.error('[PoliticaComponent] ❌ Error enviando respuesta:', e.message);
        }
    }

    /**
     * Obtener carpetas de documentos
     */
    async handleGetDocumentFolders(payload, requestId) {
        try {
            // Usar electronAPI directamente para evitar bucles
            if (window.electronAPI && window.electronAPI.getDocumentFolders) {
                const result = await window.electronAPI.getDocumentFolders(payload);
                this.sendResponseToIframe('get-document-folders', requestId, result);
            } else {
                throw new Error('electronAPI.getDocumentFolders no disponible');
            }
        } catch (error) {
            console.error('[PoliticaComponent] ❌ Error getDocumentFolders:', error.message);
            this.sendResponseToIframe('get-document-folders', requestId, {
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Obtener documentos en carpeta
     */
    async handleGetDocumentsInFolder(payload, requestId) {
        try {
            if (window.electronAPI && window.electronAPI.getFolderContents) {
                const result = await window.electronAPI.getFolderContents(payload);
                this.sendResponseToIframe('get-documents-in-folder', requestId, result);
            } else {
                throw new Error('electronAPI.getFolderContents no disponible');
            }
        } catch (error) {
            console.error('[PoliticaComponent] ❌ Error getDocumentsInFolder:', error.message);
            this.sendResponseToIframe('get-documents-in-folder', requestId, {
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Abrir editor OnlyOffice
     */
    async handleOpenOnlyOfficeEditor(payload, requestId) {
        const { filePath, fileName } = payload;
        console.log('[PoliticaComponent] ⏩ Abriendo OnlyOffice:', fileName);
        
        try {
            // Usar openOnlyOfficeEditor que genera la URL completa del editor
            if (window.electronAPI && window.electronAPI.openOnlyOfficeEditor) {
                const result = await window.electronAPI.openOnlyOfficeEditor({
                    filePath: filePath,
                    fileName: fileName
                });
                
                console.log('[PoliticaComponent] ✅ Configuración OnlyOffice generada');
                
                this.sendResponseToIframe('open-onlyoffice-editor', requestId, {
                    success: true,
                    editorUrl: result.editorUrl,
                    config: result.config
                });
            } else {
                throw new Error('electronAPI.openOnlyOfficeEditor no disponible');
            }
        } catch (error) {
            console.error('[PoliticaComponent] ❌ Error OnlyOffice:', error.message);
            this.sendResponseToIframe('open-onlyoffice-editor', requestId, {
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Obtener previsualización PDF
     */
    async handleGetPdfPreview(payload, requestId) {
        try {
            if (window.electronAPI && window.electronAPI.getPDFPreview) {
                const result = await window.electronAPI.getPDFPreview(payload.filePath);
                this.sendResponseToIframe('get-pdf-preview', requestId, result);
            } else {
                throw new Error('electronAPI.getPDFPreview no disponible');
            }
        } catch (error) {
            console.error('[PoliticaComponent] ❌ Error getPdfPreview:', error.message);
            this.sendResponseToIframe('get-pdf-preview', requestId, {
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Descargar documento
     */
    async handleDownloadDocument(payload, requestId) {
        try {
            if (window.electronAPI && window.electronAPI.downloadDocument) {
                const result = await window.electronAPI.downloadDocument(payload);
                this.sendResponseToIframe('download-document', requestId, result);
            } else {
                throw new Error('electronAPI.downloadDocument no disponible');
            }
        } catch (error) {
            console.error('[PoliticaComponent] ❌ Error downloadDocument:', error.message);
            this.sendResponseToIframe('download-document', requestId, {
                success: false,
                error: error.message
            });
        }
    }

    destroy() {
        console.log('[PoliticaComponent] 🗑️ Destruyendo componente...');
        this.isDestroyed = true;
        
        // Remover listener
        try {
            window.removeEventListener('message', this.handleParentMessage);
        } catch (e) {
            // Ignorar errores si el listener no existe
        }
        
        // Remover del objeto global
        if (window.SG_SST_Components && window.SG_SST_Components['politica']) {
            delete window.SG_SST_Components['politica'];
        }
        
        // Limpiar iframe
        if (this.iframe) {
            try {
                this.iframe.remove();
            } catch (e) {
                // Ignorar errores
            }
            this.iframe = null;
        }
        
        console.log('[PoliticaComponent] ✅ Componente destruido');
    }
}

// Exportar globalmente
window.PoliticaComponent = PoliticaComponent;
