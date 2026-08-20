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
const SECRETS_VERSION = 1;
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
 */
function _readSecrets() {
  var p = _secretsPath();
  if (!p) return null;
  if (!fs.existsSync(p)) return null;
  if (!safeStorage || !safeStorage.isEncryptionAvailable || !safeStorage.isEncryptionAvailable()) {
    console.warn('[' + MOD + '] safeStorage no disponible; no se puede leer secrets.enc');
    return null;
  }
  try {
    var buf = fs.readFileSync(p);
    var json = safeStorage.decryptString(buf);
    return JSON.parse(json);
  } catch (e) {
    console.warn('[' + MOD + '] Error descifrando secrets.enc (posible cambio de OS/keyring):', e.message);
    // Borrar archivo corrupto; regenerar
    try { fs.unlinkSync(p); } catch (_) {}
    return null;
  }
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

function _secretsConfig() {
  var s = _readSecrets();
  if (!s) return null;
  return {
    url: s.firmaServiceUrl || '',
    apiKey: s.firmaServiceApiKey || '',
    clientInstanceId: s.clientInstanceId || _generateClientInstanceIdFn(),
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
    firmaServiceApiKey: '',
    clientInstanceId: newId
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
//  CLIENT FACTORY (memoized)
// =====================================================================

var _cachedClient = null;
var _cachedClientConfigKey = null;

function _clientConfigKey(cfg) {
  return [cfg.url, cfg.apiKey, cfg.clientInstanceId].join('|');
}

function _getClient() {
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

// Invalidate cache (llamar cuando cambia config via set-api-key o set-url)
function _invalidateClientCache() {
  _cachedClient = null;
  _cachedClientConfigKey = null;
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
  return _ok({
    url: cfg.url,
    clientInstanceId: cfg.clientInstanceId,
    hasApiKey: cfg.hasApiKey,
    hasUrl: cfg.hasUrl,
    encryptionAvailable: cfg.encryptionAvailable,
    source: cfg.source
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
  var existing = _readSecrets() || {
    version: SECRETS_VERSION,
    firmaServiceUrl: process.env.FIRMA_SERVICE_URL || '',
    firmaServiceApiKey: '',
    clientInstanceId: _generateClientInstanceIdFn()
  };
  existing.version = SECRETS_VERSION;
  existing.firmaServiceApiKey = args.apiKey;
  if (!existing.clientInstanceId) {
    existing.clientInstanceId = _generateClientInstanceIdFn();
  }
  var res = _writeSecrets(existing);
  if (!res.ok) {
    return _err('INTERNAL', 'Error escribiendo secrets.enc: ' + (res.error || 'unknown'));
  }
  _invalidateClientCache();
  return _ok({ stored: true, encryptionAvailable: res.encryptionAvailable });
}

function _handlerConfigSetUrl(args) {
  args = args || {};
  var v = _validateUrl(args.url);
  if (!v.ok) {
    return _err('INVALID_REQUEST_BODY', v.message);
  }
  var existing = _readSecrets() || {
    version: SECRETS_VERSION,
    firmaServiceUrl: '',
    firmaServiceApiKey: '',
    clientInstanceId: _generateClientInstanceIdFn()
  };
  existing.version = SECRETS_VERSION;
  existing.firmaServiceUrl = v.url;
  if (!existing.clientInstanceId) {
    existing.clientInstanceId = _generateClientInstanceIdFn();
  }
  if (!existing.firmaServiceApiKey && !process.env.FIRMA_SERVICE_API_KEY) {
    // No escribimos a disco si no hay API key (solo URL) y tampoco cifrado disponible:
    // mantenemos el comportamiento de "missing" para que la UI pida API key.
    // Pero igual persistimos la URL con un client_instance_id.
  }
  if (safeStorage && safeStorage.isEncryptionAvailable && safeStorage.isEncryptionAvailable()) {
    var res = _writeSecrets(existing);
    if (!res.ok) {
      return _err('INTERNAL', 'Error escribiendo secrets.enc: ' + (res.error || 'unknown'));
    }
  } else if (process.env.FIRMA_SERVICE_URL) {
    // En modo env, no podemos persistir la URL vía secrets.enc
    return _ok({ url: v.url, source: 'env', note: 'FIRMA_SERVICE_URL en env tiene precedencia' });
  } else {
    return _err('ENCRYPTION_UNAVAILABLE', 'safeStorage no disponible; no se puede persistir URL.', {
      hint: 'Configure FIRMA_SERVICE_URL en env (solo dev/CI).'
    });
  }
  _invalidateClientCache();
  return _ok({ url: v.url });
}

function _handlerConfigDiag() {
  var cfg = _resolveConfig();
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
    version: '1.0.0'
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

function _handlerSignRequestCreate(args) {
  args = args || {};
  if (!args.metadata) {
    return _err('INVALID_REQUEST_BODY', 'metadata requerida');
  }
  var r = _requireClient();
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
  var r = _requireClient();
  if (!r.ok) return r.response;
  return r.client.getSignRequest(args.id);
}

function _handlerSignRequestList(args) {
  args = args || {};
  if (!Array.isArray(args.ids) || args.ids.length === 0) {
    return _err('INVALID_REQUEST_BODY', 'ids[] requerido');
  }
  var r = _requireClient();
  if (!r.ok) return r.response;
  return r.client.listSignRequests(args.ids);
}

function _handlerSignRequestDocument(args) {
  args = args || {};
  if (!args.id) {
    return _err('INVALID_REQUEST_BODY', 'id requerido');
  }
  var r = _requireClient();
  if (!r.ok) return r.response;
  return r.client.getSignRequestDocument(args.id);
}

function _handlerSignRequestConstancia(args) {
  args = args || {};
  if (!args.id) {
    return _err('INVALID_REQUEST_BODY', 'id requerido');
  }
  var r = _requireClient();
  if (!r.ok) return r.response;
  return r.client.getSignRequestConstancia(args.id);
}

function _handlerSignRequestLink(args) {
  args = args || {};
  if (!args.id) {
    return _err('INVALID_REQUEST_BODY', 'id requerido');
  }
  var r = _requireClient();
  if (!r.ok) return r.response;
  return r.client.getSignRequestLink(args.id);
}

function _handlerConsentCreate(args) {
  args = args || {};
  if (!args.id_trabajador || !args.id_empresa || !args.version_acuerdo || !args.correo_verificacion) {
    return _err('INVALID_REQUEST_BODY', 'id_trabajador, id_empresa, version_acuerdo, correo_verificacion requeridos');
  }
  var r = _requireClient();
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
  var r = _requireClient();
  if (!r.ok) return r.response;
  return r.client.verifyConsentOtp(args.consentId, args.otp);
}

function _handlerAgreementGet() {
  var r = _requireClient();
  if (!r.ok) return r.response;
  return r.client.getActiveAgreement();
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
      return _handlerAgreementGet();
    } catch (e) {
      console.error('[' + MOD + '][agreement:get]', e.message);
      return _err('INTERNAL', e.message);
    }
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
  // Bypass de safeStorage para tests
  var p = _secretsPath();
  if (!p) return;
  fs.writeFileSync(p, JSON.stringify(secrets));
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

module.exports = registerFirmaHandlers;
