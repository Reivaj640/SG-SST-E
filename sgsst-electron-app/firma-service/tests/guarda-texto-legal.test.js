/**
 * Guarda de placeholders en el texto legal (Etapa 2).
 *
 * Regla:
 *   - La v1.0 queda fuera: ya está publicada y sellada.
 *   - Cualquier versión posterior (v1.1+) no se puede crear ni publicar con
 *     corchetes ni con marcas de borrador.
 *
 * Se prueba en los dos puntos de entrada: el servicio (`createVersion`) y el
 * script de publicación (`verificarTextoLegal`). El endpoint admin pasa por el
 * servicio, así que también se cubre con una petición real.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const agreementService = require('../src/services/agreement');
const { resetDb, makeApp, TEST_ADMIN_API_KEY } = require('./helpers');
const { verificarTextoLegal } = require('../scripts/publicar-acuerdo-legal');

const ADMIN = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };

const TEXTO_LIMPIO = 'ACUERDO DE USO v1.1\nTexto completo, sin corchetes.';

test.beforeEach(() => {
  resetDb();
});

test('guarda · la v1.0 se puede crear con corchetes (está sellada)', () => {
  const creada = agreementService.createVersion({
    version: 'v1.0',
    texto: 'ACUERDO DE USO v1.0\n[texto histórico]',
    creado_por: 'test',
    activa: false,
  });
  assert.equal(creada.version, 'v1.0');
});

test('guarda · la v1.1 con un placeholder se rechaza', () => {
  assert.throws(
    () => agreementService.createVersion({
      version: 'v1.1',
      texto: 'ACUERDO DE USO v1.1\n[URL de la política]',
      creado_por: 'test',
      activa: false,
    }),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, 'TEXTO_LEGAL_CON_PLACEHOLDERS');
      assert.equal(err.details.placeholders, 1);
      assert.deepEqual(err.details.placeholders_unicos, ['[URL de la política]']);
      return true;
    },
  );
  // No se creó nada.
  assert.ok(!agreementService.getByVersion('v1.1'));
});

test('guarda · la v1.1 con una marca de borrador se rechaza', () => {
  assert.throws(
    () => agreementService.createVersion({
      version: 'v1.1',
      texto: TEXTO_LIMPIO + '\nACUERDO DEV',
      creado_por: 'test',
      activa: false,
    }),
    (err) => {
      assert.equal(err.code, 'TEXTO_LEGAL_CON_PLACEHOLDERS');
      assert.ok(err.details.marcadores.some((m) => /desarrollo/i.test(m)));
      return true;
    },
  );
});

test('guarda · la v1.1 limpia se crea', () => {
  const creada = agreementService.createVersion({
    version: 'v1.1',
    texto: TEXTO_LIMPIO,
    creado_por: 'test',
    activa: false,
  });
  assert.equal(creada.version, 'v1.1');
});

test('guarda · el script de publicación deja pasar la v1.0 con corchetes', () => {
  const r = verificarTextoLegal('v1.0', 'texto con [corchete]');
  assert.equal(r.ok, true);
});

test('guarda · el script de publicación rechaza la v1.1 con corchetes', () => {
  const r = verificarTextoLegal('v1.1', 'texto con [corchete] y [otro]');
  assert.equal(r.ok, false);
  assert.equal(r.placeholders.total, 2);
});

test('guarda · el script de publicación rechaza una marca de borrador', () => {
  const r = verificarTextoLegal('v2.0', 'texto con Revisión profesional pendiente');
  assert.equal(r.ok, false);
  assert.ok(r.marcadores.some((m) => m.codigo === 'REVISION_PENDIENTE'));
});

test('guarda · el endpoint admin devuelve 400 con el código tipado', async () => {
  const app = makeApp();
  const res = await request(app)
    .post('/internal/admin/acuerdo-versiones')
    .set(ADMIN)
    .send({
      version: 'v1.1',
      texto: 'ACUERDO DE USO v1.1\n[URL]',
      activa: false,
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'TEXTO_LEGAL_CON_PLACEHOLDERS');
  assert.equal(res.body.error.details.placeholders, 1);
});
