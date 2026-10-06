// test-sve-analisis-agregar.js
// 📦833 — Alta de análisis por periodos: antes solo se podían EDITAR los
// análisis existentes (botón "Editar" por periodo); ahora la tarjeta
// "Análisis de indicadores por periodos" tiene un botón "Nuevo período" que
// abre el formulario, valida y agrega un periodo a la lista.
//
// Tests ESTATICOS a proposito (leen el fuente, no lo ejecutan), como
// test-sve-indicadores-edit.js. Cubren la cadena completa de la feature:
//   1. Vista: botón "Nuevo período" en el head de la tarjeta, función
//      nuevoAnalisis con validación de periodo (vacío y duplicado) y la
//      reapertura del formulario conservando lo escrito (U.confirm cierra
//      ANTES de onOk, así que sin reapertura el dato inválido se pierde).
//   2. Vista: estado vacío de la tarjeta cuando no hay análisis (con el
//      botón siempre visible para poder crear el primero).
//   3. Store: addAnalisis empuja con los 4 campos del contrato, persiste el
//      arreglo COMPLETO (mismo guardado de reemplazo total que updateAnalisis)
//      y RETIRA el elemento si la base falla (rollback + recarga).
//   4. Cadena de persistencia intacta: persistencia → preload → bridge con
//      DELETE + reinserta por índice (`orden`), que es lo que permite que el
//      arreglo nuevo viaje entero.
//   5. Seed: el contrato de 4 campos de cada análisis sigue vigente.
//   6. Cache-bust: MEDPREV_V subió a la variante vigente (paleta-azul) en
//      logic.js y coincide con index.html (sin esto, el botón nuevo no se ve
//      hasta limpiar la caché).
//
// Uso: node main/test-sve-analisis-agregar.js

'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SVE_DIR = path.join(RAIZ, 'modules', 'gestion-salud', 'medicina-preventiva', 'sve');
const VIEWS = path.join(SVE_DIR, 'sve-views.js');
const SEED = path.join(SVE_DIR, 'sve-seed.js');
const APP = path.join(SVE_DIR, 'sve-app.js');
const PERSIST = path.join(SVE_DIR, 'sve-persistencia.js');
const BRIDGE = path.join(RAIZ, 'main', 'medprev-sve-datos-bridge.js');
const PRELOAD = path.join(RAIZ, 'preload.js');
const LUCIDE = path.join(SVE_DIR, 'vendor', 'lucide.min.js');
const LOGIC = path.join(RAIZ, 'modules', 'gestion-salud', 'medicina-preventiva', 'medicina-preventiva-logic.js');
const INDEX = path.join(RAIZ, 'index.html');

function leer(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; }
}

const viewsSrc = leer(VIEWS);
const seedSrc = leer(SEED);
const appSrc = leer(APP);
const persistSrc = leer(PERSIST);
const bridgeSrc = leer(BRIDGE);
const preloadSrc = leer(PRELOAD);
const lucideSrc = leer(LUCIDE);
const logicSrc = leer(LOGIC);
const indexSrc = leer(INDEX);

// Mismo corte que test-sve-indicadores-edit: la sección V.Indicadores.
const indSrc = (viewsSrc.split('V.Indicadores = ')[1] || '');

const checks = [];
function ok(name, cond, extra) { checks.push({ name: name, ok: !!cond, extra: extra }); }

/* ============ 1) Vista: botón + formulario de alta ============ */
ok('1) la tarjeta tiene el botón "Nuevo período"',
  /Nuevo período/.test(indSrc));
ok('1) el botón llama a nuevoAnalisis()',
  /onClick:\s*function\s*\(\)\s*\{\s*nuevoAnalisis\(\);\s*\}/.test(indSrc));
ok('1) la función nuevoAnalisis existe dentro de V.Indicadores',
  /function nuevoAnalisis\(preset, errs\)/.test(indSrc));
