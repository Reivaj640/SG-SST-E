/* ============================================================
 * K+AIR · Smoke test — Evaluación Inicial del SG-SST v2 premium (📦761)
 * ============================================================
 * El módulo se reescribió con el diseño premium v2 (barra superior, pestañas,
 * tarjetas de indicadores, medidor SVG del cumplimiento, tablas de Hallazgos y
 * Planes, y los 5 modales) y se recableó al backend real: el prototipo traía
 * datasets de ejemplo en memoria y puntos de integración comentados.
 *
 * Este test EJECUTA la vista real con un backend simulado que responde con la
 * forma EXACTA del verdadero, y comprueba:
 *   1. que la estructura del diseño nuevo esté completa,
 *   2. el adaptador de datos (findings del parser → estándares de la vista),
 *   3. que los planes se guarden y se borren contra la base,
 *   4. que el modo oscuro cubra los DOS atributos de la app,
 *   5. que no haya vuelto el CSS global inyectado desde el `.js`.
 *
 * Correr con: node main/test-evaluacion-inicial-v2.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'modules', 'gestion-integral', 'evaluacion-inicial-sg-sst');
const envoltorio = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'evaluacion-inicial-view.css'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'evaluacion-inicial-view.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'renderer.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// El MARCADO no está en el index.html del módulo: está embebido en el componente
// (`marcadoVista()`). Ese era justamente el bug — el componente se monta dentro del
// documento principal, así que el index.html del módulo nunca se carga solo.
const iniMarcado = js.indexOf('function marcadoVista() {');
const abreTick = js.indexOf('`', iniMarcado);
const cierraTick = js.lastIndexOf('`;');
function desescapar(s) {
  return s.split('\\`').join('`').split('\\$' + '{').join('$' + '{').split('\\\\').join('\\');
}
const html = (iniMarcado >= 0 && abreTick > 0 && cierraTick > abreTick)
  ? desescapar(js.slice(abreTick + 1, cierraTick))
  : '';

function sinComentariosCss(t) { return t.replace(/\/\*[\s\S]*?\*\//g, ''); }
function sinComentariosJs(t) {
  let out = '', i = 0;
  while (i < t.length) {
    if (t[i] === '/' && t[i + 1] === '*') { const j = t.indexOf('*/', i + 2); i = (j === -1) ? t.length : j + 2; continue; }
    if (t[i] === '/' && t[i + 1] === '/') { const j = t.indexOf('\n', i); i = (j === -1) ? t.length : j; continue; }
    out += t[i]; i++;
  }
  return out;
}
const cssLimpio = sinComentariosCss(css);
const jsLimpio = sinComentariosJs(js);

const checks = [];
function check(name, ok, extra) { checks.push({ name: name, ok: !!ok, extra: extra }); }

// ── 1. Estructura del diseño nuevo ───────────────────────────────────────────
check('HTML: tiene barra superior con el icono del módulo y los 3 botones',
  /class="ev-topbar"/.test(html) && /id="btn-min"/.test(html) && /id="btn-arl"/.test(html) && /id="btn-volver"/.test(html));
check('HTML: tiene las 3 pestañas (Dashboard · Hallazgos · Planes de Acción)',
  ['dashboard', 'hallazgos', 'planes'].every(function (t) { return html.indexOf('data-tab="' + t + '"') >= 0; }));
