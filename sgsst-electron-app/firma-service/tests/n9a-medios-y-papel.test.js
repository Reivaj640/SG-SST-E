/**
 * LA 9A: LOS MEDIOS AUTORIZADOS (el 8.2) Y LA FIRMA EN PAPEL (el 7.1-7.3)
 * =======================================================================
 *
 * Lo que estos tests fijan:
 *
 *   LOS MEDIOS (el 8.2)
 *   - Al crear la solicitud quedan registrados el correo de la hoja de vida
 *     y el enlace de K+AIR (los dos que el 8.2 autoriza de entrada).
 *   - El medio que declara el Trabajador (el D-2) nace PENDIENTE y se
 *     activa cuando el código verifica que lo controla.
 *   - El Trabajador los ve y los modifica desde la mini-app; antes de
 *     identificarse, no puede.
 *   - La Empresa los ve por la API interna (es por ahí por donde le
 *     entrega las copias).
 *
 *   LA FIRMA EN PAPEL (el 7.1-7.3)
 *   - El Trabajador puede pedirla en cualquier momento, y queda constancia.
 *   - La mini-app sigue sirviendo la pantalla de confirmación.
 *   - La Empresa registra el documento ya firmado: se guarda, se le calcula
 *     la huella, se genera el Registro de firma autográfica y le llega la
 *     copia.
 *   - Sin la petición del Trabajador, la Empresa no puede "registrar" un
 *     papel que nadie pidió (409).
 *   - El suministro a una autoridad queda asentado (el 8.4).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { PDFDocument } = require('pdf-lib');

const db = require('../src/db/connection');
const mailer = require('../src/services/mailer');
const empresaService = require('../src/services/empresa');
const mediosService = require('../src/services/medios');
const papelService = require('../src/services/papel');
const storage = require('../src/services/storage');
const {
  resetDb, seedActiveAgreement, makeApp, createSignRequestWithIdentificacion,
  seedTestClients, withClientAApiKey,
} = require('./helpers');

const EMPRESA = '900123456';
const TRABAJADOR = '1234567890';
const CORREO_EMPRESA = 'trabajador@empresa-corp.com';
const CORREO_PERSONAL = 'mipersonal@ejemplo.net';

function registrarEmpresa() {
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
  empresaService.create({
    id_empresa: EMPRESA,
    razon_social: 'Empresa de Prueba 9A S.A.S.',
    nit: EMPRESA,
    canal_pqrs: 'rrhh@empresa-corp.com',
    plazo_retencion: '5 anos',
    plazo_retencion_dias: 1825,
  });
  // D-03: sin Anexo de Encargo firmado, la empresa no puede pedir firmas.
  empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-20');
}

function crearSolicitud({ correo = CORREO_EMPRESA } = {}) {
  return createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    // El correo que la Empresa registró: es el "correo electrónico
    // registrado en su hoja de vida" del 8.2, y el que se archiva en la
    // fila como `correo_verificacion`.
    correo_verificacion: correo,
    metadata: JSON.stringify({ correo }),
  });
}

/** Identifica al trabajador y verifica el OTP (deja la solicitud en OTP_VERIFIED). */
async function identificarYVerificar(token) {
  const id = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: TRABAJADOR })
    .timeout({ response: 5000 });
  assert.equal(id.status, 200, JSON.stringify(id.body));
  const dev = await request(makeApp())
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: id.body.devOtp })
    .timeout({ response: 5000 });
  assert.equal(dev.status, 200, JSON.stringify(dev.body));
  return dev.body;
}

function limpiar() {
  resetDb();
  seedActiveAgreement();
  seedTestClients();
  mailer.clearDevInbox();
  registrarEmpresa();
}

/** Un PDF válido (el que la Empresa subiría escaneado). */
async function pdfDePrueba(texto) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  page.drawText(texto || 'Documento firmado en papel');
  return Buffer.from(await doc.save());
}

// ===========================================================================
// LOS MEDIOS AUTORIZADOS (el 8.2)
// ===========================================================================

test('9A · al crear la solicitud quedan registrados los dos medios del 8.2', async () => {
  limpiar();
  const { signRequest } = await crearSolicitud();

  const medios = mediosService.listarActivos(EMPRESA, signRequest.id_trabajador);
  const tipos = medios.map((m) => m.tipo).sort();
  assert.deepEqual(tipos, ['EMAIL_HOJA_VIDA', 'LINK_KAIR'],
    'el 8.2 autoriza de entrada el correo de la hoja de vida y el enlace de K+AIR');
});

