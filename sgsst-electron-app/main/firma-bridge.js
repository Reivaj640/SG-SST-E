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
const { app, safeStorage } = require('electron');

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
function _resolveConfigForCompany(companyName) {
  if (!companyName || typeof companyName !== 'string') return null;

  // 1) Env vars: NO se implementa per-empresa en v1. El modo env
  //    (FIRMA_SERVICE_URL + FIRMA_SERVICE_API_KEY) sigue siendo "global",
  //    usado solo en dev/CI. Si hay env, retornamos config global PERO
  //    sin idEmpresa (dispara CONFIG_MISSING en handlers per-empresa).
  if (_hasEnv()) {
    var env = _envConfig();
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
    return null;  // secrets no accesible — caller decide qué hacer
  }

  var found = _resolveEmpresa(s2.empresas, companyName);
  if (!found) {
    return null;  // empresa no configurada — caller retorna CONFIG_MISSING
  }
  var entry = found.entry;
  return {
    url: s2.firmaServiceUrl || '',
    apiKey: entry.firmaApiKey || '',
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
  var r = _getClient();
  if (!r.client) {
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
  return { ok: true, client: r.client, config: r.config };
}

/**
 * Helper: resuelve el cliente a usar. Si args.companyName está presente,
 * usa el cache per-empresa (DR-1: cada empresa usa su propia key).
 * Si NO está, fallback al modo LEGACY (env/secrets single).
 * Retorna { client, config, source } o un error response.
 */
function _resolveClientForRequest(args) {
  if (args && typeof args.companyName === 'string' && args.companyName.length > 0) {
    // Modo per-empresa (K+AIR v0.1.191+)
    // Primero verificar que firma-service esté configurado a nivel global.
    var s2 = _readSecretsV2();
    var urlOk = s2 && s2.firmaServiceUrl;
    if (!urlOk) {
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
      return {
        ok: false,
        response: _err('CONFIG_MISSING',
          'Firma no configurada para empresa "' + args.companyName + '". Use firma:empresa:set-api-key o firma:empresa:create.', {
            hint: 'firma:empresa:set-api-key o firma:empresa:create',
            companyName: args.companyName
          })
      };
    }
    return { ok: true, client: r.client, config: r.config, source: 'per-empresa' };
  }
  // Modo LEGACY (renderer v0.1.190 con firma:config:set-api-key)
  return _requireClient();
}

function _handlerSignRequestCreate(args) {
  args = args || {};
  if (!args.metadata) {
    return _err('INVALID_REQUEST_BODY', 'metadata requerida');
  }
  var r = _resolveClientForRequest(args);
  if (!r.ok) return r.response;
  // Aceptar pdfBase64 (string) o pdfBuffer (Buffer). Convertir a Buffer
  // antes de pasar al client para que el contrato sea uniforme.
  var pdfBuffer;
  if (Buffer.isBuffer(args.pdfBuffer)) {
    pdfBuffer = args.pdfBuffer;
  } else if (typeof args.pdfBase64 === 'string' && args.pdfBase64.length > 0) {
    try {
      pdfBuffer = Buffer.from(args.pdfBase64, 'base64');
    } catch (e) {
      return _err('INVALID_REQUEST_BODY', 'pdfBase64 inválido: ' + e.message);
    }
  } else {
    return _err('INVALID_REQUEST_BODY', 'pdfBuffer o pdfBase64 requerido');
  }
  return r.client.createSignRequest({
    metadata: args.metadata,
    pdfBuffer: pdfBuffer,
    pdfName: args.pdfName || 'documento.pdf'
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
  var r = _resolveClientForRequest(args);
  if (!r.ok) return r.response;
  return r.client.getSignRequestDocument(args.id);
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

function _handlerSignRequestLink(args) {
  args = args || {};
  if (!args.id) {
    return _err('INVALID_REQUEST_BODY', 'id requerido');
  }
  var r = _resolveClientForRequest(args);
  if (!r.ok) return r.response;
  return r.client.getSignRequestLink(args.id);
}

function _handlerConsentCreate(args) {
  args = args || {};
  if (!args.id_trabajador || !args.id_empresa || !args.version_acuerdo || !args.correo_verificacion) {
    return _err('INVALID_REQUEST_BODY', 'id_trabajador, id_empresa, version_acuerdo, correo_verificacion requeridos');
  }
  var r = _resolveClientForRequest(args);
  if (!r.ok) return r.response;
  return r.client.createConsent({
    id_trabajador: args.id_trabajador,
    id_empresa: args.id_empresa,
    version_acuerdo: args.version_acuerdo,
    correo_verificacion: args.correo_verificacion,
    kair_version: args.kair_version || _appVersion
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
  var r = _resolveClientForRequest(args);
  if (!r.ok) return r.response;
  return r.client.getActiveAgreement();
}

// -------- I-102.2.D · firma:documento:read-bytes --------
// Lee los bytes de un archivo (PDF) del disco local. Usado por la UI
// para calcular el document_hash antes de enviar el sign request.
// Validacion: archivo existe, es regular, no excede 50 MB.
function _handlerDocumentoReadBytes(args) {
  args = args || {};
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
    return _err('INVALID_REQUEST_BODY', 'companyName requerido (string)');
  }
  var adminErr = _requireAdminToken();
  if (adminErr) return adminErr;
  var sec = _requireSecretsV2WithUrl();
  if (!sec.ok) return sec.response;

  var s2 = sec.s2;
  var found = _resolveEmpresa(s2.empresas, args.companyName);
  if (!found) {
    return _err('CLIENT_NOT_FOUND', 'No hay firma configurada para esta empresa.', {
      companyKey: args.companyName,
      hint: 'Use firma:empresa:create o firma:empresa:set-api-key primero.'
    });
  }
  var oldIdEmpresa = found.entry.idEmpresa;

  // Llamar al backend
  var client = _createAdminClient(sec.s2.firmaServiceUrl, sec.s2.firmaServiceClientInstanceId);
  return Promise.resolve(client.adminRotateClient(oldIdEmpresa, {
    motivo: args.motivo || 'Rotación manual desde K+AIR',
    actor: args.actor || 'kair-bridge'
  })).then(function (r) {
    if (!r.success) return r;
    // Actualizar secrets.enc con la nueva key (DR-3: solo en secrets.enc).
    s2.empresas[found.companyKey] = {
      idEmpresa: oldIdEmpresa,
      firmaApiKey: r.data.new_api_key,  // SOLO en secrets.enc
      activatedAt: r.data.rotated_at,
      lastValidatedAt: s2.empresas[found.companyKey].lastValidatedAt
    };
    var w = _writeSecrets(s2);
    if (!w.ok) {
      return _err('INTERNAL', 'Error guardando key rotada en secrets.enc: ' + (w.error || 'unknown'));
    }
    _invalidateAllClients();
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
  handle('firma:sign-request:link', function (event, payload) {
    try {
      return _handlerSignRequestLink(payload || {});
    } catch (e) {
      console.error('[' + MOD + '][sign-request:link]', e.message);
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
