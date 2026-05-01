/**
 * Submódulo Metodología IPEVR
 *
 * Este archivo exporta las funcionalidades del submódulo 4.1.1 Metodología IPEVR
 */

// Importar los componentes reales
const metodologiaIpevrLogic = require('./metodologia-ipevr-logic');
const metodologiaIpevrViewer = require('./metodologia-ipevr-viewer');

module.exports = {
 logic: metodologiaIpevrLogic,
 viewer: metodologiaIpevrViewer,
 render: (container, context) => {
 if (metodologiaIpevrViewer && typeof metodologiaIpevrViewer.render === 'function') {
 metodologiaIpevrViewer.render(container, context);
 } else {
 console.error('El viewer del submódulo metodologia-ipevr no tiene un método render');
 }
 }
};
