/**
 * Compara el arbol del repositorio con el arbol desplegado en el servidor.
 *
 * POR QUE EXISTE
 * --------------
 * El despliegue de la firma electronica se hace copiando archivos, no con un
 * `git pull`: el servidor no tiene `.git` (medido el 12-nov-2026, no existe
 * `/opt/kair-firma/.git`). Por eso "que codigo corre" no se puede responder
 * con `git log` en el servidor, y el manifiesto `legal-readiness.json` solo
 * habla de los TEXTOS, no del codigo.
 *
 * La respuesta que faltaba se arma asi: se calcula el sha256 de cada archivo
 * desplegable del repositorio y se compara con el mismo manifiesto calculado
 * en el servidor. La diferencia entre los dos es, literalmente, lo que no se
 * ha desplegado.
 *
 * LO QUE ESTE SCRIPT MIDE
 * -----------------------
 * 1. Los archivos que estan en los dos lados y NO coinciden: son los que se
 *    quedaron atras en el servidor (o los que cambiaron despues del despliegue).
 * 2. Los archivos que estan en el servidor y no en el repositorio: resto de una
 *    version anterior.
 * 3. Los archivos que estan en el repositorio y no en el servidor: lo que no
 *    se ha desplegado todavia (tests, scripts nuevos, documentacion).
 *
 * Lo que NO mide, y por que: no dice si el codigo funciona. Solo dice si los
 * bytes son los mismos. La diferencia entre "los bytes son iguales" y "el
 * servicio funciona" la pone la suite y la medicion de salud, que son cosas
 * distintas.
 *
 * USO
 * ---
 *   node scripts/comparar-despliegue.js --repo <raiz> --servidor <manifiesto.txt>
 *   node scripts/comparar-despliegue.js --repo <raiz> --servidor <manifiesto.txt> --escribir <salida.txt>
 *
 * El manifiesto del servidor se genera en el servidor con:
 *   cd /opt/kair-firma/app && find . -type f -not -path './node_modules/*' ... | xargs -0 sha256sum
 * (linea a linea: "<sha256>  <ruta relativa>")
 *
 * SALIDA
 * ------
 * Codigo 0 si el arbol de runtime es identico; codigo 1 si hay diferencias, o
 * si el manifiesto del servidor no se puede leer. Codigo 2 si faltan argumentos.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EXCLUIDOS = new Set([
  'node_modules', '.git', 'storage', 'logs', 'backups', 'data', 'coverage', '.nyc_output',
]);

// Extensiones que no forman parte del codigo desplegable.
const EXTENSIONES_EXCLUIDAS = /\.(sqlite|sqlite3|db|enc|pdf|log|env)$/i;

/**
 * Recorre el arbol y devuelve el manifiesto sha256.
 * @param {string} raiz
 * @returns {Map<string,string>} ruta relativa (con '/') -> sha256
 */
function calcularManifiesto(raiz) {
  const manifiesto = new Map();
  const archivos = [];
  const visitar = (dir) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      if (EXCLUIDOS.has(entrada.name)) continue;
      const abs = path.join(dir, entrada.name);
      if (entrada.isDirectory()) visitar(abs);
      else if (entrada.isFile()) archivos.push(abs);
    }
  };
  visitar(raiz);
  for (const abs of archivos) {
    const rel = path.relative(raiz, abs).split(path.sep).join('/');
    if (EXTENSIONES_EXCLUIDAS.test(rel)) continue;
    const hash = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
    manifiesto.set(rel, hash);
  }
  return manifiesto;
}

/**
 * Lee un manifiesto "sha256  ruta" en un Map.
 * @param {string} ruta
 * @returns {Map<string,string>}
 */
function leerManifiesto(ruta) {
  const mapa = new Map();
  const texto = fs.readFileSync(ruta, 'utf8');
  for (const linea of texto.split('\n')) {
    if (!linea.trim()) continue;
    const corte = linea.indexOf('  ');
    if (corte < 0) continue;
    mapa.set(linea.slice(corte + 2).trim(), linea.slice(0, corte));
  }
  return mapa;
}

/**
 * Compara los dos manifiestos.
 * @param {Map<string,string>} repo
 * @param {Map<string,string>} servidor
 */
