/**
 * Helpers compartidos por los tests.
 *
 * - resetDb: limpia todas las tablas gh_* (entre tests).
 * - seedActiveAgreement: crea una versión activa del Acuerdo.
 * - makeApp: crea una app Express con todas las rutas (para tests E2E).
 *
 * NOTA: El aislamiento de tests contra la BD de desarrollo se hace en
 * tests/setup.js, que se carga con --require ANTES que este archivo.
 * Ver package.json script "test".
 */
'use strict';

// Ensure test environment when loaded directly (not via setup.js).
// dotenv may have set NODE_ENV=production from .env.
if (process.env.NODE_ENV !== 'test') {
  process.env.NODE_ENV = 'test';
  // Bust config cache so it re-reads NODE_ENV=test
  delete require.cache[require.resolve('../src/config')];
}

const path = require('path');
const express = require('express');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/db/connection');
const config = require('../src/config');
const agreementRouter = require('../src/routes/agreement');
const consentRouter = require('../src/routes/consent');
const signRequestRouter = require('../src/routes/signRequest');
const publicRouter = require('../src/routes/public');
const adminRouter = require('../src/routes/admin');
const adminClientesRouter = require('../src/routes/admin-clientes');
const internalAuditRouter = require('../src/routes/internal-audit');
const constanciaRouter = require('../src/routes/constancia');
const verificacionRouter = require('../src/routes/verificacion');
const { errorHandler } = require('../src/middleware/errors');
const agreementService = require('../src/services/agreement');
const mailer = require('../src/services/mailer');
const storage = require('../src/services/storage');
const logger = require('../src/utils/logger');

// Mini-app estática (mismo directorio que server.js)
const MINI_APP_DIR = path.resolve(__dirname, '..', 'web', 'firma');

const TEST_API_KEY = 'test-internal-api-key-32-bytes-min!!';
const TEST_ADMIN_API_KEY = 'test-admin-api-key-32-bytes-min!!!!!';

// I-010 (D-13): API keys per-company para tests de cross-company.
// TEST_API_KEY sigue siendo la legacy key (en config.auth.internalApiKey).
// TEST_API_KEY_CLIENT_A y TEST_API_KEY_CLIENT_B son keys de clientes
// per-empresa sembrados en gh_internal_clients vía seedTestClients().
const TEST_API_KEY_CLIENT_A = 'test-clientA-internal-api-key-32bytes!!';
const TEST_API_KEY_CLIENT_B = 'test-clientB-internal-api-key-32bytes!!';
const TEST_EMPRESA_A = '900123456';
const TEST_EMPRESA_B = '900999999';

// Sobrescribir las API keys en config (objeto mutable) para que los
// middlewares de auth usen las keys de test.
config.auth.internalApiKey = TEST_API_KEY;
config.auth.adminApiKey = TEST_ADMIN_API_KEY;

const TABLES = [
  // FASE 3 (A1.5.4-B): gh_consentimientos_eventos debe borrarse ANTES de
  // gh_consentimientos_firma porque tiene FK a ella. Si se borrara al revés,
  // el DELETE FROM gh_consentimientos_firma fallaría con FOREIGN KEY
  // constraint failed.
  'gh_consentimientos_eventos',
  'gh_consentimientos_firma',
  'gh_firma_acuerdo_versiones',
  'gh_firma_eventos',
  'gh_firma_sesiones',
  'gh_firmas_electronicas',
  // I-010 (D-13): tabla de clientes internos per-company authz.
  // Se limpia entre tests para que cada test arme sus propios clientes
  // (o use los sembrados por seedTestClients() que se llama explícitamente).
  'gh_internal_clients',
  // I-003 (idempotency): la tabla gh_idempotency_keys NO se limpiaba antes
  // en cada test (los tests del service lo hacían manualmente con
  // `db.prepare('DELETE FROM gh_idempotency_keys').run()`). I-003.3 (middleware
  // tests) necesita que la BD esté limpia entre tests porque el middleware
  // corre sobre el service: una fila de un test anterior haría que un test
  // nuevo vea isReplay=true cuando esperaba isNew. Se añade acá para que
  // resetDb() sea completo y los tests del middleware no necesiten
  // duplicar la limpieza. Modificación mínima y aislada a tests/helpers.js.
  'gh_idempotency_keys',
  // NO incluir gh_firma_schema_migrations:
  //   - Es metadata del schema (qué migraciones se aplicaron), NO data de test.
  //   - Si resetDb() la limpia, el siguiente proceso ve la tabla vacía y
  //     migrate() intenta reaplicar TODAS las migraciones, incluyendo 005
  //     (12-step) que NO es idempotente → falla con "46 cols vs 47 vals".
  //   - El pretest (scripts/migrate-test.js) regenera la BD desde cero
  //     al inicio de `npm test`, así que el estado del schema se establece
  //     una sola vez y se preserva durante toda la suite.
];

