/**
 * EL ESTADO DE LOS ANEXOS DE LA EMPRESA (LADO CLIENTE)
 * ============================================================================
 *
 * GET /internal/empresa/anexos
 *
 * Lo que se comprueba aca:
 *
 * - La forma EXACTA de la respuesta: es un endpoint de estado, y cada clave que
 *   sobra o falta es un contrato que la app de escritorio depende.
 * - LA EMPRESA VIENE SOLO DE `req.id_empresa` (la identidad autenticada). La
 *   ruta no tiene `:id_empresa`, as que un `?id_empresa=` en el query NO mueve
 *   la empresa de la respuesta: no hay por donde escaparse.
 * - La key legacy (la que no esta atada a ninguna Empresa) NO lee el estado de
 *   NADIE: con `req.id_empresa` en null la ruta se niega con 403.
 * - Sin `X-Internal-API-Key` no se ve nada (401).
 * - Los TRES estados del Anexo de Encargo: no suscrito, suscrito (esperando la
 *   contrafirma de K+AIR) y ejecutado.
 * - El mensaje de `habilitacion` se devuelve TAL COMO lo produce el service: es
 *   el texto que distingue "suscribio pero K+AIR no contrafirmo" de "no tiene
 *   Anexo", y la UI lo muestra, no lo reescribe.
 * - La respuesta NO es un volcado de la tabla: ni token, ni OTP, ni el canal
 *   del codigo en claro, ni la evidencia cruda.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../../src/db/connection');
const empresaService = require('../../src/services/empresa');
const {
  resetDb, makeApp, seedTestClients, assertJsonError,
  TEST_API_KEY_CLIENT_A, TEST_API_KEY_CLIENT_B, TEST_API_KEY,
  TEST_EMPRESA_A, TEST_EMPRESA_B,
} = require('../helpers');

// ===========================================================================
// HELPERS
// ===========================================================================

/**
 * Siembra una Empresa con lo que haga falta para su estado de Anexo.
 *
 * Los campos del Anexo de Encargo son tres, y son los que deciden el estado:
 * `anexo_encargo_suscrito_at` (la Empresa suscrito, fase 1),
 * `anexo_encargo_firmado_at` (K+AIR contrafirmo, fase 2: el instrumento esta
 * EJECUTADO) y los dos que viajan con la suscripcion (version y hash del texto
 * que se suscribio).
 *
 * @param {string} id_empresa
 * @param {object} [anexos] - lo que se escribe en las columnas del Anexo.
 */
function sembrarEmpresa(id_empresa, anexos = {}) {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, domicilio, canal_pqrs,
       responsable_tratamiento_correo, representante_legal, activo,
       anexo_encargo_suscrito_at, anexo_encargo_suscrito_version,
       anexo_encargo_suscrito_hash, anexo_encargo_firmado_at,
       anexo_nube_firmado_at, anexo_nube_version, anexo_nube_hash,
       anexo_nube_ejecutado_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id_empresa,
    `EMPRESA ${id_empresa}`,
    `${id_empresa}-1`,
    'Calle 47 # 43-57 Piso 2, Barranquilla',
    `pqrs@${id_empresa}.test`,
    `datos@${id_empresa}.test`,
    'PERSONA DE PRUEBA',
    anexos.suscrito_at || null,
    anexos.suscrito_version || null,
    anexos.suscrito_hash || null,
    anexos.firmado_at || null,
    anexos.nube_firmado_at || null,
    anexos.nube_version || null,
    anexos.nube_hash || null,
    // 📦1047 · punto 3 La fecha de EJECUCIÓN del Anexo de Nube: la del
    // segundo acto (la contrafirma de K+AIR).
    anexos.nube_ejecutado_at || null,
  );
}

/**
 * Todas las claves de un objeto, en cualquier profundidad.
 *
 * Sirve para afirmar que la respuesta NO trae un campo prohibido: basta con
 * que la clave aparezca en algun nivel.
 *
 * @param {*} valor
 * @returns {string[]}
 */
