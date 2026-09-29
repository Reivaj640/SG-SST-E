/* ============================================================
 * K+AIR · Test — Evaluación Inicial: choque con Bootstrap (📦761)
 * ============================================================
 * POR QUÉ EXISTE ESTE TEST
 * El submódulo quedó visualmente roto en la app y en el entorno de pruebas se veía
 * perfecto. Causa: la app carga **Bootstrap 5.3 desde internet** y Bootstrap define
 * `.modal { position: fixed; top: 0; left: 0; width: 100%; height: 100% }`.
 * Su `.modal` (prioridad 0,1,0) pierde contra mi `.ev-scope .modal` (0,2,0) en las
 * propiedades que YO declaraba — pero en las que NO declaraba, las de Bootstrap se
 * filtraban: el modal quedaba anclado arriba a la izquierda y estirado a todo el
 * alto de la ventana, y el velo oscuro no cubría la pantalla.
 *
 * Este test monta el módulo con las DOS hojas cargadas (Bootstrap primero, como en
 * `index.html`) y **mide la geometría de verdad** en una ventana de Electron.
 *
 * Correr:
 *   npx electron main/test-evaluacion-inicial-bootstrap.js
 * Si falta la copia local de Bootstrap:
 *   npx electron main/_bajar-bootstrap.js     (una sola vez)
 * ============================================================ */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { app, BrowserWindow } = require('electron');

const ROOT = path.join(__dirname, '..');
const MOD = path.join(ROOT, 'modules', 'gestion-integral', 'evaluacion-inicial-sg-sst');
const BOOTSTRAP = path.join(__dirname, '_bootstrap-5.3.0.min.css');

const checks = [];
function check(name, ok, extra) { checks.push({ name: name, ok: !!ok, extra: extra }); }

const css = fs.readFileSync(path.join(MOD, 'evaluacion-inicial-view.css'), 'utf8');
const js = fs.readFileSync(path.join(MOD, 'evaluacion-inicial-view.js'), 'utf8');
const appHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/** Posición del <link> REAL (no la mención en un comentario). */
function posLink(html, fragmento) {
  const re = new RegExp('<link[^>]+href=["\'][^"\']*' + fragmento.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^"\']*["\']', 'i');
  const m = re.exec(html);
  return m ? m.index : -1;
}

