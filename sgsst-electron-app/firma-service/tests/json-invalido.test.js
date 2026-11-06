/**
 * tests/json-invalido.test.js
 *
 * Un cuerpo que no es JSON válido es un error del CLIENTE (400), no del
 * servidor (500).
 *
 * Antes, body-parser lanzaba `entity.parse.failed` y el errorHandler no lo
 * reconocía: lo registraba como "Error no controlado" y respondía
 * `500 INTERNAL_ERROR`. K+AIR recibía "se rompió el servicio" cuando el
 * problema era el cuerpo que había mandado, y el motivo real se perdía.
 *
 * Usa `createApp()` REAL (no el `makeApp()` de tests/helpers.js) porque el
 * fallo vivía en la pila completa: el `express.json()` de src/server.js más
 * el errorHandler de src/middleware/errors.js. Un test con un express()
 * armado a mano no prueba el wiring que corre en producción.
 *
 * Regla §7.4: un rojo aquí es un rojo NUEVO. Si falla, se corrige el código,
 * no el test.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/server');

const app = createApp();

/**
 * Manda un cuerpo CRUDO con Content-Type JSON.
 *
 * `.send()` de supertest serializa los objetos y encima pone las comillas que
 * hagan falta; para probar JSON inválido hay que mandar el texto tal cual.
 */
function postCrudo(path, cuerpo) {
  return request(app)
    .post(path)
    .set('Content-Type', 'application/json')
    .send(cuerpo);
}

// =============================================================================
// 1. JSON malformado → 400 INVALID_JSON
// =============================================================================

test('un JSON malformado responde 400 INVALID_JSON, no 500 INTERNAL_ERROR', async () => {
  const r = await postCrudo('/internal/consentimientos', '{"id_trabajador":');

  assert.equal(r.status, 400, 'un cuerpo malformado es culpa del cliente, no del servidor');
  assert.equal(r.body.error.code, 'INVALID_JSON');
  assert.notEqual(r.body.error.code, 'INTERNAL_ERROR');
  assert.ok(r.body.error.request_id, 'el sobre conserva el request_id');
});

test('el mensaje de INVALID_JSON no filtra el detalle interno del parser', async () => {
  const r = await postCrudo('/internal/consentimientos', '{"a":');

  assert.match(r.body.error.message, /JSON/i);
  assert.doesNotMatch(r.body.error.message, /Unexpected token|position \d+|at JSON\.parse/i);
});

// =============================================================================
// 2. JSON válido pero que no es un objeto → 400 INVALID_JSON
// =============================================================================
//
// `express.json()` corre con `strict: true`: solo acepta objetos y arreglos.
// `null`, `0` y `"hola"` son JSON válido, pero no son un cuerpo de petición
// posible. Tienen que dar 400 con el MISMO código, no un 500.

for (const [nombre, cuerpo] of [
  ['null', 'null'],
  ['un numero', '0'],
  ['un string', '"hola"'],
]) {
  test(`un cuerpo JSON ${nombre} responde 400 INVALID_JSON`, async () => {
    const r = await postCrudo('/internal/consentimientos', cuerpo);

    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'INVALID_JSON');
  });
}

// =============================================================================
// 3. Los dos caminos que NO se pueden romper con el arreglo
// =============================================================================

test('un JSON válido a una ruta inexistente sigue dando 404 NOT_FOUND', async () => {
  const r = await request(app)
    .post('/ruta-que-no-existe')
    .send({ ok: true });

  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, 'NOT_FOUND');
});

test('un objeto vacio en /codigo no da 500: el token inexistente da 404', async () => {
  // `codigoBody` es un objeto vacío estricto: `{}` es un cuerpo VÁLIDO y el
  // rechazo tiene que venir del token, no del parser.
  const r = await postCrudo('/api/anexo-nube/token-que-no-existe/codigo', '{}');

  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, 'ENLACE_NO_VALIDO');
  assert.notEqual(r.body.error.code, 'INTERNAL_ERROR');
});
