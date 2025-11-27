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
            'Crear una nueva acta a partir de una plantilla de Excel.',
            () => this.showRealizarActasInterface()
        );
        cardsContainer.appendChild(card2);

        this.container.appendChild(cardsContainer);
    }

    showVerActasPage() {
        // Crear iframe para el visualizador estándar de COPASST
        const viewerFrame = document.createElement('iframe');
        viewerFrame.id = 'copasst-actas-viewer';
        viewerFrame.style.width = '100%';
        viewerFrame.style.height = 'calc(100vh - 100px)'; // Altura menos el encabezado
        viewerFrame.style.border = 'none';
        viewerFrame.scrolling = 'no';

        // Construir la URL con parámetros para el visualizador
        const viewerUrl = `copasst-viewer.html?company=${encodeURIComponent(this.currentCompany)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        viewerFrame.src = viewerUrl;

        this.container.innerHTML = '';

        const header = this.createHeader('Ver Actas del COPASST', () => this.render());
        this.container.appendChild(header);

        this.container.appendChild(viewerFrame);

        // Establecer comunicación entre frames
        window.addEventListener('message', (event) => {
            if (event.data.type === 'back-to-module-request') {
                this.render();
            }
        });
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

    showRealizarActasInterface() {
        this.container.innerHTML = '';

        const header = this.createHeader('Realizar Acta de Reunión', () => this.render());
        this.container.appendChild(header);

        // Create the main container
        const editorContainer = document.createElement('div');
        editorContainer.className = 'acta-editor-container';

        // Add CSS styles programmatically
        const style = document.createElement('style');
        style.textContent = `
            /* --- Estilos homogéneos con la interfaz principal de la app --- */
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

            :root {
                /* Paleta de colores basada en la interfaz principal de la app */
                --primary-color: #206A5D;         /* Color principal de la app */
                --primary-hover-color: #1A564B;   /* Hover del color principal */
                --secondary-color: #6c757d;       /* Color secundario */
                --success-color: #28a745;         /* Color de éxito */
                --danger-color: #dc3545;          /* Color de peligro */
                --warning-color: #ffc107;         /* Color de advertencia */
                --info-color: #17a2b8;           /* Color de información */
                --light-color: #f8f9fa;          /* Color claro */
                --dark-color: #33383d;           /* Color oscuro */
                --white-color: #ffffff;          /* Blanco */
                --black-color: #000000;          /* Negro */

                /* Colores de texto */
                --text-color: #212529;           /* Color de texto principal */
                --text-light-color: #6c757d;     /* Color de texto claro */
                --text-lighter-color: #adb5bd;   /* Color de texto más claro */
                --heading-color: #495057;        /* Color de encabezados */

                /* Colores de fondo */
                --bg-color: #f8f9fa;             /* Fondo principal */
                --widget-bg-color: #ffffff;      /* Fondo de widgets */
                --border-color: #dee2e6;         /* Color de bordes */

                /* Colores de botones */
                --button-bg-color: var(--primary-color);
                --button-text-color: var(--white-color);
                --button-hover-bg-color: var(--primary-hover-color);
                --button-border-color: var(--primary-color);

                /* Tipografía */
                --font-family: 'Poppins', sans-serif;
                --border-radius-md: 0.375rem;     /* Radio de borde mediano */
                --border-radius-lg: 0.5rem;       /* Radio de borde grande */
                --box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
                --box-shadow-lg: 0 1rem 3rem rgba(0, 0, 0, 0.175);
            }

            * {
                box-sizing: border-box;
            }

            .app-container {
                font-family: var(--font-family);
                color: var(--text-color);
                margin: 0;
                min-height: 100vh;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                background: var(--bg-color);
                padding: 2rem 1.5rem;
                max-width: 1100px;
                margin: 0 auto;
                min-height: 100vh;
            }

            /* --- Header --- */
            .app-header {
                text-align: center;
                margin-bottom: 3rem;
            }

            .header-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.5rem;
            }

            .header-content .app-title {
                font-size: 2rem; /* Reducido del tamaño exagerado */
                font-weight: 700;
                margin: 0;
                color: var(--primary-color);
            }

            .header-content .app-subtitle {
                font-size: 1.2rem;
                font-weight: 400;
                color: var(--text-light-color);
                margin: 0;
            }

            /* --- Cards --- */
            .card {
                background: var(--widget-bg-color);
                border-radius: var(--border-radius-lg);
                border: 1px solid var(--border-color);
                box-shadow: var(--box-shadow);
                padding: 2rem;
                margin-bottom: 2rem;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }

            .card:hover {
                transform: translateY(-2px);
                box-shadow: var(--box-shadow-lg);
            }

            .card-title {
                font-size: 1.5rem;
                font-weight: 600;
                margin-top: 0;
                margin-bottom: 1.5rem;
                color: var(--heading-color);
                border-bottom: 2px solid var(--primary-color);
                padding-bottom: 0.5rem;
            }

            /* --- Form Grid & Inputs --- */
            .form-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1.5rem;
            }

            .form-group {
                display: flex;
                flex-direction: column;
            }

            .form-group.full-width {
                grid-column: 1 / -1;
            }

            .form-group label {
                font-size: 0.9rem;
                font-weight: 500;
                color: var(--text-light-color);
                margin-bottom: 0.5rem;
            }

            .form-group input,
            .form-group textarea {
                font-family: var(--font-family);
                font-size: 1rem;
                padding: 0.5rem 0.75rem;
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-md);
                background: var(--widget-bg-color);
                color: var(--text-color);
                transition: all 0.2s ease;
            }

            .form-group input::placeholder,
            .form-group textarea::placeholder {
                color: var(--text-lighter-color);
            }

            .form-group input:focus,
            .form-group textarea:focus {
                outline: 0;
                border-color: var(--primary-color);
                background: var(--widget-bg-color);
                box-shadow: 0 0 0 0.2rem rgba(32, 106, 93, 0.25);
            }

            /* --- Dynamic Lists --- */
            .dynamic-list {
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
            }

            .dynamic-item {
                background: var(--light-color);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-md);
                padding: 1.5rem;
                display: grid;
                gap: 1rem;
                align-items: end;
                transition: all 0.2s ease;
            }

            .dynamic-item:hover {
                background: var(--widget-bg-color);
                border-color: var(--primary-color);
                transform: translateY(-1px);
            }

            .dynamic-item.agenda-item {
                grid-template-columns: 2fr 1fr 1fr auto;
            }

            .dynamic-item.desarrollo-item {
                grid-template-columns: 1fr 1fr auto;
            }

            .dynamic-item label {
                font-size: 0.8rem;
                font-weight: 600;
                color: var(--text-light-color);
                margin-bottom: 0.25rem;
            }

            .dynamic-item input,
            .dynamic-item textarea {
                width: 100%;
                padding: 0.5rem;
                border: 1px solid var(--border-color);
                background: var(--widget-bg-color);
                border-radius: var(--border-radius-md);
                font-size: 0.9rem;
                color: var(--text-color);
            }

            .dynamic-item textarea {
                resize: vertical;
                min-height: 80px;
            }

            .dynamic-item .actions {
                display: flex;
                align-items: center;
            }

            .btn-remove {
                background: var(--danger-color);
                border: none;
                color: white;
                cursor: pointer;
                padding: 0.6rem;
                border-radius: var(--border-radius-md);
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .btn-remove:hover {
                background: #c82333;
                transform: scale(1.05);
            }

            /* --- Add Item Button --- */
            .btn-add-item {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                width: 100%;
                margin-top: 1rem;
                padding: 0.75rem;
                background: var(--primary-color);
                border: 1px solid var(--primary-color);
                border-radius: var(--border-radius-md);
                color: white;
                font-weight: 500;
                font-size: 1rem;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .btn-add-item:hover {
                background: var(--primary-hover-color);
                border-color: var(--primary-hover-color);
                transform: translateY(-1px);
                box-shadow: var(--box-shadow);
            }

            /* --- Footer & Action Buttons --- */
            .app-footer {
                display: flex;
                justify-content: center;
                gap: 1.5rem;
                margin-top: 2rem;
                padding: 2rem 0;
                background: var(--bg-color);
            }

            .btn {
                padding: 0.5rem 1rem;
                border-radius: var(--border-radius-md);
                font-size: 1rem;
                font-weight: 500;
                cursor: pointer;
                border: 1px solid transparent;
                transition: all 0.2s ease;
                text-transform: none;
                letter-spacing: normal;
            }

            .btn:active {
                transform: scale(0.98);
            }

            .btn-primary {
                background: var(--primary-color);
                color: white;
                border: 1px solid var(--primary-color);
            }

            .btn-primary:hover {
                background: var(--primary-hover-color);
                border-color: var(--primary-hover-color);
                transform: translateY(-1px);
            }

            .btn-secondary {
                background: var(--light-color);
                color: var(--text-color);
                border: 1px solid var(--border-color);
            }

            .btn-secondary:hover {
                background: var(--secondary-color);
                color: white;
                border-color: var(--secondary-color);
                transform: translateY(-1px);
            }
        `;
        document.head.appendChild(style);

        // Create the app container
        const appContainer = document.createElement('div');
        appContainer.className = 'app-container';



        // Create main content
        const mainContent = document.createElement('main');
        mainContent.className = 'main-content';

        // Create Información de la Reunión card
        const infoCard = document.createElement('section');
        infoCard.className = 'card';
        const infoCardTitle = document.createElement('h2');
        infoCardTitle.className = 'card-title';
        infoCardTitle.textContent = 'Información de la Reunión';

        const formGrid = document.createElement('div');
        formGrid.className = 'form-grid';

        // Create form groups for meeting information
        const actaNumberGroup = document.createElement('div');
        actaNumberGroup.className = 'form-group';
        const actaNumberLabel = document.createElement('label');
        actaNumberLabel.setAttribute('for', 'acta-number');
        actaNumberLabel.textContent = 'N° de Acta';
        const actaNumberInput = document.createElement('input');
        actaNumberInput.type = 'number';
        actaNumberInput.id = 'acta-number';
        actaNumberInput.value = '108';
        actaNumberGroup.appendChild(actaNumberLabel);
        actaNumberGroup.appendChild(actaNumberInput);

        const fechaGroup = document.createElement('div');
        fechaGroup.className = 'form-group';
        const fechaLabel = document.createElement('label');
        fechaLabel.setAttribute('for', 'fecha');
        fechaLabel.textContent = 'Fecha';
        const fechaInput = document.createElement('input');
        fechaInput.type = 'date';
        fechaInput.id = 'fecha';
        fechaInput.value = '2025-01-09';
        fechaGroup.appendChild(fechaLabel);
        fechaGroup.appendChild(fechaInput);

        const iniciaGroup = document.createElement('div');
        iniciaGroup.className = 'form-group';
        const iniciaLabel = document.createElement('label');
        iniciaLabel.setAttribute('for', 'inicia');
        iniciaLabel.textContent = 'Hora Inicio';
        const iniciaInput = document.createElement('input');
        iniciaInput.type = 'time';
        iniciaInput.id = 'inicia';
        iniciaInput.value = '08:00';
        iniciaGroup.appendChild(iniciaLabel);
        iniciaGroup.appendChild(iniciaInput);

        const terminaGroup = document.createElement('div');
        terminaGroup.className = 'form-group';
        const terminaLabel = document.createElement('label');
        terminaLabel.setAttribute('for', 'termina');
        terminaLabel.textContent = 'Hora Fin';
        const terminaInput = document.createElement('input');
        terminaInput.type = 'time';
        terminaInput.id = 'termina';
        terminaInput.value = '09:00';
        terminaGroup.appendChild(terminaLabel);
        terminaGroup.appendChild(terminaInput);

        const topicGroup = document.createElement('div');
        topicGroup.className = 'form-group full-width';
        const topicLabel = document.createElement('label');
        topicLabel.setAttribute('for', 'topic');
        topicLabel.textContent = 'Tema';
        const topicInput = document.createElement('input');
        topicInput.type = 'text';
        topicInput.id = 'topic';
        topicInput.value = 'Reunión del COPASST';
        topicGroup.appendChild(topicLabel);
        topicGroup.appendChild(topicInput);

        const lugarGroup = document.createElement('div');
        lugarGroup.className = 'form-group full-width';
        const lugarLabel = document.createElement('label');
        lugarLabel.setAttribute('for', 'ciudad-lugar');
        lugarLabel.textContent = 'Lugar';
        const lugarInput = document.createElement('input');
        lugarInput.type = 'text';
        lugarInput.id = 'ciudad-lugar';
        lugarInput.value = 'Barranquilla, Oficinas Tempoactiva';
        lugarGroup.appendChild(lugarLabel);
        lugarGroup.appendChild(lugarInput);

        formGrid.appendChild(actaNumberGroup);
        formGrid.appendChild(fechaGroup);
        formGrid.appendChild(iniciaGroup);
        formGrid.appendChild(terminaGroup);
        formGrid.appendChild(topicGroup);
        formGrid.appendChild(lugarGroup);

        infoCard.appendChild(infoCardTitle);
        infoCard.appendChild(formGrid);
        mainContent.appendChild(infoCard);

        // Create Agenda card
        const agendaCard = document.createElement('section');
        agendaCard.className = 'card';
        const agendaCardTitle = document.createElement('h2');
        agendaCardTitle.className = 'card-title';
        agendaCardTitle.textContent = 'Agenda de la Reunión';

        const agendaList = document.createElement('div');
        agendaList.id = 'agenda-list';
        agendaList.className = 'dynamic-list';

        const addAgendaBtn = document.createElement('button');
        addAgendaBtn.id = 'add-agenda-btn';
        addAgendaBtn.className = 'btn-add-item';
        addAgendaBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Agregar tema
        `;

        agendaCard.appendChild(agendaCardTitle);
        agendaCard.appendChild(agendaList);
        agendaCard.appendChild(addAgendaBtn);
        mainContent.appendChild(agendaCard);

        // Create Desarrollo card
        const desarrolloCard = document.createElement('section');
        desarrolloCard.className = 'card';
        const desarrolloCardTitle = document.createElement('h2');
        desarrolloCardTitle.className = 'card-title';
        desarrolloCardTitle.textContent = 'Desarrollo y Compromisos';

        const desarrolloList = document.createElement('div');
        desarrolloList.id = 'desarrollo-list';
        desarrolloList.className = 'dynamic-list';

        const addDesarrolloBtn = document.createElement('button');
        addDesarrolloBtn.id = 'add-desarrollo-btn';
        addDesarrolloBtn.className = 'btn-add-item';
        addDesarrolloBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Agregar punto tratado
        `;

        desarrolloCard.appendChild(desarrolloCardTitle);
        desarrolloCard.appendChild(desarrolloList);
        desarrolloCard.appendChild(addDesarrolloBtn);
        mainContent.appendChild(desarrolloCard);

        appContainer.appendChild(mainContent);

        // Create footer
        const footer = document.createElement('footer');
        footer.className = 'app-footer';
        const saveDraftBtn = document.createElement('button');
        saveDraftBtn.id = 'save-draft-btn';
        saveDraftBtn.className = 'btn btn-secondary';
        saveDraftBtn.textContent = 'Guardar Borrador';
        const exportExcelBtn = document.createElement('button');
        exportExcelBtn.id = 'export-excel-btn';
        exportExcelBtn.className = 'btn btn-secondary';
        exportExcelBtn.textContent = 'Exportar a Excel';

        footer.appendChild(saveDraftBtn);
        footer.appendChild(exportExcelBtn);

        appContainer.appendChild(footer);
        editorContainer.appendChild(appContainer);
        this.container.appendChild(editorContainer);

        // --- LÓGICA DE INTERACCIÓN ---
        // Datos iniciales para que no esté vacío
        const initialAgenda = [
            { tema: 'Revisión del acta anterior N° 107', duracion: '00:10 Minutos', lider: 'Representante del Copasst' },
            { tema: 'Revisión de Accidentes del Mes de Diciembre', duracion: '00:10 Minutos', lider: 'Representante del Copasst' },
            { tema: 'Revisión Avance del Plan de Trabajo Anual', duracion: '00:30 Minutos', lider: 'Representante del Copasst' }
        ];

        const initialDesarrollo = [
            { tema: 'Revisión del Acta Anterior, se continúan realizando las inspecciones programadas...', compromisos: 'Ninguno', fecha: 'Ninguno', responsable: 'Ninguno' },
            { tema: 'Accidente laboral de Armando Cervantes Perez', compromisos: 'Realizar seguimiento del plan de acción del AT.', fecha: '2024/12/31', responsable: 'Miembros del Copasst y Asesor SST' }
        ];

        // --- Funciones para Crear Elementos Dinámicos ---
        function createAgendaItem(data = {}) {
            const item = document.createElement('div');
            item.className = 'dynamic-item agenda-item';
            item.innerHTML = `
                <div>
                    <label>Tema</label>
                    <input type="text" placeholder="Descripción del tema" value="${data.tema || ''}">
                </div>
                <div>
                    <label>Duración</label>
                    <input type="text" placeholder="Ej: 00:10 Minutos" value="${data.duracion || ''}">
                </div>
                <div>
                    <label>Líder</label>
                    <input type="text" placeholder="Nombre del líder" value="${data.lider || ''}">
                </div>
                <div class="actions">
                    <button class="btn-remove" title="Eliminar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;
            item.querySelector('.btn-remove').addEventListener('click', () => item.remove());
            return item;
        }

        function createDesarrolloItem(data = {}) {
            const item = document.createElement('div');
            item.className = 'dynamic-item desarrollo-item';
            item.innerHTML = `
                <div>
                    <label>Temas Tratados</label>
                    <textarea placeholder="Descripción del tema" rows="9">${data.tema || ''}</textarea>
                </div>
                <div>
                    <label>Compromisos</label>
                    <textarea placeholder="Describir los compromisos" rows="5">${data.compromisos || ''}</textarea>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div>
                            <label>Fecha</label>
                            <input type="date" value="${data.fecha || ''}">
                        </div>
                        <div>
                            <label>Responsable</label>
                            <input type="text" placeholder="Nombre del responsable" value="${data.responsable || ''}">
                        </div>
                    </div>
                </div>
                <div class="actions">
                    <button class="btn-remove" title="Eliminar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;
            item.querySelector('.btn-remove').addEventListener('click', () => item.remove());
            return item;
        }

        // --- Cargar Datos Iniciales ---
        initialAgenda.forEach(data => agendaList.appendChild(createAgendaItem(data)));
        initialDesarrollo.forEach(data => desarrolloList.appendChild(createDesarrolloItem(data)));

        // --- Event Listeners para Agregar Items ---
        addAgendaBtn.addEventListener('click', () => agendaList.appendChild(createAgendaItem()));
        addDesarrolloBtn.addEventListener('click', () => desarrolloList.appendChild(createDesarrolloItem()));

        // --- Acciones de los botones principales (conexión con la funcionalidad existente del Electron) ---
        saveDraftBtn.addEventListener('click', () => {
            // Recolección de datos del formulario
            const actaNumber = document.getElementById('acta-number').value;
            const fecha = document.getElementById('fecha').value;
            const inicia = document.getElementById('inicia').value;
            const termina = document.getElementById('termina').value;
            const topic = document.getElementById('topic').value;
            const lugar = document.getElementById('ciudad-lugar').value;

            // Recolección de datos de la agenda
            const agendaItems = [];
            document.querySelectorAll('#agenda-list .dynamic-item').forEach(item => {
                const inputs = item.querySelectorAll('input');
                agendaItems.push({
                    tema: inputs[0].value,
                    duracion: inputs[1].value,
                    lider: inputs[2].value
                });
            });

            // Recolección de datos de desarrollo
            const desarrolloItems = [];
            document.querySelectorAll('#desarrollo-list .dynamic-item').forEach(item => {
                const textareas = item.querySelectorAll('textarea');
                const inputs = item.querySelectorAll('input');
                desarrolloItems.push({
                    tema: textareas[0].value,
                    compromisos: textareas[1].value,
                    fecha: inputs[0].value,
                    responsable: inputs[1].value
                });
            });

            // Simular guardado - en tu aplicación real conecta con electronAPI
            alert('Función de guardar borrador. En la app real, esto guardaría los datos en un archivo o base de datos.');

            // En una implementación real, podrías hacer:
            // window.electronAPI.saveDraft({
            //     actaNumber, fecha, inicia, termina, topic, lugar, agendaItems, desarrolloItems
            // });
        });

        exportExcelBtn.addEventListener('click', () => {
            // Recolección de datos del formulario
            const actaNumber = document.getElementById('acta-number').value;
            const fecha = document.getElementById('fecha').value;
            const inicia = document.getElementById('inicia').value;
            const termina = document.getElementById('termina').value;
            const topic = document.getElementById('topic').value;
            const lugar = document.getElementById('ciudad-lugar').value;

            // Recolección de datos de la agenda
            const agendaItems = [];
            document.querySelectorAll('#agenda-list .dynamic-item').forEach(item => {
                const inputs = item.querySelectorAll('input');
                agendaItems.push({
                    tema: inputs[0].value,
                    duracion: inputs[1].value,
                    lider: inputs[2].value
                });
            });

            // Recolección de datos de desarrollo
            const desarrolloItems = [];
            document.querySelectorAll('#desarrollo-list .dynamic-item').forEach(item => {
                const textareas = item.querySelectorAll('textarea');
                const inputs = item.querySelectorAll('input');
                desarrolloItems.push({
                    tema: textareas[0].value,
                    compromisos: textareas[1].value,
                    fecha: inputs[0].value,
                    responsable: inputs[1].value
                });
            });

            // Enviar datos a la función de exportación existente
            window.CopasstComponent.exportToExcel({
                actaNumber, fecha, inicia, termina, topic, lugar, agendaItems, desarrolloItems
            });
        });

        // Add method to export to Excel
        window.CopasstComponent.exportToExcel = async (data) => {
            try {
                // Call the existing Electron API to generate the acta
                const changes = this.prepareExcelData(data);
                const result = await window.electronAPI.generateCopasstActa(changes);
                if (result.success) {
                    alert(`Acta guardada exitosamente en: ${result.documentPath}`);
                } else {
                    alert(`Error al guardar el acta: ${result.error}`);
                }
            } catch (error) {
                console.error('Error al exportar a Excel:', error);
                alert(`Error fatal al exportar el acta: ${error.message}`);
            }
        };
    }

    // Helper method to prepare data for Excel export
    prepareExcelData(data) {
        const changes = [];

        // Add the general meeting information
        changes.push({ row: 1, col: 0, value: `Acta N° ${data.actaNumber}` });
        changes.push({ row: 2, col: 0, value: `Fecha: ${data.fecha}` });
        changes.push({ row: 3, col: 0, value: `Hora Inicio: ${data.inicia}` });
        changes.push({ row: 4, col: 0, value: `Hora Fin: ${data.termina}` });
        changes.push({ row: 5, col: 0, value: `Tema: ${data.topic}` });
        changes.push({ row: 6, col: 0, value: `Lugar: ${data.lugar}` });

        // Add agenda items
        changes.push({ row: 8, col: 0, value: 'Agenda de la Reunión' });
        data.agendaItems.forEach((item, index) => {
            changes.push({ row: 9 + index, col: 0, value: item.tema });
            changes.push({ row: 9 + index, col: 1, value: item.duracion });
            changes.push({ row: 9 + index, col: 2, value: item.lider });
        });

        // Add development items
        const startRowDesarrollo = 10 + data.agendaItems.length;
        changes.push({ row: startRowDesarrollo, col: 0, value: 'Desarrollo y Compromisos' });
        data.desarrolloItems.forEach((item, index) => {
            changes.push({ row: startRowDesarrollo + 1 + index, col: 0, value: item.tema });
            changes.push({ row: startRowDesarrollo + 1 + index, col: 1, value: item.compromisos });
            changes.push({ row: startRowDesarrollo + 1 + index, col: 2, value: item.fecha });
            changes.push({ row: startRowDesarrollo + 1 + index, col: 3, value: item.responsable });
        });

        return changes;
    }

    async loadAndRenderActaEditor(container) {
        container.innerHTML = '<p>Cargando datos de la plantilla...</p>';
        try {
            const result = await window.electronAPI.getActaData();
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
            console.error('[COPASST] No se encontró la tabla editable');
            return;
        }

        const changes = [];
        const cells = table.querySelectorAll('td[contenteditable="true"]');
        console.log('[COPASST] Total celdas editables encontradas:', cells.length);

        cells.forEach(cell => {
            const row = parseInt(cell.getAttribute('data-row'));
            const col = parseInt(cell.getAttribute('data-col'));
            const value = cell.textContent.trim();

            if (!isNaN(row) && !isNaN(col) && value) {
                // Ajustar índice para alinearse con Excel (0-based en frontend, +1 para bajar una fila)
                changes.push({ row: row + 1, col: col, value });
                console.log(`[COPASST] Cambio detectado: row=${row} (Excel row=${row + 2}), col=${col} (Excel col=${col + 1}), value="${value}"`);
            } else {
                console.warn(`[COPASST] Celda ignorada: row=${row}, col=${col}, value="${value}"`);
            }
        });

        if (changes.length === 0) {
            alert('No hay datos para guardar.');
            console.warn('[COPASST] No se encontraron cambios para guardar');
            return;
        }

        try {
            console.log('[COPASST] Enviando cambios al IPC:', JSON.stringify(changes, null, 2));
            const result = await window.electronAPI.generateCopasstActa(changes);
            if (result.success) {
                alert(`Acta guardada exitosamente en: ${result.documentPath}`);
                console.log('[COPASST] Acta guardada:', result.documentPath);
            } else {
                alert(`Error al guardar el acta: ${result.error}`);
                console.error('[COPASST] Error en IPC:', result.error);
            }
        } catch (error) {
            console.error('[COPASST] Error al invocar la generación del acta:', error);
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

window.CopasstComponent = CopasstComponent;