// F3.A — Google OAuth token persistence.
// Guarda los tokens (access_token, refresh_token, expiry) para que persistan entre
// sesiones. Si falta refresh_token, el user tiene que re-autorizar la app desde la UI.
//
// 🔐 Los tokens NO se guardan en config.json: van cifrados a un archivo aparte
// (google-tokens.enc) con safeStorage. El encabezado de abajo explica por qué y
// qué se hizo con los que ya estaban en texto plano.
//
// 🔐 Tokens cifrados (este bloque nuevo): antes estos tokens vivían en TEXTO PLANO dentro de
// config.json, junto con el resto de la config. El refresh_token de Google no caduca hasta que
// el usuario revoca el acceso desde su cuenta, o sea que es una credencial de larga vida: con
// ella sola se pueden leer y enviar correos. Alguien con acceso de lectura al archivo (un
// backup, un antivirus, otra app, el mismo sincronizador de Drive) se llevaba la cuenta.
// Ahora van a un archivo aparte, `google-tokens.enc`, cifrado con safeStorage — el mismo
// mecanismo que ya usa firma-bridge.js para la api key.
//
// La API pública NO cambia: sigue recibiendo `configPath`. La ruta del archivo cifrado se
// deriva de ahí (path.dirname), así que ninguno de los llamadores de main.js se entera.
const fs = require('fs');
const path = require('path');

const TOKEN_KEY = 'googleOAuth'; // Namespace dentro de config.json
const ENC_FILENAME = 'google-tokens.enc';
const ENC_VERSION = 1;

/**
 * safeStorage se pide DENTRO de la función, no al cargar el módulo.
 * Razón: shared/ se carga desde el main process, pero también se mockea en tests
 * que interceptan Module._resolveFilename. Un require de electron en el tope del
 * archivo rompería esos tests en el momento de cargarlo, no cuando se use la función.
 */
function _safeStorage() {
  try {
    // eslint-disable-next-line global-require
    const electron = require('electron');
    const ss = electron.safeStorage || (electron.app && electron.app.safeStorage);
    if (ss && typeof ss.isEncryptionAvailable === 'function') return ss;
  } catch (e) {
    // Sin Electron (node pelado en tests, o si el módulo se carga en el renderer).
  }
  return null;
}

function _encryptionAvailable() {
  const ss = _safeStorage();
  if (!ss) return false;
  try {
    return ss.isEncryptionAvailable();
  } catch (e) {
    return false;
  }
}

/** Ruta del archivo cifrado, derivada del configPath para no cambiar la API. */
function _encPath(configPath) {
  if (!configPath) return null;
  return path.join(path.dirname(configPath), ENC_FILENAME);
}

/**
 * Lee y descifra google-tokens.enc. Devuelve null si no existe, si safeStorage no
 * está disponible, o si el archivo está corrupto.
 *
 * Si el descifrado falla (cambio de usuario de Windows, de keyring en Linux, o el
 * archivo esta alterado), el archivo se BORRA y se devuelve null: no hay forma de
 * recuperar un refresh_token cifrado con una clave que ya no tenemos, y el usuario
 * tiene que re-autorizar. Es la misma politica que sigue firma-bridge con secrets.enc.
 */
function _readEncrypted(configPath) {
  const p = _encPath(configPath);
  if (!p) return null;
  if (!fs.existsSync(p)) return null;
  const ss = _safeStorage();
  if (!ss || !_encryptionAvailable()) {
    console.warn('[GoogleTokens] safeStorage no disponible; no se puede leer ' + ENC_FILENAME);
    return null;
  }
  try {
    const buf = fs.readFileSync(p);
    const json = ss.decryptString(buf);
    const raw = JSON.parse(json);
    if (!raw || raw.version !== ENC_VERSION || !raw.tokens) {
      console.warn('[GoogleTokens] ' + ENC_FILENAME + ' con version inesperada; se descarta.');
      return null;
    }
    return raw.tokens;
  } catch (e) {
    console.warn('[GoogleTokens] No se pudo descifrar ' + ENC_FILENAME +
      ' (cambio de usuario de Windows o keyring). Se borra y habra que re-autorizar: ' + e.message);
    try { fs.unlinkSync(p); } catch (_) { /* mejor esfuerzo */ }
    return null;
  }
}

function _writeEncrypted(configPath, tokens) {
  const p = _encPath(configPath);
  if (!p) return false;
  const ss = _safeStorage();
  if (!ss || !_encryptionAvailable()) {
    console.warn('[GoogleTokens] safeStorage no disponible; NO se guardan los tokens.');
    return false;
  }
  try {
    const env = ss.encryptString(JSON.stringify({ version: ENC_VERSION, tokens: tokens }));
    fs.writeFileSync(p, env);
    return true;
  } catch (e) {
    console.error('[GoogleTokens] Error escribiendo ' + ENC_FILENAME + ':', e.message);
    return false;
  }
}

