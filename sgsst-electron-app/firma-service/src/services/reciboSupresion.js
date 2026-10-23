/**
 * EL RECIBO DE SUPRESIÓN (3.6(g) y 10.6)
 * =======================================
 *
 * QUÉ PIDE EL TEXTO
 * ----------------
 * El 3.6(g) del Acuerdo de uso:
 *
 *   "La supresión dentro de la ventana de purga del 8.6 no es alteración: da
 *    lugar a una lápida que identifica la solicitud, la fecha y hora, las
 *    categorías suprimidas y el fundamento del plazo, y a un recibo que la
 *    Empresa entrega al Trabajador si lo solicita."
 *
 * Y el 10.6:
 *
 *   "La supresión del documento, la Constancia y los registros de auditoría
 *    deja la lápida y el recibo del 3.6(g) y 10.5(d)."
 *
 * QUÉ HAY Y QUÉ FALTA
 * -------------------
 * HAY: las dos piezas de evidencia. La lápida (`gh_firma_purgadas`) y el
 * recibo (`gh_firma_purga_registro`), las dos append-only.
 *
 * FALTA: la LÁPIDA NO IDENTIFICABA LA SOLICITUD. Guardaba el `firma_id` (un
 * entero interno) y el `id_empresa`, pero NO el identificador de la solicitud
 * (SIGN-YYYY-NNNNNN), que es lo que el Trabajador y la Empresa conocen. Y
 * como la supresión borra la fila de la firma entera, ese dato se perdía para
 * siempre: una vez suprimida, la lápida no decía a qué solicitud pertenecía.
 * La migración 040 lo arregla (agrega `id_solicitud` y
 * `fecha_conservacion`, que es el fundamento del plazo).
 *
 * FALTA: LA ENTREGA. No había ninguna forma de que la Empresa obtuviera el
 * recibo para entregárselo al Trabajador. Este servicio y su endpoint son
 * esa vía.
 *
 * A QUIÉN SE LE ENTREGA
 * ---------------------
 * A la Empresa, que es la Responsable del dato y la que se lo entrega al
 * Trabajador (el 10.7(e): el Titular acude primero a la Empresa). Por eso
 * el endpoint es PER-EMPRESA: la Empresa consulta SUS recibos, no los de
 * otras.
 *
 * QUÉ NO TRAE
 * -----------
 * El recibo NO lleva datos personales: ni el correo, ni la huella del
 * documento, ni el número del Trabajador, ni su nombre. Solo identificadores
 * internos, fechas y el fundamento. Es la misma regla de la lápida (migración
 * 024) y del recibo de purgas (migración 020).
 */
'use strict';

const db = require('../db/connection');
const logger = require('../utils/logger');

/**
 * Las columnas del recibo que se entregan. Es una lista EXPRESA: si mañana se
 * agrega una columna con datos personales a la tabla, este servicio no la
 * expone sin que alguien lo decida a mano.
 */
const COLUMNAS_REPARTO = [
  'id_solicitud',
  'id_empresa',
  'purgado_at',
  'actor',
  'motivo',
  'categorias',
  'fecha_conservacion',
  'ventana_hasta',
  'hold_verificado',
  'archivos_eliminados',
  'eventos_purgados',
];

/**
 * Normaliza el JSON de categorías a un arreglo de strings.
 *
 * Las dos fuentes lo guardan en JSON: la lápida como arreglo y el recibo de
 * purgas como texto. La capa de datos le pone un prefijo ("datos:") para
 * distinguirla de la de auditoría ("eventos_auditoria"), así que ese prefijo
 * se quita antes de leer. Un valor que no se puede leer no se inventa: se
 * deja tal cual y el resto del recibo sigue siendo válido.
 *
 * @param {*} valor
 * @returns {string[]}
 */
function _categorias(valor) {
  if (Array.isArray(valor)) {
    return valor.map((c) => String(c));
  }
  if (typeof valor !== 'string' || valor.length === 0) return [];

  // El prefijo de la capa de datos: "datos:[...]".
  const bruto = valor.startsWith('datos:') ? valor.slice('datos:'.length) : valor;

  try {
    const parsed = JSON.parse(bruto);
    if (Array.isArray(parsed)) return parsed.map((c) => String(c));
    return [String(parsed)];
  } catch (e) {
    // No es JSON: se devuelve tal cual, para no perder el dato.
    return [valor];
  }
}

