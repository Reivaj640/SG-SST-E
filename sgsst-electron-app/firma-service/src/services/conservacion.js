/**
 * CONSERVACIÓN, DEBER LEGAL Y PURGA GOBERNADA
 * ============================================
 *
 * PARA QUÉ
 * --------
 * Los numerales 8.6 y 10.6 del Acuerdo de uso dicen, en dos palabras:
 *
 *   "Vencido ese plazo y sin que exista un deber legal o contractual de
 *    conservación, el dato se suprime."
 *
 * Eso son DOS condiciones, no una:
 *
 *   1. El plazo venció. Y el plazo NO lo fija K+AIR: lo declara la Empresa,
 *      que es la Responsable del tratamiento. K+AIR es el Encargado
 *      (numeral 10.1). El 8.6 dice expresamente que "este Acuerdo no fija un
 *      plazo propio porque la ley no lo fija".
 *   2. No existe un deber legal o contractual de conservación.
 *
 * Este módulo implementa las dos, y la vía por la que se materializa la
 * supresión: la ventana de purga de la migración 020.
 *
 * EL POR QUÉ DE LA VENTANA
 * -----------------------
 * El numeral 3.6(g) promete que "el registro de auditoría de los eventos del
 * proceso de firma no puede ser alterado ni eliminado una vez registrado". La
 * base de datos lo hace cumplir con triggers (migración 020). Sin una vía
 * legítima para suprimir, las dos promesas son incompatibles: o la base miente
 * sobre la inalterabilidad, o el deber de supresión nunca se cumple.
 *
 * La salida no es "aflojar el trigger". Es una ventana:
 *
 *   - Se abre con QUÉ actor, POR QUÉ y HASTA CUÁNDO. Se vence sola.
 *   - Dentro de la ventana se arma el LOTE de firmas habilitadas. Solo se
 *     pueden añadir firmas al lote con la ventana abierta.
 *   - Solo dentro de la ventana, y solo para el lote, el trigger permite
 *     tocar los eventos.
 *   - Todo queda en un log append-only: qué se abrió, qué lote se armó, qué
 *     se purgó y por qué.
 *
 * QUÉ HACE ESTE MÓDULO Y QUÉ NO
 * ------------------------------
 * Esto es la **PURGA DEL REGISTRO DE AUDITORÍA**, no la purga completa. La
 * capa de datos personales (correo, huellas, manifestación de voluntad, PDF
 * original, PDF firmado, constancia) es un paquete aparte —la 5B— y hasta
 * que exista, esta capa NO puede presentarse como cumplimiento del 8.6.
 *
 * En orden, la operación completa es:
 *
 *     1. chequeo de hold
 *     2. datos personales      <- 5B
 *     3. eventos de auditoría  <- lo que hace este módulo
 *     4. registro de purga     <- el recibo, una fila por firma
 *
 * Ejecutar solo el paso 3 deja el estado INVERSO al deseable: se destruye la
 * prueba y se conservan los datos que había que suprimir. Por eso el recibo
 * registra qué categorías se suprimieron, y por eso el script de purga lo
 * dice en voz alta.
 *
 * NADA SE PURGA SIN PLAZO DECLARADO
 * ---------------------------------
 * Si la Empresa no declara `plazo_retencion_dias`, la firma no tiene fecha de
 * conservación y NUNCA es elegible. El sistema no inventa plazos: el 8.6 dice
 * que el Acuerdo no los fija porque la ley no los fija. Pero la retención
 * indefinida tampoco es cumplimiento: por eso el reporte trata el "sin plazo
 * declarado" como una ALERTA, no como un no-op silencioso.
 */
'use strict';

const db = require('../db/connection');
const logger = require('../utils/logger');
const retencionService = require('./retencion');
// El 8.6(e)(iii): la supresión no procede con una solicitud de copia
// pendiente. La consulta vive en el módulo que es dueño de la tabla.
const { tieneCopiaPendiente, empresasConCopiaPendiente } = require('./solicitudes');

// Una ventana de purga dura, como máximo, este tiempo. Se vence sola: si
// el operador se cae a mitad del procedimiento, la ventana se cierra sin que
// nadie tenga que hacer nada.
const VENTANA_MAX_MINUTOS = 240; // 4 horas

// Cuántos días se mira hacia adelante en el reporte para saber qué está por
// vencer.
const DIAS_PRORRO = 30;

// Qué categorías de dato cubre esta capa de purga. Se escribe en el recibo
// de cada firma purgada, para que se sepa QUÉ se suprimió. La capa 5B
// (datos personales: fila, PDF, constancia) usará sus propias categorías.
const CATEGORIAS_AUDITORIA = 'eventos_auditoria';

// El 8.6(h) del Acuerdo v1.2: "Si la Empresa no declara un plazo para una
// categoría documental, el registro no se suprime: el sistema lo retiene con
// un hold por plazo no declarado, deja constancia del pendiente y lo reporta a
// la Empresa".
//
// Este hold es DISTINTO del hold por deber legal (migración 029): tiene su
// propio actor, su propio motivo y su propio alcance, para que el reporte
// dice POR QUÉ se retiene y para que la liberación por "la Empresa declaró el
// plazo" no levante un deber legal que sigue vigente.
const ACTOR_HOLD_PLAZO_NO_DECLARADO = 'sistema';
const MOTIVO_HOLD_PLAZO_NO_DECLARADO = 'plazo_no_declarado';
const ALCANCE_HOLD_PLAZO_NO_DECLARADO =
  '8.6(h): plazo de conservacion no declarado por la Empresa';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Calcula la fecha de conservación.
 *
 * @param {string} fecha_creacion - ISO
 * @param {number|null} dias - plazo declarado por la Empresa
 * @returns {string|null} ISO, o null si no hay plazo computable
 */
function calcularFechaConservacion(fecha_creacion, dias) {
  if (!fecha_creacion) return null;
  const d = Number(dias);
  if (!Number.isInteger(d) || d <= 0) return null;
  const base = new Date(fecha_creacion);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + d * MS_POR_DIA).toISOString();
}

/**
 * El plazo que la Empresa declaró, en días. Null si no declaró.
 * @param {string} id_empresa
 * @returns {number|null}
 */
function plazoDeclarado(id_empresa) {
  if (!id_empresa) return null;
  const row = db.prepare(
    'SELECT plazo_retencion_dias FROM gh_firma_empresas WHERE id_empresa = ?'
  ).get(id_empresa);
  if (!row) return null;
  const d = Number(row.plazo_retencion_dias);
  return Number.isInteger(d) && d > 0 ? d : null;
}

/**
 * El deber legal de conservación SIN TÉRMINO que la Empresa declaró
 * (migración 029).
 *
 * El artículo 2.2.1.1.12 del Decreto 1072 obliga a los empleadores a
 * conservar los contratos de trabajo firmados electrónicamente, sin plazo. La
 * decisión del owner (2026-10-20) es que esto se declara **a nivel de
 * Empresa**: es una cualidad de la relación laboral, no del archivo, y el
 * sistema no puede clasificar un PDF con acierto (el mismo argumento del
 * 10.8: no se lee el documento antes del consentimiento).
 *
 * @param {string} id_empresa
 * @returns {{activo: boolean, norma: string|null}}
 */
