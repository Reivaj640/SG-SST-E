/* ============================================================
 * K+AIR · Smoke test — Home de Gestión de la Salud (📦763)
 * ============================================================
 * Corrige el error de consola que aparecía al abrir el módulo:
 *
 *   [SALUD] Error refrescando estadísticas:
 *   TypeError: Cannot read properties of undefined (reading 'ausentismo')
 *
 * Eran DOS problemas distintos, y ninguno era el que el mensaje sugería:
 *
 *   1. `window._saludHomeState` (la memoria de sesión del home: `.cache` y
 *      `.lastUpdate`, dos Map por empresa) **no se creaba en ningún archivo**.
 *   2. El verdadero origen del mensaje estaba en `updateWidgetsUI`: sus guardas eran
 *      `if (data.X && this.widgets.X)` y `this.widgets` **nunca se inicializa** (es
 *      del sistema de widgets viejo que el rediseño dejó sin usar). La lectura de
 *      `this.widgets.ausentismo` lanzaba el TypeError, y el catch de `refreshStats`
 *      lo reportaba con el texto de "refrescando estadísticas".
 *
 * De paso se corrigió que `this.saludStats` NUNCA se asignaba: el render activo lee
 * esa propiedad, así que el home quedaba sin datos. Y se agregó el adaptador de
 * nombres de campo (el backend usa nombres distintos a los que lee el render).
 *
 * Correr con: node main/test-gestion-salud-home.js
 * Verificación en la app real: npx electron main/_verif-salud.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const F_HOME = path.join(ROOT, 'modules', 'gestion-salud', 'gestion-salud-home.js');
const home = fs.readFileSync(F_HOME, 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* Código sin comentarios: hay verificaciones que buscarían una mención en un
   comentario y darían un falso positivo. */
const homeLimpio = home
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/[^\n]*$/gm, '');

const checks = [];
function check(name, ok, extra) { checks.push({ name: name, ok: !!ok, extra: extra }); }

/* ══════════════ 1. La memoria de sesión existe ══════════════ */
check('Sesión: se define window._saludHomeState',
  /window\._saludHomeState\s*=/.test(homeLimpio));
check('Sesión: se define con los dos Map que usa el resto del archivo (cache y lastUpdate)',
  /window\._saludHomeState\s*=\s*window\._saludHomeState\s*\|\|\s*\{[\s\S]{0,200}cache:\s*new Map\(\)[\s\S]{0,200}lastUpdate:\s*new Map\(\)/.test(homeLimpio));
check('Sesión: la definición es idempotente (no pisa una versión ya cargada)',
  /window\._saludHomeState\s*=\s*window\._saludHomeState\s*\|\|/.test(homeLimpio));
check('Sesión: la escritura en la caché está protegida (no confía en que exista)',
  /if\s*\(!window\._saludHomeState\)\s*\{[\s\S]{0,140}cache:\s*new Map\(\)/.test(homeLimpio));
check('Sesión: la LECTURA de la caché también está protegida',
  /window\._saludHomeState\s*&&\s*window\._saludHomeState\.cache/.test(homeLimpio));

/* ══════════════ 2. El origen real del TypeError ══════════════ */
check('Widgets: updateWidgetsUI sale temprano si no hay widgets (era el origen del error)',
  /if\s*\(!this\.widgets\)\s*return;/.test(homeLimpio));
check('Widgets: ya no se leen propiedades de this.widgets sin haber salido antes',
  (function () {
    /* Después de la guarda tiene que venir la primera referencia a this.widgets */
    const i = homeLimpio.indexOf('if (!this.widgets) return;');
    if (i < 0) return false;
    const antes = homeLimpio.slice(0, i);
    return antes.indexOf('this.widgets.') < 0;
  })());
check('Widgets: la llamada al gráfico de índices está protegida',
  /typeof this\.renderIndicesChart === 'function'/.test(homeLimpio));

/* ══════════════ 3. Los datos llegan al render ══════════════ */
check('Datos: refreshStats asigna this.saludStats (antes nunca se asignaba)',
  /this\.saludStats\s*=\s*newData/.test(homeLimpio));
check('Datos: el render activo sigue leyendo this.saludStats',
  /const stats = this\.saludStats \|\| \{\}/.test(homeLimpio));
check('Datos: existe el adaptador de nombres de campo',
  /_adaptarRespuestasSalud\s*\(/.test(homeLimpio));
check('Datos: el adaptador es a prueba de fallos (no rompe si llega vacío)',
  /_adaptarRespuestasSalud\s*\(r\)\s*\{[\s\S]{0,400}r = r \|\| \{\};/.test(homeLimpio));
check('Adaptador: traduce los accidentes del backend (totalYear -> total)',
  /total:\s*accTotal/.test(homeLimpio));
check('Adaptador: traduce los exámenes (totalYear -> totalExamenes, mesActual -> realizados)',
  /totalExamenes:\s*exaTotal/.test(homeLimpio) && /realizados:\s*num\(exa\.mesActual\)/.test(homeLimpio));
check('Adaptador: traduce los seguimientos (totalAnio -> total, realizadosAnio -> completados)',
  /total:\s*segTotal/.test(homeLimpio) && /completados:\s*segHechos/.test(homeLimpio));
check('Adaptador: conserva los casos de ausentismo que sí informa el backend',
  /totalCasos:\s*num\(aus\.total\)/.test(homeLimpio));
check('Adaptador: NO inventa trabajadores ni tasa de ausentismo (el backend no los da)',
  /totalTrabajadores:\s*0/.test(homeLimpio) && /tasaAusentismo:\s*0/.test(homeLimpio));
check('Adaptador: los conteos nunca son negativos',
  /Math\.max\(0,/.test(homeLimpio));

/* ══════════════ 4. No rompe nada ══════════════ */
check('Integridad: el archivo compila', (function () {
  try { new vm.Script(home, { filename: 'gestion-salud-home.js' }); return true; }
  catch (e) { return false; }
})());
check('Integridad: la clase sigue exportándose igual',
  /window\.GestionSaludHome\s*=\s*GestionSaludHome/.test(home));
check('Integridad: sigue habiendo una sola clase y un solo refreshStats',
  (home.match(/^class GestionSaludHome/gm) || []).length === 1 &&
  (home.match(/^\s{4}async refreshStats\s*\(/gm) || []).length === 1);
check('Integridad: siguen los 7 métodos de widgets (código muerto, pero no se borró nada)',
  ['createSeguimientosWidget', 'createAusentismoWidget', 'createExamenesWidget',
    'createAccidentesWidget', 'createRemisionesWidget', 'createInduccionesWidget']
    .every(function (m) { return home.indexOf(m + '(') >= 0; }));
check('Integridad: sigue el render premiun y el hero',
  /kair-hero-card/.test(home) && /kair-hero-score/.test(home));
check('Integridad: la hoja de estilos se sigue inyectando',
  /injectStyles\s*\(/.test(home));

/* ══════════════ 5. Cache-bust ══════════════ */
check('Cache-bust: index.html carga el home con una versión propia',
  /gestion-salud-home\.js\?v=/.test(indexHtml));
check('Cache-bust: la versión no es la vieja (se bumpeó al tocar el archivo)',
  /gestion-salud-home\.js\?v=GESTION-SALUD-20260918-fix-home-cache/.test(indexHtml));

/* ══════════════ Reporte ══════════════ */
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) console.log('[OK  ] ' + c.name);
  else { failed++; console.log('[FAIL] ' + c.name + (c.extra ? ' → ' + c.extra : '')); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ Home de Gestión de la Salud sin el error de consola y con los datos conectados');
