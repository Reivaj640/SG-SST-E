'use strict';
// 📦844 · El mini-calendar de la Bandeja Integrada queda fijo en el mes actual.
//
// Por que este test NO puede ser solo de texto: el bug era que el mini y el
// calendario grande compartian estado (viewYear/viewMonth/viewMonthLabel) y
// los dos se movian con la misma funcion changeMonth(). Eso no se ve leyendo
// el archivo: se ve cuando el mini pinta un mes que no es el de hoy.
//
// Por que este test NO es funcional sobre el mini: renderSidebar() vive
// dentro de un IIFE gigantic de app.js (8.000+ lineas) y no se puede ejecutar
// aislado. Lo que SI se puede ejecutar de verdad son los dos constructores
// que usa (buildMonthGrid / buildMonthLabel de data.js), y eso es lo que
// comprueba la seccion funcional: que la grilla del mes actual se arma bien.
//
// REGLA QUE SE APLICA ACA (aprendida en 824): los guards leen el archivo SIN
// los comentarios. Si no, el propio texto explicativo que escribi ("llamaban
// a changeMonth()") hace que un check que busca "no llama changeMonth" falle
// sin que haya ningun codigo culpable.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..');
const APPJS = path.join(APP, 'renderer', 'bandeja-integrada', 'app.js');
const DATAJS = path.join(APP, 'renderer', 'bandeja-integrada', 'data.js');
const src = fs.readFileSync(APPJS, 'utf8');
const data = fs.readFileSync(DATAJS, 'utf8');
const L = src.split(/\r?\n/);

const checks = [];
const ok = (n, c, e) => checks.push({ name: n, ok: !!c, extra: e });