function deberLegalEmpresa(id_empresa) {
  if (!id_empresa) return { activo: false, norma: null };
  let row;
  try {
    row = db.prepare(
      'SELECT conservacion_por_deber_legal, norma_conservacion FROM gh_firma_empresas WHERE id_empresa = ?'
    ).get(id_empresa);
  } catch (e) {
    // La columna puede no existir todavía (migración 029 sin aplicar). Eso
    // no puede tumbar la creación de la firma: sin el flag, el
    // comportamiento es el de siempre.
    return { activo: false, norma: null };
  }
  if (!row) return { activo: false, norma: null };
  return {
    activo: Boolean(row.conservacion_por_deber_legal),
    norma: row.norma_conservacion || null,
  };
}

/**
 * La fila de la Empresa, en la forma que la necesita el plan de retención.
 *
 * Se lee con SQL directo y no con el servicio de empresas: los dos módulos se
 * necesitan mutuamente (empresa.update llama al recálculo, y el recálculo
 * necesita el plan) y un require de ida y vuelta en Node es un ciclo.
 *
 * @param {string} id_empresa
 * @returns {object}
 */
function _empresaParaPlan(id_empresa) {
  if (!id_empresa) return {};
  try {
    const row = db.prepare(
      'SELECT plazo_retencion, plazo_retencion_dias, conservacion_por_deber_legal, norma_conservacion'
      + ' FROM gh_firma_empresas WHERE id_empresa = ?'
    ).get(id_empresa);
    return row || {};
  } catch (e) {
    // La columna puede no existir todavía (migración 029 sin aplicar): sin el
    // flag, el comportamiento es el de siempre.
    return {};
  }
}

/**
 * El plan de retención de una firma que YA está en la base.
 *
 * Lee de la fila lo que el plan necesita (la categoría, la regla y la fecha
 * de terminación) y calcula con la MISMA función del catálogo que usa el
 * alta de la firma. Una sola fuente de verdad para el cálculo: si el alta y
 * el recálculo usaran reglas distintas, el registro cambiaría de fecha.
 *
 * @param {number} idFirma
 * @param {string} id_empresa
 * @param {string} [fecha_creacion] - la fecha de creación que conoce el
 *   llamador; si no viene, se usa la de la fila.
 * @returns {object} el plan de `retencion.planificar`
 */
function _planDeFirma(idFirma, id_empresa, fecha_creacion, tabla_conservacion) {
  let fila = null;
  try {
    fila = db.prepare(
      'SELECT id_empresa, fecha_creacion, categoria_retencion, regla_retencion, fecha_terminacion'
      + ' FROM gh_firmas_electronicas WHERE id = ?'
    ).get(idFirma);
  } catch (e) {
    fila = null;
  }
  return retencionService.planificar({
    categoria_retencion: fila ? fila.categoria_retencion : null,
    regla_retencion: fila ? fila.regla_retencion : null,
    fecha_creacion: fecha_creacion || (fila && fila.fecha_creacion) || null,
    fecha_terminacion: fila ? fila.fecha_terminacion : null,
    empresa: _empresaParaPlan(id_empresa || (fila && fila.id_empresa) || null),
    tabla_conservacion,
  });
}

/**
 * Escribe en la fila la TRAZABILIDAD de la regla que se aplicó (migración
 * 049): el plazo, su fuente y la fecha de inicio del cómputo.
 *
 * Con eso, el §4 se puede demostrar documento por documento: qué regla corrió
 * y de dónde salió el plazo.
 *
 * Si la migración 049 no está aplicada, la escritura falla y NO se propaga:
 * la fecha de conservación ya quedó escrita, y perder la trazabilidad es
 * malo, pero tumbar el alta de la firma es peor.
 *
 * @param {number} idFirma
 * @param {object} plan - resultado de `retencion.planificar`
 */
function _escribirTrazabilidad(idFirma, plan) {
  const oNull = (v) => (v === undefined || v === null ? null : v);
  try {
    db.prepare(`
      UPDATE gh_firmas_electronicas
         SET plazo_conservacion_dias = ?,
             plazo_conservacion_fuente = ?,
             fecha_inicio_conservacion = ?,
             categoria_conservacion = ?
       WHERE id = ?
    `).run(
      oNull(plan.plazo_conservacion_dias),
      oNull(plan.plazo_conservacion_fuente),
      oNull(plan.fecha_inicio_conservacion),
      oNull(plan.categoria_conservacion),
      idFirma
    );
  } catch (e) {
    logger.warn('Conservacion: no se pudo escribir la trazabilidad del plazo', {
      firma_id: idFirma,
      error: e.message,
      aviso: 'TRAZABILIDAD_NO_ESCRITA',
    });
  }
}

/**
 * Congela la fecha de conservación de una firma, en el momento en que se
 * crea. Se congela a propósito: el 8.6 habla del plazo "que le resulta
 * aplicable" al firmante cuando se le solicita la firma. Si la Empresa cambia
 * su política después, las firmas ya hechas no se mueven.
 *
 * CON DEBER LEGAL SIN TÉRMINO: no hay fecha de supresión (el plazo de la
 * tabla de retención no extingue un deber legal) y se levanta un HOLD
 * automático, gobernado por `gh_firma_holds`: se libera con actor y motivo
 * cuando la relación termina o el documento se sustituye.
 *
 * NO es "nunca se purga": es "nunca se purga SOLO". Esa es la diferencia entre
 * un deber legal y un accidente.
 *
 * LA TABLA SUPLETORIA
 * --------------------
 * Este es el camino de REFUERDO (lo usa signRequest cuando el plan del
 * catálogo no se pudo aplicar). Calcula con el MISMO plan del catálogo
 * (`retencion.planificar`), para que el camino normal y el de refuerzo den la
 * misma fecha: si se calcularan distinto, un fallo de la base movería el plazo
 * de un documento. Y con la tabla supletoria de conservación, el plan SIEMPRE
 * trae fecha: la ausencia de un plazo de la Empresa ya no deja el registro
 * retenido por esa razón.
 *
 * @param {number} idFirma
 * @param {string} id_empresa
 * @param {string} fecha_creacion
 * @param {object} [opciones]
 * @param {object} [opciones.tabla_conservacion] - la tabla supletoria a usar,
 *   en vez de la del archivo. Es el punto de inyección que usan los tests.
 * @returns {string|null} la fecha calculada, o null si no hay plazo aplicable
 */
function asignarFechaConservacion(idFirma, id_empresa, fecha_creacion, opciones = {}) {
  const deber = deberLegalEmpresa(id_empresa);
  if (deber.activo) {
    const norma = deber.norma || '2.2.1.1.12 del Decreto 1072 de 2015';
    ponerHold(idFirma, {
      actor: 'sistema',
      motivo: 'deber_legal_' + norma,
      alcance: norma,
    });
    logger.warn('SignRequest: la Empresa tiene deber legal de conservacion sin termino', {
      firma_id: idFirma,
      id_empresa,
      norma,
      aviso: 'RETAIN_DEBER_LEGAL',
    });
    return null;
  }
  const plan = _planDeFirma(idFirma, id_empresa, fecha_creacion, opciones.tabla_conservacion);
  if (!plan.fecha_conservacion) {
    // Ni la Empresa ni la tabla supletoria pudieron dar un plazo. No se
    // inventa nada: la firma queda sin fecha (nunca se suprime) y el aviso
    // RETAIN_SIN_PLAZO queda en el log.
    logger.warn('Conservacion: la firma queda sin fecha de conservacion', {
      firma_id: idFirma,
      id_empresa,
      aviso: 'RETAIN_SIN_PLAZO',
    });
    return null;
  }
  db.prepare(
    'UPDATE gh_firmas_electronicas SET fecha_conservacion = ? WHERE id = ?'
  ).run(plan.fecha_conservacion, idFirma);
  _escribirTrazabilidad(idFirma, plan);
  return plan.fecha_conservacion;
}

