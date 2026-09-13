// =====================================================================
// 📦101 (2026-08-20) — Bridge IPC para firma-service v1 (I-101)
//
// Capa IPC: handlers `firma:*` (NO `gh:firma:*`, NO `presupuesto:*`).
// Patrón idéntico a main/gestion-humana-bridge.js:
//   - registerFirmaHandlers.init(ipcMain)  ← setea el ipcMain
//   - registerFirmaHandlers(app, deps)     ← registra los 13 handlers
//
// Canales registrados (13):
//   Config (4):      firma:config:get, firma:config:set-api-key,
//                    firma:config:set-url, firma:config:diag
//   Sign request (7): firma:sign-request:create, :get, :list, :document,
//                    :constancia, :link, :notify-remote (proxy opcional)
//   Consent (2):     firma:consent:create, firma:consent:verify-otp
//   Agreement (1):   firma:agreement:get
//
// Persistencia:
//   - Producción: <userData>/secrets.enc cifrado con safeStorage
//     (apiKey, clientInstanceId, firmaServiceUrl).
//   - Dev/CI: env vars FIRMA_SERVICE_URL + FIRMA_SERVICE_API_KEY +
//     (opcional) FIRMA_SERVICE_CLIENT_INSTANCE_ID. Sin cifrar.
//
// Plan: docs/kair-firma-integration/READY-TO-IMPLEMENT.md §D (I-101).
// =====================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const { app, safeStorage, dialog } = require('electron');

const firmaClientModule = require('./firma-client');

const MOD = 'FIRMA-BRIDGE';
// Versión actual del schema de secrets.enc. v1 = API key global plana.
// v2 = per-empresa (empresas: {companyKey: {idEmpresa, firmaApiKey, ...}})
// + adminApiKey opcional. Migración silenciosa v1 → v2 se ejecuta en
// _readSecrets() la primera vez que se lee un archivo v1.
const SECRETS_VERSION = 2;
const SECRETS_VERSION_V1 = 1;
const SECRETS_FILENAME = 'secrets.enc';
// NOTA: Ya NO usamos un string fijo como fallback de client_instance_id
// (antes era 'test-instance-001' — colisionaba entre devs que setean
//  FIRMA_SERVICE_URL+APIKEY sin setear FIRMA_SERVICE_CLIENT_INSTANCE_ID).
// Si el env no tiene client_id, generamos un UUID nuevo en cada arranque
// y logueamos un warning. Ver _envConfig() abajo.

// ---------- Estado inyectado ----------
let _ipcMain = null;
let _app = null;
let _appVersion = 'dev';
// Factory inyectable (default = require('./firma-client').createFirmaClient).
// Los tests pueden sobreescribirla con registerFirmaHandlers._test_setClientFactory().
let _clientFactory = firmaClientModule.createFirmaClient;
let _generateClientInstanceIdFn = firmaClientModule.generateClientInstanceId;

// ---------- Helpers de respuesta IPC ----------
function _ok(data) {
  return { success: true, data: data || {} };
}
function _err(code, message, extra) {
  var e = { success: false, error: { code: code, message: message } };
  if (extra) e.error.extra = extra;
  return e;
}

// =====================================================================
//  SECRETS PERSISTENCE (safeStorage)
// =====================================================================

function _secretsPath() {
  var userData = (_app && typeof _app.getPath === 'function') ? _app.getPath('userData') : null;
  if (!userData) return null;
  return path.join(userData, SECRETS_FILENAME);
}

/**
 * Lee el archivo secrets.enc y devuelve el JSON descifrado, o null si no existe.
 * Si safeStorage no está disponible, devuelve null + log warning.
 * Si el archivo está corrupto o descifrado falla, lo BORRA y devuelve null
 * (asume nueva instalación).
 *
 * Si el archivo tiene version < SECRETS_VERSION (v1), ejecuta migración
 * silenciosa v1 → v2 y reescribe el archivo en formato v2.
 *
 * Política "no perder datos" (AUD-04 §2.3): si la reescritura falla,
 * se mantiene v1 en memoria esta sesión y se reintenta en próximo boot.
 * NUNCA se sobreescribe v1 sin haber escrito v2 antes.
 */
function _readSecrets() {
  var p = _secretsPath();
  if (!p) return null;
  if (!fs.existsSync(p)) return null;
  if (!safeStorage || !safeStorage.isEncryptionAvailable || !safeStorage.isEncryptionAvailable()) {
    console.warn('[' + MOD + '] safeStorage no disponible; no se puede leer secrets.enc');
    return null;
  }
  var raw;
  try {
    var buf = fs.readFileSync(p);
    var json = safeStorage.decryptString(buf);
    raw = JSON.parse(json);
  } catch (e) {
    console.warn('[' + MOD + '] Error descifrando secrets.enc (posible cambio de OS/keyring):', e.message);
    // Borrar archivo corrupto; regenerar
    try { fs.unlinkSync(p); } catch (_) {}
    return null;
  }
  if (!raw) return null;
  // v1 → v2 silenciosa
  if (raw.version === SECRETS_VERSION_V1 || (!raw.version && raw.firmaServiceApiKey)) {
    var v2 = _migrateSecretsV1ToV2(raw);
    if (!v2) return raw; // fallback: usar v1 si la migración retorna null
    // Intentar reescribir en formato v2. Si falla, mantener v1 en memoria.
    var w = _writeSecrets(v2);
    if (w && w.ok) {
      console.info('[' + MOD + '] secrets.enc migrado v1 → v2.');
    } else {
      console.warn('[' + MOD + '] No se pudo reescribir secrets.enc v2; se mantiene v1 en memoria esta sesión.');
    }
    return w && w.ok ? v2 : raw;
  }
  return raw;
}

/**
 * Migra un objeto secrets.enc v1 al schema v2.
 * - v1: { version: 1, firmaServiceUrl, firmaServiceApiKey, clientInstanceId }
 * - v2: { version: 2, firmaServiceUrl, firmaServiceClientInstanceId,
 *         adminApiKey?, empresas: {}, __legacy__?: {firmaApiKey, migratedAt, warning} }
 *
 * La key legacy de v1 se preserva en `__legacy__` (DR-4 / spec §2.3) con un
 * warning. Los handlers per-empresa NUNCA consultan `__legacy__` (solo sirve
 * para no perder la key durante la migración; el user debe reasignar a una
 * empresa con firma:empresa:set-api-key).
 */
function _migrateSecretsV1ToV2(v1) {
  if (!v1 || typeof v1 !== 'object') return null;
  var v2 = {
    version: SECRETS_VERSION,
    firmaServiceUrl: v1.firmaServiceUrl || '',
    firmaServiceClientInstanceId:
      v1.clientInstanceId || (typeof _generateClientInstanceIdFn === 'function' ? _generateClientInstanceIdFn() : ''),
    empresas: {}
  };
  if (v1.firmaServiceApiKey) {
    v2.__legacy__ = {
      firmaApiKey: v1.firmaServiceApiKey,
      migratedAt: new Date().toISOString(),
      warning: 'Key legacy migrada desde v1. Reasignar a una empresa con firma:empresa:set-api-key.'
    };
    console.warn(
      '[' + MOD + '] secrets.enc v1 contenía firmaServiceApiKey. ' +
      'Movida a __legacy__. Use firma:empresa:set-api-key para reasignar ' +
      'a una empresa. idEmpresa NO conocido (debe venir del admin de firma-service).'
    );
  }
  return v2;
}

/**
 * Escribe el JSON cifrado en secrets.enc.
 * Retorna { ok, encryptionAvailable }.
 */
function _writeSecrets(obj) {
  if (!safeStorage || !safeStorage.isEncryptionAvailable || !safeStorage.isEncryptionAvailable()) {
    return { ok: false, encryptionAvailable: false };
  }
  var p = _secretsPath();
  if (!p) return { ok: false, encryptionAvailable: false };
  try {
    var json = JSON.stringify(obj);
    var enc = safeStorage.encryptString(json);
    fs.writeFileSync(p, enc);
    return { ok: true, encryptionAvailable: true };
  } catch (e) {
    console.error('[' + MOD + '] Error escribiendo secrets.enc:', e.message);
    return { ok: false, encryptionAvailable: true, error: e.message };
  }
}

// =====================================================================
//  CONFIG RESOLUTION (env > secrets > missing)
// =====================================================================

function _hasEnv() {
  return !!(process.env.FIRMA_SERVICE_URL && process.env.FIRMA_SERVICE_API_KEY);
}

function _envConfig() {
  var url = process.env.FIRMA_SERVICE_URL || '';
  var apiKey = process.env.FIRMA_SERVICE_API_KEY || '';
  var clientInstanceId = process.env.FIRMA_SERVICE_CLIENT_INSTANCE_ID || '';
  // Si el env tiene URL+APIKEY pero NO tiene client_id, generamos uno nuevo
  // en cada arranque (modo dev/CI sin persistencia). Esto evita que múltiples
  // devs compartan el mismo ID, lo que contaminaba métricas del backend.
  if (url && apiKey && !clientInstanceId) {
    clientInstanceId = _generateClientInstanceIdFn();
    console.warn(
      '[' + MOD + '] FIRMA_SERVICE_CLIENT_INSTANCE_ID no está seteado. ' +
      'Se generó un UUID nuevo para esta sesión (' + clientInstanceId + '). ' +
      'Para que sea estable entre arranques, define FIRMA_SERVICE_CLIENT_INSTANCE_ID en tu .env.'
    );
  }
  return {
    url: url,
    apiKey: apiKey,
    clientInstanceId: clientInstanceId,
    source: 'env'
  };
}

/**
 * Lee secrets.enc forzando forma v2. Si el archivo es v1, lo migra y
 * reescribe. Si está vacío, retorna v2 con defaults. Retorna null solo si
 * no se puede leer (safeStorage no disponible, archivo no existe, etc.).
 *
 * Esta función es el ÚNICO punto de entrada seguro para acceder a secrets.
 * El resto del código debe usar esta función, NO _readSecrets() directamente.
 */
function _readSecretsV2() {
  var raw = _readSecrets();
  if (!raw) return null;
  // _readSecrets ya hace la migración v1 → v2. Pero por si la migración
  // falló en disco (retornamos v1 crudo), normalizamos a v2 acá.
  if (raw.version !== SECRETS_VERSION) {
    return _migrateSecretsV1ToV2(raw) || _emptySecretsV2();
  }
  // Asegurar campos mínimos de v2.
  if (!raw.empresas) raw.empresas = {};
  if (!raw.firmaServiceClientInstanceId) {
    raw.firmaServiceClientInstanceId = _generateClientInstanceIdFn();
  }
  return raw;
}

function _emptySecretsV2() {
  return {
    version: SECRETS_VERSION,
    firmaServiceUrl: process.env.FIRMA_SERVICE_URL || '',
    firmaServiceClientInstanceId: _generateClientInstanceIdFn(),
    empresas: {}
  };
}

/**
 * Normaliza la key del company: lowercase, trim, colapsa espacios.
 * Usado para que "TEMPOACTIVA EST S.A.S." y "tempoactiva est s.a.s." 
 * caigan en la misma key.
 */
