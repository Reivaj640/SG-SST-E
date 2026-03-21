// responsable-sg-viewer.js

// Variables globales
let currentDocument = null;
let currentViewer = null;
let currentZoom = 100; // Porcentaje numérico para facilitar cálculos
let totalPages = 0;
let currentPage = 1;
let currentFolderPath = '';
let pathHistory = [];

// --- START: Refactored Communication Logic ---

/**
 * Helper function to communicate with the parent window via postMessage.
 * This abstracts the request-response logic for calling Electron APIs from the iframe.
 * @param {string} type - The type of the request (e.g., 'get-documents-in-folder').
 * @param {*} payload - The data to send with the request.
 * @returns {Promise<any>} - A promise that resolves with the payload from the parent's response.
 */
function callParentAPI(type, payload) {
    console.log(`[responsable-sg-viewer.js][callParentAPI] Enviando solicitud al padre. Tipo: ${type}, Payload:`, payload);
    return new Promise((resolve, reject) => {
        // Unique ID for this request to match it with a response
        const requestId = `req-${Date.now()}-${Math.random()}`;

        const handleResponse = (event) => {
            // Security: only accept messages from the parent window on file protocol
            if (event.origin !== 'file://' || event.source !== window.parent) {
                return;
            }

            const response = event.data;
            // Check if the response corresponds to our request
            if (response.type === `${type}-response` && response.requestId === requestId) {
                // Clean up the event listener
                window.removeEventListener('message', handleResponse);
                console.log(`[responsable-sg-viewer.js][callParentAPI] Respuesta recibida del padre para requestId ${requestId}. Success: ${response.payload && response.payload.success}`);

                if (response.payload && response.payload.success) {
                    resolve(response.payload);
                } else {
                    const errorMessage = (response.payload && response.payload.error) || 'Unknown error from parent process';
                    console.error(`[responsable-sg-viewer.js][callParentAPI] Error recibido para la solicitud '${type}':`, errorMessage);
                    reject(new Error(errorMessage));
                }
            }
        };

        window.addEventListener('message', handleResponse);

        // Send the request to the parent window
        console.log(`VIEWER: 🗣️ Sending message to parent: ${type}-request`, { payload, requestId });
        window.parent.postMessage({
            type: `${type}-request`,
            payload,
            requestId
        }, 'file://');
    });
}
// --- END: Refactored Communication Logic ---


// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupDragAndDrop(); // Agregar funcionalidad drag & drop
    setupContextMenu(); // Agregar menú contextual
    loadFolders();
});

// Configurar event listeners
function setupEventListeners() {
    // Navegación Global
    document.getElementById('backToModuleBtn').addEventListener('click', () => {
        if (window.parent && window.parent.postMessage) {
            window.parent.postMessage({ type: 'back-to-module-request' }, '*');
        }
    });

    // Acciones de Documento
    document.getElementById('downloadBtn').addEventListener('click', downloadDocument);
    document.getElementById('printBtn').addEventListener('click', printDocument);
    document.getElementById('closeDocBtn').addEventListener('click', closeDocument);

    // Navegación Local (Carpetas)
    document.getElementById('goBackBtn').addEventListener('click', () => goUpLevel());

    // Zoom Controls
    document.getElementById('zoomInBtn').addEventListener('click', zoomIn);
    document.getElementById('zoomOutBtn').addEventListener('click', zoomOut);
    document.getElementById('fitWidthBtn').addEventListener('click', fitWidth);
}

// ===============================
// DRAG & DROP FUNCTIONALITY (Por Carpeta)
// ===============================

// Configurar eventos de drag & drop
function setupDragAndDrop() {
    // Se configura dinámicamente en renderFolders() para cada carpeta
    console.log('[Drag&Drop] Setup completado - se activará por carpeta');
}

