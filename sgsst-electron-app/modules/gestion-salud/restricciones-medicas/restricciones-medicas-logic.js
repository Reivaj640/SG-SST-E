// restricciones-medicas.js - Componente para el submódulo "3.1.6 Restricciones y recomendaciones médicas"

class RestriccionesMedicasComponent {
    constructor(container, companyName, moduleName, submoduleName, logMessage, onBackToModuleHome) {
        this.container = container;
        this.companyName = companyName;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.logMessage = logMessage;
        this.onBackToModuleHome = onBackToModuleHome;
        this.extractedData = null;
        this.lastGeneratedDoc = null;

        // Estado para el explorador de archivos
        this.currentPath = null;
        this.pathHistory = [];
    }

    async render() {
        this.container.innerHTML = '';

        // Exponer this para que el portal HTML pueda acceder al componente
        window.restriccionesMedicasPortalComponent = this;

        // Cargar el CSS del modal si no está cargado
        this._loadModalStyles();

        // Cargar el HTML del portal moderno
        try {
            const response = await fetch('./modules/gestion-salud/restricciones-medicas/restricciones-medicas-home.html?v=REM-20260919-v2-portal-premium');
            if (!response.ok) throw new Error('No se pudo cargar el portal');
            const html = await response.text();

            // 📦775 — El portal se inyecta con innerHTML en el DOCUMENTO PRINCIPAL:
            // cualquier <link> de la página se cargaría en global. Se quitan por
            // seguridad (el portal ya no usa CDNs; los iconos son SVG inline).
            const htmlLimpio = html.replace(/<link[^>]*>/gi, '');

            // Inyectar HTML en el contenedor
            this.container.innerHTML = htmlLimpio;

            // Cargar el JS del portal dinámicamente
            const script = document.createElement('script');
            script.src = './modules/gestion-salud/restricciones-medicas/restricciones-medicas-home.js?v=REM-20260919-v2-portal-premium';
            script.onload = () => {
                // Portal listo, funciones de navegación disponibles
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('[RM] Error cargando portal:', error);
            // Fallback al método anterior si falla el fetch
            this._renderFallbackCards();
        }
    }

    _loadModalStyles() {
        const cssId = 'env-modal-styles';
        if (!document.getElementById(cssId)) {
            const link = document.createElement('link');
            link.id = cssId;
            link.rel = 'stylesheet';
            link.href = './modules/gestion-salud/restricciones-medicas/env-modal.css';
            document.head.appendChild(link);
        }
    }

    // Fallback por si el fetch del HTML falla (método anterior)
    _renderFallbackCards() {
        this.container.innerHTML = '';
        const backButton = this.createBackButton('&#8592; Volver al Módulo', this.onBackToModuleHome);
        this.container.appendChild(backButton);

        const title = document.createElement('h3');
        title.textContent = this.submoduleName;
        title.style.textAlign = 'center';
        title.style.marginBottom = '20px';
        this.container.appendChild(title);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'module-cards';

        cardsContainer.appendChild(this.createModuleCard('Ver Remisiones Médicas', 'Visualizar historial de remisiones y recomendaciones médicas.', () => this.showNewDocumentViewer()));
        cardsContainer.appendChild(this.createModuleCard('Enviar Remisiones', 'Crear y enviar nuevas remisiones y recomendaciones.', () => this.showEnviarRemisionPage()));
        cardsContainer.appendChild(this.createModuleCard('Control de Remisiones', 'Realizar seguimiento al estado de las remisiones enviadas.', () => this._renderControlRemisionesView()));
        cardsContainer.appendChild(this.createModuleCard('Próxima Función', 'Una nueva funcionalidad estará disponible aquí pronto.', () => this.showPlaceholder('Próxima Función')));

        this.container.appendChild(cardsContainer);
    }

    // --- Lógica para la sección "Enviar Remisiones" ---

    showEnviarRemisionPage() {
        // 📦773 — premium v2: componente embebido (sin iframe). Mismo contrato
        // de datos (selectPdfFile / processRemisionPdf directo) y la redirige
        // al informe oficial la sigue haciendo el padre vía onNavigateToInforme.
        this.container.innerHTML = '';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';
        this.container.style.flex = '1';
        this.container.style.minHeight = '0';
        this.container.style.overflow = 'hidden';
        var self = this;

        if (!window.EnviarRemisionV2Component) {
            console.error('❌ EnviarRemisionV2Component no está cargado (index.html)');
            this._renderFallbackCards();
            return;
        }
        this._enviarV2 = new window.EnviarRemisionV2Component(this.container, {
            companyName: this.companyName,
            onBack: function () { self.render(); },
            onNavigateToInforme: function (extractedData) {
                self.extractedData = extractedData;
                self.showGenerarInformePage(extractedData);
            },
            logMessage: this.logMessage
        });
        this._enviarV2.render();
    }

    showGenerarInformePage(extractedData) {
        this.container.innerHTML = '';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';
        this.container.style.flex = '1';
        this.container.style.overflow = 'hidden';
        var self = this;

        self._messageHandler = function(e) { self.handleIframeMessage(e); };
        window.addEventListener('message', self._messageHandler);

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'width:100%;height:100%;flex:1;border:none;display:block;';
        iframe.src = `./modules/gestion-salud/restricciones-medicas/generar-informe-remision.html`
                   + `?company=${encodeURIComponent(this.companyName)}`
                   + `&module=${encodeURIComponent(this.moduleName)}`
                   + `&submodule=${encodeURIComponent(this.submoduleName)}`
                   + `&data=${encodeURIComponent(JSON.stringify(extractedData))}`
                   + `&v=REM-20260919-v2-premium`;
        self._viewerFrame = iframe;
        this.container.appendChild(iframe);
    }

    
    logMessage(message, type = 'info') {
        const logArea = document.getElementById('remision-log-text');
        if (logArea) {
            const msg = document.createElement('p');
            msg.textContent = `[${type.toUpperCase()}] ${message}`;
            msg.className = `log-${type}`;
            logArea.prepend(msg);
        }
    }

    // --- Métodos de Ayuda ---

    
    createBackButton(text, onClick) {
        const backButton = document.createElement('button');
        backButton.className = 'btn btn-back';
        backButton.innerHTML = text;
        backButton.addEventListener('click', onClick);
        return backButton;
    }

    createModuleCard(title, description, onClick) {
        const card = document.createElement('div');
        card.className = 'card module-card';
        card.innerHTML = `<div class="card-body"><h5 class="card-title">${title}</h5><p class="card-text">${description}</p><button class="btn btn-primary btn-ingresar">Acceder</button></div>`;
        card.querySelector('button').addEventListener('click', onClick);
        return card;
    }

    async _renderControlRemisionesView() {
        // 📦773 — premium v2: componente embebido (sin iframe ni CSS legacy).
        // Conserva el contrato: getControlRemisionesData + updateExcelCell (firma real
        // { filePath, cellAddress, newValue }) + openPath.
        this.container.innerHTML = '';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';
        this.container.style.flex = '1';
        this.container.style.minHeight = '0';
        this.container.style.overflow = 'hidden';
        var self = this;

        if (!window.ControlRemisionesV2Component) {
            console.error('❌ ControlRemisionesV2Component no está cargado (index.html)');
            this._renderFallbackCards();
            return;
        }
        this._controlV2 = new window.ControlRemisionesV2Component(this.container, {
            companyName: this.companyName,
            onBack: function () { self.render(); },
            logMessage: this.logMessage
        });
        this._controlV2.render();
    }

    // Agrega este método a la clase RestriccionesMedicasComponent
    showPlaceholder(featureName) {
        alert(`La funcionalidad '${featureName}' se implementará en el futuro.`);
    }
}

window.RestriccionesMedicasComponent = RestriccionesMedicasComponent;

// Estilos para la nueva interfaz
const style = document.createElement('style');
style.textContent = `
    .file-nav-bar { display: flex; align-items: center; gap: 1rem; padding: 0.5rem; background-color: var(--widget-bg-color); border-radius: var(--border-radius-md); margin-bottom: 1rem; }
    .breadcrumb-display { font-family: monospace; background-color: var(--bg-color); padding: 0.25rem 0.5rem; border-radius: var(--border-radius-sm); }
    .enviar-remision-container { display: flex; gap: 1rem; }
    .remision-col-control { flex: 1; display: flex; flex-direction: column; gap: 1rem; }
    .remision-col-data { flex: 2; display: flex; flex-direction: column; gap: 1rem; }
    .widget-box { background-color: var(--widget-bg-color); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); padding: 1rem; }
    .widget-box h4 { margin-top: 0; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1rem; color: #000000; }
    .input-group { display: flex; gap: 0.5rem; }
    .input-group input { flex-grow: 1; }
    .btn-full { width: 100%; margin-top: 0.5rem; }
    .send-buttons-group { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 1rem; }
    .extracted-data-container { max-height: 300px; overflow-y: auto; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table td { padding: 0.25rem; }
    .data-table td:first-child { font-weight: bold; text-align: right; width: 40%; }
    .log-text-area { height: 100px; background-color: var(--bg-color); border-radius: var(--border-radius-sm); padding: 0.5rem; overflow-y: auto; font-family: monospace; font-size: 0.8rem; }
    .log-error { color: var(--danger-color); }
    .log-info { color: var(--text-color); }
    .preview-error { padding: 2rem; text-align: center; }
    /* Estilo para botones con el mismo color que el botón volver */
    .btn-info { 
        background-color: #f8f9fa; 
        color: #212529; 
        border: 1px solid #dee2e6; 
    }
    .btn-info:hover { 
        background-color: #e2e6ea; 
        border-color: #dae0e5; 
    }
    .btn-info:disabled { 
        background-color: #e9ecef; 
        color: #6c757d; 
        border-color: #dee2e6; 
    }
    .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
        margin-bottom: 1rem;
    }
    .data-table th, .data-table td {
        padding: 8px;
        border: 1px solid #ddd;
        text-align: left;
        vertical-align: top;
        white-space: nowrap;
    }
    .data-table th {
        background-color: #f8f9fa;
        font-weight: bold;
        position: sticky;
        top: 0;
        z-index: 1;
    }
    .data-table tr:nth-child(even) {
        background-color: #f8f9fa;
    }
    .data-table tr:hover {
        background-color: #e9ecef;
    }
    .control-remisiones-content {
        max-height: 70vh;
        overflow-y: auto;
    }
`;

// Adjuntar estilos al documento
document.head.appendChild(style);

// ═══════════════════════════════════════════════════════════
// BRIDGE: Escucha mensajes del iframe del viewer
// ═══════════════════════════════════════════════════════════

RestriccionesMedicasComponent.prototype.handleIframeMessage = function(event) {
    if (!event.data || !event.data.type) return;
    if (this._viewerFrame && event.source !== this._viewerFrame.contentWindow) return;
    var self = this;
    var type = event.data.type;
    var requestId = event.data.requestId;
    var payload = event.data.payload;

    switch (type) {
        case 'back-to-submodule-home':
            console.log('[RM-BRIDGE] Regresando al home del submódulo 3.1.6');
            if (self._messageHandler) {
                window.removeEventListener('message', self._messageHandler);
                self._messageHandler = null;
            }
            if (self._viewerFrame) {
                self._viewerFrame.remove();
                self._viewerFrame = null;
            }
            self.render();
            break;
        case 'back-to-module-request':
            console.log('[RM-BRIDGE] Regresando a la antesala del submódulo 3.1.6');
            if (self._messageHandler) {
                window.removeEventListener('message', self._messageHandler);
                self._messageHandler = null;
            }
            if (self._viewerFrame) {
                self._viewerFrame.remove();
                self._viewerFrame = null;
            }
            self.render();
            break;
        case 'open-file-viewer-modal':
            // 📦608-fix13: el iframe pide abrir el archivo en el modal file-viewer del parent
            if (event.data && event.data.filePath && window.kairFV && typeof window.kairFV.openWithFileViewerFromPath === 'function') {
                window.kairFV.openWithFileViewerFromPath(event.data.filePath);
            } else if (event.data && event.data.filePath) {
                console.warn('[RM-BRIDGE] kairFV.openWithFileViewerFromPath no disponible');
            }
            break;
        case 'get-pdf-preview-request':
            self._handlePreview(event, 'getPDFPreview', requestId, payload);
            break;
        case 'get-word-preview-request':
            self._handlePreview(event, 'getWordPreview', requestId, payload);
            break;
        case 'get-excel-preview-request':
            self._handlePreview(event, 'getExcelPreview', requestId, payload);
            break;
        case 'get-document-folders-request':
            self._handleFolders(event, 'getDocumentFolders', requestId, payload);
            break;
        case 'get-documents-in-folder-request':
            self._handleDocsInFolder(event, 'getDocumentsInFolder', requestId, payload);
            break;
        case 'download-document-request':
            self._handleDownload(event, 'downloadDocument', requestId, payload);
            break;
        case 'open-path-request':
            self._handleOpenPath(event, 'openPath', requestId, payload);
            break;

        // ── Enviar Remisiones ──────────────────────────────────────────
        case 'select-pdf-file-request':
            window.electronAPI.selectPdfFile()
                .then(function(filePath) {
                    event.source.postMessage({ type: 'select-pdf-file-response', requestId: requestId,
                        payload: { success: true, filePath: filePath || null } }, '*');
                })
                .catch(function(e) {
                    event.source.postMessage({ type: 'select-pdf-file-response', requestId: requestId,
                        payload: { success: false, error: e.message } }, '*');
                });
            break;

        case 'process-remision-pdf-request':
            window.electronAPI.processRemisionPdf(payload && payload.filePath)
                .then(function(r) {
                    event.source.postMessage({ type: 'process-remision-pdf-response', requestId: requestId,
                        payload: { success: r.success, data: r.data, error: r.error } }, '*');
                })
                .catch(function(e) {
                    event.source.postMessage({ type: 'process-remision-pdf-response', requestId: requestId,
                        payload: { success: false, error: e.message } }, '*');
                });
            break;

        case 'generate-remision-doc-request':
            window.electronAPI.generateRemisionDocument(payload && payload.extractedData, self.companyName)
                .then(function(r) {
                    event.source.postMessage({ type: 'generate-remision-doc-response', requestId: requestId,
                        payload: { success: r.success, documentPath: r.documentPath, controlPath: r.controlPath, controlUpdated: r.controlUpdated, controlWarning: r.controlWarning, error: r.error } }, '*');
                })
                .catch(function(e) {
                    event.source.postMessage({ type: 'generate-remision-doc-response', requestId: requestId,
                        payload: { success: false, error: e.message } }, '*');
                });
            break;

        case 'send-remision-whatsapp-request':
            window.electronAPI.sendRemisionByWhatsapp(
                    payload && payload.documentPath,
                    payload && payload.extractedData,
                    self.companyName)
                .then(function(r) {
                    event.source.postMessage({ type: 'send-remision-whatsapp-response', requestId: requestId,
                        payload: { success: r.success, error: r.error } }, '*');
                })
                .catch(function(e) {
                    event.source.postMessage({ type: 'send-remision-whatsapp-response', requestId: requestId,
                        payload: { success: false, error: e.message } }, '*');
                });
            break;

        case 'send-remision-email-request':
            window.electronAPI.sendRemisionByEmail(
                    payload && payload.documentPath,
                    payload && payload.extractedData,
                    self.companyName)
                .then(function(r) {
                    event.source.postMessage({ type: 'send-remision-email-response', requestId: requestId,
                        payload: { success: r.success, error: r.error } }, '*');
                })
                .catch(function(e) {
                    event.source.postMessage({ type: 'send-remision-email-response', requestId: requestId,
                        payload: { success: false, error: e.message } }, '*');
                });
            break;

        // ── Generar Informe (nuevo paso intermedio) ──────────────────
        case 'informe-data-request':
            event.source.postMessage({ type: 'informe-data-response', requestId: requestId,
                payload: { extractedData: self.extractedData || {} } }, '*');
            break;

        case 'back-to-verify-request':
            if (self._messageHandler) {
                window.removeEventListener('message', self._messageHandler);
                self._messageHandler = null;
            }
            self.showEnviarRemisionPage();
            break;

        case 'continue-to-send-request':
            if (self._messageHandler) {
                window.removeEventListener('message', self._messageHandler);
                self._messageHandler = null;
            }
            // Al continuar, se navega a la página de envío con los datos del documento generado
            self.lastGeneratedDoc = payload && payload.documentPath;
            self.extractedData = payload && payload.extractedData;
            self._renderSendOnlyPage();
            break;

        case 'navigate-to-generar-informe-request':
            if (self._messageHandler) {
                window.removeEventListener('message', self._messageHandler);
                self._messageHandler = null;
            }
            // Guardar datos extraídos y navegar a generar informe
            self.extractedData = payload && payload.extractedData;
            self.showGenerarInformePage(self.extractedData);
            break;
    }
};

RestriccionesMedicasComponent.prototype._handlePreview = async function(event, apiName, requestId, payload) {
    // 📦608-fix15: helper genérico — para Office usa readFileBytes, para PDF usa la API vieja.
    // El helper ya hace el postMessage de la respuesta, no lo duplicamos acá.
    if (window.KairDocPreview && typeof window.KairDocPreview.handleRequest === 'function') {
        try { await window.KairDocPreview.handleRequest(event, apiName); }
        catch (e) {
            var typeKey = apiName === 'getPDFPreview'   ? 'get-pdf-preview-response'
                        : apiName === 'getWordPreview'  ? 'get-word-preview-response'
                        : apiName === 'getExcelPreview' ? 'get-excel-preview-response'
                        : apiName + '-response';
            event.source.postMessage({ type: typeKey, requestId: requestId, payload: { success: false, error: e.message } }, '*');
        }
        return;
    }
    // Fallback al flujo viejo si el helper no está cargado
    var filePath = payload && payload.filePath;
    var typeKey = apiName === 'getPDFPreview'   ? 'get-pdf-preview-response'
                : apiName === 'getWordPreview'  ? 'get-word-preview-response'
                : apiName === 'getExcelPreview' ? 'get-excel-preview-response'
                : apiName + '-response';
    try {
        var result = await window.electronAPI[apiName](filePath);
        event.source.postMessage({ type: typeKey, requestId: requestId, payload: { success: result.success, data: result.data, error: result.error } }, '*');
    } catch(e) {
        event.source.postMessage({ type: typeKey, requestId: requestId, payload: { success: false, error: e.message } }, '*');
    }
};

RestriccionesMedicasComponent.prototype._handleFolders = async function(event, apiName, requestId, payload) {
    try {
        var result = await window.electronAPI[apiName](payload);
        event.source.postMessage({ type: 'get-document-folders-response', requestId: requestId, payload: { success: result.success, folders: result.folders||[], files: result.files||[], error: result.error } }, '*');
    } catch(e) {
        event.source.postMessage({ type: 'get-document-folders-response', requestId: requestId, payload: { success: false, error: e.message } }, '*');
    }
};

RestriccionesMedicasComponent.prototype._handleDocsInFolder = async function(event, apiName, requestId, payload) {
    var folderPath = typeof payload === 'string' ? payload : (payload && payload.folderPath);
    try {
        var result = await window.electronAPI[apiName](folderPath);
        event.source.postMessage({ type: 'get-documents-in-folder-response', requestId: requestId, payload: { success: result.success, files: result.files||[], error: result.error } }, '*');
    } catch(e) {
        event.source.postMessage({ type: 'get-documents-in-folder-response', requestId: requestId, payload: { success: false, error: e.message } }, '*');
    }
};

RestriccionesMedicasComponent.prototype._handleDownload = async function(event, apiName, requestId, payload) {
    try {
        var result = await window.electronAPI[apiName](payload);
        event.source.postMessage({ type: 'download-document-response', requestId: requestId, payload: { success: result.success, fileName: result.fileName, base64Data: result.base64Data, error: result.error } }, '*');
    } catch(e) {
        event.source.postMessage({ type: 'download-document-response', requestId: requestId, payload: { success: false, error: e.message } }, '*');
    }
};

RestriccionesMedicasComponent.prototype._handleOpenPath = async function(event, apiName, requestId, payload) {
    try {
        var result = await window.electronAPI[apiName](payload);
        event.source.postMessage({ type: 'open-path-response', requestId: requestId, payload: { success: result.success, error: result.error } }, '*');
    } catch(e) {
        event.source.postMessage({ type: 'open-path-response', requestId: requestId, payload: { success: false, error: e.message } }, '*');
    }
};

// ═══════════════════════════════════════════════════════════
// Definir el método showNewDocumentViewer correctamente como método del prototipo
// ═══════════════════════════════════════════════════════════

RestriccionesMedicasComponent.prototype.showNewDocumentViewer = function() {
    this.container.innerHTML = '';
    var self = this;

    // Store named handler so removeEventListener can match the exact reference
    self._messageHandler = function(e) { self.handleIframeMessage(e); };
    window.addEventListener('message', self._messageHandler);

    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = 'calc(100vh - 60px)';
    iframe.style.border = 'none';
    iframe.style.display = 'block';

    const viewerUrl = `./modules/gestion-salud/restricciones-medicas/remisiones-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}&v=REM-20260919-v2-premium`;
    iframe.src = viewerUrl;
    self._viewerFrame = iframe;

    this.container.appendChild(iframe);
};

// ═══════════════════════════════════════════════════════════
// Página de solo envío (después de generar informe) - MODAL
// ═══════════════════════════════════════════════════════════

RestriccionesMedicasComponent.prototype._renderSendOnlyPage = function() {
    var self = this;

    // Extraer datos del documento
    var docPath = self.lastGeneratedDoc || '';
    var docName = docPath.split(/[\\/]/).pop() || 'Documento generado';
    var nombre = (self.extractedData && self.extractedData['Nombre Completo']) || 'N/A';
    var cedula = (self.extractedData && self.extractedData['No. Identificación']) || 'N/A';
    var fecha = (self.extractedData && self.extractedData['Fecha de Atención']) || 'N/A';

    // Crear overlay del modal
    var overlay = document.createElement('div');
    overlay.className = 'env-modal-overlay';
    overlay.id = 'sendModalOverlay';

    // Crear modal
    var modal = document.createElement('div');
    modal.className = 'env-modal';
    modal.innerHTML = 
        '<div class="env-modal-header">' +
            '<div class="env-modal-title">' +
                '<i class="fas fa-paper-plane" style="font-size: 1.5rem; color: var(--env-primary);"></i>' +
                '<h2>Enviar Remisión Generada</h2>' +
            '</div>' +
            '<button class="env-modal-close" id="modalCloseBtn" aria-label="Cerrar">' +
                '<i class="fas fa-times"></i>' +
            '</button>' +
        '</div>' +
        '<div class="env-modal-body">' +
            '<div class="env-success-banner">' +
                '<i class="fas fa-check-circle"></i>' +
                '<div class="env-success-text">' +
                    '<h3>Informe Generado Exitosamente</h3>' +
                    '<p>Seleccione el método de envío para el documento</p>' +
                '</div>' +
            '</div>' +
            '<div class="env-doc-info-card">' +
                '<div class="env-doc-info-row">' +
                    '<i class="fas fa-file-word"></i>' +
                    '<span class="env-doc-label">Documento:</span>' +
                    '<span class="env-doc-value">' + docName + '</span>' +
                '</div>' +
                '<div class="env-doc-info-row">' +
                    '<i class="fas fa-user"></i>' +
                    '<span class="env-doc-label">Trabajador:</span>' +
                    '<span class="env-doc-value">' + nombre + '</span>' +
                '</div>' +
                '<div class="env-doc-info-row">' +
                    '<i class="fas fa-id-card"></i>' +
                    '<span class="env-doc-label">Cédula:</span>' +
                    '<span class="env-doc-value">' + cedula + '</span>' +
                '</div>' +
                '<div class="env-doc-info-row">' +
                    '<i class="fas fa-calendar"></i>' +
                    '<span class="env-doc-label">Fecha Atención:</span>' +
                    '<span class="env-doc-value">' + fecha + '</span>' +
                '</div>' +
                '<div class="env-doc-actions" style="margin-top: 1rem; text-align: center;">' +
                    '<button class="env-btn env-btn-secondary env-btn-sm" id="openFolderBtn" title="Abrir carpeta donde se guardó el archivo">' +
                        '<i class="fas fa-folder-open"></i> Abrir Carpeta' +
                    '</button>' +
                '</div>' +
            '</div>' +
            '<div class="env-modal-actions">' +
                '<button class="env-send-btn env-send-wa" id="modalWhatsappBtn">' +
                    '<i class="fab fa-whatsapp env-send-icon" style="color: var(--env-wa);"></i>' +
                    '<span class="env-send-label">WhatsApp</span>' +
                    '<span class="env-send-contact" id="waContactInfo">Buscando teléfono...</span>' +
                '</button>' +
                '<button class="env-send-btn env-send-email" id="modalEmailBtn">' +
                    '<i class="fas fa-envelope env-send-icon" style="color: var(--env-primary);"></i>' +
                    '<span class="env-send-label">Correo Electrónico</span>' +
                    '<span class="env-send-contact" id="emailContactInfo">Buscando email...</span>' +
                '</button>' +
            '</div>' +
            '<div class="env-send-status" id="sendStatus">' +
                '<i class="fas fa-spinner fa-spin"></i>' +
                '<p id="sendStatusText">Procesando...</p>' +
            '</div>' +
        '</div>' +
        '<div class="env-modal-footer">' +
            '<p>El documento se enviará con los datos de contacto registrados en la base de datos</p>' +
        '</div>';

    overlay.appendChild(modal);
    this.container.appendChild(overlay);

    // Event listeners
    document.getElementById('modalCloseBtn').addEventListener('click', function() {
        self._closeSendModal();
    });

    // Cerrar al hacer clic en el overlay
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            self._closeSendModal();
        }
    });

    // Buscar contacto y actualizar botones
    this._loadContactInfo();

    // Handlers de botones de envío
    document.getElementById('modalWhatsappBtn').addEventListener('click', function() {
        self._handleModalWhatsApp();
    });

    document.getElementById('modalEmailBtn').addEventListener('click', function() {
        self._handleModalEmail();
    });
};

