// test-premium.js
//
// Test de humo de la migración premium del submódulo
// 3.2.3 Registro y Análisis Estadístico de Incidentes, Accidentes
// y Enfermedades Laborales.
//
// Valida: Header System v2, la paleta canónica, el modo oscuro en los DOS
// atributos, el scoping del CSS (no filtra a otros módulos), que se hayan
// quitado las clases globales .k-section-card/.header-back-btn, los colores
// de los 9 gráficos y los cache-bust.
//
// Ejecución:  node tests/registro-estadistico/test-premium.js
// Resultado:  Imprime OK/FAIL. Exit 0 = OK, 1 = FAIL.

'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'modules', 'gestion-salud', 'registro-estadistico');
const F_HTML = path.join(DIR, 'registro-estadistico.html');
const F_CSS = path.join(DIR, 'registro-estadistico.css');
const F_JS = path.join(DIR, 'registro-estadistico.js');
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

/* ══════════════ A. HTML — HEADER SYSTEM v2 ══════════════ */
check('HTML: Header System v2 (header v2 + breadcrumb + título + acciones)',
  html.includes('class="kair-s323-header-v2"') && html.includes('class="kair-s323-breadcrumb"') &&
  html.includes('class="kair-s323-title"') && html.includes('class="kair-s323-header-actions"'));
check('HTML: icon chip + subtítulo + chip de empresa + botón Volver',
  html.includes('class="kair-s323-header-icon"') && html.includes('class="kair-s323-sub"') &&
  html.includes('class="kair-s323-company"') && html.includes('class="kair-s323-btn kair-s323-btn--primary"'));
check('HTML: el header YA NO usa las clases globales .k-section-card / .header-back-btn',
  !html.includes('k-section-card') && !html.includes('header-back-btn'));
check('HTML: tabs con el contrato del JS (clase + data-tab + badge)',
  (html.match(/class="kair-s323-tab active" data-tab="datos"/g) || []).length === 1 &&
  (html.match(/class="kair-s323-tab" data-tab="tablero"/g) || []).length === 1 &&
  html.includes('class="k-tab-badge" id="kTabBadgeDatos"') &&
  html.includes('class="k-tab-badge" id="kTabBadgeTablero"'));
check('HTML: iconos en SVG en línea (sin Font Awesome ni kair-icon-building)',
  !html.includes('class="fas fa-') && !html.includes('kair-icon-building') &&
  html.includes('stroke="currentColor"'));

/* ══════════════ B. HTML — LOS 49 IDs QUE USA EL JS ══════════════ */
const IDS = [
  'kCompanyName', 'kBtnBack', 'kTabBadgeDatos', 'kTabBadgeTablero',
  'kLoadingState', 'kEmptyState', 'kEmptyTitle', 'kEmptyDesc', 'kDataContent',
  'kSearchInput', 'kFilterAnio', 'kFilterSeveridad', 'kFilterEvento', 'kFilterCiudad',
  'kBtnRefresh', 'kBtnExportCsv', 'kBtnLoadSample',
  'kTableHead', 'kTableBody', 'kPagination',
  'kModalBackdrop', 'kModalGrid', 'kModalTitle', 'kModalClose',
  'kBtnPrintDash', 'kBtnClearFilters',
  'kDashDesde', 'kDashHasta', 'kDashCiudad', 'kDashTipoEvento', 'kDashSeveridad',
  'kPeriodText', 'kKpiGrid', 'kSgsstGrid', 'kAlertList',
  'kChartByYear', 'kChartSeveridad', 'kChartMensual', 'kChartParteCuerpo',
  'kChartMecanismo', 'kChartLugar', 'kChartTipoAnio', 'kChartTipoLesion', 'kChartSevSexo',
  'kTop5Mecanismos', 'kTop5Lugares', 'kRecsList',
  'panelDatos', 'panelTablero'
];
const idsFaltantes = IDS.filter(function (id) { return !html.includes('id="' + id + '"'); });
check('HTML: los ' + IDS.length + ' ids del contrato con el JS siguen presentes' +
  (idsFaltantes.length ? ' (faltan: ' + idsFaltantes.join(', ') + ')' : ''),
  idsFaltantes.length === 0);

