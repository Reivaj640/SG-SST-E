// copasst-home.js - Lógica del Portal de Bienvenida COPASST
// Este script se carga dinámicamente desde copasst-portal-logic.js

// NO usar DOMContentLoaded porque el HTML se carga vía fetch

function initializePortal() {
console.log('[copasst-home] initializePortal() INICIADO');
}

function goBackToModule() {
  if (window.copasstPortalComponent) {
    window.copasstPortalComponent.destroy();
  }
  if (window.parent && window.parent.postMessage) {
    window.parent.postMessage({ type: 'back-to-module-request' }, '*');
  }
}

function enterRepositorioActas() {
if (window.copasstPortalComponent) {
window.copasstPortalComponent.enterViewer();
} else {
window.KAIRToast && window.KAIRToast.show('Error: No se pudo acceder al repositorio de actas.', 'error');
}
}

function realizarNuevaActa() {
if (window.copasstPortalComponent) {
window.copasstPortalComponent.showRealizarActas();
} else {
window.KAIRToast && window.KAIRToast.show('Error: No se pudo acceder al generador de actas.', 'error');
}
}

function openMiembrosRoles() {
window.KAIRToast && window.KAIRToast.show('Funcionalidad: Gestión de Miembros', 'info', { subtitle: 'Próximamente' });
}

function openMarcoNormativo() {
window.KAIRToast && window.KAIRToast.show('Marco Normativo COPASST', 'info', { subtitle: 'Próximamente' });
}

function showLoading(message) {
const overlay = document.createElement('div');
overlay.id = 'loadingOverlay';
overlay.style.cssText = `
position: fixed; top: 0; left: 0; width: 100%; height: 100%;
background: rgba(255,255,255,0.95);
display: flex; flex-direction: column; align-items: center; justify-content: center;
z-index: 9999;
`;
overlay.innerHTML = `
<i class="bi bi-arrow-repeat" style="font-size: 3rem; color: #174ea6; margin-bottom: 1rem; animation: spin 1s linear infinite;"></i>
<h2 style="font-family: 'Lexend', sans-serif; color: #212529;">${message}</h2>
<p style="color: #6c757d;">Por favor espere...</p>
`;
document.body.appendChild(overlay);
}

function hideLoading() {
const overlay = document.getElementById('loadingOverlay');
if (overlay) overlay.remove();
}

function callParentAPI(type, payload) {
return new Promise((resolve, reject) => {
const requestId = `req-${Date.now()}-${Math.random()}`;
const requestType = `${type}-request`;
const responseType = `${type}-response`;

const handleResponse = (event) => {
if (event.origin !== 'file://' && event.source !== window.parent && event.source !== window) {
return;
}
const response = event.data;
if (response.type === responseType && response.requestId === requestId) {
window.removeEventListener('message', handleResponse);
if (response.payload && response.payload.success) {
resolve(response.payload);
} else {
reject(new Error(response.payload?.error || 'Unknown error'));
}
}
};

window.addEventListener('message', handleResponse);
window.parent.postMessage({ type: requestType, payload, requestId }, '*');
});
}
