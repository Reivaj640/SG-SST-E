/**
 * Tests del fix I-FIRMA-DUAL: la constancia individual existe tanto para
 * SIGNED como para DUAL_FIRMADO, y debe ser accesible desde el consolidado
 * y desde GET /sign-requests/:id/constancia.pdf.
 *
 * Casos cubiertos:
 * - DUAL_FIRMADO expone id_constancia en el consolidado
 * - SIGNED sigue exponiendo id_constancia (no rompemos el caso legacy)
 * - DUAL_FIRMADO sirve el PDF por la ruta /constancia.pdf (no 409)
 * - Estados previos a SIGNED/DUAL_FIRMADO retornan 409
 * - Sin id_constancia persistido, fallback al id_solicitud
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const db = require('../../src/db/connection');
const { resetDb, seedActiveAgreement, makeApp, TEST_API_KEY } = require('../helpers');
const pdfGenConsolidado = require('../../src/services/pdfGenConsolidado');
const { hashToken } = require('../../src/crypto/token');

const HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };

// Mock del PDF generator del consolidado (captura el data, devuelve PDF vacío)
let lastConsolidadoData = null;
const realGenConsolidado = pdfGenConsolidado.generateConstanciaConsolidadaPdf;
pdfGenConsolidado.generateConstanciaConsolidadaPdf = async function (data) {
  lastConsolidadoData = data;
  return Buffer.from('%PDF-1.4\n%%EOF\n', 'latin1');
};

// Mock del PDF generator individual (necesario para la ruta /constancia.pdf)
// La ruta usa publicFlow.getConstanciaPdf() internamente, no pdfGen, así que
// este mock no afecta ese endpoint. Lo dejamos como no-op.

/**
 * Helper para insertar un SR con los campos mínimos que necesita el handler.
 * Reutiliza la estrategia del test anterior: lee PRAGMA table_info y solo
 * inserta las columnas que SÍ vamos a setear.
 */
function insertSignRequest(overrides) {
  const now = new Date().toISOString();
  const provided = {
    id_solicitud: 'SIGN-TEST-001',
    id_documento: 'do-001',
    id_trabajador: '1111111111',
    id_empresa: '900511178',
    estado: 'SIGNED',
    correo_verificacion: 't@e.com',
    version_kair: '0.1.189-test',
    requiere_firma_empresa: 0,
    tipo_firmante: 'TRABAJADOR',
    parent_id_solicitud: null,
    representante_legal_snapshot: null,
    identificacion_tipo: 'CC',
    identificacion_numero_hash: 'h',
    fecha_creacion: now,
    fecha_expiracion: now,
    fecha_manifestacion: now,
    fecha_firma: now,
    ...overrides,
  };
  // Placeholders para NOT NULL sin default que no importan
  const placeholders = {
    tipo_firma: 'CC',
    agreement_version: 'v1.0',
    agreement_hash: 'h',
    document_hash_original: 'h',
    pdf_original_path: '/tmp/o.pdf',
    token_hash: hashToken('token-' + provided.id_solicitud),
    sesion_id: 's-' + provided.id_solicitud,
    consent_id: 'c-' + provided.id_solicitud,
  };
  const setValues = { ...placeholders, ...provided };
  const cols = db.prepare('PRAGMA table_info(gh_firmas_electronicas)').all();
  const allCols = cols.map(c => c.name).filter(n => n !== 'id');
  const colsToSet = allCols.filter(name => name in setValues);
  const cols_sql = colsToSet.join(', ');
  const ph_sql = colsToSet.map(() => '?').join(', ');
  const values = colsToSet.map(name => setValues[name]);
  db.prepare(`INSERT INTO gh_firmas_electronicas (${cols_sql}) VALUES (${ph_sql})`).run(...values);
}

test.beforeEach(() => {
  resetDb();
  seedActiveAgreement();
  lastConsolidadoData = null;
});

test.after(() => {
  pdfGenConsolidado.generateConstanciaConsolidadaPdf = realGenConsolidado;
});

// =============================================================================
// Consolidated endpoint: id_constancia expuesto
// =============================================================================

test('DUAL_FIRMADO expone id_constancia persistido en el consolidado', async () => {
  insertSignRequest({
    id_solicitud: 'SIGN-2026-DUAL-ID-1',
    estado: 'DUAL_FIRMADO',
    id_constancia: 'b202bb1f-c527-4168-9855-9588cf7dac75',
  });

  const res = await request(makeApp())
    .get('/internal/expedientes/1111111111/constancia-consolidada.pdf')
    .set(HEADERS);

  assert.equal(res.status, 200);
  assert.equal(lastConsolidadoData.documentos.length, 1);
  assert.equal(
    lastConsolidadoData.documentos[0].id_constancia,
    'b202bb1f-c527-4168-9855-9588cf7dac75',
    'DUAL_FIRMADO debe exponer el id_constancia persistido (no null)'
  );
});

