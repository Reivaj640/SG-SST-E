/**
 * Submódulo Comité de Convivencia
 * 
 * Este archivo exporta las funcionalidades del submódulo Comité de Convivencia
 */

// Importar los componentes reales
const comiteConvivenciaLogic = require('./comite-convivencia-logic');
const comiteConvivenciaViewer = require('./comite-convivencia-viewer');

module.exports = {
  logic: comiteConvivenciaLogic,
  viewer: comiteConvivenciaViewer,
  render: (container, context) => {
    // Método para renderizar el submódulo
    if (comiteConvivenciaViewer && typeof comiteConvivenciaViewer.render === 'function') {
      comiteConvivenciaViewer.render(container, context);
    } else {
      console.error('El viewer del submódulo comite-convivencia no tiene un método render');
    }
  }
};