function resetDb() {
  // Tablas de la ventana de purga (migración 020) y de holds (migración 023).
  // Se limpian PRIMERO, antes que las firmas, porque el lote tiene FK a
  // gh_firmas_electronicas: borrarla con el lote lleno viola la FK. La
  // migración 020 se salta en el ambiente de test, así que estas tablas
  // pueden no existir: se limpian solo si están.
  for (const t of ['gh_firma_purga_lote', 'gh_firma_purga_log', 'gh_firma_purga_registro', 'gh_firma_holds']) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch (e) { /* la tabla no existe */ }
  }
  try {
    db.prepare(
      "UPDATE gh_firma_purga_control SET ventana_activa = 0, cerrada_at = datetime('now') WHERE id = 1"
    ).run();
  } catch (e) { /* la tabla no existe */ }
  for (const t of TABLES) {
    db.prepare(`DELETE FROM ${t}`).run();
  }
  // Resetear AUTOINCREMENT para evitar que IDs acumulen entre tests
  // (causa de flakiness cuando un test asume id=1 pero el siguiente
  // test ve id=N del test anterior).
  try {
    db.prepare(`
      DELETE FROM sqlite_sequence
      WHERE name IN (
        'gh_firmas_electronicas',
        'gh_consentimientos_firma',
        'gh_firma_eventos',
        'gh_firma_sesiones',
        'gh_firma_acuerdo_versiones',
        'gh_consentimientos_eventos'
      )
    `).run();
  } catch (e) { /* sqlite_sequence no existe en algunas BDs */ }
  mailer.clearDevInbox();
  // I-010: limpiar cache de internalClient para que no haya entradas stale
  // de tests anteriores. El cache es por proceso (no por test).
  try {
    require('../src/services/internalClient').clearCache();
  } catch (e) { /* ignore si internalClient no está cargado todavía */ }
  // Borrar PDFs del storage
  for (const dir of [storage.PATHS.originales, storage.PATHS.firmados, storage.PATHS.constancias]) {
    try {
      const fs = require('fs');
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.pdf') || f.endsWith('.bin')) {
          fs.unlinkSync(require('path').join(dir, f));
        }
      }
    } catch (e) { /* ignore */ }
  }
}

function seedActiveAgreement({ version = 'v1.0', texto = 'ACUERDO DE PRUEBA\nVersión v1.0' } = {}) {
  return agreementService.createVersion({
    version,
    texto,
    creado_por: 'test',
    kair_version: '0.1.189-test',
    activa: true,
  });
}

