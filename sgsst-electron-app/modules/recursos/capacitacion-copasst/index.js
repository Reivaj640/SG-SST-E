/**
 * Submódulo Capacitación COPASST
 * 
 * Este archivo exporta las funcionalidades del submódulo Capacitación COPASST
 */

// Importar los componentes reales
const capacitacionCopasstLogic = require('./capacitacion-copasst-logic');
const capacitacionCopasstViewer = require('./capacitacion-copasst-viewer');

module.exports = {
  logic: capacitacionCopasstLogic,
  viewer: capacitacionCopasstViewer,
  render: (container, context) => {
    // Método para renderizar el submódulo
    if (capacitacionCopasstViewer && typeof capacitacionCopasstViewer.render === 'function') {
      capacitacionCopasstViewer.render(container, context);
    } else {
      console.error('El viewer del submódulo capacitacion-copasst no tiene un método render');
    }
  }
};