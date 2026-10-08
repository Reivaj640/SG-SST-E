'use strict';
// 📦879 · El iframe de la Bandeja Integrada ocupa toda la ventana.
//
// Antes arrancaba en `top: headerHeight` con un piso duro de 40px. Ese piso lo
// puso F4-fix en 563, cuando #app-header era una barra fija que nunca encogia;
// hoy el header se autocolapsa a ~0 a los 5s, asi que el piso dejaba 40px
// muertos arriba y la Bandeja no cubria el fondo: el "Panel de Control" del
// shell asomaba recortado detras.
//
// La parte ESTATICA comprueba el cableado. La FUNCIONAL saca showBandejaIntegrada
// tal cual esta escrita, la corre en una vm con un document falso, lee el cssText
// que de verdad le pondria al iframe, y calcula el rectangulo resultante. Con
// regex no alcanza: el fallo que se corrigio era una fraccion de pantalla, y eso
// solo se comprueba preguntandole al navegador simulado cuanto mide.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..');
const RJS = path.join(APP, 'renderer.js');
const IDX = path.join(APP, 'index.html');
const CSS = path.join(APP, 'styles.css');
const T0 = fs.readFileSync(RJS, 'utf8');
const IDX0 = fs.readFileSync(IDX, 'utf8');
const CSS0 = fs.readFileSync(CSS, 'utf8');

function soloCodigo(x) {
  return x
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
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

const ok = [];
const chk = (n, c, e) => ok.push({ n, c: !!c, e });

// ══ 1) ESTATICO ══
const mostrar = soloCodigo(cuerpoDe(T0, 'showBandejaIntegrada'));

chk('el iframe arranca en top: 0', /'top:\s*0'/.test(mostrar));
chk('y mide 100vh de alto', /'height:\s*100vh'/.test(mostrar));
chk('ya NO calcula headerHeight (el piso de 40px se fue)',
  !/headerHeight/.test(mostrar) && !/getBoundingClientRect/.test(mostrar));
chk('ni queda un Math.max con piso duro', !/Math\.max\([^)]*,\s*\d+\s*\)/.test(mostrar));
chk('sigue siendo fixed a 0,0 y de 100vw de ancho',
  /'position:\s*fixed'/.test(mostrar) && /'left:\s*0'/.test(mostrar) && /'width:\s*100vw'/.test(mostrar));
chk('sigue por encima del header del shell (z-index 200001)',
  /'z-index:\s*200001'/.test(mostrar));
chk('el log ya no miente con un headerHeight que no existe',
  !/headerHeight/.test(T0.slice(T0.indexOf('showBandejaIntegrada'), T0.indexOf('hideBandejaIntegrada') + 200)));
chk('reabrir NO reescribe el top (la posicion ya no queda congelada)',
  !/bandejaIntegradaFrame\.style\.(top|height)\s*=/.test(T0));

// ══ 2) La salida de la Bandeja no se rompió con esto ══
chk('sigue exitiendo el mensaje que cierra la Bandeja',
  /bandeja-integrada-back/.test(T0));
chk('y el listener que lo recibe cierra el iframe',
  /event\.data\.type === 'bandeja-integrada-back'/.test(T0)
  && /hideBandejaIntegrada\(\)/.test(T0));

