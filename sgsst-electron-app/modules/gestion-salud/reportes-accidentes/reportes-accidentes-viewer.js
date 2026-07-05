// reportes-accidentes-viewer.js
// FURAT - Gestión de Reportes de Accidentes de Trabajo
// Submódulo 3.2.1 · K+AIR

// ═══════════════════════════════════════════════════════
// VARIABLES DE ESTADO
// ═══════════════════════════════════════════════════════
let currentDocument = null;
let currentZoom = 'auto';
let currentOrientation = 'vertical';
let currentFolderPath = '';
let pathHistory = [];
let allFolders = [];
let allFiles = [];
let filteredFiles = [];
let currentView = 'dashboard';
let activeFolder = null;
let searchQuery = '';
let filterYear = '';
let filterMonth = '';

// ═══════════════════════════════════════════════════════
// COMUNICACIÓN CON PADRE (postMessage bridge)
// ═══════════════════════════════════════════════════════

function callParentAPI(type, payload) {
    console.log(`[FURAT][callParentAPI] Enviando: ${type}`, payload);
    return new Promise((resolve, reject) => {
        const requestId = `furat-req-${Date.now()}-${Math.random()}`;

        const handleResponse = (event) => {
            if (event.source !== window.parent) return;
            const response = event.data;
            if (response.requestId === requestId) {
                window.removeEventListener('message', handleResponse);
                console.log(`[FURAT][callParentAPI] Respuesta: ${type}`, response);
                if (response.payload && response.payload.success) {
                    resolve(response.payload);
                } else {
                    const errorMsg = (response.payload && response.payload.error) || 'Error desconocido';
                    reject(new Error(errorMsg));
                }
            }
        };

        window.addEventListener('message', handleResponse);
        window.parent.postMessage({ type: `${type}-request`, payload, requestId }, '*');
    });
}

// ═══════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
    console.log('[FURAT] DOMContentLoaded - Inicializando viewer');
    setupEventListeners();
    loadDashboard();
});

function setupEventListeners() {
    // Header
    document.getElementById('backBtn').addEventListener('click', () => {
        window.parent.postMessage({ type: 'back-to-module-request' }, '*');
    });

    // Tabs
    document.querySelectorAll('.furat-tab').forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    // Dashboard
    // (los handlers de year bars y recent reports se configuran al renderizar)

    // Library - Search
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        searchClear.style.display = searchQuery ? 'block' : 'none';
        applyFiltersAndRender();
    });
    searchClear.addEventListener('click', () => {
        searchQuery = '';
        searchInput.value = '';
        searchClear.style.display = 'none';
        applyFiltersAndRender();
    });

    // Library - Filters
    document.getElementById('filterYear').addEventListener('change', (e) => {
        filterYear = e.target.value;
        applyFiltersAndRender();
    });
    document.getElementById('filterMonth').addEventListener('change', (e) => {
        filterMonth = e.target.value;
        applyFiltersAndRender();
    });

    // Library - Breadcrumb
    document.getElementById('breadcrumb').addEventListener('click', (e) => {
        const btn = e.target.closest('.furat-breadcrumb__root');
        if (btn) navigateToPath(btn.dataset.path);
    });

    // Library - Folder clicks
    document.getElementById('folderList').addEventListener('click', (e) => {
        const folderCard = e.target.closest('.furat-folder-card');
        if (folderCard) selectFolder(folderCard.dataset.path);
    });

    // Library - Document clicks
    document.getElementById('documentList').addEventListener('click', (e) => {
        const docCard = e.target.closest('.furat-doc-card');
        if (docCard) selectDocument(docCard.dataset.path);
        const downloadBtn = e.target.closest('.furat-doc-card__action[data-action="download"]');
        if (downloadBtn) {
            e.stopPropagation();
            downloadDocumentFromCard(downloadBtn.closest('.furat-doc-card').dataset.path);
        }
    });

    // Library - View toggle
    document.getElementById('viewGridBtn').addEventListener('click', () => {
        document.getElementById('documentList').classList.remove('furat-docs-grid--list');
        document.getElementById('viewGridBtn').classList.add('active');
        document.getElementById('viewListBtn').classList.remove('active');
    });
    document.getElementById('viewListBtn').addEventListener('click', () => {
        document.getElementById('documentList').classList.add('furat-docs-grid--list');
        document.getElementById('viewListBtn').classList.add('active');
        document.getElementById('viewGridBtn').classList.remove('active');
    });

    // Viewer tab (retained for direct navigation)
    document.getElementById('viewerBackBtn').addEventListener('click', () => switchView('library'));
    document.getElementById('goToLibraryBtn').addEventListener('click', () => switchView('library'));
    document.getElementById('downloadBtn').addEventListener('click', downloadCurrentDocument);
    document.getElementById('printBtn').addEventListener('click', printCurrentDocument);
    document.getElementById('zoomLevel').addEventListener('change', (e) => {
        currentZoom = e.target.value;
        applyViewerZoom();
    });
    document.getElementById('pageOrientation').addEventListener('change', (e) => {
        currentOrientation = e.target.value;
        applyViewerOrientation();
    });

    // Preview modal
    document.getElementById('closePreviewBtn').addEventListener('click', closePreviewModal);
    document.getElementById('previewOverlay').addEventListener('click', closePreviewModal);
    document.getElementById('previewDownloadBtn').addEventListener('click', () => {
        if (currentDocument) downloadDocumentByPath(currentDocument.path);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePreviewModal();
    });
}