function _claves(valor) {
  if (!valor || typeof valor !== 'object') return [];
  const salida = [];
  for (const [k, v] of Object.entries(valor)) {
    salida.push(k);
    salida.push(..._claves(v));
  }
  return salida;
}

// Las claves que NUNCA pueden aparecer en la respuesta del cliente.
const CLAVES_PROHIBIDAS = [
  'token',
  'token_hash',
  'otp',
  'otp_hash',
  'contrafirma_otp_hash',
  'canal_codigo',
  'canal_codigo_tipo',
  'representante_verificacion',
  'evidencia',
  'api_key',
];

// ===========================================================================
// 1. LA FORMA DE LA RESPUESTA
// ===========================================================================

test('el estado de los anexos tiene la forma exacta que espera la app', async () => {
  resetDb();
  seedTestClients();
  sembrarEmpresa(TEST_EMPRESA_A, {
    suscrito_at: '2026-11-07T10:00:00.000Z',
    suscrito_version: '2026-11-06',
    suscrito_hash: 'a'.repeat(64),
    firmado_at: '2026-11-07T12:00:00.000Z',
    nube_firmado_at: '2026-11-07T13:00:00.000Z',
    nube_version: '1.1',
    nube_hash: 'b'.repeat(64),
  });

  const res = await request(makeApp())
    .get('/internal/empresa/anexos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);

  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /application\/json/);

  // El sobre: cuatro claves, ni una mas.
  assert.deepEqual(Object.keys(res.body).sort(),
    ['anexo_encargo', 'anexo_nube', 'habilitacion', 'id_empresa']);

  assert.equal(res.body.id_empresa, TEST_EMPRESA_A);

  // El bloque del Anexo de Encargo: cinco claves.
  assert.deepEqual(Object.keys(res.body.anexo_encargo).sort(),
    ['estado', 'firmado_at', 'suscrito_at', 'suscrito_hash', 'suscrito_version']);
  assert.equal(res.body.anexo_encargo.estado, 'ejecutado');
  assert.equal(res.body.anexo_encargo.suscrito_at, '2026-11-07T10:00:00.000Z');
  assert.equal(res.body.anexo_encargo.suscrito_version, '2026-11-06');
  assert.equal(res.body.anexo_encargo.suscrito_hash, 'a'.repeat(64));
  assert.equal(res.body.anexo_encargo.firmado_at, '2026-11-07T12:00:00.000Z');

  // El bloque del Anexo de Nube: siete claves. 📦1047 · punto 3 El Anexo de
  // Nube es BILATERAL, asi que el bloque dice los TRES estados ("ejecutado",
  // "suscrito", "no_suscrito") como el del Anexo de Encargo: un `firmado` a
  // secas describia la mitad del instrumento.
  assert.deepEqual(Object.keys(res.body.anexo_nube).sort(),
    ['ejecutado', 'estado', 'fecha', 'fecha_ejecucion', 'firmado', 'hash', 'version']);
  assert.equal(res.body.anexo_nube.firmado, true);
  assert.equal(res.body.anexo_nube.fecha, '2026-11-07T13:00:00.000Z');
  assert.equal(res.body.anexo_nube.version, '1.1');
  assert.equal(res.body.anexo_nube.hash, 'b'.repeat(64));
  // Esta Empresa suscribio pero NO fue contrafirmada: el estado lo dice.
  assert.equal(res.body.anexo_nube.estado, 'suscrito');
  assert.equal(res.body.anexo_nube.ejecutado, false);
  assert.equal(res.body.anexo_nube.fecha_ejecucion, null);

  // El bloque de habilitacion: lo que produce el service, sin reescribirlo.
  assert.equal(typeof res.body.habilitacion.ok, 'boolean');
  assert.equal(typeof res.body.habilitacion.registrada, 'boolean');
  assert.ok(Array.isArray(res.body.habilitacion.pendientes));
  assert.equal(typeof res.body.habilitacion.mensaje, 'string');
  assert.deepEqual(res.body.habilitacion,
    empresaService.verificarHabilitacionFirma(TEST_EMPRESA_A));
});

