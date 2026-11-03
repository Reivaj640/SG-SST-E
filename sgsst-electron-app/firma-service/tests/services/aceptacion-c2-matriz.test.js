/**
 * C-2 (A1 9.2) y J3 (A1 5.6): el registro de aceptación y la puesta a
 * disposición de las políticas.
 *
 * EL PROBLEMA
 * ------------
 * La aceptación del Trabajador quedaba ligada SOLO a la huella del Acuerdo,
 * pero el ordinal 3 de la Manifestación de Voluntad delega en la matriz del
 * Anexo de Encargo la definición de qué finalidades se fundan en su
 * autorización: el Titular aceptaba sobre una matriz que no aceptaba ni veía.
 *
 * Y el 5.6 exige que el registro de aceptación consigne el MEDIO por el que
 * las políticas se pusieron a disposición y la FECHA de esa puesta a
 * disposición, que no puede ser posterior a la fecha de aceptación.
 *
 * LO QUE SE COMPRUEBA ACÁ
 * -----------------------
 *  - La matriz de finalidades se le pone a disposición al Firmante ANTES de
 *    habilitar la casilla de aceptación, con su versión y su huella.
 *  - El servidor registra CUÁNDO puso las políticas a disposición (la fecha la
 *    pone el servidor, no el navegador).
 *  - El registro de aceptación consigna, en el mismo acto: la versión y la
 *    huella del Anexo de Encargo y del Anexo de Nube que rigen esa firma para
 *    esa Empresa, la versión y la huella de la matriz, el medio y la fecha.
 *  - Si el Firmante NO declara el medio, el servidor no lo inventa: rechaza.
 *  - Si el servidor no tiene constancia de la puesta a disposición, no inventa
 *    la fecha: rechaza.
 *  - La evidencia de la firma ata todo eso (el evidence_hash).
 *
 * Tests:
 *   - node --test --require ./tests/setup.js tests/services/aceptacion-c2-matriz.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../../src/db/connection');
const { sha256 } = require('../../src/crypto/hash');
const { canonicalJSON } = require('../../src/crypto/compare');
const {
  resetDb, makeApp, createPendingConsent, createSignRequestWithIdentificacion, aceptarAcuerdo,
  buildEvidenciaFirma,
} = require('../helpers');

const ID_EMPRESA = '900123456';
const ID_TRABAJADOR = '1234567890';
const ID_DOCUMENTO = 'doc-c2';

/**
 * Da de alta la Empresa con los DOS anexos firmados y canal de atención.
 *
 * Sin esto la Empresa no está habilitada para pedir firmas (el D-03) y ni
 * siquiera se puede crear el consentimiento de prueba.
 */
function sembrarEmpresa() {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, anexo_encargo_firmado_at,
       anexo_nube_firmado_at, anexo_nube_version, anexo_nube_hash, canal_pqrs, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    ID_EMPRESA,
    'EMPRESA DE PRUEBA SAS',
    '900123456',
    '2026-10-30T00:00:00.000Z',
    '2026-10-30T00:00:00.000Z',
    '2026-10-30',
    'a'.repeat(64),
    'https://ejemplo.test/pqrs'
  );
}

/**
 * Deja una solicitud en OTP_VERIFIED con su consentimiento PENDING.
 */
async function setupOtpVerified() {
  const { consent_id } = await createPendingConsent({
    id_trabajador: ID_TRABAJADOR,
    id_empresa: ID_EMPRESA,
  });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_documento: ID_DOCUMENTO,
    id_trabajador: ID_TRABAJADOR,
    id_empresa: ID_EMPRESA,
    identificacion_numero: ID_TRABAJADOR,
    consent_id,
  });
  const app = makeApp();
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({
      tipo_identificacion: 'CC',
      numero_documento: ID_TRABAJADOR,
      medio_otp_confirmado: true,
      medio_otp_version: '1.0',
    });
  assert.equal(r1.status, 200, `identify: ${JSON.stringify(r1.body)}`);
  const r2 = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });
  assert.equal(r2.status, 200, `verify-otp: ${JSON.stringify(r2.body)}`);
  return { app, token, consent_id, signRequest };
}

/**
 * La fila del consentimiento (lo que el servidor archiva).
 */
function leerConsentimiento(consent_id) {
  return db.prepare(
    'SELECT * FROM gh_consentimientos_firma WHERE id = ?'
  ).get(consent_id);
}

// =========================================================================
// 1. LA MATRIZ DE FINALIDADES A DISPOSICIÓN DEL FIRMANTE
// =========================================================================

