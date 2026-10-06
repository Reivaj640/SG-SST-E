'use strict';
// 📦842 · El header principal no terminaba de ocultarse: se quedaba una
// franja de 8px.
//
// Este test MIDE, no lee texto. Un guard estatico sobre el CSS seria
// decorado: la franja no viene de una regla ausente, viene de que el padding
// del hijo sobrevive al colapso del grid, y eso solo se ve en el layout real.
//
// El runner general corre los tests con ELECTRON_RUN_AS_NODE=1 (Electron
// como Node, sin ventana). Para medir hace falta un BrowserWindow de verdad,
// asi que este test lanza Electron como SUBPROCESO sin esa variable y lee
// el resultado de un archivo. Por eso mide bien igual dentro del runner.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

const APP = path.join(__dirname, '..');
const CSS = path.join(APP, 'styles.css');
const INDEX = path.join(APP, 'index.html');
const ELECTRON = path.join(APP, 'node_modules', 'electron', 'dist', 'electron.exe');

const checks = [];
const ok = (n, c, e) => checks.push({ name: n, ok: !!c, extra: e });

// ── El codigo que se ejecuta DENTRO de Electron ──
const MEDIDOR = `
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const SALIDA = process.argv[process.argv.length - 1];
const lineas = [];
const log = s => { lineas.push(s); fs.writeFileSync(SALIDA, lineas.join('\\n'), 'utf8'); };
process.on('uncaughtException', e => { log('ERROR ' + e.message); app.exit(1); });
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 1400, height: 800, show: false });
  await w.loadFile(process.env.KAIR_HARNESS);
  await new Promise(r => setTimeout(r, 800));
  const medir = async (etiqueta, aplicar, esperar) => {
    if (aplicar) await w.webContents.executeJavaScript('(() => {' + aplicar + '})()');
    // grid-template-rows tarda 400ms: medir en el acto devuelve el valor de
    // partida y hace creer que el colapso no ocurre. (Ya se lleva un falso
    // positivo por esto.)
    if (esperar) await new Promise(r => setTimeout(r, esperar));
    const r = await w.webContents.executeJavaScript(\`(() => {
      const h = document.getElementById('app-header');
      const c = h.querySelector('.header-content');
      return {
        headerH: +h.getBoundingClientRect().height.toFixed(2),
        contentH: +c.getBoundingClientRect().height.toFixed(2),
        padTop: getComputedStyle(c).paddingTop,
        padBottom: getComputedStyle(c).paddingBottom
      };
    })()\`);
    log(etiqueta + '|' + JSON.stringify(r));
  };
  await medir('expandido', '', 0);
  await medir('hover', "document.getElementById('app-header').classList.add('app-header-hovering');", 700);
  await medir('colapsado', "var hh=document.getElementById('app-header');hh.classList.remove('app-header-hovering');hh.classList.add('app-header-collapsed');", 900);
  log('fin');
  w.destroy();
  app.exit(0);
});
`;

(async function () {
  if (!fs.existsSync(ELECTRON)) {
    console.error('no se encontro electron en ' + ELECTRON);
    process.exit(1);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-hdr-'));
  const medidor = path.join(tmp, 'medir.js');
  const salida = path.join(tmp, 'out.txt');
  const harness = path.join(tmp, 'harness.html');

  // El DOM del header es el REAL, sacado de index.html.
  const html = fs.readFileSync(INDEX, 'utf8');
  const m = /(<header id="app-header"[\s\S]*?<\/header>)/.exec(html);
  if (!m) { console.error('no se encontro <header id="app-header"> en index.html'); process.exit(1); }
  fs.writeFileSync(
    harness,
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
    '<link rel="stylesheet" href="' + CSS.replace(/\\/g, '/') + '">' +
    '<style>body{margin:0;background:#fbfcfb}#caja{width:1400px}</style></head>' +
    '<body><div id="caja"><div id="header-hover-zone"></div>' + m[1] +
    '<div style="height:400px;background:#eee">contenido</div></div></body></html>',
    'utf8'
  );
  fs.writeFileSync(medidor, MEDIDOR, 'utf8');

  const env = Object.assign({}, process.env, { KAIR_HARNESS: harness });
  delete env.ELECTRON_RUN_AS_NODE;   // sin esto no hay BrowserWindow
  const r = spawnSync(ELECTRON, [medidor, salida], { env: env, timeout: 90000, encoding: 'utf8' });

  if (!fs.existsSync(salida)) {
    console.error('Electron no produjo resultado.\n' + String(r.stderr || '').slice(0, 500));
    process.exit(1);
  }
  const filas = fs.readFileSync(salida, 'utf8').split(/\r?\n/).filter(Boolean);
  const por = {};
  filas.forEach(f => { const i = f.indexOf('|'); if (i > 0) por[f.slice(0, i)] = JSON.parse(f.slice(i + 1)); });

  ok('se pudo medir el header en los 3 estados',
    !!(por.expandido && por.hover && por.colapsado), JSON.stringify(Object.keys(por)));

  const alto = (k) => (por[k] ? por[k].headerH : -1);

  ok('1) expandido se ve completo (no lo colapsamos de entrada)', alto('expandido') > 30, 'alto=' + alto('expandido'));
  ok('2) el hover lo mantiene visible', alto('hover') > 30, 'alto=' + alto('hover'));
  ok('3) al colapsar llega EXACTAMENTE a 0px, sin franja',
    alto('colapsado') === 0, 'sobro ' + alto('colapsado') + 'px');
  ok('4) el padding del hijo se pone en 0 al colapsar',
    por.colapsado && por.colapsado.padTop === '0px' && por.colapsado.padBottom === '0px',
    por.colapsado ? por.colapsado.padTop + ' / ' + por.colapsado.padBottom : '?');

  // El guard estatico complementario: la regla tiene que existir, porque una
  // regla borrada a mano pasaria el resto del suite sin que nadie lo note.
  const css = fs.readFileSync(CSS, 'utf8');
  ok('5) la regla que anula el padding al colapsar existe',
    /#app-header\.app-header-collapsed\s+\.header-content\s*\{[^}]*padding-top:\s*0/.test(css));

  // Y que el padding baje suave: sin esto se pierde el aire de golpe en el
  // primer frame de un colapso de 400ms.
  ok('6) el padding se interpola junto con el alto (no da un salto)',
    /\.header-content\s*\{[^}]*transition:\s*padding/.test(css));

  let failed = 0;
  console.log('\n=======================================');
  console.log('  📦842 · El header se oculta del todo');
  console.log('=======================================');
  checks.forEach(ch => {
    if (!ch.ok) failed++;
    console.log((ch.ok ? 'OK  ' : 'FAIL') + '  ' + ch.name + (ch.extra ? '  [' + ch.extra + ']' : ''));
  });
  console.log('---');
  console.log('expandido=' + alto('expandido') + 'px  hover=' + alto('hover') + 'px  colapsado=' + alto('colapsado') + 'px');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  console.log('=======================================');
  process.exit(failed === 0 ? 0 : 1);
})();
