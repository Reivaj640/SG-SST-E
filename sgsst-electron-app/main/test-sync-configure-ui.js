/**
 * main/test-sync-configure-ui.js
 *
 * Test E2E del flujo UI de configuracion de sync (📦537):
 *   - sync:configure escribe en config.json
 *   - El path es config.companyPaths[companyKey].sync (NO config.companies)
 *   - sync:disable pone enabled=false sin perder hubPath
 *   - sync:status detecta correctamente el sync desde el nuevo path
 *
 * Ejecutar con: electron main/test-sync-configure-ui.js
 */

'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const fsp = fs.promises;
const Database = require(path.join(__dirname, '..', 'node_modules', 'better-sqlite3'));

// Mock electron
const Module = require('module');
const _origLoad = Module._load;
const fakeApp = {
  _userData: null,
  getPath: function (name) {
    if (name === 'userData') return fakeApp._userData;
    if (name === 'appPath') return path.join(__dirname, '..');
    return os.tmpdir();
  },
  getAppPath: function () { return path.join(__dirname, '..'); }
};
Module._load = function (request, parent) {
  if (request === 'electron') return { app: fakeApp, ipcMain: { handle: function () {} }, dialog: { showOpenDialog: function () { return Promise.resolve({ canceled: true, filePaths: [] }); } } };
  return _origLoad.apply(this, arguments);
};

const syncService = require('./sync-service.js');
const writer = require('./sync-config-writer.js');

let _passed = 0, _failed = 0, _total = 0;
function _assert(cond, msg) { _total++; if (cond) { _passed++; console.log('  [OK]  ' + msg); } else { _failed++; console.error('  [FAIL] ' + msg); } }
function _assertEq(actual, expected, msg) { var ok = JSON.stringify(actual) === JSON.stringify(expected); _total++; if (ok) { _passed++; console.log('  [OK]  ' + msg); } else { _failed++; console.error('  [FAIL] ' + msg + ' (expected: ' + JSON.stringify(expected) + ', actual: ' + JSON.stringify(actual) + ')'); } }
function _section(name) { console.log('\n=== ' + name + ' ==='); }

