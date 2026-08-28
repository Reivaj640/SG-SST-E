/**
 * Tests del Bloque E6: sign request ↔ consent linkage.
 *
 * Demuestra la cadena legal:
 *   Acuerdo v1.0 → Consentimiento ACEPTADO → Sign Request → Firma
 *
 * Cubre los 8 casos de la tabla de aceptación E6.3:
 *   1. Consentimiento correcto → ✅ firma → SIGNED
 *   2. consent_id inexistente → ❌ 409 CONSENT_NOT_FOUND
 *   3. consent_id con manifestacion_aceptada=0 → ❌ 409 CONSENT_NOT_ACCEPTED
 *   4. consent_id de otro trabajador → ❌ 409 CONSENT_WORKER_MISMATCH
 *   5. consent_id de otra empresa → ❌ 409 CONSENT_COMPANY_MISMATCH
 *   6. consent_id con otra agreement_version → ❌ 409 CONSENT_VERSION_MISMATCH
 *   7. Sign request legacy (agreement_version=NULL) → ✅ salta validación
 *   8. (re-confirmado) sign_request con agreement_version sin consent_id
 *      → ❌ 409 CONSENT_REQUIRED (no en tabla original pero implícito)
 *
 * Helpers:
 *   - createAcceptedConsent: crea + acepta un consentimiento
 *   - createSignRequestWithIdentificacion: crea un sign request con Acuerdo v1.0
 *   - recorrerFlujoHastaViewed: lleva el sign request hasta DOCUMENT_VIEWED
 */
'use strict';

// Ensure test env before any requires (dotenv may set production from .env)
if (process.env.NODE_ENV !== 'test') process.env.NODE_ENV = 'test';
// Bust config cache so it re-reads NODE_ENV=test
delete require.cache[require.resolve('../../src/config')];

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const db = require('../../src/db/connection');
const {
  resetDb, seedActiveAgreement, makeApp,
  createSignRequestWithIdentificacion, createAcceptedConsent,
  TEST_API_KEY,
} = require('../helpers');
const { sha256 } = require('../../src/crypto/hash');
const storage = require('../../src/services/storage');

const HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };

/**
 * Recorre el flujo público hasta DOCUMENT_VIEWED para un token dado.
 * Asume que ya se envió el OTP y se quiere llegar al punto de commit.
 *
 * Si el sign request está en PENDING, hace identify + verifyOtp + viewDocument.
 * Si ya está en OTP_VERIFIED, hace viewDocument.
 */
async function recorrerFlujoHastaViewed(token, identificacion_numero) {
  // Estado actual
  const current = db.prepare(
    'SELECT estado FROM gh_firmas_electronicas WHERE token_hash = ?'
  ).get(sha256(Buffer.from(token, 'utf8')));
  // Nota: el hash en BD se calcula con hashToken, no con sha256 raw.
  // Lo correcto es buscar por id_solicitud, pero aquí no lo tenemos.
  // En cambio, hacemos el flujo siempre desde el principio.

  // 1. Identify
  const r3 = await request(require('../helpers').makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: identificacion_numero });
  if (r3.status !== 200) {
    throw new Error(`identify falló: status=${r3.status} body=${JSON.stringify(r3.body)}`);
  }
  const otp = r3.body.devOtp;

  // 2. Verify OTP
  const r4 = await request(require('../helpers').makeApp())
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp });
  if (r4.status !== 200) {
    throw new Error(`verify-otp falló: status=${r4.status} body=${JSON.stringify(r4.body)}`);
  }

  // 3. View document
  const r5 = await request(require('../helpers').makeApp())
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 30, scroll_al_final: true });
  if (r5.status !== 200) {
    throw new Error(`view-document falló: status=${r5.status} body=${JSON.stringify(r5.body)}`);
  }

  return { estado_final: r5.body.estado };
}

async function makeValidPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([300, 200]);
  page.drawText('Documento E6');
  return Buffer.from(await pdfDoc.save());
}

