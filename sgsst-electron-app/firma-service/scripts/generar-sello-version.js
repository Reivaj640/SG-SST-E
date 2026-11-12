/**
 * generar-sello-version.js
 *
 * Genera el SELLO DE VERSION del despliegue y lo escribe en el archivo que
 * viaja con el despliegue (VERSION, en la raiz del servicio).
 *
 * QUE RESUELVE
 * -------------
 * El /health del servicio anunciaba una version FIJA ("compatible-0.1.189"),
 * un valor que no depende del codigo que esta corriendo. Con el arbol
 * desplegado sin .git y con un package.json que dice "0.1.0", NO habia forma
 * de saber con certeza que codigo corre: el arbol desplegado era MIXTO (el
 * codigo de la punta con las dependencias anteriores).
 *
 * Este script deja la verdad escrita en un archivo: que commit se desplego,
 * de que fecha es, y un hash corto del arbol de archivos. El /health lo lee y
 * lo anuncia (campo `version_sello`), asi que el disco y la respuesta de
 * salud dicen lo mismo.
 *
 * EL HASH DEL ARBOL
 * -----------------
 * El hash NO es el hash del arbol de git: es un hash del CONTENIDO de los
 * archivos que viajan en el despliegue (src, web, scripts, config,
 * package.json, package-lock.json, legal-readiness.json). Esa distincion es
 * la que importa: el arbol desplegado era mixto porque el LOCK viajo con
 * versiones viejas, y un hash de contenido lo detecta.
 *
 * Con la misma lista de archivos, el hash se puede recalcular en el servidor
 * y comparar con el del sello: si no coinciden, lo que corre no es lo que se
 * sello.
 *
 * REGLAS
 * ------
 * 1. Corre SIN RED: solo lee archivos locales y consulta `git` en local.
 * 2. Corre SIN `.git`: si no hay `.git`, el commit se recibe por parametro
 *    (`--commit=<sha>`). Sin `.git` y sin parametro, el script falla: no
 *    inventa un commit.
 * 3. Es IDEMPOTENTE: si el archivo ya tiene exactamente el mismo contenido,
 *    no lo reescribe (no cambia ni la fecha de modificacion) y lo dice.
 * 4. La fecha es la del COMMIT cuando se puede determinar: el sello es una
 *    funcion del commit, no del momento en que se corrio el script. Sin
 *    `.git` y sin `--fecha`, se usa la hora de generacion.
 *
 * INTERFAZ
 * --------
 *   node scripts/generar-sello-version.js
 *       Genera el sello con el commit de `.git` y lo escribe en VERSION.
 *
 *   node scripts/generar-sello-version.js --raiz=<dir> --salida=<archivo>
 *       Genera el sello de otro arbol y lo escribe en otro archivo.
 *
 *   node scripts/generar-sello-version.js --commit=<sha> [--fecha=<iso>]
 *       Genera el sello sin `.git` (el commit llega por parametro).
 *
 *   node scripts/generar-sello-version.js --comprobar
 *       NO escribe nada: recalcula el hash del arbol y lo compara con el del
 *       sello que ya esta en el archivo. Codigo 0 si coinciden.
 *
 *   node scripts/generar-sello-version.js --ayuda
 *       Esta ayuda.
 *
 * CODIGOS DE SALIDA
 * -----------------
 *   0  Todo bien (o el sello ya estaba y no cambio).
 *   1  Error de uso o de datos (falta el commit, el arbol esta incompleto,
 *      el archivo de sello no se pudo escribir).
 *   2  La comprobacion fallo: el hash del arbol NO coincide con el del sello.
 *
 * Este archivo es codigo: se escribe en ASCII puro (sin tildes ni enie),
 * como el resto del codigo del repositorio.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

/** La raiz del servicio: la carpeta que contiene src/, scripts/, etc. */
const RAIZ_SERVICIO = path.resolve(__dirname, '..');

/** El archivo de sello, por defecto en la raiz del servicio. */
const RUTA_SELLO_POR_DEFECTO = path.join(RAIZ_SERVICIO, 'VERSION');

/**
 * Lo que viaja en el despliegue. Son las rutas que el tar del despliegue
 * lleva (ver docs/MIGRACION-SERVIDOR-FIRMA.md): el hash del arbol se calcula
 * sobre ESTAS, y solo sobre estas.
 */
const RUTAS_DEL_SERVICIO = [
  'src',
  'web',
  'scripts',
  'config',
  'package.json',
  'package-lock.json',
  'legal-readiness.json',
];

/** Longitud del hash corto del arbol que se publica. */
const LARGO_HASH_CORTO = 12;

/** Longitud del commit corto que se publica. */
const LARGO_COMMIT_CORTO = 8;

