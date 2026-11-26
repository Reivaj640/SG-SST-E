/* main/test-inducciones-pickers.js
 * Induccion y Reinduccion: los CUATRO filtros del toolbar (ano y genero del
 * dashboard, ano y estado del registro) y los DOS campos del modal Editar
 * induccion (genero y fecha) con desplegables propios.
 *
 * EL PORQUE
 * ----------
 * Los <select> del toolbar se veian como los del sistema operativo y el
 * <input type="date"> del modal abria el calendario nativo. El Programa de
 * Capacitacion ya tiene su propio sistema (📦1106 y 📦1107), el Generador de
 * Actas del COPASST tambien (📦1104) y el Comite de Convivencia (📦1105): el
 * campo nativo queda OCULTO como fuente de verdad y un boton con menu o
 * calendario propio muestra el valor.
 *
 * Este modulo tiene CUATRO reglas propias que el patron no tiene, y el test
 * las protege:
 *   1 · los CINCO campos de lista (los cuatro filtros y el genero del modal)
 *     leen sus opciones del propio <select> nativo: el desplegable no
 *     escribe su propia lista, asi que no puede quedar desactualizado;
 *   2 · el filtro de ANIOS se puebla POR CODIGO (populateAnios): cuando sus
 *     opciones cambian hay que resincronizar el boton, o el boton sigue
 *     diciendo "Anio" mientras el filtro filtra por 2026;
 *   3 · el valor que ya tiene el campo siempre queda alcanzable, aunque no
 *     este en la lista;
 *   4 · con el campo nativo oculto, el borde de ERROR ya no se ve: el
 *     wrapper .kair-field.is-error tiene que marcar el BOTON.
 *
 * Patron del repo: los metodos se EXTRAEN del archivo real con new Function
 * (mismo enfoque que test-capacitaciones-pickers.js) y se ejecutan.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RUTA_LOGIC = path.join(ROOT, 'modules', 'recursos', 'inducciones', 'inducciones-logic.js');
const RUTA_HTML = path.join(ROOT, 'modules', 'recursos', 'inducciones', 'inducciones-view.html');
const RUTA_CSS = path.join(ROOT, 'modules', 'recursos', 'inducciones', 'inducciones-view.css');
const RUTA_INDEX = path.join(ROOT, 'index.html');

const src = fs.readFileSync(RUTA_LOGIC, 'utf8');
const html = fs.readFileSync(RUTA_HTML, 'utf8');
const css = fs.readFileSync(RUTA_CSS, 'utf8');
const htmlIndex = fs.readFileSync(RUTA_INDEX, 'utf8');

// Los cuatro filtros del toolbar y los dos campos del modal.
const FILTROS = ['d-anio', 'd-genero', 'f-anio', 'f-estado'];
const MODAL = ['ind-genero', 'ind-fecha'];
const CAMPOS = FILTROS.concat(MODAL);
const LISTAS = ['d-genero', 'f-estado', 'ind-genero'];

const checks = [];
function ok(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra == null ? '' : String(extra) });
}

// ══════════════════════════════════════════════════════════════════
// Helpers: extraer un metodo del archivo real
// ══════════════════════════════════════════════════════════════════
function extraerMetodo(fuente, nombre) {
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

  // ── 1 · el marcado: los seis campos con su desplegable ─────────────
  CAMPOS.forEach(function (id) {
    an('1a) el campo ' + id + ' tiene su desplegable ind-dd',
      html.indexOf('data-ind-dd="' + id + '"') >= 0);
    an('1b) el campo ' + id + ' conserva su ID original',
      html.indexOf('id="' + id + '"') >= 0);
  });
  an('1c) los seis nativos se ocultan como fuente de verdad (ind-dd__native)',
    (html.match(/ind-dd__native/g) || []).length >= 6,
    'aparece ' + (html.match(/ind-dd__native/g) || []).length + ' veces');
  an('1d) el marcado trae boton toggle y menu para cada campo',
    (html.match(/ind-dd__toggle/g) || []).length >= 6 &&
    (html.match(/ind-dd__menu/g) || []).length >= 6);
  an('1e) la fecha usa el menu de calendario (ind-cal)',
    (html.match(/class="ind-dd__menu ind-cal"/g) || []).length === 1,
    'aparece ' + (html.match(/class="ind-dd__menu ind-cal"/g) || []).length + ' veces');
  an('1f) los cuatro filtros usan la variante de filtro (ind-dd--filtro)',
    (html.match(/ind-dd--filtro/g) || []).length === 4,
    'aparecen ' + (html.match(/ind-dd--filtro/g) || []).length);
  an('1g) el genero del modal usa la variante de lista (ind-dd--lista)',
    (html.match(/ind-dd--lista/g) || []).length === 1,
    'aparecen ' + (html.match(/ind-dd--lista/g) || []).length);
  an('1h) los rotulos del modal apuntan al campo (for=), que ademas abre el desplegable',
    MODAL.every(function (id) { return html.indexOf('for="' + id + '"') >= 0; }));
  an('1i) el filtro de genero conserva sus tres opciones',
    html.indexOf('<option value="H">Hombres</option>') >= 0 &&
    html.indexOf('<option value="M">Mujeres</option>') >= 0);
  an('1j) el filtro de estado conserva sus tres opciones',
    html.indexOf('<option value="APROBADO">Aprobados</option>') >= 0 &&
    html.indexOf('<option value="REPROBADO">Reprobados</option>') >= 0);
  an('1k) el genero del modal conserva sus tres opciones',
    html.indexOf('<option value="">Selecciona…</option>') >= 0 &&
    html.indexOf('<option value="M">Mujer</option>') >= 0 &&
    html.indexOf('<option value="H">Hombre</option>') >= 0);
  an('1l) la fecha sigue siendo un <input type="date"> en el nativo',
    /id="ind-fecha"[^>]*class="ind-dd__native"/.test(html));
  an('1m) no queda ninguna clase de otro modulo sin convertir (cap-/cop-/ccv-)',
    ((html + css + src).match(/\b(cap|cop|ccv)-(dd|cal|horas)\b/g) || []).length === 0,
    'quedan ' + ((html + css + src).match(/\b(cap|cop|ccv)-(dd|cal|horas)\b/g) || []).length);
  an('1n) los filtros del toolbar no usan <select> visible',
    /<select class="kair-select" id="d-anio"/.test(html) === false);
  an('1o) el boton de cada filtro trae el texto que se ve',
    (html.match(/ind-dd__value/g) || []).length >= 6,
    'aparecen ' + (html.match(/ind-dd__value/g) || []).length);

  // ── 2 · los metodos existen ───────────────────────────────────────
  ['_initIndPickers', '_buildMonthGridInd', '_pintarCalendarioInd',
   '_pintarOpcionesInd', '_actualizarLabelInd', '_syncIndPickers',
   '_abrirInd', '_cerrarInd', '_cerrarTodosInd'
  ].forEach(function (m) {
    an('2) existe el metodo ' + m, !!extraerMetodo(src, m));
  });
  an('2b) el modulo inicializa los desplegables',
    src.indexOf('this._initIndPickers()') >= 0);

  // ── 3 · la grilla del mes se EJECUTA de verdad ─────────────────────
  const fnGridRaw = extraerMetodo(src, '_buildMonthGridInd');
  an('3-pre) _buildMonthGridInd se puede extraer', !!fnGridRaw);
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

  // ── 4 · los contratos que no pueden romperse ──────────────────────
  const fnSubmit = extraerMetodo(src, '_onSubmit');
  an('4a) el guardado sigue leyendo el genero por su ID',
    !!fnSubmit && fnSubmit.indexOf("this.q('#ind-genero')") >= 0);
  an('4b) el guardado sigue leyendo la fecha por su ID',
    !!fnSubmit && fnSubmit.indexOf("val('#ind-fecha')") >= 0);
  an('4c) el guardado sigue validando el genero y la fecha',
    !!fnSubmit && fnSubmit.indexOf("this.setErr('fw-genero', !genero)") >= 0 &&
    fnSubmit.indexOf("this.setErr('fw-fecha', !fecha)") >= 0);
  an('4d) el guardado sigue mandando genero y fecha en el payload',
    !!fnSubmit && fnSubmit.indexOf('genero: genero') >= 0 &&
    fnSubmit.indexOf('fecha: fecha') >= 0);
  const fnOpen = extraerMetodo(src, 'openIndModal');
  an('4e) al abrir el modal se sigue llenando el genero y la fecha',
    !!fnOpen && fnOpen.indexOf("set('#ind-genero'") >= 0 &&
    fnOpen.indexOf("set('#ind-fecha'") >= 0);
  const fnSetAnio = extraerMetodo(src, 'setAnio');
  an('4f) setAnio sigue escribiendo los dos filtros de ano',
    !!fnSetAnio && fnSetAnio.indexOf("this.q('#d-anio')") >= 0 &&
    fnSetAnio.indexOf("this.q('#f-anio')") >= 0);
  const fnPop = extraerMetodo(src, 'populateAnios');
  an('4g) el filtro de anos se sigue pueblando por codigo',
    !!fnPop && fnPop.indexOf("this.q('#d-anio')") >= 0 &&
    fnPop.indexOf("this.q('#f-anio')") >= 0);
  an('4h) el filtro de anos sigue offering la opcion "Todos"',
    !!fnPop && fnPop.indexOf('<option value="all">Todos</option>') >= 0);
  const fnClear = extraerMetodo(src, 'clearRegistroFilters');
  an('4i) limpiar el registro sigue vaciando el filtro de estado',
    !!fnClear && fnClear.indexOf("this.q('#f-estado')") >= 0);
  const fnFiltros = extraerMetodo(src, '_bindEvents');
  an('4j) los cuatro filtros siguen escuchando el change',
    !!fnFiltros && ['d-anio', 'f-anio', 'd-genero', 'f-estado'].every(function (id) {
      return fnFiltros.indexOf("on('#" + id + "', 'change'") >= 0;
    }));

  // ── 5 · la lista se lee del campo nativo ──────────────────────────
  const fnOpciones = extraerMetodo(src, '_pintarOpcionesInd');
  an('5a) la lista se lee del select nativo (no se escribe a mano)',
    !!fnOpciones && fnOpciones.indexOf('Array.from(native.options)') >= 0);
  an('5b) el valor que ya tiene el campo siempre queda alcanzable',
    !!fnOpciones && fnOpciones.indexOf('if (native.value && !hayActual)') >= 0);
  an('5c) la inicializacion detecta el <select>',
    !!extraerMetodo(src, '_initIndPickers') &&
    extraerMetodo(src, '_initIndPickers').indexOf("native.tagName === 'SELECT'") >= 0);
  an('5d) el menu de la lista tiene su listener delegado',
    !!extraerMetodo(src, '_initIndPickers') &&
    extraerMetodo(src, '_initIndPickers').indexOf('data-ind-accion="opcion"') >= 0);
  an('5e) el boton muestra el TEXTO de la opcion, no el valor interno',
    !!extraerMetodo(src, '_actualizarLabelInd') &&
    extraerMetodo(src, '_actualizarLabelInd').indexOf('native.options[native.selectedIndex]') >= 0 &&
    extraerMetodo(src, '_actualizarLabelInd').indexOf('op ? op.text') >= 0);

  // ── 6 · el filtro de anos se resincroniza ─────────────────────────
  an('6a) el filtro de anos resincroniza su etiqueta cuando se puebla',
    !!fnPop && fnPop.indexOf('_syncIndPickers()') >= 0);
  an('6b) setAnio resincroniza la etiqueta (el boton tiene que decir el ano)',
    !!fnSetAnio && fnSetAnio.indexOf('_syncIndPickers()') >= 0);
  an('6c) limpiar el registro resincroniza la etiqueta del estado',
    !!fnClear && fnClear.indexOf('_syncIndPickers()') >= 0);
  an('6d) el boton "Ver reprobados" resincroniza la etiqueta del estado',
    /fe\.value = 'REPROBADO';[\s\S]{0,200}_syncIndPickers/.test(src));
  an('6e) al abrir el modal se sincronizan las etiquetas',
    !!fnOpen && fnOpen.indexOf('_syncIndPickers()') >= 0);
  an('6f) un select que todavia no tiene opciones conserva el texto inicial',
    !!extraerMetodo(src, '_actualizarLabelInd') &&
    extraerMetodo(src, '_actualizarLabelInd').indexOf('hayOpciones') >= 0);

  // ── 7 · el comportamiento de los menus ────────────────────────────
  const fnInit = extraerMetodo(src, '_initIndPickers');
  an('7a) Escape cierra los menus',
    !!fnInit && fnInit.indexOf("'keydown'") >= 0 && fnInit.indexOf("ev.key === 'Escape'") >= 0);
  an('7b) el clic fuera de un desplegable cierra los demas',
    !!fnInit && fnInit.indexOf("closest('.ind-dd')") >= 0);
  an('7c) al abrir uno se cierran los demas (un solo menu a la vez)',
    !!fnInit && fnInit.indexOf('_cerrarTodosInd()') >= 0);
  an('7d) el rotulo del campo tambien abre el desplegable',
    !!fnInit && fnInit.indexOf('label[for="') >= 0);
  an('7e) elegir una opcion dispara change en el nativo',
    !!fnInit && fnInit.indexOf("dispatchEvent(new Event('change'") >= 0);
  an('7e-bis) el change del bloque de LISTA dispara el evento (no solo el de la fecha)',
    !!fnInit && /data-ind-accion="opcion"[\s\S]{0,600}dispatchEvent\(new Event\('change'/.test(fnInit));
  an('7f) los desplegables se buscan en todo el documento',
    !!fnInit && fnInit.indexOf("var cont = document;") >= 0);
  an('7g) cerrar todos los menus alcanza a los filtros y al modal',
    !!extraerMetodo(src, '_cerrarTodosInd') &&
    extraerMetodo(src, '_cerrarTodosInd').indexOf("document.querySelectorAll('.ind-dd')") >= 0);
  an('7h) la resincronizacion alcanza a los filtros y al modal',
    !!extraerMetodo(src, '_syncIndPickers') &&
    extraerMetodo(src, '_syncIndPickers').indexOf("document.querySelectorAll('.ind-dd')") >= 0);
  const fnDestroy = extraerMetodo(src, 'destroy');
  an('7i) destroy() suelta los listeners de documento',
    !!fnDestroy && fnDestroy.indexOf("removeEventListener('click', this._indDocClick)") >= 0 &&
    fnDestroy.indexOf("removeEventListener('keydown', this._indDocKey)") >= 0);
  an('7j) el calendario tiene su listener delegado (sobrevive a los repintados)',
    !!fnInit && fnInit.indexOf("data-ind-accion") >= 0);
  an('7k) elegir un dia dispara change en el nativo',
    !!fnInit && fnInit.indexOf("native.value = iso;") >= 0);
  an('7l) el menu se ancla a la derecha si se pasa del borde',
    !!extraerMetodo(src, '_abrirInd') &&
    extraerMetodo(src, '_abrirInd').indexOf('style.right') >= 0);
  an('7m) el scroller del menu es el cuerpo del modal',
    !!extraerMetodo(src, '_abrirInd') &&
    extraerMetodo(src, '_abrirInd').indexOf("closest('.kair-modal__body')") >= 0);
  an('7n) al abrir el desplegable de fecha se pinta el calendario',
    !!extraerMetodo(src, '_abrirInd') &&
    extraerMetodo(src, '_abrirInd').indexOf('_pintarCalendarioInd(dd)') >= 0);
  an('7o) al abrir el desplegable de lista se pintan las opciones',
    !!extraerMetodo(src, '_abrirInd') &&
    extraerMetodo(src, '_abrirInd').indexOf('_pintarOpcionesInd(dd)') >= 0);

  // ── 8 · el calendario propio ──────────────────────────────────────
  const fnCal = extraerMetodo(src, '_pintarCalendarioInd');
  an('8a) el calendario se arma con la grilla de 42 celdas',
    !!fnCal && fnCal.indexOf('this._buildMonthGridInd(y, m)') >= 0);
  an('8b) el calendario pinta la rejilla de dias',
    !!fnCal && fnCal.indexOf('ind-cal__grid') >= 0);
  an('8c) el calendario marca el dia de hoy y el elegido',
    !!fnCal && fnCal.indexOf('ind-cal__day--today') >= 0 &&
    fnCal.indexOf('ind-cal__day--sel') >= 0);
  an('8d) el calendario tiene los botones Limpiar y Hoy',
    !!fnCal && fnCal.indexOf('data-ind-accion="limpiar"') >= 0 &&
    fnCal.indexOf('data-ind-accion="hoy"') >= 0);
  an('8e) el calendario navega de mes',
    !!fnCal && fnCal.indexOf('data-ind-accion="mes"') >= 0);
  an('8f) la etiqueta de la fecha esta en dia/mes/anio',
    !!extraerMetodo(src, '_actualizarLabelInd') &&
    extraerMetodo(src, '_actualizarLabelInd').indexOf("p[2] + '/' + p[1] + '/' + p[0]") >= 0);

  // ── 9 · estilos ───────────────────────────────────────────────────
  an('9a) el toggle tiene estilos',
    /\.ind-dd__toggle\s*\{/.test(css));
  an('9b) el menu tambien esta estilado',
    /\.ind-dd__menu\s*\{/.test(css));
  an('9c) el chevron gira 180 grados al abrir',
    /\.ind-dd--open \.ind-dd__chevron\s*\{\s*transform:\s*rotate\(180deg\)/.test(css));
  an('9d) el menu respeta el atributo hidden (display:none)',
    /\.ind-dd__menu\[hidden\]/.test(css) ||
    /\.inducciones-container \[hidden\]\{display:none!important\}/.test(css));
  an('9e) el calendario propio tiene estilos (grilla y dias)',
    /\.ind-cal__grid\s*\{/.test(css) && /\.ind-cal__day\s*\{/.test(css));
  an('9f) el nativo queda oculto (display:none), sea input o select',
    /\.ind-dd__native[^{]*\{[^}]*display:\s*none/.test(css));
  an('9g) los estilos del modulo quedan SCOPEADOS bajo .inducciones-container',
    (css.match(/^\.ind-/gm) || []).length === 0 &&
    /\.inducciones-container \.ind-dd__toggle/.test(css));
  an('9h) el borde de error se ve en el BOTON (el nativo esta oculto)',
    /\.kair-field\.is-error \.ind-dd__toggle\{[^}]*border-color:\s*var\(--kair-red/.test(css));
  an('9i) el filtro conserva la forma del toolbar (compacto, no ancho completo)',
    /\.ind-dd--filtro\s*\{\s*width:auto/.test(css) &&
    /\.ind-dd--filtro \.ind-dd__toggle\s*\{[^}]*width:auto/.test(css));
  an('9j) el menu del filtro scrollea (los anos son varios)',
    /\.ind-dd--filtro \.ind-dd__menu\s*\{[^}]*overflow-y:\s*auto/.test(css));
  an('9k) las opciones del filtro van alineadas a la izquierda',
    /\.ind-dd__option\s*\{[^}]*justify-content:\s*flex-start/.test(css));
  // El token del borde tiene que existir en el modulo: con un token
  // inexistente la regla "border" queda invalida y el borde NO se dibuja.
  an('9l) el borde del desplegable usa un token que existe (--kair-border)',
    /\.ind-dd__toggle\s*\{[^}]*border:\s*1px solid var\(--kair-border/.test(css));
  an('9m) el bloque de los desplegables no usa --border-color (ese token no existe)',
    (css.match(/var\(--border-color/g) || []).length === 0,
    'quedan ' + (css.match(/var\(--border-color/g) || []).length);
  an('9n) el menu usa la sombra que el modulo define (--kair-shadow-pop)',
    /\.ind-dd__menu\s*\{[^}]*box-shadow:\s*var\(--kair-shadow-pop/.test(css));
  an('9o) el radio del desplegable usa el token del modulo (--kair-radius-sm)',
    /\.ind-dd__toggle\s*\{[^}]*border-radius:\s*var\(--kair-radius-sm/.test(css));

  // ── 10 · cache-bust (regla del repo) ─────────────────────────────
  an('10a) index.html carga inducciones-logic.js con ?v=',
    /inducciones-logic\.js\?v=[A-Za-z0-9-]+/.test(htmlIndex));
  an('10b) el ?v= es el de esta ronda',
    htmlIndex.indexOf('inducciones-logic.js?v=INDUCCIONES-20261126-v23-pickers') >= 0);
  an('10c) el ?v= anterior ya no esta',
    htmlIndex.indexOf('inducciones-logic.js?v=INDUCCIONES-20261120-v22-modal-fix') < 0);
  an('10d) el HTML de la vista se pide con el sello (INDUC_TOKEN)',
    src.indexOf("inducciones-view.html?v=' + INDUC_TOKEN") >= 0);
  an('10e) el sello viejo ya no esta en el modulo',
    src.indexOf('INDUCCIONES-20261120-v22-modal-fix') < 0);
  an('10f) el CSS de la vista tambien lleva sello nuevo (lo pide el propio HTML)',
    /inducciones-view\.css\?v=INDUCCIONES-20261126-v23-pickers/.test(html));
  an('10g) el sello viejo del CSS ya no esta',
    /inducciones-view\.css\?v=INDUCCIONES-20261120-v22-modal-fix/.test(html) === false);
  an('10h) el token del modulo (INDUC_TOKEN) es el de esta ronda',
    /var INDUC_TOKEN = 'INDUCCIONES-20261126-v23-pickers';/.test(src));

  // ── 11 · el modulo no pierde lo que ya tenia ─────────────────────
  an('11a) el dashboard sigue con su filtro de ano y su filtro de genero',
    html.indexOf('id="d-anio"') >= 0 && html.indexOf('id="d-genero"') >= 0);
  an('11b) el registro sigue con su filtro de ano y su filtro de estado',
    html.indexOf('id="f-anio"') >= 0 && html.indexOf('id="f-estado"') >= 0);
  an('11c) la busqueda del registro sigue intacta',
    html.indexOf('id="f-buscar"') >= 0);
  an('11d) el modal sigue con sus seis campos',
    ['ind-nombre', 'ind-cedula', 'ind-cargo', 'ind-genero', 'ind-fecha', 'ind-puntaje']
      .every(function (id) { return html.indexOf('id="' + id + '"') >= 0; }));
  an('11e) la tabla del registro sigue con su cuerpo y su paginador',
    html.indexOf('id="tbody"') >= 0 && html.indexOf('id="pager"') >= 0);
  an('11f) la regla del [hidden] del modulo sigue en pie',
    /\.inducciones-container \[hidden\]\{display:none!important\}/.test(css));
  an('11g) los estilos del modulo siguen SCOPEADOS (0 reglas sin scope)',
    (css.split('\n').filter(function (l) { return /^\.(kair-|k-)/.test(l.trim()); }).length) === 0);
  an('11h) el modulo no tiene bloque de tema propio (sus tokens son los suyos)',
    (css.match(/\[data-theme=/g) || []).length === 0,
    'bloques de tema: ' + (css.match(/\[data-theme=/g) || []).length);

  // ── 12 · el menu NO puede quedar recortado por su scroller ────────
  // El cuerpo del modal (.kair-modal__body) tiene overflow-y:auto y el
  // calendario mide 306 px: un menu absolute se recorta y se pierden los
  // botones de abajo (Limpiar y Hoy). Cuando no cabe ni abajo ni arriba
  // en su scroller, el menu se suelta (position:fixed) y se mide contra la
  // VENTANA, que es donde esta el espacio de verdad.
  const fnAbrirInd = extraerMetodo(src, '_abrirInd');
  const fnReset = extraerMetodo(src, '_resetMenuPos');
  an('12a) existe el metodo _resetMenuPos', !!fnReset);
  an('12b) el menu se suelta del scroller cuando no cabe (position:fixed)',
    !!fnAbrirInd && fnAbrirInd.indexOf("menu.style.position = 'fixed'") >= 0);
  an('12c) el menu suelto se mide contra la VENTANA',
    !!fnAbrirInd && /var vh = window\.innerHeight;/.test(fnAbrirInd) &&
    /vh - tRect\.bottom - 8 >= mAlto/.test(fnAbrirInd) &&
    /tRect\.top - 8 >= mAlto/.test(fnAbrirInd));
  an('12d) si no cabe de ninguna forma se centra en la ventana',
    !!fnAbrirInd && fnAbrirInd.indexOf('Math.max(8, Math.round((vh - mAlto) / 2))') >= 0);
  an('12e) el menu suelto no se ancla a la derecha del scroller',
    !!fnAbrirInd && fnAbrirInd.indexOf("if (menu.style.position !== 'fixed')") >= 0);
  an('12f) cada apertura reposiciona el menu desde cero',
    !!fnAbrirInd && fnAbrirInd.indexOf('this._resetMenuPos(menu)') >= 0);
  an('12g) cerrar el menu tambien limpia la posicion',
    !!extraerMetodo(src, '_cerrarInd') &&
    extraerMetodo(src, '_cerrarInd').indexOf('this._resetMenuPos(menu)') >= 0);
  an('12h) el reset limpia los estilos inline de posicion',
    !!fnReset && fnReset.indexOf("menu.style.position = ''") >= 0 &&
    fnReset.indexOf("menu.style.top = ''") >= 0 &&
    fnReset.indexOf("menu.style.left = ''") >= 0);
  an('12i) el scroll cierra los menus (el que se suelta se quedaria pegado)',
    !!fnInit && fnInit.indexOf("addEventListener('scroll', this._indDocScroll, true)") >= 0 &&
    /this\._indDocScroll = function \(\) \{ self\._cerrarTodosInd\(\); \};/.test(fnInit));
  an('12-j) destroy() suelta tambien el listener del scroll',
    !!fnDestroy && fnDestroy.indexOf("removeEventListener('scroll', this._indDocScroll, true)") >= 0);

  return c;
}

// ══════════════════════════════════════════════════════════════════
// Mutaciones: cada una tiene que hacer caer al menos un check
// ══════════════════════════════════════════════════════════════════
const MUTACIONES = [
  ['la fecha del modal pierde su desplegable',
    src, html.replace('data-ind-dd="ind-fecha"', 'data-ind-dd="ind-fecha-x"'), css, htmlIndex],
  ['el filtro de genero pierde su desplegable',
    src, html.replace('data-ind-dd="d-genero"', 'data-ind-dd="d-genero-x"'), css, htmlIndex],
  ['el filtro de estado pierde su desplegable',
    src, html.replace('data-ind-dd="f-estado"', 'data-ind-dd="f-estado-x"'), css, htmlIndex],
  ['el filtro de anio del registro pierde su desplegable',
    src, html.replace('data-ind-dd="f-anio"', 'data-ind-dd="f-anio-x"'), css, htmlIndex],
  ['el genero del modal pierde su desplegable',
    src, html.replace('data-ind-dd="ind-genero"', 'data-ind-dd="ind-genero-x"'), css, htmlIndex],
  ['el select del filtro de estado deja de quedar oculto',
    src, html.replace('<select class="kair-select ind-dd__native" id="f-estado"',
      '<select class="kair-select" id="f-estado"'), css, htmlIndex],
  ['la fecha del modal deja de quedar oculta',
    src, html.replace('id="ind-fecha" class="ind-dd__native"', 'id="ind-fecha"'), css, htmlIndex],
  ['la grilla del mes pierde celdas',
    src.replace('celdas.length < 42', 'celdas.length < 40'), html, css, htmlIndex],
  ['el filtro de anos no resincroniza su etiqueta',
    src.replace('    this._syncIndPickers();\n  }\n  populateCargos() {', '  }\n  populateCargos() {'),
    html, css, htmlIndex],
  ['setAnio no resincroniza la etiqueta',
    src.replace(/    this\._syncIndPickers\(\);\n    this\.refreshAll\(\);/, '    this.refreshAll();'),
    html, css, htmlIndex],
  ['el boton "Ver reprobados" no resincroniza la etiqueta',
    src.replace("      var fe = self.q('#f-estado'); if (fe) fe.value = 'REPROBADO';\n      var fb = self.q('#f-buscar'); if (fb) fb.value = '';\n      self._syncIndPickers();",
      "      var fe = self.q('#f-estado'); if (fe) fe.value = 'REPROBADO';\n      var fb = self.q('#f-buscar'); if (fb) fb.value = '';"),
    html, css, htmlIndex],
  ['el guardado deja de leer el id del genero',
    src.replace("var genEl = this.q('#ind-genero');", "var genEl = this.q('#ind-genero2');"), html, css, htmlIndex],
  ['el guardado deja de validar la fecha',
    src.replace("this.setErr('fw-fecha', !fecha); if (!fecha) ok = false;", ''), html, css, htmlIndex],
  ['al abrir el modal se deja de llenar la fecha',
    src.replace("set('#ind-fecha', r ? r.fecha : '');", ''), html, css, htmlIndex],
  ['la inicializacion ignora el <select>',
    src.replace("var esLista = native.tagName === 'SELECT';", "var esLista = false;"), html, css, htmlIndex],
  ['la lista se escribe a mano en vez de leerse del campo',
    src.replace('Array.from(native.options)', 'Array.from([])'), html, css, htmlIndex],
  ['el boton muestra el valor crudo en vez del texto de la opcion',
    src.replace("texto = op ? op.text : (native.value || '');", "texto = native.value || '';"),
    html, css, htmlIndex],
  ['el valor que ya tiene el campo deja de quedar alcanzable',
    src.replace('if (native.value && !hayActual) {', 'if (false) {'), html, css, htmlIndex],
  ['los desplegables solo se buscan en el modal (los filtros quedan muertos)',
    src.replace('var cont = document;', "var cont = document.getElementById('modal-induccion');"),
    html, css, htmlIndex],
  ['cerrar todos los menus ya no alcanza a los filtros',
    src.replace("document.querySelectorAll('.ind-dd').forEach(dd => this._cerrarInd(dd));",
      "document.querySelectorAll('.ind-dd--fecha').forEach(dd => this._cerrarInd(dd));"),
    html, css, htmlIndex],
  ['la resincronizacion ya no alcanza a los filtros',
    src.replace("document.querySelectorAll('.ind-dd').forEach(dd => this._actualizarLabelInd(dd));",
      "document.querySelectorAll('.ind-dd--fecha').forEach(dd => this._actualizarLabelInd(dd));"),
    html, css, htmlIndex],
  ['elegir una opcion ya no dispara el change',
    src.replace("native.dispatchEvent(new Event('change', { bubbles: true }));\n          self._actualizarLabelInd(dd);",
      'self._actualizarLabelInd(dd);'), html, css, htmlIndex],
  ['el rotulo del campo deja de abrir el desplegable',
    src.replace("var rotulo = cont.querySelector('label[for=\"' + native.id + '\"]');", 'var rotulo = null;'),
    html, css, htmlIndex],
  ['el calendario deja de pintarse al abrir',
    src.replace('this._pintarCalendarioInd(dd);', ''), html, css, htmlIndex],
  ['las opciones dejan de pintarse al abrir',
    src.replace('this._pintarOpcionesInd(dd);', ''), html, css, htmlIndex],
  ['destroy() deja de soltar los listeners de documento',
    src.replace("    if (this._indDocClick) document.removeEventListener('click', this._indDocClick);\n", ''),
    html, css, htmlIndex],
  ['el cache-bust de index.html no sube',
    src, html, css,
    htmlIndex.replace('inducciones-logic.js?v=INDUCCIONES-20261126-v23-pickers',
      'inducciones-logic.js?v=INDUCCIONES-20261120-v22-modal-fix')],
  ['el HTML de la vista se pide con el sello viejo',
    src.replace("inducciones-view.html?v=' + INDUC_TOKEN",
      "inducciones-view.html?v=INDUCCIONES-20261120-v22-modal-fix"), html, css, htmlIndex],
  ['el CSS de la vista se pide con el sello viejo',
    src, html.replace('inducciones-view.css?v=INDUCCIONES-20261126-v23-pickers',
      'inducciones-view.css?v=INDUCCIONES-20261120-v22-modal-fix'), css, htmlIndex],
  ['el token del modulo se queda viejo',
    src.replace("var INDUC_TOKEN = 'INDUCCIONES-20261126-v23-pickers';",
      "var INDUC_TOKEN = 'INDUCCIONES-20261120-v22-modal-fix';"), html, css, htmlIndex],
  ['el borde del desplegable usa un token que no existe',
    src, html, css.replace('background:var(--kair-surface);border:1px solid var(--kair-border);border-radius:var(--kair-radius-sm);',
      'background:var(--kair-surface);border:1px solid var(--border-color);border-radius:var(--kair-radius-sm);'), htmlIndex],
  ['el menu pierde la sombra del modulo',
    src, html, css.replace('box-shadow:var(--kair-shadow-pop);display:flex;flex-direction:column;gap:2px}',
      'box-shadow:none;display:flex;flex-direction:column;gap:2px}'), htmlIndex],
  ['el toggle pierde el radio del modulo',
    src, html, css.replace('background:var(--kair-surface);border:1px solid var(--kair-border);border-radius:var(--kair-radius-sm);',
      'background:var(--kair-surface);border:1px solid var(--kair-border);border-radius:0;'), htmlIndex],
  ['el borde de error ya no se ve en el boton',
    src, html, css.replace('.inducciones-container .kair-field.is-error .ind-dd__toggle{border-color:var(--kair-red);',
      '.inducciones-container .kair-field.is-error .ind-dd__toggle-x{border-color:var(--kair-red);'), htmlIndex],
  ['los estilos del desplegable quedan sin scope',
    src, html, css.replace('.inducciones-container .ind-dd__toggle{', '.ind-dd__toggle{'), htmlIndex],
  ['el filtro deja de ser compacto',
    src, html, css.replace('.inducciones-container .ind-dd--filtro{width:auto}',
      '.inducciones-container .ind-dd--filtro{width:100%}'), htmlIndex],
  ['el menu deja de soltarse del scroller (se recorta)',
    src.replace("menu.style.position = 'fixed';", ''), html, css, htmlIndex],
  ['el menu suelto deja de medirse contra la ventana',
    src.replace('var vh = window.innerHeight;', 'var vh = 0;'), html, css, htmlIndex],
  ['el menu deja de reposicionarse en cada apertura',
    src.replace('    this._resetMenuPos(menu);\n    menu.hidden = false;', '    menu.hidden = false;'),
    html, css, htmlIndex],
  ['cerrar el menu deja de limpiar la posicion',
    src.replace('if (menu) { menu.hidden = true; this._resetMenuPos(menu); }', 'if (menu) menu.hidden = true;'),
    html, css, htmlIndex],
  ['el scroll deja de cerrar los menus',
    src.replace("document.addEventListener('scroll', this._indDocScroll, true);", ''), html, css, htmlIndex],
  ['destroy() deja de soltar el listener del scroll',
    src.replace("    if (this._indDocScroll) document.removeEventListener('scroll', this._indDocScroll, true);\n", ''),
    html, css, htmlIndex]
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
  console.log('  📦 · Desplegables propios de Induccion y Reinduccion');
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
