/**
 * Tests del servicio de Acuerdo (createVersion ampliado) — Bloque B.
 *
 * Complementa los tests de routes/admin.test.js y routes/agreement.test.js
 * con pruebas del service directamente (sin HTTP).
 *
 * Cubre:
 * - createVersion con texto grande (cerca del límite)
 * - createVersion con metadata JSON complejo
 * - createVersion con fecha_vigencia_fin futura
 * - createVersion con formato inválido de version
 * - createVersion con version duplicada
 * - createVersion con metadata tipo array (rechazado)
 * - createVersion con creado_por/kair_version demasiado largos
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDb } = require('../helpers');
const agreementService = require('../../src/services/agreement');
const db = require('../../src/db/connection');

const TEXTO_BASE = 'ACUERDO BASE';

test('createVersion: con texto grande (cerca del límite 50000) → OK', () => {
  resetDb();
  // TEXTO_BASE = 'ACUERDO BASE' = 12 chars; completar hasta 50000
  const textoGrande = TEXTO_BASE + 'x'.repeat(50000 - TEXTO_BASE.length);
  assert.equal(textoGrande.length, 50000);
  const result = agreementService.createVersion({
    version: 'v1.0', texto: textoGrande,
  });
  assert.equal(result.version, 'v1.0');
  assert.equal(result.texto.length, 50000);
});

test('createVersion: con metadata JSON complejo → persiste correctamente', () => {
  resetDb();
  const metadata = {
    approver: 'juridico',
    legal_review_id: 'LR-2026-001',
    references: ['doc-1', 'doc-2'],
    nested: { field: 'value' },
  };
  const result = agreementService.createVersion({
    version: 'v1.0',
    texto: TEXTO_BASE,
    metadata,
  });
  assert.equal(result.version, 'v1.0');

  // Verificar que se persistió como JSON
  const row = db.prepare('SELECT metadata FROM gh_firma_acuerdo_versiones WHERE version = ?').get('v1.0');
  assert.equal(typeof row.metadata, 'string');
  const metaParsed = JSON.parse(row.metadata);
  assert.equal(metaParsed.approver, 'juridico');
  assert.deepEqual(metaParsed.references, ['doc-1', 'doc-2']);
  assert.equal(metaParsed.nested.field, 'value');
});

test('createVersion: con fecha_vigencia_fin futura → OK', () => {
  resetDb();
  const futuro = new Date(Date.now() + 365 * 86400000).toISOString(); // 1 año
  const result = agreementService.createVersion({
    version: 'v1.0',
    texto: TEXTO_BASE,
    fecha_vigencia_fin: futuro,
  });
  assert.equal(result.version, 'v1.0');
  assert.ok(result.fecha_vigencia_fin);
  // Comparar con tolerancia de 1 segundo
  assert.ok(Math.abs(new Date(result.fecha_vigencia_fin).getTime() - new Date(futuro).getTime()) < 1000);
});

test('createVersion: con fecha_vigencia_fin null → OK (válida indefinidamente)', () => {
  resetDb();
  const result = agreementService.createVersion({
    version: 'v1.0',
    texto: TEXTO_BASE,
    fecha_vigencia_fin: null,
  });
  assert.equal(result.version, 'v1.0');
  assert.equal(result.fecha_vigencia_fin, null);
});

test('createVersion: con version formato inválido "1.0" → throw AppError 400', () => {
  resetDb();
  assert.throws(
    () => agreementService.createVersion({ version: '1.0', texto: TEXTO_BASE }),
    (err) => err.statusCode === 400 && err.code === 'INVALID_REQUEST_BODY',
  );
});

test('createVersion: con version formato inválido "v1" → throw 400', () => {
  resetDb();
  assert.throws(
    () => agreementService.createVersion({ version: 'v1', texto: TEXTO_BASE }),
    (err) => err.statusCode === 400 && err.code === 'INVALID_REQUEST_BODY',
  );
});

test('createVersion: con version formato inválido "VERSION_1.0" → throw 400', () => {
  resetDb();
  assert.throws(
    () => agreementService.createVersion({ version: 'VERSION_1.0', texto: TEXTO_BASE }),
    (err) => err.statusCode === 400 && err.code === 'INVALID_REQUEST_BODY',
  );
});

test('createVersion: con version duplicada → throw 409 ACUERDO_VERSION_EXISTS', () => {
  resetDb();
  agreementService.createVersion({ version: 'v1.0', texto: TEXTO_BASE });
  assert.throws(
    () => agreementService.createVersion({ version: 'v1.0', texto: 'otro' }),
    (err) => err.statusCode === 409 && err.code === 'ACUERDO_VERSION_EXISTS',
  );
});

test('createVersion: con metadata tipo array → throw 400', () => {
  resetDb();
  assert.throws(
    () => agreementService.createVersion({
      version: 'v1.0', texto: TEXTO_BASE, metadata: ['array', 'not', 'object'],
    }),
    (err) => err.statusCode === 400 && err.code === 'INVALID_REQUEST_BODY',
  );
});

test('createVersion: con creado_por demasiado largo (>128) → throw 400', () => {
  resetDb();
  assert.throws(
    () => agreementService.createVersion({
      version: 'v1.0', texto: TEXTO_BASE,
      creado_por: 'x'.repeat(129),
    }),
    (err) => err.statusCode === 400 && err.code === 'INVALID_REQUEST_BODY',
  );
});

test('createVersion: con kair_version demasiado largo (>32) → throw 400', () => {
  resetDb();
  assert.throws(
    () => agreementService.createVersion({
      version: 'v1.0', texto: TEXTO_BASE,
      kair_version: 'x'.repeat(33),
    }),
    (err) => err.statusCode === 400 && err.code === 'INVALID_REQUEST_BODY',
  );
});

test('createVersion: con texto > 50000 → throw 400', () => {
  resetDb();
  const textoLargo = 'x'.repeat(50001);
  assert.throws(
    () => agreementService.createVersion({ version: 'v1.0', texto: textoLargo }),
    (err) => err.statusCode === 400 && err.code === 'INVALID_REQUEST_BODY',
  );
});

test('createVersion: desactivar lista de anteriores solo si activa=true', () => {
  resetDb();
  // v1.0 activa
  const r1 = agreementService.createVersion({ version: 'v1.0', texto: TEXTO_BASE });
  assert.deepEqual(r1.desactivadas, []);

  // v2.0 activa
  const r2 = agreementService.createVersion({ version: 'v2.0', texto: TEXTO_BASE, activa: true });
  assert.deepEqual(r2.desactivadas, ['v1.0']);

  // v2.1 inactiva
  const r3 = agreementService.createVersion({ version: 'v2.1', texto: TEXTO_BASE, activa: false });
  assert.deepEqual(r3.desactivadas, []);

  // v3.0 activa
  const r4 = agreementService.createVersion({ version: 'v3.0', texto: TEXTO_BASE, activa: true });
  assert.deepEqual(r4.desactivadas, ['v2.0']);
});
