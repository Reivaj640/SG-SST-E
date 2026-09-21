// storage-backup/e2e-multicompany.js
//
// E2E REAL MULTI-EMPRESA — K+AIR bridge ↔ firma-service admin/per-company
// =========================================================================
// Demuestra que:
//   - 2 empresas conviven con keys distintas
//   - Cada empresa solo ve sus propios sign requests (aislamiento A/B)
//   - Cross-company attempts son rechazados (403 EMPRESA_MISMATCH o 404)
//   - Rotación de key: la vieja deja de funcionar, la nueva funciona
//   - ALREADY_CONFIGURED sin HTTP (DR-6.C pre-chequeo)
//   - secrets.enc v2 persiste/migra correctamente
//   - Tras reiniciar el servicio, las keys siguen siendo válidas
//
// CÓMO se monta el bridge sin Electron runtime:
//   - Mock del módulo 'electron' (intercept Module._resolveFilename)
//   - safeStorage mock con formato 'ENC:' (idéntico a test-firma-bridge.js)
//   - app.getPath('userData') → tmpdir para que secrets.enc quede en archivo
//   - ipcMain.handle → dict local; invocamos handlers como si fuera el renderer
//
// El firma-client NO se mockea: habla HTTP real con el servicio real.
// El firma-service se arranca como child process con DB_PATH separada.
//
// Uso (desde la raíz del repo):
//   node storage-backup/e2e-multicompany.js
//
// Salida: líneas "[E2E-MC] ..." + resumen final.
// Exit code 0 si todo verde, 1 si algún paso falla.

'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const Module = require('node:module');

// ============================================================================
//  Config
// ============================================================================
const FIRMA_SERVICE_DIR = path.resolve(__dirname, '..', 'firma-service');
const FIRMA_SERVICE_ENTRY = path.join(FIRMA_SERVICE_DIR, 'src', 'server.js');
const PORT = 3001;
const BASE_URL = 'http://localhost:' + PORT;

// API keys de test (alineadas con tests/helpers.js del firma-service).
// NO son secretos reales — son valores conocidos que el service acepta en dev.
const INTERNAL_API_KEY = 'test-internal-api-key-32-bytes-min!!';
const ADMIN_API_KEY = 'test-admin-api-key-32-bytes-min!!!!!';

// Genera TOKEN_ENCRYPTION_KEY (32 bytes hex = 64 chars) para I-013b.
const TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

// BD y storage separados para no tocar la BD de dev ni la del script E2E previo.
const DB_PATH = path.join(FIRMA_SERVICE_DIR, 'data', 'e2e-test-mc.sqlite');
const PDF_STORAGE_PATH = path.join(FIRMA_SERVICE_DIR, 'storage-e2e-mc', 'pdfs');

// Empresas de prueba (NITs ficticios).
const EMPRESA_A = { nit: '900123456-1', displayName: 'TEMPOACTIVA EST S.A.S.' };
const EMPRESA_B = { nit: '900999888-7', displayName: 'OTRA S.A.S.' };

// ============================================================================
//  Mock del módulo 'electron' — DEBE ir ANTES de require('./main/firma-bridge')
// ============================================================================
const _tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-e2e-mc-'));
const _secretsPath = path.join(_tmpUserData, 'secrets.enc');

const _mockSafeStorage = {
  isEncryptionAvailable: function () { return true; },
  encryptString: function (s) {
    return Buffer.from('ENC:' + s, 'utf-8');
  },
  decryptString: function (buf) {
    var s = Buffer.isBuffer(buf) ? buf.toString('utf-8') : String(buf);
    if (s.indexOf('ENC:') !== 0) throw new Error('Invalid encrypted blob (no ENC: prefix)');
    return s.slice(4);
  }
};

const _ipcHandlers = {};
const _mockIpcMain = {
  handle: function (channel, handler) { _ipcHandlers[channel] = handler; }
};
const _mockApp = {
  on: function () {},
  getPath: function (name) {
    if (name === 'userData') return _tmpUserData;
    return os.tmpdir();
  },
  getVersion: function () { return '0.1.191-e2e-mc'; }
};

// Hack: interceptar require('electron')
const _originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === 'electron') {
    return path.join(__dirname, '__mock_electron_e2e_mc.js');
  }
  return _originalResolve.call(this, request, parent, ...rest);
};
fs.writeFileSync(
  path.join(__dirname, '__mock_electron_e2e_mc.js'),
  'module.exports = global._mockElectronE2eMcModule;\n'
);
global._mockElectronE2eMcModule = {
  ipcMain: _mockIpcMain,
  app: _mockApp,
  safeStorage: _mockSafeStorage
};

// Ahora sí: cargar el bridge (con electron mockeado)
const registerFirmaHandlers = require('../main/firma-bridge');
registerFirmaHandlers.init(_mockIpcMain);
registerFirmaHandlers(_mockApp, { appVersion: '0.1.191-e2e-mc' });

