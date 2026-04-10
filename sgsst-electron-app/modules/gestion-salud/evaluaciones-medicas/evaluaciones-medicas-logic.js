// evaluaciones-medicas-logic.js — Submódulo 3.1.4 Evaluaciones Médicas
// Portal de bienvenida + visor EMO moderno (patrón FURAT/Plan de Trabajo)

class EvaluacionesMedicasComponent {
    constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
        this.container = container;
        this.companyName = companyName;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBackToModuleHome = onBackToModuleHome;
        this.allFiles = [];
        this.submodulePath = null;
        // Bind del handler para poder quitarlo después
        this._messageHandler = this._handleMessage.bind(this);
    }

    // ─── RENDER PRINCIPAL (antesala portal) ─────────────────────────────────

    async render() {
        this._removeViewer();
        this.container.innerHTML = '';
        await this.loadPortalHome();
    }

    async loadPortalHome() {
        const portalContainer = document.createElement('div');
        portalContainer.id = 'em-portal-container';
        portalContainer.style.cssText = 'width:100%;height:100%;';
        this.container.appendChild(portalContainer);

        try {
            const response = await fetch('./modules/gestion-salud/evaluaciones-medicas/evaluaciones-medicas-home.html');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const html = await response.text();
            portalContainer.innerHTML = html;
            this.initPortalJS();
        } catch (error) {
            console.error('[EvaluacionesMedicasComponent] Error cargando portal:', error);
            this.renderLegacyDesign();
        }
    }

    initPortalJS() {
        window.evaluacionesMedicasPortalContainer = document.getElementById('em-portal-container');
        window.evaluacionesMedicasPortalComponent = this;

        const existingScript = document.querySelector('script[data-em-home]');
        if (existingScript) existingScript.remove();

        const script = document.createElement('script');
        script.setAttribute('data-em-home', 'true');
        script.src = './modules/gestion-salud/evaluaciones-medicas/evaluaciones-medicas-home.js';
        script.onerror = () => {
            console.error('[EvaluacionesMedicasComponent] Error cargando evaluaciones-medicas-home.js');
            this.renderLegacyDesign();
        };
        document.body.appendChild(script);
    }

    // ─── VISOR EMO MODERNO ───────────────────────────────────────────────────

    showNewDocumentViewer() {
        this.container.innerHTML = '';
        this.container.style.height = '100%';
        this.container.style.overflow = 'hidden';

        // Crear iframe que carga la nueva interfaz EMO
        const viewerFrame = document.createElement('iframe');
        viewerFrame.id = 'emo-viewer-frame';
        viewerFrame.style.cssText = 'width:100%;height:100%;border:none;';
        viewerFrame.scrolling = 'no';

        const viewerUrl = `./modules/gestion-salud/evaluaciones-medicas/evaluaciones-medicas-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        viewerFrame.src = viewerUrl;

        this.container.appendChild(viewerFrame);

        // Activar el bridge de comunicación
        this._setupFrameCommunication();
    }

    _setupFrameCommunication() {
        this._removeViewer(); // Limpiar handler previo si hubiera
        window.addEventListener('message', this._messageHandler);
    }

    _removeViewer() {
        window.removeEventListener('message', this._messageHandler);
    }

    async _handleMessage(event) {
        const data = event.data;
        if (!data || !data.type) return;

        // Volver al portal de bienvenida
        if (data.type === 'back-to-module-request') {
            this._removeViewer();
            this.render();
            return;
        }

        // Router de solicitudes API desde el iframe
        if (data.type.endsWith('-request')) {
            await this._handleAPIRequest(data, event);
        }
    }

    async _handleAPIRequest(data, event) {
        const requestId  = data.requestId;
        const requestType = data.type.replace('-request', '');
        const payload    = data.payload;

        console.log(`[EMO][Logic] API Request: ${requestType}`, payload);

        try {
            let result;

            switch (requestType) {
                // Dashboard data
                case 'emo-get-dashboard-data':
                    result = await this._getDashboardData(payload);
                    break;

                // Library data
                case 'emo-get-library-data':
                    result = await this._getLibraryData(payload);
                    break;

                // Contratos IPC existentes (sin cambio)
                case 'get-pdf-preview':
                    result = await window.electronAPI.getPDFPreview(payload.filePath);
                    break;
                case 'get-excel-preview':
                    result = await window.electronAPI.getExcelPreview(payload.filePath);
                    break;
                case 'get-word-preview':
                    result = await window.electronAPI.getWordPreview(payload.filePath);
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

                default:
                    throw new Error(`API type '${requestType}' not supported`);
            }

            event.source.postMessage({
                type: `${requestType}-response`,
                requestId,
                payload: result
            }, event.origin || '*');

        } catch (error) {
            console.error(`[EMO][Logic] API Error: ${requestType}`, error);
            event.source.postMessage({
                type: `${requestType}-response`,
                requestId,
                payload: { success: false, error: error.message }
            }, event.origin || '*');
        }
    }

    // ─── DASHBOARD DATA ──────────────────────────────────────────────────────

    async _getDashboardData(params) {
        try {
            const folderResult = await window.electronAPI.getDocumentFolders({
                companyName: params.companyName,
                moduleName:  params.moduleName,
                submoduleName: params.submoduleName
            });

            if (!folderResult.success) throw new Error(folderResult.error || 'Error al obtener carpetas');

            const folders   = folderResult.folders || [];
            const rootFiles = folderResult.files   || [];
            const allFiles  = [...rootFiles];

            for (const folder of folders) {
                try {
                    const content = await window.electronAPI.readDirectory(folder.path);
                    if (content.success) allFiles.push(...(content.files || []));
                } catch (err) {
                    console.warn(`[EMO] No se pudo leer carpeta ${folder.name}:`, err);
                }
            }

            const now = new Date();
            const currentYear  = now.getFullYear();
            const currentMonth = now.getMonth() + 1;

            let currentYearFiles  = 0;
            let currentMonthFiles = 0;
            const yearDistribution = {};

            allFiles.forEach(file => {
                const yearMatch = (file.name || '').match(/(20\d{2})/) || (file.path || '').match(/(20\d{2})/);
                const year = yearMatch ? parseInt(yearMatch[1]) : null;

                if (year) {
                    yearDistribution[year] = (yearDistribution[year] || 0) + 1;
                    if (year === currentYear) {
                        currentYearFiles++;
                        const monthMatch = (file.name || file.path || '').toLowerCase()
                            .match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/);
                        const month = monthMatch ? this._monthNameToNumber(monthMatch[1]) : null;
                        if (month === currentMonth) currentMonthFiles++;
                    }
                }
            });

            const recentReports = allFiles
                .sort((a, b) => (b.modified || 0) - (a.modified || 0))
                .slice(0, 8)
                .map(file => ({
                    name: file.name,
                    path: file.path,
                    date: file.modified ? new Date(file.modified).toLocaleDateString('es-ES') : ''
                }));

            return {
                success: true,
                stats: {
                    total: allFiles.length,
                    currentYear: currentYearFiles,
                    currentYearLabel: currentYear.toString(),
                    currentMonth: currentMonthFiles,
                    currentMonthLabel: this._getMonthName(currentMonth),
                    folders: folders.length
                },
                yearDistribution: Object.keys(yearDistribution)
                    .sort((a, b) => b - a)
                    .map(year => ({ year, count: yearDistribution[year] })),
                recentReports
            };
        } catch (error) {
            console.error('[EMO] Error getDashboardData:', error);
            return { success: false, error: error.message };
        }
    }

    // ─── LIBRARY DATA ────────────────────────────────────────────────────────

    async _getLibraryData(params) {
        try {
            const folderResult = await window.electronAPI.getDocumentFolders({
                companyName: params.companyName,
                moduleName:  params.moduleName,
                submoduleName: params.submoduleName
            });

            if (!folderResult.success) throw new Error(folderResult.error || 'Error al obtener carpetas');

            const rootFolders = folderResult.folders || [];
            const rootFiles   = folderResult.files   || [];

            const folders = rootFolders.map(f => ({ name: f.name, path: f.path, parentPath: null, count: 0 }));
            const allFiles = [];

            rootFiles.forEach(f => {
                const ext = f.extension || f.name.split('.').pop().toLowerCase();
                allFiles.push({
                    name: f.name, path: f.path, folderPath: null,
                    extension: ext, icon: this._getIconForExtension(ext),
                    size: f.size ? this._formatFileSize(f.size) : '',
                    date: f.modified ? new Date(f.modified).toLocaleDateString('es-ES') : '',
                    year:  this._extractYear(f.name, f.path),
                    month: this._extractMonth(f.name, f.path)
                });
            });

            for (const folder of folders) {
                try {
                    const content = await window.electronAPI.readDirectory(folder.path);
                    if (content.success) {
                        const folderFiles = content.files || [];
                        folder.count = folderFiles.length;
                        folderFiles.forEach(f => {
                            const ext = f.extension || f.name.split('.').pop().toLowerCase();
                            allFiles.push({
                                name: f.name, path: f.path, folderPath: folder.path,
                                extension: ext, icon: this._getIconForExtension(ext),
                                size: f.size ? this._formatFileSize(f.size) : '',
                                date: f.modified ? new Date(f.modified).toLocaleDateString('es-ES') : '',
                                year:  this._extractYear(f.name, f.path),
                                month: this._extractMonth(f.name, f.path)
                            });
                        });
                    }
                } catch (err) {
                    console.warn(`[EMO] No se pudo leer carpeta ${folder.name}:`, err);
                }
            }

            const availableYears = [...new Set(allFiles.map(f => f.year).filter(Boolean))].sort((a, b) => b - a);

            return { success: true, folders, files: allFiles, availableYears };
        } catch (error) {
            console.error('[EMO] Error getLibraryData:', error);
            return { success: false, error: error.message };
        }
    }

    // ─── UTILIDADES ─────────────────────────────────────────────────────────

    _formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    _getIconForExtension(ext) {
        const icons = { pdf: 'pdf', xls: 'excel', xlsx: 'excel', doc: 'word', docx: 'word' };
        return icons[(ext || '').toLowerCase()] || 'default';
    }

    _extractYear(name, path) {
        const match = (name || path || '').match(/(20\d{2})/);
        return match ? parseInt(match[1]) : null;
    }

    _extractMonth(name, path) {
        const months = {
            enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6,
            julio:7, agosto:8, septiembre:9, octubre:10, noviembre:11, diciembre:12
        };
        const text = (name || path || '').toLowerCase();
        for (const [mn, num] of Object.entries(months)) {
            if (text.includes(mn)) return num;
        }
        return null;
    }

    _monthNameToNumber(monthName) {
        const months = {
            enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6,
            julio:7, agosto:8, septiembre:9, octubre:10, noviembre:11, diciembre:12
        };
        return months[(monthName || '').toLowerCase()] || null;
    }

    _getMonthName(num) {
        const months = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
            'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        return months[num] || '';
    }

    // ─── DISEÑO LEGACY (fallback) ────────────────────────────────────────────

    renderLegacyDesign() {
        this.container.innerHTML = '';

        const backButton = document.createElement('button');
        backButton.className = 'btn btn-back';
        backButton.innerHTML = '&#8592; Volver al Módulo';
        backButton.addEventListener('click', this.onBackToModuleHome);
        this.container.appendChild(backButton);

        const title = document.createElement('h3');
        title.textContent = this.submoduleName;
        title.style.textAlign = 'center';
        title.style.marginBottom = '20px';
        this.container.appendChild(title);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'module-cards';

        cardsContainer.appendChild(this.createModuleCard(
            'Ver Evaluaciones Realizadas',
            'Visualizar, buscar y previsualizar certificados de aptitud médica.',
            () => this.showNewDocumentViewer()
        ));
        cardsContainer.appendChild(this.createModuleCard(
            'Registrar Nueva Evaluación',
            'Cargar un nuevo certificado o examen médico al sistema.',
            () => this.showPlaceholder('Registrar Nueva Evaluación')
        ));
        cardsContainer.appendChild(this.createModuleCard(
            'Estadísticas de Aptitud',
            'Ver estadísticas sobre los resultados de las evaluaciones.',
            () => this.showPlaceholder('Estadísticas de Aptitud')
        ));
        cardsContainer.appendChild(this.createModuleCard(
            'Próxima Función',
            'Una nueva funcionalidad estará disponible aquí pronto.',
            () => this.showPlaceholder('Próxima Función')
        ));

        this.container.appendChild(cardsContainer);
    }

    // ─── MÉTODOS HEREDADOS (no modificar) ───────────────────────────────────

    async loadInitialFiles() {
        const resultsCol = document.getElementById('search-results-col');
        resultsCol.innerHTML = '<p>Buscando carpeta de evaluaciones...</p>';
        try {
            if (!this.submodulePath) {
                const result = await window.electronAPI.findSubmodulePath(this.companyName, this.moduleName, this.submoduleName);
                if (result.success) { this.submodulePath = result.path; }
                else { resultsCol.innerHTML = `<p>Error al encontrar la ruta: ${result.error}</p>`; return; }
            }
            this.allFiles = await window.electronAPI.findFilesRecursively(this.submodulePath);
            this.filterAndDisplayFiles('');
        } catch (error) {
            resultsCol.innerHTML = `<p>Error al cargar archivos: ${error.message}</p>`;
        }
    }

    filterAndDisplayFiles(query) {
        const resultsCol = document.getElementById('search-results-col');
        resultsCol.innerHTML = '';
        const filteredFiles = this.allFiles.filter(f => f.name.toLowerCase().includes(query.toLowerCase()));
        if (filteredFiles.length === 0) { resultsCol.innerHTML = '<p>No se encontraron archivos.</p>'; return; }
        const list = document.createElement('ul');
        list.className = 'search-results-list';
        filteredFiles.forEach(file => {
            const li = document.createElement('li');
            li.textContent = file.name;
            li.addEventListener('click', () => this.previewDocument(file.path));
            list.appendChild(li);
        });
        resultsCol.appendChild(list);
    }

    async handleManualSelect() {
        try {
            const filePath = await window.electronAPI.selectPdfFile();
            if (filePath) this.previewDocument(filePath);
        } catch (error) { alert('No se pudo seleccionar el archivo.'); }
    }

    async openDocument(filePath) {
        try { await window.electronAPI.openPath(filePath); }
        catch (error) { alert('Error al abrir el documento.'); }
    }

    previewDocument(filePath) {
        const openButton = document.getElementById('open-current-doc-btn');
        if (openButton) { openButton.style.display = 'inline-block'; openButton.setAttribute('data-current-file', filePath); }
        const previewCol = document.getElementById('preview-col');
        if (!filePath) { previewCol.innerHTML = `<div class="preview-placeholder">Ruta no válida.</div>`; return; }
        const fileName = filePath.split(/[\\/]/).pop().toLowerCase();
        const ext = fileName.split('.').pop();
        if (ext === 'pdf') {
            previewCol.innerHTML = `<iframe src="${filePath}" width="100%" height="100%" style="border:none;" data-file-path="${filePath}"></iframe>`;
        } else if (ext === 'docx') {
            previewCol.innerHTML = `<div style="text-align:center;padding:40px;"><p>Convirtiendo...</p></div>`;
            window.electronAPI.convertDocxToPdf(filePath).then(result => {
                if (result.success) {
                    previewCol.innerHTML = `<iframe src="${result.pdfPath}" width="100%" height="100%" style="border:none;"></iframe>`;
                } else {
                    previewCol.innerHTML = `<div class="preview-error"><h3>Error</h3><p>${result.error}</p><button class="btn btn-primary">Abrir externamente</button></div>`;
                    previewCol.querySelector('button').addEventListener('click', () => this.openDocument(filePath));
                }
            });
        } else {
            previewCol.innerHTML = `<div class="preview-error"><h3>Sin previsualización</h3><p>${fileName}</p><button class="btn btn-primary">Abrir externamente</button></div>`;
            previewCol.querySelector('button').addEventListener('click', () => this.openDocument(filePath));
        }
    }

    createModuleCard(title, description, onClick) {
        const card = document.createElement('div');
        card.className = 'card module-card';
        card.innerHTML = `<div class="card-body"><h5 class="card-title">${title}</h5><p class="card-text">${description}</p><button class="btn btn-primary btn-ingresar">Acceder</button></div>`;
        card.querySelector('button').addEventListener('click', onClick);
        return card;
    }

    showPlaceholder(featureName) {
        alert(`La funcionalidad '${featureName}' se implementará en el futuro.`);
    }

    destroy() {
        this._removeViewer();
        this.container.innerHTML = '';
    }
}

window.EvaluacionesMedicasComponent = EvaluacionesMedicasComponent;
