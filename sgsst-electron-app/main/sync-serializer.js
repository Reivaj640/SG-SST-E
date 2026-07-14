/**
 * main/sync-serializer.js
 *
 * Serializer/Deserializer para el sync multipc de K+AIR (📦536).
 * Convierte los datos sincronizables de una empresa entre la BD local
 * (SQLite) y un archivo .kairsync (JSON) con last-write-wins por registro.
 *
 * Tablas sincronizables (lo que SI va al hub):
 *   - evaluacion_action_plans   (planes de acción 2.3.1, incluye seguimientos+responsables)
 *   - gestaciones + seguimiento_gestacion_mensual   (📦466, Salud Materna)
 *   - eventos_cumplidos
 *   - eventos_rapidos
 *   - ausentismo                 (vía IPC de medición ausentismo — ver 📦538)
 *
 * Tablas NO sincronizables (quedan locales por PC):
 *   - users, roles, companies, user_company_roles, sessions
 *   - config (config.json vive local)
 *   - cualquier tabla de OTRAS empresas (filtro por empresa_id)
 *
 * Diseño:
 *   - El JSON se construye como un snapshot completo de la empresa, NO diffs.
 *     Empresa típica < 1MB, aceptable para sync frecuente.
 *   - Cada registro lleva su propio `updatedAt` (ISO 8601). El merge compara
 *     updatedAt remoto vs local para decidir quién gana (last-write-wins).
 *   - Si el archivo remoto está corrupto, el puller lo mueve a .bak y sigue.
 *   - Si la versión del .kairsync no coincide, se rechaza con error claro.
 *   - Las funciones de tabla que no existan aún (ej: la app nunca entró a
 *     gestaciones) devuelven array vacío silenciosamente, no rompen.
 *
 * Este módulo NO se conecta a Electron ni abre archivos del hub por su cuenta.
 * Solo exporta funciones puras de transformacion BD <-> JSON. La lectura/
 * escritura del archivo .kairsync la hace el SyncService (📦537).
 */
'use strict';

const fsp = require('fs').promises;
const path = require('path');

const SYNC_VERSION = 1;
const MOD = 'SYNC-SERIALIZER';

// =====================================================================
// SERIALIZE: BD local -> JSON para subir al hub
// =====================================================================

/**
 * Genera el JSON consolidado de una empresa para subir al hub.
 * Lee TODOS los registros sincronizables de las tablas filtradas por
 * empresaId, los empaca en la estructura definida en §5.1 del spec.
 *
 * @param {object} db - better-sqlite3 db handle
 * @param {string} companyKey - Identificador único de la empresa (= currentCompany)
 * @param {string} pcId - ID de la PC que está escribiendo
 * @param {string} userName - Nombre del usuario actual
 * @param {string} appVersion - Versión de la app (ej: '0.1.114')
 * @returns {object} Objeto JSON listo para serializar con JSON.stringify
 */
function serializeEmpresaToSync(db, companyKey, pcId, userName, appVersion) {
  if (!db) throw new Error('[' + MOD + '] db requerido');
  if (!companyKey) throw new Error('[' + MOD + '] companyKey requerido');

  var now = new Date().toISOString();

  return {
    version: SYNC_VERSION,
    companyKey: companyKey,
    lastWriteAt: now,
    lastWriter: {
      pcId: pcId || 'unknown',
      userName: userName || 'unknown',
      appVersion: appVersion || '0.0.0'
    },
    entities: {
      planes_accion: _serializePlanesAccion(db, companyKey),
      gestaciones: _serializeGestaciones(db, companyKey),
      eventos_cumplidos: _serializeEventosCumplidos(db, companyKey),
      eventos_rapidos: _serializeEventosRapidos(db, companyKey)
      // ausentismo: lo agregamos en 📦538 cuando veamos la estructura
      // real del bridge de medición ausentismo
    }
  };
}

function _serializePlanesAccion(db, companyKey) {
  try {
    var rows = db.prepare(
      'SELECT id, year, source, plan_json, updated_at FROM evaluacion_action_plans ' +
      'WHERE empresa_id = ? ORDER BY updated_at DESC'
    ).all(companyKey);

    return rows.map(function (row) {
      var plan;
      try {
        plan = JSON.parse(row.plan_json);
      } catch (e) {
        console.error('[' + MOD + '] Plan con JSON invalido (id=' + row.id + '): ' + e.message);
        return null;
      }
      return {
        id: row.id,
        year: row.year || '',
        source: row.source,
        plan: plan,
        updatedAt: row.updated_at
      };
    }).filter(function (p) { return p !== null; });
  } catch (e) {
    console.error('[' + MOD + '] Error serializando planes_accion:', e.message);
    return [];
  }
}

