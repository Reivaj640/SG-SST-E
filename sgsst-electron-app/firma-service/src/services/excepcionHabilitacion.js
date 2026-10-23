/**
 * EXCEPCIONES DE HABILITACION (D-03, decision B.3)
 * =================================================
 *
 * QUE ES
 * -------
 * La Empresa tiene que estar habilitada para pedir firmas: el Anexo de
 * Encargo firmado (el 1.4) y el canal de PQRS (el 7.2-7.3). Si falta uno de
 * los dos, el sistema BLOQUEA la firma. Ese bloqueo aplica en los cuatro
 * puntos que ordena la respuesta 11A del abogado (23-oct-2026):
 *
 *   (i)   creacion de la solicitud
 *   (ii)  commit
 *   (iii) creacion del consentimiento
 *   (iv)  doble firma
 *
 * QUE NO ES
 * ---------
 * NO es un `if` silencioso. La unica salida del bloqueo es una EXCEPCION con
 * los datos de la autorizacion escrita, y con una bitacora que no se altera.
 * El abogado lo dice textualmente: "La excepcion debe ser un flag auditable,
 * no un if silencioso. Si el flag no existe, se implementa antes de publicar."
 *
 * QUE EXIGE UNA EXCEPCION
 * -----------------------
 * "La excepcion solo procede si cumple todas estas condiciones":
 *
 *   Autorizacion  | Escrita, del owner o representante legal, con fecha y
 *                 | alcance.
 *   Alcance       | Una Empresa y un numero maximo de firmas.
 *   Ruta en papel | Disponible y operativa el mismo dia.
 *   Plazo         | Fecha cierta para firmar el Anexo (maximo 30 dias).
 *   Rastro        | Bitacora inmutable: usuario, fecha, motivo, Empresa,
 *                 | numero de firmas.
 *   Limite        | No se usa para una Empresa nueva sin ningun Anexo, salvo
 *                 | piloto autorizado.
 *
 * LAS SEIS CONDICIONES SE PROGRAMAN
 * ---------------------------------
 * No son un texto que el service lee: son validaciones. `crear()` rechaza una
 * excepcion que no las cumpla, y cada uso queda escrito en la bitacora.
 *
 * POR QUE LA EXCEPCION VENCE
 * --------------------------
 * El plazo maximo son 30 dias. Es el "plazo cierto para firmar el Anexo" del
 * abogado. Pasado ese plazo, la excepcion deja de servir y el bloqueo vuelve
 * a ser total: una excepcion sin termino seria una puerta trasera con otro
 * nombre.
 *
 * LA RELACION CON `gh_firma_eventos`
 * ---------------------------------
 * La bitacora de las excepciones es SUYA (migracion 035) y no depende de
 * `gh_firma_eventos`. Es a proposito: el primer punto de bloqueo (la creacion
 * de la solicitud) ocurre ANTES de que exista la fila de la firma, y esa
 * primera utilizacion de la excepcion tambien tiene que quedar escrita. La
 * bitacora de excepciones es append-only por triggers (migracion 036).
 */
'use strict';

const db = require('../db/connection');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');

/**
 * El plazo maximo de una excepcion: 30 dias.
 *
 * "Plazo | Fecha cierta para firmar el Anexo (maximo 30 dias)". El plazo se
 * cuenta desde la creacion de la excepcion.
 */
const DIAS_PLAZO_MAXIMO = 30;

/** El tope de firmas de una excepcion. Nadie firma mas de esto. */
const ALCANCE_FIRMAS_MAXIMO = 1000;

const EVENTO_CREADA = 'EXCEPCION_CREADA';
const EVENTO_USO = 'EXCEPCION_USADA';
const EVENTO_APLICADA = 'EXCEPCION_APLICADA';
const EVENTO_VENCIDA = 'EXCEPCION_VENCIDA';
const EVENTO_AGOTADA = 'EXCEPCION_AGOTADA';
const EVENTO_CERRADA = 'EXCEPCION_CERRADA';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Normaliza una fecha. Acepta `YYYY-MM-DD` o ISO completo. Devuelve null si
 * no es una fecha utilizable.
 */
