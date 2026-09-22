// test-premium-v2.js
//
// Test de humo de la migración premium v2 del submódulo
// 7.1.1 Matriz de Control Operacional (Acciones Preventivas y Correctivas).
//
// Valida: tokens premium en :root, Header System v2 (breadcrumb +
// icono/título + acciones con SVG inline + IDs del contrato), modo
// oscuro [data-theme^="dark"], limpieza de la paleta vieja, fix de los
// selectores .kair-form-section, sincronización con MejoramientoStore
// ('711'), los 4 cache-bust APC-20260921-v2-scroll y el fix de scroll
// del editor (sin align-items:start + min-height:0 en el main).
//
// Ejecución:  node tests/mejoramiento/test-premium-v2.js
// Resultado:  Imprime OK/FAIL. Exit 0 = OK, 1 = FAIL.

'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'modules', 'mejoramiento', 'acciones-preventivas-correctivas');
const F_CSS = path.join(DIR, 'acciones-pc-view.css');
const F_HTML = path.join(DIR, 'acciones-pc-view.html');
const F_JS = path.join(DIR, 'acciones-pc-viewer.js');
const F_LOGIC = path.join(DIR, 'acciones-pc-logic.js');
const F_INDEX = path.join(ROOT, 'index.html');

const css = fs.readFileSync(F_CSS, 'utf8');
const html = fs.readFileSync(F_HTML, 'utf8');
const js = fs.readFileSync(F_JS, 'utf8');
const logic = fs.readFileSync(F_LOGIC, 'utf8');
const indexHtml = fs.readFileSync(F_INDEX, 'utf8');

const checks = [];
function check(name, ok, extra) { checks.push({ name: name, ok: !!ok, extra: extra }); }

const flat = s => s.replace(/\n/g, ' ');

// ══════════════ A. TOKENS PREMIUM ══════════════
check('Tokens: :root con el azul premium #2057b8 (no el #174ea6 viejo)',
  css.includes('--kair-primary: #2057b8;') && !css.includes('#174ea6'));
check('Tokens: superficie/texto/borde premium (#14213d / #748096 / #e8ebee / #fbfcfb)',
  css.includes('--kair-text: #14213d;') && css.includes('--kair-text-muted: #748096;') &&
  css.includes('--kair-border: #e8ebee;') && css.includes('--kair-bg: #fbfcfb;'));
check('Tokens: fuentes DM Sans (UI) + Manrope (display)',
  css.includes("--kair-font: 'DM Sans'") && css.includes("--kair-font-display: 'Manrope'"));
check('Tokens: radios premium 20px tarjeta / 12px control',
  css.includes('--kair-radius: 20px;') && css.includes('--kair-radius-sm: 12px;'));
check('Tokens: variables nuevas --kair-row-hover / --kair-focus-ring / --kair-header-icon-bg',
  css.includes('--kair-row-hover:') && css.includes('--kair-focus-ring:') && css.includes('--kair-header-icon-bg:'));

// ══════════════ B. HEADER SYSTEM V2 ══════════════
check('Header: clase .kair-header-v2 con fondo transparente',
  /\.kair-header-v2 \{[^}]*background: transparent;/.test(flat(css)));
check('Header: fila con left + acciones (.kair-header-row / .kair-header-left / .kair-header-actions)',
  css.includes('.kair-header-row {') && css.includes('.kair-header-left {') && css.includes('.kair-header-actions {'));
check('Header: icon chip 44x44 radio 12 con --kair-header-icon-bg',
  /\.kair-header-icon \{[^}]*width: 44px;[^}]*height: 44px;[^}]*border-radius: 12px;[^}]*background: var\(--kair-header-icon-bg\);/.test(flat(css)));
check('Header: título Manrope 800 20px (.kair-header-title)',
  /\.kair-header-title \{[^}]*font-family: var\(--kair-font-display\);[^}]*font-size: 20px;[^}]*font-weight: 800;/.test(flat(css)));
check('Header: markup con breadcrumb nav + icono SVG + h1 + subtítulo',
  html.includes('class="kair-header-v2"') && html.includes('class="kair-header-breadcrumb"') &&
  html.includes('<span class="kair-header-icon"') && html.includes('<svg') &&
  html.includes('<h1 id="header-title" class="kair-header-title">') &&
  html.includes('id="header-subtitle"'));
check('Header: los 3 botones conservan sus ids (btn-back/btn-importar/btn-exportar) con SVG inline',
  html.includes('id="btn-back"') && html.includes('id="btn-importar"') && html.includes('id="btn-exportar"') &&
  (html.match(/kair-header-btn[^>]*>\s*<svg/g) || []).length === 3);
check('Header: chip de empresa con SVG + #header-company-text',
  html.includes('class="kair-header-company"') && html.includes('id="header-company-text"') &&
  /kair-header-company[\s\S]{0,200}<svg/.test(html));
check('Contrato: los IDs que usa el viewer siguen presentes (header-title/subtitle/breadcrumb/current/btn-back-text)',
  ['header-title', 'header-subtitle', 'header-breadcrumb', 'header-breadcrumb-current', 'btn-back-text']
    .every(id => html.includes('id="' + id + '"')));
check('Header: breadcrumb de edición como <ol> con data-crumb (hidden por defecto)',
  /<ol id="header-breadcrumb"[^>]*hidden/.test(html) && html.includes('data-crumb="0"'));