// ===========================================================================
// 2. LA EMPRESA VIENE SOLO DE LA IDENTIDAD AUTENTICADA
// ===========================================================================

test('la empresa de la respuesta es la de la key, no la que mande el query', async () => {
  resetDb();
  seedTestClients();
  sembrarEmpresa(TEST_EMPRESA_A);
  sembrarEmpresa(TEST_EMPRESA_B, {
    suscrito_at: '2026-11-07T10:00:00.000Z',
    suscrito_version: '2026-11-06',
    suscrito_hash: 'c'.repeat(64),
    firmado_at: '2026-11-07T12:00:00.000Z',
  });

  const res = await request(makeApp())
    .get(`/internal/empresa/anexos?id_empresa=${TEST_EMPRESA_B}`)
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);

  assert.equal(res.status, 200);
  assert.equal(res.body.id_empresa, TEST_EMPRESA_A,
    'el query no puede mover la empresa: la ruta no tiene parametro de empresa');

  // Y lo de la otra empresa NO aparece: ni su estado, ni su huella.
  assert.equal(res.body.anexo_encargo.estado, 'no_suscrito');
  assert.equal(res.body.anexo_encargo.suscrito_hash, null);
  assert.ok(!JSON.stringify(res.body).includes('c'.repeat(64)),
    'la respuesta de A no puede traer el hash de la suscripcion de B');
});

