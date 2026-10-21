/**
 * SOLICITUDES DE LOS TITULARES (el 10.7(b) del Acuerdo)
 * ======================================================
 *
 * QUÉ ES ESTO
 * -----------
 * El numeral 10.7(b) del Acuerdo, en su redacción nueva, dice que K+AIR,
 * como Encargado del Tratamiento, "también atiende las solicitudes de los
 * Titulares que le sean dirigidas", que designa "una persona o área que asuma
 * la función de protección de datos personales", que "mantiene a disposición de
 * los Titulares un mecanismo sencillo, ágil y permanentemente disponible", que
 * "registra toda solicitud que recibe", que "la remite a la Empresa dentro de
 * los dos (2) días hábiles siguientes a su recepción, con la evidencia que
 * reposa en su custodia" y que "informa al Titular sobre el estado de su
 * solicitud".
 *
 * Ese numeral no es un texto: es un REGISTRO. Este módulo es ese registro.
 *
 * QUÉ HACE K+AIR Y QUÉ NO
 * -----------------------
 *   - K+AIR RECIBE, REGISTRA, TRASMITE Y DA CONSTANCIA.
 *   - K+AIR NO RESUELVE: la respuesta es de la Empresa, que es la
 *     Responsable del Tratamiento (10.7 literal d).
 *
 * El flujo, en tres pasos (los estados de la tabla):
 *
 *   1. RECIBIDA   → el Titular exerce su derecho por el canal de K+AIR.
 *                    Se registra con un folio y un plazo de trasmisión.
 *   2. TRASMITIDA → K+AIR lo remite a la Empresa (por el canal de la
 *                    Empresa, `canal_pqrs`) y lo pone en su radar.
 *   3. RESPONDIDA → la Empresa, que es la Responsable, responde; K+AIR
 *                    devuelve la respuesta al Titular y archiva la evidencia.
 *
 * POR QUÉ NO CUELGA DE LA FIRMA
 * -----------------------------
 * Porque la 5B (la supresión de datos personales) solo borra lo que cuelga
 * de `gh_firmas_electronicas`. Una solicitud de derechos no es de una firma:
 * es del Titular, y puede seguir viva después de que su firma se suprima.
 * Por eso su historial tiene triggers append-only (migración 029).
 *
 * EL PLAZO
 * ---------
 * Los dos (2) días hábiles son de la POLÍTICA, no del código: viven en
 * `FIRMA_PLAZO_TRAMITE_DIAS`. Si el abogado pone otro número, se cambia la
 * variable de entorno, no este archivo. El plazo se calcula en días hábiles
 * (no se cuenta el fin de semana).
 */
'use strict';

const crypto = require('crypto');
const db = require('../db/connection');
const config = require('../config');
const logger = require('../utils/logger');
const { sha256 } = require('../crypto/hash');
const { AppError } = require('../middleware/errors');

/** Los derechos que el Titular puede ejercer (10.7(a)). */
const TIPOS = Object.freeze([
  'ACCESO',
  'CORRECCION',
  'RECTIFICACION',
  'SUPRESION',
  'REVOCACION',
  'RECLAMO',
  'OTRO',
]);

const ESTADOS = Object.freeze(['RECIBIDA', 'TRASMITIDA', 'RESPONDIDA', 'CERRADA']);

/**
 * El folio: lo que el Titular usa para preguntar por su solicitud.
 * legible, único y no dice nada del contenido.
 */
function _folio() {
  const dia = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return 'SOL-' + dia + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Suma días HÁBILES a una fecha. El sábado y el domingo no cuentan: un
 * plazo de "dos días hábiles" que se cumpliera en sábado no se cumplía.
 *
 * @param {Date} base
 * @param {number} dias
 * @returns {Date}
 */
function _sumarDiasHabiles(base, dias) {
  const d = new Date(base.getTime());
  let restantes = Math.max(0, Number(dias) || 0);
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) restantes--;
  }
  return d;
}

/**
 * Registra un evento en el historial. El historial es append-only (triggers
 * de la migración 029) y NO cuelga de ninguna firma.
 */
