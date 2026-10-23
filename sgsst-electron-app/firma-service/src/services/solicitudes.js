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
 *
 * LA COPIA PERMANENTE (el 8.5): UN PLAZO QUE NO ES ESTE
 * ---------------------------------------------------
 * El 8.5 del texto final aprobado por el abogado dice:
 *
 *   "8.5. El Trabajador puede solicitar en cualquier momento una copia
 *    permanente del contrato firmado, sus anexos, modificaciones y la
 *    Constancia. La Empresa la entrega por el medio autorizado, sin costo,
 *    dentro de los cinco (5) días hábiles siguientes. La copia se conserva
 *    aunque el enlace haya expirado; la descarga desde el enlace es una
 *    cortesía y no sustituye este derecho."
 *
 * Son DOS relojes y NO SE CONFUNDEN:
 *
 *   - `plazoTramiteDias` (2 días hábiles) = cuándo K+AIR TRASMITE la
 *     solicitud a la Empresa. Deudor: K+AIR, el Encargado (10.7(b)).
 *   - `plazoCopiaDias` (5 días hábiles)   = cuándo la EMPRESA ENTREGA la
 *     copia permanente. Deudor: la Empresa, la Responsable (8.5).
 *
 * El de la copia se registra en `plazo_copia` al RECEPIR la solicitud y NO se
 * recalcula: es la fecha límite que se le ofreció al Titular, y moverla sería
 * cambiarle un plazo ya comunicado.
 *
 * POR QUÉ UNA COPIA NO SE CIERRA POR VÍNCULO EXPIRADO
 * ---------------------------------------------------
 * El 8.5 dice que "la copia se conserva aunque el enlace haya expirado". O
 * sea: el vencimiento del enlace de firma NO es un motivo para dar por
 * atendida una solicitud de copia. Por eso la única salida de "pendiente" es
 * la respuesta de la Empresa (`responder`), y para una COPIA esa respuesta
 * exige la declaración de que la solicitud fue ATENDIDA (`copia_atendida`).
 * No hay ninguna otra puerta: no hay expiración, no hay cierre automático.
 *
 * Y una copia pendiente FRENA la supresión (el 8.6(e)(iii) y el 8.6(f)): lo
 * consulta `tieneCopiaPendiente`, que usan la conservación y la supresión.
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
  // El 8.5: la copia permanente del contrato firmado, sus anexos,
  // modificaciones y la Constancia. La v1.0 (publicada) ya decía que el
  // Trabajador tiene derecho a obtenerla "en cualquier momento y sin costo";
  // el texto final aprobado le pone el plazo de cinco (5) días hábiles y la
  // regla de que la copia se conserva aunque el enlace haya expirado.
  'COPIA',
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
 * Una fecha ISO, legible para una persona.
 *
 * Se usa para el mensaje al Titular: el plazo del 8.5 tiene que poder LEERSE,
 * no solo machine-checkearse.
 *
 * OJO: el DÍA es el local, no el de UTC. `_sumarDiasHabiles` cuenta en días
 * del calendario local, así que si el mensaje dijera el día UTC, un registro
 * hecho de noche mostraría el día siguiente (el plazo que se le dice al
 * Titular tiene que ser el mismo que se le guardó).
 *
 * @param {string|null} iso
 * @returns {string} YYYY-MM-DD, o el valor original si no se puede leer
 */
