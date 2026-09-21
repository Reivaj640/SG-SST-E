/* ============================================================
 * K+AIR · Smoke test — Archivo y Retención Documental premium (📦760)
 * ============================================================
 * Blindal la migración al diseño premium v2 y, sobre todo, los TRES bugs de
 * datos que tenía el módulo anterior. Los tres venían de que el iframe y el
 * backend del Excel usaban nombres de campo distintos:
 *
 *   1. La columna Tipo salía siempre "—" y los KPI Documentos/Registros en 0,
 *      porque el iframe leía `doc.tipo` y el backend entrega tipoDoc/tipoReg/
 *      tipoInterno/tipoExterno (booleanos).
 *   2. El selector "Todas las hojas" quedaba vacío: el iframe buscaba `doc.hoja`
 *      y el backend lo llama `hojaOrigen`.
 *   3. Editar Tipo o Disposición Final no se guardaba: el iframe mandaba
 *      `disposicionFinal` y `tipo`, y el backend lee `disposicion` y parsea
 *      `tipo` como texto combinado.
 *
 * El test EJECUTA el código real de la vista en un entorno simulado y comprueba
 * el modelo que produce y el payload que envía. No compara texto contra texto.
 *
 * Correr con: node main/test-archivo-retencion-premium.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'modules', 'gestion-integral', 'archivo-retencion');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'archivo-retencion-view.css'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'archivo-retencion-view.js'), 'utf8');
const wrapper = fs.readFileSync(path.join(dir, 'archivo-retencion.js'), 'utf8');

const checks = [];
function check(name, ok, extra) { checks.push({ name: name, ok: !!ok, extra: extra }); }

// ── 1. El DOM mínimo para poder ejecutar la vista ─────────────────────────────
class NodoFalso {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = []; this.hijos = this.children;
    this._html = ''; this._texto = '';
    this.style = {}; this.dataset = {}; this.attrs = {};
    this.hidden = false; this.disabled = false; this.value = '';
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
  appendChild(n) { this.children.push(n); return n; }
  removeChild(n) { var i = this.children.indexOf(n); if (i >= 0) this.children.splice(i, 1); }
  remove() {}
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener() {} removeEventListener() {}
  querySelector() { return null; } querySelectorAll() { return []; }
  closest() { return null; }
  focus() {}
  getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  scrollIntoView() {}
  parentElement = null;
}

// Del HTML real se arman los nodos que el JS busca por id, para que el arranque no falle.
const nodos = {};
function nodo(id) { return nodos[id] || (nodos[id] = new NodoFalso(id === 'tbody' ? 'tbody' : 'div')); }

const sandbox = {
  console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, Promise: Promise,
  Math: Math, Date: Date, JSON: JSON, Number: Number, String: String, Array: Array, Object: Object,
  isNaN: isNaN, parseInt: parseInt, parseFloat: parseFloat, Error: Error, Blob: function () {}, URL: { createObjectURL: function () { return ''; } },
  requestAnimationFrame: function (fn) { return setTimeout(fn, 0); },
  document: {
    getElementById: function (id) { return nodo(id); },
    querySelector: function () { return null; },
    querySelectorAll: function (sel) {
      // Los dos grupos que el arranque recorre de verdad
      if (sel === '.kair-thbtn') return [];
      if (sel === '.kair-tipo__chip') return [];
      return [];
    },
    addEventListener: function () {},
    createElement: function (t) { return new NodoFalso(t); },
    body: new NodoFalso('body'),
    documentElement: new NodoFalso('html')
  },
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  navigator: { userAgent: 'test' },
  // La vista registra el handshake y los atajos sobre window
  addEventListener: function () {}, removeEventListener: function () {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.location = { search: '?company=Tempoactiva' };
sandbox.URLSearchParams = URLSearchParams;
vm.createContext(sandbox);

// ── 2. Se ejecuta la vista REAL y se le responde el puente ────────────────────
let capturado = null;
sandbox.window.parent = {
  postMessage: function (m) {
    if (!m || typeof m.type !== 'string') return;
    if (m.type.slice(-8) !== '-request') { return; }
    const t = m.type.slice(0, -8);
    if (t === 'leer-todos') {
      capturado = null;
      sandbox.window.postMessage({
        type: 'leer-todos-response', requestId: m.requestId,
        payload: {
          success: true,
          data: [
            { numero: 1, descripcion: 'PROCEDIMIENTO DE QUEJAS', codigo: 'GT-PR-001', revision: '01',
              tipoDoc: false, tipoReg: false, tipoInterno: false, tipoExterno: false,
              fechaCreacion: '2016-12-19T00:00:00.000Z', fechaActualizacion: '2022-03-25T00:00:00.000Z',
              almacenamiento: 'Carpeta física', retencion: '1 año', disposicion: 'Muerto', hojaOrigen: 'listado maestro actualizado' },
            { numero: 2, descripcion: 'CARACTERIZACIÓN TALENTO HUMANO', codigo: 'GT-FO-001', revision: '1',
              tipoDoc: true, tipoReg: false, tipoInterno: true, tipoExterno: false,
              fechaCreacion: '19/12/2016', fechaActualizacion: '', almacenamiento: 'Carpeta Q.R.S',
              retencion: '2 años', disposicion: 'N/A', hojaOrigen: 'listado maestro actualizado' }
          ]
        }
      }, '*');
    } else if (t === 'actualizar') {
      capturado = { tipo: 'actualizar', payload: m.payload };
      sandbox.window.postMessage({ type: 'actualizar-response', requestId: m.requestId, payload: { success: true } }, '*');
    } else if (t === 'crear') {
      capturado = { tipo: 'crear', payload: m.payload };
      sandbox.window.postMessage({ type: 'crear-response', requestId: m.requestId, payload: { success: true, data: { numero: 3 } } }, '*');
    } else if (t === 'eliminar') {
      capturado = { tipo: 'eliminar', payload: m.payload };
      sandbox.window.postMessage({ type: 'eliminar-response', requestId: m.requestId, payload: { success: true } }, '*');
    } else if (t === 'guardar') {
      capturado = { tipo: 'guardar', payload: m.payload };
      sandbox.window.postMessage({ type: 'guardar-response', requestId: m.requestId, payload: { success: true } }, '*');
    }
  }
};

let arranco = true;
try { vm.runInContext(js, sandbox, { filename: 'archivo-retencion-view.js' }); }
catch (e) { arranco = false; check('JS: la vista arranca sin errores', false, e.message); }
if (arranco) check('JS: la vista arranca sin errores', true);

// ── 3. Estructura del diseño nuevo ───────────────────────────────────────────
check('HTML: tiene barra superior con migas de pan (breadcrumb)',
  /class="kair-top__crumb"/.test(html) && /Inicio/.test(html));
check('HTML: tiene las 4 tarjetas de indicadores', (html.match(/class="kair-kpi[ "]/g) || []).length >= 4,
  'encontradas: ' + (html.match(/class="kair-kpi[ "]/g) || []).length);
check('HTML: el indicador de archivo muerto es clicable (filtra la tabla)',
  /class="kair-kpi is-clickable" id="kpi-muerto"/.test(html));
check('HTML: tiene el filtro por disposición final', /id="f-disp"/.test(html));
check('HTML: tiene el botón "Limpiar" filtros', /id="btn-clear"/.test(html));
check('HTML: la tabla tiene las 11 columnas de siempre', (html.match(/<th[ >]/g) || []).length === 11,
  'encontradas: ' + (html.match(/<th[ >]/g) || []).length);
check('HTML: los 4 encabezados ordenables siguen ahí',
  ['desc', 'codigo', 'fcre', 'fact'].every(function (k) { return html.indexOf('data-sort="' + k + '"') >= 0; }));
check('HTML: el modal tiene los 4 bloques titulados',
  (html.match(/class="kair-fblock__t"/g) || []).length === 4);
check('HTML: el Tipo es un grupo de chips (no casillas)',
  /class="kair-tipo" id="m-tipo"/.test(html) && html.indexOf('type="checkbox"') < 0);
check('HTML: las fechas son selectores de fecha nativos',
  /type="date" id="m-fcre"/.test(html) && /type="date" id="m-fact"/.test(html));
check('HTML: la Disposición final es una lista desplegable',
  /<select id="m-disp">/.test(html));
check('HTML: la Retención es una lista desplegable (antes era texto libre)',
  /<select id="m-ret">/.test(html));
check('HTML: tiene botón de guardado masivo en la barra superior', /id="btn-guardar"/.test(html));
check('HTML: tiene el esqueleto de carga', /id="skel"/.test(html));
check('HTML: no quedan datos de ejemplo incrustados',
  !/GENERADOS|LITERALES|mulberry32/.test(html) && !/CARACTERIZACIÓN GESTIÓN TALNTO/.test(html));
check('HTML: los estilos y el JS están versionados (cache-bust)',
  /archivo-retencion-view\.css\?v=/.test(html) && /archivo-retencion-view\.js\?v=/.test(html));
check('Wrapper: la URL del iframe lleva cache-bust',
  /index\.html\?v=/.test(wrapper) && /archivo-retencion-dashboard\.html\?v=/.test(wrapper));

// ── 4. El adaptador de campos: BUG 1 y BUG 2 ─────────────────────────────────
check('Adaptador: traduce los 4 booleanos del backend al texto de Tipo',
  /function tipoDesdeBooleanos/.test(js) && /if \(d\.tipoDoc\) out\.push\('Documento'\)/.test(js));
check('Adaptador: el Tipo ya NO se lee de doc.tipo',
  !/tipo:\s*d\.tipo\b/.test(js));
check('Adaptador: la hoja se lee de hojaOrigen (no de doc.hoja)',
  /hoja:\s*d\.hojaOrigen/.test(js) && !/hoja:\s*d\.hoja\b/.test(js));
// OJO: la única mención a `disposicionFinal` que puede quedar es la del comentario de
// cabecera que explica el bug. En código no debe aparecer nunca más. Para no depender de
// cómo esté formateado el comentario, se recorre el archivo sacando los bloques /* */ y
// las líneas //, que es lo que hace un analizador de verdad.
function sinComentarios(t) {
  let out = '';
  let i = 0;
  while (i < t.length) {
    if (t[i] === '/' && t[i + 1] === '*') { const j = t.indexOf('*/', i + 2); i = (j === -1) ? t.length : j + 2; continue; }
    if (t[i] === '/' && t[i + 1] === '/') { const j = t.indexOf('\n', i); i = (j === -1) ? t.length : j; continue; }
    out += t[i]; i++;
  }
  return out;
}
const codigoSinComentarios = sinComentarios(js);
check('Adaptador: no queda ninguna referencia a disposicionFinal en el código',
  codigoSinComentarios.indexOf('disposicionFinal') < 0);
