// F3.A — Google OAuth token persistence.
// Guarda los tokens (access_token, refresh_token, expiry) en config.json
// para que persistan entre sesiones. Si falta refresh_token, el user
// tiene que re-autorizar la app desde la UI.
const fs = require('fs');
const path = require('path');

const TOKEN_KEY = 'googleOAuth'; // Namespace dentro de config.json

function getConfigPath(app, userDataPath) {
  if (userDataPath) return path.join(userDataPath, 'config.json');
  if (app && app.getPath) return path.join(app.getPath('userData'), 'config.json');
  return null;
}

function loadConfig(configPath) {
  try {
    if (!fs.existsSync(configPath)) return {};
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw) || {};
  } catch (e) {
    console.error('[GoogleTokens] Error leyendo config.json:', e.message);
    return {};
  }
}

function saveConfig(configPath, config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[GoogleTokens] Error guardando config.json:', e.message);
    return false;
  }
}

function loadTokens(configPath) {
  const config = loadConfig(configPath);
  return config[TOKEN_KEY] || null;
}

function saveTokens(configPath, tokens) {
  if (!configPath) return false;
  const config = loadConfig(configPath);
  config[TOKEN_KEY] = {
    access_token: tokens.access_token || null,
    refresh_token: tokens.refresh_token || null,
    expiry_date: tokens.expiry_date || (tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : null),
    scope: tokens.scope || null,
    token_type: tokens.token_type || 'Bearer',
    savedAt: new Date().toISOString()
  };
  return saveConfig(configPath, config);
}

function clearTokens(configPath) {
  if (!configPath) return false;
  const config = loadConfig(configPath);
  delete config[TOKEN_KEY];
  return saveConfig(configPath, config);
}

function hasValidTokens(configPath) {
  const tokens = loadTokens(configPath);
  if (!tokens || !tokens.access_token) return false;
  // F4-fix — Si hay refresh_token, podemos renovar el access_token aunque esté
  // vencido. Google entrega refresh_token junto con el access_token inicial y
  // NO expira hasta que el user revoque el acceso desde su cuenta Google.
  // Por eso: si hay refresh_token, asumimos que la sesión es válida.
  // El access_token solo se usa para verificar que el flow OAuth se completó.
  if (tokens.refresh_token) return true;
  // Sin refresh_token: dependemos solo del access_token.
  // Si no hay expiry, asumimos válido (será verificado en uso).
  if (!tokens.expiry_date) return true;
  // Margen de 5 min para renovación preventiva
  return Date.now() < (tokens.expiry_date - 5 * 60 * 1000);
}

module.exports = {
  TOKEN_KEY,
  getConfigPath,
  loadTokens,
  saveTokens,
  clearTokens,
  hasValidTokens
};
