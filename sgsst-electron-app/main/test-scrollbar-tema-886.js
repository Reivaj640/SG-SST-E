'use strict';
// 📦886 · Las barras de desplazamiento siguen el tema elegido.
//
// LO QUE SE VEIA: la barra blanca sobre el fondo oscuro. No era que faltara una
// regla para el tema oscuro; era que las reglas de color de la barra NO EXISTEN
// para ningun tema.
//
// LA CAUSA. En styles.css, linea ~5805, hay una regla global
// `* { scrollbar-color: #c1c9d0 #f8f9fa; }`: gris claro sobre blanco, sin
// variante por tema. Ese par de colores era el que se veia siempre, en los tres
// temas.
//
// Y POR QUE NO SE ARREGLO "AGREGANDO UNOS OSCUROS". Este archivo tenia 9 reglas
// `::-webkit-scrollbar` (y los 6 CSS de modulos, 35 mas) que YA pretendian
// estilizar la barra, tres de ellas con bloque `[data-theme="dark"]` propio. No
// funcionaba ninguna, y no por especificidad: cuando existe `scrollbar-color`,
// Chromium ignora TODOS los pseudo-elementos `::-webkit-scrollbar`. Se comprobo
// en el navegador: dos cajas identicas salvo por tener, ademas del global, un
// thumb verde y una pista negra, se vieron IGUALES. Esas 35+ reglas no se
// dibujaban nunca.
//
// Este test existe para que eso no vuelva por la puerta de atras:
//
//   1. Contraste, RECALCULADO desde los tokens que hay en el archivo ahora mismo.
//      No basta con "existe un bloque oscuro": si alguien sube la superficie mas
//      clara y no toca el thumb, el ratio se cae solo y este test lo nota.
//
//   2. COBERTURA. Se recorren los 82 CSS del proyecto y se clasifican solos, sin
//      lista escrita a mano. Los que se pueden tocar tienen que quedar en cero;
//      los que NO se pueden tocar tienen que seguir con sus reglas, porque en
//      esas paginas `scrollbar-color` no existe y sus reglas SI pintan. Un
//      borrado equivocado ahi rompe paginas enteras.
//
//   3. Los `scrollbar-color` vivos tienen que leer el token. Un hex fijo es el
//      bug original, con otro nombre.
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const leer = p => fs.readFileSync(p, 'utf8');
const soloCodigo = t => t
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

function cuerpoRegla(css, selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + '\\s*\\{([^}]*)\\}');
  const m = re.exec(css);
  return m ? m[1] : '';
}
function bloqueTema(css, sel) {
  // Acepta `{` pegado al selector: en kair-premium.css los bloques oscuros se
  // escriben `[data-theme="dark"] .kair-premium{...}` sin espacio.
  const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{');
  const m = re.exec(css);
  if (!m) return '';
  const j = css.indexOf('\n}', m.index);
  return j < 0 ? '' : css.slice(m.index, j);
}
// El bloque que abre `sel` y que además declara `prop`. Hace falta porque en
// styles.css hay varios `* { }` y el que importa es el que trae scrollbar-color.
function bloqueDeProp(css, sel, prop) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + '\\s*\\{([^}]*)\\}', 'g');
  let m;
  while ((m = re.exec(css))) if (m[1].includes(prop)) return m[1];
  return '';
}
// Desde una marca hasta el cierre de bloque, quedandose con la aparicion que
// declara `prop`. Para selectores agrupados y para nombres que ya salen antes
// dentro de un `:has()`.
function cuerpoDesdeConProp(css, marca, prop) {
  let i = css.indexOf(marca);
  while (i >= 0) {
    const j = css.indexOf('}', i);
    const bloque = j < 0 ? '' : css.slice(i, j);
    if (bloque.includes(prop)) return bloque;
    i = css.indexOf(marca, i + 1);
  }
  return '';
}

