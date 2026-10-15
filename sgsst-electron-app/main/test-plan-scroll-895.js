'use strict';
// 895 · La lista del Cronograma tiene que seguir a la actividad seleccionada SIN
// que la pagina se mueva.
//
// QUE PASABA.
//
// selectAct() (plan-view.html) marca la actividad y llama a renderGantt(), que
// hace table.innerHTML = '' sobre #gantt-table. Ese elemento esta DENTRO de
// #gantt-scroll, asi que al vaciarlo el scrollTop del contenedor se recorta a 0 y
// la lista salta arriba. No habia ningun scrollIntoView en el archivo, o sea que
// nadie lo devolvia a su lugar. De ahi el "la barra esta hasta arriba del todo".
//
// EL TECHO, Y POR QUE ES ESTRUCTURAL.
//
// El owner marco una linea roja justo debajo de las tabs: el contenido no puede
// subir por encima de ahi, o el titulo y las tabs se esconderian. Eso no se
// cumple con un clamp, se cumple con la AUSENCIA del codigo que lo moveria:
//
//   scrollIntoView() recorre TODOS los ancestros scrolleables, incluido el
//   documento. Como aca el contenedor externo es el documento entero (.kair-page no
//   declara overflow), un scrollIntoView moveria la pagina y romperia el techo.
//
// Por eso lo unico que se escribe es sc.scrollTop, con sc = #gantt-scroll. El
// documento no tiene forma de moverse porque no hay ninguna linea que lo mueva.
// El check mas importante de este archivo es que siga siendo verdad.
//
// DOS MAS, QUE RESOLVIO EL OWNER.
//
// - Si la actividad esta en una carpeta cerrada, su fila NO existe (renderGantt
//   solo crea las filas de las carpetas abiertas): no se hace nada.
// - El margen de 24px es estetico; el clamp contra 0 lo desactiva solo en la
//   primera fila, que es donde no hay aire que poner.
//
// ESTE TEST TIENE DOS MITADES.
//
// La primera mira el CODIGO. La segunda lo EJECUTA: extrae la funcion real del
// archivo y la corre contra un DOM simulado con `vm`. Un check de texto no
// demuestra que la aritmetica del scroll sea correcta; ejecutarla si.
//
// LO QUE ESTE TEST PROTEGE:
//
// 1. QUE NO APAREZCA UN scrollIntoView. Es la mutacion que reintroduce el defecto
//    de forma invisible: el scroll "funciona" y el techo no.
// 2. QUE SE ESCRIBA UN SOLO scrollTop, y sea el del contenedor. Dos escrituras
//    significan que algo mas se esta moviendo.
// 3. QUE EL ORDEN SEA renderGantt -> scrollActIntoView. Al reves, el scroll corre
//    sobre la tabla vieja y mide un elemento que ya no existe.
// 4. QUE LA FILLA SE BUSQUE POR data-act, que es lo unico que escribe renderGantt.
//    Buscar por .is-sel funciona hoy y se rompe el dia que haya otra fila activa.
// 5. QUE LA ARITMETICA SEA CORRECTA: subir lo justo, bajar lo justo, no moverse si
//    ya esta visible, y no salirse de los limites del contenedor.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, '..');
const RUTA = 'modules/gestion-integral/plan-trabajo/plan-view.html';

function cargar() { return { html: fs.readFileSync(path.join(APP, RUTA), 'utf8') }; }