function _fecha(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function _texto(valor) {
  return typeof valor === 'string' && valor.trim().length > 0 ? valor.trim() : null;
}

function _error(campo, mensaje, extra) {
  return new AppError(400, 'EXCEPCION_INVALIDA', mensaje,
    Object.assign({ campo }, extra || {}));
}

/**
 * La Empresa tiene el Anexo de Encargo firmado?
 *
 * La consulta va directa a la base y NO pasa por `empresa.js`: este service
 * no puede requerirlo (empresa.js requiere este service) sin ciclo.
 */
function empresaTieneAnexo(id_empresa) {
  try {
    const fila = db.prepare(
      'SELECT anexo_encargo_firmado_at FROM gh_firma_empresas WHERE id_empresa = ?'
    ).get(id_empresa);
    return Boolean(fila && fila.anexo_encargo_firmado_at);
  } catch (e) {
    return false;
  }
}

/**
 * Crea una excepcion. Valida las seis condiciones del abogado.
 *
 * @param {object} opts
 * @param {string} opts.id_empresa - UNA Empresa (el alcance).
 * @param {string} opts.autorizado_por - el owner o el representante legal.
 * @param {string} opts.autorizacion_fecha - la fecha de la autorizacion.
 * @param {string} opts.autorizacion_ref - donde queda el documento escrito.
 * @param {number} opts.alcance_firmas_max - el numero maximo de firmas.
 * @param {string} opts.ruta_papel - como se firma en papel mientras tanto.
 * @param {boolean} opts.ruta_papel_operativa - tiene que estar operativa HOY.
 * @param {string} opts.plazo_hasta - la fecha cierta para firmar el Anexo.
 * @param {boolean} [opts.piloto_autorizado] - para una Empresa sin Anexo.
 * @param {string} [opts.piloto_autorizado_por] - quien autoriza el piloto.
 * @param {string} opts.motivo - por que se pide la excepcion.
 * @param {string} opts.actor - quien la pide (queda en la bitacora).
 * @param {string} [opts.ip]
 * @param {string} [opts.user_agent]
 * @returns {{excepcion: object, evento: object}}
 */
function crear({
  id_empresa,
  autorizado_por,
  autorizacion_fecha,
  autorizacion_ref,
  alcance_firmas_max,
  ruta_papel,
  ruta_papel_operativa,
  plazo_hasta,
  piloto_autorizado = false,
  piloto_autorizado_por = null,
  motivo,
  actor,
  ip = null,
  user_agent = null,
}) {
  // ── La empresa ──────────────────────────────────────────────────────────
  const empresa = _texto(id_empresa);
  if (!empresa) {
    throw _error('id_empresa', 'La excepcion es para UNA Empresa: falta id_empresa.');
  }

  // ── La autorizacion escrita ─────────────────────────────────────────────
  const quienAutoriza = _texto(autorizado_por);
  if (!quienAutoriza) {
    throw _error('autorizado_por',
      'La excepcion exige una autorizacion escrita del owner o del representante legal.');
  }
  const fechaAutorizacion = _fecha(autorizacion_fecha);
  if (!fechaAutorizacion) {
    throw _error('autorizacion_fecha',
      'La autorizacion escrita exige su fecha.');
  }
  const refAutorizacion = _texto(autorizacion_ref);
  if (!refAutorizacion) {
    throw _error('autorizacion_ref',
      'La autorizacion escrita exige su referencia (donde queda el documento).');
  }

  // ── El alcance ──────────────────────────────────────────────────────────
  const max = Number(alcance_firmas_max);
  if (!Number.isInteger(max) || max < 1) {
    throw _error('alcance_firmas_max',
      'El alcance exige un numero maximo de firmas (entero, minimo 1).');
  }
  if (max > ALCANCE_FIRMAS_MAXIMO) {
    throw _error('alcance_firmas_max',
      `El alcance no puede pasar de ${ALCANCE_FIRMAS_MAXIMO} firmas por excepcion.`);
  }

  // ── La ruta en papel ────────────────────────────────────────────────────
  const ruta = _texto(ruta_papel);
  if (!ruta) {
    throw _error('ruta_papel',
      'La excepcion exige la ruta en papel por la que se firma mientras tanto.');
  }
  if (ruta_papel_operativa !== true && ruta_papel_operativa !== 1) {
    throw _error('ruta_papel_operativa',
      'La ruta en papel tiene que estar disponible y operativa el mismo dia.');
  }

  // ── El plazo ────────────────────────────────────────────────────────────
  const ahora = new Date();
  const hasta = _fecha(plazo_hasta);
  if (!hasta) {
    throw _error('plazo_hasta',
      'La excepcion exige una fecha cierta para firmar el Anexo.');
  }
  const limite = new Date(ahora.getTime() + DIAS_PLAZO_MAXIMO * MS_POR_DIA);
  if (new Date(hasta).getTime() <= ahora.getTime()) {
    throw _error('plazo_hasta', 'El plazo de la excepcion tiene que estar en el futuro.');
  }
  if (new Date(hasta).getTime() > limite.getTime()) {
    throw _error('plazo_hasta',
      `El plazo de la excepcion no puede pasar de ${DIAS_PLAZO_MAXIMO} dias `
      + `(limite: ${limite.toISOString()}).`);
  }

  // ── El limite: una Empresa nueva sin ningun Anexo ───────────────────────
  const piloto = piloto_autorizado === true || piloto_autorizado === 1;
  const tieneAnexo = empresaTieneAnexo(empresa);
  if (!tieneAnexo && !piloto) {
    throw _error('piloto_autorizado',
      'Una Empresa sin ningun Anexo de Encargo solo puede usar una excepcion '
      + 'como piloto autorizado.');
  }
  const pilotoPor = _texto(piloto_autorizado_por);
  if (piloto && !pilotoPor) {
    throw _error('piloto_autorizado_por',
      'El piloto autorizado exige quien lo autoriza.');
  }

  // ── El motivo y el actor ────────────────────────────────────────────────
  const porque = _texto(motivo);
  if (!porque) {
    throw _error('motivo', 'La excepcion exige el motivo (queda en la bitacora).');
  }
  const quienPide = _texto(actor) || 'sistema';

  const tx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO gh_firma_excepciones_habilitacion
        (id_empresa, estado, autorizado_por, autorizacion_fecha, autorizacion_ref,
         alcance_firmas_max, firmas_usadas, ruta_papel, ruta_papel_operativa,
         plazo_hasta, piloto_autorizado, piloto_autorizado_por,
         motivo, creada_por, fecha_creacion)
      VALUES (?, 'VIGENTE', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      empresa, quienAutoriza, fechaAutorizacion, refAutorizacion,
      max, ruta, ruta_papel_operativa === true || ruta_papel_operativa === 1 ? 1 : 0,
      hasta, piloto ? 1 : 0, pilotoPor,
      porque, quienPide, ahora.toISOString()
    );
    const id = info.lastInsertRowid;
    const evento = _registrarEvento({
      excepcion_id: id,
      evento: EVENTO_CREADA,
      id_actor: quienPide,
      ip,
      user_agent,
      id_empresa: empresa,
      firmas_usadas: 0,
      motivo: porque,
      metadata: {
        autorizacion_ref: refAutorizacion,
        autorizacion_fecha: fechaAutorizacion,
        autorizado_por: quienAutoriza,
        alcance_firmas_max: max,
        plazo_hasta: hasta,
        ruta_papel: ruta,
        ruta_papel_operativa: true,
        piloto_autorizado: piloto,
        empresa_tiene_anexo: tieneAnexo,
      },
    });
    return { id, evento };
  });

  const { id, evento } = tx();
  const excepcion = db.prepare(
    'SELECT * FROM gh_firma_excepciones_habilitacion WHERE id = ?'
  ).get(id);

  logger.warn('D-03: se creo una excepcion de habilitacion', {
    excepcion_id: id,
    id_empresa: empresa,
    alcance_firmas_max: max,
    plazo_hasta: hasta,
    actor: quienPide,
  });

  return { excepcion, evento };
}

