/* Test del cifrado de los tokens OAuth de Google (google-tokens.js).
 *
 * Que se verifica y POR QUE importa:
 *
 *   · Antes, los tokens vivian en TEXTO PLANO dentro de config.json. El refresh_token de Google
 *     no caduca hasta que el usuario revoca el acceso desde su cuenta, o sea que es una
 *     credencial de larga vida: con ella sola se leen y se envian correos de la persona.
 *     Ahora van a google-tokens.enc, cifrado con safeStorage.
 *
 *   · La API publica NO cambio (sigue recibiendo configPath), as que este test tambien
 *     comprueba que la ruta del archivo cifrado se deriva bien y que main.js no se entera.
 *
 *   · El caso que de verdad asusta es la MIGRACION silenciosa. Un usuario que ya tenia la
 *     app instalada y sus tokens en texto plano tiene que seguir recibiendo su correo sin
 *     volver a autorizar. Si esa migracion se rompe, el efecto es "instale la actualizacion y
 *     me desconecto de Gmail sin avisar".
 *
 *   · Y el caso de seguridad por defecto: si safeStorage NO esta disponible, el modulo NO
 *     puede caer de vuelta a guardar en texto plano. Si lo hiciera, el cifrado seria
 *     decorativo en cualquier Linux sin keyring.
 *
 * El safeStorage esta mockeado con un blob reversible 'ENC:' + base64, el mismo formato que
 * usan test-firma-bridge.js y storage-backup/e2e-multicompany.js. No se prueba el cifrado de
 * Electron (eso es de Electron), se prueba NUESTRA logica: que se cifra, que no queda texto
 * plano, que la migracion funciona y que no se degrada en silencio.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const checks = [];
function chk(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra || '' });
}

// ───────────────────────── Electron mockeado

const _mockDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-gt-enc-'));
const _mockPath = path.join(_mockDir, 'electron-mock.js');
const _mockFile = path.join(_mockDir, 'config.json');

let _encryptionDisponible = true;

// Base64 con prefijo: reversible, para poder comprobar que el contenido NO esta en claro.
const _mockSafeStorage = {
  isEncryptionAvailable: function () { return _encryptionDisponible; },
  encryptString: function (s) {
    if (!_encryptionDisponible) throw new Error('cifrado no disponible');
    return Buffer.from('ENC:' + Buffer.from(s, 'utf8').toString('base64'), 'utf8');
  },
  decryptString: function (buf) {
    if (!_encryptionDisponible) throw new Error('cifrado no disponible');
    const s = buf.toString('utf8');
    if (s.indexOf('ENC:') !== 0) throw new Error('Invalid encrypted blob (no ENC: prefix)');
    return Buffer.from(s.slice(4), 'base64').toString('utf8');
  }
};

fs.writeFileSync(_mockPath, 'module.exports = global._kairMockElectron;\n', 'utf8');
global._kairMockElectron = { safeStorage: _mockSafeStorage, app: {} };

const _originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent) {
  if (request === 'electron') return _mockPath;
  return _originalResolve.call(this, request, parent);
};

const tokens = require(path.join(__dirname, '..', 'shared', 'google-tokens.js'));

// OJO: el interceptor NO se restaura acá. google-tokens.js pide `require('electron')` de
// forma PEREZOSA, adentro de _safeStorage(), justamente para no romper los tests que mockean
// electron. O sea que el mock tiene que seguir montado durante TODAS las llamadas, no solo
// mientras carga el modulo. Si se restaura temprano, _safeStorage() recibe el electron real
// (que en ELECTRON_RUN_AS_NODE no tiene safeStorage) y todos los checks de cifrado caen sin
// que se note por que.

// ───────────────────────── Utilidades

function leerConfig() {
  try { return JSON.parse(fs.readFileSync(_mockFile, 'utf8')); } catch (e) { return {}; }
}
function escribirConfig(obj) {
  fs.writeFileSync(_mockFile, JSON.stringify(obj, null, 2), 'utf8');
}
function encPath() {
  return path.join(path.dirname(_mockFile), 'google-tokens.enc');
}
function existeEnc() {
  return fs.existsSync(encPath());
}
function limpiarTodo() {
  for (const f of [_mockFile, encPath()]) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) { /* mejor esfuerzo */ }
  }
  _encryptionDisponible = true;
}

const TOKENS_DE_EJEMPLO = {
  access_token: 'ya29.SECRETO-DE-PRUEBA-123',
  refresh_token: '1//0gSEGRETO-DE-PRUEBA-ABC',
  expiry_date: 4102444800000,
  scope: 'https://www.googleapis.com/auth/gmail.readonly',
  token_type: 'Bearer'
};

// ───────────────────────── Los checks

function chkGuardadoCifrado() {
  limpiarTodo();
  escribirConfig({ otraCosa: 42 });

  const ok = tokens.saveTokens(_mockFile, TOKENS_DE_EJEMPLO);

  chk('saveTokens() reporta exito con safeStorage disponible', ok === true);
  chk('se creo google-tokens.enc junto al config.json', existeEnc());

  const crudo = existeEnc() ? fs.readFileSync(encPath(), 'utf8') : '';
  chk('el refresh_token NO aparece en claro en el archivo cifrado',
    crudo.indexOf('SEGRETO-DE-PRUEBA-ABC') === -1);
  chk('el access_token NO aparece en claro en el archivo cifrado',
    crudo.indexOf('SECRETO-DE-PRUEBA-123') === -1);
  chk('el archivo cifrado no es JSON legible (esta realmente cifrado)',
    (function () { try { JSON.parse(crudo); return false; } catch (e) { return true; } })());

  const cfg = leerConfig();
  chk('config.json ya NO tiene la clave googleOAuth', !cfg.googleOAuth);
  chk('config.json conserva el resto de la configuracion (no se pisa el archivo entero)',
    cfg.otraCosa === 42);
}

