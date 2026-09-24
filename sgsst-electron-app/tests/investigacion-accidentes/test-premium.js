// test-premium.js
//
// Test de humo de la migración premium del submódulo
// 3.2.2 Investigación de Accidentes e Incidentes.
//
// Valida: que se haya quitado el <link> GLOBAL que filtraba (html/body/
// k-section-card), el Header System v2 en las 3 vistas, los tokens premium,
// el modo oscuro en los DOS atributos, la tipografía y los cache-bust.
//
// Ejecución:  node tests/investigacion-accidentes/test-premium.js
// Resultado:  Imprime OK/FAIL. Exit 0 = OK, 1 = FAIL.

'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'modules', 'gestion-salud', 'investigacion-accidentes');
const F_PORTAL = path.join(DIR, 'investigacion-home.html');
const F_VIEW = path.join(DIR, 'investigacion-accidentes-view.html');
const F_VIEW_CSS = path.join(DIR, 'investigacion-accidentes-view.css');
const F_LIST = path.join(DIR, 'investigaciones-view.html');
const F_LIST_CSS = path.join(DIR, 'investigaciones-view.css');
const F_LOGIC = path.join(DIR, 'investigacion-accidentes-logic.js');
const F_INDEX = path.join(ROOT, 'index.html');

const portal = fs.readFileSync(F_PORTAL, 'utf8');
const view = fs.readFileSync(F_VIEW, 'utf8');
const viewCss = fs.readFileSync(F_VIEW_CSS, 'utf8');
const list = fs.readFileSync(F_LIST, 'utf8');
const listCss = fs.readFileSync(F_LIST_CSS, 'utf8');
const logic = fs.readFileSync(F_LOGIC, 'utf8');
const indexHtml = fs.readFileSync(F_INDEX, 'utf8');

function sinComentarios(t) {
  return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/[^\n]*$/gm, '');
}
const viewCssLimpio = sinComentarios(viewCss);
const listCssLimpio = sinComentarios(listCss);
const portalLimpio = sinComentarios(portal);

const checks = [];
function check(name, ok, extra) { checks.push({ name: name, ok: !!ok, extra: extra }); }

/* ══════════════ A. FUGA GLOBAL CORREGIDA ══════════════ */
check('index.html: NO carga la hoja del módulo en global (fuga de html/body/k-section-card)',
  !/<link[^>]*investigacion-accidentes-view\.css/.test(indexHtml));
check('index.html: carga el logic.js con cache-bust',
  /investigacion-accidentes-logic\.js\?v=INV-/.test(indexHtml));
