/* ============================================================
 * K+AIR · Smoke test — Evaluación y Selección de Proveedores y
 * Contratistas 2.10.1 · premium v2 (📦770)
 * ============================================================
 * El submódulo pasó de 11 archivos (css + 7 scripts de vistas +
 * orquestador) a UN solo par CSS+JS construido desde el prototipo
 * premium, recableado a los servicios reales que YA existían
 * (AsociadosServiceES / EvaluacionesServiceES / NoConformidadesServiceES).
 * Este test comprueba:
 *
 *   A. El REGISTRO en index.html: v2 con cache-bust, los 4 servicios
 *      cargados ANTES, y los 8 archivos viejos FUERA (sin doble global).
 *   B. La CONSTRUCCIÓN: el componente compila, conserva la firma que
 *      espera renderer.js, el marcado está balanceado y prefijado.
 *   C. El CSS: todo bajo .evs-scope, sin tokens Bootstrap sueltos.
 *   D. El RECABLEADO: cada guardado va por el servicio real y ya no
 *      quedan correlativos de ejemplo (SEQ_*).
 *
 * Correr con: node main/test-evaluacion-seleccion-v2.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'modules', 'gestion-integral', 'evaluacion-seleccion');
const F_JS = path.join(DIR, 'evaluacion-seleccion-v2.js');
const F_CSS = path.join(DIR, 'evaluacion-seleccion-v2.css');
const F_RENDERER = path.join(ROOT, 'renderer.js');

const js = fs.readFileSync(F_JS, 'utf8');
const css = fs.readFileSync(F_CSS, 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const renderer = fs.readFileSync(F_RENDERER, 'utf8');

/* El marcado viaja embebido en MARKUP_RAW (cadena con comillas escapadas) */
const mMarkup = js.match(/var MARKUP_RAW = "([\s\S]*?)";\s*\n\s*window\.EvaluacionSeleccionComponent/);
let markup = mMarkup ? mMarkup[1] : '';
markup = markup.replace(/\\"/g, '"').replace(/\\n/g, '\n');

const jsSinComentarios = js
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/[^\n]*$/gm, '');
function sinComentariosCss(t) { return t.replace(/\/\*[\s\S]*?\*\//g, ''); }
const cssLimpio = sinComentariosCss(css);

const checks = [];
function check(name, ok, extra) { checks.push({ name: name, ok: !!ok, extra: extra }); }

/* ══════════════ A. REGISTRO EN index.html ══════════════ */
check('index.html: carga la HOJA v2 con cache-bust',
  /evaluacion-seleccion-v2\.css\?v=/.test(indexHtml));
check('index.html: carga el COMPONENTE v2 con cache-bust',
  /evaluacion-seleccion-v2\.js\?v=/.test(indexHtml));
check('index.html: los 4 servicios se quedan cargados',
  ['kair-utils.js', 'asociados-service.js', 'evaluaciones-service.js', 'noconformidades-service.js']
    .every(function (s) { return indexHtml.indexOf('evaluacion-seleccion/' + s) !== -1; }));
check('index.html: los servicios cargan ANTES del v2.js (orden del global)',
  indexHtml.indexOf('noconformidades-service.js') < indexHtml.indexOf('evaluacion-seleccion-v2.js'));
['dashboard.js', 'registro.js', 'evaluacion.js', 'reevaluacion.js',
 'noconformidades.js', 'reportes.js', 'evaluacion-seleccion-component.js'].forEach(function (viejo) {
  check('index.html: fuera el script viejo ' + viejo,
    indexHtml.indexOf('evaluacion-seleccion/' + viejo) === -1);
});
check('index.html: fuera la hoja vieja (sin doble estilo)',
  indexHtml.indexOf('evaluacion-seleccion.css') === -1);
check('renderer.js: sigue montando window.EvaluacionSeleccionComponent (sin tocarlo)',
  /window\.EvaluacionSeleccionComponent\b/.test(renderer));

/* ══════════════ B. CONSTRUCCIÓN DEL COMPONENTE ══════════════ */
check('Módulo: el componente compila (vm.Script)',
  (function () { try { new vm.Script(js, { filename: 'evaluacion-seleccion-v2.js' }); return true; }
    catch (e) { return false; } })());
check('Módulo: node --check lo valida también',
  (function () {
    try { execSync('node --check "' + F_JS + '"', { stdio: 'pipe' }); return true; }
    catch (e) { return false; }
  })());
check('Módulo: se expone como window.EvaluacionSeleccionComponent',
  /window\.EvaluacionSeleccionComponent\s*=\s*EvaluacionSeleccionComponent/.test(js));
check('Módulo: conserva la firma que espera renderer.js (container, module, title, back, company)',
  /function EvaluacionSeleccionComponent\(container, moduleName, submoduleTitle, backToModuleCallback, currentCompany\)/.test(js));
check('Módulo: expone render()',
  /EvaluacionSeleccionComponent\.prototype\.render/.test(js));
check('Módulo: destroy() retira del <body> las capas mudadas (bug del modal flotante)',
  /prototype\.destroy = function \(\)/.test(js) &&
  /_nodosEnBody\.forEach\(function \(n\) \{ if \(n\.parentNode\) n\.parentNode\.removeChild\(n\); \}\)/.test(js));
check('Módulo: vigía de navegación — si el contenedor sale del documento, se limpian las capas',
  /new MutationObserver/.test(js) && /if \(!host\.isConnected\) _limpiarCapas\(\)/.test(js));
check('Módulo: un render repetido no duplica capas en el body',
  /_limpiarCapas\(\);\s*\n\s*host\.innerHTML = ''/.test(js));
check('Volver: el botón llama al callback de renderer.js (backCb), no un toast de pendiente',
  /\$\('#evs-btn-volver'\)\.addEventListener\('click'[\s\S]*?typeof backCb === 'function'[\s\S]*?backCb\(\); return;/.test(js) &&
  js.indexOf('integración pendiente') === -1);
check('Tabs: estilo subrayado — la línea es del contenedor (1px) y la activa 2px azul',
  /\.evs-pv-tabs\{[^}]*border-bottom:1px solid var\(--kair-border\)[^}]*\}/.test(css) &&
  /\.evs-pv-tab\{[^}]*border-bottom:2px solid transparent[^}]*margin-bottom:-1px/.test(css) &&
  /\.evs-pv-tab\.evs-is-active\{[^}]*color:var\(--kair-blue\)[^}]*border-bottom-color:var\(--kair-blue\)/.test(css));
