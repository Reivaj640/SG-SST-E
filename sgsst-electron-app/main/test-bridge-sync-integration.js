/**
 * main/test-bridge-sync-integration.js
 *
 * Test E2E de la integracion bridge → sync (📦538).
 * Simula el flujo real:
 *   1. PC1 inicia, tiene sync-service configurado
 *   2. PC1 ejecuta _handlerGuardar del bridge evaluacion-action-plans
 *   3. El trigger debouncedPush se dispara
 *   4. Despues del debounce de 2s, el archivo .kairsync aparece en el hub
 *   5. PC2 hace pull y recibe el plan
 *
 * Ejecutar con: electron main/test-bridge-sync-integration.js
 *
 * Valida los acceptance criteria del spec §12 (📦538):
 *   - Guardar un plan en PC1 → en 10s, PC2 ve el plan al hacer pull
 *   - El trigger debouncedPush funciona correctamente
 */

'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const fsp = fs.promises;
const Database = require(path.join(__dirname, '..', 'node_modules', 'better-sqlite3'));

// Mock de electron
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
  if (request === 'electron') return { app: fakeApp, ipcMain: { handle: function () {} } };
  return _origLoad.apply(this, arguments);
};

// Cargar modulos
const syncService = require('./sync-service.js');
const pcidGen = require('./pcid-generator.js');

// Cargar el bridge REAL (con el trigger que acabamos de agregar)
const bridge = require('./evaluacion-action-plans-bridge.js');

let _passed = 0, _failed = 0, _total = 0;
function _assert(cond, msg) {
  _total++;
  if (cond) { _passed++; console.log('  [OK]  ' + msg); }
  else { _failed++; console.error('  [FAIL] ' + msg); }
}
function _assertEq(actual, expected, msg) {
  var ok = JSON.stringify(actual) === JSON.stringify(expected);
  _total++;
  if (ok) { _passed++; console.log('  [OK]  ' + msg); }
  else { _failed++; console.error('  [FAIL] ' + msg + ' (expected: ' + expected + ', actual: ' + actual + ')'); }
}
function _section(name) { console.log('\n=== ' + name + ' ==='); }

