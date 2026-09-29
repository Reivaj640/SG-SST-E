// =====================================================================
// 📦708 (2026-08-15) — Test de los handlers GRANULARES (Fase 3.5)
//   - presupuesto:add-partida — crea una partida con N valores mensuales
//   - presupuesto:delete-partida — soft delete (activo=0)
//   - presupuesto:set-mes-values — upsert de un valor mensual
//   - presupuesto:update-meta — rename + notes
// =====================================================================

const path = require('path');
const fs = require('fs');
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
fs.writeFileSync(
  path.join(__dirname, '__mock_electron.js'),
  'module.exports = global._mockElectronModule;\n'
);
global._mockElectronModule = _mockElectron;

function _wrapSqlJsAsBetterSqlite(sqlJsDb) {
  return {
    exec: function (sql) { sqlJsDb.exec(sql); },
    prepare: function (sql) {
      return {
        get: function () {
          var args = Array.prototype.slice.call(arguments);
          var stmt = sqlJsDb.prepare(sql);
          try {
            if (args.length > 0) stmt.bind(args);
            if (stmt.step()) return stmt.getAsObject();
            return undefined;
          } finally { stmt.reset(); stmt.free(); }
        },
        all: function () {
          var args = Array.prototype.slice.call(arguments);
          var stmt = sqlJsDb.prepare(sql);
          try {
            if (args.length > 0) stmt.bind(args);
            var rows = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            return rows;
          } finally { stmt.reset(); stmt.free(); }
        },
        run: function () {
          var args = Array.prototype.slice.call(arguments);
          var stmt = sqlJsDb.prepare(sql);
          try {
            if (args.length > 0) stmt.bind(args);
            stmt.step();
          } finally { stmt.reset(); stmt.free(); }
        }
      };
    }
  };
}

let _passed = 0, _failed = 0;
function _ok(m) { _passed++; console.log('  ✓ ' + m); }
function _fail(m) { _failed++; console.error('  ✗ ' + m); }
function _assert(c, m) { c ? _ok(m) : _fail(m); }
function _assertEq(a, e, m) { a === e ? _ok(m + ' (=' + a + ')') : _fail(m + ' (esperado=' + e + ', actual=' + a + ')'); }

