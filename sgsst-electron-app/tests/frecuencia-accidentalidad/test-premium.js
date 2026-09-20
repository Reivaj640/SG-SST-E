// test-premium.js
//
// Test de humo de la migración premium del submódulo
// 3.3.1 Frecuencia de la Accidentalidad.
//
// Valida: que se haya quitado la fuga GLOBAL (:root / * / body y las clases
// .kair-* sin scope), el Header System v2, los tokens propios --freq-*, el
// modo oscuro en los DOS atributos, los colores del gráfico por token y los
// cache-bust.
//
// Ejecución:  node tests/frecuencia-accidentalidad/test-premium.js
// Resultado:  Imprime OK/FAIL. Exit 0 = OK, 1 = FAIL.

'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'modules', 'gestion-salud', 'frecuencia-accidentalidad');
const F_HTML = path.join(DIR, 'frecuencia-accidentalidad.html');
const F_CSS = path.join(DIR, 'frecuencia-accidentalidad.css');
const F_JS = path.join(DIR, 'frecuencia-accidentalidad.js');
const F_RENDERER = path.join(ROOT, 'renderer.js');

const html = fs.readFileSync(F_HTML, 'utf8');
const css = fs.readFileSync(F_CSS, 'utf8');
const js = fs.readFileSync(F_JS, 'utf8');
const renderer = fs.readFileSync(F_RENDERER, 'utf8');

function sinComentarios(t) {
  return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/[^\n]*$/gm, '');
}
const cssLimpio = sinComentarios(css);

const checks = [];
function check(name, ok) { checks.push({ name: name, ok: !!ok }); }

/* ══════════════ A. HTML ══════════════ */
check('HTML: Header System v2 (header v2 + breadcrumb + título + acciones)',
  html.includes('class="freq-header-v2"') && html.includes('class="freq-breadcrumb"') &&
  html.includes('class="freq-title"') && html.includes('class="freq-header-actions"'));
check('HTML: icon chip + chip de empresa + año + Refrescar + Volver',
  html.includes('class="freq-header-icon"') && html.includes('class="freq-company"') &&
  html.includes('class="freq-select"') && html.includes('id="btnRefrescar"') &&
  html.includes('class="freq-btn freq-btn--primary" id="btnVolver"'));
check('HTML: ya NO usa las clases globales .k-section-card / .header-back-btn / .header-action--ghost',
  !html.includes('k-section-card') && !html.includes('header-back-btn') && !html.includes('header-action--ghost'));
check('HTML: iconos en SVG en línea (sin Bootstrap Icons, que nunca cargaba)',
  !html.includes('class="bi bi-') && !html.includes('class="fas fa-') &&
  !html.includes('kair-icon-building') && html.includes('stroke="currentColor"') &&
  !html.includes('stroke="#174ea6"'));

const IDS = [
  'yearFilter', 'btnRefrescar', 'btnCloneYear', 'btnVolver', 'header-company-text',
  'syncFileName', 'kpiSection', 'kpiIF', 'kpiMetaF', 'kpiTotalAT', 'kpiYearLabel',
  'kpiHist', 'kpiExceden', 'kpiMort', 'kpiAus', 'targetValue', 'targetBadge',
  'targetCard', 'chartContainer', 'tablaBody', 'tablaFoot', 'tablaFrecuencia',
  'monthCards', 'refType', 'refFormula', 'refFreq', 'refTargetF',
  'seccionesColapsables', 'methodFileName', 'methodSources', 'toastContainer', 'app'
];
const idsFaltantes = IDS.filter(function (id) { return !html.includes('id="' + id + '"'); });
check('HTML: los ' + IDS.length + ' ids del contrato siguen presentes' +
  (idsFaltantes.length ? ' (faltan: ' + idsFaltantes.join(', ') + ')' : ''),
  idsFaltantes.length === 0);

