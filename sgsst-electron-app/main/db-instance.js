// =====================================================================
// 📦 Singleton de la conexión SQLite
// Permite que módulos en main/ (email-db, gestacion-bridge, etc.)
// compartan la misma instancia de Database sin tener que pasarla
// como parámetro a cada función.
//
// Patrón: main.js llama setDb(db) en initDbOnce() y los demás módulos
// hacen require('./db-instance') y obtienen la misma referencia.
// =====================================================================

let _db = null;

function setDb(dbInstance) {
  _db = dbInstance;
}

function getDb() {
  return _db;
}

module.exports = { setDb, getDb };
