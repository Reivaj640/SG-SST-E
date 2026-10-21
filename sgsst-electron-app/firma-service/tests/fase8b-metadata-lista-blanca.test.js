/**
 * 8B · LA LISTA BLANCA DE `metadata` Y EL `.strict()` DEL ESQUEMA
 * =============================================================================
 *
 * El campo `metadata` de POST /internal/sign-requests es un string JSON
 * libre (≤ 8192) y lo que va ahí queda **archivado** en la columna `metadata`
 * de la fila de la firma. Lo que se archiva es DATO: puede ser PII y, en el
 * peor caso, dato de salud (el 10.8 exige consentimiento expreso para
 * tratarlo, el 10.6 exige suprimirlo cuando vence).
 *
 * Antes de esta fase el blob se archivaba entero. `correo_empresa` es la
 * prueba de que archivar lo que el cliente manda sin filtro cuesta datos: la
 * app la mandaba desde hace meses, el esquema no la declaraba, zod la
 * eliminaba en silencio, nunca llegó a la base, y la constancia salió sin el
 * canal de copia del 8.4.
 *
 * Lo que comprueban estos tests:
 *
 *   1. Una clave desconocida en el cuerpo se RECHAZA (400), no se pierde.
 *   2. Una clave desconocida en el blob libre se RECHAZA (400), no se archiva.
 *   3. Las claves permitidas sí se archivan.
 *   4. `correo_empresa` llega a la base y a la constancia (el bug real).
 *   5. El servicio también filtra: es el último punto antes de escribir.
 *   6. MUTACION: los detectores muerden.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const request = require('supertest');
const db = require('../src/db/connection');
const { sha256 } = require('../src/crypto/hash');
const metadataService = require('../src/services/metadata');
const pdfGenConsolidado = require('../src/services/pdfGenConsolidado');
const {
  resetDb, seedActiveAgreement, makeApp, createSignRequestWithIdentificacion, TEST_API_KEY,
} = require('./helpers');

const HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };

// Mock del generador de la constancia consolidada, para capturar los datos
// que le llegan (mismo patrón que tests/routes/constancia-correo-empresa.test.js).
let pdfCallData = null;
const realGenerar = pdfGenConsolidado.generateConstanciaConsolidadaPdf;
pdfGenConsolidado.generateConstanciaConsolidadaPdf = async function (data) {
  pdfCallData = data;
  return Buffer.from(
    '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<<>>\nendobj\nxref\n0 1\n0000000000 65535 f\n'
    + 'trailer\n<<>>\nstartxref\n0\n%%EOF\n',
    'latin1'
  );
};
test.after(() => {
  pdfGenConsolidado.generateConstanciaConsolidadaPdf = realGenerar;
});
test.beforeEach(() => {
  pdfCallData = null;
});

async function makePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([300, 200]);
  return Buffer.from(await doc.save());
}

/**
 * Construye el metadata de la ruta (el objeto que viaja en el campo
 * multipart `metadata`).
 */
function buildMetadata(acuerdo, overrides = {}) {
  return {
    id_documento: 'doc-001',
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    tipo_firma: 'presencial',
    agreement_hash: acuerdo.texto_hash,
    agreement_version: acuerdo.version,
    document_hash: null,
    version_kair: '0.1.189',
    ...overrides,
  };
}

/**
 * Crea una solicitud por la ruta y devuelve la respuesta.
 */
async function crearPorRuta(meta, pdf) {
  const app = makeApp();
  const doc = pdf || await makePdf();
  const body = { ...meta };
  if (body.document_hash === null) body.document_hash = sha256(doc);
  return request(app)
    .post('/internal/sign-requests')
    .set(HEADERS)
    .field('metadata', JSON.stringify(body))
    .attach('documento', doc, 'contrato.pdf');
}

// =========================================================================
// 1. El esquema es estricto: lo desconocido se rechaza
// =========================================================================

test('8B · una clave desconocida en el cuerpo se RECHAZA, no se pierde en silencio', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo, { campo_inventado: 'hola' });

  const res = await crearPorRuta(meta, pdf);

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
  // El error dice QUÉ clave sobró: sin eso, el cliente no puede arreglarlo.
  const texto = JSON.stringify(res.body.error.details);
  assert.ok(
    texto.includes('campo_inventado'),
    `el error debe nombrar la clave desconocida: ${texto}`
  );
});

test('8B · una clave desconocida en el blob libre se RECHAZA y no se archiva', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo, {
    metadata: JSON.stringify({
      subtipo_identificacion: 'contrato_fijo',
      diagnostico: 'diabetes tipo 2',   // dato de salud en el cajón de sastre
    }),
  });

  const res = await crearPorRuta(meta, pdf);

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
  assert.deepEqual(
    res.body.error.details.claves_no_permitidas,
    ['diagnostico'],
    'el error debe enumerar las claves no permitidas'
  );

  // Y no se creó nada: la fila con el dato de salud no existe.
  const filas = db.prepare('SELECT COUNT(*) AS n FROM gh_firmas_electronicas').get().n;
  assert.equal(filas, 0, 'no debe quedar ninguna fila creada');
});

// =========================================================================
// 2. Las claves permitidas sí pasan
// =========================================================================

test('8B · las claves permitidas del blob libre sí se archivan', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo, {
    nombre_trabajador: 'Juan Pérez',
    nombre_empresa: 'Gesstiar S.A.S.',
    metadata: JSON.stringify({
      subtipo_identificacion: 'autorizacion_datos',
      correo: 'trabajador@ejemplo.com',
    }),
  });

  const res = await crearPorRuta(meta, pdf);
  assert.equal(res.status, 201);

  const fila = db.prepare(
    'SELECT metadata FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(res.body.id_solicitud);
  const archivado = JSON.parse(fila.metadata);

  assert.equal(archivado.subtipo_identificacion, 'autorizacion_datos');
  assert.equal(archivado.correo, 'trabajador@ejemplo.com');
  assert.equal(archivado.nombre_trabajador, 'Juan Pérez');
  assert.equal(archivado.nombre_empresa, 'Gesstiar S.A.S.');
});