test('la key de una empresa no ve el estado de la otra', async () => {
  resetDb();
  seedTestClients();
  // A no tiene nada; B si esta EJECUTADO.
  sembrarEmpresa(TEST_EMPRESA_A);
  sembrarEmpresa(TEST_EMPRESA_B, {
    suscrito_at: '2026-11-07T10:00:00.000Z',
    suscrito_version: '2026-11-06',
    suscrito_hash: 'd'.repeat(64),
    firmado_at: '2026-11-07T12:00:00.000Z',
  });

  const resA = await request(makeApp())
    .get('/internal/empresa/anexos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);

  assert.equal(resA.status, 200);
  assert.equal(resA.body.id_empresa, TEST_EMPRESA_A);
  assert.equal(resA.body.anexo_encargo.estado, 'no_suscrito');
  assert.equal(resA.body.anexo_encargo.firmado_at, null);

  // Y con la key de B, la de B: cada key lee lo suyo y nada mas.
  const resB = await request(makeApp())
    .get('/internal/empresa/anexos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_B);

  assert.equal(resB.status, 200);
  assert.equal(resB.body.id_empresa, TEST_EMPRESA_B);
  assert.equal(resB.body.anexo_encargo.estado, 'ejecutado');
});

// ===========================================================================
// 3. LA KEY QUE NO ESTA ATADA A NINGUNA EMPRESA
// ===========================================================================

test('la key legacy no lee el estado de ninguna empresa', async () => {
  resetDb();
  seedTestClients();
  sembrarEmpresa(TEST_EMPRESA_A, {
    suscrito_at: '2026-11-07T10:00:00.000Z',
    firmado_at: '2026-11-07T12:00:00.000Z',
  });

  // La legacy key no pertenece a ninguna empresa: `req.id_empresa` llega null.
  const res = await request(makeApp())
    .get('/internal/empresa/anexos')
    .set('X-Internal-API-Key', TEST_API_KEY);

  assert.equal(res.status, 403);
  assertJsonError(res, 'EMPRESA_NO_RESUELTA');
  assert.ok(!JSON.stringify(res.body).includes('2026-11-07T12:00:00.000Z'),
    'un 403 no puede traer el estado de una empresa');
});

// ===========================================================================
// 4. SIN API KEY
// ===========================================================================

test('sin la API key no se ve el estado de los anexos', async () => {
  resetDb();
  seedTestClients();
  sembrarEmpresa(TEST_EMPRESA_A);

  const res = await request(makeApp()).get('/internal/empresa/anexos');

  assert.equal(res.status, 401);
  assertJsonError(res, 'INVALID_API_KEY');
});

// ===========================================================================
// 5. LOS TRES ESTADOS DEL ANEXO DE ENCARGO
// ===========================================================================

test('una empresa sin anexo de encargo esta no_suscrito', async () => {
  resetDb();
  seedTestClients();
  sembrarEmpresa(TEST_EMPRESA_A);

  const res = await request(makeApp())
    .get('/internal/empresa/anexos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);

  assert.equal(res.status, 200);
  assert.equal(res.body.anexo_encargo.estado, 'no_suscrito');
  assert.equal(res.body.anexo_encargo.suscrito_at, null);
  assert.equal(res.body.anexo_encargo.suscrito_version, null);
  assert.equal(res.body.anexo_encargo.suscrito_hash, null);
  assert.equal(res.body.anexo_encargo.firmado_at, null);
  assert.equal(res.body.anexo_nube.firmado, false);
  assert.equal(res.body.anexo_nube.fecha, null);
  assert.equal(res.body.anexo_nube.estado, 'no_suscrito');
  assert.equal(res.body.anexo_nube.ejecutado, false);
});

test('una empresa que suscribio pero no fue contrafirmada esta suscrito', async () => {
  resetDb();
  seedTestClients();
  sembrarEmpresa(TEST_EMPRESA_A, {
    suscrito_at: '2026-11-07T10:00:00.000Z',
    suscrito_version: '2026-11-06',
    suscrito_hash: 'e'.repeat(64),
  });

  const res = await request(makeApp())
    .get('/internal/empresa/anexos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);

  assert.equal(res.status, 200);
  assert.equal(res.body.anexo_encargo.estado, 'suscrito',
    'suscrita sin contrafirmar NO es ejecutado: el instrumento es bilateral');
  assert.equal(res.body.anexo_encargo.suscrito_at, '2026-11-07T10:00:00.000Z');
  assert.equal(res.body.anexo_encargo.suscrito_version, '2026-11-06');
  assert.equal(res.body.anexo_encargo.suscrito_hash, 'e'.repeat(64));
  assert.equal(res.body.anexo_encargo.firmado_at, null,
    'sin contrafirma no hay fecha de ejecucion');
});

test('el Anexo de Nube de una empresa suscribida pero no contrafirmada esta suscrito', async () => {
  // 📦1047 · punto 3 El Anexo de Nube es bilateral como el de Encargo: con un
  // solo acto, el estado es "suscrito" y NO "ejecutado".
  resetDb();
  seedTestClients();
  sembrarEmpresa(TEST_EMPRESA_A, {
    nube_firmado_at: '2026-11-09T13:00:00.000Z',
    nube_version: '1.2',
    nube_hash: 'c'.repeat(64),
  });

  const res = await request(makeApp())
    .get('/internal/empresa/anexos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);

  assert.equal(res.status, 200);
  assert.equal(res.body.anexo_nube.estado, 'suscrito',
    'suscrita sin contrafirmar NO es ejecutada: el instrumento es bilateral');
  assert.equal(res.body.anexo_nube.ejecutado, false);
  assert.equal(res.body.anexo_nube.fecha_ejecucion, null);
  assert.equal(res.body.anexo_nube.firmado, true);
});

test('el Anexo de Nube de una empresa contrafirmada esta ejecutado', async () => {
  resetDb();
  seedTestClients();
  sembrarEmpresa(TEST_EMPRESA_A, {
    nube_firmado_at: '2026-11-09T13:00:00.000Z',
    nube_version: '1.2',
    nube_hash: 'c'.repeat(64),
    nube_ejecutado_at: '2026-11-09T14:00:00.000Z',
  });

  const res = await request(makeApp())
    .get('/internal/empresa/anexos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);

  assert.equal(res.status, 200);
  assert.equal(res.body.anexo_nube.estado, 'ejecutado');
  assert.equal(res.body.anexo_nube.ejecutado, true);
  assert.equal(res.body.anexo_nube.fecha_ejecucion, '2026-11-09T14:00:00.000Z',
    'la fecha de ejecucion es la del segundo acto, no la de la suscripcion');
  assert.equal(res.body.anexo_nube.fecha, '2026-11-09T13:00:00.000Z',
    'la fecha de la suscripcion se conserva: es el primer acto');
});

test('una empresa contrafirmada esta ejecutada, con la fecha de ejecucion', async () => {
  resetDb();
  seedTestClients();
  sembrarEmpresa(TEST_EMPRESA_A, {
    suscrito_at: '2026-11-07T10:00:00.000Z',
    suscrito_version: '2026-11-06',
    suscrito_hash: 'f'.repeat(64),
    firmado_at: '2026-11-07T12:00:00.000Z',
  });

  const res = await request(makeApp())
    .get('/internal/empresa/anexos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);

  assert.equal(res.status, 200);
  assert.equal(res.body.anexo_encargo.estado, 'ejecutado');
  assert.equal(res.body.anexo_encargo.firmado_at, '2026-11-07T12:00:00.000Z',
    'firmado_at es la fecha de EJECUCION, no la de la suscripcion');
  assert.equal(res.body.anexo_encargo.suscrito_at, '2026-11-07T10:00:00.000Z');
});

// ===========================================================================
// 6. EL MENSAJE DE HABILITACION NO SE REESCRIBE
// ===========================================================================

test('el mensaje de habilitacion es el del service, sin reescribirlo', async () => {
  resetDb();
  seedTestClients();
  // Suscrita pero NO contrafirmada: el mensaje tiene que distinguir este caso
  // del de "no tiene Anexo".
  sembrarEmpresa(TEST_EMPRESA_A, {
    suscrito_at: '2026-11-07T10:00:00.000Z',
    suscrito_version: '2026-11-06',
    suscrito_hash: 'a'.repeat(64),
  });

  const res = await request(makeApp())
    .get('/internal/empresa/anexos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);

  assert.equal(res.status, 200);
  const esperado = empresaService.verificarHabilitacionFirma(TEST_EMPRESA_A);
  assert.equal(res.body.habilitacion.mensaje, esperado.mensaje);
  assert.equal(res.body.habilitacion.ok, esperado.ok);
  assert.equal(res.body.habilitacion.registrada, esperado.registrada);
  assert.deepEqual(res.body.habilitacion.pendientes, esperado.pendientes);
});

test('una empresa que no esta en el directorio no es un 404', async () => {
  resetDb();
  seedTestClients();
  // NO se siembra la empresa: la key existe, pero la ficha no.
  const res = await request(makeApp())
    .get('/internal/empresa/anexos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);

  assert.equal(res.status, 200,
    'una empresa sin ficha no esta bloqueada: es otro problema (el alta)');
  assert.equal(res.body.anexo_encargo.estado, 'no_suscrito');
  assert.equal(res.body.habilitacion.registrada, false);
  assert.equal(res.body.habilitacion.ok, true);
});

// ===========================================================================
// 7. LO QUE NO PUEDE IR EN LA RESPUESTA
// ===========================================================================

test('la respuesta no trae el token, el otp ni el canal del codigo en claro', async () => {
  resetDb();
  seedTestClients();
  sembrarEmpresa(TEST_EMPRESA_A, {
    suscrito_at: '2026-11-07T10:00:00.000Z',
    suscrito_version: '2026-11-06',
    suscrito_hash: 'a'.repeat(64),
    firmado_at: '2026-11-07T12:00:00.000Z',
  });

  const res = await request(makeApp())
    .get('/internal/empresa/anexos')
    .set('X-Internal-API-Key', TEST_API_KEY_CLIENT_A);

  assert.equal(res.status, 200);
  const claves = _claves(res.body);
  for (const prohibida of CLAVES_PROHIBIDAS) {
    assert.ok(!claves.includes(prohibida),
      `la respuesta no puede traer la clave "${prohibida}": trae ${claves.join(', ')}`);
  }

  const crudo = JSON.stringify(res.body);
  assert.ok(!crudo.includes(TEST_API_KEY_CLIENT_A),
    'la API key no puede volver en la respuesta');
  assert.ok(!crudo.toLowerCase().includes('token'),
    'la respuesta no puede traer ningun token');
  assert.ok(!crudo.toLowerCase().includes('otp'),
    'la respuesta no puede traer ningun codigo de verificacion');
});
