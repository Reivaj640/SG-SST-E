// modules/recursos/capacitaciones/index.js

const CapacitacionesLogic = require('./capacitaciones');
const CapacitacionesViewer = require('./capacitaciones-viewer');
const CapacitacionesPortalComponent = require('./capacitaciones-portal-logic').CapacitacionesPortalComponent;

module.exports = {
    CapacitacionesLogic,
    CapacitacionesViewer,
    CapacitacionesPortalComponent
};