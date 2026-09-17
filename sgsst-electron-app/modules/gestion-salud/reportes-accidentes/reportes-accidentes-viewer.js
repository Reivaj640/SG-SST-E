// reportes-accidentes-viewer.js
// FURAT - Gestión de Reportes de Accidentes de Trabajo
// Submódulo 3.2.1 · K+AIR

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

// 📦658 — Estado del upload (archivo seleccionado + form)
let uploadState = {
  file: null,           // File object del navegador
  fileBase64: null,     // Representación base64 lista para enviar
  fileExt: '',          // .pdf, .xlsx, .docx, etc
  fileType: '',         // MIME type
  fileSize: 0,          // bytes
  modalOpen: false
};

// 📦660 — Metadata cacheada de la DB (mapeada por filePath)
// Se carga en loadLibrary() para enriquecer las cards/documentos con chips de gravedad/tipo/área
let libraryMetadata = {};

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

    // Tabs (📦678 — antes .kair-header__tab, ahora .em-tab del patrón 3.1.4)
    document.querySelectorAll('.em-tab').forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    // 📦680 — Botón "Agregar período" + modal de crear carpeta
    setupCreateFolderModal();

    // 📦679 — Hero del dashboard eliminado. La subida se hace desde la drop
    // zone de la biblioteca, y la exploración desde el tab "Biblioteca" del header.
    // 📦677 — Botón "Subir FURAT" del header eliminado (uploadCta).

    // 📦658 — Drop zone (Biblioteca): drag & drop + click → file picker
    setupDropZone();
    // 📦670 — Drop zone sigue al mouse sobre cada folder card
    setupCardDropzone();

    // 📦658 — Modal de upload: cerrar, cancelar, submit
    setupUploadModal();

    // 📦686 — Modal de preview (kair-fv-modal, mismo patrón que Bandeja Integrada).
    // - Click en el botón cerrar
    // - Click fuera del modal (sobre el overlay)
    // - Tecla ESC
    var fvOverlay  = document.getElementById('fv-overlay');
    var fvCloseBtn = document.getElementById('fv-close-btn');
    var fvModal    = fvOverlay ? fvOverlay.querySelector('.kair-fv-modal') : null;
    if (fvCloseBtn) fvCloseBtn.addEventListener('click', closeFuratPreview);
    if (fvOverlay && fvModal) {
        fvOverlay.addEventListener('click', function (e) {
            // Solo cerrar si el click fue directamente sobre el overlay (no sobre el modal)
            if (e.target === fvOverlay) closeFuratPreview();
        });
    }
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && fvOverlay && !fvOverlay.hasAttribute('hidden')) {
            closeFuratPreview();
        }
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

    // Library - Filters (chips de año, click delegation)
    var filterChips = document.getElementById('filterChips');
    if (filterChips) {
        filterChips.addEventListener('click', (e) => {
            var chip = e.target.closest('.furat-chip');
            if (!chip) return;
            var year = chip.getAttribute('data-year') || '';
            filterYear = year;
            updateActiveFilterChip();
            applyFiltersAndRender();
        });
    }

    // Library - Breadcrumb (V2): solo se usa #breadcrumbInline (dentro del card unificado)
    // 📦667 — El breadcrumb standalone de la raíz fue eliminado.
    var breadcrumbInlineEl = document.getElementById('breadcrumbInline');
    if (breadcrumbInlineEl) {
        breadcrumbInlineEl.addEventListener('click', (e) => {
            var btn = e.target.closest('.furat-breadcrumb-v2__root, .furat-breadcrumb-v2__item');
            if (btn && typeof btn.dataset.path !== 'undefined') {
                navigateToPath(btn.dataset.path);
            }
        });
    }

    // Library - Folder clicks (V2)
    document.getElementById('folderList').addEventListener('click', (e) => {
        var folderCard = e.target.closest('.furat-folder-card-v2');
        if (folderCard) selectFolder(folderCard.dataset.path);
    });

    // 📦692 — Context menu en folder cards (click derecho)
    document.getElementById('folderList').addEventListener('contextmenu', (e) => {
        var folderCard = e.target.closest('.furat-folder-card-v2');
        if (!folderCard) return;
        e.preventDefault();
        var folder = {
            name: folderCard.dataset.name || folderCard.dataset.path.split(/[\\/]/).pop(),
            path: folderCard.dataset.path,
            count: parseInt(folderCard.dataset.count || '0', 10)
        };
        showFolderContextMenu(e.clientX, e.clientY, folder);
    });

    // Click fuera cierra el context menu
    document.addEventListener('click', (e) => {
        var menu = document.getElementById('folderContextMenu');
        if (menu && menu.classList.contains('is-visible') && !menu.contains(e.target)) {
            hideFolderContextMenu();
        }
    });

    // 📦692 — Setup de los botones del context menu
    setupFolderContextMenuHandlers();

    // 📦692 — Setup del modal de delete folder
    setupDeleteFolderModal();

    // 📦693 — Setup del modal de editar metadata + context menu de PDFs
    setupEditMetadataModal();
    setupDocumentContextMenu();

    // 📦692-fix — Breadcrumb clicks (jerárquico, soporta navegación multi-nivel)
    document.getElementById('breadcrumbInline').addEventListener('click', (e) => {
        var crumb = e.target.closest('.furat-breadcrumb-v2__root, .furat-breadcrumb-v2__item');
        if (!crumb) return;
        var targetPath = crumb.dataset.path || null;
        if (targetPath === null || targetPath === '') {
            // Click en "Todos los Reportes" → ir a la raíz
            navigateToPath(null);
        } else {
            navigateToPath(targetPath);
        }
    });

    // Library - Document clicks (V2: tabla)
    document.getElementById('documentList').addEventListener('click', (e) => {
        var tr = e.target.closest('tr[data-path]');
        if (!tr) return;
        var path = tr.dataset.path;
        var actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            e.stopPropagation();
            var action = actionBtn.getAttribute('data-action');
            if (action === 'download') downloadDocumentFromCard(path);
            else if (action === 'view') selectDocument(path);
        } else {
            selectDocument(path);
        }
    });

    // Library - View toggle (lista/cards) — solo toggle visual, no implementado
    // (La vista por defecto es tabla, que es la más útil. El toggle es decorativo.)
    var viewListBtn = document.getElementById('viewListBtn');
    var viewGridBtn = document.getElementById('viewGridBtn');
    if (viewListBtn && viewGridBtn) {
        viewListBtn.classList.add('furat-btn--active');
        viewListBtn.addEventListener('click', function () {
            viewListBtn.classList.add('furat-btn--active');
            viewGridBtn.classList.remove('furat-btn--active');
        });
        viewGridBtn.addEventListener('click', function () {
            viewGridBtn.classList.add('furat-btn--active');
            viewListBtn.classList.remove('furat-btn--active');
            showNotification('Vista cuadrícula disponible en una próxima fase', 'info');
        });
    }

    // 📦673 — Listeners del VIEWER eliminados (el tab "Visor" fue removido en Fase 1).
    // Antes estos listeners tiraban TypeError porque los elementos ya no existen
    // y abortaban el setupEventListeners a mitad de camino. Ahora están limpios.
}

// ═══════════════════════════════════════════════════════
// NAVEGACIÓN DE VISTAS
// ═══════════════════════════════════════════════════════

function switchView(viewName) {
    console.log(`[FURAT] Switching view to: ${viewName}`);
    currentView = viewName;

    // Update tabs (📦678 — em-tab del patrón 3.1.4)
    document.querySelectorAll('.em-tab').forEach(tab => {
        tab.classList.toggle('em-tab--active', tab.dataset.view === viewName);
    });

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

        // 📦659 — Cargar analytics (Fase 3). No bloquea el render principal.
        loadAnalytics();
    } catch (error) {
        console.error('[FURAT] Error loading dashboard:', error);
        showDashboardError(error.message);
    }
}

// 📦659 — Fase 3: Carga analytics y dispara los 4 charts
async function loadAnalytics() {
    try {
        var params = getModuleParams();
        var result = await callParentAPI('furat-get-analytics', { companyName: params.companyName });
        if (!result || !result.analytics) return;
        var analytics = result.analytics;
        var withMeta = analytics.withMetadata || 0;
        var hint = document.getElementById('analyticsHint');
        if (hint) {
            if (withMeta === 0) {
                hint.textContent = 'Sin metadata todavía — subí un FURAT nuevo para ver análisis';
            } else if (withMeta < 3) {
                hint.textContent = 'Análisis preliminar · basado en ' + withMeta + ' reporte' + (withMeta === 1 ? '' : 's') + ' con metadata';
            } else {
                hint.textContent = 'Basado en ' + withMeta + ' reporte' + (withMeta === 1 ? '' : 's') + ' con metadata';
            }
        }
        renderMonthlyTrend(analytics.monthlyTrend, withMeta);
        renderByType(analytics.byType, withMeta);
        renderBySeverity(analytics.bySeverity, withMeta);
        renderByArea(analytics.byArea, withMeta);
    } catch (e) {
        console.warn('[FURAT] Error en loadAnalytics:', e);
    }
}