function _normalizeCompanyKey(companyName) {
  if (!companyName || typeof companyName !== 'string') return null;
  return companyName.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Busca la empresa en el map `empresas` por companyKey (case-insensitive).
 * Retorna { companyKey, entry } o null si no existe.
 */
function _resolveEmpresa(empresas, companyName) {
  if (!empresas || !companyName) return null;
  var target = _normalizeCompanyKey(companyName);
  // 1) Match exacto (después de normalizar)
  if (empresas[companyName]) {
    return { companyKey: companyName, entry: empresas[companyName] };
  }
  // 2) Match case-insensitive
  var keys = Object.keys(empresas);
  for (var i = 0; i < keys.length; i++) {
    if (_normalizeCompanyKey(keys[i]) === target) {
      return { companyKey: keys[i], entry: empresas[keys[i]] };
    }
  }
  return null;
}

function _secretsConfig() {
  var s = _readSecretsV2();
  if (!s) return null;
  // LEGACY compat: si existe empresas["__default__"] (key legacy v0.1.190
  // guardada vía firma:config:set-api-key), la usamos como apiKey.
  // Si no, retornamos apiKey vacío (modo per-empresa requiere seleccionar
  // empresa activa — fuera del scope de _secretsConfig()).
  var legacyKey = (s.empresas && s.empresas['__default__'] && s.empresas['__default__'].firmaApiKey) || '';
  return {
    url: s.firmaServiceUrl || '',
    apiKey: legacyKey,
    clientInstanceId: s.firmaServiceClientInstanceId || _generateClientInstanceIdFn(),
    source: 'secrets'
  };
}

/**
 * Resuelve la config efectiva (env > secrets).
 * Si NO hay env ni secrets → genera un client_instance_id nuevo y lo persiste
 * (modo 'missing', la UI debe pedir URL + API key).
 */
function _resolveConfig() {
  if (_hasEnv()) {
    var env = _envConfig();
    return {
      url: env.url,
      apiKey: env.apiKey,
      clientInstanceId: env.clientInstanceId,
      hasApiKey: !!env.apiKey,
      hasUrl: !!env.url,
      encryptionAvailable: !!(safeStorage && safeStorage.isEncryptionAvailable && safeStorage.isEncryptionAvailable()),
      source: 'env'
    };
  }
  var s = _secretsConfig();
  if (s) {
    return {
      url: s.url,
      apiKey: s.apiKey,
      clientInstanceId: s.clientInstanceId,
      hasApiKey: !!s.apiKey,
      hasUrl: !!s.url,
      encryptionAvailable: !!(safeStorage && safeStorage.isEncryptionAvailable && safeStorage.isEncryptionAvailable()),
      source: 'secrets'
    };
  }
  // Modo missing: generar client_instance_id y persistir
  var newId = _generateClientInstanceIdFn();
  var encOk = _writeSecrets({
    version: SECRETS_VERSION,
    firmaServiceUrl: '',
    firmaServiceClientInstanceId: newId,
    empresas: {}
  });
  if (!encOk.ok) {
    console.warn('[' + MOD + '] No se pudo persistir client_instance_id inicial (encryptionUnavailable)');
  }
  return {
    url: '',
    apiKey: '',
    clientInstanceId: newId,
    hasApiKey: false,
    hasUrl: false,
    encryptionAvailable: !!(safeStorage && safeStorage.isEncryptionAvailable && safeStorage.isEncryptionAvailable()),
    source: 'missing'
  };
}

// =====================================================================
//  CLIENT FACTORY (per-empresa cache)
// =====================================================================

/**
 * Cache per-empresa de FirmaClient.
 * Key: `${url}|${idEmpresa}|${clientInstanceId}` — cada empresa con su
 * propia key tiene su propio cliente. NO hay fallback entre empresas.
 */
var _clientCache = new Map(); // key string → FirmaClient

/**
 * Cache LEGACY (single, sin scope per-empresa). Se usa cuando el handler
 * NO recibe `args.companyName` y NO hay empresa configurada — fallback
 * al modo v0.1.190 (apiKey global plana).
 */
var _cachedClient = null;
var _cachedClientConfigKey = null;

function _clientConfigKey(cfg) {
  return [cfg.url, cfg.apiKey, cfg.clientInstanceId].join('|');
}

function _getClient() {
  // LEGACY: single client, sin scope per-empresa.
  var cfg = _resolveConfig();
  var key = _clientConfigKey(cfg);
  if (_cachedClient && _cachedClientConfigKey === key) {
    return { client: _cachedClient, config: cfg };
  }
  if (!cfg.url || !cfg.apiKey) {
    return { client: null, config: cfg };
  }
  _cachedClient = _clientFactory({
    baseUrl: cfg.url,
    apiKey: cfg.apiKey,
    clientInstanceId: cfg.clientInstanceId,
    appVersion: _appVersion
  });
  _cachedClientConfigKey = key;
  return { client: _cachedClient, config: cfg };
}

/**
 * Resuelve la config efectiva para una empresa activa.
 * @param {string} companyName - El company_key normalizado (display_name
 *                               en K+AIR v0.1.190). NO idEmpresa.
 * @returns {object|null}
 *   {
 *     url, apiKey, clientInstanceId, idEmpresa, source,
 *     lastValidatedAt, companyName, companyKey
 *   }
 */
// =========================================================================
// I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL — NO COMMITEAR
// =========================================================================
// Registra 5-7 campos NO SECRETOS sobre el estado de secrets.enc y la
// resolución de empresa. El log va a un archivo en %TEMP% para que el
// agente CLI pueda leerlo sin ver la consola de Electron.
//
// NO registra: API keys, admin keys, tokens, secretos, correos.
// =========================================================================
var KAIR_DIAG_LOG_PATH = path.join(
  (process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp'),
  'kair-bridge-diag.log'
);
function _diagLog(step, fields) {
  try {
    // Sanitizar: nunca imprimir nada que parezca key/token/secret
    var safe = {
      ts: new Date().toISOString(),
      step: step,
      fields: fields || {}
    };
    fs.appendFileSync(KAIR_DIAG_LOG_PATH, JSON.stringify(safe) + '\n', 'utf-8');
  } catch (_) { /* noop */ }
}

function _resolveConfigForCompany(companyName) {
  var _diag = { companyName_requested: companyName || null };
  if (!companyName || typeof companyName !== 'string') {
    _diag.outcome = 'CONFIG_MISSING';
    _diag.reason = 'companyName no es string';
    _diagLog('resolveConfigForCompany', _diag);
    return null;
  }

  // 1) Env vars: NO se implementa per-empresa en v1. El modo env
  //    (FIRMA_SERVICE_URL + FIRMA_SERVICE_API_KEY) sigue siendo "global",
  //    usado solo en dev/CI. Si hay env, retornamos config global PERO
  //    sin idEmpresa (dispara CONFIG_MISSING en handlers per-empresa).
  if (_hasEnv()) {
    var env = _envConfig();
    _diag.outcome = 'FOUND_env_global';
    _diag.idEmpresa = null;  // env mode nunca tiene id_empresa
    _diag.firmaApiKey_present = !!(env.apiKey && env.apiKey.length > 0);
    _diag.firmaApiKey_length = (env.apiKey || '').length;
    _diag.firmaServiceUrl_present = !!(env.url && env.url.length > 0);
    _diag.normalizedKey = _normalizeCompanyKey(companyName);
    _diagLog('resolveConfigForCompany', _diag);
    return {
      url: env.url,
      apiKey: env.apiKey,
      clientInstanceId: env.clientInstanceId,
      idEmpresa: null,           // <— clave: no hay scope per-empresa en env
      source: 'env-global',
      lastValidatedAt: null,
      companyName: companyName,
      companyKey: _normalizeCompanyKey(companyName)
    };
  }

  // 2) secrets.enc v2
  var s2 = _readSecretsV2();
  if (!s2) {
    _diag.outcome = 'CONFIG_MISSING';
    _diag.reason = 's2 = _readSecretsV2() retornó null (secrets.enc no leíble o vacío)';
    _diag.firmaApiKey_present = false;
    _diag.firmaApiKey_length = 0;
    _diag.firmaServiceUrl_present = false;
    _diagLog('resolveConfigForCompany', _diag);
    return null;  // secrets no accesible — caller decide qué hacer
  }

  var found = _resolveEmpresa(s2.empresas, companyName);
  if (!found) {
    _diag.outcome = 'CONFIG_MISSING';
    _diag.reason = 'empresa no encontrada en secrets.enc.empresas';
    _diag.empresas_keys = Object.keys(s2.empresas || {}).map(function (k) {
      // mostrar solo idEmpresa + companyKey, nunca la key
      return {
        companyKey: k,
        idEmpresa: (s2.empresas[k] || {}).idEmpresa || null
      };
    });
    _diag.normalizedKey = _normalizeCompanyKey(companyName);
    _diag.firmaApiKey_present = false;
    _diag.firmaApiKey_length = 0;
    _diag.firmaServiceUrl_present = !!(s2.firmaServiceUrl && s2.firmaServiceUrl.length > 0);
    _diagLog('resolveConfigForCompany', _diag);
    return null;  // empresa no configurada — caller retorna CONFIG_MISSING
  }
  var entry = found.entry;
  var apiKey = entry.firmaApiKey || '';
  _diag.outcome = 'FOUND_secrets';
  _diag.companyName_encontrado = found.companyKey;
  _diag.idEmpresa = entry.idEmpresa || null;
  _diag.firmaApiKey_present = apiKey.length > 0;
  _diag.firmaApiKey_length = apiKey.length;
  _diag.firmaApiKey_first4 = apiKey.length > 0 ? apiKey.slice(0, 4) + '***' : null;  // pista, no la key
  _diag.firmaServiceUrl_present = !!(s2.firmaServiceUrl && s2.firmaServiceUrl.length > 0);
  _diag.normalizedKey = _normalizeCompanyKey(companyName);
  _diagLog('resolveConfigForCompany', _diag);
  return {
    url: s2.firmaServiceUrl || '',
    apiKey: apiKey,
    clientInstanceId: s2.firmaServiceClientInstanceId || _generateClientInstanceIdFn(),
    idEmpresa: entry.idEmpresa || null,
    source: 'secrets',
    lastValidatedAt: entry.lastValidatedAt || null,
    companyName: companyName,
    companyKey: found.companyKey
  };
}

/**
 * Obtiene (o crea) un FirmaClient para una empresa. Usa cache per-empresa.
 * Retorna { client, config } o { client: null, config: null } si no se puede.
 */
function _getClientForCompany(companyName) {
  var cfg = _resolveConfigForCompany(companyName);
  if (!cfg || !cfg.url || !cfg.apiKey) {
    return { client: null, config: cfg };
  }
  // Cache key: incluye idEmpresa para evitar colisión entre empresas.
  var key = [cfg.url, cfg.idEmpresa || '_', cfg.clientInstanceId].join('|');
  if (_clientCache.has(key)) {
    return { client: _clientCache.get(key), config: cfg };
  }
  // Si adminApiKey está disponible, pasarla al factory (DR-2).
  // I-103.A0: usar _resolveAdminApiKey() (jerarquía secrets.enc > env).
  var resolvedAdmin = _resolveAdminApiKey();
  var adminKey = resolvedAdmin ? resolvedAdmin.key : null;
  var client = _clientFactory({
    baseUrl: cfg.url,
    apiKey: cfg.apiKey,
    clientInstanceId: cfg.clientInstanceId,
    adminApiKey: adminKey,
    appVersion: _appVersion
  });
  _clientCache.set(key, client);
  return { client: client, config: cfg };
}

/**
 * Invalida TODA la cache de clientes per-empresa. Llamar cuando cambia
 * secrets.enc (set-api-key, set-url, set-admin-key).
 */
function _invalidateAllClients() {
  _clientCache.clear();
  _cachedClient = null;
  _cachedClientConfigKey = null;
}

/**
 * Invalida SOLO el cliente de una empresa específica. Llamar cuando
 * se hace rotate/revoke de una empresa (DR-6.D).
 */
function _invalidateClientForCompany(companyName) {
  if (!companyName) {
    _invalidateAllClients();
    return;
  }
  // Encontrar todas las keys que matcheen la empresa (puede haber variaciones
  // de normalización). Lo más simple: invalidar TODA la cache. Rotate es
  // raro y la invalidación completa es segura.
  _clientCache.clear();
}

// =====================================================================
//  VALIDATION HELPERS
// =====================================================================

function _validateUrl(url) {
  if (typeof url !== 'string' || url.length === 0) {
    return { ok: false, message: 'URL requerida' };
  }
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, message: 'URL debe empezar con http:// o https://' };
  }
  try {
    var u = new URL(url);
    if (!u.hostname) {
      return { ok: false, message: 'URL sin hostname válido' };
    }
    return { ok: true, url: url.replace(/\/+$/, '') };
  } catch (e) {
    return { ok: false, message: 'URL inválida: ' + e.message };
  }
}

function _validateApiKey(key) {
  if (typeof key !== 'string' || key.length === 0) {
    return { ok: false, message: 'apiKey requerida' };
  }
  if (key.length < 16) {
    return { ok: false, message: 'apiKey demasiado corta (mín 16 chars)' };
  }
  return { ok: true };
}

// =====================================================================
//  HANDLERS
// =====================================================================

function _handlerConfigGet() {
  var cfg = _resolveConfig();
  var s2 = _readSecretsV2();
  return _ok({
    // Campos v1 (compat con renderer v0.1.190)
    url: cfg.url,
    clientInstanceId: cfg.clientInstanceId,
    hasApiKey: cfg.hasApiKey,
    hasUrl: cfg.hasUrl,
    encryptionAvailable: cfg.encryptionAvailable,
    source: cfg.source,
    // Campos v2 (nuevos — para que la UI legacy tenga info mínima)
    schemaVersion: s2 ? SECRETS_VERSION : 0,
    hasLegacyKey: !!(s2 && s2.__legacy__)
  });
}

function _handlerConfigSetApiKey(args) {
  args = args || {};
  var v = _validateApiKey(args.apiKey);
  if (!v.ok) {
    return _err('INVALID_REQUEST_BODY', v.message);
  }
  if (!safeStorage || !safeStorage.isEncryptionAvailable || !safeStorage.isEncryptionAvailable()) {
    return _err('ENCRYPTION_UNAVAILABLE', 'safeStorage no disponible en este OS. Configure FIRMA_SERVICE_API_KEY en env (solo dev/CI).', {
      hint: 'Linux requiere libsecret + gnome-keyring o kwallet. Ver I-101 §5.'
    });
  }
  var existing = _readSecretsV2() || _emptySecretsV2();
  // LEGACY compat: en K+AIR v0.1.190, firma:config:set-api-key guardaba la key
  // global plana. En v0.1.191+ con secrets.enc v2, escribimos a
  // `empresas["__default__"]` con WARN. Los handlers per-empresa NUNCA
  // consultan `__default__` — es solo transporte para no romper el renderer
  // v0.1.190. El user debe migrar a firma:empresa:set-api-key (renderer v0.1.192+).
  if (!existing.empresas) existing.empresas = {};
  existing.empresas['__default__'] = {
    idEmpresa: '__default__',
    firmaApiKey: args.apiKey,
    activatedAt: new Date().toISOString(),
    lastValidatedAt: null,
    _legacy: true  // marca explícita de compat v0.1.190
  };
  var res = _writeSecrets(existing);
  if (!res.ok) {
    return _err('INTERNAL', 'Error escribiendo secrets.enc: ' + (res.error || 'unknown'));
  }
  _invalidateAllClients();
  console.warn(
    '[' + MOD + '] DEPRECATION: firma:config:set-api-key usado. ' +
    'Migra a firma:empresa:set-api-key (K+AIR v0.1.192+). ' +
    'La key se guardó en empresas["__default__"] (LEGACY compat).'
  );
  return _ok({
    stored: true,
    encryptionAvailable: res.encryptionAvailable,
    deprecationWarning: 'firma:config:set-api-key está deprecado. Use firma:empresa:set-api-key (K+AIR v0.1.192+).'
  });
}

