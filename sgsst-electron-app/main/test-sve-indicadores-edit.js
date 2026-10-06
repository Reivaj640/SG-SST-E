// test-sve-indicadores-edit.js
// 📦830 — Edición completa de los indicadores del programa SVE/COVID: los
// valores por año, los años de la serie, la meta y la definición (nombre,
// meta corta, periodicidad, formulación, umbral) se editan desde un botón
// "Editar" por tarjeta (mismo patrón que "Análisis por periodos"), y lo
// editado se persiste en la columna nueva `extra_json`.
//
// Tests ESTATICOS a proposito (leen el fuente, no lo ejecutan), como
// test-medprev-3-1-2.js. Cubren la cadena completa de la feature:
//
//   1. Schema: `extra_json` existe en las TRES partes donde tiene que estar
//      (CREATE de BD nueva, ALTER idempotente para BD viejas, y la
//      reconstrucción de la migración v2) — la trampa clasica de
//      "CREATE TABLE IF NOT EXISTS no altera tablas existentes".
//   2. Bridge: los adaptadores _extraDe/_extraHacia y que TANTO el guardar
//      como el seed escriban la columna (si el seed no la escribe, el dato
//      se pierde en cada re-siembra).
//   3. Store: updateIndicador(clave, patch) mergea y persiste.
//   4. Seed: los 4 indicadores traen metaCorta/umbral (y ausentismo en null,
//      que es lo que mantiene su semáforo en verde).
//   5. Vista: helpers del semáforo (defaults retrocompatibles con BD vieja),
//      el botón Editar en AMBAS ramas de la tarjeta, el editor con sus
//      validaciones (años, umbral) y la reapertura conservando lo escrito.
//   6. Cache-bust: MEDPREV_V del logic coincide con el ?v= de index.html
//      (sin esto, los cambios no se ven hasta limpiar la caché).
//   8. UI/UX del editor (📦831): el fix de U.el (camelCase → kebab-case, la
//      causa raíz de los estilos descartados en silencio), las secciones, la
//      rejilla de 2 columnas en CSS, los errores inline por campo con foco al
//      primero, y la serie anual en rejilla con scroll horizontal.
//
// Uso: node main/test-sve-indicadores-edit.js

'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SCHEMA = path.join(RAIZ, 'main', 'medprev-sve-datos-schema-sql.js');
const BRIDGE = path.join(RAIZ, 'main', 'medprev-sve-datos-bridge.js');
const SVE_DIR = path.join(RAIZ, 'modules', 'gestion-salud', 'medicina-preventiva', 'sve');
const APP = path.join(SVE_DIR, 'sve-app.js');
const SEED = path.join(SVE_DIR, 'sve-seed.js');
const VIEWS = path.join(SVE_DIR, 'sve-views.js');
const LOGIC = path.join(RAIZ, 'modules', 'gestion-salud', 'medicina-preventiva', 'medicina-preventiva-logic.js');
const INDEX = path.join(RAIZ, 'index.html');

function leer(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; }
}

const schemaSrc = leer(SCHEMA);
const bridgeSrc = leer(BRIDGE);
const appSrc = leer(APP);
const seedSrc = leer(SEED);
const viewsSrc = leer(VIEWS);
const logicSrc = leer(LOGIC);
const indexSrc = leer(INDEX);

// Sección de la vista de Indicadores (mismo corte que test-medprev-3-1-2 8l:
// el split es literal y hay que preservarlo).
const indSrc = (viewsSrc.split('V.Indicadores = ')[1] || '');
const dashSrc = (viewsSrc.split('V.Dashboard = ')[1] || '');

const checks = [];
function ok(name, cond, extra) { checks.push({ name: name, ok: !!cond, extra: extra }); }

