'use strict';
// 📦857 · "Tipos de evento" cuenta lo que el calendario está mostrando, y las
// TRES secciones del sidebar existen siempre.
//
// Tres cosas reportó el owner en una sola tanda:
//
//  1. La lista mostraba categorías en cero. Ya no: se filtran las que no tienen
//     eventos en el rango (esto lo mide 856; acá se vigila que no vuelva).
//  2. En vista Mes debe contar EL MES, no el año. Antes contaba todo el año:
//     el footer decía "224 evento(s) en el rango visible" y eran 224 del año
//     entero. Los números no describían nada de lo que estaba en pantalla.
//  3. Al elegir un día en el mini, la sección debe mostrar ESE día. Y "Tu día"
//     no puede desaparecer cuando la lista crece: faltaba altura y la tercera
//     tarjeta se salía del contenedor, recortada sin scroll posible.
//
// Alcance, filtro y layout se prueban contra la FORMA REAL de los datos y
// contra el CSS real, no contra una copia.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'renderer', 'bandeja-integrada');
const RANGO = new RegExp('[\\u4e00-\\u9fff\\u3040-\\u30ff\\u0400-\\u04ff\\uac00-\\ud7af]', 'g');

function soloCodigo(x) {
  return x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}
function eolDe(s) {
  const c = (s.match(/\r\n/g) || []).length;
  const l = (s.match(/\n/g) || []).length;
  return c > 0 && c === l ? 'CRLF' : (c === 0 ? 'LF' : 'MIXTO');
}
// 📦857 — Los comentarios CSS se quitan antes de matchear DECLARACIONES. Los
// comentarios que explican este arreglo mencionan literalmente
// `overflow-y: auto` y `min-height: 0`; sin esto los checks se satisfacen a sí
// mismos con la nota al lado y pasan aunque la declaración se haya roto.
function sinComentarios(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function evaluar(htm, css, js) {
  const fallos = [];
  let n = 0;
  const chk = (nombre, c, e) => { n++; if (!c) fallos.push(nombre + (e ? '  [' + e + ']' : '')); };
  const cod = soloCodigo(js);

  // ── 1) El alcance es una función pura y existe ──
  chk('existe alcanceFechas(op) como funcion pura',
    /function alcanceFechas\(op\)/.test(cod),
    'sin ella el alcance queda escondido en el render y no se puede probar');
  chk('la vista Mes usa las celdas de la grilla, no un filtro de mes completo',
    /const fechas = \(op\.celdasMes \|\| \[\]\)\.map/ .test(cod),
    'si filtrara por inMonth, el contador no cuadraria con lo que hay pintado: la grilla muestra dias en gris del mes vecino');
  chk('la vista Dia usa selectedDate',
    /op\.calView === "day" \|\| op\.calView === "schedule"/.test(cod) && /etiquetaDia\(sel\)/.test(cod));
  chk('la vista Semana son 7 dias desde el lunes',
    /dow === 0 \? -6 : 1 - dow/.test(cod) && /for \(let i = 0; i < 7; i\+\+\)/.test(cod));
  chk('el dia fijado por el owner manda sobre la vista',
    /if \(modoForzado === "dia"\)/.test(cod),
    'un clic simple en el mini NO cambia calView, asi que sin esto no habria forma de saber que eligio un dia');

  // ── 2) El estado que fija y suelta el alcance ──
  chk('existe state.alcanceTipos', /alcanceTipos: null/.test(cod));
  chk('un clic en el mini FIJA el dia',
    /function seleccionarDiaDelMini\(iso, irAVistaDia\) \{[\s\S]{0,400}state\.alcanceTipos = "dia";/.test(cod),
    'sin esto el clic solo resaltaba y el contador seguia mostrando el mes');
  chk('navegar de mes suelta el dia fijado',
    /function changeMonth\(delta\) \{[\s\S]{0,500}state\.alcanceTipos = null;/.test(cod),
    'si no, el contador queda clavado en un dia de un mes que ya no se ve');
  chk('"Hoy" y el cambio de vista sueltan el dia fijado',
    /btn-today"\)[\s\S]{0,200}state\.alcanceTipos = null/.test(cod) &&
      /kair-cal-toolbar__view"\)[\s\S]{0,200}state\.alcanceTipos = null/.test(cod));
  chk('el "mas" de una celda del mes tambien fija el dia',
    /state\.calView = "day";\s*state\.alcanceTipos = "dia";/.test(cod));

  // ── 3) El encabezado DICE de donde sale el numero ──
  chk('el encabezado muestra el rotulo del alcance',
    /class="tipos__alcance" data-modo=/.test(cod) && /\.tipos__alcance/.test(css),
    'una columna de cifras sin contexto no informa nada');
  chk('el boton de volver al mes es emergente, no permanente',
    /fijado \? '<button type="button" class="tipos__volver"/.test(cod),
    'solo tiene sentido cuando se esta mirando un dia; siempre presente es ruido');
  chk('volver al mes suelta el alcance',
    /verMes\.addEventListener[\s\S]{0,200}state\.alcanceTipos = null;/.test(cod));

  // ── 4) Las TRES secciones no pueden desaparecer ──
  chk('el sidebar puede scrollear (overflow-y: auto, NO hidden)',
    sinComentarios(css).match(/\.kair-sidebar \{[^}]*overflow-y:\s*auto;/) !== null
      && sinComentarios(css).match(/\.kair-sidebar \{[^}]*overflow:\s*hidden;/) === null,
    'con hidden la tercera tarjeta se salia y quedaba recortada sin forma de llegar');
  chk('mini y Tu dia son de altura fija (nunca se encogen ni se van)',
    sinComentarios(css).match(/\.kair-sidebar > \.mini,\s*\.kair-sidebar > \.tuday \{ flex: none; \}/) !== null);
  chk('Tipos de evento es la unica que cede espacio, y cede por dentro',
    // `[^}]*` y NO un rango `[\s\S]{0,N}`: con el rango, la ventana alcanza el
    // `flex: 1 1 auto` del bloque SIGUIENTE (#tipos-list) y el check pasa aunque
    // el de .tipos haya cambiado. Anclado a la misma llave, no puede.
    // Y `sinComentarios` porque el comentario que explica el arreglo menciona
    // las mismas palabras: sin esto el check se satisface a si mismo.
    sinComentarios(css).match(/\.kair-sidebar > \.tipos \{[^}]*flex: 1 1 auto;/) !== null
      && sinComentarios(css).match(/\.kair-sidebar > \.tipos \{[^}]*min-height: 0;/) !== null,
    'sin min-height:0 un hijo flexible no baja de su altura minima y el padre se desborda: ese es el mecanismo exacto del bug');
  chk('la lista de tipos scrollea por dentro',
    sinComentarios(css).match(/\.tipos > #tipos-list \{[^}]*overflow-y: auto;/) !== null);

  // ── 5) No se repite la logica ──
  chk('el render delega el filtro de fechas en alcanceFechas',
    /const alcance = alcanceFechas\(\{/.test(cod), 'si no, el calculo se duplica');
  chk('el render delega el conteo en contarTipos',
    /const tipos = contarTipos\(\s*visibleEvents\.filter/.test(cod));

  return { f: fallos.length, n, fallos };
}

// ══════ funcional: alcance real contra la forma real de los datos ══════
function escenario(js) {
  const fallos = [];
  let n = 0;
  const chk = (nombre, c, e) => { n++; if (!c) fallos.push(nombre + (e ? '  [' + e + ']' : '')); };

  const partes = ['alcanceFechas', 'contarTipos', 'isoDe'];
  let codigo = '';
  for (const nm of partes) {
    const m = js.match(new RegExp('^  (?:function ' + nm + '\\(|[\\s\\S]{0,4}function ' + nm + '=)[\\s\\S]*?\\n  \\}', 'm'));
    if (!m) { chk('se encontro ' + nm + ' en el archivo real', false); return { f: fallos.length, n, fallos }; }
    codigo += m[0] + '\n';
  }
  chk('se extrajeron las funciones puras del archivo real', true);

  const etiquetaDia = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  };
  const fn = new Function('etiquetaDia', codigo + '\nreturn { alcanceFechas: alcanceFechas, contarTipos: contarTipos };');
  const api = fn(etiquetaDia);

  // Fechas reales de la grilla de octubre 2026 tal como las trae el calendario:
  // lunes 28 de septiembre hasta domingo 8 de noviembre.
  const celdasOct = [];
  (function () {
    // 1 de octubre de 2026 es jueves (getDay() = 4). La grilla arranca el
    // LUNES anterior, 3 días antes. `off` es lo que se SUMA al día 1, así que
    // va en NEGATIVO: 1 + (-3) = -2 → 28 de septiembre. Con el signo al revés
    // la grilla arrancaba el 4 de octubre y el test contaba la mitad.
    const ini = new Date(2026, 9, 1);
    const off = 1 - ini.getDay();
    for (let i = 0; i < 42; i++) {
      const d = new Date(2026, 9, 1 + off + i);
      celdasOct.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
    }
  })();

  // Eventos con la forma real: 3 el 3 de oct, 1 el 5, 1 el 12, 1 en AGOSTO
  // (fuera del mes), y 2 sin categoría reconocible para probar el filtro.
  const eventos = [
    { id: 'a', category: 'rapido', date: '2026-10-03' },
    { id: 'b', category: 'rapido', date: '2026-10-03' },
    { id: 'c', category: 'inspeccion', date: '2026-10-03' },
    { id: 'd', category: 'rapido', date: '2026-10-05' },
    { id: 'e', category: 'gestion', date: '2026-10-12' },
    { id: 'f', category: 'rapido', date: '2026-08-01' },
  ];
  const enAlcance = (alc) => {
    const set = {};
    alc.fechas.forEach((f) => { set[f] = true; });
    return eventos.filter((e) => set[e.date]);
  };
  const OFICIALES = { plan: {}, capacitacion: {}, auditoria: {} };

  try {
    // ── Mes ──
    const mes = api.alcanceFechas({
      calView: 'month', selectedDate: '2026-10-03', alcanceTipos: null,
      hoyIso: '2026-10-03', celdasMes: celdasOct, etiquetaMes: 'Octubre 2026',
    });
    chk('📦857 · en vista Mes el alcance es la grilla entera',
      mes.modo === 'mes' && mes.fechas.length === celdasOct.length, 'modo=' + mes.modo + ' n=' + mes.fechas.length);
    chk('el mes incluye los dias en gris del mes vecino (28, 29, 30 de septiembre)',
      mes.fechas.indexOf('2026-09-28') >= 0, 'la grilla los muestra: el contador tambien debe');
    const tMes = api.contarTipos(enAlcance(mes), OFICIALES);
    chk('📦857 · en Mes cuenta solo los del mes, NO el año',
      tMes.conteo.rapido === 3 && tMes.conteo.gestion === 1,
      'conteo=' + JSON.stringify(tMes.conteo));
    chk('un evento de agosto NO se cuenta en octubre',
      tMes.conteo.rapido !== 4, 'conteo.rapido=' + tMes.conteo.rapido);
    chk('la suma de la seccion cuadra con lo que hay en la grilla',
      Object.keys(tMes.conteo).reduce((s, k) => s + tMes.conteo[k], 0) === enAlcance(mes).length,
      'suma=' + Object.keys(tMes.conteo).reduce((s, k) => s + tMes.conteo[k], 0) + ' eventos=' + enAlcance(mes).length);

    // ── Dia fijado por el owner (clic simple en el mini) ──
    const dia = api.alcanceFechas({
      calView: 'month', selectedDate: '2026-10-03', alcanceTipos: 'dia',
      hoyIso: '2026-10-03', celdasMes: celdasOct, etiquetaMes: 'Octubre 2026',
    });
    chk('📦857 · un dia elegido manda aunque la vista siga en Mes',
      dia.modo === 'dia' && dia.fechas.length === 1 && dia.fechas[0] === '2026-10-03',
      'alcance=' + JSON.stringify(dia.fechas));
    const tDia = api.contarTipos(enAlcance(dia), OFICIALES);
    chk('en dia cuenta solo ese dia',
      tDia.conteo.rapido === 2 && tDia.conteo.inspeccion === 1 && tDia.conteo.gestion === undefined,
      'conteo=' + JSON.stringify(tDia.conteo));
    chk('las categorias en cero no aparecen (ya no hay filas de 0)',
      tDia.ids.indexOf('plan') < 0 && tDia.ids.indexOf('capacitacion') < 0,
      'ids=' + JSON.stringify(tDia.ids));
    chk('el dia trae un rotulo legible, no un id crudo',
      /octubre/.test(dia.etiqueta), 'etiqueta=' + dia.etiqueta);

    // ── Dia por vista Dia (doble clic) ──
    const porVista = api.alcanceFechas({
      calView: 'day', selectedDate: '2026-10-12', alcanceTipos: null,
      hoyIso: '2026-10-03', celdasMes: celdasOct, etiquetaMes: 'Octubre 2026',
    });
    chk('la vista Dia da el mismo resultado que el dia fijado',
      porVista.modo === 'dia' && porVista.fechas[0] === '2026-10-12',
      'alcance=' + JSON.stringify(porVista.fechas));

    // ── Semana: 7 dias desde el lunes ──
    const sem = api.alcanceFechas({
      calView: 'week', selectedDate: '2026-10-07', alcanceTipos: null,
      hoyIso: '2026-10-03', celdasMes: celdasOct, etiquetaMes: 'Octubre 2026',
    });
    chk('la semana son 7 dias empezando el lunes (2026-10-05)',
      sem.modo === 'semana' && sem.fechas.length === 7 && sem.fechas[0] === '2026-10-05',
      'fechas=' + JSON.stringify(sem.fechas));

    // ── Sin nada que contar: el estado vacio, no seis ceros ──
    const nada = api.contarTipos([], OFICIALES);
    chk('sin eventos la seccion queda vacia para pintar el estado vacio',
      nada.ids.length === 0, 'ids=' + JSON.stringify(nada.ids));
  } catch (e) {
    chk('el escenario corre sin romperse', false, e.message);
  }
  return { f: fallos.length, n, fallos };
}

const crudo = {
  htm: fs.readFileSync(path.join(DIR, 'index.html'), 'utf8').replace(/\r\n/g, '\n'),
  css: fs.readFileSync(path.join(DIR, 'premium.css'), 'utf8').replace(/\r\n/g, '\n'),
  js: fs.readFileSync(path.join(DIR, 'app.js'), 'utf8').replace(/\r\n/g, '\n'),
};

const real = evaluar(crudo.htm, crudo.css, crudo.js);
const esc = escenario(crudo.js);
real.n += esc.n; real.f += esc.f;
real.fallos = real.fallos.concat(esc.fallos);

[['app.js sigue en CRLF', eolDe(fs.readFileSync(path.join(DIR, 'app.js'), 'utf8')), 'CRLF'],
 ['premium.css sigue en LF', eolDe(fs.readFileSync(path.join(DIR, 'premium.css'), 'utf8')), 'LF'],
 ['sin CJK en app.js', (fs.readFileSync(path.join(DIR, 'app.js'), 'utf8').match(RANGO) || []).length, 0],
 ['sin CJK en premium.css', (fs.readFileSync(path.join(DIR, 'premium.css'), 'utf8').match(RANGO) || []).length, 0],
 ['sin CJK en este test', (fs.readFileSync(__filename, 'utf8').match(RANGO) || []).length, 0],
].forEach((e) => {
  real.n++;
  if (e[1] !== e[2]) { real.f++; real.fallos.push(e[0] + '  [' + e[1] + ', esperado ' + e[2] + ']'); }
});

// ═══════════════ mutation testing ═══════════════
const MUT = [
  ['el alcance vuelve a ser el mes completo ignorando el dia fijado (vuelve el bug reportado)',
    j => j.replace('    if (modoForzado === "dia") {', '    if (false) {')],
  ['el mes se filtra por inMonth y deja de contar los dias en gris (no cuadra con la grilla)',
    j => j.replace('    const fechas = (op.celdasMes || []).map(function (c) { return c; });',
      '    const fechas = (op.celdasMes || []).filter(function (c) { return c && c.inMonth; });')],
  ['la vista Mes se salta y siempre cuenta el dia (el numero contradice la pantalla)',
    j => j.replace('    if (op.calView === "day" || op.calView === "schedule") {', '    if (false) {')],
  ['la semana no son 7 dias (cuenta 1)',
    j => j.replace('      for (let i = 0; i < 7; i++) {', '      for (let i = 0; i < 1; i++) {')],
  ['la semana arranca en domingo en vez de lunes',
    j => j.replace('lunes.setDate(ref.getDate() + (dow === 0 ? -6 : 1 - dow));',
      'lunes.setDate(ref.getDate() - dow);')],
  ['el clic del mini deja de fijar el dia (vuelve el bug reportado)',
    j => j.replace('    state.alcanceTipos = "dia";\n    const d = new Date(iso + "T00:00:00");', '    const d = new Date(iso + "T00:00:00");')],
  ['navegar de mes deja de soltar el dia (queda clavado en un dia viejo)',
    j => j.replace('    state.viewMonthLabel = D.buildMonthLabel(y, m);\n    // 📦857 — Navegar a otro mes suelta el día fijado: si no, el contador\n    // seguiría clavado en un día del mes que ya no se está viendo.\n    state.alcanceTipos = null;\n    render();\n  }',
      '    state.viewMonthLabel = D.buildMonthLabel(y, m);\n    render();\n  }')],
  ['el boton de volver al mes deja de soltar el alcance',
    j => j.replace('        state.alcanceTipos = null;\n        render();\n      });', '        render();\n      });')],
  ['el encabezado deja de decir el alcance (cifras sin contexto)',
    j => j.replace('<span class="tipos__alcance" data-modo="\' + alcance.modo + \'">\' + alcance.etiqueta + \'</span>', '')],
  ['el boton de volver al mes queda permanente (ruido cuando se ve el mes)',
    j => j.replace("fijado ? '<button type=\"button\" class=\"tipos__volver\"", "'<button type=\"button\" class=\"tipos__volver\"")],
];

let mFallos = 0, vacios = 0;
MUT.forEach((m) => {
  const mut = m[1](crudo.js);
  if (mut === crudo.js) { vacios++; mFallos++; console.log('FAIL MUTANTE VACIO  ' + m[0]); return; }
  const d = evaluar(crudo.htm, crudo.css, mut).f + escenario(mut).f;
  if (d === 0) mFallos++;
  console.log((d > 0 ? 'OK  detecta      ' : 'FAIL NO muerde   ') + m[0]);
});

// Mutaciones de CSS: el layout es media parte del bug ("Tu dia desaparecia").
const MUT_CSS = [
  ['el sidebar vuelve a overflow hidden (Tu dia se recorta y desaparece)',
    c => c.replace('  overflow-y: auto;\n  overflow-x: hidden;', '  overflow: hidden;')],
  ['Tipos de evento deja de ceder espacio (empuja a Tu dia fuera del alto)',
    c => c.replace('.kair-sidebar > .tipos {\n  flex: 1 1 auto;', '.kair-sidebar > .tipos {\n  flex: none;')],
  ['se quita min-height:0 en Tipos (el padre se desborda y Tu dia se va)',
    c => c.replace('.kair-sidebar > .tipos {\n  flex: 1 1 auto;\n  min-height: 0;', '.kair-sidebar > .tipos {\n  flex: 1 1 auto;')],
  ['la lista de tipos deja de scrollear por dentro',
    c => c.replace('.tipos > #tipos-list {\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow-y: auto;', '.tipos > #tipos-list {\n  flex: 1 1 auto;')],
];
MUT_CSS.forEach((m) => {
  const mut = m[1](crudo.css);
  if (mut === crudo.css) { vacios++; mFallos++; console.log('FAIL MUTANTE VACIO  ' + m[0]); return; }
  const d = evaluar(crudo.htm, mut, crudo.js).f + escenario(crudo.js).f;
  if (d === 0) mFallos++;
  console.log((d > 0 ? 'OK  detecta      ' : 'FAIL NO muerde   ') + m[0]);
});

console.log('---');
console.log('checks: ' + (real.n - real.f) + '/' + real.n
  + '  ·  mutaciones detectadas: ' + (MUT.length + MUT_CSS.length - mFallos) + '/' + (MUT.length + MUT_CSS.length)
  + (vacios ? '  ·  mutantes vacios: ' + vacios : ''));
if (real.f || mFallos) {
  if (real.f) { console.log('FALLOS:'); real.fallos.forEach((f) => console.log('  - ' + f)); }
  process.exit(1);
}
console.log('OK');