async function run() {
  console.log('');
  console.log('=====================================================================');
  console.log('  📦708 · TEST handlers GRANULARES (Fase 3.5)');
  console.log('=====================================================================');
  console.log('');

  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({
    locateFile: function (file) { return path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file); }
  });

  var rawDb = new SQL.Database();
  rawDb.exec('PRAGMA foreign_keys = ON;');
  var bridge = require('./presupuesto-bridge');
  rawDb.exec(bridge.SCHEMA_SQL);
  rawDb.exec("CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY AUTOINCREMENT, company_key TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL)");
  rawDb.exec("INSERT INTO companies (id, company_key, display_name) VALUES (1, 'tempoactiva', 'Tempoactiva')");
  var db = _wrapSqlJsAsBetterSqlite(rawDb);
  _ok('DB inicializada');

  bridge.registerPresupuestoHandlers(_mockElectron.app, {
    getDb: function () { return db; },
    validateSession: function () { return { ok: true, user: { id: 1 } }; }
  });
  _ok('Bridge registrado');

  // SETUP: crear presupuesto
  var createRes = _mockIpcHandlers['presupuesto:create']({}, {
    companyName: 'Tempoactiva',
    anio: 2026
  });
  var presupuestoId = createRes.data.presupuestoId;
  _ok('Setup: presupuesto creado ' + presupuestoId);

  // ============================================================
  // TEST 1: add-partida — caso OK
  // ============================================================
  console.log('');
  console.log('[1] presupuesto:add-partida — caso OK');
  var addRes = _mockIpcHandlers['presupuesto:add-partida']({}, {
    presupuestoId: presupuestoId,
    concepto: 'Nueva partida de prueba',
    descripcion: 'Para testing',
    asignadoTotal: 1200000
  });
  _assert(addRes.success === true, 'add-partida OK');
  _assertEq(addRes.data.partida.numero, 1, 'numero = 1 (primera)');
  _assertEq(addRes.data.partida.concepto, 'Nueva partida de prueba', 'concepto correcto');
  _assertEq(addRes.data.partida.asignado, 1200000, 'asignado = 1.200.000');
  _assertEq(addRes.data.partida.id.indexOf('pp-'), 0, 'id con formato pp-');

  // Verificar BD
  var partida = db.prepare('SELECT * FROM presupuesto_partidas WHERE id = ?').get(addRes.data.partida.id);
  _assert(partida.activo === 1, 'partida activa=1');
  _assertEq(partida.numero, 1, 'numero en BD = 1');

  var valores = db.prepare('SELECT * FROM presupuesto_valores_mensuales WHERE partida_id = ? ORDER BY mes').all(addRes.data.partida.id);
  _assertEq(valores.length, 12, '12 valores mensuales');
  _assertEq(valores[0].asignado, 100000, 'mes 1 asignado = 100.000 (1.200.000/12)');
  _assertEq(valores[0].ejecutado, 0, 'mes 1 ejecutado = 0');
  _assertEq(valores[11].asignado, 100000, 'mes 12 asignado = 100.000');

  // ============================================================
  // TEST 2: add-partida — segunda partida (numero debe incrementarse)
  // ============================================================
  console.log('');
  console.log('[2] add-partida — segunda partida (numero se incrementa)');
  var addRes2 = _mockIpcHandlers['presupuesto:add-partida']({}, {
    presupuestoId: presupuestoId,
    concepto: 'Segunda partida',
    asignadoTotal: 0
  });
  _assert(addRes2.success === true, 'add2 OK');
  _assertEq(addRes2.data.partida.numero, 2, 'numero = 2 (auto-increment)');
  _assertEq(addRes2.data.partida.asignado, 0, 'asignado = 0 (default)');

  // ============================================================
  // TEST 3: add-partida — errores
  // ============================================================
  console.log('');
  console.log('[3] add-partida — errores');
  var e1 = _mockIpcHandlers['presupuesto:add-partida']({}, { presupuestoId: presupuestoId, concepto: '' });
  _assert(e1.success === false && e1.error.code === 'INVALID_INPUT', 'concepto vacío → INVALID_INPUT');

  var e2 = _mockIpcHandlers['presupuesto:add-partida']({}, { presupuestoId: 'p-no-existe', concepto: 'X' });
  _assert(e2.success === false && e2.error.code === 'NOT_FOUND', 'presupuestoId inexistente → NOT_FOUND');

  // ============================================================
  // TEST 4: delete-partida — soft delete
  // ============================================================
  console.log('');
  console.log('[4] presupuesto:delete-partida — soft delete');
  var delRes = _mockIpcHandlers['presupuesto:delete-partida']({}, {
    partidaId: addRes2.data.partida.id
  });
  _assert(delRes.success === true, 'delete OK');
  _assertEq(delRes.data.deleted.numero, 2, 'partida #2 eliminada');

  // Verificar: activo=0 en BD
  var partida2After = db.prepare('SELECT activo FROM presupuesto_partidas WHERE id = ?').get(addRes2.data.partida.id);
  _assertEq(partida2After.activo, 0, 'partida tiene activo=0 (soft delete)');

  // Intentar eliminar de nuevo
  var delRes2 = _mockIpcHandlers['presupuesto:delete-partida']({}, {
    partidaId: addRes2.data.partida.id
  });
  _assert(delRes2.success === false && delRes2.error.code === 'ALREADY_DELETED', 'eliminar 2 veces → ALREADY_DELETED');

  // ============================================================
  // TEST 5: set-mes-values — upsert
  // ============================================================
  console.log('');
  console.log('[5] presupuesto:set-mes-values — upsert');
  // La primera partida tiene asignado = 100.000 en mes 1. Actualizamos a 200.000.
  var setRes = _mockIpcHandlers['presupuesto:set-mes-values']({}, {
    partidaId: addRes.data.partida.id,
    anio: 2026,
    mes: 1,
    asignado: 200000,
    ejecutado: 50000
  });
  _assert(setRes.success === true, 'set-mes OK');
  _assertEq(setRes.data.asignado, 200000, 'asignado = 200.000');
  _assertEq(setRes.data.ejecutado, 50000, 'ejecutado = 50.000');

  // Verificar
  var val1 = db.prepare('SELECT * FROM presupuesto_valores_mensuales WHERE partida_id = ? AND mes = 1').get(addRes.data.partida.id);
  _assertEq(val1.asignado, 200000, 'BD mes 1 asignado = 200.000');
  _assertEq(val1.ejecutado, 50000, 'BD mes 1 ejecutado = 50.000');

  // set-mes-values en un mes que no existe → INSERT (upsert)
  var setRes2 = _mockIpcHandlers['presupuesto:set-mes-values']({}, {
    partidaId: addRes.data.partida.id,
    anio: 2027,  // año diferente, no existe
    mes: 5,
    asignado: 999,
    ejecutado: 0
  });
  _assert(setRes2.success === true, 'set-mes en año nuevo OK (INSERT)');
  var valNew = db.prepare('SELECT * FROM presupuesto_valores_mensuales WHERE partida_id = ? AND anio = 2027 AND mes = 5').get(addRes.data.partida.id);
  _assertEq(valNew.asignado, 999, 'nuevo valor creado con asignado=999');

  // ============================================================
  // TEST 6: update-meta
  // ============================================================
  console.log('');
  console.log('[6] presupuesto:update-meta');
  var updRes = _mockIpcHandlers['presupuesto:update-meta']({}, {
    presupuestoId: presupuestoId,
    nombre: 'Presupuesto SG-SST 2026 (Actualizado)'
  });
  _assert(updRes.success === true, 'update-meta OK');
  var presAfter = db.prepare('SELECT nombre, notas FROM presupuestos WHERE id = ?').get(presupuestoId);
  _assertEq(presAfter.nombre, 'Presupuesto SG-SST 2026 (Actualizado)', 'nombre actualizado');
  _assertEq(presAfter.notas, '', 'notas sigue vacío');

  // Update solo notas
  var updRes2 = _mockIpcHandlers['presupuesto:update-meta']({}, {
    presupuestoId: presupuestoId,
    notas: 'Notas de prueba'
  });
  _assert(updRes2.success === true, 'update notas OK');
  presAfter = db.prepare('SELECT nombre, notas FROM presupuestos WHERE id = ?').get(presupuestoId);
  _assertEq(presAfter.nombre, 'Presupuesto SG-SST 2026 (Actualizado)', 'nombre preservado');
  _assertEq(presAfter.notas, 'Notas de prueba', 'notas actualizado');

  // Update vacío (sin cambios)
  var updRes3 = _mockIpcHandlers['presupuesto:update-meta']({}, {
    presupuestoId: presupuestoId
  });
  _assert(updRes3.success === false && updRes3.error.code === 'INVALID_INPUT', 'sin cambios → INVALID_INPUT');

  // ============================================================
  // TEST 7: update-partida sigue como STUB
  // ============================================================
  console.log('');
  console.log('[7] update-partida sigue como stub');
  var stubRes = _mockIpcHandlers['presupuesto:update-partida']({}, { partidaId: 'pp-x' });
  _assert(stubRes.success === false && stubRes.error.code === 'NOT_IMPLEMENTED', 'update-partida = NOT_IMPLEMENTED');

  // ============================================================
  // TEST 8: get-by-empresa-anio refleja los cambios
  // ============================================================
  console.log('');
  console.log('[8] get-by-empresa-anio refleja los cambios');
  var getRes = _mockIpcHandlers['presupuesto:get-by-empresa-anio']({}, {
    companyName: 'Tempoactiva',
    anio: 2026
  });
  _assert(getRes.success === true, 'get OK');
  // Solo debe devolver 1 partida (la 2 fue soft-deleted)
  _assertEq(getRes.data.partidas.length, 1, '1 partida activa (la 2 está soft-deleted)');
  _assert(getRes.data.presupuesto.nombre.indexOf('Actualizado') >= 0, 'nombre actualizado en get');

  // ============================================================
  console.log('');
  console.log('=====================================================================');
  console.log('  Resumen: ' + _passed + ' OK · ' + _failed + ' FAIL');
  console.log('=====================================================================');
  console.log('');

  try { fs.unlinkSync(path.join(__dirname, '__mock_electron.js')); } catch (e) {}
  try { rawDb.close(); } catch (e) {}

  if (_failed === 0) {
    console.log('✅ Todos los tests pasaron. Handlers granulares listos.');
    process.exit(0);
  } else {
    console.error('❌ Hay tests que fallaron.');
    process.exit(1);
  }
}

run().catch(function (err) {
  console.error('ERROR FATAL:', err.message);
  console.error(err.stack);
  process.exit(2);
});
