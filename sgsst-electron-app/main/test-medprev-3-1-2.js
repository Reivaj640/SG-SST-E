// test-medprev-3-1-2.js
// 3.1.2 "Actividades de medicina preventiva y promocion de la salud" — esqueleto
// + gestión de programas (📦825). Estos tests son ESTATICOS a proposito (leen el
// fuente, no lo ejecutan), como `test-presupuesto-824-dispatch.js`.
//
// Que cubren, y por que ningun test funcional los agarria:
//
//   1. El nombre del submodulo en el sidebar y el del dispatch son el MISMO
//      string, caracter por caracter. Si divergen, el submodulo cae al
//      `showDevelopmentMessage` sin avisar: no hay error, solo no abre.
//   2. El dispatch instancia una clase que existe y quedo registrada en index.html.
//   3. Cada `action` que mandan el home y la vista de programa por postMessage
//      tiene su `case` en el padre, y cada `case` llama a metodos que existen.
//      Esta es la clase de bug que en el 1.1.3 produjo un TypeError en runtime
//      por un typo de mayusculas.
//   4. Los iconos de Font Awesome existen de verdad. Uno inexistente NO da error:
//      simplemente no genera `::before` y el <i> queda con width 0 (se ve como un
//      cuadrito vacio). Sondeados contra Font Awesome 6.4.0 (2026-09-29 y 2026-09-29 📦825).
//   5. Las reglas del AGENTS.md que el 1.1.3 aprendio a la fuerza: sin media
//      queries, sin `auto-fill`, sin `max-width` de columna, y sin redefinir el
//      marco `.kair-block__panel` (que vive solo en shared/kair-components.css).
//   6. El `?v=` de cache-bust esta en el src del iframe y en el <script> de index.
//   7. 📦825 — Vista de programa (medicina-preventiva-programa.html/.js): mismas
//      reglas CSS, contrato postMessage completo, onclicks existentes y
//      cache-bust del segundo iframe.
//
// Uso: node main/test-medprev-3-1-2.js

'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DIR = path.join(RAIZ, 'modules', 'gestion-salud', 'medicina-preventiva');
const LOGIC = path.join(DIR, 'medicina-preventiva-logic.js');
const HOME_JS = path.join(DIR, 'medicina-preventiva-home.js');
const HOME_HTML = path.join(DIR, 'medicina-preventiva-home.html');
const PROGRAMA_JS = path.join(DIR, 'medicina-preventiva-programa.js');
const PROGRAMA_HTML = path.join(DIR, 'medicina-preventiva-programa.html');
const RENDERER = path.join(RAIZ, 'renderer.js');
const INDEX = path.join(RAIZ, 'index.html');

// Icones de Font Awesome 6.4.0 free-solid VERIFICADOS midiendo el glifo real
// en Electron (un `fa-X` inexistente da w=0 y ::before = none).
// 2026-09-29: sondeo del esqueleto (7 iconos). 📦825: re-sondeo con el script
// Temp/probe-fa-icons-825.js para los 36 iconos de la vista de programa.
const ICONOS_VERIFICADOS = new Set([
  'fa-heart-pulse', 'fa-compass', 'fa-stethoscope', 'fa-user-doctor',
  'fa-user-group', 'fa-hammer', 'fa-arrow-left',
  // 📦825 — sondeo Temp/probe-fa-icons-825.js (36 vivos, 0 muertos):
  'fa-plus', 'fa-pause', 'fa-play', 'fa-xmark', 'fa-trash-can',
  'fa-folder-open', 'fa-circle-check', 'fa-chevron-right', 'fa-chevron-left',
  'fa-circle-info', 'fa-triangle-exclamation', 'fa-chart-line', 'fa-bell',
  'fa-list-check', 'fa-gauge-high', 'fa-file-export', 'fa-gear',
  'fa-clipboard-list', 'fa-clipboard-check', 'fa-rotate-left', 'fa-pen-to-square',
  'fa-calendar-days', 'fa-syringe', 'fa-virus', 'fa-microscope', 'fa-lungs',
  'fa-flag-checkered', 'fa-bullseye', 'fa-diagram-project'
]);

const checks = [];
function ok(n, c, e) { checks.push({ name: n, ok: !!c, extra: e }); }
function leer(p) { return fs.readFileSync(p, 'utf8'); }

