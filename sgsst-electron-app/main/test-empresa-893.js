'use strict';
// 893 · La pantalla de seleccion de empresa tiene que estar en el dialecto premium
// y se tiene que LEER en los tres temas.
//
// QUE ESTA PANTALLA NO TIENE NADA MAS QUE TIENE ESTA.
//
// El resto de superficies del premium se apoya en una cosa: hay un fondo de token
// detras, asi que el texto puede leerse por --kair-ink y ya. Aqui no. El fondo es
// la animacion Vanta a pantalla completa, que es SIEMPRE clara, y hay texto
// encima. Medido contra el punto MAS CLARO que puede tener Vanta (el inicio del
// degradado, #a9bcd8, que es el que manda para WCAG):
//
//   texto blanco directo      1.93:1   falla incluso como texto grande
//   panel rgba(13,21,38,.62)  7.59:1   ok
//
// El 1.93:1 era el de la pantalla anterior. Se leia a ojo porque el text-shadow
// compensaba, pero WCAG no cuenta text-shadow: el numero es 1.93 y punto. De ahi
// el panel de vidrio, que no es decoracion sino la unica forma de que el texto
// pase.
//
// LO QUE ESTE TEST PROTEGE:
//
// 1. QUE VENTA SIGA VIENDOSE. Este es el mas importante y el mas facil de romper
//    sin darse cuenta. El contenedor lleva la clase `kair-premium`, y esa clase
//    pinta fondo: --kair-canvas en claro, #2d3748 en oscuro (su bloque de la
//    linea 265). Sin un `background:transparent` explicito, el oscuro se come la
//    animacion entera y la pantalla deja de ser la que se aprobo. El check
//    existe por eso.
// 2. CONTRASTE REAL de los tres temas, leido de los tokens de
//    kair-design-tokens.css y compuesto (el rgba del panel, sobre el rgba del
//    panel, sobre el punto mas claro de Vanta) ANTES de medir. Nada estimado.
// 3. QUE LOS ESTILOS VIEJOS NO VUELVAN. development-styles.css tenia seis reglas
//    de esta pantalla con los tokens viejos (--white-color, --border-color) y
//    tres bloques de tema `[data-theme="dark"]` a secas, sin su par dark-legacy:
//    en el oscuro manual los botones se quedaban con el aspecto del claro.
// 4. QUE EL HOOK DE JS SOBREVIVA. `company-select-button` ya no tiene una sola
//    regla propia, pero es la clase que usan selectCompany() y el cierre de
//    sesion para limpiar la marca `selected`. Perderla rompe el resaltado al
//    cambiar de empresa y no se ve en ninguna prueba de estilo.
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const leer = p => fs.readFileSync(p, 'utf8');