check('Tabs: la píldora navy NO vuelve (sin fondo en la activa ni box-shadow)',
  !/\.evs-pv-tab\.evs-is-active\{[^}]*background:var\(--kair-navy\)/.test(css) &&
  !/\.evs-pv-tab\.evs-is-active\{[^}]*box-shadow/.test(css));
check('Tabs: sin overflow-x (flex-wrap:wrap, lección del chip cortado)',
  /\.evs-pv-tabs\{[^}]*flex-wrap:wrap/.test(css) && !/\.evs-pv-tabs\{[^}]*overflow-x/.test(css));
check('Módulo: inyecta su propio marcado en el contenedor',
  /marcadoRaiz\.innerHTML = MARKUP_RAW/.test(js) && /host\.appendChild\(marcadoRaiz\)/.test(js));
check('Módulo: raíz con alcance .evs-scope (el CSS es exclusivo del módulo)',
  /marcadoRaiz\.className = 'evs-scope'/.test(js));
check('Módulo: mueve overlays y avisos al <body> (son position:fixed)',
  /document\.body\.appendChild\(n\)/.test(js));
check('Módulo: helpers $ y $$ definidos UNA vez cada uno',
  (js.match(/var \$ = function/g) || []).length === 1 &&
  (js.match(/var \$\$ = function/g) || []).length === 1);
check('Módulo: ya no quedan correlativos de ejemplo (SEQ_*)',
  jsSinComentarios.indexOf('SEQ_EVAL') === -1 && jsSinComentarios.indexOf('SEQ_NC') === -1 &&
  jsSinComentarios.indexOf('SEQ_ASOC') === -1);
check('Módulo: ya no quedan ids \'# sin prefijo evs-',
  !/'#[A-Za-z][\w-]*'/.test(jsSinComentarios.replace(/'#evs-[^']*'/g, '')));

/* Marcado */
const abreDiv = (markup.match(/<div\b/g) || []).length;
const cierraDiv = (markup.match(/<\/div>/g) || []).length;
check('Marcado: los <div> están balanceados', abreDiv === cierraDiv, abreDiv + ' vs ' + cierraDiv);
check('Marcado: no se colaron bloques de script ni de estilo',
  markup.indexOf('<script') < 0 && markup.indexOf('<style') < 0);
const ids = (markup.match(/id="([^"]+)"/g) || []).map(function (m) { return m.slice(4, -1); });
check('Marcado: no hay ids duplicados', new Set(ids).size === ids.length,
  'total: ' + ids.length);
['view-dash', 'view-reg', 'view-eval', 'view-ree', 'view-nc', 'view-rep',
 'modal-asoc', 'modal-nc', 'toasts', 'q-reg', 'q-nc', 'tb-nc', 'btn-reportar-nc'].forEach(function (id) {
  check('Marcado: existe #evs-' + id, ids.indexOf('evs-' + id) >= 0);
});
check('Clases: ninguna clase del marcado quedó sin prefijo evs-',
  !/class="(?!evs-)[^"]/.test(markup));
check('Clases: no hay doble prefijo evs-evs-',
  css.indexOf('evs-evs-') < 0 && markup.indexOf('evs-evs-') < 0 && js.indexOf('evs-evs-') < 0);

/* ══════════════ C. EL CSS ══════════════ */
check('CSS: el archivo existe y no está vacío', css.length > 20000, 'largo: ' + css.length);
check('CSS: TODOS los selectores bajo .evs-scope o son @media/@keyframes',
  (function () {
    /* Mini parser de llaves emparejadas: entiende @keyframes (selectores
       from/to legítimos) y @media (se verifica su interior en recursivo). */
    function malosEn(bloque) {
      const malos = [];
      let i = 0;
      while (i < bloque.length) {
        const abre = bloque.indexOf('{', i);
        if (abre === -1) break;
        const sel = bloque.slice(i, abre).trim();
        let prof = 1, j = abre + 1;
        while (prof > 0 && j < bloque.length) {
          if (bloque[j] === '{') prof++;
          else if (bloque[j] === '}') prof--;
          j++;
        }
        const cuerpo = bloque.slice(abre + 1, j - 1);
        if (/^@keyframes\b/.test(sel)) { i = j; continue; }
        if (/^@media\b/.test(sel)) { malos.push.apply(malos, malosEn(cuerpo)); i = j; continue; }
        if (/^@/.test(sel)) { i = j; continue; }
        sel.split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (p) {
          if (p.indexOf('.evs-scope') === -1) malos.push(p);
        });
        i = j;
      }
      return malos;
    }
    const malos = malosEn(cssLimpio);
    if (malos.length) console.log('   selectores sin alcance: ' + malos.slice(0, 8).join(' | '));
    return malos.length === 0;
  })());
