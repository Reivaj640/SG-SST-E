/* Test de 📦868: las credenciales de Google son de la APLICACIÓN, y el usuario
 * final nunca tiene que hacer nada para que su correo funcione.
 *
 * El bug que motivó esto (2026-10-06): en una PC sin `.env`, pulsar "Conectar
 * Gmail" abría el navegador a una URL con `client_id=` VACÍO (medido:
 * `...?state=x&response_type=code&client_id=&redirect_uri=`) y Google respondía
 * con "Acceso bloqueado — Missing required parameter: client_id — Error 400",
 * una pantalla que no menciona K+AIR. Peor: el callback server quedaba esperando
 * y el siguiente intento decía "Ya hay un flow de autorización activo".
 *
 * LA CAUSA DE FONDO no era el mensaje: era que las credenciales vivían SOLO en
 * un `.env`, que no viaja con el instalador. Por eso en el portátil del owner
 * funcionaba y en cualquier otra máquina no. El primer arreglo (un guard que
 * explicaba qué hacer) era un arreglo de desarrollador: le pedía al usuario
 * final editar un archivo que no sabe qué es. El arreglo de producto es otro:
 * que las credenciales de la app vayan EMBEBIDAS, porque no son secretos.
 *
 * Qué verifica:
 *   1. Existe `shared/google-oauth-config.js`, que es la fuente real, y se
 *      versiona (si estuviera en un .env, el bug volvería con cada instalador).
 *   2. `google-auth.js` usa ese config, y el `.env` quedó como override de
 *      desarrollo, no como fuente única.
 *   3. El `.env` ya NO es obligatorio: `available` da true con el config
 *      embebido aunque no exista el archivo.
 *   4. `main.js` corta ANTES de `startAuth()` si no hay credenciales, y el
 *      mensaje que vuelve NO lleva detalle técnico.
 *   5. `google-oauth:status` expone `available` y la vista lo consulta para NO
 *      ofrecer un botón que no puede funcionar.
 *   6. CHECK INVERTIDO: el texto que ve el usuario no puede mencionar `.env`,
 *      `CLIENT_ID`, `CLIENT_SECRET` ni OAuth. Antes lo hacía, y por eso este
 *      paquete existe. (Invertir un check, no borrarlo — §7.3.)
 *   7. El grafo de carga real: la única ruta viva es la vista de Gmail, y
 *      `calendar-operations.js` sigue muerto.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const mainPath = path.join(ROOT, 'main.js');
const authPath = path.join(ROOT, 'shared', 'google-auth.js');
const cfgPath = path.join(ROOT, 'shared', 'google-oauth-config.js');
const calPath = path.join(ROOT, 'renderer', 'bandeja-integrada', 'calendar-operations.js');
const cfgViewerPath = path.join(ROOT, 'components', 'config', 'config-viewer.html');
const envExamplePath = path.join(ROOT, '.env.example');
const gitignorePath = path.join(ROOT, '..', '.gitignore');
const buildGuardPath = path.join(ROOT, 'main', '_verificar-credenciales-build.js');
const pkgPath = path.join(ROOT, 'package.json');

const checks = [];
function chk(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra || '' });
}
function correr() {
  let failed = 0;
  checks.forEach(function (c) {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  process.exit(failed === 0 ? 0 : 1);
}

[mainPath, authPath, calPath, cfgViewerPath].forEach(function (p) {
  if (!fs.existsSync(p)) { console.error('FAIL: falta ' + p); process.exit(1); }
});
chk('existe shared/google-oauth-config.js (la fuente real de las credenciales)',
  fs.existsSync(cfgPath));
if (!fs.existsSync(cfgPath)) correr();

const mainSrc = fs.readFileSync(mainPath, 'utf8');
const authSrc = fs.readFileSync(authPath, 'utf8');
const calSrc = fs.readFileSync(calPath, 'utf8');
const cfgSrc = fs.readFileSync(cfgViewerPath, 'utf8');
const cfgConfSrc = fs.readFileSync(cfgPath, 'utf8');

// 📦868 — piezas de la decisión "repo público ⇒ el secret no va en git".
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const pkgScripts = pkg.scripts || {};
const pkgBuildFiles = (pkg.build && pkg.build.files) || null;
const pkgPublish = (pkg.build && pkg.build.publish) || null;
const gitignoreSrc = fs.readFileSync(gitignorePath, 'utf8');
const buildGuardSrc = fs.existsSync(buildGuardPath)
  ? fs.readFileSync(buildGuardPath, 'utf8')
  : '';

/* ── 1-3. la configuración embebida ─────────────────────────────────────── */
const config = require(cfgPath);
chk('el config exporta clientId, clientSecret y available',
  typeof config.clientId === 'string' && typeof config.clientSecret === 'string' && 'available' in config);
