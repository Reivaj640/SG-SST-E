'use strict';
// 894 · El submódulo 1.2.1 "Programa de Capacitación Anual" tiene que APLICAR los
// temas Sistema y Oscuro, y tiene que LEERSE en los dos.
//
// EL DEFECTO, EN UNA FRASE.
//
// El shell escribe `data-theme` en <html> y en los iframes. Este submódulo NO es un
// iframe: su contenido se inyecta en linea con fetch + innerHTML
// (capacitaciones-logic.js:184). Al contenedor solo se le anadia la clase, nunca el
// atributo. Consecuencia exacta:
//
//   - sus 47 reglas `[data-theme="dark"]` NO PODIAN calzar nunca. Codigo correcto,
//     escrito y jamas ejecutado. Eran las "47 reglas muertas" que ya estaba
//     registradas como deuda, sin saber que era esto.
//   - su `isDark` (capacitaciones-logic.js:1543) leia `=== 'dark'` sobre un atributo
//     inexistente: SIEMPRE false. Los graficos se pintaban con la paleta de tema
//     claro sobre tarjetas ya oscuras.
//   - el fondo de la pagina leia `--k-bg-app` (#f8f9fa), que solo cambia dentro del
//     bloque muerto: el marco se quedaba blanco en los dos temas oscuros.
//
// LO QUE SE VIA. Las tarjetas SI salian oscuras, y por eso el defecto era tan
// confuso: las tarjetas no leen los tokens del modulo, leen los globales --kair-*
// de :root, y esos si se actualizan. Solo se rompian el fondo, el texto del cuerpo
// y los graficos. Medido sobre los colores reales de las capturas:
//
//   donut "19 actividades"  #14213d sobre #292929 (dark-legacy)   1.10:1
//   donut "19 actividades"  #14213d sobre #384151 (dark)          1.55:1
//   "En tu radar"           #6c757d sobre #384151                 2.19:1
//
// El 1.10:1 es el numero gris lost del centro de la dona. Es practicamente
// invisible, y ninguna otra superficie de la app estaba asi.
//
// LO QUE ESTE TEST PROTEGE:
//
// 1. QUE EL BLOQUE OSCURO SIGA SIENDO ALCANZABLE. El arreglo fue pasar los 47
//    selectores a `[data-theme^="dark"]`. Si alguien los revierte a igualdad exacta,
//    el atributo vuelve a no calzar y el modulo se cae en silencio otra vez. Es el
//    check mas importante.
// 2. QUE dark-legacy CUENTE COMO OSCURO. No es un alias de dark: es otra paleta.
//    El selector de prefijo es lo que hace que las 47 reglas apliquen a las dos.
// 3. QUE EL ESPEJO NO SEA CIRCULAR. `_syncTheme()` tiene que LEER de
//    document.documentElement y ESCRIBIR en this.container. Si leyera del
//    contenedor, se realimentaria y quedaria en null para siempre: el defecto
//    original reentrada, con codigo nuevo.
// 4. QUE EL REPINTE NO VACIE LOS GRAFICOS. initializeCharts() recrea los graficos
//    con la paleta nueva pero con los datos en cero. Sin updateCharts() despues,
//    cambiar de tema deja los tres graficos vacios: se arregla la legibilidad y se
//    rompe el dato. Es la trampa de este arreglo.
// 5. QUE EL CONTRASTE SE MIDA, NO SE SUPONGA. Los ratios salen de los tokens
//    declarados en el propio CSS, no de una tabla escrita a mano.
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const leer = p => fs.readFileSync(p, 'utf8');

const RUTA_CSS = 'modules/recursos/capacitaciones/capacitaciones-view.css';
const RUTA_JS = 'modules/recursos/capacitaciones/capacitaciones-logic.js';
const RUTA_REND = 'renderer.js';
const RUTA_TOKENS = 'shared/kair-design-tokens.css';

function cargar() {
  return {
    css: leer(path.join(APP, RUTA_CSS)),
    js: leer(path.join(APP, RUTA_JS)),
    rend: leer(path.join(APP, RUTA_REND)),
    tok: leer(path.join(APP, RUTA_TOKENS))
  };
}

