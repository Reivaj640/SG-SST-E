/**
 * LA LECTURA DE LOS ANEXOS PARA EL OPERADOR
 * ============================================================================
 *
 * GET /internal/admin/empresas/:id_empresa/anexos
 *
 * Lo que se comprueba aca:
 *
 * - Sin la llave de admin no se lee nada (401).
 * - Una empresa sin suscripciones devuelve los dos bloques con `suscripcion:
 *   null` y `eventos: []`.
 * - La suscripcion que sale es la MAS RECIENTE de la empresa (orden `id DESC`:
 *   el id mas alto es el mas nuevo) y trae su estado y su id.
 * - Los eventos salen EN ORDEN (id ASC: el primero sembrado va primero) y con
 *   SOLO los cinco campos del rastro.
 * - `contrafirma_canal` va ENMASCARADO: el buzon de K+AIR no se imprime entero.
 * - `representante_verificacion` y `evidencia` son columnas JSON EN TEXTO: se
 *   parsean y se devuelven como objeto; si el texto no parsea, `null`.
 * - NUNCA se devuelve `token_hash`, `otp_hash` ni `contrafirma_otp_hash`: son
 *   las llaves del mecanismo de firma, no datos de lectura.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../../src/db/connection');
const {
  resetDb, makeApp, assertJsonError, TEST_ADMIN_API_KEY,
} = require('../helpers');

const ADMIN = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };

const ID_EMPRESA = '900829731';
const ID_EMPRESA_SIN = '900829999';

// El canal de la contrafirma: el buzon de K+AIR. En la respuesta va
// enmascarado, nunca entero.
const CANAL_CONTRAFIRMA = 'privacidad.kair@gmail.com';

// ===========================================================================
// HELPERS
// ===========================================================================

/**
 * Siembra una suscripcion del Anexo de Encargo.
 *
 * Se inserta DIRECTAMENTE en la tabla (no por el flujo del enlace): lo que se
 * prueba aca es la LECTURA, y el flujo de suscripcion ya tiene sus propios
 * tests (tests/anexo-encargo-suscripcion.test.js).
 *
 * @param {string} id_empresa
 * @param {object} [extra] - columnas a sobreescribir.
 * @returns {number} el id de la fila sembrada.
 */
function sembrarSuscripcionEncargo(id_empresa, extra = {}) {
  const info = db.prepare(`
    INSERT INTO gh_firma_anexo_encargo_suscripciones
      (id_empresa, token_hash, version, hash_texto, correo_firmante,
       nombre_firmante, cargo_firmante, estado, expira_enlace_at,
       canal_codigo, firmado_at, contrafirmado_at,
       representante_verificacion, representante_verificado_at,
       contrafirma_canal, evidencia, contrafirma_acta_archivo,
       contrafirma_acta_hash, creado_por,
       contrafirma_actor, contrafirma_motivo, contrafirma_evidencia)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?)
  `).run(
    id_empresa,
    extra.token_hash || `token-hash-${id_empresa}-${Date.now()}-${Math.random()}`,
    extra.version !== undefined ? extra.version : '2026-11-06',
    extra.hash_texto !== undefined ? extra.hash_texto : 'a'.repeat(64),
    extra.correo_firmante !== undefined
      ? extra.correo_firmante : 'representante@empresa.test',
    extra.nombre_firmante !== undefined
      ? extra.nombre_firmante : 'Lilia Maria Vasquez Munoz',
    extra.cargo_firmante !== undefined
      ? extra.cargo_firmante : 'Representante legal',
    extra.estado !== undefined ? extra.estado : 'FIRMADA',
    extra.expira_enlace_at !== undefined
      ? extra.expira_enlace_at : '2026-11-10T10:00:00.000Z',
    extra.canal_codigo !== undefined
      ? extra.canal_codigo : 'segundo-canal@empresa.test',
    extra.firmado_at !== undefined ? extra.firmado_at : '2026-11-07T10:00:00.000Z',
    extra.contrafirmado_at !== undefined ? extra.contrafirmado_at : null,
    extra.representante_verificacion !== undefined
      ? extra.representante_verificacion : null,
    extra.representante_verificado_at !== undefined
      ? extra.representante_verificado_at : null,
    extra.contrafirma_canal !== undefined
      ? extra.contrafirma_canal : null,
    extra.evidencia !== undefined ? extra.evidencia : null,
    extra.contrafirma_acta_archivo !== undefined
      ? extra.contrafirma_acta_archivo : null,
    extra.contrafirma_acta_hash !== undefined
      ? extra.contrafirma_acta_hash : null,
    extra.creado_por !== undefined ? extra.creado_por : 'admin',
    extra.contrafirma_actor !== undefined ? extra.contrafirma_actor : null,
    extra.contrafirma_motivo !== undefined ? extra.contrafirma_motivo : null,
    extra.contrafirma_evidencia !== undefined ? extra.contrafirma_evidencia : null,
  );
  return info.lastInsertRowid;
}

