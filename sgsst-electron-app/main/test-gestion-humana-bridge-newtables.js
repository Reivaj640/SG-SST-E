// main/test-gestion-humana-bridge-newtables.js
// Tests de los 28 handlers nuevos para las 6 tablas nuevas (Fase 5)
// Mismo patrón que test-gestion-humana-bridge-write.js
//
// Ejecutar: node main/test-gestion-humana-bridge-newtables.js
// Esperado: 200+ OK · 0 FAIL

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
  _assert(actual === expected, label + ' (esperado=' + JSON.stringify(expected) + ', actual=' + JSON.stringify(actual) + ')');
}

// Wrapper sql.js → better-sqlite3 (mismo que test-write)
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
  // Segunda empresa para tests multi-tenant
  rawDb.run("INSERT INTO companies (id, company_key, display_name) VALUES (?, ?, ?)",
    ['co-otra', 'otra-empresa', 'OTRA EMPRESA S.A.S.']);
  const db = _wrapSqlJsAsBetterSqlite(rawDb);
  console.log('  ✓ Schema aplicado y 2 empresas de prueba creadas');

  console.log('');
  console.log('[2] Registrando bridge con mocks...');
  const registeredHandlers = {};
  const mockIpcMain = { handle: function (ch, fn) { registeredHandlers[ch] = fn; } };
  registerGestionHumanaHandlers.init(mockIpcMain);
  registerGestionHumanaHandlers({ on: function () {} }, {
    getDb: function () { return db; },
    validateSession: function () { return { ok: true, user: { id: 1, isAdmin: true } }; }
  });
  console.log('  ✓ Bridge registrado (44 handlers)');

  // ========== SETUP: crear 2 trabajadores de prueba ==========
  console.log('');
  console.log('[SETUP] Creando trabajadores de prueba (uno por empresa)');
  var trab1 = registeredHandlers['gh:create-personal']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { nombres: 'Juan', apellidos: 'Pérez', cedula: '1111111111', cargo: 'Operario', fechaIngreso: '2026-01-01' }
  });
  _assert(trab1.success === true, 'setup: crear trabajador 1 TEMPOACTIVA');
  var bpId1 = trab1.data.personalId;

  var trab2 = registeredHandlers['gh:create-personal']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { nombres: 'Ana', apellidos: 'Gómez', cedula: '2222222222', cargo: 'Admin', fechaIngreso: '2026-02-01' }
  });
  _assert(trab2.success === true, 'setup: crear trabajador 2 TEMPOACTIVA');
  var bpId2 = trab2.data.personalId;

  var trab3 = registeredHandlers['gh:create-personal']({}, {
    token: 'valid-token',
    companyName: 'OTRA EMPRESA S.A.S.',
    data: { nombres: 'Pedro', apellidos: 'López', cedula: '3333333333', cargo: 'Operario', fechaIngreso: '2026-03-01' }
  });
  _assert(trab3.success === true, 'setup: crear trabajador 3 OTRA EMPRESA');
  var bpId3 = trab3.data.personalId;

  // ========== TEST 1: VACACIONES — create OK ==========
  console.log('');
  console.log('[1] create-vacacion — caso OK');
  var v1 = registeredHandlers['gh:create-vacacion']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: {
      trabajadorId: bpId1,
      fechaSolicitud: '2026-08-15',
      fechaInicio: '2026-12-20',
      fechaFin: '2027-01-05',
      diasSolicitados: 10,
      diasPendientes: 0,
      estado: 'solicitada',
      notas: 'Vacaciones de fin de año'
    }
  });
  _assert(v1.success === true, 'create-vacacion retorna success=true');
  _assert(v1.data && v1.data.vacacionId, 'devuelve vacacionId');
  _assert(v1.data.vacacionId.indexOf('va-') === 0, 'vacacionId empieza con va-');
  var vaId1 = v1.data.vacacionId;

  // ========== TEST 2: VACACIONES — get OK ==========
  console.log('');
  console.log('[2] get-vacacion — caso OK');
  var v2 = registeredHandlers['gh:get-vacacion']({}, { token: 'valid-token', vacacionId: vaId1 });
  _assert(v2.success === true, 'get-vacacion retorna success=true');
  _assertEq(v2.data.vacacion.trabajadorId, bpId1, 'trabajadorId correcto');
  _assertEq(v2.data.vacacion.diasSolicitados, 10, 'diasSolicitados = 10');
  _assertEq(v2.data.vacacion.estado, 'solicitada', 'estado = solicitada');
  _assertEq(v2.data.vacacion.notas, 'Vacaciones de fin de año', 'notas correcto');

  // ========== TEST 3: VACACIONES — list sin filtros ==========
  console.log('');
  console.log('[3] list-vacaciones — sin filtros');
  var v3 = registeredHandlers['gh:list-vacaciones']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.'
  });
  _assert(v3.success === true, 'list-vacaciones OK');
  _assertEq(v3.data.count, 1, 'count = 1');

  // ========== TEST 4: VACACIONES — list con filtro estado ==========
  console.log('');
  console.log('[4] list-vacaciones — filtro estado=solicitada');
  var v4 = registeredHandlers['gh:list-vacaciones']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', estado: 'solicitada'
  });
  _assertEq(v4.data.count, 1, '1 vacaciones en estado solicitada');

  // ========== TEST 5: VACACIONES — list con filtro trabajadorId ==========
  console.log('');
  console.log('[5] list-vacaciones — filtro trabajadorId');
  var v5 = registeredHandlers['gh:list-vacaciones']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', trabajadorId: bpId2
  });
  _assertEq(v5.data.count, 0, 'trabajador 2 no tiene vacaciones');

  // ========== TEST 6: VACACIONES — validaciones campos requeridos ==========
  console.log('');
  console.log('[6] create-vacacion — validaciones');
  var v6a = registeredHandlers['gh:create-vacacion']({}, { token: 'valid-token', companyName: 'TEMP', data: {} });
  _assert(v6a.success === false, 'sin trabajadorId → fail');
  _assertEq(v6a.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  var v6b = registeredHandlers['gh:create-vacacion']({}, { token: 'valid-token', companyName: 'TEMP', data: { trabajadorId: 'bp-1' } });
  _assert(v6b.success === false, 'sin fechaSolicitud → fail');

  var v6c = registeredHandlers['gh:create-vacacion']({}, {
    token: 'valid-token', companyName: 'TEMP',
    data: { trabajadorId: 'bp-1', fechaSolicitud: '2026-01-01', fechaInicio: '2026-01-01', fechaFin: '2026-01-02' }
  });
  _assert(v6c.success === false, 'sin diasSolicitados → fail');

  // ========== TEST 7: VACACIONES — multi-tenant rechaza trabajador de otra empresa ==========
  console.log('');
  console.log('[7] create-vacacion — multi-tenant (trabajador de OTRA EMPRESA)');
  var v7 = registeredHandlers['gh:create-vacacion']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: {
      trabajadorId: bpId3,  // pertenece a OTRA EMPRESA
      fechaSolicitud: '2026-08-15',
      fechaInicio: '2026-12-01',
      fechaFin: '2026-12-15',
      diasSolicitados: 10
    }
  });
  _assert(v7.success === false, 'rechaza trabajador de otra empresa');
  _assertEq(v7.error.code, 'TRABAJADOR_NOT_FOUND', 'error.code = TRABAJADOR_NOT_FOUND');

  // ========== TEST 8: VACACIONES — empresa inexistente ==========
  console.log('');
  console.log('[8] create-vacacion — empresa inexistente');
  var v8 = registeredHandlers['gh:create-vacacion']({}, {
    token: 'valid-token', companyName: 'EMPRESA FANTASMA',
    data: { trabajadorId: 'bp-x', fechaSolicitud: '2026-01-01', fechaInicio: '2026-01-01', fechaFin: '2026-01-02', diasSolicitados: 1 }
  });
  _assertEq(v8.error.code, 'COMPANY_NOT_FOUND', 'COMPANY_NOT_FOUND');

  // ========== TEST 9: VACACIONES — update OK ==========
  console.log('');
  console.log('[9] update-vacacion — caso OK');
  var v9 = registeredHandlers['gh:update-vacacion']({}, {
    token: 'valid-token', vacacionId: vaId1,
    updates: { notas: 'Actualizado', diasPendientes: 5 }
  });
  _assert(v9.success === true, 'update-vacacion OK');
  var v9Check = registeredHandlers['gh:get-vacacion']({}, { token: 'valid-token', vacacionId: vaId1 });
  _assertEq(v9Check.data.vacacion.notas, 'Actualizado', 'notas actualizado');
  _assertEq(v9Check.data.vacacion.diasPendientes, 5, 'diasPendientes actualizado');

  // ========== TEST 10: VACACIONES — update whitelist (rechaza campos no permitidos) ==========
  console.log('');
  console.log('[10] update-vacacion — rechaza campos no permitidos');
  var v10 = registeredHandlers['gh:update-vacacion']({}, {
    token: 'valid-token', vacacionId: vaId1,
    updates: { trabajadorId: 'bp-otro', diasSolicitados: 99 }  // NO permitidos
  });
  _assert(v10.success === false, 'campos no permitidos → fail');
  _assertEq(v10.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');
  // Verificar que NO se actualizó nada
  var v10Check = registeredHandlers['gh:get-vacacion']({}, { token: 'valid-token', vacacionId: vaId1 });
  _assertEq(v10Check.data.vacacion.trabajadorId, bpId1, 'trabajadorId NO cambió');
  _assertEq(v10Check.data.vacacion.diasSolicitados, 10, 'diasSolicitados NO cambió');

  // ========== TEST 11: VACACIONES — update id inexistente ==========
  console.log('');
  console.log('[11] update-vacacion — id inexistente');
  var v11 = registeredHandlers['gh:update-vacacion']({}, {
    token: 'valid-token', vacacionId: 'va-noexiste', updates: { notas: 'x' }
  });
  _assertEq(v11.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 12: VACACIONES — get id inexistente ==========
  console.log('');
  console.log('[12] get-vacacion — id inexistente');
  var v12 = registeredHandlers['gh:get-vacacion']({}, { token: 'valid-token', vacacionId: 'va-noexiste' });
  _assertEq(v12.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 13: VACACIONES — get sin id ==========
  console.log('');
  console.log('[13] get-vacacion — sin id');
  var v13 = registeredHandlers['gh:get-vacacion']({}, { token: 'valid-token' });
  _assertEq(v13.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 14: VACACIONES — cambiar-estado (aprobar) ==========
  console.log('');
  console.log('[14] cambiar-estado-vacacion — aprobar');
  var v14 = registeredHandlers['gh:cambiar-estado-vacacion']({}, {
    token: 'valid-token', vacacionId: vaId1, nuevoEstado: 'aprobada', aprobadoPor: 'Carlos RRHH'
  });
  _assert(v14.success === true, 'cambiar-estado OK');
  _assertEq(v14.data.estado, 'aprobada', 'estado = aprobada');
  var v14Check = registeredHandlers['gh:get-vacacion']({}, { token: 'valid-token', vacacionId: vaId1 });
  _assertEq(v14Check.data.vacacion.estado, 'aprobada', 'estado guardado');
  _assertEq(v14Check.data.vacacion.aprobadoPor, 'Carlos RRHH', 'aprobadoPor guardado');
  _assert(v14Check.data.vacacion.fechaAprobacion !== null, 'fechaAprobacion auto-asignada');

  // ========== TEST 15: VACACIONES — cambiar-estado estado inválido ==========
  console.log('');
  console.log('[15] cambiar-estado-vacacion — estado inválido');
  var v15 = registeredHandlers['gh:cambiar-estado-vacacion']({}, {
    token: 'valid-token', vacacionId: vaId1, nuevoEstado: 'estado_malo'
  });
  _assertEq(v15.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 16: VACACIONES — delete (soft via cancelado) ==========
  console.log('');
  console.log('[16] delete-vacacion — soft via cancelado');
  var v16 = registeredHandlers['gh:delete-vacacion']({}, { token: 'valid-token', vacacionId: vaId1 });
  _assert(v16.success === true, 'delete OK');
  _assertEq(v16.data.cancelled, true, 'cancelled = true');
  var v16Check = registeredHandlers['gh:get-vacacion']({}, { token: 'valid-token', vacacionId: vaId1 });
  _assertEq(v16Check.data.vacacion.estado, 'cancelado', 'estado = cancelado');

  // ========== TEST 17: VACACIONES — delete ya cancelada ==========
  console.log('');
  console.log('[17] delete-vacacion — ya cancelada');
  var v17 = registeredHandlers['gh:delete-vacacion']({}, { token: 'valid-token', vacacionId: vaId1 });
  _assertEq(v17.error.code, 'ALREADY_DELETED', 'error.code = ALREADY_DELETED');

  // ========== TEST 18: PERMISOS — create OK ==========
  console.log('');
  console.log('[18] create-permiso — caso OK (incapacidad)');
  var p1 = registeredHandlers['gh:create-permiso']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: {
      trabajadorId: bpId1,
      tipo: 'incapacidad',
      fechaInicio: '2026-08-10',
      fechaFin: '2026-08-15',
      dias: 5,
      motivo: 'Gripe fuerte',
      soporteUrl: 'docs/incapacidad-001.pdf'
    }
  });
  _assert(p1.success === true, 'create-permiso OK');
  _assert(p1.data.permisoId.indexOf('pe-') === 0, 'permisoId empieza con pe-');
  var peId1 = p1.data.permisoId;

  // ========== TEST 19: PERMISOS — create otro tipo (maternidad) ==========
  console.log('');
  console.log('[19] create-permiso — caso OK (maternidad)');
  var p2 = registeredHandlers['gh:create-permiso']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { trabajadorId: bpId2, tipo: 'maternidad', fechaInicio: '2026-09-01' }
  });
  _assert(p2.success === true, 'create-permiso maternidad OK');
  var peId2 = p2.data.permisoId;

  // ========== TEST 20: PERMISOS — tipo inválido ==========
  console.log('');
  console.log('[20] create-permiso — tipo inválido');
  var p3 = registeredHandlers['gh:create-permiso']({}, {
    token: 'valid-token', companyName: 'TEMP',
    data: { trabajadorId: bpId1, tipo: 'inventado', fechaInicio: '2026-01-01' }
  });
  _assertEq(p3.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 21: PERMISOS — list con filtro tipo ==========
  console.log('');
  console.log('[21] list-permisos — filtro tipo=incapacidad');
  var p4 = registeredHandlers['gh:list-permisos']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', tipo: 'incapacidad'
  });
  _assertEq(p4.data.count, 1, '1 incapacidad');
  _assertEq(p4.data.permisos[0].tipo, 'incapacidad', 'tipo correcto');

  // ========== TEST 22: PERMISOS — list con filtro estado ==========
  console.log('');
  console.log('[22] list-permisos — filtro estado=activo');
  var p5 = registeredHandlers['gh:list-permisos']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', estado: 'activo'
  });
  _assert(p5.data.count >= 1, 'al menos 1 permiso activo');

  // ========== TEST 23: PERMISOS — update OK (prorroga) ==========
  console.log('');
  console.log('[23] update-permiso — prorroga=true');
  var p6 = registeredHandlers['gh:update-permiso']({}, {
    token: 'valid-token', permisoId: peId1, updates: { prorroga: true, notas: 'Prórroga de 3 días' }
  });
  _assert(p6.success === true, 'update-permiso OK');
  var p6Check = registeredHandlers['gh:get-permiso']({}, { token: 'valid-token', permisoId: peId1 });
  _assertEq(p6Check.data.permiso.prorroga, 1, 'prorroga guardado');
  _assertEq(p6Check.data.permiso.notas, 'Prórroga de 3 días', 'notas guardado');

  // ========== TEST 24: PERMISOS — finalizar OK ==========
  console.log('');
  console.log('[24] finalizar-permiso — caso OK');
  var p7 = registeredHandlers['gh:finalizar-permiso']({}, {
    token: 'valid-token', permisoId: peId1, fechaFin: '2026-08-20'
  });
  _assert(p7.success === true, 'finalizar OK');
  _assertEq(p7.data.estado, 'finalizado', 'estado = finalizado');
  _assertEq(p7.data.fechaFin, '2026-08-20', 'fechaFin correcto');
  var p7Check = registeredHandlers['gh:get-permiso']({}, { token: 'valid-token', permisoId: peId1 });
  _assertEq(p7Check.data.permiso.estado, 'finalizado', 'estado guardado');

  // ========== TEST 25: PERMISOS — finalizar ya finalizado ==========
  console.log('');
  console.log('[25] finalizar-permiso — ya finalizado');
  var p8 = registeredHandlers['gh:finalizar-permiso']({}, { token: 'valid-token', permisoId: peId1 });
  _assertEq(p8.error.code, 'ALREADY_FINALIZED', 'error.code = ALREADY_FINALIZED');

  // ========== TEST 26: PERMISOS — update estado inválido ==========
  console.log('');
  console.log('[26] update-permiso — estado inválido');
  var p9 = registeredHandlers['gh:update-permiso']({}, {
    token: 'valid-token', permisoId: peId2, updates: { estado: 'malo' }
  });
  _assertEq(p9.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 27: PERMISOS — get id inexistente ==========
  console.log('');
  console.log('[27] get-permiso — id inexistente');
  var p10 = registeredHandlers['gh:get-permiso']({}, { token: 'valid-token', permisoId: 'pe-noexiste' });
  _assertEq(p10.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 28: PERMISOS — multi-tenant ==========
  console.log('');
  console.log('[28] create-permiso — multi-tenant');
  var p11 = registeredHandlers['gh:create-permiso']({}, {
    token: 'valid-token', companyName: 'OTRA EMPRESA S.A.S.',
    data: { trabajadorId: bpId1, tipo: 'incapacidad', fechaInicio: '2026-08-10' }
  });
  _assert(p11.success === false, 'rechaza trabajador de otra empresa');
  _assertEq(p11.error.code, 'TRABAJADOR_NOT_FOUND', 'TRABAJADOR_NOT_FOUND');

  // ========== TEST 29: DOCUMENTOS — create OK ==========
  console.log('');
  console.log('[29] create-documento — caso OK');
  var d1 = registeredHandlers['gh:create-documento']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: {
      trabajadorId: bpId1,
      tipo: 'autorizacion_datos',
      titulo: 'Autorización de tratamiento de datos',
      contenido: JSON.stringify({ nombre: 'Juan', cedula: '1111111111', firma: 'autografa' })
    }
  });
  _assert(d1.success === true, 'create-documento OK');
  _assert(d1.data.documentoId.indexOf('do-') === 0, 'documentoId empieza con do-');
  var doId1 = d1.data.documentoId;
  var d1Check = registeredHandlers['gh:get-documento']({}, { token: 'valid-token', documentoId: doId1 });
  _assertEq(d1Check.data.documento.estado, 'pendiente', 'estado default = pendiente');
  _assertEq(d1Check.data.documento.version, 1, 'version default = 1');

  // ========== TEST 30: DOCUMENTOS — tipo inválido ==========
  console.log('');
  console.log('[30] create-documento — tipo inválido');
  var d2 = registeredHandlers['gh:create-documento']({}, {
    token: 'valid-token', companyName: 'TEMP',
    data: { trabajadorId: bpId1, tipo: 'inventado', titulo: 't', contenido: '{}' }
  });
  _assertEq(d2.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 31: DOCUMENTOS — sin campos requeridos ==========
  console.log('');
  console.log('[31] create-documento — sin titulo');
  var d3 = registeredHandlers['gh:create-documento']({}, {
    token: 'valid-token', companyName: 'TEMP',
    data: { trabajadorId: bpId1, tipo: 'autorizacion_datos', contenido: '{}' }
  });
  _assertEq(d3.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 32: DOCUMENTOS — list con filtro tipo ==========
  console.log('');
  console.log('[32] list-documentos — filtro tipo');
  var d4 = registeredHandlers['gh:list-documentos']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', tipo: 'autorizacion_datos'
  });
  _assertEq(d4.data.count, 1, '1 doc de tipo autorizacion_datos');

  // ========== TEST 33: DOCUMENTOS — list con filtro estado ==========
  console.log('');
  console.log('[33] list-documentos — filtro estado=pendiente');
  var d5 = registeredHandlers['gh:list-documentos']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', estado: 'pendiente'
  });
  _assertEq(d5.data.count, 1, '1 doc pendiente');

  // LEGACY-SIGN-REMOVE (2026-08-20): tests 34-40 (firma canvas + firmar-documento) eliminados.
  // La firma canvas operativa interna ya no existe; la firma es únicamente electrónica
  // vía firma-service (I-101+). La numeración de tests siguientes NO se renumera
  // para mantener traceability con el histórico de cambios (v1.0.x).
  // doId2 era creado en el test 40 eliminado; lo recreamos aquí para que test 41+ siga funcionando.
  var d6 = registeredHandlers['gh:create-documento']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { trabajadorId: bpId1, tipo: 'induccion', titulo: 'Inducción', contenido: '{}' }
  });
  var doId2 = d6.data.documentoId;

  // ========== TEST 41: DOCUMENTOS — update OK ==========
  console.log('');
  console.log('[41] update-documento — caso OK');
  // doId2 todavía está pendiente
  var d7 = registeredHandlers['gh:update-documento']({}, {
    token: 'valid-token', documentoId: doId2, updates: { titulo: 'Inducción actualizada', version: 2 }
  });
  _assert(d7.success === true, 'update OK');
  var d7Check = registeredHandlers['gh:get-documento']({}, { token: 'valid-token', documentoId: doId2 });
  _assertEq(d7Check.data.documento.titulo, 'Inducción actualizada', 'titulo actualizado');
  _assertEq(d7Check.data.documento.version, 2, 'version actualizado');

  // ========== TEST 42: DOCUMENTOS — delete (soft via anulado) ==========
  console.log('');
  console.log('[42] delete-documento — soft via anulado');
  var d8 = registeredHandlers['gh:delete-documento']({}, { token: 'valid-token', documentoId: doId2 });
  _assert(d8.success === true, 'delete OK');
  _assertEq(d8.data.cancelled, true, 'cancelled = true');
  var d8Check = registeredHandlers['gh:get-documento']({}, { token: 'valid-token', documentoId: doId2 });
  _assertEq(d8Check.data.documento.estado, 'anulado', 'estado = anulado');

  // ========== TEST 43: DOCUMENTOS — delete ya anulado ==========
  console.log('');
  console.log('[43] delete-documento — ya anulado');
  var d9 = registeredHandlers['gh:delete-documento']({}, { token: 'valid-token', documentoId: doId2 });
  _assertEq(d9.error.code, 'ALREADY_DELETED', 'error.code = ALREADY_DELETED');

  // ========== TEST 44: DOCUMENTOS — update de anulado falla ==========
  console.log('');
  console.log('[44] update-documento — sobre anulado');
  var d10 = registeredHandlers['gh:update-documento']({}, {
    token: 'valid-token', documentoId: doId2, updates: { titulo: 'X' }
  });
  _assertEq(d10.error.code, 'ALREADY_DELETED', 'error.code = ALREADY_DELETED');

  // ========== TEST 45: ANUNCIOS — create OK ==========
  console.log('');
  console.log('[45] create-anuncio — caso OK (info + todos)');
  var a1 = registeredHandlers['gh:create-anuncio']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: {
      titulo: 'Reunión mensual',
      contenido: 'El viernes 20 hay reunión mensual de seguridad',
      tipo: 'info',
      dirigidoA: 'todos',
      fechaPublicacion: '2026-08-15T08:00:00.000Z',
      publicadoPor: 'RRHH'
    }
  });
  _assert(a1.success === true, 'create-anuncio OK');
  _assert(a1.data.anuncioId.indexOf('an-') === 0, 'anuncioId empieza con an-');
  var anId1 = a1.data.anuncioId;
  var a1Check = registeredHandlers['gh:get-anuncio']({}, { token: 'valid-token', anuncioId: anId1 });
  _assertEq(a1Check.data.anuncio.activo, 1, 'activo = 1 por default');
  _assertEq(a1Check.data.anuncio.tipo, 'info', 'tipo = info');
  _assertEq(a1Check.data.anuncio.dirigidoA, 'todos', 'dirigidoA = todos');

  // ========== TEST 46: ANUNCIOS — create con tipo y dirigidoA personalizados ==========
  console.log('');
  console.log('[46] create-anuncio — urgente + sede');
  var a2 = registeredHandlers['gh:create-anuncio']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.',
    data: {
      titulo: 'URGENTE: simulacro de evacuación',
      contenido: 'Mañana 9am simulacro',
      tipo: 'urgente',
      dirigidoA: 'sede',
      sedeId: 'se-test-1',
      fechaPublicacion: '2026-08-15T08:00:00.000Z',
      publicadoPor: 'Admin'
    }
  });
  _assert(a2.success === true, 'create anuncio urgente OK');
  var anId2 = a2.data.anuncioId;

  // ========== TEST 47: ANUNCIOS — tipo inválido ==========
  console.log('');
  console.log('[47] create-anuncio — tipo inválido');
  var a3 = registeredHandlers['gh:create-anuncio']({}, {
    token: 'valid-token', companyName: 'TEMP',
    data: { titulo: 't', contenido: 'c', tipo: 'inventado', fechaPublicacion: '2026-01-01', publicadoPor: 'X' }
  });
  _assertEq(a3.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 48: ANUNCIOS — sin campos requeridos ==========
  console.log('');
  console.log('[48] create-anuncio — sin titulo');
  var a4 = registeredHandlers['gh:create-anuncio']({}, {
    token: 'valid-token', companyName: 'TEMP',
    data: { contenido: 'c', fechaPublicacion: '2026-01-01', publicadoPor: 'X' }
  });
  _assertEq(a4.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 49: ANUNCIOS — list con filtro tipo ==========
  console.log('');
  console.log('[49] list-anuncios — filtro tipo=info');
  var a5 = registeredHandlers['gh:list-anuncios']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', tipo: 'info'
  });
  _assertEq(a5.data.count, 1, '1 info');

  // ========== TEST 50: ANUNCIOS — list con filtro activo ==========
  console.log('');
  console.log('[50] list-anuncios — filtro activo=true');
  var a6 = registeredHandlers['gh:list-anuncios']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', activo: true
  });
  _assertEq(a6.data.count, 2, '2 activos');

  // ========== TEST 51: ANUNCIOS — update OK ==========
  console.log('');
  console.log('[51] update-anuncio — caso OK');
  var a7 = registeredHandlers['gh:update-anuncio']({}, {
    token: 'valid-token', anuncioId: anId1, updates: { titulo: 'Reunión mensual (actualizado)' }
  });
  _assert(a7.success === true, 'update OK');
  var a7Check = registeredHandlers['gh:get-anuncio']({}, { token: 'valid-token', anuncioId: anId1 });
  _assertEq(a7Check.data.anuncio.titulo, 'Reunión mensual (actualizado)', 'titulo actualizado');

  // ========== TEST 52: ANUNCIOS — delete (soft via activo=0) ==========
  console.log('');
  console.log('[52] delete-anuncio — soft via activo=0');
  var a8 = registeredHandlers['gh:delete-anuncio']({}, { token: 'valid-token', anuncioId: anId2 });
  _assert(a8.success === true, 'delete OK');
  _assertEq(a8.data.cancelled, true, 'cancelled = true');
  var a8Check = registeredHandlers['gh:get-anuncio']({}, { token: 'valid-token', anuncioId: anId2 });
  _assertEq(a8Check.data.anuncio.activo, 0, 'activo = 0');

  // ========== TEST 53: ANUNCIOS — delete ya inactivo ==========
  console.log('');
  console.log('[53] delete-anuncio — ya inactivo');
  var a9 = registeredHandlers['gh:delete-anuncio']({}, { token: 'valid-token', anuncioId: anId2 });
  _assertEq(a9.error.code, 'ALREADY_DELETED', 'error.code = ALREADY_DELETED');

  // ========== TEST 54: ANUNCIOS — get id inexistente ==========
  console.log('');
  console.log('[54] get-anuncio — id inexistente');
  var a10 = registeredHandlers['gh:get-anuncio']({}, { token: 'valid-token', anuncioId: 'an-noexiste' });
  _assertEq(a10.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 55: ANUNCIOS — update tipo inválido ==========
  console.log('');
  console.log('[55] update-anuncio — tipo inválido');
  var a11 = registeredHandlers['gh:update-anuncio']({}, {
    token: 'valid-token', anuncioId: anId1, updates: { tipo: 'malo' }
  });
  _assertEq(a11.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 56: MENSAJES — create OK ==========
  console.log('');
  console.log('[56] create-mensaje — caso OK');
  var m1 = registeredHandlers['gh:create-mensaje']({}, {
    token: 'valid-token',
    companyName: 'TEMPOACTIVA EST S.A.S.',
    data: {
      remitenteId: bpId1,
      destinatarioId: bpId2,
      asunto: 'Hola Ana',
      contenido: '¿Cómo estás?',
      prioridad: 'normal'
    }
  });
  _assert(m1.success === true, 'create-mensaje OK');
  _assert(m1.data.mensajeId.indexOf('me-') === 0, 'mensajeId empieza con me-');
  var meId1 = m1.data.mensajeId;
  var m1Check = registeredHandlers['gh:get-mensaje']({}, { token: 'valid-token', mensajeId: meId1 });
  _assertEq(m1Check.data.mensaje.leido, 0, 'leido = 0 por default');
  _assertEq(m1Check.data.mensaje.prioridad, 'normal', 'prioridad normal');
  _assertEq(m1Check.data.mensaje.fechaLectura, null, 'fechaLectura null por default');

  // ========== TEST 57: MENSAJES — create con prioridad alta ==========
  console.log('');
  console.log('[57] create-mensaje — prioridad alta');
  var m2 = registeredHandlers['gh:create-mensaje']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { remitenteId: bpId1, destinatarioId: bpId2, asunto: 'Urgente', contenido: 'URG', prioridad: 'alta' }
  });
  _assert(m2.success === true, 'mensaje alta prioridad OK');

  // ========== TEST 58: MENSAJES — remitente = destinatario (rechaza) ==========
  console.log('');
  console.log('[58] create-mensaje — mismo remitente y destinatario');
  var m3 = registeredHandlers['gh:create-mensaje']({}, {
    token: 'valid-token', companyName: 'TEMP',
    data: { remitenteId: bpId1, destinatarioId: bpId1, asunto: 'a', contenido: 'c' }
  });
  _assertEq(m3.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 59: MENSAJES — remitente de otra empresa ==========
  console.log('');
  console.log('[59] create-mensaje — multi-tenant (remitente de otra empresa)');
  var m4 = registeredHandlers['gh:create-mensaje']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { remitenteId: bpId3, destinatarioId: bpId2, asunto: 'a', contenido: 'c' }
  });
  _assertEq(m4.error.code, 'REMITENTE_NOT_FOUND', 'error.code = REMITENTE_NOT_FOUND');

  // ========== TEST 60: MENSAJES — destinatario de otra empresa ==========
  console.log('');
  console.log('[60] create-mensaje — multi-tenant (destinatario de otra empresa)');
  var m5 = registeredHandlers['gh:create-mensaje']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { remitenteId: bpId1, destinatarioId: bpId3, asunto: 'a', contenido: 'c' }
  });
  _assertEq(m5.error.code, 'DESTINATARIO_NOT_FOUND', 'error.code = DESTINATARIO_NOT_FOUND');

  // ========== TEST 61: MENSAJES — prioridad inválida ==========
  console.log('');
  console.log('[61] create-mensaje — prioridad inválida');
  var m6 = registeredHandlers['gh:create-mensaje']({}, {
    token: 'valid-token', companyName: 'TEMP',
    data: { remitenteId: bpId1, destinatarioId: bpId2, asunto: 'a', contenido: 'c', prioridad: 'urgente_extrema' }
  });
  _assertEq(m6.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 62: MENSAJES — list con filtro destinatarioId ==========
  console.log('');
  console.log('[62] list-mensajes — filtro destinatarioId');
  var m7 = registeredHandlers['gh:list-mensajes']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', destinatarioId: bpId2
  });
  _assertEq(m7.data.count, 2, '2 mensajes para bpId2');

  // ========== TEST 63: MENSAJES — list con filtro leido=false ==========
  console.log('');
  console.log('[63] list-mensajes — filtro leido=false');
  var m8 = registeredHandlers['gh:list-mensajes']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', leido: false
  });
  _assertEq(m8.data.count, 2, '2 mensajes no leídos');

  // ========== TEST 64: MENSAJES — marcar-leido OK ==========
  console.log('');
  console.log('[64] marcar-leido — caso OK');
  var m9 = registeredHandlers['gh:marcar-leido']({}, {
    token: 'valid-token', mensajeId: meId1, fechaLectura: '2026-08-15T11:00:00.000Z'
  });
  _assert(m9.success === true, 'marcar-leido OK');
  _assertEq(m9.data.leido, true, 'leido = true');
  _assertEq(m9.data.fechaLectura, '2026-08-15T11:00:00.000Z', 'fechaLectura correcto');
  var m9Check = registeredHandlers['gh:get-mensaje']({}, { token: 'valid-token', mensajeId: meId1 });
  _assertEq(m9Check.data.mensaje.leido, 1, 'leido guardado');
  _assertEq(m9Check.data.mensaje.fechaLectura, '2026-08-15T11:00:00.000Z', 'fecha guardado');

  // ========== TEST 65: MENSAJES — marcar-leido ya leído ==========
  console.log('');
  console.log('[65] marcar-leido — ya leído');
  var m10 = registeredHandlers['gh:marcar-leido']({}, { token: 'valid-token', mensajeId: meId1 });
  _assertEq(m10.error.code, 'ALREADY_READ', 'error.code = ALREADY_READ');

  // ========== TEST 66: MENSAJES — get id inexistente ==========
  console.log('');
  console.log('[66] get-mensaje — id inexistente');
  var m11 = registeredHandlers['gh:get-mensaje']({}, { token: 'valid-token', mensajeId: 'me-noexiste' });
  _assertEq(m11.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 67: list-mensajes con leido=true ahora muestra 1 ==========
  console.log('');
  console.log('[67] list-mensajes — filtro leido=true');
  var m12 = registeredHandlers['gh:list-mensajes']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', leido: true
  });
  _assertEq(m12.data.count, 1, '1 mensaje leído');

  // ========== TEST 68: VACACIONES — list con filtro de OTRA EMPRESA (multi-tenant) ==========
  console.log('');
  console.log('[68] list-vacaciones — multi-tenant (OTRA EMPRESA)');
  var vMulti = registeredHandlers['gh:list-vacaciones']({}, {
    token: 'valid-token', companyName: 'OTRA EMPRESA S.A.S.'
  });
  _assert(vMulti.success === true, 'list-vacaciones OTRA EMPRESA OK');
  _assertEq(vMulti.data.count, 0, '0 vacaciones (las de TEMPOACTIVA no se ven)');

  // ========== TEST 69: PERMISOS — list con filtro de OTRA EMPRESA (multi-tenant) ==========
  console.log('');
  console.log('[69] list-permisos — multi-tenant (OTRA EMPRESA)');
  var pMulti = registeredHandlers['gh:list-permisos']({}, {
    token: 'valid-token', companyName: 'OTRA EMPRESA S.A.S.'
  });
  _assertEq(pMulti.data.count, 0, '0 permisos en OTRA EMPRESA');

  // ========== TEST 70: DOCUMENTOS — list con filtro de OTRA EMPRESA (multi-tenant) ==========
  console.log('');
  console.log('[70] list-documentos — multi-tenant (OTRA EMPRESA)');
  var dMulti = registeredHandlers['gh:list-documentos']({}, {
    token: 'valid-token', companyName: 'OTRA EMPRESA S.A.S.'
  });
  _assertEq(dMulti.data.count, 0, '0 documentos en OTRA EMPRESA');

  // ========== TEST 71: ANUNCIOS — list con filtro de OTRA EMPRESA (multi-tenant) ==========
  console.log('');
  console.log('[71] list-anuncios — multi-tenant (OTRA EMPRESA)');
  var aMulti = registeredHandlers['gh:list-anuncios']({}, {
    token: 'valid-token', companyName: 'OTRA EMPRESA S.A.S.'
  });
  _assertEq(aMulti.data.count, 0, '0 anuncios en OTRA EMPRESA');

  // ========== TEST 72: MENSAJES — list con filtro de OTRA EMPRESA (multi-tenant) ==========
  console.log('');
  console.log('[72] list-mensajes — multi-tenant (OTRA EMPRESA)');
  var mMulti = registeredHandlers['gh:list-mensajes']({}, {
    token: 'valid-token', companyName: 'OTRA EMPRESA S.A.S.'
  });
  _assertEq(mMulti.data.count, 0, '0 mensajes en OTRA EMPRESA');

  // ========== TEST 73: diag final verifica phase=5 ==========
  console.log('');
  console.log('[73] diag final — phase 5');
  var finalDiag = registeredHandlers['gh:diag']({}, {});
  _assert(finalDiag.success === true, 'diag OK');
  _assertEq(finalDiag.data.phase, 5, 'diag.phase = 5');
  _assertEq(finalDiag.data.tables.length, 9, 'diag.tables = 9');

  // ========== TEST 74: ANUNCIOS — update dirigidoA inválido ==========
  console.log('');
  console.log('[74] update-anuncio — dirigidoA inválido');
  var a12 = registeredHandlers['gh:update-anuncio']({}, {
    token: 'valid-token', anuncioId: anId1, updates: { dirigidoA: 'malo' }
  });
  _assertEq(a12.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 75: VACACIONES — update sobre cancelada ==========
  console.log('');
  console.log('[75] update-vacacion — sobre cancelada');
  var vUpd = registeredHandlers['gh:update-vacacion']({}, {
    token: 'valid-token', vacacionId: vaId1, updates: { notas: 'X' }
  });
  _assertEq(vUpd.error.code, 'ALREADY_DELETED', 'error.code = ALREADY_DELETED');

  // ========== TEST 76: ANUNCIOS — update con activo=0 explícito ==========
  console.log('');
  console.log('[76] update-anuncio — desactivar via update');
  var a13 = registeredHandlers['gh:update-anuncio']({}, {
    token: 'valid-token', anuncioId: anId1, updates: { activo: 0 }
  });
  _assert(a13.success === true, 'update OK');
  var a13Check = registeredHandlers['gh:get-anuncio']({}, { token: 'valid-token', anuncioId: anId1 });
  _assertEq(a13Check.data.anuncio.activo, 0, 'activo = 0');

  // ========== TEST 77: VACACIONES — create con notificarCliente=true ==========
  console.log('');
  console.log('[77] create-vacacion — notificarCliente=true');
  var vN = registeredHandlers['gh:create-vacacion']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.',
    data: {
      trabajadorId: bpId2,
      fechaSolicitud: '2026-08-15',
      fechaInicio: '2026-10-01',
      fechaFin: '2026-10-15',
      diasSolicitados: 10,
      notificarCliente: true
    }
  });
  _assert(vN.success === true, 'create-vacacion con notificarCliente OK');
  var vNCheck = registeredHandlers['gh:get-vacacion']({}, { token: 'valid-token', vacacionId: vN.data.vacacionId });
  _assertEq(vNCheck.data.vacacion.notificarCliente, 1, 'notificarCliente guardado como 1');

  // ========== TEST 78: DOCUMENTOS — update estado inválido ==========
  console.log('');
  console.log('[78] update-documento — estado inválido');
  // Crear uno nuevo para tener uno no anulado
  var dNew = registeredHandlers['gh:create-documento']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { trabajadorId: bpId1, tipo: 'induccion', titulo: 'Indu', contenido: '{}' }
  });
  var dNewId = dNew.data.documentoId;
  var dBad = registeredHandlers['gh:update-documento']({}, {
    token: 'valid-token', documentoId: dNewId, updates: { estado: 'malo' }
  });
  _assertEq(dBad.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 79: PERMISOS — create con prorroga=true ==========
  console.log('');
  console.log('[79] create-permiso — prorroga=true');
  var pNew = registeredHandlers['gh:create-permiso']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { trabajadorId: bpId2, tipo: 'permiso_personal', fechaInicio: '2026-08-20', prorroga: true }
  });
  _assert(pNew.success === true, 'create OK');
  var pNewCheck = registeredHandlers['gh:get-permiso']({}, { token: 'valid-token', permisoId: pNew.data.permisoId });
  _assertEq(pNewCheck.data.permiso.prorroga, 1, 'prorroga guardado');

  // ========== TEST 80: PERMISOS — finalizar con fechaFin por default ==========
  console.log('');
  console.log('[80] finalizar-permiso — sin fechaFin (default = now)');
  var before = new Date().toISOString();
  var pFin = registeredHandlers['gh:finalizar-permiso']({}, { token: 'valid-token', permisoId: pNew.data.permisoId });
  var after = new Date().toISOString();
  _assert(pFin.success === true, 'finalizar OK');
  _assert(pFin.data.fechaFin >= before && pFin.data.fechaFin <= after, 'fechaFin auto-asignada está en el rango');

  // ========== TEST 81: MENSAJES — list-mensajes leido=0 (boolean) ==========
  console.log('');
  console.log('[81] list-mensajes — leido=0 (number)');
  var mL0 = registeredHandlers['gh:list-mensajes']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', leido: 0
  });
  _assert(mL0.success === true, 'list con leido=0 OK');
  // Después de marcar meId1 como leído, hay 2 no leídos (m2 + m3 de 4 totales si los hubo)
  _assert(mL0.data.count >= 1, 'al menos 1 mensaje no leído');

  // LEGACY-SIGN-REMOVE (2026-08-20): test 82 (list-firmas sin filtros) eliminado.

  // ========== TEST 83: VACACIONES — get sin id devuelve INVALID_INPUT ==========
  console.log('');
  console.log('[83] get-vacacion — sin id');
  var vNoId = registeredHandlers['gh:get-vacacion']({}, { token: 'valid-token' });
  _assertEq(vNoId.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 84: PERMISOS — get sin id ==========
  console.log('');
  console.log('[84] get-permiso — sin id');
  var pNoId = registeredHandlers['gh:get-permiso']({}, { token: 'valid-token' });
  _assertEq(pNoId.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 85: DOCUMENTOS — get sin id ==========
  console.log('');
  console.log('[85] get-documento — sin id');
  var dNoId = registeredHandlers['gh:get-documento']({}, { token: 'valid-token' });
  _assertEq(dNoId.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 86: ANUNCIOS — get sin id ==========
  console.log('');
  console.log('[86] get-anuncio — sin id');
  var aNoId = registeredHandlers['gh:get-anuncio']({}, { token: 'valid-token' });
  _assertEq(aNoId.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 87: MENSAJES — get sin id ==========
  console.log('');
  console.log('[87] get-mensaje — sin id');
  var mNoId = registeredHandlers['gh:get-mensaje']({}, { token: 'valid-token' });
  _assertEq(mNoId.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // LEGACY-SIGN-REMOVE (2026-08-20): test 88 (create-firma fechaHora requerido) eliminado.

  // ========== TEST 89: list-vacaciones sin companyName ==========
  console.log('');
  console.log('[89] list-vacaciones — sin companyName');
  var vNoComp = registeredHandlers['gh:list-vacaciones']({}, { token: 'valid-token' });
  _assertEq(vNoComp.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 90: list-permisos sin companyName ==========
  console.log('');
  console.log('[90] list-permisos — sin companyName');
  var pNoComp = registeredHandlers['gh:list-permisos']({}, { token: 'valid-token' });
  _assertEq(pNoComp.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 91: list-documentos sin companyName ==========
  console.log('');
  console.log('[91] list-documentos — sin companyName');
  var dNoComp = registeredHandlers['gh:list-documentos']({}, { token: 'valid-token' });
  _assertEq(dNoComp.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // LEGACY-SIGN-REMOVE (2026-08-20): test 92 (list-firmas sin companyName) eliminado.

  // ========== TEST 93: list-anuncios sin companyName ==========
  console.log('');
  console.log('[93] list-anuncios — sin companyName');
  var aNoComp = registeredHandlers['gh:list-anuncios']({}, { token: 'valid-token' });
  _assertEq(aNoComp.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 94: list-mensajes sin companyName ==========
  console.log('');
  console.log('[94] list-mensajes — sin companyName');
  var mNoComp = registeredHandlers['gh:list-mensajes']({}, { token: 'valid-token' });
  _assertEq(mNoComp.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 95: create-vacacion sin companyName ==========
  console.log('');
  console.log('[95] create-vacacion — sin companyName');
  var vNoComp2 = registeredHandlers['gh:create-vacacion']({}, { token: 'valid-token', data: {} });
  _assertEq(vNoComp2.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // ========== TEST 96: create-permiso sin companyName ==========
  console.log('');
  console.log('[96] create-permiso — sin companyName');
  var pNoComp2 = registeredHandlers['gh:create-permiso']({}, { token: 'valid-token', data: {} });
  _assertEq(pNoComp2.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  // LEGACY-SIGN-REMOVE (2026-08-20): test 97 (create-firma multi-tenant) eliminado.

  // ========== TEST 98: create-documento — multi-tenant ==========
  console.log('');
  console.log('[98] create-documento — multi-tenant');
  var dMulti2 = registeredHandlers['gh:create-documento']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { trabajadorId: bpId3, tipo: 'induccion', titulo: 't', contenido: '{}' }
  });
  _assertEq(dMulti2.error.code, 'TRABAJADOR_NOT_FOUND', 'error.code = TRABAJADOR_NOT_FOUND');

  // ========== TEST 99: PERMISOS — list con filtro trabajadorId ==========
  console.log('');
  console.log('[99] list-permisos — filtro trabajadorId');
  var pTb = registeredHandlers['gh:list-permisos']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', trabajadorId: bpId2
  });
  _assert(pTb.data.count >= 1, 'al menos 1 permiso de bpId2');

  // ========== TEST 100: DOCUMENTOS — list con filtro trabajadorId ==========
  console.log('');
  console.log('[100] list-documentos — filtro trabajadorId');
  var dTb = registeredHandlers['gh:list-documentos']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', trabajadorId: bpId1
  });
  _assert(dTb.data.count >= 1, 'al menos 1 doc de bpId1');

  // ========== TEST 101: ANUNCIOS — list con filtro activo=false ==========
  console.log('');
  console.log('[101] list-anuncios — filtro activo=false');
  var aInact = registeredHandlers['gh:list-anuncios']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', activo: false
  });
  _assert(aInact.data.count >= 1, 'al menos 1 anuncio inactivo (anId1 y anId2)');

  // ========== TEST 102: ANUNCIOS — list sin filtro activo muestra todos ==========
  console.log('');
  console.log('[102] list-anuncios — sin filtro activo');
  var aNoFiltro = registeredHandlers['gh:list-anuncios']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.'
  });
  _assertEq(aNoFiltro.data.count, 2, '2 anuncios totales (activos + inactivos)');

  // ========== TEST 103: ANUNCIOS — update activo de vuelta a 1 ==========
  console.log('');
  console.log('[103] update-anuncio — reactivar');
  var aReact = registeredHandlers['gh:update-anuncio']({}, {
    token: 'valid-token', anuncioId: anId1, updates: { activo: 1 }
  });
  _assert(aReact.success === true, 'update OK');
  var aReactCheck = registeredHandlers['gh:get-anuncio']({}, { token: 'valid-token', anuncioId: anId1 });
  _assertEq(aReactCheck.data.anuncio.activo, 1, 'activo = 1 reactivado');

  // ========== TEST 104: VACACIONES — count global después de soft delete ==========
  console.log('');
  console.log('[104] list-vacaciones — total (incluyendo canceladas)');
  var vAll = registeredHandlers['gh:list-vacaciones']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.'
  });
  // v1 (cancelada) + vN (solicitada) = 2
  _assertEq(vAll.data.count, 2, '2 vacaciones en total (incluye cancelada)');

  // ========== TEST 105: MENSAJES — count con destinatarioId y leido=true ==========
  console.log('');
  console.log('[105] list-mensajes — destinatario + leido=true');
  var mFp = registeredHandlers['gh:list-mensajes']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', destinatarioId: bpId2, leido: true
  });
  _assertEq(mFp.data.count, 1, '1 mensaje leído para bpId2');

  // LEGACY-SIGN-REMOVE (2026-08-20): test 106 (list-firmas filtros combinados) eliminado.

  // ========== TEST 107: ANUNCIOS — update con varios campos válidos ==========
  console.log('');
  console.log('[107] update-anuncio — multi-campos');
  var aMultiUpd = registeredHandlers['gh:update-anuncio']({}, {
    token: 'valid-token', anuncioId: anId1,
    updates: { titulo: 'T1', contenido: 'C1', fechaExpiracion: '2027-01-01', cargoFiltro: 'operario' }
  });
  _assert(aMultiUpd.success === true, 'update multi OK');
  var aMultiUpdCheck = registeredHandlers['gh:get-anuncio']({}, { token: 'valid-token', anuncioId: anId1 });
  _assertEq(aMultiUpdCheck.data.anuncio.titulo, 'T1', 'titulo actualizado');
  _assertEq(aMultiUpdCheck.data.anuncio.contenido, 'C1', 'contenido actualizado');
  _assertEq(aMultiUpdCheck.data.anuncio.fechaExpiracion, '2027-01-01', 'fechaExpiracion actualizado');
  _assertEq(aMultiUpdCheck.data.anuncio.cargoFiltro, 'operario', 'cargoFiltro actualizado');

  // ========== TEST 108: PERMISOS — update multi-campos ==========
  console.log('');
  console.log('[108] update-permiso — multi-campos');
  var pUpdMulti = registeredHandlers['gh:update-permiso']({}, {
    token: 'valid-token', permisoId: peId2,
    updates: { dias: 90, motivo: 'Maternidad oficial', soporteUrl: 'docs/cert.pdf' }
  });
  _assert(pUpdMulti.success === true, 'update OK');
  var pUpdMultiCheck = registeredHandlers['gh:get-permiso']({}, { token: 'valid-token', permisoId: peId2 });
  _assertEq(pUpdMultiCheck.data.permiso.dias, 90, 'dias actualizado');
  _assertEq(pUpdMultiCheck.data.permiso.motivo, 'Maternidad oficial', 'motivo actualizado');
  _assertEq(pUpdMultiCheck.data.permiso.soporteUrl, 'docs/cert.pdf', 'soporteUrl actualizado');

  // ========== TEST 109: VACACIONES — update clienteNotificado=true ==========
  console.log('');
  console.log('[109] update-vacacion — clienteNotificado=true');
  var vUpdCli = registeredHandlers['gh:update-vacacion']({}, {
    token: 'valid-token', vacacionId: vN.data.vacacionId,
    updates: { clienteNotificado: true }
  });
  _assert(vUpdCli.success === true, 'update OK');
  var vUpdCliCheck = registeredHandlers['gh:get-vacacion']({}, { token: 'valid-token', vacacionId: vN.data.vacacionId });
  _assertEq(vUpdCliCheck.data.vacacion.clienteNotificado, 1, 'clienteNotificado guardado');

  // ========== TEST 110: PERMISOS — update id inexistente ==========
  console.log('');
  console.log('[110] update-permiso — id inexistente');
  var pNoId2 = registeredHandlers['gh:update-permiso']({}, {
    token: 'valid-token', permisoId: 'pe-noexiste', updates: { notas: 'x' }
  });
  _assertEq(pNoId2.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 111: DOCUMENTOS — update id inexistente ==========
  console.log('');
  console.log('[111] update-documento — id inexistente');
  var dNoId2 = registeredHandlers['gh:update-documento']({}, {
    token: 'valid-token', documentoId: 'do-noexiste', updates: { titulo: 'x' }
  });
  _assertEq(dNoId2.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 112: ANUNCIOS — update id inexistente ==========
  console.log('');
  console.log('[112] update-anuncio — id inexistente');
  var aNoId2 = registeredHandlers['gh:update-anuncio']({}, {
    token: 'valid-token', anuncioId: 'an-noexiste', updates: { titulo: 'x' }
  });
  _assertEq(aNoId2.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 113: cambiar-estado-vacacion id inexistente ==========
  console.log('');
  console.log('[113] cambiar-estado-vacacion — id inexistente');
  var vNoId3 = registeredHandlers['gh:cambiar-estado-vacacion']({}, {
    token: 'valid-token', vacacionId: 'va-noexiste', nuevoEstado: 'aprobada'
  });
  _assertEq(vNoId3.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 114: delete-vacacion id inexistente ==========
  console.log('');
  console.log('[114] delete-vacacion — id inexistente');
  var vNoId4 = registeredHandlers['gh:delete-vacacion']({}, { token: 'valid-token', vacacionId: 'va-noexiste' });
  _assertEq(vNoId4.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 115: delete-documento id inexistente ==========
  console.log('');
  console.log('[115] delete-documento — id inexistente');
  var dNoId3 = registeredHandlers['gh:delete-documento']({}, { token: 'valid-token', documentoId: 'do-noexiste' });
  _assertEq(dNoId3.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 116: delete-anuncio id inexistente ==========
  console.log('');
  console.log('[116] delete-anuncio — id inexistente');
  var aNoId3 = registeredHandlers['gh:delete-anuncio']({}, { token: 'valid-token', anuncioId: 'an-noexiste' });
  _assertEq(aNoId3.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 117: finalizar-permiso id inexistente ==========
  console.log('');
  console.log('[117] finalizar-permiso — id inexistente');
  var pNoId3 = registeredHandlers['gh:finalizar-permiso']({}, { token: 'valid-token', permisoId: 'pe-noexiste' });
  _assertEq(pNoId3.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // ========== TEST 118: marcar-leido id inexistente ==========
  console.log('');
  console.log('[118] marcar-leido — id inexistente');
  var mNoId3 = registeredHandlers['gh:marcar-leido']({}, { token: 'valid-token', mensajeId: 'me-noexiste' });
  _assertEq(mNoId3.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  // LEGACY-SIGN-REMOVE (2026-08-20): tests 119, 120 (firmar-documento error cases) eliminados.

  // ========== TEST 121: PERMISOS — create con tipo=licencia_no_remunerada ==========
  console.log('');
  console.log('[121] create-permiso — tipo=licencia_no_remunerada');
  var pLic = registeredHandlers['gh:create-permiso']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { trabajadorId: bpId1, tipo: 'licencia_no_remunerada', fechaInicio: '2026-11-01' }
  });
  _assert(pLic.success === true, 'create OK');
  var pLicCheck = registeredHandlers['gh:get-permiso']({}, { token: 'valid-token', permisoId: pLic.data.permisoId });
  _assertEq(pLicCheck.data.permiso.tipo, 'licencia_no_remunerada', 'tipo guardado');

  // ========== TEST 122: PERMISOS — create con todos los tipos válidos ==========
  console.log('');
  console.log('[122] create-permiso — 8 tipos válidos');
  var tiposValidos = ['incapacidad', 'maternidad', 'paternidad', 'luto', 'permiso_personal', 'cita_medica', 'calamidad', 'licencia_no_remunerada'];
  tiposValidos.forEach(function(tipo) {
    var r = registeredHandlers['gh:create-permiso']({}, {
      token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.',
      data: { trabajadorId: bpId1, tipo: tipo, fechaInicio: '2026-08-20' }
    });
    _assert(r.success === true, 'create tipo=' + tipo + ' OK');
  });

  // ========== TEST 123: DOCUMENTOS — create con todos los 7 tipos válidos ==========
  console.log('');
  console.log('[123] create-documento — 7 tipos válidos');
  var tiposDoc = ['autorizacion_datos', 'autorizacion_hojas_vida', 'actualizacion_datos', 'induccion', 'contrato', 'carta_examenes', 'carta_cuenta_bancaria'];
  tiposDoc.forEach(function(tipo) {
    var r = registeredHandlers['gh:create-documento']({}, {
      token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.',
      data: { trabajadorId: bpId1, tipo: tipo, titulo: 'Doc ' + tipo, contenido: '{}' }
    });
    _assert(r.success === true, 'create doc tipo=' + tipo + ' OK');
  });

  // ========== TEST 124: ANUNCIOS — create con todos los 4 tipos válidos ==========
  console.log('');
  console.log('[124] create-anuncio — 4 tipos válidos');
  var tiposAn = ['info', 'urgente', 'mantenimiento', 'evento'];
  tiposAn.forEach(function(tipo) {
    var r = registeredHandlers['gh:create-anuncio']({}, {
      token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.',
      data: { titulo: 'An ' + tipo, contenido: 'C', tipo: tipo, fechaPublicacion: '2026-08-15', publicadoPor: 'X' }
    });
    _assert(r.success === true, 'create an tipo=' + tipo + ' OK');
  });

  // ========== TEST 125: MENSAJES — create con las 3 prioridades válidas ==========
  console.log('');
  console.log('[125] create-mensaje — 3 prioridades válidas');
  var prioMs = ['baja', 'normal', 'alta'];
  prioMs.forEach(function(p) {
    var r = registeredHandlers['gh:create-mensaje']({}, {
      token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.',
      data: { remitenteId: bpId1, destinatarioId: bpId2, asunto: 'P ' + p, contenido: 'C', prioridad: p }
    });
    _assert(r.success === true, 'create mensaje prioridad=' + p + ' OK');
  });

  // ========== TEST 126: ANUNCIOS — list filtrado por tipo=mantenimiento ==========
  console.log('');
  console.log('[126] list-anuncios — filtro tipo=mantenimiento');
  var aMant = registeredHandlers['gh:list-anuncios']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', tipo: 'mantenimiento'
  });
  _assert(aMant.data.count >= 1, 'al menos 1 anuncio de mantenimiento');

  // ========== TEST 127: ANUNCIOS — create con dirigidoA=cargo ==========
  console.log('');
  console.log('[127] create-anuncio — dirigidoA=cargo');
  var aCargo = registeredHandlers['gh:create-anuncio']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { titulo: 'Para operarios', contenido: 'X', dirigidoA: 'cargo', cargoFiltro: 'operario', fechaPublicacion: '2026-08-15', publicadoPor: 'RRHH' }
  });
  _assert(aCargo.success === true, 'create OK');
  _assert(aCargo.data.anuncioId, 'anuncioId devuelto');

  // ========== TEST 128: ANUNCIOS — create con dirigidoA=trabajador ==========
  console.log('');
  console.log('[128] create-anuncio — dirigidoA=trabajador');
  var aTrab = registeredHandlers['gh:create-anuncio']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { titulo: 'Personal', contenido: 'X', dirigidoA: 'trabajador', fechaPublicacion: '2026-08-15', publicadoPor: 'RRHH' }
  });
  _assert(aTrab.success === true, 'create OK');

  // ========== TEST 129: ANUNCIOS — list filtrado por tipo=evento ==========
  console.log('');
  console.log('[129] list-anuncios — filtro tipo=evento');
  var aEv = registeredHandlers['gh:list-anuncios']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', tipo: 'evento'
  });
  _assert(aEv.data.count >= 1, 'al menos 1 anuncio de evento');

  // ========== TEST 130: ANUNCIOS — list filtrado por tipo=urgente ==========
  console.log('');
  console.log('[130] list-anuncios — filtro tipo=urgente');
  var aUrg = registeredHandlers['gh:list-anuncios']({}, {
    token: 'valid-token', companyName: 'TEMPOACTIVA EST S.A.S.', tipo: 'urgente'
  });
  _assert(aUrg.data.count >= 1, 'al menos 1 anuncio urgente');

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