/**
 * Arma el recibo de una fila de la lápida y/o del recibo de purgas.
 *
 * @param {object|null} lapida - Fila de `gh_firma_purgadas`.
 * @param {object|null} registro - Fila de `gh_firma_purga_registro`.
 * @param {string|null} [idSolicitud] - El identificador de la solicitud
 *   conocido por el llamador. Se usa cuando la lápida NO lo trae (escrita
 *   antes de la migración 040) y cuando la vía es solo el recibo de purgas
 *   (la fila de la firma sigue viva).
 * @returns {object|null}
 */
function _armar(lapida, registro, idSolicitud = null) {
  if (!lapida && !registro) return null;

  // La lápida manda: es la que tiene el `id_solicitud` (migración 040) y la
  // fecha de conservación. El recibo de purgas aporta la ventana y el
  // recuento de eventos, que la lápida no tiene.
  const fuente = lapida || registro;
  const categorias = lapida
    ? _categorias(lapida.categorias)
    : _categorias(registro.categorias);

  return {
    // El 3.6(g): la lápida "identifica la solicitud". Si la lápida no lo
    // trae (escrita antes de la 040), se usa el que trae el recibo de purgas
    // (migración 041) y, en último caso, el que conoce el llamador: sin
    // esto el recibo existiría pero no diría a qué solicitud pertenece.
    id_solicitud: (lapida && lapida.id_solicitud)
      || (registro && registro.id_solicitud)
      || idSolicitud || null,
    id_empresa: fuente.id_empresa || null,
    // La fecha y hora de la supresión.
    purgado_at: fuente.purgado_at || null,
    // Quién la ejecutó y por qué.
    actor: fuente.actor || null,
    motivo: fuente.motivo || null,
    // Las categorías suprimidas.
    categorias,
    // EL FUNDAMENTO DEL PLAZO: hasta cuándo estaba obligado a conservarse.
    fecha_conservacion: (lapida && lapida.fecha_conservacion)
      || (registro && registro.fecha_conservacion) || null,
    // La ventana de purga en la que se ejecutó.
    ventana_hasta: (registro && registro.ventana_hasta) || null,
    // Que se comprobó que no había un hold vigente.
    hold_verificado: registro ? Boolean(registro.hold_verificado) : null,
    // Qué se borró.
    archivos_eliminados: lapida ? lapida.archivos_eliminados : null,
    eventos_purgados: registro ? registro.eventos_purgados : null,
  };
}

/**
 * El recibo de supresión de una solicitud.
 *
 * @param {string} id_solicitud - El identificador de la solicitud (SIGN-...).
 * @returns {object|null} El recibo, o null si la solicitud no fue suprimida.
 */
