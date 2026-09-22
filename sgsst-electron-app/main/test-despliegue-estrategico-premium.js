/* ==========================================================================
 * K+AIR — Test de contratos premium v2 · Despliegue Estratégico (6.1.3)
 * Valida 9 contratos en el módulo revisión-alta-dirección / vistas /
 * despliegue-estrategico.js y revision-alta-direccion-v2.css.
 * ========================================================================== */
'use strict';

var path = require('path');
var fs = require('fs');

var BASE = path.resolve(__dirname, '..', 'modules', 'verificacion', 'revision-alta-direccion');
var JS_FILE = path.join(BASE, 'vistas', 'despliegue-estrategico.js');
var CSS_FILE = path.join(BASE, 'revision-alta-direccion-v2.css');

var PASS = 0, FAIL = 0;
function ok(label) { PASS++; console.log('  ✓ ' + label); }
function fail(label, why) { FAIL++; console.log('  ✗ ' + label + (why ? ' — ' + why : '')); }
function check(label, cond, why) { (cond ? ok : fail)(label, why); }
function section(name) { console.log('\n─── ' + name + ' ───'); }

/* ─── 1. Carga de archivos ─── */
section('1. Carga de archivos');
var jsContent = '', cssContent = '';
try { jsContent = fs.readFileSync(JS_FILE, 'utf8'); ok('JS existe: ' + path.basename(JS_FILE)); }
catch (e) { fail('JS existe: ' + path.basename(JS_FILE), e.message); }
try { cssContent = fs.readFileSync(CSS_FILE, 'utf8'); ok('CSS existe: ' + path.basename(CSS_FILE)); }
catch (e) { fail('CSS existe: ' + path.basename(CSS_FILE), e.message); }

