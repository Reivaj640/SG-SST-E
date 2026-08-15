// =====================================================================
// 📦708 (2026-08-15) — Test unitario del schema + bridge de Presupuesto
// Usa sql.js (SQLite puro JS, sin compilación nativa) para evitar el
// problema de NODE_MODULE_VERSION con better-sqlite3.
//
// Verifica:
//   1. El schema SQL se aplica sin errores
//   2. Las 3 tablas existen con las columnas esperadas
//   3. Los índices se crean correctamente
//   4. Las constraints (UNIQUE, CHECK, FK) funcionan
//   5. Insertar/query básico funciona (smoke test del shape)
//   6. El bridge se registra con la firma correcta (app, deps)
//   7. El handler diag responde con el shape esperado
//
// Uso:  node test-presupuesto-bridge-schema.js
// Salida: OK / FALLO + summary
// =====================================================================

const path = require('path');
const fs = require('fs');
const Module = require('module');

// Mock del módulo 'electron' ANTES de requerir el bridge.
// El bridge hace `const { ipcMain } = require('electron')` al top-level,
// así que sin este mock, fuera de Electron `ipcMain` es undefined.
const _originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === 'electron') {
    return path.join(__dirname, '__mock_electron.js');
  }
  return _originalResolve.call(this, request, parent, ...rest);
};

// Crear un mock de electron/ipcMain que registre los handlers
// en un objeto que el test puede inspeccionar.
const _mockIpcHandlers = {};
const _mockElectron = {
  ipcMain: {
    handle: function (channel, handler) {
      _mockIpcHandlers[channel] = handler;
    }
  },
  app: {
    on: function () {},
    getPath: function () { return path.join(__dirname, '..', 'userData_mock'); }
  }
};
fs.writeFileSync(
  path.join(__dirname, '__mock_electron.js'),
  'module.exports = ' + JSON.stringify({ __isMock: true }) + ';\n' +
  'module.exports.ipcMain = global._mockIpcMain;\n' +
  'module.exports.app = global._mockApp;\n'
);
global._mockIpcMain = _mockElectron.ipcMain;
global._mockApp = _mockElectron.app;

let _passed = 0;
let _failed = 0;

function _assert(condition, message) {
  if (condition) {
    _passed++;
    console.log('  ✓ ' + message);
  } else {
    _failed++;
    console.error('  ✗ ' + message);
  }
}

function _assertEqual(actual, expected, message) {
  var ok = actual === expected;
  if (ok) {
    _passed++;
    console.log('  ✓ ' + message + ' (=' + actual + ')');
  } else {
    _failed++;
    console.error('  ✗ ' + message + ' (esperado=' + expected + ', actual=' + actual + ')');
  }
}

function _assertDeepEqual(actual, expected, message) {
  var aStr = JSON.stringify(actual);
  var eStr = JSON.stringify(expected);
  var ok = aStr === eStr;
  if (ok) {
    _passed++;
    console.log('  ✓ ' + message);
  } else {
    _failed++;
    console.error('  ✗ ' + message);
    console.error('    esperado: ' + eStr);
    console.error('    actual:   ' + aStr);
  }
}

function _tableInfo(db, tableName) {
  var res = db.exec('PRAGMA table_info(' + tableName + ')');
  if (!res || res.length === 0) return [];
  // res[0].columns = ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk']
  // res[0].values = [[...], ...]
  return res[0].values.map(function (row) {
    var obj = {};
    for (var i = 0; i < res[0].columns.length; i++) obj[res[0].columns[i]] = row[i];
    return obj;
  });
}

function _tableExists(db, tableName) {
  var res = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='" + tableName + "'"
  );
  return res && res.length > 0 && res[0].values.length > 0;
}

function _indexExists(db, indexName) {
  var res = db.exec(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='" + indexName + "'"
  );
  return res && res.length > 0 && res[0].values.length > 0;
}