function makeApp() {
  const app = express();
  // Body parser con límite de 100MB para que los tests de /verify-pdf
  // puedan probar el check interno de tamaño del handler (50MB+).
  // En producción el server.js usa el límite default de 100kb del body-parser,
  // que es suficiente para casos reales (PDFs de 1-5MB → JSON de 1.4-7MB).
  app.use(express.json({ limit: '100mb' }));
  // Mini-app estática (mismo comportamiento que server.js)
  app.use('/s', express.static(MINI_APP_DIR, {
    index: false,
    fallthrough: true,
  }));
  app.use('/', publicRouter);
  app.use('/internal', agreementRouter);
  app.use('/internal', consentRouter);
  app.use('/internal', signRequestRouter);
  app.use('/internal', constanciaRouter);
  app.use('/internal', internalAuditRouter);
  // Oráculo de verificación de identidad (Fase 3).
  app.use('/internal', verificacionRouter);
  // Endpoints administrativos: deben estar en makeApp para tests.
  // Hay 2 routers: el viejo (acuerdo-versiones) y el nuevo (per-company clientes).
  app.use('/internal/admin', adminRouter);
  app.use('/internal/admin', adminClientesRouter);
  app.use(errorHandler());
  return app;
}

/**
 * Crea un consentimiento ACEPTADO para (id_trabajador, id_empresa, version).
 * Helper para tests del Bloque E6 (sign request ↔ consent linkage).
 *
 * Si el Acuerdo activo no está sembrado, llama a seedActiveAgreement().
 * Crea el consentimiento vía API (POST /internal/consentimientos) y
 * acepta el OTP vía API (POST /internal/consentimientos/:id/verify-otp).
 *
 * Retorna { consent_id, ... } con el id del consentimiento aceptado.
 */
async function createAcceptedConsent({
  id_trabajador = '1234567890',
  id_empresa = '900123456',
  version_acuerdo = 'v1.0',
  correo = 'trabajador@example.com',
  kair_version = '0.1.189-test',
} = {}) {
  const request = require('supertest');
  const app = makeApp();
  const apiKey = TEST_API_KEY;

  // Asegurar Acuerdo activo
  const acuerdo = require('../src/services/agreement').getActive();
  if (!acuerdo) seedActiveAgreement({ version: version_acuerdo });

  // Crear consentimiento
  const r1 = await request(app)
    .post('/internal/consentimientos')
    .set('X-Internal-API-Key', apiKey)
    .send({
      id_trabajador,
      id_empresa,
      version_acuerdo,
      correo_verificacion: correo,
      kair_version,
    });

  if (r1.status !== 201) {
    throw new Error(
      `createAcceptedConsent: no se pudo crear consentimiento ` +
      `(status=${r1.status}, body=${JSON.stringify(r1.body)})`
    );
  }

  const consentId = r1.body.consent_id;
  const otp = r1.body.devOtp;

  // Aceptar el OTP
  const r2 = await request(app)
    .post(`/internal/consentimientos/${consentId}/verify-otp`)
    .set('X-Internal-API-Key', apiKey)
    .send({ otp, kair_version });

  if (r2.status !== 200 || r2.body.manifestacion_aceptada !== true) {
    throw new Error(
      `createAcceptedConsent: no se pudo aceptar OTP ` +
      `(status=${r2.status}, body=${JSON.stringify(r2.body)})`
    );
  }

  return { consent_id: consentId, id_trabajador, id_empresa, version_acuerdo };
}

const { sha256 } = require('../src/crypto/hash');

/**
 * Crea un Sign Request con datos de identificación.
 * Helper para tests del flujo público.
 *
 * Siembra automáticamente un Acuerdo activo v1.0 con texto fijo, de modo que
 * la validación 5-pasos de agreement_version obligatorio (Bloque A) pase.
 * Si el test quiere usar una versión o hash diferente, puede sobreescribirlo
 * con `agreement_version` o `agreement_hash` en overrides.
 */
