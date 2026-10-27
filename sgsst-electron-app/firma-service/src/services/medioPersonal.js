/**
 * EL MEDIO PERSONAL DEL CÓDIGO, DECLARADO POR EL TRABAJADOR (decisión 1.a)
 * =========================================================================
 *
 * QUÉ ES ESTO
 * -----------
 * La Empresa que solicita la firma obtiene del candidato su correo personal
 * DE FORMA VERBAL, durante la contratación, y lo registra en la solicitud.
 * El Trabajador no tiene que escribirlo de nuevo: lo CONFIRMA en la pantalla
 * de firma.
 *
 * POR QUÉ HAY UNA DECLARACIÓN Y NO UN CAMPO
 * ------------------------------------------
 * El campo "correo personal" del que habla el D-2 es el BUZÓN al que llega el
 * código de verificación, que es un dato de creación de la firma. Para que ese
 * buzón sirva, tiene que ser de uso EXCLUSIVO del Firmante y la Empresa no
 * puede leerlo: si la Empresa lo lee, también lee el código y la garantía de
 * exclusividad es falsa.
 *
 * Cuando el Trabajador escribe el correo, el sistema sabe que lo escribió él.
 * Cuando lo escribe la Empresa, el sistema NO lo sabe: la Empresa lo escribió
 * en un papel, en una llamada. Por eso la Empresa lo registra pero el
 * Trabajador lo CONFIRMA: la declaración es el acto del Trabajador que
 * responde por ese buzón.
 *
 * LO QUE ESTE MÓDULO NO HACE
 * --------------------------
 *   - NO valida el dominio corporativo: ese control ya existe (el D-2, en
 *     publicFlow.resolveCorreoOtp) y sigue siendo el de siempre. La
 *     confirmación se registra DESPUÉS de que el flujo principal pase, así que
 *     una dirección que la Empresa puede leer nunca queda confirmada: el
 *     flujo se rechaza antes (400 MEDIO_OTP_CORPORATIVO).
 *   - NO envía el código ni cambia el estado de la solicitud: eso es del
 *     flujo público.
 *   - NO enmascara la dirección: es el buzón del propio Trabajador, que lo
 *     conoce y que la Empresa ya tenía. En el registro de medios (el 8.2) la
 *     dirección también va en claro.
 *
 * Tests: tests/web/miniapp-medio-confirmado.test.js
 */
'use strict';

const db = require('../db/connection');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');
const mediosService = require('./medios');
const signRequestService = require('./signRequest');

/**
 * EL TEXTO FIJO DE LA DECLARACIÓN.
 *
 * Es fijo a propósito: si mañana se cambia la redacción, cambia la VERSIÓN
 * (y el Trabajador que confirmó con el texto viejo queda con la versión vieja
 * en su fila, que es justo lo que hay que poder auditar).
 *
 * @type {string}
 */
const DECLARACION_TEXTO = 'Confirmo que esta dirección de correo es de mi uso exclusivo, '
  + 'que la Empresa no administra este buzón y que yo custodio el código de verificación '
  + 'que se envía a él.';

/**
 * La versión del texto de la declaración. Sube cuando cambia el texto.
 * @type {string}
 */
const DECLARACION_VERSION = '1.0';

/**
 * El evento de la bitácora que deja la constancia de la confirmación.
 * @type {string}
 */
const EVENTO_CONFIRMACION = 'MEDIO_PERSONAL_CONFIRMADO';

/**
 * Normaliza un correo: en minúsculas y sin espacios.
 * @param {string} valor
 * @returns {string}
 */
function _correo(valor) {
  return typeof valor === 'string' ? valor.trim().toLowerCase() : '';
}

/**
 * El medio personal que registró la EMPRESA para el código de verificación.
 *
 * POR QUÉ se busca en el REGISTRO DE MEDIOS y no solo en la fila: la columna
 * `correo_otp` de la solicitud la escribe la Empresa al crearla, pero también
 * la escribe el Trabajador cuando declara su propio buzón (en la pantalla de
 * identificación o en la de sus medios autorizados). El registro de medios (el
 * 8.2) sí distingue: guarda el ORIGEN de cada medio, así que se sabe si lo
 * registró la Empresa ('EMPRESA'), si el Trabajador ya lo confirmó
 * ('TRABAJADOR_CONFIRMADO') o si lo declaró el Trabajador ('TRABAJADOR').
 *
 * POR QUÉ si el único medio es del TRABAJADOR se devuelve null: en ese caso la
 * Empresa no registró ningún medio personal, y preguntarle al Trabajador que
 * confirme "la dirección que registró la Empresa" sería preguntarle por una
 * dirección que él mismo acaba de escribir.
 *
 * @param {object} signRequest - la fila de gh_firmas_electronicas
 * @returns {string|null} el correo, o null si la Empresa no registró ninguno
 */
function medioRegistradoPorEmpresa(signRequest) {
  if (!signRequest) return null;

  // 1. El registro de medios: el origen dice quién lo puso.
  if (signRequest.id_trabajador) {
    const filas = db.prepare(`
      SELECT valor, origen FROM gh_firma_medios_trabajador
      WHERE id_empresa = ? AND id_trabajador = ? AND tipo = 'CORREO_OTP'
      ORDER BY fecha_registro ASC
    `).all(signRequest.id_empresa, signRequest.id_trabajador);
    const deLaEmpresa = filas.find(
      (f) => f.origen === 'EMPRESA' || f.origen === 'TRABAJADOR_CONFIRMADO'
    );
    if (deLaEmpresa) return _correo(deLaEmpresa.valor);
    if (filas.length > 0) {
      // Solo hay medios declarados por el Trabajador: la Empresa no registró
      // ningún medio personal para este código.
      return null;
    }
  }

  // 2. Sin registro de medios (una solicitud anterior a la 9A): la columna de
  //    la fila es lo que hay.
  const deLaFila = _correo(signRequest.correo_otp || '');
  return deLaFila.includes('@') ? deLaFila : null;
}

