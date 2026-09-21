// test-premium-v2.js
//
// Test de humo de la migración premium v2 del submódulo
// 3.2.1 Reportes de Accidentes (FURAT).
//
// Valida: tokens premium en :root, Header System v2 (breadcrumb +
// icon chip + título Manrope + acción Volver con SVG inline), tabs con
// subrayado azul (patrón Evaluación Inicial), modo oscuro en los DOS
// atributos de la app (dark y dark-legacy), limpieza de colores
// hardcodeados, reset scoped, integridad del HTML/JS y los 3 cache-bust.
//
// Ejecución:  node tests/reportes-accidentes/test-premium-v2.js
// Resultado:  Imprime OK/FAIL. Exit 0 = OK, 1 = FAIL.

'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'modules', 'gestion-salud', 'reportes-accidentes');
const F_CSS = path.join(DIR, 'reportes-accidentes-view.css');
const F_HTML = path.join(DIR, 'reportes-accidentes-view.html');
const F_JS = path.join(DIR, 'reportes-accidentes-viewer.js');
const F_LOGIC = path.join(DIR, 'reportes-accidentes-logic.js');
const F_INDEX = path.join(ROOT, 'index.html');

const css = fs.readFileSync(F_CSS, 'utf8');
const html = fs.readFileSync(F_HTML, 'utf8');
const js = fs.readFileSync(F_JS, 'utf8');
const logic = fs.readFileSync(F_LOGIC, 'utf8');
const indexHtml = fs.readFileSync(F_INDEX, 'utf8');

// CSS sin saltos de línea para regex de bloques
const flat = css.replace(/\s+/g, ' ');

const checks = [];
function check(name, ok, extra) { checks.push({ name: name, ok: !!ok, extra: extra }); }

// ══════════════ A. TOKENS PREMIUM ══════════════
check('Tokens: azul premium #2057b8 (sin el #174ea6 viejo)',
  css.includes('--furat-primary: #2057b8;') && !css.includes('#174ea6'));
check('Tokens: texto/borde premium (#14213d / #e8ebee)',
  css.includes('--furat-text-primary: #14213d;') && css.includes('--furat-border: #e8ebee;'));
check('Tokens: sombras premium rgba(37,56,82,...) (>=3)',
  (css.match(/rgba\(37, 56, 82/g) || []).length >= 3);
check('Tokens: variables nuevas para superficies hardcodeadas (row-hover/slate-soft/blue-soft/header-icon-bg)',
  css.includes('--furat-row-hover:') && css.includes('--furat-slate-soft:') &&
  css.includes('--furat-blue-soft:') && css.includes('--furat-header-icon-bg:'));
check('Tokens: tipografía premium (DM Sans UI + Manrope display)',
  css.includes("--furat-font: 'DM Sans'") && css.includes("--furat-font-display: 'Manrope'"));
check('Tokens: el token viejo #f8f9fa / #dee2e6 / #5a6378 ya no existe',
  !css.includes('#f8f9fa') && !css.includes('#dee2e6') && !css.includes('#5a6378'));

// ══════════════ B. HEADER SYSTEM V2 ══════════════
check('Header: .furat-header-v2 transparente (sin card ni borde)',
  /\.furat-header-v2 \{[^}]*background: transparent;/.test(flat));
check('Header: fila con icono/título + acciones (.furat-header-row + .furat-header-left)',
  css.includes('.furat-header-row {') && css.includes('.furat-header-left {'));
check('Header: icon chip 44x44 radio 12 con var(--furat-header-icon-bg)',
  /\.furat-header-icon \{[^}]*width: 44px;[^}]*height: 44px;[^}]*border-radius: 12px;[^}]*background: var\(--furat-header-icon-bg\);/.test(flat));
check('Header: título Manrope 800 (.furat-title)',
  /\.furat-title \{[^}]*font-family: var\(--furat-font-display\);[^}]*font-weight: 800;/.test(flat));
check('Header: markup con breadcrumb + icon chip + título + subtítulo',
  html.includes('class="furat-header-v2"') && html.includes('class="furat-breadcrumb"') &&
  html.includes('class="furat-header-icon"') && html.includes('<h1 class="furat-title">Reportes de Accidentes</h1>') &&
  html.includes('class="furat-subtitle"'));