async function createSignRequestWithIdentificacion({
  id_documento = 'doc-001',
  id_trabajador = '1234567890',
  id_empresa = '900123456',
  tipo_firma = 'presencial',
  identificacion_tipo = 'CC',
  identificacion_numero = '1234567890',
  // I-002: categoría del documento que se firma (CONTRATO, OTROSI, etc.).
  // Por defecto null (compatibilidad con sign requests legacy pre-007).
  tipo_identificacion = null,
  metadata = JSON.stringify({ correo: 'trabajador@test.com' }),
  ...overrides
} = {}) {
  // Sembrar Acuerdo activo (si no hay uno) y usar su texto_hash/version reales.
  // El helper de tests/testAgreementFixture v1.0 usa texto fijo, así que el
  // texto_hash es estable entre llamadas que parten de BD limpia (resetDb).
  const acuerdo = agreementService.getActive() || seedActiveAgreement();

  const signRequestService = require('../src/services/signRequest');
  const { PDFDocument } = require('pdf-lib');
  // Crear PDF válido con pdf-lib
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([300, 200]);
  page.drawText('Documento de prueba');
  const pdf = Buffer.from(await pdfDoc.save());
  return signRequestService.create({
    id_documento, id_trabajador, id_empresa, tipo_firma,
    agreement_version: acuerdo.version,
    agreement_hash: acuerdo.texto_hash,
    document_hash: sha256(pdf),
    pdf_buffer: pdf,
    pdf_filename: 'test.pdf',
    version_kair: '0.1.189-test',
    identificacion_tipo,
    identificacion_numero_hash: sha256(identificacion_numero),
    tipo_identificacion,
    metadata,
    ...overrides,
  });
}

function withApiKey(req) {
  return req.set('X-Internal-API-Key', TEST_API_KEY);
}

function withAdminApiKey(req) {
  return req.set('X-Admin-API-Key', TEST_ADMIN_API_KEY);
}

// I-010 (D-13): helpers per-empresa. Usan las API keys sembradas por
// seedTestClients(). El cache del service se limpia en resetDb().
function withClientAApiKey(req) {
  return req.set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);
}

function withClientBApiKey(req) {
  return req.set('X-Internal-API-Key', TEST_API_KEY_CLIENT_B);
}

function withLegacyApiKey(req) {
  return req.set('X-Internal-API-Key', TEST_API_KEY);
}

/**
 * Siembra 2 clientes per-empresa en gh_internal_clients.
 *   - Cliente A: id_empresa=900123456, allowed_operations=todas
 *   - Cliente B: id_empresa=900999999, allowed_operations=todas
 *
 * Se llama explícitamente en tests que necesitan el nuevo authz per-empresa
 * (cross-company). Los tests existentes siguen usando withApiKey() (legacy)
 * y no necesitan este helper.
 *
 * Idempotente: si los clientes ya existen (mismo hash), no duplica.
 * Llamar después de resetDb() (que limpia la tabla).
 */
/**
 * Crea un consentimiento en estado OTP_PENDING (sin verificar OTP).
 * Helper para tests del Bloque E6.5 (POST /api/sign/:token/consent/accept).
 *
 * A diferencia de `createAcceptedConsent`, esta función NO llama a
 * /verify-otp, así que el consentimiento queda listo para ser aceptado
 * por el endpoint /consent/accept (la 3ª casilla de la mini-app).
 *
 * Retorna { consent_id, ... } con el id del consentimiento pending.
 */
async function createPendingConsent({
  id_trabajador = '1234567890',
  id_empresa = '900123456',
  version_acuerdo = 'v1.0',
  correo = 'trabajador@example.com',
  kair_version = '0.1.189-test',
} = {}) {
  const request = require('supertest');
  const app = makeApp();
  const apiKey = TEST_API_KEY;

  // Asegurar Acuerdo activo
  const acuerdo = require('../src/services/agreement').getActive();
  if (!acuerdo) seedActiveAgreement({ version: version_acuerdo });

  // Crear consentimiento
  const r1 = await request(app)
    .post('/internal/consentimientos')
    .set('X-Internal-API-Key', apiKey)
    .send({
      id_trabajador,
      id_empresa,
      version_acuerdo,
      correo_verificacion: correo,
      kair_version,
    });

  if (r1.status !== 201) {
    throw new Error(
      `createPendingConsent: no se pudo crear consentimiento ` +
      `(status=${r1.status}, body=${JSON.stringify(r1.body)})`
    );
  }

  return {
    consent_id: r1.body.consent_id,
    id_trabajador,
    id_empresa,
    version_acuerdo,
  };
}

