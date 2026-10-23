/* 📦868 — Guardia de build: no dejar pasar un instalador sin credenciales de Google.
 *
 * Por qué existe: desde que GitHub bloquea el push por secret scanning (el repo es
 * PÚBLICO), las credenciales ya no pueden vivir en el archivo versionado. Viven en un
 * `.env` local de la máquina que compila. Eso significa que se puede compilar el
 * instalador en una máquina sin ese `.env` y salir un K-AIR-Setup donde el correo NO
 * conecta — y el síntoma sería, otra vez, el error de Google que no menciona K+AIR.
 *
 * Mejor que eso: que el build se corte acá, con un mensaje que dice exactamente qué
 * falta y dónde ponerlo.
 *
 * Se corre como `prebuild` de npm: si tira exit 1, electron-builder ni arranca.
 */
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..');
const envPath = path.join(APP, '.env');
const cfgPath = path.join(APP, 'shared', 'google-oauth-config.js');

function leerEnv(p) {
  const salida = {};
  if (!fs.existsSync(p)) return salida;
  for (const linea of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      let valor = m[2];
      // 📦931 — Las comillas opcionales se quitan: una app password de
      // Google ("xxxx xxxx xxxx xxxx") SIEMPRE va entre comillas, y sin
      // quitarlas el chequeo de formato de abajo daria un falso negativo.
      if ((valor.charAt(0) === '"' && valor.charAt(valor.length - 1) === '"') ||
          (valor.charAt(0) === "'" && valor.charAt(valor.length - 1) === "'")) {
        valor = valor.substring(1, valor.length - 1);
      }
      salida[m[1]] = valor;
    }
  }
  return salida;
}

function leerConfig(p) {
  if (!fs.existsSync(p)) return {};
  const s = fs.readFileSync(p, 'utf8');
  return {
    clientId: (s.match(/clientId:\s*'([^']*)'/) || [])[1] || '',
    clientSecret: (s.match(/clientSecret:\s*'([^']*)'/) || [])[1] || ''
  };
}

const env = leerEnv(envPath);
const cfg = leerConfig(cfgPath);

const id = env.GOOGLE_OAUTH_CLIENT_ID || cfg.clientId;
const secret = env.GOOGLE_OAUTH_CLIENT_SECRET || cfg.clientSecret;

const falta = [];
if (!id) falta.push('client_id');
if (!secret) falta.push('client_secret');

// 📦931 — Las contrasenas de correo de las remisiones medicas ya NO viven en
// el codigo (utils/emailSender.js las lee del entorno). Si el `.env` no las
// trae, el instalador sale con "Enviar por correo" muerto: el mismo fallo que
// el guard de Google previene, para el otro canal.
const CUENTAS_EMAIL = [
  ['TEMPOACTIVA', 'KAIR_EMAIL_TEMPOACTIVA_PASSWORD'],
  ['TEMPOSUM', 'KAIR_EMAIL_TEMPOSUM_PASSWORD'],
  ['ASEPLUS', 'KAIR_EMAIL_ASEPLUS_PASSWORD'],
  ['ASEL', 'KAIR_EMAIL_ASEL_PASSWORD'],
  ['COOTRACOM', 'KAIR_EMAIL_COOTRACOM_PASSWORD']
];
const contrasenasFaltan = [];
for (const [, variable] of CUENTAS_EMAIL) {
  if (!env[variable]) contrasenasFaltan.push(variable);
}

if (falta.length) {
  console.error('');
  console.error('╔══════════════════════════════════════════════════════════════╗');
  console.error('║  BUILD DETENIDO: faltan credenciales de Google                ║');
  console.error('╚══════════════════════════════════════════════════════════════╝');
  console.error('');
  console.error('  Falta: ' + falta.join(' y '));
  console.error('');
  console.error('  Sin esto el instalador sale con el correo desconectado, y el');
  console.error('  único síntoma sería un error de Google que no menciona K+AIR.');
  console.error('');
  console.error('  Pegalo en este archivo de la maquina que compila:');
  console.error('    ' + envPath);
  console.error('');
  console.error('    GOOGLE_OAUTH_CLIENT_ID=<tu client_id>.apps.googleusercontent.com');
  console.error('    GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-...');
  console.error('');
  console.error('  Ese .env esta en .gitignore (no se commitea) y electron-builder');
  console.error('  NO lo excluye del instalador, asi que viaja adentro y el cliente');
  console.error('  final recibe la app ya conectada, sin configurar nada.');
  console.error('');
  console.error('  (Lo encuentras en Google Auth Platform > Clientes > tu cliente)');
  console.error('');
  process.exit(1);
}

