'use strict';
// 📦829-fix2 · Lo que mostró la captura: el encabezado decía
//     "Filtrando por Gestión Integral · 4 punto(s) por gestionar."
// y debajo había 24 tarjetas de Recursos, 5 de ellas "Crítico".
//
// Dos causas distintas:
//
// A) filterDashboardTasksByModule() llamaba tareasDelFiltroActual() ANTES de
//    asignar currentFilterModule. Como la función lee esa variable, el PRIMER
//    clic devolvía todo. El segundo sí filtraba -> bug intermitente, y por eso
//    los tests anteriores no lo veían: el encabezado y los contadores se
//    calculan DESPUÉS de la asignación, así que siempre salían bien.
//
// B) El sort de main.js usaba (priority_map[p] || 3) y el peso de 'critical'
//    es 0. En JavaScript 0 es FALSO, así que `0 || 3` daba 3 y los críticos
//    quedaban al final de la lista.
//
// Las dos partes son COMPORTAMENTALES: se ejecuta el código real con stubs de
// DOM y se mira qué lista recibe cada función.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..');
const RENDERER = path.join(APP, 'renderer.js');
const MAIN = path.join(APP, 'main.js');
const txtR = fs.readFileSync(RENDERER, 'utf8');
const txtM = fs.readFileSync(MAIN, 'utf8');

// ── Recortar un método contando llaves (contexto 'function' o 'async function') ──
function recorte(t, marcador) {
  const i = t.indexOf(marcador);
  if (i < 0) return null;
  let nivel = 0, fin = -1, abierto = false;
  for (let k = t.indexOf('{', i); k < t.length; k++) {
    if (t[k] === '{') { nivel++; abierto = true; }
    else if (t[k] === '}') { nivel--; if (abierto && nivel === 0) { fin = k; break; } }
  }
  return abierto ? t.slice(i, fin + 1) : null;
}

// ── Quitar los comentarios de línea completa antes de buscar código ──
// Una guarda que usa indexOf sobre el archivo crudo se casa con el TEXTO de
// los comentarios: al documentar "esto era (priority_map[a.priority] || 3)"
// el guard se ponía verde con el bug puesto. Este repo comenta en línea
// completa, así que filtrar esas líneas alcanza.
function soloCodigo(t) {
  return t.split(/\r?\n/).filter(l => l.trim().indexOf('//') !== 0).join('\n');
}
const codigoR = soloCodigo(txtR);
const codigoM = soloCodigo(txtM);

const checks = [];
const ok = (n, c, e) => checks.push({ name: n, ok: !!c, extra: e });

// ══ A) El clic en la tarjeta de un módulo ══
// Tareas reales de la captura: 24 en total, 6 de Gestión Integral, 18 de Recursos.
const TAREAS = [
  { t: 'GI politica', module: 'politica', priority: 'warning' },
  { t: 'GI objetivos', module: 'objetivos', priority: 'critical' },
  { t: 'GI evaluacion', module: 'evaluacion-inicial', priority: 'critical' },
  { t: 'GI plan', module: 'plan-trabajo', priority: 'warning' },
  { t: 'GI rendicion', module: 'rendicion', priority: 'warning' },
  { t: 'GI cambio', module: 'cambio', priority: 'info' },
  { t: 'REC cap vencida', module: 'capacitaciones', priority: 'critical' },
  { t: 'REC epp', module: 'epp', priority: 'critical' },
  { t: 'REC copasst reunion', module: 'copasst', priority: 'critical' },
  { t: 'REC copasst acta', module: 'copasst', priority: 'critical' },
  { t: 'REC comite acta', module: 'comite_convivencia', priority: 'critical' },
  { t: 'REC comite reunion', module: 'comite_convivencia', priority: 'critical' },
  { t: 'REC afiliacion', module: 'afiliacion', priority: 'critical' },
  { t: 'REC presupuesto', module: 'presupuesto', priority: 'warning' },
  { t: 'REC copasst periodo', module: 'copasst', priority: 'warning' },
  { t: 'REC inducciones', module: 'inducciones', priority: 'info' }
];

const cuerpoMapa = (function () {
  const i = txtR.indexOf('const MODULE_TASK_MAP = {');
  return txtR.slice(i, txtR.indexOf('};', i) + 2);
})();
const cuerpoFiltro = recorte(txtR, 'function tareasDelFiltroActual');
const cuerpoClic = recorte(txtR, 'function filterDashboardTasksByModule');
if (!cuerpoMapa || !cuerpoFiltro || !cuerpoClic) {
  console.error('no se encontraron las funciones en renderer.js');
  process.exit(1);
}

function armarClic(modulo) {
  const pintadas = [];
  const encabezado = [];
  const c = {};
  vm.createContext(c);
  vm.runInContext(
    'var currentDashboardData = { tasks: ' + JSON.stringify(TAREAS) + ' };\n' +
    'var currentFilterModule = null;\n' +
    cuerpoMapa + '\n' + cuerpoFiltro + '\n' +
    // Stubs: solo nos interesa QUÉ lista llega a renderTasks, no el DOM.
    'function updateFilterUI(m) { this_encabezado.push(m); }\n' +
    'function updateModuleSelection(m) {}\n' +
    'function renderTasks(l) { this_pintadas.push(l); }\n' +
    'var this_encabezado = [];\n' +
    'var this_pintadas = [];\n' +
    cuerpoClic + '\n' +
    'this.pintadas = this_pintadas;\n' +
    'this.encabezado = this_encabezado;\n' +
    'this.leer = tareasDelFiltroActual;\n' +
    'this.clicar = filterDashboardTasksByModule;\n',
    c
  );
  return c;
}

