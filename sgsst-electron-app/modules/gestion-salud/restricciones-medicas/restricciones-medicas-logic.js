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
        // 📦776 — premium v2: el componente cubre el FLUJO COMPLETO en una sola
        // interfaz (Cargar PDF → Generar informe oficial → Enviar a la EPS).
        // Antes el paso 1 redirigía a la página vieja generar-informe-remision.html.
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
            logMessage: this.logMessage
        });
        this._enviarV2.render();
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

    async showEstadisticasRemisionesPage() {
        // 📦779 — premium v2: métricas derivadas del Control de Remisiones
        // (mismo origen de datos: getControlRemisionesData).
        this.container.innerHTML = '';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';
        this.container.style.flex = '1';
        this.container.style.minHeight = '0';
        this.container.style.overflow = 'hidden';
        var self = this;

        if (!window.EstadisticasRemisionesV2Component) {
            console.error('❌ EstadisticasRemisionesV2Component no está cargado (index.html)');
            this._renderFallbackCards();
            return;
        }
        this._statsV2 = new window.EstadisticasRemisionesV2Component(this.container, {
            companyName: this.companyName,
            onBack: function () { self.render(); },
            logMessage: this.logMessage
        });
        this._statsV2.render();
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

// Cargar información de contacto
// Enviar por WhatsApp desde modal
// Enviar por Email desde modal
// Cerrar modal