/**
 * Siembra una suscripcion del Anexo de Nube.
 *
 * @param {string} id_empresa
 * @param {object} [extra]
 * @returns {number} el id de la fila sembrada.
 */
function sembrarSuscripcionNube(id_empresa, extra = {}) {
  const info = db.prepare(`
    INSERT INTO gh_firma_anexo_nube_suscripciones
      (id_empresa, token_hash, version, hash_texto, correo_firmante,
       nombre_firmante, cargo_firmante, estado, expira_enlace_at,
       firmado_at, evidencia, creado_por,
       contrafirmado_at, contrafirma_actor, contrafirma_motivo,
       contrafirma_canal, contrafirma_estado, contrafirma_evidencia,
       contrafirma_acta_archivo, contrafirma_acta_hash, contrafirma_acta_bytes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id_empresa,
    extra.token_hash || `token-nube-${id_empresa}-${Date.now()}-${Math.random()}`,
    extra.version !== undefined ? extra.version : '1.1',
    extra.hash_texto !== undefined ? extra.hash_texto : 'b'.repeat(64),
    extra.correo_firmante !== undefined
      ? extra.correo_firmante : 'representante@empresa.test',
    extra.nombre_firmante !== undefined
      ? extra.nombre_firmante : 'Lilia Maria Vasquez Munoz',
    extra.cargo_firmante !== undefined
      ? extra.cargo_firmante : 'Representante legal',
    extra.estado !== undefined ? extra.estado : 'FIRMADA',
    extra.expira_enlace_at !== undefined
      ? extra.expira_enlace_at : '2026-11-10T10:00:00.000Z',
    extra.firmado_at !== undefined ? extra.firmado_at : '2026-11-07T10:00:00.000Z',
    extra.evidencia !== undefined ? extra.evidencia : null,
    extra.creado_por !== undefined ? extra.creado_por : 'admin',
    // El SEGUNDO ACTO. Vienen en `null` por defecto: una suscripcion sin
    // contrafirmar es el caso normal de una Empresa que todavia no ha
    // contrafirmado.
    extra.contrafirmado_at !== undefined ? extra.contrafirmado_at : null,
    extra.contrafirma_actor !== undefined ? extra.contrafirma_actor : null,
    extra.contrafirma_motivo !== undefined ? extra.contrafirma_motivo : null,
    extra.contrafirma_canal !== undefined ? extra.contrafirma_canal : null,
    extra.contrafirma_estado !== undefined ? extra.contrafirma_estado : null,
    extra.contrafirma_evidencia !== undefined ? extra.contrafirma_evidencia : null,
    extra.contrafirma_acta_archivo !== undefined
      ? extra.contrafirma_acta_archivo : null,
    extra.contrafirma_acta_hash !== undefined
      ? extra.contrafirma_acta_hash : null,
    extra.contrafirma_acta_bytes !== undefined
      ? extra.contrafirma_acta_bytes : null,
  );
  return info.lastInsertRowid;
}

/**
 * Siembra un evento del rastro del Anexo de Encargo.
 *
 * @param {number} id_suscripcion
 * @param {string} id_empresa
 * @param {string} evento
 * @param {string} [detalle]
 */
function sembrarEventoEncargo(id_suscripcion, id_empresa, evento, detalle = null) {
  db.prepare(`
    INSERT INTO gh_firma_anexo_encargo_eventos
      (id_suscripcion, id_empresa, evento, detalle, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id_suscripcion, id_empresa, evento, detalle, '10.0.0.9', 'Navegador/1.0');
}

/**
 * Siembra un evento del rastro del Anexo de Nube.
 *
 * @param {number} id_suscripcion
 * @param {string} id_empresa
 * @param {string} evento
 * @param {string} [detalle]
 */
function sembrarEventoNube(id_suscripcion, id_empresa, evento, detalle = null) {
  db.prepare(`
    INSERT INTO gh_firma_anexo_nube_eventos
      (id_suscripcion, id_empresa, evento, detalle, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id_suscripcion, id_empresa, evento, detalle, '10.0.0.9', 'Navegador/1.0');
}

// ===========================================================================
// 1. LA LLAVE DE ADMIN
// ===========================================================================

test('sin la llave de admin no se lee ninguna suscripcion', async () => {
  resetDb();
  const id = sembrarSuscripcionEncargo(ID_EMPRESA);

  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA}/anexos`);

  assert.equal(res.status, 401);
  assertJsonError(res, 'INVALID_API_KEY');
  assert.ok(!JSON.stringify(res.body).includes('FIRMADA'),
    'un 401 no puede traer la suscripcion');
  assert.ok(id);
});

