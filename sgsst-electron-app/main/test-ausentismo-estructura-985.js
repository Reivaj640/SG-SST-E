/* Test de 📦985 — la estructura dejó de llevar la lista de archivos y el listado de
 * ausentismo se quedó sin registros.
 *
 * EL BUG
 * ------
 * `Portear/src/map_directory.py` (📦866, Fase 3) quitó el campo `files[]` del JSON
 * del mapeo. El motivo escrito en el commit fue "mismos 0 consumidores (grep)".
 * Ese grep estaba mal: `main.js` leía `node.files` en los cuatro handlers de
 * ausentismo (el listado, el PRI.xlsx, editar fila y eliminar fila).
 *
 * Consecuencia medida el 28-oct-2026 en el portatil: Tempoactiva tiene `files: []`
 * en sus 364 carpetas (fue re-mapeada con la version nueva) y 269 carpetas con
 * archivos en disco. El handler no encontraba ningun .xlsx, lanzaba, y la
 * pantalla quedaba vacia con los filtros en "Cargando anios..." para siempre.
 *
 * QUE SE VERIFICA
 * ---------------
 *   1. `main/structure-files.js` REAL, ejecutado contra un fixture temporal:
 *      lee del disco cuando el nodo no trae lista, respeta la lista cuando si la
 *      trae, devuelve la extension CON punto y nunca lanza.
 *   2. Los cuatro handlers de `main.js` usan el helper (guard sobre el codigo).
 *   3. El renderer llena los filtros tambien cuando la carga falla: si no, los
 *      dropdowns quedan en "Cargando anios..." para siempre y la pantalla miente.
 *   4. Mutaciones: cada una tiene que hacer caer al menos un check.
 */

'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const helperPath = path.join(__dirname, 'structure-files.js');
const mainPath = path.join(ROOT, 'main.js');
const modPath = path.join(ROOT, 'modules', 'gestion-salud', 'ausentismo', 'medicion-ausentismo.js');
const mapPath = path.join(ROOT, 'Portear', 'src', 'map_directory.py');

const checks = [];
function chk(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra || '' });
}

