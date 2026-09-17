/**
 * main/pcid-generator.js
 *
 * Genera y persiste un ID único y estable por PC para el sync multipc (📦538).
 *
 * Formato: <hostname-slug>-<6 hex chars>
 *   - hostname-slug: hostname en minusculas, sin caracteres raros, max 20 chars
 *   - 6 hex chars: random, para diferenciar 2 PCs con el mismo hostname
 *
 * Se guarda en <userData>/config.json bajo el campo `sync.pcId`.
 * Es estable: si la PC arranca de nuevo, el mismo pcId se mantiene.
 *
 * Sigue el patron del spec §8.2.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const MOD = 'PCID-GEN';

/**
 * Asegura que exista un pcId en config.json. Si no existe, lo genera y
 * lo guarda. Retorna el pcId (existente o nuevo).
 *
 * @param {string} userDataPath - Path al directorio userData (config.json vive ahi)
 * @returns {string} pcId estable
 */
function ensurePcId(userDataPath) {
  if (!userDataPath) throw new Error('[' + MOD + '] userDataPath requerido');

  var configPath = path.join(userDataPath, 'config.json');
  var config = _readConfig(configPath);

  // Si ya existe, retornarlo
  if (config && config.sync && config.sync.pcId) {
    return config.sync.pcId;
  }

  // No existe: generar uno nuevo
  var newPcId = _generatePcId();
  console.log('[' + MOD + '] Generando nuevo pcId: ' + newPcId);

  // Guardar en config.json
  if (!config) config = {};
  if (!config.sync) config.sync = {};
  config.sync.pcId = newPcId;
  config.sync.pcIdCreatedAt = new Date().toISOString();
  _writeConfig(configPath, config);

  return newPcId;
}

/**
 * Genera un pcId nuevo sin persistirlo. Util para tests.
 */
function _generatePcId() {
  var hostname = (os.hostname() || 'unknown').toLowerCase();

  // Limpiar hostname: solo alfanumericos y guiones, max 20 chars
  var slug = hostname
    .replace(/[^a-z0-9-]/g, '-')   // caracteres raros -> guion
    .replace(/-+/g, '-')            // multiples guiones -> uno
    .replace(/^-+|-+$/g, '')        // guiones al inicio/final
    .substring(0, 20);

  if (!slug) slug = 'pc';

  // 6 chars hex random
  var rand = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');

  return slug + '-' + rand;
}

function _readConfig(configPath) {
  try {
    var raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    console.warn('[' + MOD + '] Error leyendo config: ' + e.message);
    return null;
  }
}

function _writeConfig(configPath, config) {
  try {
    var dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('[' + MOD + '] Error escribiendo config: ' + e.message);
    throw e;
  }
}

module.exports = {
  ensurePcId: ensurePcId
};
