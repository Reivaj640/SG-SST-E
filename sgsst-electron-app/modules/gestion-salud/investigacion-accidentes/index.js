// modules/gestion-salud/investigacion-accidentes/index.js

const InvestigacionAccidentesLogic = require('./investigacion-accidentes-logic');
const InvestigacionAccidenteLogic = require('./investigacion-accidente-logic');
const InvestigacionesViewer = require('./investigaciones-viewer');
const InvestigacionHandlers = require('./investigacion_handlers');

module.exports = {
    InvestigacionAccidentesLogic,
    InvestigacionAccidenteLogic,
    InvestigacionesViewer,
    InvestigacionHandlers
};