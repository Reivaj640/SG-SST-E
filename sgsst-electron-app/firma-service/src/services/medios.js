/**
 * LOS MEDIOS ELECTRÓNICOS AUTORIZADOS POR EL TRABAJADOR (la 9A, el 8.2)
 * =========================================================================
 *
 * QUÉ ES ESTO
 * -----------
 * El numeral 8.2 del Acuerdo dice:
 *
 *   "El documento firmado, sus anexos y sus modificaciones serán
 *    suministrados siempre al Trabajador a través de un medio electrónico
 *    autorizado por el mismo. El Trabajador autoriza como medios electrónicos
 *    los siguientes: el correo electrónico registrado en su hoja de vida y el
 *    enlace de firma electrónica de K+AIR. El Trabajador puede modificar esta
 *    autorización en cualquier momento y sin costo alguno."
 *
 * Y el párrafo 2 del artículo 2.2.1.1.12 del Decreto 1072 de 2015 (añadido
 * por el Decreto 526 de 2021) exige lo mismo del lado de la ley: el
 * empleador debe suministrar la copia por un medio electrónico **autorizado
 * por el trabajador**, y ese necesita poder cambiar ese medio.
 *
 * O sea: sin un REGISTRO de los medios autorizados, el 8.2 es letra. El
 * sistema no sabe a qué buzón puede entregarle la copia a cada persona, y no
 * puede ofrecerle la vía para cambiarlo.
 *
 * LOS TRES MEDIOS
 * ---------------
 *   EMAIL_HOJA_VIDA — el correo registrado en la hoja de vida. Lo autoriza el
 *     8.2 de entrada. Lo registra la Empresa (origen 'EMPRESA'): es un dato
 *     que ella tiene.
 *
 *   CORREO_OTP — el medio personal que declaró el propio Trabajador para el
 *     código de verificación (la decisión D-2 del 2026-10-20, que separa el
 *     canal del OTP del canal de la invitación). Lo declara y lo modifica el
 *     Trabajador (origen 'TRABAJADOR').
 *
 *   LINK_KAIR — el enlace de firma electrónica de K+AIR. Lo autoriza el 8.2
 *     de entrada y lo registra el sistema (origen 'SISTEMA') cuando se crea
 *     la solicitud.
 *
 * EL ESTADO `PENDIENTE` Y POR QUÉ EXISTE
 * --------------------------------------
 * Un medio declarado por el Trabajador NO sirve para entregar copias hasta
 * que el Trabajador demuestre que lo controla (es decir, hasta que el código
 * de verificación le llega y lo verifica). Entre la declaración y la
 * verificación hay una ventana en la que cualquiera que tenga el enlace
 * podría escribir un correo ajeno en el registro — y a partir de ahí, la
 * Empresa le entregaría la copia del documento a un desconocido.
 *
 * Por eso un medio declarado nace en `PENDIENTE` y pasa a `ACTIVO` cuando el
 * código se verifica. `BAJA` es la modificación del 8.2: el Trabajador
 * retira el medio. La fila NO se borra: el registro de lo que se retiró es
 * parte de la evidencia.
 *
 * Tests: tests/n9a-medios-y-papel.test.js
 */
'use strict';

const db = require('../db/connection');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');

/**
 * Los tipos de medio y quién los registra.
 * @type {Readonly<Record<string, {label: string, origen: string, requiereValor: boolean}>>}
 */
const TIPOS = Object.freeze({
  EMAIL_HOJA_VIDA: {
    label: 'Correo registrado en la hoja de vida',
    origen: 'EMPRESA',
    requiereValor: true,
  },
  CORREO_OTP: {
    label: 'Correo personal para el código de verificación',
    origen: 'TRABAJADOR',
    requiereValor: true,
  },
  LINK_KAIR: {
    label: 'Enlace de firma electrónica de K+AIR',
    origen: 'SISTEMA',
    requiereValor: false,
  },
});

/**
 * Normaliza un correo: en minúsculas y sin espacios.
 * @param {string} valor
 * @returns {string}
 */
function _correo(valor) {
  return typeof valor === 'string' ? valor.trim().toLowerCase() : '';
}

/**
 * Valida un medio antes de registrarlo.
 * @param {string} tipo
 * @param {string} valor
 * @throws {AppError}
 */
