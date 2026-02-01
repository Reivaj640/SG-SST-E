/**
 * Submódulo Objetivos SST - Punto de entrada
 *
 * Este archivo exporta los componentes del submódulo Objetivos SST
 * para facilitar la importación centralizada.
 */

const objetivosSSTLogic = require('./objetivos-sst-logic');
const objetivosSSTViewer = require('./objetivos-sst-viewer');

module.exports = {
  objetivosSSTLogic,
  objetivosSSTViewer
};