// Configurar drag & drop en una carpeta específica
function setupFolderDragAndDrop(folderElement, folderPath) {
    const overlay = document.createElement('div');
    overlay.className = 'drag-drop-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
        <div class="drag-drop-content">
            <i class="fas fa-cloud-upload-alt"></i>
            <h3>Suelta aquí</h3>
        </div>
    `;

    folderElement.appendChild(overlay);
    
    let dragCounter = 0;
    
    // Prevenir comportamiento por defecto
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        folderElement.addEventListener(eventName, preventDefaults, false);
    });
    
    // Mostrar overlay cuando se arrastra sobre la carpeta
    folderElement.addEventListener('dragenter', (e) => {
        dragCounter++;
        if (dragCounter === 1) {
            overlay.style.display = 'flex';
            folderElement.classList.add('drag-over');
            console.log(`[Drag&Drop] Enter en carpeta: ${folderPath}`);
        }
    }, false);
    
    folderElement.addEventListener('dragover', handleDragOver, false);
    
    folderElement.addEventListener('dragleave', (e) => {
        dragCounter--;
        if (dragCounter === 0) {
            overlay.style.display = 'none';
            folderElement.classList.remove('drag-over');
            console.log(`[Drag&Drop] Leave en carpeta: ${folderPath}`);
        }
    }, false);
    
    folderElement.addEventListener('drop', (e) => {
        e.preventDefault();
        overlay.style.display = 'none';
        folderElement.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        
        if (files.length === 0) {
            showNotification('No se detectaron archivos', 'warning');
            return;
        }
        
        console.log(`[Drag&Drop] Archivos detectados: ${files.length} en carpeta ${folderPath}`);
        
        // Procesar cada archivo
        Array.from(files).forEach(file => {
            uploadFile(file, folderPath);
        });
    }, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

function handleDrop(e) {
    e.preventDefault();
    
    const overlay = document.getElementById('dragDropOverlay');
    overlay.style.display = 'none';
    
    const files = e.dataTransfer.files;
    
    if (files.length === 0) {
        showNotification('No se detectaron archivos', 'warning');
        return;
    }
    
    console.log(`[Drag&Drop] Archivos detectados: ${files.length}`);
    
    // Procesar cada archivo
    Array.from(files).forEach(file => {
        uploadFile(file);
    });
}

// Subir archivo
async function uploadFile(file, folderPath) {
    try {
        console.log(`[Drag&Drop] Subiendo archivo: ${file.name} a ${folderPath}`);
        showNotification(`Subiendo ${file.name}...`, 'info');

        // 1. Convertir file a base64
        const base64Data = await fileToBase64(file);

        // 2. Usar la ruta de la carpeta donde se soltó
        const destinationPath = folderPath || currentFolderPath;

        if (!destinationPath) {
            showNotification('No hay una carpeta seleccionada', 'error');
            return;
        }

        // 3. Enviar al padre via postMessage
        const result = await callParentAPI('upload-document', {
            fileName: file.name,
            base64Data: base64Data,
            destinationPath: destinationPath
        });

        // 4. Mostrar resultado
        if (result.success) {
            showNotification(result.message || 'Archivo subido exitosamente', 'success');

            // 5. Recargar lista de archivos
            await loadDocuments(destinationPath);
        } else {
            showNotification(`Error: ${result.error}`, 'error');
        }

    } catch (error) {
        console.error('[Drag&Drop] Error al subir archivo:', error);
        showNotification(`Error al subir archivo: ${error.message}`, 'error');
    }
}

// Convertir File a Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// ===============================
// CONTEXT MENU (CLIC DERECHO)
// ===============================

let currentContextMenuDoc = null;

// Mostrar menú contextual
function showContextMenu(x, y, doc) {
    const menu = document.getElementById('contextMenu');
    if (!menu) return;
    
    currentContextMenuDoc = doc;
    
    // Posicionar menú
    menu.style.display = 'block';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    
    // Ajustar si se sale de la pantalla
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = `${window.innerWidth - rect.width - 10}px`;
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = `${window.innerHeight - rect.height - 10}px`;
    }
    
    console.log(`[ContextMenu] Mostrando menú para: ${doc.name}`);
}

// Ocultar menú contextual
function hideContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (menu) {
        menu.style.display = 'none';
    }
    currentContextMenuDoc = null;
}

// Eliminar documento
async function deleteDocument() {
    if (!currentContextMenuDoc) {
        console.error('[ContextMenu] No hay documento seleccionado');
        showToast('No hay archivo seleccionado', 'error');
        return;
    }

    const doc = currentContextMenuDoc;

    console.log('[ContextMenu] Mostrando modal para eliminar:', doc.name);

    // Mostrar modal moderno en lugar de confirm()
    showConfirmModal(doc.name, async () => {
        console.log('[ConfirmModal] Callback ejecutado - Eliminando archivo:', doc.path);

        // Callback se ejecuta al aceptar
        try {
            // Cerrar el documento primero para liberar el archivo de memoria (evita EPERM)
            console.log('[ContextMenu] Cerrando documento para liberar archivo...');
            closeDocument();

            console.log(`[ContextMenu] Eliminando archivo: ${doc.path}`);

            const result = await callParentAPI('delete-document', {
                filePath: doc.path
            });

            console.log('[ContextMenu] Resultado de eliminar:', result);

            if (result.success) {
                showToast('Archivo eliminado correctamente', 'success');
                // Recargar lista de archivos
                console.log('[ContextMenu] Recargando lista de archivos...');
                await loadDocuments(currentFolderPath);
            } else {
                console.error('[ContextMenu] Error en respuesta:', result.error);

                // Manejo específico para error EPERM (archivo en uso)
                if (result.code === 'EPERM') {
                    showToast(
                        '⚠️ El archivo está abierto en otra aplicación.<br><strong>CIérralo e intenta nuevamente.</strong>',
                        'warning',
                        6000
                    );
                } else if (result.code === 'ENOENT') {
                    showToast('El archivo no existe. Puede que ya haya sido eliminado.', 'info');
                } else if (result.code === 'EACCES') {
                    showToast('No tienes permisos para eliminar este archivo.', 'error');
                } else {
                    showToast(`Error: ${result.error}`, 'error');
                }
            }
        } catch (error) {
            console.error('[ContextMenu] Error al eliminar:', error);
            showToast(`Error al eliminar archivo: ${error.message}`, 'error');
        }
    });
}

// Setup de listeners para el menú contextual
function setupContextMenu() {
    // Cerrar menú al hacer clic en cualquier parte
    document.addEventListener('click', () => {
        hideContextMenu();
    });
    
    // Cerrar menú al presionar Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideContextMenu();
        }
    });
    
    // Setup del modal de confirmación
    setupConfirmModal();
    
    // Listener para el botón eliminar
    const deleteBtn = document.getElementById('deleteFileBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar que se cierre inmediatamente
            deleteDocument();
        });
    }
    
    // Listener para el botón abrir archivo
    const openBtn = document.getElementById('openFileBtn');
    if (openBtn) {
        openBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openFile();
        });
    }
}

// ===============================
// TOAST NOTIFICATIONS (K+AIR Modern Style)
// ===============================

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('kToastContainer');
    if (!container) {
        console.error('[Toast] Contenedor no encontrado');
        return;
    }
    
    // Iconos por tipo
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    
    // Crear toast
    const toast = document.createElement('div');
    toast.className = `k-toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info} k-toast-icon"></i>
        <span class="k-toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto-eliminar después del tiempo especificado
    setTimeout(() => {
        toast.classList.add('closing');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ===============================
// CONFIRM MODAL (K+AIR Modern)
// ===============================

let confirmCallback = null;

function showConfirmModal(fileName, callback) {
    const modal = document.getElementById('confirmModal');
    const fileNameEl = document.getElementById('confirmFileName');
    
    if (!modal || !fileNameEl) {
        console.error('[ConfirmModal] Elementos no encontrados');
        return;
    }
    
    console.log('[ConfirmModal] Mostrando modal para:', fileName);
    console.log('[ConfirmModal] Callback registrado:', !!callback);
    
    fileNameEl.textContent = fileName;
    confirmCallback = callback;
    
    modal.style.display = 'flex';
    
    // Focus en botón cancelar por seguridad
    document.getElementById('confirmCancelBtn').focus();
}

function hideConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.style.display = 'none';
    }
    confirmCallback = null;
}

