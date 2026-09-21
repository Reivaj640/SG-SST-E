// =====================================================================
// 📦708 (2026-08-15) — Test de integración END-TO-END del flujo completo
// Simula lo que hace el usuario en la app:
//   1. Crear shell vacío (presupuesto:create)
//   2. Importar desde Excel (presupuesto:import-from-excel) o
//      poblar con bulk-save (presupuesto:bulk-save)
//   3. Leer de vuelta (presupuesto:get-by-empresa-anio)
//   4. Verificar que los datos están consistentes
//
// Esto es lo que valida que Fase 0 + 1 + 3 + 4 funcionan juntos.
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

function _createSyntheticXLSX(filePath, empresa, anio) {
  var xlsx = require('xlsx');
  var wb = xlsx.utils.book_new();
  var data = [];
  // Filas 1-8: vacías
  for (var r = 0; r < 8; r++) data.push([]);
  // Fila 9 (index 8): headers
  data.push(['ID', '', 'Detalle', 'Asig', 'Ejec', '%', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']);
  // Partida 1: Honorarios — 9.314.724 anual, 776.227/mes en meses 1-8
  var p1 = ['1', '', 'Honorarios profesionales SST', 9314724, 6209816, '66,67%'];
  for (var m = 1; m <= 8; m++) p1.push(776227);
  for (var m2 = 9; m2 <= 12; m2++) p1.push(0);
  data.push(p1);
  // Partida 2: EPPs — 0
  var p2 = ['2', '', 'Compra de EPPs', 0, 0, '0%'];
  for (var m3 = 0; m3 < 12; m3++) p2.push(0);
  data.push(p2);
  // Partida 3: Capacitaciones — 240.000 en mes 3
  var p3 = ['3', '', 'Capacitaciones', 240000, 240000, '100%'];
  for (var m4 = 0; m4 < 12; m4++) p3.push(m4 === 2 ? 240000 : 0);
  data.push(p3);
  // Total
  var p4 = ['TOTAL AÑO', '', 'TOTAL AÑO', 9554724, 6449816, '67,50%'];
  for (var m5 = 0; m5 < 12; m5++) p4.push(0);
  data.push(p4);
  var ws = xlsx.utils.aoa_to_sheet(data);
  xlsx.utils.book_append_sheet(wb, ws, 'Presupuesto ' + anio);
  xlsx.writeFile(wb, filePath);
  return filePath;
}

let _passed = 0, _failed = 0;
function _ok(m) { _passed++; console.log('  ✓ ' + m); }
function _fail(m) { _failed++; console.error('  ✗ ' + m); }
function _assert(c, m) { c ? _ok(m) : _fail(m); }
function _assertEq(a, e, m) { a === e ? _ok(m + ' (=' + a + ')') : _fail(m + ' (esperado=' + e + ', actual=' + a + ')'); }

async function run() {
  console.log('');
  console.log('=====================================================================');
  console.log('  📦708 · TEST END-TO-END del flujo completo');
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
    validateSession: function () { return { ok: true, user: { id: 1, isAdmin: true } }; }
  });
  _ok('Bridge registrado');

  // ============================================================
  // FLUJO A: Importar desde Excel (Fase 4)
  // ============================================================
  console.log('');
  console.log('═══ FLUJO A: Importar desde Excel (Fase 4) ═══');
  console.log('');

  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'presupuesto-flow-'));
  var excelPath = path.join(tempDir, 'presupuesto.xlsx');
  _createSyntheticXLSX(excelPath, 'Tempoactiva', 2026);
  _ok('Excel sintético creado');

  // 1. Importar (esto crea el presupuesto + partidas + valores)
  var importResult = _mockIpcHandlers['presupuesto:import-from-excel']({}, {
    filePath: excelPath,
    companyName: 'Tempoactiva',
    anio: 2026
  });
  _assert(importResult.success === true, 'import OK');
  _assertEq(importResult.data.inserted, 3, '3 partidas importadas');
  _assertEq(importResult.data.valores, 36, '36 valores importados');
  var presupuestoId = importResult.data.presupuestoId;
  _ok('Presupuesto ID: ' + presupuestoId);

  // 2. Leer de vuelta
  var readResult = _mockIpcHandlers['presupuesto:get-by-empresa-anio']({}, {
    companyName: 'Tempoactiva',
    anio: 2026
  });
  _assert(readResult.success === true, 'read OK');
  _assertEq(readResult.data.partidas.length, 3, '3 partidas leídas');
  _assertEq(readResult.data.partidas[0].concepto.indexOf('Honorarios') >= 0, true, 'partida 1 = Honorarios');
  // El parser distribuye asignado = total/12
  // 9.314.724 / 12 = 776.227
  _assertEq(readResult.data.partidas[0].valores[0].asignado, 776227, 'partida 1 mes 1 asignado = 776.227 (distribuido)');
  // El ejecutado mensual se guarda del Excel
  _assertEq(readResult.data.partidas[0].valores[0].ejecutado, 776227, 'partida 1 mes 1 ejecutado = 776.227');
  _assertEq(readResult.data.resumen.totalAsignado, 9554724, 'resumen totalAsignado = 9.554.724');
  _assertEq(readResult.data.resumen.totalEjecutado, 6449816, 'resumen totalEjecutado = 6.449.816');
  _ok('FLUJO A COMPLETO: Excel → BD → Lectura → Datos consistentes');

  // ============================================================
  // FLUJO B: Editar en BD (Fase 3) y verificar persistencia
  // ============================================================
  console.log('');
  console.log('═══ FLUJO B: Editar en BD (Fase 3) ═══');
  console.log('');

  // 3. Simular edición del usuario: cambiar el valor de enero de la partida 1
  var partidasEditadas = JSON.parse(JSON.stringify(readResult.data.partidas));
  partidasEditadas[0].valores[0].asignado = 1000000; // cambiar a 1.000.000
  // Convertir al shape de Excel que espera bulk-save
  var COLUMN_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var dataToSave = partidasEditadas.map(function (p) {
    var row = {
      id: p.numero,
      detalle: p.concepto,
      asignacion: p.asignado,
      ejecutado_acumulado: p.ejecutado
    };
    p.valores.forEach(function (v, idx) {
      row[COLUMN_MESES[idx]] = v.asignado;
    });
    return row;
  });

  // 4. Bulk-save
  var saveResult = _mockIpcHandlers['presupuesto:bulk-save']({}, {
    presupuestoId: presupuestoId,
    data: dataToSave
  });
  _assert(saveResult.success === true, 'bulk-save OK');
  _assertEq(saveResult.data.inserted, 3, '3 partidas guardadas');
  _ok('Bulk-save completado: ' + saveResult.data.inserted + ' partidas, ' + saveResult.data.valores + ' valores');

  // 5. Re-leer para verificar la edición
  var reRead = _mockIpcHandlers['presupuesto:get-by-empresa-anio']({}, {
    companyName: 'Tempoactiva',
    anio: 2026
  });
  _assert(reRead.success === true, 're-read OK');
  _assertEq(reRead.data.partidas[0].valores[0].asignado, 1000000, 'edición persistida: partida 1 mes 1 = 1.000.000');
  _ok('FLUJO B COMPLETO: Edición en BD → Persistencia verificada');

  // ============================================================
  // FLUJO C: Resumen y validación final
  // ============================================================
  console.log('');
  console.log('═══ FLUJO C: Resumen y validación final ═══');
  console.log('');

  // 6. Calcular resumen (debería ser el nuevo)
  var resumen = _mockIpcHandlers['presupuesto:calcular-resumen']({}, {
    presupuestoId: presupuestoId
  });
  _assert(resumen.success === true, 'calcular-resumen OK');
  // 1.000.000 + 776.227 × 11 (meses 2-12) = 1.000.000 + 8.538.497 = 9.538.497
  // 0 + 0 = 0
  // 240.000 / 12 × 12 = 240.000
  // Total asignado: 9.538.497 + 0 + 240.000 = 9.778.497
  _assertEq(resumen.data.resumen.totalAsignado, 9778497, 'resumen refleja la edición');

  // 7. List-by-empresa
  var lista = _mockIpcHandlers['presupuesto:list-by-empresa']({}, {
    companyName: 'Tempoactiva'
  });
  _assert(lista.success === true, 'list-by-empresa OK');
  _assertEq(lista.data.presupuestos.length, 1, '1 presupuesto en lista');
  _assertEq(lista.data.presupuestos[0].id, presupuestoId, 'ID correcto en lista');

  // 8. Diag (debe mostrar que la BD tiene data)
  var diag = _mockIpcHandlers['presupuesto:diag']({}, {});
  _assert(diag.success === true, 'diag OK');
  _assert(diag.data.counts.presupuestos >= 1, 'diag ve el presupuesto');

  // ============================================================
  console.log('');
  console.log('=====================================================================');
  console.log('  Resumen: ' + _passed + ' OK · ' + _failed + ' FAIL');
  console.log('=====================================================================');
  console.log('');
  console.log('  🎉 FLUJO END-TO-END VALIDADO:');
  console.log('     Excel → BD (import) → BD (read) → BD (edit) → BD (read)');
  console.log('     Los datos persisten correctamente a través de las 3 fases.');
  console.log('');

  try { fs.unlinkSync(excelPath); } catch (e) {}
  try { fs.rmdirSync(tempDir); } catch (e) {}
  try { fs.unlinkSync(path.join(__dirname, '__mock_electron.js')); } catch (e) {}
  try { rawDb.close(); } catch (e) {}

  if (_failed === 0) {
    console.log('✅ Todos los tests pasaron. Flujo end-to-end OK.');
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