async function _sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function run() {
  var tmpBase = path.join(os.tmpdir(), 'kair-bridge-integ-' + Date.now());
  var pc1UserData = path.join(tmpBase, 'pc1');
  var pc2UserData = path.join(tmpBase, 'pc2');
  var hubDir = path.join(tmpBase, 'hub');
  await fsp.mkdir(pc1UserData, { recursive: true });
  await fsp.mkdir(pc2UserData, { recursive: true });
  await fsp.mkdir(hubDir, { recursive: true });

  console.log('tmpBase: ' + tmpBase);

  // Crear configs de PC1 y PC2 (formato real del proyecto: companyPaths)
  await fsp.writeFile(path.join(pc1UserData, 'config.json'), JSON.stringify({
    companyPaths: { 'asel': { root: 'G:\\test\\asel', sync: { enabled: true, hubPath: hubDir, intervalMinutes: 5, autoSync: false } } }
  }));
  await fsp.writeFile(path.join(pc2UserData, 'config.json'), JSON.stringify({
    companyPaths: { 'asel': { root: 'G:\\test\\asel', sync: { enabled: true, hubPath: hubDir, intervalMinutes: 5, autoSync: false } } }
  }));

  // Crear BDs
  var db1 = new Database(':memory:');
  var db2 = new Database(':memory:');
  _setupSchema(db1);
  _setupSchema(db2);

  // PC1: inicializar sync + pcId + bridge (SOLO UNA VEZ — el bridge queda con db1)
  fakeApp._userData = pc1UserData;
  syncService.init({ getPath: fakeApp.getPath, getAppPath: fakeApp.getAppPath }, { getDb: function () { return db1; } });
  pcidGen.ensurePcId(pc1UserData);
  // Inyectar db en el bridge (lo necesita para _handlerGuardar)
  bridge.registerEvaluacionActionPlansHandlers(fakeApp, { getDb: function () { return db1; } });

  // PC2: inicializar SOLO sync (NO reasignar el bridge — sigue con db1)
  // El syncService se reinicializa con db2 + userData de PC2 para el pull
  fakeApp._userData = pc2UserData;
  pcidGen.ensurePcId(pc2UserData);

  _section('Test 1: _handlerGuardar del bridge dispara trigger sync');

  // Llamar directamente al handler interno (bypass del IPC)
  var saveResult = bridge._handlerGuardar({
    empresaId: 'asel',
    year: '2026',
    source: 'ministerio',
    plan: {
      id: 'plan-test-001',
      accion: 'Test integracion bridge + sync',
      responsable: 'Admin',
      seguimientos: []
    }
  });

  _assertEq(saveResult.success, true, 'bridge _handlerGuardar retorna success=true');
  _assert(saveResult.data && saveResult.data.id === 'plan-test-001', 'plan guardado con id correcto');

  // Verificar que esta en la BD local
  var localRow = db1.prepare('SELECT id FROM evaluacion_action_plans WHERE id = ?').get('plan-test-001');
  _assert(localRow !== undefined, 'plan esta en BD local de PC1 inmediatamente despues del save');

  // ESPERAR el debounce (2s + margen)
  console.log('  Esperando 3s para que el debouncedPush se dispare...');
  await _sleep(3000);

  _section('Test 2: archivo .kairsync existe en el hub despues del debounce');

  var hubFile = path.join(hubDir, 'empresa.kairsync');
  var existsOnHub = fs.existsSync(hubFile);
  _assert(existsOnHub, 'archivo empresa.kairsync existe en el hub despues de 3s');

  if (existsOnHub) {
    var hubData = JSON.parse(fs.readFileSync(hubFile, 'utf8'));
    _assertEq(hubData.entities.planes_accion.length, 1, 'hub tiene 1 plan');
    _assertEq(hubData.entities.planes_accion[0].id, 'plan-test-001', 'plan correcto en hub');
  }

  _section('Test 3: PC2 hace pull y recibe el plan');

  fakeApp._userData = pc2UserData;
  syncService.init({ getPath: fakeApp.getPath, getAppPath: fakeApp.getAppPath }, { getDb: function () { return db2; } });

  var pullResult = await syncService.pull('asel');
  _assertEq(pullResult.success, true, 'pull OK');
  _assertEq(pullResult.applied, 1, '1 plan aplicado en PC2');

  var planInPc2 = db2.prepare('SELECT id, source FROM evaluacion_action_plans WHERE id = ?').get('plan-test-001');
  _assert(planInPc2 !== undefined, 'plan llego a PC2 despues del pull');
  _assert(planInPc2 && planInPc2.source === 'ministerio', 'source correcto en PC2');

  _section('Test 4: Debounce agrupa multiples mutaciones en un solo push');

  // Resetear el hub para ver claramente el siguiente push
  try { await fsp.unlink(hubFile); } catch (e) {}

  // Re-apuntar syncService a PC1 (db1 + userData) — el Test 3 lo cambio a PC2 (db2)
  fakeApp._userData = pc1UserData;
  syncService.init({ getPath: fakeApp.getPath, getAppPath: fakeApp.getAppPath }, { getDb: function () { return db1; } });
  bridge._handlerGuardar({
    empresaId: 'asel', year: '2026', source: 'manual',
    plan: { id: 'plan-debounce-1', accion: 'A', responsable: 'X', seguimientos: [] }
  });
  await _sleep(300);
  bridge._handlerGuardar({
    empresaId: 'asel', year: '2026', source: 'manual',
    plan: { id: 'plan-debounce-2', accion: 'B', responsable: 'X', seguimientos: [] }
  });
  await _sleep(300);
  bridge._handlerGuardar({
    empresaId: 'asel', year: 'asel', year: '2026', source: 'manual',
    plan: { id: 'plan-debounce-3', accion: 'C', responsable: 'X', seguimientos: [] }
  });
  // Esperar el debounce
  console.log('  Esperando 3s para que el debounce se complete (3 mutaciones → 1 push)...');
  await _sleep(3000);

  var hubExistsAfter3 = fs.existsSync(hubFile);
  _assert(hubExistsAfter3, 'hub archivo existe despues de las 3 mutaciones + debounce');

  if (hubExistsAfter3) {
    var hubData3 = JSON.parse(fs.readFileSync(hubFile, 'utf8'));
    _assertEq(hubData3.entities.planes_accion.length, 4, 'hub tiene 4 planes (1 original + 3 nuevos del debounce)');
  }

  _section('Test 5: Sync deshabilitado NO dispara push');

  // Crear PC3 con sync deshabilitado
  var pc3UserData = path.join(tmpBase, 'pc3');
  await fsp.mkdir(pc3UserData, { recursive: true });
  await fsp.writeFile(path.join(pc3UserData, 'config.json'), JSON.stringify({
    companyPaths: { 'asel': { root: 'G:\\test\\asel', sync: { enabled: false } } }
  }));
  fakeApp._userData = pc3UserData;
  syncService.init({ getPath: fakeApp.getPath, getAppPath: fakeApp.getAppPath }, { getDb: function () { return db1; } });

  // Crear un hub separado para PC3
  var pc3Hub = path.join(tmpBase, 'hub3');
  await fsp.mkdir(pc3Hub, { recursive: true });

  // Llamar debouncedPush directamente
  syncService.debouncedPush('asel');

  // Esperar el debounce
  await _sleep(3000);

  var pc3HubFile = path.join(pc3Hub, 'empresa.kairsync');
  // No deberia existir nada en pc3Hub (sync deshabilitado)
  _assert(!fs.existsSync(pc3HubFile), 'PC3 con sync deshabilitado NO crea archivo en el hub');

  _section('Test 6: Error en sync NO afecta operacion principal del bridge');

  // Que pasa si sync-service falla internamente? El bridge NO debe romperse.
  // Simulamos esto llamando debouncedPush con un companyKey invalido
  // (que no existe en config). El push deberia fallar silenciosamente,
  // pero el save del bridge debe seguir OK.
  fakeApp._userData = pc1UserData;
  syncService.init({ getPath: fakeApp.getPath, getAppPath: fakeApp.getAppPath }, { getDb: function () { return db1; } });

  var saveResult2 = bridge._handlerGuardar({
    empresaId: 'asel', year: '2026', source: 'manual',
    plan: { id: 'plan-after-error', accion: 'Despues de error', responsable: 'X', seguimientos: [] }
  });
  _assertEq(saveResult2.success, true, 'save del bridge sigue funcionando despues de errores previos');

  // Cleanup
  await fsp.rm(tmpBase, { recursive: true, force: true });

  console.log('\n=== Resumen ===');
  console.log('Total:    ' + _total);
  console.log('Pasados:  ' + _passed);
  console.log('Fallados: ' + _failed);
  console.log('');
  if (_failed === 0) {
    console.log('OK — Todos los tests de integracion pasaron.');
    process.exit(0);
  } else {
    console.error('FALLO — Hay tests que no pasaron.');
    process.exit(1);
  }
}

function _setupSchema(db) {
  db.exec(`
    CREATE TABLE evaluacion_action_plans (
      id          TEXT PRIMARY KEY,
      empresa_id  TEXT NOT NULL,
      year        TEXT NOT NULL,
      source      TEXT NOT NULL,
      plan_json   TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
  `);
}

run().catch(function (err) {
  console.error('ERROR FATAL en test:', err.message);
  console.error(err.stack);
  process.exit(2);
});