function acceptConfirm() {
    console.log('[ConfirmModal] Aceptando confirmación, callback existe:', !!confirmCallback);
    if (confirmCallback) {
        console.log('[ConfirmModal] Ejecutando callback...');
        confirmCallback();
    } else {
        console.error('[ConfirmModal] No hay callback registrado');
    }
    hideConfirmModal();
}

function cancelConfirm() {
    hideConfirmModal();
}

function setupConfirmModal() {
    const acceptBtn = document.getElementById('confirmAcceptBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    const modal = document.getElementById('confirmModal');
    
    if (acceptBtn) {
        acceptBtn.addEventListener('click', acceptConfirm);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelConfirm);
    }
    
    // Cerrar al hacer clic fuera del modal
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cancelConfirm();
            }
        });
    }
    
    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
            cancelConfirm();
        }
    });
}

// Abrir archivo con aplicación predeterminada
async function openFile() {
    if (!currentContextMenuDoc) {
        console.error('[ContextMenu] No hay documento seleccionado');
        showToast('No hay archivo seleccionado', 'error');
        return;
    }
    
    const doc = currentContextMenuDoc;
    
    try {
        console.log(`[ContextMenu] Abriendo archivo: ${doc.path}`);
        
        const result = await callParentAPI('open-file', {
            filePath: doc.path
        });
        
        if (!result.success) {
            showToast(`Error al abrir archivo: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('[ContextMenu] Error al abrir:', error);
        showToast(`Error al abrir archivo: ${error.message}`, 'error');
    }
    
    hideContextMenu();
}

// Cargar carpetas
async function loadFolders() {
    console.log('VIEWER: Iniciando loadFolders...');
    showLoading();

    const urlParams = new URLSearchParams(window.location.search);
    const companyName = urlParams.get('company');
    const moduleName = urlParams.get('module');
    const submoduleName = urlParams.get('submodule');

    if (!companyName || !moduleName || !submoduleName) {
        showNotification('Faltan parámetros en la URL', 'error');
        console.error('VIEWER: Faltan parámetros en la URL.');
        hideLoading();
        return;
    }

    try {
        const result = await callParentAPI('get-document-folders', { companyName, moduleName, submoduleName });
        console.log('VIEWER: La carga de carpetas y archivos raíz fue exitosa. Renderizando...');
        currentFolderPath = result.basePath; // Guardar la ruta base
        pathHistory = []; // Inicializar historial vacío en la raíz
        
        updateNavigationState(); // Actualizar botones y breadcrumbs
        
        renderFolders(result.folders);
        renderDocuments(result.files); 
    } catch (error) {
        showNotification(`Error al cargar contenido inicial: ${error.message}`, 'error');
        console.error('VIEWER: Error catastrófico en loadFolders:', error);
    } finally {
        hideLoading();
    }
}

// Renderizar carpetas
function renderFolders(folders) {
    const folderList = document.getElementById('folderList');
    folderList.innerHTML = '';

    if (!folders || folders.length === 0) {
        folderList.innerHTML = '<div style="padding:1rem; color:#999; font-size:0.85rem;">No hay carpetas.</div>';
        return;
    }

    folders.forEach(folder => {
        const folderItem = document.createElement('div');
        folderItem.className = 'list-item folder'; // Agregar clase 'folder' para drag & drop
        folderItem.dataset.path = folder.path;

        // Icono de carpeta (amarillo según estilo K+AIR)
        const iconDiv = document.createElement('div');
        iconDiv.className = 'item-icon folder';
        iconDiv.innerHTML = '<i class="fas fa-folder"></i>';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'item-info';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'item-name';
        nameDiv.textContent = folder.name;

        infoDiv.appendChild(nameDiv);
        folderItem.appendChild(iconDiv);
        folderItem.appendChild(infoDiv);

        folderItem.addEventListener('click', () => {
            selectFolder(folder.path);
        });

        // Configurar drag & drop para esta carpeta específica
        setupFolderDragAndDrop(folderItem, folder.path);

        folderList.appendChild(folderItem);
    });
}

// Seleccionar carpeta
async function selectFolder(path) {
    try {
        // Guardar la ruta actual en el historial antes de cambiar si es navegación hacia adentro
        if (currentFolderPath !== path) {
            // Solo añadir si no estamos regresando (simplificado, para breadcrumb real se necesitaría más lógica)
            pathHistory.push(currentFolderPath);
        }

        currentFolderPath = path;

        // Resetear selección visual
        document.querySelectorAll('.list-item').forEach(item => {
            item.classList.remove('active');
        });

        const selectedItem = document.querySelector(`[data-path="${path}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        }

        await loadDocuments(path);
        updateNavigationState();

    } catch (error) {
        showNotification('Error al seleccionar carpeta', 'error');
    }
}

// Cargar documentos de una carpeta
async function loadDocuments(folderPath) {
    try {
        console.log(`VIEWER: Cargando documentos para la ruta: ${folderPath}`);
        const result = await callParentAPI('get-documents-in-folder', folderPath);
        renderDocuments(result.files); 
    } catch (error) {
        showNotification(`Error al cargar documentos: ${error.message}`, 'error');
        console.error('VIEWER: Error en loadDocuments:', error);
    }
}

// Renderizar documentos
function renderDocuments(documents) {
    console.log('[DIAGNÓSTICO] renderDocuments: Recibidos para renderizar:', documents);
    const documentList = document.getElementById('fileList');
    const docCount = document.getElementById('docCount');
    
    documentList.innerHTML = '';

    if (!documents || documents.length === 0) {
        documentList.innerHTML = '<div style="padding:1rem; color:#999; font-size:0.85rem;">Carpeta vacía.</div>';
        if(docCount) docCount.innerText = '0';
        return;
    }

    if(docCount) docCount.innerText = documents.length;

    documents.forEach(doc => {
        const docItem = document.createElement('div');
        docItem.className = 'list-item';
        docItem.dataset.path = doc.path;

        // Determinar icono y estilo
        const fileTypeInfo = getFileTypeInfo(doc.extension);
        
        const iconDiv = document.createElement('div');
        iconDiv.className = `item-icon ${fileTypeInfo.className}`;
        iconDiv.innerHTML = `<i class="fas ${fileTypeInfo.icon}"></i>`;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'item-info';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'item-name';
        nameDiv.textContent = doc.name;

        const metaDiv = document.createElement('div');
        metaDiv.className = 'item-meta';
        metaDiv.innerHTML = `<span class="badge-type">${doc.extension.toUpperCase()}</span>`; // Podríamos añadir tamaño si viniera de la API

        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(metaDiv);
        docItem.appendChild(iconDiv);
        docItem.appendChild(infoDiv);

        docItem.addEventListener('click', () => {
            selectDocument(doc);
        });

        // Agregar evento de clic derecho (context menu)
        docItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, doc);
        });

        documentList.appendChild(docItem);
    });
}