function _serializeGestaciones(db, companyKey) {
  try {
    // Verificar si la tabla existe antes de consultar (puede que la app
    // nunca haya entrado al módulo de gestación)
    var tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='gestaciones'"
    ).get();
    if (!tableExists) return [];

    var rows = db.prepare(
      'SELECT * FROM gestaciones WHERE empresa_id = ? ORDER BY updated_at DESC'
    ).all(companyKey);

    var result = [];
    for (var i = 0; i < rows.length; i++) {
      var g = rows[i];
      var seguimientos = [];
      try {
        seguimientos = db.prepare(
          'SELECT * FROM seguimiento_gestacion_mensual WHERE gestacion_id = ? ORDER BY fecha ASC'
        ).all(g.id);
      } catch (e) {
        // Si la tabla de seguimientos no existe, seguir con array vacio
        console.warn('[' + MOD + '] No se pudieron cargar seguimientos de gestacion ' + g.id + ': ' + e.message);
      }
      result.push({
        id: g.id,
        gestante: g,
        seguimientos: seguimientos,
        updatedAt: g.updated_at || new Date().toISOString()
      });
    }
    return result;
  } catch (e) {
    console.error('[' + MOD + '] Error serializando gestaciones:', e.message);
    return [];
  }
}

function _serializeEventosCumplidos(db, companyKey) {
  try {
    var tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='eventos_cumplidos'"
    ).get();
    if (!tableExists) return [];

    var rows = db.prepare(
      'SELECT * FROM eventos_cumplidos WHERE empresa_id = ? ORDER BY updated_at DESC'
    ).all(companyKey);

    return rows.map(function (r) {
      return {
        id: r.id,
        evento: r,
        updatedAt: r.updated_at || new Date().toISOString()
      };
    });
  } catch (e) {
    console.error('[' + MOD + '] Error serializando eventos_cumplidos:', e.message);
    return [];
  }
}

function _serializeEventosRapidos(db, companyKey) {
  try {
    var tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='eventos_rapidos'"
    ).get();
    if (!tableExists) return [];

    var rows = db.prepare(
      'SELECT * FROM eventos_rapidos WHERE empresa_id = ? ORDER BY updated_at DESC'
    ).all(companyKey);

    return rows.map(function (r) {
      return {
        id: r.id,
        evento: r,
        updatedAt: r.updated_at || new Date().toISOString()
      };
    });
  } catch (e) {
    console.error('[' + MOD + '] Error serializando eventos_rapidos:', e.message);
    return [];
  }
}

// =====================================================================
// DESERIALIZE: JSON del hub -> BD local con last-write-wins por registro
// =====================================================================

/**
 * Aplica un JSON remoto a la BD local con last-write-wins por registro.
 * Por cada registro remoto, compara updatedAt con el local (busca por id):
 *   - Si no existe local -> INSERT
 *   - Si remoto mas nuevo -> UPDATE local con el remoto
 *   - Si local mas nuevo o igual -> SKIP (mantener local)
 *
 * @param {object} db - better-sqlite3 db handle
 * @param {object} syncData - JSON parseado del archivo .kairsync
 * @param {object} [options] - { conflictLog: function(localRec, remoteRec) }
 * @returns {object} { applied: N, conflicts: M, skipped: K, byEntity: {...} }
 */
function deserializeSyncToDb(db, syncData, options) {
  if (!db) throw new Error('[' + MOD + '] db requerido');
  if (!syncData || typeof syncData !== 'object') {
    throw new Error('[' + MOD + '] syncData debe ser objeto JSON parseado');
  }
  if (syncData.version !== SYNC_VERSION) {
    throw new Error(
      '[' + MOD + '] version del .kairsync (' + syncData.version +
      ') no coincide con la esperada (' + SYNC_VERSION + ')'
    );
  }

  options = options || {};
  var conflictLog = options.conflictLog || function () {};

  var result = {
    applied: 0,
    conflicts: 0,
    skipped: 0,
    byEntity: {
      planes_accion: { applied: 0, conflicts: 0, skipped: 0 },
      gestaciones: { applied: 0, conflicts: 0, skipped: 0 },
      eventos_cumplidos: { applied: 0, conflicts: 0, skipped: 0 },
      eventos_rapidos: { applied: 0, conflicts: 0, skipped: 0 }
    }
  };

  var entities = syncData.entities || {};
  if (entities.planes_accion) {
    _deserializePlanesAccion(db, entities.planes_accion, syncData.companyKey, result, conflictLog);
  }
  if (entities.gestaciones) {
    _deserializeGestaciones(db, entities.gestaciones, syncData.companyKey, result, conflictLog);
  }
  if (entities.eventos_cumplidos) {
    _deserializeEventosCumplidos(db, entities.eventos_cumplidos, syncData.companyKey, result, conflictLog);
  }
  if (entities.eventos_rapidos) {
    _deserializeEventosRapidos(db, entities.eventos_rapidos, syncData.companyKey, result, conflictLog);
  }

  return result;
}