// ===========================================================================
// 2. LA EMPRESA SIN SUSCRIPCIONES
// ===========================================================================

test('una empresa sin suscripciones devuelve los dos bloques vacios', async () => {
  resetDb();

  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA_SIN}/anexos`)
    .set(ADMIN);

  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body).sort(),
    ['anexo_encargo', 'anexo_nube', 'id_empresa']);
  assert.equal(res.body.id_empresa, ID_EMPRESA_SIN);

  assert.equal(res.body.anexo_encargo.suscripcion, null);
  assert.deepEqual(res.body.anexo_encargo.eventos, []);
  assert.equal(res.body.anexo_nube.suscripcion, null);
  assert.deepEqual(res.body.anexo_nube.eventos, []);
});

// ===========================================================================
// 3. LA SUSCRIPCION Y SU RASTRO
// ===========================================================================

test('la lectura devuelve la suscripcion del anexo de encargo y sus eventos', async () => {
  resetDb();
  const idSuscripcion = sembrarSuscripcionEncargo(ID_EMPRESA, {
    estado: 'FIRMADA',
    version: '2026-11-06',
    hash_texto: 'c'.repeat(64),
    correo_firmante: 'representante@empresa.test',
    canal_codigo: 'segundo-canal@empresa.test',
    nombre_firmante: 'Lilia Maria Vasquez Munoz',
    cargo_firmante: 'Representante legal',
    firmado_at: '2026-11-07T10:00:00.000Z',
    contrafirmado_at: null,
    representante_verificacion: JSON.stringify({
      tipo_documento: 'CERTIFICADO_CAMARA',
      referencia: 'Radicado 2026-11-07-14',
    }),
    representante_verificado_at: '2026-11-07T11:00:00.000Z',
    contrafirma_canal: CANAL_CONTRAFIRMA,
    evidencia: JSON.stringify({ fuente: 'enlace_suscripcion', version: '2026-11-06' }),
    contrafirma_acta_archivo: 'acta-contrafirma-1.pdf',
    contrafirma_acta_hash: 'd'.repeat(64),
  });
  sembrarEventoEncargo(idSuscripcion, ID_EMPRESA, 'SUSCRIPCION_CREADA', 'version=2026-11-06');
  sembrarEventoEncargo(idSuscripcion, ID_EMPRESA, 'CODIGO_ENVIADO', 'intento=1');
  sembrarEventoEncargo(idSuscripcion, ID_EMPRESA, 'SUSCRIPCION_FIRMADA', 'version=2026-11-06');

  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA}/anexos`)
    .set(ADMIN);

  assert.equal(res.status, 200);
  const s = res.body.anexo_encargo.suscripcion;
  assert.ok(s, 'la suscripcion tiene que estar');
  assert.equal(s.id, idSuscripcion);
  assert.equal(s.estado, 'FIRMADA');
  assert.equal(s.version, '2026-11-06');
  assert.equal(s.hash, 'c'.repeat(64));
  assert.equal(s.correo_firmante, 'representante@empresa.test');
  assert.equal(s.canal_codigo, 'segundo-canal@empresa.test');
  assert.equal(s.nombre_firmante, 'Lilia Maria Vasquez Munoz');
  assert.equal(s.cargo_firmante, 'Representante legal');
  assert.equal(s.firmado_at, '2026-11-07T10:00:00.000Z');
  assert.equal(s.contrafirmado_at, null);
  assert.equal(s.representante_verificado_at, '2026-11-07T11:00:00.000Z');
  assert.equal(s.contrafirma_acta_archivo, 'acta-contrafirma-1.pdf');
  assert.equal(s.contrafirma_acta_hash, 'd'.repeat(64));
  assert.ok(s.created_at);
  assert.ok(s.updated_at);

  // Los eventos van EN ORDEN y con SOLO los cinco campos del rastro.
  const eventos = res.body.anexo_encargo.eventos;
  assert.equal(eventos.length, 3);
  assert.deepEqual(eventos.map((e) => e.evento),
    ['SUSCRIPCION_CREADA', 'CODIGO_ENVIADO', 'SUSCRIPCION_FIRMADA']);
  for (const e of eventos) {
    assert.deepEqual(Object.keys(e).sort(),
      ['detalle', 'evento', 'fecha_hora', 'ip', 'user_agent']);
    assert.ok(e.fecha_hora);
    assert.equal(e.ip, '10.0.0.9');
    assert.equal(e.user_agent, 'Navegador/1.0');
  }
});