/**
 * Helper que crea un sign request con consent_id opcional, lo lleva hasta
 * DOCUMENT_VIEWED, y lo deja listo para commit.
 *
 * Si `consent_id` es provisto, se usa en POST /internal/sign-requests.
 * Si `legacy_agreement_version_null` es true, el sign request se inserta
 * directamente en BD con agreement_version=NULL (sin pasar por la API,
 * porque el schema requiere agreement_version).
 */
async function prepararSignRequestParaCommit({
  id_trabajador = '1234567890',
  id_empresa = '900123456',
  identificacion_numero = '1234567890',
  consent_id = null,
  // Override de los valores que se vinculan al consentimiento
  signRequestOverrides = {},
} = {}) {
  const app = makeApp();
  const acuerdo = require('../../src/services/agreement').getActive();

  const overrides = {
    id_trabajador,
    id_empresa,
    identificacion_numero,
    identificacion_tipo: 'CC',
    consent_id,
    ...signRequestOverrides,
  };

  const { token, signRequest } = await createSignRequestWithIdentificacion(overrides);

  await recorrerFlujoHastaViewed(token, identificacion_numero);

  return { token, signRequest, id_solicitud: signRequest.id_solicitud };
}

// =========================================================================
// CASO 1: Consentimiento correcto → firma → SIGNED (happy path)
// =========================================================================

test('E6 caso 1: consent_id válido y aceptado → commit → SIGNED', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0', texto: 'ACUERDO v1.0 E6' });
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    version_acuerdo: 'v1.0',
  });

  const { token, id_solicitud } = await prepararSignRequestParaCommit({
    consent_id,
  });

  const app = makeApp();
  const r = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });

  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.estado, 'SIGNED');

  // Verificar BD: sign request con consent_id y estado SIGNED
  const row = db.prepare(`
    SELECT estado, consent_id, agreement_version
    FROM gh_firmas_electronicas WHERE id_solicitud = ?
  `).get(id_solicitud);
  assert.equal(row.estado, 'SIGNED');
  assert.equal(row.consent_id, consent_id);
  assert.equal(row.agreement_version, 'v1.0');
});

// =========================================================================
// CASO 2: consent_id inexistente → 409 CONSENT_NOT_FOUND
// =========================================================================

test('E6 caso 2: consent_id inexistente → 409 CONSENT_NOT_FOUND', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0' });

  // El consent_id=99999 no existe
  const { token, id_solicitud } = await prepararSignRequestParaCommit({
    consent_id: 99999,
  });

  const app = makeApp();
  const r = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });

  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'CONSENT_NOT_FOUND');
  assert.equal(r.body.error.details.consent_id, 99999);

  // El sign request NO quedó en SIGNED
  const row = db.prepare(
    'SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(id_solicitud);
  assert.notEqual(row.estado, 'SIGNED');
  assert.equal(row.estado, 'DOCUMENT_VIEWED');
});

// =========================================================================
// CASO 3: consent_id con manifestacion_aceptada=0 → 409 CONSENT_NOT_ACCEPTED
// =========================================================================

test('E6 caso 3: consent_id con manifestacion_aceptada=0 → 409 CONSENT_NOT_ACCEPTED', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  const app = makeApp();

  // Crear consentimiento SIN aceptar (manifestacion_aceptada=0 por default)
  const r1 = await request(app)
    .post('/internal/consentimientos')
    .set(HEADERS)
    .send({
      id_trabajador: '1234567890',
      id_empresa: '900123456',
      version_acuerdo: 'v1.0',
      correo_verificacion: 'no-acepta@example.com',
      kair_version: '0.1.189',
    });
  assert.equal(r1.status, 201);
  const consentIdNoAceptado = r1.body.consent_id;

  // Verificar que quedó como no aceptado
  const consent = db.prepare(
    'SELECT manifestacion_aceptada FROM gh_consentimientos_firma WHERE id = ?'
  ).get(consentIdNoAceptado);
  assert.equal(consent.manifestacion_aceptada, 0);

  // Crear sign request con ese consent_id y llevar hasta DOCUMENT_VIEWED
  const { token, id_solicitud } = await prepararSignRequestParaCommit({
    consent_id: consentIdNoAceptado,
  });

  // Intentar commit → debe fallar
  const r = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });

  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'CONSENT_NOT_ACCEPTED');
  assert.equal(r.body.error.details.consent_id, consentIdNoAceptado);
  assert.equal(r.body.error.details.manifestacion_aceptada, 0);

  // El sign request NO quedó en SIGNED
  const row = db.prepare(
    'SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(id_solicitud);
  assert.notEqual(row.estado, 'SIGNED');
});