function comparar(repo, servidor) {
  const comunes = [];
  const diferentes = [];
  for (const [ruta, hash] of servidor) {
    if (!repo.has(ruta)) continue;
    comunes.push(ruta);
    if (repo.get(ruta) !== hash) diferentes.push(ruta);
  }
  const soloServidor = [...servidor.keys()].filter((r) => !repo.has(r)).sort();
  const soloRepo = [...repo.keys()].filter((r) => !servidor.has(r)).sort();
  return { comunes: comunes.sort(), diferentes: diferentes.sort(), soloServidor, soloRepo };
}

function parsearArgs(argv) {
  const args = { repo: null, servidor: null, escribir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--repo') args.repo = argv[i + 1];
    else if (a === '--servidor') args.servidor = argv[i + 1];
    else if (a === '--escribir') args.escribir = argv[i + 1];
  }
  return args;
}

function formatear(args, repo, servidor, cmp) {
  const L = [];
  L.push('# Comparacion del arbol desplegable: repositorio contra servidor');
  L.push('');
  L.push('- Repositorio: `' + args.repo + '`');
  L.push('- Manifiesto del servidor: `' + args.servidor + '`');
  L.push('- Archivos en comun: **' + cmp.comunes.length + '**');
  L.push('- Archivos que difieren: **' + cmp.diferentes.length + '**');
  L.push('- Solo en el servidor: **' + cmp.soloServidor.length + '**');
  L.push('- Solo en el repositorio: **' + cmp.soloRepo.length + '**');
  L.push('');
  L.push('## Archivos en comun que difieren (lo que no esta desplegado)');
  L.push('');
  if (cmp.diferentes.length === 0) L.push('Ninguno: el codigo desplegado es identico al del repositorio.');
  else for (const r of cmp.diferentes) L.push('- `' + r + '`');
  L.push('');
  L.push('## Archivos que estan en el servidor y no en el repositorio');
  L.push('');
  if (cmp.soloServidor.length === 0) L.push('Ninguno.');
  else for (const r of cmp.soloServidor) L.push('- `' + r + '`');
  L.push('');
  L.push('## Archivos que estan en el repositorio y no en el servidor');
  L.push('');
  L.push('Estos son los que todavia no se han desplegado (tests, scripts nuevos,');
  L.push('documentacion). No son codigo de runtime.');
  L.push('');
  if (cmp.soloRepo.length === 0) L.push('Ninguno.');
  else for (const r of cmp.soloRepo) L.push('- `' + r + '`');
  return L.join('\n') + '\n';
}

function main() {
  const args = parsearArgs(process.argv.slice(2));
  if (!args.repo || !args.servidor) {
    process.stderr.write('Falta --repo o --servidor.\n');
    process.stderr.write('Uso: node scripts/comparar-despliegue.js --repo <raiz> --servidor <manifiesto.txt> [--escribir <salida.txt>]\n');
    process.exit(2);
  }
  if (!fs.existsSync(args.repo)) {
    process.stderr.write('No existe el arbol del repositorio: ' + args.repo + '\n');
    process.exit(1);
  }
  if (!fs.existsSync(args.servidor)) {
    process.stderr.write('No existe el manifiesto del servidor: ' + args.servidor + '\n');
    process.exit(1);
  }
  const repo = calcularManifiesto(args.repo);
  const servidor = leerManifiesto(args.servidor);
  const cmp = comparar(repo, servidor);
  const texto = formatear(args, repo, servidor, cmp);
  if (args.escribir) fs.writeFileSync(args.escribir, texto, 'utf8');
  else process.stdout.write(texto);
  if (cmp.diferentes.length > 0 || cmp.soloServidor.length > 0) {
    process.stderr.write('VEREDICTO: el servidor NO esta al dia con el repositorio (' +
      cmp.diferentes.length + ' archivos diferentes, ' + cmp.soloServidor.length + ' sobrantes).\n');
    process.exit(1);
  }
  process.stderr.write('VEREDICTO: el codigo desplegado es identico al del repositorio.\n');
  process.exit(0);
}

if (require.main === module) main();

module.exports = { calcularManifiesto, leerManifiesto, comparar, parsearArgs };