function renderChartEmpty(chartId, icon, title, text) {
    var el = document.getElementById(chartId);
    if (!el) return;
    el.innerHTML = '<div class="furat-chart-empty">' +
        '<div class="furat-chart-empty__icon"><i class="fas ' + icon + '"></i></div>' +
        '<p class="furat-chart-empty__title">' + escapeHtml(title) + '</p>' +
        '<p class="furat-chart-empty__text">' + escapeHtml(text) + '</p>' +
        '</div>';
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 📦687 — Helper para el ribbon de "análisis preliminar".
// Lo extraje a una función para que sea fácil cambiar el texto y para
// garantizar que el HTML sea consistente entre los 4 charts.
function buildChartPreliminarRibbon() {
    return '<div class="furat-chart-preliminar">' +
        '<i class="fas fa-info-circle"></i>' +
        '<span>Análisis preliminar · subí más FURATs con metadata para ver tendencias</span>' +
        '</div>';
}

// 📦687-fix — Helper que agrega el ribbon SOLO si no hay uno ya en el HTML.
// Bug conocido: `renderBySeverity` se llama 2 veces, lo que produce 2 ribbons.
// Este guard evita la duplicación a nivel JS (más robusto que el CSS-only fix).
function appendPreliminarRibbonIfMissing(html, withMetadata) {
    if (withMetadata === undefined || withMetadata <= 0 || withMetadata >= 3) return html;
    if (html.indexOf('furat-chart-preliminar') !== -1) return html;
    return html + buildChartPreliminarRibbon();
}

function renderMonthlyTrend(monthly, withMetadata) {
    var el = document.getElementById('chartMonthlyTrend');
    if (!el || !monthly || monthly.length === 0) {
        return renderChartEmpty('chartMonthlyTrend', 'fa-chart-line', 'Sin datos', 'La tendencia se mostrará cuando subas FURATs con metadata.');
    }
    var maxCount = Math.max.apply(null, monthly.map(function (m) { return m.count; })) || 1;

    // 📦687 — Versión mejorada: LÍNEA con PUNTOS (en lugar de barras).
    // Los meses con data tienen un punto prominente + label del valor.
    // Los meses sin data son puntos pequeños vacíos en la línea base.
    var chartHeight = 130; // px (espacio para la línea)
    var widthPct = 100 / monthly.length;

    // Construir el path SVG para la línea
    var points = monthly.map(function (m, idx) {
        var xPct = (idx + 0.5) * widthPct;
        var yPx = m.count > 0 ? chartHeight - (m.count / maxCount) * (chartHeight - 30) - 15 : chartHeight - 5;
        return { xPct: xPct, yPx: yPx, count: m.count, label: m.label, idx: idx };
    });

    // Construir path "M x0 y0 L x1 y1 L x2 y2 ..."
    var pathD = points.map(function (p, i) {
        return (i === 0 ? 'M' : 'L') + ' ' + p.xPct + ' ' + p.yPx;
    }).join(' ');

    // 📦687 — Envolver en __main para que el ribbon no se superponga con el chart
    var html = '<div class="furat-chart-trend__main">';
    html += '  <div class="furat-chart-trend__baseline" aria-hidden="true"></div>';
    html += '  <svg class="furat-chart-trend__line" viewBox="0 0 100 ' + chartHeight + '" preserveAspectRatio="none" aria-hidden="true">';
    html += '    <path d="' + pathD + '" fill="none" stroke="var(--furat-primary)" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>';
    html += '  </svg>';

    monthly.forEach(function (m, idx) {
        var isLatest = idx === monthly.length - 1;
        var pointClass = 'furat-chart-trend__point' + (m.count > 0 ? ' furat-chart-trend__point--has-data' : ' furat-chart-trend__point--empty') + (isLatest ? ' furat-chart-trend__point--latest' : '');
        html += '<div class="furat-chart-trend__col" title="' + escapeHtml(m.label) + ': ' + m.count + '">';
        if (m.count > 0) {
            html += '  <span class="furat-chart-trend__count">' + m.count + '</span>';
        }
        html += '  <span class="' + pointClass + '"></span>';
        html += '  <span class="furat-chart-trend__label">' + escapeHtml(m.label) + '</span>';
        html += '</div>';
    });
    html += '</div>';

    // Ribbon "análisis preliminar" cuando hay < 3 reportes con metadata
    html = appendPreliminarRibbonIfMissing(html, withMetadata);

    el.innerHTML = html;
}

function renderByType(byType, withMetadata) {
    var el = document.getElementById('chartByType');
    var keys = byType ? Object.keys(byType) : [];
    if (!el || keys.length === 0) {
        return renderChartEmpty('chartByType', 'fa-exclamation-triangle', 'Sin datos', 'Subí FURATs con tipo de accidente para ver la distribución.');
    }
    var TYPE_LABELS = {
        caida: 'Caída', golpe: 'Golpe', atrapamiento: 'Atrapamiento',
        corte: 'Corte/Herida', quemadura: 'Quemadura', esfuerzo: 'Esfuerzo físico',
        exposicion: 'Exposición', otro: 'Otro'
    };
    var maxCount = Math.max.apply(null, keys.map(function (k) { return byType[k]; })) || 1;
    // Ordenar desc por count
    keys.sort(function (a, b) { return byType[b] - byType[a]; });
    var html = '';
    keys.forEach(function (k) {
        var count = byType[k];
        var pct = (count / maxCount) * 100;
        var label = TYPE_LABELS[k] || k;
        html += '<div class="furat-chart-bars__row">';
        html += '  <span class="furat-chart-bars__label" title="' + escapeHtml(label) + '">' + escapeHtml(label) + '</span>';
        html += '  <div class="furat-chart-bars__track"><div class="furat-chart-bars__fill" style="width: ' + Math.max(pct, 4) + '%"></div></div>';
        html += '  <span class="furat-chart-bars__count">' + count + '</span>';
        html += '</div>';
    });
    // Ribbon "análisis preliminar" cuando hay < 3 reportes con metadata
    html = appendPreliminarRibbonIfMissing(html, withMetadata);
    el.innerHTML = html;
}

function renderBySeverity(bySeverity, withMetadata) {
    var el = document.getElementById('chartBySeverity');
    var keys = bySeverity ? Object.keys(bySeverity) : [];
    if (!el || keys.length === 0) {
        return renderChartEmpty('chartBySeverity', 'fa-heartbeat', 'Sin datos', 'La distribución por gravedad se mostrará al subir FURATs con metadata.');
    }
    var SEVERITY_LABELS = {
        leve: 'Leve', moderado: 'Moderado', grave: 'Grave', mortal: 'Mortal'
    };
    var SEVERITY_ORDER = ['leve', 'moderado', 'grave', 'mortal'];
    // Ordenar por orden predefinido
    var orderedKeys = SEVERITY_ORDER.filter(function (k) { return keys.indexOf(k) !== -1; });
    orderedKeys = orderedKeys.concat(keys.filter(function (k) { return SEVERITY_ORDER.indexOf(k) === -1; }));

    var total = orderedKeys.reduce(function (sum, k) { return sum + bySeverity[k]; }, 0);
    if (total === 0) {
        return renderChartEmpty('chartBySeverity', 'fa-heartbeat', 'Sin datos', 'La distribución por gravedad se mostrará al subir FURATs con metadata.');
    }
    var html = '<div class="furat-chart-severity__stacked">';
    orderedKeys.forEach(function (k) {
        var count = bySeverity[k];
        var pct = (count / total) * 100;
        if (count === 0) return;
        html += '<div class="furat-chart-severity__seg furat-chart-severity__seg--' + escapeHtml(k) + '" style="width: ' + pct + '%" title="' + escapeHtml(SEVERITY_LABELS[k] || k) + ': ' + count + ' (' + Math.round(pct) + '%)">' + count + '</div>';
    });
    html += '</div>';
    html += '<div class="furat-chart-severity__legend">';
    orderedKeys.forEach(function (k) {
        if (bySeverity[k] === 0) return;
        html += '<span class="furat-chart-severity__legend-item">';
        html += '  <span class="furat-chart-severity__legend-dot furat-chart-severity__seg--' + escapeHtml(k) + '" style="background: var(--furat-severity-' + escapeHtml(k) + ', ' + (
            k === 'leve' ? 'var(--furat-success)' :
            k === 'moderado' ? '#f59e0b' :
            k === 'grave' ? 'var(--furat-danger)' : '#7c2d12'
        ) + ');"></span>';
        html += '  ' + escapeHtml(SEVERITY_LABELS[k] || k) + ' (' + bySeverity[k] + ')';
        html += '</span>';
    });
    html += '</div>';
    // Ribbon "análisis preliminar" cuando hay < 3 reportes con metadata
    html = appendPreliminarRibbonIfMissing(html, withMetadata);
    el.innerHTML = html;
}

function renderByArea(byArea, withMetadata) {
    var el = document.getElementById('chartByArea');
    if (!el || !byArea || byArea.length === 0) {
        return renderChartEmpty('chartByArea', 'fa-map-marker-alt', 'Sin datos', 'Las áreas con más accidentes se mostrarán al subir FURATs con metadata.');
    }
    var maxCount = byArea[0].count || 1;
    var html = '';
    byArea.slice(0, 5).forEach(function (item) {
        var pct = (item.count / maxCount) * 100;
        html += '<div class="furat-chart-bars__row">';
        html += '  <span class="furat-chart-bars__label" title="' + escapeHtml(item.area) + '">' + escapeHtml(item.area) + '</span>';
        html += '  <div class="furat-chart-bars__track"><div class="furat-chart-bars__fill" style="width: ' + Math.max(pct, 4) + '%"></div></div>';
        html += '  <span class="furat-chart-bars__count">' + item.count + '</span>';
        html += '</div>';
    });
    // Ribbon "análisis preliminar" cuando hay < 3 reportes con metadata
    html = appendPreliminarRibbonIfMissing(html, withMetadata);
    el.innerHTML = html;
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
    // 📦679 — Hero del dashboard eliminado, ya no se actualiza.
}

function renderDashboardStats(stats) {
    document.getElementById('statTotal').textContent = stats.total || '0';
    document.getElementById('statCurrentYear').textContent = stats.currentYear || '0';
    document.getElementById('statYearLabel').textContent = stats.currentYearLabel || 'Este Año';
    document.getElementById('statCurrentMonth').textContent = stats.currentMonth || '0';
    document.getElementById('statMonthLabel').textContent = stats.currentMonthLabel || 'Este Mes';
    document.getElementById('statFolders').textContent = stats.folders || '0';
    // 📦679 — Hero del dashboard eliminado, los KPIs resumen igual la info clave.
}

function renderYearBars(yearDistribution) {
    const container = document.getElementById('yearBars');
    if (!yearDistribution || yearDistribution.length === 0) {
        container.innerHTML = `
            <div class="furat-empty-state furat-empty-state--motivational">
                <div class="furat-empty-state__icon"><i class="fas fa-chart-bar"></i></div>
                <h3>Sin datos por año</h3>
                <p>Cuando subas tu primer FURAT, acá vas a ver la distribución histórica por año.</p>
            </div>`;
        return;
    }

    const maxCount = Math.max(...yearDistribution.map(y => y.count));

    container.innerHTML = yearDistribution.map(year => {
        const percent = maxCount > 0 ? (year.count / maxCount) * 100 : 0;
        return `
            <div class="furat-year-bar" data-year="${year.year}" role="button" tabindex="0" title="Click para filtrar la biblioteca por ${year.year}">
                <span class="furat-year-bar__label">${year.year}</span>
                <div class="furat-year-bar__track">
                    <div class="furat-year-bar__fill" style="width: ${percent}%"></div>
                </div>
                <span class="furat-year-bar__count">${year.count}</span>
            </div>`;
    }).join('');

    // Click en año para filtrar en biblioteca
    container.querySelectorAll('.furat-year-bar').forEach(bar => {
        const handler = () => {
            const year = bar.dataset.year;
            filterYear = year;
            // 📦660 — Activar el chip correspondiente (V2)
            updateActiveFilterChip();
            switchView('library');
        };
        bar.addEventListener('click', handler);
        bar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handler();
            }
        });
    });
}

