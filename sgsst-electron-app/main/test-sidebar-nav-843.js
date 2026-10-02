'use strict';
// 📦843 · El sidebar tiene que servir para navegar, estés donde estés.
//
// El bug eran DOS candados silenciosos: el clic del sidebar hacia otro módulo
// se descartaba con un console.log y un return, y showModuleContent tenía un
// candado "SOLUCIÓN TEMPORAL" que lo bloqueaba igual. Lo que faltaba no era
// permiso sino la TEARDOWN.
//
// Este test mezcla las dos cosas que hacen falta para no tener un guard
// decorado:
//   · FUNCIONAL: _salirDeSubmodulo se ejecuta de verdad en un vm, con un
//     componente de mentira, y se comprueba que destruye y limpia. including
//     el caso en que destroy() revienta, que es el que distingue la salida
//     buena de la que no lo era.
//   · ESTRUCTURAL: el orden de las llamadas y que la red de seguridad siga
//     puesta. Si alguien invierte el orden del sidebar, el candado de
//     showModuleContent vuelve a tragarse la navegación y el test lo nota.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..');
const RENDERER = path.join(APP, 'renderer.js');
const src = fs.readFileSync(RENDERER, 'utf8');

const checks = [];
const ok = (n, c, e) => checks.push({ name: n, ok: !!c, extra: e });

// ── Recorte por llaves (mismo metodo que usan los otros tests) ──
function recorte(t, marcador) {
  const i = t.indexOf(marcador);
  if (i < 0) return null;
  let n = 0, fin = -1, ab = false;
  for (let k = t.indexOf('{', i); k < t.length; k++) {
    if (t[k] === '{') { n++; ab = true; }
    else if (t[k] === '}') { n--; if (ab && n === 0) { fin = k; break; } }
  }
  return ab ? t.slice(i, fin + 1) : null;
}

const teardown = recorte(src, 'function _salirDeSubmodulo(');
if (!teardown) {
  console.error('no se encontro _salirDeSubmodulo()');
  process.exit(1);
}

// ══ 1) FUNCIONAL · ejecutar la teardown de verdad ══
function correr(estadoInicial) {
  const avisos = [];
  const c = {
    console: {
      log: function (m) { avisos.push('log:' + m); },
      warn: function (m) { avisos.push('warn:' + m); },
      info: function () { }
    },
    estado: estadoInicial
  };
  c.globalThis = c;
  vm.createContext(c);
  // El estado vive en el ambito del vm como variables sueltas.
  const pre = Object.keys(estadoInicial)
    .map(k => 'var ' + k + ' = __estado.' + k + ';')
    .join('\n');
  const post = Object.keys(estadoInicial)
    .map(k => 'out.' + k + ' = ' + k + ';')
    .join('\n');
  vm.runInContext(
    'var __estado = __init;\n' + pre + '\nvar out = {};\n'
    + teardown + '\n'
    + '__estado.__fn();\n'
    + post,
    Object.assign(c, {})
  );
  return { out: c.out, avisos: avisos };
}

function montar(fn) {
  const c = { console: { log: function () { }, warn: function () { }, info: function () { } } };
  c.globalThis = c;
  vm.createContext(c);
  const cuerpo = recorte(src, 'function _salirDeSubmodulo(');
  vm.runInContext(
    'var currentActiveComponent = null;\nvar currentSubmodule = null;\n'
    + cuerpo + '\n'
    + '__escena();\n'
    + '__res = { comp: currentActiveComponent, sub: currentSubmodule, _avisos: __avisos };',
    c
  );
  return c;
}

// a) hay componente con destroy(): se destruye y se limpian los dos estados
{
  let destruido = 0;
  const avisos = [];
  const c = {
    console: { log: m => avisos.push(m), warn: m => avisos.push('WARN ' + m), info: () => { } }
  };
  c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(
    'var currentActiveComponent = { destroy: function () { __destruidos++; } };\n'
    + 'var currentSubmodule = "3.2.1 Capacitaciones";\n'
    + 'var __destruidos = 0;\n'
    + recorte(src, 'function _salirDeSubmodulo(') + '\n'
    + '_salirDeSubmodulo("prueba");\n'
    + '__r = { n: __destruidos, comp: currentActiveComponent, sub: currentSubmodule };',
    c
  );
  const r = c.__r;
  ok('1) destruye el componente activo del submódulo', r.n === 1, 'destroy() llamado ' + r.n + ' vez');
  ok('1) y suelta la referencia al componente', r.comp === null, 'comp=' + JSON.stringify(r.comp));
  ok('1) y limpia currentSubmodule (si no, el candado de showModuleContent lo traga)', r.sub === null, 'sub=' + JSON.stringify(r.sub));
}

// b) destroy() revienta: NO puede dejar trancada la navegacion
{
  const c = { console: { log: () => { }, warn: () => { }, info: () => { } } };
  c.globalThis = c;
  vm.createContext(c);
  let exploto = false;
  try {
    vm.runInContext(
      'var currentActiveComponent = { destroy: function () { throw new Error("revento"); } };\n'
      + 'var currentSubmodule = "2.9.1";\n'
      + recorte(src, 'function _salirDeSubmodulo(') + '\n'
      + '_salirDeSubmodulo("prueba");\n'
      + '__r = { comp: currentActiveComponent, sub: currentSubmodule };',
      c
    );
  } catch (e) { exploto = true; }
  ok('2) un destroy() que revienta NO detiene la navegación', !exploto, exploto ? 'lanzo' : 'siguió');
  ok('2) y aun así limpia los dos estados',
    c.__r && c.__r.sub === null && c.__r.comp === null,
    c.__r ? 'sub=' + JSON.stringify(c.__r.sub) : 'sin resultado');
}