// ============================================================================
//  Estado
// ============================================================================
const child = { proc: null };
const results = []; // { step, ok, message, detail? }
const ctx = {
  // Capturado entre pasos
  keyA: null,           // plaintext de la key de A (devuelta por adminCreateClient)
  keyAHashPrefix: null, // 8 chars hex del hash de la key A
  keyB: null,
  keyBHashPrefix: null,
  signReqA_id: null,    // id_solicitud creado por A
  signReqA_data: null,  // response.data del create
  signReqB_id: null,
  signReqB_data: null,
  // Para el test de "key vieja de A no funciona"
  keyA_old: null,
  keyA_old_hash_prefix: null,
  newClientInstanceId: null
};

function log(msg) {
  process.stdout.write('[E2E-MC] ' + msg + '\n');
}

function fail(step, message, detail) {
  results.push({ step: step, ok: false, message: message, detail: detail });
  log('✗ ' + step + ' — ' + message + (detail ? '\n    ' + detail : ''));
}

function pass(step, message) {
  results.push({ step: step, ok: true, message: message });
  log('✓ ' + step + ' — ' + message);
}

// Helper: invocar un IPC handler del bridge (como si fuera el renderer)
async function invoke(channel, args) {
  var h = _ipcHandlers[channel];
  if (!h) throw new Error('Handler no registrado: ' + channel);
  return await h({ /* event mock */ }, args || {});
}

// ============================================================================
//  Cleanup pre-test
// ============================================================================
function cleanup() {
  try { fs.rmSync(DB_PATH, { force: true }); } catch (_) {}
  try { fs.rmSync(DB_PATH + '-shm', { force: true }); } catch (_) {}
  try { fs.rmSync(DB_PATH + '-wal', { force: true }); } catch (_) {}
  try { fs.rmSync(PDF_STORAGE_PATH, { recursive: true, force: true }); } catch (_) {}
  // Borra el secrets.enc del tmpdir para que el bridge arranque vacío
  try { fs.rmSync(_secretsPath, { force: true }); } catch (_) {}
}

// ============================================================================
//  Arranca firma-service como child process
// ============================================================================
function startService() {
  const env = {
    ...process.env,
    NODE_ENV: 'e2e',
    PORT: String(PORT),
    PUBLIC_URL: BASE_URL,
    DB_PATH: DB_PATH,
    PDF_STORAGE_PATH: PDF_STORAGE_PATH,
    INTERNAL_API_KEY: INTERNAL_API_KEY,
    ADMIN_API_KEY: ADMIN_API_KEY,
    TOKEN_ENCRYPTION_KEY: TOKEN_ENCRYPTION_KEY,
    SMTP_HOST: 'localhost',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'e2e@example.com',
    SMTP_PASS: 'e2e-test-pass',
    SMTP_FROM_NAME: 'K+AIR E2E MC',
    SMTP_FROM_EMAIL: 'e2e@example.com',
    RATE_LIMIT_PER_MINUTE: '600',
    RATE_LIMIT_OTP_PER_HOUR: '100',
    RATE_LIMIT_COMMIT_PER_MINUTE: '30',
    RATE_LIMIT_SIGN_REQUEST_PER_MINUTE: '60',
    PUBLIC_URL_FIRMA: 'https://firma.k-air.com',
    LOG_LEVEL: 'warn'
  };

  log('Arrancando firma-service (puerto ' + PORT + ')...');
  const proc = spawn(process.execPath, [FIRMA_SERVICE_ENTRY], {
    cwd: FIRMA_SERVICE_DIR,
    env: env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  proc.stdout.on('data', function () { /* silencio */ });
  proc.stderr.on('data', function (d) {
    var s = d.toString();
    if (s.indexOf('Error') !== -1 || s.indexOf('error') !== -1) {
      process.stderr.write('[firma-service] ' + s);
    }
  });

  child.proc = proc;
  return proc;
}

async function waitForHealth(timeoutMs) {
  timeoutMs = timeoutMs || 30000;
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < timeoutMs) {
    if (child.proc && child.proc.killed) {
      throw new Error('firma-service died early');
    }
    try {
      const r = await fetch(BASE_URL + '/health');
      if (r.ok) {
        log('firma-service listo (en ' + ((Date.now() - start) / 1000).toFixed(1) + 's)');
        return;
      }
      lastErr = 'HTTP ' + r.status;
    } catch (e) {
      lastErr = e.message;
    }
    await new Promise(function (r) { setTimeout(r, 500); });
  }
  throw new Error('Timeout esperando /health (' + timeoutMs + 'ms). Último error: ' + lastErr);
}

function stopService() {
  if (child.proc && !child.proc.killed) {
    log('Deteniendo firma-service...');
    try { child.proc.kill('SIGTERM'); } catch (_) {}
    setTimeout(function () {
      if (child.proc && !child.proc.killed) {
        try { child.proc.kill('SIGKILL'); } catch (_) {}
      }
    }, 2000);
  }
}

// ============================================================================
//  Helpers de E2E
// ============================================================================
function makeFakePdf() {
  return Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n' +
    'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\n' +
    'trailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF\n',
    'utf-8'
  );
}

