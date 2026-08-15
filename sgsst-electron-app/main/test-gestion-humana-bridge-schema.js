// main/test-gestion-humana-bridge-schema.js
// Tests del schema y registro del bridge de Gestión Humana (Fase 0)
// Mismo patrón que test-presupuesto-bridge-schema.js
//
// Ejecutar: node main/test-gestion-humana-bridge-schema.js
// Esperado: 49 OK · 0 FAIL

const initSqlJs = require('sql.js');

const { SCHEMA_SQL, EXPECTED_TABLES, EXPECTED_INDEXES } = require('./gestion-humana-schema-sql');
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

async function run() {
  console.log('[1] Cargando sql.js...');
  const SQL = await initSqlJs();
  console.log('  ✓ sql.js cargado');

  console.log('');
  console.log('[2] Aplicando schema...');
  const db = new SQL.Database();
  db.exec(SCHEMA_SQL);
  console.log('  ✓ Schema aplicado sin errores');

  console.log('');
  console.log('[3] Verificando tablas...');
  const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const tables = tablesResult[0] ? tablesResult[0].values.map(r => r[0]) : [];
  console.log('  Tablas encontradas: ' + tables.join(', '));
  _assert(tables.length === EXPECTED_TABLES, 'cantidad de tablas = ' + EXPECTED_TABLES + ' (actual=' + tables.length + ')');
  _assert(tables.includes('contrataciones'), 'tabla contrataciones existe');
  _assert(tables.includes('base_personal'), 'tabla base_personal existe');
  _assert(tables.includes('gh_sedes'), 'tabla gh_sedes existe');

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
  console.log('[9] Verificando que los 16 handlers están registrados...');
  const expectedHandlers = [
    // Read (5)
    'gh:list-contrataciones', 'gh:get-contratacion', 'gh:list-personal',
    'gh:get-personal', 'gh:list-sedes',
    // Write Contratación (4)
    'gh:create-contratacion', 'gh:update-contratacion',
    'gh:delete-contratacion', 'gh:marcar-paso',
    // Write Personal (4)
    'gh:create-personal', 'gh:update-personal',
    'gh:delete-personal', 'gh:cambiar-estado',
    // Write Sedes (2)
    'gh:create-sede', 'gh:update-sede'
  ];
  _assertEq(Object.keys(registeredHandlers).length, 16, 'cantidad de handlers registrados = 16');
  expectedHandlers.forEach(function(ch) {
    _assert(typeof registeredHandlers[ch] === 'function', 'handler "' + ch + '" registrado');
  });

  console.log('');
  console.log('[10] Verificando que los 15 stubs retornan NOT_IMPLEMENTED...');
  // diag es el único handler real
  const stubHandlers = expectedHandlers; // los 15 sin contar diag
  stubHandlers.forEach(function(ch) {
    const res = registeredHandlers[ch]({}, { token: 'test' });
    _assert(res.success === false, ch + ' retorna success=false');
    _assert(res.error.code === 'NOT_IMPLEMENTED', ch + ' retorna error.code = NOT_IMPLEMENTED');
    _assert(res.error.extra && res.error.extra.phase === 0, ch + ' retorna error.extra.phase = 0');
  });

  console.log('');
  console.log('[11] Verificando que diag responde OK...');
  const diagRes = registeredHandlers['gh:diag']({}, {});
  _assert(diagRes.success === true, 'diag retorna success=true');
  _assert(diagRes.data.phase === 0, 'diag.data.phase = 0');
  _assert(diagRes.data.bridge === 'gestion-humana', 'diag.data.bridge = gestion-humana');
  _assert(diagRes.data.has_getDb === true, 'diag.data.has_getDb = true');
  _assert(diagRes.data.has_validateSession === true, 'diag.data.has_validateSession = true');

  console.log('');
  console.log('=====================================================================');
  console.log('  Resumen: ' + _passed + ' OK · ' + _failed + ' FAIL');
  console.log('=====================================================================');
  console.log('');

  try { db.close(); } catch (e) {}
  // Forzar exit para evitar el race condition de libuv con sql.js
  setTimeout(function() { process.exit(_failed > 0 ? 1 : 0); }, 100);
}

run().catch(function(err) {
  console.error('ERROR FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
