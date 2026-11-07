/**
 * LA RUTA DE ADMINISTRACIÓN DEL ANEXO DE ENCARGO: LA QUE ABRÍA EL FLUJO
 * ============================================================================
 *
 * El §4.3 del plan listaba las rutas públicas de la suscripción y la de
 * contrafirma, pero NO la que abre la suscripción. Sin ella el servicio del
 * Anexo de Encargo era código muerto: nadie podía abrir una suscripción y
 * el flujo no era alcanzable por HTTP. Este archivo es esa ruta.
 *
 * Lo que se comprueba acá:
 *
 * - Sin la llave de admin no se abre ninguna suscripción (401).
 * - La ruta devuelve el enlace en claro, la versión y la huella del texto, y
 *   el prellenado de los cinco datos del §11.
 * - EL FLUCO COMPLETO POR HTTP: el operador abre la suscripción, la Empresa
 *   pide el código, se suscribe con los cinco datos del §11 y la fecha queda
 *   en la ficha de la Empresa. Es la prueba de que el camino existe de
 *   principio a fin y no solo por partes.
 * - La suscripción anulada no se puede usar, y anularla sin motivo no se
 *   puede (el rastro tiene que decir por qué).
 * - Suscribir NO contrafirma: la respuesta dice que el instrumento todavía
 *   le falta la firma de K+AIR.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../../src/db/connection');
const empresaService = require('../../src/services/empresa');
const mailer = require('../../src/services/mailer');
const {
  resetDb, makeApp, TEST_ADMIN_API_KEY,
} = require('../helpers');

const ADMIN = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };
const ID_EMPRESA = '900888555';
const RAZON_SOCIAL = 'EMPRESA DEL FLUJO SAS';
const CORREO_FIRMANTE = 'representante@empresa-flujo.test';

const DATOS_S11 = {
  razon_social: RAZON_SOCIAL,
  nit: '900888555-1',
  domicilio: 'Calle 47 # 43-57 Piso 2, Barranquilla',
  correo: CORREO_FIRMANTE,
  representante: 'PERSONA DE PRUEBA',
};

// ===========================================================================
// HELPERS
// ===========================================================================

function sembrarEmpresa() {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, domicilio, canal_pqrs,
       responsable_tratamiento_correo, representante_legal, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(ID_EMPRESA, RAZON_SOCIAL, '900888555-1',
    'Calle 47 # 43-57 Piso 2, Barranquilla', 'pqrs@empresa-flujo.test',
    'datos@empresa-flujo.test', 'PERSONA DE PRUEBA');
}

/** El último código de verificación que salió. */
function ultimoCodigo() {
  const inbox = mailer.getDevInbox();
  for (let i = inbox.length - 1; i >= 0; i--) {
    if (inbox[i].tipo === 'anexo_encargo' && inbox[i].otp) return inbox[i].otp;
  }
  return null;
}

function abrirSuscripcion(extra = {}) {
  return request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-encargo/suscripcion`)
    .set(ADMIN)
    .send(Object.assign({ correo_firmante: CORREO_FIRMANTE }, extra));
}

// ===========================================================================
// LA RUTA QUE ABRE LA SUSCRIPCIÓN
// ===========================================================================

test('sin la llave de admin no se abre ninguna suscripción', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-encargo/suscripcion`)
    .send({ correo_firmante: CORREO_FIRMANTE });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');

  const filas = db.prepare('SELECT * FROM gh_firma_anexo_encargo_suscripciones').all();
  assert.equal(filas.length, 0, 'no quedó ninguna suscripción a medias');
});

test('la ruta abre la suscripción y devuelve el enlace, la versión y la huella', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const res = await abrirSuscripcion({ nombre_firmante: 'PERSONA DE PRUEBA' });

  assert.equal(res.status, 201);
  assert.ok(res.body.token, 'la ruta tiene que devolver el enlace en claro');
  assert.match(res.body.url, /\/anexo-encargo\//, 'el enlace tiene que apuntar a la pantalla');
  assert.equal(res.body.version, '2026-11-06', 'la versión sale del manifiesto');
  assert.match(res.body.hash, /^[0-9a-f]{64}$/, 'la huella sale del manifiesto');
  assert.equal(res.body.datos_empresa.razon_social, RAZON_SOCIAL,
    'el prellenado del §11 tiene que salir de la ficha');

  // El enlace se puede usar: la empresa queda con la suscripción abierta.
  const fila = db.prepare('SELECT * FROM gh_firma_anexo_encargo_suscripciones').get();
  assert.equal(fila.id_empresa, ID_EMPRESA);
  assert.equal(fila.estado, 'PENDIENTE');
});

test('un correo que no es correo no abre suscripción', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const res = await abrirSuscripcion({ correo_firmante: 'esto-no-es-un-correo' });

  assert.equal(res.status, 400);
  const filas = db.prepare('SELECT * FROM gh_firma_anexo_encargo_suscripciones').all();
  assert.equal(filas.length, 0);
});

