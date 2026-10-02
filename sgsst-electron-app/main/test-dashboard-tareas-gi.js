// =====================================================================
// 📦829 · Gestión Integral reporta pendientes al dashboard de verdad
//
// El bug que este test evita: un submódulo calcula un número, el mapa del
// dashboard no lo conoce, y la tarea nunca se muestra. No da error: el panel
// simplemente dice "0 punto(s) por gestionar" y la tarjeta dice "OK". Así
// pasó con los 13 submódulos de Gestión Integral y nadie lo notaba.
//
// Las guardas:
//   1) Toda etiqueta `module:` que empuja getDashboardAlertas está en el
//      moduleTaskMap (si no, la tarjeta del módulo no la muestra nunca).
//   2) Toda etiqueta está en el moduleMap de navigateToModule (si no, la tarea
//      se ve pero el clic pide un módulo que no existe).
//   3) El `submodule:` de cada tarea de GI existe en el maestro, y su código
//      resuelve a un submódulo real.
//   4) module_status["gestion-integral"] se CALCULA (antes estaba fijo en "ok").
//   5) El KPI gestion_integral_alerts existe y llega hasta el badge.
//   6) El "En tu radar" del home y el dashboard evalúan las MISMAS señales.
//      Son dos listas distintas que antes se contradecían (el home decía 2
//      pendientes y el Inicio 0 con el mismo filtro).
//
// Uso (los tests funcionales se corren con Electron, no con node):
//   $env:ELECTRON_RUN_AS_NODE="1"
//   .\node_modules\electron\dist\electron.exe main\test-dashboard-tareas-gi.js
// =====================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..');
const leer = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };

const checks = [];
const ok = (n, c, e) => checks.push({ name: n, ok: !!c, extra: e });

const mainJs = leer(path.join(APP, 'main.js'));
const renderer = leer(path.join(APP, 'renderer.js'));
const home = leer(path.join(APP, 'modules', 'gestion-integral', 'gestion-integral-home.js'));

// ── El maestro ──
const maestro = {};
{
  const bloque = (renderer.split('const ALL_SUBMODULES')[1] || '').split('};')[0];
  const re = /"([^"]+)":\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = re.exec(bloque))) {
    maestro[m[1]] = (m[2].match(/"[^"]+"/g) || []).map(s => s.replace(/"/g, ''));
  }
}
const codigosGI = new Set();
(maestro['Gestión Integral'] || []).forEach(s => { const c = s.match(/^(\d+(?:\.\d+)+)/); if (c) codigosGI.add(c[1]); });
ok('0) se pudo leer el maestro de Gestión Integral', codigosGI.size === 13, codigosGI.size + ' submódulos');