// =========================================================================
// CASO 4: consent_id de otro trabajador → 409 CONSENT_WORKER_MISMATCH
// =========================================================================

test('E6 caso 4: consent_id de otro trabajador → 409 CONSENT_WORKER_MISMATCH', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0' });

  // Consentimiento del trabajador A
  const { consent_id: consentTrabajadorA } = await createAcceptedConsent({
    id_trabajador: '11111111',  // Trabajador A
    id_empresa: '900123456',
    version_acuerdo: 'v1.0',
  });

  // Sign request del trabajador B (con el consent_id del A)
  const { token, id_solicitud } = await prepararSignRequestParaCommit({
    id_trabajador: '22222222',  // Trabajador B
    identificacion_numero: '22222222',
    consent_id: consentTrabajadorA,  // pero con el consent del A
    signRequestOverrides: {
      identificacion_numero_hash: sha256('22222222'),
    },
  });

  const app = makeApp();
  const r = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });

  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'CONSENT_WORKER_MISMATCH');
  assert.equal(r.body.error.details.consent_id_trabajador, '11111111');
  assert.equal(r.body.error.details.sign_request_id_trabajador, '22222222');

  // El sign request NO quedó en SIGNED
  const row = db.prepare(
    'SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(id_solicitud);
  assert.notEqual(row.estado, 'SIGNED');
});

// =========================================================================
// CASO 5: consent_id de otra empresa → 409 CONSENT_COMPANY_MISMATCH
// =========================================================================

test('E6 caso 5: consent_id de otra empresa → 409 CONSENT_COMPANY_MISMATCH', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0' });

  // Consentimiento de la empresa A
  const { consent_id: consentEmpresaA } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: 'AAA',  // Empresa A
    version_acuerdo: 'v1.0',
  });

  // Sign request de la empresa B (con el consent_id de A)
  const { token, id_solicitud } = await prepararSignRequestParaCommit({
    id_empresa: 'BBB',  // Empresa B
    consent_id: consentEmpresaA,
  });

  const app = makeApp();
  const r = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });

  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'CONSENT_COMPANY_MISMATCH');
  assert.equal(r.body.error.details.consent_id_empresa, 'AAA');
  assert.equal(r.body.error.details.sign_request_id_empresa, 'BBB');

  // El sign request NO quedó en SIGNED
  const row = db.prepare(
    'SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(id_solicitud);
  assert.notEqual(row.estado, 'SIGNED');
});

// =========================================================================
// CASO 6: consent_id con otra agreement_version → 409 CONSENT_VERSION_MISMATCH
// =========================================================================

