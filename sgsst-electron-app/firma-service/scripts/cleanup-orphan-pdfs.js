#!/usr/bin/env node
/**
 * scripts/cleanup-orphan-pdfs.js
 *
 * Mueve PDFs huerfanos (originales/firmados/constancias/papel sin firma en la
 * BD) a un directorio de archivo, preservando evidencia para auditoria pero
 * recuperando espacio en el arbol principal de PDFs.
 *
 * REGLA DURA: este script NUNCA borra evidencia. Solo MUEVE los PDFs a
 * `storage/pdf-archive/YYYY-MM-DD/`. La estructura del archivo es la misma
 * que el original (originales/, firmados/, constancias/, papel/).
 *
 * Diferencias con cleanup-orphan-sign-requests.js:
 *   - No modifica BD (los PDFs huerfanos no tienen contraparte en BD)
 *   - Solo trabaja con archivos en disco
 *   - Genera manifest (.json) con metadatos del movimiento
 *
 * RUTAS (2026-10-22)
 * ------------------
 * Antes estas rutas estaban fijas al layout local (`<app>/data/firma.sqlite` y
 * `<app>/storage/pdfs`), y en `kair-server` el script salia con "BD no
 * encontrada": la base esta en `/opt/kair-firma/data/` y el storage en
 * `/opt/kair-firma/storage/`, que son HERMANOS de `app/`, no hijos.
 * Ahora las rutas salen del entorno, igual que el resto del servicio
 * (`src/config.js`): `DB_PATH` y `PDF_STORAGE_PATH`, resueltas contra la raiz
 * del Servicio cuando son relativas.
 *
 * DEFENSA EN PRODUCCION
 * ---------------------
 * MOVER exige `--yes` (mover es escribir). El DRY-RUN no escribe nada (ni crea
 * el directorio de archivo, ni el manifiesto, ni mueve un byte) y por eso se
 * permite en produccion: es la unica forma de VER que se moveria antes de
 * moverlo. Un script que en produccion solo dice "no se puede" obliga a
 * hacer el movimiento a ciegas.
 *
 * Y un aviso que no puede faltar: si hay PDF huerfanos FUERA de la lista
 * objetivo, el script lo dice. "Nada que mover" no puede significar "el
 * storage esta limpio" cuando hay huerfanos que la lista no cubre.
 *
 * Uso:
 *   node scripts/cleanup-orphan-pdfs.js                       # dry-run (DEFAULT)
 *   node scripts/cleanup-orphan-pdfs.js --yes                 # mueve
 *   node scripts/cleanup-orphan-pdfs.js --json                # output JSON
 *   node scripts/cleanup-orphan-pdfs.js --ids=SIGN-2026-020330 # IDs especificos
 *   node scripts/cleanup-orphan-pdfs.js --todos                # escaneo completo
 *
 * Exit codes:
 *   0  operacion exitosa (incluido dry-run y no-hay-nada-que-hacer)
 *   1  error de ejecucion
 *   2  validacion fallo (BD o storage no encontrados)
 *   3  filesystem error
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const SERVICE_ROOT = path.resolve(__dirname, '..');

// Rutas relativas al Servicio (no al CWD), igual que `src/config.js`.
function resolvePath(p) {
  if (path.isAbsolute(p)) return p;
  return path.resolve(SERVICE_ROOT, p);
}

const DB_PATH = resolvePath(process.env.DB_PATH || './data/firma.sqlite');
const STORAGE_ROOT = resolvePath(process.env.PDF_STORAGE_PATH || './storage/pdfs');
// El archivo es hermano del arbol de PDFs: `<storage>/pdf-archive/`. En el
// layout local da `<app>/storage/pdf-archive` (igual que antes) y en
// `kair-server` da `/opt/kair-firma/storage/pdf-archive`.
const ARCHIVE_ROOT = path.join(path.dirname(STORAGE_ROOT), 'pdf-archive');

// IDs EXPLICITAMENTE a procesar si no se pasa `--ids=` ni `--todos`.
// Si esta vacia, se procesan TODOS los huerfanos encontrados (scan completo).
// Esta es la unica fuente de verdad.
const TARGET_IDS = [
  'SIGN-2026-003786',
  'SIGN-2026-132601',
  'SIGN-2026-447025',
  'SIGN-2026-939071',
];

// IDs EXPLICITAMENTE EXCLUIDOS (no tocar bajo ninguna circunstancia).
const EXCLUDED_IDS = [
  // Agregar aquí IDs que SÍ están en BD pero no se detectan por algún
  // motivo (e.g., IDs en formato legacy que no siguen SIGN-YYYY-NNNNNN).
];

// Los cuatro arboles de PDFs del storage. Los nombres de archivo salen del
// `id_solicitud` (ver `src/services/publicFlow.js` y `src/services/storage.js`):
//   originales/<id>.pdf          firmados/<id>.pdf
//   constancias/<id>-constancia.pdf
//   papel/<id>-firmado.pdf       papel/<id>-registro.pdf
const PDF_DIRS = {
  originales: path.join(STORAGE_ROOT, 'originales'),
  firmados: path.join(STORAGE_ROOT, 'firmados'),
  constancias: path.join(STORAGE_ROOT, 'constancias'),
  papel: path.join(STORAGE_ROOT, 'papel'),
};

// =============================================================================
// ARGUMENTOS CLI
// =============================================================================
//
// Se leen DENTRO de main(argv), no al cargar el modulo: asi el script se puede
// invocar con argumentos distintos en la misma sesion (y los tests pueden
// probarlo sin hacer spawns).

/**
 * Lee las opciones de la linea de comandos.
 * @param {string[]} args - argumentos sin `node` ni el path del script
 * @returns {{yes: boolean, json: boolean, ids: string[]|null, modoIds: string}}
 *   `ids === null` significa "usar la lista por defecto (TARGET_IDS)".
 *   `ids === []` significa "scan completo".
 */
