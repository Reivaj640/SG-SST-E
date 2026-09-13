// main/test-gestion-humana-bridge-soportes.js
// Tests de los 4 handlers de Soportes de Contratación (evidencias por paso)
// Patrón: sql.js en memoria + mocks ipcMain/electron — igual que test-gestion-humana-bridge-write.js
//
// Ejecutar: node main/test-gestion-humana-bridge-soportes.js
// Esperado: todos OK · 0 FAIL

const initSqlJs = require('sql.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SCHEMA_SQL } = require('./gestion-humana-schema-sql');
const { registerGestionHumanaHandlers } = require('./gestion-humana-bridge');

let _passed = 0;
let _failed = 0;

function _assert(cond, label) {
  if (cond) { _passed++; console.log('  ✓ ' + label); }
  else { _failed++; console.error('  ✗ ' + label); }
}

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
  console.log('[1] Schema en memoria + empresa de prueba...');
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();
  rawDb.exec(SCHEMA_SQL);
  rawDb.exec("CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, company_key TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL);");
  rawDb.run("INSERT INTO companies (id, company_key, display_name) VALUES (?, ?, ?)",
    ['co-tempoactiva', 'tempoactiva', 'TEMPOACTIVA EST S.A.S.']);
  const db = _wrapSqlJsAsBetterSqlite(rawDb);
  console.log('  ✓ Schema aplicado');

  // Verificación schema-level directa
  var tables = rawDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='gh_contratacion_soportes'");
  _assert(tables.length > 0 && tables[0].values.length === 1, 'tabla gh_contratacion_soportes existe');
  var idx = rawDb.exec("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_gh_soportes_%'");
  _assert(idx.length > 0 && idx[0].values.length === 3, '3 índices idx_gh_soportes_* creados (actual=' + (idx.length ? idx[0].values.length : 0) + ')');

  console.log('');
  console.log('[2] Bridge con mocks (dialog/fs/path/shell/app reales a temp dir)...');
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-soportes-test-'));
  const registeredHandlers = {};
  const mockIpcMain = { handle: function (ch, fn) { registeredHandlers[ch] = fn; } };
  registerGestionHumanaHandlers.init(mockIpcMain);
  registerGestionHumanaHandlers._dialog = {
    showOpenDialog: async function (opts) {
      // Simula que el user eligió este archivo
      return { canceled: false, filePaths: [mockDialog._nextFile] };
    }
  };
  var mockDialog = registerGestionHumanaHandlers._dialog;
  registerGestionHumanaHandlers._shell = { openPath: async function () { return ''; } }; // '' = OK
  registerGestionHumanaHandlers._app = { getPath: function () { return tmpRoot; } };
  registerGestionHumanaHandlers._fs = fs;
  registerGestionHumanaHandlers._path = path;
  registerGestionHumanaHandlers({ on: function () {} }, {
    getDb: function () { return db; },
    validateSession: function () { return { ok: true, user: { id: 1, isAdmin: true } }; }
  });
  ['gh:listar-soportes-contratacion', 'gh:subir-soporte-paso', 'gh:abrir-soporte-paso', 'gh:eliminar-soporte-paso'].forEach(function (ch) {
    _assert(typeof registeredHandlers[ch] === 'function', 'handler "' + ch + '" registrado');
  });

  // Crear contratación de prueba via handler real
  var rCt = registeredHandlers['gh:create-contratacion']({}, {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { nombres: 'Test', apellidos: 'Soportes', cedula: '999', cargo: 'QA', salario: 1, fechaIngreso: '2026-09-01' }
  });
  _assert(rCt.success === true, 'contratación de prueba creada');
  var ctId = rCt.data.contratacionId;

  console.log('');
  console.log('[3] Validaciones de input...');
  var rE1 = registeredHandlers['gh:listar-soportes-contratacion']({}, { token: 't' });
  _assert(rE1.success === false && rE1.error.code === 'INVALID_INPUT', 'listar sin companyName → INVALID_INPUT');

  var rE2 = registeredHandlers['gh:subir-soporte-paso']({}, { token: 't', companyName: 'TEMPOACTIVA EST S.A.S.', contratacionId: ctId, pasoNum: 0 });
  _assert(rE2.success === false && rE2.error.code === 'INVALID_INPUT', 'subir pasoNum=0 → INVALID_INPUT');

  var rE3 = registeredHandlers['gh:subir-soporte-paso']({}, { token: 't', companyName: 'TEMPOACTIVA EST S.A.S.', contratacionId: ctId, pasoNum: 7 });
  _assert(rE3.success === false && rE3.error.code === 'INVALID_INPUT', 'subir pasoNum=7 → INVALID_INPUT');

  var rE4 = registeredHandlers['gh:subir-soporte-paso']({}, { token: 't', companyName: 'TEMPOACTIVA EST S.A.S.', contratacionId: 'ct-fantasma', pasoNum: 1 });
  _assert((await rE4).success === false && (await rE4).error.code === 'NOT_FOUND', 'subir contratación inexistente → NOT_FOUND');

  var rE5 = registeredHandlers['gh:abrir-soporte-paso']({}, { token: 't', soporteId: 'sop-fantasma' });
  _assert((await rE5).success === false && (await rE5).error.code === 'NOT_FOUND', 'abrir soporte inexistente → NOT_FOUND');

  var rE6 = registeredHandlers['gh:eliminar-soporte-paso']({}, { token: 't', soporteId: 'sop-fantasma' });
  _assert(rE6.success === false && rE6.error.code === 'NOT_FOUND', 'eliminar soporte inexistente → NOT_FOUND');

  console.log('');
  console.log('[4] Flujo completo: subir → listar → abrir → eliminar...');
  // Crear archivo fuente de prueba
  var srcFile = path.join(tmpRoot, 'memo-recepcion.pdf');
  fs.writeFileSync(srcFile, '%PDF-1.4 fake');
  mockDialog._nextFile = srcFile;

  var rUp = await registeredHandlers['gh:subir-soporte-paso']({}, {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.', contratacionId: ctId, pasoNum: 1
  });
  _assert(rUp.success === true, 'subir soporte paso 1 → success');
  _assert(rUp.data.soporte && rUp.data.soporte.id.indexOf('sop-') === 0, 'soporte tiene id con prefijo sop-');
  _assert(rUp.data.soporte.nombreArchivo === 'memo-recepcion.pdf', 'nombre original preservado');
  _assert(fs.existsSync(rUp.data.soporte.rutaArchivo), 'archivo físico copiado a AppData mock');
  _assert(rUp.data.soporte.rutaArchivo.indexOf('paso-1') > 0, 'ruta contiene paso-1');
  var sopId = rUp.data.soporte.id;

  // Subir un 2do soporte al MISMO paso (multisoporte)
  var srcFile2 = path.join(tmpRoot, 'captura-correo.png');
  fs.writeFileSync(srcFile2, 'PNG fake');
  mockDialog._nextFile = srcFile2;
  var rUp2 = await registeredHandlers['gh:subir-soporte-paso']({}, {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.', contratacionId: ctId, pasoNum: 1
  });
  _assert(rUp2.success === true, 'segundo soporte al mismo paso → success (multisoporte permitido)');

  var rList = registeredHandlers['gh:listar-soportes-contratacion']({}, {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.', contratacionId: ctId
  });
  _assert(rList.success === true && rList.data.soportes.length === 2, 'listar devuelve los 2 soportes (actual=' + rList.data.soportes.length + ')');

  var rListP1 = registeredHandlers['gh:listar-soportes-contratacion']({}, {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.', contratacionId: ctId, pasoNum: 1
  });
  _assert(rListP1.success === true && rListP1.data.soportes.length === 2, 'listar paso 1 → 2 soportes');

  var rListP5 = registeredHandlers['gh:listar-soportes-contratacion']({}, {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.', contratacionId: ctId, pasoNum: 5
  });
  _assert(rListP5.success === true && rListP5.data.soportes.length === 0, 'listar paso 5 (vacío) → 0 soportes');

  var rOpen = await registeredHandlers['gh:abrir-soporte-paso']({}, { token: 't', soporteId: sopId });
  _assert(rOpen.success === true && rOpen.data.rutaArchivo, 'abrir soporte → success con rutaArchivo');

  var rDel = registeredHandlers['gh:eliminar-soporte-paso']({}, { token: 't', soporteId: sopId });
  _assert(rDel.success === true, 'eliminar soporte → success');
  _assert(!fs.existsSync(rUp.data.soporte.rutaArchivo), 'archivo físico borrado del disco');

  var rListFinal = registeredHandlers['gh:listar-soportes-contratacion']({}, {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.', contratacionId: ctId
  });
  _assert(rListFinal.data.soportes.length === 1, 'tras eliminar queda 1 soporte');

  console.log('');
  console.log('[5] Regla "sin soporte = sin completar"...');

  // T-A: marcar paso sin soporte → SOPORTE_REQUERIDO
  var rNoSop = registeredHandlers['gh:marcar-paso']({}, {
    token: 't', contratacionId: ctId, pasoNum: 3
  });
  _assert(rNoSop.success === false && rNoSop.error.code === 'SOPORTE_REQUERIDO',
    'T-A: marcar paso 3 sin soporte → SOPORTE_REQUERIDO');
  var ctChk = db.prepare('SELECT examenes_programados FROM contrataciones WHERE id = ?').get(ctId);
  _assert(ctChk.examenes_programados === 0, 'T-A: el paso 3 NO quedó marcado');

  // T-B: subir soporte → marcar → eliminar último soporte → paso revertido a pendiente
  var f1 = path.join(tmpRoot, 'examen.pdf'); fs.writeFileSync(f1, 'x');
  mockDialog._nextFile = f1;
  var rUp3 = await registeredHandlers['gh:subir-soporte-paso']({}, {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.', contratacionId: ctId, pasoNum: 3
  });
  _assert(rUp3.success === true, 'T-B: soporte subido al paso 3');
  var rMark3 = registeredHandlers['gh:marcar-paso']({}, { token: 't', contratacionId: ctId, pasoNum: 3 });
  _assert(rMark3.success === true, 'T-B: paso 3 marcado (con soporte)');
  var rDel3 = registeredHandlers['gh:eliminar-soporte-paso']({}, { token: 't', soporteId: rUp3.data.soporte.id });
  _assert(rDel3.success === true && rDel3.data.pasoRevertido === true, 'T-B: al eliminar último soporte el paso se revierte');
  var ctRev = db.prepare('SELECT examenes_programados, examenes_fecha, examenes_notas, paso_actual, estado FROM contrataciones WHERE id = ?').get(ctId);
  _assert(ctRev.examenes_programados === 0 && ctRev.examenes_fecha === null && ctRev.examenes_notas === null,
    'T-B: paso 3 volvió a pendiente (bool=0, fecha y notas en NULL)');
  _assert(ctRev.estado === 'en_proceso', 'T-B: estado sigue en_proceso');

  // T-D: eliminar soporte cuando el paso tiene OTRO soporte → NO se revierte
  var f2 = path.join(tmpRoot, 'a.pdf'); fs.writeFileSync(f2, 'a');
  var f3 = path.join(tmpRoot, 'b.pdf'); fs.writeFileSync(f3, 'b');
  mockDialog._nextFile = f2;
  var rUp4a = await registeredHandlers['gh:subir-soporte-paso']({}, { token: 't', companyName: 'TEMPOACTIVA EST S.A.S.', contratacionId: ctId, pasoNum: 4 });
  mockDialog._nextFile = f3;
  await registeredHandlers['gh:subir-soporte-paso']({}, { token: 't', companyName: 'TEMPOACTIVA EST S.A.S.', contratacionId: ctId, pasoNum: 4 });
  var rMark4 = registeredHandlers['gh:marcar-paso']({}, { token: 't', contratacionId: ctId, pasoNum: 4 });
  var rDel4 = registeredHandlers['gh:eliminar-soporte-paso']({}, { token: 't', soporteId: rUp4a.data.soporte.id });
  _assert(rDel4.success === true && rDel4.data.pasoRevertido === false,
    'T-D: eliminar 1 de 2 soportes NO revierte el paso (aún queda 1)');
  var ctD = db.prepare('SELECT documentos_firmados FROM contrataciones WHERE id = ?').get(ctId);
  _assert(ctD.documentos_firmados === 1, 'T-D: paso 4 sigue completado');

  // T-E: eliminar soporte de un paso NO completado → solo borra, sin reversión
  var f4 = path.join(tmpRoot, 'c.pdf'); fs.writeFileSync(f4, 'c');
  mockDialog._nextFile = f4;
  var rUp5 = await registeredHandlers['gh:subir-soporte-paso']({}, { token: 't', companyName: 'TEMPOACTIVA EST S.A.S.', contratacionId: ctId, pasoNum: 5 });
  var rDel5 = registeredHandlers['gh:eliminar-soporte-paso']({}, { token: 't', soporteId: rUp5.data.soporte.id });
  _assert(rDel5.success === true && rDel5.data.pasoRevertido === false,
    'T-E: eliminar soporte de paso pendiente no revierte nada');

  // T-C: paso 6 completado → su último soporte es inborrable (PASO6_NO_REVERTIBLE)
  // (paso 6 crea bp en base_personal y con esta cedula no existe bp: se crea nuevo)
  var f5 = path.join(tmpRoot, 's400.pdf'); fs.writeFileSync(f5, 's');
  mockDialog._nextFile = f5;
  var rUp6 = await registeredHandlers['gh:subir-soporte-paso']({}, { token: 't', companyName: 'TEMPOACTIVA EST S.A.S.', contratacionId: ctId, pasoNum: 6 });
  var rMark6 = registeredHandlers['gh:marcar-paso']({}, { token: 't', contratacionId: ctId, pasoNum: 6 });
  _assert(rMark6.success === true && rMark6.data.estado === 'completado', 'T-C: paso 6 completado');
  var rDel6 = registeredHandlers['gh:eliminar-soporte-paso']({}, { token: 't', soporteId: rUp6.data.soporte.id });
  _assert(rDel6.success === false && rDel6.error.code === 'PASO6_NO_REVERTIBLE',
    'T-C: eliminar último soporte de paso 6 completado → PASO6_NO_REVERTIBLE');
  _assert(fs.existsSync(rUp6.data.soporte.rutaArchivo), 'T-C: el archivo del paso 6 sigue en disco');

  console.log('');
  console.log('[6] Paso 4 — documento firmado de Firma Electrónica cuenta como evidencia...');

  function seedDocFirmado(bpId, estado) {
    var id = 'do-test-' + Math.random().toString(36).slice(2, 8);
    rawDb.run(
      "INSERT INTO gh_documentos (id, trabajador_id, empresa_id, tipo, titulo, contenido, estado, created_at, updated_at) VALUES (?, ?, 'tempoactiva', 'contrato', 'Contrato test', '{}', ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')",
      [id, bpId, estado]
    );
    return id;
  }

  // T-F y T-H usan una contratación LIMPIA (ctId tiene soportes de T-D en paso 4)
  var rCtA = registeredHandlers['gh:create-contratacion']({}, {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { nombres: 'Con', apellidos: 'Firma', cedula: '997', cargo: 'QA', fechaIngreso: '2026-09-01' }
  });
  var ctIdA = rCtA.data.contratacionId;
  var bpRowA = db.prepare('SELECT trabajador_id FROM contrataciones WHERE id = ?').get(ctIdA);

  // T-F: paso 4 con documento firmado, sin soporte manual → marcar OK
  seedDocFirmado(bpRowA.trabajador_id, 'firmado');
  var cntSopP4 = db.prepare('SELECT COUNT(*) AS n FROM gh_contratacion_soportes WHERE contratacion_id = ? AND paso_num = 4').get(ctIdA).n;
  _assert(cntSopP4 === 0, 'T-F setup: paso 4 sin soportes manuales');
  var rMark4b = registeredHandlers['gh:marcar-paso']({}, { token: 't', contratacionId: ctIdA, pasoNum: 4 });
  _assert(rMark4b.success === true, 'T-F: paso 4 se completa con documento firmado (sin soporte manual)');

  // T-H: eliminar soporte manual del paso 4 habiendo firmado → NO se revierte
  var f6 = path.join(tmpRoot, 'manual4.pdf'); fs.writeFileSync(f6, 'm');
  mockDialog._nextFile = f6;
  var rUp4 = await registeredHandlers['gh:subir-soporte-paso']({}, { token: 't', companyName: 'TEMPOACTIVA EST S.A.S.', contratacionId: ctIdA, pasoNum: 4 });
  var rDel4b = registeredHandlers['gh:eliminar-soporte-paso']({}, { token: 't', soporteId: rUp4.data.soporte.id });
  _assert(rDel4b.success === true && rDel4b.data.pasoRevertido === false && rDel4b.data.evidenciaFirma === true,
    'T-H: eliminar soporte manual con firmado existente → no se revierte (evidenciaFirma=true)');
  var ctH = db.prepare('SELECT documentos_firmados FROM contrataciones WHERE id = ?').get(ctIdA);
  _assert(ctH.documentos_firmados === 1, 'T-H: paso 4 sigue completado');

  // Para T-G y T-I usamos una contratación nueva sin documentos firmados
  var rCt2 = registeredHandlers['gh:create-contratacion']({}, {
    token: 't', companyName: 'TEMPOACTIVA EST S.A.S.',
    data: { nombres: 'Sin', apellidos: 'Firma', cedula: '998', cargo: 'QA', fechaIngreso: '2026-09-01' }
  });
  var ctId2b = rCt2.data.contratacionId;

  // T-G: paso 4 sin firmados ni soportes → SOPORTE_REQUERIDO
  var rG = registeredHandlers['gh:marcar-paso']({}, { token: 't', contratacionId: ctId2b, pasoNum: 4 });
  _assert(rG.success === false && rG.error.code === 'SOPORTE_REQUERIDO',
    'T-G: paso 4 sin firma ni soporte → SOPORTE_REQUERIDO');

  // T-I: paso 4 con 1 soporte manual, SIN firmados → marcar OK → borrar soporte → se revierte
  var f7 = path.join(tmpRoot, 'solo-manual.pdf'); fs.writeFileSync(f7, 's');
  mockDialog._nextFile = f7;
  var rUpI = await registeredHandlers['gh:subir-soporte-paso']({}, { token: 't', companyName: 'TEMPOACTIVA EST S.A.S.', contratacionId: ctId2b, pasoNum: 4 });
  var rMarkI = registeredHandlers['gh:marcar-paso']({}, { token: 't', contratacionId: ctId2b, pasoNum: 4 });
  _assert(rMarkI.success === true, 'T-I setup: paso 4 completado con soporte manual');
  var rDelI = registeredHandlers['gh:eliminar-soporte-paso']({}, { token: 't', soporteId: rUpI.data.soporte.id });
  _assert(rDelI.success === true && rDelI.data.pasoRevertido === true, 'T-I: sin firma, borrar último soporte revierte el paso 4');
  var ctI = db.prepare('SELECT documentos_firmados FROM contrataciones WHERE id = ?').get(ctId2b);
  _assert(ctI.documentos_firmados === 0, 'T-I: paso 4 volvió a pendiente');

  console.log('');
  console.log('[7] Limpieza...');
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) {}
  console.log('  ✓ tmp dir limpiado');

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  RESULTADO: ' + _passed + ' OK · ' + _failed + ' FAIL');
  console.log('═══════════════════════════════════════');
  process.exit(_failed === 0 ? 0 : 1);
}

run().catch(function (e) { console.error('FATAL:', e); process.exit(1); });
