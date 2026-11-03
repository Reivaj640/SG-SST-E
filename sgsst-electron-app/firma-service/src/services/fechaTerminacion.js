/**
 * EL CANAL DE LA FECHA DE TERMINACIÓN (Anexo de Encargo, sección 6)
 * =================================================================
 *
 * QUÉ ES ESTE SERVICIO
 * --------------------
 * El Anexo de Encargo, en su sección 6, dice:
 *
 *   "Comunicar al Encargado la fecha de terminación de la relación laboral
 *    de cada trabajador respecto de quien se firmen documentos de las
 *    categorías del literal (b) del numeral 8.6 del Acuerdo, por el canal que
 *    el Encargado habilite en el servicio, con el fin de iniciar el cómputo
 *    del plazo legal. El Encargado registra la fecha con la evidencia de la
 *    comunicación y recalcula el plazo de las filas afectadas, dejando
 *    registro de la operación. Mientras la fecha no se reciba, la fila
 *    permanece retenida, no se calcula fecha de supresión y se revisa
 *    periódicamente."
 *
 * Este servicio es ese canal. Hace CUATRO cosas, y ninguna más:
 *
 *   1. REGISTRA la fecha comunicada, con su evidencia y con el canal por el
 *      que llegó (tabla `gh_firma_fecha_terminacion`, migración 052).
 *   2. ESCRIBE la fecha en las filas del trabajador (solo en las que no la
 *      tenían: una fecha ya comunicada no se reescribe).
 *   3. RECALCULA el plazo de las filas afectadas, y SOLO de esas: es un
 *      recálculo acotado (`opciones.firmas` de `conservacion.js`).
 *   4. DEJA REGISTRO de la operación en una bitácora append-only
 *      (`gh_firma_fecha_terminacion_eventos`, con los triggers de la 053).
 *
 * Y además ofrece la REVISIÓN PERIÓDICA: `pendientes()` lista las filas que
 * siguen esperando la fecha de terminación y las que ya la tienen perowhose
 * recálculo quedó pendiente, para que la Empresa las siga.
 *
 * LO QUE NO HACE (y por qué)
 * --------------------------
 *
 * - NO INVENTA LA FECHA. La fecha es la que comunica la Empresa. Sin fecha
 *   no hay cómputo: la fila sigue retenida y sin fecha de supresión. Es lo
 *   que el abogado aprobó (J9: "la fecha de firma NO sustituye la fecha de
 *   cese; el registro queda pendiente y sin fecha de supresión calculada").
 *
 * - NO LIBERA EL HOLD DEL CONTRATO. El hold sin término del contrato
 *   electrónico es otro motivo, que no es recalculable: levantarlo acá sería
 *   levantar una protección que sigue vigente. El recálculo solo toca las
 *   filas cuyo motivo de hold es recalculable (`plazo_no_declarado`,
 *   `fecha_cese_pendiente`, `tabla_supletoria_pendiente_validacion`).
 *
 * - NO GUARDA EL DOCUMENTO CRUDO. Se guarda el seudónimo del trabajador con el
 *   ámbito de la Empresa (`psn1_...`), igual que en el resto del sistema. El
 *   documento crudo viaja en la petición y no queda en la base.
 *
 * - NO ESPIA A LA EMPRESA. El canal es de una Empresa a la vez y se audita
 *   con actor y motivo.
 *
 * - NO ES UN CANAL MASIVO. Una comunicación, un trabajador. El recálculo
 *   acotado es lo que permite que una comunicación no mueva los plazos de
 *   nadie más.
 */
'use strict';

const db = require('../db/connection');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');
const trabajador = require('./trabajador');
const conservacion = require('./conservacion');
const retencion = require('./retencion');

// Los dos eventos de la bitácora.
const EVENTO_REGISTRADA = 'FECHA_TERMINACION_REGISTRADA';
const EVENTO_RECALCULO = 'FECHA_TERMINACION_PLAZO_RECALCULADO';