test('SIGNED sigue exponiendo id_constancia (caso legacy no roto)', async () => {
  insertSignRequest({
    id_solicitud: 'SIGN-2026-LEGACY-ID',
    estado: 'SIGNED',
    id_constancia: '75ce3492-ea66-4092-9ed1-3a40f8cbd454',
  });

  const res = await request(makeApp())
    .get('/internal/expedientes/1111111111/constancia-consolidada.pdf')
    .set(HEADERS);

  assert.equal(res.status, 200);
  assert.equal(
    lastConsolidadoData.documentos[0].id_constancia,
    '75ce3492-ea66-4092-9ed1-3a40f8cbd454',
    'SIGNED sigue exponiendo id_constancia (no rompemos el flujo legacy)'
  );
});

test('DUAL_FIRMADO sin id_constancia persistido usa fallback al id_solicitud', async () => {
  // DUAL_FIRMADO sin id_constancia (caso edge: SR muy viejo o dato corrupto)
  insertSignRequest({
    id_solicitud: 'SIGN-2026-NOID',
    estado: 'DUAL_FIRMADO',
    id_constancia: null,
  });

  const res = await request(makeApp())
    .get('/internal/expedientes/1111111111/constancia-consolidada.pdf')
    .set(HEADERS);

  assert.equal(res.status, 200);
  assert.ok(
    lastConsolidadoData.documentos[0].id_constancia.includes('SIGN-2026-NOID'),
    'Si id_constancia es null, debe caer al id_solicitud con marcador'
  );
});

test('Estado PENDING: id_constancia queda null (sin constancia aún)', async () => {
  insertSignRequest({
    id_solicitud: 'SIGN-2026-PENDING',
    estado: 'PENDING',
    id_constancia: null,
  });

  const res = await request(makeApp())
    .get('/internal/expedientes/1111111111/constancia-consolidada.pdf')
    .set(HEADERS);

  assert.equal(res.status, 200);
  assert.equal(
    lastConsolidadoData.documentos[0].id_constancia,
    null,
    'PENDING no debe exponer id_constancia (la constancia no existe todavía)'
  );
});

test('Múltiples SRs (SIGNED + DUAL_FIRMADO): cada uno expone su propio id_constancia', async () => {
  insertSignRequest({
    id_solicitud: 'SIGN-2026-MULTI-SIGNED',
    estado: 'SIGNED',
    id_constancia: 'uuid-signed-001',
  });
  insertSignRequest({
    id_solicitud: 'SIGN-2026-MULTI-DUAL',
    estado: 'DUAL_FIRMADO',
    id_constancia: 'uuid-dual-002',
  });

  const res = await request(makeApp())
    .get('/internal/expedientes/1111111111/constancia-consolidada.pdf')
    .set(HEADERS);

  assert.equal(res.status, 200);
  const ids = lastConsolidadoData.documentos.map(d => d.id_constancia);
  assert.ok(ids.includes('uuid-signed-001'), 'SIGNED expone su id');
  assert.ok(ids.includes('uuid-dual-002'), 'DUAL_FIRMADO expone su id');
});

// =============================================================================
// Individual endpoint: /sign-requests/:id/constancia.pdf
// =============================================================================

test('DUAL_FIRMADO: /constancia.pdf NO retorna 409 (sirve el PDF si existe)', async () => {
  // Crear un archivo de constancia falso en el path esperado.
  // Como crear el path exacto del storage requiere más setup, este test
  // valida solo el código de estado y el mensaje — verifica que NO es 409.
  insertSignRequest({
    id_solicitud: 'SIGN-2026-999992',
    estado: 'DUAL_FIRMADO',
    id_constancia: 'uuid-indiv-1',
    constancia_path: '/tmp/this-file-does-not-exist.pdf', // para forzar 404 (no 409)
  });

  const res = await request(makeApp())
    .get('/internal/sign-requests/SIGN-2026-999992/constancia.pdf')
    .set(HEADERS);

  // Antes del fix: 409 CONSTANCIA_NOT_AVAILABLE
  // Después del fix: 404 (porque el archivo no existe en disco) o 200 (si existe)
  assert.notEqual(res.status, 409, 'DUAL_FIRMADO NO debe retornar 409');
  assert.notEqual(res.body.error && res.body.error.code, 'CONSTANCIA_NOT_AVAILABLE',
    'El código CONSTANCIA_NOT_AVAILABLE ya no aplica a DUAL_FIRMADO');
});

test('PENDING: /constancia.pdf retorna 409 (correcto, no hay constancia)', async () => {
  insertSignRequest({
    id_solicitud: 'SIGN-2026-999991',
    estado: 'PENDING',
    id_constancia: null,
  });

  const res = await request(makeApp())
    .get('/internal/sign-requests/SIGN-2026-999991/constancia.pdf')
    .set(HEADERS);

  assert.equal(res.status, 409, 'PENDING debe seguir retornando 409');
  assert.equal(res.body.error.code, 'CONSTANCIA_NOT_AVAILABLE');
});