async function run() {
  var tmpBase = path.join(os.tmpdir(), 'kair-sync-ui-test-' + Date.now());
  var userData = path.join(tmpBase, 'userData');
  var hubDir = path.join(tmpBase, 'hub');
  await fsp.mkdir(userData, { recursive: true });
  await fsp.mkdir(hubDir, { recursive: true });

  // Crear config con companyPaths (formato real del proyecto)
  var configPath = path.join(userData, 'config.json');
  await fsp.writeFile(configPath, JSON.stringify({
    companyPaths: {
      'Asel': { root: 'G:\\test\\asel', stats: { employees: 15 } },
      'Aseplus': { root: 'G:\\test\\aseplus', stats: { employees: 210 } }
    }
  }));

  fakeApp._userData = userData;
  syncService.init({ getPath: fakeApp.getPath, getAppPath: fakeApp.getAppPath }, { getDb: function () { return null; } });

  _section('Test 1: writeCompanySyncConfig crea el bloque sync en companyPaths');

  var result1 = await writer.writeCompanySyncConfig(configPath, 'Asel', {
    enabled: true,
    hubPath: 'G:/Mi unidad/K+AIR Sync/asel',
    intervalMinutes: 5,
    autoSync: true
  });

  _assertEq(result1.success, true, 'writeCompanySyncConfig retorna success=true');
  _assertEq(result1.data.enabled, true, 'data.enabled=true');
  _assertEq(result1.data.hubPath, 'G:/Mi unidad/K+AIR Sync/asel', 'data.hubPath correcto');
  _assertEq(result1.data.intervalMinutes, 5, 'data.intervalMinutes=5');

  // Verificar que se escribio en disco
  var configAfter = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  _assert(configAfter.companyPaths.Asel.sync !== undefined, 'config.companyPaths.Asel.sync existe');
  _assertEq(configAfter.companyPaths.Asel.sync.enabled, true, 'sync.enabled escrito correctamente');
  _assertEq(configAfter.companyPaths.Asel.sync.hubPath, 'G:/Mi unidad/K+AIR Sync/asel', 'sync.hubPath escrito correctamente');

  _section('Test 2: syncService.getStatus detecta la nueva config');

  var status = syncService.getStatus('Asel');
  _assertEq(status.enabled, true, 'getStatus.enabled=true');
  _assertEq(status.pcId !== undefined, true, 'status.pcId existe (generado por ensurePcId o fallback)');
  _assertEq(status.hubPath, 'G:/Mi unidad/K+AIR Sync/asel', 'status.hubPath correcto');
  _assertEq(status.intervalMinutes, 5, 'status.intervalMinutes=5');
  _assertEq(status.autoSync, true, 'status.autoSync=true');

  _section('Test 3: writeCompanySyncConfig normaliza rutas con backslash');

  var result3 = await writer.writeCompanySyncConfig(configPath, 'Aseplus', {
    enabled: true,
    hubPath: 'G:\\Mi unidad\\K+AIR Sync\\aseplus',
    intervalMinutes: 10,
    autoSync: true
  });
  _assertEq(result3.success, true, 'write con backslashes retorna success=true');
  _assertEq(result3.data.hubPath, 'G:/Mi unidad/K+AIR Sync/aseplus', 'hubPath normalizado a slashes');

  _section('Test 4: writeCompanySyncConfig valida hubPath absoluto');

  var result4 = await writer.writeCompanySyncConfig(configPath, 'Asel', {
    enabled: true,
    hubPath: 'ruta-relativa/invalida',
    intervalMinutes: 5
  });
  _assertEq(result4.success, false, 'ruta relativa falla');
  _assertEq(result4.error.code, 'VALIDATION', 'codigo de error = VALIDATION');

  _section('Test 5: writeCompanySyncConfig rechaza empresa inexistente');

  var result5 = await writer.writeCompanySyncConfig(configPath, 'EmpresaFalsa', {
    enabled: true,
    hubPath: 'G:/test/falsa',
    intervalMinutes: 5
  });
  _assertEq(result5.success, false, 'empresa inexistente falla');
  _assertEq(result5.error.code, 'COMPANY_NOT_FOUND', 'codigo de error = COMPANY_NOT_FOUND');

  _section('Test 6: writeCompanySyncConfig no toca otras keys del config');

  // Agregar otra key al config
  var configBefore6 = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  configBefore6.otraKey = { foo: 'bar' };
  fs.writeFileSync(configPath, JSON.stringify(configBefore6, null, 2));

  await writer.writeCompanySyncConfig(configPath, 'Asel', {
    enabled: false,
    hubPath: 'G:/Mi unidad/K+AIR Sync/asel',
    intervalMinutes: 5
  });
  var configAfter6 = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  _assertEq(configAfter6.otraKey.foo, 'bar', 'otraKey se preserva');
  _assert(configAfter6.companyPaths.Aseplus.sync !== undefined, 'sync de Aseplus se preserva');
  _assertEq(configAfter6.companyPaths.Asel.sync.enabled, false, 'Asel sync.enabled=false ahora');

  _section('Test 7: writeCompanySyncConfig hace backup del config previo');

  // Limpiar backup anterior si existe
  var bakPath = configPath + '.bak';
  try { await fsp.unlink(bakPath); } catch (e) {}

  // El primer write creo backup. Verificar que existe.
  await writer.writeCompanySyncConfig(configPath, 'Asel', {
    enabled: true,
    hubPath: 'G:/Mi unidad/K+AIR Sync/asel',
    intervalMinutes: 5
  });
  var bakExists = fs.existsSync(bakPath);
  _assert(bakExists, 'backup config.json.bak existe despues de write');

  _section('Test 8: disableCompanySync pone enabled=false sin perder hubPath');

  var result8 = await writer.disableCompanySync(configPath, 'Asel');
  _assertEq(result8.success, true, 'disable retorna success=true');
  _assertEq(result8.data.enabled, false, 'data.enabled=false');
  _assert(result8.data.hubPath.length > 0, 'hubPath se preserva para reactivar despues');

  // getStatus debe devolver enabled=false
  var status8 = syncService.getStatus('Asel');
  _assertEq(status8.enabled, false, 'getStatus.enabled=false despues de disable');

  _section('Test 9: reactivacion con writeCompanySyncConfig');

  var result9 = await writer.writeCompanySyncConfig(configPath, 'Asel', {
    enabled: true,
    hubPath: 'G:/Mi unidad/K+AIR Sync/asel',
    intervalMinutes: 5
  });
  _assertEq(result9.success, true, 'reactivacion OK');
  _assertEq(result9.data.enabled, true, 'enabled=true de nuevo');

  _section('Test 10: defaults aplicados cuando no se pasan campos opcionales');

  // Crear config limpio para este test
  var configPath10 = path.join(tmpBase, 'userData10', 'config.json');
  await fsp.mkdir(path.dirname(configPath10), { recursive: true });
  await fsp.writeFile(configPath10, JSON.stringify({
    companyPaths: { 'Test': { root: 'G:/test' } }
  }));

  var result10 = await writer.writeCompanySyncConfig(configPath10, 'Test', {
    hubPath: 'G:/Mi unidad/test'
  });
  _assertEq(result10.success, true, 'write sin campos opcionales OK');
  _assertEq(result10.data.enabled, true, 'default enabled=true');
  _assertEq(result10.data.intervalMinutes, 5, 'default intervalMinutes=5');
  _assertEq(result10.data.autoSync, true, 'default autoSync=true');

  // Cleanup
  await fsp.rm(tmpBase, { recursive: true, force: true });

  console.log('\n=== Resumen ===');
  console.log('Total:    ' + _total);
  console.log('Pasados:  ' + _passed);
  console.log('Fallados: ' + _failed);
  console.log('');
  if (_failed === 0) {
    console.log('OK — Todos los tests pasaron.');
    process.exit(0);
  } else {
    console.error('FALLO — Hay tests que no pasaron.');
    process.exit(1);
  }
}

run().catch(function (err) {
  console.error('ERROR FATAL en test:', err.message);
  console.error(err.stack);
  process.exit(2);
});
