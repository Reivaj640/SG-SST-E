// roles-responsabilidades-logic.js - Componente para el submódulo "1.1.2 Roles y Responsabilidades"

class RolesResponsabilidadesComponent {
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
        const viewerUrl = `modules/recursos/roles-responsabilidades/roles-responsabilidades-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        iframe.src = viewerUrl;

        // 📦705-fix2 (2026-08-14) — Inyectar el electronAPI al iframe cuando carga.
        // Se hace via postMessage handshake para evitar problemas de contextIsolation.
        // El approach anterior (`iframe.contentWindow.electronAPI = window.electronAPI`)
        // falla porque el proxy del contextBridge no se transfiere correctamente entre
        // contextos. Ahora el parent actúa como proxy: recibe `kair-rr-bridge-call` y
        // los redirige al IPC, devolviendo el resultado via `kair-rr-bridge-result`.
        iframe.addEventListener('load', function () {
            try {
                if (iframe.contentWindow && window.electronAPI && window.electronAPI.rolesResp) {
                    iframe.contentWindow.postMessage({
                        type: 'kair-rr-parent-ack',
                        source: 'roles-resp-logic',
                        electronAPISnapshot: true
                    }, '*');
                    console.log('[RolesLogic] Handshake postMessage enviado al iframe');
                }
            } catch (e) {
                console.warn('[RolesLogic] No se pudo enviar handshake:', e.message);
            }
        });

        this.container.appendChild(iframe);
    }

    handleIframeMessage(event) {
        if (!event.data || !event.data.type) {
            return;
        }

        // 📦705-fix2 (2026-08-14) — El iframe nos pide que invoquemos el IPC.
        // Somos proxy del contextBridge del parent (que SÍ funciona) y le
        // devolvemos el resultado al iframe. Este patrón bypassea el problema
        // de transferir el proxy de contextBridge entre contextos.
        if (event.data.type === 'kair-rr-bridge-call') {
            this._handleBridgeCall(event);
            return;
        }

        // 📦608-fix15 — El iframe (roles-responsabilidades-viewer.js) nos pide
        // abrir el modal full-screen de file-viewer.
        if (event.data.type === 'open-file-viewer-modal') {
            const filePath = event.data.filePath;
            if (!filePath) return;
            if (window.kairFV && typeof window.kairFV.openWithFileViewerFromPath === 'function') {
                window.kairFV.openWithFileViewerFromPath(filePath);
            } else {
                console.warn('[RolesLogic] kairFV.openWithFileViewerFromPath no disponible');
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
                    console.warn(`[RolesLogic] Acción no manejada: ${action}`);
            }
        }
    }

    // 📦705-fix2 (2026-08-14) — Proxy del IPC via postMessage.
    // Mapea los canales del bridge a las APIs del preload del parent.
    async _handleBridgeCall(event) {
        const { callId, channel, payload } = event.data;
        if (!callId || !channel) return;
        if (!window.electronAPI || !window.electronAPI.rolesResp) {
            event.source.postMessage({
                type: 'kair-rr-bridge-result',
                callId: callId,
                error: 'electronAPI.rolesResp no disponible en el parent'
            }, '*');
            return;
        }
        try {
            let result;
            switch (channel) {
                case 'roles-resp:catalogo-listar':
                    result = await window.electronAPI.rolesResp.listarCatalogo();
                    break;
                case 'roles-resp:catalogo-crear':
                    result = await window.electronAPI.rolesResp.crearRol(payload);
                    break;
                case 'roles-resp:catalogo-actualizar':
                    result = await window.electronAPI.rolesResp.actualizarRol(payload);
                    break;
                case 'roles-resp:catalogo-desactivar':
                    result = await window.electronAPI.rolesResp.desactivarRol(payload);
                    break;
                case 'roles-resp:asignacion-listar':
                    result = await window.electronAPI.rolesResp.listarAsignaciones(payload && payload.empresaId);
                    break;
                case 'roles-resp:asignacion-upsert':
                    result = await window.electronAPI.rolesResp.upsertAsignacion(payload);
                    break;
                case 'roles-resp:divulgacion-listar':
                    result = await window.electronAPI.rolesResp.listarDivulgaciones(payload && payload.empresaId);
                    break;
                case 'roles-resp:divulgacion-upsert':
                    result = await window.electronAPI.rolesResp.upsertDivulgacion(payload);
                    break;
                case 'roles-resp:divulgacion-eliminar':
                    result = await window.electronAPI.rolesResp.eliminarDivulgacion(payload && payload.id);
                    break;
                case 'roles-resp:reporte-pdf':
                    result = await window.electronAPI.rolesResp.generarReportePDF(payload);
                    break;
                // 📦705-fix8 (2026-08-14) — File dialogs y copia
                case 'roles-resp:archivo-seleccionar-origen':
                    result = await window.electronAPI.rolesResp.seleccionarArchivoOrigen();
                    break;
                case 'roles-resp:archivo-seleccionar-destino':
                    result = await window.electronAPI.rolesResp.seleccionarCarpetaDestino(payload);
                    break;
                case 'roles-resp:archivo-copiar':
                    result = await window.electronAPI.rolesResp.copiarArchivo(payload);
                    break;
                case 'roles-resp:archivo-descargar':
                    result = await window.electronAPI.rolesResp.descargarArchivo(payload);
                    break;
                // 📦706 (2026-08-14) — Multi-documento por divulgación
                case 'roles-resp:divulgacion-documento-listar':
                    result = await window.electronAPI.rolesResp.listarDocumentosDivulgacion(payload);
                    break;
                case 'roles-resp:divulgacion-documento-marcar-actual':
                    result = await window.electronAPI.rolesResp.marcarDocumentoActual(payload);
                    break;
                default:
                    throw new Error('Canal IPC desconocido: ' + channel);
            }
            event.source.postMessage({
                type: 'kair-rr-bridge-result',
                callId: callId,
                result: result
            }, '*');
        } catch (e) {
            console.error('[RolesLogic] Bridge call error:', e.message);
            event.source.postMessage({
                type: 'kair-rr-bridge-result',
                callId: callId,
                error: e.message
            }, '*');
        }
    }

    destroy() {
        window.removeEventListener('message', this.handleIframeMessage);
        this.container.innerHTML = '';
    }
}

window.RolesResponsabilidadesComponent = RolesResponsabilidadesComponent;