test('la lectura del anexo de encargo trae la acreditacion de la facultad de quien contrafirmo', async () => {
  // 📦1047 · P7 (10-nov-2026). El panel del operador muestra "Facultad
  // acreditada" en las DOS vistas (Anexo de Encargo y Anexo de Nube). Para
  // eso la lectura tiene que traer la EVIDENCIA del segundo acto, que es
  // donde vive el bloque `facultad`.
  //
  // Sin esto el panel del Encargo mostraba SIEMPRE "NO DECLARADA", incluso
  // con la contrafirma hecha y con la facultad acreditada en el expediente:
  // un falso negativo en la pantalla, que hace creer que falta lo que ya
  // esta.
  resetDb();
  const idSuscripcion = sembrarSuscripcionEncargo(ID_EMPRESA, {
    contrafirmado_at: '2026-11-09T12:00:00.000Z',
    contrafirma_actor: 'Javier Robles Fontalvo',
    contrafirma_motivo: 'Cierre del Anexo de Encargo',
    contrafirma_evidencia: JSON.stringify({
      fase: 2,
      verificacion_firmante: { resultado: 'REPRESENTANTE_LEGAL_COINCIDE' },
      facultad: {
        resultado: 'REPRESENTANTE_LEGAL_ENCARGADO',
        nombre: 'Javier Robles Fontalvo',
        cargo: 'Representante Legal',
        tipo: 'REPRESENTACION',
        instrumento_ref: 'Representante legal declarado en el manifiesto legal',
      },
    }),
  });
  sembrarEventoEncargo(idSuscripcion, ID_EMPRESA, 'CONTRAFIRMA_FACULTAD_VERIFICADA',
    'resultado=REPRESENTANTE_LEGAL_ENCARGADO');

  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA}/anexos`)
    .set(ADMIN);

  assert.equal(res.status, 200);
  const s = res.body.anexo_encargo.suscripcion;
  assert.equal(s.contrafirmado_at, '2026-11-09T12:00:00.000Z');
  assert.equal(s.contrafirma_actor, 'Javier Robles Fontalvo');
  assert.equal(s.contrafirma_motivo, 'Cierre del Anexo de Encargo');
  // La evidencia sale PARSEADA (es una columna JSON en texto): si saliera
  // como texto, el panel leeria `evidencia.facultad` sobre una cadena y
  // nunca encontraria la facultad.
  assert.equal(typeof s.contrafirma_evidencia, 'object');
  assert.ok(s.contrafirma_evidencia, 'la evidencia tiene que estar');
  assert.equal(s.contrafirma_evidencia.fase, 2);
  assert.equal(s.contrafirma_evidencia.facultad.resultado, 'REPRESENTANTE_LEGAL_ENCARGADO');
  assert.equal(s.contrafirma_evidencia.facultad.nombre, 'Javier Robles Fontalvo');
});

test('la lectura devuelve la suscripcion del anexo de nube y sus eventos', async () => {
  resetDb();
  const idSuscripcion = sembrarSuscripcionNube(ID_EMPRESA, {
    estado: 'FIRMADA',
    version: '1.1',
    hash_texto: 'e'.repeat(64),
    firmado_at: '2026-11-07T10:00:00.000Z',
    evidencia: JSON.stringify({ fuente: 'enlace_suscripcion', version: '1.1' }),
  });
  sembrarEventoNube(idSuscripcion, ID_EMPRESA, 'SUSCRIPCION_CREADA', 'version=1.1');
  sembrarEventoNube(idSuscripcion, ID_EMPRESA, 'SUSCRIPCION_FIRMADA', 'version=1.1');

  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA}/anexos`)
    .set(ADMIN);

  assert.equal(res.status, 200);
  const s = res.body.anexo_nube.suscripcion;
  assert.ok(s, 'la suscripcion del anexo de nube tiene que estar');
  assert.equal(s.id, idSuscripcion);
  assert.equal(s.estado, 'FIRMADA');
  assert.equal(s.version, '1.1');
  assert.equal(s.hash, 'e'.repeat(64));
  assert.equal(s.firmado_at, '2026-11-07T10:00:00.000Z');

  // El Anexo de Nube NO tiene segundo canal del codigo de la SUSCRIPCION
  // (ese va al correo del firmante) ni verificacion documental: esos campos
  // van en null para que el panel lea los dos anexos con la misma forma.
  // El SEGUNDO ACTO, en cambio, si existe: se lee de la fila.
  assert.equal(s.canal_codigo, null);
  assert.equal(s.contrafirmado_at, null);
  assert.equal(s.representante_verificacion, null);
  assert.equal(s.representante_verificado_at, null);
  assert.equal(s.contrafirma_canal, null);
  assert.equal(s.contrafirma_acta_archivo, null);
  assert.equal(s.contrafirma_acta_hash, null);

  const eventos = res.body.anexo_nube.eventos;
  assert.equal(eventos.length, 2);
  assert.deepEqual(eventos.map((e) => e.evento),
    ['SUSCRIPCION_CREADA', 'SUSCRIPCION_FIRMADA']);
});

