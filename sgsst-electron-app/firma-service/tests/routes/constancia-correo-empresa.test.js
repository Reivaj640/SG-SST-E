/**
 * Tests del fix I-FIRMA-DUAL: el "Correo de la empresa" del header de la
 * constancia consolidada debe mostrar el correo del representante legal
 * cuando el SR tiene firma dual (snapshot) y NO tiene metadata.correo_empresa.
 *
 * Casos cubiertos:
 * - DUAL con snapshot del rep → cae al snapshot
 * - DUAL con metadata.correo_empresa Y snapshot → metadata gana (priority)
 * - Legacy con metadata.correo_empresa → usa metadata
 * - Sin metadata ni snapshot → null
 * - Snapshot corrupto (JSON inválido) → null (no rompe)
 *
 * Decisión validada:
 * - La fuente autoritativa del "correo corporativo" en firma dual es
 *   representante_legal_snapshot.correo, no metadata.correo_empresa.
 * - Antes del fix, el campo salía "—" en el PDF consolidado cuando el
 *   K+AIR no propagaba metadata.correo_empresa al crear el SR.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../../src/db/connection');
const { resetDb, seedActiveAgreement, makeApp, TEST_API_KEY } = require('../helpers');
const pdfGenConsolidado = require('../../src/services/pdfGenConsolidado');
const { hashToken } = require('../../src/crypto/token');

const HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };

/**
 * Inserta un sign request directamente en la BD con los overrides deseados.
 * No pasa por la API pública (que requiere Acuerdo activo + consent + OTP);
 * el handler de constancia consolidada solo lee la fila y arma el PDF.
 *
 * Estrategia: leer PRAGMA table_info para obtener TODAS las columnas y sus
 * defaults, y construir el INSERT dinámicamente. Las columnas que nos
 * importan para el test (id_solicitud, metadata, representante_legal_snapshot)
 * se pasan explícitamente; el resto usa su default de SQLite o un
 * placeholder que cumple NOT NULL.
 */
function getSchemaInfo() {
  const cols = db.prepare('PRAGMA table_info(gh_firmas_electronicas)').all();
  return cols;
}

function insertSignRequest({
  id_solicitud,
  id_documento,
  id_trabajador,
  id_empresa,
  estado = 'SIGNED',
  correo_verificacion = 'trabajador@example.com',
  metadata = null,
  tipo_firmante = 'TRABAJADOR',
  parent_id_solicitud = null,
  representante_legal_snapshot = null,
}) {
  const now = new Date().toISOString();
  // Valores que SÍ importan al test (las que lee el handler de constancia).
  const provided = {
    id_solicitud,
    id_documento,
    id_trabajador,
    id_empresa,
    estado,
    correo_verificacion,
    metadata: metadata ? JSON.stringify(metadata) : null,
    version_kair: '0.1.189-test',
    requiere_firma_empresa: tipo_firmante === 'EMPRESA' ? 1 : 0,
    tipo_firmante,
    parent_id_solicitud,
    representante_legal_snapshot: representante_legal_snapshot
      ? JSON.stringify(representante_legal_snapshot)
      : null,
    identificacion_tipo: 'CC',
    identificacion_numero_hash: 'hash-cc-test',
    fecha_creacion: now,
    fecha_expiracion: now,
    fecha_manifestacion: now,
    fecha_firma: now,
  };

  // Placeholders para columnas NOT NULL sin default que no nos importan.
  // Estos valores NO son leídos por el handler del fix; solo necesitamos
  // que el INSERT no falle por NOT NULL.
  const placeholders = {
    tipo_firma: 'CC',
    agreement_version: 'v1.0',
    agreement_hash: 'h',
    document_hash_original: 'h',
    pdf_original_path: '/tmp/orig.pdf',
    token_hash: hashToken('token-' + id_solicitud),
    sesion_id: 'sesion-' + id_solicitud,
    consent_id: 'consent-test',
    fecha_otp_enviado: null,
    otp_hash: null,
    otp_sal: null,
    correo_hash: 'h',
  };

  // Construir INSERT solo con las columnas que SÍ vamos a setear.
  // El resto usa los defaults de SQLite (mejor-sqlite3 ignora parámetros undefined
  // y deja que SQL use el DEFAULT clause, evitando errores de NOT NULL).
  const cols = getSchemaInfo();
  const setValues = { ...placeholders, ...provided }; // provided tiene prioridad
  const allCols = cols.map(c => c.name).filter(n => n !== 'id'); // autoincrement
  // Solo incluir columnas que están en setValues
  const colsToSet = allCols.filter(name => name in setValues);
  const cols_sql = colsToSet.join(', ');
  const ph_sql = colsToSet.map(() => '?').join(', ');
  const values = colsToSet.map(name => setValues[name]);

  db.prepare(`INSERT INTO gh_firmas_electronicas (${cols_sql}) VALUES (${ph_sql})`).run(...values);
}