ok('1) usa el icono plus del set lucide (no Virus)',
  /icon\("plus", 12\)/.test(indSrc) && /[,{]Plus:/.test(lucideSrc));
ok('1) el formulario pide periodo, hallazgos, propuestas y responsable',
  /campo\("Periodo"/.test(indSrc) && /campo\("Hallazgos"/.test(indSrc) &&
  /campo\("Propuestas de mejora"/.test(indSrc) && /campo\("Responsable"/.test(indSrc));
ok('1) el periodo es obligatorio (err + required)',
  /required:\s*true/.test(indSrc) && /errs\.periodo/.test(indSrc));
ok('1) valida periodo VACÍO',
  /el periodo no puede quedar vacío/.test(indSrc));
ok('1) valida periodo DUPLICADO contra los existentes',
  /ya existe un análisis para el periodo/.test(indSrc) &&
  /st\.analisis\.some/.test(indSrc));
ok('1) al fallar la validación REABRE el formulario con lo escrito',
  /nuevoAnalisis\(capturar\(\), errs2\)/.test(indSrc));
ok('1) al fallar avisa con toast',
  /toast\("Revisa el formulario"/.test(indSrc));
ok('1) guarda con SveStore.addAnalisis (no updateAnalisis)',
  /SveStore\.addAnalisis\(\{/.test(indSrc));
ok('1) tras guardar refresca la vista',
  /Análisis creado/.test(indSrc) && /SveApp\.refresh\(\)/.test(indSrc));
ok('1) el modal es ancho (wide) como el de editar',
  /title: "Nuevo análisis por periodo"[\s\S]{0,120}wide:\s*true/.test(indSrc));
ok('1) el placeholder sugiere el siguiente número de periodo',
  /placeholder: "Ej\.: " \+ siguiente/.test(indSrc));

/* ============ 2) Vista: estado vacío ============ */
ok('2) la tarjeta muestra estado vacío si no hay análisis',
  /Sin análisis por periodos/.test(indSrc));
ok('2) el estado vacío invita a crear el primero con el botón',
  /Crea el primer análisis con el botón/.test(indSrc));
ok('2) la lista usa st.analisis.length para alternar contenido/vacío',
  /st\.analisis\.length \? st\.analisis\.map/.test(indSrc));

/* ============ 3) Store: addAnalisis ============ */
ok('3) SveStore expone addAnalisis',
  /addAnalisis:\s*function\s*\(item\)/.test(appSrc));
ok('3) empuja al final de state.analisis (crea el arreglo si no existe)',
  /state\.analisis = state\.analisis \|\| \[\];/.test(appSrc) &&
  /state\.analisis\.push\(Object\.assign\(/.test(appSrc));
ok('3) el elemento nace con los 4 campos del contrato',
  /periodo: '',\s*hallazgos: '',\s*propuestas: '',\s*responsable: ''/.test(appSrc));
ok('3) en modo sqlite persiste el arreglo COMPLETO (reemplazo total)',
  /analisisGuardar\(state\.analisis\)/.test(appSrc));
ok('3) si la base falla RETIRA el elemento agregado (rollback)',
  /state\.analisis\.splice\(pos, 1\)/.test(appSrc));
ok('3) el fallo se reporta con _fallo (recarga y aviso)',
  /_fallo\('analisis:guardar', r\)/.test(appSrc));
ok('3) en modo local guarda en localStorage',
  /if \(modo !== 'sqlite'\) \{ _guardarLocal\(\); return; \}/.test(appSrc));
ok('3) updateAnalisis sigue intacto (la edición no se rompió)',
  /updateAnalisis:\s*function\s*\(idx, patch\)/.test(appSrc));

/* ============ 4) Cadena de persistencia intacta ============ */
ok('4) persistencia expone analisisGuardar',
  /analisisGuardar:\s*function\s*\(a\)/.test(persistSrc));
ok('4) preload expone medprevSveAnalisisGuardar',
  /medprevSveAnalisisGuardar/.test(preloadSrc));
ok('4) bridge tiene el handler medprev:sve:analisis:guardar',
  /medprev:sve:analisis:guardar/.test(bridgeSrc));
ok('4) el handler borra y reinserta (reemplazo total del bloque)',
  /DELETE FROM mp_sve_analisis WHERE programa_id = \?/.test(bridgeSrc));
ok('4) el reinserta escribe el orden por índice (el arreglo nuevo viaja entero)',
  /a\.responsable \|\| '', i, t\)/.test(bridgeSrc));
ok('4) la lectura devuelve los 4 campos',
  /SELECT periodo, hallazgos, propuestas, responsable FROM mp_sve_analisis/.test(bridgeSrc));

/* ============ 5) Seed: contrato de 4 campos ============ */
ok('5) el seed trae análisis con los 4 campos',
  /periodo: "1\. ENERO - JUNIO"/.test(seedSrc) &&
  /hallazgos:/.test(seedSrc) && /propuestas:/.test(seedSrc) && /responsable:/.test(seedSrc));
ok('5) el seed sigue exportando analisis',
  /analisis:\s*ANALISIS/.test(seedSrc));

/* ============ 6) Cache-bust ============ */
const mLogic = logicSrc.match(/var MEDPREV_V = '([^']+)'/);
const mIndex = indexSrc.match(/medicina-preventiva-logic\.js\?v=([^"']+)/);
ok('6) logic.js declara MEDPREV_V', !!mLogic);
ok('6) index.html versiona el script de logic.js', !!mIndex);
ok('6) los dos tokens coinciden', mLogic && mIndex && mLogic[1] === mIndex[1],
  mLogic && mIndex ? (mLogic[1] + ' vs ' + mIndex[1]) : 'faltan');
ok('6) MEDPREV_V subió a paleta-azul', !!mLogic && /paleta-azul$/.test(mLogic[1]), mLogic && mLogic[1]);

/* ============ 7) Integridad de sintaxis básica ============ */
ok('7) la vista sigue exportando V.Indicadores',
  /V\.Indicadores\s*=\s*function/.test(viewsSrc));
ok('7) editAnalisis sigue existiendo (la edición no se borró)',
  /function editAnalisis\(idx\)/.test(indSrc));
ok('7) las llaves de V.Indicadores quedan balanceadas (heurística)',
  (function () {
    var cuerpo = indSrc.split('\n').slice(0, indSrc.split('\n').length).join('\n');
    var ab = (cuerpo.match(/\{/g) || []).length;
    var ce = (cuerpo.match(/\}/g) || []).length;
    return Math.abs(ab - ce) <= 1;
  })());

/* ============ Reporte ============ */
var failed = 0;
checks.forEach(function (c) {
  if (c.ok) { console.log('  ok  ' + c.name); }
  else { failed++; console.log('FAIL  ' + c.name + (c.extra ? '  [' + c.extra + ']' : '')); }
});
console.log('--------------------------------');
console.log((checks.length - failed) + '/' + checks.length + ' OK');
process.exit(failed === 0 ? 0 : 1);