async function seedActiveAgreement() {
  const r = await fetch(BASE_URL + '/internal/admin/acuerdo-versiones', {
    method: 'POST',
    headers: {
      'X-Admin-API-Key': ADMIN_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      version: 'v1.0',
      texto: 'Acuerdo de uso K+AIR Firma Electrónica v1 (E2E multiempresa).',
      activa: true,
      creado_por: 'e2e-multicompany'
    })
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error('seedActiveAgreement: ' + r.status + ' — ' + body.slice(0, 500));
  }
  const body = await r.json();
  if (!body.activa) {
    throw new Error('seedActiveAgreement: respuesta sin activa=true — ' + JSON.stringify(body).slice(0, 300));
  }
  return body;
}

// Lee secrets.enc descifrado (para asserts de persistencia).
function readSecretsRaw() {
  if (!fs.existsSync(_secretsPath)) return null;
  var buf = fs.readFileSync(_secretsPath);
  var json = _mockSafeStorage.decryptString(buf);
  return JSON.parse(json);
}

// Crea un FirmaClient "raw" (NO el del bridge) — útil para probar la key
// vieja o la key de otra empresa directamente.
function createRawClient(apiKey, instanceId) {
  const fc = require('../main/firma-client');
  return fc.createFirmaClient({
    baseUrl: BASE_URL,
    apiKey: apiKey,
    clientInstanceId: instanceId || 'e2e-mc-raw-' + crypto.randomBytes(4).toString('hex'),
    appVersion: '0.1.191-e2e-mc'
  });
}

// ============================================================================
//  PASOS DEL E2E (18)
// ============================================================================

// ---- Paso 1: arrancar firma-service + seed acuerdo ----
async function step01_startAndSeed() {
  await waitForHealth(30000);
  await seedActiveAgreement();
  pass('01_startAndSeed', 'firma-service arrancado + acuerdo v1.0 activado');
}

// ---- Paso 2: configurar URL y adminApiKey en el bridge ----
async function step02_configureBridge() {
  var r1 = await invoke('firma:config:set-url', { url: BASE_URL });
  if (!r1.success) {
    fail('02_configureBridge', 'set-url falló', JSON.stringify(r1).slice(0, 300));
    return false;
  }
  var r2 = await invoke('firma:config:set-admin-key', { adminApiKey: ADMIN_API_KEY });
  if (!r2.success) {
    fail('02_configureBridge', 'set-admin-key falló', JSON.stringify(r2).slice(0, 300));
    return false;
  }
  // Validar que secrets.enc tiene la URL + admin key (NO el admin key en plaintext)
  var s = readSecretsRaw();
  if (!s || s.firmaServiceUrl !== BASE_URL) {
    fail('02_configureBridge', 'secrets.enc sin firmaServiceUrl correcto', JSON.stringify(s).slice(0, 300));
    return false;
  }
  if (s.adminApiKey !== ADMIN_API_KEY) {
    fail('02_configureBridge', 'secrets.enc sin adminApiKey correcto', '');
    return false;
  }
  pass('02_configureBridge', 'URL + adminApiKey persistidos en secrets.enc (cifrado)');
  return true;
}

// ---- Paso 3: crear key A directamente contra el backend (admin) ----
async function step03_createKeyA() {
  // Usamos el handler firma:empresa:create del bridge (que internamente usa admin).
  // DR-6.A: bridge construye description. DR-6.B: bridge inyecta los 5 ops.
  var r = await invoke('firma:empresa:create', {
    companyName: EMPRESA_A.displayName,
    idEmpresa: EMPRESA_A.nit,
    displayName: EMPRESA_A.displayName
  });
  if (!r.success) {
    fail('03_createKeyA', 'empresa:create A falló', JSON.stringify(r).slice(0, 500));
    return false;
  }
  if (r.data.apiKey) {
    fail('03_createKeyA', 'apiKey en response al renderer (DR-3 violation!)', 'apiKey length=' + r.data.apiKey.length);
    return false;
  }
  if (!r.data.apiKeyHashPrefix || r.data.apiKeyHashPrefix.length !== 8) {
    fail('03_createKeyA', 'apiKeyHashPrefix faltante o no 8 chars', JSON.stringify(r.data));
    return false;
  }
  // Verificar que la key se guardó en secrets.enc.empresas["TEMPOACTIVA..."]
  var s = readSecretsRaw();
  var entry = s && s.empresas && s.empresas[EMPRESA_A.displayName];
  if (!entry) {
    fail('03_createKeyA', 'secrets.enc.empresas["' + EMPRESA_A.displayName + '"] no existe', '');
    return false;
  }
  if (!entry.firmaApiKey || !entry.firmaApiKey.startsWith('kair_test_')) {
    fail('03_createKeyA', 'key A no tiene prefijo kair_test_', entry.firmaApiKey ? entry.firmaApiKey.slice(0, 20) : 'null');
    return false;
  }
  ctx.keyA = entry.firmaApiKey;
  ctx.keyAHashPrefix = r.data.apiKeyHashPrefix;
  pass('03_createKeyA', 'A creada · hash_prefix=' + r.data.apiKeyHashPrefix + ' · key NO propagada al renderer');
  return true;
}