function _handlerConfigSetUrl(args) {
  args = args || {};
  var v = _validateUrl(args.url);
  if (!v.ok) {
    return _err('INVALID_REQUEST_BODY', v.message);
  }
  var existing = _readSecretsV2() || _emptySecretsV2();
  existing.version = SECRETS_VERSION;
  existing.firmaServiceUrl = v.url;
  if (!existing.firmaServiceClientInstanceId) {
    existing.firmaServiceClientInstanceId = _generateClientInstanceIdFn();
  }
  if (safeStorage && safeStorage.isEncryptionAvailable && safeStorage.isEncryptionAvailable()) {
    var res = _writeSecrets(existing);
    if (!res.ok) {
      return _err('INTERNAL', 'Error escribiendo secrets.enc: ' + (res.error || 'unknown'));
    }
  } else if (process.env.FIRMA_SERVICE_URL) {
    return _ok({ url: v.url, source: 'env', note: 'FIRMA_SERVICE_URL en env tiene precedencia' });
  } else {
    return _err('ENCRYPTION_UNAVAILABLE', 'safeStorage no disponible; no se puede persistir URL.', {
      hint: 'Configure FIRMA_SERVICE_URL en env (solo dev/CI).'
    });
  }
  _invalidateAllClients();
  return _ok({ url: v.url });
}

function _handlerConfigDiag() {
  var cfg = _resolveConfig();
  var s2 = _readSecretsV2();
  return _ok({
    url: cfg.url,
    clientInstanceId: cfg.clientInstanceId,
    hasApiKey: cfg.hasApiKey,
    hasUrl: cfg.hasUrl,
    encryptionAvailable: cfg.encryptionAvailable,
    env: {
      hasUrl: !!process.env.FIRMA_SERVICE_URL,
      hasApiKey: !!process.env.FIRMA_SERVICE_API_KEY,
      hasClientId: !!process.env.FIRMA_SERVICE_CLIENT_INSTANCE_ID
    },
    secretsPath: _secretsPath(),
    secretsExists: (function () {
      var p = _secretsPath();
      return p ? fs.existsSync(p) : false;
    })(),
    source: cfg.source,
    // Nuevos campos v2:
    schemaVersion: s2 ? SECRETS_VERSION : 0,
    configuredEmpresas: s2 ? Object.keys(s2.empresas || {}).filter(function (k) {
      return k !== '__default__';
    }).length : 0,
    availableEmpresas: 0,  // requiere DB lookup — fuera de diag (lo calcula firma:empresa:list)
    hasLegacyKey: !!(s2 && s2.__legacy__),
    cacheStats: {
      size: _clientCache.size,
      maxSize: 50
    }
  });
}

function _requireClient() {
  _diagLog('requireClient.ENTER');
  var r = _getClient();
  if (!r.client) {
    _diagLog('requireClient.exit', {
      outcome: 'CONFIG_MISSING',
      source: r.config && r.config.source,
      hasApiKey: r.config && r.config.hasApiKey === true,
      hasUrl: r.config && r.config.hasUrl === true
    });
    return {
      ok: false,
      response: _err('CONFIG_MISSING', 'firma-service no configurado. Configure URL + API key primero.', {
        hint: 'Use firma:config:set-url y firma:config:set-api-key, o env FIRMA_SERVICE_URL + FIRMA_SERVICE_API_KEY',
        currentSource: r.config.source,
        hasApiKey: r.config.hasApiKey,
        hasUrl: r.config.hasUrl
      })
    };
  }
  _diagLog('requireClient.exit', {
    outcome: 'OK',
    source: r.config && r.config.source
  });
  return { ok: true, client: r.client, config: r.config };
}

/**
 * Helper: resuelve el cliente a usar. Si args.companyName está presente,
 * usa el cache per-empresa (DR-1: cada empresa usa su propia key).
 * Si NO está, fallback al modo LEGACY (env/secrets single).
 * Retorna { client, config, source } o un error response.
 */
function _resolveClientForRequest(args) {
  _diagLog('resolveClientForRequest.ENTER', {
    companyName_present: !!(args && args.companyName && args.companyName.length > 0),
    companyName_length: args && args.companyName ? args.companyName.length : 0
  });
  if (args && typeof args.companyName === 'string' && args.companyName.length > 0) {
    // Modo per-empresa (K+AIR v0.1.191+)
    // Primero verificar que firma-service esté configurado a nivel global.
    var s2 = _readSecretsV2();
    var urlOk = s2 && s2.firmaServiceUrl;
    if (!urlOk) {
      _diagLog('resolveClientForRequest.exit', {
        outcome: 'CONFIG_MISSING',
        reason: 'sin URL en secrets.enc',
        companyName: args.companyName,
        s2_null: !s2
      });
      return {
        ok: false,
        response: _err('CONFIG_MISSING',
          'firma-service no configurado (sin URL). Use firma:config:set-url primero.', {
            hint: 'firma:config:set-url',
            companyName: args.companyName
          })
      };
    }
    var r = _getClientForCompany(args.companyName);
    if (!r.client) {
      _diagLog('resolveClientForRequest.exit', {
        outcome: 'CONFIG_MISSING',
        reason: '_getClientForCompany no retornó client',
        companyName: args.companyName,
        r_config_source: r.config && r.config.source
      });
      return {
        ok: false,
        response: _err('CONFIG_MISSING',
          'Firma no configurada para empresa "' + args.companyName + '". Use firma:empresa:set-api-key o firma:empresa:create.', {
            hint: 'firma:empresa:set-api-key o firma:empresa:create',
            companyName: args.companyName
          })
      };
    }
    _diagLog('resolveClientForRequest.exit', {
      outcome: 'OK',
      path: 'per-empresa',
      companyName: args.companyName,
      companyKey: r.config && r.config.companyKey,
      idEmpresa: r.config && r.config.idEmpresa,
      firmaApiKey_present: !!(r.config && r.config.apiKey && r.config.apiKey.length > 0),
      firmaApiKey_length: r.config && r.config.apiKey ? r.config.apiKey.length : 0,
      url_present: !!(r.config && r.config.url && r.config.url.length > 0)
    });
    return { ok: true, client: r.client, config: r.config, source: 'per-empresa' };
  }
  // Modo LEGACY (renderer v0.1.190 con firma:config:set-api-key)
  _diagLog('resolveClientForRequest.exit', {
    outcome: 'legacy_path',
    reason: 'sin companyName en args'
  });
  return _requireClient();
}

function _handlerSignRequestCreate(args) {
  args = args || {};
  // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL — NO COMMITEAR
  var _md = args.metadata || {};
  _diagLog('handlerSignRequestCreate.ENTER', {
    args_companyName_present: !!(args.companyName && args.companyName.length > 0),
    args_companyName_length: args.companyName ? args.companyName.length : 0,
    args_metadata_present: !!args.metadata,
    args_metadata_typeof: typeof args.metadata,
    args_metadata_keys: args.metadata && typeof args.metadata === 'object' ? Object.keys(args.metadata) : [],
    args_metadata_id_documento_present: !!(_md.id_documento),
    args_metadata_id_documento_length: (_md.id_documento || '').length,
    args_metadata_id_trabajador_present: !!(_md.id_trabajador),
    args_metadata_id_trabajador_length: (_md.id_trabajador || '').length,
    args_metadata_id_empresa_present: !!(_md.id_empresa),
    args_metadata_id_empresa_length: (_md.id_empresa || '').length,
    args_metadata_tipo_firma_present: !!(_md.tipo_firma),
    args_metadata_tipo_firma_value: _md.tipo_firma || null,
    args_metadata_agreement_hash_present: !!(_md.agreement_hash),
    args_metadata_agreement_hash_length: (_md.agreement_hash || '').length,
    args_metadata_ttl_horas_present: !!(_md.ttl_horas),
    args_metadata_ttl_horas_value: _md.ttl_horas || null,
    args_metadata_metadata_present: !!(_md.metadata),
    args_metadata_metadata_keys: _md.metadata && typeof _md.metadata === 'object' ? Object.keys(_md.metadata) : [],
    args_pdfBuffer_present: !!args.pdfBuffer,
    args_pdfBuffer_typeof: typeof args.pdfBuffer,
    args_pdfBuffer_constructor: args.pdfBuffer ? (args.pdfBuffer.constructor && args.pdfBuffer.constructor.name) : null,
    args_pdfBuffer_isBuffer: !!(args.pdfBuffer && Buffer.isBuffer(args.pdfBuffer)),
    args_pdfBuffer_isUint8Array: !!(args.pdfBuffer && typeof Uint8Array !== 'undefined' && args.pdfBuffer instanceof Uint8Array),
    args_pdfBuffer_isArrayBuffer: !!(args.pdfBuffer && typeof ArrayBuffer !== 'undefined' && args.pdfBuffer instanceof ArrayBuffer),
    args_pdfBuffer_isArray: !!(args.pdfBuffer && Array.isArray(args.pdfBuffer)),
    args_pdfBuffer_length: args.pdfBuffer ? (args.pdfBuffer.length || (typeof args.pdfBuffer === 'string' ? args.pdfBuffer.length : 0)) : 0,
    args_pdfBuffer_byteLength: args.pdfBuffer && typeof args.pdfBuffer.byteLength === 'number' ? args.pdfBuffer.byteLength : null,
    args_pdfBuffer_keys: args.pdfBuffer && typeof args.pdfBuffer === 'object' ? Object.keys(args.pdfBuffer).slice(0, 10) : [],
    args_pdfBuffer_has_type_field: !!(args.pdfBuffer && args.pdfBuffer.type),
    args_pdfBuffer_type_field: args.pdfBuffer && args.pdfBuffer.type ? String(args.pdfBuffer.type) : null,
    args_pdfBuffer_has_data_field: !!(args.pdfBuffer && args.pdfBuffer.data),
    args_pdfBuffer_data_field_isArray: !!(args.pdfBuffer && Array.isArray(args.pdfBuffer.data)),
    args_pdfBuffer_data_field_length: args.pdfBuffer && args.pdfBuffer.data && args.pdfBuffer.data.length ? args.pdfBuffer.data.length : null,
    args_pdfBase64_present: !!(args.pdfBase64 && args.pdfBase64.length > 0),
    args_pdfName_present: !!(args.pdfName && args.pdfName.length > 0),
    args_keys: Object.keys(args || {})
  });
  if (!args.metadata) {
    _diagLog('handlerSignRequestCreate.exit', {
      outcome: 'INVALID_REQUEST_BODY',
      reason: 'metadata faltante',
      source: 'bridge'
    });
    return _err('INVALID_REQUEST_BODY', 'metadata requerida');
  }
  var r = _resolveClientForRequest(args);
  if (!r.ok) {
    _diagLog('handlerSignRequestCreate.exit', {
      outcome: r.response && r.response.error && r.response.error.code,
      error_message: r.response && r.response.error && r.response.error.message,
      error_hint: r.response && r.response.error && r.response.error.hint,
      currentSource: r.response && r.response.error && r.response.error.currentSource,
      hasApiKey: r.response && r.response.error && r.response.error.hasApiKey,
      hasUrl: r.response && r.response.error && r.response.error.hasUrl,
      companyName_param: r.response && r.response.error && r.response.error.companyName,
      source: 'bridge'
    });
    return r.response;
  }
  // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL — NO COMMITEAR
  _diagLog('handlerSignRequestCreate.resolve', {
    outcome: 'OK',
    path: r.config && r.config.source,
    companyName: args.companyName,
    idEmpresa: r.config && r.config.idEmpresa,
    firmaApiKey_present: !!(r.config && r.config.apiKey),
    firmaApiKey_length: r.config && r.config.apiKey ? r.config.apiKey.length : 0,
    firmaServiceUrl_present: !!(r.config && r.config.url)
  });
  // Aceptar pdfBase64 (string) o pdfBuffer (Buffer). Convertir a Buffer
  // antes de pasar al client para que el contrato sea uniforme.
  // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL — NO COMMITEAR
  // Inspecciona el tipo real de args.pdfBuffer JUSTO antes de la validación
  // para confirmar si llega como Buffer, Uint8Array, ArrayBuffer, objeto
  // serializado {type:"Buffer",data:[...]} u otra estructura.
  _diagLog('handlerSignRequestCreate.pdfBufferInspect', {
    pdfBuffer_present: !!args.pdfBuffer,
    pdfBuffer_typeof: typeof args.pdfBuffer,
    pdfBuffer_constructor: args.pdfBuffer && args.pdfBuffer.constructor ? args.pdfBuffer.constructor.name : null,
    pdfBuffer_isBuffer: !!(args.pdfBuffer && Buffer.isBuffer(args.pdfBuffer)),
    pdfBuffer_isUint8Array: !!(args.pdfBuffer && typeof Uint8Array !== 'undefined' && args.pdfBuffer instanceof Uint8Array),
    pdfBuffer_isArrayBuffer: !!(args.pdfBuffer && typeof ArrayBuffer !== 'undefined' && args.pdfBuffer instanceof ArrayBuffer),
    pdfBuffer_isArray: !!(args.pdfBuffer && Array.isArray(args.pdfBuffer)),
    pdfBuffer_length: args.pdfBuffer ? (args.pdfBuffer.length || 0) : 0,
    pdfBuffer_byteLength: args.pdfBuffer && typeof args.pdfBuffer.byteLength === 'number' ? args.pdfBuffer.byteLength : null,
    pdfBuffer_keys_first10: args.pdfBuffer && typeof args.pdfBuffer === 'object' ? Object.keys(args.pdfBuffer).slice(0, 10) : [],
    pdfBuffer_has_type_field: !!(args.pdfBuffer && args.pdfBuffer.type),
    pdfBuffer_type_field: args.pdfBuffer && args.pdfBuffer.type ? String(args.pdfBuffer.type) : null,
    pdfBuffer_has_data_field: !!(args.pdfBuffer && args.pdfBuffer.data),
    pdfBuffer_data_isArray: !!(args.pdfBuffer && Array.isArray(args.pdfBuffer.data)),
    pdfBuffer_data_length: args.pdfBuffer && args.pdfBuffer.data && args.pdfBuffer.data.length ? args.pdfBuffer.data.length : null,
    pdfBase64_present: !!(args.pdfBase64 && args.pdfBase64.length > 0),
    pdfBase64_typeof: typeof args.pdfBase64,
    pdfBase64_length: args.pdfBase64 ? args.pdfBase64.length : 0,
    will_take_Buffer_branch: !!(args.pdfBuffer && Buffer.isBuffer(args.pdfBuffer)),
    will_take_pdfBase64_branch: !(args.pdfBuffer && Buffer.isBuffer(args.pdfBuffer)) && typeof args.pdfBase64 === 'string' && args.pdfBase64.length > 0,
    will_take_else_branch: !(args.pdfBuffer && Buffer.isBuffer(args.pdfBuffer)) && !(typeof args.pdfBase64 === 'string' && args.pdfBase64.length > 0)
  });
  var pdfBuffer;
  if (Buffer.isBuffer(args.pdfBuffer)) {
    pdfBuffer = args.pdfBuffer;
  } else if (args.pdfBuffer && typeof Uint8Array !== 'undefined' && args.pdfBuffer instanceof Uint8Array) {
    // I-103.A1.5.4-B · FIX: aceptar Uint8Array. Electron serializa Buffer
    // a Uint8Array al cruzar el puente IPC, así que el renderer envía un
    // Uint8Array con los bytes del PDF. Buffer.from(uint8array) copia los
    // datos tal cual a un Buffer nativo. Compatible con el contrato de
    // firma-service (sigue recibiendo un Buffer).
    try {
      pdfBuffer = Buffer.from(args.pdfBuffer);
      _diagLog('handlerSignRequestCreate.pdfBufferConverted', {
        from_type: 'Uint8Array',
        from_byteLength: args.pdfBuffer.byteLength,
        to_buffer_length: pdfBuffer.length,
        to_isBuffer: Buffer.isBuffer(pdfBuffer)
      });
    } catch (e) {
      _diagLog('handlerSignRequestCreate.exit', {
        outcome: 'INVALID_REQUEST_BODY',
        reason: 'Uint8Array inválido: ' + e.message,
        source: 'bridge'
      });
      return _err('INVALID_REQUEST_BODY', 'pdfBuffer (Uint8Array) inválido: ' + e.message);
    }
  } else if (typeof args.pdfBase64 === 'string' && args.pdfBase64.length > 0) {
    try {
      pdfBuffer = Buffer.from(args.pdfBase64, 'base64');
    } catch (e) {
      _diagLog('handlerSignRequestCreate.exit', {
        outcome: 'INVALID_REQUEST_BODY',
        reason: 'pdfBase64 inválido: ' + e.message,
        source: 'bridge'
      });
      return _err('INVALID_REQUEST_BODY', 'pdfBase64 inválido: ' + e.message);
    }
  } else {
    _diagLog('handlerSignRequestCreate.exit', {
      outcome: 'INVALID_REQUEST_BODY',
      reason: 'sin pdfBuffer, Uint8Array ni pdfBase64',
      source: 'bridge'
    });
    return _err('INVALID_REQUEST_BODY', 'pdfBuffer, Uint8Array o pdfBase64 requerido');
  }
  // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL — NO COMMITEAR
  // Log pre-HTTP: hash de la API key, URL, endpoint, método. NO se loguea la key.
  try {
    var _cryptoMod = require('crypto');
    var _apiKeyHash = r.config && r.config.apiKey
      ? _cryptoMod.createHash('sha256').update(r.config.apiKey).digest('hex').slice(0, 8)
      : null;
    _diagLog('handlerSignRequestCreate.aboutToHttp', {
      apiKeyHashPrefix: _apiKeyHash,
      apiKey_length: r.config && r.config.apiKey ? r.config.apiKey.length : 0,
      url: r.config && r.config.url,
      endpoint: '/internal/sign-requests',
      method: 'POST',
      id_empresa_in_metadata: _md.id_empresa || null,
      tipo_firma_in_metadata: _md.tipo_firma || null,
      agreement_hash_in_metadata_present: !!_md.agreement_hash,
      agreement_hash_in_metadata_length: (_md.agreement_hash || '').length,
      pdfBuffer_length: pdfBuffer.length
    });
  } catch (_diagE) { /* noop */ }
  return Promise.resolve(r.client.createSignRequest({
    metadata: args.metadata,
    pdfBuffer: pdfBuffer,
    pdfName: args.pdfName || 'documento.pdf'
  })).then(function (resp) {
    // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL — NO COMMITEAR
    var _err = resp && resp.error;
    _diagLog('handlerSignRequestCreate.afterHttp', {
      success: !!(resp && resp.success),
      error_code: _err && _err.code,
      error_message: _err && _err.message,
      httpStatus: _err && _err.details && _err.details.httpStatus,
      has_data: !!(resp && resp.data),
      has_id_solicitud: !!(resp && resp.data && (resp.data.id_solicitud || resp.data.id)),
      has_url_publica: !!(resp && resp.data && resp.data.url_publica),
      id_solicitud: resp && resp.data && (resp.data.id_solicitud || resp.data.id),
      validation_error_names: _err && _err.details && _err.details.missing,
      validation_error_codes: _err && _err.details && _err.details.validationErrors
    });
    return resp;
  }).catch(function (err) {
    _diagLog('handlerSignRequestCreate.afterHttp', {
      success: false,
      exception: err && err.message
    });
    throw err;
  });
}

