/**
 * 10.4 · EL CAMINO POSITIVO DEL 9.5
 * ================================
 *
 * El 9.5 del Acuerdo dice:
 *
 *   "Este Acuerdo es de aplicación desde su fecha de vigencia y no tiene
 *    efectos retroactivos. El Trabajador que haya aceptado una versión
 *    anterior se rige por esa versión respecto de las firmas ya realizadas.
 *    Para las firmas posteriores a la entrada en vigencia de una versión
 *    nueva, el Trabajador debe leer y aceptar esa versión nueva en el
 *    momento mismo de la firma."
 *
 * El problema que esto resuelve: si se publica una v1.1 del Acuerdo
 * mientras hay solicitudes pendientes, el firmante que llega tarde se
 encontraba con un 409 sin salida. Eso IMPIDÍA publicar la v1.1: cambiar el
 * hash del Acuerdo dejaba a los trabajadores con enlaces colgados.
 *
 * Lo que estos tests fijan:
 *   1. El firmante VE la versión vigente (no la que tenía la solicitud).
 *   2. Al aceptar, la solicitud MIGRARA a esa versión (y queda la traza).
 *   3. Con la migración hecha, el documento se ve y la firma sale con la
 *      versión nueva.
 *   4. Si NO se re-acepta, el commit falla con un 409 ACCIONABLE (no un
 *      callejón sin salida).
 *   5. Los consentimientos ya aceptados de la versión anterior NO se tocan.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../src/db/connection');
const agreementService = require('../src/services/agreement');
const aprobacionPublicacion = require('../src/services/aprobacionPublicacion');
const {
  resetDb, seedActiveAgreement, makeApp, createSignRequestWithIdentificacion,
} = require('./helpers');

const TRABAJADOR = '1234567890';
const EMPRESA = '900123456';
const TEXTO_V11 = 'ACUERDO DE PRUEBA\nVersión v1.1 (la vigente)\ncon un deber legal nuevo';

function limpiar() {
  resetDb();
  seedActiveAgreement({ version: 'v1.0' });
}

/** Identifica y verifica el OTP del trabajador (el flujo público). */
async function hastaOtpVerificado(app, token) {
  const id = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: TRABAJADOR, medio_otp_confirmado: true, medio_otp_version: '1.0' })
    .timeout({ response: 5000 });
  // En el ambiente de test, el OTP de la firma vuelve en la respuesta.
  const otp = (id.body && id.body.devOtp) || '999999';
  const dev = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp })
    .timeout({ response: 5000 });
  assert.equal(dev.status, 200, 'el OTP tiene que quedar verificado');
  return dev;
}

/**
 * Publica la v1.1 y la deja activa (desactivando la v1.0).
 *
 * Decisión 1.f: publicar exige la autorización operativa registrada para ese
 * texto. Por eso se registra antes de publicar.
 */
function publicarV11() {
  aprobacionPublicacion.registrar({
    version: 'v1.1',
    texto: TEXTO_V11,
    tipo: 'OPERATIVA',
    aprobado_por: 'test:responsable',
    fecha: '2026-10-27',
    garantia: 'Verificación automática del texto',
    resultado_verificaciones: 'OK',
    responsable_despliegue: 'test:despliegue',
  });
  return agreementService.createVersion({
    version: 'v1.1',
    texto: TEXTO_V11,
    creado_por: 'test',
    kair_version: '0.1.189-test',
    activa: true,
  });
}

// ===========================================================================
// 1. El firmante ve la versión vigente
// ===========================================================================

test('10.4 · el contexto muestra la VERSIÓN VIGENTE del Acuerdo', async () => {
  limpiar();
  const app = makeApp();
  const { token } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });

  // Con la v1.0 activa, se ve la v1.0.
  const antes = await request(app)
    .get(`/s/${token}`)
    .set('Accept', 'application/json')
    .timeout({ response: 5000 });
  assert.equal(antes.body.acuerdo.version, 'v1.0');
  assert.equal(antes.body.acuerdo.requiere_aceptar_vigente, false);

  // Se publica la v1.1: el firmante tiene que ver ESA.
  publicarV11();
  const despues = await request(app)
    .get(`/s/${token}`)
    .set('Accept', 'application/json')
    .timeout({ response: 5000 });
  assert.equal(despues.body.acuerdo.version, 'v1.1',
    'el firmante lee la versión vigente, no la que tenía la solicitud');
  assert.equal(despues.body.acuerdo.requiere_aceptar_vigente, true);
  assert.equal(despues.body.acuerdo.texto, TEXTO_V11);
});

// ===========================================================================
// 2. Al aceptar, la solicitud migra
// ===========================================================================

