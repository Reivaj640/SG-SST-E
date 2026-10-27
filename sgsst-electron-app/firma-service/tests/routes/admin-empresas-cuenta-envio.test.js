/**
 * LOS ENDPOINTS ADMIN DE LA CUENTA DE CORREO DE ENVÍO (migración 042)
 * =====================================================================
 *
 * La decisión 1.b del owner: "la Empresa es quien realiza el envío, con sus
 * propios correos; K+AIR es el puente".
 *
 * Estos tests fijan el contrato HTTP:
 *
 *   - sin key: 401 (no un cuelgue);
 *   - GET: la vista ENMASCARADA, sin la contraseña, 404 si no hay cuenta;
 *   - POST: da de alta (201) o actualiza (200), y NUNCA devuelve la clave;
 *   - DELETE: elimina y deja rastro;
 *   - POST .../probar: manda un correo de prueba y responde {ok, detalle};
 *   - cada cambio deja un renglón en el rastro append-only, con el actor y el
 *     motivo que fueron por los headers.
 *
 * Todos los datos son sintéticos.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const db = require('../../src/db/connection');
const empresaService = require('../../src/services/empresa');
const cuentaEnvio = require('../../src/services/cuentaEnvio');
const { resetDb, makeApp, TEST_ADMIN_API_KEY } = require('../helpers');

const SQL_042 = path.join(
  __dirname, '..', '..', 'src', 'db', 'schema', '042_cuenta_envio_empresa.sql'
);

const ADMIN = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };
const EMPRESA = '901234567';
const CLAVE = 'clave-secreta-de-prueba';

const CUENTA = {
  host: 'smtp.empresa.example',
  puerto: 587,
  secure: false,
  usuario: 'smtp-user-de-prueba@empresa.example',
  clave: CLAVE,
  from_nombre: 'Empresa de Prueba S.A.S.',
  from_email: 'notificaciones@empresa.example',
};

function limpiar() {
  resetDb();
  // El rastro es append-only: para limpiarlo entre tests se bajan los
  // triggers y se vuelve a aplicar la migración (que los repone).
  db.exec('DROP TRIGGER IF EXISTS trg_empresas_cuenta_envio_auditoria_no_update');
  db.exec('DROP TRIGGER IF EXISTS trg_empresas_cuenta_envio_auditoria_no_delete');
  db.prepare('DELETE FROM gh_firma_empresas_cuenta_envio_auditoria').run();
  db.prepare('DELETE FROM gh_firma_empresas_cuenta_envio').run();
  db.exec(fs.readFileSync(SQL_042, 'utf8'));
  cuentaEnvio.limpiarCache();
  db.prepare('DELETE FROM gh_firma_empresas').run();
  empresaService.create({
    id_empresa: EMPRESA,
    razon_social: 'Empresa de Prueba S.A.S.',
  });
}

function renglones() {
  return db.prepare(`
    SELECT campo, valor_anterior, valor_nuevo, id_actor, motivo
    FROM gh_firma_empresas_cuenta_envio_auditoria
    WHERE id_empresa = ?
    ORDER BY id ASC
  `).all(EMPRESA);
}

// ─────────────────────────────────────────────────────────────────────────────
// La autenticación
// ─────────────────────────────────────────────────────────────────────────────

test('cuenta de envio · sin key devuelve 401 (y no se queda colgado)', async () => {
  limpiar();
  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .timeout({ response: 3000 });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('cuenta de envio · con key equivocada devuelve 401', async () => {
  limpiar();
  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set('X-Admin-API-Key', 'clave-que-no-es')
    .timeout({ response: 3000 });

  assert.equal(res.status, 401);
});

// ─────────────────────────────────────────────────────────────────────────────
// El GET
// ─────────────────────────────────────────────────────────────────────────────

test('cuenta de envio · el GET sin cuenta devuelve 404', async () => {
  limpiar();
  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .timeout({ response: 3000 });

  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'CUENTA_ENVIO_NOT_FOUND');
});

// ─────────────────────────────────────────────────────────────────────────────
// El POST
// ─────────────────────────────────────────────────────────────────────────────

test('cuenta de envio · el POST da de alta la cuenta y NO devuelve la clave', async () => {
  limpiar();
  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'el operador')
    .set('X-Admin-Motivo', 'la Empresa registro su cuenta')
    .send(CUENTA)
    .timeout({ response: 3000 });

  assert.equal(res.status, 201);
  assert.equal(res.body.host, CUENTA.host);
  assert.equal(res.body.puerto, 587);
  assert.equal(res.body.secure, false);
  assert.equal(res.body.from_nombre, CUENTA.from_nombre);
  assert.equal(res.body.from_email, CUENTA.from_email);
  assert.equal(res.body.activo, true);
  assert.equal(res.body.clave_presente, true);
  assert.ok(res.body.fecha_creacion);
  assert.ok(res.body.fecha_actualizacion);

  // LA CONTRASEÑA NO SE DEVUELVE.
  assert.equal(res.body.clave, undefined, 'la respuesta no trae la clave');
  assert.ok(
    !JSON.stringify(res.body).includes(CLAVE),
    'la clave en claro no aparece en la respuesta'
  );
  assert.ok(
    !String(res.body.usuario).includes('smtp-user-de-prueba'),
    'el usuario va enmascarado'
  );
});

test('cuenta de envio · el POST con puerto y secure por omision usa los defaults', async () => {
  limpiar();
  const cuerpo = Object.assign({}, CUENTA);
  delete cuerpo.puerto;
  delete cuerpo.secure;

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .send(cuerpo)
    .timeout({ response: 3000 });

  assert.equal(res.status, 201);
  assert.equal(res.body.puerto, 587);
  assert.equal(res.body.secure, false);
});

test('cuenta de envio · el POST de una Empresa que no existe devuelve 404', async () => {
  limpiar();
  const res = await request(makeApp())
    .post('/internal/admin/empresas/999999999/cuenta-envio')
    .set(ADMIN)
    .send(CUENTA)
    .timeout({ response: 3000 });

  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'EMPRESA_NOT_FOUND');
});

test('cuenta de envio · el POST con un body incompleto devuelve 400', async () => {
  limpiar();
  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .send({ host: 'smtp.empresa.example' })
    .timeout({ response: 3000 });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('cuenta de envio · el POST sin clave en el alta devuelve 400', async () => {
  limpiar();
  const cuerpo = Object.assign({}, CUENTA);
  delete cuerpo.clave;

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .send(cuerpo)
    .timeout({ response: 3000 });

  assert.equal(res.status, 400);
});

test('cuenta de envio · el POST repetido actualiza y no vuelve a crear', async () => {
  limpiar();
  const app = makeApp();
  await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .send(CUENTA)
    .expect(201);

  const res = await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .send(Object.assign({}, CUENTA, { host: 'smtp.nuevo.empresa.example' }))
    .timeout({ response: 3000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.host, 'smtp.nuevo.empresa.example');
});

// ─────────────────────────────────────────────────────────────────────────────
// El GET con la cuenta ya creada
// ─────────────────────────────────────────────────────────────────────────────

test('cuenta de envio · el GET devuelve la vista enmascarada', async () => {
  limpiar();
  const app = makeApp();
  await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .send(CUENTA)
    .expect(201);

  const res = await request(app)
    .get(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .timeout({ response: 3000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.host, CUENTA.host);
  assert.equal(res.body.clave, undefined);
  assert.equal(res.body.clave_presente, true);
  assert.ok(!JSON.stringify(res.body).includes(CLAVE));
});

// ─────────────────────────────────────────────────────────────────────────────
// El rastro
// ─────────────────────────────────────────────────────────────────────────────

test('cuenta de envio · el cambio deja rastro con el actor y el motivo del header', async () => {
  limpiar();
  await request(makeApp())
    .post(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'ladueña de cuentas')
    .set('X-Admin-Motivo', 'la Empresa cambio su servidor de correo')
    .send(CUENTA)
    .expect(201);

  const filas = renglones();
  assert.ok(filas.length > 0, 'el alta dejo rastro');
  for (const f of filas) {
    assert.equal(f.id_actor, 'ladueña de cuentas');
    assert.equal(f.motivo, 'la Empresa cambio su servidor de correo');
  }
  const clave = filas.find((f) => f.campo === 'clave_cuenta_envio');
  assert.equal(clave.valor_nuevo, 'CONFIGURADA');
  assert.ok(
    !JSON.stringify(filas).includes(CLAVE),
    'la clave no aparece en el rastro'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// El DELETE
// ─────────────────────────────────────────────────────────────────────────────

test('cuenta de envio · el DELETE elimina la cuenta y deja rastro', async () => {
  limpiar();
  const app = makeApp();
  await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .send(CUENTA)
    .expect(201);

  const res = await request(app)
    .delete(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'la dueña')
    .set('X-Admin-Motivo', 'la Empresa dio de baja la cuenta')
    .timeout({ response: 3000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);

  const despues = await request(app)
    .get(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .timeout({ response: 3000 });
  assert.equal(despues.status, 404, 'la cuenta ya no esta');

  const filas = renglones();
  const borrada = filas.find((f) => f.campo === 'cuenta_envio');
  assert.ok(borrada, 'el borrado quedo anotado');
  assert.equal(borrada.valor_nuevo, 'ELIMINADA');
});

test('cuenta de envio · el DELETE de una cuenta que no existe devuelve 404', async () => {
  limpiar();
  const res = await request(makeApp())
    .delete(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .timeout({ response: 3000 });

  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'CUENTA_ENVIO_NOT_FOUND');
});

// ─────────────────────────────────────────────────────────────────────────────
// La prueba
// ─────────────────────────────────────────────────────────────────────────────

test('cuenta de envio · probar manda un correo de prueba y responde {ok, detalle}', async () => {
  limpiar();
  const app = makeApp();
  await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .send(CUENTA)
    .expect(201);

  const res = await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/cuenta-envio/probar`)
    .set(ADMIN)
    .send({ to: 'operador@ejemplo.com' })
    .timeout({ response: 5000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.ok(res.body.detalle, 'responde el detalle');
  assert.ok(
    !JSON.stringify(res.body).includes(CLAVE),
    'la prueba no devuelve la clave'
  );
});

test('cuenta de envio · probar sin cuenta activa devuelve 400', async () => {
  limpiar();
  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${EMPRESA}/cuenta-envio/probar`)
    .set(ADMIN)
    .send({ to: 'operador@ejemplo.com' })
    .timeout({ response: 3000 });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'CUENTA_ENVIO_NO_CONFIGURADA');
});

test('cuenta de envio · probar una cuenta inactiva devuelve 400', async () => {
  limpiar();
  const app = makeApp();
  await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .send(Object.assign({}, CUENTA, { activo: false }))
    .expect(201);

  const res = await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/cuenta-envio/probar`)
    .set(ADMIN)
    .send({ to: 'operador@ejemplo.com' })
    .timeout({ response: 3000 });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'CUENTA_ENVIO_NO_CONFIGURADA');
});

test('cuenta de envio · probar sin destino devuelve 400', async () => {
  limpiar();
  const app = makeApp();
  await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/cuenta-envio`)
    .set(ADMIN)
    .send(CUENTA)
    .expect(201);

  const res = await request(app)
    .post(`/internal/admin/empresas/${EMPRESA}/cuenta-envio/probar`)
    .set(ADMIN)
    .send({})
    .timeout({ response: 3000 });

  assert.equal(res.status, 400);
});
