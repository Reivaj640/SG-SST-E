/* main/test-capacitaciones-pickers.js
 * El modal "Editar Capacitacion" del Programa de Capacitacion: la Fecha
 * Programada y la Hora (opcional) con desplegables propios.
 *
 * EL PORQUE
 * ----------
 * El <input type="date"> y el <input type="time"> nativos se veian como los
 * del sistema operativo (el desplegable de la hora, con su lista de 12 h), y
 * no como el resto de la app. El Generador de Actas del COPASST ya tiene su
 * propio sistema (📦1104) y el Formulario de Registro de ausentismo lo tuvo
 * antes (📦1101): el campo nativo queda OCULTO como fuente de verdad y un
 * boton con calendario o menu propio muestra el valor.
 *
 * Este modulo tiene TRES reglas propias que el patron no tiene, y el test
 * las protege:
 *   1 · la HORA ES OPCIONAL: vacia significa "sin hora" (no aparece en el
 *     calendario), y el boton tiene que decirlo ("Sin hora"), no "Seleccione...";
 *   2 · la ventana horaria (06:00-20:00) vive en el <input> nativo (min/max):
 *     la rejilla la respeta y deshabilita lo que queda por fuera;
 *   3 · sin hora no hay celda activa: el menu tiene que abrirse en la PRIMERA
 *     casilla habilitada, no arriba del todo sobre las casillas invalidas.
 *
 * Patron del repo: los metodos se EXTRAEN del archivo real con new Function
 * (mismo enfoque que test-copasst-actas-pickers.js) y se ejecutan.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RUTA_LOGIC = path.join(ROOT, 'modules', 'recursos', 'capacitaciones', 'capacitaciones-logic.js');
const RUTA_HTML = path.join(ROOT, 'modules', 'recursos', 'capacitaciones', 'capacitaciones-view.html');
const RUTA_CSS = path.join(ROOT, 'modules', 'recursos', 'capacitaciones', 'capacitaciones-view.css');
const RUTA_INDEX = path.join(ROOT, 'index.html');

const src = fs.readFileSync(RUTA_LOGIC, 'utf8');
const html = fs.readFileSync(RUTA_HTML, 'utf8');
const css = fs.readFileSync(RUTA_CSS, 'utf8');
const htmlIndex = fs.readFileSync(RUTA_INDEX, 'utf8');

const CAMPOS = ['trainingDate', 'trainingHora'];

const checks = [];
function ok(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra == null ? '' : String(extra) });
}

// ══════════════════════════════════════════════════════════════════
// Helpers: extraer un metodo del archivo real
// ══════════════════════════════════════════════════════════════════
function extraerMetodo(fuente, nombre) {
  // El archivo tiene metodos indentados a 2 y a 4 espacios: el extractor
  // tiene que aceptar los dos, o no encuentra ni saveTraining (4) ni
  // openModal (4) y los contratos de datos dejan de protegerse.
  const re = new RegExp('^[ \\t]{2,6}(?:async[ \\t]+)?(?:function[ \\t]+)?' + nombre + '[ \\t]*\\(', 'm');
  const m = re.exec(fuente);
  if (!m) return null;
  const inicio = m.index;
  const llaveAbierta = fuente.indexOf('{', inicio);
  if (llaveAbierta < 0) return null;
  let nivel = 0;
  let enTexto = false;
  let esc = false;
  let enComentario = false;
  for (let i = llaveAbierta; i < fuente.length; i++) {
    const c = fuente[i];
    if (enComentario) {
      if (c === '\n') enComentario = false;
      continue;
    }
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '/' && fuente[i + 1] === '/') { enComentario = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { enTexto = !enTexto; continue; }
    if (enTexto) continue;
    if (c === '{') nivel++;
    else if (c === '}') {
      nivel--;
      if (nivel === 0) return fuente.slice(inicio, i + 1);
    }
  }
  return null;
}

/** Convierte el bloque extraido en una funcion suelta ejecutable. */
function comoFuncion(fuenteMetodo) {
  const esAsync = /^\s*async\s/.test(fuenteMetodo);
  const sinEspacios = fuenteMetodo.replace(/^\s+/, '').replace(/^async\s+/, '');
  const yaEsFunction = /^function\s/.test(sinEspacios);
  const nombre = sinEspacios.match(/^(?:function\s+)?([A-Za-z_][A-Za-z0-9_]*)/)[1];
  const cabeza = yaEsFunction
    ? (esAsync ? 'async ' : '')
    : (esAsync ? 'async function ' : 'function ');
  return new Function(cabeza + sinEspacios + '\nreturn ' + nombre + ';')();
}

