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
    if (m) salida[m[1]] = m[2];
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

if (avisos.length) {
  console.error('');
  console.error('⚠️  Aviso de formato en las credenciales de Google (NO se detiene el build):');
  avisos.forEach(a => console.error('   · ' + a));
  console.error('   Compila, pero el correo puede no conectar. Verificá contra');
  console.error('   Google Auth Platform > Clientes.');
  console.error('');
}

console.log('[build-guard] Credenciales de Google presentes (client_id + client_secret). Se puede empaquetar.');