function _validar(tipo, valor) {
  if (!TIPOS[tipo]) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'El tipo de medio no es válido: ' + tipo);
  }
  const v = TIPOS[tipo].requiereValor ? _correo(valor) : '';
  if (TIPOS[tipo].requiereValor) {
    if (!v || !v.includes('@') || v.includes(' ')) {
      throw new AppError(400, 'INVALID_REQUEST_BODY',
        'El medio debe ser un correo electrónico válido');
    }
    if (v.length > 254) {
      throw new AppError(400, 'INVALID_REQUEST_BODY',
        'El correo es demasiado largo');
    }
  }
  return v;
}

/**
 * Registra (o reactiva) un medio autorizado.
 *
 * Es IDEMPOTENTE: registrar dos veces el mismo medio no crea dos filas.
 * Si el medio estaba dado de baja, se reactiva (el Trabajador puede
 * volver a autorizar un medio que había retirado).
 *
 * @param {object} datos
 * @param {string} datos.id_empresa
 * @param {string} datos.id_trabajador - el seudónimo (psn1_...), no el documento
 * @param {string} datos.tipo - EMAIL_HOJA_VIDA | CORREO_OTP | LINK_KAIR
 * @param {string} [datos.valor] - el correo (o '' para LINK_KAIR)
 * @param {string} [datos.origen] - TRABAJADOR | EMPRESA | SISTEMA
 * @param {string} [datos.estado] - PENDIENTE | ACTIVO | BAJA
 * @returns {{id: number, tipo: string, valor: string, estado: string}}
 */
