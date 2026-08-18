/**
 * Conexión a SQLite (better-sqlite3).
 *
 * - Habilita WAL para mejor concurrencia.
 * - Activa foreign keys (no activo por defecto en SQLite).
 * - Expone un singleton `db` para usar en toda la app.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('../config');
const logger = require('../utils/logger');

// Asegurar que el directorio existe
const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.db.path);

// Configurar SQLite
db.pragma('journal_mode = WAL');      // mejor concurrencia
db.pragma('foreign_keys = ON');        // activar FK
db.pragma('synchronous = NORMAL');     // buen balance rendimiento/seguridad
db.pragma('busy_timeout = 5000');      // 5s de espera si está ocupado

logger.info('BD inicializada', {
  path: config.db.path,
  wal: db.pragma('journal_mode', { simple: true }),
  foreignKeys: db.pragma('foreign_keys', { simple: true }),
});

module.exports = db;