function _deserializePlanesAccion(db, remoteRecords, companyKey, result, conflictLog) {
  var counter = result.byEntity.planes_accion;
  for (var i = 0; i < remoteRecords.length; i++) {
    var remote = remoteRecords[i];
    if (!remote.id || !remote.updatedAt) {
      counter.skipped++;
      result.skipped++;
      continue;
    }

    var local = db.prepare(
      'SELECT id, plan_json, updated_at FROM evaluacion_action_plans WHERE id = ? AND empresa_id = ?'
    ).get(remote.id, companyKey);

    if (!local) {
      // No existe local -> INSERT
      try {
        db.prepare(
          'INSERT INTO evaluacion_action_plans (id, empresa_id, year, source, plan_json, updated_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?)'
        ).run(
          remote.id,
          companyKey,
          remote.year || '',
          remote.source || 'manual',
          JSON.stringify(remote.plan),
          remote.updatedAt
        );
        counter.applied++;
        result.applied++;
      } catch (e) {
        console.error('[' + MOD + '] Error insertando plan ' + remote.id + ': ' + e.message);
        counter.skipped++;
        result.skipped++;
      }
    } else if (remote.updatedAt > local.updated_at) {
      // Remoto es mas nuevo -> UPDATE
      try {
        db.prepare(
          'UPDATE evaluacion_action_plans ' +
          'SET plan_json = ?, source = ?, year = ?, updated_at = ? ' +
          'WHERE id = ? AND empresa_id = ?'
        ).run(
          JSON.stringify(remote.plan),
          remote.source || 'manual',
          remote.year || '',
          remote.updatedAt,
          remote.id,
          companyKey
        );
        counter.applied++;
        counter.conflicts++;
        result.applied++;
        result.conflicts++;
        conflictLog(
          { id: remote.id, updatedAt: local.updated_at },
          { id: remote.id, updatedAt: remote.updatedAt }
        );
      } catch (e) {
        console.error('[' + MOD + '] Error actualizando plan ' + remote.id + ': ' + e.message);
        counter.skipped++;
        result.skipped++;
      }
    } else {
      // Local mas nuevo o igual -> SKIP
      counter.skipped++;
      result.skipped++;
    }
  }
}

function _deserializeGestaciones(db, remoteRecords, companyKey, result, conflictLog) {
  // Verificar que la tabla existe antes de intentar escribir
  var tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='gestaciones'"
  ).get();
  if (!tableExists) {
    console.warn('[' + MOD + '] Tabla gestaciones no existe, saltando merge');
    return;
  }

  var counter = result.byEntity.gestaciones;
  for (var i = 0; i < remoteRecords.length; i++) {
    var remote = remoteRecords[i];
    if (!remote.id || !remote.updatedAt || !remote.gestante) {
      counter.skipped++;
      result.skipped++;
      continue;
    }

    // TODO 📦537/538: implementar merge completo de gestaciones +
    // seguimiento_gestacion_mensual cuando veamos la estructura exacta.
    // Por ahora dejamos skip explicito para que el sync no rompa si
    // la app del cliente ya tiene gestaciones y la del admin no.
    counter.skipped++;
    result.skipped++;
  }
}

function _deserializeEventosCumplidos(db, remoteRecords, companyKey, result, conflictLog) {
  var tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='eventos_cumplidos'"
  ).get();
  if (!tableExists) {
    console.warn('[' + MOD + '] Tabla eventos_cumplidos no existe, saltando merge');
    return;
  }

  var counter = result.byEntity.eventos_cumplidos;
  for (var i = 0; i < remoteRecords.length; i++) {
    var remote = remoteRecords[i];
    if (!remote.id || !remote.updatedAt) {
      counter.skipped++;
      result.skipped++;
      continue;
    }

    var local = db.prepare(
      'SELECT id, updated_at FROM eventos_cumplidos WHERE id = ? AND empresa_id = ?'
    ).get(remote.id, companyKey);

    if (!local) {
      // INSERT basico: insertamos solo lo que conocemos del esquema
      // comun. Si el esquema local tiene columnas extra, quedan NULL
      // (mejor que nada - el usuario los vera vacios y los podra editar).
      try {
        var evento = remote.evento || {};
        db.prepare(
          'INSERT OR IGNORE INTO eventos_cumplidos (id, empresa_id, updated_at) VALUES (?, ?, ?)'
        ).run(remote.id, companyKey, remote.updatedAt);
        counter.applied++;
        result.applied++;
      } catch (e) {
        console.error('[' + MOD + '] Error insertando evento_cumplido ' + remote.id + ': ' + e.message);
        counter.skipped++;
        result.skipped++;
      }
    } else if (remote.updatedAt > local.updated_at) {
      // UPDATE timestamp; el bridge especifico se encargara del contenido
      try {
        db.prepare(
          'UPDATE eventos_cumplidos SET updated_at = ? WHERE id = ? AND empresa_id = ?'
        ).run(remote.updatedAt, remote.id, companyKey);
        counter.applied++;
        counter.conflicts++;
        result.applied++;
        result.conflicts++;
      } catch (e) {
        console.error('[' + MOD + '] Error actualizando evento_cumplido ' + remote.id + ': ' + e.message);
        counter.skipped++;
        result.skipped++;
      }
    } else {
      counter.skipped++;
      result.skipped++;
    }
  }
}

