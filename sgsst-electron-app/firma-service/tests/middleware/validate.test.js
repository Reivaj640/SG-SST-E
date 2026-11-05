/**
 * Tests del middleware `validateBody`.
 * ============================================================================
 *
 * POR QUE EXISTE ESTE ARCHIVO
 * ---------------------------
 * El 5-nov-2026, en produccion, un POST con una clave que NO esta en el
 * esquema devolvio **500 "Error interno del servidor"** en vez de 400. Se
 * midio contra el servidor:
 *
 *   POST .../suscribir  con {}       -> 400 limpio (faltaban `otp` y `acepta`)
 *   POST .../suscribir  con {"x":1}  -> 500 "Error interno del servidor"
 *
 * Con el MISMO codigo, en local, los dos dan 400. La diferencia no es el
 * codigo: es la version de zod que hay instalada en el servidor, porque el
 * deploy **no reinstala `node_modules`** ("el package.json no cambio"). Con la
 * version del servidor, el problema de "clave no reconocida" llega sin `path`,
 * y el mapeo del middleware reventaba:
 *
 *     result.error.issues.map(i => ({ path: i.path.join('.'), ... }))
 *                                                  ^^^^^^^^^^ TypeError
 *
 * El TypeError se comia el 400: el que mandaba el pedido recibia "Error
 * interno del servidor" y no tenia forma de saber cual era el dato malo.
 *
 * LO QUE SE ATA ACA
 * -----------------
 * El middleware tiene que responder 400 CON LA LISTA DE PROBLEMAS, diga lo
 * que diga la forma del problema que reporte la libreria. La forma se simula
 * con un esquema de mentira: asi la prueba no depende de la version de zod
 * instalada, que es justamente lo que se rompio.
 *
 * Se ejecuta manualmente con:
 *   node --test --require ./tests/setup.js --test-concurrency=1 \
 *     tests/middleware/validate.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { validateBody } = require('../../src/middleware/validate');
const { makeApp } = require('../helpers');

// =====================================================================
// HELPERS
// =====================================================================

/**
 * Corre el middleware con un `req` de mentira y devuelve lo que se le paso
 * a `next()`.
 *
 * @param {object} schema - un schema con `safeParse` (puede ser de mentira).
 * @param {*} body - el cuerpo de la peticion.
 * @returns {{req: object, err: Error|null, siguiente: boolean}}
 */
function correr(schema, body) {
  const req = { body };
  let err = null;
  let siguiente = false;

  validateBody(schema)(req, {}, (e) => {
    err = e || null;
    siguiente = true;
  });

  return { req, err, siguiente };
}

/**
 * Un schema de mentira que falla con la lista de problemas que le pases.
 *
 * @param {Array<object>} issues
 * @returns {object}
 */
function schemaQueFalla(issues) {
  return {
    safeParse() {
      return { success: false, error: { issues } };
    },
  };
}

/** Un schema de mentira que pasa y devuelve el dato ya parseado. */
function schemaQuePasa(dato) {
  return {
    safeParse() {
      return { success: true, data: dato };
    },
  };
}

// =====================================================================
// EL CAMINO NORMAL
// =====================================================================

test('un cuerpo valido pasa y reemplaza req.body por el dato validado', () => {
  const { req, err, siguiente } = correr(schemaQuePasa({ otp: '123456' }), { otp: ' 123456 ' });

  assert.equal(siguiente, true, 'el middleware tiene que seguir');
  assert.equal(err, null, 'un cuerpo valido no es un error');
  assert.deepEqual(req.body, { otp: '123456' },
    'req.body queda con el dato ya parseado (el trim del schema se aplica)');
});

test('sin schema, el middleware deja pasar la peticion', () => {
  const { err, siguiente } = correr(null, { cualquier: 'cosa' });

  assert.equal(siguiente, true);
  assert.equal(err, null);
});