check('CSS: los tokens del módulo NO definen un :root global (pisarían los de la app)',
  !/(^|\})\s*:root\s*\{/.test(cssLimpio) && /\.evs-scope\s*\{[^}]*--kair-bg/.test(cssLimpio));
check('CSS: modo oscuro para data-theme="dark"',
  /\[data-theme="dark"\][\s\S]*\.evs-scope/.test(css));
check('CSS: modo oscuro para data-theme="dark-legacy"',
  /\[data-theme="dark-legacy"\][\s\S]*\.evs-scope/.test(css));
check('CSS: ningún nombre que use Bootstrap quedó suelto (badge/card/btn/toast/overlay)',
  !/^\s*\.(badge|card|btn|toast|overlay|row|modal|chip|tab)\s*[,{]/m.test(cssLimpio));
check('CSS: comentarios y llaves balanceados',
  (css.match(/\/\*/g) || []).length === (css.match(/\*\//g) || []).length &&
  (css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length);
check('CSS: los keyframes llevan prefijo evs- (no fugan al documento)',
  !/@keyframes\s+(alin|pvspin|ovin|mdin|tin|tout)\b/.test(cssLimpio));

/* ══════════════ D. RECABLEADO A LOS SERVICIOS REALES ══════════════ */
check('Datos: los arreglos de ejemplo quedaron vacíos',
  /var ASOCIADOS = \[\];/.test(js) && /var EVALUACIONES = \[\];/.test(js) && /var NCS = \[\];/.test(js));
check('Datos: la carga inicial viene de los servicios (volcado doble 450ms)',
  /volcarServiciosALocal\(\)/.test(js) && /setTimeout\(function \(\) \{\s*volcarServiciosALocal/.test(js));
check('Guardado: asociado nuevo → AsociadosServiceES.create (razonSocial/producto/tipo mayúscula)',
  /AsociadosServiceES\.create\(\{ razonSocial: nombre, nit: nit, tipo: \(tipo \|\| ''\)\.toUpperCase\(\), producto: objeto \}\)/.test(js));
check('Guardado: asociado editado → AsociadosServiceES.update',
  /AsociadosServiceES\.update\(a\.id, \{/.test(js));
check('Guardado: evaluación de selección → EvaluacionesServiceES.createSelectionEval',
  /createSelectionEval\(\{ asociadoId: asociadoId, criterios:/.test(js));
check('Guardado: reevaluación → EvaluacionesServiceES.createReevaluation',
  /createReevaluation\(\{ asociadoId: asociadoId, criterios:/.test(js));
check('Guardado: no conformidad → NoConformidadesServiceES.create (fechaDeteccion/responsableSeguimiento)',
  /NoConformidadesServiceES\.create\(\{ asociadoId: asociadoId, fechaDeteccion: fecha, descripcion: desc, responsableSeguimiento: resp \}\)/.test(js));
check('Guardado: seguimiento/cierre NC → updateEstado con estados mayúscula',
  /updateEstado\(id, 'EN_SEGUIMIENTO'\)/.test(js) && /updateEstado\(id, 'CERRADA'\)/.test(js));

/* ══════════════ Reporte ══════════════ */
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) console.log('[OK  ] ' + c.name);
  else { failed++; console.log('[FAIL] ' + c.name + (c.extra ? ' → ' + c.extra : '')); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ Evaluación y Selección de Proveedores y Contratistas en premium v2, recableada a los servicios reales');
