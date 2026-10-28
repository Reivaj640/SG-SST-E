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
function cargarModulo(src) {
  const mod = { exports: {} };
  const sandbox = {
    module: mod,
    exports: mod.exports,
    require: function (id) {
      if (id === 'child_process') return childProcess;
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
  const MUT = [
    ['siempre dice que tiene las dependencias',
      function (s) { return s.replace('    return true;\n  } catch (e) {\n    return false;', '    return true;\n  } catch (e) {\n    return true;'); }],
    ['nunca dice que tiene las dependencias',
      function (s) { return s.replace('    await _execFilePromise(pythonPath, [\'-c\', \'import \' + requeridas.join(\', \')]);\n    return true;', '    return false;'); }],
    ['lanza en vez de devolver false',
      function (s) { return s.replace('  } catch (e) {\n    return false;\n  }\n}', '  } catch (e) {\n    throw e;\n  }\n}'); }]
  ];

  for (const m of MUT) {
    const nombre = m[0];
    const mutado = m[1](depsSrc);
    if (mutado === depsSrc) {
      chk('MUTANTE detectado: ' + nombre, false, 'la mutacion no cambio el codigo (patron desfasado)');
      continue;
    }
    let fallo = false;
    try {
      const mm = cargarModulo(mutado);
      const r1 = await mm.pythonTieneDependencias(NO_PYTHON);
      const r2 = await mm.pythonTieneDependencias(RUTA_INEXISTENTE);
      const r3 = hayEmbed ? await mm.pythonTieneDependencias(EMBED) : null;
      // Lo que debe fallar:
      //  - "siempre true": el caso del NO-Python debe dar false.
      //  - "siempre false": el caso del embed debe dar true (si hay embed).
      //  - "lanza": alguno de los tres debe lanzar en vez de devolver false.
      if (r1 !== false || r2 !== false) fallo = true;
      if (hayEmbed && r3 !== true) fallo = true;
    } catch (e) {
      fallo = true;
    }
    chk('MUTANTE detectado: ' + nombre, fallo);
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
