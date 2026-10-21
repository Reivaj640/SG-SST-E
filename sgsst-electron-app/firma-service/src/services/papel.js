/**
 * LA FIRMA AUTOGRÁFICA SOBRE SOPORTE PAPEL (la 9A, el 7.1-7.3)
 * ==============================================================
 *
 * QUÉ PROMETE EL ACUERDO
 * ----------------------
 * El Capítulo VII del Acuerdo de uso dice:
 *
 *   7.1. De conformidad con el artículo 2.2.1.1.11 del Decreto 1072 de 2015,
 *        la Empresa debe proveer al Trabajador de los medios necesarios para
 *        el uso de la firma electrónica...
 *
 *   7.2. El Trabajador tiene derecho a que la Empresa le provea la firma de
 *        forma autográfica, sobre soporte papel, en todo momento y sin costo
 *        alguno, y a que el documento así firmado tenga la misma validez y
 *        efectos que el firmado electrónicamente.
 *
 *   7.3. La imposibilidad de firmar electrónicamente un documento no será una
 *        barrera de acceso al empleo, no habilitará a la Empresa para iniciar
 *        procedimiento disciplinario alguno por el solo hecho de que el
 *        Trabajador no utilice este mecanismo, y no será causa de terminación
 *        de la relación laboral.
 *
 * POR QUÉ IMPORTA CÓDIGO Y NO SOLO TEXTO
 * -------------------------------------
 * El 2.2.1.1.11 (y el 7.3) dicen que la imposibilidad de firmar
 * electrónicamente NO puede ser una barrera de acceso al empleo. Una
 * declaración de principios no es una salida: para que el Trabajador pueda
 * Exercise ese derecho tiene que existir un CAMINO. Y ese camino es lo que
 * hace posible encender el rechazo del D-02 (el que exige un medio personal
 * para el código de verificación): sin salida en papel, exigir un medio
 * personal sería una barrera de acceso al empleo.
 *
 * EL CAMINO, PASO A PASO
 * ----------------------
 *   1. El Trabajador le PIDE a su Empresa la firma en papel (por el canal que
  *      la Empresa tenga: el de atención, el de PQRS, el que le muestre el
  *      Acuerdo). La mini-app NO menciona el papel: el 7.2 es un DERECHO DE LA
  *      EMPRESA hacia el Trabajador, y el producto no puede prometer en nombre
  *      de la Empresa lo que la Empresa hará (veracidad, Ley 1581 art. 4(d)(e),
  *      D.1377 art. 4).
 *      → Se crea la fila en `gh_firma_firmas_papel` (estado SOLICITADO), se
 *        registra el evento `PAPER_TRACK_OPENED` (con el canal por el que llegó
 *        la petición) y, cuando se registra el documento firmado, la vía
 *        electrónica de esa solicitud queda cerrada (estado CANCELLED, con el
 *        evento que explica por qué).
 *
 *   2. La Empresa entrega el documento en papel. El Trabajador lo firma.
 *
 *   3. La Empresa registra el documento ya firmado (desde K+AIR, con el
 *      PDF escaneado): `POST /internal/sign-requests/:id/firma-papel`.
 *      → Se guarda el PDF, se calcula su huella, se genera el "Registro de
 *        firma autográfica" (la evidencia del acto) y se le entrega la copia
 *        al Trabajador por un medio autorizado.
 *
 * POR QUÉ UNA TABLA PROPIA Y NO UN ESTADO NUEVO
 * ---------------------------------------------
 * La columna `estado` de `gh_firmas_electronicas` tiene un CHECK que en
 * SQLite no se puede alterar sin reconstruir la tabla. Y la firma
 * autográfica no ES un estado de la firma electrónica: es otro acto, con su
 * propia fecha, su propio documento y su propia evidencia. Por eso vive en
 * su propia tabla, y la vía electrónica queda en CANCELLED con el evento que
 * cuenta la historia.
 *
 * Tests: tests/n9a-medios-y-papel.test.js
 */
'use strict';

const db = require('../db/connection');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');

/**
 * Los estados de la vía en papel.
 * @type {Readonly<Record<string, string>>}
 */
const ESTADOS = Object.freeze({
  SOLICITADO: 'SOLICITADO',
  ENTREGADO: 'ENTREGADO',
  FIRMADO: 'FIRMADO',
});