// ── Utilidades ──
function soloCodigo(t) {
  return t
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // comentarios de bloque
    .replace(/^\s*\/\/.*$/gm, ' ')      // comentarios de linea completos
    .replace(/<!--[\s\S]*?-->/g, ' ');  // comentarios HTML dentro de templates
}
function cuerpoDe(nombre, fuente) {
  const LL = (fuente || src).split(/\r?\n/);
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

// ══ 1) El mini NO depende del mes que se está viendo ══
const miniBruto = cuerpoDe('renderSidebar');
const mini = soloCodigo(miniBruto);
ok('se logro recortar renderSidebar()', miniBruto.length > 500, miniBruto.length + ' chars');

ok('1) el mini NO dibuja la grilla con state.viewYear/state.viewMonth',
  !/buildMonthGrid\(\s*state\.viewYear/.test(mini)
  && /buildMonthGrid\(\s*miniYear\s*,\s*miniMonth\s*\)/.test(mini));

// El rotulo del mini tiene que salir de la fecha de HOY, not del estado del
// calendario grande. Ojo: state.viewMonthLabel SI aparece dentro de
// renderSidebar, pero solo en la ASIGNACION del clic del dia (que mueve el
// grande a proposito). Lo que no puede pasar es que el encabezado lo lea.
const rotuloMini = /<span class="mini__m">([^<]*)<\/span>/.exec(miniBruto);
ok('2) el rotulo del mini sale de buildMonthLabel(miniYear, miniMonth)',
  rotuloMini !== null && /buildMonthLabel\(\s*miniYear\s*,\s*miniMonth\s*\)/.test(rotuloMini[1]),
  rotuloMini ? rotuloMini[1].trim() : 'no se encontro el encabezado');
ok('2b) y el encabezado NO lee el mes del calendario grande',
  rotuloMini !== null && !/state\.viewMonthLabel/.test(rotuloMini[1]));

ok('3) el mini NO llama changeMonth() (no mueve el calendario grande)',
  !/changeMonth\(/.test(mini));

// 📦858 — Checks 4 y 5 INVERTIDOS, no borrados.
//
// 844 congeló el mini al mes real y le quitó las flechas porque compartían
// `changeMonth()` con el calendario grande: mover el mini movía el grande y al
// reventrar quedaban en meses distintos. Ese problema sigue resuelto: el mini
// de correo mueve `state.miniMes`, NO llama a `changeMonth()` (el check 3, que
// no se invirtió, sigue verde por eso).
//
// Lo que cambió es que en la pestaña CORREO el mini es un selector de día y
// necesita ir hacia atrás: de los 131 correos de la entrada, 106 no están
// cargados y la mayoría son viejos. Entonces la regla nueva es:
//
//   En Agenda → congelado al mes real, sin flechas.   (lo de 844, intacto)
//   En Correo → navegable, arrancando en el mes real. (lo de 858)
//
// Los checks miran el CÓDIGO, no una captura: que exista la rama deCorreo no
// significa que la de Agenda se haya relajado.

ok('4) 📦858-INVERTIDO: las flechas existen SOLO en la rama de Correo',
  /modoCorreo[\s\S]{0,320}mini-prev/.test(miniBruto)
  && /modoCorreo[\s\S]{0,320}mini-next/.test(miniBruto)
  // Y la condición tiene que ser la de modo correo, no un "siempre".
  && /if\s*\(\s*modoCorreo\s*\)/.test(miniBruto));

ok('4b) 📦858: el boton de mes anterior usa el icono chevronLeft que YA existe',
  /mini-prev[\s\S]{0,220}chevronLeft/.test(miniBruto));

ok('5) 📦858-INVERTIDO: en Agenda el mes sale de HOY; en Correo, de miniMes',
  /const\s+hoy\s*=\s*new Date\(\)/.test(mini)
  // La decisión vive en la función pura, NO en el render: así se puede
  // verificar sin montar la vista (y mutar sin reventar el DOM).
  && /mesDelMini\(\s*state\.calendarVisible\s*,\s*state\.miniMes\s*,\s*hoy\s*\)/.test(mini)
  && /miniYear\s*=\s*miniVisible\.y/.test(mini)
  && /miniMonth\s*=\s*miniVisible\.m/.test(mini));

ok('5b) 📦858: el mes navegable NO toca el estado del calendario grande',
  // El bug original de 844 era compartir estado. `miniMes` es propio.
  /state\.miniMes\s*=\s*mesDesplazado\(/.test(miniBruto)
  && !/miniMes[\s\S]{0,200}state\.viewMonth\s*=/.test(miniBruto));

ok('6) su template literal sigue abre y cerrando bien',
  (miniBruto.match(/mini\.innerHTML\s*=\s*`/g) || []).length === 1);

// ══ 2) El clic en un día tiene que llevar el calendario grande ══
// Por que: antes el mini replicaba el mes del grande, asi que un clic aqui
// SIEMPRE caia en un mes visible alli. Fijado el mini al mes actual esa
// garantia se pierde, y sin esto el clic se perderia en silencio.
//
// 📦845 movió esta logica de renderSidebar() a seleccionarDiaDelMini(), que
// la comparten el clic simple y el doble clic. La cobertura no desaparecio:
// se comprueba donde vive ahora.
const sel = soloCodigo(cuerpoDe('seleccionarDiaDelMini'));
ok('7) el clic en un dia fija selectedDate',
  /state\.selectedDate\s*=\s*iso/.test(sel) || /state\.selectedDate\s*=\s*iso/.test(mini));
ok('8) y ADEMAS mueve el calendario grande a ese dia',
  /state\.viewYear\s*=\s*y/.test(sel) && /state\.viewMonth\s*=\s*m/.test(sel)
  && /state\.viewMonthLabel\s*=\s*D\.buildMonthLabel\(\s*y\s*,\s*m\s*\)/.test(sel));
ok('9) el re-asignado de mes es condicional (no-op si ya estabamos ahi)',
  /if\s*\(\s*state\.viewYear\s*!==\s*y\s*\|\|\s*state\.viewMonth\s*!==\s*m\s*\)/.test(sel));
ok('9b) y el clic simple la invoca SIN cambiar de vista',
  /seleccionarDiaDelMini\(c\.iso,\s*esDoble\)/.test(mini));

// ══ 3) El calendario grande NO se tocó ══
const grande = soloCodigo(cuerpoDe('renderBigCalendar'));
ok('10) el calendario grande sigue moviendose de mes con changeMonth()',
  /changeMonth\(\s*-1\s*\)/.test(grande) && /changeMonth\(\s*1\s*\)/.test(grande));
ok('11) y su boton "Hoy" sigue intacto', /#btn-today/.test(soloCodigo(src)));
ok('12) changeMonth() NO quedo muerta (la usa el grande)',
  (soloCodigo(src).match(/changeMonth\(/g) || []).length >= 2,
  'usos=' + (soloCodigo(src).match(/changeMonth\(/g) || []).length);

// ══ 4) FUNCIONAL · los dos constructores que usa el mini ══
ok('13) data.js declara buildMonthGrid', /function\s+buildMonthGrid\s*\(/.test(data));
ok('14) data.js declara buildMonthLabel', /function\s+buildMonthLabel\s*\(/.test(data));
ok('15) y los dos se exportan en window.KairData',
  /buildMonthGrid\s*,/.test(data) && /buildMonthLabel\s*,/.test(data));

(function funcional() {
  // data.js envuelve todo en window.KairData = (function(){...})(). Se
  // ejecuta en un vm con una ventana falsa para sacarle los dos
  // constructores y comprobar que la grilla del mes actual se arma bien.
  const c = { console: { warn: () => { }, error: () => { } } };
  c.window = c;
  c.globalThis = c;
  vm.createContext(c);
  let fallo = null;
  try {
    vm.runInContext(soloCodigo(data).replace(/window\.KairData\s*=/, 'var __K ='), c);
  } catch (e) { fallo = e.message; }
  if (fallo) { ok('16) data.js se pudo ejecutar para la prueba funcional', false, fallo); return; }
  const K = c.__K;
  ok('16) data.js se pudo ejecutar para la prueba funcional', !!(K && K.buildMonthGrid));

  if (!K) return;
  const hoy = new Date();
  const y = hoy.getFullYear(), m = hoy.getMonth();

  const r = K.buildMonthLabel(y, m);
  ok('17) buildMonthLabel(mes actual) devuelve el nombre del mes y el anio',
    typeof r === 'string' && r.indexOf(String(y)) !== -1, JSON.stringify(r));

  const grid = K.buildMonthGrid(y, m);
  const plano = grid.flat();
  const diasDelMes = new Date(y, m + 1, 0).getDate();
  const enMes = plano.filter(c2 => c2.inMonth);
  ok('18) la grilla del mes actual tiene los dias correctos',
    enMes.length === diasDelMes, enMes.length + ' dias, se esperaban ' + diasDelMes);
  ok('19) y todos los dias del mes actual estan ahi',
    enMes.every(c2 => c2.day >= 1 && c2.day <= diasDelMes));
  ok('20) la grilla trae puntitos de mes listo (multiplos de 7)',
    plano.length % 7 === 0, plano.length + ' celdas');
  ok('21) y marca hoy como hoy',
    plano.some(c2 => c2.isToday), '');
  // El dia de hoy tiene que ser hoy de verdad, no un dia cualquiera.
  const hoyIso = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
  ok('22) el dia marcado como hoy es el dia de hoy',
    plano.some(c2 => c2.isToday && c2.iso === hoyIso), hoyIso);
})();

// ══ 5) Higiene ══
let netas = 0;
for (const c of src) { if (c === '{') netas++; else if (c === '}') netas--; }
ok('23) las llaves de app.js balancean', netas === 0, 'netas=' + netas);
const cjk = (src.match(/[\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff\uac00-\ud7af]/g) || []).length;
ok('24) sin CJK/mojibake en app.js', cjk === 0, 'CJK=' + cjk);

let failed = 0;
console.log('\n=======================================');
console.log('  📦844 · El mini-calendar queda en el mes actual');
console.log('=======================================');
checks.forEach(ch => {
  if (!ch.ok) failed++;
  console.log((ch.ok ? 'OK  ' : 'FAIL') + '  ' + ch.name + (ch.extra ? '  [' + ch.extra + ']' : ''));
});
console.log('---');
console.log((checks.length - failed) + '/' + checks.length + ' OK');
console.log('=======================================');
process.exit(failed === 0 ? 0 : 1);
