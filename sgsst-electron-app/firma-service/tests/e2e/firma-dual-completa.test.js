/**
 * E2E flujo dual completo — K+AIR Firma Dual (Fase 1C, v0.1.180).
 *
 * GREEN step del TDD: este test es la validación end-to-end FINAL del
 * feature Firma Dual. Cubre los 9 pasos del flow completo:
 *
 *   1. Setup (resetDb + Acuerdo + clientes + clearDevInbox)
 *   2. Crear PADRE con requiere_firma_empresa=1 + representante_legal_snapshot
 *   3. Worker recorre flujo público (identify → OTP → view → commit) → SIGNED
 *   4. Trigger crea automáticamente el HIJO con tipo_firmante='EMPRESA'
 *   5. Rep recibe el correo diferenciable (dev inbox, tipo='invite-company')
 *   6. Rep recorre flujo público con SU PROPIA cédula → SIGNED
 *   7. Ambos sign requests (padre e hijo) quedan DUAL_FIRMADO
 *   8. Se registra el evento COMPANY_FIRMA_COMPLETADA en gh_firma_eventos
 *   9. El PDF final con 2 firmas existe en storage.PATHS.firmados/<hijo>.pdf
 *
 * Reusa patterns de tests/e2e/firma-dual-trigger.test.js (Task 1.6) y
 * tests/e2e/firma-flujo-completo.test.js (Task I-E2E.1).
 */
'use strict';

// Ensure test env before any requires (dotenv may set production from .env)
if (process.env.NODE_ENV !== 'test') process.env.NODE_ENV = 'test';
delete require.cache[require.resolve('../../src/config')];

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const db = require('../../src/db/connection');
const { sha256 } = require('../../src/crypto/hash');
const mailer = require('../../src/services/mailer');
const storage = require('../../src/services/storage');
const {
  resetDb, seedActiveAgreement, seedTestClients, makeApp,
  withClientAApiKey, withLegacyApiKey,
  TEST_API_KEY_CLIENT_A, TEST_API_KEY, TEST_EMPRESA_A,
} = require('../helpers');

// =========================================================================
// CONSTANTES — datos del REP (representante legal)
// =========================================================================
// Snapshot que se envía en el POST del padre como `representante_legal_snapshot`
// y que se persiste en gh_firmas_electronicas.representante_legal_snapshot.
// Diseño: el rep ES la persona del snapshot. createForCompany pre-popula
// el `identificacion_numero_hash` del hijo con sha256(numero_identificacion),
// por lo que el rep DEBE ingresar exactamente este CC para poder identificarse.
const REP = {
  nombre: 'Juan Pérez Representante',
  tipo_identificacion: 'CC',
  // Cédula DISTINTA a la del worker (1234567890) para que la 2da firma
  // se registre con un firmante diferente.
  numero_identificacion: '0987654321',
  correo: 'juan.rep.dual@test.com',
  cargo: 'Representante Legal',
};

// Cédula del REP en texto plano (lo que el rep ingresa en identify()).
// DEBE coincidir con REP.numero_identificacion (mismo CC).
const REP_CC_PLAIN = REP.numero_identificacion;

// Cédula del WORKER (en texto plano). Coincide con el hash del padre
// (que se construye con sha256('1234567890')).
const WORKER_CC_PLAIN = '1234567890';

// =========================================================================
// HELPERS
// =========================================================================

/**
 * Crea un consentimiento ACEPTADO para (id_trabajador, id_empresa, version).
 *
 * NOTA: El helper `createAcceptedConsent` de tests/helpers.js está DESACTUALIZADO
 * porque el flujo de consent fue rediseñado en FASE 4 (ya no usa OTP interno).
 * La aceptación ahora ocurre en la mini-app vía POST /api/sign/:token/consent/accept.
 * Para este test, creamos el consent via API y lo marcamos como aceptado
 * directamente en la BD (atajo de testing — no afecta el comportamiento bajo
 * prueba, que es el flujo dual).
 *
 * Retorna { consent_id }.
 */
