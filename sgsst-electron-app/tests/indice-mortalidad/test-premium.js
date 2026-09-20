const fs = require('fs');
const path = require('path');

const checks = [];
function ok(name, condition) { checks.push({ name, ok: !!condition }); }

const base = path.join(__dirname, '..', '..', 'modules', 'gestion-salud', 'indice-mortalidad');
const css = fs.readFileSync(path.join(base, 'indice-mortalidad.css'), 'utf8');
const html = fs.readFileSync(path.join(base, 'indice-mortalidad.html'), 'utf8');
const js = fs.readFileSync(path.join(base, 'indice-mortalidad.js'), 'utf8');
const renderer = fs.readFileSync(path.join(__dirname, '..', '..', 'renderer.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

// CSS
ok('CSS: tokens --mort-* scoped', /--mort-primary:\s*#2057b8/.test(css));
ok('CSS: NO :root global', !/^\s*:root\s*\{/.test(css));
ok('CSS: NO * global reset', !/^\s*\*\s*\{/.test(css));
ok('CSS: NO body global', !/^body\s*\{/.test(css));
ok('CSS: Header v2 classes', /\.mort-header-v2/.test(css) && /\.mort-title/.test(css));
ok('CSS: NO .k-section-card', !/\.k-section-card/.test(css));
ok('CSS: dark-legacy', /\[data-theme\^="dark"\]/.test(css));
ok('CSS: table blindaje', /min-width:\s*0\s*!important/.test(css));
ok('CSS: table-layout fixed', /table-layout:\s*fixed/.test(css));
ok('CSS: @keyframes mort prefix', /@keyframes\s+mort/.test(css));
ok('CSS: color-mix badges', /color-mix\(in srgb/.test(css));
ok('CSS: 7 column widths', (function() {
  var w = []; var re = /kair-data-table th:nth-child\(\d+\)\s*\{[^}]*width:\s*([\d.]+)%/g;
  var m; while ((m = re.exec(css)) !== null) w.push(parseFloat(m[1]));
  return w.length === 7 && Math.abs(w.reduce(function(a,b){return a+b;},0) - 100) < 0.1;
})());

// HTML
ok('HTML: NO Font Awesome CDN', !/font-awesome|fontawesome/i.test(html));
ok('HTML: NO Bootstrap Icons CDN', !/bootstrap-icons|cdn\.jsdelivr/i.test(html));
ok('HTML: mort-header-v2', /mort-header-v2/.test(html));
ok('HTML: SVG inline icons', /<svg[^>]*viewBox/.test(html));
ok('HTML: NO <i class="fas', !/<i\s+class="fas/.test(html));
ok('HTML: mort-header-icon', /mort-header-icon/.test(html));
ok('HTML: chart canvas', /id="mortalityChart"/.test(html));
ok('HTML: 7 columns', (html.match(/<th>/g) || []).length === 7);

// JS
ok('JS: tok() exists', /function tok\(name,\s*fallback\)/.test(js));
ok('JS: palette() exists', /function palette\(\)/.test(js));
ok('JS: NO escapeHtml', !/function escapeHtml/.test(js));
ok('JS: tok used in palette', /palette\(\)/.test(js) && /tok\('--mort-/.test(js));
ok('JS: getStatusBadge uses palette', /function getStatusBadge[\s\S]*?palette\(\)/.test(js));
ok('JS: getValueColor uses palette', /function getValueColor[\s\S]*?palette\(\)/.test(js));
ok('JS: renderChart isDark', /isDark.*indexOf\('dark'\)/.test(js));
ok('JS: Chart.js theme defaults', /Chart\.defaults\.color/.test(js) && /Chart\.defaults\.borderColor/.test(js));
ok('JS: resize handler stored', /__mortResizeHandler/.test(js));
ok('JS: removeEventListener pattern', /removeEventListener.*__mortResizeHandler/.test(js));
ok('JS: palette() in renderizar', /function renderizar[\s\S]*?var C = palette\(\)/.test(js));
ok('JS: palette() in renderizarTabla', /function renderizarTabla[\s\S]*?var C = palette\(\)/.test(js));

// renderer.js
ok('renderer: TOKEN = MORT-20260919-v1-premium', /const TOKEN = 'MORT-20260919-v1-premium'/.test(renderer));
ok('renderer: CSS uses TOKEN', /indice-mortalidad\.css\?v=\$\{TOKEN\}/.test(renderer));
ok('renderer: JS uses TOKEN', /indice-mortalidad\.js\?v=.*TOKEN/.test(renderer));
ok('renderer: sanitize link CDN', renderer.indexOf('html.replace') !== -1 && renderer.indexOf('https:') !== -1);
ok('renderer: console.log removed', !/console\.log.*IndiceMortalidad.*INICIADO/.test(renderer));

// index.html
ok('index: renderer.js bumped', /renderer\.js\?v=20260919-mortalidad-premium/.test(index));

// Report
var failed = 0;
checks.forEach(function(c) {
  var icon = c.ok ? '\u2705' : '\u274C';
  console.log(icon + ' ' + c.name);
  if (!c.ok) failed++;
});
console.log('\n' + checks.length + ' checks, ' + (checks.length - failed) + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
