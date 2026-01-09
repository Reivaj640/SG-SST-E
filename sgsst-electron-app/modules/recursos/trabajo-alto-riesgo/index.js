/**
 * Submódulo Trabajo en Alto Riesgo
 * 
 * Este archivo exporta las funcionalidades del submódulo Trabajo en Alto Riesgo
 */

// Importar los componentes reales
const trabajoAltoRiesgoLogic = require('./trabajo-alto-riesgo-logic');
const trabajoAltoRiesgoViewer = require('./trabajo-alto-riesgo-viewer');

module.exports = {
  logic: trabajoAltoRiesgoLogic,
  viewer: trabajoAltoRiesgoViewer,
  render: (container, context) => {
    // Método para renderizar el submódulo
    if (trabajoAltoRiesgoViewer && typeof trabajoAltoRiesgoViewer.render === 'function') {
      trabajoAltoRiesgoViewer.render(container, context);
    } else {
      console.error('El viewer del submódulo trabajo-alto-riesgo no tiene un método render');
    }
  }
};