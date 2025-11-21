// reportes-accidentes.js - Componente para la vista de reportes de accidentes con visualizador

class ReportesAccidentesComponent {
    constructor(container, currentCompany, moduleName, submoduleName, backToModuleCallback) {
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.backToModuleCallback = backToModuleCallback;
    }

    render() {
        // Crear iframe para el visualizador
        const viewerFrame = document.createElement('iframe');
        viewerFrame.id = 'reportes-accidentes-viewer';
        viewerFrame.style.width = '100%';
        viewerFrame.style.height = '100vh';
        viewerFrame.style.border = 'none';
        viewerFrame.scrolling = 'no';

        // Construir la URL con parámetros
        const viewerUrl = `reportes-accidentes-viewer.html?company=${encodeURIComponent(this.currentCompany)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        viewerFrame.src = viewerUrl;

        this.container.appendChild(viewerFrame);

        // Establecer comunicación entre frames
        window.addEventListener('message', (event) => {
            if (event.data.type === 'back-to-module-request') {
                this.backToModuleCallback();
            }
        });
    }
}

window.ReportesAccidentesComponent = ReportesAccidentesComponent;
