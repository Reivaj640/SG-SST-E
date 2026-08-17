// Temp/smoke-docs-afiliaciones.js
// 📦760 · Smoke test para los 5 handlers nuevos de gh_documentos_afiliaciones
//
// Usa sql.js (mismo patrón que test-gestion-humana-bridge-schema.js) para que corra
// con `node` sin requerir recompilar better-sqlite3 para Electron.
// Mocks: dialog (showOpenDialog), shell (openPath), fs (copyFileSync, unlinkSync, mkdirSync, existsSync, statSync), app (getPath)

const fs = require('fs');
const os = require('os');
const path = require('path');
const initSqlJs = require('sql.js');

const { SCHEMA_SQL } = require('../main/gestion-humana-schema-sql.js');
const { registerGestionHumanaHandlers } = require('../main/gestion-humana-bridge.js');

let pass = 0, fail = 0;
function ok(label) { console.log('  ✓ ' + label); pass++; }
function ng(label, msg) { console.log('  ✗ ' + label + ' :: ' + (msg || '')); fail++; }
function eq(actual, expected, label) {
  if (actual === expected) ok(label);
  else ng(label, 'esperado=' + JSON.stringify(expected) + ' actual=' + JSON.stringify(actual));
}
function okTruthy(val, label) {
  if (val) ok(label); else ng(label, 'valor falsy: ' + JSON.stringify(val));
}

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

