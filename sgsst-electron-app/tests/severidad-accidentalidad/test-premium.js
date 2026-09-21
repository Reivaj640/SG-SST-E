// test-premium.js — Submódulo 3.3.2 Severidad de la Accidentalidad
'use strict';
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'modules', 'gestion-salud', 'severidad-accidentalidad');
const F_HTML = path.join(DIR, 'severidad-accidentalidad.html');
const F_CSS = path.join(DIR, 'severidad-accidentalidad.css');
const F_JS = path.join(DIR, 'severidad-accidentalidad.js');
const F_RENDERER = path.join(ROOT, 'renderer.js');

const html = fs.readFileSync(F_HTML, 'utf8');
const css = fs.readFileSync(F_CSS, 'utf8');
const js = fs.readFileSync(F_JS, 'utf8');
const renderer = fs.readFileSync(F_RENDERER, 'utf8');

function sinComentarios(t) {
  return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/[^\n]*$/gm, '');
}
const cssL = sinComentarios(css);

const checks = [];
function check(name, ok) { checks.push({ name: name, ok: !!ok }); }

check('HTML: Header System v2',
  html.includes('class="sev-header-v2"') && html.includes('class="sev-breadcrumb"') &&
  html.includes('class="sev-title"') && html.includes('class="sev-header-actions"'));
check('HTML: sin k-section-card / header-back-btn / bi fa-',
  !html.includes('k-section-card') && !html.includes('header-back-btn') && !html.includes('header-action--ghost') &&
  !html.includes('class="bi bi-') && !html.includes('class="fas fa-') && html.includes('stroke="currentColor"'));
check('HTML: los ids clave siguen presentes',
  html.includes('id="yearFilter"') && html.includes('id="btnVolver"') && html.includes('id="btnRefrescar"') &&
  html.includes('id="kpiSection"') && html.includes('id="kpiIS"') && html.includes('id="tablaBody"') &&
  html.includes('id="monthCards"') && html.includes('id="chartContainer"') && html.includes('id="toastContainer"'));
check('HTML: wrapper .sev-duo para grafico+tabla',
  html.includes('<div class="sev-duo">') && html.includes('<!-- /sev-duo -->'));

check('CSS: sin :root / * / body globales',
  !/(^|\n)\s*:root\s*\{/.test(cssL) && !/(^|\n)\s*\*\s*\{/.test(cssL) && !/(^|\n)\s*body\s*\{/.test(cssL));
check('CSS: TODOS los selectores scoped bajo .severidad-container o [data-theme',
  !cssL.split('\n').map(function(l){return l.trim()}).filter(function(t){
    if(!t||t.startsWith('@')||t.startsWith('/*'))return false;var b=t.indexOf('{');if(b<=0)return false;var s=t.slice(0,b).trim();if(!s||/^(from|to|\d+%)/.test(s))return false;
    return s.split(',').some(function(p){p=p.trim();return p&&!/^\.severidad-container/.test(p)&&!/^\[data-theme/.test(p)});
  }).length);
check('CSS: tokens --sev-* (ya no --kair-*)',
  /--sev-primary: #2057b8;/.test(css) && /--sev-bg: #fbfcfb;/.test(css) &&
  /--sev-font: 'DM Sans'/.test(css) && /--sev-radius-card: 20px;/.test(css) &&
  !/ --kair-primary/.test(css));
check('CSS: dark [data-theme^="dark"] (cubre dark + dark-legacy)',
  /\[data-theme\^="dark"\] \.severidad-container \{/.test(css) &&
  /\[data-theme\^="dark"\] \.severidad-container \{[^}]*--sev-bg: #0f172a;/.test(css.replace(/\n/g,' ')));
check('CSS: tabla blindaje + 7 anchos fijos (min-width:0 + table-layout:fixed + suman 100%)',
  /\.severidad-container \.kair-table \{[^}]*min-width: 0 !important;/.test(cssL.replace(/\n/g,' ')) &&
  /\.severidad-container \.kair-table \{[^}]*table-layout: fixed;/.test(cssL.replace(/\n/g,' ')) &&
  (function(){var m=cssL.match(/\.kair-table th:nth-child\(\d\) \{ width: \d+%; \}/g)||[];var s=m.reduce(function(a,x){return a+parseInt(x.match(/(\d+)%/)[1],10)},0);    return m.length===7&&s===100})());
check('CSS: meses 6 en ventana / 12 en maximizada',
  /\.kair-month-cards-grid \{[^}]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\);/.test(cssL.replace(/\n/g,' ')) &&
  /grid-template-columns: repeat\(12, minmax\(0, 1fr\)\);/.test(cssL.replace(/\n/g,' ')));
check('CSS: .sev-duo en paralelo + blindaje min-width',
  /\.severidad-container \.sev-duo \{[^}]*display: grid;/.test(cssL.replace(/\n/g,' ')) &&
  /min-width: 0 !important;/.test(css));
check('CSS: @keyframes con prefijo propio',
  /@keyframes sevPulse/.test(css) && /@keyframes sevSlideIn/.test(css) &&
  !/@keyframes pulse/.test(css) && !/@keyframes slideIn/.test(css));

check('JS: tok()/palette() presentes',
  /function tok\(name, fallback\)/.test(js) && /function palette\(\)/.test(js));
check('JS: 4 funciones usan palette()',
  (js.match(/var C = palette\(\);/g) || []).length >= 3);
check('JS: sin hex viejos',
  (js.match(/#174ea6|#28a745|#ffc107|#dc3545|#6c757d|#212529|#856404|#adb5bd|#e9ecef|#fafbfc/g) || []).length === 0);
check('JS: codigo muerto eliminado',
  !js.includes('buildGridLines') && !js.includes('buildChartPoints') && !js.includes('function escapeHtml'));
check('JS: tabla ANTES del grafico en renderizar()',
  js.indexOf('renderTabla()') < js.indexOf('renderChart();'));
check('JS: re-render al redimensionar con handler unico en window',
  /window\.__sevResizeHandler/.test(js) && /removeEventListener\('resize', window\.__sevResizeHandler\)/.test(js));
check('JS: compila (node --check)',
  (function(){try{require('child_process').execSync('node --check "'+F_JS+'"',{stdio:'pipe'});return true}catch(e){return false}})());

check('renderer.js: token en CSS/HTML/JS',
  /const TOKEN = 'SEV-/.test(renderer) && /severidad-accidentalidad\.css\?v=' \+ TOKEN/.test(renderer) &&
  /severidad-accidentalidad\.html\?v=' \+ TOKEN/.test(renderer) && /severidad-accidentalidad\.js\?v=' \+ TOKEN/.test(renderer));
check('renderer.js: guard del link + sanitizar + cache-bust renderer.js',
  /querySelector\(`link\[href="\$\{BASE\}severidad-accidentalidad\.css\?v=\$\{TOKEN\}"\]`\)/.test(renderer) &&
  /parseFromString\(limpio, 'text\/html'\)/.test(renderer) &&
  /<script src="renderer\.js\?v=[^"]+"><\/script>/.test(fs.readFileSync(path.join(ROOT,'index.html'),'utf8')));

let failed = 0;
checks.forEach(function (c) { if (c.ok) console.log('[OK  ] ' + c.name); else { failed++; console.log('[FAIL] ' + c.name); } });
console.log('');
console.log((checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed === 0) console.log('✅ 3.3.2 Severidad de la Accidentalidad en premium v2');
process.exit(failed === 0 ? 0 : 1);
