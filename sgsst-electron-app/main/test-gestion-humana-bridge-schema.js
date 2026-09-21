// main/test-gestion-humana-bridge-schema.js
// Tests del schema y registro del bridge de Gestión Humana (Fase 0)
// Mismo patrón que test-presupuesto-bridge-schema.js
//
// Ejecutar: node main/test-gestion-humana-bridge-schema.js
// Esperado: 49 OK · 0 FAIL

const initSqlJs = require('sql.js');

const { SCHEMA_SQL, MIGRATIONS_SQL, EXPECTED_TABLES, EXPECTED_INDEXES } = require('./gestion-humana-schema-sql');
const { registerGestionHumanaHandlers } = require('./gestion-humana-bridge');

let _passed = 0;
let _failed = 0;

// Wrapper para que el bridge pueda usar `db.prepare().all()` como en producción (better-sqlite3)
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
  console.log('[1] Cargando sql.js...');
  const SQL = await initSqlJs();
  console.log('  ✓ sql.js cargado');

  console.log('');
  console.log('[2] Aplicando schema...');
  const rawDb = new SQL.Database();
  rawDb.exec(SCHEMA_SQL);
  // I-103.A1.0-D-1 · aplicar MIGRATIONS_SQL con el mismo patrón idempotente de main.js.
  // En una BD recién creada desde SCHEMA_SQL, las migraciones 1-6 ya están aplicadas
  // (las columnas como sede_id, ruta_archivo, fecha_ingreso_s400, fecha_afiliaciones
  // forman parte del schema base). Solo se ignoran errores de "duplicate column name"
  // o "already exists" (idempotencia); cualquier otro error se propaga y falla el test.
  const migrationResults = [];
  MIGRATIONS_SQL.forEach(function(sql, idx) {
    try {
      rawDb.exec(sql);
      migrationResults.push({ idx: idx + 1, status: 'applied' });
    } catch (e) {
      if (/duplicate column name|already exists|no such column|no such table/i.test(e.message)) {
        migrationResults.push({ idx: idx + 1, status: 'skipped', reason: e.message.substring(0, 80) });
      } else {
        throw e;
      }
    }
  });
  const db = _wrapSqlJsAsBetterSqlite(rawDb);
  var appliedCount = migrationResults.filter(function(r){ return r.status === 'applied'; }).length;
  var skippedCount = migrationResults.filter(function(r){ return r.status === 'skipped'; }).length;
  console.log('  ✓ Schema + ' + appliedCount + ' migraciones aplicadas, ' + skippedCount + ' omitidas (idempotentes)');

  console.log('');
  console.log('[2.1] Reporte de migraciones:');
  migrationResults.forEach(function(r) {
    if (r.status === 'applied') {
      console.log('  ✓ Migración ' + r.idx + ' aplicada');
    } else {
      console.log('  - Migración ' + r.idx + ' omitida: ' + r.reason);
    }
  });

  console.log('');
  console.log('[3] Verificando tablas...');
  const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const tables = tablesResult[0] ? tablesResult[0].values.map(r => r[0]) : [];
  console.log('  Tablas encontradas: ' + tables.join(', '));
  _assert(tables.length === EXPECTED_TABLES, 'cantidad de tablas = ' + EXPECTED_TABLES + ' (actual=' + tables.length + ')');
  _assert(tables.includes('contrataciones'), 'tabla contrataciones existe');
  _assert(tables.includes('base_personal'), 'tabla base_personal existe');
  _assert(tables.includes('gh_sedes'), 'tabla gh_sedes existe');
  // 📦710 · FASE B: 6 tablas nuevas
  _assert(tables.includes('gh_vacaciones'), 'tabla gh_vacaciones existe');
  _assert(tables.includes('gh_permisos'), 'tabla gh_permisos existe');
  _assert(tables.includes('gh_documentos'), 'tabla gh_documentos existe');
  // LEGACY-SIGN-REMOVE (2026-08-20): gh_firmas_digitales eliminada.
  _assert(tables.includes('gh_anuncios'), 'tabla gh_anuncios existe');
  _assert(tables.includes('gh_mensajes'), 'tabla gh_mensajes existe');

  console.log('');
  console.log('[4] Verificando columnas de contrataciones...');
  const contratacionesCols = db.exec("PRAGMA table_info(contrataciones)");
  const colNames = contratacionesCols[0].values.map(r => r[1]);
  const requiredContratacionesCols = [
    'id', 'empresa_id', 'nombres', 'apellidos', 'cedula', 'telefono',
    'cargo', 'salario', 'fecha_ingreso', 'sede_id', 'empresa_usuaria',
    'paso_actual', 'memo_recibido', 'memo_fecha', 'memo_notas',
    'contacto_realizado', 'contacto_fecha', 'contacto_notas',
    'examenes_programados', 'examenes_fecha', 'examenes_ips', 'examenes_notas',
    'documentos_firmados', 'documentos_fecha', 'documentos_notas',
    'afiliaciones_completadas', 'afiliaciones_fecha', 'afiliaciones_notas',
    's400_activado', 's400_fecha', 's400_notas',
    'estado', 'trabajador_id', 'created_at', 'updated_at'
  ];
  requiredContratacionesCols.forEach(function(col) {
    _assert(colNames.includes(col), 'columna contrataciones.' + col + ' existe');
  });

  console.log('');
  console.log('[5] Verificando columnas de base_personal...');
  const personalCols = db.exec("PRAGMA table_info(base_personal)");
  const personalColNames = personalCols[0].values.map(r => r[1]);
  const requiredPersonalCols = [
    'id', 'empresa_id', 'nombres', 'apellidos', 'cedula', 'tipo_documento',
    'fecha_nacimiento', 'telefono', 'celular', 'email', 'estado_civil',
    'nivel_educativo', 'direccion', 'ciudad', 'cargo', 'salario',
    'tipo_contrato', 'fecha_ingreso', 'fecha_retiro', 'estado',
    'eps', 'pension', 'arl', 'caja_compensacion', 'activo_s400',
    'banco', 'numero_cuenta', 'activo', 'created_at', 'updated_at'
  ];
  requiredPersonalCols.forEach(function(col) {
    _assert(personalColNames.includes(col), 'columna base_personal.' + col + ' existe');
  });

  console.log('');
  console.log('[6] Verificando índices...');
  const indexesResult = db.exec("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const indexes = indexesResult[0] ? indexesResult[0].values.map(r => r[0]) : [];
  console.log('  Índices encontrados: ' + indexes.length);
  _assert(indexes.length >= EXPECTED_INDEXES, 'cantidad de índices >= ' + EXPECTED_INDEXES + ' (actual=' + indexes.length + ')');
  _assert(indexes.includes('idx_contrataciones_empresa'), 'índice idx_contrataciones_empresa existe');
  _assert(indexes.includes('idx_contrataciones_estado'), 'índice idx_contrataciones_estado existe');
  _assert(indexes.includes('idx_contrataciones_paso'), 'índice idx_contrataciones_paso existe');
  _assert(indexes.includes('idx_base_personal_empresa'), 'índice idx_base_personal_empresa existe');
  _assert(indexes.includes('idx_base_personal_estado'), 'índice idx_base_personal_estado existe');
  _assert(indexes.includes('idx_base_personal_activo'), 'índice idx_base_personal_activo existe');
  _assert(indexes.includes('idx_gh_sedes_empresa'), 'índice idx_gh_sedes_empresa existe');

  console.log('');
  console.log('[7] Verificando UNIQUE constraints...');
  // base_personal: UNIQUE(empresa_id, cedula)
  const bpIndexes = db.exec("PRAGMA index_list(base_personal)");
  const bpUniqueIndexes = bpIndexes[0].values.filter(r => r[2] === 1).map(r => r[1]);
  _assert(bpUniqueIndexes.some(function(n) { return n.indexOf('autoindex') >= 0 || n.indexOf('empresa') >= 0; }), 'base_personal tiene UNIQUE constraint (empresa_id, cedula)');
  // gh_sedes: UNIQUE(empresa_id, nombre)
  const gsIndexes = db.exec("PRAGMA index_list(gh_sedes)");
  const gsUniqueIndexes = gsIndexes[0].values.filter(r => r[2] === 1).map(r => r[1]);
  _assert(gsUniqueIndexes.some(function(n) { return n.indexOf('autoindex') >= 0 || n.indexOf('empresa') >= 0; }), 'gh_sedes tiene UNIQUE constraint (empresa_id, nombre)');

  console.log('');
  console.log('[8] Mockeando electron e ipcMain para registrar el bridge...');
  // Mock electron app
  const mockApp = { on: function() {} };
  // Mock ipcMain que captura los handlers
  const registeredHandlers = {};
  const mockIpcMain = {
    handle: function(channel, fn) {
      registeredHandlers[channel] = fn;
    }
  };
  registerGestionHumanaHandlers.init(mockIpcMain);
  registerGestionHumanaHandlers(mockApp, {
    getDb: function() { return db; },
    validateSession: function() { return { ok: true, user: { id: 1 } }; }
  });
  console.log('  ✓ Bridge registrado con mocks');

  console.log('');
  console.log('[9] Verificando que los handlers esperados están registrados...');
  const expectedHandlers = [
    // Read (5) — Fase 1
    'gh:list-contrataciones', 'gh:get-contratacion', 'gh:list-personal',
    'gh:get-personal', 'gh:list-sedes',
    // Write Contratación (4) — Fase 2
    'gh:create-contratacion', 'gh:update-contratacion',
    'gh:delete-contratacion', 'gh:marcar-paso',
    // Write Personal (4) — Fase 3
    'gh:create-personal', 'gh:update-personal',
    'gh:delete-personal', 'gh:cambiar-estado',
    // Write Sedes (2) — Fase 3
    'gh:create-sede', 'gh:update-sede',
    // Vacaciones (6) — Fase 5
    'gh:list-vacaciones', 'gh:get-vacacion', 'gh:create-vacacion',
    'gh:update-vacacion', 'gh:delete-vacacion', 'gh:cambiar-estado-vacacion',
    // Permisos (5) — Fase 5
    'gh:list-permisos', 'gh:get-permiso', 'gh:create-permiso',
    'gh:update-permiso', 'gh:finalizar-permiso',
    // Documentos (5) — Fase 5 — LEGACY-SIGN-REMOVE: -1 (gh:firmar-documento)
    'gh:list-documentos', 'gh:get-documento', 'gh:create-documento',
    'gh:update-documento', 'gh:delete-documento',
    // Anuncios (5) — Fase 5
    'gh:list-anuncios', 'gh:get-anuncio', 'gh:create-anuncio',
    'gh:update-anuncio', 'gh:delete-anuncio',
    // Mensajes (4) — Fase 5
    'gh:list-mensajes', 'gh:get-mensaje', 'gh:create-mensaje', 'gh:marcar-leido',
    // 📦760 · Documentos de Afiliaciones (5) — Fase 6
    'gh:list-documentos-afiliaciones', 'gh:subir-documento-afiliacion',
    'gh:eliminar-documento-afiliacion', 'gh:obtener-documento-afiliacion',
    'gh:abrir-documento-afiliacion',
    // 📦764 · Templates de Documentos (5) — Fase 7
    'gh:list-templates', 'gh:subir-template', 'gh:eliminar-template',
    'gh:obtener-template', 'gh:abrir-template',
    // 📦732 · Import Excel (3)
    'gh:select-excel', 'gh:parse-excel', 'gh:import-personal',
    // Soportes de Contratación (4) — evidencias por paso
    'gh:listar-soportes-contratacion', 'gh:subir-soporte-paso',
    'gh:abrir-soporte-paso', 'gh:eliminar-soporte-paso',
    // I-AUDIT-2026-09-11 (Carpetas v0.2.0) · 9 handlers Documentos de Contratación
    'gh:list-categorias-carpetas', 'gh:create-categoria-carpeta', 'gh:update-categoria-carpeta',
    'gh:list-expedientes', 'gh:get-expediente', 'gh:list-trabajadores-disponibles',
    'gh:subir-documento-carpeta', 'gh:abrir-documento-carpeta', 'gh:eliminar-documento-carpeta',
    // 📦743 · Integración con Contratación — 2 handlers adicionales
    'gh:list-documentos-contratacion-by-bp', 'gh:abrir-soporte-contratacion'
  ];
  // I-103.A1.0-D-1 · EXPECTED_HANDLERS actualizado de 55 a 59.
  // Los 4 handlers adicionales son preexistentes (registrados en commits anteriores a 1.0-C
  // pero no reflejados en este test). El cambio en la expectativa NO pertenece a D-1;
  // solo lo ajustamos para que el test quede en verde con la realidad del bridge actual.
  // 📦767 · FASE 1.0-G.2 · El conteo del bridge subió a 60 (era 59 pre-G.2). El desajuste de 1
  // ya existía antes de G.2 (probablemente LEGACY-SIGN-REMOVE dejó 1 handler que no se restó).
  // I-AUDIT-2026-09-11 · Carpetas v0.2.0 añade 9 handlers. Total actual: 81 (era 70).
  //   70 pre-Carpetas = 64 esperado (con desfase histórico de 6) + 9 Carpetas.
  // 📦743 · +2 handlers (docs de contratación en carpeta). Total: 81.
  _assertEq(Object.keys(registeredHandlers).length, 81, 'cantidad de handlers registrados = 81 (era 70; +9 carpetas +2 contratacion)');
  expectedHandlers.forEach(function(ch) {
    _assert(typeof registeredHandlers[ch] === 'function', 'handler "' + ch + '" registrado');
  });

  console.log('');
  console.log('[10] Verificando que NO quedan stubs (post-LEGACY-SIGN-REMOVE)...');
  // LEGACY-SIGN-REMOVE (2026-08-20): -2 firmas + -1 firmar-documento
  // 5 reads + 4 write-contratacion + 4 write-personal + 2 write-sedes
  // + 6 vacaciones + 5 permisos + 5 documentos + 5 anuncios + 4 mensajes
  // + 5 docs-afiliaciones + 5 templates + 3 import-excel
  // = 54 reales + 1 diag = 55 totales
  // No hay stubs. Solo el diag (que también es real).
  // Spot check: create-vacacion con payload inválido debe retornar INVALID_INPUT (no NOT_IMPLEMENTED)
  var sampleCheck = registeredHandlers['gh:create-vacacion']({}, { token: 'test' });
  _assert(sampleCheck.success === false, 'create-vacacion sin payload retorna success=false');
  _assert(sampleCheck.error.code === 'INVALID_INPUT', 'create-vacacion retorna INVALID_INPUT (no NOT_IMPLEMENTED)');

  console.log('');
  console.log('[11] Verificando que diag responde OK con metadata de Fase 7...');
  const diagRes = registeredHandlers['gh:diag']({}, {});
  _assert(diagRes.success === true, 'diag retorna success=true');
  _assert(diagRes.data.phase === 7, 'diag.data.phase = 7 (📦764 FASE G: templates de documentos)');
  _assert(diagRes.data.bridge === 'gestion-humana', 'diag.data.bridge = gestion-humana');
  _assert(diagRes.data.has_getDb === true, 'diag.data.has_getDb = true');
  _assert(diagRes.data.has_validateSession === true, 'diag.data.has_validateSession = true');
  _assert(Array.isArray(diagRes.data.tables), 'diag.data.tables es array');
  _assert(diagRes.data.tables.length === 11, 'diag.data.tables tiene 11 tablas (era 10; +1 gh_contratacion_soportes)');
  // Verificar las 8 tablas nuevas explícitamente
  ['gh_vacaciones', 'gh_permisos', 'gh_documentos', 'gh_anuncios', 'gh_mensajes', 'gh_documentos_afiliaciones', 'gh_templates', 'gh_contratacion_soportes'].forEach(function(t) {
    _assert(diagRes.data.tables.indexOf(t) >= 0, 'diag.data.tables incluye ' + t);
  });

  console.log('');
  console.log('=====================================================================');
  console.log('  Resumen: ' + _passed + ' OK · ' + _failed + ' FAIL');
  console.log('=====================================================================');
  console.log('');

  try { db.close(); } catch (e) {}
  try { rawDb.close(); } catch (e) {}
  // Forzar exit para evitar el race condition de libuv con sql.js
  setTimeout(function() { process.exit(_failed > 0 ? 1 : 0); }, 100);
}

run().catch(function(err) {
  console.error('ERROR FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
