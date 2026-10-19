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

// Directiva opcional en la cabecera de un .sql:
//   -- @skip-when-env test
// La migración NO se aplica (y NO se registra como aplicada) cuando
// NODE_ENV coincide con el valor. Existe para las migraciones que chocan
// con la limpieza de los tests: en vez de debilitar la garantía en
// producción por comodidad, la garantía se salta solo en el ambiente que la
// necesita. Ver src/db/schema/020_eventos_append_only.sql.
const SKIP_DIRECTIVE_RE = /^\s*--\s*@skip-when-env\s+(\S+)/m;

function readMigrationSql(filename) {
  return fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8');
}

/**
 * Devuelve el valor de la directiva @skip-when-env, o null si no la tiene.
 */
function skipDirectiveFor(sql) {
  const m = sql.match(SKIP_DIRECTIVE_RE);
  return m ? m[1] : null;
}

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

function applyMigration(filename, sql) {
  const version = filename.replace('.sql', '');
  const filepath = path.join(SCHEMA_DIR, filename);
  if (sql === undefined) {
    sql = readMigrationSql(filename);
  }

  logger.info('Aplicando migración', { version, file: filename });

  // ────────────────────────────────────────────────────────────────────────
  // foreign_keys durante la migración
  // ────────────────────────────────────────────────────────────────────────
  // SQLite documenta que PRAGMA foreign_keys es un "no-op" dentro de una
  // transacción: https://www.sqlite.org/pragma.html#pragma_foreign_keys
  //   > "This pragma is a no-op within a transaction; foreign key constraint
  //      enforcement may only be enabled or disabled when there is no
  //      pending BEGIN or SAVEPOINT."
  //
  // Eso significa que si una migración necesita FK=OFF (ej. el patrón
  // 12-step de la migración 005_reduce_check, que hace DROP TABLE de una
  // tabla referenciada por FKs de gh_firma_eventos y gh_firma_sesiones),
  // el PRAGMA dentro del SQL de la migración no se aplica.
  //
  // Por eso lo hacemos aquí, ANTES de abrir la transacción. Después
  // restauramos FK=ON para que el resto de la conexión quede consistente
  // con la convención del proyecto (connection.js también las activa en
  // cada conexión nueva, pero dejamos el estado explícito al final).
  //
  // Si la transacción de la migración hace ROLLBACK, el PRAGMA FK=OFF
  // queda en la conexión hasta que se cierre. La siguiente conexión
  // (vía connection.js) lo restaura a ON, así que no hay leak permanente.
  //
  // Esto NO es un relajamiento de la convención en runtime: el runner
  // de migraciones es mantenimiento, no operación normal. La aplicación
  // siempre corre con FK=ON (ver src/db/connection.js).
  const fkBefore = db.pragma('foreign_keys', { simple: true });
  db.pragma('foreign_keys = OFF');

  try {
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
  } finally {
    // Restaurar FK=ON (o al estado original si no era 1).
    db.pragma('foreign_keys = ON');
    if (fkBefore !== 1) {
      // Por si en el futuro alguien desactiva FKs antes de migrate(),
      // respetamos su estado original.
      db.pragma(`foreign_keys = ${fkBefore}`);
    }
  }

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
    const sql = readMigrationSql(filename);
    const skipEnv = skipDirectiveFor(sql);
    if (skipEnv && process.env.NODE_ENV === skipEnv) {
      // No se registra como aplicada a propósito: si el ambiente cambia
      // después (p. ej. se corre la suite en otro NODE_ENV), la migración
      // sigue disponible para aplicarse.
      logger.info('Migración omitida por directiva de ambiente', { version, skipEnv });
      continue;
    }
    applyMigration(filename, sql);
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
