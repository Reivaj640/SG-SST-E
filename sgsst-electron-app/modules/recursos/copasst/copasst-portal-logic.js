// copasst-portal-logic.js - Orquestador del Portal COPASST
// Patrón: 3-archivos (HTML + CSS + JS) con fetch() — idéntico a Capacitaciones

class CopasstPortalComponent {
constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
this.container = container;
this.companyName = companyName;
this.moduleName = moduleName;
this.submoduleName = submoduleName;
this.onBackToModuleHome = onBackToModuleHome;
this.portalScript = null;
this.iframeMessageHandler = null;
this._activeLogicComponent = null;
}

async render() {
this.container.innerHTML = '';
await this.loadPortalHome();
}

async loadPortalHome() {
const portalContainer = document.createElement('div');
portalContainer.id = 'copasst-portal-container';
this.container.appendChild(portalContainer);

try {
const response = await fetch('./modules/recursos/copasst/copasst-home.html');
if (response.ok) {
const html = await response.text();
portalContainer.innerHTML = html;
this.initPortalJS(portalContainer);
} else {
throw new Error('No se pudo cargar el portal COPASST');
}
} catch (error) {
console.error('[CopasstPortalComponent] Error cargando portal:', error);
this.renderLegacyDesign();
}
}

initPortalJS(portalContainer) {
window.copasstPortalContainer = portalContainer;
window.copasstPortalComponent = this;

const script = document.createElement('script');
script.src = './modules/recursos/copasst/copasst-home.js';
this.portalScript = script;

script.onload = () => {
console.log('[CopasstPortalComponent] copasst-home.js cargado');
if (typeof initializePortal === 'function') {
initializePortal();
}
};

script.onerror = () => {
console.error('[CopasstPortalComponent] Error cargando copasst-home.js');
this.renderLegacyDesign();
};

document.body.appendChild(script);
}