function _handlerSignRequestGet(args) {
  args = args || {};
  if (!args.id) {
    return _err('INVALID_REQUEST_BODY', 'id requerido');
  }
  var r = _resolveClientForRequest(args);
  if (!r.ok) return r.response;
  return r.client.getSignRequest(args.id);
}

// -------- firma:sign-request:eventos --------
// Línea de tiempo de auditoría (Trazabilidad del expediente).
function _handlerSignRequestEventos(args) {
  args = args || {};
  if (!args.id) {
    return _err('INVALID_REQUEST_BODY', 'id requerido');
  }
  var r = _resolveClientForRequest(args);
  if (!r.ok) return r.response;
  return r.client.getSignRequestEvents(args.id);
}

function _handlerSignRequestList(args) {
  args = args || {};
  if (!Array.isArray(args.ids) || args.ids.length === 0) {
    return _err('INVALID_REQUEST_BODY', 'ids[] requerido');
  }
  var r = _resolveClientForRequest(args);
  if (!r.ok) return r.response;
  return r.client.listSignRequests(args.ids);
}

function _handlerSignRequestDocument(args) {
  args = args || {};
  if (!args.id) {
    return _err('INVALID_REQUEST_BODY', 'id requerido');
  }
  // Verifica cache local primero. Si existe, NO llama al backend.
  // (Caché operativa, no confundir con el futuro expediente probatorio local.)
  var cacheDir = path.join(_app && _app.getPath ? _app.getPath('userData') : '', 'firma-cache');
  var rutaArchivo = path.join(cacheDir, args.id + '-firmado.pdf');
  if (cacheDir && (() => { try { return fs.existsSync(rutaArchivo); } catch (_) { return false; } })()) {
    return Promise.resolve({ success: true, data: { rutaArchivo: rutaArchivo, desdeCache: true } });
  }
  var r = _resolveClientForRequest(args);
  if (!r.ok) {
    return r.response;
  }
  return r.client.getSignRequestDocument(args.id).then(function (result) {
    if (!result.success) return result;
    try {
      if (cacheDir) fs.mkdirSync(cacheDir, { recursive: true });
      var pdfBytes = Buffer.from(result.data.base64, 'base64');
      fs.writeFileSync(rutaArchivo, pdfBytes);
      return { success: true, data: { rutaArchivo: rutaArchivo, desdeCache: false } };
    } catch (e) {
      return _err('CACHE_WRITE_FAILED', 'No se pudo escribir cache local: ' + e.message);
    }
  });
}

function _handlerSignRequestConstancia(args) {
  args = args || {};
  if (!args.id) {
    return _err('INVALID_REQUEST_BODY', 'id requerido');
  }
  var r = _resolveClientForRequest(args);
  if (!r.ok) return r.response;
  return r.client.getSignRequestConstancia(args.id);
}

/**
 * I-104 (SaveAs): handler que obtiene la constancia del backend y la
 * guarda en disco vía dialog.showSaveDialog(). El renderer NO recibe
 * bytes; solo recibe la ruta final. Si el usuario cancela, retorna
 * { success: false, canceled: true }.
 */
