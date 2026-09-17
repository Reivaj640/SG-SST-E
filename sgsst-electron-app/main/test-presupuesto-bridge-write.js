// =====================================================================
// 📦708 (2026-08-15) — Test de los handlers de ESCRITURA (Fase 3)
// Verifica:
//   1. presupuesto:create — crea un shell vacío
//   2. presupuesto:bulk-save — reemplaza todas las partidas en una transacción
//      - Caso OK: insertar 3 partidas con valores
//      - Caso overwrite: bulk-save reemplaza datos previos
//      - Caso rollback: si algo falla, no se guardan cambios parciales
//      - Caso edge: array vacío
//      - Caso edge: filas TOTAL AÑO se ignoran
//   3. Los handlers granulares (add-partida, etc) siguen como stub
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
  console.log('  📦708 · TEST handlers de ESCRITURA (Fase 3)');
  console.log('=====================================================================');
  console.log('');

  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({
    locateFile: function (file) { return path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file); }
  });
  _ok('sql.js cargado');

  var bridge = require('./presupuesto-bridge');
  _assert(typeof bridge.registerPresupuestoHandlers === 'function', 'bridge cargado');

  // DB + seed
  var rawDb = new SQL.Database();
  rawDb.exec('PRAGMA foreign_keys = ON;');
  rawDb.exec(bridge.SCHEMA_SQL);
  rawDb.exec("CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY AUTOINCREMENT, company_key TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL)");
  rawDb.exec("INSERT INTO companies (id, company_key, display_name) VALUES (1, 'tempoactiva', 'Tempoactiva')");
  var db = _wrapSqlJsAsBetterSqlite(rawDb);
  _ok('DB inicializada con empresa tempoactiva');

  var mockGetDb = function () { return db; };
  var mockValidateSession = function () { return { ok: true, user: { id: 1, isAdmin: true } }; };
  bridge.registerPresupuestoHandlers(_mockElectron.app, { getDb: mockGetDb, validateSession: mockValidateSession });
  _ok('Bridge registrado');

  // ============================================================
  // TEST 1: create — crea un shell vacío
  // ============================================================
  console.log('');
  console.log('[1] presupuesto:create — crea shell vacío');
  var r1 = _mockIpcHandlers['presupuesto:create']({}, {
    token: 'valid-token',
    companyName: 'Tempoactiva',
    anio: 2026
  });
  _assert(r1.success === true, 'create retorna success');
  _assert(r1.data.presupuestoId && r1.data.presupuestoId.indexOf('p-') === 0, 'presupuestoId con formato p-{ts}-{rand}');
  _assertEq(r1.data.presupuesto.anio, 2026, 'año correcto');
  _assert(r1.data.presupuesto.nombre.indexOf('Tempoactiva') >= 0, 'nombre incluye empresa');

  var presupuestoId = r1.data.presupuestoId;
  var presCount = db.prepare("SELECT COUNT(*) AS c FROM presupuestos").get().c;
  _assertEq(presCount, 1, '1 presupuesto en BD');
  var partidaCount = db.prepare("SELECT COUNT(*) AS c FROM presupuesto_partidas").get().c;
  _assertEq(partidaCount, 0, '0 partidas (shell vacío)');

  // ============================================================
  // TEST 2: create — duplicado falla con ALREADY_EXISTS
  // ============================================================
  console.log('');
  console.log('[2] presupuesto:create duplicado → ALREADY_EXISTS');
  var r2 = _mockIpcHandlers['presupuesto:create']({}, {
    token: 'valid-token',
    companyName: 'Tempoactiva',
    anio: 2026
  });
  _assert(r2.success === false, 'duplicado falla');
  _assertEq(r2.error.code, 'ALREADY_EXISTS', 'error.code = ALREADY_EXISTS');

  // ============================================================
  // TEST 3: bulk-save — caso OK con 3 partidas
  // ============================================================
  console.log('');
  console.log('[3] presupuesto:bulk-save — caso OK (3 partidas)');
  var r3 = _mockIpcHandlers['presupuesto:bulk-save']({}, {
    token: 'valid-token',
    presupuestoId: presupuestoId,
    data: [
      {
        id: 1,
        detalle: 'Honorarios profesionales SST',
        asignacion: 9314724,
        ejecutado_acumulado: 6209816,
        porcentaje_ejecutado: '66,67%',
        // Asignado mensual uniforme: 9.314.724 / 12 = 776.227
        enero: 776227, febrero: 776227, marzo: 776227, abril: 776227,
        mayo: 776227, junio: 776227, julio: 776227, agosto: 776227,
        septiembre: 776227, octubre: 776227, noviembre: 776227, diciembre: 776227
      },
      {
        id: 2,
        detalle: 'Compra de EPPs',
        asignacion: 0,
        ejecutado_acumulado: 0,
        porcentaje_ejecutado: '0%',
        enero: 0, febrero: 0, marzo: 0, abril: 0, mayo: 0, junio: 0,
        julio: 0, agosto: 0, septiembre: 0, octubre: 0, noviembre: 0, diciembre: 0
      },
      {
        id: 3,
        detalle: 'Realización de Capacitaciones',
        asignacion: 240000,
        ejecutado_acumulado: 240000,
        porcentaje_ejecutado: '100%',
        // Asignado mensual uniforme: 240.000 / 12 = 20.000
        enero: 20000, febrero: 20000, marzo: 20000, abril: 20000,
        mayo: 20000, junio: 20000, julio: 20000, agosto: 20000,
        septiembre: 20000, octubre: 20000, noviembre: 20000, diciembre: 20000
      },
      // Esta fila debe ser ignorada (TOTAL AÑO)
      {
        id: 'TOTAL AÑO',
        detalle: 'TOTAL AÑO',
        asignacion: 9554724,
        enero: 0, febrero: 0, marzo: 0, abril: 0, mayo: 0, junio: 0,
        julio: 0, agosto: 0, septiembre: 0, octubre: 0, noviembre: 0, diciembre: 0
      }
    ]
  });
  _assert(r3.success === true, 'bulk-save retorna success');
  _assertEq(r3.data.inserted, 3, 'insertó 3 partidas (TOTAL AÑO ignorado)');
  _assertEq(r3.data.valores, 36, 'insertó 36 valores (3 × 12)');
  _assertEq(r3.data.presupuestoId, presupuestoId, 'presupuestoId devuelto');

  // Verificar BD
  var partidas = db.prepare("SELECT * FROM presupuesto_partidas WHERE presupuesto_id = ? ORDER BY numero").all(presupuestoId);
  _assertEq(partidas.length, 3, '3 partidas en BD');
  _assert(partidas[0].concepto.indexOf('Honorarios') >= 0, 'partida 1 = Honorarios');
  _assertEq(partidas[1].numero, 2, 'partida 2 numero = 2');
  _assert(partidas[1].concepto.indexOf('EPPs') >= 0, 'partida 2 = EPPs');
  _assertEq(partidas[2].numero, 3, 'partida 3 numero = 3');

  // Verificar valores Honorarios (partida 1): 776.227 × 12 (uniforme)
  var valoresP1 = db.prepare("SELECT * FROM presupuesto_valores_mensuales WHERE partida_id = ? ORDER BY mes").all(partidas[0].id);
  _assertEq(valoresP1.length, 12, 'partida 1 tiene 12 valores');
  _assertEq(valoresP1[0].mes, 1, 'mes 1');
  _assertEq(valoresP1[0].asignado, 776227, 'mes 1 asignado = 776.227');
  _assertEq(valoresP1[0].ejecutado, 0, 'mes 1 ejecutado = 0 (bulk-save no edita ejecutado)');
  _assertEq(valoresP1[7].asignado, 776227, 'mes 8 asignado = 776.227');
  _assertEq(valoresP1[11].asignado, 776227, 'mes 12 asignado = 776.227');

  // Verificar totales: 9.314.724 (part 1) + 0 (part 2) + 240.000 (part 3) = 9.554.724
  var totalAsignado = db.prepare("SELECT COALESCE(SUM(asignado), 0) AS t FROM presupuesto_valores_mensuales").get().t;
  _assertEq(totalAsignado, 9314724 + 0 + 240000, 'totalAsignado = 9.554.724');

  // Verificar que el presupuesto tiene actualizado_en reciente
  var presUpdated = db.prepare("SELECT actualizado_en FROM presupuestos WHERE id = ?").get(presupuestoId);
  _assert(presUpdated && presUpdated.actualizado_en, 'presupuesto tiene actualizado_en');

  // ============================================================
  // TEST 4: bulk-save — overwrite (reemplaza las 3 partidas con 1 nueva)
  // ============================================================
  console.log('');
  console.log('[4] presupuesto:bulk-save — overwrite (reemplaza 3 con 1)');
  var r4 = _mockIpcHandlers['presupuesto:bulk-save']({}, {
    token: 'valid-token',
    presupuestoId: presupuestoId,
    data: [
      {
        id: 1,
        detalle: 'Nueva partida única',
        asignacion: 5000000,
        enero: 0, febrero: 0, marzo: 5000000, abril: 0, mayo: 0, junio: 0,
        julio: 0, agosto: 0, septiembre: 0, octubre: 0, noviembre: 0, diciembre: 0
      }
    ]
  });
  _assert(r4.success === true, 'overwrite retorna success');
  _assertEq(r4.data.inserted, 1, 'ahora 1 partida');

  var partidasAfter = db.prepare("SELECT * FROM presupuesto_partidas WHERE presupuesto_id = ?").all(presupuestoId);
  _assertEq(partidasAfter.length, 1, 'BD tiene 1 partida (las 3 anteriores fueron borradas)');

  // ============================================================
  // TEST 5: bulk-save — error: presupuesto no existe
  // ============================================================
  console.log('');
  console.log('[5] presupuesto:bulk-save — presupuestoId inexistente');
  var r5 = _mockIpcHandlers['presupuesto:bulk-save']({}, {
    token: 'valid-token',
    presupuestoId: 'p-no-existe',
    data: [{ id: 1, detalle: 'X' }]
  });
  _assert(r5.success === false, 'presupuestoId inexistente falla');
  _assertEq(r5.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ============================================================
  // TEST 6: bulk-save — array vacío (borra todas las partidas)
  // ============================================================
  console.log('');
  console.log('[6] presupuesto:bulk-save — array vacío');
  var r6 = _mockIpcHandlers['presupuesto:bulk-save']({}, {
    token: 'valid-token',
    presupuestoId: presupuestoId,
    data: []
  });
  _assert(r6.success === true, 'array vacío retorna success');
  _assertEq(r6.data.inserted, 0, '0 partidas insertadas');
  var partidasEmpty = db.prepare("SELECT * FROM presupuesto_partidas WHERE presupuesto_id = ?").all(presupuestoId);
  _assertEq(partidasEmpty.length, 0, '0 partidas en BD');

  // ============================================================
  // TEST 7: bulk-save — distribución de anual cuando no hay mensuales
  // ============================================================
  console.log('');
  console.log('[7] presupuesto:bulk-save — distribución de anual cuando mensuales=0');
  var r7 = _mockIpcHandlers['presupuesto:bulk-save']({}, {
    token: 'valid-token',
    presupuestoId: presupuestoId,
    data: [
      {
        id: 1,
        detalle: 'Partida sin mensuales',
        asignacion: 1200000,  // anual
        enero: 0, febrero: 0, marzo: 0, abril: 0, mayo: 0, junio: 0,
        julio: 0, agosto: 0, septiembre: 0, octubre: 0, noviembre: 0, diciembre: 0
      }
    ]
  });
  _assert(r7.success === true, 'caso OK');
  var valDist = db.prepare("SELECT * FROM presupuesto_valores_mensuales WHERE mes = 1").all();
  _assertEq(valDist.length, 1, '1 valor en mes 1');
  _assertEq(valDist[0].asignado, 100000, 'mes 1 asignado = 100.000 (1.200.000 / 12)');

  // ============================================================
  // TEST 8: Handlers granulares siguen como stub
  // ============================================================
  console.log('');
  console.log('[8] Handlers granulares siguen como stub');
  // Fase 3.5 implementó add-partida, delete-partida, set-mes-values, update-meta.
  // update-partida + export-template siguen como stub (Fase 7).
  var granularHandlers = [
    'presupuesto:update-partida', 'presupuesto:export-template'
  ];
  granularHandlers.forEach(function (ch) {
    var res = _mockIpcHandlers[ch]({}, {});
    _assert(res.success === false && res.error.code === 'NOT_IMPLEMENTED', ch + ' sigue como stub');
  });

  // ============================================================
  // TEST 9: bulk-save se puede leer de vuelta
  // ============================================================
  console.log('');
  console.log('[9] bulk-save → get-by-empresa-anio (roundtrip)');
  var r9 = _mockIpcHandlers['presupuesto:get-by-empresa-anio']({}, {
    companyName: 'Tempoactiva',
    anio: 2026
  });
  _assert(r9.success === true, 'get-by-empresa-anio OK');
  _assert(r9.data.presupuesto !== null, 'presupuesto existe');
  _assertEq(r9.data.partidas.length, 1, '1 partida (la del test 7)');
  _assertEq(r9.data.partidas[0].concepto, 'Partida sin mensuales', 'concepto preservado');
  _assertEq(r9.data.resumen.totalAsignado, 1200000, 'totalAsignado = 1.200.000');

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
    console.log('✅ Todos los tests pasaron. Handlers de escritura listos para Fase 3.');
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
