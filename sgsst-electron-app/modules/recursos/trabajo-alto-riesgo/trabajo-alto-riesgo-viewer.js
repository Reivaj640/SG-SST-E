/* ═══════════════════════════════════════════════════════════════════
   K+AIR · 1.1.5 Trabajo de Alto Riesgo · Visualizador v2.0
   v2.0 · 2026-07-10 — Réplica del rediseño Opción C (híbrido incremental)
   ═══════════════════════════════════════════════════════════════════

   MEJORAS v2.0:
   - Patrón IIFE con export window (cumple AGENTS.md)
   - Breadcrumb multinivel real (deriva de basePath ↔ currentFolderPath)
   - Toggle Lista/Grid con persistencia en localStorage scoped
   - Búsqueda con debounce 300ms
   - Sort por nombre / tamaño / fecha
   - Preview panel lateral colapsable
   - Skeleton loaders (estilo KairSkeleton)
   - Empty states canónicos (kair-empty)
   - Footer con metadata (cantidad, tamaño total, última modificación)
   - Selección: click = preview, doble-click = abrir externo
   - Soporte dark mode (sincroniza data-theme del padre)
   - Atributo title en archivos para ver nombre completo en hover
   - Logging estructurado [K+AIRSST][TRABAJO_ALTO_RIESGO][ACCION][STATUS]

   MIGRACIÓN → v2.0:
   - Namespace kair-docs-* → kair-* (canónico)
   - Removida dependencia font-awesome
   - Theme sync via postMessage('theme-changed') + MutationObserver
   - Atributo title en archivos y nombre de preview (fix nombres largos)

   CONTRATOS CONSERVADOS (sin cambios):
   - callParentAPI(type, payload) → 9 canales IPC vía postMessage
   - Handlers en renderer.js y trabajo-alto-riesgo-logic.js SIN MODIFICAR
   - main.js, preload.js SIN MODIFICAR

   ═══════════════════════════════════════════════════════════════════ */

