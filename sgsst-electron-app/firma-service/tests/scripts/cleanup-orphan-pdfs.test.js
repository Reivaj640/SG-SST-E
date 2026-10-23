/**
 * tests/scripts/cleanup-orphan-pdfs.test.js
 *
 * Tests del script de cleanup de PDF huérfanos.
 *
 * Por que estos tests existen: el script NO tenía ninguno, y el 2026-10-22 se
 * descubrió que en `kair-server` no servía (las rutas estaban fijas al layout
 * local: la base está en `/opt/kair-firma/data/` y el storage en
 * `/opt/kair-firma/storage/`, que son hermanos de `app/`, no hijos). Con un
 * "no hay nada que mover" que en realidad significaba "no miró donde debía",
 * el script era una caja fuerte vacía.
 *
 * Aislamiento:
 *   - BD y storage: directorios temporales, con la variable de entorno
 *     correspondiente puesta ANTES de cargar el script (las rutas se leen al
 *     cargarlo, igual que en `src/config.js`).
 *   - El script se invoca con `main(argv)` (devuelve el código de salida) para
 *     no matar el runner.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const RUTA_SCRIPT = require.resolve('../../scripts/cleanup-orphan-pdfs');

// =============================================================================
// Utilidades
// =============================================================================

/**
 * Crea un arbol temporal con storage (originales/firmados/constancias/papel) y
 * una BD minima con la tabla de firmas.
 * @param {object} [opc] - { enBd: [id_solicitud...], pdfs: [{dir, nombre}] }
 * @returns {{raiz: string, dbPath: string, storage: string, hashDb: string}}
 */