// c) sin componente activo (el caso normal al ir al Inicio)
{
  const c = { console: { log: () => { }, warn: () => { }, info: () => { } } };
  c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(
    'var currentActiveComponent = null;\nvar currentSubmodule = "3.2.1";\n'
    + recorte(src, 'function _salirDeSubmodulo(') + '\n'
    + '_salirDeSubmodulo("prueba");\n'
    + '__r = { sub: currentSubmodule };',
    c
  );
  ok('3) sin componente activo solo limpia el submódulo', c.__r.sub === null, 'sub=' + JSON.stringify(c.__r.sub));
}

// d) componente SIN destroy(): no debe reventar
{
  const c = { console: { log: () => { }, warn: () => { }, info: () => { } } };
  c.globalThis = c;
  vm.createContext(c);
  let exploto = false;
  try {
    vm.runInContext(
      'var currentActiveComponent = { sinDestroy: true };\nvar currentSubmodule = "4.1";\n'
      + recorte(src, 'function _salirDeSubmodulo(') + '\n'
      + '_salirDeSubmodulo("prueba");\n'
      + '__r = { sub: currentSubmodule };',
      c
    );
  } catch (e) { exploto = true; }
  ok('4) un componente sin destroy() no rompe nada', !exploto && c.__r.sub === null,
    exploto ? 'lanzo' : 'sub=' + JSON.stringify(c.__r && c.__r.sub));
}

// ══ 2) ESTRUCTURAL · el cableado ══
const cuerpoSidebar = recorte(src, 'function createSidebarButtons(');
ok('5) el clic del sidebar llama a la teardown',
  cuerpoSidebar && cuerpoSidebar.indexOf("_salirDeSubmodulo('sidebar") !== -1);

// ESTE es el orden que importa: si showModuleContent se llamara antes de
// limpiar, el candado "SOLUCIÓN TEMPORAL" volvería a tragarse la navegacion
// y el sidebar quedaria igual de mudo, solo que con menos codigo.
ok('6) la teardown va ANTES de showModuleContent (si no, el candado la traga)',
  cuerpoSidebar
  && cuerpoSidebar.indexOf('_salirDeSubmodulo') < cuerpoSidebar.indexOf('showModuleContent(item.name)'),
  cuerpoSidebar ? 'teardown en ' + cuerpoSidebar.indexOf('_salirDeSubmodulo')
    + ' y showModuleContent en ' + cuerpoSidebar.indexOf('showModuleContent(item.name)') : '?');

ok('7) ya no se descarta el clic en silencio',
  cuerpoSidebar && !/Ignorando click/.test(cuerpoSidebar));

// Las dos salidas de "Volver" usaran la teardown. La normal es la que estaba
// incompleta: limpiaba el estado pero nunca destruia el componente.
// OJO: la firma es `function showSubmoduleContent(container, moduleName,
// submoduleName)`, sin async. Buscarla con "async ..." devolvia null y hacia
// fallar los checks sin que hubiera nada que arreglar.
const cuerpoSub = recorte(src, 'function showSubmoduleContent(');
ok('8) el botón Volver normal ahora destruye el componente',
  cuerpoSub && /const backToModuleCallback = \(\) => \{[^}]*_salirDeSubmodulo/.test(cuerpoSub),
  cuerpoSub && !/backToModuleCallback = \(\) => \{\s*currentSubmodule = null/.test(cuerpoSub) ? 'ok' : 'sigue incompleta');
ok('9) y la variante "safe" usa la misma teardown (ya no hay dos caminos)',
  cuerpoSub && /const safeBackToModuleCallback = \(\) => \{[^}]*_salirDeSubmodulo/.test(cuerpoSub));

// La red de seguridad se queda: el sidebar ya limpia el estado, asi que el
// candado nunca se dispara desde ahi, pero protege a los iframes y a las
// tareas del dashboard.
const cuerpoMod = recorte(src, 'function showModuleContent(moduleName) {');
ok('10) el candado de showModuleContent sigue puesto (red de seguridad)',
  cuerpoMod && /SOLUCIÓN TEMPORAL/.test(cuerpoMod) && /if \(currentSubmodule\)/.test(cuerpoMod));
ok('11) y ese candado sigue SINCERAMENTE despues del cerrojo de llamadas duplicadas',
  cuerpoMod && cuerpoMod.indexOf('_showModuleContentLock')
  < cuerpoMod.indexOf('if (currentSubmodule)'));

// ══ Resumen ══
let failed = 0;
console.log('\n=======================================');
console.log('  📦843 · El sidebar navega desde cualquier submódulo');
console.log('=======================================');
checks.forEach(ch => {
  if (!ch.ok) failed++;
  console.log((ch.ok ? 'OK  ' : 'FAIL') + '  ' + ch.name + (ch.extra ? '  [' + ch.extra + ']' : ''));
});
console.log('---');
console.log((checks.length - failed) + '/' + checks.length + ' OK');
console.log('=======================================');
process.exit(failed === 0 ? 0 : 1);
