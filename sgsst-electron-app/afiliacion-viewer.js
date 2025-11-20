// afiliacion-viewer.js

// Variables globales
let currentDocument = null;
let currentViewer = null;
let currentZoom = 'auto';
let currentOrientation = 'vertical';
let totalPages = 0;
let currentPage = 1;
let folderPath = '';

// --- START: Refactored Communication Logic ---

/**
 * Helper function to communicate with the parent window via postMessage.
 * This abstracts the request-response logic for calling Electron APIs from the iframe.
 * @param {string} type - The type of the request (e.g., 'get-documents-in-folder').
 * @param {*} payload - The data to send with the request.
 * @returns {Promise<any>} - A promise that resolves with the payload from the parent's response.
 */
function callParentAPI(type, payload) {
    console.log(`[afiliacion-viewer.js][callParentAPI] Enviando solicitud al padre. Tipo: ${type}, Payload:`, payload);
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
                console.log(`[afiliacion-viewer.js][callParentAPI] Respuesta recibida del padre para requestId ${requestId}. Success: ${response.payload && response.payload.success}`);

                if (response.payload && response.payload.success) {
                    resolve(response.payload);
                } else {
                    const errorMessage = (response.payload && response.payload.error) || 'Unknown error from parent process';
                    console.error(`[afiliacion-viewer.js][callParentAPI] Error recibido para la solicitud '${type}':`, errorMessage);
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
    loadFolders();
});

// Configurar event listeners
function setupEventListeners() {
    document.getElementById('backBtn').addEventListener('click', () => {
        if (window.parent && window.parent.postMessage) {
            // Use a standardized message format for all communications
            window.parent.postMessage({ type: 'back-to-module-request' }, '*');
        }
    });
    document.getElementById('downloadBtn').addEventListener('click', downloadDocument);
    document.getElementById('printBtn').addEventListener('click', printDocument);
    document.getElementById('zoomLevel').addEventListener('change', (e) => {
        currentZoom = e.target.value;
        applyZoom();
    });
    document.getElementById('pageOrientation').addEventListener('change', (e) => {
        currentOrientation = e.target.value;
        applyOrientation();
    });
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
        renderFolders(result.folders);
        renderDocuments(result.files); // <-- AÑADIDO: Renderizar también los archivos en la raíz
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
        folderList.innerHTML = '<p>No se encontraron carpetas.</p>';
        return;
    }

    folders.forEach(folder => {
        const folderItem = document.createElement('div');
        folderItem.className = 'folder-item';
        folderItem.dataset.path = folder.path;

        const icon = document.createElement('i');
        icon.className = 'fas fa-folder';

        const name = document.createElement('div');
        name.textContent = folder.name;

        folderItem.appendChild(icon);
        folderItem.appendChild(name);

        folderItem.addEventListener('click', () => {
            selectFolder(folder.path);
        });

        folderList.appendChild(folderItem);
    });
}