function _evento(solicitud_id, evento, actor, metadata) {
  db.prepare(`
    INSERT INTO gh_solicitudes_titular_eventos
      (solicitud_id, evento, fecha_hora, id_actor, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    solicitud_id,
    evento,
    new Date().toISOString(),
    String(actor || 'sistema'),
    metadata ? JSON.stringify(metadata) : null
  );
}

function _normalizarTipo(tipo) {
  const t = String(tipo || '').trim().toUpperCase();
  if (!TIPOS.includes(t)) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'El tipo de solicitud no es válido',
      { tipos: TIPOS });
  }
  return t;
}

function _texto(valor, max) {
  if (valor === undefined || valor === null) return null;
  const s = String(valor).trim();
  if (s.length === 0) return null;
  return s.slice(0, max);
}

/**
 * REGISTRA la solicitud de un Titular.
 *
 * @param {object} datos
 * @param {string} datos.tipo - ACCESO | CORRECCION | ... (10.7(a))
 * @param {string} [datos.nombre]
 * @param {string} [datos.correo] - a dónde se contesta
 * @param {string} [datos.documento] - su documento: se guarda como HUELLA
 *   (el principio es el mismo de la 10.5(a) para el Trabajador)
 * @param {string} [datos.contenido] - lo que cuenta
 * @param {string} [datos.canal] - por dónde llegó
 * @param {string} [datos.id_empresa] - a quién se trasmite
 * @param {string} [datos.canal_empresa]
 * @param {string} [datos.creado_por]
 * @param {string} [datos.ip]
 * @param {string} [datos.user_agent]
 * @returns {{folio, plazo_tramite, mensaje, estado}}
 */
function registrar(datos = {}) {
  const tipo = _normalizarTipo(datos.tipo);
  const correo = _texto(datos.correo, 254);
  const nombre = _texto(datos.nombre, 200);
  const contenido = _texto(datos.contenido, 4000);
  const documento = _texto(datos.documento, 64);

  if (!correo) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'Se necesita un correo para responder la solicitud');
  }
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(correo)) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'El correo no parece válido');
  }

  const ahora = new Date();
  const plazo = _sumarDiasHabiles(ahora, config.plazoTramiteDias);
  const folio = _folio();

  const id = db.transaction(() => {
    const res = db.prepare(`
      INSERT INTO gh_solicitudes_titular
        (folio, fecha_registro, canal, tipo, solicitante_nombre, solicitante_correo,
         solicitante_documento_hash, contenido, estado, id_empresa, canal_empresa,
         plazo_tramite, creado_por, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RECIBIDA', ?, ?, ?, ?, ?, ?)
    `).run(
      folio,
      ahora.toISOString(),
      _texto(datos.canal, 120) || config.canalProteccionDatos,
      tipo,
      nombre,
      correo,
      // El documento se guarda como huella: no es el dato del Titular lo que
      // se necesita para atender la solicitud.
      documento ? sha256(documento) : null,
      contenido,
      _texto(datos.id_empresa, 64),
      _texto(datos.canal_empresa, 300),
      plazo.toISOString(),
      _texto(datos.creado_por, 100) || 'titular',
      _texto(datos.ip, 64),
      _texto(datos.user_agent, 300)
    );
    const nuevoId = Number(res.lastInsertRowid);
    _evento(nuevoId, 'SOLICITUD_RECIBIDA', datos.creado_por || 'titular', {
      folio,
      tipo,
      plazo_tramite: plazo.toISOString(),
    });
    return nuevoId;
  })();

  logger.info('Solicitud de titular registrada', {
    solicitud_id: id, folio, tipo, estado: 'RECIBIDA',
  });

  return {
    folio,
    id_solicitud: id,
    estado: 'RECIBIDA',
    plazo_tramite: plazo.toISOString(),
    mensaje:
      'Recibimos tu solicitud. K+AIR la registró y la va a trasmitir a la '
      + 'Empresa, que es quien debe responder. Puedes preguntar por ella con '
      + 'el folio ' + folio + '.',
  };
}

/**
 * TRASMITE la solicitud a la Empresa (la Responsable).
 *
 * @param {number} id
 * @param {object} datos
 * @param {string} datos.actor - quién hace el traspaso
 * @param {string} [datos.id_empresa]
 * @param {string} [datos.canal_empresa] - por dónde se trasmite
 * @param {object} [datos.evidencia] - lo que K+AIR entrega (constancias, etc.)
 * @returns {object} la solicitud actualizada
 */
function trasmitir(id, datos = {}) {
  const actor = _texto(datos.actor, 100);
  if (!actor) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'El traspaso necesita un actor');
  }
  const actual = _fila(id);
  if (!actual) {
    throw new AppError(404, 'SOLICITUD_NOT_FOUND', 'La solicitud no existe');
  }
  if (actual.estado === 'RESPONDIDA' || actual.estado === 'CERRADA') {
    throw new AppError(409, 'SOLICITUD_ESTADO_INVALIDO',
      'La solicitud ya tiene respuesta: no se trasmite otra vez',
      { estado: actual.estado });
  }

  const ahora = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`
      UPDATE gh_solicitudes_titular
      SET estado = 'TRASMITIDA',
          id_empresa = COALESCE(?, id_empresa),
          canal_empresa = COALESCE(?, canal_empresa),
          trasmitida_at = ?,
          evidencia = COALESCE(?, evidencia)
      WHERE id = ?
    `).run(
      _texto(datos.id_empresa, 64),
      _texto(datos.canal_empresa, 300),
      ahora,
      datos.evidencia ? JSON.stringify(datos.evidencia) : null,
      id
    );
    _evento(id, 'SOLICITUD_TRASMITIDA', actor, {
      id_empresa: _texto(datos.id_empresa, 64),
      canal_empresa: _texto(datos.canal_empresa, 300),
      evidencia: datos.evidencia ? Object.keys(datos.evidencia) : null,
    });
  })();

  logger.info('Solicitud de titular trasmitida a la Empresa', {
    solicitud_id: id, folio: actual.folio, actor,
  });
  return obtener(id);
}

/**
 * Registra la respuesta de la Empresa (la Responsable) y la devuelve al
 * Titular.
 *
 * @param {number} id
 * @param {object} datos
 * @param {string} datos.actor
 * @param {string} datos.respuesta
 * @param {object} [datos.evidencia]
 * @returns {object}
 */
function responder(id, datos = {}) {
  const actor = _texto(datos.actor, 100);
  const respuesta = _texto(datos.respuesta, 8000);
  if (!actor) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'La respuesta necesita un actor');
  }
  if (!respuesta) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'La respuesta no puede ir vacía');
  }
  const actual = _fila(id);
  if (!actual) {
    throw new AppError(404, 'SOLICITUD_NOT_FOUND', 'La solicitud no existe');
  }

  const ahora = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`
      UPDATE gh_solicitudes_titular
      SET estado = 'RESPONDIDA', respondida_at = ?, respuesta = ?,
          evidencia = COALESCE(?, evidencia)
      WHERE id = ?
    `).run(
      ahora,
      respuesta,
      datos.evidencia ? JSON.stringify(datos.evidencia) : null,
      id
    );
    _evento(id, 'SOLICITUD_RESPONDIDA', actor, {
      respondida_at: ahora,
      evidencia: datos.evidencia ? Object.keys(datos.evidencia) : null,
    });
  })();

  logger.info('Solicitud de titular respondida', {
    solicitud_id: id, folio: actual.folio, actor,
  });
  return obtener(id);
}

function _fila(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  return db.prepare('SELECT * FROM gh_solicitudes_titular WHERE id = ?').get(n) || null;
}

function obtener(id) {
  const fila = _fila(id);
  if (!fila) return null;
  return {
    ...fila,
    evidencia: _json(fila.evidencia),
  };
}

function porFolio(folio) {
  if (!folio) return null;
  return db.prepare('SELECT * FROM gh_solicitudes_titular WHERE folio = ?').get(String(folio)) || null;
}

/**
 * Lista las solicitudes. Sin `estado`, devuelve todas.
 *
 * @param {object} [filtros]
 * @param {string} [filtros.estado]
 * @param {number} [filtros.limit]
 * @returns {Array<object>}
 */
function listar(filtros = {}) {
  const limite = Math.min(Math.max(Number(filtros.limit) || 100, 1), 500);
  if (filtros.estado) {
    return db.prepare(
      'SELECT * FROM gh_solicitudes_titular WHERE estado = ? ORDER BY id DESC LIMIT ?'
    ).all(String(filtros.estado), limite).map((f) => ({ ...f, evidencia: _json(f.evidencia) }));
  }
  return db.prepare(
    'SELECT * FROM gh_solicitudes_titular ORDER BY id DESC LIMIT ?'
  ).all(limite).map((f) => ({ ...f, evidencia: _json(f.evidencia) }));
}

/** El historial de una solicitud. */
function eventos(id) {
  return db.prepare(
    'SELECT * FROM gh_solicitudes_titular_eventos WHERE solicitud_id = ? ORDER BY id ASC'
  ).all(id).map((e) => ({ ...e, metadata: _json(e.metadata) }));
}

function _json(valor) {
  if (!valor) return null;
  try { return JSON.parse(valor); } catch (e) { return null; }
}

module.exports = {
  TIPOS,
  ESTADOS,
  registrar,
  trasmitir,
  responder,
  obtener,
  porFolio,
  listar,
  eventos,
  _sumarDiasHabiles,
};
