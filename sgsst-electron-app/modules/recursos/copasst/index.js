/**
 * Submódulo Copasst
 * 
 * Este archivo exporta las funcionalidades del submódulo Copasst
 */

// Importar los componentes reales
const copasstLogic = require('./copasst-logic');
const copasstViewer = require('./copasst-viewer');

module.exports = {
  logic: copasstLogic,
  viewer: copasstViewer,
  render: (container, context) => {
    // Método para renderizar el submódulo
    if (copasstViewer && typeof copasstViewer.render === 'function') {
      copasstViewer.render(container, context);
    } else {
      console.error('El viewer del submódulo copasst no tiene un método render');
    }
  }
};