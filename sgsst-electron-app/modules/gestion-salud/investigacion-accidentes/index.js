// modules/gestion-salud/investigacion-accidentes/index.js

const InvestigacionAccidentesLogic = require('./investigacion-accidentes-logic');
const InvestigacionesViewer = require('./investigaciones-viewer');
const InvestigacionHandlers = require('./investigacion_handlers');

module.exports = {
    InvestigacionAccidentesLogic,
    InvestigacionesViewer,
    InvestigacionHandlers,
    // Funciones de inicialización del servidor LLM
    initializeLlmServer: InvestigacionHandlers.initializeLlmServer,
    checkLlmServerHealth: InvestigacionHandlers.checkLlmServerHealth
};