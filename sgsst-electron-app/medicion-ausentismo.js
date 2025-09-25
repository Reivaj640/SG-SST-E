// medicion-ausentismo.js - Componente para el submódulo "3.3.6 Medición del ausentismo por causa médica"

class MedicionAusentismoComponent {
    constructor(container, currentCompany, moduleName, submoduleName, onBack) {
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBack = onBack;
        this.currentView = 'main'; // 'main', 'ver-ausentismo' o 'registrar-ausentismo'
        this.currentPath = null;
        this.pathHistory = [];
        this.ausentismoFilePath = null; // Para guardar la ruta del archivo
        this.logMessage = (msg, type) => console.log(`[${type}] ${msg}`); // Placeholder

        this.openDocument = this.openDocument.bind(this);
    }

    render() {
        this.container.innerHTML = '';
        window.currentMedicionAusentismoComponent = this;

        const mainContainer = document.createElement('div');
        mainContainer.className = 'submodule-content';

        switch (this.currentView) {
            case 'main':
                this.renderMainView(mainContainer);
                break;
            case 'ver-ausentismo':
                this.renderVerAusentismoView(mainContainer);
                break;
            case 'registrar-ausentismo':
                this.renderRegistrarAusentismoView(mainContainer);
                break;
            default:
                this.renderMainView(mainContainer);
        }

        this.container.appendChild(mainContainer);
    }

    renderMainView(container) {
        // Encabezado
        const header = document.createElement('div');
        header.className = 'submodule-header';

        const title = document.createElement('h2');
        title.textContent = this.submoduleName;
        header.appendChild(title);

        if (this.onBack && typeof this.onBack === 'function') {
            const backButton = document.createElement('button');
            backButton.className = 'btn';
            backButton.textContent = '← Volver';
            backButton.addEventListener('click', this.onBack);
            header.appendChild(backButton);
        }

        container.appendChild(header);

        // Descripción
        const description = document.createElement('p');
        description.className = 'submodule-description';
        description.textContent = 'Este submódulo permite gestionar la medición del ausentismo por causa médica.';
        container.appendChild(description);

        // Tarjetas de opciones
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'module-cards';

        cardsContainer.appendChild(
            this.createModuleCard(
                'Ver ausentismo',
                'Consulta las mediciones del ausentismo por causa médica ya realizadas.',
                () => this.handleViewAusentismo()
            )
        );

        cardsContainer.appendChild(
            this.createModuleCard(
                'Registrar ausentismo',
                'Registra nuevos casos de ausentismo por causa médica.',
                () => this.handleRegistrarAusentismo()
            )
        );

        cardsContainer.appendChild(
            this.createModuleCard(
                'Próximo a implementar',
                'Nuevas funcionalidades estarán disponibles próximamente.',
                () => this.handleComingSoon()
            )
        );

        container.appendChild(cardsContainer);

        // Notificaciones
        const notificationArea = document.createElement('div');
        notificationArea.className = 'notification-area';
        notificationArea.innerHTML = `
            <h3>Notificaciones recientes</h3>
            <div class="notification-item">
                <div class="notification-icon">ℹ️</div>
                <div class="notification-content">
                    <div class="notification-title">Nueva medición pendiente</div>
                    <div class="notification-message">Hay datos pendientes de actualización para el ausentismo del mes.</div>
                    <div class="notification-time">Hace 1 día</div>
                </div>
            </div>
            <div class="notification-item">
                <div class="notification-icon">✅</div>
                <div class="notification-content">
                    <div class="notification-title">Medición completada</div>
                    <div class="notification-message">La medición del ausentismo del mes pasado ha sido completada.</div>
                    <div class="notification-time">Hace 3 días</div>
                </div>
            </div>
        `;
        container.appendChild(notificationArea);
    }

