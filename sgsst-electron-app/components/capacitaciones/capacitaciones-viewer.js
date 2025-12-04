// capacitaciones-viewer.js - Viewer para el submódulo "1.2.1. Programa de Capacitación Anual"

class CapacitacionesViewer {
    constructor(container, currentCompany, moduleName, submoduleName, onBack) {
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBack = onBack;
        this.component = null;
    }

    render() {
        // Eliminar clases previas que podrían causar conflictos
        this.container.className = '';
        this.container.classList.add('submodule-content');
        this.container.classList.add('capacitaciones-viewer');

        // Crear el contenedor principal
        const contentDiv = document.createElement('div');
        contentDiv.style.cssText = `
            height: 100%;
            width: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;

        // Crear el encabezado del submódulo
        const headerDiv = document.createElement('div');
        headerDiv.className = 'submodule-header';
        headerDiv.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            background-color: white;
            padding: 15px 20px;
            border: 1px solid #dee2e6;
            border-radius: 0.375rem;
            box-shadow: 0 0.125rem 0.25rem rgba(0,0,0,0.075);
            min-height: 80px;
        `;

        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = `
            flex-grow: 1;
            text-align: center;
        `;

        const title = document.createElement('h2');
        title.textContent = this.submoduleName;
        title.style.cssText = `
            margin: 0;
            color: #212529;
            font-size: 1.5rem;
        `;

        titleDiv.appendChild(title);
        headerDiv.appendChild(titleDiv);

        // Botón de volver
        if (this.onBack && typeof this.onBack === 'function') {
            const backButton = document.createElement('button');
            backButton.className = 'btn btn-back';
            backButton.textContent = '← Volver';
            backButton.style.cssText = `
                background-color: #f8f9fa;
                border: 1px solid #dee2e6;
                color: #212529;
                font-size: 1rem;
                padding: 0.5rem 1rem;
                cursor: pointer;
                transition: all 0.15s ease-in-out;
                border-radius: 0.375rem;
            `;
            backButton.addEventListener('click', this.onBack);
            headerDiv.appendChild(backButton);
        }

        contentDiv.appendChild(headerDiv);

        // Crear el contenedor para el componente
        const componentContainer = document.createElement('div');
        componentContainer.style.cssText = `
            flex: 1;
            overflow: hidden;
            min-height: 0;
        `;

        contentDiv.appendChild(componentContainer);

        // Agregar contenido al contenedor
        this.container.appendChild(contentDiv);

        // Inicializar el componente de capacitaciones
        this.component = new window.CapacitacionesComponent(
            componentContainer,
            this.currentCompany,
            this.moduleName,
            this.submoduleName,
            this.onBack
        );
        
        // Renderizar el componente
        this.component.render();
    }

    destroy() {
        if (this.component && typeof this.component.destroy === 'function') {
            this.component.destroy();
        }
        this.container.innerHTML = '';
    }
}

window.CapacitacionesViewer = CapacitacionesViewer;