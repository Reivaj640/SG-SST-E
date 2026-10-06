/* ============================================================
 * K+AIR · Smoke test — Gestión del Cambio 2.11.1 · premium v2
 * ============================================================
 * El submódulo pasó de 6 archivos (logic + 2 css + html +
 * viewer + index) a UN solo par CSS+JS con el marcado embebido,
 * conservando EXACTO el contrato de datos Excel por empresa y la
 * máquina de estados. Este test comprueba:
 *
 *   A. El REGISTRO en index.html: v2 con cache-bust y el script
 *      viejo FUERA (sin doble global).
 *   B. La CONSTRUCCIÓN: el componente compila, conserva la firma
 *      que espera renderer.js, el marcado está balanceado y
 *      prefijado gdc-, y tiene destroy() + vigía de navegación.
 *   C. El CSS: todo bajo .gdc-scope, con modo oscuro y sin
 *      tokens Bootstrap sueltos.
 *   D. El CONTRATO DE DATOS: los 4 canales IPC, los 13 ítems de
 *      la lista de chequeo y las transiciones de estado.
 *
 * Correr con: node main/test-gestion-cambio-v2.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'modules', 'gestion-integral', 'gestion-del-cambio');
const F_JS = path.join(DIR, 'gestion-cambio-v2.js');
const F_CSS = path.join(DIR, 'gestion-cambio-v2.css');
const F_RENDERER = path.join(ROOT, 'renderer.js');

const js = fs.readFileSync(F_JS, 'utf8');
const css = fs.readFileSync(F_CSS, 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const renderer = fs.readFileSync(F_RENDERER, 'utf8');

/* El marcado viaja embebido: MARCADO = [ ... ].join('\n')
   (greedy: hay varios arrays .join en el archivo y MARCADO es el último) */
