/**
 * main/sync-bridge.js
 *
 * Bridge IPC para el sync multipc de K+AIR (📦537).
 * Expone la API de sync-service.js al renderer process via electronAPI.sync.*.
 *
 * Handlers:
 *   - sync:status    (devuelve estado actual de una empresa)
 *   - sync:pull      (descarga .kairsync del hub y aplica a BD local)
 *   - sync:push      (serializa BD local y sube al hub)
 *   - sync:start     (inicia auto-sync timer para una empresa)
 *   - sync:stop      (detiene auto-sync timer)
 *   - sync:start-all (inicia auto-sync para TODAS las empresas habilitadas)
 *   - sync:stop-all  (detiene TODOS los timers)
 *
 * Sigue el mismo patron que evaluacion-action-plans-bridge.js (📦531).
 */
'use strict';

const { ipcMain, dialog } = require('electron');
const syncService = require('./sync-service.js');
const syncConfigWriter = require('./sync-config-writer.js');

const MOD = 'SYNC-BRIDGE';

function registerSyncHandlers(app, deps) {
  // Init del service UNA vez
  syncService.init(app, deps);

  // Helper: path al config.json (reutilizado por configure/disable)
  var _getConfigPath = function () {
    return require('path').join(app.getPath('userData'), 'config.json');
  };

  console.log('[' + MOD + '][INIT] Registrando handlers de sync multipc...');

  // --- Status ---
  ipcMain.handle('sync:status', async function (event, payload) {
    try {
      var params = (payload && typeof payload === 'object') ? payload : {};
      var status = syncService.getStatus(params.companyKey);
      return { success: true, data: status };
    } catch (e) {
      console.error('[' + MOD + '][STATUS]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // --- Pull ---
  ipcMain.handle('sync:pull', async function (event, payload) {
    try {
      var params = (payload && typeof payload === 'object') ? payload : {};
      return await syncService.pull(params.companyKey, params.options || {});
    } catch (e) {
      console.error('[' + MOD + '][PULL]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // --- Push ---
  ipcMain.handle('sync:push', async function (event, payload) {
    try {
      var params = (payload && typeof payload === 'object') ? payload : {};
      return await syncService.push(params.companyKey, params.options || {});
    } catch (e) {
      console.error('[' + MOD + '][PUSH]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // --- Start auto-sync para una empresa ---
  ipcMain.handle('sync:start', async function (event, payload) {
    try {
      var params = (payload && typeof payload === 'object') ? payload : {};
      syncService.startAutoSync(params.companyKey);
      return { success: true };
    } catch (e) {
      console.error('[' + MOD + '][START]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // --- Stop auto-sync para una empresa ---
  ipcMain.handle('sync:stop', async function (event, payload) {
    try {
      var params = (payload && typeof payload === 'object') ? payload : {};
      syncService.stopAutoSync(params.companyKey);
      return { success: true };
    } catch (e) {
      console.error('[' + MOD + '][STOP]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // --- Start auto-sync para todas las empresas habilitadas ---
  ipcMain.handle('sync:start-all', async function () {
    try {
      syncService.startAutoSyncForAllEnabled();
      return { success: true };
    } catch (e) {
      console.error('[' + MOD + '][START-ALL]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // --- Stop ALL timers (util en shutdown de la app) ---
  ipcMain.handle('sync:stop-all', async function () {
    try {
      syncService.stopAllAutoSync();
      return { success: true };
    } catch (e) {
      console.error('[' + MOD + '][STOP-ALL]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // --- Configure sync per company (UI uses this from the switch) ---
  ipcMain.handle('sync:configure', async function (event, payload) {
    try {
      var params = (payload && typeof payload === 'object') ? payload : {};
      if (!params.companyKey) {
        return { success: false, error: { code: 'VALIDATION', message: 'companyKey requerido' } };
      }
      if (!params.hubPath) {
        return { success: false, error: { code: 'VALIDATION', message: 'hubPath requerido' } };
      }
      var result = await syncConfigWriter.writeCompanySyncConfig(
        _getConfigPath(), params.companyKey, {
          enabled: params.enabled !== false,
          hubPath: params.hubPath,
          intervalMinutes: params.intervalMinutes,
          autoSync: params.autoSync
        }
      );
      // Si se activo el sync, arrancar el auto-sync timer
      if (result.success && result.data && result.data.enabled) {
        syncService.startAutoSync(params.companyKey);
      }
      return result;
    } catch (e) {
      console.error('[' + MOD + '][CONFIGURE]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // --- Disable sync per company ---
  ipcMain.handle('sync:disable', async function (event, payload) {
    try {
      var params = (payload && typeof payload === 'object') ? payload : {};
      if (!params.companyKey) {
        return { success: false, error: { code: 'VALIDATION', message: 'companyKey requerido' } };
      }
      var result = await syncConfigWriter.disableCompanySync(_getConfigPath(), params.companyKey);
      if (result.success) {
        syncService.stopAutoSync(params.companyKey);
      }
      return result;
    } catch (e) {
      console.error('[' + MOD + '][DISABLE]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // --- Pick a folder for hub path (file dialog) ---
  ipcMain.handle('sync:pick-folder', async function (event, payload) {
    try {
      var params = (payload && typeof payload === 'object') ? payload : {};
      var result = await dialog.showOpenDialog({
        title: params.title || 'Elegir carpeta compartida para sincronizar',
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: params.defaultPath || undefined
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: true, data: null, canceled: true };
      }
      return { success: true, data: { path: result.filePaths[0] } };
    } catch (e) {
      console.error('[' + MOD + '][PICK-FOLDER]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  console.log('[' + MOD + '][INIT] 10 handlers de sync registrados');
}

module.exports = {
  registerSyncHandlers: registerSyncHandlers
};