// Obtener info de tipo de archivo para estilos
function getFileTypeInfo(extension) {
    const ext = extension.toLowerCase().replace('.', '');
    
    const types = {
        'pdf': { className: 'pdf', icon: 'fa-file-pdf' },
        'xls': { className: 'excel', icon: 'fa-file-excel' },
        'xlsx': { className: 'excel', icon: 'fa-file-excel' },
        'doc': { className: 'word', icon: 'fa-file-word' },
        'docx': { className: 'word', icon: 'fa-file-word' },
        'ppt': { className: 'powerpoint', icon: 'fa-file-powerpoint' },
        'pptx': { className: 'powerpoint', icon: 'fa-file-powerpoint' },
        'txt': { className: 'default', icon: 'fa-file-alt' }
    };

    return types[ext] || { className: 'default', icon: 'fa-file' };
}

// Seleccionar documento
async function selectDocument(doc) {
    try {
        currentDocument = doc;
        document.getElementById('docName').textContent = doc.name;
        
        const extension = doc.extension.toLowerCase().replace('.', '');
        console.log(`[responsable-sg-viewer.js][selectDocument] Documento seleccionado: ${doc.name}, Extensión: ${extension}`);

        // Resaltar en UI
        document.querySelectorAll('.list-item').forEach(i => i.classList.remove('active'));
        const activeItem = document.querySelector(`[data-path="${doc.path}"]`);
        if(activeItem) activeItem.classList.add('active');

        // UI Transition
        showLoading();
        document.getElementById('emptyState').style.display = 'none';
        
        // Habilitar botones de toolbar
        enableDocActions(true);

        if (extension === 'pdf') {
            loadPDF(doc.path);
        } else if (extension === 'xls' || extension === 'xlsx') {
            loadExcel(doc.path);
        } else if (extension === 'doc' || extension === 'docx') {
            loadWord(doc.path);
        } else {
            showUnsupportedMessage(extension);
        }

    } catch (error) {
        showNotification('Error al seleccionar documento: ' + error.message, 'error');
        hideLoading();
    }
}