// Cargar información de contacto
RestriccionesMedicasComponent.prototype._loadContactInfo = async function() {
    var self = this;
    var cedula = (this.extractedData && this.extractedData['No. Identificación']) || '';
    var empresa = this.companyName || 'TEMPOACTIVA';

    if (!cedula) {
        document.getElementById('waContactInfo').textContent = 'Cédula no disponible';
        document.getElementById('emailContactInfo').textContent = 'Cédula no disponible';
        document.getElementById('modalWhatsappBtn').disabled = true;
        document.getElementById('modalEmailBtn').disabled = true;
        return;
    }

    try {
        var result = await window.electronAPI.getContactInfo(cedula, empresa);
        
        if (result && result.success) {
            var telefono = result.telefono;
            var email = result.email;

            if (telefono) {
                document.getElementById('waContactInfo').textContent = telefono;
                document.getElementById('modalWhatsappBtn').disabled = false;
            } else {
                document.getElementById('waContactInfo').textContent = 'Teléfono no encontrado';
                document.getElementById('modalWhatsappBtn').disabled = true;
            }

            if (email) {
                document.getElementById('emailContactInfo').textContent = email;
                document.getElementById('modalEmailBtn').disabled = false;
            } else {
                document.getElementById('emailContactInfo').textContent = 'Email no encontrado';
                document.getElementById('modalEmailBtn').disabled = true;
            }
        } else {
            document.getElementById('waContactInfo').textContent = 'Contacto no encontrado';
            document.getElementById('emailContactInfo').textContent = 'Contacto no encontrado';
            document.getElementById('modalWhatsappBtn').disabled = true;
            document.getElementById('modalEmailBtn').disabled = true;
        }
    } catch (error) {
        console.error('[SendModal] Error cargando contacto:', error);
        document.getElementById('waContactInfo').textContent = 'Error al buscar contacto';
        document.getElementById('emailContactInfo').textContent = 'Error al buscar contacto';
        document.getElementById('modalWhatsappBtn').disabled = true;
        document.getElementById('modalEmailBtn').disabled = true;
    }
};

