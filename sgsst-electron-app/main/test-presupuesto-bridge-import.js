// =====================================================================
// 📦708 (2026-08-15) — Test del importador desde Excel (Fase 4)
// Crea un Excel sintético con el formato ACT-FO-043 (mismo que el real
// de Tempoactiva) y verifica que el importador:
//   1. Parsea correctamente (estructura)
//   2. Inserta presupuesto + partidas + valores en BD
//   3. Soporta dryRun
//   4. Rechaza cuando ya existe sin overwrite
//   5. Soporta overwrite (reemplaza el existente)
//   6. Maneja archivo no encontrado
//
// Uso:  node test-presupuesto-bridge-import.js
// =====================================================================

const path = require('path');
const fs = require('fs');
const os = require('os');
const Module = require('module');

// ---------- Mock del módulo 'electron' (mismo patrón que los otros tests) ----------
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

// ---------- Wrapper de sql.js como better-sqlite3 ----------
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

/**
 * Crea un Excel sintético con el formato ACT-FO-043 (mismo que el real).
 * Headers en fila 9, datos desde fila 10, stop en TOTAL AÑO.
 */
function _createSyntheticXLSX(filePath) {
  var xlsx = require('xlsx');
  var wb = xlsx.utils.book_new();
  var wsData = [];

  // Filas 1-8: títulos / info de la empresa (vacías para el test)
  for (var r = 0; r < 8; r++) wsData.push([]);

  // Fila 9: headers
  wsData.push([
    'ID', '', 'Concepto / Detalle', 'Asignado', 'Ejecutado', '%',
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ]);

  // Fila 10: Honorarios profesionales (776.227/mes × 12)
  var honorarios = ['', '', 'Honorarios profesionales SST', 9314724, 6209816, '66,67%'];
  for (var m = 1; m <= 8; m++) honorarios.push(776227);
  for (var m2 = 9; m2 <= 12; m2++) honorarios.push(0);
  wsData.push(honorarios);

  // Fila 11: EPPs (todo en 0)
  var epps = ['', '', 'Compra de Elementos de protección personal', 0, 0, '0,00%'];
  for (var m3 = 0; m3 < 12; m3++) epps.push(0);
  wsData.push(epps);

  // Fila 12: Capacitaciones (240.000 en mes 3)
  var caps = ['', '', 'Realización de Capacitaciones', 240000, 240000, '100,00%'];
  for (var m4 = 0; m4 < 12; m4++) caps.push(m4 === 2 ? 240000 : 0);
  wsData.push(caps);

  // Fila 13: TOTAL AÑO
  var totalRow = ['TOTAL AÑO', '', 'TOTAL AÑO', 9554724, 6449816, '67,50%'];
  for (var m5 = 0; m5 < 12; m5++) totalRow.push(0);
  wsData.push(totalRow);

  var ws = xlsx.utils.aoa_to_sheet(wsData);
  xlsx.utils.book_append_sheet(wb, ws, 'Presupuesto 2026');
  xlsx.writeFile(wb, filePath);
  return filePath;
}

