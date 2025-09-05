// comite-convivencia.js - Componente para la vista de actas de Comité de Convivencia con soporte para Excel

class ComiteConvivenciaComponent {
    constructor(container, currentCompany, moduleName, submoduleName, backToModuleCallback) {
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.backToModuleCallback = backToModuleCallback;
        this.currentPath = null;
        this.pathHistory = [];

        // Bind methods
        this.openDocument = this.openDocument.bind(this);
    }

    render() {
        this.container.innerHTML = '';
        window.currentComiteConvivenciaComponent = this;

        const title = document.createElement('h2');
        title.textContent = this.submoduleName;
        this.container.appendChild(title);

        const backButton = document.createElement('button');
        backButton.className = 'btn';
        backButton.textContent = '< Volver al Módulo';
        backButton.addEventListener('click', () => this.backToModuleCallback());
        this.container.appendChild(backButton);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'module-cards';

        const card1 = this.createCard(
            'Ver actas',
            'Navegar, visualizar y previsualizar el historial de actas.',
            () => this.showVerActasPage()
        );
        cardsContainer.appendChild(card1);

        const card2 = this.createCard(
            'Realizar Actas',
            'Crear una nueva acta a partir de una plantilla de Excel.',
            () => this.showRealizarActasInterface()
        );
        cardsContainer.appendChild(card2);

        this.container.appendChild(cardsContainer);
    }

    showVerActasPage() {
        this.container.innerHTML = '';
        this.currentPath = null;
        this.pathHistory = [];

        const header = this.createHeader('Ver Actas del Comité de Convivencia', () => this.render());
        this.container.appendChild(header);

        const navBar = document.createElement('div');
        navBar.className = 'file-nav-bar';
        this.container.appendChild(navBar);

        const mainLayout = document.createElement('div');
        mainLayout.className = 'remisiones-layout'; // Re-using class for layout

        const resultsCol = document.createElement('div');
        resultsCol.id = 'search-results-col';
        resultsCol.className = 'search-results-col';
        mainLayout.appendChild(resultsCol);

        const previewCol = document.createElement('div');
        previewCol.id = 'preview-col';
        previewCol.className = 'preview-col';
        previewCol.innerHTML = `<div class="preview-placeholder">Seleccione un acta para previsualizarla.</div>`;
        mainLayout.appendChild(previewCol);

        this.container.appendChild(mainLayout);

        this.navigateToInitialPath();
    }

    async navigateToInitialPath() {
        try {
            const result = await window.electronAPI.findSubmodulePath(this.currentCompany, this.moduleName, this.submoduleName);
            if (result.success) {
                this.navigateToPath(result.path);
            } else {
                document.getElementById('search-results-col').innerHTML = `<p>Error al encontrar la ruta inicial: ${result.error}</p>`;
            }
        } catch (error) {
            document.getElementById('search-results-col').innerHTML = `<p>Error crítico al buscar ruta: ${error.message}</p>`;
        }
    }

    async navigateToPath(path) {
        const resultsCol = document.getElementById('search-results-col');
        resultsCol.innerHTML = `<p>Cargando...</p>`;
        try {
            const items = await window.electronAPI.readDirectory(path);
            this.currentPath = path;
            this.updateNavBar();
            this.displayItems(items);
        } catch (error) {
            resultsCol.innerHTML = `<p>Error al leer directorio: ${error.message}</p>`;
        }
    }

    updateNavBar() {
        const navBar = this.container.querySelector('.file-nav-bar');
        navBar.innerHTML = '';

        const upButton = document.createElement('button');
        upButton.innerHTML = '&#8679; Subir Nivel';
        upButton.className = 'btn btn-secondary btn-sm';
        upButton.disabled = this.pathHistory.length === 0;
        upButton.addEventListener('click', () => {
            if (this.pathHistory.length > 0) {
                const parentPath = this.pathHistory.pop();
                this.navigateToPath(parentPath);
            }
        });
        navBar.appendChild(upButton);

        const breadcrumb = document.createElement('span');
        breadcrumb.className = 'breadcrumb-display';
        breadcrumb.textContent = this.currentPath;
        navBar.appendChild(breadcrumb);
    }

    displayItems(items) {
        const resultsCol = document.getElementById('search-results-col');
        resultsCol.innerHTML = '';
        const list = document.createElement('ul');
        list.className = 'search-results-list';

        const allowedExtensions = ['.pdf', '.doc', '.docx', '.xlsx', '.xls'];
        const folders = items.filter(item => item.isDirectory);
        const files = items.filter(item => !item.isDirectory && allowedExtensions.includes(item.name.slice(item.name.lastIndexOf('.')).toLowerCase()));

        folders.forEach(folder => {
            const li = document.createElement('li');
            li.innerHTML = `📁 ${folder.name}`;
            li.addEventListener('click', () => {
                this.pathHistory.push(this.currentPath);
                this.navigateToPath(folder.path);
            });
            list.appendChild(li);
        });

        files.forEach(file => {
            const li = document.createElement('li');
            const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
            let icon = '📄';
            if (extension === '.pdf') icon = '📕';
            else if (extension === '.doc' || extension === '.docx') icon = '📘';
            else if (extension === '.xlsx' || extension === '.xls') icon = '📊';
            
            li.innerHTML = `${icon} ${file.name}`;
            li.addEventListener('click', () => this.previewDocument(file.path));
            list.appendChild(li);
        });

        if (list.children.length === 0) {
            resultsCol.innerHTML = '<p>No hay actas o carpetas para mostrar.</p>';
        }
        resultsCol.appendChild(list);
    }