// ── Las tareas que empuja getDashboardAlertas ──
const tareas = [];
{
  // Las de Gestión Integral pasan por el helper `_giPush`; las de Recursos por
  // `tasks.push`. Si solo se mira una, el test no ve la mitad de las tareas.
  const re = /(?:tasks\.push|_giPush)\(\{([\s\S]*?)\n\s*\}\);/g;
  let m;
  while ((m = re.exec(mainJs))) {
    const b = m[1];
    const mod = (b.match(/module:\s*['"]([\w-]+)['"]/) || [])[1];
    if (mod) {
      tareas.push({
        module: mod,
        submodule: (b.match(/submodule:\s*['"]([^'"]*)['"]/) || [])[1] || '',
        priority: (b.match(/priority:\s*['"]([\w-]+)['"]/) || [])[1] || ''
      });
    }
  }
}
ok('0) se encontraron las tareas del dashboard', tareas.length >= 20, tareas.length + ' tareas');

// ══ 1) Toda etiqueta conocida por el filtro de tarjetas ══
const mapaFiltro = {};
{
  const blk = renderer.split('const moduleTaskMap')[1] || '';
  const re = /'([^']+)':\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(blk))) {
    mapaFiltro[m[1]] = (m[2].match(/'[\w-]+'/g) || []).map(s => s.replace(/'/g, ''));
  }
}
const tiposConocidos = new Set();
Object.keys(mapaFiltro).forEach(k => mapaFiltro[k].forEach(t => tiposConocidos.add(t)));
const huerfanos = tareas.filter(t => !tiposConocidos.has(t.module));
ok('1) TODA etiqueta module: de una tarea existe en algún moduleTaskMap',
  huerfanos.length === 0,
  huerfanos.length
    ? huerfanos.map(t => t.module + ' ("' + t.submodule + '")').join(' | ')
    : tareas.length + ' etiquetas todas conocidas');

// paso con los 13 submodulos de Gestion Integral y nadie lo notaba.
const mapaNav = {};
{
  const blk = renderer.split('const moduleMap = {')[1] || '';
  const re = /'([\w-]+)':\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(blk))) mapaNav[m[1]] = m[2];
}
const sinNav = [...new Set(tareas.map(t => t.module))].filter(t => !mapaNav[t]);
ok('2) TODA etiqueta module: sabe a qué módulo navega el clic',
  sinNav.length === 0,
  sinNav.length ? 'sin entrada en moduleMap: ' + sinNav.join(', ') : Object.keys(mapaNav).length + ' entradas');

// ══ 3) Los submódulos de GI existen y su código resuelve ══
const tareasGI = tareas.filter(t => ['politica', 'objetivos', 'evaluacion-inicial', 'plan-trabajo', 'rendicion', 'cambio'].indexOf(t.module) !== -1);
ok('3) Gestión Integral empuja al menos 5 tareas', tareasGI.length >= 5, tareasGI.length + ' tareas');
const subInvalidos = tareasGI.filter(t => {
  const c = (t.submodule.match(/^(\d+(?:\.\d+)+)/) || [])[1];
  return !c || !codigosGI.has(c);
});
ok('3) el submodule: de cada tarea de GI existe en el maestro',
  subInvalidos.length === 0,
  subInvalidos.length ? subInvalidos.map(t => t.submodule).join(' | ') : tareasGI.map(t => t.submodule.split(' ')[0]).join(', '));

// ══ 4) module_status de GI se calcula ══
ok('4) module_status["gestion-integral"] se CALCULA (antes quedaba fijo en "ok")',
  /module_status\["gestion-integral"\]\s*=/.test(mainJs) &&
  /giCriticas\s*>\s*0\s*\?\s*"danger"/.test(mainJs),
  'danger si hay críticas, warning si hay pendientes, ok si no hay nada');
ok('4) el cálculo depende de tareas realmente empujadas, no de un número fijo',
  /_giPush/.test(mainJs) && /giPendientes\+\+/.test(mainJs) && /giCriticas\+\+/.test(mainJs));

// ══ 5) el KPI llega al badge ══
ok('5) existe el KPI gestion_integral_alerts en la estructura de salida',
  /gestion_integral_alerts:\s*0/.test(mainJs) &&
  /kpis\.gestion_integral_alerts\s*=/.test(mainJs));
ok('5) updateModuleBadges recibe y usa ese KPI',
  /gestionIntegralAlerts\s*=\s*0/.test(renderer) &&
  /gestion-integral'\s*&&\s*gestionIntegralAlerts\s*>\s*0/.test(renderer) &&
  /data\.kpis\?\.gestion_integral_alerts/.test(renderer));

// ══ 6) el home y el dashboard miran las mismas señales ══
function senalesDe(txt) {
  const set = new Set();
  const re = /submodule:\s*'([\d.]+)|stats\.(\w+)|gi(\w+)\.(\w+)/g;
  // los codigos de submódulo del bloque de main
  (txt.match(/submodule:\s*'(\d+(?:\.\d+)+)/g) || []).forEach(s => set.add(s.match(/'(\d+(?:\.\d+)+)/)[1]));
  return set;
}
const codigosMain = senalesDe(mainJs.split('📦829 · GESTIÓN INTEGRAL')[1] || '');
// Ojo: indexOf('buildRadarTasks()') cae en la LLAMADA, no en la definición.
// Se recorta el método contando llaves.
function metodoDe(txt, nombre) {
  const i = txt.indexOf(nombre + '() {');
  if (i < 0) return '';
  let nivel = 0, Airl = -1;
  for (let k = txt.indexOf('{', i); k < txt.length; k++) {
    if (txt[k] === '{') nivel++;
    else if (txt[k] === '}') { nivel--; if (nivel === 0) { Airl = k; break; } }
  }
  return txt.slice(i, Airl + 1);
}
const txtHome = metodoDe(home, 'buildRadarTasks');
const codigosHome = new Set();
{
  // el home no usa `submodule:`; usa `title:`. Se mapea por los titulos.
  const titulos = {
    'Política del SG-SST': '2.1.1',
    'Objetivos SST': '2.2.1',
    'Evaluación inicial': '2.3.1',
    'Plan de Trabajo': '2.4.1',
    'Rendición de cuentas': '2.6.1',
    'Gestión del Cambio': '2.11.1'
  };
  Object.keys(titulos).forEach(t => { if (txtHome.indexOf("title: '" + t + "'") !== -1) codigosHome.add(titulos[t]); });
}
const soloMain = [...codigosMain].filter(c => !codigosHome.has(c));
const soloHome = [...codigosHome].filter(c => !codigosMain.has(c));
ok('6) el "En tu radar" del home evalúa las mismas señales que el dashboard',
  codigosMain.size >= 5 && soloMain.length === 0 && soloHome.length === 0,
  'main=[' + [...codigosMain].sort().join(' ') + '] home=[' + [...codigosHome].sort().join(' ') + ']' +
  (soloMain.length ? ' SOLO EN MAIN: ' + soloMain.join(',') : '') +
  (soloHome.length ? ' SOLO EN HOME: ' + soloHome.join(',') : ''));
ok('6) el home ordena por severidad y avisa si no caben todas',
  /tareas\.sort/.test(txtHome) && /pendiente\(s\) más en el panel de Inicio/.test(txtHome));

// ══ Resultado ══
let failed = 0;
console.log('\n=======================================');
console.log('  📦829 · Gestión Integral en el dashboard');
console.log('=======================================');
checks.forEach(c => {
  if (!c.ok) failed++;
  console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
});
console.log('---');
console.log((checks.length - failed) + '/' + checks.length + ' OK');
console.log('=======================================');
process.exit(failed === 0 ? 0 : 1);
