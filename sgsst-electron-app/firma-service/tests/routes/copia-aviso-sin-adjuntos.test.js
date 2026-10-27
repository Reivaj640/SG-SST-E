'use strict';

/**
 * tests/routes/copia-aviso-sin-adjuntos.test.js
 *
 * El correo que sale al cerrar la firma electrónica es un AVISO con enlace,
 * no un envío de documentos.
 *
 * Qué se prueba acá:
 *
 *  1. Tras el commit, el correo al firmante NO lleva adjuntos: ni el PDF
 *     firmado ni la Constancia. La copia se entrega por el enlace de firma
 *     (el 5.4 del Acuerdo de uso: el Firmante puede descargar copia del
 *     documento firmado desde el propio enlace de firma).
 *  2. El aviso SÍ dice dónde está la copia: el enlace del propio flujo.
 *  3. El aviso no lleva datos del documento ni el número de identificación
 *     del firmante.
 *  4. El evento COPY_SENT sigue existiendo y el estado de la solicitud no
 *     cambia: la copia sí se entregó, por vía electrónica.
 *  5. La firma EN PAPEL sigue recibiendo el archivo por correo: ahí el
 *     Trabajador no tiene cuenta ni enlace con el que bajar nada, y el
 *     flujo electrónico de esa solicitud queda cancelado.
 *
 * Todo se prueba contra la app real y el mailer real, no contra mocks.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');

const db = require('../../src/db/connection');
const mailer = require('../../src/services/mailer');
const {
  resetDb, makeApp, createSignRequestWithIdentificacion,
} = require('../helpers');

const CORREO_FIRMANTE = 'firmante@ejemplo.com';

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
  assert.equal(r5.body.estado, 'SIGNED');
  return r5.body;
}

// =========================================================================
// 1. EL CORREO POST-FIRMA NO LLEVA ADJUNTOS
// =========================================================================

test('el correo post-firma se envía SIN adjuntos', async () => {
  resetDb();

  const { token, signRequest } = await createSignRequestWithIdentificacion({
    correo_verificacion: CORREO_FIRMANTE,
  });

  const app = makeApp();
  await firmar(app, token);

  const aviso = mailer.getDevInbox().find((m) => m.tipo === 'copy_aviso');
  assert.ok(aviso, 'tiene que salir un aviso post-firma');
  assert.equal(aviso.to, CORREO_FIRMANTE);

  // Lo que se comprueba: el aviso NO tiene la lista de adjuntos. Ni el PDF
  // firmado ni la Constancia viajan por correo.
  assert.equal(aviso.attachments, undefined,
    'el aviso no puede llevar adjuntos');
  assert.ok(!Object.prototype.hasOwnProperty.call(aviso, 'attachments'),
    'la clave attachments no debe existir en el aviso');

  // Y el cuerpo no promete un adjunto ni lo describe.
  assert.ok(!/Adjuntamos/.test(aviso.body),
    'el cuerpo no debe prometer un adjunto: ' + aviso.body);
  assert.ok(!/\.pdf/.test(aviso.body),
    'el cuerpo no debe citar archivos: ' + aviso.body);
});

// =========================================================================
// 2. EL AVISO DICE D�NDE ESTÁ LA COPIA
// =========================================================================

test('el aviso lleva el enlace de descarga y no datos del documento', async () => {
  resetDb();

  const { token, signRequest } = await createSignRequestWithIdentificacion({
    correo_verificacion: CORREO_FIRMANTE,
  });

  const app = makeApp();
  await firmar(app, token);

  const aviso = mailer.getDevInbox().find((m) => m.tipo === 'copy_aviso');
  assert.ok(aviso, 'tiene que salir un aviso post-firma');

  // 1. El enlace es el del propio flujo de firma (con el token).
  assert.ok(aviso.body.includes(`/s/${token}`),
    'el aviso tiene que traer el enlace de firma: ' + aviso.body);
  assert.ok(/https?:\/\//.test(aviso.body),
    'el enlace tiene que ser una URL absoluta: ' + aviso.body);

  // 2. Explica cómo se obtienen el documento firmado y la Constancia.
  assert.match(aviso.body, /Constancia/,
    'el aviso dice que hay una Constancia');
  assert.match(aviso.body, /documento firmado/i,
    'el aviso dice que hay un documento firmado');

  // 3. NO lleva el número de identificación del firmante.
  assert.ok(!aviso.body.includes('1234567890'),
    'el aviso no puede llevar el número de identificación: ' + aviso.body);

  // 4. NO lleva datos del documento (el id del documento que se firma).
  assert.ok(!aviso.body.includes('doc-001'),
    'el aviso no puede llevar el id del documento: ' + aviso.body);

  // 5. NO lleva el ID de la Constancia: ese identificador ya está impreso
  //    dentro del propio PDF de la Constancia.
  const fila = db.prepare(
    'SELECT id_constancia FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud);
  assert.ok(fila.id_constancia, 'la fila tiene id_constancia');
  assert.ok(!aviso.body.includes(fila.id_constancia),
    'el aviso no necesita el id de la Constancia: ya va impreso en el PDF');
});

// =========================================================================
// 3. LA COPIA SIGUE ENTREGÁNDOSE: EL EVENTO Y EL ESTADO NO CAMBIAN
// =========================================================================

test('la copia se sigue entregando: COPY_SENT existe y el estado es SIGNED', async () => {
  resetDb();

  const { token, signRequest } = await createSignRequestWithIdentificacion({
    correo_verificacion: CORREO_FIRMANTE,
  });

  const app = makeApp();
  await firmar(app, token);

  const eventos = db.prepare(
    'SELECT evento FROM gh_firma_eventos WHERE firma_id = ? ORDER BY id'
  ).all(signRequest.id).map((e) => e.evento);

  assert.ok(eventos.includes('COPY_SENT'),
    'la copia se entregó (por el enlace), así que el evento sigue: '
    + eventos.join(', '));
  assert.ok(!eventos.includes('COPY_FAILED'),
    'el aviso salió bien: ' + eventos.join(', '));

  const fila = db.prepare(
    'SELECT estado, pdf_firmado_path, constancia_path FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud);
  assert.equal(fila.estado, 'SIGNED', 'el estado de la solicitud no cambia');
  // Los archivos siguen en disco: el aviso no los borra ni los mueve.
  assert.ok(fs.existsSync(fila.pdf_firmado_path), 'el PDF firmado sigue en disco');
  assert.ok(fs.existsSync(fila.constancia_path), 'la Constancia sigue en disco');
});

// =========================================================================
// 4. LA FIRMA EN PAPEL SIGUE LLEVANDO EL ARCHIVO POR CORREO
// =========================================================================

test('la firma en papel sigue llevando el archivo adjunto', async () => {
  resetDb();
  mailer.clearDevInbox();

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-papel-'));
  const pdfPath = path.join(dir, 'firmado.pdf');
  const registroPath = path.join(dir, 'registro.pdf');
  fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4 papel'));
  fs.writeFileSync(registroPath, Buffer.from('%PDF-1.4 registro'));

  await mailer.sendCopiaFirmadoPapel({
    to: 'trabajador@ejemplo.com',
    pdfPath,
    constanciaPath: registroPath,
    context: { id_solicitud: 'SIGN-2026-000001', id_constancia: 'REGISTRO-SIGN-2026-000001' },
  });

  const copia = mailer.getDevInbox().find((m) => m.tipo === 'copy_signed');
  assert.ok(copia, 'la copia en papel se envía');
  assert.ok(copia.attachments && copia.attachments.length === 2,
    'la copia en papel lleva los dos archivos: ' + JSON.stringify(copia.attachments));
  assert.match(copia.subject, /papel/i,
    'el correo en papel lo dice, para que nadie lo confunda con la firma electrónica');

  fs.rmSync(dir, { recursive: true, force: true });
});
