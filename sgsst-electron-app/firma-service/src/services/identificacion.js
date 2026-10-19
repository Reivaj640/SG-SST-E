/**
 * Huella de identificación del firmante.
 *
 * QUÉ PROBLEMA RESUELVE
 * ---------------------
 * El numeral 3.4(d) del Acuerdo de uso dice que la comparación con la
 * información registrada por la Empresa se hace "mediante una comparación de
 * huellas digitales con sal", y el 3.6(e) que el OTP y el token de acceso se
 * conservan "únicamente en forma de huella digital con sal".
 *
 * La implementación usaba "hash con sal", con la sal EN LA MISMA TABLA que
 * el hash. Eso no protege: quien lee la base de datos tiene la sal y el
 * hash, y puede recomputar los candidatos. Para una cédula (10^10) son
 * minutos en una GPU.
 *
 * LA REGLA
 * --------
 * El valor que se guarda en la fila es un HMAC-SHA256 con clave derivada por
 * HKDF de la llave maestra del servicio, con el ÁMBITO de la Empresa y la
 * VERSIÓN de la llave. La llave vive FUERA de la base de datos: quien lea la
 * base no puede recomputar ningún candidato.
 *
 * El HMAC se calcula SOBRE EL HASH PREVIO, no sobre el documento crudo:
 *
 *   preHash  = sha256(sal || documento)   si la fila tiene sal
 *            = sha256(documento)          si la fila no tiene sal
 *   guardado = hmac('identificacion', preHash, ambito=id_empresa, version)
 *
 * Por qué sobre el hash previo y no sobre el documento: el cliente (K+AIR)
 * ya manda el hash del documento, no el documento. Así el servidor nunca
 * recibe ni guarda el número de identidad en claro, y el cambio no obliga
 * a tocar el cliente.
 *
 * COMPATIBILIDAD CON LAS FILAS HEREDADAS
 * --------------------------------------
 * Las filas anteriores a la migración 019 tienen `identificacion_numero_alg`
 * NULL y guardan el hash previo pelado. Siguen verificando con su
 * algoritmo viejo; la primera vez que se verifican con éxito, la fila se
 * reescribe con el HMAC (migración autosuficiente: no hay ventana de
 * mantenimiento ni datos que re-hashear a mano).
 *
 * Lo mismo aplica al formato v1 (la primera implementación del HMAC, sin
 * ámbito ni versión): la fila verifica con esa derivación y se reescribe.
 * NINGUNA fila que ya se calculó queda sin poder verificar.
 */
'use strict';

const { sha256 } = require('../crypto/hash');
const {
  hmacHex, hmacV1Hex, algHmac, listKeyVersions, getKeyVersionActual,
} = require('../crypto/hmac');
const { constantTimeEqual } = require('../crypto/compare');

const PROPOSITO = 'identificacion';
const ALG_LEGACY = 'legacy';

/**
 * Calcula el hash previo del documento de identidad.
 * Reproduce exactamente lo que hizo el cliente al crear la solicitud.
 *
 * @param {string} numero_documento
 * @param {string|null} sal
 * @returns {string} 64 chars hex
 */
function preHash(numero_documento, sal) {
  if (typeof sal === 'string' && sal.length > 0) {
    return sha256(sal + String(numero_documento));
  }
  return sha256(String(numero_documento));
}

/**
 * Huella HMAC de un documento de identidad, tal como queda archivada.
 *
 * @param {string} numero_documento
 * @param {string|null} sal
 * @param {string} [id_empresa] - ámbito de la derivación
 * @param {string} [version] - versión de llave
 * @returns {string} 64 chars hex
 */
function huella(numero_documento, sal, id_empresa, version) {
  return hmacHex(PROPOSITO, preHash(numero_documento, sal), id_empresa, version);
}

/**
 * Huella HMAC a partir del hash previo que envió el cliente.
 * Es lo que se guarda al crear la solicitud.
 *
 * @param {string} hash_previo - sha256 del documento, con o sin sal
 * @param {string} [id_empresa] - ámbito de la derivación
 * @param {string} [version] - versión de llave
 * @returns {string} 64 chars hex
 */
function huellaDesdeHashPrevio(hash_previo, id_empresa, version) {
  return hmacHex(PROPOSITO, String(hash_previo), id_empresa, version);
}

