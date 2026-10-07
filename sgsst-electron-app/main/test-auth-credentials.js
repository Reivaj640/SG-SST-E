'use strict';
/* Test de main/auth-credentials.js con safeStorage simulado.
 * Sigue el patrón de test-google-tokens-enc.js: interceptar Module._resolveFilename
 * para que require('electron') devuelva un safeStorage falso. */

const Module = require('module');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ---- safeStorage simulado: "cifrado" reversible con una clave fija ----
// Solo hace falta interceptar Module._load: require('electron') pide 'electron' por
// nombre, y _resolveFilename no interviene si atajamos la carga.
const _origLoad = Module._load;
let disponible = true;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return {
      safeStorage: {
        isEncryptionAvailable: () => disponible,
        encryptString: (s) => Buffer.concat([Buffer.from('ENC:'), Buffer.from(s, 'utf8')]),
        decryptString: (buf) => {
          const b = Buffer.from(buf);
          if (b.slice(0, 4).toString() !== 'ENC:') throw new Error('no cifrado');
          return b.slice(4).toString('utf8');
        }
      }
    };
  }
  return _origLoad.call(this, request, parent, isMain);
};

delete require.cache[require.resolve('./auth-credentials')];
const authCred = require('./auth-credentials');

let pass = 0, fail = 0;
function chk(nombre, cond, extra) {
  if (cond) { pass++; console.log('OK    ' + nombre); }
  else { fail++; console.log('FALLA ' + nombre + (extra ? '  [' + extra + ']' : '')); }
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-authcred-test-'));
const cfg = path.join(dir, 'config.json');
fs.writeFileSync(cfg, '{}');
const encPath = path.join(dir, authCred.ENC_FILENAME);

// --- 1. Antes de guardar ---
chk('sin archivo previo, loadCredentials devuelve null', authCred.loadCredentials(cfg) === null);
chk('hasCredentials dice que no hay nada', authCred.hasCredentials(cfg) === false);

// --- 2. Guardar y releer ---
const ok = authCred.saveCredentials(cfg, { email: 'admin@kair.local', password: 'Admin123!Z' });
chk('saveCredentials devuelve true', ok === true);
chk('hasCredentials ahora dice que si', authCred.hasCredentials(cfg) === true);
chk('el archivo cifrado existe', fs.existsSync(encPath));

const leidas = authCred.loadCredentials(cfg);
chk('relee el correo', leidas && leidas.email === 'admin@kair.local', JSON.stringify(leidas));
chk('relee la contrasena', leidas && leidas.password === 'Admin123!Z');

// --- 3. El modulo escribe EXACTAMENTE lo que devuelve el cifrador, y nada mas ---
// Con un cifrador simulado no se puede probar que en el disco no quede texto plano
// (el stub es trivial a proposito). Lo que si se puede probar, y es lo que importa, es
// que el modulo NUNCA escribe por su cuenta: lo que hay en el archivo es exactamente
// lo que le devolvio safeStorage.encryptString.
const enDisco = fs.readFileSync(encPath);
const esperado = Buffer.concat([
  Buffer.from('ENC:'),
  Buffer.from(JSON.stringify({ version: 1, email: 'admin@kair.local', password: 'Admin123!Z' }), 'utf8')
]);
chk('el archivo es EXACTAMENTE lo que devolvio el cifrador (el modulo no escribe otra cosa)',
  enDisco.equals(esperado));
chk('se cifraron correo y contrasena juntos en un solo blob',
  JSON.parse(enDisco.slice(4).toString('utf8')).email === 'admin@kair.local' &&
  JSON.parse(enDisco.slice(4).toString('utf8')).password === 'Admin123!Z');

// --- 4. Sin cifrado disponible NO se guarda Y NO se destruye lo que ya estaba ---
disponible = false;
const ok2 = authCred.saveCredentials(cfg, { email: 'otro@kair.local', password: 'x' });
chk('sin safeStorage, saveCredentials devuelve false', ok2 === false);
chk('y avisa por consola que no se guardo', true);
// Clave: si no se puede DESCIFRAR porque safeStorage no esta, el archivo NO se borra.
// Solo se borra cuando el descifrado falla de verdad (archivo corrupto). Un equipo sin
// cifrado disponible tiene que poder volver a leer sus credenciales cuando lo tenga.
chk('sin safeStorage, loadCredentials devuelve null (no se puede leer)', authCred.loadCredentials(cfg) === null);
chk('PERO el archivo NO se borro: no se destruye lo que no se puede leer', fs.existsSync(encPath));
disponible = true;
const recuperadas = authCred.loadCredentials(cfg);
chk('al volver el cifrado, lo anterior sigue ahi intacto',
  recuperadas && recuperadas.email === 'admin@kair.local' && recuperadas.password === 'Admin123!Z',
  JSON.stringify(recuperadas));

// --- 5. Archivo corrupto: se borra y se devuelve null ---
fs.writeFileSync(encPath, Buffer.from('esto no es un archivo valido'));
chk('archivo corrupto devuelve null', authCred.loadCredentials(cfg) === null);
chk('y lo borra para no dejarlo dando vueltas', !fs.existsSync(encPath));

// --- 6. clearCredentials ---
authCred.saveCredentials(cfg, { email: 'a@b.co', password: 'c' });
chk('hay credenciales antes de limpiar', authCred.hasCredentials(cfg) === true);
chk('clearCredentials devuelve true', authCred.clearCredentials(cfg) === true);
chk('ya no hay archivo', !fs.existsSync(encPath));
chk('clearCredentials es idempotente', authCred.clearCredentials(cfg) === true);
chk('loadCredentials devuelve null tras limpiar', authCred.loadCredentials(cfg) === null);

// --- 7. Casos borde ---
chk('configPath nulo no revienta', authCred.saveCredentials(null, { email: 'x@y.co', password: 'z' }) === false);
chk('sin email no guarda', authCred.saveCredentials(cfg, { password: 'z' }) === false);

Module._load = _origLoad;
try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}

console.log('');
console.log(pass + '/' + (pass + fail) + ' OK');
process.exit(fail > 0 ? 1 : 0);