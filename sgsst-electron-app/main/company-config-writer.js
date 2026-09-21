/**
 * main/company-config-writer.js
 *
 * 📦103.A1.0 · Helper para escribir atributos de empresa en config.json
 * de forma atómica y validada.
 *
 * Caso de uso inicial (I-103.A1.0): guardar el NIT canónico de una
 * empresa en config.companyPaths[companyKey].nit. Reutiliza el patrón
 * de escritura de sync-config-writer.js (atomic write + backup) para
 * mantener consistencia en cómo se muta config.json desde el main process.
 *
 * Garantías (mismo patrón que sync-config-writer.js):
 *   - Escritura atómica: escribe a un archivo temporal primero, después
 *     renombra. Así si la app crashea durante la escritura, el config.json
 *     original no se corrompe.
 *   - Backup automático: antes de escribir, copia el config.json existente
 *     a config.json.bak (se sobreescribe cada vez).
 *   - Validación: el NIT se valida (9-15 dígitos, sin espacios ni guiones).
 *   - Merge: solo actualiza el campo provisto, no toca el resto de la
 *     config de la empresa (root, structure, stats, sync, etc.).
 *   - No inventa valores: si la empresa no existe en companyPaths,
 *     retorna COMPANY_NOT_FOUND. NO crea la empresa.
 *
 * Lo que NO hace (explícito, para I-103.A1.0):
 *   - NO crea bridge IPC (eso es A1.1+).
 *   - NO modifica preload.js (eso es A1.1+).
 *   - NO migra NITs de kp_empresa (eso es A1.1+).
 *   - NO modifica firma-bridge.js ni firma-service.
 *   - NO toca config-viewer.html (eso es A1.2+).
 */
'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const MOD = 'COMPANY-CONFIG-WRITER';

// 9-15 dígitos. Cubre NIT colombiano (9 + DV) y equivalentes internacionales.
const NIT_REGEX = /^\d{9,15}$/;

/**
 * Normaliza el NIT: quita espacios, guiones y caracteres separadores comunes.
 * NO valida (eso es _validateNit). Solo limpia.
 *
 * @param {string} raw - NIT en cualquier formato ("900.123.456-7", "900 123 456 7", "9001234567")
 * @returns {string|null} - NIT normalizado, o null si el input no es string
 */
function _normalizeNit(raw) {
  if (typeof raw !== 'string') return null;
  return raw.replace(/[\s\-\.]/g, '');
}

/**
 * Valida un NIT ya normalizado. 9 a 15 dígitos, solo caracteres numéricos.
 *
 * @param {string} normalized - NIT normalizado (sin espacios ni guiones)
 * @returns {{ok: boolean, reason?: string}}
 */
function _validateNit(normalized) {
  if (normalized === null || normalized === undefined || normalized === '') {
    return { ok: false, reason: 'NIT vacío' };
  }
  if (!NIT_REGEX.test(normalized)) {
    return { ok: false, reason: 'NIT inválido (debe tener 9-15 dígitos, solo números)' };
  }
  return { ok: true };
}

/**
 * Escribe el NIT canónico de una empresa en config.json.
 * NO modifica otros atributos de la empresa (root, stats, sync, etc.).
 * NO crea la empresa si no existe (retorna COMPANY_NOT_FOUND).
 *
 * @param {string} configPath - Path absoluto al config.json
 * @param {string} companyKey - Key de la empresa (debe existir en companyPaths)
 * @param {string} rawNit - NIT en cualquier formato (será normalizado y validado)
 * @returns {Promise<{success: true, data: {companyKey, nit}} | {success: false, error: {code, message}}>}
 */
