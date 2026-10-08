'use strict';
// 📦880 · La pastilla del mes cabe en la celda y el "..." vuelve.
//
// Este test reemplaza a `test-chip-fade-880.js`, cuyo nombre ya no describia lo que
// pasaba: el degradado se probo, se vio en pantalla y el owner decidio que no lo
// lo queria. Asi que lo que queda de 880 son DOS defectos reales del mismo chip, y
// los dos se prueban aqui:
//
//  1) La pastilla se SALIA de la celda. `.kair-month-event` traia `width: 100%`
//     (que mide el content-box) mas `padding: 2.5px 7px`, y sin
//     `box-sizing: border-box` el ancho total era el 100% de la celda MAS los
//     14px del padding. El chip se metia en la celda de al lado y su
//     `border-radius: 7px` derecho quedaba fuera de lo que se veia: redondeada al
//     inicio, PLANA al final, pegada contra la linea del dia.
//
//  2) El `text-overflow: ellipsis` estaba DUPLICADO: en el CSS y tambien en el
//     style EN LINEA del span (app.js). Los estilos en linea ganan a cualquier
//     regla, salvo !important. Cuando se probo el degradado, la "..." y la
//     mascara convivieron y el resultado dependia de donde cayera el "...": unos
//     chips mostraban puntos y otros no. El "..." vuelve, pero SOLO en el CSS.
//
// La distincion que este test existe para fijar: el "..." debe estar en la hoja y
// NO en el style en linea. Ponerlo en los dos es lo que produjo el bug original.
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..');
const BI = path.join(APP, 'renderer', 'bandeja-integrada');
const P = path.join(BI, 'premium.css');
const S = path.join(BI, 'styles.css');
const IDX = path.join(BI, 'index.html');
const JS = path.join(BI, 'app.js');
const PREM = fs.readFileSync(P, 'utf8');
const STY = fs.readFileSync(S, 'utf8');
const HTML = fs.readFileSync(IDX, 'utf8');
const APPJS = fs.readFileSync(JS, 'utf8');

const ok = [];
const chk = (n, c, e) => ok.push({ n, c: !!c, e });

// Bloque de un selector, quitando comentarios: un `box-sizing` mencionado en un
// comentario NO cuenta, que es como una mutacion puede morir por el motivo
// equivocado y parecer que el check funciona.
function bloque(css, sel) {
  const i = css.indexOf(sel);
  if (i < 0) return '';
  return css.slice(i, css.indexOf('}', i));
}
function soloCss(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const bp = soloCss(bloque(PREM, '.kair-month-event__title'));
const bs = soloCss(bloque(STY, '.kair-month-event__title'));
const chipP = soloCss(bloque(PREM, '.kair-month-event'));
const celdaP = soloCss(bloque(PREM, '.kair-month-cell'));

// Valores numericos de border-radius, para poder compararlos contra 0.
function radios(css) {
  return (css.match(/border-radius\s*:\s*([^;}]+)/g) || [])
    .map(x => parseFloat(/border-radius\s*:\s*([^;}]+)/.exec(x)[1]));
}

// ══ 1) La pastilla cabe en la celda y se ven los DOS bordes ══
chk('el chip lleva box-sizing: border-box (sin esto se sale de la celda)',
  /box-sizing\s*:\s*border-box/.test(chipP), chipP.slice(0, 50));
chk('y sigue siendo width: 100%, que es justo lo que hace falta el border-box',
  /width\s*:\s*100%/.test(chipP));
chk('el chip tiene padding horizontal (si no, el desborde no existiria y el de arriba seria vacio)',
  /padding\s*:[^;]*\d/.test(chipP));
chk('la celda NO se cierra con overflow:hidden, que taparia el redondeo igual',
  !/overflow\s*:\s*hidden/.test(celdaP));
// El radio tiene que ser REAL: `border-radius: 0` tiene un digito y por eso
// pasa un `/border-radius\s*:\s*\d/`. Una mutacion con `border-radius: 0` es
// justo el caso que hace falta cazar, asi que se compara el VALOR contra cero.
chk('el chip tiene borde redondeado REAL (un radio mayor que 0, no border-radius: 0)',
  radios(chipP).some(v => v > 0), JSON.stringify(radios(chipP)));

