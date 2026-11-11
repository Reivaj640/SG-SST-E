/* Test de 📦986 — el guard que detecta un Python sin dependencias.
 *
 * EL PROBLEMA
 * -----------
 * `findPython()` en `main.js` solo comprobaba `python --version`. Un Python
 * cualquiera del PATH pasaba el chequeo: el 3.14 de esta maquina responde
 * `--version` pero no tiene pandas. El fallo NO aparecia al arrancar, sino a
 * mitad de uso, como `ModuleNotFoundError: No module named 'pandas'` al
 * registrar una incapacidad.
 *
 * Lo que se vio el 28-oct-2026 en el portatil: `Portear/python-embed/` tenia las
 * 143 librerias pero le faltaba el runtime, y `python-embed/` esta en
 * `.gitignore` (el runtime nunca estuvo en el repo; se instala por maquina con
 * `scripts/prepare-python-embed.bat`).
 *
 * QUE SE VERIFICA
 * ---------------
 *   1. `main/python-deps.js` REAL: distingue un Python con pandas de uno que no,
 *      y NUNCA lanza (para el chequeo de arranque interesa "no sirve", no una
 *      excepcion).
 *   2. `main.js` valida las dependencias en los tres bucles de `findPython()`.
 *   3. El check de arranque dice si al Python le faltan y cuenta como no
 *      disponible: el error tiene que salir al arrancar, no a mitad de uso.
 *   4. Mutaciones: cada una tiene que hacer caer al menos un check.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');

const ROOT = path.join(__dirname, '..');
const depsPath = path.join(__dirname, 'python-deps.js');
const mainPath = path.join(ROOT, 'main.js');

const checks = [];
function chk(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra || '' });
}

function correr() {
  let failed = 0;
  console.log('\n=======================================');
  console.log('  📦986 · Guard del Python sin dependencias');
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

if (!fs.existsSync(depsPath) || !fs.existsSync(mainPath)) {
  console.error('FAIL: faltan python-deps.js o main.js');
  process.exit(1);
}

const depsSrc = fs.readFileSync(depsPath, 'utf8');
const mainSrc = fs.readFileSync(mainPath, 'utf8');

// ───────────────────────── evaluador del modulo (permite mutarlo)
function cargarModulo(src, cp) {
  const mod = { exports: {} };
  const child = cp || childProcess;
  const sandbox = {
    module: mod,
    exports: mod.exports,
    require: function (id) {
      if (id === 'child_process') return child;
      throw new Error('modulo no permitido en el sandbox: ' + id);
    },
    console: { warn: function () {}, log: function () {}, error: function () {} },
    __dirname: __dirname,
    __filename: depsPath
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'python-deps.js' });
  return mod.exports;
}

// ───────────────────────── Pythones de prueba
const EMBED = path.join(ROOT, 'Portear', 'python-embed', 'python.exe');
// El embed es el que debe servir. Si no esta (maquina sin preparar), el caso
// "true" se omite: no es un fallo del codigo, es que la maquina no lo tiene.
const hayEmbed = fs.existsSync(EMBED);
// Para el caso "false" sirve CUALQUIER ejecutable que no sepa importar pandas.
// NO se usa cmd.exe: `cmd -c` abre una consola interactiva y el test se cuelga.
// node con `--check` (que es `-c`) solo valida la sintaxis: `import pandas` es
// JS invalido, sale con codigo != 0 y falla de inmediato.
const NO_PYTHON = process.execPath;
const RUTA_INEXISTENTE = path.join(os.tmpdir(), 'kair-986-no-existe-python.exe');

// ───────────────────────── dobles deterministas para las mutaciones
// El mutante "nunca dice que tiene las dependencias" SOLO se distingue del
// codigo bueno en UN caso: un interprete que SI tiene las dependencias. En una
// maquina sin `Portear/python-embed/python.exe` ese caso no existe (el
// bloque lo salta con `hayEmbed === false`), el mutante queda indetectable y
// el check se pone rojo sin que el producto haya cambiado. Para que el guard
// muerda en CUALQUIER maquina, las mutaciones se juzgan contra un doble de
// `child_process` que simula dos interpretes: uno que importa pandas y
// openpyxl, otro que no. Todo lo demas (ejecutable que NO es Python, ruta
// inexistente, embed REAL si esta) sigue yendo al `child_process` de verdad.
const PYTHON_CON_DEPS = path.join(os.tmpdir(), 'kair-986-python-con-deps.exe');
const PYTHON_SIN_DEPS = path.join(os.tmpdir(), 'kair-986-python-sin-deps.exe');

function dobleChildProcess() {
  const real = childProcess.execFile;
  return {
    execFile: function (cmd, args, opts, cb) {
      if (typeof opts === 'function') { cb = opts; opts = {}; }
      if (cmd === PYTHON_CON_DEPS) { cb(null, '', ''); return; }
      if (cmd === PYTHON_SIN_DEPS) {
        const e = new Error('simulado: el interprete no tiene las dependencias');
        e.stdout = '';
        e.stderr = '';
        cb(e, '', '');
        return;
      }
      real(cmd, args, opts, cb);
    }
  };
}

// Casos de referencia con los que se juzga a un modulo (vivo o mutado):
// un interprete con dependencias, uno sin ellas, y las dos entradas vacias.
async function evaluarModulo(m) {
  const r = {};
  r.rCon = await m.pythonTieneDependencias(PYTHON_CON_DEPS);
  r.rSin = await m.pythonTieneDependencias(PYTHON_SIN_DEPS);
  r.rNulo = await m.pythonTieneDependencias(null);
  r.rVacio = await m.pythonTieneDependencias('');
  return r;
}

// ───────────────────────── checks del modulo, contra una lista destino
function checksModulo(m, destino) {
  function add(n, c, e) { destino.push({ name: n, ok: !!c, extra: e || '' }); }

  add('exporta pythonTieneDependencias', typeof m.pythonTieneDependencias === 'function');
  add('exporta la lista de dependencias', Array.isArray(m.PYTHON_DEPS_REQUERIDAS) && m.PYTHON_DEPS_REQUERIDAS.indexOf('pandas') >= 0,
    JSON.stringify(m.PYTHON_DEPS_REQUERIDAS));
}

// ───────────────────────── guards sobre main.js
function guardsMain(src) {
  const g = [];
  const usos = (src.match(/pythonTieneDependencias\(/g) || []).length;
  g.push({ name: 'main.js valida las dependencias en los bucles de busqueda de Python', ok: usos >= 4, extra: 'usos: ' + usos });
  g.push({ name: 'main.js importa el modulo python-deps',
    ok: /require\('\.\/main\/python-deps'\)/.test(src), extra: '' });
  g.push({ name: 'el error final dice que le faltan las dependencias',
    ok: /le faltan[\s\S]{0,120}PYTHON_DEPS_REQUERIDAS/.test(src) ||
       /PYTHON_DEPS_REQUERIDAS[\s\S]{0,400}prepare-python-embed/.test(src), extra: '' });
  g.push({ name: 'el check de arranque calcula hasDependencies',
    ok: /hasDependencies\s*=/.test(src), extra: '' });
  g.push({ name: 'el check de arranque no cuenta un Python sin deps como disponible',
    ok: /overall\s*=\s*result\.python\.available[\s\S]{0,200}hasDependencies/.test(src), extra: '' });
  return g;
}

// ───────────────────────── derivacion de las mutaciones desde el codigo VIVO
// PROMPT.md §7 y la trampa 28: una mutacion escrita con un literal pegado a
// mano se rompe en el siguiente bumpeo (el codigo deja de coincidir, el
// mutante queda vacio y el guard deja de mirar lo que dice mirar). Ahi las
// mutaciones se DERIVAN del fuente que se acaba de leer: se localiza el
// cuerpo de `pythonTieneDependencias` y se altera SU codigo de retorno. Si la
// derivacion no encuentra lo que busca NO se degrada en silencio: el mutante
// se reporta como desfasado y el check queda rojo.

// Devuelve el indice del cierre que corresponde a `abre` en `txt[i]`,
// saltando cadenas, plantillas y comentarios.
function empareja(txt, i, abre, cierra) {
  let nivel = 0;
  let k = i;
  while (k < txt.length) {
    const c = txt[k];
    if (c === '/' && txt[k + 1] === '/') {
      const nl = txt.indexOf('\n', k);
      k = nl < 0 ? txt.length : nl + 1;
      continue;
    }
    if (c === '/' && txt[k + 1] === '*') {
      const fc = txt.indexOf('*/', k + 2);
      k = fc < 0 ? txt.length : fc + 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      k++;
      while (k < txt.length) {
        if (txt[k] === '\\') { k += 2; continue; }
        if (txt[k] === q) { k++; break; }
        k++;
      }
      continue;
    }
    if (c === abre) nivel++;
    else if (c === cierra) {
      nivel--;
      if (nivel === 0) return k;
    }
    k++;
  }
  return -1;
}