check('La hoja que filtraba traía html, body y .k-section-card sin scope',
  /^html, body \{/m.test(viewCssLimpio) && /^\.k-section-card \{/m.test(viewCssLimpio));

/* ══════════════ B. PORTAL PREMIUM ══════════════ */
check('Portal: el marcado va bajo .inv-portal-scope',
  /<div class="inv-portal-scope">/.test(portal) && /\.inv-portal-scope \{/.test(portal));
check('Portal: SIN :root global (no filtra tokens)',
  !/(^|\})\s*:root\s*\{/.test(portalLimpio));
check('Portal: SIN reset * global',
  !/(^|\n)\s*\*\s*\{/.test(portalLimpio) && /\.inv-portal-scope \*/.test(portal));
check('Portal: Header System v2 (breadcrumb + icon chip + título Manrope)',
  portal.includes('class="invp-breadcrumb"') && portal.includes('class="invp-head-icon"') &&
  /\.invp-title \{[^}]*font-family: var\(--invp-font-display\)/.test(portal));
check('Portal: iconos en SVG inline y sin CDN de iconos',
  (portal.match(/<svg /g) || []).length >= 8 && !/font-awesome|bootstrap-icons/.test(portal));
check('Portal: KPIs + 2 acciones + 4 herramientas',
  portal.includes('id="investigacionesPendientes"') && portal.includes('id="investigacionesCompletadas"') &&
  (portal.match(/class="invp-action /g) || []).length === 2 &&
  (portal.match(/class="invp-quick-card"/g) || []).length === 4);
check('Portal: conserva los handlers del home.js',
  portal.indexOf('realizarInvestigacion()') >= 0 && portal.indexOf('verInvestigaciones()') >= 0 &&
  portal.indexOf('goBackToModule()') >= 0 && portal.indexOf('abrirEstadisticas()') >= 0);
check('Portal: modo oscuro dark y dark-legacy',
  /\[data-theme="dark"\] \.inv-portal-scope/.test(portal) &&
  /\[data-theme="dark-legacy"\] \.inv-portal-scope/.test(portal));
check('Portal CSS: el portal usa TODO el ancho (sin max-width centrado)',
  /\.invp-portal \{[^}]*max-width: none;/.test(portalLimpio.replace(/\n/g, ' ')) &&
  !/\.invp-portal \{[^}]*max-width: 1120px;/.test(portalLimpio.replace(/\n/g, ' ')));

/* ══════════════ C. VISTA "REALIZAR INVESTIGACIÓN" ══════════════ */
check('Realizar: Header System v2 (breadcrumb + icon chip + título + acciones)',
  view.includes('class="inv-header-v2"') && view.includes('class="inv-breadcrumb"') &&
  view.includes('class="inv-header-icon"') && view.includes('class="inv-title"') &&
  view.includes('class="inv-header-actions"'));
check('Realizar: conserva los ids del header (downloadBtn/printBtn/backBtn)',
  view.includes('id="downloadBtn"') && view.includes('id="printBtn"') && view.includes('id="backBtn"'));
check('Realizar: sin iconos FA en el header (SVG inline)',
  !/class="inv-header-v2"[\s\S]*?<\/header>[\s\S]{0,200}<i class="fas/.test(view));
check('Realizar CSS: tokens premium (#2057b8 / #fbfcfb / DM Sans + Manrope / radios)',
  /--inv-primary: #2057b8;/.test(viewCss) && /--inv-surface: #fbfcfb;/.test(viewCss) &&
  /--inv-font-body: 'DM Sans'/.test(viewCss) && /--inv-font-display: 'Manrope'/.test(viewCss) &&
  /--inv-radius: 12px;/.test(viewCss));
check('Realizar CSS: modo oscuro con [data-theme^="dark"] (cubre dark y dark-legacy)',
  /\[data-theme\^="dark"\] \{/.test(viewCss) && /--inv-surface: #0f172a;/.test(viewCss) &&
  /--inv-surface-card: #1a2334;/.test(viewCss));
check('Realizar CSS: el body hereda la tipografía premium (el header vive fuera de .inv-layout)',
  /body \{[^}]*font-family: var\(--inv-font-body\)/.test(viewCss.replace(/\n/g, ' ')));
check('Realizar CSS: Header v2 definido (.inv-header-v2 + .inv-btn)',
  /\.inv-header-v2 \{/.test(viewCss) && /\.inv-btn \{/.test(viewCss));
check('Realizar: la hoja y el script llevan cache-bust',
  view.includes('investigacion-accidentes-view.css?v=INV-') &&
  view.includes('investigacion-accidentes-main.js?v=INV-'));
check('Realizar: tipografía premium en el link de Google Fonts',
  /family=DM\+Sans[^"]*family=Manrope/.test(view));

/* ══════════════ D. VISTA "VER INVESTIGACIONES" ══════════════ */
check('Ver: Header System v2',
  list.includes('class="inv-header-v2"') && list.includes('class="inv-breadcrumb"') &&
  list.includes('class="inv-title"') && list.includes('class="inv-header-actions"'));
check('Ver: conserva los ids del header (invCompanyName/refreshBtn/refreshIcon/backBtn)',
  list.includes('id="invCompanyName"') && list.includes('id="refreshBtn"') &&
  list.includes('id="refreshIcon"') && list.includes('id="backBtn"'));
check('Ver CSS: tokens premium (#2057b8 / #fbfcfb / DM Sans)',
  /--inv-primary: #2057b8;/.test(listCss) && /--inv-bg-body: #fbfcfb;/.test(listCss) &&
  /--inv-font-body: 'DM Sans'/.test(listCss));
check('Ver CSS: modo oscuro con [data-theme^="dark"] + tokens oscuros',
  /\[data-theme\^="dark"\] \{/.test(listCss) && /--inv-bg-body: #0f172a;/.test(listCss) &&
  /--inv-bg-card: #1a2334;/.test(listCss));
check('Ver CSS: Header v2 definido + animación del botón Actualizar',
  /\.inv-header-v2 \{/.test(listCss) && /\.inv-btn \{/.test(listCss) && /inv-btn-spin/.test(listCss));
check('Ver: la hoja y el script llevan cache-bust',
  list.includes('investigaciones-view.css?v=INV-') && list.includes('investigaciones-viewer.js?v=INV-'));
check('Ver CSS: el cuerpo usa TODO el ancho en maximizada (sin max-width centrado)',
  /\.inv-body \{[^}]*max-width: none;/.test(listCss.replace(/\n/g, ' ')) &&
  /\.inv-body \{[^}]*margin: 0;/.test(listCss.replace(/\n/g, ' ')) &&
  !/\.inv-body \{[^}]*max-width: 1200px;/.test(listCss.replace(/\n/g, ' ')));
check('Ver CSS: el buscador tiene un tope razonable (no se estira a todo el ancho)',
  /\.inv-search-wrapper \{[^}]*max-width: clamp\(/.test(listCss.replace(/\n/g, ' ')));
check('Ver CSS: la LISTA pasa a 2 columnas solo en maximizada (>=1360px)',
  /@media \(min-width: 1360px\)/.test(listCss) &&
  /\.inv-cards-list:not\(\.inv-cards-grid\) \{[^}]*display: grid;/.test(listCss.replace(/\n/g, ' ')) &&
  /\.inv-cards-list:not\(\.inv-cards-grid\) \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/.test(listCss.replace(/\n/g, ' ')) &&
  /\.inv-cards-list:not\(\.inv-cards-grid\) \.inv-card \{[^}]*margin-bottom: 0;/.test(listCss.replace(/\n/g, ' ')));
check('Ver CSS: la 2-columnas NO toca la vista de CUADRÍCULA (auto-fill intacto)',
  /\.inv-cards-list\.inv-cards-grid \{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(340px, 1fr\)\);/.test(listCss.replace(/\n/g, ' ')));
check('Ver CSS: estado vacío y esqueleto ocupan todas las columnas (no media tarjeta)',
  /\.inv-cards-list > \.inv-empty,[^}]*\.inv-cards-list > \.ks-list \{[^}]*grid-column: 1 \/ -1;/.test(listCss.replace(/\n/g, ' ')));

/* ══════════════ E. CACHE-BUST DE LOS IFRAMES ══════════════ */
check('logic.js: las 4 URLs de iframe llevan cache-bust ?v=INV-',
  (logic.match(/\.html\?[^`]*&v=INV-/g) || []).length === 4);
check('logic.js: compila (node --check)',
  (function () {
    try { require('child_process').execSync('node --check "' + F_LOGIC + '"', { stdio: 'pipe' }); return true; }
    catch (e) { return false; }
  })());

/* ══════════════ Reporte ══════════════ */
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) console.log('[OK  ] ' + c.name);
  else { failed++; console.log('[FAIL] ' + c.name + (c.extra ? ' → ' + c.extra : '')); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ 3.2.2 Investigación de Accidentes e Incidentes en premium v2');
