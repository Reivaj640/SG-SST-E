/**
 * restricciones-viewer.js — Modern Viewer for Remisiones Médicas (3.1.6)
 * Patrón: año agrupado con acordeón, búsqueda, filtros, preview modal.
 * Mantiene contratos: callParentAPI, get-document-folders, get-documents-in-folder,
 *                      get-pdf-preview, get-excel-preview, get-word-preview,
 *                      download-document, open-path, back-to-module-request
 */

(function () {
    'use strict';

    /* ═══════════════════════════════════════════════
       CALL PARENT API — bridge via component.js
       El component bridge usa `action` + responde con
       `{ action: 'xxx-response', requestId, success, data, error }`
       ═══════════════════════════════════════════════ */
    function callParentAPI(type, payload) {
        return new Promise(function (resolve, reject) {
            var requestId = 'rm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            var timeout = setTimeout(function () {
                window.removeEventListener('message', handleResponse);
                reject(new Error('Timeout esperando respuesta: ' + type));
            }, 15000);

            function handleResponse(event) {
                var response = event.data;
                if (response && response.requestId === requestId && response.action === (type + '-response')) {
                    clearTimeout(timeout);
                    window.removeEventListener('message', handleResponse);
                    if (response.success) {
                        resolve({ success: true, data: response.data, error: response.error });
                    } else {
                        reject(new Error(response.error || 'Error desconocido'));
                    }
                }
            }
            window.addEventListener('message', handleResponse);
            window.parent.postMessage({ action: type + '-request', requestId: requestId, payload: payload }, '*');
        });
    }

    /* ═══════════════════════════════════════════════
       STATE
       ═══════════════════════════════════════════════ */
    var allFolders = [];
    var allDocuments = [];   // { name, path, extension, size, folderPath, year }
    var currentFilter = 'all';
    var currentSearch = '';
    var currentDocPath = null; // document selected for preview/download

    /* ═══════════════════════════════════════════════
       UTILS
       ═══════════════════════════════════════════════ */
    function getExtension(filename) {
        return (filename.split('.').pop() || '').toLowerCase();
    }

    function fileSize(bytes) {
        if (!bytes || bytes === 0) return '—';
        var units = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
    }

    function docIconClass(ext) {
        if (ext === 'pdf') return 'fas fa-file-pdf';
        if (['doc', 'docx'].includes(ext)) return 'fas fa-file-word';
        if (['xls', 'xlsx'].includes(ext)) return 'fas fa-file-excel';
        return 'fas fa-file';
    }

    function docIconBg(ext) {
        if (ext === 'pdf') return 'pdf';
        if (['doc', 'docx'].includes(ext)) return 'doc';
        if (['xls', 'xlsx'].includes(ext)) return 'xls';
        return 'other';
    }

    function detectYear(doc) {
        // Try to extract year from folder name or filename
        var yearMatch = (doc.folderPath + '/' + doc.name).match(/20\d{2}/);
        return yearMatch ? yearMatch[0] : new Date().getFullYear().toString();
    }

    /* ═══════════════════════════════════════════════
       TOAST
       ═══════════════════════════════════════════════ */
    function showToast(message, type) {
        var container = document.getElementById('toast');
        if (!container) return;
        var el = document.createElement('div');
        el.className = 'rm-toast-item ' + (type || 'info');
        var icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-check-circle';
        if (type === 'error') icon = 'fa-exclamation-circle';
        if (type === 'warning') icon = 'fa-exclamation-triangle';
        el.innerHTML = '<i class="fas ' + icon + '"></i> ' + message;
        container.appendChild(el);
        container.style.display = 'flex';
        setTimeout(function () {
            el.style.opacity = '0';
            el.style.transform = 'translateX(40px)';
            el.style.transition = 'all 0.3s';
            setTimeout(function () { el.remove(); if (!container.children.length) container.style.display = 'none'; }, 300);
        }, 3500);
    }

    /* ═══════════════════════════════════════════════
       LOAD DATA
       ═══════════════════════════════════════════════ */
    async function loadAllData() {
        showLoading(true);
        try {
            // Load root folders + files
            var result = await callParentAPI('get-document-folders', {});
            if (!result) throw new Error('Sin respuesta del servidor');

            allFolders = result.folders || [];
            var rootFiles = (result.files || []).map(function (f) {
                return { name: f.name, path: f.path, extension: getExtension(f.name), size: f.size, folderPath: '', year: detectYear({ name: f.name, folderPath: '' }) };
            });

            allDocuments = rootFiles;

            // Load files from each folder
            for (var i = 0; i < allFolders.length; i++) {
                var folder = allFolders[i];
                try {
                    var files = await callParentAPI('get-documents-in-folder', folder.path);
                    if (files && files.files) {
                        files.files.forEach(function (f) {
                            allDocuments.push({
                                name: f.name,
                                path: f.path,
                                extension: getExtension(f.name),
                                size: f.size,
                                folderPath: folder.path,
                                year: detectYear({ name: f.name, folderPath: folder.name })
                            });
                        });
                    }
                } catch (e) {
                    console.warn('[RM] Error cargando carpeta:', folder.name, e);
                }
            }

            updateStats();
            renderYearList();
        } catch (err) {
            console.error('[RM] Error cargando datos:', err);
            showToast('Error cargando documentos: ' + err.message, 'error');
            document.getElementById('emptyState').style.display = 'block';
        }
        showLoading(false);
    }

    function updateStats() {
        document.getElementById('statTotal').textContent = allDocuments.length;
        document.getElementById('statFolders').textContent = allFolders.length;
        var currentYear = new Date().getFullYear().toString();
        var thisYear = allDocuments.filter(function (d) { return d.year === currentYear; }).length;
        document.getElementById('statRecent').textContent = thisYear;
    }

    /* ═══════════════════════════════════════════════
       RENDER YEAR LIST
       ═══════════════════════════════════════════════ */
    function renderYearList() {
        var container = document.getElementById('yearList');
        var emptyState = document.getElementById('emptyState');
        container.innerHTML = '';

        // Filter
        var filtered = allDocuments.filter(function (doc) {
            if (currentFilter !== 'all') {
                if (currentFilter === 'pdf' && doc.extension !== 'pdf') return false;
                if (currentFilter === 'doc' && !['doc', 'docx'].includes(doc.extension)) return false;
                if (currentFilter === 'xls' && !['xls', 'xlsx'].includes(doc.extension)) return false;
            }
            if (currentSearch) {
                if (doc.name.toLowerCase().indexOf(currentSearch.toLowerCase()) === -1) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            emptyState.style.display = 'block';
            return;
        }
        emptyState.style.display = 'none';

        // Group by year
        var years = {};
        filtered.forEach(function (doc) {
            if (!years[doc.year]) years[doc.year] = [];
            years[doc.year].push(doc);
        });

        var sortedYears = Object.keys(years).sort().reverse();

        sortedYears.forEach(function (year, idx) {
            var docs = years[year];
            var group = document.createElement('div');
            group.className = 'rm-year-group' + (idx > 0 ? ' collapsed' : '');

            // Header
            var header = document.createElement('div');
            header.className = 'rm-year-header';
            header.innerHTML =
                '<span class="rm-year-label">' + year + '</span>' +
                '<span class="rm-year-count">' + docs.length + ' documento' + (docs.length !== 1 ? 's' : '') + '</span>' +
                '<i class="fas fa-chevron-down rm-year-chevron"></i>';
            header.addEventListener('click', function () { toggleYearGroup(group); });
            group.appendChild(header);

            // Content
            var content = document.createElement('div');
            content.className = 'rm-year-content';

            docs.forEach(function (doc) {
                content.appendChild(createDocCard(doc));
            });

            group.appendChild(content);
            container.appendChild(group);
        });
    }

    function toggleYearGroup(el) {
        el.classList.toggle('collapsed');
    }

    /* ═══════════════════════════════════════════════
       DOC CARD
       ═══════════════════════════════════════════════ */
    function createDocCard(doc) {
        var card = document.createElement('div');
        card.className = 'rm-card';

        var bg = docIconBg(doc.extension);

        card.innerHTML =
            '<div class="rm-card-header">' +
                '<div class="rm-card-title-wrap">' +
                    '<div class="rm-card-icon ' + bg + '"><i class="' + docIconClass(doc.extension) + '"></i></div>' +
                    '<span class="rm-card-name" title="' + escapeHtml(doc.name) + '">' + escapeHtml(doc.name) + '</span>' +
                '</div>' +
                '<div class="rm-card-meta">' +
                    '<span class="rm-card-size">' + fileSize(doc.size) + '</span>' +
                    '<span class="rm-badge-type ' + bg + '">' + doc.extension.toUpperCase() + '</span>' +
                    '<i class="fas fa-chevron-down rm-chevron"></i>' +
                '</div>' +
            '</div>' +
            '<div class="rm-card-details">' +
                '<div class="rm-file-item">' +
                    '<span class="rm-file-name"><i class="fas fa-eye"></i> Vista previa</span>' +
                    '<div class="rm-file-actions">' +
                        '<button class="rm-btn-sm rm-preview-btn" title="Vista previa"><i class="fas fa-eye"></i></button>' +
                        '<button class="rm-btn-sm rm-download-btn" title="Descargar"><i class="fas fa-download"></i></button>' +
                        '<button class="rm-btn-sm rm-open-btn" title="Abrir con app externa"><i class="fas fa-external-link-alt"></i></button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        // Toggle card expand
        card.querySelector('.rm-card-header').addEventListener('click', function () {
            card.classList.toggle('expanded');
        });

        // Preview btn
        card.querySelector('.rm-preview-btn').addEventListener('click', function (e) {
            e.stopPropagation();
            previewDocument(doc);
        });

        // Download btn
        card.querySelector('.rm-download-btn').addEventListener('click', function (e) {
            e.stopPropagation();
            downloadDocument(doc);
        });

        // Open external btn
        card.querySelector('.rm-open-btn').addEventListener('click', function (e) {
            e.stopPropagation();
            openExternal(doc);
        });

        return card;
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /* ═══════════════════════════════════════════════
       PREVIEW MODAL
       ═══════════════════════════════════════════════ */
    async function previewDocument(doc) {
        var modal = document.getElementById('previewModal');
        var body = document.getElementById('previewBody');
        var titleEl = document.getElementById('modalTitle');

        modal.style.display = 'flex';
        titleEl.textContent = doc.name;
        body.innerHTML = '<div class="rm-loading"><div class="rm-spinner"></div><p>Cargando vista previa…</p></div>';

        try {
            var ext = doc.extension;
            var result;

            if (ext === 'pdf') {
                result = await callParentAPI('get-pdf-preview', { filePath: doc.path });
            } else if (['xls', 'xlsx'].includes(ext)) {
                result = await callParentAPI('get-excel-preview', { filePath: doc.path });
            } else if (['doc', 'docx'].includes(ext)) {
                result = await callParentAPI('get-word-preview', { filePath: doc.path });
            } else {
                throw new Error('Tipo de archivo .' + ext + ' no soportado para previsualización');
            }

            if (result.success && result.data) {
                body.innerHTML = '';
                var iframe = document.createElement('iframe');

                // Blob URL para evitar problemas de sandbox
                var binary = atob(result.data);
                var bytes = new Uint8Array(binary.length);
                for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                var blob = new Blob([bytes], { type: 'application/pdf' });
                var blobUrl = URL.createObjectURL(blob);

                iframe.src = blobUrl;
                iframe.style.cssText = 'width:100%;height:100%;border:none;';
                body.appendChild(iframe);

                // Cleanup on close
                var cleanup = function () { URL.revokeObjectURL(blobUrl); };
                document.getElementById('modalCloseBtn').addEventListener('click', cleanup, { once: true });
                document.getElementById('previewOverlay').addEventListener('click', cleanup, { once: true });
            } else {
                throw new Error(result.error || 'Error al cargar el documento');
            }
        } catch (err) {
            console.error('[RM] Error preview:', err);
            body.innerHTML = '<div class="rm-empty"><i class="fas fa-exclamation-triangle" style="color:#dc3545;"></i><h3>Error al cargar</h3><p>' + escapeHtml(err.message) + '</p></div>';
        }
    }

    function closeModal() {
        document.getElementById('previewModal').style.display = 'none';
        document.getElementById('previewBody').innerHTML = '';
    }

    /* ═══════════════════════════════════════════════
       DOWNLOAD / OPEN EXTERNAL
       ═══════════════════════════════════════════════ */
    async function downloadDocument(doc) {
        try {
            showToast('Preparando descarga…', 'info');
            var result = await callParentAPI('download-document', doc.path);
            if (result.success) {
                var binary = atob(result.base64Data);
                var bytes = new Uint8Array(binary.length);
                for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                var blob = new Blob([bytes], { type: 'application/octet-stream' });
                var url = URL.createObjectURL(blob);
                var link = document.createElement('a');
                link.href = url;
                link.download = result.fileName || doc.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                showToast('Documento descargado exitosamente.', 'success');
            } else {
                throw new Error(result.error || 'Error en la descarga');
            }
        } catch (err) {
            showToast('Error en la descarga: ' + err.message, 'error');
        }
    }

    async function openExternal(doc) {
        try {
            await callParentAPI('open-path', doc.path);
            showToast('Abriendo con aplicación predeterminada…', 'info');
        } catch (err) {
            showToast('Error al abrir: ' + err.message, 'error');
        }
    }

    /* ═══════════════════════════════════════════════
       LOADING
       ═══════════════════════════════════════════════ */
    function showLoading(show) {
        var spinner = document.getElementById('loadingSpinner');
        if (spinner) spinner.style.display = show ? 'block' : 'none';
    }

    /* ═══════════════════════════════════════════════
       SEARCH & FILTER
       ═══════════════════════════════════════════════ */
    function setupSearch() {
        var input = document.getElementById('searchInput');
        var clearBtn = document.getElementById('searchClear');
        if (!input) return;

        input.addEventListener('input', function () {
            currentSearch = input.value.trim();
            clearBtn.classList.toggle('visible', currentSearch.length > 0);
            renderYearList();
        });

        clearBtn.addEventListener('click', function () {
            input.value = '';
            currentSearch = '';
            clearBtn.classList.remove('visible');
            renderYearList();
        });
    }

    function setupFilters() {
        var group = document.getElementById('filterGroup');
        if (!group) return;

        group.addEventListener('click', function (e) {
            var btn = e.target.closest('.rm-filter-btn');
            if (!btn) return;

            group.querySelectorAll('.rm-filter-btn').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderYearList();
        });
    }

    /* ═══════════════════════════════════════════════
       EVENT LISTENERS
       ═══════════════════════════════════════════════ */
    function setupEventListeners() {
        // Back button
        document.getElementById('backBtn').addEventListener('click', function () {
            window.parent.postMessage({ type: 'back-to-submodule-home', payload: {} }, '*');
        });

        // Refresh
        document.getElementById('refreshBtn').addEventListener('click', loadAllData);

        // Modal close
        document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
        document.getElementById('previewOverlay').addEventListener('click', closeModal);

        // Modal download
        document.getElementById('modalDownloadBtn').addEventListener('click', function () {
            if (currentDocPath) downloadDocument(currentDocPath);
        });

        // Modal open external
        document.getElementById('modalOpenExtBtn').addEventListener('click', function () {
            if (currentDocPath) openExternal(currentDocPath);
        });

        // Search
        setupSearch();

        // Filters
        setupFilters();

        // Keyboard: Escape closes modal
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeModal();
        });
    }

    /* ═══════════════════════════════════════════════
       INIT
       ═══════════════════════════════════════════════ */
    function init() {
        setupEventListeners();
        loadAllData();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
