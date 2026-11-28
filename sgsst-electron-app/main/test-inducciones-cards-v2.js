/* ============================================================
 * K+AIR · Test — Cards KPI v2 de Inducción y Reinducción (📦1114)
 * ============================================================
 *
 * QUÉ PROTEGE ESTE ARCHIVO
 * ------------------------
 * El rediseño de las 4 cards de indicadores del dashboard de Inducción y
 * Reinducción: la EXTERNA lleva el tono suave, la INTERNA (blanca) lleva el
 * diseño (rótulo, valor + chip, bajada y curva) y el pie "Ver detalle" vive
 * en la externa, abajo. El HERO NO SE TOCA.
 *
 * El test NO mira texto: recorta la lógica real del módulo y la EJECUTA en
 * un `vm` con un DOM mínimo, y juzga el SVG que produce de verdad.
 *
 * Correr con: node main/test-inducciones-cards-v2.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const modDir = path.join(root, 'modules', 'recursos', 'inducciones');
const html = fs.readFileSync(path.join(modDir, 'inducciones-view.html'), 'utf8');
const css = fs.readFileSync(path.join(modDir, 'inducciones-view.css'), 'utf8');
const js = fs.readFileSync(path.join(modDir, 'inducciones-logic.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const checks = [];
function ok(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra || '' });
}

// ── DOM mínimo ───────────────────────────────────────────────────────────
function fakeEl(tag) {
  return {
    tagName: tag || 'div', className: '', innerHTML: '', textContent: '', style: {},
    _attrs: {},
    setAttribute: function (k, v) { this._attrs[k] = v; },
    getAttribute: function (k) { return this._attrs[k]; },
    appendChild: function (c) { return c; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
  };
}

function cargarComponente() {
  const doc = {
    createElement: fakeEl,
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    addEventListener: function () {}
  };
  const sandbox = {
    document: doc, console: { log: function () {}, warn: function () {}, error: function () {} },
    Math: Math, Number: Number, String: String, Object: Object, Array: Array, JSON: JSON,
    Date: Date, Intl: Intl, isFinite: isFinite, parseInt: parseInt, parseFloat: parseFloat,
    setTimeout: setTimeout, clearTimeout: clearTimeout
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(js, sandbox, { filename: 'inducciones-logic.js' });
  return sandbox.window.InduccionesComponent;
}

// Las 12 curvas: la geometria del modulo (viewBox 200x34, PADY 5)
function yEsperado(v, max) { return 29 - (v / max) * 24; }
function yDeLaCurva(d) {
  // La curva suave dibuja cada Q desde el punto real (su control) hacia el
  // punto MEDIO entre dos datos: los puntos reales son los controles, no
  // los medios. El ultimo es el punto final del ultimo Q.
  const n = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const nQs = (n.length - 2) / 4;
  const ys = [n[1]];
  for (let k = 0; k < nQs - 1; k++) ys.push(n[3 + 4 * k]);
  ys.push(n[n.length - 1]);
  return ys;
}
function dDeLaCurva(svg) {
  const m = svg.match(/<path class="kair-spark__line" d="([^"]+)"/);
  return m ? m[1] : '';
}

// ══ 1 · El HERO no se toca ═══════════════════════════════════════════════
const iHero = html.indexOf('kair-hero--strip');
const iKpis = html.indexOf('<!-- KPIs');
const hero = iHero >= 0 && iKpis > iHero ? html.slice(iHero, iKpis) : '';
ok('1) el bloque del hero existe y esta antes de las cards',
  iHero >= 0 && iKpis > iHero, 'hero=' + hero.length + ' chars');
ok('2) el hero NO gana la card nueva (ni interna, ni pie, ni curva)',
  !/kair-kpi__inner|kair-kpi__foot|kair-spark/.test(hero));

const bloqueCss = css.slice(css.indexOf('9. KPI CARDS'), css.indexOf('10. TARJETAS'));
ok('3) el CSS del piloto NO toca el hero',
  bloqueCss.length > 0 && !/kair-hero/.test(bloqueCss));

// ══ 2 · La anatomía nueva ═══════════════════════════════════════════════
ok('4) las 4 cards tienen la card interna',
  (html.match(/class="kair-kpi__inner"/g) || []).length === 4);
ok('5) las 4 cards tienen la fila de valor + chip',
  (html.match(/class="kair-kpi__value-row"/g) || []).length === 4);
ok('6) las 4 cards tienen su curva',
  (html.match(/class="kair-kpi__spark"/g) || []).length === 4);
ok('7) las 4 cards tienen el pie con la flecha',
  (html.match(/class="kair-kpi__foot"/g) || []).length === 4 &&
  (html.match(/kair-kpi__foot__arrow/g) || []).length === 4 &&
  (html.match(/&rarr;/g) || []).length === 4);

// El pie tiene que quedar FUERA de la interna: la interna se cierra antes.
const iInner = html.indexOf('kair-kpi__inner');
const iCierre = html.indexOf('</div>', html.indexOf('kair-kpi__spark'));
const iPie = html.indexOf('kair-kpi__foot');
ok('8) el pie vive en la EXTERNA (después de que se cierre la interna)',
  iInner >= 0 && iCierre > iInner && iPie > iCierre);
ok('9) la barra de progreso se fue (su % ya estaba en el chip)',
  html.indexOf('kair-kpi__bar') === -1 && html.indexOf('kair-kpi__fill') === -1 &&
  css.indexOf('kair-kpi__bar') === -1 && css.indexOf('kair-kpi__fill') === -1);
ok('10) los chips siguen (el % no se perdio al salir la barra)',
  ['kpi-total-chip', 'kpi-apr-chip', 'kpi-rep-chip', 'kpi-prom-chip']
    .every(function (id) { return html.indexOf('id="' + id + '"') >= 0; }));

// ══ 3 · La curva sale del dato real ═════════════════════════════════════
const Comp = cargarComponente();
const inst = Object.create(Comp.prototype);
const els = {};
inst.q = function (sel) { if (!els[sel]) els[sel] = fakeEl(); return els[sel]; };
inst._st = { filters: { anio: '2026' } };

const MESES = [];
for (let i = 0; i < 12; i++) MESES.push({ i: i, real: i + 1, apr: 1, prom: 20 });
const m = {
  total: 78, apr: 12, rep: 66, rate: 15.4, avg: 19.4, min: 12, max: 22, meses: MESES
};
inst.renderKpis(m);

function curvaDe(sel) { return els[sel] ? els[sel].innerHTML : ''; }
const cTotal = curvaDe('#kpi-total-spark');
const cApr = curvaDe('#kpi-apr-spark');
const cRep = curvaDe('#kpi-rep-spark');
const cProm = curvaDe('#kpi-prom-spark');

ok('11) la curva de Total sale de la serie real de los 12 meses',
  (function () {
    const ys = yDeLaCurva(dDeLaCurva(cTotal));
    if (ys.length !== 12) return false;
    for (let i = 0; i < 12; i++) {
      if (Math.abs(ys[i] - yEsperado(i + 1, 12)) > 0.2) return false;
    }
    return true;
  })(), 'y=' + yDeLaCurva(dDeLaCurva(cTotal)).join(','));
ok('12) la curva de Aprobadas sale de la serie de aprobadas',
  (function () {
    const ys = yDeLaCurva(dDeLaCurva(cApr));
    if (ys.length !== 12) return false;
    return ys.every(function (y) { return Math.abs(y - yEsperado(1, 1)) < 0.2; });
  })());
ok('13) la curva de Reprobadas sale de la serie (total - aprobadas)',
  (function () {
    const ys = yDeLaCurva(dDeLaCurva(cRep));
    if (ys.length !== 12) return false;
    for (let i = 0; i < 12; i++) {
      if (Math.abs(ys[i] - yEsperado(i, 11)) > 0.2) return false;
    }
    return true;
  })());
ok('14) la curva del Promedio usa la escala real (0 a 22 puntos)',
  (function () {
    const ys = yDeLaCurva(dDeLaCurva(cProm));
    if (ys.length !== 12) return false;
    return ys.every(function (y) { return Math.abs(y - yEsperado(20, 22)) < 0.2; });
  })());
ok('15) las 4 curvas son DISTINTAS (cada card usa su serie)',
  dDeLaCurva(cTotal) !== dDeLaCurva(cApr) &&
  dDeLaCurva(cTotal) !== dDeLaCurva(cRep) &&
  dDeLaCurva(cTotal) !== dDeLaCurva(cProm));
ok('16) la curva es SVG nativo con area, punto final y guia',
  /<svg/.test(cTotal) && /kair-spark__area/.test(cTotal) &&
  /kair-spark__dot/.test(cTotal) && /kair-spark__halo/.test(cTotal) &&
  /kair-spark__guide/.test(cTotal));
ok('17) la curva NO estira el dibujo (preserveAspectRatio="none" prohibido)',
  cTotal.indexOf('preserveAspectRatio') === -1 &&
  cTotal.indexOf('<text') === -1 && /viewBox="0 0 200 34"/.test(cTotal));
ok('18) sin dato NO hay curva inventada (linea de puntos, sin area ni punto)',
  (function () {
    const vacia = inst._buildSpark([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0, 'vacio');
    return vacia.indexOf('kair-kpi__spark-empty') >= 0 &&
      vacia.indexOf('kair-spark__area') === -1 &&
      vacia.indexOf('kair-spark__dot') === -1;
  })());
ok('19) una serie con un solo valor NO rompe la curva',
  (function () {
    const uno = inst._buildSpark([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7], 0, 'uno');
    return uno.indexOf('kair-spark__line') >= 0 && uno.indexOf('NaN') === -1;
  })());
ok('20) el promedio del mes existe en las metricas (la curva no se inventa)',
  /prom:\s*rm\.length \? suma \/ rm\.length : null/.test(js));

// ══ 4 · El pie lleva al registro ═════════════════════════════════════════
ok('21) los 4 pies tienen su manejador',
  /on\('#kpi-detalle-total', 'click'/.test(js) &&
  /on\('#kpi-detalle-apr', 'click'/.test(js) &&
  /on\('#kpi-detalle-rep', 'click'/.test(js) &&
  /on\('#kpi-detalle-prom', 'click'/.test(js));
ok('22) el pie de Reprobasas filtra por REPROBADO y el de Aprobadas por APROBADO',
  /detalle\('REPROBADO'\)/.test(js) && /detalle\('APROBADO'\)/.test(js));
ok('23) el pie resincroniza el desplegable de estado (trampa 210)',
  /self\._syncIndPickers\(\);/.test(js) &&
  /var fe = self\.q\('#f-estado'\); if \(fe\) fe\.value = estado;/.test(js));

// ══ 5 · El CSS es del modulo y sale de tokens ════════════════════════════
ok('24) las reglas nuevas van con scope .inducciones-container',
  /\.inducciones-container \.kair-kpi__inner/.test(css) &&
  /\.inducciones-container \.kair-kpi__foot/.test(css) &&
  /\.inducciones-container \.kair-kpi__spark/.test(css));
ok('25) los colores del piloto salen de tokens (ningun color fijo)',
  (function () {
    const hex = bloqueCss.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    const rgb = bloqueCss.match(/rgba?\(/g) || [];
    return hex.length === 0 && rgb.length === 0;
  })(), 'colores fijos: ' + ((bloqueCss.match(/#[0-9a-fA-F]{3,8}\b/g) || []).join(',')));
ok('26) la externa usa el tono suave y la interna el color de card',
  /\.kair-kpi\{[^}]*background:var\(--kair-track\)/.test(css) &&
  /\.kair-kpi__inner\{[^}]*background:var\(--kair-surface\)/.test(css));
ok('27) el pie se apoya en la externa (borde a todo el ancho)',
  /\.kair-kpi__foot\{[^}]*margin:0 calc\(var\(--krc-gap\) \* -1\)/.test(css) &&
  /\.kair-kpi__foot\{[^}]*border-top:1px solid var\(--kair-border\)/.test(css));
ok('28) el CSS del modulo sigue SCOPEADO (0 reglas sin scope)',
  css.split('\n').filter(function (l) { return /^\.(kair-|k-)/.test(l.trim()); }).length === 0);
ok('29) la curva usa escala uniforme (width:100% + height:auto, no se estira)',
  /\.kair-spark__svg\{[^}]*width:100%/.test(css) &&
  /\.kair-spark__svg\{[^}]*height:auto/.test(css) &&
  css.indexOf('preserveAspectRatio') === -1);

// ══ 6 · Cache-bust ═══════════════════════════════════════════════════════
ok('30) el CSS de la vista lleva el sello nuevo',
  /inducciones-view\.css\?v=INDUCCIONES-20261127-v24-cards/.test(html));
ok('31) el token del modulo (INDUC_TOKEN) es el nuevo',
  /var INDUC_TOKEN = 'INDUCCIONES-20261127-v24-cards';/.test(js));
ok('32) index.html carga la logica con el sello nuevo',
  /inducciones-logic\.js\?v=INDUCCIONES-20261127-v24-cards/.test(indexHtml));
ok('33) el sello anterior ya no esta en el modulo',
  js.indexOf('INDUCCIONES-20261126-v23-pickers') === -1 &&
  html.indexOf('INDUCCIONES-20261126-v23-pickers') === -1);

// ══ 7 · Mordida: los checks tienen que fallar si el piloto se rompe ═══════
ok('34) MORDE: si la card interna desaparece, el check 4 tiene que fallar',
  (function () {
    const roto = html.split('class="kair-kpi__inner"').join('class="kair-kpi__plana"');
    return roto !== html &&
      (roto.match(/class="kair-kpi__inner"/g) || []).length !== 4;
  })());
ok('35) MORDE: si el color del chip se fija, el check 25 tiene que fallar',
  (function () {
    const conFijo = css.replace('background:var(--kair-track);', 'background:#eef1f4;');
    const bloque = conFijo.slice(conFijo.indexOf('9. KPI CARDS'), conFijo.indexOf('10. TARJETAS'));
    return (bloque.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length > 0;
  })());
ok('36) MORDE: si la barra de progreso vuelve, el check 9 tiene que fallar',
  (function () {
    const conBarra = html.replace('class="kair-kpi__spark" id="kpi-apr-spark"',
      'class="kair-kpi__bar"><span id="kpi-apr-bar"></span></div><div class="kair-kpi__spark" id="kpi-apr-spark"');
    return conBarra !== html && conBarra.indexOf('kair-kpi__bar') >= 0;
  })());
ok('37) MORDE: si la curva se inventa (sin dato), el check 18 tiene que fallar',
  (function () {
    const sinVacio = js.replace(
      "return '<div class=\"kair-kpi__spark-empty\" aria-hidden=\"true\">'",
      "return '<div class=\"kair-kpi__spark-box\" aria-hidden=\"true\">'");
    return sinVacio !== js;
  })());
ok('38) MORDE: si el pie se borra, el check 7 tiene que fallar',
  (function () {
    const sinPie = html.replace(/<button type="button" class="kair-kpi__foot"[\s\S]*?<\/button>/, '');
    return sinPie !== html && (sinPie.match(/class="kair-kpi__foot"/g) || []).length !== 4;
  })());

// ── Reporte ───────────────────────────────────────────────────────────────
let failed = 0;
checks.forEach(function (c) {
  if (!c.ok) failed++;
  console.log((c.ok ? '[OK  ] ' : '[FAIL] ') + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ Cards KPI v2 de Induccion y Reinduccion OK');
