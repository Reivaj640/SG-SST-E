/**
 * Submódulo Gestión del Cambio (2.11.1)
 *
 * Punto de entrada del módulo — exporta los componentes
 * para facilitar la integración con renderer.js
 */

const gestionCambioViewer = require('./gestion-cambio-viewer');

module.exports = {
  viewer: gestionCambioViewer,
  render: (container, context) => {
    if (gestionCambioViewer && typeof gestionCambioViewer.render === 'function') {
      gestionCambioViewer.render(container, context);
    } else {
      console.error('El viewer del submódulo gestion-del-cambio no tiene un método render');
    }
  }
};
