'use strict';

/**
 * FASE 6 · orden (g)/(h) del Capítulo III y 5.4 del Acuerdo de uso.
 *
 * El texto que manda (Acuerdo de uso v1.0, fixture del repo):
 *
 *   3.4(g) Superada la verificación, el Trabajador lee en pantalla el presente
 *         Acuerdo, en la versión vigente, y lo acepta. [...] El Trabajador no
 *         puede avanzar en el flujo sin leer y aceptar el Acuerdo.
 *   3.4(h) El Trabajador visualiza y descarga el documento objeto de la firma.
 *   5.4   El Firmante puede imprimir o descargar copia de este Acuerdo y del
 *         documento firmado desde el propio enlace de firma, sin costo alguno.
 *
 * Qué se prueba acá:
 *
 *  1. ORDEN (g)/(h): con el OTP verificado pero SIN aceptar el Acuerdo, el
 *     documento no se sirve y su visualización no se registra. Antes de esta
 *     fase, con solo el OTP verificado bastaba para verlo: el Firmante veía
 *     el documento y la casilla del Acuerdo al mismo tiempo.
 *  2. ORDEN (g)/(h): tras aceptar el Acuerdo, el documento sí se sirve.
 *  3. 5.4: el enlace entrega el documento FIRMADO (no el original) y la copia
 *     del Acuerdo, con el SHA-256 del texto archivado.
 *  4. EL TOKEN SOLO NO SIRVE EL PDF FIRMADO ANTES DE LA IDENTIDAD: en ningún
 *     estado previo a la firma la descarga del documento firmado responde 409.
 *  5. El enlace firmado NO reabre el flujo: no se puede volver a firmar.
 *
 * Todo se prueba por HTTP contra la app real, no contra mocks.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const crypto = require('node:crypto');
const db = require('../src/db/connection');
const storage = require('../src/services/storage');
const {
  resetDb, makeApp, seedActiveAgreement, createSignRequestWithIdentificacion,
  createPendingConsent, assertJsonError,
} = require('./helpers');

const TRABAJADOR = '1234567890';
const EMPRESA = '900123456';
const IDENTIFICACION = '1234567890';

/**
 * Recorre el flujo público hasta OTP verificado.
 */
async function identificarYVerificar(app, token) {
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: IDENTIFICACION });
  assert.equal(r1.status, 200, `identify: ${JSON.stringify(r1.body)}`);

  const r2 = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });
  assert.equal(r2.status, 200, `verify-otp: ${JSON.stringify(r2.body)}`);
  return r2.body;
}

/**
 * Acepta el Acuerdo de uso (el paso (g)).
 */
async function aceptarAcuerdo(app, token) {
  const r = await request(app)
    .post(`/api/sign/${token}/consent/accept`)
    .send({});
  assert.equal(r.status, 200, `consent/accept: ${JSON.stringify(r.body)}`);
  return r.body;
}

/**
 * Deja la solicitud en SIGNED: OTP, Acuerdo aceptado, documento visto y
 * commit. Devuelve la fila de la solicitud.
 */
async function llegarAFirmado(app, token, id_solicitud) {
  await identificarYVerificar(app, token);
  await aceptarAcuerdo(app, token);

  const rView = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 30, scroll_al_final: true });
  assert.equal(rView.status, 200, `view-document: ${JSON.stringify(rView.body)}`);

  const rCommit = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });
  assert.equal(rCommit.status, 200, `commit: ${JSON.stringify(rCommit.body)}`);
  assert.equal(rCommit.body.estado, 'SIGNED');

  return db.prepare(
    'SELECT * FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(id_solicitud);
}

// =========================================================================
// 1. ORDEN (g)/(h): el documento va DESPUÉS de la aceptación del Acuerdo
// =========================================================================

test('FASE 6 · (g)/(h): sin aceptar el Acuerdo, el documento NO se sirve', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0' });

  const { consent_id } = await createPendingConsent({
    id_trabajador: TRABAJADOR, id_empresa: EMPRESA,
  });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR, id_empresa: EMPRESA, consent_id,
  });

  const app = makeApp();
  await identificarYVerificar(app, token);

  // 1. El PDF del documento NO se sirve
  const rPdf = await request(app).get(`/api/sign/${token}/document.pdf`);
  assert.equal(rPdf.status, 409, `document.pdf status=${rPdf.status}`);
  assertJsonError(rPdf, 'CONSENT_NOT_ACCEPTED');

  // 2. Tampoco se registra la visualización del documento
  const rView = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 30, scroll_al_final: true });
  assert.equal(rView.status, 409, `view-document status=${rPdf.status}`);
  assertJsonError(rView, 'CONSENT_NOT_ACCEPTED');

  // 3. La solicitud no avanzó de estado
  const row = db.prepare(
    'SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud);
  assert.equal(row.estado, 'OTP_VERIFIED');
});

