'use strict';
// 📦841 · El desvanecido al cambiar de módulo.
//
// Lo que este test protege, en orden de importancia:
//
//  1) QUE EL CONTENIDO SIEMPRE SE CONSTRUYA. El desvanecido es adorno; si
//     algo falla, el usuario tiene que ver su módulo igual. Y si algo falla a
//     medias, NUNCA puede quedar un opacity:0 pegado (pantalla en blanco).
//  2) Que el cerrojo de showModuleContent no se quede tomado: la función no
//     puede hacer await a la animación, o el segundo clic se pierde.
//  3) Que con reduced-motion no haya espera (solo el fade de entrada, corto).
//  4) Que dos clics seguidos no dejen dos temporizadores peleando.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..');
const KM = path.join(APP, 'assets', 'js', 'kair-motion.js');
const RENDERER = path.join(APP, 'renderer.js');
const kmSrc = fs.readFileSync(KM, 'utf8');
const rnd = fs.readFileSync(RENDERER, 'utf8');

const checks = [];
const ok = (n, c, e) => checks.push({ name: n, ok: !!c, extra: e });

// ══ Extraer swapView del wrapper y correrlo de verdad ══
function recorte(t, marcador) {
  const i = t.indexOf(marcador);
  if (i < 0) return null;
  let n = 0, fin = -1, abierto = false;
  for (let k = t.indexOf('{', i); k < t.length; k++) {
    if (t[k] === '{') { n++; abierto = true; }
    else if (t[k] === '}') { n--; if (abierto && n === 0) { fin = k; break; } }
  }
  return abierto ? t.slice(i, fin + 1) : null;
}
const cuerpo = recorte(kmSrc, 'function swapView(');
if (!cuerpo) { console.error('no se encontro swapView()'); process.exit(1); }