/**
 * Aplica el plan del catálogo por documento a una fila ya insertada.
 *
 * El plan trae la fecha calculada, la trazabilidad de la regla que se aplicó
 * (migración 049) y, si el documento no tiene término (el contrato
 * electrónico) o la Empresa declaró un deber legal sin término, el hold
 * automático.
 *
 * UN PLAN SIN FECHA
 * -----------------
 * Con la tabla supletoria de conservación, el plan SIEMPRE trae fecha o hold:
 * la ausencia de un plazo de la Empresa ya no es una razón para retener. Este
 * camino sin fecha es la última defensa (una tabla sin plazo computable) y
 * deja la firma sin fecha de supresión: sin fecha, no hay purga, y el
 * registro aparece en el reporte de pendientes.
 *
 * @param {number} idFirma
 * @param {object} plan - resultado de retencion.planificar()
 * @returns {string|null} la fecha aplicada
 */
function aplicarPlanRetencion(idFirma, plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('aplicarPlanRetencion necesita un plan de retención.');
  }

  db.prepare(
    'UPDATE gh_firmas_electronicas SET fecha_conservacion = ? WHERE id = ?'
  ).run(plan.fecha_conservacion || null, idFirma);

  // 049 · la trazabilidad de la regla aplicada: el plazo, su fuente y la
  // fecha de inicio del cómputo quedan congelados en la fila.
  _escribirTrazabilidad(idFirma, plan);

  if (plan.hold) {
    ponerHold(idFirma, plan.hold);
  } else if (!plan.fecha_conservacion) {
    // Última defensa: un plan sin fecha no deja la firma retenida con un
    // motivo inventado, pero tampoco suprimible. Queda sin fecha (nunca se
    // suprime) y se reporta como pendiente.
    logger.warn('Conservacion: la firma queda sin fecha de conservacion', {
      firma_id: idFirma,
      regla: plan.regla,
      categoria: plan.categoria,
      aviso: plan.aviso,
    });
  }

  if (plan.aviso === 'RETAIN_PENDIENTE_CESE' || plan.aviso === 'RETAIN_PENDIENTE_RETIRO') {
    logger.warn('SignRequest: retención pendiente de fecha de terminación', {
      firma_id: idFirma,
      regla: plan.regla,
      aviso: plan.aviso,
      categoria: plan.categoria,
    });
  }

  return plan.fecha_conservacion || null;
}

/**
 * Declara un deber legal o contractual de conservación.
 *
 * El 8.6 y el 10.6 dicen "sin que exista un deber legal o contractual de
 * conservación". Este es ese deber, y se declara con las cinco cosas que lo
 * hacen revisable: QUIÉN lo declara, POR QUÉ, sobre QUÉ (alcance: la
 * materia, el expediente, la autoridad), DESDE CUÁNDO, y —cuando se
 * levante— POR QUÉ y QUIÉN lo levantó.
 *
 * Con hold, la fila NUNCA es elegible para supresión. Y no es solo una regla
 * del código: el trigger de la migración 020 lee `hold_legal` y la base de
 * datos se niega a suprimir la firma aunque haya ventana y lote.
 *
 * @param {number} idFirma
 * @param {object} declaracion
 * @param {string} declaracion.actor - QUIÉN declara el hold
 * @param {string} declaracion.motivo - POR QUÉ (reclamación, proceso, requerimiento…)
 * @param {string} [declaracion.alcance] - sobre QUÉ: materia, expediente, autoridad
 * @returns {object} el hold declarado
 */
