/**
 * HMAC con clave derivada de la llave maestra del servicio.
 *
 * POR QUÉ HMAC Y NO "SHA-256 CON SAL":
 *
 * El Capítulo III del Acuerdo de uso (3.4(d), 3.4(e), 3.6(e)) promete que
 * el número de documento del firmante y el código OTP se conservan
 * "únicamente en forma de huella digital con sal". Una sal guardada EN LA
 * MISMA TABLA que el hash no protege nada: quien lee la base de datos tiene la
 * sal y el hash, y puede recomputar candidatos. Para un OTP de 6 dígitos
 * (10^6) eso es instantáneo; para una cédula (10^10) son minutos en una GPU.
 *
 * Con HMAC la llave vive FUERA de la base de datos (en `TOKEN_ENCRYPTION_KEY`,
 * en el `.env` del servidor). Quien lea la base de datos no puede recomputar
 * ningún candidato: el hash de la fila ya no es verificable sin la llave.
 *
 * DOMINIO SEPARADO (HKDF):
 * cada propósito usa una clave derivada distinta, aunque la llave maestra
 * sea la misma. Así el HMAC de la cédula nunca puede ser reutilizado como
 * HMAC del OTP, ni viceversa. Un atacante que consiga el valor de un
 * propósito no obtiene nada de los otros.
 *
 * HKDF-SHA256 con salt vacío e `info` con el propósito: el `info` es
 * exactamente el mecanismo de separación de dominio del HKDF.
 *
 * ÁMBITO (POR EMPRESA)
 * --------------------
 * El `info` incluye además un ÁMBITO. Para las huellas que dependen de una
 * Empresa (identificación, seudónimo del trabajador, correo, OTP) el ámbito es
 * el `id_empresa`. Con una sola llave para todo el servicio, la misma cédula
 * produce la misma huella en todas las Empresas: quien lea la base (o quien
 * reciba dos constancias de empresas distintas) podría enlazar "es la misma
 * persona" sin conocer el número. Con el ámbito por empresa, ese enlace no
 * existe.
 *
 * El TOKEN de acceso es la excepción: es la credencial con la que se resuelve
 * la solicitud, así que su ámbito es 'global' (aún no se sabe de qué empresa
 * es la solicitud cuando se busca).
 *
 * VERSIÓN DE LLAVE
 * ----------------
 * El `info` incluye la VERSIÓN de la llave con la que se calculó la huella.
 * Así una fila puede decir "esta huella se hizo con k1" y seguir siendo
 * verificable después de que k2 entre en uso, mientras k1 siga en el anillo
 * (ver src/crypto/keys.js).
 */
'use strict';

const crypto = require('crypto');
const { getKeyRing, getKeyMaterial, getKeyVersionActual, listKeyVersions, getMasterKey } = require('./keys');

const DERIVED_KEY_BYTES = 32;
const INFO_PREFIX = 'kair-firma/v2/';

// Ámbito por defecto: lo que NO pertenece a una Empresa concreta.
const AMBITO_GLOBAL = 'global';

const _derived = new Map();

/**
 * Deriva la clave de un propósito/ámbito/versión. Cacheada: la derivación es
 * determinista y solo depende de la llave.
 *
 * @param {string} purpose - Ej: 'identificacion', 'otp', 'token', 'trabajador'
 * @param {string} [ambito] - id_empresa, o 'global'
 * @param {string} [version] - versión de llave (por defecto, la vigente)
 * @returns {Buffer} 32 bytes
 */
function derivedKey(purpose, ambito, version) {
  if (typeof purpose !== 'string' || purpose.length === 0) {
    throw new Error('hmac: el propósito es requerido');
  }
  const scope = (ambito === null || ambito === undefined || ambito === '')
    ? AMBITO_GLOBAL
    : String(ambito);
  const ver = version || getKeyVersionActual();
  const cacheKey = ver + '|' + scope + '|' + purpose;
  if (_derived.has(cacheKey)) return _derived.get(cacheKey);

  const material = getKeyMaterial(ver);
  if (!material) {
    throw new Error('hmac: no hay material de llave para la versión ' + ver);
  }
  const info = Buffer.from(INFO_PREFIX + ver + '/' + scope + '/' + purpose, 'utf8');
  const key = Buffer.from(crypto.hkdfSync(
    'sha256',
    material,
    Buffer.alloc(0),
    info,
    DERIVED_KEY_BYTES,
  ));
  _derived.set(cacheKey, key);
  return key;
}

/**
 * HMAC-SHA256 de un valor, en hex.
 *
 * @param {string} purpose
 * @param {string|number} value
 * @param {string} [ambito] - id_empresa, o 'global'
 * @param {string} [version] - versión de llave
 * @returns {string} 64 chars hex
 */
function hmacHex(purpose, value, ambito, version) {
  if (value === null || value === undefined) {
    throw new Error('hmac: el valor es requerido');
  }
  return crypto
    .createHmac('sha256', derivedKey(purpose, ambito, version))
    .update(String(value), 'utf8')
    .digest('hex');
}

/**
 * HMAC-SHA256 de un valor, en base64.
 */