// El 1er clic en "Gestión Integral" tiene que dar 6, NO las 16.
// OJO: el stub acumula una entrada POR CADA llamada a renderTasks, así que la
// lista pintada es el primer elemento, no el array de llamadas.
const c1 = armarClic();
c1.clicar('Gestión Integral');
const pintadas1 = c1.pintadas[0] || [];
ok('A1) el PRIMER clic en un módulo ya filtra (antes devolvía TODAS)',
  pintadas1.length === 6 && pintadas1.every(t => t.t.indexOf('GI ') === 0),
  'pintadas=' + pintadas1.length + ' (se esperaban 6)');
ok('A1) ninguna de las pintadas es de otro módulo',
  pintadas1.every(t => t.module.indexOf('capacitaciones') === -1));

// Y un segundo módulo distinto, para que no sea un caso de suerte.
const c2 = armarClic();
c2.clicar('Recursos');
const pintadas2 = c2.pintadas[0] || [];
ok('A1) y con Recursos también filtra bien (10 tareas)',
  pintadas2.length === 10 && pintadas2.every(t => t.t.indexOf('GI ') !== 0),
  'pintadas=' + pintadas2.length);

// El encabezado que recibe updateFilterUI es el módulo que se pidió.
ok('A1) el encabezado recibe el módulo pulsado', c1.encabezado[0] === 'Gestión Integral');

// Y ahora la lectura directa, que es lo que usan los tabs y los contadores.
const leer = c1.leer;
c1.currentFilterModule = 'Gestión Integral';
ok('A1) leer con filtro de Gestión Integral devuelve 6', leer().length === 6, 'largo=' + leer().length);

// ══ B) El orden de las tarjetas ══
// Se extrae el peso real del sort de main.js y se le pide que ordene.
const cuerpoPeso = (function () {
  const i = txtM.indexOf('const pesoPrioridad = (t) => {');
  if (i < 0) return null;
  return txtM.slice(i, txtM.indexOf('};', i) + 2);
})();
ok('B1) el sort usa un peso que respeta el 0 de critical',
  cuerpoPeso !== null &&
  /return p === undefined \? 3 : p;/.test(cuerpoPeso),
  cuerpoPeso ? 'pesoPrioridad encontrado' : 'NO se encontró pesoPrioridad');

if (cuerpoPeso) {
  // El mapa se LEE de main.js, no se copia acá. Con una copia fija el test
  // daba verde aunque alguien cambiara el peso de 'critical' en el código.
  const mMap = /const priority_map = (\{[^;]*\});/.exec(codigoM);
  if (!mMap) {
    ok('B1) se encontró el priority_map real de main.js', false, 'no se pudo leer');
  }
  const priority_map = mMap ? mMap[1] : "{} 'critical': 0, 'warning': 1, 'info': 2 }";
  const cb = {};
  vm.createContext(cb);
  vm.runInContext(
    'const priority_map = ' + priority_map + ';\n' + cuerpoPeso + '\n' +
    'this.peso = pesoPrioridad;\n' +
    'this.ordenar = (arr) => arr.slice().sort((a, b) => pesoPrioridad(a) - pesoPrioridad(b));',
    cb
  );
  ok('B1) critical pesa 0 (no 3)', cb.peso({ priority: 'critical' }) === 0,
    'peso=' + cb.peso({ priority: 'critical' }));
  ok('B1) warning pesa 1 e info pesa 2',
    cb.peso({ priority: 'warning' }) === 1 && cb.peso({ priority: 'info' }) === 2);
  ok('B1) una prioridad desconocida pesa 3 (al final, no explota)',
    cb.peso({ priority: 'raro' }) === 3 && cb.peso({}) === 3);

  const orden = cb.ordenar([
    { t: 'info', priority: 'info' },
    { t: 'critico', priority: 'critical' },
    { t: 'warning', priority: 'warning' },
    { t: 'raro', priority: 'raro' },
    { t: 'critico2', priority: 'critical' }
  ]).map(x => x.t);
  ok('B1) los críticos van PRIMERO, no de últimos',
    orden[0] === 'critico' && orden[1] === 'critico2',
    orden.join(' > '));
  ok('B1) el orden completo es critico > warning > info > desconocido',
    orden.join(',') === 'critico,critico2,warning,info,raro',
    orden.join(' > '));
}

// ── Guarda estática: el orden de las dos líneas en renderer.js ──
const iFilter = codigoR.indexOf('function filterDashboardTasksByModule');
const iAsigna = codigoR.indexOf('currentFilterModule = moduleName;', iFilter);
// Se busca la DECLARACIÓN, no cualquier mención: el comentario de arriba
// nombra la función y aparecía antes que la llamada real.
const iLee = codigoR.indexOf('const filteredTasks = tareasDelFiltroActual();', iFilter);
ok('A2) en el filtro, la asignación va ANTES de la lectura',
  iAsigna > 0 && iLee > 0 && iAsigna < iLee,
  iAsigna >= 0 && iLee >= 0 ? 'asigna@' + iAsigna + ' lee@' + iLee : 'no se encontraron');
ok('A2) y no queda un `|| 3` que se coma el cero de critical',
  codigoM.indexOf('(priority_map[a.priority] || 3)') === -1 &&
  codigoM.indexOf('(priority_map[b.priority] || 3)') === -1 &&
  /dashboard_data\.tasks\.sort\(\(a, b\) => pesoPrioridad\(a\) - pesoPrioridad\(b\)\)/.test(codigoM));

let failed = 0;
console.log('\n=======================================');
console.log('  📦829-fix2 · El primer clic y el orden');
console.log('=======================================');
checks.forEach(c => {
  if (!c.ok) failed++;
  console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
});
console.log('---');
console.log((checks.length - failed) + '/' + checks.length + ' OK');
console.log('=======================================');
process.exit(failed === 0 ? 0 : 1);
