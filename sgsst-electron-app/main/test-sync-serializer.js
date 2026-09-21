/**
 * main/test-sync-serializer.js
 *
 * Test standalone del sync-serializer (📦536).
 * Ejecutar con: node main/test-sync-serializer.js
 *
 * NO requiere Electron. Usa better-sqlite3 :memory: para crear 2 BDs
 * independientes que simulan 2 PCs distintas sincronizando entre si.
 *
 * Cubre los acceptance criteria del spec §12 (📦536):
 *   - Serializar una empresa de prueba genera JSON con la estructura de §5.1
 *   - Deserializar hace merge correcto con un JSON de prueba
 *   - Last-write-wins funciona por registro (mas nuevo gana)
 *   - Insercion cuando el registro no existe local
 *   - Skip cuando el local es mas nuevo o igual
 */

'use strict';

const path = require('path');
const Database = require(path.join(__dirname, '..', 'node_modules', 'better-sqlite3'));
const serializer = require('./sync-serializer.js');

let _passed = 0;
let _failed = 0;
let _total = 0;

function _assert(cond, msg) {
  _total++;
  if (cond) {
    _passed++;
    console.log('  [OK]  ' + msg);
  } else {
    _failed++;
    console.error('  [FAIL] ' + msg);
  }
}

function _assertEq(actual, expected, msg) {
  var ok = JSON.stringify(actual) === JSON.stringify(expected);
  _total++;
  if (ok) {
    _passed++;
    console.log('  [OK]  ' + msg);
  } else {
    _failed++;
    console.error('  [FAIL] ' + msg);
    console.error('         expected: ' + JSON.stringify(expected));
    console.error('         actual:   ' + JSON.stringify(actual));
  }
}

function _section(name) {
  console.log('\n=== ' + name + ' ===');
}

// =====================================================================
// Setup: crear 2 BDs en memoria que simulan 2 PCs
// =====================================================================

console.log('Inicializando 2 BDs en memoria (simulando 2 PCs)...');

var db1 = new Database(':memory:');
var db2 = new Database(':memory:');

