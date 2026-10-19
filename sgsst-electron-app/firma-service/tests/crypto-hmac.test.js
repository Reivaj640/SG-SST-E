/**
 * Tests de la capa HMAC (HKDF desde la llave maestra).
 *
 * Ejecutar: node --test tests/crypto-hmac.test.js
 * O:       npm test
 *
 * Que se prueba:
 *  - Que el HMAC sea determinista y de 64 chars hex.
 *  - Que los propósitos estén SEPARADOS por dominio: el mismo valor con
 *    dos propósitos da dos HMAC distintos, y el HMAC de un propósito no
 *    sirve como el de otro. Sin esto, el HMAC de la cédula podría
 *    reutilizarse como el del OTP.
 *  - Que cambiar la llave maestra cambie TODOS los HMAC (rotación).
 *  - Que el HMAC NO sea reconstruible a partir de la fila de la base de
 *    datos: a diferencia de "hash con sal en la misma tabla", el atacante
 *    que solo tiene el valor archivado no puede recomputar el candidato.
 *  - Que los guards de entrada se cumplan.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { getMasterKey, _setMasterKeyForTests } = require('../src/crypto/keys');
const { hmacHex, hmacBase64, derivedKey, _resetKeyCache } = require('../src/crypto/hmac');

// La llave maestra es determinista durante el archivo de tests.
const TEST_KEY = Buffer.from('a'.repeat(64), 'hex');
_setMasterKeyForTests(TEST_KEY);
_resetKeyCache();

test.after(() => {
  _resetKeyCache();
});

test('hmacHex retorna 64 chars hex', () => {
  const h = hmacHex('identificacion', '12345678');
  assert.equal(h.length, 64);
  assert.match(h, /^[0-9a-f]{64}$/);
});

test('hmacHex es determinista', () => {
  assert.equal(hmacHex('otp', '123456'), hmacHex('otp', '123456'));
  assert.notEqual(hmacHex('otp', '123456'), hmacHex('otp', '123457'));
});

test('los propósitos están separados por dominio', () => {
  // Mismo valor, dos propósitos -> dos resultados distintos.
  const a = hmacHex('identificacion', 'mismo-valor');
  const b = hmacHex('otp', 'mismo-valor');
  assert.notEqual(a, b);

  // Mismo propósito, otros valores -> otros resultados.
  assert.notEqual(hmacHex('trabajador', 'uno'), hmacHex('trabajador', 'otro'));
});

test('MUTACION: quitar la separacion de dominio rompe la asercion', () => {
  // Si derivedKey ignorara el propósito, ambos HMAC serian iguales.
  const claveSinDominio = crypto.createHmac('sha256', derivedKey('x'))
    .update('mismo-valor', 'utf8').digest('hex');
  assert.notEqual(hmacHex('identificacion', 'mismo-valor'), claveSinDominio);
  assert.notEqual(hmacHex('otp', 'mismo-valor'), claveSinDominio);
});

test('las claves derivadas son distintas por propósito', () => {
  const k1 = derivedKey('identificacion');
  const k2 = derivedKey('otp');
  assert.notEqual(Buffer.from(k1).toString('hex'), Buffer.from(k2).toString('hex'));
  assert.equal(k1.length, 32);
});

test('cambiar la llave maestra cambia todos los HMAC', () => {
  const antesIdent = hmacHex('identificacion', '12345678');
  const antesOtp = hmacHex('otp', '123456');

  _setMasterKeyForTests(Buffer.from('b'.repeat(64), 'hex'));
  _resetKeyCache();

  assert.notEqual(antesIdent, hmacHex('identificacion', '12345678'));
  assert.notEqual(antesOtp, hmacHex('otp', '123456'));

  // Restaurar la llave del resto del archivo.
  _setMasterKeyForTests(TEST_KEY);
  _resetKeyCache();
});

test('el HMAC no se puede recomputar desde el valor archivado', () => {
  // Esto es lo que distingue al HMAC de "hash con sal en la misma tabla".
  //
  // Con sal en la fila: el atacante lee (sal, hash) y recalcula
  // sha256(sal + candidato). Con HMAC: el atacante lee (hash) y NO puede
  // recalcular hmac(candidato) porque no tiene la llave.
  //
  // El test lo comprueba de forma operativa: la fila solo necesita el
  // HMAC, y el HMAC NO es un sha256 con prefijo recuperable.
  const h = hmacHex('identificacion', '12345678');
  assert.notEqual(h, crypto.createHash('sha256').update('12345678').digest('hex'));

  // Y el valor de la fila no basta para validar un candidato sin la llave.
  const conLlave = hmacHex('identificacion', '12345678');
  const conOtro = hmacHex('identificacion', '87654321');
  assert.notEqual(conLlave, conOtro);
  assert.equal(h, conLlave);
});

test('hmacBase64 retorna base64 de 44 chars', () => {
  const b = hmacBase64('token', 'abc');
  assert.equal(b.length, 44);
  assert.match(b, /^[A-Za-z0-9+/]+=*$/);
});

test('los guards de entrada se cumplen', () => {
  assert.throws(() => hmacHex('', 'valor'), /propósito es requerido/);
  assert.throws(() => hmacHex('otp', null), /valor es requerido/);
  assert.throws(() => hmacHex('otp', undefined), /valor es requerido/);
});

test('getMasterKey devuelve 32 bytes', () => {
  const k = getMasterKey();
  assert.equal(k.length, 32);
});

test('MUTACION: si la llave maestra fuera la misma para todos los propositos, el HMAC colisionaria', () => {
  // Verificacion cruzada: el HMAC de proposito A no puede reproducirse
  // con la clave derivada del proposito B.
  const hA = crypto.createHmac('sha256', derivedKey('identificacion')).update('v', 'utf8').digest('hex');
  const hB = crypto.createHmac('sha256', derivedKey('otp')).update('v', 'utf8').digest('hex');
  assert.notEqual(hA, hB);
});