/* ============ 1) SCHEMA: extra_json en las 3 partes ============ */
ok('1) el CREATE TABLE de BD nueva trae extra_json',
  /CREATE TABLE IF NOT EXISTS mp_sve_indicadores \([\s\S]*?extra_json\s+TEXT/.test(schemaSrc) ||
  /extra_json\s+TEXT/.test(schemaSrc.split('mp_sve_indicadores_v2')[0]));
ok('1) las migraciones declaran el ALTER idempotente de extra_json',
  /ALTER TABLE mp_sve_indicadores ADD COLUMN extra_json TEXT/.test(schemaSrc));
ok('1) la migración de reconstrucción (v2) crea la columna extra_json',
  /CREATE TABLE IF NOT EXISTS mp_sve_indicadores_v2 \([\s\S]*?extra_json TEXT/.test(schemaSrc));
ok('1) el INSERT de la migración v2 NO incluye extra_json (queda NULL, no rompe)',
  /INSERT OR IGNORE INTO mp_sve_indicadores_v2\s*\(([^)]*)\)/.test(schemaSrc) &&
  !/INSERT OR IGNORE INTO mp_sve_indicadores_v2\s*\([^)]*extra_json/.test(schemaSrc));

/* ============ 2) BRIDGE: adaptadores + INSERT ============ */
ok('2) existe _extraDe (objeto → JSON de extra_json)',
  /function _extraDe\(ind\)/.test(bridgeSrc) && /metaCorta = ind\.metaCorta/.test(bridgeSrc));
ok('2) existe _extraHacia (fila → objeto, con try/catch sobre el JSON)',
  /function _extraHacia\(fila\)/.test(bridgeSrc) &&
  /JSON\.parse\(\(fila && fila\.extra_json\) \|\| '\{\}'\)/.test(bridgeSrc));
ok('2) _leerIndicadores mezcla los extras sobre el indicador leído',
  /var extra = _extraHacia\(d\)/.test(bridgeSrc) &&
  /extra\.metaCorta !== undefined/.test(bridgeSrc) &&
  /extra\.umbral !== undefined/.test(bridgeSrc));
const insertsConExtra = (bridgeSrc.match(/INSERT INTO mp_sve_indicadores \([^)]*extra_json[^)]*\)/g) || []).length;
ok('2) AMBOS INSERT (guardar y seed) escriben extra_json', insertsConExtra === 2, insertsConExtra + ' INSERTs');
ok('2) los dos INSERT pasan _extraDe(ind) en los valores',
  (bridgeSrc.match(/JSON\.stringify\(_medidasDe\(ind\)\), _extraDe\(ind\)/g) || []).length === 2);

/* ============ 3) STORE: updateIndicador ============ */
ok('3) el store expone updateIndicador(clave, patch)',
  /updateIndicador: function \(clave, patch\)/.test(appSrc));
ok('3) updateIndicador MERGEA el patch sobre el indicador (no lo pisa entero)',
  /state\.indicadores\[clave\] = Object\.assign\(\{\}, state\.indicadores\[clave\], patch \|\| \{\}\)/.test(appSrc));
ok('3) updateIndicador persiste por la capa de persistencia en modo sqlite',
  /SvePersistencia\.indicadoresGuardar\(state\.indicadores\)/.test(appSrc));
ok('3) en modo local (sin base) updateIndicador cae a _guardarLocal',
  /if \(modo !== 'sqlite'\) \{ _guardarLocal\(\); return; \}/.test(appSrc));

/* ============ 4) SEED: extras de los 4 indicadores ============ */
ok('4) prevalencia trae metaCorta y umbral 0.1',
  /metaCorta: "< 10%",\s*\n\s*umbral: 0\.1/.test(seedSrc));
ok('4) ausentismo trae metaCorta y umbral null (semáforo siempre verde)',
  /metaCorta: "disminuir 10%",[\s\S]{0,400}?umbral: null/.test(seedSrc));
ok('4) eficacia trae metaCorta y umbral 0.7',
  /metaCorta: "≥ 70%",\s*\n\s*umbral: 0\.7/.test(seedSrc));
ok('4) el seed declara exactamente 4 metaCorta y 4 umbral',
  (seedSrc.match(/metaCorta:/g) || []).length === 4 &&
  (seedSrc.match(/^\s*umbral:/gm) || []).length === 4,
  (seedSrc.match(/metaCorta:/g) || []).length + '/' + (seedSrc.match(/^\s*umbral:/gm) || []).length);

