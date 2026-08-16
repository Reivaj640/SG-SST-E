// main/test-gestion-humana-bridge-write.js
// Tests de los 4 write handlers de Contratación (Fase 2)
// Mismo patrón que test-presupuesto-bridge-write.js
//
// Ejecutar: node main/test-gestion-humana-bridge-write.js
// Esperado: 50+ OK · 0 FAIL

const initSqlJs = require('sql.js');
const { SCHEMA_SQL } = require('./gestion-humana-schema-sql');
const { registerGestionHumanaHandlers } = require('./gestion-humana-bridge');

let _passed = 0;
let _failed = 0;

function _assert(cond, label) {
  if (cond) {
    _passed++;
    console.log('  ✓ ' + label);
  } else {
    _failed++;
    console.error('  ✗ ' + label);
  }
}

function _assertEq(actual, expected, label) {
  _assert(actual === expected, label + ' (esperado=' + expected + ', actual=' + actual + ')');
}

// Wrapper sql.js → better-sqlite3 (mismo que test-read)
function _wrapSqlJsAsBetterSqlite(sqlJsDb) {
  return {
    exec: function (sql) { return sqlJsDb.exec(sql); },
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
    },
    close: function () { sqlJsDb.close(); }
  };
}

async function run() {
  console.log('[1] Cargando sql.js y aplicando schema...');
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();
  rawDb.exec(SCHEMA_SQL);
  rawDb.exec("CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, company_key TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL);");
  rawDb.run("INSERT INTO companies (id, company_key, display_name) VALUES (?, ?, ?)",
    ['co-tempoactiva', 'tempoactiva', 'TEMPOACTIVA EST S.A.S.']);
  const db = _wrapSqlJsAsBetterSqlite(rawDb);
  console.log('  ✓ Schema aplicado y empresa de prueba creada');

  console.log('');
  console.log('[2] Registrando bridge con mocks...');
  const registeredHandlers = {};
  const mockIpcMain = { handle: function (ch, fn) { registeredHandlers[ch] = fn; } };
  registerGestionHumanaHandlers.init(mockIpcMain);
  registerGestionHumanaHandlers({ on: function () {} }, {
    getDb: function () { return db; },
    validateSession: function () { return { ok: true, user: { id: 1, isAdmin: true } }; }
  });
  console.log('  ✓ Bridge registrado');

  // ========== TEST 1: create-contratacion caso OK ==========
  console.log('');
  console.log('[1] create-contratacion — caso OK');
  var r1 = registeredHandlers['gh:create-contratacion']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: {
      nombres: 'María',
      apellidos: 'López',
      cedula: '1234567890',
      telefono: '3001234567',
      cargo: 'Operaria de mantenimiento',
      salario: 1500000,
      fechaIngreso: '2026-09-01'
    }
  });
  _assert(r1.success === true, 'create-contratacion retorna success=true');
  _assert(r1.data && r1.data.contratacionId, 'devuelve contratacionId');
  _assert(r1.data.contratacionId.indexOf('ct-') === 0, 'contratacionId empieza con ct-');
  var ctId1 = r1.data.contratacionId;

  // Verificar que se insertó correctamente
  var r1Check = registeredHandlers['gh:get-contratacion']({}, { token: 'valid-token', contratacionId: ctId1 });
  _assert(r1Check.success === true, 'se puede leer la contratación creada');
  _assertEq(r1Check.data.contratacion.nombres, 'María', 'nombres = María');
  _assertEq(r1Check.data.contratacion.apellidos, 'López', 'apellidos = López');
  _assertEq(r1Check.data.contratacion.cargo, 'Operaria de mantenimiento', 'cargo correcto');
  _assertEq(r1Check.data.contratacion.salario, 1500000, 'salario correcto');
  _assertEq(r1Check.data.contratacion.pasoActual, 1, 'pasoActual = 1 (inicia en memo)');
  _assertEq(r1Check.data.contratacion.estado, 'en_proceso', 'estado = en_proceso');
  _assertEq(r1Check.data.contratacion.memoRecibido, 0, 'memo_recibido = 0 inicialmente');

  // ========== TEST 2: create-contratacion — campos opcionales nulos ==========
  console.log('');
  console.log('[2] create-contratacion — campos opcionales nulos');
  var r2 = registeredHandlers['gh:create-contratacion']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: {
      nombres: 'Roberto',
      apellidos: 'García',
      cargo: 'Admin',
      fechaIngreso: '2026-08-01'
      // sin cedula, telefono, salario, sedeId, empresaUsuaria
    }
  });
  _assert(r2.success === true, 'create-contratacion sin opcionales retorna success=true');
  _assert(r2.data.contratacionId, 'devuelve contratacionId');
  var r2Check = registeredHandlers['gh:get-contratacion']({}, { token: 'valid-token', contratacionId: r2.data.contratacionId });
  _assertEq(r2Check.data.contratacion.cedula, null, 'cedula = null cuando no se provee');
  _assertEq(r2Check.data.contratacion.telefono, null, 'telefono = null cuando no se provee');
  _assertEq(r2Check.data.contratacion.salario, null, 'salario = null cuando no se provee');

  // ========== TEST 3: create-contratacion — validaciones (campos requeridos) ==========
  console.log('');
  console.log('[3] create-contratacion — validaciones');
  var r3a = registeredHandlers['gh:create-contratacion']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA', data: {} });
  _assert(r3a.success === false, 'sin nombres → success=false');
  _assertEq(r3a.error.code, 'INVALID_INPUT', 'sin nombres → INVALID_INPUT');

  var r3b = registeredHandlers['gh:create-contratacion']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA', data: { nombres: 'A' } });
  _assert(r3b.success === false, 'sin apellidos → success=false');

  var r3c = registeredHandlers['gh:create-contratacion']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA', data: { nombres: 'A', apellidos: 'B' } });
  _assert(r3c.success === false, 'sin cargo → success=false');

  var r3d = registeredHandlers['gh:create-contratacion']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA', data: { nombres: 'A', apellidos: 'B', cargo: 'C' } });
  _assert(r3d.success === false, 'sin fechaIngreso → success=false');

  // ========== TEST 4: create-contratacion — empresa no existe ==========
  console.log('');
  console.log('[4] create-contratacion — empresa inexistente');
  var r4 = registeredHandlers['gh:create-contratacion']({}, {
    token: 'valid-token',
    companyName: 'EMPRESA FANTASMA',
    data: { nombres: 'A', apellidos: 'B', cargo: 'C', fechaIngreso: '2026-09-01' }
  });
  _assert(r4.success === false, 'empresa inexistente → success=false');
  _assertEq(r4.error.code, 'COMPANY_NOT_FOUND', 'error.code = COMPANY_NOT_FOUND');

  // ========== TEST 5: update-contratacion caso OK ==========
  console.log('');
  console.log('[5] update-contratacion — caso OK');
  var r5 = registeredHandlers['gh:update-contratacion']({}, {
    token: 'valid-token',
    contratacionId: ctId1,
    updates: { cargo: 'Operaria Senior', salario: 2000000 }
  });
  _assert(r5.success === true, 'update retorna success=true');
  _assertEq(r5.data.contratacionId, ctId1, 'devuelve el mismo id');
  var r5Check = registeredHandlers['gh:get-contratacion']({}, { token: 'valid-token', contratacionId: ctId1 });
  _assertEq(r5Check.data.contratacion.cargo, 'Operaria Senior', 'cargo actualizado');
  _assertEq(r5Check.data.contratacion.salario, 2000000, 'salario actualizado');
  _assertEq(r5Check.data.contratacion.nombres, 'María', 'nombres NO cambió');

  // ========== TEST 6: update-contratacion — intenta actualizar paso_actual (no permitido) ==========
  console.log('');
  console.log('[6] update-contratacion — no permite actualizar campos de paso');
  var r6 = registeredHandlers['gh:update-contratacion']({}, {
    token: 'valid-token',
    contratacionId: ctId1,
    updates: { pasoActual: 5, memoRecibido: 1 }  // NO permitidos en whitelist
  });
  _assert(r6.success === false, 'intento de actualizar campos de paso → success=false');
  _assertEq(r6.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT (whitelist)');
  // Verificar que NO se actualizó nada
  var r6Check = registeredHandlers['gh:get-contratacion']({}, { token: 'valid-token', contratacionId: ctId1 });
  _assertEq(r6Check.data.contratacion.pasoActual, 1, 'pasoActual sigue en 1');
  _assertEq(r6Check.data.contratacion.memoRecibido, 0, 'memoRecibido sigue en 0');

  // ========== TEST 7: update-contratacion — id no existe ==========
  console.log('');
  console.log('[7] update-contratacion — id inexistente');
  var r7 = registeredHandlers['gh:update-contratacion']({}, {
    token: 'valid-token',
    contratacionId: 'ct-noexiste',
    updates: { cargo: 'X' }
  });
  _assert(r7.success === false, 'update id inexistente → success=false');
  _assertEq(r7.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 8: delete-contratacion caso OK (cancelar) ==========
  console.log('');
  console.log('[8] delete-contratacion — cancela correctamente');
  var r8 = registeredHandlers['gh:delete-contratacion']({}, {
    token: 'valid-token',
    contratacionId: ctId1
  });
  _assert(r8.success === true, 'delete retorna success=true');
  _assertEq(r8.data.contratacionId, ctId1, 'devuelve el id');
  _assertEq(r8.data.cancelled, true, 'cancelled = true');
  // Verificar que el estado cambió
  var r8Check = registeredHandlers['gh:get-contratacion']({}, { token: 'valid-token', contratacionId: ctId1 });
  _assertEq(r8Check.data.contratacion.estado, 'cancelado', 'estado = cancelado');
  // El registro sigue ahí (no se borra la fila)
  _assert(r8Check.data.contratacion !== null, 'la fila sigue en la BD (soft via estado)');

  // ========== TEST 9: delete-contratacion — id inexistente ==========
  console.log('');
  console.log('[9] delete-contratacion — id inexistente');
  var r9 = registeredHandlers['gh:delete-contratacion']({}, { token: 'valid-token', contratacionId: 'ct-noexiste' });
  _assert(r9.success === false, 'delete id inexistente → success=false');
  _assertEq(r9.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 10: delete-contratacion — ya cancelado ==========
  console.log('');
  console.log('[10] delete-contratacion — ya cancelado');
  var r10 = registeredHandlers['gh:delete-contratacion']({}, { token: 'valid-token', contratacionId: ctId1 });
  _assert(r10.success === false, 'delete de cancelado → success=false');
  _assertEq(r10.error.code, 'ALREADY_DELETED', 'error.code = ALREADY_DELETED');

  // ========== TEST 11: marcar-paso — paso 1 (memo) ==========
  console.log('');
  console.log('[11] marcar-paso — paso 1 (memo) con notas');
  // ctId1 está cancelado, creo uno nuevo para este test
  var r11Create = registeredHandlers['gh:create-contratacion']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { nombres: 'Test', apellidos: 'Paso1', cargo: 'Dev', fechaIngreso: '2026-09-01' }
  });
  var ctId2 = r11Create.data.contratacionId;
  var r11 = registeredHandlers['gh:marcar-paso']({}, {
    token: 'valid-token',
    contratacionId: ctId2,
    pasoNum: 1,
    fecha: '2026-08-20T10:00:00.000Z',
    notas: 'Memo recibido de RRHH'
  });
  _assert(r11.success === true, 'marcar-paso 1 retorna success=true');
  _assertEq(r11.data.pasoActual, 1, 'pasoActual = 1');
  _assertEq(r11.data.estado, 'en_proceso', 'estado sigue en_proceso (paso 1 de 6)');
  var r11Check = registeredHandlers['gh:get-contratacion']({}, { token: 'valid-token', contratacionId: ctId2 });
  _assertEq(r11Check.data.contratacion.memoRecibido, 1, 'memo_recibido = 1');
  _assertEq(r11Check.data.contratacion.memoFecha, '2026-08-20T10:00:00.000Z', 'memo_fecha correcta');
  _assertEq(r11Check.data.contratacion.memoNotas, 'Memo recibido de RRHH', 'memo_notas correcto');
  _assertEq(r11Check.data.contratacion.pasoActual, 1, 'pasoActual = 1');
  _assertEq(r11Check.data.contratacion.estado, 'en_proceso', 'estado = en_proceso');

  // ========== TEST 12: marcar-paso — pasos 2, 3, 4, 5 secuenciales ==========
  console.log('');
  console.log('[12] marcar-paso — pasos 2-5 secuenciales');
  ['contacto_realizado', 'examenes_programados', 'documentos_firmados', 'afiliaciones_completadas'].forEach(function (boolCol, i) {
    var pasoNum = i + 2;
    var r = registeredHandlers['gh:marcar-paso']({}, {
      token: 'valid-token', contratacionId: ctId2, pasoNum: pasoNum,
      fecha: '2026-08-2' + pasoNum + 'T10:00:00.000Z', notas: 'Paso ' + pasoNum
    });
    _assert(r.success === true, 'marcar-paso ' + pasoNum + ' OK');
    _assertEq(r.data.pasoActual, pasoNum, 'pasoActual = ' + pasoNum);
    _assertEq(r.data.estado, 'en_proceso', 'estado = en_proceso (paso ' + pasoNum + ' de 6)');
  });
  // Verificar todos quedaron en 1
  var r12Check = registeredHandlers['gh:get-contratacion']({}, { token: 'valid-token', contratacionId: ctId2 });
  _assertEq(r12Check.data.contratacion.pasoActual, 5, 'pasoActual = 5 después de 5 pasos');
  _assertEq(r12Check.data.contratacion.estado, 'en_proceso', 'estado = en_proceso (aún no llega a paso 6)');
  _assertEq(r12Check.data.contratacion.contactoRealizado, 1, 'contacto_realizado = 1');
  _assertEq(r12Check.data.contratacion.examenesProgramados, 1, 'examenes_programados = 1');
  _assertEq(r12Check.data.contratacion.documentosFirmados, 1, 'documentos_firmados = 1');
  _assertEq(r12Check.data.contratacion.afiliacionesCompletadas, 1, 'afiliaciones_completadas = 1');
  _assertEq(r12Check.data.contratacion.s400Activado, 0, 's400_activado sigue en 0');

  // ========== TEST 13: marcar-paso 6 (S400) — cambia estado a completado ==========
  console.log('');
  console.log('[13] marcar-paso 6 (S400) — estado → completado');
  var r13 = registeredHandlers['gh:marcar-paso']({}, {
    token: 'valid-token', contratacionId: ctId2, pasoNum: 6,
    fecha: '2026-08-30T10:00:00.000Z', notas: 'S400 activado'
  });
  _assert(r13.success === true, 'marcar-paso 6 OK');
  _assertEq(r13.data.pasoActual, 6, 'pasoActual = 6');
  _assertEq(r13.data.estado, 'completado', 'estado = completado');
  var r13Check = registeredHandlers['gh:get-contratacion']({}, { token: 'valid-token', contratacionId: ctId2 });
  _assertEq(r13Check.data.contratacion.s400Activado, 1, 's400_activado = 1');
  _assertEq(r13Check.data.contratacion.estado, 'completado', 'estado guardado = completado');

  // ========== TEST 14: marcar-paso — validaciones ==========
  console.log('');
  console.log('[14] marcar-paso — validaciones');
  var r14a = registeredHandlers['gh:marcar-paso']({}, { token: 'valid-token', contratacionId: ctId2, pasoNum: 0 });
  _assert(r14a.success === false, 'pasoNum=0 → success=false');
  _assertEq(r14a.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  var r14b = registeredHandlers['gh:marcar-paso']({}, { token: 'valid-token', contratacionId: ctId2, pasoNum: 7 });
  _assert(r14b.success === false, 'pasoNum=7 → success=false');

  var r14c = registeredHandlers['gh:marcar-paso']({}, { token: 'valid-token', contratacionId: 'ct-noexiste', pasoNum: 1 });
  _assert(r14c.success === false, 'id inexistente → success=false');
  _assertEq(r14c.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 15: marcar-paso — fecha default (now) ==========
  console.log('');
  console.log('[15] marcar-paso — fecha default = now cuando no se provee');
  var r15Create = registeredHandlers['gh:create-contratacion']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { nombres: 'Test', apellidos: 'Default', cargo: 'Dev', fechaIngreso: '2026-09-01' }
  });
  var ctId3 = r15Create.data.contratacionId;
  var before = new Date().toISOString();
  var r15 = registeredHandlers['gh:marcar-paso']({}, {
    token: 'valid-token', contratacionId: ctId3, pasoNum: 1
    // sin fecha
  });
  var after = new Date().toISOString();
  _assert(r15.success === true, 'marcar-paso sin fecha OK');
  var r15Check = registeredHandlers['gh:get-contratacion']({}, { token: 'valid-token', contratacionId: ctId3 });
  var fechaAsignada = r15Check.data.contratacion.memoFecha;
  _assert(fechaAsignada >= before && fechaAsignada <= after, 'fecha auto-asignada está entre before/after del test');

  // ========== TEST 16: marcar-paso — sobre contratación cancelada ==========
  console.log('');
  console.log('[16] marcar-paso — sobre cancelada → ALREADY_DELETED');
  var r16 = registeredHandlers['gh:marcar-paso']({}, {
    token: 'valid-token', contratacionId: ctId1, pasoNum: 1
  });
  _assert(r16.success === false, 'marcar-paso sobre cancelada → success=false');
  _assertEq(r16.error.code, 'ALREADY_DELETED', 'error.code = ALREADY_DELETED');

  // ========== TEST 17: list-contrataciones refleja los nuevos ==========
  console.log('');
  console.log('[17] list-contrataciones — refleja los nuevos registros');
  var r17 = registeredHandlers['gh:list-contrataciones']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.'
  });
  _assert(r17.success === true, 'list-contrataciones OK');
  // Total: María (cancelada) + Roberto (en_proceso) + Test-Paso1 (completado) + Test-Default (en_proceso) = 4
  _assertEq(r17.data.count, 4, '4 contrataciones en total');

  // Filtrar por estado completado
  var r17b = registeredHandlers['gh:list-contrataciones']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', estado: 'completado'
  });
  _assertEq(r17b.data.count, 1, '1 completado (Test-Paso1)');

  // Filtrar por cancelado
  var r17c = registeredHandlers['gh:list-contrataciones']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', estado: 'cancelado'
  });
  _assertEq(r17c.data.count, 1, '1 cancelado (María)');

  // Filtrar por en_proceso
  var r17d = registeredHandlers['gh:list-contrataciones']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', estado: 'en_proceso'
  });
  _assertEq(r17d.data.count, 2, '2 en_proceso (Roberto + Test-Default)');

  // ========== Resumen ==========
  console.log('');
  console.log('=====================================================================');
  console.log('  Resumen: ' + _passed + ' OK · ' + _failed + ' FAIL');
  console.log('=====================================================================');
  console.log('');

  try { db.close(); } catch (e) {}
  try { rawDb.close(); } catch (e) {}
  setTimeout(function () { process.exit(_failed > 0 ? 1 : 0); }, 100);
}

run().catch(function (err) {
  console.error('ERROR FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