// Mock del PDF generator para capturar el `data` que se le pasa.
// Devuelve un PDF mínimo válido (header + EOF) para que el handler responda 200.
let lastPdfCallData = null;
const realGen = pdfGenConsolidado.generateConstanciaConsolidadaPdf;
pdfGenConsolidado.generateConstanciaConsolidadaPdf = async function (data) {
  lastPdfCallData = data;
  return Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<<>>\nendobj\nxref\n0 1\n0000000000 65535 f\ntrailer\n<<>>\nstartxref\n0\n%%EOF\n', 'latin1');
};

test.beforeEach(() => {
  resetDb();
  seedActiveAgreement();
  lastPdfCallData = null;
});

test.after(() => {
  // Restaurar el PDF generator real para que otros tests no se vean afectados.
  pdfGenConsolidado.generateConstanciaConsolidadaPdf = realGen;
});

test('DUAL con snapshot del rep: cae al snapshot si metadata.correo_empresa es null', async () => {
  insertSignRequest({
    id_solicitud: 'SIGN-2026-DUAL001',
    id_documento: 'do-001',
    id_trabajador: '1111111111',
    id_empresa: '900511178',
    tipo_firmante: 'EMPRESA',
    metadata: { nombre_empresa: 'Tempoactiva', nit_empresa: '900511178' },
    representante_legal_snapshot: {
      nombre: 'Javier Robles',
      cargo: 'Representante Legal',
      correo: 'rep@tempoactiva.com',
      tipo_identificacion: 'CC',
      numero_identificacion: '79123456',
    },
  });

  const res = await request(makeApp())
    .get('/internal/expedientes/1111111111/constancia-consolidada.pdf')
    .set(HEADERS);

  assert.equal(res.status, 200);
  assert.equal(lastPdfCallData.correo_empresa, 'rep@tempoactiva.com',
    'Debe caer al snapshot.correo del rep cuando no hay metadata.correo_empresa');
});

test('DUAL con metadata.correo_empresa: metadata gana (priority sobre snapshot)', async () => {
  insertSignRequest({
    id_solicitud: 'SIGN-2026-DUAL002',
    id_documento: 'do-002',
    id_trabajador: '2222222222',
    id_empresa: '900511178',
    tipo_firmante: 'EMPRESA',
    metadata: { nombre_empresa: 'Tempoactiva', correo_empresa: 'corporativo@tempoactiva.com' },
    representante_legal_snapshot: {
      nombre: 'Javier Robles',
      correo: 'rep@tempoactiva.com',
    },
  });

  const res = await request(makeApp())
    .get('/internal/expedientes/2222222222/constancia-consolidada.pdf')
    .set(HEADERS);

  assert.equal(res.status, 200);
  assert.equal(lastPdfCallData.correo_empresa, 'corporativo@tempoactiva.com',
    'metadata.correo_empresa tiene prioridad sobre snapshot.correo');
});

test('Legacy (no DUAL) con metadata.correo_empresa: usa el de metadata', async () => {
  insertSignRequest({
    id_solicitud: 'SIGN-2026-LEGACY001',
    id_documento: 'do-003',
    id_trabajador: '3333333333',
    id_empresa: '900511178',
    tipo_firmante: 'TRABAJADOR',
    metadata: { nombre_empresa: 'Tempoactiva', correo_empresa: 'rrhh@tempoactiva.com' },
  });

  const res = await request(makeApp())
    .get('/internal/expedientes/3333333333/constancia-consolidada.pdf')
    .set(HEADERS);

  assert.equal(res.status, 200);
  assert.equal(lastPdfCallData.correo_empresa, 'rrhh@tempoactiva.com',
    'Sin firma dual, metadata.correo_empresa es la única fuente');
});