function ponerHold(idFirma, declaracion = {}) {
  const actor = String(declaracion.actor || '').trim();
  const motivo = String(declaracion.motivo || '').trim();
  const alcance = declaracion.alcance ? String(declaracion.alcance).trim() : null;
  if (!actor) throw new Error('El hold necesita un actor (quién lo declara).');
  if (!motivo) throw new Error('El hold necesita un motivo (por qué se declara).');

  const ahora = new Date().toISOString();
  db.prepare(`
    UPDATE gh_firmas_electronicas
       SET hold_legal = 1,
           motivo_hold = ?,
           hold_actor = ?,
           hold_alcance = ?,
           hold_fecha = ?,
           hold_liberado_at = NULL
     WHERE id = ?
  `).run(motivo, actor, alcance, ahora, idFirma);

  db.prepare(`
    INSERT INTO gh_firma_holds (firma_id, actor, motivo, alcance, declarado_at, activo)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(idFirma, actor, motivo, alcance, ahora);

  logger.info('Hold legal de conservación declarado', { firma_id: idFirma, actor });
  return { firma_id: idFirma, actor, motivo, alcance, declarado_at: ahora };
}

/**
 * Levanta el deber legal de conservación. La declaración original queda en el
 * historial: `gh_firma_holds` no se reescribe, se le agrega la liberación.
 *
 * @param {number} idFirma
 * @param {object} [liberacion]
 * @param {string} [liberacion.actor] - QUIÉN lo levanta
 * @param {string} [liberacion.motivo] - POR QUÉ se levanta
 */
function liberarHold(idFirma, liberacion = {}) {
  const actor = String(liberacion.actor || '').trim() || null;
  const motivo = liberacion.motivo ? String(liberacion.motivo).trim() : null;
  const ahora = new Date().toISOString();

  const vigente = db.prepare(
    'SELECT id FROM gh_firma_holds WHERE firma_id = ? AND activo = 1 ORDER BY id DESC LIMIT 1'
  ).get(idFirma);

  if (vigente) {
    db.prepare(`
      UPDATE gh_firma_holds
         SET activo = 0, liberado_at = ?, liberado_por = ?, motivo_liberacion = ?
       WHERE id = ?
    `).run(ahora, actor, motivo, vigente.id);
  }

  db.prepare(`
    UPDATE gh_firmas_electronicas
       SET hold_legal = 0,
           hold_liberado_at = ?
     WHERE id = ?
  `).run(ahora, idFirma);

  logger.info('Hold legal de conservación liberado', { firma_id: idFirma, actor });
  return { firma_id: idFirma, liberado_at: ahora, actor, motivo };
}

/**
 * Retiene una firma cuyo plazo de conservación NO declaró la Empresa.
 *
 * El 8.6(h) del Acuerdo v1.2: "Si la Empresa no declara un plazo para una
 * categoría documental, el registro no se suprime: el sistema lo retiene con un
 * hold por plazo no declarado, deja constancia del pendiente y lo reporta a la
 * Empresa, que debe declarar en su tabla de retención documental un plazo
 * concreto, con su fundamento y con el punto de inicio desde el que corre."
 *
 * DESPUÉS DE LA DECISIÓN D1: ESTA FUNCIÓN YA NO SE LLAMA EN EL ALTA
 * -------------------------------------------------------------------
 * Con la tabla supletoria de conservación, si la Empresa no declara un plazo
 * el sistema aplica el de la tabla: hay fecha, no hay retención, y el aviso
 * `RETAIN_SIN_PLAZO` es inalcanzable en el camino normal.
 *
 * La función se conserva porque en las bases YA HAY filas con ese hold (en
 * producción y en los tests) y tienen que poder salir: es la maquinaria de
 * puesta en regla, y se llama de forma EXPRESA (con actor y motivo), nunca
 * como efecto de crear una firma.
 *
 * El motivo y el alcance son PROPIOS de este hold: se distinguen del deber
 * legal (migración 029) porque la razón de retener es otra y porque la
 * liberación es otra. La liberación de este hold ocurre cuando se recalcula
 * el plazo aplicable; la del deber legal, cuando el deber termina.
 *
 * Es IDEMPOTENTE: si ya hay un hold vigente por plazo no declarado, no se
 * escribe una segunda fila en `gh_firma_holds`.
 *
 * @param {number} idFirma
 * @param {object} [declaracion]
 * @param {string} [declaracion.actor] - QUIÉN aplica la retención
 * @returns {{firma_id: number, actor: string, motivo: string, alcance: string, ya_retenida: boolean}}
 */
function retenerPorPlazoNoDeclarado(idFirma, declaracion = {}) {
  const actor = String(declaracion.actor || '').trim() || ACTOR_HOLD_PLAZO_NO_DECLARADO;
  const motivo = MOTIVO_HOLD_PLAZO_NO_DECLARADO;
  const alcance = ALCANCE_HOLD_PLAZO_NO_DECLARADO;

  const vigente = db.prepare(
    'SELECT id FROM gh_firma_holds WHERE firma_id = ? AND activo = 1 AND motivo = ? ORDER BY id DESC LIMIT 1'
  ).get(idFirma, motivo);
  if (vigente) {
    return { firma_id: idFirma, actor, motivo, alcance, ya_retenida: true };
  }

  const hold = ponerHold(idFirma, { actor, motivo, alcance });
  logger.warn('Hold por plazo no declarado declarado (8.6(h))', {
    firma_id: idFirma,
    actor,
    motivo,
  });
  return { ...hold, ya_retenida: false };
}

/**
 * Levanta el hold por PLAZO NO DECLARADO: la Empresa declaró el plazo y el
 * registro vuelve al circuito normal del 8.6.
 *
 * NO levanta un hold de otro motivo. Si el hold vigente es un deber legal, esta
 * función se niega: el deber legal no se levanta porque la Empresa haya
 * declarado un plazo, y un "liberar" genérico lo tumbaría por accidente.
 *
 * LA FECHA DE CONSERVACIÓN
 * -----------------------
 * Una firma retenida por plazo no declarado NO tiene fecha de conservación
 * (sin fecha no hay supresión, y sin supresión el 8.6 no se cumple). Por eso,
 * al levantar el hold, la fecha se calcula en la MISMA operación: el punto de
 * inicio declarado más el plazo declarado, si quien libera dice cuáles son.
 *
 * Si no los dice, la fecha sale del PLAN DEL CATÁLOGO: el plazo que declaró
 * la Empresa o, en su defecto, el de la tabla supletoria de conservación. Con
 * la tabla supletoria SIEMPRE hay un plazo, así que levantar este hold nunca
 * deja el registro sin fecha: quedaría retenido ya no, pero tampoco
 * suprimible, y sin registro de por qué.
 *
 * @param {number} idFirma
 * @param {object} [liberacion]
 * @param {string} [liberacion.actor] - QUIÉN lo levanta
 * @param {string} [liberacion.motivo] - POR QUÉ se levanta
 * @param {number} [liberacion.plazo_declarado_dias] - el plazo que declaró la Empresa
 * @param {string} [liberacion.punto_inicio] - el punto de inicio desde el que corre
 * @param {object} [liberacion.plan] - el plan ya calculado (el que hizo el
 *   recálculo); se usa tal cual para no calcular dos veces.
 * @returns {{firma_id: number, liberado: boolean, motivo: string|null, fecha_conservacion: string|null}}
 * @throws {Error} si el hold vigente no es por plazo no declarado.
 */
function liberarHoldPorPlazoNoDeclarado(idFirma, liberacion = {}) {
  const vigente = db.prepare(
    'SELECT id, motivo FROM gh_firma_holds WHERE firma_id = ? AND activo = 1 ORDER BY id DESC LIMIT 1'
  ).get(idFirma);

  if (!vigente) {
    return { firma_id: idFirma, liberado: false, motivo: null, fecha_conservacion: null };
  }
  if (vigente.motivo !== MOTIVO_HOLD_PLAZO_NO_DECLARADO) {
    throw new Error(
      'El hold vigente de esta firma no es por plazo no declarado: no se libera.'
    );
  }

  // La fecha de conservación: la que dice quien libera, o la que resulta del
  // plan del catálogo (el plazo de la Empresa o, en su defecto, el de la
  // tabla supletoria de conservación).
  const dias = Number(liberacion.plazo_declarado_dias);
  const puntoInicio = liberacion.punto_inicio ? String(liberacion.punto_inicio).trim() : '';
  let fechaConservacion = null;
  let plan = liberacion.plan || null;
  if (Number.isInteger(dias) && dias > 0 && puntoInicio) {
    const punto = new Date(puntoInicio);
    if (!Number.isNaN(punto.getTime())) {
      fechaConservacion = new Date(punto.getTime() + dias * MS_POR_DIA).toISOString();
    }
  } else {
    if (!plan) plan = _planDeFirma(idFirma, null);
    fechaConservacion = plan.fecha_conservacion || null;
  }

  const r = liberarHold(idFirma, liberacion);
  if (fechaConservacion) {
    db.prepare(
      'UPDATE gh_firmas_electronicas SET fecha_conservacion = ? WHERE id = ?'
    ).run(fechaConservacion, idFirma);
    if (plan) _escribirTrazabilidad(idFirma, plan);
  }
  logger.info('Hold por plazo no declarado liberado', {
    firma_id: idFirma,
    actor: liberacion.actor || null,
    fecha_conservacion: fechaConservacion,
  });
  return {
    ...r,
    liberado: true,
    motivo: vigente.motivo,
    fecha_conservacion: fechaConservacion,
  };
}

/**
 * EL REPORTE DEL PLAZO PENDIENTE (el 8.6(h)).
 *
 * El 8.6(h) no dice solo "no se suprime": dice que el sistema "deja constancia
 * del pendiente y lo reporta a la Empresa". Esto es ese reporte: la lista de
 * los registros que están retenidos porque la Empresa no declaró un plazo,
 * con el motivo y el alcance de la retención.
 *
 * DESPUÉS DE LA DECISIÓN D1
 * -------------------------
 * Con la tabla supletoria de conservación, el alta de una firma YA NO deja
 * registros en este estado: si la Empresa no declara un plazo, aplica el de la
 * tabla. Este reporte nombra, entonces, las filas que ya estaban en las bases
 * (con el hold viejo) y que siguen esperando un recálculo: son las que hay que
 * poner en regla, y el recálculo es una operación expresa, autorizada y
 * auditada.
 *
 * @param {object} [opts]
 * @param {string} [opts.id_empresa] - filtra por empresa
 * @returns {{total: number, pendientes: object[], mensaje: string}}
 */
function reportePlazoPendiente(opts = {}) {
  const grupos = vencimientos({ id_empresa: opts.id_empresa || null });
  const pendientes = grupos.sinPlazo.map((f) => ({
    id: f.id,
    id_solicitud: f.id_solicitud,
    id_empresa: f.id_empresa,
    fecha_creacion: f.fecha_creacion,
    retenida: Number(f.hold_legal) === 1,
    motivo_retencion: f.motivo_hold || MOTIVO_HOLD_PLAZO_NO_DECLARADO,
    alcance_retencion: f.hold_alcance || ALCANCE_HOLD_PLAZO_NO_DECLARADO,
    plazo_pendiente: 'plazo de conservacion no declarado por la Empresa',
  }));
  return {
    total: pendientes.length,
    pendientes,
    mensaje:
      'Registros retenidos por plazo de conservacion no declarado (8.6(h)): no se '
      + 'suprimen hasta que se recalculen con el plazo que resulta aplicable (el que '
      + 'declara la Empresa o, en su defecto, el de la tabla de conservacion del '
      + 'sistema). El recalculo es una operacion expresa, autorizada y auditada.',
  };
}

/**
 * Retiene TODOS los registros que hoy estan sin plazo declarado.
 *
 * Es la puesta en regla de lo que ya esta en la base: el 8.6(h) dice que un
 * registro sin plazo declarado QUEDA RETENIDO, no solo reportado. Se apoya en
 * el mismo mecanismo de reporte (`grupos.sinPlazo`) y es idempotente.
 *
 * @param {object} [opts]
 * @param {string} [opts.id_empresa] - filtra por empresa
 * @param {string} [opts.actor] - QUIÉN aplica la retención
 * @returns {{revisados: number, retenidas: number, ya_retenidas: number}}
 */
function retenerPendientesDePlazo(opts = {}) {
  const actor = String(opts.actor || '').trim() || ACTOR_HOLD_PLAZO_NO_DECLARADO;
  const grupos = vencimientos({ id_empresa: opts.id_empresa || null });
  let retenidas = 0;
  let yaRetenidas = 0;
  for (const f of grupos.sinPlazo) {
    const r = retenerPorPlazoNoDeclarado(f.id, { actor });
    if (r.ya_retenida) yaRetenidas += 1;
    else retenidas += 1;
  }
  return {
    revisados: grupos.sinPlazo.length,
    retenidas,
    ya_retenidas: yaRetenidas,
  };
}

/**
 * RECALCULA LOS PLAZOS CUANDO LA EMPRESA DECLARA EL SUYO (el 8.6(h)).
 *
 * El 8.6(h) del Acuerdo v1.2 no se queda en "no se suprime": termina diciendo
 * que "la retención por plazo no declarado cesa cuando la Empresa declara ese
 * plazo para la categoría, y desde entonces rigen las reglas generales de este
 * numeral". Sin esta pieza, declarar el plazo no cambiaría nada: los registros
 * quedarían retenidos para siempre.
 *
 * QUÉ HACE, PASO A PASO
 *   1. Toma las firmas de la Empresa SIN fecha de conservación que estén
 *      retenidas por plazo no declarado. Las de otro motivo (deber legal,
 *      contrato electrónico) NO se tocan: son otros holds, con otra vida.
 *   2. Las re-planifica con la MISMA función que usa el alta de la firma
 *      (`retencion.planificar`), ahora con el plazo ya declarado. Una sola
 *      fuente de verdad para el cálculo: si el alta y el recálculo usaran
 *      reglas distintas, el registro cambiaria de fecha al declarar el plazo.
 *   3. Si el plan trae fecha, la escribe (con su trazabilidad) y levanta el
 *      hold por plazo no declarado. Si NO trae fecha (el plazo no es
 *      computable para esa categoría), la firma sigue retenida y se sigue
 *      reportando.
 *
 * YA NO SE EXIGE QUE LA EMPRESA HAYA DECLARADO UN PLAZO
 * -------------------------------------------------------
 * Con la tabla supletoria de conservación, el plazo por defecto existe
 * siempre: si la Empresa no declaró uno, el que aplica es el de la tabla
 * (fuente 'tabla_supletoria'). Por eso el recálculo de las filas que
 * quedaron con el hold viejo ya no depende de que la Empresa declare:
 * depende de que alguien lo ORDENE, con actor y motivo. Ese es el motivo de
 * que la operación sea explícita, autorizada y auditada.
 *
 * LO QUE NO TOCA
 * --------------
 * Solo las filas SIN fecha de conservación y con el motivo de hold
 * 'plazo_no_declarado'. Las que ya tienen fecha son registros históricos ya
 * calculados: su plazo, su fuente y su fecha de inicio quedan CONGELADOS, y
 * cambiar la tabla supletoria o el plazo de la Empresa no los mueve. Un
 * recálculo es una operación aparte, con su actor y su motivo.
 *
 * NO INVENTA NADA: si el plazo no es computable para esa categoría, el
 * registro queda como estaba.
 *
 * @param {string} id_empresa
 * @param {object} [declaracion]
 * @param {string} [declaracion.actor] - QUIÉN declara el plazo
 * @param {string} [declaracion.motivo] - POR QUÉ se recalcula
 * @param {object} [opciones]
 * @param {object} [opciones.tabla_conservacion] - la tabla supletoria a usar,
 *   en vez de la del archivo. Es el punto de inyección que usan los tests.
 * @returns {{id_empresa: string, revisados: number, con_fecha: number, liberados: number, sin_fecha: number, mensaje: string}}
 */
function recalcularPlazosDeclarados(id_empresa, declaracion = {}, opciones = {}) {
  const actor = String(declaracion.actor || '').trim() || 'empresa';
  const motivo = String(declaracion.motivo || '').trim()
    || 'la Empresa declara su plazo de retencion documental';

  const empresa = db.prepare(
    'SELECT * FROM gh_firma_empresas WHERE id_empresa = ?'
  ).get(id_empresa);

  // Las firmas SIN fecha de conservación de esta Empresa.
  const filas = db.prepare(`
    SELECT f.id, f.fecha_creacion, f.categoria_retencion, f.regla_retencion,
           f.fecha_terminacion, f.motivo_hold
      FROM gh_firmas_electronicas f
     WHERE f.id_empresa = ?
       AND f.fecha_conservacion IS NULL
  `).all(id_empresa);

  // Los registros que están retenidos por plazo no declarado: son los que
  // este recálculo puede liberar.
  const pendientes = filas.filter(
    (f) => f.motivo_hold === MOTIVO_HOLD_PLAZO_NO_DECLARADO
  );

  if (!empresa) {
    return {
      id_empresa, revisados: pendientes.length, con_fecha: 0, liberados: 0, sin_fecha: 0,
      mensaje: 'La Empresa no existe: no hay nada que recalcular.',
    };
  }

  let con_fecha = 0;
  let liberados = 0;
  let sin_fecha = 0;

  for (const f of pendientes) {
    // Solo las retenidas POR PLAZO NO DECLARADO. Un hold por deber legal o el
    // del contrato electrónico son otros motivos: levantarlos acá seria
    // levantar una proteccion que sigue vigente.
    const plan = retencionService.planificar({
      categoria_retencion: f.categoria_retencion,
      regla_retencion: f.regla_retencion,
      fecha_creacion: f.fecha_creacion,
      fecha_terminacion: f.fecha_terminacion,
      empresa,
      tabla_conservacion: opciones.tabla_conservacion,
    });

    if (!plan.fecha_conservacion) {
      // El plazo no es computable para esta categoria: el registro sigue
      // retenido y se sigue reportando. No se inventa una fecha.
      sin_fecha += 1;
      continue;
    }

    db.prepare(
      'UPDATE gh_firmas_electronicas SET fecha_conservacion = ? WHERE id = ?'
    ).run(plan.fecha_conservacion, f.id);
    // 049 · el plazo aplicado, su fuente y su fecha de inicio quedan
    // congelados en la fila, igual que en el alta.
    _escribirTrazabilidad(f.id, plan);
    con_fecha += 1;

    // Se levanta el hold SIN fechas: la fecha ya la puso el plan, y volver a
    // calcularla acá (punto de inicio + dias) podria dejar una fecha distinta
    // de la que el propio plan decidio.
    const r = liberarHoldPorPlazoNoDeclarado(f.id, { actor, motivo, plan });
    if (r.liberado) liberados += 1;
  }

  logger.info('Plazos de conservacion recalculados', {
    id_empresa,
    actor,
    motivo,
    revisados: pendientes.length,
    con_fecha,
    liberados,
    sin_fecha,
  });

  return {
    id_empresa,
    revisados: pendientes.length,
    con_fecha,
    liberados,
    sin_fecha,
    mensaje: con_fecha > 0
      ? 'Los registros retenidos por plazo no declarado que ya tienen plazo aplicable '
        + 'quedaron con fecha de conservacion y su retencion se levanto.'
      : 'No hay registros pendientes de plazo para esta Empresa.',
  };
}

/**
 * El historial de declares de una firma: cada declaración y cada liberación.
 *
 * @param {number} idFirma
 * @returns {object[]}
 */
function holdsDe(idFirma) {
  return db.prepare(
    'SELECT id, actor, motivo, alcance, declarado_at, liberado_at, liberado_por, motivo_liberacion, activo FROM gh_firma_holds WHERE firma_id = ? ORDER BY id'
  ).all(idFirma);
}

/**
 * ¿Esta fila es elegible para supresión?
 *
 * Las CUATRO condiciones, en orden:
 *   1. Tiene fecha de conservación (la Empresa declaró plazo).
 *   2. El plazo venció.
 *   3. No hay deber legal o contractual de conservación.
 *   4. No hay solicitud de copia pendiente (el 8.6(e)(iii)).
 *
 * LA CUARTA CONDICIÓN (el 8.6(e)(iii) y el 8.6(f))
 * ------------------------------------------------
 * "La supresión procede solo cuando concurren: (i) vencimiento del plazo
 * aplicable; (ii) ausencia de deber legal o contractual de conservación;
 * (iii) ausencia de solicitud de copia pendiente; y (iv) ausencia de hold
 * vigente."
 *
 * Y el 8.6(f): "La solicitud se registra y se atiende antes de cualquier
 * supresión."
 *
 * Mientras la Empresa tenga una solicitud de COPIA pendiente, su evidencia no
 * se suprime: primero se entrega la copia. Es la misma granularidad que el
 * hold de deber legal (que también frena a nivel de empresa): se conserva de
 * más antes que suprimir de más.
 *
 * @param {object} fila - fila de gh_firmas_electronicas
 * @returns {boolean}
 */
function esElegible(fila) {
  if (!fila) return false;
  if (!fila.fecha_conservacion) return false;
  if (Number(fila.hold_legal) === 1) return false;
  // El 8.6(e)(iii): hay una solicitud de copia pendiente, no se suprime.
  if (tieneCopiaPendiente(fila.id_empresa)) return false;
  const t = new Date(fila.fecha_conservacion).getTime();
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

/**
 * ¿Venció el plazo de conservación de esta firma?
 *
 * 8A.1. `fecha_conservacion` se calcula al crear la firma (fecha_creacion +
 * plazo_retencion_dias, que declara la Empresa). Vencida esa fecha, el
 * numeral 10.6 del Acuerdo obliga a suprimir el dato.
 *
 * Mientras la supresión no se haya ejecutado (capa 5B, Fase 8A.2), el
 * sistema NO debe seguir afirmando que la firma está vigente: la
 * respuesta honesta es "no disponible por vencimiento del plazo", no
 * "inválido" (mentiría sobre el motivo) ni "firma válida" (afirmaría una
 * vigencia que ya no existe).
 *
 * EL HOLD LEGAL PRIMA. Si existe un deber legal o contractual de
 * conservación (una reclamación, un proceso judicial, un requerimiento de la
 * SIC), el dato NO se suprime: se conserva. En ese caso la evidencia sigue
 * viva y la verificación debe seguir confirmando la integridad: decir "no
 * disponible" sería falso, porque el documento está ahí y además tiene que
 * estar ahí. Por eso esta función mira el hold.
 *
 * Diferencia con `esElegible`: las dos responden hoy lo mismo (tiene
 * fecha, venció, no hay hold), pero `esElegible` pregunta "¿se puede
 * borrar?" (supresión) y esta pregunta "¿el sistema debe seguir
 * afirmando que está vigente?" (consulta). Se mantienen separadas para
 * que la 5B y la 8A.1 no se confundan.
 *
 * Sin plazo declarado (`fecha_conservacion` NULL) no hay vencimiento: no
 * se inventa nada.
 *
 * @param {object} fila - fila de gh_firmas_electronicas
 * @returns {boolean}
 */
function vencidaPorConservacion(fila) {
  if (!fila) return false;
  if (!fila.fecha_conservacion) return false;
  if (Number(fila.hold_legal) === 1) return false;
  const t = new Date(fila.fecha_conservacion).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() > t;
}

/**
 * Marca una fila del grupo "sin plazo": el 8.6(h) dice que ese registro no se
 * suprime y QUEDA RETENIDO por falta de plazo declarado, y que el pendiente se
 * reporta. La fila sale del reporte con el nombre de lo que está pendiente.
 *
 * @param {object} f - fila de gh_firmas_electronicas
 * @returns {object} la fila con el pendiente nombrado
 */
function _pendienteDePlazo(f) {
  return {
    ...f,
    plazo_pendiente: true,
    motivo_retencion: f.motivo_hold || MOTIVO_HOLD_PLAZO_NO_DECLARADO,
    alcance_retencion: f.hold_alcance || null,
  };
}

/**
 * Reporte de vencimientos, en los cuatro grupos que le importan a quien
 * decide:
 *
 *   proximos          - vence pronto, todavía no
 *   vencidosElegibles - venció y no hay deber legal de conservación
 *   vencidosEnHold    - venció pero hay deber legal: NO se suprime
 *   sinPlazo          - la Empresa no declaró plazo: no hay purga y el registro
 *                       queda retenido por esa razón (el 8.6(h))
 *
 * MÁS UN QUINTO: `vencidosConCopia`
 * -----------------------------------
 * Venció, no hay deber legal, pero hay una solicitud de COPIA pendiente
 * (el 8.6(e)(iii)). NO se suprime: primero se entrega la copia (8.6(f)).
 *
 * @param {object} [opts]
 * @param {string} [opts.id_empresa] - filtra por empresa
 * @param {number} [opts.dias_proximos] - ventana del grupo "próximos"
 * @returns {{proximos: object[], vencidosElegibles: object[], vencidosEnHold: object[], sinPlazo: object[], vencidosConCopia: object[]}}
 */
function vencimientos(opts = {}) {
  const diasProximos = Number.isInteger(opts.dias_proximos) && opts.dias_proximos >= 0
    ? opts.dias_proximos
    : DIAS_PRORRO;

  const params = [];
  let sql = `
    SELECT id, id_solicitud, id_empresa, estado, fecha_creacion,
           fecha_conservacion, hold_legal, motivo_hold, hold_actor, hold_alcance,
           pdf_original_path, pdf_firmado_path, constancia_path
      FROM gh_firmas_electronicas`;
  if (opts.id_empresa) {
    sql += ' WHERE id_empresa = ?';
    params.push(opts.id_empresa);
  }
  sql += ' ORDER BY fecha_conservacion IS NULL, fecha_conservacion';

  const filas = db.prepare(sql).all(...params);
  const ahora = Date.now();
  const limiteProximos = ahora + diasProximos * MS_POR_DIA;

  // Una sola consulta para todo el reporte: qué empresas tienen una copia
  // pendiente. Sin esto, cada fila pagaría su propia consulta.
  const empresasConCopia = empresasConCopiaPendiente();

  const grupos = {
    proximos: [],
    vencidosElegibles: [],
    vencidosEnHold: [],
    sinPlazo: [],
    vencidosConCopia: [],
  };

  for (const f of filas) {
    if (!f.fecha_conservacion) {
      grupos.sinPlazo.push(_pendienteDePlazo(f));
      continue;
    }
    const t = new Date(f.fecha_conservacion).getTime();
    if (Number.isNaN(t)) {
      grupos.sinPlazo.push(_pendienteDePlazo(f));
      continue;
    }
    if (t > ahora) {
      if (t <= limiteProximos) grupos.proximos.push(f);
      continue;
    }
    // Vencida.
    if (Number(f.hold_legal) === 1) {
      grupos.vencidosEnHold.push(f);
      continue;
    }
    // El 8.6(e)(iii): con una solicitud de copia pendiente, no se suprime.
    if (empresasConCopia.has(String(f.id_empresa))) {
      grupos.vencidosConCopia.push(f);
      continue;
    }
    grupos.vencidosElegibles.push(f);
  }

  return grupos;
}

/**
 * La ventana de purga vigente, o null si no hay ninguna abierta.
 * Una ventana vencida cuenta como no abierta.
 * @returns {object|null}
 */
function ventanaVigente() {
  const row = db.prepare('SELECT * FROM gh_firma_purga_control WHERE id = 1').get();
  if (!row || Number(row.ventana_activa) !== 1) return null;
  if (!row.abierta_hasta) return null;
  const t = new Date(row.abierta_hasta).getTime();
  if (Number.isNaN(t) || t < Date.now()) return null;
  return row;
}

/**
 * Abre la ventana de purga.
 *
 * @param {object} opts
 * @param {string} opts.actor - QUIÉN la abre. Sin actor no hay ventana.
 * @param {string} opts.motivo - POR QUÉ. Sin motivo no hay ventana.
 * @param {number} [opts.minutos] - duración (tope: VENTANA_MAX_MINUTOS)
 * @returns {object} la ventana abierta
 */
function abrirVentana(opts = {}) {
  const actor = String(opts.actor || '').trim();
  const motivo = String(opts.motivo || '').trim();
  if (!actor) throw new Error('La ventana de purga necesita un actor (quién la abre).');
  if (!motivo) throw new Error('La ventana de purga necesita un motivo (por qué se abre).');

  // La duración es explícita: si viene, tiene que ser un entero de minutos
  // mayor que cero. No se "redondea" un valor inválido: una ventana de 0
  // minutos sería una ventana que ya está vencida.
  let minutos = 30;
  if (opts.minutos !== undefined && opts.minutos !== null && opts.minutos !== '') {
    const pedidos = Number(opts.minutos);
    if (!Number.isInteger(pedidos) || pedidos <= 0) {
      throw new Error('La ventana de purga necesita una duración en minutos mayor que cero.');
    }
    minutos = Math.min(pedidos, VENTANA_MAX_MINUTOS);
  }
  const ahora = new Date();
  const hasta = new Date(ahora.getTime() + minutos * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO gh_firma_purga_control
      (id, ventana_activa, abierta_at, abierta_hasta, abierta_por, motivo, cerrada_at)
    VALUES (1, 1, ?, ?, ?, ?, NULL)
    ON CONFLICT(id) DO UPDATE SET
      ventana_activa = 1,
      abierta_at = excluded.abierta_at,
      abierta_hasta = excluded.abierta_hasta,
      abierta_por = excluded.abierta_por,
      motivo = excluded.motivo,
      cerrada_at = NULL
  `).run(ahora.toISOString(), hasta, actor, motivo);

  _log('VENTANA_ABIERTA', { actor, motivo, ventana_hasta: hasta });
  logger.info('Ventana de purga abierta', { actor, minutos, hasta });
  return { actor, motivo, abierta_at: ahora.toISOString(), abierta_hasta: hasta };
}

