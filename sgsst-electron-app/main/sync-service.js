/**
 * main/sync-service.js
 *
 * Orquestador del sync multipc de K+AIR (📦537).
 *
 * Responsabilidades:
 *   - Pull: leer el .kairsync del hub, manejar conflictos de Google Drive,
 *     aplicar a la BD local con last-write-wins.
 *   - Push: serializar la BD local a JSON, hacer backup del archivo previo,
 *     escribir al hub.
 *   - Auto-sync: timer por empresa que dispara pull cada N minutos.
 *   - Debounced push: para evitar spamear Drive cuando hay varias mutaciones
 *     en pocos segundos.
 *   - Estado: tracking de lastPull, lastPush, lastError por empresa.
 *
 * NO registra handlers IPC — eso lo hace sync-bridge.js.
 * NO se conecta a Electron directamente — recibe `app` por inyección.
 *
 * El sync NO se inicia solo al requerir este módulo. Hay que llamar a
 * `init(app, deps)` desde main.js. Despues, `startAutoSync(companyKey)`
 * por cada empresa que tenga sync.enabled=true.
 */
'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const serializer = require('./sync-serializer.js');

const MOD = 'SYNC-SERVICE';

const DEFAULT_INTERVAL_MINUTES = 5;
const PUSH_DEBOUNCE_MS = 2000;
const MAX_BACKUPS = 5;

// ---------- Estado inyectado ----------
let _app = null;
let _getDb = null;
let _configPath = null;

// ---------- Estado interno ----------
// companyKey -> { lastPull, lastPush, lastError, lastErrorAt }
var _lastSync = new Map();
// companyKey -> NodeJS.Timeout (intervalId)
var _timers = new Map();
// companyKey -> NodeJS.Timeout (debounced push)
var _pendingPushes = new Map();

// =====================================================================
// Init
// =====================================================================

/**
 * Inicializa el SyncService. Llamar UNA vez desde main.js al arrancar la app.
 * @param {Electron.App} app
 * @param {object} deps - { getDb: function() }
 */
function init(app, deps) {
  if (!app) throw new Error('[' + MOD + '] app requerido');
  if (!deps || typeof deps.getDb !== 'function') {
    throw new Error('[' + MOD + '] deps.getDb (funcion) requerido');
  }
  _app = app;
  _getDb = deps.getDb;
  _configPath = path.join(_app.getPath('userData'), 'config.json');
  console.log('[' + MOD + '] Inicializado. configPath=' + _configPath);
}

// =====================================================================
// Public API
// =====================================================================

/**
 * Devuelve el estado actual del sync para una empresa.
 * Usado por el bridge IPC y la UI de Configuracion.
 */
function getStatus(companyKey) {
  if (!companyKey) {
    return { enabled: false, reason: 'no_company' };
  }
  var cfg = _getCompanySyncConfig(companyKey);
  if (!cfg) {
    return { enabled: false, reason: 'company_not_in_config' };
  }
  if (!cfg.enabled) {
    return { enabled: false, reason: 'disabled_in_config', companyKey: companyKey };
  }
  var last = _lastSync.get(companyKey) || {};
  return {
    enabled: true,
    companyKey: companyKey,
    pcId: cfg.pcId || _getGlobalPcId() || 'unknown',
    userName: cfg.userName,
    hubPath: cfg.hubPath,
    intervalMinutes: cfg.intervalMinutes || DEFAULT_INTERVAL_MINUTES,
    autoSync: !!cfg.autoSync,
    lastPull: last.lastPull || null,
    lastPush: last.lastPush || null,
    lastError: last.lastError || null,
    lastErrorAt: last.lastErrorAt || null
  };
}

/**
 * Pull: descarga el .kairsync del hub y lo aplica a la BD local.
 *
 * Flujo:
 *   1. Lee config de la empresa (si no esta habilitada, skip).
 *   2. Verifica que el hub path existe (si no, no hace nada - es normal
 *      en primer arranque).
 *   3. Detecta archivos "Conflicto de copia" de Google Drive.
 *   4. Lee empresa.kairsync del hub. Si no existe, OK (primer arranque).
 *   5. Si hay conflictos, los mergea con el archivo principal.
 *   6. Aplica el JSON a la BD local con last-write-wins.
 *   7. Borra archivos de conflicto ya mergeados.
 *   8. Actualiza lastPull y retorna resultado.
 */