// El techo se revisa sobre CODIGO, no sobre texto: un comentario que explica por
// que NO se usa scrollIntoView no puede hacer fallar el check que lo prohibe.
// (Pasó de verdad: la primera versión se saltó por su propio comentario.)
function codigoDe(html) {
  return html
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function eolDe(t) {
  const b = Buffer.from(t, 'utf8');
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

// ── Segunda mitad: ejecutar la funcion real contra un DOM simulado ──────────
// El contenedor se comporta como el de la pagina: 400 px visibles de 2000 de
// contenido, o sea max = 1600.
const ALTO_VISIBLE = 400;
const ALTO_CONTENIDO = 2000;
const MARGEN = 24;

function contenedorSimulado(fila) {
  return {
    scrollTop: 0,
    clientHeight: ALTO_VISIBLE,
    scrollHeight: ALTO_CONTENIDO,
    getBoundingClientRect: function () { return { top: 0, bottom: ALTO_VISIBLE }; },
    querySelector: function (sel) {
      if (!fila) return null;
      return sel.indexOf('data-act') >= 0 ? fila : null;
    }
  };
}

function filaSimulada(top) {
  return {
    getBoundingClientRect: function () { return { top: top, bottom: top + 40 }; }
  };
}

function correrReal(html, filaTop, filaId) {
  const fuente = /var SCROLL_MARGIN = \d+;[\s\S]*?\nfunction scrollActIntoView\(\)\{[\s\S]*?\n\}/.exec(html);
  if (!fuente) return { error: 'no se pudo extraer la funcion del archivo' };
  const sc = contenedorSimulado(filaTop === null ? null : filaSimulada(filaTop));
  const sandbox = {
    actSel: filaId === null ? null : { id: filaId },
    $: function (sel) { return sel === '#gantt-scroll' ? sc : null; }
  };
  vm.createContext(sandbox);
  try {
    vm.runInContext(fuente[0], sandbox);
    if (typeof sandbox.scrollActIntoView !== 'function') {
      return { error: 'la funcion no quedo definida en el sandbox' };
    }
    sandbox.scrollActIntoView();
    return { scrollTop: sc.scrollTop };
  } catch (e) {
    return { error: e.message };
  }
}

function evaluar(F) {
  const cod = codigoDe(F.html);

  // ---- 1. La funcion existe y apunta al contenedor correcto ----------------
  const m = /function scrollActIntoView\(\)\{([\s\S]*?)\n\}/.exec(cod);
  chk('existe scrollActIntoView()', !!m);
  const cuerpo = m ? m[1] : '';

  chk('mueve SOLO #gantt-scroll', /#gantt-scroll/.test(cuerpo),
    'el contenedor scrolleable de la lista es #gantt-scroll');
  chk('la fila se busca por data-act', /querySelector\('\[data-act="'/.test(cuerpo),
    'data-act es lo unico que escribe renderGantt');
  chk('mide con getBoundingClientRect, no con offsetTop',
    /getBoundingClientRect/.test(cuerpo),
    'offsetTop depende del offsetParent, que no es el contenedor');

  // ---- 2. EL TECHO: la invariante central ---------------------------------
  chk('TECHO · no hay ninguna llamada a scrollIntoView',
    !/scrollIntoView\s*\(/.test(cod),
    'scrollIntoView recorre el documento y esconderia el titulo y las tabs');
  chk('TECHO · no se toca window.scrollTo/scrollBy',
    !/window\.scroll(To|By)\s*\(/.test(cod));
  chk('TECHO · no se toca el scrollTop del documento',
    !/document\.(documentElement|body)\.scrollTop\s*=/.test(cod));

  const escrituras = (cod.match(/scrollTop\s*=/g) || []).length;
  chk('TECHO · hay exactamente una escritura de scrollTop en el archivo',
    escrituras === 1, 'hay ' + escrituras);
  chk('TECHO · la unica escritura es la del contenedor',
    /sc\.scrollTop\s*=/.test(cod),
    'la escritura tiene que ser sc.scrollTop, con sc = #gantt-scroll');

  // ---- 3. Carpeta cerrada --------------------------------------------------
  chk('carpeta cerrada · aborta si no hay fila',
    /var row = sc\.querySelector\([^;]*\);\s*\n\s*if \(!row\) return;/.test(cuerpo),
    'sin esta guarda, una actividad en carpeta cerrada lanza sobre null');
  chk('carpeta cerrada · aborta si no hay contenedor ni seleccion',
    /if \(!sc \|\| !actSel\) return;/.test(cuerpo));

  // ---- 4. El orden dentro de selectAct ------------------------------------
  const sel = /function selectAct\(id, fromUser\)\{([\s\S]*?)\n\}/.exec(cod);
  chk('se encontro selectAct()', !!sel);
  const sc2 = sel ? sel[1] : '';
  const iRender = sc2.indexOf('renderGantt()');
  const iScroll = sc2.indexOf('scrollActIntoView()');
  chk('selectAct llama al auto-scroll', iScroll >= 0, 'la lista no sigue a la seleccion');
  chk('ORDEN · renderGantt va ANTES del scroll',
    iRender >= 0 && iScroll > iRender,
    'si el scroll corre antes, mide la tabla vieja');
  chk('ORDEN · el scroll va despues de reconstruir y antes de renderMesGrid',
    iScroll > iRender && (sc2.indexOf('renderMesGrid()') < 0 || iScroll < sc2.indexOf('renderMesGrid()')));

  // ---- 5. Los limites declarados ------------------------------------------
  chk('limites · recorta por arriba contra 0', /if \(desired < 0\) desired = 0;/.test(cuerpo));
  chk('limites · recorta por abajo contra scrollHeight - clientHeight',
    /var max = sc\.scrollHeight - sc\.clientHeight;/.test(cuerpo) && /if \(desired > max\) desired = max;/.test(cuerpo));
  chk('limites · un max negativo se vuelve 0', /if \(max < 0\) max = 0;/.test(cuerpo));

  // ---- 6. Que la premisa del data-act siga siendo cierta -------------------
  chk('renderGantt sigue escribiendo data-act', /row\.setAttribute\('data-act'/.test(cod),
    'sin data-act el selector del scroll no encuentra nada');
  chk('renderGantt sigue creando filas solo de carpetas abiertas',
    /if \(folder\.abierto\)\{/.test(cod),
    'de esto depende que "carpeta cerrada = no hay fila"');

  // ---- 7. LA ARITMETICA, ejecutando la funcion real ------------------------
  const r1 = correrReal(cod, 100, 7);
  chk('aritmetica · fila de 100 a 140, dentro de la vista 0-400: no se mueve',
    !r1.error && r1.scrollTop === 0, r1.error || ('quedo en ' + r1.scrollTop));

  const r2 = correrReal(cod, 1500, 9);
  chk('aritmetica · fila de 1500 a 1540: baja lo justo mas el margen',
    !r2.error && r2.scrollTop === (1540 - ALTO_VISIBLE) + MARGEN,
    r2.error || ('quedo en ' + r2.scrollTop));

  const r3 = correrReal(cod, 1990, 11);
  chk('aritmetica · ultima fila: se detiene en el maximo del contenedor',
    !r3.error && r3.scrollTop === (ALTO_CONTENIDO - ALTO_VISIBLE),
    r3.error || ('quedo en ' + r3.scrollTop + ', max es ' + (ALTO_CONTENIDO - ALTO_VISIBLE)));

  const r4 = correrReal(cod, null, 3);
  chk('aritmetica · actividad en carpeta cerrada: no lanza y no mueve nada',
    !r4.error && r4.scrollTop === 0, r4.error || ('quedo en ' + r4.scrollTop));

  const r5 = correrReal(cod, null, null);
  chk('aritmetica · sin seleccion: no lanza', !r5.error, r5.error || '');

  // ---- 8. EOL y caracteres -------------------------------------------------
  const e = eolDe(F.html);
  chk('EOL · plan-view.html sigue en LF puro', e.crlf === 0 && e.lf > 0, 'CRLF=' + e.crlf);
  chk('caracteres · sin U+FFFD', F.html.indexOf('\uFFFD') < 0);
  const mal = /[\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff\uac00-\ud7af]/g;
  chk('caracteres · sin CJK, cirilico ni hangul', !mal.test(F.html));

  return { n, f: fallidos.length };
}

// ── Mutaciones ──────────────────────────────────────────────────────────────
const F0 = cargar();

const MUT = [
  ['se reintroduce scrollIntoView (el scroll "funciona" pero el techo no)',
    f => { f.html = f.html.replace('var SCROLL_MARGIN = 24;', 'var SCROLL_MARGIN = 24;\n  row.scrollIntoView({block:\'nearest\'});'); }],
  ['se mueve el documento con window.scrollTo',
    f => { f.html = f.html.replace('if (desired !== sc.scrollTop) sc.scrollTop = desired;', 'window.scrollTo(0, 0);'); }],
  ['se mueve el documento con document.body.scrollTop',
    f => { f.html = f.html.replace('var SCROLL_MARGIN = 24;', 'var SCROLL_MARGIN = 24;\n  document.body.scrollTop = 0;'); }],
  ['se toca scrollTop dos veces (la segunda fuera del contenedor)',
    f => { f.html = f.html.replace('if (desired !== sc.scrollTop) sc.scrollTop = desired;', 'sc.scrollTop = desired;\n  document.documentElement.scrollTop = 0;'); }],
  ['desaparece la guarda de carpeta cerrada',
    f => { f.html = f.html.replace("  var row = sc.querySelector('[data-act=\"' + actSel.id + '\"]');\n  if (!row) return;\n", "  var row = sc.querySelector('[data-act=\"' + actSel.id + '\"]');\n"); }],
  ['el scroll corre ANTES de reconstruir la tabla',
    f => { f.html = f.html.replace('  renderGantt();\n  /* 895', '  scrollActIntoView();\n  renderGantt();\n  /* 895'); }],
  ['selectAct deja de llamar al auto-scroll',
    f => { f.html = f.html.replace('  scrollActIntoView();\n  renderMesGrid();', '  renderMesGrid();'); }],
  ['la fila se busca por .is-sel en vez de data-act',
    f => { f.html = f.html.replace("sc.querySelector('[data-act=\"' + actSel.id + '\"]')", "sc.querySelector('.is-sel')"); }],
  ['el contenedor deja de ser #gantt-scroll',
    f => { f.html = f.html.replace("var sc = $('#gantt-scroll');", "var sc = $('#otro-contenedor');"); }],
  ['desaparece el recorte por arriba',
    f => { f.html = f.html.replace('  if (desired < 0) desired = 0;\n', ''); }],
  ['desaparece el recorte por abajo',
    f => { f.html = f.html.replace('  if (desired > max) desired = max;\n', ''); }],
  ['se cambia getBoundingClientRect por offsetTop (que depende del offsetParent)',
    f => {
      f.html = f.html.replace('var scR = sc.getBoundingClientRect();', 'var scR = { top: sc.offsetTop, bottom: sc.offsetTop + sc.clientHeight };');
      f.html = f.html.replace('var rowR = row.getBoundingClientRect();', 'var rowR = { top: row.offsetTop, bottom: row.offsetTop + row.offsetHeight };');
    }],
  ['el margen se vuelve 0 (la fila queda pegada al borde)',
    f => { f.html = f.html.replace('var SCROLL_MARGIN = 24;', 'var SCROLL_MARGIN = 0;'); }],
  ['se invierte el signo al bajar (la lista se mueve al reves)',
    f => { f.html = f.html.replace('desired = sc.scrollTop + (rowR.bottom - scR.bottom) + SCROLL_MARGIN;', 'desired = sc.scrollTop - (rowR.bottom - scR.bottom) - SCROLL_MARGIN;'); }],
  ['renderGantt deja de escribir data-act',
    f => { f.html = f.html.replace("row.setAttribute('data-act', a.id);", ''); }],
  ['plan-view.html pasa a CRLF',
    f => { f.html = f.html.split('\n').join('\r\n'); }],
  ['se cuela un caracter prohibido',
    // en escapes, no literal: el test tambien cumple la regla
    f => { f.html = f.html.replace('/* ---------------- Auto-scroll con techo (895) ----------------', '/* ---------------- Auto-scroll con techo (895) \u57f9\u8bad ----------------'); }]
];

let mutDetectadas = 0; let mutVacias = 0;
for (const par of MUT) {
  const nombre = par[0]; const aplicar = par[1];
  const F = { html: F0.html };
  try { aplicar(F); } catch (e) { mutVacias++; console.log('FAIL MUTANTE LANZO ' + nombre + ': ' + e.message); continue; }
  if (F.html === F0.html) { mutVacias++; console.log('FAIL MUTANTE VACIO ' + nombre); continue; }
  fallidos.length = 0; registro.length = 0; n = 0;
  const r = evaluar(F);
  if (r.f > 0) mutDetectadas++;
  else console.log('FAIL MUTANTE NO DETECTADO ' + nombre);
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