test('10.4 · al aceptar, la solicitud migra a la versión vigente', async () => {
  limpiar();
  const app = makeApp();
  const { token, signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });
  await hastaOtpVerificado(app, token);

  publicarV11();

  const res = await request(app)
    .post(`/api/sign/${token}/consent/accept`)
    .send({})
    .timeout({ response: 5000 });
  assert.equal(res.status, 200, 'lo que aceptó es la versión vigente: '
    + JSON.stringify(res.body) + ' / ' + JSON.stringify(res.body && res.body.error));
  assert.equal(res.body.version_acuerdo, 'v1.1',
    'lo que aceptó es la versión vigente');

  // La fila de la solicitud quedó ligada a la v1.1.
  const fila = db.prepare(
    'SELECT agreement_version, agreement_hash, consent_id FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.equal(fila.agreement_version, 'v1.1');

  const v11 = agreementService.getByVersion('v1.1');
  assert.equal(fila.agreement_hash, v11.texto_hash,
    'la huella archivada es la del texto que el firmante leyó');

  // El consentimiento nuevo es de la v1.1 y está aceptado.
  const consent = db.prepare(
    'SELECT version_acuerdo, manifestacion_aceptada FROM gh_consentimientos_firma WHERE id = ?'
  ).get(fila.consent_id);
  assert.equal(consent.version_acuerdo, 'v1.1');
  assert.equal(consent.manifestacion_aceptada, 1);

  // Y el cambio de versión queda en la traza.
  const ev = db.prepare(
    "SELECT * FROM gh_firma_eventos WHERE firma_id = ? AND evento = 'AGREEMENT_VERSION_MIGRATED'"
  ).get(signRequest.id);
  assert.ok(ev, 'el cambio de versión queda registrado');
  const meta = JSON.parse(ev.metadata);
  assert.equal(meta.version_anterior, 'v1.0');
  assert.equal(meta.version_nueva, 'v1.1');
});

test('10.4 · el consentimiento ya aceptado de la versión anterior NO se toca', async () => {
  limpiar();
  const app = makeApp();
  const { token, signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });
  await hastaOtpVerificado(app, token);

  // Se acepta con la v1.0 (la vigente en ese momento).
  await request(app)
    .post(`/api/sign/${token}/consent/accept`)
    .send({})
    .timeout({ response: 5000 });

  const consentViejo = db.prepare(
    'SELECT id, version_acuerdo, manifestacion_aceptada, fecha_aceptacion FROM gh_consentimientos_firma WHERE id = ?'
  ).get(signRequest.consent_id);
  assert.equal(consentViejo.version_acuerdo, 'v1.0');
  assert.equal(consentViejo.manifestacion_aceptada, 1);
  const fechaAceptacion = consentViejo.fecha_aceptacion;

  // Ahora se publica la v1.1 y el firmante vuelve a pasar por la pantalla.
  publicarV11();
  const res = await request(app)
    .post(`/api/sign/${token}/consent/accept`)
    .send({})
    .timeout({ response: 5000 });
  assert.equal(res.status, 200);
  assert.equal(res.body.version_acuerdo, 'v1.1');

  // El consentimiento de la v1.0 sigue como estaba: es la prueba de lo que
  // ese trabajador aceptó en su momento (el 9.5: sin efectos retroactivos).
  const despues = db.prepare(
    'SELECT version_acuerdo, manifestacion_aceptada, fecha_aceptacion FROM gh_consentimientos_firma WHERE id = ?'
  ).get(consentViejo.id);
  assert.equal(despues.version_acuerdo, 'v1.0');
  assert.equal(despues.manifestacion_aceptada, 1);
  assert.equal(despues.fecha_aceptacion, fechaAceptacion,
    'el consentimiento viejo no se reescribe');
});

// ===========================================================================
// 3. Con la migración hecha, el flujo completo funciona
// ===========================================================================

test('10.4 · migrada la solicitud, el documento se ve y la firma sale con la v1.1', async () => {
  limpiar();
  const app = makeApp();
  const { token, signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });
  await hastaOtpVerificado(app, token);

  publicarV11();
  await request(app)
    .post(`/api/sign/${token}/consent/accept`)
    .send({})
    .timeout({ response: 5000 });

  // Ver el documento.
  const vista = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 5, scroll_al_final: true })
    .timeout({ response: 5000 });
  assert.equal(vista.status, 200, 'el documento se ve con la versión migrada');

  // Firmar.
  const commit = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true })
    .timeout({ response: 8000 });
  assert.equal(commit.status, 200, 'la firma sale: ' + JSON.stringify(commit.body));
  assert.equal(commit.body.estado, 'SIGNED');

  // La constancia identifica la versión VIGENTE que el firmante aceptó.
  const fila = db.prepare(
    'SELECT agreement_version FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.equal(fila.agreement_version, 'v1.1');
});

// ===========================================================================
// 4. Sin re-aceptar, el commit falla con un 409 ACCIONABLE
// ===========================================================================

test('10.4 · sin re-aceptar, la firma falla con un 409 que dice qué hacer', async () => {
  limpiar();
  const app = makeApp();
  const { token } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });
  await hastaOtpVerificado(app, token);

  // Se acepta con la v1.0.
  await request(app)
    .post(`/api/sign/${token}/consent/accept`)
    .send({})
    .timeout({ response: 5000 });

  // Se ve el documento con la v1.0.
  await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 5, scroll_al_final: true })
    .timeout({ response: 5000 });

  // Se publica la v1.1 AHORA: el firmante ya leyó la v1.0, así que su
  // aceptación no sirve para la v1.1.
  publicarV11();

  const commit = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true })
    .timeout({ response: 8000 });

  assert.equal(commit.status, 409);
  assert.equal(commit.body.error.code, 'AGREEMENT_VERSION_NO_LONGER_ACTIVE');
  assert.equal(commit.body.error.details.accion, 'reaceptar_version_vigente',
    'el 409 dice qué hacer: no es un callejón sin salida');
  assert.equal(commit.body.error.details.active_version, 'v1.1');
});