async function pull(companyKey, options) {
  options = options || {};
  var startedAt = new Date().toISOString();

  try {
    if (!_getDb) throw new Error('[' + MOD + '] SyncService no inicializado. Llamar init() primero.');
    if (!companyKey) throw new Error('[' + MOD + '] companyKey requerido');

    var cfg = _getCompanySyncConfig(companyKey);
    if (!cfg || !cfg.enabled) {
      return { success: false, reason: 'disabled', companyKey: companyKey };
    }

    // Verificar que el hub path existe
    if (!_hubPathExists(cfg.hubPath)) {
      _setLast(companyKey, 'pull', null, 'Hub path no existe: ' + cfg.hubPath);
      return {
        success: true,
        companyKey: companyKey,
        applied: 0,
        conflicts: 0,
        skipped: 0,
        reason: 'hub_not_found',
        message: 'Hub path no existe aun. Se creara en el primer push.'
      };
    }

    // Detectar conflictos de Google Drive primero
    var conflicts = await serializer.detectConflictFiles(cfg.hubPath);
    if (conflicts.length > 0) {
      console.log('[' + MOD + '] Detectados ' + conflicts.length + ' archivos de conflicto en el hub');
      await _mergeConflictFiles(cfg.hubPath, conflicts);
    }

    // Leer el .kairsync del hub
    var syncData = await serializer.readSyncFile(cfg.hubPath);
    if (!syncData) {
      _setLast(companyKey, 'pull', startedAt, 'Archivo .kairsync no existe en el hub (primer arranque)');
      return {
        success: true,
        companyKey: companyKey,
        applied: 0,
        conflicts: 0,
        skipped: 0,
        reason: 'no_sync_file_yet',
        message: 'Aun no hay archivo .kairsync en el hub. Normal en primer arranque.'
      };
    }

    // Aplicar a la BD local
    var db = _getDb();
    var mergeResult = serializer.deserializeSyncToDb(db, syncData, {
      conflictLog: function (local, remote) {
        console.log('[' + MOD + '] Conflicto resuelto: ' + local.id +
                    ' (local=' + local.updatedAt + ' -> remoto=' + remote.updatedAt + ')');
      }
    });

    // Limpiar archivos de conflicto ya mergeados
    if (conflicts.length > 0) {
      await _cleanupConflictFiles(conflicts);
    }

    _setLast(companyKey, 'pull', startedAt, null);
    console.log('[' + MOD + '] Pull OK para ' + companyKey +
                ' (applied=' + mergeResult.applied +
                ', conflicts=' + mergeResult.conflicts +
                ', skipped=' + mergeResult.skipped + ')');

    return {
      success: true,
      companyKey: companyKey,
      applied: mergeResult.applied,
      conflicts: mergeResult.conflicts,
      skipped: mergeResult.skipped,
      byEntity: mergeResult.byEntity,
      detectedConflicts: conflicts.length,
      completedAt: new Date().toISOString()
    };
  } catch (e) {
    _setLast(companyKey, 'pull', startedAt, e.message);
    console.error('[' + MOD + '][PULL] Error en pull de ' + companyKey + ': ' + e.message);
    return {
      success: false,
      companyKey: companyKey,
      error: { code: 'PULL_FAILED', message: e.message },
      completedAt: new Date().toISOString()
    };
  }
}

/**
 * Push: serializa la BD local y la sube al hub.
 *
 * Flujo:
 *   1. Lee config de la empresa (si no esta habilitada, skip).
 *   2. Serializa la BD local a JSON.
 *   3. Lee el JSON actual del hub (si existe) para hacer merge local-vs-remoto
 *      con last-write-wins por registro (asi no perdemos cambios del otro PC).
 *   4. Hace backup del archivo previo como .kairsync.bak.{timestamp}.
 *   5. Escribe el nuevo JSON al hub.
 *   6. Limpia backups viejos (mantener solo los ultimos MAX_BACKUPS).
 *   7. Actualiza lastPush y retorna resultado.
 */
