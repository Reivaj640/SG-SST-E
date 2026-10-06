'use strict';
// Test del fix 📦542: actualizar gestante con el mismo patron que el modal usa
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

const Database = require('better-sqlite3');

app.whenReady().then(() => {
  const userData = path.join(os.homedir(), 'AppData', 'Roaming', 'sgsst-electron-app');
  const realDbPath = path.join(userData, 'kair.db');
  const testDbPath = path.join(userData, 'kair.test-update.db');

  console.log('=== TEST: Actualizar gestante (FIX Illegal invocation) ===');
  console.log('');

  // 1. Copiar BD real a test
  fs.copyFileSync(realDbPath, testDbPath);
  const db = new Database(testDbPath);
  console.log('1. BD copiada a test');

  // 2. Verificar que la gestante existe (Mariota del screenshot)
  const mariota = db.prepare("SELECT * FROM gestaciones WHERE nombre LIKE '%MARIOTA%' LIMIT 1").get();
  if (!mariota) {
    console.log('2. No se encontro MARIOTA en la BD. Usando gestante de prueba.');
    // Crear una gestante de prueba
    db.prepare(`
      INSERT OR REPLACE INTO gestaciones
        (id, empresa_id, cedula, nombre, cargo, fecha_notificacion, fpp, semanas_gestacion, clasificacion, estado, eps, arl, creado_en, actualizado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'g-test-mariota', 'Asel', '1043127753', 'MARIOTA CHAMORRO HILARY ANDREA', 'MESERO',
      '2026-02-18', '2026-11-10', 3, 'alto', 'activo',
      'SANITAS', 'Colmena',
      new Date().toISOString(), new Date().toISOString()
    );
  }
  const gestante = mariota || db.prepare("SELECT * FROM gestaciones WHERE id = 'g-test-mariota'").get();
  console.log('2. Gestante:', gestante.nombre, '| semanas actuales:', gestante.semanas_gestacion);

  // 3. Simular EXACTAMENTE lo que hace _handlerActualizarGestante
  var data = {
    semanasGestacion: 7,
    fpp: '2026-11-10',
    clasificacion: 'alto',
    estado: 'activo',
    eps: 'SANITAS',
    arl: 'Colmena',
    cargo: 'MESERO',
    observaciones: 'Trabajadora manifiesta que estado de gestacion es de alto riesgo por Preclancia'
  };

  // Whitelist (la misma del bridge)
  var allowed = [
    'nombre', 'cargo', 'fpp', 'semanas_gestacion', 'clasificacion',
    'estado', 'eps', 'arl', 'fecha_inicio_licencia', 'fecha_fin_licencia',
    'observaciones', 'fecha_notificacion'
  ];
  function _camel(snake) {
    return snake.replace(/_([a-z])/g, function (m, c) { return c.toUpperCase(); });
  }

  var sets = [];
  var values = [];
  allowed.forEach(function (k) {
    var snake = k.replace(/[A-Z]/g, function (m) { return '_' + m.toLowerCase(); });
    if (data && Object.prototype.hasOwnProperty.call(data, _camel(k))) {
      sets.push(snake + ' = ?');
      values.push(data[_camel(k)]);
    }
  });
  sets.push('actualizado_en = ?');
  values.push(new Date().toISOString());
  values.push(gestante.id);
  values.push(gestante.empresa_id);

  console.log('3. SQL UPDATE:');
  console.log('   SET:', sets.join(', '));
  console.log('   VALUES:', values.length, 'parametros');

  // 4. FIX: stmt.run.apply(stmt, values) — antes era .run.apply(null, values)
  try {
    var stmt = db.prepare('UPDATE gestaciones SET ' + sets.join(', ') +
        ' WHERE id = ? AND empresa_id = ?');
    var result = stmt.run.apply(stmt, values);
    console.log('4. UPDATE ejecutado OK. changes:', result.changes);
  } catch (e) {
    console.log('4. ERROR en UPDATE:', e.message);
    console.log('   Stack:', e.stack);
    process.exit(1);
  }

  // 5. Verificar
  var updated = db.prepare('SELECT * FROM gestaciones WHERE id = ?').get(gestante.id);
  console.log('');
  console.log('5. VERIFICACION:');
  console.log('   semanas_gestacion:', updated.semanas_gestacion, '(esperado: 7)');
  console.log('   fpp:', updated.fpp);
  console.log('   clasificacion:', updated.clasificacion);
  console.log('   cargo:', updated.cargo);

  if (updated.semanas_gestacion === 7) {
    console.log('');
    console.log('OK — El UPDATE funciona. El fix del "Illegal invocation" esta aplicado.');
  } else {
    console.log('');
    console.log('FAIL — Esperado: 7, Actual:', updated.semanas_gestacion);
  }

  // 6. Restaurar la BD original (revertir cambios)
  if (mariota) {
    db.prepare(`
      UPDATE gestaciones SET semanas_gestacion = ?, fpp = ?, cargo = ?, observaciones = ?
      WHERE id = ?
    `).run(mariota.semanas_gestacion, mariota.fpp, mariota.cargo, mariota.observaciones, mariota.id);
    console.log('');
    console.log('6. BD restaurada al estado original');
  } else {
    db.prepare('DELETE FROM gestaciones WHERE id = ?').run('g-test-mariota');
    console.log('');
    console.log('6. Gestante de prueba eliminada');
  }

  db.close();
  try { fs.unlinkSync(testDbPath); } catch (e) {}

  console.log('');
  console.log('=== FIN TEST ===');

  app.quit();
});