// ===========================================================================
// 4. LA SUSCRIPCION MAS RECIENTE MANDA
// ===========================================================================

test('con dos suscripciones sale la mas reciente, no la primera', async () => {
  resetDb();
  const vieja = sembrarSuscripcionEncargo(ID_EMPRESA, {
    estado: 'ANULADA',
    version: '2026-10-01',
    hash_texto: '1'.repeat(64),
  });
  const nueva = sembrarSuscripcionEncargo(ID_EMPRESA, {
    estado: 'FIRMADA',
    version: '2026-11-06',
    hash_texto: '2'.repeat(64),
  });
  assert.ok(nueva > vieja, 'la segunda sembrada tiene el id mas alto');
  sembrarEventoEncargo(nueva, ID_EMPRESA, 'SUSCRIPCION_FIRMADA', 'la nueva');

  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA}/anexos`)
    .set(ADMIN);

  assert.equal(res.status, 200);
  const s = res.body.anexo_encargo.suscripcion;
  assert.equal(s.id, nueva, 'la suscripcion que sale es la de id mas alto (id DESC)');
  assert.equal(s.estado, 'FIRMADA');
  assert.equal(s.version, '2026-11-06');
  assert.ok(!JSON.stringify(res.body).includes('1'.repeat(64)),
    'la suscripcion vieja no puede asomar en la respuesta');

  // Y los eventos son los de la suscripcion que sale, no los de la otra.
  assert.equal(res.body.anexo_encargo.eventos.length, 1);
  assert.equal(res.body.anexo_encargo.eventos[0].evento, 'SUSCRIPCION_FIRMADA');
});

// ===========================================================================
// 5. LO QUE NO SE DEVUELVE EN CLARO
// ===========================================================================

test('la suscripcion no trae las huellas del enlace ni del codigo', async () => {
  resetDb();
  const tokenHash = 'e'.repeat(64);
  const idSuscripcion = sembrarSuscripcionEncargo(ID_EMPRESA, {
    token_hash: tokenHash,
    evidencia: JSON.stringify({ fuente: 'enlace_suscripcion' }),
    contrafirma_canal: CANAL_CONTRAFIRMA,
  });
  // Se siembran las huellas que el flujo real deja (y que se borran al
  // suscribir, pero que en una fila vieja pueden seguir ahi).
  db.prepare(`
    UPDATE gh_firma_anexo_encargo_suscripciones
    SET otp_hash = ?, contrafirma_otp_hash = ?, canal_codigo_tipo = ?
    WHERE id = ?
  `).run('f'.repeat(64), '9'.repeat(64), 'correo', idSuscripcion);
  sembrarEventoEncargo(idSuscripcion, ID_EMPRESA, 'SUSCRIPCION_CREADA', 'version=2026-11-06');

  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA}/anexos`)
    .set(ADMIN);

  assert.equal(res.status, 200);
  const s = res.body.anexo_encargo.suscripcion;
  const claves = Object.keys(s);
  for (const prohibida of ['token_hash', 'otp_hash', 'contrafirma_otp_hash', 'canal_codigo_tipo']) {
    assert.ok(!claves.includes(prohibida),
      `la suscripcion no puede traer la clave "${prohibida}"`);
  }

  const crudo = JSON.stringify(res.body);
  assert.ok(!crudo.includes(tokenHash), 'la huella del enlace no puede ir en la respuesta');
  assert.ok(!crudo.includes('f'.repeat(64)), 'la huella del codigo no puede ir en la respuesta');
  assert.ok(!crudo.includes('9'.repeat(64)),
    'la huella del codigo de contrafirma no puede ir en la respuesta');
});