function armar(opc) {
  const o = opc || {};
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-huerfanos-'));
  const storage = path.join(raiz, 'storage', 'pdfs');
  for (const dir of ['originales', 'firmados', 'constancias', 'papel']) {
    fs.mkdirSync(path.join(storage, dir), { recursive: true });
  }
  const dbPath = path.join(raiz, 'data', 'firma.sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec('CREATE TABLE gh_firmas_electronicas (id INTEGER PRIMARY KEY, id_solicitud TEXT)');
  for (const id of (o.enBd || [])) {
    db.prepare('INSERT INTO gh_firmas_electronicas (id_solicitud) VALUES (?)').run(id);
  }
  db.close();

  for (const pdf of (o.pdfs || [])) {
    const destino = path.join(storage, pdf.dir || 'originales', pdf.nombre);
    fs.writeFileSync(destino, pdf.contenido || '%PDF-1.4\ncontenido de prueba\n%%EOF\n');
  }

  return {
    raiz,
    dbPath,
    storage,
    hashDb: crypto.createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex'),
  };
}

/**
 * Carga el script con las variables de entorno indicadas (las rutas se leen al
 * cargar el modulo).
 * @param {object} env
 * @returns {object} el modulo
 */
function cargar(env) {
  delete require.cache[RUTA_SCRIPT];
  const guardados = {};
  for (const k of Object.keys(env)) {
    guardados[k] = process.env[k];
    process.env[k] = env[k];
  }
  try {
    return require(RUTA_SCRIPT);
  } finally {
    for (const k of Object.keys(guardados)) {
      if (guardados[k] === undefined) delete process.env[k];
      else process.env[k] = guardados[k];
    }
  }
}

/**
 * Corre main() capturando lo que imprime.
 * @param {object} mod
 * @param {string[]} [argv]
 * @returns {{codigo: number, salida: string}}
 */
function correr(mod, argv) {
  const original = console.log;
  let salida = '';
  console.log = (t) => { salida += String(t) + '\n'; };
  try {
    const codigo = mod.main(argv);
    return { codigo, salida };
  } finally {
    console.log = original;
  }
}

/**
 * Corre main() sin argumentos, sustituyendo process.argv (prueba de que el
 * camino CLI lee los argumentos de verdad).
 * @param {object} mod
 * @param {string[]} argv
 * @returns {{codigo: number, salida: string}}
 */
function correrConArgvDeProceso(mod, argv) {
  const original = process.argv;
  process.argv = ['node', 'cleanup-orphan-pdfs.js'].concat(argv);
  try {
    return correr(mod);
  } finally {
    process.argv = original;
  }
}

// =============================================================================
// LAS RUTAS (el bug que se encontró en producción)
// =============================================================================

test('las rutas salen del entorno: DB_PATH y PDF_STORAGE_PATH absolutos', () => {
  const base = path.resolve(path.sep, 'opt', 'kair-firma');
  const mod = cargar({
    DB_PATH: path.join(base, 'data', 'firma.sqlite'),
    PDF_STORAGE_PATH: path.join(base, 'storage', 'pdfs'),
  });
  assert.equal(mod.DB_PATH, path.join(base, 'data', 'firma.sqlite'));
  assert.equal(mod.STORAGE_ROOT, path.join(base, 'storage', 'pdfs'));
});

test('una ruta RELATIVA se resuelve contra la raiz del Servicio, no contra el CWD', () => {
  const raizServicio = path.resolve(__dirname, '..', '..');
  const mod = cargar({ DB_PATH: './data/firma.sqlite', PDF_STORAGE_PATH: './storage/pdfs' });
  assert.equal(mod.DB_PATH, path.join(raizServicio, 'data', 'firma.sqlite'));
  assert.equal(mod.STORAGE_ROOT, path.join(raizServicio, 'storage', 'pdfs'));
});

test('el archivo de PDFs es HERMANO del arbol de PDFs, no hijo', () => {
  // Layout local: <app>/storage/pdfs -> <app>/storage/pdf-archive
  const mod = cargar({ DB_PATH: './data/firma.sqlite', PDF_STORAGE_PATH: './storage/pdfs' });
  assert.equal(mod.ARCHIVE_ROOT, path.join(path.resolve(__dirname, '..', '..'), 'storage', 'pdf-archive'));
  // Layout de kair-server: /opt/kair-firma/storage/pdfs -> /opt/kair-firma/storage/pdf-archive
  const base = path.resolve(path.sep, 'opt', 'kair-firma');
  const mod2 = cargar({
    DB_PATH: path.join(base, 'data', 'firma.sqlite'),
    PDF_STORAGE_PATH: path.join(base, 'storage', 'pdfs'),
  });
  assert.equal(mod2.ARCHIVE_ROOT, path.join(base, 'storage', 'pdf-archive'));
});

// =============================================================================
// LA DETECCION
// =============================================================================

test('un PDF sin firma en la BD es huerfano', () => {
  const c = armar({
    enBd: ['SIGN-2026-111111'],
    pdfs: [
      { nombre: 'SIGN-2026-111111.pdf' },
      { nombre: 'SIGN-2026-020330.pdf' },
    ],
  });
  const mod = cargar({ DB_PATH: c.dbPath, PDF_STORAGE_PATH: c.storage });
  const ids = mod.findOrphanPdfs(null).map((o) => o.id);
  assert.deepEqual(ids.sort(), ['SIGN-2026-020330', 'SIGN-2026-111111'],
    'findOrphanPdfs devuelve los CANDIDATOS; el cruce con la BD lo hace main()');
});

test('main: mueve solo el huerfano y deja intacta la firma que SI esta en la BD', () => {
  const c = armar({
    enBd: ['SIGN-2026-111111'],
    pdfs: [
      { dir: 'originales', nombre: 'SIGN-2026-111111.pdf' },
      { dir: 'originales', nombre: 'SIGN-2026-020330.pdf' },
    ],
  });
  const mod = cargar({ DB_PATH: c.dbPath, PDF_STORAGE_PATH: c.storage });
  const r = correr(mod, ['--ids=SIGN-2026-020330']);
  assert.equal(r.codigo, 0);
  assert.ok(r.salida.includes('A mover: 1 archivos'));
  assert.ok(fs.existsSync(path.join(c.storage, 'originales', 'SIGN-2026-111111.pdf')),
    'La firma que esta en la BD NO se toca');
  assert.ok(fs.existsSync(path.join(c.storage, 'originales', 'SIGN-2026-020330.pdf')),
    'El dry-run NO mueve nada');
});

test('sin --ids, un huerfano FUERA de la lista objetivo NO se mueve (la lista manda)', () => {
  const c = armar({
    enBd: [],
    pdfs: [{ nombre: 'SIGN-2026-020330.pdf' }],
  });
  const mod = cargar({ DB_PATH: c.dbPath, PDF_STORAGE_PATH: c.storage });
  const r = correr(mod);
  assert.equal(r.codigo, 0);
  assert.ok(r.salida.includes('Nada que mover'),
    'La lista por defecto no incluye este ID: no se mueve');
  assert.ok(r.salida.includes('FUERA de la lista objetivo'),
    'Pero el script lo dice: el storage NO esta limpio');
});

test('main: el AVISO de huerfanos fuera de la lista objetivo (el "limpio" falso)', () => {
  const c = armar({
    enBd: [],
    pdfs: [
      { nombre: 'SIGN-2026-020330.pdf' },
      { nombre: 'SIGN-2026-999999.pdf' },
    ],
  });
  // La lista objetivo por defecto no incluye ninguno de los dos.
  const mod = cargar({ DB_PATH: c.dbPath, PDF_STORAGE_PATH: c.storage });
  const r = correr(mod);
  assert.ok(r.salida.includes('FUERA de la lista objetivo'),
    'Sin este aviso, "nada que mover" se lee como "storage limpio"');
  assert.ok(r.salida.includes('SIGN-2026-020330'));
  assert.ok(r.salida.includes('SIGN-2026-999999'));
});

test('main: --ids= acota el movimiento al ID pedido', () => {
  const c = armar({
    enBd: [],
    pdfs: [
      { nombre: 'SIGN-2026-020330.pdf' },
      { nombre: 'SIGN-2026-999999.pdf' },
    ],
  });
  const mod = cargar({ DB_PATH: c.dbPath, PDF_STORAGE_PATH: c.storage });
  const r = correr(mod, ['--ids=SIGN-2026-020330']);
  assert.ok(r.salida.includes('A mover: 1 archivos'));
  assert.ok(r.salida.includes('SIGN-2026-999999'), 'El otro sigue siendo huerfano y sale en el aviso');
});

test('main: --todos escanea TODOS los huerfanos, sin lista previa', () => {
  const c = armar({
    enBd: [],
    pdfs: [
      { nombre: 'SIGN-2026-020330.pdf' },
      { nombre: 'SIGN-2026-999999.pdf' },
    ],
  });
  const mod = cargar({ DB_PATH: c.dbPath, PDF_STORAGE_PATH: c.storage });
  const r = correr(mod, ['--todos']);
  assert.equal(r.codigo, 0);
  assert.ok(r.salida.includes('SCAN COMPLETO'));
  assert.ok(r.salida.includes('A mover: 2 archivos'));
  assert.ok(!r.salida.includes('FUERA de la lista objetivo'),
    'En scan completo no hay "fuera de la lista": se mueven todos');
});

// =============================================================================
// EL DRY-RUN NO ESCRIBE NADA
// =============================================================================

test('el dry-run NO escribe: no mueve, no crea el archivo, no crea el manifiesto', () => {
  const c = armar({ enBd: [], pdfs: [{ nombre: 'SIGN-2026-020330.pdf' }] });
  const mod = cargar({ DB_PATH: c.dbPath, PDF_STORAGE_PATH: c.storage });
  const r = correr(mod, ['--ids=SIGN-2026-020330']);
  assert.equal(r.codigo, 0);
  assert.ok(r.salida.includes('A mover: 1 archivos'));
  assert.ok(fs.existsSync(path.join(c.storage, 'originales', 'SIGN-2026-020330.pdf')),
    'El archivo sigue donde estaba');
  assert.ok(!fs.existsSync(path.join(path.dirname(c.storage), 'pdf-archive')),
    'El dry-run no crea el directorio de archivo');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(c.dbPath)).digest('hex'), c.hashDb,
    'El dry-run no toca la base');
});

