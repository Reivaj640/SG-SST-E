/**
 * Tests del módulo crypto.
 *
 * Ejecutar: node --test tests/crypto.test.js
 * O:       npm test
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('../src/crypto');

test('sha256 retorna 64 chars hex', () => {
  const h = crypto.sha256('hola');
  assert.equal(h.length, 64);
  assert.match(h, /^[0-9a-f]{64}$/);
});

test('sha256 es determinista', () => {
  assert.equal(crypto.sha256('test'), crypto.sha256('test'));
  assert.notEqual(crypto.sha256('test'), crypto.sha256('test2'));
});

test('generateSalt produce salts únicos', () => {
  const s1 = crypto.generateSalt();
  const s2 = crypto.generateSalt();
  assert.equal(s1.length, 64);
  assert.equal(s2.length, 64);
  assert.notEqual(s1, s2);
});

test('hashWithSalt es determinista con misma sal', () => {
  const salt = 'fixed-salt-12345';
  const h1 = crypto.hashWithSalt('valor', salt);
  const h2 = crypto.hashWithSalt('valor', salt);
  assert.equal(h1, h2);
});

test('hashWithSalt produce hashes diferentes con sales diferentes', () => {
  const h1 = crypto.hashWithSalt('valor', 'sal-1');
  const h2 = crypto.hashWithSalt('valor', 'sal-2');
  assert.notEqual(h1, h2);
});

test('constantTimeEqual retorna true para strings iguales', () => {
  assert.equal(crypto.constantTimeEqual('abc', 'abc'), true);
});

test('constantTimeEqual retorna false para strings diferentes', () => {
  assert.equal(crypto.constantTimeEqual('abc', 'abd'), false);
  assert.equal(crypto.constantTimeEqual('abc', 'ab'), false);
  assert.equal(crypto.constantTimeEqual('abc', 'ABCD'), false);
});

test('canonicalJSON ordena claves', () => {
  const a = { b: 1, a: 2 };
  const b = { a: 2, b: 1 };
  assert.equal(crypto.canonicalJSON(a), crypto.canonicalJSON(b));
});

test('canonicalJSON maneja objetos anidados', () => {
  const obj = { z: { y: 2, x: 1 }, a: [3, 2, 1] };
  const c = crypto.canonicalJSON(obj);
  // Las claves 'x' e 'y' dentro de 'z' deben estar ordenadas
  assert.ok(c.includes('{"x":1,"y":2}'));
});

test('canonicalJSON produce formato estable', () => {
  const expected = '{"a":1,"b":2,"c":[1,2,3]}';
  const actual = crypto.canonicalJSON({ c: [1, 2, 3], b: 2, a: 1 });
  assert.equal(actual, expected);
});

test('generateToken retorna 32 chars', () => {
  const t = crypto.generateToken();
  assert.equal(t.length, 32);
  assert.match(t, /^[A-Za-z0-9_\-]{32}$/);
});

test('generateToken produce tokens únicos', () => {
  const set = new Set();
  for (let i = 0; i < 100; i++) set.add(crypto.generateToken());
  assert.equal(set.size, 100, 'Tokens deben ser únicos');
});

test('hashToken es determinista', () => {
  const t = crypto.generateToken();
  const h1 = crypto.hashToken(t);
  const h2 = crypto.hashToken(t);
  assert.equal(h1, h2);
  assert.equal(h1.length, 64);
});

test('generateIdSolicitud formato correcto', () => {
  const id = crypto.generateIdSolicitud(2026, 123);
  assert.equal(id, 'SIGN-2026-000123');
});

test('generateOTP retorna 6 dígitos', () => {
  const otp = crypto.generateOTP();
  assert.equal(otp.length, 6);
  assert.match(otp, /^\d{6}$/);
});

test('generateOTP produce OTPs únicos', () => {
  const set = new Set();
  for (let i = 0; i < 100; i++) set.add(crypto.generateOTP());
  // No podemos garantizar 100 únicos (espacio = 10^6) pero al menos
  // la probabilidad de colisión es muy baja
  assert.ok(set.size > 95);
});

test('hashOTP retorna hash de 64 chars y salt', () => {
  const { hash, salt } = crypto.hashOTP('123456');
  assert.equal(hash.length, 64);
  assert.equal(salt.length, 64);
});

test('verifyOTP retorna valid:true con OTP correcto', () => {
  const otp = crypto.generateOTP();
  const { hash, salt } = crypto.hashOTP(otp);
  const result = crypto.verifyOTP(otp, hash, salt, 0);
  assert.equal(result.valid, true);
  assert.equal(result.attempts, 1);
});

test('verifyOTP retorna valid:false con OTP incorrecto', () => {
  const { hash, salt } = crypto.hashOTP('123456');
  const result = crypto.verifyOTP('654321', hash, salt, 0);
  assert.equal(result.valid, false);
  assert.equal(result.attempts, 1);
});

test('verifyOTP retorna valid:false con formato inválido', () => {
  const { hash, salt } = crypto.hashOTP('123456');
  assert.equal(crypto.verifyOTP('abc', hash, salt, 0).valid, false);
  assert.equal(crypto.verifyOTP('12345', hash, salt, 0).valid, false);
  assert.equal(crypto.verifyOTP('1234567', hash, salt, 0).valid, false);
});

test('isLocked detecta bloqueo', () => {
  assert.equal(crypto.isLocked(5, 5), true);
  assert.equal(crypto.isLocked(4, 5), false);
  assert.equal(crypto.isLocked(10, 5), true);
});

test('isExpired detecta expiración', () => {
  const now = Date.now();
  const hace11min = new Date(now - 11 * 60 * 1000).toISOString();
  const hace9min = new Date(now - 9 * 60 * 1000).toISOString();
  assert.equal(crypto.isExpired(hace11min, 600, now), true);
  assert.equal(crypto.isExpired(hace9min, 600, now), false);
  assert.equal(crypto.isExpired(null, 600, now), true);
});