async function push(companyKey, options) {
  options = options || {};
  var startedAt = new Date().toISOString();

  try {
    if (!_getDb) throw new Error('[' + MOD + '] SyncService no inicializado. Llamar init() primero.');
    if (!companyKey) throw new Error('[' + MOD + '] companyKey requerido');

    var cfg = _getCompanySyncConfig(companyKey);
    if (!cfg || !cfg.enabled) {
      return { success: false, reason: 'disabled', companyKey: companyKey };
    }

    var db = _getDb();
    var appVersion = _getAppVersion();
    var pcId = cfg.pcId || _getGlobalPcId() || 'unknown';
    var userName = cfg.userName || 'unknown';

    // 1. Serializar la BD local
    var syncData = serializer.serializeEmpresaToSync(db, companyKey, pcId, userName, appVersion);

    // 2. Detectar conflictos de GDrive en el hub (pueden aparecer entre
    //    el momento del pull y el push)
    var conflicts = await serializer.detectConflictFiles(cfg.hubPath);
    if (conflicts.length > 0) {
      console.log('[' + MOD + '] Detectados ' + conflicts.length + ' conflictos antes de push, mergeando...');
      await _mergeConflictFiles(cfg.hubPath, conflicts);
    }

    // 3. Hacer backup del archivo previo si existe
    var hubFile = path.join(cfg.hubPath, 'empresa.kairsync');
    try {
      await fsp.access(hubFile, fs.constants.F_OK);
      // Existe, hacer backup
      var bakName = 'empresa.kairsync.bak.' + startedAt.replace(/[:.]/g, '-');
      var bakPath = path.join(cfg.hubPath, bakName);
      await fsp.copyFile(hubFile, bakPath);
      console.log('[' + MOD + '] Backup previo: ' + bakName);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn('[' + MOD + '] No se pudo hacer backup: ' + e.message);
      }
      // No existe el archivo previo, primer push, OK
    }

    // 4. Escribir el nuevo JSON al hub
    var writtenPath = await serializer.writeSyncFile(cfg.hubPath, syncData);
    console.log('[' + MOD + '] Push OK para ' + companyKey + ' -> ' + writtenPath);

    // 5. Limpiar backups viejos (mantener solo los ultimos MAX_BACKUPS)
    await _cleanupOldBackups(cfg.hubPath);

    // 6. Limpiar conflictos ya mergeados
    if (conflicts.length > 0) {
      await _cleanupConflictFiles(conflicts);
    }

    _setLast(companyKey, 'push', startedAt, null);

    return {
      success: true,
      companyKey: companyKey,
      path: writtenPath,
      entities: {
        planes: syncData.entities.planes_accion.length,
        gestaciones: syncData.entities.gestaciones.length,
        eventosCumplidos: syncData.entities.eventos_cumplidos.length,
        eventosRapidos: syncData.entities.eventos_rapidos.length
      },
      completedAt: new Date().toISOString()
    };
  } catch (e) {
    _setLast(companyKey, 'push', startedAt, e.message);
    console.error('[' + MOD + '][PUSH] Error en push de ' + companyKey + ': ' + e.message);
    return {
      success: false,
      companyKey: companyKey,
      error: { code: 'PUSH_FAILED', message: e.message },
      completedAt: new Date().toISOString()
    };
  }
}

/**
 * Push con debounce: si hay varios cambios rapidos, solo se hace un push
 * despues de PUSH_DEBOUNCE_MS de inactividad. Pensado para llamarse desde
 * los bridges existentes (despues de _persistActionPlan, etc.).
 */
function debouncedPush(companyKey) {
  if (!companyKey) return;
  var cfg = _getCompanySyncConfig(companyKey);
  if (!cfg || !cfg.enabled) return; // sync deshabilitado, ignorar

  // Cancelar timer anterior
  if (_pendingPushes.has(companyKey)) {
    clearTimeout(_pendingPushes.get(companyKey));
  }

  // Programar nuevo push
  var t = setTimeout(function () {
    _pendingPushes.delete(companyKey);
    push(companyKey).catch(function (e) {
      console.error('[' + MOD + '] debouncedPush error para ' + companyKey + ': ' + e.message);
    });
  }, PUSH_DEBOUNCE_MS);

  _pendingPushes.set(companyKey, t);
}

