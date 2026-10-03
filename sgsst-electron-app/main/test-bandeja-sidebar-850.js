'use strict';
// 📦850 · La columna lateral (mini-calendar + tipos de evento + Tu día) se pliega
// y el correo/calendario toman el ancho. Botón en el borde, estado persistente.
//
// El test está armado como evaluar(htm, css, js) -> {f, n} para que el mutation
// testing del final pueda alimentarse con mutaciones EN MEMORIA: revierte una
// parte del código sin tocar el archivo real y exige que el check la detecte.
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..');
const DIR = path.join(APP, 'renderer', 'bandeja-integrada');

const RANGO_CJK = new RegExp('[\\u4e00-\\u9fff\\u3040-\\u30ff\\u0400-\\u04ff\\uac00-\\ud7af]', 'g');

function soloCodigo(x) {
  return x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}
function cuerpoDe(src, nombre) {
  const LL = src.split(/\r?\n/);
  const i = LL.findIndex(s => s.indexOf('function ' + nombre + '(') !== -1);
  if (i < 0) return '';
  let n = 0, ab = false, fin = LL.length - 1;
  for (let k = i; k < LL.length; k++) {
    for (const c of LL[k]) {
      if (c === '{') { n++; ab = true; }
      else if (c === '}') { n--; if (ab && n === 0) { fin = k; break; } }
    }
    if (ab && n === 0) break;
  }
  return LL.slice(i, fin + 1).join('\n');
}
// Regla CSS por selector, sin depender de donde este escrita ni del orden.
function regla(css, sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp('(^|\\n)[^\\n{}]*' + esc + '\\s*\\{([\\s\\S]*?)\\n\\}'));
  return m ? m[2] : '';
}