test('C-2: la matriz de finalidades se sirve en el contexto con su versión y su huella', async () => {
  resetDb();
  sembrarEmpresa();
  const { app, token } = await setupOtpVerified();

  const res = await request(app).get(`/s/${token}`).set('Accept', 'application/json');

  assert.equal(res.status, 200);
  const matriz = res.body.matriz_finalidades;
  assert.ok(matriz, 'la matriz de finalidades tiene que estar en el contexto');
  assert.ok(matriz.version && matriz.version.length > 0,
    'la matriz tiene que traer su versión');
  assert.match(matriz.hash, /^[0-9a-f]{64}$/,
    'la matriz tiene que traer su huella SHA-256');
  assert.ok(matriz.texto && matriz.texto.length > 0,
    'la matriz tiene que traer el texto que va a leer el Firmante');
  assert.match(matriz.texto, /FINALIDADES/i,
    'el texto de la matriz es el que define las finalidades');
});

test('C-2: al servir el contexto el servidor registra la fecha de puesta a disposición', async () => {
  resetDb();
  sembrarEmpresa();
  const { app, token, signRequest } = await setupOtpVerified();

  const antes = db.prepare(
    'SELECT fecha_disposicion_politicas FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.equal(antes.fecha_disposicion_politicas, null,
    'antes de servir el contexto no hay fecha de puesta a disposición');

  await request(app).get(`/s/${token}`).set('Accept', 'application/json');

  const despues = db.prepare(
    'SELECT fecha_disposicion_politicas, matriz_version_disponible, matriz_hash_disponible'
    + ' FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.ok(despues.fecha_disposicion_politicas,
    'el servidor tiene que registrar cuándo puso las políticas a disposición');
  assert.match(despues.fecha_disposicion_politicas, /^\d{4}-\d{2}-\d{2}T/,
    'la fecha de puesta a disposición es una fecha del servidor');
  assert.match(despues.matriz_hash_disponible, /^[0-9a-f]{64}$/,
    'la matriz que se puso a disposición queda con su huella');
});

// =========================================================================
// 2. EL REGISTRO DE ACEPTACIÓN
// =========================================================================

test('C-2/J3: el registro de aceptación consigna los anexos, la matriz, el medio y la fecha', async () => {
  resetDb();
  sembrarEmpresa();
  const { app, token, consent_id, signRequest } = await setupOtpVerified();

  // El helper hace lo que hace la mini-app: sirve el contexto (el servidor
  // registra la puesta a disposicion) y acepta declarando el medio.
  const res = await aceptarAcuerdo(app, token);

  assert.equal(res.status, 200, `consent/accept: ${JSON.stringify(res.body)}`);
  assert.equal(res.body.manifestacion_aceptada, true);

  const c = leerConsentimiento(consent_id);
  assert.equal(c.manifestacion_aceptada, 1);

  // El medio, declarado por el Firmante.
  assert.equal(c.medio_disposicion, 'pantalla_firma',
    'el registro de aceptación tiene que consignar el medio de la puesta a disposición');

  // La fecha, puesta por el servidor, y NO posterior a la aceptación.
  assert.ok(c.fecha_disposicion, 'la fecha de puesta a disposición tiene que quedar consignada');
  assert.ok(c.fecha_disposicion <= c.fecha_aceptacion,
    `la puesta a disposición (${c.fecha_disposicion}) no puede ser posterior a la aceptación (${c.fecha_aceptacion})`);

  // La matriz que se le puso a disposición, con su versión y su huella.
  assert.ok(c.matriz_version, 'la matriz tiene que quedar con su versión');
  assert.match(c.matriz_hash, /^[0-9a-f]{64}$/,
    'la matriz tiene que quedar con su huella SHA-256');

  // Los anexos que rigen esa firma para esa Empresa.
  assert.ok(c.anexo_encargo_version, 'el Anexo de Encargo tiene que quedar con su versión');
  assert.match(c.anexo_encargo_hash, /^[0-9a-f]{64}$/,
    'el Anexo de Encargo tiene que quedar con su huella SHA-256');
  assert.ok(c.anexo_encargo_firmado_at, 'la firma del Anexo de Encargo por la Empresa tiene que quedar');

  // El Anexo de Nube: la VERSIÓN FIRMADA por esa Empresa, no el modelo.
  assert.equal(c.anexo_nube_version, '2026-10-30',
    'el Anexo de Nube que rige es el que firmó la Empresa');
  assert.equal(c.anexo_nube_hash, 'a'.repeat(64),
    'la huella del Anexo de Nube es la de la versión firmada');
  assert.equal(c.anexo_nube_origen, 'version_firmada_por_empresa');
  assert.ok(c.anexo_nube_firmado_at, 'la firma del Anexo de Nube tiene que quedar');

  // Y la respuesta lo dice, para que el cliente pueda mostrarlo.
  assert.equal(res.body.medio_disposicion, 'pantalla_firma');
  assert.equal(res.body.matriz_hash, c.matriz_hash);
});

