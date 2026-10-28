/**
 * La prohibición de subir documentos con datos sensibles de salud.
 *
 * Decisión del owner: el servicio de firma electrónica NO recibe documentos
 * con datos sensibles de salud. El servicio no necesita ese dato: la Empresa
 * conserva el documento original.
 *
 * Lo que se implementa (y lo que NO):
 * - Una DECLARACIÓN EXPRESA y OBLIGATORIA, con texto fijo, de que el
 *   documento no contiene datos sensibles de salud. No un boolean genérico:
 *   con un texto queda escrito QUÉ se declaró.
 * - Si falta o no coincide: 422 DECLARACION_DATOS_SENSIBLES_REQUERIDA, con un
 *   mensaje que dice qué pasa y que la firma se puede hacer en papel.
 * - La declaración queda archivada CON la solicitud y con la huella del PDF
 *   que se subió, y queda un evento en gh_firma_eventos (append-only).
 *
 * Lo que NO se implementa: detección automática de datos sensibles en el PDF.
 * No es fiable y prometer un control que el código no cumple es lo que este
 * paquete de trabajo vino a corregir.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const { sha256 } = require('../src/crypto/hash');
const db = require('../src/db/connection');
const {
  resetDb, seedActiveAgreement, makeApp, TEST_API_KEY,
} = require('./helpers');
const {
  DECLARACION_SALUD, CODIGO_ERROR, esDeclaracionValida,
} = require('../src/services/declaracionSalud');

const HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };

async function makePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([300, 200]);
  return Buffer.from(await doc.save());
}

/**
 * El metadata de la solicitud, con el Acuerdo sembrado.
 */
function buildMetadata(acuerdo, extra) {
  return Object.assign({
    id_documento: 'doc-001',
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    tipo_firma: 'presencial',
    agreement_hash: acuerdo.texto_hash,
    agreement_version: acuerdo.version,
    document_hash: null,
    version_kair: '0.1.189',
  }, extra || {});
}

// =========================================================================
// LA DECLARACIÓN COMO CONSTANTE
// =========================================================================

test('la declaración es un texto fijo, no un boolean', () => {
  assert.equal(DECLARACION_SALUD, 'EL_DOCUMENTO_NO_CONTIENE_DATOS_SENSIBLES_DE_SALUD');
  assert.equal(esDeclaracionValida(DECLARACION_SALUD), true);
  assert.equal(esDeclaracionValida('el_documento_no_contiene_datos_sensibles_de_salud'), false,
    'el valor tiene que ser EXACTO: en minúsculas no es la declaración');
  assert.equal(esDeclaracionValida(true), false, 'un boolean no es la declaración');
  assert.equal(esDeclaracionValida(''), false);
  assert.equal(esDeclaracionValida(null), false);
  assert.equal(esDeclaracionValida(undefined), false);
});

// =========================================================================
// LA PUERTA DE ENTRADA (POST /internal/sign-requests)
// =========================================================================

test('POST /internal/sign-requests: SIN declaración → 422 DECLARACION_DATOS_SENSIBLES_REQUERIDA', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, CODIGO_ERROR);
  assert.match(res.body.error.message, /datos sensibles de salud/);
  assert.match(res.body.error.message, /papel/,
    'el mensaje tiene que decir que la firma se puede hacer en papel');
  // Y no se creó nada: la puerta es ANTES de crear la solicitud.
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM gh_firmas_electronicas').get().n, 0,
    'una solicitud rechazada no deja fila'
  );
});

test('POST /internal/sign-requests: declaración CON otro texto → 422', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .field('declaracion_datos_sensibles', 'EL_DOCUMENTO_TIENE_DATOS_SENSIBLES_DE_SALUD')
    .attach('documento', pdf, 'contrato.pdf');

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, CODIGO_ERROR);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM gh_firmas_electronicas').get().n, 0
  );
});

test('POST /internal/sign-requests: con la declaración exacta → 201 y queda registrada', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo);
  meta.document_hash = sha256(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .field('declaracion_datos_sensibles', DECLARACION_SALUD)
    .attach('documento', pdf, 'contrato.pdf');

  assert.equal(res.status, 201);
  const id = res.body.id_interno;

  // 1. Queda archivada CON la solicitud.
  const fila = db.prepare(`
    SELECT declaracion_datos_sensibles, declaracion_datos_sensibles_at, document_hash_original
      FROM gh_firmas_electronicas WHERE id = ?
  `).get(id);
  assert.equal(fila.declaracion_datos_sensibles, DECLARACION_SALUD,
    'la declaración queda escrita en la fila de la solicitud');
  assert.ok(fila.declaracion_datos_sensibles_at,
    'la declaración tiene fecha: sin fecha no hay trazabilidad');

  // 2. Y es trazable al documento EXACTO: la huella del PDF está al lado.
  assert.equal(fila.document_hash_original, sha256(pdf),
    'la huella del PDF subido es la que se calculó');

  // 3. Y queda el evento en el registro append-only.
  const eventos = db.prepare(`
    SELECT evento, metadata, id_actor FROM gh_firma_eventos
     WHERE firma_id = ? AND evento = 'DECLARACION_DATOS_SENSIBLES'
  `).all(id);
  assert.equal(eventos.length, 1, 'tiene que haber exactamente UN evento de declaración');
  const md = JSON.parse(eventos[0].metadata);
  assert.equal(md.valor_declarado, DECLARACION_SALUD);
  assert.equal(md.hash_documento, sha256(pdf),
    'el evento tiene que decir sobre qué documento se declaró');
  assert.equal(md.id_solicitud, res.body.id_solicitud);
  assert.equal(md.id_empresa, meta.id_empresa);
});

test('POST /internal/sign-requests: la declaración también vale dentro del metadata', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const app = makeApp();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo, { declaracion_datos_sensibles: DECLARACION_SALUD });
  meta.document_hash = sha256(pdf);

  const res = await request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(meta))
    .attach('documento', pdf, 'contrato.pdf');

  assert.equal(res.status, 201,
    'la declaración puede ir en el JSON del metadata: el schema es strict() '
    + 'y esa clave es un control de la frontera, no un dato de negocio');
  const fila = db.prepare(
    'SELECT declaracion_datos_sensibles FROM gh_firmas_electronicas WHERE id = ?'
  ).get(res.body.id_interno);
  assert.equal(fila.declaracion_datos_sensibles, DECLARACION_SALUD);
});

// =========================================================================
// EL SERVICE
// =========================================================================

test('el service rechaza una declaración que no es la constante', () => {
  const signRequestService = require('../src/services/signRequest');
  assert.throws(
    () => signRequestService.create({
      id_documento: 'doc-001',
      id_trabajador: '1234567890',
      id_empresa: '900123456',
      tipo_firma: 'presencial',
      agreement_version: 'v1.0',
      agreement_hash: 'a'.repeat(64),
      document_hash: null,
      pdf_buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
      pdf_filename: 'x.pdf',
      version_kair: '0.1.189',
      declaracion_datos_sensibles: 'NO_CUALQUIER_COSA',
    }),
    (err) => err && err.code === CODIGO_ERROR && err.statusCode === 422,
    'en la base nunca puede quedar archivada una declaración inventada'
  );
});
