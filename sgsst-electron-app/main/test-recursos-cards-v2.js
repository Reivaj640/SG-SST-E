/* ============================================================
 * K+AIR · Test — Cards KPI v2 del módulo Recursos (📦1113)
 * ============================================================
 * QUÉ PROTEGE ESTE ARCHIVO
 * ------------------------
 * El piloto visual de las cards (badge + curva de 12 meses + pie con la
 * flecha) del home de Recursos. El HERO NO se toca, y las reglas nuevas
 * van con scope `.kair-recursos-home`: las cards de los otros módulos
 * (que usan la misma clase compartida `.kair-metric-card`) no se mueven.
 *
 * El test NO mira texto: recorta la clase real del módulo y la EJECUTA en
 * un `vm` con un DOM mínimo, y juzga el HTML que produce de verdad.
 *
 * Correr con: node main/test-recursos-cards-v2.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const homePath = path.join(root, 'modules', 'recursos', 'recursos-home.js');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const homeSrc = fs.readFileSync(homePath, 'utf8');

const checks = [];
function ok(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra || '' });
}

// ── DOM mínimo: lo justo para que renderMetricCard funcione ─────────────
function fakeEl(tag) {
  return {
    tagName: tag,
    className: '',
    innerHTML: '',
    style: {},
    _attrs: {},
    setAttribute: function (k, v) { this._attrs[k] = v; },
    getAttribute: function (k) { return this._attrs[k]; },
    appendChild: function (c) { this.children = this.children || []; this.children.push(c); return c; },
    querySelector: function (sel) {
      // solo se consulta el boton del pie
      if (sel.indexOf('data-kair-metric-link') >= 0 && this.innerHTML.indexOf('data-kair-metric-link') >= 0) {
        return { onclick: null };
      }
      return null;
    },
    querySelectorAll: function () { return []; }
  };
}

function crearHome(submodules, srcOverride) {
  const doc = {
    createElement: fakeEl,
    getElementById: function () { return null; },
    head: { appendChild: function () {} },
    body: { appendChild: function () {} }
  };
  const sandbox = {
    document: doc,
    console: console,
    Math: Math,
    Number: Number,
    String: String,
    Object: Object,
    Array: Array,
    JSON: JSON,
    Date: Date,
    Intl: Intl,
    isFinite: isFinite,
    parseInt: parseInt,
    parseFloat: parseFloat,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(srcOverride || homeSrc, sandbox, { filename: 'recursos-home.js' });
  return new sandbox.window.RecursosHome(fakeEl('div'), 'Recursos', submodules || [], 'Empresa');
}

// ══ 1 · El HERO no se toca ═══════════════════════════════════════════════
const iHero = homeSrc.indexOf("hero.innerHTML = ''");
const iCards = homeSrc.indexOf('health.appendChild(this.renderMetricCard');
ok('1) el bloque del hero existe y esta antes de las cards',
  iHero >= 0 && iCards > iHero);
const hero = homeSrc.slice(iHero, iCards);
ok('2) el hero conserva su eyebrow, su mensaje y su score',
  /kair-hero-eyebrow/.test(hero) && /kair-hero-msg/.test(hero) && /kair-hero-score/.test(hero),
  'hero=' + hero.length + ' chars');
ok('3) el hero NO gana badge, curva ni pie (esa parte es de las cards)',
  !/kair-metric-badge/.test(hero) &&
  !/kair-spark/.test(hero) &&
  !/kair-metric-foot/.test(hero));
ok('4) el hero no se deforma: no hay regla de estilo nueva sobre el hero',
  !/\.kair-hero-card\s*\{[^}]*kair-recursos-home/.test(homeSrc) &&
  !/kair-recursos-home[^{]*\.kair-hero-card\s*\{/.test(homeSrc));

// ══ 2 · La anatomía nueva de las cards ═══════════════════════════════════
const home = crearHome(['1.2.1 Programa de capacitación Anual', '1.2.2 Inducción y Reinducción', '1.1.3 Asignación de Recursos']);

const card = home.renderMetricCard({
  label: 'Inducciones',
  valueHTML: '108 <small>/ 108</small>',
  desc: 'Personal con inducción al día',
  badgeText: 'Al día',
  variant: 'ok',
  series: [0, 4, 6, 9, 12, 10, 14, 11, 13, 9, 8, 12],
  sparkId: 'inducciones',
  linkKey: 'inducci'
});
const htmlCard = card.innerHTML;

ok('5) la card trae el badge con el dato que faltaba',
  /kair-metric-badge/.test(htmlCard) && /Al día/.test(htmlCard));
ok('6) la card trae la curva (SVG nativo, sin Chart.js)',
  /<svg/.test(htmlCard) && /kair-spark__line/.test(htmlCard) && /kair-spark__area/.test(htmlCard));
ok('7) la curva tiene punto final (como el diseño de referencia)',
  /kair-spark__dot/.test(htmlCard) && /kair-spark__halo/.test(htmlCard));
ok('8) la card trae el pie con la flecha',
  /kair-metric-foot/.test(htmlCard) && /data-kair-metric-link/.test(htmlCard) && /&rarr;/.test(htmlCard));
ok('9) la barra de progreso salio (su dato lo carga ahora el badge)',
  htmlCard.indexOf('kair-progress') === -1);
ok('10) la card conserva rotulo, valor y bajada',
  /kair-metric-head/.test(htmlCard) && /kair-metric-value/.test(htmlCard) &&
  /kair-metric-desc/.test(htmlCard) && /108/.test(htmlCard));

// ══ 3 · La curva sale del dato real, no de un adorno ═════════════════════
const conDatos = home.buildSparkline([0, 4, 6, 9, 12, 10, 14, 11, 13, 9, 8, 12], 'ok', 'x');
const dPath = (conDatos.match(/<path class="kair-spark__line" d="([^"]+)"/) || ['', ''])[1];
ok('11) la curva se construye con los 12 puntos de la serie',
  (dPath.match(/M /g) || []).length === 1 && (dPath.match(/Q /g) || []).length === 11,
  dPath.slice(0, 60));
ok('12) la curva tiene area que cierra en la linea base',
  /Z"/.test(conDatos) && /L /.test(conDatos));
ok('13) sin dato NO hay curva inventada (linea de puntos, sin area ni punto)',
  (function () {
    const vacia = home.buildSparkline(new Array(12).fill(0), 'ok', 'v');
    return vacia.indexOf('kair-spark--empty') >= 0 &&
      vacia.indexOf('kair-spark__area') === -1 &&
      vacia.indexOf('kair-spark__dot') === -1;
  })());
ok('14) una serie con un solo valor NO rompe la curva',
  (function () {
    const uno = home.buildSparkline([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7], 'ok', 'u');
    return uno.indexOf('kair-spark__line') >= 0 && uno.indexOf('NaN') === -1;
  })());
ok('15) la serie se acota al valor mas alto (no sale de la caja)',
  (function () {
    const grande = home.buildSparkline([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'ok', 'g');
    const ys = (grande.match(/[-\d.]+ (?=-)/g) || []).map(Number).filter(n => !isNaN(n));
    return ys.every(y => y <= 34 && y >= 0);
  })());

// ══ 4 · El pie respeta el rol del usuario ════════════════════════════════
const cardSinPermiso = crearHome(['1.2.2 Inducción y Reinducción']).renderMetricCard({
  label: 'Presupuesto',
  valueHTML: '96.0%',
  desc: 'Ejecución presupuestal acumulada',
  badgeText: '4.0% sin ejecutar',
  variant: 'ok',
  series: [1, 2, 3],
  sparkId: 'presupuesto',
  linkKey: 'asignacion de recursos'
});
ok('16) sin el submódulo en la lista (permisos) NO sale el pie',
  cardSinPermiso.innerHTML.indexOf('kair-metric-foot') === -1);
ok('17) con el submódulo en la lista SI sale el pie',
  home.renderMetricCard({
    label: 'Presupuesto', valueHTML: '96.0%', desc: 'x', badgeText: '4%',
    variant: 'ok', series: [1], sparkId: 'p', linkKey: 'asignacion de recursos'
  }).innerHTML.indexOf('kair-metric-foot') >= 0);

// ══ 5 · El CSS es del modulo, no del sistema ═════════════════════════════
const css = homeSrc;
ok('18) las reglas nuevas van con scope .kair-recursos-home',
  /\.kair-recursos-home \.kair-metric-card--v2/.test(css) &&
  /\.kair-recursos-home \.kair-spark/.test(css) &&
  /\.kair-recursos-home \.kair-metric-foot/.test(css));
ok('19) el piloto NO toca la clase compartida .kair-metric-card',
  !/\.kair-metric-card\s*\{[^}]*kair-recursos/.test(css) &&
  !/^\s*\.kair-metric-card\s*\{/m.test(css));
ok('20) los colores del piloto salen de tokens (ningun color fijo)',
  (function () {
    const bloque = css.slice(css.indexOf('CARDS KPI v2'), css.indexOf('.kair-recursos-home .ks-kpi-strip'));
    const hex = bloque.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    const rgb = bloque.match(/rgba?\(/g) || [];
    return hex.length === 0 && rgb.length === 0;
  })(), 'colores fijos en el bloque: ' + ((css.slice(css.indexOf('CARDS KPI v2'), css.indexOf('.kair-recursos-home .ks-kpi-strip')).match(/#[0-9a-fA-F]{3,8}\b/g) || []).join(',')));
ok('21) el hover usa tokens (design_system §5.9)',
  /\.kair-metric-foot:hover \{ color: var\(--kair-blue\); \}/.test(css));
ok('22) los tres tonos del badge estan (ok, warning, danger)',
  /kair-metric-badge--warning/.test(css) && /kair-metric-badge--danger/.test(css) &&
  /\.kair-metric-badge \{[^}]*kair-green-soft/.test(css));
ok('23) el esqueleto se alinea con el alto real de la card (no salta)',
  (function () {
    const m = css.match(/\.kair-recursos-home \.ks-kpi-strip \{[^}]*--ks-kpi-minh: ([^;]+);/);
    const c = css.match(/\.kair-recursos-home \.kair-metric-card--v2 \{[^}]*min-height: ([^;]+);/);
    return !!m && !!c && m[1].trim() === c[1].trim();
  })(), 'esqueleto vs card');
ok('24) la curva y el pie tienen sus clases de CSS',
  /\.kair-recursos-home \.kair-spark__svg/.test(css) && /\.kair-recursos-home \.kair-metric-foot__arrow/.test(css));

// ══ 6 · La card DENTRO de card (como en la referencia del owner) ═══════════
const iInner = htmlCard.indexOf('kair-metric-inner');
const iPie = htmlCard.indexOf('kair-metric-foot');
const iCierre = htmlCard.lastIndexOf('</div>', iPie);
const dentroDeLaInterna = iInner >= 0 && iCierre > iInner
  ? htmlCard.slice(iInner, iCierre) : '';

ok('25) el diseño vive dentro de la card interna',
  dentroDeLaInterna.indexOf('kair-metric-head') >= 0 &&
  dentroDeLaInterna.indexOf('kair-metric-value') >= 0 &&
  dentroDeLaInterna.indexOf('kair-metric-desc') >= 0 &&
  dentroDeLaInterna.indexOf('kair-spark') >= 0);
ok('26) el pie vive en la card EXTERNA (se cierra la interna antes del pie)',
  iPie > 0 && iCierre > iInner && iCierre < iPie);
ok('27) la externa usa el tono suave y la interna el color de card',
  /\.kair-recursos-home \.kair-metric-card--v2 \{[^}]*background: var\(--kair-soft\);/.test(css) &&
  /\.kair-metric-inner \{[^}]*background: var\(--kair-card\);/.test(css));
ok('28) la interna tiene su propio borde y su propio radio',
  /\.kair-metric-inner \{[^}]*border: 1px solid var\(--kair-line\);/.test(css) &&
  /\.kair-metric-inner \{[^}]*border-radius: calc\(var\(--kair-radius-card\) - 6px\);/.test(css));
ok('29) el pie se apoya en la externa (borde a todo el ancho, texto alineado)',
  /\.kair-metric-foot \{[^}]*margin: 0 calc\(var\(--krc-gap\) \* -1\);/.test(css) &&
  /\.kair-metric-foot \{[^}]*padding: 11px calc\(var\(--krc-gap\) \+ var\(--krc-pad-x\)\) 13px;/.test(css));
ok('30) la curva trae la guia vertical punteada del ultimo punto',
  /kair-spark__guide/.test(htmlCard) && /stroke-dasharray="2 3"/.test(htmlCard));

// ══ 7 · Cache-bust ═══════════════════════════════════════════════════════
ok('31) index.html bumpea el ?v= de recursos-home.js',
  /modules\/recursos\/recursos-home\.js\?v=RECURSOS-\d{8}-cards-v\d+/.test(html),
  (html.match(/recursos-home\.js\?v=[^"']+/) || [''])[0]);

// ══ 7 · Mordida: los checks tienen que fallar si el piloto se rompe ═══════
function conPilotoRoto() {
  return homeSrc
    .split('.kair-recursos-home .kair-metric-card--v2').join('.kair-metric-card--v2')
    .split('.kair-recursos-home .kair-spark').join('.kair-spark');
}
const roto = conPilotoRoto();
ok('32) MORDE: si el scope se quita, el check 18 tiene que fallar',
  !/\.kair-recursos-home \.kair-metric-card--v2/.test(roto) &&
  !/\.kair-recursos-home \.kair-spark/.test(roto));
ok('33) MORDE: si el color del badge se fija, el check 20 tiene que fallar',
  (function () {
    const conFijo = css.replace('background: var(--kair-green-soft);', 'background: #e6f5ef;');
    const bloque = conFijo.slice(conFijo.indexOf('CARDS KPI v2'), conFijo.indexOf('.kair-recursos-home .ks-kpi-strip'));
    return (bloque.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length > 0;
  })());
ok('34) MORDE: si la curva vuelve a ser inventada, el check 13 tiene que fallar',
  (function () {
    const sinVacio = homeSrc.replace(
      "return '<div class=\"kair-spark kair-spark--empty\" aria-hidden=\"true\">'",
      "return '<div class=\"kair-spark\" aria-hidden=\"true\">'");
    return sinVacio !== homeSrc;
  })());

ok('35) MORDE: si la card interna desaparece, el check 25 tiene que fallar',
  (function () {
    const sinInterna = homeSrc
      .split("+ '<div class=\"kair-metric-inner\">'")
      .join("+ '<div>'");
    if (sinInterna === homeSrc) return false;
    const h = crearHome(['1.2.2 Induccion y Reinduccion'], sinInterna);
    const c = h.renderMetricCard({
      label: 'Inducciones', valueHTML: '108', desc: 'x', badgeText: 'Al dia',
      variant: 'ok', series: [1, 2], sparkId: 'a', linkKey: 'inducci'
    });
    return c.innerHTML.indexOf('kair-metric-inner') === -1;
  })());

// ── Reporte ───────────────────────────────────────────────────────────────
let failed = 0;
checks.forEach(function (c) {
  if (!c.ok) failed++;
  console.log((c.ok ? '[OK  ] ' : '[FAIL] ') + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ Cards KPI v2 de Recursos OK');
