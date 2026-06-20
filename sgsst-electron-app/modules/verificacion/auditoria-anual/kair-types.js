/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Types (JSDoc typedefs)
   v3.0 · 2026-06-19

   En vanilla JS no necesitamos TypeScript, pero conservamos los tipos
   como JSDoc para IntelliSense en el editor y validación con @ts-check.

   @typedef {import('./kair-types.js').Audit} Audit
   @typedef {import('./kair-types.js').Hallazgo} Hallazgo
   @typedef {import('./kair-types.js').PlanAccionItem} PlanAccionItem
   ═══════════════════════════════════════════════════════════════════ */

/**
 * @typedef {'programada'|'en_curso'|'realizada'|'vencida'|'cancelada'} AuditStatus
 * @typedef {'interna'|'externa'|'seguimiento'} AuditType
 * @typedef {'documental'|'campo'|'documental_campo'} VerificationType
 * @typedef {'pendiente'|'realizado'|'no_realizado'} ProcesoAuditStatus
 * @typedef {'preparacion'|'realizacion'|'plan_accion'|'implementacion'} CronogramaFase
 * @typedef {'pendiente'|'en_curso'|'completado'|'vencido'} CronogramaItemStatus
 * @typedef {'C'|'NC'|'PC'} IndicadorCumplimiento
 * @typedef {'NC'|'OM'|'OE'} HallazgoTipo
 * @typedef {'baja'|'media'|'alta'|'critica'} HallazgoCriticidad
 * @typedef {'abierta'|'en_tratamiento'|'verificada'|'cerrada'|'vencida'} HallazgoEstado
 * @typedef {'pendiente'|'en_progreso'|'verificada'|'cerrada'} PlanAccionEstado
 * @typedef {'auditor'|'responsable_sgsst'|'gerente'} FirmaRol
 *
 * @typedef {Object} AuditProceso
 * @property {string} id
 * @property {string} proceso
 * @property {string} auditado
 * @property {string} auditor
 * @property {string} requisitos
 * @property {string} hora
 * @property {string} fecha
 * @property {ProcesoAuditStatus} estado
 * @property {string} [observaciones]
 *
 * @typedef {Object} CronogramaItem
 * @property {string} id
 * @property {string} auditId
 * @property {CronogramaFase} fase
 * @property {number} mes
 * @property {number} anio
 * @property {CronogramaItemStatus} estado
 * @property {string} [fechaProgramada]
 * @property {string} [observaciones]
 *
 * @typedef {Object} Entrevistado
 * @property {string} id
 * @property {string} nombre
 * @property {string} cargo
 * @property {string} fecha
 * @property {string} [tema]
 *
 * @typedef {Object} DesempenoEtapa
 * @property {string} codigo
 * @property {string} nombre
 * @property {number} resultado
 *
 * @typedef {Object} DesempenoComponente
 * @property {string} codigo
 * @property {string} nombre
 * @property {number} resultado
 * @property {string} etapaPadre
 *
 * @typedef {Object} IndicadorSgsst
 * @property {'Estructura'|'Proceso'|'Resultado'} tipo
 * @property {IndicadorCumplimiento} cumplimiento
 *
 * @typedef {Object} Hallazgo
 * @property {string} id
 * @property {string} auditId
 * @property {string} componente
 * @property {HallazgoTipo} tipo
 * @property {HallazgoCriticidad} criticidad
 * @property {string} descripcion
 * @property {string} [evidencia]
 * @property {string} fechaDeteccion
 * @property {HallazgoEstado} estado
 * @property {string} [fechaCompromisoCierre]
 * @property {string} [fechaCierreReal]
 *
 * @typedef {Object} PlanAccionItem
 * @property {string} id
 * @property {string} hallazgoId
 * @property {string} auditId
 * @property {string} accion
 * @property {string} responsable
 * @property {string} fechaCompromiso
 * @property {string} [fechaRealizacion]
 * @property {PlanAccionEstado} estado
 * @property {string} [evidencia]
 * @property {string} [verificadoPor]
 *
 * @typedef {Object} Firma
 * @property {string} id
 * @property {string} auditId
 * @property {string} nombre
 * @property {string} cargo
 * @property {FirmaRol} rol
 * @property {string} fecha
 * @property {boolean} firmado
 *
 * @typedef {Object} Audit
 * @property {string} id
 * @property {string} code
 * @property {number} year
 * @property {string} process
 * @property {AuditType} auditType
 * @property {AuditStatus} status
 *
 * @property {string} empresa
 * @property {string} nit
 * @property {string} actividadEconomica
 * @property {string} direccion
 * @property {string} ciudad
 * @property {string} telefono
 * @property {number} numEmpleados
 * @property {string} gerente
 * @property {string} encargadoSgsst
 * @property {string} encargadoSgsstEmail
 *
 * @property {string} auditorLider
 * @property {string[]} auditores
 * @property {string[]} auditados
 *
 * @property {string} objective
 * @property {string} alcance
 * @property {string} criterio
 * @property {string} metodologia
 * @property {string} participacionCopasst
 * @property {AuditProceso[]} procesos
 *
 * @property {CronogramaItem[]} cronograma
 *
 * @property {VerificationType} tipoVerificacion
 * @property {string} fechaProgramada
 * @property {string} [fechaVisitaDocumental]
 * @property {string} [fechaVisitaCampo]
 * @property {string} [fechaEntrega]
 * @property {Entrevistado[]} entrevistados
 * @property {string} [actividadesDesarrolladas]
 *
 * @property {DesempenoEtapa[]} desempenoEtapas
 * @property {DesempenoComponente[]} desempenoComponentes
 * @property {IndicadorSgsst[]} indicadoresSgsst
 * @property {number} [implementacionGlobal]
 *
 * @property {Object} [atel]
 * @property {number} atel.promedioTrabajadores
 * @property {number} atel.horasHombre
 * @property {number} atel.fatalidadesAT
 * @property {number} atel.atConTiempoPerdido
 * @property {number} atel.atSinTiempoPerdido
 * @property {number} atel.diasPerdidosAT
 * @property {number} atel.casiAccidentes
 * @property {number} atel.fatalidadesEP
 * @property {number} atel.epConTiempoPerdido
 * @property {number} atel.epSinTiempoPerdido
 * @property {number} atel.diasPerdidosEP
 *
 * @property {Hallazgo[]} hallazgos
 * @property {PlanAccionItem[]} planAccion
 *
 * @property {string[]} [aspectosRelevantes]
 * @property {string[]} [fortalezas]
 * @property {Object[]} [conclusiones]
 *
 * @property {Firma[]} firmas
 *
 * @property {string} createdAt
 * @property {string} updatedAt
 *
 * @typedef {Object} KairResponse
 * @template T
 * @property {boolean} success
 * @property {T} [data]
 * @property {{code: string, message: string}} [error]
 *
 * @typedef {'hub'|'list'|'editor'|'hallazgos'|'cronograma'|'informes'} ViewName
 *
 * @typedef {Object} ViewState
 * @property {ViewName} view
 * @property {string} [auditId]
 * @property {string} [tab]
 */

// Constantes exportadas (no tipos, sí runtime)
window.KairTypes = {
  AuditStatusValues: ['programada', 'en_curso', 'realizada', 'vencida', 'cancelada'],
  AuditTypeValues: ['interna', 'externa', 'seguimiento'],
  VerificationTypeValues: ['documental', 'campo', 'documental_campo'],
  ProcesoAuditStatusValues: ['pendiente', 'realizado', 'no_realizado'],
  CronogramaFaseValues: ['preparacion', 'realizacion', 'plan_accion', 'implementacion'],
  CronogramaItemStatusValues: ['pendiente', 'en_curso', 'completado', 'vencido'],
  HallazgoTipoValues: ['NC', 'OM', 'OE'],
  HallazgoCriticidadValues: ['baja', 'media', 'alta', 'critica'],
  HallazgoEstadoValues: ['abierta', 'en_tratamiento', 'verificada', 'cerrada', 'vencida'],
  PlanAccionEstadoValues: ['pendiente', 'en_progreso', 'verificada', 'cerrada'],
  FirmaRolValues: ['auditor', 'responsable_sgsst', 'gerente'],
  ViewNameValues: ['hub', 'list', 'editor', 'hallazgos', 'cronograma', 'informes']
};