// Cargar PDF
async function loadPDF(filePath) {
    try {
        const result = await callParentAPI('get-pdf-preview', { filePath: filePath });
        if (result.success) {
            displayPDF(result.data);
        } else {
            showErrorInViewer(`Error al previsualizar PDF: ${result.error}`);
        }
    } catch (error) {
        showErrorInViewer(`Error al cargar PDF: ${error.message}`);
    }
}

// Cargar Excel
async function loadExcel(filePath) {
    try {
        const result = await callParentAPI('get-excel-preview', { filePath: filePath });
        if (result.success) {
            displayPDF(result.data); // Excel se convierte a PDF para visualizar
        } else {
            showErrorInViewer(`Error al previsualizar Excel: ${result.error}`);
        }
    } catch (error) {
        showErrorInViewer(`Error al cargar Excel: ${error.message}`);
    }
}

// Cargar Word
async function loadWord(filePath) {
    try {
        const result = await callParentAPI('get-word-preview', { filePath: filePath });
        if (result.success) {
            displayPDF(result.data); // Word se convierte a PDF para visualizar
        } else {
            showErrorInViewer(`Error al previsualizar Word: ${result.error}`);
        }
    } catch (error) {
        showErrorInViewer(`Error al cargar Word: ${error.message}`);
    }
}