/**
 * Inicia el auto-sync (timer periodico) para una empresa.
 * Si ya hay un timer, lo reemplaza con la nueva config.
 */
function startAutoSync(companyKey) {
  if (!companyKey) return;
  var cfg = _getCompanySyncConfig(companyKey);
  if (!cfg || !cfg.enabled) {
    console.log('[' + MOD + '] startAutoSync(' + companyKey + ') skip: sync deshabilitado');
    return;
  }
  if (cfg.autoSync === false) {
    console.log('[' + MOD + '] startAutoSync(' + companyKey + ') skip: autoSync=false en config');
    return;
  }

  // Detener timer anterior si existe
  stopAutoSync(companyKey);

  var intervalMs = (cfg.intervalMinutes || DEFAULT_INTERVAL_MINUTES) * 60 * 1000;
  var t = setInterval(function () {
    pull(companyKey).catch(function (e) {
      console.error('[' + MOD + '] auto-pull error para ' + companyKey + ': ' + e.message);
    });
  }, intervalMs);

  _timers.set(companyKey, t);
  console.log('[' + MOD + '] Auto-sync iniciado para ' + companyKey +
              ' (cada ' + (cfg.intervalMinutes || DEFAULT_INTERVAL_MINUTES) + ' min)');
}

/**
 * Detiene el auto-sync para una empresa.
 */
function stopAutoSync(companyKey) {
  if (!companyKey) return;
  var t = _timers.get(companyKey);
  if (t) {
    clearInterval(t);
    _timers.delete(companyKey);
    console.log('[' + MOD + '] Auto-sync detenido para ' + companyKey);
  }
}

/**
 * Detiene TODOS los timers. Llamar al cerrar la app.
 */
function stopAllAutoSync() {
  _timers.forEach(function (t, key) {
    clearInterval(t);
    console.log('[' + MOD + '] Auto-sync detenido para ' + key);
  });
  _timers.clear();

  _pendingPushes.forEach(function (t, key) {
    clearTimeout(t);
  });
  _pendingPushes.clear();
}

/**
 * Helper: arranca auto-sync para TODAS las empresas con sync.enabled=true.
 * Pensado para llamar desde main.js al iniciar la app.
 */
function startAutoSyncForAllEnabled() {
  var companies = _getAllCompanies();
  for (var i = 0; i < companies.length; i++) {
    var c = companies[i];
    if (c.sync && c.sync.enabled) {
      startAutoSync(c.key);
    }
  }
}

// =====================================================================
// Helpers privados
// =====================================================================

function _getCompanySyncConfig(companyKey) {
  if (!_configPath) return null;
  var config;
  try {
    var raw = fs.readFileSync(_configPath, 'utf8');
    config = JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    console.error('[' + MOD + '] Error leyendo config: ' + e.message);
    return null;
  }

  var companies = (config && config.companies) || [];
  for (var i = 0; i < companies.length; i++) {
    var c = companies[i];
    if (c.key === companyKey && c.sync) {
      // Retornar el sync object INCLUSO si enabled=false,
      // para que getStatus pueda distinguir "no existe" vs "deshabilitado"
      return c.sync;
    }
  }
  return null;
}

function _getAllCompanies() {
  if (!_configPath) return [];
  try {
    var raw = fs.readFileSync(_configPath, 'utf8');
    var config = JSON.parse(raw);
    return (config && config.companies) || [];
  } catch (e) {
    return [];
  }
}

function _getAppVersion() {
  try {
    var pkg = require(path.join(_app.getAppPath(), 'package.json'));
    return pkg.version || '0.0.0';
  } catch (e) {
    return '0.0.0';
  }
}

/**
 * Lee el pcId del nivel raiz de config.json (config.sync.pcId).
 * Es el pcId de la PC (no por empresa). Util como fallback cuando
 * una empresa especifica no tiene pcId propio en su config.
 */
function _getGlobalPcId() {
  if (!_configPath) return null;
  try {
    var raw = fs.readFileSync(_configPath, 'utf8');
    var config = JSON.parse(raw);
    return (config && config.sync && config.sync.pcId) || null;
  } catch (e) {
    return null;
  }
}

function _hubPathExists(hubPath) {
  if (!hubPath) return false;
  try {
    var stat = fs.statSync(hubPath);
    return stat.isDirectory();
  } catch (e) {
    return false;
  }
}