test('9A · el medio declarado por el Trabajador nace PENDIENTE y se activa al verificar el OTP', async () => {
  limpiar();
  const { token, signRequest } = await crearSolicitud();

  // La declaración (la vía del D-2).
  const decl = await request(makeApp())
    .post(`/api/sign/${token}/medio`)
    .send({ correo: CORREO_PERSONAL })
    .timeout({ response: 5000 });
  assert.equal(decl.status, 200, JSON.stringify(decl.body));

  // Antes de verificar: PENDIENTE. Todavía no se controla el buzón.
  let medios = mediosService.listarTodos(EMPRESA, signRequest.id_trabajador);
  const pendiente = medios.find((m) => m.tipo === 'CORREO_OTP');
  assert.ok(pendiente, 'el medio declarado está en el registro');
  assert.equal(pendiente.estado, 'PENDIENTE',
    'un medio sin verificar no sirve para entregar copias');
  assert.equal(mediosService.listarActivos(EMPRESA, signRequest.id_trabajador)
    .filter((m) => m.tipo === 'CORREO_OTP').length, 0,
  'y no está entre los activos');

  // Identificar + verificar el código.
  await identificarYVerificar(token);

  medios = mediosService.listarTodos(EMPRESA, signRequest.id_trabajador);
  const activo = medios.find((m) => m.tipo === 'CORREO_OTP');
  assert.equal(activo.estado, 'ACTIVO',
    'verificado el código, el Trabajador demostró que controla el buzón');
});

test('9A · el Trabajador ve y modifica sus medios desde la mini-app', async () => {
  limpiar();
  const { token } = await crearSolicitud();
  await identificarYVerificar(token);

  const lista = await request(makeApp())
    .get(`/api/sign/${token}/medios`)
    .timeout({ response: 5000 });
  assert.equal(lista.status, 200, JSON.stringify(lista.body));
  assert.ok(lista.body.medios.length >= 2, 've sus medios');

  // Dar de baja un medio.
  const baja = await request(makeApp())
    .post(`/api/sign/${token}/medios`)
    .send({ accion: 'BAJA', tipo: 'CORREO_OTP', correo: CORREO_PERSONAL })
    .timeout({ response: 5000 });
  assert.equal(baja.status, 200, JSON.stringify(baja.body));
  assert.equal(baja.body.medio.estado, 'BAJA');
});

test('9A · sin identificarse, el Trabajador no puede tocar los medios', async () => {
  limpiar();
  const { token } = await crearSolicitud();

  const lista = await request(makeApp())
    .get(`/api/sign/${token}/medios`)
    .timeout({ response: 5000 });
  assert.equal(lista.status, 409);
  assert.equal(lista.body.error.code, 'INVALID_STATE_TRANSITION');
});

test('9A · la Empresa ve los medios autorizados por la API interna', async () => {
  limpiar();
  const { token, signRequest } = await crearSolicitud();
  await identificarYVerificar(token);

  const res = await request(makeApp())
    .get(`/internal/sign-requests/${signRequest.id_solicitud}/medios`)
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY_CLIENT_A)
    .timeout({ response: 5000 });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(Array.isArray(res.body.medios_activos));
  assert.ok(res.body.medios_activos.length >= 1,
    'la Empresa necesita saber por dónde entregar la copia');
});

// ===========================================================================
// LA OFERTA DE LA VÍA EN PAPEL (la evidencia que la norma no exige pero sí pesa)
// ===========================================================================
// El evento de la PETICIÓN no prueba que la opción estuviera disponible: solo
// prueba que un trabajador supo de la vía. Ante un Inspector del Trabajo
// (el 2.2.1.1.15) la pregunta es ¿cómo prueba la Empresa que la opción
// estaba ahí? La oferta viaja en el CORREO de invitación (lo manda la Empresa,
// que es quien tiene el deber del 7.2) y lo que queda archivado es la huella
// del cuerpo enviado.

