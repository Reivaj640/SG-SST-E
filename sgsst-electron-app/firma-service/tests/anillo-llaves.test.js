/**
 * Tests del ANILLO DE LLAVES (migración 022).
 *
 * Ejecutar: node --test --require ./tests/setup.js tests/anillo-llaves.test.js
 *
 * EL PROBLEMA QUE RESUELVE
 * ------------------------
 * Si todas las huellas se calculan con la llave vigente, el día que la
 * llave rota el 100% de las firmas anteriores queda sin poder verificarse.
 * Eso es PEOR que el problema que la rotación iba a resolver.
 *
 * Con el anillo, cada fila registra la VERSIÓN de llave con que se calculó
 * su huella (en la columna `*_alg`, con formato `hmac-sha256.v2.k1`) y al
 * verificar se prueban TODAS las versiones del anillo. La versión vieja se
 * conserva mientras viva la evidencia que la usó.
 *
 * Que se prueba:
 *  - Que rotar la llave NO invalide la evidencia anterior.
 *  - Que el marcador de la fila diga qué versión hay que reponer si se
 *    llegara a quitar una del anillo.
 *  - Que el token y el OTP sigan resolviéndose tras la rotación.
 *  - Que el ámbito por empresa sobreviva a la rotación.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../src/db/connection');
const { sha256 } = require('../src/crypto/hash');
const {
  hmacHex, algHmac, versionDeAlg, _resetKeyCache, listKeyVersions,
} = require('../src/crypto/hmac');
const { _setKeyRingForTests } = require('../src/crypto/keys');
const { tokenHashCandidates, hashTokenHmac } = require('../src/crypto/token');
const { hashOTPHmac, verifyOTPHmac } = require('../src/crypto/otp');
const { pseudonimo } = require('../src/services/trabajador');
const {
  resetDb, makeApp, createSignRequestWithIdentificacion,
} = require('./helpers');

const CEDULA = '1234567890';
const EMPRESA = '900123456';

const K1 = Buffer.from('11'.repeat(32), 'hex');
const K2 = Buffer.from('22'.repeat(32), 'hex');

/** Fija el anillo de llaves en memoria. */
function usarAnillo(versionActual, versiones) {
  _setKeyRingForTests({ versionActual, versiones });
  _resetKeyCache();
}

/** Vuelve al anillo por defecto: una sola versión, la llave maestra. */
function anilloPorDefecto() {
  _setKeyRingForTests(null);
  _resetKeyCache();
  const { getKeyRing } = require('../src/crypto/keys');
  const anillo = getKeyRing();
  usarAnillo(anillo.versionActual, anillo.versiones);
}

test.after(() => {
  _resetKeyCache();
});

test('sin anillo configurado hay una sola versión: la llave maestra', () => {
  anilloPorDefecto();
  const versiones = listKeyVersions();
  assert.equal(versiones.length, 1);
  assert.equal(algHmac(), 'hmac-sha256.v2.' + versiones[0]);
});

test('el marcador de cada fila dice con qué versión se calculó', () => {
  usarAnillo('k1', { k1: K1 });
  assert.equal(algHmac(), 'hmac-sha256.v2.k1');
  usarAnillo('k2', { k1: K1, k2: K2 });
  assert.equal(algHmac(), 'hmac-sha256.v2.k2');
  assert.equal(versionDeAlg(algHmac()), 'k2');
  anilloPorDefecto();
});

test('rotar la llave NO invalida la evidencia anterior', async () => {
  resetDb();
  // 1. La fila se crea con k1 vigente.
  usarAnillo('k1', { k1: K1 });
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
  });

  const antes = db.prepare(
    'SELECT identificacion_numero_hash, identificacion_numero_alg FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.equal(antes.identificacion_numero_alg, 'hmac-sha256.v2.k1');
  assert.equal(
    antes.identificacion_numero_hash,
    hmacHex('identificacion', sha256(CEDULA), EMPRESA, 'k1')
  );

  // 2. Rota la llave: k2 entra en uso, k1 SIGUE en el anillo.
  usarAnillo('k2', { k1: K1, k2: K2 });

  // 3. La firma en curso se sigue podiendo verificar: la fila dice "k1" y
  //    la versión k1 está en el anillo.
  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: CEDULA, medio_otp_confirmado: true, medio_otp_version: '1.0' });

  assert.equal(res.status, 200, 'la rotación no puede invalidar una firma en curso');
  assert.equal(res.body.estado, 'OTP_SENT');

  // 4. Y la fila nueva se calcula con la versión vigente.
  const despues = db.prepare(
    'SELECT otp_alg FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.equal(despues.otp_alg, 'hmac-sha256.v2.k2');

  anilloPorDefecto();
});