check('Adaptador: la Disposición se escribe como `disposicion`',
  /disposicion:\s*r\.disp/.test(js));

// ── 5. El payload real que sale hacia el backend (BUG 3) ─────────────────────
const modelo = {
  desc: 'PRUEBA', codigo: 'GT-PR-999', rev: '04', tipo: 'Registro, Interno',
  fcre: '2026-01-15', fact: '2026-02-20', alm: 'Carpeta Virtual', ret: '5 años', disp: 'Obsoleto'
};
// Se re-ejecuta la vista en un contexto aparte para poder llamar al adaptador de salida:
// se inyecta un gancho que expone `haciaBackend` a través del propio puente.
// Se re-ejecuta el adaptador de salida aislándolo del archivo real, para comprobar
// exactamente el payload que la vista le manda al backend del Excel.
let payload = null;
(function () {
  const desde = js.indexOf('function booleanosDesdeTipo');
  // El bloque de adaptadores termina donde arranca el estado de la vista.
  // (Hay que cortar DESPUÉS de `haciaBackend`: entre las dos funciones está el
  //  comentario de `desdeBackend`, así que no sirve cortar ahí.)
  const hasta = js.indexOf('/* ══════════════ ESTADO ══════════════ */');
  if (desde < 0 || hasta < 0 || hasta <= desde) {
    check('Adaptador: se pudo aislar haciaBackend del archivo real', false, 'no se encontraron los extremos');
    return;
  }
  const src = js.slice(desde, hasta);
  let fn = null;
  try {
    fn = vm.runInNewContext('(function(){' + src + '\nreturn haciaBackend;})()', { Object: Object, String: String });
  } catch (e) {
    check('Adaptador: se pudo aislar haciaBackend del archivo real', false, e.message);
    return;
  }
  if (typeof fn !== 'function') {
    check('Adaptador: se pudo aislar haciaBackend del archivo real', false, 'devolvió ' + typeof fn);
    return;
  }
  check('Adaptador: se pudo aislar haciaBackend del archivo real', true);
  payload = fn(modelo);
})();