// ===========================================================================
// EL FLUCO COMPLETO POR HTTP
// ===========================================================================

test('EL FLUJO COMPLETO: abrir, pedir el código y suscribir por HTTP', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const app = makeApp();

  // 1. El operador abre la suscripción.
  const abierto = await request(app)
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-encargo/suscripcion`)
    .set(ADMIN)
    .send({ correo_firmante: CORREO_FIRMANTE });
  assert.equal(abierto.status, 201);

  const token = abierto.body.token;

  // 2. La Empresa abre el enlace y ve el contexto.
  const contexto = await request(app)
    .get(`/api/anexo-encargo/${encodeURIComponent(token)}`)
    .set('Accept', 'application/json');
  assert.equal(contexto.status, 200);
  assert.equal(contexto.body.vigente, true);

  // 3. Pide el código: sale al correo del firmante.
  const codigo = await request(app)
    .post(`/api/anexo-encargo/${encodeURIComponent(token)}/codigo`)
    .send({});
  assert.equal(codigo.status, 200);
  assert.ok(codigo.body.expira_en_segundos > 0);

  const otp = ultimoCodigo();
  assert.ok(otp, 'tiene que haber salido un correo con el código');

  // 4. La Empresa suscribe con los cinco datos del §11.
  const firma = await request(app)
    .post(`/api/anexo-encargo/${encodeURIComponent(token)}/suscribir`)
    .send({ otp: otp, acepta: true, datos_empresa: DATOS_S11 });

  assert.equal(firma.status, 200, JSON.stringify(firma.body));
  assert.equal(firma.body.firmado, true);
  assert.equal(firma.body.hash, abierto.body.hash,
    'lo que se suscribe tiene que ser el texto cuya huella se declaró');
  assert.equal(firma.body.contrafirmado, false,
    'suscribir NO contrafirma: el instrumento es bilateral');

  // 5. La fecha del Anexo de Encargo queda en la ficha de la Empresa.
  const empresa = empresaService.getById(ID_EMPRESA);
  assert.ok(empresa.anexo_encargo_firmado_at,
    'la firma de la Empresa tiene que quedar en su ficha');

  // 6. Y la suscripción queda con el rastro de los cinco datos declarados.
  const fila = db.prepare('SELECT * FROM gh_firma_anexo_encargo_suscripciones').get();
  assert.equal(fila.estado, 'FIRMADA');
  assert.equal(fila.contrafirmado_at, null,
    'sin contrafirma el instrumento no está ejecutado');

  const evidencia = JSON.parse(fila.evidencia);
  assert.equal(evidencia.fase, 1);
  assert.equal(evidencia.datos_empresa.nit, DATOS_S11.nit,
    'lo que declaró la Empresa es lo que queda en la evidencia');
});

test('suscribir sin los cinco datos del §11 no deja la firma a medias', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const app = makeApp();
  const abierto = await request(app)
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-encargo/suscripcion`)
    .set(ADMIN)
    .send({ correo_firmante: CORREO_FIRMANTE });
  const token = abierto.body.token;

  await request(app)
    .post(`/api/anexo-encargo/${encodeURIComponent(token)}/codigo`)
    .send({});
  const otp = ultimoCodigo();

  const incompletos = Object.assign({}, DATOS_S11);
  delete incompletos.nit;

  const res = await request(app)
    .post(`/api/anexo-encargo/${encodeURIComponent(token)}/suscribir`)
    .send({ otp: otp, acepta: true, datos_empresa: incompletos });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'DATOS_S11_INCOMPLETOS');
  assert.equal(empresaService.getById(ID_EMPRESA).anexo_encargo_firmado_at, null);
});

// ===========================================================================
// ANULAR LA SUSCRIPCIÓN
// ===========================================================================

test('anular una suscripción exige el motivo', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const abierto = await abrirSuscripcion();
  assert.equal(abierto.status, 201);

  const idSuscripcion = db.prepare(
    'SELECT id FROM gh_firma_anexo_encargo_suscripciones').get().id;

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-encargo/suscripcion/${idSuscripcion}/anular`)
    .set(ADMIN);

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'MOTIVO_REQUERIDO');
});

test('una suscripción anulada no se puede usar', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const abierto = await abrirSuscripcion();
  const token = abierto.body.token;
  const idSuscripcion = db.prepare(
    'SELECT id FROM gh_firma_anexo_encargo_suscripciones').get().id;

  const anulada = await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-encargo/suscripcion/${idSuscripcion}/anular`)
    .set(ADMIN)
    .set('X-Admin-Motivo', 'La Empresa pidió otra suscripción con el texto vigente');
  assert.equal(anulada.status, 200);

  const uso = await request(makeApp())
    .post(`/api/anexo-encargo/${encodeURIComponent(token)}/codigo`)
    .send({});
  assert.equal(uso.status, 410);
  assert.equal(uso.body.error.code, 'ENLACE_ANULADO');
});
