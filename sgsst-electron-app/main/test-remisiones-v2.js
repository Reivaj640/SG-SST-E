/* ============================================================
 * K+AIR · Smoke test — 3.1.6 Restricciones y Remisiones · premium v2
 * ============================================================
 * "Enviar Remisión" y "Control de Remisiones" pasaron de páginas
 * con iframe (enviar-remision.html + bridge de postMessage) y una
 * tabla legacy, a dos componentes embebidos con marcado propio.
 * Además (📦776) "Enviar Remisión" cubre el FLUJO COMPLETO en una sola
 * interfaz (cargar PDF → generar el informe oficial → enviar a la EPS):
 * la página vieja generar-informe-remision.html y el modal de envío
 * quedaron fuera.
 * Este test comprueba:
 *
 *   A. REGISTRO en index.html (4 archivos con cache-bust, tras el logic).
 *   B. RECABLEADO de restricciones-medicas-logic.js: los dos puntos de
 *      montaje usan los componentes v2 y el flujo viejo quedó fuera.
 *   C. CONSTRUCCIÓN de los componentes: compilan, exportan el global,
 *      conservan los canales de datos reales y las lecciones
 *      (avisos envueltos al body, destroy + vigía).
 *   D. EL CSS: todo bajo su alcance, modo oscuro, sin genéricos.
 *   E. El PORTAL y el VISOR (📦775).
 *
 * Correr con: node main/test-remisiones-v2.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'modules', 'gestion-salud', 'restricciones-medicas');
const F_ENV_JS = path.join(DIR, 'enviar-remision-v2.js');
const F_ENV_CSS = path.join(DIR, 'enviar-remision-v2.css');
const F_CTL_JS = path.join(DIR, 'control-remisiones-v2.js');
const F_CTL_CSS = path.join(DIR, 'control-remisiones-v2.css');
const F_STAT_JS = path.join(DIR, 'estadisticas-remisiones-v2.js');
const F_STAT_CSS = path.join(DIR, 'estadisticas-remisiones-v2.css');
const F_LOGIC = path.join(DIR, 'restricciones-medicas-logic.js');

const envJs = fs.readFileSync(F_ENV_JS, 'utf8');
const envCss = fs.readFileSync(F_ENV_CSS, 'utf8');
const ctlJs = fs.readFileSync(F_CTL_JS, 'utf8');
const ctlCss = fs.readFileSync(F_CTL_CSS, 'utf8');
const statJs = fs.readFileSync(F_STAT_JS, 'utf8');
const statCss = fs.readFileSync(F_STAT_CSS, 'utf8');
const logic = fs.readFileSync(F_LOGIC, 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const mainJs = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const portal = fs.readFileSync(path.join(DIR, 'restricciones-medicas-home.html'), 'utf8');
const viewCss = fs.readFileSync(path.join(DIR, 'remisiones-view.css'), 'utf8');

const checks = [];
function check(name, ok, extra) { checks.push({ name: name, ok: !!ok, extra: extra }); }

/* Versiones sin comentarios: los comentarios históricos pueden mencionar
   archivos viejos sin que eso sea código muerto. */
function sinComentarios(t) {
  return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/[^\n]*$/gm, '');
}
const logicSin = sinComentarios(logic);
const envJsSin = sinComentarios(envJs);

function scopedCssOk(css, scope) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
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
        if (p.indexOf(scope) === -1) malos.push(p);
      });
      i = j;
    }
    return malos;
  }
  return malosEn(limpio);
}

/* ══════════════ A. REGISTRO EN index.html ══════════════ */
check('index.html: hoja Enviar v2 con cache-bust',
  /enviar-remision-v2\.css\?v=/.test(indexHtml));
check('index.html: componente Enviar v2 con cache-bust',
  /enviar-remision-v2\.js\?v=/.test(indexHtml));
check('index.html: hoja Control v2 con cache-bust',
  /control-remisiones-v2\.css\?v=/.test(indexHtml));
check('index.html: componente Control v2 con cache-bust',
  /control-remisiones-v2\.js\?v=/.test(indexHtml));
