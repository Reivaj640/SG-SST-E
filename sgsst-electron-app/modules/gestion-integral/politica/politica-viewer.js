// --- LÓGICA POLITICA-V2.JS (CORREGIDO) ---

console.log('[IFRAME] politica-viewer.js cargado');

// --- CONFIGURACIÓN ONLYOFFICE ---
const OO_SERVER_URL = 'http://localhost:8080';
const BRIDGE_URL = 'http://localhost:3011';

// Estado Global
const state = {
    currentPath: '',
    history: [],
    currentFile: null,
    zoom: 100,
    isEditMode: false,
    isReady: false
};

// Contador para evitar spam de logs
let logCounter = 0;

// --- COMUNICACIÓN CON EL PADRE (Electron) ---
function callParentAPI(type, payload) {
    return new Promise((resolve, reject) => {
        const requestId = `req-${Date.now()}`;
        
        const handler = (event) => {
            // Solo procesar si es la respuesta correcta
            if (event.data?.type !== `${type}-response` || event.data?.requestId !== requestId) {
                return;
            }
            
            window.removeEventListener('message', handler);
            
            if (event.data.payload?.success) {
                resolve(event.data.payload);
            } else {
                reject(new Error(event.data.payload?.error || 'Error desconocido'));
            }
        };
        
        window.addEventListener('message', handler);
        
        // Enviar mensaje al padre
        try {
            window.parent.postMessage({ type: `${type}-request`, payload, requestId }, '*');
        } catch (e) {
            reject(e);
        }
    });
}

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const company = params.get('company');
    
    const companyLabel = document.getElementById('companyLabel');
    if (companyLabel) {
        companyLabel.textContent = company;
    }

    setupListeners();
    
    // Notificar al padre que el iframe está listo
    window.parent.postMessage({ type: 'iframe-ready' }, '*');
    
    // Cargar carpetas
    await loadRootFolder();
});

function setupListeners() {
    const backBtn = document.getElementById('backToModuleBtn');
    if (backBtn) {
        backBtn.onclick = () => window.parent.postMessage({ type: 'back-to-module-request' }, '*');
    }
    
    const navUpBtn = document.getElementById('navUpBtn');
    if (navUpBtn) navUpBtn.onclick = goUp;
    
    const closeDocBtn = document.getElementById('closeDocBtn');
    if (closeDocBtn) closeDocBtn.onclick = closeDocument;
    
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) downloadBtn.onclick = downloadCurrentFile;
    
    const editModeBtn = document.getElementById('editModeBtn');
    if (editModeBtn) editModeBtn.onclick = enableEditMode;
    
    const zoomInBtn = document.getElementById('zoomInBtn');
    if (zoomInBtn) zoomInBtn.onclick = () => adjustZoom(10);
    
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    if (zoomOutBtn) zoomOutBtn.onclick = () => adjustZoom(-10);
    
    console.log('[IFRAME] Listeners configurados');
}

// --- NAVEGACIÓN DE ARCHIVOS ---
async function loadRootFolder() {
    try {
        const params = new URLSearchParams(window.location.search);
        const result = await callParentAPI('get-document-folders', {
            companyName: params.get('company'),
            moduleName: params.get('module'),
            submoduleName: params.get('submodule')
        });

        state.currentPath = result.basePath || '';
        state.history = [];
        updateNavState();
        renderFolders(result.folders || []);
        renderFiles(result.files || []);
        
        console.log('[IFRAME] ✅ Carpetas cargadas:', result.files?.length || 0, 'archivos');
    } catch (e) {
        console.error('[IFRAME] Error cargando carpetas:', e.message);
        showToast('Error cargando carpeta raíz', 'error');
    }
}

async function goUp() {
    if (state.history.length === 0) return;
    const prev = state.history.pop();
    state.currentPath = prev;
    updateNavState();
    await loadFilesInPath(prev);
}

async function loadFilesInPath(path) {
    try {
        const result = await callParentAPI('get-documents-in-folder', path);
        renderFolders([]);
        renderFiles(result.files || []);
    } catch (e) {
        console.error('[IFRAME] Error cargando archivos:', e.message);
    }
}

function updateNavState() {
    const navUpBtn = document.getElementById('navUpBtn');
    if (navUpBtn) {
        navUpBtn.disabled = state.history.length === 0;
    }
}