test('un cuerpo invalido responde 400 con la lista de problemas', () => {
  const { err, siguiente } = correr(
    schemaQueFalla([
      { path: ['otp'], message: 'Required', code: 'invalid_type' },
      { path: [], message: "Unrecognized key(s) in object: 'x'", code: 'unrecognized_keys' },
    ]),
    { x: 1 },
  );

  assert.equal(siguiente, true);
  assert.ok(err, 'tiene que pasarle el error a next()');
  assert.equal(err.statusCode, 400);
  assert.equal(err.code, 'INVALID_REQUEST_BODY');
  assert.equal(err.details.issues.length, 2);
  assert.equal(err.details.issues[0].path, 'otp', 'el path se arma con los puntos');
  assert.equal(err.details.issues[0].message, 'Required');
  assert.equal(err.details.issues[1].path, '', 'un path vacio es una cadena vacia, no undefined');
});

// =====================================================================
// LA FORMA DEL PROBLEMA NO PUEDE ROMPER EL MIDDLEWARE
// =====================================================================

test('un problema SIN path no rompe el middleware: responde 400 con el mensaje', () => {
  // Esta es la forma que llega desde el servidor: el problema de "clave no
  // reconocida" sin `path`. Con el codigo anterior, `i.path.join('.')` lanzaba
  // un TypeError y el 400 se convertia en 500.
  const { err, siguiente } = correr(
    schemaQueFalla([
      { code: 'unrecognized_keys', message: "Unrecognized key(s) in object: 'x'" },
    ]),
    { x: 1 },
  );

  assert.equal(siguiente, true, 'el middleware tiene que responder, no reventar');
  assert.ok(err, 'tiene que pasarle el error a next()');
  assert.equal(err.statusCode, 400, 'un cuerpo invalido es 400, no 500');
  assert.equal(err.code, 'INVALID_REQUEST_BODY');
  assert.equal(err.details.issues.length, 1);
  assert.equal(err.details.issues[0].path, '',
    'un problema sin path se reporta con el path vacio');
  assert.equal(err.details.issues[0].message, "Unrecognized key(s) in object: 'x'",
    'el mensaje del problema se conserva: es lo que le dice al que manda el pedido cual es el problema');
  assert.equal(err.details.issues[0].code, 'unrecognized_keys');
});

test('un path que no es una lista no rompe el middleware', () => {
  const { err } = correr(
    schemaQueFalla([
      { path: 'otp', message: 'Required', code: 'invalid_type' },
    ]),
    {},
  );

  assert.ok(err);
  assert.equal(err.statusCode, 400);
  assert.equal(err.details.issues[0].path, 'otp',
    'un path que ya es texto se usa tal cual');
});

test('un error sin lista de problemas tampoco rompe el middleware', () => {
  const schema = {
    safeParse() {
      return { success: false, error: {} };
    },
  };

  const { err, siguiente } = correr(schema, { x: 1 });

  assert.equal(siguiente, true, 'el middleware tiene que responder, no reventar');
  assert.ok(err);
  assert.equal(err.statusCode, 400);
  assert.deepEqual(err.details.issues, [],
    'sin lista de problemas, la lista del detalle queda vacia');
});

test('un problema sin mensaje ni codigo tampoco rompe el middleware', () => {
  const { err } = correr(schemaQueFalla([{}]), { x: 1 });

  assert.ok(err);
  assert.equal(err.statusCode, 400);
  assert.equal(typeof err.details.issues[0].message, 'string',
    'el mensaje siempre es texto: el cliente lo muestra tal cual');
  assert.equal(typeof err.details.issues[0].code, 'string');
});

// =====================================================================
// EL SINTOMA COMPLETO, POR HTTP
// =====================================================================

test('por HTTP, un cuerpo con una clave de mas es 400 y no 500', async () => {
  const app = makeApp();

  const res = await request(app)
    .post('/api/anexo-nube/token-que-no-existe/codigo')
    .set('Content-Type', 'application/json')
    .send({ x: 1 });

  assert.equal(res.status, 400,
    `una clave de mas es un 400 con su codigo, no un 500: el 500 esconde el motivo (salio ${res.status})`);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
  assert.ok(Array.isArray(res.body.error.details.issues),
    'el 400 dice que problema es');
});

test('por HTTP, un cuerpo incompleto tambien es 400 con su codigo', async () => {
  const app = makeApp();

  const res = await request(app)
    .post('/api/anexo-nube/token-que-no-existe/suscribir')
    .set('Content-Type', 'application/json')
    .send({});

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});