/* ============ 5) VISTA: helpers, botón y editor ============ */
// --- helpers / defaults retrocompatibles
ok('5) existen IND_MEDIDAS_TXT (etiquetas de medida para el formulario)',
  /var IND_MEDIDAS_TXT = \{/.test(viewsSrc) && /diasIncapacidad: "Días de ausencia \(incapacidad\)"|Días de ausencia/.test(viewsSrc));
ok('5) existen IND_META_CORTA_DEF con las 4 claves',
  /var IND_META_CORTA_DEF = \{[^}]*prevalencia:[^}]*incidencia:[^}]*ausentismo:[^}]*eficacia:/.test(viewsSrc));
ok('5) existe IND_UMBRAL_DEF (BD vieja sin extra_json conserva los umbrales)',
  /var IND_UMBRAL_DEF = \{ prevalencia: 0\.1, incidencia: 0\.1, ausentismo: null, eficacia: 0\.7 \}/.test(viewsSrc));
ok('5) _umbralDe cae al default cuando el valor viene vacío',
  /function _umbralDe\(o, clave\)/.test(viewsSrc) && /return IND_UMBRAL_DEF\[clave\]/.test(viewsSrc));
ok('5) sin umbral (null/undefined) el semáforo queda VERDE',
  /function _bienMenor\(x, val\) \{ return \(x\.umbral === null \|\| x\.umbral === undefined\) \? true : val < x\.umbral; \}/.test(viewsSrc) &&
  /function _bienMayor\(x, val\) \{ return \(x\.umbral === null \|\| x\.umbral === undefined\) \? true : val >= x\.umbral; \}/.test(viewsSrc));

// --- botón Editar por tarjeta
ok('5) existe editBtn(clave) que abre editIndicador',
  /function editBtn\(clave\)/.test(viewsSrc) && /onClick: function \(\) \{ editIndicador\(clave\); \}/.test(viewsSrc));
ok('5) headDerecha arma el head con la pill de periodicidad Y el botón',
  /function headDerecha\(cfg\)/.test(viewsSrc) && /editBtn\(cfg\.clave\)/.test(viewsSrc));
ok('5) AMBAS ramas de indCard (con y sin serie) usan headDerecha',
  // (la declaración `function headDerecha(cfg)` también matchea: se resta)
  (indSrc.match(/headDerecha\(cfg\)/g) || []).length -
  (indSrc.match(/function headDerecha\(cfg\)/g) || []).length === 2,
  (indSrc.match(/headDerecha\(cfg\)/g) || []).length + ' menciones');
ok('5) las 4 tarjetas declaran su clave',
  ['prevalencia', 'incidencia', 'ausentismo', 'eficacia'].every(function (k) {
    return new RegExp('clave: "' + k + '"').test(indSrc);
  }));
ok('5) las 4 tarjetas muestran la meta desde los datos (metaCorta), no un texto fijo',
  (indSrc.match(/meta: [a-z]+\.metaCorta/g) || []).length === 4,
  (indSrc.match(/meta: [a-z]+\.metaCorta/g) || []).length + ' tarjetas');