function hmacBase64(purpose, value, ambito, version) {
  if (value === null || value === undefined) {
    throw new Error('hmac: el valor es requerido');
  }
  return crypto
    .createHmac('sha256', derivedKey(purpose, ambito, version))
    .update(String(value), 'utf8')
    .digest('base64');
}

/**
 * Calcula la huella con CADA versión del anillo, para poder verificar una
 * fila sin saber de antemano con qué versión se hizo.
 *
 * Se devuelve la lista completa, no solo la primera que coincida: el que
 * llama decide. El orden es el de `listKeyVersions` (vigente primero).
 *
 * @param {string} purpose
 * @param {string|number} value
 * @param {string} [ambito]
 * @param {string[]} [versiones] - por defecto, todas las del anillo
 * @returns {Array<{version: string, hex: string}>}
 */
function hmacHexEnVersiones(purpose, value, ambito, versiones) {
  const lista = Array.isArray(versiones) && versiones.length
    ? versiones
    : listKeyVersions();
  return lista.map((version) => ({
    version,
    hex: hmacHex(purpose, value, ambito, version),
  }));
}

/**
 * Borra la cache de claves derivadas. Solo para tests: cambiar la llave
 * maestra o el anillo en caliente tiene que INVALIDAR las claves derivadas.
 */
function _resetKeyCache() {
  _derived.clear();
}

// =============================================================================
// EL MARCADOR DE ALGORITMO
// =============================================================================
//
// Cada fila que guarda una huella persistente dice con qué se calculó, en su
// columna `*_alg`. El valor lleva DOS cosas:
//
//   hmac-sha256.v2.k1
//   └────────┬───┘ └┬┘ └┬┘
//    algoritmo  │   │  versión de la llave
//               │   formato de la derivación (v2 = con ámbito y versión)
//               separar
//
// Formato `v1` (el de la primera implementación, sin ámbito ni versión:
// `hmac-sha256`) ya no se produce: se reconoce como heredado y la fila se
// reescribe. Los demás valores heredados son `sha256-salt` y `sha256-plain`.

const ALG_HMAC = 'hmac-sha256';
const ALG_HMAC_V1 = 'hmac-sha256';
const FORMATO_ACTUAL = 'v2';

/**
 * @param {string} [version] - versión de llave (por defecto, la vigente)
 * @returns {string} ej. 'hmac-sha256.v2.k1'
 */
function algHmac(version) {
  return ALG_HMAC + '.' + FORMATO_ACTUAL + '.' + (version || getKeyVersionActual());
}

/**
 * ¿Es este marcador una huella HMAC del formato vigente?
 * @param {string|null} alg
 * @returns {boolean}
 */
function esAlgHmacVigente(alg) {
  return typeof alg === 'string' && alg.startsWith(ALG_HMAC + '.' + FORMATO_ACTUAL + '.');
}

/**
 * La versión de llave de un marcador vigente, o null.
 * @param {string|null} alg
 * @returns {string|null} ej. 'k1'
 */
function versionDeAlg(alg) {
  if (!esAlgHmacVigente(alg)) return null;
  const partes = String(alg).split('.');
  return partes.length >= 3 ? partes[2] : null;
}

/**
 * ¿Es este marcador una huella HMAC de CUALQUIER formato (incluido el v1
 * heredado, que hay que reescribir)?
 * @param {string|null} alg
 * @returns {boolean}
 */
function esAlgHmac(alg) {
  return typeof alg === 'string' && alg.startsWith(ALG_HMAC);
}

/**
 * La derivación de la PRIMERA implementación (formato v1): una sola llave
 * maestra, sin ámbito y sin versión de llave, con `info = kair-firma/v1/<proposito>`.
 *
 * Existe solo para que ninguna fila que ya se calculó quede sin poder
 * verificar. Se usa únicamente cuando la fila declara ese formato en su
 * columna `*_alg`, y su resultado se reescribe en el formato vigente.
 *
 * @param {string} purpose
 * @param {string|number} value
 * @returns {string} 64 chars hex
 */
function hmacV1Hex(purpose, value) {
  if (value === null || value === undefined) {
    throw new Error('hmac: el valor es requerido');
  }
  const info = Buffer.from('kair-firma/v1/' + purpose, 'utf8');
  const key = Buffer.from(crypto.hkdfSync(
    'sha256',
    getMasterKey(),
    Buffer.alloc(0),
    info,
    DERIVED_KEY_BYTES,
  ));
  return crypto
    .createHmac('sha256', key)
    .update(String(value), 'utf8')
    .digest('hex');
}

module.exports = {
  derivedKey,
  hmacHex,
  hmacBase64,
  hmacHexEnVersiones,
  hmacV1Hex,
  algHmac,
  esAlgHmac,
  esAlgHmacVigente,
  versionDeAlg,
  ALG_HMAC,
  ALG_HMAC_V1,
  FORMATO_ACTUAL,
  DERIVED_KEY_BYTES,
  AMBITO_GLOBAL,
  _resetKeyCache,
  // Re-exportados para que quien use el HMAC no tenga que importar dos módulos.
  getKeyRing,
  getKeyVersionActual,
  listKeyVersions,
};