function _tryExec(db, sql) {
  try {
    db.exec(sql);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}

async function run() {
  console.log('');
  console.log('=====================================================================');
  console.log('  📦708 · TEST schema + bridge de Presupuesto SG-SST');
  console.log('=====================================================================');
  console.log('');

  // 0. Cargar sql.js (lazy: solo cuando se necesita, evita costo de inicio en otros tests)
  console.log('[0] Cargando sql.js...');
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({
    locateFile: function (file) { return path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file); }
  });
  _assert(true, 'sql.js cargado');

  // 1. Cargar el bridge
  console.log('');
  console.log('[1] Cargando bridge...');
  var bridge;
  try {
    bridge = require('./presupuesto-bridge');
    _assert(typeof bridge.registerPresupuestoHandlers === 'function', 'registerPresupuestoHandlers exportado');
    _assert(typeof bridge.SCHEMA_SQL === 'string' && bridge.SCHEMA_SQL.length > 0, 'SCHEMA_SQL exportado y no-vacío');
    _assert(Array.isArray(bridge.MIGRATIONS_SQL), 'MIGRATIONS_SQL exportado como array');
  } catch (e) {
    console.error('ERROR cargando bridge:', e.message);
    process.exit(2);
  }

  // 2. Crear DB en memoria y aplicar schema
  console.log('');
  console.log('[2] Aplicando schema en DB en memoria...');
  var db = new SQL.Database();
  var schemaRes = _tryExec(db, bridge.SCHEMA_SQL);
  _assert(schemaRes.ok, schemaRes.ok ? 'Schema aplicado sin errores' : 'Schema aplicado sin errores (error: ' + schemaRes.error.message + ')');
  if (!schemaRes.ok) {
    console.error(schemaRes.error.stack);
    process.exit(1);
  }

  // Habilitar FK (sql.js las tiene OFF por defecto)
  db.exec('PRAGMA foreign_keys = ON;');

  // 3. Verificar que las 3 tablas existen
  console.log('');
  console.log('[3] Verificando existencia de tablas...');
  _assert(_tableExists(db, 'presupuestos'), 'tabla "presupuestos" existe');
  _assert(_tableExists(db, 'presupuesto_partidas'), 'tabla "presupuesto_partidas" existe');
  _assert(_tableExists(db, 'presupuesto_valores_mensuales'), 'tabla "presupuesto_valores_mensuales" existe');

  // 4. Verificar columnas de cada tabla
  console.log('');
  console.log('[4] Verificando columnas...');
  var colsPresupuestos = _tableInfo(db, 'presupuestos').map(function (c) { return c.name; });
  _assertDeepEqual(
    colsPresupuestos,
    ['id', 'empresa_id', 'anio', 'nombre', 'notas', 'creado_en', 'actualizado_en', 'creado_por'],
    'columnas de presupuestos'
  );

  var colsPartidas = _tableInfo(db, 'presupuesto_partidas').map(function (c) { return c.name; });
  _assertDeepEqual(
    colsPartidas,
    ['id', 'presupuesto_id', 'numero', 'concepto', 'descripcion', 'activo', 'creado_en', 'actualizado_en'],
    'columnas de presupuesto_partidas'
  );

  var colsValores = _tableInfo(db, 'presupuesto_valores_mensuales').map(function (c) { return c.name; });
  _assertDeepEqual(
    colsValores,
    ['id', 'partida_id', 'anio', 'mes', 'asignado', 'ejecutado', 'notas', 'actualizado_en'],
    'columnas de presupuesto_valores_mensuales'
  );

  // 5. Verificar índices
  console.log('');
  console.log('[5] Verificando índices...');
  _assert(_indexExists(db, 'idx_presupuestos_empresa'), 'índice idx_presupuestos_empresa existe');
  _assert(_indexExists(db, 'idx_presupuestos_anio'), 'índice idx_presupuestos_anio existe');
  _assert(_indexExists(db, 'idx_partidas_presupuesto'), 'índice idx_partidas_presupuesto existe');
  _assert(_indexExists(db, 'idx_partidas_activo'), 'índice idx_partidas_activo existe');
  _assert(_indexExists(db, 'idx_pvm_partida'), 'índice idx_pvm_partida existe');
  _assert(_indexExists(db, 'idx_pvm_anio_mes'), 'índice idx_pvm_anio_mes existe');

  // 6. Verificar constraints (UNIQUE, CHECK, FK)
  console.log('');
  console.log('[6] Verificando constraints...');

  // Insertar presupuesto
  var r1 = _tryExec(db,
    "INSERT INTO presupuestos (id, empresa_id, anio, nombre, creado_en, actualizado_en) " +
    "VALUES ('p-test-001', 'tempoactiva', 2026, 'Presupuesto 2026 Test', '2026-08-15T00:00:00Z', '2026-08-15T00:00:00Z')"
  );
  _assert(r1.ok, 'INSERT en presupuestos OK');

  // UNIQUE (empresa_id, anio) — debe fallar el 2do insert
  var r2 = _tryExec(db,
    "INSERT INTO presupuestos (id, empresa_id, anio, nombre, creado_en, actualizado_en) " +
    "VALUES ('p-test-002', 'tempoactiva', 2026, 'Duplicado', '2026-08-15T00:00:00Z', '2026-08-15T00:00:00Z')"
  );
  _assert(!r2.ok && /UNIQUE/i.test(r2.error.message), 'UNIQUE(empresa_id, anio) funciona (rechaza duplicado)');

  // Insertar partida
  var r3 = _tryExec(db,
    "INSERT INTO presupuesto_partidas (id, presupuesto_id, numero, concepto, creado_en, actualizado_en) " +
    "VALUES ('pp-test-001', 'p-test-001', 1, 'Honorarios profesionales SST', '2026-08-15T00:00:00Z', '2026-08-15T00:00:00Z')"
  );
  _assert(r3.ok, 'INSERT en presupuesto_partidas OK');

  // UNIQUE (presupuesto_id, numero)
  var r4 = _tryExec(db,
    "INSERT INTO presupuesto_partidas (id, presupuesto_id, numero, concepto, creado_en, actualizado_en) " +
    "VALUES ('pp-test-002', 'p-test-001', 1, 'Duplicado', '2026-08-15T00:00:00Z', '2026-08-15T00:00:00Z')"
  );
  _assert(!r4.ok && /UNIQUE/i.test(r4.error.message), 'UNIQUE(presupuesto_id, numero) funciona');

  // Insertar valor mensual
  var r5 = _tryExec(db,
    "INSERT INTO presupuesto_valores_mensuales (partida_id, anio, mes, asignado, ejecutado, actualizado_en) " +
    "VALUES ('pp-test-001', 2026, 1, 776227, 776227, '2026-08-15T00:00:00Z')"
  );
  _assert(r5.ok, 'INSERT en presupuesto_valores_mensuales OK');

  // CHECK (mes BETWEEN 1 AND 12) — debe rechazar mes=13
  var r6 = _tryExec(db,
    "INSERT INTO presupuesto_valores_mensuales (partida_id, anio, mes, asignado, ejecutado, actualizado_en) " +
    "VALUES ('pp-test-001', 2026, 13, 0, 0, '2026-08-15T00:00:00Z')"
  );
  _assert(!r6.ok && /CHECK/i.test(r6.error.message), 'CHECK(mes BETWEEN 1 AND 12) funciona (rechaza mes=13)');

  // FOREIGN KEY (partida_id → partidas.id) con ON DELETE CASCADE
  _tryExec(db,
    "INSERT INTO presupuesto_valores_mensuales (partida_id, anio, mes, asignado, ejecutado, actualizado_en) " +
    "VALUES ('pp-test-001', 2026, 2, 776227, 0, '2026-08-15T00:00:00Z')"
  );
  _tryExec(db, "DELETE FROM presupuesto_partidas WHERE id = 'pp-test-001'");
  var remainingRes = db.exec("SELECT COUNT(*) AS c FROM presupuesto_valores_mensuales WHERE partida_id = 'pp-test-001'");
  var remainingVals = remainingRes && remainingRes.length > 0 ? remainingRes[0].values[0][0] : -1;
  _assertEqual(remainingVals, 0, 'FK ON DELETE CASCADE funciona (borrar partida borra sus valores)');

  // 7. Test del bridge — registro con la firma (app, deps)
  console.log('');
  console.log('[7] Verificando registro del bridge con firma (app, deps)...');

  // Los handlers se registran en _mockIpcHandlers (vía Module._resolveFilename mock)
  var registeredHandlers = _mockIpcHandlers;

  // Mock getDb y validateSession como funciones válidas
  var mockGetDb = function () { return db; };
  var mockValidateSession = function (token) {
    if (token === 'valid-token') {
      return { ok: true, user: { id: 1, isAdmin: true } };
    }
    return { ok: false, error: { code: 'AUTH_REQUIRED', message: 'Token inválido' } };
  };

  // Ejecutar el registro
  try {
    bridge.registerPresupuestoHandlers(_mockElectron.app, { getDb: mockGetDb, validateSession: mockValidateSession });
    _assert(true, 'registerPresupuestoHandlers(app, deps) no lanzó error');
  } catch (e) {
    _assert(false, 'registerPresupuestoHandlers(app, deps) no lanzó error (error: ' + e.message + ')');
  }

  // Verificar que se registraron los 15 canales (14 + diag)
  var expectedChannels = [
    'presupuesto:list-by-empresa',
    'presupuesto:get',
    'presupuesto:get-by-empresa-anio',
    'presupuesto:calcular-resumen',
    'presupuesto:create',
    'presupuesto:update-meta',
    'presupuesto:add-partida',
    'presupuesto:update-partida',
    'presupuesto:delete-partida',
    'presupuesto:set-mes-values',
    'presupuesto:bulk-save',
    'presupuesto:import-from-excel',
    'presupuesto:export-excel',
    'presupuesto:export-template',
    'presupuesto:diag'
  ];
  _assertEqual(Object.keys(registeredHandlers).length, expectedChannels.length, 'cantidad de handlers registrados');
  for (var i = 0; i < expectedChannels.length; i++) {
    _assert(typeof registeredHandlers[expectedChannels[i]] === 'function', 'handler "' + expectedChannels[i] + '" registrado');
  }

  // 8. Test del handler diag
  console.log('');
  console.log('[8] Testeando handler diag...');
  var diagResult = registeredHandlers['presupuesto:diag']({}, {});
  _assert(diagResult.success === true, 'diag.success = true');
  _assert(diagResult.data.bridge === 'presupuesto-bridge', 'diag.data.bridge correcto');
  // Fase 0+1: el bridge ya implementó handlers de lectura (Fase 1). El test del
  // schema verifica la infra básica; el shape concreto de cada fase se valida
  // en test-presupuesto-bridge-read.js.
  _assert(diagResult.data.phase === 0 || diagResult.data.phase === 1, 'diag.data.phase es 0 o 1 (actual=' + diagResult.data.phase + ')');
  _assertEqual(diagResult.data.has_getDb, true, 'diag.data.has_getDb = true');
  _assertEqual(diagResult.data.has_validateSession, true, 'diag.data.has_validateSession = true');

  // El diag usa la API de better-sqlite3 (`db.prepare(...).all()`).
  // sql.js no tiene esa API exacta, así que las verificaciones de tables/schema_applied
  // se testean en Electron real (donde corre better-sqlite3). Aquí solo validamos
  // que el handler responde sin error y los flags booleanos básicos.
  var isBetterSqlite = (typeof db.prepare === 'function' && typeof db.exec !== 'function');
  if (isBetterSqlite) {
    _assertEqual(diagResult.data.schema_applied, true, 'diag.data.schema_applied = true');
    _assertEqual(diagResult.data.tables.length, 3, 'diag.data.tables tiene 3 entradas');
  } else {
    console.log('  ⊘ diag.data.schema_applied (skipped: sql.js no soporta better-sqlite3 API, se testea en Electron)');
    console.log('  ⊘ diag.data.tables.length (skipped: sql.js no soporta better-sqlite3 API, se testea en Electron)');
  }

  // 9. Test de un handler real (presupuesto:update-meta → INVALID_INPUT, Fase 3.5)
  //    En Fase 3.5 implementamos update-meta (nombre/notas).
  //    Sin presupuestoId debe retornar INVALID_INPUT.
  console.log('');
  console.log('[9] Testeando handler update-meta (Fase 3.5 → INVALID_INPUT si no hay presupuestoId)...');
  var stubResult = registeredHandlers['presupuesto:update-meta']({}, { token: 'valid-token' });
  _assert(stubResult.success === false, 'update-meta sin payload retorna success=false');
  _assertEqual(stubResult.error.code, 'INVALID_INPUT', 'update-meta sin presupuestoId → INVALID_INPUT');

  // Cleanup del mock
  try { fs.unlinkSync(path.join(__dirname, '__mock_electron.js')); } catch (e) {}

  // 10. Resumen
  console.log('');
  console.log('=====================================================================');
  console.log('  Resumen: ' + _passed + ' OK · ' + _failed + ' FAIL');
  console.log('=====================================================================');
  console.log('');

  // Cleanup explícito para evitar el race condition de libuv al cerrar
  // (sql.js emite un "Assertion failed" en stderr al exit, no es un test
  // fallido pero contamina el exit code). Cerramos DB y forzamos exit.
  try { db.close(); } catch (e) {}

  if (_failed === 0) {
    console.log('✅ Todos los tests pasaron. El bridge está listo para Fase 0.');
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