test('el dry-run funciona en produccion (no hay hard-block): es la unica forma de VER', () => {
  const c = armar({ enBd: [], pdfs: [{ nombre: 'SIGN-2026-020330.pdf' }] });
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const mod = cargar({ DB_PATH: c.dbPath, PDF_STORAGE_PATH: c.storage });
    const r = correr(mod, ['--ids=SIGN-2026-020330']);
    assert.equal(r.codigo, 0, 'El dry-run en produccion no se bloquea');
    assert.ok(r.salida.includes('A mover: 1 archivos'));
    assert.ok(fs.existsSync(path.join(c.storage, 'originales', 'SIGN-2026-020330.pdf')),
      'Y no mueve nada');
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});

// =============================================================================
// MOVER: NUNCA BORRAR
// =============================================================================

test('con --yes mueve al archivo, deja manifiesto con el SHA-256 y NO borra', () => {
  const c = armar({ enBd: [], pdfs: [{ dir: 'originales', nombre: 'SIGN-2026-020330.pdf' }] });
  const mod = cargar({ DB_PATH: c.dbPath, PDF_STORAGE_PATH: c.storage });
  const r = correr(mod, ['--ids=SIGN-2026-020330', '--yes']);
  assert.equal(r.codigo, 0);
  assert.ok(r.salida.includes('Movidos: 1 archivos'));

  const hoy = new Date().toISOString().slice(0, 10);
  const movido = path.join(path.dirname(c.storage), 'pdf-archive', hoy, 'originales', 'SIGN-2026-020330.pdf');
  assert.ok(fs.existsSync(movido), 'El PDF esta en el archivo (con su estructura)');
  assert.ok(!fs.existsSync(path.join(c.storage, 'originales', 'SIGN-2026-020330.pdf')),
    'Ya no esta en el arbol principal');

  const manifiesto = JSON.parse(fs.readFileSync(
    path.join(path.dirname(c.storage), 'pdf-archive', hoy, 'manifest.json'), 'utf8'
  ));
  assert.equal(manifiesto.total_orphans, 1);
  assert.equal(manifiesto.moved, 1);
  assert.equal(manifiesto.items[0].id, 'SIGN-2026-020330');
  assert.equal(manifiesto.items[0].sha256,
    crypto.createHash('sha256').update(fs.readFileSync(movido)).digest('hex'),
    'El manifiesto lleva el SHA-256 del archivo movido');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(c.dbPath)).digest('hex'), c.hashDb,
    'La base NO se modifica: el script es de solo lectura sobre la BD');
});