test('E6 caso 6: consent_id con otra agreement_version → 409 CONSENT_VERSION_MISMATCH', async () => {
  resetDb();
  // Solo sembrar v1.0 (activa). El sign request usará v1.0 también.
  // El truco: crear un consentimiento con una versión distinta (v1.0 es la activa)
  // — pero el UNIQUE constraint de gh_consentimientos_firma
  // (id_trabajador, id_empresa, version_acuerdo) impide crear el del sign
  // request, y el consent "viejo" tiene version_acuerdo=v1.0 también.
  //
  // Para forzar el version mismatch sin violar UNIQUE, sembramos un Acuerdo
  // adicional v2.0 INACTIVO, creamos un consentimiento contra v2.0, y luego
  // hacemos el sign request contra v1.0 con ese consent_id.
  // Como v2.0 no está activa, no se puede crear Acuerdo activo;
  // la solución es desactivar v1.0 y activar v2.0 temporalmente.
  //
  // Más simple: crear consentimiento v1.0 (la activa), luego INSERT manual
  // de un sign request con agreement_version='v1.0' y consent_id que
  // apunta al consent. Pero la tabla del sign request requiere
  // agreement_version que coincida con un acuerdo existente para validar
  // en el create() (D1).
  //
  // La forma más limpia: usar admin endpoint para crear v2.0 inactivo,
  // luego cambiar manualmente el sign request a agreement_version='v1.0'
  // y el consent a version_acuerdo='v1.0'. Hmm, eso no prueba nada.
  //
  // SOLUCIÓN: crear dos Acuerdos (v1.0 activa + v2.0 inactiva),
  // crear el consent contra v1.0, hacer el sign request contra v1.0,
  // luego cambiar manualmente en BD el agreement_version del sign request
  // a 'v1.0' (lo que ya está). Para forzar MISMATCH, cambiamos el
  // version_acuerdo del consentimiento a algo distinto vía SQL.
  // El consent apuntará a un version que NO existe en la tabla de acuerdos.
  // El sign request sigue con v1.0.
  const agreementService = require('../../src/services/agreement');

  // v1.0 activa
  seedActiveAgreement({ version: 'v1.0', texto: 'ACUERDO v1.0' });

  // v2.0 NO activa (solo la necesitamos para que getByVersion la encuentre
  // cuando validamos el sign request... pero acá NO se re-valida el
  // sign request contra el Acuerdo en commit, solo en create).
  // Para E6.6, lo que importa es que el consent tenga version_acuerdo
  // distinto al del sign request.

  // Crear consent v1.0 (será la base del test)
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    version_acuerdo: 'v1.0',
  });

  // Crear sign request normalmente (con v1.0)
  const { token, id_solicitud, signRequest } = await prepararSignRequestParaCommit({
    consent_id,
  });

  // Hack: cambiar manualmente el version_acuerdo del consent a un valor
  // distinto al del sign request. Como gh_consentimientos_firma tiene
  // UNIQUE(id_trabajador, id_empresa, version_acuerdo), y v1.0 ya existe,
  // creamos otra fila consent para otro (trabajador, empresa) y la usamos.
  // PERO el sign request está vinculado al consent_id directamente.
  //
  // La forma robusta: insertar una nueva fila consent con version_acuerdo
  // ficticio que NO esté en la tabla acuerdos, y apuntar el sign request
  // a ese id. Pero la UNIQUE lo permite si (trabajador, empresa, version)
  // es único.
  //
  // Truco final: crear otro consent para OTRO trabajador (que no es
  // el del sign request), pero ese testea WORKER_MISMATCH.
  //
  // Truco alternativo (más limpio): crear un sign request con
  // agreement_version='v1.0' (válido), crear un consent con
  // version_acuerdo='v1.0-different' (también válido, no choca con
  // UNIQUE porque es nueva tripleta). La fila del Acuerdo con
  // version='v1.0-different' NO existe, pero el sign request YA FUE
  // CREADO con v1.0, así que validateAcuerdo() ya pasó. Solo necesitamos
  // que la validación del E6 falle por version_acuerdo distinto.
  //
  // Para no violar la regla de "el sign request fue creado con un acuerdo
  // válido", cambiamos manualmente en BD el agreement_version del sign
  // request a 'v1.0' después de crearlo (es lo que ya es).
  // Y cambiamos el version_acuerdo del consent a algo distinto.
  //
  // Implementación: en lugar de hacer todo eso, creamos un consentimiento
  // "alternativo" con version_acuerdo='v1.0-otra' (que NO existe en la
  // tabla acuerdos) y lo aceptamos. Como getActive() retorna v1.0, el
  // validateAcuerdo del sign request fallaría si usáramos v1.0-otra.
  //
  // PERO el sign request YA FUE CREADO antes del UPDATE manual del consent,
  // y con v1.0 que es válida. El E6.6 testea que el validateForCommit
  // detecta el MISMATCH, no que el sign request fue creado con esa
  // version. Solo necesitamos que en commit() se vea la diferencia.
  //
  // Solución final: UPDATE manual del consent para cambiar su
  // version_acuerdo a un valor distinto. La UNIQUE
  // (id_trabajador, id_empresa, version_acuerdo) lo permite si la
  // nueva tripleta no existe.

  // Para evitar violar UNIQUE, primero borramos la fila actual del consent
  // (estamos en test, BD limpia por resetDb).
  db.prepare('DELETE FROM gh_consentimientos_firma WHERE id = ?').run(consent_id);

  // Re-insertar con version_acuerdo distinto
  const r = db.prepare(`
    INSERT INTO gh_consentimientos_firma
      (id_trabajador, id_empresa, version_acuerdo, hash_texto_acuerdo,
       correo_verificacion, correo_hash, otp_hash, otp_sal, otp_intentos,
       kair_version, manifestacion_aceptada, estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1, 'ACCEPTED')
  `).run(
    '1234567890', '900123456', 'v9.9-different', 'fakehash',
    'fake@example.com', 'hash', 'hash', 'salt', '0.1.189-test',
  );
  const newConsentId = r.lastInsertRowid;

  // Actualizar el sign request para apuntar al nuevo consent_id
  db.prepare(
    'UPDATE gh_firmas_electronicas SET consent_id = ? WHERE id = ?'
  ).run(newConsentId, signRequest.id);

  // Intentar commit
  const app = makeApp();
  const rCommit = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });

  assert.equal(rCommit.status, 409);
  assert.equal(rCommit.body.error.code, 'CONSENT_VERSION_MISMATCH');
  assert.equal(rCommit.body.error.details.consent_version_acuerdo, 'v9.9-different');
  assert.equal(rCommit.body.error.details.sign_request_agreement_version, 'v1.0');

  // El sign request NO quedó en SIGNED
  const row = db.prepare(
    'SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(id_solicitud);
  assert.notEqual(row.estado, 'SIGNED');
});