    createModuleCard(title, description, onClick) {
        const card = document.createElement('div');
        card.className = 'card module-card';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'card-header';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'card-icon-placeholder';
        headerDiv.appendChild(iconDiv);

        const cardTitle = document.createElement('h3');
        cardTitle.textContent = title;
        cardTitle.className = 'card-title';
        headerDiv.appendChild(cardTitle);

        card.appendChild(headerDiv);

        const cardDescription = document.createElement('p');
        cardDescription.textContent = description;
        cardDescription.className = 'card-description';
        card.appendChild(cardDescription);

        const cardButton = document.createElement('button');
        cardButton.className = 'btn btn-primary';
        cardButton.textContent = 'Abrir';
        cardButton.addEventListener('click', onClick);
        card.appendChild(cardButton);

        return card;
    }

    handleViewAusentismo() {
        this.currentView = 'ver-ausentismo';
        this.render();
    }

    handleRegistrarAusentismo() {
        this.currentView = 'registrar-ausentismo';
        this.render();
    }

    handleComingSoon() {
        alert('Esta funcionalidad estará disponible próximamente.');
    }

    renderVerAusentismoView(container) {
        this.currentPath = null;
        this.pathHistory = [];

        const header = this.createHeader('Ver Ausentismo', () => {
            this.currentView = 'main';
            this.render();
        });
        container.appendChild(header);

        const navBar = document.createElement('div');
        navBar.className = 'file-nav-bar';
        container.appendChild(navBar);

        const mainLayout = document.createElement('div');
        mainLayout.className = 'remisiones-layout';

        const resultsCol = document.createElement('div');
        resultsCol.id = 'search-results-col';
        resultsCol.className = 'search-results-col';
        mainLayout.appendChild(resultsCol);

        const previewCol = document.createElement('div');
        previewCol.id = 'preview-col';
        previewCol.className = 'preview-col';
        previewCol.innerHTML = '<div class="preview-placeholder">Seleccione un archivo de ausentismo para previsualizarlo.</div>';
        mainLayout.appendChild(previewCol);

        container.appendChild(mainLayout);

        this.navigateToInitialPath();
    }

    async navigateToInitialPath() {
        try {
            const result = await window.electronAPI.findSubmodulePath(
                this.currentCompany,
                this.moduleName,
                this.submoduleName
            );
            if (result.success) {
                this.navigateToPath(result.path);
            } else {
                document.getElementById('search-results-col').innerHTML = 
                    `<p>Error al encontrar la ruta inicial: ${result.error}</p>`;
            }
        } catch (error) {
            document.getElementById('search-results-col').innerHTML = 
                `<p>Error crítico al buscar ruta: ${error.message}</p>`;
        }
    }

    async navigateToPath(path) {
        const resultsCol = document.getElementById('search-results-col');
        resultsCol.innerHTML = '<p>Cargando...</p>';
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
        breadcrumb.textContent = this.currentPath || 'Ruta no disponible';
        navBar.appendChild(breadcrumb);
    }

    displayItems(items) {
        const resultsCol = document.getElementById('search-results-col');
        resultsCol.innerHTML = '';
        const list = document.createElement('ul');
        list.className = 'search-results-list';

        const allowedExtensions = ['.pdf', '.doc', '.docx', '.xlsx', '.xls'];
        const folders = items.filter(item => item.isDirectory);
        const files = items.filter(
            item => !item.isDirectory && 
            allowedExtensions.includes(item.name.slice(item.name.lastIndexOf('.')).toLowerCase())
        );

        folders.forEach(folder => {
            const li = document.createElement('li');
            li.textContent = `📁 ${folder.name}`;
            li.addEventListener('click', () => {
                this.pathHistory.push(this.currentPath);
                this.navigateToPath(folder.path);
            });
            list.appendChild(li);
        });

        files.forEach(file => {
            const li = document.createElement('li');
            const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
            let icon = '📄';
            if (ext === '.pdf') icon = '📕';
            else if (['.doc', '.docx'].includes(ext)) icon = '📘';
            else if (['.xlsx', '.xls'].includes(ext)) icon = '📊';

            li.innerHTML = `${icon} ${file.name}`;
            li.addEventListener('click', () => this.previewDocument(file.path));
            list.appendChild(li);
        });

        if (list.children.length === 0) {
            resultsCol.innerHTML = '<p>No hay archivos de ausentismo o carpetas para mostrar.</p>';
        } else {
            resultsCol.appendChild(list);
        }
    }

