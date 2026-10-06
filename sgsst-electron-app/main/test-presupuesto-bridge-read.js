// =====================================================================
// 📦708 (2026-08-15) — Test de los handlers de LECTURA (Fase 1)
// Inserta datos realistas (1 presupuesto, 3 partidas, 36 valores mensuales)
// y verifica que los 4 handlers de lectura devuelven el shape correcto.
//
// Datos de prueba basados en Tempoactiva 2026 (reales del Excel):
//   - Presupuesto 2026
//   - Partida 1: Honorarios profesionales SST (asignado: 9.314.724, ejecutado: 6.209.816)
//   - Partida 2: Compra de EPPs (asignado: 0)
//   - Partida 3: Capacitaciones (asignado: 240.000)
//
// Uso:  node test-presupuesto-bridge-read.js
// =====================================================================

const path = require('path');
const fs = require('fs');
const Module = require('module');

// ---------- Mock del módulo 'electron' (mismo patrón que el otro test) ----------
const _originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === 'electron') {
    return path.join(__dirname, '__mock_electron.js');
  }
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

let _passed = 0;
let _failed = 0;

function _ok(message) { _passed++; console.log('  ✓ ' + message); }
function _fail(message) { _failed++; console.error('  ✗ ' + message); }
function _assert(cond, msg) { cond ? _ok(msg) : _fail(msg); }
function _assertEq(actual, expected, msg) {
  if (actual === expected) _ok(msg + ' (=' + actual + ')');
  else _fail(msg + ' (esperado=' + expected + ', actual=' + actual + ')');
}
function _assertApprox(actual, expected, tolerance, msg) {
  if (Math.abs(actual - expected) <= tolerance) {
    _ok(msg + ' (' + actual + ' ≈ ' + expected + ' ±' + tolerance + ')');
  } else {
    _fail(msg + ' (esperado≈' + expected + ' ±' + tolerance + ', actual=' + actual + ')');
  }
}
function _assertDeepEq(actual, expected, msg) {
  var a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) _ok(msg);
  else { _fail(msg); console.error('    esperado: ' + e); console.error('    actual:   ' + a); }
}

function _seedData(db) {
  // Crear empresa "tempoactiva" en la tabla companies (FK lógica)
  db.exec("INSERT INTO companies (id, company_key, display_name) VALUES (1, 'tempoactiva', 'Tempoactiva')");
  // Crear presupuesto
  db.exec(
    "INSERT INTO presupuestos (id, empresa_id, anio, nombre, notas, creado_en, actualizado_en, creado_por) " +
    "VALUES ('p-test-2026', 'tempoactiva', 2026, 'Presupuesto SG-SST 2026', 'Datos de prueba', " +
    "'2026-08-15T00:00:00Z', '2026-08-15T00:00:00Z', 1)"
  );
  // Crear 3 partidas
  var partidas = [
    { id: 'pp-001', num: 1, concepto: 'Honorarios por los servicios del Profesional de Seguridad y Salud en el Trabajo' },
    { id: 'pp-002', num: 2, concepto: 'Compra de Elementos de protección personal' },
    { id: 'pp-003', num: 3, concepto: 'Realización de Capacitaciones' }
  ];
  partidas.forEach(function (p) {
    db.exec(
      "INSERT INTO presupuesto_partidas (id, presupuesto_id, numero, concepto, descripcion, activo, creado_en, actualizado_en) " +
      "VALUES ('" + p.id + "', 'p-test-2026', " + p.num + ", '" + p.concepto + "', '', 1, " +
      "'2026-08-15T00:00:00Z', '2026-08-15T00:00:00Z')"
    );
  });

  // Valores mensuales — basados en datos reales
  // Partida 1 (Honorarios): 776.227/mes × 8 meses ya ejecutados = 6.209.816
  for (var mes = 1; mes <= 12; mes++) {
    var asignado = 776227;
    var ejecutado = mes <= 8 ? 776227 : 0;
    db.exec(
      "INSERT INTO presupuesto_valores_mensuales (partida_id, anio, mes, asignado, ejecutado, notas, actualizado_en) " +
      "VALUES ('pp-001', 2026, " + mes + ", " + asignado + ", " + ejecutado + ", '', '2026-08-15T00:00:00Z')"
    );
  }
  // Partida 2 (EPPs): todo en 0
  for (var mes2 = 1; mes2 <= 12; mes2++) {
    db.exec(
      "INSERT INTO presupuesto_valores_mensuales (partida_id, anio, mes, asignado, ejecutado, notas, actualizado_en) " +
      "VALUES ('pp-002', 2026, " + mes2 + ", 0, 0, '', '2026-08-15T00:00:00Z')"
    );
  }
  // Partida 3 (Capacitaciones): 240.000 en mes 3, 0 el resto
  for (var mes3 = 1; mes3 <= 12; mes3++) {
    var asig3 = 0, ejec3 = 0;
    if (mes3 === 3) { asig3 = 240000; ejec3 = 240000; }
    db.exec(
      "INSERT INTO presupuesto_valores_mensuales (partida_id, anio, mes, asignado, ejecutado, notas, actualizado_en) " +
      "VALUES ('pp-003', 2026, " + mes3 + ", " + asig3 + ", " + ejec3 + ", '', '2026-08-15T00:00:00Z')"
    );
  }
}

