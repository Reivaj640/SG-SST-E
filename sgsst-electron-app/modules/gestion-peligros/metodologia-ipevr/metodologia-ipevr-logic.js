// metodologia-ipevr-logic.js - Componente para el submódulo "4.1.1 Metodología IPEVR"

class MetodologiaIpevrComponent {
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

 const viewerUrl = `modules/gestion-peligros/metodologia-ipevr/metodologia-ipevr-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
 iframe.src = viewerUrl;

 this.container.appendChild(iframe);
 }

 handleIframeMessage(event) {
 if (!event.data || !event.data.type) {
 return;
 }

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
 console.warn(`[MetodologiaIpevrLogic] Acción no manejada: ${action}`);
 }
 }
 }

 async handleStandardRequest(event, apiFunctionName) {
 const { requestId, payload } = event.data;
 console.log(`[MetodologiaIpevrLogic] Solicitud: ${apiFunctionName}, ID: ${requestId}`);

 try {
 if (!window.electronAPI || typeof window.electronAPI[apiFunctionName] !== 'function') {
 throw new Error(`API function ${apiFunctionName} not found`);
 }

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
 console.error(`[MetodologiaIpevrLogic] Error en ${apiFunctionName}:`, error);
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

window.MetodologiaIpevrComponent = MetodologiaIpevrComponent;
