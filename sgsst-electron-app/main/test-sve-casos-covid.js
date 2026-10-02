// test-sve-casos-covid.js
// 📦832 — "Registros de morbilidad" se reemplazó por "Casos SVE por año".
//
// Análisis del caso: el programa es el Sistema de Vigilancia Epidemiológica
// para la prevención de COVID-19 (sus indicadores son prevalencia, incidencia
// y ausentismo POR COVID), así que la tarjeta de morbilidad laboral general
// (accidentes de trabajo / enfermedades comunes × años 2020-2024, hoja
// "SVE covid" filas 51-56) no pertenecía a ese programa: esa materia ya la
// cubren los submódulos 3.3.4/3.3.5 de Gestión de la Salud.
//
// La tarjeta nueva resume LOS SEGUIMIENTOS del programa por año:
// total, positivos (PCR / prueba rápida), en aislamiento, altas y
// descartados — datos que el programa SÍ tiene.
//
// Tests ESTATICOS a proposito (leen el fuente, no lo ejecutan), como
// test-sve-indicadores-edit.js. Cubren:
//   1. Vista: la tarjeta nueva existe, la vieja desapareció, y los 5
//      conceptos + el predicado de positivo están en el corte V.Indicadores.
//   2. Vista: cardCasos se monta en la sección de 2 columnas junto al
//      análisis por periodos (el reemplazo es en el mismo lugar).
//   3. Vista: estado vacío si no hay seguimientos + reutiliza yearTable
//      (misma tabla que el resto de la pantalla) + icono del set lucide.
//   4. Datos de morbilidad NO se borraron: seed, store, bridge y preload
//      siguen con su cadena completa (solo dejó de pintarse).
//   5. Cache-bust: MEDPREV_V subió a -16 (luego a -17 con 📦833) y coincide con index.html
//      (sin esto, la tarjeta nueva no se ve hasta limpiar la caché).
//
// Uso: node main/test-sve-casos-covid.js

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

/* ============ 1) Vista: la tarjeta nueva existe, la vieja no ============ */
ok('1) la tarjeta se llama "Casos SVE por año"',
  /"Casos SVE por año"/.test(indSrc));
ok('1) el título viejo "Registros de morbilidad" ya NO está en la vista',
  !/Registros de morbilidad/.test(viewsSrc.replace(/\/\*[\s\S]*?\*\//g, '')));
ok('1) la vista ya NO lee st.morbilidad ni usa cardMor',
  !/cardMor/.test(viewsSrc) && !/st\.morbilidad/.test(viewsSrc));
ok('1) el pill de la tarjeta nueva dice "COVID · seguimientos"',
  /"COVID · seguimientos"/.test(indSrc));

/* ============ 2) Conceptos y predicado de positivo ============ */
const conceptos = [
  'Seguimientos (total)',
  'Positivos (PCR / prueba rápida)',
  'En aislamiento',
  'Altas',
  'Descartados'
];
conceptos.forEach(function (c) {
  ok('2) fila "' + c + '" presente', new RegExp(c.replace(/[()\/]/g, '\\$&')).test(indSrc));
});
ok('2) el predicado positivo mira pcr Y prueba rápida, sin importar mayúsculas',
  /function esPositivo\(s\)/.test(indSrc) &&
  /String\(s && s\.pcr\)\.toUpperCase\(\) === "SI"/.test(indSrc) &&
  /String\(s && s\.pruebaRapida\)\.toUpperCase\(\) === "SI"/.test(indSrc));
ok('2) cuenta() agrupa por año exacto del seguimiento',
  /function cuenta\(fn\)/.test(indSrc) && /Number\(s && s\.anio\) === y && fn\(s\)/.test(indSrc));
ok('2) los años salen de los seguimientos y van ordenados',
  /anios\.sort\(function \(a, b\) \{ return a - b; \}\)/.test(indSrc));

/* ============ 3) Montaje, tabla y estado vacío ============ */
ok('3) cardCasos se monta en la sección de 2 columnas junto a cardAn',
  /\[cardCasos, cardAn\]/.test(indSrc));
ok('3) el bloque es una IIFE asignada a cardCasos (no suelta helpers sueltos)',
  /var cardCasos = \(function \(\) \{/.test(indSrc));
ok('3) reutiliza yearTable (misma tabla del resto de la pantalla)',
  /yearTable\(\{ anios: anios \}, rows\)/.test(indSrc));
ok('3) tiene estado vacío si no hay seguimientos',
  /anios\.length/.test(indSrc) &&
  /sve-empty__ttl", textContent: "Sin seguimientos"/.test(indSrc));
ok('3) usa el icono "activity" y ese icono existe en el lucide vendorizado',
  /icon\("activity", 15\)/.test(indSrc) && /Activity/.test(lucideSrc));

/* ============ 4) Los datos de morbilidad NO se borraron ============ */
ok('4) el seed sigue trayendo MORBILIDAD (hoja SVE covid filas 51-56)',
  /var MORBILIDAD = \{/.test(seedSrc) && /morbilidad: MORBILIDAD/.test(seedSrc));
ok('4) el store sigue inicializando morbilidad desde los datos',
  /morbilidad: d\.morbilidad \|\| \{ anios: \[\], filas: \[\] \}/.test(appSrc));
ok('4) el bridge sigue exponiendo morbilidadGuardar',
  /morbilidadGuardar: function \(m\)/.test(persistSrc) &&
  /medprevSveMorbilidadGuardar/.test(persistSrc));
ok('4) el handler IPC morbilidad:guardar sigue registrado',
  /medprev:sve:morbilidad:guardar/.test(bridgeSrc));
ok('4) el preload sigue exponiendo el canal',
  /medprevSveMorbilidadGuardar/.test(preloadSrc));

/* ============ 5) Cache-bust (dos niveles: index → logic → vistas) ============ */
const vLogic = (logicSrc.match(/MEDPREV_V = '([^']+)'/) || [])[1] || '';
const vIndex = (indexSrc.match(/medicina-preventiva-logic\.js\?v=([^"']+)/) || [])[1] || '';
ok('5) MEDPREV_V subió a la variante -17', /-17$/.test(vLogic), vLogic);
ok('5) index.html pide exactamente el mismo ?v= que define logic',
  vLogic && vLogic === vIndex, 'logic=' + vLogic + ' index=' + vIndex);

/* ============ Reporte ============ */
let failed = 0;
checks.forEach(function (c, i) {
  const n = String(i + 1).padStart(2, '0');
  if (c.ok) {
    console.log('  ✓ ' + n + ' ' + c.name);
  } else {
    failed++;
    console.log('  ✗ ' + n + ' ' + c.name + (c.extra ? '  → ' + c.extra : ''));
  }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' OK' + (failed ? '  · ' + failed + ' FALLAS' : ''));
process.exit(failed === 0 ? 0 : 1);