/**
 * Cierra la ventana y vacía el lote. El lote no sobrevive a la ventana: si
 * quedara, una ventana siguiente heredaría habilitaciones viejas.
 *
 * @param {object} [opts]
 * @param {string} [opts.actor]
 */
function cerrarVentana(opts = {}) {
  const actor = String(opts.actor || '').trim() || null;
  const ahora = new Date().toISOString();
  db.prepare(
    'UPDATE gh_firma_purga_control SET ventana_activa = 0, cerrada_at = ? WHERE id = 1'
  ).run(ahora);
  const lote = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_purga_lote').get().n;
  db.prepare('DELETE FROM gh_firma_purga_lote').run();
  _log('VENTANA_CERRADA', { actor, firmas_en_lote: lote });
  logger.info('Ventana de purga cerrada', { actor, lote_descartado: lote });
  return { cerrada_at: ahora, lote_descartado: lote };
}

/**
 * Arma el lote de la ventana vigente: las firmas vencidas y sin deber legal
 * de conservación. Las que están en hold NO entran, y las que no tienen plazo
 * declarado tampoco.
 *
 * El chequeo del hold queda REGISTRADO: el log de purgas anota cuántas
 * firmas se revisaron y cuántas quedaron afuera por un deber legal. Esa
 * cuenta es la prueba de que el hold se comprobó, no de que se pasaron por
 * alto.
 *
 * @param {object} opts
 * @param {string} opts.actor
 * @param {string} [opts.motivo]
 * @param {string} [opts.id_empresa] - limita el lote a una empresa
 * @returns {{firmas: number, agregadas: number, omitidas_hold: number, omitidas_sin_plazo: number, omitidas_copia: number}}
 */
