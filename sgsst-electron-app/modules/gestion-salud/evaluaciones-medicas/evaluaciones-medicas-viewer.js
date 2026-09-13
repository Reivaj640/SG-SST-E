// evaluaciones-medicas-viewer.js
// EMO - Evaluaciones Médicas Ocupacionales
// Submódulo 3.1.4 · K+AIR

// ═══════════════════════════════════════════════════════
// VARIABLES DE ESTADO
// ═══════════════════════════════════════════════════════

// === SHIM: KairSkeleton desde ventana padre si no esta definido localmente ===
// Los iframes no heredan los globales del padre automaticamente; este puente
// evita el error "KairSkeleton is not defined" en vistas cargadas dentro de iframes.
if (typeof window.KairSkeleton === 'undefined' && typeof parent !== 'undefined' && parent !== window && parent.window && parent.window.KairSkeleton) {
  window.KairSkeleton = parent.window.KairSkeleton;
}

let currentDocument = null;
let currentZoom = 'auto';
let currentOrientation = 'vertical';
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
    console.log(`[EMO][callParentAPI] Enviando: ${type}`, payload);
    return new Promise((resolve, reject) => {
        const requestId = `emo-req-${Date.now()}-${Math.random()}`;

        const handleResponse = (event) => {
            if (event.source !== window.parent) return;
            const response = event.data;
            if (response.requestId === requestId) {
                window.removeEventListener('message', handleResponse);
                console.log(`[EMO][callParentAPI] Respuesta: ${type}`, response);
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
    console.log('[EMO] DOMContentLoaded - Inicializando viewer');
    setupEventListeners();
    loadDashboard();
});

function setupEventListeners() {
    // Header
    document.getElementById('backBtn').addEventListener('click', () => {
        window.parent.postMessage({ type: 'back-to-submodule-home' }, '*');
    });

    // Tabs
    document.querySelectorAll('.em-tab').forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

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
        const btn = e.target.closest('.em-breadcrumb__root');
        if (btn) navigateToPath(btn.dataset.path);
    });

    // Library - Folder clicks
    document.getElementById('folderList').addEventListener('click', (e) => {
        const folderCard = e.target.closest('.em-folder-card');
        if (folderCard) selectFolder(folderCard.dataset.path);
    });

    // Library - Document clicks
    document.getElementById('documentList').addEventListener('click', (e) => {
        const docCard = e.target.closest('.em-doc-card');
        if (docCard) selectDocument(docCard.dataset.path);
        const downloadBtn = e.target.closest('.em-doc-card__action[data-action="download"]');
        if (downloadBtn) {
            e.stopPropagation();
            downloadDocumentByPath(downloadBtn.closest('.em-doc-card').dataset.path);
        }
    });

    // Library - View toggle
    document.getElementById('viewGridBtn').addEventListener('click', () => {
        document.getElementById('documentList').classList.remove('em-docs-grid--list');
        document.getElementById('viewGridBtn').classList.add('active');
        document.getElementById('viewListBtn').classList.remove('active');
    });
    document.getElementById('viewListBtn').addEventListener('click', () => {
        document.getElementById('documentList').classList.add('em-docs-grid--list');
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
    // 📦608: botón "Ver completo" → abrir en modal file-viewer global del parent
    const previewExpandBtn = document.getElementById('previewExpandBtn');
    if (previewExpandBtn) {
        previewExpandBtn.addEventListener('click', () => {
            const filePath = previewExpandBtn.dataset.filePath || (currentDocument && currentDocument.path);
            if (filePath) _expandFileViewer(filePath);
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePreviewModal();
    });
}

// ═══════════════════════════════════════════════════════
// NAVEGACIÓN DE VISTAS
// ═══════════════════════════════════════════════════════

function switchView(viewName) {
    console.log(`[EMO] Switching view to: ${viewName}`);
    currentView = viewName;

    document.querySelectorAll('.em-tab').forEach(tab => {
        tab.classList.toggle('em-tab--active', tab.dataset.view === viewName);
    });
    document.getElementById('tabViewer').style.display = viewName === 'viewer' ? 'flex' : 'none';

    document.querySelectorAll('.em-view').forEach(view => {
        view.classList.remove('em-view--active');
    });
    const targetView = document.getElementById(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
    if (targetView) targetView.classList.add('em-view--active');

    if (viewName === 'dashboard') loadDashboard();
    else if (viewName === 'library') loadLibrary();
}

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════

async function loadDashboard() {
    console.log('[EMO] Loading dashboard');
    showDashboardLoading();

    try {
        const result = await callParentAPI('emo-get-dashboard-data', getModuleParams());
        renderDashboardStats(result.stats);
        renderYearBars(result.yearDistribution);
        renderRecentReports(result.recentReports);
    } catch (error) {
        console.error('[EMO] Error loading dashboard:', error);
        showDashboardError(error.message);
    }
}

function getModuleParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        companyName: urlParams.get('company') || '',
        moduleName:  urlParams.get('module')  || '',
        submoduleName: urlParams.get('submodule') || ''
    };
}

function showDashboardLoading() {
    document.getElementById('statTotal').textContent = '—';
    document.getElementById('statCurrentYear').textContent = '—';
    document.getElementById('statCurrentMonth').textContent = '—';
    document.getElementById('statFolders').textContent = '—';
    document.getElementById('yearBars').innerHTML = `
        <div class="em-empty-state">
            <i class="fas fa-chart-bar"></i>
            <p>Cargando distribución por año...</p>
        </div>`;
    document.getElementById('recentReports').innerHTML = `
        <div class="em-empty-state">
            <i class="fas fa-inbox"></i>
            <p>Cargando evaluaciones recientes...</p>
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
            <div class="em-empty-state">
                <i class="fas fa-chart-bar"></i>
                <p>No hay datos de distribución por año</p>
            </div>`;
        return;
    }

    const maxCount = Math.max(...yearDistribution.map(y => y.count));

    container.innerHTML = yearDistribution.map(year => {
        const percent = maxCount > 0 ? (year.count / maxCount) * 100 : 0;
        return `
            <div class="em-year-bar" data-year="${year.year}">
                <span class="em-year-bar__label">${year.year}</span>
                <div class="em-year-bar__track">
                    <div class="em-year-bar__fill" style="width: ${percent}%">
                        <span class="em-year-bar__count">${year.count}</span>
                    </div>
                </div>
            </div>`;
    }).join('');

    container.querySelectorAll('.em-year-bar__track').forEach(track => {
        track.addEventListener('click', () => {
            const year = track.closest('.em-year-bar').dataset.year;
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
            <div class="em-empty-state">
                <i class="fas fa-inbox"></i>
                <p>No hay evaluaciones recientes</p>
            </div>`;
        return;
    }

    container.innerHTML = reports.map(report => `
        <div class="em-recent-item" data-path="${report.path}">
            <div class="em-recent-item__icon"><i class="fas fa-file-medical"></i></div>
            <div class="em-recent-item__info">
                <div class="em-recent-item__name">${report.name}</div>
                <div class="em-recent-item__meta">${report.date || ''}</div>
            </div>
        </div>`).join('');

    container.querySelectorAll('.em-recent-item').forEach(item => {
        item.addEventListener('click', () => selectDocument(item.dataset.path));
    });
}

function showDashboardError(message) {
    document.getElementById('yearBars').innerHTML = `
        <div class="em-error-panel">
            <h3><i class="fas fa-exclamation-triangle"></i> Error al cargar datos</h3>
            <p>${message}</p>
            <p>Verifica que existan archivos de evaluaciones médicas en el módulo.</p>
        </div>`;
}

// ═══════════════════════════════════════════════════════
// LIBRARY
// ═══════════════════════════════════════════════════════

async function loadLibrary() {
    console.log('[EMO] Loading library');
    showLibraryLoading();

    try {
        const result = await callParentAPI('emo-get-library-data', getModuleParams());

        allFolders = result.folders || [];
        allFiles   = result.files   || [];
        filteredFiles = [...allFiles];

        populateYearFilter(result.availableYears || []);

        activeFolder = null;
        renderLibraryBreadcrumb();
        renderLibraryFolders();
        renderLibraryDocuments();
    } catch (error) {
        console.error('[EMO] Error loading library:', error);
        showLibraryError(error.message);
    }
}

function showLibraryLoading() {
    document.getElementById('folderList').innerHTML = KairSkeleton.list(5);
    document.getElementById('documentList').innerHTML = KairSkeleton.list(6);
}

function showLibraryError(message) {
    document.getElementById('documentList').innerHTML = `
        <div class="em-error-panel">
            <h3>Error al cargar la biblioteca</h3>
            <p>${message}</p>
        </div>`;
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
        const matchesYear  = !filterYear  || (file.year  && file.year.toString()  === filterYear);
        const matchesMonth = !filterMonth || (file.month && file.month.toString() === filterMonth);
        return matchesSearch && matchesYear && matchesMonth;
    });
    renderLibraryDocuments();
}

function renderLibraryBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!activeFolder) {
        breadcrumb.innerHTML = `
            <button class="em-breadcrumb__root active" data-path="">
                <i class="fas fa-home"></i>
                <span>Todas las Evaluaciones</span>
            </button>`;
    } else {
        const parts = activeFolder.split('/').filter(Boolean);
        let html = `<button class="em-breadcrumb__root" data-path="">
                <i class="fas fa-home"></i>
            </button>
            <span class="em-breadcrumb__sep">›</span>`;
        let pathSoFar = '';
        parts.forEach((part, idx) => {
            pathSoFar += '/' + part;
            const isLast = idx === parts.length - 1;
            html += isLast
                ? `<span class="em-breadcrumb__current">${part}</span>`
                : `<button class="em-breadcrumb__root" data-path="${pathSoFar}">${part}</button>
                   <span class="em-breadcrumb__sep">›</span>`;
        });
        breadcrumb.innerHTML = html;
    }
}

function renderLibraryFolders() {
    const container = document.getElementById('foldersSection');
    const list      = document.getElementById('folderList');

    const subfolders = activeFolder
        ? allFolders.filter(f => f.parentPath === activeFolder)
        : allFolders.filter(f => !f.parentPath || f.parentPath === '');

    if (subfolders.length === 0) { container.style.display = 'none'; return; }

    container.style.display = 'block';
    list.innerHTML = subfolders.map(folder => `
        <div class="em-folder-card ${activeFolder === folder.path ? 'active' : ''}" data-path="${folder.path}">
            <div class="em-folder-card__icon"><i class="fas fa-folder"></i></div>
            <div class="em-folder-card__name">${folder.name}</div>
            <div class="em-folder-card__count">${folder.count || 0} evaluaciones</div>
        </div>`).join('');
}

function renderLibraryDocuments() {
    const container = document.getElementById('documentList');
    const badge     = document.getElementById('docsCount');

    const normalizePath = (p) => p ? p.replace(/\\/g, '/').toLowerCase() : null;
    const activeFolderNorm = normalizePath(activeFolder);

    const filesToShow = activeFolder
        ? filteredFiles.filter(f => normalizePath(f.folderPath) === activeFolderNorm)
        : filteredFiles;

    badge.textContent = filesToShow.length;
    badge.style.display = filesToShow.length > 0 ? 'inline-flex' : 'none';

    if (filesToShow.length === 0) {
        container.innerHTML = `
            <div class="em-empty-state em-empty-state--large">
                <i class="fas fa-file-medical"></i>
                <h3>No se encontraron evaluaciones</h3>
                <p>Intenta cambiar los filtros o seleccionar otra carpeta</p>
            </div>`;
        return;
    }

    container.innerHTML = filesToShow.map(file => `
        <div class="em-doc-card" data-path="${file.path}">
            <div class="em-doc-card__icon em-doc-card__icon--${file.icon || 'pdf'}">
                <i class="fas fa-file-${file.icon === 'excel' ? 'excel' : file.icon === 'word' ? 'word' : 'pdf'}"></i>
            </div>
            <div class="em-doc-card__info">
                <div class="em-doc-card__name">${file.name}</div>
                <div class="em-doc-card__meta">${file.size || ''} · ${file.date || ''}</div>
            </div>
            <div class="em-doc-card__actions">
                <button class="em-doc-card__action" data-action="download" title="Descargar">
                    <i class="fas fa-download"></i>
                </button>
            </div>
        </div>`).join('');
}

function selectFolder(path) {
    console.log(`[EMO] Selecting folder: ${path}`);
    if (currentView !== 'library') switchView('library');
    activeFolder = path;
    renderLibraryBreadcrumb();
    renderLibraryFolders();
    renderLibraryDocuments();
}

function navigateToPath(path) {
    activeFolder = path || null;
    renderLibraryBreadcrumb();
    renderLibraryFolders();
    renderLibraryDocuments();
}

// ═══════════════════════════════════════════════════════
// DOCUMENT VIEWER
// ═══════════════════════════════════════════════════════

async function selectDocument(filePath) {
    console.log(`[EMO] Selecting document: ${filePath}`);
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
                     : 'fas fa-file-medical';

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

        if (result && result.success) {
            body.innerHTML = '';
            _renderPreview(body, result, filePath);
        } else {
            throw new Error((result && result.error) || 'Error al cargar el documento');
        }
    } catch (error) {
        console.error('[EMO] Error loading document:', error);
        showModalError(body, error.message, filePath);
    }
}

function showModalError(body, message, filePath) {
    const isPywin32     = /pywin32|win32com|pip install/i.test(message);
    const isUnsupported = /no soportado/i.test(message);

    let iconHtml = '<i class="fas fa-exclamation-triangle" style="color:var(--em-danger,#dc3545);"></i>';
    let title    = 'Error al cargar la evaluación';
    let detail   = `<p>${message}</p>`;
    let extraBtn = '';

    if (isPywin32) {
        iconHtml = '<i class="fas fa-tools" style="color:var(--em-warning,#ffc107);"></i>';
        title = 'Previsualización no disponible';
        detail = `
            <p>La conversión de archivos <strong>.doc/.docx</strong> requiere
            la librería <strong>pywin32</strong> de Python.</p>
            <code class="em-preview-modal__error-cmd">pip install pywin32</code>
            <p style="font-size:.8rem;color:var(--em-text-muted);">
                Ejecuta ese comando en la terminal con Python 3.13 y reinicia la aplicación.
            </p>`;
        extraBtn = `<button class="em-btn em-btn--sm em-btn--primary" id="modalOpenExtBtn" style="margin-top:10px;">
                        <i class="fas fa-external-link-alt"></i> Abrir con aplicación externa
                    </button>`;
    } else if (isUnsupported) {
        iconHtml = '<i class="fas fa-file" style="color:var(--em-text-muted);"></i>';
        title = 'Formato no soportado';
        detail = '<p>Este tipo de archivo no puede previsualizarse. Puedes abrirlo con una aplicación externa.</p>';
        extraBtn = `<button class="em-btn em-btn--sm em-btn--ghost" id="modalOpenExtBtn" style="margin-top:10px;">
                        <i class="fas fa-external-link-alt"></i> Abrir externamente
                    </button>`;
    }

    body.innerHTML = `
        <div class="em-preview-modal__error">
            <div class="em-preview-modal__error-icon">${iconHtml}</div>
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
    // 📦608: ocultar botón "Ver completo" al cerrar
    const expandBtn = document.getElementById('previewExpandBtn');
    if (expandBtn) expandBtn.style.display = 'none';
}

function displayDocument(data) {
    document.getElementById('loadingDiv').style.display    = 'none';
    document.getElementById('viewerEmpty').style.display  = 'none';
    document.getElementById('viewerContainer').style.display = 'flex';

    document.getElementById('viewerContainer').innerHTML = `
        <iframe src="data:application/pdf;base64,${data}"
                style="width: 100%; height: 100%; border: none;"
                sandbox="allow-scripts allow-same-origin">
        </iframe>`;

    applyViewerZoom();
}

// ═══════════════════════════════════════════════════════
// 📦608: file-viewer nativo + switch modo Office (208 formatos) vs PDF iframe
// ═══════════════════════════════════════════════════════

/**
 * Renderiza un preview (file-viewer nativo o iframe PDF legacy) según el modo
 * del resultado. También muestra/oculta el botón "Ver completo" si el modo
 * es file-viewer (que tiene más espacio para ver).
 */
function _renderPreview(container, result, filePath) {
    if (!container) return;
    container.innerHTML = '';
    const expandBtn = document.getElementById('previewExpandBtn');

    if (result && result.mode === 'file-viewer' && result.data && result.data.bytes) {
        // Office nativo: el bundle inyecta el viewer en el container
        if (window.KairDocPreview && typeof window.KairDocPreview.mountInContainer === 'function') {
            window.KairDocPreview.mountInContainer(container, result);
        } else if (window.kairFV && typeof window.kairFV.mountInContainer === 'function') {
            window.kairFV.mountInContainer(container, result.data);
        } else {
            container.innerHTML = '<div style="padding:20px;color:#b91c1c;">file-viewer no disponible</div>';
            return;
        }
        if (expandBtn) {
            expandBtn.style.display = '';
            expandBtn.dataset.filePath = filePath || '';
        }
    } else if (result && result.data) {
        // PDF legacy: iframe con base64
        let base64 = (typeof result.data === 'string') ? result.data : result.data.base64Data || result.base64Data;
        if (!base64) {
            container.innerHTML = '<div style="padding:20px;color:#b91c1c;">Sin datos para mostrar</div>';
            return;
        }
        try {
            const binary = atob(base64);
            const bytes  = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob    = new Blob([bytes], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            const iframe  = document.createElement('iframe');
            iframe.src    = blobUrl;
            iframe.style.cssText = 'width:100%;height:100%;border:none;';
            container.appendChild(iframe);
            const cleanup = () => URL.revokeObjectURL(blobUrl);
            document.getElementById('previewOverlay')?.addEventListener('click', cleanup, { once: true });
            document.getElementById('closePreviewBtn')?.addEventListener('click', cleanup, { once: true });
        } catch (e) {
            container.innerHTML = `<div style="padding:20px;color:#b91c1c;">Error: ${e.message}</div>`;
        }
        if (expandBtn) expandBtn.style.display = 'none';
    } else {
        container.innerHTML = '<div style="padding:20px;color:#b91c1c;">Sin datos para mostrar</div>';
        if (expandBtn) expandBtn.style.display = 'none';
    }
}

/**
 * Pide al parent que abra el archivo en el modal file-viewer global.
 * El parent (logic.js) tiene acceso a electronAPI.readFileBytes.
 */
function _expandFileViewer(filePath) {
    if (!filePath) return;
    try {
        window.top.postMessage({ type: 'open-file-viewer-modal', filePath, source: 'evaluaciones-medicas' }, '*');
    } catch (e) {
        console.error('[EMO] Error enviando postMessage al parent:', e);
    }
}

function applyViewerZoom() {
    const iframe = document.querySelector('#viewerContainer iframe');
    if (!iframe) return;

    let src = iframe.src.split('#')[0];
    let zoomParam = '';

    switch (currentZoom) {
        case 'page-width':  zoomParam = '#view=FitH'; break;
        case 'page-height': zoomParam = '#view=FitV'; break;
        case 'auto':        zoomParam = '#view=Fit';  break;
        default:
            const percent = parseInt(currentZoom, 10);
            zoomParam = !isNaN(percent) ? `#zoom=${percent}` : '#view=Fit';
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

function showViewerError(message, filePath) {
    document.getElementById('loadingDiv').style.display      = 'none';
    document.getElementById('viewerContainer').style.display = 'none';
    document.getElementById('viewerEmpty').style.display     = 'flex';

    const isPywin32 = /pywin32|win32com|pip install/i.test(message);
    const isUnsupported = /no soportado/i.test(message);

    let iconColor  = 'var(--em-danger-light); color: var(--em-danger)';
    let title      = 'Error al cargar la evaluación';
    let detail     = `<p style="font-size:13px;color:var(--em-text-secondary);max-width:480px;">${message}</p>`;
    let extraBtn   = '';

    if (isPywin32) {
        iconColor = 'var(--em-warning-light); color: var(--em-warning)';
        title = 'Previsualización no disponible';
        detail = `
            <p style="font-size:14px;color:var(--em-text-secondary);max-width:480px;">
                La conversión de archivos <strong>.doc/.docx</strong> requiere la librería
                <strong>pywin32</strong> de Python.
            </p>
            <div style="background:var(--em-bg-app);border:1px solid var(--em-border);border-radius:var(--em-radius);
                        padding:10px 16px;font-family:monospace;font-size:13px;color:var(--em-text-primary);
                        margin:8px 0;">
                pip install pywin32
            </div>
            <p style="font-size:12px;color:var(--em-text-muted);">
                Ejecuta ese comando en la terminal con Python 3.13 y reinicia la aplicación.
            </p>`;
        if (filePath) {
            extraBtn = `<button class="em-btn em-btn--outline" id="openExternallyBtn" style="background:var(--em-primary);color:#fff;border:none;">
                            <i class="fas fa-external-link-alt"></i> Abrir con aplicación externa
                        </button>`;
        }
    } else if (isUnsupported) {
        iconColor = 'var(--em-info-light); color: var(--em-info)';
        title = 'Formato no soportado';
        detail = `<p style="font-size:13px;color:var(--em-text-secondary);">
                    Este tipo de archivo no puede previsualizarse directamente.
                    Puedes descargarlo o abrirlo con una aplicación externa.
                  </p>`;
        if (filePath) {
            extraBtn = `<button class="em-btn em-btn--action" id="openExternallyBtn">
                            <i class="fas fa-external-link-alt"></i> Abrir externamente
                        </button>`;
        }
    }

    document.getElementById('viewerEmpty').innerHTML = `
        <div class="em-viewer__empty-icon" style="background-color:${iconColor};">
            <i class="fas fa-${isPywin32 ? 'tools' : isUnsupported ? 'file-slash' : 'exclamation-triangle'}"></i>
        </div>
        <h3>${title}</h3>
        ${detail}
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:8px;">
            <button class="em-btn em-btn--ghost" id="goToLibraryBtn"
                    style="background:var(--em-primary-light);color:var(--em-primary);">
                <i class="fas fa-arrow-left"></i> Volver a Biblioteca
            </button>
            ${extraBtn}
        </div>`;

    document.getElementById('goToLibraryBtn').addEventListener('click', () => switchView('library'));
    if (filePath && document.getElementById('openExternallyBtn')) {
        document.getElementById('openExternallyBtn').addEventListener('click', () => openExternally(filePath));
    }
}

async function openExternally(filePath) {
    try {
        await callParentAPI('open-path', filePath);
        showNotification('Abriendo archivo con aplicación externa...', 'success');
    } catch (err) {
        showNotification('No se pudo abrir el archivo externamente.', 'error');
    }
}

// ═══════════════════════════════════════════════════════
// DESCARGA E IMPRESIÓN
// ═══════════════════════════════════════════════════════

async function downloadCurrentDocument() {
    if (!currentDocument) { showNotification('No hay evaluación seleccionada', 'warning'); return; }
    await downloadDocumentByPath(currentDocument.path);
}

async function downloadDocumentByPath(filePath) {
    try {
        showNotification('Preparando descarga...');
        const result = await callParentAPI('download-document', filePath);

        if (result.success) {
            const binaryData = atob(result.base64Data);
            const bytes = new Uint8Array(binaryData.length);
            for (let i = 0; i < binaryData.length; i++) bytes[i] = binaryData.charCodeAt(i);

            const blob = new Blob([bytes], { type: 'application/octet-stream' });
            const url  = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = result.fileName || filePath.split(/[/\\]/).pop();
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showNotification('Evaluación descargada exitosamente.', 'success');
        } else {
            showNotification(`Error en la descarga: ${result.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Error en la descarga: ${error.message}`, 'error');
    }
}

async function printCurrentDocument() {
    if (!currentDocument) { showNotification('No hay evaluación seleccionada', 'warning'); return; }
    const iframe = document.querySelector('#viewerContainer iframe');
    if (iframe && iframe.contentWindow) {
        try { iframe.contentWindow.print(); }
        catch (e) { showNotification('Use la descarga e imprima desde el archivo.', 'warning'); }
    }
}

// ═══════════════════════════════════════════════════════
// NOTIFICACIONES
// ═══════════════════════════════════════════════════════

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const icon         = notification.querySelector('.em-notification__icon');
    const messageDiv   = notification.querySelector('.em-notification__message');

    messageDiv.textContent = message;
    notification.className = `em-notification ${type}`;
    icon.className = `em-notification__icon fas ${getNotificationIcon(type)}`;

    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error':   return 'fa-times-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default:        return 'fa-info-circle';
    }
}
