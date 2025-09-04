// copasst.js - Componente para la vista de actas de CopassT con soporte para Excel

class CopasstComponent {
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
        window.currentCopasstComponent = this;

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
            'Crear una nueva acta.',
            () => alert('Funcionalidad para realizar actas en desarrollo.')
        );
        cardsContainer.appendChild(card2);

        this.container.appendChild(cardsContainer);
    }

    showVerActasPage() {
        this.container.innerHTML = '';
        this.currentPath = null;
        this.pathHistory = [];

        const header = this.createHeader('Ver Actas del COPASST', () => this.render());
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

        // Extensiones permitidas ahora incluyen Excel
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
            
            // Iconos específicos para cada tipo de archivo
            if (extension === '.pdf') {
                icon = '📕';
            } else if (extension === '.doc' || extension === '.docx') {
                icon = '📘';
            } else if (extension === '.xlsx' || extension === '.xls') {
                icon = '📊';
            }
            
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
        const fileName = filePath.split(/[\/]/).pop();
        const escapedPath = filePath.replace(/\\/g, '\\');

        previewCol.innerHTML = `<div class="preview-placeholder">Cargando previsualización...</div>`;

        if (fileExtension === 'pdf') {
            previewCol.innerHTML = `<iframe src="${filePath}" width="100%" height="100%" style="border: none;"></iframe>`;
        } else if (fileExtension === 'doc' || fileExtension === 'docx') {
            try {
                const result = await window.electronAPI.convertDocxToPdf(filePath);
                if (result.success) {
                    previewCol.innerHTML = `<iframe src="${result.pdf_path}?t=${new Date().getTime()}" width="100%" height="100%" style="border: none;"></iframe>`;
                } else {
                    previewCol.innerHTML = `<div class="preview-error"><h3>Error de Conversión</h3><p>${result.error}</p><button class="btn btn-primary" onclick="window.currentCopasstComponent.openDocument('${escapedPath}')">Abrir con aplicación externa</button></div>`;
                }
            } catch (error) {
                previewCol.innerHTML = `<div class="preview-error"><h3>Error Inesperado</h3><p>${error.message}</p><button class="btn btn-primary" onclick="window.currentCopasstComponent.openDocument('${escapedPath}')">Abrir con aplicación externa</button></div>`;
            }
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            try {
                const result = await window.electronAPI.convertExcelToPdf(filePath);
                if (result.success) {
                    previewCol.innerHTML = `<iframe src="${result.pdf_path}?t=${new Date().getTime()}" width="100%" height="100%" style="border: none;"></iframe>`;
                } else {
                    previewCol.innerHTML = `<div class="preview-error"><h3>Error de Conversión</h3><p>${result.error}</p><button class="btn btn-primary" onclick="window.currentCopasstComponent.openDocument('${escapedPath}')">Abrir con aplicación externa</button></div>`;
                }
            } catch (error) {
                previewCol.innerHTML = `<div class="preview-error"><h3>Error Inesperado</h3><p>${error.message}</p><button class="btn btn-primary" onclick="window.currentCopasstComponent.openDocument('${escapedPath}')">Abrir con aplicación externa</button></div>`;
            }
        } else {
            previewCol.innerHTML = `<div class="preview-error"><h3>Previsualización no disponible</h3><p>La previsualización para archivos <strong>.${fileExtension}</strong> no está soportada.</p><button class="btn btn-primary" onclick="window.currentCopasstComponent.openDocument('${escapedPath}')">Abrir con aplicación externa</button></div>`;
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

window.CopasstComponent = CopasstComponent;