check('Header: sin Font Awesome en los botones del header (son SVG)',
  !/kair-header-btn[^>]*>\s*<i class="fa/.test(html));

// ══════════════ C. MODO OSCURO ══════════════
check('Dark: selector [data-theme^="dark"] { cubre dark + dark-legacy',
  /\[data-theme\^="dark"\] \{/.test(css));
check('Dark: tokens oscuros (bg #0f172a / surface #1a2334 / primary #6ea8fe)',
  css.includes('--kair-bg: #0f172a;') && css.includes('--kair-surface: #1a2334;') && css.includes('--kair-primary: #6ea8fe;'));
check('Dark: acentos verde/ámbar/rojo (#3ecf9a / #f0b45a / #e56a76)',
  css.includes('#3ecf9a') && css.includes('#f0b45a') && css.includes('#e56a76'));
check('Dark: override de contraste del botón Volver en oscuro',
  /\[data-theme\^="dark"\] \.kair-header-btn--back \{ color: #0f172a; \}/.test(css));

// ══════════════ D. LIMPIEZA DE LA PALETA VIEJA ══════════════
check('Colores: CSS sin la paleta vieja (#174ea6 / #1E293B / #64748B / #dee2e6 / Inter)',
  !/#174ea6|#1E293B|#64748B|#dee2e6|'Inter'/.test(css));
check('Colores: HTML sin hex viejos inline (#174ea6 / #1E293B / #64748B)',
  !/#174ea6|#1E293B|#64748B/.test(html));
check('Clases: sin .k-section-card ni .header-back-btn en el CSS (Header v2 los reemplazó)',
  !css.includes('k-section-card') && !css.includes('header-back-btn'));
check('Reset: body con overflow:hidden y .kair-app con flex chain + overflow:hidden',
  /body \{[^}]*overflow: hidden;/.test(flat(css)) &&
  /\.kair-app \{ display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; \}/.test(css));
check('HTML: llaves del CSS balanceadas',
  (css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length);

// ══════════════ E. FIXES DE JAVASCRIPT ══════════════
check('JS: fix del selector — sin el backslash roto \'\\.kair-form-section\'',
  !js.includes("'\\.kair-form-section'"));
check('JS: el selector .kair-form-section se usa correcto (querySelectorAll/closest)',
  js.includes("querySelectorAll('.kair-form-section')") && js.includes("closest('.kair-form-section')"));
check('JS: _syncMejoramientoStore existe y se llama desde render()',
  /function _syncMejoramientoStore\(\)/.test(js) &&
  /function render\(\) \{[\s\S]{0,200}_syncMejoramientoStore\(\);/.test(js));
check('JS: MejoramientoStore.update con el código 711 y guard de seguridad',
  js.includes("MejoramientoStore.update('711'") &&
  js.includes('window.MejoramientoStore && typeof window.MejoramientoStore.update'));
check('JS: _setHeaderMode conservado (contrato title/subtitle/breadcrumb con textContent)',
  /function _setHeaderMode\(/.test(js) && /getElementById\('header-title'\)/.test(js));
check('JS: sintaxis válida',
  (function () { try { new Function(js); return true; } catch (e) { return false; } })());
check('JS: lógica sintaxis válida',
  (function () { try { new Function(logic); return true; } catch (e) { return false; } })());

// ══════════════ F. FIX DE SCROLL DEL EDITOR ══════════════
check('Scroll: .kair-editor SIN align-items:start (rompía el alto de la fila main)',
  !/\.kair-editor \{[^}]*align-items: start/.test(flat(css)));
check('Scroll: .kair-editor__main con min-height:0 (permite overflow-y:auto)',
  /\.kair-editor__main \{[^}]*min-height: 0;[^}]*overflow-y: auto;/.test(flat(css)));
check('Scroll: .kair-editor__sidebar conserva align-self:start (no se estira)',
  /\.kair-editor__sidebar \{[^}]*align-self: start;/.test(flat(css)));
check('Scroll: vista lista usa .kair-main (clase con reglas, no .kair-app-main huérfana)',
  html.includes('class="kair-main" id="main-view"') && !html.includes('kair-app-main'));

// ══════════════ G. CACHE-BUST TRIPLE ══════════════
check('Cache-bust: HTML carga el CSS con ?v=APC-20260921-v2-scroll',
  html.includes('acciones-pc-view.css?v=APC-20260921-v2-scroll'));
check('Cache-bust: HTML carga el viewer con ?v=APC-20260921-v2-scroll',
  html.includes('acciones-pc-viewer.js?v=APC-20260921-v2-scroll'));
check('Cache-bust: logic.js versiona la URL del iframe con &v=APC-20260921-v2-scroll',
  /acciones-pc-view\.html\?company=[\s\S]*&v=APC-20260921-v2-scroll/.test(logic));
check('Cache-bust: index.html carga logic.js con ?v=APC-20260921-v2-scroll',
  /acciones-pc-logic\.js\?v=APC-20260921-v2-scroll/.test(indexHtml));

// ══════════════ Reporte ══════════════
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) console.log('[OK  ] ' + c.name);
  else { failed++; console.log('[FAIL] ' + c.name + (c.extra ? ' → ' + c.extra : '')); }
});

console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
