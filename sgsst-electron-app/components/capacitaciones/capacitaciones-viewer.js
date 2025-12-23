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