// Enviar por WhatsApp desde modal
RestriccionesMedicasComponent.prototype._handleModalWhatsApp = async function() {
    var self = this;
    var btn = document.getElementById('modalWhatsappBtn');
    var statusDiv = document.getElementById('sendStatus');
    var statusText = document.getElementById('sendStatusText');

    btn.disabled = true;
    btn.innerHTML = '<div class="env-send-spinner"></div><span class="env-send-label">Enviando...</span>';
    statusDiv.className = 'env-send-status';
    statusText.textContent = 'Preparando WhatsApp...';

    try {
        var result = await window.electronAPI.sendRemisionByWhatsapp(
            this.lastGeneratedDoc,
            this.extractedData,
            this.companyName
        );

        if (result.success) {
            statusDiv.className = 'env-send-status env-status-success';
            statusText.textContent = '¡WhatsApp abierto correctamente!';
            btn.innerHTML = '<i class="fas fa-check" style="color: white;"></i><span class="env-send-label" style="color: white;">Enviado</span>';
            btn.style.backgroundColor = 'var(--env-wa)';
            btn.style.borderColor = 'var(--env-wa)';
        } else {
            statusDiv.className = 'env-send-status env-status-error';
            statusText.textContent = result.error || 'Error al enviar';
            btn.disabled = false;
            btn.innerHTML = '<i class="fab fa-whatsapp env-send-icon" style="color: var(--env-wa);"></i><span class="env-send-label">Reintentar</span>';
        }
    } catch (error) {
        console.error('[SendModal] Error WhatsApp:', error);
        statusDiv.className = 'env-send-status env-status-error';
        statusText.textContent = 'Error: ' + error.message;
        btn.disabled = false;
        btn.innerHTML = '<i class="fab fa-whatsapp env-send-icon" style="color: var(--env-wa);"></i><span class="env-send-label">Reintentar</span>';
    }
};