test('el canal de la contrafirma va enmascarado', async () => {
  resetDb();
  const idSuscripcion = sembrarSuscripcionEncargo(ID_EMPRESA, {
    contrafirma_canal: CANAL_CONTRAFIRMA,
  });
  sembrarEventoEncargo(idSuscripcion, ID_EMPRESA, 'CONTRAFIRMA_CODIGO_ENVIADO', 'intento=1');

  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA}/anexos`)
    .set(ADMIN);

  assert.equal(res.status, 200);
  const canal = res.body.anexo_encargo.suscripcion.contrafirma_canal;
  assert.equal(typeof canal, 'string');
  assert.notEqual(canal, CANAL_CONTRAFIRMA,
    'el buzon de K+AIR no puede salir entero');
  assert.match(canal, /\*\*\*/, 'el correo enmascarado lleva los asteriscos');
  assert.ok(!JSON.stringify(res.body).includes(CANAL_CONTRAFIRMA));
});

// ===========================================================================
// 6. LAS COLUMNAS JSON EN TEXTO
// ===========================================================================

test('la verificacion del representante y la evidencia se parsean a objeto', async () => {
  resetDb();
  const idSuscripcion = sembrarSuscripcionEncargo(ID_EMPRESA, {
    representante_verificacion: JSON.stringify({
      tipo_documento: 'CERTIFICADO_CAMARA',
      referencia: 'Radicado 2026-11-07-14',
    }),
    evidencia: JSON.stringify({ fuente: 'enlace_suscripcion', version: '2026-11-06' }),
  });
  sembrarEventoEncargo(idSuscripcion, ID_EMPRESA, 'SUSCRIPCION_FIRMADA', null);

  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA}/anexos`)
    .set(ADMIN);

  assert.equal(res.status, 200);
  const s = res.body.anexo_encargo.suscripcion;
  assert.equal(typeof s.representante_verificacion, 'object');
  assert.equal(s.representante_verificacion.tipo_documento, 'CERTIFICADO_CAMARA');
  assert.equal(s.representante_verificacion.referencia, 'Radicado 2026-11-07-14');
  assert.equal(typeof s.evidencia, 'object');
  assert.equal(s.evidencia.fuente, 'enlace_suscripcion');
  assert.equal(s.evidencia.version, '2026-11-06');
});