// ---------- Wrapper que imita la API de better-sqlite3 sobre sql.js ----------
// El bridge usa better-sqlite3 (que es la lib de producción en Electron).
// El test usa sql.js porque better-sqlite3 tiene un NODE_MODULE_VERSION
// mismatch en este ambiente. Este wrapper expone `prepare().get()` y
// `prepare().all()` sobre sql.js para que el test funcione idéntico a
// como funcionaría en producción.
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
          } finally {
            stmt.reset();
            stmt.free();
          }
        },
        all: function () {
          var args = Array.prototype.slice.call(arguments);
          var stmt = sqlJsDb.prepare(sql);
          try {
            if (args.length > 0) stmt.bind(args);
            var rows = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            return rows;
          } finally {
            stmt.reset();
            stmt.free();
          }
        },
        run: function () {
          var args = Array.prototype.slice.call(arguments);
          var stmt = sqlJsDb.prepare(sql);
          try {
            if (args.length > 0) stmt.bind(args);
            stmt.step();
          } finally {
            stmt.reset();
            stmt.free();
          }
        }
      };
    },
    close: function () { sqlJsDb.close(); }
  };
}

async function run() {
  console.log('');
  console.log('=====================================================================');
  console.log('  📦708 · TEST handlers de LECTURA (Fase 1)');
  console.log('=====================================================================');
  console.log('');

  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({
    locateFile: function (file) { return path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file); }
  });
  _ok('sql.js cargado');

  // Cargar bridge
  var bridge = require('./presupuesto-bridge');
  _assert(typeof bridge.registerPresupuestoHandlers === 'function', 'bridge cargado');

  // Crear DB en memoria, aplicar schema + seed
  var rawDb = new SQL.Database();
  rawDb.exec('PRAGMA foreign_keys = ON;');
  rawDb.exec(bridge.SCHEMA_SQL);
  // Schema de companies (necesario para _getCompanyByName)
  rawDb.exec("CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY AUTOINCREMENT, company_key TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL)");
  _seedData(rawDb);

  // Wrappear para que el bridge pueda usar `prepare().get()` / `.all()`
  // como si fuera better-sqlite3 (que es la lib de producción)
  var db = _wrapSqlJsAsBetterSqlite(rawDb);
  _ok('DB sembrada con 1 empresa + 1 presupuesto + 3 partidas + 36 valores (wrapped as better-sqlite3 API)');

  // Registrar el bridge
  var mockGetDb = function () { return db; };
  var mockValidateSession = function (token) {
    if (token === 'valid-token') return { ok: true, user: { id: 1, isAdmin: true } };
    return { ok: false, error: { code: 'AUTH_REQUIRED', message: 'Token inválido' } };
  };
  bridge.registerPresupuestoHandlers(_mockElectron.app, { getDb: mockGetDb, validateSession: mockValidateSession });
  _ok('Bridge registrado');

  // ============================================================
  // TEST 1: presupuesto:list-by-empresa
  // ============================================================
  console.log('');
  console.log('[1] presupuesto:list-by-empresa');

  // 1a) Sin token (Fase 2: soft auth — procede con user=null)
  var r1a = _mockIpcHandlers['presupuesto:list-by-empresa']({}, { companyName: 'Tempoactiva' });
  _assert(r1a.success === true, 'sin token procede con soft auth (Fase 2)');

  // 1b) Empresa inexistente
  var r1b = _mockIpcHandlers['presupuesto:list-by-empresa']({}, { token: 'valid-token', companyName: 'NoExiste' });
  _assert(r1b.success === false && r1b.error.code === 'COMPANY_NOT_FOUND', 'rechaza empresa inexistente');

  // 1c) Caso OK
  var r1c = _mockIpcHandlers['presupuesto:list-by-empresa']({}, { token: 'valid-token', companyName: 'Tempoactiva' });
  _assert(r1c.success === true, 'caso OK retorna success');
  _assertEq(r1c.data.presupuestos.length, 1, '1 presupuesto para Tempoactiva');
  var p1 = r1c.data.presupuestos[0];
  _assertEq(p1.anio, 2026, 'año = 2026');
  _assertEq(p1.nombre, 'Presupuesto SG-SST 2026', 'nombre correcto');
  _assertEq(p1.partidasCount, 3, 'partidasCount = 3');
  // Totales: 9.314.724 (partida 1) + 0 (partida 2) + 240.000 (partida 3) = 9.554.724
  _assertEq(p1.totalAsignado, 9554724, 'totalAsignado = 9.554.724');
  // Ejecutado: 6.209.816 (partida 1) + 0 (partida 2) + 240.000 (partida 3) = 6.449.816
  _assertEq(p1.totalEjecutado, 6449816, 'totalEjecutado = 6.449.816');
  // Porcentaje: 6.449.816 / 9.554.724 * 100 ≈ 67.50%
  _assertApprox(p1.porcentaje, 67.50, 0.05, 'porcentaje ≈ 67.50%');
  _assertEq(r1c.data.company.displayName, 'Tempoactiva', 'company.displayName correcto');

  // 1d) Case-insensitive
  var r1d = _mockIpcHandlers['presupuesto:list-by-empresa']({}, { token: 'valid-token', companyName: 'tempoactiva' });
  _assert(r1d.success === true, 'case-insensitive funciona');

  // ============================================================
  // TEST 2: presupuesto:get
  // ============================================================
  console.log('');
  console.log('[2] presupuesto:get');

  // 2a) presupuestoId inexistente
  var r2a = _mockIpcHandlers['presupuesto:get']({}, { token: 'valid-token', presupuestoId: 'p-no-existe' });
  _assert(r2a.success === false && r2a.error.code === 'NOT_FOUND', 'rechaza presupuestoId inexistente');

  // 2b) Caso OK
  var r2b = _mockIpcHandlers['presupuesto:get']({}, { token: 'valid-token', presupuestoId: 'p-test-2026' });
  _assert(r2b.success === true, 'caso OK retorna success');
  _assertEq(r2b.data.presupuesto.anio, 2026, 'año correcto');
  _assertEq(r2b.data.partidas.length, 3, '3 partidas');
  _assert(r2b.data.resumen && typeof r2b.data.resumen.totalAsignado === 'number', 'resumen presente');

  // Verificar shape de la primera partida
  var pa1 = r2b.data.partidas[0];
  _assertEq(pa1.numero, 1, 'partida 1 numero = 1');
  _assertEq(pa1.valores.length, 12, 'partida 1 tiene 12 valores mensuales');
  _assertEq(pa1.valores[0].mes, 1, 'primer mes = 1');
  _assertEq(pa1.valores[11].mes, 12, 'último mes = 12');
  _assertEq(pa1.asignado, 9314724, 'partida 1 asignado total = 9.314.724');
  _assertEq(pa1.ejecutado, 6209816, 'partida 1 ejecutado total = 6.209.816');
  _assertApprox(pa1.porcentaje, 66.67, 0.05, 'partida 1 % ≈ 66.67%');

  // Verificar shape de la segunda partida (todo en 0)
  var pa2 = r2b.data.partidas[1];
  _assertEq(pa2.asignado, 0, 'partida 2 asignado = 0');
  _assertEq(pa2.ejecutado, 0, 'partida 2 ejecutado = 0');
  _assertEq(pa2.porcentaje, 0, 'partida 2 % = 0 (no división por cero)');

  // Verificar shape de la tercera partida
  var pa3 = r2b.data.partidas[2];
  _assertEq(pa3.asignado, 240000, 'partida 3 asignado = 240.000');
  _assertEq(pa3.ejecutado, 240000, 'partida 3 ejecutado = 240.000');
  _assertEq(pa3.porcentaje, 100, 'partida 3 % = 100');

  // ============================================================
  // TEST 3: presupuesto:get-by-empresa-anio
  // ============================================================
  console.log('');
  console.log('[3] presupuesto:get-by-empresa-anio');

  // 3a) Año sin datos
  var r3a = _mockIpcHandlers['presupuesto:get-by-empresa-anio']({}, { token: 'valid-token', companyName: 'Tempoactiva', anio: 2027 });
  _assert(r3a.success === true, 'año sin datos NO es error, retorna success');
  _assert(r3a.data.presupuesto === null, 'presupuesto = null para año 2027');
  _assertEq(r3a.data.partidas.length, 0, '0 partidas para año 2027');
  _assertEq(r3a.data.anio, 2027, 'anio echo = 2027');

  // 3b) Año inválido
  var r3b = _mockIpcHandlers['presupuesto:get-by-empresa-anio']({}, { token: 'valid-token', companyName: 'Tempoactiva', anio: 1999 });
  _assert(r3b.success === false && r3b.error.code === 'INVALID_INPUT', 'rechaza año fuera de rango');

  // 3c) Caso OK
  var r3c = _mockIpcHandlers['presupuesto:get-by-empresa-anio']({}, { token: 'valid-token', companyName: 'Tempoactiva', anio: 2026 });
  _assert(r3c.success === true, 'caso OK retorna success');
  _assert(r3c.data.presupuesto !== null, 'presupuesto presente para 2026');
  _assertEq(r3c.data.presupuesto.anio, 2026, 'año correcto');
  _assertEq(r3c.data.partidas.length, 3, '3 partidas para 2026');
  _assertEq(r3c.data.resumen.totalAsignado, 9554724, 'resumen.totalAsignado correcto');

  // 3d) mensuales: shape
  _assertEq(r3c.data.resumen.mensual.asignado.length, 12, 'mensual.asignado tiene 12 elementos');
  _assertEq(r3c.data.resumen.mensual.ejecutado[0], 776227, 'mes 1 ejecutado = 776.227 (solo partida 1)');
  _assertEq(r3c.data.resumen.mensual.ejecutado[2], 1016227, 'mes 3 ejecutado = 1.016.227 (776.227 partida 1 + 240.000 partida 3)');

  // ============================================================
  // TEST 4: presupuesto:calcular-resumen
  // ============================================================
  console.log('');
  console.log('[4] presupuesto:calcular-resumen');

  var r4 = _mockIpcHandlers['presupuesto:calcular-resumen']({}, { token: 'valid-token', presupuestoId: 'p-test-2026' });
  _assert(r4.success === true, 'caso OK retorna success');
  _assertEq(r4.data.resumen.totalAsignado, 9554724, 'resumen totalAsignado correcto');
  _assertEq(r4.data.resumen.totalEjecutado, 6449816, 'resumen totalEjecutado correcto');
  _assertEq(r4.data.resumen.saldo, 3104908, 'resumen saldo correcto (9.554.724 - 6.449.816)');
  _assertEq(r4.data.partidasCount, 3, 'partidasCount correcto');

  // ============================================================
  // TEST 5: handlers de ESCRITURA siguen como STUB (Fases futuras)
  //   - presupuesto:import-from-excel (Fase 4) — implementado
  //   - presupuesto:create + bulk-save (Fase 3) — implementado
  //   - presupuesto:export-excel (Fase 5) — implementado
  //   - presupuesto:add-partida + delete-partida + set-mes-values + update-meta (Fase 3.5) — implementado
  //   - presupuesto:update-partida — sigue como stub (bulk-save cubre la edición)
  //   - presupuesto:export-template — sigue como stub (Fase 7)
  // ============================================================
  console.log('');
  console.log('[5] Verificando que handlers de escritura granulares siguen como stub');

  var writeHandlers = [
    'presupuesto:update-partida',
    'presupuesto:export-template'
  ];
  writeHandlers.forEach(function (ch) {
    var res = _mockIpcHandlers[ch]({}, { token: 'valid-token' });
    _assert(res.success === false && res.error.code === 'NOT_IMPLEMENTED' && res.error.extra.phase === 1,
      ch + ' sigue como stub (NOT_IMPLEMENTED, phase 1)');
  });

  // ============================================================
  // TEST 6: diag refleja Fase 1
  // ============================================================
  console.log('');
  console.log('[6] Handler diag refleja Fase 1');
  var r6 = _mockIpcHandlers['presupuesto:diag']({}, {});
  _assertEq(r6.data.phase, 1, 'phase = 1');
  _assert(r6.data.message.indexOf('Fase 1') >= 0, 'mensaje menciona Fase 1');
  _assert(r6.data.counts && r6.data.counts.presupuestos >= 1, 'counts.presupuestos >= 1');

  // ============================================================
  // Resumen
  // ============================================================
  console.log('');
  console.log('=====================================================================');
  console.log('  Resumen: ' + _passed + ' OK · ' + _failed + ' FAIL');
  console.log('=====================================================================');
  console.log('');

  try { fs.unlinkSync(path.join(__dirname, '__mock_electron.js')); } catch (e) {}
  try { rawDb.close(); } catch (e) {}

  if (_failed === 0) {
    console.log('✅ Todos los tests pasaron. Handlers de lectura listos para Fase 1.');
    process.exit(0);
  } else {
    console.error('❌ Hay tests que fallaron. Revisar antes de continuar.');
    process.exit(1);
  }
}

run().catch(function (err) {
  console.error('ERROR FATAL:', err.message);
  console.error(err.stack);
  process.exit(2);
});
