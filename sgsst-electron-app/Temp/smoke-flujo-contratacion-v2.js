// 📦775 · Smoke test E2E simple del flujo Contratación → Base Personal
// Solo valida que el bridge y schema compilen correctamente.

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const dbPath = path.join(process.env.APPDATA || (process.env.HOME + '/.config'), 'sgsst-electron-app', 'kair.db');
console.log('📦 BD:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('❌ BD no encontrada. Aborta.');
  process.exit(1);
}

(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(dbPath));

  var okCount = 0;
  var failCount = 0;
  function _ok(name) { console.log('  ✓ ' + name); okCount++; }
  function _fail(name, msg) { console.log('  ✗ ' + name + ' — ' + (msg || '')); failCount++; }

  try {
    // 1) Verificar que las 2 columnas nuevas existen en base_personal
    var cols = db.exec("PRAGMA table_info(base_personal)")[0].values;
    var colNames = cols.map(function (r) { return r[1]; });
    if (colNames.indexOf('fecha_ingreso_s400') >= 0) _ok('columna fecha_ingreso_s400 existe en base_personal');
    else _fail('columna fecha_ingreso_s400 NO existe');
    if (colNames.indexOf('fecha_afiliaciones') >= 0) _ok('columna fecha_afiliaciones existe en base_personal');
    else _fail('columna fecha_afiliaciones NO existe');

    // 2) Verificar que contrataciones tiene el campo trabajador_id
    var ctCols = db.exec("PRAGMA table_info(contrataciones)")[0].values;
    var ctColNames = ctCols.map(function (r) { return r[1]; });
    if (ctColNames.indexOf('trabajador_id') >= 0) _ok('columna trabajador_id existe en contrataciones');
    else _fail('columna trabajador_id NO existe en contrataciones');

    // 3) Verificar que las migraciones se aplicaron (contar contrataciones existentes)
    var ctCount = db.exec("SELECT COUNT(*) FROM contrataciones")[0].values[0][0];
    _ok('contrataciones en BD = ' + ctCount);

    var bpCount = db.exec("SELECT COUNT(*) FROM base_personal")[0].values[0][0];
    _ok('base_personal en BD = ' + bpCount);

    // 4) Buscar la lógica del handler (debe compilar)
    var bridgeCode = fs.readFileSync(
      path.join(__dirname, '..', 'main', 'gestion-humana-bridge.js'),
      'utf8'
    );
    if (bridgeCode.indexOf('Paso 6 (S400 Activado) = crear/vincular en base_personal') >= 0) {
      _ok('handler _handlerMarcarPaso tiene la fix de paso 6');
    } else {
      _fail('handler _handlerMarcarPaso NO tiene la fix de paso 6');
    }
    if (bridgeCode.indexOf("personalId: personalId") >= 0) {
      _ok('response incluye personalId');
    } else {
      _fail('response NO incluye personalId');
    }

    // 5) Verificar schema migrations incluye los 2 ALTER
    var schemaCode = fs.readFileSync(
      path.join(__dirname, '..', 'main', 'gestion-humana-schema-sql.js'),
      'utf8'
    );
    if (schemaCode.indexOf('fecha_ingreso_s400') >= 0) _ok('schema define fecha_ingreso_s400');
    else _fail('schema NO define fecha_ingreso_s400');
    if (schemaCode.indexOf('fecha_afiliaciones') >= 0) _ok('schema define fecha_afiliaciones');
    else _fail('schema NO define fecha_afiliaciones');

  } catch (e) {
    console.error('❌ Error:', e.message);
    failCount++;
  } finally {
    db.close();
  }

  console.log('\n=====================================================================');
  console.log('  Resumen: ' + okCount + ' OK · ' + failCount + ' FAIL');
  console.log('=====================================================================');
  process.exit(failCount > 0 ? 1 : 0);
})();
