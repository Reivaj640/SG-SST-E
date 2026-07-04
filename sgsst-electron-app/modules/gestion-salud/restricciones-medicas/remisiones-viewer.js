// ============================================================================
// remisiones-viewer.js — Visor de Remisiones Médicas (3.1.6)
// Conecta con backend IPC via postMessage bridge en restricciones-medicas-logic.js
// Protocolo moderno: field "type" (compatible con handler actualizado)
// ============================================================================
(function() {
    'use strict';

    // ─── Estado ─────────────────────────────────────────────────────────
    var allDocs = [];
    var currentFilter = 'todos';
    var searchQuery = '';
    var toastTimeout = null;
    var companyName = '';
    var moduleName = '';
    var submoduleName = '';

    // ─── Helper: comunicar con parent (restricciones-medicas-logic.js bridge) ──
    function callParentAPI(type, payload) {
        return new Promise(function(resolve, reject) {
            var requestId = 'rem-' + Date.now() + '-' + Math.random();

            function handleResponse(event) {
                if (event.source !== window.parent) return;
                var response = event.data;
                if (response && response.type === (type + '-response') && response.requestId === requestId) {
                    window.removeEventListener('message', handleResponse);
                    if (response.payload && response.payload.success) {
                        resolve(response.payload);
                    } else {
                        var errMsg = (response.payload && response.payload.error) || 'Error desconocido';
                        reject(new Error(typeof errMsg === 'object' ? errMsg.message || JSON.stringify(errMsg) : errMsg));
                    }
                }
            }

            window.addEventListener('message', handleResponse);

            window.parent.postMessage({
                type: type + '-request',
                payload: payload,
                requestId: requestId
            }, '*');

            // Timeout 15s
            setTimeout(function() {
                window.removeEventListener('message', handleResponse);
                reject(new Error('Timeout esperando respuesta para: ' + type));
            }, 15000);
        });
    }

    // ─── Inicialización ─────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', function() {
        var urlParams = new URLSearchParams(window.location.search);
        companyName = urlParams.get('company') || '';
        moduleName = urlParams.get('module') || '';
        submoduleName = urlParams.get('submodule') || '';

        console.log('[REM-VIEWER] Iniciando visor de remisiones. Company:', companyName);

        setupEventListeners();
        loadAllData();
    });

    // ─── Carga de datos ─────────────────────────────────────────────────

    async function loadAllData() {
        showLoading();
        allDocs = [];

        try {
            var params = { companyName: companyName, moduleName: moduleName, submoduleName: submoduleName };
            var foldersResult = await callParentAPI('get-document-folders', params);
            var folders = foldersResult.folders || [];

            console.log('[REM-VIEWER] Carpetas encontradas:', folders.length);

            // Cargar documentos de cada carpeta
            var folderPromises = folders.map(function(folder) {
                return callParentAPI('get-documents-in-folder', folder.path)
                    .then(function(docsResult) {
                        var files = docsResult.files || [];
                        files.forEach(function(file) {
                            file._folderName = folder.name || '';
                            file._year = extractYear(file);
                        });
                        for (var i = 0; i < files.length; i++) allDocs.push(files[i]);
                    })
                    .catch(function(err) {
                        console.warn('[REM-VIEWER] Error cargando carpeta "' + (folder.name || folder.path) + '":', err.message);
                    });
            });

            await Promise.allSettled(folderPromises);

            // También cargar archivos raíz (files en foldersResult)
            var rootFiles = foldersResult.files || [];
            rootFiles.forEach(function(file) {
                file._folderName = '';
                file._year = extractYear(file);
                allDocs.push(file);
            });

            console.log('[REM-VIEWER] Total documentos cargados:', allDocs.length, '— Carpetas:', folders.length);

            renderStats(allDocs, folders.length);
            applyFilters();

        } catch (error) {
            console.error('[REM-VIEWER] Error cargando datos:', error);
            renderEmpty('Error al cargar los documentos. Intente refrescar la página.');
        }
    }

    // ─── Stats ──────────────────────────────────────────────────────────

    function renderStats(docs, folderCount) {
        var currentYear = new Date().getFullYear();
        var docsThisYear = docs.filter(function(d) {
            return d._year === currentYear;
        });

        document.getElementById('statTotal').textContent = docs.length;
        document.getElementById('statFolders').textContent = folderCount || 0;
        document.getElementById('statCurrentYear').textContent = docsThisYear.length;
        document.getElementById('statYearLabel').textContent = currentYear;
    }

    // ─── Filtros y búsqueda ──────────────────────────────────────────────

    function applyFilters() {
        renderDocuments(allDocs.filter(function(doc) {
            if (currentFilter !== 'todos') {
                var ext = (doc.extension || '').toLowerCase();
                if (currentFilter === 'pdf' && ext !== 'pdf') return false;
                if (currentFilter === 'word' && ext !== 'doc' && ext !== 'docx') return false;
                if (currentFilter === 'excel' && ext !== 'xls' && ext !== 'xlsx') return false;
            }
            if (searchQuery) {
                var query = searchQuery.toLowerCase();
                return (doc.name || '').toLowerCase().includes(query) ||
                       (doc._folderName || '').toLowerCase().includes(query);
            }
            return true;
        }));
    }

    // ─── Renderizado ───────────────────────────────────────────────────

    function renderDocuments(docs) {
        var container = document.getElementById('documentsList');

        if (!docs || docs.length === 0) {
            var msg = searchQuery
                ? 'No se encontraron documentos que coincidan con la búsqueda.'
                : currentFilter !== 'todos'
                    ? 'No hay documentos del tipo seleccionado.'
                    : 'No hay documentos registrados.';
            renderEmpty(msg);
            return;
        }

        // Agrupar por año usando valor cacheado
        var yearMap = new Map();
        docs.forEach(function(doc) {
            var year = doc._year;
            if (!yearMap.has(year)) yearMap.set(year, []);
            yearMap.get(year).push(doc);
        });

        // Ordenar años descendente; 'Sin año' al final
        var years = Array.from(yearMap.keys()).sort(function(a, b) {
            if (a === 'Sin año') return 1;
            if (b === 'Sin año') return -1;
            return b - a;
        });

        var expandAll = !!searchQuery;
        var currentYear = new Date().getFullYear();
        var html = '';

        years.forEach(function(year, yearIndex) {
            var yearDocs = yearMap.get(year);
            var isCurrentYear = (year === currentYear);
            var isCollapsed = !expandAll && !isCurrentYear && yearIndex > 0;

            html += '<div class="rem-year-group' + (isCollapsed ? ' collapsed' : '') + '">';
            html += '  <div class="rem-year-header" onclick="window._remToggleYear(this)">';
            html += '    <div class="rem-year-header-left">';
            html += '      <i class="fas fa-calendar rem-year-icon"></i>';
            html += '      <span class="rem-year-label">' + escapeHtml(String(year)) + '</span>';
            html += '      <span class="rem-year-count-badge">' + yearDocs.length + ' documento' + (yearDocs.length !== 1 ? 's' : '') + '</span>';
            html += '    </div>';
            html += '    <i class="fas fa-chevron-down rem-year-chevron"></i>';
            html += '  </div>';
            html += '  <div class="rem-year-content">';

            yearDocs.forEach(function(doc, idx) {
                var ext = (doc.extension || '').toLowerCase();
                var icon = getFileIcon(ext);
                var size = doc.size ? formatFileSize(doc.size) : '';
                var delay = (idx * 0.04).toFixed(2);
                var folderInfo = doc._folderName ? doc._folderName : '';

                html += '<div class="rem-card" style="animation-delay: ' + delay + 's">';
                html += '  <div class="rem-card-header" onclick="window._remToggleCard(this)">';
                html += '    <div class="rem-card-type-icon">';
                html += '      <i class="fas ' + icon + '"></i>';
                html += '    </div>';
                html += '    <div class="rem-card-info">';
                html += '      <div class="rem-card-name" title="' + escapeHtml(doc.name) + '">' + escapeHtml(doc.name) + '</div>';
                html += '      <div class="rem-card-meta">';
                if (size) html += '        <span><i class="fas fa-weight-hanging"></i> ' + size + '</span>';
                if (folderInfo) html += '        <span><i class="fas fa-folder"></i> ' + escapeHtml(folderInfo) + '</span>';
                html += '        <span><i class="fas fa-file"></i> .' + escapeHtml(ext || 'archivo') + '</span>';
                html += '      </div>';
                html += '    </div>';
                html += '    <i class="fas fa-chevron-right rem-card-chevron"></i>';
                html += '  </div>';
                html += '  <div class="rem-card-details">';
                html += '    <div class="rem-files-title">Acciones</div>';
                html += '    <div class="rem-file-item">';
                html += '      <i class="fas ' + icon + '"></i>';
                html += '      <span class="rem-file-name" title="' + escapeHtml(doc.name) + '">' + escapeHtml(doc.name) + '</span>';
                if (size) html += '      <span class="rem-file-size">' + size + '</span>';
                html += '      <div class="rem-file-actions">';
                html += '        <button class="rem-file-action-btn"'
                      + ' data-filepath="' + escapeHtml(doc.path) + '"'
                      + ' data-filename="' + escapeHtml(doc.name) + '"'
                      + ' data-ext="' + escapeHtml(ext) + '"'
                      + ' onclick="event.stopPropagation(); window._remPreviewFile(this.dataset.filepath, this.dataset.filename, this.dataset.ext)"'
                      + ' title="Previsualizar">';
                html += '          <i class="fas fa-eye"></i>';
                html += '        </button>';
                html += '      </div>';
                html += '    </div>';
                html += '  </div>';
                html += '</div>';
            });

            html += '  </div>'; // .rem-year-content
            html += '</div>';   // .rem-year-group
        });

        container.innerHTML = html;
    }

    function renderEmpty(message) {
        var container = document.getElementById('documentsList');
        container.innerHTML = '<div class="rem-empty">'
            + '<div class="rem-empty-icon"><i class="fas fa-inbox"></i></div>'
            + '<h3>Sin documentos</h3>'
            + '<p>' + escapeHtml(message) + '</p>'
            + '</div>';
    }

    function showLoading() {
        document.getElementById('documentsList').innerHTML = KairSkeleton.list(8);
    }

    // ─── Eventos ────────────────────────────────────────────────────────

    function setupEventListeners() {
        // Volver
        document.getElementById('backBtn').addEventListener('click', function() {
            window.parent.postMessage({ type: 'back-to-submodule-home' }, '*');
        });

        // Refrescar
        document.getElementById('refreshBtn').addEventListener('click', function() {
            var icon = document.getElementById('refreshIcon');
            icon.classList.add('fa-spin');
            loadAllData().then(function() {
                icon.classList.remove('fa-spin');
                showToast('Actualizado', 'La lista ha sido actualizada.', 'info');
            }).catch(function() {
                icon.classList.remove('fa-spin');
                showToast('Error', 'No se pudo actualizar la lista.', 'error');
            });
        });

        // Filtros
        document.querySelectorAll('.rem-filter-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.rem-filter-btn').forEach(function(b) { b.classList.remove('active'); });
                this.classList.add('active');
                currentFilter = this.dataset.filter;
                applyFilters();
            });
        });

        // Búsqueda
        var searchInput = document.getElementById('searchInput');
        var clearSearchBtn = document.getElementById('clearSearchBtn');

        searchInput.addEventListener('input', function() {
            searchQuery = this.value.trim();
            clearSearchBtn.classList.toggle('hidden', !searchQuery);
            applyFilters();
        });

        clearSearchBtn.addEventListener('click', function() {
            searchInput.value = '';
            searchQuery = '';
            this.classList.add('hidden');
            searchInput.focus();
            applyFilters();
        });

        // Modal
        document.getElementById('closePreviewBtn').addEventListener('click', closePreview);
        document.getElementById('previewOverlay').addEventListener('click', closePreview);

        // ESC cierra modal
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closePreview();
        });

        // Toast close
        document.getElementById('toastClose').addEventListener('click', hideToast);
    }

    // ─── Funciones globales (onclick inline) ───────────────────────────

    window._remToggleCard = function(headerEl) {
        var card = headerEl.closest('.rem-card');
        if (!card) return;
        card.classList.toggle('expanded');
    };

    window._remToggleYear = function(headerEl) {
        var group = headerEl.closest('.rem-year-group');
        if (!group) return;
        group.classList.toggle('collapsed');
    };

    window._remPreviewFile = async function(filePath, fileName, extension) {
        var modal = document.getElementById('previewModal');
        var titleEl = document.getElementById('previewTitle');
        var body = document.getElementById('previewBody');

        modal.classList.remove('hidden');
        titleEl.textContent = fileName;
        body.innerHTML = KairSkeleton.detail(6);

        try {
            var ext = (extension || '').toLowerCase();
            var apiType;

            if (ext === 'pdf') {
                apiType = 'get-pdf-preview';
            } else if (ext === 'xls' || ext === 'xlsx') {
                apiType = 'get-excel-preview';
            } else if (ext === 'doc' || ext === 'docx') {
                apiType = 'get-word-preview';
            } else {
                body.innerHTML = '<div class="rem-empty" style="padding:2rem;">'
                    + '<div class="rem-empty-icon"><i class="fas fa-file"></i></div>'
                    + '<h3>Vista previa no disponible</h3>'
                    + '<p>El tipo de archivo .' + escapeHtml(ext) + ' no tiene vista previa.</p>'
                    + '</div>';
                return;
            }

            var result = await callParentAPI(apiType, { filePath: filePath });

            if (result && result.data) {
                body.innerHTML = '<iframe src="data:application/pdf;base64,' + result.data + '" style="width:100%;height:100%;border:none;flex:1;"></iframe>';
            } else {
                body.innerHTML = '<div class="rem-empty" style="padding:2rem;">'
                    + '<div class="rem-empty-icon"><i class="fas fa-exclamation-triangle"></i></div>'
                    + '<h3>Sin vista previa</h3>'
                    + '<p>No se pudo obtener la vista previa del documento.</p>'
                    + '</div>';
            }

        } catch (error) {
            console.error('[REM-VIEWER] Error en preview:', error);
            var errMsg = error.message || '';
            var isPywin32 = /pywin32|win32com|TYPE_E_CANTLOADLIBRARY/i.test(errMsg);
            body.innerHTML = '<div class="rem-empty" style="padding:2rem;">'
                + '<div class="rem-empty-icon"><i class="fas fa-times-circle" style="color:var(--rem-danger);"></i></div>'
                + '<h3>Error al cargar</h3>'
                + (isPywin32
                    ? '<p>La conversión de documentos Word requiere <strong>pywin32</strong>.</p>'
                      + '<p style="margin-top:.5rem;font-size:.8125rem;">Ejecute: <code>pip install pywin32</code></p>'
                    : '<p>' + escapeHtml(errMsg) + '</p>')
                + '</div>';
        }
    };

    // ─── Preview modal ─────────────────────────────────────────────────

    function closePreview() {
        document.getElementById('previewModal').classList.add('hidden');
        document.getElementById('previewBody').innerHTML = '';
    }

    // ─── Utilidades ────────────────────────────────────────────────────

    function extractYear(doc) {
        // Intentar obtener año desde el nombre de la carpeta o el nombre del archivo
        var currentYear = new Date().getFullYear();
        var text = (doc._folderName || '') + ' ' + (doc.name || '');
        var match = text.match(/\b(20\d{2}|19\d{2})\b/);
        if (match) return parseInt(match[1], 10);
        // Fallback: usar año actual para archivos sin año en nombre
        return currentYear;
    }

    function getFileIcon(ext) {
        var icons = {
            pdf:  'fa-file-pdf',
            doc:  'fa-file-word',
            docx: 'fa-file-word',
            xls:  'fa-file-excel',
            xlsx: 'fa-file-excel',
            zip:  'fa-file-archive',
            jpg:  'fa-file-image',
            jpeg: 'fa-file-image',
            png:  'fa-file-image'
        };
        return icons[(ext || '').toLowerCase()] || 'fa-file';
    }

    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '';
        var k = 1024;
        var sizes = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        if (typeof unsafe !== 'string') return String(unsafe);
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ─── Toast ──────────────────────────────────────────────────────────

    function showToast(title, message, type) {
        type = type || 'info';
        var toast = document.getElementById('toast');
        var icon = document.getElementById('toastIcon');
        var titleEl = document.getElementById('toastTitle');
        var messageEl = document.getElementById('toastMessage');

        var icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-times-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        toast.className = 'rem-toast ' + type;
        icon.className = 'rem-toast-icon ' + (icons[type] || icons.info);
        titleEl.textContent = title;
        messageEl.textContent = message;

        if (toastTimeout) clearTimeout(toastTimeout);

        requestAnimationFrame(function() {
            toast.classList.add('show');
        });

        toastTimeout = setTimeout(function() {
            toast.classList.remove('show');
        }, 4000);
    }

    function hideToast() {
        document.getElementById('toast').classList.remove('show');
        if (toastTimeout) clearTimeout(toastTimeout);
    }

})();