    async previewDocument(filePath) {
        const previewCol = document.getElementById('preview-col');
        const fileExtension = filePath.split('.').pop().toLowerCase();
        const escapedPath = filePath.replace(/\\/g, '\\');

        previewCol.innerHTML = `<div class="preview-placeholder">Cargando previsualización...</div>`;

        if (fileExtension === 'pdf') {
            const safePath = filePath.replace(/\\/g, '/');
            previewCol.innerHTML = `<iframe src="file:///${safePath}?t=${new Date().getTime()}" width="100%" height="100%" style="border: none;"></iframe>`;
        } else if (['doc', 'docx', 'xlsx', 'xls'].includes(fileExtension)) {
            try {
                const result = fileExtension.startsWith('doc') 
                    ? await window.electronAPI.convertDocxToPdf(filePath)
                    : await window.electronAPI.convertExcelToPdf(filePath);

                if (result.success) {
                    const safePath = result.pdf_path.replace(/\\/g, '/');
                    previewCol.innerHTML = `<iframe src="file:///${safePath}?t=${new Date().getTime()}" width="100%" height="100%" style="border: none;"></iframe>`;
                } else {
                    previewCol.innerHTML = `<div class="preview-error"><h3>Error de Conversión</h3><p>${result.error}</p><button class="btn btn-primary" onclick="window.currentComiteConvivenciaComponent.openDocument('${escapedPath}')">Abrir con aplicación externa</button></div>`;
                }
            } catch (error) {
                previewCol.innerHTML = `<div class="preview-error"><h3>Error Inesperado</h3><p>${error.message}</p><button class="btn btn-primary" onclick="window.currentComiteConvivenciaComponent.openDocument('${escapedPath}')">Abrir con aplicación externa</button></div>`;
            }
        } else {
            previewCol.innerHTML = `<div class="preview-error"><h3>Previsualización no disponible</h3><p>La previsualización para archivos <strong>.${fileExtension}</strong> no está soportada.</p><button class="btn btn-primary" onclick="window.currentComiteConvivenciaComponent.openDocument('${escapedPath}')">Abrir con aplicación externa</button></div>`;
        }
    }

    async openDocument(filePath) {
        try {
            await window.electronAPI.openPath(filePath);
        } catch (error) {
            console.error('Error al abrir el documento:', error);
            alert('Error al abrir el documento.');
        }
    }

    showRealizarActasInterface() {
        this.container.innerHTML = '';

        const header = this.createHeader('Realizar Acta de Reunión', () => this.render());
        this.container.appendChild(header);

        const editorContainer = document.createElement('div');
        editorContainer.className = 'acta-editor-container';
        editorContainer.innerHTML = `
            <div class="acta-editor-placeholder">
                <p>Cargue la plantilla de Excel para empezar a editar el acta.</p>
                <button id="load-acta-template-btn" class="btn btn-primary">Cargar Plantilla de Acta</button>
            </div>
        `;
        this.container.appendChild(editorContainer);

        const loadButton = editorContainer.querySelector('#load-acta-template-btn');
        loadButton.addEventListener('click', () => this.loadAndRenderActaEditor(editorContainer));
    }