// ── Contraste ───────────────────────────────────────────────────────────────
function rgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
function lum(h) {
  const c = rgb(h).map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
// Compone rgba() de blanco/alfa sobre un fondo opaco. Sin esto se mide el
// color de la regla y no el que ve el ojo.
function sobre(hex, blanco, alfa) {
  const b = rgb(hex);
  const out = b.map(v => Math.round(v * (1 - alfa) + 255 * alfa));
  return '#' + out.map(v => v.toString(16).padStart(2, '0')).join('');
}

const MIN_UI = 3.0; // WCAG 1.4.11, componentes de interfaz

// Superficies que existen de verdad en cada tema, leidas de sus tokens.
const TOK_SURF = [
  '--bg-color', '--widget-bg-color', '--content-area-bg', '--header-bg-color',
  '--home-page-bg', '--sidebar-bg-color', '--border-color',
];

const fallidos = [];
const registro = [];
function evaluar(F) {
  const c = { n: 0, f: 0 };
  const chk = (cond, nombre, detalle) => {
    c.n++;
    registro.push({ n: nombre, c: !!cond });
    if (!cond) { c.f++; fallidos.push(nombre + (detalle ? ' :: ' + detalle : '')); }
  };
  const st = soloCodigo(F.styles);

  // ── 1 · Los 6 tokens: 2 por tema, y los tres temas presentes.
  const raiz = bloqueTema(st, ':root');
  const dark = bloqueTema(st, '[data-theme="dark"]');
  const legacy = bloqueTema(st, '[data-theme="dark-legacy"]');
  chk(raiz.length > 0 && dark.length > 0 && legacy.length > 0,
    'existen los tres bloques de tema en styles.css');

  const val = (bloque, tok) => {
    const m = new RegExp(tok + ':\\s*(#[0-9a-fA-F]{3,8}|transparent)').exec(bloque);
    return m ? m[1].toLowerCase() : '';
  };
  for (const [nombre, bloque] of [['claro', raiz], ['dark', dark], ['dark-legacy', legacy]]) {
    chk(val(bloque, '--kair-scrollbar-thumb').length > 0,
      'el tema ' + nombre + ' define --kair-scrollbar-thumb');
    chk(val(bloque, '--kair-scrollbar-track').length > 0,
      'el tema ' + nombre + ' define --kair-scrollbar-track');
  }

  // ── 2 · Contraste del thumb contra TODA superficie real de su tema.
  //     El velo de las tarjetas del Panel se compone antes de medir. El velo de
  //     SUPERFICIE es el mas bajo del bloque oscuro del premium: los demas
  //     (hover, borde, tinte de chip) no son el fondo de una tarjeta.
  // El bloque oscuro del premium va compacto (`{--kair-faint:#9fb0c4}`), sin
  // cerrarse en un `\n}`, asi que se toma desde su selector hasta el final.
  const premCod = soloCodigo(F.premium);
  const iOsc = premCod.indexOf('[data-theme^="dark"]');
  const premOscuro = iOsc < 0 ? '' : premCod.slice(iOsc);
  const velos = [...premOscuro.matchAll(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)/g)]
    .map(m => parseFloat(m[1]));
  const velo = velos.length ? Math.min(...velos) : 1;
  chk(velo > 0 && velo <= 0.10,
    'se hallo el velo de superficie del Panel en el bloque oscuro', 'minimo ' + velo);

  const thumbClaro = val(raiz, '--kair-scrollbar-thumb');
  chk(thumbClaro.length > 0, 'el tema claro define su thumb');

  for (const [nombre, bloque, base] of [
    ['dark', dark, '--content-area-bg'],
    ['dark-legacy', legacy, '--content-area-bg'],
  ]) {
    const thumb = val(bloque, '--kair-scrollbar-thumb');
    chk(thumb.startsWith('#'), 'el thumb de ' + nombre + ' es un color solido', thumb);

    // Que basta con que el contraste pase no es el requisito. El requisito es
    // que la barra SIGA al tema: si el thumb oscuro es el mismo que el claro,
    // el owner vuelve a ver una barra blanca sobre fondo oscuro aunque el
    // contraste tecnicamente pase.
    chk(thumb !== thumbClaro,
      'el thumb de ' + nombre + ' NO es el del tema claro', thumb + ' = ' + thumbClaro);
    chk(val(bloque, '--kair-scrollbar-track') === 'transparent',
      'la pista de ' + nombre + ' es transparente (deja ver la superficie real)',
      val(bloque, '--kair-scrollbar-track'));
    chk(val(raiz, '--kair-scrollbar-track') !== 'transparent',
      'la pista del tema claro se conserva opaca (no se toco el tema claro)');

    const surf = {};
    for (const t of TOK_SURF) {
      const v = val(bloque, t);
      if (v) surf[t] = v;
    }
    // La superficie mas clara que no es un token: la tarjeta del Panel, que es
    // el fondo del componente con velo blanco encima del fondo del area.
    const fondoArea = val(bloque, base);
    if (fondoArea) surf['tarjeta Panel (velo ' + velo + ')'] = sobre(fondoArea, '#ffffff', velo);

    let peor = Infinity, donde = '';
    for (const [n, hex] of Object.entries(surf)) {
      const r = ratio(thumb, hex);
      if (r < peor) { peor = r; donde = n + ' ' + hex; }
    }
    chk(peor >= MIN_UI,
      'el thumb de ' + nombre + ' pasa ' + MIN_UI + ':1 contra toda superficie',
      'peor ' + peor.toFixed(2) + ' contra ' + donde);
    chk(Object.keys(surf).length >= 5,
      'se midieron al menos 5 superficies del tema ' + nombre,
      'solo ' + Object.keys(surf).length);
  }

  // ── 3 · El global lee los tokens. Un hex fijo aqui ES el bug original.
  const glob = bloqueDeProp(st, '*', 'scrollbar-color');
  chk(glob.length > 0, 'existe la regla global que fija scrollbar-color');
  chk(/scrollbar-color\s*:\s*var\(\s*--kair-scrollbar-thumb\s*\)/.test(glob),
    'el scrollbar-color global usa el token del thumb', glob.slice(0, 120));
  chk(/var\(\s*--kair-scrollbar-track\s*\)/.test(glob),
    'el scrollbar-color global usa el token de la pista');
  chk(/scrollbar-width\s*:\s*thin/.test(glob), 'el global conserva scrollbar-width: thin');

  // ── 4 · Los homes de los modulos principales, que tenían su propio color.
  const homes = cuerpoDesdeConProp(st, '.gestion-integral-home', 'scrollbar-color');
  chk(/scrollbar-color\s*:\s*var\(\s*--kair-scrollbar-thumb\s*\)\s+transparent/.test(homes),
    'los homes de módulo toman el thumb del token', homes.slice(0, 160));
  chk(/scrollbar-width\s*:\s*thin/.test(homes),
    'los homes conservan scrollbar-width: thin', homes.slice(0, 160));

  // ── 5 · El override de Carpetas. Su regla tiene especificidad (0,2,0) y le
  //     ganaba al global; sin esto la barra de ese módulo queda clara en oscuro.
  const carp = cuerpoRegla(st, '[data-theme^="dark"] .carp-scope .carp-wrapper');
  chk(carp.length > 0, 'existe el override oscuro de .carp-scope .carp-wrapper');
  chk(/scrollbar-color\s*:\s*var\(\s*--kair-scrollbar-thumb\s*\)/.test(carp),
    'el override de Carpetas usa el token');

  // ── 6 · Cero reglas webkit en todo lo que se puede tocar.
  //     Se busca sobre el CODIGO, no sobre el texto crudo: el comentario que
  //     documenta la regla borrada menciona `::-webkit-scrollbar` justamente para
  //     explicar que no se dibujaba, y eso no es una regla. styles.css siempre
  //     se comprobo asi; estos seis se estaban mirando en crudo y el primer
  //     comentario explicativo los hacia fallar.
  chk(!st.includes('::-webkit-scrollbar'), 'styles.css ya no tiene reglas ::-webkit-scrollbar');
  for (const [nombre, css] of Object.entries(F.borrados)) {
    chk(!soloCodigo(css).includes('::-webkit-scrollbar'),
      nombre + ' ya no tiene reglas ::-webkit-scrollbar');
  }

  // ── 7 · Los que NO se pueden tocar siguen con las suyas.
  chk(F.vivos.length >= 20, 'se detectaron las paginas con reglas vivas', F.vivos.length + ' archivos');
  for (const r of F.vivos) {
    chk(r.reglas > 0, 'intacto (sus reglas pintan): ' + r.rel, '0 reglas');
  }

  // ── 8 · Un `scrollbar-color` con color a mano es el bug original con otro
  //     nombre. En styles.css no puede haber ninguno. En un modulo puede quedar
  //     el valor del tema claro, pero solo si styles.css le pone su override
  //     oscuro: por especificidad el modulo gana al global y sin eso la barra de
  //     ese modulo se queda clara en los dos temas oscuros.
  chk(!/scrollbar-color\s*:\s*#[0-9a-fA-F]{3}/.test(st),
    'styles.css no fija a mano el color de ninguna barra');

  const fijos = [];
  for (const [nombre, css] of Object.entries(F.alcance)) {
    if (nombre === 'styles.css') continue;
    const re = /([^{}]+)\{([^}]*scrollbar-color\s*:[^}]*)\}/g;
    let m;
    while ((m = re.exec(soloCodigo(css)))) {
      if (!/#/.test(m[2])) continue;
      const sel = m[1].trim().split('\n').pop().trim();
      fijos.push({ nombre, sel });
    }
  }
  chk(fijos.length > 0, 'se detectaron los modulos con color de barra propio',
    fijos.length + ' encontrados');
  for (const fx of fijos) {
    const primera = (fx.sel.match(/\.[A-Za-z0-9_-]+/) || [])[0] || fx.sel;
    chk(st.includes('[data-theme^="dark"] ' + primera),
      'el color propio de ' + fx.nombre + ' tiene override oscuro en styles.css',
      'selector ' + fx.sel + ' (clase ' + primera + ')');
  }

  // ── 9 · Cache-bust de lo que se tocó.
  // La lista fija el `?v=` LITERAL, y eso se rompe cada vez que el archivo se
  // vuelve a tocar. Para los que llevan el sello del 886 y no se han movido en el
  // 889, el literal sigue siendo la aserción correcta. Para los que el 889 volvió
  // a tocar, lo que se vigila es el INVARIANTE —que lleven un `?v=`— y no el
  // número: cambiar el número es justamente lo que hay que hacer para que el CSS
  // llegue al navegador.
  for (const href of [
    'styles.css?v=20261014-scrollbar886',
    'modules/gestion-humana/dashboard/index.css?v=GH-20261014-scrollbar886',
    'modules/gestion-humana/carpetas/index.css?v=GH-20261014-scrollbar886',
    'modules/verificacion/definicion-indicadores/definicion-indicadores.css?v=20261014-scrollbar886',
    'modules/gestion-peligros/mantenimiento/mantenimiento.css?v=20261014-scrollbar886',
  ]) {
    chk(F.idx.includes('href="' + href + '"'), 'cache-bust de ' + href.split('?')[0]);
  }
  for (const rel of [
    'modules/gestion-peligros/inspecciones/inspeccion.css',
    'modules/verificacion/revision-alta-direccion/revision-alta-direccion.css',
  ]) {
    chk(new RegExp('href="' + rel.replace(/[/.]/g, '\\$&') + '\\?v=[^"]+"').test(F.idx),
        'cache-bust de ' + rel);
  }

  // ── 10 · Sin alfabetos que este repo prohibe colarse por las rutas.
  const malo = /[\u1100-\u11FF\u3040-\u30FF\u3130-\u318F\uAC00-\uD7FF\u0400-\u04FF]/;
  for (const [nombre, txt] of Object.entries(F.todo)) {
    const hit = txt.match(malo);
    chk(!hit, 'sin CJK/cirílico/hangul en ' + nombre, hit ? 'U+' + hit[0].codePointAt(0).toString(16) : '');
  }

  return c;
}