function registrar(datos) {
  const id_empresa = datos.id_empresa;
  const id_trabajador = datos.id_trabajador;
  if (!id_empresa || !id_trabajador) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'Falta la empresa o el trabajador del medio');
  }
  const tipo = datos.tipo;
  const valor = _validar(tipo, datos.valor);
  const origen = datos.origen || TIPOS[tipo].origen;
  const estado = datos.estado || 'PENDIENTE';
  const ahora = new Date().toISOString();

  const existente = db.prepare(`
    SELECT * FROM gh_firma_medios_trabajador
    WHERE id_empresa = ? AND id_trabajador = ? AND tipo = ? AND valor = ?
  `).get(id_empresa, id_trabajador, tipo, valor);

  if (existente) {
    if (existente.estado === estado) {
      return {
        id: existente.id, tipo, valor,
        estado: existente.estado,
      };
    }
    db.prepare(`
      UPDATE gh_firma_medios_trabajador
      SET estado = ?, origen = ?, fecha_modificacion = ?, fecha_baja = ?
      WHERE id = ?
    `).run(
      estado, origen, ahora,
      estado === 'BAJA' ? ahora : null,
      existente.id
    );
    return { id: existente.id, tipo, valor, estado };
  }

  const info = db.prepare(`
    INSERT INTO gh_firma_medios_trabajador
      (id_empresa, id_trabajador, tipo, valor, estado, origen,
       fecha_registro, fecha_modificacion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id_empresa, id_trabajador, tipo, valor, estado, origen, ahora, ahora);

  logger.info('Medio autorizado registrado', {
    id_empresa, tipo, estado, origen,
    id_trabajador: '[seudónimo]',
  });

  return { id: info.lastInsertRowid, tipo, valor, estado };
}

/**
 * Los medios ACTIVOS de un Trabajador (los únicos por los que se puede
 * entregar una copia).
 *
 * @param {string} id_empresa
 * @param {string} id_trabajador
 * @returns {Array<object>}
 */
function listarActivos(id_empresa, id_trabajador) {
  if (!id_empresa || !id_trabajador) return [];
  return db.prepare(`
    SELECT tipo, valor, estado, origen, fecha_registro, fecha_modificacion
    FROM gh_firma_medios_trabajador
    WHERE id_empresa = ? AND id_trabajador = ? AND estado = 'ACTIVO'
    ORDER BY tipo ASC
  `).all(id_empresa, id_trabajador);
}

/**
 * TODOS los medios de un Trabajador (con su historia), para la vista de
 * gestión.
 *
 * @param {string} id_empresa
 * @param {string} id_trabajador
 * @returns {Array<object>}
 */
function listarTodos(id_empresa, id_trabajador) {
  if (!id_empresa || !id_trabajador) return [];
  return db.prepare(`
    SELECT tipo, valor, estado, origen, fecha_registro, fecha_modificacion,
           fecha_baja
    FROM gh_firma_medios_trabajador
    WHERE id_empresa = ? AND id_trabajador = ?
    ORDER BY estado ASC, tipo ASC, fecha_registro DESC
  `).all(id_empresa, id_trabajador);
}

/**
 * Da de baja un medio (la modificación del 8.2).
 *
 * La fila NO se borra: queda el registro de que el Trabajador lo retiró.
 *
 * @param {object} datos
 * @returns {{ok: boolean, tipo: string, valor: string}}
 */
function darDeBaja(datos) {
  const id_empresa = datos.id_empresa;
  const id_trabajador = datos.id_trabajador;
  const tipo = datos.tipo;
  const valor = _validar(tipo, datos.valor);
  const ahora = new Date().toISOString();

  const info = db.prepare(`
    UPDATE gh_firma_medios_trabajador
    SET estado = 'BAJA', fecha_modificacion = ?, fecha_baja = ?
    WHERE id_empresa = ? AND id_trabajador = ? AND tipo = ? AND valor = ?
      AND estado != 'BAJA'
  `).run(ahora, ahora, id_empresa, id_trabajador, tipo, valor);

  if (info.changes === 0) {
    // No estaba o ya estaba dado de baja: no es un error, pero se avisa.
    logger.info('Baja de medio sin cambios', {
      id_empresa, tipo, id_trabajador: '[seudónimo]',
    });
  }
  return { ok: info.changes > 0, tipo, valor };
}

/**
 * Pasa un medio declarado a ACTIVO.
 *
 * Se llama cuando el código de verificación se verificó: en ese momento el
 * Trabajador demostró que controla el buzón, así que el medio queda
 * autorizado para entregar copias.
 *
 * @param {string} id_empresa
 * @param {string} id_trabajador
 * @param {string} tipo
 * @param {string} valor
 * @returns {boolean} si cambió algo
 */
function activar(id_empresa, id_trabajador, tipo, valor) {
  const ahora = new Date().toISOString();
  const info = db.prepare(`
    UPDATE gh_firma_medios_trabajador
    SET estado = 'ACTIVO', fecha_modificacion = ?
    WHERE id_empresa = ? AND id_trabajador = ? AND tipo = ? AND valor = ?
      AND estado = 'PENDIENTE'
  `).run(ahora, id_empresa, id_trabajador, tipo, _correo(valor));
  return info.changes > 0;
}

/**
 * El alta automática que acompaña a una solicitud de firma.
 *
 * La Empresa ya registró el correo del trabajador (es el `correo_verificacion`
 * de la fila): ese es el "correo electrónico registrado en su hoja de vida" del
 * 8.2. Y el enlace de K+AIR lo autoriza el mismo 8.2.
 *
 * Se registran como ACTIVOS: los autoriza el 8.2 de entrada, sin que el
 * Trabajador tenga que hacer nada.
 *
 * @param {object} signRequest - la fila de gh_firmas_electronicas
 * @param {string} [signRequest.correo_otp] - el medio PERSONAL que declara
 *   la EMPRESA para el código de verificación (D-2). Nace PENDIENTE: hasta
 *   que el Trabajador no demuestre que lo controla, no es un medio verificado.
 * @returns {{medios: string[]}}
 */
function registrarAltaPorSolicitud(signRequest) {
  const id_empresa = signRequest.id_empresa;
  const id_trabajador = signRequest.id_trabajador;
  const registrados = [];
  if (!id_empresa || !id_trabajador) return { medios: registrados };

  const correo = _correo(signRequest.correo_verificacion || '');
  if (correo.includes('@')) {
    registrar({
      id_empresa, id_trabajador,
      tipo: 'EMAIL_HOJA_VIDA', valor: correo,
      origen: 'EMPRESA', estado: 'ACTIVO',
    });
    registrados.push('EMAIL_HOJA_VIDA');
  }

  registrar({
    id_empresa, id_trabajador,
    tipo: 'LINK_KAIR', valor: '',
    origen: 'SISTEMA', estado: 'ACTIVO',
  });
  registrados.push('LINK_KAIR');

  // D-2: el medio personal que declara la EMPRESA para el código. Nace
  // PENDIENTE: el código le llega y el Trabajador lo verifica; en ese momento
  // queda ACTIVO y es un medio ELECTRÓNICO AUTORIZADO por él (el 8.2).
  const correoOtp = _correo(signRequest.correo_otp || '');
  if (correoOtp.includes('@')) {
    registrar({
      id_empresa, id_trabajador,
      tipo: 'CORREO_OTP', valor: correoOtp,
      origen: 'EMPRESA', estado: 'PENDIENTE',
    });
    registrados.push('CORREO_OTP');
  }

  return { medios: registrados };
}

module.exports = {
  TIPOS,
  registrar,
  listarActivos,
  listarTodos,
  darDeBaja,
  activar,
  registrarAltaPorSolicitud,
};
