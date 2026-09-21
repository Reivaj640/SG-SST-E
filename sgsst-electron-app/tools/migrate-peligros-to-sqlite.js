/* ==========================================================================
K+AIR — Herramienta de migración: JSON → SQLite (módulo 4.1.2)
NO SE EJECUTA AUTOMÁTICAMENTE. Es una utilidad standalone.
Uso futuro (cuando decidas migrar):
   1. cd <raíz-del-proyecto>
   2. npm install better-sqlite3 (si no está)
   3. node tools/migrate-peligros-to-sqlite.js [--dry-run] [--src <ruta>] [--dst <ruta>]
      --dry-run : solo reporta lo que se migraría, sin escribir
      --src     : carpeta origen (default: %APPDATA%/sgsst-electron-app/identificacion-peligros-data/)
      --dst     : archivo .db destino (default: <src>/../identificacion-peligros.db)
========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_SRC = path.join(os.homedir(), 'AppData', 'Roaming', 'sgsst-electron-app', 'identificacion-peligros-data');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, src: DEFAULT_SRC, dst: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--src') opts.src = args[++i];
    else if (args[i] === '--dst') opts.dst = args[++i];
  }
  if (!opts.dst) opts.dst = path.join(path.dirname(opts.src), 'identificacion-peligros.db');
  return opts;
}

function discoverCompanyFiles(srcDir) {
  if (!fs.existsSync(srcDir)) {
    console.error('[K+AIRSST][MIGRATE_PELIGROS][ERROR] No existe carpeta origen:', srcDir);
    process.exit(1);
  }
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.json')) files.push(path.join(srcDir, e.name));
  }
  return files;
}

function loadCompanyData(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    const companyName = path.basename(file, '.json');
    return { companyName, data };
  } catch (err) {
    console.error('[K+AIRSST][MIGRATE_PELIGROS][ERROR] No se pudo leer', file, '·', err.message);
    return null;
  }
}

function migrate(opts) {
  console.log('[K+AIRSST][MIGRATE_PELIGROS][INIT] Origen:', opts.src);
  console.log('[K+AIRSST][MIGRATE_PELIGROS][INIT] Destino:', opts.dst, opts.dryRun ? '(dry-run)' : '');

  const files = discoverCompanyFiles(opts.src);
  console.log('[K+AIRSST][MIGRATE_PELIGROS][SCAN] Archivos JSON encontrados:', files.length);

  let totalPeligros = 0;
  let totalSedes = 0;
  let totalProcesos = 0;
  let totalCargos = 0;

  const summaries = [];

  for (const file of files) {
    const rec = loadCompanyData(file);
    if (!rec) continue;
    const { companyName, data } = rec;
    let pc = 0, sc = 0, procC = 0, cargC = 0;
    if (data && data.sedes) {
      data.sedes.forEach((s) => {
        sc++;
        (s.procesos || []).forEach((p) => {
          procC++;
          (p.cargos || []).forEach((c) => {
            cargC++;
            pc += (c.peligros || []).length;
          });
        });
      });
    }
    summaries.push({ companyName, sedes: sc, procesos: procC, cargos: cargC, peligros: pc });
    totalSedes += sc; totalProcesos += procC; totalCargos += cargC; totalPeligros += pc;
  }

  console.log('\n=== RESUMEN DE MIGRACIÓN ===');
  console.log('Empresas:', files.length);
  console.log('Sedes:', totalSedes);
  console.log('Procesos:', totalProcesos);
  console.log('Cargos:', totalCargos);
  console.log('Peligros:', totalPeligros);

  console.log('\nDetalle por empresa:');
  summaries.forEach((s) => {
    console.log('  ·', s.companyName, '→', s.sedes, 'sedes ·', s.procesos, 'procesos ·', s.cargos, 'cargos ·', s.peligros, 'peligros');
  });

  if (opts.dryRun) {
    console.log('\n[K+AIRSST][MIGRATE_PELIGROS][DRY_RUN] No se escribió ningún archivo.');
    console.log('[K+AIRSST][MIGRATE_PELIGROS][DRY_RUN] Para ejecutar la migración real, retira --dry-run.');
    return;
  }

  /* Migración real: carga better-sqlite3, crea schema idéntico al del preload,
     inserta todos los registros. */
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (err) {
    console.error('[K+AIRSST][MIGRATE_PELIGROS][ERROR] better-sqlite3 no instalado. Ejecuta: npm install better-sqlite3');
    process.exit(2);
  }

  if (fs.existsSync(opts.dst)) {
    const backup = opts.dst + '.bak.' + Date.now();
    fs.copyFileSync(opts.dst, backup);
    console.log('[K+AIRSST][MIGRATE_PELIGROS][BACKUP] Backup creado:', backup);
    fs.unlinkSync(opts.dst);
  }

  const db = new Database(opts.dst);
  db.exec(`
    CREATE TABLE IF NOT EXISTS matrices (
      companyName TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS peligros (
      id TEXT PRIMARY KEY,
      companyName TEXT NOT NULL,
      sedeId TEXT, sedeNombre TEXT,
      procesoId TEXT, procesoNombre TEXT,
      cargoId TEXT, cargoNombre TEXT,
      tipo TEXT, peligro TEXT,
      efectosPosibles TEXT,
      controlFuente TEXT, controlMedio TEXT, controlPersona TEXT,
      nd INTEGER, ne INTEGER, np INTEGER, interpNp TEXT,
      nc INTEGER, nr INTEGER, interpNr TEXT, aceptabilidad TEXT,
      nExpuestos INTEGER, peorConsecuencia TEXT,
      medidaEliminacion TEXT, medidaSustitucion TEXT, medidaIngenieria TEXT,
      medidaAdministrativos TEXT, medidaEpp TEXT,
      createdAt TEXT, updatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY, companyName TEXT, tipo TEXT, nombre TEXT, data TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_peligros_company ON peligros(companyName);
  `);

  const stmtUpsertMatriz = db.prepare(`
    INSERT OR REPLACE INTO matrices (companyName, data, updatedAt)
    VALUES (?, ?, ?)
  `);
  const stmtInsertPeligro = db.prepare(`
    INSERT OR REPLACE INTO peligros (
      id, companyName, sedeId, sedeNombre, procesoId, procesoNombre, cargoId, cargoNombre,
      tipo, peligro, efectosPosibles, controlFuente, controlMedio, controlPersona,
      nd, ne, np, interpNp, nc, nr, interpNr, aceptabilidad,
      nExpuestos, peorConsecuencia,
      medidaEliminacion, medidaSustitucion, medidaIngenieria, medidaAdministrativos, medidaEpp,
      createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?
    )
  `);

  const tx = db.transaction((file) => {
    const rec = loadCompanyData(file);
    if (!rec) return 0;
    const { companyName, data } = rec;
    const now = new Date().toISOString();
    stmtUpsertMatriz.run(companyName, JSON.stringify(data), now);

    let inserted = 0;
    (data.sedes || []).forEach((s) => {
      (s.procesos || []).forEach((p) => {
        (p.cargos || []).forEach((c) => {
          (c.peligros || []).forEach((pel) => {
            stmtInsertPeligro.run(
              pel.id || ('pel_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)),
              companyName, s.id, s.nombre, p.id, p.nombre, c.id, c.nombre,
              pel.tipo, pel.peligro, pel.efectosPosibles, pel.controlFuente, pel.controlMedio, pel.controlPersona,
              pel.nd, pel.ne, pel.np, pel.npInterpretacion, pel.nc, pel.nr, pel.nrNivel, pel.nrLabel,
              pel.expuestos, pel.peorConsecuencia,
              pel.medidaEliminacion, pel.medidaSustitucion, pel.medidaIngenieria, pel.medidaAdministrativos, pel.medidaEpp,
              pel.createdAt || now, pel.updatedAt || now
            );
            inserted++;
          });
        });
      });
    });
    return inserted;
  });

  for (const file of files) {
    const n = tx(file);
    console.log('  ·', path.basename(file), '→', n, 'peligros');
  }

  db.close();
  console.log('\n[K+AIRSST][MIGRATE_PELIGROS][SUCCESS] Migración completa.');
  console.log('[K+AIRSST][MIGRATE_PELIGROS][SUCCESS] DB en:', opts.dst);
  console.log('[K+AIRSST][MIGRATE_PELIGROS][NEXT_STEP] Reemplazar identificacion-peligros-bridge.js para usar esta DB en vez de los JSON.');
}

if (require.main === module) {
  const opts = parseArgs();
  try { migrate(opts); } catch (err) {
    console.error('[K+AIRSST][MIGRATE_PELIGROS][FATAL]', err.stack || err.message);
    process.exit(1);
  }
}

module.exports = { migrate, parseArgs };