// ── 1. Controles que NO necesitan ventana ────────────────────────────────────
check('La app carga Bootstrap 5 desde internet (es la causa del problema)',
  /bootstrap@5[^"']*\/css\/bootstrap\.min\.css/.test(appHtml));
check('Bootstrap viene ANTES que la hoja del módulo en index.html',
  posLink(appHtml, 'bootstrap@5.3.0/dist/css/bootstrap.min.css') > -1 &&
  posLink(appHtml, 'bootstrap@5.3.0/dist/css/bootstrap.min.css') < posLink(appHtml, 'evaluacion-inicial-view.css'),
  'bootstrap=' + posLink(appHtml, 'bootstrap@5.3.0/dist/css/bootstrap.min.css') +
  ' módulo=' + posLink(appHtml, 'evaluacion-inicial-view.css'));
check('Bootstrap se carga ANTES que las hojas propias de la app (styles.css / kair-*)',
  posLink(appHtml, 'bootstrap@5.3.0/dist/css/bootstrap.min.css') < posLink(appHtml, 'styles.css?v='));
check('Existe la copia local de Bootstrap para el test', fs.existsSync(BOOTSTRAP),
  fs.existsSync(BOOTSTRAP) ? '' : 'falta: correr main/_bajar-bootstrap.js');
check('La hoja del módulo neutraliza `position` en el modal (lo que Bootstrap filtraba)',
  /\.ev-scope \.modal[\s\S]{0,400}?position:\s*relative/.test(css));
check('La hoja del módulo neutraliza `width`, `height`, `top`, `left` y `z-index` del modal',
  /\.ev-scope \.modal[\s\S]{0,600}?width:\s*100%[\s\S]{0,200}?height:\s*auto[\s\S]{0,300}?z-index:\s*auto/.test(css));
check('La hoja del módulo neutraliza `overflow` del modal (Bootstrap le pone auto)',
  /\.ev-scope \.modal[\s\S]{0,600}?overflow:\s*hidden/.test(css));
check('La hoja del módulo neutraliza las variables de Bootstrap en `.card`',
  /--bs-card-bg:\s*var\(--kair-surface\)/.test(css));
check('La hoja del módulo deja `.row` sin el sistema de rejilla de Bootstrap',
  /\.ev-scope \.row\s*\{\s*display:\s*block/.test(css));

async function correr() {
  if (!fs.existsSync(BOOTSTRAP)) {
    reportar();
    app.exit(checks.some(function (c) { return !c.ok; }) ? 1 : 0);
    return;
  }

  const pagina = '<!doctype html><html><head><meta charset="utf-8">'
    + '<link rel="stylesheet" href="' + BOOTSTRAP.replace(/\\/g, '/') + '">'
    + '<style>' + css + '</style>'
    + '<style>html,body{margin:0;height:100%}#host{height:100%;display:flex;flex-direction:column;overflow-y:auto}</style>'
    + '</head><body><div id="host"></div>'
    + '<script>'
    + 'window.electronAPI = {'
    + '  findSubmodulePath: function(){ return Promise.resolve({ success: true, path: "C:/x" }); },'
    + '  readDirectory: function(){ return Promise.resolve({ success: true, files: [] }); },'
    + '  processEvaluacionPdf: function(){ return Promise.resolve({ success: true, findings: [], metrics: { cumplimiento: 0 }, actionPlans: [] }); },'
    + '  openPath: function(){ return Promise.resolve({ success: true }); },'
    + '  evaluacionActionPlans: { listar: function(){ return Promise.resolve({ success: true, data: [] }); },'
    + '    guardar: function(){ return Promise.resolve({ success: true }); },'
    + '    eliminar: function(){ return Promise.resolve({ success: true }); } } };'
    + '</scr' + 'ipt>'
    + '<script>' + js + '</scr' + 'ipt>'
    + '<script>'
    + 'var host = document.getElementById("host");'
    + 'var inst = new window.EvaluacionInicialView(host, "Gestión Integral", "2.3.1 Evaluación inicial del SG-SST", function(){});'
    + 'Promise.resolve(inst.render()).then(function(){'
    + '  document.querySelector(".ev-scope #btn-gest-resp").click();'
    + '  window.__listo = true;'
    + '}).catch(function(e){ window.__err = String((e && e.message) || e); });'
    + '</scr' + 'ipt></body></html>';

  const archivo = path.join(os.tmpdir(), 'kair-test-eval-bootstrap.html');
  fs.writeFileSync(archivo, pagina, 'utf8');

  const win = new BrowserWindow({ width: 1440, height: 980, show: false });
  const errs = [];
  win.webContents.on('console-message', function (_e, level, message) {
    if (level >= 2 && String(message).indexOf('Security Warning') < 0) errs.push(String(message).slice(0, 200));
  });
  await win.loadFile(archivo);
  win.showInactive();
  await new Promise(function (r) { setTimeout(r, 800); });

  const med = JSON.parse(await win.webContents.executeJavaScript(`(function(){
    var o = document.getElementById('modal-resp');
    var m = o ? o.querySelector('.modal') : null;
    var c = document.querySelector('.ev-scope .card');
    var ob = o ? o.getBoundingClientRect() : null;
    var mb = m ? m.getBoundingClientRect() : null;
    var mc = m ? getComputedStyle(m) : null;
    var cc = c ? getComputedStyle(c) : null;
    return JSON.stringify({
      listo: !!window.__listo,
      error: window.__err || null,
      ventana: [window.innerWidth, window.innerHeight],
      overlay: ob ? [Math.round(ob.left), Math.round(ob.top), Math.round(ob.width), Math.round(ob.height)] : null,
      modal: mb ? [Math.round(mb.left), Math.round(mb.top), Math.round(mb.width), Math.round(mb.height)] : null,
      modalPosicion: mc ? mc.position : null,
      modalAlto: mc ? Math.round(parseFloat(mc.height)) : null,
      hayCard: !!c,
      cardBg: cc ? cc.backgroundColor : null,
      cardRadio: cc ? (cc.borderTopLeftRadius || cc.borderRadius || '') : null,
      kpis: document.querySelectorAll('.ev-scope .kpi-card').length,
      modalesEnBody: Array.prototype.filter.call(document.body.children, function(n){ return n.id && n.id.indexOf('modal-') === 0; }).length
    });
  })()`));

  const vw = med.ventana[0], vh = med.ventana[1];

  check('El módulo arranca con Bootstrap cargado, sin errores', med.listo && !med.error, med.error || '');
  check('Los modales se mueven al <body> (fuera del contenedor)', med.modalesEnBody >= 6, 'encontrados: ' + med.modalesEnBody);
  check('El módulo dibuja sus 3 tarjetas de indicadores', med.kpis === 3, 'encontradas: ' + med.kpis);

  check('El velo oscuro cubre la ventana completa (con Bootstrap cargado)',
    med.overlay && med.overlay[0] === 0 && med.overlay[1] === 0 &&
    Math.abs(med.overlay[2] - vw) <= 1 && Math.abs(med.overlay[3] - vh) <= 1,
    JSON.stringify(med.overlay) + ' vs ventana ' + vw + 'x' + vh);

  check('El modal NO queda `position: fixed` (lo que imponía Bootstrap)',
    med.modalPosicion && med.modalPosicion !== 'fixed', 'position: ' + med.modalPosicion);
  check('El modal NO se estira a todo el alto de la ventana',
    med.modalAlto != null && med.modalAlto < vh * 0.7,
    'alto ' + med.modalAlto + ' de ' + vh);
  check('El modal conserva su alto propio (el del prototipo, ~285px)',
    med.modalAlto != null && med.modalAlto > 240 && med.modalAlto < 340, 'alto: ' + med.modalAlto);
  check('El modal queda centrado horizontalmente',
    med.modal && Math.abs((med.modal[0] + med.modal[2] / 2) - vw / 2) <= 4,
    JSON.stringify(med.modal));
  check('El modal queda centrado verticalmente',
    med.modal && Math.abs((med.modal[1] + med.modal[3] / 2) - vh / 2) <= 6,
    JSON.stringify(med.modal));
  check('El modal respeta su ancho máximo de 420px', med.modal && med.modal[2] === 420,
    'ancho: ' + (med.modal ? med.modal[2] : null));

  check('Las tarjetas NO heredan el fondo de Bootstrap',
    med.cardBg === 'rgb(255, 255, 255)', 'background: ' + med.cardBg + ' (hayTarjeta: ' + med.hayCard + ')');
  check('Las tarjetas conservan el radio premium (20px)',
    String(med.cardRadio).replace(/\s/g, '') === '20px', 'radio: ' + JSON.stringify(med.cardRadio));

  check('Sin errores en consola', errs.length === 0, JSON.stringify(errs.slice(0, 2)));

  win.destroy();
  reportar();
  app.exit(checks.some(function (c) { return !c.ok; }) ? 1 : 0);
}

function reportar() {
  let failed = 0;
  checks.forEach(function (c) {
    if (c.ok) console.log('[OK  ] ' + c.name);
    else { failed++; console.log('[FAIL] ' + c.name + (c.extra ? ' → ' + c.extra : '')); }
  });
  console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
  if (failed) console.log('❌ ' + failed + ' checks FALLARON');
  else console.log('✅ El módulo no se rompe con Bootstrap cargado');
}

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
app.whenReady().then(correr).catch(function (e) {
  console.error('ERROR ' + (e && e.stack || e));
  app.exit(1);
});
