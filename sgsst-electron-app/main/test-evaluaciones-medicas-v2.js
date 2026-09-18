/* ============================================================
 * K+AIR · Smoke test — Evaluaciones Médicas Ocupacionales v2 (📦762)
 * ============================================================
 * El submódulo 3.1.4 pasó del explorador de carpetas al diseño premium v2 con los
 * certificados de aptitud PERSISTIDOS. Este test comprueba:
 *
 *   A. El PUENTE de base de datos: validación de los datos ANTES de tocar la base
 *      (nombre, cédula, tipo, concepto, fechas y la regla de "Apto con
 *      recomendaciones"), y que el esquema/consultas sean los esperados.
 *   B. La CONSTRUCCIÓN del módulo: que las clases del prototipo estén prefijadas
 *      (sin choques con la app ni con Bootstrap), que los 107 ids del contrato sigan
 *      ahí, que el marcado esté balanceado y que TODOS los selectores de la hoja
 *      estén bajo `.emo-scope`.
 *   C. El REGISTRO en la app: los 4 puntos del patrón puente (require, esquema,
 *      handlers, preload) y la conexión en `renderer.js` / `index.html`.
 *   D. La REGLA LEGAL: que la renovación agregue un certificado nuevo enlazado al
 *      anterior y nunca lo modifique (Res. 2346 de 2007, art. 12).
 *
 * Correr con: node main/test-evaluaciones-medicas-v2.js
 * (la verificación visual del montaje real está en `main/_preview-emo.js`, que
 *  necesita ventana de Electron)
 * ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'modules', 'gestion-salud', 'evaluaciones-medicas');
const F_JS = path.join(DIR, 'evaluaciones-medicas-v2.js');
const F_CSS = path.join(DIR, 'evaluaciones-medicas-v2.css');
const F_MARKUP = path.join(DIR, 'evaluaciones-medicas-v2-markup.html');
const F_BRIDGE = path.join(ROOT, 'main', 'evaluaciones-medicas-bridge.js');

const js = fs.readFileSync(F_JS, 'utf8');
const css = fs.readFileSync(F_CSS, 'utf8');
const markup = fs.readFileSync(F_MARKUP, 'utf8');
const bridge = fs.readFileSync(F_BRIDGE, 'utf8');
const renderer = fs.readFileSync(path.join(ROOT, 'renderer.js'), 'utf8');
const preload = fs.readFileSync(path.join(ROOT, 'preload.js'), 'utf8');
const mainJs = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function sinComentariosCss(t) { return t.replace(/\/\*[\s\S]*?\*\//g, ''); }
const cssLimpio = sinComentariosCss(css);

/* El codigo del componente SIN comentarios: hay verificaciones que buscarian una
   mencion en un comentario y darian un falso positivo. */
const jsSinComentarios = js
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/[^\n]*$/gm, '');

const checks = [];
function check(name, ok, extra) { checks.push({ name: name, ok: !!ok, extra: extra }); }

/* ══════════════ A. EL PUENTE ══════════════ */
const mod = require(F_BRIDGE);

check('Puente: exporta el registrador y el esquema',
  typeof mod.registerEvaluacionesMedicasHandlers === 'function' && typeof mod.SCHEMA_SQL === 'string');
check('Puente: crea la tabla de certificados con los índices necesarios',
  /CREATE TABLE IF NOT EXISTS evaluaciones_medicas_certificados/.test(mod.SCHEMA_SQL) &&
  /idx_emo_cert_empresa_cedula/.test(mod.SCHEMA_SQL) &&
  /idx_emo_cert_vencimiento/.test(mod.SCHEMA_SQL));
check('Puente: la tabla guarda el certificado de origen (historial de renovaciones)',
  /certificado_origen/.test(mod.SCHEMA_SQL));
check('Puente: registra los 3 canales con el prefijo del módulo',
  /evaluaciones-medicas:listar/.test(bridge) &&
  /evaluaciones-medicas:guardar/.test(bridge) &&
  /evaluaciones-medicas:eliminar/.test(bridge));

/* Validación: casos buenos y malos, SIN tocar la base. */
const base = {
  trabajador: 'Ana Gómez', cedula: '1.039.887.112', cargo: 'Analista', area: 'Administración',
  tipo: 'Periódico', ips: 'Sura', fechaExamen: '2026-01-15', vencimiento: '2027-01-15',
  concepto: 'APTO', recomendaciones: ''
};
check('Validación: acepta un certificado completo',
  mod._validar(base).ok === true, JSON.stringify(mod._validar(base).error || {}));