/* ─── 2. Header v2 con badge-ico + título + subtítulo ─── */
section('2. Header v2 (premium · badge-ico + título + subtítulo)');
check('JS declara scope .kair-rad-view-despliegue', /className\s*=\s*['"]kair-rad-view-despliegue['"]/.test(jsContent));
check('JS renderiza header kair-rad-despliegue-header', /kair-rad-despliegue-header/.test(jsContent));
check('JS incluye kair-badge-ico en header', /kair-badge-ico/.test(jsContent));
check('JS incluye kair-title en header', /kair-title/.test(jsContent));
check('JS incluye kair-sub en header', /kair-sub/.test(jsContent));
check('JS tiene botón Volver (#kair-rad-desp-btn-back)', /kair-rad-desp-btn-back/.test(jsContent));
check('JS tiene botón Refrescar (#kair-rad-desp-btn-sync)', /kair-rad-desp-btn-sync/.test(jsContent));

/* ─── 3. SVG inline (sin Font Awesome ni Bootstrap Icons en header) ─── */
section('3. SVG inline (sin FA ni Bootstrap Icons en header/cards)');
check('JS usa SVG.bullseye (no bi-bullseye)', /SVG\.bullseye/.test(jsContent) && !/bi-bullseye/.test(jsContent));
check('JS usa SVG.check', /SVG\.check/.test(jsContent) && !/bi-check2-circle/.test(jsContent));
check('JS usa SVG.alert', /SVG\.alert/.test(jsContent) && !/bi-exclamation-circle/.test(jsContent));
check('JS usa SVG.xOctagon', /SVG\.xOctagon/.test(jsContent) && !/bi-x-octagon/.test(jsContent));
check('JS no contiene bi bi-* en render()', !/class=['"]bi\s+bi-/.test(jsContent));

/* ─── 4. Metric cards premium ─── */
section('4. Metric cards premium (.kair-metric-strip + 4 cards)');
check('JS usa kair-metric-strip', /kair-metric-strip/.test(jsContent));
check('JS usa kair-metric-card', /kair-metric-card/.test(jsContent));
check('JS declara 4 cards (Total/Cumple/Parcial/No cumple)', /Total indicadores/.test(jsContent) && /Cumplen/.test(jsContent) && /Parcial/.test(jsContent) && /No cumplen/.test(jsContent));
check('JS usa tonos --blue/--green/--amber/--red', /tone:\s*['"]blue['"]/.test(jsContent) && /tone:\s*['"]green['"]/.test(jsContent) && /tone:\s*['"]amber['"]/.test(jsContent) && /tone:\s*['"]red['"]/.test(jsContent));

/* ─── 5. IPC real ─── */
section('5. IPC real (window.electronAPI.revisionAltaDireccion.listarIndicadores)');
check('JS usa window.electronAPI', /window\.electronAPI/.test(jsContent));
check('JS llama revisionAltaDireccion.listarIndicadores', /revisionAltaDireccion\.listarIndicadores/.test(jsContent));
check('JS tiene fallback a INDICADORES_MOCK', /INDICADORES_MOCK/.test(jsContent));
check('preload.js expone listarIndicadores', /revisionAltaDireccion:listarIndicadores/.test(fs.readFileSync(path.resolve(__dirname, '..', 'preload.js'), 'utf8')));

/* ─── 6. Helpers tok()/palette() ─── */
section('6. Helpers tok() / palette()');
check('JS define función tok()', /function\s+tok\s*\(/.test(jsContent));
check('JS define función palette()', /function\s+palette\s*\(/.test(jsContent));
check('palette() retorna primary', /primary:\s+tok\(/.test(jsContent));
check('palette() retorna ink/muted/border', /ink:\s+tok\(/.test(jsContent) && /muted:\s+tok\(/.test(jsContent) && /border:\s+tok\(/.test(jsContent));

/* ─── 7. Tokens scoped --rad-desp-* + dark mode ─── */
section('7. Tokens scoped --rad-desp-* + dark mode [data-theme^="dark"]');
check('CSS declara tokens --rad-desp-* bajo .kair-rad-view-despliegue', /\.kair-rad-view-despliegue\s*\{[^}]*--rad-desp-primary/.test(cssContent));
check('CSS usa paleta canónica (#2057b8, #1bb888, #e7a224, #da5563)', /#2057b8/.test(cssContent) && /#1bb888/.test(cssContent) && /#e7a224/.test(cssContent) && /#da5563/.test(cssContent));
check('CSS usa DM Sans + Manrope', /DM Sans/.test(cssContent) && /Manrope/.test(cssContent));
check('CSS dark mode usa [data-theme^="dark"] (no solo =dark)', /\[data-theme\^="dark"\][\s\S]*\.kair-rad-view-despliegue/.test(cssContent));
check('CSS re-definir tokens en dark (primary #6ea8fe, success #3ecf9a)', /\[data-theme\^="dark"\][\s\S]*--rad-desp-primary:\s*#6ea8fe/.test(cssContent) && /\[data-theme\^="dark"\][\s\S]*--rad-desp-success:\s*#3ecf9a/.test(cssContent));
check('CSS no usa :root ni * ni body GLOBALES para redefinir tokens', !/:root[\s\S]{0,500}--rad-desp-primary/.test(cssContent));

/* ─── 8. Tabla blindada ─── */
section('8. Tabla blindada (min-width:0 + max-width:100%)');
check('CSS tabla tiene min-width: 0 !important', /\.kair-rad-view-despliegue\s+\.kair-rad-table\s*\{[^}]*min-width:\s*0\s*!important/.test(cssContent));
check('CSS tabla tiene max-width: 100% !important', /\.kair-rad-view-despliegue\s+\.kair-rad-table\s*\{[^}]*max-width:\s*100%\s*!important/.test(cssContent));
check('CSS tabla tiene th con padding 0.5rem', /\.kair-rad-table\s+thead\s+th\s*\{[^}]*padding:\s*0\.625rem/.test(cssContent));
check('CSS tabla tiene td con padding 0.3rem', /\.kair-rad-table\s+tbody\s+td\s*\{[^}]*padding:\s*0\.5rem/.test(cssContent));

/* ─── 9. Cache-bust ─── */
section('9. Cache-bust en index.html');
var indexHtml = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
check('index.html tiene ?v= para despliegue-estrategico.js', /despliegue-estrategico\.js\?v=[\w-]+/.test(indexHtml));
check('Cache-bust es reciente (>= 20260921)', /despliegue-estrategico\.js\?v=20260921/.test(indexHtml));

/* ─── Resumen ─── */
console.log('\n══════════════════════════════════════════');
console.log(' Total: ' + (PASS + FAIL) + ' · OK: ' + PASS + ' · FAIL: ' + FAIL);
console.log('══════════════════════════════════════════');
process.exit(FAIL > 0 ? 1 : 0);