check('Header: botón Volver conserva id="backBtn" y usa SVG inline',
  /id="backBtn"[^>]*>[\s\S]*?<svg/.test(html) && html.includes('class="furat-back-btn"'));
check('Header: empresa conserva id="header-company-text"',
  html.includes('id="header-company-text"'));
check('Header: sin iconos Font Awesome en el header (se fueron los <i class="fas">)',
  (function () {
    var m = html.match(/<header class="furat-header-v2">[\s\S]*?<\/header>/);
    return !!m && !m[0].includes('<i class="fas');
  })());
check('Header: el markup viejo .k-section-card ya no está',
  !html.includes('k-section-card'));

// ══════════════ C. TABS CON SUBRAYADO ══════════════
check('Tabs: contenedor con línea inferior 1px y flex-wrap (sin overflow-x)',
  /\.furat-header-v2 \.em-tabs \{[^}]*border-bottom: 1px solid var\(--furat-border\);[^}]*flex-wrap: wrap;/.test(flat) &&
  !/\.furat-header-v2 \.em-tabs \{[^}]*overflow-x: auto;/.test(flat));
check('Tabs: tab 2px transparente con margin-bottom:-1px (se monta sobre la línea)',
  /\.furat-app \.em-tab \{[^}]*margin-bottom: -1px;[^}]*border-bottom: 2px solid transparent;/.test(flat));
check('Tabs: activa azul (color + border-bottom-color var(--furat-primary))',
  /\.furat-app \.em-tab--active \{[^}]*color: var\(--furat-primary\);[^}]*border-bottom-color: var\(--furat-primary\);/.test(flat));
check('Tabs: hover solo cambia el color (sin fondo)',
  /\.furat-app \.em-tab:hover \{ color: var\(--furat-primary\); \}/.test(css));
check('Tabs: contrato conservado (.em-tabs/.em-tab/.em-tab--active + data-view)',
  html.includes('class="em-tabs"') && html.includes('class="em-tab em-tab--active"') &&
  html.includes('data-view="dashboard"') && html.includes('data-view="library"'));
check('Tabs: los 2 tabs usan SVG inline (sin FA)',
  (html.match(/<button class="em-tab[^"]*"[^>]*>\s*<svg/g) || []).length === 2);

// ══════════════ D. MODO OSCURO (2 atributos) ══════════════
check('Dark: el selector ^="dark" cubre dark Y dark-legacy sin duplicar reglas',
  css.includes('[data-theme^="dark"]') && !css.includes('[data-theme="dark"]') &&
  !css.includes('[data-theme="dark-legacy"]'));
check('Dark: tokens oscuros (bg #0f172a / card #1a2334 / primary #6ea8fe)',
  css.includes('--furat-bg-app: #0f172a;') && css.includes('--furat-bg-card: #1a2334;') &&
  css.includes('--furat-primary: #6ea8fe;'));
check('Dark: el bloque oscuro también define --furat-header-icon-bg',
  /\[data-theme\^="dark"\] \{[^}]*--furat-header-icon-bg:/.test(flat));
check('Dark: ya no quedan reglas de header con hex fijo (#1e1e2f / #3a3a4d)',
  !css.includes('#1e1e2f') && !css.includes('#3a3a4d'));

// ══════════════ E. RESET SCOPED ══════════════
check('Reset: el * está scopado a body/.furat-app (no hay reset global suelto)',
  css.includes('body, .furat-app, .furat-app * { margin: 0; padding: 0; box-sizing: border-box; }') &&
  !/(^|\n)\* \{ margin: 0; padding: 0; box-sizing: border-box; \}/.test(css));

// ══════════════ E2. LAYOUT: SCROLL INTERNO (header fijo) ══════════════
check('Layout: html/body height 100% + body overflow hidden (el body NO scrollea)',
  css.includes('html { height: 100%; }') &&
  /body \{[^}]*height: 100%;[^}]*overflow: hidden;/.test(flat));
check('Layout: .furat-app height 100% (no min-height 100vh) + overflow hidden',
  /\.furat-app \{[^}]*height: 100%;[^}]*overflow: hidden;/.test(flat) &&
  !/\.furat-app \{[^}]*min-height: 100vh;/.test(flat));