/**
 * Los estados en los que la vía electrónica todavía puede pedir el papel.
 * Si ya se firmó, no: el papel es para lo que todavía no se firmó.
 */
const ESTADOS_ELECTRONICOS_VIGENTES = [
  'PENDING', 'OPENED', 'IDENTIFICATION_STARTED', 'IDENTIFIED',
  'OTP_SENT', 'OTP_VERIFIED', 'DOCUMENT_OPENED', 'DOCUMENT_VIEWED',
  'MANIFESTATION_RECORDED',
];

/**
 * Abre la vía en papel de una solicitud.
 *
 * La abre la EMPRESA (el actor por defecto es `empresa`), no el Trabajador:
 * el Trabajador pide el papel por el canal de la Empresa y la Empresa lo
 * registra. El asiento guarda el canal por el que llegó la petición, que es
 * la evidencia de que la vía existía y era accesible.
 *
 * @param {object} fila - la fila de gh_firmas_electronicas
 * @param {object} [opts]
 * @param {string} [opts.actor] - quién lo pidió (por defecto, 'trabajador')
 * @param {string} [opts.ip]
 * @param {string} [opts.user_agent]
 * @param {string} [opts.motivo] - el motivo que declara el Trabajador
 * @param {function} [opts.registerEvent] - el registrador de eventos
 * @returns {object} la fila creada
 */
function abrir(fila, opts) {
  const opciones = opts || {};
  const actor = opciones.actor || 'empresa';

  // El papel es para lo que TODAVÍA no se ha firmado: si la firma
  // electrónica ya salió, el documento firmado a mano sería un documento
  // distinto (y sin la vínculo con el que se envíó a firma).
  if (ESTADOS_ELECTRONICOS_VIGENTES.indexOf(fila.estado) === -1) {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      'Esta solicitud ya no está en una etapa en la que pueda registrarse '
      + 'una firma en papel', { current_state: fila.estado });
  }

  const existente = db.prepare(
    'SELECT * FROM gh_firma_firmas_papel WHERE firma_id = ?'
  ).get(fila.id);
  if (existente) {
    if (existente.estado === ESTADOS.FIRMADO) {
      throw new AppError(409, 'PAPER_ALREADY_SIGNED',
        'Esta solicitud ya tiene una firma autográfica registrada');
    }
    return existente;
  }

  const ahora = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO gh_firma_firmas_papel
      (firma_id, id_solicitud, id_empresa, id_trabajador, estado,
       fecha_solicitud, version_kair, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    fila.id,
    fila.id_solicitud,
    fila.id_empresa,
    fila.id_trabajador || null,
    ESTADOS.SOLICITADO,
    ahora,
    fila.version_kair || null,
    opciones.motivo ? JSON.stringify({ motivo: opciones.motivo }) : null
  );

  if (opciones.registerEvent) {
    opciones.registerEvent(fila.id, 'PAPER_TRACK_OPENED', {
      // El canal por el que el Trabajador pidió el papel: es la evidencia
      // de que la vía existía y era accesible (el 2.2.1.1.11 es un deber de
      // medios, y los medios se prueban, no se declaran).
      canal: opciones.canal || null,
      nota: opciones.motivo || null,
      id_solicitud: fila.id_solicitud,
    }, actor, opciones.ip, opciones.user_agent);
  }

  logger.info('Vía en papel abierta por la Empresa', {
    id_solicitud: fila.id_solicitud,
    id_empresa: fila.id_empresa,
    actor,
  });

  return obtenerPorSolicitud(fila.id_solicitud);
}

/**
 * Registra el documento ya firmado en papel.
 *
 * @param {object} datos
 * @param {string} datos.id_solicitud
 * @param {string} datos.pdfPath - la ruta del PDF firmado en papel
 * @param {string} datos.pdfHash - el SHA-256 (lo calcula el servidor)
 * @param {string} datos.registroPath - la ruta del Registro de firma autográfica
 * @param {string} [datos.acuerdoHash]
 * @param {string} [datos.actor] - el operador de la Empresa
 * @param {string} [datos.ip]
 * @param {string} [datos.user_agent]
 * @param {object} [datos.metadata]
 * @param {function} [datos.registerEvent]
 * @returns {object} la fila actualizada
 */