var TrabajoAltoRiesgoViewer = (function () {
    'use strict';

    /* ═══════════════════════════════════════════════════════════════
       ESTADO PRIVADO
       ═══════════════════════════════════════════════════════════════ */
    var _state = {
        currentDocument: null,
        currentFolderPath: '',
        basePath: '',
        pathHistory: [],
        documents: [],          // Cache de documentos en carpeta actual
        folders: [],            // Cache de carpetas en carpeta actual
        searchQuery: '',
        sortBy: 'name-asc',
        viewMode: 'list',       // 'list' | 'grid'
        currentZoom: 100,       // Number | 'width'
        totalPages: 0,
        currentPage: 1,
        isSidebarCollapsed: false,
        isPreviewCollapsed: false,
        isLoading: false,
        contextMenuDoc: null,
        confirmCallback: null,
        searchDebounceTimer: null,
        company: '',
        moduleName: '',
        submoduleName: '',
        // Listeners de theme (para cleanup en destroy)
        _themeMessageHandler: null,
        _themeObserver: null
    };

    /* ═══════════════════════════════════════════════════════════════
       CONSTANTES
       ═══════════════════════════════════════════════════════════════ */
    var _LOG_PREFIX = '[K+AIRSST][TRABAJO_ALTO_RIESGO]';
    var _STORAGE_KEY = 'kair-docs-viewer-prefs';
    var _SEARCH_DEBOUNCE_MS = 300;
    var _MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
    var _INVALID_CHARS = /[<>:"/\\|?*]/;

    var _FILE_TYPES = {
        'pdf':        { className: 'pdf',        icon: 'bi-file-earmark-pdf',       label: 'PDF' },
        'xls':        { className: 'excel',      icon: 'bi-file-earmark-excel',     label: 'XLS' },
        'xlsx':       { className: 'excel',      icon: 'bi-file-earmark-excel',     label: 'XLSX' },
        'doc':        { className: 'word',       icon: 'bi-file-earmark-word',      label: 'DOC' },
        'docx':       { className: 'word',       icon: 'bi-file-earmark-word',      label: 'DOCX' },
        'ppt':        { className: 'powerpoint', icon: 'bi-file-earmark-slides',    label: 'PPT' },
        'pptx':       { className: 'powerpoint', icon: 'bi-file-earmark-slides',    label: 'PPTX' },
        'jpg':        { className: 'image',      icon: 'bi-file-earmark-image',     label: 'JPG' },
        'jpeg':       { className: 'image',      icon: 'bi-file-earmark-image',     label: 'JPEG' },
        'png':        { className: 'image',      icon: 'bi-file-earmark-image',     label: 'PNG' },
        'txt':        { className: 'text',       icon: 'bi-file-earmark-text',      label: 'TXT' }
    };

    /* ═══════════════════════════════════════════════════════════════
       HELPERS PRIVADOS
       ═══════════════════════════════════════════════════════════════ */

    function _log(action, status, data) {
        var msg = _LOG_PREFIX + '[' + action + '][' + status + ']';
        if (data !== undefined) {
            console.log(msg, data);
        } else {
            console.log(msg);
        }
    }

    function _err(action, error) {
        console.error(_LOG_PREFIX + '[' + action + '][ERROR]', error);
    }

    function _esc(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function _getFileTypeInfo(extension) {
        var ext = (extension || '').toLowerCase().replace('.', '');
        return _FILE_TYPES[ext] || { className: 'default', icon: 'bi-file-earmark', label: ext.toUpperCase() || 'FILE' };
    }

    function _formatSize(bytes) {
        if (!bytes || isNaN(bytes)) return '—';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }

    function _formatDate(iso) {
        if (!iso) return '—';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '—';
            var now = new Date();
            var diffMs = now - d;
            var diffMin = Math.floor(diffMs / 60000);
            var diffHr = Math.floor(diffMin / 60);
            var diffDay = Math.floor(diffHr / 24);

            if (diffMin < 1) return 'hace un momento';
            if (diffMin < 60) return 'hace ' + diffMin + ' min';
            if (diffHr < 24) return 'hace ' + diffHr + ' h';
            if (diffDay < 7) return 'hace ' + diffDay + ' día' + (diffDay === 1 ? '' : 's');

            var dd = String(d.getDate()).padStart(2, '0');
            var mm = String(d.getMonth() + 1).padStart(2, '0');
            var yyyy = d.getFullYear();
            return dd + '/' + mm + '/' + yyyy;
        } catch (e) {
            return '—';
        }
    }

    function _normalizePathSep(path) {
        if (!path) return '';
        // Detectar separador dominante
        var hasBackslash = path.indexOf('\\') !== -1;
        var hasSlash = path.indexOf('/') !== -1;
        return hasBackslash && !hasSlash ? '\\' : '/';
    }

    function _splitPath(path) {
        if (!path) return [];
        var sep = _normalizePathSep(path);
        return path.split(sep).filter(function (p) { return p !== ''; });
    }

    function _getRelativeSegments(basePath, currentPath) {
        if (!basePath || !currentPath) return [];
        var baseSegs = _splitPath(basePath);
        var currSegs = _splitPath(currentPath);
        // Si currentPath no empieza con basePath, derivar por nombre
        var relSegs = [];
        var matchStart = -1;
        for (var i = 0; i < currSegs.length; i++) {
            if (currSegs[i] === baseSegs[0]) { matchStart = i; break; }
        }
        if (matchStart === -1) {
            // No hay coincidencia, devolver últimos 2 segmentos como fallback
            return currSegs.slice(-2);
        }
        return currSegs.slice(matchStart + baseSegs.length);
    }

    function _savePrefs() {
        try {
            var prefs = {
                viewMode: _state.viewMode,
                sortBy: _state.sortBy,
                isSidebarCollapsed: _state.isSidebarCollapsed,
                isPreviewCollapsed: _state.isPreviewCollapsed
            };
            localStorage.setItem(_STORAGE_KEY, JSON.stringify(prefs));
        } catch (e) {
            _err('SAVE_PREFS', e);
        }
    }

    function _loadPrefs() {
        try {
            var raw = localStorage.getItem(_STORAGE_KEY);
            if (!raw) return;
            var prefs = JSON.parse(raw);
            if (prefs.viewMode) _state.viewMode = prefs.viewMode;
            if (prefs.sortBy) _state.sortBy = prefs.sortBy;
            if (typeof prefs.isSidebarCollapsed === 'boolean') _state.isSidebarCollapsed = prefs.isSidebarCollapsed;
            if (typeof prefs.isPreviewCollapsed === 'boolean') _state.isPreviewCollapsed = prefs.isPreviewCollapsed;
        } catch (e) {
            _err('LOAD_PREFS', e);
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       THEME SYNC — Escucha cambios del padre y los aplica al iframe
       El theme-manager del padre propaga el atributo data-theme al
       iframe via contentDocument + postMessage('theme-changed').
       ═══════════════════════════════════════════════════════════════ */
    function _applyThemeToHtml(themeValue) {
        // themeValue: 'dark-legacy' | 'dark' | null (light = sin atributo)
        try {
            var docEl = document.documentElement;
            if (themeValue) {
                docEl.setAttribute('data-theme', themeValue);
            } else {
                docEl.removeAttribute('data-theme');
            }
            _log('THEME', 'APPLIED', { value: themeValue });
        } catch (e) {
            _err('THEME_APPLY', e);
        }
    }

    function _resolveThemeValue(theme, mode) {
        // theme: 'light' | 'dark', mode: 'light' | 'dark' | 'system'
        if (theme !== 'dark') return null; // light
        // dark:
        if (mode === 'dark') return 'dark-legacy';
        if (mode === 'system') return 'dark';
        return 'dark'; // fallback
    }

    function _setupThemeSync() {
        // 1) Leer tema actual del <html> del padre (si está disponible)
        try {
            if (window.parent && window.parent.document && window.parent.document.documentElement) {
                var parentTheme = window.parent.document.documentElement.getAttribute('data-theme');
                if (parentTheme) {
                    _applyThemeToHtml(parentTheme);
                }
            }
        } catch (e) {
            // cross-origin, no se puede leer del padre
            _log('THEME', 'PARENT_READ_BLOCKED');
        }

        // 2) Escuchar mensajes de cambio de tema del padre
        _state._themeMessageHandler = function (event) {
            if (!event.data || typeof event.data !== 'object') return;
            if (event.data.type !== 'theme-changed') return;
            var theme = event.data.theme;
            var mode = event.data.mode;
            var themeValue = _resolveThemeValue(theme, mode);
            _applyThemeToHtml(themeValue);
        };
        window.addEventListener('message', _state._themeMessageHandler);

        // 3) MutationObserver como defensa: si el theme-manager cambia
        //    el atributo data-theme directamente en el iframe, sincronizamos
        if (typeof MutationObserver !== 'undefined') {
            _state._themeObserver = new MutationObserver(function (mutations) {
                mutations.forEach(function (m) {
                    if (m.type === 'attributes' && m.attributeName === 'data-theme') {
                        var newVal = document.documentElement.getAttribute('data-theme');
                        _log('THEME', 'OBSERVED_CHANGE', { value: newVal });
                    }
                });
            });
            _state._themeObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['data-theme']
            });
        }
    }

    function _teardownThemeSync() {
        if (_state._themeMessageHandler) {
            window.removeEventListener('message', _state._themeMessageHandler);
            _state._themeMessageHandler = null;
        }
        if (_state._themeObserver) {
            _state._themeObserver.disconnect();
            _state._themeObserver = null;
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       COMUNICACIÓN CON PARENT (contrato conservado)
       ═══════════════════════════════════════════════════════════════ */
    function _callParentAPI(type, payload) {
        _log('CALL_PARENT', 'REQUEST', { type: type });
        return new Promise(function (resolve, reject) {
            var requestId = 'req-' + Date.now() + '-' + Math.random();

            function handleResponse(event) {
                if (event.origin !== 'file://' || event.source !== window.parent) {
                    return;
                }
                var response = event.data;
                if (response.type === type + '-response' && response.requestId === requestId) {
                    window.removeEventListener('message', handleResponse);
                    if (response.payload && response.payload.success) {
                        _log('CALL_PARENT', 'SUCCESS', { type: type });
                        resolve(response.payload);
                    } else {
                        var errorMessage = (response.payload && response.payload.error) || 'Unknown error from parent';
                        _err('CALL_PARENT', new Error(errorMessage));
                        reject(new Error(errorMessage));
                    }
                }
            }

            window.addEventListener('message', handleResponse);
            window.parent.postMessage({
                type: type + '-request',
                payload: payload,
                requestId: requestId
            }, 'file://');
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       LOADING / TOAST / NOTIFICATIONS
       ═══════════════════════════════════════════════════════════════ */
    function _showLoading(text) {
        _state.isLoading = true;
        var overlay = document.getElementById('loadingOverlay');
        var textEl = document.getElementById('loadingText');
        if (overlay) overlay.classList.add('is-active');
        if (textEl) textEl.textContent = text || 'Cargando...';
    }

    function _hideLoading() {
        _state.isLoading = false;
        var overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('is-active');
    }

    function _showToast(message, type, duration) {
        type = type || 'info';
        duration = duration || 3000;
        var container = document.getElementById('kToastContainer');
        if (!container) return;

        var icons = {
            success: 'bi-check-circle-fill',
            error: 'bi-x-circle-fill',
            warning: 'bi-exclamation-triangle-fill',
            info: 'bi-info-circle-fill'
        };

        var toast = document.createElement('div');
        toast.className = 'kair-toast kair-toast--' + type;
        toast.innerHTML =
            '<i class="bi ' + (icons[type] || icons.info) + ' kair-toast__icon"></i>' +
            '<span class="kair-toast__message">' + message + '</span>';
        container.appendChild(toast);

        setTimeout(function () {
            toast.classList.add('is-closing');
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, duration);
    }

    // Alias legacy para compatibilidad
    function _showNotification(message, type) {
        _showToast(message, type || 'success');
    }

    /* ═══════════════════════════════════════════════════════════════
       RENDER — BREADCRUMB MULTINIVEL
       ═══════════════════════════════════════════════════════════════ */
    function _renderBreadcrumb() {
        var breadcrumb = document.getElementById('breadcrumb');
        if (!breadcrumb) return;

        var segments = _getRelativeSegments(_state.basePath, _state.currentFolderPath);
        var sep = _normalizePathSep(_state.currentFolderPath) || '/';

        var html = '<button class="kair-crumb" data-action="go-root">' +
            '<i class="bi bi-hdd kair-crumb__icon"></i>' +
            '<span>Raíz</span>' +
            '</button>';

        // Reconstruir path acumulativo
        var accPath = _state.basePath;
        segments.forEach(function (seg, idx) {
            accPath = accPath + sep + seg;
            var isLast = (idx === segments.length - 1);
            var pathForCrumb = accPath; // capturar
            html += '<i class="bi bi-chevron-right kair-crumb-sep"></i>';
            html += '<button class="kair-crumb' + (isLast ? ' is-current' : '') + '" data-action="go-path" data-path="' + _esc(pathForCrumb) + '">' +
                '<i class="bi bi-folder2 kair-crumb__icon"></i>' +
                '<span>' + _esc(seg) + '</span>' +
                '</button>';
        });

        breadcrumb.innerHTML = html;

        // Bind events
        var crumbs = breadcrumb.querySelectorAll('[data-action]');
        crumbs.forEach(function (crumb) {
            crumb.addEventListener('click', function () {
                var action = crumb.getAttribute('data-action');
                var path = crumb.getAttribute('data-path');
                if (action === 'go-root') {
                    _navigateToRoot();
                } else if (action === 'go-path' && path) {
                    _navigateToPath(path);
                }
            });
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       RENDER — SIDEBAR DE CARPETAS
       ═══════════════════════════════════════════════════════════════ */
    function _renderFolders() {
        var folderList = document.getElementById('folderList');
        if (!folderList) return;

        if (!_state.folders || _state.folders.length === 0) {
            folderList.innerHTML =
                '<div class="kair-empty kair-empty--compact">' +
                '<div class="kair-empty__icon"><i class="bi bi-folder-x"></i></div>' +
                '<p class="kair-empty__desc">No hay carpetas</p>' +
                '</div>';
            return;
        }

        var html = '';
        _state.folders.forEach(function (folder) {
            html +=
                '<div class="kair-folder" data-path="' + _esc(folder.path) + '">' +
                '<i class="bi bi-folder-fill kair-folder__icon"></i>' +
                '<span class="kair-folder__name" title="' + _esc(folder.name) + '">' + _esc(folder.name) + '</span>' +
                '<div class="kair-folder__drag-overlay">' +
                '<div class="kair-folder__drag-overlay-content">' +
                '<i class="bi bi-cloud-upload-fill"></i>' +
                '<span>Suelta aquí</span>' +
                '</div>' +
                '</div>' +
                '</div>';
        });

        folderList.innerHTML = html;

        // Bind events a cada carpeta
        var folderEls = folderList.querySelectorAll('.kair-folder');
        folderEls.forEach(function (el) {
            var folderPath = el.getAttribute('data-path');
            el.addEventListener('click', function () {
                _selectFolder(folderPath);
            });
            _setupFolderDragAndDrop(el, folderPath);
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       RENDER — LISTA / GRID DE DOCUMENTOS
       ═══════════════════════════════════════════════════════════════ */
    function _applyFiltersAndSort(docs) {
        var filtered = docs.slice();

        // Filtro de búsqueda
        if (_state.searchQuery) {
            var q = _state.searchQuery.toLowerCase();
            filtered = filtered.filter(function (d) {
                return (d.name || '').toLowerCase().indexOf(q) !== -1;
            });
        }

        // Sort
        var sortKey = _state.sortBy;
        filtered.sort(function (a, b) {
            switch (sortKey) {
                case 'name-asc':  return (a.name || '').localeCompare(b.name || '');
                case 'name-desc': return (b.name || '').localeCompare(a.name || '');
                case 'size-asc':  return (a.size || 0) - (b.size || 0);
                case 'size-desc': return (b.size || 0) - (a.size || 0);
                case 'date-asc':  return new Date(a.lastModified || 0) - new Date(b.lastModified || 0);
                case 'date-desc': return new Date(b.lastModified || 0) - new Date(a.lastModified || 0);
                default:          return 0;
            }
        });

        return filtered;
    }

    function _renderDocuments() {
        var fileList = document.getElementById('fileList');
        var docCount = document.getElementById('docCount');
        if (!fileList) return;

        // Aplicar vista mode
        fileList.setAttribute('data-view', _state.viewMode);

        var filtered = _applyFiltersAndSort(_state.documents);

        // Stats
        if (docCount) docCount.textContent = filtered.length;
        _updateFooter(filtered);

        if (filtered.length === 0) {
            if (_state.searchQuery) {
                fileList.innerHTML =
                    '<div class="kair-empty">' +
                    '<div class="kair-empty__icon"><i class="bi bi-search"></i></div>' +
                    '<h3 class="kair-empty__title">Sin resultados</h3>' +
                    '<p class="kair-empty__desc">No se encontraron archivos para "<strong>' + _esc(_state.searchQuery) + '</strong>"</p>' +
                    '</div>';
            } else {
                fileList.innerHTML =
                    '<div class="kair-empty">' +
                    '<div class="kair-empty__icon"><i class="bi bi-inbox"></i></div>' +
                    '<h3 class="kair-empty__title">Carpeta vacía</h3>' +
                    '<p class="kair-empty__desc">No hay archivos en esta carpeta. Arrastra archivos aquí o usa el botón "Subir".</p>' +
                    '</div>';
            }
            return;
        }

        var html = '<div class="kair-file-grid">';
        filtered.forEach(function (doc) {
            var typeInfo = _getFileTypeInfo(doc.extension);
            var sizeText = doc.size ? _formatSize(doc.size) : '';
            var dateText = doc.lastModified ? _formatDate(doc.lastModified) : '';

            html +=
                '<div class="kair-file" data-path="' + _esc(doc.path) + '">' +
                '<div class="kair-file__icon kair-file__icon--' + typeInfo.className + '">' +
                '<i class="bi ' + typeInfo.icon + '"></i>' +
                '</div>' +
                '<div class="kair-file__info">' +
                '<div class="kair-file__name" title="' + _esc(doc.name) + '">' + _esc(doc.name) + '</div>' +
                '<div class="kair-file__meta">' +
                '<span class="kair-file__badge">' + _esc(typeInfo.label) + '</span>' +
                (sizeText ? '<span class="kair-file__size">' + sizeText + '</span>' : '') +
                (dateText ? '<span class="kair-file__date">· ' + dateText + '</span>' : '') +
                '</div>' +
                '</div>' +
                '</div>';
        });
        html += '</div>';

        fileList.innerHTML = html;

        // Bind events a cada archivo
        var fileEls = fileList.querySelectorAll('.kair-file');
        fileEls.forEach(function (el) {
            var docPath = el.getAttribute('data-path');
            var doc = filtered.find(function (d) { return d.path === docPath; });
            if (!doc) return;

            el.addEventListener('click', function () {
                _selectDocument(doc);
            });
            el.addEventListener('dblclick', function () {
                _openFile(doc);
            });
            el.addEventListener('contextmenu', function (e) {
                e.preventDefault();
                _showContextMenu(e.clientX, e.clientY, doc);
            });
        });

        // Re-aplicar selección activa si el doc sigue visible
        if (_state.currentDocument) {
            var activeEl = fileList.querySelector('[data-path="' + _state.currentDocument.path.replace(/"/g, '\\"') + '"]');
            if (activeEl) activeEl.classList.add('is-active');
        }
    }

    function _updateFooter(docs) {
        var footerCount = document.getElementById('footerCount');
        var footerSize = document.getElementById('footerSize');
        var footerLastMod = document.getElementById('footerLastMod');

        var count = docs.length;
        var totalSize = docs.reduce(function (acc, d) { return acc + (d.size || 0); }, 0);
        var lastMod = docs.reduce(function (latest, d) {
            if (!d.lastModified) return latest;
            var t = new Date(d.lastModified).getTime();
            return (!latest || t > latest.getTime()) ? new Date(d.lastModified) : latest;
        }, null);

        if (footerCount) footerCount.textContent = count + (count === 1 ? ' archivo' : ' archivos');
        if (footerSize) footerSize.textContent = _formatSize(totalSize);
        if (footerLastMod) footerLastMod.textContent = lastMod ? ('última modificación ' + _formatDate(lastMod)) : '—';
    }

    /* ═══════════════════════════════════════════════════════════════
       RENDER — SKELETONS
       ═══════════════════════════════════════════════════════════════ */
    function _renderSkeletons() {
        var folderList = document.getElementById('folderList');
        var fileList = document.getElementById('fileList');

        if (folderList) {
            var folderHtml = '';
            for (var i = 0; i < 5; i++) {
                folderHtml += '<div class="kair-skeleton kair-skeleton--folder"></div>';
            }
            folderList.innerHTML = folderHtml;
        }

        if (fileList) {
            fileList.setAttribute('data-view', _state.viewMode);
            var fileHtml = '<div class="kair-file-grid">';
            for (var j = 0; j < 6; j++) {
                if (_state.viewMode === 'grid') {
                    fileHtml += '<div class="kair-skeleton kair-skeleton--grid"></div>';
                } else {
                    fileHtml += '<div class="kair-skeleton kair-skeleton--file"></div>';
                }
            }
            fileHtml += '</div>';
            fileList.innerHTML = fileHtml;
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       NAVEGACIÓN — Carpetas
       ═══════════════════════════════════════════════════════════════ */
    function _navigateToRoot() {
        _log('NAV_ROOT', 'START');
        if (_state.pathHistory.length > 0 || _state.currentFolderPath !== _state.basePath) {
            _state.pathHistory = [];
            _state.currentFolderPath = _state.basePath;
            _loadFolders(true);
        }
    }

    function _navigateToPath(path) {
        _log('NAV_PATH', 'START', { path: path });
        if (path === _state.currentFolderPath) return;
        // Calcular historial correcto: desde currentFolderPath "volver" a path
        _state.pathHistory.push(_state.currentFolderPath);
        _state.currentFolderPath = path;
        _loadDocumentsForCurrent();
    }

    function _selectFolder(path) {
        if (path === _state.currentFolderPath) return;
        _log('SELECT_FOLDER', 'START', { path: path });
        _state.pathHistory.push(_state.currentFolderPath);
        _state.currentFolderPath = path;

        // Reset selección visual
        document.querySelectorAll('.kair-folder').forEach(function (el) {
            el.classList.remove('is-active');
        });
        var selEl = document.querySelector('.kair-folder[data-path="' + path.replace(/"/g, '\\"') + '"]');
        if (selEl) selEl.classList.add('is-active');

        _loadDocumentsForCurrent();
    }

    function _goUpLevel() {
        if (_state.pathHistory.length === 0) {
            _showToast('Ya estás en la raíz', 'info');
            return;
        }
        _log('GO_UP', 'START');
        var prevPath = _state.pathHistory.pop();
        _state.currentFolderPath = prevPath;
        _loadDocumentsForCurrent();
    }

    /* ═══════════════════════════════════════════════════════════════
       CARGA DE DATOS — Carpeta inicial / raíz
       ═══════════════════════════════════════════════════════════════ */
    function _loadFolders(isRefresh) {
        _log('LOAD_FOLDERS', 'START');
        _showLoading(isRefresh ? 'Refrescando...' : 'Cargando...');

        var urlParams = new URLSearchParams(window.location.search);
        _state.company = urlParams.get('company') || '';
        _state.moduleName = urlParams.get('module') || '';
        _state.submoduleName = urlParams.get('submodule') || '';

        // Actualizar header
        var companyEl = document.getElementById('companyName');
        if (companyEl) companyEl.textContent = _state.company || '—';

        if (!_state.company || !_state.moduleName || !_state.submoduleName) {
            _showToast('Faltan parámetros en la URL (company/module/submodule)', 'error', 5000);
            _hideLoading();
            return;
        }

        _renderSkeletons();

        _callParentAPI('get-document-folders', {
            companyName: _state.company,
            moduleName: _state.moduleName,
            submoduleName: _state.submoduleName
        }).then(function (result) {
            _state.basePath = result.basePath;
            _state.currentFolderPath = result.basePath;
            _state.pathHistory = [];
            _state.folders = result.folders || [];
            _state.documents = result.files || [];

            _renderBreadcrumb();
            _renderFolders();
            _renderDocuments();
            _log('LOAD_FOLDERS', 'SUCCESS', {
                folders: _state.folders.length,
                files: _state.documents.length
            });
        }).catch(function (error) {
            _err('LOAD_FOLDERS', error);
            _showToast('Error al cargar contenido inicial: ' + error.message, 'error', 5000);
        }).finally(function () {
            _hideLoading();
        });
    }

    function _loadDocumentsForCurrent() {
        _log('LOAD_DOCS', 'START', { path: _state.currentFolderPath });
        _showLoading('Cargando documentos...');
        _renderSkeletons();

        _callParentAPI('get-documents-in-folder', _state.currentFolderPath).then(function (result) {
            _state.documents = result.files || [];
            _renderBreadcrumb();
            _renderFolders();
            _renderDocuments();
            _log('LOAD_DOCS', 'SUCCESS', { count: _state.documents.length });
        }).catch(function (error) {
            _err('LOAD_DOCS', error);
            _showToast('Error al cargar documentos: ' + error.message, 'error', 5000);
        }).finally(function () {
            _hideLoading();
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       SELECCIÓN Y PREVIEW DE DOCUMENTOS
       ═══════════════════════════════════════════════════════════════ */
    function _selectDocument(doc) {
        _log('SELECT_DOC', 'START', { name: doc.name });
        _state.currentDocument = doc;

        var docName = document.getElementById('docName');
        if (docName) {
            docName.textContent = doc.name;
            // Atributo title para que el usuario vea el nombre completo en hover
            // (el nombre se trunca con ellipsis en el header del preview)
            docName.setAttribute('title', doc.name);
        }

        // Resaltar selección
        document.querySelectorAll('.kair-file').forEach(function (el) {
            el.classList.remove('is-active');
        });
        var activeEl = document.querySelector('.kair-file[data-path="' + doc.path.replace(/"/g, '\\"') + '"]');
        if (activeEl) activeEl.classList.add('is-active');

        // Si preview está colapsado, expandirlo
        if (_state.isPreviewCollapsed) {
            _togglePreviewCollapse();
        }

        // Ocultar empty state
        var emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.style.display = 'none';

        _enableDocActions(true);
        _showLoading('Cargando vista previa...');

        var extension = (doc.extension || '').toLowerCase().replace('.', '');

        if (extension === 'pdf') {
            _loadPDF(doc.path);
        } else if (extension === 'xls' || extension === 'xlsx') {
            _loadExcel(doc.path);
        } else if (extension === 'doc' || extension === 'docx') {
            _loadWord(doc.path);
        } else {
            _showUnsupportedMessage(extension);
        }
    }

    function _loadPDF(filePath) {
        _callParentAPI('get-pdf-preview', { filePath: filePath }).then(function (result) {
            _displayPDF(result.data);
        }).catch(function (error) {
            _showErrorInViewer('Error al cargar PDF: ' + error.message);
        });
    }

    function _loadExcel(filePath) {
        _callParentAPI('get-excel-preview', { filePath: filePath }).then(function (result) {
            _displayPDF(result.data); // Excel → PDF para preview unificado
        }).catch(function (error) {
            _showErrorInViewer('Error al cargar Excel: ' + error.message);
        });
    }

    function _loadWord(filePath) {
        _callParentAPI('get-word-preview', { filePath: filePath }).then(function (result) {
            _displayPDF(result.data); // Word → PDF para preview unificado
        }).catch(function (error) {
            _showErrorInViewer('Error al cargar Word: ' + error.message);
        });
    }

    function _displayPDF(pdfData) {
        _hideLoading();
        var viewerContainer = document.getElementById('viewerContainer');
        if (!viewerContainer) return;
        var toolbar = document.getElementById('previewToolbar');
        if (toolbar) toolbar.classList.add('is-visible');

        viewerContainer.innerHTML =
            '<iframe id="docFrame" class="kair-pdf-frame" src="data:application/pdf;base64,' + pdfData + '"></iframe>';

        _state.currentZoom = 100;
        _updateZoomDisplay();
    }

    function _showUnsupportedMessage(extension) {
        _hideLoading();
        var viewerContainer = document.getElementById('viewerContainer');
        var toolbar = document.getElementById('previewToolbar');
        if (toolbar) toolbar.classList.remove('is-visible');

        if (viewerContainer) {
            viewerContainer.innerHTML =
                '<div class="kair-preview-error">' +
                '<i class="bi bi-file-earmark" style="font-size: 2rem; color: var(--kair-text-muted);"></i>' +
                '<h3>Vista previa no disponible</h3>' +
                '<p>La previsualización interna no está disponible para archivos <strong>.' + _esc(extension) + '</strong>.</p>' +
                '<p>Puedes usar el botón de descarga para abrirlo externamente.</p>' +
                '</div>';
        }
    }

    function _showErrorInViewer(message) {
        _hideLoading();
        var viewerContainer = document.getElementById('viewerContainer');
        var toolbar = document.getElementById('previewToolbar');
        if (toolbar) toolbar.classList.remove('is-visible');

        if (viewerContainer) {
            viewerContainer.innerHTML =
                '<div class="kair-preview-error">' +
                '<i class="bi bi-exclamation-triangle" style="font-size: 2rem; color: var(--kair-danger);"></i>' +
                '<h3>Error de carga</h3>' +
                '<p>' + _esc(message) + '</p>' +
                '</div>';
        }
    }

    function _closeDocument() {
        _log('CLOSE_DOC', 'START');
        _state.currentDocument = null;

        var emptyState = document.getElementById('emptyState');
        var viewerContainer = document.getElementById('viewerContainer');
        var toolbar = document.getElementById('previewToolbar');
        var docName = document.getElementById('docName');

        if (docName) {
            docName.textContent = 'Selecciona un documento';
            docName.setAttribute('title', '');
        }
        if (toolbar) toolbar.classList.remove('is-visible');

        if (viewerContainer) {
            viewerContainer.innerHTML =
                '<div class="kair-empty" id="emptyState">' +
                '<div class="kair-empty__icon"><i class="bi bi-file-earmark-richtext"></i></div>' +
                '<h3 class="kair-empty__title">Vista previa no disponible</h3>' +
                '<p class="kair-empty__desc">Selecciona un documento de la lista para visualizarlo aquí.</p>' +
                '</div>';
        }

        _enableDocActions(false);
        document.querySelectorAll('.kair-file').forEach(function (el) {
            el.classList.remove('is-active');
        });
    }

    function _enableDocActions(enable) {
        var btnIds = ['closeDocBtn', 'downloadBtn', 'printBtn'];
        btnIds.forEach(function (id) {
            var btn = document.getElementById(id);
            if (btn) {
                btn.disabled = !enable;
            }
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       DESCARGA / IMPRESIÓN
       ═══════════════════════════════════════════════════════════════ */
    function _downloadDocument() {
        if (!_state.currentDocument) return;
        _log('DOWNLOAD_DOC', 'START', { name: _state.currentDocument.name });
        _showToast('Preparando descarga...', 'info');

        _callParentAPI('download-document', _state.currentDocument.path).then(function (result) {
            var binaryData = atob(result.base64Data);
            var bytes = new Uint8Array(binaryData.length);
            for (var i = 0; i < binaryData.length; i++) {
                bytes[i] = binaryData.charCodeAt(i);
            }

            var blob = new Blob([bytes], { type: 'application/octet-stream' });
            var url = URL.createObjectURL(blob);
            var link = document.createElement('a');
            link.href = url;
            link.download = result.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            _showToast('Descarga completada', 'success');
            _log('DOWNLOAD_DOC', 'SUCCESS');
        }).catch(function (error) {
            _err('DOWNLOAD_DOC', error);
            _showToast('Error en descarga: ' + error.message, 'error');
        });
    }

    function _printDocument() {
        if (!_state.currentDocument) return;
        _log('PRINT_DOC', 'START');

        var iframe = document.getElementById('docFrame');
        if (iframe && iframe.contentWindow) {
            try {
                iframe.contentWindow.print();
                _log('PRINT_DOC', 'SUCCESS');
                return;
            } catch (e) {
                _err('PRINT_DOC', e);
            }
        }
        _printConvertedDocument(_state.currentDocument.path, _state.currentDocument.extension);
    }

    function _printConvertedDocument(filePath, extension) {
        _showToast('Preparando impresión...', 'info');
        var ext = (extension || '').toLowerCase();
        var apiType = 'get-pdf-preview';
        if (ext.indexOf('xls') !== -1) apiType = 'get-excel-preview';
        if (ext.indexOf('doc') !== -1) apiType = 'get-word-preview';

        _callParentAPI(apiType, { filePath: filePath }).then(function (result) {
            var printWindow = window.open('', '_blank');
            if (!printWindow) {
                _showToast('Bloqueador de popups activo. Permite popups para imprimir.', 'warning', 5000);
                return;
            }
            printWindow.document.write(
                '<html><body style="margin:0;">' +
                '<iframe src="data:application/pdf;base64,' + result.data + '" ' +
                'style="width:100%; height:100vh; border:none;" ' +
                'onload="window.print(); window.onafterprint = function() { window.close(); }">' +
                '</iframe></body></html>'
            );
            printWindow.document.close();
            _log('PRINT_DOC', 'SUCCESS');
        }).catch(function (error) {
            _err('PRINT_DOC', error);
            _showToast('Error al imprimir: ' + error.message, 'error');
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       ZOOM
       ═══════════════════════════════════════════════════════════════ */
    function _zoomIn() {
        _state.currentZoom = Math.min(_state.currentZoom + 10, 400);
        _applyZoom();
    }

    function _zoomOut() {
        _state.currentZoom = Math.max(_state.currentZoom - 10, 20);
        _applyZoom();
    }

    function _fitWidth() {
        _state.currentZoom = 'width';
        _applyZoom();
    }

    function _applyZoom() {
        var iframe = document.getElementById('docFrame');
        if (!iframe) return;

        _updateZoomDisplay();

        var src = iframe.src.split('#')[0];
        var zoomParam = (_state.currentZoom === 'width') ? '#view=FitH' : '#zoom=' + _state.currentZoom;
        iframe.src = src + zoomParam;
    }

    function _updateZoomDisplay() {
        var display = document.getElementById('zoomLevelDisplay');
        if (display) {
            display.textContent = (_state.currentZoom === 'width') ? 'Ancho' : _state.currentZoom + '%';
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       DRAG & DROP (conservado por carpeta)
       ═══════════════════════════════════════════════════════════════ */
    function _setupFolderDragAndDrop(folderElement, folderPath) {
        var dragCounter = 0;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (eventName) {
            folderElement.addEventListener(eventName, _preventDefaults, false);
        });

        folderElement.addEventListener('dragenter', function () {
            dragCounter++;
            if (dragCounter === 1) {
                folderElement.classList.add('is-drag-over');
                _log('DRAG_ENTER', 'START', { folder: folderPath });
            }
        }, false);

        folderElement.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }, false);

        folderElement.addEventListener('dragleave', function () {
            dragCounter--;
            if (dragCounter === 0) {
                folderElement.classList.remove('is-drag-over');
            }
        }, false);

        folderElement.addEventListener('drop', function (e) {
            e.preventDefault();
            dragCounter = 0;
            folderElement.classList.remove('is-drag-over');

            var files = e.dataTransfer.files;
            if (files.length === 0) {
                _showToast('No se detectaron archivos', 'warning');
                return;
            }

            _log('DROP', 'START', { count: files.length, folder: folderPath });
            Array.from(files).forEach(function (file) {
                _uploadFile(file, folderPath);
            });
        }, false);
    }

    function _preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function _uploadFile(file, folderPath) {
        _log('UPLOAD', 'START', { name: file.name, folder: folderPath });

        // Validación de tamaño
        if (file.size > _MAX_FILE_SIZE_BYTES) {
            _showToast('El archivo "' + file.name + '" supera el tamaño máximo de 10MB', 'warning', 5000);
            return;
        }

        // Validación de caracteres
        if (_INVALID_CHARS.test(file.name)) {
            _showToast('El nombre del archivo contiene caracteres inválidos: &lt;&gt;:&quot;/\\|?*', 'warning', 5000);
            return;
        }

        _showToast('Subiendo "' + file.name + '"...', 'info');

        _fileToBase64(file).then(function (base64Data) {
            var destinationPath = folderPath || _state.currentFolderPath;
            if (!destinationPath) {
                _showToast('No hay una carpeta seleccionada', 'error');
                return;
            }
            return _callParentAPI('upload-document', {
                fileName: file.name,
                base64Data: base64Data,
                destinationPath: destinationPath
            });
        }).then(function (result) {
            _showToast(result.message || 'Archivo subido correctamente', 'success');
            _log('UPLOAD', 'SUCCESS', { name: file.name });
            _loadDocumentsForCurrent();
        }).catch(function (error) {
            _err('UPLOAD', error);
            _showToast('Error al subir "' + file.name + '": ' + error.message, 'error', 5000);
        });
    }

    function _fileToBase64(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function (error) { reject(error); };
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       CONTEXT MENU
       ═══════════════════════════════════════════════════════════════ */
    function _showContextMenu(x, y, doc) {
        var menu = document.getElementById('contextMenu');
        if (!menu) return;

        _state.contextMenuDoc = doc;
        menu.classList.add('is-visible');
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        // Ajuste si se sale de pantalla
        var rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
        }

        _log('CONTEXT_MENU', 'SHOW', { name: doc.name });
    }

    function _hideContextMenu() {
        var menu = document.getElementById('contextMenu');
        if (menu) menu.classList.remove('is-visible');
        _state.contextMenuDoc = null;
    }

    function _openFile(doc) {
        doc = doc || _state.contextMenuDoc;
        if (!doc) {
            _showToast('No hay archivo seleccionado', 'error');
            return;
        }

        _log('OPEN_FILE', 'START', { name: doc.name });
        _callParentAPI('open-file', { filePath: doc.path }).then(function (result) {
            if (!result.success) {
                _showToast('Error al abrir archivo: ' + (result.error || ''), 'error');
            } else {
                _log('OPEN_FILE', 'SUCCESS', { name: doc.name });
            }
        }).catch(function (error) {
            _err('OPEN_FILE', error);
            _showToast('Error al abrir: ' + error.message, 'error');
        });

        _hideContextMenu();
    }

    function _deleteDocument() {
        if (!_state.contextMenuDoc) {
            _showToast('No hay archivo seleccionado', 'error');
            return;
        }
        var doc = _state.contextMenuDoc;

        _log('DELETE_DOC', 'CONFIRM_MODAL', { name: doc.name });
        _showConfirmModal(doc.name, function () {
            _log('DELETE_DOC', 'START', { name: doc.name });

            // Cerrar preview primero para liberar el archivo (evita EPERM)
            _closeDocument();

            _callParentAPI('delete-document', { filePath: doc.path }).then(function (result) {
                _log('DELETE_DOC', 'SUCCESS', { name: doc.name });
                _showToast('Archivo eliminado correctamente', 'success');
                _loadDocumentsForCurrent();
            }).catch(function (error) {
                _err('DELETE_DOC', error);
                var msg = error.message || '';
                if (msg.indexOf('EPERM') !== -1) {
                    _showToast('El archivo está abierto en otra aplicación. Ciérralo e intenta nuevamente.', 'warning', 6000);
                } else if (msg.indexOf('ENOENT') !== -1) {
                    _showToast('El archivo no existe. Puede que ya haya sido eliminado.', 'info');
                    _loadDocumentsForCurrent();
                } else if (msg.indexOf('EACCES') !== -1) {
                    _showToast('No tienes permisos para eliminar este archivo.', 'error');
                } else {
                    _showToast('Error al eliminar: ' + msg, 'error', 5000);
                }
            });
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       CONFIRM MODAL
       ═══════════════════════════════════════════════════════════════ */
    function _showConfirmModal(fileName, callback) {
        var modal = document.getElementById('confirmModal');
        var fileNameEl = document.getElementById('confirmFileName');
        if (!modal || !fileNameEl) return;

        fileNameEl.textContent = fileName;
        _state.confirmCallback = callback;
        modal.classList.add('is-visible');

        var cancelBtn = document.getElementById('confirmCancelBtn');
        if (cancelBtn) cancelBtn.focus();
    }

    function _hideConfirmModal() {
        var modal = document.getElementById('confirmModal');
        if (modal) modal.classList.remove('is-visible');
        _state.confirmCallback = null;
    }

    function _acceptConfirm() {
        if (typeof _state.confirmCallback === 'function') {
            _state.confirmCallback();
        }
        _hideConfirmModal();
    }

    /* ═══════════════════════════════════════════════════════════════
       TOGGLE VISTA / SIDEBAR / PREVIEW
       ═══════════════════════════════════════════════════════════════ */
    function _setViewMode(mode) {
        if (mode !== 'list' && mode !== 'grid') return;
        if (_state.viewMode === mode) return;
        _state.viewMode = mode;
        _savePrefs();

        // Toggle UI buttons + aria-pressed
        var listBtn = document.getElementById('viewListBtn');
        var gridBtn = document.getElementById('viewGridBtn');
        if (listBtn) {
            listBtn.classList.toggle('is-active', mode === 'list');
            listBtn.setAttribute('aria-pressed', mode === 'list' ? 'true' : 'false');
        }
        if (gridBtn) {
            gridBtn.classList.toggle('is-active', mode === 'grid');
            gridBtn.setAttribute('aria-pressed', mode === 'grid' ? 'true' : 'false');
        }

        _renderDocuments();
        _log('VIEW_MODE', 'SET', { mode: mode });
    }

    function _toggleSidebarCollapse() {
        _state.isSidebarCollapsed = !_state.isSidebarCollapsed;
        _savePrefs();
        var layout = document.getElementById('docsLayout');
        if (layout) layout.classList.toggle('is-sidebar-collapsed', _state.isSidebarCollapsed);
        _log('SIDEBAR', 'TOGGLE', { collapsed: _state.isSidebarCollapsed });
    }

    function _togglePreviewCollapse() {
        _state.isPreviewCollapsed = !_state.isPreviewCollapsed;
        _savePrefs();
        var layout = document.getElementById('docsLayout');
        if (layout) layout.classList.toggle('is-preview-collapsed', _state.isPreviewCollapsed);
        _log('PREVIEW', 'TOGGLE', { collapsed: _state.isPreviewCollapsed });
    }

    /* ═══════════════════════════════════════════════════════════════
       BÚSQUEDA (con debounce)
       ═══════════════════════════════════════════════════════════════ */
    function _handleSearchInput(value) {
        var clearBtn = document.getElementById('searchClearBtn');
        if (clearBtn) clearBtn.classList.toggle('is-visible', !!value);

        if (_state.searchDebounceTimer) {
            clearTimeout(_state.searchDebounceTimer);
        }
        _state.searchDebounceTimer = setTimeout(function () {
            _state.searchQuery = value.trim();
            _renderDocuments();
            _log('SEARCH', 'EXEC', { query: _state.searchQuery });
        }, _SEARCH_DEBOUNCE_MS);
    }

    function _clearSearch() {
        var input = document.getElementById('searchInput');
        if (input) input.value = '';
        _state.searchQuery = '';
        var clearBtn = document.getElementById('searchClearBtn');
        if (clearBtn) clearBtn.classList.remove('is-visible');
        _renderDocuments();
    }

    /* ═══════════════════════════════════════════════════════════════
       UPLOAD (botón principal)
       ═══════════════════════════════════════════════════════════════ */
    function _handleUploadClick() {
        var input = document.getElementById('hiddenFileInput');
        if (!input) return;
        input.click();
    }

    function _handleFileInputChange(e) {
        var files = e.target.files;
        if (!files || files.length === 0) return;
        Array.from(files).forEach(function (file) {
            _uploadFile(file, _state.currentFolderPath);
        });
        // Reset para permitir volver a subir el mismo archivo
        e.target.value = '';
    }

    /* ═══════════════════════════════════════════════════════════════
       VOLVER AL MÓDULO PADRE
       ═══════════════════════════════════════════════════════════════ */
    function _backToModule() {
        _log('BACK_TO_MODULE', 'START');
        if (window.parent && window.parent.postMessage) {
            window.parent.postMessage({ type: 'back-to-module-request' }, '*');
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       BIND EVENTS
       ═══════════════════════════════════════════════════════════════ */
    function _bindEvents() {
        // Header
        var backBtn = document.getElementById('backToModuleBtn');
        if (backBtn) backBtn.addEventListener('click', _backToModule);

        var uploadBtn = document.getElementById('uploadBtn');
        if (uploadBtn) uploadBtn.addEventListener('click', _handleUploadClick);

        var refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) refreshBtn.addEventListener('click', function () { _loadFolders(true); });

        // Toolbar
        var searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function (e) {
                _handleSearchInput(e.target.value);
            });
        }

        var searchClearBtn = document.getElementById('searchClearBtn');
        if (searchClearBtn) searchClearBtn.addEventListener('click', _clearSearch);

        var sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.value = _state.sortBy;
            sortSelect.addEventListener('change', function (e) {
                _state.sortBy = e.target.value;
                _savePrefs();
                _renderDocuments();
            });
        }

        var viewListBtn = document.getElementById('viewListBtn');
        if (viewListBtn) viewListBtn.addEventListener('click', function () { _setViewMode('list'); });

        var viewGridBtn = document.getElementById('viewGridBtn');
        if (viewGridBtn) viewGridBtn.addEventListener('click', function () { _setViewMode('grid'); });

        // Sidebar collapse
        var sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
        if (sidebarCollapseBtn) sidebarCollapseBtn.addEventListener('click', _toggleSidebarCollapse);

        // Preview
        var previewCollapseBtn = document.getElementById('previewCollapseBtn');
        if (previewCollapseBtn) previewCollapseBtn.addEventListener('click', _togglePreviewCollapse);

        var downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) downloadBtn.addEventListener('click', _downloadDocument);

        var printBtn = document.getElementById('printBtn');
        if (printBtn) printBtn.addEventListener('click', _printDocument);

        var closeDocBtn = document.getElementById('closeDocBtn');
        if (closeDocBtn) closeDocBtn.addEventListener('click', _closeDocument);

        // Zoom
        var zoomInBtn = document.getElementById('zoomInBtn');
        if (zoomInBtn) zoomInBtn.addEventListener('click', _zoomIn);
        var zoomOutBtn = document.getElementById('zoomOutBtn');
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', _zoomOut);
        var fitWidthBtn = document.getElementById('fitWidthBtn');
        if (fitWidthBtn) fitWidthBtn.addEventListener('click', _fitWidth);

        // Hidden file input
        var hiddenInput = document.getElementById('hiddenFileInput');
        if (hiddenInput) hiddenInput.addEventListener('change', _handleFileInputChange);

        // Context menu
        var openFileBtn = document.getElementById('openFileBtn');
        if (openFileBtn) openFileBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            _openFile();
        });
        var deleteFileBtn = document.getElementById('deleteFileBtn');
        if (deleteFileBtn) deleteFileBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            _deleteDocument();
        });

        // Cerrar context menu al hacer clic fuera
        document.addEventListener('click', _hideContextMenu);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                _hideContextMenu();
                var modal = document.getElementById('confirmModal');
                if (modal && modal.classList.contains('is-visible')) {
                    _hideConfirmModal();
                }
            }
        });

        // Confirm modal
        var confirmAcceptBtn = document.getElementById('confirmAcceptBtn');
        if (confirmAcceptBtn) confirmAcceptBtn.addEventListener('click', _acceptConfirm);
        var confirmCancelBtn = document.getElementById('confirmCancelBtn');
        if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', _hideConfirmModal);
        var confirmModal = document.getElementById('confirmModal');
        if (confirmModal) {
            confirmModal.addEventListener('click', function (e) {
                if (e.target === confirmModal) _hideConfirmModal();
            });
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       APLICAR PREFERENCIAS UI (al iniciar)
       ═══════════════════════════════════════════════════════════════ */
    function _applyPrefsToUI() {
        // View mode (segmented: is-active + aria-pressed)
        var listBtn = document.getElementById('viewListBtn');
        var gridBtn = document.getElementById('viewGridBtn');
        if (listBtn) {
            listBtn.classList.toggle('is-active', _state.viewMode === 'list');
            listBtn.setAttribute('aria-pressed', _state.viewMode === 'list' ? 'true' : 'false');
        }
        if (gridBtn) {
            gridBtn.classList.toggle('is-active', _state.viewMode === 'grid');
            gridBtn.setAttribute('aria-pressed', _state.viewMode === 'grid' ? 'true' : 'false');
        }

        // Sort
        var sortSelect = document.getElementById('sortSelect');
        if (sortSelect) sortSelect.value = _state.sortBy;

        // Layout collapses
        var layout = document.getElementById('docsLayout');
        if (layout) {
            layout.classList.toggle('is-sidebar-collapsed', _state.isSidebarCollapsed);
            layout.classList.toggle('is-preview-collapsed', _state.isPreviewCollapsed);
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       API PÚBLICA
       ═══════════════════════════════════════════════════════════════ */
    function init() {
        _log('INIT', 'START');
        _loadPrefs();
        _setupThemeSync();
        _bindEvents();
        _applyPrefsToUI();
        _loadFolders(false);
        _log('INIT', 'SUCCESS');
    }

    function destroy() {
        // Limpiar timers
        if (_state.searchDebounceTimer) {
            clearTimeout(_state.searchDebounceTimer);
        }
        // Limpiar theme sync
        _teardownThemeSync();
        // Reset estado
        _state.currentDocument = null;
        _state.contextMenuDoc = null;
        _state.confirmCallback = null;
        _state.documents = [];
        _state.folders = [];
        _log('DESTROY', 'SUCCESS');
    }

    // Exponer funciones globales para compatibilidad con HTML inline (si las hay)
    // y para debugging desde la consola del iframe.
    window.TrabajoAltoRiesgoViewerGoUp = _goUpLevel;
    window.TrabajoAltoRiesgoViewerResetToRoot = _navigateToRoot;
    window.TrabajoAltoRiesgoViewerShowToast = _showToast;
    window.TrabajoAltoRiesgoViewerShowConfirm = _showConfirmModal;
    window.TrabajoAltoRiesgoViewerHideConfirm = _hideConfirmModal;

    return {
        init: init,
        destroy: destroy,
        // Exponer para debugging/testing
        _callParentAPI: _callParentAPI,
        _state: _state
    };
})();

window.TrabajoAltoRiesgoViewer = TrabajoAltoRiesgoViewer;

/* ═══════════════════════════════════════════════════════════════════
   AUTO-INIT AL CARGAR EL DOM
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
    TrabajoAltoRiesgoViewer.init();
});