function seedTestClients() {
  const internalClient = require('../src/services/internalClient');
  const ALL_OPS = [
    'sign_request:create',
    'sign_request:read',
    'consent:create',
    'consent:verify',
    'audit:read',
    // Fase 3: oráculo de verificación de identidad. Se incluye para que
    // los tests puedan ejercitarlo; el cliente real tiene que pedir la
    // operación explícitamente (ver src/routes/admin-clientes.js).
    'verificacion:identidad',
  ].join(',');
  internalClient.createClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: ALL_OPS,
    description: 'TEST client A (empresa 900123456)',
    apiKey: TEST_API_KEY_CLIENT_A,
  });
  internalClient.createClient({
    id_empresa: TEST_EMPRESA_B,
    allowed_operations: ALL_OPS,
    description: 'TEST client B (empresa 900999999)',
    apiKey: TEST_API_KEY_CLIENT_B,
  });
}

/**
 * Afirma que una respuesta de error es el SOBRE JSON con el código esperado.
 *
 * Por qué no basta con `assert.equal(res.body.error.code, 'X')`:
 *
 * La superficie pública (`/s/*`, `/api/sign/*`) sirve el error como PÁGINA
 * HTML cuando el cliente no pide JSON. Una prueba que solo afirma
 * `res.body.error.code` no está probando el contrato que ve el integrador:
 * si la respuesta llega HTML, `res.body` es un objeto vacío y la aserción
 * revienta con "Cannot read properties of undefined" — un mensaje que no
 * dice nada del problema real. 47 pruebas fallaban exactamente por esto.
 *
 * Este helper afirma LAS DOS COSAS: que la respuesta vino en JSON y que el
 * código es el esperado. Si mañana alguien rompe la negociación, el test
 * falla por el motivo correcto.
 *
 * @param {object} res - respuesta de supertest
 * @param {string} expectedCode - código de error esperado
 * @returns {object} el sobre `error`, por si el test necesita más campos
 */
function assertJsonError(res, expectedCode) {
  const ct = (res && res.headers && res.headers['content-type']) || '';
  assert.match(ct, /application\/json/,
    'la respuesta de error debe ser JSON (content-type: ' + ct + '). ' +
    'Si llegó HTML, la negociación de contenido se rompió.');
  assert.ok(res && res.body && res.body.error,
    'la respuesta de error debe traer el sobre { error: { code, ... } }');
  assert.equal(res.body.error.code, expectedCode);
  return res.body.error;
}

/**
 * Igual que `assertJsonError` pero para las aserciones negativas
 * (`assert.notEqual(res.body.error.code, 'X')`): solo comprueba que la
 * respuesta vino en JSON, sin fijar un código.
 *
 * @param {object} res - respuesta de supertest
 */
function assertJsonResponse(res) {
  const ct = (res && res.headers && res.headers['content-type']) || '';
  assert.match(ct, /application\/json/,
    'la respuesta de error debe ser JSON (content-type: ' + ct + '). ' +
    'Si llegó HTML, la negociación de contenido se rompió.');
}

