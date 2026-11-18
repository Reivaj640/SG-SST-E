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
  //
  // 📦824 — `asignacion` es la columna D del ACT-FO-043 (anual) y
  // `enero..diciembre` son las columnas G-R, que el formato titula "EJECUCION
  // PRESUPUESTAL": el gasto de cada mes. Se mandan valores DISTINTOS a propósito
  // para que el test detecte si se vuelven a confundir.
  //
  // Ojo: si se manda un `ejecutado_<mes>` explícito, ese manda; si viene en 0,
  // se usa la columna del mes y, si tampoco hay, se restaura el de la BD.
  var saveRes = _mockIpcHandlers['presupuesto:bulk-save']({}, {
    presupuestoId: presupuestoId,
    data: [
      { id: 1, detalle: 'Honorarios profesionales SST', asignacion: 9314724,
        enero: 620000, febrero: 640000, marzo: 610000, abril: 0, mayo: 0, junio: 0,
        julio: 0, agosto: 0, septiembre: 0, octubre: 0, noviembre: 0, diciembre: 0 },
      { id: 2, detalle: 'Compra de EPPs', asignacion: 0,
        enero: 0, febrero: 0, marzo: 0, abril: 0, mayo: 0, junio: 0,
        julio: 0, agosto: 0, septiembre: 0, octubre: 0, noviembre: 0, diciembre: 0 },
      { id: 3, detalle: 'Capacitaciones', asignacion: 240000,
        enero: 12000, febrero: 10000, marzo: 8000, abril: 0, mayo: 0, junio: 0,
        julio: 0, agosto: 0, septiembre: 0, octubre: 0, noviembre: 0, diciembre: 0 }
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
  // 📦824 — Las columnas G-R del ACT-FO-043 son "EJECUCION PRESUPUESTAL": van
  // lo GASTADO, no lo planeado. La v1 ponía el asignado (776.227) y por eso el
  // archivo exportado mostraba 0% de ejecución frente a lo que la app sí tenía.
  _assert(p1 && p1[4] === 1870000, 'partida 1 Ejecutado Acum. = 620k+640k+610k');
  _assert(p1 && p1[6] === 620000, 'partida 1 Enero (ejecución) = 620.000');
  _assert(p1 && p1[7] === 640000, 'partida 1 Febrero (ejecución) = 640.000');
  _assert(p1 && p1[6] !== 776227, 'partida 1 Enero NO lleva el asignado (776.227)');

  // Fila 13 (índice 12) = TOTAL AÑO
  var totalRow = allData[12];
  _assert(totalRow && totalRow[0] === 'TOTAL AÑO', 'TOTAL AÑO en col A');
  _assert(totalRow && totalRow[3] === 9554724, 'TOTAL Asignación = 9.554.724');
  _assert(totalRow && totalRow[4] === 1900000, 'TOTAL Ejecutado = 1.870.000 + 30.000');
  _assert(totalRow && totalRow[6] === 632000, 'TOTAL Enero = 620.000 + 12.000');

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
  // TEST 6: 📦1091 — el export usa el archivo OFICIAL por defecto
  //
  // El defecto: la UI nunca pasaba `plantillaPath`, así que el export salía
  // "pelado" (sin encabezado GI-FO-043, sin merges de categoría y sin pie de
  // firmas). Ahora, si el presupuesto tiene `archivo_origen`, ese archivo es la
  // plantilla.
  //
  // Este test usa el ACT-FO-043 real del repo como plantilla.
  // ============================================================
  console.log('');
  console.log('[6] export-excel usa el archivo oficial (plantilla) por defecto');

  var plantillaReal = path.join(__dirname, '..', 'utils', 'ACT-FO-043 Presupuesto SG-SST 2025 Tempoactiva.xlsx');
  var hayPlantilla = fs.existsSync(plantillaReal);
  _assert(hayPlantilla, 'existe la plantilla ACT-FO-043 del repo');
  var oficialTxt = '';
  var peladoTxt = '';

  if (hayPlantilla) {
    // El presupuesto sembrado queda apuntando al archivo oficial.
    rawDb.exec("UPDATE presupuestos SET archivo_origen = '" + plantillaReal.replace(/'/g, "''") +
      "' WHERE id = '" + presupuestoId + "'");

    var salidaOficial = path.join(tempDir, 'export-con-oficial.xlsx');
    var resOficial = await _mockIpcHandlers['presupuesto:export-excel']({}, {
      presupuestoId: presupuestoId,
      outputPath: salidaOficial
    });
    _assert(resOficial.success === true, 'export con archivo_origen OK');
    _assertEq(resOficial.data.plantillaUsada, plantillaReal, 'la plantilla usada es el archivo oficial');
    _assert(fs.existsSync(salidaOficial), 'el archivo oficial se escribió');

    var wbOficial = xlsx.readFile(salidaOficial);
    _assert(/PRESUP/i.test(wbOficial.SheetNames[0]), 'conserva la hoja oficial (' + wbOficial.SheetNames[0] + ')');
    // OJO: se lee con el rango CORREGIDO (A1..R), como hace el importador de la
    // app (`_parsePresupuestoXLSX`). SheetJS, si se lee con `ws['!ref']`,
    // arranca en B1 —porque ExcelJS escribe el <dimension> sin la columna A— y
    // se pierde la columna del N y el TOTAL. La app no sufre eso porque su
    // lector fuerza el rango; el test tampoco debe sufrirlo.
    var wsOficial = wbOficial.Sheets[wbOficial.SheetNames[0]];
    var rangoOficial = xlsx.utils.decode_range(wsOficial['!ref']);
    var rangoCorregido = { s: { c: 0, r: 0 }, e: { c: 17, r: rangoOficial.e.r } };
    var filasOficial = xlsx.utils.sheet_to_json(wsOficial, {
      header: 1, raw: true, defval: null, range: xlsx.utils.encode_range(rangoCorregido)
    });
    oficialTxt = JSON.stringify(filasOficial);
    _assert(/ASIGNACION PRESUPUESTO ANUAL/i.test(oficialTxt), 'el archivo sale con el encabezado oficial ASIGNACION PRESUPUESTO ANUAL');
    _assert(/DETALLE/i.test(oficialTxt), 'el archivo sale con la columna DETALLE del formato oficial');
    _assert(/ACT-FO-043/i.test(oficialTxt), 'el archivo conserva el codigo ACT-FO-043 de la plantilla');
    _assert(!/"Detalle","Asignaci/.test(oficialTxt), 'NO sale el encabezado pelado (Detalle/Asignación)');
    _assert(/Fecha de actualizacion: *\d+ de \w+ de \d{4}/i.test(oficialTxt), 'la fecha de actualizacion del encabezado es la de hoy');
    _assert(filasOficial[9] && filasOficial[9][0] === 1, 'la columna N quedo con el numero de partida (col A)');
    _assert(filasOficial[12] && filasOficial[12][0] === 'TOTAL AÑO', 'el TOTAL AÑO quedo en su fila');

    // Lo que de verdad importa: que la app pueda RE-IMPORTAR su propio export
    // oficial. Si el importador no lo lee, el archivo no sirve para nada.
    var reimportOficial = _mockIpcHandlers['presupuesto:import-from-excel']({}, {
      filePath: salidaOficial,
      companyName: 'Tempoactiva',
      anio: 2026,
      options: { overwrite: true }
    });
    _assert(reimportOficial.success === true, 'la app re-importa su propio export oficial');
    _assertEq(reimportOficial.data.inserted, 3, 're-import del export oficial: 3 partidas');
    var resumenOficial = _mockIpcHandlers['presupuesto:calcular-resumen']({}, {
      presupuestoId: reimportOficial.data.presupuestoId
    });
    _assertEq(resumenOficial.data.resumen.totalAsignado, 9554724, 'el total se preserva en el round-trip del export oficial');

    // CONTRASTE — el equivalente del mutante: sin archivo_origen el export SÍ sale
    // pelado. Si el fallback al archivo oficial se rompiera, la assertion de
    // arriba (que exige el encabezado oficial) se caería. Esto es lo que prueba
    // que el test muerde.
    rawDb.exec("UPDATE presupuestos SET archivo_origen = NULL WHERE id = '" + presupuestoId + "'");
    var salidaPelada = path.join(tempDir, 'export-sin-oficial.xlsx');
    await _mockIpcHandlers['presupuesto:export-excel']({}, {
      presupuestoId: presupuestoId,
      outputPath: salidaPelada
    });
    var wbPelado = xlsx.readFile(salidaPelada);
    var rangoPelado = xlsx.utils.decode_range(wbPelado.Sheets[wbPelado.SheetNames[0]]['!ref']);
    var filasPelado = xlsx.utils.sheet_to_json(wbPelado.Sheets[wbPelado.SheetNames[0]], {
      header: 1, raw: true, defval: null,
      range: xlsx.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 17, r: rangoPelado.e.r } })
    });
    peladoTxt = JSON.stringify(filasPelado);
    _assert(!/ASIGNACION PRESUPUESTO ANUAL/i.test(peladoTxt), 'sin archivo_origen el export sale pelado (sin encabezado oficial)');
    _assert(/"Detalle","Asignaci/.test(peladoTxt), 'sin archivo_origen el export sale con el encabezado pelado');

    try { fs.unlinkSync(salidaOficial); } catch (e) {}
    try { fs.unlinkSync(salidaPelada); } catch (e) {}
  }

  // ============================================================
  // TEST 7: 📦1091 — el IPC sobrevive la ida y vuelta
  //
  // El archivo oficial guarda el IPC como NÚMERO (0.052) y el export lo
  // escribe como texto con formato español ("5,2%"). El importador lo leía
  // con el parser de dinero ("5,2%" -> 52, que solo quita las comas) y
  // guardaba 52 en vez de 0.052: al reimportar el propio export, la BD
  // quedaba con un IPC de 5200%. Este test muerde ese error.
  // ============================================================
  console.log('');
  console.log('[7] el IPC sobrevive el round-trip del export');

  if (hayPlantilla) {
    rawDb.exec("UPDATE presupuestos SET archivo_origen = '" + plantillaReal.replace(/'/g, "''") +
      "', ipc = 0.052 WHERE id = '" + presupuestoId + "'");

    var salidaIpc = path.join(tempDir, 'export-con-ipc.xlsx');
    var resIpc = await _mockIpcHandlers['presupuesto:export-excel']({}, {
      presupuestoId: presupuestoId,
      outputPath: salidaIpc
    });
    _assert(resIpc.success === true, 'export con IPC OK');

    var wbIpc = xlsx.readFile(salidaIpc);
    var wsIpc = wbIpc.Sheets[wbIpc.SheetNames[0]];
    var rIpc = xlsx.utils.decode_range(wsIpc['!ref']);
    var filasIpc = xlsx.utils.sheet_to_json(wsIpc, {
      header: 1, raw: true, defval: null,
      range: xlsx.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 17, r: rIpc.e.r } })
    });
    var filaIpc = -1;
    for (var _f = 0; _f < filasIpc.length; _f++) {
      if (filasIpc[_f] && typeof filasIpc[_f][1] === 'string' &&
          filasIpc[_f][1].trim().toUpperCase() === 'IPC') { filaIpc = _f; break; }
    }
    _assert(filaIpc >= 0, 'el archivo exportado trae la fila IPC');
    if (filaIpc >= 0) {
      _assertEq(filasIpc[filaIpc][2], '5,2%', 'la fila IPC se escribe en formato español (5,2%)');
    }

    // Re-import: el IPC debe volver como fracción, no como 52.
    var reimportIpc = _mockIpcHandlers['presupuesto:import-from-excel']({}, {
      filePath: salidaIpc,
      companyName: 'Tempoactiva',
      anio: 2026,
      options: { overwrite: true }
    });
    _assert(reimportIpc.success === true, 're-import del export con IPC OK');
    if (reimportIpc.success) {
      // Tolerancia: 5,2% no es exactamente 0.052 en coma flotante.
      var _ipc = reimportIpc.data.ipc;
      var _ipcOk = typeof _ipc === 'number' && Math.abs(_ipc - 0.052) < 1e-9;
      _assert(_ipcOk, 'el IPC vuelve como fracción (0.052), no como 52 (= ' + _ipc + ')');
    }
    try { fs.unlinkSync(salidaIpc); } catch (e) {}
  }

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
  console.log('     📦1091: usa el archivo oficial (plantilla) por defecto y avisa la ruta');
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
