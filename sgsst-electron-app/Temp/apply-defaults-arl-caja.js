// 📦748 · Migración: aplicar defaults de ARL y Caja de Compensación a los 753
// workers existentes que fueron importados sin esos campos (porque el Excel
// no tenía esas columnas y la versión vieja del import no aplicaba defaults
// si el user dejaba "— sin asignar —" en el select).
//
// IDEMPOTENTE: solo actualiza los workers que tienen arl o caja_compensacion NULL/vacío.
// NO toca los demás campos.
//
// Uso:
//   node Temp\apply-defaults-arl-caja.js
//
// Defaults (alineados con BP_IMPORT_DEFAULTS del frontend):
//   arl               = "Colmena"
//   caja_compensacion = "Caja Comfamiliar Atlántico"
//
// ⚠️ ANTES DE EJECUTAR: cerrá la app K+AIR (porque tiene la BD abierta en modo escritura).
//    Si la BD está bloqueada, el script va a tirar error y no se aplica nada.

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const dbPath = path.join(process.env.APPDATA || process.env.HOME + '/.config', 'sgsst-electron-app', 'kair.db');
console.log('BD:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('❌ BD no encontrada. Abortando.');
  process.exit(1);
}

const DEFAULT_ARL = 'Colmena';
const DEFAULT_CAJA = 'Caja Comfamiliar Atlántico';

// Hacer un backup antes de modificar
const backupPath = dbPath + '.backup-' + Date.now();
fs.copyFileSync(dbPath, backupPath);
console.log('✓ Backup creado:', backupPath);

(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(dbPath));

  // Conteos antes
  const totalPersonal = db.exec("SELECT COUNT(*) FROM base_personal")[0].values[0][0];
  const sinArl = db.exec("SELECT COUNT(*) FROM base_personal WHERE arl IS NULL OR arl = ''")[0].values[0][0];
  const sinCaja = db.exec("SELECT COUNT(*) FROM base_personal WHERE caja_compensacion IS NULL OR caja_compensacion = ''")[0].values[0][0];
  console.log('\n=== ANTES ===');
  console.log('  Total personal:', totalPersonal);
  console.log('  Sin arl:', sinArl);
  console.log('  Sin caja_compensacion:', sinCaja);

  // Aplicar defaults (idempotente: solo donde es NULL o '')
  db.run("UPDATE base_personal SET arl = ? WHERE arl IS NULL OR arl = ''", [DEFAULT_ARL]);
  db.run("UPDATE base_personal SET caja_compensacion = ? WHERE caja_compensacion IS NULL OR caja_compensacion = ''", [DEFAULT_CAJA]);

  // Conteos después
  const sinArlAfter = db.exec("SELECT COUNT(*) FROM base_personal WHERE arl IS NULL OR arl = ''")[0].values[0][0];
  const sinCajaAfter = db.exec("SELECT COUNT(*) FROM base_personal WHERE caja_compensacion IS NULL OR caja_compensacion = ''")[0].values[0][0];
  console.log('\n=== DESPUÉS ===');
  console.log('  Sin arl:', sinArlAfter, '(actualizados:', sinArl - sinArlAfter, ')');
  console.log('  Sin caja_compensacion:', sinCajaAfter, '(actualizados:', sinCaja - sinCajaAfter, ')');

  // Persistir los cambios
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  db.close();

  console.log('\n✅ Migración completada. BD guardada en:', dbPath);
  console.log('   Backup disponible en:', backupPath);
  console.log('\nPodés borrar el backup con: del "' + backupPath + '"');
})();
