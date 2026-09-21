// =====================================================================
// 📦708 (2026-08-15) — Validador del importador con Excel REAL
// Script para que puedas correr en tu máquina y validar que el importador
// lee correctamente tu Excel real de Tempoactiva (o el de cualquier empresa).
//
// Uso:
//   node test-import-real-excel.js "<ruta-al-excel>" [empresa] [anio]
//
// Ejemplos:
//   node test-import-real-excel.js "G:\Mi unidad\2. Trabajo\1. SG-SST\2. Temporales Comfa\1. Tempoactiva Est SAS\1. Recursos\1.1.3 Asignación de Recursos\ACT-FO-043 Presupuesto SG-SST 2026 Tempoactiva.xlsx"
//   node test-import-real-excel.js "G:\...\presupuesto.xlsx" "Tempoactiva" 2026
//
// Qué hace:
//   1. Lee el Excel con el parser del bridge (DRY-RUN, no toca BD)
//   2. Muestra resumen: cuántas partidas, conceptos, primeros/últimos
//   3. Si el flag --import está al final, ejecuta el import real a la BD
//      (necesita que Electron esté corriendo con el bridge registrado)
//
// Importante: este script NO abre la app Electron. Solo parsea el Excel.
// Para hacer el import real a BD, usá la Fase 2 (UI con botón "Importar").
// =====================================================================

const path = require('path');
const fs = require('fs');

// --- Parse args ---
var args = process.argv.slice(2);
var doImport = false;
var filePath = null;
var companyName = null;
var anio = null;

for (var i = 0; i < args.length; i++) {
  var a = args[i];
  if (a === '--import' || a === '-i') {
    doImport = true;
  } else if (!filePath) {
    filePath = a;
  } else if (!companyName) {
    companyName = a;
  } else if (!anio) {
    anio = parseInt(a, 10);
  }
}

if (!filePath) {
  console.log('Uso:');
  console.log('  node test-import-real-excel.js "<ruta-al-excel>" [empresa] [anio]');
  console.log('');
  console.log('Ejemplo:');
  console.log('  node test-import-real-excel.js "G:\\Mi unidad\\...\\presupuesto.xlsx" "Tempoactiva" 2026');
  console.log('');
  console.log('Flags:');
  console.log('  --import, -i   Ejecuta el import real a BD (requiere Electron corriendo)');
  process.exit(1);
}

if (!companyName) {
  // Auto-detectar del nombre del archivo
  var fileName = path.basename(filePath);
  var matchYear = fileName.match(/(\d{4})/);
  if (matchYear) anio = parseInt(matchYear[1], 10);
  // Asume nombre de empresa = parte antes del año
  // "ACT-FO-043 Presupuesto SG-SST 2026 Tempoactiva.xlsx" → "Tempoactiva"
  var beforeYear = fileName.split(/\d{4}/)[0];
  companyName = beforeYear.replace(/ACT-FO-\d+\s*Presupuesto\s*SG-SST\s*/i, '').replace(/\.xlsx?$/i, '').trim();
  if (!companyName) companyName = 'EMPRESA_NO_DETECTADA';
  console.log('[AUTO] Empresa detectada del nombre: "' + companyName + '"');
  console.log('[AUTO] Año detectado del nombre: ' + anio);
}

// --- Verificar que el archivo existe ---
if (!fs.existsSync(filePath)) {
  console.error('ERROR: Archivo no encontrado:');
  console.error('  ' + filePath);
  process.exit(1);
}

console.log('');
console.log('=====================================================================');
console.log('  📦708 · Validador del importador con Excel REAL');
console.log('=====================================================================');
console.log('');
console.log('Archivo:   ' + filePath);
console.log('Empresa:   ' + companyName);
console.log('Año:       ' + anio);
console.log('Modo:      ' + (doImport ? 'IMPORT REAL (a BD)' : 'DRY-RUN (solo parsea)'));
console.log('');

// --- Mock del módulo 'electron' (mismo patrón que los otros tests) ---
const Module = require('module');
const _originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === 'electron') return path.join(__dirname, '__mock_electron.js');
  return _originalResolve.call(this, request, parent, ...rest);
};
const _mockIpcHandlers = {};
const _mockElectron = {
  ipcMain: { handle: function (channel, handler) { _mockIpcHandlers[channel] = handler; } },
  app: { on: function () {}, getPath: function () { return '/tmp'; } }
};
fs.writeFileSync(path.join(__dirname, '__mock_electron.js'), 'module.exports = global._mockElectronModule;\n');
global._mockElectronModule = _mockElectron;

