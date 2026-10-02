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
    const m = /(\d+)\/(\d+) OK/.exec(out);
    const ms = Date.now() - ini;
    if (m && m[1] !== m[2]) {
      resumen.push({ t, r: m[1] + '/' + m[2], ok: false, ms });
      console.log(etiqueta + '  ' + m[1] + '/' + m[2] + '  <-- PARCIAL (' + ms + 'ms)');
    } else {
      resumen.push({ t, r: m ? m[1] + '/' + m[2] : 'sin resumen', ok: true, ms });
      console.log(etiqueta + '  ' + (m ? m[1] + '/' + m[2] : 'ok') + '  (' + ms + 'ms)');
    }
  } catch (e) {
    const ms = Date.now() - ini;
    const out = String(e.stdout || '');
    const m = /(\d+)\/(\d+) OK/.exec(out);
    const fallas = out.split('\n').filter(l => l.indexOf('FAIL') === 0).slice(0, 2);
    resumen.push({ t, r: m ? m[1] + '/' + m[2] : 'ERROR', ok: false, ms, fallas });
    console.log(etiqueta + '  ' + (m ? m[1] + '/' + m[2] : 'ERROR') + '  <-- FALLA (' + ms + 'ms)');
    fallas.forEach(f => console.log('        ' + f.replace(/^FAIL\s+/, '').slice(0, 70)));
  }
}

const malos = resumen.filter(x => !x.ok);
console.log('\n=======================================');
console.log('  TOTAL: ' + resumen.length + ' tests, ' + (resumen.length - malos.length) + ' en verde, ' + malos.length + ' con fallos');
console.log('=======================================');
if (malos.length) {
  console.log('\nCon fallos:');
  malos.forEach(m => console.log('  - ' + m.t + '  [' + m.r + ']'));
}