test('FASE 6 · (g)/(h): el error del documento no filtra datos internos', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0' });

  const { consent_id } = await createPendingConsent({
    id_trabajador: TRABAJADOR, id_empresa: EMPRESA,
  });
  const { token } = await createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR, id_empresa: EMPRESA, consent_id,
  });

  const app = makeApp();
  await identificarYVerificar(app, token);

  const rPdf = await request(app).get(`/api/sign/${token}/document.pdf`);
  assert.equal(rPdf.status, 409);

  // El camino de error es uno solo, para todos los casos en que el Firmante
  // todavía no aceptó: no dice si el consentimiento falta, no existe o está
  // en otro estado, y no expone el id del consentimiento.
  const details = rPdf.body.error.details || {};
  assert.equal(details.consent_id, undefined);
  assert.equal(details.manifestacion_aceptada, undefined);
});

test('FASE 6 · (g)/(h): tras aceptar el Acuerdo, el documento sí se sirve', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0' });

  const { consent_id } = await createPendingConsent({
    id_trabajador: TRABAJADOR, id_empresa: EMPRESA,
  });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR, id_empresa: EMPRESA, consent_id,
  });

  const app = makeApp();
  await identificarYVerificar(app, token);
  await aceptarAcuerdo(app, token);

  // 1. El PDF del documento ya se sirve
  const rPdf = await request(app).get(`/api/sign/${token}/document.pdf`);
  assert.equal(rPdf.status, 200, `document.pdf status=${rPdf.status}`);
  assert.match(rPdf.headers['content-type'], /application\/pdf/);

  // 2. Y su visualización se registra
  const rView = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 30, scroll_al_final: true });
  assert.equal(rView.status, 200, `view-document status=${rView.status}`);
  assert.equal(rView.body.estado, 'DOCUMENT_VIEWED');

  const row = db.prepare(
    'SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud);
  assert.equal(row.estado, 'DOCUMENT_VIEWED');
});

test('FASE 6 · (g)/(h): el mini-app sabe si el Acuerdo ya está aceptado', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0' });

  const { consent_id } = await createPendingConsent({
    id_trabajador: TRABAJADOR, id_empresa: EMPRESA,
  });
  const { token } = await createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR, id_empresa: EMPRESA, consent_id,
  });

  const app = makeApp();

  // Antes de aceptar
  let r = await request(app).get(`/s/${token}`).set('Accept', 'application/json');
  assert.equal(r.status, 200);
  assert.equal(r.body.acuerdo_aceptado, false);

  await identificarYVerificar(app, token);
  await aceptarAcuerdo(app, token);

  // Después de aceptar (por ejemplo, tras recargar la página)
  r = await request(app).get(`/s/${token}`).set('Accept', 'application/json');
  assert.equal(r.status, 200);
  assert.equal(r.body.acuerdo_aceptado, true);
});

// =========================================================================
// 2. 5.4: el enlace entrega el documento firmado y la copia del Acuerdo
// =========================================================================

test('FASE 6 · 5.4: el enlace entrega el documento firmado, no el original', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0' });

  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR, id_empresa: EMPRESA,
  });

  const app = makeApp();
  const row = await llegarAFirmado(app, token, signRequest.id_solicitud);

  // El documento firmado se descarga como adjunto
  const rSigned = await request(app).get(`/api/sign/${token}/signed-document.pdf`);
  assert.equal(rSigned.status, 200, `signed-document.pdf status=${rSigned.status}`);
  assert.match(rSigned.headers['content-type'], /application\/pdf/);
  assert.match(rSigned.headers['content-disposition'], /attachment/);
  assert.match(rSigned.headers['content-disposition'], /-firmado\.pdf/);

  // Es el PDF firmado, y NO el original
  const firmado = storage.readPdf(row.pdf_firmado_path);
  const original = storage.readPdf(row.pdf_original_path);
  assert.notEqual(Buffer.compare(firmado, original), 0,
    'el documento firmado no puede ser el original');

  const recibido = Buffer.isBuffer(rSigned.body)
    ? rSigned.body
    : Buffer.from(rSigned.text || '', 'binary');
  assert.equal(Buffer.compare(recibido, firmado), 0,
    'lo que se descarga tiene que ser el PDF firmado');

  // Y el documento original ya no se sirve por esa ruta (el enlace entrega
  // el firmado, no el original)
  const rOriginal = await request(app).get(`/api/sign/${token}/document.pdf`);
  assert.equal(rOriginal.status, 410,
    `document.pdf post-firma status=${rOriginal.status}`);
});

