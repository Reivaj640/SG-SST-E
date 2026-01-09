/**
 * Submódulo Presupuesto
 * 
 * Este archivo exporta las funcionalidades del submódulo Presupuesto
 */

// Importar los componentes reales
const presupuestoLogic = require('./presupuesto-logic');

module.exports = {
  logic: presupuestoLogic,
  render: (container, context) => {
    // Método para renderizar el submódulo
    if (presupuestoLogic && typeof presupuestoLogic.render === 'function') {
      presupuestoLogic.render(container, context);
    } else {
      console.error('El componente del submódulo presupuesto no tiene un método render');
    }
  }
};