// Seleccionar carpeta
async function selectFolder(path) {
    try {
        folderPath = path;

        document.querySelectorAll('.folder-item').forEach(item => {
            item.classList.remove('active');
        });

        const selectedItem = document.querySelector(`[data-path="${path}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        }

        loadDocuments(path);

    } catch (error) {
        showNotification('Error al seleccionar carpeta', 'error');
    }
}

// Cargar documentos de una carpeta
async function loadDocuments(folderPath) {
    try {
        console.log(`VIEWER: Cargando documentos para la ruta: ${folderPath}`);
        const result = await callParentAPI('get-documents-in-folder', folderPath);
        renderDocuments(result.files); // <-- CORREGIDO: usar result.files
    } catch (error) {
        showNotification(`Error al cargar documentos: ${error.message}`, 'error');
        console.error('VIEWER: Error en loadDocuments:', error);
    }
}

// Renderizar documentos
function renderDocuments(documents) {
    console.log('[DIAGNÓSTICO] renderDocuments: Recibidos para renderizar:', documents);
    const documentList = document.getElementById('documentList');
    documentList.innerHTML = '';

    if (!documents || documents.length === 0) {
        documentList.innerHTML = '<p>No hay documentos en esta carpeta.</p>';
        return;
    }

    documents.forEach(doc => {
        const docItem = document.createElement('div');
        docItem.className = 'document-item';
        docItem.dataset.path = doc.path;

        const icon = document.createElement('i');
        icon.className = getDocumentIcon(doc.extension);

        const name = document.createElement('div');
        name.textContent = doc.name;

        docItem.appendChild(icon);
        docItem.appendChild(name);

        docItem.addEventListener('click', () => {
            selectDocument(doc);
        });

        documentList.appendChild(docItem);
    });
}

// Obtener icono según la extensión
function getDocumentIcon(extension) {
    const iconMap = {
        'pdf': 'fas fa-file-pdf',
        'xls': 'fas fa-file-excel',
        'xlsx': 'fas fa-file-excel',
        'doc': 'fas fa-file-word',
        'docx': 'fas fa-file-word',
        'ppt': 'fas fa-file-powerpoint',
        'pptx': 'fas fa-file-powerpoint',
        'txt': 'fas fa-file-alt',
        'default': 'fas fa-file'
    };

    return iconMap[extension.toLowerCase()] || iconMap.default;
}

// Seleccionar documento
async function selectDocument(doc) {
    try {
        currentDocument = doc;
        document.getElementById('documentTitle').textContent = doc.name;

        const extension = doc.extension.toLowerCase();
        console.log(`[afiliacion-viewer.js][selectDocument] Documento seleccionado: ${doc.name}, Path: ${doc.path}, Extensión: ${extension}`);

        showLoading();

        if (extension === 'pdf') {
            loadPDF(doc.path);
        } else if (extension === 'xls' || extension === 'xlsx') {
            loadExcel(doc.path);
        } else if (extension === 'doc' || extension === 'docx') {
            loadWord(doc.path);
        } else {
            showNotification('Tipo de archivo no soportado para previsualización.', 'warning');
            hideLoading();
            const viewerContainer = document.getElementById('viewerContainer');
            viewerContainer.innerHTML = `
                <div class="error-message">
                    <h3>Previsualización no disponible</h3>
                    <p>La previsualización interna no está disponible para archivos .${extension}.</p>
                    <p>Puede usar el botón de descarga para abrirlo con la aplicación predeterminada.</p>
                </div>
            `;
        }

    } catch (error) {
        showNotification('Error al seleccionar documento: ' + error.message, 'error');
        hideLoading();
    }
}

// Cargar PDF
async function loadPDF(filePath) {
    console.log(`[afiliacion-viewer.js][loadPDF] Solicitando previsualización de PDF para: ${filePath}`);
    try {
        const result = await callParentAPI('get-pdf-preview', { filePath: filePath }); // Pass filePath in an object
        if (result.success) {
            displayPDF(result.data); // result.data now contains the base64 string
        } else {
            showNotification(`Error al previsualizar PDF: ${result.error}`, 'error');
            hideLoading();
        }
    } catch (error) {
        showNotification(`Error al cargar PDF: ${error.message}`, 'error');
        hideLoading();
    }
}

// Cargar Excel
async function loadExcel(filePath) {
    console.log(`[afiliacion-viewer.js][loadExcel] Solicitando previsualización de Excel para: ${filePath}`);
    try {
        const result = await callParentAPI('get-excel-preview', { filePath: filePath }); // Pass filePath in an object
        if (result.success) {
            displayPDF(result.data); // get-excel-preview should return base64 PDF data
        } else {
            showNotification(`Error al previsualizar Excel: ${result.error}`, 'error');
            hideLoading();
            const viewerContainer = document.getElementById('viewerContainer');
            viewerContainer.innerHTML = `
                <div class="error-message">
                    <h3>Previsualización de Excel no disponible</h3>
                    <p>No se pudo convertir el archivo Excel a PDF para previsualizarlo.</p>
                    <p>Detalle: ${result.error}</p>
                </div>
            `;
        }
    } catch (error) {
        showNotification(`Error al cargar Excel: ${error.message}`, 'error');
        hideLoading();
    }
}

// Cargar Word
async function loadWord(filePath) {
    console.log(`[afiliacion-viewer.js][loadWord] Solicitando previsualización de Word para: ${filePath}`);
    try {
        const result = await callParentAPI('get-word-preview', { filePath: filePath }); // Pass filePath in an object
        if (result.success) {
            displayPDF(result.data); // get-word-preview should return base64 PDF data
        } else {
            showNotification(`Error al previsualizar Word: ${result.error}`, 'error');
            hideLoading();
            const viewerContainer = document.getElementById('viewerContainer');
            viewerContainer.innerHTML = `
                <div class="error-message">
                    <h3>Previsualización de Word no disponible</h3>
                    <p>No se pudo convertir el archivo Word a PDF para previsualizarlo.</p>
                    <p>Detalle: ${result.error}</p>
                </div>
            `;
        }
    } catch (error) {
        showNotification(`Error al cargar Word: ${error.message}`, 'error');
        hideLoading();
    }
}

// Mostrar PDF
function displayPDF(pdfData) {
    hideLoading();

    const viewerContainer = document.getElementById('viewerContainer');
    viewerContainer.style.display = 'block';
    // Set initial src without hash, applyZoom will add it
    viewerContainer.innerHTML = `<iframe class="pdf-viewer" src="data:application/pdf;base64,${pdfData}"></iframe>`;

    currentViewer = 'pdf';
    totalPages = 1;
    currentPage = 1;

    updatePageInfo();

    // Apply initial settings
    // Use a small timeout to ensure the iframe is in the DOM before we manipulate its src
    setTimeout(() => {
        applyOrientation(); // This will also call applyZoom
    }, 100);
}

// Mostrar Excel
function displayExcel(excelData) { // excelData is expected to be base64 PDF data
    hideLoading();

    const viewerContainer = document.getElementById('viewerContainer');
    viewerContainer.style.display = 'block';
    viewerContainer.innerHTML = `<iframe class="excel-viewer" src="data:application/pdf;base64,${excelData}"></iframe>`;

    currentViewer = 'excel';
    totalPages = 1;
    currentPage = 1;

    updatePageInfo();
}

// Mostrar Word (This function is not called directly anymore but kept for reference)
function displayWord(wordData) {
    hideLoading();
    // ... (implementation remains the same)
}

// Actualizar información de página
function updatePageInfo() {
    const pageInfo = document.querySelector('.page-info');
    if (pageInfo) {
        pageInfo.innerHTML = `
            <div class="page-controls">
                <button class="page-btn" onclick="previousPage()" ${currentPage === 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i>
                </button>
                <div class="page-info">
                    <span class="page-info">Página ${currentPage} de ${totalPages}</span>
                </div>
                <button class="page-btn" onclick="nextPage()" ${currentPage === totalPages ? 'disabled' : ''}>
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
    }
}

// --- Funciones de utilidad ---

function showLoading() {
    document.getElementById('loadingDiv').style.display = 'flex';
    document.getElementById('viewerContainer').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loadingDiv').style.display = 'none';
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const messageDiv = notification.querySelector('.notification-message');
    const icon = notification.querySelector('.notification-icon');

    messageDiv.textContent = message;
    notification.className = `notification ${type}`;
    icon.className = `notification-icon fas ${getNotificationIcon(type)}`;

    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-times-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

async function downloadDocument() {
    if (currentDocument) {
        try {
            showNotification('Preparando descarga...');
            const result = await callParentAPI('download-document', currentDocument.path);

            if (result.success) {
                // Crear un blob a partir de los datos base64
                const binaryData = atob(result.base64Data);
                const bytes = new Uint8Array(binaryData.length);
                for (let i = 0; i < binaryData.length; i++) {
                    bytes[i] = binaryData.charCodeAt(i);
                }

                const blob = new Blob([bytes], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);

                // Crear un enlace de descarga
                const link = document.createElement('a');
                link.href = url;
                link.download = result.fileName;
                document.body.appendChild(link);
                link.click();

                // Limpiar
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                showNotification('Documento descargado exitosamente.', 'success');
            } else {
                showNotification(`Error en la descarga: ${result.error}`, 'error');
            }
        } catch (error) {
            showNotification(`Error en la descarga: ${error.message}`, 'error');
        }
    } else {
        showNotification('No hay documento seleccionado', 'warning');
    }
}

function applyZoom() {
    const iframe = document.querySelector('.pdf-viewer');
    if (!iframe) return;

    let src = iframe.src.split('#')[0]; // Get base src without any hash
    let zoomParam = '';

    switch (currentZoom) {
        case 'page-width':
            zoomParam = '#view=FitH'; // Fit horizontally
            break;
        case 'page-height':
            zoomParam = '#view=FitV'; // Fit vertically
            break;
        case 'auto':
            zoomParam = '#view=Fit'; // Fit whole page
            break;
        default: // For percentage values like "50%", "100%"
            const percent = parseInt(currentZoom, 10);
            if (!isNaN(percent)) {
                zoomParam = `#zoom=${percent}`;
            } else {
                zoomParam = '#view=Fit';
            }
            break;
    }

    console.log(`Applying zoom: ${zoomParam}`);
    iframe.src = src + zoomParam;
}

function applyOrientation() {
    // Link orientation to a zoom level for simplicity
    if (currentOrientation === 'horizontal') {
        document.getElementById('zoomLevel').value = 'page-width';
        currentZoom = 'page-width';
    } else {
        document.getElementById('zoomLevel').value = 'auto';
        currentZoom = 'auto';
    }
    applyZoom();
}

function previousPage() { /* Lógica para cambiar de página */ }
function nextPage() { /* Lógica para cambiar de página */ }

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Función para imprimir el documento
function printDocument() {
    if (currentDocument) {
        const extension = currentDocument.extension.toLowerCase();

        if (extension === 'pdf') {
            // Para PDFs, intentamos imprimir directamente el iframe
            const iframe = document.querySelector('.pdf-viewer');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.print();
            } else {
                showNotification('No se puede imprimir el PDF en este momento', 'warning');
            }
        } else if (extension === 'doc' || extension === 'docx' || extension === 'xls' || extension === 'xlsx') {
            // Para Word y Excel, primero convertimos a PDF y luego imprimimos
            printConvertedDocument(currentDocument.path, extension);
        } else {
            // Para otros tipos de archivos, abrir con la aplicación predeterminada y dejar que el usuario imprima desde allí
            callParentAPI('open-path', currentDocument.path)
                .then(() => showNotification('Documento abierto en aplicación predeterminada', 'info'))
                .catch(err => showNotification(`Error al abrir documento: ${err.message}`, 'error'));
        }
    } else {
        showNotification('No hay documento seleccionado', 'warning');
    }
}

// Función para imprimir documentos que necesitan conversión
async function printConvertedDocument(filePath, extension) {
    try {
        showNotification('Preparando impresión...');

        let result;
        if (extension === 'doc' || extension === 'docx') {
            result = await callParentAPI('get-word-preview', { filePath: filePath });
        } else if (extension === 'xls' || extension === 'xlsx') {
            result = await callParentAPI('get-excel-preview', { filePath: filePath });
        }

        if (result.success) {
            // Crear un iframe temporal con el PDF base64 para imprimirlo
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Imprimir Documento</title>
                    </head>
                    <body style="margin: 0; padding: 0;">
                        <iframe src="data:application/pdf;base64,${result.data}"
                                style="width: 100%; height: 100vh; border: none;"
                                onload="window.print(); window.onafterprint = function() { window.close(); }">
                        </iframe>
                    </body>
                </html>
            `);
            printWindow.document.close();
        } else {
            showNotification(`Error al preparar documento para impresión: ${result.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Error al imprimir documento: ${error.message}`, 'error');
    }
}
