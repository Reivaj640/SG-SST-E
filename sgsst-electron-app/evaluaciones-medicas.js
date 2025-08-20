// evaluaciones-medicas.js - Componente para el submódulo "3.1.4 Evaluaciones médicas"

class EvaluacionesMedicasComponent {
    constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
        this.container = container;
        this.companyName = companyName;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBackToModuleHome = onBackToModuleHome;
        this.allFiles = [];
        this.submodulePath = null; // Almacenará la ruta base del submódulo 3.1.4
    }

    render() {
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

        const card1 = this.createModuleCard(
            'Ver Evaluaciones Realizadas',
            'Visualizar, buscar y previsualizar certificados de aptitud médica.',
            () => this.showVerEvaluacionesPage()
        );
        cardsContainer.appendChild(card1);

        const card2 = this.createModuleCard(
            'Registrar Nueva Evaluación',
            'Cargar un nuevo certificado o examen médico al sistema.',
            () => this.showPlaceholder('Registrar Nueva Evaluación')
        );
        cardsContainer.appendChild(card2);

        const card3 = this.createModuleCard(
            'Estadísticas de Aptitud',
            'Ver estadísticas sobre los resultados de las evaluaciones.',
            () => this.showPlaceholder('Estadísticas de Aptitud')
        );
        cardsContainer.appendChild(card3);

        const card4 = this.createModuleCard(
            'Próxima Función',
            'Una nueva funcionalidad estará disponible aquí pronto.',
            () => this.showPlaceholder('Próxima Función')
        );
        cardsContainer.appendChild(card4);

        this.container.appendChild(cardsContainer);
    }

    showVerEvaluacionesPage() {
        this.container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'submodule-header';
        
        const backButton = document.createElement('button');
        backButton.className = 'btn btn-back';
        backButton.innerHTML = '&#8592; Volver';
        backButton.addEventListener('click', () => this.render());
        header.appendChild(backButton);
        
        const title = document.createElement('h3');
        title.textContent = 'Ver Evaluaciones Médicas';
        title.style.flexGrow = '1';
        title.style.textAlign = 'center';
        header.appendChild(title);
        
        const openButton = document.createElement('button');
        openButton.id = 'open-current-doc-btn';
        openButton.className = 'btn btn-back';
        openButton.textContent = 'Abrir';
        openButton.style.display = 'none';
        openButton.addEventListener('click', () => {
            const currentPreview = document.querySelector('#preview-col iframe') || document.querySelector('#preview-col [data-file-path]');
            if (currentPreview) {
                const filePath = currentPreview.getAttribute('data-file-path') || currentPreview.src;
                if (filePath) this.openDocument(filePath);
            }
        });
        header.appendChild(openButton);
        
        this.container.appendChild(header);

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
        manualSelectButton.className = 'btn btn-secondary';
        manualSelectButton.textContent = 'Seleccionar Manualmente';
        manualSelectButton.addEventListener('click', () => this.handleManualSelect());
        controls.appendChild(manualSelectButton);
        
        this.container.appendChild(controls);

        const mainLayout = document.createElement('div');
        mainLayout.className = 'remisiones-layout'; // Reutilizamos la clase de layout

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
        resultsCol.innerHTML = '<p>Buscando carpeta de evaluaciones...</p>';
        try {
            // 1. Encontrar la ruta del submódulo padre "3.1.4"
            if (!this.submodulePath) {
                const result = await window.electronAPI.findSubmodulePath(this.companyName, this.moduleName, this.submoduleName);
                if (result.success) {
                    this.submodulePath = result.path;
                } else {
                    resultsCol.innerHTML = `<p>Error al encontrar la ruta del submódulo: ${result.error}</p>`;
                    return;
                }
            }

            // 2. Usar la nueva función recursiva para encontrar todos los archivos dentro de esa ruta
            this.allFiles = await window.electronAPI.findFilesRecursively(this.submodulePath);
            this.filterAndDisplayFiles(''); // Mostrar todos los archivos encontrados

        } catch (error) {
            resultsCol.innerHTML = `<p>Error al cargar archivos: ${error.message}</p>`;
        }
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
            alert('Error al abrir el documento.');
        }
    }

    previewDocument(filePath) {
        const openButton = document.getElementById('open-current-doc-btn');
        if (openButton) {
            openButton.style.display = 'inline-block';
            openButton.setAttribute('data-current-file', filePath);
        }
        const previewCol = document.getElementById('preview-col');
        if (!filePath) {
            previewCol.innerHTML = `<div class="preview-placeholder">Ruta de archivo no válida.</div>`;
            return;
        }

        const fileName = filePath.split(/[\\/]/).pop().toLowerCase();
        const fileExtension = fileName.split('.').pop();

        if (fileExtension === 'pdf') {
            previewCol.innerHTML = `<iframe src="${filePath}" width="100%" height="100%" style="border: none;" data-file-path="${filePath}"></iframe>`;
        } else if (fileExtension === 'docx') {
            previewCol.innerHTML = `<div style="text-align: center; padding: 40px;"><p>Convirtiendo documento de Word a PDF para previsualización...</p></div>`;
            window.electronAPI.convertDocxToPdf(filePath).then(result => {
                if (result.success) {
                    previewCol.innerHTML = `<iframe src="${result.pdfPath}" width="100%" height="100%" style="border: none;" data-file-path="${result.pdfPath}"></iframe>`;
                } else {
                    previewCol.innerHTML = `<div class="preview-error" data-file-path="${filePath}"><h3>Error en la Previsualización</h3><p>No se pudo convertir el archivo <strong>${fileName}</strong>.</p><p>Error: ${result.error}</p><button class="btn btn-primary">Abrir con aplicación externa</button></div>`;
                    previewCol.querySelector('button').addEventListener('click', () => this.openDocument(filePath));
                }
            });
        } else {
            previewCol.innerHTML = `<div class="preview-error" data-file-path="${filePath}"><h3>Previsualización no disponible</h3><p>El archivo: <strong>${fileName}</strong> no se puede mostrar directamente.</p><button class="btn btn-primary">Abrir con aplicación externa</button></div>`;
            previewCol.querySelector('button').addEventListener('click', () => this.openDocument(filePath));
        }
    }

    createModuleCard(title, description, onClick) {
        const card = document.createElement('div');
        card.className = 'card module-card';
        card.innerHTML = `<div class="card-body"><h5 class="card-title">${title}</h5><p class="card-text">${description}</p><button class="btn btn-primary">Acceder</button></div>`;
        card.querySelector('button').addEventListener('click', onClick);
        return card;
    }

    showPlaceholder(featureName) {
        alert(`La funcionalidad '${featureName}' se implementará en el futuro.`);
    }
}

window.EvaluacionesMedicasComponent = EvaluacionesMedicasComponent;