// Para las reglas de estilo hay que buscar en el CSS, NO en el archivo entero:
// los comentarios de estos archivos mencionan a propósito lo que está
// prohibido ("nunca `auto-fill`", "SIN media queries") y una búsqueda cruda
// reporta como violación la frase que explica la prohibición.
function sinComentarios(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// Devuelve el cuerpo de una regla CSS por selector exacto.
function regla(src, selector) {
  const re = new RegExp('(^|[}\\s;])' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}');
  const m = sinComentarios(src).match(re);
  return m ? m[2] : null;
}

function metodosDefinidos(src) {
  const set = new Set();
  src.split(/\r?\n/).forEach(l => {
    const m = l.match(/^\s{2,8}(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$/);
    if (m && !/\bthis\b/.test(l)) set.add(m[1]);
  });
  return set;
}

// Recorta SOLO el metodo handleMessage: el archivo tiene otro `switch` (el de
// render(), que elige vista) y escanearlo entero mezclaria los casos.
function cuerpoDelDispatch(src) {
  const inicio = src.search(/^\s*async\s+handleMessage\s*\(/m);
  if (inicio < 0) return '';
  const fin = src.indexOf('\n    createLoadingElement', inicio);
  return src.slice(inicio, fin > inicio ? fin : src.length);
}

// Cada `case 'x':` se corta en el SIGUIENTE `case`, nunca buscando el `break;`
// con un regex de tamano fijo: los cuerpos varian de 1 a 10 lineas.
function casosDelDispatch(cuerpo) {
  const re = /case\s+'([^']+)'\s*:/g;
  const marcas = [];
  let m;
  while ((m = re.exec(cuerpo)) !== null) marcas.push({ accion: m[1], ini: m.index });
  const mapa = new Map();
  marcas.forEach((mk, i) => {
    const fin = (i + 1 < marcas.length) ? marcas[i + 1].ini : cuerpo.length;
    const trozo = cuerpo.slice(mk.ini, fin);
    const llamadas = [];
    const re2 = /this\.([A-Za-z_$][\w$]*)\s*\(/g;
    let m2;
    while ((m2 = re2.exec(trozo)) !== null) llamadas.push(m2[1]);
    mapa.set(mk.accion, llamadas);
  });
  return mapa;
}

function main() {
  const logic = leer(LOGIC);
  const homeJs = leer(HOME_JS);
  const homeHtml = leer(HOME_HTML);
  const renderer = leer(RENDERER);
  const index = leer(INDEX);

  const definidos = metodosDefinidos(logic);
  const casos = casosDelDispatch(cuerpoDelDispatch(logic));

  // Propiedades asignadas en el constructor: no son metodos, pero `this.X()`
  // puede llamarlas legitimamente.
  const propiedades = new Set();
  logic.split(/\r?\n/).forEach(l => {
    const m = l.match(/this\.([A-Za-z_$][\w$]*)\s*=/);
    if (m) propiedades.add(m[1]);
  });

  // ── 1) El nombre del submodulo coincide sidebar <-> dispatch ─────────
  const enSidebar = renderer.match(/^\s*"(3\.1\.2 [^"]+)",\s*$/m);
  ok('1) el 3.1.2 sigue en la lista de submodulos', !!enSidebar,
    enSidebar ? enSidebar[1] : 'no se encontro');
  const enDispatch = renderer.match(/submoduleName === "(3\.1\.2[^"]+)"/);
  ok('1) el dispatch tiene una rama para el 3.1.2', !!enDispatch,
    enDispatch ? enDispatch[1] : 'no se encontro');
  ok('1) sidebar y dispatch usan EXACTAMENTE el mismo string',
    !!enSidebar && !!enDispatch && enSidebar[1] === enDispatch[1],
    JSON.stringify([enSidebar && enSidebar[1], enDispatch && enDispatch[1]]));

  // ── 2) La clase existe, se registra y el dispatch la instancia ───────
  ok('2) MedicinaPreventivaComponent esta definida', definidos.has('render') && /class\s+MedicinaPreventivaComponent/.test(logic));
  ok('2) la clase queda expuesta en window',
    /window\.MedicinaPreventivaComponent\s*=/.test(logic));
  ok('2) el dispatch instancia MedicinaPreventivaComponent',
    !!enDispatch && enDispatch.index > 0 &&
    renderer.slice(enDispatch.index, enDispatch.index + 600).includes('new window.MedicinaPreventivaComponent'));
  ok('2) index.html carga el logic del 3.1.2',
    index.includes('modules/gestion-salud/medicina-preventiva/medicina-preventiva-logic.js'));
  ok('2) index.html no carga el home dentro de un iframe anidado',
    !index.includes('medicina-preventiva-home.html'));

  // ── 3) Contrato de mensajes home <-> padre ───────────────────────────
  const enviadas = new Set();
  let m;
  const reAccion = /action\s*:\s*'([^']+)'/g;
  while ((m = reAccion.exec(homeJs)) !== null) enviadas.add(m[1]);
  ok('3) el home manda al menos una accion', enviadas.size >= 2, [...enviadas].join(', '));

  const huerfanas = [...enviadas].filter(a => !casos.has(a));
  ok('3) el home no manda acciones sin handler', huerfanas.length === 0,
    huerfanas.join(', ') || [...enviadas].join(', '));

  const rotas = [];
  casos.forEach((llamadas, accion) => {
    llamadas.forEach(n => {
      if (!definidos.has(n) && !propiedades.has(n)) rotas.push(accion + ' -> this.' + n + '()');
    });
  });
  ok('3) ningún case llama a un metodo inexistente', rotas.length === 0, rotas.join(' | '));

  // Las funciones que el HTML invoca por `onclick=` tienen que existir en el JS
  // del home. Un `onclick` a un nombre inexistente es un boton mudo, sin error.
  const onClicks = new Set();
  let m3;
  const reOn = /onclick="([A-Za-z_$][\w$]*)\(/g;
  while ((m3 = reOn.exec(homeHtml)) !== null) onClicks.add(m3[1]);
  const sinFuncion = [...onClicks].filter(n => !new RegExp('function\\s+' + n + '\\s*\\(').test(homeJs));
  ok('3) todo onclick del home apunta a una funcion existente', sinFuncion.length === 0,
    sinFuncion.join(', ') || [...onClicks].join(', '));

  // ── 4) Los iconos existen de verdad en Font Awesome 6.4 ─────────────
  const usados = new Set();
  let m4;
  const reFa = /fa-[a-z0-9-]+/g;
  while ((m4 = reFa.exec(homeHtml)) !== null) usados.add(m4[0]);
  const faFantasma = [...usados].filter(c => !ICONOS_VERIFICADOS.has(c));
  ok('4) todo icono usado esta verificado en Font Awesome 6.4', faFantasma.length === 0,
    faFantasma.join(', ') || [...usados].join(', '));

  // Las 3 tarjetas de programa. Se cuentan por el HTML del bloque, no por todo
  // el archivo: el header tambien usa <i class="fas ..."> y no es un programa.
  const iconosCard = (homeHtml.match(/class="mp-card__icon"[^>]*>\s*<i class="fas (fa-[a-z0-9-]+)"/g) || [])
    .map(s => s.match(/(fa-[a-z0-9-]+)"$/)[1]);
  ok('4) las 3 tarjetas de programa traen icono', iconosCard.length === 3, iconosCard.join(', '));
  ok('4) los 3 programas tienen icono distinto entre si',
    new Set(iconosCard).size === 3, iconosCard.join(', '));
  // `fa-heartbeat` y `fa-heart-pulse` son el MISMO glifo en FA6 (alias): se
  // venían como dos iconos diferentes y no lo eran. El sondeo de ancho lo
  // detectó; acá se evita que el par vuelva a colarse.
  ok('4) ninguna tarjeta repite el glifo del header (fa-heart-pulse)',
    !iconosCard.includes('fa-heart-pulse'), iconosCard.join(', '));

  // ── 5) Reglas de AGENTS.md que el 1.1.3 aprendio a la fuerza ────────
  ok('5) sin media queries en el home (Electron: breakpoints chicos = codigo muerto)',
    !/@media/.test(sinComentarios(homeHtml)) && !/@media/.test(sinComentarios(homeJs)));
  ok('5) sin auto-fill (solo auto-fit)',
    !/auto-fill/.test(sinComentarios(homeHtml)) && /auto-fit/.test(sinComentarios(homeHtml)));

  // La columna de pagina va a todo el ancho. Ojo: el `max-width` en pixeles NO
  // esta prohibido en general — el subtitulo del header lo usa como medida de
  // lectura (640px), y eso esta bien. Lo que no puede pasar es que la pagina o
  // su grid se topeen, porque en pantallas anchas quedan ~300px de lienzo vacio.
  const colPagina = regla(homeHtml, '.mp-home') || '';
  ok('5) la columna de pagina va a todo el ancho (max-width: none)',
    /max-width:\s*none/.test(colPagina), colPagina.replace(/\s+/g, ' ').trim());
  const grid = regla(homeHtml, '.mp-grid') || '';
  ok('5) el grid de programas no esta topeado a pixeles',
    !/max-width:\s*\d+px/.test(grid) && /minmax\(320px/.test(grid),
    grid.replace(/\s+/g, ' ').trim());

  ok('5) el marco del bloque NO se redefine en la pantalla',
    !/\.kair-block__panel\s*\{/.test(sinComentarios(homeHtml)) &&
    !/\.kair-block__head\s*\{/.test(sinComentarios(homeHtml)));
  ok('5) el home usa el bloque compartido de shared/kair-components.css',
    homeHtml.includes('shared/kair-components.css') && /class="kair-block"/.test(homeHtml) && /class="kair-block__panel"/.test(homeHtml));
  ok('5) el home no carga styles.css del parent (los iframes no heredan estilos)',
    !/href="[^"]*styles\.css/.test(homeHtml));

  // ── 6) Cache-bust: sin esto Electron sirve la version vieja ──────────
  // 📦825: el src se arma por concatenación ('...html?v=' + MEDPREV_V + ...),
  // así que se verifica el prefijo literal y que MEDPREV_V tenga valor.
  const srcIframe = logic.match(/'modules\/gestion-salud\/medicina-preventiva\/medicina-preventiva-home\.html\?v='/);
  ok('6) el src del iframe lleva ?v= de cache-bust', !!srcIframe, srcIframe ? 'ok (concat)' : 'no');
  const vToken = logic.match(/var\s+MEDPREV_V\s*=\s*'([^']+)'/);
  ok('6) MEDPREV_V definido y con valor', !!vToken && vToken[1].length > 0, vToken ? vToken[1] : 'no');
  const srcScript = index.match(/medicina-preventiva-logic\.js\?v=([^"]+)"/);
  ok('6) el <script> de index.html lleva ?v=', !!srcScript, srcScript ? srcScript[1] : 'no');
  ok('6) el ?v= de index.html coincide con MEDPREV_V del logic',
    !!srcScript && !!vToken && srcScript[1] === vToken[1],
    JSON.stringify([srcScript && srcScript[1], vToken && vToken[1]]));

  // ── 7) 📦825 Vista de programa (lista / detalle / wizard) ────────────
  const progJs = leer(PROGRAMA_JS);
  const progHtml = leer(PROGRAMA_HTML);

  // 7a) Contrato postMessage: toda accion enviada por la vista de programa
  // tiene `case` en el dispatch del padre.
  const enviadasProg = new Set();
  let mProg;
  const reAccionProg = /action\s*:\s*'([^']+)'/g;
  while ((mProg = reAccionProg.exec(progJs)) !== null) enviadasProg.add(mProg[1]);
  const huerfanasProg = [...enviadasProg].filter(a => !casos.has(a));
  ok('7a) la vista de programa no manda acciones sin handler', huerfanasProg.length === 0,
    huerfanasProg.join(', ') || [...enviadasProg].join(', '));
  ok('7a) la vista usa el contrato completo (home/lista/detalle)',
    enviadasProg.has('backToHome') && enviadasProg.has('open-program') && enviadasProg.has('open-program-id'),
    [...enviadasProg].join(', '));

  // 7b) onclicks del HTML de programa → funciones que existen en su JS.
  // 📦825: además, la vista genera markup dinámico desde el JS — esos onclicks
  // también se verifican contra funciones del mismo archivo.
  const onClicksProg = new Set();
  let mProgClick;
  const reOnClickProg = /onclick="([A-Za-z_$][\w$]*)\(/g;
  while ((mProgClick = reOnClickProg.exec(progHtml)) !== null) onClicksProg.add(mProgClick[1]);
  while ((mProgClick = reOnClickProg.exec(progJs)) !== null) onClicksProg.add(mProgClick[1]);
  const sinFuncionProg = [...onClicksProg].filter(n => !new RegExp('function\\s+' + n + '\\s*\\(').test(progJs));
  ok('7b) todo onclick de la vista de programa (estático y dinámico) apunta a una funcion existente',
    sinFuncionProg.length === 0, sinFuncionProg.join(', ') || [...onClicksProg].join(', '));

  // 7c) Reglas CSS del AGENTS.md, ahora para la vista de programa.
  ok('7c) sin media queries en la vista de programa', !/@media/.test(sinComentarios(progHtml)));
  ok('7c) sin auto-fill en la vista de programa (solo auto-fit)',
    !/auto-fill/.test(sinComentarios(progHtml)) && /auto-fit/.test(sinComentarios(progHtml)));
  const colPaginaProg = regla(progHtml, '.mp-pg') || '';
  ok('7c) la columna de pagina de la vista va a todo el ancho (max-width: none)',
    /max-width:\s*none/.test(colPaginaProg), colPaginaProg.replace(/\s+/g, ' ').trim());
  const gridProg = regla(progHtml, '.mp-pg__grid') || '';
  ok('7c) el grid de programas de la vista no esta topeado a pixeles',
    !/max-width:\s*\d+px/.test(gridProg) && /minmax\(300px/.test(gridProg),
    gridProg.replace(/\s+/g, ' ').trim());
  ok('7c) la vista de programa NO redefinice el marco compartido',
    !/\.kair-block__panel\s*\{/.test(sinComentarios(progHtml)) &&
    !/\.kair-block__head\s*\{/.test(sinComentarios(progHtml)));
  ok('7c) la vista de programa usa el bloque compartido de shared/kair-components.css',
    progHtml.includes('shared/kair-components.css') && /class="kair-block"/.test(progJs),
    'el markup kair-block se genera desde el JS (body dinámico)');
  ok('7c) la vista de programa no carga styles.css del parent', !/href="[^"]*styles\.css/.test(progHtml));

  // 7d) Iconos de la vista de programa verificados en FA 6.4.
  const usadosProg = new Set();
  let mProgFa;
  const reFaProg = /fa-[a-z0-9-]+/g;
  while ((mProgFa = reFaProg.exec(progHtml)) !== null) usadosProg.add(mProgFa[0]);
  const faFantasmaProg = [...usadosProg].filter(c => !ICONOS_VERIFICADOS.has(c));
  ok('7d) todo icono de la vista esta verificado en Font Awesome 6.4', faFantasmaProg.length === 0,
    faFantasmaProg.join(', ') || [...usadosProg].join(', '));

  // 7e) El logic.js arma el iframe de programa con ?v=, modo, tipo y empresa.
  ok('7e) el logic referencia medicina-preventiva-programa.html con ?v=',
    /medicina-preventiva-programa\.html\?v='/.test(logic) || /medicina-preventiva-programa\.html\?v=/.test(logic));
  ok('7e) el iframe de programa lleva modo, tipo y empresa',
    /modo=lista/.test(logic) && /modo=detalle/.test(logic) &&
    /tipo=' \+ encodeURIComponent/.test(logic) && /empresa=' \+ empresaEnc/.test(logic));

  // 7f) El home 3.1.2 ya no anuncia "En construccion" en las tarjetas: ahora
  // muestra conteos reales (📦825). El pill viejo no debe volver.
  ok('7f) el home ya no lleva el pill "En construccion"', !/En construccion/.test(homeHtml));
  ok('7f) las 3 tarjetas del home traen etiqueta con id para el conteo',
    /id="mp-tag-sve"/.test(homeHtml) && /id="mp-tag-dme"/.test(homeHtml) && /id="mp-tag-promocion"/.test(homeHtml));
  ok('7f) la tercera tarjeta apunta a la linea promocion',
    /abrirPrograma\('promocion'\)/.test(homeHtml));

  let failed = 0;
  console.log('\n=======================================');
  checks.forEach(c => {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  console.log('=======================================');
  process.exit(failed === 0 ? 0 : 1);
}

main();
