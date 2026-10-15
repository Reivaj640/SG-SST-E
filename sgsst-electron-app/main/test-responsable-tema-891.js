/**
 * 📦891 · Test de tema del submódulo 1.1.1 «Responsable del SG-SST».
 *
 * ── QUE FALLA Y POR QUE HACE FALLA ESTE TEST ─────────────────────────────────
 * `responsable-sg-viewer.js` traía su propio sincronizador de tema, copiado de
 * `scripts/theme-manager.js`. Ese archivo NO está cargado en el shell, y la copia
 * se notaba en el contrato: leía `event.data.mode`, clave que renderer.js nunca
 * manda. Con `mode` siempre undefined caía en el fallback y devolvía `dark` en
 * todos los casos, así que en modo SISTEMA devolvía null y terminaba borrando el
 * atributo que renderer.js:1746 acababa de escribir. La vista se quedaba en
 * claro con el sistema en oscuro.
 *
 * El módulo compartido ya resuelve las cuatro formas reales. Este test vigila
 * que nadie vuelva a meter la copia, y que los tres niveles del sello `?v=` no
 * se caigan: sin sello Electron sirve del caché y el fix nunca llega a la vista.
 *
 * ── POR QUE LOS CHECKS DE CONTRASTE LEEN EL CSS Y NO UNA COPIA ────────────────
 * Una tabla de colores escrita a mano en el test puede quedarse vieja sin que
 * nadie lo note. Estos leen los bloques `:root` y `[data-theme]` del archivo real
 * y calculan la luminancia: si alguien cambia `--kair-primary`, el test falla
 * porque el color sobre él ya no alcanza, no porque alguien lo anotara.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const MOD = 'modules/recursos/responsable-sg';
const SELLO = 'RESPONSABLE-20261015-v1-dark891';

const ARCHIVOS = {
  viewer: MOD + '/responsable-sg-viewer.js',
  html: MOD + '/responsable-sg-view.html',
  logic: MOD + '/responsable-sg-logic.js',
  css: MOD + '/responsable-sg-view.css',
  index: MOD + '/index.js',
  renderer: 'renderer.js',
  modulo: 'shared/kair-iframe-theme.js'
};

// ── EOL fijado por archivo ───────────────────────────────────────────────────
// El EOL no es estética: un cambio de EOL rompe el diff entero del archivo. Este
// mapa lo declara para que una normalización accidental se note en el test.
// Clave CORTA del mapa ARCHIVOS -> [nombre en disco, EOL esperado].
// indexed por la clave corta a proposito: la seccion D lee de `sobre`, que
// esta indexado por clave corta, y si buscara por nombre largo nunca
// encontraria la copia mutada y toda mutacion de EOL seria un mutante vacio.
const EOL_ESPERADO = {
  viewer: ['responsable-sg-viewer.js', 'CRLF'],
  logic:  ['responsable-sg-logic.js',  'CRLF'],
  css:    ['responsable-sg-view.css', 'CRLF'],
  html:   ['responsable-sg-view.html', 'CRLF'],
  index:  ['index.js',                'LF']
};

const BAD_ALPHABET = /[\u0400-\u04FF\u4E00-\u9FFF\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;

let checks = 0;
const fallas = [];

function leer(clave, sobre) {
  if (sobre && sobre.hasOwnProperty(clave)) return sobre[clave];
  return fs.readFileSync(path.join(RAIZ, ARCHIVOS[clave]), 'utf8');
}

function ok(nombre, cond, detalle) {
  checks++;
  if (!cond) fallas.push(nombre + (detalle ? ' :: ' + detalle : ''));
}

// ── Utilidades de color ──────────────────────────────────────────────────────
// Los checks de la seccion A miran CODIGO, no texto: un comentario que explica el
// fallo puede nombrar la clave que ya no debe existir, y eso no es un defecto. Un
// comentario no ejecuta nada, asi que no puede romper el modo oscuro.
function sinComentarios(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
}
// Idem en HTML. El <head> documenta por que el script va primero, y esa
// documentacion menciona las etiquetas que los checks buscan.
function htmlSinComentarios(src) {
  return src.replace(/<!--[\s\S]*?-->/g, ' ');
}

function aRgb(s) {
  s = (s || '').trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16) };
  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) };
  m = /rgba?\(([^)]+)\)/.exec(s);
  if (m) { const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2] }; }
  return null;
}
function lum(c) {
  const f = [c.r, c.g, c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// Extrae el bloque que abre con el selector dado y devuelve sus tokens.
function bloque(css, selector) {
  const i = css.indexOf(selector);
  if (i < 0) return null;
  const ini = css.indexOf('{', i);
  let depth = 0, fin = -1;
  for (let k = ini; k < css.length; k++) {
    if (css[k] === '{') depth++;
    else if (css[k] === '}') { depth--; if (depth === 0) { fin = k; break; } }
  }
  if (fin < 0) return null;
  const t = {};
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(css.slice(ini + 1, fin)))) t[m[1].replace(/^kair-/, '')] = m[2].trim();
  return t;
}

function correr(sobre) {
  const viewer = leer('viewer', sobre);
  const html = leer('html', sobre);
  const logic = leer('logic', sobre);
  const css = leer('css', sobre);
  const renderer = leer('renderer', sobre);
  const modulo = leer('modulo', sobre);
  const viewerCodigo = sinComentarios(viewer);
  const htmlCodigo = htmlSinComentarios(html);

  // ═══ A · EL SYNC: la trampa que rompe el modo ══════════════════════════════
  ok('A1 el viewer no lee la clave mode del mensaje',
    !/\bdata\.mode\b/.test(viewerCodigo),
    'volvio la clave que renderer.js nunca manda');
  ok('A2 no existe la funcion que resolvia theme/mode',
    !/resolveThemeValue/.test(viewerCodigo));
  ok('A3 no existe _applyThemeToHtml', !/_applyThemeToHtml/.test(viewerCodigo));
  ok('A4 no queda _themeMessageHandler', !/_themeMessageHandler/.test(viewerCodigo));
  ok('A5 no queda _themeObserver', !/_themeObserver/.test(viewerCodigo));
  ok('A6 no queda un MutationObserver propio',
    !/new MutationObserver/.test(viewerCodigo),
    'solo observaba y logueaba: no aplicaba nada');
  ok('A7 el viewer delega en el modulo compartido',
    /window\.kairIframeApplyTheme/.test(viewerCodigo));
  ok('A8 el viewer avisa si el modulo no cargo',
    /THEME_MODULE_MISSING/.test(viewerCodigo));
  ok('A9 _teardownThemeSync quedo como no-op',
    /function _teardownThemeSync\(\)\s*\{\s*\}/.test(viewerCodigo));

  // El contrato del modulo tiene que seguir siendo el de renderer.js, no el de
  // theme-manager.js. Si renderer.js dejara de mandar effectiveTheme, el modulo
  // se quedaria corto y este check lo diria.
  const chTheme = /theme-changed[\s\S]{0,220}?effectiveTheme/.test(renderer);
  ok('A10 renderer.js sigue mandando effectiveTheme', chTheme,
    'el modulo compartido depende de esa clave');
  ok('A11 renderer.js NO manda mode en el postMessage de tema',
    !/type:\s*'theme-changed'[\s\S]{0,160}?\bmode\s*:/.test(renderer),
    'siulguna vez existio, el modulo compartido lo ignoraria en silencio');
  ok('A12 el modulo compartido acepta dark-legacy como entrada',
    /pref === 'dark-legacy'/.test(modulo),
    'dark-legacy no es alias de dark: sin esto el oscuro manual no pinta');
  ok('A13 el modulo compartido se auto-instala al cargarse',
    /\n\s*init\(\);\s*\n\}\)\(\);?/.test(modulo));

  // ═══ B · LOS TRES NIVELES DEL SELLO ════════════════════════════════════════
  // Los DOS indices se miden sobre el mismo texto. Comparar una posicion del
// HTML con comentarios contra otra del HTML sin ellos es comparar dos textos
// distintos, y el comentario del head es mas largo que el gap que se quiere
// medir: el check daria un fallo falso.
const iScript = htmlCodigo.indexOf('kair-iframe-theme.js');
  const iPrimerLink = htmlCodigo.search(/<link\b/);
  ok('B1 el head carga shared/kair-iframe-theme.js', iScript >= 0);
  ok('B2 el script va ANTES del primer <link>', iScript >= 0 && iScript < iPrimerLink,
    'si carga despues, la vista pinta en claro y luego salta');
  ok('B3 el script no lleva defer ni async',
    !/<script[^>]*kair-iframe-theme\.js[^>]*(defer|async)/.test(html),
    'con defer el tema llega despues del primer pintado');
  ok('B4 el script lleva sello ?v=', new RegExp('kair-iframe-theme\\.js\\?v=' + SELLO).test(html));
  ok('B5 el CSS propio lleva sello ?v=', new RegExp('responsable-sg-view\\.css\\?v=' + SELLO).test(html));
  ok('B6 el iframe.src del padre lleva sello ?v=',
    new RegExp('responsable-sg-view\\.html[^`]*&v=' + SELLO).test(logic),
    'tercer nivel: sin esto Electron sirve el HTML viejo desde cache');

  // ═══ C · CONTRASTE, LEIDO DE LOS TOKENS REALES ══════════════════════════════
  const claro = bloque(css, ':root {');
  const oscuro = bloque(css, '[data-theme="dark"] .kair-body,');
  ok('C0 se encontro el bloque :root', !!claro);
  ok('C0b se encontro el bloque [data-theme="dark"] .kair-body', !!oscuro);
  if (claro && oscuro) {
    // 4.5 texto normal, 3.0 texto grande / iconos de componente.
    const PARES = [
      ['C1 on-accent sobre primary', 'on-accent', 'primary', 4.5],
      ['C2 on-accent sobre primary-hover', 'on-accent', 'primary-hover', 4.5],
      ['C3 on-danger sobre danger', 'on-danger', 'danger', 4.5],
      ['C4 on-warning sobre warning', 'on-warning', 'warning', 3.0],
      ['C5 text-primary sobre bg-card', 'text-primary', 'bg-card', 4.5],
      ['C6 text-primary sobre bg-app', 'text-primary', 'bg-app', 4.5],
      ['C7 text-secondary sobre bg-card', 'text-secondary', 'bg-card', 4.5],
      ['C8 primary sobre bg-card', 'primary', 'bg-card', 4.5]
    ];
    for (const [nombre, tkFondo, tkTinta, min] of PARES) {
      for (const [etq, t] of [['claro', claro], ['oscuro', oscuro]]) {
        const a = aRgb(t[tkFondo]), b = aRgb(t[tkTinta]);
        if (!a || !b) {
          // En claro los tokens on- existen; si faltan, el check tiene que ALSO
          // alertar en vez de saltarse en silencio.
          ok(nombre + ' [' + etq + '] tokens presentes', false,
            'falta --kair-' + tkTinta + ' o --kair-' + tkFondo);
          continue;
        }
        const r = ratio(b, a);
        ok(nombre + ' [' + etq + ']', r >= min,
          r.toFixed(2) + ':1, minimo ' + min + ' (' + t[tkTinta] + ' sobre ' + t[tkFondo] + ')');
      }
    }
  }

  // El blanco no puede quedar pegado a una superficie de acento: el acento
  // cambia de valor con el tema y el blanco se queda corto en cuanto cambia.
  const blancos = (css.match(/color:\s*#fff\s*;/g) || []).length;
  ok('C9 no queda ningun color: #fff en el CSS', blancos === 0, blancos + ' restantes');
  ok('C10 el marco del PDF usa token, no #fff',
    /\.kair-pdf-frame\s*\{[^}]*background:\s*var\(--kair-bg-card\)/.test(css));
  ok('C11 el cuerpo del preview usa token, no #fff',
    /\.kair-preview__body:has\(flyfish-file-viewer\)\s*\{[^}]*background:\s*var\(--kair-bg-card\)/.test(css));

  // Los bloques oscuros tienen que cubrir los DOS oscuros. Si aparece uno sin su
  // par dark-legacy, ese componente se queda en claro en el oscuro manual.
  const nDark = (css.match(/\[data-theme="dark"\]/g) || []).length;
  const nLegacy = (css.match(/\[data-theme="dark-legacy"\]/g) || []).length;
  ok('C12 los bloques oscuros cubren dark y dark-legacy por igual',
    nDark === nLegacy && nDark > 0, nDark + ' dark vs ' + nLegacy + ' dark-legacy');

  // ═══ D · EOL ═══════════════════════════════════════════════════════════════
  for (const [clave, par] of Object.entries(EOL_ESPERADO)) {
    const nombre = par[0];
    const esperado = par[1];
    const ruta = path.join(RAIZ, ARCHIVOS[clave]);
    const buf = (sobre && sobre.hasOwnProperty(clave)) ? Buffer.from(sobre[clave], 'utf8') : fs.readFileSync(ruta);
    const s = buf.toString('utf8');
    const crlf = (s.match(/\r\n/g) || []).length;
    const lf = (s.match(/(?<!\r)\n/g) || []).length;
    if (esperado === 'CRLF') ok('D ' + nombre + ' es CRLF puro', crlf > 0 && lf === 0, crlf + ' CRLF / ' + lf + ' LF');
    else ok('D ' + nombre + ' es LF puro', crlf === 0 && lf > 0, crlf + ' CRLF / ' + lf + ' LF');
    ok('D ' + nombre + ' sin BOM', !(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf));
  }

  // ═══ E · ALFABETOS PROHIBIDOS ═══════════════════════════════════════════════
  for (const clave of Object.keys(ARCHIVOS)) {
    const m = leer(clave, sobre).match(BAD_ALPHABET);
    ok('E ' + clave + ' sin cirílico/CJK/hangul', !m, m ? 'encontrado: ' + m[0] : '');
  }
}

function correrMutaciones() {
  const base = {};
  for (const k of Object.keys(ARCHIVOS)) base[k] = fs.readFileSync(path.join(RAIZ, ARCHIVOS[k]), 'utf8');

  // Cada mutacion tiene que HACER FALLAR al menos un check. Una mutacion que no
  // rompe nada no prueba que el check exista: es un mutante vacio.
  const MUTACIONES = [
    ['A1 vuelve event.data.mode',
      'viewer', s => s.replace('window.kairIframeApplyTheme', 'var mode = event.data.mode; window.kairIframeApplyTheme')],
    ['A2 vuelve _resolveThemeValue',
      'viewer', s => s + '\nfunction _resolveThemeValue(t, m) { return t === "dark" ? "dark-legacy" : null; }\n'],
    ['A4 vuelve _themeObserver',
      'viewer', s => s + '\n_state._themeObserver = { disconnect: function () {} };\n'],
    ['A6 vuelve un MutationObserver',
      'viewer', s => s.replace('function init()', 'function init() { var o = new MutationObserver(function () {}); o.observe(document.documentElement, { attributes: true }); }')],
    ['B1 quita el modulo del head',
      'html', s => s.replace(/<script src="\.\.\/\.\.\/\.\.\/shared\/kair-iframe-theme\.js[^<]*<\/script>/, '')],
    ['B2 mueve el script despues del primer link',
      'html', s => {
        const m = /<script src="\.\.\/\.\.\/\.\.\/shared\/kair-iframe-theme\.js[^<]*<\/script>/.exec(s);
        if (!m) return s;
        const sinScript = s.replace(m[0], '');
        return sinScript.replace('<link', m[0] + '\n<link');
      }],
    ['B3 pone defer en el script',
      'html', s => s.replace(/<script src="([^"]*kair-iframe-theme\.js[^"]*)"><\/script>/, '<script src="$1" defer></script>')],
    ['B4 quita el sello del script',
      'html', s => s.replace(/\?v=RESPONSABLE-20261015-v1-dark891/, '?v=1')],
    ['B6 quita el sello del iframe.src',
      'logic', s => s.replace('&v=RESPONSABLE-20261015-v1-dark891', '')],
    ['C2 vuelve el texto de acento a blanco en oscuro',
      'css', s => s.replace('--kair-on-accent: #0b1f33;', '--kair-on-accent: #ffffff;')],
    ['C4 vuelve el texto de warning a blanco en oscuro',
      'css', s => s.replace('--kair-on-warning: #3d2600;', '--kair-on-warning: #ffffff;')],
    ['C3 vuelve el texto de danger a blanco en oscuro',
      'css', s => s.replace('--kair-on-danger: #1a0506;', '--kair-on-danger: #ffffff;')],
    ['C9 vuelve un color: #fff sobre acento',
      'css', s => s.replace('.kair-header__action--primary {', '.kair-header__action--primary { color: #fff;')],
    ['C10 vuelve el marco del PDF a #fff',
      'css', s => s.replace(/(\.kair-pdf-frame\s*\{[^}]*?)background:\s*var\(--kair-bg-card\)/, '$1background: #fff')],
    ['C11 vuelve el cuerpo del preview a #fff',
      'css', s => s.replace(/(\.kair-preview__body:has\(flyfish-file-viewer\)\s*\{[^}]*?)background:\s*var\(--kair-bg-card\)/, '$1background: #fff')],
    ['C12 deja un bloque dark sin su par dark-legacy',
      'css', s => s.replace('[data-theme="dark"] .kair-skeleton,\r\n[data-theme="dark-legacy"] .kair-skeleton', '[data-theme="dark"] .kair-skeleton')],
    ['D normaliza el CSS a LF',
      'css', s => s.replace(/\r\n/g, '\n')],
    ['D normaliza el viewer a LF',
      'viewer', s => s.replace(/\r\n/g, '\n')],
    ['E mete un CJK en el CSS',
      'css', s => s.replace('.kair-pdf-frame {', '.kair-pdf-frame { /* prueba 责 */')],
    ['E mete un CJK en el HTML',
      'html', s => s.replace('<body', '<!-- 责 --><body')]
  ];

  console.log('\n── MUTACIONES ───────────────────────────────────────────────');
  let mutMuertas = 0, mutVacias = [];
  for (const [nombre, clave, fn] of MUTACIONES) {
    const antes = fallas.length;
    const copia = Object.assign({}, base);
    const cambiado = fn(copia[clave]);
    if (cambiado === copia[clave]) { mutVacias.push(nombre + ' (no cambio el archivo)'); continue; }
    copia[clave] = cambiado;
    try { correr(copia); } catch (e) { mutVacias.push(nombre + ' (lanzo: ' + e.message + ')'); continue; }
    const nuevas = fallas.slice(antes);
    if (nuevas.length === 0) mutVacias.push(nombre + ' (mutante vacio: ningun check la nota)');
    else { mutMuertas++; console.log('  ok  ' + nombre.padEnd(46) + ' -> ' + nuevas.length + ' check(s) la detectan'); }
  }
  return { total: MUTACIONES.length, muertas: mutMuertas, vacias: mutVacias };
}

// Estado de los checks BASE, separado del de las mutaciones: una mutacion
// existe para fallar, asi que si el resumen leyera el array global, el test
// se declararia roto justo despues de pasarlos todos.
correr(null);
const checksBase = checks;
const fallasBase = fallas.slice();
console.log('── CHECKS BASE ──────────────────────────────────────────────');
if (fallasBase.length === 0) console.log('  ' + checksBase + ' checks OK, 0 fallas');
else {
  console.log('  ' + (checksBase - fallasBase.length) + ' OK, ' + fallasBase.length + ' FALLAS:');
  for (const f of fallasBase) console.log('    FALLA  ' + f);
}

const m = correrMutaciones();
console.log('\n── RESUMEN ───────────────────────────────────────────────────');
console.log('  ' + m.total + ' mutaciones, ' + m.muertas + ' muerden');
if (m.vacias.length) {
  console.log('  ' + m.vacias.length + ' MUTANTES VACIOS (cada uno es un fallo del test):');
  for (const v of m.vacias) console.log('    ' + v);
}
const okTotal = fallasBase.length === 0 && m.vacias.length === 0;
console.log(okTotal ? '\n  TODO OK' : '\n  HAY FALLAS');
process.exit(okTotal ? 0 : 1);