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

// 📦826 — Módulo SVE portado del prototipo (design system propio: Inter /
// Plus Jakarta Sans, teal, media queries del prototipo). Las reglas CSS de
// AGENTS.md (sin @media, auto-fit, etc.) NO aplican a estos archivos: son
// código del prototipo tal cual, solo parcheado en fuentes y storage key.
const SVE_DIR = path.join(DIR, 'sve');
const SVE_ARCHIVOS = [
  'sve.css', 'sve-seed.js', 'sve-core.js', 'sve-views.js', 'sve-app.js',
  'vendor/lucide.min.js', 'vendor/xlsx.full.min.js',
  'fonts/inter-latin-400-normal.woff2', 'fonts/inter-latin-500-normal.woff2',
  'fonts/inter-latin-600-normal.woff2', 'fonts/inter-latin-700-normal.woff2',
  'fonts/inter-latin-800-normal.woff2', 'fonts/plus-jakarta-sans-latin-600-normal.woff2',
  'fonts/plus-jakarta-sans-latin-700-normal.woff2', 'fonts/plus-jakarta-sans-latin-800-normal.woff2'
];

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
  'fa-flag-checkered', 'fa-bullseye', 'fa-diagram-project',
  // 📦827-fix — botón "Archivar programa". Medido en render real con
  // Temp/probe-fa-archive.js (w=16, ::before con contenido). El primer sondeo
  // dio "muerto" para TODOS los iconos porque la sonda apuntaba a un CSS que
  // no existe: un verificador mal puede dar un veredicto falso en bloque.
  'fa-box-archive'
]);

