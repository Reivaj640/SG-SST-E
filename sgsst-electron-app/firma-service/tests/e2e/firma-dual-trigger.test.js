/**
 * Tests E2E del trigger en commit() — K+AIR Firma Dual (Fase 1C, v0.1.180).
 *
 * Esta tarea es el RED step del TDD para el trigger automático que crea
 * un sign request hijo (tipo_firmante='EMPRESA') cuando commit() del worker
 * firma exitosamente un sign request padre con requiere_firma_empresa=1.
 *
 * El trigger NO EXISTE AÚN (Task 1.7 lo va a implementar). Por eso:
 *   - Test 1 DEBE fallar: sin trigger, no se crea el hijo y la aserción
 *     `hijos.length === 1` falla.
 *   - Test 2 PASA accidentalmente: sin trigger, nunca se crea un hijo
 *     (legacy flow), y `hijos.length === 0` es verdadero.
 *
 * Diferencias vs firma-flujo-completo.test.js:
 *   - Acá no validamos idempotency ni authz cross-company ni PDF validation;
 *     solo el trigger en commit().
 *   - El padre se crea con campos I-FIRMA-DUAL (requiere_firma_empresa,
 *     representante_legal_snapshot) que serán propagados por el route en
 *     Task 1.7. En este RED step, el route los ignora silenciosamente.
 *
 * Ver docs/kair-firma-integration/INTEGRATION.md §Fase 1C.
 */
'use strict';

// Ensure test env before any requires (dotenv may set production from .env)
if (process.env.NODE_ENV !== 'test') process.env.NODE_ENV = 'test';
delete require.cache[require.resolve('../../src/config')];

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const db = require('../../src/db/connection');
const { sha256 } = require('../../src/crypto/hash');
const {
  resetDb, seedActiveAgreement, seedTestClients, makeApp,
  withClientAApiKey,
  TEST_API_KEY_CLIENT_A, TEST_EMPRESA_A,
} = require('../helpers');

/**
 * Crea un consentimiento ACEPTADO para (id_trabajador, id_empresa, version).
 *
 * NOTA: El helper `createAcceptedConsent` de tests/helpers.js está DESACTUALIZADO
 * porque el flujo de consent fue rediseñado en FASE 4 (ya no usa OTP interno).
 * La aceptación ahora ocurre en la mini-app vía POST /api/sign/:token/consent/accept.
 * Para este test, creamos el consent via API y lo marcamos como aceptado
 * directamente en la BD (atajo de testing — no afecta el comportamiento bajo
 * prueba, que es el trigger en commit()).
 *
 * Retorna { consent_id }.
 */