function soloCodigo(t) {
  return t
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ── WCAG 2.1, componiendo los rgba sobre su fondo opaco ANTES de medir ─────
function hexRgb(h) {
  if (typeof h !== 'string') return null;
  h = h.trim().replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
function rgbaDe(v) {
  const m = /rgba?\(([^)]+)\)/.exec(v || '');
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
const r2 = n => (n === null ? 'null' : n.toFixed(2) + ':1');

// El punto MAS CLARO de la animacion Vanta. No es un supuesto: es el inicio del
// degradado de la onda, y es el pixel contra el que hay que medir, porque es
// donde el texto blanco tiene menos contraste.
const VANTA_CLARO = '#a9bcd8';

const fallidos = [];
const registro = [];

function bloque893De(premium) {
  // Ancla en ASCII a proposito (los acentos se pelean con la codificacion de las
  // herramientas de edicion) y unica: antes del 893 no existia
  // `.kair-company-select` en ningun lado.
  const i = premium.indexOf('.kair-company-select{');
  if (i < 0) return null;
  // Cortar desde el `/*` que ABRE el comentario de cabecera. Si se corta en la
  // regla, el `/*` queda fuera y la prosa del comentario no se puede sanear: el
  // saneo de comentarios es lo que separa "una regla que repinta el icono" de
  // "un texto que explica que el icono no se repinta".
  return premium.slice(premium.lastIndexOf('/*', i));
}

function cuerpoDe(css, sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp('(?:^|[\\n};])[ \\t]*' + esc + '[ \\t]*\\{').exec(css);
  if (!m) return null;
  let depth = 0;
  for (let i = m.index + m[0].length - 1; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') { depth--; if (depth === 0) return css.slice(m.index + m[0].length - m[0].indexOf(sel[0]), i + 1); }
  }
  return null;
}
function cuerpo(css, sel) {
  const b = cuerpoDe(css, sel);
  return b ? b.slice(b.indexOf('{') + 1, b.lastIndexOf('}')) : null;
}
function decl(cuerpoCss, prop) {
  if (cuerpoCss === null) return null;
  const m = new RegExp('(?:^|;)\\s*' + prop.replace(/-/g, '\\-') + '\\s*:\\s*([^;]+)').exec(cuerpoCss);
  return m ? m[1].trim() : null;
}

// Los tokens por tema, LEIDOS del archivo. El orden importa: el bloque de `dark`
// esta despues del de `dark-legacy` en el archivo, y ambos emparejan con
// `[data-theme="dark"]` si no se ancla el selector completo.
function tokensDe(tokens, tema) {
  const out = {};
  let bloque;
  if (tema === 'root') {
    bloque = /:root\s*\{([\s\S]*?)\n\}/.exec(tokens);
  } else {
    const re = new RegExp('\\[data-theme="' + tema + '"\\][^{]*\\{([\\s\\S]*?)\\n\\}');
    bloque = re.exec(tokens);
  }
  if (!bloque) return out;
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(bloque[1])) !== null) out[m[1]] = m[2].trim();
  return out;
}