function evaluar(htm, css, js) {
  const fallos = [];
  let n = 0;
  const chk = (nombre, c, e) => {
    n++;
    if (!c) fallos.push(nombre + (e ? '  [' + e + ']' : ''));
  };

  const appCod = soloCodigo(js);
  const aplicar = soloCodigo(cuerpoDe(js, 'aplicarSidebar'));
  const toggle = soloCodigo(cuerpoDe(js, 'toggleSidebar'));
  const bind = soloCodigo(cuerpoDe(js, 'bindHeader'));
  const init = soloCodigo(cuerpoDe(js, 'init'));

  // ══ 1) El botón existe y vive FUERA del <aside> ══
  chk('el HTML tiene el botón #btn-side-toggle',
    htm.indexOf('id="btn-side-toggle"') >= 0);
  chk('es un <button type="button"> (no un div, no submit dentro de un form)',
    /<button class="kair-side-toggle" id="btn-side-toggle" type="button"/.test(htm));
  chk('nace plegado: aria-expanded="true" y el layout data-sidebar="on"',
    htm.indexOf('aria-expanded="true"') >= 0
    && /<div class="kair-layout" id="kair-layout" data-sidebar="on">/.test(htm));
  chk('aria-controls apunta al <aside> que se pliega',
    /aria-controls="sidebar"/.test(htm));

  const asideAbre = htm.indexOf('<aside class="kair-sidebar" id="sidebar">');
  const asideCierra = htm.indexOf('</aside>');
  const btn = htm.indexOf('id="btn-side-toggle"');
  chk('el <aside> abre y cierra ANTES del botón: vive en .kair-layout, no adentro',
    asideAbre >= 0 && asideCierra > asideAbre && btn > asideCierra,
    'abre=' + asideAbre + ' cierra=' + asideCierra + ' btn=' + btn);
  chk('el botón está dentro de .kair-layout y antes del área de contenido',
    btn > htm.indexOf('id="kair-layout"') && btn < htm.indexOf('id="content-area"'));

  // ══ 2) El ancho sale de una variable, no de un número suelto ══
  const lay = regla(css, '.kair-layout');
  chk('.kair-layout declara --side-w (el ancho de la columna)',
    /--side-w:\s*\d+px/.test(lay));
  chk('.kair-layout declara --side-pad (donde arranca la columna)',
    /--side-pad:\s*\d+px/.test(lay));
  chk('la columna del grid es auto: la mide el <aside>, no un número del grid',
    /grid-template-columns:\s*auto\s+1fr/.test(lay),
    (lay.match(/grid-template-columns:[^;]*/) || [''])[0].trim());
  chk('NO quedó un ancho fijo en el grid (250px 1fr no se puede plegar)',
    !/grid-template-columns:\s*\d+px\s+1fr/.test(lay));
  chk('.kair-layout tiene position: relative (ancla del botón)',
    /position:\s*relative/.test(lay));

  const side = regla(css, '.kair-sidebar');
  chk('.kair-sidebar mide var(--side-w)',
    /width:\s*var\(--side-w\)/.test(side),
    (side.match(/width:[^;]*/) || [''])[0].trim());
  chk('.kair-sidebar NO tiene width fijo (rompería el plegado)',
    !/width:\s*\d+px/.test(side));
  chk('.kair-sidebar recorta con overflow: hidden (si no, las cartas se derraman)',
    /overflow:\s*hidden/.test(side) && !/overflow:\s*visible/.test(side));
  chk('.kair-sidebar se transiciona en width, opacity y transform',
    /transition:[^;]*width[^;]*/.test(side)
    && /transition:[^;]*opacity/.test(side)
    && /transition:[^;]*transform/.test(side),
    (side.match(/transition:[^;]*/) || [''])[0].trim());
  chk('ninguna transición del archivo es "all"',
    !/transition:\s*all/.test(css));

  // ══ 3) Estado plegado: la columna no ocupa ni el ancho ni el gap ══
  const off = regla(css, '.kair-layout[data-sidebar="off"]');
  const offSide = regla(css, '.kair-layout[data-sidebar="off"] .kair-sidebar');
  chk('al plegar se quita el column-gap (si no queda una franja muerta de 16px)',
    /column-gap:\s*0(?:px)?/.test(off),
    (off.match(/column-gap:[^;]*/) || [''])[0].trim());
  chk('al plegar el <aside> se va a 0 de ancho',
    /width:\s*0(?:px)?/.test(offSide));
  chk('al plegar se apaga con opacity: 0',
    /opacity:\s*0/.test(offSide));
  chk('al plegar se apaga el mouse (un día invisible seguiría lanzando el popup)',
    /pointer-events:\s*none/.test(offSide));
  chk('el plegado se compone: transform en el <aside>',
    /transform:\s*translateX/.test(offSide));

  // ══ 4) El botón siempre visible y clavado al borde ══
  const tg = regla(css, '.kair-side-toggle');
  chk('.kair-side-toggle es absolute y se ancla con --side-pad',
    /position:\s*absolute/.test(tg) && /left:\s*calc\(var\(--side-pad\)/.test(tg),
    (tg.match(/left:[^;]*/) || [''])[0].trim());
  chk('el botón mide 26x26 (pequeño, como se pidió)',
    /width:\s*26px/.test(tg) && /height:\s*26px/.test(tg));
  chk('el botón se mueve en X con --side-w, no con un número suelto',
    /transform:\s*translateX\(var\(--side-w\)\)/.test(
      regla(css, '.kair-layout[data-sidebar="on"] .kair-side-toggle')));
  chk('el chevron gira 180 grados al plegarse',
    /rotate\(180deg\)/.test(regla(css, '.kair-layout[data-sidebar="off"] .kair-side-toggle svg')));
  const z = (tg.match(/z-index:\s*(\d+)/) || [])[1];
  chk('el botón va por encima del popup del mini (9999) y por debajo de los modales (450000)',
    z !== undefined && Number(z) > 9999 && Number(z) < 450000, 'z-index=' + z);

  // ══ 5) JS: estado, persistencia y accesibilidad ══
  chk('existe la clave de preferencia del sidebar',
    /kair-bandeja\.sidebarColapsado/.test(appCod));
  chk('aplicarSidebar() existe y pinta data-sidebar',
    /setAttribute\(\s*"data-sidebar"\s*,\s*off\s*\?\s*"off"\s*:\s*"on"/.test(aplicar),
    aplicar.slice(0, 90).replace(/\s+/g, ' '));
  chk('aplicarSidebar() mantiene aria-expanded al día',
    /setAttribute\(\s*"aria-expanded"\s*,\s*off\s*\?\s*"false"\s*:\s*"true"/.test(aplicar));
  chk('aplicarSidebar() cambia title Y aria-label (el texto del botón no miente)',
    /\.title\s*=/.test(aplicar) && /setAttribute\(\s*"aria-label"/.test(aplicar));
  chk('toggleSidebar() alterna el estado y lo guarda',
    /sidebarColapsado\s*=\s*!sidebarColapsado/.test(toggle)
    && /localStorage\.setItem\(\s*SIDEBAR_KEY/.test(toggle));
  chk('toggleSidebar() NO llama a render() (reconstruiría el correo para cambiar un ancho)',
    !/render\(\)/.test(toggle),
    (toggle.match(/render\(\)/) || [''])[0].trim());
  chk('toggleSidebar() cierra el popup del mini (vive en body: se quedaría flotando)',
    /ocultarPopupDia\(\)/.test(toggle));
  chk('toggleSidebar() guarda en ambos sentidos, protegido con try/catch',
    /catch/.test(toggle)
    && /localStorage\.setItem\(\s*SIDEBAR_KEY\s*,\s*sidebarColapsado\s*\?\s*"1"\s*:\s*"0"\s*\)/.test(toggle),
    (toggle.match(/setItem\([^;]*/) || [''])[0].trim());

  chk('init lee la preferencia ANTES de que bindHeader la aplique',
    /localStorage\.getItem\(\s*SIDEBAR_KEY\s*\)\s*===\s*"1"/.test(init)
    && init.indexOf('getItem') >= 0
    && init.indexOf('getItem') < init.indexOf('bindHeader()'),
    'getItem@' + init.indexOf('getItem') + ' bindHeader@' + init.indexOf('bindHeader()'));
  chk('la comparación es estricta: localStorage guarda texto y "0" es truthy',
    !/if\s*\(\s*localStorage\.getItem\(\s*SIDEBAR_KEY\s*\)\s*\)/.test(init));
  chk('bindHeader() enlaza el clic al botón',
    /btnSideToggle[\s\S]{0,140}addEventListener\(\s*"click"\s*,\s*toggleSidebar\s*\)/.test(bind));
  chk('el botón se enlaza una sola vez: renderSidebar no lo re-crea',
    !/btn-side-toggle/.test(cuerpoDe(js, 'renderSidebar')));

  // ══ 6) Animación responsable ══
  const durMs = [];
  css.replace(/transition:[^;]*;|animation:[^;]*;/g, m => {
    (m.match(/(\d+)ms/g) || []).forEach(d => durMs.push(Number(d.replace('ms', ''))));
  });
  chk('ninguna transición del archivo dura 300ms o más',
    durMs.length > 0 && durMs.every(d => d < 300),
    'max=' + Math.max.apply(null, durMs) + 'ms');
  chk('las transiciones de 850 usan curva propia, no "ease" pelado',
    /transition:[^;]*cubic-bezier/.test(css));
  chk('prefers-reduced-motion apaga todo (regla global al final del archivo)',
    /@media \(prefers-reduced-motion: reduce\)/.test(css)
    && /transition-duration:\s*\.01ms\s*!important/.test(css));

  // ══ 7) Responsive ══
  // OJO: hay VARIOS "@media (max-width: 1280px)" en el archivo (uno de los
  // filtros de correo, otro del shell). El que nos interesa es el ULTIMO: el
  // bloque responsive del final, que es donde viven los anchos del layout.
  // Tomar el primero hacia que el check leyera el media query equivocado y
  // pasara por encontrar la regla en otro sitio.
  const mq = (q) => {
    const sel = '@media (max-width: ' + q + 'px)';
    let i = css.lastIndexOf(sel);
    if (i < 0) return '';
    let d = 0;
    for (let k = css.indexOf('{', i); k < css.length; k++) {
      if (css[k] === '{') d++;
      else if (css[k] === '}') { d--; if (d === 0) return css.slice(i, k + 1); }
    }
    return '';
  };
  chk('a 1280px la columna se angosta por variable, no con un 224px suelto',
    /--side-w:\s*224px/.test(mq('1280')) && /--side-pad:\s*20px/.test(mq('1280')));
  chk('a 1080px el sidebar ya no existe, y el botón tampoco',
    /\.kair-side-toggle\s*\{\s*display:\s*none/.test(mq('1080')),
    'sin esta regla quedaría un botón flotando sin nada que plegar');

  // ══ 8) Higiene ══
  let netas = 0;
  for (const c of js) { if (c === '{') netas++; else if (c === '}') netas--; }
  chk('las llaves de app.js balancean', netas === 0, 'netas=' + netas);
  chk('sin CJK ni mojibake en los 3 archivos',
    (js.match(RANGO_CJK) || []).length + (css.match(RANGO_CJK) || []).length
    + (htm.match(RANGO_CJK) || []).length === 0);

  return { f: fallos.length, fallos, n };
}

// ═══════════════ corrida real ═══════════════
// TODO se normaliza a LF antes de evaluar. Razón concreta: app.js e index.html
// están en CRLF, y una mutación escrita con "\n" sobre un archivo CRLF no
// encuentra nada — el archivo salía idéntico y el mutante se reportaba como
// "el check no muerde" cuando en realidad NUNCA se había probado. Los 3
// mutantes de app.js hicieron exactamente eso. El guard de "mutante vacío"
// del final es la red que evita volver a perder esa señal.
const crudo = {
  htm: fs.readFileSync(path.join(DIR, 'index.html'), 'utf8'),
  css: fs.readFileSync(path.join(DIR, 'premium.css'), 'utf8'),
  js: fs.readFileSync(path.join(DIR, 'app.js'), 'utf8'),
};
const htm = crudo.htm.replace(/\r\n/g, '\n');
const css = crudo.css.replace(/\r\n/g, '\n');
const js = crudo.js.replace(/\r\n/g, '\n');

function eolDe(s) {
  const c = (s.match(/\r\n/g) || []).length;
  const l = (s.match(/\n/g) || []).length;
  return c > 0 && c === l ? 'CRLF' : (c === 0 ? 'LF' : 'MIXTO');
}
const real = evaluar(htm, css, js);
const eol = [
  ['app.js sigue en CRLF', eolDe(crudo.js), 'CRLF'],
  ['index.html sigue en CRLF', eolDe(crudo.htm), 'CRLF'],
  ['premium.css sigue en LF', eolDe(crudo.css), 'LF'],
];
eol.forEach(e => {
  if (e[1] !== e[2]) { real.n++; real.f++; real.fallos.push(e[0] + '  [' + e[1] + ', esperado ' + e[2] + ']'); }
  else real.n++;
});

// ═══════════════ mutation testing ═══════════════
// Cada mutacion revierte UNA parte en memoria. Si el test sigue en verde, el
// check no muerde: hay que arreglarlo o declarar el mutante equivalente.
const MUT = [
  ['el botón desaparece del HTML',
    h => h.replace(/<button class="kair-side-toggle"[\s\S]*?<\/button>\r?\n/, '')],
  ['el botón se muda adentro del <aside>',
    h => h.replace(/        <!-- 📦850[\s\S]*?<button class="kair-side-toggle" id="btn-side-toggle" type="button"([\s\S]*?)<\/button>\r?\n/, '')
      .replace('<aside class="kair-sidebar" id="sidebar"></aside>',
        '<aside class="kair-sidebar" id="sidebar"><button class="kair-side-toggle" id="btn-side-toggle" type="button"$1</button></aside>')],
  ['el layout arranca sin data-sidebar',
    h => h.replace(' id="kair-layout" data-sidebar="on">', ' id="kair-layout">')],
  ['queda el width fijo de 250px en el grid',
    c => c.replace('grid-template-columns: auto 1fr;', 'grid-template-columns: 250px 1fr;')],
  ['el sidebar mide 250px fijo en vez de la variable',
    c => c.replace('width: var(--side-w);', 'width: 250px;')],
  ['el sidebar deja de recortar (overflow: visible)',
    c => c.replace('  min-width: 0;\n  width: var(--side-w);\n  overflow: hidden;',
      '  min-width: 0;\n  width: var(--side-w);\n  overflow: visible;')],
  ['al plegar queda el gap de 16px (franja muerta)',
    c => c.replace('.kair-layout[data-sidebar="off"] {\n  column-gap: 0px;\n}',
      '.kair-layout[data-sidebar="off"] {\n  color: red;\n}')],
  ['al plegar el mouse sigue activo sobre los días invisibles',
    c => c.replace('  opacity: 0;\n  transform: translateX(-14px);\n  pointer-events: none;\n}',
      '  opacity: 0;\n  transform: translateX(-14px);\n}')],
  ['el chevron deja de girar',
    c => c.replace('.kair-layout[data-sidebar="off"] .kair-side-toggle svg {\n  transform: rotate(180deg);\n}',
      '.kair-layout[data-sidebar="off"] .kair-side-toggle svg {\n  opacity: .5;\n}')],
  ['el botón queda debajo del popup del mini',
    c => c.replace('  z-index: 10000;', '  z-index: 5;')],
  ['el botón deja de moverse con el borde',
    c => c.replace('  transform: translateX(var(--side-w));', '  transform: translateX(0);')],
  ['el sidebar no se transiciona (salta de golpe)',
    c => c.replace('  transition: width 240ms cubic-bezier(.4, 0, .2, 1),\n              opacity 160ms ease-out,\n              transform 240ms cubic-bezier(.4, 0, .2, 1);\n', '')],
  ['toggleSidebar() reconstruye el correo con render()',
    j => j.replace('    aplicarSidebar();\n    ocultarPopupDia();',
      '    aplicarSidebar();\n    render();\n    ocultarPopupDia();')],
  ['toggleSidebar() deja el popup del mini flotando',
    j => j.replace('    aplicarSidebar();\n    ocultarPopupDia();', '    aplicarSidebar();')],
  ['la preferencia se lee como texto truthy (el "0" seria true)',
    j => j.replace('localStorage.getItem(SIDEBAR_KEY) === "1"',
      '!!localStorage.getItem(SIDEBAR_KEY)')],
  ['aria-expanded nunca se actualiza',
    j => j.replace('      btn.setAttribute("aria-expanded", off ? "false" : "true");\n', '')],
  ['el botón nunca se enlaza al clic',
    j => j.replace('    if (btnSideToggle) btnSideToggle.addEventListener("click", toggleSidebar);', '')],
  ['aplicarSidebar() no pinta data-sidebar (el CSS nunca reacciona)',
    j => j.replace('if (layout) layout.setAttribute("data-sidebar", off ? "off" : "on");', '')],
  ['a 1280px el ancho queda fijo en el grid otra vez',
    c => c.replace('  .kair-layout { --side-w: 224px; --side-pad: 20px; padding: 14px 20px 18px; }',
      '  .kair-layout { grid-template-columns: 224px 1fr; padding: 14px 20px 18px; }')],
  ['a 1080px el botón queda flotando sin nada que plegar',
    c => c.replace('  .kair-side-toggle { display: none; }', '  .kair-side-toggle { color: red; }')],
];

console.log('\n=======================================');
console.log('  📦850 · Columna lateral plegable');
console.log('=======================================');
if (real.f) {
  console.log('--- CHECKS FALLIDOS ---');
  real.fallos.forEach(f => console.log('FAIL  ' + f));
} else {
  console.log('OK  ' + real.n + '/' + real.n + ' checks en verde');
}
console.log('--- mutation testing (' + MUT.length + ' mutantes) ---');
let mFallos = 0;
let vacios = 0;
MUT.forEach(m => {
  const mh = m[1](htm), mc = m[1](css), mj = m[1](js);
  // Un mutante que NO cambia el código no prueba nada: el check "pasaría"
  // siempre y se reporta como si el check no mordiera. Se cuentan aparte.
  if (mh === htm && mc === css && mj === js) {
    vacios++;
    console.log('FAIL MUTANTE VACIO ' + m[0] + '  [la mutacion no cambio nada]');
    return;
  }
  const detectado = evaluar(mh, mc, mj).f > 0;
  if (!detectado) mFallos++;
  console.log((detectado ? 'OK  detecta      ' : 'FAIL NO muerde   ') + m[0]);
});
console.log('---');
console.log('checks: ' + (real.n - real.f) + '/' + real.n
  + '  ·  mutaciones detectadas: ' + (MUT.length - mFallos - vacios) + '/' + MUT.length
  + (vacios ? '  ·  mutantes vacios: ' + vacios : ''));
console.log('=======================================');
process.exit(real.f === 0 && mFallos === 0 && vacios === 0 ? 0 : 1);