check('Layout: .kpi-strip flex-shrink:0 y alineado con el header (margin lateral clamp)',
  /\.kpi-strip \{[^}]*margin: 0 clamp\(16px, 1\.8vw, 28px\) 16px;[^}]*flex-shrink: 0;/.test(flat));
check('Layout: .furat-header-v2 con flex-shrink:0 (no se encoge)',
  /\.furat-header-v2 \{[^}]*flex-shrink: 0;/.test(flat));
check('Layout: el iframe llena el alto (flex:1 + height:100% + min-height:0)',
  /viewerFrame\.style\.flex = '1';/.test(logic) &&
  /viewerFrame\.style\.height = '100%';/.test(logic) &&
  /viewerFrame\.style\.minHeight = '0';/.test(logic));
check('Layout: el contenedor NO scrollea (height 100% + overflow hidden, no auto)',
  /this\.container\.style\.height = '100%';/.test(logic) &&
  /this\.container\.style\.overflow = 'hidden';/.test(logic) &&
  !/this\.container\.style\.height = 'auto';/.test(logic));

// ══════════════ F. COMPONENTE (IFRAME) ══════════════
check('Componente: el iframe lleva ?v=FURAT-20260918-premium-fix2',
  logic.includes('&v=FURAT-20260918-premium-fix2'));
check('Componente: un render repetido no duplica el listener (remove antes de add)',
  /if \(this\._messageHandler\) \{\s*\n\s*window\.removeEventListener\('message', this\._messageHandler\);\s*\n\s*\}/.test(logic));
check('Componente: destroy() remueve el listener',
  /destroy\(\) \{[\s\S]*?removeEventListener\('message', this\._messageHandler\)/.test(logic));
check('Componente: el contrato { type: "back-to-module-request" } intacto',
  logic.includes("data.type === 'back-to-module-request'") &&
  js.includes("type: 'back-to-module-request'"));

// ══════════════ G. INTEGRIDAD JS ══════════════
check('JS: viewer engancha .em-tab y alterna em-tab--active (contrato de tabs)',
  js.includes("querySelectorAll('.em-tab')") &&
  js.includes("classList.toggle('em-tab--active'"));
check('JS: switchView alterna furat-view--active',
  /function switchView\(viewName\)/.test(js) && js.includes("classList.add('furat-view--active')"));
check('JS: sintaxis válida del viewer',
  (function () { try { new Function(js); return true; } catch (e) { return false; } })());
check('JS: sintaxis válida de logic.js',
  (function () { try { new Function(logic); return true; } catch (e) { return false; } })());

// ══════════════ H. CACHE-BUST Y HTML ══════════════
check('Cache-bust: el <link> del CSS lleva ?v=FURAT-20260918-premium-fix2',
  html.includes('reportes-accidentes-view.css?v=FURAT-20260918-premium-fix2'));
check('Cache-bust: el <script> del viewer lleva ?v=FURAT-20260918-premium-fix2',
  html.includes('reportes-accidentes-viewer.js?v=FURAT-20260918-premium-fix2'));
check('Cache-bust: index.html carga logic.js con ?v=FURAT-20260918-premium-fix2',
  indexHtml.includes('reportes-accidentes-logic.js?v=FURAT-20260918-premium-fix2'));
check('Fuentes: Manrope + DM Sans en el link de Google Fonts',
  html.includes('family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800'));
check('CDN: se quitó Bootstrap Icons (no se usaba)',
  !html.includes('bootstrap-icons'));
check('HTML: llaves del CSS balanceadas',
  (css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length);
check('HTML: <body> y .furat-app presentes (el CSS vive en archivo externo, iframe aislado)',
  html.includes('<body>') && html.includes('class="furat-app"'));

// ══════════════ Reporte ══════════════
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) console.log('[OK  ] ' + c.name);
  else { failed++; console.log('[FAIL] ' + c.name + (c.extra ? ' → ' + c.extra : '')); }
});

console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