// Ubica el cuerpo de una funcion nombrada en el fuente vivo.
function cuerpoDe(src, nombre) {
  const re = new RegExp('^[ \\t]*(?:async\\s+)?function\\s+' + nombre + '\\s*\\(', 'm');
  const m = re.exec(src);
  if (!m) return null;
  const abreParen = src.indexOf('(', m.index);
  if (abreParen < 0) return null;
  const cierraParen = empareja(src, abreParen, '(', ')');
  if (cierraParen < 0) return null;
  const llave = src.indexOf('{', cierraParen);
  if (llave < 0) return null;
  const fin = empareja(src, llave, '{', '}');
  if (fin < 0) return null;
  return { inicio: llave, fin: fin };
}

// Cambia los `return <de>;` del cuerpo vivo por `return <a>;`.
function mutarRetornos(src, de, a) {
  const c = cuerpoDe(src, 'pythonTieneDependencias');
  if (!c) return { ok: false, src: src, motivo: 'no se encontro la funcion pythonTieneDependencias' };
  const interior = src.slice(c.inicio + 1, c.fin);
  const re = new RegExp('return\\s+' + de + '\\s*;', 'g');
  const n = (interior.match(re) || []).length;
  if (n === 0) return { ok: false, src: src, motivo: 'la funcion no devuelve ' + de };
  const nuevo = interior.replace(re, 'return ' + a + ';');
  return { ok: true, src: src.slice(0, c.inicio + 1) + nuevo + src.slice(c.fin), motivo: '' };
}

