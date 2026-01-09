/**
 * Submódulo Roles y Responsabilidades
 * 
 * Este archivo exporta las funcionalidades del submódulo Roles y Responsabilidades
 */

// Importar los componentes reales
const rolesResponsabilidadesLogic = require('./roles-responsabilidades-logic');
const rolesResponsabilidadesViewer = require('./roles-responsabilidades-viewer');

module.exports = {
  logic: rolesResponsabilidadesLogic,
  viewer: rolesResponsabilidadesViewer,
  render: (container, context) => {
    // Método para renderizar el submódulo
    if (rolesResponsabilidadesViewer && typeof rolesResponsabilidadesViewer.render === 'function') {
      rolesResponsabilidadesViewer.render(container, context);
    } else {
      console.error('El viewer del submódulo roles-responsabilidades no tiene un método render');
    }
  }
};