// ══ 2) El "..." vuelve, en la hoja ══
chk('premium.css vuelve a usar text-overflow: ellipsis',
  /text-overflow\s*:\s*ellipsis/.test(bp));
chk('styles.css tambien (las dos copias no pueden contradecirse)',
  /text-overflow\s*:\s*ellipsis/.test(bs));
chk('sigue en una sola linea', /white-space\s*:\s*nowrap/.test(bp));
chk('sigue con overflow: hidden, o el texto se sale de la celda',
  /overflow\s*:\s*hidden/.test(bp));

// ══ 3) Y NO vuelve el degradado ══
chk('el titulo ya NO lleva mask-image (se probo y el owner no lo quiso)',
  !/mask-image/.test(bp));
chk('ni el prefijo -webkit- del mask',
  !/-webkit-mask-image/.test(bp));
chk('y ningun otro selector de la bandeja dejo un mask puesto',
  !/mask-image/.test(soloCss(PREM)));

// 🔴 El "..." NO debe volver en el style EN LINEA del span (app.js). Con los dos
// mecanismos vivos, el "..." y el recorte compiten y el resultado depende de donde
// caiga cada uno. Este fue el bug que hizo que unos chips mostraran puntos y otros
// no, con el degradado puesto.
const spanMes = (/<span[^>]*kair-month-event__title[^>]*>/.exec(APPJS) || [])[0] || '';
chk('el span del chip NO lleva text-overflow en el style en linea',
  !!spanMes && !/text-overflow/.test(spanMes), spanMes.slice(0, 80));
chk('el span del chip tiene la clase del titulo (si no, el CSS no le aplica)',
  /kair-month-event__title/.test(spanMes));