// Enviar por Email desde modal
RestriccionesMedicasComponent.prototype._handleModalEmail = async function() {
    var self = this;
    var btn = document.getElementById('modalEmailBtn');
    var statusDiv = document.getElementById('sendStatus');
    var statusText = document.getElementById('sendStatusText');

    btn.disabled = true;
    btn.innerHTML = '<div class="env-send-spinner"></div><span class="env-send-label">Enviando...</span>';
    statusDiv.className = 'env-send-status';
    statusText.textContent = 'Enviando correo...';

    try {
        var result = await window.electronAPI.sendRemisionByEmail(
            this.lastGeneratedDoc,
            this.extractedData,
            this.companyName
        );

        if (result.success) {
            statusDiv.className = 'env-send-status env-status-success';
            statusText.textContent = '¡Correo enviado exitosamente!';
            btn.innerHTML = '<i class="fas fa-check" style="color: white;"></i><span class="env-send-label" style="color: white;">Enviado</span>';
            btn.style.backgroundColor = 'var(--env-primary)';
            btn.style.borderColor = 'var(--env-primary)';
        } else {
            statusDiv.className = 'env-send-status env-status-error';
            statusText.textContent = result.error || 'Error al enviar';
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-envelope env-send-icon" style="color: var(--env-primary);"></i><span class="env-send-label">Reintentar</span>';
        }
    } catch (error) {
        console.error('[SendModal] Error Email:', error);
        statusDiv.className = 'env-send-status env-status-error';
        statusText.textContent = 'Error: ' + error.message;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-envelope env-send-icon" style="color: var(--env-primary);"></i><span class="env-send-label">Reintentar</span>';
    }
};

// Cerrar modal
RestriccionesMedicasComponent.prototype._closeSendModal = function() {
    var overlay = document.getElementById('sendModalOverlay');
    if (overlay) {
        overlay.remove();
    }
    // Regresar a la sección de procesar remisión, no al inicio
    this.showEnviarRemisionPage();
};