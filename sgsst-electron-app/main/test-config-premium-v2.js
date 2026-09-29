/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Smoke test — Configuración Premium v2 (📦751)
   Valida la capa premium scopada bajo `.kair-config` en
   components/config/config-viewer.html y el cache-bust del iframe.
   ═══════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'components', 'config', 'config-viewer.html');
const rendererPath = path.join(root, 'renderer.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const renderer = fs.readFileSync(rendererPath, 'utf8');

const checks = [];
function check(name, ok) { checks.push({ name: name, ok: !!ok }); }

// --- Carga de tokens premium ---
check('HTML: carga shared/kair-design-tokens.css', /<link[^>]+href="\.\.\/\.\.\/shared\/kair-design-tokens\.css"/.test(html));
check('HTML: body con clase kair-config', /<body class="kair-config">/.test(html));

// --- Bloque premium ---
check('CSS: bloque PREMIUM v2 presente (📦751)', /📦751 · PREMIUM v2 · CAPA DE CONFIGURACIÓN/.test(html));
check('CSS: remapea --primary a token premium', /--primary:\s*var\(--kair-blue\)/.test(html));
check('CSS: remapea --font-heading a display', /--font-heading:\s*var\(--kair-font-display\)/.test(html));
check('CSS: remapea --bg-card a token', /--bg-card:\s*var\(--kair-card\)/.test(html));
check('CSS: define --border (antes indefinido)', /--border:\s*var\(--kair-line\)/.test(html));
check('CSS: define --radius-md (antes indefinido)', /--radius-md:\s*10px/.test(html));

// --- Header System v2 (breadcrumb + icono/título + tabs) ---
check('CSS: header premium (.cfg-header-left h3 display font)', /\.kair-config \.cfg-header-left h3\s*\{[^}]*font-family:\s*var\(--kair-font-display\)/s.test(html));
check('HTML: breadcrumb del header', /class="cfg-breadcrumb"[\s\S]*?is-current">Configuración</.test(html));
check('HTML: icono del header', /class="cfg-header-icon"/.test(html));
check('HTML: botón volver premium', /class="cfg-back-btn"/.test(html));
check('CSS: tabs con subrayado activo', /\.kair-config \.cfg-tab\.nav-tab\.active\s*\{[^}]*border-bottom-color:\s*var\(--kair-blue\)/s.test(html));
check('CSS: tabs con línea inferior', /\.kair-config \.cfg-tabs\s*\{[^}]*border-bottom:\s*1px solid var\(--kair-line\)/s.test(html));
check('CSS: se oculta subrayado legacy del nav', /\.kair-config \.cfg-tab\.nav-tab\.active::after\s*\{\s*display:\s*none/.test(html));
check('HTML: cada tab tiene icono SVG', (html.match(/class="cfg-tab nav-tab/g) || []).length === 6 && (html.match(/<svg width="16"/g) || []).length === 6);
check('CSS: secciones como tarjetas premium', /\.kair-config \.section-title\s*\{[^}]*font-family:\s*var\(--kair-font-display\)/s.test(html));
check('CSS: cards con radio premium', /\.kair-config \.company-card\s*\{[^}]*border-radius:\s*var\(--kair-radius-card\)/s.test(html));
check('CSS: modales con radio premium', /\.kair-config \.modal-container\s*\{[^}]*border-radius:\s*var\(--kair-radius-modal\)/s.test(html));
check('CSS: botones premium (altura 38)', /\.kair-config \.btn\s*\{[^}]*height:\s*38px/s.test(html));
check('CSS: tabla con header premium', /\.kair-config th\s*\{[^}]*letter-spacing/s.test(html));
check('CSS: focus de inputs con anillo azul', /\.kair-config \.form-control:focus[^{]*\{[^}]*box-shadow:\s*0 0 0 3px var\(--kair-blue-soft\)/s.test(html));

// --- Preservación de variantes semánticas ---
check('CSS: conserva colores de riesgo I-V en company-card', /\.kair-config \.company-card\.risk-I\s*\{\s*border-top-color:\s*var\(--kair-mint\)/.test(html) && /\.kair-config \.company-card\.risk-V\s*\{\s*border-top-color:\s*var\(--kair-red\)/.test(html));

// --- Modo oscuro ---
check('CSS: overrides dark', /\[data-theme="dark"\] \.kair-config\s*\{/.test(html));
check('CSS: overrides dark-legacy', /\[data-theme="dark-legacy"\] \.kair-config\s*\{/.test(html));
check('CSS: tr:hover oscuro', /\[data-theme="dark"\] \.kair-config tr:hover/.test(html));

// --- Integridad ---
const styleStart = html.indexOf('<style>');
const styleEnd = html.indexOf('</style>');
const style = html.slice(styleStart, styleEnd);
const openBraces = (style.match(/{/g) || []).length;
const closeBraces = (style.match(/}/g) || []).length;
check('CSS: llaves balanceadas', openBraces === closeBraces);
check('HTML: un solo <body>', (html.match(/<body/g) || []).length === 1);
check('HTML: un solo </style>', (html.match(/<\/style>/g) || []).length === 1);
check('HTML: un solo </head>', (html.match(/<\/head>/g) || []).length === 1);
check('HTML: un solo </html>', (html.match(/<\/html>/g) || []).length === 1);

// --- Cache-bust del iframe ---
check('renderer.js: iframe con cache-bust HF', /components\/config\/config-viewer\.html\?v=20260925-prompt-verbatim/.test(renderer));
check('renderer.js: ya no queda el src sin token', !/'components\/config\/config-viewer\.html';/.test(renderer));

// --- Sección HuggingFace (Fase 2 · Tarea 4) ---
check('HTML: sección HF presente', /Modelos desde HuggingFace/.test(html));
check('HTML: input token HF presente', /id="hf-token-input"/.test(html));
check('HTML: lista HF presente', /id="hf-models-list"/.test(html));
check('HTML: progreso HF presente', /id="hf-progress-wrap"/.test(html));
check('HTML: navigateToConfigSection definida', /function navigateToConfigSection\s*\(/.test(html));
check('HTML: APIs HF en JS', /loadHfTokenStatus/.test(html) && /loadHfModels/.test(html) && /startHfDownload/.test(html));
check('HTML: switchTab refresca token HF en tab ia', /tabId === 'ia'/.test(html) && /loadHfTokenStatus\(\)/.test(html));

// --- Handlers JS intactos ---
check('HTML: switchTab sigue presente', /function switchTab\s*\(/.test(html));
check('HTML: goHome sigue presente', /function goHome\s*\(/.test(html));
check('HTML: nav-tabs conservan onclick switchTab', /onclick="switchTab\('empresas', this\)"/.test(html) && /onclick="switchTab\('acerca', this\)"/.test(html));
check('HTML: IDs de tabs intactos', /id="tab-empresas"/.test(html) && /id="tab-firma"/.test(html) && /id="tab-usuarios"/.test(html) && /id="tab-ia"/.test(html) && /id="tab-interfaz"/.test(html) && /id="tab-acerca"/.test(html));

let passed = 0;
const failed = [];
checks.forEach(function (c) {
  if (c.ok) { passed++; console.log('  OK  ' + c.name); }
  else { failed.push(c.name); console.log('  FAIL ' + c.name); }
});

console.log('\n' + '='.repeat(60));
console.log(checks.length + '/' + checks.length + ' | pass: ' + passed + ' | fail: ' + failed.length);
console.log('='.repeat(60));
if (failed.length) {
  console.log('\nFallidos:');
  failed.forEach(function (n) { console.log('  - ' + n); });
  process.exit(1);
}
process.exit(0);