function registrarFirmado(datos) {
  const fila = obtenerPorSolicitud(datos.id_solicitud);
  if (!fila) {
    throw new AppError(404, 'PAPER_REQUEST_NOT_FOUND',
      'Esta solicitud no tiene una firma en papel registrada: '
      + 'el Trabajador no la pidió, o la vía electrónica sigue en curso');
  }
  if (fila.estado === ESTADOS.FIRMADO) {
    throw new AppError(409, 'PAPER_ALREADY_SIGNED',
      'Esta solicitud ya tiene una firma autográfica registrada');
  }

  const ahora = new Date().toISOString();
  db.prepare(`
    UPDATE gh_firma_firmas_papel
    SET estado = ?, fecha_firma = ?, pdf_firmado_path = ?, pdf_hash = ?,
        registro_path = ?, acuerdo_hash = ?, id_actor = ?, metadata = ?
    WHERE id = ?
  `).run(
    ESTADOS.FIRMADO,
    ahora,
    datos.pdfPath,
    datos.pdfHash,
    datos.registroPath || null,
    datos.acuerdoHash || fila.acuerdo_hash || null,
    datos.actor || 'sistema',
    datos.metadata ? JSON.stringify(datos.metadata) : null,
    fila.id
  );

  if (datos.registerEvent) {
    datos.registerEvent(fila.firma_id, 'PAPER_SIGNATURE_REGISTERED', {
      id_solicitud: fila.id_solicitud,
      pdf_hash: datos.pdfHash,
      fecha_firma: ahora,
      id_actor: datos.actor || 'sistema',
    }, datos.actor || 'sistema', datos.ip, datos.user_agent);
  }

  logger.info('Firma autográfica registrada', {
    id_solicitud: fila.id_solicitud,
    id_empresa: fila.id_empresa,
    actor: datos.actor || 'sistema',
  });

  return obtenerPorSolicitud(datos.id_solicitud);
}

/**
 * Marca que la Empresa entregó el documento en papel.
 *
 * @param {string} id_solicitud
 * @param {object} [opts]
 * @returns {object|null}
 */
function marcarEntregado(id_solicitud, opts) {
  const opciones = opts || {};
  const fila = obtenerPorSolicitud(id_solicitud);
  if (!fila) return null;
  if (fila.estado === ESTADOS.FIRMADO) return fila;
  const ahora = new Date().toISOString();
  db.prepare(`
    UPDATE gh_firma_firmas_papel
    SET estado = ?, fecha_entrega = ?
    WHERE id = ?
  `).run(ESTADOS.ENTREGADO, ahora, fila.id);
  if (opciones.registerEvent) {
    opciones.registerEvent(fila.firma_id, 'PAPER_DOCUMENT_DELIVERED', {
      id_solicitud: fila.id_solicitud,
    }, opciones.actor || 'sistema', opciones.ip, opciones.user_agent);
  }
  return obtenerPorSolicitud(id_solicitud);
}

/**
 * La fila de la firma en papel de una solicitud (o null).
 * @param {string} id_solicitud
 * @returns {object|null}
 */
function obtenerPorSolicitud(id_solicitud) {
  if (!id_solicitud) return null;
  return db.prepare(
    'SELECT * FROM gh_firma_firmas_papel WHERE id_solicitud = ?'
  ).get(id_solicitud) || null;
}

/**
 * Las firmas en papel de una Empresa.
 *
 * @param {string} id_empresa
 * @param {object} [filtros]
 * @param {string} [filtros.estado]
 * @param {number} [filtros.limite]
 * @returns {Array<object>}
 */
function listarPorEmpresa(id_empresa, filtros) {
  const opciones = filtros || {};
  const where = ['id_empresa = ?'];
  const params = [id_empresa];
  if (opciones.estado) {
    where.push('estado = ?');
    params.push(opciones.estado);
  }
  const limite = Math.min(Number(opciones.limite) || 100, 500);
  return db.prepare(`
    SELECT id, firma_id, id_solicitud, id_empresa, id_trabajador, estado,
           fecha_solicitud, fecha_entrega, fecha_firma, pdf_hash, registro_path,
           id_actor, version_kair
    FROM gh_firma_firmas_papel
    WHERE ${where.join(' AND ')}
    ORDER BY fecha_solicitud DESC
    LIMIT ?
  `).all(...params, limite);
}

module.exports = {
  ESTADOS,
  ESTADOS_ELECTRONICOS_VIGENTES,
  abrir,
  registrarFirmado,
  marcarEntregado,
  obtenerPorSolicitud,
  listarPorEmpresa,
};
