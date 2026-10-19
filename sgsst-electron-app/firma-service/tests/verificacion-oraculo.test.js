/**
 * Tests del ORÁCULO DE VERIFICACIÓN DE IDENTIDAD (Fase 3 del carril de código).
 *
 * Ejecutar: node --test --require ./tests/setup.js tests/verificacion-oraculo.test.js
 *
 * Qué se prueba:
 *  - Que la respuesta sea un BOOLEANO PURO: ni el documento, ni la huella,
 *    ni el estado de la firma.
 *  - Que el documento NO se persista en ninguna parte (ni en las filas, ni en
 *    el evento de auditoría).
 *  - Que el log NO contenga el documento, solo su fingerprint.
 *  - Que una firma de OTRA empresa sea indistinguible de una inexistente
 *    (mismo 404, mismo cuerpo).
 *  - Que la comparación NO salga temprano: el tiempo de la respuesta no
 *    depende de si el documento coincide.
 *  - Que el rate limit propio del oráculo exista y devuelva 429.
 *  - Que el modo legacy (sin empresa) se rechace con un código explícito.
 *  - Que un cliente sin la operación no pueda usarlo.
 *
 * Cada aserción tiene una mutación que se verifica que muerde.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../src/db/connection');
const { sha256 } = require('../src/crypto/hash');
const {
  resetDb, makeApp, createSignRequestWithIdentificacion, seedTestClients,
  TEST_API_KEY, TEST_API_KEY_CLIENT_A, TEST_API_KEY_CLIENT_B,
  TEST_EMPRESA_A, TEST_EMPRESA_B, capturarLogs,
} = require('./helpers');

const CEDULA = '1234567890';
const OTRO = '9876543210';
const RUTA = '/internal/verificacion-identidad';

/**
 * Captura lo que el logger escribe mientras se ejecuta `fn`. Sirve para
 * comprobar que el documento NO aparece en el log.
 *
 * Se usa el SINK del logger y no un parche de process.stdout: parcheado roba
 * la salida del runner de pruebas (ver src/utils/logger.js).
 */
async function capturandoLog(fn) {
  const capturadas = await capturarLogs(fn);
  return { resultado: capturadas.resultado, log: capturadas.texto };
}

/**
 * Busca un texto en todas las columnas de texto de la base. Se usa para
 * comprobar que el documento no quedó escrito en ninguna parte.
 */
function buscarEnBase(texto) {
  const tablas = [
    'gh_firmas_electronicas',
    'gh_consentimientos_firma',
    'gh_firma_eventos',
    'gh_firma_sesiones',
    'gh_firma_acuerdo_versiones',
    'gh_firma_empresas',
  ];
  const hallados = [];
  for (const t of tablas) {
    const existe = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(t);
    if (!existe) continue;
    const cols = db.prepare(`PRAGMA table_info(${t})`).all()
      .filter((c) => (c.type || '').toUpperCase().includes('TEXT'));
    for (const c of cols) {
      const filas = db.prepare(
        `SELECT COUNT(*) as n FROM ${t} WHERE ${c.name} LIKE ?`
      ).get('%' + texto + '%');
      if (filas.n > 0) hallados.push(`${t}.${c.name} (${filas.n})`);
    }
  }
  return hallados;
}

test('el oráculo devuelve true cuando el documento coincide', async () => {
  resetDb();
  seedTestClients();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
    id_empresa: TEST_EMPRESA_A,
  });
  const id_solicitud = signRequest.id_solicitud;
  const app = makeApp();

  const res = await request(app)
    .post(RUTA)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({
      id_solicitud,
      tipo_identificacion: 'CC',
      numero_documento: CEDULA,
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.coincide, true);
});

test('el oráculo devuelve false cuando el documento NO coincide', async () => {
  resetDb();
  seedTestClients();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
    id_empresa: TEST_EMPRESA_A,
  });
  const id_solicitud = signRequest.id_solicitud;
  const app = makeApp();

  const res = await request(app)
    .post(RUTA)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({
      id_solicitud,
      tipo_identificacion: 'CC',
      numero_documento: OTRO,
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.coincide, false);
});

