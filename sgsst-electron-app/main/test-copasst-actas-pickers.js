/* main/test-copasst-actas-pickers.js
 * El Generador de Actas COPASST: fecha y horas con desplegables propios.
 *
 * EL PORQUÉ
 * ----------
 * El <input type="date"> y los <input type="time"> nativos se veían como los
 * del sistema operativo (el desplegable de la hora, con su lista de 12 h), y
 * no como el resto de la app. El Formulario de Registro de ausentismo ya
 * tiene su propio sistema (📦1101): el campo nativo queda OCULTO como fuente
 * de verdad y un botón con calendario o menú propio muestra el valor.
 *
 * Este test replica ese patrón y protege lo que no puede romperse:
 *   - los tres IDs (fecha, inicia, termina) siguen siendo los que lee el
 *     guardado del Excel;
 *   - la grilla del mes y la rejilla de horarios son lógica pura: se EJECUTAN
 *     contra el archivo vivo, no se leen;
 *   - el autollenado cambia la fecha por fuera del desplegable: sin la
 *     resincronización el botón mostraría una fecha y el Excel llevaría otra.
 *
 * Patrón del repo: los métodos se EXTRAEN del archivo real con new Function
 * (mismo enfoque que test-ausentismo-form-dropdown.js) y se ejecutan.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RUTA_LOGIC = path.join(ROOT, 'modules', 'recursos', 'copasst', 'copasst-logic.js');
const RUTA_INDEX = path.join(ROOT, 'index.html');

const src = fs.readFileSync(RUTA_LOGIC, 'utf8');
const htmlIndex = fs.readFileSync(RUTA_INDEX, 'utf8');

const CAMPOS = ['fecha', 'inicia', 'termina'];

const checks = [];
function ok(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra == null ? '' : String(extra) });
}

// ══════════════════════════════════════════════════════════════════
// Helpers: extraer un metodo del archivo real
// ══════════════════════════════════════════════════════════════════
function extraerMetodo(fuente, nombre) {
  // El archivo tiene metodos indentados a 2 y a 4 espacios: el extractor
  // tiene que aceptar los dos, o no encuentra ni handleExportExcel (2) ni
  // prepareExcelChanges (2) y los contratos de datos dejan de protegerse.
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

function correrCon(src, htmlIndex) {
  const c = [];
  function an(nombre, cond, extra) { c.push({ name: nombre, ok: !!cond, extra: extra || '' }); }

  // ── 1 · el marcado: los tres campos con su desplegable ─────────────
  CAMPOS.forEach(function (id) {
    an('1a) el campo ' + id + ' tiene su desplegable cop-dd',
      src.indexOf('data-cop-dd="' + id + '"') >= 0);
    an('1b) el campo ' + id + ' conserva su ID original',
      src.indexOf('id="' + id + '"') >= 0);
  });
  an('1c) los tres nativos se ocultan como fuente de verdad (cop-dd__native)',
    (src.match(/cop-dd__native/g) || []).length >= 3,
    'aparece ' + (src.match(/cop-dd__native/g) || []).length + ' veces');
  an('1d) el marcado trae boton toggle y menu para cada campo',
    (src.match(/cop-dd__toggle/g) || []).length >= 3 &&
    (src.match(/cop-dd__menu/g) || []).length >= 3);
  an('1e) la fecha usa el menu de calendario (cop-cal)',
    (src.match(/class="cop-dd__menu cop-cal"/g) || []).length === 1,
    'aparece ' + (src.match(/class="cop-dd__menu cop-cal"/g) || []).length + ' veces');
  an('1f) las dos horas usan el desplegable de horarios (cop-dd--hora)',
    (src.match(/cop-dd--hora/g) || []).length >= 2,
    'aparece ' + (src.match(/cop-dd--hora/g) || []).length + ' veces');
  an('1g) los rotulos apuntan al campo (for=), que ademas abre el desplegable',
    CAMPOS.every(function (id) { return src.indexOf('for="' + id + '"') >= 0; }));

  // ── 2 · los metodos existen ───────────────────────────────────────
  ['_initCopasstPickers', '_buildMonthGrid', '_buildTimeSlots',
   '_pintarCalendarioCop', '_pintarHorasCop', '_actualizarLabelCop',
   '_syncCopasstPickers', '_abrirCop', '_cerrarCop', '_cerrarTodosCop'
  ].forEach(function (m) {
    an('2) existe el metodo ' + m, !!extraerMetodo(src, m));
  });
  an('2b) el formulario inicializa los desplegables',
    src.indexOf('this._initCopasstPickers()') >= 0);

  // ── 3 · la grilla del mes se EJECUTA de verdad ─────────────────────
  const fnGridRaw = extraerMetodo(src, '_buildMonthGrid');
  an('3-pre) _buildMonthGrid se puede extraer', !!fnGridRaw);
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
  const fnSlotsRaw = extraerMetodo(src, '_buildTimeSlots');
  an('4-pre) _buildTimeSlots se puede extraer', !!fnSlotsRaw);
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
    an('4f) 08:00 y 09:00 (los valores por defecto) estan en la grilla',
      slots.indexOf('08:00') >= 0 && slots.indexOf('09:00') >= 0);
    an('4g) el paso es de 15 minutos (no hay 08:10)',
      slots.indexOf('08:10') === -1 && slots.indexOf('08:15') >= 0);
  }

  // ── 5 · los contratos que no pueden romperse ──────────────────────
  const fnExport = extraerMetodo(src, 'handleExportExcel');
  an('5a) el guardado sigue leyendo los tres IDs originales',
    !!fnExport && CAMPOS.every(function (id) {
      return fnExport.indexOf("document.getElementById('" + id + "').value") >= 0;
    }));
  const fnCambios = extraerMetodo(src, 'prepareExcelChanges');
  an('5b) las tres filas del Excel siguen recibiendo fecha, inicio y fin',
    !!fnCambios && fnCambios.indexOf('data.fecha') >= 0 &&
    fnCambios.indexOf('data.inicia') >= 0 && fnCambios.indexOf('data.termina') >= 0);

  // ── 6 · el autollenado resincroniza la etiqueta ───────────────────
  const fnAuto = extraerMetodo(src, 'handleAutoFill');
  an('6a) el autollenado resincroniza la etiqueta de la fecha',
    !!fnAuto && fnAuto.indexOf('_syncCopasstPickers') >= 0);
  const fnSync = extraerMetodo(src, '_syncCopasstPickers');
  an('6b) la resincronizacion recorre todos los desplegables',
    !!fnSync && fnSync.indexOf("querySelectorAll('.cop-dd')") >= 0);
  const fnLabel = extraerMetodo(src, '_actualizarLabelCop');
  an('6c) la etiqueta muestra la fecha en dia/mes/anio',
    !!fnLabel && fnLabel.indexOf("p[2] + '/' + p[1] + '/' + p[0]") >= 0);
  an('6d) la etiqueta de la hora es la misma que va al Excel (24 h)',
    !!fnLabel && fnLabel.indexOf('texto = native.value') >= 0);

  // ── 7 · el comportamiento de los menus ────────────────────────────
  const fnInit = extraerMetodo(src, '_initCopasstPickers');
  an('7a) Escape cierra los menus',
    !!fnInit && fnInit.indexOf("'keydown'") >= 0 && fnInit.indexOf("ev.key === 'Escape'") >= 0);
  an('7b) el clic fuera de un desplegable cierra los demas',
    !!fnInit && fnInit.indexOf("closest('.cop-dd')") >= 0);
  an('7c) al abrir uno se cierran los demas (un solo menu a la vez)',
    !!fnInit && fnInit.indexOf('_cerrarTodosCop()') >= 0);
  an('7d) el rotulo del campo tambien abre el desplegable',
    !!fnInit && fnInit.indexOf('label[for="') >= 0);
  an('7e) elegir una hora dispara change en el nativo',
    !!fnInit && fnInit.indexOf("dispatchEvent(new Event('change'") >= 0);
  const fnAbrir = extraerMetodo(src, '_abrirCop');
  an('7f) si no cabe abajo el menu se abre hacia arriba (el editor tiene scroll)',
    !!fnAbrir && fnAbrir.indexOf('cop-dd__menu--up') >= 0);
  an('7g) el menu se ancla a la derecha si se pasa del borde',
    !!fnAbrir && fnAbrir.indexOf('style.right') >= 0);
  an('7h) la hora de FIN se pinta con el limite de la hora de INICIO',
    !!fnAbrir && fnAbrir.indexOf("'termina'") >= 0 && fnAbrir.indexOf("getElementById('inicia')") >= 0);

  // ── 8 · la regla de negocio de las horas ───────────────────────────
  const fnHoras = extraerMetodo(src, '_pintarHorasCop');
  an('8a) las casillas anteriores al limite quedan deshabilitadas',
    !!fnHoras && fnHoras.indexOf('s < limiteInferior') >= 0 && fnHoras.indexOf('disabled') >= 0);
  an('8b) el valor actual siempre queda alcanzable, aun fuera de la grilla',
    !!fnHoras && fnHoras.indexOf('slots.indexOf(native.value) === -1') >= 0);
  an('8c) si se mueve el INICIO y el FIN quedo antes, el FIN lo sigue',
    !!fnInit && fnInit.indexOf('termina.value < valor') >= 0);

  // ── 9 · estilos ───────────────────────────────────────────────────
  an('9a) el toggle esta scoped bajo .copasst-actas-container',
    src.indexOf('.copasst-actas-container .cop-dd__toggle') >= 0);
  an('9b) el menu tambien esta scoped',
    src.indexOf('.copasst-actas-container .cop-dd__menu') >= 0);
  an('9c) hay bloque oscuro para los desplegables',
    /\[data-theme\^="dark"\] \.copasst-actas-container \.cop-/.test(src));
  an('9d) el chevron gira 180 grados al abrir',
    /\.copasst-actas-container \.cop-dd--open \.cop-dd__chevron\s*\{\s*transform:\s*rotate\(180deg\)/.test(src));
  an('9e) el menu respeta el atributo hidden (display:none)',
    src.indexOf('.cop-dd__menu[hidden]') >= 0);
  an('9f) el calendario propio tiene estilos (grilla y dias)',
    /\.cop-cal__grid\s*\{/.test(src) && /\.cop-cal__day\s*\{/.test(src));
  an('9g) la rejilla de horarios tiene estilos',
    /\.cop-horas\s*\{/.test(src));
  an('9h) el dia elegido tiene su propio color en oscuro (blanco no se lee)',
    /\[data-theme\^="dark"\][^{]*\.cop-cal__day--sel\s*\{\s*color:\s*#0b1f33/.test(src));

  // ── 10 · cache-bust (regla del repo) ─────────────────────────────
  an('10a) index.html carga copasst-logic.js con ?v=',
    /copasst-logic\.js\?v=[A-Za-z0-9-]+/.test(htmlIndex));
  an('10b) el ?v= es el de esta ronda',
    htmlIndex.indexOf('copasst-logic.js?v=COPASST-20261126-v4-actas-pickers') >= 0);
  an('10c) el ?v= anterior ya no esta',
    htmlIndex.indexOf('COPASST-20261014-v3-dark890') < 0);

  return c;
}

// ══════════════════════════════════════════════════════════════════
// Mutaciones: cada una tiene que hacer caer al menos un check
// ══════════════════════════════════════════════════════════════════
const MUTACIONES = [
  ['la fecha pierde su desplegable',
    src.replace('data-cop-dd="fecha"', 'data-cop-dd="fecha-x"'),
    htmlIndex],
  ['la rejilla de horarios pasa a pasos de 30 minutos',
    src.replace('m += 15', 'm += 30'),
    htmlIndex],
  ['la grilla del mes pierde celdas',
    src.replace('celdas.length < 42', 'celdas.length < 40'),
    htmlIndex],
  ['el autollenado no resincroniza la etiqueta',
    src.replace('if (typeof this._syncCopasstPickers === \'function\') this._syncCopasstPickers();', ''),
    htmlIndex],
  ['el guardado deja de leer el id de la hora de fin',
    src.replace("document.getElementById('termina').value", "document.getElementById('termina2').value"),
    htmlIndex],
  ['la hora de fin ya puede ser anterior a la de inicio',
    src.replace('const bloqueada = !!(limiteInferior && s < limiteInferior);', 'const bloqueada = false;'),
    htmlIndex],
  ['el calendario pierde su rejilla',
    src.replace('.cop-cal__grid', '.cop-cal__grid-x'),
    htmlIndex],
  ['el cache-bust no sube',
    src,
    htmlIndex.replace('copasst-logic.js?v=COPASST-20261126-v4-actas-pickers', 'copasst-logic.js?v=COPASST-20261014-v3-dark890')]
];

(async function () {
  const base = correrCon(src, htmlIndex);
  base.forEach(function (x) { ok(x.name, x.ok, x.extra); });

  for (const m of MUTACIONES) {
    const nombre = m[0];
    const mutLogic = m[1];
    const mutIndex = m[2];
    if (mutLogic === src && mutIndex === htmlIndex) {
      ok('MUTANTE detectado: ' + nombre, false, 'la mutacion no cambio el codigo (patron desfasado)');
      continue;
    }
    let fallo = false;
    try {
      const res = correrCon(mutLogic, mutIndex);
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
  console.log('  📦 · Fecha y hora del Generador de Actas COPASST');
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
