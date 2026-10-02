/**
 * Módulo Gestión Integral - Punto de entrada
 *
 * Este archivo exporta todos los submódulos del módulo Gestión Integral
 * para facilitar la importación centralizada.
 */

const planTrabajo = require('./plan-trabajo');
const politica = require('./politica');
const rendicionCuentas = require('./rendicion-cuentas');
const objetivosSST = require('./objetivos-sst');
const evaluacionInicialSgSst = require('./evaluacion-inicial-sg-sst');
const gestionDelCambio = require('./gestion-del-cambio');
// 📦828-T0 — Estas tres carpetas YA existian y ya tenian dispatch en el dashboard,
// pero el index no las exportaba: el punto de entrada del modulo moria antes de
// ellas. Agregadas para que las 9 carpetas queden parecidas.
const archivoRetencion = require('./archivo-retencion');
const evaluacionProveedores = require('./evaluacion-proveedores');
const evaluacionSeleccion = require('./evaluacion-seleccion');

module.exports = {
  planTrabajo,
  politica,
  rendicionCuentas,
  objetivosSST,
  evaluacionInicialSgSst,
  gestionDelCambio,
  archivoRetencion,
  evaluacionProveedores,
  evaluacionSeleccion
};