// --- RENDERIZADO ---
function renderFolders(folders) {
    const container = document.getElementById('folderList');
    if (!container) return;
    
    if (!folders || folders.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = folders.map(f => `
        <div class="file-item" onclick="enterFolder('${encodeURIComponent(f.path)}')">
            <div class="file-icon icon-folder"><i class="fas fa-folder"></i></div>
            <div class="file-info"><div class="file-name">${f.name}</div></div>
        </div>
    `).join('');
}

function renderFiles(files) {
    const container = document.getElementById('fileList');
    const docCount = document.getElementById('docCount');
    
    if (!container) return;
    
    if (docCount) {
        docCount.textContent = files.length;
    }

    if (!files || files.length === 0) {
        container.innerHTML = `<div style="padding:1rem; text-align:center; color:#999;">Sin documentos</div>`;
        return;
    }

    container.innerHTML = files.map(f => {
        let iconClass = 'icon-doc';
        if (f.extension && f.extension.toLowerCase().includes('pdf')) iconClass = 'icon-pdf';
        if (f.extension && (f.extension.toLowerCase().includes('xls') || f.extension.toLowerCase().includes('xlsx'))) iconClass = 'icon-xls';
        
        return `
        <div class="file-item" onclick="openFile('${encodeURIComponent(f.path)}', '${f.name}', '${f.extension || ''}')">
            <div class="file-icon ${iconClass}">
                <i class="fas fa-file-alt"></i>
            </div>
            <div class="file-info">
                <div class="file-name">${f.name}</div>
                <div class="file-meta">${(f.extension || '').toUpperCase()}</div>
            </div>
        </div>
    `;
    }).join('');
}

// --- GESTIÓN DE DOCUMENTOS ---
async function openFile(encodedPath, name, ext) {
    const filePath = decodeURIComponent(encodedPath);
    
    state.currentFile = { path: filePath, name: name, ext: ext };

    // UI Updates
    const emptyState = document.getElementById('emptyState');
    const docWrapper = document.getElementById('documentWrapper');
    const currentDocTitle = document.getElementById('currentDocTitle');
    const editModeBtn = document.getElementById('editModeBtn');
    
    if (emptyState) emptyState.style.display = 'none';
    if (docWrapper) docWrapper.classList.add('active');
    if (currentDocTitle) currentDocTitle.textContent = name;
    
    // Reset Views
    exitEditMode();

    const extLower = (ext || '').toLowerCase();
    const isWord = ['doc', 'docx'].includes(extLower);

    if (isWord) {
        await openOnlyOfficeEditor(filePath, name);
    } else if (extLower === 'pdf') {
        showToast('PDF no editable en esta versión', 'warning');
    } else {
        showToast('Formato no soportado', 'warning');
    }
}

function renderPDF(base64) {
    const container = document.getElementById('viewerContainer');
    if (!container) return;
    
    container.innerHTML = `<iframe id="pdfFrame" class="viewer-frame active" src="data:application/pdf;base64,${base64}"></iframe>`;
    state.zoom = 100;
}

function closeDocument() {
    state.currentFile = null;
    const docWrapper = document.getElementById('documentWrapper');
    const emptyState = document.getElementById('emptyState');
    const viewerContainer = document.getElementById('viewerContainer');
    
    if (docWrapper) docWrapper.classList.remove('active');
    if (emptyState) emptyState.style.display = 'flex';
    if (viewerContainer) viewerContainer.innerHTML = '';
    exitEditMode();
}

function exitEditMode() {
    const editorLayer = document.getElementById('editorLayer');
    const viewerContainer = document.getElementById('viewerContainer');
    const editModeBtn = document.getElementById('editModeBtn');
    
    if (editorLayer) editorLayer.classList.remove('active');
    if (viewerContainer) viewerContainer.classList.add('active');
    if (editModeBtn) editModeBtn.style.display = 'flex';
    state.isEditMode = false;
}

function enableEditMode() {
    if (!state.currentFile) return;
    
    const editorLayer = document.getElementById('editorLayer');
    const viewerContainer = document.getElementById('viewerContainer');
    
    if (editorLayer && viewerContainer) {
        editorLayer.classList.add('active');
        viewerContainer.classList.remove('active');
        state.isEditMode = true;
    }
}

// --- SOLO EDITOR ONLYOFFICE ---
async function openOnlyOfficeEditor(filePath, fileName) {
    if (!filePath) return;

    showToast('Cargando editor OnlyOffice...', 'info');

    try {
        // Obtener configuración del editor
        const config = await callParentAPI('open-onlyoffice-editor', {
            filePath: filePath,
            fileName: fileName
        });
        
        if (config.success && config.editorUrl) {
            console.log('[IFRAME] ✅ OnlyOffice configurado, inicializando editor...');
            launchOnlyOfficeEditor(config);
        } else {
            throw new Error(config.error || 'Error configurando OnlyOffice');
        }
    } catch (error) {
        console.error('[IFRAME] Error OnlyOffice:', error.message);
        
        // Mostrar mensaje de error más detallado
        const errorMsg = error.message || 'Error desconocido';
        if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('connect')) {
            showToast('Error: OnlyOffice no está disponible. Verifique que el servidor esté corriendo en http://localhost:8080', 'error');
        } else {
            showToast('Error al abrir editor: ' + errorMsg, 'error');
        }
    }
}

