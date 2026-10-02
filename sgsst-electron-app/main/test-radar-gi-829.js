'use strict';
// 📦829 · Parte COMPORTAMENTAL: ejecuta el buildRadarTasks() real del home con
// estadísticas falsas y mira qué HTML produce. El resto del test es estático
// (revisa que el cableado esté); esto prueba que la lógica hace lo que dice.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..');
const HOME = path.join(path.join(APP, 'modules', 'gestion-integral', 'gestion-integral-home.js'));

// ── Recortar el método contando llaves ──
function metodoDe(txt, nombre) {
  const i = txt.indexOf(nombre + '() {');
  if (i < 0) return null;
  let nivel = 0, fin = -1;
  for (let k = txt.indexOf('{', i); k < txt.length; k++) {
    if (txt[k] === '{') nivel++;
    else if (txt[k] === '}') { nivel--; if (nivel === 0) { fin = k; break; } }
  }
  return txt.slice(i, fin + 1);
}
const metodo = metodoDe(fs.readFileSync(HOME, 'utf8'), 'buildRadarTasks');
if (!metodo) { console.error('no se encontró buildRadarTasks()'); process.exit(1); }

// El texto es `buildRadarTasks() { ... }`: como literal de objeto es válido
// (shorthand de método), así que se puede ejecutar de verdad.
const caja = {};
vm.createContext(caja);
const radar = vm.runInContext('({' + metodo + '}).buildRadarTasks', caja);
if (typeof radar !== 'function') { console.error('no se pudo obtener la función'); process.exit(1); }

const checks = [];
const ok = (n, c, e) => checks.push({ name: n, ok: !!c, extra: e });
const correr = (stats) => radar.call({ gestionIntegralStats: stats });
const cuenta = (html, re) => (html.match(re) || []).length;

// ── 1) Sin nada pendiente ──
const vacio = correr({});
ok('1) sin datos muestra el estado tranquilo, no un panel vacío',
  vacio.indexOf('Sistema estable') !== -1 && vacio.indexOf('Sin alertas pendientes') !== -1);
ok('1) y NO inventa pendientes cuando las estadísticas vienen en cero',
  vacio.indexOf('sin cumplir') === -1 && vacio.indexOf('hallazgos críticos') === -1 &&
  vacio.indexOf('actividades pendientes') === -1);

// ── 2) Con las SEIS señales prendidas ──
// OJO: el radar muestra 3 por diseño y avisa cuántas quedan. Por eso NO se
// pueden buscar los seis títulos en el HTML. Se prueban de dos formas: que
// las tres que salen sean las correctas, y que CADA señal se encienda sola
// con sus números (si una no existiera, su prueba aislada no la encontraría).
const SEIS = {
  politica: { actualizada: false },
  objetivos: { total: 15, cumplidos: 7, porcentaje: 47 },
  evaluacion_inicial: { combinado: { hallazgosCriticos: 3, cumplimiento: 55, totalHallazgos: 12 } },
  plan_trabajo: { actividadesPendientes: 68, porcentajeAvance: 36 },
  rendicion_cuentas: { disponible: true, actas_realizadas: 0 },
  cambios: { pending: 4, total: 9 }
};
// [clave, título, texto que debe llevar] — el número que el usuario lee.
const AISLADAS = [
  ['politica', 'Política del SG-SST', 'Pendiente de actualización'],
  ['objetivos', 'Objetivos SST', '8 de 15 sin cumplir'],
  ['evaluacion_inicial', 'Evaluación inicial', '3 hallazgos críticos'],
  ['plan_trabajo', 'Plan de Trabajo', '68 actividades pendientes'],
  ['rendicion_cuentas', 'Rendición de cuentas', 'Aún no hay actas registradas'],
  ['cambios', 'Gestión del Cambio', '4 solicitudes en pipeline']
];

const todo = correr(SEIS);
ok('2) el radar muestra 3 y avisa cuántas quedan (nunca corta en silencio)',
  cuenta(todo, /class="kair-task"/g) === 4 &&   // 3 tareas + la linea de "N mas"
  /3 pendiente\(s\) más en el panel de Inicio/.test(todo),
  'tarjetas=' + cuenta(todo, /class="kair-task"/g));
// Las tres que tienen que verse: las dos criticas y, de largo, la primera.
ok('2) con 2 críticas, la pantalla muestra las dos y no deja fuera la primera',
  todo.indexOf('Objetivos SST') !== -1 && todo.indexOf('Evaluación inicial') !== -1 &&
  todo.indexOf('Política del SG-SST') !== -1);
ok('2) los números de las visibles van en el texto',
  todo.indexOf('8 de 15 sin cumplir') !== -1 &&
  todo.indexOf('3 hallazgos críticos') !== -1);
// Y ahora cada señal por separado, con su número: así las seis quedan probadas
// aunque el radar solo muestre tres.
AISLADAS.forEach(a => {
  const h = correr({ [a[0]]: SEIS[a[0]] });
  ok('2) la señal "' + a[0] + '" se enciende sola, con su número',
    h.indexOf(a[1]) !== -1 && h.indexOf(a[2]) !== -1,
    h.indexOf(a[1]) === -1 ? 'no apareció' : 'ok: ' + a[2]);
});