const checks = [];
function ok(n, c, e) { checks.push({ name: n, ok: !!c, extra: e }); }
function leer(p) { return fs.readFileSync(p, 'utf8'); }
// Igual que leer, pero un archivo que todavia no existe no revienta el test:
// un guard de "este archivo tiene que estar" tiene que poder FALLAR, no
// tirar la excepcion y tapar el resto de la suite.
function leerSeguro(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } }

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

  // 7g) 📦826 El botón "atrás" depende del nivel. Dentro de un programa tiene que
  // ir a la LISTA de la línea, no al home del 3.1.2: el detalle puede ser una
  // vista larga (el Dashboard del prototipo) y saltar al home tira dos niveles
  // y pierde el programa que se estaba mirando. En la lista sí va al home.
  ok('7g) el boton volver tiene id y etiqueta intercambiables',
    /id="pg-btn-volver"/.test(progHtml) && /id="pg-btn-volver-txt"/.test(progHtml));
  ok('7g) en detalle el boton volver va a la lista, no al home',
    /PG\.modo\s*===\s*'detalle'[\s\S]{0,400}?setAttribute\(\s*'onclick'\s*,\s*'volverALista\(\)'/.test(progJs));
  ok('7g) la etiqueta del boton cambia segun el nivel',
    /'Programas '\s*\+\s*linea\.etiqueta/.test(progJs) && /'Home 3\.1\.2'/.test(progJs));
  ok('7g) volverALista existe y usa la accion open-program',
    /function\s+volverALista\s*\(/.test(progJs) &&
    /function\s+volverALista\s*\([\s\S]{0,200}?action:\s*'open-program'/.test(progJs));

  // 7h) 📦826 Las tabs de sección viven DENTRO del panel de resumen. Con la
  // vista larga del prototipo abajo, tener la navegación en su propio bloque la
  // dejaba desligada del programa al que pertenece.
  ok('7h) las tabs se pintan dentro del bloque de resumen',
    /mp-pg__tabs--resumen/.test(progJs));
  ok('7h) el bloque de secciones ya NO vuelve a pintar las tabs',
    !/'<div class="mp-pg__tabs"[^']*'\s*\+\s*tabs/.test(progJs));
  ok('7h) la regla .mp-pg__tabs--resumen existe con separador',
    /\.mp-pg__tabs--resumen\s*\{[^}]*border-top/.test(progHtml));

  // 7i) 📦826 El detalle va solo con título, sin subtítulo. Los subtítulos
  // repetían lo visible (barra de progreso, botones, tabs) y empujaban la
  // sección activa fuera de pantalla con las vistas largas del prototipo.
  ok('7i) el detalle se envuelve en .mp-pg__detalle',
    /<div class="mp-pg__detalle">/.test(progJs));
  ok('7i) el bloque de resumen ya no lleva subtitulo',
    !/Resumen del programa<\/div>'\s*\+\s*'<div class="kair-block__sub">/.test(progJs) &&
    !/Ciclo de vida y progreso general/.test(progJs));
  ok('7i) el bloque de seccion activa ya no lleva subtitulo',
    !/Cada seccion monta su interfaz operativa/.test(progJs) &&
    !/Marca el avance de cada seccion; su interfaz operativa llega en la fase 2/.test(progJs));
  // El apretado es LOCAL del detalle, con clases propias: el bloque compartido
  // no se toca, ni siquiera con un selector descendiente.
  ok('7i) el espaciado apretado usa clases locales, no las del bloque compartido',
    /\.mp-pg__bloque\s*\{[^}]*margin-top/.test(progHtml) &&
    /\.mp-pg__head\s*\{[^}]*margin\s*:/.test(progHtml) &&
    !/\.kair-block__panel\s*\{/.test(sinComentarios(progHtml)) &&
    !/\.kair-block__head\s*\{/.test(sinComentarios(progHtml)));
  ok('7i) los dos bloques del detalle llevan las clases locales',
    (progJs.match(/kair-block mp-pg__bloque/g) || []).length === 2 &&
    (progJs.match(/kair-block__head mp-pg__head/g) || []).length === 2);
  ok('7i) los dos <div class="mp-pg__detalle"> quedan balanceados',
    (progJs.match(/<div class="mp-pg__detalle">/g) || []).length === 1);

  // ── 8) 📦826 Interfaz SVE del prototipo montada por sección ──────────
  // 8a) Los 15 archivos del módulo existen.
  const faltantesSve = SVE_ARCHIVOS.filter(rel => !fs.existsSync(path.join(SVE_DIR, rel)));
  ok('8a) los 15 archivos del modulo SVE existen', faltantesSve.length === 0, faltantesSve.join(', ') || 'completos');

  // 8b) Fuentes con ruta relativa (file:// no resuelve /vendor/fonts/).
  const sveCss = fs.existsSync(path.join(SVE_DIR, 'sve.css')) ? leer(path.join(SVE_DIR, 'sve.css')) : '';
  ok('8b) sve.css referencia las fuentes en relativo (./fonts/)',
    sveCss.includes('url("./fonts/') && !sveCss.includes('/vendor/fonts/'));
  // Cuenta DECLARACIONES, no menciones: contar `/@font-face/` sobre el archivo
  // crudo.counta también los comentarios que nombran la regla y da falsos
  // positivos. Mismo criterio que el resto de checks de estilo.
  ok('8b) sve.css declara las 8 @font-face',
    (sinComentarios(sveCss).match(/@font-face/g) || []).length === 8,
    (sinComentarios(sveCss).match(/@font-face/g) || []).length + ' declaraciones');

  // 8b-bis) La columna de página del prototipo NO puede volver a estar topeada.
  // Montado dentro del panel del 3.1.2 (que ya va a todo el ancho), un
  // `max-width` fijo deja lienzo muerto a cada lado: el panel sobraba ~240px por
  // lado en 1913px. Es la misma regla que el 1.1.3 aplicó en 📦824-ui. Los topes
  // de COMPONENTES (modal, toast, ancho mínimo de tabla) sí se permiten, por eso
  // el check mira la regla `.sve-body` y no el archivo entero.
  const reglaSveBody = (sveCss.match(/^\.sve-body\s*\{[^}]*\}/m) || [''])[0];
  ok('8b) la columna de pagina del prototipo no esta topeada',
    /max-width:\s*none/.test(reglaSveBody) && !/margin:\s*0 auto/.test(reglaSveBody),
    reglaSveBody.replace(/\s+/g, ' ').trim() || 'regla .sve-body no encontrada');
  ok('8b) los grids del prototipo se estiran con fr, no con px',
    !/grid-template-columns:[^;]*\d{3,}px/.test(sveCss));

  // 8b-bis) 📦826 Tipografía alineada al design system K+AIR. El prototipo venía
  // con familias propias (Inter + Plus Jakarta Sans) y 17 tamaños distintos en px,
  // varios por debajo del piso de 11px de la app. Dentro del 3.1.2 eso lo delata:
  // las letras no coinciden con Capacitación ni con ninguna otra pantalla.
  ok('8b) el prototipo usa las familias de K+AIR (DM Sans + Manrope)',
    /--sve-font:\s*var\(--kair-font-ui/.test(sveCss) &&
    /--sve-font-display:\s*var\(--kair-font-display/.test(sveCss));
  ok('8b) el prototipo NO usa Inter ni Plus Jakarta Sans como familia',
    !/--sve-font:\s*"Inter"/.test(sveCss) &&
    !/--sve-font-display:\s*"Plus Jakarta Sans"/.test(sveCss));
  ok('8b) la escala tipográfica son tokens en rem (hero..micro)',
    ['--sve-t-hero', '--sve-t-metric', '--sve-t-h2', '--sve-t-card',
     '--sve-t-value', '--sve-t-body', '--sve-t-sm', '--sve-t-xs', '--sve-t-micro']
      .every(t => new RegExp(t + ':\\s*[\\d.]+rem').test(sveCss)));
  ok('8b) ninguna etiqueta baja del piso de 11px',
    parseFloat((sveCss.match(/--sve-t-micro:\s*([\d.]+)rem/) || [])[1]) * 16 >= 11);
  // Todos los tamaños salen de los tokens: un px suelto reintroduce la escala
  // de 17 pasos que se acaba de colapsar.
  ok('8b) ningun font-size queda en px sueltos',
    !/font-size:\s*[\d.]+px/.test(sveCss),
    (sveCss.match(/font-size:\s*[\d.]+px/g) || []).join(', '));
  ok('8b) el tracking esta normalizado (titulos -0.03/-0.04, etiquetas 0.06)',
    (() => {
      const vals = [...new Set((sveCss.match(/letter-spacing:\s*(-?[\d.]+em)/g) || [])
        .map(s => s.replace(/letter-spacing:\s*/, '')))];
      return vals.length > 0 && vals.every(v => ['-0.03em', '-0.04em', '0.06em'].includes(v));
    })(),
    [...new Set((sveCss.match(/letter-spacing:\s*(-?[\d.]+em)/g) || [])
      .map(s => s.replace(/letter-spacing:\s*/, '')))].join(', '));
  ok('8b) tracking sin unidades duplicadas (bug 0.06emem)',
    !/emem/.test(sveCss));

  // 8b-ter) El host del prototipo debe llevar `kair-app-sve` (raíz de tema del
  // prototipo). Sin esa clase NO aplican su `box-sizing: border-box` ni su
  // tipografía: sus `width: 100%` con padding medían 40px más que el panel y
  // se recortaba contenido por la derecha. El bug se escondía detrás del
  // `max-width` viejo; al quitarlo apareció, y por eso los dos van atados.
  // Reutiliza `progJs` y `progHtml` que ya se leyeron en la sección 7.
  const hostDiv = (progJs.match(/id="pg-sve-host"[^>]*>/) || [''])[0];
  ok('8b) el host del prototipo lleva la clase kair-app-sve (reset de box-sizing)',
    /\bkair-app-sve\b/.test(hostDiv), hostDiv);
  ok('8b) el prototipo define su box-sizing en .kair-app-sve (no global)',
    /\.kair-app-sve\s+\*\s*,/.test(sveCss) || /\.kair-app-sve \*[^{]*\{[^}]*box-sizing:\s*border-box/.test(sveCss));
  ok('8b) el host anula el min-height de pagina completa del prototipo',
    /\.mp-pg__sve-host\.kair-app-sve\s*\{[^}]*min-height:\s*auto/.test(progHtml));

  // 8c) Storage por programa: SVE_PROGRAMA_KEY leído por sve-app.js.
  const sveApp = fs.existsSync(path.join(SVE_DIR, 'sve-app.js')) ? leer(path.join(SVE_DIR, 'sve-app.js')) : '';
  ok('8c) sve-app.js namespacia el storage por programa (SVE_PROGRAMA_KEY)',
    /SVE_PROGRAMA_KEY/.test(sveApp) && /kair\.sve\.data\.v1/.test(sveApp));

  // 8d) El prototipo es offline: sin recursos remotos en css/seed/core/views/app.
  // (El namespace http://www.w3.org/2000/svg es un identificador XML, no una descarga.)
  const svePropios = ['sve.css', 'sve-seed.js', 'sve-core.js', 'sve-views.js', 'sve-app.js']
    .map(f => fs.existsSync(path.join(SVE_DIR, f)) ? leer(path.join(SVE_DIR, f)) : '');
  const conCdn = svePropios.filter(src => /https?:\/\/(?!www\.w3\.org\/2000\/svg)/.test(src));
  ok('8d) el modulo SVE no carga recursos remotos (offline)', conCdn.length === 0, conCdn.length + ' archivos con URL externa');

  // 8e) El cargador en programa.js: orden de scripts + clave + mapeo de rutas.
  ok('8e) el cargador SVE carga vendor, seed, core, views y app en orden',
    ['vendor/lucide.min.js', 'vendor/xlsx.full.min.js', 'sve-seed.js', 'sve-core.js', 'sve-views.js', 'sve-app.js']
      .every(f => progJs.includes("base + '" + f + "'")));
  ok('8e) el cargador define SVE_PROGRAMA_KEY antes de sve-app.js',
    progJs.indexOf('SVE_PROGRAMA_KEY = PG.id') < progJs.indexOf("sve-app.js' + v"));
  ok('8e) montaje: SveApp.init + SveApp.go por sección',
    /window\.SveApp\.init\(host/.test(progJs) && /window\.SveApp\.go\(\{ name: ruta \}\)/.test(progJs));
  ok('8e) mapeo de secciones a rutas del prototipo',
    /dashboard: 'dashboard'/.test(progJs) && /casos: 'seguimiento'/.test(progJs) &&
    /plan: 'plan'/.test(progJs) && /indicadores: 'indicadores'/.test(progJs) && /areas: 'areas'/.test(progJs));

  // 8f) El host oculta el header del prototipo y ajusta sus alturas.
  ok('8f) el host oculta el .sve-header del prototipo (navegación por secciones K+AIR)',
    /\.mp-pg__sve-host \.sve-header \{ display: none; \}/.test(progHtml));
  ok('8f) el host define .mp-pg__sve-host', /\.mp-pg__sve-host \{/.test(progHtml));

  // 8g) Plantilla v2 en el bridge + migración en el schema.
  const BRIDGE = path.join(RAIZ, 'main', 'medprev-programas-bridge.js');
  const SCHEMA = path.join(RAIZ, 'main', 'medprev-programas-schema-sql.js');
  const bridgeSrc = fs.existsSync(BRIDGE) ? leer(BRIDGE) : '';
  const schemaSrc = fs.existsSync(SCHEMA) ? leer(SCHEMA) : '';
  ok('8g) la plantilla SVE del bridge es la v2 (5 claves reales)',
    /clave: 'plan'/.test(bridgeSrc) && /clave: 'indicadores'/.test(bridgeSrc) &&
    /clave: 'areas'/.test(bridgeSrc) && !/clave: 'alertas'/.test(bridgeSrc));
  ok('8g) migración 20260930-sve-template-v2 presente en el schema',
    /20260930-sve-template-v2/.test(schemaSrc) &&
    /DELETE FROM mp_programa_secciones[\s\S]*?'alertas','reportes','admin','auditoria'/.test(schemaSrc));

  // 8h) 📦826 — Tipografía del HOST alineada con la del prototipo.
  //
  // Por qué este bloque existe: hasta ahora los guards de tipografía solo
  // cubrían `sve.css` (el prototipo). El host podía volver a `Roboto` y los
  // checks seguían en verde — o sea, el test pasaba mientras la pantalla
  // mostraba DOS tipografías. Estos checks cierran ese hueco.
  //
  // 1) Familias: el host usa los tokens. `body { font-family: 'Roboto' }` lo
  //    pisaba por encima de `body { font-family: var(--kair-font-ui) }` de
  //    shared/kair-components.css: dentro de UNA pantalla el marco se veía en
  //    DM Sans y el alrededor en Roboto.
  // 2) El `<link>` a Google Fonts se fue: kair-design-tokens.css ya hace el
  //    `@import` de DM Sans + Manrope, así que era un fetch redundante.
  // 3) Escala: los tamaños del host caen en los 9 tokens del prototipo. Los
  //    contenedores de ICONO quedan fuera a propósito (el glifo de Font
  //    Awesome se mide por su caja, no por la escala tipográfica) y por eso
  //    se declaran aquí: sin esta lista, el check no distinguiría un descuido
  //    de un icono.
  const HOST_HTMLS = [
    { nombre: 'home', src: fs.existsSync(HOME_HTML) ? leer(HOME_HTML) : '' },
    { nombre: 'programa', src: fs.existsSync(PROGRAMA_HTML) ? leer(PROGRAMA_HTML) : '' }
  ];
  const ESCALA_HOST = ['0.6875rem', '0.75rem', '0.8125rem', '0.875rem', '0.9375rem',
    '1.0625rem', '1.3125rem', '1.6875rem', '1.5rem'];
  const ICONOS_HOST = new Set([
    '.mp-pg__icon', '.mp-pg__empty-icon', '.mp-pg__placeholder-icon',
    '.mp-pg__modal-close', '.mp-pg__opcion-icon', '.mp-pg__preview-item i',
    '.mp-home__icon', '.mp-card__icon'
  ]);
  // Normaliza un selector para compararlo. Un comentario pegado arriba de la
  // regla NO es parte del selector: sin esta limpieza toda regla precedida por
  // un comentario queda sin evaluar en silencio.
  const normSel = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ').replace(/\s*([,>])\s*/g, '$1 ').replace(/\s+/g, ' ').trim();

  const hostConFamilias = HOST_HTMLS.filter(h => /Roboto|Lexend/.test(h.src)).map(h => h.nombre);
  ok('8h) el host NO usa Roboto ni Lexend',
    hostConFamilias.length === 0, hostConFamilias.join(', ') || 'ninguno');
  ok('8h) el body del host usa el token de UI (--kair-font-ui)',
    HOST_HTMLS.every(h => /font-family:\s*var\(--kair-font-ui/.test(h.src)));
  ok('8h) el host no carga Google Fonts por <link> (lo hace kair-design-tokens)',
    HOST_HTMLS.every(h => !/fonts\.googleapis\.com/.test(h.src)));
  ok('8h) el host carga kair-design-tokens.css (de donde salen las familias)',
    HOST_HTMLS.every(h => /shared\/kair-design-tokens\.css/.test(h.src)));

  // Escala: recorre regla por regla y exige token, icono declarado o base.
  const fueraDeEscala = [];
  HOST_HTMLS.forEach(h => {
    sinComentarios(h.src).replace(/([^{}]+)\{([^{}]*)\}/g, (todo, sel, cuerpo) => {
      const sel_ = normSel(sel);
      const m = cuerpo.match(/font-size:\s*([^;]+);/) || cuerpo.match(/font:\s*[^;]*?(\d*\.?\d+rem)/);
      if (!m) return todo;
      const v = m[1].trim();
      if (ICONOS_HOST.has(sel_) || sel_ === 'body') return todo;
      if (ESCALA_HOST.includes(v) || v.startsWith('clamp(')) return todo;
      fueraDeEscala.push(h.nombre + ' ' + sel_ + ' = ' + v);
      return todo;
    });
  });
  ok('8h) la escala del host cae en los tokens del prototipo (iconos declarados aparte)',
    fueraDeEscala.length === 0, fueraDeEscala.join(' | ') || 'todo en escala');

  const hostTracking = [...new Set(HOST_HTMLS.flatMap(h =>
    (sinComentarios(h.src).match(/letter-spacing:\s*(-?[\d.]+[a-z]+)/g) || [])
      .map(s => s.replace(/letter-spacing:\s*/, ''))))];
  ok('8h) el tracking del host usa la escala del prototipo',
    hostTracking.length > 0 &&
    hostTracking.every(v => ['-0.03em', '-0.04em', '0.06em', 'normal'].includes(v)),
    hostTracking.join(', ') || 'sin tracking');

  // 8i) 📦826 — Plan PHVA editable y con los indicadores vivos.
  //
  // La guarda que importa es la 8i-3: el anillo, el chip "Actual", las tarjetas
  // de fase y los trimestres se calculaban UNA vez al montar la vista, así que
  // al tocar una celda AP/AE solo se actualizaba la fila TOTALES y el anillo
  // se quedaba congelado (marcaba 54% con la tabla en 49%). Si alguien saca la
  // llamada a pintarIndicadores() desde repaint(), el bug vuelve en silencio:
  // el resto de los checks seguiría en verde.
  const sveAppSrc = fs.existsSync(path.join(SVE_DIR, 'sve-app.js')) ? leer(path.join(SVE_DIR, 'sve-app.js')) : '';
  const sveViewsSrc = fs.existsSync(path.join(SVE_DIR, 'sve-views.js')) ? leer(path.join(SVE_DIR, 'sve-views.js')) : '';
  ok('8i) el store puede agregar, editar y eliminar actividades',
    /addActividad:/.test(sveAppSrc) && /updateActividad:/.test(sveAppSrc) && /removeActividad:/.test(sveAppSrc));

  // Sin id estable, editar "la fila 3" escribe sobre la actividad 4 en cuanto
  // se borra una fila antes: las actividades se referenciaban por posicion.
  // 📦827 — La firma paso a recibir el plan: se llama desde _normalizar(), que
  // arma el estado nuevo y todavia no lo asigno a `state`.
  ok('8i) las actividades tienen id estable (migracion al cargar)',
    /function asegurarIdsPlan\(plan\)/.test(sveAppSrc) &&
    (sinComentarios(sveAppSrc).match(/asegurarIdsPlan\(/g) || []).length >= 3);
  ok('8i) la actividad se localiza por id, no por posicion',
    /buscarActividad:/.test(sveAppSrc) || /buscarActividad/.test(sveAppSrc));

  const cuerpoPlan = (sinComentarios(sveViewsSrc).match(/function repaint\(\)\s*\{[\s\S]*?\n    \}/) || [''])[0];
  ok('8i) repaint() repinta los indicadores, no solo el tbody',
    /pintarIndicadores\(\);/.test(cuerpoPlan),
    cuerpoPlan.slice(0, 60).replace(/\s+/g, ' '));
  ok('8i) pintarIndicadores() repinta anillo, chip y tarjetas de fase',
    /ringHost\.innerHTML = ""/.test(sveViewsSrc) &&
    /fasesCards\.innerHTML = ""/.test(sveViewsSrc) &&
    /trimestre\.innerHTML = ""/.test(sveViewsSrc) &&
    /chipActual\.textContent/.test(sveViewsSrc));
  ok('8i) los totales de la tabla llevan clase (para poder distinguirlos de una actividad)',
    /className: "sve-total-row"/.test(sveViewsSrc));

  // Editabilidad: sin esto, actividad y responsable son <td> de texto fijo.
  ok('8i) actividad y responsable se editan en linea',
    /celdaTexto\(a, "actividad"/.test(sveViewsSrc) &&
    /celdaTexto\(a, "responsable"/.test(sveViewsSrc) &&
    /updateActividad\(a\.id, patch\)/.test(sveViewsSrc));
  ok('8i) hay boton para agregar y para eliminar filas de actividad',
    /sve-phase-row__head/.test(sveViewsSrc) &&
    /agregarActividad\(f\.id\)/.test(sveViewsSrc) &&
    /sve-rowdel/.test(sveViewsSrc) &&
    /removeActividad\(a\.id\)/.test(sveViewsSrc));
  // El recorte del nombre es el fallo que un test de valores no ve: por eso se
  // exige textarea con alto automatico, no un input de una sola linea.
  ok('8i) el nombre de la actividad usa textarea de alto automatico (no se recorta)',
    /el\("textarea"/.test(sveViewsSrc) &&
    /function ajustarAlto/.test(sveViewsSrc) &&
    /scrollHeight/.test(sveViewsSrc));
  ok('8i) la actividad nueva nace sin programar (no infla el cumplimiento)',
    /meses\.push\(\[0, 0\]\)/.test(sveAppSrc));

  // =====================================================================
  // 📦827 — Los datos del programa SVE viven en SQLite y viajan en el
  // .kairsync. Hasta 📦826 vivían en localStorage: dentro de la app y de ESA
  // PC, así que no viajaban entre máquinas ni se respaldaban.
  // =====================================================================
  const persSrc = leerSeguro(path.join(SVE_DIR, 'sve-persistencia.js'));
  const bridgeDatosSrc = leerSeguro(path.join(RAIZ, 'main', 'medprev-sve-datos-bridge.js'));
  const schemaDatosSrc = leerSeguro(path.join(RAIZ, 'main', 'medprev-sve-datos-schema-sql.js'));
  const preloadSrc = leerSeguro(path.join(RAIZ, 'preload.js'));
  const mainJsSrc = leerSeguro(path.join(RAIZ, 'main.js'));
  const syncSerSrc = leerSeguro(path.join(RAIZ, 'main', 'sync-serializer.js'));

  ok('8j) la capa de persistencia del SVE existe', persSrc.length > 0);
  // El indice tiene que ser >= 0 explicito: `indexOf` devuelve -1 cuando NO
  // encuentra el archivo, y -1 < cualquier otra cosa es verdadero, asi que sin
  // esta comprobacion el guard pasa justamente cuando el archivo se dejo de
  // cargar. Y va SIN COMENTARIOS: el nombre del archivo aparece en el comentario
  // que explica la carga, y buscar ahi daria un indice valido de mentira.
  const progJsCodigo = sinComentarios(progJs);
  const iPers = progJsCodigo.indexOf('sve-persistencia.js');
  const iApp = progJsCodigo.indexOf("sve-app.js' + v");
  ok('8j) la capa de persistencia se carga ANTES que el store',
    iPers >= 0 && iApp >= 0 && iPers < iApp, 'pers=' + iPers + ' app=' + iApp);

  // El host tiene que ESPERAR la hidratacion: si navega antes, las vistas se
  // pintan contra un store vacio y la pantalla sale en blanco sin error visible.
  ok('8j) el host espera la hidratacion antes de navegar',
    /SveApp\.init\(host/.test(progJs) &&
    /typeof p\.then === 'function'/.test(progJs) &&
    /SveApp\.go\(\{ name: ruta \}\)/.test(progJs));

  ok('8j) el store hidrata desde la base antes de arrancar el router',
    /return SveStore\.init\(\)\.then/.test(sveAppSrc) &&
    /pers\.leer\(\)/.test(sveAppSrc) &&
    /SveRouter\.start\(container\)/.test(sveAppSrc));
  ok('8j) el store escribe a traves (no solo escribe en memoria)',
    /casosCrear/.test(sveAppSrc) && /casosActualizar/.test(sveAppSrc) &&
    /casosEliminar/.test(sveAppSrc) && /actividadCrear/.test(sveAppSrc) &&
    /actividadGuardar/.test(sveAppSrc) && /actividadEliminar/.test(sveAppSrc) &&
    /celdaGuardar/.test(sveAppSrc) && /analisisGuardar/.test(sveAppSrc));

  // La garantia mas importante del paquete: las 1.400 lineas de vistas NO
  // saben que existe una base. Si alguien mete un electronAPI o un SvePersistencia
  // en sve-views.js, el contrato se rompio y hay que revisarlo a mano.
  ok('8j) las vistas NO conocen la base (el store es el unico que habla con ella)',
    !/electronAPI|SvePersistencia|medprevSve|ipcRenderer/.test(sveViewsSrc));

  // Id de TEXTO: con maxId+1, dos PCs creando el caso 25 se pisan en silencio
  // al fusionar por id. El chequeo va sobre el codigo SIN comentarios: el
  // comentario que explica el cambio menciona "maxId + 1" y haria fallar la
  // guarda justo cuando el codigo esta bien.
  ok('8j) el id de caso es de texto, no maxId + 1',
    !/maxId\s*\+\s*1/.test(sinComentarios(sveAppSrc)) && /nuevoId\('msc'\)/.test(sveAppSrc));
  ok('8j) el puente valida el id propuesto en vez de pisar el registro',
    /function _idLibre/.test(bridgeDatosSrc) && /idOpcional/.test(bridgeDatosSrc));

  // Un programa al que el usuario le borro todos los casos y actividades tiene
  // las tablas vacias: si "esta inicializado" se preguntara por los registros,
  // se volveria a sembrar con la demo y le aparecerian datos que borro.
  ok('8j) un programa vacio no se vuelve a sembrar (el marcador es mp_sve_meta)',
    /function _inicializado/.test(sveAppSrc) && /if \(d\.meta\) return true/.test(sveAppSrc));
  ok('8j) la migracion del localStorage es de una sola vez',
    /pers\.migrar/.test(sveAppSrc) && /_borrarLocal\(\)/.test(sveAppSrc) &&
    /migrado/.test(sveAppSrc));

  // Caer al localStorage cuando la base falla es PEOR que no mostrar nada: el
  // usuario seguiria capturando datos que no se sincronizan sin enterarse.
  // El guard mira la RAMA DE LECTURA puntual, no cualquier aparicion de la
  // palabra: hay varias salidas 'error' y una sola es la que decide.
  ok('8j) un error de base NO degrada a localStorage en silencio',
    /if \(!r\.ok\) return \{ estado: 'error', error: r \};/.test(sveAppSrc) &&
    /function _pintarError/.test(sveAppSrc) && /Reintentar/.test(sveAppSrc));
  ok('8j) el modo local (prototipo suelto) queda como fallback, no como error',
    /estado: 'local'/.test(sveAppSrc) && /_leerLocal/.test(sveAppSrc) &&
    /modo !== 'sqlite'/.test(sveAppSrc));

  // save() lo llama la celda AP/AE SIN decir que celda toco. Diffar contra la
  // sombra es lo que evita reescribir 12 meses por clic y lo que permite no
  // tocar esa vista.
  ok('8j) save() solo manda las celdas que cambiaron (diff contra la sombra)',
    /sombraPlan/.test(sveAppSrc) && /function _diffPlan/.test(sveAppSrc) &&
    /celdaGuardar\(c\.id, c\.mes/.test(sveAppSrc));
  // Una escritura fallida que no revierte la sombra jamas se reintentaria: el
  // diff la daria por aplicada y el dato se perderia en silencio.
  ok('8j) una celda fallida se revierte para poder reintentarse',
    /s\.meses\[c\.mes - 1\] = c\.antes/.test(sveAppSrc));
  ok('8j) las escrituras van encoladas (dos clics no se invierten)',
    /encolar/.test(sveAppSrc) && /function _encolar/.test(persSrc));

  // La migracion de lo ya capturado es el punto sensible: si se pierde, el
  // usuario pierde el trabajo que hizo antes de esta version.
  ok('8j) la migracion de datos SVE se expone en preload y se registra en main',
    /medprevSveMigrar/.test(preloadSrc) &&
    /registerMedprevSveDatosHandlers/.test(mainJsSrc) &&
    /MEDPREV_SVE_SCHEMA_SQL/.test(mainJsSrc));
  const CANALES_SVE = [
    'medprev:sve:datos:get', 'medprev:sve:casos:crear', 'medprev:sve:casos:actualizar',
    'medprev:sve:casos:eliminar', 'medprev:sve:plan:actividad:crear',
    'medprev:sve:plan:actividad:guardar', 'medprev:sve:plan:actividad:eliminar',
    'medprev:sve:plan:celda:guardar', 'medprev:sve:meta:guardar',
    'medprev:sve:indicadores:guardar', 'medprev:sve:morbilidad:guardar',
    'medprev:sve:analisis:guardar', 'medprev:sve:migrar'
  ];
  const faltanBridge = CANALES_SVE.filter(c => bridgeDatosSrc.indexOf("'" + c + "'") === -1);
  const faltanPreload = CANALES_SVE.filter(c => preloadSrc.indexOf(c) === -1);
  ok('8j) el bridge expone los 13 canales de datos SVE',
    faltanBridge.length === 0, faltanBridge.join(', '));
  ok('8j) preload expone los 13 canales de datos SVE',
    faltanPreload.length === 0, faltanPreload.join(', '));
  ok('8j) el schema SVE declara las 8 tablas mp_sve_*',
    ['meta', 'casos', 'plan_actividades', 'plan_meses', 'indicadores',
      'indicadores_valores', 'morbilidad', 'analisis']
      .every(t => schemaDatosSrc.indexOf('mp_sve_' + t) !== -1));

  // Si el programa no esta en el serializer, los datos quedan en la base pero
  // no viajan: el sintoma es "en el otro PC no aparece", sin ningun error.
  ok('8j) el programa SVE viaja en el .kairsync',
    /medprev_programas/.test(syncSerSrc) && /_serializeMedprevProgramas/.test(syncSerSrc) &&
    /_deserializeMedprevProgramas/.test(syncSerSrc));
  ok('8j) el contenido del programa se serializa anidado bajo el programa',
    /mp_sve_casos/.test(syncSerSrc) && /mp_sve_plan_actividades/.test(syncSerSrc));

  // 📦827 — El chip del encabezado tiene que DEPENDER de dónde viven los datos.
  // Los dos textos existen (el programa en la app sincroniza, el prototipo
  // suelto no), lo que no puede ser uno fijo: con los datos en SQLite, decir
  // "Solo en este equipo" es tan falso como antes lo era "Sincronizado".
  ok('8j) el chip del encabezado dice la verdad segun donde viven los datos',
    /modo === "sqlite"/.test(sveViewsSrc) &&
    /SveStore\.modo\(\)/.test(sveViewsSrc) &&
    /Solo en este equipo/.test(sveViewsSrc) && /Sincronizado/.test(sveViewsSrc));
  // Y el color acompaña al texto: el punto verde junto a "solo en este equipo"
  // se contradía a sí mismo.
  ok('8j) el punto del chip cambia de color con el estado',
    /\.sve-sync:not\(\.sve-sync--ok\)/.test(sveCss));

  // ---- 8k) 📦827-fix — Archivar vs eliminar de verdad, y que la baja viaje ----
  const progBridgeSrc = leerSeguro(path.join(RAIZ, 'main', 'medprev-programas-bridge.js'));
  const progSchemaSrc = leerSeguro(path.join(RAIZ, 'main', 'medprev-programas-schema-sql.js'));

  ok('8k) la interfaz ofrece DOS acciones distintas, no un solo "Eliminar"',
    /archivarPrograma\(\)/.test(progJs) && /eliminarPrograma\(\)/.test(progJs) &&
    /onclick="archivarPrograma\(\)"/.test(progJs) && /onclick="eliminarPrograma\(\)"/.test(progJs) &&
    /Archivar<\/span>/.test(progJs) && /Eliminar de verdad<\/span>/.test(progJs));
  ok('8k) el boton destructivo no se llama solo "Eliminar" (quedaria ambiguo)',
    !/>Eliminar<\/span>/.test(progJs) && /Eliminar de verdad/.test(progJs));
  ok('8k) el modo destructivo exige confirmacion explicita (guarda anti clic perdido)',
    /confirmacion: 'eliminar'/.test(progJs) &&
    /payload\.confirmacion !== 'eliminar'/.test(progBridgeSrc));
  // Lo que esta guarda puede verificar de verdad es que la rama de ARCHIVAR no
  // llegue al borrado: se extrae el bloque y se mira su contenido. Que el
  // borrado "de verdad" funcione lo comprueba test-medprev-programas-bridge.js
  // con conteos reales (antes=6 despues=0) — un regex no puede afirmar eso sin
  // mentir, que es justo lo que pasó con la primera versión de este guard.
  const ramaArchivar = (progBridgeSrc.split("if (modo === 'archivar') {")[1] || '').split('if (payload.confirmacion')[0];
  ok('8k) archivar NO toca las tablas de contenido (si hiciera, perderias la historia)',
    !/DELETE FROM/.test(ramaArchivar), ramaArchivar.replace(/\s+/g, ' ').slice(0, 90));
  ok('8k) la rama destructiva borra las 8 tablas de contenido del programa',
    (progBridgeSrc.split('var HIJOS = [')[1] || '').split(']')[0].split(',').length === 9 &&
    /DELETE FROM ' \+ t \+ ' WHERE programa_id/.test(progBridgeSrc));
  ok('8k) el modo por defecto sigue siendo archivar (nadie borra sin pedirlo)',
    /var modo = \(payload\.modo === 'eliminar'\) \? 'eliminar' : 'archivar'/.test(progBridgeSrc));
  // La tabla de bajas solo puede guardar metadatos del PROGRAMA. Si alguien le
  // agrega una columna con datos del trabajador, esta guarda salta: es el
  // registro que viaja a todos los equipos, asi que ahi no puede haber nada
  // personal.
  const cuerpoBajas = (progSchemaSrc.split('mp_programas_bajas')[1] || '').split('CREATE INDEX')[0];
  ok('8k) la tabla de bajas existe y NO guarda datos personales del trabajador',
    /CREATE TABLE IF NOT EXISTS mp_programas_bajas/.test(progSchemaSrc) &&
    !/trabajador|documento|telefono|fecha_nacimiento/.test(cuerpoBajas),
    cuerpoBajas.replace(/\s+/g, ' ').slice(0, 120));
  ok('8k) las bajas viajan en el .kairsync (sin esto, borrar no llega a los demas)',
    // OJO: no basta con que las funciones existan — hay que exigir que la
    // entidad este CONECTADA al payload. Con la funcion definida pero sin
    // asignado, el guard pasaba y la baja no viajaba (probado con mutacion).
    /medprev_programas_bajas: _serializeMedprevBajas\(db, companyKey\)/.test(syncSerSrc) &&
    /_deserializeMedprevBajas\(db, entities\.medprev_programas_bajas/.test(syncSerSrc) &&
    /function _serializeMedprevBajas/.test(syncSerSrc));
  // La contra-prueba: tratar "archivar" como borrado seria PEOR que no hacer
  // nada, porque el usuario perderia su historia en todos los equipos.
  ok('8k) archivar marca el programa remoto SIN borrar su contenido',
    /var destructiva = baja\.origen !== 'archivo'/.test(syncSerSrc) &&
    /SET estado = 'eliminado' WHERE id = \? AND empresa_id = \?/.test(syncSerSrc));

  // ---- 8l) 📦827-fix-2 — La app no se queda en "Error al cargar la vista" y la
  //      migracion no borra los meses del plan. Lo que el dueño reporto como
  //      "app congelada" era el Dashboard del SVE reventando con
  //      "Cannot read properties of undefined (reading '-1')" y, por el camino,
  //      una migracion que se comia el plan. ----
  const vistasSrc = leerSeguro(path.join(RAIZ, 'modules', 'gestion-salud', 'medicina-preventiva', 'sve', 'sve-views.js'));
  const sveSchemaSrc = leerSeguro(path.join(RAIZ, 'main', 'medprev-sve-datos-schema-sql.js'));
  const mainSrc = leerSeguro(path.join(RAIZ, 'main.js'));
  const dashSrc = (vistasSrc.split('V.Dashboard = ')[1] || '');
  const indSrc = (vistasSrc.split('V.Indicadores = ')[1] || '');

  ok('8l) las vistas normalizan la forma de los indicadores antes de indexarlos',
    /function _conjuntoSeguro/.test(vistasSrc) && /function _indSeguro/.test(vistasSrc) &&
    /var IND_MEDIDAS =/.test(vistasSrc));
  ok('8l) el Dashboard usa el conjunto normalizado',
    /var ind = _conjuntoSeguro\(st\.indicadores\)/.test(dashSrc));
  ok('8l) la vista de Indicadores usa el conjunto normalizado',
    /var ind = _conjuntoSeguro\(st\.indicadores\)/.test(indSrc));
  // El sintoma era restar 1 sin mirar: con `anios` vacio daba -1 y
  // `medida[-1]` reventaba. La guarda tiene que estar en la MISMA expresion
  // que el indice. 📦830: el clamp a Math.min(4, ...) se quito porque el
  // usuario ahora puede editar la serie (mas o menos de 5 años); el indice
  // pasa a ser SIEMPRE el ultimo año de la lista.
  ok('8l) el indice del Dashboard comprueba que HAYA anios antes de restar 1',
    /var anioInd = ind\.prevalencia\.anios\.length \? ind\.prevalencia\.anios\.length - 1 : -1;/.test(dashSrc));
  ok('8l) el Dashboard lee las medidas por el acceso que valida el arreglo',
    /function _v\(obj, medida, i\)/.test(dashSrc) &&
    /_v\(ind\.prevalencia, 'promedio', i\)/.test(dashSrc) &&
    /_v\(ind\.eficacia, 'sugeridas', i\)/.test(dashSrc) &&
    !/ind\.prevalencia\.promedio\[/.test(dashSrc) &&
    !/ind\.eficacia\.implementadas\[anioInd\]/.test(dashSrc));
  // 📦830: el normalizador ahora ademas PADEA cada medida al largo de la lista
  // de años (null para los años sin dato), porque los años ahora son editables.
  // La invariante que protege este check es la misma: toda medida termina como
  // arreglo, nunca como undefined.
  ok('8l) el normalizador deja TODA medida como arreglo (por eso Indicadores puede indexar)',
    /var arr = Array\.isArray\(o\[m\]\) \? o\[m\]\.slice\(\) : \[\];/.test(vistasSrc) &&
    /salida\[m\] = arr;/.test(vistasSrc) &&
    /ausentismo: \['diasIncapacidad', 'diasProgramados'\]/.test(vistasSrc) &&
    /eficacia: \['sugeridas', 'implementadas'\]/.test(vistasSrc));
  ok('8l) el titulo del año no puede imprimir "undefined"',
    /ind\.prevalencia\.anios\[anioInd\] \|\| "sin años registrados"/.test(dashSrc));
  ok('8l) la tarjeta de indicador sin serie dice "sin serie" en vez de romperse',
    /Sin serie anual registrada para este indicador/.test(indSrc));
  // 📦832: esa tarjeta de morbilidad fue reemplazada por "Casos SVE por año",
  // así que la vista ya NO lee st.morbilidad — una morbilidad vacía no puede
  // reventarla (invariante original, cumplida de forma más fuerte). La misma
  // invariante ahora protege la tarjeta nueva: seguimientos ausentes o
  // sin años dejan la tabla en el estado vacío, no un crash.
  ok('8l) la morbilidad vacia no revienta la vista',
    !/st\.morbilidad/.test(indSrc) &&
    /Array\.isArray\(st\.seguimientos\) \? st\.seguimientos : \[\]/.test(indSrc) &&
    /anios\.length/.test(indSrc));

  // ---- La migracion no puede perder filas. El PRAGMA va dentro de la funcion
  //      compartida porque better-sqlite3 PRENDE las claves foraneas: el
  //      `DROP TABLE` de la tabla padre dispara la CASCADE y se come los meses
  //      del plan antes de que su propia migracion los copie (medido: 228 -> 0).
  ok('8l) las claves foraneas se apagan DENTRO de la funcion compartida de migraciones',
    /function aplicarMigracionesMedprevSve/.test(sveSchemaSrc) &&
    /db\.pragma\('foreign_keys = OFF'\)/.test(sveSchemaSrc) &&
    /db\.pragma\('foreign_keys = ON'\)/.test(sveSchemaSrc));
  ok('8l) y se restauran aunque una migracion falle (finally, no despues del bucle)',
    /finally\s*\{[\s\S]{0,200}foreign_keys = ON/.test(sveSchemaSrc));
  ok('8l) main.js usa esa funcion y NO su propio bucle con el pragma',
    /aplicarMigracionesMedprevSve\(db/.test(mainSrc) && !/foreign_keys = OFF/.test(mainSrc));
  ok('8l) el toast de eliminar lee la clave que el bridge devuelve (borrados.sve)',
    /b\.sve \|\| 0/.test(progJs) && !/b\.seve/.test(progJs));

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