// ═══════════════════════════════════════════════════════
// NAVEGACIÓN DE VISTAS
// ═══════════════════════════════════════════════════════

function switchView(viewName) {
    console.log(`[FURAT] Switching view to: ${viewName}`);
    currentView = viewName;

    // Update tabs
    document.querySelectorAll('.furat-tab').forEach(tab => {
        tab.classList.toggle('furat-tab--active', tab.dataset.view === viewName);
    });
    document.getElementById('tabViewer').style.display = viewName === 'viewer' ? 'flex' : 'none';

    // Update views
    document.querySelectorAll('.furat-view').forEach(view => {
        view.classList.remove('furat-view--active');
    });
    const targetView = document.getElementById(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
    if (targetView) targetView.classList.add('furat-view--active');

    // Load data for the view
    if (viewName === 'dashboard') loadDashboard();
    else if (viewName === 'library') loadLibrary();
}

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════

async function loadDashboard() {
    console.log('[FURAT] Loading dashboard');
    showDashboardLoading();

    try {
        const result = await callParentAPI('furat-get-dashboard-data', getModuleParams());
        console.log('[FURAT] Dashboard data loaded:', result);

        renderDashboardStats(result.stats);
        renderYearBars(result.yearDistribution);
        renderRecentReports(result.recentReports);
    } catch (error) {
        console.error('[FURAT] Error loading dashboard:', error);
        showDashboardError(error.message);
    }
}

function getModuleParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        companyName: urlParams.get('company') || '',
        moduleName: urlParams.get('module') || '',
        submoduleName: urlParams.get('submodule') || ''
    };
}

function showDashboardLoading() {
    document.getElementById('statTotal').textContent = '—';
    document.getElementById('statCurrentYear').textContent = '—';
    document.getElementById('statCurrentMonth').textContent = '—';
    document.getElementById('statFolders').textContent = '—';
    document.getElementById('yearBars').innerHTML = `
        <div class="furat-empty-state">
            <i class="fas fa-chart-bar"></i>
            <p>Cargando distribución por año...</p>
        </div>`;
    document.getElementById('recentReports').innerHTML = `
        <div class="furat-empty-state">
            <i class="fas fa-inbox"></i>
            <p>Cargando reportes recientes...</p>
        </div>`;
}

function renderDashboardStats(stats) {
    document.getElementById('statTotal').textContent = stats.total || '0';
    document.getElementById('statCurrentYear').textContent = stats.currentYear || '0';
    document.getElementById('statYearLabel').textContent = stats.currentYearLabel || 'Este Año';
    document.getElementById('statCurrentMonth').textContent = stats.currentMonth || '0';
    document.getElementById('statMonthLabel').textContent = stats.currentMonthLabel || 'Este Mes';
    document.getElementById('statFolders').textContent = stats.folders || '0';
}

