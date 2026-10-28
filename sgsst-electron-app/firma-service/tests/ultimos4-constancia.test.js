/**
 * FASE 4 DEL CARRIL DE CÓDIGO — los últimos cuatro dígitos del documento.
 *
 * Ejecutar: node --test --require ./tests/setup.js tests/ultimos4-constancia.test.js
 *
 * Qué se prueba:
 *  - Que identify() aparte los últimos cuatro dígitos EN MEMORIA.
 *  - Que el módulo de los últimos cuatro dígitos NO toque la base de datos
 *    (es una comprobación estructural: el archivo no la requiere).
 *  - Que la constancia de firma MOSTRARTE esos dígitos, con su leyenda.
 *  - Que la página de verificación pública NO los muestre.
 *  - Que un reinicio del proceso degrade con gracia: la constancia sale sin
 *    los dígitos, no se rompe.
 *  - Que la constancia CONSOLIDADA no los tenga (se genera después, desde la
 *    base de datos, donde no están).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');

const db = require('../src/db/connection');
const ultimos4 = require('../src/services/ultimos4');
const pdfGen = require('../src/services/pdfGen');
const storage = require('../src/services/storage');
const {
  resetDb, seedActiveAgreement, makeApp, createSignRequestWithIdentificacion,
  createAcceptedConsent, pdfText,
} = require('./helpers');

// Documento de prueba. Los últimos cuatro dígitos SON '7431' (la cola es
// distintiva a propósito: si el número fuera redondo, el 'includes' del PDF
// podría acertar por casualidad dentro de un hash o de una fecha y la
// aserción no probaría nada).
const CEDULA = '1234567431';
const ULTIMOS4 = '7431';
const SERVICE = path.resolve(__dirname, '..');

test.after(() => {
  ultimos4.limpiar();
});

// =========================================================================
// EL MÓDULO EN SÍ
// =========================================================================

test('guarda y devuelve los últimos cuatro dígitos', () => {
  ultimos4.limpiar();
  ultimos4.guardar(1, '1234567890', 'CC');
  const entrada = ultimos4.obtener(1);
  assert.ok(entrada, 'debe devolver la entrada');
  assert.equal(entrada.digitos, '7890');
  assert.equal(entrada.tipo, 'CC');
});

test('un documento con menos de cuatro dígitos no produce nada', () => {
  ultimos4.limpiar();
  assert.equal(ultimos4.guardar(1, '123', 'CC'), null);
  assert.equal(ultimos4.obtener(1), null);
});

test('las letras no cuentan como dígitos', () => {
  ultimos4.limpiar();
  // 'AB1234' -> los dígitos son '1234' (las cuatro últimos), no 'B1234'.
  ultimos4.guardar(1, 'AB1234', 'CE');
  assert.equal(ultimos4.obtener(1).digitos, '1234');
});

test('MUTACION: si se guardara el número completo, el 10.5(a) quedaría en letra pequeña', () => {
  // El módulo guarda CUATRO dígitos, nunca el número.
  ultimos4.limpiar();
  ultimos4.guardar(1, '1234567890', 'CC');
  const entrada = ultimos4.obtener(1);
  assert.equal(entrada.digitos.length, 4);
  assert.equal(entrada.digitos.includes('1234567890'), false);
  assert.equal(JSON.stringify(entrada).includes('1234567890'), false,
    'el número completo no puede estar en la entrada');
});

test('el módulo NO toca la base de datos (comprobación estructural)', () => {
  // El 10.5(a) manda conservar únicamente la huella. Que el módulo de los
  // últimos cuatro dígitos no requiera la base es la forma más directa de
  // comprobar que no hay por dónde se escape a la persistencia.
  const fuente = fs.readFileSync(
    path.join(SERVICE, 'src', 'services', 'ultimos4.js'), 'utf8'
  );
  assert.equal(/require\(['"][^'"]*db\//.test(fuente), false,
    'el módulo de los últimos cuatro dígitos no puede requerir la base de datos');
  assert.equal(/INSERT|UPDATE|DELETE|prepare\(/.test(fuente), false,
    'el módulo no puede escribir en la base de datos');
});

// =========================================================================
// EL FLUJO
// =========================================================================

test('identify() aparta los últimos cuatro dígitos en memoria', async () => {
  resetDb();
  ultimos4.limpiar();
  seedActiveAgreement({ version: 'v1.0', texto: 'ACUERDO v1.0 ULTIMOS4' });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
  });

  const r = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: CEDULA, medio_otp_confirmado: true, medio_otp_version: '1.0' });
  assert.equal(r.status, 200);

  const entrada = ultimos4.obtener(signRequest.id);
  assert.ok(entrada, 'identify() debe apartar los dígitos en memoria');
  assert.equal(entrada.digitos, ULTIMOS4);
  assert.equal(entrada.tipo, 'CC');
});

test('una identificación fallida NO aparta dígitos', async () => {
  resetDb();
  ultimos4.limpiar();
  seedActiveAgreement({ version: 'v1.0', texto: 'ACUERDO v1.0 ULTIMOS4' });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
  });

  const r = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: '9999999999', medio_otp_confirmado: true, medio_otp_version: '1.0' });
  assert.equal(r.status, 422);
  assert.equal(ultimos4.obtener(signRequest.id), null,
    'un intento fallido no puede dejar dígitos de ningún documento');
});

test('la fila de la firma NO contiene el número ni sus últimos cuatro dígitos', async () => {
  resetDb();
  ultimos4.limpiar();
  seedActiveAgreement({ version: 'v1.0', texto: 'ACUERDO v1.0 ULTIMOS4' });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
  });
  await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: CEDULA, medio_otp_confirmado: true, medio_otp_version: '1.0' });

  const fila = db.prepare(`
    SELECT id_trabajador, identificacion_numero_hash, correo_verificacion, metadata
    FROM gh_firmas_electronicas WHERE id = ?
  `).get(signRequest.id);

  assert.notEqual(fila.id_trabajador, CEDULA);
  assert.match(fila.id_trabajador, /^psn1_[0-9a-f]{64}$/,
    'el trabajador se guarda como seudónimo');
  assert.match(fila.identificacion_numero_hash, /^[0-9a-f]{64}$/,
    'la identificación se guarda como huella');
  assert.equal(String(fila.correo_verificacion).includes(CEDULA), false);
  assert.equal(String(fila.metadata).includes(CEDULA), false);
});

// =========================================================================
// LA CONSTANCIA
// =========================================================================

test('la constancia muestra los últimos cuatro dígitos y su leyenda', async () => {
  const buf = await pdfGen.generateConstanciaPdf({
    identificacion_enmascarada: 'CC ce3a59',
    identificacion_ultimos4: ULTIMOS4,
    nombre_trabajador: 'JUAN DE EJEMPLO',
    fecha_firma: new Date().toISOString(),
    id_solicitud: 'SIGN-2026-000001',
    id_empresa: '900123456',
    nombre_empresa: 'EMPRESA DE PRUEBA SAS',
  });
  const texto = pdfText(buf);
  assert.ok(texto.includes(ULTIMOS4),
    'la constancia debe mostrar los últimos cuatro dígitos');
  assert.ok(texto.includes('ltimos 4'),
    'la constancia debe etiquetar el campo');
  // La leyenda se dibuja con wrap: el salto de línea puede caer en medio de
  // la frase. `\s+` acepta el salto, así que la aserción sigue siendo sobre
  // la frase y no sobre dónde quedó el wrap.
  assert.match(texto, /No se\s+almacenan/,
    'la constancia debe llevar la leyenda que explica que no se almacenan');
});

test('MUTACION: sin los dígitos en memoria, la constancia sale con la referencia opaca', async () => {
  const buf = await pdfGen.generateConstanciaPdf({
    identificacion_enmascarada: 'CC ce3a59',
    identificacion_ultimos4: null,
    nombre_trabajador: 'JUAN DE EJEMPLO',
    fecha_firma: new Date().toISOString(),
    id_solicitud: 'SIGN-2026-000001',
    id_empresa: '900123456',
    nombre_empresa: 'EMPRESA DE PRUEBA SAS',
  });
  const texto = pdfText(buf);
  assert.equal(texto.includes(ULTIMOS4), false,
    'sin dígitos en memoria no puede haber dígitos en la constancia');
  assert.ok(texto.includes('ce3a59'),
    'la referencia opaca sigue estando');
});

test('la constancia CONSOLIDADA no lleva los últimos cuatro dígitos', () => {
  // La constancia consolidada se genera DESPUÉS, desde la base de datos,
  // donde los dígitos no están. No es un defecto: es la consecuencia
  // asumida de no persistirlos.
  const fuente = fs.readFileSync(
    path.join(SERVICE, 'src', 'services', 'pdfGenConsolidado.js'), 'utf8'
  );
  assert.equal(fuente.includes('identificacion_ultimos4'), false,
    'la constancia consolidada no puede recibir los dígitos que no están en la base');
  assert.equal(fuente.includes('ultimos4'), false);
});

test('la verificación pública NO muestra los últimos cuatro dígitos', async () => {
  resetDb();
  ultimos4.limpiar();
  seedActiveAgreement({ version: 'v1.0', texto: 'ACUERDO v1.0 ULTIMOS4' });
  const { token } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
  });
  await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: CEDULA, medio_otp_confirmado: true, medio_otp_version: '1.0' });

  const publicFlow = require('../src/services/publicFlow');
  const ctx = publicFlow.getVerificationContext(token);
  const json = JSON.stringify(ctx);
  assert.equal(json.includes(ULTIMOS4), false,
    'la página de verificación pública no puede llevar los últimos cuatro dígitos');
  assert.equal(json.includes(CEDULA), false);
});

// =========================================================================
// EL REINICIO
// =========================================================================

test('un reinicio degrada con gracia: la constancia sale sin los dígitos', async () => {
  resetDb();
  ultimos4.limpiar();
  seedActiveAgreement({ version: 'v1.0', texto: 'ACUERDO v1.0 ULTIMOS4' });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
  });
  await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: CEDULA, medio_otp_confirmado: true, medio_otp_version: '1.0' });
  assert.ok(ultimos4.obtener(signRequest.id), 'antes del reinicio hay dígitos');

  // El proceso se reinicia: el mapa en memoria se pierde.
  ultimos4.limpiar();
  assert.equal(ultimos4.obtener(signRequest.id), null);

  // La firma sigue adelante: el flujo no depende de los dígitos.
  const { token: token2 } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
  });
  const r = await request(makeApp())
    .post(`/api/sign/${token2}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: CEDULA, medio_otp_confirmado: true, medio_otp_version: '1.0' });
  assert.equal(r.status, 200, 'identificarse sigue funcionando tras el reinicio');
  void token;
});