    async loadAndRenderActaEditor(container) {
        container.innerHTML = '<p>Cargando datos de la plantilla...</p>';
        try {
            const result = await window.electronAPI.getConvivenciaActaData();
            console.log('Datos recibidos:', result); // Para depuración
            if (result.success) {
                if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
                    throw new Error('Los datos de la plantilla están vacíos o no son válidos.');
                }
                this.merges = result.merges || [];
                this.renderEditableActa(container, result.data, this.merges);
            } else {
                throw new Error(result.error || 'Error desconocido al cargar la plantilla.');
            }
        } catch (error) {
            console.error('Error al cargar la plantilla del acta:', error);
            container.innerHTML = `<p class="error">Error al cargar la plantilla: ${error.message}</p>`;
        }
    }

    renderEditableActa(container, data, merges) {
        container.innerHTML = ''; // Limpiar el contenedor

        const table = document.createElement('table');
        table.className = 'editable-acta-table';
        const tbody = document.createElement('tbody');

        const rowCount = data.length;
        const colCount = rowCount > 0 ? data[0].length : 0;
        if (rowCount === 0) return;

        const mergedCells = Array(rowCount).fill(0).map(() => Array(colCount).fill(false));

        merges.forEach(merge => {
            if (!merge || typeof merge.s === 'undefined' || typeof merge.e === 'undefined') return;
            const startRow = Math.max(0, merge.s.r);
            const endRow = Math.min(rowCount - 1, merge.e.r);
            const startCol = Math.max(0, merge.s.c);
            const endCol = Math.min(colCount - 1, merge.e.c);

            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    if (row !== startRow || col !== startCol) {
                        if (mergedCells[row]) {
                            mergedCells[row][col] = true;
                        }
                    }
                }
            }
        });

        data.forEach((rowData, rowIndex) => {
            const tr = document.createElement('tr');
            if (!Array.isArray(rowData)) return;

            rowData.forEach((cellData, colIndex) => {
                if (mergedCells[rowIndex]?.[colIndex]) {
                    return;
                }

                const td = document.createElement('td');
                td.textContent = cellData ?? '';
                td.setAttribute('contenteditable', 'true');
                td.setAttribute('data-row', rowIndex);
                td.setAttribute('data-col', colIndex);

                const merge = merges.find(m => m.s.r === rowIndex && m.s.c === colIndex);
                if (merge) {
                    td.colSpan = (merge.e.c - merge.s.c) + 1;
                    td.rowSpan = (merge.e.r - merge.s.r) + 1;
                }

                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        container.appendChild(table);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'acta-actions';
        const saveButton = document.createElement('button');
        saveButton.className = 'btn btn-success';
        saveButton.textContent = 'Guardar Acta';
        saveButton.addEventListener('click', () => this.saveActa());
        actionsDiv.appendChild(saveButton);
        container.appendChild(actionsDiv);
    }

    async saveActa() {
        const table = this.container.querySelector('.editable-acta-table');
        if (!table) {
            alert('Error: No se encontró la tabla de datos del acta.');
            console.error('[CONVIVENCIA] No se encontró la tabla editable');
            return;
        }

        const changes = [];
        const cells = table.querySelectorAll('td[contenteditable="true"]');
        console.log('[CONVIVENCIA] Total celdas editables encontradas:', cells.length);
        
        cells.forEach(cell => {
            const row = parseInt(cell.getAttribute('data-row'));
            const col = parseInt(cell.getAttribute('data-col'));
            const value = cell.textContent.trim();
            
            if (!isNaN(row) && !isNaN(col) && value) {
                // Ajustar índice para alinearse con Excel (0-based en frontend, +1 para bajar una fila)
                changes.push({ row: row + 1, col: col, value });
                console.log(`[CONVIVENCIA] Cambio detectado: row=${row} (Excel row=${row + 2}), col=${col} (Excel col=${col + 1}), value="${value}"`);
            } else {
                console.warn(`[CONVIVENCIA] Celda ignorada: row=${row}, col=${col}, value="${value}"`);
            }
        });

        if (changes.length === 0) {
            alert('No hay datos para guardar.');
            console.warn('[CONVIVENCIA] No se encontraron cambios para guardar');
            return;
        }

        try {
            console.log('[CONVIVENCIA] Enviando cambios al IPC:', JSON.stringify(changes, null, 2));
            const result = await window.electronAPI.generateConvivenciaActa(changes);
            if (result.success) {
                alert(`Acta guardada exitosamente en: ${result.documentPath}`);
                console.log('[CONVIVENCIA] Acta guardada:', result.documentPath);
            } else {
                alert(`Error al guardar el acta: ${result.error}`);
                console.error('[CONVIVENCIA] Error en IPC:', result.error);
            }
        } catch (error) {
            console.error('[CONVIVENCIA] Error al invocar la generación del acta:', error);
            alert(`Error fatal al guardar el acta: ${error.message}`);
        }
    }

    createHeader(titleText, onBack) {
        const header = document.createElement('div');
        header.className = 'submodule-header';
        header.appendChild(this.createBackButton('&#8592; Volver', onBack));
        const title = document.createElement('h3');
        title.textContent = titleText;
        title.style.flexGrow = '1';
        title.style.textAlign = 'center';
        header.appendChild(title);
        return header;
    }
    
    createBackButton(text, onClick) {
        const backButton = document.createElement('button');
        backButton.className = 'btn btn-back';
        backButton.innerHTML = text;
        backButton.addEventListener('click', onClick);
        return backButton;
    }

    createCard(title, description, onClick) {
        const card = document.createElement('div');
        card.className = 'card module-card';
        card.innerHTML = `<div class="card-body"><h5 class="card-title">${title}</h5><p class="card-text">${description}</p><button class="btn btn-primary">Acceder</button></div>`;
        card.querySelector('button').addEventListener('click', onClick);
        return card;
    }
}

window.ComiteConvivenciaComponent = ComiteConvivenciaComponent;
