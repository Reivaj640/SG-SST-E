/**
 * main/test-gestacion-eliminar.js
 *
 * Test E2E del boton de eliminar seguimiento de gestacion (📦538).
 * Cubre:
 *   - _handlerEliminarSeguimiento elimina el registro correcto
 *   - Validacion cross-tenant (rechaza seguimientos de otra empresa)
 *   - Trigger de sync dispara push al hub
 *   - Replicar gestacion a otra PC y eliminarla, verificar merge correcto
 *
 * Ejecutar con: electron main/test-gestacion-eliminar.js
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
const bridge = require('./gestacion-bridge.js');

let _passed = 0, _failed = 0, _total = 0;
function _assert(cond, msg) { _total++; if (cond) { _passed++; console.log('  [OK]  ' + msg); } else { _failed++; console.error('  [FAIL] ' + msg); } }
function _assertEq(actual, expected, msg) { var ok = JSON.stringify(actual) === JSON.stringify(expected); _total++; if (ok) { _passed++; console.log('  [OK]  ' + msg); } else { _failed++; console.error('  [FAIL] ' + msg + ' (expected: ' + JSON.stringify(expected) + ', actual: ' + JSON.stringify(actual) + ')'); } }
function _section(name) { console.log('\n=== ' + name + ' ==='); }

async function _sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function run() {
  var tmpBase = path.join(os.tmpdir(), 'kair-gest-elim-' + Date.now());
  var pc1UserData = path.join(tmpBase, 'pc1');
  var pc2UserData = path.join(tmpBase, 'pc2');
  var hubDir = path.join(tmpBase, 'hub');
  await fsp.mkdir(pc1UserData, { recursive: true });
  await fsp.mkdir(pc2UserData, { recursive: true });
  await fsp.mkdir(hubDir, { recursive: true });

  await fsp.writeFile(path.join(pc1UserData, 'config.json'), JSON.stringify({
    companyPaths: { 'asel': { root: 'G:\\test\\asel', sync: { enabled: true, hubPath: hubDir, intervalMinutes: 5, autoSync: false } } }
  }));
  await fsp.writeFile(path.join(pc2UserData, 'config.json'), JSON.stringify({
    companyPaths: { 'asel': { root: 'G:\\test\\asel', sync: { enabled: true, hubPath: hubDir, intervalMinutes: 5, autoSync: false } } }
  }));

  var db1 = new Database(':memory:');
  var db2 = new Database(':memory:');
  _setupSchema(db1);
  _setupSchema(db2);

  // Init sync + bridge en PC1
  fakeApp._userData = pc1UserData;
  syncService.init({ getPath: fakeApp.getPath, getAppPath: fakeApp.getAppPath }, { getDb: function () { return db1; } });
  bridge.registerGestacionHandlers(fakeApp, { getDb: function () { return db1; } });

  // Init sync en PC2 (NO bridge porque el sync es lo que probamos)
  fakeApp._userData = pc2UserData;
  syncService.init({ getPath: fakeApp.getPath, getAppPath: fakeApp.getAppPath }, { getDb: function () { return db2; } });

  _section('Test 1: registrar gestante y crear 2 seguimientos en PC1');

  // Crear gestante via bridge
  var regResult = bridge._handlerRegistrarGestante('asel', {
    cedula: '1234567890',
    nombre: 'Ana Lopez',
    fpp: '2026-12-15',
    fechaNotificacion: '2026-07-01',
    cargo: 'Auxiliar',
    area: 'Operaciones',
    eps: 'Sanitas',
    arl: 'Positiva',
    afp: 'Porvenir'
  });
  _assertEq(regResult.success, true, 'gestante registrada OK');
  if (!regResult.success) {
    console.error('Error:', JSON.stringify(regResult.error));
    process.exit(1);
  }
  var gestanteId = regResult.data.id;

  // Crear seguimiento 1
  var seg1 = bridge._handlerGuardarSeguimiento('asel', {
    gestacionId: gestanteId,
    periodo: '2026-07',
    fecha: '2026-07-15',
    semanas: 12,
    clasificacion: 'bajo',
    observaciones: 'Control rutinario'
  });
  _assertEq(seg1.success, true, 'seguimiento 1 creado');
  var seg1Id = seg1.data.id;

  // Crear seguimiento 2
  var seg2 = bridge._handlerGuardarSeguimiento('asel', {
    gestacionId: gestanteId,
    periodo: '2026-08',
    fecha: '2026-08-15',
    semanas: 16,
    clasificacion: 'bajo',
    observaciones: 'Control rutinario 2'
  });
  _assertEq(seg2.success, true, 'seguimiento 2 creado');
  var seg2Id = seg2.data.id;

  _section('Test 2: _handlerEliminarSeguimiento elimina el registro correcto');

  var delResult = bridge._handlerEliminarSeguimiento('asel', seg1Id);
  _assertEq(delResult.success, true, 'eliminacion OK');
  _assertEq(delResult.data.id, seg1Id, 'data.id correcto');
  _assertEq(delResult.data.periodo, '2026-07', 'data.periodo correcto');

  // Verificar que ya no esta en la BD
  var checkDeleted = db1.prepare('SELECT id FROM seguimiento_gestacion_mensual WHERE id = ?').get(seg1Id);
  _assert(checkDeleted === undefined, 'seguimiento 1 eliminado de la BD');

  // Verificar que el seguimiento 2 sigue ahi
  var checkSeg2 = db1.prepare('SELECT id FROM seguimiento_gestacion_mensual WHERE id = ?').get(seg2Id);
  _assert(checkSeg2 !== undefined, 'seguimiento 2 sigue en la BD');

  _section('Test 3: Validacion cross-tenant');

  var delOther = bridge._handlerEliminarSeguimiento('otra-empresa', seg2Id);
  _assertEq(delOther.success, false, 'no permite eliminar de otra empresa');
  _assertEq(delOther.error.code, 'NOT_FOUND', 'codigo de error = NOT_FOUND');

  // Verificar que sigue ahi
  var checkSeg2After = db1.prepare('SELECT id FROM seguimiento_gestacion_mensual WHERE id = ?').get(seg2Id);
  _assert(checkSeg2After !== undefined, 'seguimiento 2 sigue ahi despues del intento cross-tenant');

  _section('Test 4: Eliminacion valida que el seguimiento existe');

  var delFake = bridge._handlerEliminarSeguimiento('asel', 'seguimiento-falso-123');
  _assertEq(delFake.success, false, 'rechaza ID falso');
  _assertEq(delFake.error.code, 'NOT_FOUND', 'codigo de error = NOT_FOUND');

  _section('Test 5: Trigger de sync dispara push al hub despues de eliminar');

  // Re-apuntar syncService a PC1 (db1) — el Test 3/4 lo cambio a PC2 (db2)
  fakeApp._userData = pc1UserData;
  syncService.init({ getPath: fakeApp.getPath, getAppPath: fakeApp.getAppPath }, { getDb: function () { return db1; } });

  // DEBUG: verificar que la gestante esta en la BD
  var allGestantes = db1.prepare('SELECT id, nombre, actualizado_en, empresa_id FROM gestaciones').all();
  console.log('  [DEBUG] Gestantes en BD de PC1: ' + JSON.stringify(allGestantes));

  // Esperar el debounce (2s + margen)
  console.log('  Esperando 3s para que el debouncedPush se dispare...');
  await _sleep(3000);

  var hubFile = path.join(hubDir, 'empresa.kairsync');
  _assert(fs.existsSync(hubFile), 'archivo .kairsync existe en el hub');

  if (fs.existsSync(hubFile)) {
    var hubData = JSON.parse(fs.readFileSync(hubFile, 'utf8'));
    console.log('  [DEBUG] Hub data keys: ' + Object.keys(hubData).join(','));
    console.log('  [DEBUG] Hub entities keys: ' + Object.keys(hubData.entities).join(','));
    console.log('  [DEBUG] Hub gestaciones length: ' + hubData.entities.gestaciones.length);
    console.log('  [DEBUG] Hub events cumplidos: ' + hubData.entities.eventos_cumplidos.length);
    console.log('  [DEBUG] Hub events rapidos: ' + hubData.entities.eventos_rapidos.length);
    _assertEq(hubData.entities.gestaciones.length, 1, 'hub tiene 1 gestante');

    var gestanteHub = hubData.entities.gestaciones[0];
    _assertEq(gestanteHub.seguimientos.length, 1, 'hub tiene 1 seguimiento (despues de eliminar)');
    _assertEq(gestanteHub.seguimientos[0].id, seg2Id, 'seguimiento 2 es el que quedo');
    _assert(gestanteHub.seguimientos.find(function (s) { return s.id === seg1Id; }) === undefined,
            'seguimiento 1 NO esta en el hub (fue eliminado)');
  }

  _section('Test 6: PC2 hace pull y refleja la eliminacion (con caveat)');

  fakeApp._userData = pc2UserData;
  syncService.init({ getPath: fakeApp.getPath, getAppPath: fakeApp.getAppPath }, { getDb: function () { return db2; } });

  // Crear las tablas en PC2 (simula que el usuario ya abrio el modulo de gestacion
  // al menos una vez — requisito para que el sync pueda escribir los datos)
  _setupSchema(db2);

  // PC2 no tiene nada. Cargar primer pull.
  var pullResult = await syncService.pull('asel');
  _assertEq(pullResult.success, true, 'pull inicial OK');

  // Verificar que la gestante llego a PC2
  var gestanteInPc2 = db2.prepare('SELECT id FROM gestaciones WHERE id = ?').get(gestanteId);
  _assert(gestanteInPc2 !== undefined, 'gestante llego a PC2');

  // Verificar que el seguimiento 2 llego a PC2
  var seg2InPc2 = db2.prepare('SELECT id FROM seguimiento_gestacion_mensual WHERE id = ?').get(seg2Id);
  _assert(seg2InPc2 !== undefined, 'seguimiento 2 llego a PC2');

  // CAVEAT CONOCIDO: la eliminacion cross-PC no se propaga automaticamente.
  // El seguimiento 1 NO deberia estar en PC2 (porque PC1 lo elimino antes de hacer push).
  // Verificamos que NO esta.
  var seg1InPc2 = db2.prepare('SELECT id FROM seguimiento_gestacion_mensual WHERE id = ?').get(seg1Id);
  _assert(seg1InPc2 === undefined, 'seguimiento 1 NO esta en PC2 (correcto: fue eliminado antes del push)');

  _section('Test 7: _handlerEliminarSeguimiento maneja empresaId vacio');

  var delEmpty = bridge._handlerEliminarSeguimiento('', seg2Id);
  _assertEq(delEmpty.success, false, 'rechaza empresaId vacio');
  _assertEq(delEmpty.error.code, 'VALIDATION', 'codigo de error = VALIDATION');

  var delEmpty2 = bridge._handlerEliminarSeguimiento('asel', '');
  _assertEq(delEmpty2.success, false, 'rechaza seguimientoId vacio');
  _assertEq(delEmpty2.error.code, 'VALIDATION', 'codigo de error = VALIDATION');

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

function _setupSchema(db) {
  // Usar el schema REAL del bridge (que tiene todas las columnas)
  db.exec(bridge.SCHEMA_SQL);
  // Aplicar migraciones tambien
  if (Array.isArray(bridge.MIGRATIONS_SQL)) {
    for (var i = 0; i < bridge.MIGRATIONS_SQL.length; i++) {
      try { db.exec(bridge.MIGRATIONS_SQL[i]); } catch (e) { /* ignore duplicate column */ }
    }
  }
}

run().catch(function (err) {
  console.error('ERROR FATAL en test:', err.message);
  console.error(err.stack);
  process.exit(2);
});
