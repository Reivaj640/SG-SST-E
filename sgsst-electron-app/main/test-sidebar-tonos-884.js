'use strict';
// 📦884 · Los tonos del menú en los dos modos oscuros: sin azul, y legibles.
//
// POR QUÉ ESTE TEST EXISTE, Y POR QUÉ SE REHIZO COMPLETO.
//
// La primera versión de este paquete falló y este archivo es el que lo
// detecta. Aplicó el arreglo sobre `.k-module-title` y `.sidebar-module-card`,
// dos clases que el menú actual NO USA. El menú se renderiza con `kair-nav-*`
// (renderer.js:4167-4187) y se estiliza en shared/kair-sidebar.css. El arreglo
// estaba bien escrito, midió bien sus propios colores, y no cambió absolutamente
// nada de lo que se ve en pantalla. Peor: el artefacto de previsualización se
// construyó con las mismas clases equivocadas, así que mostraba exactamente el
// arreglo y no la app. Dueplicó el error en lugar de delatarlo.
//
// EL FALLO DE FONDO, que es lo que no puede volver a pasar:
//
// shared/kair-design-tokens.css define la paleta ÚNICAMENTE en `:root`. No
// tiene ningún bloque de tema oscuro — el que documenta design_system.md:335
// nunca se escribió. Como kair-sidebar.css usa SOLO esos tokens, en los dos
// temas oscuros el menú se pintaba con los valores del tema claro:
//
//   sin bloque oscuro              Sistema   Oscuro
//   título inactivo  #14213d         1.02     1.24   <- casi negro sobre casi negro
//   subtítulo        #748096         4.10     4.97
//   título ACTIVO    #2057b8         2.42     2.94   <- el azul que se veía
//   icono inactivo   #172c4c         1.17     1.42
//   fondo activo     #f3f6f6      casi blanco  casi blanco  <- la "tarjeta blanca"
//
// `--kair-soft` es la otra mitad: la usan tanto `:hover` como `--active`, y en
// claro es `#f3f6f6`, un casi blanco. Sobre fondo oscuro pinta un bloque claro
// que parece una tarjeta ajena pegada encima del ítem.
//
// POR QUÉ UN TEST DE TOKENS Y NO DE COLORES SUELTOS. El mismo bug ya se había
// "arreglado" antes por la vía contraria: overrides `!important` para `dark` sin
// equivalente en `dark-legacy`. Eso es parchear el síntoma, y por eso un tema se
// salva y el otro no. Estos checks miran que la FAMILIA entera exista en los dos
// temas, no que un color flaquee.
//
// Y POR QUÉ HAY UN CHECK DE CLASES REALES: es el que habría atrapado la v1.
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');

function leer(p) { return fs.readFileSync(p, 'utf8'); }