// ── Fuentes ─────────────────────────────────────────────────────────────────
const BORRADOS = {
  'development-styles.css': 'development-styles.css',
  'definicion-indicadores.css': 'modules/verificacion/definicion-indicadores/definicion-indicadores.css',
  'carpetas/index.css': 'modules/gestion-humana/carpetas/index.css',
  'dashboard/index.css': 'modules/gestion-humana/dashboard/index.css',
  'inspeccion.css': 'modules/gestion-peligros/inspecciones/inspeccion.css',
  'mantenimiento.css': 'modules/gestion-peligros/mantenimiento/mantenimiento.css',
};

function walk(dir, ext, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, acc);
    else if (e.name.endsWith(ext)) acc.push(p);
  }
  return acc;
}

// Clasifica los CSS con ::-webkit-scrollbar sin lista escrita a mano.
// Los que index.html carga con styles.css presente: sus reglas estan ANULADAS.
// Los que carga una pagina suelta sin styles.css: sus reglas PINTA.
function clasificar() {
  const raiz = APP;
  const cssFiles = walk(raiz, '.css', []);
  const htmlFiles = walk(raiz, '.html', []);
  const conWebkit = cssFiles.filter(f => leer(f).includes('::-webkit-scrollbar'));

  const cargaDe = new Map();
  const conStyles = new Set();
  for (const h of htmlFiles) {
    const txt = leer(h);
    const dir = path.dirname(h);
    const re = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi;
    let m;
    while ((m = re.exec(txt))) {
      const hm = /href=["']([^"']+)["']/i.exec(m[0]);
      if (!hm) continue;
      const href = hm[1].split('?')[0];
      if (/^https?:|^\/\//.test(href)) continue;
      const rel = path.relative(raiz, path.resolve(dir, href)).replace(/\\/g, '/');
      if (rel === 'styles.css') conStyles.add(h);
      if (!cargaDe.has(rel)) cargaDe.set(rel, []);
      cargaDe.get(rel).push(h);
    }
  }

  const idxPath = path.join(APP, 'index.html');
  const idxDir = path.dirname(idxPath);
  const idxCarga = new Set();
  for (const rel of cargaDe.keys()) {
    for (const h of cargaDe.get(rel)) {
      if (h === idxPath) idxCarga.add(rel);
    }
  }

  const vivos = [];
  for (const c of conWebkit) {
    const rel = path.relative(APP, c).replace(/\\/g, '/');
    const docs = cargaDe.get(rel) || [];
    const pintan = docs.filter(d => !conStyles.has(d));
    if (pintan.length > 0) {
      vivos.push({ rel, reglas: (leer(c).match(/::-webkit-scrollbar/g) || []).length });
    }
  }
  return { vivos, idxCarga };
}

function fuentes() {
  const borrados = {};
  for (const [nombre, rel] of Object.entries(BORRADOS)) {
    borrados[nombre] = leer(path.join(APP, rel));
  }
  const { vivos } = clasificar();
  // El alcance para el chequeo de color fijo: styles.css + los modulos que toco.
  const alcance = { 'styles.css': leer(path.join(APP, 'styles.css')) };
  for (const [nombre, rel] of Object.entries(BORRADOS)) {
    if (nombre !== 'development-styles.css') {
      alcance[nombre] = leer(path.join(APP, rel));
    }
  }
  const todo = Object.assign({}, borrados, alcance);
  return {
    styles: leer(path.join(APP, 'styles.css')),
    premium: leer(path.join(APP, 'shared', 'kair-premium.css')),
    idx: leer(path.join(APP, 'index.html')),
    borrados, vivos, alcance, todo,
  };
}

// ── Checks ──────────────────────────────────────────────────────────────────
const checks = [];
function fuentesYChecks() {
  // EOL: es una propiedad de los bytes, no del contenido.
  const eols = [
    ['styles.css', false], ['development-styles.css', true],
    ['modules/verificacion/definicion-indicadores/definicion-indicadores.css', true],
    ['modules/gestion-humana/carpetas/index.css', false],
    ['modules/gestion-humana/dashboard/index.css', false],
    ['modules/gestion-peligros/inspecciones/inspeccion.css', false],
    ['modules/gestion-peligros/mantenimiento/mantenimiento.css', false],
  ];
  for (const [rel, crlf] of eols) {
    const t = leer(path.join(APP, rel));
    const bien = crlf ? (/\r\n/.test(t) && !/[^\r]\n/.test(t)) : !/\r\n/.test(t);
    checks.push({ n: rel + ' conserva su EOL ' + (crlf ? 'CRLF' : 'LF'), c: bien, e: '' });
  }
}
fuentesYChecks();

const F0 = fuentes();
const base = evaluar(F0);
for (const r of registro) checks.push({ n: r.n, c: r.c, e: '' });

// ── Mutaciones ──────────────────────────────────────────────────────────────
function clonar(o) { return JSON.parse(JSON.stringify(o)); }

const MUT = [
  ['se quita el token del tema dark',
    f => { f.styles = f.styles.replace('--kair-scrollbar-thumb: #9fb0c4;', '--kair-scrollbar-thumb: #c1c9d0;'); }],
  ['se deja el thumb claro que tenia antes en los dos temas',
    f => { f.styles = f.styles.replace(/--kair-scrollbar-thumb: #9fb0c4;/, '--kair-scrollbar-thumb: #c1c9d0;').replace(/--kair-scrollbar-thumb: #9a9a9a;/, '--kair-scrollbar-thumb: #c1c9d0;'); }],
  ['se baja el thumb de dark por debajo de 3:1',
    f => { f.styles = f.styles.replace('--kair-scrollbar-thumb: #9fb0c4;', '--kair-scrollbar-thumb: #5a6675;'); }],
  ['se sube la superficie mas clara y no se toca el thumb',
    f => { f.styles = f.styles.replace('--widget-bg-color: #2d3748;', '--widget-bg-color: #6b7280;'); }],
  ['se quita el token del tema dark-legacy',
    f => { f.styles = f.styles.replace('--kair-scrollbar-thumb: #9a9a9a;', '--kair-scrollbar-thumb: transparent;'); }],
  ['el global vuelve al hex fijo (el bug original)',
    f => { f.styles = f.styles.replace('scrollbar-color: var(--kair-scrollbar-thumb) var(--kair-scrollbar-track);', 'scrollbar-color: #c1c9d0 #f8f9fa;'); }],
  ['el global deja de usar el token de la pista',
    f => { f.styles = f.styles.replace('var(--kair-scrollbar-thumb) var(--kair-scrollbar-track);', 'var(--kair-scrollbar-thumb) #f8f9fa;'); }],
  ['se quitan los scrollbar-width thin de los homes',
    f => { f.styles = f.styles.replace('scrollbar-width: thin;\n  /* 📦886', '/* 📦886'); }],
  ['se borra el override oscuro de Carpetas',
    f => { f.styles = f.styles.replace('[data-theme^="dark"] .carp-scope .carp-wrapper', '.carp-scope .carp-wrapperX'); }],
  ['reaparece una regla webkit en styles.css',
    f => { f.styles = f.styles.replace('/* Tabla */', '::-webkit-scrollbar-thumb { background: #fff; }\n/* Tabla */'); }],
  ['reaparece una regla webkit en un modulo',
    f => { f.borrados['carpetas/index.css'] += '\n::-webkit-scrollbar { width: 9px; }'; }],
  ['se vacia una pagina cuyas reglas SI pintan',
    f => { f.vivos = f.vivos.map(v => (v.rel.indexOf('evaluacion-inicial-view') >= 0 ? { rel: v.rel, reglas: 0 } : v)); }],
  ['un modulo nuevo se cuelga un scrollbar-color fijo sin override',
    f => { f.alcance['dashboard/index.css'] += '\n.dash-panel { scrollbar-color: #c1c8d0 transparent; }'; }],
  ['se deja el cache-bust viejo de 884',
    f => { f.idx = f.idx.replace('styles.css?v=20261014-scrollbar886', 'styles.css?v=20261014-sidebar884'); }],
  ['se quita el cache-bust de un modulo',
    f => { f.idx = f.idx.replace('mantenimiento.css?v=20261014-scrollbar886', 'mantenimiento.css?v=20260921-premium-header'); }],
  ['se cuela un caracter prohibido en el comentario',
    // El caracter se construye por codigo a proposito: este repo prohibe
    // cirilico/CJK/hangul tambien en los tests, y escribirlo literal dejaria
    // en el archivo justo lo que el propio test forbids.
    f => {
      const prohibido = String.fromCharCode(0x443, 0x430);
      f.todo['styles.css'] = f.todo['styles.css'].replace('/* Tabla */', '/* Tabla ' + prohibido + ' */');
    }],
];

let mutDetectados = 0, mutVacios = 0;
MUT.forEach(m => {
  const nombre = m[0];
  const f = clonar(F0);
  try { m[1](f); } catch (e) { console.log('FAIL MUTANTE LANZO ' + nombre + ': ' + e.message); mutVacios++; return; }
  const antes = JSON.stringify([f.styles, f.idx, f.borrados, f.vivos, f.alcance, f.todo]);
  const ref = JSON.stringify([F0.styles, F0.idx, F0.borrados, F0.vivos, F0.alcance, F0.todo]);
  if (antes === ref) { mutVacios++; console.log('FAIL MUTANTE VACIO ' + nombre); return; }
  fallidos.length = 0; registro.length = 0;
  const r = evaluar(f);
  if (r.f > 0) mutDetectados++;
  else console.log('FAIL MUTANTE NO DETECTADO ' + nombre);
});

checks.push({ n: 'mutaciones: ' + mutDetectados + '/' + MUT.length + ' detectadas', c: mutDetectados === MUT.length, e: '' });
checks.push({ n: 'mutaciones vacias: ' + mutVacios, c: mutVacios === 0, e: '' });
checks.push({ n: 'checks base: ' + (base.n - base.f) + '/' + base.n, c: base.f === 0, e: '' });

const bad = checks.filter(c => !c.c);
checks.forEach(c => { if (!c.c) console.log('FAIL ' + c.n); });
console.log((checks.length - bad.length) + '/' + checks.length + ' OK');
process.exit(bad.length === 0 ? 0 : 1);