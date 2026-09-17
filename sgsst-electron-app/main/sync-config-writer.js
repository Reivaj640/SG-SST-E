/**
 * main/sync-config-writer.js
 *
 * Helper para escribir la config de sync por empresa en config.json
 * de forma atomica y validada. Usado por el handler IPC `sync:configure`.
 *
 * Garantias:
 *   - Escritura atomica: escribe a un archivo temporal primero, despues
 *     renombra. Asi si la app crashea durante la escritura, el config.json
 *     original no se corrompe.
 *   - Backup automatico: antes de escribir, copia el config.json existente
 *     a config.json.bak (se sobreescribe cada vez).
 *   - Validacion: verifica que el hubPath sea absoluto y normaliza los
 *     separadores a / (mejor compat con GDrive en Windows).
 *   - Defaults: si no se pasan campos opcionales, usa valores razonables.
 */
'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const MOD = 'SYNC-CONFIG-WRITER';

const DEFAULTS = {
  enabled: true,
  intervalMinutes: 5,
  autoSync: true
};

/**
 * Escribe la config de sync para una empresa en config.json.
 * Retorna { success, data: { hubPath, ...syncConfig } | error }.
 *
 * @param {string} configPath - Path absoluto al config.json
 * @param {string} companyKey - Key de la empresa (debe existir en companyPaths)
 * @param {object} syncConfig - { hubPath, intervalMinutes?, autoSync? }
 * @returns {Promise<object>}
 */
async function writeCompanySyncConfig(configPath, companyKey, syncConfig) {
  if (!configPath) {
    return { success: false, error: { code: 'NO_CONFIG_PATH', message: 'configPath requerido' } };
  }
  if (!companyKey) {
    return { success: false, error: { code: 'NO_COMPANY', message: 'companyKey requerido' } };
  }
  if (!syncConfig || !syncConfig.hubPath) {
    return { success: false, error: { code: 'VALIDATION', message: 'hubPath requerido' } };
  }

  // Validar y normalizar hubPath
  var normalizedHubPath = _normalizeHubPath(syncConfig.hubPath);
  if (!path.isAbsolute(normalizedHubPath)) {
    return {
      success: false,
      error: { code: 'VALIDATION', message: 'hubPath debe ser una ruta absoluta' }
    };
  }

  var fullSyncConfig = {
    enabled: syncConfig.enabled !== false,
    hubPath: normalizedHubPath,
    intervalMinutes: (typeof syncConfig.intervalMinutes === 'number' && syncConfig.intervalMinutes > 0)
      ? syncConfig.intervalMinutes
      : DEFAULTS.intervalMinutes,
    autoSync: syncConfig.autoSync !== false
  };

  try {
    // Leer config actual
    var config;
    try {
      var raw = await fsp.readFile(configPath, 'utf8');
      config = JSON.parse(raw);
    } catch (e) {
      if (e.code === 'ENOENT') {
        config = {};
      } else {
        throw e;
      }
    }

    if (!config.companyPaths) config.companyPaths = {};
    if (!config.companyPaths[companyKey]) {
      return {
        success: false,
        error: {
          code: 'COMPANY_NOT_FOUND',
          message: 'Empresa "' + companyKey + '" no existe en companyPaths. Vincular primero.'
        }
      };
    }

    // Backup del config.json antes de modificar
    var bakPath = configPath + '.bak';
    try {
      await fsp.copyFile(configPath, bakPath);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn('[' + MOD + '] No se pudo hacer backup: ' + e.message);
      }
    }

    // Merge: solo actualizamos el sync, no tocamos el resto de la config
    config.companyPaths[companyKey].sync = fullSyncConfig;

    // Escritura atomica: archivo temporal + rename
    var tmpPath = configPath + '.tmp';
    await fsp.writeFile(tmpPath, JSON.stringify(config, null, 2), 'utf8');
    await fsp.rename(tmpPath, configPath);

    console.log('[' + MOD + '] Sync config guardada para ' + companyKey +
                ' (hub=' + fullSyncConfig.hubPath +
                ', interval=' + fullSyncConfig.intervalMinutes + 'min)');

    return { success: true, data: fullSyncConfig };
  } catch (e) {
    console.error('[' + MOD + '] Error escribiendo config: ' + e.message);
    return { success: false, error: { code: 'WRITE_FAILED', message: e.message } };
  }
}

/**
 * Elimina la config de sync de una empresa (la desactiva).
 * Si enabled era true, lo pasa a false pero mantiene el hubPath
 * para que se pueda reactivar rapido.
 *
 * @param {string} configPath
 * @param {string} companyKey
 * @returns {Promise<object>}
 */
async function disableCompanySync(configPath, companyKey) {
  if (!configPath || !companyKey) {
    return { success: false, error: { code: 'VALIDATION', message: 'configPath y companyKey requeridos' } };
  }
  try {
    var raw = await fsp.readFile(configPath, 'utf8');
    var config = JSON.parse(raw);

    if (!config.companyPaths || !config.companyPaths[companyKey] || !config.companyPaths[companyKey].sync) {
      return { success: true, data: null }; // Ya estaba deshabilitado
    }

    config.companyPaths[companyKey].sync.enabled = false;

    var tmpPath = configPath + '.tmp';
    await fsp.writeFile(tmpPath, JSON.stringify(config, null, 2), 'utf8');
    await fsp.rename(tmpPath, configPath);

    console.log('[' + MOD + '] Sync deshabilitado para ' + companyKey);
    return { success: true, data: config.companyPaths[companyKey].sync };
  } catch (e) {
    console.error('[' + MOD + '] Error deshabilitando sync: ' + e.message);
    return { success: false, error: { code: 'WRITE_FAILED', message: e.message } };
  }
}

function _normalizeHubPath(p) {
  if (!p) return '';
  // En Windows, GDrive usa 'G:/Mi unidad/...' con slashes normales.
  // Convertir backslashes a slashes para consistencia.
  var s = String(p).replace(/\\/g, '/');
  // Quitar trailing slash para consistencia
  if (s.length > 1 && s.charAt(s.length - 1) === '/') {
    s = s.substring(0, s.length - 1);
  }
  return s;
}

module.exports = {
  writeCompanySyncConfig: writeCompanySyncConfig,
  disableCompanySync: disableCompanySync,
  _normalizeHubPath: _normalizeHubPath
};