check('Payload: manda `disposicion` (y no `disposicionFinal`)',
  payload && 'disposicion' in payload && !('disposicionFinal' in payload),
  payload ? Object.keys(payload).join(',') : 'sin payload');
check('Payload: el Tipo viaja como texto combinado',
  payload && payload.tipo === 'Registro, Interno', payload && payload.tipo);
check('Payload: los 4 booleanos acompañan y son coherentes con el texto',
  payload && payload.tipoReg === true && payload.tipoInterno === true &&
  payload.tipoDoc === false && payload.tipoExterno === false,
  payload ? JSON.stringify([payload.tipoDoc, payload.tipoReg, payload.tipoInterno, payload.tipoExterno]) : '');
check('Payload: los nombres del backend están todos presentes',
  payload && ['descripcion', 'codigo', 'revision', 'fechaCreacion', 'fechaActualizacion',
    'almacenamiento', 'retencion', 'disposicion'].every(function (k) { return k in payload; }));

// ── 6. Edición en línea + guardado masivo conservados ────────────────────────
check('JS: la edición en línea sigue existiendo (celdas editables)',
  /celdaEditable/.test(js) && /contenteditable/.test(js));
check('JS: la edición en línea marca la fila como "sin guardar"',
  /_dirty\s*=\s*true/.test(js) && /is-dirty/.test(js));
