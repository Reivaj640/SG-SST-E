// main/test-gestion-humana-clear-personal.js
// 📦1098 · Tests del canal gh:clear-personal (borrado duro de la base de personal)
//   - Exige confirmación explícita (confirmar: true)
//   - Borra SOLO la empresa abierta (las demás no se tocan)
//   - La CASCADE limpia los registros que apuntan al trabajador
//   - El historial (gh_eventos_personal, sin FK) se limpia explícitamente
//   - Las contrataciones NO se borran: solo se desvinculan
//
// Ejecutar: node main/test-gestion-humana-clear-personal.js
// Esperado: 30+ OK · 0 FAIL

const initSqlJs = require('sql.js');

const { SCHEMA_SQL, MIGRATIONS_SQL } = require('./gestion-humana-schema-sql');
const { registerGestionHumanaHandlers } = require('./gestion-humana-bridge');

let _passed = 0;
let _failed = 0;

function _assert(cond, msg) {
  if (cond) { _passed++; }
  else { _failed++; console.error('  ✗ ' + msg); }
}
function _assertEq(actual, expected, msg) {
  if (actual === expected) { _passed++; }
  else { _failed++; console.error('  ✗ ' + msg + ' (esperado=' + expected + ', actual=' + actual + ')'); }
}
function _logSection(n, title) {
  console.log('');
  console.log('[' + n + '] ' + title);
}