async function createAcceptedConsentDirect({
  id_trabajador = WORKER_CC_PLAIN,
  id_empresa = TEST_EMPRESA_A,
  version_acuerdo = 'v1.0',
  correo = 'trabajador.dual@test.com',
  kair_version = '0.1.180-test',
} = {}) {
  const sup = require('supertest');
  const app = makeApp();
  const apiKey = TEST_API_KEY;

  // Crear consentimiento via API (queda en estado OTP_PENDING = "pendiente de
  // aceptación en mini-app", nombre legacy del estado).
  const r1 = await sup(app)
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
      `createAcceptedConsentDirect: no se pudo crear consentimiento ` +
      `(status=${r1.status}, body=${JSON.stringify(r1.body)})`
    );
  }
  const consentId = r1.body.consent_id;

  // Marcar como aceptado directamente en la BD (atajo de testing).
  // Replica lo que hace consentService.accept() en la mini-app.
  db.prepare(`
    UPDATE gh_consentimientos_firma
    SET manifestacion_aceptada = 1,
        fecha_aceptacion = datetime('now'),
        estado = 'ACCEPTED',
        updated_at = datetime('now')
    WHERE id = ? AND manifestacion_aceptada = 0
  `).run(consentId);

  return { consent_id: consentId };
}

/**
 * Crea un PDF válido con pdf-lib. El `seed` permite que cada test tenga
 * un PDF con bytes distintos.
 */
async function makePdf(seed = 'dual-completa') {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  page.drawText(`dual-completa-doc-${seed}`);
  return Buffer.from(await doc.save());
}

/**
 * Construye el metadata para POST /internal/sign-requests con los campos
 * I-FIRMA-DUAL (requiere_firma_empresa, representante_legal_snapshot).
 * Defaults alineados con el helper de firma-dual-trigger.test.js.
 */
function buildMetadataDual(acuerdo, opts = {}) {
  return {
    id_documento: 'doc-dual-completa',
    id_trabajador: WORKER_CC_PLAIN,
    id_empresa: TEST_EMPRESA_A,
    tipo_firma: 'presencial',
    agreement_hash: acuerdo.texto_hash,
    agreement_version: acuerdo.version,
    document_hash: null, // se calcula en el test
    version_kair: '0.1.180-test',
    identificacion_tipo: 'CC',
    identificacion_numero_hash: sha256(WORKER_CC_PLAIN),
    // I-FIRMA-DUAL: opt-in para firma de empresa + snapshot del representante
    requiere_firma_empresa: 1,
    representante_legal_snapshot: REP,
    correo_verificacion: 'trabajador.dual@test.com',
    ...opts,
  };
}

/**
 * Recorre el flujo público completo de un sign request desde PENDING
 * hasta SIGNED. Replica el helper de firma-dual-trigger.test.js con un
 * parámetro `identificacion` (default = cédula del worker) para que el
 * rep use SU PROPIA cédula.
 *
 * Pasos:
 *   0. GET  /s/:token  (OPENED)
 *   1. POST /api/sign/:token/identify   (CC + cédula)
 *   2. POST /api/sign/:token/verify-otp (OTP 6 dígitos)
 *   3. POST /api/sign/:token/view-document
 *   4. POST /api/sign/:token/commit
 *
 * Retorna el body del commit.
 */
async function recorrerFlujoCompleto(app, token, identificacion = WORKER_CC_PLAIN) {
  // 0. GET /s/:token con Accept JSON (dispara evento OPENED)
  const r0 = await request(app)
    .get(`/s/${token}`)
    .set('Accept', 'application/json');
  assert.equal(r0.status, 200,
    `GET /s/:token falló: status=${r0.status} body=${JSON.stringify(r0.body)}`);

  // 1. Identify
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: identificacion });
  assert.equal(r1.status, 200,
    `identify falló: status=${r1.status} body=${JSON.stringify(r1.body)}`);
  const { devOtp } = r1.body;

  // 2. Verify OTP
  const r2 = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: devOtp });
  assert.equal(r2.status, 200,
    `verify-otp falló: status=${r2.status} body=${JSON.stringify(r2.body)}`);

  // 3. View document
  const r3 = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 30, scroll_al_final: true });
  assert.equal(r3.status, 200,
    `view-document falló: status=${r3.status} body=${JSON.stringify(r3.body)}`);

  // 3b. Aceptar Acuerdo (3ª casilla de la mini-app). El worker acepta su
  // consentimiento; el rep acepta el SUYO propio (rama EMPRESA).
  const r35 = await request(app)
    .post(`/api/sign/${token}/consent/accept`)
    .send({});
  assert.equal(r35.status, 200,
    `consent/accept falló: status=${r35.status} body=${JSON.stringify(r35.body)}`);

  // 4. Commit
  const r4 = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });
  assert.equal(r4.status, 200,
    `commit falló: status=${r4.status} body=${JSON.stringify(r4.body)}`);
  assert.equal(r4.body.estado, 'SIGNED');

  return r4.body;
}

/**
 * Extrae el path público de la mini-app del cuerpo del correo del rep.
 * El body del correo tiene la línea: "1. Abre este enlace en tu navegador: <url>"
 */
