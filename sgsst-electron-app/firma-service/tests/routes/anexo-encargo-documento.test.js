/**
 * EL TEXTO DEL ANEXO DE ENCARGO, SERVIDO POR EL SERVICIO
 * ============================================================================
 *
 * Lo que la Empresa suscribe tiene que ser EXACTAMENTE el archivo cuya huella
 * queda registrada. Este test comprueba esa garantía:
 *
 * - La ruta `/anexo-encargo/documento` sirve el archivo del servidor.
 * - La huella del cuerpo servido es la MISMA que la del archivo.
 * - La cabecera dice la versión y la huella.
 * - La ruta no se confunde con un enlace de suscripción (el caso "documento"
 *   como si fuera un token).
 * - La versión NO es una constante del código: sale del manifiesto legal, que
 *   es lo único que puede declarar cuál es el texto vigente.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const request = require('supertest');
const { makeApp } = require('../helpers');
const anexoEncargo = require('../../src/services/anexoEncargo');
const manifiestoLegal = require('../../src/services/manifiestoLegal');

test('GET /anexo-encargo/documento sirve el texto cuya huella se registra', async () => {
  const app = makeApp();
  const res = await request(app).get('/anexo-encargo/documento');

  assert.equal(res.status, 200);

  const bytes = fs.readFileSync(anexoEncargo.RUTA_MODELO);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');

  // La cabecera lo dice.
  assert.equal(res.headers['x-anexo-encargo-hash'], hash);

  // Y el cuerpo lo cumple: lo que se lee es lo que se suscribe.
  const hashServido = crypto.createHash('sha256')
    .update(Buffer.from(res.text, 'utf8')).digest('hex');
  assert.equal(hashServido, hash,
    'el texto servido tiene que ser byte a byte el que se suscribe');

  assert.ok(/text\/html/.test(res.headers['content-type']));
  assert.ok(res.text.includes('Anexo de Encargo'));
});

test('la versión que se sirve es la que declara el manifiesto legal', async () => {
  const man = manifiestoLegal.manifiesto();
  assert.equal(man.existe, true, 'el manifiesto legal tiene que estar en el repo');

  const app = makeApp();
  const res = await request(app).get('/anexo-encargo/documento');

  assert.equal(res.status, 200);
  assert.equal(res.headers['x-anexo-encargo-version'], man.datos.anexo_encargo.version,
    'la versión que se sirve tiene que ser la que declara el manifiesto');
  assert.equal(res.headers['x-anexo-encargo-hash'], man.datos.anexo_encargo.hash,
    'la huella que se sirve tiene que ser la que declara el manifiesto');
});

test('la versión NO es una constante del código: sale del manifiesto', () => {
  const man = manifiestoLegal.manifiesto();
  const version = man.datos.anexo_encargo.version;

  // El Anexo de Encargo se versiona por fecha y la etiqueta la pone un
  // generador. Si el código tuviera la fecha escrita dentro, podría
  // desincronizarse del manifiesto sin que nadie lo notara: el servicio
  // compararía el archivo con una huella que ya no es la que se declara.
  const fuente = fs.readFileSync(
    require.resolve('../../src/services/anexoEncargo'), 'utf8');

  assert.ok(!fuente.includes(`'${version}'`),
    'el servicio no puede tener la versión del Anexo de Encargo escrita a mano');
  assert.ok(!fuente.includes(`"${version}"`),
    'el servicio no puede tener la versión del Anexo de Encargo escrita a mano');
});

test('la dirección del documento apunta al servicio, no a una página que no existe', () => {
  const url = anexoEncargo.urlDocumento();
  assert.match(url, /\/anexo-encargo\/documento$/,
    'la dirección del texto tiene que ser la ruta que el servicio sirve');
  assert.ok(!/anexo-encargo-v\d/.test(url),
    'no puede apuntar a un archivo estático que el servicio no expone');
});

test('la ruta del documento no se confunde con un enlace de suscripción', async () => {
  const app = makeApp();
  const res = await request(app).get('/anexo-encargo/documento');
  // Si "documento" se tomara por un token, la respuesta sería 404
  // ENLACE_NO_VALIDO (no el texto).
  assert.notEqual(res.status, 404);
  assert.ok(!/ENLACE_NO_VALIDO/.test(res.text || ''));
});
