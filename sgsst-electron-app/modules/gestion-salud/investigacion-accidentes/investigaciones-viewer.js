// ============================================================================
// investigaciones-viewer.js — Gestor de Investigaciones de Accidentes
// Conecta con backend IPC handlers reales (no demo data)
// ============================================================================
(function() {
    'use strict';

    // ─── Estado ─────────────────────────────────────────────────────────
    let investigations = [];
    let filteredInvestigations = [];
    let currentFilter = 'todas';
    let searchQuery = '';
    let toastTimeout = null;
    let companyName = '';
    let moduleName = '';
    let submoduleName = '';

    // ─── Helper: comunicar con parent (renderer.js bridge) ─────────────
    /**
     * Envía una solicitud al proceso padre (renderer) via postMessage.
     * El renderer.js bridge la rutea al handler IPC correspondiente.
     */
    function callParentAPI(type, payload) {
        return new Promise(function(resolve, reject) {
            var requestId = 'req-' + Date.now() + '-' + Math.random();

            function handleResponse(event) {
                if (event.source !== window.parent) return;
                var response = event.data;
                if (response.type === (type + '-response') && response.requestId === requestId) {
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
        // Leer parámetros de URL
        var urlParams = new URLSearchParams(window.location.search);
        companyName = urlParams.get('company') || '';
        moduleName = urlParams.get('module') || '';
        submoduleName = urlParams.get('submodule') || '';

        console.log('[INV-MGR] Iniciando gestión de investigaciones. Company:', companyName);

        setupEventListeners();
        loadAllData();
    });

    // ─── Carga de datos ─────────────────────────────────────────────────

    async function loadAllData() {
        showLoading();
        try {
            // Cargar stats y lista en paralelo
            var results = await Promise.allSettled([
                loadStats(),
                loadInvestigations()
            ]);

            // Verificar si hubo errores
            results.forEach(function(r, i) {
                if (r.status === 'rejected') {
                    console.warn('[INV-MGR] Error en carga parcial (operación ' + i + '):', r.reason);
                }
            });

        } catch (error) {
            console.error('[INV-MGR] Error catastrófico en loadAllData:', error);
            renderEmpty('Error al cargar datos. Intente refrescar la página.');
        } finally {
            hideLoading();
        }
    }

    async function loadStats() {
        try {
            var result = await callParentAPI('investigacion-accidentes-get-stats', { companyName: companyName });
            if (result && result.data) {
                document.getElementById('statPendientes').textContent = result.data.pendientes;
                document.getElementById('statCompletadas').textContent = result.data.completadas;
                document.getElementById('statTotal').textContent = result.data.total;
            }
        } catch (error) {
            console.warn('[INV-MGR] No se pudieron cargar estadísticas:', error.message);
            // Mantener 0 como fallback
        }
    }

    async function loadInvestigations() {
        try {
            var result = await callParentAPI('investigacion-accidentes-list-investigations', {
                companyName: companyName,
                filter: 'todas'
            });
            if (result && result.data) {
                investigations = result.data;
            } else {
                investigations = [];
            }
            applyFilters();
        } catch (error) {
            console.error('[INV-MGR] Error cargando investigaciones:', error.message);
            investigations = [];
            applyFilters();
        }
    }

    // ─── Renderizado ───────────────────────────────────────────────────

    function updateStats() {
        var pendientes = investigations.filter(function(i) { return i.estado === 'pendiente'; }).length;
        var completadas = investigations.filter(function(i) { return i.estado === 'completada'; }).length;
        document.getElementById('statPendientes').textContent = pendientes;
        document.getElementById('statCompletadas').textContent = completadas;
        document.getElementById('statTotal').textContent = investigations.length;
    }

    function applyFilters() {
        filteredInvestigations = investigations.filter(function(inv) {
            if (currentFilter !== 'todas' && inv.estado !== currentFilter) {
                return false;
            }
            if (searchQuery) {
                var query = searchQuery.toLowerCase();
                var matchName = inv.nombre.toLowerCase().includes(query);
                var matchFiles = inv.archivos && inv.archivos.some(function(f) {
                    return f.name.toLowerCase().includes(query);
                });
                return matchName || matchFiles;
            }
            return true;
        });
        renderInvestigations(filteredInvestigations);
    }

    function renderInvestigations(items) {
        var container = document.getElementById('investigationsList');

        if (!items || items.length === 0) {
            var message = searchQuery
                ? 'No se encontraron investigaciones que coincidan con la búsqueda.'
                : currentFilter !== 'todas'
                    ? 'No hay investigaciones ' + currentFilter + 's.'
                    : 'No hay investigaciones registradas.';
            renderEmpty(message);
            return;
        }

        // Agrupar por año (el backend entrega ordenado por fecha desc, el orden se preserva)
        var yearMap = new Map();
        items.forEach(function(inv) {
            var year = inv.año ? inv.año : (function() {
                var d = inv.fecha ? new Date(inv.fecha) : null;
                return (d && !isNaN(d.getFullYear())) ? d.getFullYear() : 'Sin fecha';
            }());
            if (!yearMap.has(year)) yearMap.set(year, []);
            yearMap.get(year).push(inv);
        });

        // Ordenar años descendente; 'Sin fecha' siempre al final
        var years = Array.from(yearMap.keys()).sort(function(a, b) {
            if (a === 'Sin fecha') return 1;
            if (b === 'Sin fecha') return -1;
            return b - a;
        });

        // Con búsqueda activa, expandir todos los grupos para mostrar resultados
        var expandAll = !!searchQuery;

        var html = '';
        years.forEach(function(year, yearIndex) {
            var yearItems = yearMap.get(year);
            var pendientes = yearItems.filter(function(i) { return i.estado === 'pendiente'; }).length;
            var isCollapsed = !expandAll && yearIndex > 0;

            html += '<div class="inv-year-group' + (isCollapsed ? ' collapsed' : '') + '">';
            html += '  <div class="inv-year-header" onclick="window._toggleYearGroup(this)">';
            html += '    <div class="inv-year-header-left">';
            html += '      <i class="fas fa-calendar inv-year-icon"></i>';
            html += '      <span class="inv-year-label">' + escapeHtml(String(year)) + '</span>';
            html += '      <span class="inv-year-count-badge">' + yearItems.length + ' investigaci' + (yearItems.length !== 1 ? 'ones' : 'ón') + '</span>';
            if (pendientes > 0) {
                html += '      <span class="inv-year-pending-badge"><i class="fas fa-clock"></i> ' + pendientes + ' pendiente' + (pendientes !== 1 ? 's' : '') + '</span>';
            }
            html += '    </div>';
            html += '    <i class="fas fa-chevron-down inv-year-chevron"></i>';
            html += '  </div>';
            html += '  <div class="inv-year-content">';

            yearItems.forEach(function(inv, index) {
                var isPendiente = inv.estado === 'pendiente';
                var tipoClass = inv.tipo === 'carpeta' ? 'carpeta' : 'archivo';
                var tipoIcon = inv.tipo === 'carpeta' ? 'fa-folder' : 'fa-file-pdf';
                var statusClass = isPendiente ? 'pendiente' : 'completada';
                var statusIcon = isPendiente ? 'fa-clock' : 'fa-check-circle';
                var statusText = isPendiente ? 'Pendiente' : 'Completada';
                var fecha = inv.fecha ? formatDate(inv.fecha) : 'N/A';
                var totalArchivos = inv.totalArchivos || (inv.archivos ? inv.archivos.length : 0);
                var delay = (index * 0.05).toFixed(2);

                html += '<div class="inv-card" data-id="' + escapeHtml(inv.id) + '" style="animation-delay: ' + delay + 's">';
                html += '  <div class="inv-card-header" onclick="window._toggleCard(this)">';
                html += '    <div class="inv-card-type-icon ' + tipoClass + '">';
                html += '      <i class="fas ' + tipoIcon + '"></i>';
                html += '    </div>';
                html += '    <div class="inv-card-info">';
                html += '      <div class="inv-card-name" title="' + escapeHtml(inv.nombre) + '">' + escapeHtml(inv.nombre) + '</div>';
                html += '      <div class="inv-card-meta">';
                html += '        <span><i class="fas fa-calendar-alt"></i> ' + fecha + '</span>';
                html += '        <span><i class="fas fa-file-alt"></i> ' + totalArchivos + ' archivo' + (totalArchivos !== 1 ? 's' : '') + '</span>';
                html += '      </div>';
                html += '    </div>';
                html += '    <div class="inv-card-status ' + statusClass + '">';
                html += '      <i class="fas ' + statusIcon + '"></i> ' + statusText;
                html += '    </div>';
                html += '    <i class="fas fa-chevron-right inv-card-chevron"></i>';
                html += '  </div>';
                html += '  <div class="inv-card-details">';
                html += '    <div class="inv-files-title">Archivos</div>';
                html += renderFileList(inv.archivos || [], isPendiente);
                html += '    <div class="inv-card-actions">';
                if (isPendiente) {
                    // Prioridad 1: archivo cuyo nombre incluye "FURAT" y es PDF
                    var furatFile = (inv.archivos || []).find(function(f) {
                        return f.name.toUpperCase().includes('FURAT') && (f.extension || '').toLowerCase() === 'pdf';
                    });
                    // Prioridad 2: cualquier PDF en la investigación (casos donde el FURAT tiene otro nombre)
                    if (!furatFile) {
                        furatFile = (inv.archivos || []).find(function(f) {
                            return (f.extension || '').toLowerCase() === 'pdf';
                        });
                    }
                    var furatPath = furatFile ? furatFile.path : '';
                    html += '      <button class="inv-btn inv-btn-primary inv-btn-sm"'
                          + ' data-invnombre="' + escapeHtml(inv.nombre) + '"'
                          + ' data-furatpath="' + escapeHtml(furatPath) + '"'
                          + ' onclick="event.stopPropagation(); window._startInvestigation(this.dataset.invnombre, this.dataset.furatpath)">';
                    html += '        <i class="fas fa-search-plus"></i> Iniciar Investigación';
                    html += '      </button>';
                } else {
                    html += '      <span style="font-size: 0.8125rem; color: var(--inv-text-muted); display: flex; align-items: center; gap: 0.375rem;">';
                    html += '        <i class="fas fa-check-circle" style="color: var(--inv-success);"></i> Investigación completada';
                    html += '      </span>';
                }
                html += '    </div>';
                html += '  </div>';
                html += '</div>';
            });

            html += '  </div>'; // .inv-year-content
            html += '</div>';   // .inv-year-group
        });

        container.innerHTML = html;
    }

    function renderFileList(files, isPendiente) {
        if (!files || files.length === 0) {
            return '<p style="font-size: 0.8125rem; color: var(--inv-text-muted); padding: 0.5rem 0;">Sin archivos</p>';
        }

        var html = '';
        files.forEach(function(file) {
            var icon = getFileIcon(file.extension);
            var size = file.size ? formatFileSize(file.size) : '';
            var isReport = isReportFile(file.name);

            html += '<div class="inv-file-item">';
            html += '  <i class="fas ' + icon + '"></i>';
            html += '  <span class="inv-file-name" title="' + escapeHtml(file.name) + '">' + escapeHtml(file.name) + '</span>';
            if (size) html += '  <span class="inv-file-size">' + size + '</span>';
            if (isReport) html += '  <span class="inv-report-badge"><i class="fas fa-check-circle"></i> Informe</span>';
            html += '  <div class="inv-file-actions">';
            html += '    <button class="inv-file-action-btn"'
                  + ' data-filepath="' + escapeHtml(file.path) + '"'
                  + ' data-filename="' + escapeHtml(file.name) + '"'
                  + ' data-ext="' + escapeHtml(file.extension || '') + '"'
                  + ' onclick="event.stopPropagation(); window._previewFile(this.dataset.filepath, this.dataset.filename, this.dataset.ext)"'
                  + ' title="Previsualizar">';
            html += '      <i class="fas fa-eye"></i>';
            html += '    </button>';
            html += '  </div>';
            html += '</div>';
        });

        return html;
    }

    function renderEmpty(message) {
        var container = document.getElementById('investigationsList');
        container.innerHTML = '<div class="inv-empty">' +
            '<div class="inv-empty-icon"><i class="fas fa-inbox"></i></div>' +
            '<h3>Sin investigaciones</h3>' +
            '<p>' + message + '</p>' +
            '</div>';
    }

    function showLoading() {
        var container = document.getElementById('investigationsList');
        container.innerHTML = '<div class="inv-loading"><div class="inv-spinner"></div><p>Cargando investigaciones...</p></div>';
    }

    function hideLoading() {
        // El loading se reemplaza al renderizar
    }

    // ─── Eventos ────────────────────────────────────────────────────────

    function setupEventListeners() {
        // Volver
        document.getElementById('backBtn').addEventListener('click', function() {
            window.parent.postMessage({ type: 'back-to-module-request' }, '*');
        });

        // Refrescar
        document.getElementById('refreshBtn').addEventListener('click', function() {
            var icon = document.getElementById('refreshIcon');
            icon.classList.add('fa-spin');
            document.getElementById('investigationsList').innerHTML =
                '<div class="inv-loading"><div class="inv-spinner"></div><p>Actualizando...</p></div>';
            loadAllData().then(function() {
                icon.classList.remove('fa-spin');
                showToast('Actualizado', 'La lista ha sido actualizada.', 'info');
            }).catch(function() {
                icon.classList.remove('fa-spin');
                showToast('Error', 'No se pudo actualizar la lista.', 'error');
            });
        });

        // Filtros
        document.querySelectorAll('.inv-filter-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.inv-filter-btn').forEach(function(b) { b.classList.remove('active'); });
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

        // Drop zone
        var dropZone = document.getElementById('dropZone');
        var fileInput = document.getElementById('fileInput');

        dropZone.addEventListener('click', function() {
            fileInput.click();
        });

        fileInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                handleFileUpload(this.files[0]);
                this.value = '';
            }
        });

        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });

        // Modal
        document.getElementById('closePreviewBtn').addEventListener('click', closePreview);
        document.getElementById('previewOverlay').addEventListener('click', closePreview);

        // Toast close
        document.getElementById('toastClose').addEventListener('click', hideToast);
    }

    // ─── Funciones globales (onclick inline) ───────────────────────────

    window._toggleCard = function(headerEl) {
        var card = headerEl.closest('.inv-card');
        if (!card) return;
        card.classList.toggle('expanded');
    };

    window._toggleYearGroup = function(headerEl) {
        var group = headerEl.closest('.inv-year-group');
        if (!group) return;
        group.classList.toggle('collapsed');
    };

    window._previewFile = async function(filePath, fileName, extension) {
        var modal = document.getElementById('previewModal');
        var title = document.getElementById('previewTitle');
        var body = document.getElementById('previewBody');

        modal.classList.remove('hidden');
        title.textContent = fileName;
        body.innerHTML = '<div class="inv-loading"><div class="inv-spinner"></div><p>Cargando documento...</p></div>';

        try {
            var ext = extension.toLowerCase();
            var result;

            if (ext === 'pdf') {
                result = await callParentAPI('get-pdf-preview', { filePath: filePath });
            } else if (ext === 'xls' || ext === 'xlsx') {
                result = await callParentAPI('get-excel-preview', { filePath: filePath });
            } else if (ext === 'doc' || ext === 'docx') {
                result = await callParentAPI('get-word-preview', { filePath: filePath });
            } else {
                body.innerHTML = '<div class="inv-empty" style="padding: 2rem;"><div class="inv-empty-icon"><i class="fas fa-file"></i></div><h3>Vista previa no disponible</h3><p>El archivo .' + ext + ' no se puede previsualizar.</p></div>';
                return;
            }

            if (result && result.data) {
                body.innerHTML = '<iframe src="data:application/pdf;base64,' + result.data + '" style="width:100%;height:100%;border:none;"></iframe>';
            } else {
                body.innerHTML = '<div class="inv-empty" style="padding: 2rem;"><div class="inv-empty-icon"><i class="fas fa-exclamation-triangle"></i></div><h3>Error al cargar</h3><p>No se pudo obtener la vista previa del documento.</p></div>';
            }
        } catch (error) {
            console.error('[INV-MGR] Error en preview:', error);
            body.innerHTML = '<div class="inv-empty" style="padding: 2rem;"><div class="inv-empty-icon"><i class="fas fa-times-circle"></i></div><h3>Error</h3><p>' + escapeHtml(error.message) + '</p></div>';
        }
    };

    window._startInvestigation = function(invNombre, furatPath) {
        window.parent.postMessage({
            type: 'iniciar-investigacion-desde-viewer',
            investigacionNombre: invNombre || '',
            furatPath: furatPath || ''
        }, '*');
    };

    // ─── Upload de FURAT ────────────────────────────────────────────────

    async function handleFileUpload(file) {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            showToast('Error', 'Solo se permiten archivos PDF para FURATs.', 'error');
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            showToast('Error', 'El archivo es demasiado grande. Máximo 50MB.', 'error');
            return;
        }

        var dropZone = document.getElementById('dropZone');
        var uploadProgress = document.getElementById('uploadProgress');
        var uploadSuccess = document.getElementById('uploadSuccess');
        var progressFill = document.getElementById('uploadProgressFill');
        var progressText = document.getElementById('uploadProgressText');

        dropZone.classList.add('has-file');
        uploadProgress.classList.remove('hidden');
        uploadSuccess.classList.add('hidden');
        progressFill.style.width = '0%';
        progressFill.classList.remove('indeterminate');
        progressText.textContent = 'Leyendo archivo...';

        try {
            // Leer archivo como ArrayBuffer
            var arrayBuffer = await file.arrayBuffer();
            var uint8Array = new Uint8Array(arrayBuffer);

            // Enviar al backend via save-temp-pdf-file
            progressFill.classList.add('indeterminate');
            progressText.textContent = 'Guardando en carpeta de investigaciones...';

            var result = await callParentAPI('investigacion-accidentes-save-temp-pdf-file', {
                filename: file.name,
                data: Array.from(uint8Array)
            });

            if (result && result.success) {
                progressFill.classList.remove('indeterminate');
                progressFill.style.width = '100%';
                progressText.textContent = '¡FURAT guardado exitosamente!';

                document.getElementById('uploadSuccessText').textContent = '"' + file.name + '" guardado correctamente.';
                uploadSuccess.classList.remove('hidden');

                showToast('FURAT Guardado', '"' + file.name + '" se guardó correctamente.', 'success');

                // Recargar lista
                setTimeout(function() {
                    uploadProgress.classList.add('hidden');
                    dropZone.classList.remove('has-file');
                    loadAllData();
                }, 2000);
            } else {
                throw new Error((result && result.error) || 'Error desconocido al guardar');
            }
        } catch (error) {
            console.error('[INV-MGR] Error al subir FURAT:', error);
            showToast('Error al guardar', error.message, 'error');
            uploadProgress.classList.add('hidden');
            dropZone.classList.remove('has-file');
        }
    }

    // ─── Preview modal ─────────────────────────────────────────────────

    function closePreview() {
        document.getElementById('previewModal').classList.add('hidden');
        document.getElementById('previewBody').innerHTML = '';
    }

    // ─── Utilidades ────────────────────────────────────────────────────

    function getFileIcon(extension) {
        var icons = {
            pdf: 'fas fa-file-pdf',
            doc: 'fas fa-file-word',
            docx: 'fas fa-file-word',
            xls: 'fas fa-file-excel',
            xlsx: 'fas fa-file-excel',
            zip: 'fas fa-file-archive',
            jpg: 'fas fa-file-image',
            jpeg: 'fas fa-file-image',
            png: 'fas fa-file-image'
        };
        return icons[(extension || '').toLowerCase()] || 'fas fa-file';
    }

    function isReportFile(filename) {
        var lower = filename.toLowerCase();
        return lower.includes('informe') || lower.includes('reporte') ||
               lower.includes('investigacion') || lower.includes('investigación');
    }

    function formatFileSize(bytes) {
        if (!bytes) return '';
        if (bytes === 0) return '0 B';
        var k = 1024;
        var sizes = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function formatDate(isoString) {
        try {
            var date = new Date(isoString);
            return date.toLocaleDateString('es-CO', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch (e) {
            return isoString;
        }
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

        toast.className = 'inv-toast ' + type;
        icon.className = 'inv-toast-icon ' + (icons[type] || icons.info);
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
