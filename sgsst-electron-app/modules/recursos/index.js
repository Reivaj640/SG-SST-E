/**
 * Módulo Recursos - Punto de entrada
 * 
 * Este archivo exporta todos los submódulos del módulo Recursos
 * para facilitar la importación centralizada.
 */

const responsableSg = require('./responsable-sg');
const rolesResponsabilidades = require('./roles-responsabilidades');
const afiliacion = require('./afiliacion');
const copasst = require('./copasst');
const capacitacionCopasst = require('./capacitacion-copasst');
const comiteConvivencia = require('./comite-convivencia');

module.exports = {
  responsableSg,
  rolesResponsabilidades,
  afiliacion,
  copasst,
  capacitacionCopasst,
  comiteConvivencia
};