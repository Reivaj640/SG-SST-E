// restricciones-medicas.js - Componente para el submódulo "3.1.6 Restricciones y recomendaciones médicas"

class RestriccionesMedicasComponent {
    constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
        this.container = container;
        this.companyName = companyName;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBackToModuleHome = onBackToModuleHome; // Para volver al home del módulo principal
        this.allFiles = [];
        this.submodulePath = null;
    }

    // El render principal que muestra las 4 tarjetas
    render() {
        this.container.innerHTML = '';

        // Botón para volver al menú principal del módulo (Gestión de la Salud)
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

        // 1. Ver Remisiones Médicas
        const card1 = this.createModuleCard(
            'Ver Remisiones Médicas',
            'Visualizar, buscar y previsualizar el historial de remisiones médicas.',
            () => this.showVerRemisionesPage() // Llama a la nueva vista
        );
        cardsContainer.appendChild(card1);

        // 2. Enviar Remisiones
        const card2 = this.createModuleCard(
            'Enviar Remisiones',
            'Crear y enviar nuevas remisiones y recomendaciones.',
            () => this.showPlaceholder('Enviar Remisiones')
        );
        cardsContainer.appendChild(card2);

        // 3. Control de Remisiones
        const card3 = this.createModuleCard(
            'Control de Remisiones',
            'Realizar seguimiento al estado de las remisiones enviadas.',
            () => this.showPlaceholder('Control de Remisiones')
        );
        cardsContainer.appendChild(card3);

        // 4. Próxima Función
        const card4 = this.createModuleCard(
            'Próxima Función',
            'Una nueva funcionalidad estará disponible aquí pronto.',
            () => this.showPlaceholder('Próxima Función')
        );
        cardsContainer.appendChild(card4);

        this.container.appendChild(cardsContainer);
    }

    // --- Lógica para la sección "Ver Remisiones Médicas" ---

    showVerRemisionesPage() {
        this.container.innerHTML = '';

        // Encabezado estilizado
        const header = document.createElement('div');
        header.className = 'submodule-header';
        
        const backButton = document.createElement('button');
        backButton.className = 'btn btn-back';
        backButton.innerHTML = '&#8592; Volver';
        backButton.addEventListener('click', () => this.render()); // Vuelve al menú de tarjetas
        header.appendChild(backButton);
        
        const title = document.createElement('h3');
        title.textContent = 'Ver Remisiones Médicas';
        title.style.flexGrow = '1';
        title.style.textAlign = 'center';
        header.appendChild(title);
        
        // Botón de abrir documento (inicialmente oculto)
        const openButton = document.createElement('button');
        openButton.id = 'open-current-doc-btn';
        openButton.className = 'btn btn-back';
        openButton.textContent = 'Abrir';
        openButton.style.display = 'none';
        openButton.addEventListener('click', () => {
            // La lógica para abrir el documento se maneja en previewDocument
            // Aquí simplemente llamamos a una función que lo haga
            const currentPreview = document.querySelector('#preview-col iframe') || document.querySelector('#preview-col [data-file-path]');
            if (currentPreview) {
                const filePath = currentPreview.getAttribute('data-file-path') || currentPreview.src;
                if (filePath) {
                    this.openDocument(filePath);
                }
            }
        });
        header.appendChild(openButton);
        
        this.container.appendChild(header);

        // Controles de documento (barra de búsqueda y botón de selección manual)
        const controls = document.createElement('div');
        controls.className = 'document-controls';
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Buscar por nombre de archivo o empleado...';
        searchInput.className = 'form-control';
        searchInput.style.flexGrow = '1';
        searchInput.addEventListener('input', (e) => this.filterAndDisplayFiles(e.target.value));
        controls.appendChild(searchInput);

        const manualSelectButton = document.createElement('button');
        manualSelectButton.className = 'btn btn-secondary'; // Estilo de botón secundario
        manualSelectButton.textContent = 'Seleccionar Manualmente';
        manualSelectButton.addEventListener('click', () => this.handleManualSelect());
        controls.appendChild(manualSelectButton);
        
        this.container.appendChild(controls);

        // Layout principal para resultados y previsualización
        const mainLayout = document.createElement('div');
        mainLayout.className = 'remisiones-layout';

        const resultsCol = document.createElement('div');
        resultsCol.id = 'search-results-col';
        resultsCol.className = 'search-results-col';
        mainLayout.appendChild(resultsCol);

        const previewCol = document.createElement('div');
        previewCol.id = 'preview-col';
        previewCol.className = 'preview-col';
        previewCol.innerHTML = `<div class="preview-placeholder">Seleccione un documento para previsualizarlo.</div>`;
        mainLayout.appendChild(previewCol);

        this.container.appendChild(mainLayout);

        this.loadInitialFiles();
    }

    async loadInitialFiles() {
        const resultsCol = document.getElementById('search-results-col');
        resultsCol.innerHTML = '<p>Buscando carpeta de remisiones...</p>';
        try {
            if (!this.submodulePath) {
                const result = await window.electronAPI.findSubmodulePath(this.companyName, this.moduleName, this.submoduleName);
                if (result.success) {
                    this.submodulePath = result.path;
                } else {
                    resultsCol.innerHTML = `<p>Error al encontrar la ruta del submódulo: ${result.error}</p>`;
                    return;
                }
            }

            const submoduleStructure = await window.electronAPI.mapDirectory(this.submodulePath);
            if (submoduleStructure?.structure?.structure) {
                const rootNode = submoduleStructure.structure.structure;
                const subdirectories = Object.values(rootNode.subdirectories || {});
                
                // Buscar la carpeta específica que comienza con "3.1.6.1"
                const remisionesEpsFolder = subdirectories.find(dir => dir.name.trim().startsWith('3.1.6.1'));

                if (remisionesEpsFolder) {
                    // Si se encuentra, buscar PDFs solo dentro de esa carpeta
                    this.allFiles = this.findPdfFilesRecursive(remisionesEpsFolder);
                    this.filterAndDisplayFiles('');
                } else {
                    // Si no se encuentra, mostrar un mensaje
                    resultsCol.innerHTML = '<p>No se encontró la carpeta específica "3.1.6.1 remisiones eps" dentro del submódulo.</p>';
                }
            } else {
                resultsCol.innerHTML = '<p>Error: No se pudo obtener la estructura del directorio.</p>';
            }
        } catch (error) {
            resultsCol.innerHTML = `<p>Error al cargar archivos: ${error.message}</p>`;
        }
    }

    findPdfFilesRecursive(node) {
        let files = [];
        if (node.files) {
            files = files.concat(node.files.filter(f => 
                f.name.toLowerCase().endsWith('.pdf') || 
                f.name.toLowerCase().endsWith('.docx') || 
                f.name.toLowerCase().endsWith('.doc')
            ));
        }
        if (node.subdirectories) {
            for (const dirName in node.subdirectories) {
                files = files.concat(this.findPdfFilesRecursive(node.subdirectories[dirName]));
            }
        }
        return files;
    }

    filterAndDisplayFiles(query) {
        const resultsCol = document.getElementById('search-results-col');
        resultsCol.innerHTML = '';
        const filteredFiles = this.allFiles.filter(file => file.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredFiles.length === 0) {
            resultsCol.innerHTML = '<p>No se encontraron archivos (PDF, DOC, DOCX).</p>';
            return;
        }

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
        } catch (error) {
            alert('No se pudo seleccionar el archivo.');
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

    previewDocument(filePath) {
        // Mostrar el botón "Abrir" cuando se previsualiza un documento
        const openButton = document.getElementById('open-current-doc-btn');
        if (openButton) {
            openButton.style.display = 'inline-block';
            // Guardar la ruta del archivo en un atributo de datos del botón
            openButton.setAttribute('data-current-file', filePath);
        }
        const previewCol = document.getElementById('preview-col');
        if (!filePath) {
            previewCol.innerHTML = `<div class="preview-placeholder">Ruta de archivo no válida.</div>`;
            return;
        }

        const fileName = filePath.split(/[\\\\/]/).pop().toLowerCase();
        const fileExtension = fileName.split('.').pop();

        if (fileExtension === 'pdf') {
            previewCol.innerHTML = `<iframe src="${filePath}" width="100%" height="100%" style="border: none;"></iframe>`;
        } else if (fileExtension === 'docx') {
            // Mostrar mensaje de conversión y llamar a la API
            previewCol.innerHTML = `<div style="text-align: center; padding: 40px;"><p>Convirtiendo documento de Word a PDF para previsualización...</p></div>`;
            window.electronAPI.convertDocxToPdf(filePath).then(result => {
                if (result.success) {
                    previewCol.innerHTML = `<iframe src="${result.pdfPath}" width="100%" height="100%" style="border: none;"></iframe>`;
                } else {
                    previewCol.innerHTML = `
                        <div style="text-align: center; padding: 40px; border: 2px dashed #d9534f; margin: 20px; border-radius: 10px; background-color: #f2dede;">
                            <div style="font-size: 4em; margin-bottom: 20px; color: #d9534f;">⚠️</div>
                            <h3>Error en la Previsualización</h3>
                            <p>No se pudo convertir el archivo <strong>${fileName}</strong>.</p>
                            <p style="font-size: 0.9em; color: #777;">Error: ${result.error}</p>
                            <div style="margin-top: 30px;">
                                <button class="btn btn-primary" onclick="window.open('${filePath}')">Abrir con aplicación externa</button>
                            </div>
                        </div>`;
                }
            }).catch(error => {
                console.error('Error al convertir el documento:', error);
                previewCol.innerHTML = `<p>Ocurrió un error al previsualizar el documento: ${error.message}</p>`;
            });
        } else {
            // Para otros tipos de archivos (incluyendo .doc)
            previewCol.innerHTML = `
                <div style="text-align: center; padding: 40px; border: 2px dashed #ccc; margin: 20px; border-radius: 10px; background-color: #f9f9f9;">
                    <div style="font-size: 4em; margin-bottom: 20px;">📄</div>
                    <h3>Previsualización no disponible</h3>
                    <p>El archivo: <strong>${fileName}</strong> no se puede mostrar directamente.</p>
                    <div style="margin-top: 30px;">
                        <button class="btn btn-primary" onclick="window.open('${filePath}')">Abrir con aplicación externa</button>
                    </div>
                </div>`;
        }
    }

    // --- Métodos de ayuda y placeholders ---

    createModuleCard(title, description, onClick) {
        const card = document.createElement('div');
        card.className = 'card module-card';
        const cardTitle = document.createElement('h3');
        cardTitle.textContent = title;
        cardTitle.className = 'card-title';
        card.appendChild(cardTitle);
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

    showPlaceholder(featureName) {
        alert(`La funcionalidad '${featureName}' se implementará en el futuro.`);
    }
}

// Inyectar solo los estilos CSS necesarios que no estén cubiertos por styles.css
const style = document.createElement('style');
style.textContent = `
    .remisiones-layout {
        display: flex;
        gap: var(--spacer);
        flex-grow: 1;
        height: calc(100vh - 250px); /* Ajustar altura considerando el nuevo header y controles */
    }
    .search-results-col {
        flex: 1;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-md);
        padding: var(--spacer-sm);
        overflow-y: auto;
        background-color: var(--widget-bg-color);
        box-shadow: var(--box-shadow);
    }
    .preview-col {
        flex: 3;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-md);
        overflow: hidden;
        box-shadow: var(--box-shadow);
    }
    .preview-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-light-color);
        background-color: var(--bg-color); /* Usar el color de fondo estándar */
    }
    .search-results-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    .search-results-list li {
        padding: 10px 8px;
        cursor: pointer;
        border-bottom: 1px solid var(--border-color);
        transition: background-color var(--transition-fast), transform var(--transition-fast);
    }
    .search-results-list li:hover {
        background-color: var(--button-hover-bg-color);
        color: var(--white-color);
        transform: translateX(4px);
    }
    .search-results-list li:last-child {
        border-bottom: none;
    }
    /* Ocultar el botón de abrir documento por defecto */
    #open-current-doc-btn {
        display: none;
    }
`;
document.head.appendChild(style);

window.RestriccionesMedicasComponent = RestriccionesMedicasComponent;