/**
 * main/test-sync-service.js
 *
 * Test E2E del SyncService (📦537+📦538). Simula el flujo completo:
 *   - Crear 2 BDs independientes (PC1 y PC2)
 *   - Generar pcId estable para cada una
 *   - PC1 hace push al hub (carpeta temporal)
 *   - PC2 hace pull del hub
 *   - Verificar merge correcto entre PCs
 *   - PC2 hace push, PC1 hace pull
 *   - Idempotencia: segundo pull no aplica cambios
 *
 * Ejecutar con: electron main/test-sync-service.js
 *
 * Usa better-sqlite3 :memory: + carpetas temporales en os.tmpdir().
 */

'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const fsp = fs.promises;
const Database = require(path.join(__dirname, '..', 'node_modules', 'better-sqlite3'));

// Mock del modulo electron (porque electron solo existe dentro del runtime)
// sync-service.js hace `const { app } = require('electron')` solo en algunas
// rutas (init). Vamos a importarlo de forma controlada.
const Module = require('module');
const _origResolve = Module._resolveFilename;
const _origLoad = Module._load;

// Mock electron con un app ficticio
const fakeApp = {
  getPath: function (name) {
    if (name === 'userData') return fakeApp._userData;
    if (name === 'appPath') return path.join(__dirname, '..');
    return os.tmpdir();
  },
  getAppPath: function () { return path.join(__dirname, '..'); }
};

Module._load = function (request, parent) {
  if (request === 'electron') {
    return { app: fakeApp };
  }
  return _origLoad.apply(this, arguments);
};

// Ahora si podemos requerir sync-service
const syncService = require('./sync-service.js');
const serializer = require('./sync-serializer.js');
const pcidGen = require('./pcid-generator.js');

let _passed = 0;
let _failed = 0;
let _total = 0;

function _assert(cond, msg) {
  _total++;
  if (cond) { _passed++; console.log('  [OK]  ' + msg); }
  else { _failed++; console.error('  [FAIL] ' + msg); }
}
function _assertEq(actual, expected, msg) {
  var ok = JSON.stringify(actual) === JSON.stringify(expected);
  _total++;
  if (ok) { _passed++; console.log('  [OK]  ' + msg); }
  else {
    _failed++;
    console.error('  [FAIL] ' + msg);
    console.error('         expected: ' + JSON.stringify(expected));
    console.error('         actual:   ' + JSON.stringify(actual));
  }
}
function _section(name) { console.log('\n=== ' + name + ' ==='); }

// =====================================================================
// Setup
// =====================================================================

