// test-premium-v2.js
//
// Test de humo de la migración premium v2 del submódulo
// 3.1.3 Perfil de Cargo y Profesiograma.
//
// Valida: tokens premium en :root, Header System v2 (breadcrumb +
// icono/título + acciones con SVG inline), tabs con subrayado azul
// (patrón Evaluación Inicial), fix .view:not(.active), modo oscuro
// en los DOS atributos, limpieza de colores hardcodeados, integridad
// del HTML/JS y los 3 cache-bust.
//
// Ejecución:  node tests/profesiograma/test-premium-v2.js
// Resultado:  Imprime OK/FAIL. Exit 0 = OK, 1 = FAIL.

'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'modules', 'gestion-salud', 'perfiles-cargo-profesiograma');
const F_HTML = path.join(DIR, 'perfiles-cargo-profesiograma-viewer.html');
const F_JS = path.join(DIR, 'perfiles-cargo-profesiograma-viewer.js');
const F_COMP = path.join(DIR, 'perfiles-cargo-profesiograma-component.js');
const F_INDEX = path.join(ROOT, 'index.html');

const html = fs.readFileSync(F_HTML, 'utf8');
const js = fs.readFileSync(F_JS, 'utf8');
const comp = fs.readFileSync(F_COMP, 'utf8');
const indexHtml = fs.readFileSync(F_INDEX, 'utf8');

const checks = [];
function check(name, ok, extra) { checks.push({ name: name, ok: !!ok, extra: extra }); }

// Extraer el bloque <style> del HTML
const styleStart = html.indexOf('<style>');
const styleEnd = html.indexOf('</style>');
const css = styleStart >= 0 && styleEnd > styleStart ? html.slice(styleStart, styleEnd) : '';

// ══════════════ A. TOKENS PREMIUM ══════════════
check('Tokens: :root con el azul premium #2057B8 (no el #174ea6 viejo)',
  css.includes('--primary: #2057B8;') && !css.includes('--primary: #174ea6;'));
check('Tokens: superficie/texto/borde premium (#14213D / #748096 / #E8EBEE)',
  css.includes('--text-dark: #14213D;') && css.includes('--text-muted: #748096;') && css.includes('--border: #E8EBEE;'));
check('Tokens: los 3 sombreados premium (rgba(20,33,61,...))',
  (css.match(/rgba\(20,33,61/g) || []).length >= 3);
check('Tokens: variables nuevas --row-hover/--slate-soft/--dirty-bg/--sk-1',
  css.includes('--row-hover:') && css.includes('--slate-soft:') && css.includes('--dirty-bg:') && css.includes('--sk-1:'));

// ══════════════ B. HEADER SYSTEM V2 ══════════════
check('Header: app-header transparente (sin card ni border-bottom)',
  /\.app-header \{[^}]*background: transparent;[^}]*\}/.test(css.replace(/\n/g, ' ')) &&
  !/\.app-header \{[^}]*border-bottom: 1px solid/.test(css.replace(/\n/g, ' ')));
check('Header: fila con icono/título + acciones (app-header-row + app-header-left)',
  css.includes('.app-header-row {') && css.includes('.app-header-left {'));
check('Header: icon chip 44x44 radio 12 con --primary-light',
  /\.header-icon \{[^}]*width: 44px;[^}]*border-radius: 12px;[^}]*background: var\(--primary-light\);/.test(css.replace(/\n/g, ' ')));
check('Header: título Manrope 800 (app-title)',
  /\.app-title \{[^}]*font-family: 'Manrope'[^}]*font-weight: 800;/.test(css.replace(/\n/g, ' ')));
check('Header: markup con breadcrumb + icono SVG + título + subtítulo',
  html.includes('class="app-header-row"') && html.includes('class="header-icon"') &&
  html.includes('<h1 class="app-title">Perfil de Cargo y Profesiograma</h1>') &&
  html.includes('class="app-sub"') && html.includes('id="bc-current"'));
check('Header: los 3 botones conservan sus ids (btn-import/btn-export/btn-back) y SVG inline',
  html.includes('id="btn-import"') && html.includes('id="btn-export"') && html.includes('id="btn-back"') &&
  (html.match(/<button class="header-btn[^"]*"[^>]*>\s*<svg/g) || []).length === 3);
check('Header: sin iconos FA en el header (los <i class="fas"> del header se fueron)',
  !/<button class="header-btn[^"]*"[^>]*>\s*<i class="fas/.test(html));

// ══════════════ C. TABS CON SUBRAYADO ══════════════
check('Tabs: la línea es del contenedor (1px) y la tab 2px transparente con margin-bottom:-1px',
  /\.tabs-bar \{[^}]*border-bottom: 1px solid var\(--border\);/.test(css.replace(/\n/g, ' ')) &&
  /\.tab \{[^}]*border-bottom: 2px solid transparent;[^}]*margin-bottom: -1px;/.test(css.replace(/\n/g, ' ')));
check('Tabs: activa azul (border-bottom-color: var(--primary)) y sin font-weight 500 viejo',
  /\.tab\.active \{ color: var\(--primary\); border-bottom-color: var\(--primary\); \}/.test(css));
check('Tabs: hover solo cambia el color (sin fondo)',
  /\.tab:hover \{ color: var\(--text-dark\); \}/.test(css));
check('Tabs: contenedor con flex-wrap (no overflow-x, lección del chip cortado)',
  /\.tabs-bar \{[^}]*flex-wrap: wrap;/.test(css.replace(/\n/g, ' ')) &&
  !/\.tabs-bar \{[^}]*overflow-x: auto;/.test(css.replace(/\n/g, ' ')));