// Cambia el `return` del bloque `catch` por un `throw` de lo capturado.
function mutarLanza(src) {
  const c = cuerpoDe(src, 'pythonTieneDependencias');
  if (!c) return { ok: false, src: src, motivo: 'no se encontro la funcion pythonTieneDependencias' };
  const interior = src.slice(c.inicio + 1, c.fin);
  const mc = /catch\s*\(\s*(\w+)\s*\)/.exec(interior);
  if (!mc) return { ok: false, src: src, motivo: 'la funcion no tiene bloque catch' };
  const llave = interior.indexOf('{', mc.index + mc[0].length);
  if (llave < 0) return { ok: false, src: src, motivo: 'no se pudo leer el bloque catch' };
  const fin = empareja(interior, llave, '{', '}');
  if (fin < 0) return { ok: false, src: src, motivo: 'no se pudo leer el bloque catch' };
  const bloque = interior.slice(llave + 1, fin);
  const nuevoBloque = bloque.replace(/return\s+[^;]+;/, 'throw ' + mc[1] + ';');
  if (nuevoBloque === bloque) return { ok: false, src: src, motivo: 'el catch no devuelve nada que lanzar' };
  const nuevoInterior = interior.slice(0, llave + 1) + nuevoBloque + interior.slice(fin);
  return { ok: true, src: src.slice(0, c.inicio + 1) + nuevoInterior + src.slice(c.fin), motivo: '' };
}