// ── WCAG 2.1 ────────────────────────────────────────────────────────────────
function hexRgb(h) {
  if (typeof h !== 'string') return null;
  h = h.trim().replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
function lum(rgb) {
  const a = rgb.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function ratio(fg, bg) {
  const a = hexRgb(fg); const b = hexRgb(bg);
  if (!a || !b) return null;
  const L1 = lum(a); const L2 = lum(b);
  const hi = L1 > L2 ? L1 : L2; const lo = L1 > L2 ? L2 : L1;
  return (hi + 0.05) / (lo + 0.05);
}

// ── Extraccion de un token dentro del bloque oscuro N-esimo ─────────────────
const BLOQUE_OSCURO = '.capacitaciones-container[data-theme^="dark"]';

function bloqueOscuro(css, n) {
  let i = -1;
  for (let k = 0; k <= n; k++) i = css.indexOf(BLOQUE_OSCURO, i + 1);
  if (i < 0) return null;
  return css.slice(i, css.indexOf('}', i));
}

// El selector de prefijo aparece en los 47 bloques, asi que "el segundo" no es
// necesariamente el de los tokens --kair-*. Hay que buscar el bloque que
// DECLARE la variable que se quiere leer.
function bloqueOscuroCon(css, nombre) {
  let i = -1;
  while (true) {
    i = css.indexOf(BLOQUE_OSCURO, i + 1);
    if (i < 0) return null;
    const cuerpo = css.slice(i, css.indexOf('}', i));
    if (cuerpo.includes(nombre + ':')) return cuerpo;
  }
}

function token(bloque, nombre) {
  if (!bloque) return null;
  const m = bloque.match(new RegExp(nombre.replace(/[-]/g, '\\-') + '\\s*:\\s*([^;]+);'));
  return m ? m[1].trim() : null;
}

// Bloque por selector exacto, para leer tokens de un tema concreto.
function bloqueDe(css, selector) {
  const i = css.indexOf(selector);
  if (i < 0) return null;
  return css.slice(i, css.indexOf('}', i));
}

function eolDe(texto) {
  const b = Buffer.from(texto, 'utf8');
  let crlf = 0; let lf = 0;
  for (let i = 0; i < b.length; i++) if (b[i] === 10) { if (i > 0 && b[i - 1] === 13) crlf++; else lf++; }
  return { crlf, lf };
}

const registro = [];
const fallidos = [];
let n = 0;
function chk(nombre, cond, detalle) {
  n++;
  const ok = !!cond;
  registro.push({ n: nombre, c: ok });
  if (!ok) fallidos.push(detalle ? nombre + ' -> ' + detalle : nombre);
  return ok;
}

// ── Evaluacion ──────────────────────────────────────────────────────────────
function evaluar(F) {
  const b0 = bloqueOscuroCon(F.css, '--k-bg-app');   // bloque de tokens --k-*
  const b1 = bloqueOscuroCon(F.css, '--kair-card');   // bloque de tokens --kair-*

  // ---- 1. El bloque oscuro tiene que seguir siendo alcanzable -------------
  const exactos = (F.css.match(/\.capacitaciones-container\[data-theme="dark"\]/g) || []).length;
  chk('CSS · ningun selector de tema quedo con igualdad exacta', exactos === 0, 'quedan ' + exactos + ' literales [data-theme="dark"]');

  const prefijos = (F.css.match(/\.capacitaciones-container\[data-theme\^="dark"\]/g) || []).length;
  chk('CSS · los 47 bloques usan el selector de prefijo', prefijos === 47, 'hay ' + prefijos + ' y se esperaban 47');

  chk('CSS · el bloque oscuro de --k-* existe', !!b0, 'no se encontro el bloque con los tokens --k-*');
  chk('CSS · el bloque oscuro de --kair-* existe', !!b1, 'no se encontro el bloque con los tokens --kair-*');

  // ---- 2. Tokens: el fondo tiene que volverse oscuro -----------------------
  const bgApp = token(b0, '--k-bg-app');
  const bgCard = token(b0, '--k-bg-card');
  const textMain = token(b0, '--k-text-main');
  const textMuted = token(b0, '--k-text-muted');
  const kairCard = token(b1, '--kair-card');

  chk('tokens · --k-bg-app se redefine en oscuro', !!bgApp && bgApp.toLowerCase() !== '#f8f9fa', 'sigue en ' + bgApp);
  chk('tokens · --kair-card se redefine en oscuro', !!kairCard, 'no se encuentra --kair-card en el segundo bloque');

  // ---- 3. Contraste real, leido de los tokens del propio CSS ---------------
  const pares = [
    ['texto principal sobre tarjeta', textMain, bgCard, 4.5],
    ['texto apagado sobre tarjeta', textMuted, bgCard, 4.5],
    ['texto principal sobre canvas', textMain, bgApp, 4.5],
    ['texto apagado sobre canvas', textMuted, bgApp, 4.5],
    ['numero del donut (isDark = #e9ecef)', '#e9ecef', bgCard, 4.5],
    ['subtitulo del donut (isDark = #adb5bd)', '#adb5bd', bgCard, 4.5],
    ['ticks de ejes (isDark = #adb5bd)', '#adb5bd', bgCard, 4.5]
  ];
  for (const [nombre, fg, bg, min] of pares) {
    const r = ratio(fg, bg);
    chk('contraste · ' + nombre + ' >= ' + min + ':1',
      r !== null && r >= min,
      r === null ? ('no se pudo medir ' + fg + ' sobre ' + bg) : (Math.round(r * 100) / 100 + ':1'));
  }

  // ---- 3b. El tema oscuro del modulo tiene DOS paletas, no una -------------
  // El prefijo [^="dark"] hace que las 47 reglas apliquen a `dark` Y a
  // `dark-legacy`, pero el bloque que las declara solo trae los valores de
  // `dark`, que es la azul. Sin un bloque propio, 1.2.1 se pintaba de azul
  // dentro del shell gris que dibuja la captura del home de Recursos.
  const LEGACY = '.capacitaciones-container[data-theme="dark-legacy"] {';
  const bLegacy = bloqueDe(F.css, LEGACY);
  chk('paleta · el bloque dark-legacy existe', !!bLegacy,
    '1.2.1 se pinta con la paleta azul de dark dentro de un shell gris');

  if (bLegacy) {
    const lCanvas = token(bLegacy, '--k-bg-app');
    const lCard = token(bLegacy, '--k-bg-card');
    const lMain = token(bLegacy, '--k-text-main');
    const lMuted = token(bLegacy, '--k-text-muted');
    const lKairCard = token(bLegacy, '--kair-card');
    const lKairCanvas = token(bLegacy, '--kair-canvas');

    // La fuente de verdad es el shell: kair-design-tokens.css. Si alguien cambia
    // la paleta del shell, este check falla hasta que el modulo la siga.
    const shell = bloqueDe(F.tok, ':root[data-theme="dark-legacy"] {');
    chk('paleta · se encontro el bloque dark-legacy del shell', !!shell);
    const pares = [
      ['--k-bg-app', lCanvas, '--kair-canvas'],
      ['--k-bg-card', lCard, '--kair-card'],
      ['--k-text-main', lMain, '--kair-ink'],
      ['--k-text-muted', lMuted, '--kair-muted'],
      ['--kair-card', lKairCard, '--kair-card'],
      ['--kair-canvas', lKairCanvas, '--kair-canvas']
    ];
    for (const p of pares) {
      const delShell = token(shell, p[2]);
      chk('paleta · ' + p[0] + ' sigue al shell (' + p[2] + ' = ' + delShell + ')',
        delShell !== null && p[1] === delShell,
        'el modulo declara ' + p[1] + ' y el shell declara ' + delShell);
    }

    // Y lo contrario: el legacy no puede traer los azules de dark.
    const azulCanvas = token(bloqueOscuroCon(F.css, '--k-bg-app'), '--k-bg-app');
    const azulCard = token(bloqueOscuroCon(F.css, '--k-bg-card'), '--k-bg-card');
    chk('paleta · el legacy NO hereda el canvas azul de dark',
      lCanvas !== azulCanvas, 'los dos son ' + lCanvas);
    chk('paleta · el legacy NO hereda la tarjeta azul de dark',
      lCard !== azulCard, 'las dos son ' + lCard);

    // Contraste real de la paleta neutral.
    const paresLegacy = [
      ['texto principal sobre tarjeta', lMain, lCard],
      ['texto apagado sobre tarjeta', lMuted, lCard],
      ['texto principal sobre canvas', lMain, lCanvas],
      ['texto apagado sobre canvas', lMuted, lCanvas],
      ['donut sobre tarjeta (isDark = #e9ecef)', '#e9ecef', lCard],
      ['ticks sobre tarjeta (isDark = #adb5bd)', '#adb5bd', lCard]
    ];
    for (const p of paresLegacy) {
      const r = ratio(p[1], p[2]);
      chk('contraste legacy · ' + p[0] + ' >= 4.5:1',
        r !== null && r >= 4.5,
        r === null ? 'no se pudo medir' : (Math.round(r * 100) / 100 + ':1'));
    }

    // Orden de cascada: misma especificidad, gana el ultimo.
    const iLegacy = F.css.indexOf(LEGACY);
    const reglasAzules = [
      '.capacitaciones-container[data-theme^="dark"] .kair-progress-bar {',
      '.capacitaciones-container[data-theme^="dark"] .cap-radar-item {',
      '.capacitaciones-container[data-theme^="dark"] .cap-radar-evidencias {'
    ];
    for (const sel of reglasAzules) {
      const iAzul = F.css.indexOf(sel);
      chk('paleta · el legacy pisa a "' + sel.slice(45, 70) + '..."',
        iAzul > 0 && iLegacy > iAzul,
        'el bloque dark-legacy quedo ANTES de la regla azul: no la pisa');
    }
    chk('paleta · existen las 3 superficies legacy',
      /\.capacitaciones-container\[data-theme="dark-legacy"\][^{]*\.kair-progress-bar[^{]*\{[^}]*#242424/.test(F.css)
      && /\.capacitaciones-container\[data-theme="dark-legacy"\][^{]*\.cap-radar-item[^{]*\{[^}]*#333333/.test(F.css)
      && /\.capacitaciones-container\[data-theme="dark-legacy"\][^{]*\.cap-radar-evidencias[^{]*\{[^}]*#242424/.test(F.css),
      'las superficies del legacy siguen con el azul #232b3a / #3a4356');

    // El bloque legacy declara su propio selector exacto, asi que no puede
    // arrastrar ni al tema claro ni a `dark`.
    chk('paleta · el legacy se declara con su selector exacto',
      /^\.capacitaciones-container\[data-theme="dark-legacy"\] \{/m.test(F.css),
      'dark-legacy tiene que declararse exacto: con el prefijo-matcharia dark tambien');
  }

  // ---- 4. El espejo, y que no sea circular --------------------------------
  chk('JS · existe _syncTheme()', /_syncTheme\(\)\s*\{/.test(F.js));
  chk('JS · _syncTheme lee de document.documentElement',
    /_syncTheme\(\)\s*\{[\s\S]{0,320}?document\.documentElement\.getAttribute\('data-theme'\)/.test(F.js),
    'no lee el atributo de <html>');
  chk('JS · el espejo no lee del propio contenedor (seria circular)',
    !/_syncTheme\(\)\s*\{[\s\S]{0,320}?this\.container\.getAttribute/.test(F.js),
    '_syncTheme lee de this.container: se realimenta y queda en null');
  chk('JS · _syncTheme escribe el atributo en el contenedor',
    /this\.container\.setAttribute\('data-theme'/.test(F.js));
  chk('JS · _syncTheme borra el atributo cuando el tema es null',
    /_syncTheme\(\)\s*\{[\s\S]{0,400}?this\.container\.removeAttribute\('data-theme'\)/.test(F.js));

  // ---- 5. El observador y el repinte sin perder datos ----------------------
  chk('JS · existe _watchTheme()', /_watchTheme\(\)\s*\{/.test(F.js));
  chk('JS · el observador escucha el atributo data-theme',
    /attributeFilter:\s*\['data-theme'\]/.test(F.js));
  chk('JS · el observador mira documentElement',
    /this\._themeObserver\.observe\(document\.documentElement/.test(F.js));

  const cuerpoObs = /_themeObserver = new MutationObserver\(\(\) => \{([\s\S]*?)\n {4}\}\);/.exec(F.js);
  chk('JS · se puede aislar el cuerpo del observador', !!cuerpoObs);
  const obs = cuerpoObs ? cuerpoObs[1] : '';
  chk('JS · el observador recrea los graficos', /this\.initializeCharts\(\)/.test(obs),
    'sin initializeCharts() los graficos conservan la paleta anterior');
  chk('JS · el observador recarga los datos despues de recrear',
    /this\.initializeCharts\(\)[\s\S]*this\.updateCharts\(\)/.test(obs),
    'initializeCharts() deja los datos en cero: sin updateCharts() se vacian');
  chk('JS · initializeCharts() no se solapa con updateCharts()',
    !/this\.updateCharts\(\)[\s\S]{0,60}this\.initializeCharts\(\)/.test(obs),
    'el orden es recrear y luego volcar datos');

  // ---- 6. isDark tiene que reconocer los dos oscuros -----------------------
  chk('JS · isDark usa prefijo, no igualdad exacta',
    /startsWith\('dark'\)/.test(F.js),
    'con === "dark" el tema dark-legacy se trataria como claro otra vez');
  chk('JS · no queda la igualdad exacta del defecto original',
    !/getAttribute\('data-theme'\)\s*===\s*'dark'/.test(F.js),
    'vuelve la lectura que siempre daba false');

  // ---- 7. Ciclo de vida ---------------------------------------------------
  chk('JS · render() invoca el espejo', /classList\.add\('capacitaciones-container'\);[\s\S]{0,300}?this\._syncTheme\(\)/.test(F.js),
    'sin llamar al espejo en render() el contenedor arranca sin atributo');
  chk('JS · render() registra el observador',
    /classList\.add\('capacitaciones-container'\);[\s\S]{0,300}?this\._watchTheme\(\)/.test(F.js));
  chk('JS · destroy() desconecta el observador',
    /destroy\(\)\s*\{[\s\S]*?this\._themeObserver\.disconnect\(\)/.test(F.js),
    'sin desconectar, cada recarga del modulo deja un observador colgando');
  chk('JS · el constructor inicializa _themeObserver a null',
    /this\._themeObserver = null;/.test(F.js));

  // ---- 8. No regresion: este arreglo no debio tocar el shell ---------------
  chk('renderer.js · sigue sin escribir data-theme en un contenedor de submódulo',
    !/capacitaciones-container\)?\.setAttribute\('data-theme'/.test(F.rend),
    'el espejo debe vivir en el modulo, no en el shell');
  chk('renderer.js · el shell sigue escribiendo en documentElement',
    /document\.documentElement\.setAttribute\('data-theme'/.test(F.rend));

  // ---- 9. EOL duro --------------------------------------------------------
  const eCss = eolDe(F.css); const eJs = eolDe(F.js); const eRend = eolDe(F.rend);
  chk('EOL · capacitaciones-view.css sigue en LF puro', eCss.crlf === 0 && eCss.lf > 0, 'CRLF=' + eCss.crlf);
  chk('EOL · capacitaciones-logic.js sigue en LF puro', eJs.crlf === 0 && eJs.lf > 0, 'CRLF=' + eJs.crlf);
  chk('EOL · renderer.js sigue en CRLF puro', eRend.crlf > 0 && eRend.lf === 0, 'LF=' + eRend.lf);

  // ---- 10. Caracteres prohibidos -----------------------------------------
  const mal = /[\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff\uac00-\ud7af]/g;
  chk('caracteres · sin CJK, cirilico ni hangul en el CSS',
    !(mal.test(F.css)), 'el CSS tiene caracteres prohibidos');
  mal.lastIndex = 0;
  chk('caracteres · sin CJK, cirilico ni hangul en el JS',
    !(mal.test(F.js)), 'el JS tiene caracteres prohibidos');
  chk('caracteres · sin U+FFFD (senal de escritura daniada)',
    F.js.indexOf('\uFFFD') < 0 && F.css.indexOf('\uFFFD') < 0);

  return { n, f: fallidos.length };
}

// ── Mutaciones ──────────────────────────────────────────────────────────────
const F0 = cargar();

function clonar(f) { return { css: f.css, js: f.js, rend: f.rend, tok: f.tok }; }

const MUT = [
  ['se revierte UN selector al patron de igualdad exacta',
    f => { f.css = f.css.replace('[data-theme^="dark"]', '[data-theme="dark"]'); }],
  ['se revierten todos los selectores al patron de igualdad exacta',
    f => { f.css = f.css.split('[data-theme^="dark"]').join('[data-theme="dark"]'); }],
  ['el bloque oscuro vuelve a dejar --k-bg-app en el color claro',
    f => { f.css = f.css.replace('--k-bg-app: #1a202c;', '--k-bg-app: #f8f9fa;'); }],
  ['el texto apagado del modo oscuro vuelve al gris de tema claro',
    f => { f.css = f.css.replace('--k-text-muted: #adb5bd;', '--k-text-muted: #6c757d;'); }],
  ['el texto principal del modo oscuro se apaga',
    f => { f.css = f.css.replace('--k-text-main: #e9ecef;', '--k-text-main: #4a5568;'); }],
  ['isDark vuelve a comparar con igualdad exacta',
    f => { f.js = f.js.replace("(this.container.getAttribute('data-theme') || '').startsWith('dark')", "this.container.getAttribute('data-theme') === 'dark'"); }],
  ['_syncTheme lee del propio contenedor (se realimenta)',
    f => { f.js = f.js.replace("const theme = document.documentElement.getAttribute('data-theme');", "const theme = this.container.getAttribute('data-theme');"); }],
  ['render() deja de llamar al espejo',
    f => { f.js = f.js.replace(/(\n {8}this\._syncTheme\(\);)/, ''); }],
  ['render() deja de registrar el observador',
    f => { f.js = f.js.replace(/(\n {8}this\._watchTheme\(\);)/, ''); }],
  ['el observador recrea graficos pero NO recarga los datos',
    f => { f.js = f.js.replace(/(\n {12}this\.updateCharts\(\);)/, ''); }],
  ['el observador recarga datos pero NO recrea los graficos',
    f => { f.js = f.js.replace('this.initializeCharts();\n            this.updateCharts();', 'this.updateCharts();'); }],
  ['destroy() deja de desconectar el observador',
    f => { f.js = f.js.replace('this._themeObserver.disconnect();', ''); }],
  ['se invierte el orden del repinte (datos antes de recrear)',
    f => { f.js = f.js.replace('this.initializeCharts();\n            this.updateCharts();', 'this.updateCharts();\n            this.initializeCharts();'); }],
  ['el shell empieza a escribir el atributo en el contenedor del modulo',
    f => { f.rend = f.rend + "\n//inyeccion: document.querySelector('.capacitaciones-container')?.setAttribute('data-theme','dark');\n"; }],
  ['se cuela un caracter prohibido en el JS',
    // en escapes, no literal: el archivo de test tambien tiene que cumplir la regla
    f => { f.js = f.js.replace('* 894 · Espeja en el contenedor', '* 894 · Espeja en el contenedor \u57f9\u8bad'); }],
  ['el CSS pasa a CRLF',
    f => { f.css = f.css.split('\n').join('\r\n'); }],
  ['se borra el bloque dark-legacy (la pantalla vuelve a verse azul en el shell gris)',
    f => {
      const i = f.css.indexOf('.capacitaciones-container[data-theme="dark-legacy"] {');
      if (i < 0) throw new Error('no se encuentra el bloque dark-legacy');
      const fin = f.css.indexOf('.capacitaciones-container[data-theme="dark-legacy"] .cap-radar-evidencias');
      const cierre = f.css.indexOf('}', fin) + 1;
      f.css = f.css.slice(0, i) + f.css.slice(cierre);
    }],
  ['el bloque dark-legacy queda ANTES de las reglas que tiene que pisar',
    f => {
      const i = f.css.indexOf('.capacitaciones-container[data-theme="dark-legacy"] {');
      if (i < 0) throw new Error('no se encuentra el bloque dark-legacy');
      const ult = f.css.indexOf('.capacitaciones-container[data-theme="dark-legacy"] .cap-radar-evidencias');
      const cierre = f.css.indexOf('}', ult) + 1;
      const bloque = f.css.slice(i, cierre);
      f.css = f.css.slice(0, i) + f.css.slice(cierre);
      const i2 = f.css.indexOf('.capacitaciones-container[data-theme^="dark"] {');
      if (i2 < 0) throw new Error('no se encuentra el bloque azul tras quitar el legacy');
      f.css = f.css.slice(0, i2) + bloque + '\n' + f.css.slice(i2);
    }],
  ['el legacy vuelve a traer el canvas azul de dark',
    f => {
      const i = f.css.indexOf('.capacitaciones-container[data-theme="dark-legacy"] {');
      const cierre = f.css.indexOf('}', i);
      const bloque = f.css.slice(i, cierre).replace('--k-bg-app: #121212;', '--k-bg-app: #1a202c;');
      f.css = f.css.slice(0, i) + bloque + f.css.slice(cierre);
    }],
  ['el legacy se declara con el prefijo (entaria tambien en dark)',
    f => { f.css = f.css.replace('.capacitaciones-container[data-theme="dark-legacy"]', '.capacitaciones-container[data-theme^="dark"]'); }],
  ['las superficies del legacy se quedan con el azul',
    f => { f.css = f.css.replace('.capacitaciones-container[data-theme="dark-legacy"] .cap-radar-evidencias { background: #242424; }', '.capacitaciones-container[data-theme="dark-legacy"] .cap-radar-evidencias { background: #232b3a; }'); }],
  ['el shell cambia su paleta legacy y el modulo no la sigue',
    f => { f.tok = f.tok.replace('--kair-canvas: #121212;', '--kair-canvas: #0b0b0b;'); }]
];

let mutDetectadas = 0; let mutVacias = 0;
for (const par of MUT) {
  const nombre = par[0]; const aplicar = par[1];
  const F = clonar(F0);
  try { aplicar(F); } catch (e) { mutVacias++; console.log('FAIL MUTANTE LANZO ' + nombre + ': ' + e.message); continue; }
  if (JSON.stringify(F) === JSON.stringify(F0)) { mutVacias++; console.log('FAIL MUTANTE VACIO ' + nombre); continue; }
  const antesN = fallidos.length;
  fallidos.length = 0; registro.length = 0; n = 0;
  const r = evaluar(F);
  if (r.f > 0) mutDetectadas++;
  else console.log('FAIL MUTANTE NO DETECTADO ' + nombre);
  void antesN;
}

// ── Corrida base ────────────────────────────────────────────────────────────
fallidos.length = 0; registro.length = 0; n = 0;
const base = evaluar(F0);

const checks = registro.slice();
checks.push({ n: 'mutaciones: ' + mutDetectadas + '/' + MUT.length + ' detectadas', c: mutDetectadas === MUT.length });
checks.push({ n: 'mutaciones vacias: ' + mutVacias, c: mutVacias === 0 });
checks.push({ n: 'checks base: ' + (base.n - base.f) + '/' + base.n, c: base.f === 0 });

const bad = checks.filter(c => !c.c);
if (process.env.VERBOSO) {
  checks.forEach(c => console.log((c.c ? '  ok  ' : ' FALLA') + ' ' + c.n));
  if (fallidos.length) { console.log('\nDetalle:'); fallidos.forEach(f => console.log('  - ' + f)); }
}
console.log((checks.length - bad.length) + '/' + checks.length + ' OK');
process.exit(bad.length === 0 ? 0 : 1);
