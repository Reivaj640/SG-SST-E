/* ============================================================================
   K+AIR — Gestión del Cambio (2.11.1)
   gestion-cambio-viewer.js

   Viewer wrapper — compatible con el patrón de componentes existente.
   Carga el script de lógica y delega la renderización.
   ============================================================================ */

class GestionDelCambioViewer {
  constructor(container, companyName, moduleName, submoduleName, onBackToModule) {
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.submoduleName = submoduleName;
    this.onBackToModule = onBackToModule;
    this.component = null;
  }

  async render() {
    try {
      // Cargar la lógica del componente si no está cargada
      if (!window.GestionDelCambioComponent) {
        await this.#loadLogicScript();
      }

      // Crear instancia del componente
      this.component = new window.GestionDelCambioComponent(
        this.container,
        this.companyName,
        this.moduleName,
        this.submoduleName,
        this.onBackToModule
      );

      await this.component.render();
    } catch (err) {
      console.error('[GestionDelCambioViewer] Error al renderizar:', err);
      this.container.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #dc3545;">
          <h3>Error al cargar Gestión del Cambio</h3>
          <p>${err.message}</p>
        </div>`;
    }
  }

  destroy() {
    if (this.component && typeof this.component.destroy === 'function') {
      this.component.destroy();
    }
    this.component = null;
  }

  async #loadLogicScript() {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="gestion-cambio-logic"]')) {
        // Ya está cargado, esperar un tick
        setTimeout(resolve, 50);
        return;
      }

      const script = document.createElement('script');
      script.src = 'modules/gestion-integral/gestion-del-cambio/gestion-cambio-logic.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('No se pudo cargar gestion-cambio-logic.js'));
      document.head.appendChild(script);
    });
  }
}

window.GestionDelCambioViewer = GestionDelCambioViewer;

console.log('[GestionDelCambioViewer] ✅ Registrado en window.GestionDelCambioViewer');