// 📦931 — El guard de las contrasenas de correo.
if (contrasenasFaltan.length) {
  console.error('');
  console.error('╔══════════════════════════════════════════════════════════════╗');
  console.error('║  BUILD DETENIDO: faltan contrasenas de correo por empresa     ║');
  console.error('╚══════════════════════════════════════════════════════════════╝');
  console.error('');
  console.error('  Falta: ' + contrasenasFaltan.join(', '));
  console.error('');
  console.error('  Son las app passwords de Gmail con las que salen las remisiones');
  console.error('  medicas. Sin ellas, el boton "Enviar por correo" queda muerto en');
  console.error('  el instalador, y el unico sintoma seria un error de Gmail que no');
  console.error('  menciona K+AIR.');
  console.error('');
  console.error('  Pegalas en este archivo de la maquina que compila:');
  console.error('    ' + envPath);
  console.error('');
  for (const [empresa, variable] of CUENTAS_EMAIL) {
    console.error('    ' + variable + '="xxxx xxxx xxxx xxxx"    // ' + empresa);
  }
  console.error('');
  console.error('  SIEMPRE entre comillas: la contrasena tiene espacios.');
  console.error('');
  console.error('  OJO: estas credenciales AUCAN estar en el codigo. Si la maquina');
  console.error('  que compila no las tiene, no las copies del repo: rotalas en');
  console.error('  Google Account > Seguridad > Contrasenas de aplicacion.');
  console.error('');
  process.exit(1);
}

// Aviso de formato: no corta el build, pero avisa si algo está claramente mal,
// porque una credencial con formato raro NO da error al empaquetar: da error
// cuando el cliente intenta conectarse, que es peor.
const avisos = [];
if (!/^\d+-[A-Za-z0-9]+\.apps\.googleusercontent\.com$/.test(id)) {
  avisos.push('el client_id no tiene el formato <numero>-<hash>.apps.googleusercontent.com');
}
if (!/^GOCSPX-/.test(secret)) {
  avisos.push('el client_secret no arranca con GOCSPX-');
}

// 📦931 — El formato de una app password de Google son 16 letras minusculas
// en 4 grupos de 4. Si no lo tiene, el build pasa igual pero el envio falla
// en la PC del cliente final.
const RE_APP_PASSWORD = /^[a-z]{4}\s[a-z]{4}\s[a-z]{4}\s[a-z]{4}$/;
const avisosCorreo = [];
for (const [empresa, variable] of CUENTAS_EMAIL) {
  const valor = env[variable] || '';
  if (valor && !RE_APP_PASSWORD.test(valor)) {
    avisosCorreo.push(`${variable} (${empresa}) no tiene el formato "xxxx xxxx xxxx xxxx"`);
  }
}

if (avisos.length) {
  console.error('');
  console.error('⚠️  Aviso de formato en las credenciales de Google (NO se detiene el build):');
  avisos.forEach(a => console.error('   · ' + a));
  console.error('   Compila, pero el correo puede no conectar. Verificá contra');
  console.error('   Google Auth Platform > Clientes.');
  console.error('');
}

if (avisosCorreo.length) {
  console.error('');
  console.error('⚠️  Aviso de formato en las contrasenas de correo (NO se detiene el build):');
  avisosCorreo.forEach(a => console.error('   · ' + a));
  console.error('   Compila, pero el envio por correo puede fallar. Verificalo');
  console.error('   contra Google Account > Seguridad > Contrasenas de aplicacion.');
  console.error('');
}

console.log('[build-guard] Credenciales de Google presentes (client_id + client_secret). Se puede empaquetar.');
console.log('[build-guard] Contrasenas de correo presentes (' + CUENTAS_EMAIL.length + ' empresas). Se puede empaquetar.');
