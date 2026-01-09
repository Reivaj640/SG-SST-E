/**
 * Submódulo Responsable del SG-SST
 *
 * Este archivo exporta las funcionalidades del submódulo Responsable del SG-SST
 */

// Importar los componentes reales
const responsableSgLogic = require('./responsable-sg-logic');
const responsableSgViewer = require('./responsable-sg-viewer');

module.exports = {
  logic: responsableSgLogic,
  viewer: responsableSgViewer,
  render: (container, context) => {
    // Método para renderizar el submódulo
    if (responsableSgViewer && typeof responsableSgViewer.render === 'function') {
      responsableSgViewer.render(container, context);
    } else {
      console.error('El viewer del submódulo responsable-sg no tiene un método render');
    }
  }
};