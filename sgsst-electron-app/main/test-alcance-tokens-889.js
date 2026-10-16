// 📦889 · El shell no puede perder --kair-card por culpa de un CSS de módulo.
//
// ── Por qué este test existe ────────────────────────────────────────────
// `index.html` carga `shared/kair-design-tokens.css` en la línea 71 y, DESPUÉS
// (líneas 490 y 552), carga CSS de submódulos. Cualquier `:root` que declare en
// esos archivos define sus tokens para TODO el documento, no solo para su
// módulo: los tokens oscuros ya no llegaban nunca a la pantalla.
//
// El síntoma era desconcertante porque era a medias: `--kair-ink` sí tomaba su
// valor oscuro (el texto se veía claro) mientras `--kair-card` se quedaba en
// `#ffffff`. De ahí las tarjetas de "Explorar submódulos" blancas con el rótulo
// casi invisible encima.
//
// ── Qué hace ────────────────────────────────────────────────────────────
// Lee el orden REAL de estilosheets de `index.html`, extrae cada declaración de
// `--kair-card` con su selector y resuelve la cascada para `<html
// data-theme="dark">`. Si el ganador no es el valor oscuro compartido, rojo.

const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8');

// ── Tokens que este test vigila. Son los que la app usa para superficies.
const VIGILADOS = ['--kair-card', '--kair-canvas', '--kair-ink', '--kair-line'];

// Valor oscuro que cada token debe resolver en el shell. Salen de los bloques
// [data-theme="dark"] / [data-theme="dark-legacy"] de kair-design-tokens.css.
const ESPERADO_OSCURO = {
  '--kair-card': '#384151',
  '--kair-canvas': '#1a202c',
  '--kair-ink': '#e9ecef',
  '--kair-line': '#4a5568'
};