/** Nombre del servicio, para que el sello se lea solo. */
const NOMBRE_SERVICIO = 'kair-firma-service';

// ---------------------------------------------------------------------------
// LISTA DE ARCHIVOS
// ---------------------------------------------------------------------------

/**
 * Convierte una ruta relativa en separadores POSIX (los que viajan en el
 * hash), para que el hash sea el mismo en Windows y en Linux.
 * @param {string} relativa
 * @returns {string}
 */
function _posix(relativa) {
  return relativa.split(path.sep).join('/');
}

/**
 * Recorre un directorio y agrega los archivos (relativos a la raiz) a la
 * lista. Los enlaces simbolicos se saltan: no son contenido del despliegue.
 * @param {string} dir
 * @param {string} raiz
 * @param {string[]} salida
 */
function _recorrer(dir, raiz, salida) {
  const nombres = fs.readdirSync(dir).sort();
  for (const nombre of nombres) {
    const abs = path.join(dir, nombre);
    let st;
    try {
      st = fs.lstatSync(abs);
    } catch (e) {
      continue;
    }
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) {
      _recorrer(abs, raiz, salida);
    } else if (st.isFile()) {
      salida.push(_posix(path.relative(raiz, abs)));
    }
  }
}

/**
 * Lista los archivos del despliegue, ordenados.
 * @param {string} raiz
 * @returns {string[]} rutas relativas, con separador POSIX.
 * @throws {Error} si falta alguna de las rutas del servicio.
 */
function listarArchivos(raiz) {
  const encontrados = [];
  for (const r of RUTAS_DEL_SERVICIO) {
    const abs = path.join(raiz, r);
    if (!fs.existsSync(abs)) {
      throw new Error(
        'El arbol ' + raiz + ' no tiene ' + r + ': no es un arbol del servicio completo.'
      );
    }
    if (fs.statSync(abs).isDirectory()) {
      _recorrer(abs, raiz, encontrados);
    } else {
      encontrados.push(_posix(r));
    }
  }
  encontrados.sort();
  return encontrados;
}

// ---------------------------------------------------------------------------
// HASH DEL ARBOL
// ---------------------------------------------------------------------------

/**
 * Calcula el hash corto del arbol del despliegue.
 *
 * El hash es el SHA-256 de una lista canonica: una linea por archivo, con el
 * SHA-256 del contenido y la ruta relativa, ordenadas por ruta. Cambia un
 * byte de CUALQUIER archivo del despliegue (lock incluido) y cambia el hash.
 *
 * @param {string} raiz
 * @returns {{hash: string, archivos: number, completo: string}}
 */
function hashArbol(raiz) {
  const archivos = listarArchivos(raiz);
  const h = crypto.createHash('sha256');
  for (const rel of archivos) {
    const abs = path.join(raiz, rel.split('/').join(path.sep));
    const delArchivo = crypto.createHash('sha256')
      .update(fs.readFileSync(abs))
      .digest('hex');
    h.update(delArchivo + '  ' + rel + '\n');
  }
  const completo = h.digest('hex');
  return {
    hash: completo.slice(0, LARGO_HASH_CORTO),
    completo: completo,
    archivos: archivos.length,
  };
}

// ---------------------------------------------------------------------------
// COMMIT (con .git y sin .git)
// ---------------------------------------------------------------------------

/**
 * Corre un comando de git en local. Sin red.
 * @param {string[]} args
 * @param {string} cwd
 * @returns {string}
 */