function evaluar(F) {
  const c = { n: 0, f: 0 };
  const chk = (cond, nombre, detalle) => {
    c.n++;
    registro.push({ n: nombre, c: !!cond });
    if (!cond) { c.f++; fallidos.push(nombre + (detalle ? ' :: ' + detalle : '')); }
  };

  const b893 = bloque893De(F.premium);
  chk(b893 !== null, 'shared/kair-premium.css tiene el bloque del 893');
  if (b893 === null) return c;

  const codigo893 = soloCodigo(b893);

  const tRoot = tokensDe(F.tokens, 'root');
  const tDark = tokensDe(F.tokens, 'dark');
  const tLeg = tokensDe(F.tokens, 'dark-legacy');
  const tPorTema = { light: tRoot, dark: tDark, legacy: tLeg };

  // ── 1 · VANTA SIGUE VIENDOSE ─────────────────────────────────────────────
  const cont = cuerpo(codigo893, '.kair-company-select');
  chk(cont !== null, 'el contenedor .kair-company-select existe', cont === null ? 'no se encontro la regla' : '');
  // El contenedor NO debe llevar `kair-premium`. Esa clase es el envoltorio de
  // PAGINA del premium (linea 22) y pinta fondo: --kair-canvas en claro y
  // #2d3748 en oscuro (linea 265). Montada sobre la animacion, la tapaba, y
  //.cancelarla con un `background:transparent` desde esta pantalla es
  // pelear con la cascada todos los dias en vez de atacar la causa.
  chk(/uiContainer\.className = 'kair-company-select';/.test(F.rend),
    'el contenedor se crea SIN la clase kair-premium');
  chk(!/uiContainer\.className = 'kair-premium/.test(F.rend),
    'renderer.js no le cuelga la clase de pagina al overlay');
  chk(decl(cont, 'background') === null,
    'el contenedor no declara fondo: sin la clase de pagina ya no hay nada que tapar',
    String(decl(cont, 'background')));
  chk(decl(cont, 'font-family') !== null,
    'el contenedor declara su propia fuente: antes la prestaba .kair-premium');
  chk(/\.kair-company-select \*[^{]*\{[^}]*box-sizing:border-box/.test(codigo893),
    'el contenedor declara su propio box-sizing (border-box): antes lo prestaba .kair-premium');
  chk(decl(cuerpo(codigo893, '.kair-company-select .kair-mod'), 'display') === 'flex',
    'la tarjeta declara su propia base: las bases de .kair-mod viven bajo .kair-premium');
  chk(decl(cont, 'z-index') !== null, 'el contenedor queda encima de la animacion');
  // El centrado. La pantalla vieja lo tenia en linea, en el JS
  // (`uiContainer.style.alignItems = 'center'`), y se perdio al semar todos los
  // estilos en linea. Un contenedor sin `align-items` sigue siendo valido: llaves
  // cuadradas, sin color prohibido, sin error de sintaxis. Solo se nota mirando.
  chk(decl(cont, 'align-items') === 'center',
    'el contenedor centra en horizontal (sin esto el panel se pega a la izquierda)', String(decl(cont, 'align-items')));
  chk(decl(cuerpo(codigo893, '.kair-company-select__panel'), 'width') === '100%',
    'el panel ocupa todo su max-width: como hijo de un flex centrado mide lo que su texto necesita',
    String(decl(cuerpo(codigo893, '.kair-company-select__panel'), 'width')));
  chk(decl(cuerpo(codigo893, '.kair-company-select__list'), 'width') === '100%',
    'la lista de tarjetas tambien, o queda mas angosta que el panel',
    String(decl(cuerpo(codigo893, '.kair-company-select__list'), 'width')));

  // ── 2 · CONTRASTE DEL TEXTO SOBRE VANTA ──────────────────────────────────
  // El panel se compone sobre el punto mas claro de Vanta y recien ahi se mide.
  const panelCuerpo = cuerpo(codigo893, '.kair-company-select__panel');
  chk(panelCuerpo !== null, 'el panel de vidrio existe');
  const panelFondo = decl(panelCuerpo, 'background');
  const vantaBajoPanel = hexTxt(pintar(panelFondo, VANTA_CLARO));
  chk(vantaBajoPanel !== null, 'el panel declara un fondo medible', String(panelFondo));

  const textosVidrio = [
    ['__label', '.kair-company-select__label', 'el rotulo'],
    ['__title', '.kair-company-select__title', 'el titulo'],
    ['__sub', '.kair-company-select__sub', 'el subtitulo del panel']
  ];
  for (const [, sel, nombre] of textosVidrio) {
    const col = decl(cuerpo(codigo893, sel), 'color');
    const r = ratio(col, vantaBajoPanel);
    chk(r !== null && r >= 4.5, 'contraste de ' + nombre + ' sobre el panel compuesto', r2(r) + ' (min 4.5)');
  }

  // El contraste crudo, sin panel, es lo que la pantalla anterior tenia.
  const directoBlanco = ratio('#ffffff', VANTA_CLARO);
  chk(directoBlanco !== null && directoBlanco < 4.5,
    'el blanco directo sobre Vanta NO alcanzaria (por eso el panel es obligatorio)',
    r2(directoBlanco));
  const conPanel = ratio('#ffffff', vantaBajoPanel);
  chk(conPanel !== null && conPanel >= 4.5,
    'el blanco con el panel compuesto si alcanza 4.5', r2(conPanel));

  // ── 3 · LA TARJETA, EN LOS TRES TEMAS ────────────────────────────────────
  const modCuerpo = cuerpo(codigo893, '.kair-company-select .kair-mod');
  chk(modCuerpo !== null, 'la tarjeta se define en el bloque del 893');
  chk(decl(modCuerpo, 'border-radius') === '20px',
    'la tarjeta usa el radio del premium (--kair-radius-card = 20px)', String(decl(modCuerpo, 'border-radius')));
  chk(decl(modCuerpo, 'background') === 'var(--kair-card,#FFFFFF)',
    'el fondo de la tarjeta va por token, para que cambie solo con el tema', String(decl(modCuerpo, 'background')));
  // Un <button> no hereda la fuente del contenedor. Antes la tomaba de
  // `.kair-premium`; sin esa clase hay que declararla en el contenedor.
  chk(/var\(--kair-font-ui/.test(decl(cont, 'font-family') || ''),
    'el contenedor fija la fuente: un <button> no la hereda sola y no hay clase de pagina que se la preste',
    String(decl(cont, 'font-family')));
  // La sombra es lo que separa la tarjeta del panel de vidrio. Sin ella el
  // borde --kair-line no alcanza y la tarjeta se funde con el panel. El alfa se
  // mira en la DECLARACION de --kcs-shadow (en el contenedor), no en la tarjeta,
  // que solo la referencia.
  const alfaDe = v => {
    const m = /rgba?\(([^)]*)\)/.exec(v || '');
    if (!m) return null;
    const p = m[1].split(',');
    return p.length >= 4 ? parseFloat(p[3]) : 1;
  };
  const sombraClaro = decl(cont, '--kcs-shadow');
  const sombraOscuro = decl(cuerpo(codigo893, '[data-theme^="dark"] .kair-company-select'), '--kcs-shadow');
  chk(/box-shadow:var\(--kcs-shadow\)/.test(modCuerpo || ''),
    'la tarjeta se apoya en la sombra del componente', String(decl(modCuerpo, 'box-shadow')));
  chk(alfaDe(sombraClaro) > 0,
    'la sombra en claro tiene alfa real: sin ella la tarjeta se funde con el panel', String(sombraClaro));
  chk(alfaDe(sombraOscuro) > 0,
    'la sombra en oscuro tiene alfa real', String(sombraOscuro));

  const nombreCuerpo = cuerpo(codigo893, '.kair-company-select .kair-mod__name');
  chk(decl(nombreCuerpo, 'color') === 'var(--kair-ink,#14213D)',
    'el nombre va por --kair-ink, que ya cambia solo por tema', String(decl(nombreCuerpo, 'color')));

  const subClaro = decl(cuerpo(codigo893, '.kair-company-select .kair-mod__sub'), 'color');
  chk(subClaro === '#66707f',
    'el subtitulo en claro es el gris medido, NO --kair-muted', String(subClaro));
  chk(subClaro !== 'var(--kair-muted)' && subClaro !== '#748096',
    'el subtitulo en claro no vuelve a --kair-muted (3.98:1, no alcanza)');

  // El subtitulo oscuro NO puede caer al #66707f fijo: la regla clara esta mas
  // abajo en el archivo y empata en especificidad con la oscura de la linea 295,
  // asi que sin una contraparte explicita el texto oscuro queda gris sobre gris.
  const subOscuro = decl(cuerpo(codigo893, '[data-theme^="dark"] .kair-company-select .kair-mod__sub'), 'color');
  chk(subOscuro !== null && /var\(--kair-muted/.test(subOscuro),
    'el subtitulo tiene contraparte oscura por token', String(subOscuro));

  for (const tema of ['light', 'dark', 'legacy']) {
    const t = tPorTema[tema];
    const card = t['kair-card'];
    const ink = t['kair-ink'];
    const muted = t['kair-muted'];
    chk(!!card && !!ink && !!muted, 'el tema ' + tema + ' define card, ink y muted');
    if (!card || !ink || !muted) continue;

    const rNombre = ratio(ink, card);
    chk(rNombre >= 4.5, 'contraste del nombre en ' + tema + ': ' + ink + ' sobre ' + card, r2(rNombre));

    const colSub = tema === 'light' ? subClaro : muted;
    const rSub = ratio(colSub, card);
    chk(rSub >= 4.5, 'contraste del subtitulo en ' + tema + ': ' + colSub + ' sobre ' + card, r2(rSub));
  }

  // ── 4 · LOS OSCUROS USAN EL SELECTOR CORRECTO ────────────────────────────
  chk(/\[data-theme\^="dark"\]/.test(codigo893), 'el bloque usa [data-theme^="dark"]');
  const selectoresDel893 = codigo893.split('\n').filter(l => l.indexOf('[data-theme') >= 0);
  chk(selectoresDel893.every(l => l.indexOf('[data-theme="dark"]') < 0),
    'ninguna regla del 893 usa [data-theme="dark"] a secas (el oscuro manual es dark-legacy y no es alias)',
    selectoresDel893.filter(l => l.indexOf('[data-theme="dark"]') >= 0).join(' | '));
  chk((codigo893.match(/!important/g) || []).length === 0,
    'el bloque no usa !important (gana por especificidad)');

  // El icono NO se repinta aqui: .kair-mod__icon ya tiene su propia variante
  // oscura medida en el archivo (rgba(77,166,255,.08) sobre #8cc6ff). Repintarlo
  // con --kair-blue-soft lo cambiaria por algo que nadie midio.
  // El icono ya no se puede prestar de `.kair-premium`, asi que aqui se declara
  // entero. Lo que NO se puede es cambiarle los valores: la variante oscura
  // que usa ya la midio el premium (rgba(77,166,255,.08) con texto #8cc6ff),
  // y de claro se conserva el par #2057B8 sobre #EDF3FC que da 6.04:1.
  chk(/\.kair-company-select \.kair-mod__icon\{[^}]*background:#EDF3FC;color:#2057B8/.test(codigo893),
    'el icono declara su base de claro con los valores del premium (#2057B8 sobre #EDF3FC)',
    (codigo893.match(/[^\n]*\.kair-mod__icon\{[^}]*\}/) || [''])[0]);
  chk(codigo893.includes('[data-theme^="dark"] .kair-company-select .kair-mod__icon{background:rgba(77,166,255,.08);color:#8cc6ff}'),
    'el icono conserva la variante oscura ya medida por el premium');
  const rIcono = ratio('#2057B8', '#EDF3FC');
  chk(rIcono !== null && rIcono >= 3,
    'el icono es un componente no textual: 3:1 contra su propio fondo', r2(rIcono) + ' (min 3)');

  // ── 5 · LOS ESTILOS VIEJOS NO VOLVIERON ─────────────────────────────────
  const dev = soloCodigo(F.dev);
  for (const muerto of [
    '#welcome-placeholder',
    '#company-selection',
    '.company-select-button',
    '.company-select-button:hover',
    '.company-select-button.selected'
  ]) {
    chk(dev.indexOf(muerto + ' {') < 0, 'development-styles.css ya no declara ' + muerto);
  }
  chk(/\[data-theme="dark"\]\s+\.company-select-button/.test(dev) === false,
    'development-styles.css ya no tiene los tres [data-theme="dark"] del boton');
  chk(/\[data-theme="dark"\]\s*#welcome-placeholder/.test(dev) === false,
    'development-styles.css ya no tiene el bloque 27 (welcome oscuro)');
  chk(/\[data-theme="dark"\]\s*#company-selection/.test(dev) === false,
    'development-styles.css ya no tiene el bloque 28 (company selection oscuro)');
  // Los vecindos se comprueban en el texto CRUDO, no en `soloCodigo`: los
  // bloques 25 y 26 son comentarios, y `soloCodigo` se los come. Si se buscaran
  // ahi, el check pasaria siempre y no wouldnaria estar protegiendo nada.
  chk(F.dev.indexOf('25. Main canvas company home') >= 0,
    'el bloque 25, que NO es de esta pantalla, sigue intacto');
  chk(F.dev.indexOf('26. Company home content') >= 0,
    'el bloque 26, que NO es de esta pantalla, sigue intacto');
  // Las llaves tienen que seguir cuadrando: se quitaron tres bloques a mano.
  const llavesDev = (dev.match(/\{/g) || []).length - (dev.match(/\}/g) || []).length;
  chk(llavesDev === 0, 'development-styles.css queda con las llaves balanceadas', 'delta ' + llavesDev);

  // ── 6 · EL HOOK DE JS SOBREVIVE ─────────────────────────────────────────
  const rend = F.rend;
  chk(rend.indexOf("uiContainer.className = 'kair-company-select'") >= 0,
    'renderer.js construye el contenedor del componente');
  chk(rend.indexOf("button.className = 'kair-mod company-select-button'") >= 0,
    'la tarjeta conserva la clase company-select-button (hook del JS)');
  const usos = rend.split("querySelectorAll('.company-select-button')").length - 1;
  chk(usos === 2, 'los dos usos de querySelectorAll del hook siguen en pie', String(usos));
  chk(rend.indexOf('companySelectionDiv') < 0, 'ya no queda el contenedor viejo');
  chk(rend.indexOf("welcomePlaceholder.id = 'welcome-placeholder'") < 0,
    'ya no se crea #welcome-placeholder');
  chk(/welcomePlaceholder\.style\.textShadow/.test(rend) === false,
    'ya no queda el text-shadow que disimulaba el 1.93:1');
  // Lo del 862 no se toca: es la salida del admin sin empresas.
  chk(rend.indexOf('No hay empresas registradas') >= 0, 'el mensaje de admin del 862 sigue');
  chk(rend.indexOf('No tienes empresas asignadas') >= 0, 'el mensaje de usuario del 862 sigue');
  chk(rend.indexOf("goConfig.className = 'kair-btn'") >= 0,
    'el boton de salida del admin usa kair-btn');

  // ── 7 · SIN CARACTERES PROHIBIDOS Y CON SELLO ───────────────────────────
  chk(F.premium.indexOf('\uFFFD') < 0 && F.dev.indexOf('\uFFFD') < 0 && F.rend.indexOf('\uFFFD') < 0,
    'ninguno de los archivos escritos trae U+FFFD');
  chk(!/[\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff\uac00-\ud7af]/.test(F.premium + F.dev + F.rend + F.idx),
    'ninguno de los archivos escritos trae CJK, cirilico o hangul');
  chk(/shared\/kair-premium\.css\?v=20261015-empresa893/.test(F.idx),
    'index.html lleva el sello nuevo del premium (sin el, Electron sirve el CSS viejo del cache)');
  chk(/shared\/kair-premium\.css\?v=20261014-panel885/.test(F.idx) === false,
    'el sello anterior se retiro');

  return c;
}

const F0 = {
  premium: leer(path.join(APP, 'shared/kair-premium.css')),
  tokens: leer(path.join(APP, 'shared/kair-design-tokens.css')),
  dev: leer(path.join(APP, 'development-styles.css')),
  rend: leer(path.join(APP, 'renderer.js')),
  idx: leer(path.join(APP, 'index.html'))
};
const clonar = f => ({ premium: f.premium, tokens: f.tokens, dev: f.dev, rend: f.rend, idx: f.idx });

const checks = [];

// ── Mutaciones: cada una tiene que hacer FALLAR al menos un check ─────────
const MUT = [
  ['el overlay vuelve a llevar la clase de pagina, que pinta fondo',
    f => { f.rend = f.rend.replace("uiContainer.className = 'kair-company-select'", "uiContainer.className = 'kair-premium kair-company-select'"); }],
  ['alguien vuelve a colgar el bloque de la clase de pagina',
    f => { f.premium = f.premium.replace('.kair-company-select{--kcs-shadow:', '.kair-premium .kair-company-select{--kcs-shadow:'); }],
  ['el contenedor vuelve a declarar un fondo opaco',
    f => { f.premium = f.premium.replace('.kair-company-select{--kcs-shadow:0 8px 24px rgba(20,33,61,.16);', '.kair-company-select{background:var(--kair-canvas,#FBFCFB);--kcs-shadow:0 8px 24px rgba(20,33,61,.16);'); }],
  ['el contenedor se queda sin fuente y cae en la del sistema',
    f => { f.premium = f.premium.replace(";font-family:var(--kair-font-ui,'DM Sans',system-ui,sans-serif);color:#fff;", ';color:#fff;'); }],
  ['el contenedor se queda sin box-sizing propio',
    f => { f.premium = f.premium.replace('.kair-company-select *,.kair-company-select *::before,.kair-company-select *::after{box-sizing:border-box}', '.kair-company-select *{box-sizing:content-box}'); }],
  ['se pierde el centrado y el panel se pega a la izquierda',
    f => { f.premium = f.premium.replace('flex-direction:column;justify-content:center;align-items:center;', 'flex-direction:column;justify-content:center;'); }],
  ['el panel pierde el ancho y se mide por su texto',
    f => { f.premium = f.premium.replace('.kair-company-select__panel{width:100%;max-width:640px;', '.kair-company-select__panel{'); }],
  ['la lista pierde el ancho y queda mas angosta que el panel',
    f => { f.premium = f.premium.replace('.kair-company-select__list{width:100%;max-width:640px;display:grid;', '.kair-company-select__list{display:grid;'); }],
  ['el panel de vidrio se aclara y el texto deja de leerse',
    f => { f.premium = f.premium.replace('background:rgba(13,21,38,.62)', 'background:rgba(13,21,38,.20)'); }],
  ['el titulo se pone del color de Vanta',
    f => { f.premium = f.premium.replace('letter-spacing:-.01em;color:#fff}', 'letter-spacing:-.01em;color:#a9bcd8}'); }],
  ['el subtitulo vuelve a --kair-muted, que no alcanza',
    f => { f.premium = f.premium.replace('.kair-mod__sub{display:block;font-size:12px;line-height:1.35;color:#66707f}', '.kair-mod__sub{display:block;font-size:12px;line-height:1.35;color:var(--kair-muted,#748096)}'); }],
  ['se quita la contraparte oscura del subtitulo',
    f => { f.premium = f.premium.replace('[data-theme^="dark"] .kair-company-select .kair-mod__sub{color:var(--kair-muted,#a0a0a0)}\n', ''); }],
  ['se quita la variante oscura del icono',
    f => { f.premium = f.premium.replace('[data-theme^="dark"] .kair-company-select .kair-mod__icon{background:rgba(77,166,255,.08);color:#8cc6ff}\n', ''); }],
  ['el nombre deja de ir por token y se fija al color claro',
    f => { f.premium = f.premium.replace('margin-bottom:2px;color:var(--kair-ink,#14213D)}', 'margin-bottom:2px;color:#14213D}'); }],
  ['la tarjeta vuelve al radio de 14px',
    f => { f.premium = f.premium.replace('.kair-company-select .kair-mod{display:flex;flex-direction:row;align-items:flex-start;gap:13px;width:100%;text-align:left;padding:17px 18px;border-radius:20px;', '.kair-company-select .kair-mod{display:flex;flex-direction:row;align-items:flex-start;gap:13px;width:100%;text-align:left;padding:17px 18px;border-radius:14px;'); }],
  ['la tarjeta deja de declarar su base flex (el icono y el texto se apilan)',
    f => { f.premium = f.premium.replace('.kair-company-select .kair-mod{display:flex;flex-direction:row;', '.kair-company-select .kair-mod{display:block;flex-direction:row;'); }],
  ['la tarjeta deja de llevar sombra y se funde con el panel',
    f => { f.premium = f.premium.replace('box-shadow:var(--kcs-shadow);cursor:pointer;', 'box-shadow:none;cursor:pointer;'); }],
  ['la sombra se conserva pero con alfa cero',
    f => { f.premium = f.premium.replace('--kcs-shadow:0 8px 24px rgba(20,33,61,.16)', '--kcs-shadow:0 8px 24px rgba(20,33,61,0)'); }],
  ['se usa [data-theme="dark"] a secas',
    f => { f.premium = f.premium.replace('[data-theme^="dark"] .kair-company-select{', '[data-theme="dark"] .kair-company-select{'); }],
  ['se repinta el icono en claro con algo que nadie midio',
    f => { f.premium = f.premium.replace('.kair-company-select .kair-mod__icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#EDF3FC;color:#2057B8}', '.kair-company-select .kair-mod__icon{width:36px;height:36px;background:#F5E0FF;color:#6b3fb8}'); }],
  ['vuelve una regla vieja del boton',
    f => { f.dev = f.dev.replace('/* 24 · Company select button', '.company-select-button {\n  min-width: 150px;\n}\n\n/* 24 · Company select button'); }],
  ['vuelve el bloque oscuro sin par dark-legacy',
    f => { f.dev = f.dev.replace('/* 25. Main canvas company home', '[data-theme="dark"] .company-select-button {\n  background: #333;\n}\n\n/* 25. Main canvas company home'); }],
  ['la tarjeta pierde el hook que usa el JS',
    f => { f.rend = f.rend.replace("button.className = 'kair-mod company-select-button'", "button.className = 'kair-mod'"); }],
  ['renderer.js deja de montar el componente',
    f => { f.rend = f.rend.replace("uiContainer.className = 'kair-company-select'", "uiContainer.className = 'kair-dashboard'"); }],
  ['se pierde el mensaje de salida del admin (el del 862)',
    f => { f.rend = f.rend.replace('No hay empresas registradas', 'Nada todavia'); }],
  ['se pierde el sello del premium en index.html',
    f => { f.idx = f.idx.replace('?v=20261015-empresa893', '?v=20261014-panel885'); }]
];;;

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

// ── Corrida base ───────────────────────────────────────────────────────────
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