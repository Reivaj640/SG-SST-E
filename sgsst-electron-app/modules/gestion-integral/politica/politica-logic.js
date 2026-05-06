// politica-logic.js - Componente para el submódulo "2.1.1 Política del SG-SST"
// Patrón: Iframe Viewer Directo (sin portal intermedio)

class PoliticaComponent {
constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
this.container = container;
this.currentCompany = companyName;
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
const viewerUrl = `modules/gestion-integral/politica/politica-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
iframe.src = viewerUrl;
this.container.appendChild(iframe);
}

handleIframeMessage(event) {
if (!event.data || !event.data.type) return;
if (event.data.type.endsWith('-request')) {
const action = event.data.type.replace('-request', '');
if (action === 'back-to-module') {
window.removeEventListener('message', this.handleIframeMessage);
if (this.onBackToModuleHome) {
this.onBackToModuleHome();
}
} else {
this.handleStandardRequest(event, this.getApiMap()[action]);
}
}
}

getApiMap() {
return {
'get-document-folders': 'getDocumentFolders',
'get-documents-in-folder': 'getDocumentsInFolder',
'get-pdf-preview': 'getPDFPreview',
'get-word-preview': 'getWordPreview',
'get-excel-preview': 'getExcelPreview',
'download-document': 'downloadDocument',
'upload-document': 'uploadDocument',
'delete-document': 'deleteDocument',
'open-file': 'openFile'
};
}

async handleStandardRequest(event, apiFunctionName) {
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
fileName: result.fileName,
base64Data: result.base64Data,
error: result.error,
code: result.code,
message: result.message
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

destroy() {
window.removeEventListener('message', this.handleIframeMessage);
this.container.innerHTML = '';
}
}

window.PoliticaComponent = PoliticaComponent;