// ---- Paso 4: crear key B ----
async function step04_createKeyB() {
  var r = await invoke('firma:empresa:create', {
    companyName: EMPRESA_B.displayName,
    idEmpresa: EMPRESA_B.nit,
    displayName: EMPRESA_B.displayName
  });
  if (!r.success) {
    fail('04_createKeyB', 'empresa:create B falló', JSON.stringify(r).slice(0, 500));
    return false;
  }
  var s = readSecretsRaw();
  var entry = s && s.empresas && s.empresas[EMPRESA_B.displayName];
  if (!entry || !entry.firmaApiKey) {
    fail('04_createKeyB', 'secrets.enc.empresas[B] no tiene firmaApiKey', '');
    return false;
  }
  ctx.keyB = entry.firmaApiKey;
  ctx.keyBHashPrefix = r.data.apiKeyHashPrefix;
  pass('04_createKeyB', 'B creada · hash_prefix=' + r.data.apiKeyHashPrefix + ' · key NO propagada al renderer');
  return true;
}

// ---- Paso 5: listar y verificar aislamiento en secrets.enc ----
async function step05_listConfiguredEmpresas() {
  var r = await invoke('firma:empresa:list', {});
  if (!r.success) {
    fail('05_listConfiguredEmpresas', 'empresa:list falló', JSON.stringify(r).slice(0, 500));
    return false;
  }
  if (!r.data.configured || r.data.configured.length !== 2) {
    fail('05_listConfiguredEmpresas', 'expected 2 configured, got ' + (r.data.configured && r.data.configured.length), JSON.stringify(r.data));
    return false;
  }
  // Verificar que la respuesta NO contiene la api_key en plaintext
  for (var i = 0; i < r.data.configured.length; i++) {
    var c = r.data.configured[i];
    if (c.firmaApiKey) {
      fail('05_listConfiguredEmpresas', 'firmaApiKey leak en empresa:list! (item ' + i + ')', '');
      return false;
    }
    if (!c.idEmpresa) {
      fail('05_listConfiguredEmpresas', 'item sin idEmpresa', JSON.stringify(c));
      return false;
    }
  }
  pass('05_listConfiguredEmpresas', '2 configured · sin leak de firmaApiKey · cada una con su idEmpresa');
  return true;
}

// ---- Paso 6: verificar que las keys son distintas (aislamiento material) ----
async function step06_keysAreDistinct() {
  if (!ctx.keyA || !ctx.keyB) {
    fail('06_keysAreDistinct', 'keys no capturadas en pasos previos', '');
    return false;
  }
  if (ctx.keyA === ctx.keyB) {
    fail('06_keysAreDistinct', 'A y B tienen la MISMA key!', '');
    return false;
  }
  if (ctx.keyAHashPrefix === ctx.keyBHashPrefix) {
    fail('06_keysAreDistinct', 'A y B tienen el mismo hash_prefix!', '');
    return false;
  }
  pass('06_keysAreDistinct', 'key A != key B · hash_prefix A != hash_prefix B (entropía independiente)');
  return true;
}

// ---- Paso 7: sign request como A ----
async function step07_signRequestAsA() {
  var pdf = makeFakePdf();
  var acuerdoTexto = 'Acuerdo de uso K+AIR Firma Electrónica v1 (E2E multiempresa).';
  var agreementHash = crypto.createHash('sha256').update(acuerdoTexto, 'utf-8').digest('hex');
  var documentHash = crypto.createHash('sha256').update(pdf).digest('hex');
  var r = await invoke('firma:sign-request:create', {
    companyName: EMPRESA_A.displayName,
    metadata: {
      id_documento: 'do-mc-A-001',
      id_trabajador: 'bp-mc-A-001',
      id_empresa: EMPRESA_A.nit,
      tipo_firma: 'remoto',
      agreement_version: 'v1.0',
      agreement_hash: agreementHash,
      document_hash: documentHash,
      version_kair: '0.1.191-e2e-mc',
      ttl_horas: 24
    },
    pdfBuffer: pdf,
    pdfName: 'contrato-mc-A.pdf'
  });
  if (!r.success) {
    fail('07_signRequestAsA', 'falló', JSON.stringify(r).slice(0, 500));
    return false;
  }
  var id = r.data && (r.data.id_solicitud || r.data.id);
  if (!id) {
    fail('07_signRequestAsA', 'response sin id_solicitud', JSON.stringify(r).slice(0, 300));
    return false;
  }
  ctx.signReqA_id = id;
  ctx.signReqA_data = r.data;
  pass('07_signRequestAsA', 'id_solicitud=' + id);
  return true;
}