enterViewer() {
this.container.innerHTML = '';

this.iframeMessageHandler = this._handleIframeMessage.bind(this);
window.addEventListener('message', this.iframeMessageHandler);

const iframe = document.createElement('iframe');
iframe.style.width = '100%';
iframe.style.height = '100%';
iframe.style.border = 'none';
const viewerUrl = `modules/recursos/copasst/copasst-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
iframe.src = viewerUrl;
this.container.appendChild(iframe);
}

showRealizarActas() {
this.container.innerHTML = '';

    const logicComponent = new _CopasstLogicComponent(
this.container,
this.companyName,
this.moduleName,
this.submoduleName,
() => this.backToPortal()
);
logicComponent.showRealizarActasInterface();
this._activeLogicComponent = logicComponent;
}

backToPortal() {
if (this.iframeMessageHandler) {
window.removeEventListener('message', this.iframeMessageHandler);
this.iframeMessageHandler = null;
}
this._activeLogicComponent = null;
this.render();
}

_handleIframeMessage(event) {
if (!event.data || !event.data.type) return;

// 📦608-fix15 — El iframe nos pide abrir el modal full-screen de file-viewer.
if (event.data.type === 'open-file-viewer-modal') {
    const filePath = event.data.filePath;
    if (!filePath) return;
    if (window.kairFV && typeof window.kairFV.openWithFileViewerFromPath === 'function') {
        window.kairFV.openWithFileViewerFromPath(filePath);
    } else {
        console.warn('[CopasstPortal] kairFV.openWithFileViewerFromPath no disponible');
    }
    return;
}

if (event.data.type.endsWith('-request')) {
const action = event.data.type.replace('-request', '');
    if (action === 'back-to-module') {
        event.stopImmediatePropagation();
        window.removeEventListener('message', this.iframeMessageHandler);
        this.iframeMessageHandler = null;
        this.backToPortal();
} else {
    const apiMap = this._getApiMap();
    const apiName = apiMap[action];
    if (apiName) {
        window.KairDocPreview.handleRequest(event, apiName);
    }
}
}
}

_getApiMap() {
return {
'get-document-folders': 'getDocumentFolders',
'get-documents-in-folder': 'getDocumentsInFolder',
'get-folder-contents': 'getFolderContents',
'get-pdf-preview': 'getPDFPreview',
'get-word-preview': 'getWordPreview',
'get-excel-preview': 'getExcelPreview',
'download-document': 'downloadDocument',
'upload-document': 'uploadDocument',
'delete-document': 'deleteDocument',
'delete-folder': 'deleteFolder',
'create-folder': 'createFolder',
'open-file': 'openFile'
};
}

async _handleStandardRequest(event, apiFunctionName) {
const { requestId, payload } = event.data;
try {
const apiArgs = (payload && payload.filePath) ? payload.filePath : payload;
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
path: result.path,
fileName: result.fileName,
base64Data: result.base64Data,
error: result.error,
code: result.code
}
}, '*');
} catch (error) {
event.source.postMessage({
type: `${event.data.type.replace('-request', '')}-response`,
requestId,
payload: { success: false, error: error.message }
}, '*');
}
}

renderLegacyDesign() {
this.container.innerHTML = '';

const backButton = document.createElement('button');
backButton.className = 'btn btn-back';
backButton.innerHTML = '&#8592; Volver al Módulo';
backButton.addEventListener('click', this.onBackToModuleHome);
this.container.appendChild(backButton);

const title = document.createElement('h3');
title.textContent = this.submoduleName;
title.style.textAlign = 'center';
title.style.marginBottom = '20px';
this.container.appendChild(title);

const cardsContainer = document.createElement('div');
cardsContainer.className = 'module-cards';

const card1 = this._createModuleCard('Explorar Repositorio de Actas', 'Acceder al repositorio documental con todas las actas del comité.', () => this.enterViewer());
cardsContainer.appendChild(card1);

const card2 = this._createModuleCard('Realizar Nueva Acta', 'Generar acta de reunión mensual con plantilla oficial.', () => this.showRealizarActas());
cardsContainer.appendChild(card2);

const card3 = this._createModuleCard('Miembros y Roles', 'Consultar representantes de la empresa y trabajadores.', () => { window.KAIRToast && window.KAIRToast.show('Próximamente', 'info'); });
cardsContainer.appendChild(card3);

const card4 = this._createModuleCard('Marco Normativo', 'Acceso a la Resolución 2013 de 1986 y normatividad vigente.', () => { window.KAIRToast && window.KAIRToast.show('Próximamente', 'info'); });
cardsContainer.appendChild(card4);

this.container.appendChild(cardsContainer);
}

_createModuleCard(title, description, onClick) {
const card = document.createElement('div');
card.className = 'module-card';
card.style.cssText = 'background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:20px;cursor:pointer;transition:all 0.3s ease;text-align:left;';
card.innerHTML = `<h4 style="margin:0 0 10px;color:#174ea6;font-family:'Lexend',sans-serif;">${title}</h4><p style="margin:0;color:#6c757d;font-size:14px;">${description}</p>`;
card.onmouseenter = () => { card.style.borderColor = '#174ea6'; card.style.boxShadow = '0 5px 15px rgba(23,78,166,0.1)'; card.style.transform = 'translateY(-2px)'; };
card.onmouseleave = () => { card.style.borderColor = '#dee2e6'; card.style.boxShadow = 'none'; card.style.transform = 'translateY(0)'; };
card.onclick = onClick;
return card;
}

destroy() {
if (this.iframeMessageHandler) {
window.removeEventListener('message', this.iframeMessageHandler);
this.iframeMessageHandler = null;
}
if (this.portalScript && this.portalScript.parentNode === document.body) {
document.body.removeChild(this.portalScript);
this.portalScript = null;
}
if (window.copasstPortalComponent === this) {
window.copasstPortalComponent = null;
}
if (window.copasstPortalContainer) {
window.copasstPortalContainer = null;
}
this.container.innerHTML = '';
}
}

const _CopasstLogicComponent = window.CopasstComponent;

window.CopasstComponent = CopasstPortalComponent;