function leerOpciones(args) {
  const idsArg = args.find(a => a.startsWith('--ids='));
  let ids = null;
  let modoIds = 'defecto';
  if (idsArg !== undefined) {
    ids = idsArg.substring('--ids='.length).split(',').map(s => s.trim()).filter(Boolean);
    modoIds = 'ids';
  } else if (args.includes('--todos')) {
    ids = [];
    modoIds = 'todos';
  }
  return {
    yes: args.includes('--yes'),
    json: args.includes('--json'),
    ids,
    modoIds,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

// En modo JSON solo sale el JSON (stdout tiene que poder parsearse). Los
// errores viajan dentro del objeto de resultado.
const estado = { json: false };

function log(msg, level = 'info') {
  if (estado.json) return;
  const prefix = { info: '✓', warn: '⚠', error: '✗' }[level] || '✓';
  console.log(`${prefix} ${msg}`);
}

function extractIdFromFilename(filename) {
  // Formatos posibles: SIGN-2026-112173.pdf, SIGN-2026-112173-constancia.pdf,
  // SIGN-2026-112173-firmado.pdf, SIGN-2026-112173-registro.pdf
  const m = filename.match(/^(SIGN-\d{4}-\d+)(?:-constancia|-firmado|-registro)?\.pdf$/);
  return m ? m[1] : null;
}

function getSrIdsInBd(db) {
  const rows = db.prepare('SELECT id_solicitud FROM gh_firmas_electronicas').all();
  return new Set(rows.map(r => r.id_solicitud));
}

/**
 * Abre la base en solo lectura. Una base en WAL a la que no se puede crear el
 * `-shm` no se abre en solo lectura: en ese caso se cae a una conexion normal
 * AVISANDO (el script solo hace SELECT, pero el candado es real).
 *
 * EXCEPTO cuando el proceso corre como root: abrirla en modo escritura
 * podria dejar los archivos `-wal`/`-shm` de root en el directorio de datos, y
 * el servicio (que corre como `kairfirma`) no podria volver a escribir en
 * ellos. En ese caso el script se niega y pide que se corra como el usuario
 * del servicio.
 * @param {string} ruta
 * @returns {{db: object, soloLectura: boolean, aviso: string|null}}
 */
function abrirDb(ruta) {
  try {
    const db = new Database(ruta, { readonly: true, fileMustExist: true });
    return { db, soloLectura: true, aviso: null };
  } catch (e) {
    const esRoot = process.platform !== 'win32'
      && typeof process.getuid === 'function' && process.getuid() === 0;
    if (esRoot) {
      throw new Error('No se pudo abrir la base en solo lectura (' + e.message + ') y el proceso corre como root: '
        + 'no se abre en modo escritura porque SQLite podria dejar archivos -wal/-shm de root en el '
        + 'directorio de datos y el servicio (kairfirma) no podria seguir escribiendo. '
        + 'Corre el script como el usuario del servicio: sudo -u kairfirma ...');
    }
    const db = new Database(ruta, { fileMustExist: true });
    return {
      db,
      soloLectura: false,
      aviso: 'No se pudo abrir la base en solo lectura (' + e.message + '). '
        + 'Se abre en modo normal: el script solo hace SELECT, pero la base '
        + 'no esta bloqueada contra escrituras.',
    };
  }
}

/**
 * Lista los PDFs candidatos en disco.
 * @param {string[]|null} targetIds - lista de ids a considerar; null o vacia = todos
 * @returns {Array<{id: string, type: string, filename: string, fullPath: string}>}
 */
function findOrphanPdfs(targetIds) {
  const result = [];
  const soloEstos = Array.isArray(targetIds) && targetIds.length > 0;
  for (const [dirName, dirPath] of Object.entries(PDF_DIRS)) {
    if (!fs.existsSync(dirPath)) continue;
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.pdf'));
    for (const file of files) {
      const id = extractIdFromFilename(file);
      if (!id) continue;
      if (soloEstos && !targetIds.includes(id)) continue;
      result.push({
        id,
        type: dirName,
        filename: file,
        fullPath: path.join(dirPath, file),
      });
    }
  }
  return result;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o775 });
}