// ---- Paso 8: sign request como B ----
async function step08_signRequestAsB() {
  var pdf = makeFakePdf();
  var acuerdoTexto = 'Acuerdo de uso K+AIR Firma Electrónica v1 (E2E multiempresa).';
  var agreementHash = crypto.createHash('sha256').update(acuerdoTexto, 'utf-8').digest('hex');
  var documentHash = crypto.createHash('sha256').update(pdf).digest('hex');
  var r = await invoke('firma:sign-request:create', {
    companyName: EMPRESA_B.displayName,
    metadata: {
      id_documento: 'do-mc-B-001',
      id_trabajador: 'bp-mc-B-001',
      id_empresa: EMPRESA_B.nit,
      tipo_firma: 'remoto',
      agreement_version: 'v1.0',
      agreement_hash: agreementHash,
      document_hash: documentHash,
      version_kair: '0.1.191-e2e-mc',
      ttl_horas: 24
    },
    pdfBuffer: pdf,
    pdfName: 'contrato-mc-B.pdf'
  });
  if (!r.success) {
    fail('08_signRequestAsB', 'falló', JSON.stringify(r).slice(0, 500));
    return false;
  }
  var id = r.data && (r.data.id_solicitud || r.data.id);
  if (!id) {
    fail('08_signRequestAsB', 'response sin id_solicitud', JSON.stringify(r).slice(0, 300));
    return false;
  }
  ctx.signReqB_id = id;
  ctx.signReqB_data = r.data;
  pass('08_signRequestAsB', 'id_solicitud=' + id);
  return true;
}

// ---- Paso 9: A ve su propio sign request ----
async function step09_A_canReadOwn() {
  var r = await invoke('firma:sign-request:get', {
    companyName: EMPRESA_A.displayName,
    id: ctx.signReqA_id
  });
  if (!r.success) {
    fail('09_A_canReadOwn', 'A no pudo leer su propio sign request', JSON.stringify(r).slice(0, 300));
    return false;
  }
  if (r.data.id_solicitud !== ctx.signReqA_id) {
    fail('09_A_canReadOwn', 'id_solicitud != esperado', JSON.stringify(r).slice(0, 300));
    return false;
  }
  pass('09_A_canReadOwn', 'A lee su propio id_solicitud=' + r.data.id_solicitud + ' (estado=' + r.data.estado + ')');
  return true;
}

// ---- Paso 10: B ve su propio sign request ----
async function step10_B_canReadOwn() {
  var r = await invoke('firma:sign-request:get', {
    companyName: EMPRESA_B.displayName,
    id: ctx.signReqB_id
  });
  if (!r.success) {
    fail('10_B_canReadOwn', 'B no pudo leer su propio sign request', JSON.stringify(r).slice(0, 300));
    return false;
  }
  if (r.data.id_solicitud !== ctx.signReqB_id) {
    fail('10_B_canReadOwn', 'id_solicitud != esperado', JSON.stringify(r).slice(0, 300));
    return false;
  }
  pass('10_B_canReadOwn', 'B lee su propio id_solicitud=' + r.data.id_solicitud + ' (estado=' + r.data.estado + ')');
  return true;
}

// ---- Paso 11: A NO puede leer sign request de B (cross-company) ----
async function step11_A_cannotReadB() {
  var r = await invoke('firma:sign-request:get', {
    companyName: EMPRESA_A.displayName,
    id: ctx.signReqB_id
  });
  if (r.success) {
    fail('11_A_cannotReadB', 'A LOGRÓ leer sign request de B (LEAK!)', JSON.stringify(r).slice(0, 300));
    return false;
  }
  // Se espera error 404 NOT_FOUND o 403 FORBIDDEN/EMPRESA_MISMATCH
  var code = r.error && r.error.code;
  if (code !== 'NOT_FOUND' && code !== 'FORBIDDEN' && code !== 'EMPRESA_MISMATCH') {
    fail('11_A_cannotReadB', 'error code inesperado: ' + code, JSON.stringify(r).slice(0, 300));
    return false;
  }
  pass('11_A_cannotReadB', 'A es rechazado al leer sign de B · code=' + code);
  return true;
}

// ---- Paso 12: A intenta crear sign request con id_empresa=B (metadata mismatch) ----
async function step12_A_cannotImpersonateB() {
  var pdf = makeFakePdf();
  var acuerdoTexto = 'Acuerdo de uso K+AIR Firma Electrónica v1 (E2E multiempresa).';
  var agreementHash = crypto.createHash('sha256').update(acuerdoTexto, 'utf-8').digest('hex');
  var documentHash = crypto.createHash('sha256').update(pdf).digest('hex');
  var r = await invoke('firma:sign-request:create', {
    companyName: EMPRESA_A.displayName,  // autenticado como A
    metadata: {
      id_documento: 'do-mc-leak-001',
      id_trabajador: 'bp-mc-leak-001',
      id_empresa: EMPRESA_B.nit,         // ... pero metadata dice B
      tipo_firma: 'remoto',
      agreement_version: 'v1.0',
      agreement_hash: agreementHash,
      document_hash: documentHash,
      version_kair: '0.1.191-e2e-mc',
      ttl_horas: 24
    },
    pdfBuffer: pdf,
    pdfName: 'leak-attempt.pdf'
  });
  if (r.success) {
    fail('12_A_cannotImpersonateB', 'A pudo crear sign con id_empresa de B (LEAK!)', JSON.stringify(r).slice(0, 300));
    return false;
  }
  var code = r.error && r.error.code;
  if (code !== 'EMPRESA_MISMATCH' && code !== 'FORBIDDEN' && code !== 'INVALID_REQUEST_BODY') {
    fail('12_A_cannotImpersonateB', 'error code inesperado: ' + code, JSON.stringify(r).slice(0, 300));
    return false;
  }
  pass('12_A_cannotImpersonateB', 'A es rechazado al impersonar B · code=' + code);
  return true;
}