// --- DRY RUN: parsear el Excel directamente con el bridge ---
console.log('[1/2] Parseando Excel (dry-run)...');
try {
  var bridge = require('./presupuesto-bridge');
  // Re-registrar el bridge con mocks para poder llamar al handler
  // (no necesitamos BD real para el dry-run, pero el handler la pide)
  // Truco: en dry-run el handler no toca la BD, solo parsea
  bridge.registerPresupuestoHandlers(_mockElectron.app, {
    getDb: function () { return null; }, // No hay BD en dry-run
    validateSession: function (token) { return { ok: true, user: { id: 1, isAdmin: true } }; }
  });

  // Llamar al handler con dryRun=true
  var dryRunResult = _mockIpcHandlers['presupuesto:import-from-excel']({}, {
    token: 'valid-token',
    filePath: filePath,
    companyName: companyName,
    anio: anio,
    options: { dryRun: true }
  });

  if (!dryRunResult.success) {
    console.error('');
    console.error('❌ ERROR parseando el Excel:');
    console.error('   Código:  ' + dryRunResult.error.code);
    console.error('   Mensaje: ' + dryRunResult.error.message);
    if (dryRunResult.error.extra) {
      console.error('   Extra:   ' + JSON.stringify(dryRunResult.error.extra));
    }
    cleanup();
    process.exit(1);
  }

  var parsed = dryRunResult.data.parsed;
  console.log('');
  console.log('✅ Excel parseado correctamente:');
  console.log('   Hoja:           ' + parsed.sheetName);
  console.log('   Rango:          ' + parsed.range);
  console.log('   Partidas:       ' + parsed.partidasCount);
  console.log('   Primera:        #' + parsed.firstPartida.numero + ' — ' + parsed.firstPartida.concepto);
  console.log('   Última:         #' + parsed.lastPartida.numero + ' — ' + parsed.lastPartida.concepto);
  console.log('');

  // Si quiere hacer el import real
  if (doImport) {
    console.log('[2/2] Ejecutando import REAL a BD...');
    console.log('');
    console.log('   ⚠️  IMPORTANTE: este import REAL necesita que la app Electron');
    console.log('   esté corriendo con el bridge registrado. Si no, la BD no estará');
    console.log('   disponible y retornará NO_DB.');
    console.log('');
    console.log('   Para hacer el import real desde la UI, esperá a la Fase 2.');
    console.log('   Por ahora, este script NO va a escribir nada en la BD.');
    console.log('');
    console.log('   Lo que sigue es un intento de import directo (puede fallar):');
    console.log('');

    // Intentar el import de todas formas
    var importResult = _mockIpcHandlers['presupuesto:import-from-excel']({}, {
      token: 'valid-token',
      filePath: filePath,
      companyName: companyName,
      anio: anio,
      options: { overwrite: false }
    });

    if (importResult.success) {
      console.log('✅ Import real exitoso:');
      console.log('   Presupuesto ID: ' + importResult.data.presupuestoId);
      console.log('   Partidas:       ' + importResult.data.inserted);
      console.log('   Valores:        ' + importResult.data.valores);
    } else {
      console.log('⚠️  Import real NO exitoso (esperado si no hay BD):');
      console.log('   Código:  ' + importResult.error.code);
      console.log('   Mensaje: ' + importResult.error.message);
      console.log('');
      console.log('   Esto es normal sin Electron corriendo. La Fase 2 (UI) lo hará');
      console.log('   correctamente porque ahí sí hay BD.');
    }
  } else {
    console.log('ℹ️  Para ejecutar el import REAL a BD, agregá --import al final:');
    console.log('   node test-import-real-excel.js "<archivo>" --import');
    console.log('');
    console.log('   PERO el import real necesita la app Electron abierta. Sin la app,');
    console.log('   la BD no existe. Esperá a la Fase 2 (UI con botón "Importar").');
  }
} catch (e) {
  console.error('');
  console.error('❌ ERROR INESPERADO:');
  console.error('   ' + e.message);
  console.error('');
  console.error(e.stack);
  cleanup();
  process.exit(2);
}

cleanup();

function cleanup() {
  try { fs.unlinkSync(path.join(__dirname, '__mock_electron.js')); } catch (e) {}
}

console.log('');
console.log('=====================================================================');
console.log('');
process.exit(0);