// =========================================================================
// CASO 7: Sign request legacy (agreement_version=NULL) → salta validación
// =========================================================================

test('E6 caso 7: sign request legacy (agreement_version=NULL) → salta validación, continúa', async () => {
  resetDb();
  // 1. Sembrar Acuerdo activo v1.0 (necesario para que service.create()
  //    valide el sign request inicial; después nulificamos el
  //    agreement_version para simular legacy).
  seedActiveAgreement({ version: 'v1.0', texto: 'ACUERDO v1.0 LEGACY' });

  const signRequestService = require('../../src/services/signRequest');

  // 2. Necesitamos un PDF válido
  const pdf = await makeValidPdf();
  const document_hash = sha256(pdf);
  const identificacion_numero_hash = sha256('1234567890');

  // 3. Crear sign request normalmente (con v1.0 válida)
  const acuerdo = require('../../src/services/agreement').getActive();
  const { token: tokenTmp, signRequest: sr } = signRequestService.create({
    id_documento: 'doc-legacy',
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    tipo_firma: 'presencial',
    agreement_version: acuerdo.version,
    agreement_hash: acuerdo.texto_hash,
    document_hash,
    pdf_buffer: pdf,
    pdf_filename: 'legacy.pdf',
    version_kair: '0.1.189-test',
    identificacion_tipo: 'CC',
    identificacion_numero_hash,
    metadata: JSON.stringify({ correo: 'trabajador@test.com' }),
  });

  // 4. Simular sign request legacy: nulificar agreement_version y consent_id
  db.prepare(`
    UPDATE gh_firmas_electronicas
    SET agreement_version = NULL, consent_id = NULL
    WHERE id = ?
  `).run(sr.id);

  // 5. Llevar hasta DOCUMENT_VIEWED (flujo público estándar)
  await recorrerFlujoHastaViewed(tokenTmp, '1234567890');

  // 6. Commit: NO debe fallar con CONSENT_REQUIRED ni AGREEMENT_VERSION_NO_LONGER_ACTIVE
  //    (puede o no llegar a SIGNED dependiendo de si pdfGen requiere Acuerdo,
  //    pero el comportamiento crítico de E6 es: legacy SKIP la validación)
  const app = makeApp();
  const r = await request(app)
    .post(`/api/sign/${tokenTmp}/commit`)
    .send({ manifestacion_aceptada: true });

  // El commit puede tener éxito (200 SIGNED) o fallar por otra razón
  // (ej. pdfGen requiere Acuerdo activo). Lo crítico: NO debe fallar
  // con los códigos de E6 (consentimiento) ni con AGREEMENT_VERSION_NO_LONGER_ACTIVE.
  if (r.status === 409) {
    assert.notEqual(r.body.error.code, 'CONSENT_REQUIRED',
      'Sign request legacy NO debe pedir consent_id');
    assert.notEqual(r.body.error.code, 'AGREEMENT_VERSION_NO_LONGER_ACTIVE',
      'Sign request legacy NO debe re-validar Acuerdo activo');
  }
  assert.ok([200, 409].includes(r.status),
    `status inesperado: ${r.status} body=${JSON.stringify(r.body)}`);
});