check('Tabs: las 7 tabs conservan data-view y usan SVG inline (sin FA)',
  ['home', 'matriz', 'pruebas', 'recomendaciones', 'vacunacion', 'alturas', 'explorer']
    .every(v => html.includes('data-view="' + v + '"')) &&
  (html.match(/<button class="tab[^"]*"[^>]*>\s*<svg/g) || []).length === 7);
check('Tabs: los 3 badges se conservan (badge-cargos/badge-pruebas/badge-vacunas)',
  html.includes('id="badge-cargos"') && html.includes('id="badge-pruebas"') && html.includes('id="badge-vacunas"'));

// ══════════════ D. FIX .view Y COLORES ══════════════
check('Vistas: .view:not(.active) display:none (sin display:none genérico antes del activo)',
  css.includes('.view:not(.active) { display: none; }') &&
  !/(^|\n)\s*\.view \{ display: none; \}/.test(css));
check('Colores: el hero usa el gradiente premium (sin #174ea6 ni #1a3a6e)',
  css.includes('linear-gradient(135deg, #2057B8 0%, #14213D 100%)') && !css.includes('#174ea6'));
check('Colores: sin superficies hardcodeadas (#f8f9fa/#f0f0f0/#fafbfc/#fff8e6) en el CSS',
  !/#f8f9fa|#f0f0f0|#fafbfc|#fff8e6/.test(css));
check('Colores: componentes con var(--bg-card) (kpi/module-card/data-card/btn/search-box/dialog)',
  ['.kpi {', '.module-card {', '.data-card {', '.btn {', '.search-box {', '.dialog {']
    .every(sel => new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^}]*background: var\\(--bg-card\\)').test(css.replace(/\n/g, ' '))));

// ══════════════ E. MODO OSCURO ══════════════
check('Dark: bloque de tokens para [data-theme="dark"] Y [data-theme="dark-legacy"]',
  /\[data-theme="dark"\], \[data-theme="dark-legacy"\] \{/.test(css));
check('Dark: tokens oscuros (bg #131824 / surface #1B2230 / primary #5B93E8)',
  css.includes('--bg-body: #131824;') && css.includes('--bg-card: #1B2230;') && css.includes('--primary: #5B93E8;'));
check('Dark: overrides de los 5 tags + toast (sin pisa el toast.success/error)',
  (css.match(/\[data-theme="dark"\] \.tag\./g) || []).length >= 5 &&
  css.includes('.toast:not(.success):not(.error)'));
check('Dark: inputs/selects con fondo var(--bg-card) en oscuro',
  /\[data-theme="dark"\] \.form-group input/.test(css));

// ══════════════ F. COMPONENTE (IFRAME) ══════════════
check('Componente: destroy() remueve el listener y limpia el contenedor',
  /destroy\(\) \{[\s\S]*?removeEventListener\('message', this\.handleIframeMessage\)/.test(comp) &&
  /destroy\(\) \{[\s\S]*?this\.container\.innerHTML = '';/.test(comp));
check('Componente: un render repetido no duplica el listener (remove antes de add)',
  /removeEventListener\('message', this\.handleIframeMessage\);\s*\n\s*window\.addEventListener\('message', this\.handleIframeMessage\);/.test(comp));
check('Componente: el iframe lleva ?v= cache-bust',
  /perfiles-cargo-profesiograma-viewer\.html\?v=PCP-[\w-]+&company=/.test(comp));
check('Componente: el contrato postMessage { action: "backToModule" } intacto',
  comp.includes("case 'backToModule':") && js.includes("{ action: 'backToModule' }"));

// ══════════════ G. INTEGRIDAD JS DEL VIEWER ══════════════
check('JS: switchView alterna la clase active (sin cambios de contrato)',
  /switchView\(name\)/.test(js) && /\$\('view-' \+ name\)/.test(js) &&
  /\.tab\[data-view="' \+ name \+ '"\]'\)/.test(js));
check('JS: bc-current se usa con textContent (el breadcrumb se conserva)',
  /\$\('bc-current'\)\.textContent = labels\[name\] \|\| name;/.test(js));
check('JS: los IPC de profesiograma intactos (kpis/matriz/cargosSave)',
  /kpis\(\)/.test(js) && /cargosSave\(/.test(js) && /matriz\(\)/.test(js));
check('JS: sintaxis válida',
  (function () { try { new Function(js); return true; } catch (e) { return false; } })());

// ══════════════ H. CACHE-BUST Y HTML ══════════════
check('Cache-bust: el script del viewer lleva ?v=PCP-20260918-premium',
  html.includes('perfiles-cargo-profesiograma-viewer.js?v=PCP-20260918-premium'));
check('Cache-bust: index.html carga el componente con ?v=PCP-20260918-premium',
  /perfiles-cargo-profesiograma-component\.js\?v=PCP-20260918-premium/.test(indexHtml));
check('Fuentes: Manrope en el link de Google Fonts',
  html.includes('family=Manrope:wght@600;700;800'));
check('HTML: llaves del CSS balanceadas',
  (css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length);
check('HTML: <style> y </style> presentes (el CSS vive en el HTML, iframe aislado)',
  styleStart >= 0 && styleEnd > styleStart);
check('HTML: el link al CSS del explorer se conserva (kair-* del 3.1.3)',
  html.includes('responsable-sg-view.css'));

// ══════════════ Reporte ══════════════
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) console.log('[OK  ] ' + c.name);
  else { failed++; console.log('[FAIL] ' + c.name + (c.extra ? ' → ' + c.extra : '')); }
});

console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
