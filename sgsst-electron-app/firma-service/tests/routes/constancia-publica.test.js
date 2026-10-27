'use strict';

/**
 * tests/routes/constancia-publica.test.js
 *
 * La Constancia se entrega desde el propio enlace de firma.
 *
 * Antes el Trabajador recibía la Constancia por correo, porque la única
 * ruta que la servía era la interna (/internal/sign-requests/:id/constancia.pdf,
 * que exige API key). Con el correo convertido en aviso sin adjuntos, la
 * Constancia tiene que poder bajarse por el enlace: es lo que el 5.4 del
 * Acuerdo de uso ya le daba al Firmante.
 *
 * Qué se prueba acá:
 *
 *  1. Con un token válido y la solicitud ya firmada, la ruta devuelve el
 *     PDF de la Constancia con los encabezados correctos.
 *  2. Un token inválido NO entrega nada.
 *  3. Una solicitud que todavía NO está firmada NO entrega nada.
 *  4. Una solicitud en estado terminal que no es "firmada" (rechazada,
 *     revocada, cancelada) tampoco entrega nada: son las mismas protecciones
 *     que tiene la ruta hermana del documento firmado.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('fs');

const db = require('../../src/db/connection');
const {
  resetDb, makeApp, createSignRequestWithIdentificacion,
} = require('../helpers');

/**
 * Recorre el flujo público hasta el commit (firma cerrada).
 */
async function firmar(app, token) {
  const r1 = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: '1234567890' });
  assert.equal(r1.status, 200, `identify: ${JSON.stringify(r1.body)}`);

  const r2 = await request(app)
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: r1.body.devOtp });
  assert.equal(r2.status, 200, `verify-otp: ${JSON.stringify(r2.body)}`);

  const r3 = await request(app)
    .post(`/api/sign/${token}/consent/accept`)
    .send({});
  assert.equal(r3.status, 200, `consent/accept: ${JSON.stringify(r3.body)}`);

  const r4 = await request(app)
    .post(`/api/sign/${token}/view-document`)
    .send({ segundos_en_pagina: 30, scroll_al_final: true });
  assert.equal(r4.status, 200, `view-document: ${JSON.stringify(r4.body)}`);

  const r5 = await request(app)
    .post(`/api/sign/${token}/commit`)
    .send({ manifestacion_aceptada: true });
  assert.equal(r5.status, 200, `commit: ${JSON.stringify(r5.body)}`);
  return r5.body;
}

// =========================================================================
// 1. CON TOKEN VÁLIDO Y SOLICITUD FIRMADA: EL PDF
// =========================================================================

test('la Constancia se baja del enlace con un token válido', async () => {
  resetDb();

  const { token, signRequest } = await createSignRequestWithIdentificacion();
  const app = makeApp();
  await firmar(app, token);

  const res = await request(app).get(`/api/sign/${token}/constancia.pdf`);

  assert.equal(res.status, 200, `constancia.pdf status=${res.status}`);
  assert.match(res.headers['content-type'], /application\/pdf/);
  assert.match(res.headers['content-disposition'], /attachment/);
  assert.match(res.headers['content-disposition'], /constancia\.pdf/);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.match(res.headers['cache-control'], /no-store/);

  // El PDF entregado es exactamente el que dejó el commit().
  const fila = db.prepare(
    'SELECT constancia_path FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud);
  assert.ok(fila.constancia_path, 'el commit guardó la Constancia en disco');
  const esperado = fs.readFileSync(fila.constancia_path);
  assert.equal(Number(res.headers['content-length']), esperado.length,
    'la longitud es la del archivo en disco');
  if (Buffer.isBuffer(res.body)) {
    assert.ok(res.body.equals(esperado), 'el PDF entregado es la Constancia');
    assert.equal(res.body.subarray(0, 5).toString(), '%PDF-', 'es un PDF');
  }
});

// =========================================================================
// 2. TOKEN INVÁLIDO
// =========================================================================

test('un token inválido no entrega la Constancia', async () => {
  resetDb();

  const app = makeApp();
  const res = await request(app).get('/api/sign/token-que-no-existe/constancia.pdf');

  assert.equal(res.status, 404, `status=${res.status}`);
  assert.equal(res.body.error.code, 'TOKEN_NOT_FOUND');
  assert.ok(!res.headers['content-disposition'],
    'una ruta inválida no devuelve un archivo');
});

// =========================================================================
// 3. SOLICITUD QUE TODAVÍA NO ESTÁ FIRMADA
// =========================================================================

test('una solicitud sin firmar no entrega la Constancia', async () => {
  resetDb();

  const { token } = await createSignRequestWithIdentificacion();
  const app = makeApp();

  // Ni siquiera ha pasado por la identidad.
  const res = await request(app).get(`/api/sign/${token}/constancia.pdf`);

  assert.equal(res.status, 409, `status=${res.status}`);
  assert.equal(res.body.error.code, 'CONSTANCIA_NOT_AVAILABLE');
  assert.equal(res.body.error.details.current_state, 'PENDING');
});

// =========================================================================
// 4. ESTADO TERMINAL QUE NO ES "FIRMADA"
// =========================================================================

test('una solicitud rechazada no entrega la Constancia', async () => {
  resetDb();

  const { token, signRequest } = await createSignRequestWithIdentificacion();

  db.prepare(
    "UPDATE gh_firmas_electronicas SET estado = 'REJECTED' WHERE id = ?"
  ).run(signRequest.id);

  const app = makeApp();
  const res = await request(app).get(`/api/sign/${token}/constancia.pdf`);

  // Mismo criterio que la ruta hermana del documento firmado: 410.
  assert.equal(res.status, 410, `status=${res.status}`);
  assert.equal(res.body.error.code, 'TOKEN_ALREADY_USED');
});
