/**
 * Llave maestra del servicio.
 *
 * UNA sola fuente de verdad para la llave de la que se derivan TODAS las
 * claves criptográficas del servicio (cifrado de tokens, HMAC de
 * identificación, HMAC de OTP, HMAC de token de acceso).
 *
 * Origen: variable de entorno `TOKEN_ENCRYPTION_KEY` (32 bytes hex = 64 chars).
 *
 * - En producción la variable es OBLIGATORIA: si falta, el servicio no
 *   arranca. Rotarla invalida los tokens cifrados y los seudónimos ya
 *   calculados (ver SECURITY.md, seccion de rotacion de llaves).
 * - En desarrollo, si falta, se genera una y se guarda en disco
 *   (`data/.dev-master-key`, permisos 0600) para que el ambiente sea
 *   estable entre reinicios. Sin esto, cada arranque cambiaría el
 *   seudónimo del trabajador y las búsquedas por `id_trabajador` — que es
 *   la llave de unión del sistema — dejarían de encontrar filas viejas.
 *
 * La clave de desarrollo NUNCA se usa en producción: el guard de más abajo
 * lanza antes de llegar a ese código.
 *
 * NOTA DE DEPENDENCIAS: este módulo NO importa `config` ni `logger` en el
 * nivel superior, a propósito. La capa cripto se usa desde tests y desde
 * scripts que corren sin las variables de entorno del servicio; si `keys.js`
 * exigiera INTERNAL_API_KEY al importarse, esos scripts dejarían de
 * funcionar. Los requires son perezosos y toleran fallos.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY_BYTES = 32;
const KEY_HEX_LENGTH = 64;
const KEY_HEX_RE = /^[0-9a-fA-F]{64}$/;
const SERVICE_ROOT = path.resolve(__dirname, '..', '..');

let _masterKey = null;

/**
 * Avisa sin depender del logger del servicio (que a su vez exige config).
 */
function _warn(message, extra) {
  try {
    // eslint-disable-next-line global-require
    require('../utils/logger').warn(message, extra);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[firma-service] ' + message + (extra ? ' ' + JSON.stringify(extra) : ''));
  }
}

/**
 * Ruta de la llave de desarrollo: junto a la base de datos.
 */
function _devKeyPath() {
  const dbPath = process.env.DB_PATH || './data/firma.sqlite';
  const resolved = path.isAbsolute(dbPath) ? dbPath : path.join(SERVICE_ROOT, dbPath);
  return path.join(path.dirname(resolved), '.dev-master-key');
}

function _fromEnv() {
  const fromEnv = process.env.TOKEN_ENCRYPTION_KEY;
  if (typeof fromEnv === 'string' && KEY_HEX_RE.test(fromEnv.trim())) {
    return Buffer.from(fromEnv.trim(), 'hex');
  }
  return null;
}

function _loadOrCreateDevKey() {
  const p = _devKeyPath();
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8').trim();
      if (KEY_HEX_RE.test(raw)) return Buffer.from(raw, 'hex');
    }
  } catch (e) {
    _warn('No se pudo leer la clave de desarrollo', { error: e.message });
  }

  const key = crypto.randomBytes(KEY_BYTES);
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, key.toString('hex'), { mode: 0o600 });
  } catch (e) {
    _warn('No se pudo persistir la clave de desarrollo; sera efimera', {
      path: p,
      error: e.message,
    });
  }
  return key;
}

/**
 * Devuelve la llave maestra (Buffer de 32 bytes).
 * Lanza si falta en produccion.
 */
function getMasterKey() {
  if (_masterKey) return _masterKey;

  const fromEnv = _fromEnv();
  if (fromEnv) {
    _masterKey = fromEnv;
    return _masterKey;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY requerida en produccion (32 bytes hex = 64 chars). ' +
      'Generar con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  _warn('TOKEN_ENCRYPTION_KEY no seteada: se usa una clave de desarrollo persistida en disco', {
    path: _devKeyPath(),
  });
  _masterKey = _loadOrCreateDevKey();
  return _masterKey;
}

/**
 * Solo para tests: fuerza la llave maestra en memoria.
 */
function _setMasterKeyForTests(buffer) {
  _masterKey = buffer;
  _ringCache = null;
  _resetDerivedCache();
}