function armarLote(opts = {}) {
  const actor = String(opts.actor || '').trim();
  if (!actor) throw new Error('El lote necesita un actor.');
  const ventana = ventanaVigente();
  if (!ventana) throw new Error('No hay ventana de purga abierta.');

  const grupos = vencimientos({ id_empresa: opts.id_empresa || null });
  const elegibles = grupos.vencidosElegibles;

  const tx = db.transaction(() => {
    // El lote se rehace: refleja exactamente lo que se comprobó en ESTA
    // corrida. Una ventana no hereda habilitaciones de otra.
    db.prepare('DELETE FROM gh_firma_purga_lote').run();
    for (const f of elegibles) {
      db.prepare(`
        INSERT INTO gh_firma_purga_lote (firma_id, anadida_por, motivo)
        VALUES (?, ?, ?)
      `).run(f.id, actor, opts.motivo || ventana.motivo || null);
    }
  });
  tx();

  const total = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_purga_lote').get().n;
  _log('LOTE_ARMADO', {
    actor,
    firmas_en_lote: total,
    ventana_hasta: ventana.abierta_hasta,
    // El chequeo del hold, contado.
    hold_revisados: grupos.vencidosElegibles.length + grupos.vencidosEnHold.length,
    hold_bloqueados: grupos.vencidosEnHold.length,
    // El 8.6(e)(iii): las que no entran al lote por una copia pendiente.
    copia_bloqueadas: grupos.vencidosConCopia.length,
  });
  return {
    firmas: total,
    agregadas: elegibles.length,
    omitidas_hold: grupos.vencidosEnHold.length,
    omitidas_sin_plazo: grupos.sinPlazo.length,
    omitidas_copia: grupos.vencidosConCopia.length,
  };
}