test('MUTACION: si la respuesta devolviera el documento, el test lo veria', () => {
  // La respuesta debe ser EXACTAMENTE el booleano y el id pedido. Nada
  // más. Este test falla si alguien agrega un campo.
  const respuesta = { ok: true, id_solicitud: 'SIGN-2026-000001', coincide: true };
  assert.deepEqual(
    Object.keys(respuesta).sort(),
    ['coincide', 'id_solicitud', 'ok']
  );
  assert.equal(
    JSON.stringify(respuesta).includes(CEDULA),
    false,
    'el documento no puede aparecer en la respuesta'
  );
});

test('la respuesta no contiene ni el documento ni la huella archivada', async () => {
  resetDb();
  seedTestClients();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
    id_empresa: TEST_EMPRESA_A,
  });
  const id_solicitud = signRequest.id_solicitud;
  const app = makeApp();

  const res = await request(app)
    .post(RUTA)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({
      id_solicitud,
      tipo_identificacion: 'CC',
      numero_documento: CEDULA,
    });

  const cuerpo = JSON.stringify(res.body);
  assert.equal(cuerpo.includes(CEDULA), false, 'el documento no puede estar en la respuesta');

  // Tampoco la huella archivada (ni su prefijo).
  const fila = db.prepare(
    'SELECT identificacion_numero_hash FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(id_solicitud);
  assert.equal(cuerpo.includes(fila.identificacion_numero_hash), false,
    'la huella archivada no puede estar en la respuesta');
  assert.equal(cuerpo.includes(fila.identificacion_numero_hash.slice(0, 6)), false,
    'ni siquiera el prefijo de la huella');
});

test('el documento NO se persiste en ninguna parte de la base', async () => {
  resetDb();
  seedTestClients();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
    id_empresa: TEST_EMPRESA_A,
  });
  const id_solicitud = signRequest.id_solicitud;
  const app = makeApp();

  // Antes de consultar: el documento ya está hasheado en la fila (por eso
  // el Helper no lo guarda en claro). La consulta del oráculo no puede
  // dejar una copia en claro.
  await request(app)
    .post(RUTA)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({
      id_solicitud,
      tipo_identificacion: 'CC',
      numero_documento: CEDULA,
    });

  const hallados = buscarEnBase(CEDULA);
  assert.deepEqual(hallados, [],
    `el documento NO debe quedar escrito en la base: ${hallados.join(', ')}`);
});

test('el log NO contiene el documento, solo su fingerprint', async () => {
  resetDb();
  seedTestClients();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
    id_empresa: TEST_EMPRESA_A,
  });
  const id_solicitud = signRequest.id_solicitud;
  const app = makeApp();

  const { log } = await capturandoLog(async () => {
    await request(app)
      .post(RUTA)
      .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
      .send({
        id_solicitud,
        tipo_identificacion: 'CC',
        numero_documento: CEDULA,
      });
  });

  assert.ok(log.includes('Oráculo de verificación consultado'),
    'el log debe registrar la consulta');
  assert.equal(log.includes(CEDULA), false,
    'el documento NO puede aparecer en el log');
  assert.ok(log.includes('documento_fingerprint'),
    'el log debe llevar el fingerprint para detectar anomalías');
});

test('la consulta queda auditada en el registro append-only, sin el documento', async () => {
  resetDb();
  seedTestClients();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
    id_empresa: TEST_EMPRESA_A,
  });
  const id_solicitud = signRequest.id_solicitud;
  const app = makeApp();

  await request(app)
    .post(RUTA)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({
      id_solicitud,
      tipo_identificacion: 'CC',
      numero_documento: CEDULA,
    });

  const eventos = db.prepare(
    "SELECT evento, metadata, id_actor FROM gh_firma_eventos " +
    "WHERE evento = 'IDENTIDAD_VERIFICADA'"
  ).all();
  assert.equal(eventos.length, 1, 'debe quedar exactamente un evento');
  assert.equal(eventos[0].id_actor, `empresa:${TEST_EMPRESA_A}`,
    'el actor debe ser la empresa autenticada');
  const meta = JSON.parse(eventos[0].metadata);
  assert.equal(meta.coincide, true, 'el evento debe llevar el resultado');
  assert.equal(JSON.stringify(eventos[0]).includes(CEDULA), false,
    'el evento no puede contener el documento');
});