// =============================================================================
// EL ANILLO DE LLAVES
// =============================================================================
//
// `TOKEN_ENCRYPTION_KEY` sigue siendo la llave MAESTRA: de ella se deriva
// todo lo demás (el cifrado de tokens y las claves de HMAC). Lo que cambia con
// el anillo es que el HMAC de las huellas PERSISTENTES puede rotar sin
// invalidar la evidencia anterior.
//
// El problema que resuelve: si la huella de identificación y el seudónimo del
// trabajador se calculan siempre con la llave vigente, entonces en el momento
// en que la llave rota, el 100% de las firmas anteriores queda sin poder
// verificarse. Eso es peor que el problema que la rotación iba a resolver.
//
// Con el anillo, cada fila registra la VERSIÓN con la que se calculó su
// huella, y al verificar se prueba primero esa versión y luego las demás del
// anillo. La versión vieja se conserva mientras viva la evidencia que la
// usó (el plazo de conservación del Capítulo VIII del Acuerdo).
//
// IMPORTANTE: no basta con que la VERIFICACIÓN pruebe el anillo. La
// BÚSQUEDA tiene que probarlo también: si el `SELECT` que recupera una fila
// solo prueba la versión vigente, al rotar la llave las filas viejas se
// vuelven invisibles y las firmas en curso quedan varadas sin que ningún
// error lo explique. Por eso `services/trabajador.js` calcula el seudónimo
// con cada versión del anillo, no solo con la vigente.
//
// Configuración (opcional; sin ella el comportamiento es el de siempre):
//
//   FIRMA_HMAC_KEYRING='{"k1":"<64 hex>","k2":"<64 hex>"}'
//   FIRMA_HMAC_KEY_VERSION='k2'      # la que está en uso
//
// Si no se define el anillo, se usa {"k1": TOKEN_ENCRYPTION_KEY} y la versión
// vigente es "k1".

let _ringCache = null;

function _resetDerivedCache() {
  try {
    // eslint-disable-next-line global-require
    require('./hmac')._resetKeyCache();
  } catch (e) { /* hmac todavía no cargado */ }
}

/**
 * Lee el anillo del entorno.
 * @returns {{versionActual: string, versiones: Object<string, Buffer>}}
 */
function getKeyRing() {
  if (_ringCache) return _ringCache;

  const versiones = {};
  const raw = process.env.FIRMA_HMAC_KEYRING;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error('FIRMA_HMAC_KEYRING no es JSON valido');
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('FIRMA_HMAC_KEYRING debe ser un objeto {"k1":"<hex>"}');
    }
    for (const version of Object.keys(parsed)) {
      const hex = parsed[version];
      if (typeof hex !== 'string' || !KEY_HEX_RE.test(hex.trim())) {
        throw new Error(
          'FIRMA_HMAC_KEYRING[' + version + '] no es una llave valida (32 bytes hex = 64 chars)'
        );
      }
      versiones[version] = Buffer.from(hex.trim(), 'hex');
    }
    if (Object.keys(versiones).length === 0) {
      throw new Error('FIRMA_HMAC_KEYRING no contiene ninguna version de llave');
    }
  } else {
    // Sin anillo explicito: la llave maestra es la unica version.
    versiones.k1 = getMasterKey();
  }

  const actuales = Object.keys(versiones);
  const versionActual = process.env.FIRMA_HMAC_KEY_VERSION
    && versiones[process.env.FIRMA_HMAC_KEY_VERSION]
    ? process.env.FIRMA_HMAC_KEY_VERSION
    : actuales[actuales.length - 1];

  _ringCache = { versionActual, versiones };
  return _ringCache;
}

/**
 * La versión de llave en uso.
 * @returns {string} ej. 'k1'
 */
function getKeyVersionActual() {
  return getKeyRing().versionActual;
}

/**
 * El material de una versión concreta.
 * @param {string} version
 * @returns {Buffer|null}
 */
function getKeyMaterial(version) {
  const ring = getKeyRing();
  return ring.versiones[version] || null;
}

/**
 * Todas las versiones del anillo, de la vigente a las más antiguas.
 * @returns {string[]}
 */
function listKeyVersions() {
  const ring = getKeyRing();
  const otras = Object.keys(ring.versiones).filter((v) => v !== ring.versionActual);
  return [ring.versionActual].concat(otras);
}

/**
 * Solo para tests: fuerza un anillo en memoria.
 * @param {{versionActual: string, versiones: Object<string, Buffer>}} anillo
 */
function _setKeyRingForTests(anillo) {
  _ringCache = anillo;
  _resetDerivedCache();
}

module.exports = {
  getMasterKey,
  getKeyRing,
  getKeyVersionActual,
  getKeyMaterial,
  listKeyVersions,
  KEY_BYTES,
  KEY_HEX_LENGTH,
  _setMasterKeyForTests,
  _setKeyRingForTests,
};