check('index.html: cargan DESPUÉS del restricciones-medicas-logic.js',
  indexHtml.indexOf('restricciones-medicas-logic.js') < indexHtml.indexOf('enviar-remision-v2.js') &&
  indexHtml.indexOf('restricciones-medicas-logic.js') < indexHtml.indexOf('control-remisiones-v2.js'));
check('index.html: cada archivo v2 aparece UNA sola vez',
  (indexHtml.match(/enviar-remision-v2\.js/g) || []).length === 1 &&
  (indexHtml.match(/control-remisiones-v2\.js/g) || []).length === 1);

/* ══════════════ B. RECABLEADO DEL LOGIC.JS ══════════════ */
check('logic.js: compila (node --check)',
  (function () {
    try { execSync('node --check "' + F_LOGIC + '"', { stdio: 'pipe' }); return true; }
    catch (e) { return false; }
  })());
check('logic.js: showEnviarRemisionPage monta EnviarRemisionV2Component (sin iframe ni informe)',
  /showEnviarRemisionPage\(\)[\s\S]*?new window\.EnviarRemisionV2Component\(this\.container, \{/.test(logic) &&
  !/enviar-remision\.html/.test(logicSin) && !/generar-informe-remision/.test(logicSin));
check('logic.js: _renderControlRemisionesView monta ControlRemisionesV2Component (sin tabla legacy)',
  /_renderControlRemisionesView\(\)[\s\S]*?new window\.ControlRemisionesV2Component\(this\.container, \{/.test(logic));
check('logic.js: el volver del portal sigue siendo render() (antesala)',
  /onBack: function \(\) \{ self\.render\(\); \}/.test(logic));
check('logic.js: el explorador de archivos (remisiones-view.html) NO se tocó',
  /remisiones-view\.html\?company=/.test(logic));
check('logic.js: el flujo viejo (informe iframe + modal de envío) quedó FUERA',
  !/generar-informe-remision/.test(logicSin) && !/showGenerarInformePage/.test(logicSin) &&
  !/_renderSendOnlyPage/.test(logicSin) && !/env-modal/.test(logicSin));
check('logic.js: el bridge conserva los handlers del visor (preview/folders/volver)',
  /case 'get-pdf-preview-request'/.test(logic) &&
  /case 'get-document-folders-request'/.test(logic) &&
  /case 'back-to-module-request'/.test(logic));

/* ══════════════ C. CONSTRUCCIÓN DE LOS COMPONENTES ══════════════ */
['enviar-remision-v2.js', 'control-remisiones-v2.js'].forEach(function (f) {
  const js = f.indexOf('enviar') === 0 ? envJs : ctlJs;
  check(f + ': compila (vm.Script)',
    (function () { try { new vm.Script(js, { filename: f }); return true; }
      catch (e) { return false; } })());
  check(f + ': node --check lo valida',
    (function () {
      try { execSync('node --check "' + path.join(DIR, f) + '"', { stdio: 'pipe' }); return true; }
      catch (e) { return false; }
    })());
});
check('Enviar: expone window.EnviarRemisionV2Component',
  /window\.EnviarRemisionV2Component\s*=\s*EnviarRemisionV2Component/.test(envJs));
check('Control: expone window.ControlRemisionesV2Component',
  /window\.ControlRemisionesV2Component\s*=\s*ControlRemisionesV2Component/.test(ctlJs));
check('Enviar: constructor recibe (container, opts) con companyName/onBack/logMessage',
  /constructor\(container, opts\)/.test(envJs) &&
  /this\.onBack = opts\.onBack/.test(envJs) && /this\.logMessage = opts\.logMessage/.test(envJs));
check('Control: constructor recibe (container, opts) con companyName/onBack',
  /constructor\(container, opts\)/.test(ctlJs) &&
  /this\.onBack = opts\.onBack/.test(ctlJs));
check('Enviar: usa los canales reales selectPdfFile y processRemisionPdf',
  /electronAPI\.selectPdfFile\(\)/.test(envJs) &&
  /electronAPI\.processRemisionPdf\(filePath\)/.test(envJs));
check('Enviar: el FLUJO COMPLETO vive en el componente (3 pasos, sin redirigir a otra pantalla)',
  /PASOS = \['Cargar PDF', 'Generar informe oficial', 'Enviar a la EPS'\]/.test(envJs) &&
  !/onNavigateToInforme/.test(envJsSin) && !/generar-informe-remision/.test(envJsSin));
check('Enviar: genera el informe oficial con generateRemisionDocument',
  /electronAPI\.generateRemisionDocument\(this\.extractedData, this\.companyName\)/.test(envJs));
check('Enviar: envía con sendRemisionByWhatsapp / sendRemisionByEmail',
  /electronAPI\.sendRemisionByWhatsapp\(this\.documentPath/.test(envJs) &&
  /electronAPI\.sendRemisionByEmail\(this\.documentPath/.test(envJs));
check('Enviar: busca el contacto con getContactInfo',
  /electronAPI\.getContactInfo\(cedula/.test(envJs));
check('Enviar: el paso 3 trae VISTA PREVIA del informe antes de enviar (abre el visor)',
  /id="remenv-preview-name"/.test(envJs) && /id="remenv-ver-informe"/.test(envJs) &&
  /#renderPreview\(\)/.test(envJs) && /#verInforme\(\)/.test(envJs) &&
  /kairFV\.openWithFileViewerFromPath\(this\.documentPath\)/.test(envJs));
check('Enviar: botón Cancelar con confirmación que reinicia el flujo sin borrar nada',
  /id="remenv-cancelar"/.test(envJs) && /id="remenv-confirm"/.test(envJs) &&
  /#cancelarProceso\(\)/.test(envJs) && /this\.extractedData = null;/.test(envJs) &&
  /this\.documentPath = null;/.test(envJs) && /#mostrarPaso\(1\)/.test(envJs));
check('Control: usa getControlRemisionesData con la empresa',
  /electronAPI\.getControlRemisionesData\(this\.companyName\)/.test(ctlJs));
check('Control: guarda con la FIRMA REAL del backend { filePath, cellAddress, newValue }',
  /electronAPI\.updateExcelCell\(\{[\s\S]*?filePath: this\.filePath,[\s\S]*?cellAddress:[\s\S]*?newValue: newValue[\s\S]*?\}\)/.test(ctlJs));
check('Control: la dirección de celda es A1 (letras + fila REAL del Excel, vía rowNumbers)',
  /#direccionA1\(colIndex, excelRow\)/.test(ctlJs) &&
  /String\.fromCharCode\(65 \+ m\)/.test(ctlJs) &&
  /return letras \+ excelRow/.test(ctlJs) &&
  /this\.rowNumbers\[rowIndex\] \|\| \(rowIndex \+ 2\)/.test(ctlJs));
check('Control: consume rowNumbers del backend (fila real tras filtrar basura)',
  /this\.rowNumbers = Array\.isArray\(result\.rowNumbers\)/.test(ctlJs));
check('Backend: get-control-remisiones-data descarta filas VACÍAS y ENCABEZADOS repetidos',
  /const descartadas = \{ vacias: 0, encabezados: 0 \}/.test(mainJs) &&
  /if \(keyDe\(row\) === headerKey\) \{ descartadas\.encabezados\+\+; return; \}/.test(mainJs) &&
  /rowNumbers\.push\(excelRow\)/.test(mainJs) &&
  /rowNumbers: rowNumbers,/.test(mainJs));
check('Control: abre el Excel con openPath',
  /electronAPI\.openPath\(self\.filePath\)/.test(ctlJs));
check('Ambos: avisos se mudan al <body> ENVUELTOS en su alcance (lección del modal)',
  /wrap\.className = 'remenv-scope'/.test(envJs) && /document\.body\.appendChild\(wrap\)/.test(envJs) &&
  /wrap\.className = 'remctl-scope'/.test(ctlJs) && /document\.body\.appendChild\(wrap\)/.test(ctlJs));
check('Ambos: destroy() retira las capas y el ESC/vigía no queda colgado',
  /destroy\(\)[\s\S]*?#limpiarCapas\(\)/.test(envJs) && /destroy\(\)[\s\S]*?#limpiarCapas\(\)/.test(ctlJs));
check('Ambos: vigía de navegación (host o raíz desconectados → limpiar capas)',
  /!host\.isConnected \|\| !self\.raiz \|\| !self\.raiz\.isConnected/.test(envJs) &&
  /!host\.isConnected \|\| !self\.raiz \|\| !self\.raiz\.isConnected/.test(ctlJs));
check('Ambos: helpers $ con reserva para las capas del body',
  /_nodosEnBody\[i\]\.querySelector\(sel\)/.test(envJs) &&
  /_nodosEnBody\[i\]\.querySelector\(sel\)/.test(ctlJs));
check('Ambos: sin ids duplicados en el marcado embebido',
  (function () {
    function dupes(js) {
      const m = js.match(/var MARCADO = \[([\s\S]*)\]\.join\('\\n'\);/);
      if (!m) return 'sin MARCADO';
      const ids = (m[1].match(/id="([^"]+)"/g) || []).map(function (x) { return x.slice(4, -1); });
      return new Set(ids).size === ids.length ? null : 'ids duplicados';
    }
    return !dupes(envJs) && !dupes(ctlJs);
  })());

/* ══════════════ D. EL CSS ══════════════ */
check('CSS Enviar: existe y pesa (>10KB)', envCss.length > 10000, envCss.length + ' B');
check('CSS Control: existe y pesa (>10KB)', ctlCss.length > 10000, ctlCss.length + ' B');
check('CSS Enviar: TODO bajo .remenv-scope o @media/@keyframes',
  scopedCssOk(envCss, '.remenv-scope').length === 0);
check('CSS Control: TODO bajo .remctl-scope o @media/@keyframes',
  scopedCssOk(ctlCss, '.remctl-scope').length === 0);
check('CSS Enviar: modo oscuro dark y dark-legacy',
  /\[data-theme="dark"\][\s\S]*\.remenv-scope/.test(envCss) &&
  /\[data-theme="dark-legacy"\][\s\S]*\.remenv-scope/.test(envCss));
check('CSS Control: modo oscuro dark y dark-legacy',
  /\[data-theme="dark"\][\s\S]*\.remctl-scope/.test(ctlCss) &&
  /\[data-theme="dark-legacy"\][\s\S]*\.remctl-scope/.test(ctlCss));
check('CSS: sin :root global (no pisan los tokens de la app)',
  !/(^|\})\s*:root\s*\{/.test(envCss.replace(/\/\*[\s\S]*?\*\//g, '')) &&
  !/(^|\})\s*:root\s*\{/.test(ctlCss.replace(/\/\*[\s\S]*?\*\//g, '')));
check('CSS: sin nombres genéricos sueltos (btn/card/badge/toast/modal)',
  !/^\s*\.(btn|card|badge|toast|modal|overlay|chip|tab)\s*[,{]/m.test(envCss) &&
  !/^\s*\.(btn|card|badge|toast|modal|overlay|chip|tab)\s*[,{]/m.test(ctlCss));
check('CSS: llaves y comentarios balanceados',
  (envCss.match(/\{/g) || []).length === (envCss.match(/\}/g) || []).length &&
  (ctlCss.match(/\{/g) || []).length === (ctlCss.match(/\}/g) || []).length);
check('CSS: responsive para modo ventana (@media 980px)',
  /@media \(max-width: 980px\)/.test(envCss) && /@media \(max-width: 980px\)/.test(ctlCss));
check('CSS: tokens del v2 ALINEADOS a la paleta premium canónica (kair-design-tokens)',
  /--remenv-blue: #2057b8;/.test(envCss) && /--remctl-blue: #2057b8;/.test(ctlCss) &&
  /--remenv-bg: #fbfcfb;/.test(envCss) && /--remctl-bg: #fbfcfb;/.test(ctlCss) &&
  /--remenv-ink: #14213d;/.test(envCss) && /--remctl-ink: #14213d;/.test(ctlCss) &&
  /--remenv-line: #e8ebee;/.test(envCss) && /--remctl-line: #e8ebee;/.test(ctlCss) &&
  /--remenv-font: 'DM Sans'/.test(envCss) && /--remctl-font: 'DM Sans'/.test(ctlCss) &&
  /--remenv-radius: 20px;/.test(envCss) && /--remctl-radius: 20px;/.test(ctlCss) &&
  /--remenv-font-display: 'Manrope'/.test(envCss) && /--remctl-font-display: 'Manrope'/.test(ctlCss));
check('CSS: el v2 no conserva la paleta propia vieja (#2456d6 / #eef1f7 / Segoe UI)',
  !/#2456d6|#eef1f7|#e3e8f2|Segoe UI/.test(envCss.replace(/\/\*[\s\S]*?\*\//g, '')) &&
  !/#2456d6|#eef1f7|#e3e8f2|Segoe UI/.test(ctlCss.replace(/\/\*[\s\S]*?\*\//g, '')));

/* ══════════════ E. PORTAL + VISOR (📦775) ══════════════ */
check('Portal: el marcado va bajo .rm-portal-scope',
  /<div class="rm-portal-scope">/.test(portal) &&
  /\.rm-portal-scope \{/.test(portal));
check('Portal: SIN :root global (no filtra tokens a la app)',
  !/(^|\})\s*:root\s*\{/.test(portal.replace(/\/\*[\s\S]*?\*\//g, '')));
check('Portal: SIN reset * global (todos los * van bajo .rm-portal-scope)',
  !/(^|\n)\s*\*\s*\{/.test(portal.replace(/\/\*[\s\S]*?\*\//g, '')) &&
  /\.rm-portal-scope \*/.test(portal));
check('Portal: sin CDN de iconos (Font Awesome / Bootstrap Icons fuera)',
  !/font-awesome|bootstrap-icons|cdnjs\.cloudflare|cdn\.jsdelivr/.test(portal));
check('Portal: iconos en SVG inline (>= 6)',
  (portal.match(/<svg /g) || []).length >= 6);
check('Portal: modo oscuro dark y dark-legacy',
  /\[data-theme="dark"\] \.rm-portal-scope/.test(portal) &&
  /\[data-theme="dark-legacy"\] \.rm-portal-scope/.test(portal));
check('Portal: conserva los handlers del home.js',
  portal.indexOf('rmGoBackToModule()') >= 0 && portal.indexOf('rmEnterViewer()') >= 0 &&
  portal.indexOf('rmEnterSendRemisiones()') >= 0 && portal.indexOf('rmEnterControlRemisiones()') >= 0);
check('Portal: tipografía premium (Manrope/DM Sans vía --kair-font)',
  /--rmp-font: var\(--kair-font-ui/.test(portal) &&
  /--rmp-font-display: var\(--kair-font-display/.test(portal));
check('Portal: contenido centrado en pantallas anchas (.rm-portal max-width + margin auto)',
  /\.rm-portal-scope \.rm-portal \{ max-width: 1120px; margin: 0 auto; \}/.test(portal));
check('logic.js: sanitiza <link> del portal antes del innerHTML (defensa en profundidad)',
  /const htmlLimpio = html\.replace\(\/<link\[\^>\]\*>\/gi, ''\)/.test(logic) &&
  /this\.container\.innerHTML = htmlLimpio/.test(logic));
check('logic.js: cache-bust en el fetch del portal y en su script',
  /restricciones-medicas-home\.html\?v=/.test(logic) &&
  /restricciones-medicas-home\.js\?v=/.test(logic));
check('Visor: tokens premium (--kair-primary #2057b8 / bg #fbfcfb / DM Sans)',
  /--kair-primary: #2057b8;/.test(viewCss) && /--kair-bg-app: #fbfcfb;/.test(viewCss) &&
  /--kair-font: 'DM Sans'/.test(viewCss));
check('Visor: dark premium (--kair-primary #6ea8fe / bg #0f172a) en los 2 atributos',
  /\[data-theme="dark"\] \.kair-body,\s*\n\[data-theme="dark-legacy"\] \.kair-body \{[\s\S]*?--kair-primary: #6ea8fe;[\s\S]*?--kair-bg-app: #0f172a;/.test(viewCss));
check('Visor: sin colores viejos (#174ea6 / #4da6ff / 77, 166, 255)',
  !/#174ea6|#4da6ff|77, 166, 255/.test(viewCss));

/* ══════════════ F. ESTADÍSTICAS DE REMISIONES (📦779) ══════════════ */
check('index.html: carga la hoja y el componente de Estadísticas con cache-bust',
  /estadisticas-remisiones-v2\.css\?v=/.test(indexHtml) && /estadisticas-remisiones-v2\.js\?v=/.test(indexHtml));
check('Estadísticas: compila (vm.Script)',
  (function () { try { new vm.Script(statJs, { filename: 'estadisticas-remisiones-v2.js' }); return true; } catch (e) { return false; } })());
check('Estadísticas: expone window.EstadisticasRemisionesV2Component',
  /window\.EstadisticasRemisionesV2Component\s*=\s*EstadisticasRemisionesV2Component/.test(statJs));
check('Estadísticas: usa getControlRemisionesData (mismo origen que el Control)',
  /electronAPI\.getControlRemisionesData\(this\.companyName\)/.test(statJs));
check('Estadísticas: normaliza sexo/evaluación/concepto/estado civil/edad y arma los 6 gráficos',
  /#normSexo\(/.test(statJs) && /#normEval\(/.test(statJs) && /#normConcepto\(/.test(statJs) &&
  /#normCivil\(/.test(statJs) && /#rangoEdad\(/.test(statJs) &&
  /#renderBars\(/.test(statJs) && /#renderCols\(/.test(statJs) && /#renderDonut\(/.test(statJs) &&
  /#remstat-civil/.test(statJs) && !/#normEps\(/.test(statJs));
check('Estadísticas: barras como cajas HTML (sin SVG estirado)',
  /remstat-bar__fill/.test(statJs) && /remstat-col__bar/.test(statJs) && !/preserveAspectRatio/.test(statJs));
check('Estadísticas: avisos al body envueltos + destroy + vigía',
  /wrap\.className = 'remstat-scope'/.test(statJs) && /document\.body\.appendChild\(wrap\)/.test(statJs) &&
  /destroy\(\)[\s\S]*?#limpiarCapas\(\)/.test(statJs) && /!host\.isConnected \|\| !self\.raiz \|\| !self\.raiz\.isConnected/.test(statJs));
check('Estadísticas CSS: TODO bajo .remstat-scope, sin :root, sin genéricos',
  scopedCssOk(statCss, '.remstat-scope').length === 0 &&
  !/(^|\})\s*:root\s*\{/.test(statCss.replace(/\/\*[\s\S]*?\*\//g, '')) &&
  !/^\s*\.(btn|card|badge|toast|modal|overlay|chip|tab)\s*[,{]/m.test(statCss));
check('Estadísticas CSS: modo oscuro dark y dark-legacy',
  /\[data-theme="dark"\] \.remstat-scope/.test(statCss) && /\[data-theme="dark-legacy"\] \.remstat-scope/.test(statCss));
check('Estadísticas CSS: tokens alineados a la canónica (#2057b8 / #fbfcfb / DM Sans / 20px)',
  /--remstat-blue: #2057b8;/.test(statCss) && /--remstat-bg: #fbfcfb;/.test(statCss) &&
  /--remstat-font: 'DM Sans'/.test(statCss) && /--remstat-radius: 20px;/.test(statCss));
check('logic.js: showEstadisticasRemisionesPage monta el componente',
  /showEstadisticasRemisionesPage\(\)[\s\S]*?new window\.EstadisticasRemisionesV2Component\(this\.container, \{/.test(logic));
check('Portal: la card de Estadísticas llama a rmEnterEstadisticas (ya no es placeholder)',
  portal.indexOf('rmEnterEstadisticas()') >= 0 && portal.indexOf("rmPlaceholder('Estadísticas')") === -1);

/* ══════════════ Reporte ══════════════ */
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) console.log('[OK  ] ' + c.name);
  else { failed++; console.log('[FAIL] ' + c.name + (c.extra ? ' → ' + c.extra : '')); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ 3.1.6 Enviar (flujo completo en una interfaz) y Control de Remisiones en premium v2, conservando el contrato de datos');
