// main/test-gestion-humana-bridge-e2e.js
// Tests E2E de los flujos 1.0-B / 1.0-C / 1.0-D-1 / 1.0-D-2 / 1.0-E / 1.0-F-1
// Patrón: SCHEMA_SQL + MIGRATIONS_SQL sobre :memory: (sql.js), mocks de electron/ipcMain.
// NO toca kair.db ni archivos de producción.
//
// Ejecutar: node main/test-gestion-humana-bridge-e2e.js
// Esperado: 60+ OK · 0 FAIL

const initSqlJs = require('sql.js');
const { SCHEMA_SQL, MIGRATIONS_SQL } = require('./gestion-humana-schema-sql');
const { registerGestionHumanaHandlers } = require('./gestion-humana-bridge');

let _passed = 0;
let _failed = 0;
const _log = [];

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

// Wrapper sql.js → better-sqlite3 (mismo patrón que test-schema, que SÍ funciona)
// CRÍTICO: sql.js Statement.bind() espera un ARRAY, no argumentos variádicos.
//   ✓ stmt.bind([arg1, arg2])     ← funciona
//   ✗ stmt.bind(arg1, arg2)       ← falla silenciosamente
//   ✗ stmt.bind.apply(stmt, args) ← falla silenciosamente (causa del bug 1.0-G-1)
function _wrapSqlJsAsBetterSqlite(sqlJsDb) {
  function _exec(sql, args) {
    var stmt = sqlJsDb.prepare(sql);
    try {
      if (args && args.length > 0) stmt.bind(args);
      stmt.step();
    } finally { stmt.reset(); stmt.free(); }
  }
  return {
    exec: function (sql) { return sqlJsDb.exec(sql); },
    run: function (sql) {
      _exec(sql, Array.prototype.slice.call(arguments, 1));
    },
    prepare: function (sql) {
      return {
        get: function () {
          var stmt = sqlJsDb.prepare(sql);
          try {
            var args = Array.prototype.slice.call(arguments);
            if (args.length > 0) stmt.bind(args);
            if (stmt.step()) return stmt.getAsObject();
            return undefined;
          } finally { stmt.reset(); stmt.free(); }
        },
        all: function () {
          var stmt = sqlJsDb.prepare(sql);
          try {
            var args = Array.prototype.slice.call(arguments);
            if (args.length > 0) stmt.bind(args);
            var rows = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            return rows;
          } finally { stmt.reset(); stmt.free(); }
        },
        run: function () {
          _exec(sql, Array.prototype.slice.call(arguments));
        }
      };
    },
    close: function () { sqlJsDb.close(); }
  };
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FASE 1.0-G · TESTS E2E DE LOS FLUJOS DEL BP');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // ============================================================
  // SETUP
  // ============================================================
  console.log('[1] Cargando sql.js y aplicando schema + migrations...');
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();
  rawDb.exec(SCHEMA_SQL);
  // Aplicar migrations con try/catch (idempotente, mismo patrón que test-schema)
  MIGRATIONS_SQL.forEach(function (sql) {
    try { rawDb.exec(sql); } catch (e) { /* idempotent: ignore */ }
  });
  // Tabla companies (no está en schema base)
  rawDb.exec("CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, company_key TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL);");
  rawDb.run("INSERT INTO companies (id, company_key, display_name) VALUES (?, ?, ?)",
    ['co-tempoactiva', 'tempoactiva', 'TEMPOACTIVA EST S.A.S.']);
  const db = _wrapSqlJsAsBetterSqlite(rawDb);
  console.log('  ✓ Schema + Migrations aplicados, empresa TEMPOACTIVA creada');

  // Contadores para asserts de "no se insertó nada nuevo"
  const _countBp = () => db.prepare('SELECT COUNT(*) AS n FROM base_personal').get().n;
  const _countCt = () => db.prepare('SELECT COUNT(*) AS n FROM contrataciones').get().n;
  const _countEventos = () => db.prepare('SELECT COUNT(*) AS n FROM gh_eventos_personal').get().n;
  const _countVac = () => db.prepare('SELECT COUNT(*) AS n FROM gh_vacaciones').get().n;
  const _countPerm = () => db.prepare('SELECT COUNT(*) AS n FROM gh_permisos').get().n;
  const _countDocs = () => db.prepare('SELECT COUNT(*) AS n FROM gh_documentos').get().n;
  const _countDocsAfil = () => db.prepare('SELECT COUNT(*) AS n FROM gh_documentos_afiliaciones').get().n;
  const _countMensajes = () => db.prepare('SELECT COUNT(*) AS n FROM gh_mensajes').get().n;

  // Datos de prueba
  const now = '2025-09-01T10:00:00.000Z';
  const fechaRetiro = '2024-08-15T00:00:00.000Z';
  const fechaIngresoRetirado = '2022-01-15';
  const cargoRetirado = 'Operario';
  const salarioRetirado = 1500000;

  // bp-ACTIVO: estado=activo, activo=1
  // Usar rawDb.exec con literales (sin placeholders) para evitar el bug de bind con sql.js
  // Incluye TODAS las columnas que sql.js considera NOT NULL (id, empresa_id, nombres, apellidos, cedula, created_at, updated_at)
  rawDb.exec("INSERT INTO base_personal (id, empresa_id, nombres, apellidos, cedula, tipo_documento, cargo, salario, fecha_ingreso, estado, activo, created_at, updated_at) VALUES " +
    "('bp-ACTIVO-001', 'tempoactiva', 'Ana', 'Activa', '111111111', 'CC', 'Auxiliar', 1200000, '2020-05-10', 'activo', 1, '" + now + "', '" + now + "')");

  // bp-RETIRADO: estado=retirado, activo=1, fecha_retiro, con historial
  rawDb.exec("INSERT INTO base_personal (id, empresa_id, nombres, apellidos, cedula, tipo_documento, cargo, salario, fecha_ingreso, fecha_retiro, estado, activo, created_at, updated_at) VALUES " +
    "('bp-RETIRADO-001', 'tempoactiva', 'Juan', 'Retirado', '222222222', 'CC', '" + cargoRetirado + "', " + salarioRetirado + ", '" + fechaIngresoRetirado + "', '" + fechaRetiro + "', 'retirado', 1, '" + now + "', '" + fechaRetiro + "')");

  // bp-OCULTO: estado=retirado, activo=0
  rawDb.exec("INSERT INTO base_personal (id, empresa_id, nombres, apellidos, cedula, tipo_documento, cargo, salario, fecha_ingreso, fecha_retiro, estado, activo, created_at, updated_at) VALUES " +
    "('bp-OCULTO-001', 'tempoactiva', 'Pedro', 'Oculto', '333333333', 'CC', 'Conductor', 1300000, '2019-03-20', '2023-12-01T00:00:00.000Z', 'retirado', 0, '" + now + "', '2023-12-01T00:00:00.000Z')");

  // bp-DUPLICADO: estado=activo, cedula='1234567890' (para test de CEDULA_DUPLICADA)
  rawDb.exec("INSERT INTO base_personal (id, empresa_id, nombres, apellidos, cedula, tipo_documento, cargo, salario, fecha_ingreso, estado, activo, created_at, updated_at) VALUES " +
    "('bp-DUPLICADO-001', 'tempoactiva', 'Luis', 'Duplicado', '1234567890', 'CC', 'Operario', 1400000, '2021-01-01', 'activo', 1, '" + now + "', '" + now + "')");

  // Relaciones del bp-RETIRADO (para verificar preservación en test 6)
  rawDb.exec("INSERT INTO gh_vacaciones (id, trabajador_id, empresa_id, fecha_solicitud, fecha_inicio, fecha_fin, dias_solicitados, estado, created_at, updated_at) VALUES " +
    "('vac-ret-1', 'bp-RETIRADO-001', 'tempoactiva', '2023-05-01', '2023-06-01', '2023-06-15', 14, 'disfrutada', '" + now + "', '" + now + "')");
  rawDb.exec("INSERT INTO gh_permisos (id, trabajador_id, empresa_id, tipo, fecha_inicio, fecha_fin, dias, estado, created_at, updated_at) VALUES " +
    "('per-ret-1', 'bp-RETIRADO-001', 'tempoactiva', 'permiso_personal', '2023-08-01', '2023-08-03', 3, 'finalizado', '" + now + "', '" + now + "')");
  rawDb.exec("INSERT INTO gh_documentos (id, trabajador_id, empresa_id, tipo, titulo, contenido, estado, version, created_at, updated_at) VALUES " +
    "('doc-ret-1', 'bp-RETIRADO-001', 'tempoactiva', 'contrato', 'Contrato 2022', '{}', 'firmado', 1, '" + now + "', '" + now + "')");
  rawDb.exec("INSERT INTO gh_documentos_afiliaciones (id, trabajador_id, empresa_id, tipo_afiliacion, nombre_archivo, ruta_archivo, fecha_subida, created_at, updated_at) VALUES " +
    "('daf-ret-1', 'bp-RETIRADO-001', 'tempoactiva', 'eps', 'certificado.pdf', '/ruta/cert.pdf', '" + now + "', '" + now + "', '" + now + "')");
  rawDb.exec("INSERT INTO gh_mensajes (id, empresa_id, remitente_id, destinatario_id, asunto, contenido, created_at) VALUES " +
    "('msg-ret-1', 'tempoactiva', 'bp-RETIRADO-001', 'bp-ACTIVO-001', 'Bienvenida', 'Hola', '" + now + "')");
  console.log('  ✓ Datos de prueba: 4 bp + 5 relaciones del bp-RETIRADO-001');

  // Estado inicial
  const initBp = _countBp();
  const initCt = _countCt();
  const initEventos = _countEventos();
  const initVac = _countVac();
  const initPerm = _countPerm();
  const initDocs = _countDocs();
  const initDocsAfil = _countDocsAfil();
  const initMensajes = _countMensajes();

  // Mock electron/ipcMain
  console.log('');
  console.log('[2] Registrando bridge con mocks...');
  const registeredHandlers = {};
  const mockIpcMain = { handle: function (ch, fn) { registeredHandlers[ch] = fn; } };
  registerGestionHumanaHandlers.init(mockIpcMain);
  registerGestionHumanaHandlers({ on: function () {} }, {
    getDb: function () { return db; },
    validateSession: function () { return { ok: true, user: { id: 1, isAdmin: true } }; }
  });
  console.log('  ✓ Bridge registrado con 56+ handlers');

  // Helper: invocar handler
  const call = (ch, payload) => {
    const fn = registeredHandlers[ch];
    if (!fn) throw new Error('Handler no registrado: ' + ch);
    return fn({}, payload);
  };

  // ============================================================
  // TEST 1 · ACTIVO → RETIRADO + evento RETIRO
  // ============================================================
  console.log('');
  console.log('[T1] ACTIVO → RETIRADO + evento RETIRO');
  const r1 = call('gh:cambiar-estado', {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.',
    personalId: 'bp-ACTIVO-001', estado: 'retirado', fechaRetiro: fechaRetiro
  });
  if (!r1 || r1.success !== true) {
    console.log('  DEBUG r1:', JSON.stringify(r1));
  }
  _assertEq(r1 && r1.success, true, 'T1.1 success=true');
  _assertEq(r1.data.estado, 'retirado', 'T1.2 data.estado=retirado');
  _assertEq(r1.data.fechaRetiro, fechaRetiro, 'T1.3 data.fechaRetiro=fechaRetiro');
  const bpT1 = db.prepare('SELECT estado, fecha_retiro FROM base_personal WHERE id = ?').get('bp-ACTIVO-001');
  _assertEq(bpT1.estado, 'retirado', 'T1.4 bp.estado=retirado en BD');
  _assertEq(bpT1.fecha_retiro, fechaRetiro, 'T1.5 bp.fecha_retiro=fechaRetiro en BD');
  const evt1Count = _countEventos();
  _assertEq(evt1Count, 1, 'T1.6 1 evento insertado');
  const evt1 = db.prepare("SELECT * FROM gh_eventos_personal WHERE id IS NOT NULL AND tipo_evento = 'RETIRO'").get();
  _assert(evt1 !== undefined, 'T1.7 evento RETIRO existe');
  if (evt1) {
    _assertEq(evt1.estado_anterior, 'activo', 'T1.8 evento.estado_anterior=activo');
    _assertEq(evt1.estado_nuevo, 'retirado', 'T1.9 evento.estado_nuevo=retirado');
    _assertEq(evt1.trabajador_id, 'bp-ACTIVO-001', 'T1.10 evento.trabajador_id correcto');
    _assertEq(evt1.contratacion_id, null, 'T1.11 evento.contratacion_id=NULL (RETIRO no es RECONTRATACION)');
    const meta1 = JSON.parse(evt1.metadata);
    _assertEq(meta1.fuente, 'cambiar-estado', 'T1.12 metadata.fuente=cambiar-estado');
  }

  // ============================================================
  // TEST 2 · RETIRADO → REINGRESO + evento REINGRESO
  // ============================================================
  console.log('');
  console.log('[T2] RETIRADO → REINGRESO + evento REINGRESO');
  const r2 = call('gh:cambiar-estado', {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.',
    personalId: 'bp-ACTIVO-001', estado: 'activo'
  });
  _assertEq(r2.success, true, 'T2.1 success=true');
  _assertEq(r2.data.estado, 'activo', 'T2.2 data.estado=activo');
  const bpT2 = db.prepare('SELECT estado, fecha_retiro FROM base_personal WHERE id = ?').get('bp-ACTIVO-001');
  _assertEq(bpT2.estado, 'activo', 'T2.3 bp.estado=activo en BD');
  _assertEq(bpT2.fecha_retiro, null, 'T2.4 bp.fecha_retiro=NULL (limpio en reactivación)');
  _assertEq(_countEventos(), 2, 'T2.5 2 eventos en total (1 RETIRO + 1 REINGRESO)');
  const evt2 = db.prepare("SELECT * FROM gh_eventos_personal WHERE tipo_evento = 'REINGRESO'").get();
  _assert(evt2 !== undefined, 'T2.6 evento REINGRESO existe');
  if (evt2) {
    _assertEq(evt2.estado_anterior, 'retirado', 'T2.7 evento.estado_anterior=retirado');
    _assertEq(evt2.estado_nuevo, 'activo', 'T2.8 evento.estado_nuevo=activo');
    _assertEq(evt2.fecha_referencia, fechaRetiro, 'T2.9 evento.fecha_referencia=fechaRetiro (preservada)');
    _assertEq(evt2.contratacion_id, null, 'T2.10 evento.contratacion_id=NULL (REINGRESO sin CT)');
  }

  // ============================================================
  // TEST 3 · RETIRADO → RECONTRATACIÓN atómico
  // Setup: primero retiramos bp-RETIRADO-001 (nuevamente) via cambiar-estado
  // (en este test, bp-RETIRADO-001 YA está retirado desde el setup)
  // ============================================================
  console.log('');
  console.log('[T3] RETIRADO → RECONTRATACIÓN atómico (INSERT CT + UPDATE bp + INSERT evento)');
  const r3 = call('gh:recontratar-personal', {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.',
    bpId: 'bp-RETIRADO-001',
    contratacionData: {
      nombres: 'Juan', apellidos: 'Retirado', cedula: '222222222',
      telefono: '3009998877', cargo: 'Operario Senior', salario: 1800000,
      fechaIngreso: '2025-10-01', sedeId: 'se-2', empresaUsuaria: 'Cliente X'
    },
    motivo: 'Recontratación desde E2E test'
  });
  _assertEq(r3.success, true, 'T3.1 success=true');
  _assertEq(r3.data.bpId, 'bp-RETIRADO-001', 'T3.2 data.bpId correcto');
  _assertEq(r3.data.estado, 'activo', 'T3.3 data.estado=activo');
  _assertEq(r3.data.fechaRetiro, null, 'T3.4 data.fechaRetiro=null (limpio)');
  _assert(r3.data.contratacionId && r3.data.contratacionId.indexOf('ct-') === 0, 'T3.5 data.contratacionId con prefijo ct-');
  _assert(r3.data.eventoId && r3.data.eventoId.indexOf('ev-') === 0, 'T3.6 data.eventoId con prefijo ev-');
  // BD: bp actualizado
  const bpT3 = db.prepare('SELECT estado, fecha_retiro, cargo, salario, fecha_ingreso FROM base_personal WHERE id = ?').get('bp-RETIRADO-001');
  _assertEq(bpT3.estado, 'activo', 'T3.7 bp.estado=activo en BD');
  _assertEq(bpT3.fecha_retiro, null, 'T3.8 bp.fecha_retiro=null en BD');
  _assertEq(bpT3.cargo, 'Operario Senior', 'T3.9 bp.cargo actualizado al del form');
  _assertEq(bpT3.salario, 1800000, 'T3.10 bp.salario actualizado al del form');
  _assertEq(bpT3.fecha_ingreso, '2025-10-01', 'T3.11 bp.fecha_ingreso actualizado al del form (NUEVO ciclo)');
  // BD: CT creada y vinculada
  const ctT3 = db.prepare('SELECT * FROM contrataciones WHERE id = ?').get(r3.data.contratacionId);
  _assert(ctT3 !== undefined, 'T3.12 CT creada en BD');
  if (ctT3) {
    _assertEq(ctT3.trabajador_id, 'bp-RETIRADO-001', 'T3.13 CT.trabajador_id vinculado al bp');
    _assertEq(ctT3.estado, 'en_proceso', 'T3.14 CT.estado=en_proceso');
    _assertEq(ctT3.paso_actual, 1, 'T3.15 CT.paso_actual=1');
    _assertEq(ctT3.cargo, 'Operario Senior', 'T3.16 CT.cargo del form');
  }
  // Evento RECONTRATACION
  const evt3 = db.prepare("SELECT * FROM gh_eventos_personal WHERE tipo_evento = 'RECONTRATACION' AND trabajador_id = 'bp-RETIRADO-001'").get();
  _assert(evt3 !== undefined, 'T3.17 evento RECONTRATACION existe');
  if (evt3) {
    _assertEq(evt3.estado_anterior, 'retirado', 'T3.18 evento.estado_anterior=retirado');
    _assertEq(evt3.estado_nuevo, 'activo', 'T3.19 evento.estado_nuevo=activo');
    _assertEq(evt3.fecha_referencia, fechaRetiro, 'T3.20 evento.fecha_referencia=fechaRetiro (preservada)');
    _assertEq(evt3.contratacion_id, r3.data.contratacionId, 'T3.21 evento.contratacion_id=new CT');
    const meta3 = JSON.parse(evt3.metadata);
    _assertEq(meta3.cargoAnterior, cargoRetirado, 'T3.22 metadata.cargoAnterior preservado');
    _assertEq(meta3.salarioAnterior, salarioRetirado, 'T3.23 metadata.salarioAnterior preservado');
    _assertEq(meta3.fechaRetiroAnterior, fechaRetiro, 'T3.24 metadata.fechaRetiroAnterior preservado');
    _assertEq(meta3.cargoNuevo, 'Operario Senior', 'T3.25 metadata.cargoNuevo');
    _assertEq(meta3.fuente, 'recontratacion-personal', 'T3.26 metadata.fuente');
  }

  // ============================================================
  // TEST 4 · ROLLBACK de recontratación (vía CEDULA_MISMATCH)
  // Setup: necesitamos un bp retirado. Vamos a re-retirar bp-ACTIVO-001 (ya tiene ciclo completo de test 1+2)
  // ============================================================
  console.log('');
  console.log('[T4] ROLLBACK de recontratación ante fallo (CEDULA_MISMATCH)');
  // Re-retirar bp-ACTIVO-001 para tener otro bp retirado
  const r4pre = call('gh:cambiar-estado', {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.',
    personalId: 'bp-ACTIVO-001', estado: 'retirado', fechaRetiro: fechaRetiro
  });
  _assertEq(r4pre.success, true, 'T4.0 pre-setup: bp-ACTIVO-001 re-retirado para test 4');
  const eventosAntes = _countEventos();
  const ctAntes = _countCt();
  // Snapshot del bp antes del intento fallido
  const bpT4Pre = db.prepare('SELECT estado, fecha_retiro, cargo, salario FROM base_personal WHERE id = ?').get('bp-ACTIVO-001');
  // Intentar recontratar con cedula MISMATCH
  const r4 = call('gh:recontratar-personal', {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.',
    bpId: 'bp-ACTIVO-001',
    contratacionData: {
      nombres: 'Ana', apellidos: 'Activa', cedula: '999999999',  // ← NO matchea
      cargo: 'Auxiliar', fechaIngreso: '2025-11-01'
    }
  });
  _assertEq(r4.success, false, 'T4.1 success=false');
  _assertEq(r4.error.code, 'CEDULA_MISMATCH', 'T4.2 error.code=CEDULA_MISMATCH');
  // ROLLBACK: bp intacto
  const bpT4Post = db.prepare('SELECT estado, fecha_retiro, cargo, salario FROM base_personal WHERE id = ?').get('bp-ACTIVO-001');
  _assertEq(bpT4Post.estado, bpT4Pre.estado, 'T4.3 bp.estado intacto (rollback)');
  _assertEq(bpT4Post.fecha_retiro, bpT4Pre.fecha_retiro, 'T4.4 bp.fecha_retiro intacto (rollback)');
  _assertEq(bpT4Post.cargo, bpT4Pre.cargo, 'T4.5 bp.cargo intacto (rollback)');
  _assertEq(bpT4Post.salario, bpT4Pre.salario, 'T4.6 bp.salario intacto (rollback)');
  // ROLLBACK: 0 CT nuevas
  _assertEq(_countCt(), ctAntes, 'T4.7 0 CT nuevas (rollback)');
  // ROLLBACK: 0 eventos nuevos (el RETIRO del pre-setup YA se contó en eventosAntes)
  _assertEq(_countEventos(), eventosAntes, 'T4.8 0 eventos nuevos (rollback — el RETIRO del pre-setup ya está en eventosAntes)');

  // ============================================================
  // TEST 5 · ACTIVO + crear CT bloqueado (cédula de bp activo)
  // ============================================================
  console.log('');
  console.log('[T5] ACTIVO + crear CT bloqueado por cédula de bp activo');
  // Reactivar bp-ACTIVO-001 (que está retirado por T4.0)
  const r5pre = call('gh:cambiar-estado', {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.',
    personalId: 'bp-ACTIVO-001', estado: 'activo'
  });
  _assertEq(r5pre.success, true, 'T5.0 pre-setup: bp-ACTIVO-001 reactivado para test 5');
  const eventosAntes5 = _countEventos();
  const bpDupPre = db.prepare('SELECT id, estado, activo FROM base_personal WHERE id = ?').get('bp-DUPLICADO-001');
  _assertEq(bpDupPre.estado, 'activo', 'T5.0.bis bp-DUPLICADO-001 sigue activo (precondición)');
  // Intentar crear CT con la cédula de bp-DUPLICADO-001
  const r5 = call('gh:create-contratacion', {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.',
    data: {
      nombres: 'Otro', apellidos: 'Persona', cedula: '1234567890',  // ← cédula de bp-DUPLICADO-001
      cargo: 'Operario', fechaIngreso: '2025-10-01'
    }
  });
  _assertEq(r5.success, false, 'T5.1 success=false');
  _assertEq(r5.error.code, 'CEDULA_DUPLICADA', 'T5.2 error.code=CEDULA_DUPLICADA');
  _assertEq(r5.error.extra && r5.error.extra.existingId, 'bp-DUPLICADO-001', 'T5.3 error.extra.existingId');
  _assertEq(r5.error.extra && r5.error.extra.existingEstado, 'activo', 'T5.4 error.extra.existingEstado=activo');
  // bp-DUPLICADO-001 intacto
  const bpDupPost = db.prepare('SELECT estado, activo FROM base_personal WHERE id = ?').get('bp-DUPLICADO-001');
  _assertEq(bpDupPost.estado, 'activo', 'T5.5 bp-DUPLICADO-001 intacto');
  // 0 eventos nuevos
  _assertEq(_countEventos(), eventosAntes5, 'T5.6 0 eventos nuevos');

  // ============================================================
  // TEST 6 · RETIRADO + ocultar (soft delete puro)
  // Setup: bp-RETIRADO-001 está activo (recontratado en T3). Lo re-retiramos.
  // ============================================================
  console.log('');
  console.log('[T6] RETIRADO + ocultar (soft delete puro)');
  const r6pre = call('gh:cambiar-estado', {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.',
    personalId: 'bp-RETIRADO-001', estado: 'retirado', fechaRetiro: fechaRetiro
  });
  _assertEq(r6pre.success, true, 'T6.0 pre-setup: bp-RETIRADO-001 re-retirado');
  const eventosAntes6 = _countEventos();
  const r6 = call('gh:delete-personal', {
    token: 't', personalId: 'bp-RETIRADO-001'
  });
  _assertEq(r6.success, true, 'T6.1 success=true');
  _assertEq(r6.data.activo, 0, 'T6.2 data.activo=0');
  _assertEq(r6.data.estado, 'retirado', 'T6.3 data.estado=retirado (intacto)');
  _assertEq(r6.data.fechaRetiro, fechaRetiro, 'T6.4 data.fechaRetiro preservado (intacto)');
  // BD: bp actualizado SOLO en activo
  const bpT6 = db.prepare('SELECT estado, activo, fecha_retiro, cargo, salario FROM base_personal WHERE id = ?').get('bp-RETIRADO-001');
  _assertEq(bpT6.activo, 0, 'T6.5 bp.activo=0 en BD');
  _assertEq(bpT6.estado, 'retirado', 'T6.6 bp.estado=retirado (intacto)');
  _assertEq(bpT6.fecha_retiro, fechaRetiro, 'T6.7 bp.fecha_retiro=fechaRetiro (intacto)');
  _assertEq(bpT6.cargo, 'Operario Senior', 'T6.8 bp.cargo intacto (no se modificó)');
  _assertEq(bpT6.salario, 1800000, 'T6.9 bp.salario intacto');
  // FKs preservadas (NO CASCADE)
  _assertEq(_countVac(), initVac, 'T6.10 gh_vacaciones preservadas (no CASCADE)');
  _assertEq(_countPerm(), initPerm, 'T6.11 gh_permisos preservados (no CASCADE)');
  _assertEq(_countDocs(), initDocs, 'T6.12 gh_documentos preservados (no CASCADE)');
  _assertEq(_countDocsAfil(), initDocsAfil, 'T6.13 gh_documentos_afiliaciones preservados (no CASCADE)');
  _assertEq(_countMensajes(), initMensajes, 'T6.14 gh_mensajes preservados (no CASCADE)');
  // NO evento de ocultamiento
  _assertEq(_countEventos(), eventosAntes6, 'T6.15 NO evento de ocultamiento');

  // ============================================================
  // TEST 7 · ACTIVO + ocultar → BP_NOT_RETIRED
  // ============================================================
  console.log('');
  console.log('[T7] ACTIVO + ocultar → BP_NOT_RETIRED');
  const r7 = call('gh:delete-personal', {
    token: 't', personalId: 'bp-ACTIVO-001'
  });
  _assertEq(r7.success, false, 'T7.1 success=false');
  _assertEq(r7.error.code, 'BP_NOT_RETIRED', 'T7.2 error.code=BP_NOT_RETIRED');
  const bpT7 = db.prepare('SELECT estado, activo FROM base_personal WHERE id = ?').get('bp-ACTIVO-001');
  _assertEq(bpT7.activo, 1, 'T7.3 bp.activo sin cambios');
  _assertEq(bpT7.estado, 'activo', 'T7.4 bp.estado sin cambios');

  // ============================================================
  // TEST 8 · BP oculto → BP_DELETED en recontratación
  // ============================================================
  console.log('');
  console.log('[T8] BP oculto → BP_DELETED en recontratación');
  const r8 = call('gh:recontratar-personal', {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.',
    bpId: 'bp-OCULTO-001',  // ← ya está activo=0
    contratacionData: {
      nombres: 'Pedro', apellidos: 'Oculto', cedula: '333333333',
      cargo: 'Conductor', fechaIngreso: '2025-10-01'
    }
  });
  _assertEq(r8.success, false, 'T8.1 success=false');
  _assertEq(r8.error.code, 'BP_DELETED', 'T8.2 error.code=BP_DELETED');

  // ============================================================
  // TEST 9 · Aislamiento (kair.db nunca se abre)
  // ============================================================
  console.log('');
  console.log('[T9] Aislamiento · NO se abre kair.db');
  _assert(initBp === 4, 'T9.1 conteo inicial de bp = 4 (no se filtraron datos reales)');
  _assert(_countBp() === 4, 'T9.2 conteo actual de bp = 4 (test no agregó bp reales)');
  _assert(_countBp() < 100, 'T9.3 conteo de bp < 100 (confirmación de que NO se cargaron 763 bp reales)');
  console.log('  (Test usa sql.js :memory: — kair.db NUNCA se abre)');

  // ============================================================
  // TEST 10 · Las 3 fechas distintas
  // Setup: ejecutar recontratación con fechaIngreso del form (FUTURO) + fechaRecontratacion (HOY)
  // ============================================================
  console.log('');
  console.log('[T10] Las 3 fechas no se confunden (CT.fecha_ingreso ≠ evento.fecha_evento ≠ evento.fecha_referencia)');
  // Necesitamos un bp retirado. bp-ACTIVO-001 está activo (no sirve). Vamos a re-retirarlo.
  const r10pre = call('gh:cambiar-estado', {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.',
    personalId: 'bp-ACTIVO-001', estado: 'retirado', fechaRetiro: fechaRetiro
  });
  _assertEq(r10pre.success, true, 'T10.0 pre-setup: bp-ACTIVO-001 re-retirado');
  // Recontratar con fechaIngreso del form = 2025-11-15 (FUTURO) + fechaRecontratacion = now
  const r10 = call('gh:recontratar-personal', {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.',
    bpId: 'bp-ACTIVO-001',
    contratacionData: {
      nombres: 'Ana', apellidos: 'Activa', cedula: '111111111',
      cargo: 'Auxiliar', fechaIngreso: '2025-11-15'  // FUTURO
    },
    fechaRecontratacion: '2025-09-01T10:00:00.000Z'  // HOY
  });
  _assertEq(r10.success, true, 'T10.1 success=true');
  const ctT10 = db.prepare('SELECT fecha_ingreso FROM contrataciones WHERE id = ?').get(r10.data.contratacionId);
  const bpT10 = db.prepare('SELECT fecha_ingreso FROM base_personal WHERE id = ?').get('bp-ACTIVO-001');
  const evtT10 = db.prepare('SELECT fecha_evento, fecha_referencia FROM gh_eventos_personal WHERE id = ?').get(r10.data.eventoId);
  _assertEq(ctT10.fecha_ingreso, '2025-11-15', 'T10.2 CT.fecha_ingreso=2025-11-15 (FUTURO, del form)');
  _assertEq(bpT10.fecha_ingreso, '2025-11-15', 'T10.3 BP.fecha_ingreso=2025-11-15 (sincronizado)');
  _assertEq(evtT10.fecha_evento, '2025-09-01T10:00:00.000Z', 'T10.4 evento.fecha_evento=2025-09-01T10:00 (HOY)');
  _assertEq(evtT10.fecha_referencia, fechaRetiro, 'T10.5 evento.fecha_referencia=fechaRetiro (HISTÓRICO)');
  _assert(ctT10.fecha_ingreso !== evtT10.fecha_evento, 'T10.6 CT.fecha_ingreso ≠ evento.fecha_evento');
  _assert(evtT10.fecha_evento !== evtT10.fecha_referencia, 'T10.7 evento.fecha_evento ≠ evento.fecha_referencia');
  _assert(ctT10.fecha_ingreso !== evtT10.fecha_referencia, 'T10.8 CT.fecha_ingreso ≠ evento.fecha_referencia');

  // ============================================================
  // TEST 11 · CEDULA_MISMATCH con rollback completo
  // ============================================================
  console.log('');
  console.log('[T11] CEDULA_MISMATCH con rollback completo');
  // Necesitamos un bp retirado. Vamos a re-retirar bp-ACTIVO-001 (que está activo por T10).
  const r11pre = call('gh:cambiar-estado', {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.',
    personalId: 'bp-ACTIVO-001', estado: 'retirado', fechaRetiro: fechaRetiro
  });
  _assertEq(r11pre.success, true, 'T11.0 pre-setup: bp-ACTIVO-001 re-retirado');
  const eventosAntes11 = _countEventos();
  const ctAntes11 = _countCt();
  const bpT11Pre = db.prepare('SELECT estado, fecha_retiro, cargo, salario, fecha_ingreso FROM base_personal WHERE id = ?').get('bp-ACTIVO-001');
  const r11 = call('gh:recontratar-personal', {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.',
    bpId: 'bp-ACTIVO-001',
    contratacionData: {
      nombres: 'Ana', apellidos: 'Activa', cedula: '999999999',  // ← NO matchea
      cargo: 'Auxiliar', fechaIngreso: '2025-11-15'
    }
  });
  _assertEq(r11.success, false, 'T11.1 success=false');
  _assertEq(r11.error.code, 'CEDULA_MISMATCH', 'T11.2 error.code=CEDULA_MISMATCH');
  // ROLLBACK completo
  const bpT11Post = db.prepare('SELECT estado, fecha_retiro, cargo, salario, fecha_ingreso FROM base_personal WHERE id = ?').get('bp-ACTIVO-001');
  _assertEq(bpT11Post.estado, bpT11Pre.estado, 'T11.3 bp.estado intacto (rollback)');
  _assertEq(bpT11Post.fecha_retiro, bpT11Pre.fecha_retiro, 'T11.4 bp.fecha_retiro intacto (rollback)');
  _assertEq(bpT11Post.cargo, bpT11Pre.cargo, 'T11.5 bp.cargo intacto (rollback)');
  _assertEq(bpT11Post.salario, bpT11Pre.salario, 'T11.6 bp.salario intacto (rollback)');
  _assertEq(bpT11Post.fecha_ingreso, bpT11Pre.fecha_ingreso, 'T11.7 bp.fecha_ingreso intacto (rollback)');
  _assertEq(_countCt(), ctAntes11, 'T11.8 0 CT nuevas (rollback)');
  _assertEq(_countEventos(), eventosAntes11, 'T11.9 0 eventos nuevos (rollback)');

  // ============================================================
  // RESUMEN
  // ============================================================
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  RESUMEN FASE 1.0-G');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  Total checks: ' + (_passed + _failed));
  console.log('  ✓ OK:   ' + _passed);
  console.log('  ✗ FAIL: ' + _failed);
  console.log('');
  if (_failed === 0) {
    console.log('  🟢 TODOS LOS TESTS PASARON');
  } else {
    console.log('  🔴 HAY FALLAS — revisar antes de commit');
  }
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
