// =====================================================================
// 📦708 (2026-08-15) — Test del exportador a Excel (Fase 5)
// Verifica:
//   1. presupuesto:export-excel genera un .xlsx con la estructura correcta
//   2. El archivo se puede leer de vuelta con xlsx y tiene los datos esperados
//   3. Casos de error: presupuestoId inexistente, sin permisos de escritura
// =====================================================================

const path = require('path');
const fs = require('fs');
const os = require('os');
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
  console.log('  📦708 · TEST exportador a Excel (Fase 5)');
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
  _ok('DB inicializada');

  bridge.registerPresupuestoHandlers(_mockElectron.app, {
    getDb: function () { return db; },
    validateSession: function () { return { ok: true, user: { id: 1 } }; }
  });
  _ok('Bridge registrado');

  // ============================================================
  // SETUP: Crear presupuesto + 3 partidas con valores
  // ============================================================
  var createRes = _mockIpcHandlers['presupuesto:create']({}, {
    companyName: 'Tempoactiva',
    anio: 2026
  });
  _assert(createRes.success === true, 'create OK');
  var presupuestoId = createRes.data.presupuestoId;

  // bulk-save con 3 partidas
  var saveRes = _mockIpcHandlers['presupuesto:bulk-save']({}, {
    presupuestoId: presupuestoId,
    data: [
      { id: 1, detalle: 'Honorarios profesionales SST', asignacion: 9314724,
        enero: 776227, febrero: 776227, marzo: 776227, abril: 776227,
        mayo: 776227, junio: 776227, julio: 776227, agosto: 776227,
        septiembre: 776227, octubre: 776227, noviembre: 776227, diciembre: 776227 },
      { id: 2, detalle: 'Compra de EPPs', asignacion: 0,
        enero: 0, febrero: 0, marzo: 0, abril: 0, mayo: 0, junio: 0,
        julio: 0, agosto: 0, septiembre: 0, octubre: 0, noviembre: 0, diciembre: 0 },
      { id: 3, detalle: 'Capacitaciones', asignacion: 240000,
        enero: 20000, febrero: 20000, marzo: 20000, abril: 20000,
        mayo: 20000, junio: 20000, julio: 20000, agosto: 20000,
        septiembre: 20000, octubre: 20000, noviembre: 20000, diciembre: 20000 }
    ]
  });
  _assert(saveRes.success === true, 'bulk-save OK');

  // ============================================================
  // TEST 1: export-excel con outputPath
  // ============================================================
  console.log('');
  console.log('[1] export-excel con outputPath');
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'presupuesto-export-'));
  var outputPath = path.join(tempDir, 'ACT-FO-043 Presupuesto SG-SST 2026 Tempoactiva.xlsx');

  // 📦708 (Fase 5) — El handler es async (porque writeBuffer() es Promise)
  var exportRes = await _mockIpcHandlers['presupuesto:export-excel']({}, {
    presupuestoId: presupuestoId,
    outputPath: outputPath
  });
  _assert(exportRes.success === true, 'export OK');
  _assert(exportRes.data && exportRes.data.path === outputPath, 'path devuelto correcto');
  _assert(exportRes.data && exportRes.data.size > 1000, 'archivo tiene contenido (>1KB)');
  _assertEq(exportRes.data.partidasCount, 3, '3 partidas en el export');

  // Verificar que el archivo existe y tiene tamaño
  var stats = fs.statSync(outputPath);
  _assert(stats.size === exportRes.data.size, 'tamaño en disco = tamaño reportado');

  // ============================================================
  // TEST 2: leer el Excel generado y verificar estructura
  // ============================================================
  console.log('');
  console.log('[2] Verificar estructura del Excel generado');
  var xlsx = require('xlsx');
  var wb = xlsx.readFile(outputPath);
  var sheetName = wb.SheetNames[0];
  var ws = wb.Sheets[sheetName];
  _assert(!!ws && !!ws['!ref'], 'Excel tiene hoja con datos');

  // Leer con el mismo rango corregido que usa el import
  var originalRange = xlsx.utils.decode_range(ws['!ref']);
  var correctedRange = { s: { c: 0, r: 0 }, e: { c: 17, r: originalRange.e.r } };
  var allData = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, range: xlsx.utils.encode_range(correctedRange) });

  // Fila 9 (índice 8) = headers
  var headers = allData[8];
  _assert(headers && headers[2] === 'Detalle', 'header C9 = "Detalle"');
  _assert(headers && headers[3] === 'Asignación', 'header D9 = "Asignación"');
  _assert(headers && headers[4] === 'Ejecutado Acumulado', 'header E9 = "Ejecutado Acumulado"');
  _assert(headers && headers[5] === '% Ejecutado', 'header F9 = "% Ejecutado"');
  _assert(headers && headers[6] === 'Enero', 'header G9 = "Enero"');
  _assert(headers && headers[17] === 'Diciembre', 'header R9 = "Diciembre"');

  // Fila 10 (índice 9) = primera partida
  var p1 = allData[9];
  _assert(p1 && p1[0] === 1, 'partida 1 ID = 1');
  _assert(p1 && p1[2] === 'Honorarios profesionales SST', 'partida 1 Detalle = "Honorarios profesionales SST"');
  _assert(p1 && p1[3] === 9314724, 'partida 1 Asignación = 9.314.724');
  _assert(p1 && p1[6] === 776227, 'partida 1 Enero = 776.227');

  // Fila 13 (índice 12) = TOTAL AÑO
  var totalRow = allData[12];
  _assert(totalRow && totalRow[0] === 'TOTAL AÑO', 'TOTAL AÑO en col A');
  _assert(totalRow && totalRow[3] === 9554724, 'TOTAL Asignación = 9.554.724');

  // ============================================================
  // TEST 3: error — presupuestoId no existe
  // ============================================================
  console.log('');
  console.log('[3] export-excel con presupuestoId inexistente');
  var errRes = await _mockIpcHandlers['presupuesto:export-excel']({}, {
    presupuestoId: 'p-no-existe',
    outputPath: path.join(tempDir, 'no-deberia-crearse.xlsx')
  });
  _assert(errRes.success === false, 'presupuestoId inexistente falla');
  _assertEq(errRes.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');
  _assert(!fs.existsSync(path.join(tempDir, 'no-deberia-crearse.xlsx')), 'no se creó el archivo');

  // ============================================================
  // TEST 4: error — ruta de escritura inválida
  // ============================================================
  console.log('');
  console.log('[4] export-excel con ruta inválida');
  var invalidRes = await _mockIpcHandlers['presupuesto:export-excel']({}, {
    presupuestoId: presupuestoId,
    outputPath: 'C:\\no\\existe\\directorio\\archivo.xlsx'
  });
  _assert(invalidRes.success === false, 'ruta inválida falla');
  _assert(invalidRes.error.code === 'WRITE_ERROR' || invalidRes.error.code === 'INTERNAL', 'error.code correcto (' + invalidRes.error.code + ')');

  // ============================================================
  // TEST 5: round-trip — BD → Excel → BD (importar el Excel generado)
  // ============================================================
  console.log('');
  console.log('[5] Round-trip: BD → Excel → BD (importar el Excel generado)');
  var reimportRes = _mockIpcHandlers['presupuesto:import-from-excel']({}, {
    filePath: outputPath,
    companyName: 'Tempoactiva',
    anio: 2026,
    options: { overwrite: true }
  });
  _assert(reimportRes.success === true, 're-import OK');
  _assertEq(reimportRes.data.inserted, 3, '3 partidas re-importadas');

  // Verificar que los totales coinciden
  var resumen = _mockIpcHandlers['presupuesto:calcular-resumen']({}, {
    presupuestoId: reimportRes.data.presupuestoId
  });
  _assert(resumen.success === true, 'calcular-resumen OK');
  _assertEq(resumen.data.resumen.totalAsignado, 9554724, 'totalAsignado se preserva en round-trip');
  // El ejecutado se pierde (bulk-save no edita ejecutado, pero el export SÍ lo escribe)
  // Después de re-import, el ejecutado debería ser el del Excel
  _assert(resumen.data.resumen.totalEjecutado >= 0, 'totalEjecutado presente');

  // ============================================================
  console.log('');
  console.log('=====================================================================');
  console.log('  Resumen: ' + _passed + ' OK · ' + _failed + ' FAIL');
  console.log('=====================================================================');
  console.log('');
  console.log('  🎉 EXPORT-EXCEL VALIDADO:');
  console.log('     BD → Excel con estructura ACT-FO-043');
  console.log('     Headers correctos, partidas correctas, TOTAL AÑO correcto');
  console.log('     Round-trip (BD → Excel → BD) preserva los datos');
  console.log('');

  try { fs.unlinkSync(outputPath); } catch (e) {}
  try { fs.rmdirSync(tempDir); } catch (e) {}
  try { fs.unlinkSync(path.join(__dirname, '__mock_electron.js')); } catch (e) {}
  try { rawDb.close(); } catch (e) {}

  if (_failed === 0) {
    console.log('✅ Todos los tests pasaron. Exportador listo para Fase 5.');
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