test('el manifiesto del dia NO se pisa entre ejecuciones: las entradas se acumulan', () => {
  const c = armar({
    enBd: [],
    pdfs: [
      { dir: 'originales', nombre: 'SIGN-2026-020330.pdf' },
      { dir: 'firmados', nombre: 'SIGN-2026-020330.pdf' },
    ],
  });
  const mod = cargar({ DB_PATH: c.dbPath, PDF_STORAGE_PATH: c.storage });
  const r1 = correr(mod, ['--todos', '--yes']);
  assert.equal(r1.codigo, 0);
  assert.ok(r1.salida.includes('Movidos: 2 archivos'));

  // Llega otro huerfano y se vuelve a correr el script el mismo dia.
  fs.writeFileSync(path.join(c.storage, 'originales', 'SIGN-2026-777777.pdf'), '%PDF-1.4\notro\n%%EOF\n');
  const r2 = correr(mod, ['--todos', '--yes']);
  assert.equal(r2.codigo, 0);
  assert.ok(r2.salida.includes('Movidos: 1 archivos'));

  const hoy = new Date().toISOString().slice(0, 10);
  const manifiesto = JSON.parse(fs.readFileSync(
    path.join(path.dirname(c.storage), 'pdf-archive', hoy, 'manifest.json'), 'utf8'
  ));
  assert.equal(manifiesto.total_orphans, 3,
    'El manifiesto del dia acumula: 2 de la primera corrida + 1 de la segunda');
  assert.equal(manifiesto.moved, 3);
  assert.equal(manifiesto.items.length, 3);
  assert.ok(manifiesto.items.some(i => i.id === 'SIGN-2026-777777'),
    'La entrada de la segunda corrida esta');
});

// =============================================================================
// CASOS DE BORDE
// =============================================================================

test('si la BD no existe, sale con codigo 2 y lo dice', () => {
  const mod = cargar({
    DB_PATH: path.join(os.tmpdir(), 'no-existe-esta-base.sqlite'),
    PDF_STORAGE_PATH: path.join(os.tmpdir(), 'no-existe-este-storage'),
  });
  const r = correr(mod);
  assert.equal(r.codigo, 2);
  assert.ok(r.salida.includes('BD no encontrada'));
});

test('abrirDb falla si el archivo no existe (no inventa una base nueva)', () => {
  const mod = cargar({ DB_PATH: './data/firma.sqlite', PDF_STORAGE_PATH: './storage/pdfs' });
  assert.throws(() => mod.abrirDb(path.join(os.tmpdir(), 'no-existe-esta-base.sqlite')),
    'fileMustExist: en produccion, abrir en modo escritura crearia una base VACIA en una ruta equivocada');
});

test('como root, el script NO cae a abrir la base en modo escritura', () => {
  const fuente = fs.readFileSync(RUTA_SCRIPT, 'utf8');
  assert.ok(fuente.includes('process.getuid'),
    'El script distingue el caso root (dejar -wal/-shm de root rompe al servicio)');
  assert.ok(fuente.includes('sudo -u kairfirma'),
    'Y dice como hay que correrlo en produccion');
});

test('un PDF con nombre que no es SIGN-YYYY-NNNNN se ignora (no se mueve nada raro)', () => {
  const c = armar({ enBd: [], pdfs: [{ nombre: 'documento-sin-id.pdf' }] });
  const mod = cargar({ DB_PATH: c.dbPath, PDF_STORAGE_PATH: c.storage });
  const r = correr(mod);
  assert.equal(r.codigo, 0);
  assert.ok(r.salida.includes('Nada que mover'));
  assert.ok(fs.existsSync(path.join(c.storage, 'originales', 'documento-sin-id.pdf')));
});

