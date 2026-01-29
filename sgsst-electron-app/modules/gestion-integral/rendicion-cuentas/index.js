/**
 * Submódulo Rendición de Cuentas
 *
 * Este archivo exporta las funcionalidades del submódulo de Rendición de Cuentas
 */

// Importar los componentes reales
const rendicionLogic = require('./rendicion-logic');
const rendicionViewer = require('./rendicion-viewer');

// Asegurar que el componente esté disponible globalmente
const RendicionCuentasComponent = require('./rendicion-logic').RendicionCuentasComponent;

module.exports = {
  logic: rendicionLogic,
  viewer: rendicionViewer,
  component: RendicionCuentasComponent,
  render: (container, context) => {
    // Método para renderizar el submódulo
    if (rendicionViewer && typeof rendicionViewer.render === 'function') {
      rendicionViewer.render(container, context);
    } else {
      console.error('El viewer del submódulo rendicion-cuentas no tiene un método render');
    }
  }
};