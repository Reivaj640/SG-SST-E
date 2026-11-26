// test-ausentismo-form-dropdown.js
// 📦1101 (2026-11-26) — Los 5 campos del Formulario de Registro de ausentismo
// (género, clase de incapacidad, tipo de incapacidad, fecha de inicio y fecha
// de finalización) se ven como el botón "Acciones" de Base de Personal:
// botón con chevron que gira, menú PROPIO (no el del sistema operativo) y
// calendario propio para las dos fechas.
//
// Por qué este test no es todo de texto: la grilla del calendario es lógica
// pura y se EJECUTA de verdad (42 celdas, días correctos, ISO bien formado).
// El resto (marcado, contratos, estilos) se verifica en el archivo fuente,
// porque vive dentro de métodos grandes que necesitan el DOM de la app.
//
// Contratos que este test protege (si alguien los rompe, el formulario deja
// de guardar o el autocompletado de LUTO deja de funcionar):
//   - getFormData() sigue leyendo los 5 IDs originales.
//   - limpiarFormulario() resetea las etiquetas visibles de los botones.
//   - Elegir "LICENCIA DE LUTO" dispara change en el select nativo (Z63.4).
//   - disableForm() cierra los menús abiertos al bloquear el formulario.
//   - Cache-bust del ?v= en index.html (regla del repo).
//
// Patrón del repo: los métodos se EXTRAEN del archivo real con new Function
// (mismo enfoque que test-ausentismo-busqueda-cedula.js) y se ejecutan con
// un puente simulado; así el test pasa contra el archivo vivo, no contra
// una copia.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RUTA_MEDICION = path.join(ROOT, 'modules', 'gestion-salud', 'ausentismo', 'medicion-ausentismo.js');
const RUTA_INDEX = path.join(ROOT, 'index.html');

const src = fs.readFileSync(RUTA_MEDICION, 'utf8');
const htmlIndex = fs.readFileSync(RUTA_INDEX, 'utf8');

const checks = [];
function ok(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra == null ? '' : String(extra) });
}

// ══════════════════════════════════════════════════════════════════
// Helpers: extraer un metodo del archivo real
// ══════════════════════════════════════════════════════════════════
function extraerMetodo(fuente, nombre) {
  const re = new RegExp('^    (?:async\\s+)?(?:function\\s+)?' + nombre + '\\s*\\(', 'm');
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

/** Extrae una asignacion del tipo `this._algo = function (ev) { ... };`
 *  devolviendo SOLO el cuerpo de la funcion (para poder ejecutarla). */
function extraerAsignacion(fuente, propiedad) {
  const idx = fuente.indexOf(propiedad + ' = function');
  if (idx < 0) return null;
  const desde = idx + propiedad.length + 3; // apunta a la palabra "function"
  const llaveAbierta = fuente.indexOf('{', desde);
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
      if (nivel === 0) return fuente.slice(desde, i + 1);
    }
  }
  return null;
}

const CAMPOS = [
  'genero-select',
  'clase-incapacidad-select',
  'tipo-incapacidad-select',
  'fecha-inicio-input',
  'fecha-fin-input'
];