test('un texto JSON que no parsea se devuelve como null, sin reventar', async () => {
  resetDb();
  const idSuscripcion = sembrarSuscripcionEncargo(ID_EMPRESA, {
    representante_verificacion: 'esto-no-es-json',
    evidencia: '{roto',
  });
  sembrarEventoEncargo(idSuscripcion, ID_EMPRESA, 'SUSCRIPCION_FIRMADA', null);

  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA}/anexos`)
    .set(ADMIN);

  assert.equal(res.status, 200, 'una columna que no parsea no puede tumbar la lectura');
  const s = res.body.anexo_encargo.suscripcion;
  assert.equal(s.representante_verificacion, null);
  assert.equal(s.evidencia, null);
});

// ===========================================================================
// 8. EL SEGUNDO ACTO DEL ANEXO DE NUBE
// ===========================================================================
//
// 📦1047 · punto 3 El Anexo de Nube es BILATERAL (el texto vigente, §10): lo
// suscribe la Empresa (fase 1) y lo contrafirma K+AIR (fase 2). Antes la
// lectura devolvia `null` en todos los campos de la fase 2 y el comentario
// decia que "el Anexo de Nube NO es bilateral": era verdad el dia anterior y
// paso a ser mentira sin que nadie lo tocara. Estos tests fijan que la
// lectura devuelve el segundo acto REAL.

test('la suscripcion del anexo de nube trae el segundo acto cuando existe', async () => {
  resetDb();
  const idSuscripcion = sembrarSuscripcionNube(ID_EMPRESA, {
    estado: 'FIRMADA',
    version: '1.2',
    hash_texto: 'c'.repeat(64),
    firmado_at: '2026-11-09T10:00:00.000Z',
    contrafirmado_at: '2026-11-09T15:30:00.000Z',
    contrafirma_actor: 'admin:operador',
    contrafirma_motivo: 'Contrafirma sobre el texto vigente',
    contrafirma_canal: CANAL_CONTRAFIRMA,
    contrafirma_estado: 'CONTRAFIRMADA',
    contrafirma_evidencia: JSON.stringify({ fase: 2, fuente: 'contrafirma_kair' }),
    contrafirma_acta_archivo: 'acta-1-contrafirma-anexo-nube.pdf',
    contrafirma_acta_hash: 'd'.repeat(64),
    contrafirma_acta_bytes: 19804,
  });
  sembrarEventoNube(idSuscripcion, ID_EMPRESA, 'CONTRAFIRMA_CODIGO_ENVIADO', 'intento=1');
  sembrarEventoNube(idSuscripcion, ID_EMPRESA, 'CONTRAFIRMA_FIRMADA', null);

  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA}/anexos`)
    .set(ADMIN);

  assert.equal(res.status, 200);
  const s = res.body.anexo_nube.suscripcion;
  assert.ok(s, 'la suscripcion tiene que estar');

  // EL SEGUNDO ACTO: sale de la fila, no en null fijo.
  assert.equal(s.contrafirmado_at, '2026-11-09T15:30:00.000Z',
    'la contrafirma tiene que LEERSE: el operador no puede ver un null en un acto que ya ocurrio');
  assert.equal(s.contrafirma_actor, 'admin:operador');
  assert.equal(s.contrafirma_motivo, 'Contrafirma sobre el texto vigente');
  assert.equal(s.contrafirma_estado, 'CONTRAFIRMADA');
  assert.equal(s.contrafirma_acta_archivo, 'acta-1-contrafirma-anexo-nube.pdf');
  assert.equal(s.contrafirma_acta_hash, 'd'.repeat(64));
  assert.equal(s.contrafirma_acta_bytes, 19804);
  assert.equal(typeof s.contrafirma_evidencia, 'object');
  assert.equal(s.contrafirma_evidencia.fase, 2);

  // Y el estado de la fase 1 NO se mueve: sigue siendo el de la suscripcion.
  assert.equal(s.estado, 'FIRMADA',
    'el estado es el de la FASE 1: la suscripcion sigue firmada');
  assert.equal(s.firmado_at, '2026-11-09T10:00:00.000Z');
});