/**
 * Escribe en la bitacora. La bitacora es append-only (triggers, migracion
 * 036): aqui solo se inserta.
 */
function _registrarEvento({
  excepcion_id, evento, id_actor, ip, user_agent,
  id_empresa, firmas_usadas, motivo, metadata,
}) {
  const fecha_hora = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO gh_firma_excepciones_habilitacion_eventos
      (excepcion_id, evento, fecha_hora, id_actor, ip, user_agent,
       id_empresa, firmas_usadas, motivo, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    excepcion_id, evento, fecha_hora, id_actor || 'sistema',
    ip || null, user_agent || null,
    id_empresa, firmas_usadas === undefined ? null : firmas_usadas,
    motivo || null,
    metadata ? JSON.stringify(metadata) : null
  );
  return db.prepare(
    'SELECT * FROM gh_firma_excepciones_habilitacion_eventos WHERE id = ?'
  ).get(info.lastInsertRowid);
}

/**
 * La excepcion vigente para esta Empresa, si la hay.
 *
 * "Vigente" = el plazo no vencio y el estado es VIGENTE.
 *
 * `para_firma` decide si el alcance de firmas ALSO se mira:
 *
 *   para_firma: true   → se busca una excepcion con una firma todavia
 *                       disponible. Es el caso de los puntos que ABREN una
 *                       firma (la creacion de la solicitud y la doble firma):
 *                       ahi la excepcion se gasta.
 *   para_firma: false  → se busca una excepcion que todavia este en plazo,
 *                       aunque ya haya gastado su alcance. Es el caso de los
 *                       puntos que VERIFICAN una firma ya abierta (el commit
 *                       y la creacion del consentimiento): si la excepcion se
 *                       gastó al abrir esa firma, sigue siendo su excepcion
 *                       y el bloqueo tiene que levantarse.
 *
 * Sin esta distincion, una firma consume varias unidades de alcance (una
 * por cada punto por el que pasa) y el "numero maximo de firmas" del abogado
 * no seria un numero de firmas.
 *
 * @param {string} id_empresa
 * @param {object} [opts]
 * @param {Date} [opts.ahora]
 * @param {boolean} [opts.para_firma] - true si el punto abre una firma.
 * @returns {object|null}
 */