async function run() {
  var tmpBase = path.join(os.tmpdir(), 'kair-sync-e2e-' + Date.now());
  var pc1UserData = path.join(tmpBase, 'pc1');
  var pc2UserData = path.join(tmpBase, 'pc2');
  var hubDir = path.join(tmpBase, 'hub');
  await fsp.mkdir(pc1UserData, { recursive: true });
  await fsp.mkdir(pc2UserData, { recursive: true });
  await fsp.mkdir(hubDir, { recursive: true });

  console.log('tmpBase: ' + tmpBase);

  // Crear configs de PC1 y PC2 (formato real del proyecto: companyPaths)
  var cfg1Path = path.join(pc1UserData, 'config.json');
  var cfg2Path = path.join(pc2UserData, 'config.json');
  await fsp.writeFile(cfg1Path, JSON.stringify({
    companyPaths: { 'asel': { root: 'G:\\test\\asel', sync: { enabled: true, hubPath: hubDir, intervalMinutes: 5, autoSync: false } } }
  }, null, 2));
  await fsp.writeFile(cfg2Path, JSON.stringify({
    companyPaths: { 'asel': { root: 'G:\\test\\asel', sync: { enabled: true, hubPath: hubDir, intervalMinutes: 5, autoSync: false } } }
  }, null, 2));

  // Crear BDs
  var db1 = new Database(':memory:');
  var db2 = new Database(':memory:');
  _setupSchema(db1);
  _setupSchema(db2);

  // Inicializar SyncService para PC1
  fakeApp._userData = pc1UserData;
  syncService.init({ getPath: fakeApp.getPath, getAppPath: fakeApp.getAppPath }, { getDb: function () { return db1; } });

  _section('Test 1: pcId estable y unico por PC');

  var pc1Id = pcidGen.ensurePcId(pc1UserData);
  var pc1IdAgain = pcidGen.ensurePcId(pc1UserData);
  _assert(pc1Id === pc1IdAgain, 'pcId es estable entre llamadas (PC1: ' + pc1Id + ')');

  // Verificar que se guardo en config.json
  var cfg1 = JSON.parse(fs.readFileSync(cfg1Path, 'utf8'));
  _assertEq(cfg1.sync.pcId, pc1Id, 'pcId guardado en config.json de PC1');

  // PC2
  fakeApp._userData = pc2UserData;
  var pc2Id = pcidGen.ensurePcId(pc2UserData);
  _assert(pc1Id !== pc2Id, 'pcId de PC1 != pcId de PC2 (son PCs distintas)');
  console.log('         PC1: ' + pc1Id + ' / PC2: ' + pc2Id);

  _section('Test 2: PC1 tiene un plan, PC2 tiene otro (BDs aisladas)');

  db1.prepare(`INSERT INTO evaluacion_action_plans (id, empresa_id, year, source, plan_json, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)`)
    .run('plan-001', 'asel', '2026', 'ministerio',
         JSON.stringify({ id: 'plan-001', accion: 'Capacitar personal', responsable: 'Juan' }),
         '2026-07-13T10:00:00.000Z');

  db2.prepare(`INSERT INTO evaluacion_action_plans (id, empresa_id, year, source, plan_json, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)`)
    .run('plan-002', 'asel', '2026', 'arl',
         JSON.stringify({ id: 'plan-002', accion: 'Inspeccionar extintores', responsable: 'Maria' }),
         '2026-07-13T11:00:00.000Z');

  _assert(db1.prepare('SELECT id FROM evaluacion_action_plans WHERE id = ?').get('plan-001') !== undefined,
          'plan-001 existe en PC1');
  _assert(db2.prepare('SELECT id FROM evaluacion_action_plans WHERE id = ?').get('plan-002') !== undefined,
          'plan-002 existe en PC2');

  _section('Test 3: PC1 push al hub');

  fakeApp._userData = pc1UserData;
  var pushResult1 = await syncService.push('asel');
  _assertEq(pushResult1.success, true, 'push de PC1 OK');
  _assertEq(pushResult1.entities.planes, 1, 'push subio 1 plan');

  var hubFile = path.join(hubDir, 'empresa.kairsync');
  var existsOnHub = fs.existsSync(hubFile);
  _assert(existsOnHub, 'archivo empresa.kairsync existe en el hub');

  if (existsOnHub) {
    var hubData = JSON.parse(fs.readFileSync(hubFile, 'utf8'));
    _assertEq(hubData.lastWriter.pcId, pc1Id, 'lastWriter.pcId = pcId de PC1');
    _assertEq(hubData.entities.planes_accion.length, 1, 'hub tiene 1 plan');
    _assertEq(hubData.entities.planes_accion[0].id, 'plan-001', 'hub tiene plan-001');
  }

  _section('Test 4: PC2 pull del hub (recibe plan-001 de PC1)');

  fakeApp._userData = pc2UserData;
  // Re-init syncService para PC2 (porque apunta a otro userData)
  syncService.init({ getPath: fakeApp.getPath, getAppPath: fakeApp.getAppPath }, { getDb: function () { return db2; } });

  var pullResult = await syncService.pull('asel');
  _assertEq(pullResult.success, true, 'pull de PC2 OK');
  _assertEq(pullResult.applied, 1, '1 plan aplicado (plan-001)');

  var plan001InPc2 = db2.prepare('SELECT id, source FROM evaluacion_action_plans WHERE id = ?').get('plan-001');
  _assert(plan001InPc2 !== undefined, 'plan-001 quedo en PC2 despues del pull');
  _assert(plan001InPc2 && plan001InPc2.source === 'ministerio', 'plan-001.source correcto en PC2');

  _section('Test 5: Idempotencia — segundo pull no aplica cambios');

  var pullResult2 = await syncService.pull('asel');
  _assertEq(pullResult2.applied, 0, 'segundo pull: 0 aplicados (todo ya estaba)');
  _assertEq(pullResult2.skipped, 1, 'segundo pull: 1 skipped (todo ya estaba)');

  _section('Test 6: PC2 push al hub (con plan-001 + plan-002)');

  var pushResult2 = await syncService.push('asel');
  _assertEq(pushResult2.success, true, 'push de PC2 OK');
  _assertEq(pushResult2.entities.planes, 2, 'push subio 2 planes');

  var hubData2 = JSON.parse(fs.readFileSync(hubFile, 'utf8'));
  _assertEq(hubData2.entities.planes_accion.length, 2, 'hub tiene 2 planes ahora');
  _assertEq(hubData2.lastWriter.pcId, pc2Id, 'lastWriter.pcId = pcId de PC2');

  _section('Test 7: PC1 pull del hub (recibe plan-002 de PC2)');

  fakeApp._userData = pc1UserData;
  syncService.init({ getPath: fakeApp.getPath, getAppPath: fakeApp.getAppPath }, { getDb: function () { return db1; } });

  var pullResult3 = await syncService.pull('asel');
  _assertEq(pullResult3.applied, 1, '1 plan aplicado (plan-002)');
  _assertEq(pullResult3.skipped, 1, '1 plan skipped (plan-001, mismo timestamp)');

  var plan002InPc1 = db1.prepare('SELECT id FROM evaluacion_action_plans WHERE id = ?').get('plan-002');
  _assert(plan002InPc1 !== undefined, 'plan-002 quedo en PC1 despues del pull');

  _section('Test 8: Backups se crean en cada push');

  // PC1 hace push de nuevo
  var pushResult3 = await syncService.push('asel');
  _assertEq(pushResult3.success, true, 'push de PC1 OK');

  var filesInHub = fs.readdirSync(hubDir);
  var backups = filesInHub.filter(function (f) { return f.indexOf('empresa.kairsync.bak.') === 0; });
  _assert(backups.length >= 1, 'existe al menos 1 backup del archivo previo (' + backups.length + ' backups)');

  _section('Test 9: getStatus devuelve el estado correcto');

  var status = syncService.getStatus('asel');
  _assertEq(status.enabled, true, 'status.enabled = true');
  _assertEq(status.pcId, pc1Id, 'status.pcId = pcId de PC1');
  _assert(status.lastPush !== null, 'status.lastPush tiene timestamp');
  _assert(status.lastPull !== null, 'status.lastPull tiene timestamp');

  _section('Test 10: Sync deshabilitado se ignora');

  // Crear config con sync.enabled = false
  var cfgDisabledPath = path.join(tmpBase, 'pc-disabled', 'config.json');
  await fsp.mkdir(path.dirname(cfgDisabledPath), { recursive: true });
  await fsp.writeFile(cfgDisabledPath, JSON.stringify({
    companyPaths: { 'asel': { root: 'G:\\test\\asel', sync: { enabled: false } } }
  }));
  fakeApp._userData = path.join(tmpBase, 'pc-disabled');
  syncService.init({ getPath: fakeApp.getPath, getAppPath: fakeApp.getAppPath }, { getDb: function () { return db1; } });

  var statusDisabled = syncService.getStatus('asel');
  _assertEq(statusDisabled.enabled, false, 'sync deshabilitado en config');
  _assertEq(statusDisabled.reason, 'disabled_in_config', 'razon = disabled_in_config');

  var pushDisabled = await syncService.push('asel');
  _assertEq(pushDisabled.success, false, 'push de empresa deshabilitada: success=false');
  _assertEq(pushDisabled.reason, 'disabled', 'razon del fallo = disabled');

  // Cleanup
  await fsp.rm(tmpBase, { recursive: true, force: true });

  console.log('\n=== Resumen ===');
  console.log('Total:    ' + _total);
  console.log('Pasados:  ' + _passed);
  console.log('Fallados: ' + _failed);
  console.log('');
  if (_failed === 0) {
    console.log('OK — Todos los tests E2E pasaron.');
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