/**
 * Extrae el texto de un PDF generado con pdf-lib.
 *
 * pdf-lib escribe los content streams comprimidos (FlateDecode) y el texto
 * en forma HEX (`<4B2B414952> Tj`), no en la forma literal `(K+AIR) Tj`. Por
 * eso no basta con buscar la cadena en el buffer: hay que descomprimir los
 * streams y decodificar el hex.
 *
 * La decodificación es byte a byte (el PDF usa la codificación WinAnsi), así
 * que los caracteres españoles se leen bien; los que no existen en latin1
 * (guion largo, líneas de caja) salen como caracteres de control. Para las
 * aserciones conviene usar texto ASCII o acentos que sí cruzan.
 *
 * TRAMPA: el hex se toma con el GRUPO CAPTURADO, nunca con la coincidencia
 * entera. Si se hace `match.replace(/[<>\s]Tj/g, '')` los ángulos `<` y `>`
 * se quedan en la cadena (la clase de caracteres solo se come un carácter
 * cada vez, y `<` no va seguido de `Tj`), el hex queda desalineado un byte y
 * TODO el texto sale como basura: los tests que buscan una palabra pasan a
 * fallar por un motivo que no tiene que ver con lo que prueban.
 *
 * @param {Buffer} buffer - el PDF
 * @returns {string} el texto, un fragmento por línea
 */
function pdfText(buffer) {
  const zlib = require('zlib');
  const raw = Buffer.from(buffer).toString('latin1');
  let streams = '';
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const chunk = Buffer.from(m[1], 'latin1');
    let inflado;
    try {
      inflado = zlib.inflateSync(chunk).toString('latin1');
    } catch (e) {
      inflado = m[1];
    }
    streams += inflado;
  }
  const partes = [];
  const reTj = /<([0-9A-Fa-f]*)>\s*Tj/g;
  let t;
  while ((t = reTj.exec(streams)) !== null) {
    const hex = t[1];
    let s = '';
    for (let i = 0; i + 1 < hex.length; i += 2) {
      s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
    partes.push(s);
  }
  return partes.join('\n');
}

/**
 * Captura lo que el LOGGER registra mientras corre `fn`.
 *
 * NO parchea `process.stdout`: hacerlo roba la salida del runner de pruebas
 * (el runner escribe su TAP por el mismo stream), y esa linea se pierde en
 * pleno vuelo. Ver la nota de `_setSink` en src/utils/logger.js.
 *
 * @param {Function} fn - función sincrónica o asincrónica
 * @returns {Promise<{
 *   resultado: any,
 *   lineas: Array<{linea: string, nivel: string}>,
 *   objetos: Array<object>,
 *   texto: string,
 *   stdout: string,
 *   stderr: string
 * }>}
 */
async function capturarLogs(fn) {
  const lineas = [];
  logger._setSink((linea, nivel) => { lineas.push({ linea, nivel }); });
  try {
    const resultado = await fn();
    const objetos = lineas
      .map((l) => {
        try { return JSON.parse(l.linea); } catch (e) { return null; }
      })
      .filter(Boolean);
    return {
      resultado,
      lineas,
      objetos,
      texto: lineas.map((l) => l.linea).join('\n'),
      stdout: lineas.filter((l) => l.nivel === 'info' || l.nivel === 'debug')
        .map((l) => l.linea).join('\n'),
      stderr: lineas.filter((l) => l.nivel === 'warn' || l.nivel === 'error')
        .map((l) => l.linea).join('\n'),
    };
  } finally {
    logger._resetSink();
  }
}

module.exports = {
  resetDb,
  seedActiveAgreement,
  makeApp,
  withApiKey,
  withAdminApiKey,
  withClientAApiKey,
  withClientBApiKey,
  withLegacyApiKey,
  seedTestClients,
  createSignRequestWithIdentificacion,
  createAcceptedConsent,
  createPendingConsent,
  assertJsonError,
  assertJsonResponse,
  pdfText,
  capturarLogs,
  TEST_API_KEY,
  TEST_ADMIN_API_KEY,
  TEST_API_KEY_CLIENT_A,
  TEST_API_KEY_CLIENT_B,
  TEST_EMPRESA_A,
  TEST_EMPRESA_B,
};