function armar(reducido) {
  // Un "elemento" de mentira: solo se usan style, offsetHeight y dos campos
  // propios para el estado del swap. El contexto de vm no trae temporizadores
  // ni consola, así que hay que inyectarlos.
  const c = {
    console: { warn: function () { } },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  c.window = { matchMedia: function () { return { matches: reducido }; } };
  vm.createContext(c);
  vm.runInContext(
    'var KairMotion = (function(){\n' +
    '  var reduced = function () {\n' +
    '    try { return !!(window.matchMedia && window.matchMedia(\'prefers-reduced-motion: reduce\').matches); }\n' +
    '    catch (e) { return false; }\n' +
    '  };\n' +
    cuerpo + '\n' +
    '  return { reduced: reduced, swapView: swapView };\n' +
    '})();',
    c
  );
  return c;
}
function elFalso() {
  return { style: {}, offsetHeight: 0, _kairSwapTimer: 0, _kairSwapActivo: false };
}
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

(async function () {
  // ── 1) Construye siempre y limpia siempre ──
  const c1 = armar(false);
  const e1 = elFalso();
  let construido1 = 0;
  c1.KairMotion.swapView(e1, function () { construido1++; }, { out: 20, in: 20 });
  await dormir(140);
  ok('1) el contenido se construyó una vez', construido1 === 1, 'veces=' + construido1);
  ok('1) y al final no quedó opacity:0 pegado',
    e1.style.opacity === '' && e1.style.transition === '',
    'opacity=' + JSON.stringify(e1.style.opacity) + ' transition=' + JSON.stringify(e1.style.transition));

  // ── 2) Si construir() revienta, igual limpia ──
  const c2 = armar(false);
  const e2 = elFalso();
  c2.KairMotion.swapView(e2, function () { throw new Error('revento a proposito'); }, { out: 20, in: 20 });
  await dormir(140);
  ok('2) si el constructor falla, tampoco queda opacity:0',
    e2.style.opacity === '' && e2.style.transition === '',
    'opacity=' + JSON.stringify(e2.style.opacity));
  ok('2) y el temporizador se limpió (no queda uno muerto guardado)', e2._kairSwapTimer === 0,
    'timer=' + e2._kairSwapTimer);

  // ── 3) Reduced motion: construye de una, sin esperar la salida ──
  const c3 = armar(true);
  const e3 = elFalso();
  let construido3 = 0;
  const t0 = Date.now();
  c3.KairMotion.swapView(e3, function () { construido3++; }, { out: 200, in: 200 });
  const dt3 = Date.now() - t0;
  ok('3) con reduced-motion construye de inmediato', construido3 === 1 && dt3 < 50,
    'construidos=' + construido3 + ' en ' + dt3 + 'ms');
  await dormir(120);
  ok('3) y tampoco queda opacity:0 al terminar',
    e3.style.opacity === '' && e3.style.transition === '',
    'opacity=' + JSON.stringify(e3.style.opacity));

  // ── 4) Dos clics seguidos: el segundo cancela al primero ──
  const c4 = armar(false);
  const e4 = elFalso();
  const construidas = [];
  c4.KairMotion.swapView(e4, function () { construidas.push('A'); }, { out: 40, in: 20 });
  c4.KairMotion.swapView(e4, function () { construidas.push('B'); }, { out: 40, in: 20 });
  await dormir(200);
  // Se construye UNA vez y es la ultima: se reorienta, no se encola. Si se
  // construyeran las dos se veria un destello del modulo intermedio.
  ok('4) dos clics rapidos construyen solo la ultima (no hay destello del medio)',
    construidas.length === 1 && construidas[0] === 'B',
    'construidas=' + JSON.stringify(construidas));
  ok('4) y no queda nada colgado (ni opacity:0 ni temporizador vivo)',
    e4.style.opacity === '' && e4.style.transition === '' && e4._kairSwapTimer === 0,
    'opacity=' + JSON.stringify(e4.style.opacity) + ' timer=' + e4._kairSwapTimer);

  // ── 5) Los defaults son 110 / 160 (los del commit) ──
  const c5 = armar(false);
  const e5 = elFalso();
  c5.KairMotion.swapView(e5, function () { });
  ok('5) el fade de salida por defecto dura 110ms',
    /opacity ' \+ salida \+ 'ms/.test(cuerpo) && cuerpo.indexOf('? 110 :') !== -1);
  ok('5) el de entrada 160ms', cuerpo.indexOf('? 160 :') !== -1);
  const curva = /cubic-bezier\([^)]*\)/.exec(cuerpo);
  ok('5) usa una curva propia, no `ease` (el skill marca ease como débil)',
    curva !== null && curva[0].indexOf('ease') === -1, curva ? curva[0] : 'no hay curva');
  // "solo opacity": se cubre tambien el camino CSS (transform en el
  // shorthand transition), no solo los nombres de anime.js (translateY/scale).
  ok('5) y no anima nada más que opacity', !/translate|scale|rotate|transform/.test(cuerpo),
    'se animaria ' + (/(translate|transform)/.exec(cuerpo) || ['nada'])[0]);
  ok('5) usa transición CSS, no anime (movimiento predeterminado)',
    cuerpo.indexOf('anime') === -1);
  // El reflow forzado no se puede observar desde un elemento falso (no hay
  // motor de layout), pero es load-bearing: sin el, el browser agrupa el
  // opacity:0 y el opacity:1 en el mismo frame y la transicion no arranca
  // (el contenido aparece de golpe). Se comprueba de forma estatica.
  ok('5) fuerza el reflow antes del fade de entrada (si no, la transicion se salta)',
    /void\s+el\.offsetHeight/.test(cuerpo));
  await dormir(300);

  // ── 6) El cableado en renderer.js ──
  const cuerpoFn = recorte(rnd, 'function showModuleContent(moduleName) {');
  ok('6) showModuleContent construye DENTRO de _swapContenido',
    cuerpoFn && cuerpoFn.indexOf('_swapContenido(contentArea, function () {') !== -1);
  ok('6) y NO espera la animación (si hiciera await, el cerrojo quedaría tomado',
    cuerpoFn && !/\bawait\b/.test(cuerpoFn),
    cuerpoFn && /\bawait\b/.test(cuerpoFn) ? 'HAY await' : 'sin await');
  ok('6) el cerrojo se suelta en un microtask, antes del desvanecido',
    /_showModuleContentLock = true;/.test(cuerpoFn) &&
    /Promise\.resolve\(\)\.then\(\(\) => \{ _showModuleContentLock = false; \}\)/.test(cuerpoFn) &&
    cuerpoFn.indexOf('Promise.resolve().then') < cuerpoFn.indexOf('_swapContenido'));
  // Un cerrojo que nadie lee no es un cerrojo: sin esta guarda el
  // showModuleContent se puede reentrar y dos handlers de mensajes
  // solapados se pisan la pantalla.
  ok('6) y el cerrojo se LEE antes de tomarlo (si no, no bloquea nada)',
    cuerpoFn && /if \(_showModuleContentLock\)/.test(cuerpoFn) &&
    cuerpoFn.indexOf('if (_showModuleContentLock)') < cuerpoFn.indexOf('_showModuleContentLock = true;'));
  ok('6) los guards siguen antes del desvanecido (no se saltan en un clic rápido)',
    cuerpoFn && cuerpoFn.indexOf('if (currentSubmodule)') !== -1 &&
    cuerpoFn.indexOf('if (currentSubmodule)') < cuerpoFn.indexOf('_swapContenido'));

  // ── 7b) El Inicio también se desvanece, pero con guarda de carrera ──
  // showHomePage() es async: su construcción ocurre DESPUÉS de un
  // await, así que con el fade queda una ventana en la que un módulo
  // abierto por el usuario se puede pisar con un home construido tarde.
  const cuerpoHome = recorte(rnd, 'async function showHomePage(');
  ok('7b) showHomePage también construye dentro de _swapContenido',
    cuerpoHome && cuerpoHome.indexOf('_swapContenido(contentArea, function () {') !== -1);
// NO basta con que la PRIMERA aparicion este antes: si alguien mete una
// segunda línea de cromo dentro del callback, indexOf seguiria dando bien.
// Se exige ademas que no haya ninguna despues del punto de entrada.
  const _cromoTardio = cuerpoHome
    ? cuerpoHome.slice(cuerpoHome.indexOf('_swapContenido'))
    : '';
  ok('7b) y el cromo (sidebar / vanta) queda FUERA del desvanecido',
    cuerpoHome && cuerpoHome.indexOf('sidebar-hidden') < cuerpoHome.indexOf('_swapContenido') &&
    cuerpoHome.indexOf('vanta-fullscreen') < cuerpoHome.indexOf('_swapContenido') &&
    !/sidebar-hidden|vanta-fullscreen/.test(_cromoTardio));
  ok('7b) toma su token ANTES del await (si no, el token llega tarde)',
    cuerpoHome && cuerpoHome.indexOf('const _miToken = ++_showHomeToken;') !== -1 &&
    cuerpoHome.indexOf('_miToken = ++_showHomeToken') < cuerpoHome.indexOf('await window.electronAPI.loadConfig'));
  ok('7b) el callback se retira si otro Inicio o un módulo se cayeron antes',
    cuerpoHome && /if \(_miToken !== _showHomeToken\) return;/.test(cuerpoHome));
  ok('7b) y abrir un módulo invalida el home pendiente',
    /_showHomeToken\+\+/.test(cuerpoFn) &&
    cuerpoFn.indexOf('_showHomeToken++') < cuerpoFn.indexOf('_swapContenido'));
  ok('7b) el token no reintroduce await en showHomePage (el cerrojo sigue libre)',
    cuerpoFn && !/\bawait\b/.test(cuerpoFn));

  // ── 7) El helper cae a construir() si KairMotion no está ──
  ok('7) _swapContenido construye igual si el wrapper no está cargado',
    /if \(window\.KairMotion && typeof window\.KairMotion\.swapView === 'function'\)/.test(rnd) &&
    /\}\s*\n\s*construir\(\);\s*\n\s*return false;/.test(recorte(rnd, 'function _swapContenido(el, construir) {') || ''));
  ok('7) y swapView está exportado por el wrapper',
    /swapView: swapView/.test(kmSrc) && /window\.KairMotion = KairMotion/.test(kmSrc));

  let failed = 0;
  console.log('\n=======================================');
  console.log('  📦841 · El desvanecido al cambiar de módulo');
  console.log('=======================================');
  checks.forEach(ch => {
    if (!ch.ok) failed++;
    console.log((ch.ok ? 'OK  ' : 'FAIL') + '  ' + ch.name + (ch.extra ? '  [' + ch.extra + ']' : ''));
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  console.log('=======================================');
  process.exit(failed === 0 ? 0 : 1);
})();