async function run() {
  console.log('=== 📦760 · gh_documentos_afiliaciones · smoke test ===\n');

  // ──────────── SETUP ────────────
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();
  rawDb.exec(SCHEMA_SQL);
  const db = _wrapSqlJsAsBetterSqlite(rawDb);

  // Empresa + trabajador
  const now = new Date().toISOString();
  db.exec("CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, company_key TEXT NOT NULL, display_name TEXT NOT NULL, created_at TEXT NOT NULL);");
  db.prepare("INSERT INTO companies (id, company_key, display_name, created_at) VALUES (?, ?, ?, ?)").run('co-test', 'tempoactiva', 'TEMPOACTIVA EST S.A.S.', now);
  const trabId = 'bp-test01';
  db.prepare("INSERT INTO base_personal (id, empresa_id, nombres, apellidos, cedula, cargo, eps, pension, arl, caja_compensacion, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    trabId, 'tempoactiva', 'JUAN', 'PEREZ', '12345678', 'AUXILIAR', 'Sura EPS', 'Porvenir', 'Colmena', 'Comfamiliar Atlántico', now, now
  );

  // ──────────── MOCKS ────────────
  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-gh-'));
  const fakePdfPath = path.join(tmpUserData, 'fake-cert.pdf');
  fs.writeFileSync(fakePdfPath, '%PDF-1.4\n%fake pdf content for test\n%%EOF');

  const mockApp = { getPath: (k) => k === 'userData' ? tmpUserData : os.tmpdir() };
  let openPathCalled = false;
  const mockShell = { openPath: async () => { openPathCalled = true; return ''; } };
  const mockDialog = {
    showOpenDialog: async () => ({ canceled: false, filePaths: [fakePdfPath] })
  };
  const handlers = {};
  const mockIpcMain = { handle: (ch, fn) => { handlers[ch] = fn; } };

  // Inyectar mocks
  registerGestionHumanaHandlers.init(mockIpcMain);
  registerGestionHumanaHandlers(mockApp, { getDb: () => db, validateSession: null });

  // Sobrescribir dialog/shell/app con mocks DESPUÉS del init
  // (el init() los setea con los reales; aquí los pisamos)
  registerGestionHumanaHandlers._dialog = mockDialog;
  registerGestionHumanaHandlers._shell = mockShell;
  registerGestionHumanaHandlers._app = mockApp;
  // El init ya inyectó fs/path reales, eso está bien

  // ──────────── TESTS ────────────

  console.log('[1] 5 handlers nuevos registrados');
  okTruthy(typeof handlers['gh:list-documentos-afiliaciones'] === 'function', 'gh:list-documentos-afiliaciones registrado');
  okTruthy(typeof handlers['gh:subir-documento-afiliacion'] === 'function', 'gh:subir-documento-afiliacion registrado');
  okTruthy(typeof handlers['gh:eliminar-documento-afiliacion'] === 'function', 'gh:eliminar-documento-afiliacion registrado');
  okTruthy(typeof handlers['gh:obtener-documento-afiliacion'] === 'function', 'gh:obtener-documento-afiliacion registrado');
  okTruthy(typeof handlers['gh:abrir-documento-afiliacion'] === 'function', 'gh:abrir-documento-afiliacion registrado');

  console.log('\n[2] Listar docs del trabajador (sin docs aún)');
  let r = await handlers['gh:list-documentos-afiliaciones']({}, { companyName: 'TEMPOACTIVA EST S.A.S.', trabajadorId: trabId });
  eq(r.success, true, 'success = true');
  eq(r.data.documentos.length, 4, 'retorna 4 slots');
  eq(r.data.count, 0, 'count = 0');
  r.data.documentos.forEach(function(slot) {
    eq(slot.doc, null, 'slot ' + slot.tipoAfiliacion + '.doc = null');
  });

  console.log('\n[3] Subir PDF para slot EPS');
  r = await handlers['gh:subir-documento-afiliacion']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    trabajadorId: trabId,
    tipoAfiliacion: 'eps'
  });
  eq(r.success, true, 'success = true');
  okTruthy(r.data.doc, 'data.doc existe');
  okTruthy(r.data.doc.id && r.data.doc.id.indexOf('daf-') === 0, 'data.doc.id tiene prefijo daf-');
  eq(r.data.doc.tipoAfiliacion, 'eps', 'tipoAfiliacion = eps');
  eq(r.data.doc.nombreArchivo, 'fake-cert.pdf', 'nombreArchivo correcto');
  okTruthy(r.data.doc.rutaArchivo.indexOf('gh-docs-afil') >= 0, 'ruta en storage correcto');
  okTruthy(fs.existsSync(r.data.doc.rutaArchivo), 'archivo físico creado en FS');

  console.log('\n[4] Reemplazar PDF en mismo slot (UPSERT: mismo ID, archivo nuevo)');
  const oldId = r.data.doc.id;
  const oldUpdatedAt = r.data.doc.updatedAt;
  await new Promise(function(resolve) { setTimeout(resolve, 10); });  // pequeño delay para que updated_at cambie
  r = await handlers['gh:subir-documento-afiliacion']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    trabajadorId: trabId,
    tipoAfiliacion: 'eps'
  });
  eq(r.success, true, 'success = true');
  eq(r.data.replaced, true, 'replaced = true');
  eq(r.data.doc.id, oldId, 'doc.id se mantiene (UPSERT, no duplica)');
  okTruthy(r.data.doc.updatedAt > oldUpdatedAt, 'updated_at se actualizó');

  console.log('\n[5] Subir PDF para slot ARL (distinto)');
  r = await handlers['gh:subir-documento-afiliacion']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    trabajadorId: trabId,
    tipoAfiliacion: 'arl'
  });
  eq(r.success, true, 'success = true');
  eq(r.data.replaced, false, 'no es reemplazo (nuevo)');

  console.log('\n[6] Listar docs (2 docs ahora: EPS + ARL)');
  r = await handlers['gh:list-documentos-afiliaciones']({}, { companyName: 'TEMPOACTIVA EST S.A.S.', trabajadorId: trabId });
  eq(r.success, true, 'success = true');
  eq(r.data.count, 2, 'count = 2');
  const epsSlot = r.data.documentos.find(function(s) { return s.tipoAfiliacion === 'eps'; });
  const arlSlot = r.data.documentos.find(function(s) { return s.tipoAfiliacion === 'arl'; });
  const pensionSlot = r.data.documentos.find(function(s) { return s.tipoAfiliacion === 'pension'; });
  const cajaSlot = r.data.documentos.find(function(s) { return s.tipoAfiliacion === 'caja'; });
  okTruthy(epsSlot.doc, 'slot EPS tiene doc');
  okTruthy(arlSlot.doc, 'slot ARL tiene doc');
  eq(pensionSlot.doc, null, 'slot Pensión sin doc');
  eq(cajaSlot.doc, null, 'slot Caja sin doc');

  console.log('\n[7] Obtener doc por ID');
  const docId = epsSlot.doc.id;
  r = await handlers['gh:obtener-documento-afiliacion']({}, { documentoId: docId });
  eq(r.success, true, 'success = true');
  eq(r.data.doc.id, docId, 'doc.id match');
  okTruthy(r.data.doc.rutaArchivo, 'rutaArchivo presente');

  console.log('\n[8] Abrir doc (shell.openPath)');
  r = await handlers['gh:abrir-documento-afiliacion']({}, { documentoId: docId });
  eq(r.success, true, 'success = true');
  eq(openPathCalled, true, 'shell.openPath fue llamado');

  console.log('\n[9] Eliminar doc EPS');
  const epsPath = epsSlot.doc.rutaArchivo;
  okTruthy(fs.existsSync(epsPath), 'archivo existe antes de eliminar');
  r = await handlers['gh:eliminar-documento-afiliacion']({}, { documentoId: docId });
  eq(r.success, true, 'success = true');
  eq(r.data.documentoId, docId, 'documentoId retornado');
  eq(fs.existsSync(epsPath), false, 'archivo borrado del FS');

  console.log('\n[10] Eliminar doc inexistente (NOT_FOUND)');
  r = await handlers['gh:eliminar-documento-afiliacion']({}, { documentoId: 'daf-inexistente' });
  eq(r.success, false, 'success = false');
  eq(r.error.code, 'NOT_FOUND', 'error.code = NOT_FOUND');

  console.log('\n[11] Validación: tipoAfiliacion inválido');
  r = await handlers['gh:subir-documento-afiliacion']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    trabajadorId: trabId,
    tipoAfiliacion: 'invalido'
  });
  eq(r.success, false, 'success = false');
  eq(r.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  console.log('\n[12] Validación: trabajadorId requerido');
  r = await handlers['gh:subir-documento-afiliacion']({}, {
    companyName: 'TEMPOACTIVA EST S.A.S.',
    tipoAfiliacion: 'eps'
  });
  eq(r.success, false, 'success = false');
  eq(r.error.code, 'INVALID_INPUT', 'error.code = INVALID_INPUT');

  console.log('\n[13] Empresa no encontrada (COMPANY_NOT_FOUND)');
  r = await handlers['gh:list-documentos-afiliaciones']({}, { companyName: 'NOEXISTE', trabajadorId: trabId });
  eq(r.success, false, 'success = false');
  eq(r.error.code, 'COMPANY_NOT_FOUND', 'error.code = COMPANY_NOT_FOUND');

  console.log('\n[14] Después de eliminar EPS, solo queda ARL (count=1)');
  r = await handlers['gh:list-documentos-afiliaciones']({}, { companyName: 'TEMPOACTIVA EST S.A.S.', trabajadorId: trabId });
  eq(r.data.count, 1, 'count = 1 (solo ARL)');

  console.log('\n[15] Diag incluye la nueva tabla y phase=6');
  const diag = await handlers['gh:diag']({}, {});
  eq(diag.success, true, 'success = true');
  okTruthy(diag.data.tables.indexOf('gh_documentos_afiliaciones') >= 0, 'tabla en diag');
  eq(diag.data.phase, 6, 'phase = 6');
  eq(diag.data.tables.length, 10, '10 tablas en diag');

  // ──────────── CLEANUP ────────────
  try { fs.rmSync(tmpUserData, { recursive: true, force: true }); } catch (e) {}
  rawDb.close();

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Resumen: ' + pass + ' OK · ' + fail + ' FAIL');
  console.log('═══════════════════════════════════════════════════');
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(function(e) {
  console.error('ERROR FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