/**
 * TODAS las formas en que podría estar calculada la huella de una fila, en
 * el orden en que conviene probarlas.
 *
 * 1. Formato vigente (v2): HMAC con ámbito de la empresa, con cada versión
 *    del anillo de llaves.
 * 2. Formato v1: HMAC con la llave maestra, sin ámbito.
 * 3. Formato heredado (pre-019): el pre-hash pelado.
 *
 * Se prueban todas porque una fila NUNCA debe quedar sin poder verificar: si
 * el formato que dice la columna `*_alg` no cuadra con lo que hay guardado
 * (por ejemplo, porque el anillo de llaves se reconfiguró), todavía tiene
 * que haber una forma de comprobarla.
 *
 * @param {string} numero_documento
 * @param {string|null} sal
 * @param {string} [id_empresa]
 * @returns {Array<{hex: string, formato: string, version: string|null}>}
 */
function candidatosHuella(numero_documento, sal, id_empresa) {
  const previo = preHash(numero_documento, sal);
  const lista = [];
  for (const version of listKeyVersions()) {
    lista.push({
      hex: hmacHex(PROPOSITO, previo, id_empresa, version),
      formato: 'v2',
      version,
    });
  }
  lista.push({ hex: hmacV1Hex(PROPOSITO, previo), formato: 'v1', version: null });
  lista.push({ hex: previo, formato: ALG_LEGACY, version: null });
  return lista;
}

/**
 * Compara el documento que escribió el firmante contra la huella archivada.
 *
 * Retorna:
 * - ok:         true si coincide
 * - huellaNueva: el valor con el que hay que reescribir la fila cuando esta
 *                usaba un formato heredado (null si ya usaba el vigente)
 * - version:    la versión de llave con la que se comprobó
 *
 * @param {string} numero_documento - lo que escribió el firmante
 * @param {object} fila - la fila de gh_firmas_electronicas
 * @returns {{ok: boolean, huellaNueva: string|null, version: string|null}}
 */
function verificar(numero_documento, fila) {
  const sal = fila.identificacion_numero_sal || null;
  const almacenado = fila.identificacion_numero_hash;
  const id_empresa = fila.id_empresa || null;

  if (!almacenado) return { ok: false, huellaNueva: null, version: null };

  const candidatos = candidatosHuella(numero_documento, sal, id_empresa);
  for (const c of candidatos) {
    if (!constantTimeEqual(c.hex, almacenado)) continue;
    if (c.formato === 'v2') {
      return { ok: true, huellaNueva: null, version: c.version };
    }
    // Heredada (v1 o pre-019): la fila se puede reescribir con el formato
    // vigente y la versión de llave en uso.
    return {
      ok: true,
      huellaNueva: hmacHex(PROPOSITO, preHash(numero_documento, sal), id_empresa, getKeyVersionActual()),
      version: null,
    };
  }
  return { ok: false, huellaNueva: null, version: null };
}

/**
 * Enmascara la huella de identificación para mostrarla.
 *
 * Es la convención que YA usa el sistema en la página de verificación
 * pública y en el PDF de la firma dual: los primeros 6 caracteres de la
 * huella archivada. Es determinista (la misma persona ve siempre la misma
 * máscara dentro de la misma Empresa), no reversible y no permite deducir
 * el documento.
 *
 * La huella archivada es un HMAC, así que la máscara se calcula sobre el
 * HMAC y no sobre el hash pelado del cliente. La propiedad que importa se
 * mantiene: es un valor derivado de la huella archivada, nunca un fragmento
 * del número de documento.
 *
 * @param {string|null} tipo - 'CC', 'CE', 'TI', ...
 * @param {string|null} hash - huella archivada
 * @returns {string|null} p. ej. 'CC ce3a59…'
 */
function enmascarar(tipo, hash) {
  if (!hash) return null;
  var prefix = String(hash).substring(0, 6);
  return (tipo || 'CC') + ' ' + (prefix || '***') + '…';
}

module.exports = {
  preHash,
  huella,
  huellaDesdeHashPrevio,
  candidatosHuella,
  verificar,
  enmascarar,
  PROPOSITO,
  ALG_LEGACY,
  algHmac,
};