function _correrGit(args, cwd) {
  return execFileSync('git', args, {
    cwd: cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

/**
 * Detecta el commit del arbol con `.git`.
 * @param {string} raiz
 * @returns {{commit: string, fecha: string|null}|null} null si no hay `.git`.
 */
function detectarCommit(raiz) {
  try {
    const commit = _correrGit(['rev-parse', 'HEAD'], raiz);
    if (!/^[0-9a-f]{40}$/.test(commit)) return null;
    let fecha = null;
    try {
      const cruda = _correrGit(['show', '-s', '--format=%cI', commit], raiz);
      fecha = _normalizarFecha(cruda);
    } catch (e) {
      fecha = null;
    }
    return { commit: commit, fecha: fecha };
  } catch (e) {
    return null;
  }
}

/**
 * Normaliza una fecha a UTC con formato ISO 8601 de segundos ("...Z").
 * @param {string} valor
 * @returns {string|null}
 */
function _normalizarFecha(valor) {
  if (!valor) return null;
  const t = Date.parse(valor);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Lee un sello ya escrito, si el archivo existe y es un JSON valido.
 * @param {string} ruta
 * @returns {object|null}
 */
function leerSello(ruta) {
  try {
    const datos = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return null;
    return datos;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// EL SELLO
// ---------------------------------------------------------------------------

/**
 * Arma el sello.
 * @param {{raiz?: string, commit?: string, fecha?: string, previo?: object}} opciones
 *   `previo` es el sello ya escrito (si habia): sin `.git` y sin `--fecha`,
 *   se REUSA su fecha, para que el sello sea idempotente tambien sin `.git`.
 * @returns {object} el sello (el contenido del archivo VERSION).
 */
function generarSello(opciones) {
  const op = opciones || {};
  const raiz = op.raiz ? path.resolve(op.raiz) : RAIZ_SERVICIO;
  const detectados = detectarCommit(raiz);

  const commit = String(op.commit || (detectados && detectados.commit) || '').trim();
  if (!commit) {
    throw new Error(
      'No se pudo determinar el commit: el arbol no tiene .git. '
        + 'Pase el commit por parametro: --commit=<sha>.'
    );
  }

  let fecha = op.fecha ? _normalizarFecha(op.fecha) : null;
  if (!fecha && detectados && detectados.fecha) fecha = detectados.fecha;
  if (!fecha && op.previo && op.previo.commit === commit
      && typeof op.previo.fecha === 'string') {
    fecha = _normalizarFecha(op.previo.fecha);
  }
  if (!fecha) fecha = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const arbol = hashArbol(raiz);

  return {
    servicio: NOMBRE_SERVICIO,
    commit: commit,
    commit_corto: commit.slice(0, LARGO_COMMIT_CORTO),
    fecha: fecha,
    arbol: arbol.hash,
    arbol_metodo: 'sha256-archivos',
    archivos: arbol.archivos,
  };
}

/**
 * Serializa el sello como se escribe en el archivo.
 * @param {object} sello
 * @returns {string}
 */
function serializarSello(sello) {
  return JSON.stringify(sello, null, 2) + '\n';
}

/**
 * Escribe el sello. Es idempotente: si el archivo ya tiene EXACTAMENTE el
 * mismo contenido, no lo toca.
 * @param {string} ruta
 * @param {object} sello
 * @returns {{cambiado: boolean, ruta: string}}
 */
function escribirSello(ruta, sello) {
  const contenido = serializarSello(sello);
  if (fs.existsSync(ruta)) {
    let actual = null;
    try {
      actual = fs.readFileSync(ruta, 'utf8');
    } catch (e) {
      actual = null;
    }
    if (actual === contenido) {
      return { cambiado: false, ruta: ruta };
    }
  }
  const dir = path.dirname(ruta);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ruta, contenido, 'utf8');
  return { cambiado: true, ruta: ruta };
}

// ---------------------------------------------------------------------------
// LO QUE SE PUBLICA EN /health
// ---------------------------------------------------------------------------

/**
 * Arma el valor publico del sello a partir del TEXTO del archivo.
 *
 * Funcion pura: no lee el disco, no adivina. Si el archivo no esta o no esta
 * bien, lo dice explicitamente en vez de inventar una version.
 *
 * @param {string|null} texto el contenido del archivo de sello.
 * @returns {object} el valor del campo `version_sello`.
 */
function armarSelloPublico(texto) {
  if (texto === null || texto === undefined || texto === '') {
    return {
      estado: 'ausente',
      detalle: 'no hay archivo de sello de version en este despliegue',
    };
  }
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch (e) {
    return {
      estado: 'ausente',
      detalle: 'el archivo de sello de version no es un JSON valido',
    };
  }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    return {
      estado: 'ausente',
      detalle: 'el archivo de sello de version no tiene la forma esperada',
    };
  }
  if (typeof datos.commit !== 'string' || !datos.commit
      || typeof datos.arbol !== 'string' || !datos.arbol) {
    return {
      estado: 'ausente',
      detalle: 'el archivo de sello de version no declara commit ni arbol',
    };
  }
  return {
    estado: 'presente',
    commit: datos.commit,
    commit_corto: typeof datos.commit_corto === 'string' && datos.commit_corto
      ? datos.commit_corto
      : datos.commit.slice(0, LARGO_COMMIT_CORTO),
    fecha: typeof datos.fecha === 'string' ? datos.fecha : null,
    arbol: datos.arbol,
  };
}

/**
 * Lee el archivo de sello y arma el valor publico. Nunca lanza: si algo
 * falla, lo dice como "ausente".
 * @param {string} [ruta]
 * @returns {object}
 */
function leerSelloPublico(ruta) {
  const donde = ruta || RUTA_SELLO_POR_DEFECTO;
  let texto;
  try {
    texto = fs.readFileSync(donde, 'utf8');
  } catch (e) {
    return {
      estado: 'ausente',
      detalle: 'no hay archivo de sello de version en este despliegue',
    };
  }
  return armarSelloPublico(texto);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/**
 * Parsea los argumentos de la linea de comandos.
 * @param {string[]} argv
 * @returns {object}
 */
function _argumentos(argv) {
  const opciones = { comprobar: false, ayuda: false };
  for (const arg of argv) {
    if (arg === '--comprobar') opciones.comprobar = true;
    else if (arg === '--ayuda' || arg === '-h') opciones.ayuda = true;
    else if (arg.indexOf('--raiz=') === 0) opciones.raiz = arg.slice('--raiz='.length);
    else if (arg.indexOf('--salida=') === 0) opciones.salida = arg.slice('--salida='.length);
    else if (arg.indexOf('--commit=') === 0) opciones.commit = arg.slice('--commit='.length);
    else if (arg.indexOf('--fecha=') === 0) opciones.fecha = arg.slice('--fecha='.length);
    else {
      throw new Error('Argumento desconocido: ' + arg);
    }
  }
  return opciones;
}

/**
 * Compara el hash del arbol con el del sello que ya esta escrito.
 * @param {string} raiz
 * @param {string} rutaSello
 * @returns {{ok: boolean, linea: string}}
 */
function comprobarSello(raiz, rutaSello) {
  if (!fs.existsSync(rutaSello)) {
    return { ok: false, linea: 'NO HAY SELLO: no existe ' + rutaSello };
  }
  let datos;
  try {
    datos = JSON.parse(fs.readFileSync(rutaSello, 'utf8'));
  } catch (e) {
    return { ok: false, linea: 'SELLO ILEGIBLE: ' + rutaSello + ' no es un JSON valido' };
  }
  const arbol = hashArbol(raiz);
  const esperado = datos && typeof datos.arbol === 'string' ? datos.arbol : '(sin arbol)';
  if (esperado !== arbol.hash) {
    return {
      ok: false,
      linea: 'EL ARBOL ACTUAL NO CORRESPONDE AL SELLO: el sello dice ' + esperado
        + ' y el arbol actual da ' + arbol.hash,
    };
  }
  return {
    ok: true,
    linea: 'OK: el arbol corresponde al sello (' + arbol.hash + ', ' + arbol.archivos + ' archivos).',
  };
}

function _ayuda() {
  console.log([
    'generar-sello-version.js - genera el sello de version del despliegue.',
    '',
    '  node scripts/generar-sello-version.js [--raiz=<dir>] [--salida=<archivo>]',
    '                                         [--commit=<sha>] [--fecha=<iso>]',
    '  node scripts/generar-sello-version.js --comprobar',
    '  node scripts/generar-sello-version.js --ayuda',
    '',
    'Escribe el sello (commit, fecha y hash corto del arbol) en el archivo',
    'VERSION. Es idempotente. Corre sin red y sin .git (con --commit).',
    '',
  ].join('\n'));
}

function main(argv) {
  let opciones;
  try {
    opciones = _argumentos(argv);
  } catch (e) {
    console.error(e.message);
    console.error('Use --ayuda.');
    return 1;
  }
  if (opciones.ayuda) {
    _ayuda();
    return 0;
  }

  const raiz = opciones.raiz ? path.resolve(opciones.raiz) : RAIZ_SERVICIO;
  const salida = opciones.salida ? path.resolve(opciones.salida) : path.join(raiz, 'VERSION');

  try {
    if (opciones.comprobar) {
      const r = comprobarSello(raiz, salida);
      console.log(r.linea);
      return r.ok ? 0 : 2;
    }

    const sello = generarSello({
      raiz: raiz,
      commit: opciones.commit,
      fecha: opciones.fecha,
      previo: leerSello(salida),
    });
    const r = escribirSello(salida, sello);
    if (r.cambiado) {
      console.log('Sello escrito en ' + salida);
    } else {
      console.log('Sello sin cambios en ' + salida + ' (ya era el mismo).');
    }
    console.log('  commit: ' + sello.commit);
    console.log('  fecha : ' + sello.fecha);
    console.log('  arbol : ' + sello.arbol + ' (' + sello.archivos + ' archivos)');
    return 0;
  } catch (e) {
    console.error('ERROR: ' + e.message);
    return 1;
  }
}

module.exports = {
  main: main,
  generarSello: generarSello,
  escribirSello: escribirSello,
  serializarSello: serializarSello,
  leerSello: leerSello,
  armarSelloPublico: armarSelloPublico,
  leerSelloPublico: leerSelloPublico,
  hashArbol: hashArbol,
  listarArchivos: listarArchivos,
  detectarCommit: detectarCommit,
  comprobarSello: comprobarSello,
  RUTA_SELLO_POR_DEFECTO: RUTA_SELLO_POR_DEFECTO,
  RAIZ_SERVICIO: RAIZ_SERVICIO,
  RUTAS_DEL_SERVICIO: RUTAS_DEL_SERVICIO,
};

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