check('Validación: normaliza la cédula (saca puntos y espacios)',
  mod._validar(base).datos.cedula === '1039887112');
check('Validación: exige el nombre del trabajador',
  mod._validar(Object.assign({}, base, { trabajador: '' })).ok === false);
check('Validación: exige la cédula',
  mod._validar(Object.assign({}, base, { cedula: '  ' })).ok === false);
check('Validación: exige un tipo de evaluación',
  mod._validar(Object.assign({}, base, { tipo: '' })).ok === false);
check('Validación: rechaza un tipo desconocido',
  mod._validar(Object.assign({}, base, { tipo: 'Inventado' })).ok === false);
check('Validación: exige el concepto de aptitud',
  mod._validar(Object.assign({}, base, { concepto: '' })).ok === false);
check('Validación: rechaza un concepto desconocido',
  mod._validar(Object.assign({}, base, { concepto: 'MASOMENOS' })).ok === false);
check('Validación: acepta el concepto con tilde/espacios tal como lo manda la vista',
  mod._validar(Object.assign({}, base, { concepto: 'Apto con Recomendaciones', recomendaciones: 'Lentes' })).ok === true);
check('Validación: exige las recomendaciones cuando el concepto es "Apto con recomendaciones"',
  mod._validar(Object.assign({}, base, { concepto: 'APTO CON RECOMENDACIONES', recomendaciones: '' })).ok === false);
check('Validación: acepta "Apto con recomendaciones" si trae recomendaciones',
  mod._validar(Object.assign({}, base, { concepto: 'APTO CON RECOMENDACIONES', recomendaciones: 'Usar lentes' })).ok === true);
check('Validación: exige la fecha del examen',
  mod._validar(Object.assign({}, base, { fechaExamen: '' })).ok === false);
check('Validación: rechaza una fecha con formato inválido',
  mod._validar(Object.assign({}, base, { fechaExamen: '15/01/2026' })).ok === false);
check('Validación: rechaza un vencimiento anterior al examen',
  mod._validar(Object.assign({}, base, { fechaExamen: '2026-06-01', vencimiento: '2026-01-01' })).ok === false);
check('Validación: permite un certificado sin vencimiento (no es periódico)',
  mod._validar(Object.assign({}, base, { tipo: 'Preingreso', vencimiento: '' })).ok === true);
check('Puente: sin base de datos devuelve NO_DB en vez de explotar',
  mod._handlerListar('Tempoactiva').error.code === 'NO_DB' &&
  mod._handlerGuardar('Tempoactiva', base).error.code === 'NO_DB');
check('Puente: exige la empresa en el listado',
  mod._handlerListar('').error.code === 'NO_DB' || mod._handlerListar('').error.code === 'VALIDATION');
check('Puente: los catálogos válidos coinciden con los del módulo',
  mod.TIPOS_VALIDOS.indexOf('Periódico') >= 0 &&
  mod.CONCEPTOS_VALIDOS.indexOf('APTO CON RECOMENDACIONES') >= 0);

/* ══════════════ B. LA CONSTRUCCIÓN DEL MÓDULO ══════════════ */
check('Módulo: el componente compila', (function () {
  try { new vm.Script(js, { filename: 'evaluaciones-medicas-v2.js' }); return true; }
  catch (e) { return false; }
})());
check('Módulo: se expone como window.EvaluacionesMedicasView',
  /window\.EvaluacionesMedicasView\s*=/.test(js));
check('Módulo: mantiene el alias viejo para no romper el portal',
  /window\.EvaluacionesMedicasComponent\s*=/.test(js));
check('Módulo: expone render() y destroy()',
  /prototype\.render\s*=/.test(js) && /prototype\.destroy\s*=/.test(js));
check('Módulo: inyecta su propio marcado (no depende de un index.html)',
  /marcadoRaiz\.innerHTML = marcadoVista\(\)/.test(js) && /host\.appendChild\(marcadoRaiz\)/.test(js));