/** Borra la copia en texto plano de config.json, si todavía está. */
function _purgeLegacy(configPath) {
  try {
    const config = loadConfig(configPath);
    if (!config || !config[TOKEN_KEY]) return false;
    delete config[TOKEN_KEY];
    saveConfig(configPath, config);
    return true;
  } catch (e) {
    return false;
  }
}

function getConfigPath(app, userDataPath) {
  if (userDataPath) return path.join(userDataPath, 'config.json');
  if (app && app.getPath) return path.join(app.getPath('userData'), 'config.json');
  return null;
}

function loadConfig(configPath) {
  try {
    if (!fs.existsSync(configPath)) return {};
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw) || {};
  } catch (e) {
    console.error('[GoogleTokens] Error leyendo config.json:', e.message);
    return {};
  }
}

function saveConfig(configPath, config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[GoogleTokens] Error guardando config.json:', e.message);
    return false;
  }
}

/**
 * Devuelve los tokens guardados.
 *
 * Orden de resolución:
 *   1. google-tokens.enc (cifrado) — el camino normal desde esta versión.
 *   2. config.json.googleOAuth (texto plano, versión vieja) — se migra sola: se
 *      cifra, se guarda en el archivo nuevo, se borra de config.json, y se
 *      devuelve. El usuario no tiene que re-autorizar por actualizar la app.
 */
function loadTokens(configPath) {
  const cifrados = _readEncrypted(configPath);
  if (cifrados) return cifrados;

  // ¿Quedó una copia en texto plano de una versión anterior?
  const config = loadConfig(configPath);
  const legacy = config && config[TOKEN_KEY];
  if (!legacy) return null;

  if (!_encryptionAvailable()) {
    // Sin cifrado no se puede migrar. Se devuelve igual para no dejar al usuario
    // sin correo, pero la copia en texto plano sigue ahí: es el comportamiento
    // viejo, no una mejora.
    console.warn('[GoogleTokens] Hay tokens en texto plano en config.json y safeStorage ' +
      'no esta disponible, asi que no se pueden cifrar. Se siguen usando en claro.');
    return legacy;
  }

  const ok = _writeEncrypted(configPath, legacy);
  if (!ok) {
    console.warn('[GoogleTokens] No se pudo cifrar la copia en texto plano; se sigue leyendo de alla.');
    return legacy;
  }
  const borrada = _purgeLegacy(configPath);
  console.log('[GoogleTokens] Tokens migrados de config.json a ' + ENC_FILENAME +
    (borrada ? ' (se borro la copia en texto plano).' : ' (OJO: no se pudo borrar la copia vieja).'));
  return legacy;
}

/**
 * Guarda los tokens cifrados.
 *
 * Si safeStorage no esta disponible, NO se guardan: se evita dejar una segunda copia
 * en texto plano que el usuario no sabe que tiene. La sesion actual sigue servida
 * porque los tokens en memoria no dependen de esto; lo que se pierde es la
 * persistencia entre arranques.
 */
function saveTokens(configPath, tokens) {
  if (!configPath) return false;
  const payload = {
    access_token: tokens.access_token || null,
    refresh_token: tokens.refresh_token || null,
    expiry_date: tokens.expiry_date || (tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : null),
    scope: tokens.scope || null,
    token_type: tokens.token_type || 'Bearer',
    savedAt: new Date().toISOString()
  };
  const ok = _writeEncrypted(configPath, payload);
  // Si por lo que sea quedo una copia vieja en texto plano, se borra igual.
  _purgeLegacy(configPath);
  return ok;
}

/** Desconecta la cuenta: borra el archivo cifrado y cualquier copia en texto plano. */
function clearTokens(configPath) {
  if (!configPath) return false;
  const p = _encPath(configPath);
  let borrado = false;
  try {
    if (p && fs.existsSync(p)) {
      fs.unlinkSync(p);
      borrado = true;
    }
  } catch (e) {
    console.error('[GoogleTokens] Error borrando ' + ENC_FILENAME + ':', e.message);
  }
  const purgado = _purgeLegacy(configPath);
  return borrado || purgado;
}

function hasValidTokens(configPath) {
  const tokens = loadTokens(configPath);
  if (!tokens || !tokens.access_token) return false;
  // F4-fix — Si hay refresh_token, podemos renovar el access_token aunque esté
  // vencido. Google entrega refresh_token junto con el access_token inicial y
  // NO expira hasta que el user revoque el acceso desde su cuenta Google.
  // Por eso: si hay refresh_token, asumimos que la sesión es válida.
  // El access_token solo se usa para verificar que el flow OAuth se completó.
  if (tokens.refresh_token) return true;
  // Sin refresh_token: dependemos solo del access_token.
  // Si no hay expiry, asumimos válido (será verificado en uso).
  if (!tokens.expiry_date) return true;
  // Margen de 5 min para renovación preventiva
  return Date.now() < (tokens.expiry_date - 5 * 60 * 1000);
}

module.exports = {
  TOKEN_KEY,
  getConfigPath,
  loadTokens,
  saveTokens,
  clearTokens,
  hasValidTokens
};