chk('el config declara el redirect_uri que coincide con el puerto',
  config.redirectPort === 42813 && /42813\/oauth2callback$/.test(config.redirectUri || ''),
  config.redirectUri);
// 📦868 CORRECCIÓN 2026-10-06 — hubo una creencia equivocada que estos checks fijaban:
// que el `client_secret` era opcional en Desktop+PKCE. Se dedujo leyendo
// google-auth-library (que con `clientAuthentication = 'None'` omite el secreto del
// body) y NO preguntando a Google. Al probarlo de verdad, el endpoint de canje
// respondió {"error":"invalid_request","error_description":"client_secret is missing."}
// El síntoma era el peor: el navegador se abría, el cliente autorizaba los 5
// permisos, y al final se perdía la conexión.
//
// Estos checks están INVERTIDOS a propósito (§7.3: invertir, no borrar): ahora fijan
// que el secret es NECESARIO. Si alguien vuelve a la creencia vieja, muerden.
chk('`available` depende de LAS DOS credenciales (sin el secret el canje falla)',
  /available\s*=\s*!!\(\s*OAUTH_CONFIG\.clientId\s*&&\s*OAUTH_CONFIG\.clientSecret\s*\)/.test(cfgConfSrc));
chk('INVERTIDO: el config ya NO dice que el secret es opcional',
  !/clientSecret` es OPCIONAL/.test(cfgConfSrc) && !/Dejalo vacío/.test(cfgConfSrc));
chk('el config deja asentado el error REAL de Google (client_secret is missing)',
  /client_secret is missing/.test(cfgConfSrc));
chk('el config explica por qué se embebe un "secreto" de escritorio',
  /no lo vuelve secreto/.test(cfgConfSrc));

/* ── 1b. las credenciales NO van en el archivo versionado ────────────────────
 *
 * 📦868-Corrección: el repo es PÚBLICO y GitHub bloquea el push cuando detecta un
 * `client_secret` (GH013). Y el repo NO puede ser privado: el auto-updater usa
 * `publish: {provider: "github"}` y electron-updater pega a la API de releases SIN
 * token, así que un repo privado devolvería 404 y TODOS los clientes dejarían de
 * recibir actualizaciones.
 *
 * O sea: repo público ⇒ el secret no puede estar en el historial. Las credenciales
 * viven en el `.env` de la máquina que compila, que electron-builder NO excluye del
 * instalador, así que le llegan al cliente sin que configure nada.
 */
chk('el config VERSIONADO queda VACÍO (repo público: el secret no puede estar en el historial)',
  /^var OAUTH_CONFIG = \{[\s\S]*?clientId:\s*''/m.test(cfgConfSrc) &&
  /clientSecret:\s*''/.test(cfgConfSrc));
chk('.env está en .gitignore (las credenciales del build no se commitean)',
  /^\s*\.env\s*$/m.test(gitignoreSrc));
chk('electron-builder NO excluye .env del instalador (por eso le llega al cliente)',
  Array.isArray(pkgBuildFiles) &&
  !pkgBuildFiles.some(f => /(^|\/)\.env(\*|\$|\/)/.test(f)),
  (Array.isArray(pkgBuildFiles) ? pkgBuildFiles.length : 0) + ' reglas de files');
chk('existe el guardia de build que corta si faltan credenciales',
  fs.existsSync(buildGuardPath));
chk('el guardia exige LAS DOS credenciales',
  /falta\.push\('client_id'\)/.test(buildGuardSrc) && /falta\.push\('client_secret'\)/.test(buildGuardSrc));
chk('el guardia corta con exit 1 (que se el build, no un aviso)',
  /process\.exit\(1\)/.test(buildGuardSrc));
chk('el guardia está enganchado a los scripts de build como hook `pre`',
  pkgScripts['prebuild'] && /_verificar-credenciales-build/.test(pkgScripts['prebuild']) &&
  pkgScripts['prebuild:win'] && /_verificar-credenciales-build/.test(pkgScripts['prebuild:win']));
chk('.env.example documenta el flujo de compilación (que el secret va al .env del build, no al repo)',
  /\.env/.test(fs.readFileSync(envExamplePath, 'utf8')) &&
  /electron-builder|electron_builder/i.test(fs.readFileSync(envExamplePath, 'utf8')));
// El repo público + updater por GitHub sin token es la razón de todo esto:
// si alguien cambia el provider del updater, este check deja de ser redundante.
chk('el auto-updater sigue con provider "github" sin token (por eso el repo debe ser público)',
  pkgPublish && pkgPublish.provider === 'github' && !/privateKey|token/i.test(JSON.stringify(pkgPublish || {})));

// El aviso del log y `available` tienen que JUZGAR LO MISMO, o el que lee el log
// termina desconfiando del que dice la verdad.
chk('el aviso de "faltan credenciales" usa el MISMO criterio que `available` (las dos)',
  /if\s*\(\s*!CLIENT_ID\s*\|\|\s*!CLIENT_SECRET\s*\)/.test(authSrc));
chk('INVERTIDO: el aviso del log ya NO afirma que el secret no hace falta',
  !/client_secret no hace falta/.test(authSrc) &&
  !/El client_secret no hace falta/.test(authSrc));

chk('google-auth usa el config embebido',
  /require\(\s*['"]\.\/google-oauth-config['"]\s*\)/.test(authSrc));
chk('el .env quedó como OVERRIDE de desarrollo, no como fuente única',
  /process\.env\.GOOGLE_OAUTH_CLIENT_ID\s*\|\|\s*oauthConfig\.clientId/.test(authSrc) &&
  /process\.env\.GOOGLE_OAUTH_CLIENT_SECRET\s*\|\|\s*oauthConfig\.clientSecret/.test(authSrc));
chk('NO se quedó solo con process.env (eso era el bug)',
  !/var CLIENT_ID = process\.env\.GOOGLE_OAUTH_CLIENT_ID;/.test(authSrc));
chk('google-auth expone `available` con las DOS credenciales',
  /available:\s*!!\(\s*CLIENT_ID\s*&&\s*CLIENT_SECRET\s*\)/.test(authSrc));
// ESTE es el check que más importa: `clientAuthentication = 'None'` hace que la
// librería NO mande el secreto, y Google lo rechaza. Volver a ponerlo rompe el canje.
chk('INVERTIDO: el canje ya NO usa ClientAuthentication.None (Google lo rechaza sin secret)',
  !/clientAuthentication\s*=\s*'None'/.test(authSrc));
chk('sin secret, se pasa cadena vacía y no undefined (undefined se serializa como el texto "undefined")',
  /new google\.auth\.OAuth2\(CLIENT_ID,\s*CLIENT_SECRET \|\| ''/.test(authSrc));
// Los handlers de OAuth tienen que escribir en sendLog, no solo en console.error:
// con console.error el fallo del canje no deja rastro en main.log y no hay forma de
// diagnosticarlo (pasó el 2026-10-06: hubo que reproducir la petición a mano).
chk('los handlers de OAuth escriben en sendLog (el fallo del canje tiene que dejar rastro)',
  /sendLog\('\[GoogleOAuth\] Error en exchange:/.test(mainSrc) &&
  /sendLog\('\[GoogleOAuth\] Error en await-callback:/.test(mainSrc) &&
  /sendLog\('\[GoogleOAuth\] Error en start:/.test(mainSrc));
chk('el redirect sale del config (el puerto tiene que estar registrado en Google)',
  /oauthConfig\.redirectPort/.test(authSrc) && /oauthConfig\.redirectUri/.test(authSrc));

/* ── 4. el guard, antes del navegador ───────────────────────────────────── */
const iHandler = mainSrc.indexOf("ipcMain.handle('google-oauth:start'");
// OJO: se localiza la línea DEL `if`, no la primera mención de la cadena. El
// comentario del guard también dice "googleAuth.available", así que buscar con
// indexOf daba la posición del comentario —una mutación que moviera el guard
// después de startAuth() pasaba inadvertida.
const mGuard = mainSrc.match(/if \(!googleAuth\.available\)/);
const iGuard = mGuard ? mGuard.index : -1;
const iStartAuth = mainSrc.indexOf('googleAuth.startAuth()', iHandler === -1 ? 0 : iHandler);

chk('existe el handler google-oauth:start', iHandler !== -1);
chk('el handler corta usando googleAuth.available', iGuard !== -1);
chk('el guard esta ANTES de startAuth() (si no, el navegador ya se abrio)',
  iGuard !== -1 && iStartAuth !== -1 && iGuard < iStartAuth,
  iGuard !== -1 && iStartAuth !== -1 ? 'guard en ' + iGuard + ', startAuth en ' + iStartAuth : '');
chk('el guard NO abre el navegador',
  iGuard !== -1 && iStartAuth !== -1 && mainSrc.slice(iGuard, iStartAuth).indexOf('openExternal') === -1);
chk('el guard deja el detalle para el log, no para el usuario',
  iGuard !== -1 && iStartAuth !== -1 &&
  mainSrc.slice(iGuard, iStartAuth).indexOf('sendLog(') !== -1 &&
  /console\.error\('\[GoogleOAuth\]/.test(mainSrc));

/* ── 5. la vista consulta y respeta `available` ─────────────────────────── */
chk('google-oauth:status expone `available`',
  /ipcMain\.handle\('google-oauth:status'[\s\S]{0,2500}available:\s*!!googleAuth\.available/.test(mainSrc));
chk('la vista guarda available en su estado',
  /gmailSectionState\.available\s*=\s*d\.available\s*!==\s*false/.test(cfgSrc));
chk('la vista lo declara en el estado inicial (undefined = todavia no consultado)',
  /available:\s*undefined/.test(cfgSrc));
chk('la vista oculta el boton de conectar cuando no esta disponible',
  /available === false[\s\S]{0,600}btnConnect\.style\.display = 'none'/.test(cfgSrc));
chk('la vista consulta available ANTES de ofrecer el boton',
  /!\s*d\.connected[\s\S]{0,900}!gmailSectionState\.available/.test(cfgSrc));

/* ── 6. CHECK INVERTIDO: el usuario no ve jerga técnica ─────────────────── */
function textoQueVeElUsuario() {
  // Todo string literal dentro de la función de conectar. Antes el mensaje iba
  // directo en el `alert('...')`; ahora pasa por una variable (`var detalle =`),
  // así que un extractor que solo busque `alert(` ya no encuentra nada y el check
  // daba verde sobre un archivo que mostraba jerga.
  const iFn = cfgSrc.indexOf('async function onGmailConnectClick');
  if (iFn === -1) return '';
  const cuerpo = cfgSrc.slice(iFn, iFn + 3500);
  // Textos de la vista, no de la consola: se excluye lo que va a console.* y a alert().
  const literales = cuerpo.match(/'[^'\n]{12,}'/g) || [];
  const deConsola = (cuerpo.match(/console\.[a-z]+\([^)]*\)/g) || []).join(' ');
  return literales.filter(function (l) { return deConsola.indexOf(l) === -1; }).join(' ');
}
const alertas = textoQueVeElUsuario();
chk('hay al menos un mensaje al usuario en la seccion de correo', alertas.length > 0);
const jerga = [
  ['.env', /\.env/],
  ['GOOGLE_OAUTH_CLIENT_ID', /GOOGLE_OAUTH_CLIENT_ID/],
  ['GOOGLE_OAUTH_CLIENT_SECRET', /GOOGLE_OAUTH_CLIENT_SECRET/],
  ['"OAuth"', /OAuth/i],
  ['"flow"', /flow/i],
  ['"instalación"', /instalaci/i],
  ['"tokens"', /tokens/i],
  ['"código de autorización"', /c[oó]digo de autorizaci/i],
  ['"error desconocido" crudo', /error desconocido/i],
  ['"intercambiar"/"exchange"', /intercambiar el code/i]
];
let hayJerga = [];
jerga.forEach(function (par) {
  if (par[1].test(alertas)) hayJerga.push(par[0]);
});
chk('INVERTIDO: NINGUN mensaje al usuario lleva jerga técnica',
  hayJerga.length === 0,
  hayJerga.length ? 'se escapo: ' + hayJerga.join(', ') : 'limpio (sin .env, sin nombres de variables, sin OAuth/flow, sin tokens, sin el error crudo de Google)');
chk('el error crudo de Google NO se concatena al alert',
  !/alert\([^)]*\+\s*(cbRes|exRes)\b/.test(cfgSrc));
chk('el detalle técnico se manda a la consola en los tres fallos',
  /console\.error\('\[GmailSection\] awaitCallback fallo:/.test(cfgSrc) &&
  /console\.error\('\[GmailSection\] exchange fallo:/.test(cfgSrc) &&
  /console\.error\('\[GmailSection\] google\.start\(\) fallo:/.test(cfgSrc));
chk('el texto que se muestra en la sección NO le pide al usuario que configure nada',
  !/Contactá al administrador[\s\S]{0,120}(archivo|\.env|configur)/i.test(cfgSrc));
chk('el texto de la sección deshabilitada es corto y accionable (una línea)',
  /Conectá tu correo con el administrador de K\+AIR/.test(cfgSrc));

/* ── 7. grafo de carga real ─────────────────────────────────────────────── */
function scriptsCargadosDe(htmlPath) {
  const fuera = [];
  try {
    const t = fs.readFileSync(htmlPath, 'utf8');
    const dir = path.dirname(htmlPath);
    const m = t.match(/src\s*=\s*["']([^"']+\.js)[^"']*["']/g) || [];
    m.forEach(function (raw) {
      const rel = raw.replace(/^src\s*=\s*["']/, '').replace(/["'].*$/, '').split('?')[0];
      const abs = path.resolve(dir, rel);
      if (fs.existsSync(abs)) fuera.push(abs);
    });
  } catch (e) { /* sin HTML, sin scripts */ }
  return fuera;
}
const htmls = [path.join(ROOT, 'index.html'), path.join(ROOT, 'renderer', 'bandeja-integrada', 'index.html')]
  .filter(function (h) { return fs.existsSync(h); });
const cargados = [];
htmls.forEach(function (h) { scriptsCargadosDe(h).forEach(function (f) { if (cargados.indexOf(f) === -1) cargados.push(f); }); });

chk('se pudo leer el grafo de carga real de la vista', cargados.length > 0,
  cargados.length + ' scripts por <script src>');
chk('la vista de Gmail llama a electronAPI.google.start()',
  cfgSrc.indexOf('electronAPI.google.start(') !== -1);
const otrosVivos = cargados.filter(function (f) {
  try { return fs.readFileSync(f, 'utf8').indexOf('google.start(') !== -1; } catch (e) { return false; }
});
chk('ningun otro script vivo llama a google.start()', otrosVivos.length === 0,
  otrosVivos.length ? otrosVivos.map(function (f) { return path.basename(f); }).join(', ') : 'ninguno');
chk('calendar-operations.js NO se carga (si esto falla, revivio y hay que repararlo)',
  cargados.indexOf(calPath) === -1,
  cargados.indexOf(calPath) !== -1 ? 'ya se carga: hay que dealarlo' : 'sigue muerto');

/* ── 8. el .env sigue siendo un override, documentado y sin versionar ───── */
chk('existe .env.example', fs.existsSync(envExamplePath));
if (fs.existsSync(envExamplePath)) {
  const ej = fs.readFileSync(envExamplePath, 'utf8');
  chk('.env.example sigue documentando el client_id', /GOOGLE_OAUTH_CLIENT_ID/.test(ej));
  chk('.env.example deja el client_secret VACIO (es un placeholder, no un valor real)',
    /GOOGLE_OAUTH_CLIENT_SECRET=\s*$/m.test(ej));
  chk('INVERTIDO: .env.example ya NO afirma que el secret es opcional',
    !/es OPCIONAL para Desktop apps/.test(ej));
  chk('.env.example deja asentado el error REAL de Google (client_secret is missing)',
    /client_secret is missing/.test(ej));
  chk('.env.example avisa que Google solo muestra el secret UNA vez',
    /UNA sola/.test(ej) && /no hay forma de recuperarlo/.test(ej));
  // Check ESPECIFICO, no "menciona optional en algun lado": el archivo repetía
  // "override" y "desarrollo" en varias líneas, así que un check flojo daba verde
  // aunque el encabezado siguiera diciendo que el .env es obligatorio.
  chk('.env.example dice explícitamente que YA NO ES OBLIGATORIO',
    /YA NO ES OBLIGATORIO/i.test(ej));
  chk('.env.example NO empieza pidiéndole que lo copies para que funcione',
    !/COPIAR este archivo a `\.env`[\s\S]{0,80}completar con los valores reales/i.test(ej));
  chk('.env.example apunta a la fuente real de las credenciales',
    /google-oauth-config\.js/.test(ej));
}
chk('.env esta ignorado por git',
  fs.existsSync(gitignorePath) && /^\s*\.env\s*$/m.test(fs.readFileSync(gitignorePath, 'utf8')));
chk('el config embebido SI se versiona (por eso funciona en cualquier instalador)',
  !/^\s*shared\/google-oauth-config\.js\s*$/m.test(fs.readFileSync(gitignorePath, 'utf8')));

correr();