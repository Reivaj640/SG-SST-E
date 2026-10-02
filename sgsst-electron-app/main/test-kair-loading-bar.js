/* ============================================================
 * K+AIR · Smoke test — Barra del overlay post-login (📦838)
 * ============================================================
 * Bug: la barra de progreso del overlay que aparece después del
 * login se quedaba congelada en 0% en el SEGUNDO login de la
 * misma sesión (tras cerrar sesión y volver a entrar).
 *
 * Causa: KairLoadingController._getElements() cacheaba los
 * elementos del overlay del primer login; ese overlay se borra
 * del DOM al terminar la transición, así que en el segundo login
 * los guardas apuntaban a nodos ya desprendidos y los cambios de
 * ancho/porcentaje caían en la nada.
 *
 * Este test valida de forma estática que:
 *   1. _getElements siempre vuelve a buscar los elementos,
 *   2. reset() reinicia el progreso ANTES de pintarlo,
 *   3. la secuencia de login sigue completa (25/55/80/100),
 *   4. el overlay se crea fresco por login y se borra al final.
 *
 * Correr con: node main/test-kair-loading-bar.js
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

const renderer = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');

const checks = [];
function check(name, ok, extra) {
  checks.push({ name: name, ok: !!ok, extra: extra });
}

// ── 1. _getElements siempre re-quería ────────────────────────────────────────
const iGet = renderer.indexOf('_getElements() {');
const iSet = renderer.indexOf('setProgress(value)');
const cuerpo = (iGet >= 0 && iSet > iGet) ? renderer.slice(iGet, iSet) : '';

check('JS: _getElements existe', iGet >= 0);
check('JS: _getElements ya NO cachea con `if (!this.messageEl)`',
  renderer.indexOf('if (!this.messageEl)') < 0);
check('JS: _getElements consulta los 4 elementos en cada llamada',
  (cuerpo.match(/document\.querySelector\(/g) || []).length === 4,
  'querySelector en el cuerpo: ' + (cuerpo.match(/document\.querySelector\(/g) || []).length);
check('JS: los 4 selectores siguen presentes',
  /querySelector\('\.loading-message'\)/.test(cuerpo) &&
  /querySelector\('\.loading-submessage'\)/.test(cuerpo) &&
  /querySelector\('\.progress-fill'\)/.test(cuerpo) &&
  /querySelector\('\.loading-progress-percent'\)/.test(cuerpo));

// ── 2. reset() reinicia el progreso ──────────────────────────────────────────
check('JS: reset() pone this.progress = 0 al entrar',
  /reset\(\)\s*\{\s*this\.progress = 0;/.test(renderer));
check('JS: reset() limpie el estado de completado (isComplete = false)',
  /reset\(\)\s*\{[\s\S]{0,200}?this\.isComplete = false;/.test(renderer));
check('JS: renderLoginScreen llama a kairLoading.reset() (2º login arranca limpio)',
  /window\.kairLoading\.reset\(\)/.test(renderer));

// ── 3. Secuencia de login completa ───────────────────────────────────────────
const pasos = ['animateToProgress(25, 600)', 'animateToProgress(55, 600)',
  'animateToProgress(80, 500)', 'animateToProgress(100, 500)'];
check('JS: la transición anima los 4 pasos (25 → 55 → 80 → 100)',
  pasos.every(function (p) { return renderer.indexOf('window.kairLoading.' + p) >= 0; }));
check('JS: animateToProgress devuelve promesa aunque no haya barra (no traba la secuencia)',
  /if \(!progressFill\) return Promise\.resolve\(\);/.test(renderer));

// ── 4. Overlay fresco por login + limpieza ───────────────────────────────────
check('JS: executeLoginTransition crea un overlay nuevo cada vez',
  /const overlay = createTransitionOverlay\(\);/.test(renderer));
check('JS: el overlay define la barra y el porcentaje',
  /class="progress-fill"/.test(renderer) && /class="loading-progress-percent"/.test(renderer));
check('JS: el overlay se borra del DOM al terminar (por eso el cache quedaba viejo)',
  /overlay\.remove\(\)/.test(renderer));
check('JS: complete() dispara el evento de terminado',
  /dispatchEvent\(new CustomEvent\('kair-loading-complete'\)\)/.test(renderer));

// ── Reporte ──────────────────────────────────────────────────────────────────
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) { console.log('[OK  ] ' + c.name); }
  else { failed++; console.log('[FAIL] ' + c.name + (c.extra ? ' → ' + c.extra : '')); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ Barra del overlay post-login: sin cache de elementos viejos');
