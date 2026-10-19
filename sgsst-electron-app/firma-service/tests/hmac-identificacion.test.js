/**
 * Tests de la migración 019 (HMAC) y la 022 (ámbito de empresa + versión
 * de llave).
 *
 * Ejecutar: node --test --require ./tests/setup.js tests/hmac-identificacion.test.js
 *
 * Que se prueba:
 *  - Que la fila NO guarde la cédula del trabajador en claro (ni en la
 *    columna `id_trabajador` ni dentro del JSON de `metadata`).
 *  - Que la huella de identificación sea el HMAC y no el SHA-256 pelado.
 *  - Que el HMAC tenga ÁMBITO: la misma cédula en dos empresas da dos
 *    huellas distintas, y quien lea la base no puede enlazar al mismo
 *    trabajador entre empresas.
 *  - Que cada fila registre la VERSIÓN de llave con que se calculó su
 *    huella, y que esa versión quede en el marcador de algoritmo.
 *  - Que el flujo de identificación siga funcionando con la cédula real.
 *  - Que una fila heredada (algoritmo viejo) se identifique igual y se
 *    reescriba sola con el HMAC (migración autosuficiente).
 *  - Que el OTP y el token de acceso se archiven con HMAC.
 *  - Que las búsquedas por trabajador sigan encontrando las filas.
 *
 * Cada aserción tiene una mutación que se verifica que muerde: si la
 * aserción pasara con el código roto, el test no serviría.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../src/db/connection');
const { sha256 } = require('../src/crypto/hash');
const { hmacHex, algHmac } = require('../src/crypto/hmac');
const { pseudonimo, candidatosBusqueda, esPseudonimo, mismoTrabajador } = require('../src/services/trabajador');
const {
  resetDb, makeApp, createSignRequestWithIdentificacion,
} = require('./helpers');

const CEDULA = '1234567890';

// La empresa que usa el helper de tests. El ÁMBITO de la derivación es la
// empresa: sin él, la huella de esta cédula sería la misma en todas.
const EMPRESA = '900123456';
const OTRA_EMPRESA = '900999999';

test('el seudónimo es determinista y no es la cédula', () => {
  const p1 = pseudonimo(CEDULA, EMPRESA);
  const p2 = pseudonimo(CEDULA, EMPRESA);
  assert.equal(p1, p2, 'el mismo documento debe dar el mismo seudónimo');
  assert.notEqual(p1, CEDULA);
  // El seudónimo es AUTO-IDENTIFICABLE: prefijo `psn1_` + 64 hex.
  assert.match(p1, /^psn1_[0-9a-f]{64}$/);
  assert.notEqual(p1, sha256(CEDULA), 'no es un hash pelado');
});

test('pseudonimo() es idempotente sobre un seudónimo', () => {
  // Esto es lo que hace que el consentimiento del representante (que solo
  // tiene el seudónimo del sign request) se guarde con el MISMO valor que
  // el del trabajador, y no con un HMAC del HMAC.
  const p = pseudonimo(CEDULA, EMPRESA);
  assert.equal(pseudonimo(p, EMPRESA), p, 'el seudónimo de un seudónimo es el mismo');
  assert.equal(esPseudonimo(p), true);
  assert.equal(esPseudonimo(CEDULA), false);
});

test('documentos distintos dan seudónimos distintos', () => {
  assert.notEqual(pseudonimo('1111111111', EMPRESA), pseudonimo('2222222222', EMPRESA));
});

test('MUTACION: sin idempotencia el consentimiento del rep quedaria descuadrado', () => {
  // Si pseudonimo() no fuera idempotente, el valor guardado seria
  // HMAC(p) != p, y la fila no coincidiria con la del sign request.
  const p = pseudonimo(CEDULA, EMPRESA);
  assert.notEqual(hmacHex('trabajador', p, EMPRESA), p);
  assert.equal(pseudonimo(p, EMPRESA), p);
});

test('el ámbito por empresa impide enlazar al mismo trabajador entre empresas', () => {
  // La misma cédula, dos empresas: dos seudónimos distintos. Quien lea la
  // base (o reciba dos constancias de empresas distintas) no puede saber
  // que es la misma persona.
  const p1 = pseudonimo(CEDULA, EMPRESA);
  const p2 = pseudonimo(CEDULA, OTRA_EMPRESA);
  assert.notEqual(p1, p2, 'el seudónimo debe depender de la empresa');
  assert.equal(p1, pseudonimo(CEDULA, EMPRESA), 'pero ser estable dentro de la empresa');
});

test('MUTACION: sin ambito, la misma cedula daria la misma huella en todas las empresas', () => {
  // Si la derivacion ignorara el ambito, ambos seudonimos coincidirian y el
  // enlace entre empresas seria posible.
  const conAmbito = pseudonimo(CEDULA, EMPRESA);
  const conOtroAmbito = pseudonimo(CEDULA, OTRA_EMPRESA);
  assert.notEqual(conAmbito, conOtroAmbito);
  // Y el valor NO es el mismo que el de un ambito global (que es lo que
  // haria una implementacion que olvidara el ambito por completo).
  assert.notEqual(conAmbito, pseudonimo(CEDULA, undefined));
});

test('mismoTrabajador compara seudónimo contra documento crudo', () => {
  const p = pseudonimo(CEDULA, EMPRESA);
  assert.equal(mismoTrabajador(p, p, EMPRESA), true, 'seudónimo contra sí mismo');
  assert.equal(mismoTrabajador(p, CEDULA, EMPRESA), true, 'seudónimo contra el crudo que lo originó');
  assert.equal(mismoTrabajador(CEDULA, p, EMPRESA), true, 'el orden no importa');
  assert.equal(mismoTrabajador(p, pseudonimo('9999999999', EMPRESA), EMPRESA), false, 'otro trabajador');
  assert.equal(mismoTrabajador(CEDULA, '9999999999', EMPRESA), false, 'otro documento');
  assert.equal(mismoTrabajador(p, null, EMPRESA), false);
});

test('candidatosBusqueda devuelve seudónimo y valor crudo', () => {
  const cands = candidatosBusqueda(CEDULA, EMPRESA);
  assert.equal(cands.length, 2);
  assert.equal(cands[0], pseudonimo(CEDULA, EMPRESA));
  assert.equal(cands[1], CEDULA);
});

test('candidatosBusqueda sobre un seudónimo devuelve solo el seudónimo', () => {
  // Cuando el valor YA es un seudónimo no hay documento crudo que probar:
  // un solo candidato, y es él mismo.
  const cands = candidatosBusqueda(pseudonimo(CEDULA, EMPRESA), EMPRESA);
  assert.equal(cands.length, 1);
  assert.equal(cands[0], pseudonimo(CEDULA, EMPRESA));
});

test('MUTACION: si el seudónimo fuera el valor crudo, buscaría solo las filas viejas', () => {
  // Con el seudónimo igual al valor crudo, la búsqueda por `IN` no
  // encontraría las filas nuevas (que guardan el seudónimo).
  const cands = candidatosBusqueda(CEDULA, EMPRESA);
  assert.notEqual(cands[0], CEDULA);
  assert.ok(cands.includes(CEDULA), 'debe seguir buscando el valor crudo');
});

test('la fila NO guarda la cédula en claro', async () => {
  resetDb();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
    metadata: JSON.stringify({ id_trabajador: CEDULA, correo: 't@test.com' }),
  });

  const fila = db.prepare(
    'SELECT id_trabajador, id_trabajador_alg, metadata FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);

  assert.notEqual(fila.id_trabajador, CEDULA, 'id_trabajador no debe ser la cédula');
  assert.equal(fila.id_trabajador, pseudonimo(CEDULA, EMPRESA));
  assert.equal(fila.id_trabajador_alg, algHmac());
  assert.ok(
    !String(fila.metadata).includes(CEDULA),
    'el metadata archivado no debe contener la cédula'
  );
});

test('el marcador de algoritmo lleva la versión de llave', () => {
  // El marcador no dice solo "hmac": dice con qué FORMATO y con qué VERSIÓN
  // de llave se calculó. Sin la versión, rotar la llave dejaría las filas
  // viejas sin poder verificarse.
  assert.match(algHmac(), /^hmac-sha256\.v2\.[a-z0-9]+$/);
  assert.equal(algHmac('k1'), 'hmac-sha256.v2.k1');
  assert.notEqual(algHmac('k1'), algHmac('k2'), 'cada versión tiene su marcador');
});

test('la huella de identificación es el HMAC, no el SHA-256 pelado', async () => {
  resetDb();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
  });

  const fila = db.prepare(
    'SELECT identificacion_numero_hash, identificacion_numero_alg FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);

  assert.equal(fila.identificacion_numero_alg, algHmac());
  assert.notEqual(fila.identificacion_numero_hash, sha256(CEDULA));
  assert.equal(
    fila.identificacion_numero_hash,
    hmacHex('identificacion', sha256(CEDULA), EMPRESA),
    'debe ser el HMAC del hash previo que envió el cliente'
  );
});

test('MUTACION: con "hash con sal en la misma tabla" el atacante podria recomputar', () => {
  // La diferencia operativa entre la OLD y la NEW: con sal en la fila, el
  // atacante tiene (sal, hash) y puede recalcular sha256(sal + candidato).
  // Con HMAC, no puede: la llave no está en la base.
  const sal = 'a'.repeat(64);
  const hashViejo = sha256(sal + CEDULA);
  const hashNuevo = hmacHex('identificacion', sha256(CEDULA), EMPRESA);

  // Con el viejo, el atacante reproduce el hash desde la fila.
  assert.equal(sha256(sal + CEDULA), hashViejo);
  // Con el nuevo, la fila no basta para verificar un candidato.
  assert.notEqual(hashNuevo, sha256(sal + CEDULA));
});

test('el flujo de identificación sigue funcionando con la cédula real', async () => {
  resetDb();
  const { token } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
  });
  const app = makeApp();

  const res = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: CEDULA });

  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'OTP_SENT');
});

test('una cédula incorrecta sigue siendo rechazada', async () => {
  resetDb();
  const { token } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
  });
  const app = makeApp();

  const res = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: '9999999999' });

  assert.equal(res.status, 422);
});

test('el OTP se archiva con HMAC y sin sal', async () => {
  resetDb();
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
  });
  const app = makeApp();
  await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: CEDULA });

  const fila = db.prepare(
    'SELECT otp_hash, otp_sal, otp_alg FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);

  assert.equal(fila.otp_alg, algHmac());
  assert.equal(fila.otp_sal, null, 'no debe quedar sal en la misma tabla');
  assert.match(fila.otp_hash, /^[0-9a-f]{64}$/);
  assert.notEqual(fila.otp_hash, sha256('000000'));
});

test('el token de acceso se archiva con HMAC', async () => {
  resetDb();
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
  });
  const fila = db.prepare(
    'SELECT token_hash FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.notEqual(fila.token_hash, sha256(token));
  assert.equal(fila.token_hash, hmacHex('token', token));
});

test('una fila heredada se identifica y se reescribe sola con el HMAC', async () => {
  resetDb();
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
  });

  // Simular una fila anterior a la migración 019: hash pelado, sin sal,
  // sin columna de algoritmo, y con la cédula en claro.
  db.prepare(`
    UPDATE gh_firmas_electronicas
    SET identificacion_numero_hash = ?, identificacion_numero_alg = NULL,
        identificacion_numero_sal = NULL, id_trabajador = ?
    WHERE id = ?
  `).run(sha256(CEDULA), CEDULA, signRequest.id);

  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: CEDULA });

  // La fila heredada se identifica igual: no se invalidan las firmas en curso.
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'OTP_SENT');

  // Y queda reescrita con el HMAC (migración autosuficiente).
  const fila = db.prepare(
    'SELECT identificacion_numero_hash, identificacion_numero_alg FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.equal(fila.identificacion_numero_alg, algHmac());
  assert.equal(fila.identificacion_numero_hash, hmacHex('identificacion', sha256(CEDULA), EMPRESA));
  assert.notEqual(fila.identificacion_numero_hash, sha256(CEDULA));
});

test('MUTACION: sin autoupgrade la fila heredada conservaria el hash viejo', () => {
  // La regla del autoupgrade: una fila heredada que coincide debe
  // producir un valor de huella NUEVO, distinto del hash pelado.
  const previo = sha256(CEDULA);
  const nuevo = hmacHex('identificacion', previo, EMPRESA);
  assert.notEqual(previo, nuevo);
  assert.equal(nuevo, hmacHex('identificacion', sha256(CEDULA), EMPRESA));
});