function _fechaLegible(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
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

  // El 8.5: la fecha límite de ENTREGA de la copia permanente. Es OTRO reloj
  // (la respuesta de la Empresa, no la trasmisión de K+AIR) y se calcula una
  // sola vez, al registrar: es la fecha que se le comunica al Titular.
  const esCopia = tipo === 'COPIA';
  const plazoCopia = esCopia
    ? _sumarDiasHabiles(ahora, config.plazoCopiaDias).toISOString()
    : null;

  const id = db.transaction(() => {
    const res = db.prepare(`
      INSERT INTO gh_solicitudes_titular
        (folio, fecha_registro, canal, tipo, solicitante_nombre, solicitante_correo,
         solicitante_documento_hash, contenido, estado, id_empresa, canal_empresa,
         plazo_tramite, plazo_copia, creado_por, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RECIBIDA', ?, ?, ?, ?, ?, ?, ?)
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
      plazoCopia,
      _texto(datos.creado_por, 100) || 'titular',
      _texto(datos.ip, 64),
      _texto(datos.user_agent, 300)
    );
    const nuevoId = Number(res.lastInsertRowid);
    _evento(nuevoId, 'SOLICITUD_RECIBIDA', datos.creado_por || 'titular', {
      folio,
      tipo,
      plazo_tramite: plazo.toISOString(),
      plazo_copia: plazoCopia,
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
    // El 8.5: el plazo de entrega de la copia, cuando la solicitud es de copia.
    plazo_copia: plazoCopia,
    mensaje: esCopia
      ? 'Recibimos tu solicitud de copia permanente. K+AIR la registró y la va a '
        + 'trasmitir a la Empresa, que es quien debe entregarla por el medio '
        + 'que autorizaste, sin costo, dentro de los ' + config.plazoCopiaDias
        + ' días hábiles siguientes (hasta el ' + _fechaLegible(plazoCopia) + '). '
        + 'La copia se conserva aunque el enlace de firma haya expirado: '
        + 'descargarla del enlace es una cortesía, no el derecho. Puedes preguntar '
        + 'por ella con el folio ' + folio + '.'
      : 'Recibimos tu solicitud. K+AIR la registró y la va a trasmitir a la '
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
 * UNA COPIA SOLO SE CIERRA DECLARANDO QUE FUE ATENDIDA
 * ---------------------------------------------------
 * El 8.5: "La copia se conserva aunque el enlace haya expirado; la descarga
 * desde el enlace es una cortesía y no sustituye este derecho." Y el 8.6(f):
 * "La solicitud se registra y se atiende antes de cualquier supresión."
 *
 * Por eso una solicitud de tipo COPIA NO se puede cerrar como si el vínculo
 * hubiera expirado: la única salida de "pendiente" es la respuesta de la
 * Empresa, y esa respuesta tiene que declarar que la solicitud fue ATENDIDA
 * (`copia_atendida: true`). Sin esa declaración la solicitud sigue pendiente,
 * y pendiente significa que la supresión no procede (8.6(e)(iii)).
 *
 * Quien declara es la Empresa, que es la Responsable: el sistema registra lo
 * que la Responsable declara, no lo que puede verificar por sí mismo (la
 * entrega es por un medio autorizado que el sistema no controla).
 *
 * @param {number} id
 * @param {object} datos
 * @param {string} datos.actor
 * @param {string} datos.respuesta
 * @param {object} [datos.evidencia]
 * @param {boolean} [datos.copia_atendida] - obligatorio si la solicitud es COPIA
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
  if (actual.tipo === 'COPIA' && datos.copia_atendida !== true) {
    throw new AppError(409, 'COPIA_NO_ATENDIDA',
      'Una solicitud de copia no se cierra sin declarar que fue atendida: la '
      + 'copia se conserva aunque el enlace haya expirado (8.5) y se atiende '
      + 'antes de cualquier supresión (8.6(f)).',
      { estado: actual.estado, folio: actual.folio });
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
      // La declaración de la Empresa de que la copia fue atendida (8.5/8.6(f)).
      copia_atendida: actual.tipo === 'COPIA' ? true : undefined,
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

// ===========================================================================
// LA COPIA PENDIENTE FRENA LA SUPRESIÓN (el 8.6(e)(iii) y el 8.6(f))
// ===========================================================================
//
// EL TEXTO
// --------
// 8.6(e): "La supresión procede solo cuando concurren: (i) vencimiento del
// plazo aplicable; (ii) ausencia de deber legal o contractual de conservación;
// (iii) ausencia de solicitud de copia pendiente; y (iv) ausencia de hold
// vigente."
//
// 8.6(f): "La solicitud se registra y se atiende antes de cualquier supresión."
//
// POR QUÉ SE CRUZA POR EMPRESA Y NO POR TITULAR
// ---------------------------------------------
// Las dos tablas no se cruzan por el documento del Titular, y no es un descuido:
//
//   - `gh_solicitudes_titular.solicitante_documento_hash` es el SHA-256 del
//     documento (el 10.5(a): huella, nunca en claro).
//   - `gh_firmas_electronicas.id_trabajador` es el SEUDÓNIMO del trabajador:
//     un HMAC con el ÁMBITO de la Empresa (ver src/services/trabajador.js).
//
// Son dos funciones distintas del mismo dato, con amplitudes distintas: el
// seudónimo NO se puede calcular sin saber la Empresa, y el sha256 no se
// puede comparar con el HMAC. Cruzar por el hash "funcionaría" solo para las
// filas cuyo hash previo coincide (las no saladas) y fallaría en silencio
// para las demás: un cruce frágil que a veces no bloquea.
//
// Por eso el cruce es POR EMPRESA: mientras esa Empresa tenga una solicitud
// de copia PENDIENTE, ninguna de sus firmas vencidas es elegible. Es la misma
// granularidad del hold de deber legal (migración 030), que también frena a
// nivel de empresa: aquí se conserva de más, que es el lado correcto en el que
// equivocarse.
//
// LIMITACIÓN CONOCIDA
// -------------------
// Una COPIA registrada por el canal público todavía NO tiene `id_empresa`: se
// lo asigna K+AIR al trasmitirla a la Empresa. Entre el registro y la
// trasmisión (el plazo de trasmisión del 10.7(b)), el bloqueo no aplica a
// ninguna empresa, porque no hay a cuál atribuírselo. Queda como deuda
// abierta: hace falta un camino que ate la solicitud al Titular antes de
// que laEmpresa la transmita.
//
// QUÉ ESTADOS SON "PENDIENTE"
// ---------------------------
// Todo estado que no sea RESPONDIDA ni CERRADA. La lista es abierta a
// propósito: un estado nuevo que nadiePensó sigue contando como pendiente,
// y pendiente es lo que FRENA la supresión.

/**
 * ¿Esta Empresa tiene alguna solicitud de COPIA pendiente?
 *
 * @param {string|null} id_empresa
 * @returns {boolean}
 */
function tieneCopiaPendiente(id_empresa) {
  if (!id_empresa) return false;
  const row = db.prepare(`
    SELECT COUNT(*) AS n
      FROM gh_solicitudes_titular
     WHERE tipo = 'COPIA'
       AND id_empresa = ?
       AND estado NOT IN ('RESPONDIDA', 'CERRADA')
  `).get(String(id_empresa));
  return Number(row && row.n) > 0;
}

/**
 * Las Empresas que tienen alguna solicitud de COPIA pendiente.
 *
 * Es la versión de conjunto de `tieneCopiaPendiente`: una sola consulta para
 * todo un lote, en vez de una por firma.
 *
 * @returns {Set<string>}
 */
function empresasConCopiaPendiente() {
  const filas = db.prepare(`
    SELECT DISTINCT id_empresa
      FROM gh_solicitudes_titular
     WHERE tipo = 'COPIA'
       AND id_empresa IS NOT NULL
       AND estado NOT IN ('RESPONDIDA', 'CERRADA')
  `).all();
  const salida = new Set();
  for (const f of filas) {
    if (f.id_empresa) salida.add(String(f.id_empresa));
  }
  return salida;
}

/**
 * La proyección de una fila para la respuesta: además de la fila, lo que el
 * operador tiene que ver de una solicitud de COPIA (el plazo del 8.5 y si
 * sigue pendiente).
 *
 * @param {object} fila
 * @returns {object}
 */
function _decorar(fila) {
  if (!fila) return fila;
  const salida = { ...fila, evidencia: _json(fila.evidencia) };
  if (fila.tipo === 'COPIA') {
    salida.copia = {
      plazo_copia: fila.plazo_copia || null,
      plazo_dias_habiles: config.plazoCopiaDias,
      // El 8.5: la copia se conserva aunque el enlace haya expirado. Por eso
      // lo único que deja de estar pendiente es la respuesta de la Empresa.
      pendiente: fila.estado !== 'RESPONDIDA' && fila.estado !== 'CERRADA',
      se_entrega_por: 'medio electronico autorizado por el Trabajador (8.2)',
    };
  }
  return salida;
}

function obtener(id) {
  const fila = _fila(id);
  if (!fila) return null;
  return _decorar(fila);
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
    ).all(String(filtros.estado), limite).map(_decorar);
  }
  return db.prepare(
    'SELECT * FROM gh_solicitudes_titular ORDER BY id DESC LIMIT ?'
  ).all(limite).map(_decorar);
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
  tieneCopiaPendiente,
  empresasConCopiaPendiente,
  _sumarDiasHabiles,
};