function renderYearBars(yearDistribution) {
    const container = document.getElementById('yearBars');
    if (!yearDistribution || yearDistribution.length === 0) {
        container.innerHTML = `
            <div class="furat-empty-state">
                <i class="fas fa-chart-bar"></i>
                <p>No hay datos de distribución por año</p>
            </div>`;
        return;
    }

    const maxCount = Math.max(...yearDistribution.map(y => y.count));

    container.innerHTML = yearDistribution.map(year => {
        const percent = maxCount > 0 ? (year.count / maxCount) * 100 : 0;
        return `
            <div class="furat-year-bar" data-year="${year.year}">
                <span class="furat-year-bar__label">${year.year}</span>
                <div class="furat-year-bar__track">
                    <div class="furat-year-bar__fill" style="width: ${percent}%">
                        <span class="furat-year-bar__count">${year.count}</span>
                    </div>
                </div>
            </div>`;
    }).join('');

    // Click en año para filtrar en biblioteca
    container.querySelectorAll('.furat-year-bar__track').forEach(track => {
        track.addEventListener('click', () => {
            const year = track.closest('.furat-year-bar').dataset.year;
            filterYear = year;
            document.getElementById('filterYear').value = year;
            switchView('library');
        });
    });
}

function renderRecentReports(reports) {
    const container = document.getElementById('recentReports');
    if (!reports || reports.length === 0) {
        container.innerHTML = `
            <div class="furat-empty-state">
                <i class="fas fa-inbox"></i>
                <p>No hay reportes recientes</p>
            </div>`;
        return;
    }

    container.innerHTML = reports.map(report => `
        <div class="furat-recent-item" data-path="${report.path}">
            <div class="furat-recent-item__icon"><i class="fas fa-file-pdf"></i></div>
            <div class="furat-recent-item__info">
                <div class="furat-recent-item__name">${report.name}</div>
                <div class="furat-recent-item__meta">${report.date || ''}</div>
            </div>
        </div>`).join('');

    container.querySelectorAll('.furat-recent-item').forEach(item => {
        item.addEventListener('click', () => {
            selectDocument(item.dataset.path);
        });
    });
}

function showDashboardError(message) {
    document.getElementById('yearBars').innerHTML = `
        <div class="furat-error-panel">
            <h3><i class="fas fa-exclamation-triangle"></i> Error al cargar datos</h3>
            <p>${message}</p>
            <p>Verifica que existan archivos FURAT en el módulo de Reportes.</p>
        </div>`;
}

// ═══════════════════════════════════════════════════════
// LIBRARY
// ═══════════════════════════════════════════════════════

async function loadLibrary() {
    console.log('[FURAT] Loading library');
    showLibraryLoading();

    try {
        const result = await callParentAPI('furat-get-library-data', getModuleParams());
        console.log('[FURAT] Library data loaded:', result);

        allFolders = result.folders || [];
        allFiles = result.files || [];
        filteredFiles = [...allFiles];

        // Populate filter year dropdown
        populateYearFilter(result.availableYears || []);

        // Render root level
        activeFolder = null;
        pathHistory = [];
        renderLibraryBreadcrumb();
        renderLibraryFolders();
        renderLibraryDocuments();
    } catch (error) {
        console.error('[FURAT] Error loading library:', error);
        showLibraryError(error.message);
    }
}

function showLibraryLoading() {
    document.getElementById('folderList').innerHTML = KairSkeleton.list(5);
    document.getElementById('documentList').innerHTML = KairSkeleton.list(6);
}

function populateYearFilter(years) {
    const select = document.getElementById('filterYear');
    const currentValue = select.value;
    select.innerHTML = '<option value="">Todos</option>' +
        years.map(y => `<option value="${y}">${y}</option>`).join('');
    select.value = currentValue;
}

function applyFiltersAndRender() {
    filteredFiles = allFiles.filter(file => {
        const matchesSearch = !searchQuery || file.name.toLowerCase().includes(searchQuery);
        const matchesYear = !filterYear || (file.year && file.year.toString() === filterYear);
        const matchesMonth = !filterMonth || (file.month && file.month.toString() === filterMonth);
        return matchesSearch && matchesYear && matchesMonth;
    });
    renderLibraryDocuments();
}

function renderLibraryBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!activeFolder) {
        breadcrumb.innerHTML = `
            <button class="furat-breadcrumb__root active" data-path="">
                <i class="fas fa-home"></i>
                <span>Todos los Reportes</span>
            </button>`;
    } else {
        const parts = activeFolder.split('/').filter(Boolean);
        let html = `<button class="furat-breadcrumb__root" data-path="">
                <i class="fas fa-home"></i>
            </button>
            <span class="furat-breadcrumb__sep">›</span>`;
        let pathSoFar = '';
        parts.forEach((part, idx) => {
            pathSoFar += '/' + part;
            const isLast = idx === parts.length - 1;
            html += isLast
                ? `<span class="furat-breadcrumb__current">${part}</span>`
                : `<button class="furat-breadcrumb__root" data-path="${pathSoFar}">${part}</button>
                   <span class="furat-breadcrumb__sep">›</span>`;
        });
        breadcrumb.innerHTML = html;
    }
}