// ══ 4) Cache-bust: los tres tokens de la bandeja ══
const tk = {
  app: (/app\.js\?v=([^"']+)/.exec(HTML) || [])[1],
  sty: (/styles\.css\?v=([^"']+)/.exec(HTML) || [])[1],
  pre: (/premium\.css\?v=([^"']+)/.exec(HTML) || [])[1]
};
chk('app.js, styles.css y premium.css comparten token',
  !!tk.app && tk.app === tk.sty && tk.sty === tk.pre,
  [tk.app, tk.sty, tk.pre].join(' vs '));

// ══ 5) EOL / BOM / caracteres ══
function eol(file) {
  const b = fs.readFileSync(file);
  let c = 0, l = 0;
  for (let i = 0; i < b.length; i++) if (b[i] === 10) { if (i > 0 && b[i - 1] === 13) c++; else l++; }
  return { c, l, bom: b[0] === 0xEF };
}
const ep = eol(P), es = eol(S);
chk('premium.css sigue LF sin BOM', ep.l > 2000 && ep.c === 0 && !ep.bom, ep.c + '/' + ep.l);
chk('styles.css sigue LF y CONSERVA su BOM', es.l > 5000 && es.c === 0 && es.bom, es.c + '/' + es.l);
chk('sin CJK, cirilico ni hangul',
  !/[\u3000-\u9FFF\uAC00-\uD7AF\u0400-\u04FF]/.test(PREM) && !/[\u3000-\u9FFF\uAC00-\uD7AF\u0400-\u04FF]/.test(STY));

// ══════════════════════════════════════════════════════════════════════
// MUTACIONES
// ══════════════════════════════════════════════════════════════════════
function correr(css) {
  const b = soloCss(bloque(css, '.kair-month-event__title'));
  const chip = soloCss(bloque(css, '.kair-month-event'));
  const celda = soloCss(bloque(css, '.kair-month-cell'));
  const r = [];
  // La pastilla dentro de la celda.
  r.push(/box-sizing\s*:\s*border-box/.test(chip));
  r.push(/width\s*:\s*100%/.test(chip));
  r.push(/padding\s*:[^;]*\d/.test(chip));
  r.push(!/overflow\s*:\s*hidden/.test(celda));
  r.push(radios(chip).some(v => v > 0));
  // El "..." en la hoja, y no el degradado.
  r.push(/text-overflow\s*:\s*ellipsis/.test(b));
  r.push(!/mask-image/.test(b));
  r.push(/white-space\s*:\s*nowrap/.test(b));
  r.push(/overflow\s*:\s*hidden/.test(b));
  return r;
}

// Todas las mutaciones usan el flag `g`: sin el, `replace` pega sobre la PRIMERA
// coincidencia de todo el archivo, que puede estar fuera del bloque que nos
// interesa, y la mutacion no muerde por un motivo equivocado — que es peor que no
// morder, porque parece que el check funciona.
const MUT = [
  ['quita el box-sizing: border-box (la pastilla se sale de la celda y queda plana a la derecha)',
    c => c.replace(/(\.kair-month-event\s*\{[^}]*?)\s*box-sizing\s*:\s*border-box;/g, '$1')],
  ['quita el width: 100% (desaparece el desborde, y el check del padding queda vacio)',
    c => c.replace(/(\.kair-month-event\s*\{[^}]*?)\s*width\s*:\s*100%;/g, '$1')],
  ['cierra la celda con overflow:hidden (taparia el borde redondeado del chip)',
    c => c.replace(/(\.kair-month-cell\s*\{[^}]*?)\s*min-height/g, '$1  overflow: hidden;\n  min-height')],
  ['se lleva el "..." del titulo',
    c => c.replace(/text-overflow\s*:\s*ellipsis/g, 'text-overflow: clip')],
  ['deja el texto en varias lineas sin recorte',
    c => c.replace(/white-space\s*:\s*nowrap/g, 'white-space: normal')],
  ['quita el overflow hidden del titulo (el texto se sale de la celda)',
    c => c.replace(/overflow\s*:\s*hidden/g, 'overflow: visible')],
  ['deja el degradado puesto otra vez (el owner ya dijo que no lo quiere)',
    c => c.replace(/text-overflow\s*:\s*ellipsis;/g,
      'text-overflow: ellipsis;\n  mask-image: linear-gradient(to right, #000 calc(100% - 44px), transparent calc(100% - 10px));')],
  ['deja el "..." SOLO en styles.css, no en premium.css (las copias se contradicen)',
    c => c.replace(/(\.kair-month-event__title\s*\{[^}]*?)text-overflow\s*:\s*ellipsis;/g, '$1text-overflow: clip;')]
];

let mOk = 0;
const noDetectadas = [];
for (const [nombre, mut] of MUT) {
  try {
    if (correr(mut(PREM)).some(v => !v)) mOk++; else noDetectadas.push(nombre);
  } catch (e) { mOk++; }
}

// Dos mutaciones que el bloque de arriba no cubre, porque no son del CSS: el
// "..." en el style en linea del span, y el borde redondeado del chip.
{
  const sp = (/<span[^>]*kair-month-event__title[^>]*>/.exec(APPJS) || [])[0] || '';
  const spMutado = sp.replace('overflow:hidden;', 'overflow:hidden;text-overflow:ellipsis;');
  if (/text-overflow/.test(spMutado) && !/text-overflow/.test(sp)) mOk++; else noDetectadas.push('"..." en el style en linea');
  const sinRadio = PREM.replace(/border-radius\s*:\s*7px/g, 'border-radius: 0');
  if (!radios(soloCss(bloque(sinRadio, '.kair-month-event'))).some(v => v > 0)) mOk++; else noDetectadas.push('chip sin borde redondeado');
}

let fail = 0;
console.log('\n=======================================');
console.log('  📦880 · La pastilla del mes cabe y el "..." vuelve');
console.log('=======================================');
ok.forEach(x => { if (!x.c) fail++; console.log((x.c ? 'OK  ' : 'FAIL') + '  ' + x.n + (x.e ? '  [' + x.e + ']' : '')); });
console.log('---');
console.log('  checks: ' + (ok.length - fail) + '/' + ok.length);
console.log('  mutaciones: ' + mOk + '/10 mordieron'
  + (noDetectadas.length ? '  NO detectadas: ' + noDetectadas.join(' | ') : ''));
if (fail || mOk < 10) process.exit(1);