/* ══════════════ B. CSS — SIN FUGA GLOBAL ══════════════ */
check('CSS: NO hay :root global (los tokens viven en .frecuencia-container)',
  !/(^|\n)\s*:root\s*\{/.test(cssLimpio));
check('CSS: NO hay reset `*` global (borraba márgenes de toda la app)',
  !/(^|\n)\s*\*\s*\{/.test(cssLimpio) &&
  /\.frecuencia-container \*\s*\{/.test(cssLimpio));
check('CSS: NO hay regla `body` global (forzaba overflow:hidden en toda la app)',
  !/(^|\n)\s*body\s*\{/.test(cssLimpio));
check('CSS: ya NO define clases GLOBALES de otros módulos',
  !cssLimpio.includes('k-section-card') && !cssLimpio.includes('header-back-btn') &&
  !cssLimpio.includes('header-action--ghost'));

function selectoresSueltos(texto) {
  const malos = [];
  texto.split('\n').forEach(function (linea) {
    const t = linea.trim();
    if (!t || t.startsWith('@')) return;
    const brace = t.indexOf('{');
    if (brace <= 0) return;
    const sel = t.slice(0, brace).trim();
    if (!sel || /^(from|to|\d+%)/.test(sel)) return;
    sel.split(',').map(function (s) { return s.trim(); }).forEach(function (s) {
      if (s && !/^\.frecuencia-container/.test(s) && !/^\[data-theme/.test(s)) malos.push(s);
    });
  });
  return malos;
}
const sueltos = selectoresSueltos(cssLimpio);
check('CSS: TODOS los selectores están bajo .frecuencia-container o [data-theme^="dark"]' +
  (sueltos.length ? ' (sueltos: ' + sueltos.slice(0, 6).join(' | ') + ')' : ''),
  sueltos.length === 0);
check('CSS: los @keyframes tienen prefijo propio (no chocan con otros módulos)',
  /@keyframes freqPulse/.test(css) && /@keyframes freqSlideIn/.test(css) &&
  !/@keyframes pulse/.test(css) && !/@keyframes slideIn/.test(css));

/* ══════════════ C. CSS — TOKENS Y PALETA ══════════════ */
check('CSS: tokens propios --freq-* (ya no --kair-*, que chocaban con la app)',
  /--freq-primary: #2057b8;/.test(css) && /--freq-bg: #fbfcfb;/.test(css) &&
  /--freq-text: #14213d;/.test(css) && /--freq-border: #e8ebee;/.test(css) &&
  /--freq-success: #1bb888;/.test(css) && /--freq-danger: #da5563;/.test(css) &&
  /--freq-radius-card: 20px;/.test(css) && !/--kair-primary/.test(css));
check('CSS: tipografía DM Sans + Manrope',
  /--freq-font: 'DM Sans'/.test(css) && /--freq-font-display: 'Manrope'/.test(css));
check('CSS: los contenedores tipo tarjeta usan el radio 20px',
  /\.frecuencia-container \.kair-card \{[^}]*border-radius: var\(--freq-radius-card\);/.test(cssLimpio.replace(/\n/g, ' ')));
check('HTML: el gráfico y la tabla están envueltos en .freq-duo (para el paralelo)',
  html.includes('<div class="freq-duo">') && html.includes('<!-- /freq-duo -->'));
check('CSS: gráfico y tabla en 2 columnas SOLO en maximizada (>=1360px)',
  /\.freq-duo \{[^}]*display: grid;/.test(cssLimpio.replace(/\n/g, ' ')) &&
  /\.freq-duo \{[^}]*grid-template-columns: 1fr;/.test(cssLimpio.replace(/\n/g, ' ')) &&
  /@media \(min-width: 1360px\) \{[^@]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/.test(cssLimpio.replace(/\n/g, ' ')));
check('CSS: el encabezado de la tabla puede partir en 2 lineas (la tabla entra completa en la columna)',
  /\.kair-table thead th \{[^}]*white-space: normal;/.test(cssLimpio.replace(/\n/g, ' ')) &&
  !/\.kair-table thead th \{[^}]*white-space: nowrap;/.test(cssLimpio.replace(/\n/g, ' ')));
check('CSS: en maximizada la tabla tiene anchos FIJOS por columna (table-layout: fixed + 6 %)',
  /@media \(min-width: 1360px\) \{[^@]*table-layout: fixed;/.test(cssLimpio.replace(/\n/g, ' ')) &&
  [1, 2, 3, 4, 5, 6].every(function (n) {
    return new RegExp('\\.kair-table th:nth-child\\(' + n + '\\) \\{ width: \\d+%; \\}').test(cssLimpio);
  }) &&
  (function () {
    var m = cssLimpio.match(/\.kair-table th:nth-child\(\d\) \{ width: (\d+)%; \}/g) || [];
    var suma = m.reduce(function (s, x) { return s + parseInt(x.match(/(\d+)%/)[1], 10); }, 0);
    return m.length === 6 && suma === 100;
  })());

const VIEJOS = ['#174ea6', '#28a745', '#ffc107', '#dc3545', '#dee2e6', '#f8f9fa', '#6c757d', '#2d3748', '#1e1e2f', '#5a6378'];
const presentes = VIEJOS.filter(function (h) { return cssLimpio.toLowerCase().includes(h); });
check('CSS: sin colores de la paleta vieja' + (presentes.length ? ' (quedan: ' + presentes.join(', ') + ')' : ''),
  presentes.length === 0);

/* ══════════════ D. CSS — MODO OSCURO ══════════════ */
check('CSS: modo oscuro con [data-theme^="dark"] (cubre dark Y dark-legacy)',
  /\[data-theme\^="dark"\] \.frecuencia-container \{/.test(css) &&
  /\[data-theme\^="dark"\] \.frecuencia-container \{[^}]*--freq-bg: #0f172a;/.test(css.replace(/\n/g, ' ')) &&
  /\[data-theme\^="dark"\] \.frecuencia-container \{[^}]*--freq-card: #1a2334;/.test(css.replace(/\n/g, ' ')) &&
  /\[data-theme\^="dark"\] \.frecuencia-container \{[^}]*--freq-primary: #6ea8fe;/.test(css.replace(/\n/g, ' ')));
check('CSS: superficies con acento de fondo usan la versión oscura en tema oscuro',
  /\[data-theme\^="dark"\] \.frecuencia-container \.freq-btn--primary/.test(css) &&
  /\[data-theme\^="dark"\] \.frecuencia-container \.kair-toast/.test(css) &&
  /background: #2f5fa8;/.test(css));

/* ══════════════ E. JS ══════════════ */
check('JS: lee la paleta del CSS (tok/palette) en vez de hex fijos',
  /function tok\(name, fallback\)/.test(js) && /function palette\(\)/.test(js) &&
  /getComputedStyle\(host\)\.getPropertyValue\(name\)/.test(js));
check('JS: renderChart/renderTabla/renderColapsables/renderMonthCards usan palette()',
  (js.match(/var C = palette\(\);/g) || []).length === 4 &&
  /stroke="' \+ C\.danger \+ '"/.test(js) && /fill="' \+ C\.axis \+ '"/.test(js));
const VIEJOS_JS = ['#174ea6', '#28a745', '#ffc107', '#dc3545', '#dee2e6', '#6c757d', '#212529', '#856404', '#2d3748'];
const presentesJs = VIEJOS_JS.filter(function (h) { return js.includes(h); });
check('JS: sin colores de la paleta vieja' +
  (presentesJs.length ? ' (quedan: ' + presentesJs.join(', ') + ')' : ''),
  presentesJs.length === 0);
check('JS: se eliminó el código muerto (buildGridLines / buildChartPoints / escapeHtml)',
  !js.includes('buildGridLines') && !js.includes('buildChartPoints') && !js.includes('function escapeHtml'));
check('JS: el SVG del gráfico no queda como inline (display:block)',
  /height:auto;display:block;font-family:var\(--freq-font\)/.test(js));
check('JS: conserva el contrato (IIFE + los canales IPC + localStorage)',
  /^\(function\(\)/m.test(js) && js.includes('frecuenciaAccidentalidad') &&
  js.includes("localStorage.getItem('selectedCompany')"));
check('JS: compila (node --check)',
  (function () {
    try { require('child_process').execSync('node --check "' + F_JS + '"', { stdio: 'pipe' }); return true; }
    catch (e) { return false; }
  })());

/* ══════════════ F. RENDERER.JS ══════════════ */
check('renderer.js: token de cache-bust propio en CSS, HTML y JS',
  /const TOKEN = 'FREQ-/.test(renderer) &&
  /frecuencia-accidentalidad\.css\?v=' \+ TOKEN/.test(renderer) &&
  /frecuencia-accidentalidad\.html\?v=' \+ TOKEN/.test(renderer) &&
  /frecuencia-accidentalidad\.js\?v=' \+ TOKEN/.test(renderer));
check('renderer.js: el guard del <link> usa el MISMO href con token',
  /querySelector\(`link\[href="\$\{BASE\}frecuencia-accidentalidad\.css\?v=\$\{TOKEN\}"\]`\)/.test(renderer));
check('renderer.js: sanitiza los <link> a CDN antes de inyectar el HTML con innerHTML',
  /html\.replace\(\/<link\[\^>\]\*https\?:\[\^>\]\*>\/gi, ''\)/.test(renderer) &&
  /parseFromString\(limpio, 'text\/html'\)/.test(renderer));
check('renderer.js: el cache-bust del script ya no usa ?_t=Date.now()',
  !/frecuencia-accidentalidad\.js\?_t=' \+ ts/.test(renderer));
check('index.html: el <script> de renderer.js lleva un token (sin el, la app usa el renderer cacheado y el TOKEN nuevo nunca llega)',
  /<script src="renderer\.js\?v=[^"]+"><\/script>/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));

check('CSS: los 12 meses van en 6 columnas (2 filas) y en 12 columnas (1 fila) en maximizada',
  /\.kair-month-cards-grid \{[^}]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\);/.test(cssLimpio.replace(/\n/g, ' ')) &&
  /@media \(min-width: 1360px\) \{[^@]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\);/.test(cssLimpio.replace(/\n/g, ' ')));
check('JS: el gráfico mide el alto REAL del contenedor (llena el espacio)',
  /var H = Math\.max\(320, Math\.round\(W \* 0\.4\), container\.offsetHeight \|\| 0\);/.test(js) &&
  /var W = Math\.max\(320, Math\.round\(containerWidth\)\);/.test(js));
check('JS: la tabla se renderiza ANTES del gráfico (para poder medir el alto)',
  js.indexOf('renderTabla();') < js.indexOf('renderChart();'));
check('JS: re-render del gráfico al redimensionar (con un solo handler en window)',
  /window\.__freqResizeHandler/.test(js) && /removeEventListener\('resize', window\.__freqResizeHandler\)/.test(js));

/* ══════════════ Reporte ══════════════ */
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) {
    console.log('[OK  ] ' + c.name);
  } else {
    failed++;
    console.log('[FAIL] ' + c.name);
  }
});
console.log('');
console.log((checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed === 0) {
  console.log('✅ 3.3.1 Frecuencia de la Accidentalidad en premium v2');
}
process.exit(failed === 0 ? 0 : 1);