test('Sin metadata.correo_empresa ni snapshot: correo_empresa queda null (PDF muestra "—")', async () => {
  insertSignRequest({
    id_solicitud: 'SIGN-2026-NODATA001',
    id_documento: 'do-004',
    id_trabajador: '4444444444',
    id_empresa: '900511178',
    tipo_firmante: 'TRABAJADOR',
    metadata: { nombre_empresa: 'Tempoactiva' },
  });

  const res = await request(makeApp())
    .get('/internal/expedientes/4444444444/constancia-consolidada.pdf')
    .set(HEADERS);

  assert.equal(res.status, 200);
  assert.equal(lastPdfCallData.correo_empresa, null,
    'Sin metadata ni snapshot, correo_empresa debe ser null (PDF muestra "—")');
});

test('Snapshot corrupto (JSON inválido): no rompe, cae a null', async () => {
  // Insertar manualmente con metadata NULL y representante_legal_snapshot corrupto
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO gh_firmas_electronicas
      (id_solicitud, id_documento, id_empresa, id_trabajador,
       tipo_firma, agreement_version, agreement_hash, document_hash_original,
       pdf_original_path, fecha_creacion, fecha_expiracion, estado,
       token_hash, sesion_id, correo_verificacion, metadata,
       version_kair,
       requiere_firma_empresa, tipo_firmante, parent_id_solicitud,
       representante_legal_snapshot, identificacion_tipo,
       consent_id, identificacion_numero_hash)
    VALUES (?, 'do-005', '900511178', '5555555555',
            'CC', 'v1.0', 'h', 'h',
            '/tmp/o.pdf', ?, ?, 'SIGNED',
            ?, ?, 't@e.com', NULL,
            '0.1.189-test',
            1, 'EMPRESA', NULL,
            'ESTO NO ES JSON VALIDO {{{', 'CC',
            'h', 'h')
  `).run('SIGN-2026-CORRUPT001', now, now, hashToken('token-corrupt'), 'sesion-corrupt');

  const res = await request(makeApp())
    .get('/internal/expedientes/5555555555/constancia-consolidada.pdf')
    .set(HEADERS);

  assert.equal(res.status, 200,
    'Snapshot corrupto NO debe romper el endpoint (try/catch defensivo)');
  assert.equal(lastPdfCallData.correo_empresa, null,
    'Snapshot corrupto → cae a null');
});

test('DUAL: el primer SR que tenga snapshot provee el correo (no se sobreescribe)', async () => {
  // SR1: DUAL con snapshot del rep A
  insertSignRequest({
    id_solicitud: 'SIGN-2026-MULTI001',
    id_documento: 'do-006',
    id_trabajador: '6666666666',
    id_empresa: '900511178',
    tipo_firmante: 'EMPRESA',
    representante_legal_snapshot: {
      nombre: 'Rep A',
      correo: 'repA@tempoactiva.com',
    },
  });
  // SR2: DUAL con snapshot del rep B (NO debe sobrescribir al A)
  insertSignRequest({
    id_solicitud: 'SIGN-2026-MULTI002',
    id_documento: 'do-007',
    id_trabajador: '6666666666',
    id_empresa: '900511178',
    tipo_firmante: 'EMPRESA',
    representante_legal_snapshot: {
      nombre: 'Rep B',
      correo: 'repB@tempoactiva.com',
    },
  });

  const res = await request(makeApp())
    .get('/internal/expedientes/6666666666/constancia-consolidada.pdf')
    .set(HEADERS);

  assert.equal(res.status, 200);
  assert.equal(lastPdfCallData.correo_empresa, 'repA@tempoactiva.com',
    'El primer SR con snapshot provee el correo (first-wins)');
});

test('PDF se sirve con Content-Type application/pdf', async () => {
  insertSignRequest({
    id_solicitud: 'SIGN-2026-CT001',
    id_documento: 'do-008',
    id_trabajador: '7777777777',
    id_empresa: '900511178',
    tipo_firmante: 'EMPRESA',
    representante_legal_snapshot: { nombre: 'Rep', correo: 'rep@x.com' },
  });

  const res = await request(makeApp())
    .get('/internal/expedientes/7777777777/constancia-consolidada.pdf')
    .set(HEADERS);

  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /application\/pdf/);
  assert.match(res.headers['content-disposition'], /expediente-7777777777-constancia-consolidada\.pdf/);
});