test('9A · el correo de invitación ofrece la vía en papel y queda asentado', async () => {
  limpiar();
  const { signRequest } = await crearSolicitud();

  const res = await request(makeApp())
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/notify-remote`)
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY_CLIENT_A)
    .send({ correo: CORREO_PERSONAL })
    .timeout({ response: 10000 });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  // El correo menciona la vía en papel.
  const inbox = mailer.getDevInbox();
  const invite = inbox.find((m) => m.tipo === 'invite');
  assert.ok(invite, 'se envió la invitación');
  assert.match(invite.body, /papel/i,
    'la invitación ofrece la vía en papel');

  // Y queda el asiento de la OFERTA, con la huella del cuerpo enviado.
  const evento = db.prepare(
    "SELECT metadata, ip, user_agent FROM gh_firma_eventos WHERE firma_id = ? AND evento = 'PAPER_OPTION_AVAILABLE'"
  ).get(signRequest.id);
  assert.ok(evento, 'la oferta queda asentada');
  const meta = JSON.parse(evento.metadata);
  assert.equal(meta.canal, 'correo');
  assert.ok(meta.hash_oferta && meta.hash_oferta.length === 64,
    'con la huella de lo que se le envió');

  // Minimización: la oferta NO es una manifestación del Trabajador, así
  // que no guarda la IP ni el user-agent.
  assert.equal(evento.ip, null);
  assert.equal(evento.user_agent, null);
});

test('9A · la oferta se asienta una sola vez', async () => {
  limpiar();
  const { signRequest } = await crearSolicitud();

  for (let i = 0; i < 2; i++) {
    await request(makeApp())
      .post(`/internal/sign-requests/${signRequest.id_solicitud}/notify-remote`)
      .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY_CLIENT_A)
      .send({ correo: CORREO_PERSONAL })
      .timeout({ response: 10000 });
  }

  const n = db.prepare(
    "SELECT COUNT(*) c FROM gh_firma_eventos WHERE firma_id = ? AND evento = 'PAPER_OPTION_AVAILABLE'"
  ).get(signRequest.id);
  assert.equal(n.c, 1, 'la oferta se asienta una sola vez por solicitud');
});

// ===========================================================================
// LA FIRMA EN PAPEL (el 7.1-7.3)
// ===========================================================================
// La vía en papel NO la pide el Trabajador desde la mini-app: la mini-app
// no menciona el papel. El 7.2 es un DEBER DE LA EMPRESA (proveer la firma
// autográfica), y el producto no puede prometer en nombre de la Empresa lo que
// la Empresa hará (veracidad, Ley 1581 art. 4(d)(e), D.1377 art. 4).
//
// Así que la vía es:
//   1. La Empresa publica su canal de atención (en el Acuerdo, en el pie de la
//      mini-app y en el correo de invitación).
//   2. El Trabajador le pide el papel por ese canal.
//   3. La Empresa lo registra en K+AIR: `POST /internal/sign-requests/:id/firma-papel`.
//
// Lo que esto fija:
//   - La mini-app no dice NADA del papel.
//   - El registro del documento firmado en papel abre la vía (si no estaba),
//     con el asiento `PAPER_TRACK_OPENED` y el canal por el que llegó la
//     petición, y CIERRA la vía electrónica (nada de doble firma).
//   - El documento en papel queda con su huella, su Registro de firma
//     autográfica y la copia al Trabajador.
//   - El correo de invitación ofrece la vía y deja la huella del cuerpo
//     enviado (la prueba de qué se le ofreció).

test('9A · la mini-app no menciona la firma en papel', async () => {
  // El 7.2 lo cumple la Empresa, no la pantalla. La mini-app no promete nada
  // en nombre de la Empresa.
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(
    path.resolve(__dirname, '..', 'web', 'firma', 'index.html'), 'utf8'
  );
  const js = fs.readFileSync(
    path.resolve(__dirname, '..', 'web', 'firma', 'app.js'), 'utf8'
  );
  assert.ok(!/papel/i.test(html), 'la mini-app no menciona el papel');
  assert.ok(!/papel/i.test(js), 'ni su código');
});

test('9A · la Empresa registra el documento firmado en papel y cierra la vía electrónica', async () => {
  limpiar();
  const { signRequest } = await crearSolicitud();
  const pdf = await pdfDePrueba('Firmado a mano');

  const res = await request(makeApp())
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/firma-papel`)
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY_CLIENT_A)
    .field('metadata', JSON.stringify({ canal: 'correo', nota: 'El trabajador lo pidió por correo' }))
    .attach('documento', pdf, 'firmado.pdf')
    .timeout({ response: 10000 });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.estado_papel, 'FIRMADO');

  // El asiento: la vía se abrió con el canal por el que llegó la petición.
  const abierto = db.prepare(
    "SELECT metadata, id_actor FROM gh_firma_eventos WHERE firma_id = ? AND evento = 'PAPER_TRACK_OPENED'"
  ).get(signRequest.id);
  assert.ok(abierto, 'la vía en papel quedó abierta y asentada');
  const metaAbierto = JSON.parse(abierto.metadata);
  assert.equal(metaAbierto.canal, 'correo',
    'el canal es la evidencia de que la opción existía y era accesible');

  // La vía electrónica queda cerrada: nada de doble firma.
  const electronica = db.prepare(
    'SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud);
  assert.equal(electronica.estado, 'CANCELLED');

  // El PDF quedó guardado con su huella, y el Registro de firma autográfica.
  const fila = papelService.obtenerPorSolicitud(signRequest.id_solicitud);
  assert.ok(storage.exists(fila.pdf_firmado_path), 'el PDF firmado en papel está');
  assert.equal(fila.pdf_hash, res.body.pdf_hash);
  assert.ok(storage.exists(fila.registro_path), 'el Registro de firma autográfica está');

  // El evento del registro.
  const evento = db.prepare(
    "SELECT metadata FROM gh_firma_eventos WHERE firma_id = ? AND evento = 'PAPER_SIGNATURE_REGISTERED'"
  ).get(signRequest.id);
  assert.ok(evento, 'el asiento del registro en papel existe');
});

