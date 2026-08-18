/**
 * Ejecuta las migraciones de SQLite en orden.
 *
 * - Lee archivos .sql de src/db/schema/ en orden alfabético.
 * - Cada migración se aplica en una transacción.
 * - Registra en `gh_firma_schema_migrations` para no aplicar dos veces.
 *
 * Uso: `npm run migrate` o `node src/db/migrate.js`
 */
'use strict';

const fs = require('fs');
const path = require('path');
const db = require('./connection');
const logger = require('../utils/logger');

const SCHEMA_DIR = path.join(__dirname, 'schema');

function listMigrations() {
  if (!fs.existsSync(SCHEMA_DIR)) {
    throw new Error(`No existe el directorio de schema: ${SCHEMA_DIR}`);
  }
  return fs.readdirSync(SCHEMA_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

function getAppliedMigrations() {
  // La tabla gh_firma_schema_migrations puede no existir aún.
  // La creamos inline para que el sistema sea autocontenido.
  db.exec(`
    CREATE TABLE IF NOT EXISTS gh_firma_schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      description TEXT
    );
  `);
  return new Set(
    db.prepare('SELECT version FROM gh_firma_schema_migrations').all()
      .map(row => row.version)
  );
}

function applyMigration(filename) {
  const version = filename.replace('.sql', '');
  const filepath = path.join(SCHEMA_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf8');

  logger.info('Aplicando migración', { version, file: filename });

  const tx = db.transaction(() => {
    // Las migraciones deben ser idempotentes: si dos procesos corren
    // migrate() en paralelo (ej. tests con --test-concurrency=N>1), el
    // ALTER TABLE ADD COLUMN o CREATE INDEX pueden fallar con
    // "duplicate column name" / "index already exists" si otro proceso
    // ya aplicó los cambios. Capturamos esos errores específicos y los
    // tratamos como éxito idempotente. Otros errores se relanzan.
    try {
      db.exec(sql);
    } catch (e) {
      const msg = e.message || '';
      const isIdempotentError =
        msg.includes('duplicate column name') ||
        msg.includes('index already exists');
      if (isIdempotentError) {
        logger.warn('Migración ya aplicada (idempotente), continuando', {
          version,
          error: msg,
        });
        // No throw → permite registrar en gh_firma_schema_migrations
      } else {
        throw e;
      }
    }
    db.prepare(
      'INSERT INTO gh_firma_schema_migrations (version, description) VALUES (?, ?)'
    ).run(version, `Auto-aplicada de ${filename}`);
  });
  tx();

  logger.info('Migración aplicada', { version });
}

function migrate() {
  const all = listMigrations();
  const applied = getAppliedMigrations();

  let newCount = 0;
  for (const filename of all) {
    const version = filename.replace('.sql', '');
    if (applied.has(version)) {
      logger.debug('Migración ya aplicada, saltando', { version });
      continue;
    }
    applyMigration(filename);
    newCount++;
  }

  if (newCount === 0) {
    logger.info('No hay migraciones pendientes', { total: all.length });
  } else {
    logger.info('Migraciones completadas', {
      nuevas: newCount,
      total: all.length,
    });
  }
}

if (require.main === module) {
  try {
    migrate();
    process.exit(0);
  } catch (err) {
    logger.error('Error en migración', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

module.exports = { migrate };
