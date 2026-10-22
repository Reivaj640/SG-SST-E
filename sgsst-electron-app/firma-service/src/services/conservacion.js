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
 * @param {number} idFirma
 * @param {string} id_empresa
 * @param {string} fecha_creacion
 * @returns {string|null} la fecha calculada, o null si no hay plazo declarado
 */
function asignarFechaConservacion(idFirma, id_empresa, fecha_creacion) {
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
  const dias = plazoDeclarado(id_empresa);
  const fecha = calcularFechaConservacion(fecha_creacion, dias);
  if (!fecha) {
    // Sin plazo declarado no hay fecha y no hay purga. No se inventa nada.
    return null;
  }
  db.prepare(
    'UPDATE gh_firmas_electronicas SET fecha_conservacion = ? WHERE id = ?'
  ).run(fecha, idFirma);
  return fecha;
}

/**
 * Aplica el plan del catálogo por documento a una fila ya insertada.
 *
 * A diferencia de `asignarFechaConservacion`, este camino NO mira la tabla de
 * la Empresa cuando la regla tiene plazo legal propio: la fecha viene calculada
 * por `retencion.planificar` (20 años desde el cese, 100 desde el retiro) o es
 * NULL porque falta la fecha de cese/retiro. Un plan con hold deja el hold
 * automático, igual que el deber legal de la Empresa.
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

  if (plan.hold) {
    ponerHold(idFirma, plan.hold);
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
 * Las tres condiciones, en orden:
 *   1. Tiene fecha de conservación (la Empresa declaró plazo).
 *   2. El plazo venció.
 *   3. No hay deber legal o contractual de conservación.
 *
 * @param {object} fila - fila de gh_firmas_electronicas
 * @returns {boolean}
 */
function esElegible(fila) {
  if (!fila) return false;
  if (!fila.fecha_conservacion) return false;
  if (Number(fila.hold_legal) === 1) return false;
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
 * Reporte de vencimientos, en los cuatro grupos que le importan a quien
 * decide:
 *
 *   proximos          - vence pronto, todavía no
 *   vencidosElegibles - venció y no hay deber legal de conservación
 *   vencidosEnHold    - venció pero hay deber legal: NO se suprime
 *   sinPlazo          - la Empresa no declaró plazo: no hay purga
 *
 * @param {object} [opts]
 * @param {string} [opts.id_empresa] - filtra por empresa
 * @param {number} [opts.dias_proximos] - ventana del grupo "próximos"
 * @returns {{proximos: object[], vencidosElegibles: object[], vencidosEnHold: object[], sinPlazo: object[]}}
 */
function vencimientos(opts = {}) {
  const diasProximos = Number.isInteger(opts.dias_proximos) && opts.dias_proximos >= 0
    ? opts.dias_proximos
    : DIAS_PRORRO;

  const params = [];
  let sql = `
    SELECT id, id_solicitud, id_empresa, estado, fecha_creacion,
           fecha_conservacion, hold_legal, motivo_hold
      FROM gh_firmas_electronicas`;
  if (opts.id_empresa) {
    sql += ' WHERE id_empresa = ?';
    params.push(opts.id_empresa);
  }
  sql += ' ORDER BY fecha_conservacion IS NULL, fecha_conservacion';

  const filas = db.prepare(sql).all(...params);
  const ahora = Date.now();
  const limiteProximos = ahora + diasProximos * MS_POR_DIA;

  const grupos = {
    proximos: [],
    vencidosElegibles: [],
    vencidosEnHold: [],
    sinPlazo: [],
  };

  for (const f of filas) {
    if (!f.fecha_conservacion) {
      grupos.sinPlazo.push(f);
      continue;
    }
    const t = new Date(f.fecha_conservacion).getTime();
    if (Number.isNaN(t)) {
      grupos.sinPlazo.push(f);
      continue;
    }
    if (t > ahora) {
      if (t <= limiteProximos) grupos.proximos.push(f);
      continue;
    }
    // Vencida.
    if (Number(f.hold_legal) === 1) grupos.vencidosEnHold.push(f);
    else grupos.vencidosElegibles.push(f);
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
 * @returns {{firmas: number, agregadas: number, omitidas_hold: number, omitidas_sin_plazo: number}}
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
  });
  return {
    firmas: total,
    agregadas: elegibles.length,
    omitidas_hold: grupos.vencidosEnHold.length,
    omitidas_sin_plazo: grupos.sinPlazo.length,
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
 * @returns {{firmas: number, eventos_purgados: number}}
 */
function purgar(opts = {}) {
  const actor = String(opts.actor || '').trim();
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
        'SELECT id_empresa FROM gh_firmas_electronicas WHERE id = ?'
      ).get(firma_id);
      const r = db.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = ?').run(firma_id);
      eventos += r.changes;
      // El recibo: qué firma, qué empresa, cuándo, quién, por qué, en qué
      // ventana, qué categorías y que se comprobó el hold. SIN datos
      // personales: solo identificadores internos.
      db.prepare(`
        INSERT INTO gh_firma_purga_registro
          (firma_id, id_empresa, purgado_at, actor, motivo, ventana_hasta,
           categorias, hold_verificado, eventos_purgados)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        firma_id,
        f ? f.id_empresa : null,
        new Date().toISOString(),
        actor,
        ventana.motivo || null,
        ventana.abierta_hasta,
        CATEGORIAS_AUDITORIA,
        r.changes
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
  cerrarVentana({ actor });
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
  calcularFechaConservacion,
  plazoDeclarado,
  deberLegalEmpresa,
  asignarFechaConservacion,
  aplicarPlanRetencion,
  ponerHold,
  liberarHold,
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
