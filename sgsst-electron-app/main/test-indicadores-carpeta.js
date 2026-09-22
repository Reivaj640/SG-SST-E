/* ============================================================
 * Test funcional — Bridge de Definición de Indicadores (6.1.1)
 * 📦800 (2026-09-21)
 *
 * NO toca el Excel real de la empresa: lo copia a un directorio
 * temporal junto con la estructura de carpetas y opera sobre la copia.
 *
 * Cubre:
 *   1. _findExcel elige el año pedido / el mayor disponible
 *   2. indicadores:obtener lee el Excel real (17 indicadores, 3 tipos)
 *   3. Serie mensual doble (RESULTADO): numerador + valor calculado + denominador
 *   4. Serie mensual simple (ESTRUCTURA/PROCESO) con fila de referencia
 *   5. Match definición ↔ datos por nombre con tildes/espacios
 *   6. currentValue = último valor no nulo
 *   7. Fallback: empresa sin carpeta → source 'none' (el frontend cae al mock)
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');

const APP_ROOT = path.resolve(__dirname, '..');
const REAL_611 = 'G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa\\1. Tempoactiva Est SAS\\6. Verificación\\6.1.1 Definición de indicadores';

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log('  ✓ ' + label); }
  else { failed++; console.log('  ✗ FALLO: ' + label); }
}
function section(s) { console.log('\n=== ' + s + ' ==='); }

if (!fs.existsSync(path.join(REAL_611, 'INDICADORES 2026.xlsx'))) {
  console.error('No se encuentra el Excel real en ' + REAL_611);
  process.exit(1);
}

/* Directorio temporal con la estructura de la empresa */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-ind-test-'));
const DIR_611 = path.join(TMP, 'empresa', '6. Verificación', '6.1.1 Definición de indicadores');
fs.mkdirSync(DIR_611, { recursive: true });
fs.copyFileSync(path.join(REAL_611, 'INDICADORES 2026.xlsx'), path.join(DIR_611, 'INDICADORES 2026.xlsx'));
fs.copyFileSync(path.join(REAL_611, 'INDICADORES 2025.xlsx'), path.join(DIR_611, 'INDICADORES 2025.xlsx'));

/* Mock de electron (el bridge solo necesita ipcMain) */
const handlers = {};
const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') {
    return {
      app: { getPath: () => TMP },
      ipcMain: { handle: function (ch, fn) { handlers[ch] = fn; } }
    };
  }
  return origLoad.apply(this, arguments);
};

const bridge = require('./indicadores-verificacion-bridge');
bridge.registerVerificacionIndicadoresHandlers({ getPath: () => TMP }, {
  getCompanyRootPath: async function (name) {
    if (name === 'Tempoactiva') return path.join(TMP, 'empresa');
    return null; /* simula empresa sin carpeta configurada */
  }
});

