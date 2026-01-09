/**
 * Submódulo Política
 * 
 * Este archivo exporta las funcionalidades del submódulo Política
 */

// Importar los componentes reales
const politicaLogic = require('./politica-logic');
const politicaViewer = require('./politica-viewer');

module.exports = {
  logic: politicaLogic,
  viewer: politicaViewer,
  render: (container, context) => {
    // Método para renderizar el submódulo
    if (politicaViewer && typeof politicaViewer.render === 'function') {
      politicaViewer.render(container, context);
    } else {
      console.error('El viewer del submódulo politica no tiene un método render');
    }
  }
};