async function createAcceptedConsentDirect({
  id_trabajador = '1234567890',
  id_empresa = TEST_EMPRESA_A,
  version_acuerdo = 'v1.0',
  correo = 'trabajador@example.com',
  kair_version = '0.1.180-test',
} = {}) {
  const sup = require('supertest');
  const app = makeApp();
  const apiKey = require('../helpers').TEST_API_KEY;

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

// =========================================================================
// HELPERS
// =========================================================================

/**
 * Crea un PDF válido con pdf-lib. El `seed` permite que cada test tenga
 * un PDF con bytes distintos.
 */
async function makePdf(seed = 'dual-trigger') {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  page.drawText(`dual-trigger-doc-${seed}`);
  return Buffer.from(await doc.save());
}

/**
 * Construye el metadata para POST /internal/sign-requests con los campos
 * I-FIRMA-DUAL (requiere_firma_empresa, representante_legal_snapshot) que
 * Task 1.7 propagará al service. En este RED step, el route los ignora
 * silenciosamente — el padre queda con requiere_firma_empresa=0 y el
 * trigger no tiene con qué crear el hijo.
 *
 * Defaults alineados con el helper de firma-flujo-completo.test.js.
 */
function buildMetadataDual(acuerdo, opts = {}) {
  return {
    id_documento: 'doc-dual-trigger',
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    tipo_firma: 'presencial',
    agreement_hash: acuerdo.texto_hash,
    agreement_version: acuerdo.version,
    document_hash: null, // se calcula en el test
    version_kair: '0.1.180-test',
    identificacion_tipo: 'CC',
    identificacion_numero_hash: sha256('1234567890'),
    // I-FIRMA-DUAL: opt-in para firma de empresa + snapshot del representante
    requiere_firma_empresa: 1,
    representante_legal_snapshot: {
      nombre: 'Juan Pérez',
      tipo_identificacion: 'CC',
      numero_identificacion: '79123456',
      correo: 'juan.rep@test.com',
      cargo: 'Representante Legal',
    },
    correo_verificacion: 'trabajador@test.com',
    ...opts,
  };
}

/**
 * Recorre el flujo público completo de un sign request desde PENDING
 * hasta SIGNED. Réplica del helper de firma-flujo-completo.test.js
 * (no se importa porque ese helper no está exportado).
 */
async function recorrerFlujoCompleto(app, token, identificacion = '1234567890') {
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

  // 4. Commit
  const r4 = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });
  assert.equal(r4.status, 200,
    `commit falló: status=${r4.status} body=${JSON.stringify(r4.body)}`);
  assert.equal(r4.body.estado, 'SIGNED');

  return r4.body;
}

// =========================================================================
// §F3 — TRIGGER EN commit() (Fase 1C, RED step)
// =========================================================================

test('F3.1 commit del worker CON requiere_firma_empresa=1 crea automáticamente el hijo EMPRESA', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  seedTestClients();
  // E6: con agreement_version, el sign request requiere consent_id aceptado.
  const { consent_id } = await createAcceptedConsentDirect({
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    version_acuerdo: 'v1.0',
  });
  const app = makeApp();
  const pdf = await makePdf('F3.1');
  const meta = buildMetadataDual(acuerdo, { consent_id });
  meta.document_hash = sha256(pdf);

  // 1. POST del padre con flag I-FIRMA-DUAL (requiere_firma_empresa=1)
  //    En este RED step, el route ignora el flag silenciosamente.
  //    Task 1.7 deberá propagar requiere_firma_empresa + representante_legal_snapshot.
  const idemKey = crypto.randomUUID();
  const r1 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('Idempotency-Key', idemKey)
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r1.status, 201,
    `POST falló: status=${r1.status} body=${JSON.stringify(r1.body)}`);
  const padreId = r1.body.id_solicitud;

  // 2. Flujo público completo del worker (identify → verify-otp → view → commit)
  const commitBody = await recorrerFlujoCompleto(app, r1.body.token);
  assert.equal(commitBody.estado, 'SIGNED');

  // 3. Verificar que el padre quedó SIGNED
  const padreRow = db.prepare(
    'SELECT estado, requiere_firma_empresa, tipo_firmante, id_trabajador FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(padreId);
  assert.equal(padreRow.estado, 'SIGNED');

  // 4. TRIGGER I-FIRMA-DUAL: debe existir exactamente 1 hijo vinculado al padre
  //    con tipo_firmante='EMPRESA'. En este RED step, el trigger NO EXISTE,
  //    así que hijos.length === 0 y esta aserción FALLA.
  const hijos = db.prepare(
    'SELECT id_solicitud, tipo_firmante, correo_verificacion, id_trabajador, ' +
    'requiere_firma_empresa, parent_id_solicitud, estado, representante_legal_snapshot ' +
    'FROM gh_firmas_electronicas WHERE parent_id_solicitud = ?'
  ).all(padreId);
  assert.equal(hijos.length, 1,
    `F3.1 RED step: commit() debió crear 1 hijo automáticamente, pero hay ${hijos.length}. ` +
    `Trigger no implementado aún (Task 1.7).`);
  const hijo = hijos[0];
  assert.equal(hijo.tipo_firmante, 'EMPRESA',
    'hijo debe tener tipo_firmante=EMPRESA');
  assert.equal(hijo.correo_verificacion, 'juan.rep@test.com',
    'hijo.correo_verificacion debe ser el correo del representante');
  // 📦 Schema design: id_trabajador es NOT NULL en gh_firmas_electronicas.
  // El hijo hereda el id_trabajador del padre porque es el mismo documento
  // que el trabajador está firmando — solo se le agrega la firma de la empresa.
  // El discriminador de "es firma de empresa" es `tipo_firmante='EMPRESA'`,
  // NO `id_trabajador IS NULL`.
  assert.equal(hijo.id_trabajador, padreRow.id_trabajador,
    `hijo debe heredar el id_trabajador del padre ('${padreRow.id_trabajador}'). ` +
    `id_trabajador es NOT NULL por diseño — el discriminador es tipo_firmante.`);
  assert.equal(hijo.requiere_firma_empresa, 0,
    'el hijo mismo no debe requerir OTRA firma de empresa');
  assert.equal(hijo.parent_id_solicitud, padreId,
    'hijo.parent_id_solicitud debe apuntar al padre');
  assert.equal(hijo.estado, 'PENDING',
    'hijo debe estar PENDING (aún no firmado por el representante)');
  // Snapshot del representante persistido como JSON
  const snap = JSON.parse(hijo.representante_legal_snapshot);
  assert.equal(snap.correo, 'juan.rep@test.com');
  assert.equal(snap.nombre, 'Juan Pérez');
});