function launchOnlyOfficeEditor(data) {
    const viewerContainer = document.getElementById('viewerContainer');
    if (!viewerContainer) return;
    
    // Limpiar contenedor
    viewerContainer.innerHTML = '';
    
    // Usar iframe en lugar de webview (los webviews no funcionan dentro de iframes en Electron)
    const editorUrl = data.editorUrl;
    const alternativeEditorUrl = data.alternativeEditorUrl;
    
    console.log('[IFRAME] Cargando OnlyOffice en iframe:', editorUrl.substring(0, 100) + '...');
    
    // Crear iframe para OnlyOffice
    const iframe = document.createElement('iframe');
    iframe.id = 'onlyoffice-iframe';
    iframe.src = editorUrl;
    iframe.style.cssText = 'width: 100%; height: 100%; border: none; display: block;';
    iframe.setAttribute('allow', 'fullscreen; clipboard-read; clipboard-write');
    
    // Eventos del iframe
    iframe.addEventListener('load', function() {
        console.log('[IFRAME] OnlyOffice cargado en iframe');
        showToast('Editor OnlyOffice cargado', 'success');
    });
    
    iframe.addEventListener('error', function(event) {
        console.error('[IFRAME] Error cargando OnlyOffice:', event.message);
        
        // Si hay una URL alternativa, intentar usarla
        if (alternativeEditorUrl && iframe.src === editorUrl) {
            console.log('[IFRAME] Intentando con URL alternativa...');
            iframe.src = alternativeEditorUrl;
        } else {
            showToast('Error cargando editor: ' + event.message, 'error');
        }
    });
    
    // Detectar si el iframe no puede cargar el contenido (404 o error de conexión)
    iframe.addEventListener('load', function() {
        try {
            // Intentar acceder al contenido del iframe para verificar si cargó correctamente
            // Si hay un error de seguridad, significa que el contenido no cargó
            const iframeContent = iframe.contentWindow || iframe.contentDocument;
            if (!iframeContent) {
                console.error('[IFRAME] No se pudo acceder al contenido del iframe');
                
                // Si hay una URL alternativa, intentar usarla
                if (alternativeEditorUrl && iframe.src === editorUrl) {
                    console.log('[IFRAME] Intentando con URL alternativa...');
                    iframe.src = alternativeEditorUrl;
                } else {
                    showToast('Error: No se pudo cargar el editor OnlyOffice. Verifique que el servidor esté corriendo en http://localhost:8080', 'error');
                }
            }
        } catch (e) {
            // Error de seguridad es normal cuando el contenido cargó correctamente desde otro dominio
            console.log('[IFRAME] Contenido cargado correctamente (error de seguridad esperado)');
        }
    });
    
    viewerContainer.appendChild(iframe);
    
    showToast('Cargando editor OnlyOffice...', 'info');
    
    // Mostrar mensaje de ayuda si OnlyOffice no está disponible
    setTimeout(() => {
        const iframeElement = document.getElementById('onlyoffice-iframe');
        if (iframeElement) {
            try {
                // Intentar verificar si el iframe cargó correctamente
                const iframeDoc = iframeElement.contentDocument || iframeElement.contentWindow.document;
                if (!iframeDoc || iframeDoc.title === '404 Not Found' || iframeDoc.body.innerHTML.includes('404')) {
                    console.error('[IFRAME] OnlyOffice no está disponible (404)');
                    
                    // Si hay una URL alternativa, intentar usarla
                    if (alternativeEditorUrl && iframe.src === editorUrl) {
                        console.log('[IFRAME] Intentando con URL alternativa...');
                        iframe.src = alternativeEditorUrl;
                    } else {
                        showToast('Error: OnlyOffice no está disponible. Inicie el servidor OnlyOffice en http://localhost:8080', 'error');
                    }
                }
            } catch (e) {
                // Error de seguridad es normal cuando el contenido cargó correctamente
            }
        }
    }, 5000);
}

// --- UTILIDADES ---
function adjustZoom(delta) {
    if (state.isEditMode) return;
    state.zoom += delta;
    const iframe = document.getElementById('pdfFrame');
    if (iframe && iframe.src) {
        const url = iframe.src.split('#')[0];
        iframe.src = url + `#zoom=${state.zoom}`;
    }
}

async function downloadCurrentFile() {
    if (!state.currentFile) return;
    showToast('Iniciando descarga...', 'info');
    
    try {
        const result = await callParentAPI('download-document', state.currentFile.path);
        if (result.success) {
            const link = document.createElement('a');
            link.href = `data:application/octet-stream;base64,${result.base64Data}`;
            link.download = result.fileName;
            link.click();
        }
    } catch (e) {
        console.error('[IFRAME] Error descargando:', e.message);
    }
}

function showToast(msg, type='success') {
    const t = document.getElementById('toast');
    const txt = document.getElementById('toastMsg');
    if (t && txt) {
        txt.innerText = msg;
        t.className = `toast ${type} show`;
        setTimeout(() => t.classList.remove('show'), 3000);
    }
}

function cancelEditMode() {
    if (confirm('¿Desea salir del modo edición? Los cambios no guardados se perderán.')) {
        exitEditMode();
    }
}