/**
 * Ejecuta la purga del lote: borra los eventos de auditoría de las firmas del
 * lote y cierra la ventana. Fuera de la ventana y fuera del lote, el trigger
 * aborta: por eso esto no es un `DELETE` suelto.
 *
 * QUÉ HACE Y QUÉ NO
 * -----------------
 * Suprime EL REGISTRO DE AUDITORÍA de las firmas del lote. NO suprime los
 * datos personales de la fila (correo, huellas, manifestación de voluntad) ni
 * los archivos (PDF original, PDF firmado, constancia): esa es la capa 5B,
 * que es un paquete aparte. Ejecutar solo esta capa deja el estado inverso
 * al deseable —se destruye la prueba y se conservan los datos— y por eso
 * cada firma purgada queda con su RECIBO en `gh_firma_purga_registro`.
 *
 * @param {object} opts
 * @param {string} opts.actor
 * @param {boolean} [opts.cerrar=true] - Si es false, la ventana QUEDA ABIERTA
 *   y el lote NO se vacía. Es lo que necesita la operación de dos capas
 *   (scripts/purga-ventana.js): la capa 2 (la fila de la firma y los
 *   archivos) corre sobre el MISMO lote y en la MISMA ventana, y vuelve a
 *   comprobar el hold de cada firma. Si esta capa cerrara la ventana, la
 *   capa 2 no podría correr: `ventanaVigente()` devolvería null y el lote
 *   estaría vacío.
 * @returns {{firmas: number, eventos_purgados: number}}
 */