/**
 * Lo que la mini-app necesita mostrar sobre el medio personal.
 *
 * La dirección va EN CLARO: es el buzón del propio Trabajador (que lo
 * conoce) y la Empresa ya lo tenía (lo obtuvo en la contratación). Enmascararla
 * no aportaría nada y le impediría al Trabajador reconocerla.
 *
 * @param {object} signRequest - la fila de gh_firmas_electronicas
 * @returns {{correo: string|null, requiere_confirmacion: boolean,
 *            declaracion_texto: string, declaracion_version: string}}
 */
function exposicionParaMiniApp(signRequest) {
  const correo = medioRegistradoPorEmpresa(signRequest);
  return {
    correo,
    // La casilla es obligatoria SOLO cuando la dirección registrada va a ser la
    // destinataria del código. Si el Trabajador escribe otro buzón, el código
    // va a su buzón y no hay nada que confirmar del de la Empresa.
    requiere_confirmacion: Boolean(correo),
    declaracion_texto: DECLARACION_TEXTO,
    declaracion_version: DECLARACION_VERSION,
  };
}

/**
 * Registra la confirmación del Trabajador.
 *
 * Deja la constancia en DOS lugares:
 *   1. En la fila de la solicitud (fecha y hora, la dirección y la versión
 *      del texto de la declaración).
 *   2. En la bitácora de eventos (el mismo rastro que usa el resto del
 *      flujo público).
 *
 * Y cambia el ORIGEN del medio: si la Empresa lo había registrado, pasa a
 * 'TRABAJADOR_CONFIRMADO' (sigue PENDIENTE: confirmar NO es verificar el
 * código; eso lo activa `medios.activar` cuando llega el OTP).
 *
 * @param {object} datos
 * @param {object} datos.signRequest - la fila de gh_firmas_electronicas
 * @param {string} [datos.correo] - la dirección confirmada. Si no se pasa, se
 *   lee de la fila (que es la fuente de verdad: es la columna `correo_otp`, la
 *   que quedó congelada con el destino real del código).
 * @param {string} [datos.version_declaracion]
 * @param {string} [datos.ip]
 * @param {string} [datos.user_agent]
 * @returns {{ok: boolean, correo: string, fecha_hora: string,
 *            version_declaracion: string}}
 */
function registrarConfirmacion(datos) {
  const signRequest = datos && datos.signRequest;
  if (!signRequest || !signRequest.id) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'No hay solicitud de firma para registrar la confirmación');
  }
  // La dirección que se confirma es la que quedó congelada en la fila: es la
  // que recibió el código. La fila manda, no el dato que trae la petición.
  const fila = db.prepare(
    'SELECT correo_otp FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  const correo = _correo((fila && fila.correo_otp) || datos.correo || '');
  if (!correo.includes('@') || correo.includes(' ')) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'La dirección confirmada no es un correo válido');
  }
  const version = typeof datos.version_declaracion === 'string' && datos.version_declaracion.trim()
    ? datos.version_declaracion.trim()
    : DECLARACION_VERSION;

  const fecha_hora = new Date().toISOString();

  // 1. La fila de la solicitud + el origen del medio, en una sola
  //    transacción: o queda la constancia de los dos, o no queda ninguna.
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET medio_otp_confirmado_fecha_hora = ?,
          medio_otp_confirmado_correo = ?,
          medio_otp_confirmado_version = ?
      WHERE id = ?
    `).run(fecha_hora, correo, version, signRequest.id);

    if (signRequest.id_trabajador) {
      mediosService.confirmarPorTrabajador({
        id_empresa: signRequest.id_empresa,
        id_trabajador: signRequest.id_trabajador,
        valor: correo,
      });
    }
  });
  tx();

  // 2. La bitácora de eventos: el mismo rastro que usa el resto del flujo
  //    público (signRequest.registerEvent). La dirección va en claro: es el
  //    buzón del Firmante y en el registro de medios (el 8.2) también va en
  //    claro; el dato ya está en la base y enmascararlo solo aquí sería
  //    inconsistente y dejaría la auditoría sin la dirección que se confirmó.
  signRequestService.registerEvent(
    signRequest.id,
    EVENTO_CONFIRMACION,
    {
      correo,
      version_declaracion: version,
      origen_medio: 'TRABAJADOR_CONFIRMADO',
    },
    'trabajador',
    datos.ip || null,
    datos.user_agent || null,
  );

  logger.info('Medio personal del código confirmado por el Trabajador', {
    id_solicitud: signRequest.id_solicitud,
    id_empresa: signRequest.id_empresa,
    version_declaracion: version,
  });

  return {
    ok: true,
    correo,
    fecha_hora,
    version_declaracion: version,
  };
}

module.exports = {
  DECLARACION_TEXTO,
  DECLARACION_VERSION,
  EVENTO_CONFIRMACION,
  medioRegistradoPorEmpresa,
  exposicionParaMiniApp,
  registrarConfirmacion,
};
