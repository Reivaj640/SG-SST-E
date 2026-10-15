'use strict';
// 📦885 · El Panel de Control tiene que seguir el tema elegido.
//
// EL FALLO DE FONDO. shared/kair-premium.css es el archivo que viste el Panel de
// Control, y estaba enteramente scospado bajo `.kair-premium` con 30 colores
// literales en 120 lugares y NI UNA regla de tema: cero `[data-theme]`, cero
// `prefers-color-scheme`. Las dos unicas reglas que si usaban tokens
// (`--kair-canvas` y `--kair-ink` en la raiz del bloque) los leian de `:root`,
// y kair-design-tokens.css define la paleta SOLO en `:root`. O sea: el shell de
// alrededor si tenia 439 bloques de tema, y el panel dentro no tenia ninguno. De
// ahi el marco oscuro rodeando un panel completamente blanco.
//
// LO QUE ESTE TEST PROTEGE, y es lo importante:
//
// 1. COBERTURA, no colores sueltos. Se extraen todas las clases que declaran
//    color en la parte clara del archivo y se exige que cada una tenga
//    contraparte en el bloque oscuro. Un check de "existe el bloque" pasaria
//    aunque se olvidara la mitad de las tarjetas.
// 2. QUE EL TEMA CLARO NO SE TOQUE. El bloque tiene que ser aditivo: si alguien
//    edita una regla clara, este test lo canta.
// 3. CONTRASTE REAL, leido del CSS y de los bloques de tema de styles.css, no
//    estimado. Hay tres cosas que ya fallaron al medirlas y quedaron corregidas:
//      · `--content-area-bg` y `--widget-bg-color` son el MISMO color en los dos
//        temas oscuros, asi que usar el token del shell fundia la tarjeta con el
//        fondo. Las superficies van con velo de blanco.
//      · `--text-lighter-color` NO pasa AA: 3.61 en Sistema, 2.65 en Oscuro.
//      · Los tintes de chip al 18 % bajaban el texto a 4.23-4.35. Al 8 % el peor
//        caso es 4.73.
// 4. QUE NO APAREZCA !important. Las reglas oscuras ganan por especificidad
//    (0,2,1 contra 0,2,0). Si alguna vez hace falta !important, es que se esta
//    parchear el sintoma.
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const leer = p => fs.readFileSync(p, 'utf8');