// =========================================================================
// 3. `correo_empresa`: el bug real
// =========================================================================

test('8B · correo_empresa llega a la base (antes se perdía en silencio)', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo, {
    correo_empresa: 'copias@empresa.com',
  });

  const res = await crearPorRuta(meta, pdf);
  assert.equal(res.status, 201);

  const fila = db.prepare(
    'SELECT metadata FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(res.body.id_solicitud);
  const archivado = JSON.parse(fila.metadata);
  assert.equal(
    archivado.correo_empresa,
    'copias@empresa.com',
    'el canal de copia del 8.4 tiene que quedar archivado'
  );
});

test('8B · correo_empresa vacío NO rompe la creación (la app lo manda en "")', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const pdf = await makePdf();
  // La app inicializa el campo en '' y lo reasigna al del representante
  // cuando hay firma dual. Con un `z.string().email()` a secas, CADA firma de
  // ese site caería en un 400.
  const meta = buildMetadata(acuerdo, { correo_empresa: '' });

  const res = await crearPorRuta(meta, pdf);
  assert.equal(res.status, 201, 'una cadena vacía no es un motivo para rechazar la solicitud');

  const fila = db.prepare(
    'SELECT metadata FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(res.body.id_solicitud);
  const archivado = JSON.parse(fila.metadata || '{}');
  assert.ok(
    !archivado.correo_empresa,
    'un canal vacío no se archiva: la constancia cae al snapshot del representante'
  );
});

test('8B · la constancia muestra el canal de copia que antes salía vacío', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo, {
    correo_empresa: 'copias@empresa.com',
    nombre_empresa: 'Gesstiar S.A.S.',
    nombre_trabajador: 'Juan Pérez',
  });

  const res = await crearPorRuta(meta, pdf);
  assert.equal(res.status, 201);

  // La constancia consolidada lee `correo_empresa` del metadata persistido
  // (routes/constancia.js). Con el campo perdido, salía vacío.
  const resConstancia = await request(makeApp())
    .get('/internal/expedientes/1234567890/constancia-consolidada.pdf')
    .set(HEADERS);

  assert.equal(resConstancia.status, 200);
  assert.ok(pdfCallData, 'la constancia consolidada debe generarse');
  assert.equal(
    pdfCallData.correo_empresa,
    'copias@empresa.com',
    'el canal de copia del 8.4 debe llegar al PDF de la constancia'
  );
  assert.equal(pdfCallData.nombre_empresa, 'Gesstiar S.A.S.');
});

// =========================================================================
// 4. El servicio también filtra (es el último punto antes de escribir)
// =========================================================================

test('8B · el servicio archiva solo la lista blanca, aunque se llame directo', async () => {
  resetDb();
  seedActiveAgreement();
  // El service se llama directo (firma dual, tests). Una fila escrita por ahí
  // no puede saltarse la lista.
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    identificacion_numero: '1234567890',
    metadata: JSON.stringify({
      subtipo_identificacion: 'contrato_fijo',
      llave_de_la_empresa: 'no deberia estar aqui',
    }),
  });

  const fila = db.prepare(
    'SELECT metadata FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  const archivado = JSON.parse(fila.metadata);

  assert.equal(archivado.subtipo_identificacion, 'contrato_fijo');
  assert.ok(
    !('llave_de_la_empresa' in archivado),
    'una clave no permitida no puede quedar archivada por la vía del service'
  );
});

// =========================================================================
// 5. MUTACION: los detectores muerden
// =========================================================================

test('8B · MUTACION: el filtro sin lista blanca dejaría pasar todo', () => {
  // Si el filtro no existiera (o no mirara la lista), el test anterior
  // pasaría siempre. Se comprueba contra un blob con una clave de más.
  const sucio = { subtipo_identificacion: 'x', clave_que_no_deberia: 1 };
  const resultado = metadataService.filtrarMetadata(sucio);

  assert.equal(resultado.ok, false, 'con la lista blanca, lo desconocido no pasa');
  assert.deepEqual(resultado.desconocidas, ['clave_que_no_deberia']);
  assert.ok(
    !('clave_que_no_deberia' in resultado.valor),
    'el valor filtrado no puede contener la clave rechazada'
  );

  // Y el filtro limpio sí deja pasar lo permitido.
  const limpio = metadataService.filtrarMetadata({ subtipo_identificacion: 'x' });
  assert.equal(limpio.ok, true);
  assert.equal(limpio.valor.subtipo_identificacion, 'x');
});

test('8B · MUTACION: sin el `.strict()`, una clave desconocida no se vería', async () => {
  // El `.strict()` es lo que convierte "se perdió en silencio" en "se
  // rechazó con un error que dice qué pasó". Se comprueba que el esquema
  // rechaza de verdad, y no solo que el filtro del blob lo hace.
  resetDb();
  const acuerdo = seedActiveAgreement();
  const pdf = await makePdf();
  const meta = buildMetadata(acuerdo, { clave_que_no_deberia: 1 });

  const res = await crearPorRuta(meta, pdf);
  assert.equal(res.status, 400, 'el esquema tiene que rechazar, no descartar');
  assert.ok(
    JSON.stringify(res.body.error.details).includes('clave_que_no_deberia'),
    'el error nombra la clave'
  );
});