function _setLast(companyKey, op, when, errorMsg) {
  var last = _lastSync.get(companyKey) || {};
  if (op === 'pull') {
    last.lastPull = when;
  } else if (op === 'push') {
    last.lastPush = when;
  }
  if (errorMsg) {
    last.lastError = errorMsg;
    last.lastErrorAt = when || new Date().toISOString();
  } else {
    last.lastError = null;
    last.lastErrorAt = null;
  }
  _lastSync.set(companyKey, last);
}

/**
 * Merge de archivos de conflicto de Google Drive.
 * Lee cada (empresa.kairsync + empresa (Conflicto de copia).kairsync),
 * los mergea con last-write-wins, y deja el resultado en el archivo principal.
 */
async function _mergeConflictFiles(hubPath, conflicts) {
  for (var i = 0; i < conflicts.length; i++) {
    var c = conflicts[i];
    try {
      var mainContent = await _readFileSafe(c.mainPath);
      var conflictContent = await _readFileSafe(c.conflictPath);
      if (!mainContent && !conflictContent) continue;

      var db = _getDb();
      if (mainContent && conflictContent) {
        // Ambos existen: serializar main a la BD primero, luego aplicar conflict
        // Esto es safe porque el conflict puede tener cambios mas nuevos
        var mainResult = serializer.deserializeSyncToDb(db, mainContent, {});
        var conflictResult = serializer.deserializeSyncToDb(db, conflictContent, {});
        console.log('[' + MOD + '] Conflicto mergeado: main applied=' + mainResult.applied +
                    ', conflict applied=' + conflictResult.applied);
        // Re-serializar la BD (ya con el merge) y escribir al main
        var merged = serializer.serializeEmpresaToSync(
          db, mainContent.companyKey, 'merged', 'sync', _getAppVersion()
        );
        await serializer.writeSyncFile(hubPath, merged);
      } else if (conflictContent && !mainContent) {
        // Solo existe el conflicto, renombrarlo a main
        await fsp.copyFile(c.conflictPath, c.mainPath);
        console.log('[' + MOD + '] Conflicto promovido a main (main no existia)');
      }
    } catch (e) {
      console.error('[' + MOD + '] Error mergeando conflicto ' + c.conflictPath + ': ' + e.message);
    }
  }
}

async function _readFileSafe(filePath) {
  try {
    var content = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.warn('[' + MOD + '] No se pudo leer ' + filePath + ': ' + e.message);
    return null;
  }
}

async function _cleanupConflictFiles(conflicts) {
  for (var i = 0; i < conflicts.length; i++) {
    try {
      await fsp.unlink(conflicts[i].conflictPath);
      console.log('[' + MOD + '] Conflicto borrado: ' + path.basename(conflicts[i].conflictPath));
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn('[' + MOD + '] No se pudo borrar conflicto: ' + e.message);
      }
    }
  }
}

async function _cleanupOldBackups(hubPath) {
  try {
    var files = await fsp.readdir(hubPath);
    var backups = files
      .filter(function (f) { return f.indexOf('empresa.kairsync.bak.') === 0; })
      .sort(); // Orden alfabetico = orden cronologico (ISO timestamps)
    if (backups.length <= MAX_BACKUPS) return;

    var aBorrar = backups.slice(0, backups.length - MAX_BACKUPS);
    for (var i = 0; i < aBorrar.length; i++) {
      var p = path.join(hubPath, aBorrar[i]);
      try {
        await fsp.unlink(p);
        console.log('[' + MOD + '] Backup viejo borrado: ' + aBorrar[i]);
      } catch (e) {
        console.warn('[' + MOD + '] No se pudo borrar backup viejo: ' + e.message);
      }
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.warn('[' + MOD + '] Error limpiando backups: ' + e.message);
    }
  }
}

// =====================================================================
// Exports
// =====================================================================

module.exports = {
  init: init,
  getStatus: getStatus,
  pull: pull,
  push: push,
  debouncedPush: debouncedPush,
  startAutoSync: startAutoSync,
  stopAutoSync: stopAutoSync,
  stopAllAutoSync: stopAllAutoSync,
  startAutoSyncForAllEnabled: startAutoSyncForAllEnabled
};
