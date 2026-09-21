/* ============================================================
 * K+AIR · Smoke test — Evaluación Inicial del SG-SST en premium (📦759)
 * ============================================================
 * Valida la migración visual del submódulo 2.3.1 y, sobre todo, que NO vuelvan los dos
 * problemas de raíz que tenía:
 *
 *  1. El componente inyectaba 270 líneas de CSS desde el .js, con un `:root` GLOBAL
 *     (`--primary`, `--text-dark`, `--bg-card`, `--border`…) y reglas `.k-*` SIN scope.
 *     Como se agregaba al <head> DESPUÉS del <link>, le ganaba al .css en cada empate:
 *     editar la hoja de estilos no cambiaba nada, y esos nombres genéricos se filtraban
 *     a TODA la aplicación.
 *  2. Los modales se cuelgan del <body> (#k-modal-root y los <dialog>), o sea FUERA del
 *     contenedor del módulo. La capa de estilos solo cubría el contenedor, así que los
 *     modales se quedaban con la paleta vieja y SIN modo oscuro.
 *
 * Correr con: node main/test-evaluacion-inicial-premium.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'modules', 'gestion-integral', 'evaluacion-inicial-sg-sst');
const js = fs.readFileSync(path.join(dir, 'evaluacion-inicial-sg-sst.js'), 'utf8');
const cssBase = fs.readFileSync(path.join(dir, 'evaluacion-inicial-sg-sst.css'), 'utf8');
const cssPremium = fs.readFileSync(path.join(dir, 'evaluacion-inicial-sg-sst-premium.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Saca los comentarios para no confundir documentación con código
function sinComentariosCss(t) { return t.replace(/\/\*[\s\S]*?\*\//g, ''); }
function sinComentariosJs(t) {
  // El trim() es imprescindible: con saltos de línea de Windows una línea de comentario
  // queda como "\r// …" y se colaba como si fuera código.
  return t.split('\n').filter(function (l) { return l.trim().indexOf('//') !== 0; }).join('\n');
}
const premium = sinComentariosCss(cssPremium);
const base = sinComentariosCss(cssBase);
const jsCodigo = sinComentariosJs(js);

const checks = [];
function check(name, ok, extra) { checks.push({ name: name, ok: !!ok, extra: extra }); }
function regla(css, sel) {
  const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : '';
}

// ── 1. Se eliminó la contaminación global ─────────────────────────────────────
check('JS: ya no inyecta el bloque de estilos propio (k-air-eval-styles)',
  jsCodigo.indexOf('k-air-eval-styles') < 0);
check('JS: ya no define un :root global con nombres genéricos',
  !/:root\s*\{/.test(jsCodigo));
check('JS: ya no inyecta <style> dentro de los modales',
  jsCodigo.indexOf('<style>') < 0);
check('JS: ya no escribe la tipografía vieja (Segoe UI)',
  jsCodigo.indexOf('Segoe UI') < 0);
check('JS: los estilos propios ahora viven en la hoja premium (existe y se carga)',
  fs.existsSync(path.join(dir, 'evaluacion-inicial-sg-sst-premium.css')) &&
  fs.readFileSync(path.join(dir, 'evaluacion-inicial-sg-sst-premium.css'), 'utf8').indexOf('.kair-eval-scope') >= 0);

// ── 2. La capa premium cubre los TRES puntos de montaje ──────────────────────
check('JS: el contenedor del módulo recibe la marca de alcance premium',
  /this\._scope\(this\.container\)/.test(js));
check('JS: el contenedor de modales (#k-modal-root) la recibe',
  /_getModalRoot\(\)[\s\S]*?this\._scope\(root\)/.test(js));
check('JS: los 4 <dialog> de Planes de Acción la reciben',
  (js.match(/modal\.className = 'k-modal kair-eval-scope'/g) || []).length === 4,
  'encontrados: ' + (js.match(/modal\.className = 'k-modal kair-eval-scope'/g) || []).length);
check('JS: tiene el helper de color para el lienzo (que no entiende var())',
  /_color\(token, fallback\)/.test(js));

// ── 3. El gauge dejó de tener colores fijos ──────────────────────────────────
const gauge = js.slice(js.indexOf('drawGauge(value = 0)'), js.indexOf('_setupGaugeResizeObserver()', js.indexOf('drawGauge(value = 0)')));
check('JS: el gauge lee su color de la paleta (no 3 hex fijos)',
  /this\._color\('--ei-success'/.test(gauge) && /this\._color\('--ei-danger'/.test(gauge));
check('JS: el fondo del gauge también sale de la paleta',
  /this\._color\('--ei-track'/.test(gauge));

// ── 4. Los colores escritos a mano usan tokens ───────────────────────────────
const inlineFijos = jsCodigo.match(/color:\s*#[0-9a-fA-F]{3,6}/g) || [];
check('JS: no queda ningún color de texto escrito a mano en el HTML',
  inlineFijos.length === 0, inlineFijos.join(', '));
check('JS: no quedan concatenaciones inválidas de color (var(--x)NN)',
  !/var\(--[a-z-]+\)[0-9a-fA-F]{2}/.test(jsCodigo));

// ── 5. La hoja premium reasigna los tokens ───────────────────────────────────
const scope = regla(premium, '.kair-eval-scope');
check('CSS: la capa premium reasigna los tokens del módulo (--ei-*)',
  /--ei-primary:\s*var\(--kair-blue/.test(scope) && /--ei-text-dark:\s*var\(--kair-ink/.test(scope));
check('CSS: también cubre los alias --k-* que usa el .css base',
  /--k-primary:\s*var\(--ei-primary\)/.test(scope));
check('CSS: y los tokens genéricos del HTML (--primary, --text-dark, --bg-card)',
  /--primary:\s*var\(--ei-primary\)/.test(scope) && /--text-dark:\s*var\(--ei-text-dark\)/.test(scope));
check('CSS: la tipografía pasa a la del sistema premium',
  /--ei-font:\s*var\(--kair-font-ui/.test(scope));

// ── 6. Modo oscuro: los DOS atributos de la app ──────────────────────────────
check('CSS: el modo oscuro cubre data-theme="dark" (tema Sistema)',
  /\[data-theme="dark"\] \.kair-eval-scope/.test(premium));
check('CSS: y también data-theme="dark-legacy" (tema Oscuro manual)',
  /\[data-theme="dark-legacy"\] \.kair-eval-scope/.test(premium));

// ── 7. El bug de las pestañas (regla de igual prioridad) ─────────────────────
check('CSS base: la regla que apaga las vistas excluye la activa (no las tapa)',
  /\.ev-inicial-sgsst \.k-view:not\(\.active\)\s*\{\s*display:\s*none/.test(
    base.replace(/\s+/g, ' ')) || /\.ev-inicial-sgsst \.k-view:not\(\.active\)/.test(base));
check('CSS premium: repite la exclusión por si la hoja base no está',
  /\.kair-eval-scope \.k-view:not\(\.active\)/.test(premium));

// ── 8. Cache-bust ────────────────────────────────────────────────────────────
// OJO: desde 📦761 el módulo se reescribió con el prototipo premium v2 y este test
// quedó apuntando a los archivos de la versión anterior (`evaluacion-inicial-sg-sst.css`
// / `.js` / `-premium.css`), que ya no se cargan. Acá solo se conserva la verificación
// de que el cache-bust siga existiendo; lo específico de v2 lo cubre
// `test-evaluacion-inicial-v2.js`.
check('Cache-bust: la hoja y el script del módulo se cargan versionados',
  /evaluacion-inicial-(view|sg-sst)[a-z-]*\.css\?v=/.test(html) &&
  /evaluacion-inicial-(view|sg-sst)[a-z-]*\.js\?v=/.test(html));
check('Cache-bust: las hojas viejas ya no se cargan',
  html.indexOf('evaluacion-inicial-sg-sst.css?v=') < 0 &&
  html.indexOf('evaluacion-inicial-sg-sst-premium.css?v=') < 0);

// ── 9. El contrato del DOM no se rompió ──────────────────────────────────────
['#view-dashboard', '#view-hallazgos', '#view-actions', 'gaugeChart', 'kpi-score',
 'kpi-gaps', 'kpi-pending', 'hallazgosTableBody', 'actionTableBody', 'btn-back-eval',
 'btn-load-ministerio', 'btn-load-arl', 'btn-change-pdf', 'loading-indicator',
 'btn-view-pdf', 'phva-chart-container'].forEach(function (id) {
  check('DOM: sigue existiendo ' + id, js.indexOf(id.slice(1)) >= 0);
});
['dashboard', 'hallazgos', 'actions'].forEach(function (tab) {
  check('DOM: la pestaña "' + tab + '" sigue existiendo', js.indexOf('switchTab(\'' + tab + '\')') >= 0 ||
    js.indexOf('data-tab="' + tab + '"') >= 0);
});
check('DOM: los modales siguen abriéndose con showModal()',
  (js.match(/modal\.showModal\(\)/g) || []).length === 4);

// ── Reporte ──────────────────────────────────────────────────────────────────
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) { console.log('[OK  ] ' + c.name); }
  else { failed++; console.log('[FAIL] ' + c.name + (c.extra ? ' → ' + c.extra : '')); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ Evaluación Inicial en premium, sin contaminación global y con modo oscuro real');