/**
 * Deja el directorio creado con el mismo dueno que el storage. En produccion
 * el script corre con `sudo` (root) pero el servicio corre como `kairfirma`:
 * si el archivo quedara en manos de root, el servicio no podria administrarlo
 * despues.
 * @param {string} dir
 */
function heredarDueno(dir) {
  if (process.platform === 'win32') return;
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) return;
  try {
    const st = fs.statSync(STORAGE_ROOT);
    fs.chownSync(dir, st.uid, st.gid);
  } catch (e) {
    // No es critico: el archivo movido conserva su dueno (rename no lo cambia).
  }
}

function computeChecksum(filepath) {
  const content = fs.readFileSync(filepath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Mueve un PDF al archivo (o simula el movimiento) y arma su entrada de
 * manifiesto. NUNCA borra: si el rename falla por estar en otro sistema de
 * archivos (EXDEV), se copia, se VERIFICA el checksum y recien ahi se borra
 * el original.
 * @param {object} orphan
 * @param {string} archiveDir
 * @param {boolean} dryRun
 * @returns {object} entrada del manifiesto
 */
function moveWithManifest(orphan, archiveDir, dryRun) {
  const destDir = path.join(archiveDir, orphan.type);
  const destPath = path.join(destDir, orphan.filename);
  const checksum = computeChecksum(orphan.fullPath);

  const manifest = {
    id: orphan.id,
    type: orphan.type,
    filename: orphan.filename,
    original_path: orphan.fullPath,
    archive_path: destPath,
    sha256: checksum,
    moved_at: new Date().toISOString(),
    reason: 'orphan: PDF sin contraparte en BD (gh_firmas_electronicas.id_solicitud)',
  };

  if (dryRun) {
    return { action: 'would-move', ...manifest };
  }

  try {
    ensureDir(destDir);
    heredarDueno(destDir);
    try {
      fs.renameSync(orphan.fullPath, destPath);
    } catch (e) {
      if (e.code !== 'EXDEV') throw e;
      // Otro sistema de archivos: copiar, VERIFICAR y solo entonces borrar.
      fs.copyFileSync(orphan.fullPath, destPath);
      const copia = computeChecksum(destPath);
      if (copia !== checksum) {
        fs.unlinkSync(destPath);
        throw new Error('la copia no coincide con el original (checksum distinto): se aborta el movimiento');
      }
      fs.unlinkSync(orphan.fullPath);
    }
    return { action: 'moved', ...manifest };
  } catch (e) {
    return { action: 'error', ...manifest, error: e.message };
  }
}

/**
 * Escribe (o completa) el manifiesto del dia. Dos ejecuciones el mismo dia NO
 * se pisan: las entradas se agregan.
 * @param {string} archiveDir
 * @param {object[]} items
 * @returns {string} ruta del manifiesto
 */
function escribirManifiesto(archiveDir, items) {
  const ruta = path.join(archiveDir, 'manifest.json');
  let previos = [];
  if (fs.existsSync(ruta)) {
    try {
      const previo = JSON.parse(fs.readFileSync(ruta, 'utf8'));
      if (previo && Array.isArray(previo.items)) previos = previo.items;
    } catch (e) {
      // Un manifiesto ilegible no se pisa: se deja como esta y se avisa abajo.
      previos = [];
    }
  }
  const todos = previos.concat(items);
  fs.writeFileSync(ruta, JSON.stringify({
    generated_at: new Date().toISOString(),
    total_orphans: todos.length,
    moved: todos.filter(i => i.action === 'moved').length,
    errors: todos.filter(i => i.action === 'error').length,
    items: todos,
  }, null, 2));
  heredarDueno(ruta);
  return ruta;
}

// =============================================================================
// MAIN
// =============================================================================

/**
 * @param {string[]} [argv] - argumentos de la linea de comandos (sin `node`).
 *   Por defecto se toma `process.argv.slice(2)`.
 * @returns {number} codigo de salida
 */
function main(argv) {
  const args = Array.isArray(argv) ? argv : process.argv.slice(2);
  const opciones = leerOpciones(args);
  estado.json = opciones.json;

  const objetivos = opciones.ids === null ? TARGET_IDS.slice() : opciones.ids;
  const scanCompleto = objetivos.length === 0;

  const resultado = {
    modo: opciones.yes ? 'ejecucion' : 'dry-run',
    db_path: DB_PATH,
    storage_root: STORAGE_ROOT,
    archive_root: ARCHIVE_ROOT,
    objetivo: { modo: opciones.modoIds, ids: objetivos },
    total_candidatos: 0,
    total_huerfanos: 0,
    a_mover: [],
    movidos: [],
    errores: [],
    fuera_de_lista: [],
    excluidos: [],
    manifiesto: null,
    error: null,
  };

  const salir = (codigo) => {
    if (estado.json) console.log(JSON.stringify(resultado, null, 2));
    return codigo;
  };

  // La BD se abre en SOLO LECTURA: este script no escribe en la base.
  if (!fs.existsSync(DB_PATH)) {
    resultado.error = `BD no encontrada: ${DB_PATH}`;
    log(`${resultado.error}`, 'error');
    log('  (se espera DB_PATH del .env; en kair-server es /opt/kair-firma/data/firma.sqlite)', 'error');
    return salir(2);
  }

  if (!fs.existsSync(STORAGE_ROOT)) {
    resultado.error = `Storage no encontrado: ${STORAGE_ROOT}`;
    log(`${resultado.error}`, 'error');
    log('  (se espera PDF_STORAGE_PATH del .env; en kair-server es /opt/kair-firma/storage/pdfs)', 'error');
    return salir(2);
  }

  log(`Modo: ${opciones.yes ? 'EJECUTAR (--yes)' : 'DRY-RUN (usar --yes para mover)'}`);
  log(`BD:      ${DB_PATH}`);
  log(`Storage: ${STORAGE_ROOT}`);
  log(`Archivo: ${ARCHIVE_ROOT}`);
  log(`Objetivo: ${scanCompleto ? 'SCAN COMPLETO (todos los huerfanos)' : objetivos.join(', ')}`);
  if (process.env.NODE_ENV === 'production' && !opciones.yes) {
    log('produccion: el dry-run NO escribe nada. Para MOVER hace falta --yes.', 'warn');
  }

  // Abrir BD y cruzar
  let db;
  let info;
  try {
    info = abrirDb(DB_PATH);
    db = info.db;
  } catch (e) {
    resultado.error = `No se pudo abrir la base: ${e.message}`;
    log(resultado.error, 'error');
    return salir(2);
  }
  if (info.aviso) log(info.aviso, 'warn');

  let huerfanos;
  try {
    const srIdsInBd = getSrIdsInBd(db);
    const todos = findOrphanPdfs(null);
    resultado.total_candidatos = todos.length;
    huerfanos = todos.filter(o => !srIdsInBd.has(o.id));
    resultado.total_huerfanos = huerfanos.length;
  } finally {
    db.close();
  }

  // Los excluidos no se tocan, pero se nombran: un ID excluido que nadie
  // menciona es un ID que alguien "mueve" manana.
  const excluidos = huerfanos.filter(o => EXCLUDED_IDS.includes(o.id));
  const candidatos = huerfanos.filter(o => !EXCLUDED_IDS.includes(o.id));

  const aMover = scanCompleto ? candidatos : candidatos.filter(o => objetivos.includes(o.id));
  // Lo que NO se va a mover pero ES huerfano: sin este aviso, "nada que
  // mover" se lee como "storage limpio" y no lo es.
  const fueraDeLista = scanCompleto ? [] : candidatos.filter(o => !objetivos.includes(o.id));

  resultado.a_mover = aMover.map(o => o.id);
  resultado.fuera_de_lista = fueraDeLista.map(o => o.id);
  resultado.excluidos = excluidos.map(o => o.id);

  log(`Encontrados: ${resultado.total_candidatos} candidatos, ${resultado.total_huerfanos} huerfanos confirmados, ${aMover.length} a mover`);

  if (excluidos.length > 0) {
    log(`EXCLUIDOS (no se tocan): ${excluidos.map(o => o.id).join(', ')}`, 'warn');
  }

  if (fueraDeLista.length > 0) {
    log(
      `AVISO: ${fueraDeLista.length} PDF(s) huerfano(s) FUERA de la lista objetivo: `
      + fueraDeLista.map(o => o.id).join(', ')
      + '. NO se mueven (la lista es la unica fuente de verdad), pero el storage NO esta limpio: '
      + 'pasalos con --ids=... si corresponde.',
      'warn'
    );
  }

  if (aMover.length === 0) {
    log('Nada que mover.');
    return salir(0);
  }

  // Preparar directorio de archivo
  const today = new Date().toISOString().slice(0, 10);
  const archiveDir = path.join(ARCHIVE_ROOT, today);
  if (opciones.yes) {
    ensureDir(archiveDir);
    heredarDueno(archiveDir);
  } else {
    log(`Destino (dry-run, NO se creara): ${archiveDir}`);
  }

  // Mover (o simular)
  const results = aMover.map(o => moveWithManifest(o, archiveDir, !opciones.yes));

  // Generar manifest (solo si se movio de verdad)
  if (opciones.yes) {
    resultado.manifiesto = escribirManifiesto(archiveDir, results);
  }

  // Resumen
  const movidos = results.filter(r => r.action === 'moved');
  const errores = results.filter(r => r.action === 'error');
  // En dry-run nada se movio todavia: lo que se cuenta es lo que SE moveria.
  const enJuego = opciones.yes ? movidos.length : results.filter(r => r.action === 'would-move').length;
  resultado.movidos = movidos.map(r => r.id);
  resultado.errores = errores.map(r => ({ id: r.id, error: r.error }));

  log(`${opciones.yes ? 'Movidos' : 'A mover'}: ${enJuego} archivos`);
  if (errores.length > 0) log(`Errores: ${errores.length}`, 'error');
  if (opciones.yes) log(`Manifest: ${resultado.manifiesto}`);

  return salir(errores.length > 0 ? 3 : 0);
}

module.exports = {
  main,
  leerOpciones,
  extractIdFromFilename,
  getSrIdsInBd,
  findOrphanPdfs,
  computeChecksum,
  abrirDb,
  DB_PATH,
  STORAGE_ROOT,
  ARCHIVE_ROOT,
  PDF_DIRS,
  TARGET_IDS,
  EXCLUDED_IDS,
};

if (require.main === module) {
  process.exit(main());
}
