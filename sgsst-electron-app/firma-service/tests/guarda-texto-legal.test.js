/**
 * Guarda de placeholders en el texto legal (Etapa 2).
 *
 * Regla:
 *   - La v1.0 queda fuera: ya está publicada y sellada.
 *   - Cualquier versión posterior (v1.1+) no se puede crear ni publicar con
 *     corchetes ni con marcas de borrador.
 *   - Los campos que registra el sistema (`[registrada por el sistema]`) NO son
 *     huecos: la v1.0 ya está publicada con cuatro de esos.
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

test('guarda · la v1.1 con campos del sistema se crea (no son huecos)', () => {
  const texto = 'ACUERDO DE USO v1.1\n'
    + 'Fecha y hora de aceptación: [registrada por el sistema]\n'
    + 'Versión del Acuerdo aceptada: [registrada por el sistema]\n'
    + 'Huella digital del texto: [registrada por el sistema]\n'
    + 'Firma del Trabajador: [registrada por el sistema]';
  const creada = agreementService.createVersion({
    version: 'v1.1',
    texto,
    creado_por: 'test',
    activa: false,
  });
  assert.equal(creada.version, 'v1.1');
});

test('guarda · la v1.1 con una variante de "registrada por el sistema" se rechaza', () => {
  assert.throws(
    () => agreementService.createVersion({
      version: 'v1.1',
      texto: 'ACUERDO DE USO v1.1\nFecha y hora: [registrada por la empresa]',
      creado_por: 'test',
      activa: false,
    }),
    (err) => {
      assert.equal(err.code, 'TEXTO_LEGAL_CON_PLACEHOLDERS');
      assert.equal(err.details.placeholders, 1, 'la variante sigue siendo un hueco');
      assert.equal(err.details.campos_del_sistema, 0);
      return true;
    },
  );
});

test('guarda · el error dice cuántos huecos bloquean y cuántos campos del sistema hay', () => {
  assert.throws(
    () => agreementService.createVersion({
      version: 'v1.1',
      texto: 'ACUERDO DE USO v1.1\n[URL]\nFirma: [registrada por el sistema]',
      creado_por: 'test',
      activa: false,
    }),
    (err) => {
      assert.equal(err.details.placeholders, 1, 'solo cuenta el hueco');
      assert.deepEqual(err.details.placeholders_unicos, ['[URL]']);
      assert.equal(err.details.campos_del_sistema, 1, 'el campo del sistema se informa aparte');
      return true;
    },
  );
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
