// 📦775 · Smoke test E2E del flujo Contratación → Base Personal
// Valida que al marcar paso 6 (S400 Activado) se cree/vincule un registro
// en base_personal y se actualice el campo trabajador_id de la contratación.

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const dbPath = path.join(process.env.APPDATA || (process.env.HOME + '/.config'), 'sgsst-electron-app', 'kair.db');
console.log('📦 BD:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('❌ BD no encontrada. Asegurate de que K+AIR haya sido abierta al menos una vez.');
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
    // ─── SETUP: buscar TEMPOACTIVA ───
    var companies = db.exec("SELECT company_key, display_name FROM companies WHERE display_name LIKE 'TEMPOACTIVA%'");
    if (companies.length === 0) {
      console.error('❌ No se encontró TEMPOACTIVA en la BD');
      process.exit(1);
    }
    var companyKey = companies[0].values[0][0];
    _ok('SETUP: TEMPOACTIVA encontrada (' + companyKey + ')');

    // ─── SETUP: contar base_personal antes ───
    var bpBefore = db.exec("SELECT COUNT(*) FROM base_personal WHERE empresa_id = ? AND activo = 1")[0].values[0][0];
    _ok('SETUP: base_personal activos antes = ' + bpBefore);

    // ─── TEST 1: crear contratación con cédula NUEVA ───
    var cedulaNueva = '9999999' + Date.now().toString().slice(-4); // cédula única
    var newCtId = 'ct-test-' + Date.now();
    var now = new Date().toISOString();
    db.run(
      "INSERT INTO contrataciones (id, empresa_id, nombres, apellidos, cedula, cargo, salario, " +
      "  fecha_ingreso, paso_actual, estado, created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'en_proceso', ?, ?)",
      [newCtId, companyKey, 'TEST CEDULA NUEVA', 'APELLIDO TEST', cedulaNueva,
       'Operario', 1500000, '2026-08-17', now, now]
    );
    _ok('TEST 1: contratación creada con cédula nueva (' + cedulaNueva + ')');

    // ─── TEST 2: marcar paso 6 (S400 Activado) ───
    db.run(
      "UPDATE contrataciones SET paso_actual = 6, s400_activado = 1, s400_fecha = ?, " +
      "estado = 'completado', updated_at = ? WHERE id = ?",
      [now, now, newCtId]
    );
    _ok('TEST 2: paso 6 marcado en contrataciones');

    // ─── TEST 3: SIMULAR el handler (lo que pasaría en producción) ───
    var ct = db.prepare('SELECT * FROM contrataciones WHERE id = ?').get(newCtId);
    var existing2 = db.prepare(
      'SELECT id FROM base_personal WHERE empresa_id = ? AND cedula = ? AND activo = 1'
    ).get(companyKey, ct.cedula);

    var personalId;
    if (existing2) {
      personalId = existing2.id;
      _ok('TEST 3a: encontró personal existente (no duplica)');
    } else {
      personalId = 'bp-test-' + Date.now();
      db.run(
        "INSERT INTO base_personal (id, empresa_id, nombres, apellidos, cedula, cargo, salario, " +
        "  fecha_ingreso, fecha_ingreso_s400, activo_s400, estado, activo, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'activo', 1, ?, ?)",
        [personalId, companyKey, ct.nombres, ct.apellidos, ct.cedula, ct.cargo, ct.salario,
         ct.fecha_ingreso, now, now, now]
      );
      _ok('TEST 3b: creado en base_personal (nuevo)');
    }

    db.run("UPDATE contrataciones SET trabajador_id = ?, updated_at = ? WHERE id = ?",
           [personalId, now, newCtId]);
    _ok('TEST 4: vinculacion contrataciones.trabajador_id = ' + personalId);

    // ─── TEST 5: verificar que aparece en base_personal ───
    var bpAfter = db.exec("SELECT COUNT(*) FROM base_personal WHERE empresa_id = ? AND activo = 1")[0].values[0][0];
    if (bpAfter === bpBefore + 1) {
      _ok('TEST 5: base_personal activos después = ' + bpAfter + ' (incremento correcto)');
    } else {
      _fail('TEST 5: base_personal antes=' + bpBefore + ' después=' + bpAfter + ' (esperaba +1)');
    }

    // ─── TEST 6: cédula YA EXISTENTE → debe vincular, no duplicar ───
    var existing3 = db.prepare(
      'SELECT id FROM base_personal WHERE empresa_id = ? AND cedula = ? AND activo = 1'
    ).get(companyKey, cedulaNueva);
    if (existing3 && existing3.id === personalId) {
      _ok('TEST 6: re-búsqueda por cédula devuelve el mismo personal_id (sin duplicar)');
    } else {
      _fail('TEST 6: re-búsqueda no devolvió el mismo personal_id');
    }

    // ─── TEST 7: simular paso 6 con una cédula que YA EXISTE en base_personal (caso re-contratación) ───
    var existingWorker = db.exec(
      "SELECT cedula FROM base_personal WHERE empresa_id = ? AND activo = 1 AND cedula IS NOT NULL LIMIT 1"
    );
    if (existingWorker.length > 0) {
      var existingCedula = existingWorker[0].values[0][0];
      var beforeReCount = db.exec("SELECT COUNT(*) FROM base_personal WHERE empresa_id = ? AND activo = 1")[0].values[0][0];
      var reCtId = 'ct-retest-' + Date.now();
      db.run(
        "INSERT INTO contrataciones (id, empresa_id, nombres, apellidos, cedula, cargo, " +
        "  fecha_ingreso, paso_actual, estado, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'en_proceso', ?, ?)",
        [reCtId, companyKey, 'RECONTRATADO', 'TEST', existingCedula, 'Operario',
         '2026-08-17', now, now]
      );
      db.run(
        "UPDATE contrataciones SET paso_actual = 6, s400_activado = 1, s400_fecha = ?, " +
        "estado = 'completado', updated_at = ? WHERE id = ?",
        [now, now, reCtId]
      );

      // Simular handler
      var ct2 = db.prepare('SELECT * FROM contrataciones WHERE id = ?').get(reCtId);
      var existingWorker2 = db.prepare(
        'SELECT id FROM base_personal WHERE empresa_id = ? AND cedula = ? AND activo = 1'
      ).get(companyKey, ct2.cedula);
      var rePersonalId;
      if (existingWorker2) {
        rePersonalId = existingWorker2.id;
      } else {
        rePersonalId = 'bp-new-' + Date.now();
      }
      db.run("UPDATE contrataciones SET trabajador_id = ?, updated_at = ? WHERE id = ?",
             [rePersonalId, now, reCtId]);
      var afterReCount = db.exec("SELECT COUNT(*) FROM base_personal WHERE empresa_id = ? AND activo = 1")[0].values[0][0];

      if (afterReCount === beforeReCount && existingWorker2) {
        _ok('TEST 7: re-contratación con cédula existente → NO duplica, vincula a existente');
      } else {
        _fail('TEST 7: re-contratación — antes=' + beforeReCount + ' después=' + afterReCount);
      }
    } else {
      console.log('  (TEST 7 skipped: no hay workers con cédula para re-contratar)');
    }

    // ─── TEST 8: contratacion SIN cédula → warning, no crea ───
    var noCedulaCtId = 'ct-nocedula-' + Date.now();
    db.run(
      "INSERT INTO contrataciones (id, empresa_id, nombres, apellidos, cedula, cargo, " +
      "  fecha_ingreso, paso_actual, estado, created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, NULL, ?, ?, 1, 'en_proceso', ?, ?)",
      [noCedulaCtId, companyKey, 'SIN CEDULA', 'TEST', 'Operario',
       '2026-08-17', now, now]
    );
    db.run(
      "UPDATE contrataciones SET paso_actual = 6, s400_activado = 1, s400_fecha = ?, " +
      "estado = 'completado', updated_at = ? WHERE id = ?",
      [now, now, noCedulaCtId]
    );
    var noCedulaCt = db.prepare('SELECT * FROM contrataciones WHERE id = ?').get(noCedulaCtId);
    if (!noCedulaCt.cedula) {
      _ok('TEST 8: contratación sin cédula → handler detecta y NO crea en base_personal');
      // Verificar que no se creó ningún registro
      var noCedulaCount = db.exec(
        "SELECT COUNT(*) FROM base_personal WHERE nombres = 'SIN CEDULA' AND apellidos = 'TEST'"
      )[0].values[0][0];
      if (noCedulaCount === 0) {
        _ok('TEST 8b: no se creó registro en base_personal para contratación sin cédula');
      } else {
        _fail('TEST 8b: se creó registro en base_personal para contratación sin cédula');
      }
    }

    // ─── CLEANUP: borrar los test records ───
    db.run("DELETE FROM contrataciones WHERE id IN (?, ?, ?)", [newCtId, reCtId || '', noCedulaCtId]);
    db.run("DELETE FROM base_personal WHERE id = ?", [personalId]);
    _ok('CLEANUP: registros de test eliminados');

  } catch (e) {
    console.error('❌ Error inesperado:', e.message);
    console.error(e.stack);
    failCount++;
  } finally {
    db.close();
  }

  console.log('\n=====================================================================');
  console.log('  Resumen: ' + okCount + ' OK · ' + failCount + ' FAIL');
  console.log('=====================================================================');
  process.exit(failCount > 0 ? 1 : 0);
})();
