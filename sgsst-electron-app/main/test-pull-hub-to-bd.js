/**
 * test-pull-hub-to-bd.js
 *
 * Simula lo que va a pasar cuando se reinicie la app con el fix:
 * 1. Lee el archivo .kairsync del hub
 * 2. Lo deserializa
 * 3. Aplica a la BD local (en copia de prueba)
 * 4. Verifica que las gestantes aparecen
 */
'use strict';
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

const serializer = require('./sync-serializer.js');

app.whenReady().then(async () => {
  const userData = path.join(os.homedir(), 'AppData', 'Roaming', 'sgsst-electron-app');
  const realDbPath = path.join(userData, 'kair.db');
  const testDbPath = path.join(userData, 'kair.test.db');
  const hubPath = 'G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\19. Asel S.A.S';
  const kairsyncFile = path.join(hubPath, 'empresa.kairsync');

  console.log('=== TEST: Pull desde hub a BD local ===');
  console.log('Hub:', kairsyncFile);
  console.log('BD real:', realDbPath);
  console.log('BD test:', testDbPath);
  console.log('');

  // 1. Copiar BD real a test (para no afectar datos reales)
  try {
    fs.copyFileSync(realDbPath, testDbPath);
    console.log('1. BD copiada a test');
  } catch (e) {
    console.log('1. ERROR copiando BD:', e.message);
    app.quit();
    return;
  }

  // 2. Leer .kairsync
  let syncData;
  try {
    const raw = fs.readFileSync(kairsyncFile, 'utf8');
    syncData = JSON.parse(raw);
    console.log('2. .kairsync leido OK');
    console.log('   - companyKey:', syncData.companyKey);
    console.log('   - lastWriteAt:', syncData.lastWriteAt);
    console.log('   - lastWriter.pcId:', syncData.lastWriter.pcId);
    console.log('   - gestaciones:', syncData.entities.gestaciones.length);
    console.log('   - seguimientos (sum):',
      syncData.entities.gestaciones.reduce((a, g) => a + (g.seguimientos ? g.seguimientos.length : 0), 0));
  } catch (e) {
    console.log('2. ERROR leyendo .kairsync:', e.message);
    app.quit();
    return;
  }

  // 3. Abrir BD test y deserializar
  const Database = require('better-sqlite3');
  const db = new Database(testDbPath);

  console.log('');
  console.log('3. Aplicando deserializacion a BD test...');

  // Estado ANTES del pull
  const before = db.prepare('SELECT COUNT(*) as c FROM gestaciones').get();
  console.log('   Gestaciones en BD test ANTES:', before.c);

  try {
    const result = serializer.deserializeSyncToDb(db, syncData, {
      conflictLog: function (local, remote) {
        console.log('   Conflicto: ' + local.id +
                    ' (local=' + local.updatedAt + ' -> remoto=' + remote.updatedAt + ')');
      }
    });
    console.log('   Resultado:', JSON.stringify(result));
  } catch (e) {
    console.log('   ERROR deserializando:', e.message);
    console.log('   Stack:', e.stack);
    db.close();
    app.quit();
    return;
  }

  // Estado DESPUES del pull
  const after = db.prepare('SELECT COUNT(*) as c FROM gestaciones').get();
  console.log('   Gestaciones en BD test DESPUES:', after.c);

  if (after.c > 0) {
    const sample = db.prepare('SELECT id, nombre, cedula, empresa_id, semanas_gestacion FROM gestaciones LIMIT 5').all();
    console.log('');
    console.log('4. Sample de gestantes en BD test:');
    sample.forEach(r => console.log('   -', r.nombre, '| cedula:', r.cedula, '| sem:', r.semanas_gestacion));

    const seg = db.prepare('SELECT COUNT(*) as c FROM seguimiento_gestacion_mensual').get();
    console.log('');
    console.log('5. Seguimientos en BD test:', seg.c);
  }

  db.close();

  // Limpiar
  try { fs.unlinkSync(testDbPath); console.log(''); console.log('6. BD test eliminada (limpieza)'); } catch (e) {}

  console.log('');
  console.log('=== VEREDICTO ===');
  if (after.c === syncData.entities.gestaciones.length) {
    console.log('OK — el pull deserializara', after.c, 'gestantes a la BD local');
    console.log('Cuando se reinicie la app con el fix, deberia verse la lista');
  } else {
    console.log('FAIL — gestaciones en BD:', after.c, 'esperadas:', syncData.entities.gestaciones.length);
  }

  app.quit();
});