// El motivo de hold que significa "falta la fecha real del cese" (J9).
const MOTIVO_CESE_PENDIENTE = 'fecha_cese_pendiente';

// Un día de margen: la fecha de terminación es un hecho pasado. Un cese
// futuro se admite (aviso de terminación), pero no un cesse de 2050.
const UN_DIA_MS = 24 * 60 * 60 * 1000;

function _texto(valor) {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  return s === '' ? null : s;
}

function _error(status, code, mensaje, detalles) {
  return new AppError(status, code, mensaje, detalles);
}

/**
 * Registra la fecha de terminación comunicada por la Empresa.
 *
 * @param {object} datos
 * @param {string} datos.id_empresa - La Empresa que comunica.
 * @param {string} datos.id_trabajador - Documento o seudónimo del trabajador.
 * @param {string} datos.fecha_terminacion - La fecha comunicada.
 * @param {string} datos.evidencia - La evidencia de la comunicación (obligatoria).
 * @param {string} datos.canal - Por dónde llegó (obligatorio).
 * @param {string} [datos.motivo] - Por qué se registra.
 * @param {string} [datos.actor] - Quién lo registra.
 * @param {string} [datos.ip] - Desde dónde.
 * @param {string} [datos.user_agent] - Con qué cliente.
 * @returns {{registro: object, filas: object, recalculo: object}}
 */
