/**
 * Submódulo Ver Ausentismo
 * 
 * Este archivo exporta las funcionalidades del submódulo Ver Ausentismo
 */

// Importar los componentes reales
const verAusentismoLogic = require('./ver-ausentismo-logic');

module.exports = {
  logic: verAusentismoLogic,
  render: (container, context) => {
    // Método para renderizar el submódulo
    if (verAusentismoLogic && typeof verAusentismoLogic.render === 'function') {
      verAusentismoLogic.render(container, context);
    } else {
      console.error('El componente del submódulo ver-ausentismo no tiene un método render');
    }
  }
};