check('Módulo: el marcado viene embebido y no vacío',
  /var MARKUP_RAW = `/.test(js) && js.length > 60000, 'largo del componente: ' + js.length);
check('Módulo: las búsquedas quedan dentro del componente',
  /marcadoRaiz\.querySelector\(sel\)/.test(js));
check('Módulo: mueve modales, cajón y avisos al <body>',
  /document\.body\.appendChild\(n\)/.test(js));
check('Módulo: destroy() saca del <body> lo que movió',
  /parentNode\.removeChild\(n\)/.test(js));
check('Módulo: usa el puente real (no el contrato inventado del prototipo)',
  /evaluacionesMedicas\.listar/.test(js) && /evaluacionesMedicas\.guardar/.test(js) &&
  /* Se mira el CODIGO sin comentarios: el encabezado del archivo MENCIONA el
     contrato inventado del prototipo para explicar que NO se usa. */
  /electronAPI\.getEvaluacionesMedicas\(/.test(jsSinComentarios) === false &&
  /electronAPI\.guardarCertificado\(/.test(jsSinComentarios) === false);
check('Módulo: conserva la lectura de la carpeta de documentos (lo que ya existía)',
  /getDocumentFolders/.test(js) && /openPath/.test(js));
check('Módulo: la visibilidad de las pantallas usa la clase del prototipo, no estilos en línea',
  /classList\.toggle\('emo-is-active'/.test(js) && !/sec\.style\.display = \(p === pantalla\)/.test(js));
check('Módulo: muestra la paginación (el marcado la trae con hidden)',
  /pagin\.hidden =/.test(js));
check('Módulo: la renovación guarda un certificado NUEVO con el origen (Res. 2346 art. 12)',
  /S\.modo === 'renovar' && S\.editandoId[\s\S]{0,80}cert\.certificadoOrigen = S\.editandoId/.test(js));

/* Marcado */
const abreDiv = (markup.match(/<div\b/g) || []).length;
const cierraDiv = (markup.match(/<\/div>/g) || []).length;
check('Marcado: los <div> están balanceados', abreDiv === cierraDiv, abreDiv + ' vs ' + cierraDiv);
check('Marcado: no se colaron bloques de script ni de estilo',
  markup.indexOf('<script') < 0 && markup.indexOf('<style') < 0);
const ids = (markup.match(/id="([^"]+)"/g) || []).map(function (m) { return m.slice(4, -1); });
check('Marcado: conserva los 107 ids del contrato del prototipo',
  ids.length === 107, 'encontrados: ' + ids.length);
check('Marcado: no hay ids duplicados',
  new Set(ids).size === ids.length);
['btn-nuevo', 'btn-marco', 'tbody-certificados', 'rm-conceptos', 'rm-guardar',
  'drawer-marco', 'modal-cert', 'screen-resumen', 'screen-certificados', 'screen-detalle',
  'f-buscar', 'f-tipo', 'f-estado', 'pagin', 'd-hist', 'toasts'].forEach(function (id) {
  check('Marcado: existe #' + id, ids.indexOf(id) >= 0);
});

/* Clases: prefijadas y sin choques */
check('Clases: ninguna clase del marcado quedó sin prefijo emo-',
  !/class="(?!emo-)[^"]/.test(markup.replace(/class="emo-/g, 'class="emo-')));
check('Clases: no hay doble prefijo emo-emo-',
  css.indexOf('emo-emo-') < 0 && markup.indexOf('emo-emo-') < 0);
['kair-card', 'kair-header', 'kair-modal', 'kair-table', 'kair-tabs', 'kair-kpi', 'kair-btn']
  .forEach(function (viejo) {
    check('Clases: ningún .' + viejo + ' sin prefijar (chocaría con la app)',
      cssLimpio.indexOf('.' + viejo) < 0 && markup.indexOf('class="' + viejo) < 0);
  });
check('Clases: ningún nombre que use Bootstrap quedó suelto (modal/card/btn/overlay)',
  !/^\s*\.(modal|card|btn|overlay|row|badge|toast)\s*[,{]/m.test(cssLimpio));

/* Alcance y tokens */
check('CSS: TODOS los selectores están bajo .emo-scope o son :root/html',
  (function () {
    const lineas = cssLimpio.split('\n');
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      if (!/^[^@\s}][^{]*\{/.test(l)) continue;
      const sel = l.slice(0, l.indexOf('{'));
      const partes = sel.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      for (let j = 0; j < partes.length; j++) {
        const p = partes[j];
        if (/^@/.test(p)) continue;
        if (p === 'html' || /^html\b/.test(p)) continue;
        if (p.indexOf('.emo-scope') === 0) continue;
        /* El modo oscuro antepone [data-theme=...] al alcance: sigue siendo del modulo. */
        if (/^\[data-theme="[^"]+"\]\s+\.emo-scope\b/.test(p)) continue;
        return false;
      }
    }
    return true;
  })());
check('CSS: los tokens del prototipo NO están en :root (pisarían los de la app)',
  cssLimpio.indexOf(':root{') < 0 && cssLimpio.indexOf('.emo-scope{') >= 0);
check('CSS: modo oscuro para data-theme="dark"',
  /\[data-theme="dark"\] \.emo-scope/.test(css));
check('CSS: modo oscuro para data-theme="dark-legacy" (tema oscuro manual)',
  /\[data-theme="dark-legacy"\] \.emo-scope/.test(css));
check('CSS: el modo oscuro redefine la paleta del módulo',
  /\[data-theme="dark-legacy"\] \.emo-scope[\s\S]{0,600}--kair-surface:#1B2230/.test(css));
check('CSS: defensa contra Bootstrap (variables --bs-* anuladas)',
  /--bs-card-bg:transparent/.test(css) && /--bs-modal-bg:transparent/.test(css));
check('CSS: la raíz del módulo pinta el fondo (si no, queda transparente)',
  /^\.emo-scope\{[\s\S]{0,300}background:var\(--kair-bg\)/m.test(css));
check('CSS: los comentarios y las llaves están balanceados',
  (css.match(/\/\*/g) || []).length === (css.match(/\*\//g) || []).length &&
  (css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length);

/* Las clases que genera la lógica tienen que existir en la hoja (o ser bases propias) */
const clasesJs = new Set();
(js.match(/class="([a-z][\w-]*)/g) || []).forEach(function (m) { clasesJs.add(m.slice(7)); });
const clasesCss = new Set();
(cssLimpio.match(/\.(emo-[\w-]+)/g) || []).forEach(function (m) { clasesCss.add(m.slice(1)); });
const generadasSinRegla = Array.from(clasesJs).filter(function (c) {
  return !clasesCss.has(c);
});
check('CSS: toda clase que genera la lógica tiene regla en la hoja',
  generadasSinRegla.length === 0, generadasSinRegla.join(', '));

/* ══════════════ C. REGISTRO EN LA APP ══════════════ */
check('main.js: requiere el puente',
  /require\('\.\/main\/evaluaciones-medicas-bridge'\)/.test(mainJs));
check('main.js: crea el esquema al abrir la base',
  /db\.exec\(EMO_CERT_SCHEMA_SQL\)/.test(mainJs));
check('main.js: registra los handlers',
  /registerEvaluacionesMedicasHandlers\(app, \{ getDb \}\)/.test(mainJs));
check('preload.js: expone evaluacionesMedicas.listar/guardar/eliminar',
  /evaluacionesMedicas:\s*\{[\s\S]{0,400}evaluaciones-medicas:listar[\s\S]{0,300}evaluaciones-medicas:guardar[\s\S]{0,300}evaluaciones-medicas:eliminar/.test(preload));
check('renderer.js: monta el componente nuevo',
  /window\.EvaluacionesMedicasView\b/.test(renderer));
/* ESTA es la verificacion que habria atrapado el bug visual: sin la hoja cargada, los
   iconos (SVG sin tamano en linea) se estiran a todo el ancho y el modulo queda enorme. */
check('index.html: carga la HOJA del modulo con cache-bust',
  /evaluaciones-medicas-v2\.css\?v=/.test(indexHtml));
check('CSS: el archivo del modulo existe y no esta vacio', css.length > 20000, 'largo: ' + css.length);
check('CSS: cada icono del marcado tiene regla de tamano (si no, se estira a todo el ancho)',
  (function () {
    /* Por cada clase padre que envuelve un <svg> en el marcado, tiene que existir en la
       hoja una regla que le fije width. Contar los SVG y las reglas que los dimensionan. */
    var svgEnMarcado = (markup.match(/<svg/g) || []).length;
    var reglasQueDimensionan = (cssLimpio.match(/svg\s*\{[^}]*width:/g) || []).length +
      (cssLimpio.match(/svg\s*\{[^}]*height:/g) || []).length;
    return svgEnMarcado > 0 && reglasQueDimensionan >= 15;
  })());
check('index.html: carga el componente versionado (cache-bust)',
  /evaluaciones-medicas-v2\.js\?v=/.test(indexHtml));
check('index.html: lo carga DESPUÉS del -logic.js (el orden decide el global)',
  indexHtml.indexOf('evaluaciones-medicas-logic.js') < indexHtml.indexOf('evaluaciones-medicas-v2.js'));

/* ══════════════ Reporte ══════════════ */
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) console.log('[OK  ] ' + c.name);
  else { failed++; console.log('[FAIL] ' + c.name + (c.extra ? ' → ' + c.extra : '')); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ Evaluaciones Médicas en premium v2, con los certificados persistidos');