// ═══════════════════════════════════════════════════════════════════
(async function () {
  const mod = cargarModulo(depsSrc);
  checksModulo(mod, checks);

  chk('detecta que un ejecutable que NO es Python no tiene las dependencias',
    (await mod.pythonTieneDependencias(NO_PYTHON)) === false, NO_PYTHON);
  chk('una ruta inexistente devuelve false y no lanza',
    (await mod.pythonTieneDependencias(RUTA_INEXISTENTE)) === false);
  chk('un path nulo devuelve false y no lanza',
    (await mod.pythonTieneDependencias(null)) === false);
  chk('un path vacio devuelve false y no lanza',
    (await mod.pythonTieneDependencias('')) === false);

  if (hayEmbed) {
    chk('detecta que el Python embebido SI tiene las dependencias',
      (await mod.pythonTieneDependencias(EMBED)) === true, EMBED);
  } else {
    console.log('  (aviso: no hay Python embebido en esta maquina; se omite el caso "true")');
  }

  guardsMain(mainSrc).forEach(function (g) { chk(g.name, g.ok, g.extra); });

  // ───────────────────────── mutaciones del modulo
  // Cada mutacion se deriva del codigo vivo (ver `mutarRetornos` /
  // `mutarLanza`) y se juzga contra los casos de referencia: un mutante que
  // no rompe NINGUN caso de referencia es un mutante que el guard no
  // detectaria, y por lo tanto un guard caido.
  const MUT = [
    ['siempre dice que tiene las dependencias',
      function (s) { return mutarRetornos(s, 'false', 'true'); }],
    ['nunca dice que tiene las dependencias',
      function (s) { return mutarRetornos(s, 'true', 'false'); }],
    ['lanza en vez de devolver false',
      function (s) { return mutarLanza(s); }]
  ];

  const doble = dobleChildProcess();

  // El modulo SIN mutar tiene que ser verde contra las MISMAS referencias con
  // las que se juzga a los mutantes. Si el bueno falla, un mutante "fallaria"
  // por la razon equivocada y el guard no estaria midiendo lo que dice medir.
  let base = null;
  try {
    base = await evaluarModulo(cargarModulo(depsSrc, doble));
  } catch (e) {
    base = { lanzo: e };
  }
  const baseOk = !!base && !base.lanzo && base.rCon === true && base.rSin === false &&
    base.rNulo === false && base.rVacio === false;
  chk('el modulo sin mutar distingue un Python con deps de uno que no', baseOk,
    base && base.lanzo ? ('lanzo: ' + base.lanzo.message)
      : ('con-deps=' + base.rCon + ' sin-deps=' + base.rSin));

  for (const m of MUT) {
    const nombre = m[0];
    const res = m[1](depsSrc);
    if (!res.ok || res.src === depsSrc) {
      chk('MUTANTE detectado: ' + nombre, false,
        res.motivo || 'la mutacion no cambio el codigo (patron desfasado)');
      continue;
    }
    let fallo = false;
    let detalle = '';
    try {
      const mm = cargarModulo(res.src, doble);
      const r = await evaluarModulo(mm);
      // El mutante tiene que romper AL MENOS un caso de referencia.
      if (!(r.rCon === true && r.rSin === false && r.rNulo === false && r.rVacio === false)) {
        fallo = true;
      }
      detalle = 'con-deps=' + r.rCon + ' sin-deps=' + r.rSin;
      // Y, si esta el Python embebido de verdad, tambien tiene que fallar alli.
      if (hayEmbed) {
        const r3 = await mm.pythonTieneDependencias(EMBED);
        if (r3 !== true) fallo = true;
      }
    } catch (e) {
      fallo = true;
      detalle = 'lanzo: ' + (e && e.message);
    }
    chk('MUTANTE detectado: ' + nombre, fallo && baseOk, detalle);
  }

  // ───────────────────────── mutaciones de main.js
  const mutMain = mainSrc.replace('if (!(await pythonTieneDependencias(p))) {', 'if (false) {');
  chk('MUTANTE detectado: main.js deja de validar las dependencias',
    mutMain !== mainSrc && guardsMain(mutMain).some(function (g) { return !g.ok; })
    && !guardsMain(mainSrc).some(function (g) { return !g.ok; }));

  const mutOverall = mainSrc.replace('    && result.python.hasDependencies !== false;', ';');
  chk('MUTANTE detectado: el arranque cuenta un Python sin deps como disponible',
    mutOverall !== mainSrc && guardsMain(mutOverall).some(function (g) { return !g.ok; })
    && !guardsMain(mainSrc).some(function (g) { return !g.ok; }));

  correr();
})();
