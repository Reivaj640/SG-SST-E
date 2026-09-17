// modules/gestion-salud/index.js

const AusentismoModule = require('./ausentismo');
const EvaluacionesMedicasModule = require('./evaluaciones-medicas');
const ReportesAccidentesModule = require('./reportes-accidentes');
const InvestigacionAccidentesModule = require('./investigacion-accidentes');
const RestriccionesMedicasModule = require('./restricciones-medicas');
const SociodemograficaModule = require('./sociodemografica');
const PerfilesCargoProfesiogramaModule = require('./perfiles-cargo-profesiograma');

module.exports = {
    AusentismoModule,
    EvaluacionesMedicasModule,
    ReportesAccidentesModule,
    InvestigacionAccidentesModule,
    RestriccionesMedicasModule,
    SociodemograficaModule,
    PerfilesCargoProfesiogramaModule,
};