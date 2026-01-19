/**
 * Submódulo Plan de Trabajo Anual
 *
 * Este archivo exporta las funcionalidades del submódulo Plan de Trabajo Anual
 */

// Importar los componentes reales
const planTrabajoLogic = require('./plan-trabajo-logic');
const planTrabajoViewer = require('./plan-viewer');

// Asegurar que el componente esté disponible globalmente
const PlanTrabajoComponent = require('./plan-trabajo-logic').PlanTrabajoComponent;

module.exports = {
  logic: planTrabajoLogic,
  viewer: planTrabajoViewer,
  component: PlanTrabajoComponent,
  render: (container, context) => {
    // Método para renderizar el submódulo
    if (planTrabajoViewer && typeof planTrabajoViewer.render === 'function') {
      planTrabajoViewer.render(container, context);
    } else {
      console.error('El viewer del submódulo plan-trabajo no tiene un método render');
    }
  }
};