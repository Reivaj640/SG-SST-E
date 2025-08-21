// responsable-sg.js - Componente para el submódulo "1.1.1 Responsable del SG"

class ResponsableSgComponent {
    constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
        this.container = container;
        this.companyName = companyName;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBackToModuleHome = onBackToModuleHome;
        this.currentDocType = 'designacion_sst';
        this.submodulePath = null;
        this.currentDocumentPath = null;
        
        // Asegurar que los métodos que se usarán como callbacks tengan el contexto correcto
        this.closePreview = this.closePreview.bind(this);
    }

    async render() {
        this.container.innerHTML = '';
        window.currentResponsableSgComponent = this; // Exponer la instancia actual

        const headerContainer = document.createElement('div');
        headerContainer.className = 'submodule-header';

        const backButton = document.createElement('button');
        backButton.className = 'btn btn-back';
        backButton.innerHTML = '&#8592; Volver';
        backButton.addEventListener('click', this.onBackToModuleHome);
        headerContainer.appendChild(backButton);
        
        const title = document.createElement('h3');
        title.textContent = `${this.submoduleName}`;
        title.style.flexGrow = '1';
        title.style.textAlign = 'center';
        headerContainer.appendChild(title);

        const openButton = document.createElement('button');
        openButton.id = 'open-current-doc-btn';
        openButton.className = 'btn btn-back';
        openButton.textContent = 'Abrir';
        openButton.style.display = 'none';
        openButton.addEventListener('click', () => {
            if (this.currentDocumentPath) {
                this.openDocument(this.currentDocumentPath);
            }
        });
        headerContainer.appendChild(openButton);

        this.container.appendChild(headerContainer);

        const topControls = document.createElement('div');
        topControls.className = 'document-controls';
        
        const docTypeSelect = document.createElement('select');
        docTypeSelect.id = 'doc-type-select';
        docTypeSelect.innerHTML = ""
            + "<option value=\"designacion_sst\">Designación Sg-SST</option>"
            + "<option value=\"designacion_pesv\">Designación SG-PESV</option>"
            + "<option value=\"licencia\">Licencia</option>";
        docTypeSelect.value = this.currentDocType;
        docTypeSelect.addEventListener('change', (e) => {
            this.currentDocType = e.target.value;
            this.updateDocumentDisplay();
        });
        topControls.appendChild(docTypeSelect);

        this.container.appendChild(topControls);
        
        const documentViewer = document.createElement('div');
        documentViewer.className = 'document-viewer';
        documentViewer.id = 'document-viewer';
        this.container.appendChild(documentViewer);
        
        this.loadSubmodulePathAndDisplay();
    }
    
    async loadSubmodulePathAndDisplay() {
        try {
            const viewer = document.getElementById('document-viewer');
            if (viewer) viewer.innerHTML = '<p>Buscando documentos del responsable del SG...</p>';
            
            console.log(`Finding path for: company=${this.companyName}, module=${this.moduleName}, submodule=${this.submoduleName}`);
            
            const result = await window.electronAPI.findSubmodulePath(this.companyName, this.moduleName, this.submoduleName);
            
            if (result.success) {
                this.submodulePath = result.path;
                console.log('Found submodule path:', this.submodulePath);
                this.updateDocumentDisplay();
            } else {
                console.error('Error finding submodule path:', result.error);
                if (viewer) viewer.innerHTML = `<p>Error al encontrar la ruta del submódulo: ${result.error}</p>`;
            }
        } catch (error) {
            console.error('Error in loadSubmodulePathAndDisplay:', error);
            const viewer = document.getElementById('document-viewer');
            if (viewer) viewer.innerHTML = `<p>Error al cargar los documentos: ${error.message}</p>`;
        }
    }
    
    async updateDocumentDisplay() {
        const viewer = document.getElementById('document-viewer');
        const openButton = document.getElementById('open-current-doc-btn');
        this.currentDocumentPath = null;
        if (openButton) openButton.style.display = 'none';

        if (!viewer) return;
        if (!this.submodulePath) {
            viewer.innerHTML = '<p>No se ha encontrado la ruta del submódulo.</p>';
            return;
        }

        try {
            viewer.innerHTML = '<p>Buscando documentos específicos...</p>';
            
            // Obtener todos los archivos del submódulo y sus subdirectorios
            let allFiles = [];
            
            // Primero obtener los archivos del directorio principal
            const items = await window.electronAPI.readDirectory(this.submodulePath);
            const files = items.filter(item => !item.isDirectory);
            const subdirectories = items.filter(item => item.isDirectory);
            
            // Agregar archivos del directorio principal
            allFiles = allFiles.concat(files);
            
            // Recorrer todos los subdirectorios recursivamente para obtener todos los archivos
            for (const subdir of subdirectories) {
                try {
                    const subDirFiles = await this.getAllFilesRecursively(subdir.path);
                    allFiles = allFiles.concat(subDirFiles);
                } catch (error) {
                    console.error(`Error reading directory ${subdir.path}:`, error);
                    // Continuar con el siguiente subdirectorio
                }
            }
            
            let documents = [];

            switch (this.currentDocType) {
                case 'designacion_sst':
                    // Filtrar documentos de designación SST (que no sean PESV)
                    documents = allFiles.filter(file => {
                        const fileName = file.name.toLowerCase();
                        const isDesignacion = fileName.includes('designacion');
                        const isSst = isDesignacion && !fileName.includes('pesv');
                        const isDoc = fileName.endsWith('.docx') || fileName.endsWith('.doc') || fileName.endsWith('.pdf');
                        return isDesignacion && isSst && isDoc;
                    });
                    break;
                case 'designacion_pesv':
                    // Filtrar documentos de designación PESV
                    documents = allFiles.filter(file => {
                        const fileName = file.name.toLowerCase();
                        const isDesignacion = fileName.includes('designacion');
                        const isPesv = isDesignacion && fileName.includes('pesv');
                        const isDoc = fileName.endsWith('.docx') || fileName.endsWith('.doc') || fileName.endsWith('.pdf');
                        return isDesignacion && isPesv && isDoc;
                    });
                    break;
                case 'licencia':
                    // Filtrar documentos de licencia
                    documents = allFiles.filter(file => {
                        const fileName = file.name.toLowerCase();
                        const isLicencia = fileName.includes('licencia');
                        const isDoc = fileName.endsWith('.docx') || fileName.endsWith('.doc') || fileName.endsWith('.pdf');
                        return isLicencia && isDoc;
                    });
                    break;
            }

            if (documents.length > 0) {
                // Ordenar documentos por fecha de modificación (más recientes primero)
                documents.sort((a, b) => new Date(b.modified) - new Date(a.modified));
                
                const docToPreview = documents[0];
                this.currentDocumentPath = docToPreview.path;
                if (openButton) openButton.style.display = 'inline-block';
                this.previewDocument(docToPreview.path);
            } else {
                viewer.innerHTML = `<p>No se encontraron documentos para esta selección.</p>`;
            }

        } catch (error) {
            if (viewer) viewer.innerHTML = `<p>Error al cargar los documentos: ${error.message}</p>`;
        }
    }
    
    // Función auxiliar para obtener todos los archivos recursivamente
    async getAllFilesRecursively(directoryPath) {
        let allFiles = [];
        
        try {
            const items = await window.electronAPI.readDirectory(directoryPath);
            const files = items.filter(item => !item.isDirectory);
            const subdirectories = items.filter(item => item.isDirectory);
            
            // Agregar archivos del directorio actual
            allFiles = allFiles.concat(files);
            
            // Recorrer subdirectorios recursivamente
            for (const subdir of subdirectories) {
                try {
                    const subDirFiles = await this.getAllFilesRecursively(subdir.path);
                    allFiles = allFiles.concat(subDirFiles);
                } catch (error) {
                    console.error(`Error reading subdirectory ${subdir.path}:`, error);
                    // Continuar con el siguiente subdirectorio
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${directoryPath}:`, error);
            throw error;
        }
        
        return allFiles;
    }
    
    async openDocument(filePath) {
        try {
            await window.electronAPI.openPath(filePath);
        } catch (error) {
            console.error('Error al abrir el documento:', error);
            alert('Error al abrir el documento.');
        }
    }
    
    async previewDocument(filePath) {
        const viewer = document.getElementById('document-viewer');
        if (!viewer) return;

        const fileName = filePath.split(/[\/]/).pop();
        const escapedPath = filePath.replace(/\//g, '\\');
        const fileExtension = filePath.split('.').pop().toLowerCase();

        try {
            // Manejar PDF directamente
            if (fileExtension === 'pdf') {
                viewer.innerHTML = `
                    <iframe src="${filePath}" width="100%" height="600px" style="border: none;"></iframe>
                    <div style="text-align: center; margin-top: 10px;">
                        <button id="close-preview-btn" class="btn preview-close-btn">Cerrar Previsualización</button>
                    </div>`;
            // Manejar .doc y .docx con el servicio de conversión
            } else if (fileExtension === 'doc' || fileExtension === 'docx') {
                viewer.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <p>Convirtiendo documento de Word a PDF para previsualización...</p>
                    </div>`;
                
                const result = await window.electronAPI.convertDocxToPdf(filePath);
                
                if (result.success) {
                    // CORRECCIÓN: Usar result.pdf_path y añadir timestamp
                    viewer.innerHTML = `
                        <iframe src="${result.pdf_path}?t=${new Date().getTime()}" width="100%" height="600px" style="border: none;"></iframe>
                        <div style="text-align: center; margin-top: 10px;">
                            <button id="close-preview-btn" class="btn preview-close-btn">Cerrar Previsualización</button>
                        </div>`;
                } else {
                    // Usar la plantilla de error existente
                    viewer.innerHTML = `
                        <div style="text-align: center; padding: 40px; border: 2px dashed #d9534f; margin: 20px; border-radius: 10px; background-color: #f2dede;">
                            <div style="font-size: 4em; margin-bottom: 20px; color: #d9534f;">⚠️</div>
                            <h3>Error en la Previsualización</h3>
                            <p>No se pudo convertir el archivo <strong>${fileName}</strong>.</p>
                            <p style="font-size: 0.9em; color: #777;">Error: ${result.error}</p>
                            <div style="margin-top: 30px;">
                                <button class="btn btn-primary" onclick="window.currentResponsableSgComponent.openDocument('${escapedPath}')">Abrir con aplicación externa</button>
                                <button id="close-preview-btn" class="btn preview-close-btn">Volver</button>
                            </div>
                        </div>`;
                }
            // Manejar otros archivos no soportados
            } else {
                viewer.innerHTML = `
                    <div style="text-align: center; padding: 40px; border: 2px dashed #ccc; margin: 20px; border-radius: 10px; background-color: #f9f9f9;">
                        <div style="font-size: 4em; margin-bottom: 20px;">📄</div>
                        <h3>Previsualización no disponible</h3>
                        <p>El archivo: <strong>${fileName}</strong> no se puede mostrar directamente.</p>
                        <div style="margin-top: 30px;">
                            <button class="btn btn-primary" onclick="window.currentResponsableSgComponent.openDocument('${escapedPath}')">Abrir con aplicación externa</button>
                            <button id="close-preview-btn" class="btn preview-close-btn">Volver</button>
                        </div>
                    </div>`;
            }
            
            const closeButton = document.getElementById('close-preview-btn');
            if (closeButton) {
                closeButton.addEventListener('click', this.closePreview);
            }

        } catch (error) {
            console.error('Error al previsualizar el documento:', error);
            viewer.innerHTML = `<p>Ocurrió un error al previsualizar el documento: ${error.message}</p>`;
        }
    }
    
    closePreview() {
        if (this.onBackToModuleHome) {
            this.onBackToModuleHome();
        }
    }
}

window.ResponsableSgComponent = ResponsableSgComponent;