ok('5) el semáforo de las tarjetas usa _bienMenor/_bienMayor con el umbral del dato',
  (indSrc.match(/good: function \(i\) \{ return _bien(Menor|Mayor)\(/g) || []).length === 4);
ok('5) la tarjeta de ausentismo NO tiene el semáforo hardcodeado en verde',
  !/good: function \(i\) \{ return true; \}/.test(indSrc));

// --- editor
ok('5) existe editIndicador(clave, preset, errs) dentro de la vista de Indicadores',
  /function editIndicador\(clave, preset, errs\)/.test(indSrc));
ok('5) el editor valida que cada año tenga 4 cifras',
  /\/\\\^\\d\{4\}\\\$\/\.test\(t\)/.test(indSrc) || /\/\^\\d\{4\}\$\/\.test\(t\)/.test(indSrc));
ok('5) el editor valida años repetidos',
  /está repetido/.test(indSrc));
ok('5) el editor valida que el umbral esté entre 0 y 1',
  /el umbral debe estar entre 0 y 1/.test(indSrc));
ok('5) si la validación falla REABRE el formulario conservando lo escrito y con errs',
  /editIndicador\(clave, capturar\(\), errs\)/.test(indSrc));
ok('5) el editor cierra guardando por el store (updateIndicador + refresh)',
  /global\.SveStore\.updateIndicador\(clave, patch\)/.test(indSrc) &&
  /global\.SveApp\.refresh\(\)/.test(indSrc));
ok('5) la serie anual se puede crecer (+ Agregar año) y achicar (Quitar año)',
  /Agregar año/.test(indSrc) && /function quitarAnio\(i\)/.test(indSrc) && /function agregarAnio\(\)/.test(indSrc));
ok('5) el editor repinta la serie con U.refreshIcons() (los iconos lucide son dinámicos)',
  /U\.refreshIcons\(\)/.test(indSrc));
ok('5) ausentismo NO ofrece campo de umbral (semáforo fijo en verde)',
  /var conUmbral = clave !== "ausentismo"/.test(indSrc));
ok('5) periodicidad ofrece los 4 valores del catálogo',
  /var IND_PERIODICIDADES = \["ANUAL", "TRIMESTRAL", "SEMESTRAL", "CUATRIMESTRAL"\]/.test(indSrc));
ok('5) los números aceptan coma decimal (locale es_CO)', /_num\(v\)/.test(indSrc) && /replace\(",", "\."\)/.test(indSrc));

/* ============ 6) DASHBOARD y tabla alineados a la serie editable ============ */
ok('6) el índice del dashboard es el ÚLTIMO año (sin clamp a la posición 4)',
  /var anioInd = ind\.prevalencia\.anios\.length \? ind\.prevalencia\.anios\.length - 1 : -1;/.test(dashSrc) &&
  !/Math\.min\(4, ind\.prevalencia\.anios\.length - 1\)/.test(dashSrc));
ok('6) el dashboard muestra la meta desde metaCorta de cada indicador',
  (dashSrc.match(/metaCorta/g) || []).length >= 4);
ok('6) el dashboard pinta el semáforo con _bienMenor/_bienMayor',
  /_bienMenor\(ind\.prevalencia/.test(dashSrc) && /_bienMayor\(ind\.eficacia/.test(dashSrc));
ok('6) yearTable arma las filas por COLUMNA de año (serie desalineada no rompe)',
  /la fila se arma por COLUMNA \(año\)/.test(indSrc) &&
  /cfg\.anios\.forEach\(function \(y, i\) \{\s*\n\s*var v = Array\.isArray\(r\.vals\) \? r\.vals\[i\] : undefined;/.test(indSrc));
ok('6) la celda vacía se muestra como "—" y no como "undefined"',
  /\(v === null \|\| v === undefined\) \? "—"/.test(indSrc));
ok('6) el normalizador padea TODA medida al largo de la lista de años',
  /var arr = Array\.isArray\(o\[m\]\) \? o\[m\]\.slice\(\) : \[\];/.test(viewsSrc) &&
  /while \(arr\.length < salida\.anios\.length\) arr\.push\(null\);/.test(viewsSrc));

/* ============ 7) CACHE-BUST ============ */
const mLogic = logicSrc.match(/var MEDPREV_V = '([^']+)'/);
const mIndex = indexSrc.match(/medicina-preventiva-logic\.js\?v=([^"']+)/);
ok('7) MEDPREV_V existe en el logic', !!mLogic, mLogic ? mLogic[1] : 'NO');
ok('7) el ?v= del <script> en index.html coincide con MEDPREV_V',
  !!mLogic && !!mIndex && mLogic[1] === mIndex[1],
  mLogic && mIndex ? [mLogic[1], mIndex[1]] : 'faltante');

/* ============ 8) UI/UX del editor (📦831) ============ */
const coreSrc = leer(path.join(SVE_DIR, 'sve-core.js'));
const cssSrc = leer(path.join(SVE_DIR, 'sve.css'));

// --- causa raíz: U.el setProperty exige nombre CSS en kebab-case
ok('8) U.el convierte camelCase → kebab-case antes de setProperty',
  /p\.replace\(\/\[A-Z\]\/g, function \(m\) \{ return "-" \+ m\.toLowerCase\(\); \}\)/.test(coreSrc));
ok('8) el fix de U.el vive en el manejo de style (no en otro lado suelto)',
  /k === "style" && typeof v === "object"[\s\S]{0,700}setProperty\(p\.replace\(\/\[A-Z\]\/g/.test(coreSrc));

// --- secciones visuales + rejilla de 2 columnas real (CSS, no inline roto)
ok('8) el editor usa secciones (sve-edit-sec) con título y acción',
  /function seccion\(titulo, ayuda, accion\)/.test(indSrc) &&
  /seccion\("Definición del indicador"/.test(indSrc) &&
  /seccion\("Serie anual \(valores por año\)", "Años y cifras de cada medida\.", btnAnio\)/.test(indSrc));
ok('8) el editor arma los pares de campos con grid2 (clase CSS)',
  /function grid2\(a, b\)/.test(indSrc) && (indSrc.match(/grid2\(/g) || []).length >= 3,
  (indSrc.match(/grid2\(/g) || []).length + ' menciones');
ok('8) el CSS define .sve-edit-grid2 con 2 columnas',
  /\.sve-edit-grid2 \{[^}]*grid-template-columns: 1fr 1fr/.test(cssSrc));
ok('8) el CSS define el resto de las clases nuevas del editor',
  ['.sve-edit-sec {', '.sve-edit-sec__t', '.sve-edit-fields', '.sve-field__hint', '.sve-edit-alert']
    .every(function (s) { return cssSrc.indexOf(s) >= 0; }));

// --- errores inline por campo + banner de serie + foco al primer inválido
ok('8) el error del nombre se marca en el campo (err: errs.nombre + has-err)',
  /err: errs\.nombre/.test(indSrc) && /f\.classList\.add\("has-err"\)/.test(indSrc));
ok('8) el error del umbral se marca en su campo con texto de ayuda',
  /err: errs\.umbral/.test(indSrc) && /Vacío = sin umbral/.test(indSrc));
ok('8) los errores de años salen como banner sve-edit-alert',
  /className: "sve-edit-alert", textContent: errs\.serie/.test(indSrc) &&
  /var errAnio = errs\.anios && errs\.anios\[i\]/.test(indSrc) &&
  /errAnio \? " is-err" : ""/.test(indSrc));
ok('8) al reabrir con errores el foco va al primer campo inválido',
  /var alvo = null;/.test(indSrc) && /alvo\.focus\(\)/.test(indSrc) &&
  /inpAnios\[parseInt\(ks\[0\], 10\)\]/.test(indSrc));
ok('8) guardar() acumula errs por campo (nombre/anios/umbral/serie)',
  /var errs = \{ anios: \{\} \};/.test(indSrc) &&
  /errs\.anios\[i\] = "Debe tener 4 cifras/.test(indSrc) &&
  /errs\.umbral = "Debe estar entre 0 y 1/.test(indSrc) &&
  /errs\.serie = "Agrega al menos un año/.test(indSrc));

// --- serie anual: rejilla con plantilla compartida (cabecera = filas)
ok('8) las filas de la serie usan la MISMA plantilla de columnas (grid compartido)',
  /className: "sve-serie__row", style: \{ "grid-template-columns": cols \}/.test(indSrc) &&
  /var cols = "220px repeat\(" \+ n \+ ", minmax\(92px, 1fr\)\)"/.test(indSrc));
ok('8) la serie vive en un contenedor con scroll horizontal y ancho mínimo',
  /\.sve-serie \{ overflow-x: auto/.test(cssSrc) &&
  /className: "sve-serie__in", style: \{ minWidth:/.test(indSrc));
ok('8) los labels de la serie quedan sticky a la izquierda',
  /\.sve-serie__lbl \{[^}]*position: sticky; left: 0/.test(cssSrc));
ok('8) "Agregar año" está en la cabecera de la sección, no en la fila de años',
  /var btnAnio = el\("button"[\s\S]{0,200}" Agregar año"/.test(indSrc) &&
  !/filaAnio\.appendChild\(el\("div", \{ style: estiloCelda \}, \[\s*\n\s*el\("button", \{ className: "sve-btn sve-btn--sm sve-btn--soft", onClick: agregarAnio/.test(indSrc) &&
  !/estiloFila/.test(indSrc));
ok('8) los inputs de serie/valores traen inputmode y el de año maxLength 4',
  /maxLength: 4, inputMode: "numeric"/.test(indSrc) &&
  /inputMode: "decimal"/.test(indSrc));
ok('8) el estado de error del año se pinta con la clase .is-err (CSS propio)',
  /sve-serie__inp" \+ \(errAnio \? " is-err" : ""\)/.test(indSrc) &&
  /\.sve-input\.is-err \{ border-color: var\(--sve-danger\)/.test(cssSrc));

// --- 📦831 pulido visual de la serie (columna de etiquetas, cabecera, × y scroll)
ok('8) la columna de etiquetas mide 220px y el ancho mínimo la respeta',
  /var cols = "220px repeat\(" \+ n \+ ", minmax\(92px, 1fr\)\)"/.test(indSrc) &&
  /minWidth: \(220 \+ n \* 98\)/.test(indSrc));
ok('8) la fila de años es cabecera (--head) con tinte y línea propios en CSS',
  /filaAnio\.classList\.add\("sve-serie__row--head"\)/.test(indSrc) &&
  /\.sve-serie__row--head \{[^}]*border-bottom: 2px solid/.test(cssSrc) &&
  /\.sve-serie__row--head \.sve-serie__lbl \{[^}]*background: var\(--sve-surface-2\)/.test(cssSrc));
ok('8) el × de quitar año va absoluto para no desalinear la columna de años',
  /className: "sve-serie__cell sve-serie__cell--anio"/.test(indSrc) &&
  /sve-serie__del/.test(indSrc) &&
  /\.sve-serie__del \{[^}]*position: absolute/.test(cssSrc) &&
  /\.sve-serie__cell--anio \.sve-serie__inp \{ padding-right: 28px/.test(cssSrc) &&
  !/style: \{ padding: "4px 6px" \}, onClick: function \(\) \{ quitarAnio/.test(indSrc));
ok('8) los cajones vacíos muestran placeholder y los labels llevan el texto completo (title)',
  indSrc.indexOf('placeholder: "\u2014"') >= 0 &&
  /placeholder: "AAAA"/.test(indSrc) &&
  /textContent: txtM, title: txtM/.test(indSrc));
ok('8) la barra de scroll horizontal es fina y con tokens del módulo',
  /\.sve-serie::-webkit-scrollbar \{ height: 9px/.test(cssSrc) &&
  /\.sve-serie::-webkit-scrollbar-thumb \{[^}]*rgba\(23, 78, 166/.test(cssSrc));
ok('8) los inputs de la serie traen nombre accesible (aria-label)',
  /"aria-label": "Año " \+ \(i \+ 1\)/.test(indSrc) &&
  /"aria-label": txtM \+ \(y \? " · año " \+ y/.test(indSrc));

/* ============ Reporte ============ */
let failed = 0;
console.log('\n=======================================');
checks.forEach(function (c, i) {
  if (!c.ok) failed++;
  console.log((c.ok ? 'OK   ' : 'FAIL ') + (i + 1) + ') ' + c.name +
    (c.extra !== undefined && !c.ok ? '  [' + c.extra + ']' : ''));
});
console.log('---------------------------------------');
console.log((checks.length - failed) + '/' + checks.length + ' OK');
console.log('=======================================\n');
process.exit(failed === 0 ? 0 : 1);