// Quita comentarios. OJO (riesgo conocido y ya mordido una vez en este repo):
// el `//` solo se corta si NO va precedido de `:`. Si un comentario de linea
// contiene la secuencia de apertura de bloque, el borrador abre un bloque falso
// y se come codigo. Por eso este archivo no escribe globulos en comentarios.
function soloCodigo(t) {
  return t
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// Bloque CSS completo por llaves balanceadas, desde el selector hasta su cierre.
// El selector va ANCLADO al comienzo de la regla (inicio de linea o llave de
// cierre). Sin el ancla, buscar `.kair-nav-card__title` encuentra la regla
// `[data-theme^="dark"] .kair-nav-card__title` que esta mas abajo en el archivo,
// y el test termina juzgando la regla equivocada. Eso ya paso.
function bloque(css, sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(?:^|\\n|\\})[ \\t]*' + esc + '[ \\t]*\\{');
  const m = re.exec(css);
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

// ── WCAG 2.1, componiendo el rgba sobre su fondo opaco ANTES de medir ──────
function hexRgb(h) {
  if (typeof h !== 'string') return null;
  h = h.trim().replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
function esHex(v) { return typeof v === 'string' && v.trim().startsWith('#'); }
function rgba(v) {
  const m = /rgba?\(([^)]+)\)/.exec(v);
  if (!m) return null;
  const p = m[1].split(',').map(x => parseFloat(x.trim()));
  return { c: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
}
function pintar(capa, fondoHex) {
  const bg = hexRgb(fondoHex);
  if (!bg || !capa) return null;
  if (esHex(capa)) return hexRgb(capa);
  const f = rgba(capa);
  if (!f) return null;
  return [0, 1, 2].map(i => Math.round(f.c[i] * f.a + bg[i] * (1 - f.a)));
}
function lum(rgb) {
  if (!rgb) return null;
  const ch = rgb.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function ratio(capa, fondoHex) {
  const L1 = lum(pintar(capa, fondoHex));
  const L2 = lum(hexRgb(fondoHex));
  if (L1 === null || L2 === null) return null;
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}
function hexTxt(rgb) { return rgb ? '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('') : null; }

const fallidos = [];
const registro = [];

function evaluar(F) {
  const c = { n: 0, f: 0 };
  const chk = (cond, nombre, detalle) => {
    c.n++;
    registro.push({ n: nombre, c: !!cond });
    if (!cond) { c.f++; fallidos.push(nombre + (detalle ? ' :: ' + detalle : '')); }
  };

  const sb = soloCodigo(F.sidebar);   // shared/kair-sidebar.css
  const tk = soloCodigo(F.tokens);    // shared/kair-design-tokens.css
  const st = soloCodigo(F.styles);    // styles.css
  const idx = soloCodigo(F.idx);      // index.html
  const rend = F.rend;                // renderer.js, en crudo (solo se busca texto)

  // ── A · Los tres bloques existen ───────────────────────────────────────
  const oscuroSb = bloque(sb, '[data-theme^="dark"] #sidebar');
  chk(oscuroSb !== null, 'kair-sidebar.css define el bloque [data-theme^="dark"] #sidebar');
  const rootTk = cuerpo(bloque(tk, ':root'));
  chk(rootTk.length > 0, 'kair-design-tokens.css define :root');
  const stDark = bloque(st, '[data-theme="dark"]');
  const stLeg = bloque(st, '[data-theme="dark-legacy"]');
  chk(stDark !== null, 'styles.css define [data-theme="dark"]');
  chk(stLeg !== null, 'styles.css define [data-theme="dark-legacy"]');

  // ── B · LA FAMILIA COMPLETA en oscuro ─────────────────────────────────
  // Estos son los tokens que el propio kair-sidebar.css consume. Si uno falta,
  // ese elemento vuelve a heredar el valor de tema claro y nadie se da cuenta
  // hasta que se mira en pantalla. Es el check que de verdad importa.
  const FAMILIA = ['kair-ink', 'kair-muted', 'kair-soft', 'kair-blue', 'kair-blue-ink', 'kair-line'];
  const cuerpoOscuro = cuerpo(oscuroSb);
  for (const t of FAMILIA) {
    chk(tokenEn(cuerpoOscuro, t) !== null, 'el bloque oscuro declara --' + t);
  }
  chk(FAMILIA.length === 6, 'la familia son 6 tokens');

  // Y cada uno tiene que ser CONSUMIDO de verdad por el componente: si el CSS
  // usa un token que el bloque oscuro no toca, ese elemento sigue en claro.
  for (const t of FAMILIA) {
    chk(sb.indexOf('var(--' + t + ')') >= 0, 'el componente consume --' + t);
  }

  // ── C · Los valores oscuros NO pueden ser los claros ──────────────────
  const claro = {};
  for (const t of FAMILIA) claro[t] = tokenEn(rootTk, t);
  for (const t of ['kair-ink', 'kair-muted', 'kair-blue', 'kair-blue-ink']) {
    const v = tokenEn(cuerpoOscuro, t);
    chk(v !== null && v.toLowerCase() !== String(claro[t]).toLowerCase(),
      'oscuro: --' + t + ' no es el valor de tema claro', 'vale ' + v);
  }

  // ─kair-soft es el caso grave: en claro es un casi blanco. Puesto como valor
  // opaco sobre fondo oscuro pinta el bloque claro que se veía de más.
  const softOscuro = tokenEn(cuerpoOscuro, 'kair-soft');
  chk(softOscuro !== null && softOscuro.toLowerCase() !== String(claro['kair-soft']).toLowerCase(),
    'oscuro: --kair-soft NO es el casi blanco de tema claro', 'vale ' + softOscuro);
  chk(softOscuro !== null && rgba(softOscuro) !== null,
    'oscuro: --kair-soft es translucido (un color opaco claro pintaria un bloque)', 'vale ' + softOscuro);

  // ── D · CLASES REALES: el guard que habria atrapado la v1 ────────────
  // Toda clase que toca el bloque oscuro tiene que existir en el marcado real
  // que produce renderer.js. Si no existe, el arreglo no mueve nada en pantalla.
  const clasesOscuro = [];
  for (const m of sb.matchAll(/\[data-theme\^="dark"\][^{]*\{/g)) {
    for (const c of m[0].match(/\.([A-Za-z0-9_-]+)/g) || []) clasesOscuro.push(c.slice(1));
  }
  chk(clasesOscuro.length > 0, 'el bloque oscuro nombra al menos una clase del componente');
  for (const cl of clasesOscuro) {
    chk(rend.indexOf(cl) >= 0, 'la clase .' + cl + ' existe en el marcado de renderer.js');
  }

  // El menú se renderiza con kair-nav-*, no con las clases legacy.
  for (const cl of ['kair-nav-card', 'kair-nav-card__title', 'kair-nav-card__subtitle',
    'kair-nav-card__icon', 'kair-nav-section-header', 'kair-nav-card--footer']) {
    chk(rend.indexOf(cl) >= 0, 'renderer.js produce ' + cl);
  }
  chk(/classList\.add\('kair-nav-card--active'\)/.test(rend),
    'renderer.js agrega kair-nav-card--active al módulo abierto');
  chk(rend.indexOf('k-module-title') < 0,
    'renderer.js NO produce .k-module-title (la clase que la v1 vino a arreglar)');

  // El contenedor existe en el HTML, que es lo que hace que el bloque pegue.
  chk(/<aside id="sidebar">/.test(F.idx), 'index.html tiene el contenedor #sidebar');
  chk(/<ul id="sidebar-menu">/.test(F.idx), 'index.html tiene la lista #sidebar-menu');

  // ── E · Jerarquía del estado activo en oscuro ─────────────────────────
  // En claro el azul de `--kair-blue` era la señal de "estás aquí". Al quitarlo
  // la señal pasa a ser tipográfica. Ojo: `.kair-nav-card__title` ya es 700
  // para TODOS los ítems, así que subir solo el activo a 700 no marcaría nada;
  // lo que diferencia es bajar el INACTIVO a 600.
  const reglaPeso = (sel) => {
    const b = bloque(sb, sel);
    if (!b) return null;
    const m = /font-weight:\s*(\d+)/.exec(cuerpo(b));
    return m ? parseInt(m[1], 10) : null;
  };
  chk(reglaPeso('[data-theme^="dark"] .kair-nav-card__title') === 600,
    'oscuro: el título inactivo pesa 600');
  chk(reglaPeso('[data-theme^="dark"] .kair-nav-card--active .kair-nav-card__title') === 700,
    'oscuro: el título activo pesa 700 (la señal pasa a ser tipográfica)');
  chk(reglaPeso('.kair-nav-card__title') === 700,
    'el título base sigue en 700: el tema claro no se toca');

  // Apacar el subtítulo del activo con opacity se descartó: al 75% cae a
  // 3.81, por debajo del 4.5 que pide AA para texto de 12px. Si alguien lo
  // vuelve a poner, este check lo para.
  const bSub = bloque(sb, '[data-theme^="dark"] .kair-nav-card--active .kair-nav-card__subtitle');
  const opSub = bSub ? (/opacity:\s*([\d.]+)/.exec(cuerpo(bSub)) || [])[1] : null;
  const fondoDark = tokenEn(cuerpo(stDark), 'sidebar-bg-color');
  const velo = tokenEn(cuerpoOscuro, 'kair-soft');
  const bgActivo = velo && fondoDark ? hexTxt(pintar(velo, fondoDark)) : null;
  const sub = tokenEn(cuerpoOscuro, 'kair-muted');
  if (opSub && bgActivo && sub) {
    const a = parseFloat(opSub);
    const rgbSub = hexRgb(sub);
    const rgbFondo = hexRgb(bgActivo);
    const composited = hexTxt([0, 1, 2].map(i => Math.round(rgbSub[i] * a + rgbFondo[i] * (1 - a))));
    const r = ratio(composited, bgActivo);
    chk(r !== null && r >= 4.5,
      'el subtitulo activo sigue pasando AA aunque se apague', 'ratio ' + (r === null ? 'n/d' : r.toFixed(2)));
  } else {
    chk(true, 'el subtitulo activo no se apaca por opacity (asi conserva AA)');
  }

  // ── F · CONTRASTE REAL contra los fondos que declara styles.css ───────
  const TEMAS = [['dark', stDark], ['dark-legacy', stLeg]];
  const MEDIDAS = [
    ['titulo inactivo', 'kair-ink', 4.5, false],
    ['subtitulo', 'kair-muted', 4.5, false],
    ['header de seccion', 'kair-muted', 4.5, false],
    ['auxiliar', 'kair-faint', 3.0, false],
    ['icono inactivo', 'kair-blue-ink', 3.0, false],
    ['titulo ACTIVO', 'kair-blue', 4.5, true],
    ['icono ACTIVO', 'kair-blue', 3.0, true],
    ['subtitulo ACTIVO', 'kair-muted', 4.5, true]
  ];
  for (const [tema, bTema] of TEMAS) {
    const fondo = tokenEn(cuerpo(bTema), 'sidebar-bg-color');
    chk(!!fondo, tema + ': hay fondo de menú para medir');
    if (!fondo) continue;
    const velo = tokenEn(cuerpoOscuro, 'kair-soft');
    const bgActivo = hexTxt(pintar(velo, fondo));
    for (const [nombre, tok, min, sobreActivo] of MEDIDAS) {
      const valor = tokenEn(cuerpoOscuro, tok);
      if (!valor) { chk(false, tema + ': falta ' + tok + ' para medir ' + nombre); continue; }
      const r = ratio(valor, sobreActivo ? bgActivo : fondo);
      chk(r !== null && r >= min,
        tema + ': ' + nombre + ' pasa ' + min, 'ratio ' + (r === null ? 'n/d' : r.toFixed(2)));
    }
    // El velo de activo tiene que NOTARSE sobre el fondo del menú.
    const dl = Math.abs(lum(hexRgb(bgActivo)) - lum(hexRgb(fondo)));
    chk(dl > 0.01, tema + ': el ítem activo se distingue del fondo', 'delta ' + dl.toFixed(4));
  }

  // ── G · El color HEREDADO de #sidebar ─────────────────────────────────
  // styles.css lo usa en `#sidebar { color: ... }` y solo existia en `:root`,
  // o sea con el valor del tema claro: 1.11 de contraste sobre el fondo oscuro.
  for (const [tema, bTema] of TEMAS) {
    const fondo = tokenEn(cuerpo(bTema), 'sidebar-bg-color');
    const v = tokenEn(cuerpo(bTema), 'sidebar-text-color');
    chk(v !== null, tema + ': styles.css declara --sidebar-text-color');
    if (v && fondo) {
      const r = ratio(v, fondo);
      chk(r >= 4.5, tema + ': el texto heredado del menú pasa AA', 'ratio ' + r.toFixed(2));
    }
  }

  // ── H · El tema CLARO se conserva entero ──────────────────────────────
  // El owner quitó el azul de los modos oscuros, no del claro.
  chk(String(claro['kair-blue']).toLowerCase() === '#2057b8',
    'tema claro: --kair-blue sigue siendo el azul de marca', String(claro['kair-blue']));
  chk(String(claro['kair-soft']).toLowerCase() === '#f3f6f6',
    'tema claro: --kair-soft sigue igual', String(claro['kair-soft']));
  const activoClaro = bloque(sb, '.kair-nav-card--active .kair-nav-card__title');
  chk(activoClaro !== null && /var\(--kair-blue\)/.test(cuerpo(activoClaro)),
    'tema claro: el título activo sigue en azul de marca');
  const iconoClaro = bloque(sb, '.kair-nav-card__icon');
  chk(iconoClaro !== null && /var\(--kair-blue-ink\)/.test(cuerpo(iconoClaro)),
    'tema claro: el icono sigue con su color propio');

  // ── I · Cache-bust de los DOS archivos que se tocaron ─────────────────
  const tokStyles = (/styles\.css\?v=([^"]+)/.exec(idx) || [])[1] || '';
  const tokSidebar = (/shared\/kair-sidebar\.css\?v=([^"]+)/.exec(idx) || [])[1] || '';
  chk(/^\d{8}-[a-z0-9-]+$/.test(tokStyles), 'styles.css lleva token con formato AAAAMMDD-descripcion', tokStyles);
  // El token se ancla al valor ANTERIOR a este paquete, no al numero 884.
  // `styles.css` lo toca casi todo paquete, asi que atar el check al numero
  // hacia que el test se rompiera solo con el siguiente que lo abriera, sin
  // que hubiera ningun error de verdad. Comparar contra el token previo sigue
  // detectando lo que importa: que el bump no se quedara sin hacer.
  chk(tokStyles.length > 0 && tokStyles !== '20261013-consent882',
    'el token de styles.css se bumpeo desde el paquete anterior a 884', tokStyles);
  chk(tokSidebar.length > 0, 'kair-sidebar.css lleva token de cache-bust');
  chk(/^SIDEBAR-\d{8}-[a-z0-9-]+$/.test(tokSidebar), 'el token del sidebar tiene formato SIDEBAR-AAAAMMDD-descripcion', tokSidebar);
  chk(/884/.test(tokSidebar), 'el token del sidebar nombra este paquete', tokSidebar);

  return c;
}

// ── Checks ──────────────────────────────────────────────────────────────────
const checks = [];

const ARCHIVOS = {
  sidebar: 'shared/kair-sidebar.css',
  tokens: 'shared/kair-design-tokens.css',
  styles: 'styles.css',
  idx: 'index.html',
  rend: 'renderer.js'
};
// El EOL de cada archivo esta fijado por su test: renderer.js es CRLF, los
// otros cuatro son LF. Cambiarlo rompe el diff entero.
const EOL_ESPERADO = {
  sidebar: 'lf', tokens: 'lf', styles: 'lf', idx: 'lf', rend: 'crlf'
};
for (const k of Object.keys(ARCHIVOS)) {
  const txt = leer(path.join(APP, ARCHIVOS[k]));
  const esCrlf = /\r\n/.test(txt);
  const okEol = EOL_ESPERADO[k] === 'crlf' ? esCrlf : !esCrlf;
  checks.push({ n: ARCHIVOS[k] + ' conserva su EOL ' + EOL_ESPERADO[k].toUpperCase(), c: okEol, e: '' });
}

const F0 = {};
for (const k of Object.keys(ARCHIVOS)) F0[k] = leer(path.join(APP, ARCHIVOS[k]));

// ── Mutaciones ──────────────────────────────────────────────────────────────
function clonar(o) { const r = {}; for (const k of Object.keys(o)) r[k] = o[k]; return r; }

const MUT = [
  ['se borra --kair-ink del bloque oscuro',
    f => { f.sidebar = f.sidebar.replace('--kair-ink:       #e6ebf2;', ''); }],
  ['se borra --kair-blue-ink del bloque oscuro',
    f => { f.sidebar = f.sidebar.replace('--kair-blue-ink:  #b9c6da;', ''); }],
  ['--kair-soft vuelve al casi blanco de tema claro',
    f => { f.sidebar = f.sidebar.replace('rgba(255, 255, 255, 0.12)', '#f3f6f6'); }],
  ['--kair-soft pasa a un claro opaco',
    f => { f.sidebar = f.sidebar.replace('rgba(255, 255, 255, 0.12)', '#e8eaed'); }],
  ['--kair-muted vuelve al gris de tema claro',
    f => { f.sidebar = f.sidebar.replace('--kair-muted:     #a7b6cc;', '--kair-muted:     #748096;'); }],
  ['vuelve el azul de marca al título activo en oscuro',
    f => { f.sidebar = f.sidebar.replace('--kair-blue:      #cdd9ea;', '--kair-blue:      #2057b8;'); }],
  ['se borra --sidebar-text-color del bloque dark de styles.css',
    f => { f.styles = f.styles.replace('--sidebar-text-color: #e6ebf2;', ''); }],
  ['se borra --sidebar-text-color del bloque dark-legacy',
    f => { f.styles = f.styles.replace('--sidebar-text-color: #e8e8e8;', ''); }],
  ['el título inactivo vuelve a pesar 700 (la señal del activo desaparece)',
    f => { f.sidebar = f.sidebar.replace(/\[data-theme\^="dark"\] \.kair-nav-card__title \{\s*font-weight: 600;/, '[data-theme^="dark"] .kair-nav-card__title { font-weight: 700;'); }],
  ['alguien "arregla" otra vez sobre .k-module-title, la clase muerta',
    f => { f.sidebar = f.sidebar.replace('[data-theme^="dark"] .kair-nav-card__title {', '[data-theme^="dark"] .k-module-title,\n[data-theme^="dark"] .kair-nav-card__title {'); }],
  ['se apaca el subtítulo activo por debajo de AA',
    f => { f.sidebar = f.sidebar.replace('[data-theme^="dark"] .kair-nav-card--active .kair-nav-card__title {', '[data-theme^="dark"] .kair-nav-card--active .kair-nav-card__subtitle { opacity: 0.75; }\n[data-theme^="dark"] .kair-nav-card--active .kair-nav-card__title {'); }],
  ['se pierde el cache-bust del sidebar',
    f => { f.idx = f.idx.replace('?v=SIDEBAR-20261014-dark-tokens884', '?v=SIDEBAR-20260913-v4-footer-soft'); }],
  ['se pierde el cache-bust de styles.css',
    f => { f.idx = f.idx.replace(/styles\.css\?v=[^"]+/, 'styles.css?v=20261013-consent882'); }],
  ['el tema claro pierde el azul de marca',
    f => { f.tokens = f.tokens.replace('--kair-blue:   #2057b8;', '--kair-blue:   #4d5b75;'); }],
  ['el velo de activo se apaga hasta no distinguirse del fondo',
    f => { f.sidebar = f.sidebar.replace('rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.02)'); }]
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

checks.push({ n: 'mutaciones: ' + mutDetectadas + '/' + MUT.length + ' detectadas', c: mutDetectadas === MUT.length, e: '' });
checks.push({ n: 'mutaciones vacias: ' + mutVacias, c: mutVacias === 0, e: '' });

// ── Corrida base ────────────────────────────────────────────────────────────
fallidos.length = 0;
registro.length = 0;
const base = evaluar(F0);
for (const r of registro) checks.push({ n: r.n, c: r.c, e: '' });
checks.push({ n: 'checks base: ' + (base.n - base.f) + '/' + base.n, c: base.f === 0, e: '' });

const bad = checks.filter(c => !c.c);
if (process.env.VERBOSO) {
  checks.forEach(c => console.log((c.c ? '  ok  ' : ' FALLA') + ' ' + c.n));
  if (fallidos.length) { console.log('\nDetalle:'); fallidos.forEach(f => console.log('  - ' + f)); }
}
console.log((checks.length - bad.length) + '/' + checks.length + ' OK');
process.exit(bad.length === 0 ? 0 : 1);
