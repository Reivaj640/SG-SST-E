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

        // Bind methods
        this.openDocument = this.openDocument.bind(this);
    }

    render() {
        this.container.innerHTML = '';
        window.currentMedicionAusentismoComponent = this;

        // Crear el contenedor principal
        const mainContainer = document.createElement('div');
        mainContainer.className = 'submodule-content';

        if (this.currentView === 'main') {
            this.renderMainView(mainContainer);
        } else if (this.currentView === 'ver-ausentismo') {
            this.showVerAusentismoPage();
        } else if (this.currentView === 'registrar-ausentismo') {
            this.showRegistrarAusentismoPage();
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

        // Crear tarjetas para las opciones del submódulo
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'module-cards';
        
        // Tarjeta 1: Ver ausentismo
        const card1 = this.createModuleCard(
            'Ver ausentismo',
            'Consulta las mediciones del ausentismo por causa médica ya realizadas.',
            () => this.handleViewAusentismo()
        );
        cardsContainer.appendChild(card1);
        
        // Tarjeta 2: Registrar ausentismo
        const card2 = this.createModuleCard(
            'Registrar ausentismo',
            'Registra nuevos casos de ausentismo por causa médica.',
            () => this.handleRegistrarAusentismo()
        );
        cardsContainer.appendChild(card2);
        
        // Tarjeta 3: Próximo a implementar
        const card3 = this.createModuleCard(
            'Próximo a implementar',
            'Nuevas funcionalidades estarán disponibles próximamente.',
            () => this.handleComingSoon()
        );
        cardsContainer.appendChild(card3);
        
        container.appendChild(cardsContainer);

        // Área de notificaciones
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
        
        // Contenedor para el ícono y el título
        const headerDiv = document.createElement('div');
        headerDiv.className = 'card-header';
        
        // Placeholder para el ícono
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
        // Mostrar mensaje de funcionalidad próxima
        alert('Esta funcionalidad estará disponible próximamente.');
    }

    showVerAusentismoPage() {
        this.container.innerHTML = '';
        this.currentPath = null;
        this.pathHistory = [];

        const header = this.createHeader('Ver Ausentismo', () => {
            this.currentView = 'main';
            this.render();
        });
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
        previewCol.innerHTML = `<div class="preview-placeholder">Seleccione un archivo de ausentismo para previsualizarlo.</div>`;
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
            resultsCol.innerHTML = '<p>No hay archivos de ausentismo o carpetas para mostrar.</p>';
        }
        resultsCol.appendChild(list);
    }

    async previewDocument(filePath) {
        const previewCol = document.getElementById('preview-col');
        const fileExtension = filePath.split('.').pop().toLowerCase();
        const escapedPath = filePath.replace(/\\/g, '\\\\');

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
                    previewCol.innerHTML = `<div class="preview-error"><h3>Error de Conversión</h3><p>${result.error}</p><button class="btn btn-primary" onclick="window.currentMedicionAusentismoComponent.openDocument('${escapedPath}')">Abrir con aplicación externa</button></div>`;
                }
            } catch (error) {
                previewCol.innerHTML = `<div class="preview-error"><h3>Error Inesperado</h3><p>${error.message}</p><button class="btn btn-primary" onclick="window.currentMedicionAusentismoComponent.openDocument('${escapedPath}')">Abrir con aplicación externa</button></div>`;
            }
        } else {
            previewCol.innerHTML = `<div class="preview-error"><h3>Previsualización no disponible</h3><p>La previsualización para archivos <strong>.${fileExtension}</strong> no está soportada.</p><button class="btn btn-primary" onclick="window.currentMedicionAusentismoComponent.openDocument('${escapedPath}')">Abrir con aplicación externa</button></div>`;
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

    async showRegistrarAusentismoPage() {
        this.container.innerHTML = '';
        this.currentView = 'registrar-ausentismo';

        const header = this.createHeader('Registrar Ausentismo', () => {
            this.currentView = 'main';
            this.render();
        });
        this.container.appendChild(header);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'control-remisiones-content';
        contentDiv.style.padding = '20px';
        this.container.appendChild(contentDiv);

        // Función interna para renderizar contenido
        const renderContent = async () => {
            contentDiv.innerHTML = '<p style="text-align:center;">Cargando datos del archivo de ausentismo...</p>';

            try {
                // Simular carga de datos del archivo de ausentismo
                // En una implementación real, esto se conectaría con el backend
                const ausentismoData = {
                    headers: [
                        'N°', 'Documento', 'Nombre del Trabajador', 'Fecha Inicio', 
                        'Fecha Final', 'Días Ausentismo', 'Diagnóstico', 'EPS/ARL', 'Estado'
                    ],
                    rows: [
                        ['1', '12345678', 'Juan Pérez', '01/01/2024', '05/01/2024', '5', 'Gripe', 'EPS Comfa', 'Activo'],
                        ['2', '87654321', 'María García', '10/01/2024', '12/01/2024', '3', 'Dolor de espalda', 'ARL Sura', 'Activo'],
                        ['3', '11223344', 'Carlos López', '15/01/2024', '20/01/2024', '6', 'Fractura de pierna', 'EPS Comfa', 'Inactivo']
                    ],
                    filePath: `C:/Datos/${this.currentCompany}/3. Gestión de la Salud/3.3.6 Medición del ausentismo por causa médica/GI-FO-076 AUSENTISMO POR ARL Y EPS 2024.xlsx`
                };

                contentDiv.innerHTML = ''; // Limpiar mensaje de "Cargando..."

                // Crear contenedor con scroll
                const tableContainer = document.createElement('div');
                tableContainer.style.maxHeight = '70vh';
                tableContainer.style.overflowY = 'auto';
                tableContainer.style.border = '1px solid #ddd';
                tableContainer.style.borderRadius = '4px';

                // Crear tabla
                const table = document.createElement('table');
                table.className = 'data-table';
                table.style.width = '100%';
                table.style.borderCollapse = 'collapse';

                // Crear encabezado
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                
                ausentismoData.headers.forEach(headerText => {
                    const th = document.createElement('th');
                    th.textContent = headerText;
                    th.style.backgroundColor = '#f8f9fa';
                    th.style.padding = '12px 8px';
                    th.style.border = '1px solid #ddd';
                    th.style.textAlign = 'left';
                    th.style.position = 'sticky';
                    th.style.top = '0';
                    headerRow.appendChild(th);
                });
                
                thead.appendChild(headerRow);
                table.appendChild(thead);

                // Crear cuerpo
                const tbody = document.createElement('tbody');
                
                ausentismoData.rows.forEach((row, rowIndex) => {
                    const tr = document.createElement('tr');
                    tr.style.backgroundColor = rowIndex % 2 === 0 ? '#fff' : '#f8f9fa';
                    
                    row.forEach((cellData, cellIndex) => {
                        const td = document.createElement('td');
                        // Si es la última columna, hacerla editable con un select
                        if (cellIndex === row.length - 1) { // Última columna (Estado)
                            const select = document.createElement('select');
                            select.style.width = '100%';
                            select.style.boxSizing = 'border-box';
                            select.style.border = '1px solid #ccc';
                            select.style.padding = '4px';
                            
                            const options = ['Activo', 'Inactivo'];
                            options.forEach(option => {
                                const optionElement = document.createElement('option');
                                optionElement.value = option;
                                optionElement.textContent = option;
                                if (option === cellData) {
                                    optionElement.selected = true;
                                }
                                select.appendChild(optionElement);
                            });
                            
                            select.dataset.rowIndex = rowIndex;
                            select.dataset.colIndex = cellIndex;
                            select.addEventListener('change', (e) => {
                                // Cuando cambie el valor, enviar al backend para guardar
                                this.saveCellData(rowIndex, cellIndex, e.target.value, ausentismoData.filePath);
                            });
                            td.appendChild(select);
                        } else {
                            td.textContent = cellData != null ? cellData.toString() : '';
                        }
                        td.style.padding = '8px';
                        td.style.border = '1px solid #eee';
                        td.style.verticalAlign = 'top';
                        td.style.whiteSpace = 'nowrap';
                        tr.appendChild(td);
                    });
                    
                    tbody.appendChild(tr);
                });
                
                table.appendChild(tbody);
                tableContainer.appendChild(table);
                contentDiv.appendChild(tableContainer);
                
                // Mostrar información adicional
                const infoDiv = document.createElement('div');
                infoDiv.style.marginTop = '15px';
                infoDiv.style.fontSize = '14px';
                infoDiv.style.color = '#666';
                infoDiv.innerHTML = `
                    <p><strong>Formato:</strong> GI-FO-076 AUSENTISMO POR ARL Y EPS 2024</p>
                    <p><strong>Archivo:</strong> ${ausentismoData.filePath}</p>
                    <p><strong>Total de registros:</strong> ${ausentismoData.rows.length}</p>
                `;
                contentDiv.appendChild(infoDiv);
                
                // Botones de acción
                const actionsDiv = document.createElement('div');
                actionsDiv.style.marginTop = '20px';
                actionsDiv.style.display = 'flex';
                actionsDiv.style.gap = '10px';
                
                const addButton = document.createElement('button');
                addButton.className = 'btn btn-primary';
                addButton.textContent = 'Agregar Nuevo Registro';
                addButton.addEventListener('click', () => {
                    alert('Funcionalidad para agregar nuevo registro en desarrollo.');
                });
                
                const saveButton = document.createElement('button');
                saveButton.className = 'btn';
                saveButton.textContent = 'Guardar Cambios';
                saveButton.addEventListener('click', () => {
                    alert('Funcionalidad para guardar cambios en desarrollo.');
                });
                
                actionsDiv.appendChild(addButton);
                actionsDiv.appendChild(saveButton);
                contentDiv.appendChild(actionsDiv);
                
            } catch (error) {
                contentDiv.innerHTML = `
                    <div style="text-align:center; padding:40px; color:#d32f2f;">
                        <h3>💥 Error inesperado</h3>
                        <p>${error.message}</p>
                        <button id="retry-btn-critical" 
                                style="margin-top:20px; padding:10px 20px; background:#3498db; color:white; border:none; border-radius:4px; cursor:pointer;">
                            Reintentar
                        </button>
                    </div>
                `;
                contentDiv.querySelector('#retry-btn-critical').addEventListener('click', renderContent);
            }
        };

        // Llamar a la función de renderizado
        await renderContent();
    }

    // Método para guardar datos de celda
    async saveCellData(rowIndex, colIndex, newValue, filePath) {
        try {
            console.log(`Guardando cambios en fila ${rowIndex + 1}, columna ${colIndex + 1}...`);
            // En una implementación real, esto se conectaría con el backend
            alert(`Cambios guardados: ${newValue} en fila ${rowIndex + 1}, columna ${colIndex + 1}`);
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
}

// Hacer la clase disponible globalmente
window.MedicionAusentismoComponent = MedicionAusentismoComponent;