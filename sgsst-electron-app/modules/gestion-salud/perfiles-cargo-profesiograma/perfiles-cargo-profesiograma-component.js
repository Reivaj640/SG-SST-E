// perfiles-cargo-profesiograma-component.js
// Componente para el submódulo "3.1.3 Perfiles de Cargo y Profesiograma"
//
// Carga un iframe con la UI completa del profesiograma (home + 5 sub-vistas).
// Mantiene el patrón usado por `restricciones-medicas-component.js`.

class PerfilesCargoProfesiogramaComponent {
    constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
        this.container = container;
        this.companyName = companyName;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBackToModuleHome = onBackToModuleHome;
        this.handleIframeMessage = this.handleIframeMessage.bind(this);
    }

    render() {
        this.container.innerHTML = ''; // Limpiar el contenedor
        window.addEventListener('message', this.handleIframeMessage);

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';

        // Pasar parámetros a la nueva interfaz a través de la URL
        const viewerUrl = `modules/gestion-salud/perfiles-cargo-profesiograma/perfiles-cargo-profesiograma-viewer.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        iframe.src = viewerUrl;

        this.container.appendChild(iframe);
    }

    handleIframeMessage(event) {
        if (!event.data || !event.data.action) {
            return; // Ignorar mensajes sin acción definida
        }

        switch (event.data.action) {
            case 'backToModule':
                if (this.onBackToModuleHome) {
                    this.onBackToModuleHome();
                }
                break;
            default:
                // Otros mensajes específicos del viewer se manejan allí directamente
                break;
        }
    }
}

// Exponer la clase al scope global
window.PerfilesCargoProfesiogramaComponent = PerfilesCargoProfesiogramaComponent;