async function writeCompanyNit(configPath, companyKey, rawNit) {
  if (!configPath) {
    return { success: false, error: { code: 'NO_CONFIG_PATH', message: 'configPath requerido' } };
  }
  if (!companyKey) {
    return { success: false, error: { code: 'NO_COMPANY', message: 'companyKey requerido' } };
  }

  // 1. Normalizar
  const normalized = _normalizeNit(rawNit);
  if (normalized === null) {
    return { success: false, error: { code: 'INVALID_NIT', message: 'NIT debe ser string' } };
  }

  // 2. Validar
  const v = _validateNit(normalized);
  if (!v.ok) {
    return { success: false, error: { code: 'INVALID_NIT', message: v.reason } };
  }

  try {
    // 3. Leer config actual
    let config;
    try {
      const raw = await fsp.readFile(configPath, 'utf8');
      config = JSON.parse(raw);
    } catch (e) {
      if (e.code === 'ENOENT') {
        config = {};
      } else {
        throw e;
      }
    }

    // 4. Validar que la empresa existe
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

    // 5. Backup del config.json antes de modificar
    const bakPath = configPath + '.bak';
    try {
      await fsp.copyFile(configPath, bakPath);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn('[' + MOD + '] No se pudo hacer backup: ' + e.message);
      }
    }

    // 6. Merge: solo actualizamos nit, no tocamos el resto de la config
    config.companyPaths[companyKey].nit = normalized;

    // 7. Escritura atómica: archivo temporal + rename
    const tmpPath = configPath + '.tmp';
    await fsp.writeFile(tmpPath, JSON.stringify(config, null, 2), 'utf8');
    await fsp.rename(tmpPath, configPath);

    console.log('[' + MOD + '] NIT guardado para ' + companyKey + ' (nit=' + normalized + ')');

    return { success: true, data: { companyKey: companyKey, nit: normalized } };
  } catch (e) {
    console.error('[' + MOD + '] Error escribiendo NIT: ' + e.message);
    return { success: false, error: { code: 'WRITE_FAILED', message: e.message } };
  }
}

/**
 * Lee el NIT de una empresa. Retorna null si no tiene NIT guardado.
 * NO falla si el config.json no existe o si la empresa no está.
 *
 * @param {string} configPath - Path absoluto al config.json
 * @param {string} companyKey - Key de la empresa
 * @returns {Promise<string|null>} - NIT normalizado, o null
 */
async function readCompanyNit(configPath, companyKey) {
  if (!configPath || !companyKey) return null;
  try {
    const raw = await fsp.readFile(configPath, 'utf8');
    const config = JSON.parse(raw);
    if (!config.companyPaths || !config.companyPaths[companyKey]) return null;
    return config.companyPaths[companyKey].nit || null;
  } catch (e) {
    return null;
  }
}

/**
 * Elimina el NIT de una empresa (lo vuelve a undefined).
 * Útil para tests o rollback.
 *
 * @param {string} configPath
 * @param {string} companyKey
 * @returns {Promise<{success: boolean, error?: object}>}
 */
async function clearCompanyNit(configPath, companyKey) {
  if (!configPath) {
    return { success: false, error: { code: 'NO_CONFIG_PATH', message: 'configPath requerido' } };
  }
  if (!companyKey) {
    return { success: false, error: { code: 'NO_COMPANY', message: 'companyKey requerido' } };
  }
  try {
    let config;
    try {
      const raw = await fsp.readFile(configPath, 'utf8');
      config = JSON.parse(raw);
    } catch (e) {
      if (e.code === 'ENOENT') {
        return { success: true, data: null }; // No hay config, nada que limpiar
      }
      throw e;
    }

    if (!config.companyPaths || !config.companyPaths[companyKey]) {
      return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa "' + companyKey + '" no existe' } };
    }

    if (!config.companyPaths[companyKey].nit) {
      return { success: true, data: null }; // Ya estaba limpio
    }

    // Backup
    const bakPath = configPath + '.bak';
    try {
      await fsp.copyFile(configPath, bakPath);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn('[' + MOD + '] No se pudo hacer backup: ' + e.message);
      }
    }

    // Merge: eliminamos solo el campo nit
    delete config.companyPaths[companyKey].nit;

    // Atomic write
    const tmpPath = configPath + '.tmp';
    await fsp.writeFile(tmpPath, JSON.stringify(config, null, 2), 'utf8');
    await fsp.rename(tmpPath, configPath);

    console.log('[' + MOD + '] NIT eliminado para ' + companyKey);
    return { success: true, data: null };
  } catch (e) {
    console.error('[' + MOD + '] Error eliminando NIT: ' + e.message);
    return { success: false, error: { code: 'WRITE_FAILED', message: e.message } };
  }
}

module.exports = {
  writeCompanyNit: writeCompanyNit,
  readCompanyNit: readCompanyNit,
  clearCompanyNit: clearCompanyNit,
  _normalizeNit: _normalizeNit,
  _validateNit: _validateNit
};