function vigentePara(id_empresa, opts = {}) {
  const ahora = opts.ahora || new Date();
  const ahoraIso = ahora.toISOString();
  const para_firma = opts.para_firma === true;
  const candidatas = db.prepare(`
    SELECT * FROM gh_firma_excepciones_habilitacion
     WHERE id_empresa = ? AND estado = 'VIGENTE'
     ORDER BY id DESC
  `).all(id_empresa);

  for (const ex of candidatas) {
    if (new Date(ex.plazo_hasta).getTime() <= new Date(ahoraIso).getTime()) {
      // Se vencio. Queda escrito por una vez: la bitacora no se altera, pero
      // deja de crecer.
      const yaRegistrado = db.prepare(
        'SELECT COUNT(*) AS n FROM gh_firma_excepciones_habilitacion_eventos '
        + 'WHERE excepcion_id = ? AND evento = ?'
      ).get(ex.id, EVENTO_VENCIDA).n;
      if (!yaRegistrado) {
        try {
          _registrarEvento({
            excepcion_id: ex.id,
            evento: EVENTO_VENCIDA,
            id_actor: 'sistema',
            id_empresa: ex.id_empresa,
            firmas_usadas: ex.firmas_usadas,
            motivo: 'El plazo de la excepcion se cumplio',
            metadata: { plazo_hasta: ex.plazo_hasta },
          });
        } catch (e) {
          logger.warn('D-03: no se pudo registrar el vencimiento de la excepcion', {
            excepcion_id: ex.id,
            error: e.message,
          });
        }
      }
      continue;
    }
    if (para_firma && ex.firmas_usadas >= ex.alcance_firmas_max) {
      const yaRegistrado = db.prepare(
        'SELECT COUNT(*) AS n FROM gh_firma_excepciones_habilitacion_eventos '
        + 'WHERE excepcion_id = ? AND evento = ?'
      ).get(ex.id, EVENTO_AGOTADA).n;
      if (!yaRegistrado) {
        try {
          _registrarEvento({
            excepcion_id: ex.id,
            evento: EVENTO_AGOTADA,
            id_actor: 'sistema',
            id_empresa: ex.id_empresa,
            firmas_usadas: ex.firmas_usadas,
            motivo: 'La excepcion agoto su alcance de firmas',
            metadata: { alcance_firmas_max: ex.alcance_firmas_max },
          });
        } catch (e) {
          logger.warn('D-03: no se pudo registrar el agotamiento de la excepcion', {
            excepcion_id: ex.id,
            error: e.message,
          });
        }
      }
      continue;
    }
    return ex;
  }
  return null;
}

/**
 * La excepcion se APLICA en un punto que no abre una firma (el commit, la
 * creacion del consentimiento).
 *
 * El bloqueo se levanta, pero NO se gasta una firma: la excepcion ya se
 * gastó cuando se abrió la firma que se está verificando. Queda escrito igual
 * (quien, cuando, en que punto), para que la bitacora muestre el recorrido
 * completo de la excepcion.
 */
function registrarAplicacion({ excepcion, actor, ip = null, user_agent = null, punto, motivo = null }) {
  const quien = _texto(actor) || 'sistema';
  const evento = _registrarEvento({
    excepcion_id: excepcion.id,
    evento: EVENTO_APLICADA,
    id_actor: quien,
    ip,
    user_agent,
    id_empresa: excepcion.id_empresa,
    firmas_usadas: excepcion.firmas_usadas,
    motivo: motivo || 'El bloqueo se levanto con la excepcion de habilitacion',
    metadata: { punto: punto || 'desconocido' },
  });
  logger.warn('D-03: el bloqueo se levanto con una EXCEPCIÓN de habilitacion', {
    excepcion_id: excepcion.id,
    id_empresa: excepcion.id_empresa,
    punto: punto || 'desconocido',
    firmas_usadas: excepcion.firmas_usadas,
    alcance_firmas_max: excepcion.alcance_firmas_max,
    actor: quien,
  });
  return evento;
}