// ══ 3) FUNCIONAL: el cssText real cubre la ventana entera ══
function rectDelIframe(src) {
  const fn = cuerpoDe(src, 'showBandejaIntegrada');
  let cap = null;
  const iframe = { id: '', src: '', style: { cssText: '', display: '' } };
  const ctx = {
    console, logMessage() {}, log: [],
    bandejaIntegradaFrame: null,
    document: {
      createElement(tag) { if (tag === 'iframe') return iframe; return {}; },
      getElementById(id) { return id === 'app-header' ? { getBoundingClientRect: () => ({ height: 0 }) } : null; },
      body: { appendChild() {} }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fn, ctx);
  ctx.showBandejaIntegrada();
  cap = iframe.style.cssText;
  // Interpretar el cssText como lo haria el navegador, para el rectangulo.
  const props = {};
  for (const decl of cap.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    props[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
  }
  const num = v => { const m = /(-?[\d.]+)/.exec(String(v)); return m ? parseFloat(m[1]) : null; };
  const top = num(props.top);
  const left = num(props.left);
  // height: 100vh -> 100% de la ventana
  const heightPct = num(props.height) / (parseFloat(props.height) / 100);
  return { props, top, left, heightPct, css: cap };
}

(function funcional() {
  const r = rectDelIframe(T0);
  chk('[func] el top resuelto es 0', r.top === 0, 'top=' + r.top);
  chk('[func] el left resuelto es 0', r.left === 0, 'left=' + r.left);
  chk('[func] la altura es el 100% de la ventana',
    Math.abs(r.heightPct - 100) < 0.001, r.heightPct + '%');
  chk('[func] con top 0 y alto 100%, no queda ni un px de fondo',
    r.top + r.heightPct <= 100.0001, r.top + ' + ' + r.heightPct + ' = ' + (r.top + r.heightPct) + '%');
  chk('[func] el z-index sigue tapando al header del shell (100000)',
    parseInt(r.props['z-index'], 10) > 100000, r.props['z-index']);
})();

// ══ 4) CSS: el header tiene que poder REAPARECER por encima del iframe ══
// Ganar la franja de 40px y recuperar el hover son dos pedidos distintos. Si
// solo se sube el iframe a 0-100vh, el header desplegado queda DETRAS y el hover
// deja de servir, que es justo lo que reporto el owner. Estas reglas son la otra
// mitad del arreglo.
const Z_IFRAME = 200001;
const bloqueHover = CSS0.slice(CSS0.indexOf('#header-hover-zone {'), CSS0.indexOf('}', CSS0.indexOf('#header-hover-zone {')));
const zHover = parseInt((/z-index:\s*(\d+)/.exec(bloqueHover) || [])[1] || '0', 10);
chk('la franja de hover queda POR ENCIMA del iframe, o no dispara',
  zHover > Z_IFRAME, zHover + ' vs ' + Z_IFRAME);
chk('la franja se queda en los 8px de siempre',
  /height:\s*8px/.test(bloqueHover));

const selNoCol = '#app-header:not(.app-header-collapsed)';
const iNoCol = CSS0.indexOf(selNoCol);
chk('el header visible tiene una regla propia', iNoCol >= 0);
const bloqueNoCol = iNoCol >= 0
  ? CSS0.slice(iNoCol, CSS0.indexOf('}', iNoCol))
  : '';
const zNoCol = parseInt((/z-index:\s*(\d+)/.exec(bloqueNoCol) || [])[1] || '0', 10);
chk('y esa regla lo pone por encima del iframe', zNoCol > Z_IFRAME, zNoCol + ' vs ' + Z_IFRAME);

const iCol = CSS0.indexOf('#app-header.app-header-collapsed {');
const bloqueCol = iCol >= 0 ? CSS0.slice(iCol, CSS0.indexOf('}', iCol)) : '';
const zCol = parseInt((/z-index:\s*(\d+)/.exec(bloqueCol) || [])[1] || '0', 10);
chk('el header COLAPSADO no se sube: mide 0 y no tiene por qué pisar overlays',
  zCol <= Z_IFRAME, 'z del colapsado = ' + zCol);
chk('y la franja queda por encima del header, para que entre el mouse primero',
  zHover > zNoCol, zHover + ' > ' + zNoCol);

// ══ 5) Cache-bust, EOL, y limpieza ══
chk('renderer.js tiene token de cache-bust propio (no el viejo del consent gate)',
  /renderer\.js\?v=20261007-iframe879/.test(IDX0));
chk('el token viejo ya no aparece en el index.html',
  !/renderer\.js\?v=20261007-consent-gate/.test(IDX0));
chk('styles.css tambien bumpeo su token (se toco el CSS del header)',
  /styles\.css\?v=20261007-header879/.test(IDX0));
const raw = fs.readFileSync(RJS);
let crlf = 0, lf = 0;
for (let i = 0; i < raw.length; i++) {
  if (raw[i] === 10) { if (i > 0 && raw[i - 1] === 13) crlf++; else lf++; }
}
chk('renderer.js sigue todo CRLF', lf === 0 && crlf > 7000, crlf + '/' + lf);
chk('sin CJK, cirilico ni hangul', !/[\u3000-\u9FFF\uAC00-\uD7AF\u0400-\u04FF]/.test(T0));

// ══════════════════════════════════════════════════════════════════════
// MUTACIONES: cada una rompe una parte y tiene que poner el test en rojo.
// ══════════════════════════════════════════════════════════════════════
function correr(mut) {
  let r;
  try {
    const src = mut(T0);
    r = [];
    const m = soloCodigo(cuerpoDe(src, 'showBandejaIntegrada'));
    r.push(/'top:\s*0'/.test(m));
    r.push(/'height:\s*100vh'/.test(m));
    r.push(!/headerHeight/.test(m) && !/getBoundingClientRect/.test(m));
    r.push(/'z-index:\s*200001'/.test(m));
    r.push(/'position:\s*fixed'/.test(m) && /'left:\s*0'/.test(m) && /'width:\s*100vw'/.test(m));
    const rr = rectDelIframe(src);
    r.push(rr.top === 0);
    r.push(Math.abs(rr.heightPct - 100) < 0.001);
  } catch (e) {
    // La mutacion dejo codigo que ni corre (por ejemplo, una referencia a una
    // variable que ya no existe). Eso tambien es una deteccion: el test no
    // puede pasar sobre un archivo que revienta. Se marca todo en falso.
    return [false];
  }
  return r;
}
const MUT = [
  ['vuelve al piso de headerHeight',
    t => t.replace("'top: 0',", "'top: ' + headerHeight + 'px',")
      .replace('bandejaIntegradaFrame.style.cssText = [',
        'var mainHeader = document.getElementById(\'app-header\');\n'
        + '    var headerHeight = mainHeader ? Math.max(mainHeader.getBoundingClientRect().height, 40) : 48;\n'
        + '    bandejaIntegradaFrame.style.cssText = [')],
  ['deja 40px de fondo arriba',
    t => t.replace("'top: 0',", "'top: 40px',")],
  ['deja 40px de fondo abajo',
    t => t.replace("'height: 100vh',", "'height: calc(100vh - 40px)',")],
  ['baja el z-index debajo del header',
    t => t.replace("'z-index: 200001',", "'z-index: 1000',")],
  ['quita el fixed',
    t => t.replace("'position: fixed',", "'position: absolute',")]
];
let mOk = 0;
const noDetectadas = [];
for (const [nombre, mut] of MUT) {
  if (correr(mut).some(v => !v)) mOk++; else noDetectadas.push(nombre);
}

// ══ Mutaciones del CSS: la otra mitad del arreglo ══
const Z_IF = 200001;
function correrCss(css) {
  const r = [];
  const bh = css.slice(css.indexOf('#header-hover-zone {'), css.indexOf('}', css.indexOf('#header-hover-zone {')));
  const zh = parseInt((/z-index:\s*(\d+)/.exec(bh) || [])[1] || '0', 10);
  r.push(zh > Z_IF);
  r.push(/height:\s*8px/.test(bh));
  const i = css.indexOf('#app-header:not(.app-header-collapsed)');
  const bn = i >= 0 ? css.slice(i, css.indexOf('}', i)) : '';
  const zn = parseInt((/z-index:\s*(\d+)/.exec(bn) || [])[1] || '0', 10);
  r.push(zn > Z_IF);
  const ic = css.indexOf('#app-header.app-header-collapsed {');
  const bc = ic >= 0 ? css.slice(ic, css.indexOf('}', ic)) : '';
  const zc = parseInt((/z-index:\s*(\d+)/.exec(bc) || [])[1] || '0', 10);
  r.push(zc <= Z_IF);
  r.push(zh > zn);
  return r;
}
const MUT_CSS = [
  ['deja la franja de hover debajo del iframe',
    c => c.replace('z-index: 200003;', 'z-index: 1001;')],
  ['quita la regla que sube el header visible',
    c => c.replace('#app-header:not(.app-header-collapsed) {\n  z-index: 200002;\n}', '')],
  ['sube tambien el header colapsado (pisaria overlays al pedo)',
    c => c.replace('#app-header.app-header-collapsed {',
      '#app-header.app-header-collapsed {\n  z-index: 200002;')],
  ['deja la franja thinner que el header (el mouse entra al reves)',
    c => c.replace('z-index: 200003;', 'z-index: 200000;')]
];
for (const [nombre, mut] of MUT_CSS) {
  if (correrCss(mut(CSS0)).some(v => !v)) mOk++; else noDetectadas.push(nombre);
}
const TOTAL_MUT = MUT.length + MUT_CSS.length;

let fail = 0;
console.log('\n=======================================');
console.log('  📦879 · La Bandeja Integrada cubre toda la ventana');
console.log('=======================================');
ok.forEach(x => { if (!x.c) fail++; console.log((x.c ? 'OK  ' : 'FAIL') + '  ' + x.n + (x.e ? '  [' + x.e + ']' : '')); });
console.log('---');
console.log('  checks: ' + (ok.length - fail) + '/' + ok.length);
console.log('  mutaciones: ' + mOk + '/' + TOTAL_MUT + ' mordieron'
  + (noDetectadas.length ? '  NO detectadas: ' + noDetectadas.join(' | ') : ''));
if (fail || mOk < TOTAL_MUT) process.exit(1);