const fs = require('fs');
const path = require('path');

const checks = [];
function ok(name, condition) { checks.push({ name, ok: !!condition }); }

const base = path.join(__dirname, '..', '..', 'modules', 'gestion-salud', 'prevalencia-enfermedad-laboral');
const css = fs.readFileSync(path.join(base, 'prevalencia-enfermedad-laboral.css'), 'utf8');
const html = fs.readFileSync(path.join(base, 'prevalencia-enfermedad-laboral.html'), 'utf8');
const js = fs.readFileSync(path.join(base, 'prevalencia-enfermedad-laboral.js'), 'utf8');
const renderer = fs.readFileSync(path.join(__dirname, '..', '..', 'renderer.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

// ===== CSS =====
ok('CSS: tokens --prev-* scoped', /--prev-primary:\s*#2057b8/.test(css));
ok('CSS: NO :root global', !/^\s*:root\s*\{/m.test(css));
ok('CSS: NO * global reset', !/^\s*\*\s*\{/m.test(css));
ok('CSS: NO body global', !/^body\s*\{/m.test(css));
ok('CSS: Header v2 classes', /\.prev-header-v2/.test(css) && /\.prev-header-icon/.test(css) && /\.prev-title/.test(css));
ok('CSS: NO .k-section-card', !/\.k-section-card/.test(css));
ok('CSS: NO .header-back-btn', !/\.header-back-btn/.test(css));
ok('CSS: NO .header-action', !/\.header-action/.test(css));
ok('CSS: dark-legacy via [data-theme^="dark"]', /\[data-theme\^="dark"\]/.test(css));
ok('CSS: table blindaje min-width:0', /min-width:\s*0\s*!important/.test(css));
ok('CSS: table-layout fixed', /table-layout:\s*fixed/.test(css));
ok('CSS: @keyframes prev prefix', /@keyframes\s+prev/.test(css));
ok('CSS: 6 column widths suman 100%', (function() {
  var w = []; var re = /kair-data-table th:nth-child\(\d+\)\s*\{\s*width:\s*([\d.]+)%/g;
  var m; while ((m = re.exec(css)) !== null) w.push(parseFloat(m[1]));
  return w.length === 6 && Math.abs(w.reduce(function(a,b){return a+b;},0) - 100) < 0.1;
})());
ok('CSS: .prev-duo grid 1 columna base', /\.prev-duo\s*\{[\s\S]*?grid-template-columns:\s*1fr;/.test(css));
ok('CSS: .prev-duo 2 columnas en maximizada', /@media \(min-width:\s*1360px\)[\s\S]*?\.prev-duo\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(0,\s*1fr\)/.test(css));
ok('CSS: .prev-duo estira tarjetas en flex', /\.prev-duo > \.kair-chart-section,[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column/.test(css));
ok('CSS: chart container flex:1 en el duo', /\.prev-duo > \.kair-chart-section \.kair-chart-container\s*\{[\s\S]*?flex:\s*1;[\s\S]*?min-height:\s*0;/.test(css));

// ===== HTML =====
ok('HTML: NO Bootstrap Icons CDN', !/bootstrap-icons/i.test(html));
ok('HTML: NO <i class="bi', !/<i\s+class="bi/.test(html));
ok('HTML: NO <i class="fas', !/<i\s+class="fas/.test(html));
ok('HTML: prev-header-v2', /prev-header-v2/.test(html));
ok('HTML: SVG inline icons', /<svg[^>]*viewBox/.test(html));
ok('HTML: prev-header-icon', /prev-header-icon/.test(html));
ok('HTML: chart canvas', /id="prevalenciaChart"/.test(html));
ok('HTML: 6 columnas', (html.match(/<th>/g) || []).length === 6);
ok('HTML: wrapper .prev-duo existe', /<div class="prev-duo">/.test(html));
ok('HTML: cierra .prev-duo', /\/prev-duo/.test(html));
ok('HTML: chart y table dentro del duo', /<div class="prev-duo">[\s\S]*kair-chart-section[\s\S]*kair-table-section[\s\S]*<\/div>/.test(html));

// ===== JS =====
ok('JS: tok() existe', /function tok\(name,\s*fallback\)/.test(js));
ok('JS: palette() existe', /function palette\(\)/.test(js));
ok('JS: NO escapeHtml', !/function escapeHtml/.test(js));
ok('JS: tok used in palette', /tok\('--prev-/.test(js));
ok('JS: getStatusBadge uses palette', /function getStatusBadge[\s\S]*?var C = palette\(\)/.test(js));
ok('JS: getValueColor uses palette', /function getValueColor[\s\S]*?var C = palette\(\)/.test(js));
ok('JS: renderChart isDark', /isDark.*indexOf\('dark'\)/.test(js));
ok('JS: Chart.js theme defaults', /Chart\.defaults\.color/.test(js) && /Chart\.defaults\.borderColor/.test(js));
ok('JS: resize handler stored', /__prevResizeHandler/.test(js));
ok('JS: removeEventListener pattern', /removeEventListener.*__prevResizeHandler/.test(js));
ok('JS: palette() in renderizar', /function renderizar[\s\S]*?var C = palette\(\)/.test(js));
ok('JS: palette() in renderizarTabla', /function renderizarTabla[\s\S]*?var C = palette\(\)/.test(js));
ok('JS: chart/table sin display inline (para el duo)', /chartSection\.style\.display = ''/.test(js) && /tableSection\.style\.display = ''/.test(js));

// ===== renderer.js =====
ok('renderer: TOKEN = PREV-20260919-v1-premium', /const TOKEN = 'PREV-20260919-v1-premium'/.test(renderer));
ok('renderer: CSS uses TOKEN', /prevalencia-enfermedad-laboral\.css\?v=\$\{TOKEN\}/.test(renderer));
ok('renderer: JS uses TOKEN', /prevalencia-enfermedad-laboral\.js\?v=.*TOKEN/.test(renderer));
ok('renderer: sanitize link CDN', renderer.indexOf('html.replace') !== -1 && renderer.indexOf('https:') !== -1);

// ===== index.html =====
ok('index: renderer.js con cache-bust', /renderer\.js\?v=[\w.-]{8,}/.test(index));

// Reporte
var failed = 0;
checks.forEach(function(c) {
  console.log((c.ok ? '\u2705' : '\u274C') + ' ' + c.name);
  if (!c.ok) failed++;
});
console.log('\n' + checks.length + ' checks, ' + (checks.length - failed) + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
