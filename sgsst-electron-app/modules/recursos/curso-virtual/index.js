/**
 * Submódulo Curso Virtual
 * 
 * Este archivo exporta las funcionalidades del submódulo Curso Virtual
 */

// Importar los componentes reales
const cursoVirtualLogic = require('./curso-virtual-logic');
const cursoVirtualViewer = require('./curso-virtual-viewer');

module.exports = {
  logic: cursoVirtualLogic,
  viewer: cursoVirtualViewer,
  render: (container, context) => {
    // Método para renderizar el submódulo
    if (cursoVirtualViewer && typeof cursoVirtualViewer.render === 'function') {
      cursoVirtualViewer.render(container, context);
    } else {
      console.error('El viewer del submódulo curso-virtual no tiene un método render');
    }
  }
};