test('el canal de la contrafirma del anexo de nube va enmascarado', async () => {
  resetDb();
  const idSuscripcion = sembrarSuscripcionNube(ID_EMPRESA, {
    contrafirmado_at: '2026-11-09T15:30:00.000Z',
    contrafirma_canal: CANAL_CONTRAFIRMA,
  });
  sembrarEventoNube(idSuscripcion, ID_EMPRESA, 'CONTRAFIRMA_CODIGO_ENVIADO', null);

  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA}/anexos`)
    .set(ADMIN);

  assert.equal(res.status, 200);
  const canal = res.body.anexo_nube.suscripcion.contrafirma_canal;
  assert.equal(typeof canal, 'string');
  assert.notEqual(canal, CANAL_CONTRAFIRMA,
    'el buzon de K+AIR no puede salir entero');
  assert.match(canal, /\*\*\*/, 'el correo enmascarado lleva los asteriscos');
  assert.ok(!JSON.stringify(res.body).includes(CANAL_CONTRAFIRMA));
});

test('la suscripcion del anexo de nube no trae la huella del codigo de contrafirma', async () => {
  resetDb();
  const idSuscripcion = sembrarSuscripcionNube(ID_EMPRESA, {
    contrafirmado_at: '2026-11-09T15:30:00.000Z',
  });
  const hashOtp = '7'.repeat(64);
  db.prepare(`
    UPDATE gh_firma_anexo_nube_suscripciones
    SET contrafirma_otp_hash = ? WHERE id = ?
  `).run(hashOtp, idSuscripcion);

  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA}/anexos`)
    .set(ADMIN);

  assert.equal(res.status, 200);
  const claves = Object.keys(res.body.anexo_nube.suscripcion);
  assert.ok(!claves.includes('contrafirma_otp_hash'),
    'la huella del codigo no puede salir en la lectura');
  assert.ok(!JSON.stringify(res.body).includes(hashOtp));
});

test('una suscripcion sin contrafirmar sigue con el segundo acto en null', async () => {
  resetDb();
  const idSuscripcion = sembrarSuscripcionNube(ID_EMPRESA, { estado: 'FIRMADA' });
  sembrarEventoNube(idSuscripcion, ID_EMPRESA, 'SUSCRIPCION_FIRMADA', null);

  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA}/anexos`)
    .set(ADMIN);

  assert.equal(res.status, 200);
  const s = res.body.anexo_nube.suscripcion;
  assert.equal(s.contrafirmado_at, null,
    'sin contrafirma el segundo acto no existe: y se dice');
  assert.equal(s.contrafirma_actor, null);
  assert.equal(s.contrafirma_motivo, null);
  assert.equal(s.contrafirma_estado, null);
  assert.equal(s.contrafirma_acta_hash, null);
});

// ===========================================================================
// 9. UNA EMPRESA CON NIT INVALIDO
// ===========================================================================

test('un id de empresa invalido se rechaza con 400', async () => {
  resetDb();

  // El id tiene que tener entre 1 y 64 caracteres (el mismo schema que usa
  // el resto de las rutas de empresa).
  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${'9'.repeat(70)}/anexos`)
    .set(ADMIN);

  assert.equal(res.status, 400);
  assertJsonError(res, 'INVALID_REQUEST_BODY');
});