/* ══════════════ C. CSS — PALETA CANÓNICA ══════════════ */
check('CSS: tokens remapeados a la paleta canónica',
  /--k-primary: #2057b8;/.test(css) && /--k-bg-app: #fbfcfb;/.test(css) &&
  /--k-text-dark: #14213d;/.test(css) && /--k-border: #e8ebee;/.test(css) &&
  /--k-success: #1bb888;/.test(css) && /--k-danger: #da5563;/.test(css));
check('CSS: tipografía DM Sans + Manrope y radio de tarjeta 20px',
  /--k-font: 'DM Sans'/.test(css) && /--k-font-display: 'Manrope'/.test(css) &&
  /--k-radius-card: 20px;/.test(css));
check('CSS: sin :root (los tokens viven en .kair-s323)',
  !/(^|\n)\s*:root\s*\{/.test(cssLimpio));
check('CSS: las tarjetas usan el radio 20px (--k-radius-card)',
  /\.kair-s323-card \{[^}]*border-radius: var\(--k-radius-card\);/.test(cssLimpio.replace(/\n/g, ' ')) &&
  /\.kair-s323-kpi-card \{[^}]*border-radius: var\(--k-radius-card\);/.test(cssLimpio.replace(/\n/g, ' ')));

/* ══════════════ D. CSS — SIN FUGA A OTROS MÓDULOS ══════════════ */
check('CSS: se eliminaron las reglas globales .k-section-card / .header-back-btn',
  !cssLimpio.includes('k-section-card') && !cssLimpio.includes('header-back-btn'));

function selectoresSueltos(texto) {
  const malos = [];
  texto.split('\n').forEach(function (linea) {
    const t = linea.trim();
    if (!t.endsWith('{') || t.startsWith('@')) return;
    const sel = t.slice(0, -1).trim();
    if (!sel || /^(from|to|\d+%)/.test(sel)) return;
    sel.split(',').map(function (s) { return s.trim(); }).forEach(function (p) {
      if (p && !/^\.kair-s323/.test(p) && !/^\[data-theme/.test(p)) malos.push(p);
    });
  });
  return malos;
}
const sueltos = selectoresSueltos(cssLimpio);
check('CSS: TODOS los selectores están bajo .kair-s323 o [data-theme^="dark"]' +
  (sueltos.length ? ' (sueltos: ' + sueltos.slice(0, 6).join(' | ') + ')' : ''),
  sueltos.length === 0);
check('CSS: los @keyframes tienen prefijo propio (no chocan con otros módulos)',
  /@keyframes kairS323Spinner/.test(css) && /@keyframes kairS323FadeIn/.test(css) &&
  /@keyframes kairS323SlideUp/.test(css) &&
  !/@keyframes kSpinnerRotate/.test(css) && !/@keyframes kFadeIn/.test(css) && !/@keyframes kSlideUp/.test(css));

/* ══════════════ E. CSS — MODO OSCURO (los DOS atributos) ══════════════ */
check('CSS: modo oscuro con [data-theme^="dark"] (cubre dark Y dark-legacy)',
  /\[data-theme\^="dark"\] \.kair-s323 \{/.test(css) &&
  /\[data-theme\^="dark"\] \.kair-s323 \{[^}]*--k-bg-app: #0f172a;/.test(css.replace(/\n/g, ' ')) &&
  /\[data-theme\^="dark"\] \.kair-s323 \{[^}]*--k-bg-card: #1a2334;/.test(css.replace(/\n/g, ' ')) &&
  /\[data-theme\^="dark"\] \.kair-s323 \{[^}]*--k-primary: #6ea8fe;/.test(css.replace(/\n/g, ' ')));
check('CSS: superficies con fondo azul usan un azul oscuro en modo oscuro (texto blanco legible)',
  /\[data-theme\^="dark"\] \.kair-s323 \.kair-s323-btn--primary/.test(css) &&
  /\[data-theme\^="dark"\] \.kair-s323 \.kair-s323-modal-header/.test(css) &&
  /background: #2f5fa8;/.test(css));
check('CSS: chips y estados derivan el fondo con color-mix (sirven en claro y oscuro)',
  /\.kair-s323-badge \{[^}]*background: color-mix\(in srgb, currentColor 12%, transparent\);/.test(css.replace(/\n/g, ' ')) &&
  /\.k-sgsst-status \{[^}]*background: color-mix\(in srgb, currentColor 12%, transparent\);/.test(css.replace(/\n/g, ' ')));

/* ══════════════ F. CSS — SIN HEX VIEJOS ══════════════ */
const VIEJOS = ['#174ea6', '#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6f42c1', '#dee2e6', '#f8f9fa', '#e67e00'];
const presentes = VIEJOS.filter(function (h) { return cssLimpio.toLowerCase().includes(h); });
check('CSS: sin colores de la paleta vieja' + (presentes.length ? ' (quedan: ' + presentes.join(', ') + ')' : ''),
  presentes.length === 0);

/* ══════════════ G. JS — GRÁFICOS Y CONTRATO ══════════════ */
const VIEJOS_JS = ['#174ea6', '#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6f42c1'];
const presentesJs = VIEJOS_JS.filter(function (h) { return js.includes(h); });
check('JS: los 9 gráficos usan la paleta canónica' +
  (presentesJs.length ? ' (quedan: ' + presentesJs.join(', ') + ')' : ''),
  presentesJs.length === 0);
check('JS: los ejes/leyenda/rejilla de Chart.js siguen el tema (claro / oscuro)',
  /Chart\.defaults\.color = _isDark/.test(js) && /Chart\.defaults\.borderColor = _isDark/.test(js) &&
  /Chart\.defaults\.font\.family/.test(js) && /getAttribute\('data-theme'\)/.test(js));
check('JS: conserva el contrato (IIFE + window.kairRegistroEstadistico + canal IPC)',
  /window\.kairRegistroEstadistico\s*=/.test(js) &&
  js.includes('registroEstadisticoCargarDatos'));
check('JS: compila (node --check)',
  (function () {
    try { require('child_process').execSync('node --check "' + F_JS + '"', { stdio: 'pipe' }); return true; }
    catch (e) { return false; }
  })());

/* ══════════════ H. RENDERER.JS — MONTAJE ══════════════ */
check('renderer.js: token de cache-bust propio en CSS, HTML y JS',
  /const TOKEN = 'RES-/.test(renderer) &&
  /registro-estadistico\.css\?v=' \+ TOKEN/.test(renderer) &&
  /registro-estadistico\.html\?v=' \+ TOKEN/.test(renderer) &&
  /registro-estadistico\.js\?v=' \+ TOKEN/.test(renderer));
check('renderer.js: el guard del <link> usa el MISMO href con token',
  /querySelector\(`link\[href="\$\{BASE\}registro-estadistico\.css\?v=\$\{TOKEN\}"\]`\)/.test(renderer));
check('renderer.js: sanitiza los <link> a CDN antes de inyectar el HTML con innerHTML',
  /html\.replace\(\/<link\[\^>\]\*https\?:\[\^>\]\*>\/gi, ''\)/.test(renderer) &&
  /parseFromString\(limpio, 'text\/html'\)/.test(renderer));

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
  console.log('✅ 3.2.3 Registro y Análisis Estadístico en premium v2');
}
process.exit(failed === 0 ? 0 : 1);