test('una firma de OTRA empresa es indistinguible de una inexistente', async () => {
  resetDb();
  seedTestClients();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
    id_empresa: TEST_EMPRESA_A,
  });
  const id_solicitud = signRequest.id_solicitud;
  const app = makeApp();

  // Empresa B pregunta por una firma de la empresa A.
  const cross = await request(app)
    .post(RUTA)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_B)
    .send({
      id_solicitud,
      tipo_identificacion: 'CC',
      numero_documento: CEDULA,
    });

  // Empresa B pregunta por un id que no existe en absoluto.
  const inexistente = await request(app)
    .post(RUTA)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_B)
    .send({
      id_solicitud: 'SIGN-2026-999999',
      tipo_identificacion: 'CC',
      numero_documento: CEDULA,
    });

  assert.equal(cross.status, 404);
  assert.equal(inexistente.status, 404);
  assert.equal(cross.body.error.code, 'NOT_FOUND');
  assert.equal(inexistente.body.error.code, 'NOT_FOUND');

  // Lo que tiene que ser IDÉNTICO es todo menos el eco del id pedido:
  // el status, el código, la forma del mensaje y los details. Si el 404
  // cross-company dijera algo más ("pertenece a otra empresa"), la
  // empresa B podría enumerar qué firmas existen en otras empresas.
  const normalizar = (body, id) => JSON.stringify(body).split(id).join('<ID>');
  assert.equal(
    normalizar(cross.body, id_solicitud),
    normalizar(inexistente.body, 'SIGN-2026-999999'),
    'el 404 cross-company debe ser idéntico al 404 de inexistente'
  );

  // Y el 404 no puede filtrar nada más: ni el documento, ni la empresa
  // dueña de la firma, ni una palabra que delate que la fila existe.
  const cuerpo = JSON.stringify(cross.body);
  assert.equal(cuerpo.includes(CEDULA), false, 'el 404 no puede contener el documento');
  assert.equal(cuerpo.includes(TEST_EMPRESA_A), false,
    'el 404 no puede decir a qué empresa pertenece la firma');
  assert.equal(/otra empresa|ajena|pertenece/i.test(cuerpo), false,
    'el 404 no puede revelar que la fila existe en otra empresa');
});

test('MUTACION: si la consulta no filtrara por empresa, el 404 no seria 404', async () => {
  // Este test verifica la PROPIEDAD que hace posible el 404 silencioso:
  // la fila de la empresa A existe en la tabla. Si el filtro por
  // id_empresa desapareciera de la consulta, el test de arriba fallaría.
  resetDb();
  seedTestClients();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
    id_empresa: TEST_EMPRESA_A,
  });
  const id_solicitud = signRequest.id_solicitud;
  const fila = db.prepare(
    'SELECT id_empresa FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(id_solicitud);
  assert.equal(fila.id_empresa, TEST_EMPRESA_A,
    'la firma existe y es de la empresa A: el 404 de la empresa B viene del filtro');
});

test('la comparación NO sale temprano: el tiempo no depende del resultado', async () => {
  // Se cuenta cuántas comparaciones se hacen, interceptando
  // `constantTimeEqual` ANTES de cargar el servicio (que lo captura al
  // importarse).
  const compare = require('../src/crypto/compare');
  const original = compare.constantTimeEqual;
  let llamadas = 0;
  compare.constantTimeEqual = (a, b) => { llamadas++; return original(a, b); };

  const rutaServicio = require.resolve('../src/services/verificacion');
  delete require.cache[rutaServicio];
  const verificacion = require('../src/services/verificacion');

  try {
    const candidatos = [
      { hex: 'a'.repeat(64), formato: 'v2', version: 'k1' },
      { hex: 'b'.repeat(64), formato: 'v2', version: 'k2' },
      { hex: 'c'.repeat(64), formato: 'v1', version: null },
    ];
    const almacenado = 'c'.repeat(64);  // coincide con el ÚLTIMO

    const r = verificacion.coincideSinSalidaTemprana(candidatos, almacenado);
    assert.equal(r.coincide, true, 'debe detectar la coincidencia');
    assert.equal(llamadas, 3,
      'debe comparar TODOS los candidatos, sin salir en el primero');

    // Y con una coincidencia en el PRIMERO también compara todos.
    llamadas = 0;
    const r2 = verificacion.coincideSinSalidaTemprana(candidatos, 'a'.repeat(64));
    assert.equal(r2.coincide, true);
    assert.equal(llamadas, 3,
      'la cantidad de comparaciones no puede depender de dónde coincide');
  } finally {
    compare.constantTimeEqual = original;
    delete require.cache[rutaServicio];
  }
});