// ── 3) La crítica se ve sí o sí ──
// El radar solo muestra 3 tarjetas: si una crítica no llega al top, el usuario
// NUNCA la ve. Por eso se comprueba que la PRIMERA tarjeta sea la crítica.
// (Comparar "apareció antes que otra" no sirve: si la otra queda de última, la
// comparación da verdadera igual con el sort roto: se me coló ese error acá.)
function primeraTarjeta(html) {
  const m = /<strong>([^<]+)<\/strong>/.exec(html);
  return m ? m[1] : '';
}
const conCritica = correr({
  politica: { actualizada: false },
  rendicion_cuentas: { disponible: true, actas_realizadas: 0 },
  evaluacion_inicial: { combinado: { hallazgosCriticos: 2, cumplimiento: 40, totalHallazgos: 8 } }
});
ok('3) la crítica es la PRIMERA tarjeta, no la tercera',
  primeraTarjeta(conCritica) === 'Evaluación inicial',
  'primera=' + primeraTarjeta(conCritica));
ok('3) con las seis señales prendidas, la crítica tampoco se cae de la pantalla',
  primeraTarjeta(todo) === 'Objetivos SST',
  'primera=' + primeraTarjeta(todo));
ok('3) la crítica se marca como tal, no como "Pendiente" genérico',
  conCritica.indexOf('kair-status-pill--danger') !== -1 &&
  conCritica.indexOf('>Crítico<') !== -1);

// ── 4) Criterios que NO deben disparar señal ──
const sinCriticos = correr({
  objetivos: { total: 15, cumplidos: 15, porcentaje: 100 },
  evaluacion_inicial: { combinado: { hallazgosCriticos: 0, cumplimiento: 100, totalHallazgos: 12 } },
  plan_trabajo: { actividadesPendientes: 0, porcentajeAvance: 100 },
  rendicion_cuentas: { disponible: true, actas_realizadas: 4 },
  cambios: { pending: 0, total: 4 }
});
ok('4) objetivos cumplidos al 100% no generan señal',
  sinCriticos.indexOf('Objetivos SST') === -1);
ok('4) sin hallazgos críticos no genera señal',
  sinCriticos.indexOf('Evaluación inicial') === -1);
ok('4) con todo al día vuelve el estado tranquilo',
  sinCriticos.indexOf('Sistema estable') !== -1);

// ── 5) No se rompe con datos raros (esto es lo que pasó en el SVE) ──
ok('5) aguanta estadísticas vacías, nulas o sin los objetos esperados',
  (function () {
    try {
      correr({});
      correr({ politica: null, objetivos: undefined, cambios: {} });
      correr({ evaluacion_inicial: {}, plan_trabajo: { porcentajeAvance: null } });
      correr({ objetivos: { total: 'muchos', cumplidos: 0, porcentaje: 0 } });
      return true;
    } catch (e) { console.error('    lanzo: ' + e.message); return false; }
  })());
ok('5) y aguanta que gestionIntegralStats no exista',
  (function () {
    try { return radar.call({}).indexOf('Sistema estable') !== -1; }
    catch (e) { console.error('    lanzo: ' + e.message); return false; }
  })());

// ── 6) El pendiente fantasma de rendición (bug real que salió en 📦829) ──
// calculateRendicionCuentasStats devuelve el objeto SIEMPRE, aun sin carpeta.
// Con la guarda anterior (`giRendicion && actas === 0`) una empresa que nunca
// registró rendición veía "Rendición sin actas" para siempre. Lo que la
// distingue es `disponible`.
ok('6) sin la carpeta leída NO inventa "Rendición sin actas"',
  correr({ rendicion_cuentas: { actas_realizadas: 0 } }).indexOf('Rendición de cuentas') === -1);
ok('6) con la carpeta leída y cero actas SÍ avisa (ese cero sí es real)',
  correr({ rendicion_cuentas: { disponible: true, actas_realizadas: 0 } })
    .indexOf('Rendición de cuentas') !== -1);
ok('6) con actas registradas no dice nada',
  correr({ rendicion_cuentas: { disponible: true, actas_realizadas: 2 } })
    .indexOf('Rendición de cuentas') === -1);

// ── 7) El dashboard tiene la MISMA guarda (si no, los dos paneles mienten) ──
const txtMain = fs.readFileSync(path.join(APP, 'main.js'), 'utf8');
ok('7) el dashboard exige `disponible` antes de contar actas en cero',
  /giRendicion && giRendicion\.disponible && giRendicion\.actas_realizadas === 0/.test(txtMain));
ok('7) y calculateRendicionCuentasStats declara `disponible` en false',
  /async function calculateRendicionCuentasStats[\s\S]{0,600}?disponible: false/.test(txtMain));

let failed = 0;
console.log('\n=======================================');
console.log('  📦829 · El radar del home, ejecutado de verdad');
console.log('=======================================');
checks.forEach(c => {
  if (!c.ok) failed++;
  console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
});
console.log('---');
console.log((checks.length - failed) + '/' + checks.length + ' OK');
console.log('=======================================');
process.exit(failed === 0 ? 0 : 1);