// Crear las tablas necesarias en ambas BDs
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
    CREATE TABLE gestaciones (
      id          TEXT PRIMARY KEY,
      empresa_id  TEXT NOT NULL,
      cedula      TEXT,
      nombre      TEXT,
      updated_at  TEXT
    );
    CREATE TABLE seguimiento_gestacion_mensual (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      gestacion_id  TEXT NOT NULL,
      fecha         TEXT,
      observaciones TEXT
    );
  `);
}

_setupSchema(db1);
_setupSchema(db2);

// Insertar datos en PC1 (admin escritorio)
db1.prepare(`
  INSERT INTO evaluacion_action_plans (id, empresa_id, year, source, plan_json, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
`).run('plan-001', 'asel', '2026', 'ministerio',
       JSON.stringify({ id: 'plan-001', accion: 'Capacitar personal', responsable: 'Juan', seguimientos: [] }),
       '2026-07-10T10:00:00.000Z');

db1.prepare(`
  INSERT INTO evaluacion_action_plans (id, empresa_id, year, source, plan_json, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
`).run('plan-002', 'asel', '2026', 'arl',
       JSON.stringify({ id: 'plan-002', accion: 'Inspeccionar extintores', responsable: 'Maria', seguimientos: [] }),
       '2026-07-11T14:30:00.000Z');

db1.prepare(`
  INSERT INTO gestaciones (id, empresa_id, cedula, nombre, updated_at)
  VALUES (?, ?, ?, ?, ?)
`).run('gest-001', 'asel', '1234567890', 'Ana Lopez', '2026-07-09T09:00:00.000Z');

// Insertar dato en PC2 (laptop) — un plan distinto
db2.prepare(`
  INSERT INTO evaluacion_action_plans (id, empresa_id, year, source, plan_json, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
`).run('plan-003', 'asel', '2026', 'manual',
       JSON.stringify({ id: 'plan-003', accion: 'Actualizar matriz de peligros', responsable: 'Pedro', seguimientos: [] }),
       '2026-07-12T11:15:00.000Z');

console.log('PC1: 2 planes + 1 gestacion cargados');
console.log('PC2: 1 plan cargado');

// =====================================================================
// Test 1: Serializar PC1 debe generar JSON con la estructura del spec §5.1
// =====================================================================

_section('Test 1: serializeEmpresaToSync genera JSON con estructura §5.1');

var syncData1 = serializer.serializeEmpresaToSync(
  db1, 'asel', 'escritorio-jrf', 'admin', '0.1.114'
);

_assertEq(syncData1.version, 1, 'version === 1');
_assertEq(syncData1.companyKey, 'asel', 'companyKey === asel');
_assert(typeof syncData1.lastWriteAt === 'string', 'lastWriteAt es string ISO');
_assertEq(syncData1.lastWriter.pcId, 'escritorio-jrf', 'lastWriter.pcId correcto');
_assertEq(syncData1.lastWriter.userName, 'admin', 'lastWriter.userName correcto');
_assertEq(syncData1.lastWriter.appVersion, '0.1.114', 'lastWriter.appVersion correcto');
_assert(Array.isArray(syncData1.entities.planes_accion), 'entities.planes_accion es array');
_assertEq(syncData1.entities.planes_accion.length, 2, 'PC1 tiene 2 planes serializados');
_assert(Array.isArray(syncData1.entities.gestaciones), 'entities.gestaciones es array');
_assertEq(syncData1.entities.gestaciones.length, 1, 'PC1 tiene 1 gestacion serializada');

// Verificar forma de un plan serializado
var plan001 = syncData1.entities.planes_accion.find(function (p) { return p.id === 'plan-001'; });
_assert(plan001 !== undefined, 'plan-001 esta en el JSON');
_assertEq(plan001.year, '2026', 'plan-001.year correcto');
_assertEq(plan001.source, 'ministerio', 'plan-001.source correcto');
_assertEq(plan001.plan.accion, 'Capacitar personal', 'plan-001.plan.accion correcto');
_assertEq(plan001.updatedAt, '2026-07-10T10:00:00.000Z', 'plan-001.updatedAt correcto');

// =====================================================================
// Test 2: Serializar PC2 debe tener 1 plan (no ve los de PC1)
// =====================================================================

_section('Test 2: PC2 tiene solo sus datos');

var syncData2 = serializer.serializeEmpresaToSync(
  db2, 'asel', 'laptop-1', 'admin', '0.1.114'
);
_assertEq(syncData2.entities.planes_accion.length, 1, 'PC2 tiene 1 plan');
_assertEq(syncData2.entities.planes_accion[0].id, 'plan-003', 'PC2 tiene plan-003');

// =====================================================================
// Test 3: Pull — aplicar JSON de PC2 a PC1 (insert del plan-003)
// =====================================================================

_section('Test 3: deserializeSyncToDb inserta registros nuevos');

var conflicts3 = [];
var result3 = serializer.deserializeSyncToDb(db1, syncData2, {
  conflictLog: function (local, remote) { conflicts3.push({ local: local, remote: remote }); }
});
_assertEq(result3.applied, 1, '1 plan aplicado');
_assertEq(result3.conflicts, 0, '0 conflictos (era INSERT, no UPDATE)');
_assertEq(result3.skipped, 0, '0 skipped');
_assertEq(result3.byEntity.planes_accion.applied, 1, 'contador byEntity.planes_accion.applied');

// Verificar que el plan-003 quedo en PC1
var plan003Local = db1.prepare('SELECT id, source, plan_json FROM evaluacion_action_plans WHERE id = ?').get('plan-003');
_assert(plan003Local !== undefined, 'plan-003 quedo en PC1 despues del pull');
_assertEq(plan003Local.source, 'manual', 'plan-003.source correcto en PC1');

// =====================================================================
// Test 4: Pull con conflicto (mismo plan, distintos timestamps)
// =====================================================================

_section('Test 4: last-write-wins gana el mas nuevo');

// PC1 tiene plan-001 con updatedAt '2026-07-10T10:00:00.000Z'
// Simulamos que PC2 (ya con plan-001 actualizado a una fecha posterior) hace push
db2.prepare(`
  INSERT OR REPLACE INTO evaluacion_action_plans (id, empresa_id, year, source, plan_json, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
`).run('plan-001', 'asel', '2026', 'ministerio',
       JSON.stringify({ id: 'plan-001', accion: 'Capacitar personal (actualizado)', responsable: 'Juan', seguimientos: [] }),
       '2026-07-13T08:00:00.000Z'); // Mas nuevo que PC1

var syncData2Updated = serializer.serializeEmpresaToSync(db2, 'asel', 'laptop-1', 'admin', '0.1.114');
var conflicts4 = [];
var result4 = serializer.deserializeSyncToDb(db1, syncData2Updated, {
  conflictLog: function (local, remote) { conflicts4.push({ local: local, remote: remote }); }
});
_assertEq(result4.applied, 1, '1 plan aplicado (UPDATE)');
_assertEq(result4.conflicts, 1, '1 conflicto detectado y resuelto');
_assertEq(result4.byEntity.planes_accion.conflicts, 1, 'contador conflictos byEntity');
_assertEq(conflicts4.length, 1, 'conflictLog fue llamado 1 vez');

// Verificar que PC1 ahora tiene la version mas nueva
var plan001Updated = db1.prepare('SELECT plan_json, updated_at FROM evaluacion_action_plans WHERE id = ?').get('plan-001');
var planObj = JSON.parse(plan001Updated.plan_json);
_assertEq(planObj.accion, 'Capacitar personal (actualizado)', 'plan-001 actualizado en PC1');
_assertEq(plan001Updated.updated_at, '2026-07-13T08:00:00.000Z', 'plan-001 updated_at actualizado en PC1');

// =====================================================================
// Test 5: Pull bidireccional (PC1 -> PC2) cuando timestamps coinciden
// =====================================================================

_section('Test 5: con timestamps iguales, merge es idempotente');

// Despues de los tests 3 y 4, PC1 tiene 3 planes (plan-001 actualizado, plan-002, plan-003)
// y PC2 tiene 2 planes (plan-001 actualizado, plan-003 original).
// Cuando PC1 hace push y PC2 hace pull:
//   - plan-001: misma fecha en ambas -> SKIP
//   - plan-002: solo en PC1 -> INSERT en PC2
//   - plan-003: misma fecha en ambas -> SKIP
// Resultado: 1 applied (plan-002 que faltaba), 2 skipped.

var syncData1After = serializer.serializeEmpresaToSync(db1, 'asel', 'escritorio-jrf', 'admin', '0.1.114');
var result5 = serializer.deserializeSyncToDb(db2, syncData1After);
_assertEq(result5.applied, 1, '1 plan aplicado (plan-002 que faltaba en PC2)');
_assertEq(result5.byEntity.planes_accion.applied, 1, 'contador byEntity.planes_accion.applied');
_assertEq(result5.byEntity.planes_accion.skipped, 2, '2 planes skipped (mismo updatedAt)');

// =====================================================================
// Test 6: version mismatch del .kairsync
// =====================================================================

_section('Test 6: version mismatch lanza error');

var badSync = JSON.parse(JSON.stringify(syncData1));
badSync.version = 999;

var threw = false;
try {
  serializer.deserializeSyncToDb(db1, badSync);
} catch (e) {
  threw = true;
  _assert(/version/i.test(e.message), 'mensaje de error menciona "version"');
}
_assert(threw, 'deserializeSyncToDb lanza error con version mismatch');

// =====================================================================
// Test 7: tabla inexistente (no rompe)
// =====================================================================

_section('Test 7: tablas inexistentes no rompen el serializer');

var dbVacio = new Database(':memory:');
// NO creamos ninguna tabla
var syncVacio = serializer.serializeEmpresaToSync(dbVacio, 'asel', 'test', 'test', '0.0.0');
_assertEq(syncVacio.entities.planes_accion.length, 0, 'planes_accion = [] si tabla no existe');
_assertEq(syncVacio.entities.gestaciones.length, 0, 'gestaciones = [] si tabla no existe');
_assertEq(syncVacio.entities.eventos_cumplidos.length, 0, 'eventos_cumplidos = [] si tabla no existe');
_assertEq(syncVacio.entities.eventos_rapidos.length, 0, 'eventos_rapidos = [] si tabla no existe');

// =====================================================================
// Test 8: readSyncFile / writeSyncFile (con carpeta temporal)
// =====================================================================

_section('Test 8: readSyncFile / writeSyncFile round-trip');

(async function () {
  var os = require('os');
  var fs = require('fs');
  var fsp = fs.promises;
  var tmpDir = path.join(os.tmpdir(), 'kair-sync-test-' + Date.now());

  try {
    var writtenPath = await serializer.writeSyncFile(tmpDir, syncData1);
    _assert(writtenPath.endsWith('empresa.kairsync'), 'writeSyncFile devuelve path correcto');

    var readBack = await serializer.readSyncFile(tmpDir);
    _assert(readBack !== null, 'readSyncFile devuelve objeto');
    _assertEq(readBack.version, syncData1.version, 'version preservada en round-trip');
    _assertEq(readBack.companyKey, syncData1.companyKey, 'companyKey preservado');
    _assertEq(readBack.entities.planes_accion.length, syncData1.entities.planes_accion.length,
              'cantidad de planes preservada en round-trip');

    // readSyncFile con directorio inexistente debe devolver null
    var readMissing = await serializer.readSyncFile(path.join(tmpDir, 'no-existe'));
    _assertEq(readMissing, null, 'readSyncFile devuelve null si carpeta no existe');

    // Limpiar
    await fsp.rm(tmpDir, { recursive: true, force: true });
  } catch (e) {
    _failed++;
    _total++;
    console.error('  [FAIL] Error en round-trip de I/O: ' + e.message);
  } finally {
    _printSummary();
  }
})();

// =====================================================================
// Summary
// =====================================================================

function _printSummary() {
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