// ---- Paso 13: rotar key de A ----
async function step13_rotateKeyA() {
  // Guardar la key vieja antes de rotar
  ctx.keyA_old = ctx.keyA;
  ctx.keyA_old_hash_prefix = ctx.keyAHashPrefix;

  var r = await invoke('firma:empresa:rotate-api-key', {
    companyName: EMPRESA_A.displayName,
    motivo: 'E2E test rotation',
    actor: 'e2e-mc'
  });
  if (!r.success) {
    fail('13_rotateKeyA', 'rotate-api-key A falló', JSON.stringify(r).slice(0, 500));
    return false;
  }
  if (r.data.newApiKey) {
    fail('13_rotateKeyA', 'newApiKey leak en response (DR-3 violation!)', '');
    return false;
  }
  if (r.data.oldApiKeyHashPrefix !== ctx.keyA_old_hash_prefix) {
    fail('13_rotateKeyA', 'oldApiKeyHashPrefix != keyA_old_hash_prefix', 'old=' + r.data.oldApiKeyHashPrefix + ' expected=' + ctx.keyA_old_hash_prefix);
    return false;
  }
  if (!r.data.newApiKeyHashPrefix || r.data.newApiKeyHashPrefix === ctx.keyA_old_hash_prefix) {
    fail('13_rotateKeyA', 'newApiKeyHashPrefix == old (no rotó!)', '');
    return false;
  }
  // Verificar que secrets.enc tiene la NUEVA key
  var s = readSecretsRaw();
  var entry = s && s.empresas && s.empresas[EMPRESA_A.displayName];
  if (!entry || !entry.firmaApiKey || entry.firmaApiKey === ctx.keyA_old) {
    fail('13_rotateKeyA', 'secrets.enc no tiene la key nueva', '');
    return false;
  }
  ctx.keyA = entry.firmaApiKey;
  ctx.keyAHashPrefix = r.data.newApiKeyHashPrefix;
  pass('13_rotateKeyA', 'key A rotada · old_hash=' + r.data.oldApiKeyHashPrefix + ' · new_hash=' + r.data.newApiKeyHashPrefix);
  return true;
}

// ---- Paso 14: key vieja de A NO funciona ----
async function step14_oldKeyAFails() {
  if (!ctx.keyA_old) {
    fail('14_oldKeyAFails', 'keyA_old no capturada', '');
    return false;
  }
  // Crear un FirmaClient "raw" con la key vieja y tratar de hacer sign
  var rawClient = createRawClient(ctx.keyA_old, 'e2e-mc-oldkey-' + Date.now());
  var pdf = makeFakePdf();
  var acuerdoTexto = 'Acuerdo de uso K+AIR Firma Electrónica v1 (E2E multiempresa).';
  var agreementHash = crypto.createHash('sha256').update(acuerdoTexto, 'utf-8').digest('hex');
  var documentHash = crypto.createHash('sha256').update(pdf).digest('hex');
  var r = await rawClient.createSignRequest({
    metadata: {
      id_documento: 'do-mc-oldkey-001',
      id_trabajador: 'bp-mc-oldkey-001',
      id_empresa: EMPRESA_A.nit,
      tipo_firma: 'remoto',
      agreement_version: 'v1.0',
      agreement_hash: agreementHash,
      document_hash: documentHash,
      version_kair: '0.1.191-e2e-mc',
      ttl_horas: 24
    },
    pdfBuffer: pdf,
    pdfName: 'old-key-attempt.pdf'
  });
  if (r.success) {
    fail('14_oldKeyAFails', 'key vieja A TODAVÍA funciona (revocación no aplicada!)', JSON.stringify(r).slice(0, 300));
    return false;
  }
  var code = r.error && r.error.code;
  if (code !== 'INVALID_API_KEY' && code !== 'NOT_FOUND' && code !== 'FORBIDDEN') {
    fail('14_oldKeyAFails', 'error code inesperado: ' + code, JSON.stringify(r).slice(0, 300));
    return false;
  }
  pass('14_oldKeyAFails', 'key vieja A rechazada · code=' + code + ' (revocación efectiva)');
  return true;
}