function _deserializeEventosRapidos(db, remoteRecords, companyKey, result, conflictLog) {
  // Estructura similar a eventos_cumplidos, se completa en 📦537
  // cuando veamos la estructura exacta de la tabla.
  var counter = result.byEntity.eventos_rapidos;
  for (var i = 0; i < remoteRecords.length; i++) {
    counter.skipped++;
    result.skipped++;
  }
}

// =====================================================================
// I/O helpers: leer/escribir el archivo .kairsync en disco
// =====================================================================

/**
 * Escribe el JSON a <hubPath>/empresa.kairsync.
 * Crea la carpeta si no existe.
 */
async function writeSyncFile(hubPath, syncData) {
  if (!hubPath) throw new Error('[' + MOD + '] hubPath requerido');
  if (!syncData) throw new Error('[' + MOD + '] syncData requerido');

  // Crear carpeta del hub si no existe
  try {
    await fsp.mkdir(hubPath, { recursive: true });
  } catch (e) {
    throw new Error('[' + MOD + '] No se pudo crear hubPath ' + hubPath + ': ' + e.message);
  }

  var filePath = path.join(hubPath, 'empresa.kairsync');
  var json = JSON.stringify(syncData, null, 2);
  await fsp.writeFile(filePath, json, 'utf8');
  return filePath;
}

/**
 * Lee <hubPath>/empresa.kairsync.
 * Devuelve null si no existe (normal en primer arranque).
 * Devuelve null si está corrupto (mover a .bak lo hace el SyncService 📦537).
 */
async function readSyncFile(hubPath) {
  if (!hubPath) throw new Error('[' + MOD + '] hubPath requerido');

  var filePath = path.join(hubPath, 'empresa.kairsync');
  try {
    var content = await fsp.readFile(filePath, 'utf8');
    var data = JSON.parse(content);
    return data;
  } catch (e) {
    if (e.code === 'ENOENT') {
      return null; // No existe, normal en primer arranque
    }
    console.error('[' + MOD + '] Error leyendo ' + filePath + ': ' + e.message);
    return null;
  }
}

/**
 * Detecta archivos "Conflicto de copia" de Google Drive en el hub path.
 * Google Drive genera archivos tipo "empresa (Conflicto de copia 2026-07-13 18-45-23).kairsync"
 * cuando 2 PCs escriben casi simultaneamente.
 *
 * @param {string} hubPath
 * @returns {Array<{conflictPath: string, mainPath: string}>}
 */
async function detectConflictFiles(hubPath) {
  if (!hubPath) throw new Error('[' + MOD + '] hubPath requerido');

  var conflicts = [];
  try {
    var files = await fsp.readdir(hubPath);
    for (var i = 0; i < files.length; i++) {
      var name = files[i];
      if (name.indexOf('Conflicto de copia') !== -1 && name.endsWith('.kairsync')) {
        // Extraer el nombre base (lo que esta antes del " (Conflicto...")
        var baseMatch = name.match(/^(.+?)\s+\(Conflicto de copia[^)]*\)\.kairsync$/);
        if (baseMatch) {
          conflicts.push({
            conflictPath: path.join(hubPath, name),
            mainPath: path.join(hubPath, baseMatch[1] + '.kairsync')
          });
        }
      }
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error('[' + MOD + '] Error detectando conflictos en ' + hubPath + ': ' + e.message);
    }
  }
  return conflicts;
}

// =====================================================================
// Exports
// =====================================================================

module.exports = {
  // Funciones principales
  serializeEmpresaToSync: serializeEmpresaToSync,
  deserializeSyncToDb: deserializeSyncToDb,

  // Helpers de I/O
  writeSyncFile: writeSyncFile,
  readSyncFile: readSyncFile,
  detectConflictFiles: detectConflictFiles,

  // Constantes
  SYNC_VERSION: SYNC_VERSION
};
