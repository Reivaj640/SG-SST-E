/* Test de 📦931: las contrasenas de correo NO viven en el codigo.
 *
 * Por que este test existe (2026-10-23): las app passwords de Gmail de las
 * cinco cuentas de remisiones medicas estaban escritas en `utils/emailSender.js`
 * y DUPLICADAS en dos archivos de `Portear/src/`. El repo es PUBLICO, asi que
 * esas contrasenes quedaron en el historial de git y se repartian con el
 * instalador a cada cliente final (los archivos de `Portear/src` van en
 * `extraResources`).
 *
 * Sacarlas del codigo NO las invalida: eso es ROTARLAS en Google Account >
 * Seguridad > Contrasenas de aplicacion, y es una tarea del owner. Lo que este
 * test verifica es que la credencial no vuelva a aparecer en el codigo.
 *
 * Que verifica:
 *   1. CHECK INVERTIDO: no hay ninguna app password en el codigo (ni en el
 *      JS ni en los dos Python que se empaquetan).
 *   2. La contrasena se lee del entorno, y el `.env` se re-lee en cada envio
 *      (para que una rotacion aplique sin reiniciar la app).
 *   3. El cargador vive en `shared/`, NO en `utils/`: `utils/**` esta en
 *      `asarUnpack`, y ahi el `.env` NO existe (viaja dentro de `app.asar`).
 *      Un cargador en `utils/` funciona en desarrollo y falla SOLO en el
 *      instalador: el peor sintoma posible.
 *   4. `.env` (y `.env.*`) esta en `.gitignore`, y los ejemplos NO.
 *   5. El guardia de build exige las cinco contrasenas y corta con exit 1: sin
 *      esto, el build sale con "Enviar por correo" muerto y el unico sintoma
 *      es un error de Gmail que no menciona K+AIR.
 *   6. CHECK INVERTIDO: el mensaje que ve el usuario final NO puede mencionar
 *      `.env` ni el nombre de una variable (ese mensaje llega al renderer).
 *   7. La API publica no cambia: el renderer depende de ella.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const senderPath = path.join(ROOT, 'utils', 'emailSender.js');
const loaderPath = path.join(ROOT, 'shared', 'env-loader.js');
const mainPath = path.join(ROOT, 'main.js');
const pyUtilsPath = path.join(ROOT, 'Portear', 'src', 'remision_utils.py');
const pyRemisionesPath = path.join(ROOT, 'Portear', 'src', 'Remisiones_v1.0.py');
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

[senderPath, loaderPath, mainPath, pyUtilsPath, pyRemisionesPath].forEach(function (p) {
  if (!fs.existsSync(p)) { console.error('FAIL: falta ' + p); process.exit(1); }
});

const senderSrc = fs.readFileSync(senderPath, 'utf8');
const loaderSrc = fs.readFileSync(loaderPath, 'utf8');
const mainSrc = fs.readFileSync(mainPath, 'utf8');
const pyUtilsSrc = fs.readFileSync(pyUtilsPath, 'utf8');
const pyRemisionesSrc = fs.readFileSync(pyRemisionesPath, 'utf8');
const envExampleSrc = fs.readFileSync(envExamplePath, 'utf8');
const gitignoreSrc = fs.readFileSync(gitignorePath, 'utf8');
const buildGuardSrc = fs.existsSync(buildGuardPath) ? fs.readFileSync(buildGuardPath, 'utf8') : '';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const pkgBuildFiles = (pkg.build && pkg.build.files) || [];
const pkgAsarUnpack = (pkg.build && pkg.build.asarUnpack) || [];

// El patron de una app password de Google: 16 letras minusculas en 4 grupos.
const RE_APP_PASSWORD = /\b[a-z]{4}\s[a-z]{4}\s[a-z]{4}\s[a-z]{4}\b/;

// El patron de una app password de Google: 16 letras minusculas en 4 grupos.
// ("xxxx xxxx xxxx xxxx") no es una credencial, y si no se discrimina, el
// check se vuelve mudo (que es peor que no tener check).
function literales(src) {
  return src.match(/(['"`])(?:\\.|(?!\1)[\s\S])*\1/g) || [];
}
// El placeholder documentado ("xxxx xxxx xxxx xxxx") NO es una credencial: es
// el formato que se explica en los comentarios. Una credencial REAL es
// cualquiera otra con esa forma.
const PLACEHOLDER = 'xxxx xxxx xxxx xxxx';
function appPasswordesReales(src) {
  return literales(src).filter(function (l) {
    const m = l.match(RE_APP_PASSWORD);
    return !!m && m[0] !== PLACEHOLDER;
  });
}

// ── 1. INVERTIDO: la contrasena no esta en el codigo ─────────────────────────
chk('INVERTIDO: utils/emailSender.js NO tiene ninguna app password',
  appPasswordesReales(senderSrc).length === 0,
  appPasswordesReales(senderSrc).length + ' encontradas');
chk('INVERTIDO: utils/emailSender.js NO tiene ningun literal password: "..."',
  !/password\s*:\s*["'][^"']+["']/.test(senderSrc));
chk('INVERTIDO: Portear/src/remision_utils.py NO tiene ninguna app password',
  appPasswordesReales(pyUtilsSrc).length === 0);
chk('INVERTIDO: Portear/src/Remisiones_v1.0.py NO tiene ninguna app password',
  appPasswordesReales(pyRemisionesSrc).length === 0);
chk('INVERTIDO: Portear/src/remision_utils.py NO tiene ningun literal password',
  !/["']password["']\s*:\s*["'][^"']+["']/.test(pyUtilsSrc));
chk('INVERTIDO: Portear/src/Remisiones_v1.0.py NO tiene ningun literal password',
  !/["']password["']\s*:\s*["'][^"']+["']/.test(pyRemisionesSrc));

// ── 2. La contrasena se lee del entorno, y se re-lee ─────────────────────────
chk('emailSender lee la credencial del entorno (no de un literal)',
  /envLoader\.resolverVariables/.test(senderSrc) &&
  /variable:\s*["']KAIR_EMAIL_/.test(senderSrc));
chk('el .env se RE-LEE en cada construccion (una rotacion aplica sin reiniciar)',
  /resolverVariables/.test(senderSrc) &&
  /leerArchivoEnv/.test(loaderSrc) &&
  !/const\s+password\s*=\s*process\.env\[[^\]]+\]\s*;\s*$/m.test(senderSrc));
chk('process.env tiene precedencia sobre el .env (lo que impone el sistema gana)',
  /process\.env\[clave\]/.test(loaderSrc));
chk('la direccion de correo SIGUE en el codigo (no es un secreto)',
  /tempoactivaestsas@gmail\.com/.test(senderSrc) &&
  /asepluscaribesas@gmail\.com/.test(senderSrc));

// ── 3. El cargador vive en shared/, no en utils/ ─────────────────────────────
chk('el cargador del .env esta en shared/ (ahi SI llega el .env en el build)',
  fs.existsSync(loaderPath) &&
  !fs.existsSync(path.join(ROOT, 'utils', 'env-loader.js')));
chk('emailSender USA el cargador de shared/ (si lo buscara en utils/, en el build no estaria)',
  /require\(\s*['"]\.\.\/shared\/env-loader['"]\s*\)/.test(senderSrc));
chk('shared/** NO esta en asarUnpack (si lo estuviera, el .env no estaria ahi)',
  !pkgAsarUnpack.some(function (r) { return /shared/.test(r); }),
  JSON.stringify(pkgAsarUnpack));
chk('utils/** SI esta en asarUnpack (por eso el cargador no puede ir en utils/)',
  pkgAsarUnpack.some(function (r) { return /utils/.test(r); }));

// ── 4. El .gitignore ─────────────────────────────────────────────────────────
chk('.env esta en .gitignore',
  /^\s*\.env\s*$/m.test(gitignoreSrc));
chk('.env.* (production, staging, lo que sea) tambien esta en .gitignore',
  /^\s*\.env\.\*\s*$/m.test(gitignoreSrc));
chk('los ejemplos SI se versionan (la negacion despues del patron)',
  /^\s*!\.env\.example\s*$/m.test(gitignoreSrc) &&
  /^\s*!\.env\.\*\.example\s*$/m.test(gitignoreSrc));

// ── 5. La guardia de build ───────────────────────────────────────────────────
chk('existe la guardia de build',
  fs.existsSync(buildGuardPath));
chk('la guardia exige las CINCO contrasenas de correo',
  /KAIR_EMAIL_TEMPOACTIVA_PASSWORD/.test(buildGuardSrc) &&
  /KAIR_EMAIL_TEMPOSUM_PASSWORD/.test(buildGuardSrc) &&
  /KAIR_EMAIL_ASEPLUS_PASSWORD/.test(buildGuardSrc) &&
  /KAIR_EMAIL_ASEL_PASSWORD/.test(buildGuardSrc) &&
  /KAIR_EMAIL_COOTRACOM_PASSWORD/.test(buildGuardSrc));
chk('la guardia corta con exit 1 si falta una contrasena (que se el build)',
  /contrasenasFaltan\.length/.test(buildGuardSrc) &&
  /process\.exit\(1\)/.test(buildGuardSrc));
chk('la guardia avisa si la contrasena no tiene el formato de app password',
  /\[a-z\]\{4\}\\s\[a-z\]\{4\}\\s\[a-z\]\{4\}\\s\[a-z\]\{4\}/.test(buildGuardSrc));

// ── 6. INVERTIDO: el mensaje del usuario no habla de variables ───────────────
chk('INVERTIDO: el mensaje de credencial faltante NO menciona `.env`',
  !/El envio por correo no esta disponible[\s\S]{0,200}\.env/.test(senderSrc) &&
  !/error\.detalle\s*=\s*`[^`]*\.env/.test(senderSrc));
chk('INVERTIDO: el mensaje de credencial faltante NO menciona KAIR_EMAIL_',
  !/new Error\(\s*`[^`]*KAIR_EMAIL_/.test(senderSrc) &&
  !/new Error\(\s*'[^']*KAIR_EMAIL_/.test(senderSrc));
chk('el detalle tecnico (con el nombre de la variable) va aparte, en `detalle`',
  /error\.detalle\s*=/.test(senderSrc));
chk('main.js loguea el detalle tecnico, no el mensaje del usuario',
  /error\.detalle\s*\|\|\s*error\.message/.test(mainSrc));

// ── 7. La API publica no cambia ──────────────────────────────────────────────
chk('la API publica se preserva: new EmailSender(empresa)',
  /constructor\(empresa\)/.test(senderSrc));
chk('la API publica se preserva: enviarCorreo({destinatario, nombre, fechaAtencion, archivoAdjunto})',
  /enviarCorreo\(\{\s*destinatario,\s*nombre,\s*fechaAtencion,\s*archivoAdjunto\s*\}\)/.test(senderSrc));
chk('la API publica se preserva: el retorno {success, message, messageId} / {success, error}',
  /success:\s*true/.test(senderSrc) && /success:\s*false/.test(senderSrc) &&
  /messageId/.test(senderSrc));

// ── 8. El empaquetado ────────────────────────────────────────────────────────
chk('electron-builder NO excluye el .env de la app (para que el correo funcione en el cliente)',
  !pkgBuildFiles.some(function (f) { return /(^|\/)\.env(\*|\$|\/)/.test(f); }),
  pkgBuildFiles.length + ' reglas de files');
chk('electron-builder EXCLUYE el .env del firma-service (las llaves de produccion no viajan)',
  pkgBuildFiles.some(function (f) { return /firma-service\/\.env/.test(f); }) &&
  pkgBuildFiles.some(function (f) { return /firma-service\/\*\*\/\.env/.test(f); }));
chk('.env.example documenta las cinco variables de correo (con placeholders vacios)',
  /KAIR_EMAIL_TEMPOACTIVA_PASSWORD=/.test(envExampleSrc) &&
  /KAIR_EMAIL_TEMPOSUM_PASSWORD=/.test(envExampleSrc) &&
  /KAIR_EMAIL_ASEPLUS_PASSWORD=/.test(envExampleSrc) &&
  /KAIR_EMAIL_ASEL_PASSWORD=/.test(envExampleSrc) &&
  /KAIR_EMAIL_COOTRACOM_PASSWORD=/.test(envExampleSrc) &&
  !/KAIR_EMAIL_[A-Z_]+=[ \t]*\S/.test(envExampleSrc),
  'sin valores');

correr();
