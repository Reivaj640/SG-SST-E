// 📦856 · "Tipos de evento" contaba 6 categorias que ningun evento usa.
//
// La app lee los eventos de dos fuentes y las DOS devuelven category='rapido':
//   - eventos_rapidos-bridge.js:101  ->  type: row.tipo || 'rapido'
//   - shared/google-calendar.js:107  ->  category: kairCategory || 'rapido'
// y la leyenda contaba solo D.EVENT_CATEGORIES (plan, capacitacion, auditoria,
// actualizacion, formacion, critico). Verificado contra las 75 tablas de la BD
// real: ninguna guarda esas 6 categorias. Los contadores quedaban en 0 SIEMPRE.
//
// Este test corre la logica REAL de la leyenda contra datos con la FORMA REAL
// que llega desde las dos fuentes.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
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

function evaluar(htm, css, js) {
  const fallos = [];
  let n = 0;
  const chk = (nombre, c, e) => { n++; if (!c) fallos.push(nombre + (e ? '  [' + e + ']' : '')); };
  const cod = soloCodigo(js);

  // ── 1) La leyenda ya no cuenta solo las 6 oficiales ──
  chk('la leyenda NO se queda con las 6 categorias oficiales',
    !/const categorias = Object\.values\(D\.EVENT_CATEGORIES\)/.test(cod),
    'contando solo esas 6 el panel queda en 0 para siempre');
  chk('la logica de conteo vive en contarTipos (pura, sin DOM ni state)',
    /function contarTipos\(events, categoriasOficiales\)/.test(cod) &&
      /const conteo = \{\};\s*\(events \|\| \[\]\)\.forEach/.test(cod),
    'sin ella como funcion pura no se puede probar con datos reales');
  chk('contarTipos filtra las categorias en cero (no hay filas de 0)',
    /\.filter\(function \(id\) \{ return conteo\[id\] > 0; \}\)/.test(cod),
    'sin el filtro, las 6 oficiales —que activeCategories trae prendidas— vuelven a pantalla en cero');
  chk('el render delega en contarTipos en vez de repetir la logica',
    /const tipos = contarTipos\(\s*visibleEvents\.filter/.test(cod) &&
      !/const ids = Object\.keys\(conteoCat\)\.sort/.test(cod),
    'una copia de la logica en el render es una segunda verdad que se separa');
  // 📦857 — InVERTIDO: antes `contarTipos` recibía `categoriasApagadas` y las
  // metía a la lista aunque tuvieran 0, y como `activeCategories` arranca con
  // las 6 oficiales prendidas, las 6 reaparecían en pantalla en cero (que es lo
  // que reportó el owner). El contrato nuevo es: SOLO las que tienen eventos.
  chk('una categoria apagada con eventos sigue apareciendo (para reencenderla)',
    !/categoriasApagadas/.test(cod),
    'ya no se pasan aparte: el filtro por conteo > 0 las cubre sin lista extra');
  chk('el orden de la lista es estable (no salta entre renders)',
    /orden\.indexOf\(a\)/.test(cod) && /a\.localeCompare\(b, "es"\)/.test(cod),
    'sin orden fijo la lista se reordena sola');

  // ── 2) Una sola fuente de color y etiqueta ──
  chk('existe colorCategoria(id) compartido',
    /function colorCategoria\(id\)/.test(cod) &&
      /D\.EVENT_CATEGORIES\[id\]\.color/.test(cod) &&
      /FALLBACK_CATEGORIES\[id\]\.color/.test(cod),
    'sin el, el punto de la leyenda y el del calendario pueden diferir');
  chk('existe etiquetaCategoria(id) compartido',
    /function etiquetaCategoria\(id\)/.test(cod));
  chk('una categoria sin nombre conocido muestra el id crudo, no uno inventado',
    /return id;\s*\}\s*$/m.test(cod) && !/return "Otro";/.test(cod),
    'inventar una etiqueta esconde el dato real');

  // ── 3) El bug del no-op de D.FALLBACK_CATEGORIES ──
  chk('ya no se lee D.FALLBACK_CATEGORIES (no existe: es const local)',
    !/D\.FALLBACK_CATEGORIES/.test(cod),
    'era un if que protegia un crash y dejaba el bloque como no-op silencioso');
  chk('el mini-calendario usa la const real FALLBACK_CATEGORIES',
    /Object\.keys\(FALLBACK_CATEGORIES\)\.forEach/.test(cod),
    'sin esto los puntitos caen siempre al azul de respaldo');
  chk('rapido tiene color propio y no el azul generico',
    /rapido:\s*\{ color: "#0d6efd"/.test(cod),
    'rapido es la categoria real de todos los eventos de calendario');

  // ── 4) Estado vacío ──
  chk('hay un estado vacio cuando no hay nada que contar',
    /tipos__vacio/.test(cod) && /tipos__vacio/.test(css),
    'una tarjeta con solo el titulo se lee como una seccion rota');
  chk('el aviso de tipos ocultos solo aparece si hay ocultos',
    /hayOcultos \? '<div class="tipos__hint">/.test(cod),
    'dejarlo siempre puesto era texto que no appliquea nada');

  return { f: fallos.length, n, fallos };
}

// ══════ funcional: la logica real contra datos con la forma real ══════
function escenario(js) {
  const fallos = [];
  let n = 0;
  const chk = (nombre, c, e) => { n++; if (!c) fallos.push(nombre + (e ? '  [' + e + ']' : '')); };

  // Se extraen las funciones REALES del archivo, no una copia. Una copia en el
  // test es una segunda verdad: las mutaciones del archivo no la tocan y el
  // test pasa sin estar probando nada. Por eso `contarTipos` vive en
  // app.js como función pura y acá se trae tal cual.
  const partes = ['contarTipos', 'colorCategoria', 'etiquetaCategoria'];
  let codigo = '';
  for (const nm of partes) {
    const m = js.match(new RegExp('^  function ' + nm + '\\([\\s\\S]*?\\n  \\}', 'm'));
    if (!m) { chk('se encontro ' + nm + ' en el archivo real', false); return { f: fallos.length, n, fallos }; }
    codigo += m[0] + '\n';
  }
  const etiquetas = (js.match(/const ETIQUETA_CATEGORIA = \{[\s\S]*?\n  \};/) || [''])[0];
  const fallback = (js.match(/const FALLBACK_CATEGORIES = \{[\s\S]*?\n  \};/) || [''])[0];
  chk('se extrajeron las tablas de categorias', etiquetas.length > 10 && fallback.length > 10);

  // Los eventos con la FORMA REAL que devuelven las dos fuentes.
  const eventos = [
    { id: 'gcal-a', category: 'rapido', date: '2026-10-03' },
    { id: 'gcal-b', category: 'rapido', date: '2026-10-05' },
    { id: 'gcal-c', category: 'rapido', date: '2026-10-07' },
    { id: 'rapido-x', type: 'rapido', date: '2026-08-01' },
    { id: 'gcal-d', category: 'plan', date: '2026-10-10' },
  ];
  const OFICIALES = {
    plan: { id: 'plan', label: 'Plan de Trabajo', color: '#174ea6' },
    capacitacion: { id: 'capacitacion', label: 'Capacitación', color: '#28a745' },
  };
  // El `type:'rapido'` viene sin `category` si nadie lo normaliza: asi
  // justamente se serializa en el camino real de la BD.
  const conType = eventos.map((e) => (e.type && !e.category ? Object.assign({}, e, { category: e.type }) : e));

  // `D` va en el scope porque colorCategoria/etiquetaCategoria leen
  // D.EVENT_CATEGORIES, igual que en la app real.
  const fn = new Function('D', fallback + '\n' + etiquetas + '\n' + codigo + '\n'
    + 'return { contarTipos: contarTipos, colorCategoria: colorCategoria, etiquetaCategoria: etiquetaCategoria };');
  const api = fn({ EVENT_CATEGORIES: OFICIALES });

  try {
    const r = api.contarTipos(conType, OFICIALES, []);

    chk('📦856 · con eventos de calendario el panel deja de estar en 0',
      (r.conteo.rapido || 0) === 4, 'conteo=' + JSON.stringify(r.conteo));
    chk('una categoria oficial con eventos SI se cuenta',
      r.conteo.plan === 1, 'conteo=' + JSON.stringify(r.conteo));
    chk('solo aparecen las categorias que tienen eventos',
      r.ids.length === 2, 'ids=' + JSON.stringify(r.ids));
    chk('las oficiales van primero, aunque su id ordene despues',
      r.ids[0] === 'plan', 'ids=' + JSON.stringify(r.ids));
    chk('las que no tienen eventos NO aparecen (no hay filas de 0)',
      r.ids.indexOf('capacitacion') < 0, 'ids=' + JSON.stringify(r.ids));

    // Sin eventos: estado vacío, no seis ceros.
    const vacio = api.contarTipos([], OFICIALES, []);
    chk('sin eventos la lista queda vacia para el estado vacio',
      vacio.ids.length === 0, 'ids=' + JSON.stringify(vacio.ids));

    // 📦857 — Invertido: una categoría apagada ya NO se cuela si tiene 0. Antes
    // se pasaba `categoriasApagadas` y se metían igual, que era justamente lo
    // que hacía reaparecer las 6 oficiales en cero (activeCategories las trae
    // prendidas de entrada). Ahora el filtro es solo "tiene eventos".
    const apagada = api.contarTipos(conType, OFICIALES);
    chk('una categoria apagada sin eventos NO se cuela (se fue el 0 espurio)',
      apagada.ids.indexOf('inspeccion') < 0, 'ids=' + JSON.stringify(apagada.ids));
    chk('una categoria apagada QUE TIENE eventos si aparece (para reencenderla)',
      apagada.ids.indexOf('rapido') >= 0, 'ids=' + JSON.stringify(apagada.ids));

    // Colores y etiquetas desde la fuente real.
    chk('rapido toma su color propio, no el azul generico',
      api.colorCategoria('rapido') === '#0d6efd', 'color=' + api.colorCategoria('rapido'));
    chk('una oficial conserva su color declarado',
      api.colorCategoria('plan') === '#174ea6', 'color=' + api.colorCategoria('plan'));
    chk('una categoria sin nombre conocido devuelve el id crudo',
      api.etiquetaCategoria('categoria_inventada') === 'categoria_inventada',
      'label=' + api.etiquetaCategoria('categoria_inventada'));
    chk('rapido tiene etiqueta en castellano, no el id crudo',
      api.etiquetaCategoria('rapido') === 'Rápido', 'label=' + api.etiquetaCategoria('rapido'));
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
  ['el conteo se invierte (no acumula, deja todo en 0 otra vez)',
    j => j.replace('if (c) conteo[c] = (conteo[c] || 0) + 1;', 'if (c) conteo[c] = 0;')],
  ['se vuelven a listar TODAS las categorias, tengan eventos o no (filas de 0)',
    j => j.replace('      .filter(function (id) { return conteo[id] > 0; })\n', '')],
  ['el filtro de ceros se afloja a >= 0 (las categorias en 0 vuelven a pantalla)',
    j => j.replace('.filter(function (id) { return conteo[id] > 0; })', '.filter(function (id) { return conteo[id] >= 0; })')],
  ['el orden estable desaparece (la lista salta entre renders)',
    j => j.replace('const ia = orden.indexOf(a), ib = orden.indexOf(b);', 'const ia = -1, ib = -1;')],
  ['colorCategoria deja de mirar FALLBACK_CATEGORIES (puntitos al azul generico)',
    j => j.replace('    if (FALLBACK_CATEGORIES[id]) return FALLBACK_CATEGORIES[id].color;\n', '')],
  ['la etiqueta inventada vuelve ("Otro" en vez del id real)',
    j => j.replace('    if (ETIQUETA_CATEGORIA[id]) return ETIQUETA_CATEGORIA[id];', '    return "Otro";')],
  ['vuelve el no-op D.FALLBACK_CATEGORIES en el mini-calendario',
    j => j.replace('    Object.keys(FALLBACK_CATEGORIES).forEach((k) => {\n      if (!categoryColor[k]) categoryColor[k] = FALLBACK_CATEGORIES[k].color;\n    });',
      '    if (D.FALLBACK_CATEGORIES) { Object.keys(D.FALLBACK_CATEGORIES).forEach((k) => { categoryColor[k] = D.FALLBACK_CATEGORIES[k].color; }); }')],
  ['el estado vacio desaparece (tarjeta con solo el titulo)',
    j => j.replace('tipos__vacio', 'tipos__nada')],
  ['el aviso de ocultos aparece siempre (texto que no aplica)',
    j => j.replace("(hayOcultos ? '<div class=\"tipos__hint\">", "'<div class=\"tipos__hint\">")],
  ['el render vuelve a construir la lista sin delegar (segunda verdad)',
    j => j.replace('    const tipos = contarTipos(\n      visibleEvents.filter(function (e) { return e && e.date && enAlcance[e.date]; }),\n      D.EVENT_CATEGORIES\n    );\n    const conteoCat = tipos.conteo;',
      '    const conteoCat = {};')],
];

let mFallos = 0, vacios = 0;
MUT.forEach((m) => {
  const mut = m[1](crudo.js);
  const cssMut = m[0].indexOf('estado vacio') >= 0 ? crudo.css.replace('.tipos__vacio {', '.tipos__nada {') : crudo.css;
  if (mut === crudo.js && cssMut === crudo.css) {
    vacios++; mFallos++;
    console.log('FAIL MUTANTE VACIO  ' + m[0]);
    return;
  }
  const d = evaluar(crudo.htm, cssMut, mut).f + escenario(mut).f;
  if (d === 0) mFallos++;
  console.log((d > 0 ? 'OK  detecta      ' : 'FAIL NO muerde   ') + m[0]);
});

console.log('---');
console.log('checks: ' + (real.n - real.f) + '/' + real.n
  + '  ·  mutaciones detectadas: ' + (MUT.length - mFallos) + '/' + MUT.length
  + (vacios ? '  ·  mutantes vacios: ' + vacios : ''));
if (real.f || mFallos) {
  if (real.f) { console.log('FALLOS:'); real.fallos.forEach((f) => console.log('  - ' + f)); }
  process.exit(1);
}
console.log('OK');
