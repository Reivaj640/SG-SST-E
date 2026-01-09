/**
 * Submódulo Afiliación
 * 
 * Este archivo exporta las funcionalidades del submódulo Afiliación
 */

// Importar los componentes reales
const afiliacionLogic = require('./afiliacion-logic');
const afiliacionViewer = require('./afiliacion-viewer');

module.exports = {
  logic: afiliacionLogic,
  viewer: afiliacionViewer,
  render: (container, context) => {
    // Método para renderizar el submódulo
    if (afiliacionViewer && typeof afiliacionViewer.render === 'function') {
      afiliacionViewer.render(container, context);
    } else {
      console.error('El viewer del submódulo afiliacion no tiene un método render');
    }
  }
};