function renderRecentReports(reports) {
    const container = document.getElementById('recentReports');
    if (!reports || reports.length === 0) {
        container.innerHTML = `
            <div class="furat-empty-state furat-empty-state--motivational">
                <div class="furat-empty-state__icon"><i class="fas fa-inbox"></i></div>
                <h3>Sin reportes recientes</h3>
                <p>Cuando subas FURATs, los últimos 8 aparecerán acá para acceso rápido.</p>
            </div>`;
        return;
    }

    container.innerHTML = reports.map(report => {
        const ext = (report.name || '').split('.').pop().toLowerCase();
        const iconClass = ext === 'xls' || ext === 'xlsx' ? 'fa-file-excel'
                       : ext === 'doc' || ext === 'docx' ? 'fa-file-word'
                       : 'fa-file-pdf';
        return `
        <div class="furat-recent-item" data-path="${report.path}" role="button" tabindex="0" title="${report.name}">
            <div class="furat-recent-item__icon"><i class="fas ${iconClass}"></i></div>
            <div class="furat-recent-item__info">
                <div class="furat-recent-item__name">${report.name}</div>
                <div class="furat-recent-item__meta">${report.date || 'Sin fecha'}</div>
            </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.furat-recent-item').forEach(item => {
        const handler = () => selectDocument(item.dataset.path);
        item.addEventListener('click', handler);
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handler();
            }
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

        // 📦660 — Cargar metadata de la DB para enriquecer cards/tabla con chips.
        // No bloquea el render principal si falla.
        try {
            var params = getModuleParams();
            var metaRes = await callParentAPI('furat-list-metadata', { companyName: params.companyName });
            libraryMetadata = {};
            if (metaRes && Array.isArray(metaRes.metadata)) {
                metaRes.metadata.forEach(function (m) {
                    if (m && m.file_path) {
                        // Normalizar el path para matchear con file.path
                        var key = m.file_path.replace(/\\/g, '/').toLowerCase();
                        libraryMetadata[key] = m;
                    }
                });
            }
        } catch (metaErr) {
            console.warn('[FURAT] No se pudo cargar metadata:', metaErr);
            libraryMetadata = {};
        }

        // Populate filter chips de año
        populateFilterChips(result.availableYears || []);

        // Render root level
        activeFolder = null;
        pathHistory = [];
        // 📦663 — Header card (breadcrumb + toolbar): oculto en la raíz
        toggleDocumentsHeaderCard();
        renderLibraryBreadcrumb();
        renderLibraryFolders();
        renderLibraryDocuments();
    } catch (error) {
        console.error('[FURAT] Error loading library:', error);
        showLibraryError(error.message);
    }
}

function showLibraryLoading() {
    var folderList = document.getElementById('folderList');
    var documentList = document.getElementById('documentList');
    if (folderList) folderList.innerHTML = KairSkeleton.list(5);
    if (documentList) {
        documentList.innerHTML = '<div class="furat-empty-state-library">' +
            '<i class="fas fa-spinner fa-spin furat-empty-state-library__icon" style="font-size:1.5rem;opacity:0.5;"></i>' +
            '<p style="margin-top:0.5rem;">Cargando reportes...</p></div>';
    }
}

function populateFilterChips(years) {
    var container = document.getElementById('filterChips');
    if (!container) return;
    var currentValue = filterYear;
    // Limpiar chips de año (mantener el "Todos los años")
    var todosChip = container.querySelector('[data-year=""]');
    container.innerHTML = '';
    if (todosChip) container.appendChild(todosChip);
    // Agregar un chip por cada año, ordenados desc
    years.slice().sort(function (a, b) { return b - a; }).forEach(function (year) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'furat-chip' + (String(year) === currentValue ? ' furat-chip--active' : '');
        btn.setAttribute('data-year', year);
        btn.textContent = year;
        container.appendChild(btn);
    });
    // Marcar el chip activo
    updateActiveFilterChip();
}

function updateActiveFilterChip() {
    var container = document.getElementById('filterChips');
    if (!container) return;
    container.querySelectorAll('.furat-chip').forEach(function (chip) {
        var isActive = (chip.getAttribute('data-year') || '') === (filterYear || '');
        chip.classList.toggle('furat-chip--active', isActive);
    });
}

function applyFiltersAndRender() {
    filteredFiles = allFiles.filter(file => {
        var matchesSearch = !searchQuery || file.name.toLowerCase().includes(searchQuery);
        var matchesYear = !filterYear || (file.year && file.year.toString() === filterYear);
        return matchesSearch && matchesYear;
    });
    renderLibraryDocuments();
    updateResultsCounter();
}

function updateResultsCounter() {
    var counter = document.getElementById('resultsCounter');
    if (!counter) return;
    var total = allFiles.length;
    var shown = filteredFiles.length;
    if (filterYear) {
        counter.textContent = shown + ' / ' + total + ' (' + filterYear + ')';
    } else if (searchQuery) {
        counter.textContent = shown + ' resultado' + (shown === 1 ? '' : 's');
    } else {
        counter.textContent = total + ' reporte' + (total === 1 ? '' : 's') + ' en total';
    }
}

function renderLibraryBreadcrumb() {
    // 📦667 — Solo hay UN breadcrumb (#breadcrumbInline, dentro del header card).
    // Se muestra solo cuando hay folder activa. En la raíz no se muestra nada
    // (el usuario ya ve el título "Carpetas por año" + folder cards).
    var breadcrumbInline = document.getElementById('breadcrumbInline');
    if (!breadcrumbInline) return;

    if (!activeFolder) {
        // Raíz: el card completo está oculto, no hay breadcrumb visible.
        breadcrumbInline.innerHTML = '';
        return;
    }

    // 📦692-fix — Breadcrumb JERÁRQUICO. ANTES solo mostraba el nombre de la
    // carpeta actual (ej: "Todos los Reportes > Enero"). Ahora muestra la
    // cadena completa de ancestros ("Todos los Reportes > 2019 > Enero"),
    // y cada nivel es clickeable para volver atrás. Esto es necesario
    // porque ahora la navegación soporta subcarpetas (Enero dentro de 2019).
    //
    // Estructura: [Home] > [Padre1] > [Padre2] > [Actual]
    // El último (Actual) NO es clickeable, los demás sí.

    // Construir la jerarquía buscando cada nivel en allFolders
    var ancestors = [];
    var lookupPath = activeFolder;
    while (lookupPath) {
        var found = allFolders.find(function (f) {
            return (f.path || '').replace(/\\/g, '/').toLowerCase() ===
                   lookupPath.replace(/\\/g, '/').toLowerCase();
        });
        if (!found) break;
        ancestors.unshift(found);
        lookupPath = found.parentPath;
    }

    var html = '<button class="furat-breadcrumb-v2__root" data-path="" type="button" title="Ir a la raíz">' +
        '<i class="fas fa-home" aria-hidden="true"></i>' +
        '<span>Todos los Reportes</span></button>';

    // Cada ancestro es un botón clickeable. El ÚLTIMO ancestro es la carpeta
    // actual (folder activo) → lo mostramos como texto no clickeable, no como botón.
    ancestors.forEach(function (folder, idx) {
        var name = folder.name || folder.path.split(/[\\/]/).pop();
        var isLast = (idx === ancestors.length - 1);
        html += '<i class="fas fa-chevron-right furat-breadcrumb-v2__sep" aria-hidden="true"></i>';
        if (isLast) {
            // Carpeta actual: solo texto, no botón
            html += '<span class="furat-breadcrumb-v2__current" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</span>';
        } else {
            // Ancestro: botón clickeable. Usamos __item (NO __crumb) para reusar
            // los estilos ya definidos en CSS junto con __root.
            html += '<button class="furat-breadcrumb-v2__item" data-path="' + escapeHtml(folder.path) + '" type="button" title="Ir a ' + escapeHtml(name) + '">' +
                    escapeHtml(name) + '</button>';
        }
    });

    breadcrumbInline.innerHTML = html;
}

function renderLibraryFolders() {
    var container = document.getElementById('foldersSection');
    var list = document.getElementById('folderList');
    var meta = document.getElementById('foldersMeta');
    if (!container || !list) return;

    var subfolders = activeFolder
        ? allFolders.filter(f => f.parentPath === activeFolder)
        : allFolders.filter(f => !f.parentPath || f.parentPath === '');

    if (subfolders.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    if (meta) meta.textContent = subfolders.length + ' carpeta' + (subfolders.length === 1 ? '' : 's');

    list.innerHTML = subfolders.map(function (folder) {
        var yearMatch = (folder.name || '').match(/\d{4}/);
        var year = yearMatch ? yearMatch[0] : folder.name;
        // Contar cuántos archivos de esta carpeta tienen metadata
        var filesInFolder = allFiles.filter(function (f) {
            return (f.folderPath || '').replace(/\\/g, '/').toLowerCase() === (folder.path || '').replace(/\\/g, '/').toLowerCase();
        });
        var totalInFolder = filesInFolder.length;
        var withMeta = filesInFolder.filter(function (f) {
            return !!libraryMetadata[(f.path || '').replace(/\\/g, '/').toLowerCase()];
        }).length;
        var activeClass = activeFolder === folder.path ? ' furat-folder-card-v2--active' : '';
        var badge = totalInFolder > 0
            ? (withMeta > 0
                ? '<span class="furat-folder-card-v2__badge furat-folder-card-v2__badge--with-meta" title="Reportes con metadata para análisis"><i class="fas fa-chart-pie"></i> ' + withMeta + ' con análisis</span>'
                : '<span class="furat-folder-card-v2__badge furat-folder-card-v2__badge--no-meta" title="Sin metadata todavía">Sin metadata</span>')
            : '<span class="furat-folder-card-v2__badge furat-folder-card-v2__badge--no-meta">Vacía</span>';

        return '<button class="furat-folder-card-v2' + activeClass + '" data-path="' + escapeHtml(folder.path) + '" data-name="' + escapeHtml(folder.name) + '" data-count="' + (folder.count || totalInFolder || 0) + '" type="button">' +
            '  <div class="furat-folder-card-v2__icon"><i class="fas fa-folder" aria-hidden="true"></i></div>' +
            '  <div class="furat-folder-card-v2__year">' + escapeHtml(year) + '</div>' +
            '  <div class="furat-folder-card-v2__name">' + escapeHtml(folder.name) + '</div>' +
            '  <div class="furat-folder-card-v2__count"><strong>' + (folder.count || totalInFolder || 0) + '</strong> reporte' + ((folder.count || totalInFolder || 0) === 1 ? '' : 's') + '</div>' +
            badge +
            '</button>';
    }).join('');
}

function renderLibraryDocuments() {
    var container = document.getElementById('documentList');
    var counter = document.getElementById('docsCount');
    if (!container) return;

    // Normalizar rutas para comparación
    var normalizePath = function (p) { return p ? p.replace(/\\/g, '/').toLowerCase() : null; };
    var activeFolderNormalized = normalizePath(activeFolder);

    var filesToShow = activeFolder
        ? filteredFiles.filter(function (f) { return normalizePath(f.folderPath) === activeFolderNormalized; })
        : filteredFiles;

    if (counter) counter.textContent = filesToShow.length + ' archivo' + (filesToShow.length === 1 ? '' : 's');

    // Empty states
    if (filesToShow.length === 0) {
        if (activeFolder) {
            container.innerHTML = '<div class="furat-empty-state-library">' +
                '<div class="furat-empty-state-library__icon"><i class="fas fa-folder-open" aria-hidden="true"></i></div>' +
                '<h3>No hay reportes en esta carpeta</h3>' +
                '<p>Arrastrá un PDF a la drop zone de arriba para subir el primer FURAT acá.</p>' +
                '</div>';
        } else {
            container.innerHTML = '<div class="furat-empty-state-library">' +
                '<div class="furat-empty-state-library__icon"><i class="fas fa-search" aria-hidden="true"></i></div>' +
                '<h3>No se encontraron reportes</h3>' +
                '<p>Probá cambiar el filtro de año o limpiar la búsqueda.</p>' +
                '</div>';
        }
        return;
    }

    // Tabla enterprise
    var rows = filesToShow.map(function (file) {
        var fileKey = (file.path || '').replace(/\\/g, '/').toLowerCase();
        var meta = libraryMetadata[fileKey] || null;
        var ext = (file.icon || 'pdf');
        var iconClass = ext === 'excel' ? 'fur-table__file-icon--excel'
                      : ext === 'word' ? 'fur-table__file-icon--word'
                      : ext === 'pdf' ? 'fur-table__file-icon--pdf'
                      : 'fur-table__file-icon--other';
        var iconTag = ext === 'excel' ? 'fa-file-excel'
                    : ext === 'word' ? 'fa-file-word'
                    : 'fa-file-pdf';
        var sizeStr = file.size || '';
        var modifiedStr = file.date || '—';
        // Mostrar fecha del accidente si hay metadata, sino la fecha de modificación
        var accidentDateStr = meta && meta.accident_date
            ? formatAccidentDate(meta.accident_date)
            : null;
        var dateCell = accidentDateStr
            ? '<span title="Fecha del accidente">' + escapeHtml(accidentDateStr) + '</span>'
            : '<span class="furat-table__date">' + escapeHtml(modifiedStr) + '</span>';
        // Tipo con icono
        var typeCell = meta && meta.accident_type
            ? '<span class="furat-table__type"><i class="fas ' + getTypeIcon(meta.accident_type) + '"></i> ' + escapeHtml(translateAccidentType(meta.accident_type)) + '</span>'
            : '<span class="furat-table__type" style="opacity:0.5;">—</span>';
        // Gravedad
        var severityCell = meta && meta.severity
            ? '<span class="furat-table__severity furat-table__severity--' + escapeHtml(meta.severity) + '">' + escapeHtml(translateSeverity(meta.severity)) + '</span>'
            : '<span class="furat-table__severity furat-table__severity--no-meta">Sin metadata</span>';
        // Área
        var areaCell = meta && meta.area
            ? '<span>' + escapeHtml(meta.area) + '</span>'
            : '<span style="opacity:0.5;">—</span>';

        return '<tr data-path="' + escapeHtml(file.path) + '">' +
            '<td><div class="furat-table__name">' +
                '<span class="furat-table__file-icon ' + iconClass + '"><i class="fas ' + iconTag + '"></i></span>' +
                '<span class="furat-table__name-text" title="' + escapeHtml(file.name) + '">' + escapeHtml(file.name) + '</span>' +
                '</div></td>' +
            '<td>' + typeCell + '</td>' +
            '<td>' + severityCell + '</td>' +
            '<td>' + areaCell + '</td>' +
            '<td>' + dateCell + '</td>' +
            '<td><div class="furat-table__actions">' +
                '<button class="furat-table__action-btn" data-action="view" title="Ver reporte"><i class="fas fa-eye"></i></button>' +
                '<button class="furat-table__action-btn" data-action="download" title="Descargar"><i class="fas fa-download"></i></button>' +
                '</div></td>' +
            '</tr>';
    }).join('');

    container.innerHTML = '<table class="furat-table">' +
        '<thead><tr>' +
            '<th>Reporte</th>' +
            '<th>Tipo</th>' +
            '<th>Gravedad</th>' +
            '<th>Área</th>' +
            '<th>Fecha</th>' +
            '<th style="text-align:right;">Acciones</th>' +
            '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '</table>';

    // Actualizar counter
    updateResultsCounter();
}

// Helpers de traducción
function translateAccidentType(type) {
    var TYPES = {
        caida: 'Caída', golpe: 'Golpe', atrapamiento: 'Atrapamiento',
        corte: 'Corte/Herida', quemadura: 'Quemadura', esfuerzo: 'Esfuerzo físico',
        exposicion: 'Exposición', otro: 'Otro'
    };
    return TYPES[type] || type;
}
function translateSeverity(sev) {
    var SEVS = { leve: 'Leve', moderado: 'Moderado', grave: 'Grave', mortal: 'Mortal' };
    return SEVS[sev] || sev;
}
function getTypeIcon(type) {
    var ICONS = {
        caida: 'fa-person-falling',
        golpe: 'fa-hand-fist',
        atrapamiento: 'fa-compress',
        corte: 'fa-scissors',
        quemadura: 'fa-fire',
        esfuerzo: 'fa-dumbbell',
        exposicion: 'fa-flask',
        otro: 'fa-circle-exclamation'
    };
    return ICONS[type] || 'fa-circle-exclamation';
}
function formatAccidentDate(iso) {
    if (!iso) return '';
    var parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
}

async function selectFolder(path) {
    console.log(`[FURAT] Selecting folder: ${path}`);
    // Asegurarnos de estar en la vista de biblioteca
    if (currentView !== 'library') {
        switchView('library');
    }
    activeFolder = path;
    toggleDocumentsHeaderCard();
    renderLibraryBreadcrumb();
    renderLibraryFolders();
    renderLibraryDocuments();
}

async function navigateToPath(path) {
    console.log(`[FURAT] Navigating to path: ${path}`);
    activeFolder = path || null;
    toggleDocumentsHeaderCard();
    renderLibraryBreadcrumb();
    renderLibraryFolders();
    renderLibraryDocuments();
}

// 📦668 — Mostrar/ocultar el header card (breadcrumb + toolbar) según folder activa.
// En la raíz se oculta. En una carpeta se muestra.
// Además, oculta el toolbar de la biblioteca (con drop zone + título) en carpetas,
// porque en una carpeta no se ven las folder cards ni la drop zone superior.
function toggleDocumentsHeaderCard() {
    var card = document.getElementById('documentsHeaderCard');
    if (card) card.hidden = !activeFolder;

    var libraryToolbar = document.getElementById('libraryToolbar');
    if (libraryToolbar) libraryToolbar.hidden = !!activeFolder;
}

// ═══════════════════════════════════════════════════════
// DOCUMENT VIEWER — 📦686 — Migrado al kair-fv-modal (Bandeja Integrada)
// Mismo modal/estilos/lógica que el preview de adjuntos del correo.
// Soporta PDF, Office (xlsx/docx), imágenes, etc. con toolbar/zoom/search.
// ═══════════════════════════════════════════════════════

let _fvCurrentUrl = null;

async function selectDocument(filePath) {
    console.log(`[FURAT] Selecting document: ${filePath}`);
    currentDocument = { path: filePath };
    await openFuratPreview(filePath);
}

// ─── File viewer helpers (mismo patrón que Bandeja Integrada) ───
function _fvFormatBytes(n) {
    if (!n || n < 0) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function _fvShowError(msg) {
    const body = document.getElementById('fv-body');
    if (!body) return;
    body.querySelectorAll('.kair-fv-loading,.kair-fv-error').forEach(function (el) { el.remove(); });
    const div = document.createElement('div');
    div.className = 'kair-fv-error';
    div.innerHTML = '<p>' + msg + '</p>';
    body.appendChild(div);
}

function _fvShowLoading(text) {
    const body = document.getElementById('fv-body');
    if (!body) return;
    body.querySelectorAll('.kair-fv-loading,.kair-fv-error').forEach(function (el) { el.remove(); });
    const div = document.createElement('div');
    div.className = 'kair-fv-loading';
    div.id = 'fv-loading';
    div.innerHTML = '<div class="kair-fv-spinner"></div><p>' + (text || 'Cargando…') + '</p>';
    body.appendChild(div);
}

function closeFuratPreview() {
    const overlay = document.getElementById('fv-overlay');
    if (overlay) overlay.setAttribute('hidden', '');
    const body = document.getElementById('fv-body');
    if (body) {
        body.querySelectorAll('flyfish-file-viewer').forEach(function (el) {
            try { if (typeof el.unload === 'function') el.unload(); } catch (_) {}
            el.remove();
        });
        body.querySelectorAll('.kair-fv-loading,.kair-fv-error').forEach(function (el) { el.remove(); });
    }
    if (_fvCurrentUrl) {
        try { URL.revokeObjectURL(_fvCurrentUrl); } catch (_) {}
        _fvCurrentUrl = null;
    }
}

// ─── Apertura del preview: usa los mismos IPC handlers que ya existían
//      (get-pdf-preview / get-excel-preview / get-word-preview) y monta
//      el file-viewer vía window.kairFV.mountInContainer (mismo flujo
//      que la Bandeja Integrada). ───
async function openFuratPreview(filePath) {
    const overlay = document.getElementById('fv-overlay');
    const body    = document.getElementById('fv-body');
    if (!overlay || !body) {
        showNotification('Modal de preview no disponible', 'error');
        return;
    }

    const fileName  = filePath.replace(/\\/g, '/').split('/').pop();
    const extension = (fileName.split('.').pop() || '').toLowerCase();

    // Mostrar modal con metadata
    overlay.removeAttribute('hidden');
    const titleEl = document.getElementById('fv-filename');
    const sizeEl  = document.getElementById('fv-filesize');
    const badge   = document.getElementById('fv-ext-badge');
    if (titleEl) titleEl.textContent = fileName;
    if (badge)   { badge.textContent = extension.toUpperCase() || '…'; badge.setAttribute('data-ext', extension); }
    if (sizeEl)  sizeEl.textContent  = '…';

    _fvShowLoading('Cargando ' + fileName + '…');

    // Limpiar viewer previo
    body.querySelectorAll('flyfish-file-viewer').forEach(function (el) { el.remove(); });
    if (_fvCurrentUrl) { try { URL.revokeObjectURL(_fvCurrentUrl); } catch (_) {} _fvCurrentUrl = null; }

    try {
        // Determinar handler según extensión
        let result;
        if (extension === 'pdf') {
            result = await callParentAPI('get-pdf-preview', { filePath });
        } else if (['xls', 'xlsx'].includes(extension)) {
            result = await callParentAPI('get-excel-preview', { filePath });
        } else if (['doc', 'docx'].includes(extension)) {
            result = await callParentAPI('get-word-preview', { filePath });
        } else {
            // Otros formatos: intentar lectura directa de bytes
            result = await callParentAPI('read-file-bytes', { filePath });
        }

        if (!result || !result.success) {
            throw new Error((result && result.error) || 'Error al cargar el documento');
        }

        // Normalizar a { bytes, name, ext, size, mimeType }
        let bytes, mimeType, size;
        if (result.data && result.data.bytes) {
            // Modo file-viewer: ya viene con bytes crudos
            if (result.data.bytes instanceof Uint8Array) {
                bytes = result.data.bytes;
            } else if (Array.isArray(result.data.bytes)) {
                bytes = new Uint8Array(result.data.bytes);
            } else {
                bytes = new Uint8Array(result.data.bytes);
            }
            mimeType = result.data.mimeType || _guessMimeType(extension);
            size = result.data.size || bytes.byteLength;
        } else if (typeof result.data === 'string') {
            // Modo legacy: base64
            const binary = atob(result.data);
            bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            mimeType = 'application/pdf';
            size = bytes.byteLength;
        } else {
            throw new Error('Formato de respuesta no soportado');
        }

        if (sizeEl) sizeEl.textContent = _fvFormatBytes(size);

        // Quitar loading
        body.querySelectorAll('.kair-fv-loading,.kair-fv-error').forEach(function (el) { el.remove(); });

        // Montar el file-viewer con el mismo patrón de Bandeja Integrada
        if (window.kairFV && typeof window.kairFV.mountInContainer === 'function') {
            const mountData = {
                bytes: bytes,
                name: fileName,
                ext: extension,
                size: size,
                mimeType: mimeType
            };
            const mount = window.kairFV.mountInContainer(body, mountData);
            if (mount && mount.url) _fvCurrentUrl = mount.url;
            console.log('[FURAT] File-viewer montado:', fileName, '(' + _fvFormatBytes(size) + ', .' + extension + ')');
        } else {
            // Fallback: iframe con blob URL
            const blob = new Blob([bytes], { type: mimeType });
            const blobUrl = URL.createObjectURL(blob);
            _fvCurrentUrl = blobUrl;
            const iframe = document.createElement('iframe');
            iframe.src = blobUrl;
            iframe.style.cssText = 'width:100%;height:100%;border:none;';
            body.appendChild(iframe);
            console.warn('[FURAT] kairFV no disponible — fallback iframe');
        }
    } catch (error) {
        console.error('[FURAT] Error loading document:', error);
        showFuratPreviewError(body, error.message, filePath);
    }
}

function _guessMimeType(ext) {
    const map = {
        pdf: 'application/pdf',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        txt: 'text/plain'
    };
    return map[ext] || 'application/octet-stream';
}

function showFuratPreviewError(body, message, filePath) {
    const isPywin32    = /pywin32|win32com|pip install/i.test(message);
    const isUnsupported = /no soportado|no preview|preview.*no.*disponible/i.test(message);

    let iconHtml = '<i class="fas fa-exclamation-triangle" style="color:#b91c1c;font-size:2.5rem;"></i>';
    let title    = 'Error al cargar el documento';
    let detail   = '<p>' + message + '</p>';
    let extraBtn = '';

    if (isPywin32) {
        iconHtml = '<i class="fas fa-tools" style="color:#d97706;font-size:2.5rem;"></i>';
        title = 'Previsualización no disponible';
        detail = `
            <p>La conversión de archivos <strong>.doc/.docx</strong> requiere
            la librería <strong>pywin32</strong> de Python.</p>
            <code style="background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:8px 16px;font-family:monospace;font-size:.85rem;display:inline-block;margin:8px 0;">pip install pywin32</code>
            <p style="font-size:.8rem;color:#6b7280;">
                Ejecuta ese comando en la terminal con Python 3.13 y reinicia la aplicación.
            </p>`;
        extraBtn = '<button class="kair-fv-btn" id="modalOpenExtBtn" style="margin-top:10px;"><i class="fas fa-external-link-alt"></i> Abrir con aplicación externa</button>';
    } else if (isUnsupported) {
        iconHtml = '<i class="fas fa-file" style="color:#6b7280;font-size:2.5rem;"></i>';
        title = 'Formato no soportado';
        detail = '<p>Este tipo de archivo no puede previsualizarse. Puedes abrirlo con una aplicación externa.</p>';
        extraBtn = '<button class="kair-fv-btn" id="modalOpenExtBtn" style="margin-top:10px;"><i class="fas fa-external-link-alt"></i> Abrir externamente</button>';
    }

    body.innerHTML = `
        <div style="text-align:center;padding:2.5rem 2rem;">
            <div style="margin-bottom:1rem;">${iconHtml}</div>
            <h3 style="margin:0 0 .5rem;font-size:1.1rem;color:#1f2937;">${title}</h3>
            ${detail}
            ${extraBtn}
        </div>`;

    if (extraBtn && filePath) {
        const btn = document.getElementById('modalOpenExtBtn');
        if (btn) {
            btn.addEventListener('click', async () => {
                try {
                    await callParentAPI('open-path', filePath);
                    showNotification('Abriendo archivo con aplicación externa...', 'success');
                } catch (e) {
                    showNotification('No se pudo abrir el archivo externamente', 'error');
                }
            });
        }
    }
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

// 📦676 — MIGRACIÓN a KAIRToast (sistema moderno unificado de toda la app).
// Antes: showNotification usaba un toast custom con CSS propio (.furat-notification).
// Ahora: wrapper que delega en window.KAIRToast.show() (assets/js/kair-toast.js).
// Mismo patrón que evaluacion-inicial-sg-sst.js y los demás módulos.
// Fallback defensivo: si KAIRToast no está disponible (ej: orden de carga raro),
// se usa console.error para no perder el mensaje silenciosamente.
function showNotification(message, type = 'info', opts) {
    if (typeof window.KAIRToast === 'object' && typeof window.KAIRToast.show === 'function') {
        // KAIRToast acepta 'success' | 'error' | 'warning' | 'info' | 'danger'
        window.KAIRToast.show(message, type, opts);
        return;
    }
    // Fallback
    console.warn('[FURAT][showNotification fallback] ' + type + ': ' + message);
}

// getNotificationIcon ya no se necesita (KAIRToast maneja los íconos).

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

// ═══════════════════════════════════════════════════════
// 📦658 — UPLOAD DE FURAT (drag & drop + modal con metadata)
// ═══════════════════════════════════════════════════════

const ALLOWED_UPLOAD_EXT = ['.pdf', '.xls', '.xlsx', '.doc', '.docx'];
const ALLOWED_UPLOAD_MIMES = [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const MAX_UPLOAD_SIZE = 25 * 1024 * 1024; // 25 MB

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function setupDropZone() {
    var dropZone = document.getElementById('dropZone');
    var dropzoneLink = document.getElementById('dropzoneLink');
    if (!dropZone) return;

    // Click en la dropzone (o el link) → abrir file picker
    function openFilePicker(e) {
        if (e) e.stopPropagation();
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.xls,.xlsx,.doc,.docx';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', function () {
            if (input.files && input.files[0]) handleFileSelected(input.files[0]);
            input.remove();
        });
        input.click();
    }
    dropZone.addEventListener('click', openFilePicker);
    if (dropzoneLink) dropzoneLink.addEventListener('click', openFilePicker);

    // Drag & drop
    var dragCounter = 0; // Para detectar dragenter/leave en hijos
    function isFileDrag(e) {
        return e.dataTransfer && e.dataTransfer.types &&
               Array.from(e.dataTransfer.types).indexOf('Files') !== -1;
    }
    dropZone.addEventListener('dragenter', function (e) {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        dragCounter++;
        dropZone.classList.add('furat-dropzone--dragover');
    });
    dropZone.addEventListener('dragover', function (e) {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    dropZone.addEventListener('dragleave', function (e) {
        if (!isFileDrag(e)) return;
        dragCounter = Math.max(0, dragCounter - 1);
        if (dragCounter === 0) dropZone.classList.remove('furat-dropzone--dragover');
    });
    dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        dragCounter = 0;
        dropZone.classList.remove('furat-dropzone--dragover');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelected(e.dataTransfer.files[0]);
        }
    });

    // Keyboard: Enter o Space → abrir file picker
    dropZone.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openFilePicker();
        }
    });
}

// 📦670 — Drop zone aparece SOLO cuando se arrastra un archivo sobre una folder card.
// Al hacer dragenter/dragover sobre una card, la dropzone se posiciona encima de esa card
// con fondo opaco (azul claro) para tapar la card destino y confirmar visualmente
// a qué carpeta va el FURAT. Al salir (dragleave) o soltar (drop), se oculta.
function setupCardDropzone() {
    var dropZone = document.getElementById('dropZone');
    var foldersGrid = document.getElementById('folderList');
    if (!dropZone || !foldersGrid) return;

    var currentCard = null;
    var dragCounter = 0;
    var titleEl = dropZone.querySelector('.furat-dropzone__title');
    var subtitleEl = dropZone.querySelector('.furat-dropzone__subtitle');
    var defaultTitle = titleEl ? titleEl.textContent : '';
    var defaultSubtitle = subtitleEl ? subtitleEl.textContent : '';

    function isFileDrag(e) {
        return e.dataTransfer && e.dataTransfer.types &&
               Array.from(e.dataTransfer.types).indexOf('Files') !== -1;
    }

    function showOnCard(card) {
        if (!card) return;
        // 📦681 — FIX: usar getBoundingClientRect() y restar el rect del offsetParent
        // REAL de la dropzone (no del grid). Antes usaba card.offsetTop relativo
        // al GRID, pero la dropzone es sibling del grid (hija de .furat-card__body),
        // así que su offsetParent es .furat-card__body. Con la resta cardOffset - bodyOffset
        // obtenemos la posición correcta que se interpreta relativo a su offsetParent.
        var cardRect = card.getBoundingClientRect();
        var dropzoneParent = dropZone.offsetParent || document.body;
        var parentRect = dropzoneParent.getBoundingClientRect();
        var top = Math.round(cardRect.top - parentRect.top);
        var left = Math.round(cardRect.left - parentRect.left);
        var width = Math.round(cardRect.width);
        var height = Math.round(cardRect.height);
        var yearEl = card.querySelector('.furat-folder-card-v2__year');
        var year = yearEl ? yearEl.textContent.trim() : '?';
        dropZone.style.top = top + 'px';
        dropZone.style.left = left + 'px';
        dropZone.style.width = width + 'px';
        dropZone.style.height = height + 'px';
        // Loggear solo cuando cambia la card destino (no en cada dragover)
        if (card !== currentCard) {
            var idx = Array.prototype.indexOf.call(foldersGrid.children, card);
            console.log(
                '[FURAT][dropzone] CAMBIO card=' + year +
                ' (idx=' + idx + ')' +
                ' | card rect.top=' + Math.round(cardRect.top) + ' rect.left=' + Math.round(cardRect.left) +
                ' rect.width=' + Math.round(cardRect.width) + ' rect.height=' + Math.round(cardRect.height) +
                ' | dropzone top=' + top + ' left=' + left + ' w=' + width + ' h=' + height +
                ' | parentOffsetTop=' + Math.round(parentRect.top) + ' parentOffsetLeft=' + Math.round(parentRect.left) +
                ' | dropzoneOffsetParent=' + (dropzoneParent.tagName + (dropzoneParent.id ? '#' + dropzoneParent.id : ''))
            );
        }
        if (titleEl) titleEl.textContent = year ? ('Soltá en ' + year) : 'Soltá acá';
        if (subtitleEl) subtitleEl.textContent = '';
        currentCard = card;
        dropZone.classList.add('furat-dropzone--visible');
    }

    function hide() {
        dropZone.classList.remove('furat-dropzone--visible');
        currentCard = null;
        if (titleEl) titleEl.textContent = defaultTitle;
        if (subtitleEl) subtitleEl.textContent = defaultSubtitle;
    }

    foldersGrid.addEventListener('dragenter', function (e) {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        dragCounter++;
        var card = e.target.closest('.furat-folder-card-v2');
        if (dragCounter === 1) console.log('[FURAT][dropzone] dragenter (counter=' + dragCounter + ')');
        if (card) showOnCard(card);
        else console.log('[FURAT][dropzone] dragenter: target=' + (e.target.tagName + (e.target.className ? '.' + e.target.className.split(' ').join('.') : '')) + ' (NO card detectada)');
    });

    foldersGrid.addEventListener('dragover', function (e) {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        // SIEMPRE actualizar la posición (sin condición de card diferente) para
        // garantizar alineación perfecta en cada frame, sin desfases.
        var card = e.target.closest('.furat-folder-card-v2');
        if (card) showOnCard(card);
    });

    foldersGrid.addEventListener('dragleave', function (e) {
        if (!isFileDrag(e)) return;
        dragCounter = Math.max(0, dragCounter - 1);
        if (dragCounter === 0) {
            console.log('[FURAT][dropzone] dragleave (counter=0) → hide');
            hide();
        }
    });

    foldersGrid.addEventListener('drop', function (e) {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        dragCounter = 0;
        console.log('[FURAT][dropzone] drop en card=' + (currentCard ? currentCard.querySelector('.furat-folder-card-v2__year').textContent : '?'));
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelected(e.dataTransfer.files[0]);
        }
        hide();
    });
}

function setupUploadModal() {
    var modal = document.getElementById('uploadModal');
    var overlay = document.getElementById('uploadModalOverlay');
    var closeBtn = document.getElementById('uploadModalClose');
    var cancelBtn = document.getElementById('uploadModalCancel');
    var submitBtn = document.getElementById('uploadModalSubmit');
    var removeFileBtn = document.getElementById('uploadFileRemove');
    var form = document.getElementById('uploadForm');
    if (!modal) return;

    function closeModal() {
        modal.classList.add('hidden');
        uploadState.modalOpen = false;
        // Reset form
        if (form) form.reset();
        resetUploadState();
    }

    if (overlay) overlay.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (removeFileBtn) removeFileBtn.addEventListener('click', resetUploadState);

    // Escape cierra el modal
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && uploadState.modalOpen) closeModal();
    });

    // Validación reactiva: habilitar submit solo si archivo + form OK
    if (form) {
        form.addEventListener('input', updateSubmitButtonState);
        form.addEventListener('change', updateSubmitButtonState);
    }
    if (submitBtn) submitBtn.addEventListener('click', submitUpload);
}

function resetUploadState() {
    uploadState.file = null;
    uploadState.fileBase64 = null;
    uploadState.fileExt = '';
    uploadState.fileType = '';
    uploadState.fileSize = 0;
    var preview = document.getElementById('uploadFilePreview');
    if (preview) preview.hidden = true;
    updateSubmitButtonState();
}

function handleFileSelected(file) {
    // Validar tipo
    var ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    var typeOk = ALLOWED_UPLOAD_EXT.indexOf(ext) !== -1 ||
                 (file.type && ALLOWED_UPLOAD_MIMES.indexOf(file.type) !== -1);
    if (!typeOk) {
        showNotification('Tipo de archivo no permitido. Solo se aceptan PDF, Excel y Word.', 'error');
        return;
    }
    // Validar tamaño
    if (file.size > MAX_UPLOAD_SIZE) {
        showNotification('El archivo excede el tamaño máximo permitido (25 MB).', 'error');
        return;
    }

    // Leer como base64
    var reader = new FileReader();
    reader.onload = function (e) {
        var dataUrl = e.target.result;
        // dataUrl es algo como "data:application/pdf;base64,JVBERi0xLjQKJ..."
        var base64 = dataUrl.split(',')[1] || dataUrl;
        uploadState.file = file;
        uploadState.fileBase64 = base64;
        uploadState.fileExt = ext;
        uploadState.fileType = file.type || '';
        uploadState.fileSize = file.size;
        renderUploadFilePreview();
        // Si el modal no está abierto, abrirlo
        if (!uploadState.modalOpen) openUploadModal();
    };
    reader.onerror = function () {
        showNotification('No se pudo leer el archivo', 'error');
    };
    reader.readAsDataURL(file);
}

function renderUploadFilePreview() {
    var preview = document.getElementById('uploadFilePreview');
    var nameEl = document.getElementById('uploadFileName');
    var metaEl = document.getElementById('uploadFileMeta');
    var iconEl = document.getElementById('uploadFileIcon');
    if (!preview || !nameEl || !metaEl) return;

    nameEl.textContent = uploadState.file ? uploadState.file.name : '';
    metaEl.textContent = formatBytes(uploadState.fileSize);

    // Color del icono según tipo
    if (iconEl) {
        iconEl.className = 'furat-modal__file-icon';
        if (uploadState.fileExt === '.pdf') iconEl.classList.add('furat-modal__file-icon--pdf');
        else if (uploadState.fileExt === '.xls' || uploadState.fileExt === '.xlsx') iconEl.classList.add('furat-modal__file-icon--excel');
        else if (uploadState.fileExt === '.doc' || uploadState.fileExt === '.docx') iconEl.classList.add('furat-modal__file-icon--word');
        var icon = iconEl.querySelector('i');
        if (icon) {
            icon.className = uploadState.fileExt === '.pdf' ? 'fas fa-file-pdf'
                          : (uploadState.fileExt === '.xls' || uploadState.fileExt === '.xlsx') ? 'fas fa-file-excel'
                          : (uploadState.fileExt === '.doc' || uploadState.fileExt === '.docx') ? 'fas fa-file-word'
                          : 'fas fa-file';
        }
    }
    preview.hidden = false;
    updateSubmitButtonState();
}

// ═══════════════════════════════════════════════════════
// 📦680 — MODAL "CREAR NUEVA CARPETA" (período)
// ═══════════════════════════════════════════════════════

// 📦692 — Context menu de carpetas (click derecho)
// Patrón similar a 1.1.1 responsable-sg: context menu con show/hide via class
// + position absolute via style.left/top + click outside para cerrar.
var folderContextMenuTarget = null; // { name, path, count }

function showFolderContextMenu(x, y, folder) {
    var menu = document.getElementById('folderContextMenu');
    if (!menu) return;
    folderContextMenuTarget = folder;
    var nameEl = document.getElementById('folderContextMenuName');
    if (nameEl) nameEl.textContent = folder.name;
    menu.classList.add('is-visible');
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    // Ajuste si se sale de pantalla
    setTimeout(function () {
        var rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
        }
    }, 0);
}

function hideFolderContextMenu() {
    var menu = document.getElementById('folderContextMenu');
    if (menu) menu.classList.remove('is-visible');
    folderContextMenuTarget = null;
}

function setupFolderContextMenuHandlers() {
    var addBtn = document.getElementById('folderContextMenuAdd');
    var openBtn = document.getElementById('folderContextMenuOpen');
    var deleteBtn = document.getElementById('folderContextMenuDelete');

    if (addBtn) {
        addBtn.addEventListener('click', function () {
            var target = folderContextMenuTarget;
            hideFolderContextMenu();
            if (!target) return;
            // Setear activeFolder al target (sin disparar loadLibrary) y abrir modal
            activeFolder = target.path;
            // Re-renderizar el breadcrumb para que muestre el contexto
            renderLibraryBreadcrumb();
            renderLibraryFolders();
            renderLibraryDocuments();
            openCreateFolderModal();
        });
    }
    if (openBtn) {
        openBtn.addEventListener('click', function () {
            var target = folderContextMenuTarget;
            hideFolderContextMenu();
            if (!target) return;
            // Abrir carpeta con la app predeterminada (explorador de Windows)
            callParentAPI('open-path', { path: target.path }).catch(function (err) {
                console.warn('[FURAT] open-path error:', err);
            });
        });
    }
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function () {
            var target = folderContextMenuTarget;
            hideFolderContextMenu();
            if (!target) return;
            openDeleteFolderModal(target);
        });
    }
}

// 📦692 — Modal de confirmación para eliminar carpeta
function setupDeleteFolderModal() {
    var closeBtn = document.getElementById('deleteFolderModalClose');
    var cancelBtn = document.getElementById('deleteFolderModalCancel');
    var submitBtn = document.getElementById('deleteFolderModalSubmit');
    var overlay = document.getElementById('deleteFolderModalOverlay');
    if (closeBtn) closeBtn.addEventListener('click', closeDeleteFolderModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteFolderModal);
    if (overlay) overlay.addEventListener('click', closeDeleteFolderModal);
    if (submitBtn) submitBtn.addEventListener('click', submitDeleteFolder);
}

var deleteFolderTarget = null; // { name, path }

function openDeleteFolderModal(folder) {
    var modal = document.getElementById('deleteFolderModal');
    var nameEl = document.getElementById('deleteFolderName');
    var countEl = document.getElementById('deleteFolderFileCount');
    if (!modal) return;
    deleteFolderTarget = folder;
    if (nameEl) nameEl.textContent = folder.name;
    if (countEl) countEl.textContent = folder.count || 0;
    modal.classList.remove('hidden');
}

function closeDeleteFolderModal() {
    var modal = document.getElementById('deleteFolderModal');
    if (modal) modal.classList.add('hidden');
    deleteFolderTarget = null;
}

async function submitDeleteFolder() {
    var submitBtn = document.getElementById('deleteFolderModalSubmit');
    var target = deleteFolderTarget;
    if (!target) return;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';
    }
    try {
        // 📦692 — getModuleParams() lee company/module/submodule de la URL del iframe.
        // Es la forma estándar de obtener la empresa activa (la que el parent
        // renderer pasa al iframe cuando lo crea).
        var params = getModuleParams();
        var result = await callParentAPI('furat-delete-folder', {
            folderPath: target.path,
            companyName: params.companyName
        });
        if (result && result.success) {
            var metaCount = result.deletedMetadataRecords || 0;
            showNotification(
                'Carpeta "' + target.name + '" eliminada' +
                (metaCount > 0 ? ' (incluye ' + metaCount + ' registro(s) de metadata)' : ''),
                'success'
            );
            closeDeleteFolderModal();
            // Si la carpeta eliminada era la carpeta activa, navegar a la raíz
            if (activeFolder === target.path) {
                navigateToPath(null);
            }
            // Refrescar la biblioteca
            loadLibrary();
        } else {
            var msg = (result && result.error && result.error.message) || 'Error desconocido';
            showNotification('Error al eliminar: ' + msg, 'error');
        }
    } catch (e) {
        showNotification('Error al eliminar: ' + (e.message || 'desconocido'), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-trash-alt"></i><span> Eliminar definitivamente</span>';
        }
    }
}

// Helper: obtener el nombre de la empresa activa desde el iframe.
// (Ya no se usa, lo dejamos por compatibilidad. Usar getModuleParams().companyName)
function getActiveCompanyName() {
    if (typeof window !== 'undefined' && window.KairData && window.KairData.activeCompany) {
        return window.KairData.activeCompany;
    }
    var companyEl = document.querySelector('[data-company-name]');
    if (companyEl) return companyEl.getAttribute('data-company-name');
    if (typeof state !== 'undefined' && state.company) return state.company;
    return null;
}

// 📦693 — Modal de edición de metadata
var editMetadataTarget = null; // { name, path }

function setupEditMetadataModal() {
    var closeBtn = document.getElementById('editMetadataModalClose');
    var cancelBtn = document.getElementById('editMetadataModalCancel');
    var submitBtn = document.getElementById('editMetadataModalSubmit');
    var overlay = document.getElementById('editMetadataModalOverlay');
    if (closeBtn) closeBtn.addEventListener('click', closeEditMetadataModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeEditMetadataModal);
    if (overlay) overlay.addEventListener('click', closeEditMetadataModal);
    if (submitBtn) submitBtn.addEventListener('click', submitEditMetadata);
}

async function openEditMetadataModal(file) {
    var modal = document.getElementById('editMetadataModal');
    var nameEl = document.getElementById('editMetadataFileName');
    if (!modal) return;
    editMetadataTarget = file;
    if (nameEl) nameEl.textContent = file.name;

    // Limpiar campos antes de cargar
    document.getElementById('editMetadataAccidentDate').value = '';
    document.getElementById('editMetadataSeverity').value = '';
    document.getElementById('editMetadataAccidentType').value = '';
    document.getElementById('editMetadataArea').value = '';
    document.getElementById('editMetadataReportedBy').value = '';
    document.getElementById('editMetadataDescription').value = '';

    modal.classList.remove('hidden');

    // Cargar metadata existente (si hay) para pre-llenar el form
    try {
        var result = await callParentAPI('furat-get-metadata-for-file', file.path);
        if (result && result.metadata) {
            var m = result.metadata;
            if (m.accidentDate) document.getElementById('editMetadataAccidentDate').value = m.accidentDate;
            if (m.severity) document.getElementById('editMetadataSeverity').value = m.severity;
            if (m.accidentType) document.getElementById('editMetadataAccidentType').value = m.accidentType;
            if (m.area) document.getElementById('editMetadataArea').value = m.area;
            if (m.reportedBy) document.getElementById('editMetadataReportedBy').value = m.reportedBy;
            if (m.description) document.getElementById('editMetadataDescription').value = m.description;
        }
    } catch (e) {
        console.warn('[FURAT] No se pudo cargar metadata existente:', e.message);
    }
}

function closeEditMetadataModal() {
    var modal = document.getElementById('editMetadataModal');
    if (modal) modal.classList.add('hidden');
    editMetadataTarget = null;
}

async function submitEditMetadata() {
    var submitBtn = document.getElementById('editMetadataModalSubmit');
    var target = editMetadataTarget;
    if (!target) return;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    }
    try {
        var params = getModuleParams();
        var payload = {
            filePath: target.path,
            companyName: params.companyName,
            accidentDate: document.getElementById('editMetadataAccidentDate').value || null,
            accidentType: document.getElementById('editMetadataAccidentType').value || null,
            severity: document.getElementById('editMetadataSeverity').value || null,
            area: document.getElementById('editMetadataArea').value || null,
            reportedBy: document.getElementById('editMetadataReportedBy').value || null,
            description: document.getElementById('editMetadataDescription').value || null
        };
        var result = await callParentAPI('furat-upsert-metadata', payload);
        if (result && result.success) {
            showNotification('Metadata guardada para "' + target.name + '"', 'success');
            closeEditMetadataModal();
            // Refrescar la tabla de documentos + el dashboard
            loadLibrary();
            if (typeof loadDashboard === 'function') loadDashboard();
        } else {
            var msg = (result && result.error && result.error.message) || 'Error desconocido';
            showNotification('Error: ' + msg, 'error');
        }
    } catch (e) {
        showNotification('Error: ' + (e.message || 'desconocido'), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i><span> Guardar metadata</span>';
        }
    }
}

// 📦693 — Context menu para PDFs (click derecho en fila de la tabla)
var documentContextMenuTarget = null; // { name, path, hasMetadata }

function setupDocumentContextMenu() {
    var documentList = document.getElementById('documentList');
    if (!documentList) return;
    documentList.addEventListener('contextmenu', (e) => {
        var tr = e.target.closest('tr[data-path]');
        if (!tr) return;
        e.preventDefault();
        var file = {
            name: tr.dataset.path.split(/[\\/]/).pop(),
            path: tr.dataset.path
        };
        showDocumentContextMenu(e.clientX, e.clientY, file);
    });
    // Botones del menu
    var viewBtn = document.getElementById('documentContextMenuView');
    var editBtn = document.getElementById('documentContextMenuEdit');
    if (viewBtn) {
        viewBtn.addEventListener('click', function () {
            var target = documentContextMenuTarget;
            hideDocumentContextMenu();
            if (target) selectDocument(target.path);
        });
    }
    if (editBtn) {
        editBtn.addEventListener('click', function () {
            var target = documentContextMenuTarget;
            hideDocumentContextMenu();
            if (target) openEditMetadataModal(target);
        });
    }
    // Click fuera cierra
    document.addEventListener('click', (e) => {
        var menu = document.getElementById('documentContextMenu');
        if (menu && menu.classList.contains('is-visible') && !menu.contains(e.target)) {
            hideDocumentContextMenu();
        }
    });
}

function showDocumentContextMenu(x, y, file) {
    var menu = document.getElementById('documentContextMenu');
    if (!menu) return;
    documentContextMenuTarget = file;
    var nameEl = document.getElementById('documentContextMenuName');
    if (nameEl) nameEl.textContent = file.name;
    menu.classList.add('is-visible');
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    setTimeout(function () {
        var rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
        }
    }, 0);
}

function hideDocumentContextMenu() {
    var menu = document.getElementById('documentContextMenu');
    if (menu) menu.classList.remove('is-visible');
    documentContextMenuTarget = null;
}

function setupCreateFolderModal() {
    var addPeriodBtn = document.getElementById('addPeriodBtn');
    var modal = document.getElementById('createFolderModal');
    var overlay = document.getElementById('createFolderModalOverlay');
    var closeBtn = document.getElementById('createFolderModalClose');
    var cancelBtn = document.getElementById('createFolderModalCancel');
    var submitBtn = document.getElementById('createFolderModalSubmit');
    var input = document.getElementById('createFolderInput');

    if (addPeriodBtn) addPeriodBtn.addEventListener('click', openCreateFolderModal);
    if (closeBtn) closeBtn.addEventListener('click', closeCreateFolderModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeCreateFolderModal);
    if (overlay) overlay.addEventListener('click', closeCreateFolderModal);
    if (input) {
        input.addEventListener('input', function () {
            if (submitBtn) submitBtn.disabled = !input.value.trim();
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && input.value.trim()) {
                e.preventDefault();
                submitCreateFolder();
            }
        });
    }
    if (submitBtn) submitBtn.addEventListener('click', submitCreateFolder);
}

function openCreateFolderModal() {
    var modal = document.getElementById('createFolderModal');
    var input = document.getElementById('createFolderInput');
    var submitBtn = document.getElementById('createFolderModalSubmit');
    var contextEl = document.getElementById('createFolderContext');
    var parentNameEl = document.getElementById('createFolderParentName');
    if (!modal) return;
    modal.classList.remove('hidden');

    // 📦692 — Si hay activeFolder, mostrar el contexto "Se creará dentro de: X"
    // y guardar el parentPath para que submitCreateFolder lo use.
    if (contextEl && parentNameEl) {
        if (activeFolder) {
            var parentName = activeFolder.split(/[\\/]/).filter(Boolean).pop() || 'Carpeta';
            parentNameEl.textContent = parentName;
            contextEl.style.display = 'block';
        } else {
            contextEl.style.display = 'none';
        }
    }

    if (input) {
        input.value = '';
        setTimeout(function () { input.focus(); }, 50);
    }
    if (submitBtn) submitBtn.disabled = true;
}

function closeCreateFolderModal() {
    var modal = document.getElementById('createFolderModal');
    if (modal) modal.classList.add('hidden');
}

async function submitCreateFolder() {
    var input = document.getElementById('createFolderInput');
    var submitBtn = document.getElementById('createFolderModalSubmit');
    var name = input ? input.value.trim() : '';
    if (!name) return;

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';
    }

    try {
        // 📦692 — Determinar el parent path: si hay activeFolder, crear adentro.
        // Si no, crear en el submódulo raíz.
        var parentPath = activeFolder || deriveSubmodulePath();
        if (!parentPath) {
            // Si no hay folders todavía, cargar la library primero
            await loadLibrary();
            parentPath = activeFolder || deriveSubmodulePath();
        }
        if (!parentPath) {
            showNotification('No se pudo resolver la ruta del submódulo 3.2.1', 'error');
            return;
        }
        var result = await callParentAPI('furat-create-folder', {
            submodulePath: parentPath,
            folderName: name
        });
        if (result && result.success) {
            showNotification('Carpeta "' + name + '" creada correctamente', 'success');
            closeCreateFolderModal();
            // Refrescar la biblioteca
            if (currentView === 'library') {
                loadLibrary();
            } else {
                switchView('library');
            }
        } else {
            var msg = (result && result.error && result.error.message) || 'Error desconocido';
            showNotification('Error: ' + msg, 'error');
        }
    } catch (e) {
        showNotification('Error al crear carpeta: ' + (e.message || 'desconocido'), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-folder-plus"></i><span> Crear carpeta</span>';
        }
    }
}

// Helper: deduce el submodulePath (ruta al 3.2.1) del path del primer folder.
// El backend (get-document-folders) retorna cada folder con su path completo.
// El path del folder raíz incluye el submodulePath como prefijo, así que
// podemos derivarlo eliminando el último segmento del path.
function deriveSubmodulePath() {
    if (!allFolders || allFolders.length === 0) return null;
    var firstPath = allFolders[0].path;
    if (!firstPath) return null;
    // El path termina con el nombre del folder (ej: "2017"). Eliminamos ese último segmento.
    var sep = firstPath.indexOf('\\') >= 0 ? '\\' : '/';
    var parts = firstPath.split(sep);
    parts.pop(); // eliminar nombre del folder
    return parts.join(sep);
}

function openUploadModal() {
    var modal = document.getElementById('uploadModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    uploadState.modalOpen = true;
    renderUploadFilePreview();
    updateSubmitButtonState();
    // Focus en el primer input
    setTimeout(function () {
        var firstInput = document.getElementById('uploadAccidentDate');
        if (firstInput) firstInput.focus();
    }, 50);
}

function updateSubmitButtonState() {
    var submitBtn = document.getElementById('uploadModalSubmit');
    if (!submitBtn) return;
    var hasFile = !!uploadState.fileBase64;
    var form = document.getElementById('uploadForm');
    var formValid = form ? form.checkValidity() : false;
    submitBtn.disabled = !(hasFile && formValid);
}

function submitUpload() {
    var form = document.getElementById('uploadForm');
    if (!form) return;
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    if (!uploadState.fileBase64) {
        showNotification('Adjuntá un archivo antes de subir', 'warning');
        return;
    }

    var formData = new FormData(form);
    var severityEl = form.querySelector('input[name="severity"]:checked');
    var params = getModuleParams();
    var payload = {
        companyName: params.companyName,
        moduleName: params.moduleName,
        submoduleName: params.submoduleName,
        file: {
            name: uploadState.file ? uploadState.file.name : '',
            type: uploadState.fileType,
            size: uploadState.fileSize,
            data: uploadState.fileBase64
        },
        metadata: {
            accidentDate: formData.get('accidentDate') || null,
            accidentType: formData.get('accidentType') || null,
            severity: severityEl ? severityEl.value : null,
            area: (formData.get('area') || '').toString().trim() || null,
            description: (formData.get('description') || '').toString().trim() || null,
            reportedBy: (formData.get('reportedBy') || '').toString().trim() || null
        }
    };

    var submitBtn = document.getElementById('uploadModalSubmit');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.querySelector('span').textContent = 'Subiendo...';
    }

    callParentAPI('furat-upload-file', payload)
        .then(function (result) {
            showNotification('FURAT subido correctamente: ' + (result.file ? result.file.name : ''), 'success');
            // Cerrar modal
            var modal = document.getElementById('uploadModal');
            if (modal) modal.classList.add('hidden');
            uploadState.modalOpen = false;
            if (form) form.reset();
            resetUploadState();
            // Refrescar dashboard + biblioteca
            if (currentView === 'dashboard') loadDashboard();
            else loadLibrary();
            // 📦659 — Refrescar analytics también (puede que el user esté en Biblioteca
            // y vaya a Resumen, queremos que vea los nuevos datos)
            loadAnalytics();
        })
        .catch(function (error) {
            console.error('[FURAT] Upload error:', error);
            showNotification('Error al subir: ' + (error.message || 'desconocido'), 'error');
        })
        .finally(function () {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.querySelector('span').textContent = 'Subir FURAT';
            }
            updateSubmitButtonState();
        });
}