    async previewDocument(filePath) {
        const previewCol = document.getElementById('preview-col');
        const fileExtension = filePath.split('.').pop().toLowerCase();

        previewCol.innerHTML = '<div class="preview-placeholder">Cargando previsualización...</div>';

        if (fileExtension === 'pdf') {
            const safePath = filePath.replace(/\\/g, '/');
            previewCol.innerHTML = `<iframe src="file:///${safePath}?t=${Date.now()}" width="100%" height="100%" style="border: none;"></iframe>`;
        } else if (['doc', 'docx', 'xlsx', 'xls'].includes(fileExtension)) {
            try {
                const result = fileExtension.startsWith('doc')
                    ? await window.electronAPI.convertDocxToPdf(filePath)
                    : await window.electronAPI.convertExcelToPdf(filePath);

                if (result.success) {
                    const safePath = result.pdf_path.replace(/\\/g, '/');
                    previewCol.innerHTML = `<iframe src="file:///${safePath}?t=${Date.now()}" width="100%" height="100%" style="border: none;"></iframe>`;
                } else {
                    const escapedPath = filePath.replace(/\\/g, '\\\\');
                    previewCol.innerHTML = `
                        <div class="preview-error">
                            <h3>Error de Conversión</h3>
                            <p>${result.error}</p>
                            <button class="btn btn-primary" onclick="window.currentMedicionAusentismoComponent.openDocument('${escapedPath}')">
                                Abrir con aplicación externa
                            </button>
                        </div>`;
                }
            } catch (error) {
                const escapedPath = filePath.replace(/\\/g, '\\\\');
                previewCol.innerHTML = `
                    <div class="preview-error">
                        <h3>Error Inesperado</h3>
                        <p>${error.message}</p>
                        <button class="btn btn-primary" onclick="window.currentMedicionAusentismoComponent.openDocument('${escapedPath}')">
                            Abrir con aplicación externa
                        </button>
                    </div>`;
            }
        } else {
            const escapedPath = filePath.replace(/\\/g, '\\\\');
            previewCol.innerHTML = `
                <div class="preview-error">
                    <h3>Previsualización no disponible</h3>
                    <p>La previsualización para archivos <strong>.${fileExtension}</strong> no está soportada.</p>
                    <button class="btn btn-primary" onclick="window.currentMedicionAusentismoComponent.openDocument('${escapedPath}')">
                        Abrir con aplicación externa
                    </button>
                </div>`;
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

    async renderRegistrarAusentismoView(container) {
        console.log('[DEBUG] renderRegistrarAusentismoView: Iniciando renderizado.');
        const header = this.createHeader('Registrar Ausentismo', () => {
            this.currentView = 'main';
            this.render();
        });
        container.appendChild(header);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'control-remisiones-content';
        contentDiv.style.padding = '20px';
        container.appendChild(contentDiv);

        this.logMessage(`Cargando datos de ausentismo para ${this.currentCompany}...`, 'info');
        console.log(`[DEBUG] renderRegistrarAusentismoView: Solicitando datos para ${this.currentCompany}`);
        contentDiv.innerHTML = '<p style="text-align:center;">Cargando datos del archivo de ausentismo...</p>';

        try {
            const result = await window.electronAPI.readAusentismoData(this.currentCompany);
            console.log('[DEBUG] renderRegistrarAusentismoView: Resultado recibido de readAusentismoData:', result);

            if (result.success) {
                this.ausentismoFilePath = result.filePath;
                console.log(`[DEBUG] renderRegistrarAusentismoView: Ruta de archivo guardada: ${this.ausentismoFilePath}`);
                contentDiv.innerHTML = ''; // Limpiar "Cargando..."



                if (result.rows && result.rows.length > 0) {
                    console.log(`[DEBUG] renderRegistrarAusentismoView: ${result.rows.length} filas encontradas. Renderizando tabla.`);
                    this.logMessage(`Encontrados ${result.rows.length} registros. Renderizando tabla.`, 'info');
                    
                    const tableContainer = document.createElement('div');
                    tableContainer.style.maxHeight = '65vh';
                    tableContainer.style.overflowY = 'auto';
                    tableContainer.style.border = '1px solid #ddd';
                    tableContainer.style.borderRadius = '4px';
                                        
                    const table = document.createElement('table');
                    table.className = 'data-table';
                    
                    // Encabezados de tabla
                    const thead = document.createElement('thead');
                    const headerRow = document.createElement('tr');
                    
                    if (result.headers && Array.isArray(result.headers)) {
                        console.log('[DEBUG] renderRegistrarAusentismoView: Renderizando encabezados:', result.headers);
                        result.headers.forEach(headerText => {
                            const th = document.createElement('th');
                            th.textContent = headerText;
                            headerRow.appendChild(th);
                        });
                    }
                    thead.appendChild(headerRow);
                    table.appendChild(thead);

                    // Cuerpo de la tabla
                    const tbody = document.createElement('tbody');
                    result.rows.forEach((row, rowIndex) => {
                        const tr = document.createElement('tr');
                        if (Array.isArray(row)) {
                            row.forEach(cellData => {
                                const td = document.createElement('td');
                                td.textContent = cellData != null ? cellData.toString() : '';
                                tr.appendChild(td);
                            });
                        }
                        tbody.appendChild(tr);
                    });
                    table.appendChild(tbody);
                    tableContainer.appendChild(table);
                    contentDiv.appendChild(tableContainer);

                    const infoDiv = document.createElement('div');
                    infoDiv.style.marginTop = '15px';
                    infoDiv.style.fontSize = '14px';
                    infoDiv.style.color = '#666';
                    infoDiv.innerHTML = `
                        <p><strong>Archivo:</strong> ${result.filePath}</p>
                        <p><strong>Total de registros:</strong> ${result.rows.length}</p>
                    `;
                    contentDiv.appendChild(infoDiv);

                } else {
                    console.warn('[WARN] renderRegistrarAusentismoView: No se encontraron filas (result.rows está vacío o no existe).');
                    this.logMessage('El archivo de ausentismo está vacío o no contiene registros.', 'warn');
                    contentDiv.innerHTML += `
                        <div style="text-align:center; padding:40px; color:#666;">
                            <h3>📋 No se encontraron datos</h3>
                            <p>El archivo de ausentismo está vacío o no contiene registros.</p>
                        </div>
                    `;
                }
            } else {
                console.error(`[ERROR] renderRegistrarAusentismoView: El resultado de readAusentismoData no fue exitoso. Error: ${result.error}`);
                this.logMessage(`Error al cargar el archivo: ${result.error}`, 'error');
                contentDiv.innerHTML = `
                    <div style="text-align:center; padding:40px; color:#d32f2f;">
                        <h3>❌ Error al cargar el archivo</h3>
                        <p>${result.error}</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('[CRITICAL] renderRegistrarAusentismoView: Error inesperado en el bloque try-catch:', error);
            this.logMessage(`Error inesperado en la interfaz: ${error.message}`, 'error');
            contentDiv.innerHTML = `
                <div style="text-align:center; padding:40px; color:#d32f2f;">
                    <h3>💥 Error inesperado</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    async saveCellData(rowIndex, colIndex, newValue, filePath) {
        try {
            console.log(`Guardando cambios en fila ${rowIndex}, columna ${colIndex}...`);
            alert(`Cambios guardados: ${newValue} en fila ${rowIndex}, columna ${colIndex}`);
        } catch (error) {
            console.error('Error al guardar cambios:', error);
            alert(`Error al guardar cambios: ${error.message}`);
        }
    }

    createHeader(titleText, onBack) {
        const header = document.createElement('div');
        header.className = 'submodule-header';
        header.appendChild(this.createBackButton('&#8592; Volver', onBack));

        const title = document.createElement('h3');
        title.textContent = titleText;
        Object.assign(title.style, {
            flexGrow: '1',
            textAlign: 'center'
        });
        header.appendChild(title);

        return header;
    }

    createBackButton(text, onClick) {
        const button = document.createElement('button');
        button.className = 'btn btn-back';
        button.innerHTML = text;
        button.addEventListener('click', onClick);
        return button;
    }
}

// Exponer globalmente
window.MedicionAusentismoComponent = MedicionAusentismoComponent;
