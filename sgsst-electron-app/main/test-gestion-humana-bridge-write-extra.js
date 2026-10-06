// main/test-gestion-humana-bridge-write-extra.js
// Tests de los 6 write handlers de Personal + Sedes (Fase 3)
// Mismo patrón que test-gestion-humana-bridge-write.js
//
// Ejecutar: node main/test-gestion-humana-bridge-write-extra.js
// Esperado: 60+ OK · 0 FAIL

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

// Wrapper sql.js → better-sqlite3
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

  // ========== TEST 1: create-personal caso OK (mínimo) ==========
  console.log('');
  console.log('[1] create-personal — caso mínimo (solo requeridos)');
  var r1 = registeredHandlers['gh:create-personal']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { nombres: 'Ana', apellidos: 'García', cedula: '1111111111' }
  });
  _assert(r1.success === true, 'create-personal OK');
  _assert(r1.data.personalId.indexOf('bp-') === 0, 'personalId empieza con bp-');
  var bpId1 = r1.data.personalId;
  var r1Check = registeredHandlers['gh:get-personal']({}, { token: 'valid-token', personalId: bpId1 });
  _assertEq(r1Check.data.personal.nombres, 'Ana', 'nombres = Ana');
  _assertEq(r1Check.data.personal.apellidos, 'García', 'apellidos = García');
  _assertEq(r1Check.data.personal.cedula, '1111111111', 'cedula correcto');
  _assertEq(r1Check.data.personal.tipoDocumento, 'CC', 'tipoDocumento default = CC');
  _assertEq(r1Check.data.personal.estado, 'activo', 'estado default = activo');
  _assertEq(r1Check.data.personal.activo, 1, 'activo = 1');
  _assertEq(r1Check.data.personal.salario, null, 'salario = null cuando no se provee');
  _assertEq(r1Check.data.personal.eps, null, 'eps = null cuando no se provee');

  // ========== TEST 2: create-personal caso completo ==========
  console.log('');
  console.log('[2] create-personal — caso completo (todos los campos)');
  var r2 = registeredHandlers['gh:create-personal']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: {
      nombres: 'Pedro', apellidos: 'López', cedula: '2222222222',
      tipoDocumento: 'CE', fechaNacimiento: '1990-05-15',
      telefono: '3001111', celular: '3012222', email: 'pedro@test.com',
      estadoCivil: 'casado', nivelEducativo: 'profesional',
      direccion: 'Calle 1 #2-3', barrio: 'Centro', ciudad: 'Bogotá',
      cargo: 'Ingeniero', salario: 5000000, tipoContrato: 'indefinido',
      fechaIngreso: '2024-01-15',
      eps: 'Sanitas', pension: 'Porvenir', arl: 'Sura', cajaCompensacion: 'Compensar',
      banco: 'Bancolombia', numeroCuenta: '123-456'
    }
  });
  _assert(r2.success === true, 'create-personal completo OK');
  var r2Check = registeredHandlers['gh:get-personal']({}, { token: 'valid-token', personalId: r2.data.personalId });
  _assertEq(r2Check.data.personal.tipoDocumento, 'CE', 'tipoDocumento = CE');
  _assertEq(r2Check.data.personal.salario, 5000000, 'salario correcto');
  _assertEq(r2Check.data.personal.estadoCivil, 'casado', 'estadoCivil correcto');
  _assertEq(r2Check.data.personal.eps, 'Sanitas', 'eps correcto');
  _assertEq(r2Check.data.personal.banco, 'Bancolombia', 'banco correcto');

  // ========== TEST 3: create-personal — UNIQUE constraint (cédula duplicada) ==========
  console.log('');
  console.log('[3] create-personal — UNIQUE(empresa_id, cedula)');
  var r3 = registeredHandlers['gh:create-personal']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { nombres: 'Duplicado', apellidos: 'Test', cedula: '1111111111' }  // misma cedula que r1
  });
  _assert(r3.success === false, 'cédula duplicada → success=false');
  _assertEq(r3.error.code, 'ALREADY_EXISTS', 'error.code = ALREADY_EXISTS');
  _assert(r3.error.extra && r3.error.extra.existingId === bpId1, 'extra.existingId = bpId1');

  // ========== TEST 4: create-personal — validaciones requeridos ==========
  console.log('');
  console.log('[4] create-personal — validaciones');
  var r4a = registeredHandlers['gh:create-personal']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA', data: {} });
  _assert(r4a.success === false, 'sin data → INVALID_INPUT');
  var r4b = registeredHandlers['gh:create-personal']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA', data: { cedula: 'x' } });
  _assert(r4b.success === false, 'sin nombres → INVALID_INPUT');
  var r4c = registeredHandlers['gh:create-personal']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA', data: { nombres: 'A', cedula: 'x' } });
  _assert(r4c.success === false, 'sin apellidos → INVALID_INPUT');
  var r4d = registeredHandlers['gh:create-personal']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA', data: { nombres: 'A', apellidos: 'B' } });
  _assert(r4d.success === false, 'sin cedula → INVALID_INPUT');

  // ========== TEST 5: update-personal caso OK ==========
  console.log('');
  console.log('[5] update-personal — caso OK');
  var r5 = registeredHandlers['gh:update-personal']({}, {
    token: 'valid-token',
    personalId: bpId1,
    updates: { cargo: 'Operario Senior', salario: 2500000, celular: '3009999' }
  });
  _assert(r5.success === true, 'update-personal OK');
  var r5Check = registeredHandlers['gh:get-personal']({}, { token: 'valid-token', personalId: bpId1 });
  _assertEq(r5Check.data.personal.cargo, 'Operario Senior', 'cargo actualizado');
  _assertEq(r5Check.data.personal.salario, 2500000, 'salario actualizado');
  _assertEq(r5Check.data.personal.celular, '3009999', 'celular actualizado');
  _assertEq(r5Check.data.personal.nombres, 'Ana', 'nombres NO cambió');

  // ========== TEST 6: update-personal — sin cambios válidos ==========
  console.log('');
  console.log('[6] update-personal — sin campos válidos');
  var r6 = registeredHandlers['gh:update-personal']({}, {
    token: 'valid-token',
    personalId: bpId1,
    updates: { id: 'fake', empresaId: 'fake', activo: 0, createdAt: 'fake' }  // todos NO permitidos
  });
  _assert(r6.success === false, 'update sin campos válidos → INVALID_INPUT');

  // ========== TEST 7: delete-personal caso OK (retirar) ==========
  console.log('');
  console.log('[7] delete-personal — soft delete');
  var r7 = registeredHandlers['gh:delete-personal']({}, { token: 'valid-token', personalId: bpId1 });
  _assert(r7.success === true, 'delete OK');
  _assertEq(r7.data.retired, true, 'retired = true');
  var r7Check = registeredHandlers['gh:get-personal']({}, { token: 'valid-token', personalId: bpId1 });
  _assertEq(r7Check.data.personal.activo, 0, 'activo = 0');
  _assertEq(r7Check.data.personal.estado, 'retirado', 'estado = retirado');
  // Verificar que list-personal lo EXCLUYE (porque filtra activo=1)
  var r7List = registeredHandlers['gh:list-personal']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.' });
  _assert(r7List.data.personales.every(function (p) { return p.id !== bpId1; }), 'list-personal excluye el retirado');

  // ========== TEST 8: delete-personal — ya retirado ==========
  console.log('');
  console.log('[8] delete-personal — ya retirado');
  var r8 = registeredHandlers['gh:delete-personal']({}, { token: 'valid-token', personalId: bpId1 });
  _assert(r8.success === false, 'delete de retirado → success=false');
  _assertEq(r8.error.code, 'ALREADY_DELETED', 'error.code = ALREADY_DELETED');

  // ========== TEST 9: delete-personal — id inexistente ==========
  console.log('');
  console.log('[9] delete-personal — id inexistente');
  var r9 = registeredHandlers['gh:delete-personal']({}, { token: 'valid-token', personalId: 'bp-noexiste' });
  _assert(r9.success === false, 'id inexistente → NOT_FOUND');
  _assertEq(r9.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 10: cambiar-estado caso OK ==========
  console.log('');
  console.log('[10] cambiar-estado — a vacaciones');
  // Usar bpId2 (Pedro) que sigue activo
  var bpId2 = r2.data.personalId;
  var r10 = registeredHandlers['gh:cambiar-estado']({}, {
    token: 'valid-token', personalId: bpId2, estado: 'vacaciones',
    fechaRetiro: null
  });
  _assert(r10.success === true, 'cambiar-estado OK');
  _assertEq(r10.data.estado, 'vacaciones', 'estado = vacaciones');
  var r10Check = registeredHandlers['gh:get-personal']({}, { token: 'valid-token', personalId: bpId2 });
  _assertEq(r10Check.data.personal.estado, 'vacaciones', 'estado guardado');

  // ========== TEST 11: cambiar-estado — a retirado con auto-fechaRetiro ==========
  console.log('');
  console.log('[11] cambiar-estado — a retirado (auto-fecha)');
  var r11 = registeredHandlers['gh:cambiar-estado']({}, {
    token: 'valid-token', personalId: bpId2, estado: 'retirado'
    // sin fechaRetiro → debe setear now
  });
  _assert(r11.success === true, 'cambiar-estado a retirado OK');
  _assert(r11.data.fechaRetiro, 'fechaRetiro auto-asignada');
  var r11Check = registeredHandlers['gh:get-personal']({}, { token: 'valid-token', personalId: bpId2 });
  _assertEq(r11Check.data.personal.estado, 'retirado', 'estado = retirado');
  _assert(r11Check.data.personal.fechaRetiro, 'fechaRetiro guardada');

  // ========== TEST 12: cambiar-estado — validaciones ==========
  console.log('');
  console.log('[12] cambiar-estado — validaciones');
  var r12a = registeredHandlers['gh:cambiar-estado']({}, { token: 'valid-token', personalId: bpId2, estado: 'invalido' });
  _assert(r12a.success === false, 'estado inválido → INVALID_INPUT');
  _assertEq(r12a.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  var r12b = registeredHandlers['gh:cambiar-estado']({}, { token: 'valid-token', personalId: 'bp-noexiste', estado: 'activo' });
  _assert(r12b.success === false, 'id inexistente → NOT_FOUND');

  // ========== TEST 13: create-sede caso OK ==========
  console.log('');
  console.log('[13] create-sede — caso OK');
  var r13 = registeredHandlers['gh:create-sede']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { nombre: 'Sede Centro', direccion: 'Calle 50 #10-20', ciudad: 'Bogotá' }
  });
  _assert(r13.success === true, 'create-sede OK');
  _assert(r13.data.sedeId.indexOf('se-') === 0, 'sedeId empieza con se-');

  // ========== TEST 14: create-sede — UNIQUE(nombre) ==========
  console.log('');
  console.log('[14] create-sede — UNIQUE(empresa_id, nombre)');
  var r14 = registeredHandlers['gh:create-sede']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { nombre: 'Sede Centro' }  // mismo nombre
  });
  _assert(r14.success === false, 'nombre duplicado → ALREADY_EXISTS');
  _assertEq(r14.error.code, 'ALREADY_EXISTS', 'error.code = ALREADY_EXISTS');

  // ========== TEST 15: create-sede — validaciones ==========
  console.log('');
  console.log('[15] create-sede — validaciones');
  var r15a = registeredHandlers['gh:create-sede']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA', data: {} });
  _assert(r15a.success === false, 'sin nombre → INVALID_INPUT');

  // ========== TEST 16: update-sede caso OK ==========
  console.log('');
  console.log('[16] update-sede — caso OK');
  var sedeId1 = r13.data.sedeId;
  var r16 = registeredHandlers['gh:update-sede']({}, {
    token: 'valid-token', sedeId: sedeId1,
    updates: { direccion: 'Nueva dirección 100', ciudad: 'Medellín' }
  });
  _assert(r16.success === true, 'update-sede OK');
  var r16Check = registeredHandlers['gh:list-sedes']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.' });
  var sedeActualizada = r16Check.data.sedes.find(function (s) { return s.id === sedeId1; });
  _assertEq(sedeActualizada.direccion, 'Nueva dirección 100', 'direccion actualizada');
  _assertEq(sedeActualizada.ciudad, 'Medellín', 'ciudad actualizada');

  // ========== TEST 17: update-sede — cambio de nombre a uno duplicado ==========
  console.log('');
  console.log('[17] update-sede — cambio de nombre a duplicado');
  // Crear otra sede primero
  registeredHandlers['gh:create-sede']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { nombre: 'Sede Norte' }
  });
  var r17 = registeredHandlers['gh:update-sede']({}, {
    token: 'valid-token', sedeId: sedeId1,
    updates: { nombre: 'Sede Norte' }  // nombre duplicado
  });
  _assert(r17.success === false, 'cambio a nombre duplicado → ALREADY_EXISTS');
  _assertEq(r17.error.code, 'ALREADY_EXISTS', 'error.code = ALREADY_EXISTS');

  // ========== TEST 18: update-sede — id inexistente ==========
  console.log('');
  console.log('[18] update-sede — id inexistente');
  var r18 = registeredHandlers['gh:update-sede']({}, { token: 'valid-token', sedeId: 'se-noexiste', updates: { nombre: 'X' } });
  _assert(r18.success === false, 'id inexistente → NOT_FOUND');

  // ========== TEST 19: list-sedes refleja los nuevos ==========
  console.log('');
  console.log('[19] list-sedes — 2 sedes (Centro + Norte)');
  var r19 = registeredHandlers['gh:list-sedes']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.' });
  _assertEq(r19.data.count, 2, 'count = 2');

  // ========== TEST 20: list-personal refleja soft-deletes y estados ==========
  console.log('');
  console.log('[20] list-personal — excluye soft-deleted (activo=0), incluye retirado con activo=1');
  var r20 = registeredHandlers['gh:list-personal']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.' });
  _assert(r20.success === true, 'list-personal OK');
  // bpId1 (Ana) está soft-deleted (activo=0) → EXCLUIDA
  // bpId2 (Pedro) está activo=1 + estado='retirado' → INCLUIDO
  _assertEq(r20.data.count, 1, 'count = 1 (solo Pedro que está activo=1)');
  _assertEq(r20.data.personales[0].id, bpId2, 'el único es bpId2 (Pedro)');
  _assertEq(r20.data.personales[0].estado, 'retirado', 'estado = retirado (visible porque activo=1)');

  // ========== TEST 21: list-personal con filtro estado=retirado ==========
  console.log('');
  console.log('[21] list-personal con filtro estado=retirado');
  var r21 = registeredHandlers['gh:list-personal']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', estado: 'retirado' });
  _assertEq(r21.data.count, 1, 'count = 1 (Pedro con estado=retirado, activo=1)');
  _assertEq(r21.data.personales[0].id, bpId2, 'es bpId2');

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