function renderLibraryFolders() {
    const container = document.getElementById('foldersSection');
    const list = document.getElementById('folderList');

    const subfolders = activeFolder
        ? allFolders.filter(f => f.parentPath === activeFolder)
        : allFolders.filter(f => !f.parentPath || f.parentPath === '');

    if (subfolders.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    list.innerHTML = subfolders.map(folder => `
        <div class="furat-folder-card ${activeFolder === folder.path ? 'active' : ''}" data-path="${folder.path}">
            <div class="furat-folder-card__icon"><i class="fas fa-folder"></i></div>
            <div class="furat-folder-card__name">${folder.name}</div>
            <div class="furat-folder-card__count">${folder.count || 0} reportes</div>
        </div>`).join('');
}

function renderLibraryDocuments() {
    const container = document.getElementById('documentList');
    const badge = document.getElementById('docsCount');
    const title = document.getElementById('docsSectionTitle');

    // Normalizar rutas para comparación
    const normalizePath = (p) => p ? p.replace(/\\/g, '/').toLowerCase() : null;
    const activeFolderNormalized = normalizePath(activeFolder);

    const filesToShow = activeFolder
        ? filteredFiles.filter(f => normalizePath(f.folderPath) === activeFolderNormalized)
        : filteredFiles;

    badge.textContent = filesToShow.length;
    badge.style.display = filesToShow.length > 0 ? 'inline-flex' : 'none';

    if (filesToShow.length === 0) {
        container.innerHTML = `
            <div class="furat-empty-state furat-empty-state--large">
                <i class="fas fa-file-alt"></i>
                <h3>No se encontraron reportes</h3>
                <p>Intenta cambiar los filtros o seleccionar otra carpeta</p>
            </div>`;
        return;
    }

    container.innerHTML = filesToShow.map(file => `
        <div class="furat-doc-card" data-path="${file.path}">
            <div class="furat-doc-card__icon furat-doc-card__icon--${file.icon || 'pdf'}">
                <i class="fas fa-file-${file.icon === 'excel' ? 'excel' : file.icon === 'word' ? 'word' : 'pdf'}"></i>
            </div>
            <div class="furat-doc-card__info">
                <div class="furat-doc-card__name">${file.name}</div>
                <div class="furat-doc-card__meta">${file.size || ''} · ${file.date || ''}</div>
            </div>
            <div class="furat-doc-card__actions">
                <button class="furat-doc-card__action" data-action="download" title="Descargar">
                    <i class="fas fa-download"></i>
                </button>
            </div>
        </div>`).join('');
}

async function selectFolder(path) {
    console.log(`[FURAT] Selecting folder: ${path}`);
    // Asegurarnos de estar en la vista de biblioteca
    if (currentView !== 'library') {
        switchView('library');
    }
    activeFolder = path;
    renderLibraryBreadcrumb();
    renderLibraryFolders();
    renderLibraryDocuments();
}

async function navigateToPath(path) {
    console.log(`[FURAT] Navigating to path: ${path}`);
    activeFolder = path || null;
    renderLibraryBreadcrumb();
    renderLibraryFolders();
    renderLibraryDocuments();
}

// ═══════════════════════════════════════════════════════
// DOCUMENT VIEWER
// ═══════════════════════════════════════════════════════

async function selectDocument(filePath) {
    console.log(`[FURAT] Selecting document: ${filePath}`);
    currentDocument = { path: filePath };
    await openPreviewModal(filePath);
}

async function openPreviewModal(filePath) {
    const modal   = document.getElementById('previewModal');
    const body    = document.getElementById('previewBody');
    const titleEl = document.getElementById('previewTitle');
    const iconEl  = document.getElementById('previewTitleIcon');

    const fileName  = filePath.replace(/\\/g, '/').split('/').pop();
    const extension = fileName.split('.').pop().toLowerCase();

    titleEl.textContent = fileName;
    iconEl.className = extension === 'pdf' ? 'fas fa-file-pdf'
                     : ['xls','xlsx'].includes(extension) ? 'fas fa-file-excel'
                     : ['doc','docx'].includes(extension) ? 'fas fa-file-word'
                     : 'fas fa-file';

    modal.classList.remove('hidden');
    body.innerHTML = KairSkeleton.detail(6);

    try {
        let result;
        if (extension === 'pdf') {
            result = await callParentAPI('get-pdf-preview', { filePath });
        } else if (['xls', 'xlsx'].includes(extension)) {
            result = await callParentAPI('get-excel-preview', { filePath });
        } else if (['doc', 'docx'].includes(extension)) {
            result = await callParentAPI('get-word-preview', { filePath });
        } else {
            throw new Error(`Tipo de archivo .${extension} no soportado para previsualización`);
        }

        if (result.success && result.data) {
            body.innerHTML = '';
            const iframe = document.createElement('iframe');

            // Convertir base64 a Blob URL para evitar bloqueo del visor PDF por sandbox
            const binary = atob(result.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);

            iframe.src = blobUrl;
            iframe.style.cssText = 'width:100%;height:100%;border:none;';
            // Sin sandbox: permite que el visor PDF nativo del navegador funcione
            body.appendChild(iframe);

            // Limpiar blob URL al cerrar el modal
            const cleanup = () => { URL.revokeObjectURL(blobUrl); };
            document.getElementById('previewOverlay')?.addEventListener('click', cleanup, { once: true });
            document.getElementById('closePreviewBtn')?.addEventListener('click', cleanup, { once: true });
        } else {
            throw new Error(result.error || 'Error al cargar el documento');
        }
    } catch (error) {
        console.error('[FURAT] Error loading document:', error);
        showModalError(body, error.message, filePath);
    }
}

function showModalError(body, message, filePath) {
    const isPywin32    = /pywin32|win32com|pip install/i.test(message);
    const isUnsupported = /no soportado/i.test(message);

    let iconHtml = '<i class="fas fa-exclamation-triangle" style="color:var(--furat-danger,#dc3545);"></i>';
    let title    = 'Error al cargar el documento';
    let detail   = `<p>${message}</p>`;
    let extraBtn = '';

    if (isPywin32) {
        iconHtml = '<i class="fas fa-tools" style="color:var(--furat-warning,#ffc107);"></i>';
        title = 'Previsualización no disponible';
        detail = `
            <p>La conversión de archivos <strong>.doc/.docx</strong> requiere
            la librería <strong>pywin32</strong> de Python.</p>
            <code class="furat-preview-modal__error-cmd">pip install pywin32</code>
            <p style="font-size:.8rem;color:var(--furat-text-muted);">
                Ejecuta ese comando en la terminal con Python 3.13 y reinicia la aplicación.
            </p>`;
        extraBtn = `<button class="furat-btn furat-btn--sm furat-btn--primary" id="modalOpenExtBtn" style="margin-top:10px;">
                        <i class="fas fa-external-link-alt"></i> Abrir con aplicación externa
                    </button>`;
    } else if (isUnsupported) {
        iconHtml = '<i class="fas fa-file" style="color:var(--furat-text-muted);"></i>';
        title = 'Formato no soportado';
        detail = '<p>Este tipo de archivo no puede previsualizarse. Puedes abrirlo con una aplicación externa.</p>';
        extraBtn = `<button class="furat-btn furat-btn--sm furat-btn--ghost" id="modalOpenExtBtn" style="margin-top:10px;">
                        <i class="fas fa-external-link-alt"></i> Abrir externamente
                    </button>`;
    }

    body.innerHTML = `
        <div class="furat-preview-modal__error">
            <div class="furat-preview-modal__error-icon">${iconHtml}</div>
            <h3>${title}</h3>
            ${detail}
            ${extraBtn}
        </div>`;

    if (extraBtn && filePath) {
        document.getElementById('modalOpenExtBtn').addEventListener('click', async () => {
            try {
                await callParentAPI('open-path', filePath);
                showNotification('Abriendo archivo con aplicación externa...', 'success');
            } catch (e) {
                showNotification('No se pudo abrir el archivo externamente', 'error');
            }
        });
    }
}

function closePreviewModal() {
    document.getElementById('previewModal').classList.add('hidden');
    document.getElementById('previewBody').innerHTML = '';
}

function displayDocument(data, extension) {
    document.getElementById('loadingDiv').style.display = 'none';
    document.getElementById('viewerEmpty').style.display = 'none';
    document.getElementById('viewerContainer').style.display = 'flex';

    const mimeType = extension === 'pdf' ? 'application/pdf' : 'application/pdf'; // Excel/Word also converted to PDF
    document.getElementById('viewerContainer').innerHTML = `
        <iframe src="data:${mimeType};base64,${data}"
                style="width: 100%; height: 100%; border: none;"
                sandbox="allow-scripts allow-same-origin">
        </iframe>`;

    applyViewerZoom();
}

function applyViewerZoom() {
    const iframe = document.querySelector('#viewerContainer iframe');
    if (!iframe) return;

    let src = iframe.src.split('#')[0];
    let zoomParam = '';

    switch (currentZoom) {
        case 'page-width': zoomParam = '#view=FitH'; break;
        case 'page-height': zoomParam = '#view=FitV'; break;
        case 'auto': zoomParam = '#view=Fit'; break;
        default:
            const percent = parseInt(currentZoom, 10);
            if (!isNaN(percent)) zoomParam = `#zoom=${percent}`;
            else zoomParam = '#view=Fit';
    }

    iframe.src = src + zoomParam;
}

function applyViewerOrientation() {
    if (currentOrientation === 'horizontal') {
        document.getElementById('zoomLevel').value = 'page-width';
        currentZoom = 'page-width';
    } else {
        document.getElementById('zoomLevel').value = 'auto';
        currentZoom = 'auto';
    }
    applyViewerZoom();
}

function showViewerError(message) {
    document.getElementById('loadingDiv').style.display = 'none';
    document.getElementById('viewerContainer').style.display = 'none';
    document.getElementById('viewerEmpty').style.display = 'flex';
    document.getElementById('viewerEmpty').innerHTML = `
        <div class="furat-viewer__empty-icon" style="background-color: var(--furat-danger-light); color: var(--furat-danger);">
            <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3>Error al cargar el documento</h3>
        <p>${message}</p>
        <button class="furat-btn furat-btn--primary" id="goToLibraryBtn">
            <i class="fas fa-folder-open"></i>
            Ir a Biblioteca
        </button>`;
    document.getElementById('goToLibraryBtn').addEventListener('click', () => switchView('library'));
}

async function downloadCurrentDocument() {
    if (!currentDocument) {
        showNotification('No hay documento seleccionado', 'warning');
        return;
    }
    await downloadDocumentByPath(currentDocument.path);
}

async function downloadDocumentByPath(filePath) {
    try {
        showNotification('Preparando descarga...');
        const result = await callParentAPI('download-document', filePath);

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
            link.download = result.fileName || filePath.split('/').pop();
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showNotification('Documento descargado exitosamente.', 'success');
        } else {
            showNotification(`Error en la descarga: ${result.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Error en la descarga: ${error.message}`, 'error');
    }
}

async function downloadDocumentFromCard(filePath) {
    await downloadDocumentByPath(filePath);
}

async function printCurrentDocument() {
    if (!currentDocument) {
        showNotification('No hay documento seleccionado', 'warning');
        return;
    }

    const iframe = document.querySelector('#viewerContainer iframe');
    if (iframe && iframe.contentWindow) {
        try {
            iframe.contentWindow.print();
        } catch (e) {
            showNotification('No se puede imprimir directamente. Use la descarga e imprima desde el archivo.', 'warning');
        }
    }
}

// ═══════════════════════════════════════════════════════
// NOTIFICACIONES
// ═══════════════════════════════════════════════════════

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const icon = notification.querySelector('.furat-notification__icon');
    const messageDiv = notification.querySelector('.furat-notification__message');

    messageDiv.textContent = message;
    notification.className = `furat-notification ${type}`;
    icon.className = `furat-notification__icon fas ${getNotificationIcon(type)}`;

    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-times-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

// ═══════════════════════════════════════════════════════
// HELPERS DE CARGA
// ═══════════════════════════════════════════════════════

function showDashboardLoading() { /* already defined above */ }
function showLibraryLoading() { /* already defined above */ }
function showLibraryError(message) {
    document.getElementById('documentList').innerHTML = `
        <div class="furat-error-panel">
            <h3>Error al cargar la biblioteca</h3>
            <p>${message}</p>
        </div>`;
}