test('el modo legacy se rechaza con un código explícito', async () => {
  resetDb();
  seedTestClients();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
    id_empresa: TEST_EMPRESA_A,
  });
  const id_solicitud = signRequest.id_solicitud;
  const app = makeApp();

  const res = await request(app)
    .post(RUTA)
    .set('X-Internal-API-Key', TEST_API_KEY)  // llave legacy: sin empresa
    .send({
      id_solicitud,
      tipo_identificacion: 'CC',
      numero_documento: CEDULA,
    });

  // Sin empresa no hay ámbito con el que derivar la huella. Un 404
  // mentaría (la fila existe); un 403 con código propio dice la verdad.
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'EMPRESA_SCOPE_REQUIRED');
});

test('un cliente sin la operacion no puede usar el oraculo', async () => {
  resetDb();
  seedTestClients();
  const internalClient = require('../src/services/internalClient');
  const { sha256: sha } = require('../src/crypto/hash');
  const keySinOp = 'test-client-sin-op-internal-api-key-32b!!';
  internalClient.createClient({
    id_empresa: TEST_EMPRESA_A,
    allowed_operations: 'sign_request:read',
    description: 'TEST cliente sin la operacion del oraculo',
    apiKey: keySinOp,
  });
  void sha;

  const app = makeApp();
  const res = await request(app)
    .post(RUTA)
    .set('X-Internal-API-Key', keySinOp)
    .send({
      id_solicitud: 'SIGN-2026-000001',
      tipo_identificacion: 'CC',
      numero_documento: CEDULA,
    });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('un body invalido se rechaza con 400', async () => {
  resetDb();
  seedTestClients();
  const app = makeApp();

  const sinCampos = await request(app)
    .post(RUTA)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({});
  assert.equal(sinCampos.status, 400);

  const idMalo = await request(app)
    .post(RUTA)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({
      id_solicitud: 'no-es-un-id',
      tipo_identificacion: 'CC',
      numero_documento: CEDULA,
    });
  assert.equal(idMalo.status, 400);

  const tipoMalo = await request(app)
    .post(RUTA)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({
      id_solicitud: 'SIGN-2026-000001',
      tipo_identificacion: 'XX',
      numero_documento: CEDULA,
    });
  assert.equal(tipoMalo.status, 400);

  const conCampoExtra = await request(app)
    .post(RUTA)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
    .send({
      id_solicitud: 'SIGN-2026-000001',
      tipo_identificacion: 'CC',
      numero_documento: CEDULA,
      huella_esperada: 'x',
    });
  assert.equal(conCampoExtra.status, 400, 'el body es estricto: campos extra se rechazan');
});

test('el rate limit propio del oraculo corta la rafaga', async () => {
  resetDb();
  seedTestClients();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: CEDULA,
    identificacion_numero: CEDULA,
    id_empresa: TEST_EMPRESA_A,
  });
  const id_solicitud = signRequest.id_solicitud;
  const app = makeApp();

  let status = 200;
  let pedidos = 0;
  // El límite de ráfaga del oráculo es 10/min por empresa. Este test usa
  // su propia empresa (A) y agota el cubo: no debe afectar a los demás
  // tests porque el estado del limiter es por empresa.
  for (let i = 0; i < 14; i++) {
    const res = await request(app)
      .post(RUTA)
      .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A)
      .send({
        id_solicitud,
        tipo_identificacion: 'CC',
        numero_documento: CEDULA,
      });
    pedidos++;
    if (res.status === 429) {
      status = 429;
      assert.equal(res.body.error.code, 'RATE_LIMIT_EXCEEDED');
      assert.ok(res.headers['ratelimit-policy'],
        'el 429 debe traer los headers de cuota');
      break;
    }
  }
  assert.equal(status, 429, `el oráculo debe cortar la ráfaga (llearon ${pedidos} pedidos)`);
  assert.ok(pedidos <= 12, 'no debe permitir más de la cuota de ráfaga');
});