function correrCon(src, html, css, htmlIndex) {
  const c = [];
  function an(nombre, cond, extra) { c.push({ name: nombre, ok: !!cond, extra: extra || '' }); }

  // ── 1 · el marcado: los dos campos con su desplegable ──────────────
  CAMPOS.forEach(function (id) {
    an('1a) el campo ' + id + ' tiene su desplegable cap-dd',
      html.indexOf('data-cap-dd="' + id + '"') >= 0);
    an('1b) el campo ' + id + ' conserva su ID original',
      html.indexOf('id="' + id + '"') >= 0);
  });
  an('1c) los dos nativos se ocultan como fuente de verdad (cap-dd__native)',
    (html.match(/cap-dd__native/g) || []).length >= 2,
    'aparece ' + (html.match(/cap-dd__native/g) || []).length + ' veces');
  an('1d) el marcado trae boton toggle y menu para cada campo',
    (html.match(/cap-dd__toggle/g) || []).length >= 2 &&
    (html.match(/cap-dd__menu/g) || []).length >= 2);
  an('1e) la fecha usa el menu de calendario (cap-cal)',
    (html.match(/class="cap-dd__menu cap-cal"/g) || []).length === 1,
    'aparece ' + (html.match(/class="cap-dd__menu cap-cal"/g) || []).length + ' veces');
  an('1f) la hora usa el desplegable de horarios (cap-dd--hora)',
    (html.match(/cap-dd--hora/g) || []).length >= 1,
    'aparece ' + (html.match(/cap-dd--hora/g) || []).length + ' veces');
  an('1g) los rotulos apuntan al campo (for=), que ademas abre el desplegable',
    CAMPOS.every(function (id) { return html.indexOf('for="' + id + '"') >= 0; }));
  an('1h) no queda ninguna clase del COPASST sin convertir (cop-dd / cop-cal / cop-horas)',
    ((html + css + src).match(/\bcop-(dd|cal|horas)\b/g) || []).length === 0,
    'quedan ' + ((html + css + src).match(/\bcop-(dd|cal|horas)\b/g) || []).length);
  an('1i) la fecha sigue siendo obligatoria (required)',
    /id="trainingDate"[^>]*required/.test(html));
  an('1j) la hora conserva su ventana (min/max) en el nativo',
    /id="trainingHora"[\s\S]{0,140}min="06:00" max="20:00"/.test(html));
  an('1k) el boton de limpiar hora sigue en el modal',
    html.indexOf('id="clearTrainingHora"') >= 0);
  an('1l) la ayuda "Sin hora" sigue en el modal',
    html.indexOf('Sin hora') >= 0);

  // ── 2 · los metodos existen ───────────────────────────────────────
  ['_initCapPickers', '_buildMonthGridCap', '_buildTimeSlotsCap',
   '_pintarCalendarioCap', '_pintarHorasCap', '_actualizarLabelCap',
   '_syncCapPickers', '_abrirCap', '_cerrarCap', '_cerrarTodosCap',
   '_centrarHorasCap'
  ].forEach(function (m) {
    an('2) existe el metodo ' + m, !!extraerMetodo(src, m));
  });
  an('2b) el modal inicializa los desplegables',
    src.indexOf('this._initCapPickers()') >= 0);

  // ── 3 · la grilla del mes se EJECUTA de verdad ─────────────────────
  const fnGridRaw = extraerMetodo(src, '_buildMonthGridCap');
  an('3-pre) _buildMonthGridCap se puede extraer', !!fnGridRaw);
  if (fnGridRaw) {
    const fnGrid = comoFuncion(fnGridRaw);
    const nov = fnGrid(2026, 10); // noviembre 2026 (mes 0-based)
    an('3a) noviembre 2026 arma 42 celdas', nov.length === 42, 'dio ' + nov.length);
    an('3b) la primera celda es 26 de octubre (la semana arranca en lunes)',
      nov[0].iso === '2026-10-26', nov[0].iso);
    an('3c) el dia 1 de noviembre cae en el indice 6 y es del mes',
      nov[6].iso === '2026-11-01' && nov[6].inMonth === true, nov[6].iso);
    an('3d) la ultima celda es 6 de diciembre',
      nov[41].iso === '2026-12-06', nov[41].iso);
    an('3e) noviembre tiene 30 dias marcados como del mes',
      nov.filter(function (x) { return x.inMonth; }).length === 30);
    const feb = fnGrid(2026, 1);
    an('3f) febrero 2026 (no bisiesto) tiene 28 dias',
      feb.filter(function (x) { return x.inMonth; }).length === 28);
    const feb24 = fnGrid(2024, 1);
    an('3g) febrero 2024 (bisiesto) tiene 29 dias',
      feb24.filter(function (x) { return x.inMonth; }).length === 29);
    an('3h) las 42 celdas traen ISO valido AAAA-MM-DD',
      nov.every(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x.iso); }));
  }

  // ── 4 · la rejilla de horarios se EJECUTA de verdad ────────────────
  const fnSlotsRaw = extraerMetodo(src, '_buildTimeSlotsCap');
  an('4-pre) _buildTimeSlotsCap se puede extraer', !!fnSlotsRaw);
  if (fnSlotsRaw) {
    const fnSlots = comoFuncion(fnSlotsRaw);
    const slots = fnSlots();
    an('4a) hay 96 horarios (24 horas en pasos de 15 minutos)',
      slots.length === 96, 'dio ' + slots.length);
    an('4b) el primero es 00:00', slots[0] === '00:00', slots[0]);
    an('4c) el ultimo es 23:45', slots[95] === '23:45', slots[95]);
    an('4d) todos los horarios son HH:MM',
      slots.every(function (s) { return /^\d{2}:\d{2}$/.test(s); }));
    an('4e) ningun horario se repite',
      new Set(slots).size === slots.length);
    an('4f) 08:00 y 09:00 estan en la grilla',
      slots.indexOf('08:00') >= 0 && slots.indexOf('09:00') >= 0);
    an('4g) el paso es de 15 minutos (no hay 08:10)',
      slots.indexOf('08:10') === -1 && slots.indexOf('08:15') >= 0);
  }

  // ── 5 · los contratos que no pueden romperse ──────────────────────
  const fnSave = extraerMetodo(src, 'saveTraining');
  an('5a) el guardado sigue leyendo los dos IDs originales',
    !!fnSave && CAMPOS.every(function (id) {
      return fnSave.indexOf("document.getElementById('" + id + "')") >= 0;
    }));
  an('5b) el guardado sigue validando la ventana 06:00-20:00',
    !!fnSave && fnSave.indexOf("hora < '06:00' || hora > '20:00'") >= 0);
  const fnUpdate = extraerMetodo(src, 'updateTraining');
  an('5c) la edicion sigue guardando la hora tal cual (puede ir vacia)',
    !!fnUpdate && fnUpdate.indexOf("document.getElementById('trainingHora').value") >= 0 &&
    fnUpdate.indexOf('hora: newHora') >= 0);
  const fnOpen = extraerMetodo(src, 'openModal');
  an('5d) el modal sigue llenando la fecha y la hora al editar',
    !!fnOpen && fnOpen.indexOf("document.getElementById('trainingDate').value") >= 0 &&
    fnOpen.indexOf("document.getElementById('trainingHora').value") >= 0);

  // ── 6 · la hora es OPCIONAL ────────────────────────────────────────
  const fnLabel = extraerMetodo(src, '_actualizarLabelCap');
  an('6a) la etiqueta de la hora vacia dice "Sin hora" (no "Seleccione...")',
    !!fnLabel && fnLabel.indexOf("texto = 'Sin hora'") >= 0);
  an('6b) la etiqueta de la fecha sigue en dia/mes/anio',
    !!fnLabel && fnLabel.indexOf("p[2] + '/' + p[1] + '/' + p[0]") >= 0);
  an('6c) la etiqueta de la hora es la misma que se guarda (24 h)',
    !!fnLabel && fnLabel.indexOf('texto = native.value') >= 0);
  const fnSync = extraerMetodo(src, '_syncCapPickers');
  an('6d) la resincronizacion recorre los desplegables del modal',
    !!fnSync && fnSync.indexOf("querySelectorAll('.cap-dd')") >= 0);
  an('6e) el boton de limpiar hora resincroniza la etiqueta',
    /horaInput\.value = '';[\s\S]{0,400}_syncCapPickers/.test(src));
  an('6f) al abrir el modal se sincronizan las etiquetas',
    /_syncCapPickers/.test(fnOpen || ''));

  // ── 7 · la ventana horaria la manda el <input> nativo ──────────────
  const fnHoras = extraerMetodo(src, '_pintarHorasCap');
  an('7a) la rejilla lee el min del nativo (la ventana vive en el input)',
    !!fnHoras && fnHoras.indexOf('native.min') >= 0);
  an('7b) la rejilla lee el max del nativo',
    !!fnHoras && fnHoras.indexOf('native.max') >= 0);
  an('7c) lo que queda por fuera de la ventana queda deshabilitado',
    !!fnHoras && fnHoras.indexOf('fuera') >= 0 && fnHoras.indexOf("' disabled'") >= 0);
  an('7d) el valor que ya tiene el campo siempre queda alcanzable',
    !!fnHoras && fnHoras.indexOf('const esElActual = s === native.value;') >= 0 &&
    fnHoras.indexOf('!esElActual &&') >= 0);
  an('7e) un valor fuera de la grilla se agrega igual (queda visible)',
    !!fnHoras && fnHoras.indexOf('slots.indexOf(native.value) === -1') >= 0);

  // ── 8 · sin hora, el menu se abre en la primera casilla valida ─────
  const fnCentrar = extraerMetodo(src, '_centrarHorasCap');
  const fnAbrir = extraerMetodo(src, '_abrirCap');
  an('8a) el centrado usa la celda activa',
    !!fnCentrar && fnCentrar.indexOf("cap-dd__option--active") >= 0);
  an('8b) sin celda activa cae en la PRIMERA habilitada',
    !!fnCentrar && fnCentrar.indexOf('cap-dd__option:not(:disabled)') >= 0);
  an('8c) el centrado se hace DESPUES de mostrar el menu (si no, no hay medidas)',
    !!fnAbrir && fnAbrir.indexOf('menu.hidden = false') >= 0 &&
    fnAbrir.indexOf('menu.hidden = false') < fnAbrir.indexOf('_centrarHorasCap(dd)'));
  an('8d) el menu se ancla a la derecha si se pasa del borde',
    !!fnAbrir && fnAbrir.indexOf('style.right') >= 0);
  an('8e) el scroller del menu es el cuerpo del modal',
    !!fnAbrir && fnAbrir.indexOf("closest('.k-modal-body')") >= 0);

  // ── 9 · el comportamiento de los menus ────────────────────────────
  const fnInit = extraerMetodo(src, '_initCapPickers');
  an('9a) Escape cierra los menus',
    !!fnInit && fnInit.indexOf("'keydown'") >= 0 && fnInit.indexOf("ev.key === 'Escape'") >= 0);
  an('9b) el clic fuera de un desplegable cierra los demas',
    !!fnInit && fnInit.indexOf("closest('.cap-dd')") >= 0);
  an('9c) al abrir uno se cierran los demas (un solo menu a la vez)',
    !!fnInit && fnInit.indexOf('_cerrarTodosCap()') >= 0);
  an('9d) el rotulo del campo tambien abre el desplegable',
    !!fnInit && fnInit.indexOf('label[for="') >= 0);
  an('9e) elegir una hora dispara change en el nativo',
    !!fnInit && fnInit.indexOf("dispatchEvent(new Event('change'") >= 0);
  an('9f) los desplegables se buscan en todo el documento (el modal vive en el body)',
    !!fnInit && fnInit.indexOf("getElementById('trainingModal')") < 0 &&
    fnInit.indexOf('.cap-dd') >= 0);
  an('9g) destroy() suelta los listeners de documento',
    /removeEventListener\('click', this\._capDocClick\)/.test(src) &&
    /removeEventListener\('keydown', this\._capDocKey\)/.test(src));

  // ── 10 · estilos ───────────────────────────────────────────────────
  an('10a) el toggle tiene estilos',
    /\.cap-dd__toggle\s*\{/.test(css));
  an('10b) el menu tambien esta estilado',
    /\.cap-dd__menu\s*\{/.test(css));
  an('10c) hay bloque oscuro para los desplegables',
    /\[data-theme\^="dark"\] \.cap-/.test(css));
  an('10d) el chevron gira 180 grados al abrir',
    /\.cap-dd--open \.cap-dd__chevron\s*\{\s*transform:\s*rotate\(180deg\)/.test(css));
  an('10e) el menu respeta el atributo hidden (display:none)',
    css.indexOf('.cap-dd__menu[hidden]') >= 0);
  an('10f) el calendario propio tiene estilos (grilla y dias)',
    /\.cap-cal__grid\s*\{/.test(css) && /\.cap-cal__day\s*\{/.test(css));
  an('10g) la rejilla de horarios tiene estilos',
    /\.cap-horas\s*\{/.test(css));
  an('10h) el dia elegido tiene su propio color en oscuro (blanco no se lee)',
    /\[data-theme\^="dark"\][^{]*\.cap-cal__day--sel\s*\{\s*color:\s*#0b1f33/.test(css));
  an('10i) el nativo queda oculto (display:none), sea input o select',
    /\.cap-dd__native[^{]*\{[^}]*display:\s*none/.test(css));
  an('10j) el modulo no pierde sus invariantes de tema (test 894)',
    (css.match(/\.capacitaciones-container\[data-theme="dark"\]/g) || []).length === 0 &&
    (css.match(/\.capacitaciones-container\[data-theme\^="dark"\]/g) || []).length === 47);
  // El token del borde tiene que existir: --border-color NO esta en el
  // sistema de diseno (kair-design-tokens.css). Con un token inexistente
  // la regla "border" queda invalida y el borde NO se dibuja.
  an('10k) el borde del desplegable usa un token que existe (--kair-line)',
    /\.cap-dd__toggle\s*\{[^}]*border:\s*1px solid var\(--kair-line/.test(css));
  an('10l) el bloque de los desplegables no usa --border-color (ese token no existe)',
    (css.match(/var\(--border-color/g) || []).length === 0,
    'quedan ' + (css.match(/var\(--border-color/g) || []).length);

  // ── 11 · cache-bust (regla del repo) ─────────────────────────────
  an('11a) index.html carga capacitaciones-logic.js con ?v=',
    /capacitaciones-logic\.js\?v=[A-Za-z0-9-]+/.test(htmlIndex));
  an('11b) el ?v= es el de esta ronda',
    htmlIndex.indexOf('capacitaciones-logic.js?v=CAP-20261126-v4-filtros') >= 0);
  an('11c) el ?v= anterior ya no esta',
    htmlIndex.indexOf('capacitaciones-logic.js?v=CAP-20261126-v3-pickers-tipo') < 0 &&
    htmlIndex.indexOf('capacitaciones-logic.js?v=CAP-20261126-v2-pickers') < 0 &&
    htmlIndex.indexOf('capacitaciones-logic.js?v=CAP-20260915-v11-periodo-stretch') < 0);
  an('11d) el HTML de la vista tambien lleva sello nuevo (se pide por fetch)',
    /capacitaciones-view\.html\?v=CAP-20261126-v4-filtros/.test(src));
  an('11e) el sello viejo del fetch ya no esta',
    !/capacitaciones-view\.html\?v=CAP-20261126-v3-pickers-tipo/.test(src) &&
    !/capacitaciones-view\.html\?v=CAP-20261126-v2-pickers/.test(src) &&
    !/capacitaciones-view\.html\?v=CAP-20260915-v11-periodo-stretch/.test(src));

  // ── 12 · el desplegable del TIPO ─────────────────────────────────────
  const fnInitCap = extraerMetodo(src, '_initCapPickers');
  const fnOpciones = extraerMetodo(src, '_pintarOpcionesCap');
  an('12a) el campo Tipo tiene su desplegable',
    html.indexOf('data-cap-dd="trainingType"') >= 0);
  an('12b) el select conserva su ID y sus dos opciones',
    html.indexOf('id="trainingType"') >= 0 &&
    html.indexOf('<option value="sst">Seguridad (SST)</option>') >= 0 &&
    html.indexOf('<option value="pyp">Medicina Preventiva (PYP)</option>') >= 0);
  an('12c) el select queda oculto como fuente de verdad',
    /id="trainingType"[^>]*cap-dd__native/.test(html));
  an('12d) existe el metodo _pintarOpcionesCap', !!fnOpciones);
  an('12e) la inicializacion detecta el <select>',
    !!fnInitCap && fnInitCap.indexOf("native.tagName === 'SELECT'") >= 0);
  an('12f) el menu de la lista tiene su listener delegado',
    !!fnInitCap && fnInitCap.indexOf('data-cap-accion="opcion"') >= 0);
  an('12g) la lista se lee del select nativo (no se escribe a mano)',
    !!fnOpciones && fnOpciones.indexOf('Array.from(native.options)') >= 0);
  an('12h) al abrir el desplegable se pinta la lista',
    !!extraerMetodo(src, '_abrirCap') &&
    extraerMetodo(src, '_abrirCap').indexOf('_pintarOpcionesCap(dd)') >= 0);
  an('12i) el boton muestra el TEXTO de la opcion, no el valor interno',
    !!extraerMetodo(src, '_actualizarLabelCap') &&
    extraerMetodo(src, '_actualizarLabelCap').indexOf('native.options[native.selectedIndex]') >= 0 &&
    extraerMetodo(src, '_actualizarLabelCap').indexOf('op ? op.text') >= 0);
  an('12j) el guardado sigue leyendo el select por su ID',
    !!fnSave && fnSave.indexOf("document.getElementById('trainingType').value") >= 0);
  an('12k) la edicion sigue guardando el tipo por su ID',
    !!fnUpdate && fnUpdate.indexOf("document.getElementById('trainingType').value") >= 0);
  an('12l) al editar el modal sigue llenando el tipo',
    !!fnOpen && fnOpen.indexOf("document.getElementById('trainingType').value") >= 0);
  an('12m) el menu del tipo es una lista alineada a la izquierda',
    /\.cap-dd--tipo \.cap-dd__option\s*\{[^}]*justify-content:\s*flex-start/.test(css));

  // ── 13 · los CUATRO FILTROS de la lista ─────────────────────────────
  const FILTROS = ['yearFilter', 'typeFilter', 'statusFilter', 'monthFilter'];
  FILTROS.forEach(function (id) {
    an('13a) el filtro ' + id + ' tiene su desplegable',
      html.indexOf('data-cap-dd="' + id + '"') >= 0);
    an('13b) el filtro ' + id + ' conserva su ID',
      html.indexOf('id="' + id + '"') >= 0);
    an('13c) el select del filtro ' + id + ' queda oculto',
      new RegExp('id="' + id + '"[^>]*cap-dd__native').test(html));
  });
  an('13d) los cuatro filtros usan la variante de pill (cap-dd--filtro)',
    (html.match(/cap-dd--filtro/g) || []).length === 4,
    'aparecen ' + (html.match(/cap-dd--filtro/g) || []).length);
  an('13e) los cuatro filtros tienen su boton con etiqueta y chevron',
    (html.match(/cap-dd__toggle/g) || []).length >= 7);
  an('13f) el chevron del select nativo ya no esta (no quedarian dos)',
    html.indexOf('<i class="bi bi-chevron-down"></i>') < 0);
  an('13g) el toolbar ya no usa <label> para los filtros (el select va dentro)',
    html.indexOf('<label class="k-filter-pill">') < 0);
  an('13h) la inicializacion agarra los desplegables de todo el documento',
    !!fnInit && fnInit.indexOf("const cont = document;") >= 0);
  an('13i) cerrar todos los menus alcanza a los filtros',
    !!extraerMetodo(src, '_cerrarTodosCap') &&
    extraerMetodo(src, '_cerrarTodosCap').indexOf("document.querySelectorAll('.cap-dd')") >= 0);
  an('13j) la resincronizacion alcanza a los filtros',
    !!extraerMetodo(src, '_syncCapPickers') &&
    extraerMetodo(src, '_syncCapPickers').indexOf("document.querySelectorAll('.cap-dd')") >= 0);
  an('13k) el filtro de años resincroniza su etiqueta cuando se puebla',
    /yearFilter\.value\s+= this\.currentYear;[\s\S]{0,200}_syncCapPickers/.test(src));
  an('13l) el filtro de años resincroniza cuando se crea un programa nuevo',
    /yearFilter\.value = nextYear;[\s\S]{0,300}_syncCapPickers/.test(src));
  an('13m) el filtro conserva la forma redondeada (pill) del toolbar',
    /\.cap-dd--filtro \.cap-dd__toggle\s*\{[^}]*border-radius:\s*999px/.test(css));
  an('13n) el menu del filtro scrollea (los meses son 13)',
    /\.cap-dd--filtro \.cap-dd__menu\s*\{[^}]*overflow-y:\s*auto/.test(css));
  an('13o) las opciones del filtro van alineadas a la izquierda',
    /\.cap-dd--filtro \.cap-dd__option\s*\{[^}]*justify-content:\s*flex-start/.test(css));
  an('13p) los filtros de tipo, estado y mes siguen siendo los que filtran',
    !!extraerMetodo(src, 'applyFilters') &&
    ['typeFilter', 'statusFilter', 'monthFilter'].every(function (id) {
      return (extraerMetodo(src, 'applyFilters') || '').indexOf("getElementById('" + id + "')") >= 0;
    }));
  an('13q) el filtro de años sigue cargando el año que se elige',
    src.indexOf("addEventListener('change', (e) => this.loadDataForYear(parseInt(e.target.value)))") >= 0);

  return c;
}

// ══════════════════════════════════════════════════════════════════
// Mutaciones: cada una tiene que hacer caer al menos un check
// ══════════════════════════════════════════════════════════════════
const MUTACIONES = [
  ['la fecha pierde su desplegable',
    src, html.replace('data-cap-dd="trainingDate"', 'data-cap-dd="trainingDate-x"'), css, htmlIndex],
  ['la rejilla de horarios pasa a pasos de 30 minutos',
    src.replace('m += 15', 'm += 30'), html, css, htmlIndex],
  ['la grilla del mes pierde celdas',
    src.replace('celdas.length < 42', 'celdas.length < 40'), html, css, htmlIndex],
  ['el autollenado no resincroniza la etiqueta',
    src.replace('if (typeof this._syncCapPickers === \'function\') this._syncCapPickers();', ''), html, css, htmlIndex],
  ['el guardado deja de leer el id de la hora',
    src.replace("document.getElementById('trainingHora').value", "document.getElementById('trainingHora2').value"), html, css, htmlIndex],
  ['la hora deja de respetar la ventana del input',
    src.replace('const minHora = native.min || \'\';', 'const minHora = \'\';'), html, css, htmlIndex],
  ['la hora vacia vuelve a decir "Seleccione..."',
    src.replace("texto = 'Sin hora';", "texto = '';"), html, css, htmlIndex],
  ['sin hora el menu se abre arriba del todo (casillas invalidas)',
    src.replace("grid.querySelector('.cap-dd__option:not(:disabled)')", "null"), html, css, htmlIndex],
  ['el calendario pierde su rejilla',
    src, html, css.replace('.cap-cal__grid', '.cap-cal__grid-x'), htmlIndex],
  ['el cache-bust no sube',
    src, html, css,
    htmlIndex.replace('capacitaciones-logic.js?v=CAP-20261126-v4-filtros', 'capacitaciones-logic.js?v=CAP-20261126-v3-pickers-tipo')],
  ['el HTML de la vista se pide con el sello viejo',
    src.replace('capacitaciones-view.html?v=CAP-20261126-v4-filtros', 'capacitaciones-view.html?v=CAP-20261126-v3-pickers-tipo'),
    html, css, htmlIndex],
  ['la rejilla se centra antes de mostrar el menu (no hay medidas)',
    src.replace('menu.hidden = false;', 'menu.hidden = true;'), html, css, htmlIndex],
  ['el boton de limpiar hora deja de resincronizar la etiqueta',
    src.replace('if (typeof this._syncCapPickers === \'function\') this._syncCapPickers();\n                }', '}'),
    html, css, htmlIndex],
  ['el borde del desplegable usa un token que no existe',
    src, html, css.replace('var(--kair-line, #e8ebee)', 'var(--border-color)'), htmlIndex],
  ['el tipo pierde su desplegable',
    src, html.replace('data-cap-dd="trainingType"', 'data-cap-dd="trainingType-x"'), css, htmlIndex],
  ['el select de tipo deja de quedar oculto',
    src, html.replace('id="trainingType" class="k-form-control cap-dd__native"',
      'id="trainingType" class="k-form-control"'), css, htmlIndex],
  ['la inicializacion ignora el select',
    src.replace("const esLista = native.tagName === 'SELECT';", "const esLista = false;"),
    html, css, htmlIndex],
  ['el guardado deja de leer el id del tipo',
    src.replace("const type         = document.getElementById('trainingType').value;",
      "const type         = document.getElementById('trainingType2').value;"),
    html, css, htmlIndex],
  ['el boton del tipo muestra el valor crudo en vez del texto',
    src.replace("texto = op ? op.text : (native.value || '');", "texto = native.value || '';"),
    html, css, htmlIndex],
  ['el desplegable de tipo escribe su propia lista',
    src.replace('Array.from(native.options)', 'Array.from([])'), html, css, htmlIndex],
  ['el menu del tipo pierde la alineacion a la izquierda',
    src, html, css.replace('.cap-dd--tipo .cap-dd__option', '.cap-dd--tipo .cap-dd__option-x'), htmlIndex],
  ['un filtro pierde su desplegable',
    src, html.replace('data-cap-dd="monthFilter"', 'data-cap-dd="monthFilter-x"'), css, htmlIndex],
  ['el select de un filtro deja de quedar oculto',
    src, html.replace('id="statusFilter" class="k-form-select cap-dd__native"',
      'id="statusFilter" class="k-form-select"'), css, htmlIndex],
  ['los desplegables solo se buscan en el modal (los filtros quedan muertos)',
    src.replace('const cont = document;', "const cont = document.getElementById('trainingModal');"),
    html, css, htmlIndex],
  ['el filtro de años no resincroniza su etiqueta',
    src.replace('yearFilter.value  = this.currentYear;\n        // 📦1107 — El filtro de años cambio de valor por fuera del\n' +
      '        // desplegable: el boton tiene que seguirlo.\n' +
      '        if (typeof this._syncCapPickers === \'function\') this._syncCapPickers();',
      'yearFilter.value  = this.currentYear;'),
    html, css, htmlIndex],
  ['el filtro pierde la forma redondeada del toolbar',
    src, html, css.replace('.cap-dd--filtro .cap-dd__toggle', '.cap-dd--filtro .cap-dd__toggle-x'), htmlIndex]
];

(async function () {
  const base = correrCon(src, html, css, htmlIndex);
  base.forEach(function (x) { ok(x.name, x.ok, x.extra); });

  for (const m of MUTACIONES) {
    const nombre = m[0];
    const mutLogic = m[1], mutHtml = m[2], mutCss = m[3], mutIndex = m[4];
    if (mutLogic === src && mutHtml === html && mutCss === css && mutIndex === htmlIndex) {
      ok('MUTANTE detectado: ' + nombre, false, 'la mutacion no cambio el codigo (patron desfasado)');
      continue;
    }
    let fallo = false;
    try {
      const res = correrCon(mutLogic, mutHtml, mutCss, mutIndex);
      fallo = res.some(function (x) { return !x.ok; });
    } catch (e) {
      fallo = true; // el mutante lanzo: tambien es detectado
    }
    ok('MUTANTE detectado: ' + nombre, fallo);
  }

  correr();
})();

// ══════════════════════════════════════════════════════════════════
// Salida
// ══════════════════════════════════════════════════════════════════
function correr() {
  let failed = 0;
  console.log('\n=======================================');
  console.log('  📦 · Fecha y hora del modal Editar Capacitacion');
  console.log('=======================================');
  checks.forEach(function (c) {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  console.log('=======================================');
  process.exit(failed === 0 ? 0 : 1);
}
