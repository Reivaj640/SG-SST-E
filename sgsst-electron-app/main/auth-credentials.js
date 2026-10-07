// Credenciales de login recordadas ("Recordar mis datos").
//
// 🔐 Por qué un archivo aparte: el checkbox guardaba el correo y la contraseña en
// localStorage, en TEXTO PLANO. La contraseña de la cuenta de K+AIR es la credencial que
// abre todo lo demás —incluidas las historias clínicas que registra la app—, así que
// cualquier programa con acceso de lectura al perfil de Chromium (un antivirus, un
// backup, otra app, el mismo sincronizador de Drive) se llevaba la cuenta entera.
//
// Ahora van cifradas a `auth-credentials.enc` con safeStorage: el MISMO mecanismo que ya
// usan google-tokens.js para los tokens OAuth y firma-bridge.js para su api key. No es
// un invento nuevo, es el del proyecto.
//
// La API pública NO cambia de forma: recibe `configPath` y deriva la ruta del archivo
// cifrado con path.dirname, igual que google-tokens.
const fs = require('fs');
const path = require('path');

const ENC_FILENAME = 'auth-credentials.enc';
const ENC_VERSION = 1;

/**
 * safeStorage se pide DENTRO de la función, no al cargar el módulo, por la misma razón
 * que en shared/google-tokens.js: este módulo también se carga desde tests que mockean
 * electron, y un require de electron en el tope rompería al cargarlo.
 */
function _safeStorage() {
  try {
    // eslint-disable-next-line global-require
    const electron = require('electron');
    const ss = electron.safeStorage || (electron.app && electron.app.safeStorage);
    if (ss && typeof ss.isEncryptionAvailable === 'function') return ss;
  } catch (e) {
    // Sin Electron (node pelado en tests).
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
 * Lee y descifra. Devuelve null si no existe, si safeStorage no está disponible, o si
 * el archivo está corrupto.
 *
 * Si el descifrado falla (cambio de usuario de Windows, de keyring en Linux, o archivo
 * alterado) el archivo se BORRA y se devuelve null: no hay forma de recuperar una
 * contraseña cifrada con una clave que ya no tenemos. Es la misma política que siguen
 * google-tokens y firma-bridge.
 */
function loadCredentials(configPath) {
  const p = _encPath(configPath);
  if (!p) return null;
  if (!fs.existsSync(p)) return null;
  const ss = _safeStorage();
  if (!ss || !_encryptionAvailable()) {
    console.warn('[AuthCredentials] safeStorage no disponible; no se puede leer ' + ENC_FILENAME);
    return null;
  }
  try {
    const buf = fs.readFileSync(p);
    const json = ss.decryptString(buf);
    const raw = JSON.parse(json);
    if (!raw || raw.version !== ENC_VERSION || !raw.email) {
      throw new Error('formato inesperado');
    }
    return { email: raw.email, password: raw.password || '' };
  } catch (e) {
    console.warn('[AuthCredentials] No se pudo descifrar ' + ENC_FILENAME + ' (' + e.message +
      '). Se borra; el usuario tendrá que escribir su clave otra vez.');
    try { fs.unlinkSync(p); } catch (e2) { /* si tampoco se puede borrar, da igual */ }
    return null;
  }
}

function _writeEncrypted(configPath, data) {
  const p = _encPath(configPath);
  if (!p) return false;
  const ss = _safeStorage();
  if (!ss || !_encryptionAvailable()) return false;
  try {
    const env = ss.encryptString(JSON.stringify({ version: ENC_VERSION, email: data.email, password: data.password }));
    fs.writeFileSync(p, env);
    return true;
  } catch (e) {
    console.error('[AuthCredentials] No se pudo escribir ' + ENC_FILENAME + ': ' + e.message);
    return false;
  }
}

/**
 * Guarda las credenciales CIFRADAS.
 *
 * Si safeStorage no está disponible, NO se guardan: se evita dejar una segunda copia en
 * texto plano que el usuario no sabe que tiene. Lo que se pierde es que el login se
 * recuerde entre arranques — que es justamente el proceso que el usuario pidió.
 */
function saveCredentials(configPath, data) {
  if (!configPath || !data || !data.email) return false;
  if (!_encryptionAvailable()) {
    console.warn('[AuthCredentials] safeStorage no disponible; NO se guardan las ' +
      'credenciales (no se pueden cifrar).');
    return false;
  }
  return _writeEncrypted(configPath, { email: data.email, password: data.password || '' });
}

/** Borra las credenciales guardadas. Usado cuando el usuario desmarca "Recordar mis datos". */
function clearCredentials(configPath) {
  const p = _encPath(configPath);
  if (!p) return false;
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return true;
  } catch (e) {
    console.error('[AuthCredentials] No se pudo borrar ' + ENC_FILENAME + ': ' + e.message);
    return false;
  }
}

/** ¿Hay credenciales guardadas? No descifra: solo mira si el archivo existe. */
function hasCredentials(configPath) {
  const p = _encPath(configPath);
  return !!(p && fs.existsSync(p));
}

module.exports = { saveCredentials, loadCredentials, clearCredentials, hasCredentials, ENC_FILENAME };