// main/test-gestion-humana-bridge-read.js
// Tests de los 5 read handlers del bridge de Gestión Humana (Fase 1)
// Mismo patrón que test-presupuesto-bridge-read.js
//
// Ejecutar: node main/test-gestion-humana-bridge-read.js
// Esperado: 60+ OK · 0 FAIL

const initSqlJs = require('sql.js');

const { SCHEMA_SQL } = require('./gestion-humana-schema-sql');
const { registerGestionHumanaHandlers } = require('./gestion-humana-bridge');

let _passed = 0;
let _failed = 0;

// ---------- Wrapper que imita la API de better-sqlite3 sobre sql.js ----------
// Mismo patrón que test-presupuesto-bridge-read.js
// El bridge usa better-sqlite3 (lib de producción en Electron). El test usa
// sql.js porque better-sqlite3 tiene NODE_MODULE_VERSION mismatch. El wrapper
// expone `prepare().get() / .all() / .run()` sobre sql.js para que el bridge
// funcione idéntico a como funcionaría en producción.
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

async function run() {
  console.log('[1] Cargando sql.js y aplicando schema...');
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();
  rawDb.exec(SCHEMA_SQL);
  // Tabla companies (necesaria para _getCompanyByName)
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      company_key TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL
    );
  `);
  // Wrap para imitar better-sqlite3 API
  const db = _wrapSqlJsAsBetterSqlite(rawDb);
  console.log('  ✓ Schema aplicado');

  console.log('');
  console.log('[2] Insertando datos de prueba (empresa + contrataciones + personal + sedes)...');
  // Empresa de prueba
  rawDb.run("INSERT INTO companies (id, company_key, display_name) VALUES (?, ?, ?)",
    ['co-tempoactiva', 'tempoactiva', 'TEMPOACTIVA EST S.A.S.']);
  // 3 contrataciones: 1 en_proceso, 1 completado, 1 cancelado
  const now = '2026-08-15T15:00:00.000Z';
  rawDb.run("INSERT INTO contrataciones (id, empresa_id, nombres, apellidos, cedula, cargo, fecha_ingreso, paso_actual, estado, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['ct-001', 'tempoactiva', 'María', 'López', '1234567890', 'Operaria de mantenimiento', '2026-09-01', 1, 'en_proceso', now, now]);
  rawDb.run("INSERT INTO contrataciones (id, empresa_id, nombres, apellidos, cedula, cargo, fecha_ingreso, paso_actual, estado, memo_recibido, memo_fecha, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['ct-002', 'tempoactiva', 'Roberto', 'García', '9876543210', 'Administrador', '2026-08-01', 4, 'completado', 1, '2026-07-25T10:00:00.000Z', now, now]);
  rawDb.run("INSERT INTO contrataciones (id, empresa_id, nombres, apellidos, cedula, cargo, fecha_ingreso, paso_actual, estado, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['ct-003', 'tempoactiva', 'Ana', 'Martínez', '5555555555', 'Auxiliar', '2026-10-01', 1, 'cancelado', now, now]);
  // 3 trabajadores en base_personal: 1 activo, 1 vacaciones, 1 retirado
  rawDb.run("INSERT INTO base_personal (id, empresa_id, nombres, apellidos, cedula, cargo, salario, fecha_ingreso, estado, activo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['bp-001', 'tempoactiva', 'Juan', 'Pérez', '1111111111', 'Operario', 1500000, '2024-01-15', 'activo', 1, now, now]);
  rawDb.run("INSERT INTO base_personal (id, empresa_id, nombres, apellidos, cedula, cargo, salario, fecha_ingreso, estado, activo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['bp-002', 'tempoactiva', 'Laura', 'Gómez', '2222222222', 'Contadora', 3000000, '2023-06-01', 'vacaciones', 1, now, now]);
  rawDb.run("INSERT INTO base_personal (id, empresa_id, nombres, apellidos, cedula, cargo, salario, fecha_ingreso, fecha_retiro, estado, activo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['bp-003', 'tempoactiva', 'Pedro', 'Ramírez', '3333333333', 'Conductor', 1800000, '2022-03-01', '2026-07-01', 'retirado', 1, now, now]);
  // 1 trabajador soft-deleted (activo=0) — no debe aparecer en list
  rawDb.run("INSERT INTO base_personal (id, empresa_id, nombres, apellidos, cedula, cargo, estado, activo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['bp-004', 'tempoactiva', 'Sofía', 'Inactiva', '4444444444', 'Borrada', 'activo', 0, now, now]);
  // 2 sedes
  rawDb.run("INSERT INTO gh_sedes (id, empresa_id, nombre, direccion, ciudad, activo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ['se-001', 'tempoactiva', 'Sede Norte', 'Calle 100 #15-20', 'Barranquilla', 1, now]);
  rawDb.run("INSERT INTO gh_sedes (id, empresa_id, nombre, direccion, ciudad, activo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ['se-002', 'tempoactiva', 'Sede Sur', 'Cra 50 #80-10', 'Bogotá', 1, now]);
  console.log('  ✓ Datos de prueba insertados');

  console.log('');
  console.log('[3] Registrando bridge con mocks...');
  const registeredHandlers = {};
  const mockIpcMain = { handle: function (ch, fn) { registeredHandlers[ch] = fn; } };
  registerGestionHumanaHandlers.init(mockIpcMain);
  registerGestionHumanaHandlers({ on: function () {} }, {
    getDb: function () { return db; },
    validateSession: function () { return { ok: true, user: { id: 1, isAdmin: true } }; }
  });
  console.log('  ✓ Bridge registrado');

  // ========== TEST 1: list-contrataciones (sin filtros) ==========
  console.log('');
  console.log('[1] gh:list-contrataciones — sin filtros, devuelve 3');
  var r1 = registeredHandlers['gh:list-contrataciones']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.' });
  _assert(r1.success === true, 'list-contrataciones retorna success=true');
  _assertEq(r1.data.count, 3, 'count = 3');
  _assertEq(r1.data.contrataciones.length, 3, 'contrataciones.length = 3');
  _assert(r1.data.company && r1.data.company.companyKey === 'tempoactiva', 'company.companyKey correcto');
  // Verificar que vienen ordenadas por fecha_ingreso DESC
  _assert(r1.data.contrataciones[0].id === 'ct-003', 'primera es ct-003 (fecha_ingreso 2026-10-01)');
  _assert(r1.data.contrataciones[1].id === 'ct-001', 'segunda es ct-001 (fecha_ingreso 2026-09-01)');
  _assert(r1.data.contrataciones[2].id === 'ct-002', 'tercera es ct-002 (fecha_ingreso 2026-08-01)');

  // ========== TEST 2: list-contrataciones (filtro estado=en_proceso) ==========
  console.log('');
  console.log('[2] gh:list-contrataciones — filtro estado=en_proceso, devuelve 1');
  var r2 = registeredHandlers['gh:list-contrataciones']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', estado: 'en_proceso' });
  _assert(r2.success === true, 'list-contrataciones con filtro retorna success=true');
  _assertEq(r2.data.count, 1, 'count = 1 (solo en_proceso)');
  _assertEq(r2.data.contrataciones[0].id, 'ct-001', 'ct-001 es la única en_proceso');

  // ========== TEST 3: list-contrataciones (filtro estado=completado) ==========
  console.log('');
  console.log('[3] gh:list-contrataciones — filtro estado=completado, devuelve 1');
  var r3 = registeredHandlers['gh:list-contrataciones']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', estado: 'completado' });
  _assert(r3.success === true, 'list-contrataciones completado retorna success=true');
  _assertEq(r3.data.count, 1, 'count = 1 (solo completado)');
  _assertEq(r3.data.contrataciones[0].id, 'ct-002', 'ct-002 es la única completado');

  // ========== TEST 4: get-contratacion (existe) ==========
  console.log('');
  console.log('[4] gh:get-contratacion — id existente, devuelve shape camelCase');
  var r4 = registeredHandlers['gh:get-contratacion']({}, { token: 'valid-token', contratacionId: 'ct-001' });
  _assert(r4.success === true, 'get-contratacion retorna success=true');
  _assert(r4.data.contratacion !== null, 'data.contratacion no es null');
  _assertEq(r4.data.contratacion.id, 'ct-001', 'id = ct-001');
  _assertEq(r4.data.contratacion.nombres, 'María', 'nombres = María');
  _assertEq(r4.data.contratacion.apellidos, 'López', 'apellidos = López');
  _assertEq(r4.data.contratacion.cargo, 'Operaria de mantenimiento', 'cargo correcto');
  _assertEq(r4.data.contratacion.pasoActual, 1, 'pasoActual = 1 (camelCase)');
  _assertEq(r4.data.contratacion.empresaId, 'tempoactiva', 'empresaId (camelCase)');
  _assertEq(r4.data.contratacion.estado, 'en_proceso', 'estado correcto');

  // ========== TEST 5: get-contratacion (no existe) ==========
  console.log('');
  console.log('[5] gh:get-contratacion — id inexistente, retorna NOT_FOUND');
  var r5 = registeredHandlers['gh:get-contratacion']({}, { token: 'valid-token', contratacionId: 'ct-noexiste' });
  _assert(r5.success === false, 'get-contratacion id no existe retorna success=false');
  _assertEq(r5.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 6: list-contrataciones — sin companyName ==========
  console.log('');
  console.log('[6] gh:list-contrataciones — sin companyName, retorna INVALID_INPUT');
  var r6 = registeredHandlers['gh:list-contrataciones']({}, { token: 'valid-token' });
  _assert(r6.success === false, 'sin companyName retorna success=false');
  _assertEq(r6.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 7: list-contrataciones — empresa no existe ==========
  console.log('');
  console.log('[7] gh:list-contrataciones — empresa inexistente, retorna COMPANY_NOT_FOUND');
  var r7 = registeredHandlers['gh:list-contrataciones']({}, { token: 'valid-token', companyName: 'EMPRESA FANTASMA' });
  _assert(r7.success === false, 'empresa inexistente retorna success=false');
  _assertEq(r7.error.code, 'COMPANY_NOT_FOUND', 'error.code = COMPANY_NOT_FOUND');

  // ========== TEST 8: list-personal (sin filtros) ==========
  console.log('');
  console.log('[8] gh:list-personal — sin filtros, devuelve 3 (soft-deleted excluido)');
  var r8 = registeredHandlers['gh:list-personal']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.' });
  _assert(r8.success === true, 'list-personal retorna success=true');
  _assertEq(r8.data.count, 3, 'count = 3 (bp-004 soft-deleted excluido)');
  _assert(r8.data.personales.every(function(p) { return p.activo === 1; }), 'todos los personales tienen activo=1');
  // Ordenados por nombres, apellidos
  _assertEq(r8.data.personales[0].nombres, 'Juan', 'primera por orden alfabético = Juan');
  _assertEq(r8.data.personales[1].nombres, 'Laura', 'segunda = Laura');
  _assertEq(r8.data.personales[2].nombres, 'Pedro', 'tercera = Pedro');

  // ========== TEST 9: list-personal (filtro estado) ==========
  console.log('');
  console.log('[9] gh:list-personal — filtro estado=vacaciones, devuelve 1');
  var r9 = registeredHandlers['gh:list-personal']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', estado: 'vacaciones' });
  _assert(r9.success === true, 'list-personal con estado retorna success=true');
  _assertEq(r9.data.count, 1, 'count = 1 (solo Laura en vacaciones)');
  _assertEq(r9.data.personales[0].id, 'bp-002', 'es bp-002 (Laura)');

  // ========== TEST 10: list-personal (search por nombre) ==========
  console.log('');
  console.log('[10] gh:list-personal — search por nombre, devuelve 1');
  var r10 = registeredHandlers['gh:list-personal']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', search: 'juan' });
  _assert(r10.success === true, 'list-personal con search retorna success=true');
  _assertEq(r10.data.count, 1, 'count = 1 (Juan)');
  _assertEq(r10.data.personales[0].nombres, 'Juan', 'es Juan');

  // ========== TEST 11: list-personal (search por cédula) ==========
  console.log('');
  console.log('[11] gh:list-personal — search por cédula, devuelve 1');
  var r11 = registeredHandlers['gh:list-personal']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', search: '2222' });
  _assert(r11.success === true, 'search por cédula retorna success=true');
  _assertEq(r11.data.count, 1, 'count = 1 (Laura con 2222...)');
  _assertEq(r11.data.personales[0].id, 'bp-002', 'es bp-002 (Laura)');

  // ========== TEST 12: list-personal (search vacío → devuelve todos) ==========
  console.log('');
  console.log('[12] gh:list-personal — search vacío, devuelve todos los 3');
  var r12 = registeredHandlers['gh:list-personal']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', search: '   ' });
  _assert(r12.success === true, 'search vacío retorna success=true');
  _assertEq(r12.data.count, 3, 'count = 3 (search vacío no filtra)');

  // ========== TEST 13: get-personal (existe) ==========
  console.log('');
  console.log('[13] gh:get-personal — id existente, devuelve shape camelCase');
  var r13 = registeredHandlers['gh:get-personal']({}, { token: 'valid-token', personalId: 'bp-001' });
  _assert(r13.success === true, 'get-personal retorna success=true');
  _assert(r13.data.personal !== null, 'data.personal no es null');
  _assertEq(r13.data.personal.id, 'bp-001', 'id correcto');
  _assertEq(r13.data.personal.nombres, 'Juan', 'nombres correcto');
  _assertEq(r13.data.personal.salario, 1500000, 'salario correcto (NUMBER, no string)');
  _assertEq(r13.data.personal.tipoDocumento, 'CC', 'tipoDocumento default CC');
  _assertEq(r13.data.personal.estado, 'activo', 'estado = activo');
  _assertEq(r13.data.personal.activo, 1, 'activo = 1');
  _assertEq(r13.data.personal.numeroCuenta, null, 'numeroCuenta null (no seteado)');

  // ========== TEST 14: get-personal (no existe) ==========
  console.log('');
  console.log('[14] gh:get-personal — id inexistente, retorna NOT_FOUND');
  var r14 = registeredHandlers['gh:get-personal']({}, { token: 'valid-token', personalId: 'bp-noexiste' });
  _assert(r14.success === false, 'get-personal id no existe retorna success=false');
  _assertEq(r14.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 15: list-sedes ==========
  console.log('');
  console.log('[15] gh:list-sedes — devuelve 2 sedes ordenadas alfabéticamente');
  var r15 = registeredHandlers['gh:list-sedes']({}, { token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.' });
  _assert(r15.success === true, 'list-sedes retorna success=true');
  _assertEq(r15.data.count, 2, 'count = 2');
  _assertEq(r15.data.sedes[0].nombre, 'Sede Norte', 'Sede Norte primero (orden alfabético)');
  _assertEq(r15.data.sedes[1].nombre, 'Sede Sur', 'Sede Sur segundo');
  _assertEq(r15.data.sedes[0].empresaId, 'tempoactiva', 'empresaId correcto');

  // ========== TEST 16: list-sedes — empresa sin sedes ==========
  console.log('');
  console.log('[16] gh:list-sedes — empresa sin sedes, devuelve array vacío');
  rawDb.run("INSERT INTO companies (id, company_key, display_name) VALUES (?, ?, ?)",
    ['co-vacia', 'vacia', 'EMPRESA VACIA']);
  var r16 = registeredHandlers['gh:list-sedes']({}, { token: 'valid-token', companyName: 'EMPRESA VACIA' });
  _assert(r16.success === true, 'list-sedes empresa vacía retorna success=true');
  _assertEq(r16.data.count, 0, 'count = 0');
  _assertEq(r16.data.sedes.length, 0, 'sedes = []');

  // ========== TEST 17: Empresa con case-insensitive matching ==========
  console.log('');
  console.log('[17] gh:list-sedes — companyName case-insensitive');
  var r17 = registeredHandlers['gh:list-sedes']({}, { token: 'valid-token', companyName: 'tempoactiva est s.a.s.' });
  _assert(r17.success === true, 'companyName lowercase retorna success=true');
  _assertEq(r17.data.count, 2, 'encuentra la empresa aunque esté en lowercase');

  // ========== TEST 18: Auth sin token (soft auth) ==========
  console.log('');
  console.log('[18] Auth — sin token, soft auth funciona');
  var r18 = registeredHandlers['gh:list-sedes']({}, { companyName: 'TEMPOACTIVA EST S.A.S.' });
  _assert(r18.success === true, 'sin token pero con companyName funciona');

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