test('MUTACION: sin el anillo, rotar la llave dejaria la fila sin poder verificar', () => {
  // Con una sola llave, la huella de la fila solo se puede reproducir con
  // ESA llave. Al rotar, la evidencia anterior queda muerta.
  usarAnillo('k1', { k1: K1 });
  const conK1 = hmacHex('identificacion', 'previo', EMPRESA, 'k1');

  // Rotación "tradicional": la llave vieja desaparece.
  usarAnillo('k2', { k2: K2 });
  const conK2 = hmacHex('identificacion', 'previo', EMPRESA, 'k2');
  assert.notEqual(conK1, conK2, 'la huella cambia al rotar');

  // Con el anillo, la fila sigue teniendo una forma de verificarse.
  usarAnillo('k2', { k1: K1, k2: K2 });
  const conAnillo = hmacHex('identificacion', 'previo', EMPRESA, 'k1');
  assert.equal(conAnillo, conK1, 'k1 sigue en el anillo: la evidencia sobrevive');

  anilloPorDefecto();
});

test('si se quita una version del anillo, el marcador dice cual reponer', () => {
  usarAnillo('k1', { k1: K1 });
  const marcador = algHmac();
  assert.equal(versionDeAlg(marcador), 'k1');

  // Se saca k1 del anillo (operación que el operador NO debe hacer sin
  // revisar la evidencia viva).
  usarAnillo('k2', { k2: K2 });
  assert.equal(versionDeAlg(marcador), 'k1',
    'el marcador de la fila dice exactamente qué versión hay que reponer');

  anilloPorDefecto();
});

test('el token de acceso sigue resolviéndose tras la rotación', async () => {
  resetDb();
  usarAnillo('k1', { k1: K1 });
  const { token } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
  });

  // El token se archivó con k1.
  const fila = db.prepare(
    'SELECT token_hash FROM gh_firmas_electronicas WHERE id_solicitud = (SELECT id_solicitud FROM gh_firmas_electronicas WHERE token_hash = ?)'
  );
  void fila;

  // Con k2 vigente y k1 en el anillo, el token se sigue resolviendo.
  usarAnillo('k2', { k1: K1, k2: K2 });
  const candidatos = tokenHashCandidates(token);
  assert.ok(candidatos.includes(hashTokenHmac(token)),
    'la huella vigente debe estar entre los candidatos');
  assert.equal(candidatos.length, 4, '2 versiones del anillo + formato v1 + sha256 pelado');

  anilloPorDefecto();
});

test('el OTP sigue verificándose tras la rotación', () => {
  usarAnillo('k1', { k1: K1 });
  const hash = hashOTPHmac('123456', EMPRESA);
  assert.equal(verifyOTPHmac('123456', hash, EMPRESA), true);

  // Tras rotar (k2 vigente, k1 en el anillo), el OTP viejo sigue validando.
  usarAnillo('k2', { k1: K1, k2: K2 });
  assert.equal(verifyOTPHmac('123456', hash, EMPRESA), true,
    'un OTP archivado con la version vieja debe seguir verificandose');
  assert.equal(verifyOTPHmac('999999', hash, EMPRESA), false);

  anilloPorDefecto();
});

test('el ambito por empresa sobrevive a la rotación', () => {
  usarAnillo('k1', { k1: K1 });
  const enEmpresa = pseudonimo(CEDULA, EMPRESA);
  const enOtra = pseudonimo(CEDULA, '900999999');
  assert.notEqual(enEmpresa, enOtra);

  // Tras rotar, la fila vieja (k1) sigue distinguiendo empresas.
  usarAnillo('k2', { k1: K1, k2: K2 });
  const cands = require('../src/services/trabajador').candidatosBusquedaConAmbitos(
    CEDULA, [EMPRESA, '900999999']
  );
  assert.ok(cands.includes(enEmpresa), 'el seudónimo viejo sigue siendo alcanzable');
  assert.ok(cands.includes(enOtra));
  assert.ok(cands.includes(CEDULA), 'y el valor crudo de las filas heredadas');

  anilloPorDefecto();
});