// ── Especificidad de los selectores que aparecen en este repo.
// only-clase (0,1,0) · :root (0,1,0) · :root[attr] (0,2,0)
function especificidad(sel) {
  const s = sel.trim();
  if (/^:root\s*\[/.test(s)) return 2;
  if (/^:root$/.test(s)) return 1;
  if (/^\[/.test(s)) return 1;
  if (/^\./.test(s)) return 1;   // clase: no matchea <html>
  return 0;
}

// ¿El selector matchea <html data-theme="dark">?
function matcheaHtml(sel) {
  const s = sel.trim();
  if (/^\./.test(s)) return false;                 // .kair-app, .kair-rad-module...
  if (/^:root\[data-theme=["']?dark["']?\]$/.test(s)) return true;
  if (/^:root$/.test(s)) return true;               // :root global, sin atributo
  if (/^\[data-theme=["']?dark["']?\]$/.test(s)) return true;
  return false;
}

// Extrae (selector, token, valor) de las declaraciones de un CSS.
// Un bloque puede traer una LISTA de selectores (`[data-theme="dark"],
// :root[data-theme="dark"] { ... }`); cada parte compite por separado, así que
// se emite una entrada por parte. Si no, la lista entera no matchearía nada y
// el token parecería no estar definido.
function declaraciones(css) {
  const out = [];
  const s = String(css);
  const n = s.length;

  // Se recorren las llaves con un contador de profundidad en vez de con un regex.
  // El regex anterior `(^|})\s*([^{}@]+?)\s*\{([^}]*)\}` solo sacaba la PRIMERA
  // regla de cada archivo: al consumir el `}` de un bloque, el siguiente match
  // exigía otro `}` antes del próximo `{`, y el `{` se cruzaba primero. El test
  // pasaba de casualidad — el `@import` de cabecera bloqueaba el primer match y
  // el parser devolvía el bloque 2, que era justo el oscuro.
  //
  // Se saltan los comentarios (no son selectores) y los bloques `@media`/etc.
  // completos: las reglas dentro de un media query no compiten por el mismo
  // elemento en este test, que mira `<html data-theme="dark">`.
  let i = 0, bloque = 0, prefijo = 0;
  while (i < n) {
    if (s.startsWith('/*', i)) {
      const f = s.indexOf('*/', i + 2);
      i = f === -1 ? n : f + 2;
      // Un comentario de cabecera NO es parte del selector que viene después:
      // hay que mover el arranque con él, o el selector queda pegado al texto.
      prefijo = i;
      continue;
    }
    if (s[i] === '{') {
      const sel = s.slice(prefijo, i).trim();
      const ini = i + 1;
      let depth = 1;
      i = ini;
      while (i < n && depth > 0) {
        if (s.startsWith('/*', i)) {
          const f = s.indexOf('*/', i + 2);
          i = f === -1 ? n : f + 2;
          continue;
        }
        if (s[i] === '{') depth++;
        else if (s[i] === '}') depth--;
        i++;
      }
      const cuerpo = s.slice(ini, i - 1);
      if (sel) {
        bloque++;
        const partes = sel.split(',').map((x) => x.trim()).filter(Boolean);
        const decl = /(--kair-[a-z0-9-]+)\s*:\s*([^;]+);/gi;
        let d;
        while ((d = decl.exec(cuerpo))) {
          for (const p of partes) {
            // `pos` es el orden de la REGLA dentro del archivo: a igual
            // especificidad gana la última, que es lo que hace un navegador.
            out.push({ sel: p, token: d[1].toLowerCase(), valor: d[2].trim(), pos: bloque });
          }
        }
      }
      prefijo = i;
      continue;
    }
    if (s[i] === '@') {
      // Regla at: saltar su nombre y su bloque entero.
      const j = s.indexOf('{', i);
      if (j === -1) break;
      i = j + 1;
      let depth = 1;
      while (i < n && depth > 0) {
        if (s.startsWith('/*', i)) {
          const f = s.indexOf('*/', i + 2);
          i = f === -1 ? n : f + 2;
          continue;
        }
        if (s[i] === '{') depth++;
        else if (s[i] === '}') depth--;
        i++;
      }
      prefijo = i;
      continue;
    }
    i++;
  }
  return out;
}

// Orden real de estilosheets locales que carga el shell.
function ordenEstilos() {
  const idx = leer('index.html');
  const hrefs = [];
  const re = /<link[^>]+rel=["']stylesheet["'][^>]*>/g;
  let m;
  while ((m = re.exec(idx))) {
    const h = /href=["']([^"']+)["']/.exec(m[0]);
    if (!h) continue;
    const href = h[1];
    if (/^https?:/i.test(href)) continue;          // CDN: no define tokens
    hrefs.push(href.split('?')[0]);
  }
  return hrefs;
}

// ── Reglas de FONDO sobre un selector pelado ──────────────────────────────
// Acotar los `:root` no alcanzaba: el bug real era una REGLA global. Un
// `.kair-module { background: ... }` sin scope en un CSS de submódulo compite
// contra el `.kair-module` de `shared/kair-components.css` a la misma
// especificidad (0,1,0), así que gana la hoja que `index.html` carga más
// tarde. `shared/kair-components.css` va en la línea 72 y
// `revision-alta-direccion.css` en la 490: ganaba la del módulo.
//
// Y el valor que ganaba era `--kair-bg`, que shared/kair-design-tokens.css NO
// define: lo pisa el `:root` global de `evaluacion-inicial-view.css` (línea 26
// de index.html), cargado en la línea 18 y con valor claro `#FBFCFB`. Por eso el
// token llegaba "correcto" (`--kair-card` sí lo define el archivo canónico) y el
// fondo salía blanco igual.
function reglasFondoPeladas(css) {
  const out = [];
  const re = /(^|})\s*([^{}@]+?)\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (!/background(-color)?\s*:/i.test(m[3])) continue;
    for (const sel of m[2].split(',').map((s) => s.trim()).filter(Boolean)) {
      if (sel === '.kair-module') out.push(sel);
    }
  }
  return out;
}

// `.kair-card` es el mismo caso, pero por BORDE y RADIO en vez de fondo:
// `inspeccion.css` lo declaraba global y ganaba la cascada de
// `shared/kair-components.css`. Con la regla global ganaban dos valores que no
// corresponden en oscuro:
//   · `border: 1px solid var(--kair-border)` -> `--kair-border` solo existe en el
//     `:root` global de `evaluacion-inicial-view.css` y vale `#E8EBEE`, un color
//     CLARO: por eso la tarjeta salía con un borde blanco en modo oscuro.
//   · `border-radius: var(--kair-radius-md)` -> ese token está declarado dentro
//     del bloque `.kair-app` de `inspeccion.css` y no existe afuera: la propiedad
//     caía a su valor inicial, 0, y por eso las puntas salían cuadradas.
// Aquí se vigila la REGLA, no el valor: que ningún CSS de submódulo vuelva a
// declarar `.kair-card` pelado.
function reglasCardPeladas(css) {
  const out = [];
  const re = /(^|})\s*([^{}@]+?)\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (!/border\s*:|border-radius\s*:/i.test(m[3])) continue;
    for (const sel of m[2].split(',').map((s) => s.trim()).filter(Boolean)) {
      if (sel === '.kair-card') out.push(sel);
    }
  }
  return out;
}

function cargarDelShell(patron, fn) {
  const malos = [];
  for (const rel of ordenEstilos()) {
    const abs = path.join(APP, rel);
    if (!fs.existsSync(abs)) continue;
    const css = fn(rel) || fs.readFileSync(abs, 'utf8');
    if (patron(css).length) malos.push(rel);
  }
  return malos;
}

// Devuelve los archivos cargados por el shell que tienen un `.kair-module`
// global con fondo, usando el mapa de contenidos que le pase el llamador.
function fondoGlobalDeKairModule(contenidoDe) {
  return cargarDelShell(reglasFondoPeladas, contenidoDe);
}

function resolver(token) {
  const candidatos = [];
  ordenEstilos().forEach((rel, orden) => {
    const abs = path.join(APP, rel);
    if (!fs.existsSync(abs)) return;
    for (const d of declaraciones(fs.readFileSync(abs, 'utf8'))) {
      if (d.token !== token) continue;
      if (!matcheaHtml(d.sel)) continue;
      candidatos.push({ ...d, orden, fuente: rel });
    }
  });
  if (!candidatos.length) return null;
  // Mayor especificidad gana; si empata, gana el archivo más tardío y, dentro del
  // mismo archivo, la ÚLTIMA regla — que es como resuelve un navegador. El
  // desempate va en DESCENDENTE porque el ganador es `candidatos[0]`: antes
  // ordenaba ascendente y devolvía el primero, contradiciendo este mismo
  // comentario, y por eso un `:root` de cabecera ganaba a un `[data-theme="dark"]`
  // declarado más abajo en el MISMO archivo.
  candidatos.sort((a, b) => {
    const sa = especificidad(a.sel), sb = especificidad(b.sel);
    if (sa !== sb) return sb - sa;
    if (a.orden !== b.orden) return b.orden - a.orden;
    return b.pos - a.pos;
  });
  return candidatos[0];
}

// ── Checks ──────────────────────────────────────────────────────────────
const checks = [];
function chk(nombre, ok, extra) {
  checks.push({ n: nombre, c: !!ok, e: extra || '' });
}

for (const token of VIGILADOS) {
  const g = resolver(token);
  const ok = g && g.valor.toLowerCase() === ESPERADO_OSCURO[token];
  chk(
    token + ' resuelve al valor oscuro compartido en <html data-theme="dark">',
    ok,
    g ? `gana "${g.valor}" desde "${g.sel}" en ${g.fuente}` : 'nadie lo define'
  );
}

// El parser se reescribió porque el anterior sacaba UNA sola regla por archivo.
// Estas dos comprobaciones son las que impiden que esa clase de defecto vuelva
// sin que nadie lo note (el test daba verde mientras el parser no veía nada).
const CSS_TRES_REGLAS = '/* c */:root { --kair-card: #111111; } .a { --kair-ink: #222222; } :root[data-theme="dark"] { --kair-card: #333333; }';
const declTres = declaraciones(CSS_TRES_REGLAS);
chk('declaraciones() ve TODAS las reglas del archivo, no solo la primera',
    declTres.length === 3, `${declTres.length} declaraciones de 3 reglas`);
const declConComentarioFalso = declaraciones(
  '/* :root[data-theme="dark"] { --kair-card: #ffffff; } */\n' + CSS_TRES_REGLAS);
chk('declaraciones() ignora los bloques que viven dentro de un comentario',
    declConComentarioFalso.length === declTres.length,
    `${declConComentarioFalso.length} vs ${declTres.length} con un bloque falso dentro de un comentario`);
chk('declaraciones() no pega el texto de un comentario al selector',
    !!declTres[0] && declTres[0].sel === ':root',
    `primer selector: ${JSON.stringify(declTres[0] && declTres[0].sel)}`);

// El bug era que un CSS de módulo ganaba. Se comprueba explícitamente que el
// ganador NO sea un archivo de submódulo.
for (const rel of [
  'modules/gestion-peligros/inspecciones/inspeccion.css',
  'modules/verificacion/revision-alta-direccion/revision-alta-direccion.css'
]) {
  const g = resolver('--kair-card');
  chk('--kair-card no lo gana ' + rel, g && g.fuente !== rel,
      g ? `gana ${g.fuente}` : 'sin ganador');
}

// Y que los tokens de módulo sigan disponibles dentro de su propio scope:
// acotar el `:root` no puede dejar sin variables a la vista que lo usa.
// El selector se ata a su PRIMERA declaración para no confundirlo con otro
// bloque `.kair-app {` del mismo archivo (el de layout).
const insp = leer('modules/gestion-peligros/inspecciones/inspeccion.css');
chk('inspeccion.css define sus tokens sobre .kair-app',
    /\.kair-app\s*\{[^}]*--kair-primary:\s*#174ea6/i.test(insp));
chk('inspeccion.css ya no declara :root global',
    !/^\s*:root\s*\{/m.test(insp));
const rad = leer('modules/verificacion/revision-alta-direccion/revision-alta-direccion.css');
chk('revision-alta-direccion.css define sus tokens sobre .kair-rad-module',
    /\.kair-rad-module\s*\{[^}]*--kair-primary:\s*#174ea6/i.test(rad));
chk('revision-alta-direccion.css ya no declara :root global',
    !/^\s*:root\s*\{/m.test(rad));
chk('revision-alta-direccion.css conserva su bloque oscuro',
    /\[data-theme="dark"\]\s*\.kair-rad-module/.test(rad));

// El invariante que de verdad importa: NINGUNA hoja del shell puede poner fondo
// sobre un `.kair-module` pelado. El de `shared/kair-components.css` usa
// `var(--kair-card)`, que es un token canónico con variante oscura; cualquier
// otro valor para ese selector viene de un CSS de submódulo y no la tiene.
const globalsConFondo = fondoGlobalDeKairModule(() => null);
chk('ninguna hoja del shell pone fondo sobre un .kair-module global',
    globalsConFondo.length === 0,
    globalsConFondo.join(', '));
chk('revision-alta-direccion.css acota su .kair-module a .kair-rad-module',
    /\.kair-rad-module\s+\.kair-module\s*\{/.test(rad)
    && !/(^|[},])\s*\.kair-module\s*\{/m.test(rad));

// Mismo invariante para `.kair-card`, que es lo que producía el borde claro y
// las puntas cuadradas que reportó el owner.
const cardPeladas = cargarDelShell(reglasCardPeladas, () => null);
chk('ninguna hoja del shell declara borde/radio sobre un .kair-card global',
    cardPeladas.length === 0,
    cardPeladas.join(', '));
chk('inspeccion.css acota su .kair-card a .kair-app',
    /\.kair-app\s+\.kair-card\s*\{/.test(insp)
    && !/(^|[},])\s*\.kair-card\s*\{/m.test(insp));
// El radio del módulo tiene que existir DENTRO de su scope: si `--kair-radius-md`
// se declara fuera de `.kair-app`, la tarjeta vuelve a caer a 0.
chk('--kair-radius-md se declara dentro del bloque .kair-app',
    /\.kair-app\s*\{[^}]*--kair-radius-md:\s*10px/i.test(insp));

// ── 1.1.2 · El tema tiene que CRUZAR la frontera del iframe ────────────────
// `roles-responsabilidades-view.html` se carga como iframe
// (`roles-responsabilidades-logic.js:23`). Un iframe es otro documento: el
// atributo `data-theme` que el shell aplica a SU <html> no se hereda ni por
// cascada ni por estilo. El padre sí lo difunde a todos los iframes
// (`scripts/theme-manager.js:246`), pero hace falta el lado del iframe: el
// listener de `theme-changed` y el handshake `get-theme-request`.
//
// Sin esto el bloque `[data-theme="dark"]` del CSS no casa nunca y la vista se
// queda en claro aunque el shell esté en oscuro. Es un fallo silencioso: el CSS
// está correcto, lo que falta es el atributo que lo dispara.
const rrHtml = leer('modules/recursos/roles-responsabilidades/roles-responsabilidades-view.html');
const rrJs = leer('modules/recursos/roles-responsabilidades/roles-responsabilidades-viewer.js');
const rrCss = leer('modules/recursos/roles-responsabilidades/roles-responsabilidades-view.css');
chk('1.1.2: el viewer define la sincronizacion de tema', /function\s+rrInitThemeSync\s*\(/.test(rrJs));
chk('1.1.2: la sincronizacion se ejecuta (no solo se declara)',
    /rrInitThemeSync\(\);/.test(rrJs));
chk('1.1.2: escucha el theme-changed del padre', /d\.type\s*===\s*['"]theme-changed['"]/.test(rrJs));
chk('1.1.2: pide el tema al padre al cargar (nace despues del tema)',
    /type:\s*['"]get-theme-request['"]/.test(rrJs));
chk('1.1.2: aplica el valor recibido al <html> del iframe',
    /documentElement\.setAttribute\(\s*['"]data-theme['"]/.test(rrJs));
// Los TROS modos, segun renderer.js:754 y theme-manager.js:251:
//   sistema + SO oscuro -> data-theme="dark"
//   OSCURO MANUAL       -> data-theme="dark-legacy"   <-- no es un alias
//   claro               -> sin atributo
//
// Y las TRES formas de mensaje que la app manda de verdad, porque
// `scripts/theme-manager.js` NO esta cargado en el shell:
//   · get-theme-response -> { theme: <resuelto> }                      renderer.js:2006
//   · theme-changed      -> { theme: <preferencia>, effectiveTheme: <resuelto> }
//     renderer.js:1756 y renderer.js:7445
//
// Si el codigo solo acepta 'dark' como entrada, el oscuro manual —que llega
// como 'dark-legacy'— se toma por claro y se le QUITA el atributo: la vista se
// queda blanca con el shell en oscuro. Ese fue el bug real.
chk('1.1.2: rrApplyTheme lee effectiveTheme (forma de theme-changed)',
    /effectiveTheme/.test(rrJs));
chk('1.1.2: acepta dark-legacy como valor de entrada, no solo dark',
    /pref\s*===\s*['"]dark['"]\s*\|\|\s*pref\s*===\s*['"]dark-legacy['"]/.test(rrJs));
// El `\)?` tolera que el ternario venga parentizado: el codigo real es
// `(pref === 'dark') ? 'dark-legacy' : 'dark'`, no `pref === 'dark' ? ...`.
chk('1.1.2: el oscuro MANUAL se distingue del de sistema (dark-legacy)',
    /pref\s*===\s*['"]dark['"]\s*\)?\s*\?\s*['"]dark-legacy['"]\s*:\s*['"]dark['"]/.test(rrJs));
chk('1.1.2: el tema claro se aplica como ausencia de atributo',
    /removeAttribute\(\s*['"]data-theme['"]/.test(rrJs));
chk('1.1.2: el CSS tiene bloque oscuro para los dos temas',
    /\[data-theme="dark"\][\s\S]*kair-rr-body/.test(rrCss) &&
    /\[data-theme="dark-legacy"\][\s\S]*kair-rr-body/.test(rrCss));
chk('1.1.2: el CSS y el JS tienen cache-bust (si no, el fix no llega)',
    /roles-responsabilidades-view\.css\?v=/.test(rrHtml) &&
    /roles-responsabilidades-viewer\.js\?v=/.test(rrHtml));
// Los botones sin variante de color heredaban `buttonface` del navegador, un
// gris claro, y quedaban como pastillas claras sobre el fondo oscuro.
chk('1.1.2: los botones sin variante de color tienen version oscura',
    /\[data-theme="dark"\][^{]*\.kair-rr-btn:not\(\[class\*=/.test(rrCss));

// ── 1.1.3 · Asignación de Recursos: las TRES vistas en iframe ──────────────
// `presupuesto-logic.js:30-40` monta las tres vistas con `renderIframeView`.
// Las tres importan `shared/kair-design-tokens.css`, cuyo oscuro vive en
// `:root[data-theme="dark"]`: sin el atributo en SU <html>, ese bloque no casa y
// la vista se queda en claro con el shell en oscuro.
//
// El fix va en un archivo compartido, `shared/kair-iframe-theme.js`, y las tres
// lo cargan con `?v=`. Ese `?v=` no es cosmetico: sin el, Electron sirve el
// script desde cache y el fix no llega nunca a la vista.
const kairIframe = leer('shared/kair-iframe-theme.js');
const pHome = leer('modules/recursos/presupuesto/presupuesto-home.html');
const pSel = leer('modules/recursos/presupuesto/presupuesto-selector.html');
const pGes = leer('modules/recursos/presupuesto/presupuesto-gestion.html');
const pLogic = leer('modules/recursos/presupuesto/presupuesto-logic.js');

chk('1.1.3: existe el modulo compartido de tema para iframes',
    /kairIframeApplyTheme/.test(kairIframe));
chk('1.1.3: el modulo compartido lee effectiveTheme (theme-changed)',
    /effectiveTheme/.test(kairIframe));
chk('1.1.3: el modulo compartido acepta dark-legacy como entrada',
    /pref\s*===\s*['"]dark['"]\s*\|\|\s*pref\s*===\s*['"]dark-legacy['"]/.test(kairIframe));
chk('1.1.3: el modulo compartido distingue el oscuro manual del de sistema',
    /pref\s*===\s*['"]dark['"]\s*\)?\s*\?\s*['"]dark-legacy['"]\s*:\s*['"]dark['"]/.test(kairIframe));
chk('1.1.3: el modulo compartido pide el tema al padre al cargar',
    /get-theme-request/.test(kairIframe));
for (const [nombre, txt] of [
  ['presupuesto-home.html', pHome],
  ['presupuesto-selector.html', pSel],
  ['presupuesto-gestion.html', pGes]
]) {
  chk('1.1.3: ' + nombre + ' carga el modulo de tema con cache-bust',
      /kair-iframe-theme\.js\?v=[^"]+"/.test(txt));
}
// Y los tres iframe del modulo con sello vigente: si el HTML se sirve del cache
// viejo, el script nuevo nunca llega. El sello lleva prefijo de familia
// (`PRESUP-`, `PRE-`), asi que la fecha va despues de un prefijo opcional.
const prefijo = '\\?v=(?:[A-Z]+-)?20261014';
const iframeSrcs = (pLogic.match(/presupuesto-[a-z]+\.html\?v=[^']+/g) || []);
chk('1.1.3: los tres iframe se piden con cache-bust propio',
    iframeSrcs.length >= 4 && iframeSrcs.every((s) => new RegExp(prefijo).test(s)),
    iframeSrcs.length + ' src: ' + iframeSrcs.join(' | '));

// ── Mutaciones: el test tiene que morder ────────────────────────────────
// Cada mutación rompe UNA cosa y el test tiene que ponerse rojo. Si alguna no
// lo hace, el test no está vigilando lo que dice vigilar.
const original = {
  idx: leer('index.html'),
  insp: leer('modules/gestion-peligros/inspecciones/inspeccion.css'),
  rad: leer('modules/verificacion/revision-alta-direccion/revision-alta-direccion.css'),
  tok: leer('shared/kair-design-tokens.css'),
  rrHtml: leer('modules/recursos/roles-responsabilidades/roles-responsabilidades-view.html'),
  rrJs: leer('modules/recursos/roles-responsabilidades/roles-responsabilidades-viewer.js'),
  rrCss: leer('modules/recursos/roles-responsabilidades/roles-responsabilidades-view.css'),
  kairIframe: leer('shared/kair-iframe-theme.js'),
  pHome: leer('modules/recursos/presupuesto/presupuesto-home.html'),
  pSel: leer('modules/recursos/presupuesto/presupuesto-selector.html'),
  pGes: leer('modules/recursos/presupuesto/presupuesto-gestion.html'),
  pLogic: leer('modules/recursos/presupuesto/presupuesto-logic.js')
};

function correr() {
  return correrCon({
    idx: leer('index.html'),
    insp: leer('modules/gestion-peligros/inspecciones/inspeccion.css'),
    rad: leer('modules/verificacion/revision-alta-direccion/revision-alta-direccion.css'),
    tok: leer('shared/kair-design-tokens.css'),
    rrHtml: leer('modules/recursos/roles-responsabilidades/roles-responsabilidades-view.html'),
    rrJs: leer('modules/recursos/roles-responsabilidades/roles-responsabilidades-viewer.js'),
    rrCss: leer('modules/recursos/roles-responsabilidades/roles-responsabilidades-view.css'),
    kairIframe: leer('shared/kair-iframe-theme.js'),
    pHome: leer('modules/recursos/presupuesto/presupuesto-home.html'),
    pSel: leer('modules/recursos/presupuesto/presupuesto-selector.html'),
    pGes: leer('modules/recursos/presupuesto/presupuesto-gestion.html'),
    pLogic: leer('modules/recursos/presupuesto/presupuesto-logic.js')
  });
}

function correrCon(f) {
  const cand = [];
  const est = [];
  f.idx.replace(/<link[^>]+rel=["']stylesheet["'][^>]*>/g, (tag) => {
    const h = /href=["']([^"']+)["']/.exec(tag);
    if (!h || /^https?:/i.test(h[1])) return tag;
    est.push(h[1].split('?')[0]);
    return tag;
  });
  est.forEach((rel, orden) => {
    let css;
    if (rel.endsWith('inspeccion.css')) css = f.insp;
    else if (rel.endsWith('revision-alta-direccion.css')) css = f.rad;
    else if (rel.endsWith('kair-design-tokens.css')) css = f.tok;
    else {
      const abs = path.join(APP, rel);
      if (!fs.existsSync(abs)) return;
      css = fs.readFileSync(abs, 'utf8');
    }
    for (const d of declaraciones(css)) {
      if (VIGILADOS.indexOf(d.token) === -1) continue;
      if (!matcheaHtml(d.sel)) continue;
      cand.push({ ...d, orden });
    }
  });
  const g = {};
  for (const t of VIGILADOS) {
    const cs = cand.filter((c) => c.token === t);
    if (!cs.length) { g[t] = null; continue; }
    cs.sort((a, b) => {
      const sa = especificidad(a.sel), sb = especificidad(b.sel);
      if (sa !== sb) return sb - sa;
      return a.orden - b.orden;
    });
    g[t] = cs[0];
  }
  return Object.keys(ESPERADO_OSCURO).every(
    (t) => g[t] && g[t].valor.toLowerCase() === ESPERADO_OSCURO[t]
  ) && /\.kair-app\s*\{[^}]*--kair-primary:\s*#174ea6/i.test(f.insp)
    && !/^\s*:root\s*\{/m.test(f.insp)
    && /\.kair-rad-module\s*\{[^}]*--kair-primary:\s*#174ea6/i.test(f.rad)
    && !/^\s*:root\s*\{/m.test(f.rad)
    && /\[data-theme="dark"\]\s*\.kair-rad-module/.test(f.rad)
    && !/(^|[},])\s*\.kair-module\s*\{/m.test(f.rad)
    && fondoGlobalDeKairModule((rel) => {
      if (rel.endsWith('inspeccion.css')) return f.insp;
      if (rel.endsWith('revision-alta-direccion.css')) return f.rad;
      if (rel.endsWith('kair-design-tokens.css')) return f.tok;
      return null;
    }).length === 0
    && cargarDelShell(reglasCardPeladas, (rel) => {
      if (rel.endsWith('inspeccion.css')) return f.insp;
      if (rel.endsWith('revision-alta-direccion.css')) return f.rad;
      if (rel.endsWith('kair-design-tokens.css')) return f.tok;
      return null;
    }).length === 0
    && /\.kair-app\s+\.kair-card\s*\{/.test(f.insp)
    && /\.kair-app\s*\{[^}]*--kair-radius-md:\s*10px/i.test(f.insp)
    && /function\s+rrInitThemeSync\s*\(/.test(f.rrJs)
    && /rrInitThemeSync\(\);/.test(f.rrJs)
    && /d\.type\s*===\s*['"]theme-changed['"]/.test(f.rrJs)
    && /type:\s*['"]get-theme-request['"]/.test(f.rrJs)
    && /documentElement\.setAttribute\(\s*['"]data-theme['"]/.test(f.rrJs)
    && /effectiveTheme/.test(f.rrJs)
    && /pref\s*===\s*['"]dark['"]\s*\|\|\s*pref\s*===\s*['"]dark-legacy['"]/.test(f.rrJs)
    && /pref\s*===\s*['"]dark['"]\s*\)?\s*\?\s*['"]dark-legacy['"]\s*:\s*['"]dark['"]/.test(f.rrJs)
    && /removeAttribute\(\s*['"]data-theme['"]/.test(f.rrJs)
    && /\[data-theme="dark"\][\s\S]*kair-rr-body/.test(f.rrCss)
    && /\[data-theme="dark-legacy"\][\s\S]*kair-rr-body/.test(f.rrCss)
    && /roles-responsabilidades-view\.css\?v=/.test(f.rrHtml)
    && /roles-responsabilidades-viewer\.js\?v=/.test(f.rrHtml)
    && /\[data-theme="dark"\][^{]*\.kair-rr-btn:not\(\[class\*=/.test(f.rrCss)
    && /kairIframeApplyTheme/.test(f.kairIframe)
    && /effectiveTheme/.test(f.kairIframe)
    && /pref\s*===\s*['"]dark['"]\s*\|\|\s*pref\s*===\s*['"]dark-legacy['"]/.test(f.kairIframe)
    && /pref\s*===\s*['"]dark['"]\s*\)?\s*\?\s*['"]dark-legacy['"]\s*:\s*['"]dark['"]/.test(f.kairIframe)
    && /get-theme-request/.test(f.kairIframe)
    && [f.pHome, f.pSel, f.pGes].every((t) => /kair-iframe-theme\.js\?v=[^"]+"/.test(t))
    && (() => {
      const srcs = f.pLogic.match(/presupuesto-[a-z]+\.html\?v=[^']+/g) || [];
      return srcs.length >= 4 && srcs.every((s) => /\?v=(?:[A-Z]+-)?20261014/.test(s));
    })();
}

const MUTACIONES = [
  ['inspeccion.css vuelve a declarar :root global',
   () => ({ ...original, insp: original.insp.replace(/^\.kair-app\s*\{/m, ':root {') })],
  ['inspeccion.css deja de declarar sus tokens',
   () => ({
     ...original,
     // Se ancla en el texto completo para no alcanzar el otro `.kair-app {`
     // (el de layout, línea 90).
     insp: original.insp.replace('.kair-app {\n  --kair-primary: #174ea6;',
                                  '.kair-nada {\n  --kair-primary: #174ea6;')
   })],
  ['inspeccion.css se carga antes de los tokens compartidos',
   () => ({
     ...original,
     idx: original.idx.replace('shared/kair-design-tokens.css', 'ZZ-tokens.css')
   })],
  ['revision-alta-direccion.css vuelve a declarar :root global',
   () => ({ ...original, rad: original.rad.replace(/^\.kair-rad-module\s*\{/m, ':root {') })],
  ['revision-alta-direccion.css pierde el bloque oscuro',
   () => ({ ...original, rad: original.rad.replace(/\[data-theme="dark"\]\s*\.kair-rad-module/, '.kair-rad-module') })],
  ['el valor oscuro compartido de --kair-card se aclara a blanco',
   () => ({
     ...original,
     tok: original.tok.replace(/--kair-card:\s*#384151/i, '--kair-card: #ffffff')
   })],
  ['el bloque oscuro compartido sube de especificidad y deja de ganar',
   () => ({
     ...original,
     tok: original.tok.replace(/:root\[data-theme="dark"\]/g, ':root[data-theme="dark"] .nada')
   })],
  ['revision-alta-direccion.css vuelve a soltar un .kair-module global (el bug real)',
   () => ({
     ...original,
     rad: original.rad.replace('.kair-rad-module .kair-module {', '.kair-module {')
   })],
  ['inspeccion.css vuelve a soltar un .kair-card global (borde claro + puntas cuadradas)',
   () => ({
     ...original,
     insp: original.insp.replace('.kair-app .kair-card {', '.kair-card {')
   })],
  ['--kair-radius-md se mueve fuera del scope .kair-app',
   () => ({
     ...original,
     insp: original.insp.replace(/  --kair-radius-md: 10px;/, '')
   })],
  ['1.1.2: el viewer deja de pedir el tema al padre (nace tarde y se queda en claro)',
   () => ({ ...original, rrJs: original.rrJs.replace(/type:\s*'get-theme-request'/, "type: 'nada'") })],
  ['1.1.2: el viewer deja de escuchar theme-changed',
   () => ({ ...original, rrJs: original.rrJs.replace(/=== 'theme-changed'/, "=== 'otro-cosa'") })],
  ['1.1.2: el boton sin variante vuelve al gris claro del navegador',
   () => ({
     ...original,
     // Con /g: el bloque declara el selector dos veces (dark y dark-legacy) y
     // cambiar solo la primera deja la otra intacta, así que la mutación no
     // muerde y el test pasa en verde sin detectar nada.
     rrCss: original.rrCss.replace(/\.kair-rr-btn:not\(\[class\*=/g, '.kair-btn-x:not([class*=')
   })],
  ['1.1.2: el JS pierde el cache-bust y el fix no llega al navegador',
   () => ({ ...original, rrHtml: original.rrHtml.replace('roles-responsabilidades-viewer.js?v=', 'roles-responsabilidades-viewer.js') })],
  ['1.1.2: el oscuro manual se confunde con el de sistema (dark en vez de dark-legacy)',
   () => ({
     ...original,
     rrJs: original.rrJs.replace("pref === 'dark') ? 'dark-legacy' : 'dark'", "pref === 'dark') ? 'dark' : 'dark'")
   })],
  ['1.1.2: el codigo deja de aceptar dark-legacy como entrada (el bug real)',
   () => ({
     ...original,
     rrJs: original.rrJs.replace("pref === 'dark' || pref === 'dark-legacy'", "pref === 'dark'")
   })],
  ['1.1.2: el codigo deja de leer effectiveTheme (no procesa theme-changed)',
   () => ({ ...original, rrJs: original.rrJs.replace(/effectiveTheme/g, 'otraCosa') })],
  ['1.1.3: el modulo compartido deja de aceptar dark-legacy (el bug real)',
   () => ({
     ...original,
     kairIframe: original.kairIframe.replace("pref === 'dark' || pref === 'dark-legacy'", "pref === 'dark'")
   })],
  ['1.1.3: una de las tres vistas deja de cargar el modulo de tema',
   () => ({
     ...original,
     pGes: original.pGes.replace(/<script src="\.\.\/\.\.\/\.\.\/shared\/kair-iframe-theme\.js\?v=[^"]+"><\/script>/, '')
   })],
  ['1.1.3: una vista carga el modulo de tema SIN cache-bust',
   () => ({
     ...original,
     pHome: original.pHome.replace('kair-iframe-theme.js?v=', 'kair-iframe-theme.js')
   })],
  ['1.1.3: los iframe de presupuesto se piden con el sello viejo (cache)',
   () => ({
     ...original,
     // El sello real lleva prefijo de familia (`?v=PRESUP-20261014-...`), asi que
     // el patron tiene que tolerarlo; con `?v=20261014` a secas no encuentra
     // nada y la mutacion pasa sin romper nada.
     pLogic: original.pLogic.replace(/\?v=(?:[A-Z]+-)?20261014/g, '?v=VIEJO')
   })]
];

const baseOk = correr();
let mutacionesOk = 0, mutacionesVacias = 0;
for (const [nombre, aplicar] of MUTACIONES) {
  const r = correrCon(aplicar());
  if (r === baseOk) {
    mutacionesVacias++;
    console.log('  VACIA: ' + nombre);
  } else if (!r) mutacionesOk++;                  // se puso rojo: correcto
  else console.log('  ! la mutación pasó sin romper: ' + nombre);
}

// ── Salida ──────────────────────────────────────────────────────────────
for (const c of checks) {
  if (!c.c) console.log('FAIL ' + c.n + (c.e ? '  -> ' + c.e : ''));
}
const verdes = checks.filter((c) => c.c).length;
console.log(
  `${verdes}/${checks.length} checks base, ${mutacionesOk}/${MUTACIONES.length} mutaciones, ` +
  `${mutacionesVacias} vacías`
);
if (verdes !== checks.length || mutacionesVacias) {
  console.log('EN ROJO');
  process.exit(1);
}
console.log('OK');
