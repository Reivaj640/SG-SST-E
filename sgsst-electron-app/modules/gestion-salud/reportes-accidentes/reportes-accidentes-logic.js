// reportes-accidentes-logic.js - Componente para la vista de reportes de accidentes FURAT
// Submódulo 3.2.1 · K+AIR · Sistema Visual Oficial

class ReportesAccidentesComponent {
    constructor(container, currentCompany, moduleName, submoduleName, backToModuleCallback) {
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.backToModuleCallback = backToModuleCallback;
    }

    render() {
        console.log('[FURAT][ReportesAccidentesComponent] Rendering...');

        // Crear iframe para el visualizador FURAT
        const viewerFrame = document.createElement('iframe');
        viewerFrame.id = 'furat-viewer-frame';
        viewerFrame.style.width = '100%';
        viewerFrame.style.minHeight = '100%';
        viewerFrame.style.border = 'none';
        viewerFrame.scrolling = 'auto';
        // 📦683 — Permitir scroll del iframe cuando el contenido es más grande
        viewerFrame.style.overflow = 'auto';

        // Construir la URL con parámetros de la empresa y módulo
        const viewerUrl = `./modules/gestion-salud/reportes-accidentes/reportes-accidentes-view.html?company=${encodeURIComponent(this.currentCompany)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        viewerFrame.src = viewerUrl;

        // Limpiar contenedor y agregar iframe
        this.container.innerHTML = '';
        this.container.style.height = 'auto';
        this.container.style.minHeight = '100%';
        // 📦683 — Permitir scroll del contenedor cuando el iframe es más grande
        this.container.style.overflow = 'auto';
        this.container.appendChild(viewerFrame);

        // Establecer comunicación entre frames
        this.setupFrameCommunication(viewerFrame);
    }

    setupFrameCommunication(viewerFrame) {
        // Escuchar mensajes del iframe
        const messageHandler = (event) => {
            // Solo procesar mensajes del propio iframe FURAT
            if (event.source !== viewerFrame.contentWindow) return;

            const data = event.data;

            // 📦608-fix15 — El iframe nos pide abrir el modal full-screen de file-viewer.
            if (data.type === 'open-file-viewer-modal') {
                if (!data.filePath) return;
                if (window.kairFV && typeof window.kairFV.openWithFileViewerFromPath === 'function') {
                    window.kairFV.openWithFileViewerFromPath(data.filePath);
                } else {
                    console.warn('[FURAT] kairFV.openWithFileViewerFromPath no disponible');
                }
                return;
            }

            // Manejar solicitud de regreso al módulo
            if (data.type === 'back-to-module-request') {
                console.log('[FURAT] Back to module requested');
                this.backToModuleCallback();
                return;
            }

            // Router de solicitudes API desde el iframe
            if (data.type && data.type.endsWith('-request')) {
                this.handleAPIRequest(data, event);
            }
        };

        window.addEventListener('message', messageHandler);

        // Guardar referencia para cleanup
        this._messageHandler = messageHandler;
    }

    async handleAPIRequest(data, event) {
        const requestId = data.requestId;
        const requestType = data.type.replace('-request', '');
        const payload = data.payload;

        console.log(`[FURAT] API Request: ${requestType}`, payload);

        // 📦608-fix15 — Previews unificados: el helper KairDocPreview hace el switch
        // a readFileBytes para Office y postea él mismo al iframe. Retornamos antes
        // del postMessage normal para evitar duplicar el response.
        if (requestType === 'get-pdf-preview' || requestType === 'get-word-preview' || requestType === 'get-excel-preview') {
            var apiName = {
                'get-pdf-preview': 'getPDFPreview',
                'get-word-preview': 'getWordPreview',
                'get-excel-preview': 'getExcelPreview'
            }[requestType];
            window.KairDocPreview.handleRequest(event, apiName);
            return;
        }

        try {
            let result;

            switch (requestType) {
                // Dashboard
                case 'furat-get-dashboard-data':
                    result = await this.getDashboardData(payload);
                    break;

                // Library
                case 'furat-get-library-data':
                    result = await this.getLibraryData(payload);
                    break;

                case 'download-document':
                    result = await window.electronAPI.downloadDocument(payload);
                    break;

                case 'get-document-folders':
                    result = await window.electronAPI.getDocumentFolders(payload);
                    break;

                case 'open-path':
                    result = await window.electronAPI.openPath(payload);
                    break;

                // 📦658 — Upload de FURAT (drag-and-drop + file picker)
                case 'furat-upload-file':
                    // El frontend ya resolvió la ruta del submódulo con findSubmodulePath.
                    // Solo necesitamos reenviar al IPC del main process.
                    if (!payload || !payload.submodulePath) {
                        // Fallback: resolver la ruta acá (en caso de que el frontend no la haya pasado)
                        const pathRes = await window.electronAPI.findSubmodulePath(
                            payload.companyName, payload.moduleName, payload.submoduleName
                        );
                        if (pathRes && pathRes.success) {
                            payload.submodulePath = pathRes.path;
                        } else {
                            throw new Error('No se pudo resolver la ruta del submódulo');
                        }
                    }
                    result = await window.electronAPI.furatUploadFile(payload);
                    break;

                // 📦658 — Listar metadata de FURAT (usado en Fase 3)
                case 'furat-list-metadata':
                    result = await window.electronAPI.furatListMetadata(payload.companyName);
                    break;

                // 📦659 — Dashboard analítico (Fase 3)
                case 'furat-get-analytics':
                    result = await window.electronAPI.furatGetAnalytics(payload.companyName);
                    break;

                // 📦680 — Crear nueva carpeta (período)
                case 'furat-create-folder':
                    result = await window.electronAPI.furatCreateFolder(payload);
                    break;

                // 📦692 — Eliminar carpeta (y todo su contenido)
                case 'furat-delete-folder':
                    result = await window.electronAPI.furatDeleteFolder(payload);
                    break;

                // 📦693 — Upsert metadata (crear o actualizar) para un PDF
                case 'furat-upsert-metadata':
                    result = await window.electronAPI.furatUpsertMetadata(payload);
                    break;

                // 📦693 — Obtener metadata de un solo archivo (pre-llenar el modal)
                case 'furat-get-metadata-for-file':
                    result = await window.electronAPI.furatGetMetadataForFile(payload);
                    break;

                default:
                    throw new Error(`API type '${requestType}' not supported`);
            }

            // Enviar respuesta al iframe
            event.source.postMessage({
                type: `${requestType}-response`,
                requestId: requestId,
                payload: result
            }, event.origin);

        } catch (error) {
            console.error(`[FURAT] API Error: ${requestType}`, error);
            event.source.postMessage({
                type: `${requestType}-response`,
                requestId: requestId,
                payload: {
                    success: false,
                    error: error.message
                }
            }, event.origin);
        }
    }

    async getDashboardData(params) {
        console.log('[FURAT] Getting dashboard data for:', params);

        try {
            // Obtener estructura de carpetas y archivos del nivel raíz
            const folderResult = await window.electronAPI.getDocumentFolders({
                companyName: params.companyName,
                moduleName: params.moduleName,
                submoduleName: params.submoduleName
            });

            if (!folderResult.success) {
                throw new Error(folderResult.error || 'Error al obtener carpetas');
            }

            const folders = folderResult.folders || [];
            const rootFiles = folderResult.files || [];
            const allFiles = [...rootFiles];

            // Leer archivos de cada subcarpeta
            for (const folder of folders) {
                try {
                    const folderContent = await window.electronAPI.readDirectory(folder.path);
                    if (folderContent.success) {
                        allFiles.push(...(folderContent.files || []));
                    }
                } catch (err) {
                    console.warn(`[FURAT] No se pudo leer carpeta ${folder.name}:`, err);
                }
            }

            // 📦687 — Cargar metadata para enriquecer los "Últimos Reportes" con accident_date
            // (la fecha que muestra es la del accidente, no la de modificación del archivo)
            let metadataByPath = {};
            try {
                const metaResult = await window.electronAPI.furatListMetadata(params.companyName);
                if (metaResult && metaResult.success && Array.isArray(metaResult.metadata)) {
                    metaResult.metadata.forEach(function (m) {
                        if (m.file_path) {
                            metadataByPath[m.file_path.toLowerCase().replace(/\\/g, '/')] = m;
                        }
                    });
                }
            } catch (err) {
                console.warn('[FURAT] No se pudo cargar metadata para "Últimos Reportes":', err);
            }

            // Calcular estadísticas
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;

            let totalFiles = allFiles.length;
            let currentYearFiles = 0;
            let currentMonthFiles = 0;
            const yearDistribution = {};
            const availableYears = new Set();

            allFiles.forEach(file => {
                // Intentar extraer año del nombre o ruta
                const yearMatch = (file.name || '').match(/(20\d{2})/) || (file.path || '').match(/(20\d{2})/);
                const year = yearMatch ? parseInt(yearMatch[1]) : null;

                if (year) {
                    availableYears.add(year);
                    yearDistribution[year] = (yearDistribution[year] || 0) + 1;

                    if (year === currentYear) {
                        currentYearFiles++;
                        // Extraer mes del nombre
                        const monthMatch = (file.name || file.path || '').toLowerCase().match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/);
                        const month = monthMatch ? this.monthNameToNumber(monthMatch[1]) : null;
                        if (month === currentMonth) {
                            currentMonthFiles++;
                        }
                    }
                }
            });

            // 📦687 — Generar reportes recientes (últimos 8).
            // Prioriza accident_date de la metadata (consistencia con el chart de tendencia).
            // Si no hay metadata, cae a modified.
            const recentReports = allFiles
                .map(file => {
                    // Buscar metadata por path normalizado
                    const key = (file.path || '').toLowerCase().replace(/\\/g, '/');
                    const meta = metadataByPath[key];
                    // Fecha a mostrar: accident_date si está en metadata, sino modified
                    const dateForSort = meta && meta.accident_date
                        ? new Date(meta.accident_date).getTime()
                        : (file.modified || 0);
                    const dateForDisplay = meta && meta.accident_date
                        ? new Date(meta.accident_date).toLocaleDateString('es-ES')
                        : (file.modified ? new Date(file.modified).toLocaleDateString('es-ES') : '');
                    return {
                        name: file.name,
                        path: file.path,
                        date: dateForDisplay,
                        _sortDate: dateForSort,
                        hasMetadata: !!meta
                    };
                })
                .sort((a, b) => (b._sortDate || 0) - (a._sortDate || 0))
                .slice(0, 8)
                .map(({ _sortDate, hasMetadata, ...rest }) => rest); // limpiar campos internos

            return {
                success: true,
                stats: {
                    total: totalFiles,
                    currentYear: currentYearFiles,
                    currentYearLabel: currentYear.toString(),
                    currentMonth: currentMonthFiles,
                    currentMonthLabel: this.getMonthName(currentMonth),
                    folders: folders.length
                },
                yearDistribution: Object.keys(yearDistribution)
                    .sort((a, b) => b - a)
                    .map(year => ({ year, count: yearDistribution[year] })),
                recentReports,
                availableYears: Array.from(availableYears).sort((a, b) => b - a)
            };
        } catch (error) {
            console.error('[FURAT] Error getting dashboard data:', error);
            return { success: false, error: error.message };
        }
    }

    async getLibraryData(params) {
        console.log('[FURAT] Getting library data for:', params);

        try {
            const folderResult = await window.electronAPI.getDocumentFolders({
                companyName: params.companyName,
                moduleName: params.moduleName,
                submoduleName: params.submoduleName
            });

            if (!folderResult.success) {
                throw new Error(folderResult.error || 'Error al obtener carpetas');
            }

            const rootFolders = folderResult.folders || [];
            const rootFiles = folderResult.files || [];

            // Estructuras finales: una sola lista de carpetas (plana) con `parentPath`
            // para que el frontend pueda renderizar el árbol por niveles, y una lista
            // de archivos con `folderPath` apuntando a su carpeta inmediata.
            const folders = [];   // TODAS las carpetas (raíz + subcarpetas)
            const allFiles = [];

            // 📦692-fix — Escaneo RECURSIVO de carpetas.
            // ANTES: el bucle solo leía los archivos DIRECTOS de cada carpeta de año
            // (readDirectory 1 nivel). Si los PDFs estaban en subcarpetas (ej:
            // 2019/Enero/archivo.pdf), no aparecían al navegar por "2019" y la UI
            // mostraba "No hay reportes en esta carpeta". FIX: función recursiva
            // que desciende en cada subcarpeta, agrega folders con parentPath y
            // cuenta archivos totales (esta carpeta + descendientes).
            const MAX_DEPTH = 5; // seguridad contra loops infinitos
            const scanFolderRecursive = async (folder, parentPath, depth) => {
                // Agregar esta carpeta a la lista
                const folderEntry = {
                    name: folder.name,
                    path: folder.path,
                    parentPath: parentPath || null,
                    count: 0 // se calcula abajo
                };
                folders.push(folderEntry);

                if (depth >= MAX_DEPTH) {
                    console.warn(`[FURAT] Profundidad máxima alcanzada en ${folder.path}, no se escanea más profundo`);
                    return;
                }

                let content;
                try {
                    content = await window.electronAPI.readDirectory(folder.path);
                } catch (err) {
                    console.warn(`[FURAT] No se pudo leer carpeta ${folder.name}:`, err);
                    return;
                }
                if (!content || !content.success) return;

                const subFolders = content.folders || [];
                const directFiles = content.files || [];

                // 1) Procesar archivos DIRECTOS de esta carpeta
                directFiles.forEach(f => {
                    const ext = f.extension || f.name.split('.').pop().toLowerCase();
                    allFiles.push({
                        name: f.name,
                        path: f.path,
                        folderPath: folder.path, // apunta a la carpeta INMEDIATA
                        extension: ext,
                        icon: this.getIconForExtension(ext),
                        size: f.size ? this.formatFileSize(f.size) : '',
                        date: f.modified ? new Date(f.modified).toLocaleDateString('es-ES') : '',
                        year: this.extractYearFromName(f.name, f.path),
                        month: this.extractMonthFromName(f.name, f.path)
                    });
                });

                // 2) Procesar subcarpetas recursivamente
                for (const sub of subFolders) {
                    await scanFolderRecursive(sub, folder.path, depth + 1);
                }
            };

            // Escanear todas las carpetas raíz (años)
            for (const folder of rootFolders) {
                await scanFolderRecursive(folder, null, 0);
            }

            // Calcular `count` de cada folder = total de archivos en este folder
            // Y en todos sus descendientes. Recorremos `allFiles` y sumamos.
            const countByFolder = {};
            for (const file of allFiles) {
                if (!file.folderPath) continue;
                // Normalizar para que el conteo coincida con `folder.path` (que también está normalizado)
                const fp = file.folderPath.replace(/\\/g, '/').toLowerCase();
                countByFolder[fp] = (countByFolder[fp] || 0) + 1;
            }
            // Propagar el conteo HACIA ARRIBA: cada padre suma los counts de sus hijos
            const sortedFolders = folders.slice().sort((a, b) => b.path.length - a.path.length);
            for (const folder of sortedFolders) {
                const fp = folder.path.replace(/\\/g, '/').toLowerCase();
                const directCount = countByFolder[fp] || 0;
                // Sumar counts de hijos que tengan este folder como parent
                const childCount = folders
                    .filter(f => (f.parentPath || '').replace(/\\/g, '/').toLowerCase() === fp)
                    .reduce((sum, child) => {
                        const childFp = child.path.replace(/\\/g, '/').toLowerCase();
                        return sum + (countByFolder[childFp] || 0);
                    }, 0);
                folder.count = directCount + childCount;
            }

            // Archivos del nivel raíz
            rootFiles.forEach(f => {
                const ext = f.extension || f.name.split('.').pop().toLowerCase();
                allFiles.push({
                    name: f.name,
                    path: f.path,
                    folderPath: null,
                    extension: ext,
                    icon: this.getIconForExtension(ext),
                    size: f.size ? this.formatFileSize(f.size) : '',
                    date: f.modified ? new Date(f.modified).toLocaleDateString('es-ES') : '',
                    year: this.extractYearFromName(f.name, f.path),
                    month: this.extractMonthFromName(f.name, f.path)
                });
            });

            const availableYears = [...new Set(allFiles.map(f => f.year).filter(Boolean))].sort((a, b) => b - a);

            return {
                success: true,
                folders,
                files: allFiles,
                availableYears
            };
        } catch (error) {
            console.error('[FURAT] Error getting library data:', error);
            return { success: false, error: error.message };
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getIconForExtension(ext) {
        const icons = {
            'pdf': 'pdf',
            'xls': 'excel',
            'xlsx': 'excel',
            'doc': 'word',
            'docx': 'word'
        };
        return icons[ext.toLowerCase()] || 'default';
    }

    extractYearFromName(name, path) {
        const match = (name || path).match(/(20\d{2})/);
        return match ? parseInt(match[1]) : null;
    }

    extractMonthFromName(name, path) {
        const months = {
            'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
            'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
        };
        const text = (name || path).toLowerCase();
        for (const [monthName, monthNum] of Object.entries(months)) {
            if (text.includes(monthName)) return monthNum;
        }
        return null;
    }

    monthNameToNumber(monthName) {
        const months = {
            'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
            'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
        };
        return months[monthName.toLowerCase()] || null;
    }

    getMonthName(monthNum) {
        const months = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return months[monthNum] || '';
    }

    // Cleanup cuando el componente se destruye
    destroy() {
        if (this._messageHandler) {
            window.removeEventListener('message', this._messageHandler);
        }
    }
}

// Exponer globalmente para renderer.js
window.ReportesAccidentesComponent = ReportesAccidentesComponent;
