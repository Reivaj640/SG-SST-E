// probe-fa-icons-825.js — sondeo de glifos Font Awesome 6.4.0 (igual que hizo
// el test del 3.1.2 el 2026-09-29): un icono existente da ::before != none y
// width > 0; uno inexistente queda w=0 y content 'none'.
// Correr: node_modules/.bin/electron Temp/probe-fa-icons-825.js
const { app, BrowserWindow } = require('electron');

const CANDIDATOS = [
  'fa-plus', 'fa-pause', 'fa-play', 'fa-xmark', 'fa-trash-can',
  'fa-folder-open', 'fa-circle-check', 'fa-chevron-right', 'fa-chevron-left',
  'fa-circle-info', 'fa-triangle-exclamation', 'fa-chart-line', 'fa-bell',
  'fa-list-check', 'fa-gauge-high', 'fa-file-export', 'fa-gear',
  'fa-clipboard-list', 'fa-clipboard-check', 'fa-rotate-left', 'fa-pen-to-square',
  'fa-calendar-days', 'fa-syringe', 'fa-virus', 'fa-microscope', 'fa-lungs',
  'fa-stethoscope', 'fa-user-doctor', 'fa-user-group', 'fa-hammer', 'fa-arrow-left',
  'fa-heart-pulse', 'fa-compass', 'fa-flag-checkered', 'fa-bullseye', 'fa-diagram-project'
];

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 900, height: 700 });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
    '<html><head><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"></head><body></body></html>'
  ));
  await new Promise(r => setTimeout(r, 2000)); // dar tiempo a la hoja del CDN
  const result = await win.webContents.executeJavaScript('(function(){\n' +
    '  const iconos = ' + JSON.stringify(CANDIDATOS) + ';\n' +
    '  const out = {};\n' +
    '  iconos.forEach(function(ic){\n' +
    '    const el = document.createElement("i");\n' +
    '    el.className = "fas " + ic;\n' +
    '    el.style.display = "inline-block";\n' +
    '    document.body.appendChild(el);\n' +
    '    const st = getComputedStyle(el, "::before");\n' +
    '    out[ic] = { w: el.offsetWidth, content: st.content, fontFamily: st.fontFamily };\n' +
    '    el.remove();\n' +
    '  });\n' +
    '  return out;\n' +
    '})()');
  const vivos = [], muertos = [];
  CANDIDATOS.forEach(ic => {
    const r = result[ic] || {};
    if (r.w > 0 && r.content && r.content !== 'none' && String(r.fontFamily).indexOf('Font Awesome') !== -1) vivos.push(ic);
    else muertos.push(ic + ' (w=' + r.w + ', content=' + r.content + ')');
  });
  console.log('=== VIVOS (' + vivos.length + ') ===');
  console.log(vivos.join(', '));
  console.log('=== MUERTOS/INVALIDOS (' + muertos.length + ') ===');
  console.log(muertos.join('\n') || '(ninguno)');
  app.quit();
});