/**
 * Gasto una firma del alcance de la excepcion y lo dejo escrito.
 *
 * El gasto y el INSERT del evento van en la misma transaccion: o se
 * gastan los dos, o no se gasta ninguno.
 *
 * @param {object} opts
 * @param {object} opts.excepcion - la excepcion vigente.
 * @param {string} opts.actor
 * @param {string} [opts.ip]
 * @param {string} [opts.user_agent]
 * @param {string} opts.punto - donde se uso (creacion, commit, ...).
 * @param {string} [opts.motivo]
 * @returns {object} la excepcion con el contador ya descontado.
 */
function registrarUso({ excepcion, actor, ip = null, user_agent = null, punto, motivo = null }) {
  const quien = _texto(actor) || 'sistema';
  const tx = db.transaction(() => {
    const info = db.prepare(`
      UPDATE gh_firma_excepciones_habilitacion
         SET firmas_usadas = firmas_usadas + 1
       WHERE id = ? AND estado = 'VIGENTE' AND firmas_usadas < alcance_firmas_max
    `).run(excepcion.id);
    if (info.changes === 0) {
      throw new AppError(409, 'EXCEPCION_NO_VIGENTE',
        'La excepcion de habilitacion ya no esta vigente',
        { excepcion_id: excepcion.id });
    }
    const actualizada = db.prepare(
      'SELECT * FROM gh_firma_excepciones_habilitacion WHERE id = ?'
    ).get(excepcion.id);
    _registrarEvento({
      excepcion_id: excepcion.id,
      evento: EVENTO_USO,
      id_actor: quien,
      ip,
      user_agent,
      id_empresa: actualizada.id_empresa,
      firmas_usadas: actualizada.firmas_usadas,
      motivo: motivo || 'Se uso la excepcion de habilitacion',
      metadata: { punto: punto || 'desconocido' },
    });
    return actualizada;
  });

  const actualizada = tx();
  logger.warn('D-03: la firma se hizo con excepcion de habilitacion', {
    excepcion_id: excepcion.id,
    id_empresa: excepcion.id_empresa,
    punto: punto || 'desconocido',
    firmas_usadas: actualizada.firmas_usadas,
    alcance_firmas_max: actualizada.alcance_firmas_max,
    actor: quien,
  });
  return actualizada;
}

/**
 * Cierra una excepcion (a mano). La bitacora no se altera: se escribe el
 * cierre.
 */
function cerrar({ id, actor, motivo, ip = null, user_agent = null }) {
  const excepcion = db.prepare(
    'SELECT * FROM gh_firma_excepciones_habilitacion WHERE id = ?'
  ).get(id);
  if (!excepcion) {
    throw new AppError(404, 'NOT_FOUND', 'La excepcion no existe');
  }
  const quien = _texto(actor) || 'sistema';
  const porque = _texto(motivo) || 'Cierre manual';
  const ahora = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE gh_firma_excepciones_habilitacion
         SET estado = 'CERRADA', cerrada_at = ?, cerrada_por = ?, cierre_motivo = ?
       WHERE id = ?
    `).run(ahora, quien, porque, id);
    return _registrarEvento({
      excepcion_id: id,
      evento: EVENTO_CERRADA,
      id_actor: quien,
      ip,
      user_agent,
      id_empresa: excepcion.id_empresa,
      firmas_usadas: excepcion.firmas_usadas,
      motivo: porque,
      metadata: null,
    });
  });
  const evento = tx();
  return {
    excepcion: db.prepare(
      'SELECT * FROM gh_firma_excepciones_habilitacion WHERE id = ?'
    ).get(id),
    evento,
  };
}

/** Las excepciones de una Empresa (o todas). */
function listar({ id_empresa = null } = {}) {
  if (id_empresa) {
    return db.prepare(`
      SELECT * FROM gh_firma_excepciones_habilitacion
       WHERE id_empresa = ? ORDER BY id DESC
    `).all(id_empresa);
  }
  return db.prepare(
    'SELECT * FROM gh_firma_excepciones_habilitacion ORDER BY id DESC'
  ).all();
}

/** La bitacora de una excepcion. */
function eventosDe(excepcion_id) {
  return db.prepare(`
    SELECT * FROM gh_firma_excepciones_habilitacion_eventos
     WHERE excepcion_id = ? ORDER BY id ASC
  `).all(excepcion_id);
}

module.exports = {
  DIAS_PLAZO_MAXIMO,
  ALCANCE_FIRMAS_MAXIMO,
  crear,
  vigentePara,
  registrarUso,
  registrarAplicacion,
  cerrar,
  listar,
  eventosDe,
  empresaTieneAnexo,
};
