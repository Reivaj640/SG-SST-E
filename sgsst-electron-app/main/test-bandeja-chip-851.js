'use strict';
// 📦851 · El chip de fecha del topbar ("Octubre 2026") se elimina: era el mismo
// dato dos veces en pantalla. El calendario grande ya lo muestra en su toolbar
// (#kair-toolbar-period-label) y el mini-calendar muestra el mes actual desde 844.
//
// Mismo diseño que 850: evaluar(htm, css, js) -> {f, n} para poder mutar en
// memoria. Y normalizacion a LF ANTES de mutar, con guard de mutante vacio:
// una mutacion que no cambia nada siempre "pasa" y se reporta como si el check
// no mordiera, cuando en realidad nunca se probo.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'renderer', 'bandeja-integrada');
const RANGO_CJK = new RegExp('[\\u4e00-\\u9fff\\u3040-\\u30ff\\u0400-\\u04ff\\uac00-\\ud7af]', 'g');

function soloCodigo(x) {
  return x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}
function eolDe(s) {
  const c = (s.match(/\r\n/g) || []).length;
  const l = (s.match(/\n/g) || []).length;
  return c > 0 && c === l ? 'CRLF' : (c === 0 ? 'LF' : 'MIXTO');
}

function evaluar(htm, css, js) {
  const fallos = [];
  let n = 0;
  const chk = (nombre, c, e) => { n++; if (!c) fallos.push(nombre + (e ? '  [' + e + ']' : '')); };
  const cod = soloCodigo(js);

  // ══ 1) El chip desaparece por completo: markup, estilos y código ══
  chk('el HTML ya NO tiene #chip-fecha',
    htm.indexOf('id="chip-fecha"') < 0);
  chk('el HTML ya NO tiene la clase .kair-chip-date',
    htm.indexOf('kair-chip-date') < 0);
  chk('el CSS ya NO tiene la regla .kair-chip-date',
    css.indexOf('kair-chip-date') < 0);
  chk('el JS ya NO busca #chip-fecha (no quedó código muerto)',
    cod.indexOf('chip-fecha') < 0 && cod.indexOf('chipFecha') < 0,
    'quedó una referencia viva: el chip volvería a llenarse sin que se vea');

  // ══ 2) Lo que el chip duplicaba sigue en su lugar ══
  // El riesgo real de quitar el chip no es que algo se rompa hoy: es que se
  // carried el mes del calendario grande por error y nadie lo notara hasta que
  // el toolbar quedara en blanco. Estos checks son el que muerde si pasa eso.
  chk('el mes sigue en el toolbar del calendario grande',
    /id="kair-toolbar-period-label"/.test(cod));
  // El toolbar tiene DOS caminos para el mes y se necesitan los dos: al PINTAR
  // (el template del toolbar) y al ACTUALIZAR (la rama "month" del update, que
  // es el else de day/week/schedule). Un check que buscara el texto en todo el
  // archivo pasaría con uno solo, y con el otro faltando el toolbar quedaría en
  // blanco al cambiar de vista. Por eso van por separado.
  chk('el toolbar se Pinta ya con el mes (template)',
    /id="kair-toolbar-period-label">\$\{state\.viewMonthLabel/.test(cod),
    'falta el ${...} del mes en el template del toolbar');
  chk('en vista Mes el toolbar vuelve a poner el mes (rama else del update)',
    /else\s*\{\s*periodLabel\.textContent = state\.viewMonthLabel/.test(cod),
    'sin el else, cambiar a vista Mes deja el toolbar con el texto viejo');
  chk('state.viewMonthLabel NO quedó huerfano: tiene al menos 2 usos',
    (cod.match(/state\.viewMonthLabel/g) || []).length >= 2,
    'usos=' + (cod.match(/state\.viewMonthLabel/g) || []).length);
  chk('el mini-calendar sigue mostrando el mes actual (📦844)',
    /class="mini__m"/.test(cod),
    'se busca en app.js: el .mini__m se pinta desde renderSidebar(), no esta en el HTML estatico');

  // ══ 3) El topbar quedo bien espaciado ══
  // Al sacar el chip, el espaciador .kair-top__sp tiene que seguir entre el
  // titulo y las acciones: sin el, los botones se pegarian al subtitulo.
  // Y no debe quedar ningun ELEMENTO vacio: uno vacio se ve como un hueco en
  // pantalla. Ojo: una linea en blanco en el CODIGO no produce nada visible,
  // asi que no se cuenta como hueco (y por eso su mutacion es equivalente).
  const sp = htm.indexOf('kair-top__sp');
  const act = htm.indexOf('kair-top__actions');
  chk('el espaciador .kair-top__sp sigue antes de las acciones',
    sp >= 0 && act > sp, 'sp=' + sp + ' actions=' + act);
  // Solo la franja donde estaba el chip. Escanear TODO el HTML daria falsos
  // positivos: hay contenedores legitimamente vacios en el HTML estatico que se
  // llenan desde JS (#mail-list-container, #calendar-slide, #gmail-indicator-dot).
  // El corte empieza DESPUES del cierre del <span class="kair-top__sp"> y termina
  // ANTES del "<div" que abre kair-top__actions. Cortar por el NOMBRE de la clase
  // no sirve: el indice cae en mitad del atributo y el slice se come el propio
  // cierre del span y el "<div" de las acciones, y el check accuse rellenos que
  // nunca existieron.
  const spFin = htm.indexOf('</span>', sp) + '</span>'.length;
  const actTag = htm.lastIndexOf('<div', act);
  const zonaChip = htm.slice(spFin, actTag);
  chk('entre el espaciador y las acciones no quedó ningún elemento de relleno',
    !/<(span|div|i)\b/.test(zonaChip),
    'quedo: ' + zonaChip.replace(/\s+/g, ' ').slice(0, 100));

  // ══ 4) Higiene ══
  let netas = 0;
  for (const c of js) { if (c === '{') netas++; else if (c === '}') netas--; }
  chk('las llaves de app.js balancean', netas === 0, 'netas=' + netas);
  chk('sin CJK ni mojibake en los 3 archivos',
    (js.match(RANGO_CJK) || []).length + (css.match(RANGO_CJK) || []).length
    + (htm.match(RANGO_CJK) || []).length === 0);

  return { f: fallos.length, fallos, n };
}

// ═══════════════ corrida real ═══════════════
const crudo = {
  htm: fs.readFileSync(path.join(DIR, 'index.html'), 'utf8'),
  css: fs.readFileSync(path.join(DIR, 'premium.css'), 'utf8'),
  js: fs.readFileSync(path.join(DIR, 'app.js'), 'utf8'),
};
const htm = crudo.htm.replace(/\r\n/g, '\n');
const css = crudo.css.replace(/\r\n/g, '\n');
const js = crudo.js.replace(/\r\n/g, '\n');
const real = evaluar(htm, css, js);
[['app.js sigue en CRLF', eolDe(crudo.js), 'CRLF'],
 ['index.html sigue en CRLF', eolDe(crudo.htm), 'CRLF'],
 ['premium.css sigue en LF', eolDe(crudo.css), 'LF']].forEach(e => {
  real.n++;
  if (e[1] !== e[2]) { real.f++; real.fallos.push(e[0] + '  [' + e[1] + ', esperado ' + e[2] + ']'); }
});

// ═══════════════ mutation testing ═══════════════
const CHIP_HTML =
  '        <span class="kair-chip-date" title="Mes visible en la agenda">\n' +
  '          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>\n' +
  '          <span id="chip-fecha">—</span>\n' +
  '        </span>\n\n';
const CHIP_CSS =
  '/* Chip de fecha (mes visible) */\n.kair-chip-date {\n  font-size: 12px;\n' +
  '  color: var(--kair-text-2);\n  padding: 7px 14px;\n}\n\n';
const CHIP_JS =
  '    var chipFecha = $("#chip-fecha");\n' +
  '    if (chipFecha) chipFecha.textContent = state.viewMonthLabel || D.MONTH_VIEW.label;\n\n';

const MUT = [
  ['alguien reinserta el chip en el HTML',
    h => h.replace('        <div class="kair-top__actions">', CHIP_HTML + '        <div class="kair-top__actions">')],
  ['alguien reinserta los estilos del chip',
    c => c.replace('/* Control segmentado (Agenda / Correo', CHIP_CSS + '/* Control segmentado (Agenda / Correo')],
  ['alguien reinserta el JS que llena el chip (sobrevive sin markup)',
    j => j.replace('    // Área de contenido:', CHIP_JS + '    // Área de contenido:')],
  ['alguien se lleva el mes por error y queda solo en el chip',
    j => j.replace(/state\.viewMonthLabel \|\| D\.MONTH_VIEW\.label/g, '"— "')
      .replace(/id="kair-toolbar-period-label"/, 'id="otro-label"')],
  ['el template del toolbar deja de llevar el mes',
    j => j.replace('id="kair-toolbar-period-label">${state.viewMonthLabel || D.MONTH_VIEW.label}</span>',
      'id="kair-toolbar-period-label">—</span>')],
  ['en vista Mes el toolbar queda en blanco (se pierde la rama else)',
    j => j.replace('      } else {\n        periodLabel.textContent = state.viewMonthLabel || D.MONTH_VIEW.label;\n      }',
      '      } else {\n        periodLabel.textContent = "";\n      }')],
  ['viewMonthLabel queda sin usar (el toolbar se hardcodea)',
    j => j.replace(/state\.viewMonthLabel \|\| D\.MONTH_VIEW\.label/g, 'D.MONTH_VIEW.label')],
  ['el espaciador del topbar desaparece (botones pegados al titulo)',
    h => h.replace('<span class="kair-top__sp"></span>\n', '')],
  ['alguien rellena con un elemento vacio donde estaba el chip',
    h => h.replace('        <div class="kair-top__actions">',
      '        <span class="kair-hueco"></span>\n\n        <div class="kair-top__actions">')],
  // EQUIVALENTE, y se reporta como tal en vez de disimularlo: una linea en
  // blanco en el CODIGO no produce ningun hueco en pantalla. El hueco real lo
  // produce un ELEMENTO vacio, que es la mutacion de arriba.
  ['una linea en blanco de mas en el header (equivalente: no se ve)',
    h => h.replace('        <span class="kair-top__sp"></span>\n',
      '        <span class="kair-top__sp"></span>\n\n\n'), true],
];

console.log('\n=======================================');
console.log('  📦851 · Se fue el chip de fecha del topbar');
console.log('=======================================');
if (real.f) {
  console.log('--- CHECKS FALLIDOS ---');
  real.fallos.forEach(f => console.log('FAIL  ' + f));
} else {
  console.log('OK  ' + real.n + '/' + real.n + ' checks en verde');
}
console.log('--- mutation testing (' + MUT.length + ' mutantes) ---');
let mFallos = 0, vacios = 0, equiv = 0;
MUT.forEach(m => {
  const equivalente = m.length > 2 && m[2] === true;
  const mh = m[1](htm), mc = m[1](css), mj = m[1](js);
  if (mh === htm && mc === css && mj === js) {
    vacios++;
    console.log('FAIL MUTANTE VACIO ' + m[0] + '  [la mutacion no cambio nada]');
    return;
  }
  const d = evaluar(mh, mc, mj).f > 0;
  if (equivalente) {
    // No cuenta como fallo ni como deteccion: se declara y se sigue viendo.
    equiv++;
    console.log('OK  equivalente   ' + m[0] + '  [detectada=' + d + ', no exige deteccion]');
    return;
  }
  if (!d) mFallos++;
  console.log((d ? 'OK  detecta      ' : 'FAIL NO muerde   ') + m[0]);
});
console.log('---');
const exigidas = MUT.length - equiv;
console.log('checks: ' + (real.n - real.f) + '/' + real.n
  + '  ·  mutaciones detectadas: ' + (exigidas - mFallos - vacios) + '/' + exigidas
  + (vacios ? '  ·  mutantes vacios: ' + vacios : '')
  + (equiv ? '  ·  equivalentes declaradas: ' + equiv : ''));
console.log('=======================================');
process.exit(real.f === 0 && mFallos === 0 && vacios === 0 ? 0 : 1);
