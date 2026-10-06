'use strict';
/* ═══════════════════════════════════════════════════════════════════
   test-kair-motion.js (📦836) — Anime.js v4.5.0 + wrapper KairMotion
   Fase estática: vendor, enganches en index.html, API del wrapper,
   guardas (reduced / sin lib / tween por array) y el hook del
   dashboard en renderer.js (incluido su EOL CRLF, gotcha 📦761).
   Fase funcional (jsdom): ejecuta vendor + wrapper de verdad y
   verifica que NADA quede oculto ni en0 tras las animaciones.
   ═══════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const checks = [];
function ok(n, c) { checks.push({ name: n, ok: !!c }); }

const root = path.join(__dirname, '..');
const vendorPath = path.join(root, 'vendor', 'anime.umd.min.js');
const kmPath = path.join(root, 'assets', 'js', 'kair-motion.js');
const idxPath = path.join(root, 'index.html');
const rndPath = path.join(root, 'renderer.js');

const vendorSrc = fs.existsSync(vendorPath) ? fs.readFileSync(vendorPath, 'utf8') : '';
const kmSrc = fs.existsSync(kmPath) ? fs.readFileSync(kmPath, 'utf8') : '';
const idxSrc = fs.readFileSync(idxPath, 'utf8');
const rndSrc = fs.readFileSync(rndPath, 'utf8');

// ── 1. Vendor ──────────────────────────────────────────────────────
ok('vendor: existe vendor/anime.umd.min.js', fs.existsSync(vendorPath));
ok('vendor: pesa > 100 KB', vendorSrc.length > 100000);
ok('vendor: es Anime.js v4.5.0', /@version v4\.5\.0/.test(vendorSrc));
ok('vendor: licencia MIT', /MIT/.test(vendorSrc));
ok('vendor: UMD publica el global anime', /\.anime=\{\}/.test(vendorSrc));
ok('vendor: expone animate + stagger + cubicBezier',
  /t\.animate=/.test(vendorSrc) && /t\.stagger=/.test(vendorSrc) && /t\.cubicBezier=/.test(vendorSrc));

// ── 2. Enganches en index.html (orden: anime → kair-motion → renderer) ──
const lineAnime = idxSrc.indexOf('<script src="vendor/anime.umd.min.js?v=4.5.0">');
const lineKm = idxSrc.indexOf('<script src="assets/js/kair-motion.js?v=');
const lineRnd = idxSrc.indexOf('<script src="renderer.js?v=');
ok('index.html: tag del vendor con cache-bust ?v=4.5.0', lineAnime >= 0);
ok('index.html: tag de kair-motion.js con cache-bust', lineKm >= 0);
ok('index.html: tag de renderer.js con cache-bust', lineRnd >= 0);
ok('index.html: orden anime → kair-motion → renderer.js',
  lineAnime >= 0 && lineKm > lineAnime && lineRnd > lineKm);
// El token NO se fija a una fecha: se bumpea en cada cambio y una guarda con
// la fecha literal se rompe sola la proxima vez que se bumpee (pasó con 📦840).
// Lo que importa es que el tag traiga un token de cache-bust bien formado.
const mToken = /renderer\.js\?v=(\d{8}-[a-z0-9-]+)/.exec(idxSrc);
ok('index.html: renderer.js con token de cache-bust con formato de fecha',
  !!mToken,
  mToken ? 'token=' + mToken[1] : 'no se encontro ?v=AAAA-MM-DD');

// ── 3. Wrapper kair-motion.js ──────────────────────────────────────
ok('wrapper: existe assets/js/kair-motion.js', fs.existsSync(kmPath));
ok('wrapper: exporta window.KairMotion', /window\.KairMotion\s*=\s*KairMotion/.test(kmSrc));
['available', 'reduced', 'staggerIn', 'countTo', 'dashboard'].forEach(function (fn) {
  ok('wrapper: API ' + fn + '()', new RegExp('function\\s+' + fn + '\\s*\\(').test(kmSrc));
});
ok('wrapper: guarda prefers-reduced-motion', /prefers-reduced-motion/.test(kmSrc));
ok('wrapper: easing cubicBezier(0.23, 1, 0.32, 1)', /cubicBezier\(0\.23,\s*1,\s*0\.32,\s*1\)/.test(kmSrc));
ok('wrapper: usa anime.stagger para el escalonado', /\.stagger\(/.test(kmSrc));
ok('wrapper: tween por ARRAY [desde, hasta] (la forma {from,to} revienta)', /opacity:\s*\[\s*0,\s*1\s*\]/.test(kmSrc));
ok('wrapper: red de seguridad limpia el opacity en línea', /style\.opacity\s*=\s*''/.test(kmSrc));
ok('wrapper: var solamente (sin let/const, convencion del repo)', !/\b(let|const)\s+[A-Za-z_$]/.test(kmSrc));
ok('wrapper: sintaxis valida (node --check / new Function)', (function () {
  try { new Function(kmSrc); return true; } catch (e) { return false; }
})());

// ── 4. Hook en renderer.js ─────────────────────────────────────────
// 📦829-fix · El ancla se acota a loadDashboardData(). Antes buscaba la llamada
// con sus argumentos LITERALES ('updateFilterUI(null, (data.tasks || []).length)')
// y se rompía con cualquier cambio de firma, aunque el orden se conservara.
// Lo que importa es que el hook corra DESPUÉS de repintar, no qué recibe.
const hookIdx = rndSrc.indexOf('window.KairMotion.dashboard(data)');
const inicioLoad = rndSrc.indexOf('async function loadDashboardData()');
const filterIdx = inicioLoad >= 0 ? rndSrc.indexOf('updateFilterUI(', inicioLoad) : -1;
ok('renderer.js: hook KairMotion.dashboard(data) presente', hookIdx >= 0);
ok('renderer.js: hook con guarda typeof window.KairMotion',
  /typeof window\.KairMotion !== 'undefined'/.test(rndSrc));
ok('renderer.js: hook despues de updateFilterUI (tras repintar)',
  hookIdx > filterIdx && filterIdx > inicioLoad && inicioLoad >= 0,
  'load@' + inicioLoad + ' filtro@' + filterIdx + ' hook@' + hookIdx);
ok('renderer.js: sintaxis valida', (function () {
  try { new Function(rndSrc); return true; } catch (e) { return false; }
})());
// Gotcha 📦761: EOL uniforme (todo CRLF, ni un LF suelto)
const crlf = (rndSrc.match(/\r\n/g)) || [];
const lfTotal = (rndSrc.match(/\n/g)) || [];
ok('renderer.js: EOL uniforme CRLF (0 LF sueltos, gotcha 📦761)', lfTotal.length - crlf.length === 0);

// ── 5. Fase funcional con jsdom ────────────────────────────────────
function dormir(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function funcional() {
  var JSDOM;
  try { JSDOM = require('jsdom').JSDOM; }
  catch (e) { ok('jsdom disponible para la fase funcional', false); return; }

  const dom = new JSDOM(
    '<!doctype html><html><body>' +
    '<div id="kpi-slot">' +
    '<article class="kair-kpi"><div class="kair-kpi__value">87<small>%</small></div></article>' +
    '<article class="kair-kpi"><div class="kair-kpi__value">12<small></small></div></article>' +
    '<article class="kair-kpi"><div class="kair-kpi__value">7<small></small></div></article>' +
    '<article class="kair-kpi"><div class="kair-kpi__value">64<small>%</small></div></article>' +
    '</div>' +
    '<div id="mod-grid"><button class="kair-mod">a</button><button class="kair-mod">b</button></div>' +
    '<div id="tasks-container"><button class="kair-task">t</button></div>' +
    '</body></html>',
    { pretendToBeVisual: true, url: 'https://kair.local/index.html', runScripts: 'outside-only' }
  );
  const w = dom.window;
  w.matchMedia = function (q) { return { matches: false }; };
  w.eval(vendorSrc);
  w.eval(kmSrc);
  const KM = w.KairMotion;

  ok('funcional: KairMotion cargado y disponible()', KM && typeof KM === 'object' && KM.available() === true);
  ok('funcional: dashboard() devuelve true', KM.dashboard({ kpis: { accidents_year: 3, pric_active: 0, overdue_docs: 7, compliance: 64 } }) === true);

  await dormir(900);
  const kpis = w.document.querySelectorAll('.kair-kpi');
  const mods = w.document.querySelectorAll('.kair-mod');
  const task = w.document.querySelector('.kair-task');
  ok('funcional: KPIs terminan visibles (opacity 1, sin0)', kpis[0].style.opacity === '1' && kpis[3].style.opacity === '1');
  ok('funcional: modulos y tareas terminan visibles', mods[0].style.opacity === '1' && task.style.opacity === '1');
  const v0 = w.document.querySelectorAll('.kair-kpi__value')[0];
  const v3 = w.document.querySelectorAll('.kair-kpi__value')[3];
  ok('funcional: contador pinta el valor final en el 1er nodo de texto', v0.firstChild.nodeValue === '3' && v3.firstChild.nodeValue === '64');
  ok('funcional: contador conserva el <small> del sufijo', !!v0.querySelector('small') && v0.querySelector('small').textContent === '%');

  // prefers-reduced-motion: fade sin translate/scale
  w.matchMedia = function (q) { return { matches: /reduce/.test(q) }; };
  ok('funcional: reduced() detecta prefers-reduced-motion', KM.reduced() === true);
  const box = w.document.createElement('div');
  box.className = 'reduced-fresh';
  w.document.body.appendChild(box);
  ok('funcional: staggerIn en modo reduced se dispara', KM.staggerIn('.reduced-fresh') === true);
  await dormir(400);
  ok('funcional: reduced deja opacity 1 y SIN transform', box.style.opacity === '1' && box.style.transform === '');

  // Sin la libreria: no-op total, nada oculto
  const animeReal = w.anime;
  w.anime = undefined;
  ok('funcional: sin anime.available() es false', KM.available() === false);
  ok('funcional: sin anime.staggerIn() no hace nada (false)', KM.staggerIn('#tasks-container .kair-task') === false);
  ok('funcional: sin anime la tarea sigue intacta', task.style.opacity === '1');
  w.anime = animeReal;

  // Si la libreria falla al animar, jamas queda opacity parcial
  const animateReal = w.anime.animate;
  w.anime.animate = function () { throw new Error('boom'); };
  const kpi0 = w.document.querySelector('.kair-kpi');
  kpi0.style.opacity = '0.5';
  ok('funcional: animate() roto → staggerIn() devuelve false', KM.staggerIn('#kpi-slot .kair-kpi') === false);
  ok('funcional: animate() roto → el estilo oculto se limpia', kpi0.style.opacity === '');
  w.anime.animate = animateReal;
}

// ── Reporte ────────────────────────────────────────────────────────
funcional().then(function () {
  var f = 0;
  checks.forEach(function (c) {
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name);
    if (!c.ok) f++;
  });
  console.log((checks.length - f) + '/' + checks.length + ' OK');
  process.exit(f === 0 ? 0 : 1);
}).catch(function (e) {
  console.error('ERROR:', e);
  process.exit(1);
});