function _handlerSignRequestConstanciaSaveAs(args) {
  args = args || {};
  if (!args.id) {
    return _err('INVALID_REQUEST_BODY', 'id requerido');
  }
  var r = _resolveClientForRequest(args);
  if (!r.ok) return r.response;
  return r.client.getSignRequestConstancia(args.id).then(async function (result) {
    if (!result.success) return result;
    var saveResult = await dialog.showSaveDialog({
      title: 'Guardar constancia de firma',
      defaultPath: args.id + '-constancia.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (saveResult.canceled || !saveResult.filePath) {
      return { success: false, canceled: true };
    }
    try {
      var pdfBytes = Buffer.from(result.data.base64, 'base64');
      fs.writeFileSync(saveResult.filePath, pdfBytes);
      return { success: true, data: { rutaArchivo: saveResult.filePath } };
    } catch (e) {
      return _err('WRITE_FAILED', 'No se pudo escribir el archivo: ' + e.message);
    }
  });
}

/**
 * Constancia GENERAL del expediente (SaveAs): pide al backend el PDF
 * consolidado de TODAS las solicitudes del trabajador (generado al vuelo)
 * y lo guarda vía dialog.showSaveDialog(). Mismo patrón que
 * _handlerSignRequestConstanciaSaveAs; el renderer solo recibe la ruta.
 * `args.id` = cédula del trabajador (identificador del expediente).
 */
function _handlerExpedienteConstanciaSaveAs(args) {
  args = args || {};
  if (!args.id) {
    return _err('INVALID_REQUEST_BODY', 'id (cédula del trabajador) requerido');
  }
  var r = _resolveClientForRequest(args);
  if (!r.ok) return r.response;
  return r.client.getExpedienteConstanciaConsolidada(args.id, { titulos: args.titulos || null }).then(async function (result) {
    if (!result.success) return result;
    var saveResult = await dialog.showSaveDialog({
      title: 'Guardar constancia general del expediente',
      defaultPath: 'expediente-' + args.id + '-constancia-consolidada.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (saveResult.canceled || !saveResult.filePath) {
      return { success: false, canceled: true };
    }
    try {
      var pdfBytes = Buffer.from(result.data.base64, 'base64');
      fs.writeFileSync(saveResult.filePath, pdfBytes);
      return { success: true, data: { rutaArchivo: saveResult.filePath } };
    } catch (e) {
      return _err('WRITE_FAILED', 'No se pudo escribir el archivo: ' + e.message);
    }
  });
}

function _handlerSignRequestLink(args) {
  args = args || {};
  if (!args.id) {
    return _err('INVALID_REQUEST_BODY', 'id requerido');
  }
  var r = _resolveClientForRequest(args);
  if (!r.ok) return r.response;
  return r.client.getSignRequestLink(args.id);
}

// I-103.A1.5.2 · firma:sign-request:notify-remote
// Handler para POST /internal/sign-requests/:id/notify-remote en firma-service.
// Patrón idéntico a los otros sign-request handlers: valida, delega al client.
// El client resuelve la per-empresa authz via _resolveClientForRequest() —
// NO toca _resolveClientForRequest ni la infra per-empresa.
//
// Valida:
//   - args.id: requerido (string o entero)
//   - args.correo: requerido (string no vacío, formato básico con @)
//
// NO valida formato estricto de correo (eso lo hace zod en el backend con
// .email()). Acá solo evitamos 400 triviales por typo antes del HTTP.
function _handlerSignRequestNotifyRemote(args) {
  args = args || {};
  if (!args.id) {
    return _err('INVALID_REQUEST_BODY', 'id requerido');
  }
  if (typeof args.correo !== 'string' || args.correo.length === 0) {
    return _err('INVALID_REQUEST_BODY', 'correo requerido (string)');
  }
  if (!args.correo.includes('@')) {
    return _err('INVALID_REQUEST_BODY', 'correo inválido (sin @)');
  }
  var r = _resolveClientForRequest(args);
  if (!r.ok) return r.response;
  return r.client.notifySignRequestRemote(args.id, {
    correo: args.correo,
    context: args.context && typeof args.context === 'object' ? args.context : undefined
  });
}

// I-103.A1.6.B · firma:sign-request:resend-otp
// Handler para POST /internal/sign-requests/:id/resend-otp en firma-service.
// Wrapper per-empresa de publicFlow.resendOtp() (mismo endpoint público
// /api/sign/:token/resend-otp pero con auth X-Internal-API-Key).
//
// Patrón idéntico a _handlerSignRequestNotifyRemote: solo valida args.id
// (no requiere cuerpo — el endpoint acepta body vacío), delega al client
// per-empresa. El backend gestiona estado, rate-limit, OTP_NOT_EXPIRED,
// generación atómica, invalidación del OTP anterior y envío.
//
// El renderer NO debe ver el OTP en ningún caso; el response solo trae
// estado, otp_ttl_seconds y correo_destino_enmascarado.
function _handlerSignRequestResendOtp(args) {
  args = args || {};
  if (!args.id) {
    return _err('INVALID_REQUEST_BODY', 'id requerido');
  }
  var r = _resolveClientForRequest(args);
  if (!r.ok) return r.response;
  return r.client.resendSignRequestOtp(args.id, {
    companyName: args.companyName,
    context: args.context && typeof args.context === 'object' ? args.context : undefined
  });
}

function _handlerConsentCreate(args) {
  args = args || {};
  // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL — NO COMMITEAR
  _diagLog('handlerConsentCreate.ENTER', {
    args_companyName_present: !!(args && args.companyName && args.companyName.length > 0),
    args_companyName_length: args && args.companyName ? args.companyName.length : 0,
    args_id_trabajador_present: !!(args && args.id_trabajador),
    args_id_empresa_present: !!(args && args.id_empresa),
    args_id_empresa_length: args && args.id_empresa ? String(args.id_empresa).length : 0,
    args_version_acuerdo_present: !!(args && args.version_acuerdo),
    args_correo_verificacion_present: !!(args && args.correo_verificacion),
    args_correo_verificacion_length: args && args.correo_verificacion ? String(args.correo_verificacion).length : 0,
    args_kair_version_present: !!(args && args.kair_version),
    args_keys: Object.keys(args || {})
  });
  if (!args.id_trabajador || !args.id_empresa || !args.version_acuerdo || !args.correo_verificacion) {
    _diagLog('handlerConsentCreate.ERROR', {
      error_code: 'INVALID_REQUEST_BODY',
      reason: 'campos requeridos faltantes',
      missing: {
        id_trabajador: !args.id_trabajador,
        id_empresa: !args.id_empresa,
        version_acuerdo: !args.version_acuerdo,
        correo_verificacion: !args.correo_verificacion
      }
    });
    return _err('INVALID_REQUEST_BODY', 'id_trabajador, id_empresa, version_acuerdo, correo_verificacion requeridos');
  }
  var r = _resolveClientForRequest(args);
  if (!r.ok) {
    _diagLog('handlerConsentCreate.ERROR', {
      error_code: r.response && r.response.error && r.response.error.code,
      error_message: r.response && r.response.error && r.response.error.message,
      error_hint: r.response && r.response.error && r.response.error.hint,
      currentSource: r.response && r.response.error && r.response.error.currentSource,
      hasApiKey: r.response && r.response.error && r.response.error.hasApiKey,
      hasUrl: r.response && r.response.error && r.response.error.hasUrl,
      companyName_param: r.response && r.response.error && r.response.error.companyName
    });
    return r.response;
  }
  // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL — NO COMMITEAR
  _diagLog('handlerConsentCreate.resolve', {
    outcome: 'OK',
    path: r.config && r.config.source,
    companyName: args.companyName,
    idEmpresa: r.config && r.config.idEmpresa,
    firmaApiKey_present: !!(r.config && r.config.apiKey),
    firmaApiKey_length: r.config && r.config.apiKey ? r.config.apiKey.length : 0,
    firmaServiceUrl_present: !!(r.config && r.config.url)
  });
  // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL — NO COMMITEAR
  // Log pre-HTTP: hash de la API key, URL, endpoint, método. NO se loguea la key.
  try {
    var _cryptoMod = require('crypto');
    var _apiKeyHash = r.config && r.config.apiKey
      ? _cryptoMod.createHash('sha256').update(r.config.apiKey).digest('hex').slice(0, 8)
      : null;
    _diagLog('handlerConsentCreate.aboutToHttp', {
      apiKeyHashPrefix: _apiKeyHash,
      apiKey_length: r.config && r.config.apiKey ? r.config.apiKey.length : 0,
      url: r.config && r.config.url,
      endpoint: '/internal/consentimientos',
      method: 'POST',
      id_empresa_sent: args.id_empresa
    });
  } catch (_diagE) { /* noop */ }
  return r.client.createConsent({
    id_trabajador: args.id_trabajador,
    id_empresa: args.id_empresa,
    version_acuerdo: args.version_acuerdo,
    correo_verificacion: args.correo_verificacion,
    kair_version: args.kair_version || _appVersion
  }).then(function (result) {
    // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL — NO COMMITEAR
    _diagLog('handlerConsentCreate.OK', {
      success: !!(result && result.success),
      error_code: result && result.error && result.error.code,
      error_message: result && result.error && result.error.message,
      has_data: !!(result && result.data),
      httpStatus: result && result.error && result.error.details && result.error.details.httpStatus
    });
    return result;
  });
}

function _handlerConsentVerifyOtp(args) {
  args = args || {};
  if (!args.consentId || !args.otp) {
    return _err('INVALID_REQUEST_BODY', 'consentId y otp requeridos');
  }
  var r = _resolveClientForRequest(args);
  if (!r.ok) return r.response;
  return r.client.verifyConsentOtp(args.consentId, args.otp);
}

function _handlerAgreementGet(args) {
  args = args || {};
  // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL — NO COMMITEAR
  // Registra el estado de args + error completo (sin secretos) cuando falla.
  _diagLog('handlerAgreementGet.ENTER', {
    args_companyName_present: !!(args && args.companyName && args.companyName.length > 0),
    args_companyName_length: args && args.companyName ? args.companyName.length : 0,
    args_keys: Object.keys(args || {})
  });
  var r = _resolveClientForRequest(args);
  if (!r.ok) {
    _diagLog('handlerAgreementGet.ERROR', {
      error_code: r.response && r.response.error && r.response.error.code,
      error_message: r.response && r.response.error && r.response.error.message,
      error_hint: r.response && r.response.error && r.response.error.hint,
      currentSource: r.response && r.response.error && r.response.error.currentSource,
      hasApiKey: r.response && r.response.error && r.response.error.hasApiKey,
      hasUrl: r.response && r.response.error && r.response.error.hasUrl,
      companyName_param: r.response && r.response.error && r.response.error.companyName
    });
    return r.response;
  }
  _diagLog('handlerAgreementGet.OK', {
    source: r.config && r.config.source
  });
  // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL — NO COMMITEAR
  // Log del hash SHA-256 (8 chars) de la API key que se va a usar,
  // y de la URL. NO se loguea la key en plaintext.
  try {
    var _cryptoMod = require('crypto');
    var _apiKeyHash = r.config && r.config.apiKey
      ? _cryptoMod.createHash('sha256').update(r.config.apiKey).digest('hex').slice(0, 8)
      : null;
    _diagLog('handlerAgreementGet.aboutToHttp', {
      apiKeyHashPrefix: _apiKeyHash,
      apiKey_length: r.config && r.config.apiKey ? r.config.apiKey.length : 0,
      url: r.config && r.config.url
    });
  } catch (_diagE) { /* noop */ }
  return r.client.getActiveAgreement();
}

// -------- I-102.2.D · firma:documento:read-bytes --------
// Lee los bytes de un archivo (PDF) del disco local. Usado por la UI
// para calcular el document_hash antes de enviar el sign request.
// Validacion: archivo existe, es regular, no excede 50 MB.
function _handlerDocumentoReadBytes(args) {
  args = args || {};
  // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL — NO COMMITEAR
  _diagLog('handlerDocumentoReadBytes.ENTER', {
    args_rutaArchivo_present: !!(args && args.rutaArchivo),
    args_rutaArchivo_typeof: args && typeof args.rutaArchivo,
    args_rutaArchivo_length: (args && typeof args.rutaArchivo === 'string') ? args.rutaArchivo.length : 'n/a',
    args_rutaArchivo_isObject: !!(args && typeof args.rutaArchivo === 'object' && args.rutaArchivo !== null),
    args_keys: Object.keys(args || {})
  });
  if (!args.rutaArchivo || typeof args.rutaArchivo !== 'string') {
    return _err('INVALID_REQUEST_BODY', 'rutaArchivo requerido (string)');
  }
  try {
    if (!fs.existsSync(args.rutaArchivo)) {
      return _err('NOT_FOUND', 'Archivo no encontrado: ' + args.rutaArchivo);
    }
    var stat = fs.statSync(args.rutaArchivo);
    if (!stat.isFile()) {
      return _err('INVALID_INPUT', 'No es un archivo regular');
    }
    if (stat.size > 50 * 1024 * 1024) {
      return _err('PAYLOAD_TOO_LARGE', 'Archivo demasiado grande: ' + stat.size + ' bytes');
    }
    var buffer = fs.readFileSync(args.rutaArchivo);
    // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL — NO COMMITEAR
    // Inspecciona los primeros bytes del archivo ANTES de convertir a base64
    // para confirmar si el archivo en disco es realmente un PDF o si llega
    // otro tipo de contenido (JSON, ZIP, etc).
    try {
      var _first16 = buffer.length >= 16 ? buffer.subarray(0, 16) : buffer;
      var _last8 = buffer.length >= 8 ? buffer.subarray(buffer.length - 8) : buffer;
      var _firstAsciiSafe = _first16.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
      var _isPdf = buffer.length >= 5 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 && buffer[4] === 0x2D;
      var _isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B && (buffer[2] === 0x03 || buffer[2] === 0x05) && (buffer[3] === 0x04 || buffer[3] === 0x06);
      var _isJson = buffer.length >= 1 && (buffer[0] === 0x7B || buffer[0] === 0x5B);
      var _tailSlice = buffer.length > 1024 ? buffer.subarray(buffer.length - 1024) : buffer;
      var _hasEof = _tailSlice.indexOf(Buffer.from('%EOF', 'ascii')) !== -1 || _tailSlice.indexOf(Buffer.from('%%EOF', 'ascii')) !== -1;
      _diagLog('handlerDocumentoReadBytes.inspect', {
        buffer_length: buffer.length,
        buffer_constructor: buffer.constructor ? buffer.constructor.name : null,
        first_bytes_hex: _first16.toString('hex'),
        first_ascii_safe: _firstAsciiSafe,
        last_bytes_hex: _last8.toString('hex'),
        is_pdf_signature: _isPdf,
        is_zip_signature: _isZip,
        is_json_signature: _isJson,
        has_eof_marker: _hasEof,
        rutaArchivo_basename: args.rutaArchivo.split(/[\\/]/).pop()
      });
    } catch (_inspectE) { /* noop */ }
    return _ok({
      data: buffer.toString('base64'),
      bytes: buffer.length,
      contentType: 'application/pdf'
    });
  } catch (e) {
    console.error('[' + MOD + '][documento:read-bytes]', e.message);
    return _err('INTERNAL', e.message);
  }
}

// =====================================================================
//  HANDLERS — IPC per-empresa (firma:empresa:*) y admin (firma:config:set-admin-key)
//  DR-1..6, binding.
// =====================================================================

/**
 * Helper: lee secrets.enc v2 + URL del backend. Lanza CONFIG_MISSING si
 * no hay URL. Usado por handlers que llaman al backend (admin, sign-request).
 */
function _requireSecretsV2WithUrl() {
  var s2 = _readSecretsV2();
  if (!s2) {
    return { ok: false, response: _err('CONFIG_MISSING', 'secrets.enc no accesible.') };
  }
  if (!s2.firmaServiceUrl) {
    return { ok: false, response: _err('CONFIG_MISSING', 'firmaServiceUrl no configurado. Use firma:config:set-url.') };
  }
  return { ok: true, s2: s2 };
}

/**
 * I-103.A0 · Resuelve la adminApiKey con jerarquía:
 *   1) secrets.enc.adminApiKey (si existe)  ← fuente preferida
 *   2) process.env.FIRMA_SERVICE_ADMIN_KEY (fallback) ← solo dev/operación
 *   3) null (quien llama retorna ADMIN_TOKEN_REQUIRED)
 *
 * Retorna { key, source: 'secrets' | 'env' } o null. NUNCA expone el valor al
 * renderer — solo se usa internamente en el bridge. La UI ve el source y un
 * hash no-reversible (SHA-256[0:8]) para verificación.
 *
 * Loggea WARN una sola vez por boot si la key viene de env (para que el
 * operador sepa que está usando un fallback y no secrets.enc).
 */
var _adminKeyEnvWarned = false;
function _resolveAdminApiKey() {
  var s2 = _readSecretsV2();
  if (s2 && s2.adminApiKey) {
    return { key: s2.adminApiKey, source: 'secrets' };
  }
  if (process.env.FIRMA_SERVICE_ADMIN_KEY) {
    if (!_adminKeyEnvWarned) {
      console.warn('[' + MOD + '] adminApiKey no está en secrets.enc; usando process.env.FIRMA_SERVICE_ADMIN_KEY como fallback. Configure via firma:config:set-admin-key para uso persistente.');
      _adminKeyEnvWarned = true;
    }
    return { key: process.env.FIRMA_SERVICE_ADMIN_KEY, source: 'env' };
  }
  return null;
}

/**
 * I-103.A0 · Hash no-reversible de la adminApiKey para que la UI verifique
 * la key sin ver el secreto. SHA-256 primeros 8 chars hex.
 * NUNCA una porción de la key original (que sería reversible).
 */
function _hashAdminApiKey(key) {
  if (!key) return null;
  try {
    var cryptoMod = require('crypto');
    return cryptoMod.createHash('sha256').update(key).digest('hex').slice(0, 8);
  } catch (e) { return null; }
}

/**
 * Helper: valida que haya un adminApiKey configurado (DR-2). Si no, retorna
 * ADMIN_TOKEN_REQUIRED. Usa _resolveAdminApiKey() que prioriza secrets.enc
 * sobre env var (I-103.A0).
 */
function _requireAdminToken() {
  var resolved = _resolveAdminApiKey();
  if (!resolved) {
    return _err('ADMIN_TOKEN_REQUIRED', 'adminApiKey no configurado. Configure via firma:config:set-admin-key o FIRMA_SERVICE_ADMIN_KEY.', {
      remediationHint: 'firma:config:set-admin-key'
    });
  }
  return null;
}

/**
 * Helper: crea un FirmaClient temporal con adminApiKey, sin cachearlo.
 * Usado por handlers admin (create, list, rotate, revoke) que deben usar
 * SIEMPRE la adminApiKey actual.
 */
function _createAdminClient(url, clientInstanceId) {
  // I-103.A0: usar _resolveAdminApiKey() (jerarquía secrets.enc > env).
  var resolvedAdmin = _resolveAdminApiKey();
  var adminKey = resolvedAdmin ? resolvedAdmin.key : null;
  return _clientFactory({
    baseUrl: url,
    apiKey: '__admin__',  // dummy; el factory va a usar adminApiKey
    clientInstanceId: clientInstanceId,
    adminApiKey: adminKey,
    appVersion: _appVersion
  });
}

// -------- firma:empresa:list --------
// DR-3: retorna configured + available (NO expone la key, solo metadata).
function _handlerEmpresaList(args) {
  args = args || {};
  var s2 = _readSecretsV2();
  var url = (s2 && s2.firmaServiceUrl) || process.env.FIRMA_SERVICE_URL || '';
  var clientInstanceId = (s2 && s2.firmaServiceClientInstanceId) ||
    _generateClientInstanceIdFn();
  var empresas = (s2 && s2.empresas) || {};

  // configured: keys normales (excluye __default__ y __legacy__)
  var configured = Object.keys(empresas)
    .filter(function (k) { return k !== '__default__' && k !== '__legacy__'; })
    .map(function (k) {
      return {
        companyKey: k,
        idEmpresa: empresas[k].idEmpresa,
        activatedAt: empresas[k].activatedAt,
        lastValidatedAt: empresas[k].lastValidatedAt
      };
    });

  // I-103.A0 · Exponer source de adminApiKey + hash no-reversible a la UI.
  // El renderer usa esto para mostrar el badge "Configurada (secrets) | (env) | No configurada".
  // NUNCA exponemos el valor de la key (DR-2).
  var resolvedAdmin = _resolveAdminApiKey();
  var adminKeySource = resolvedAdmin ? resolvedAdmin.source : null;
  var adminKeyHashPrefix = resolvedAdmin ? _hashAdminApiKey(resolvedAdmin.key) : null;

  return _ok({
    configured: configured,
    available: [],  // requiere DB lookup; el renderer hace JOIN con tabla companies
    hasLegacyKey: !!(s2 && s2.__legacy__),
    legacyWarning: s2 && s2.__legacy__ ? s2.__legacy__.warning : null,
    firmaServiceUrl: url,
    clientInstanceId: clientInstanceId,
    source: _hasEnv() ? 'env' : 'secrets',
    encryptionAvailable: !!(safeStorage && safeStorage.isEncryptionAvailable && safeStorage.isEncryptionAvailable()),
    // I-103.A0 · Estado de la credencial administrativa (sin exponer el secret).
    adminKeySource: adminKeySource,           // 'secrets' | 'env' | null
    adminKeyHashPrefix: adminKeyHashPrefix    // SHA-256[0:8] hex | null
  });
}

// -------- firma:empresa:create --------
// DR-1: bridge llama al backend con adminApiKey. DR-3: api_key NO se propaga.
// DR-6.A: bridge mapea displayName → description.
// DR-6.B: bridge inyecta los 5 allowed_operations del enum I-010.
// DR-6.C: pre-chequea secrets.enc.empresas[companyName] antes de HTTP.
var _ALLOWED_OPS = Object.freeze([
  'sign_request:create',
  'sign_request:read',
  'consent:create',
  'consent:verify',
  'audit:read'
]);
function _handlerEmpresaCreate(args) {
  args = args || {};
  if (!args.companyName || typeof args.companyName !== 'string') {
    return _err('INVALID_REQUEST_BODY', 'companyName requerido (string)');
  }
  if (!args.idEmpresa || typeof args.idEmpresa !== 'string') {
    return _err('INVALID_REQUEST_BODY', 'idEmpresa requerido (string)');
  }
  if (!args.displayName || typeof args.displayName !== 'string') {
    return _err('INVALID_REQUEST_BODY', 'displayName requerido (string)');
  }
  var adminErr = _requireAdminToken();
  if (adminErr) return adminErr;
  var sec = _requireSecretsV2WithUrl();
  if (!sec.ok) return sec.response;

  // DR-6.C: pre-chequeo en secrets.enc ANTES de HTTP.
  var s2 = sec.s2;
  var found = _resolveEmpresa(s2.empresas, args.companyName);
  if (found) {
    return _err('ALREADY_CONFIGURED', 'Esta empresa ya tiene firma configurada.', {
      companyKey: found.companyKey,
      idEmpresa: found.entry.idEmpresa,
      suggestion: 'Use firma:empresa:rotate-api-key to rotate the existing key'
    });
  }

  // DR-6.A: bridge construye description pre-formateado.
  var description = 'K+AIR empresa ' + args.displayName + ' - ' + (_hasEnv() ? 'env' : (process.env.NODE_ENV || 'production'));
  if (description.length > 200) {
    description = description.slice(0, 197) + '...';
  }

  // DR-6.B: bridge inyecta los 5 ops del enum.
  var body = {
    id_empresa: args.idEmpresa,
    allowed_operations: _ALLOWED_OPS.slice(),
    description: description
  };

  // Llamar al backend
  var client = _createAdminClient(sec.s2.firmaServiceUrl, sec.s2.firmaServiceClientInstanceId);
  return Promise.resolve(client.adminCreateClient(body)).then(function (r) {
    if (!r.success) return r;
    // DR-3: guardar la api_key en secrets.enc, NO propagar al renderer.
    var newEntry = {
      idEmpresa: args.idEmpresa,
      firmaApiKey: r.data.api_key,  // SOLO en secrets.enc, NO en el response al renderer
      activatedAt: r.data.created_at,
      lastValidatedAt: null
    };
    s2.empresas[args.companyName] = newEntry;
    var w = _writeSecrets(s2);
    if (!w.ok) {
      return _err('INTERNAL', 'Error guardando key en secrets.enc: ' + (w.error || 'unknown'));
    }
    _invalidateAllClients();
    return _ok({
      created: true,
      companyKey: args.companyName,
      idEmpresa: args.idEmpresa,
      apiKeyHashPrefix: r.data.api_key_hash_prefix,  // 8 chars, NO la key completa
      activatedAt: newEntry.activatedAt
    });
  });
}

// -------- firma:empresa:set-api-key --------
// Modo "paste de key pre-existente". Guarda local + opcionalmente valida
// contra el backend (adminListClients, DR-6.D).
function _handlerEmpresaSetApiKey(args) {
  args = args || {};
  if (!args.companyName || typeof args.companyName !== 'string') {
    return _err('INVALID_REQUEST_BODY', 'companyName requerido (string)');
  }
  if (!args.idEmpresa || typeof args.idEmpresa !== 'string') {
    return _err('INVALID_REQUEST_BODY', 'idEmpresa requerido (string)');
  }
  if (!args.firmaApiKey || typeof args.firmaApiKey !== 'string') {
    return _err('INVALID_REQUEST_BODY', 'firmaApiKey requerido (string)');
  }
  if (args.firmaApiKey.length < 32) {
    return _err('INVALID_REQUEST_BODY', 'firmaApiKey demasiado corta (mín 32 chars)');
  }
  var sec = _requireSecretsV2WithUrl();
  if (!sec.ok) return sec.response;

  // DR-5: warning soft si la key no tiene prefijo kair_live_/kair_test_.
  var softWarning = null;
  if (!/^kair_(live|test)_/.test(args.firmaApiKey)) {
    softWarning = 'Key no tiene prefijo kair_live_/kair_test_ — se acepta por compat';
    console.warn('[' + MOD + '] Warning: apiKey sin prefijo estándar (no kair_live_/kair_test_). Continuando por compat...');
  }

  var s2 = sec.s2;
  var now = new Date().toISOString();
  s2.empresas[args.companyName] = {
    idEmpresa: args.idEmpresa,
    firmaApiKey: args.firmaApiKey,
    activatedAt: now,
    lastValidatedAt: null
  };
  var w = _writeSecrets(s2);
  if (!w.ok) {
    return _err('INTERNAL', 'Error guardando key en secrets.enc: ' + (w.error || 'unknown'));
  }
  _invalidateAllClients();

  // Si validateRemote=true, intentar adminListClients con la key.
  // (DR-6.D: usa admin endpoint; funcional porque tenemos adminApiKey).
  if (args.validateRemote === true) {
    var adminErr = _requireAdminToken();
    if (adminErr) {
      return _ok({
        stored: true,
        encryptionAvailable: w.encryptionAvailable,
        companyKey: args.companyName,
        idEmpresa: args.idEmpresa,
        activatedAt: now,
        softWarning: softWarning,
        remoteValidation: { ok: false, code: 'ADMIN_TOKEN_REQUIRED', message: 'No se pudo validar contra backend' }
      });
    }
    var adminClient = _createAdminClient(sec.s2.firmaServiceUrl, sec.s2.firmaServiceClientInstanceId);
    return Promise.resolve(adminClient.adminListClients({ id_empresa: args.idEmpresa })).then(function (r) {
      // La key del bridge NO se valida con adminListClients (es per-company key,
      // admin endpoint es admin-only). Lo que validamos es que el id_empresa
      // existe en el backend. (Si adminListClients responde 200, el id_empresa
      // es válido.)
      if (r.success) {
        s2.empresas[args.companyName].lastValidatedAt = new Date().toISOString();
        _writeSecrets(s2);
      }
      return _ok({
        stored: true,
        encryptionAvailable: w.encryptionAvailable,
        companyKey: args.companyName,
        idEmpresa: args.idEmpresa,
        activatedAt: now,
        lastValidatedAt: s2.empresas[args.companyName].lastValidatedAt,
        softWarning: softWarning,
        remoteValidation: { ok: r.success, error: r.success ? null : (r.error && r.error.code) }
      });
    });
  }

  return _ok({
    stored: true,
    encryptionAvailable: w.encryptionAvailable,
    companyKey: args.companyName,
    idEmpresa: args.idEmpresa,
    activatedAt: now,
    softWarning: softWarning
  });
}

// -------- firma:empresa:rotate-api-key --------
// DR-1: bridge llama adminRotateClient con adminApiKey.
// DR-4: V1 = revocar + crear nuevo (sin DELETE). La rotación marca la
//       key vieja como revocada en backend.
function _handlerEmpresaRotateApiKey(args) {
  args = args || {};
  if (!args.companyName || typeof args.companyName !== 'string') {
    _diagLog('rotateApiKey.entry', { outcome: 'INVALID_REQUEST_BODY', reason: 'companyName no es string' });
    return _err('INVALID_REQUEST_BODY', 'companyName requerido (string)');
  }
  _diagLog('rotateApiKey.entry', {
    companyName: args.companyName,
    motivo_present: !!(args.motivo && args.motivo.length > 0),
    actor_present: !!(args.actor && args.actor.length > 0)
  });
  var adminErr = _requireAdminToken();
  if (adminErr) {
    _diagLog('rotateApiKey.step', { step: 'adminToken', outcome: adminErr.error && adminErr.error.code });
    return adminErr;
  }
  var sec = _requireSecretsV2WithUrl();
  if (!sec.ok) {
    _diagLog('rotateApiKey.step', { step: 'secretsV2WithUrl', outcome: sec.response && sec.response.error && sec.response.error.code });
    return sec.response;
  }

  var s2 = sec.s2;
  var found = _resolveEmpresa(s2.empresas, args.companyName);
  if (!found) {
    _diagLog('rotateApiKey.step', {
      step: 'resolveEmpresa',
      outcome: 'CLIENT_NOT_FOUND',
      empresas_disponibles: Object.keys(s2.empresas || {}).map(function (k) {
        return { companyKey: k, idEmpresa: (s2.empresas[k] || {}).idEmpresa || null };
      })
    });
    return _err('CLIENT_NOT_FOUND', 'No hay firma configurada para esta empresa.', {
      companyKey: args.companyName,
      hint: 'Use firma:empresa:create o firma:empresa:set-api-key primero.'
    });
  }
  var oldIdEmpresa = found.entry.idEmpresa;
  _diagLog('rotateApiKey.step', {
    step: 'beforeHttp',
    companyName_encontrado: found.companyKey,
    idEmpresa: oldIdEmpresa,
    firmaApiKey_present: !!(found.entry.firmaApiKey && found.entry.firmaApiKey.length > 0),
    firmaApiKey_length: (found.entry.firmaApiKey || '').length,
    firmaServiceUrl_present: !!(sec.s2.firmaServiceUrl && sec.s2.firmaServiceUrl.length > 0)
  });

  // Llamar al backend
  var client = _createAdminClient(sec.s2.firmaServiceUrl, sec.s2.firmaServiceClientInstanceId);
  return Promise.resolve(client.adminRotateClient(oldIdEmpresa, {
    motivo: args.motivo || 'Rotación manual desde K+AIR',
    actor: args.actor || 'kair-bridge'
  })).then(function (r) {
    if (!r.success) {
      _diagLog('rotateApiKey.step', {
        step: 'httpResponse',
        outcome: 'ERROR',
        http_success: r.success,
        error_code: r.error && r.error.code,
        error_message: r.error && r.error.message
      });
      return r;
    }
    // Actualizar secrets.enc con la nueva key (DR-3: solo en secrets.enc).
    s2.empresas[found.companyKey] = {
      idEmpresa: oldIdEmpresa,
      firmaApiKey: r.data.new_api_key,  // SOLO en secrets.enc
      activatedAt: r.data.rotated_at,
      lastValidatedAt: s2.empresas[found.companyKey].lastValidatedAt
    };
    var w = _writeSecrets(s2);
    if (!w.ok) {
      _diagLog('rotateApiKey.step', { step: 'writeSecrets', outcome: 'INTERNAL', writeError: w.error || 'unknown' });
      return _err('INTERNAL', 'Error guardando key rotada en secrets.enc: ' + (w.error || 'unknown'));
    }
    _invalidateAllClients();
    _diagLog('rotateApiKey.done', {
      outcome: 'OK',
      companyKey: found.companyKey,
      idEmpresa: oldIdEmpresa,
      newApiKeyHashPrefix: r.data.new_api_key_hash_prefix,
      oldApiKeyHashPrefix: r.data.old_api_key_hash_prefix
    });
    return _ok({
      rotated: true,
      companyKey: found.companyKey,
      idEmpresa: oldIdEmpresa,
      newApiKeyHashPrefix: r.data.new_api_key_hash_prefix,
      oldApiKeyHashPrefix: r.data.old_api_key_hash_prefix,
      rotatedAt: r.data.rotated_at,
      motivo: r.data.motivo,
      actor: r.data.actor
    });
  });
}

// -------- firma:empresa:recover-and-rotate (I-104 RECOVERY) --------
// Resuelve el huevo-gallina: la empresa existe en el backend pero NO en
// secrets.enc.empresas. NO se puede usar firma:empresa:rotate-api-key porque
// requiere _resolveEmpresa(s2.empresas, companyName) (devuelve CLIENT_NOT_FOUND).
//
// Política de protección (orden estricto, aborta lo antes posible):
//   1. Validar args
//   2. Validar adminToken (si falla, aborta ANTES del rotate)
//   3. Validar secrets.enc con URL (si falla, aborta ANTES del rotate)
//   4. Validar safeStorage disponible (CRÍTICO: si no, aborta ANTES del rotate
//      para no perder la key generada por el backend)
//   5. Comprobar que la empresa NO exista localmente (si existe, retornar
//      ALREADY_CONFIGURED y sugerir usar rotate-api-key normal)
//   6. ⚠️ SOLO DESPUÉS de las 5 validaciones: llamar al rotate del backend
//   7. Escribir secrets.enc INMEDIATAMENTE con la nueva key
//   8. Verificar leyendo secrets.enc y comparando con la key recibida
//   9. SOLO si verify OK: invalidar cache de clientes
//
// Si write o verify fallan: retorna INTERNAL CRÍTICO con info de qué se perdió
// (la key nueva del backend, que ya no es recuperable sin otro rotate).
function _handlerEmpresaRecoverAndRotate(args) {
  args = args || {};
  // 1. Validar args
  if (!args.companyName || typeof args.companyName !== 'string') {
    return _err('INVALID_REQUEST_BODY', 'companyName requerido (string)');
  }
  if (!args.idEmpresa || typeof args.idEmpresa !== 'string') {
    return _err('INVALID_REQUEST_BODY', 'idEmpresa requerido (string)');
  }
  if (!args.motivo || typeof args.motivo !== 'string') {
    args.motivo = 'Recuperación + rotación desde K+AIR';
  }
  if (!args.actor || typeof args.actor !== 'string') {
    args.actor = 'kair-ui';
  }

  // 2. Validar adminToken
  var adminErr = _requireAdminToken();
  if (adminErr) {
    _diagLog('recoverAndRotate.step', { step: 'adminToken', outcome: 'FAIL' });
    return adminErr;  // NO llama al backend
  }

  // 3. Validar secrets.enc con URL
  var sec = _requireSecretsV2WithUrl();
  if (!sec.ok) {
    _diagLog('recoverAndRotate.step', { step: 'secretsV2WithUrl', outcome: 'FAIL' });
    return sec.response;  // NO llama al backend
  }

  // 4. Validar safeStorage disponible
  if (!safeStorage || !safeStorage.isEncryptionAvailable || !safeStorage.isEncryptionAvailable()) {
    _diagLog('recoverAndRotate.CRITICAL', {
      step: 'safeStorage',
      outcome: 'UNAVAILABLE',
      impact: 'NO_ROTATE_PERFORMED_BUT_KEY_WOULD_BE_LOST'
    });
    return _err('ENCRYPTION_UNAVAILABLE',
      'safeStorage no disponible; no se puede persistir key. ABORTANDO para no perder credencial.', {
        hint: 'No se ha ejecutado ningún rotate en el backend.'
      });
  }

  // 5. Comprobar que la empresa NO exista localmente
  if (sec.s2.empresas[args.companyName]) {
    _diagLog('recoverAndRotate.step', { step: 'alreadyExists', outcome: 'CLIENT_FOUND' });
    return _err('ALREADY_CONFIGURED',
      'La empresa ya está configurada localmente. Use firma:empresa:rotate-api-key en su lugar.', {
        companyKey: args.companyName,
        idEmpresa: args.idEmpresa,
        hint: 'Si quiere reemplazar la key actual, use el flujo normal de Rotar.'
      });
  }

  _diagLog('recoverAndRotate.step', {
    step: 'preconditionsOK',
    companyName: args.companyName,
    idEmpresa: args.idEmpresa,
    motivo: args.motivo,
    actor: args.actor
  });

  // 6. AHORA sí: llamar al rotate del backend
  var client = _createAdminClient(sec.s2.firmaServiceUrl, sec.s2.firmaServiceClientInstanceId);
  return Promise.resolve(client.adminRotateClient(args.idEmpresa, {
    motivo: args.motivo,
    actor: args.actor
  })).then(function (r) {
    if (!r.success) {
      _diagLog('recoverAndRotate.step', {
        step: 'backendRotate',
        outcome: 'FAIL',
        error_code: r.error && r.error.code,
        error_message: r.error && r.error.message
      });
      return r;  // El backend rechazó, no se hace nada más
    }

    _diagLog('recoverAndRotate.step', {
      step: 'backendRotate.OK',
      oldApiKeyHashPrefix: r.data.old_api_key_hash_prefix,
      newApiKeyHashPrefix: r.data.new_api_key_hash_prefix
    });

    // 7. CRÍTICO: write secrets.enc INMEDIATAMENTE
    var s2 = sec.s2;
    s2.empresas[args.companyName] = {
      idEmpresa: args.idEmpresa,
      firmaApiKey: r.data.new_api_key,  // SOLO en memoria de s2
      activatedAt: r.data.rotated_at,
      lastValidatedAt: null
    };
    var w = _writeSecrets(s2);
    if (!w.ok) {
      // ⚠️ CRÍTICO: el backend ya rotó, pero no pudimos escribir localmente.
      // La key nueva se va cuando el proceso termine. No hay forma de recuperarla.
      _diagLog('recoverAndRotate.CRITICAL', {
        step: 'writeSecrets.FAIL',
        impact: 'BACKEND_ROTATED_BUT_LOCAL_WRITE_FAILED',
        error: w.error,
        oldApiKeyHashPrefix: r.data.old_api_key_hash_prefix,
        newApiKeyHashPrefix: r.data.new_api_key_hash_prefix
      });
      return _err('INTERNAL',
        'CRÍTICO: El backend rotó la key pero no se pudo escribir secrets.enc. ' +
        'Key perdida. Contacta al admin. Error: ' + w.error, {
          backendRotated: true,
          oldApiKeyHashPrefix: r.data.old_api_key_hash_prefix,
          newApiKeyHashPrefix: r.data.new_api_key_hash_prefix,
          hint: 'La nueva key no se guardó localmente. Se requeriría otro rotate para recuperarla.'
        });
    }

    // 8. Verificar leyendo de vuelta
    var verify = _readSecretsV2();
    if (!verify || !verify.empresas || !verify.empresas[args.companyName] ||
        verify.empresas[args.companyName].firmaApiKey !== r.data.new_api_key) {
      _diagLog('recoverAndRotate.CRITICAL', {
        step: 'verifyRead.FAIL',
        companyName: args.companyName
      });
      return _err('INTERNAL',
        'CRÍTICO: write secrets.enc exitoso pero verificación de lectura FALLÓ. ' +
        'Posible corrupción. Contacta al admin.');
    }

    // 9. Invalidar cache de clientes SOLO después de verify OK
    _invalidateAllClients();

    _diagLog('recoverAndRotate.done', {
      outcome: 'OK',
      companyKey: args.companyName,
      idEmpresa: args.idEmpresa,
      oldApiKeyHashPrefix: r.data.old_api_key_hash_prefix,
      newApiKeyHashPrefix: r.data.new_api_key_hash_prefix
    });

    return _ok({
      recovered: true,
      rotated: true,
      companyKey: args.companyName,
      idEmpresa: args.idEmpresa,
      oldApiKeyHashPrefix: r.data.old_api_key_hash_prefix,
      newApiKeyHashPrefix: r.data.new_api_key_hash_prefix,
      rotatedAt: r.data.rotated_at,
      motivo: r.data.motivo,
      actor: r.data.actor
    });
  });
}

// -------- firma:empresa:revoke-api-key --------
// DR-4: V1 = borrar local + opcionalmente rotar en backend (la rotación
//       SÍ marca la key vieja como revocada).
function _handlerEmpresaRevokeApiKey(args) {
  args = args || {};
  if (!args.companyName || typeof args.companyName !== 'string') {
    return _err('INVALID_REQUEST_BODY', 'companyName requerido (string)');
  }
  var sec = _requireSecretsV2WithUrl();
  if (!sec.ok) return sec.response;
  var s2 = sec.s2;
  var found = _resolveEmpresa(s2.empresas, args.companyName);
  if (!found) {
    return _err('CLIENT_NOT_FOUND', 'No hay firma configurada para esta empresa.', {
      companyKey: args.companyName
    });
  }
  var companyKeyToRemove = found.companyKey;

  // Si revokeRemote=true, llamar adminRotateClient (V1) que marca la key
  // vieja como revocada en backend.
  if (args.revokeRemote === true) {
    var adminErr = _requireAdminToken();
    if (adminErr) {
      return _err('ADMIN_TOKEN_REQUIRED',
        'revokeRemote=true requiere adminApiKey. Configure via firma:config:set-admin-key.',
        { remediationHint: 'firma:config:set-admin-key' });
    }
    var client = _createAdminClient(sec.s2.firmaServiceUrl, sec.s2.firmaServiceClientInstanceId);
    return Promise.resolve(client.adminRotateClient(found.entry.idEmpresa, {
      motivo: args.motivo || 'Revocación manual desde K+AIR',
      actor: args.actor || 'kair-bridge'
    })).then(function (r) {
      if (!r.success) return r;
      // Borrar entrada local
      delete s2.empresas[companyKeyToRemove];
      var w = _writeSecrets(s2);
      if (!w.ok) {
        return _err('INTERNAL', 'Error guardando secrets.enc post-revoke: ' + (w.error || 'unknown'));
      }
      _invalidateAllClients();
      return _ok({
        revoked: true,
        companyKey: companyKeyToRemove,
        idEmpresa: found.entry.idEmpresa,
        oldApiKeyHashPrefix: r.data.old_api_key_hash_prefix,
        revokedRemote: true,
        motivo: r.data.motivo
      });
    });
  }

  // Sin revokeRemote: solo borrar local.
  delete s2.empresas[companyKeyToRemove];
  var w = _writeSecrets(s2);
  if (!w.ok) {
    return _err('INTERNAL', 'Error guardando secrets.enc post-revoke: ' + (w.error || 'unknown'));
  }
  _invalidateAllClients();
  return _ok({
    revoked: true,
    companyKey: companyKeyToRemove,
    idEmpresa: found.entry.idEmpresa,
    revokedRemote: false
  });
}

// -------- firma:empresa:list-firma-remote --------
// Lista per-company clients remotos (usando adminApiKey).
function _handlerEmpresaListFirmaRemote(args) {
  args = args || {};
  var adminErr = _requireAdminToken();
  if (adminErr) return adminErr;
  var sec = _requireSecretsV2WithUrl();
  if (!sec.ok) return sec.response;
  var client = _createAdminClient(sec.s2.firmaServiceUrl, sec.s2.firmaServiceClientInstanceId);
  return Promise.resolve(client.adminListClients({
    id_empresa: args.idEmpresa,
    include_revoked: args.include_revoked
  }));
}

// -------- firma:empresa:list-backend (I-104 RECOVERY: READ-ONLY) --------
// Lista per-company clients del backend con metadata NO sensible, para
// que el UI de Configuración pueda detectar:
//   - Empresa NO existe en backend (candidates: Crear / Pegar)
//   - Empresa existe en backend + is_active=true (candidates: Recuperar+Rotar)
//   - Empresa existe en backend + is_active=false (candidates: mostrar estado)
//
// El backend YA expone solo api_key_hash_prefix (8 chars del SHA-256, no es
// secreto reversible). NO incluye api_key ni api_key_hash completo.
// Esta función es READ-ONLY pura: no modifica nada.
function _handlerEmpresaListBackend(args) {
  args = args || {};
  var adminErr = _requireAdminToken();
  if (adminErr) return adminErr;
  var sec = _requireSecretsV2WithUrl();
  if (!sec.ok) return sec.response;
  var client = _createAdminClient(sec.s2.firmaServiceUrl, sec.s2.firmaServiceClientInstanceId);
  return Promise.resolve(client.adminListClients({
    id_empresa: args.id_empresa || null,
    include_revoked: args.include_revoked === true,
    limit: typeof args.limit === 'number' ? args.limit : 200
  })).then(function (r) {
    if (!r.success) return r;
    var items = (r.data && r.data.items) || [];
    // ⚠️ Defensa en profundidad: aunque el backend ya enmascara, filtramos
    // explícitamente a campos seguros antes de pasar al renderer.
    var safeItems = items.map(function (it) {
      return {
        id_empresa: it.id_empresa,
        description: it.description || null,
        is_active: it.is_active,
        api_key_hash_prefix: it.api_key_hash_prefix || null,
        allowed_operations: it.allowed_operations || null,
        created_at: it.created_at || null,
        revoked_at: it.revoked_at || null
        // ⚠️ NO se exponen: api_key, api_key_hash completo, client_instance_id
      };
    });
    return _ok({
      items: safeItems,
      total: (r.data && r.data.total) || safeItems.length
    });
  });
}

// -------- firma:config:set-admin-key --------
// DR-2: admin token persistido en secrets.enc.adminApiKey.
function _handlerConfigSetAdminKey(args) {
  args = args || {};
  if (!args.adminApiKey || typeof args.adminApiKey !== 'string') {
    return _err('INVALID_REQUEST_BODY', 'adminApiKey requerido (string)');
  }
  if (args.adminApiKey.length < 32) {
    return _err('INVALID_REQUEST_BODY', 'adminApiKey demasiado corto (mín 32 chars)');
  }
  if (!safeStorage || !safeStorage.isEncryptionAvailable || !safeStorage.isEncryptionAvailable()) {
    return _err('ENCRYPTION_UNAVAILABLE', 'safeStorage no disponible; no se puede persistir adminApiKey.');
  }
  var s2 = _readSecretsV2() || _emptySecretsV2();
  s2.adminApiKey = args.adminApiKey;
  // NUNCA loggear el adminApiKey en plaintext (regla de oro).
  var w = _writeSecrets(s2);
  if (!w.ok) {
    return _err('INTERNAL', 'Error guardando adminApiKey: ' + (w.error || 'unknown'));
  }
  _invalidateAllClients();
  // Computar hash prefix (8 chars) para que el operador verifique sin ver el secreto.
  var crypto;
  try {
    crypto = require('crypto');
  } catch (e) { crypto = null; }
  var prefix = '';
  if (crypto && typeof crypto.createHash === 'function') {
    try {
      prefix = crypto.createHash('sha256').update(args.adminApiKey).digest('hex').slice(0, 8);
    } catch (e) {}
  }
  console.info('[' + MOD + '] adminApiKey configurado. hash_prefix=' + prefix + ' (NO se loggea plaintext).');
  return _ok({
    stored: true,
    encryptionAvailable: w.encryptionAvailable,
    adminKeyHashPrefix: prefix
  });
}

// =====================================================================
//  REGISTRATION (patrón init + register)
// =====================================================================

function registerFirmaHandlers(appArg, deps) {
  _app = appArg || _app;
  if (deps && typeof deps.appVersion === 'string') {
    _appVersion = deps.appVersion;
  } else if (_app && typeof _app.getVersion === 'function') {
    _appVersion = _app.getVersion();
  }

  if (!_ipcMain) {
    throw new Error('ipcMain no configurado. Usar registerFirmaHandlers.init(ipcMain) primero.');
  }
  var handle = _ipcMain.handle.bind(_ipcMain);

  // --- Config (4) ---
  handle('firma:config:get', function (event, payload) {
    try {
      return _handlerConfigGet();
    } catch (e) {
      console.error('[' + MOD + '][config:get]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  handle('firma:config:set-api-key', function (event, payload) {
    try {
      return _handlerConfigSetApiKey(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][config:set-api-key]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  handle('firma:config:set-url', function (event, payload) {
    try {
      return _handlerConfigSetUrl(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][config:set-url]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  handle('firma:config:diag', function (event, payload) {
    try {
      return _handlerConfigDiag();
    } catch (e) {
      console.error('[' + MOD + '][config:diag]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // --- Sign request (6) ---
  handle('firma:sign-request:create', function (event, payload) {
    try {
      return _handlerSignRequestCreate(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][sign-request:create]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  // I-102.2.D · Helper para que la UI lea bytes del PDF y calcule document_hash
  handle('firma:documento:read-bytes', function (event, payload) {
    try {
      return _handlerDocumentoReadBytes(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][documento:read-bytes]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  handle('firma:sign-request:get', function (event, payload) {
    try {
      return _handlerSignRequestGet(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][sign-request:get]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  handle('firma:sign-request:eventos', function (event, payload) {
    try {
      return _handlerSignRequestEventos(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][sign-request:eventos]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  handle('firma:sign-request:list', function (event, payload) {
    try {
      return _handlerSignRequestList(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][sign-request:list]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  handle('firma:sign-request:document', function (event, payload) {
    try {
      return _handlerSignRequestDocument(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][sign-request:document]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  handle('firma:sign-request:constancia', function (event, payload) {
    try {
      return _handlerSignRequestConstancia(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][sign-request:constancia]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  // I-104 (SaveAs): guarda la constancia con dialog.showSaveDialog.
  handle('firma:sign-request:constancia-save-as', function (event, payload) {
    try {
      return _handlerSignRequestConstanciaSaveAs(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][sign-request:constancia-save-as]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  // Constancia GENERAL del expediente (SaveAs): PDF consolidado al vuelo
  // con todas las solicitudes de firma del trabajador (firmadas y pendientes).
  handle('firma:expediente:constancia-save-as', function (event, payload) {
    try {
      return _handlerExpedienteConstanciaSaveAs(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][expediente:constancia-save-as]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  handle('firma:sign-request:link', function (event, payload) {
    try {
      return _handlerSignRequestLink(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][sign-request:link]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  // I-103.A1.5.2 · 7mo handler de sign-request. Misma protección que
  // sign-request:link (re-uso de sign_request:read en backend).
  handle('firma:sign-request:notify-remote', function (event, payload) {
    try {
      return _handlerSignRequestNotifyRemote(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][sign-request:notify-remote]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  // I-103.A1.6.B · 8vo handler de sign-request. Reenvío de OTP desde K+AIR
  // (wrapper per-empresa de publicFlow.resendOtp). El renderer habilita el
  // botón solo en estados {OTP_SENT, OTP_LOCKED} y aplica cooldown visual.
  handle('firma:sign-request:resend-otp', function (event, payload) {
    try {
      return _handlerSignRequestResendOtp(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][sign-request:resend-otp]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // --- Consent (2) ---
  handle('firma:consent:create', function (event, payload) {
    try {
      return _handlerConsentCreate(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][consent:create]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  handle('firma:consent:verify-otp', function (event, payload) {
    try {
      return _handlerConsentVerifyOtp(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][consent:verify-otp]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // --- Agreement (1) ---
  handle('firma:agreement:get', function (event, payload) {
    try {
      return _handlerAgreementGet(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][agreement:get]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // --- Per-empresa admin (6) + set-admin-key (1) ---
  // Total: 7 nuevos canales. Plus el legacy set-api-key (que escribe
  // a empresas["__default__"] con WARN para compat con renderer v0.1.190).
  handle('firma:empresa:list', function (event, payload) {
    try { return _handlerEmpresaList(payload || {}); }
    catch (e) { console.error('[' + MOD + '][empresa:list]', e.message); return _err('INTERNAL', e.message); }
  });
  handle('firma:empresa:create', function (event, payload) {
    try { return _handlerEmpresaCreate(payload || {}); }
    catch (e) { console.error('[' + MOD + '][empresa:create]', e.message); return _err('INTERNAL', e.message); }
  });
  handle('firma:empresa:set-api-key', function (event, payload) {
    try { return _handlerEmpresaSetApiKey(payload || {}); }
    catch (e) { console.error('[' + MOD + '][empresa:set-api-key]', e.message); return _err('INTERNAL', e.message); }
  });
  handle('firma:empresa:rotate-api-key', function (event, payload) {
    try { return _handlerEmpresaRotateApiKey(payload || {}); }
    catch (e) { console.error('[' + MOD + '][empresa:rotate-api-key]', e.message); return _err('INTERNAL', e.message); }
  });
  handle('firma:empresa:revoke-api-key', function (event, payload) {
    try { return _handlerEmpresaRevokeApiKey(payload || {}); }
    catch (e) { console.error('[' + MOD + '][empresa:revoke-api-key]', e.message); return _err('INTERNAL', e.message); }
  });
  handle('firma:empresa:list-firma-remote', function (event, payload) {
    try { return _handlerEmpresaListFirmaRemote(payload || {}); }
    catch (e) { console.error('[' + MOD + '][empresa:list-firma-remote]', e.message); return _err('INTERNAL', e.message); }
  });
  // I-104 RECOVERY: list-backend (READ-ONLY) para que la UI detecte
  // empresas que existen en el backend pero no en secrets.enc.
  handle('firma:empresa:list-backend', function (event, payload) {
    try { return _handlerEmpresaListBackend(payload || {}); }
    catch (e) { console.error('[' + MOD + '][empresa:list-backend]', e.message); return _err('INTERNAL', e.message); }
  });
  // I-104 RECOVERY: recover-and-rotate.
  // Resuelve huevo-gallina: rota una empresa que existe en backend pero NO
  // en secrets.enc. NO rota si safeStorage/adminToken/URL no están OK.
  handle('firma:empresa:recover-and-rotate', function (event, payload) {
    try { return _handlerEmpresaRecoverAndRotate(payload || {}); }
    catch (e) { console.error('[' + MOD + '][empresa:recover-and-rotate]', e.message); return _err('INTERNAL', e.message); }
  });
  handle('firma:config:set-admin-key', function (event, payload) {
    try { return _handlerConfigSetAdminKey(payload || {}); }
    catch (e) { console.error('[' + MOD + '][config:set-admin-key]', e.message); return _err('INTERNAL', e.message); }
  });
}

registerFirmaHandlers.init = function (ipcMainArg) {
  _ipcMain = ipcMainArg;
};

// Helpers de testing (expuestos pero no en el módulo exportado por default;
// se accede via require para tests)
registerFirmaHandlers._test_reset = function () {
  _ipcMain = null;
  _app = null;
  _appVersion = 'dev';
  _cachedClient = null;
  _cachedClientConfigKey = null;
  _clientFactory = firmaClientModule.createFirmaClient;
  _generateClientInstanceIdFn = firmaClientModule.generateClientInstanceId;
};
registerFirmaHandlers._test_setSecrets = function (secrets) {
  // Bypass de safeStorage para tests: cifrar con el mismo formato que
  // _writeSecrets usa en prod (prefijo 'ENC:'). El mock safeStorage
  // descifra ese formato.
  var p = _secretsPath();
  if (!p) return;
  fs.writeFileSync(p, 'ENC:' + JSON.stringify(secrets));
};
registerFirmaHandlers._test_clearSecrets = function () {
  var p = _secretsPath();
  if (p && fs.existsSync(p)) {
    fs.unlinkSync(p);
  }
};
registerFirmaHandlers._test_setClientFactory = function (fn) {
  _clientFactory = fn;
};
registerFirmaHandlers._test_setGenerateClientInstanceId = function (fn) {
  _generateClientInstanceIdFn = fn;
};

// Export dual: la función misma (compat con tests) Y el objeto con .registerFirmaHandlers
// (compat con main.js que hace `const { registerFirmaHandlers } = require('./main/firma-bridge')`).
// Sin esto, el destructuring devuelve undefined y los 20 handlers firma:* NUNCA se registran.
module.exports = registerFirmaHandlers;
module.exports.registerFirmaHandlers = registerFirmaHandlers;