test('FASE 6 · 5.4: el enlace entrega la copia del Acuerdo con su SHA-256', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0' });

  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR, id_empresa: EMPRESA,
  });

  const app = makeApp();
  const row = await llegarAFirmado(app, token, signRequest.id_solicitud);

  const rAcuerdo = await request(app).get(`/api/sign/${token}/acuerdo.txt`);
  assert.equal(rAcuerdo.status, 200, `acuerdo.txt status=${rAcuerdo.status}`);
  assert.match(rAcuerdo.headers['content-type'], /text\/plain/);
  assert.match(rAcuerdo.headers['content-disposition'], /attachment/);

  // El texto servido es el de la versión ligada a la solicitud
  const version = db.prepare(
    'SELECT agreement_version FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud).agreement_version;
  assert.equal(rAcuerdo.headers['x-acuerdo-version'], version);

  // Y su SHA-256 es el que quedó archivado
  const hashArchivado = db.prepare(
    'SELECT texto_hash FROM gh_firma_acuerdo_versiones WHERE version = ?'
  ).get(version).texto_hash;
  assert.equal(rAcuerdo.headers['x-acuerdo-sha256'], hashArchivado);

  const hashRecibido = crypto.createHash('sha256').update(rAcuerdo.text).digest('hex');
  assert.equal(hashRecibido, hashArchivado,
    'la copia del Acuerdo debe hashear al mismo valor que el archivado');

  // El texto no está vacío y es el que el Firmante aceptó
  assert.ok(rAcuerdo.text.length > 0);
  const consent = db.prepare(
    'SELECT hash_texto_acuerdo FROM gh_consentimientos_firma WHERE id = ?'
  ).get(row.consent_id);
  assert.equal(consent.hash_texto_acuerdo, hashArchivado);
});

// =========================================================================
// 3. EL TOKEN SOLO NO SIRVE EL PDF FIRMADO ANTES DE LA IDENTIDAD
// =========================================================================

test('FASE 6 · el token solo NO sirve el PDF firmado antes de la identidad', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0' });

  const { token } = await createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR, id_empresa: EMPRESA,
  });

  const app = makeApp();

  // 1. Solicitud recién creada: el token solo no descarga nada
  const r1 = await request(app).get(`/api/sign/${token}/signed-document.pdf`);
  assert.equal(r1.status, 409, `status=${r1.status}`);
  assertJsonError(r1, 'SIGNED_DOCUMENT_NOT_AVAILABLE');

  // 2. Con el OTP verificado pero sin aceptar el Acuerdo: tampoco
  await identificarYVerificar(app, token);
  const r2 = await request(app).get(`/api/sign/${token}/signed-document.pdf`);
  assert.equal(r2.status, 409, `status=${r2.status}`);
  assertJsonError(r2, 'SIGNED_DOCUMENT_NOT_AVAILABLE');

  // 3. Con el Acuerdo aceptado pero sin firmar: tampoco
  await aceptarAcuerdo(app, token);
  const r3 = await request(app).get(`/api/sign/${token}/signed-document.pdf`);
  assert.equal(r3.status, 409, `status=${r3.status}`);
  assertJsonError(r3, 'SIGNED_DOCUMENT_NOT_AVAILABLE');
});

test('FASE 6 · el enlace firmado NO reabre el flujo', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0' });

  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR, id_empresa: EMPRESA,
  });

  const app = makeApp();
  await llegarAFirmado(app, token, signRequest.id_solicitud);

  // No se puede volver a firmar
  const rCommit = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });
  assert.equal(rCommit.status, 410, `commit status=${rCommit.status}`);

  // No se puede volver a pedir OTP
  const rOtp = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: '000000' });
  assert.equal(rOtp.status, 410, `verify-otp status=${rOtp.status}`);

  // Pero sí se puede descargar lo que ya quedó firmado
  const rSigned = await request(app).get(`/api/sign/${token}/signed-document.pdf`);
  assert.equal(rSigned.status, 200);
});
