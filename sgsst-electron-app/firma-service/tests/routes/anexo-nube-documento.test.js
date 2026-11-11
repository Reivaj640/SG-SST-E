/**
 * EL TEXTO DEL ANEXO DE NUBE, SERVIDO POR EL SERVICIO
 * ============================================================================
 *
 * Lo que la Empresa firma tiene que ser EXACTAMENTE el archivo cuya huella
 * queda registrada. Este test comprueba esa garantía:
 *
 * - La ruta `/anexo-nube/documento` sirve el archivo del servidor.
 * - La huella del cuerpo servido es la MISMA que la del archivo.
 * - La cabecera dice la versión y la huella.
 * - La ruta no se confunde con un enlace de suscripción (el caso "documento"
 *   como si fuera un token).
 *
 * Antes de este trabajo, `urlDocumento()` apuntaba a un archivo con la versión
 * en el nombre, una dirección que NO servía nadie: el correo de invitación mandaba a la
 * Empresa a un 404 y el texto que se iba a firmar era invisible.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const request = require('supertest');
const { makeApp } = require('../helpers');
const anexoNube = require('../../src/services/anexoNube');

test('GET /anexo-nube/documento sirve el texto cuya huella se registra', async () => {
  const app = makeApp();
  const res = await request(app).get('/anexo-nube/documento');

  assert.equal(res.status, 200);

  const bytes = fs.readFileSync(anexoNube.RUTA_MODELO);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');

  // La cabecera lo dice.
  assert.equal(res.headers['x-anexo-nube-version'], anexoNube.VERSION_MODELO);
  assert.equal(res.headers['x-anexo-nube-hash'], hash);

  // Y el cuerpo lo cumple: lo que se lee es lo que se firma.
  const hashServido = crypto.createHash('sha256')
    .update(Buffer.from(res.text, 'utf8')).digest('hex');
  assert.equal(hashServido, hash,
    'el texto servido tiene que ser byte a byte el que se firma');

  assert.ok(/text\/html/.test(res.headers['content-type']));
  assert.ok(res.text.includes('Anexo de Nube'));
});

test('la dirección del documento apunta al servicio, no a una página que no existe', () => {
  const url = anexoNube.urlDocumento();
  assert.match(url, /\/anexo-nube\/documento$/,
    'la dirección del texto tiene que ser la ruta que el servicio sirve');
  assert.ok(!/anexo-nube-v\d/.test(url),
    'no puede apuntar a un archivo estático que el servicio no expone');
});

test('la ruta del documento no se confunde con un enlace de suscripción', async () => {
  const app = makeApp();
  const res = await request(app).get('/anexo-nube/documento');
  // Si "documento" se tomara por un token, la respuesta sería 404
  // ENLACE_NO_VALIDO (no el texto).
  assert.notEqual(res.status, 404);
  assert.ok(!/ENLACE_NO_VALIDO/.test(res.text || ''));
});
