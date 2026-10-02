'use strict';
// 📦829-fix · El panel de pendientes contaba cada tab sobre una lista distinta.
//
// Lo que se veía con un módulo filtrado:
//     Todos 4 · Críticos 7 · Hoy 0
//     "Filtrando por Gestión Integral · 4 punto(s) por gestionar."
//
// Y al pulsar "Críticos" se perdía el filtro: salían las críticas de los otros
// módulos con el encabezado diciendo que seguías filtrado por Gestión Integral.
//
// Parte COMPORTAMENTAL: se ejecuta tareasDelFiltroActual() real, con datos
// falsos, y se mira qué lista devuelve. Un guard estático no alcanza acá,
// porque el bug era que cada call site USABA una lista distinta.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..');
const RENDERER = path.join(APP, 'renderer.js');
const txt = fs.readFileSync(RENDERER, 'utf8');

// ── Recortar la función contando llaves ──
function metodoDe(t, nombre) {
  const i = t.indexOf(nombre + '(');
  if (i < 0) return null;
  let nivel = 0, fin = -1, abierto = false;
  for (let k = t.indexOf('{', i); k < t.length; k++) {
    if (t[k] === '{') { nivel++; abierto = true; }
    else if (t[k] === '}') { nivel--; if (abierto && nivel === 0) { fin = k; break; } }
  }
  return abierto ? t.slice(i, fin + 1) : null;
}

// El mapa + las dos variables + la función, tal cual están en el archivo.
const iMap = txt.indexOf('const MODULE_TASK_MAP = {');
const iFinMap = txt.indexOf('};', iMap) + 2;
const cuerpoMapa = txt.slice(iMap, iFinMap);
const cuerpoFn = metodoDe(txt, 'function tareasDelFiltroActual');
if (iMap < 0 || !cuerpoFn) {
  console.error('no se encontró MODULE_TASK_MAP o tareasDelFiltroActual()');
  process.exit(1);
}

const caja = {};
vm.createContext(caja);
vm.runInContext(
  'var currentDashboardData = null;\n' +
  'var currentFilterModule = null;\n' +
  cuerpoMapa + '\n' +
  cuerpoFn + '\n' +
  'this.leer = tareasDelFiltroActual;',
  caja
);
const leer = caja.leer;

const checks = [];
const ok = (n, c, e) => checks.push({ name: n, ok: !!c, extra: e });

// ── Datos de prueba ──
// 4 de Gestión Integral (2 críticas) + 5 de otros módulos (5 críticas).
const TAREAS = [
  { title: 'GI politica', module: 'politica', priority: 'warning' },
  { title: 'GI plan', module: 'plan-trabajo', priority: 'warning' },
  { title: 'GI objetivos', module: 'objetivos', priority: 'critical' },
  { title: 'GI evaluacion', module: 'evaluacion-inicial', priority: 'critical' },
  { title: 'REC cap', module: 'capacitaciones', priority: 'critical' },
  { title: 'REC epp', module: 'epp', priority: 'critical' },
  { title: 'REC presupuesto', module: 'presupuesto', priority: 'critical' },
  { title: 'SAL ausentismo', module: 'ausentismo', priority: 'critical' },
  { title: 'PEL iperc', module: 'iperc', priority: 'critical' }
];
const criticas = (l) => l.filter(t => (t.priority || '').toLowerCase() === 'critical').length;

function correr(modulo) {
  caja.currentDashboardData = { tasks: TAREAS };
  caja.currentFilterModule = modulo;
  return leer();
}

// ── 1) Sin filtro: todo ──
const todas = correr(null);
ok('1) sin filtro devuelve todas las tareas', todas.length === 9, 'largo=' + todas.length);

// ── 2) Con filtro de módulo ──
const gi = correr('Gestión Integral');
ok('2) con Gestión Integral devuelve solo las suyas', gi.length === 4, 'largo=' + gi.length);
ok('2) y ninguna es de otro módulo',
  gi.every(t => ['politica', 'plan-trabajo', 'objetivos', 'evaluacion-inicial', 'rendicion', 'cambio'].indexOf(t.module) !== -1));
ok('2) sus críticas son 2, no las 5 del sistema', criticas(gi) === 2, 'criticas=' + criticas(gi));