async function run() {
  console.log('');
  console.log('=====================================================================');
  console.log('  📦708 · TEST importador desde Excel (Fase 4)');
  console.log('=====================================================================');
  console.log('');

  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({
    locateFile: function (file) { return path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file); }
  });
  _ok('sql.js cargado');

  var bridge = require('./presupuesto-bridge');
  _assert(typeof bridge.registerPresupuestoHandlers === 'function', 'bridge cargado');

  // Crear DB + seed empresa
  var rawDb = new SQL.Database();
  rawDb.exec('PRAGMA foreign_keys = ON;');
  rawDb.exec(bridge.SCHEMA_SQL);
  rawDb.exec("CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY AUTOINCREMENT, company_key TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL)");
  rawDb.exec("INSERT INTO companies (id, company_key, display_name) VALUES (1, 'tempoactiva', 'Tempoactiva')");
  var db = _wrapSqlJsAsBetterSqlite(rawDb);
  _ok('DB inicializada con empresa tempoactiva');

  // Registrar bridge
  var mockGetDb = function () { return db; };
  var mockValidateSession = function (token) {
    if (token === 'valid-token') return { ok: true, user: { id: 1, isAdmin: true } };
    return { ok: false, error: { code: 'AUTH_REQUIRED', message: 'Token inválido' } };
  };
  bridge.registerPresupuestoHandlers(_mockElectron.app, { getDb: mockGetDb, validateSession: mockValidateSession });
  _ok('Bridge registrado');

  // Crear Excel sintético
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'presupuesto-test-'));
  var excelPath = path.join(tempDir, 'ACT-FO-043 Presupuesto SG-SST 2026 Tempoactiva.xlsx');
  _createSyntheticXLSX(excelPath);
  _ok('Excel sintético creado: ' + path.basename(excelPath));

  // ============================================================
  // TEST 1: dryRun (parsea sin escribir en BD)
  // ============================================================
  console.log('');
  console.log('[1] presupuesto:import-from-excel con dryRun=true');
  var r1 = _mockIpcHandlers['presupuesto:import-from-excel']({}, {
    token: 'valid-token',
    filePath: excelPath,
    companyName: 'Tempoactiva',
    anio: 2026,
    options: { dryRun: true }
  });
  _assert(r1.success === true, 'dryRun retorna success');
  _assert(r1.data.dryRun === true, 'data.dryRun = true');
  _assertEq(r1.data.parsed.partidasCount, 3, 'parsea 3 partidas (no cuenta TOTAL AÑO)');
  _assertEq(r1.data.parsed.firstPartida.numero, 1, 'primera partida es #1');
  _assert(r1.data.parsed.firstPartida.concepto.indexOf('Honorarios') >= 0, 'primera partida es Honorarios');

  // Verificar que NO escribió en BD
  var countAfterDryRun = db.prepare("SELECT COUNT(*) AS c FROM presupuestos").get().c;
  _assertEq(countAfterDryRun, 0, 'BD vacía después de dryRun');

  // ============================================================
  // TEST 2: Import real (caso OK)
  // ============================================================
  console.log('');
  console.log('[2] presupuesto:import-from-excel (caso real)');
  var r2 = _mockIpcHandlers['presupuesto:import-from-excel']({}, {
    token: 'valid-token',
    filePath: excelPath,
    companyName: 'Tempoactiva',
    anio: 2026
  });
  _assert(r2.success === true, 'import retorna success');
  _assertEq(r2.data.inserted, 3, 'insertó 3 partidas');
  _assertEq(r2.data.valores, 36, 'insertó 36 valores mensuales (3 × 12)');
  _assert(r2.data.presupuestoId && r2.data.presupuestoId.indexOf('p-') === 0, 'presupuestoId con formato p-{ts}-{rand}');

  // Verificar BD
  var presupuestos = db.prepare("SELECT * FROM presupuestos").all();
  _assertEq(presupuestos.length, 1, '1 presupuesto en BD');
  _assertEq(presupuestos[0].anio, 2026, 'año correcto');
  _assertEq(presupuestos[0].empresa_id, 'tempoactiva', 'empresa_id correcto');
  _assertEq(presupuestos[0].creado_por, 1, 'creado_por = 1 (del user logueado)');

  var partidas = db.prepare("SELECT * FROM presupuesto_partidas WHERE presupuesto_id = ? ORDER BY numero").all(presupuestos[0].id);
  _assertEq(partidas.length, 3, '3 partidas en BD');
  _assertEq(partidas[0].numero, 1, 'partida 1 numero = 1');
  _assert(partidas[0].concepto.indexOf('Honorarios') >= 0, 'partida 1 es Honorarios');
  _assertEq(partidas[1].numero, 2, 'partida 2 numero = 2');
  _assert(partidas[1].concepto.indexOf('protecci') >= 0, 'partida 2 es EPPs');
  _assertEq(partidas[2].numero, 3, 'partida 3 numero = 3');
  _assert(partidas[2].concepto.indexOf('Capacitac') >= 0, 'partida 3 es Capacitaciones');

  // Verificar valores de la partida 1 (Honorarios: 776.227/mes × 8 meses ejecutados)
  // Parser: asignado anual 9.314.724 / 12 = 776.227 por mes. Ejecutado mensual = 776.227 (Ene-Ago), 0 (Sep-Dic).
  var valoresP1 = db.prepare("SELECT * FROM presupuesto_valores_mensuales WHERE partida_id = ? ORDER BY mes").all(partidas[0].id);
  _assertEq(valoresP1.length, 12, 'partida 1 tiene 12 valores mensuales');
  _assertEq(valoresP1[0].mes, 1, 'primer mes = 1');
  _assertEq(valoresP1[0].asignado, 776227, 'mes 1 asignado = 776.227 (9.314.724/12)');
  _assertEq(valoresP1[0].ejecutado, 776227, 'mes 1 ejecutado = 776.227');
  _assertEq(valoresP1[7].mes, 8, 'mes 8 = agosto');
  _assertEq(valoresP1[7].asignado, 776227, 'mes 8 asignado = 776.227');
  _assertEq(valoresP1[7].ejecutado, 776227, 'mes 8 ejecutado = 776.227');
  _assertEq(valoresP1[11].mes, 12, 'mes 12 = diciembre');
  _assertEq(valoresP1[11].asignado, 776227, 'mes 12 asignado = 776.227 (distribuido)');
  _assertEq(valoresP1[11].ejecutado, 0, 'mes 12 ejecutado = 0 (sin ejecución)');

  // Verificar valores de la partida 3 (Capacitaciones: 240.000 en mes 3)
  // Parser: asignado anual 240.000 / 12 = 20.000 por mes. Ejecutado 240.000 en mes 3.
  var valoresP3 = db.prepare("SELECT * FROM presupuesto_valores_mensuales WHERE partida_id = ? AND mes = 3").all(partidas[2].id);
  _assertEq(valoresP3.length, 1, 'partida 3 mes 3 tiene 1 valor');
  _assertEq(valoresP3[0].asignado, 20000, 'partida 3 mes 3 asignado = 20.000 (240.000/12 distribuido)');
  _assertEq(valoresP3[0].ejecutado, 240000, 'partida 3 mes 3 ejecutado = 240.000');

  // ============================================================
  // TEST 3: Lectura del presupuesto recién importado
  // ============================================================
  console.log('');
  console.log('[3] Verificar que presupuesto:list-by-empresa ve el presupuesto importado');
  var r3 = _mockIpcHandlers['presupuesto:list-by-empresa']({}, {
    token: 'valid-token',
    companyName: 'Tempoactiva'
  });
  _assert(r3.success === true, 'list-by-empresa OK');
  _assertEq(r3.data.presupuestos.length, 1, '1 presupuesto listado');
  _assertEq(r3.data.presupuestos[0].partidasCount, 3, 'partidasCount = 3');
  _assertEq(r3.data.presupuestos[0].totalAsignado, 9314724 + 0 + 240000, 'totalAsignado = 9.554.724 (suma de D)');

  // ============================================================
  // TEST 4: Ya existe → error ALREADY_EXISTS
  // ============================================================
  console.log('');
  console.log('[4] Segundo import (sin overwrite) → ALREADY_EXISTS');
  var r4 = _mockIpcHandlers['presupuesto:import-from-excel']({}, {
    token: 'valid-token',
    filePath: excelPath,
    companyName: 'Tempoactiva',
    anio: 2026
  });
  _assert(r4.success === false, 'segundo import sin overwrite FALLA');
  _assertEq(r4.error.code, 'ALREADY_EXISTS', 'error.code = ALREADY_EXISTS');
  _assert(r4.error.extra && r4.error.extra.existingId, 'extra.existingId presente');

  // ============================================================
  // TEST 5: Overwrite = true reemplaza
  // ============================================================
  console.log('');
  console.log('[5] Segundo import con overwrite=true → REEMPLAZA');
  var r5 = _mockIpcHandlers['presupuesto:import-from-excel']({}, {
    token: 'valid-token',
    filePath: excelPath,
    companyName: 'Tempoactiva',
    anio: 2026,
    options: { overwrite: true }
  });
  _assert(r5.success === true, 'overwrite retorna success');
  _assert(r5.data.replaced && r5.data.replaced.indexOf('p-') === 0, 'replaced tiene el id del presupuesto viejo');

  // El viejo debe estar marcado como activo=0 (soft delete)
  // El schema actual no tiene "activo" en presupuestos, solo en partidas.
  // Entonces el UNIQUE (empresa_id, anio) bloquea tener 2 simultáneos.
  // Verifiquemos que solo hay 1 presupuesto en BD.
  var allPres = db.prepare("SELECT id FROM presupuestos").all();
  _assertEq(allPres.length, 1, 'sigue habiendo 1 presupuesto en BD (UNIQUE constraint)');

  // ============================================================
  // TEST 6: Archivo no encontrado
  // ============================================================
  console.log('');
  console.log('[6] Archivo inexistente → FILE_NOT_FOUND');
  var r6 = _mockIpcHandlers['presupuesto:import-from-excel']({}, {
    token: 'valid-token',
    filePath: 'C:\\no\\existe\\archivo.xlsx',
    companyName: 'Tempoactiva',
    anio: 2026
  });
  _assert(r6.success === false, 'archivo inexistente FALLA');
  _assertEq(r6.error.code, 'FILE_NOT_FOUND', 'error.code = FILE_NOT_FOUND');

  // ============================================================
  // TEST 7: Empresa no existe en BD
  // ============================================================
  console.log('');
  console.log('[7] Empresa no existe en BD → COMPANY_NOT_FOUND');
  var r7 = _mockIpcHandlers['presupuesto:import-from-excel']({}, {
    token: 'valid-token',
    filePath: excelPath,
    companyName: 'NoExiste',
    anio: 2026
  });
  _assert(r7.success === false, 'empresa inexistente FALLA');
  _assertEq(r7.error.code, 'COMPANY_NOT_FOUND', 'error.code = COMPANY_NOT_FOUND');

  // ============================================================
  // TEST 8: Sin token (Fase 2: soft auth) — verifica que NO falle por AUTH_REQUIRED
  // Como los tests anteriores ya importaron el presupuesto, este test va a
  // fallar por ALREADY_EXISTS, lo cual confirma que el soft auth funcionó
  // (pasó la auth y llegó al check de unicidad).
  // ============================================================
  console.log('');
  console.log('[8] Sin token → soft auth (no falla por AUTH_REQUIRED)');
  var r8 = _mockIpcHandlers['presupuesto:import-from-excel']({}, {
    filePath: excelPath,
    companyName: 'Tempoactiva',
    anio: 2026
  });
  _assert(r8.success === false, 'sin token: falla (esperado)');
  _assert(r8.error.code !== 'AUTH_REQUIRED', 'sin token: NO falla por AUTH_REQUIRED (soft auth OK)');
  _assertEq(r8.error.code, 'ALREADY_EXISTS', 'falla por ALREADY_EXISTS (soft auth funcionó, llegó al check de unicidad)');

  // ============================================================
  // TEST 9: Export sigue como stub (verificamos que no se rompió)
  // ============================================================
  console.log('');
  console.log('[9] Export-template sigue como stub (Fase 7)');
  // Fase 5 implementó export-excel pero export-template sigue pendiente.
  var r9 = _mockIpcHandlers['presupuesto:export-template']({}, {
    token: 'valid-token',
    companyName: 'Tempoactiva',
    anio: 2026
  });
  _assert(r9.success === false, 'export-template retorna success=false');
  _assertEq(r9.error.code, 'NOT_IMPLEMENTED', 'export-template = NOT_IMPLEMENTED');

  // export-excel implementado en Fase 5 — presupuestoId inexistente debe fallar con NOT_FOUND
  var r9b = await _mockIpcHandlers['presupuesto:export-excel']({}, {
    token: 'valid-token',
    presupuestoId: 'p-no-existe',
    outputPath: 'C:\\Temp\\test.xlsx'
  });
  _assert(r9b.success === false, 'export-excel con id inexistente FALLA');
  _assertEq(r9b.error.code, 'NOT_FOUND', 'export-excel retorna NOT_FOUND');

  // ============================================================
  // Resumen
  // ============================================================
  console.log('');
  console.log('=====================================================================');
  console.log('  Resumen: ' + _passed + ' OK · ' + _failed + ' FAIL');
  console.log('=====================================================================');
  console.log('');

  // Cleanup
  try { fs.unlinkSync(excelPath); } catch (e) {}
  try { fs.rmdirSync(tempDir); } catch (e) {}
  try { fs.unlinkSync(path.join(__dirname, '__mock_electron.js')); } catch (e) {}
  try { rawDb.close(); } catch (e) {}

  if (_failed === 0) {
    console.log('✅ Todos los tests pasaron. Importador listo para Fase 4.');
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