async function main() {

  // ══════════════════════════════════════════════════════════════
  // 1) Marcado — los 5 desplegables y los nativos como fuente de verdad
  // ══════════════════════════════════════════════════════════════
  CAMPOS.forEach(function (id) {
    ok('1) el campo ' + id + ' tiene su desplegable aus-dd',
      src.indexOf('data-aus-dd="' + id + '"') >= 0);
  });
  ok('1f) los 5 nativos (<select>/<input>) conservan su ID original',
    CAMPOS.every(function (id) { return src.indexOf('id="' + id + '"') >= 0; }));
  ok('1g) los nativos se ocultan como fuente de verdad (aus-dd__native)',
    (src.match(/aus-dd__native/g) || []).length >= 5,
    'aparece ' + (src.match(/aus-dd__native/g) || []).length + ' veces');
  ok('1h) el marcado trae boton toggle y menu para cada campo',
    (src.match(/aus-dd__toggle/g) || []).length >= 5 &&
    (src.match(/aus-dd__menu/g) || []).length >= 5);
  ok('1i) los dos campos de fecha usan el menu de calendario (aus-cal)',
    (src.match(/class="aus-dd__menu aus-cal"/g) || []).length === 2,
    'aparece ' + (src.match(/class="aus-dd__menu aus-cal"/g) || []).length + ' veces');

  // ══════════════════════════════════════════════════════════════
  // 2) Metodos nuevos presentes
  // ══════════════════════════════════════════════════════════════
  ['_initAusDropdowns', '_buildMonthGrid', '_pintarCalendario',
   '_actualizarLabelDd', '_abrirAus', '_cerrarAus', '_cerrarTodosAus'
  ].forEach(function (m) {
    ok('2) existe el metodo ' + m, !!extraerMetodo(src, m));
  });
  ok('2h) renderRegistrarAusentismoView inicializa los desplegables',
    src.indexOf('this._initAusDropdowns()') >= 0);

  // ══════════════════════════════════════════════════════════════
  // 3) Funcional — la grilla del calendario se EJECUTA de verdad
  // ══════════════════════════════════════════════════════════════
  const fnGridRaw = extraerMetodo(src, '_buildMonthGrid');
  ok('3-pre) _buildMonthGrid se puede extraer', !!fnGridRaw);
  if (fnGridRaw) {
    const fnGrid = comoFuncion(fnGridRaw);
    const nov = fnGrid(2026, 10); // noviembre 2026 (mes 0-based)
    ok('3a) noviembre 2026 arma 42 celdas', nov.length === 42, 'dio ' + nov.length);
    ok('3b) la primera celda es 26 de octubre (la semana arranca en lunes)',
      nov[0].iso === '2026-10-26', nov[0].iso);
    ok('3c) el dia 1 de noviembre cae en el indice 6 y es del mes',
      nov[6].iso === '2026-11-01' && nov[6].inMonth === true, nov[6].iso);
    ok('3d) la ultima celda es 6 de diciembre',
      nov[41].iso === '2026-12-06', nov[41].iso);
    ok('3e) noviembre tiene 30 dias marcados como del mes',
      nov.filter(function (c) { return c.inMonth; }).length === 30);
    const feb = fnGrid(2026, 1);
    ok('3f) febrero 2026 (no bisiesto) tiene 28 dias',
      feb.filter(function (c) { return c.inMonth; }).length === 28);
    const feb24 = fnGrid(2024, 1);
    ok('3g) febrero 2024 (bisiesto) tiene 29 dias',
      feb24.filter(function (c) { return c.inMonth; }).length === 29);
    ok('3h) las 42 celdas traen ISO valido AAAA-MM-DD',
      nov.every(function (c) { return /^\d{4}-\d{2}-\d{2}$/.test(c.iso); }));
    ok('3i) las celdas del mes vecino se marcan fuera del mes',
      nov[0].inMonth === false && nov[41].inMonth === false);
  }

  // ══════════════════════════════════════════════════════════════
  // 4) Contratos existentes intactos
  // ══════════════════════════════════════════════════════════════
  const fnGet = extraerMetodo(src, 'getFormData');
  ok('4a) getFormData sigue leyendo los 5 IDs originales',
    !!fnGet && CAMPOS.every(function (id) { return fnGet.indexOf("'" + id + "'") >= 0; }));

  const fnLimpiar = extraerMetodo(src, 'limpiarFormulario');
  ok('4b) limpiarFormulario resetea las etiquetas de los desplegables',
    !!fnLimpiar && fnLimpiar.indexOf('_actualizarLabelDd') >= 0);

  const fnDisable = extraerMetodo(src, 'disableForm');
  ok('4c) disableForm cierra los menus al bloquear el formulario',
    !!fnDisable && fnDisable.indexOf('_cerrarTodosAus') >= 0);

  ok('4d) el listener de LUTO sigue en change del select nativo',
    /tipo-incapacidad-select[\s\S]{0,200}addEventListener\('change'/.test(src));

  // ══════════════════════════════════════════════════════════════
  // 5) Comportamiento de los menus (en el fuente de los metodos)
  // ══════════════════════════════════════════════════════════════
  const fnInit = extraerMetodo(src, '_initAusDropdowns');
  ok('5-pre) _initAusDropdowns se puede extraer', !!fnInit);
  if (fnInit) {
    ok('5a) elegir una opcion dispara change en el nativo',
      fnInit.indexOf("dispatchEvent(new Event('change'") >= 0);
    ok('5b) Escape cierra los menus',
      fnInit.indexOf("'keydown'") >= 0 && fnInit.indexOf("ev.key === 'Escape'") >= 0);
    ok('5c) el clic fuera de un desplegable cierra los demas',
      fnInit.indexOf("closest('.aus-dd')") >= 0);
    ok('5d) al abrir uno se cierran los demas (un solo menu a la vez)',
      fnInit.indexOf('_cerrarTodosAus()') >= 0);
    ok('5e) las opciones del menu salen del select nativo (una sola fuente)',
      fnInit.indexOf('native.options') >= 0);
    ok('5f) el rotulo del campo tambien abre el desplegable',
      fnInit.indexOf("label[for=") >= 0);
  }

  const fnAbrir = extraerMetodo(src, '_abrirAus');
  ok('5g) si no cabe abajo el menu se abre hacia arriba (la card recorta)',
    !!fnAbrir && fnAbrir.indexOf('aus-dd__menu--up') >= 0);
  ok('5h) el menu se ancla a la derecha si se pasa del borde',
    !!fnAbrir && fnAbrir.indexOf('style.right') >= 0);

  // ══════════════════════════════════════════════════════════════
  // 6) Estilos — scoped, oscuro, chevron y calendario
  // ══════════════════════════════════════════════════════════════
  ok('6a) el toggle esta scoped bajo .aus-scope',
    src.indexOf('.aus-scope .aus-dd__toggle') >= 0);
  ok('6b) el menu tambien esta scoped',
    src.indexOf('.aus-scope .aus-dd__menu') >= 0);
  ok('6c) hay bloque oscuro para los desplegables',
    /\[data-theme\^="dark"\] \.aus-scope \.aus-dd/.test(src));
  ok('6d) el chevron gira 180 grados al abrir',
    /\.aus-scope \.aus-dd--open \.aus-dd__chevron\s*\{\s*transform:\s*rotate\(180deg\)/.test(src));
  ok('6e) el menu respeta el atributo hidden (display:none)',
    src.indexOf('.aus-dd__menu[hidden]') >= 0);
  ok('6f) el calendario propio tiene estilos (grilla y dias)',
    src.indexOf('.aus-cal__grid') >= 0 && src.indexOf('.aus-cal__day') >= 0);
  ok('6g) el estado activo de la opcion se resalta',
    src.indexOf('.aus-dd__option--active') >= 0);

  // ══════════════════════════════════════════════════════════════
  // 7) Cache-bust (regla del repo: tocar el archivo = bumpear su ?v=)
  // ══════════════════════════════════════════════════════════════
  ok('7a) index.html carga medicion-ausentismo.js con ?v=',
    /medicion-ausentismo\.js\?v=[A-Za-z0-9-]+/.test(htmlIndex));
  ok('7b) el ?v= cambio respecto de la version anterior',
    htmlIndex.indexOf('AUSENTISMO-20261125-busqueda-global-fix') < 0);
  ok('7c) el ?v= es el del fix del calendario (navegar de mes no cierra)',
    htmlIndex.indexOf('medicion-ausentismo.js?v=AUSENTISMO-20261126-dropdowns-calendario-fix') >= 0);

  // ══════════════════════════════════════════════════════════════
  // 8) El calendario NO se cierra al cambiar de mes (📦1101-fix)
  //
  // El fallo: al cambiar de mes el calendario se repinta con innerHTML, y
  // eso DESCONECTA el botón que se pulsó. El clic seguía subiendo hasta el
  // detector de "clic fuera", que ya no encontraba al .aus-dd en la ruta
  // del botón desconectado → cerraba el menú. El usuario tenía que volver
  // a hacer clic para verlo.
  //
  // Las dos defenses:
  //   (1) el listener del menú detiene la propagación (el clic se queda
  //       dentro del desplegable), y
  //   (2) el detector de "clic fuera" revisa composedPath() (la ruta que
  //       el evento tenía al dispararse), no solo el destino actual.
  // ══════════════════════════════════════════════════════════════
  const fnInitTxt = extraerMetodo(src, '_initAusDropdowns') || '';

  // 8a) El listener del CALENDARIO (no el del rótulo) detiene la propagación.
  //     Se busca dentro del bloque del menú para que el check no se satisfaga
  //     con el stopPropagation del rótulo (que está en otro lado).
  const iMenu = fnInitTxt.indexOf("menu.addEventListener('click', function (ev) {");
  const iAcc = fnInitTxt.indexOf("closest('[data-aus-accion]')");
  const bloqueCalendario = (iMenu >= 0 && iAcc > iMenu)
    ? fnInitTxt.slice(iMenu, iAcc) : '';
  ok('8a) el clic dentro del calendario detiene la propagacion',
    bloqueCalendario.indexOf('ev.stopPropagation()') >= 0);

  ok('8b) el detector de clic fuera revisa composedPath (destino desconectado)',
    fnInitTxt.indexOf('composedPath') >= 0);
  ok('8c) el detector de clic fuera sigue usando closest como respaldo',
    fnInitTxt.indexOf("closest('.aus-dd')") >= 0);
  ok('8d) al elegir un dia la vista queda en el mes de ese dia',
    fnInitTxt.indexOf("p[0] + '-' + (parseInt(p[1], 10) - 1)") >= 0);

  // 8e-f) COMPORTAMIENTO REAL: se extrae el detector de "clic fuera" del
  // archivo real y se ejecuta con dos eventos simulados:
  //   - clic DENTRO del desplegable cuyo destino ya quedó desconectado
  //     (lo que pasa al repintar el mes): NO debe cerrar nada.
  //   - clic FUERA del desplegable: SÍ debe cerrar los menús.
  const detector = extraerAsignacion(src, 'this._ausDocClick');
  ok('8e) se puede extraer el detector de clic fuera', !!detector);
  if (detector) {
    const selfMock = {
      cerradas: 0,
      _cerrarTodosAus: function () { this.cerradas++; }
    };
    const fnDoc = new Function('self',
      'var _ausDocClick = ' + detector + ';\nreturn _ausDocClick;')(selfMock);

    // Clic dentro del desplegable, destino desconectado (closest no lo ve)
    const nodoDd = { classList: { contains: function (c) { return c === 'aus-dd'; } } };
    const nodoFuera = { classList: { contains: function () { return false; } } };
    const destinoDesconectado = {
      closest: function () { return null; } // ya no está en el árbol
    };
    fnDoc({
      target: destinoDesconectado,
      composedPath: function () { return [destinoDesconectado, nodoDd]; }
    });
    ok('8f) un clic dentro del desplegable NO cierra los menus (destino desconectado)',
      selfMock.cerradas === 0, 'cerradas=' + selfMock.cerradas);

    // Clic de verdad afuera: sí debe cerrar
    selfMock.cerradas = 0;
    fnDoc({
      target: { closest: function () { return null; } },
      composedPath: function () { return [nodoFuera]; }
    });
    ok('8g) un clic afuera SI cierra los menus',
      selfMock.cerradas === 1, 'cerradas=' + selfMock.cerradas);
  }

  // ══════════════════════════════════════════════════════════════
  let failed = 0;
  console.log('\n=======================================');
  console.log('  📦1101 · Desplegables del Formulario de Registro');
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

main().catch(function (e) {
  console.error('FAIL  excepcion: ' + e.message);
  console.log('0/1 OK');
  process.exit(1);
});