// Mostrar PDF en el visor
function displayPDF(pdfData) {
    hideLoading();

    const viewerContainer = document.getElementById('viewerContainer');
    viewerContainer.style.display = 'flex';
    document.getElementById('toolbar').classList.add('visible');
    
    viewerContainer.innerHTML = `<iframe id="docFrame" class="pdf-viewer" src="data:application/pdf;base64,${pdfData}"></iframe>`;

    currentZoom = 100; // Reset zoom
    updateZoomDisplay();
}

// Mostrar Mensaje de No Soportado
function showUnsupportedMessage(extension) {
    hideLoading();
    const viewerContainer = document.getElementById('viewerContainer');
    viewerContainer.style.display = 'flex';
    document.getElementById('toolbar').classList.remove('visible'); // Ocultar controles de zoom

    viewerContainer.innerHTML = `
        <div class="error-message">
            <h3>Previsualización no disponible</h3>
            <p>La previsualización interna no está disponible para archivos .${extension}.</p>
            <p>Puede usar el botón de descarga en la barra superior para abrirlo externamente.</p>
        </div>
    `;
}

// Mostrar Error en el visor
function showErrorInViewer(message) {
    hideLoading();
    const viewerContainer = document.getElementById('viewerContainer');
    viewerContainer.style.display = 'flex';
    document.getElementById('toolbar').classList.remove('visible');

    viewerContainer.innerHTML = `
        <div class="error-message">
            <h3 style="color:var(--danger)">Error de Carga</h3>
            <p>${message}</p>
        </div>
    `;
}

// Cerrar documento
function closeDocument() {
    currentDocument = null;
    
    // UI Reset
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('viewerContainer').style.display = 'none';
    document.getElementById('toolbar').classList.remove('visible');
    document.getElementById('viewerContainer').innerHTML = '';
    
    // Deshabilitar botones
    enableDocActions(false);
    
    // Quitar selección lista
    document.querySelectorAll('.list-item').forEach(i => i.classList.remove('active'));
}

// Habilitar/Deshabilitar botones de header
function enableDocActions(enable) {
    const btns = ['closeDocBtn', 'downloadBtn', 'printBtn'];
    btns.forEach(id => {
        const btn = document.getElementById(id);
        if(btn) {
            btn.disabled = !enable;
            btn.style.opacity = enable ? '1' : '0.3';
            btn.style.cursor = enable ? 'pointer' : 'not-allowed';
        }
    });
}

// Actualizar estado de navegación (Breadcrumb y botón Atrás)
function updateNavigationState() {
    // Botón Atrás Sidebar
    const backBtn = document.getElementById('goBackBtn');
    if (backBtn) {
        backBtn.disabled = pathHistory.length === 0;
        backBtn.style.opacity = backBtn.disabled ? '0.5' : '1';
        backBtn.style.cursor = backBtn.disabled ? 'not-allowed' : 'pointer';
    }

    // Breadcrumb (Simplificado: Raíz > Carpeta Actual)
    const breadcrumb = document.getElementById('breadcrumb');
    let bcHTML = `<div class="crumb-item" onclick="resetToRoot()"><i class="fas fa-hdd"></i> Raíz</div>`;
    
    // Si la ruta no es la base, mostrar parte final (esto es una simplificación visual)
    if (pathHistory.length > 0) {
        const currentFolderName = currentFolderPath.split('\\').pop().split('/').pop(); // Obtener nombre
        bcHTML += `<div class="crumb-separator"><i class="fas fa-chevron-right"></i></div>`;
        bcHTML += `<div class="crumb-item">${currentFolderName}</div>`;
    }
    
    breadcrumb.innerHTML = bcHTML;
}

// Ir a la raíz (usado por breadcrumb)
async function resetToRoot() {
    if (pathHistory.length > 0) {
        const rootPath = pathHistory[0]; // Asumimos que el primer elemento es base
        // Mejor recargar todo para asegurar estado limpio
        loadFolders(); 
    }
}