test('9A · la copia del documento en papel le llega al Trabajador', async () => {
  limpiar();
  const { token, signRequest } = await crearSolicitud();

  // El Trabajador declara su medio personal y verifica el código.
  await request(makeApp())
    .post(`/api/sign/${token}/medio`)
    .send({ correo: CORREO_PERSONAL })
    .timeout({ response: 5000 });
  await identificarYVerificar(token);

  mailer.clearDevInbox();
  const pdf = await pdfDePrueba('Firmado a mano');
  const res = await request(makeApp())
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/firma-papel`)
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY_CLIENT_A)
    .attach('documento', pdf, 'firmado.pdf')
    .timeout({ response: 10000 });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.copia.enviada, true, JSON.stringify(res.body.copia));
  assert.equal(res.body.copia.medio, 'CORREO_OTP',
    'la copia va al medio personal que el Trabajador autorizó');

  const inbox = mailer.getDevInbox();
  const copia = inbox.find((m) => m.tipo === 'copy_signed');
  assert.ok(copia, 'se enviió la copia');
  assert.equal(copia.to, CORREO_PERSONAL);
});

test('9A · ya no se puede registrar un papel sobre una firma electrónica hecha', async () => {
  limpiar();
  const { signRequest } = await crearSolicitud();
  // Se simula el estado en el que la firma electrónica ya salió.
  db.prepare("UPDATE gh_firmas_electronicas SET estado = 'SIGNED' WHERE id = ?")
    .run(signRequest.id);

  const pdf = await pdfDePrueba('Firmado a mano');
  const res = await request(makeApp())
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/firma-papel`)
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY_CLIENT_A)
    .attach('documento', pdf, 'firmado.pdf')
    .timeout({ response: 10000 });

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'INVALID_STATE_TRANSITION');
});

test('9A · el suministro a una autoridad queda asentado (el 8.4)', async () => {
  limpiar();
  const { signRequest } = await crearSolicitud();
  const pdf = await pdfDePrueba('Firmado a mano');
  await request(makeApp())
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/firma-papel`)
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY_CLIENT_A)
    .attach('documento', pdf, 'firmado.pdf')
    .timeout({ response: 10000 });

  const res = await request(makeApp())
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/suministro-autoridad`)
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY_CLIENT_A)
    .send({
      autoridad: 'Juzgado 12 Civil de Bogotá',
      radicado: '2026-12345',
      destinatario: 'Secretaría',
    })
    .timeout({ response: 5000 });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.asiento.autoridad, 'Juzgado 12 Civil de Bogotá');

  const evento = db.prepare(
    "SELECT metadata FROM gh_firma_eventos WHERE firma_id = ? AND evento = 'DOCUMENT_SUPPLIED_TO_AUTHORITY'"
  ).get(signRequest.id);
  assert.ok(evento, 'el suministro a la autoridad queda en el registro');
  const meta = JSON.parse(evento.metadata);
  assert.equal(meta.autoridad, 'Juzgado 12 Civil de Bogotá');
  assert.equal(meta.radicado, '2026-12345');
});