(async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Tests gh:clear-personal (📦1098)');
  console.log('═══════════════════════════════════════════════════════════');

  // ========== SETUP: BD sql.js en memoria (mismo patrón que test-gestion-humana-bridge-import) ==========
  _logSection('0', 'Setup sql.js + schema + empresas');
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();
  rawDb.exec(SCHEMA_SQL);
  MIGRATIONS_SQL.forEach(function (sql) {
    try { rawDb.exec(sql); } catch (e) { /* idempotente: se ignora */ }
  });
  // 📦1098 · foreign_keys=ON: en producción lo activa main.js (📦824) y de eso depende
  // la cascada que limpia vacaciones, permisos, documentos, mensajes y carpetas.
  rawDb.exec('PRAGMA foreign_keys = ON;');
  rawDb.exec("CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, company_key TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL);");
  rawDb.run("INSERT INTO companies (id, company_key, display_name) VALUES (?, ?, ?)",
    ['co-tempoactiva', 'tempoactiva', 'TEMPOACTIVA EST S.A.S.']);
  rawDb.run("INSERT INTO companies (id, company_key, display_name) VALUES (?, ?, ?)",
    ['co-otra', 'otraempresa', 'OTRA EMPRESA S.A.S.']);

  // Wrap sql.js en una API compatible con better-sqlite3
  const db = {
    exec: function (sql) { rawDb.exec(sql); },
    prepare: function (sql) {
      return {
        get: function () {
          var args = Array.prototype.slice.call(arguments);
          var stmt = rawDb.prepare(sql);
          try {
            if (args.length > 0) stmt.bind(args);
            if (stmt.step()) return stmt.getAsObject();
            return undefined;
          } finally { stmt.reset(); stmt.free(); }
        },
        all: function () {
          var args = Array.prototype.slice.call(arguments);
          var stmt = rawDb.prepare(sql);
          try {
            if (args.length > 0) stmt.bind(args);
            var rows = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            return rows;
          } finally { stmt.reset(); stmt.free(); }
        },
        run: function () {
          var args = Array.prototype.slice.call(arguments);
          var stmt = rawDb.prepare(sql);
          try {
            if (args.length > 0) stmt.bind(args);
            stmt.step();
          } finally { stmt.reset(); stmt.free(); }
        }
      };
    },
    transaction: function (fn) { return function () { fn(); }; },
    close: function () { rawDb.close(); }
  };

  // ========== SETUP: Mocks de ipcMain + dialog + xlsx ==========
  const registeredHandlers = {};
  const mockIpcMain = {
    handle: function (channel, fn) { registeredHandlers[channel] = fn; }
  };
  const mockApp = { getPath: function () { return '.'; } };
  const mockDialog = {
    showOpenDialog: function () { return Promise.resolve({ canceled: true, filePaths: [] }); },
    showSaveDialog: function () { return Promise.resolve({ canceled: true }); }
  };
  const mockXlsx = {
    readFile: function () { throw new Error('xlsx no disponible en test'); }
  };
  registerGestionHumanaHandlers.init(mockIpcMain);
  registerGestionHumanaHandlers(mockApp, {
    getDb: function () { return db; },
    validateSession: function () { return { ok: true, user: { id: 1 } }; }
  });
  console.log('  ✓ Bridge registrado con mocks');

  // ========== SIEMBRA DE DATOS ==========
  _logSection('0.1', 'Siembra: 2 trabajadores de tempoactiva, 1 de otraempresa');
  const HOY = '2026-11-24';
  rawDb.run(
    "INSERT INTO base_personal (id, empresa_id, nombres, apellidos, cedula, estado, activo, fecha_ingreso, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ['bp-A', 'tempoactiva', 'ANA', 'ROJAS', '100', 'activo', 1, '2024-01-15', HOY, HOY]
  );
  rawDb.run(
    "INSERT INTO base_personal (id, empresa_id, nombres, apellidos, cedula, estado, activo, fecha_ingreso, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ['bp-B', 'tempoactiva', 'BRUNO', 'DIAZ', '200', 'activo', 1, '2025-03-01', HOY, HOY]
  );
  rawDb.run(
    "INSERT INTO base_personal (id, empresa_id, nombres, apellidos, cedula, estado, activo, fecha_ingreso, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ['bp-X', 'otraempresa', 'CARLOS', 'OTRO', '300', 'activo', 1, '2023-05-05', HOY, HOY]
  );

  // Registros hijos que deben caer por CASCADE
  rawDb.run(
    "INSERT INTO gh_vacaciones (id, empresa_id, trabajador_id, fecha_solicitud, fecha_inicio, fecha_fin, dias_solicitados, estado, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ['vac-A', 'tempoactiva', 'bp-A', '2025-12-20', '2026-01-01', '2026-01-15', 10, 'aprobada', HOY, HOY]
  );
  rawDb.run(
    "INSERT INTO gh_permisos (id, empresa_id, trabajador_id, tipo, fecha_inicio, fecha_fin, dias, estado, motivo, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    ['per-A', 'tempoactiva', 'bp-A', 'permiso_personal', '2026-02-01', '2026-02-02', 2, 'activo', 'trámite', HOY, HOY]
  );
  rawDb.run(
    "INSERT INTO gh_documentos (id, empresa_id, trabajador_id, tipo, titulo, contenido, estado, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ['doc-A', 'tempoactiva', 'bp-A', 'contrato', 'Contrato de trabajo', '{}', 'firmado', HOY, HOY]
  );
  rawDb.run(
    "INSERT INTO gh_documentos_afiliaciones (id, empresa_id, trabajador_id, tipo_afiliacion, nombre_archivo, ruta_archivo, fecha_subida, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ['daf-A', 'tempoactiva', 'bp-A', 'eps', 'eps.pdf', 'C:/tmp/eps.pdf', HOY, HOY, HOY]
  );
  rawDb.run(
    "INSERT INTO gh_mensajes (id, empresa_id, remitente_id, destinatario_id, asunto, contenido, leido, created_at) VALUES (?,?,?,?,?,?,?,?)",
    ['msg-A', 'tempoactiva', 'bp-A', 'bp-B', 'hola', 'mensaje', 0, HOY]
  );
  // Carpetas (expediente + documento): CASCADE desde el expediente
  rawDb.run(
    "INSERT INTO gh_carpetas_categorias (id, empresa_id, codigo, nombre, orden, activo, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
    ['cat-A', 'tempoactiva', 'contrato', 'Contrato de trabajo', 1, 1, HOY, HOY]
  );
  rawDb.run(
    "INSERT INTO gh_carpetas_expedientes (id, empresa_id, trabajador_id, created_at, updated_at) VALUES (?,?,?,?,?)",
    ['exp-A', 'tempoactiva', 'bp-A', HOY, HOY]
  );
  rawDb.run(
    "INSERT INTO gh_carpetas_documentos (id, expediente_id, empresa_id, trabajador_id, categoria_id, nombre_archivo, ruta_archivo, tamano_bytes, fecha_subida, activo) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ['cdoc-A', 'exp-A', 'tempoactiva', 'bp-A', 'cat-A', 'contrato.pdf', 'C:/tmp/contrato.pdf', 1234, HOY, 1]
  );
  // Historial laboral: SIN FK declarada → el handler lo borra a mano
  rawDb.run(
    "INSERT INTO gh_eventos_personal (id, empresa_id, trabajador_id, tipo_evento, fecha_evento, estado_anterior, estado_nuevo, created_at) VALUES (?,?,?,?,?,?,?,?)",
    ['ev-A', 'tempoactiva', 'bp-A', 'RETIRO', '2026-01-01', 'activo', 'retirado', HOY]
  );
  // Contrataciones: NO se deben borrar, solo desvincular
  rawDb.run(
    "INSERT INTO contrataciones (id, empresa_id, nombres, apellidos, cargo, fecha_ingreso, paso_actual, estado, trabajador_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    ['ct-A', 'tempoactiva', 'ANA', 'ROJAS', 'AUXILIAR', '2024-01-15', 6, 'completado', 'bp-A', HOY, HOY]
  );
  // Datos de empresa que NO se tocan
  rawDb.run(
    "INSERT INTO gh_sedes (id, empresa_id, nombre, direccion, activo, created_at) VALUES (?,?,?,?,?,?)",
    ['sede-A', 'tempoactiva', 'SEDE PRINCIPAL', 'Cra 1', 1, HOY]
  );
  rawDb.run(
    "INSERT INTO gh_templates (id, empresa_id, tipo_documento, nombre, nombre_archivo, ruta_archivo, fecha_subida, activo, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ['tpl-A', 'tempoactiva', 'carta', 'CARTA', 'carta.docx', 'C:/tmp/carta.docx', HOY, 1, HOY, HOY]
  );
  console.log('  ✓ Datos sembrados');

  // ========== TEST 1: el canal existe ==========
  _logSection('1', 'gh:clear-personal está registrado');
  _assert(typeof registeredHandlers['gh:clear-personal'] === 'function', 'T1.1 handler gh:clear-personal registrado');

  // ========== TEST 2: sin companyName → INVALID_INPUT ==========
  _logSection('2', 'gh:clear-personal — validación de entrada');
  var r2 = registeredHandlers['gh:clear-personal']({}, { token: 'test', confirmar: true });
  _assert(r2.success === false, 'T2.1 sin companyName retorna success=false');
  _assert(r2.error.code === 'INVALID_INPUT', 'T2.2 sin companyName retorna INVALID_INPUT');

  // ========== TEST 3: sin confirmar → CONFIRM_REQUIRED (doble candado) ==========
  _logSection('3', 'gh:clear-personal — exige confirmación explícita');
  var r3 = registeredHandlers['gh:clear-personal']({}, { token: 'test', companyName: 'TEMPOACTIVA EST S.A.S.' });
  _assert(r3.success === false, 'T3.1 sin confirmar retorna success=false');
  _assert(r3.error.code === 'CONFIRM_REQUIRED', 'T3.2 sin confirmar retorna CONFIRM_REQUIRED');
  var r3b = registeredHandlers['gh:clear-personal']({}, { token: 'test', companyName: 'TEMPOACTIVA EST S.A.S.', confirmar: 'si' });
  _assert(r3b.error && r3b.error.code === 'CONFIRM_REQUIRED', 'T3.3 confirmar con texto (no booleano) NO borra');
  var bpTrasT3 = db.prepare("SELECT COUNT(*) AS n FROM base_personal WHERE empresa_id = 'tempoactiva'").get();
  _assertEq(bpTrasT3.n, 2, 'T3.4 tras los intentos sin confirmar sigue habiendo 2 trabajadores');

  // ========== TEST 4: empresa inexistente → COMPANY_NOT_FOUND ==========
  _logSection('4', 'gh:clear-personal — empresa inexistente');
  var r4 = registeredHandlers['gh:clear-personal']({}, { token: 'test', companyName: 'EMPRESA FANTASMA', confirmar: true });
  _assert(r4.success === false, 'T4.1 empresa inexistente retorna success=false');
  _assert(r4.error.code === 'COMPANY_NOT_FOUND', 'T4.2 retorna COMPANY_NOT_FOUND');

  // ========== TEST 5: empresa sin trabajadores → deleted = 0 ==========
  _logSection('5', 'gh:clear-personal — empresa sin personal');
  rawDb.run(
    "INSERT INTO companies (id, company_key, display_name) VALUES (?,?,?)",
    ['co-vacia', 'empresavacia', 'EMPRESA VACIA S.A.S.']
  );
  var r5 = registeredHandlers['gh:clear-personal']({}, { token: 'test', companyName: 'EMPRESA VACIA S.A.S.', confirmar: true });
  _assert(r5.success === true, 'T5.1 empresa vacía retorna success=true');
  _assertEq(r5.data.deleted, 0, 'T5.2 deleted = 0');

  // ========== TEST 6: el borrado real ==========
  _logSection('6', 'gh:clear-personal — borra el personal de la empresa abierta');
  var r6 = registeredHandlers['gh:clear-personal']({}, {
    token: 'test', companyName: 'TEMPOACTIVA EST S.A.S.', confirmar: true
  });
  _assert(r6.success === true, 'T6.1 borrado retorna success=true');
  _assertEq(r6.data.deleted, 2, 'T6.2 deleted = 2 trabajadores');
  _assertEq(r6.data.empresa, 'TEMPOACTIVA EST S.A.S.', 'T6.3 devuelve el nombre de la empresa');

  var bpTras = db.prepare("SELECT COUNT(*) AS n FROM base_personal WHERE empresa_id = 'tempoactiva'").get();
  _assertEq(bpTras.n, 0, 'T6.4 no queda personal de la empresa');

  // ========== TEST 7: las OTRAS empresas no se tocan ==========
  _logSection('7', 'gh:clear-personal — no toca otras empresas');
  var bpOtra = db.prepare("SELECT COUNT(*) AS n FROM base_personal WHERE empresa_id = 'otraempresa'").get();
  _assertEq(bpOtra.n, 1, 'T7.1 el personal de otraempresa sigue ahí');

  // ========== TEST 8: CASCADE — los registros que apuntan al trabajador desaparecen ==========
  _logSection('8', 'gh:clear-personal — cascada de los registros asociados');
  _assertEq(db.prepare("SELECT COUNT(*) AS n FROM gh_vacaciones").get().n, 0, 'T8.1 gh_vacaciones limpia');
  _assertEq(db.prepare("SELECT COUNT(*) AS n FROM gh_permisos").get().n, 0, 'T8.2 gh_permisos limpia');
  _assertEq(db.prepare("SELECT COUNT(*) AS n FROM gh_documentos").get().n, 0, 'T8.3 gh_documentos limpia');
  _assertEq(db.prepare("SELECT COUNT(*) AS n FROM gh_documentos_afiliaciones").get().n, 0, 'T8.4 gh_documentos_afiliaciones limpia');
  _assertEq(db.prepare("SELECT COUNT(*) AS n FROM gh_mensajes").get().n, 0, 'T8.5 gh_mensajes limpia');
  _assertEq(db.prepare("SELECT COUNT(*) AS n FROM gh_carpetas_expedientes").get().n, 0, 'T8.6 gh_carpetas_expedientes limpia');
  _assertEq(db.prepare("SELECT COUNT(*) AS n FROM gh_carpetas_documentos").get().n, 0, 'T8.7 gh_carpetas_documentos limpia');
  _assertEq(db.prepare("SELECT COUNT(*) AS n FROM gh_carpetas_categorias").get().n, 1, 'T8.8 las categorías de carpeta (de empresa) NO se borran');

  // ========== TEST 9: historial laboral (sin FK) limpio explícitamente ==========
  _logSection('9', 'gh:clear-personal — historial laboral (gh_eventos_personal)');
  _assertEq(db.prepare("SELECT COUNT(*) AS n FROM gh_eventos_personal WHERE empresa_id = 'tempoactiva'").get().n, 0,
    'T9.1 gh_eventos_personal de la empresa queda vacía');

  // ========== TEST 10: las contrataciones NO se borran, solo se desvinculan ==========
  _logSection('10', 'gh:clear-personal — las contrataciones se conservan');
  var ct = db.prepare("SELECT trabajador_id, estado FROM contrataciones WHERE id = 'ct-A'").get();
  _assert(ct !== undefined, 'T10.1 la contratación sigue existiendo');
  _assertEq(ct.estado, 'completado', 'T10.2 conserva su estado');
  _assertEq(ct.trabajador_id, null, 'T10.3 queda desvinculada (trabajador_id = NULL)');

  // ========== TEST 11: los datos de empresa NO se tocan ==========
  _logSection('11', 'gh:clear-personal — sedes y plantillas intactas');
  _assertEq(db.prepare("SELECT COUNT(*) AS n FROM gh_sedes WHERE empresa_id = 'tempoactiva'").get().n, 1, 'T11.1 las sedes siguen');
  _assertEq(db.prepare("SELECT COUNT(*) AS n FROM gh_templates WHERE empresa_id = 'tempoactiva'").get().n, 1, 'T11.2 las plantillas siguen');

  // ========== TEST 12: la UI llama al canal y avisa qué se borra ==========
  _logSection('12', 'La vista Base de Personal ofrece la acción y la confirma');
  const fs = require('fs');
  const path = require('path');
  const vistaDir = path.join(__dirname, '..', 'modules', 'gestion-humana', 'base-personal');
  const html = fs.readFileSync(path.join(vistaDir, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(vistaDir, 'index.js'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
  _assert(html.indexOf('id="bp-actions-dropdown"') >= 0, 'T12.1 index.html tiene el desplegable "Acciones"');
  _assert(html.indexOf('data-action="importar"') >= 0, 'T12.2 index.html ofrece Importar');
  _assert(html.indexOf('data-action="exportar"') >= 0, 'T12.3 index.html ofrece Exportar');
  _assert(html.indexOf('data-action="borrar"') >= 0, 'T12.4 index.html ofrece Borrar');
  _assert(html.indexOf('bp-importar-btn') < 0, 'T12.5 ya no quedan los botones sueltos de importar/exportar');
  _assert(js.indexOf('id="bp-actions-dropdown"') >= 0, 'T12.6 el respaldo inline del JS trae el mismo desplegable');
  _assert(js.indexOf('ghClearPersonal') >= 0, 'T12.7 el JS llama a ghClearPersonal');
  _assert(js.indexOf('confirmar: true') >= 0, 'T12.8 el JS manda la confirmación explícita');
  _assert(js.indexOf('Borrar base de personal') >= 0, 'T12.9 el JS nombra la acción destructiva');
  _assert(js.indexOf('type: \'danger\'') >= 0, 'T12.10 la confirmación es de tipo peligro');
  _assert(preload.indexOf('ghClearPersonal') >= 0, 'T12.11 preload expone ghClearPersonal');

  console.log('');
  console.log('=====================================================================');
  console.log('  Resumen: ' + _passed + ' OK · ' + _failed + ' FAIL');
  console.log('=====================================================================');
  console.log('');
  if (_failed > 0) process.exit(1);
})().catch(function (e) {
  console.error('ERROR en el test:', e);
  process.exit(1);
});