function porSolicitud(id_solicitud) {
  if (typeof id_solicitud !== 'string' || id_solicitud.length === 0) return null;

  // 1. La lápida (la vía de la 5B: la fila de la firma se borró entera).
  // El `firma_id` se trae porque es el puente con el recibo de purgas.
  const lapida = db.prepare(`
    SELECT id_solicitud, id_empresa, purgado_at, actor, motivo, categorias,
           fecha_conservacion, archivos_eliminados, firma_id
    FROM gh_firma_purgadas
    WHERE id_solicitud = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(id_solicitud);

  // 2. El recibo de purgas (la vía de la purga del registro de auditoría, que
  // NO borra la fila de la firma). Se cruza por el id interno de la firma.
  //
  // En la operación de dos capas hay DOS filas de recibo por firma: una de
  // la capa de auditoría y una de la capa de datos. Se agregan (MAX) en vez
  // de tomar una: el recuento de eventos purged vive en la de auditoría y el
  // de archivos en la de datos, y el recibo tiene que contar las dos cosas.
  let registro = null;
  if (!lapida) {
    const firma = db.prepare(
      'SELECT id FROM gh_firmas_electronicas WHERE id_solicitud = ?'
    ).get(id_solicitud);
    if (firma) {
      registro = db.prepare(`
        SELECT firma_id, id_empresa, purgado_at, actor, motivo, ventana_hasta,
               MAX(categorias) AS categorias, MAX(hold_verificado) AS hold_verificado,
               MAX(eventos_purgados) AS eventos_purgados,
               MAX(id_solicitud) AS id_solicitud,
               MAX(fecha_conservacion) AS fecha_conservacion
        FROM gh_firma_purga_registro
        WHERE firma_id = ?
        GROUP BY firma_id
      `).get(firma.id) || null;
    }
  } else {
    registro = db.prepare(`
      SELECT firma_id, id_empresa, purgado_at, actor, motivo, ventana_hasta,
             MAX(categorias) AS categorias, MAX(hold_verificado) AS hold_verificado,
             MAX(eventos_purgados) AS eventos_purgados,
             MAX(id_solicitud) AS id_solicitud,
             MAX(fecha_conservacion) AS fecha_conservacion
      FROM gh_firma_purga_registro
      WHERE firma_id = ?
      GROUP BY firma_id
    `).get(lapida.firma_id) || null;
  }

  if (!lapida && !registro) return null;

  // Si la lápida no trae el id_solicitud (escrita antes de la migración 040),
  // se completa con el de la firma viva, si todavía existe.
  if (lapida && !lapida.id_solicitud) {
    const firma = db.prepare(
      'SELECT id_solicitud FROM gh_firmas_electronicas WHERE id = ?'
    ).get(lapida.firma_id);
    if (firma) lapida.id_solicitud = firma.id_solicitud || null;
  }

  return _armar(lapida, registro, id_solicitud);
}

/**
 * Los recibos de supresión de una Empresa, del más reciente al más antiguo.
 *
 * @param {string} id_empresa
 * @param {object} [opts]
 * @param {number} [opts.limite]
 * @returns {object[]}
 */
function porEmpresa(id_empresa, { limite = 100 } = {}) {
  if (typeof id_empresa !== 'string' || id_empresa.length === 0) return [];
  const max = Number.isInteger(limite) && limite > 0 ? Math.min(limite, 500) : 100;

  const filas = db.prepare(`
    SELECT p.id_solicitud AS lapida_id_solicitud, p.id_empresa, p.purgado_at,
           p.actor, p.motivo, p.categorias, p.fecha_conservacion,
           p.archivos_eliminados,
           MAX(r.ventana_hasta) AS ventana_hasta,
           MAX(r.hold_verificado) AS hold_verificado,
           MAX(r.eventos_purgados) AS eventos_purgados,
           MAX(r.id_solicitud) AS registro_id_solicitud,
           MAX(r.fecha_conservacion) AS registro_fecha_conservacion
    FROM gh_firma_purgadas p
    LEFT JOIN gh_firma_purga_registro r ON r.firma_id = p.firma_id
    WHERE p.id_empresa = ?
    GROUP BY p.id
    ORDER BY p.purgado_at DESC
    LIMIT ?
  `).all(id_empresa, max);

  return filas.map((f) => _armar(
    {
      id_solicitud: f.lapida_id_solicitud,
      id_empresa: f.id_empresa,
      purgado_at: f.purgado_at,
      actor: f.actor,
      motivo: f.motivo,
      categorias: f.categorias,
      fecha_conservacion: f.fecha_conservacion,
      archivos_eliminados: f.archivos_eliminados,
    },
    {
      firma_id: null,
      id_empresa: f.id_empresa,
      purgado_at: f.purgado_at,
      actor: f.actor,
      motivo: f.motivo,
      ventana_hasta: f.ventana_hasta,
      categorias: f.categorias,
      hold_verificado: f.hold_verificado,
      eventos_purgados: f.eventos_purgados,
      id_solicitud: f.registro_id_solicitud,
      fecha_conservacion: f.registro_fecha_conservacion,
    }
  ));
}

/**
 * Cuenta los recibos de una Empresa. Para el resumen que la Empresa le
 * entrega al Trabajador.
 *
 * @param {string} id_empresa
 * @returns {number}
 */
function totalPorEmpresa(id_empresa) {
  if (typeof id_empresa !== 'string' || id_empresa.length === 0) return 0;
  const fila = db.prepare(
    'SELECT COUNT(*) AS n FROM gh_firma_purgadas WHERE id_empresa = ?'
  ).get(id_empresa);
  return fila ? fila.n : 0;
}

module.exports = {
  COLUMNAS_REPARTO,
  porSolicitud,
  porEmpresa,
  totalPorEmpresa,
};