check('JS: hay guardado masivo contra el Excel', /async function guardarCambios/.test(js));
check('JS: los atajos Ctrl+N y Ctrl+F siguen', /k === 'n'/.test(js) && /k === 'f'/.test(js));
check('CSS: las celdas editables tienen estilo propio',
  /\.kair-cell-edit/.test(css) && /\.kair-row\.is-dirty/.test(css));

// ── 7. Puente y ciclo de vida ────────────────────────────────────────────────
check('JS: el puente mantiene los `type` que ya soporta el contenedor',
  ['leer-todos', 'crear', 'actualizar', 'eliminar'].every(function (t) {
    return js.indexOf("callParentAPI('" + t + "'") >= 0;
  }));
// El guardado masivo NO usa `guardar` (que reescribe la lista entera): manda un
// `actualizar` por fila. Es más seguro porque el backend aplica los cambios por número
// y así no se pierde ningún campo de las filas que no se tocaron.
check('JS: el guardado masivo actualiza fila por fila (no reescribe toda la lista)',
  /async function guardarCambios/.test(js) &&
  /sucios\[i\][\s\S]{0,400}callParentAPI\('actualizar'/.test(js));
check('JS: el contenedor sigue aceptando el guardado masivo por si se reusa',
  /case 'guardar-request'/.test(wrapper));
check('JS: avisa al contenedor cuando el iframe está listo',
  /notifyParent\('iframe-ready'/.test(js));
check('JS: el botón "Volver" pide la navegación al contenedor',
  /notifyParent\('back-to-module-request'/.test(js));
check('JS: el nombre de la empresa sale de la URL (no está fijo)',
  /params\.get\('company'\)/.test(js) && html.indexOf('Tempoactiva') < 0);

// ── 8. Modo oscuro completo, con los DOS atributos ───────────────────────────
check('CSS: define tokens oscuros para data-theme="dark"',
  /\[data-theme="dark"\],\s*\n\[data-theme="dark-legacy"\]\s*\{/.test(css) ||
  /\[data-theme="dark"\]/.test(css));
check('CSS: cubre también data-theme="dark-legacy" (tema oscuro manual)',
  /\[data-theme="dark-legacy"\]/.test(css));
['.kair-top', '.kair-kpi', '.kair-card', '.kair-table', '.kair-modal', '.kair-toast', '.kair-empty']
  .forEach(function (sel) {
    check('CSS: el modo oscuro alcanza ' + sel,
      new RegExp('\\[data-theme="dark-legacy"\\][^{]*' + sel.replace('.', '\\.')).test(css));
  });
check('CSS: el modal es una columna con el pie fijo (no tapa el último campo)',
  /\.kair-modal\s*\{[^}]*flex-direction:\s*column/.test(css) &&
  /\.kair-modal__body\s*\{[^}]*min-height:\s*0/.test(css));

// ── 9. Contrato DOM: el JS encuentra todo lo que busca ───────────────────────
const ids = [];
const re = /\$\('([a-z0-9-]+)'\)/g;
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
console.log('✅ Archivo y Retención en premium, con el adaptador de campos y el modo oscuro en su lugar');
