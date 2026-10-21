/**
 * 1.3 · EL 10.7(b): K+AIR ATIENDE, REGISTRA Y TRASMITE LAS SOLICITUDES
 * =============================================================
 *
 * El numeral 10.7(b) del Acuerdo, en su redacción nueva, dice que K+AIR
 * (Encargado) "también atiende las solicitudes de los Titulares que le sean
 * dirigidas", que designa "una persona o área que asuma la función de
 * protección de datos personales", que "mantiene a disposición de los
 * Titulares un mecanismo sencillo, ágil y permanentemente disponible", que
 * "registra toda solicitud que recibe", que "la remite a la Empresa dentro
 * de los dos (2) días hábiles siguientes" y que "informa al Titular sobre el
 * estado de su solicitud".
 *
 * Y que NO resuelve: la respuesta es de la Empresa, que es la Responsable
 * (10.7 literal d).
 *
 * Lo que estos tests fijan:
 *   1. El canal público existe, registra y devuelve folio + plazo.
 *   2. El plazo se cuenta en días HÁBILES (y lo define la config, no el
 *      código).
 *   3. El documento del solicitante se guarda como HUELLA, no en claro.
 *   4. La solicitud NO cuelga de la firma: la 5B no la alcanza.
 *   5. El flujo: RECIBIDA → TRASMITIDA → RESPONDIDA, con su historial.
 *   6. El historial es append-only (el trigger del archivo REAL).
 *   7. El canal es DISTINTO del de incidentes, y se publica en la mini-app
 *      y en el correo de invitación.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const Database = require('better-sqlite3');

const db = require('../src/db/connection');
const config = require('../src/config');
const solicitudes = require('../src/services/solicitudes');
const mailer = require('../src/services/mailer');
const {
  resetDb, seedActiveAgreement, makeApp, createSignRequestWithIdentificacion,
  TEST_ADMIN_API_KEY,
} = require('./helpers');

const SERVICE = path.resolve(__dirname, '..');
const SQL_029 = fs.readFileSync(
  path.join(SERVICE, 'src', 'db', 'schema', '029_solicitudes_titular_append_only.sql'),
  'utf8'
);

const ADMIN = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };
const EMPRESA = '900123456';

function limpiar() {
  resetDb();
  seedActiveAgreement();
}

// ===========================================================================
// 1. El canal: registrar
// ===========================================================================

test('1.3 · el canal público registra la solicitud y devuelve folio y plazo', async () => {
  limpiar();
  const app = makeApp();

  const res = await request(app)
    .post('/api/solicitudes')
    .send({
      tipo: 'ACCESO',
      nombre: 'Titular Sintetico',
      correo: 'titular@example.com',
      documento: '1234567890',
      contenido: 'Quiero una copia de mi constancia.',
    })
    .timeout({ response: 5000 });

  assert.equal(res.status, 201);
  assert.ok(res.body.folio, 'devuelve un folio');
  assert.equal(res.body.estado, 'RECIBIDA');
  assert.ok(res.body.plazo_tramite, 'devuelve el plazo de trasmisión');
  assert.match(res.body.mensaje, /tu empresa|la Empresa/i,
    'el mensaje dice que la respuesta la da la Empresa');
});

test('1.3 · el plazo se cuenta en DÍAS HÁBILES', () => {
  // Viernes 2026-10-16 + 2 hábiles = martes 2026-10-20 (el fin de semana no
  // cuenta).
  const viernes = new Date('2026-10-16T12:00:00.000Z');
  const martes = solicitudes._sumarDiasHabiles(viernes, 2);
  assert.equal(martes.getUTCDay(), 2, 'cae en martes');
  assert.equal(martes.toISOString().slice(0, 10), '2026-10-20');

  // Y el plazo sale de la CONFIGURACIÓN, no del código.
  assert.equal(config.plazoTramiteDias, 2,
    'el plazo de la política vive en FIRMA_PLAZO_TRAMITE_DIAS');
});

test('1.3 · el documento del solicitante se guarda como HUELLA', () => {
  limpiar();
  const r = solicitudes.registrar({
    tipo: 'CORRECCION',
    correo: 'titular@example.com',
    documento: '1234567890',
    contenido: 'Mi nombre está mal.',
  });

  const fila = db.prepare(
    'SELECT solicitante_documento_hash, contenido FROM gh_solicitudes_titular WHERE folio = ?'
  ).get(r.folio);

  assert.ok(fila.solicitante_documento_hash, 'la huella se guarda');
  assert.equal(fila.solicitante_documento_hash.length, 64);
  assert.equal(fila.solicitante_documento_hash.includes('1234567890'), false,
    'el documento NO queda en claro');
});

test('1.3 · un tipo de solicitud inválido se rechaza', async () => {
  limpiar();
  const res = await request(makeApp())
    .post('/api/solicitudes')
    .send({ tipo: 'HACER_MAGIA', correo: 'titular@example.com' })
    .timeout({ response: 5000 });

  assert.equal(res.status, 400);
});

// ===========================================================================
// 2. La solicitud NO cuelga de la firma (la 5B no la alcanza)
// ===========================================================================

test('1.3 · la solicitud sobrevive a que se borre la firma', async () => {
  limpiar();
  const r = solicitudes.registrar({
    tipo: 'ACCESO',
    correo: 'titular@example.com',
    contenido: 'Pido copia.',
  });

  // Se crea una firma y se borra como lo hace la 5B (eventos primero,
  // porque tienen FK a la firma).
  const { signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });
  db.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = ?').run(signRequest.id);
  db.prepare('DELETE FROM gh_firma_sesiones WHERE firma_id = ?').run(signRequest.id);
  db.prepare('DELETE FROM gh_firmas_electronicas WHERE id = ?').run(signRequest.id);

  // La solicitud y su historial siguen ahí: no cuelgan de la firma.
  const fila = db.prepare(
    'SELECT * FROM gh_solicitudes_titular WHERE folio = ?'
  ).get(r.folio);
  assert.ok(fila, 'la solicitud sobrevive a la supresión de la firma');
  assert.equal(solicitudes.eventos(fila.id).length, 1, 'y su historial también');
});

// ===========================================================================
// 3. El flujo: RECIBIDA → TRASMITIDA → RESPONDIDA
// ===========================================================================

test('1.3 · la trasmisión a la Empresa deja estado y evento', async () => {
  limpiar();
  const r = solicitudes.registrar({
    tipo: 'SUPRESION',
    correo: 'titular@example.com',
    contenido: 'Quiero que borren mis datos.',
  });

  const res = await request(makeApp())
    .post(`/internal/admin/solicitudes/${r.id_solicitud}/trasmitir`)
    .set(ADMIN)
    .send({
      actor: 'kair:operador',
      id_empresa: EMPRESA,
      canal_empresa: 'pqrs@example.com',
      evidencia: { constancia: 'firma-123.pdf' },
    })
    .timeout({ response: 5000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'TRASMITIDA');
  assert.ok(res.body.trasmitida_at, 'la fecha de trasmisión queda');

  const eventos = solicitudes.eventos(r.id_solicitud).map((e) => e.evento);
  assert.deepEqual(eventos, ['SOLICITUD_RECIBIDA', 'SOLICITUD_TRASMITIDA']);
});

test('1.3 · la respuesta de la Empresa se guarda y cierra el trámite', async () => {
  limpiar();
  const r = solicitudes.registrar({
    tipo: 'ACCESO',
    correo: 'titular@example.com',
    contenido: 'Pido copia.',
  });

  const app = makeApp();
  await request(app)
    .post(`/internal/admin/solicitudes/${r.id_solicitud}/trasmitir`)
    .set(ADMIN)
    .send({ actor: 'kair:operador', id_empresa: EMPRESA })
    .timeout({ response: 5000 });

  const res = await request(app)
    .post(`/internal/admin/solicitudes/${r.id_solicitud}/responder`)
    .set(ADMIN)
    .send({
      actor: 'empresa:rrhh',
      respuesta: 'Adjuntamos la constancia.',
      evidencia: { constancia: 'firma-123.pdf' },
    })
    .timeout({ response: 5000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'RESPONDIDA');
  assert.equal(res.body.respuesta, 'Adjuntamos la constancia.');
  assert.ok(res.body.respondida_at);

  const eventos = solicitudes.eventos(r.id_solicitud).map((e) => e.evento);
  assert.deepEqual(eventos, [
    'SOLICITUD_RECIBIDA',
    'SOLICITUD_TRASMITIDA',
    'SOLICITUD_RESPONDIDA',
  ]);
});

test('1.3 · sin la llave de admin, el trámite no se puede mover', async () => {
  limpiar();
  const r = solicitudes.registrar({
    tipo: 'ACCESO',
    correo: 'titular@example.com',
  });

  const res = await request(makeApp())
    .post(`/internal/admin/solicitudes/${r.id_solicitud}/trasmitir`)
    .send({ actor: 'kair:operador' })
    .timeout({ response: 5000 });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('1.3 · el listado del admin filtra por estado', async () => {
  limpiar();
  const r = solicitudes.registrar({ tipo: 'ACCESO', correo: 'a@example.com' });
  solicitudes.trasmitir(r.id_solicitud, { actor: 'kair:operador', id_empresa: EMPRESA });

  const todas = await request(makeApp())
    .get('/internal/admin/solicitudes')
    .set(ADMIN)
    .timeout({ response: 5000 });
  assert.equal(todas.status, 200);
  assert.equal(todas.body.total, 1);

  const filtradas = await request(makeApp())
    .get('/internal/admin/solicitudes?estado=TRASMITIDA')
    .set(ADMIN)
    .timeout({ response: 5000 });
  assert.equal(filtradas.body.total, 1);
  assert.equal(filtradas.body.items[0].estado, 'TRASMITIDA');
});

// ===========================================================================
// 4. El historial es append-only (el trigger del ARCHIVO REAL)
// ===========================================================================

test('1.3 · el historial no se puede UPDATE ni DELETE (trigger real)', () => {
  // Se aplica el ARCHIVO REAL de la migración 029 en una base aislada: en la
  // base compartida los triggers no pueden estar porque `resetDb()` borra
  // las tablas entre tests (mismo patrón que la 020 y la 025).
  const ruta = path.join(
    os.tmpdir(),
    'kair-solicitudes-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.sqlite'
  );
  const bd = new Database(ruta);
  bd.exec(`
    CREATE TABLE gh_solicitudes_titular (id INTEGER PRIMARY KEY);
    CREATE TABLE gh_solicitudes_titular_eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitud_id INTEGER NOT NULL,
      evento TEXT NOT NULL,
      fecha_hora TEXT NOT NULL,
      id_actor TEXT NOT NULL,
      metadata TEXT
    );
  `);
  bd.exec(SQL_029);
  bd.prepare('INSERT INTO gh_solicitudes_titular (id) VALUES (1)').run();
  bd.prepare(
    "INSERT INTO gh_solicitudes_titular_eventos (solicitud_id, evento, fecha_hora, id_actor) VALUES (1, 'SOLICITUD_RECIBIDA', datetime('now'), 'titular')"
  ).run();

  assert.throws(
    () => bd.prepare("UPDATE gh_solicitudes_titular_eventos SET evento = 'X'").run(),
    /append-only/,
    'el historial no se puede alterar'
  );
  assert.throws(
    () => bd.prepare('DELETE FROM gh_solicitudes_titular_eventos').run(),
    /append-only/,
    'el historial no se puede borrar'
  );

  bd.close();
  fs.unlinkSync(ruta);
});

// ===========================================================================
// 5. El canal se publica (mini-app y correo)
// ===========================================================================

test('1.3 · el canal de protección de datos es DISTINTO del de incidentes', () => {
  assert.ok(config.canalProteccionDatos, 'existe un canal de protección de datos');
  assert.notEqual(config.canalProteccionDatos, config.canalIncidentes,
    'un solo canal con dos nombres es un punto ciego con otro nombre');
});

test('1.3 · la mini-app publica los dos canales', async () => {
  limpiar();
  const app = makeApp();
  const { token } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });

  const res = await request(app)
    .get(`/s/${token}`)
    .set('Accept', 'application/json')
    .timeout({ response: 5000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.canal_incidentes_kair, config.canalIncidentes);
  assert.equal(res.body.canal_proteccion_datos_kair, config.canalProteccionDatos);
});

test('1.3 · el correo de invitación dice dónde ejercer los derechos', async () => {
  limpiar();
  mailer.clearDevInbox();

  const { signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });
  const signRequestService = require('../src/services/signRequest');
  await signRequestService.notifyRemote(signRequest, 'trabajador@example.com', {});

  const inbox = mailer.getDevInbox();
  const cuerpo = inbox[inbox.length - 1].body;
  assert.ok(cuerpo.includes('Derechos de tus datos'),
    'el Trabajador tiene que saber a quién escribir: ' + cuerpo.slice(0, 200));
  assert.ok(cuerpo.includes(config.canalProteccionDatos));
});