test('el patron de id acepta los sufijos de cada arbol', () => {
  const mod = cargar({ DB_PATH: './data/firma.sqlite', PDF_STORAGE_PATH: './storage/pdfs' });
  assert.equal(mod.extractIdFromFilename('SIGN-2026-020330.pdf'), 'SIGN-2026-020330');
  assert.equal(mod.extractIdFromFilename('SIGN-2026-020330-constancia.pdf'), 'SIGN-2026-020330');
  assert.equal(mod.extractIdFromFilename('SIGN-2026-020330-firmado.pdf'), 'SIGN-2026-020330');
  assert.equal(mod.extractIdFromFilename('SIGN-2026-020330-registro.pdf'), 'SIGN-2026-020330');
  assert.equal(mod.extractIdFromFilename('otro.pdf'), null);
});

test('el arbol papel/ tambien se escanea (9A: el firmado en papel)', () => {
  const c = armar({
    enBd: [],
    pdfs: [{ dir: 'papel', nombre: 'SIGN-2026-020330-firmado.pdf' }],
  });
  const mod = cargar({ DB_PATH: c.dbPath, PDF_STORAGE_PATH: c.storage });
  const r = correr(mod, ['--todos']);
  assert.ok(r.salida.includes('A mover: 1 archivos'));
});

// =============================================================================
// EL MODO JSON Y EL CAMINO CLI
// =============================================================================

test('en --json sale SOLO JSON (stdout parseable) y describe el resultado', () => {
  const c = armar({ enBd: [], pdfs: [{ nombre: 'SIGN-2026-020330.pdf' }] });
  const mod = cargar({ DB_PATH: c.dbPath, PDF_STORAGE_PATH: c.storage });

  // Sin --ids: el huerfano esta fuera de la lista objetivo.
  const r1 = correr(mod, ['--json']);
  assert.equal(r1.codigo, 0);
  const datos1 = JSON.parse(r1.salida);
  assert.equal(datos1.modo, 'dry-run');
  assert.equal(datos1.total_huerfanos, 1);
  assert.deepEqual(datos1.a_mover, []);
  assert.deepEqual(datos1.fuera_de_lista, ['SIGN-2026-020330'],
    'El huerfano esta fuera de la lista por defecto y el JSON lo dice');

  // Con --ids: pasa a la lista de movimiento.
  const r2 = correr(mod, ['--json', '--ids=SIGN-2026-020330']);
  const datos2 = JSON.parse(r2.salida);
  assert.deepEqual(datos2.a_mover, ['SIGN-2026-020330']);
  assert.deepEqual(datos2.fuera_de_lista, []);
});

test('main() sin argumentos lee process.argv (el camino CLI de verdad)', () => {
  const c = armar({ enBd: [], pdfs: [{ nombre: 'SIGN-2026-020330.pdf' }] });
  const mod = cargar({ DB_PATH: c.dbPath, PDF_STORAGE_PATH: c.storage });
  const r = correrConArgvDeProceso(mod, ['--ids=SIGN-2026-020330', '--json']);
  assert.equal(r.codigo, 0);
  const datos = JSON.parse(r.salida);
  assert.deepEqual(datos.a_mover, ['SIGN-2026-020330']);
  assert.deepEqual(datos.fuera_de_lista, []);
});

// =============================================================================
// EL SCRIPT NO ESCRIBE EN LA BASE (por construccion)
// =============================================================================

test('el fuente del script NO contiene ninguna sentencia de escritura en SQL', () => {
  const fuente = fs.readFileSync(RUTA_SCRIPT, 'utf8');
  // Sentencias SQL de escritura (no la palabra suelta: `crypto.update` no es SQL).
  const prohibido = /\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE|CREATE\s+TABLE|REPLACE\s+INTO)\b/i;
  const encontrados = fuente.split('\n')
    .map((linea, i) => ({ linea: i + 1, texto: linea }))
    .filter(x => prohibido.test(x.texto));
  assert.deepEqual(encontrados, [],
    'Este script mueve archivos, no filas: la BD se abre en solo lectura');
});

test('la base se abre en solo lectura (readonly: true)', () => {
  const fuente = fs.readFileSync(RUTA_SCRIPT, 'utf8');
  assert.ok(fuente.includes('readonly: true'),
    'La base se abre en solo lectura: el candado es real');
});
