'use strict';
// Correr TODOS los tests de main/ y decir cuáles fallan.
// Los functional van con Electron (ELECTRON_RUN_AS_NODE=1), no con node puro.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const APP = path.join(__dirname, '..');
const ELECTRON = path.join(APP, 'node_modules', 'electron', 'dist', 'electron.exe');
const SOLO = process.argv[2] || '';

const tests = fs.readdirSync(path.join(APP, 'main'))
  .filter(f => /^test-.*\.js$/.test(f))
  .filter(f => (SOLO ? f.indexOf(SOLO) !== -1 : true))
  .sort();

const resumen = [];

// 🔴 El runner.parseaba UN solo formato: `N/M OK`. Es el que pide PROMPT.md §7, pero no lo
// cumple ni la mitad de los tests: al menos cuatro formatos distintos conviven en main/.
// Con el parser viejo, un test que imprimía "29/29 checks OK" no casaba y caía en el
// `else` con ok:true — se contaba verde sin que nadie hubiera mirado sus 29 checks.
// Por eso el resumen va con `leerResumen` y no con una regex suelta: si no entiende el
// formato, lo dice (SIN RESUMEN) en vez de aprobarlo en silencio.
function leerResumen(out) {
  const patrones = [
    // — formatos con OK y FAIL explicitos —
    [/Total:\s*(\d+)\s*\|[^|]*✅\s*(\d+)\s*\|[^|]*❌\s*(\d+)/, m => ({ ok: +m[2], total: +m[2] + (+m[3]) })],
    [/Pasados:\s*(\d+)[\s\S]{0,40}?Fallados:\s*(\d+)/,         m => ({ ok: +m[1], total: +m[1] + (+m[2]) })],
    [/OK:\s*(\d+)\s*·\s*FAIL:\s*(\d+)/,                        m => ({ ok: +m[1], total: +m[1] + (+m[2]) })],
    [/Resultado:\s*(\d+)\s+OK,\s*(\d+)\s+FAIL/,                 m => ({ ok: +m[1], total: +m[1] + (+m[2]) })],
    [/RESULTADO:\s*(\d+)\s+OK\s*[·|]\s*(\d+)\s+FALLOS/i,       m => ({ ok: +m[1], total: +m[1] + (+m[2]) })],
    [/(\d+)\s+OK\s*[·|]\s*(\d+)\s+FAIL/,                        m => ({ ok: +m[1], total: +m[1] + (+m[2]) })],
    [/(\d+)\s+OK\s*\/\s*(\d+)\s+FAIL/,                         m => ({ ok: +m[1], total: +m[1] + (+m[2]) })],
    [/(\d+)\s+pasaron,\s*(\d+)\s+fallaron/i,                   m => ({ ok: +m[1], total: +m[1] + (+m[2]) })],
    [/pass:\s*(\d+)\s*\|\s*fail:\s*(\d+)/i,                    m => ({ ok: +m[1], total: +m[1] + (+m[2]) })],
    // — formatos de fraccion —
    [/checks:\s*(\d+)\s*\/\s*(\d+)/i,                          m => ({ ok: +m[1], total: +m[2] })],
    [/(\d+)\s*\/\s*(\d+)\s+checks?\s+OK/i,                     m => ({ ok: +m[1], total: +m[2] })],
    [/(\d+)\s*\/\s*(\d+)\s+checks\b/i,                         m => ({ ok: +m[1], total: +m[2] })],
    [/(\d+)\s*\/\s*(\d+)\s+OK\b/,                               m => ({ ok: +m[1], total: +m[2] })],
    // — TAP, la salida estandar de node:test —
    [/#\s*failed\s+(\d+)/,                                     m => ({ ok: 0, total: Math.max(1, +m[1]) })],
    [/#\s*todo\s+(\d+)/,                                       m => ({ ok: +m[1], total: +m[1] })],
    // — texto sin numeros: se cuenta 1/1 en vez de "no verificado" —
    [/TODOS LOS FIXES APLICADOS/,                              () => ({ ok: 1, total: 1 })],
    [/ALL CHECKS PASSED/,                                      () => ({ ok: 1, total: 1 })],
    [/TODOS LOS TESTS PASARON/,                                () => ({ ok: 1, total: 1 })],
    [/Todos los tests pasaron/i,                                () => ({ ok: 1, total: 1 })],
    [/^\s*✅.*\bOK\s*$/m,                                       () => ({ ok: 1, total: 1 })],
  ];
  for (const [re, map] of patrones) {
    const m = re.exec(out);
    if (m) return map(m);
  }
  return null;
}
let cont = 0;
for (const t of tests) {
  cont++;
  const etiqueta = '[' + String(cont).padStart(2, ' ') + '/' + tests.length + '] ' + t;
  const ini = Date.now();
  try {
    const out = execFileSync(ELECTRON, [path.join(APP, 'main', t)], {
      env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }),
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
      encoding: 'utf8'
    });
    const ms = Date.now() - ini;
    const r = leerResumen(out);
    if (!r) {
      // 🔴 Un test SIN resumen no es verde: el runner no sabe quantos checks corrieron.
      // No se lo cuenta como fallo tampoco, porque un fallo aqui significa "el producto
      // esta roto" y eso seria mentira. Va a su propia lista, visible, al final.
      resumen.push({ t, r: 'sin resumen', ok: true, sinResumen: true, ms });
      console.log(etiqueta + '  SIN RESUMEN  (' + ms + 'ms)');
    } else if (r.ok < r.total) {
      resumen.push({ t, r: r.ok + '/' + r.total, ok: false, ms });
      console.log(etiqueta + '  ' + r.ok + '/' + r.total + '  <-- PARCIAL (' + ms + 'ms)');
    } else {
      resumen.push({ t, r: r.ok + '/' + r.total, ok: true, ms });
      console.log(etiqueta + '  ' + r.ok + '/' + r.total + '  (' + ms + 'ms)');
    }
  } catch (e) {
    const ms = Date.now() - ini;
    const out = String(e.stdout || '');
    const r = leerResumen(out);
    const fallas = out.split('\n').filter(l => l.indexOf('FAIL') === 0).slice(0, 2);
    resumen.push({ t, r: r ? r.ok + '/' + r.total : 'ERROR', ok: false, ms, fallas });
    console.log(etiqueta + '  ' + (r ? r.ok + '/' + r.total : 'ERROR') + '  <-- FALLA (' + ms + 'ms)');
    fallas.forEach(f => console.log('        ' + f.replace(/^FAIL\s+/, '').slice(0, 70)));
  }
}

const malos = resumen.filter(x => !x.ok);
const sinResumen = resumen.filter(x => x.sinResumen);
const verificados = resumen.length - sinResumen.length;
console.log('\n=======================================');
console.log('  TOTAL: ' + resumen.length + ' tests, ' + (resumen.length - malos.length) + ' en verde, ' + malos.length + ' con fallos');
console.log('  De esos, ' + verificados + ' con resumen verificable y ' + sinResumen.length + ' SIN RESUMEN (el runner no puede confirmar quantos checks corrieron)');
console.log('=======================================');
if (malos.length) {
  console.log('\nCon fallos:');
  malos.forEach(m => console.log('  - ' + m.t + '  [' + m.r + ']'));
}
if (sinResumen.length) {
  console.log('\nSin resumen (NO cuentan como fallo: no se sabe si el producto esta roto):');
  sinResumen.forEach(m => console.log('  - ' + m.t));
}