// ---- Paso 15: nueva key de A funciona (vía bridge) ----
async function step15_newKeyAWorks() {
  var pdf = makeFakePdf();
  var acuerdoTexto = 'Acuerdo de uso K+AIR Firma Electrónica v1 (E2E multiempresa).';
  var agreementHash = crypto.createHash('sha256').update(acuerdoTexto, 'utf-8').digest('hex');
  var documentHash = crypto.createHash('sha256').update(pdf).digest('hex');
  // El bridge YA está usando la key nueva (se actualizó en paso 13).
  var r = await invoke('firma:sign-request:create', {
    companyName: EMPRESA_A.displayName,
    metadata: {
      id_documento: 'do-mc-A-newkey-001',
      id_trabajador: 'bp-mc-A-newkey-001',
      id_empresa: EMPRESA_A.nit,
      tipo_firma: 'remoto',
      agreement_version: 'v1.0',
      agreement_hash: agreementHash,
      document_hash: documentHash,
      version_kair: '0.1.191-e2e-mc',
      ttl_horas: 24
    },
    pdfBuffer: pdf,
    pdfName: 'new-key-A.pdf'
  });
  if (!r.success) {
    fail('15_newKeyAWorks', 'nueva key A no funciona vía bridge', JSON.stringify(r).slice(0, 500));
    return false;
  }
  pass('15_newKeyAWorks', 'A crea sign con la key rotada · id_solicitud=' + (r.data && (r.data.id_solicitud || r.data.id)));
  return true;
}

// ---- Paso 16: ALREADY_CONFIGURED (DR-6.C) ----
async function step16_alreadyConfigured() {
  // Intentar crear A de nuevo → debe retornar ALREADY_CONFIGURED sin HTTP.
  // Para validar "sin HTTP", confiamos en el mensaje: si el pre-chequeo falla,
  // retorna error INMEDIATO (sin success). Si el HTTP se hubiera hecho,
  // retornaría CLIENT_EXISTS_FOR_EMPRESA.
  var r = await invoke('firma:empresa:create', {
    companyName: EMPRESA_A.displayName,
    idEmpresa: EMPRESA_A.nit,
    displayName: EMPRESA_A.displayName
  });
  if (r.success) {
    fail('16_alreadyConfigured', 'empresa:create A duplicada tuvo éxito (debería fallar)', JSON.stringify(r).slice(0, 300));
    return false;
  }
  var code = r.error && r.error.code;
  if (code !== 'ALREADY_CONFIGURED') {
    fail('16_alreadyConfigured', 'code != ALREADY_CONFIGURED, got: ' + code, JSON.stringify(r).slice(0, 300));
    return false;
  }
  // El response debe incluir idEmpresa del que ya existe
  if (!r.error.extra || r.error.extra.idEmpresa !== EMPRESA_A.nit) {
    fail('16_alreadyConfigured', 'extra.idEmpresa != EMPRESA_A.nit', JSON.stringify(r.error).slice(0, 300));
    return false;
  }
  pass('16_alreadyConfigured', 'pre-chequeo OK · code=' + code + ' · sin HTTP');
  return true;
}

// ---- Paso 17: persistencia de secrets.enc ----
async function step17_secretsPersistence() {
  var s = readSecretsRaw();
  if (!s) {
    fail('17_secretsPersistence', 'secrets.enc no existe', '');
    return false;
  }
  if (s.version !== 2) {
    fail('17_secretsPersistence', 'version != 2', 'version=' + s.version);
    return false;
  }
  if (!s.firmaServiceUrl || !s.adminApiKey) {
    fail('17_secretsPersistence', 'faltan campos top-level', JSON.stringify(s).slice(0, 300));
    return false;
  }
  var aEntry = s.empresas && s.empresas[EMPRESA_A.displayName];
  var bEntry = s.empresas && s.empresas[EMPRESA_B.displayName];
  if (!aEntry || !aEntry.firmaApiKey || aEntry.idEmpresa !== EMPRESA_A.nit) {
    fail('17_secretsPersistence', 'A entry incorrecta', JSON.stringify(aEntry).slice(0, 200));
    return false;
  }
  if (!bEntry || !bEntry.firmaApiKey || bEntry.idEmpresa !== EMPRESA_B.nit) {
    fail('17_secretsPersistence', 'B entry incorrecta', JSON.stringify(bEntry).slice(0, 200));
    return false;
  }
  if (aEntry.firmaApiKey === bEntry.firmaApiKey) {
    fail('17_secretsPersistence', 'A y B tienen la misma key persistida!', '');
    return false;
  }
  pass('17_secretsPersistence', 'secrets.enc v2 con 2 empresas + adminKey + URL persistidos');
  return true;
}