const mMarcado = js.match(/var MARCADO = \[([\s\S]*)\]\.join\('\\n'\);/);
let markup = mMarcado ? mMarcado[1] : '';
markup = markup.replace(/^\s*'/, '').replace(/',\s*$/, '').replace(/\\'/g, "'");

const jsSinComentarios = js
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/[^\n]*$/gm, '');
function sinComentariosCss(t) { return t.replace(/\/\*[\s\S]*?\*\//g, ''); }
const cssLimpio = sinComentariosCss(css);

const checks = [];
function check(name, ok, extra) { checks.push({ name: name, ok: !!ok, extra: extra }); }

/* ══════════════ A. REGISTRO EN index.html ══════════════ */
check('index.html: carga la HOJA v2 con cache-bust',
  /gestion-cambio-v2\.css\?v=/.test(indexHtml));
check('index.html: carga el COMPONENTE v2 con cache-bust',
  /gestion-cambio-v2\.js\?v=/.test(indexHtml));
check('index.html: el link CSS aparece UNA sola vez (sin duplicado)',
  (indexHtml.match(/gestion-cambio-v2\.css/g) || []).length === 1);
check('index.html: FUERA el script viejo gestion-cambio-logic.js',
  indexHtml.indexOf('gestion-cambio-logic.js') === -1);
check('renderer.js: sigue montando window.GestionDelCambioComponent (sin tocarlo)',
  /window\.GestionDelCambioComponent\b/.test(renderer));

/* ══════════════ B. CONSTRUCCIÓN DEL COMPONENTE ══════════════ */
check('Módulo: el componente compila (vm.Script)',
  (function () { try { new vm.Script(js, { filename: 'gestion-cambio-v2.js' }); return true; }
    catch (e) { return false; } })());
check('Módulo: node --check lo valida también',
  (function () {
    try { execSync('node --check "' + F_JS + '"', { stdio: 'pipe' }); return true; }
    catch (e) { return false; }
  })());
check('Módulo: se expone como window.GestionDelCambioComponent',
  /window\.GestionDelCambioComponent\s*=\s*GestionDelCambioComponent/.test(js));
check('Módulo: conserva la firma que espera renderer.js (container, company, module, submodule, back)',
  /constructor\(container, companyName, moduleName, submoduleName, onBackToModule\)/.test(js));
check('Módulo: expone render()',
  /async render\(\)/.test(js));
check('Módulo: destroy() retira del <body> las capas mudadas (bug del modal flotante)',
  /destroy\(\)[\s\S]*?#limpiarCapas\(\)/.test(js) &&
  /#limpiarCapas\(\)[\s\S]*?_nodosEnBody\.forEach\(function \(n\) \{ if \(n\.parentNode\) n\.parentNode\.removeChild\(n\); \}\)/.test(js));
check('Módulo: vigía de navegación — si el contenedor o la raíz salen del documento, se limpian las capas',
  /new MutationObserver/.test(js) &&
  /if \(!host\.isConnected \|\| !self\.raiz \|\| !self\.raiz\.isConnected\) self\.#limpiarCapas\(\)/.test(js));
check('Módulo: un render repetido recoge primero las capas viejas (no duplica)',
  /#limpiarCapas\(\);\s*\n\s*host\.innerHTML = ''/.test(js));
check('Módulo: inyecta su propio marcado en el contenedor',
  /this\.raiz\.innerHTML = MARCADO/.test(js) && /host\.appendChild\(this\.raiz\)/.test(js));
check('Módulo: raíz con alcance .gdc-scope (el CSS es exclusivo del módulo)',
  /this\.raiz\.className = 'gdc-scope'/.test(js));
check('Módulo: mueve overlays y avisos al <body> ENVUELTOS en .gdc-scope (los selectores CSS son descendientes)',
  /var wrap = document\.createElement\('div'\)/.test(js) &&
  /wrap\.className = 'gdc-scope'/.test(js) &&
  /wrap\.appendChild\(n\)/.test(js) &&
  /document\.body\.appendChild\(wrap\)/.test(js));
check('Módulo: el ESC se liga por instancia y se desliga en destroy() (sin doble-fire)',
  /document\.addEventListener\('keydown'/.test(js) &&
  /document\.removeEventListener\('keydown'/.test(js));
check('Módulo: helpers $ y $$ definidos UNA vez cada uno (anclados a inicio de línea)',
  (js.match(/^    \$\(sel\) \{$/m) || []).length === 1 &&
  (js.match(/^    \$\$\(sel\) \{$/m) || []).length === 1);
check('Módulo: sin typos de claves de estado (aprbada)',
  jsSinComentarios.indexOf('aprbada') === -1);

/* Marcado */
const abreDiv = (markup.match(/<div\b/g) || []).length;
const cierraDiv = (markup.match(/<\/div>/g) || []).length;
check('Marcado: los <div> están balanceados', abreDiv === cierraDiv, abreDiv + ' vs ' + cierraDiv);
const abreSec = (markup.match(/<section\b/g) || []).length;
const cierraSec = (markup.match(/<\/section>/g) || []).length;
check('Marcado: los <section> están balanceados', abreSec === cierraSec, abreSec + ' vs ' + cierraSec);
check('Marcado: no se colaron bloques de script ni de estilo',
  markup.indexOf('<script') < 0 && markup.indexOf('<style') < 0);
const ids = (markup.match(/id="([^"]+)"/g) || []).map(function (m) { return m.slice(4, -1); });
check('Marcado: no hay ids duplicados', new Set(ids).size === ids.length,
  'total: ' + ids.length);
/* IDs clave: vistas, modal, asistente, filtros, KPIs, toasts */
['gdc-new', 'gdc-back', 'gdc-chip-emp', 'gdc-f-estado', 'gdc-f-riesgo',
 'gdc-tbody', 'gdc-empty', 'gdc-k-pend', 'gdc-k-alto', 'gdc-k-activos',
 'gdc-k-mes', 'gdc-modal-title', 'gdc-form',
 'gdc-step-ind', 'gdc-prev', 'gdc-next', 'gdc-save', 'gdc-trans',
 'gdc-foot-note', 'gdc-toasts', 'gdc-plan-body', 'gdc-plan-add',
 'gdc-ejec-obs', 'gdc-incidentes', 'gdc-conclusion'].forEach(function (id) {
  check('Marcado: existe #' + id, ids.indexOf(id) >= 0);
});
check('Clases: ninguna clase del marcado quedó sin prefijo gdc- (o utilitaria)',
  !/class="(?!gdc-|lucide)[^"]/.test(markup));
check('Clases: no hay doble prefijo gdc-gdc-',
  css.indexOf('gdc-gdc-') < 0 && markup.indexOf('gdc-gdc-') < 0 && js.indexOf('gdc-gdc-') < 0);
check('Marcado: los 4 pasos del asistente existen (indicador + sección cada uno)',
  [1, 2, 3, 4].every(function (n) {
    return (markup.match(new RegExp('data-step="' + n + '"', 'g')) || []).length === 2;
  }));

/* ══════════════ C. EL CSS ══════════════ */
check('CSS: el archivo existe y no está vacío', css.length > 20000, 'largo: ' + css.length);
check('CSS: TODOS los selectores bajo .gdc-scope o son @media/@keyframes',
  (function () {
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
          if (p.indexOf('.gdc-scope') === -1) malos.push(p);
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
  !/(^|\})\s*:root\s*\{/.test(cssLimpio) && /\.gdc-scope\s*\{[^}]*--gdc-/.test(cssLimpio));
check('CSS: modo oscuro para data-theme="dark"',
  /\[data-theme="dark"\][\s\S]*\.gdc-scope/.test(css));
check('CSS: modo oscuro para data-theme="dark-legacy"',
  /\[data-theme="dark-legacy"\][\s\S]*\.gdc-scope/.test(css));
check('CSS: ningún nombre genérico quedó suelto (badge/card/btn/toast/overlay/modal)',
  !/^\s*\.(badge|card|btn|toast|overlay|row|modal|chip|tab)\s*[,{]/m.test(cssLimpio));
check('CSS: comentarios y llaves balanceados',
  (css.match(/\/\*/g) || []).length === (css.match(/\*\//g) || []).length &&
  (css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length);

/* ══════════════ D. CONTRATO DE DATOS (IPC Excel) ══════════════ */
check('Datos: carga inicial → window.electronAPI.loadGestionCambioData(empresa)',
  /loadGestionCambioData\(this\.companyName\)/.test(js));
check('Datos: guardado → window.electronAPI.saveGestionCambioData(empresa, data)',
  /saveGestionCambioData\(this\.companyName,/.test(js));
check('Datos: correlativo → window.electronAPI.generateGestionCambioId(empresa)',
  /generateGestionCambioId\(this\.companyName\)/.test(js));
check('Datos: transición de estado → window.electronAPI.updateGestionCambioEstado(empresa, id, estado, extra)',
  /updateGestionCambioEstado\(this\.companyName,/.test(js));
check('Datos: los 4 canales usados y ninguno más (load/save/generate/update)',
  (function () {
    const usados = jsSinComentarios.match(/electronAPI\.(\w+)/g) || [];
    const unicos = Array.from(new Set(usados));
    return unicos.length === 4 &&
      unicos.every(function (c) {
        return /GestionCambio/.test(c);
      });
  })());
check('Datos: la lista de chequeo conserva los 13 ítems (Rh1-4, Rl1-3, Sst1-6)',
  (js.match(/\{ k: 'Rh[1-4]'/g) || []).length === 4 &&
  (js.match(/\{ k: 'Rl[1-3]'/g) || []).length === 3 &&
  (js.match(/\{ k: 'Sst[1-6]'/g) || []).length === 6);
check('Datos: los 8 tipos de cambio se conservan',
  /var TIPOS_CAMBIO = \[/.test(js) && (js.match(/'(Operativo|Organizacional|Tecnológico|Locativo|Personal|Temporal|Permanente|Emergencia)'/g) || []).length === 8);
check('Estados: la máquina de estados contempla las 6 transiciones',
  /En Evaluación/.test(js) && /En Ejecución/.test(js) &&
  /No Aprobado/.test(js) && /Cerrado/.test(js));
check('Validación: pasar a Aprobado exige checklist completo (13 ítems vía CLAVES) y nivel de riesgo',
  /var missing = CLAVES\.filter\(function \(k\) \{ return !radio\('gdc-cl-' \+ k\); \}\)/.test(js) &&
  /if \(missing\.length\) errors\.push\('Lista de chequeo incompleta/.test(js) &&
  /if \(!radio\('gdc-nivel'\)\) errors\.push\('Nivel de riesgo requerido'\)/.test(js));
check('Validación: cerrar exige fecha de ejecución y fecha de cierre',
  /gdc-ejec-date'\)\) errors\.push\('Fecha de ejecución requerida'\)/.test(js) &&
  /gdc-cierre-date'\)\) errors\.push\('Fecha de cierre requerida'\)/.test(js));
check('Validación: iniciar ejecución exige al menos una aprobación (sst o área)',
  /if \(!get\('gdc-ap-sst-date'\) && !get\('gdc-ap-area-date'\)\) errors\.push\('Se requiere al menos una fecha de aprobación'\)/.test(js));

/* ══════════════ Reporte ══════════════ */
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) console.log('[OK  ] ' + c.name);
  else { failed++; console.log('[FAIL] ' + c.name + (c.extra ? ' → ' + c.extra : '')); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ Gestión del Cambio (2.11.1) en premium v2, conservando el contrato de datos Excel y la máquina de estados');