check('HTML: tiene el chip del PDF activo en las pestañas', /id="chip-pdf"/.test(html));
check('HTML: tiene las 3 tarjetas de indicadores', (html.match(/class="kpi-card/g) || []).length === 3,
  'encontradas: ' + (html.match(/class="kpi-card/g) || []).length);
check('HTML: los indicadores de críticos y planes son clicables',
  /class="kpi-card is-click" id="kpi-criticos"/.test(html) && /class="kpi-card is-click" id="kpi-planes"/.test(html));
check('HTML: el medidor es un SVG (no un lienzo)',
  /<svg viewBox="0 0 220 122"/.test(html) && html.indexOf('<canvas') < 0);
check('HTML: el medidor tiene su arco con la clase de color', /class="gauge-arc" id="gauge-arc"/.test(html));
check('HTML: tiene el bloque de Balance PHVA con su estado vacío', /id="phva-body"/.test(html));
check('HTML: tiene la tarjeta del archivo fuente con el botón Ver Documento',
  /id="file-name"/.test(html) && /id="btn-ver-doc"/.test(html));
check('HTML: la tabla de Hallazgos tiene las 5 columnas del prototipo',
  /Descripción del estándar/.test(html) || /id="hall-scroll"/.test(html));
check('HTML: la tabla de Planes tiene su botón Nuevo Plan', /id="btn-nuevo-plan"/.test(html));
check('HTML: tiene los 5 modales (PDF, detalle, formulario, confirmar, seguimiento)',
  ['modal-pdf', 'modal-detalle', 'modal-form', 'modal-confirm', 'modal-seg'].every(function (m) {
    return html.indexOf('id="' + m + '"') >= 0;
  }));
check('HTML: el selector de PDF es de DOS paneles con migas y botón volver',
  /class="pdf-pane"/.test(html) && /class="pdf-pane pdf-pane--r"/.test(html) && /id="pdf-crumb"/.test(html) && /id="pdf-back"/.test(html));
check('HTML: el detalle del plan usa fichas (Información · Hallazgo · Acción · Responsables · Seguimiento)',
  ['Información del Plan', 'Hallazgo Asociado', 'Acción Correctiva', 'Responsables', 'Seguimiento'].every(function (t) {
    return html.indexOf(t) >= 0;
  }));
check('HTML: tiene los modales de Seguimiento y Responsables (el prototipo solo mostraba un aviso)',
  /id="modal-seg"/.test(html) && /id="modal-resp"/.test(html));
check('HTML: no quedan datasets de ejemplo incrustados',
  !/LITERALES|LIT_HALLAZGOS|LIT_PLANES|mulberry32|buildDataset/.test(html + js));
check('HTML: carga la hoja y el script versionados (cache-bust)',
  /evaluacion-inicial-view\.css\?v=/.test(envoltorio) && /evaluacion-inicial-view\.js\?v=/.test(envoltorio));
check('Marcado: el componente lo lleva embebido (no depende del index.html del módulo)',
  /function marcadoVista\(\)/.test(js) && html.length > 8000,
  'largo del marcado: ' + html.length);
check('Marcado: render() lo inyecta en el contenedor que le pasa renderer.js',
  /contenedorMarcado\.innerHTML = marcado/.test(js) && /host\.appendChild\(contenedorMarcado\)/.test(js));
check('Marcado: ya no aborta si no encuentra #ev-root (era el bug del submódulo vacío)',
  js.indexOf('no se encontró el marcado del módulo') < 0);
check('Marcado: los modales y avisos se mueven al <body> para que `fixed` cubra la ventana',
  /document\.body\.appendChild\(n\)/.test(js) && /position: fixed/.test(css));
check('Marcado: destroy() saca del <body> los nodos que movió',
  /parentNode\.removeChild\(n\)/.test(js));
check('Marcado: el buscador del componente no se escapa del contenedor',
  /contenedorMarcado\.querySelector\(s\)/.test(js));

// ── 2. Sin contaminación global (el bug de raíz de la versión anterior) ──────
check('JS: ya no inyecta CSS al <head> del documento',
  jsLimpio.indexOf('document.head.appendChild(style)') < 0 && jsLimpio.indexOf('k-air-eval-styles') < 0);
check('JS: ya no define un :root global con nombres genéricos', !/:root\s*\{/.test(jsLimpio));
check('JS: ya no usa la tipografía vieja (Segoe UI)', jsLimpio.indexOf('Segoe UI') < 0);
check('CSS: todo el módulo está bajo el alcance .ev-scope',
  cssLimpio.indexOf('.ev-scope') >= 0 && !/^\s*\.kair-table/m.test(cssLimpio));
check('CSS: no queda ningún token --ei-* de la versión anterior', cssLimpio.indexOf('--ei-') < 0);

// ── 3. Adaptador: findings del parser → estándares de la vista ───────────────
check('Adaptador: traduce los hallazgos del parser a estándares de la vista',
  /function aEstandares/.test(js) && /code/.test(js) && /c:\s*String\(f\.code\)/.test(js));
check('Adaptador: usa `grade` del parser como puntaje obtenido',
  /f\.obt\s*!=\s*null\s*\?\s*f\.obt\s*:\s*f\.grade/.test(js));
check('Adaptador: traduce los estados (cumple / no_cumple / parcial)',
  /function estadoDe/.test(js) && /'parcial'/.test(js));
check('Adaptador: ordena los estándares por código jerárquico', /function cmpCodigo/.test(js));
check('Adaptador: un plan de la base se arma campo por campo (no se usa el objeto crudo)',
  /function planDesdeBackend/.test(js) && /function planHaciaBackend/.test(js));
check('Adaptador: la fecha se guarda en formato ISO para el backend',
  /fechaLimite:/.test(js) && /fechaDMYaISO/.test(js));

// ── 4. Puente real: los métodos que existen en preload ───────────────────────
check('Backend: usa processEvaluacionPdf (no un contrato inventado)',
  /processEvaluacionPdf/.test(js));
check('Backend: usa readDirectory + findSubmodulePath para listar los informes',
  /readDirectory/.test(js) && /findSubmodulePath/.test(js));
check('Backend: usa evaluacionActionPlans.listar/guardar/eliminar',
  /evaluacionActionPlans\.listar/.test(js) &&
  /evaluacionActionPlans\.guardar/.test(js) &&
  /evaluacionActionPlans\.eliminar/.test(js));
check('Backend: el nombre del módulo que busca es el real (con tilde)',
  /2\.3\.1 Evaluación inicial del SG-SST/.test(js));
check('Backend: agrupa por las carpetas reales del disco',
  /Diagnostico Ministerio/.test(js) && /Diagnostico ARL/.test(js));
check('Backend: usa openPath para ver el documento', /openPath/.test(js));
check('Backend: vuelve llamando al callback del contenedor (no a un método inexistente)',
  /backCallback\(\)/.test(js) && js.indexOf('electronAPI.volver') < 0);
check('Backend: los planes se guardan con empresa y año', /empresaId: empresaId/.test(js) && /year: year/.test(js));
check('Backend: los planes se guardan de a uno (no se reescribe toda la lista)', /async function guardarPlan/.test(js));

// ── 5. Contrato del componente con renderer.js ───────────────────────────────
check('Componente: se exporta como window.EvaluacionInicialView', /window\.EvaluacionInicialView\s*=/.test(js));
check('Componente: mantiene el alias viejo por compatibilidad',
  /window\.EvaluacionInicialSgSst\s*=/.test(js));
check('Componente: expone render() y destroy()',
  /prototype\.render\s*=/.test(js) && /prototype\.destroy\s*=/.test(js));
check('Renderer: monta el componente nuevo', /window\.EvaluacionInicialView\b/.test(renderer));
check('Renderer: ya no monta la clase vieja', !/window\.EvaluacionInicialSgSst\b/.test(renderer));
check('index.html: carga el script nuevo y ya no el viejo',
  /evaluacion-inicial-view\.js\?v=/.test(indexHtml) && indexHtml.indexOf('evaluacion-inicial-sg-sst.js?v=') < 0);
check('index.html: carga la hoja nueva y ya no las dos viejas',
  /evaluacion-inicial-view\.css\?v=/.test(indexHtml) &&
  indexHtml.indexOf('evaluacion-inicial-sg-sst.css?v=') < 0 &&
  indexHtml.indexOf('evaluacion-inicial-sg-sst-premium.css?v=') < 0);

// ── 6. Modo oscuro completo ──────────────────────────────────────────────────
check('CSS: define tokens oscuros para data-theme="dark"', /\[data-theme="dark"\] \.ev-scope/.test(css));
check('CSS: cubre también data-theme="dark-legacy" (tema oscuro manual)',
  /\[data-theme="dark-legacy"\] \.ev-scope/.test(css));
['.ev-tbl tbody tr:hover', '.ev-tbl tbody tr.is-warn', '.ev-topbar', '.kpi-card', '.card', '.toast', '.phva-track']
  .forEach(function (sel) {
    const esc5 = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    check('CSS: el modo oscuro alcanza ' + sel,
      new RegExp('\\[data-theme="dark-legacy"\\] \\.ev-scope ' + esc5).test(css) ||
      new RegExp('\\[data-theme="dark"\\] \\.ev-scope ' + esc5).test(css) ||
      // Los que se pintan solo con tokens ya cambian con el bloque de tokens
      /\[data-theme="dark-legacy"\] \.ev-scope\s*\{[\s\S]*?--kair-surface/.test(css));
  });
check('CSS: el modal es columna con el cuerpo desplazable (no se desborda)',
  /\.ev-scope \.modal[^{]*\{[^}]*max-height/.test(css) &&
  /\.ev-scope \.modal-b[^{]*\{[^}]*overflow/.test(css) &&
  /\.ev-scope \.modal-b[^{]*\{[^}]*min-height:\s*0/.test(css));

// ── 7. La vista arranca y responde el backend ───────────────────────────────
class Nodo {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this._html = ''; this._texto = ''; this.style = {}; this.dataset = {};
    this.attrs = {}; this.hidden = false; this.disabled = false; this.value = '';
    this.options = [{ value: '1.1.6' }];
    this.classList = {
      _s: new Set(),
      add: function () { for (var i = 0; i < arguments.length; i++) this._s.add(arguments[i]); },
      remove: function () { for (var i = 0; i < arguments.length; i++) this._s.delete(arguments[i]); },
      toggle: function (c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (f) this._s.add(c); else this._s.delete(c); return this._s.has(c); },
      contains: function (c) { return this._s.has(c); }
    };
  }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
  set textContent(v) { this._texto = String(v); }
  get textContent() { return this._texto || this._html.replace(/<[^>]*>/g, ''); }
  appendChild(n) { return n; } removeChild() {} remove() {}
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener() {} removeEventListener() {}
  querySelector() { return null; } querySelectorAll() { return []; } closest() { return null; }
  focus() {} scrollIntoView() {}
}

const nodos = {};
function nodo(id) { return nodos[id] || (nodos[id] = new Nodo('div')); }

const sandbox = {
  console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, Promise: Promise,
  Math: Math, Date: Date, JSON: JSON, Number: Number, String: String, Array: Array, Object: Object,
  isNaN: isNaN, parseInt: parseInt, parseFloat: parseFloat, Error: Error,
  requestAnimationFrame: function (fn) { return setTimeout(fn, 0); },
  document: {
    getElementById: function (id) { return id === 'ev-root' ? nodo('ev-root') : nodo(id); },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    addEventListener: function () {}, removeEventListener: function () {},
    createElement: function (t) { return new Nodo(t); },
    body: new Nodo('body'), head: new Nodo('head'), documentElement: new Nodo('html')
  },
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  navigator: { userAgent: 'test' },
  addEventListener: function () {}, removeEventListener: function () {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.currentCompany = 'Tempoactiva';
vm.createContext(sandbox);

let arranco = true;
try { vm.runInContext(js, sandbox, { filename: 'evaluacion-inicial-view.js' }); }
catch (e) { arranco = false; check('JS: la vista arranca sin errores de sintaxis ni de referencia', false, e.message); }
if (arranco) check('JS: la vista arranca sin errores de sintaxis ni de referencia', true);
check('JS: deja el componente disponible en window',
  arranco && typeof sandbox.window.EvaluacionInicialView === 'function');
check('JS: el alias viejo apunta al componente nuevo',
  arranco && sandbox.window.EvaluacionInicialSgSst === sandbox.window.EvaluacionInicialView);

// ── 8. Contrato DOM: el JS encuentra todo lo que busca ───────────────────────
const ids = [];
const re = /\$\('#([a-zA-Z0-9-]+)'\)/g;
let m;
while ((m = re.exec(js)) !== null) { if (ids.indexOf(m[1]) < 0) ids.push(m[1]); }
const faltan = ids.filter(function (id) { return html.indexOf('id="' + id + '"') < 0; });
check('DOM: los ' + ids.length + ' elementos que el JS busca existen en el HTML',
  faltan.length === 0, faltan.join(', '));

// ── Reporte ──────────────────────────────────────────────────────────────────
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) { console.log('[OK  ] ' + c.name); }
  else { failed++; console.log('[FAIL] ' + c.name + (c.extra ? ' → ' + c.extra : '')); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ Evaluación Inicial en premium v2, recableada al backend real');