// Subir un nivel
async function goUpLevel() {
    if (pathHistory.length > 0) {
        const previousPath = pathHistory.pop();
        await selectFolder(previousPath);
        updateNavigationState();
    }
}

// --- Funciones de utilidad ---

function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if(overlay) overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if(overlay) overlay.classList.remove('active');
}

// Alias para compatibilidad - usa el nuevo sistema toast moderno
function showNotification(message, type = 'success') {
    showToast(message, type);
}

function showNotificationLegacy(message, type = 'success') {
    const notification = document.getElementById('notification');
    const messageDiv = notification.querySelector('.notification-message');
    const icon = notification.querySelector('.notification-icon');

    messageDiv.textContent = message;
    notification.className = `notification ${type}`;

    // Iconos
    let iconClass = 'fa-info-circle';
    if(type === 'success') iconClass = 'fa-check-circle';
    if(type === 'error') iconClass = 'fa-times-circle';
    if(type === 'warning') iconClass = 'fa-exclamation-triangle';

    icon.className = `notification-icon fas ${iconClass}`;

    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Descargar Documento
async function downloadDocument() {
    if (currentDocument) {
        try {
            showNotification('Preparando descarga...', 'info');
            const result = await callParentAPI('download-document', currentDocument.path);

            if (result.success) {
                const binaryData = atob(result.base64Data);
                const bytes = new Uint8Array(binaryData.length);
                for (let i = 0; i < binaryData.length; i++) {
                    bytes[i] = binaryData.charCodeAt(i);
                }

                const blob = new Blob([bytes], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = url;
                link.download = result.fileName;
                document.body.appendChild(link);
                link.click();

                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                showNotification('Descarga completada', 'success');
            } else {
                showNotification(`Error: ${result.error}`, 'error');
            }
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
        }
    }
}

// Imprimir Documento
function printDocument() {
    if (!currentDocument) return;
    
    const iframe = document.getElementById('docFrame');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.print();
    } else {
        // Fallback para impresión convirtiendo de nuevo si no está en iframe visible
        printConvertedDocument(currentDocument.path, currentDocument.extension);
    }
}

async function printConvertedDocument(filePath, extension) {
    try {
        showNotification('Preparando impresión...', 'info');
        let result = await callParentAPI('get-pdf-preview', { filePath: filePath }); // Default try
        
        // Si es excel/word, usar endpoint específico
        const ext = extension.toLowerCase();
        if(ext.includes('xls')) result = await callParentAPI('get-excel-preview', { filePath });
        if(ext.includes('doc')) result = await callParentAPI('get-word-preview', { filePath });

        if (result.success) {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(
                `<html>
                    <body style="margin:0;">
                        <iframe src="data:application/pdf;base64,${result.data}"
                                style="width:100%; height:100vh; border:none;"
                                onload="window.print(); window.onafterprint = function() { window.close(); }">
                        </iframe>
                    </body>
                </html>`
            );
            printWindow.document.close();
        }
    } catch (error) {
        showNotification('Error al imprimir', 'error');
    }
}

// ZOOM & VIEW CONTROLS
function zoomIn() {
    currentZoom += 10;
    applyZoom();
}

function zoomOut() {
    if (currentZoom > 20) {
        currentZoom -= 10;
        applyZoom();
    }
}

function fitWidth() {
    currentZoom = 'width'; // Marcador especial
    applyZoom();
}

function updateZoomDisplay() {
    const display = document.getElementById('zoomLevelDisplay');
    if(display) {
        display.innerText = (currentZoom === 'width') ? 'Ancho' : `${currentZoom}%`;
    }
}

function applyZoom() {
    const iframe = document.getElementById('docFrame');
    if (!iframe) return;

    updateZoomDisplay();

    let src = iframe.src.split('#')[0]; // Base sin hash
    let zoomParam = '';

    if (currentZoom === 'width') {
        zoomParam = '#view=FitH';
    } else {
        zoomParam = `#zoom=${currentZoom}`;
    }
    
    // Reasignar src fuerza al visor PDF (nativo del navegador) a aplicar el zoom
    // Nota: Esto puede causar parpadeo. Si es PDF.js integrado, se usaría su API.
    // Para iframe nativo, reasignar src es la forma estándar.
    iframe.src = src + zoomParam;
}