// ── 3) El caso exacto de la captura ──
// Lo que se pintaba: "Todos 4" (filtrado) junto a "Críticos 7" (global).
// Los tres contadores tienen que salir de la misma lista.
const nTodos = gi.length;
const nCriticos = criticas(gi);
ok('3) "Todos" y "Críticos" ya no pueden discrepar',
  nCriticos <= nTodos && nTodos === 4 && nCriticos === 2,
  'Todos=' + nTodos + ' Criticos=' + nCriticos + ' (antes: 4 vs 7)');

// ── 4) El tab "Críticos" ya no pierde el filtro ──
// Es lo que hacía el manejador del seg: partía de la lista GLOBAL.
const criticasFiltradas = gi.filter(t => (t.priority || '').toLowerCase() === 'critical');
ok('4) el tab "Críticos" con filtro activo NO trae tareas de otros módulos',
  criticasFiltradas.every(t => t.title.indexOf('GI ') === 0),
  criticasFiltradas.map(t => t.title).join(', '));

// ── 5) Los otros módulos siguen filtrando bien ──
ok('5) Recursos devuelve 3', correr('Recursos').length === 3);
ok('5) Salud devuelve 1', correr('Gestión de la Salud').length === 1);
ok('5) Peligros devuelve 1', correr('Peligros').length === 1);
ok('5) un módulo que nadie empuja devuelve 0 (no crashea)', correr('Amenazas').length === 0);
ok('5) un nombre de módulo inventado devuelve 0', correr('No Existe').length === 0);

// ── 6) No crashea con datos raros ──
ok('6) aguanta sin datos, sin tareas y con module indefinido',
  (function () {
    try {
      caja.currentDashboardData = null; caja.currentFilterModule = 'Gestión Integral';
      if (leer().length !== 0) return false;
      caja.currentDashboardData = { tasks: [] }; caja.currentFilterModule = null;
      if (leer().length !== 0) return false;
      caja.currentDashboardData = { tasks: [{ title: 'sin module', priority: 'critical' }] };
      caja.currentFilterModule = 'Gestión Integral';
      if (leer().length !== 0) return false;
      caja.currentFilterModule = null;
      return leer().length === 1;
    } catch (e) { console.error('    lanzo: ' + e.message); return false; }
  })());

// ── 7) Guards estáticos: que NADIE vuelva a armar su propia lista ──
// OJO: los guards buscan sobre el archivo SIN comentarios. Una guarda que lee
// el crudo se casa con el texto de los comentarios, y un comentario que
// documenta el código viejo pone la guarda en verde con el bug puesto.
function soloCodigo(t) {
  return t.split(/\r?\n/).filter(l => l.trim().indexOf('//') !== 0).join('\n');
}
const codigo = soloCodigo(txt);

ok('7) updateFilterUI cuenta los tres sobre tareasDelFiltroActual()',
  /const all = tareasDelFiltroActual\(\);/.test(codigo) &&
  /nT\.textContent = all\.length/.test(codigo) &&
  /nC\.textContent = crit/.test(codigo) &&
  /nH\.textContent = hoy/.test(codigo));
ok('7) y el encabezado también cuenta sobre esa lista (no sobre un número suelto)',
  /'Filtrando por ' \+ moduleName \+ ' · ' \+ all\.length \+ ' punto\(s\) por gestionar\.'/.test(codigo));
ok('7) el manejador del tab parte de la lista filtrada',
  /var list = tareasDelFiltroActual\(\);/.test(codigo));
ok('7) el filtro por módulo también usa la fuente única',
  /const filteredTasks = tareasDelFiltroActual\(\);/.test(codigo));
ok('7) ya no queda una copia local del mapa dentro del filtro',
  metodoDe(txt, 'function filterDashboardTasksByModule').indexOf('MODULE_TASK_MAP') === -1);
ok('7) y el parámetro muerto taskCount ya no está',
  codigo.indexOf('function updateFilterUI(moduleName, taskCount)') === -1 &&
  codigo.indexOf('taskCount') === -1);

let failed = 0;
console.log('\n=======================================');
console.log('  📦829-fix · Los 3 tabs cuentan lo mismo');
console.log('=======================================');
checks.forEach(c => {
  if (!c.ok) failed++;
  console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
});
console.log('---');
console.log((checks.length - failed) + '/' + checks.length + ' OK');
console.log('=======================================');
process.exit(failed === 0 ? 0 : 1);