function purgar(opts = {}) {
  const actor = String(opts.actor || '').trim();
  // El nombre de la opción NO puede ser `cerrarVentana`: dentro de esta
  // función ese nombre lo ocupa la función homonima que hace el cierre.
  const cerrar = opts.cerrar !== false;
  if (!actor) throw new Error('La purga necesita un actor.');
  const ventana = ventanaVigente();
  if (!ventana) throw new Error('No hay ventana de purga abierta.');

  const lote = db.prepare('SELECT firma_id FROM gh_firma_purga_lote ORDER BY firma_id').all();

  // Defensa en profundidad: aunque el trigger ya se niega, el servicio no
  // toca una firma con hold activo ni una cuyo plazo no venció. El trigger
  // es el que manda; esto es el cinturón.
  const elegibles = lote.filter(({ firma_id }) => {
    const f = db.prepare(
      'SELECT id_empresa, fecha_conservacion, hold_legal FROM gh_firmas_electronicas WHERE id = ?'
    ).get(firma_id);
    return f && esElegible(f);
  });
  const bloqueadas = lote.length - elegibles.length;

  let eventos = 0;
  const tx = db.transaction(() => {
    for (const { firma_id } of elegibles) {
      const f = db.prepare(
        'SELECT id_solicitud, id_empresa, fecha_conservacion FROM gh_firmas_electronicas WHERE id = ?'
      ).get(firma_id);
      const r = db.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = ?').run(firma_id);
      eventos += r.changes;
      // El recibo: qué firma, qué empresa, cuándo, quién, por qué, en qué
      // ventana, qué categorías y que se comprobó el hold. SIN datos
      // personales: solo identificadores internos.
      //
      // El 3.6(g) y el 10.5(d): el recibo identifica la SOLICITUD y el
      // FUNDAMENTO DEL PLAZO. Sin estas dos columnas (migración 041), el
      // recibo de la purga de auditoría no podía decir a qué solicitud
      // pertenecía ni hasta cuándo hubo que conservarla.
      db.prepare(`
        INSERT INTO gh_firma_purga_registro
          (firma_id, id_empresa, purgado_at, actor, motivo, ventana_hasta,
           categorias, hold_verificado, eventos_purgados,
           id_solicitud, fecha_conservacion)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(
        firma_id,
        f ? f.id_empresa : null,
        new Date().toISOString(),
        actor,
        ventana.motivo || null,
        ventana.abierta_hasta,
        CATEGORIAS_AUDITORIA,
        r.changes,
        f ? f.id_solicitud : null,
        f ? f.fecha_conservacion : null
      );
    }
  });
  tx();

  _log('PURGA_EJECUTADA', {
    actor,
    firmas_en_lote: elegibles.length,
    eventos_purgados: eventos,
    ventana_hasta: ventana.abierta_hasta,
    hold_bloqueados: bloqueadas,
  });
  logger.info('Purga del registro de auditoría ejecutada', {
    actor, firmas: elegibles.length, eventos_purgados: eventos, hold_bloqueados: bloqueadas,
  });
  // El cierre lo decide el llamador: en la operación de dos capas la ventana
  // tiene que seguir viva para que la capa 2 corra sobre el mismo lote.
  if (cerrar) cerrarVentana({ actor });
  return { firmas: elegibles.length, eventos_purgados: eventos, hold_bloqueados: bloqueadas };
}

/**
 * Escribe en el log append-only de purgas. El log no se puede alterar ni
 * borrar: si la supresión borrara su propio rastro, no habría forma de
 * demostrar qué se suprimió.
 */
function _log(evento, extra = {}) {
  db.prepare(`
    INSERT INTO gh_firma_purga_log
      (evento, actor, motivo, ventana_hasta, firmas_en_lote, eventos_purgados,
       hold_revisados, hold_bloqueados)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    evento,
    extra.actor || null,
    extra.motivo || null,
    extra.ventana_hasta || null,
    extra.firmas_en_lote === undefined ? null : extra.firmas_en_lote,
    extra.eventos_purgados === undefined ? null : extra.eventos_purgados,
    extra.hold_revisados === undefined ? null : extra.hold_revisados,
    extra.hold_bloqueados === undefined ? null : extra.hold_bloqueados
  );
}

module.exports = {
  VENTANA_MAX_MINUTOS,
  DIAS_PRORRO,
  CATEGORIAS_AUDITORIA,
  ACTOR_HOLD_PLAZO_NO_DECLARADO,
  MOTIVO_HOLD_PLAZO_NO_DECLARADO,
  ALCANCE_HOLD_PLAZO_NO_DECLARADO,
  calcularFechaConservacion,
  plazoDeclarado,
  deberLegalEmpresa,
  asignarFechaConservacion,
  aplicarPlanRetencion,
  ponerHold,
  liberarHold,
  retenerPorPlazoNoDeclarado,
  liberarHoldPorPlazoNoDeclarado,
  reportePlazoPendiente,
  retenerPendientesDePlazo,
  recalcularPlazosDeclarados,
  holdsDe,
  esElegible,
  vencidaPorConservacion,
  vencimientos,
  ventanaVigente,
  abrirVentana,
  cerrarVentana,
  armarLote,
  purgar,
};