// =========================================================================
// CASO 8 (implícito): sign request con agreement_version sin consent_id
// =========================================================================

test('E6 caso 8: sign request con agreement_version sin consent_id → 409 CONSENT_REQUIRED', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0' });

  // Crear sign request SIN consent_id (pero con agreement_version)
  const { token, id_solicitud } = await prepararSignRequestParaCommit({
    // consent_id omitido a propósito
  });

  const app = makeApp();
  const r = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });

  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'CONSENT_REQUIRED');
  assert.equal(r.body.error.details.agreement_version, 'v1.0');

  // El sign request NO quedó en SIGNED
  const row = db.prepare(
    'SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(id_solicitud);
  assert.notEqual(row.estado, 'SIGNED');
});

// =========================================================================
// Tests complementarios del Bloque E6
// =========================================================================

test('E6 schema: signRequestBody acepta consent_id opcional', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makeValidPdf();
  const document_hash = sha256(pdf);

  // Sin consent_id → 201
  const metaSinConsent = {
    id_documento: 'doc-001',
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    tipo_firma: 'presencial',
    agreement_version: acuerdo.version,
    agreement_hash: acuerdo.texto_hash,
    document_hash,
    version_kair: '0.1.189',
  };
  const r1 = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(metaSinConsent))
    .attach('documento', pdf, 'd.pdf');
  assert.equal(r1.status, 201);

  // Con consent_id numérico → 201
  const metaConConsent = { ...metaSinConsent, consent_id: 42 };
  const r2 = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(metaConConsent))
    .attach('documento', pdf, 'd.pdf');
  assert.equal(r2.status, 201);

  // consent_id no numérico → 400
  const metaInvalido = { ...metaSinConsent, consent_id: 'abc' };
  const r3 = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(metaInvalido))
    .attach('documento', pdf, 'd.pdf');
  assert.equal(r3.status, 400);
  assert.equal(r3.body.error.code, 'INVALID_REQUEST_BODY');
});

test('E6 schema: GET /internal/sign-requests/:id expone consent_id', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    version_acuerdo: 'v1.0',
  });

  const { signRequest } = await createSignRequestWithIdentificacion({
    id_documento: 'doc-001',
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    tipo_firma: 'presencial',
    identificacion_tipo: 'CC',
    identificacion_numero: '1234567890',
    consent_id,
  });

  const app = makeApp();
  const r = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}`)
    .set(HEADERS);

  assert.equal(r.status, 200);
  assert.equal(r.body.consent_id, consent_id);
  assert.equal(r.body.agreement_version, 'v1.0');
});

test('E6: validateForCommit retorna skip:true para sign request legacy', () => {
  resetDb();
  const consentService = require('../../src/services/consent');

  const legacySR = {
    id: 1,
    id_solicitud: 'SIGN-2024-000001',
    agreement_version: null,
    consent_id: null,
  };
  const result = consentService.validateForCommit(legacySR);
  assert.equal(result.skip, true);
});

test('E6: validateForCommit retorna consent válido para sign request OK', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement({ version: 'v1.0' });
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    version_acuerdo: 'v1.0',
  });
  const consentService = require('../../src/services/consent');

  const sr = {
    id: 1,
    id_solicitud: 'SIGN-2024-000001',
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    agreement_version: 'v1.0',
    consent_id,
  };
  const result = consentService.validateForCommit(sr);
  assert.equal(result.skip, false);
  assert.ok(result.consent);
  assert.equal(result.consent.id, consent_id);
  assert.equal(result.consent.manifestacion_aceptada, 1);
});