function soloCodigo(t) {
  return t
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// Ancla en ASCII a proposito: los acentos y el punto medio se pelean con la
// codificacion de las herramientas de edicion.
const ANCLA = 'TEMA OSCURO DEL PANEL DE CONTROL';

// ── WCAG 2.1, componiendo el rgba sobre su fondo opaco ANTES de medir ─────
function hexRgb(h) {
  if (typeof h !== 'string') return null;
  h = h.trim().replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
function rgbaDe(v) {
  const m = /rgba?\(([^)]+)\)/.exec(v);
  if (!m) return null;
  const p = m[1].split(',').map(x => parseFloat(x.trim()));
  return { c: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
}
function pintar(capa, fondoHex) {
  const bg = hexRgb(fondoHex);
  if (!bg || !capa) return null;
  if (typeof capa === 'string' && capa.trim().startsWith('#')) return hexRgb(capa);
  const f = rgbaDe(capa);
  if (!f) return null;
  return [0, 1, 2].map(i => Math.round(f.c[i] * f.a + bg[i] * (1 - f.a)));
}
function lum(rgb) {
  if (!rgb) return null;
  const ch = rgb.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function ratio(capa, fondo) {
  const L1 = lum(pintar(capa, fondo)), L2 = lum(hexRgb(fondo));
  if (L1 === null || L2 === null) return null;
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}
const hexTxt = a => (a ? '#' + a.map(c => c.toString(16).padStart(2, '0')).join('') : null);

// Bloque CSS por llaves balanceadas, anclado al comienzo de la regla.
function bloque(css, sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp('(?:^|\\n|\\})[ \\t]*' + esc + '[ \\t]*\\{').exec(css);
  if (!m) return null;
  let depth = 0;
  for (let i = m.index + m[0].length - 1; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') { depth--; if (depth === 0) return css.slice(m.index + m[0].length - m[0].indexOf(sel[0]), i + 1); }
  }
  return null;
}
function cuerpo(b) { return b ? b.slice(b.indexOf('{') + 1, b.lastIndexOf('}')) : ''; }
function tokenEn(bloqueCss, nombre) {
  const m = new RegExp('--' + nombre.replace(/-/g, '\\-') + '\\s*:\\s*([^;]+);').exec(bloqueCss);
  return m ? m[1].trim() : null;
}
function reglas(txt) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    const sel = m[1].trim();
    if (!sel || sel.indexOf('@') === 0) continue;
    out.push({ sel, cuerpo: m[2] });
  }
  return out;
}
// El cuerpo de la REGLA oscura cuya lista de selectores incluye una clase dada.
// Hace falta porque el velo de superficie aparece en dos reglas (la tarjeta y el
// boton outline): buscar el texto en cualquier parte daria un check que no muerde.
function reglaQueDeclara(oscuro, clase) {
  const r = reglas(oscuro).find(x => x.sel.indexOf('[data-theme') >= 0 && x.sel.indexOf('.' + clase) >= 0);
  return r ? r.cuerpo : null;
}

const fallidos = [];
const registro = [];

function evaluar(F) {
  const c = { n: 0, f: 0 };
  const chk = (cond, nombre, detalle) => {
    c.n++;
    registro.push({ n: nombre, c: !!cond });
    if (!cond) { c.f++; fallidos.push(nombre + (detalle ? ' :: ' + detalle : '')); }
  };

  const pmRaw = F.premium;
  const idx = F.idx;
  const st = soloCodigo(F.styles);
  const rend = F.rend;

  // El ancla se busca en el TEXTO CRUDO: vive dentro del comentario de apertura
  // del bloque, y quitar comentarios antes de buscarla lo hacia desaparecer.
  const ancla = pmRaw.indexOf(ANCLA);
  chk(ancla >= 0, 'kair-premium.css tiene el bloque oscuro de 885');
  if (ancla < 0) return c;
  // Cortar desde la apertura del comentario: si el recorte empieza por en medio,
  // el `/*` queda fuera y la prosa que menciona !important no se puede quitar.
  const corte = pmRaw.lastIndexOf('/*', ancla);
  const claroRaw = pmRaw.slice(0, corte);
  const oscuroRaw = pmRaw.slice(corte);
  const claro = soloCodigo(claroRaw);
  const oscuro = soloCodigo(oscuroRaw);

  // ── 1 · EL TEMA CLARO NO SE TOCO ──────────────────────────────────────
  chk(claro.indexOf('[data-theme') === -1,
    'la parte clara de kair-premium.css no declara reglas de tema (el bloque es aditivo)');

  // ── 2 · SIN !important ────────────────────────────────────────────────
  chk((oscuro.match(/!important/g) || []).length === 0,
    'el bloque oscuro no usa !important (gana por especificidad)',
    String((oscuro.match(/!important/g) || []).length));

  // ── 3 · COBERTURA: toda clase que pinta en claro tiene contraparte ─────
  const esOscura = r => /\[data-theme/.test(r.sel);
  const clasesDe = sel => (sel.match(/\.[A-Za-z0-9_-]+/g) || []).map(x => x.slice(1));
  const PINTA = /(^|[;{\s])(color|background|background-color|border|border-color|border-top|border-bottom|box-shadow)\s*:/;
  // El hero, los rellenos semanticos y las franjas de las tareas ya son vivos:
  // funcionan sobre fondo oscuro y no necesitan contraparte.
  const EXENTAS = ['kair-hero', 'kair-kpi__fill', 'kair-task--critical', 'kair-task--warn', 'kair-task--info'];

  const clasesOscuras = new Set();
  for (const r of reglas(oscuro).filter(esOscura)) clasesDe(r.sel).forEach(x => clasesOscuras.add(x));

  const pintadoras = new Map();
  for (const r of reglas(claro).filter(r => !esOscura(r))) {
    if (!PINTA.test(r.cuerpo)) continue;
    clasesDe(r.sel)
      .filter(x => !EXENTAS.some(e => x.indexOf(e) >= 0))
      .forEach(x => { if (!pintadoras.has(x)) pintadoras.set(x, r.sel.replace(/\.kair-premium\s*/g, '').slice(0, 56)); });
  }
  chk(pintadoras.size > 20, 'la parte clara tiene clases que pintan (el check no esta vacio)', String(pintadoras.size));
  const huerfanas = [];
  for (const [x, sel] of pintadoras) if (!clasesOscuras.has(x)) huerfanas.push(x + ' (' + sel + ')');
  chk(huerfanas.length === 0, 'ninguna clase que pinta en claro queda sin contraparte oscura',
    huerfanas.join(' | '));

  // ── 4 · CLASES REALES (el guard que habria atrapado un arreglo a ciegas) ─
  chk(/className\s*=\s*'kair-dashboard kair-premium'/.test(rend),
    'renderer.js envuelve el Panel de Control en .kair-dashboard .kair-premium');
  for (const sel of ['[data-theme^="dark"]', 'data-theme="dark"', 'data-theme="dark-legacy"']) {
    chk(oscuro.indexOf(sel) >= 0, 'el bloque oscuro declara ' + sel);
  }
  // Toda clase kair- que el bloque oscuro toca tiene que existir en la parte
  // clara, salvo los tokens que el propio bloque declara.
  chk(/\[data-theme="dark"\] \.kair-premium\{--kair-faint:/.test(oscuro) &&
    /\[data-theme="dark-legacy"\] \.kair-premium\{--kair-faint:/.test(oscuro),
    'el bloque oscuro declara --kair-faint para los dos temas');

  // ── 5 · EL FONDO USA EL TOKEN DEL SHELL ───────────────────────────────
  chk(/\[data-theme\^="dark"\] \.kair-premium\{background:var\(--content-area-bg/.test(oscuro),
    'el fondo del panel usa --content-area-bg del shell, no un hex propio');

  // ── 6 · CONTRASTE REAL contra los fondos que declara styles.css ───────
  // La superficie se lee de la REGLA de las tarjetas, no de una busqueda suelta:
  // el mismo velo de 5 % aparece tambien en el boton outline.
  const reglaCard = reglaQueDeclara(oscuro, 'kair-card');
  chk(reglaCard !== null, 'existe la regla oscura que da la superficie a .kair-card');
  chk(reglaCard !== null && /background:\s*rgba\(255,255,255,\.05\)/.test(reglaCard),
    'las tarjetas usan el velo de superficie (5 % de blanco), no un color opaco');
  chk(reglaCard !== null && /border-color:\s*rgba\(255,255,255/.test(reglaCard),
    'las tarjetas llevan borde en velo, no un gris solido');
  const veloCard = reglaCard && /background:\s*rgba\(255,255,255,\.05\)/.test(reglaCard)
    ? 'rgba(255,255,255,0.05)' : null;
  const TINTES = [
    ['chip azul', 'rgba(77,166,255,.08)', '#8cc6ff'],
    ['chip verde', 'rgba(27,184,136,.08)', '#5fd3ab'],
    ['chip ambar', 'rgba(231,162,36,.08)', '#e8b957'],
    ['chip rojo', 'rgba(218,85,99,.08)', '#f0a0a8'],
    ['chip neutro', 'rgba(255,255,255,.08)', '#b6c2d4']
  ];
  for (const t of TINTES) chk(oscuro.indexOf(t[1]) >= 0, 'el tinte de ' + t[0] + ' esta al 8 %', t[1]);

  if (veloCard) {
    for (const [tema, sel] of [['dark', '[data-theme="dark"]'], ['dark-legacy', '[data-theme="dark-legacy"]']]) {
      const b = bloque(st, sel);
      const canvas = tokenEn(b, 'content-area-bg');
      const card = hexTxt(pintar(veloCard, canvas));
      const t1 = tokenEn(b, 'text-color');
      const t2 = tokenEn(b, 'text-light-color');
      const ac = tokenEn(b, 'primary-color');
      const m = new RegExp('\\[data-theme="' + tema + '"\\] \\.kair-premium\\{--kair-faint:(#[0-9a-fA-F]{6})').exec(oscuro);
      const terc = m ? m[1] : null;

      chk(!!canvas && !!card, tema + ': hay fondo y tarjeta para medir');
      chk(terc !== null, tema + ': declara su propio terciario', String(terc));
      // El token terciario del SHELL no sirve: hay que comprobar que el bloque no
      // lo usa, porque es el error que ya se cometio una vez.
      chk(oscuro.indexOf('var(--text-lighter-color') === -1,
        tema + ': no se usa --text-lighter-color (no pasa AA)');

      if (canvas && card && terc) {
        const filas = [
          ['titulo sobre tarjeta', t1, card, 4.5],
          ['subtitulo sobre tarjeta', t2, card, 4.5],
          ['terciario sobre tarjeta', terc, card, 4.5],
          ['terciario sobre fondo', terc, canvas, 4.5],
          ['subtitulo sobre fondo', t2, canvas, 4.5],
          ['titulo sobre fondo', t1, canvas, 4.5],
          ['acento sobre tarjeta', ac, card, 3.0]
        ];
        for (const [n, v, f, min] of filas) {
          const r = ratio(v, f);
          chk(r !== null && r >= min, tema + ': ' + n + ' pasa ' + min,
            'ratio ' + (r === null ? 'n/d' : r.toFixed(2)));
        }
        // La tarjeta tiene que SEPARARSE del fondo, o el arreglo es cosmetico.
        const dL = Math.abs(lum(hexRgb(card)) - lum(hexRgb(canvas)));
        chk(dL > 0.004, tema + ': la tarjeta se distingue del fondo', 'delta ' + dL.toFixed(4));
        for (const [n, bg, txt] of TINTES) {
          const bgC = hexTxt(pintar(bg, card));
          const r = ratio(txt, bgC);
          chk(r !== null && r >= 4.5, tema + ': ' + n + ' pasa 4.5 sobre la tarjeta',
            'ratio ' + (r === null ? 'n/d' : r.toFixed(2)) + ' sobre ' + bgC);
        }
      }
    }
  }

  // ── 7 · EL HERO NO SE TOCO ────────────────────────────────────────────
  const heroClaro = bloque(claro, '.kair-premium .kair-hero');
  chk(heroClaro !== null && /background:#14213D/.test(cuerpo(heroClaro)),
    'el hero conserva su fondo oscuro en los tres temas');

  // ── 8 · CACHE-BUST ────────────────────────────────────────────────────
  const tok = (/shared\/kair-premium\.css\?v=([^"]+)/.exec(idx) || [])[1] || '';
  chk(/^\d{8}-[a-z0-9-]+$/.test(tok), 'kair-premium.css lleva token con formato AAAAMMDD-descripcion', tok);
  // El token ya no tiene que nombrAR a este paquete: el 893 lo bumpeo a
  // `20261015-empresa893`. Lo que no puede pasar es que retroceda a uno
  // anterior, porque Electron seguiria sirviendo el CSS previo desde su cache.
  // Asi que lo que se comprueba es la FECHA del sello, no su texto.
  chk(parseInt(tok.slice(0, 8), 10) >= 20261014,
      'el sello no retrocede antes del dia del 885', tok);

  return c;
}

// ── Checks de archivo ──────────────────────────────────────────────────────
const ARCHIVOS = {
  premium: 'shared/kair-premium.css',
  tokens: 'shared/kair-design-tokens.css',
  styles: 'styles.css',
  idx: 'index.html',
  rend: 'renderer.js'
};
// El EOL de cada archivo esta fijado por su test: renderer.js es CRLF, los otros
// cuatro son LF. Cambiarlo rompe el diff entero.
const EOL = { premium: 'lf', tokens: 'lf', styles: 'lf', idx: 'lf', rend: 'crlf' };
const checks = [];
for (const k of Object.keys(ARCHIVOS)) {
  const txt = leer(path.join(APP, ARCHIVOS[k]));
  const esCrlf = /\r\n/.test(txt);
  checks.push({ n: ARCHIVOS[k] + ' conserva su EOL ' + EOL[k].toUpperCase(), c: EOL[k] === 'crlf' ? esCrlf : !esCrlf });
}

const F0 = {};
for (const k of Object.keys(ARCHIVOS)) F0[k] = leer(path.join(APP, ARCHIVOS[k]));

// ── Mutaciones ──────────────────────────────────────────────────────────────
function clonar(o) { const r = {}; for (const k of Object.keys(o)) r[k] = o[k]; return r; }

const MUT = [
  ['se borra el terciario propio de dark',
    f => { f.premium = f.premium.replace('[data-theme="dark"] .kair-premium{--kair-faint:#9fb0c4}', '[data-theme="dark"] .kair-premium{--kair-faint:var(--text-lighter-color)}'); }],
  ['se borra el terciario propio de dark-legacy',
    f => { f.premium = f.premium.replace('[data-theme="dark-legacy"] .kair-premium{--kair-faint:#9a9a9a}', ''); }],
  ['alguien usa el token terciario del shell, que no pasa AA',
    f => { f.premium = f.premium.replace('[data-theme="dark"] .kair-premium{--kair-faint:#9fb0c4}', '[data-theme="dark"] .kair-premium{--kair-faint:#868e96}'); }],
  ['los tintes de chip vuelven al 18 %, que no pasa AA',
    f => { f.premium = f.premium.replace(/rgba\(77,166,255,\.08\)/g, 'rgba(77,166,255,.18)').replace(/rgba\(218,85,99,\.08\)/g, 'rgba(218,85,99,.18)'); }],
  ['se borra la superficie de tarjeta',
    f => { f.premium = f.premium.replace('.kair-toast{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.11);box-shadow:none}', '.kair-toast{border-color:rgba(255,255,255,.11)}'); }],
  ['la tarjeta vuelve a ser del mismo color que el fondo',
    f => { f.premium = f.premium.replace('.kair-toast{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.11);box-shadow:none}', '.kair-toast{background:var(--content-area-bg);border-color:rgba(255,255,255,.11)}'); }],
  ['la tarjeta vuelve a blanca, como estaba antes del arreglo',
    f => { f.premium = f.premium.replace('.kair-toast{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.11);box-shadow:none}', '.kair-toast{background:#FFFFFF;border-color:#E8EBEE}'); }],
  ['la tarjeta pierde el borde',
    f => { f.premium = f.premium.replace('.kair-toast{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.11);box-shadow:none}', '.kair-toast{background:rgba(255,255,255,.05);box-shadow:none}'); }],
  ['el fondo deja de usar el token del shell',
    f => { f.premium = f.premium.replace('background:var(--content-area-bg,#2d3748);color:var(--text-color', 'background:#fbfcfb;color:var(--text-color'); }],
  ['se edita una regla del tema claro por error',
    f => { f.premium = f.premium.replace('.kair-premium .kair-card{background:#FFFFFF;', '[data-theme="dark"] .kair-premium .kair-card{background:#000000;'); }],
  ['aparece un !important para forzar algo',
    f => { f.premium = f.premium.replace('[data-theme^="dark"] .kair-premium .kair-task::before{background:#8fa0b5}', '[data-theme^="dark"] .kair-premium .kair-task::before{background:#8fa0b5 !important}'); }],
  ['se borra el override del hero, que ya era oscuro',
    f => { f.premium = f.premium.replace('.kair-premium .kair-hero{position:relative;overflow:hidden;background:#14213D;', '.kair-premium .kair-hero{position:relative;overflow:hidden;background:#FFFFFF;'); }],
  ['se pierde el cache-bust del archivo',
    f => { f.idx = f.idx.replace(/(shared\/kair-premium\.css\?v=)[^"]+/, '$120261002-hero-oculto'); }],
  ['la tarjeta se come el texto: el terciario vuelve a ser el del shell',
    f => { f.premium = f.premium.replace('[data-theme="dark-legacy"] .kair-premium{--kair-faint:#9a9a9a}', '[data-theme="dark-legacy"] .kair-premium{--kair-faint:#606060}'); }],
  ['renderer.js deja de aplicar la clase wrapper',
    f => { f.rend = f.rend.replace("className = 'kair-dashboard kair-premium'", "className = 'kair-dashboard'"); }]
];

let mutDetectadas = 0, mutVacias = 0;
for (const [nombre, aplicar] of MUT) {
  const F = clonar(F0);
  try { aplicar(F); } catch (e) { console.log('FAIL MUTANTE LANZO ' + nombre + ': ' + e.message); mutVacias++; continue; }
  if (JSON.stringify(F) === JSON.stringify(F0)) { mutVacias++; console.log('FAIL MUTANTE VACIO ' + nombre); continue; }
  fallidos.length = 0;
  registro.length = 0;
  const r = evaluar(F);
  if (r.f > 0) mutDetectadas++;
  else console.log('FAIL MUTANTE NO DETECTADO ' + nombre);
}
checks.push({ n: 'mutaciones: ' + mutDetectadas + '/' + MUT.length + ' detectadas', c: mutDetectadas === MUT.length });
checks.push({ n: 'mutaciones vacias: ' + mutVacias, c: mutVacias === 0 });

// ── Corrida base ────────────────────────────────────────────────────────────
fallidos.length = 0;
registro.length = 0;
const base = evaluar(F0);
for (const r of registro) checks.push({ n: r.n, c: r.c });
checks.push({ n: 'checks base: ' + (base.n - base.f) + '/' + base.n, c: base.f === 0 });

const bad = checks.filter(c => !c.c);
if (process.env.VERBOSO) {
  checks.forEach(c => console.log((c.c ? '  ok  ' : ' FALLA') + ' ' + c.n));
  if (fallidos.length) { console.log('\nDetalle:'); fallidos.forEach(f => console.log('  - ' + f)); }
}
console.log((checks.length - bad.length) + '/' + checks.length + ' OK');
process.exit(bad.length === 0 ? 0 : 1);