(async function run() {
  section('1. Canal registrado');
  assert(typeof handlers['indicadores:obtener'] === 'function', 'indicadores:obtener registrado');

  section('2. Lectura completa del Excel 2026');
  const res = await handlers['indicadores:obtener'](null, 'Tempoactiva', null);
  assert(res.success === true, 'respuesta success');
  assert(res.data.source === 'excel', 'source = excel');
  assert(res.data.year === 2026, 'año = 2026 (el mayor disponible)');
  const inds = res.data.indicadores;
  assert(inds.length === 18, '18 indicadores (' + inds.length + ')');
  assert(inds.filter(i => i.type === 'RESULTADO').length === 9, '9 de RESULTADO');
  assert(inds.filter(i => i.type === 'ESTRUCTURA').length === 5, '5 de ESTRUCTURA');
  assert(inds.filter(i => i.type === 'PROCESO').length === 4, '4 de PROCESO');

  section('3. Serie doble (RESULTADO) — Índice de Frecuencia');
  const frec = inds.find(i => /frecuencia/i.test(i.name));
  assert(!!frec, 'encontrado por nombre con tilde variante');
  assert(frec.monthlyData.length === 12, '12 meses');
  assert(frec.monthlyData[0].month === 'ENE', 'primer mes ENE');
  assert(frec.monthlyData[0].numerator === 0, 'ENE numerador 0 (A.T)');
  assert(frec.monthlyData[0].denominator === 140, 'ENE denominador 140 (N° Trabajadores)');
  assert(Math.abs(frec.monthlyData[0].value - 0.7142857142857143) < 1e-9, 'ENE valor = 0.7142… (calculado del Excel)');
  assert(frec.monthlyData[4].numerator === 1, 'MAY numerador 1');
  assert(frec.monthlyData[4].denominator === 225, 'MAY denominador 225');
  assert(Math.abs(frec.monthlyData[4].value - 0.4444444444444444) < 1e-9, 'MAY valor = 0.4444…');
  assert(frec.target === 0.03, 'meta 0.03 desde la hoja de datos');
  assert(frec.frequency.toUpperCase() === 'MENSUAL', 'frecuencia MENSUAL');

  section('4. Serie simple (PROCESO) — Ejecución del plan de trabajo');
  const plan = inds.find(i => i.type === 'PROCESO' && /plan de trabajo/i.test(i.name));
  assert(!!plan, 'encontrado (el de PROCESO, no el de ESTRUCTURA)');
  assert(plan.monthlyData.length === 12, '12 meses (' + plan.monthlyData.length + ')');
  assert(plan.monthlyData[1].numerator === 10, 'FEB desarrolladas 10');
  assert(plan.monthlyData[1].denominator === 11, 'FEB propuestas 11');
  assert(Math.abs(plan.monthlyData[1].value - (10 / 11)) < 1e-9, 'FEB valor derivado = 10/11');

  section('4b. Match por prefijo (nombre extendido en definición)');
  const planE = inds.find(i => i.type === 'ESTRUCTURA' && /plan de trabajo/i.test(i.name));
  assert(!!planE, 'Plan de trabajo anual/Capacitaciones (ESTRUCTURA) presente');
  assert(planE.monthlyData.length === 12, 'su serie también se emparejó por prefijo (' + planE.monthlyData.length + ' meses)');

  section('5. Serie simple (ESTRUCTURA) — Política de SST');
  const pol = inds.find(i => /política de sst/i.test(i.name)) || inds.find(i => /politica de sst/i.test(i.name));
  assert(!!pol, 'encontrado (con/sin tilde)');
  assert(pol.monthlyData[0].month === 'ENE', 'meses presentes');
  assert(pol.target === 1, 'meta 1');

  section('6. Campos de definición fusionados');
  assert(!!frec.definition && frec.definition.length > 10, 'definición traída de la hoja de definición');
  const sev = inds.find(i => /severidad/i.test(i.name));
  assert(!!sev.responsible, 'responsable presente (Severidad sí lo trae en el Excel)');
  assert('responsible' in frec, 'responsable existe aunque el Excel lo deje vacío (frecuencia)');
  assert(!!frec.interpretation, 'interpretación presente');
  assert(frec.currentValue !== null, 'currentValue no nulo (último valor de la serie)');

  section('7. Selección por año');
  const res2025 = await handlers['indicadores:obtener'](null, 'Tempoactiva', 2025);
  assert(res2025.data.year === 2025, 'año explícito 2025');
  const res1999 = await handlers['indicadores:obtener'](null, 'Tempoactiva', 1999);
  assert(res1999.data.source === 'none', 'año inexistente → source none');

  section('8. Fallback sin carpeta');
  const resNone = await handlers['indicadores:obtener'](null, 'EmpresaSinCarpeta', null);
  assert(resNone.success === true && resNone.data.source === 'none', 'source none sin caerse');

  section('Limpieza');
  Module._load = origLoad;
  try { fs.rmSync(TMP, { recursive: true, force: true }); console.log('  ✓ temporal eliminado'); } catch (e) { console.log('  (tmp no eliminado: ' + e.message + ')'); }

  console.log('\n========================================');
  console.log('RESULTADO: ' + passed + ' pasaron, ' + failed + ' fallaron');
  console.log('========================================');
  process.exit(failed > 0 ? 1 : 0);
})();