function registrar(datos = {}) {
  const id_empresa = _texto(datos.id_empresa);
  const documento = _texto(datos.id_trabajador);
  const evidencia = _texto(datos.evidencia);
  const canal = _texto(datos.canal);
  const actor = _texto(datos.actor) || 'admin';
  const motivo = _texto(datos.motivo)
    || 'La Empresa comunica la fecha de terminacion de la relacion laboral';

  if (!id_empresa) {
    throw _error(400, 'FECHA_TERMINACION_INVALIDA', 'Falta la Empresa (id_empresa).');
  }
  if (!documento) {
    throw _error(400, 'FECHA_TERMINACION_INVALIDA', 'Falta el trabajador (id_trabajador).');
  }
  if (!evidencia) {
    throw _error(
      400,
      'FECHA_TERMINACION_INVALIDA',
      'La comunicacion se registra con su evidencia: falta la evidencia.'
    );
  }
  if (!canal) {
    throw _error(
      400,
      'FECHA_TERMINACION_INVALIDA',
      'Falta el canal por el que se recibio la comunicacion.'
    );
  }

  const fecha = retencion.normalizarFecha(_texto(datos.fecha_terminacion));
  if (!fecha) {
    throw _error(
      400,
      'FECHA_TERMINACION_INVALIDA',
      'La fecha de terminacion no es una fecha valida.'
    );
  }
  const mañana = new Date(Date.now() + UN_DIA_MS).getTime();
  if (new Date(fecha).getTime() > mañana) {
    throw _error(
      400,
      'FECHA_TERMINACION_INVALIDA',
      'La fecha de terminacion no puede estar en el futuro.'
    );
  }

  const empresa = db.prepare(
    'SELECT id_empresa FROM gh_firma_empresas WHERE id_empresa = ?'
  ).get(id_empresa);
  if (!empresa) {
    throw _error(
      404,
      'EMPRESA_NOT_FOUND',
      'No existe la empresa ' + id_empresa + '.',
      { id_empresa }
    );
  }

  // El seudonimo con el ambito de la Empresa, y los candidatos de busqueda
  // (todas las versiones del anillo + el valor crudo, por las filas heredadas).
  const seudonimo = trabajador.valorParaGuardar(documento, id_empresa).valor;
  const candidatos = trabajador.candidatosBusqueda(documento, id_empresa);
  if (!candidatos.length) {
    throw _error(
      400,
      'FECHA_TERMINACION_INVALIDA',
      'El trabajador no se puede identificar.'
    );
  }

  const marcadores = candidatos.map(() => '?').join(',');
  const filas = db.prepare(`
    SELECT id, id_solicitud, categoria_retencion, regla_retencion,
           fecha_terminacion, fecha_conservacion, motivo_hold, hold_legal
      FROM gh_firmas_electronicas
     WHERE id_empresa = ? AND id_trabajador IN (${marcadores})
     ORDER BY id ASC
  `).all(id_empresa, ...candidatos);

  // Las filas que YA tienen fecha de terminacion no se reescriben: la fecha
   // que ya se tenia: la fecha ya comunicada no se reescribe.
  const sinFecha = filas.filter((f) => !f.fecha_terminacion);
  const conFecha = filas.filter((f) => f.fecha_terminacion);

  const resultado = db.transaction(() => {
    // 1 · La fecha en las filas que no la tenian.
    if (sinFecha.length) {
      const update = db.prepare(
        'UPDATE gh_firmas_electronicas SET fecha_terminacion = ? WHERE id = ?'
      );
      for (const f of sinFecha) update.run(fecha, f.id);
    }

    // 2 · El registro, con su evidencia.
    const info = db.prepare(`
      INSERT INTO gh_firma_fecha_terminacion
        (id_empresa, id_trabajador, fecha_terminacion, evidencia, canal,
         actor, motivo, fecha_registro, firmas_afectadas, firmas_recalculadas, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id_empresa,
      seudonimo,
      fecha,
      evidencia,
      canal,
      actor,
      motivo,
      new Date().toISOString(),
      sinFecha.length,
      0,
      JSON.stringify({ origen: 'canal_fecha_terminacion' })
    );
    const registro_id = Number(info.lastInsertRowid);

    // 3 · El recalculo ACOTADO a las filas del trabajador. Solo toca las filas
    //     cuyo motivo de hold es recalculable: el hold sin termino del
    //     contrato electronico no se levanta.
    const recalculo = conservacion.recalcularPlazosDeclarados(
      id_empresa,
      { actor, motivo },
      { firmas: filas.map((f) => f.id) }
    );

    // 4 · La bitacora. Append-only: de aqui no se borra nada.
    _evento({
      registro_id,
      evento: EVENTO_REGISTRADA,
      id_actor: actor,
      ip: _texto(datos.ip),
      user_agent: _texto(datos.user_agent),
      id_empresa,
      motivo,
      metadata: {
        fecha_terminacion: fecha,
        evidencia,
        canal,
        filas_afectadas: sinFecha.map((f) => f.id),
        filas_con_fecha_previa: conFecha.map((f) => f.id),
        firmas_encontradas: filas.length,
      },
    });
    _evento({
      registro_id,
      evento: EVENTO_RECALCULO,
      id_actor: actor,
      ip: _texto(datos.ip),
      user_agent: _texto(datos.user_agent),
      id_empresa,
      motivo,
      metadata: {
        revisados: recalculo.revisados,
        con_fecha: recalculo.con_fecha,
        liberados: recalculo.liberados,
        sin_fecha: recalculo.sin_fecha,
        acotado_a: recalculo.acotado_a,
      },
    });

    db.prepare(
      'UPDATE gh_firma_fecha_terminacion SET firmas_recalculadas = ? WHERE id = ?'
    ).run(recalculo.con_fecha, registro_id);

    return { registro_id, recalculo };
  })();

  logger.info('Fecha de terminacion registrada', {
    id_empresa,
    actor,
    motivo,
    fecha_terminacion: fecha,
    filas: filas.length,
    filas_con_fecha: sinFecha.length,
    recalculo: resultado.recalculo.con_fecha,
  });

  const registro = db.prepare(
    'SELECT * FROM gh_firma_fecha_terminacion WHERE id = ?'
  ).get(resultado.registro_id);

  return {
    registro,
    filas: {
      encontradas: filas.length,
      con_fecha_registrada: sinFecha.length,
      con_fecha_previa: conFecha.length,
      recalculadas: resultado.recalculo.con_fecha,
    },
    recalculo: resultado.recalculo,
  };
}

/**
 * La REVISIÓN PERIÓDICA: qué filas siguen esperando la fecha de terminación.
 *
 * Son dos grupos, y la diferencia importa:
 *
 *   - `pendientes_de_cese`: la fila está retenida y NO tiene fecha. La Empresa
 *     todavía no ha comunicado el cese.
 *   - `recalculo_pendiente`: la fila tiene la fecha pero sigue retenida sin
 *     fecha de conservación. La fecha llegó y el recálculo no se completó:
 *     hay que volver a correrlo.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.id_empresa] - Limita a una Empresa.
 * @returns {{pendientes_de_cese: object[], recalculo_pendiente: object[]}}
 */
function pendientes(opciones = {}) {
  const id_empresa = _texto(opciones.id_empresa);
  const filtros = [];
  const args = [];
  if (id_empresa) {
    filtros.push('f.id_empresa = ?');
    args.push(id_empresa);
  }
  const donde = filtros.length ? 'AND ' + filtros.join(' AND ') : '';

  const filas = db.prepare(`
    SELECT f.id, f.id_empresa, f.id_solicitud, f.id_trabajador, f.categoria_retencion,
           f.regla_retencion, f.fecha_creacion, f.fecha_terminacion,
           f.fecha_conservacion, f.motivo_hold, f.hold_legal
      FROM gh_firmas_electronicas f
     WHERE f.hold_legal = 1
       AND f.motivo_hold = ?
       ${donde}
     ORDER BY f.id_empresa ASC, f.id ASC
  `).all(MOTIVO_CESE_PENDIENTE, ...args);

  const sinCese = [];
  const conCese = [];
  for (const f of filas) {
    const item = {
      id: f.id,
      id_empresa: f.id_empresa,
      id_solicitud: f.id_solicitud,
      id_trabajador: f.id_trabajador,
      categoria_retencion: f.categoria_retencion,
      regla_retencion: f.regla_retencion,
      fecha_creacion: f.fecha_creacion,
      fecha_terminacion: f.fecha_terminacion,
      fecha_conservacion: f.fecha_conservacion,
      motivo_hold: f.motivo_hold,
    };
    if (f.fecha_terminacion) conCese.push(item);
    else sinCese.push(item);
  }

  return {
    id_empresa: id_empresa,
    pendientes_de_cese: sinCese,
    recalculo_pendiente: conCese,
    mensaje: 'Mientras la fecha no se reciba, la fila permanece retenida, no se calcula '
      + 'fecha de supresion y se revisa periodicamente.',
  };
}

/**
 * Las comunicaciones registradas de una Empresa, con su bitácora.
 *
 * @param {string} id_empresa
 * @returns {object[]}
 */
function comunicaciones(id_empresa) {
  const empresa = _texto(id_empresa);
  if (!empresa) return [];
  const registros = db.prepare(`
    SELECT * FROM gh_firma_fecha_terminacion
     WHERE id_empresa = ?
     ORDER BY id DESC
  `).all(empresa);
  for (const r of registros) {
    r.eventos = db.prepare(`
      SELECT * FROM gh_firma_fecha_terminacion_eventos
       WHERE registro_id = ?
       ORDER BY id ASC
    `).all(r.id);
  }
  return registros;
}

/**
 * Escribe un evento en la bitácora append-only.
 *
 * @param {object} datos
 */
function _evento(datos) {
  db.prepare(`
    INSERT INTO gh_firma_fecha_terminacion_eventos
      (registro_id, evento, fecha_hora, id_actor, ip, user_agent, id_empresa, motivo, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    datos.registro_id,
    datos.evento,
    new Date().toISOString(),
    datos.id_actor,
    datos.ip || null,
    datos.user_agent || null,
    datos.id_empresa,
    datos.motivo || null,
    datos.metadata ? JSON.stringify(datos.metadata) : null
  );
}

module.exports = {
  registrar,
  pendientes,
  comunicaciones,
  EVENTO_REGISTRADA,
  EVENTO_RECALCULO,
  MOTIVO_CESE_PENDIENTE,
};
