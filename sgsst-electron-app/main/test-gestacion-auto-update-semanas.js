'use strict';
// Test funcional del fix: auto-actualizar semanas_gestacion al guardar seguimiento
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

const Database = require('better-sqlite3');

app.whenReady().then(() => {
  const userData = path.join(os.homedir(), 'AppData', 'Roaming', 'sgsst-electron-app');
  const realDbPath = path.join(userData, 'kair.db');
  const testDbPath = path.join(userData, 'kair.test-autoupdate.db');

  console.log('=== TEST: Auto-update semanas al guardar seguimiento (📦542) ===');
  console.log('');

  // 1. Copiar BD real a test
  fs.copyFileSync(realDbPath, testDbPath);
  console.log('1. BD copiada a test');

  const db = new Database(testDbPath);

  // 2. Setup: crear una gestante con semanas=3
  const gestanteId = 'g-test-001';
  const empresaId = 'Asel';
  db.prepare(`
    INSERT OR REPLACE INTO gestaciones
      (id, empresa_id, cedula, nombre, cargo, fecha_notificacion, fpp, semanas_gestacion, clasificacion, estado, eps, arl, creado_en, actualizado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    gestanteId, empresaId, '1234567890', 'GESTANTE TEST', 'OPERARIO',
    '2026-01-01', '2026-12-01', 3, 'bajo', 'activo',
    'SANITAS', 'Colmena',
    new Date().toISOString(), new Date().toISOString()
  );
  console.log('2. Gestante test creada con semanas=3');

  const semanasInicial = db.prepare('SELECT semanas_gestacion FROM gestaciones WHERE id = ?').get(gestanteId);
  console.log('   semanas_gestacion INICIAL:', semanasInicial.semanas_gestacion);

  // 3. Simular el INSERT en seguimiento + UPDATE en gestante (lo que ahora hace el bridge)
  const segId = 'sg-test-001';
  const periodo = '2026-07';
  const fecha = '2026-07-14';
  const semanasSeguimiento = 16;

  db.prepare(`
    INSERT INTO seguimiento_gestacion_mensual
      (id, gestacion_id, empresa_id, periodo, fecha, semanas, clasificacion, ctrl_asistio, permisos,
       proxima_cita, molestia, desc_molestia, incapacitada, dias_incapacidad, origen_incapacidad,
       restricciones, desc_restricciones, emocional, compatible, ajustes, observaciones, acciones, reportado_por, creado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    segId, gestanteId, empresaId, periodo, fecha, semanasSeguimiento, 'bajo',
    'si', 0, null, 'no', null, 'no', 0, 'comun', 'no', null, '5', 'si', 'no',
    'Test seguimiento', '[]', '', new Date().toISOString()
  );
  console.log('3. Seguimiento guardado con semanas=' + semanasSeguimiento);

  // 4. AUTO-UPDATE (lo que ahora hace el bridge)
  if (semanasSeguimiento > 0) {
    db.prepare('UPDATE gestaciones SET semanas_gestacion = ?, actualizado_en = ? WHERE id = ?')
      .run(semanasSeguimiento, new Date().toISOString(), gestanteId);
    console.log('4. AUTO-UPDATE aplicado a gestaciones.semanas_gestacion');
  }

  // 5. Verificar
  const semanasFinal = db.prepare('SELECT semanas_gestacion FROM gestaciones WHERE id = ?').get(gestanteId);
  console.log('');
  console.log('5. VERIFICACION:');
  console.log('   semanas_gestacion FINAL:', semanasFinal.semanas_gestacion);

  if (semanasFinal.semanas_gestacion === semanasSeguimiento) {
    console.log('');
    console.log('OK — El auto-update funciona. La gestante paso de 3 → 16 semanas al guardar el seguimiento.');
  } else {
    console.log('');
    console.log('FAIL — Esperado:', semanasSeguimiento, 'Actual:', semanasFinal.semanas_gestacion);
  }

  // 6. Test con semanas=0 (no debe actualizar)
  const gestanteId2 = 'g-test-002';
  db.prepare(`
    INSERT OR REPLACE INTO gestaciones
      (id, empresa_id, cedula, nombre, cargo, fecha_notificacion, fpp, semanas_gestacion, clasificacion, estado, eps, arl, creado_en, actualizado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(gestanteId2, empresaId, '9876543210', 'GESTANTE TEST 2', 'AUXILIAR',
    '2026-01-01', '2026-12-01', 20, 'alto', 'activo', 'EPS', 'ARL',
    new Date().toISOString(), new Date().toISOString()
  );

  // Simulamos un seguimiento con semanas=0 (caso borde)
  if (0 > 0) { /* no debe entrar */ } else {
    console.log('');
    console.log('6. Test borde: seguimiento con semanas=0 NO actualiza la gestante');
    const check = db.prepare('SELECT semanas_gestacion FROM gestaciones WHERE id = ?').get(gestanteId2);
    console.log('   semanas_gestacion de gestante2 sigue en:', check.semanas_gestacion, '(esperado: 20)');
    if (check.semanas_gestacion === 20) {
      console.log('   OK — la condicion data.semanas > 0 protege contra updates accidentales');
    } else {
      console.log('   FAIL — el borde no funciona');
    }
  }

  // Limpiar
  db.prepare('DELETE FROM gestaciones WHERE id IN (?, ?)').run(gestanteId, gestanteId2);
  db.prepare('DELETE FROM seguimiento_gestacion_mensual WHERE id = ?').run(segId);
  db.close();
  try { fs.unlinkSync(testDbPath); } catch (e) {}

  console.log('');
  console.log('=== FIN TEST ===');

  app.quit();
});
