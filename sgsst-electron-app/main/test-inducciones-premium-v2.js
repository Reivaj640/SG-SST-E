/* Smoke test · Inducción premium v2 (port kair-induccion.html + IPC real)
   Valida estructura: IDs del target en view.html, CSS scopeado, métodos en
   logic.js, tokens de caché, y ausencia de restos Chart.js / demo / stubs.
   Uso: node main/test-inducciones-premium-v2.js */
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..', 'modules', 'recursos', 'inducciones');
const html = fs.readFileSync(path.join(base, 'inducciones-view.html'), 'utf8');
const css = fs.readFileSync(path.join(base, 'inducciones-view.css'), 'utf8');
const js = fs.readFileSync(path.join(base, 'inducciones-logic.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const checks = [];
function has(src, name, re) { checks.push({ name: name, ok: re.test(src) }); }
function lacks(src, name, re) { checks.push({ name: name + ' (ausente)', ok: !re.test(src) }); }

// --- view.html: IDs del target ---
['d-anio', 'f-anio', 'd-genero', 'f-estado', 'f-buscar', 'tbody', 'pager',
 'modal-induccion', 'toasts', 'ind-boot', 'radar-items', 'chart-ejecucion',
 'chart-tasa', 'donut-genero', 'hbars-cargos', 'chart-rangos', 'chart-aprob-genero',
 'hero-pct', 'hero-title', 'kpi-total', 'kpi-apr', 'kpi-rep', 'kpi-prom',
 'tab-reg-count', 'dash-count', 'reg-count', 'foot-count', 'form-induccion',
 'cargos-list', 'btn-registrar', 'btn-ver-reprobados', 'btn-radar-registro',
 'btn-limpiar', 'table-empty', 'sync-banner',
 'btn-volver', 'btn-sync', 'btn-exportar', 'chip-origen'
].forEach(function (id) {
  has(html, 'HTML: id #' + id, new RegExp('id="' + id + '"'));
});
lacks(html, 'HTML: sin chip empresa (fidelidad target)', /header-company-text/);
has(html, 'HTML: token caché v10-window-fix', /INDUCCIONES-20260915-v12-hero-textos-fix/);
lacks(html, 'HTML: sin IDs legacy', /id="(mainChart|stat-total|inductionModal|full-table-body|filter-year-dashboard)"/);

// --- view.css: scope total, sin fugas ---
var badRules = css.split('\n').filter(function (l) { return /^\.(kair-|k-)/.test(l.trim()); });
checks.push({ name: 'CSS: 0 reglas sin scope (' + badRules.length + ')', ok: badRules.length === 0 });
has(css, 'CSS: adaptación ind-boot', /\.inducciones-container \.kair-boot/);
has(html, 'HTML: strip hero+KPIs', /kair-hero-strip/);
has(css, 'CSS: blindaje kair-select width:auto (vs inspeccion.css global)', /\.inducciones-container \.kair-select\{width:auto/);
has(css, 'CSS: reglas del strip', /\.inducciones-container \.kair-hero-strip\{display:grid/);
has(css, 'CSS: regla [hidden]', /\[hidden\]\{display:none!important\}/);
lacks(css, 'CSS: sin restos canvas legacy', /\.k-chart-body canvas/);

// --- logic.js: métodos portados + IPC real ---
['InduccionesComponent', '_normRecord', '_normGenero', 'computeMetrics',
 'renderHero', 'renderKpis', 'renderRadar', 'renderChartEjecucion', 'colChart',
 'renderChartTasa', 'renderChartAprobGenero', 'renderChartRangos',
 'renderDonutGenero', 'renderHbarsCargos', 'renderCharts', 'rowHtml',
 'renderTable', 'openIndModal', 'updatePrev', 'exportCsv', 'refreshAll',
 'setView', 'setAnio', 'populateAnios', 'populateCargos', 'clearRegistroFilters',
 'getInduccionesData', 'syncFromForms', 'checkInduccionesChanges',
 'backToModuleCallback', 'currentInduccionesComponent', '_hideBoot'
].forEach(function (m) {
  has(js, 'JS: método ' + m, new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
lacks(js, 'JS: sin Chart.js', /new Chart\(|typeof Chart/);
lacks(js, 'JS: sin IND_DEMO', /IND_DEMO/);
lacks(js, 'JS: sin stub guardar', /Próximamente/);

// --- index.html: tokens ---
has(indexHtml, 'index: token logic.js', /inducciones-logic\.js\?v=INDUCCIONES-20260915-v12-hero-textos-fix/);
has(indexHtml, 'index: token viewer.js', /inducciones-viewer\.js\?v=INDUCCIONES-20260915-v12-hero-textos-fix/);
lacks(indexHtml, 'index: sin token viejo', /INDUCCIONES-20260913-v4-premium-svg-aligned/);

// --- reporte ---
var failed = 0;
checks.forEach(function (c) {
  if (!c.ok) { failed++; console.log('FAIL:', c.name); }
});
console.log('checks: ' + checks.length + ' | pass: ' + (checks.length - failed) + ' | fail: ' + failed);
process.exit(failed === 0 ? 0 : 1);