function correr() {
  let failed = 0;
  console.log('\n=======================================');
  console.log('  📦985 · Estructura sin lista de archivos');
  console.log('=======================================');
  checks.forEach(function (c) {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  console.log('=======================================');
  process.exit(failed === 0 ? 0 : 1);
}

if (!fs.existsSync(helperPath) || !fs.existsSync(mainPath) || !fs.existsSync(modPath) || !fs.existsSync(mapPath)) {
  console.error('FAIL: faltan structure-files.js, main.js, medicion-ausentismo.js o map_directory.py');
  process.exit(1);
}

const helperSrc = fs.readFileSync(helperPath, 'utf8');
const mainSrc = fs.readFileSync(mainPath, 'utf8');
const modSrc = fs.readFileSync(modPath, 'utf8');
const mapSrc = fs.readFileSync(mapPath, 'utf8');

// ───────────────────────── evaluador del helper (permite mutarlo)
function cargarHelper(src) {
  const mod = { exports: {} };
  const sandbox = {
    module: mod,
    exports: mod.exports,
    require: function (id) {
      if (id === 'fs') return fs;
      if (id === 'fs/promises') return fsp;
      if (id === 'path') return path;
      throw new Error('modulo no permitido en el sandbox: ' + id);
    },
    console: { warn: function () {}, log: function () {} },
    __dirname: __dirname,
    __filename: helperPath
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'structure-files.js' });
  return mod.exports;
}

// ───────────────────────── fixture temporal
const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-985-'));
fs.writeFileSync(path.join(fixtureDir, 'GI-FO-076 AUSENTISMO POR ARL Y EPS 2024.xlsx'), 'x');
fs.writeFileSync(path.join(fixtureDir, 'PRI.xlsx'), 'x');
fs.writeFileSync(path.join(fixtureDir, 'desktop.ini'), '[x]');
fs.mkdirSync(path.join(fixtureDir, 'subcarpeta'));
fs.writeFileSync(path.join(fixtureDir, 'subcarpeta', 'dentro.xlsx'), 'x');

// ───────────────────────── los checks del helper, evaluados contra una lista destino
function checksHelper(r, destino) {
  function add(n, c, e) { destino.push({ name: n, ok: !!c, extra: e || '' }); }

  const delDisco = r.delDisco || [];
  add('lee los archivos del disco cuando el nodo no trae lista', delDisco.length === 3, 'trajo ' + delDisco.length + ' (se esperaban 3)');
  add('no mete directorios en la lista', !delDisco.some(function (f) { return f.name === 'subcarpeta'; }));
  const xlsx = delDisco.filter(function (f) { return f.name.toLowerCase().indexOf('.xlsx') >= 0; });
  add('encuentra los .xlsx del disco', xlsx.length === 2, 'encontro ' + xlsx.length + ' (se esperaban 2)');
  add('la extension lleva el punto y la capitalizacion original',
    xlsx.some(function (f) { return f.extension === '.xlsx'; }) &&
    delDisco.some(function (f) { return f.extension === '.ini'; }),
    'extensiones: ' + delDisco.map(function (f) { return f.extension; }).join(','));
  add('el path del archivo es el de la carpeta', xlsx.every(function (f) { return f.path.indexOf(fixtureDir) === 0; }));
  add('el size se lee del disco', xlsx.every(function (f) { return f.size > 0; }));
  add('respeta la lista del config cuando viene', r.conLista.length === 1 && r.conLista[0].name === 'X.XLSX',
    'trajo ' + r.conLista.length);
  add('una ruta que no existe devuelve lista vacia y NO lanza', Array.isArray(r.rutaMuerta) && r.rutaMuerta.length === 0);
  add('un nodo nulo devuelve lista vacia', Array.isArray(r.sinNada) && r.sinNada.length === 0);
  add('un nodo sin path ni lista devuelve lista vacia', Array.isArray(r.sinRuta) && r.sinRuta.length === 0);
}

async function correrFixture(resolver) {
  return {
    delDisco: await resolver({ path: fixtureDir }),
    conLista: await resolver({
      path: path.join(fixtureDir, 'NO_EXISTE'),
      files: [{ name: 'X.XLSX', path: 'C:/ficticio/X.XLSX', extension: '.XLSX' }]
    }),
    rutaMuerta: await resolver({ path: path.join(fixtureDir, 'NO_EXISTE') }),
    sinNada: await resolver(null),
    sinRuta: await resolver({ name: 'carpeta' })
  };
}

// ───────────────────────── guards sobre el codigo (se evaluan sobre una fuente)
function guardsMain(src) {
  const g = [];
  const usos = (src.match(/resolverArchivosNodo\(/g) || []).length;
  g.push({ name: 'main.js llama al helper en los cuatro handlers', ok: usos >= 4, extra: 'usos: ' + usos });
  g.push({ name: 'main.js ya NO lee node.files del config',
    ok: !/ausentismoDir\s*\.\s*files/.test(src), extra: '' });
  g.push({ name: 'main.js importa el helper desde ./main/structure-files',
    ok: /require\('\.\/main\/structure-files'\)/.test(src), extra: '' });
  g.push({ name: 'el helper se importa una sola vez',
    ok: (src.match(/require\('\.\/main\/structure-files'\)/g) || []).length === 1, extra: '' });
  return g;
}

function guardsMod(src) {
  const g = [];
  const iFalta = src.indexOf('} else if (result && result._missingFile) {');
  const iElse = src.indexOf('} else {', iFalta);
  const iCatch = src.indexOf('} catch (error) {', iElse);
  const ramaFalta = src.slice(iFalta, iElse);
  const ramaElse = src.slice(iElse, iCatch);
  // La rama catch se corta en su cierre: si se toma una ventana fija, se cuela
  // la DECLARACION de populateDynamicFilters() que viene justo despues y el
  // guard ve un `populateDynamicFilters()` que no es la llamada.
  const finCatch = src.indexOf('\n        }\n    }', iCatch);
  const ramaCatch = src.slice(iCatch, finCatch > iCatch ? finCatch : iCatch + 400);

  g.push({ name: 'el renderer llena los filtros cuando falta el archivo',
    ok: ramaFalta.indexOf('this.populateDynamicFilters();') >= 0, extra: '' });
  g.push({ name: 'el renderer llena los filtros cuando no hay registros',
    ok: ramaElse.indexOf('this.populateDynamicFilters();') >= 0, extra: '' });
  g.push({ name: 'el renderer llena los filtros cuando la carga falla',
    ok: ramaCatch.indexOf('this.populateDynamicFilters();') >= 0, extra: '' });
  g.push({ name: 'las tres ramas limpian los datos antes de llenar los filtros',
    ok: ramaFalta.indexOf('this.currentAusentismoData = []') >= 0 &&
        ramaElse.indexOf('this.currentAusentismoData = []') >= 0 &&
        ramaCatch.indexOf('this.currentAusentismoData = []') >= 0, extra: '' });
  return g;
}

// ═══════════════════════════════════════════════════════════════════
(async function () {
  // ───────────────────────── 1. el helper real
  const helper = cargarHelper(helperSrc);
  chk('el helper exporta resolverArchivosNodo', typeof helper.resolverArchivosNodo === 'function');
  chk('el helper tiene el contrato async',
    typeof helper.resolverArchivosNodo({ path: fixtureDir }).then === 'function');

  const base = await correrFixture(helper.resolverArchivosNodo);
  checksHelper(base, checks);

  // ───────────────────────── 2. guards sobre main.js y el renderer
  guardsMain(mainSrc).forEach(function (g) { chk(g.name, g.ok, g.extra); });
  guardsMod(modSrc).forEach(function (g) { chk(g.name, g.ok, g.extra); });

  // ───────────────────────── 3. el contrato del mapeo sigue intacto
  chk('el mapeo (📦866) no volvio a guardar files[] en el JSON',
    !/'files':\s*\[\]/.test(mapSrc) && !/"files":\s*\[\]/.test(mapSrc));

  // ───────────────────────── 4. mutaciones del helper
  const MUT_HELPER = [
    ['ignora la lista del config y siempre lee el disco',
      function (s) { return s.replace('const delConfig = Array.isArray(node.files) ? node.files : [];', 'const delConfig = [];'); }],
    ['no lee el disco',
      function (s) { return s.replace('entradas = await fsp.readdir(node.path, { withFileTypes: true });', 'entradas = [];'); }],
    ['le quita el punto a la extension',
      function (s) { return s.replace('extension: path.extname(e.name),', 'extension: path.extname(e.name).substring(1),'); }],
    ['mete los directorios en la lista',
      function (s) { return s.replace('if (!e.isFile()) continue;', ''); }],
    ['lanza cuando la carpeta no existe',
      function (s) { return s.replace('console.warn(\'[STRUCTURE-FILES]', 'throw e; console.warn(\'[STRUCTURE-FILES]'); }]
  ];

  for (const m of MUT_HELPER) {
    const nombre = m[0];
    const mutado = m[1](helperSrc);
    if (mutado === helperSrc) {
      chk('MUTANTE detectado: ' + nombre, false, 'la mutacion no cambio el codigo (patron desfasado)');
      continue;
    }
    let fallo = false;
    try {
      const h = cargarHelper(mutado);
      const r = await correrFixture(h.resolverArchivosNodo);
      const destino = [];
      checksHelper(r, destino);
      fallo = destino.some(function (c) { return !c.ok; });
    } catch (e) {
      fallo = true; // el mutante lanzo: tambien es detectado
    }
    chk('MUTANTE detectado: ' + nombre, fallo);
  }

  // ───────────────────────── 5. mutaciones de main.js y del renderer
  const mutMain = mainSrc.replace('await resolverArchivosNodo(ausentismoDir)', 'ausentismoDir.files || []');
  chk('MUTANTE detectado: main.js vuelve a leer node.files',
    guardsMain(mutMain).some(function (g) { return !g.ok; }) &&
    !guardsMain(mainSrc).some(function (g) { return !g.ok; }));

  const mutMod = modSrc.replace('this.populateDynamicFilters();\n            this.showNotification(`Error: ${error.message}`, \'error\');',
    'this.showNotification(`Error: ${error.message}`, \'error\');');
  chk('MUTANTE detectado: el renderer deja el catch sin llenar los filtros',
    mutMod !== modSrc &&
    guardsMod(mutMod).some(function (g) { return !g.ok; }) &&
    !guardsMod(modSrc).some(function (g) { return !g.ok; }));

  const mutModElse = modSrc.replace('this.currentAusentismoData = [];\n                this.renderTable(tableElement, []);\n                this.populateDynamicFilters();\n                this.showNotification(\'No hay registros disponibles\', \'warning\');',
    'this.renderTable(tableElement, []);\n                this.showNotification(\'No hay registros disponibles\', \'warning\');');
  chk('MUTANTE detectado: el renderer no limpia los datos antes de llenar los filtros',
    mutModElse !== modSrc &&
    guardsMod(mutModElse).some(function (g) { return !g.ok; }));

  // ───────────────────────── 6. limpieza
  try { fs.rmSync(fixtureDir, { recursive: true, force: true }); } catch (e) { /* el temp se limpia solo */ }

  correr();
})();