test('F3.2 commit del worker SIN requiere_firma_empresa NO crea hijo (legacy flow)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  seedTestClients();
  // E6: con agreement_version, el sign request requiere consent_id aceptado.
  const { consent_id } = await createAcceptedConsentDirect({
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    version_acuerdo: 'v1.0',
  });
  const app = makeApp();
  const pdf = await makePdf('F3.2');
  // Padre LEGACY: sin flag I-FIRMA-DUAL
  const meta = {
    id_documento: 'doc-dual-trigger-legacy',
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    tipo_firma: 'presencial',
    agreement_hash: acuerdo.texto_hash,
    agreement_version: acuerdo.version,
    document_hash: sha256(pdf),
    version_kair: '0.1.180-test',
    identificacion_tipo: 'CC',
    identificacion_numero_hash: sha256('1234567890'),
    consent_id,
    correo_verificacion: 'trabajador@test.com',
    // Sin requiere_firma_empresa (legacy)
  };

  // 1. POST del padre legacy
  const r1 = await withClientAApiKey(
    request(app)
      .post('/internal/sign-requests')
      .set('Idempotency-Key', crypto.randomUUID())
      .field('metadata', JSON.stringify(meta))
      .attach('documento', pdf, 'contrato.pdf')
  );
  assert.equal(r1.status, 201,
    `POST falló: status=${r1.status} body=${JSON.stringify(r1.body)}`);
  const padreId = r1.body.id_solicitud;

  // 2. Flujo público completo
  const commitBody = await recorrerFlujoCompleto(app, r1.body.token);
  assert.equal(commitBody.estado, 'SIGNED');

  // 3. Verificar que el padre quedó SIGNED y SIN flag
  const padreRow = db.prepare(
    'SELECT estado, requiere_firma_empresa FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(padreId);
  assert.equal(padreRow.estado, 'SIGNED');
  assert.equal(padreRow.requiere_firma_empresa, 0,
    'padre legacy debe tener requiere_firma_empresa=0');

  // 4. NO debe haber hijo: el trigger solo se dispara si requiere_firma_empresa=1
  const hijos = db.prepare(
    'SELECT id_solicitud FROM gh_firmas_electronicas WHERE parent_id_solicitud = ?'
  ).all(padreId);
  assert.equal(hijos.length, 0,
    `F3.2: commit() NO debe crear hijo cuando requiere_firma_empresa=0, pero hay ${hijos.length}`);
});