function extractUrlPublicaFromRepEmail(emailBody) {
  const match = emailBody.match(/https?:\/\/\S+\/s\/[A-Za-z0-9_-]+/);
  if (!match) {
    throw new Error(
      `No se encontró URL pública en el cuerpo del correo del rep.\n` +
      `Body: ${emailBody}`
    );
  }
  return match[0];
}

/**
 * Extrae el token de la URL pública (última parte del path /s/<token>).
 */
function extractTokenFromUrl(urlPublica) {
  const parts = urlPublica.split('/');
  return parts[parts.length - 1];
}

// =========================================================================
// §F-FINAL — E2E FLUJO DUAL COMPLETO (9 pasos)
// =========================================================================

test('F-FINAL flujo dual completo: padre firma → trigger crea hijo → rep firma → DUAL_FIRMADO + 2 firmas en PDF + COMPANY_FIRMA_COMPLETADA', async () => {
  // =========================================================================
  // STEP 1 — SETUP
  // =========================================================================
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  seedTestClients();
  mailer.clearDevInbox();

  // E6: con agreement_version, el sign request requiere consent_id aceptado.
  // Usamos createAcceptedConsentDirect (local, en este archivo) porque el
  // helper público createAcceptedConsent de tests/helpers.js está
  // desactualizado por el rediseño FASE 4 del consent.
  const { consent_id } = await createAcceptedConsentDirect({
    id_trabajador: WORKER_CC_PLAIN,
    id_empresa: TEST_EMPRESA_A,
    version_acuerdo: 'v1.0',
  });

  const app = makeApp();
  const pdf = await makePdf('F-FINAL');
  const meta = buildMetadataDual(acuerdo, { consent_id });
  meta.document_hash = sha256(pdf);

  // =========================================================================
  // STEP 2 — Crear PADRE con requiere_firma_empresa=1 + snapshot
  // =========================================================================
  const idemKey = crypto.randomUUID();
  const r1 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('Idempotency-Key', idemKey)
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r1.status, 201,
    `POST del padre falló: status=${r1.status} body=${JSON.stringify(r1.body)}`);
  const padreId = r1.body.id_solicitud;
  const padreToken = r1.body.token;
  assert.ok(padreId, 'padre debe tener id_solicitud');
  assert.ok(padreToken, 'padre debe tener token');

  // =========================================================================
  // STEP 3 — Worker recorre flujo público completo → SIGNED
  // =========================================================================
  const workerCommit = await recorrerFlujoCompleto(app, padreToken, WORKER_CC_PLAIN);
  assert.equal(workerCommit.estado, 'SIGNED',
    'worker commit debe retornar estado=SIGNED');

  // Verificación adicional: el padre está en SIGNED en BD
  const padreDespuesWorker = db.prepare(
    'SELECT estado, requiere_firma_empresa, tipo_firmante, fecha_firma ' +
    'FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(padreId);
  assert.equal(padreDespuesWorker.estado, 'SIGNED',
    'padre debe estar en estado SIGNED en BD');
  assert.equal(padreDespuesWorker.requiere_firma_empresa, 1,
    'padre debe mantener requiere_firma_empresa=1');
  assert.equal(padreDespuesWorker.tipo_firmante, 'TRABAJADOR',
    'padre debe tener tipo_firmante=TRABAJADOR');

  // =========================================================================
  // STEP 4 — Verificar que el trigger creó el hijo
  // =========================================================================
  const hijos = db.prepare(
    'SELECT id_solicitud, tipo_firmante, correo_verificacion, id_trabajador, ' +
    'requiere_firma_empresa, parent_id_solicitud, estado, representante_legal_snapshot, ' +
    'consent_id, agreement_version ' +
    'FROM gh_firmas_electronicas WHERE parent_id_solicitud = ?'
  ).all(padreId);
  assert.equal(hijos.length, 1,
    `trigger debió crear 1 hijo automáticamente, pero hay ${hijos.length}`);
  const hijo = hijos[0];
  assert.equal(hijo.tipo_firmante, 'EMPRESA',
    'hijo debe tener tipo_firmante=EMPRESA');
  assert.equal(hijo.correo_verificacion, REP.correo,
    `hijo.correo_verificacion debe ser ${REP.correo} (correo del rep)`);
  assert.equal(hijo.parent_id_solicitud, padreId,
    'hijo.parent_id_solicitud debe apuntar al padre');
  assert.equal(hijo.requiere_firma_empresa, 0,
    'el hijo mismo no debe requerir OTRA firma de empresa');
  assert.equal(hijo.estado, 'PENDING',
    'hijo debe estar PENDING (aún no firmado por el representante)');
  // Snapshot del representante persistido como JSON
  const snap = JSON.parse(hijo.representante_legal_snapshot);
  assert.equal(snap.correo, REP.correo, 'snapshot.correo debe coincidir');
  assert.equal(snap.nombre, REP.nombre, 'snapshot.nombre debe coincidir');
  assert.equal(snap.tipo_identificacion, REP.tipo_identificacion,
    'snapshot.tipo_identificacion debe coincidir');
  // 📦 Schema design: id_trabajador se hereda del padre (es el mismo documento).
  assert.equal(hijo.id_trabajador, WORKER_CC_PLAIN,
    'hijo debe heredar el id_trabajador del padre');
  // Consentimiento PROPIO del rep: el hijo nace SIN consent heredado
  // (heredarlo generaba dato falso en constancia: ID/fecha del trabajador
  // como si fueran del rep). Se vincula el suyo en consentAccept().
  assert.equal(hijo.consent_id, null,
    'hijo debe nacer sin consent_id (su consentimiento propio se vincula al aceptar)');
  assert.ok(hijo.agreement_version,
    'hijo debe tener agreement_version (necesario para validateForCommit)');

  const hijoId = hijo.id_solicitud;

  // =========================================================================
  // STEP 5 — Verificar que el rep recibió el correo diferenciable
  // =========================================================================
  const inbox = mailer.getDevInbox();
  const repInvite = inbox.find(
    (e) => e.tipo === 'invite-company' && e.to === REP.correo
  );
  assert.ok(repInvite,
    `Rep debió recibir correo tipo='invite-company' a ${REP.correo}. ` +
    `Inbox: ${JSON.stringify(inbox.map(e => ({ tipo: e.tipo, to: e.to })))}`);
  assert.match(repInvite.subject, /representante legal/i,
    'subject del rep debe mencionar "representante legal"');
  assert.match(repInvite.body, new RegExp(REP.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'body del rep debe mencionar el nombre del rep');
  // Extraer URL pública del body
  const urlPublica = extractUrlPublicaFromRepEmail(repInvite.body);
  const hijoToken = extractTokenFromUrl(urlPublica);
  assert.ok(hijoToken, 'URL del rep debe incluir el token del hijo');

  // =========================================================================
  // STEP 6 — Rep recorre flujo público con SU PROPIA cédula → SIGNED
  // =========================================================================
  // El rep se identifica con su cédula (DISTINTA a la del worker).
  const repCommit = await recorrerFlujoCompleto(app, hijoToken, REP_CC_PLAIN);
  assert.equal(repCommit.estado, 'SIGNED',
    'rep commit debe retornar estado=SIGNED');

  // =========================================================================
  // STEP 7 — Verificar estado DUAL_FIRMADO en ambos
  // =========================================================================
  const padreDual = db.prepare(
    'SELECT estado, fecha_firma, document_hash_firmado, evidence_hash, ' +
    'pdf_firmado_path, constancia_path ' +
    'FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(padreId);
  assert.equal(padreDual.estado, 'DUAL_FIRMADO',
    `padre debe quedar en DUAL_FIRMADO después del commit del rep. ` +
    `Actual: ${padreDual.estado}`);

  const hijoDual = db.prepare(
    'SELECT estado, fecha_firma, document_hash_firmado, evidence_hash, ' +
    'pdf_firmado_path, constancia_path ' +
    'FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(hijoId);
  assert.equal(hijoDual.estado, 'DUAL_FIRMADO',
    `hijo debe quedar en DUAL_FIRMADO después del commit del rep. ` +
    `Actual: ${hijoDual.estado}`);

  // El PDF final (con 2 firmas) lo escribe el commit del rep en el path
  // del hijo (storage.PATHS.firmados/<hijo_id_solicitud>.pdf).
  // Esto es porque publicFlow.commit() usa signRequest.id_solicitud para
  // el nombre del archivo, y signRequest es el hijo en este commit.
  const pdfFinalPath = path.join(storage.PATHS.firmados, `${hijoId}.pdf`);
  assert.equal(hijoDual.pdf_firmado_path, pdfFinalPath,
    `pdf_firmado_path del hijo debe ser ${pdfFinalPath} ` +
    `(storage.PATHS.firmados/<hijo>.pdf). Actual: ${hijoDual.pdf_firmado_path}`);

  // =========================================================================
  // STEP 7b — Consentimiento PROPIO del representante (no heredado)
  // =========================================================================
  const hijoPost = db.prepare(
    'SELECT consent_id FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(hijoId);
  const padrePost = db.prepare(
    'SELECT consent_id FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(padreId);
  assert.ok(hijoPost.consent_id, 'hijo debe tener consent_id vinculado tras aceptar');
  assert.notEqual(hijoPost.consent_id, padrePost.consent_id,
    'el consent del hijo NO debe ser el del trabajador');
  const consentRep = db.prepare(
    'SELECT id, rol_firmante, nombre_aceptante, cargo_aceptante, fecha_aceptacion, manifestacion_aceptada, estado ' +
    'FROM gh_consentimientos_firma WHERE id = ?'
  ).get(hijoPost.consent_id);
  assert.equal(consentRep.rol_firmante, 'EMPRESA',
    'consent del hijo debe tener rol_firmante=EMPRESA');
  assert.equal(consentRep.nombre_aceptante, REP.nombre,
    'consent del hijo debe llevar el nombre del rep');
  assert.equal(consentRep.cargo_aceptante, REP.cargo,
    'consent del hijo debe llevar el cargo del rep');
  assert.equal(consentRep.manifestacion_aceptada, 1,
    'consent del rep debe estar aceptado');
  assert.ok(consentRep.fecha_aceptacion,
    'consent del rep debe tener fecha_aceptacion propia');
  const consentPadre = db.prepare(
    'SELECT fecha_aceptacion FROM gh_consentimientos_firma WHERE id = ?'
  ).get(padrePost.consent_id);
  assert.notEqual(consentRep.fecha_aceptacion, consentPadre.fecha_aceptacion,
    'las fechas de aceptación de rep y trabajador deben ser distintas ' +
    '(cada uno aceptó en su momento)');

  // =========================================================================
  // STEP 8 — Verificar evento COMPANY_FIRMA_COMPLETADA en gh_firma_eventos
  // =========================================================================
  // gh_firma_eventos.metadata es la columna JSON donde se persiste el payload
  // del evento (NO se llama "payload" — ver schema 001_initial).
  const eventos = db.prepare(
    "SELECT evento, metadata, fecha_hora, id_actor " +
    "FROM gh_firma_eventos " +
    "WHERE firma_id = (SELECT id FROM gh_firmas_electronicas WHERE id_solicitud = ?) " +
    "AND evento = 'COMPANY_FIRMA_COMPLETADA' " +
    "ORDER BY id ASC"
  ).all(hijoId);
  assert.ok(eventos.length >= 1,
    `debe existir al menos 1 evento COMPANY_FIRMA_COMPLETADA para el hijo. ` +
    `Eventos del hijo: ${JSON.stringify(eventos)}`);
  const companyEvent = eventos[0];
  assert.equal(companyEvent.evento, 'COMPANY_FIRMA_COMPLETADA',
    'evento debe llamarse COMPANY_FIRMA_COMPLETADA');
  // El metadata debe tener referencia al padre y al hijo
  const payload = JSON.parse(companyEvent.metadata || '{}');
  assert.equal(payload.parent, padreId,
    'evento.metadata.parent debe ser el id del padre');
  assert.equal(payload.hijo, hijoId,
    'evento.metadata.hijo debe ser el id del hijo');
  assert.ok(payload.documento_hash_dual,
    'evento debe incluir el hash del documento con doble firma');

  // =========================================================================
  // STEP 9 — Verificar PDF final con 2 firmas en disco
  // =========================================================================
  assert.ok(fs.existsSync(pdfFinalPath),
    `PDF final debe existir en ${pdfFinalPath}`);
  const pdfStat = fs.statSync(pdfFinalPath);
  assert.ok(pdfStat.size > 0,
    `PDF final debe tener tamaño > 0. Actual: ${pdfStat.size} bytes`);

  // Validar con pdf-lib que sea un PDF válido con >=3 páginas
  // (original + página de sello del rep + página de constancia dual)
  const pdfBytes = fs.readFileSync(pdfFinalPath);
  const finalDoc = await PDFDocument.load(pdfBytes);
  const finalPages = finalDoc.getPageCount();
  assert.ok(finalPages >= 3,
    `PDF final debe tener >=3 páginas (original + sello + constancia). ` +
    `Actual: ${finalPages}`);

  // También verificamos que la Constancia existe para el hijo
  assert.ok(hijoDual.constancia_path,
    'hijo debe tener constancia_path persistido');
  assert.ok(fs.existsSync(hijoDual.constancia_path),
    `Constancia del hijo debe existir en ${hijoDual.constancia_path}`);
});