// ---- Paso 18: reiniciar servicio y verificar que las keys siguen funcionando ----
async function step18_restartService() {
  log('--- Reiniciando firma-service (mismo DB_PATH) ---');
  stopService();
  await new Promise(function (r) { setTimeout(r, 2000); });
  startService();
  await waitForHealth(30000);

  // Verificar que la key de A (post-rotación) sigue funcionando tras restart
  var pdf = makeFakePdf();
  var acuerdoTexto = 'Acuerdo de uso K+AIR Firma Electrónica v1 (E2E multiempresa).';
  var agreementHash = crypto.createHash('sha256').update(acuerdoTexto, 'utf-8').digest('hex');
  var documentHash = crypto.createHash('sha256').update(pdf).digest('hex');
  var rA = await invoke('firma:sign-request:create', {
    companyName: EMPRESA_A.displayName,
    metadata: {
      id_documento: 'do-mc-A-postrestart-001',
      id_trabajador: 'bp-mc-A-postrestart-001',
      id_empresa: EMPRESA_A.nit,
      tipo_firma: 'remoto',
      agreement_version: 'v1.0',
      agreement_hash: agreementHash,
      document_hash: documentHash,
      version_kair: '0.1.191-e2e-mc',
      ttl_horas: 24
    },
    pdfBuffer: pdf,
    pdfName: 'post-restart-A.pdf'
  });
  if (!rA.success) {
    fail('18_restartService', 'A no funciona tras restart', JSON.stringify(rA).slice(0, 500));
    return false;
  }
  var rB = await invoke('firma:sign-request:create', {
    companyName: EMPRESA_B.displayName,
    metadata: {
      id_documento: 'do-mc-B-postrestart-001',
      id_trabajador: 'bp-mc-B-postrestart-001',
      id_empresa: EMPRESA_B.nit,
      tipo_firma: 'remoto',
      agreement_version: 'v1.0',
      agreement_hash: agreementHash,
      document_hash: documentHash,
      version_kair: '0.1.191-e2e-mc',
      ttl_horas: 24
    },
    pdfBuffer: pdf,
    pdfName: 'post-restart-B.pdf'
  });
  if (!rB.success) {
    fail('18_restartService', 'B no funciona tras restart', JSON.stringify(rB).slice(0, 500));
    return false;
  }
  pass('18_restartService', 'servicio reiniciado · A crea id=' + (rA.data && (rA.data.id_solicitud || rA.data.id)) + ' · B crea id=' + (rB.data && (rB.data.id_solicitud || rB.data.id)));
  return true;
}

// ============================================================================
//  Main
// ============================================================================
async function main() {
  log('====================================================================');
  log('  E2E REAL MULTI-EMPRESA — K+AIR bridge ↔ firma-service');
  log('  Empresa A: ' + EMPRESA_A.displayName + ' (' + EMPRESA_A.nit + ')');
  log('  Empresa B: ' + EMPRESA_B.displayName + ' (' + EMPRESA_B.nit + ')');
  log('  Admin key: ' + ADMIN_API_KEY);
  log('  DB:        ' + DB_PATH);
  log('  userData:  ' + _tmpUserData);
  log('====================================================================');
  log('');

  cleanup();
  startService();
  process.on('exit', stopService);
  process.on('SIGINT', function () { stopService(); process.exit(1); });

  try {
    log('--- Pasos 1-6: setup + crear empresas ---');
    await step01_startAndSeed();
    await step02_configureBridge();
    await step03_createKeyA();
    await step04_createKeyB();
    await step05_listConfiguredEmpresas();
    await step06_keysAreDistinct();
    log('');

    log('--- Pasos 7-12: sign requests + aislamiento ---');
    await step07_signRequestAsA();
    await step08_signRequestAsB();
    await step09_A_canReadOwn();
    await step10_B_canReadOwn();
    await step11_A_cannotReadB();
    await step12_A_cannotImpersonateB();
    log('');

    log('--- Pasos 13-16: rotación + ALREADY_CONFIGURED ---');
    await step13_rotateKeyA();
    await step14_oldKeyAFails();
    await step15_newKeyAWorks();
    await step16_alreadyConfigured();
    log('');

    log('--- Pasos 17-18: persistencia + restart ---');
    await step17_secretsPersistence();
    await step18_restartService();
    log('');

  } catch (e) {
    fail('FATAL', e.message, e.stack);
  } finally {
    stopService();
    await new Promise(function (r) { setTimeout(r, 1500); });
    // Cleanup tmpdir
    try { fs.rmSync(_tmpUserData, { recursive: true, force: true }); } catch (_) {}
    // Cleanup del mock file que creamos para interceptar require('electron').
    // Si se nos olvidó, queda un archivo untracked en el repo.
    try { fs.unlinkSync(path.join(__dirname, '__mock_electron_e2e_mc.js')); } catch (_) {}
  }

  // Resumen
  log('====================================================================');
  log('  Resumen E2E Multi-Empresa');
  log('====================================================================');
  let passCount = 0, failCount = 0;
  for (const r of results) {
    log('  ' + (r.ok ? '✓' : '✗') + ' ' + r.step + ' — ' + r.message);
    if (r.ok) passCount++; else failCount++;
  }
  log('');
  log('  ' + passCount + ' OK · ' + failCount + ' FAIL');
  log('====================================================================');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(function (e) {
  log('FATAL: ' + e.message);
  log(e.stack);
  stopService();
  process.exit(1);
});