function chkLectura() {
  limpiarTodo();
  escribirConfig({});
  tokens.saveTokens(_mockFile, TOKENS_DE_EJEMPLO);

  const leidos = tokens.loadTokens(_mockFile);
  chk('loadTokens() devuelve los tokens', !!leidos);
  chk('el access_token vuelve igual', leidos && leidos.access_token === TOKENS_DE_EJEMPLO.access_token);
  chk('el refresh_token vuelve igual', leidos && leidos.refresh_token === TOKENS_DE_EJEMPLO.refresh_token);
  chk('el expiry_date vuelve igual', leidos && leidos.expiry_date === TOKENS_DE_EJEMPLO.expiry_date);
  chk('el scope vuelve igual', leidos && leidos.scope === TOKENS_DE_EJEMPLO.scope);
  chk('leerse agrega savedAt', leidos && typeof leidos.savedAt === 'string');

  chk('hasValidTokens() dice que si con refresh_token', tokens.hasValidTokens(_mockFile) === true);
  chk('loadTokens() con archivo de tokens ausente devuelve null', (function () {
    limpiarTodo();
    return tokens.loadTokens(_mockFile) === null;
  })());
}

function chkMigracionDesdeTextoPlano() {
  limpiarTodo();
  escribirConfig({
    otraCosa: 'no perder',
    googleOAuth: {
      access_token: TOKENS_DE_EJEMPLO.access_token,
      refresh_token: TOKENS_DE_EJEMPLO.refresh_token,
      expiry_date: TOKENS_DE_EJEMPLO.expiry_date,
      scope: TOKENS_DE_EJEMPLO.scope,
      token_type: 'Bearer'
    }
  });

  const leidos = tokens.loadTokens(_mockFile);

  chk('la migracion devuelve los tokens viejos (el usuario NO re-autoriza)',
    !!leidos && leidos.refresh_token === TOKENS_DE_EJEMPLO.refresh_token);
  chk('la migracion crea google-tokens.enc', existeEnc());
  chk('la migracion borra googleOAuth de config.json', !leerConfig().googleOAuth);
  chk('la migracion conserva el resto de config.json', leerConfig().otraCosa === 'no perder');
  chk('tras migrar, loadTokens() sigue leyendo del archivo cifrado',
    (function () { const t = tokens.loadTokens(_mockFile); return t && t.refresh_token === TOKENS_DE_EJEMPLO.refresh_token; })());
}

function chkDesconectar() {
  limpiarTodo();
  escribirConfig({ otraCosa: 1 });
  tokens.saveTokens(_mockFile, TOKENS_DE_EJEMPLO);
  chk('antes de desconectar hay archivo cifrado', existeEnc());

  const ok = tokens.clearTokens(_mockFile);
  chk('clearTokens() reporta exito', ok === true);
  chk('clearTokens() borra google-tokens.enc', !existeEnc());
  chk('clearTokens() conserva el resto de config.json', leerConfig().otraCosa === 1);
  chk('hasValidTokens() dice que no despues de desconectar', tokens.hasValidTokens(_mockFile) === false);
}

function chkArchivoCorrupto() {
  limpiarTodo();
  escribirConfig({});
  tokens.saveTokens(_mockFile, TOKENS_DE_EJEMPLO);

  // Simula cambio de usuario de Windows / keyring distinta: el archivo esta ahi pero
  // no se puede descifrar con la clave actual.
  fs.writeFileSync(encPath(), 'ENC:basura-que-no-es-base64-valido', 'utf8');

  let noRevento = true;
  let resultado;
  try {
    resultado = tokens.loadTokens(_mockFile);
  } catch (e) {
    noRevento = false;
  }
  chk('un archivo cifrado que no se puede descifrar NO revienta la app', noRevento);
  chk('un archivo indescifrable devuelve null (el usuario re-autoriza)', resultado === null);
  chk('el archivo indescifrable se borra para no reintentar en cada arranque', !existeEnc());
}

function chkSinCifradoDisponible() {
  limpiarTodo();
  escribirConfig({ otraCosa: 7 });
  _encryptionDisponible = false;

  const ok = tokens.saveTokens(_mockFile, TOKENS_DE_EJEMPLO);
  chk('sin safeStorage, saveTokens() NO dice que guardo bien', ok === false);
  chk('sin safeStorage, NO se escribe google-tokens.enc', !existeEnc());
  chk('sin safeStorage, NO cae de vuelta a guardar en texto plano en config.json',
    !leerConfig().googleOAuth,
    'claves: ' + Object.keys(leerConfig()).join(','));
  chk('sin safeStorage, hasValidTokens() dice que no', tokens.hasValidTokens(_mockFile) === false);

  _encryptionDisponible = true;
}

// ───────────────────────── Correr

console.log('\n=======================================');
console.log('  Tokens OAuth de Google cifrados');
console.log('=======================================');

try {
  chkGuardadoCifrado();
  chkLectura();
  chkMigracionDesdeTextoPlano();
  chkDesconectar();
  chkArchivoCorrupto();
  chkSinCifradoDisponible();
} finally {
  Module._resolveFilename = _originalResolve; // recien acá se levanta el mock
  try { fs.rmSync(_mockDir, { recursive: true, force: true }); } catch (e) { /* mejor esfuerzo */ }
}

let failed = 0;
checks.forEach(function (c) {
  if (!c.ok) failed++;
  console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
});
console.log('---');
console.log((checks.length - failed) + '/' + checks.length + ' OK');
if (failed > 0) {
  console.log('FALLO — Hay tests que no pasaron.');
  process.exitCode = 1;
}