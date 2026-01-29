/**
 * Módulo Gestión Integral - Punto de entrada
 *
 * Este archivo exporta todos los submódulos del módulo Gestión Integral
 * para facilitar la importación centralizada.
 */

const planTrabajo = require('./plan-trabajo');
const politica = require('./politica');
const rendicionCuentas = require('./rendicion-cuentas');

module.exports = {
  planTrabajo,
  politica,
  rendicionCuentas
};