test('J3: sin el medio declarado el servidor NO lo inventa y no acepta', async () => {
  resetDb();
  sembrarEmpresa();
  const { app, token, consent_id } = await setupOtpVerified();

  await request(app).get(`/s/${token}`).set('Accept', 'application/json');

  const res = await request(app)
    .post(`/api/sign/${token}/consent/accept`)
    .send({});

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'MEDIO_DISPOSICION_MISSING');

  const c = leerConsentimiento(consent_id);
  assert.equal(c.manifestacion_aceptada, 0,
    'sin medio declarado no puede quedar una aceptación registrada');
  assert.equal(c.medio_disposicion, null);
});

test('J3: un medio que no está permitido se rechaza', async () => {
  resetDb();
  sembrarEmpresa();
  const { app, token, consent_id } = await setupOtpVerified();

  await request(app).get(`/s/${token}`).set('Accept', 'application/json');

  const res = await request(app)
    .post(`/api/sign/${token}/consent/accept`)
    .send({ medio_disposicion: 'correo_electronico' });

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'MEDIO_DISPOSICION_INVALID');

  const c = leerConsentimiento(consent_id);
  assert.equal(c.manifestacion_aceptada, 0);
  assert.equal(c.medio_disposicion, null);
});

test('J3: sin puesta a disposición registrada el servidor NO inventa la fecha', async () => {
  resetDb();
  sembrarEmpresa();
  const { app, token, consent_id } = await setupOtpVerified();

  // OJO: acá NO se sirve el contexto. El servidor nunca puso las políticas a
  // disposición y no puede inventar cuándo lo hizo.
  const res = await request(app)
    .post(`/api/sign/${token}/consent/accept`)
    .send({ medio_disposicion: 'pantalla_firma' });

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'DISPOSICION_POLITICAS_NO_REGISTRADA');

  const c = leerConsentimiento(consent_id);
  assert.equal(c.manifestacion_aceptada, 0,
    'no puede quedar una aceptación sin la fecha de puesta a disposición');
  assert.equal(c.fecha_disposicion, null);
});

// =========================================================================
// 3. LA EVIDENCIA DE LA FIRMA
// =========================================================================

test('C-2: la evidencia de la firma ata el alcance de la aceptación', async () => {
  resetDb();
  sembrarEmpresa();
  const { app, token, consent_id } = await setupOtpVerified();

  await request(app).get(`/s/${token}`).set('Accept', 'application/json');
  const aceptacion = await request(app)
    .post(`/api/sign/${token}/consent/accept`)
    .send({ medio_disposicion: 'pantalla_firma' });
  assert.equal(aceptacion.status, 200, `consent/accept: ${JSON.stringify(aceptacion.body)}`);

  const vista = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 30, scroll_al_final: true });
  assert.equal(vista.status, 200, `view-document: ${JSON.stringify(vista.body)}`);

  const commit = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });
  assert.equal(commit.status, 200, `commit: ${JSON.stringify(commit.body)}`);

  const sr = db.prepare(
    'SELECT * FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(commit.body.id_solicitud);
  const c = leerConsentimiento(consent_id);

  // La evidencia se arma con lo que quedó en el registro de aceptación.
  // La composición vive en UN SOLO LUGAR (`buildEvidenciaFirma`,
  // tests/helpers.js): es la receta de recomputación por terceros.
  const evidencia = buildEvidenciaFirma(sr, c);

  assert.equal(sr.evidence_hash, sha256(canonicalJSON(evidencia)),
    'el evidence_hash tiene que comprometer el alcance de la aceptación');

  // Y el alcance no es unaacceptación vacía: tiene los datos del C-2.
  assert.ok(evidencia.matriz_hash, 'la evidencia tiene que llevar la huella de la matriz');
  assert.equal(evidencia.medio_disposicion, 'pantalla_firma');
  assert.ok(evidencia.fecha_disposicion, 'la evidencia tiene que llevar la fecha de la puesta a disposición');
});
